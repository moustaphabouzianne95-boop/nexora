'use client'

/**
 * Projects list view — toolbar (search / status filter / new project),
 * project card grid, archived filter with restore, empty & error states.
 */

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Archive, ArchiveRestore, CheckSquare, FolderKanban, MoreHorizontal, Plus, Search, Users,
} from 'lucide-react'
import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { can } from '@/lib/permissions'
import { PROJECT_STATUSES, PROJECT_STATUS_LABEL } from '@/lib/constants'
import type { ProjectDTO, ProjectStatus } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  CardGridSkeleton, DateChip, EmptyState, ErrorState, PriorityBadge, ProgressBar, ProjectStatusBadge,
} from '@/components/shared/ui-primitives'
import { ProjectFormDialog } from '@/components/projects/project-form-dialog'
import { ProjectIcon, useMutationErrorHandler, useUpgradeToast, useWorkspaceSession } from '@/components/projects/project-shared'
import { cn } from '@/lib/utils'

type StatusFilter = 'ALL' | ProjectStatus

export default function ProjectsView() {
  const { wsId, role } = useWorkspaceSession()
  const openProject = useAppStore((s) => s.openProject)
  const qc = useQueryClient()
  const onMutationError = useMutationErrorHandler()
  const upgradeToast = useUpgradeToast()

  const [search, setSearch] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>('ALL')
  const [createOpen, setCreateOpen] = React.useState(false)

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(search), 200)
    return () => clearTimeout(t)
  }, [search])

  const projectsQuery = useQuery({
    queryKey: qk.projects(wsId ?? 'none'),
    queryFn: () => api.get<{ projects: ProjectDTO[]; total: number }>(`/api/workspaces/${wsId}/projects`),
    enabled: !!wsId,
  })

  const archivedQuery = useQuery({
    queryKey: [...qk.projects(wsId ?? 'none'), 'archived'] as const,
    queryFn: () =>
      api.get<{ projects: ProjectDTO[]; total: number }>(`/api/workspaces/${wsId}/projects?status=ARCHIVED`),
    enabled: !!wsId && statusFilter === 'ARCHIVED',
  })

  const viewingArchived = statusFilter === 'ARCHIVED'
  const activeQuery = viewingArchived ? archivedQuery : projectsQuery
  const loading = !wsId || activeQuery.isPending
  const rawProjects = activeQuery.data?.projects ?? []

  const q = debounced.trim().toLowerCase()
  const projects = React.useMemo(() => {
    return rawProjects.filter((p) => {
      if (viewingArchived) return true
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false
      if (q && !(`${p.name}`.toLowerCase().includes(q) || (p.description ?? '').toLowerCase().includes(q))) return false
      return true
    })
  }, [rawProjects, statusFilter, q, viewingArchived])

  const restoreMutation = useMutation({
    mutationFn: (id: string) => api.post<ProjectDTO>(`/api/projects/${id}/archive`, { archived: false }),
    onSuccess: (p) => {
      toast.success(`Project “${p.name}” restored`)
      qc.invalidateQueries({ queryKey: ['projects'] })
      qc.invalidateQueries({ queryKey: qk.project(p.id) })
      qc.invalidateQueries({ queryKey: qk.dashboard(wsId ?? 'none') })
    },
    onError: (e) => {
      if (e instanceof ApiError && e.status === 402) {
        upgradeToast('Active project limit')
        return
      }
      onMutationError(e, undefined, 'Failed to restore project')
    },
  })

  const canCreate = can(role, 'project.create')
  const canRestore = can(role, 'project.archive')

  const emptyState = (() => {
    if (q) {
      return (
        <EmptyState
          icon={Search}
          title="No projects match your search"
          description={`Nothing found for “${debounced.trim()}”. Try a different term or clear the filter.`}
        />
      )
    }
    if (viewingArchived) {
      return <EmptyState icon={Archive} title="No archived projects" description="Archived projects will show up here." />
    }
    return canCreate ? (
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="Create your first project to get started."
        action={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" aria-hidden /> New project
          </Button>
        }
      />
    ) : (
      <EmptyState
        icon={FolderKanban}
        title="No projects yet"
        description="Ask an admin or project manager to create your first project."
      />
    )
  })()

  if (!wsId) return null

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-xl font-bold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            {loading ? 'Loading projects…' : `${projects.length} ${projects.length === 1 ? 'project' : 'projects'}`}
            {viewingArchived ? ' · archived' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search projects…"
              aria-label="Search projects"
              className="h-9 w-full pl-8 sm:w-56"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-[140px]" aria-label="Filter by status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All statuses</SelectItem>
              {PROJECT_STATUSES.map((s) => (
                <SelectItem key={s} value={s}>{PROJECT_STATUS_LABEL[s]}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {canCreate && (
            <Button onClick={() => setCreateOpen(true)} className="min-h-9">
              <Plus className="h-4 w-4" aria-hidden /> New project
            </Button>
          )}
        </div>
      </div>

      {activeQuery.isError ? (
        <ErrorState
          message={activeQuery.error instanceof Error ? activeQuery.error.message : 'Failed to load projects'}
          onRetry={() => activeQuery.refetch()}
        />
      ) : loading ? (
        <CardGridSkeleton count={6} />
      ) : projects.length === 0 ? (
        emptyState
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              archived={viewingArchived || p.status === 'ARCHIVED'}
              canRestore={canRestore}
              restoring={restoreMutation.isPending && restoreMutation.variables === p.id}
              onRestore={() => restoreMutation.mutate(p.id)}
              onOpen={() => openProject(p.id)}
            />
          ))}
        </div>
      )}

      <ProjectFormDialog open={createOpen} onOpenChange={setCreateOpen} wsId={wsId} />
    </div>
  )
}

