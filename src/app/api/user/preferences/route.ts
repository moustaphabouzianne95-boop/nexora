import { NextRequest } from 'next/server'
import { z } from 'zod'
import { handler, ok, parseBody, requireAuth } from '@/lib/api-helpers'
import { db } from '@/lib/db'

export const runtime = 'nodejs'

/**
 * NOTE: validation.ts has no notification-preference schema yet, so a local
 * zod schema is used here (validated through parseBody like everywhere else).
 * Suggested follow-up: move this schema into src/lib/validation.ts.
 */
const preferencesUpdateSchema = z.object({
  taskAssigned: z.boolean().optional(),
  taskMention: z.boolean().optional(),
  comments: z.boolean().optional(),
  dueSoon: z.boolean().optional(),
  invitations: z.boolean().optional(),
  billing: z.boolean().optional(),
})

type PreferenceRow = {
  userId: string
  taskAssigned: boolean
  taskMention: boolean
  comments: boolean
  dueSoon: boolean
  invitations: boolean
  billing: boolean
}

function prefsToDTO(prefs: PreferenceRow | null, userId: string) {
  return {
    userId,
    taskAssigned: prefs?.taskAssigned ?? true,
    taskMention: prefs?.taskMention ?? true,
    comments: prefs?.comments ?? true,
    dueSoon: prefs?.dueSoon ?? true,
    invitations: prefs?.invitations ?? true,
    billing: prefs?.billing ?? true,
  }
}

/** GET /api/user/preferences — defaults to all-on when the user has no row yet. */
export const GET = handler(async () => {
  const auth = await requireAuth()
  const prefs = await db.notificationPreference.findUnique({ where: { userId: auth.user.id } })
  return ok(prefsToDTO(prefs, auth.user.id))
})

/** PATCH /api/user/preferences — partial update, upserts the row. */
export const PATCH = handler(async (req: NextRequest) => {
  const auth = await requireAuth()
  const data = await parseBody(req, preferencesUpdateSchema)

  const prefs = await db.notificationPreference.upsert({
    where: { userId: auth.user.id },
    update: data,
    create: { userId: auth.user.id, ...data },
  })

  return ok(prefsToDTO(prefs, auth.user.id))
})
