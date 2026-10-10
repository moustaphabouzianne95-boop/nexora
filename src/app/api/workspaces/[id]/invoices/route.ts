import { db } from '@/lib/db'
import { handler, ok, requireWorkspace } from '@/lib/api-helpers'
import { toInvoiceDTO } from '../../../billing/_lib'

// ---------------------------------------------------------------------------
// GET /api/workspaces/:id/invoices — cap billing.view, newest first
// ---------------------------------------------------------------------------
export const GET = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  await requireWorkspace(id, 'billing.view')

  const invoices = await db.invoice.findMany({
    where: { workspaceId: id },
    orderBy: { createdAt: 'desc' },
    take: 100,
  })

  return ok({ invoices: invoices.map(toInvoiceDTO) })
})