// ------------------------------------------------------------------ card

function ProjectCard({
  project,
  archived,
  canRestore,
  restoring,
  onRestore,
  onOpen,
}: {
  project: ProjectDTO
  archived: boolean
  canRestore: boolean
  restoring: boolean
  onRestore: () => void
  onOpen: () => void
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={`Open project ${project.name}`}
      onClick={onOpen}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen()
        }
      }}
      className={cn(
        'group flex cursor-pointer flex-col gap-2.5 rounded-xl border bg-card p-4 text-left shadow-xs outline-none transition-all hover:shadow-md hover:border-ring/40 focus-visible:ring-2 focus-visible:ring-ring',
        archived && 'opacity-80'
      )}
    >
      <div className="flex items-start gap-2.5">
        <span
          className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border"
          style={{ backgroundColor: `${project.color}1a`, color: project.color, borderColor: `${project.color}33` }}
          aria-hidden
        >
          <ProjectIcon icon={project.icon} className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-sm font-semibold leading-tight">{project.name}</h3>
          <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: project.color }} aria-hidden />
            {project.ownerName}
          </p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <ProjectStatusBadge status={project.status} />
          <PriorityBadge priority={project.priority} />
        </div>
      </div>

      <p className="line-clamp-2 min-h-8 text-xs text-muted-foreground">
        {project.description || <span className="italic opacity-70">No description</span>}
      </p>

      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CheckSquare className="h-3.5 w-3.5" aria-hidden />
            {project.completedCount}/{project.taskCount} tasks
          </span>
          <span>{project.progress}%</span>
        </div>
        <ProgressBar value={project.progress} color={project.color} />
      </div>

      <div className="flex items-center justify-between pt-0.5">
        <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1" title={`${project.memberCount} member${project.memberCount === 1 ? '' : 's'}`}>
            <Users className="h-3.5 w-3.5" aria-hidden />
            {project.memberCount}
          </span>
          {project.dueDate && <DateChip date={project.dueDate} />}
          {archived && <Badge variant="secondary" className="text-[10px]">Archived</Badge>}
        </div>
        {archived && canRestore && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1 text-xs"
            disabled={restoring}
            onClick={(e) => {
              e.stopPropagation()
              onRestore()
            }}
          >
            {restoring ? <MoreHorizontal className="h-3.5 w-3.5" aria-hidden /> : <ArchiveRestore className="h-3.5 w-3.5" aria-hidden />}
            Restore
          </Button>
        )}
      </div>
    </div>
  )
}
