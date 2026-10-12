import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { handler, ok, parseBody, HttpError, requireAuth } from '@/lib/api-helpers'
import { buildSessionUser, WORKSPACE_COOKIE } from '@/app/api/auth/_lib/session'

export const runtime = 'nodejs'

/**
 * NOTE: validation.ts has no switch-workspace schema yet; local zod schema
 * validated via parseBody. Suggested follow-up: move into validation.ts.
 */
const switchSchema = z.object({
  workspaceId: z.string().min(1),
})

/**
 * POST /api/workspaces/switch — must be a member of the target workspace.
 * Pins the choice in the `nexora_ws` cookie so /api/auth/me keeps returning
 * the same workspace, then returns the full SessionUser shape.
 */
export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth()
  const { workspaceId } = await parseBody(req, switchSchema)

  if (!auth.roleByWorkspace.has(workspaceId)) {
    throw new HttpError(403, 'You do not have access to this workspace.', 'FORBIDDEN')
  }

  const session = await buildSessionUser(auth.user.id, { currentWorkspaceId: workspaceId })
  const res = NextResponse.json(session, { status: 200 })
  res.cookies.set(WORKSPACE_COOKIE, workspaceId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
  })
  return res
})
