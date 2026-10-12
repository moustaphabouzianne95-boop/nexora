import { handler, ok } from '@/lib/api-helpers'
import { getAuth } from '@/lib/auth'
import { buildSessionUser } from '@/app/api/auth/_lib/session'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * GET /api/auth/me — SessionUser when signed in.
 * Signed out → 200 with `null` body (client treats null as signed out; never 401 here).
 */
export const GET = handler(async () => {
  const auth = await getAuth()
  if (!auth) return ok(null)
  const session = await buildSessionUser(auth.user.id)
  return ok(session)
})
