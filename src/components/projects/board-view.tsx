'use client'

/**
 * Kanban board tab — @dnd-kit sortable columns, inline task composer,
 * optimistic reorder with rollback, filters and keyboard-accessible card menu.
 */

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  DndContext, DragOverlay, PointerSensor, useDroppable, useSensor, useSensors,
  type DragEndEvent, type DragStartEvent,
} from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  CheckSquare, GripVertical, MessageSquare, MoreVertical, OctagonAlert, Paperclip, Plus, Search, X,
} from 'lucide-react'
import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { BOARD_COLUMNS, PRIORITIES, PRIORITY_LABEL, TASK_STATUS_COLOR, TASK_STATUS_LABEL } from '@/lib/constants'
import type { LabelDTO, Priority, PublicUser, Role, TaskDTO, TaskStatus, WorkspaceMemberDTO } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { DateChip, PriorityBadge, UserAvatar } from '@/components/shared/ui-primitives'
import {
  invalidateAfterTaskChange, useMutationErrorHandler, useUpgradeToast, useWorkspaceSession,
} from '@/components/projects/project-shared'
import { cn } from '@/lib/utils'

interface BoardViewProps {
  projectId: string
  tasks: TaskDTO[]
  labels: LabelDTO[]
  members: WorkspaceMemberDTO[]
}

type AssigneeFilter = 'ALL' | string
type LabelFilter = 'ALL' | string

