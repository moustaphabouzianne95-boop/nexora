import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, HttpError, requireWorkspace, logActivity } from '@/lib/api-helpers'
import { invitationToken } from '@/lib/auth'
import { toInvitationDTO } from '@/app/api/workspaces/_lib/helpers'

export const runtime = 'nodejs'

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000

/**
 * POST /api/workspaces/:id/invitations/:invitationId/resend — regenerates the
 * token (invalidates previously shared links), resets status to PENDING and
 * extends expiry by 7 days. Dev mode also returns a fresh `devLink`.
 */
export const POST = handler(async (_req: NextRequest, ctx) => {
  const { id, invitationId } = await ctx.params
  const { auth } = await requireWorkspace(id, 'member.invite')

  const invitation = await db.workspaceInvitation.findUnique({ where: { id: invitationId } })
  if (!invitation || invitation.workspaceId !== id) {
    throw new HttpError(404, 'Invitation not found.', 'NOT_FOUND')
  }
  if (invitation.status === 'ACCEPTED') {
    throw new HttpError(409, 'This invitation has already been accepted.', 'INVITE_ACCEPTED')
  }

  const token = invitationToken()
  const updated = await db.workspaceInvitation.update({
    where: { id: invitation.id },
    data: {
      token,
      status: 'PENDING',
      expiresAt: new Date(Date.now() + INVITE_TTL_MS),
    },
  })

  await logActivity({
    workspaceId: id,
    actorId: auth.user.id,
    resourceType: 'MEMBER',
    resourceId: invitation.id,
    action: 'INVITATION_RESENT',
    metadata: { email: invitation.email, role: invitation.role },
  })

  const dto = toInvitationDTO(updated, auth.user.name)
  return ok(process.env.NODE_ENV !== 'production' ? { ...dto, devLink: `/?invite=${token}` } : dto)
})
