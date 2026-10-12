'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import {
  FolderKanban, ListTodo, CheckCircle2, AlertTriangle, UserCheck, CalendarCheck,
  CalendarClock, Activity as ActivityIcon, ChevronRight, FolderPlus, Users,
} from 'lucide-react'

import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { TASK_STATUS_LABEL, TASK_STATUS_COLOR, PRIORITY_LABEL, PRIORITY_COLOR } from '@/lib/constants'
import { can } from '@/lib/permissions'
import type { AnalyticsReport, DashboardStats, TaskStatus, Priority } from '@/types'
import {
  UserAvatar, DateChip, EmptyState, ErrorState, StatCardSkeleton, ChartSkeleton,
  ProgressBar, formatRelativeTime, isOverdue,
} from '@/components/shared/ui-primitives'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

type AnalyticsRange = '7d' | '30d' | '90d'

const RANGE_LABEL: Record<AnalyticsRange, string> = {
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
}

const CHART_TOOLTIP_STYLE: React.CSSProperties = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--popover-foreground)',
  boxShadow: '0 4px 12px rgb(0 0 0 / 0.12)',
}

/** Parse `YYYY-MM-DD` (and friends) as a local day to avoid TZ drift. */
function parseDay(value: string): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(value)
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return new Date(value)
}

