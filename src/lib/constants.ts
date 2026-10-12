import type { Plan, PlanEntitlements, Priority, ProjectStatus, Role, TaskStatus, PlanInfo, BillingInterval } from '@/types'

// ------------------------------------------------------------- Task status
export const TASK_STATUSES: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE', 'CANCELLED']
export const BOARD_COLUMNS: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW', 'DONE']
export const TASK_STATUS_LABEL: Record<TaskStatus, string> = {
  BACKLOG: 'Backlog',
  TODO: 'To Do',
  IN_PROGRESS: 'In Progress',
  IN_REVIEW: 'In Review',
  DONE: 'Done',
  CANCELLED: 'Cancelled',
}
export const TASK_STATUS_COLOR: Record<TaskStatus, string> = {
  BACKLOG: '#8b949e',
  TODO: '#6366f1',
  IN_PROGRESS: '#f59e0b',
  IN_REVIEW: '#8b5cf6',
  DONE: '#22c55e',
  CANCELLED: '#ef4444',
}
export const OPEN_STATUSES: TaskStatus[] = ['BACKLOG', 'TODO', 'IN_PROGRESS', 'IN_REVIEW']

// ----------------------------------------------------------------- Priority
export const PRIORITIES: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']
export const PRIORITY_LABEL: Record<Priority, string> = {
  LOW: 'Low',
  MEDIUM: 'Medium',
  HIGH: 'High',
  URGENT: 'Urgent',
}
export const PRIORITY_COLOR: Record<Priority, string> = {
  LOW: '#8b949e',
  MEDIUM: '#3b82f6',
  HIGH: '#f59e0b',
  URGENT: '#ef4444',
}

// ------------------------------------------------------------------ Project
export const PROJECT_STATUSES: ProjectStatus[] = ['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']
export const PROJECT_STATUS_LABEL: Record<ProjectStatus, string> = {
  PLANNING: 'Planning',
  ACTIVE: 'Active',
  ON_HOLD: 'On Hold',
  COMPLETED: 'Completed',
  ARCHIVED: 'Archived',
}
export const PROJECT_STATUS_COLOR: Record<ProjectStatus, string> = {
  PLANNING: '#8b5cf6',
  ACTIVE: '#22c55e',
  ON_HOLD: '#f59e0b',
  COMPLETED: '#3b82f6',
  ARCHIVED: '#8b949e',
}
export const PROJECT_COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4']
export const PROJECT_ICONS = ['folder', 'palette', 'smartphone', 'server', 'rocket', 'map', 'layout-dashboard', 'bar-chart', 'book-open', 'globe', 'shield', 'zap']

// -------------------------------------------------------------------- Roles
export const ROLES: Role[] = ['OWNER', 'ADMIN', 'PROJECT_MANAGER', 'MEMBER', 'VIEWER']
export const ROLE_LABEL: Record<Role, string> = {
  OWNER: 'Owner',
  ADMIN: 'Admin',
  PROJECT_MANAGER: 'Project Manager',
  MEMBER: 'Member',
  VIEWER: 'Viewer',
}
export const ROLE_DESCRIPTION: Record<Role, string> = {
  OWNER: 'Full workspace control including billing and ownership transfer.',
  ADMIN: 'Manages members, projects, and workspace settings.',
  PROJECT_MANAGER: 'Creates and manages projects, tasks, and milestones.',
  MEMBER: 'Works on tasks, comments, and uploads files.',
  VIEWER: 'Read-only access to authorized workspace content.',
}
export const ASSIGNABLE_ROLES: Role[] = ['ADMIN', 'PROJECT_MANAGER', 'MEMBER', 'VIEWER']

