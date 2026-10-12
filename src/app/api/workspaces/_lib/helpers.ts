import 'server-only'

import { db } from '@/lib/db'
import { HttpError, requireCapability, requireAuth } from '@/lib/api-helpers'
import { can, type Capability } from '@/lib/permissions'
import { OPEN_STATUSES } from '@/lib/constants'
import type { InvitationDTO, InvitationStatus, Role, WorkspaceDetail, WorkspaceMemberDTO } from '@/types'

// ---------------------------------------------------------------------------
// WorkspaceDetail builder
// ---------------------------------------------------------------------------

type WorkspaceRow = {
  id: string
  name: string
  slug: string
  description: string | null
  logoColor: string
  type: string
  teamSize: string
  timezone: string
  ownerId: string
  archivedAt: Date | null
  createdAt: Date
  _count?: { members: number; projects: number }
}

export async function fetchWorkspaceDetail(workspaceId: string, myRole: Role): Promise<WorkspaceDetail> {
  const ws = await db.workspace.findUnique({
    where: { id: workspaceId },
    include: { _count: { select: { members: true, projects: true } } },
  })
  if (!ws) throw new HttpError(404, 'Workspace not found.', 'NOT_FOUND')
  return workspaceRowToDetail(ws, myRole)
}

export function workspaceRowToDetail(ws: WorkspaceRow, myRole: Role): WorkspaceDetail {
  return {
    id: ws.id,
    name: ws.name,
    slug: ws.slug,
    description: ws.description,
    logoColor: ws.logoColor,
    type: ws.type,
    teamSize: ws.teamSize,
    timezone: ws.timezone,
    ownerId: ws.ownerId,
    archivedAt: ws.archivedAt ? ws.archivedAt.toISOString() : null,
    createdAt: ws.createdAt.toISOString(),
    myRole,
    memberCount: ws._count?.members ?? 0,
    projectCount: ws._count?.projects ?? 0,
  }
}

// ---------------------------------------------------------------------------
// Guards
// ---------------------------------------------------------------------------

/**
 * Membership + capability check that does NOT block archived workspaces.
 * Needed for GET /api/workspaces/:id (read archived workspaces),
 * POST /api/workspaces/:id/archive (unarchive toggle) and
 * DELETE /api/workspaces/:id — requireWorkspace() rejects archived
 * workspaces for every capability except settings/billing.view, which
 * would make reading, unarchiving and deleting archived workspaces
 * impossible. Replicates requireWorkspace() semantics (403 for
 * non-members first, then 404 for missing workspace) minus the archived
 * gate. SHARED-FILE REQUEST: consider an `{ allowArchived?: boolean }`
 * option on requireWorkspace() in api-helpers so this can be removed.
 */
export async function requireWorkspaceAllowArchived(workspaceId: string, capability?: Capability) {
  const auth = await requireAuth()
  const role = auth.roleByWorkspace.get(workspaceId)
  if (!role) throw new HttpError(403, 'You do not have access to this workspace.', 'FORBIDDEN')
  if (capability) requireCapability(role, capability)
  const workspace = await db.workspace.findUnique({ where: { id: workspaceId } })
  if (!workspace) throw new HttpError(404, 'Workspace not found.', 'NOT_FOUND')
  return { auth, workspace, role }
}

// ---------------------------------------------------------------------------
// Workspace members with per-member task stats
// ---------------------------------------------------------------------------

export interface MemberTaskStats {
  assignedTasks: number
  openTasks: number
  completedTasks: number
  overdueTasks: number
}

/**
 * Per-member task counts via groupBy queries:
 * - assignedTasks: all tasks assigned to the user in the workspace
 * - openTasks: status in OPEN_STATUSES
 * - completedTasks: status DONE
 * - overdueTasks: dueDate < now and status not DONE/CANCELLED
 */
export async function memberTaskStats(workspaceId: string, userIds: string[]): Promise<Map<string, MemberTaskStats>> {
  const map = new Map<string, MemberTaskStats>()
  if (userIds.length === 0) return map
  for (const id of userIds) {
    map.set(id, { assignedTasks: 0, openTasks: 0, completedTasks: 0, overdueTasks: 0 })
  }

  const now = new Date()
  const base = { workspaceId, assigneeId: { in: userIds } }
  const [assigned, open, completed, overdue] = await Promise.all([
    db.task.groupBy({ by: ['assigneeId'], where: base, _count: { _all: true } }),
    db.task.groupBy({ by: ['assigneeId'], where: { ...base, status: { in: OPEN_STATUSES } }, _count: { _all: true } }),
    db.task.groupBy({ by: ['assigneeId'], where: { ...base, status: 'DONE' }, _count: { _all: true } }),
    db.task.groupBy({
      by: ['assigneeId'],
      where: { ...base, dueDate: { lt: now }, status: { notIn: ['DONE', 'CANCELLED'] } },
      _count: { _all: true },
    }),
  ])

  for (const row of assigned) {
    if (row.assigneeId) {
      const s = map.get(row.assigneeId)
      if (s) s.assignedTasks = row._count._all
    }
  }
  for (const row of open) {
    if (row.assigneeId) {
      const s = map.get(row.assigneeId)
      if (s) s.openTasks = row._count._all
    }
  }
  for (const row of completed) {
    if (row.assigneeId) {
      const s = map.get(row.assigneeId)
      if (s) s.completedTasks = row._count._all
    }
  }
  for (const row of overdue) {
    if (row.assigneeId) {
      const s = map.get(row.assigneeId)
      if (s) s.overdueTasks = row._count._all
    }
  }
  return map
}

type MemberRow = {
  id: string
  userId: string
  role: string
  createdAt: Date
  user: { id: string; name: string; email: string; avatarColor: string }
}

export function toMemberDTO(member: MemberRow, stats: MemberTaskStats, emailVisible: boolean): WorkspaceMemberDTO {
  return {
    id: member.id,
    userId: member.user.id,
    name: member.user.name,
    email: emailVisible ? member.user.email : '',
    avatarColor: member.user.avatarColor,
    role: member.role as Role,
    joinedAt: member.createdAt.toISOString(),
    assignedTasks: stats.assignedTasks,
    completedTasks: stats.completedTasks,
    openTasks: stats.openTasks,
    overdueTasks: stats.overdueTasks,
  }
}

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

type InvitationRow = {
  id: string
  email: string
  role: string
  status: string
  expiresAt: Date
  createdAt: Date
}

export function toInvitationDTO(invitation: InvitationRow, invitedByName: string): InvitationDTO {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role as Role,
    status: invitation.status as InvitationStatus,
    expiresAt: invitation.expiresAt.toISOString(),
    createdAt: invitation.createdAt.toISOString(),
    invitedBy: invitedByName,
  }
}

/** Fetch display names for invitation inviters in bulk. */
export async function inviterNameMap(inviterIds: string[]): Promise<Map<string, string>> {
  const map = new Map<string, string>()
  if (inviterIds.length === 0) return map
  const users = await db.user.findMany({
    where: { id: { in: inviterIds } },
    select: { id: true, name: true },
  })
  for (const u of users) map.set(u.id, u.name)
  return map
}

/** Email visibility for a workspace role (contract: cap member.view_details). */
export function canViewMemberEmails(role: Role): boolean {
  return can(role, 'member.view_details')
}
