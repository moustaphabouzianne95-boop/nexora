import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, parseBody, HttpError, requireAuth, logActivity } from '@/lib/api-helpers'
import { workspaceCreateSchema } from '@/lib/validation'
import { PROJECT_COLORS } from '@/lib/constants'
import { buildSessionUser } from '@/app/api/auth/_lib/session'
import { workspaceRowToDetail } from '@/app/api/workspaces/_lib/helpers'

export const runtime = 'nodejs'

/** GET /api/workspaces — summaries for the switcher (must be signed in). */
export const GET = handler(async () => {
  const auth = await requireAuth()
  const session = await buildSessionUser(auth.user.id)
  return ok({ workspaces: session.workspaces })
})

/**
 * POST /api/workspaces — creates workspace + OWNER membership + FREE
 * subscription in one transaction, logs activity, and auto-selects the new
 * workspace as current (currentWorkspaceId = latest joined membership).
 *
 * Response: { workspace: WorkspaceDetail, session: SessionUser }.
 * `workspace` matches the binding API contract; `session` is the full
 * SessionUser so onboarding can seed the client session cache without a
 * second request (see worklog note on this superset shape).
 */
export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth()
  const data = await parseBody(req, workspaceCreateSchema)

  const slug = data.slug
  const existing = await db.workspace.findUnique({ where: { slug } })
  if (existing) {
    throw new HttpError(409, 'That workspace URL is taken.', 'SLUG_TAKEN', {
      slug: 'That workspace URL is taken.',
    })
  }

  const logoColor = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]

  let workspace
  try {
    workspace = await db.$transaction(async (tx) => {
      const ws = await tx.workspace.create({
        data: {
          name: data.name,
          slug,
          description: data.description ? data.description : null,
          logoColor,
          type: data.type,
          teamSize: data.teamSize,
          ownerId: auth.user.id,
        },
      })
      // Membership row is created right after the workspace so its createdAt
      // is the most recent → auto-selected as current workspace on /api/auth/me.
      await tx.workspaceMember.create({
        data: { workspaceId: ws.id, userId: auth.user.id, role: 'OWNER' },
      })
      await tx.subscription.create({
        data: { workspaceId: ws.id, plan: 'FREE', status: 'ACTIVE' },
      })
      return ws
    })
  } catch (err) {
    // Race on slug uniqueness → friendly 409 instead of a 500.
    if (typeof err === 'object' && err !== null && 'code' in err && (err as { code?: string }).code === 'P2002') {
      throw new HttpError(409, 'That workspace URL is taken.', 'SLUG_TAKEN', {
        slug: 'That workspace URL is taken.',
      })
    }
    throw err
  }

  await logActivity({
    workspaceId: workspace.id,
    actorId: auth.user.id,
    resourceType: 'WORKSPACE',
    resourceId: workspace.id,
    action: 'CREATED',
    metadata: { name: workspace.name, type: workspace.type },
  })

  const detail = workspaceRowToDetail(
    { ...workspace, _count: { members: 1, projects: 0 } },
    'OWNER'
  )
  const session = await buildSessionUser(auth.user.id)

  return ok({ workspace: detail, session }, 201)
})
