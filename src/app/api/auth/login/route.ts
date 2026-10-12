import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, parseBody, HttpError } from '@/lib/api-helpers'
import { verifyPassword, createSession } from '@/lib/auth'
import { loginSchema } from '@/lib/validation'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { buildSessionUser } from '@/app/api/auth/_lib/session'

export const runtime = 'nodejs'

/** POST /api/auth/login — 10/15min per IP+email. Generic error (no user enumeration). */
export const POST = handler(async (req: NextRequest) => {
  const data = await parseBody(req, loginSchema)

  // Rate limit keyed on IP + email (email is already lowercased by the schema).
  const ip = clientIp(req)
  if (!rateLimit(`login:${ip}:${data.email}`, 10, 15 * 60 * 1000)) {
    throw new HttpError(429, 'Too many sign-in attempts. Please try again in a few minutes.', 'RATE_LIMITED')
  }

  const user = await db.user.findUnique({ where: { email: data.email } })
  if (!user || !verifyPassword(data.password, user.passwordHash) || user.status !== 'ACTIVE') {
    // Same generic message whether the account exists or not.
    throw new HttpError(401, 'Invalid email or password.', 'INVALID_CREDENTIALS')
  }

  await createSession(user.id, req.headers.get('user-agent') ?? undefined)

  const session = await buildSessionUser(user.id)
  return ok(session)
})
