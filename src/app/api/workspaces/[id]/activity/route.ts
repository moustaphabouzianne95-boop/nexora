import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, parseQuery, requireWorkspace } from '@/lib/api-helpers'
import type { ActivityDTO } from '@/types'

export const runtime = 'nodejs'

/**
 * NOTE: validation.ts has no activity query schema yet; local zod schema
 * validated via parseQuery. Suggested follow-up: move into validation.ts.
 */
const activityQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  cursor: z.string().min(1).optional(),
})

function parseMetadata(raw: string | null): Record<string, unknown> | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null
  } catch {
    return null
  }
}

/**
 * GET /api/workspaces/:id/activity?limit=50&cursor= — workspace-scoped feed,
 * newest first, cursor pagination (cursor = last item id of the previous page).
 */
export const GET = handler(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params
  await requireWorkspace(id)
  const { limit, cursor } = parseQuery(req, activityQuerySchema)

  const rows = await db.activityLog.findMany({
    where: { workspaceId: id, ...(cursor ? { id: { lt: cursor } } : {}) },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: limit + 1,
    include: { actor: { select: { name: true, avatarColor: true } } },
  })

  const hasMore = rows.length > limit
  const page = rows.slice(0, limit)

  const activities: ActivityDTO[] = page.map((a) => ({
    id: a.id,
    actorName: a.actor.name,
    actorColor: a.actor.avatarColor,
    resourceType: a.resourceType,
    resourceId: a.resourceId,
    action: a.action,
    metadata: parseMetadata(a.metadata),
    createdAt: a.createdAt.toISOString(),
  }))

  return ok({
    activities,
    nextCursor: hasMore && page.length > 0 ? page[page.length - 1].id : null,
  })
})
