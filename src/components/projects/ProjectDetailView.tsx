'use client'

/**
 * Project detail — header (status, dates, progress, owner, members, actions)
 * and Board | List | Calendar | Timeline tabs (view persisted in
 * localStorage 'nexora-project-view'), plus the milestones section.
 */

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Archive, ArchiveRestore, CalendarDays, Ellipsis, FolderKanban, Pencil, Percent, Trash2, User,
} from 'lucide-react'
import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { can } from '@/lib/permissions'
import type { LabelDTO, MilestoneDTO, ProjectDTO, ProjectMemberDTO, Role, TaskDTO, WorkspaceMemberDTO } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog'
import { BoardSkeleton, ErrorState, PriorityBadge, ProgressBar, ProjectStatusBadge, UserAvatar } from '@/components/shared/ui-primitives'
import { BoardView } from '@/components/projects/board-view'
import { ListView } from '@/components/projects/list-view'
import { CalendarTab } from '@/components/projects/calendar-view'
import { TimelineTab } from '@/components/projects/timeline-view'
import { MilestonesCard } from '@/components/projects/milestones-card'
import { MembersPopover } from '@/components/projects/members-popover'
import { ProjectFormDialog } from '@/components/projects/project-form-dialog'
import {
  ProjectIcon, UpgradeGate, formatDate, useEntitlements, useMutationErrorHandler, useWorkspaceSession,
} from '@/components/projects/project-shared'

const VIEW_STORAGE_KEY = 'nexora-project-view'
type ProjectTab = 'board' | 'list' | 'calendar' | 'timeline'
const TABS: { value: ProjectTab; label: string }[] = [
  { value: 'board', label: 'Board' },
  { value: 'list', label: 'List' },
  { value: 'calendar', label: 'Calendar' },
  { value: 'timeline', label: 'Timeline' },
]

function readStoredTab(): ProjectTab {
  if (typeof window === 'undefined') return 'board'
  const stored = window.localStorage.getItem(VIEW_STORAGE_KEY)
  return stored === 'list' || stored === 'calendar' || stored === 'timeline' ? stored : 'board'
}

export default function ProjectDetailView() {
  const projectId = useAppStore((s) => s.view.projectId)
  const { wsId, role } = useWorkspaceSession()
  const navigate = useAppStore((s) => s.navigate)
  const [tab, setTab] = React.useState<ProjectTab>(readStoredTab)

  React.useEffect(() => {
    window.localStorage.setItem(VIEW_STORAGE_KEY, tab)
  }, [tab])

  if (!projectId || !wsId) {
    return <ErrorState message="No project selected." />
  }

  return (
    <ProjectDetail
      projectId={projectId}
      wsId={wsId}
      role={role}
      tab={tab}
      setTab={setTab}
      navigateHome={() => navigate('projects')}
    />
  )
}

// ------------------------------------------------------------------ detail

