import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, parseBody, logActivity } from '@/lib/api-helpers'
import { requireWorkspaceAllowArchived } from '@/app/api/workspaces/_lib/helpers'

export const runtime = 'nodejs'

/**
 * NOTE: validation.ts has no archive-body schema yet; local zod schema
 * validated via parseBody. Suggested follow-up: move into validation.ts.
 */
const archiveSchema = z.object({
  archived: z.boolean(),
})

/**
 * POST /api/workspaces/:id/archive — cap workspace.archive. Toggle:
 * body {archived:true} sets archivedAt, {archived:false} clears it.
 * Uses the archived-tolerant guard because unarchiving an archived
 * workspace would otherwise be rejected by requireWorkspace().
 */
export const POST = handler(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params
  const { auth } = await requireWorkspaceAllowArchived(id, 'workspace.archive')
  const { archived } = await parseBody(req, archiveSchema)

  await db.workspace.update({
    where: { id },
    data: { archivedAt: archived ? new Date() : null },
  })

  await logActivity({
    workspaceId: id,
    actorId: auth.user.id,
    resourceType: 'WORKSPACE',
    resourceId: id,
    action: archived ? 'ARCHIVED' : 'RESTORED',
  })

  return ok({ ok: true })
})