export function BoardView({ projectId, tasks, labels, members }: BoardViewProps) {
  const { wsId, role } = useWorkspaceSession()
  const qc = useQueryClient()
  const onMutationError = useMutationErrorHandler()
  const upgradeToast = useUpgradeToast()
  const openTaskDialog = useAppStore((s) => s.openTaskDialog)

  const [assignee, setAssignee] = React.useState<AssigneeFilter>('ALL')
  const [priority, setPriority] = React.useState<'ALL' | Priority>('ALL')
  const [labelId, setLabelId] = React.useState<LabelFilter>('ALL')
  const [search, setSearch] = React.useState('')
  const [activeTaskId, setActiveTaskId] = React.useState<string | null>(null)
  const [composerColumn, setComposerColumn] = React.useState<TaskStatus | null>(null)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  const q = search.trim().toLowerCase()
  const boardTasks = React.useMemo(
    () =>
      tasks
        .filter((t) => t.status !== 'CANCELLED')
        .filter((t) => (assignee === 'ALL' ? true : assignee === 'NONE' ? !t.assignee : t.assignee?.id === assignee))
        .filter((t) => (priority === 'ALL' ? true : t.priority === priority))
        .filter((t) => (labelId === 'ALL' ? true : t.labels.some((l) => l.id === labelId)))
        .filter((t) => (q ? t.title.toLowerCase().includes(q) : true)),
    [tasks, assignee, priority, labelId, q]
  )

  const byStatus = React.useCallback(
    (status: TaskStatus) => boardTasks.filter((t) => t.status === status).sort((a, b) => a.position - b.position),
    [boardTasks]
  )
  const tasksById = React.useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks])
  const filtersActive = assignee !== 'ALL' || priority !== 'ALL' || labelId !== 'ALL' || q.length > 0

  const tasksKey = qk.projectTasks(projectId)

  // ------------------------------------------------------------- reorder (DnD / menu)
  const reorderMutation = useMutation({
    mutationFn: (vars: { taskId: string; status: TaskStatus; position: number }) =>
      api.post<{ ok: boolean }>('/api/tasks/reorder', vars),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: tasksKey })
      const prev = qc.getQueryData<{ tasks: TaskDTO[] }>(tasksKey)
      qc.setQueryData<{ tasks: TaskDTO[] }>(tasksKey, (old) =>
        old
          ? { tasks: old.tasks.map((t) => (t.id === vars.taskId ? { ...t, status: vars.status, position: vars.position } : t)) }
          : old
      )
      return { prev }
    },
    onSuccess: (_data, vars) => {
      toast.success(`Moved to ${TASK_STATUS_LABEL[vars.status]}`)
    },
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(tasksKey, ctx.prev)
      if (e instanceof ApiError && e.status === 402) upgradeToast('Task management')
      else toast.error(e instanceof Error ? e.message : 'Could not move task')
    },
    onSettled: (_data, _error, vars) => {
      qc.invalidateQueries({ queryKey: tasksKey })
      invalidateAfterTaskChange(qc, vars?.taskId, wsId)
    },
  })

  // ------------------------------------------------------------- create (composer)
  const createMutation = useMutation({
    mutationFn: (vars: { title: string; status: TaskStatus }) =>
      api.post<TaskDTO>(`/api/projects/${projectId}/tasks`, { title: vars.title, status: vars.status }),
    onSuccess: (task) => {
      toast.success('Task created')
      qc.invalidateQueries({ queryKey: tasksKey })
      if (wsId) qc.invalidateQueries({ queryKey: qk.dashboard(wsId) })
      return task
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) upgradeToast('Task creation')
      else onMutationError(e, undefined, 'Failed to create task')
    },
  })

  const handleDragStart = (event: DragStartEvent) => setActiveTaskId(String(event.active.id))

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveTaskId(null)
    const { active, over } = event
    if (!over || over.id === active.id) return
    const activeId = String(active.id)
    const activeStatus = active.data.current?.status as TaskStatus | undefined
    if (!activeStatus) return

    let targetStatus: TaskStatus
    let insertIndex: number
    if (String(over.id).startsWith('col:')) {
      targetStatus = String(over.id).slice(4) as TaskStatus
      insertIndex = byStatus(targetStatus).length
    } else {
      const overTask = tasksById.get(String(over.id))
      if (!overTask) return
      targetStatus = overTask.status
      const col = byStatus(targetStatus).filter((t) => t.id !== activeId)
      const found = col.findIndex((t) => t.id === overTask.id)
      insertIndex = found >= 0 ? found : col.length
    }

    // Position = midpoint between visible neighbors in the target column.
    const col = byStatus(targetStatus).filter((t) => t.id !== activeId)
    const prevPos = insertIndex > 0 ? col[insertIndex - 1]?.position : undefined
    const nextPos = insertIndex < col.length ? col[insertIndex]?.position : undefined
    const position =
      prevPos === undefined && nextPos === undefined
        ? 1000
        : prevPos === undefined
          ? (nextPos ?? 0) - 100
          : nextPos === undefined
            ? prevPos + 100
            : (prevPos + nextPos) / 2

    const current = tasksById.get(activeId)
    if (!current) return
    if (targetStatus === current.status && Math.abs(position - current.position) < 0.001) return

    reorderMutation.mutate({ taskId: activeId, status: targetStatus, position })
  }

  /** Keyboard-accessible alternative to DnD (card menu → Move to). */
  const moveTo = (task: TaskDTO, status: TaskStatus) => {
    const col = byStatus(status).filter((t) => t.id !== task.id)
    const lastPos = col.length > 0 ? col[col.length - 1].position : undefined
    const position = lastPos !== undefined ? lastPos + 100 : 1000
    if (status === task.status) return
    reorderMutation.mutate({ taskId: task.id, status, position })
  }

  const activeTask = activeTaskId ? tasksById.get(activeTaskId) : null
  const canDrag = role !== 'VIEWER'

  const clearFilters = () => {
    setAssignee('ALL')
    setPriority('ALL')
    setLabelId('ALL')
    setSearch('')
  }

  return (
    <div className="space-y-3">
      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1 rounded-lg border bg-background p-1" role="group" aria-label="Filter by assignee">
          <button
            onClick={() => setAssignee('ALL')}
            aria-pressed={assignee === 'ALL'}
            className={cn(
              'min-h-8 rounded-md px-2.5 text-xs font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring',
              assignee === 'ALL' ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60'
            )}
          >
            All
          </button>
          {members.map((m) => (
            <button
              key={m.id}
              onClick={() => setAssignee(assignee === m.userId ? 'ALL' : m.userId)}
              aria-pressed={assignee === m.userId}
              aria-label={`Filter by assignee ${m.name}`}
              title={m.name}
              className={cn(
                'rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring',
                assignee === m.userId ? 'ring-2 ring-primary ring-offset-2 ring-offset-background' : 'opacity-70 hover:opacity-100'
              )}
            >
              <UserAvatar name={m.name} color={m.avatarColor} size="xs" />
            </button>
          ))}
          {assignee !== 'ALL' && assignee !== 'NONE' && !members.some((m) => m.userId === assignee) && (
            <button onClick={() => setAssignee('ALL')} className="text-xs text-muted-foreground underline" aria-label="Clear assignee filter">
              clear
            </button>
          )}
        </div>

        <Select value={priority} onValueChange={(v) => setPriority(v as 'ALL' | Priority)}>
          <SelectTrigger size="sm" className="w-[120px]" aria-label="Filter by priority">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">Any priority</SelectItem>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {labels.length > 0 && (
          <Select value={labelId} onValueChange={(v) => setLabelId(v as LabelFilter)}>
            <SelectTrigger size="sm" className="w-[130px]" aria-label="Filter by label">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">Any label</SelectItem>
              {labels.map((l) => (
                <SelectItem key={l.id} value={l.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
                    {l.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <div className="relative min-w-[150px] flex-1 sm:max-w-[220px]">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search tasks…"
            aria-label="Search tasks"
            className="h-8 pl-8 text-sm"
          />
        </div>

        {filtersActive && (
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={clearFilters}>
            <X className="h-3.5 w-3.5" aria-hidden /> Clear
          </Button>
        )}
      </div>

      {/* Board */}
      <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd} onDragCancel={() => setActiveTaskId(null)}>
        <div className="flex gap-3 overflow-x-auto pb-2" role="list" aria-label="Task board">
          {BOARD_COLUMNS.map((status) => (
            <BoardColumn
              key={status}
              status={status}
              tasks={byStatus(status)}
              projectId={projectId}
              allTasks={tasks}
              canDrag={canDrag}
              role={role}
              onOpenTask={openTaskDialog}
              onMoveTo={moveTo}
              composerOpen={composerColumn === status}
              setComposerOpen={(open) => setComposerColumn(open ? status : null)}
              onCreate={(title) => createMutation.mutateAsync({ title, status }).catch(() => undefined)}
              creating={createMutation.isPending}
            />
          ))}
        </div>
        <DragOverlay dropAnimation={null}>
          {activeTask ? (
            <div className="w-[260px] rotate-2 rounded-lg border bg-card p-3 shadow-lg">
              <p className="text-sm font-medium leading-snug">{activeTask.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {boardTasks.length === 0 && tasks.length > 0 && filtersActive && (
        <p className="py-6 text-center text-sm text-muted-foreground">No tasks match the current filters.</p>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ column

function BoardColumn({
  status,
  tasks,
  projectId,
  allTasks,
  canDrag,
  role,
  onOpenTask,
  onMoveTo,
  composerOpen,
  setComposerOpen,
  onCreate,
  creating,
}: {
  status: TaskStatus
  tasks: TaskDTO[]
  projectId: string
  allTasks: TaskDTO[]
  canDrag: boolean
  role: Role | null
  onOpenTask: (taskId: string) => void
  onMoveTo: (task: TaskDTO, status: TaskStatus) => void
  composerOpen: boolean
  setComposerOpen: (open: boolean) => void
  onCreate: (title: string) => Promise<unknown>
  creating: boolean
}) {
  // Droppable column body so empty columns and blank space accept drops.
  const { setNodeRef, isOver } = useDroppable({ id: `col:${status}` })

  return (
    <section
      className="flex h-[65vh] min-h-[340px] w-[272px] min-w-[272px] shrink-0 flex-col rounded-xl border bg-muted/40"
      role="listitem"
      aria-label={`${TASK_STATUS_LABEL[status]} column, ${tasks.length} tasks`}
    >
      <header className="flex items-center gap-2 border-b px-3 py-2.5">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR[status] }} aria-hidden />
        <h3 className="text-sm font-semibold">{TASK_STATUS_LABEL[status]}</h3>
        <Badge variant="secondary" className="ml-auto text-[11px]" aria-label={`${tasks.length} tasks`}>
          {tasks.length}
        </Badge>
      </header>

      <div ref={setNodeRef} className={cn('flex-1 space-y-2 overflow-y-auto p-2', isOver && 'bg-accent/40 rounded-b-xl')}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          {tasks.map((task) => (
            <SortableTaskCard
              key={task.id}
              task={task}
              allTasks={allTasks}
              canDrag={canDrag}
              role={role}
              onOpenTask={onOpenTask}
              onMoveTo={onMoveTo}
            />
          ))}
        </SortableContext>
        {tasks.length === 0 && (
          <p className="rounded-lg border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">Drop tasks here</p>
        )}
      </div>

      <footer className="border-t p-2">
        {composerOpen ? (
          <ColumnComposer
            onSubmit={async (title) => {
              await onCreate(title)
            }}
            creating={creating}
            onClose={() => setComposerOpen(false)}
          />
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-1.5 text-muted-foreground"
            onClick={() => setComposerOpen(true)}
          >
            <Plus className="h-4 w-4" aria-hidden /> Add task
          </Button>
        )}
      </footer>
    </section>
  )
}

// ------------------------------------------------------------------ composer

function ColumnComposer({
  onSubmit,
  creating,
  onClose,
}: {
  onSubmit: (title: string) => Promise<unknown>
  creating: boolean
  onClose: () => void
}) {
  const [title, setTitle] = React.useState('')
  const inputRef = React.useRef<HTMLInputElement>(null)

  const submit = async () => {
    const trimmed = title.trim()
    if (!trimmed || creating) return
    await onSubmit(trimmed)
    setTitle('')
    inputRef.current?.focus()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
      className="space-y-1.5"
    >
      <Input
        ref={inputRef}
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose()
        }}
        placeholder="Task title"
        aria-label="New task title"
        autoFocus
        className="h-9 text-sm"
      />
      <div className="flex items-center gap-1.5">
        <Button type="submit" size="sm" className="h-8 flex-1" disabled={creating || !title.trim()}>
          {creating ? 'Adding…' : 'Add'}
        </Button>
        <Button type="button" variant="ghost" size="sm" className="h-8" onClick={onClose} aria-label="Cancel adding task">
          <X className="h-4 w-4" aria-hidden />
        </Button>
        <span className="hidden text-[10px] text-muted-foreground sm:block">Enter ↵</span>
      </div>
    </form>
  )
}

// ------------------------------------------------------------------ task card

function SortableTaskCard({
  task,
  allTasks,
  canDrag,
  role,
  onOpenTask,
  onMoveTo,
}: {
  task: TaskDTO
  allTasks: TaskDTO[]
  canDrag: boolean
  role: Role | null
  onOpenTask: (taskId: string) => void
  onMoveTo: (task: TaskDTO, status: TaskStatus) => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: task.id,
    data: { status: task.status },
    disabled: !canDrag,
  })

  const style: React.CSSProperties = {
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 30 : undefined,
  }

  const parent = task.parentTaskId ? allTasks.find((t) => t.id === task.parentTaskId) : null
  const shownLabels = task.labels.slice(0, 2)
  const extraLabels = task.labels.length - shownLabels.length

  return (
    <li
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className={cn(
        'group relative cursor-grab touch-none list-none rounded-lg border bg-card p-2.5 shadow-xs transition-shadow hover:shadow-sm active:cursor-grabbing',
        isDragging && 'opacity-40 ring-2 ring-primary/50'
      )}
      aria-label={`Task ${task.title}`}
    >
      <div className="flex items-start gap-1.5">
        {canDrag && (
          <span className="mt-0.5 text-muted-foreground/0 transition-colors group-hover:text-muted-foreground/70" aria-hidden>
            <GripVertical className="h-3.5 w-3.5" />
          </span>
        )}
        <button
          onClick={() => onOpenTask(task.id)}
          className="flex-1 text-left text-sm font-medium leading-snug outline-none focus-visible:ring-2 focus-visible:ring-ring rounded"
        >
          {task.title}
        </button>
        <TaskCardMenu task={task} role={role} onOpenTask={onOpenTask} onMoveTo={onMoveTo} />
      </div>

      {(task.labels.length > 0 || parent) && (
        <div className="mt-1.5 flex flex-wrap items-center gap-1">
          {shownLabels.map((l) => (
            <span
              key={l.id}
              className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[10px] font-medium"
              style={{ color: l.color, borderColor: `${l.color}55`, backgroundColor: `${l.color}14` }}
            >
              <span className="h-1 w-1 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
              {l.name}
            </span>
          ))}
          {extraLabels > 0 && (
            <span className="text-[10px] text-muted-foreground" title={task.labels.slice(2).map((l) => l.name).join(', ')}>
              +{extraLabels}
            </span>
          )}
          {parent && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-muted px-1.5 py-px text-[10px] text-muted-foreground max-w-[120px]">
                  <CheckSquare className="h-2.5 w-2.5 shrink-0" aria-hidden />
                  <span className="truncate">{parent.title}</span>
                </span>
              </TooltipTrigger>
              <TooltipContent>Subtask of “{parent.title}”</TooltipContent>
            </Tooltip>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <PriorityBadge priority={task.priority} className="h-5 px-1.5 text-[10px]" />
        {task.dueDate && <DateChip date={task.dueDate} className="text-[11px]" />}
        <span className="ml-auto flex items-center gap-2 text-[11px] text-muted-foreground">
          {task.blockedByOpenCount > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex items-center text-destructive" aria-label={`Blocked by ${task.blockedByOpenCount} open tasks`}>
                  <OctagonAlert className="h-3.5 w-3.5" />
                </span>
              </TooltipTrigger>
              <TooltipContent>Blocked by {task.blockedByOpenCount} open {task.blockedByOpenCount === 1 ? 'task' : 'tasks'}</TooltipContent>
            </Tooltip>
          )}
          {task.commentCount > 0 && (
            <span className="inline-flex items-center gap-0.5" aria-label={`${task.commentCount} comments`}>
              <MessageSquare className="h-3 w-3" aria-hidden /> {task.commentCount}
            </span>
          )}
          {task.attachmentCount > 0 && (
            <span className="inline-flex items-center gap-0.5" aria-label={`${task.attachmentCount} attachments`}>
              <Paperclip className="h-3 w-3" aria-hidden /> {task.attachmentCount}
            </span>
          )}
          {task.subtaskCount > 0 && (
            <span className="inline-flex items-center gap-0.5" aria-label={`${task.subtaskDoneCount}/${task.subtaskCount} subtasks`}>
              <CheckSquare className="h-3 w-3" aria-hidden /> {task.subtaskDoneCount}/{task.subtaskCount}
            </span>
          )}
          {task.assignee ? (
            <UserAvatar name={task.assignee.name} color={task.assignee.avatarColor} size="xs" />
          ) : (
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-dashed text-[8px] text-muted-foreground" aria-label="Unassigned">
              ?
            </span>
          )}
        </span>
      </div>
    </li>
  )
}

function TaskCardMenu({
  task,
  role,
  onOpenTask,
  onMoveTo,
}: {
  task: TaskDTO
  role: Role | null
  onOpenTask: (taskId: string) => void
  onMoveTo: (task: TaskDTO, status: TaskStatus) => void
}) {
  const canMove = role !== 'VIEWER'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="rounded p-1 text-muted-foreground opacity-0 outline-none transition-opacity hover:bg-accent focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-ring group-hover:opacity-100 data-[state=open]:opacity-100"
          aria-label={`Actions for task ${task.title}`}
        >
          <MoreVertical className="h-3.5 w-3.5" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <DropdownMenuItem onClick={() => onOpenTask(task.id)}>Open details</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuSub>
          <DropdownMenuSubTrigger disabled={!canMove}>Move to</DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {BOARD_COLUMNS.map((s) => (
              <DropdownMenuItem key={s} disabled={s === task.status} onClick={() => onMoveTo(task, s)}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR[s] }} aria-hidden />
                {TASK_STATUS_LABEL[s]}
                {s === task.status && <span className="ml-auto text-[10px] text-muted-foreground">current</span>}
              </DropdownMenuItem>
            ))}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
