import type { Role, Plan, ProjectStatus } from '@/types'

/**
 * Central permission matrix — shared between client (UI affordances)
 * and server (actual enforcement). The server ALWAYS re-checks.
 */
export type Capability =
  | 'workspace.settings.edit'
  | 'workspace.archive'
  | 'workspace.delete'
  | 'workspace.transfer_ownership'
  | 'billing.manage'
  | 'billing.view'
  | 'member.invite'
  | 'member.role_change'
  | 'member.remove'
  | 'member.view_details'
  | 'project.create'
  | 'project.edit'
  | 'project.archive'
  | 'project.delete'
  | 'task.create'
  | 'task.edit_any'
  | 'task.edit_assigned'
  | 'task.comment'
  | 'task.attach'
  | 'label.manage'
  | 'milestone.manage'
  | 'analytics.view_workspace'
  | 'analytics.advanced'

const MATRIX: Record<Role, Capability[]> = {
  OWNER: [
    'workspace.settings.edit', 'workspace.archive', 'workspace.delete', 'workspace.transfer_ownership',
    'billing.manage', 'billing.view',
    'member.invite', 'member.role_change', 'member.remove', 'member.view_details',
    'project.create', 'project.edit', 'project.archive', 'project.delete',
    'task.create', 'task.edit_any', 'task.comment', 'task.attach',
    'label.manage', 'milestone.manage',
    'analytics.view_workspace', 'analytics.advanced',
  ],
  ADMIN: [
    'workspace.settings.edit',
    'billing.view',
    'member.invite', 'member.role_change', 'member.remove', 'member.view_details',
    'project.create', 'project.edit', 'project.archive', 'project.delete',
    'task.create', 'task.edit_any', 'task.comment', 'task.attach',
    'label.manage', 'milestone.manage',
    'analytics.view_workspace', 'analytics.advanced',
  ],
  PROJECT_MANAGER: [
    'member.view_details', 'billing.view',
    'project.create', 'project.edit', 'project.archive',
    'task.create', 'task.edit_any', 'task.comment', 'task.attach',
    'label.manage', 'milestone.manage',
    'analytics.view_workspace', 'analytics.advanced',
  ],
  MEMBER: [
    'member.view_details',
    'task.create', 'task.edit_assigned', 'task.comment', 'task.attach',
    'milestone.manage',
  ],
  VIEWER: [],
}

/** Server & client capability check. */
export function can(role: Role | undefined | null, capability: Capability): boolean {
  if (!role) return false
  if (role === 'OWNER') return true
  return MATRIX[role]?.includes(capability) ?? false
}

/** MEMBER may only edit tasks they created or are assigned to. */
export function canEditTask(role: Role | undefined | null, task: { creatorId: string; assigneeId: string | null }, userId: string): boolean {
  if (!role) return false
  if (can(role, 'task.edit_any')) return true
  if (can(role, 'task.edit_assigned')) {
    return task.creatorId === userId || task.assigneeId === userId
  }
  return false
}

/** Roles allowed to be granted by the acting role. OWNER role only transferable via ownership transfer. */
export function grantableRoles(role: Role): Role[] {
  if (role === 'OWNER' || role === 'ADMIN') return ['ADMIN', 'PROJECT_MANAGER', 'MEMBER', 'VIEWER']
  return []
}

/** Is the target role change allowed (prevents self-promotion and escalation)? */
export function canChangeRole(actorRole: Role, targetCurrentRole: Role, newRole: Role): boolean {
  if (actorRole !== 'OWNER' && actorRole !== 'ADMIN') return false
  if (targetCurrentRole === 'OWNER') return false // owner handled via transfer
  if (newRole === 'OWNER') return false
  if (actorRole === 'ADMIN' && targetCurrentRole === 'ADMIN' && newRole !== 'ADMIN') {
    // admins may not demote other admins
    return false
  }
  return grantableRoles(actorRole).includes(newRole)
}

export function activeProjectStatuses(): ProjectStatus[] {
  return ['PLANNING', 'ACTIVE', 'ON_HOLD']
}

/** Plan gating used by UI + server entitlement service. */
export interface PlanGate {
  calendarView: boolean
  timelineView: boolean
  attachments: boolean
  dependencies: boolean
  customLabels: boolean
  advancedAnalytics: boolean
  maxMembers: number | null
  maxActiveProjects: number | null
}

export function planGate(plan: Plan): PlanGate {
  const gates: Record<Plan, PlanGate> = {
    FREE: { calendarView: false, timelineView: false, attachments: false, dependencies: false, customLabels: false, advancedAnalytics: false, maxMembers: 3, maxActiveProjects: 3 },
    PRO: { calendarView: true, timelineView: true, attachments: true, dependencies: true, customLabels: true, advancedAnalytics: true, maxMembers: 15, maxActiveProjects: 25 },
    BUSINESS: { calendarView: true, timelineView: true, attachments: true, dependencies: true, customLabels: true, advancedAnalytics: true, maxMembers: 50, maxActiveProjects: 100 },
  }
  return gates[plan] ?? gates.FREE
}
