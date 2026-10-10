'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Check, CreditCard, FlaskConical, Loader2, Receipt, Users, FolderKanban, RefreshCw } from 'lucide-react'
import { api, qk } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { can } from '@/lib/permissions'
import { toastMutationError } from '@/components/team/errors'
import { PLANS, formatPrice, formatMoney, planInfo } from '@/lib/constants'
import type { BillingInterval, InvoiceDTO, Plan, SubscriptionDTO, SubscriptionStatus } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { EmptyState, ProgressBar, formatDateTime } from '@/components/shared/ui-primitives'

const TIER: Record<Plan, number> = { FREE: 0, PRO: 1, BUSINESS: 2 }

function StatusBadge({ status }: { status: SubscriptionStatus }) {
  const tone: Record<SubscriptionStatus, { variant: 'default' | 'secondary' | 'outline' | 'destructive'; label: string }> = {
    ACTIVE: { variant: 'outline', label: 'Active' },
    TRIALING: { variant: 'secondary', label: 'Trialing' },
    PAST_DUE: { variant: 'destructive', label: 'Past due' },
    INCOMPLETE: { variant: 'destructive', label: 'Incomplete' },
    CANCELLED: { variant: 'destructive', label: 'Cancelled' },
  }
  const t = tone[status] ?? { variant: 'outline', label: status }
  return <Badge variant={t.variant}>{t.label}</Badge>
}

function InvoiceStatusBadge({ status }: { status: string }) {
  const paid = status === 'PAID'
  return (
    <Badge
      variant="outline"
      className={paid ? 'border-green-600/40 text-green-600 dark:text-green-400' : 'border-amber-600/40 text-amber-600 dark:text-amber-400'}
    >
      {status}
    </Badge>
  )
}

function UsageRow({
  icon: Icon, label, used, max,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  used: number
  max: number | null
}) {
  const pct = max !== null && max > 0 ? Math.min(100, Math.round((used / max) * 100)) : 0
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden /> {label}
        </span>
        <span className="tabular-nums font-medium">
          {used} / {max === null ? '∞' : max}
        </span>
      </div>
      {max !== null && (
        <ProgressBar value={pct} color={pct >= 100 ? 'var(--destructive)' : undefined} />
      )}
      {max === null && <p className="text-[11px] text-muted-foreground">Unlimited on this plan</p>}
    </div>
  )
}

