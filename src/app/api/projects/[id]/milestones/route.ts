import { db } from '@/lib/db'
import { handler, ok, parseBody, requireProject, logActivity } from '@/lib/api-helpers'
import { milestoneCreateSchema } from '@/lib/validation'
import { toMilestoneDTO, milestoneCountsFor } from '../../_lib'

// ---------------------------------------------------------------------------
// GET /api/projects/:id/milestones — workspace member (also embedded in GET /api/projects/:id)
// ---------------------------------------------------------------------------
export const GET = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  await requireProject(id)
  const milestones = await db.milestone.findMany({ where: { projectId: id }, orderBy: [{ dueDate: 'asc' }, { createdAt: 'asc' }] })
  const counts = await milestoneCountsFor(milestones.map((m) => m.id))
  return ok({ milestones: milestones.map((m) => toMilestoneDTO(m, counts.get(m.id) ?? { taskCount: 0, completedCount: 0 })) })
})

// ---------------------------------------------------------------------------
// POST /api/projects/:id/milestones — cap milestone.manage
// ---------------------------------------------------------------------------
export const POST = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const { project, auth } = await requireProject(id, 'milestone.manage')
  const data = await parseBody(req, milestoneCreateSchema)

  const milestone = await db.milestone.create({
    data: {
      projectId: id,
      name: data.name,
      description: data.description || null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      status: data.status,
    },
  })

  await logActivity({
    workspaceId: project.workspaceId,
    actorId: auth.user.id,
    resourceType: 'MILESTONE',
    resourceId: milestone.id,
    action: 'CREATED',
    metadata: { name: milestone.name, projectName: project.name },
  })

  return ok(toMilestoneDTO(milestone, { taskCount: 0, completedCount: 0 }), 201)
})
