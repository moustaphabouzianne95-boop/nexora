import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, parseBody, HttpError, requireAuth } from '@/lib/api-helpers'
import { hashPassword, verifyPassword } from '@/lib/auth'
import { changePasswordSchema } from '@/lib/validation'

export const runtime = 'nodejs'

/** POST /api/user/password — change own password (requires current password). */
export const POST = handler(async (req: NextRequest) => {
  const auth = await requireAuth()
  const { currentPassword, newPassword } = await parseBody(req, changePasswordSchema)

  if (!verifyPassword(currentPassword, auth.user.passwordHash)) {
    throw new HttpError(400, 'Your current password is incorrect.', 'INVALID_PASSWORD', {
      currentPassword: 'Incorrect password.',
    })
  }

  await db.user.update({
    where: { id: auth.user.id },
    data: { passwordHash: hashPassword(newPassword) },
  })

  return ok({ ok: true })
})