export function BillingTab({ wsId }: { wsId: string }) {
  const { session, navigate } = useAppStore()
  const qc = useQueryClient()
  const myRole = session?.workspaces.find((w) => w.id === wsId)?.role
  const canView = can(myRole, 'billing.view')
  const canManage = can(myRole, 'billing.manage')

  const subQuery = useQuery({
    queryKey: qk.subscription(wsId),
    queryFn: () => api.get<SubscriptionDTO>(`/api/workspaces/${wsId}/subscription`),
    enabled: !!wsId && canView,
  })
  const invoicesQuery = useQuery({
    queryKey: qk.invoices(wsId),
    queryFn: () => api.get<{ invoices: InvoiceDTO[] }>(`/api/workspaces/${wsId}/invoices`),
    enabled: !!wsId && canView,
  })

  const sub = subQuery.data
  const [interval, setIntervalChoice] = React.useState<BillingInterval>('monthly')
  const intervalTouched = React.useRef(false)
  React.useEffect(() => {
    if (sub && !intervalTouched.current) setIntervalChoice(sub.interval)
  }, [sub])

  const changePlan = useMutation({
    mutationFn: (plan: Plan) =>
      api.post<SubscriptionDTO>(`/api/workspaces/${wsId}/subscription`, { plan, interval }),
    onSuccess: (updated) => {
      qc.setQueryData(qk.subscription(wsId), updated)
      qc.invalidateQueries({ queryKey: qk.invoices(wsId) })
      toast.success(`Switched to ${planInfo(updated.plan).name}`, {
        description: updated.testMode ? 'A paid test invoice was recorded (test-mode billing).' : undefined,
      })
    },
    onError: (e) => toastMutationError(e, 'Failed to change plan', navigate),
  })

  const cancelSub = useMutation({
    mutationFn: () => api.post<SubscriptionDTO>(`/api/workspaces/${wsId}/subscription/cancel`),
    onSuccess: (updated) => {
      qc.setQueryData(qk.subscription(wsId), updated)
      toast.success('Subscription cancelled', {
        description: updated.currentPeriodEnd
          ? `You keep ${planInfo(updated.plan).name} features until ${formatDateTime(updated.currentPeriodEnd)}.`
          : 'Active until the end of the billing period.',
      })
    },
    onError: (e) => toastMutationError(e, 'Failed to cancel subscription', navigate),
  })

  const resumeSub = useMutation({
    mutationFn: () => api.post<SubscriptionDTO>(`/api/workspaces/${wsId}/subscription/resume`),
    onSuccess: (updated) => {
      qc.setQueryData(qk.subscription(wsId), updated)
      toast.success('Subscription resumed')
    },
    onError: (e) => toastMutationError(e, 'Failed to resume subscription', navigate),
  })

  if (!canView) {
    return (
      <EmptyState
        icon={CreditCard}
        title="No access to billing"
        description="Only the workspace owner and admins can view billing for this workspace."
      />
    )
  }

  if (subQuery.isLoading || !sub) {
    return (
      <div className="space-y-4">
        <div className="h-28 w-full animate-pulse rounded-xl bg-muted" />
        <div className="grid gap-4 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-64 animate-pulse rounded-xl bg-muted" />)}
        </div>
      </div>
    )
  }
  if (subQuery.isError) {
    return (
      <EmptyState
        icon={CreditCard}
        title="Could not load billing"
        description={subQuery.error instanceof Error ? subQuery.error.message : 'Something went wrong.'}
        action={<Button variant="outline" onClick={() => subQuery.refetch()}>Try again</Button>}
      />
    )
  }

  const currentPlan = planInfo(sub.plan)
  const showCancel = canManage && sub.plan !== 'FREE' && sub.status === 'ACTIVE' && !sub.cancelAtPeriodEnd
  const showResume = canManage && (sub.cancelAtPeriodEnd || sub.status === 'CANCELLED')

  return (
    <div className="space-y-6">
      {/* Test-mode banner */}
      <div className="flex items-start gap-2.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3.5 py-3 text-sm">
        <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
        <span>
          <strong>Test-mode billing:</strong> no real charges. Switching plans applies instantly and records a paid test invoice.
        </span>
      </div>

      {/* Current plan + usage */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              {currentPlan.name}
              <StatusBadge status={sub.status} />
              <Badge variant="outline" className="uppercase text-[10px]">{sub.interval}</Badge>
              {sub.testMode && <Badge variant="secondary" className="text-[10px]">TEST</Badge>}
            </CardTitle>
            <CardDescription>{currentPlan.description}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {sub.currentPeriodEnd ? (
                <>
                  {showResume ? 'Access ends' : 'Renews'} <span className="font-medium text-foreground">{formatDateTime(sub.currentPeriodEnd)}</span>
                </>
              ) : (
                'No active billing period'
              )}
            </p>
            {sub.cancelAtPeriodEnd && (
              <p className="text-amber-600 dark:text-amber-400 font-medium">
                Cancels at period end — resume anytime to keep {currentPlan.name}.
              </p>
            )}
            <div className="flex gap-2 pt-1">
              {showCancel && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" className="min-h-11" disabled={cancelSub.isPending}>
                      Cancel subscription
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Cancel {currentPlan.name}?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Your plan stays active until the end of the current period ({sub.currentPeriodEnd ? formatDateTime(sub.currentPeriodEnd) : 'period end'}), then the workspace moves to Free limits. Data is never deleted.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Keep plan</AlertDialogCancel>
                      <AlertDialogAction
                        className="bg-destructive text-white hover:bg-destructive/90"
                        onClick={(e) => { e.preventDefault(); cancelSub.mutate() }}
                      >
                        {cancelSub.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Cancels at period end
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              {showResume && (
                <Button onClick={() => resumeSub.mutate()} disabled={resumeSub.isPending} className="gap-2 min-h-11">
                  <RefreshCw className="h-4 w-4" /> Resume subscription
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Usage this period</CardTitle>
            <CardDescription>Counts against your plan limits in real time.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <UsageRow icon={Users} label="Members" used={sub.usage.members} max={sub.entitlements.maxMembers} />
            <UsageRow icon={FolderKanban} label="Active projects" used={sub.usage.activeProjects} max={sub.entitlements.maxActiveProjects} />
          </CardContent>
        </Card>
      </div>

      {/* Interval toggle */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1" role="group" aria-label="Billing interval">
          {(['monthly', 'annual'] as BillingInterval[]).map((i) => (
            <button
              key={i}
              onClick={() => { intervalTouched.current = true; setIntervalChoice(i) }}
              aria-pressed={interval === i}
              className={cn(
                'h-10 rounded-md px-4 text-sm font-medium capitalize transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                interval === i ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {i}
            </button>
          ))}
        </div>
        {interval === 'annual' && PLANS.some((p) => p.annualPriceCents < p.monthlyPriceCents * 12) && (
          <Badge variant="secondary" className="text-green-700 dark:text-green-400">
            {Math.round((1 - PLANS[1].annualPriceCents / (PLANS[1].monthlyPriceCents * 12)) * 12)} months free on annual plans
          </Badge>
        )}
      </div>

      {/* Plan comparison */}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {PLANS.map((plan) => {
          const isCurrent = plan.id === sub.plan
          const priceCents = interval === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents
          const monthsFree = Math.round((1 - plan.annualPriceCents / (plan.monthlyPriceCents * 12)) * 12)
          const higher = TIER[plan.id] > TIER[sub.plan]
          return (
            <Card
              key={plan.id}
              className={cn(
                'relative flex flex-col',
                isCurrent && 'border-primary ring-1 ring-primary',
                plan.highlighted && !isCurrent && 'border-primary/40'
              )}
            >
              {isCurrent && (
                <Badge className="absolute -top-2.5 left-4">Current</Badge>
              )}
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{plan.name}</CardTitle>
                <CardDescription>{plan.description}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                <div>
                  <span className="text-2xl font-bold">{formatPrice(priceCents, interval)}</span>
                  {plan.monthlyPriceCents > 0 && interval === 'annual' && monthsFree > 0 && (
                    <span className="ml-2 text-xs text-green-600 dark:text-green-400 font-medium">{monthsFree} months free</span>
                  )}
                </div>
                <ul className="space-y-1.5 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-600 dark:text-green-400" aria-hidden />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Button
                  className="w-full min-h-11"
                  variant={isCurrent ? 'secondary' : higher ? 'default' : 'outline'}
                  disabled={isCurrent || changePlan.isPending || !canManage}
                  title={!canManage && !isCurrent ? 'Only the workspace owner or admins can manage billing' : undefined}
                  onClick={() => changePlan.mutate(plan.id)}
                >
                  {changePlan.isPending && changePlan.variables === plan.id && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isCurrent ? 'Current plan' : `${higher ? 'Upgrade' : 'Downgrade'} to ${plan.name}`}
                </Button>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Invoices */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Receipt className="h-4 w-4 text-muted-foreground" /> Invoices
          </CardTitle>
        </CardHeader>
        <CardContent>
          {invoicesQuery.isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded bg-muted" />)}
            </div>
          ) : (invoicesQuery.data?.invoices ?? []).length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No invoices yet — they appear here after your first plan change.
            </p>
          ) : (
            <div className="max-h-96 overflow-y-auto rounded-lg border">
              <Table>
                <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur">
                  <TableRow>
                    <TableHead>Invoice</TableHead>
                    <TableHead className="hidden sm:table-cell">Date</TableHead>
                    <TableHead className="hidden md:table-cell">Plan</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                    <TableHead className="text-right">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {invoicesQuery.data!.invoices.map((inv) => (
                    <TableRow key={inv.id}>
                      <TableCell className="font-mono text-xs">{inv.number}</TableCell>
                      <TableCell className="hidden sm:table-cell text-muted-foreground text-xs">
                        {formatDateTime(inv.createdAt)}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <span className="text-sm">{planInfo(inv.plan as Plan).name}</span>
                        <span className="ml-1.5 text-xs text-muted-foreground capitalize">{inv.interval}</span>
                        {inv.testMode && (
                          <Badge variant="secondary" className="ml-2 px-1 py-0 text-[10px]" aria-label="Test invoice">TEST</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatMoney(inv.amountCents, inv.currency)}</TableCell>
                      <TableCell className="text-right"><InvoiceStatusBadge status={inv.status} /></TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
