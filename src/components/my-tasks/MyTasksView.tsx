'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CheckSquare, Search, ChevronDown, MessageCircle, Paperclip, AlertCircle,
  FolderKanban, X,
} from 'lucide-react'

import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import {
  TASK_STATUSES, TASK_STATUS_LABEL, TASK_STATUS_COLOR, OPEN_STATUSES,
  PRIORITIES, PRIORITY_LABEL,
} from '@/lib/constants'
import { canEditTask } from '@/lib/permissions'
import type { Priority, TaskDTO, TaskStatus } from '@/types'
import {
  StatusBadge, PriorityBadge, LabelChip, DateChip, UserAvatar, EmptyState,
  ErrorState, TableSkeleton, isOverdue, formatRelativeTime,
} from '@/components/shared/ui-primitives'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Badge } from '@/components/ui/badge'

type MyTasksResponse = { tasks: TaskDTO[] }

// ---------------------------------------------------------------- date utils
function startOfToday(): Date {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d)
  c.setDate(c.getDate() + n)
  return c
}
const DAY = 86_400_000

const PRIORITY_WEIGHT: Record<Priority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 }

function byDueDate(a: TaskDTO, b: TaskDTO): number {
  if (!a.dueDate && !b.dueDate) return PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority]
  if (!a.dueDate) return 1
  if (!b.dueDate) return -1
  return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime()
}

// ---------------------------------------------------------------- grouping
interface Section {
  key: string
  title: string
  defaultOpen: boolean
  dotColor?: string
  tasks: TaskDTO[]
}

function groupTasks(tasks: TaskDTO[]): Section[] {
  const today = startOfToday().getTime()
  const soonEnd = addDays(startOfToday(), 7).getTime()
  const isOpen = (t: TaskDTO) => OPEN_STATUSES.includes(t.status)

  const overdue = tasks.filter((t) => isOpen(t) && t.dueDate && new Date(t.dueDate).getTime() < today).sort(byDueDate)
  const dueSoon = tasks
    .filter((t) => isOpen(t) && t.dueDate && new Date(t.dueDate).getTime() >= today && new Date(t.dueDate).getTime() <= soonEnd)
    .sort(byDueDate)
  const upcoming = tasks.filter((t) => isOpen(t) && t.dueDate && new Date(t.dueDate).getTime() > soonEnd).sort(byDueDate)
  const noDue = tasks.filter((t) => isOpen(t) && !t.dueDate).sort(byDueDate)
  const recentlyCompleted = tasks
    .filter((t) => t.status === 'DONE' && t.completedAt && Date.now() - new Date(t.completedAt).getTime() < 7 * DAY)
    .sort((a, b) => new Date(b.completedAt ?? 0).getTime() - new Date(a.completedAt ?? 0).getTime())

  return [
    { key: 'overdue', title: 'Overdue', defaultOpen: true, dotColor: '#ef4444', tasks: overdue },
    { key: 'due-soon', title: 'Due soon', defaultOpen: true, dotColor: '#f59e0b', tasks: dueSoon },
    { key: 'upcoming', title: 'Upcoming', defaultOpen: true, dotColor: 'var(--primary)', tasks: upcoming },
    { key: 'no-due', title: 'No due date', defaultOpen: true, tasks: noDue },
    { key: 'completed', title: 'Recently completed', defaultOpen: false, dotColor: '#22c55e', tasks: recentlyCompleted },
  ]
}

