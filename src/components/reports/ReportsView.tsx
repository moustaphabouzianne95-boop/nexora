'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from 'recharts'
import { CalendarRange, Lock, CheckCircle2, AlertTriangle, Timer, Target, BarChart3 } from 'lucide-react'
import { api, qk } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { can } from '@/lib/permissions'
import {
  TASK_STATUSES, TASK_STATUS_LABEL, TASK_STATUS_COLOR,
  PRIORITIES, PRIORITY_LABEL, PRIORITY_COLOR,
} from '@/lib/constants'
import type { AnalyticsReport, SubscriptionDTO, TimeseriesPoint } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import {
  UserAvatar, EmptyState, ErrorState, StatCardSkeleton, ChartSkeleton, ProgressBar,
} from '@/components/shared/ui-primitives'

// Series colors — from shared constants (no hardcoded metrics/colors)
const CREATED_COLOR = TASK_STATUS_COLOR.TODO
const COMPLETED_COLOR = TASK_STATUS_COLOR.DONE
const OPEN_COLOR = TASK_STATUS_COLOR.IN_PROGRESS

const tooltipStyle: React.CSSProperties = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 8,
  fontSize: 12,
  color: 'var(--popover-foreground)',
}

type QuickRange = '7d' | '30d' | '90d'
type RangeMode = QuickRange | 'custom'

function humanizeHours(hours: number | null): string {
  if (hours === null || hours === undefined) return '—'
  if (hours < 24) return `${hours.toFixed(1)}h`
  return `${(hours / 24).toFixed(1)}d`
}

/** Server may report rates as a fraction (0–1) or percent (0–100); normalize defensively. */
function rateToNumber(value: number | null): number | null {
  if (value === null || value === undefined) return null
  return value <= 1 ? value * 100 : value
}

function pct(value: number | null): string {
  const v = rateToNumber(value)
  return v === null ? '—' : `${Math.round(v)}%`
}

// --------------------------------------------------------------- KPI cards
function KpiCard({
  icon: Icon, label, value, hint, danger,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  hint?: string
  danger?: boolean
}) {
  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Icon className="h-4 w-4" aria-hidden />
          <span className="text-xs font-medium">{label}</span>
        </div>
        <p className={cn('mt-1.5 text-2xl font-bold tabular-nums', danger && 'text-destructive')}>{value}</p>
        {hint && <p className="text-[11px] text-muted-foreground mt-0.5">{hint}</p>}
      </CardContent>
    </Card>
  )
}

