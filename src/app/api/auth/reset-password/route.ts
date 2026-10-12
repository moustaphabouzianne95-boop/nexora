import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, parseBody, HttpError } from '@/lib/api-helpers'
import { consumePasswordResetToken, hashPassword } from '@/lib/auth'
import { resetPasswordSchema } from '@/lib/validation'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/** POST /api/auth/reset-password — consumes a single-use token, rotates the password, invalidates sessions. */
export const POST = handler(async (req: NextRequest) => {
  const ip = clientIp(req)
  if (!rateLimit(`reset:${ip}`, 10, 60 * 60 * 1000)) {
    throw new HttpError(429, 'Too many attempts. Please try again later.', 'RATE_LIMITED')
  }

  const { token, password } = await parseBody(req, resetPasswordSchema)

  const userId = await consumePasswordResetToken(token)
  if (!userId) {
    throw new HttpError(400, 'This password reset link is invalid or has expired.', 'INVALID_TOKEN')
  }

  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(password) } }),
    // Force re-login everywhere after a password reset (existing session tokens die).
    db.session.deleteMany({ where: { userId } }),
  ])

  return ok({ ok: true })
})
