import { db } from '@/lib/db'
import { handler, ok, HttpError, parseQuery, requireWorkspace } from '@/lib/api-helpers'
import { analyticsQuerySchema } from '@/lib/validation'
import { OPEN_STATUSES, TASK_STATUSES, PRIORITIES } from '@/lib/constants'
import { getEntitlements } from '@/lib/entitlements'
import { activeProjectStatuses } from '@/lib/permissions'
import { parseDateParam } from '../../../tasks/_lib'
import type { AnalyticsReport, Priority, TaskStatus, TimeseriesPoint } from '@/types'

const DAY_MS = 24 * 60 * 60 * 1000

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function startOfDayUTC(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

function endOfDayUTC(d: Date): Date {
  const start = startOfDayUTC(d)
  return new Date(start.getTime() + DAY_MS - 1)
}

// ---------------------------------------------------------------------------
// GET /api/workspaces/:id/analytics — AnalyticsReport (cap analytics.view_workspace;
// memberAnalytics only when the plan has advancedAnalytics)
// ---------------------------------------------------------------------------
export const GET = handler(async (req, ctx) => {
  const { id } = await ctx.params
  await requireWorkspace(id, 'analytics.view_workspace')
  const query = parseQuery(req, analyticsQuerySchema)

  // ---- resolve range ----------------------------------------------------------
  const now = new Date()
  let from: Date
  let to: Date
  if (query.range === 'custom') {
    const rawFrom = query.from ? parseDateParam(query.from) : null
    const rawTo = query.to ? parseDateParam(query.to) : null
    if (!rawFrom || !rawTo) {
      throw new HttpError(422, 'Invalid date range.', 'VALIDATION', { from: 'from/to must be valid ISO dates' })
    }
    from = startOfDayUTC(rawFrom)
    to = endOfDayUTC(rawTo)
    if (to.getTime() <= from.getTime()) {
      throw new HttpError(422, 'Invalid date range.', 'VALIDATION', { to: 'to must be after from' })
    }
    if (to.getTime() - from.getTime() > 370 * DAY_MS) {
      throw new HttpError(422, 'Custom range cannot exceed 370 days.', 'VALIDATION', { to: 'Range too large' })
    }
  } else {
    const days = query.range === '7d' ? 7 : query.range === '30d' ? 30 : 90
    from = startOfDayUTC(new Date(now.getTime() - (days - 1) * DAY_MS))
    to = endOfDayUTC(now)
  }

  // ---- load real data -----------------------------------------------------------
  const [tasks, members, projects, entitlements] = await Promise.all([
    db.task.findMany({
      where: { workspaceId: id },
      select: {
        id: true, status: true, priority: true, assigneeId: true, projectId: true,
        createdAt: true, completedAt: true, dueDate: true,
      },
    }),
    db.workspaceMember.findMany({
      where: { workspaceId: id },
      include: { user: { select: { id: true, name: true, avatarColor: true } } },
    }),
    db.project.findMany({
      where: { workspaceId: id, archivedAt: null, status: { in: [...activeProjectStatuses(), 'COMPLETED'] } },
      select: { id: true, name: true, color: true },
    }),
    getEntitlements(id),
  ])

  // ---- timeseries (daily buckets, zero-filled) ------------------------------------
  const fromMs = from.getTime()
  const toMs = to.getTime()
  const bucketCount = Math.floor((endOfDayUTC(to).getTime() - fromMs) / DAY_MS) + 1
  const series: TimeseriesPoint[] = []
  for (let i = 0; i < bucketCount; i++) {
    series.push({ date: dayKey(new Date(fromMs + i * DAY_MS)), created: 0, completed: 0 })
  }
  for (const t of tasks) {
    const createdIdx = Math.floor((startOfDayUTC(t.createdAt).getTime() - fromMs) / DAY_MS)
    if (createdIdx >= 0 && createdIdx < bucketCount) series[createdIdx].created++
    if (t.completedAt) {
      const doneIdx = Math.floor((startOfDayUTC(t.completedAt).getTime() - fromMs) / DAY_MS)
      if (doneIdx >= 0 && doneIdx < bucketCount) series[doneIdx].completed++
    }
  }

  // ---- counts ----------------------------------------------------------------------
  const inRangeCompleted = tasks.filter(
    (t) => t.completedAt && t.completedAt.getTime() >= fromMs && t.completedAt.getTime() <= toMs
  )
  const openTasks = tasks.filter((t) => OPEN_STATUSES.includes(t.status as TaskStatus))
  const doneTasks = tasks.filter((t) => t.status === 'DONE')
  const overdueTasks = openTasks.filter((t) => t.dueDate && t.dueDate.getTime() < now.getTime())

  const byStatus = TASK_STATUSES.map((status) => ({
    status: status as TaskStatus,
    count: tasks.filter((t) => t.status === status).length,
  }))
  const byPriority = PRIORITIES.map((priority) => ({
    priority: priority as Priority,
    count: tasks.filter((t) => t.priority === priority).length,
  }))

  // ---- per-member stats ---------------------------------------------------------------
  const memberAnalyticsBase = members.map((m) => ({
    userId: m.user.id,
    name: m.user.name,
    avatarColor: m.user.avatarColor,
    assigned: openTasks.filter((t) => t.assigneeId === m.user.id).length,
    completed: inRangeCompleted.filter((t) => t.assigneeId === m.user.id).length,
    overdue: overdueTasks.filter((t) => t.assigneeId === m.user.id).length,
  }))

  const workloadByMember = memberAnalyticsBase
    .map((m) => ({ userId: m.userId, name: m.name, avatarColor: m.avatarColor, open: m.assigned, completed: m.completed }))
    .filter((m) => m.open > 0 || m.completed > 0)
    .sort((a, b) => b.open + b.completed - (a.open + a.completed))
    .slice(0, 12)

  // ---- project progress (top 10 by volume) ----------------------------------------------
  const projectProgress = projects
    .map((p) => {
      const ptasks = tasks.filter((t) => t.projectId === p.id)
      const completed = ptasks.filter((t) => t.status === 'DONE').length
      return {
        id: p.id,
        name: p.name,
        color: p.color,
        progress: ptasks.length > 0 ? Math.round((completed / ptasks.length) * 100) : 0,
        total: ptasks.length,
        completed,
      }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // ---- KPIs --------------------------------------------------------------------------------
  const completionDenominator = doneTasks.length + openTasks.length
  const completionRate = completionDenominator > 0 ? Math.round((doneTasks.length / completionDenominator) * 100) : 0
  const overdueRate = tasks.length > 0 ? Math.round((overdueTasks.length / tasks.length) * 100) : 0

  const avgCompletionHours =
    inRangeCompleted.length > 0
      ? Math.round(
          (inRangeCompleted.reduce((sum, t) => sum + (t.completedAt!.getTime() - t.createdAt.getTime()), 0) /
            inRangeCompleted.length /
            3600000) *
            10
        ) / 10
      : null

  const withDueDate = inRangeCompleted.filter((t) => t.dueDate)
  const onTime = withDueDate.filter((t) => t.completedAt!.getTime() <= t.dueDate!.getTime())
  const onTimeRate = withDueDate.length > 0 ? Math.round((onTime.length / withDueDate.length) * 100) : null

  const report: AnalyticsReport = {
    range: query.range,
    tasksCreatedOverTime: series,
    tasksCompletedOverTime: series,
    byStatus,
    byPriority,
    workloadByMember,
    projectProgress,
    completionRate,
    overdueRate,
    avgCompletionHours,
    onTimeRate,
    memberAnalytics: entitlements.advancedAnalytics ? memberAnalyticsBase : [],
  }

  return ok(report)
})