// ------------------------------------------------------------------ charts
function CreatedVsCompletedChart({ data }: { data: (TimeseriesPoint & { key: string })[] }) {
  return (
    <ResponsiveContainer width="100%" height={280}>
      <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
        <defs>
          <linearGradient id="fillCreated" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={CREATED_COLOR} stopOpacity={0.35} />
            <stop offset="95%" stopColor={CREATED_COLOR} stopOpacity={0.02} />
          </linearGradient>
          <linearGradient id="fillCompleted" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={COMPLETED_COLOR} stopOpacity={0.35} />
            <stop offset="95%" stopColor={COMPLETED_COLOR} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          minTickGap={24}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ stroke: 'var(--border)' }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Area
          type="monotone"
          dataKey="created"
          name="Created"
          stroke={CREATED_COLOR}
          strokeWidth={2}
          fill="url(#fillCreated)"
        />
        <Area
          type="monotone"
          dataKey="completed"
          name="Completed"
          stroke={COMPLETED_COLOR}
          strokeWidth={2}
          fill="url(#fillCompleted)"
        />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function StatusPriorityCharts({
  report,
}: {
  report: Pick<AnalyticsReport, 'byStatus' | 'byPriority'>
}) {
  const statusData = TASK_STATUSES.map((s) => ({
    name: TASK_STATUS_LABEL[s],
    count: report.byStatus.find((b) => b.status === s)?.count ?? 0,
    fill: TASK_STATUS_COLOR[s],
  }))
  const priorityData = PRIORITIES.map((p) => ({
    name: PRIORITY_LABEL[p],
    count: report.byPriority.find((b) => b.priority === p)?.count ?? 0,
    fill: PRIORITY_COLOR[p],
  }))

  const renderBar = (data: { name: string; count: number; fill: string }[]) => (
    <ResponsiveContainer width="100%" height={240}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          interval={0}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
          width={40}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
        <Bar dataKey="count" name="Tasks" radius={[4, 4, 0, 0]} maxBarSize={48}>
          {data.map((d) => (
            <Cell key={d.name} fill={d.fill} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Tasks by status</CardTitle>
        </CardHeader>
        <CardContent>{renderBar(statusData)}</CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">Tasks by priority</CardTitle>
        </CardHeader>
        <CardContent>{renderBar(priorityData)}</CardContent>
      </Card>
    </div>
  )
}

function WorkloadChart({
  report,
}: {
  report: Pick<AnalyticsReport, 'workloadByMember'>
}) {
  const data = report.workloadByMember.map((m) => ({
    name: m.name,
    completed: m.completed,
    open: m.open,
  }))
  return (
    <ResponsiveContainer width="100%" height={Math.max(200, data.length * 44 + 40)}>
      <BarChart data={data} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="name"
          width={96}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--muted)', opacity: 0.4 }} />
        <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
        <Bar dataKey="completed" name="Completed" stackId="w" fill={COMPLETED_COLOR} radius={[0, 0, 0, 0]} maxBarSize={18} />
        <Bar dataKey="open" name="Open" stackId="w" fill={OPEN_COLOR} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ------------------------------------------------------- member analytics
function MemberAnalyticsTable({ report }: { report: AnalyticsReport }) {
  const rows = report.memberAnalytics
  return (
    <div className="max-h-96 overflow-y-auto rounded-xl border">
      <Table>
        <TableHeader className="sticky top-0 bg-muted/60 backdrop-blur">
          <TableRow>
            <TableHead>Member</TableHead>
            <TableHead className="text-right">Assigned</TableHead>
            <TableHead className="text-right">Completed</TableHead>
            <TableHead className="text-right">Overdue</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length === 0 ? (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">
                No member activity in this range.
              </TableCell>
            </TableRow>
          ) : (
            rows.map((m) => (
              <TableRow key={m.userId}>
                <TableCell>
                  <span className="flex items-center gap-2">
                    <UserAvatar name={m.name} color={m.avatarColor} size="sm" />
                    <span className="text-sm font-medium truncate">{m.name}</span>
                  </span>
                </TableCell>
                <TableCell className="text-right tabular-nums">{m.assigned}</TableCell>
                <TableCell className="text-right tabular-nums text-green-600 dark:text-green-400">{m.completed}</TableCell>
                <TableCell className={cn('text-right tabular-nums', m.overdue > 0 && 'text-destructive font-medium')}>
                  {m.overdue}
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}

function AdvancedAnalyticsLock({ onUpgrade }: { onUpgrade: () => void }) {
  return (
    <Card className="relative overflow-hidden">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm font-semibold">
          <Lock className="h-4 w-4 text-muted-foreground" /> Member analytics
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* blurred preview of the table shape */}
        <div className="pointer-events-none select-none blur-[3px] opacity-60" aria-hidden>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0">
              <span className="h-7 w-7 rounded-full bg-muted" />
              <span className="h-3 rounded bg-muted" style={{ width: `${30 + ((i * 17) % 30)}%` }} />
              <span className="ml-auto h-3 w-8 rounded bg-muted" />
              <span className="h-3 w-8 rounded bg-muted" />
              <span className="h-3 w-8 rounded bg-muted" />
            </div>
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-background/40 px-6 text-center">
          <Badge variant="secondary" className="gap-1">
            <Lock className="h-3 w-3" /> PRO
          </Badge>
          <p className="text-sm font-semibold">Advanced analytics is a Pro feature</p>
          <p className="text-xs text-muted-foreground max-w-xs">
            Upgrade to see per-member assigned, completed, and overdue breakdowns for this workspace.
          </p>
          <Button size="sm" onClick={onUpgrade} className="mt-1">Upgrade</Button>
        </div>
      </CardContent>
    </Card>
  )
}

// ===========================================================================
// ReportsView
// ===========================================================================

export default function ReportsView() {
  const { session, navigate } = useAppStore()
  const wsId = session?.currentWorkspaceId
  const myRole = session?.workspaces.find((w) => w.id === wsId)?.role
  const canView = can(myRole, 'analytics.view_workspace')
  const canSeeBilling = can(myRole, 'billing.view')

  const [mode, setMode] = React.useState<RangeMode>('30d')
  const [draftFrom, setDraftFrom] = React.useState('')
  const [draftTo, setDraftTo] = React.useState('')
  const [appliedCustom, setAppliedCustom] = React.useState<{ from: string; to: string } | null>(null)

  const rangeKey = mode === 'custom' && appliedCustom
    ? `custom:${appliedCustom.from}:${appliedCustom.to}`
    : mode

  const analyticsQuery = useQuery({
    queryKey: qk.analytics(wsId ?? '', rangeKey),
    queryFn: () => {
      const params = new URLSearchParams()
      if (mode === 'custom' && appliedCustom) {
        params.set('range', 'custom')
        params.set('from', appliedCustom.from)
        params.set('to', appliedCustom.to)
      } else {
        params.set('range', mode)
      }
      return api.get<AnalyticsReport>(`/api/workspaces/${wsId}/analytics?${params.toString()}`)
    },
    enabled: !!wsId && canView && !(mode === 'custom' && !appliedCustom),
  })

  const report = analyticsQuery.data

  // Subscription is only needed to explain the advanced-analytics gate
  const subscriptionQuery = useQuery({
    queryKey: qk.subscription(wsId ?? ''),
    queryFn: () => api.get<SubscriptionDTO>(`/api/workspaces/${wsId}/subscription`),
    enabled: !!wsId && canSeeBilling && !!report && (report.memberAnalytics?.length ?? 0) === 0,
    staleTime: 60_000,
  })

  const mergedSeries = React.useMemo(() => {
    if (!report) return []
    const map = new Map<string, { key: string; date: string; created: number; completed: number }>()
    const put = (p: TimeseriesPoint, field: 'created' | 'completed') => {
      const key = p.date.slice(0, 10)
      const entry = map.get(key) ?? { key, date: key, created: 0, completed: 0 }
      entry[field] = p[field]
      map.set(key, entry)
    }
    report.tasksCreatedOverTime.forEach((p) => put(p, 'created'))
    report.tasksCompletedOverTime.forEach((p) => put(p, 'completed'))
    return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
  }, [report])

  const upgradeToBilling = () => navigate('settings', { settingsTab: 'billing' })

  if (!wsId) return null

  if (!canView) {
    return (
      <div className="space-y-6">
        <h1 className="text-xl font-bold tracking-tight">Reports</h1>
        <EmptyState
          icon={BarChart3}
          title="No access to workspace reports"
          description="Ask an admin or the workspace owner for reporting access."
        />
      </div>
    )
  }

  const totalTasks = report ? report.byStatus.reduce((s, b) => s + b.count, 0) : 0
  const totalCreated = mergedSeries.reduce((s, p) => s + p.created, 0)
  const isEmpty = !!report && totalTasks === 0 && totalCreated === 0
  const memberRows = report?.memberAnalytics ?? []
  const entitledAdvanced = subscriptionQuery.data
    ? subscriptionQuery.data.entitlements.advancedAnalytics
    : memberRows.length > 0 // server omits the field entirely when unentitled

  const customValid = draftFrom && draftTo && draftFrom <= draftTo

  return (
    <div className="space-y-6">
      {/* Header + range selector */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground">Workspace analytics and delivery metrics</p>
        </div>
        <div className="flex-1" />
        <div
          className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1"
          role="group"
          aria-label="Report range"
        >
          {(['7d', '30d', '90d'] as QuickRange[]).map((r) => (
            <button
              key={r}
              onClick={() => { setMode(r); setAppliedCustom(null) }}
              aria-pressed={mode === r}
              className={cn(
                'h-10 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                mode === r ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {r}
            </button>
          ))}
          <button
            onClick={() => setMode('custom')}
            aria-pressed={mode === 'custom'}
            aria-label="Custom range"
            className={cn(
              'flex h-10 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
              mode === 'custom' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <CalendarRange className="h-4 w-4" /> Custom
          </button>
        </div>
      </div>

      {mode === 'custom' && (
        <div className="flex flex-wrap items-end gap-3 rounded-xl border bg-muted/20 p-3">
          <div className="space-y-1">
            <label htmlFor="report-from" className="text-xs font-medium text-muted-foreground">From</label>
            <Input
              id="report-from"
              type="date"
              value={draftFrom}
              max={draftTo || undefined}
              onChange={(e) => setDraftFrom(e.target.value)}
              className="h-10 w-44"
            />
          </div>
          <div className="space-y-1">
            <label htmlFor="report-to" className="text-xs font-medium text-muted-foreground">To</label>
            <Input
              id="report-to"
              type="date"
              value={draftTo}
              min={draftFrom || undefined}
              onChange={(e) => setDraftTo(e.target.value)}
              className="h-10 w-44"
            />
          </div>
          <Button
            className="h-10"
            disabled={!customValid || (appliedCustom?.from === draftFrom && appliedCustom?.to === draftTo)}
            onClick={() => setAppliedCustom({ from: draftFrom, to: draftTo })}
          >
            Apply range
          </Button>
          {!customValid && <p className="text-xs text-muted-foreground">Pick a valid from/to pair.</p>}
        </div>
      )}

      {/* Body */}
      {analyticsQuery.isLoading ? (
        <div className="space-y-4">
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <StatCardSkeleton key={i} />)}
          </div>
          <ChartSkeleton height={280} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ChartSkeleton height={240} />
            <ChartSkeleton height={240} />
          </div>
        </div>
      ) : analyticsQuery.isError ? (
        <ErrorState
          message={analyticsQuery.error instanceof Error ? analyticsQuery.error.message : 'Failed to load analytics'}
          onRetry={() => analyticsQuery.refetch()}
        />
      ) : !report || isEmpty ? (
        <EmptyState
          icon={BarChart3}
          title="No tasks in this range"
          description="Once tasks are created or completed in the selected period, their analytics will appear here."
          action={
            <Button variant="outline" onClick={() => { setMode('90d'); setAppliedCustom(null) }}>
              Last 90 days
            </Button>
          }
        />
      ) : (
        <>
          {/* KPI cards */}
          <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
            <KpiCard
              icon={CheckCircle2}
              label="Completion rate"
              value={pct(report.completionRate)}
              hint="Completed vs all tasks"
            />
            <KpiCard
              icon={AlertTriangle}
              label="Overdue rate"
              value={pct(report.overdueRate)}
              hint="Overdue vs open tasks"
              danger={(rateToNumber(report.overdueRate) ?? 0) > 20}
            />
            <KpiCard
              icon={Timer}
              label="Avg completion time"
              value={humanizeHours(report.avgCompletionHours)}
              hint="From creation to done"
            />
            <KpiCard
              icon={Target}
              label="On-time rate"
              value={report.onTimeRate === null ? '—' : pct(report.onTimeRate)}
              hint="Completed before due date"
            />
          </div>

          {/* Created vs completed */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Created vs completed over time</CardTitle>
            </CardHeader>
            <CardContent>
              <CreatedVsCompletedChart data={mergedSeries} />
            </CardContent>
          </Card>

          {/* Status & priority */}
          <StatusPriorityCharts report={report} />

          {/* Workload + project progress */}
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Workload by member</CardTitle>
              </CardHeader>
              <CardContent>
                {report.workloadByMember.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No assigned work in this range.</p>
                ) : (
                  <WorkloadChart report={report} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Project progress</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 max-h-72 overflow-y-auto">
                {report.projectProgress.length === 0 ? (
                  <p className="py-10 text-center text-sm text-muted-foreground">No projects yet.</p>
                ) : (
                  report.projectProgress.slice(0, 10).map((p) => (
                    <div key={p.id} className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2 text-sm">
                        <span className="flex items-center gap-2 min-w-0">
                          <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: p.color }} aria-hidden />
                          <span className="truncate font-medium">{p.name}</span>
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums shrink-0">
                          {p.completed}/{p.total}
                        </span>
                      </div>
                      <ProgressBar value={p.progress} color={p.color} />
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </div>

          {/* Member analytics (gated) */}
          {entitledAdvanced ? (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Member analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <MemberAnalyticsTable report={report} />
              </CardContent>
            </Card>
          ) : (
            <AdvancedAnalyticsLock onUpgrade={upgradeToBilling} />
          )}
        </>
      )}
    </div>
  )
}
