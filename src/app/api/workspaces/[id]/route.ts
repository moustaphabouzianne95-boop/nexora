import { NextRequest } from 'next/server'
import { db } from '@/lib/db'
import { handler, ok, parseBody, requireWorkspace, logActivity } from '@/lib/api-helpers'
import { workspaceUpdateSchema } from '@/lib/validation'
import { fetchWorkspaceDetail, requireWorkspaceAllowArchived } from '@/app/api/workspaces/_lib/helpers'

export const runtime = 'nodejs'

/** GET /api/workspaces/:id — WorkspaceDetail (any member, archived workspaces readable). */
export const GET = handler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params
  const { role } = await requireWorkspaceAllowArchived(id)
  const detail = await fetchWorkspaceDetail(id, role)
  return ok(detail)
})

/** PATCH /api/workspaces/:id — cap workspace.settings.edit. Returns WorkspaceDetail. */
export const PATCH = handler(async (req: NextRequest, ctx) => {
  const { id } = await ctx.params
  const { auth, role } = await requireWorkspace(id, 'workspace.settings.edit')
  const data = await parseBody(req, workspaceUpdateSchema)

  const changed: string[] = []
  const updateData = {
    ...(data.name !== undefined ? { name: data.name } : {}),
    ...(data.description !== undefined ? { description: data.description || null } : {}),
    ...(data.logoColor !== undefined ? { logoColor: data.logoColor } : {}),
    ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
  }
  for (const key of Object.keys(updateData)) changed.push(key)

  const updated = await db.workspace.update({ where: { id }, data: updateData })

  if (changed.length > 0) {
    await logActivity({
      workspaceId: id,
      actorId: auth.user.id,
      resourceType: 'WORKSPACE',
      resourceId: id,
      action: 'UPDATED',
      metadata: { fields: changed },
    })
  }

  const detail = await fetchWorkspaceDetail(updated.id, role)
  return ok(detail)
})

/** DELETE /api/workspaces/:id — OWNER only (cap workspace.delete). Cascades via schema FKs. */
export const DELETE = handler(async (_req: NextRequest, ctx) => {
  const { id } = await ctx.params
  await requireWorkspaceAllowArchived(id, 'workspace.delete')
  await db.workspace.delete({ where: { id } })
  return ok({ ok: true })
})
