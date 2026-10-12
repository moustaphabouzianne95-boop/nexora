'use client'

/**
 * Global TaskDialog — mounted once in page.tsx; opens when the store's
 * taskDialogTaskId is set. Shows task details with inline editing (title,
 * status, priority, assignee, due date, labels, description), subtasks,
 * dependencies, attachments, comments and activity.
 */

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  CalendarDays, Check, ChevronsUpDown, Loader2, OctagonAlert, Plus, Tag, User as UserIcon,
} from 'lucide-react'
import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { can, canEditTask } from '@/lib/permissions'
import { PRIORITIES, PRIORITY_LABEL, PROJECT_COLORS, TASK_STATUSES, TASK_STATUS_COLOR, TASK_STATUS_LABEL } from '@/lib/constants'
import type { LabelDTO, Priority, PublicUser, Role, TaskDTO, TaskStatus, WorkspaceMemberDTO } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { UserAvatar, formatDateTime } from '@/components/shared/ui-primitives'
import {
  dateInputValue, invalidateAfterTaskChange, isoFromDateInput, useEntitlements, useMutationErrorHandler,
  useUpgradeToast, useWorkspaceSession,
} from '@/components/projects/project-shared'
import { patchTaskEnvelope, taskEditInput, applyTaskPatch, type TaskPatchInput, type TaskDetailEnvelope } from '@/components/tasks/task-helpers'
import { ActivitySection, AttachmentsSection, CommentsSection, DependenciesSection, SubtasksSection } from '@/components/tasks/task-sections'

export default function TaskDialog() {
  const taskId = useAppStore((s) => s.taskDialogTaskId)
  if (!taskId) return null
  return <TaskDialogInner key={taskId} taskId={taskId} />
}

