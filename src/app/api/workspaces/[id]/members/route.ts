import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, requireWorkspace } from '@/lib/api-helpers'
import { memberTaskStats, toMemberDTO, canViewMemberEmails } from '@/app/api/workspaces/_lib/helpers'

export const runtime = 'nodejs'

/**
 * GET /api/workspaces/:id/members — member-visible list with task stats.
 * Emails are included only when the caller's role has the
 * member.view_details capability (otherwise empty string).
 */
export const GET = handler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params
  const { role } = await requireWorkspace(id)

  const members = await db.workspaceMember.findMany({
    where: { workspaceId: id },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    include: {
      user: { select: { id: true, name: true, email: true, avatarColor: true } },
    },
  })

  const stats = await memberTaskStats(id, members.map((m) => m.userId))
  const emailVisible = canViewMemberEmails(role)

  return ok({
    members: members.map((m) => toMemberDTO(m, stats.get(m.userId) ?? {
      assignedTasks: 0,
      openTasks: 0,
      completedTasks: 0,
      overdueTasks: 0,
    }, emailVisible)),
  })
})
