import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, HttpError, parseBody, parseQuery, requireWorkspace, logActivity } from '@/lib/api-helpers'
import { projectCreateSchema } from '@/lib/validation'
import { assertCanCreateProject } from '@/lib/entitlements'
import { PROJECT_STATUSES } from '@/lib/constants'
import { toProjectDTO, projectCountsFor, filterWorkspaceMemberIds } from '../../../projects/_lib'

const projectListQuerySchema = z.object({
  status: z.enum(PROJECT_STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(24),
})

export const GET = handler(async (req, ctx) => {
  const { id } = await ctx.params
  await requireWorkspace(id)
  const query = parseQuery(req, projectListQuerySchema)

  // status filter: default excludes ARCHIVED; status=ARCHIVED shows archived projects
  const where = {
    workspaceId: id,
    ...(query.status ? { status: query.status } : { status: { not: 'ARCHIVED' }, archivedAt: null }),
  }

  // SQLite has no case-insensitive mode; fetch matching rows then filter q in JS
  const rows = await db.project.findMany({
    where,
    include: { owner: { select: { name: true } } },
    orderBy: { createdAt: 'desc' },
  })

  const filtered = query.q
    ? rows.filter((p) => p.name.toLowerCase().includes(query.q!.toLowerCase()))
    : rows

  const total = filtered.length
  const start = (query.page - 1) * query.pageSize
  const pageRows = filtered.slice(start, start + query.pageSize)
  const counts = await projectCountsFor(pageRows.map((p) => p.id))

  const projects = pageRows.map((p) => toProjectDTO(p, p.owner.name, counts.get(p.id) ?? { taskCount: 0, completedCount: 0, memberCount: 0 }))

  return ok({ projects, total, page: query.page, pageSize: query.pageSize })
})

export const POST = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const { auth } = await requireWorkspace(id, 'project.create')
  const data = await parseBody(req, projectCreateSchema)

  // Plan limit enforcement (402 with upgrade message)
  await assertCanCreateProject(id)

  // Duplicate name within the same workspace → 409
  const dup = await db.project.findFirst({ where: { workspaceId: id, name: data.name }, select: { id: true } })
  if (dup) {
    throw new HttpError(409, 'A project with this name already exists in the workspace.', 'DUPLICATE_NAME')
  }

  // memberIds: every user must be a workspace member → 422 otherwise
  const requested = Array.from(new Set(data.memberIds ?? [])).filter((uid) => uid !== auth.user.id)
  if (requested.length > 0) {
    const valid = await filterWorkspaceMemberIds(id, requested)
    const invalid = requested.filter((uid) => !valid.has(uid))
    if (invalid.length > 0) {
      throw new HttpError(422, 'One or more selected members do not belong to this workspace.', 'VALIDATION', {
        memberIds: 'All members must belong to this workspace',
      })
    }
  }

  const project = await db.$transaction(async (tx) => {
    const created = await tx.project.create({
      data: {
        workspaceId: id,
        name: data.name,
        description: data.description || null,
        color: data.color,
        icon: data.icon,
        ownerId: auth.user.id,
        status: data.status,
        priority: data.priority,
        startDate: data.startDate ? new Date(data.startDate) : null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        visibility: data.visibility,
      },
    })
    // Creator becomes project LEAD; optional members join as CONTRIBUTOR
    await tx.projectMember.create({
      data: { projectId: created.id, userId: auth.user.id, role: 'LEAD' },
    })
    if (requested.length > 0) {
      await tx.projectMember.createMany({
        data: requested.map((uid) => ({ projectId: created.id, userId: uid, role: 'CONTRIBUTOR' })),
      })
    }
    return created
  })

  await logActivity({
    workspaceId: id,
    actorId: auth.user.id,
    resourceType: 'PROJECT',
    resourceId: project.id,
    action: 'CREATED',
    metadata: { name: project.name },
  })

  const dto = toProjectDTO(project, auth.user.name, { taskCount: 0, completedCount: 0, memberCount: requested.length + 1 })
  return ok(dto, 201)
})
