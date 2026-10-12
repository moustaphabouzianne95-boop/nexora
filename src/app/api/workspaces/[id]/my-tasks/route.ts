import { db } from '@/lib/db'
import { handler, ok, requireWorkspace } from '@/lib/api-helpers'
import { OPEN_STATUSES } from '@/lib/constants'
import { TASK_INCLUDE, toTaskDTO } from '../../../tasks/_lib'

// ---------------------------------------------------------------------------
// GET /api/workspaces/:id/my-tasks — tasks assigned to me in this workspace.
// Open tasks first (dueDate asc, no-due-date last), then the 10 most recent
// DONE tasks. The client groups sections from the returned order.
// ---------------------------------------------------------------------------
export const GET = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  const { auth } = await requireWorkspace(id)

  const [open, done] = await Promise.all([
    db.task.findMany({
      where: { workspaceId: id, assigneeId: auth.user.id, status: { in: OPEN_STATUSES } },
      include: TASK_INCLUDE,
      orderBy: [{ dueDate: 'asc' }, { position: 'asc' }, { createdAt: 'asc' }],
    }),
    db.task.findMany({
      where: { workspaceId: id, assigneeId: auth.user.id, status: 'DONE' },
      include: TASK_INCLUDE,
      orderBy: { completedAt: 'desc' },
      take: 10,
    }),
  ])

  // SQLite orders NULLs first on ASC — push undated tasks to the end of the open section
  const openSorted = [...open.filter((t) => t.dueDate), ...open.filter((t) => !t.dueDate)]

  return ok({ tasks: [...openSorted, ...done].map(toTaskDTO) })
})