function TaskDialogInner({ taskId }: { taskId: string }) {
  const { wsId: sessionWsId, role, me } = useWorkspaceSession()
  const openTaskDialog = useAppStore((s) => s.openTaskDialog)
  const qc = useQueryClient()
  const onMutationError = useMutationErrorHandler()
  const upgradeToast = useUpgradeToast()

  const envelopeQuery = useQuery({
    queryKey: qk.task(taskId),
    queryFn: () => api.get<TaskDetailEnvelope>(`/api/tasks/${taskId}`),
  })
  const task = envelopeQuery.data?.task
  const wsId = sessionWsId ?? task?.workspaceId ?? null

  const membersQuery = useQuery({
    queryKey: qk.members(wsId ?? 'none'),
    queryFn: () => api.get<{ members: WorkspaceMemberDTO[] }>(`/api/workspaces/${wsId}/members`),
    enabled: !!wsId,
  })
  const labelsQuery = useQuery({
    queryKey: qk.labels(wsId ?? 'none'),
    queryFn: () => api.get<{ labels: LabelDTO[] }>(`/api/workspaces/${wsId}/labels`),
    enabled: !!wsId,
  })
  const entitlements = useEntitlements(wsId)

  const canEdit = !!(task && me && canEditTask(role, taskEditInput(task), me.id))
  const canCreateLabels = can(role, 'label.manage')

  const patchMutation = useMutation({
    mutationFn: (vars: { patch: TaskPatchInput; members: WorkspaceMemberDTO[]; labels: LabelDTO[] }) =>
      api.patch<TaskDTO>(`/api/tasks/${taskId}`, vars.patch),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.task(taskId) })
      const prev = qc.getQueryData<TaskDetailEnvelope>(qk.task(taskId))
      if (prev) {
        qc.setQueryData<TaskDetailEnvelope>(qk.task(taskId), {
          ...prev,
          task: applyTaskPatch(prev.task, vars.patch, vars.members, vars.labels),
        })
      }
      return { prev }
    },
    onSuccess: () => toast.success('Task updated'),
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.task(taskId), ctx.prev)
      if (e instanceof ApiError && e.status === 402) upgradeToast('Task editing')
      else toast.error(e instanceof Error ? e.message : 'Could not update task')
    },
    onSettled: () => invalidateAfterTaskChange(qc, taskId, wsId),
  })

  const patchTask = (patch: TaskPatchInput) =>
    patchMutation.mutate({ patch, members: membersQuery.data?.members ?? [], labels: labelsQuery.data?.labels ?? [] })

  const close = () => openTaskDialog(null)

  return (
    <Dialog open onOpenChange={(o) => !o && close()}>
      <DialogContent
        className="grid h-[94dvh] max-w-3xl grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:h-[90dvh]"
        aria-describedby={undefined}
      >
        {/* Accessible title/description */}
        <DialogTitle className="sr-only">{task ? `Task: ${task.title}` : 'Task details'}</DialogTitle>
        <DialogDescription className="sr-only">
          Edit task details, subtasks, dependencies, attachments and comments.
        </DialogDescription>

        {/* Header */}
        <div className="border-b px-4 pb-3 pt-4 sm:px-6 sm:pt-5">
          {envelopeQuery.isPending && !task ? (
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          ) : task ? (
            <>
              <div className="flex items-center gap-2 pr-8 text-xs text-muted-foreground">
                <button
                  onClick={() => {
                    close()
                    useAppStore.getState().openProject(task.projectId)
                  }}
                  className="inline-flex items-center gap-1 rounded font-medium outline-none hover:text-foreground hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: task.projectColor }} aria-hidden />
                  {task.projectName}
                </button>
                <span aria-hidden>/</span>
                <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase tracking-wide" title={`Task id ${task.id}`}>
                  #{task.id.slice(-8)}
                </span>
                {task.blockedByOpenCount > 0 && (
                  <span className="ml-auto inline-flex items-center gap-1 rounded-md bg-amber-500/15 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">
                    <OctagonAlert className="h-3 w-3" aria-hidden />
                    Blocked by {task.blockedByOpenCount} open {task.blockedByOpenCount === 1 ? 'task' : 'tasks'}
                  </span>
                )}
              </div>
              <div className="mt-2 pr-8">
                <InlineEditableTitle
                  value={task.title}
                  disabled={!canEdit || patchMutation.isPending}
                  onSubmit={(title) => patchTask({ title })}
                />
              </div>
            </>
          ) : (
            <p className="pr-8 text-sm text-muted-foreground">Task</p>
          )}
        </div>

        {/* Body */}
        <div className="overflow-y-auto px-4 py-4 sm:px-6">
          {envelopeQuery.isError && !task ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {envelopeQuery.error instanceof Error ? envelopeQuery.error.message : 'Failed to load task'}
              </p>
              <Button variant="outline" size="sm" onClick={() => envelopeQuery.refetch()}>Try again</Button>
            </div>
          ) : !task ? (
            <TaskDialogSkeleton />
          ) : (
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_230px]">
              {/* Main column */}
              <div className="min-w-0 space-y-6">
                <DescriptionEditor task={task} canEdit={canEdit} onSave={(description) => patchTask({ description })} wsId={wsId} />

                <SubtasksSection
                  task={task}
                  subtasks={envelopeQuery.data?.subtasks ?? []}
                  me={me}
                  role={role}
                  wsId={wsId ?? ''}
                />

                <DependenciesSection
                  task={task}
                  blockedBy={envelopeQuery.data?.dependencies.blockedBy ?? []}
                  blocks={envelopeQuery.data?.dependencies.blocks ?? []}
                  entitlements={entitlements}
                  wsId={wsId ?? ''}
                />

                <AttachmentsSection
                  task={task}
                  attachments={envelopeQuery.data?.attachments ?? []}
                  entitlements={entitlements}
                  me={me}
                  role={role}
                  wsId={wsId ?? ''}
                />

                <CommentsSection
                  task={task}
                  comments={envelopeQuery.data?.comments ?? []}
                  me={me}
                  role={role}
                  wsId={wsId ?? ''}
                />

                <ActivitySection activity={envelopeQuery.data?.activity ?? []} />
              </div>

              {/* Meta column */}
              <aside className="space-y-4 lg:border-l lg:pl-4" aria-label="Task properties">
                <MetaField label="Status">
                  <Select
                    value={task.status}
                    onValueChange={(v) => patchTask({ status: v as TaskStatus })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="w-full" aria-label="Task status">
                      <span className="flex items-center gap-1.5">
                        <span className="h-2 w-2 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR[task.status] }} aria-hidden />
                        <SelectValue />
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      {TASK_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{TASK_STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </MetaField>

                <MetaField label="Priority">
                  <Select
                    value={task.priority}
                    onValueChange={(v) => patchTask({ priority: v as Priority })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="w-full" aria-label="Task priority"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {PRIORITIES.map((p) => (
                        <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </MetaField>

                <MetaField label="Assignee">
                  <Select
                    value={task.assignee?.id ?? 'UNASSIGNED'}
                    onValueChange={(v) => patchTask({ assigneeId: v === 'UNASSIGNED' ? null : v })}
                    disabled={!canEdit}
                  >
                    <SelectTrigger className="w-full" aria-label="Task assignee">
                      <span className="flex items-center gap-1.5">
                        {task.assignee ? (
                          <UserAvatar name={task.assignee.name} color={task.assignee.avatarColor} size="xs" />
                        ) : (
                          <UserIcon className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
                        )}
                        <span className="truncate">{task.assignee?.name ?? 'Unassigned'}</span>
                      </span>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="UNASSIGNED">Unassigned</SelectItem>
                      {(membersQuery.data?.members ?? []).map((m) => (
                        <SelectItem key={m.id} value={m.userId}>
                          <span className="flex items-center gap-1.5">
                            <UserAvatar name={m.name} color={m.avatarColor} size="xs" />
                            {m.name}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {membersQuery.isPending && <p className="text-[11px] text-muted-foreground">Loading members…</p>}
                </MetaField>

                <MetaField label="Due date">
                  <div className="relative">
                    <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
                    <Input
                      type="date"
                      value={dateInputValue(task.dueDate)}
                      disabled={!canEdit}
                      onChange={(e) => patchTask({ dueDate: isoFromDateInput(e.target.value) })}
                      aria-label="Due date"
                      className="h-9 pl-8"
                    />
                  </div>
                </MetaField>

                <MetaField label="Labels">
                  <LabelsControl
                    task={task}
                    labels={labelsQuery.data?.labels ?? []}
                    wsId={wsId}
                    canEdit={canEdit}
                    canCreateLabels={canCreateLabels}
                    customLabels={entitlements.customLabels}
                    onToggle={(labelIds) => patchTask({ labelIds })}
                  />
                </MetaField>

                <p className="border-t pt-3 text-[11px] text-muted-foreground">
                  Created by {task.creator.name} · {formatDateTime(task.createdAt)}
                </p>
              </aside>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ------------------------------------------------------------------ building blocks

function MetaField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  )
}

function TaskDialogSkeleton() {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_230px]">
      <div className="space-y-4">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-28 w-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-full" />
        ))}
      </div>
    </div>
  )
}

function InlineEditableTitle({
  value,
  disabled,
  onSubmit,
}: {
  value: string
  disabled: boolean
  onSubmit: (title: string) => void
}) {
  const [editing, setEditing] = React.useState(false)
  const [draft, setDraft] = React.useState(value)

  React.useEffect(() => {
    if (!editing) setDraft(value)
  }, [value, editing])

  const commit = () => {
    const trimmed = draft.trim()
    setEditing(false)
    if (!trimmed || trimmed === value) {
      setDraft(value)
      return
    }
    onSubmit(trimmed)
  }

  if (editing) {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault()
          commit()
        }}
      >
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              e.preventDefault()
              setDraft(value)
              setEditing(false)
            }
          }}
          autoFocus
          aria-label="Task title"
          className="h-9 text-base font-semibold"
        />
      </form>
    )
  }

  return (
    <button
      onClick={() => !disabled && setEditing(true)}
      disabled={disabled}
      title={disabled ? value : 'Click to edit title'}
      className="w-full rounded text-left outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
    >
      <span className="block break-words text-base font-semibold leading-snug hover:underline">{value}</span>
    </button>
  )
}

