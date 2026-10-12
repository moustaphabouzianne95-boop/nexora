'use client'

/**
 * TaskDialog sections: subtasks, dependencies, attachments, comments, activity.
 * Each section owns its mutations (optimistic where cheap) and toasts.
 */

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Circle, CheckCircle2, Link2, Loader2, Lock, Paperclip, Pencil, Plus, Search, Send,
  Trash2, Unlink, Upload, History, OctagonAlert,
} from 'lucide-react'
import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { can, canEditTask } from '@/lib/permissions'
import { ALLOWED_ATTACHMENT_TYPES, MAX_ATTACHMENT_BYTES, TASK_STATUS_COLOR, TASK_STATUS_LABEL } from '@/lib/constants'
import type { AttachmentDTO, CommentDTO, PlanEntitlements, PublicUser, Role, TaskDTO, ActivityDTO } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UserAvatar, formatRelativeTime } from '@/components/shared/ui-primitives'
import { invalidateAfterTaskChange, useMutationErrorHandler, useUpgradeToast } from '@/components/projects/project-shared'
import { patchSubtaskEnvelope, taskEditInput } from '@/components/tasks/task-helpers'
import { cn } from '@/lib/utils'

// =================================================================== subtasks

export function SubtasksSection({
  task,
  subtasks,
  me,
  role,
  wsId,
}: {
  task: TaskDTO
  subtasks: TaskDTO[]
  me: PublicUser | null
  role: Role | null
  wsId: string
}) {
  const qc = useQueryClient()
  const onMutationError = useMutationErrorHandler()
  const [title, setTitle] = React.useState('')
  const canEditParent = me ? canEditTask(role, taskEditInput(task), me.id) : false
  const done = subtasks.filter((s) => s.status === 'DONE').length

  const toggle = useMutation({
    mutationFn: (vars: { sub: TaskDTO; status: 'DONE' | 'TODO' }) => api.patch<TaskDTO>(`/api/tasks/${vars.sub.id}`, { status: vars.status }),
    onMutate: async (vars) => {
      await qc.cancelQueries({ queryKey: qk.task(task.id) })
      const prev = qc.getQueryData(qk.task(task.id))
      patchSubtaskEnvelope(qc, task.id, vars.sub.id, { status: vars.status })
      return { prev }
    },
    onSuccess: () => toast.success('Subtask updated'),
    onError: (e, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.task(task.id), ctx.prev)
      onMutationError(e, undefined, 'Could not update subtask')
    },
    onSettled: () => invalidateAfterTaskChange(qc, task.id, wsId),
  })

  const add = useMutation({
    mutationFn: (t: string) =>
      api.post<TaskDTO>(`/api/projects/${task.projectId}/tasks`, { title: t, parentTaskId: task.id, status: 'TODO' }),
    onSuccess: () => {
      toast.success('Subtask added')
      setTitle('')
    },
    onError: (e) => onMutationError(e, undefined, 'Failed to add subtask'),
    onSettled: () => invalidateAfterTaskChange(qc, task.id, wsId),
  })

  return (
    <section aria-label="Subtasks">
      <h4 className="mb-2 flex items-center gap-2 text-sm font-semibold">
        Subtasks
        <span className="text-xs font-normal text-muted-foreground">{done}/{subtasks.length}</span>
      </h4>
      <div className="space-y-1">
        {subtasks.map((s) => {
          const canToggle = me ? canEditTask(role, taskEditInput(s), me.id) : false
          const isDone = s.status === 'DONE'
          return (
            <div key={s.id} className="flex items-center gap-2 rounded-md px-1 py-1 hover:bg-accent/50">
              <button
                onClick={() => canToggle && toggle.mutate({ sub: s, status: isDone ? 'TODO' : 'DONE' })}
                disabled={!canToggle || toggle.isPending}
                aria-label={isDone ? `Mark “${s.title}” as to do` : `Mark “${s.title}” as done`}
                className="rounded outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed"
              >
                {isDone ? (
                  <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" aria-hidden />
                ) : (
                  <Circle className="h-4.5 w-4.5 text-muted-foreground" aria-hidden />
                )}
              </button>
              <button
                onClick={() => useAppStore.getState().openTaskDialog(s.id)}
                className={cn('flex-1 rounded text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring hover:underline', isDone && 'text-muted-foreground line-through')}
              >
                {s.title}
              </button>
            </div>
          )
        })}
        {subtasks.length === 0 && <p className="text-sm text-muted-foreground">No subtasks yet.</p>}
      </div>
      {canEditParent && (
        <form
          className="mt-2 flex gap-1.5"
          onSubmit={(e) => {
            e.preventDefault()
            const t = title.trim()
            if (t) add.mutate(t)
          }}
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Add a subtask…"
            aria-label="New subtask title"
            className="h-9 text-sm"
          />
          <Button type="submit" size="icon" className="h-9 w-9 shrink-0" disabled={add.isPending || !title.trim()} aria-label="Add subtask">
            {add.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Plus className="h-4 w-4" aria-hidden />}
          </Button>
        </form>
      )}
    </section>
  )
}

