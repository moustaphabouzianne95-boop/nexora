import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, parseBody, HttpError, requireWorkspace, logActivity, notify } from '@/lib/api-helpers'
import { invitationToken } from '@/lib/auth'
import { inviteSchema } from '@/lib/validation'
import { rateLimit } from '@/lib/rate-limit'
import { assertCanInviteMember } from '@/lib/entitlements'
import { toInvitationDTO, inviterNameMap } from '@/app/api/workspaces/_lib/helpers'

export const runtime = 'nodejs'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

function devLink(token: string): string {
  // Dev/demo only — the invited user can accept via POST /api/invitations/accept {token}.
  return `/?invite=${token}`
}

/** GET /api/workspaces/:id/invitations — cap member.invite. Lazily expires stale PENDING rows. */
export const GET = handler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params
  await requireWorkspace(id, 'member.invite')

  // Lazy expiry: PENDING rows past their expiry are marked EXPIRED on read.
  await db.workspaceInvitation.updateMany({
    where: { workspaceId: id, status: 'PENDING', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  })

  const invitations = await db.workspaceInvitation.findMany({
    where: { workspaceId: id },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
  })

  const names = await inviterNameMap([...new Set(invitations.map((i) => i.invitedById))])

  return ok({
    invitations: invitations.map((inv) => toInvitationDTO(inv, names.get(inv.invitedById) ?? 'Unknown')),
  })
})

/**
 * POST /api/workspaces/:id/invitations — cap member.invite, plan-limited
 * (assertCanInviteMember → 402), duplicate-guarded (409). Dev mode returns
 * the invitation DTO plus `devLink` (no email is ever sent in this sandbox).
 */
export const POST = handler(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params
  const { auth, workspace } = await requireWorkspace(id, 'member.invite')

  if (!rateLimit(`invite:${auth.user.id}`, 20, 60 * 60 * 1000)) {
    throw new HttpError(429, 'Too many invitations sent. Please try again later.', 'RATE_LIMITED')
  }

  const data = await parseBody(req, inviteSchema)

  // Plan limit (FREE/PRO member caps) — 402 with an upgrade-oriented message.
  const memberCount = await db.workspaceMember.count({ where: { workspaceId: id } })
  await assertCanInviteMember(id, memberCount)

  // Duplicate guard 1: already a member.
  const existingUser = await db.user.findUnique({ where: { email: data.email } })
  if (existingUser) {
    const existingMember = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: id, userId: existingUser.id } },
    })
    if (existingMember) {
      throw new HttpError(409, 'This person is already a member of the workspace.', 'ALREADY_MEMBER', {
        email: 'Already a member.',
      })
    }
  }

  // Duplicate guard 2: a live pending invitation for this email.
  const pending = await db.workspaceInvitation.findFirst({
    where: { workspaceId: id, email: data.email, status: 'PENDING', expiresAt: { gt: new Date() } },
  })
  if (pending) {
    throw new HttpError(409, 'An invitation for this email is already pending.', 'INVITE_PENDING', {
      email: 'Invitation already pending.',
    })
  }

  const token = invitationToken()
  const invitation = await db.workspaceInvitation.create({
    data: {
      workspaceId: id,
      email: data.email,
      role: data.role,
      token,
      status: 'PENDING',
      invitedById: auth.user.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  })

  await logActivity({
    workspaceId: id,
    actorId: auth.user.id,
    resourceType: 'MEMBER',
    resourceId: invitation.id,
    action: 'INVITED',
    metadata: { email: data.email, role: data.role },
  })

  // Notify the invitee when they already have an account (honors prefs via notify()).
  if (existingUser) {
    await notify({
      userId: existingUser.id,
      workspaceId: id,
      type: 'INVITATION',
      title: `You've been invited to join ${workspace.name}`,
      body: `${auth.user.name} invited you as ${data.role.toLowerCase().replace('_', ' ')}.`,
      resourceType: 'WORKSPACE',
      resourceId: id,
    })
  }

  const dto = toInvitationDTO(invitation, auth.user.name)
  return ok(
    process.env.NODE_ENV !== 'production' ? { ...dto, devLink: devLink(token) } : dto,
    201
  )
})