function DescriptionEditor({
  task,
  canEdit,
  onSave,
  wsId,
}: {
  task: TaskDTO
  canEdit: boolean
  onSave: (description: string) => void
  wsId: string | null
}) {
  const qc = useQueryClient()
  const [draft, setDraft] = React.useState(task.description ?? '')
  const dirty = draft !== (task.description ?? '')

  React.useEffect(() => {
    setDraft(task.description ?? '')
  }, [task.id, task.description])

  const save = useMutation({
    mutationFn: () => api.patch<TaskDTO>(`/api/tasks/${task.id}`, { description: draft.trim() }),
    onSuccess: () => toast.success('Description saved'),
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Failed to save description'),
    onSettled: () => invalidateAfterTaskChange(qc, task.id, wsId),
  })

  return (
    <section aria-label="Description" className="space-y-1.5">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">Description</h4>
        {canEdit && dirty && (
          <Button size="sm" variant="outline" className="min-h-7" onClick={() => save.mutate()} disabled={save.isPending}>
            {save.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />} Save
          </Button>
        )}
      </div>
      <Textarea
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={canEdit ? 'Add more details, acceptance criteria, links…' : 'No description'}
        rows={4}
        disabled={!canEdit}
        className="text-sm"
        aria-label="Task description"
      />
    </section>
  )
}