function formatDay(value: string): string {
  return parseDay(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

// ===========================================================================
// Stat cards
// ===========================================================================

function StatCard({
  icon: Icon, label, value, accent = 'var(--primary)', loading, danger,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  accent?: string
  loading?: boolean
  danger?: boolean
}) {
  if (loading) return <StatCardSkeleton />
  return (
    <div
      className={cn(
        'group rounded-xl border bg-card p-4 transition-all outline-none focus-within:ring-2 focus-within:ring-ring hover:border-primary/30 hover:shadow-sm',
        danger && value > 0 && 'border-destructive/30'
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground truncate">{label}</span>
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform group-hover:scale-105"
          style={{ color: accent, backgroundColor: `color-mix(in oklab, ${accent} 12%, transparent)` }}
          aria-hidden
        >
          <Icon className="h-3.5 w-3.5" />
        </span>
      </div>
      <div
        className={cn(
          'mt-2 text-2xl font-bold tabular-nums tracking-tight',
          danger && value > 0 ? 'text-destructive' : 'text-foreground'
        )}
      >
        {value.toLocaleString('en-US')}
      </div>
    </div>
  )
}

// ===========================================================================
// Charts
// ===========================================================================

function CompletedOverTimeChart({ report }: { report: AnalyticsReport }) {
  const data = report.tasksCompletedOverTime.map((p) => ({
    ...p,
    label: formatDay(p.date),
  }))
  return (
    <div className="h-[260px] w-full" role="img" aria-label="Tasks completed over time chart">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
          <defs>
            <linearGradient id="completedGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            axisLine={{ stroke: 'var(--border)' }}
            tickLine={false}
            minTickGap={24}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={{ color: 'var(--muted-foreground)', fontSize: 11, marginBottom: 2 }}
            itemStyle={{ color: 'var(--foreground)', fontWeight: 500 }}
            cursor={{ stroke: 'var(--muted-foreground)', strokeOpacity: 0.25 }}
          />
          <Area
            type="monotone"
            dataKey="completed"
            name="Completed"
            stroke="var(--chart-1)"
            strokeWidth={2}
            fill="url(#completedGradient)"
            dot={false}
            activeDot={{ r: 4, strokeWidth: 0 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

function HorizontalCountChart({
  data, ariaLabel, height,
}: {
  data: { name: string; value: number; fill: string }[]
  ariaLabel: string
  height: number
}) {
  return (
    <div className="w-full" style={{ height }} role="img" aria-label={ariaLabel}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
          <XAxis type="number" hide allowDecimals={false} />
          <YAxis
            type="category"
            dataKey="name"
            width={88}
            tick={{ fill: 'var(--muted-foreground)', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={CHART_TOOLTIP_STYLE}
            labelStyle={{ color: 'var(--muted-foreground)', fontSize: 11 }}
            itemStyle={{ color: 'var(--foreground)', fontWeight: 500 }}
            cursor={{ fill: 'var(--accent)', opacity: 0.5 }}
          />
          <Bar dataKey="value" name="Tasks" radius={[0, 4, 4, 0]} barSize={16}>
            {data.map((d) => (
              <Cell key={d.name} fill={d.fill} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

// ===========================================================================
// Section card
// ===========================================================================

function SectionCard({
  title, action, children, className,
}: {
  title: React.ReactNode
  action?: React.ReactNode
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('rounded-xl border bg-card', className)}>
      <div className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h2 className="text-sm font-semibold">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  )
}

const ACTION_VERB: Record<string, string> = {
  CREATED: 'created',
  UPDATED: 'updated',
  DELETED: 'deleted',
  COMMENTED: 'commented on',
  STATUS_CHANGED: 'updated',
  ASSIGNED: 'assigned',
  ROLE_CHANGED: 'changed a role in',
  PLAN_CHANGED: 'changed the plan of',
  MEMBER_JOINED: 'joined',
  ARCHIVED: 'archived',
  RESTORED: 'restored',
  COMPLETED: 'completed',
  REOPENED: 'reopened',
}

function readableAction(action: string): string {
  return ACTION_VERB[action] ?? action.toLowerCase().replace(/_/g, ' ')
}

function readableResource(resourceType: string): string {
  const map: Record<string, string> = {
    TASK: 'task', PROJECT: 'project', WORKSPACE: 'workspace',
    MILESTONE: 'milestone', LABEL: 'label', MEMBER: 'member', COMMENT: 'comment',
  }
  return map[resourceType] ?? resourceType.toLowerCase()
}

function activityResourceName(a: { metadata: Record<string, unknown> | null; resourceType: string }): string | null {
  const md = a.metadata
  if (!md) return null
  const candidate =
    (md.taskTitle as string | undefined) ??
    (md.projectName as string | undefined) ??
    (md.milestoneName as string | undefined) ??
    (md.memberName as string | undefined) ??
    (md.labelName as string | undefined)
  return typeof candidate === 'string' && candidate.length > 0 ? candidate : null
}

// ===========================================================================
// Main view
// ===========================================================================

export default function DashboardView() {
  const session = useAppStore((s) => s.session)
  const wsId = useAppStore((s) => s.session?.currentWorkspaceId ?? null)
  const ws = useAppStore((s) => s.currentWorkspace())
  const navigate = useAppStore((s) => s.navigate)
  const openTaskDialog = useAppStore((s) => s.openTaskDialog)

  const [range, setRange] = React.useState<AnalyticsRange>('30d')
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const dashboardQuery = useQuery({
    queryKey: qk.dashboard(wsId ?? 'none'),
    queryFn: async () => {
      const data = await api.get<DashboardStats | null>(`/api/workspaces/${wsId}/dashboard`)
      if (!data) throw new ApiError(503, 'Dashboard data is unavailable right now.')
      return data
    },
    enabled: !!wsId,
  })
  const analyticsQuery = useQuery({
    queryKey: qk.analytics(wsId ?? 'none', range),
    queryFn: async () => {
      const data = await api.get<AnalyticsReport | null>(`/api/workspaces/${wsId}/analytics?range=${range}`)
      if (!data) throw new ApiError(503, 'Analytics data is unavailable right now.')
      return data
    },
    enabled: !!wsId && can(ws?.role, 'analytics.view_workspace'),
  })

  if (!wsId) return null

  const stats = dashboardQuery.data
  const report = analyticsQuery.data
  const role = ws?.role
  const canViewAnalytics = can(role, 'analytics.view_workspace')
  const analyticsGated = !canViewAnalytics
  const analyticsFailed = canViewAnalytics && analyticsQuery.isError
  const isBrandNew =
    !!stats && stats.activeProjects === 0 && stats.openTasks === 0 && stats.upcomingDeadlines.length === 0

  const maxWorkload = stats?.workload.reduce((m, w) => Math.max(m, w.openTasks), 0) ?? 0

  const statusData: { name: string; value: number; fill: string }[] =
    report?.byStatus.map((s) => ({
      name: TASK_STATUS_LABEL[s.status as TaskStatus] ?? s.status,
      value: s.count,
      fill: TASK_STATUS_COLOR[s.status as TaskStatus] ?? 'var(--chart-3)',
    })) ?? []
  const priorityData: { name: string; value: number; fill: string }[] =
    report?.byPriority.map((p) => ({
      name: PRIORITY_LABEL[p.priority as Priority] ?? p.priority,
      value: p.count,
      fill: PRIORITY_COLOR[p.priority as Priority] ?? 'var(--chart-3)',
    })) ?? []

  const greeting = (() => {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 18) return 'Good afternoon'
    return 'Good evening'
  })()
  const firstName = session?.user.name.split(' ')[0] ?? 'there'

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Overview</h1>
          <p className="mt-0.5 text-sm text-muted-foreground truncate" aria-live="polite">
            {mounted ? (
              <>
                {greeting}, {firstName} ·{' '}
                {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </>
            ) : (
              'Your workspace at a glance'
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={range} onValueChange={(v) => setRange(v as AnalyticsRange)}>
            <SelectTrigger
              className="h-10 w-[150px] sm:h-9"
              aria-label="Chart date range"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABEL) as AnalyticsRange[]).map((r) => (
                <SelectItem key={r} value={r}>{RANGE_LABEL[r]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Empty workspace */}
      {dashboardQuery.isSuccess && isBrandNew && (
        <EmptyState
          icon={FolderPlus}
          title="Create your first project"
          description="Your workspace is empty. Set up a project to start tracking tasks, deadlines, and team progress."
          action={
            <button
              onClick={() => navigate('projects')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FolderPlus className="h-4 w-4" /> Create your first project
            </button>
          }
        />
      )}

      {/* Stat cards */}
      {dashboardQuery.isError && !stats ? (
        <ErrorState
          message={dashboardQuery.error instanceof ApiError ? dashboardQuery.error.message : 'Failed to load dashboard stats.'}
          onRetry={() => dashboardQuery.refetch()}
        />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
          <StatCard icon={FolderKanban} label="Active projects" value={stats?.activeProjects ?? 0} accent="var(--chart-1)" loading={dashboardQuery.isPending} />
          <StatCard icon={ListTodo} label="Open tasks" value={stats?.openTasks ?? 0} accent="var(--chart-4)" loading={dashboardQuery.isPending} />
          <StatCard icon={CheckCircle2} label="Completed tasks" value={stats?.completedTasks ?? 0} accent="var(--chart-2)" loading={dashboardQuery.isPending} />
          <StatCard icon={AlertTriangle} label="Overdue tasks" value={stats?.overdueTasks ?? 0} accent="var(--destructive)" danger loading={dashboardQuery.isPending} />
          <StatCard icon={UserCheck} label="My open tasks" value={stats?.myOpenTasks ?? 0} accent="var(--chart-3)" loading={dashboardQuery.isPending} />
          <StatCard icon={CalendarCheck} label="Completed this week" value={stats?.completedThisWeek ?? 0} accent="var(--chart-5)" loading={dashboardQuery.isPending} />
        </div>
      )}

      {/* Charts */}
      {analyticsGated ? (
        <EmptyState
          icon={AlertTriangle}
          title="Analytics unavailable"
          description="Your role does not have access to workspace analytics."
          className="py-8"
        />
      ) : analyticsFailed && !report ? (
        <ErrorState
          message={analyticsQuery.error instanceof ApiError ? analyticsQuery.error.message : 'Failed to load analytics.'}
          onRetry={() => analyticsQuery.refetch()}
        />
      ) : !mounted || analyticsQuery.isPending ? (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="lg:col-span-2"><ChartSkeleton /></div>
          <ChartSkeleton />
        </div>
      ) : report && (
        <div className="grid gap-4 lg:grid-cols-3">
          <SectionCard title="Tasks completed over time" className="lg:col-span-2">
            <div className="px-4 py-4">
              <CompletedOverTimeChart report={report} />
            </div>
          </SectionCard>
          <SectionCard title="Tasks by status">
            <div className="px-4 py-4">
              <HorizontalCountChart data={statusData} ariaLabel="Tasks by status chart" height={Math.max(160, statusData.length * 34 + 20)} />
            </div>
          </SectionCard>
          <SectionCard title="Tasks by priority">
            <div className="px-4 py-4">
              <HorizontalCountChart data={priorityData} ariaLabel="Tasks by priority chart" height={Math.max(140, priorityData.length * 38 + 16)} />
            </div>
          </SectionCard>

          {/* Team workload */}
          <SectionCard
            title={<span className="inline-flex items-center gap-1.5"><Users className="h-4 w-4 text-muted-foreground" /> Team workload</span>}
            className="lg:col-span-2"
          >
            <div className="px-4 py-3">
              {stats && stats.workload.length > 0 ? (
                <ul className="space-y-3">
                  {stats.workload.slice(0, 8).map((w) => (
                    <li key={w.userId} className="flex items-center gap-3">
                      <UserAvatar name={w.name} color={w.avatarColor} size="sm" />
                      <span className="w-28 shrink-0 truncate text-sm font-medium">{w.name}</span>
                      <div className="flex-1">
                        <ProgressBar value={maxWorkload > 0 ? Math.round((w.openTasks / maxWorkload) * 100) : 0} color="var(--chart-1)" />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
                        {w.openTasks} open
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="py-6 text-center text-sm text-muted-foreground">No team activity yet.</p>
              )}
            </div>
          </SectionCard>
        </div>
      )}

      {/* Deadlines + activity */}
      {stats && (
        <div className="grid gap-4 lg:grid-cols-2">
          <SectionCard
            title={<span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-muted-foreground" /> Upcoming deadlines</span>}
          >
            {stats.upcomingDeadlines.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nothing due soon. Enjoy the calm.</p>
            ) : (
              <ul className="max-h-96 divide-y overflow-y-auto">
                {stats.upcomingDeadlines.map((d) => {
                  const overdue = isOverdue(d.dueDate)
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => openTaskDialog(d.id)}
                        className={cn(
                          'flex w-full min-h-[44px] items-center gap-3 px-4 py-2.5 text-left transition-colors outline-none focus-visible:bg-accent/60 hover:bg-accent/50',
                          overdue && 'bg-destructive/[0.04]'
                        )}
                        aria-label={`Open task ${d.title}${overdue ? ' (overdue)' : ''}`}
                      >
                        <span
                          className="h-2.5 w-2.5 shrink-0 rounded-full"
                          style={{ backgroundColor: d.projectColor }}
                          aria-hidden
                        />
                        <span className="min-w-0 flex-1">
                          <span className={cn('block truncate text-sm font-medium', overdue && 'text-destructive')}>
                            {d.title}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">{d.projectName}</span>
                        </span>
                        <DateChip date={d.dueDate} />
                        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" aria-hidden />
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>

          <SectionCard
            title={<span className="inline-flex items-center gap-1.5"><ActivityIcon className="h-4 w-4 text-muted-foreground" /> Recent activity</span>}
          >
            {stats.recentActivity.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="max-h-96 divide-y overflow-y-auto">
                {stats.recentActivity.map((a) => {
                  const name = activityResourceName(a)
                  return (
                    <li key={a.id} className="flex items-start gap-3 px-4 py-2.5">
                      <UserAvatar name={a.actorName} color={a.actorColor} size="xs" className="mt-0.5 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm leading-snug">
                          <span className="font-medium">{a.actorName}</span>{' '}
                          <span className="text-muted-foreground">{readableAction(a.action)}</span>{' '}
                          <span className="text-muted-foreground">{readableResource(a.resourceType)}</span>
                          {name && <span className="text-muted-foreground"> “{name}”</span>}
                        </p>
                        <p className="mt-0.5 text-[11px] text-muted-foreground/80">{formatRelativeTime(a.createdAt)}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </SectionCard>
        </div>
      )}
    </div>
  )
}
