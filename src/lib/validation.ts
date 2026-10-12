import { z } from 'zod'
import { PRIORITIES, TASK_STATUSES, PROJECT_STATUSES, ROLES, ASSIGNABLE_ROLES, WORKSPACE_TYPES, TEAM_SIZES, ALLOWED_ATTACHMENT_TYPES } from '@/lib/constants'

const password = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .max(128)
  .regex(/[A-Za-z]/, 'Must contain a letter')
  .regex(/[0-9]/, 'Must contain a number')

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name is required').max(80),
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password,
})

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  password: z.string().min(1, 'Password is required'),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
})

export const resetPasswordSchema = z.object({
  token: z.string().min(10),
  password,
})

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  timezone: z.string().max(60).optional(),
  locale: z.enum(['en', 'fr', 'ar']).optional(),
  themePref: z.enum(['LIGHT', 'DARK', 'SYSTEM']).optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: password,
})

export const workspaceCreateSchema = z.object({
  name: z.string().trim().min(2, 'Workspace name is required').max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .min(2)
    .max(40)
    .regex(/^[a-z0-9-]+$/, 'Lowercase letters, numbers and dashes only'),
  type: z.enum(WORKSPACE_TYPES).default('TEAM'),
  teamSize: z.enum(TEAM_SIZES).default('1_10'),
  description: z.string().trim().max(500).optional().or(z.literal('')),
})

export const workspaceUpdateSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  description: z.string().trim().max(500).optional().or(z.literal('')),
  logoColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  timezone: z.string().max(60).optional(),
})

export const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email('Enter a valid email'),
  role: z.enum(ASSIGNABLE_ROLES).default('MEMBER'),
})

export const roleChangeSchema = z.object({
  role: z.enum(ASSIGNABLE_ROLES),
})

export const projectCreateSchema = z.object({
  name: z.string().trim().min(2, 'Project name is required').max(80),
  description: z.string().trim().max(2000).optional().or(z.literal('')),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  icon: z.string().max(40).default('folder'),
  status: z.enum(PROJECT_STATUSES).default('ACTIVE'),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  visibility: z.enum(['WORKSPACE', 'PRIVATE']).default('WORKSPACE'),
  memberIds: z.array(z.string()).max(50).optional(),
})

export const projectUpdateSchema = projectCreateSchema.partial()

export const taskCreateSchema = z.object({
  projectId: z.string().min(1, 'Project is required'),
  title: z.string().trim().min(1, 'Title is required').max(200),
  description: z.string().max(5000).optional().or(z.literal('')),
  status: z.enum(TASK_STATUSES).default('TODO'),
  priority: z.enum(PRIORITIES).default('MEDIUM'),
  assigneeId: z.string().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().min(0).max(1000).nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).max(10).optional(),
  position: z.number().optional(),
})

export const taskUpdateSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: z.string().max(5000).nullable().optional(),
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(PRIORITIES).optional(),
  assigneeId: z.string().nullable().optional(),
  startDate: z.string().datetime().nullable().optional(),
  dueDate: z.string().datetime().nullable().optional(),
  estimatedHours: z.number().min(0).max(1000).nullable().optional(),
  milestoneId: z.string().nullable().optional(),
  parentTaskId: z.string().nullable().optional(),
  labelIds: z.array(z.string()).max(10).optional(),
  position: z.number().optional(),
})

export const reorderSchema = z.object({
  taskId: z.string().min(1),
  status: z.enum(TASK_STATUSES),
  position: z.number(),
})

export const commentCreateSchema = z.object({
  body: z.string().trim().min(1, 'Comment cannot be empty').max(2000),
})

export const labelCreateSchema = z.object({
  name: z.string().trim().min(1).max(40),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).default('#6366f1'),
  description: z.string().max(200).optional().or(z.literal('')),
})

export const milestoneCreateSchema = z.object({
  name: z.string().trim().min(1).max(80),
  description: z.string().max(500).optional().or(z.literal('')),
  dueDate: z.string().datetime().nullable().optional(),
  status: z.enum(['OPEN', 'COMPLETED']).default('OPEN'),
})

export const dependencyCreateSchema = z.object({
  blockerTaskId: z.string().min(1),
  blockedTaskId: z.string().min(1),
})

export const attachmentCreateSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mimeType: z.string().refine((t) => ALLOWED_ATTACHMENT_TYPES.includes(t), 'File type not allowed'),
  size: z.number().int().min(1),
  data: z.string().min(1), // base64
})

export const bulkTaskSchema = z.object({
  taskIds: z.array(z.string()).min(1).max(100),
  action: z.enum(['status', 'priority', 'assignee', 'delete']),
  value: z.string().nullable().optional(),
})

export const billingChangeSchema = z.object({
  plan: z.enum(['FREE', 'PRO', 'BUSINESS']),
  interval: z.enum(['monthly', 'annual']).default('monthly'),
})

export const analyticsQuerySchema = z.object({
  range: z.enum(['7d', '30d', '90d', 'custom']).default('30d'),
  from: z.string().optional(),
  to: z.string().optional(),
})

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(100),
})

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40)
}
