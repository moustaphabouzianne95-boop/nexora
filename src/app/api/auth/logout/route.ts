import { handler, ok } from '@/lib/api-helpers'
import { destroySession } from '@/lib/auth'

export const runtime = 'nodejs'

/** POST /api/auth/logout — destroys the session and clears the cookie. */
export const POST = handler(async () => {
  await destroySession()
  return ok({ ok: true })
})
