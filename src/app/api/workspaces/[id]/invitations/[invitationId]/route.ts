import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, HttpError, requireWorkspace, logActivity } from '@/lib/api-helpers'

export const runtime = 'nodejs'

/** DELETE /api/workspaces/:id/invitations/:invitationId — revoke (cap member.invite). Idempotent. */
export const DELETE = handler(async (_req: NextRequest, ctx) => {
  const { id, invitationId } = await ctx.params
  const { auth } = await requireWorkspace(id, 'member.invite')

  const invitation = await db.workspaceInvitation.findUnique({ where: { id: invitationId } })
  if (!invitation || invitation.workspaceId !== id) {
    throw new HttpError(404, 'Invitation not found.', 'NOT_FOUND')
  }

  if (invitation.status !== 'REVOKED') {
    await db.workspaceInvitation.update({
      where: { id: invitation.id },
      data: { status: 'REVOKED' },
    })

    await logActivity({
      workspaceId: id,
      actorId: auth.user.id,
      resourceType: 'MEMBER',
      resourceId: invitation.id,
      action: 'INVITATION_REVOKED',
      metadata: { email: invitation.email, role: invitation.role },
    })
  }

  return ok({ ok: true })
})
