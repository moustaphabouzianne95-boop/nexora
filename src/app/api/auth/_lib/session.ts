import 'server-only'

import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import { HttpError } from '@/lib/api-helpers'
import { toPublicUser } from '@/lib/auth'
import type { Role, SessionUser, WorkspaceSummary } from '@/types'

/**
 * Cookie that pins the user's active workspace across /api/auth/me refetches.
 * Set by POST /api/workspaces/switch after membership verification.
 */
export const WORKSPACE_COOKIE = 'nexora_ws'

async function pinnedWorkspaceId(userId: string): Promise<string | null> {
  try {
    const cookieStore = await cookies()
    const pinned = cookieStore.get(WORKSPACE_COOKIE)?.value
    if (!pinned) return null
    const member = await db.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId: pinned, userId } },
      select: { id: true },
    })
    return member ? pinned : null
  } catch {
    return null
  }
}

/**
 * Builds the canonical SessionUser payload for auth/workspace endpoints.
 *
 * SessionUser rules (binding contract):
 * - workspaces = the user's memberships ordered by joined (createdAt) ASC,
 *   each carrying memberCount / projectCount of the workspace.
 * - currentWorkspaceId = the workspace pinned via the `nexora_ws` cookie
 *   (set by POST /api/workspaces/switch), falling back to the most recent
 *   membership. Route handlers may override it explicitly.
 */
export async function buildSessionUser(userId: string, opts?: { currentWorkspaceId?: string | null }): Promise<SessionUser> {
  const user = await db.user.findUnique({ where: { id: userId } })
  if (!user) throw new HttpError(404, 'User not found.', 'NOT_FOUND')

  const memberships = await db.workspaceMember.findMany({
    where: { userId },
    orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    select: {
      role: true,
      workspace: {
        select: {
          id: true,
          name: true,
          slug: true,
          logoColor: true,
          _count: { select: { members: true, projects: true } },
        },
      },
    },
  })

  const workspaces: WorkspaceSummary[] = memberships.map((m) => ({
    id: m.workspace.id,
    name: m.workspace.name,
    slug: m.workspace.slug,
    logoColor: m.workspace.logoColor,
    role: m.role as Role,
    memberCount: m.workspace._count.members,
    projectCount: m.workspace._count.projects,
  }))

  let currentWorkspaceId: string | null
  if (opts?.currentWorkspaceId !== undefined) {
    currentWorkspaceId = opts.currentWorkspaceId
  } else {
    currentWorkspaceId = await pinnedWorkspaceId(userId)
  }
  if (!currentWorkspaceId) {
    currentWorkspaceId = workspaces.length > 0 ? workspaces[workspaces.length - 1].id : null
  }

  return { user: toPublicUser(user), workspaces, currentWorkspaceId }
}

/** Workspace summaries for the switcher (GET /api/workspaces). */
export async function listWorkspaceSummaries(userId: string): Promise<WorkspaceSummary[]> {
  const session = await buildSessionUser(userId)
  return session.workspaces
}
