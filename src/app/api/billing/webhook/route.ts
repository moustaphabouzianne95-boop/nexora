import { createHmac, timingSafeEqual } from 'crypto'
import { db } from '@/lib/db'
import { handler, ok, fail } from '@/lib/api-helpers'

// ---------------------------------------------------------------------------
// POST /api/billing/webhook — TEST-MODE STRUCTURE ONLY.
// - Verifies `x-nexora-signature` (hex HMAC-SHA256 of the raw body) when
//   BILLING_WEBHOOK_SECRET is configured → 401 on mismatch.
// - Idempotent by `eventId`: duplicate deliveries are recorded once in
//   BillingEvent (type WEBHOOK_RECEIVED) and short-circuited.
// - No real payment provider is wired; this endpoint documents the contract
//   a Stripe/Paddle integration would implement.
// ---------------------------------------------------------------------------
export const POST = handler(async (req) => {
  const raw = await req.text()

  const secret = process.env.BILLING_WEBHOOK_SECRET
  if (secret) {
    const provided = req.headers.get('x-nexora-signature')
    if (!provided) return fail('Missing signature header.', 401, 'UNAUTHENTICATED')
    const expected = createHmac('sha256', secret).update(raw).digest('hex')
    const a = Buffer.from(provided, 'utf8')
    const b = Buffer.from(expected, 'utf8')
    if (a.length !== b.length || !timingSafeEqual(a, b)) {
      return fail('Invalid webhook signature.', 401, 'UNAUTHENTICATED')
    }
  }

  let payload: Record<string, unknown>
  try {
    payload = JSON.parse(raw) as Record<string, unknown>
  } catch {
    return fail('Invalid JSON payload.', 400, 'INVALID_JSON')
  }

  const workspaceId = typeof payload.workspaceId === 'string' ? payload.workspaceId : null
  if (!workspaceId) {
    return fail('workspaceId is required in the webhook payload.', 422, 'VALIDATION')
  }

  const eventId = typeof payload.eventId === 'string' ? payload.eventId : null

  // Idempotency: skip deliveries we already recorded for this event id
  if (eventId) {
    const duplicate = await db.billingEvent.findFirst({
      where: {
        workspaceId,
        type: 'WEBHOOK_RECEIVED',
        payload: { contains: `"${eventId}"` },
      },
      select: { id: true },
    })
    if (duplicate) return ok({ received: true, duplicate: true })
  }

  const workspace = await db.workspace.findUnique({ where: { id: workspaceId }, select: { id: true } })
  if (!workspace) return fail('Unknown workspace.', 404, 'NOT_FOUND')

  await db.billingEvent.create({
    data: {
      workspaceId,
      type: 'WEBHOOK_RECEIVED',
      payload: JSON.stringify({ ...payload, receivedAt: new Date().toISOString() }),
    },
  })

  return ok({ received: true })
})
