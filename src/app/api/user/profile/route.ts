import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, parseBody, requireAuth } from '@/lib/api-helpers'
import { toPublicUser } from '@/lib/auth'
import { profileSchema } from '@/lib/validation'

export const runtime = 'nodejs'

/** PATCH /api/user/profile — updates the session user's own profile. */
export const PATCH = handler(async (req: NextRequest) => {
  const auth = await requireAuth()
  const data = await parseBody(req, profileSchema)

  const updated = await db.user.update({
    where: { id: auth.user.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.avatarColor !== undefined ? { avatarColor: data.avatarColor } : {}),
      ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
      ...(data.locale !== undefined ? { locale: data.locale } : {}),
      ...(data.themePref !== undefined ? { themePref: data.themePref } : {}),
    },
  })

  return ok(toPublicUser(updated))
})
