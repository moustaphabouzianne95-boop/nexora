import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { ZodSchema } from 'zod'
import { db } from '@/lib/db'
import { getAuth, type AuthContext } from '@/lib/auth'
import type { Role } from '@/types'
import { can, type Capability } from '@/lib/permissions'

// ------------------------------------------------------------- responses

export function ok<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data as object, { status })
}

export function fail(message: string, status = 400, code?: string, details?: Record<string, string>): NextResponse {
  return NextResponse.json({ error: message, code, details }, { status })
}

export class HttpError extends Error {
  constructor(public status: number, message: string, public code?: string, public details?: Record<string, string>) {
    super(message)
  }
}

/**
 * Wraps a route handler with consistent error handling.
 * Never leaks stack traces or internal errors to the client.
 */
export function handler(fn: (req: NextRequest, ctx: { params: Promise<Record<string, string>> }) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: { params: Promise<Record<string, string>> }): Promise<NextResponse> => {
    try {
      return await fn(req, ctx)
    } catch (err) {
      if (err instanceof HttpError) {
        return fail(err.message, err.status, err.code, err.details)
      }
      console.error('[api:unhandled]', err)
      return fail('Something went wrong. Please try again.', 500, 'INTERNAL')
    }
  }
}

// ----------------------------------------------------------------- guards

export async function requireAuth(): Promise<AuthContext> {
  const auth = await getAuth()
  if (!auth) throw new HttpError(401, 'You must be signed in to do that.', 'UNAUTHENTICATED')
  return auth
}

export interface WorkspaceAccess {
  auth: AuthContext
  workspace: { id: string; name: string; slug: string; ownerId: string }
  role: Role
}

/** Verifies the user is a member of the workspace and has the given capability. */
export async function requireWorkspace(workspaceId: string, capability?: Capability): Promise<WorkspaceAccess> {
  const auth = await requireAuth()
  const role = auth.roleByWorkspace.get(workspaceId)
  if (!role) throw new HttpError(403, 'You do not have access to this workspace.', 'FORBIDDEN')
  const workspace = await db.workspace.findUnique({
    where: { id: workspaceId },
    select: { id: true, name: true, slug: true, ownerId: true, archivedAt: true },
  })
  if (!workspace) throw new HttpError(404, 'Workspace not found.', 'NOT_FOUND')
  if (workspace.archivedAt && capability !== 'workspace.settings.edit' && capability !== 'billing.view') {
    throw new HttpError(403, 'This workspace is archived.', 'WORKSPACE_ARCHIVED')
  }
  if (capability) {
    requireCapability(role, capability)
  }
  return { auth, workspace, role }
}

export function requireCapability(role: Role, capability: Capability): void {
  if (!can(role, capability)) {
    throw new HttpError(403, 'Your role does not allow this action.', 'FORBIDDEN_CAPABILITY')
  }
}

/** Loads a task with workspace verification; throws 404 (never leaks existence). */
export async function requireTask(taskId: string, capability?: Capability) {
  const task = await db.task.findUnique({
    where: { id: taskId },
    include: { project: { select: { name: true, workspaceId: true } } },
  })
  if (!task) throw new HttpError(404, 'Task not found.', 'NOT_FOUND')
  const access = await requireWorkspace(task.workspaceId, capability)
  return { task, ...access }
}

/** Loads a project with workspace verification. */
export async function requireProject(projectId: string, capability?: Capability) {
  const project = await db.project.findUnique({ where: { id: projectId } })
  if (!project) throw new HttpError(404, 'Project not found.', 'NOT_FOUND')
  const access = await requireWorkspace(project.workspaceId, capability)
  return { project, ...access }
}

// -------------------------------------------------------------- validation

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    throw new HttpError(400, 'Invalid request body.', 'INVALID_JSON')
  }
  const result = schema.safeParse(json)
  if (!result.success) {
    const details: Record<string, string> = {}
    for (const issue of result.error.issues) {
      const key = issue.path.join('.') || 'form'
      if (!details[key]) details[key] = issue.message
    }
    throw new HttpError(422, 'Please correct the highlighted fields.', 'VALIDATION', details)
  }
  return result.data
}

export function parseQuery<T>(req: NextRequest, schema: ZodSchema<T>): T {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries())
  const result = schema.safeParse(params)
  if (!result.success) {
    throw new HttpError(422, 'Invalid query parameters.', 'VALIDATION')
  }
  return result.data
}

// --------------------------------------------------------------- activity

export async function logActivity(input: {
  workspaceId: string
  actorId: string
  resourceType: 'WORKSPACE' | 'PROJECT' | 'TASK' | 'MEMBER' | 'SUBSCRIPTION' | 'LABEL' | 'MILESTONE'
  resourceId?: string | null
  action: string
  metadata?: Record<string, unknown>
}): Promise<void> {
  await db.activityLog.create({
    data: {
      workspaceId: input.workspaceId,
      actorId: input.actorId,
      resourceType: input.resourceType,
      resourceId: input.resourceId ?? null,
      action: input.action,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
    },
  })
}

export async function notify(input: {
  userId: string
  workspaceId?: string | null
  type: string
  title: string
  body?: string
  resourceType?: string
  resourceId?: string
}): Promise<void> {
  const prefs = await db.notificationPreference.findUnique({ where: { userId: input.userId } })
  const typeKey = input.type as keyof typeof TYPE_PREF_MAP
  const prefKey = TYPE_PREF_MAP[typeKey]
  if (prefs && prefKey && !prefs[prefKey]) return
  await db.notification.create({
    data: {
      userId: input.userId,
      workspaceId: input.workspaceId ?? null,
      type: input.type,
      title: input.title,
      body: input.body ?? null,
      resourceType: input.resourceType ?? null,
      resourceId: input.resourceId ?? null,
    },
  })
}

const TYPE_PREF_MAP: Record<string, 'taskAssigned' | 'taskMention' | 'comments' | 'dueSoon' | 'invitations' | 'billing'> = {
  TASK_ASSIGNED: 'taskAssigned',
  TASK_MENTION: 'taskMention',
  COMMENT_ADDED: 'comments',
  DUE_SOON: 'dueSoon',
  OVERDUE: 'dueSoon',
  INVITATION: 'invitations',
  BILLING: 'billing',
}

export function jsonSafe<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj))
}
