'use client'

/**
 * Create / Edit project dialog shared by ProjectsView and ProjectDetailView.
 * react-hook-form driven; members picker only shown on create (the project
 * header popover manages members of an existing project).
 */

import * as React from 'react'
import { useForm } from 'react-hook-form'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'
import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { can } from '@/lib/permissions'
import { PROJECT_COLORS, PROJECT_ICONS, PRIORITIES, PRIORITY_LABEL, PROJECT_STATUSES, PROJECT_STATUS_LABEL } from '@/lib/constants'
import type { Priority, ProjectDTO, ProjectStatus, WorkspaceMemberDTO } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Checkbox } from '@/components/ui/checkbox'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import { UserAvatar } from '@/components/shared/ui-primitives'
import {
  ProjectIcon, dateInputValue, isoFromDateInput, useMutationErrorHandler, useUpgradeToast, useWorkspaceSession,
} from '@/components/projects/project-shared'
import { cn } from '@/lib/utils'

interface FormValues {
  name: string
  description: string
  color: string
  icon: string
  status: ProjectStatus
  priority: Priority
  startDate: string
  dueDate: string
  memberIds: string[]
}

export function ProjectFormDialog({
  open,
  onOpenChange,
  wsId,
  project,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  wsId: string | null
  project?: ProjectDTO
}) {
  const isEdit = !!project
  const { role, me } = useWorkspaceSession()
  const qc = useQueryClient()
  const onMutationError = useMutationErrorHandler()
  const upgradeToast = useUpgradeToast()
  const [nameError, setNameError] = React.useState<string | null>(null)

  const membersQuery = useQuery({
    queryKey: qk.members(wsId ?? 'none'),
    queryFn: () => api.get<{ members: WorkspaceMemberDTO[] }>(`/api/workspaces/${wsId}/members`),
    enabled: open && !!wsId && !isEdit,
  })

  const { register, handleSubmit, watch, setValue, reset, formState: { errors } } = useForm<FormValues>({
    defaultValues: {
      name: '',
      description: '',
      color: PROJECT_COLORS[0],
      icon: 'folder',
      status: 'ACTIVE',
      priority: 'MEDIUM',
      startDate: '',
      dueDate: '',
      memberIds: [],
    },
  })

  React.useEffect(() => {
    if (!open) return
    setNameError(null)
    reset({
      name: project?.name ?? '',
      description: project?.description ?? '',
      color: project?.color ?? PROJECT_COLORS[0],
      icon: project?.icon ?? 'folder',
      status: project?.status ?? 'ACTIVE',
      priority: project?.priority ?? 'MEDIUM',
      startDate: dateInputValue(project?.startDate),
      dueDate: dateInputValue(project?.dueDate),
      memberIds: [],
    })
  }, [open, project, reset])

  const color = watch('color')
  const icon = watch('icon')
  const status = watch('status')
  const priority = watch('priority')
  const memberIds = watch('memberIds')

  const createMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.post<ProjectDTO>(`/api/workspaces/${wsId}/projects`, body),
    onSuccess: (created) => {
      toast.success(`Project “${created.name}” created`)
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: qk.dashboard(wsId ?? 'none') })
      qc.invalidateQueries({ queryKey: qk.workspace(wsId ?? 'none') })
      onOpenChange(false)
      useAppStore.getState().openProject(created.id)
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) {
        upgradeToast('Creating more projects')
        return
      }
      if (e instanceof ApiError && e.status === 409) {
        setNameError(e.message || 'A project with this name already exists')
        return
      }
      if (e instanceof ApiError && e.status === 422 && e.details) {
        for (const [field, message] of Object.entries(e.details)) {
          if (field === 'name') setNameError(message)
          else toast.error(message)
        }
        return
      }
      onMutationError(e, undefined, 'Failed to create project')
    },
  })

  const updateMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch<ProjectDTO>(`/api/projects/${project?.id}`, body),
    onSuccess: (updated) => {
      toast.success('Project updated')
      qc.setQueryData(qk.project(project?.id ?? ''), (prev: { project: ProjectDTO } | undefined) =>
        prev ? { ...prev, project: updated } : prev
      )
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: qk.dashboard(wsId ?? 'none') })
      onOpenChange(false)
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) {
        upgradeToast('Project updates')
        return
      }
      onMutationError(e, undefined, 'Failed to update project')
    },
  })

  const pending = createMutation.isPending || updateMutation.isPending
  const canEdit = isEdit ? can(role, 'project.edit') : true

  const onSubmit = (values: FormValues) => {
    setNameError(null)
    if (isEdit && !canEdit) return
    const body: Record<string, unknown> = {
      name: values.name.trim(),
      description: values.description.trim(),
      color: values.color,
      icon: values.icon,
      status: values.status,
      priority: values.priority,
      startDate: isoFromDateInput(values.startDate),
      dueDate: isoFromDateInput(values.dueDate),
    }
    if (!isEdit) body.memberIds = values.memberIds
    if (isEdit) updateMutation.mutate(body)
    else createMutation.mutate(body)
  }

  const toggleMember = (userId: string) => {
    const next = memberIds.includes(userId) ? memberIds.filter((id) => id !== userId) : [...memberIds, userId]
    setValue('memberIds', next, { shouldDirty: true })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92dvh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'Edit project' : 'New project'}</DialogTitle>
          <DialogDescription>
            {isEdit ? 'Update the project details.' : 'Create a project and optionally invite teammates to it.'}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="project-name">Name</Label>
            <Input
              id="project-name"
              placeholder="e.g. Website Redesign"
              autoFocus
              aria-invalid={!!errors.name || !!nameError}
              {...register('name', { required: 'Name is required', minLength: { value: 2, message: 'Name is required' }, maxLength: { value: 80, message: 'Max 80 characters' } })}
            />
            {(errors.name || nameError) && (
              <p className="text-xs text-destructive" role="alert">{errors.name?.message ?? nameError}</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="project-description">Description</Label>
            <Textarea
              id="project-description"
              placeholder="What is this project about?"
              rows={3}
              {...register('description', { maxLength: { value: 2000, message: 'Max 2000 characters' } })}
            />
            {errors.description && <p className="text-xs text-destructive">{errors.description.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setValue('status', v as ProjectStatus, { shouldDirty: true })}>
                <SelectTrigger className="w-full" aria-label="Project status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PROJECT_STATUSES.filter((s) => s !== 'ARCHIVED').map((s) => (
                    <SelectItem key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select value={priority} onValueChange={(v) => setValue('priority', v as Priority, { shouldDirty: true })}>
                <SelectTrigger className="w-full" aria-label="Project priority"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="project-start">Start date</Label>
              <Input id="project-start" type="date" {...register('startDate')} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="project-due">Due date</Label>
              <Input id="project-due" type="date" {...register('dueDate')} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Color</Label>
            <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Project color">
              {PROJECT_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  role="radio"
                  aria-checked={color === c}
                  aria-label={`Color ${c}`}
                  onClick={() => setValue('color', c, { shouldDirty: true })}
                  className={cn(
                    'h-8 w-8 rounded-full border-2 outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring',
                    color === c ? 'border-foreground scale-110' : 'border-transparent hover:scale-105'
                  )}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>Icon</Label>
            <Select value={icon} onValueChange={(v) => setValue('icon', v, { shouldDirty: true })}>
              <SelectTrigger className="w-full" aria-label="Project icon">
                <span className="flex items-center gap-2">
                  <ProjectIcon icon={icon} className="h-4 w-4" />
                  <SelectValue />
                </span>
              </SelectTrigger>
              <SelectContent>
                {PROJECT_ICONS.map((ic) => (
                  <SelectItem key={ic} value={ic}>
                    <span className="flex items-center gap-2">
                      <ProjectIcon icon={ic} className="h-4 w-4" />
                      <span className="capitalize">{ic.replace(/-/g, ' ')}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {!isEdit && (
            <div className="space-y-1.5">
              <Label>Members <span className="font-normal text-muted-foreground">(you are added as lead)</span></Label>
              {membersQuery.isLoading ? (
                <div className="flex items-center gap-2 py-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading members…
                </div>
              ) : (membersQuery.data?.members.length ?? 0) === 0 ? (
                <p className="py-1 text-sm text-muted-foreground">No other workspace members yet.</p>
              ) : (
                <ScrollArea className="h-36 rounded-md border p-2">
                  <div className="space-y-1">
                    {membersQuery.data?.members
                      .filter((m) => m.userId !== me?.id)
                      .map((m) => (
                        <label
                          key={m.id}
                          className="flex min-h-9 cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm hover:bg-accent/60"
                        >
                          <Checkbox
                            checked={memberIds.includes(m.userId)}
                            onCheckedChange={() => toggleMember(m.userId)}
                            aria-label={`Add ${m.name} to project`}
                          />
                          <UserAvatar name={m.name} color={m.avatarColor} size="xs" />
                          <span className="flex-1 truncate">{m.name}</span>
                          <span className="text-xs text-muted-foreground truncate hidden sm:block">{m.email}</span>
                        </label>
                      ))}
                  </div>
                </ScrollArea>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 pt-1">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending || (isEdit && !canEdit)}>
              {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              {isEdit ? 'Save changes' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

// NOTE: the current user (project creator) is added automatically by the server as
// LEAD, so they are excluded from the member picker when creating a project.
