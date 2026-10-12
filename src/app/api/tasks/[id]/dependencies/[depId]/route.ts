import { db } from '@/lib/db'
import { handler, ok, HttpError, requireTask } from '@/lib/api-helpers'
import { canEditTask } from '@/lib/permissions'

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id/dependencies/:depId — removes the dependency edge
// (allowed regardless of plan so FREE workspaces can clean up stale data).
// ---------------------------------------------------------------------------
export const DELETE = handler(async (_req, ctx) => {
  const { id, depId } = await ctx.params
  const { task, auth, role } = await requireTask(id)

  const dependency = await db.taskDependency.findUnique({ where: { id: depId } })
  if (!dependency || (dependency.blockerTaskId !== task.id && dependency.blockedTaskId !== task.id)) {
    throw new HttpError(404, 'Dependency not found.', 'NOT_FOUND')
  }

  if (!canEditTask(role, { creatorId: task.creatorId, assigneeId: task.assigneeId }, auth.user.id)) {
    throw new HttpError(403, 'You do not have permission to modify dependencies of this task.', 'FORBIDDEN_TASK_EDIT')
  }

  await db.taskDependency.delete({ where: { id: dependency.id } })
  return ok({ ok: true })
})
