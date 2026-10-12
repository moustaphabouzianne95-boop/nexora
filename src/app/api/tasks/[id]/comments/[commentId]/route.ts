import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, HttpError, parseBody, requireTask } from '@/lib/api-helpers'
import { can } from '@/lib/permissions'
import { commentCreateSchema } from '@/lib/validation'
import { toCommentDTO } from '../../../_lib'

const commentUpdateSchema = commentCreateSchema // { body } — same shape on edit

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id/comments/:commentId — author only
// ---------------------------------------------------------------------------
export const PATCH = handler(async (req, ctx) => {
  const { id, commentId } = await ctx.params
  const { auth } = await requireTask(id)
  const data = await parseBody(req, commentUpdateSchema)

  const comment = await db.comment.findUnique({ where: { id: commentId } })
  if (!comment || comment.taskId !== id) throw new HttpError(404, 'Comment not found.', 'NOT_FOUND')
  if (comment.authorId !== auth.user.id) {
    throw new HttpError(403, 'You can only edit your own comments.', 'FORBIDDEN_COMMENT_EDIT')
  }

  const updated = await db.comment.update({
    where: { id: comment.id },
    data: { body: data.body },
    include: { author: { select: { id: true, name: true, avatarColor: true } } },
  })
  return ok(toCommentDTO(updated))
})

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id/comments/:commentId — author or cap task.edit_any
// ---------------------------------------------------------------------------
export const DELETE = handler(async (_req, ctx) => {
  const { id, commentId } = await ctx.params
  const { auth, role } = await requireTask(id)

  const comment = await db.comment.findUnique({ where: { id: commentId } })
  if (!comment || comment.taskId !== id) throw new HttpError(404, 'Comment not found.', 'NOT_FOUND')

  const isAuthor = comment.authorId === auth.user.id
  if (!isAuthor && !can(role, 'task.edit_any')) {
    throw new HttpError(403, 'You can only delete your own comments.', 'FORBIDDEN_COMMENT_DELETE')
  }

  await db.comment.delete({ where: { id: comment.id } })
  return ok({ ok: true })
})