// ================================================================ dependencies

export function DependenciesSection({
  task,
  blockedBy,
  blocks,
  entitlements,
  wsId,
}: {
  task: TaskDTO
  blockedBy: TaskDTO[]
  blocks: TaskDTO[]
  entitlements: PlanEntitlements
  wsId: string
}) {
  const qc = useQueryClient()
  const onMutationError = useMutationErrorHandler()
  const upgradeToast = useUpgradeToast()
  const openTaskDialog = useAppStore((s) => s.openTaskDialog)

  const remove = useMutation({
    mutationFn: (otherId: string) => api.delete<{ ok: boolean }>(`/api/tasks/${task.id}/dependencies/${otherId}`),
    onSuccess: () => toast.success('Dependency removed'),
    onError: (e) => onMutationError(e, undefined, 'Failed to remove dependency'),
    onSettled: () => invalidateAfterTaskChange(qc, task.id, wsId),
  })

  const add = useMutation({
    mutationFn: (vars: { blockerTaskId: string; blockedTaskId: string }) =>
      api.post<{ dependency: unknown }>(`/api/tasks/${task.id}/dependencies`, vars),
    onSuccess: () => toast.success('Dependency added'),
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) upgradeToast('Task dependencies')
      else if (e instanceof ApiError && e.status === 409) toast.error(e.message || 'Circular or duplicate dependency')
      else onMutationError(e, undefined, 'Failed to add dependency')
    },
    onSettled: () => invalidateAfterTaskChange(qc, task.id, wsId),
  })

  if (!entitlements.dependencies) {
    return (
      <section aria-label="Dependencies" className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Dependencies
        </p>
        <p className="mt-1">Task dependencies are available on Pro and Business plans.</p>
      </section>
    )
  }

  return (
    <section aria-label="Dependencies" className="space-y-3">
      <DependencyList
        title="Blocked by"
        emptyText="Nothing blocks this task."
        tasks={blockedBy}
        onOpen={(id) => openTaskDialog(id)}
        onRemove={(id) => remove.mutate(id)}
        removing={remove.isPending}
      />
      <DependencyAdd
        label="Blocked by a task…"
        excludeIds={[task.id, ...blockedBy.map((t) => t.id), ...blocks.map((t) => t.id)]}
        wsId={wsId}
        onPick={(picked) => add.mutate({ blockerTaskId: picked.id, blockedTaskId: task.id })}
        pending={add.isPending}
      />
      <DependencyList
        title="Blocks"
        emptyText="This task doesn't block anything."
        tasks={blocks}
        onOpen={(id) => openTaskDialog(id)}
        onRemove={(id) => remove.mutate(id)}
        removing={remove.isPending}
      />
      <DependencyAdd
        label="Blocks a task…"
        excludeIds={[task.id, ...blockedBy.map((t) => t.id), ...blocks.map((t) => t.id)]}
        wsId={wsId}
        onPick={(picked) => add.mutate({ blockerTaskId: task.id, blockedTaskId: picked.id })}
        pending={add.isPending}
      />
    </section>
  )
}

