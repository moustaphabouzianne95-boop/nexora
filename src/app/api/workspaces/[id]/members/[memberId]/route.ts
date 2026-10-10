import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, parseBody, HttpError, requireWorkspace, logActivity, notify } from '@/lib/api-helpers'
import { canChangeRole } from '@/lib/permissions'
import { roleChangeSchema } from '@/lib/validation'
import { ROLE_LABEL } from '@/lib/constants'
import { memberTaskStats, toMemberDTO, canViewMemberEmails } from '@/app/api/workspaces/_lib/helpers'
import type { Role } from '@/types'

export const runtime = 'nodejs'

/** Load a member record and verify it belongs to the given workspace (404 otherwise — no cross-tenant leak). */
async function requireMember(workspaceId: string, memberId: string) {
  const member = await db.workspaceMember.findUnique({
    where: { id: memberId },
    include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } },
  })
  if (!member || member.workspaceId !== workspaceId) {
    throw new HttpError(404, 'Member not found.', 'NOT_FOUND')
  }
  return member
}

/** PATCH /api/workspaces/:id/members/:memberId — role change (cap member.role_change + canChangeRole). */
export const PATCH = handler(async (req: NextRequest, ctx) => {
  const { id, memberId } = await ctx.params
  const { auth, role: actorRole, workspace } = await requireWorkspace(id, 'member.role_change')
  const { role: newRole } = await parseBody(req, roleChangeSchema)

  const member = await requireMember(id, memberId)
  const targetRole = member.role as Role

  if (!canChangeRole(actorRole, targetRole, newRole)) {
    throw new HttpError(403, 'This role change is not allowed.', 'FORBIDDEN_ROLE_CHANGE')
  }

  await db.workspaceMember.update({ where: { id: member.id }, data: { role: newRole } })

  await logActivity({
    workspaceId: id,
    actorId: auth.user.id,
    resourceType: 'MEMBER',
    resourceId: member.id,
    action: 'ROLE_CHANGED',
    metadata: { userId: member.userId, name: member.user.name, from: targetRole, to: newRole },
  })

  await notify({
    userId: member.userId,
    workspaceId: id,
    type: 'SYSTEM',
    title: `Your role in ${workspace.name} is now ${ROLE_LABEL[newRole]}`,
    body: `${auth.user.name} changed your role from ${ROLE_LABEL[targetRole]} to ${ROLE_LABEL[newRole]}.`,
    resourceType: 'WORKSPACE',
    resourceId: id,
  })

  const stats = await memberTaskStats(id, [member.userId])
  const dto = toMemberDTO(member, stats.get(member.userId) ?? {
    assignedTasks: 0,
    openTasks: 0,
    completedTasks: 0,
    overdueTasks: 0,
  }, canViewMemberEmails(actorRole))
  return ok(dto)
})

/** DELETE /api/workspaces/:id/members/:memberId — cap member.remove; OWNER unremovable; cannot remove self. */
export const DELETE = handler(async (_req: NextRequest, ctx) => {
  const { id, memberId } = await ctx.params
  const { auth, workspace } = await requireWorkspace(id, 'member.remove')

  const member = await requireMember(id, memberId)

  if (member.role === 'OWNER') {
    throw new HttpError(403, 'The workspace owner cannot be removed. Transfer ownership first.', 'FORBIDDEN')
  }
  if (member.userId === auth.user.id) {
    throw new HttpError(403, 'You cannot remove yourself from the workspace.', 'FORBIDDEN')
  }

  await db.workspaceMember.delete({ where: { id: member.id } })

  await logActivity({
    workspaceId: id,
    actorId: auth.user.id,
    resourceType: 'MEMBER',
    resourceId: member.id,
    action: 'MEMBER_REMOVED',
    metadata: { userId: member.userId, name: member.user.name, role: member.role },
  })

  await notify({
    userId: member.userId,
    type: 'SYSTEM',
    title: `You were removed from ${workspace.name}`,
    body: `${auth.user.name} removed you from the workspace.`,
  })

  return ok({ ok: true })
})
