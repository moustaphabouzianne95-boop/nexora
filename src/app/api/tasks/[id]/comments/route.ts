import { db } from '@/lib/db'
import { handler, ok, parseBody, requireTask, logActivity } from '@/lib/api-helpers'
import { commentCreateSchema } from '@/lib/validation'
import { toCommentDTO } from '../../_lib'

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/comments — cap task.comment (VIEWER excluded server-side)
// ---------------------------------------------------------------------------
export const POST = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const { task, auth } = await requireTask(id, 'task.comment')
  const data = await parseBody(req, commentCreateSchema)

  // Plain text only — the client renders it escaped (never trust HTML here)
  const comment = await db.comment.create({
    data: { taskId: task.id, authorId: auth.user.id, body: data.body },
    include: { author: { select: { id: true, name: true, avatarColor: true } } },
  })

  await logActivity({
    workspaceId: task.workspaceId,
    actorId: auth.user.id,
    resourceType: 'TASK',
    resourceId: task.id,
    action: 'COMMENTED',
    metadata: { title: task.title, taskId: task.id },
  })

  return ok(toCommentDTO(comment), 201)
})