function ProjectDetail({
  projectId,
  wsId,
  role,
  tab,
  setTab,
  navigateHome,
}: {
  projectId: string
  wsId: string
  role: Role | null
  tab: ProjectTab
  setTab: (t: ProjectTab) => void
  navigateHome: () => void
}) {
  const qc = useQueryClient()
  const { me } = useWorkspaceSession()
  const onMutationError = useMutationErrorHandler()
  const entitlements = useEntitlements(wsId)

  const [editOpen, setEditOpen] = React.useState(false)
  const [deleteOpen, setDeleteOpen] = React.useState(false)
  const [confirmName, setConfirmName] = React.useState('')

  const projectQuery = useQuery({
    queryKey: qk.project(projectId),
    queryFn: () => api.get<{ project: ProjectDTO; members: ProjectMemberDTO[]; milestones: MilestoneDTO[] }>(`/api/projects/${projectId}`),
  })

  const tasksQuery = useQuery({
    queryKey: qk.projectTasks(projectId),
    queryFn: () => api.get<{ tasks: TaskDTO[] }>(`/api/projects/${projectId}/tasks?view=list&includeDone=1`),
  })

  const membersQuery = useQuery({
    queryKey: qk.members(wsId),
    queryFn: () => api.get<{ members: WorkspaceMemberDTO[] }>(`/api/workspaces/${wsId}/members`),
  })

  const labelsQuery = useQuery({
    queryKey: qk.labels(wsId),
    queryFn: () => api.get<{ labels: LabelDTO[] }>(`/api/workspaces/${wsId}/labels`),
  })

  const project = projectQuery.data?.project
  const projectMembers = projectQuery.data?.members ?? []
  const milestones = projectQuery.data?.milestones ?? []
  const tasks = tasksQuery.data?.tasks ?? []

  // ------------------------------------------------------------- mutations

  const archiveMutation = useMutation({
    mutationFn: (archived: boolean) => api.post<ProjectDTO>(`/api/projects/${projectId}/archive`, { archived }),
    onSuccess: (updated, archived) => {
      toast.success(archived ? `Project “${updated.name}” archived` : `Project “${updated.name}” restored`)
      qc.setQueryData(qk.project(projectId), (prev: { project: ProjectDTO; members: ProjectMemberDTO[]; milestones: MilestoneDTO[] } | undefined) =>
        prev ? { ...prev, project: updated } : prev
      )
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: qk.dashboard(wsId) })
    },
    onError: (e) => onMutationError(e, undefined, 'Failed to change archive state'),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api.delete<{ ok: boolean }>(`/api/projects/${projectId}`),
    onSuccess: () => {
      toast.success('Project deleted')
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: qk.dashboard(wsId) })
      qc.invalidateQueries({ queryKey: qk.workspace(wsId) })
      navigateHome()
    },
    onError: (e) => onMutationError(e, undefined, 'Failed to delete project'),
  })

  // ------------------------------------------------------------- states

  if (projectQuery.isPending) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading project">
        <div className="space-y-3">
          <div className="h-6 w-56 rounded bg-muted animate-pulse" />
          <div className="h-4 w-80 rounded bg-muted animate-pulse" />
        </div>
        <BoardSkeleton />
      </div>
    )
  }

  if (projectQuery.isError || !project) {
    const err = projectQuery.error
    return (
      <div className="space-y-4">
        <ErrorState
          message={err instanceof ApiError && err.status === 404 ? 'Project not found or you no longer have access to it.' : err instanceof Error ? err.message : 'Failed to load project'}
          onRetry={() => projectQuery.refetch()}
        />
        <div className="text-center">
          <Button variant="outline" onClick={navigateHome}>
            <FolderKanban className="h-4 w-4" aria-hidden /> Back to projects
          </Button>
        </div>
      </div>
    )
  }

  const isArchived = project.status === 'ARCHIVED'
  const canEdit = can(role, 'project.edit')
  const canArchive = can(role, 'project.archive')
  const canDelete = can(role, 'project.delete')

  return (
    <div className="space-y-5">
      {/* Header */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-start gap-3">
          <span
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
            style={{ backgroundColor: `${project.color}1a`, color: project.color, borderColor: `${project.color}33` }}
            aria-hidden
          >
            <ProjectIcon icon={project.icon} className="h-5 w-5" />
          </span>

          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="truncate text-xl font-bold tracking-tight">{project.name}</h1>
              <ProjectStatusBadge status={project.status} />
              <PriorityBadge priority={project.priority} />
            </div>
            <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarDays className="h-3.5 w-3.5" aria-hidden />
                {formatDate(project.startDate)} – {formatDate(project.dueDate)}
              </span>
              <span className="inline-flex items-center gap-1.5" aria-label={`Progress ${project.progress}%`}>
                <Percent className="h-3.5 w-3.5" aria-hidden />
                <ProgressBar value={project.progress} color={project.color} className="w-28" />
                {project.progress}%
              </span>
              <span className="inline-flex items-center gap-1.5">
                <User className="h-3.5 w-3.5" aria-hidden />
                <UserAvatar name={project.ownerName} color={project.color} size="xs" />
                {project.ownerName}
              </span>
              <span>
                {project.completedCount}/{project.taskCount} tasks done
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <MembersPopover
              project={project}
              members={projectMembers}
              workspaceMembers={membersQuery.data?.members ?? []}
              role={role}
              wsId={wsId}
            />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" className="h-9 w-9" aria-label="Project actions">
                  <Ellipsis className="h-4 w-4" aria-hidden />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem onClick={() => setEditOpen(true)} disabled={!canEdit}>
                  <Pencil className="h-4 w-4 mr-2" aria-hidden /> Edit project
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={() => archiveMutation.mutate(!isArchived)}
                  disabled={!canArchive || archiveMutation.isPending}
                >
                  {isArchived ? (
                    <>
                      <ArchiveRestore className="h-4 w-4 mr-2" aria-hidden /> Restore project
                    </>
                  ) : (
                    <>
                      <Archive className="h-4 w-4 mr-2" aria-hidden /> Archive project
                    </>
                  )}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setDeleteOpen(true)} disabled={!canDelete} className="text-destructive focus:text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" aria-hidden /> Delete project
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {project.description && (
          <p className="max-w-3xl text-sm text-muted-foreground">{project.description}</p>
        )}
      </header>

      {/* View tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as ProjectTab)}>
        <TabsList className="h-9">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="min-h-8 px-3">
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="board" className="mt-3">
          {tasksQuery.isPending ? (
            <BoardSkeleton />
          ) : tasksQuery.isError ? (
            <ErrorState message="Failed to load tasks" onRetry={() => tasksQuery.refetch()} />
          ) : (
            <BoardView
              projectId={projectId}
              tasks={tasks}
              labels={labelsQuery.data?.labels ?? []}
              members={membersQuery.data?.members ?? []}
            />
          )}
        </TabsContent>

        <TabsContent value="list" className="mt-3">
          {tasksQuery.isPending ? (
            <BoardSkeleton />
          ) : tasksQuery.isError ? (
            <ErrorState message="Failed to load tasks" onRetry={() => tasksQuery.refetch()} />
          ) : (
            <ListView
              projectId={projectId}
              tasks={tasks}
              role={role}
              me={me}
              wsId={wsId}
              onGoToBoard={() => setTab('board')}
            />
          )}
        </TabsContent>

        <TabsContent value="calendar" className="mt-3">
          {entitlements.calendarView ? (
            <CalendarTab tasks={tasks} milestones={milestones} />
          ) : (
            <UpgradeGate feature="Calendar view" entitlementKey="calendarView" />
          )}
        </TabsContent>

        <TabsContent value="timeline" className="mt-3">
          {entitlements.timelineView ? (
            <TimelineTab tasks={tasks} />
          ) : (
            <UpgradeGate feature="Timeline view" entitlementKey="timelineView" />
          )}
        </TabsContent>
      </Tabs>

      {/* Milestones */}
      <MilestonesCard project={project} milestones={milestones} role={role} />

      {/* Dialogs */}
      <ProjectFormDialog open={editOpen} onOpenChange={setEditOpen} wsId={wsId} project={project} />

      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete “{project.name}”?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently deletes the project and all its tasks, comments and attachments. Type the project name to confirm.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input
            value={confirmName}
            onChange={(e) => setConfirmName(e.target.value)}
            placeholder={project.name}
            aria-label="Type project name to confirm deletion"
          />
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmName('')}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-white hover:bg-destructive/90"
              disabled={confirmName !== project.name || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate()}
            >
              Delete project
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
