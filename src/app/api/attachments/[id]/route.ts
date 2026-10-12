import { db } from '@/lib/db'
import { handler, ok, HttpError, requireTask } from '@/lib/api-helpers'
import { can } from '@/lib/permissions'

// ---------------------------------------------------------------------------
// DELETE /api/attachments/:id — uploader or cap task.edit_any
// ---------------------------------------------------------------------------
export const DELETE = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  const attachment = await db.attachment.findUnique({
    where: { id },
    select: { id: true, uploaderId: true, taskId: true },
  })
  if (!attachment) throw new HttpError(404, 'Attachment not found.', 'NOT_FOUND')

  const { auth, role } = await requireTask(attachment.taskId)

  const isUploader = attachment.uploaderId === auth.user.id
  if (!isUploader && !can(role, 'task.edit_any')) {
    throw new HttpError(403, 'Only the uploader or a project manager can remove this attachment.', 'FORBIDDEN_ATTACHMENT_DELETE')
  }

  await db.attachment.delete({ where: { id: attachment.id } })
  return ok({ ok: true })
})
