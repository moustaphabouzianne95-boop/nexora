import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, parseBody, HttpError } from '@/lib/api-helpers'
import { createPasswordResetToken } from '@/lib/auth'
import { forgotPasswordSchema } from '@/lib/validation'
import { rateLimit, clientIp } from '@/lib/rate-limit'

export const runtime = 'nodejs'

/**
 * POST /api/auth/forgot-password — 5/hour per IP.
 * ALWAYS returns {ok:true} (no user enumeration).
 * Dev mode only: includes `devToken` so the demo reset flow works without
 * an email provider. Tokens are never exposed when NODE_ENV==='production'.
 */
export const POST = handler(async (req: NextRequest) => {
  const ip = clientIp(req)
  if (!rateLimit(`forgot:${ip}`, 5, 60 * 60 * 1000)) {
    throw new HttpError(429, 'Too many password reset requests. Please try again later.', 'RATE_LIMITED')
  }

  const { email } = await parseBody(req, forgotPasswordSchema)

  const user = await db.user.findUnique({ where: { email } })
  let devToken: string | undefined
  if (user) {
    const token = await createPasswordResetToken(user.id)
    if (process.env.NODE_ENV !== 'production') {
      devToken = token
    }
  }

  // Always the same response shape for existing and unknown emails.
  return ok({ ok: true, ...(devToken ? { devToken } : {}) })
})
