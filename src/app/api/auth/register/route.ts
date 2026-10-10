import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, parseBody, HttpError } from '@/lib/api-helpers'
import { hashPassword, createSession } from '@/lib/auth'
import { registerSchema } from '@/lib/validation'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { PROJECT_COLORS } from '@/lib/constants'
import { buildSessionUser } from '@/app/api/auth/_lib/session'

export const runtime = 'nodejs'

/** POST /api/auth/register — 10/hour per IP. Returns 201 SessionUser. */
export const POST = handler(async (req: NextRequest) => {
  const ip = clientIp(req)
  if (!rateLimit(`register:${ip}`, 10, 60 * 60 * 1000)) {
    throw new HttpError(429, 'Too many registration attempts. Please try again later.', 'RATE_LIMITED')
  }

  const data = await parseBody(req, registerSchema)

  const existing = await db.user.findUnique({ where: { email: data.email } })
  if (existing) {
    throw new HttpError(409, 'An account with this email already exists.', 'EMAIL_TAKEN', {
      email: 'This email is already registered.',
    })
  }

  const avatarColor = PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)]

  const user = await db.user.create({
    data: {
      name: data.name,
      email: data.email,
      passwordHash: hashPassword(data.password),
      avatarColor,
      themePref: 'SYSTEM',
    },
  })

  // Default notification preferences (all on) so the preferences view has a row.
  await db.notificationPreference.create({ data: { userId: user.id } })

  // Registering signs the user in (contract: 201 SessionUser). No workspace is
  // created here — first-run goes through onboarding (per contract).
  await createSession(user.id, req.headers.get('user-agent') ?? undefined)

  const session = await buildSessionUser(user.id)
  return ok(session, 201)
})
