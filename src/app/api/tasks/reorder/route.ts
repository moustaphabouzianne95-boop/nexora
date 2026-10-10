import { db } from '@/lib/db'
import { handler, ok, HttpError, parseBody, requireTask, logActivity } from '@/lib/api-helpers'
import { reorderSchema } from '@/lib/validation'
import { canEditTask } from '@/lib/permissions'
import { completedAtForStatus } from '../_lib'

// ---------------------------------------------------------------------------
// POST /api/tasks/reorder — Kanban DnD persistence. The client computes the
// position between neighbours (optimistic apply + rollback is client-side);
// this endpoint only persists status + position atomically.
// ---------------------------------------------------------------------------
export const POST = handler(async (req) => {
  const data = await parseBody(req, reorderSchema)
  const { task, auth, role } = await requireTask(data.taskId)

  if (!canEditTask(role, { creatorId: task.creatorId, assigneeId: task.assigneeId }, auth.user.id)) {
    throw new HttpError(403, 'You can only move tasks you created or are assigned to.', 'FORBIDDEN_TASK_EDIT')
  }

  const statusChanged = task.status !== data.status

  await db.$transaction(async (tx) => {
    await tx.task.update({
      where: { id: task.id },
      data: {
        status: data.status,
        position: data.position,
        completedAt: completedAtForStatus(data.status, task.completedAt),
      },
    })
  })

  if (statusChanged) {
    await logActivity({
      workspaceId: task.workspaceId,
      actorId: auth.user.id,
      resourceType: 'TASK',
      resourceId: task.id,
      action: 'STATUS_CHANGED',
      metadata: { title: task.title, from: task.status, to: data.status },
    })
  }

  return ok({ ok: true })
})
