import { handler, ok, requireAuth } from '@/lib/api-helpers'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/** POST /api/notifications/read-all — marks every unread notification of the session user as read. */
export const POST = handler(async () => {
  const auth = await requireAuth()
  await db.notification.updateMany({
    where: { userId: auth.user.id, read: false },
    data: { read: true },
  })
  return ok({ ok: true })
})
