import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, parseBody, HttpError, requireAuth, logActivity, notify } from '@/lib/api-helpers'
import { buildSessionUser } from '@/app/api/auth/_lib/session'

export const runtime = 'nodejs'

/**
 * NOTE: validation.ts has no accept-invitation schema yet; local zod schema
 * validated via parseBody. Suggested follow-up: move into validation.ts.
 */
const acceptSchema = z.object({
  token: z.string().min(10),
})

/**
 * POST /api/invitations/accept — requires auth.
 * - unknown token / not PENDING / expired → 410 GONE
 * - invitation email ≠ session user email (case-insensitive) → 403
 * - success: creates the WorkspaceMember, marks ACCEPTED, audits + notifies
 *   the inviter, returns the full SessionUser (the new membership is the most
 *   recent, so the joined workspace becomes the current one).
 */
export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth()
  const { token } = await parseBody(req, acceptSchema)

  const invitation = await db.workspaceInvitation.findUnique({
    where: { token },
    include: { workspace: { select: { id: true, name: true } } },
  })

  if (!invitation || invitation.status !== 'PENDING' || invitation.expiresAt.getTime() < Date.now()) {
    throw new HttpError(410, 'This invitation is no longer valid.', 'INVITATION_GONE')
  }

  if (invitation.email.trim().toLowerCase() !== auth.user.email.trim().toLowerCase()) {
    throw new HttpError(403, 'This invitation was sent to a different email address.', 'INVITATION_EMAIL_MISMATCH')
  }

  // Idempotent: if the user already has a membership (double accept / race),
  // just mark the invitation accepted and return the session.
  const existingMembership = await db.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId: invitation.workspaceId, userId: auth.user.id } },
  })

  if (!existingMembership) {
    await db.workspaceMember.create({
      data: {
        workspaceId: invitation.workspaceId,
        userId: auth.user.id,
        role: invitation.role,
      },
    })

    await logActivity({
      workspaceId: invitation.workspaceId,
      actorId: auth.user.id,
      resourceType: 'MEMBER',
      resourceId: invitation.id,
      action: 'JOINED',
      metadata: { email: auth.user.email, role: invitation.role },
    })
  }

  await db.workspaceInvitation.update({
    where: { id: invitation.id },
    data: { status: 'ACCEPTED' },
  })

  await notify({
    userId: invitation.invitedById,
    workspaceId: invitation.workspaceId,
    type: 'INVITATION',
    title: `${auth.user.name} joined ${invitation.workspace.name}`,
    body: `${auth.user.email} accepted your invitation to ${invitation.workspace.name}.`,
    resourceType: 'WORKSPACE',
    resourceId: invitation.workspaceId,
  })

  const session = await buildSessionUser(auth.user.id)
  return ok(session)
})
