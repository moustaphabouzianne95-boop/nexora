import { db } from '@/lib/db'
import { handler, ok, parseBody, requireWorkspace, logActivity, notify } from '@/lib/api-helpers'
import { billingChangeSchema } from '@/lib/validation'
import { PLANS } from '@/lib/constants'
import { buildSubscriptionDTO, invoiceNumber } from '../../../billing/_lib'

const PERIOD_MS = { monthly: 30 * 24 * 60 * 60 * 1000, annual: 365 * 24 * 60 * 60 * 1000 } as const

// ---------------------------------------------------------------------------
// GET /api/workspaces/:id/subscription — SubscriptionDTO (cap billing.view)
// ---------------------------------------------------------------------------
export const GET = handler(async (_req, ctx) => {
  const { id } = await ctx.params
  await requireWorkspace(id, 'billing.view')
  return ok(await buildSubscriptionDTO(id))
})

// ---------------------------------------------------------------------------
// POST /api/workspaces/:id/subscription — TEST-MODE plan change (cap billing.manage).
// Creates/updates the subscription, issues a PAID test invoice (paid plans only),
// records a BillingEvent, activity log and notifies the workspace owner.
// No real payment provider is contacted — documented test mode.
// ---------------------------------------------------------------------------
export const POST = handler(async (req, ctx) => {
  const { id } = await ctx.params
  const { auth, workspace } = await requireWorkspace(id, 'billing.manage')
  const data = await parseBody(req, billingChangeSchema)

  const previous = await db.subscription.findUnique({ where: { workspaceId: id } })
  const seats = await db.workspaceMember.count({ where: { workspaceId: id } })
  const now = new Date()
  const periodMs = PERIOD_MS[data.interval]
  const periodEnd = new Date(now.getTime() + periodMs)

  await db.$transaction(async (tx) => {
    // Upsert subscription in test mode
    await tx.subscription.upsert({
      where: { workspaceId: id },
      create: {
        workspaceId: id,
        plan: data.plan,
        interval: data.interval,
        status: 'ACTIVE',
        provider: 'test-mode',
        cancelAtPeriodEnd: false,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      update: {
        plan: data.plan,
        interval: data.interval,
        status: 'ACTIVE',
        provider: 'test-mode',
        cancelAtPeriodEnd: false,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
    })

    // Paid plans get a test-mode invoice (seat-based)
    if (data.plan !== 'FREE') {
      const planInfo = PLANS.find((p) => p.id === data.plan)!
      const unitCents = data.interval === 'annual' ? planInfo.annualPriceCents : planInfo.monthlyPriceCents
      await tx.invoice.create({
        data: {
          workspaceId: id,
          number: invoiceNumber(),
          amountCents: unitCents * seats,
          currency: 'USD',
          status: 'PAID',
          plan: data.plan,
          interval: data.interval,
          periodStart: now,
          periodEnd,
          testMode: true,
        },
      })
    }

    await tx.billingEvent.create({
      data: {
        workspaceId: id,
        type: 'PLAN_CHANGED',
        payload: JSON.stringify({
          from: previous?.plan ?? 'FREE',
          to: data.plan,
          interval: data.interval,
          seats,
          actorId: auth.user.id,
        }),
      },
    })
  })

  await logActivity({
    workspaceId: id,
    actorId: auth.user.id,
    resourceType: 'SUBSCRIPTION',
    resourceId: id,
    action: 'PLAN_CHANGED',
    metadata: { from: previous?.plan ?? 'FREE', to: data.plan, interval: data.interval },
  })

  await notify({
    userId: workspace.ownerId,
    workspaceId: id,
    type: 'BILLING',
    title: 'Subscription updated',
    body: `${workspace.name} is now on the ${data.plan} plan (${data.interval}).`,
    resourceType: 'SUBSCRIPTION',
    resourceId: id,
  })

  return ok(await buildSubscriptionDTO(id))
})
