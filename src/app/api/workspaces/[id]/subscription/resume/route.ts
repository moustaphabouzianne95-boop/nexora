import { handler, ok, requireWorkspace, logActivity } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { buildSubscriptionDTO } from '../../../../billing/_lib'

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/subscription/resume — cap billing.manage.
// TEST MODE: returns a cancelled subscription to ACTIVE.
// ---------------------------------------------------------------------------
export const POST = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  const { auth } = await requireWorkspace(id, 'billing.manage')

  await db.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { workspaceId: id },
      data: { status: 'ACTIVE', cancelAtPeriodEnd: false },
    })
    await tx.billingEvent.create({
      data: {
        workspaceId: id,
        type: 'SUBSCRIPTION_RESUMED',
        payload: JSON.stringify({ actorId: auth.user.id }),
      },
    })
  })

  await logActivity({
    workspaceId: id,
    actorId: auth.user.id,
    resourceType: 'SUBSCRIPTION',
    resourceId: id,
    action: 'SUBSCRIPTION_RESUMED',
    metadata: {},
  })

  return ok(await buildSubscriptionDTO(id))
})
