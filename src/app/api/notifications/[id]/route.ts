import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, HttpError, requireAuth } from '@/lib/api-helpers'

export const runtime = 'nodejs'

/**
 * PATCH /api/notifications/:id — mark as read. Ownership comes from the
 * session only; foreign or unknown ids → 404 (no cross-user leak).
 */
export const PATCH = handler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params
  const auth = await requireAuth()

  const notification = await db.notification.findUnique({ where: { id }, select: { id: true, userId: true } })
  if (!notification || notification.userId !== auth.user.id) {
    throw new HttpError(404, 'Notification not found.', 'NOT_FOUND')
  }

  await db.notification.update({ where: { id: notification.id }, data: { read: true } })
  return ok({ ok: true })
})
