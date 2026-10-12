'use client'

import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Lock, CalendarDays } from 'lucide-react'
import { api, qk } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { can } from '@/lib/permissions'
import { TASK_STATUSES, TASK_STATUS_LABEL } from '@/lib/constants'
import type { TaskDTO, SubscriptionDTO, WorkspaceMemberDTO } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { EmptyState, ErrorState, isOverdue } from '@/components/shared/ui-primitives'

// ------------------------------------------------------- calendar response
/** Calendar milestone shape per API contract (GET /api/workspaces/:id/calendar). */
interface CalendarMilestone {
  id: string
  name: string
  dueDate: string
  projectId: string
  projectName: string
  color: string
  status: 'OPEN' | 'COMPLETED'
}
interface CalendarResponse {
  tasks: TaskDTO[]
  milestones: CalendarMilestone[]
}

// ------------------------------------------------------------ date helpers
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
const startOfWeek = (d: Date) => addDays(startOfDay(d), -d.getDay())
const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const isoStart = (d: Date) => startOfDay(d).toISOString()
const isoEnd = (d: Date) => {
  const e = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999)
  return e.toISOString()
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ------------------------------------------------------------------ chips
function TaskChip({ task }: { task: TaskDTO }) {
  const openTaskDialog = useAppStore((s) => s.openTaskDialog)
  const overdue = isOverdue(task.dueDate) && task.status !== 'DONE' && task.status !== 'CANCELLED'
  return (
    <button
      onClick={() => openTaskDialog(task.id)}
      className={cn(
        'flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none',
        overdue ? 'text-destructive font-medium' : 'text-foreground'
      )}
      aria-label={`Task ${task.title} in ${task.projectName}${overdue ? ', overdue' : ''}`}
      title={`${task.title} · ${task.projectName}`}
    >
      <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: task.projectColor }} aria-hidden />
      <span className="truncate">{task.title}</span>
    </button>
  )
}

function MilestoneChip({ milestone }: { milestone: CalendarMilestone }) {
  const openProject = useAppStore((s) => s.openProject)
  const done = milestone.status === 'COMPLETED'
  return (
    <button
      onClick={() => openProject(milestone.projectId)}
      className="flex w-full items-center gap-1 rounded px-1 py-0.5 text-left text-[11px] leading-tight hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring outline-none text-muted-foreground"
      aria-label={`Milestone ${milestone.name} in ${milestone.projectName}`}
      title={`Milestone: ${milestone.name} · ${milestone.projectName}`}
    >
      <span
        className={cn('h-2 w-2 shrink-0 rotate-45', done && 'opacity-50')}
        style={{ backgroundColor: milestone.color }}
        aria-hidden
      />
      <span className={cn('truncate', done && 'line-through opacity-70')}>{milestone.name}</span>
    </button>
  )
}

