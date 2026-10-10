'use client'

/**
 * Cache helpers shared by the TaskDialog and its sections.
 */

import type { QueryClient } from '@tanstack/react-query'
import { qk } from '@/lib/api-client'
import type { ActivityDTO, AttachmentDTO, CommentDTO, LabelDTO, Priority, TaskDTO, TaskStatus, WorkspaceMemberDTO } from '@/types'

export interface TaskDetailEnvelope {
  task: TaskDTO
  comments: CommentDTO[]
  attachments: AttachmentDTO[]
  subtasks: TaskDTO[]
  dependencies: { blockedBy: TaskDTO[]; blocks: TaskDTO[] }
  activity: ActivityDTO[]
}

export function taskEnvelopeKey(taskId: string) {
  return qk.task(taskId)
}

/** Optimistically patch the task inside its detail envelope. */
export function patchTaskEnvelope(qc: QueryClient, taskId: string, patch: Partial<TaskDTO>) {
  qc.setQueryData<TaskDetailEnvelope>(taskEnvelopeKey(taskId), (prev) =>
    prev ? { ...prev, task: { ...prev.task, ...patch } } : prev
  )
}

/** Optimistically patch a subtask inside the parent's detail envelope. */
export function patchSubtaskEnvelope(qc: QueryClient, taskId: string, subtaskId: string, patch: Partial<TaskDTO>) {
  qc.setQueryData<TaskDetailEnvelope>(taskEnvelopeKey(taskId), (prev) =>
    prev
      ? { ...prev, subtasks: prev.subtasks.map((s) => (s.id === subtaskId ? { ...s, ...patch } : s)) }
      : prev
  )
}

/** Map a TaskDTO onto the input shape expected by canEditTask(). */
export function taskEditInput(task: TaskDTO): { creatorId: string; assigneeId: string | null } {
  return { creatorId: task.creator.id, assigneeId: task.assignee?.id ?? null }
}

// ------------------------------------------------------------------ patch mapping

/** Field names accepted by PATCH /api/tasks/:id (taskUpdateSchema minus unknowns). */
export interface TaskPatchInput {
  title?: string
  description?: string
  status?: TaskStatus
  priority?: Priority
  assigneeId?: string | null
  dueDate?: string | null
  labelIds?: string[]
}

/** Convert a server-shaped patch into a TaskDTO-shaped patch for optimistic caches. */
export function applyTaskPatch(
  task: TaskDTO,
  patch: TaskPatchInput,
  members: WorkspaceMemberDTO[],
  labels: LabelDTO[]
): TaskDTO {
  const next: TaskDTO = { ...task }
  if (patch.title !== undefined) next.title = patch.title
  if (patch.description !== undefined) next.description = patch.description
  if (patch.status !== undefined) next.status = patch.status
  if (patch.priority !== undefined) next.priority = patch.priority
  if (patch.dueDate !== undefined) next.dueDate = patch.dueDate
  if (patch.assigneeId !== undefined) {
    const member = patch.assigneeId ? members.find((m) => m.userId === patch.assigneeId) : null
    next.assignee = member
      ? { id: member.userId, name: member.name, avatarColor: member.avatarColor }
      : null
  }
  if (patch.labelIds !== undefined) {
    next.labels = patch.labelIds
      .map((id) => labels.find((l) => l.id === id))
      .filter((l): l is LabelDTO => !!l)
  }
  return next
}