// ---------------------------------------------------------------- task row
function StatusSelect({ task, disabled }: { task: TaskDTO; disabled?: boolean }) {
  const changeStatus = useChangeStatus()
  const options = TASK_STATUSES.filter((s) => s !== task.status)

  if (disabled || options.length === 0) return <StatusBadge status={task.status} />

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          onClick={(e) => e.stopPropagation()}
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Change status for ${task.title}, currently ${TASK_STATUS_LABEL[task.status]}`}
        >
          <StatusBadge status={task.status} className="cursor-pointer hover:opacity-80" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-44" onClick={(e) => e.stopPropagation()}>
        {options.map((s) => (
          <DropdownMenuItem
            key={s}
            onSelect={() => changeStatus.mutate({ id: task.id, status: s })}
            className="gap-2"
          >
            <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR[s] }} aria-hidden />
            {TASK_STATUS_LABEL[s]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function TaskRow({ task, editable }: { task: TaskDTO; editable: boolean }) {
  const openTaskDialog = useAppStore((s) => s.openTaskDialog)
  const openProject = useAppStore((s) => s.openProject)
  const isDone = task.status === 'DONE'
  const overdue = !isDone && isOverdue(task.dueDate)
  const visibleLabels = task.labels.slice(0, 2)
  const extraLabels = task.labels.length - visibleLabels.length

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      openTaskDialog(task.id)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => openTaskDialog(task.id)}
      onKeyDown={handleKeyDown}
      aria-label={`Open task ${task.title}`}
      className={cn(
        'group flex min-h-[44px] w-full cursor-pointer items-center gap-3 rounded-lg border border-transparent px-3 py-2 outline-none transition-colors',
        'focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring hover:border-border hover:bg-accent/50',
        overdue && 'bg-destructive/[0.03]'
      )}
    >
      <StatusSelect task={task} disabled={!editable} />

      {/* Title + labels */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className={cn('truncate text-sm font-medium', isDone && 'text-muted-foreground line-through')}>
            {task.title}
          </span>
          {visibleLabels.map((l) => (
            <LabelChip key={l.id} label={l} className="hidden shrink-0 md:inline-flex" />
          ))}
          {extraLabels > 0 && (
            <span className="hidden shrink-0 text-[11px] text-muted-foreground md:inline">+{extraLabels}</span>
          )}
        </div>
        {/* Mobile-only meta line */}
        <div className="mt-0.5 flex items-center gap-2 md:hidden">
          <span className="inline-flex items-center gap-1.5 truncate text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: task.projectColor }} aria-hidden />
            {task.projectName}
          </span>
        </div>
      </div>

      {/* Project (desktop) */}
      <button
        onClick={(e) => { e.stopPropagation(); openProject(task.projectId) }}
        className="hidden shrink-0 items-center gap-1.5 rounded-md px-1.5 py-1 text-xs text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring md:inline-flex"
        aria-label={`Open project ${task.projectName}`}
      >
        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.projectColor }} aria-hidden />
        <span className="max-w-32 truncate">{task.projectName}</span>
      </button>

      <PriorityBadge priority={task.priority} className="hidden shrink-0 sm:inline-flex" />

      {/* Due / completed date */}
      {isDone && task.completedAt ? (
        <span className="shrink-0 text-xs text-muted-foreground" title={`Completed ${formatRelativeTime(task.completedAt)}`}>
          {formatRelativeTime(task.completedAt)}
        </span>
      ) : task.dueDate ? (
        <DateChip date={task.dueDate} className="shrink-0" />
      ) : (
        <span className="w-14 shrink-0" aria-hidden />
      )}

      {/* Counts */}
      <span className="hidden shrink-0 items-center gap-2.5 text-xs text-muted-foreground lg:flex">
        {task.commentCount > 0 && (
          <span className="inline-flex items-center gap-1" aria-label={`${task.commentCount} comments`}>
            <MessageCircle className="h-3.5 w-3.5" /> {task.commentCount}
          </span>
        )}
        {task.attachmentCount > 0 && (
          <span className="inline-flex items-center gap-1" aria-label={`${task.attachmentCount} attachments`}>
            <Paperclip className="h-3.5 w-3.5" /> {task.attachmentCount}
          </span>
        )}
        {task.subtaskCount > 0 && (
          <span className="inline-flex items-center gap-1" aria-label={`${task.subtaskDoneCount} of ${task.subtaskCount} subtasks done`}>
            <CheckSquare className="h-3.5 w-3.5" /> {task.subtaskDoneCount}/{task.subtaskCount}
          </span>
        )}
      </span>

      {task.assignee && <UserAvatar name={task.assignee.name} color={task.assignee.avatarColor} size="xs" className="hidden shrink-0 sm:block" />}
    </div>
  )
}

// ---------------------------------------------------------------- status mutation
function useChangeStatus() {
  const qc = useQueryClient()
  const wsId = useAppStore((s) => s.session?.currentWorkspaceId ?? '')

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: TaskStatus }) =>
      api.patch<TaskDTO>(`/api/tasks/${id}`, { status }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: qk.myTasks(wsId) })
      const prev = qc.getQueryData<MyTasksResponse>(qk.myTasks(wsId))
      if (prev) {
        qc.setQueryData<MyTasksResponse>(qk.myTasks(wsId), {
          tasks: prev.tasks.map((t) =>
            t.id === id ? { ...t, status, completedAt: status === 'DONE' ? new Date().toISOString() : null } : t
          ),
        })
      }
      return { prev }
    },
    onSuccess: (updated) => {
      toast.success(`Task moved to ${TASK_STATUS_LABEL[updated.status]}`)
    },
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.myTasks(wsId), ctx.prev)
      toast.error(e instanceof ApiError ? e.message : 'Failed to update task status')
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: qk.myTasks(wsId) })
      qc.invalidateQueries({ queryKey: qk.task(vars.id) })
      qc.invalidateQueries({ queryKey: qk.dashboard(wsId) })
    },
  })
}

// ---------------------------------------------------------------- section
function TaskSection({ section }: { section: Section }) {
  const [open, setOpen] = React.useState(section.defaultOpen)
  const editableFor = useEditable()
  if (section.tasks.length === 0) return null

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          className="flex w-full min-h-[44px] items-center gap-2 rounded-lg px-1 py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-expanded={open}
        >
          <ChevronDown className={cn('h-4 w-4 shrink-0 text-muted-foreground transition-transform', !open && '-rotate-90')} aria-hidden />
          {section.dotColor && (
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: section.dotColor }} aria-hidden />
          )}
          <h2 className="text-sm font-semibold">{section.title}</h2>
          <Badge variant="secondary" className="ml-1 rounded-full text-[11px] tabular-nums">
            {section.tasks.length}
          </Badge>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="space-y-1 pb-2 pl-1">
          {section.tasks.map((t) => (
            <TaskRow key={t.id} task={t} editable={editableFor(t)} />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

function useEditable() {
  const role = useAppStore((s) => s.currentWorkspace()?.role ?? null)
  const userId = useAppStore((s) => s.session?.user.id ?? '')
  return React.useCallback(
    (task: TaskDTO) =>
      canEditTask(role, { creatorId: task.creator.id, assigneeId: task.assignee?.id ?? null }, userId),
    [role, userId]
  )
}

// ---------------------------------------------------------------- summary chips
function SummaryChip({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <span
      className={cn(
        'inline-flex min-h-[28px] items-center gap-1.5 rounded-full border bg-card px-3 py-1 text-xs font-medium',
        count > 0 && label === 'Overdue' && 'border-destructive/30 text-destructive'
      )}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} aria-hidden />
      {label}
      <span className="tabular-nums">{count}</span>
    </span>
  )
}

// ---------------------------------------------------------------- main view
export default function MyTasksView() {
  const wsId = useAppStore((s) => s.session?.currentWorkspaceId ?? null)
  const navigate = useAppStore((s) => s.navigate)

  const [search, setSearch] = React.useState('')
  const [projectFilter, setProjectFilter] = React.useState('all')
  const [priorityFilter, setPriorityFilter] = React.useState('all')

  const { data, isPending, isError, error, refetch } = useQuery({
    queryKey: qk.myTasks(wsId ?? 'none'),
    queryFn: async () => {
      const res = await api.get<{ tasks: TaskDTO[] } | TaskDTO[] | null>(`/api/workspaces/${wsId}/my-tasks`)
      if (!res) throw new ApiError(503, 'Your task list is unavailable right now.')
      return Array.isArray(res) ? { tasks: res } : res
    },
    enabled: !!wsId,
  })

  const allTasks = data?.tasks ?? []
  const today = startOfToday().getTime()
  const isOpen = (t: TaskDTO) => OPEN_STATUSES.includes(t.status)
  const overdueCount = allTasks.filter((t) => isOpen(t) && t.dueDate && new Date(t.dueDate).getTime() < today).length
  const dueSoonCount = allTasks
    .filter((t) => isOpen(t) && t.dueDate && new Date(t.dueDate).getTime() >= today && new Date(t.dueDate).getTime() <= addDays(startOfToday(), 7).getTime())
    .length
  const openCount = allTasks.filter(isOpen).length

  const projects = React.useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>()
    for (const t of allTasks) if (!map.has(t.projectId)) map.set(t.projectId, { id: t.projectId, name: t.projectName, color: t.projectColor })
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name))
  }, [allTasks])

  const filteredTasks = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    return allTasks.filter((t) => {
      if (q && !t.title.toLowerCase().includes(q)) return false
      if (projectFilter !== 'all' && t.projectId !== projectFilter) return false
      if (priorityFilter !== 'all' && t.priority !== priorityFilter) return false
      return true
    })
  }, [allTasks, search, projectFilter, priorityFilter])

  const sections = React.useMemo(() => groupTasks(filteredTasks), [filteredTasks])

  if (!wsId) return null

  const hasFilters = search.trim() !== '' || projectFilter !== 'all' || priorityFilter !== 'all'

  const clearFilters = () => {
    setSearch('')
    setProjectFilter('all')
    setPriorityFilter('all')
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold tracking-tight sm:text-2xl">My Tasks</h1>
        <div className="flex flex-wrap items-center gap-2" aria-label="Task summary">
          <SummaryChip label="Overdue" count={overdueCount} color="#ef4444" />
          <SummaryChip label="Due soon" count={dueSoonCount} color="#f59e0b" />
          <SummaryChip label="Open" count={openCount} color="var(--primary)" />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-0 flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search my tasks"
            className="h-10 pl-9 sm:h-9"
          />
        </div>
        <Select value={projectFilter} onValueChange={setProjectFilter}>
          <SelectTrigger className="h-10 w-[170px] sm:h-9" aria-label="Filter by project">
            <SelectValue placeholder="All projects" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All projects</SelectItem>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden />
                  {p.name}
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={priorityFilter} onValueChange={setPriorityFilter}>
          <SelectTrigger className="h-10 w-[160px] sm:h-9" aria-label="Filter by priority">
            <SelectValue placeholder="All priorities" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All priorities</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {hasFilters && (
          <Button variant="ghost" size="sm" className="min-h-[36px] gap-1.5 text-muted-foreground" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear
          </Button>
        )}
      </div>

      {/* Content */}
      {isError && !data ? (
        <ErrorState
          message={error instanceof ApiError ? error.message : 'Failed to load your tasks.'}
          onRetry={() => refetch()}
        />
      ) : isPending ? (
        <TableSkeleton rows={7} />
      ) : allTasks.length === 0 ? (
        <EmptyState
          icon={CheckSquare}
          title="No tasks assigned to you."
          description="When teammates assign work to you, it will show up here."
          action={
            <button
              onClick={() => navigate('projects')}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <FolderKanban className="h-4 w-4" /> Browse projects
            </button>
          }
        />
      ) : filteredTasks.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-12 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <AlertCircle className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold">No tasks match your filters</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">Try adjusting the search, project, or priority filters.</p>
          <Button variant="outline" size="sm" className="mt-4 min-h-[36px] gap-1.5" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" /> Clear filters
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {sections.every((s) => s.tasks.length === 0) ? (
            <p className="rounded-xl border border-dashed py-10 text-center text-sm text-muted-foreground">
              No open tasks right now. Nice work!
            </p>
          ) : (
            sections.map((section) => <TaskSection key={section.key} section={section} />)
          )}
        </div>
      )}
    </div>
  )
}
