import { db } from '@/lib/db'
import { handler, ok, HttpError, parseBody, requireProject, logActivity } from '@/lib/api-helpers'
import { projectUpdateSchema } from '@/lib/validation'
import { toProjectDTO, projectCountsFor, milestoneCountsFor, toMilestoneDTO, toProjectMemberDTO, PROJECT_MEMBER_INCLUDE } from '../_lib'

export const GET = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  const { project } = await requireProject(id)

  const [owner, counts, members, milestones] = await Promise.all([
    db.user.findUnique({ where: { id: project.ownerId }, select: { name: true } }),
    projectCountsFor([project.id]),
    db.projectMember.findMany({ where: { projectId: id }, include: PROJECT_MEMBER_INCLUDE, orderBy: { createdAt: 'asc' } }),
    db.milestone.findMany({ where: { projectId: id }, orderBy: { dueDate: 'asc' } }),
  ])

  const mCounts = await milestoneCountsFor(milestones.map((m) => m.id))

  return ok({
    project: toProjectDTO(project, owner?.name ?? 'Unknown', counts.get(project.id) ?? { taskCount: 0, completedCount: 0, memberCount: 0 }),
    members: members.map(toProjectMemberDTO),
    milestones: milestones.map((m) => toMilestoneDTO(m, mCounts.get(m.id) ?? { taskCount: 0, completedCount: 0 })),
  })
})

export const PATCH = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const { project, auth } = await requireProject(id, 'project.edit')
  const data = await parseBody(req, projectUpdateSchema)

  // Duplicate name within the same workspace → 409
  if (data.name !== undefined && data.name !== project.name) {
    const dup = await db.project.findFirst({
      where: { workspaceId: project.workspaceId, name: data.name, id: { not: project.id } },
      select: { id: true },
    })
    if (dup) throw new HttpError(409, 'A project with this name already exists in the workspace.', 'DUPLICATE_NAME')
  }

  const before = { ...project }
  const updated = await db.project.update({
    where: { id: project.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.icon !== undefined ? { icon: data.icon } : {}),
      ...(data.status !== undefined ? { status: data.status } : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      ...(data.visibility !== undefined ? { visibility: data.visibility } : {}),
    },
  })

  // Keep archivedAt consistent if a client ever sends ARCHIVED/leaves ARCHIVED via PATCH
  if (data.status !== undefined) {
    if (data.status === 'ARCHIVED' && !before.archivedAt) {
      await db.project.update({ where: { id: project.id }, data: { archivedAt: new Date() } })
    } else if (data.status !== 'ARCHIVED' && before.archivedAt) {
      await db.project.update({ where: { id: project.id }, data: { archivedAt: null } })
    }
  }

  const changed: string[] = []
  if (data.name !== undefined && data.name !== before.name) changed.push('name')
  if (data.description !== undefined && (data.description || null) !== before.description) changed.push('description')
  if (data.color !== undefined && data.color !== before.color) changed.push('color')
  if (data.icon !== undefined && data.icon !== before.icon) changed.push('icon')
  if (data.status !== undefined && data.status !== before.status) changed.push('status')
  if (data.priority !== undefined && data.priority !== before.priority) changed.push('priority')
  if (data.startDate !== undefined && !!data.startDate !== !!before.startDate) changed.push('startDate')
  if (data.dueDate !== undefined && !!data.dueDate !== !!before.dueDate) changed.push('dueDate')
  if (data.visibility !== undefined && data.visibility !== before.visibility) changed.push('visibility')

  if (changed.length > 0) {
    await logActivity({
      workspaceId: project.workspaceId,
      actorId: auth.user.id,
      resourceType: 'PROJECT',
      resourceId: project.id,
      action: 'UPDATED',
      metadata: { name: updated.name, fields: changed },
    })
  }

  const [owner, counts] = await Promise.all([
    db.user.findUnique({ where: { id: updated.ownerId }, select: { name: true } }),
    projectCountsFor([updated.id]),
  ])
  return ok(toProjectDTO(updated, owner?.name ?? 'Unknown', counts.get(updated.id) ?? { taskCount: 0, completedCount: 0, memberCount: 0 }))
})

export const DELETE = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  const { project, auth } = await requireProject(id, 'project.delete')

  // Audit BEFORE cascade deletion (project + tasks are gone afterwards)
  await logActivity({
    workspaceId: project.workspaceId,
    actorId: auth.user.id,
    resourceType: 'PROJECT',
    resourceId: null,
    action: 'DELETED',
    metadata: { name: project.name },
  })

  await db.project.delete({ where: { id: project.id } })
  return ok({ ok: true })
})
