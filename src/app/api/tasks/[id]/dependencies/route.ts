import { db } from '@/lib/db'
import { handler, ok, HttpError, parseBody, requireTask, logActivity } from '@/lib/api-helpers'
import { dependencyCreateSchema } from '@/lib/validation'
import { assertFeature } from '@/lib/entitlements'
import { canEditTask } from '@/lib/permissions'

// ---------------------------------------------------------------------------
// POST /api/tasks/:id/dependencies — plan-gated (402 on FREE), cycle-safe.
// Edge semantics: blockerTaskId must reach DONE before blockedTaskId.
// ---------------------------------------------------------------------------
export const POST = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const { task, auth, role } = await requireTask(id)
  const data = await parseBody(req, dependencyCreateSchema)

  // Dependency management follows task-edit semantics on the context task
  if (!canEditTask(role, { creatorId: task.creatorId, assigneeId: task.assigneeId }, auth.user.id)) {
    throw new HttpError(403, 'You do not have permission to modify dependencies of this task.', 'FORBIDDEN_TASK_EDIT')
  }

  // FREE plan has no dependency feature → 402 with upgrade message
  await assertFeature(task.workspaceId, 'dependencies')

  const { blockerTaskId, blockedTaskId } = data

  // Self-dependency → 400
  if (blockerTaskId === blockedTaskId) {
    throw new HttpError(400, 'A task cannot depend on itself.', 'SELF_DEPENDENCY')
  }

  // Both tasks must live in the same workspace as the context task (tenant isolation)
  const [blocker, blocked] = await Promise.all([
    db.task.findUnique({ where: { id: blockerTaskId }, select: { id: true, workspaceId: true, projectId: true, title: true } }),
    db.task.findUnique({ where: { id: blockedTaskId }, select: { id: true, workspaceId: true, projectId: true, title: true } }),
  ])
  if (!blocker || !blocked || blocker.workspaceId !== task.workspaceId || blocked.workspaceId !== task.workspaceId) {
    throw new HttpError(422, 'Both tasks must belong to the same workspace.', 'VALIDATION', {
      blockerTaskId: 'Invalid task',
      blockedTaskId: 'Invalid task',
    })
  }

  // Duplicate edge → 409
  const existing = await db.taskDependency.findUnique({
    where: { blockerTaskId_blockedTaskId: { blockerTaskId, blockedTaskId } },
  })
  if (existing) {
    throw new HttpError(409, 'This dependency already exists.', 'DUPLICATE_DEPENDENCY')
  }

  // Cycle detection: DFS over the blocker→blocked graph. Adding A→B creates a
  // cycle iff B can already reach A through existing "blocks" edges.
  const edges = await db.taskDependency.findMany({
    where: { blocker: { workspaceId: task.workspaceId } },
    select: { blockerTaskId: true, blockedTaskId: true },
  })
  const adjacency = new Map<string, string[]>()
  for (const e of edges) {
    const list = adjacency.get(e.blockerTaskId) ?? []
    list.push(e.blockedTaskId)
    adjacency.set(e.blockerTaskId, list)
  }

  const reachable = (from: string, target: string): boolean => {
    const stack = [from]
    const seen = new Set<string>([from])
    while (stack.length > 0) {
      const cur = stack.pop()!
      if (cur === target) return true
      for (const next of adjacency.get(cur) ?? []) {
        if (!seen.has(next)) {
          seen.add(next)
          stack.push(next)
        }
      }
    }
    return false
  }

  if (reachable(blockedTaskId, blockerTaskId)) {
    throw new HttpError(409, 'This would create a circular dependency.', 'CIRCULAR_DEPENDENCY')
  }

  const dependency = await db.taskDependency.create({
    data: { blockerTaskId, blockedTaskId },
  })

  await logActivity({
    workspaceId: task.workspaceId,
    actorId: auth.user.id,
    resourceType: 'TASK',
    resourceId: task.id,
    action: 'UPDATED',
    metadata: {
      title: task.title,
      fields: ['dependencies'],
      dependency: `${blocker.title} blocks ${blocked.title}`,
    },
  })

  return ok(
    {
      dependency: {
        id: dependency.id,
        blockerTaskId: dependency.blockerTaskId,
        blockedTaskId: dependency.blockedTaskId,
        createdAt: dependency.createdAt.toISOString(),
      },
    },
    201
  )
})
