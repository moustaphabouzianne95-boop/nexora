import { NextRequest } from 'next/server'
import { z } from 'zod'
import { db } from '@/lib/db'
import { handler, ok, parseQuery, requireWorkspace } from '@/lib/api-helpers'
import { can } from '@/lib/permissions'
import { OPEN_STATUSES } from '@/lib/constants'
import { slugify } from '@/lib/validation'
import type { LabelDTO, Priority, ProjectDTO, ProjectStatus, SearchResult, TaskDTO, TaskStatus } from '@/types'

export const runtime = 'nodejs'

/**
 * NOTE: validation.ts searchQuerySchema only covers `q`; the workspaceId
 * query param is validated by this local schema. Suggested follow-up:
 * extend searchQuerySchema in validation.ts with workspaceId.
 */
const searchRouteQuerySchema = z.object({
  q: z.string().trim().min(1, 'Search query is required').max(100),
  workspaceId: z.string().min(1),
})

// ---------------------------------------------------------------------------
// DTO builders (search-scale; identical shapes to the contract DTOs).
// NOTE for task 2-b: these mirror the projects/tasks endpoints' builders.
// ---------------------------------------------------------------------------

type ProjectRow = {
  id: string
  workspaceId: string
  name: string
  slug?: string // NOTE: Project model has no slug column — synthesized via slugify(name) below
  description: string | null
  color: string
  icon: string
  ownerId: string
  status: string
  priority: string
  startDate: Date | null
  dueDate: Date | null
  visibility: string
  archivedAt: Date | null
  createdAt: Date
  updatedAt: Date
  owner?: { name: string } | null
  _count?: { tasks: number; members: number }
}

function toProjectDTO(p: ProjectRow, completedCount: number): ProjectDTO {
  const taskCount = p._count?.tasks ?? 0
  return {
    id: p.id,
    workspaceId: p.workspaceId,
    name: p.name,
    slug: p.slug ?? (slugify(p.name) || p.id),
    description: p.description,
    color: p.color,
    icon: p.icon,
    ownerId: p.ownerId,
    ownerName: p.owner?.name ?? '',
    status: p.status as ProjectStatus,
    priority: p.priority as Priority,
    startDate: p.startDate ? p.startDate.toISOString() : null,
    dueDate: p.dueDate ? p.dueDate.toISOString() : null,
    visibility: p.visibility as ProjectDTO['visibility'],
    archivedAt: p.archivedAt ? p.archivedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    taskCount,
    completedCount,
    memberCount: p._count?.members ?? 0,
    progress: taskCount > 0 ? Math.round((completedCount / taskCount) * 100) : 0,
  }
}

type TaskRow = {
  id: string
  workspaceId: string
  projectId: string
  title: string
  description: string | null
  status: string
  priority: string
  startDate: Date | null
  dueDate: Date | null
  estimatedHours: number | null
  position: number
  parentTaskId: string | null
  milestoneId: string | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
  project: { name: string; color: string }
  assignee: { id: string; name: string; avatarColor: string } | null
  creator: { id: string; name: string; avatarColor: string }
  milestone: { name: string } | null
  labels: { label: { id: string; name: string; color: string; description: string | null } }[]
  _count: { comments: number; attachments: number; subtasks: number }
}

function toTaskDTO(
  t: TaskRow,
  subtaskDoneByParent: Map<string, number>,
  blockedByByTask: Map<string, { total: number; open: number }>
): TaskDTO {
  const labels: LabelDTO[] = t.labels.map((tl) => ({
    id: tl.label.id,
    name: tl.label.name,
    color: tl.label.color,
    description: tl.label.description,
  }))
  const blocked = blockedByByTask.get(t.id) ?? { total: 0, open: 0 }
  return {
    id: t.id,
    workspaceId: t.workspaceId,
    projectId: t.projectId,
    projectName: t.project.name,
    projectColor: t.project.color,
    title: t.title,
    description: t.description,
    status: t.status as TaskStatus,
    priority: t.priority as Priority,
    assignee: t.assignee,
    creator: t.creator,
    startDate: t.startDate ? t.startDate.toISOString() : null,
    dueDate: t.dueDate ? t.dueDate.toISOString() : null,
    estimatedHours: t.estimatedHours,
    position: t.position,
    parentTaskId: t.parentTaskId,
    milestoneId: t.milestoneId,
    milestoneName: t.milestone?.name ?? null,
    completedAt: t.completedAt ? t.completedAt.toISOString() : null,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
    commentCount: t._count.comments,
    attachmentCount: t._count.attachments,
    subtaskCount: t._count.subtasks,
    subtaskDoneCount: subtaskDoneByParent.get(t.id) ?? 0,
    labels,
    blockedByCount: blocked.total,
    blockedByOpenCount: blocked.open,
  }
}

