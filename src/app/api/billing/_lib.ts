import { db } from '@/lib/db'
import { getSubscription, getEntitlements, countMembers } from '@/lib/entitlements'
import type { BillingInterval, InvoiceDTO, Plan, SubscriptionDTO, SubscriptionStatus } from '@/types'

// ---------------------------------------------------------------------------
// Shared billing helpers (task 2-b) — subscription DTO builder + invoice DTO.
// ---------------------------------------------------------------------------

export async function buildSubscriptionDTO(workspaceId: string): Promise<SubscriptionDTO> {
  const [sub, entitlements, seats, activeProjects] = await Promise.all([
    getSubscription(workspaceId),
    getEntitlements(workspaceId),
    countMembers(workspaceId),
    db.project.count({ where: { workspaceId, archivedAt: null, status: { not: 'COMPLETED' } } }),
  ])

  return {
    plan: sub.plan as Plan,
    status: sub.status as SubscriptionStatus,
    interval: sub.interval as BillingInterval,
    provider: sub.provider,
    cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    currentPeriodStart: sub.currentPeriodStart ? sub.currentPeriodStart.toISOString() : null,
    currentPeriodEnd: sub.currentPeriodEnd ? sub.currentPeriodEnd.toISOString() : null,
    seats,
    testMode: sub.provider === 'test-mode',
    entitlements,
    usage: { members: seats, activeProjects },
  }
}

export function toInvoiceDTO(invoice: {
  id: string
  number: string
  amountCents: number
  currency: string
  status: string
  plan: string
  interval: string
  periodStart: Date
  periodEnd: Date
  testMode: boolean
  createdAt: Date
}): InvoiceDTO {
  return {
    id: invoice.id,
    number: invoice.number,
    amountCents: invoice.amountCents,
    currency: invoice.currency,
    status: invoice.status,
    plan: invoice.plan,
    interval: invoice.interval,
    periodStart: invoice.periodStart.toISOString(),
    periodEnd: invoice.periodEnd.toISOString(),
    testMode: invoice.testMode,
    createdAt: invoice.createdAt.toISOString(),
  }
}

/** Unique-enough test-mode invoice number: NEX-<base36 timestamp>. */
export function invoiceNumber(): string {
  return `NEX-${Date.now().toString(36).toUpperCase()}`
}
