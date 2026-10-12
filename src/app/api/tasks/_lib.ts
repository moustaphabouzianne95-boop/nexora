import type { Prisma, ActivityLog, Comment, Attachment } from '@prisma/client'
import type {
  ActivityDTO,
  AttachmentDTO,
  CommentDTO,
  LabelDTO,
  Priority,
  TaskDTO,
  TaskStatus,
} from '@/types'

// ---------------------------------------------------------------------------
// Shared TaskDTO mapper — used by ALL task-returning endpoints (tasks,
// projects, dashboard, analytics, calendar, my-tasks). Task rows MUST be
// loaded with TASK_INCLUDE so the mapping below has everything it needs.
// ---------------------------------------------------------------------------

export const TASK_INCLUDE = {
  assignee: { select: { id: true, name: true, avatarColor: true } },
  creator: { select: { id: true, name: true, avatarColor: true } },
  labels: { include: { label: true } },
  _count: { select: { comments: true, attachments: true, subtasks: true } },
  subtasks: { select: { status: true } },
  milestone: { select: { id: true, name: true } },
  project: { select: { name: true, color: true, workspaceId: true } },
  blockedBy: { select: { blocker: { select: { status: true } } } },
} satisfies Prisma.TaskInclude

export type TaskRow = Prisma.TaskGetPayload<{ include: typeof TASK_INCLUDE }>

export function toTaskDTO(task: TaskRow): TaskDTO {
  const labels: LabelDTO[] = task.labels.map((tl) => ({
    id: tl.label.id,
    name: tl.label.name,
    color: tl.label.color,
    description: tl.label.description,
  }))

  return {
    id: task.id,
    workspaceId: task.workspaceId,
    projectId: task.projectId,
    projectName: task.project.name,
    projectColor: task.project.color,
    title: task.title,
    description: task.description,
    status: task.status as TaskStatus,
    priority: task.priority as Priority,
    assignee: task.assignee
      ? { id: task.assignee.id, name: task.assignee.name, avatarColor: task.assignee.avatarColor }
      : null,
    creator: {
      id: task.creator.id,
      name: task.creator.name,
      avatarColor: task.creator.avatarColor,
    },
    startDate: task.startDate ? task.startDate.toISOString() : null,
    dueDate: task.dueDate ? task.dueDate.toISOString() : null,
    estimatedHours: task.estimatedHours,
    position: task.position,
    parentTaskId: task.parentTaskId,
    milestoneId: task.milestoneId,
    milestoneName: task.milestone ? task.milestone.name : null,
    completedAt: task.completedAt ? task.completedAt.toISOString() : null,
    createdAt: task.createdAt.toISOString(),
    updatedAt: task.updatedAt.toISOString(),
    commentCount: task._count.comments,
    attachmentCount: task._count.attachments,
    subtaskCount: task._count.subtasks,
    subtaskDoneCount: task.subtasks.filter((s) => s.status === 'DONE').length,
    labels,
    blockedByCount: task.blockedBy.length,
    blockedByOpenCount: task.blockedBy.filter((d) => d.blocker.status !== 'DONE').length,
  }
}

// --------------------------------------------------------------- activity

export const ACTOR_SELECT = { select: { id: true, name: true, avatarColor: true } } as const

export type ActivityRow = ActivityLog & { actor: { id: string; name: string; avatarColor: string } }

export function toActivityDTO(activity: ActivityRow): ActivityDTO {
  let metadata: Record<string, unknown> | null = null
  if (activity.metadata) {
    try {
      metadata = JSON.parse(activity.metadata) as Record<string, unknown>
    } catch {
      metadata = null
    }
  }
  return {
    id: activity.id,
    actorName: activity.actor.name,
    actorColor: activity.actor.avatarColor,
    resourceType: activity.resourceType,
    resourceId: activity.resourceId,
    action: activity.action,
    metadata,
    createdAt: activity.createdAt.toISOString(),
  }
}

// --------------------------------------------------------------- comments

export const COMMENT_INCLUDE = { author: { select: { id: true, name: true, avatarColor: true } } } satisfies Prisma.CommentInclude

export type CommentRow = Prisma.CommentGetPayload<{ include: typeof COMMENT_INCLUDE }>

export function toCommentDTO(comment: CommentRow): CommentDTO {
  return {
    id: comment.id,
    taskId: comment.taskId,
    author: {
      id: comment.author.id,
      name: comment.author.name,
      avatarColor: comment.author.avatarColor,
    },
    body: comment.body,
    createdAt: comment.createdAt.toISOString(),
    updatedAt: comment.updatedAt.toISOString(),
  }
}

// ------------------------------------------------------------ attachments

export type AttachmentRow = Attachment & { uploader: { id: string; name: string; avatarColor: string } }

export function toAttachmentDTO(attachment: AttachmentRow): AttachmentDTO {
  return {
    id: attachment.id,
    taskId: attachment.taskId,
    filename: attachment.filename,
    mimeType: attachment.mimeType,
    size: attachment.size,
    uploaderName: attachment.uploader.name,
    createdAt: attachment.createdAt.toISOString(),
  }
}

// -------------------------------------------------------------- utilities

/** Stable board/list ordering: position first, createdAt as tiebreak (seeded rows share positions). */
export const TASK_ORDER: Prisma.TaskOrderByWithRelationInput[] = [{ position: 'asc' }, { createdAt: 'asc' }]

/** completedAt is set when a task reaches DONE (preserved if already DONE), cleared whenever it leaves DONE. */
export function completedAtForStatus(status: TaskStatus, current: Date | null): Date | null {
  if (status === 'DONE') return current ?? new Date()
  return null
}

/** Parses a query date param (ISO datetime or yyyy-mm-dd). Returns null when invalid. */
export function parseDateParam(value: string | undefined | null): Date | null {
  if (!value) return null
  const d = new Date(value)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Monday 00:00 UTC of the week containing `date`. */
export function startOfWeekUTC(date: Date): Date {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()))
  const day = d.getUTCDay() // 0 = Sunday
  const diff = (day + 6) % 7 // days since Monday
  d.setUTCDate(d.getUTCDate() - diff)
  return d
}

export type { Comment }