/** Visibility filter shared by project + task scoping. */
function visibleProjectWhere(workspaceId: string, userId: string) {
  return {
    workspaceId,
    OR: [
      { visibility: 'WORKSPACE' },
      { ownerId: userId },
      { members: { some: { userId } } },
    ],
  }
}

/**
 * GET /api/search?q=&workspaceId= — scoped to the session user's workspace
 * membership. Projects respect visibility (WORKSPACE / owner / project member),
 * tasks are limited to visible projects and exclude CANCELLED, members match
 * name or email (emails only when the caller has member.view_details).
 * SQLite `contains` is ASCII case-insensitive; a lowercase JS filter is
 * applied as a fallback for names/emails.
 */
export const GET = handler(async (req: NextRequest) => {
  const { q, workspaceId } = parseQuery(req, searchRouteQuerySchema)
  const { auth, role } = await requireWorkspace(workspaceId)
  const me = auth.user.id
  const needle = q.toLowerCase()

  // Projects the user can see in this workspace (for scoping + matching).
  const visibleProjects = await db.project.findMany({
    where: visibleProjectWhere(workspaceId, me),
    select: { id: true },
  })
  const visibleIds = visibleProjects.map((p) => p.id)

  // ---- projects (limit 5) ----
  const matchedProjects = await db.project.findMany({
    where: {
      ...visibleProjectWhere(workspaceId, me),
      name: { contains: q },
    },
    include: {
      owner: { select: { name: true } },
      _count: { select: { tasks: true, members: true } },
    },
    orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
    take: 5,
  })

  let projects: ProjectDTO[] = []
  if (matchedProjects.length > 0) {
    const completed = await db.task.groupBy({
      by: ['projectId'],
      where: { projectId: { in: matchedProjects.map((p) => p.id) }, status: 'DONE' },
      _count: { _all: true },
    })
    const completedByProject = new Map(completed.map((c) => [c.projectId, c._count._all]))
    projects = matchedProjects.map((p) => toProjectDTO(p, completedByProject.get(p.id) ?? 0))
  }

  // ---- tasks (limit 5, exclude CANCELLED, visible projects only) ----
  let tasks: TaskDTO[] = []
  if (visibleIds.length > 0) {
    const matchedTasks = await db.task.findMany({
      where: {
        workspaceId,
        projectId: { in: visibleIds },
        title: { contains: q },
        status: { not: 'CANCELLED' },
      },
      include: {
        project: { select: { name: true, color: true } },
        assignee: { select: { id: true, name: true, avatarColor: true } },
        creator: { select: { id: true, name: true, avatarColor: true } },
        milestone: { select: { name: true } },
        labels: { include: { label: true } },
        _count: { select: { comments: true, attachments: true, subtasks: true } },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
      take: 5,
    })

    if (matchedTasks.length > 0) {
      const taskIds = matchedTasks.map((t) => t.id)

      const [doneSubtasks, deps] = await Promise.all([
        db.task.groupBy({
          by: ['parentTaskId'],
          where: { parentTaskId: { in: taskIds }, status: 'DONE' },
          _count: { _all: true },
        }),
        db.taskDependency.findMany({
          where: { blockedTaskId: { in: taskIds } },
          select: { blockedTaskId: true, blocker: { select: { status: true } } },
        }),
      ])

      const subtaskDoneByParent = new Map<string, number>()
      for (const row of doneSubtasks) {
        if (row.parentTaskId) subtaskDoneByParent.set(row.parentTaskId, row._count._all)
      }

      const blockedByByTask = new Map<string, { total: number; open: number }>()
      for (const dep of deps) {
        const agg = blockedByByTask.get(dep.blockedTaskId) ?? { total: 0, open: 0 }
        agg.total += 1
        if (OPEN_STATUSES.includes(dep.blocker.status as TaskStatus)) agg.open += 1
        blockedByByTask.set(dep.blockedTaskId, agg)
      }

      tasks = matchedTasks.map((t) => toTaskDTO(t, subtaskDoneByParent, blockedByByTask))
    }
  }

  // ---- members (limit 5, name or email; email hidden without member.view_details) ----
  const matchedMembers = await db.workspaceMember.findMany({
    where: {
      workspaceId,
      OR: [
        { user: { name: { contains: q } } },
        { user: { email: { contains: q } } },
      ],
    },
    include: { user: { select: { id: true, name: true, email: true, avatarColor: true } } },
    orderBy: { createdAt: 'asc' },
    take: 10,
  })

  const emailVisible = can(role, 'member.view_details')
  const members = matchedMembers
    .filter((m) => m.user.name.toLowerCase().includes(needle) || m.user.email.toLowerCase().includes(needle))
    .slice(0, 5)
    .map((m) => ({
      id: m.user.id,
      name: m.user.name,
      email: emailVisible ? m.user.email : '',
      avatarColor: m.user.avatarColor,
    }))

  const result: SearchResult = { projects, tasks, members }
  return ok(result)
})
