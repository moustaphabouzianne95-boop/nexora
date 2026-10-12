import { db } from '@/lib/db'
import { handler, ok, requireWorkspace } from '@/lib/api-helpers'
import { OPEN_STATUSES } from '@/lib/constants'
import { activeProjectStatuses } from '@/lib/permissions'
import { toActivityDTO, ACTOR_SELECT, startOfWeekUTC } from '../../../tasks/_lib'

// ---------------------------------------------------------------------------
// GET /api/workspaces/:id/dashboard — DashboardStats (100% real aggregates)
// ---------------------------------------------------------------------------
export const GET = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  const { auth } = await requireWorkspace(id)
  const now = new Date()

  const [
    activeProjects,
    openTasks,
    completedTasks,
    overdueTasks,
    myOpenTasks,
    completedThisWeek,
    upcoming,
    openByAssignee,
    members,
    recent,
  ] = await Promise.all([
    db.project.count({ where: { workspaceId: id, archivedAt: null, status: { in: activeProjectStatuses() } } }),
    db.task.count({ where: { workspaceId: id, status: { in: OPEN_STATUSES } } }),
    db.task.count({ where: { workspaceId: id, status: 'DONE' } }),
    db.task.count({ where: { workspaceId: id, status: { in: OPEN_STATUSES }, dueDate: { lt: now } } }),
    db.task.count({ where: { workspaceId: id, status: { in: OPEN_STATUSES }, assigneeId: auth.user.id } }),
    db.task.count({ where: { workspaceId: id, status: 'DONE', completedAt: { gte: startOfWeekUTC(now) } } }),
    db.task.findMany({
      where: { workspaceId: id, status: { in: OPEN_STATUSES }, dueDate: { gte: now } },
      orderBy: { dueDate: 'asc' },
      take: 5,
      include: { project: { select: { name: true, color: true } } },
    }),
    db.task.groupBy({
      by: ['assigneeId'],
      where: { workspaceId: id, status: { in: OPEN_STATUSES }, assigneeId: { not: null } },
      _count: { _all: true },
    }),
    db.workspaceMember.findMany({ where: { workspaceId: id }, include: { user: { select: { id: true, name: true, avatarColor: true } } } }),
    db.activityLog.findMany({
      where: { workspaceId: id },
      orderBy: { createdAt: 'desc' },
      take: 12,
      include: { actor: ACTOR_SELECT },
    }),
  ])

  const openCountByUser = new Map<string, number>()
  for (const row of openByAssignee) {
    if (row.assigneeId) openCountByUser.set(row.assigneeId, row._count._all)
  }

  // Top 8 members by open task count (zero-task members included to fill the chart)
  const workload = members
    .map((m) => ({
      userId: m.user.id,
      name: m.user.name,
      avatarColor: m.user.avatarColor,
      openTasks: openCountByUser.get(m.user.id) ?? 0,
    }))
    .sort((a, b) => b.openTasks - a.openTasks)
    .slice(0, 8)

  return ok({
    activeProjects,
    openTasks,
    completedTasks,
    overdueTasks,
    myOpenTasks,
    completedThisWeek,
    upcomingDeadlines: upcoming.map((t) => ({
      id: t.id,
      title: t.title,
      dueDate: t.dueDate!.toISOString(),
      projectName: t.project.name,
      projectColor: t.project.color,
    })),
    workload,
    recentActivity: recent.map(toActivityDTO),
  })
})
