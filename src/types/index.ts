// NEXORA — Shared domain types (client & server safe)

export type Role = 'OWNER' | 'ADMIN' | 'PROJECT_MANAGER' | 'MEMBER' | 'VIEWER'
export type Plan = 'FREE' | 'PRO' | 'BUSINESS'
export type SubscriptionStatus = 'TRIALING' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'INCOMPLETE'
export type BillingInterval = 'monthly' | 'annual'

export type TaskStatus = 'BACKLOG' | 'TODO' | 'IN_PROGRESS' | 'IN_REVIEW' | 'DONE' | 'CANCELLED'
export type Priority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT'
export type ProjectStatus = 'PLANNING' | 'ACTIVE' | 'ON_HOLD' | 'COMPLETED' | 'ARCHIVED'
export type InvitationStatus = 'PENDING' | 'ACCEPTED' | 'EXPIRED' | 'REVOKED'

// ---------------------------------------------------------------- Entities

export interface PublicUser {
  id: string
  name: string
  email: string
  avatarColor: string
  timezone: string
  locale: string
  themePref: 'LIGHT' | 'DARK' | 'SYSTEM'
  status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED'
  createdAt: string
}

export interface SessionUser {
  user: PublicUser
  workspaces: WorkspaceSummary[]
  currentWorkspaceId: string | null
}

export interface WorkspaceSummary {
  id: string
  name: string
  slug: string
  logoColor: string
  role: Role
  memberCount?: number
  projectCount?: number
}

export interface WorkspaceDetail {
  id: string
  name: string
  slug: string
  description: string | null
  logoColor: string
  type: string
  teamSize: string
  timezone: string
  ownerId: string
  archivedAt: string | null
  createdAt: string
  myRole: Role
  memberCount: number
  projectCount: number
}

export interface WorkspaceMemberDTO {
  id: string
  userId: string
  name: string
  email: string
  avatarColor: string
  role: Role
  joinedAt: string
  assignedTasks: number
  completedTasks: number
  openTasks: number
  overdueTasks: number
}

export interface InvitationDTO {
  id: string
  email: string
  role: Role
  status: InvitationStatus
  expiresAt: string
  createdAt: string
  invitedBy: string
}

export interface ProjectDTO {
  id: string
  workspaceId: string
  name: string
  slug: string
  description: string | null
  color: string
  icon: string
  ownerId: string
  ownerName: string
  status: ProjectStatus
  priority: Priority
  startDate: string | null
  dueDate: string | null
  visibility: 'WORKSPACE' | 'PRIVATE'
  archivedAt: string | null
  createdAt: string
  updatedAt: string
  taskCount: number
  completedCount: number
  memberCount: number
  progress: number
}

export interface ProjectMemberDTO {
  id: string
  userId: string
  name: string
  email: string
  avatarColor: string
  role: 'LEAD' | 'CONTRIBUTOR' | 'VIEWER'
}

export interface MilestoneDTO {
  id: string
  projectId: string
  name: string
  description: string | null
  dueDate: string | null
  status: 'OPEN' | 'COMPLETED'
  taskCount: number
  completedCount: number
}

export interface LabelDTO {
  id: string
  name: string
  color: string
  description: string | null
}

export interface TaskDTO {
  id: string
  workspaceId: string
  projectId: string
  projectName: string
  projectColor: string
  title: string
  description: string | null
  status: TaskStatus
  priority: Priority
  assignee: { id: string; name: string; avatarColor: string } | null
  creator: { id: string; name: string; avatarColor: string }
  startDate: string | null
  dueDate: string | null
  estimatedHours: number | null
  position: number
  parentTaskId: string | null
  milestoneId: string | null
  milestoneName: string | null
  completedAt: string | null
  createdAt: string
  updatedAt: string
  commentCount: number
  attachmentCount: number
  subtaskCount: number
  subtaskDoneCount: number
  labels: LabelDTO[]
  blockedByCount: number
  blockedByOpenCount: number
}

export interface CommentDTO {
  id: string
  taskId: string
  author: { id: string; name: string; avatarColor: string }
  body: string
  createdAt: string
  updatedAt: string
}

export interface AttachmentDTO {
  id: string
  taskId: string
  filename: string
  mimeType: string
  size: number
  uploaderName: string
  createdAt: string
}

export interface ActivityDTO {
  id: string
  actorName: string
  actorColor: string
  resourceType: string
  resourceId: string | null
  action: string
  metadata: Record<string, unknown> | null
  createdAt: string
}

export interface NotificationDTO {
  id: string
  type: string
  title: string
  body: string | null
  workspaceId: string | null
  workspaceName: string | null
  resourceType: string | null
  resourceId: string | null
  read: boolean
  createdAt: string
}

export interface SubscriptionDTO {
  plan: Plan
  status: SubscriptionStatus
  interval: BillingInterval
  provider: string
  cancelAtPeriodEnd: boolean
  currentPeriodStart: string | null
  currentPeriodEnd: string | null
  seats: number
  testMode: boolean
  entitlements: PlanEntitlements
  usage: { members: number; activeProjects: number }
}

export interface PlanEntitlements {
  maxMembers: number | null
  maxActiveProjects: number | null
  calendarView: boolean
  timelineView: boolean
  attachments: boolean
  dependencies: boolean
  customLabels: boolean
  advancedAnalytics: boolean
}

export interface InvoiceDTO {
  id: string
  number: string
  amountCents: number
  currency: string
  status: string
  plan: string
  interval: string
  periodStart: string
  periodEnd: string
  testMode: boolean
  createdAt: string
}

export interface PlanInfo {
  id: Plan
  name: string
  description: string
  monthlyPriceCents: number
  annualPriceCents: number
  features: string[]
  limits: PlanEntitlements
  highlighted?: boolean
}

// ------------------------------------------------------------ API envelope

export interface ApiError {
  error: string
  code?: string
  details?: Record<string, string>
}

// ------------------------------------------------------------- Analytics

export interface DashboardStats {
  activeProjects: number
  openTasks: number
  completedTasks: number
  overdueTasks: number
  myOpenTasks: number
  completedThisWeek: number
  upcomingDeadlines: { id: string; title: string; dueDate: string; projectName: string; projectColor: string }[]
  workload: { userId: string; name: string; avatarColor: string; openTasks: number }[]
  recentActivity: ActivityDTO[]
}

export interface TimeseriesPoint {
  date: string
  created: number
  completed: number
}

export interface AnalyticsReport {
  range: string
  tasksCreatedOverTime: TimeseriesPoint[]
  tasksCompletedOverTime: TimeseriesPoint[]
  byStatus: { status: TaskStatus; count: number }[]
  byPriority: { priority: Priority; count: number }[]
  workloadByMember: { userId: string; name: string; avatarColor: string; open: number; completed: number }[]
  projectProgress: { id: string; name: string; color: string; progress: number; total: number; completed: number }[]
  completionRate: number
  overdueRate: number
  avgCompletionHours: number | null
  onTimeRate: number | null
  memberAnalytics: {
    userId: string
    name: string
    avatarColor: string
    assigned: number
    completed: number
    overdue: number
  }[]
}

export interface SearchResult {
  projects: ProjectDTO[]
  tasks: TaskDTO[]
  members: { id: string; name: string; email: string; avatarColor: string }[]
}
