import { db } from '@/lib/db'
import { handler, ok, HttpError, parseBody, requireTask } from '@/lib/api-helpers'
import { attachmentCreateSchema } from '@/lib/validation'
import { assertFeature } from '@/lib/entitlements'
import { MAX_ATTACHMENT_BYTES } from '@/lib/constants'
import { toAttachmentDTO } from '../../_lib'

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/attachments — base64 upload stored in DB (test-mode
// storage). Plan-gated (402) + size/type limited (422).
// ---------------------------------------------------------------------------
export const POST = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const { task, auth } = await requireTask(id, 'task.attach')

  // FREE workspaces have no attachment feature → 402 with upgrade message
  await assertFeature(task.workspaceId, 'attachments')

  const data = await parseBody(req, attachmentCreateSchema)

  const buffer = Buffer.from(data.data, 'base64')
  if (buffer.length === 0) {
    throw new HttpError(422, 'The file content is empty or not valid base64.', 'VALIDATION', {
      data: 'Invalid file content',
    })
  }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    throw new HttpError(
      422,
      `Attachments are limited to ${Math.floor(MAX_ATTACHMENT_BYTES / (1024 * 1024))}MB. Please choose a smaller file.`,
      'VALIDATION',
      { size: `File exceeds the ${MAX_ATTACHMENT_BYTES} byte limit` }
    )
  }

  const attachment = await db.attachment.create({
    data: {
      taskId: task.id,
      uploaderId: auth.user.id,
      filename: data.filename,
      mimeType: data.mimeType,
      size: buffer.length, // server-side truth, never the client-claimed size
      data: data.data,
    },
    include: { uploader: { select: { id: true, name: true, avatarColor: true } } },
  })

  return ok(toAttachmentDTO(attachment), 201)
})
