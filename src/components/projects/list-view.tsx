'use client'

/**
 * List tab — sortable table with inline status/priority selects, optional
 * grouping by status and bulk operations (status/priority/delete).
 */

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ArrowDown, ArrowUp, ArrowUpDown, Layers, Trash2, X } from 'lucide-react'
import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { can, canEditTask } from '@/lib/permissions'
import { BOARD_COLUMNS, PRIORITIES, PRIORITY_LABEL, TASK_STATUSES, TASK_STATUS_COLOR, TASK_STATUS_LABEL } from '@/lib/constants'
import type { Priority, PublicUser, Role, TaskDTO, TaskStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { EmptyState, PriorityBadge, StatusBadge, UserAvatar } from '@/components/shared/ui-primitives'
import { invalidateAfterTaskChange, useMutationErrorHandler, useUpgradeToast } from '@/components/projects/project-shared'
import { cn } from '@/lib/utils'

interface ListViewProps {
  projectId: string
  tasks: TaskDTO[]
  role: Role | null
  me: PublicUser | null
  wsId: string | null
  onGoToBoard: () => void
}

type SortKey = 'title' | 'status' | 'priority' | 'assignee' | 'dueDate' | 'updatedAt'
const STATUS_ORDER: TaskStatus[] = [...BOARD_COLUMNS, 'CANCELLED']
const PRIORITY_ORDER: Priority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT']

export function ListView({ projectId, tasks, role, me, wsId, onGoToBoard }: ListViewProps) {
  const qc = useQueryClient()
  const openTaskDialog = useAppStore((s) => s.openTaskDialog)
  const onMutationError = useMutationErrorHandler()
  const upgradeToast = useUpgradeToast()

  const [sort, setSort] = React.useState<{ key: SortKey; dir: 'asc' | 'desc' }>({ key: 'updatedAt', dir: 'desc' })
  const [grouped, setGrouped] = React.useState(false)
  const [selected, setSelected] = React.useState<Set<string>>(new Set())
  const [confirmDelete, setConfirmDelete] = React.useState(false)

  const tasksKey = qk.projectTasks(projectId)
  const canBulk = can(role, 'task.edit_any')

  const editableFor = React.useCallback(
    (t: TaskDTO) => (me ? canEditTask(role, { creatorId: t.creator.id, assigneeId: t.assignee?.id ?? null }, me.id) : false),
    [role, me]
  )

  const sorted = React.useMemo(() => {
    const dir = sort.dir === 'asc' ? 1 : -1
    const cmp = (a: TaskDTO, b: TaskDTO): number => {
      switch (sort.key) {
        case 'title':
          return a.title.localeCompare(b.title)
        case 'status':
          return STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status)
        case 'priority':
          return PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority)
        case 'assignee':
          return (a.assignee?.name ?? '~unassigned').localeCompare(b.assignee?.name ?? '~unassigned')
        case 'dueDate': {
          const av = a.dueDate ? new Date(a.dueDate).getTime() : Number.POSITIVE_INFINITY
          const bv = b.dueDate ? new Date(b.dueDate).getTime() : Number.POSITIVE_INFINITY
          return av - bv
        }
        case 'updatedAt':
          return new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      }
    }
    return [...tasks].sort((a, b) => cmp(a, b) * dir)
  }, [tasks, sort])

  const groups: { status: TaskStatus; tasks: TaskDTO[] }[] = React.useMemo(() => {
    if (!grouped) return [{ status: 'TODO', tasks: sorted }]
    return STATUS_ORDER.map((status) => ({ status, tasks: sorted.filter((t) => t.status === status) })).filter((g) => g.tasks.length > 0)
  }, [grouped, sorted])

  const setTaskInCache = (taskId: string, patch: Partial<TaskDTO>) => {
    qc.setQueryData<{ tasks: TaskDTO[] }>(tasksKey, (old) =>
      old ? { tasks: old.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)) } : old
    )
  }

  const inlineUpdate = useMutation({
    mutationFn: (vars: { taskId: string; patch: Partial<TaskDTO> }) => api.patch<TaskDTO>(`/api/tasks/${vars.taskId}`, vars.patch),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: tasksKey })
      const prev = qc.getQueryData<{ tasks: TaskDTO[] }>(tasksKey)
      setTaskInCache(vars.taskId, vars.patch)
      return { prev }
    },
    onSuccess: () => toast.success('Task updated'),
    onError: (e, vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(tasksKey, ctx.prev)
      if (e instanceof ApiError && e.status === 402) upgradeToast('Task editing')
      else toast.error(e instanceof Error ? e.message : 'Could not update task')
    },
    onSettled: (_d, _e, vars) => {
      qc.invalidateQueries({ queryKey: tasksKey })
      invalidateAfterTaskChange(qc, vars?.taskId, wsId)
    },
  })

  const bulkMutation = useMutation({
    mutationFn: (vars: { taskIds: string[]; action: 'status' | 'priority' | 'delete'; value?: string }) =>
      api.post<{ ok: boolean }>('/api/tasks/bulk', vars),
    onSuccess: (_d, vars) => {
      toast.success(
        vars.action === 'delete'
          ? `Deleted ${vars.taskIds.length} ${vars.taskIds.length === 1 ? 'task' : 'tasks'}`
          : 'Tasks updated'
      )
      setSelected(new Set())
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) upgradeToast('Bulk task editing')
      else onMutationError(e, undefined, 'Bulk update failed')
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: tasksKey })
      qc.invalidateQueries({ queryKey: ['task'] })
      invalidateAfterTaskChange(qc, null, wsId)
    },
  })

  const toggleSort = (key: SortKey) => {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: key === 'updatedAt' ? 'desc' : 'asc' }))
  }

  const visibleIds = sorted.map((t) => t.id)
  const allSelected = visibleIds.length > 0 && visibleIds.every((id) => selected.has(id))
  const someSelected = visibleIds.some((id) => selected.has(id))

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(visibleIds))
  }
  const toggleOne = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  if (tasks.length === 0) {
    return (
      <EmptyState
        icon={Layers}
        title="No tasks yet"
        description="Break this project down into tasks and track them here."
        action={
          can(role, 'task.create') ? (
            <Button onClick={onGoToBoard}>
              <Layers className="h-4 w-4" aria-hidden /> Add tasks on the board
            </Button>
          ) : undefined
        }
      />
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">{tasks.length} tasks{tasks.some((t) => t.status === 'CANCELLED') ? ' · includes cancelled' : ''}</p>
        <Button
          variant={grouped ? 'secondary' : 'outline'}
          size="sm"
          className="min-h-8 gap-1.5"
          aria-pressed={grouped}
          onClick={() => setGrouped((g) => !g)}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden /> Group by status
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <Table className="min-w-[820px]">
          <TableHeader>
            <TableRow>
              {canBulk && (
                <TableHead className="w-10">
                  <Checkbox
                    checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                    onCheckedChange={toggleAll}
                    aria-label="Select all tasks"
                  />
                </TableHead>
              )}
              <SortableHead label="Title" k="title" sort={sort} onToggle={toggleSort} />
              <SortableHead label="Status" k="status" sort={sort} onToggle={toggleSort} />
              <SortableHead label="Priority" k="priority" sort={sort} onToggle={toggleSort} />
              <SortableHead label="Assignee" k="assignee" sort={sort} onToggle={toggleSort} />
              <SortableHead label="Due" k="dueDate" sort={sort} onToggle={toggleSort} />
              <TableHead>Labels</TableHead>
              <SortableHead label="Updated" k="updatedAt" sort={sort} onToggle={toggleSort} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {groups.map((group) => (
              <React.Fragment key={group.status}>
                {grouped && (
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableCell colSpan={canBulk ? 8 : 7} className="py-1.5">
                      <span className="flex items-center gap-1.5 text-xs font-semibold">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR[group.status] }} aria-hidden />
                        {TASK_STATUS_LABEL[group.status]}
                        <span className="text-muted-foreground">({group.tasks.length})</span>
                      </span>
                    </TableCell>
                  </TableRow>
                )}
                {group.tasks.map((t) => (
                  <TableRow
                    key={t.id}
                    className={cn(t.status === 'CANCELLED' && 'opacity-60')}
                  >
                    {canBulk && (
                      <TableCell>
                        <Checkbox
                          checked={selected.has(t.id)}
                          onCheckedChange={() => toggleOne(t.id)}
                          aria-label={`Select task ${t.title}`}
                        />
                      </TableCell>
                    )}
                    <TableCell className="max-w-[280px]">
                      <button
                        onClick={() => openTaskDialog(t.id)}
                        className="block w-full truncate rounded text-left text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring hover:underline"
                        title={t.title}
                      >
                        {t.status === 'CANCELLED' ? <s>{t.title}</s> : t.title}
                      </button>
                    </TableCell>
                    <TableCell>
                      {editableFor(t) ? (
                        <Select value={t.status} onValueChange={(v) => inlineUpdate.mutate({ taskId: t.id, patch: { status: v as TaskStatus } })}>
                          <SelectTrigger size="sm" className="w-[130px]" aria-label={`Status of ${t.title}`}>
                            <span className="flex items-center gap-1.5">
                              <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR[t.status] }} aria-hidden />
                              <SelectValue />
                            </span>
                          </SelectTrigger>
                          <SelectContent>
                            {TASK_STATUSES.map((s) => (
                              <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <StatusBadge status={t.status} />
                      )}
                    </TableCell>
                    <TableCell>
                      {editableFor(t) ? (
                        <Select value={t.priority} onValueChange={(v) => inlineUpdate.mutate({ taskId: t.id, patch: { priority: v as Priority } })}>
                          <SelectTrigger size="sm" className="w-[110px]" aria-label={`Priority of ${t.title}`}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {PRIORITIES.map((p) => (
                              <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <PriorityBadge priority={t.priority} />
                      )}
                    </TableCell>
                    <TableCell>
                      {t.assignee ? (
                        <span className="flex items-center gap-1.5">
                          <UserAvatar name={t.assignee.name} color={t.assignee.avatarColor} size="xs" />
                          <span className="hidden max-w-[120px] truncate text-sm lg:block">{t.assignee.name}</span>
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">Unassigned</span>
                      )}
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-sm">{t.dueDate ? new Date(t.dueDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'}</TableCell>
                    <TableCell>
                      <span className="flex max-w-[160px] flex-wrap gap-1">
                        {t.labels.slice(0, 2).map((l) => (
                          <span
                            key={l.id}
                            className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium"
                            style={{ color: l.color, borderColor: `${l.color}55`, backgroundColor: `${l.color}14` }}
                          >
                            {l.name}
                          </span>
                        ))}
                        {t.labels.length > 2 && <span className="text-[10px] text-muted-foreground">+{t.labels.length - 2}</span>}
                      </span>
                    </TableCell>
                    <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                      {formatRelative(t.updatedAt)}
                    </TableCell>
                  </TableRow>
                ))}
              </React.Fragment>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Bulk action bar */}
      {canBulk && selected.size > 0 && (
        <div className="sticky bottom-4 z-20 mx-auto flex w-fit max-w-full flex-wrap items-center gap-2 rounded-xl border bg-background/95 p-2 shadow-lg backdrop-blur">
          <span className="px-1 text-sm font-medium">{selected.size} selected</span>
          <Select onValueChange={(v) => bulkMutation.mutate({ taskIds: [...selected], action: 'status', value: v })}>
            <SelectTrigger size="sm" className="w-[130px]" aria-label="Set status for selected tasks">
              <SelectValue placeholder="Set status" />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select onValueChange={(v) => bulkMutation.mutate({ taskIds: [...selected], action: 'priority', value: v })}>
            <SelectTrigger size="sm" className="w-[130px]" aria-label="Set priority for selected tasks">
              <SelectValue placeholder="Set priority" />
            </SelectTrigger>
            <SelectContent>
              {PRIORITIES.map((p) => (
                <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="destructive" size="sm" className="min-h-8 gap-1.5" onClick={() => setConfirmDelete(true)} disabled={bulkMutation.isPending}>
            <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete
          </Button>
          <Button variant="ghost" size="sm" className="min-h-8" onClick={() => setSelected(new Set())} aria-label="Clear selection">
            <X className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      )}

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {selected.size} {selected.size === 1 ? 'task' : 'tasks'}?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the selected tasks along with their comments and attachments. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={() => bulkMutation.mutate({ taskIds: [...selected], action: 'delete' })}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ------------------------------------------------------------------ helpers

function SortableHead({ label, k, sort, onToggle }: { label: string; k: SortKey; sort: { key: SortKey; dir: 'asc' | 'desc' }; onToggle: (k: SortKey) => void }) {
  const active = sort.key === k
  const Icon = active ? (sort.dir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown
  return (
    <TableHead>
      <button
        onClick={() => onToggle(k)}
        aria-label={`Sort by ${label}`}
        className={cn(
          'inline-flex items-center gap-1 rounded text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
          active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
        )}
      >
        {label}
        <Icon className="h-3 w-3" aria-hidden />
      </button>
    </TableHead>
  )
}

function formatRelative(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}
