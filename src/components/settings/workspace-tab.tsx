'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { Copy, Loader2, ShieldAlert, Archive, ArchiveRestore, LifeBuoy } from 'lucide-react'
import { api, qk } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { can } from '@/lib/permissions'
import { toastMutationError } from '@/components/team/errors'
import { PROJECT_COLORS, TIMEZONES, WORKSPACE_TYPE_LABEL } from '@/lib/constants'
import type { SessionUser, WorkspaceDetail } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { ErrorState } from '@/components/shared/ui-primitives'

interface WorkspaceFormValues {
  name: string
  description: string
  logoColor: string
  timezone: string
}

export function WorkspaceTab({ wsId }: { wsId: string }) {
  const { session, navigate, setSession } = useAppStore()
  const qc = useQueryClient()
  const myRole = session?.workspaces.find((w) => w.id === wsId)?.role
  const isOwner = myRole === 'OWNER'
  const canEdit = can(myRole, 'workspace.settings.edit')
  const canArchive = can(myRole, 'workspace.archive')

  const wsQuery = useQuery({
    queryKey: qk.workspace(wsId),
    queryFn: () => api.get<WorkspaceDetail>(`/api/workspaces/${wsId}`),
    enabled: !!wsId,
  })
  const ws = wsQuery.data

  const form = useForm<WorkspaceFormValues>({
    values: React.useMemo(
      () => ({
        name: ws?.name ?? '',
        description: ws?.description ?? '',
        logoColor: ws?.logoColor ?? PROJECT_COLORS[0],
        timezone: ws?.timezone ?? 'UTC',
      }),
      [ws?.name, ws?.description, ws?.logoColor, ws?.timezone]
    ),
  })

  // useWatch hooks must run before any early return
  const watchedColor = useWatch({ control: form.control, name: 'logoColor' }) ?? PROJECT_COLORS[0]
  const watchedName = useWatch({ control: form.control, name: 'name' }) ?? ''

  const patchWorkspace = useMutation({
    mutationFn: (values: Partial<WorkspaceFormValues>) =>
      api.patch<WorkspaceDetail>(`/api/workspaces/${wsId}`, values),
    onSuccess: (updated) => {
      qc.setQueryData(qk.workspace(wsId), updated)
      qc.invalidateQueries({ queryKey: qk.session })
      toast.success('Workspace updated')
    },
    onError: (e) => toastMutationError(e, 'Failed to update workspace', navigate),
  })

  const archiveToggle = useMutation({
    mutationFn: (archived: boolean) =>
      api.post<{ ok: boolean }>(`/api/workspaces/${wsId}/archive`, { archived }),
    onSuccess: (_data, archived) => {
      qc.invalidateQueries({ queryKey: qk.workspace(wsId) })
      qc.invalidateQueries({ queryKey: qk.session })
      toast.success(archived ? 'Workspace archived' : 'Workspace unarchived')
    },
    onError: (e) => toastMutationError(e, 'Failed to change archive state', navigate),
  })

  const deleteWorkspace = useMutation({
    mutationFn: async () => {
      await api.delete<{ ok: boolean }>(`/api/workspaces/${wsId}`)
      // Re-derive the session from scratch — current workspace is gone
      const fresh = await api.get<SessionUser>('/api/auth/me')
      qc.setQueryData(qk.session, fresh)
      setSession(fresh)
      return fresh
    },
    onSuccess: (fresh) => {
      qc.invalidateQueries()
      toast.success(
        fresh && fresh.workspaces.length > 0
          ? 'Workspace deleted — switched to your next workspace'
          : 'Workspace deleted'
      )
    },
    onError: (e) => toastMutationError(e, 'Failed to delete workspace', navigate),
  })

  const copySlug = async () => {
    if (!ws) return
    try {
      await navigator.clipboard.writeText(ws.slug)
      toast.success('Workspace slug copied')
    } catch {
      toast.error('Could not copy — please copy manually')
    }
  }

  if (wsQuery.isLoading) {
    return (
      <div className="max-w-3xl space-y-4">
        <Skeleton className="h-40 w-full rounded-xl" />
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
    )
  }
  if (wsQuery.isError || !ws) {
    return (
      <ErrorState
        message={wsQuery.error instanceof Error ? wsQuery.error.message : 'Failed to load workspace'}
        onRetry={() => wsQuery.refetch()}
      />
    )
  }

  const archived = !!ws.archivedAt

  const slugRow = (
    <div className="flex flex-wrap items-center gap-2">
      <Label className="text-sm text-muted-foreground">Slug</Label>
      <code className="rounded-md bg-muted px-2 py-1 text-sm">{ws.slug}</code>
      <Button type="button" variant="ghost" size="sm" className="h-8 min-w-9" onClick={copySlug} aria-label="Copy slug">
        <Copy className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Copy</span>
      </Button>
      <Badge variant="outline" className="ml-auto">{WORKSPACE_TYPE_LABEL[ws.type] ?? ws.type}</Badge>
    </div>
  )

  return (
    <div className="max-w-3xl space-y-6">
      {/* ----------------------------------------------------- general */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Workspace</CardTitle>
          <CardDescription>
            {canEdit
              ? 'Visible to everyone in this workspace.'
              : 'Only owners and admins can edit these settings — shown read-only for you.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {slugRow}

          {canEdit ? (
            <form
              onSubmit={form.handleSubmit((v) =>
                patchWorkspace.mutate({
                  name: v.name,
                  description: v.description,
                  logoColor: v.logoColor,
                  timezone: v.timezone,
                })
              )}
              className="space-y-4"
              noValidate
            >
              <div className="flex items-center gap-4">
                <span
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white text-lg font-bold"
                  style={{ backgroundColor: watchedColor }}
                  aria-hidden
                >
                  {watchedName.charAt(0).toUpperCase() || 'W'}
                </span>
                <div>
                  <Label className="text-sm">Logo color</Label>
                  <div className="mt-1.5 flex flex-wrap gap-2" role="radiogroup" aria-label="Workspace color">
                    {PROJECT_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        role="radio"
                        aria-checked={watchedColor === c}
                        aria-label={`Workspace color ${c}`}
                        onClick={() => form.setValue('logoColor', c, { shouldDirty: true })}
                        className={cn(
                          'h-8 w-8 rounded-full border-2 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-ring hover:scale-110',
                          watchedColor === c ? 'border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background' : 'border-transparent'
                        )}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="ws-name">Name</Label>
                  <Input
                    id="ws-name"
                    aria-invalid={!!form.formState.errors.name}
                    {...form.register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })}
                  />
                  {form.formState.errors.name && (
                    <p className="text-xs text-destructive" role="alert">{form.formState.errors.name.message}</p>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ws-timezone">Timezone</Label>
                  <Controller
                    control={form.control}
                    name="timezone"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="ws-timezone" className="w-full" aria-label="Workspace timezone">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-72">
                          {TIMEZONES.map((tz) => (
                            <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label htmlFor="ws-description">Description</Label>
                  <Textarea
                    id="ws-description"
                    rows={3}
                    placeholder="What is this workspace for?"
                    {...form.register('description')}
                  />
                </div>
              </div>

              <div className="flex justify-end">
                <Button type="submit" disabled={patchWorkspace.isPending || !form.formState.isDirty}>
                  {patchWorkspace.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-xl text-white font-bold"
                  style={{ backgroundColor: ws.logoColor }}
                  aria-hidden
                >
                  {ws.name.charAt(0)}
                </span>
                <div>
                  <p className="text-sm font-semibold">{ws.name}</p>
                  <p className="text-xs text-muted-foreground">{ws.timezone}</p>
                </div>
              </div>
              {ws.description && <p className="text-sm text-muted-foreground">{ws.description}</p>}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ----------------------------------------------------- archive */}
      {canArchive && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Archive className="h-4 w-4 text-muted-foreground" /> {archived ? 'Unarchive workspace' : 'Archive workspace'}
            </CardTitle>
            <CardDescription>
              {archived
                ? 'Members can access this workspace again and it returns to active lists.'
                : 'Archiving hides the workspace from daily use. Members keep their data and it can be restored at any time.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {archived ? (
              <Button
                variant="outline"
                onClick={() => archiveToggle.mutate(false)}
                disabled={archiveToggle.isPending}
                className="gap-2 min-h-11"
              >
                <ArchiveRestore className="h-4 w-4" /> Unarchive workspace
              </Button>
            ) : (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" className="gap-2 min-h-11">
                    <Archive className="h-4 w-4" /> Archive workspace
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Archive “{ws.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      The workspace becomes read-only and hidden from the sidebar. You can unarchive it whenever you like.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={() => archiveToggle.mutate(true)}>
                      Archive
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------- ownership transfer */}
      {isOwner && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <LifeBuoy className="h-4 w-4 text-muted-foreground" /> Ownership transfer
            </CardTitle>
            <CardDescription>
              Transferring ownership to another member is not yet self-serve. Contact support and we&apos;ll
              move the workspace for you after verifying both parties.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button variant="outline" className="gap-2 min-h-11" onClick={() => toast.info('Support request noted', { description: 'Email support@nexora.app from the owner account to transfer ownership.' })}>
              <LifeBuoy className="h-4 w-4" /> Contact support
            </Button>
          </CardContent>
        </Card>
      )}

      {/* -------------------------------------------------- danger zone */}
      {isOwner && (
        <>
          <Separator />
          <Card className="border-destructive/40">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base text-destructive">
                <ShieldAlert className="h-4 w-4" /> Danger zone
              </CardTitle>
              <CardDescription>
                Deleting a workspace permanently removes its projects, tasks, comments, and files. This cannot be undone.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" className="min-h-11">Delete workspace</Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Delete “{ws.name}”?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This permanently deletes the workspace and everything in it. Type the workspace name to confirm.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <DeleteConfirmInput workspaceName={ws.name} onConfirm={() => deleteWorkspace.mutate()} pending={deleteWorkspace.isPending} />
                </AlertDialogContent>
              </AlertDialog>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function DeleteConfirmInput({
  workspaceName,
  onConfirm,
  pending,
}: {
  workspaceName: string
  onConfirm: () => void
  pending: boolean
}) {
  const [value, setValue] = React.useState('')
  const matches = value === workspaceName
  return (
    <div className="space-y-3">
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={workspaceName}
        aria-label={`Type ${workspaceName} to confirm deletion`}
      />
      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
        <AlertDialogAction
          disabled={!matches || pending}
          className="bg-destructive text-white hover:bg-destructive/90"
          onClick={(e) => {
            e.preventDefault()
            onConfirm()
          }}
        >
          {pending && <Loader2 className="h-4 w-4 animate-spin" />}
          Delete forever
        </AlertDialogAction>
      </div>
    </div>
  )
}
