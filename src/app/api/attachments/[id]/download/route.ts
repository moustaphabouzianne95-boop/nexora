import { db } from '@/lib/db'
import { NextResponse } from 'next/server'
import { handler, HttpError, requireWorkspace } from '@/lib/api-helpers'

// ---------------------------------------------------------------------------
// GET /api/attachments/:id/download — binary response for workspace members.
// Tenancy check: membership of the workspace the parent task belongs to.
// ---------------------------------------------------------------------------
export const GET = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  const attachment = await db.attachment.findUnique({
    where: { id },
    select: {
      filename: true,
      mimeType: true,
      data: true,
      task: { select: { workspaceId: true } },
    },
  })
  if (!attachment) throw new HttpError(404, 'Attachment not found.', 'NOT_FOUND')

  // Server identity only — membership derived from the attachment's task workspace
  await requireWorkspace(attachment.task.workspaceId)

  const buffer = Buffer.from(attachment.data, 'base64')

  // Sanitize filename: strip path separators, control chars and quotes
  const safeName = attachment.filename.replace(/[/\\?%*:|"'<>\x00-\x1f]/g, '_').trim() || 'download'
  const asciiName = safeName.replace(/[^\x20-\x7e]/g, '_')

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      'Content-Type': attachment.mimeType,
      'Content-Length': String(buffer.length),
      'Content-Disposition': `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(safeName)}`,
      'Cache-Control': 'private, no-store',
    },
  })
})
