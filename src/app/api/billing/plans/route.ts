import { handler, ok } from '@/lib/api-helpers'
import { PLANS } from '@/lib/constants'

// ---------------------------------------------------------------------------
// GET /api/billing/plans — public plan catalog (mirrors client constants).
// ---------------------------------------------------------------------------
export const GET = handler(async () => {
  return ok({ plans: PLANS })
})
