import { db } from '@/lib/db'
import { handler, ok, HttpError, parseBody, requireWorkspace, logActivity } from '@/lib/api-helpers'
import { labelCreateSchema } from '@/lib/validation'
import { assertFeature } from '@/lib/entitlements'
import type { LabelDTO } from '@/types'

function toLabelDTO(label: { id: string; name: string; color: string; description: string | null }): LabelDTO {
  return { id: label.id, name: label.name, color: label.color, description: label.description }
}

// ---------------------------------------------------------------------------
// GET /api/workspaces/:id/labels — any workspace member
// ---------------------------------------------------------------------------
export const GET = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  await requireWorkspace(id)
  const labels = await db.label.findMany({ where: { workspaceId: id }, orderBy: { name: 'asc' } })
  return ok({ labels: labels.map(toLabelDTO) })
})

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/labels — cap label.manage + plan feature customLabels
// ---------------------------------------------------------------------------
export const POST = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const { auth } = await requireWorkspace(id, 'label.manage')
  const data = await parseBody(req, labelCreateSchema)

  // FREE plan has no custom labels → 402 with upgrade message
  await assertFeature(id, 'customLabels')

  // workspaceId+name is unique → 409 on duplicate
  const dup = await db.label.findUnique({ where: { workspaceId_name: { workspaceId: id, name: data.name } } })
  if (dup) {
    throw new HttpError(409, 'A label with this name already exists in the workspace.', 'DUPLICATE_LABEL')
  }

  const label = await db.label.create({
    data: {
      workspaceId: id,
      name: data.name,
      color: data.color,
      description: data.description || null,
    },
  })

  await logActivity({
    workspaceId: id,
    actorId: auth.user.id,
    resourceType: 'LABEL',
    resourceId: label.id,
    action: 'CREATED',
    metadata: { name: label.name },
  })

  return ok(toLabelDTO(label), 201)
})
