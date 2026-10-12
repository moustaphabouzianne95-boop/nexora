import { db } from '@/lib/db'
import { handler, ok, HttpError, parseBody, requireWorkspace, logActivity } from '@/lib/api-helpers'
import { milestoneCreateSchema } from '@/lib/validation'
import { toMilestoneDTO, milestoneCountsFor } from '../../projects/_lib'

const milestoneUpdateSchema = milestoneCreateSchema.partial()

async function loadMilestone(id: string) {
  const milestone = await db.milestone.findUnique({ where: { id } })
  if (!milestone) throw new HttpError(404, 'Milestone not found.', 'NOT_FOUND')
  return milestone
}

// ---------------------------------------------------------------------------
// PATCH /api/milestones/:id — cap milestone.manage
// ---------------------------------------------------------------------------
export const PATCH = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const milestone = await loadMilestone(id)
  const project = await db.project.findUnique({ where: { id: milestone.projectId }, select: { workspaceId: true, name: true } })
  if (!project) throw new HttpError(404, 'Milestone not found.', 'NOT_FOUND')
  const { auth } = await requireWorkspace(project.workspaceId, 'milestone.manage')
  const data = await parseBody(req, milestoneUpdateSchema)

  const updated = await db.milestone.update({
    where: { id: milestone.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
    },
  })

  await logActivity({
    workspaceId: project.workspaceId,
    actorId: auth.user.id,
    resourceType: 'MILESTONE',
    resourceId: updated.id,
    action: 'UPDATED',
    metadata: { name: updated.name, projectName: project.name, fields: Object.keys(data) },
  })

  const counts = await milestoneCountsFor([updated.id])
  return ok(toMilestoneDTO(updated, counts.get(updated.id) ?? { taskCount: 0, completedCount: 0 }))
})

// ---------------------------------------------------------------------------
// DELETE /api/milestones/:id — cap milestone.manage; tasks keep existing
// (their milestoneId is set to NULL via the schema's SetNull behaviour)
// ---------------------------------------------------------------------------
export const DELETE = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  const milestone = await loadMilestone(id)
  const project = await db.project.findUnique({ where: { id: milestone.projectId }, select: { workspaceId: true, name: true } })
  if (!project) throw new HttpError(404, 'Milestone not found.', 'NOT_FOUND')
  const { auth } = await requireWorkspace(project.workspaceId, 'milestone.manage')

  await db.milestone.delete({ where: { id: milestone.id } })

  await logActivity({
    workspaceId: project.workspaceId,
    actorId: auth.user.id,
    resourceType: 'MILESTONE',
    resourceId: null,
    action: 'DELETED',
    metadata: { name: milestone.name, projectName: project.name },
  })

  return ok({ ok: true })
})
