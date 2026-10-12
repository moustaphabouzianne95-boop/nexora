import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, HttpError, parseQuery, requireWorkspace } from '@/lib/api-helpers'
import { TASK_STATUSES } from '@/lib/constants'
import { TASK_INCLUDE, toTaskDTO, parseDateParam } from '../../../tasks/_lib'

const calendarQuerySchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  assignee: z.string().optional(),
  status: z.enum(TASK_STATUSES).optional(),
})

// ---------------------------------------------------------------------------
// GET /api/workspaces/:id/calendar — tasks + milestones due in the range.
// Defaults to the current calendar month when from/to are omitted.
// ---------------------------------------------------------------------------
export const GET = handler(async (req, ctx) => {
  const { id } = await ctx.params
  await requireWorkspace(id)
  const query = parseQuery(req, calendarQuerySchema)

  const now = new Date()
  const defaultFrom = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  const defaultTo = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1))

  const from = query.from ? parseDateParam(query.from) : defaultFrom
  const to = query.to ? parseDateParam(query.to) : defaultTo
  if (!from || !to) {
    throw new HttpError(422, 'Invalid date range.', 'VALIDATION', { from: 'from/to must be valid ISO dates' })
  }
  if (to.getTime() <= from.getTime()) {
    throw new HttpError(422, 'Invalid date range.', 'VALIDATION', { to: 'to must be after from' })
  }

  const [tasks, milestones] = await Promise.all([
    db.task.findMany({
      where: {
        workspaceId: id,
        dueDate: { gte: from, lt: to },
        ...(query.assignee === 'none' ? { assigneeId: null } : query.assignee ? { assigneeId: query.assignee } : {}),
        ...(query.status ? { status: query.status } : {}),
      },
      include: TASK_INCLUDE,
      orderBy: [{ dueDate: 'asc' }, { position: 'asc' }],
    }),
    db.milestone.findMany({
      where: { project: { workspaceId: id }, dueDate: { gte: from, lt: to } },
      include: { project: { select: { id: true, name: true, color: true } } },
      orderBy: { dueDate: 'asc' },
    }),
  ])

  return ok({
    tasks: tasks.map(toTaskDTO),
    milestones: milestones.map((m) => ({
      id: m.id,
      name: m.name,
      dueDate: m.dueDate!.toISOString(),
      projectId: m.project.id,
      projectName: m.project.name,
      color: m.project.color,
      status: m.status as 'OPEN' | 'COMPLETED',
    })),
  })
})
