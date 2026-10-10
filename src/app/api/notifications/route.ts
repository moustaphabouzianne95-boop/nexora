import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, parseQuery, requireAuth } from '@/lib/api-helpers'
import type { NotificationDTO } from '@/types'

export const runtime = 'nodejs'

/**
 * NOTE: validation.ts has no notifications query schema yet; local zod
 * schema validated via parseQuery. Suggested follow-up: move into validation.ts.
 */
const notificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

/** GET /api/notifications?limit=50 — session-scoped inbox with unread count. */
export const GET = handler(async (req: NextRequest) => {
  const auth = await requireAuth()
  const { limit } = parseQuery(req, notificationsQuerySchema)

  const [rows, unread] = await Promise.all([
    db.notification.findMany({
      where: { userId: auth.user.id },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      include: { workspace: { select: { name: true } } },
    }),
    db.notification.count({ where: { userId: auth.user.id, read: false } }),
  ])

  const notifications: NotificationDTO[] = rows.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    workspaceId: n.workspaceId,
    workspaceName: n.workspace?.name ?? null,
    resourceType: n.resourceType,
    resourceId: n.resourceId,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  }))

  return ok({ notifications, unread })
})
