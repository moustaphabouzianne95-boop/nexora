import { handler, ok, requireWorkspace, logActivity } from '@/lib/api-helpers'
import { db } from '@/lib/db'
import { buildSubscriptionDTO } from '../../../../billing/_lib'

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/subscription/cancel — cap billing.manage.
// TEST MODE: flags cancellation at period end; entitlements stay active until
// the period ends (enforcement keeps data intact — downgrade is non-destructive).
// ---------------------------------------------------------------------------
export const POST = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  const { auth } = await requireWorkspace(id, 'billing.manage')

  await db.$transaction(async (tx) => {
    await tx.subscription.update({
      where: { workspaceId: id },
      data: { status: 'CANCELLED', cancelAtPeriodEnd: true },
    })
    await tx.billingEvent.create({
      data: {
        workspaceId: id,
        type: 'SUBSCRIPTION_CANCELLED',
        payload: JSON.stringify({ actorId: auth.user.id, cancelAtPeriodEnd: true }),
      },
    })
  })

  await logActivity({
    workspaceId: id,
    actorId: auth.user.id,
    resourceType: 'SUBSCRIPTION',
    resourceId: id,
    action: 'SUBSCRIPTION_CANCELLED',
    metadata: { cancelAtPeriodEnd: true },
  })

  return ok(await buildSubscriptionDTO(id))
})
