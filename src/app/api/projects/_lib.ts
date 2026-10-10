import type { Prisma } from '@prisma/client'
import { db } from '@/lib/db'
import type {
  MilestoneDTO,
  Priority,
  ProjectDTO,
  ProjectMemberDTO,
  ProjectStatus,
  Role,
} from '@/types'

// ---------------------------------------------------------------------------
// Shared project / milestone / project-member DTO mappers for task 2-b routes.
// ---------------------------------------------------------------------------

export function toProjectDTO(
  project: Prisma.ProjectGetPayload<Record<string, never>>,
  ownerName: string,
  counts: { taskCount: number; completedCount: number; memberCount: number }
): ProjectDTO {
  const progress = counts.taskCount > 0 ? Math.round((counts.completedCount / counts.taskCount) * 100) : 0
  return {
    id: project.id,
    workspaceId: project.workspaceId,
    name: project.name,
    slug: project.id, // NOTE: Project has no slug column in the schema; the DTO field is filled with the id for client compatibility.
    description: project.description,
    color: project.color,
    icon: project.icon,
    ownerId: project.ownerId,
    ownerName,
    status: project.status as ProjectStatus,
    priority: project.priority as Priority,
    startDate: project.startDate ? project.startDate.toISOString() : null,
    dueDate: project.dueDate ? project.dueDate.toISOString() : null,
    visibility: project.visibility as ProjectDTO['visibility'],
    archivedAt: project.archivedAt ? project.archivedAt.toISOString() : null,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
    taskCount: counts.taskCount,
    completedCount: counts.completedCount,
    memberCount: counts.memberCount,
    progress,
  }
}

export interface ProjectCounts {
  taskCount: number
  completedCount: number
  memberCount: number
}

/** Computes task/completed/member counts for a set of projects with 3 grouped queries (real aggregates). */
export async function projectCountsFor(projectIds: string[]): Promise<Map<string, ProjectCounts>> {
  const map = new Map<string, ProjectCounts>()
  if (projectIds.length === 0) return map

  const [taskCounts, doneCounts, memberCounts] = await Promise.all([
    db.task.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds } }, _count: { _all: true } }),
    db.task.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds }, status: 'DONE' }, _count: { _all: true } }),
    db.projectMember.groupBy({ by: ['projectId'], where: { projectId: { in: projectIds } }, _count: { _all: true } }),
  ])

  for (const id of projectIds) {
    map.set(id, {
      taskCount: taskCounts.find((r) => r.projectId === id)?._count._all ?? 0,
      completedCount: doneCounts.find((r) => r.projectId === id)?._count._all ?? 0,
      memberCount: memberCounts.find((r) => r.projectId === id)?._count._all ?? 0,
    })
  }
  return map
}

export function toMilestoneDTO(
  milestone: Prisma.MilestoneGetPayload<Record<string, never>>,
  counts: { taskCount: number; completedCount: number }
): MilestoneDTO {
  return {
    id: milestone.id,
    projectId: milestone.projectId,
    name: milestone.name,
    description: milestone.description,
    dueDate: milestone.dueDate ? milestone.dueDate.toISOString() : null,
    status: milestone.status as MilestoneDTO['status'],
    taskCount: counts.taskCount,
    completedCount: counts.completedCount,
  }
}

/** Computes task/completed counts per milestone with 2 grouped queries. */
export async function milestoneCountsFor(
  milestoneIds: string[]
): Promise<Map<string, { taskCount: number; completedCount: number }>> {
  const map = new Map<string, { taskCount: number; completedCount: number }>()
  if (milestoneIds.length === 0) return map
  const [totals, dones] = await Promise.all([
    db.task.groupBy({ by: ['milestoneId'], where: { milestoneId: { in: milestoneIds } }, _count: { _all: true } }),
    db.task.groupBy({ by: ['milestoneId'], where: { milestoneId: { in: milestoneIds }, status: 'DONE' }, _count: { _all: true } }),
  ])
  for (const id of milestoneIds) {
    map.set(id, {
      taskCount: totals.find((t) => t.milestoneId === id)?._count._all ?? 0,
      completedCount: dones.find((t) => t.milestoneId === id)?._count._all ?? 0,
    })
  }
  return map
}

export const PROJECT_MEMBER_INCLUDE = {
  user: { select: { id: true, name: true, email: true, avatarColor: true } },
} satisfies Prisma.ProjectMemberInclude

export type ProjectMemberRow = Prisma.ProjectMemberGetPayload<{ include: typeof PROJECT_MEMBER_INCLUDE }>

export function toProjectMemberDTO(member: ProjectMemberRow): ProjectMemberDTO {
  return {
    id: member.id,
    userId: member.userId,
    name: member.user.name,
    email: member.user.email,
    avatarColor: member.user.avatarColor,
    role: member.role as ProjectMemberDTO['role'],
  }
}

/** Returns the subset of userIds that are members of the given workspace. */
export async function filterWorkspaceMemberIds(workspaceId: string, userIds: string[]): Promise<Set<string>> {
  if (userIds.length === 0) return new Set()
  const rows = await db.workspaceMember.findMany({
    where: { workspaceId, userId: { in: userIds } },
    select: { userId: true },
  })
  return new Set(rows.map((r) => r.userId))
}

export type { Role }