function DependencyList({
  title,
  emptyText,
  tasks,
  onOpen,
  onRemove,
  removing,
}: {
  title: string
  emptyText: string
  tasks: TaskDTO[]
  onOpen: (id: string) => void
  onRemove: (id: string) => void
  removing: boolean
}) {
  return (
    <div>
      <h5 className="mb-1 flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
        {title === 'Blocked by' ? <OctagonAlert className="h-3.5 w-3.5" aria-hidden /> : <Link2 className="h-3.5 w-3.5" aria-hidden />}
        {title}
      </h5>
      {tasks.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map((t) => (
            <li key={t.id} className="flex min-h-9 items-center gap-2 rounded-md border px-2 py-1">
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR[t.status] }} aria-label={TASK_STATUS_LABEL[t.status]} />
              <button onClick={() => onOpen(t.id)} className="flex-1 truncate text-left text-sm outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring" title={t.title}>
                {t.title}
              </button>
              <span className="hidden truncate text-xs text-muted-foreground sm:block">{t.projectName}</span>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => onRemove(t.id)} disabled={removing} aria-label={`Remove dependency on ${t.title}`}>
                    <Unlink className="h-3.5 w-3.5" aria-hidden />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Remove dependency</TooltipContent>
              </Tooltip>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function DependencyAdd({
  label,
  excludeIds,
  wsId,
  onPick,
  pending,
}: {
  label: string
  excludeIds: string[]
  wsId: string
  onPick: (task: TaskDTO) => void
  pending: boolean
}) {
  const [open, setOpen] = React.useState(false)
  const [q, setQ] = React.useState('')
  const [debounced, setDebounced] = React.useState('')

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(q), 250)
    return () => clearTimeout(t)
  }, [q])

  const search = useQuery({
    queryKey: ['task-dep-search', wsId, debounced],
    queryFn: () => api.get<{ tasks: TaskDTO[] }>(`/api/search?q=${encodeURIComponent(debounced)}&workspaceId=${wsId}`),
    enabled: open && debounced.trim().length >= 2,
  })

  const results = (search.data?.tasks ?? []).filter((t) => !excludeIds.includes(t.id)).slice(0, 6)

  return (
    <Popover open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setQ(''); setDebounced('') } }}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="min-h-8 gap-1.5 text-xs">
          <Plus className="h-3.5 w-3.5" aria-hidden /> {label}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 p-0">
        <div className="border-b p-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search workspace tasks…"
              aria-label="Search tasks to link"
              className="h-8 pl-8 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-56 overflow-y-auto p-1">
          {debounced.trim().length < 2 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Type at least 2 characters to search.</p>
          ) : search.isFetching ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">Searching…</p>
          ) : results.length === 0 ? (
            <p className="px-2 py-3 text-xs text-muted-foreground">No matching tasks.</p>
          ) : (
            results.map((t) => (
              <button
                key={t.id}
                onClick={() => { onPick(t); setOpen(false) }}
                disabled={pending}
                className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: TASK_STATUS_COLOR[t.status] }} aria-hidden />
                <span className="flex-1 truncate">{t.title}</span>
                <span className="shrink-0 text-xs text-muted-foreground">{t.projectName}</span>
              </button>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

// ================================================================ attachments

export function AttachmentsSection({
  task,
  attachments,
  entitlements,
  me,
  role,
  wsId,
}: {
  task: TaskDTO
  attachments: AttachmentDTO[]
  entitlements: PlanEntitlements
  me: PublicUser | null
  role: Role | null
  wsId: string
}) {
  const qc = useQueryClient()
  const onMutationError = useMutationErrorHandler()
  const upgradeToast = useUpgradeToast()
  const inputRef = React.useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = React.useState(false)
  const [deleteTarget, setDeleteTarget] = React.useState<AttachmentDTO | null>(null)

  const canAttach = can(role, 'task.attach') && (me ? canEditTask(role, taskEditInput(task), me.id) : false)
  const canDeleteAttachment = (a: AttachmentDTO) => can(role, 'task.edit_any') || a.uploaderName === me?.name

  const upload = useMutation({
    mutationFn: (vars: { filename: string; mimeType: string; size: number; data: string }) =>
      api.post<AttachmentDTO>(`/api/tasks/${task.id}/attachments`, vars),
    onSuccess: () => toast.success('Attachment uploaded'),
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) upgradeToast('Attachments')
      else onMutationError(e, undefined, 'Upload failed')
    },
    onSettled: () => {
      setUploading(false)
      invalidateAfterTaskChange(qc, task.id, wsId)
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/api/attachments/${id}`),
    onSuccess: () => {
      toast.success('Attachment deleted')
      setDeleteTarget(null)
    },
    onError: (e) => onMutationError(e, undefined, 'Failed to delete attachment'),
    onSettled: () => invalidateAfterTaskChange(qc, task.id, wsId),
  })

  const onFileChosen = (file: File | undefined) => {
    if (!file) return
    if (!ALLOWED_ATTACHMENT_TYPES.includes(file.type)) {
      toast.error(`File type “${file.type || 'unknown'}” is not allowed`)
      return
    }
    if (file.size > MAX_ATTACHMENT_BYTES) {
      toast.error('File is larger than the 2 MB limit')
      return
    }
    setUploading(true)
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : ''
      const base64 = dataUrl.includes(',') ? dataUrl.split(',')[1] : dataUrl
      if (!base64) {
        toast.error('Could not read the file')
        setUploading(false)
        return
      }
      upload.mutate({ filename: file.name, mimeType: file.type, size: file.size, data: base64 })
    }
    reader.onerror = () => {
      toast.error('Could not read the file')
      setUploading(false)
    }
    reader.readAsDataURL(file)
  }

  if (!entitlements.attachments) {
    return (
      <section aria-label="Attachments" className="rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
        <p className="flex items-center gap-1.5 font-medium text-foreground">
          <Lock className="h-3.5 w-3.5" aria-hidden /> Attachments
        </p>
        <p className="mt-1">File attachments are available on Pro and Business plans.</p>
      </section>
    )
  }

  return (
    <section aria-label="Attachments" className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold">
          <Paperclip className="h-4 w-4" aria-hidden /> Attachments
          <span className="text-xs font-normal text-muted-foreground">({attachments.length})</span>
        </h4>
        {canAttach && (
          <>
            <input
              ref={inputRef}
              type="file"
              className="sr-only"
              aria-label="Choose file to upload"
              onChange={(e) => {
                onFileChosen(e.target.files?.[0])
                e.target.value = ''
              }}
            />
            <Button variant="outline" size="sm" className="min-h-8 gap-1.5" onClick={() => inputRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Upload className="h-3.5 w-3.5" aria-hidden />}
              {uploading ? 'Uploading…' : 'Upload'}
            </Button>
          </>
        )}
      </div>

      {attachments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No attachments. Max 2 MB per file.</p>
      ) : (
        <ul className="divide-y rounded-lg border">
          {attachments.map((a) => (
            <li key={a.id} className="flex items-center gap-2 px-2.5 py-2">
              <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
              <a
                href={`/api/attachments/${a.id}/download`}
                target="_blank"
                rel="noreferrer"
                className="min-w-0 flex-1 truncate text-sm font-medium outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
                title={`Download ${a.filename}`}
              >
                {a.filename}
              </a>
              <span className="shrink-0 text-xs text-muted-foreground">{Math.max(1, Math.round(a.size / 1024))} KB</span>
              <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">
                {a.uploaderName} · {formatRelativeTime(a.createdAt)}
              </span>
              {canDeleteAttachment(a) && (
                <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => setDeleteTarget(a)} aria-label={`Delete ${a.filename}`}>
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <AlertDialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{deleteTarget?.filename}”?</AlertDialogTitle>
            <AlertDialogDescription>The file will be removed for everyone. This cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={() => deleteTarget && remove.mutate(deleteTarget.id)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

// =================================================================== comments

export function CommentsSection({
  task,
  comments,
  me,
  role,
  wsId,
}: {
  task: TaskDTO
  comments: CommentDTO[]
  me: PublicUser | null
  role: Role | null
  wsId: string
}) {
  const qc = useQueryClient()
  const onMutationError = useMutationErrorHandler()
  const [body, setBody] = React.useState('')
  const [editingId, setEditingId] = React.useState<string | null>(null)
  const [editBody, setEditBody] = React.useState('')
  const [deleteId, setDeleteId] = React.useState<string | null>(null)

  const canComment = can(role, 'task.comment')
  const canDeleteComment = (c: CommentDTO) => c.author.id === me?.id || can(role, 'task.edit_any')

  const add = useMutation({
    mutationFn: (text: string) => api.post<CommentDTO>(`/api/tasks/${task.id}/comments`, { body: text }),
    onSuccess: () => {
      toast.success('Comment added')
      setBody('')
    },
    onError: (e) => onMutationError(e, undefined, 'Failed to add comment'),
    onSettled: () => invalidateAfterTaskChange(qc, task.id, wsId),
  })

  const update = useMutation({
    mutationFn: (vars: { id: string; body: string }) => api.patch<CommentDTO>(`/api/tasks/${task.id}/comments/${vars.id}`, { body: vars.body }),
    onSuccess: () => {
      toast.success('Comment updated')
      setEditingId(null)
    },
    onError: (e) => onMutationError(e, undefined, 'Failed to update comment'),
    onSettled: () => invalidateAfterTaskChange(qc, task.id, wsId),
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/api/tasks/${task.id}/comments/${id}`),
    onSuccess: () => {
      toast.success('Comment deleted')
      setDeleteId(null)
    },
    onError: (e) => onMutationError(e, undefined, 'Failed to delete comment'),
    onSettled: () => invalidateAfterTaskChange(qc, task.id, wsId),
  })

  return (
    <section aria-label="Comments" className="space-y-2">
      <h4 className="text-sm font-semibold">Comments <span className="text-xs font-normal text-muted-foreground">({comments.length})</span></h4>

      {canComment && (
        <div>
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && body.trim()) add.mutate(body.trim())
            }}
            placeholder="Write a comment… (Ctrl/⌘+Enter to send)"
            rows={2}
            className="text-sm"
            aria-label="Write a comment"
          />
          <div className="mt-1.5 flex justify-end">
            <Button size="sm" className="min-h-8 gap-1.5" disabled={!body.trim() || add.isPending} onClick={() => add.mutate(body.trim())}>
              {add.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Send className="h-3.5 w-3.5" aria-hidden />}
              Comment
            </Button>
          </div>
        </div>
      )}

      {comments.length === 0 ? (
        <p className="text-sm text-muted-foreground">No comments yet.</p>
      ) : (
        <ScrollArea className="max-h-72 rounded-lg border">
          <div className="divide-y">
            {comments.map((c) => {
              const mine = c.author.id === me?.id
              const editing = editingId === c.id
              return (
                <div key={c.id} className="flex gap-2.5 p-3">
                  <UserAvatar name={c.author.name} color={c.author.avatarColor} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-x-2">
                      <span className="text-sm font-medium">{c.author.name}</span>
                      <span className="text-xs text-muted-foreground">{formatRelativeTime(c.createdAt)}</span>
                      {mine && !editing && (
                        <span className="ml-auto flex items-center gap-0.5">
                          <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={() => { setEditingId(c.id); setEditBody(c.body) }} aria-label="Edit your comment">
                            <Pencil className="h-3 w-3" aria-hidden />
                          </Button>
                        </span>
                      )}
                      {canDeleteComment(c) && (
                        <Button variant="ghost" size="icon" className={cn('h-7 w-7 text-muted-foreground hover:text-destructive', !mine && 'ml-auto')} onClick={() => setDeleteId(c.id)} aria-label="Delete comment">
                          <Trash2 className="h-3 w-3" aria-hidden />
                        </Button>
                      )}
                    </div>
                    {editing ? (
                      <div className="mt-1.5 space-y-1.5">
                        <Textarea value={editBody} onChange={(e) => setEditBody(e.target.value)} rows={2} className="text-sm" aria-label="Edit comment" autoFocus />
                        <div className="flex gap-1.5">
                          <Button size="sm" className="h-7" disabled={!editBody.trim() || update.isPending} onClick={() => update.mutate({ id: c.id, body: editBody.trim() })}>Save</Button>
                          <Button size="sm" variant="ghost" className="h-7" onClick={() => setEditingId(null)}>Cancel</Button>
                        </div>
                      </div>
                    ) : (
                      // Plain text — intentionally NOT rendered as HTML.
                      <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground/90">{c.body}</p>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </ScrollArea>
      )}

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this comment?</AlertDialogTitle>
            <AlertDialogDescription>Comments cannot be recovered once deleted.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={remove.isPending}
              onClick={() => deleteId && remove.mutate(deleteId)}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}

// =================================================================== activity

const ACTION_LABELS: Record<string, string> = {
  CREATED: 'created this task',
  UPDATED: 'updated this task',
  STATUS_CHANGED: 'changed status',
  ASSIGNED: 'reassigned this task',
  COMMENTED: 'commented',
  ATTACHMENT_ADDED: 'added an attachment',
  ATTACHMENT_DELETED: 'removed an attachment',
  DELETED: 'deleted this task',
  MOVED: 'moved this task',
}

function describeActivity(a: ActivityDTO): string {
  const label = ACTION_LABELS[a.action] ?? a.action.toLowerCase().replace(/_/g, ' ')
  const meta = a.metadata as { from?: string; to?: string } | null
  if (a.action === 'STATUS_CHANGED' && meta?.from && meta?.to) {
    return `${label} from ${TASK_STATUS_LABEL[meta.from as keyof typeof TASK_STATUS_LABEL] ?? meta.from} to ${TASK_STATUS_LABEL[meta.to as keyof typeof TASK_STATUS_LABEL] ?? meta.to}`
  }
  return label
}

export function ActivitySection({ activity }: { activity: ActivityDTO[] }) {
  const [open, setOpen] = React.useState(false)
  if (activity.length === 0) return null
  return (
    <section aria-label="Activity">
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center gap-1.5 rounded text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <History className="h-4 w-4 text-muted-foreground" aria-hidden />
        Activity <span className="text-xs font-normal text-muted-foreground">({activity.length})</span>
        <span className="ml-auto text-xs text-muted-foreground">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="mt-2 max-h-60 space-y-2.5 overflow-y-auto rounded-lg border p-3">
          {activity.map((a) => (
            <div key={a.id} className="flex items-start gap-2 text-sm">
              <UserAvatar name={a.actorName} color={a.actorColor} size="xs" className="mt-0.5" />
              <p className="text-foreground/90">
                <span className="font-medium">{a.actorName}</span> {describeActivity(a)}
                <span className="ml-1.5 text-xs text-muted-foreground">{formatRelativeTime(a.createdAt)}</span>
              </p>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
