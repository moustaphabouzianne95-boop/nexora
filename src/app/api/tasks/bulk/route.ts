import { db } from '@/lib/db'
import { handler, ok, HttpError, parseBody, requireAuth, notify } from '@/lib/api-helpers'
import { bulkTaskSchema } from '@/lib/validation'
import { can } from '@/lib/permissions'
import { TASK_STATUSES, PRIORITIES } from '@/lib/constants'
import type { Priority, Role, TaskStatus } from '@/types'

// ---------------------------------------------------------------------------
// POST /api/tasks/bulk — status/priority/assignee/delete across many tasks.
// Authorization is enforced per task's own workspace (server-derived roles).
// ---------------------------------------------------------------------------
export const POST = handler(async (req) => {
  const auth = await requireAuth()
  const data = await parseBody(req, bulkTaskSchema)

  const tasks = await db.task.findMany({
    where: { id: { in: data.taskIds } },
    select: { id: true, title: true, status: true, priority: true, assigneeId: true, creatorId: true, workspaceId: true },
  })
  if (tasks.length === 0) throw new HttpError(404, 'No matching tasks found.', 'NOT_FOUND')

  // Only tasks in workspaces where the caller has task.edit_any are touched
  const roleByWorkspace = auth.roleByWorkspace
  const authorized = tasks.filter((t) => can((roleByWorkspace.get(t.workspaceId) ?? null) as Role | null, 'task.edit_any'))
  if (authorized.length === 0) {
    throw new HttpError(403, 'Your role does not allow bulk editing in these workspaces.', 'FORBIDDEN_CAPABILITY')
  }

  const workspaceIds = Array.from(new Set(authorized.map((t) => t.workspaceId)))

  // --- action-specific validation -------------------------------------------
  let status: TaskStatus | undefined
  let priority: Priority | undefined
  let assigneeId: string | null | undefined

  if (data.action === 'status') {
    if (!data.value || !TASK_STATUSES.includes(data.value as TaskStatus)) {
      throw new HttpError(422, 'Invalid status value.', 'VALIDATION', { value: 'Must be a valid task status' })
    }
    status = data.value as TaskStatus
  } else if (data.action === 'priority') {
    if (!data.value || !PRIORITIES.includes(data.value as Priority)) {
      throw new HttpError(422, 'Invalid priority value.', 'VALIDATION', { value: 'Must be a valid priority' })
    }
    priority = data.value as Priority
  } else if (data.action === 'assignee') {
    assigneeId = data.value ?? null
    if (assigneeId) {
      // Assignee must be a member of every involved workspace
      for (const wsId of workspaceIds) {
        const member = await db.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId: wsId, userId: assigneeId } },
        })
        if (!member) {
          throw new HttpError(422, 'The assignee must be a member of every workspace containing the selected tasks.', 'VALIDATION', {
            value: 'Not a workspace member',
          })
        }
      }
    }
  }

  const updated = await db.$transaction(async (tx) => {
    let count = 0
    for (const task of authorized) {
      if (data.action === 'delete') {
        await tx.activityLog.create({
          data: {
            workspaceId: task.workspaceId,
            actorId: auth.user.id,
            resourceType: 'TASK',
            resourceId: null,
            action: 'DELETED',
            metadata: JSON.stringify({ title: task.title, bulk: true }),
          },
        })
        await tx.task.delete({ where: { id: task.id } })
        count++
        continue
      }

      if (data.action === 'status' && status && task.status !== status) {
        await tx.task.update({
          where: { id: task.id },
          data: { status, completedAt: status === 'DONE' ? new Date() : null },
        })
        await tx.activityLog.create({
          data: {
            workspaceId: task.workspaceId,
            actorId: auth.user.id,
            resourceType: 'TASK',
            resourceId: task.id,
            action: 'STATUS_CHANGED',
            metadata: JSON.stringify({ title: task.title, from: task.status, to: status, bulk: true }),
          },
        })
        count++
      } else if (data.action === 'priority' && priority && task.priority !== priority) {
        await tx.task.update({ where: { id: task.id }, data: { priority } })
        await tx.activityLog.create({
          data: {
            workspaceId: task.workspaceId,
            actorId: auth.user.id,
            resourceType: 'TASK',
            resourceId: task.id,
            action: 'UPDATED',
            metadata: JSON.stringify({ title: task.title, fields: ['priority'], bulk: true }),
          },
        })
        count++
      } else if (data.action === 'assignee' && assigneeId !== undefined && (task.assigneeId ?? null) !== assigneeId) {
        await tx.task.update({ where: { id: task.id }, data: { assigneeId } })
        if (assigneeId) {
          const user = await tx.user.findUnique({ where: { id: assigneeId }, select: { name: true } })
          await tx.activityLog.create({
            data: {
              workspaceId: task.workspaceId,
              actorId: auth.user.id,
              resourceType: 'TASK',
              resourceId: task.id,
              action: 'ASSIGNED',
              metadata: JSON.stringify({ title: task.title, to: user?.name ?? 'Unknown', bulk: true }),
            },
          })
        } else {
          await tx.activityLog.create({
            data: {
              workspaceId: task.workspaceId,
              actorId: auth.user.id,
              resourceType: 'TASK',
              resourceId: task.id,
              action: 'UNASSIGNED',
              metadata: JSON.stringify({ title: task.title, bulk: true }),
            },
          })
        }
        count++
      }
    }
    return count
  })

  // Notifications outside the transaction (best-effort, mirrors single-task PATCH)
  if (data.action === 'assignee' && assigneeId && assigneeId !== auth.user.id) {
    for (const task of authorized) {
      if ((task.assigneeId ?? null) !== assigneeId) {
        await notify({
          userId: assigneeId,
          workspaceId: task.workspaceId,
          type: 'TASK_ASSIGNED',
          title: `You were assigned: ${task.title}`,
          body: `${auth.user.name} assigned you this task.`,
          resourceType: 'TASK',
          resourceId: task.id,
        })
      }
    }
  }

  return ok({ ok: true, updated })
})
