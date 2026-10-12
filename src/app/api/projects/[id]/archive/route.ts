import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, parseBody, requireProject, logActivity } from '@/lib/api-helpers'
import { toProjectDTO, projectCountsFor } from '../../_lib'

const archiveSchema = z.object({ archived: z.boolean() })

export const POST = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const { project, auth } = await requireProject(id, 'project.archive')
  const { archived } = await parseBody(req, archiveSchema)

  const updated = await db.project.update({
    where: { id: project.id },
    data: archived
      ? { archivedAt: new Date(), status: 'ARCHIVED' }
      : { archivedAt: null, status: 'ACTIVE' },
  })

  await logActivity({
    workspaceId: project.workspaceId,
    actorId: auth.user.id,
    resourceType: 'PROJECT',
    resourceId: project.id,
    action: archived ? 'ARCHIVED' : 'RESTORED',
    metadata: { name: project.name },
  })

  const [owner, counts] = await Promise.all([
    db.user.findUnique({ where: { id: updated.ownerId }, select: { name: true } }),
    projectCountsFor([updated.id]),
  ])
  return ok(toProjectDTO(updated, owner?.name ?? 'Unknown', counts.get(updated.id) ?? { taskCount: 0, completedCount: 0, memberCount: 0 }))
})