// -------------------------------------------------------------------- Plans
export const PLANS: PlanInfo[] = [
  {
    id: 'FREE',
    name: 'Free',
    description: 'For individuals getting started with organized work.',
    monthlyPriceCents: 0,
    annualPriceCents: 0,
    features: ['1 workspace', 'Up to 3 active members', 'Up to 3 active projects', 'List & Kanban board views', 'Basic notifications', 'Basic analytics'],
    limits: {
      maxMembers: 3,
      maxActiveProjects: 3,
      calendarView: false,
      timelineView: false,
      attachments: false,
      dependencies: false,
      customLabels: false,
      advancedAnalytics: false,
    },
  },
  {
    id: 'PRO',
    name: 'Pro',
    description: 'For growing teams that plan and ship together.',
    monthlyPriceCents: 1000,
    annualPriceCents: 9600,
    highlighted: true,
    features: [
      'Everything in Free',
      'Up to 15 active members',
      'Up to 25 active projects',
      'Calendar & timeline views',
      'Advanced analytics',
      'File attachments',
      'Task dependencies',
      'Custom labels',
      'Priority support',
    ],
    limits: {
      maxMembers: 15,
      maxActiveProjects: 25,
      calendarView: true,
      timelineView: true,
      attachments: true,
      dependencies: true,
      customLabels: true,
      advancedAnalytics: true,
    },
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    description: 'For organizations that need scale and control.',
    monthlyPriceCents: 2000,
    annualPriceCents: 19200,
    features: [
      'Everything in Pro',
      'Up to 50 active members',
      'Up to 100 active projects',
      'Advanced workspace controls',
      'Expanded reporting & audit history',
      'Enhanced team administration',
      'Highest limits',
      'Priority support',
    ],
    limits: {
      maxMembers: 50,
      maxActiveProjects: 100,
      calendarView: true,
      timelineView: true,
      attachments: true,
      dependencies: true,
      customLabels: true,
      advancedAnalytics: true,
    },
  },
]

export function planInfo(plan: Plan): PlanInfo {
  return PLANS.find((p) => p.id === plan) ?? PLANS[0]
}

export function entitlementsFor(plan: Plan): PlanEntitlements {
  return planInfo(plan).limits
}

export const DEFAULT_ENTITLEMENTS: PlanEntitlements = entitlementsFor('FREE')

export function formatPrice(cents: number, interval: BillingInterval = 'monthly'): string {
  if (cents === 0) return 'Free'
  if (interval === 'annual') {
    return `$${(cents / 100).toLocaleString('en-US')}/yr`
  }
  return `$${(cents / 100).toLocaleString('en-US')}/mo`
}

export function formatMoney(cents: number, currency = 'USD'): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(cents / 100)
}

// -------------------------------------------------------------- Attachments
export const MAX_ATTACHMENT_BYTES = 2 * 1024 * 1024 // 2MB in test-mode storage
export const ALLOWED_ATTACHMENT_TYPES = [
  'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/svg+xml',
  'application/pdf', 'text/plain', 'text/csv', 'text/markdown',
  'application/json',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/zip',
]

export const WORKSPACE_TYPES = ['PERSONAL', 'TEAM', 'STARTUP', 'AGENCY', 'ENTERPRISE'] as const
export const TEAM_SIZES = ['JUST_ME', '1_10', '11_50', '51_200', '200_PLUS'] as const
export const TEAM_SIZE_LABEL: Record<string, string> = {
  JUST_ME: 'Just me',
  '1_10': '1–10 people',
  '11_50': '11–50 people',
  '51_200': '51–200 people',
  '200_PLUS': '200+ people',
}
export const WORKSPACE_TYPE_LABEL: Record<string, string> = {
  PERSONAL: 'Personal',
  TEAM: 'Team',
  STARTUP: 'Startup',
  AGENCY: 'Agency',
  ENTERPRISE: 'Enterprise',
}

export const TIMEZONES = [
  'UTC', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles',
  'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'Africa/Casablanca', 'Africa/Cairo',
  'Asia/Dubai', 'Asia/Riyadh', 'Asia/Tokyo', 'Asia/Singapore', 'Australia/Sydney',
]

export const APP_NAME = 'NEXORA'
export const APP_TAGLINE = 'Plan smarter. Build together. Deliver better.'