function LabelsControl({
  task,
  labels,
  wsId,
  canEdit,
  canCreateLabels,
  customLabels,
  onToggle,
}: {
  task: TaskDTO
  labels: LabelDTO[]
  wsId: string | null
  canEdit: boolean
  canCreateLabels: boolean
  customLabels: boolean
  onToggle: (labelIds: string[]) => void
}) {
  const qc = useQueryClient()
  const onMutationError = useMutationErrorHandler()
  const upgradeToast = useUpgradeToast()
  const [open, setOpen] = React.useState(false)
  const [newName, setNewName] = React.useState('')

  const selectedIds = task.labels.map((l) => l.id)

  const toggle = (labelId: string) => {
    const next = selectedIds.includes(labelId) ? selectedIds.filter((id) => id !== labelId) : [...selectedIds, labelId]
    onToggle(next)
  }

  const createLabel = useMutation({
    mutationFn: (name: string) =>
      api.post<LabelDTO>(`/api/workspaces/${wsId}/labels`, {
        name,
        color: PROJECT_COLORS[Math.floor(Math.random() * PROJECT_COLORS.length)],
      }),
    onSuccess: (created) => {
      toast.success(`Label “${created.name}” created`)
      setNewName('')
      qc.invalidateQueries({ queryKey: qk.labels(wsId ?? 'none') })
      onToggle([...selectedIds, created.id])
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) upgradeToast('Custom labels')
      else onMutationError(e, undefined, 'Failed to create label')
    },
  })

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex min-h-9 w-full flex-wrap items-center gap-1 rounded-md border bg-transparent px-2.5 py-1.5 text-left text-sm outline-none transition-colors hover:bg-accent/60 focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!canEdit}
          aria-label={`Labels: ${task.labels.map((l) => l.name).join(', ') || 'none'}`}
        >
          {task.labels.length === 0 ? (
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Tag className="h-3.5 w-3.5" aria-hidden /> Add labels
            </span>
          ) : (
            <>
              {task.labels.slice(0, 2).map((l) => (
                <span
                  key={l.id}
                  className="inline-flex items-center gap-1 rounded-full border px-1.5 py-px text-[11px] font-medium"
                  style={{ color: l.color, borderColor: `${l.color}55`, backgroundColor: `${l.color}14` }}
                >
                  <span className="h-1 w-1 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
                  {l.name}
                </span>
              ))}
              {task.labels.length > 2 && <span className="text-[11px] text-muted-foreground">+{task.labels.length - 2}</span>}
              <ChevronsUpDown className="ml-auto h-3.5 w-3.5 text-muted-foreground" aria-hidden />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-0">
        <div className="max-h-48 overflow-y-auto p-1.5">
          {labels.length === 0 && <p className="px-2 py-2 text-xs text-muted-foreground">No workspace labels yet.</p>}
          {labels.map((l) => {
            const checked = selectedIds.includes(l.id)
            return (
              <label key={l.id} className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/60">
                <Checkbox checked={checked} onCheckedChange={() => canEdit && toggle(l.id)} aria-label={`${checked ? 'Remove' : 'Apply'} label ${l.name}`} />
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: l.color }} aria-hidden />
                <span className="flex-1 truncate">{l.name}</span>
                {checked && <Check className="h-3.5 w-3.5 text-primary" aria-hidden />}
              </label>
            )
          })}
        </div>
        {canEdit && (
          <div className="border-t p-2">
            {canCreateLabels ? (
              <form
                className="flex gap-1.5"
                onSubmit={(e) => {
                  e.preventDefault()
                  const name = newName.trim()
                  if (!name) return
                  if (!customLabels) {
                    upgradeToast('Custom labels')
                    return
                  }
                  createLabel.mutate(name)
                }}
              >
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="New label name…"
                  aria-label="New label name"
                  className="h-8 text-sm"
                />
                <Button type="submit" size="icon" className="h-8 w-8 shrink-0" disabled={createLabel.isPending || !newName.trim()} aria-label="Create label">
                  {createLabel.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
                </Button>
              </form>
            ) : (
              <p className="px-1 text-xs text-muted-foreground">Only PMs, admins and owners can create labels.</p>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  )
}
