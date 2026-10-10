import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, HttpError, parseBody, parseQuery, requireProject, logActivity, notify } from '@/lib/api-helpers'
import { taskCreateSchema } from '@/lib/validation'
import { PRIORITIES } from '@/lib/constants'
import { TASK_INCLUDE, TASK_ORDER, toTaskDTO } from '../../../tasks/_lib'

const taskListQuerySchema = z.object({
  view: z.enum(['board', 'list']).default('board'),
  assignee: z.string().max(40).optional(),
  priority: z.enum(PRIORITIES).optional(),
  label: z.string().max(40).optional(),
  q: z.string().trim().max(100).optional(),
  includeDone: z.string().optional(),
})

// taskCreateSchema minus projectId — project comes from the URL
const projectTaskCreateSchema = taskCreateSchema.omit({ projectId: true })

export const GET = handler(async (req, ctx) => {
  const { id } = await ctx.params
  await requireProject(id)
  const query = parseQuery(req, taskListQuerySchema)

  // Board excludes CANCELLED by default; includeDone=1 returns every status
  const excludeCancelled = !(query.includeDone === '1')
  const rows = await db.task.findMany({
    where: {
      projectId: id,
      ...(excludeCancelled ? { status: { notIn: ['CANCELLED'] } } : {}),
      ...(query.assignee === 'none' ? { assigneeId: null } : query.assignee ? { assigneeId: query.assignee } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.label ? { labels: { some: { labelId: query.label } } } : {}),
    },
    include: TASK_INCLUDE,
    orderBy: TASK_ORDER,
  })

  // SQLite: no case-insensitive contains — filter q in JS on title
  const filtered = query.q
    ? rows.filter((t) => t.title.toLowerCase().includes(query.q!.toLowerCase()))
    : rows

  return ok({ tasks: filtered.map(toTaskDTO) })
})

export const POST = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const { project, auth } = await requireProject(id, 'task.create')
  const data = await parseBody(req, projectTaskCreateSchema)

  // Assignee must be a workspace member → 422 otherwise
  if (data.assigneeId) {
    const member = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: project.workspaceId, userId: data.assigneeId } },
    })
    if (!member) {
      throw new HttpError(422, 'The assignee must be a member of this workspace.', 'VALIDATION', {
        assigneeId: 'Not a workspace member',
      })
    }
  }

  // Milestone must belong to this project → 422 otherwise
  if (data.milestoneId) {
    const milestone = await db.milestone.findUnique({ where: { id: data.milestoneId } })
    if (!milestone || milestone.projectId !== project.id) {
      throw new HttpError(422, 'The selected milestone does not belong to this project.', 'VALIDATION', {
        milestoneId: 'Invalid milestone',
      })
    }
  }

  // Parent (subtask host) must live in the same project → 422 otherwise
  if (data.parentTaskId) {
    const parent = await db.task.findUnique({ where: { id: data.parentTaskId }, select: { projectId: true } })
    if (!parent || parent.projectId !== project.id) {
      throw new HttpError(422, 'The parent task must belong to the same project.', 'VALIDATION', {
        parentTaskId: 'Invalid parent task',
      })
    }
  }

  // Labels must belong to the workspace → 422 otherwise
  const labelIds = Array.from(new Set(data.labelIds ?? []))
  if (labelIds.length > 0) {
    const found = await db.label.count({ where: { workspaceId: project.workspaceId, id: { in: labelIds } } })
    if (found !== labelIds.length) {
      throw new HttpError(422, 'One or more labels do not belong to this workspace.', 'VALIDATION', {
        labelIds: 'Invalid labels',
      })
    }
  }

  // position = given, or min-100 within the column (new tasks land on top)
  let position = data.position
  if (position === undefined) {
    const min = await db.task.aggregate({
      where: { projectId: project.id, status: data.status },
      _min: { position: true },
    })
    position = min._min.position !== null ? min._min.position - 100 : 1000
  }

  const task = await db.task.create({
    data: {
      workspaceId: project.workspaceId,
      projectId: project.id,
      title: data.title,
      description: data.description || null,
      status: data.status,
      priority: data.priority,
      assigneeId: data.assigneeId ?? null,
      creatorId: auth.user.id,
      startDate: data.startDate ? new Date(data.startDate) : null,
      dueDate: data.dueDate ? new Date(data.dueDate) : null,
      estimatedHours: data.estimatedHours ?? null,
      parentTaskId: data.parentTaskId ?? null,
      milestoneId: data.milestoneId ?? null,
      completedAt: data.status === 'DONE' ? new Date() : null,
      position,
      ...(labelIds.length > 0 ? { labels: { create: labelIds.map((labelId) => ({ labelId })) } } : {}),
    },
  })

  await logActivity({
    workspaceId: project.workspaceId,
    actorId: auth.user.id,
    resourceType: 'TASK',
    resourceId: task.id,
    action: 'CREATED',
    metadata: { title: task.title, projectName: project.name },
  })

  if (data.assigneeId && data.assigneeId !== auth.user.id) {
    await notify({
      userId: data.assigneeId,
      workspaceId: project.workspaceId,
      type: 'TASK_ASSIGNED',
      title: `You were assigned: ${task.title}`,
      body: `${auth.user.name} assigned you a task in ${project.name}.`,
      resourceType: 'TASK',
      resourceId: task.id,
    })
  }

  const dto = toTaskDTO(await db.task.findUniqueOrThrow({ where: { id: task.id }, include: TASK_INCLUDE }))
  return ok(dto, 201)
})
