'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import {
  Crown, UserPlus, MoreHorizontal, ShieldQuestion, Mail, Copy, Search, Send, Trash2, Users,
} from 'lucide-react'
import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { can, canChangeRole, grantableRoles } from '@/lib/permissions'
import { ASSIGNABLE_ROLES, ROLE_LABEL, ROLE_DESCRIPTION } from '@/lib/constants'
import type { InvitationDTO, Role, WorkspaceMemberDTO } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from '@/components/ui/dialog'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  UserAvatar, RoleBadge, DateChip, EmptyState, ErrorState, TableSkeleton, ProgressBar,
} from '@/components/shared/ui-primitives'
import { toastMutationError } from '@/components/team/errors'

// ===========================================================================
// Invite dialog
// ===========================================================================

type InvitationWithDevLink = InvitationDTO & { devLink?: string }

interface InviteFormValues {
  email: string
  role: Role
}

function InviteDialog({
  wsId,
  open,
  onOpenChange,
}: {
  wsId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const qc = useQueryClient()
  const navigate = useAppStore((s) => s.navigate)
  const [devLink, setDevLink] = React.useState<string | null>(null)
  const [duplicateError, setDuplicateError] = React.useState<string | null>(null)

  const { register, handleSubmit, control, reset, setError, formState: { errors } } =
    useForm<InviteFormValues>({
      defaultValues: { email: '', role: 'MEMBER' },
    })
  const selectedRole = useWatch({ control, name: 'role' }) ?? 'MEMBER'

  const invite = useMutation({
    mutationFn: (values: InviteFormValues) =>
      api.post<InvitationWithDevLink>(`/api/workspaces/${wsId}/invitations`, values),
    onSuccess: (invitation) => {
      qc.invalidateQueries({ queryKey: qk.invitations(wsId) })
      qc.invalidateQueries({ queryKey: qk.session })
      if (invitation?.devLink) {
        setDevLink(invitation.devLink)
        setDuplicateError(null)
      } else {
        toast.success(`Invitation sent to ${invitation.email}`)
        reset()
        onOpenChange(false)
      }
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 409) {
        setDuplicateError(e.message || 'This person is already a member or has a pending invitation.')
        return
      }
      if (e instanceof ApiError && e.status === 422 && e.details?.email) {
        setError('email', { message: e.details.email })
        return
      }
      toastMutationError(e, 'Failed to send invitation', navigate)
    },
  })

  const close = (next: boolean) => {
    if (!next) {
      reset()
      setDevLink(null)
      setDuplicateError(null)
    }
    onOpenChange(next)
  }

  const copyLink = async () => {
    if (!devLink) return
    try {
      await navigator.clipboard.writeText(devLink)
      toast.success('Invite link copied to clipboard')
    } catch {
      toast.error('Could not copy — please copy the link manually')
    }
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Invite to workspace</DialogTitle>
          <DialogDescription>
            They&apos;ll receive an email invitation to join this workspace.
          </DialogDescription>
        </DialogHeader>

        {devLink ? (
          <div className="space-y-3">
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-foreground">
              Email delivery is not configured in this environment — share this invite link directly.
            </div>
            <div className="flex items-center gap-2">
              <Input readOnly value={devLink} className="flex-1 font-mono text-xs" aria-label="Invitation link" onFocus={(e) => e.currentTarget.select()} />
              <Button type="button" size="icon" variant="outline" onClick={copyLink} aria-label="Copy invite link" className="h-10 w-10 shrink-0">
                <Copy className="h-4 w-4" />
              </Button>
            </div>
            <DialogFooter>
              <Button type="button" onClick={() => close(false)}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          <form onSubmit={handleSubmit((v) => { setDuplicateError(null); invite.mutate(v) })} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="invite-email">Email address</Label>
              <Input
                id="invite-email"
                type="email"
                placeholder="teammate@company.com"
                autoComplete="email"
                aria-invalid={!!errors.email}
                {...register('email', {
                  required: 'Email is required',
                  pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Enter a valid email address' },
                })}
              />
              {(errors.email || duplicateError) && (
                <p className="text-xs text-destructive" role="alert">
                  {errors.email?.message ?? duplicateError}
                </p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="invite-role">Role</Label>
              <Controller
                control={control}
                name="role"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={(v: Role) => field.onChange(v)}>
                    <SelectTrigger id="invite-role" className="w-full" aria-label="Member role">
                      <SelectValue placeholder="Choose a role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ASSIGNABLE_ROLES.map((r) => (
                        <SelectItem key={r} value={r}>
                          <span className="flex flex-col items-start">
                            <span className="text-sm font-medium">{ROLE_LABEL[r]}</span>
                            <span className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[r]}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-xs text-muted-foreground">{ROLE_DESCRIPTION[selectedRole]}</p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => close(false)}>Cancel</Button>
              <Button type="submit" disabled={invite.isPending}>
                {invite.isPending ? 'Sending…' : 'Send invitation'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ===========================================================================
// Member card
// ===========================================================================

function StatChip({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-medium',
        danger && value > 0
          ? 'border-destructive/40 bg-destructive/10 text-destructive'
          : 'border-border bg-muted/50 text-muted-foreground'
      )}
      aria-label={`${value} ${label}`}
    >
      {value}
      <span className="opacity-80">{label}</span>
    </span>
  )
}

function MemberCard({
  wsId,
  member,
  isSelf,
  maxOpenTasks,
}: {
  wsId: string
  member: WorkspaceMemberDTO
  isSelf: boolean
  maxOpenTasks: number
}) {
  const qc = useQueryClient()
  const { session, navigate } = useAppStore()
  const myRole = session?.workspaces.find((w) => w.id === wsId)?.role
  const [confirmRemove, setConfirmRemove] = React.useState(false)
  const canSeeEmail = can(myRole, 'member.view_details')

  const roleOptions = React.useMemo(() => {
    if (!myRole) return []
    return grantableRoles(myRole).filter((r) => canChangeRole(myRole, member.role, r))
  }, [myRole, member.role])

  const changeRole = useMutation({
    mutationFn: (role: Role) =>
      api.patch<WorkspaceMemberDTO>(`/api/workspaces/${wsId}/members/${member.id}`, { role }),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: qk.members(wsId) })
      qc.invalidateQueries({ queryKey: qk.session })
      toast.success(`${updated.name} is now ${ROLE_LABEL[updated.role]}`)
    },
    onError: (e) => toastMutationError(e, 'Failed to change role', navigate),
  })

  const removeMember = useMutation({
    mutationFn: () => api.delete(`/api/workspaces/${wsId}/members/${member.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.members(wsId) })
      qc.invalidateQueries({ queryKey: qk.session })
      qc.invalidateQueries({ queryKey: qk.subscription(wsId) })
      setConfirmRemove(false)
      toast.success(`${member.name} removed from workspace`)
    },
    onError: (e) => {
      setConfirmRemove(false)
      toastMutationError(e, 'Failed to remove member', navigate)
    },
  })

  const workloadPct = maxOpenTasks > 0 ? Math.round((member.openTasks / maxOpenTasks) * 100) : 0

  return (
    <Card className="gap-0 py-0">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <UserAvatar name={member.name} color={member.avatarColor} size="lg" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold truncate">{member.name}</span>
              {member.role === 'OWNER' && <Crown className="h-3.5 w-3.5 text-amber-500 shrink-0" aria-label="Workspace owner" />}
              {isSelf && <Badge variant="outline" className="text-[10px] px-1 py-0">You</Badge>}
            </div>
            {canSeeEmail && member.email ? (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{member.email}</p>
            ) : (
              <p className="text-xs text-muted-foreground mt-0.5">Email hidden</p>
            )}
            <div className="mt-1.5 flex items-center gap-1.5 flex-wrap">
              <RoleBadge role={member.role} />
              <span className="text-[11px] text-muted-foreground">
                Joined {new Date(member.joinedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
              </span>
            </div>
          </div>

          {member.role !== 'OWNER' && (roleOptions.length > 0 || can(myRole, 'member.remove')) && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" aria-label={`Manage ${member.name}`}>
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52">
                {roleOptions.length > 0 && (
                  <>
                    <DropdownMenuLabel className="text-xs text-muted-foreground">Change role</DropdownMenuLabel>
                    {roleOptions.map((r) => (
                      <DropdownMenuItem
                        key={r}
                        disabled={changeRole.isPending}
                        onClick={() => changeRole.mutate(r)}
                      >
                        <ShieldQuestion className="h-4 w-4 mr-2 text-muted-foreground" />
                        <span className="flex-1">{ROLE_LABEL[r]}</span>
                        {member.role === r && <span className="text-[10px] text-muted-foreground">current</span>}
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                )}
                {can(myRole, 'member.remove') && !isSelf && (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setConfirmRemove(true)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Remove from workspace
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-1.5 flex-wrap" aria-label="Task statistics">
          <StatChip label="assigned" value={member.assignedTasks} />
          <StatChip label="completed" value={member.completedTasks} />
          <StatChip label="open" value={member.openTasks} />
          <StatChip label="overdue" value={member.overdueTasks} danger />
        </div>

        <div className="space-y-1" aria-label={`Open tasks workload: ${member.openTasks}`}>
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>Open workload</span>
            <span>{member.openTasks} task{member.openTasks === 1 ? '' : 's'}</span>
          </div>
          <ProgressBar value={workloadPct} color={member.overdueTasks > 0 ? 'var(--destructive)' : undefined} />
        </div>
      </CardContent>

      <AlertDialog open={confirmRemove} onOpenChange={setConfirmRemove}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will lose access to this workspace immediately. Their assigned tasks will remain but become unassigned.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                removeMember.mutate()
              }}
            >
              {removeMember.isPending ? 'Removing…' : 'Remove member'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  )
}

// ===========================================================================
// Pending invitations
// ===========================================================================

function InvitationRow({
  wsId,
  invitation,
}: {
  wsId: string
  invitation: InvitationDTO
}) {
  const qc = useQueryClient()
  const navigate = useAppStore((s) => s.navigate)
  const [confirmRevoke, setConfirmRevoke] = React.useState(false)

  const revoke = useMutation({
    mutationFn: () => api.delete(`/api/workspaces/${wsId}/invitations/${invitation.id}`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invitations(wsId) })
      setConfirmRevoke(false)
      toast.success(`Invitation for ${invitation.email} revoked`)
    },
    onError: (e) => {
      setConfirmRevoke(false)
      toastMutationError(e, 'Failed to revoke invitation', navigate)
    },
  })

  const resend = useMutation({
    mutationFn: () => api.post<InvitationDTO>(`/api/workspaces/${wsId}/invitations/${invitation.id}/resend`),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.invitations(wsId) })
      toast.success(`Invitation re-sent to ${invitation.email}`)
    },
    onError: (e) => toastMutationError(e, 'Failed to resend invitation', navigate),
  })

  const statusTone = invitation.status === 'PENDING' ? 'secondary' : 'outline'

  return (
    <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 sm:flex-nowrap">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted" aria-hidden>
        <Mail className="h-4 w-4 text-muted-foreground" />
      </span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{invitation.email}</p>
        <p className="text-[11px] text-muted-foreground">
          Invited {new Date(invitation.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
        </p>
      </div>
      <RoleBadge role={invitation.role} />
      <Badge variant={statusTone} className={invitation.status !== 'PENDING' ? 'border-destructive/40 text-destructive' : ''}>
        {invitation.status}
      </Badge>
      <span className="text-[11px] text-muted-foreground flex items-center gap-1">
        Expires <DateChip date={invitation.expiresAt} />
      </span>
      <div className="flex items-center gap-1 ml-auto">
        <Button
          variant="outline"
          size="sm"
          className="h-8 min-w-9"
          onClick={() => resend.mutate()}
          disabled={resend.isPending}
          aria-label={`Resend invitation to ${invitation.email}`}
        >
          <Send className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Resend</span>
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-8 min-w-9 text-destructive hover:text-destructive"
          onClick={() => setConfirmRevoke(true)}
          aria-label={`Revoke invitation for ${invitation.email}`}
        >
          <Trash2 className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Revoke</span>
        </Button>
      </div>

      <AlertDialog open={confirmRevoke} onOpenChange={setConfirmRevoke}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revoke invitation?</AlertDialogTitle>
            <AlertDialogDescription>
              The invite link for {invitation.email} will stop working immediately. You can invite them again later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault()
                revoke.mutate()
              }}
            >
              {revoke.isPending ? 'Revoking…' : 'Revoke invitation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}

// ===========================================================================
// TeamManager — full member management surface
// ===========================================================================

export function TeamManager({ wsId, title, headingLevel = 'h1' }: { wsId: string; title: string; headingLevel?: 'h1' | 'h2' }) {
  const { session, navigate } = useAppStore()
  const myRole = session?.workspaces.find((w) => w.id === wsId)?.role
  const [inviteOpen, setInviteOpen] = React.useState(false)
  const [search, setSearch] = React.useState('')

  const canInvite = can(myRole, 'member.invite')

  const membersQuery = useQuery({
    queryKey: qk.members(wsId),
    queryFn: () => api.get<{ members: WorkspaceMemberDTO[] }>(`/api/workspaces/${wsId}/members`),
  })

  const invitationsQuery = useQuery({
    queryKey: qk.invitations(wsId),
    queryFn: () => api.get<{ invitations: InvitationDTO[] }>(`/api/workspaces/${wsId}/invitations`),
    enabled: canInvite,
  })

  const members = membersQuery.data?.members ?? []
  const invitations = invitationsQuery.data?.invitations ?? []
  const pendingInvitations = invitations.filter((i) => i.status === 'PENDING' || i.status === 'EXPIRED')
  const maxOpenTasks = members.reduce((max, m) => Math.max(max, m.openTasks), 0)

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return members
    return members.filter(
      (m) => m.name.toLowerCase().includes(q) || (m.email && m.email.toLowerCase().includes(q))
    )
  }, [members, search])

  const openInvite = () => setInviteOpen(true)

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <div>
          {headingLevel === 'h1' ? (
            <h1 className="text-xl font-bold tracking-tight">{title}</h1>
          ) : (
            <h2 className="text-xl font-bold tracking-tight">{title}</h2>
          )}
          <p className="text-sm text-muted-foreground" aria-live="polite">
            {membersQuery.isLoading ? 'Loading members…' : `${members.length} member${members.length === 1 ? '' : 's'}`}
          </p>
        </div>
        <div className="flex-1" />
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email…"
            className="pl-8 h-10"
            aria-label="Search members"
          />
        </div>
        {canInvite && (
          <Button onClick={() => setInviteOpen(true)} className="h-10 gap-2">
            <UserPlus className="h-4 w-4" /> Invite
          </Button>
        )}
      </div>

      {/* Members */}
      {membersQuery.isLoading ? (
        <TableSkeleton rows={4} />
      ) : membersQuery.isError ? (
        <ErrorState
          message={membersQuery.error instanceof Error ? membersQuery.error.message : 'Failed to load team members'}
          onRetry={() => membersQuery.refetch()}
        />
      ) : members.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Invite your team to start collaborating."
          description="Bring teammates into this workspace, assign roles, and start shipping together."
          action={canInvite ? (
            <Button onClick={openInvite} className="gap-2">
              <UserPlus className="h-4 w-4" /> Invite a teammate
            </Button>
          ) : undefined}
        />
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Search}
          title="No members match your search"
          description={`Nobody found for “${search}”. Try a different name or email.`}
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((m) => (
            <MemberCard
              key={m.id}
              wsId={wsId}
              member={m}
              isSelf={m.userId === session?.user.id}
              maxOpenTasks={maxOpenTasks}
            />
          ))}
        </div>
      )}

      {/* Pending invitations */}
      {canInvite && (invitationsQuery.isLoading || pendingInvitations.length > 0) && (
        <section aria-label="Pending invitations" className="rounded-xl border overflow-hidden">
          <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-3">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <h2 className="text-sm font-semibold">Pending invitations</h2>
            <Badge variant="secondary" className="ml-auto">{pendingInvitations.length}</Badge>
          </div>
          {invitationsQuery.isLoading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 2 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : (
            <div className="max-h-96 divide-y overflow-y-auto">
              {pendingInvitations.map((inv) => (
                <InvitationRow key={inv.id} wsId={wsId} invitation={inv} />
              ))}
            </div>
          )}
        </section>
      )}
      {canInvite && invitationsQuery.isError && (
        <p className="text-xs text-destructive">
          Could not load invitations.{' '}
          <button className="underline" onClick={() => {
            invitationsQuery.refetch()
            toastMutationError(invitationsQuery.error, 'Failed to load invitations', navigate)
          }}>
            Retry
          </button>
        </p>
      )}

      <InviteDialog wsId={wsId} open={inviteOpen} onOpenChange={setInviteOpen} />
    </div>
  )
}
