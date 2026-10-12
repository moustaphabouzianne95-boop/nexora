'use client'

/**
 * Milestones section (collapsible) with add / edit / delete dialogs.
 * Gated by the milestone.manage capability.
 */

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Diamond, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { api, qk, ApiError } from '@/lib/api-client'
import { can } from '@/lib/permissions'
import type { MilestoneDTO, ProjectDTO } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { DateChip, ProgressBar } from '@/components/shared/ui-primitives'
import { dateInputValue, isoFromDateInput, useMutationErrorHandler } from '@/components/projects/project-shared'
import { cn } from '@/lib/utils'

export function MilestonesCard({
  project,
  milestones,
  role,
}: {
  project: ProjectDTO
  milestones: MilestoneDTO[]
  role: Parameters<typeof can>[0]
}) {
  const qc = useQueryClient()
  const onMutationError = useMutationErrorHandler()
  const [open, setOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<MilestoneDTO | null>(null)
  const [creating, setCreating] = React.useState(false)
  const [deleting, setDeleting] = React.useState<MilestoneDTO | null>(null)

  const projectKey = qk.project(project.id)
  const canManage = can(role, 'milestone.manage')

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: projectKey })
    qc.invalidateQueries({ queryKey: ['project'] })
  }

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete<{ ok: boolean }>(`/api/milestones/${id}`),
    onSuccess: () => {
      toast.success('Milestone deleted')
      setDeleting(null)
      invalidate()
    },
    onError: (e) => onMutationError(e, undefined, 'Failed to delete milestone'),
  })

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <div className="rounded-xl border bg-card">
        <div className="flex items-center gap-2 px-4 py-3">
          <CollapsibleTrigger className="flex flex-1 items-center gap-2 rounded-md text-left outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Diamond className={cn('h-4 w-4 text-violet-500 transition-transform dark:text-violet-400', open && 'rotate-90')} aria-hidden />
            <span className="text-sm font-semibold">Milestones</span>
            <Badge variant="secondary" className="text-[11px]">{milestones.length}</Badge>
          </CollapsibleTrigger>
          {canManage && (
            <Button variant="outline" size="sm" className="min-h-8 gap-1" onClick={() => setCreating(true)}>
              <Plus className="h-3.5 w-3.5" aria-hidden /> Add
            </Button>
          )}
        </div>
        <CollapsibleContent>
          <div className="divide-y border-t">
            {milestones.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No milestones yet.{' '}
                {canManage ? 'Add one to mark key delivery dates.' : 'Project leads can add milestones.'}
              </p>
            ) : (
              milestones.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <Diamond
                    className={cn('h-3.5 w-3.5 shrink-0', m.status === 'COMPLETED' ? 'text-emerald-500' : 'text-violet-500 dark:text-violet-400')}
                    fill="currentColor"
                    aria-hidden
                  />
                  <div className="min-w-[140px] flex-1">
                    <p className="text-sm font-medium leading-tight">{m.name}</p>
                    {m.description && <p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">{m.description}</p>}
                  </div>
                  <div className="w-32 shrink-0 space-y-1" aria-label={`${m.completedCount}/${m.taskCount} tasks done`}>
                    <ProgressBar value={m.taskCount > 0 ? Math.round((m.completedCount / m.taskCount) * 100) : 0} />
                    <p className="text-[11px] text-muted-foreground">
                      {m.completedCount}/{m.taskCount} tasks
                    </p>
                  </div>
                  {m.dueDate && <DateChip date={m.dueDate} />}
                  <Badge variant={m.status === 'COMPLETED' ? 'default' : 'outline'} className="text-[11px]">
                    {m.status === 'COMPLETED' ? 'Completed' : 'Open'}
                  </Badge>
                  {canManage && (
                    <div className="flex items-center gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setEditing(m)} aria-label={`Edit milestone ${m.name}`}>
                        <Pencil className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => setDeleting(m)} aria-label={`Delete milestone ${m.name}`}>
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </Button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CollapsibleContent>
      </div>

      <MilestoneDialog
        open={creating || !!editing}
        onOpenChange={(o) => {
          if (!o) {
            setCreating(false)
            setEditing(null)
          }
        }}
        projectId={project.id}
        milestone={editing}
        onSaved={invalidate}
      />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete milestone “{deleting?.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              Tasks keep their due dates but will no longer be linked to this milestone. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={deleteMutation.isPending}
              onClick={() => deleting && deleteMutation.mutate(deleting.id)}
            >
              {deleteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />} Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Collapsible>
  )
}

// ------------------------------------------------------------------ add/edit dialog

function MilestoneDialog({
  open,
  onOpenChange,
  projectId,
  milestone,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  milestone: MilestoneDTO | null
  onSaved: () => void
}) {
  const qc = useQueryClient()
  const onMutationError = useMutationErrorHandler()
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [dueDate, setDueDate] = React.useState('')
  const [status, setStatus] = React.useState<'OPEN' | 'COMPLETED'>('OPEN')
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!open) return
    setError(null)
    setName(milestone?.name ?? '')
    setDescription(milestone?.description ?? '')
    setDueDate(dateInputValue(milestone?.dueDate))
    setStatus(milestone?.status ?? 'OPEN')
  }, [open, milestone])

  const saveMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      milestone
        ? api.patch<MilestoneDTO>(`/api/milestones/${milestone.id}`, body)
        : api.post<MilestoneDTO>(`/api/projects/${projectId}/milestones`, body),
    onSuccess: () => {
      toast.success(milestone ? 'Milestone updated' : 'Milestone added')
      onOpenChange(false)
      onSaved()
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 422 && e.details?.name) {
        setError(e.details.name)
        return
      }
      onMutationError(e, undefined, 'Failed to save milestone')
    },
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = name.trim()
    if (!trimmed) {
      setError('Name is required')
      return
    }
    setError(null)
    saveMutation.mutate({
      name: trimmed,
      description: description.trim(),
      dueDate: isoFromDateInput(dueDate),
      status,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{milestone ? 'Edit milestone' : 'Add milestone'}</DialogTitle>
          <DialogDescription>Milestones mark key dates and roll up task progress.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="milestone-name">Name</Label>
            <Input
              id="milestone-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Beta launch"
              autoFocus
              aria-invalid={!!error}
            />
            {error && <p className="text-xs text-destructive" role="alert">{error}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="milestone-description">Description</Label>
            <Textarea
              id="milestone-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional details"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="milestone-due">Due date</Label>
              <Input id="milestone-due" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as 'OPEN' | 'COMPLETED')}>
                <SelectTrigger className="w-full" aria-label="Milestone status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="COMPLETED">Completed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {milestone ? 'Save' : 'Add milestone'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
