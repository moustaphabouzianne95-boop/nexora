import { db } from '@/lib/db'
import { handler, ok, HttpError, parseBody, requireWorkspace, logActivity } from '@/lib/api-helpers'
import { labelCreateSchema } from '@/lib/validation'
import type { LabelDTO } from '@/types'

function toLabelDTO(label: { id: string; name: string; color: string; description: string | null }): LabelDTO {
  return { id: label.id, name: label.name, color: label.color, description: label.description }
}

const labelUpdateSchema = labelCreateSchema.partial()

// ---------------------------------------------------------------------------
// PATCH /api/labels/:id — cap label.manage (workspace derived from the label)
// ---------------------------------------------------------------------------
export const PATCH = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const label = await db.label.findUnique({ where: { id } })
  if (!label) throw new HttpError(404, 'Label not found.', 'NOT_FOUND')

  const { auth } = await requireWorkspace(label.workspaceId, 'label.manage')
  const data = await parseBody(req, labelUpdateSchema)

  if (data.name !== undefined && data.name !== label.name) {
    const dup = await db.label.findUnique({
      where: { workspaceId_name: { workspaceId: label.workspaceId, name: data.name } },
    })
    if (dup) throw new HttpError(409, 'A label with this name already exists in the workspace.', 'DUPLICATE_LABEL')
  }

  const updated = await db.label.update({
    where: { id: label.id },
    data: {
      ...(data.name !== undefined ? { name: data.name } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.description !== undefined ? { description: data.description || null } : {}),
    },
  })

  await logActivity({
    workspaceId: label.workspaceId,
    actorId: auth.user.id,
    resourceType: 'LABEL',
    resourceId: label.id,
    action: 'UPDATED',
    metadata: { name: updated.name, fields: Object.keys(data) },
  })

  return ok(toLabelDTO(updated))
})

// ---------------------------------------------------------------------------
// DELETE /api/labels/:id — cap label.manage; TaskLabel rows detach via cascade
// ---------------------------------------------------------------------------
export const DELETE = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  const label = await db.label.findUnique({ where: { id } })
  if (!label) throw new HttpError(404, 'Label not found.', 'NOT_FOUND')

  const { auth } = await requireWorkspace(label.workspaceId, 'label.manage')

  await db.label.delete({ where: { id: label.id } }) // cascades TaskLabel detach

  await logActivity({
    workspaceId: label.workspaceId,
    actorId: auth.user.id,
    resourceType: 'LABEL',
    resourceId: null,
    action: 'DELETED',
    metadata: { name: label.name },
  })

  return ok({ ok: true })
})
