'use client'

/**
 * Project members popover — avatar stack trigger; PM+ can add/remove project
 * members (persisted via PATCH /api/projects/:id { memberIds }).
 */

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Loader2, Minus, Plus, UserPlus } from 'lucide-react'
import { api, qk, ApiError } from '@/lib/api-client'
import { can } from '@/lib/permissions'
import type { ProjectDTO, ProjectMemberDTO, Role, WorkspaceMemberDTO } from '@/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { AvatarStack, UserAvatar } from '@/components/shared/ui-primitives'
import { useMutationErrorHandler } from '@/components/projects/project-shared'
import { ChevronDown } from 'lucide-react'

export function MembersPopover({
  project,
  members,
  workspaceMembers,
  role,
  wsId,
}: {
  project: ProjectDTO
  members: ProjectMemberDTO[]
  workspaceMembers: WorkspaceMemberDTO[]
  role: Role | null
  wsId: string | null
}) {
  const qc = useQueryClient()
  const onMutationError = useMutationErrorHandler()
  const [open, setOpen] = React.useState(false)
  const canManage = can(role, 'project.edit')

  const memberUserIds = members.map((m) => m.userId)
  const addable = workspaceMembers.filter((w) => !memberUserIds.includes(w.userId))

  const updateMembers = useMutation({
    mutationFn: (ids: string[]) => api.patch<ProjectDTO>(`/api/projects/${project.id}`, { memberIds: ids }),
    onSuccess: () => {
      toast.success('Project members updated')
      qc.invalidateQueries({ queryKey: qk.project(project.id) })
      qc.invalidateQueries({ queryKey: ['projects'] })
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        toast.error(e.message)
        return
      }
      onMutationError(e, undefined, 'Failed to update project members')
    },
  })

  const removeMember = (m: ProjectMemberDTO) => {
    updateMembers.mutate(memberUserIds.filter((id) => id !== m.userId))
  }
  const addMember = (w: WorkspaceMemberDTO) => {
    updateMembers.mutate([...memberUserIds, w.userId])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-1 rounded-full border bg-background py-1 pl-2 pr-1.5 outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Project members (${members.length})${canManage ? ' — manage' : ''}`}
        >
          <AvatarStack people={members.map((m) => ({ name: m.name, avatarColor: m.avatarColor }))} max={4} size="xs" />
          {canManage && <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-0">
        <div className="border-b px-3 py-2">
          <h4 className="text-sm font-semibold">Project members</h4>
          <p className="text-xs text-muted-foreground">{members.length} of {workspaceMembers.length} workspace members</p>
        </div>
        <div className="max-h-64 overflow-y-auto p-1.5">
          {members.map((m) => (
            <div key={m.id} className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1">
              <UserAvatar name={m.name} color={m.avatarColor} size="xs" />
              <span className="flex-1 truncate text-sm">{m.name}</span>
              {m.role === 'LEAD' ? (
                <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Lead</span>
              ) : (
                <span className="text-[10px] capitalize text-muted-foreground">{m.role.toLowerCase()}</span>
              )}
              {canManage && m.role !== 'LEAD' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => removeMember(m)}
                  disabled={updateMembers.isPending}
                  aria-label={`Remove ${m.name} from project`}
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden />
                </Button>
              )}
            </div>
          ))}
          {members.length === 0 && <p className="px-2 py-3 text-sm text-muted-foreground">No project members yet.</p>}
        </div>
        {canManage && addable.length > 0 && (
          <div className="border-t p-1.5">
            <p className="px-2 pb-1 pt-0.5 text-[11px] font-medium text-muted-foreground">Add from workspace</p>
            {addable.map((w) => (
              <div key={w.id} className="flex min-h-9 items-center gap-2 rounded-md px-2 py-1 hover:bg-accent/60">
                <UserAvatar name={w.name} color={w.avatarColor} size="xs" />
                <span className="flex-1 truncate text-sm">{w.name}</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => addMember(w)}
                  disabled={updateMembers.isPending}
                  aria-label={`Add ${w.name} to project`}
                >
                  {updateMembers.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Plus className="h-3.5 w-3.5" aria-hidden />}
                </Button>
              </div>
            ))}
          </div>
        )}
        {canManage && addable.length === 0 && (
          <p className="flex items-center gap-1.5 border-t px-3 py-2 text-xs text-muted-foreground">
            <UserPlus className="h-3.5 w-3.5" aria-hidden /> All workspace members are on this project.
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
