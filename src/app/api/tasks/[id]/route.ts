import { db } from '@/lib/db'
import { handler, ok, HttpError, parseBody, requireTask, logActivity, notify } from '@/lib/api-helpers'
import { taskUpdateSchema } from '@/lib/validation'
import { canEditTask, can } from '@/lib/permissions'
import type { TaskStatus } from '@/types'
import {
  TASK_INCLUDE,
  TASK_ORDER,
  toTaskDTO,
  toCommentDTO,
  toAttachmentDTO,
  toActivityDTO,
  completedAtForStatus,
} from '../_lib'

// ---------------------------------------------------------------------------
// GET /api/tasks/:id — full task detail (workspace member only)
// ---------------------------------------------------------------------------
export const GET = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  await requireTask(id)

  const full = await db.task.findUniqueOrThrow({ where: { id }, include: TASK_INCLUDE })

  const [comments, attachments, subtasks, blockedByDeps, blocksDeps, activity] = await Promise.all([
    db.comment.findMany({ where: { taskId: id }, include: { author: { select: { id: true, name: true, avatarColor: true } } }, orderBy: { createdAt: 'asc' } }),
    db.attachment.findMany({ where: { taskId: id }, include: { uploader: { select: { id: true, name: true, avatarColor: true } } }, orderBy: { createdAt: 'desc' } }),
    db.task.findMany({ where: { parentTaskId: id }, include: TASK_INCLUDE, orderBy: TASK_ORDER }),
    db.taskDependency.findMany({ where: { blockedTaskId: id }, include: { blocker: { include: TASK_INCLUDE } } }),
    db.taskDependency.findMany({ where: { blockerTaskId: id }, include: { blocked: { include: TASK_INCLUDE } } }),
    db.activityLog.findMany({
      where: { resourceType: 'TASK', resourceId: id },
      include: { actor: { select: { id: true, name: true, avatarColor: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
  ])

  return ok({
    task: toTaskDTO(full),
    comments: comments.map(toCommentDTO),
    attachments: attachments.map(toAttachmentDTO),
    subtasks: subtasks.map(toTaskDTO),
    dependencies: {
      blockedBy: blockedByDeps.map((d) => toTaskDTO(d.blocker)),
      blocks: blocksDeps.map((d) => toTaskDTO(d.blocked)),
    },
    activity: activity.map(toActivityDTO),
  })
})

// ---------------------------------------------------------------------------
// PATCH /api/tasks/:id — diff-based updates; only ACTUAL changes are logged/notified
// ---------------------------------------------------------------------------
export const PATCH = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const { task, auth, role } = await requireTask(id)

  // MEMBER may only edit tasks they created or are assigned to; PM+ edit any; VIEWER never
  if (!canEditTask(role, { creatorId: task.creatorId, assigneeId: task.assigneeId }, auth.user.id)) {
    throw new HttpError(403, 'You can only edit tasks you created or are assigned to.', 'FORBIDDEN_TASK_EDIT')
  }

  const data = await parseBody(req, taskUpdateSchema)

  // Full row (labels + project) for diffing and DTO mapping
  const full = await db.task.findUniqueOrThrow({ where: { id: task.id }, include: TASK_INCLUDE })

  // --- validation of relational fields ---------------------------------------
  if (data.assigneeId !== undefined && data.assigneeId !== null && data.assigneeId !== task.assigneeId) {
    const member = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: task.workspaceId, userId: data.assigneeId } },
    })
    if (!member) {
      throw new HttpError(422, 'The assignee must be a member of this workspace.', 'VALIDATION', {
        assigneeId: 'Not a workspace member',
      })
    }
  }

  if (data.milestoneId) {
    const milestone = await db.milestone.findUnique({ where: { id: data.milestoneId } })
    if (!milestone || milestone.projectId !== task.projectId) {
      throw new HttpError(422, 'The selected milestone does not belong to this project.', 'VALIDATION', {
        milestoneId: 'Invalid milestone',
      })
    }
  }

  if (data.parentTaskId) {
    if (data.parentTaskId === task.id) {
      throw new HttpError(422, 'A task cannot be its own parent.', 'VALIDATION', { parentTaskId: 'Invalid parent' })
    }
    const parent = await db.task.findUnique({ where: { id: data.parentTaskId }, select: { projectId: true } })
    if (!parent || parent.projectId !== task.projectId) {
      throw new HttpError(422, 'The parent task must belong to the same project.', 'VALIDATION', {
        parentTaskId: 'Invalid parent task',
      })
    }
  }

  const labelIds = data.labelIds !== undefined ? Array.from(new Set(data.labelIds)) : undefined
  if (labelIds && labelIds.length > 0) {
    const found = await db.label.count({ where: { workspaceId: task.workspaceId, id: { in: labelIds } } })
    if (found !== labelIds.length) {
      throw new HttpError(422, 'One or more labels do not belong to this workspace.', 'VALIDATION', {
        labelIds: 'Invalid labels',
      })
    }
  }

  // --- compute actual diff (old vs new) ----------------------------------------
  const changes: Record<string, { from: unknown; to: unknown }> = {}
  const track = (field: string, before: unknown, after: unknown) => {
    if (after !== undefined && before !== after) changes[field] = { from: before, to: after }
  }
  track('title', full.title, data.title)
  track('description', full.description, data.description !== undefined ? (data.description ?? null) : undefined)
  track('status', full.status, data.status)
  track('priority', full.priority, data.priority)
  track('assigneeId', full.assigneeId, data.assigneeId !== undefined ? (data.assigneeId ?? null) : undefined)
  track('startDate', full.startDate ? full.startDate.toISOString() : null, data.startDate !== undefined ? (data.startDate ?? null) : undefined)
  track('dueDate', full.dueDate ? full.dueDate.toISOString() : null, data.dueDate !== undefined ? (data.dueDate ?? null) : undefined)
  track('estimatedHours', full.estimatedHours, data.estimatedHours !== undefined ? (data.estimatedHours ?? null) : undefined)
  track('milestoneId', full.milestoneId, data.milestoneId !== undefined ? (data.milestoneId ?? null) : undefined)
  track('parentTaskId', full.parentTaskId, data.parentTaskId !== undefined ? (data.parentTaskId ?? null) : undefined)
  track('position', full.position, data.position)
  if (labelIds !== undefined) {
    const current = full.labels.map((tl) => tl.labelId).sort().join(',')
    if (current !== [...labelIds].sort().join(',')) changes['labelIds'] = { from: current, to: labelIds.join(',') }
  }

  // Nothing actually changed → no write, no log, no notification
  if (Object.keys(changes).length === 0) {
    return ok(toTaskDTO(full))
  }

  const statusChanged = 'status' in changes
  const assigneeChanged = 'assigneeId' in changes
  const newStatus = (data.status ?? task.status) as TaskStatus

  await db.task.update({
    where: { id: task.id },
    data: {
      ...(data.title !== undefined ? { title: data.title } : {}),
      ...(data.description !== undefined ? { description: data.description } : {}),
      ...(data.status !== undefined
        ? { status: data.status, completedAt: completedAtForStatus(newStatus, task.completedAt) }
        : {}),
      ...(data.priority !== undefined ? { priority: data.priority } : {}),
      ...(data.assigneeId !== undefined ? { assigneeId: data.assigneeId } : {}),
      ...(data.startDate !== undefined ? { startDate: data.startDate ? new Date(data.startDate) : null } : {}),
      ...(data.dueDate !== undefined ? { dueDate: data.dueDate ? new Date(data.dueDate) : null } : {}),
      ...(data.estimatedHours !== undefined ? { estimatedHours: data.estimatedHours } : {}),
      ...(data.milestoneId !== undefined ? { milestoneId: data.milestoneId } : {}),
      ...(data.parentTaskId !== undefined ? { parentTaskId: data.parentTaskId } : {}),
      ...(data.position !== undefined ? { position: data.position } : {}),
      ...(labelIds !== undefined
        ? { labels: { deleteMany: { taskId: task.id }, create: labelIds.map((labelId) => ({ taskId: task.id, labelId })) } }
        : {}),
    },
  })

  // --- audit log (only on actual changes) ---------------------------------------
  if (statusChanged) {
    await logActivity({
      workspaceId: task.workspaceId,
      actorId: auth.user.id,
      resourceType: 'TASK',
      resourceId: task.id,
      action: 'STATUS_CHANGED',
      metadata: { title: full.title, from: task.status, to: newStatus },
    })
  }

  if (assigneeChanged) {
    const newAssigneeId = data.assigneeId ?? null
    if (newAssigneeId) {
      const user = await db.user.findUnique({ where: { id: newAssigneeId }, select: { name: true } })
      await logActivity({
        workspaceId: task.workspaceId,
        actorId: auth.user.id,
        resourceType: 'TASK',
        resourceId: task.id,
        action: 'ASSIGNED',
        metadata: { title: full.title, to: user?.name ?? 'Unknown' },
      })
    } else {
      await logActivity({
        workspaceId: task.workspaceId,
        actorId: auth.user.id,
        resourceType: 'TASK',
        resourceId: task.id,
        action: 'UNASSIGNED',
        metadata: { title: full.title },
      })
    }
  }

  const otherFields = Object.keys(changes).filter(
    (f) => f !== 'status' && f !== 'assigneeId' && f !== 'position'
  )
  if (otherFields.length > 0) {
    await logActivity({
      workspaceId: task.workspaceId,
      actorId: auth.user.id,
      resourceType: 'TASK',
      resourceId: task.id,
      action: 'UPDATED',
      metadata: { title: full.title, fields: otherFields },
    })
  }

  // --- notifications --------------------------------------------------------------
  if (assigneeChanged && data.assigneeId && data.assigneeId !== auth.user.id) {
    await notify({
      userId: data.assigneeId,
      workspaceId: task.workspaceId,
      type: 'TASK_ASSIGNED',
      title: `You were assigned: ${full.title}`,
      body: `${auth.user.name} assigned you this task.`,
      resourceType: 'TASK',
      resourceId: task.id,
    })
  } else if (task.assigneeId && task.assigneeId !== auth.user.id && otherFields.length > 0) {
    // Generic update notice to the (unchanged) assignee
    await notify({
      userId: task.assigneeId,
      workspaceId: task.workspaceId,
      type: 'TASK_ASSIGNED',
      title: `Task updated: ${full.title}`,
      body: `${auth.user.name} updated ${otherFields.join(', ')}.`,
      resourceType: 'TASK',
      resourceId: task.id,
    })
  }

  return ok(toTaskDTO(await db.task.findUniqueOrThrow({ where: { id: task.id }, include: TASK_INCLUDE })))
})

// ---------------------------------------------------------------------------
// DELETE /api/tasks/:id — creator or task.edit_any (PM+)
// ---------------------------------------------------------------------------
export const DELETE = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  const { task, auth, role } = await requireTask(id)

  const isCreator = task.creatorId === auth.user.id
  if (!isCreator && !can(role, 'task.edit_any')) {
    throw new HttpError(403, 'Only the task creator or a project manager can delete this task.', 'FORBIDDEN_TASK_DELETE')
  }

  await logActivity({
    workspaceId: task.workspaceId,
    actorId: auth.user.id,
    resourceType: 'TASK',
    resourceId: null,
    action: 'DELETED',
    metadata: { title: task.title, projectName: task.project.name },
  })

  await db.task.delete({ where: { id: task.id } })
  return ok({ ok: true })
})