// -------------------------------------------------------------- day cell
function DayCell({
  day,
  tasks,
  milestones,
  inMonth,
  maxChips,
  tall,
}: {
  day: Date
  tasks: TaskDTO[]
  milestones: CalendarMilestone[]
  inMonth: boolean
  maxChips: number
  tall?: boolean
}) {
  const today = new Date()
  const isToday = sameDay(day, today)
  const visibleTasks = tasks.slice(0, maxChips)
  const hiddenTasks = tasks.slice(maxChips)

  return (
    <div
      className={cn(
        'flex flex-col gap-0.5 border-b border-r p-1.5',
        tall ? 'min-h-52' : 'min-h-24 sm:min-h-28',
        !inMonth && 'bg-muted/30',
        isToday && 'ring-2 ring-inset ring-primary bg-primary/[0.04]'
      )}
      aria-label={`${day.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${tasks.length ? `, ${tasks.length} tasks` : ''}`}
    >
      <div className="flex items-center justify-between px-0.5">
        <span
          className={cn(
            'inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-semibold tabular-nums',
            isToday ? 'bg-primary text-primary-foreground' : !inMonth ? 'text-muted-foreground/60' : 'text-muted-foreground'
          )}
          aria-current={isToday ? 'date' : undefined}
        >
          {day.getDate()}
        </span>
        {milestones.length > 0 && (
          <span className="text-[10px] text-muted-foreground" title={`${milestones.length} milestone(s)`}>
            ◆{milestones.length}
          </span>
        )}
      </div>

      {milestones.slice(0, tall ? 3 : 1).map((m) => (
        <MilestoneChip key={m.id} milestone={m} />
      ))}
      {visibleTasks.map((t) => (
        <TaskChip key={t.id} task={t} />
      ))}

      {hiddenTasks.length > 0 && (
        <Popover>
          <PopoverTrigger asChild>
            <button className="text-left text-[11px] font-medium text-muted-foreground hover:text-foreground px-1 focus-visible:ring-2 focus-visible:ring-ring outline-none rounded">
              +{hiddenTasks.length} more
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-64 p-2" align="start">
            <p className="px-1 pb-1.5 text-xs font-semibold text-muted-foreground">
              {day.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
            </p>
            <div className="max-h-64 space-y-0.5 overflow-y-auto">
              {tasks.map((t) => (
                <TaskChip key={t.id} task={t} />
              ))}
            </div>
          </PopoverContent>
        </Popover>
      )}
    </div>
  )
}

// =========================================================== CalendarView
export default function CalendarView() {
  const { session, navigate } = useAppStore()
  const wsId = session?.currentWorkspaceId
  const myRole = session?.workspaces.find((w) => w.id === wsId)?.role
  const canSeeBilling = can(myRole, 'billing.view')

  const [mode, setMode] = React.useState<'month' | 'week'>('month')
  const [cursor, setCursor] = React.useState<Date>(() => startOfDay(new Date()))
  const [assignee, setAssignee] = React.useState('all')
  const [status, setStatus] = React.useState('all')

  // range + cache key ------------------------------------------------------
  const monthKeyLabel = `${cursor.getFullYear()}-${String(cursor.getMonth() + 1).padStart(2, '0')}`
  const cacheKey = `${mode}:${monthKeyLabel}:${assignee}:${status}`

  const gridStart = React.useMemo(
    () => (mode === 'month' ? startOfWeek(new Date(cursor.getFullYear(), cursor.getMonth(), 1)) : startOfWeek(cursor)),
    [mode, cursor]
  )
  const days = React.useMemo(() => {
    const count = mode === 'month' ? 42 : 7
    return Array.from({ length: count }, (_, i) => addDays(gridStart, i))
  }, [gridStart, mode])
  const rangeFrom = isoStart(gridStart)
  const rangeTo = isoEnd(days[days.length - 1])

  // PRO gate (server enforces anyway; client gate is a UX affordance) ------
  const subQuery = useQuery({
    queryKey: qk.subscription(wsId ?? ''),
    queryFn: () => api.get<SubscriptionDTO>(`/api/workspaces/${wsId}/subscription`),
    enabled: !!wsId && canSeeBilling,
    staleTime: 60_000,
  })
  const calendarAllowed: boolean | null = !canSeeBilling
    ? true // can't determine for non-billing roles; server enforces regardless
    : subQuery.data
      ? subQuery.data.entitlements.calendarView
      : subQuery.isError
        ? true
        : null

  // members for the assignee filter ----------------------------------------
  const membersQuery = useQuery({
    queryKey: qk.members(wsId ?? ''),
    queryFn: () => api.get<{ members: WorkspaceMemberDTO[] }>(`/api/workspaces/${wsId}/members`),
    enabled: !!wsId,
    staleTime: 60_000,
  })
  const members = membersQuery.data?.members ?? []

  // calendar data -----------------------------------------------------------
  const calendarQuery = useQuery({
    queryKey: qk.calendar(wsId ?? '', cacheKey),
    queryFn: () => {
      const params = new URLSearchParams({ from: rangeFrom, to: rangeTo })
      if (assignee !== 'all') params.set('assignee', assignee)
      if (status !== 'all') params.set('status', status)
      return api.get<CalendarResponse>(`/api/workspaces/${wsId}/calendar?${params.toString()}`)
    },
    enabled: !!wsId && calendarAllowed !== null && calendarAllowed !== false,
  })

  // group tasks/milestones by local day (hooks must run before any early return)
  const tasksByDay = React.useMemo(() => {
    const map = new Map<string, TaskDTO[]>()
    for (const day of days) map.set(dayKey(day), [])
    if (calendarQuery.data) {
      for (const t of calendarQuery.data.tasks) {
        if (!t.dueDate) continue
        const key = dayKey(new Date(t.dueDate))
        const bucket = map.get(key)
        if (bucket) bucket.push(t)
        else map.set(key, [t])
      }
    }
    return map
  }, [days, calendarQuery.data])

  const milestonesByDay = React.useMemo(() => {
    const map = new Map<string, CalendarMilestone[]>()
    for (const day of days) map.set(dayKey(day), [])
    if (calendarQuery.data) {
      for (const m of calendarQuery.data.milestones) {
        if (!m.dueDate) continue
        const key = dayKey(new Date(m.dueDate))
        const bucket = map.get(key)
        if (bucket) bucket.push(m)
        else map.set(key, [m])
      }
    }
    return map
  }, [days, calendarQuery.data])

  if (!wsId) return null

  const upgradeToBilling = () => navigate('settings', { settingsTab: 'billing' })

  const periodLabel =
    mode === 'month'
      ? cursor.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
      : `${gridStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${addDays(gridStart, 6).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`

  const shift = (dir: 1 | -1) => {
    setCursor((c) => (mode === 'month' ? new Date(c.getFullYear(), c.getMonth() + dir, 1) : addDays(c, dir * 7)))
  }
  const goToday = () => setCursor(startOfDay(new Date()))

  const totalItems =
    (calendarQuery.data?.tasks.length ?? 0) + (calendarQuery.data?.milestones.length ?? 0)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Calendar</h1>
          <p className="text-sm text-muted-foreground" aria-live="polite">{periodLabel}</p>
        </div>
        <div className="flex-1" />
        <div className="flex flex-wrap items-center gap-2">
          {/* navigation */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-1" role="group" aria-label="Calendar navigation">
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => shift(-1)} aria-label={mode === 'month' ? 'Previous month' : 'Previous week'}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <button
              onClick={goToday}
              className="h-10 rounded-md px-3 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="Go to today"
            >
              Today
            </button>
            <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => shift(1)} aria-label={mode === 'month' ? 'Next month' : 'Next week'}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* month/week toggle */}
          <div className="flex items-center rounded-lg border bg-muted/40 p-1" role="group" aria-label="Calendar view mode">
            {(['month', 'week'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={cn(
                  'h-10 rounded-md px-3 text-sm font-medium capitalize transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  mode === m ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                {m}
              </button>
            ))}
          </div>

          {/* filters */}
          <Select value={assignee} onValueChange={setAssignee}>
            <SelectTrigger className="h-10 w-[150px]" aria-label="Filter by assignee">
              <SelectValue placeholder="Assignee" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All assignees</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.userId} value={m.userId}>{m.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="h-10 w-[140px]" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* PRO gate */}
      {calendarAllowed === null ? (
        <div className="grid grid-cols-7 gap-px rounded-xl border overflow-hidden">
          {Array.from({ length: 35 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-none" />
          ))}
        </div>
      ) : calendarAllowed === false ? (
        <EmptyState
          icon={Lock}
          title="Calendar view is a Pro feature"
          description="See every deadline, milestone, and due date on one calendar by upgrading your plan."
          action={<Button onClick={upgradeToBilling}>Upgrade</Button>}
        />
      ) : calendarQuery.isLoading ? (
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 gap-px pb-2">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} className="px-1 text-center text-[11px] font-medium text-muted-foreground">{w}</div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-px rounded-xl border overflow-hidden">
              {Array.from({ length: mode === 'month' ? 42 : 7 }).map((_, i) => (
                <Skeleton key={i} className={cn('w-full rounded-none', mode === 'month' ? 'h-24' : 'h-52')} />
              ))}
            </div>
          </div>
        </div>
      ) : calendarQuery.isError ? (
        <ErrorState
          message={calendarQuery.error instanceof Error ? calendarQuery.error.message : 'Failed to load calendar'}
          onRetry={() => calendarQuery.refetch()}
        />
      ) : totalItems === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={mode === 'month' ? 'No deadlines this month' : 'No deadlines this week'}
          description="Tasks with due dates and milestones will show up here. Try another month or clear the filters."
        />
      ) : (
        /* Grid — horizontal scroll on small screens */
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <div className="grid grid-cols-7 border-t border-l rounded-tl-xl" role="row" aria-label="Weekdays">
              {WEEKDAY_LABELS.map((w) => (
                <div key={w} className="border-b border-r bg-muted/40 px-2 py-1.5 text-center text-[11px] font-semibold text-muted-foreground">
                  {w}
                </div>
              ))}
            </div>
            <div
              className="grid grid-cols-7 border-x rounded-b-xl overflow-hidden"
              role="grid"
              aria-label={`${mode} calendar`}
            >
              {days.map((day) => {
                const key = dayKey(day)
                return (
                  <DayCell
                    key={key}
                    day={day}
                    tasks={tasksByDay.get(key) ?? []}
                    milestones={milestonesByDay.get(key) ?? []}
                    inMonth={mode === 'week' || day.getMonth() === cursor.getMonth()}
                    maxChips={mode === 'month' ? 3 : 6}
                    tall={mode === 'week'}
                  />
                )
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
