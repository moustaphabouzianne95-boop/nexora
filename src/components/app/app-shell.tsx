'use client'

import * as React from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import { PLANS } from '@/lib/constants'
import { can } from '@/lib/permissions'
import type { NotificationDTO, SearchResult, SessionUser, WorkspaceDetail } from '@/types'
import {
  LayoutDashboard, Inbox, CheckSquare, FolderKanban, Calendar, Users, BarChart3,
  Settings, Plus, ChevronsUpDown, Check, LogOut, User, Moon, SunMedium, Monitor,
  Search, Bell, PanelLeft, HelpCircle, Building2, Sparkles, X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetContent, SheetTitle } from '@/components/ui/sheet'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from '@/components/ui/dropdown-menu'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'
import { UserAvatar, formatRelativeTime } from '@/components/shared/ui-primitives'
import { useTheme } from 'next-themes'

// ===========================================================================
// Sidebar
// ===========================================================================

const NAV_ITEMS = [
  { view: 'dashboard' as const, label: 'Overview', icon: LayoutDashboard },
  { view: 'inbox' as const, label: 'Inbox', icon: Inbox, badgeKey: 'notifications' as const },
  { view: 'my-tasks' as const, label: 'My Tasks', icon: CheckSquare },
  { view: 'projects' as const, label: 'Projects', icon: FolderKanban },
  { view: 'calendar' as const, label: 'Calendar', icon: Calendar },
  { view: 'team' as const, label: 'Team', icon: Users },
  { view: 'reports' as const, label: 'Reports', icon: BarChart3 },
  { view: 'settings' as const, label: 'Settings', icon: Settings },
]

function WorkspaceSwitcher({ session }: { session: SessionUser }) {
  const qc = useQueryClient()
  const { navigate } = useAppStore()
  const [open, setOpen] = React.useState(false)
  const current = session.workspaces.find((w) => w.id === session.currentWorkspaceId)

  const switchMutation = useMutation({
    mutationFn: (workspaceId: string) => api.post<SessionUser>('/api/workspaces/switch', { workspaceId }),
    onSuccess: (data) => {
      qc.setQueryData(qk.session, data)
      qc.invalidateQueries()
      setOpen(false)
      toast.success(`Switched to ${data.workspaces.find((w) => w.id === data.currentWorkspaceId)?.name ?? 'workspace'}`)
    },
    onError: (e) => toast.error(e instanceof ApiError ? e.message : 'Failed to switch workspace'),
  })

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <button
          className="flex items-center gap-2 w-full rounded-lg px-2 py-1.5 text-left hover:bg-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label="Switch workspace"
        >
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-white text-sm font-bold"
            style={{ backgroundColor: current?.logoColor ?? '#6366f1' }}
            aria-hidden
          >
            {(current?.name ?? 'N').charAt(0)}
          </span>
          <span className="flex-1 min-w-0">
            <span className="block text-sm font-semibold truncate">{current?.name ?? 'No workspace'}</span>
            <span className="block text-[11px] text-muted-foreground truncate">{current ? `nexora.app/${current.slug}` : 'Create one to start'}</span>
          </span>
          <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Workspaces</DropdownMenuLabel>
        {session.workspaces.map((w) => (
          <DropdownMenuItem key={w.id} onClick={() => switchMutation.mutate(w.id)} className="gap-2">
            <span className="flex h-6 w-6 items-center justify-center rounded text-[10px] font-bold text-white" style={{ backgroundColor: w.logoColor }} aria-hidden>
              {w.name.charAt(0)}
            </span>
            <span className="flex-1 truncate text-sm">{w.name}</span>
            <span className="text-[10px] text-muted-foreground uppercase">{w.role === 'OWNER' ? 'Owner' : w.role.replace('_', ' ')}</span>
            {w.id === session.currentWorkspaceId && <Check className="h-4 w-4 text-primary" />}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => { setOpen(false); navigate('onboarding') }} className="gap-2">
          <Plus className="h-4 w-4" /> Create workspace
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ThemeToggle() {
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])
  const Icon = !mounted ? Monitor : theme === 'dark' ? Moon : theme === 'light' ? SunMedium : Monitor
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Change theme" className="h-8 w-8 text-muted-foreground">
          <Icon className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="top">
        <DropdownMenuItem onClick={() => setTheme('light')}><SunMedium className="h-4 w-4 mr-2" /> Light</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('dark')}><Moon className="h-4 w-4 mr-2" /> Dark</DropdownMenuItem>
        <DropdownMenuItem onClick={() => setTheme('system')}><Monitor className="h-4 w-4 mr-2" /> System</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function SidebarNavContent() {
  const { session, view, navigate } = useAppStore()
  const unread = useUnreadCount()
  if (!session) return null

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pt-3 pb-1">
        <WorkspaceSwitcher session={session} />
      </div>
      <nav className="flex-1 px-3 py-2 space-y-0.5" aria-label="Main navigation">
        {NAV_ITEMS.map((item) => {
          const active = view.name === item.view || (item.view === 'projects' && view.name === 'project')
          return (
            <button
              key={item.view}
              onClick={() => navigate(item.view)}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              <span className="flex-1 text-left">{item.label}</span>
              {item.badgeKey === 'notifications' && unread > 0 && (
                <Badge className="h-5 min-w-5 px-1.5 text-[10px] rounded-full" aria-label={`${unread} unread`}>{unread > 99 ? '99+' : unread}</Badge>
              )}
            </button>
          )
        })}
      </nav>
      <div className="border-t px-3 py-2 flex items-center justify-between">
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" aria-label="Help" onClick={() => toast.info('Documentation & support', { description: 'See README.md for setup, demo accounts, and architecture notes.' })}>
            <HelpCircle className="h-4 w-4" />
          </Button>
        </div>
        <ProfileMenu session={session} />
      </div>
    </div>
  )
}

function ProfileMenu({ session }: { session: SessionUser }) {
  const qc = useQueryClient()
  const { navigate } = useAppStore()
  const logout = useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      qc.setQueryData(qk.session, null)
      qc.clear()
      useAppStore.getState().setSession(null)
      navigate('landing')
      toast.success('Signed out')
    },
  })
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring" aria-label="Open profile menu">
          <UserAvatar name={session.user.name} color={session.user.avatarColor} size="sm" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" side="top" className="w-56">
        <DropdownMenuLabel>
          <div className="text-sm font-medium">{session.user.name}</div>
          <div className="text-xs font-normal text-muted-foreground truncate">{session.user.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate('settings', { settingsTab: 'profile' })}>
          <User className="h-4 w-4 mr-2" /> Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => logout.mutate()} disabled={logout.isPending} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" /> Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

// ===========================================================================
// Header
// ===========================================================================

function useUnreadCount(): number {
  const { data } = useQuery({
    queryKey: qk.notifications,
    queryFn: () => api.get<{ notifications: NotificationDTO[]; unread: number }>('/api/notifications'),
    refetchInterval: 30_000,
    staleTime: 10_000,
  })
  return data?.unread ?? 0
}

function SearchBox({ wsId }: { wsId: string }) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState('')
  const [debounced, setDebounced] = React.useState('')
  const { openProject, navigate, openTaskDialog } = useAppStore()

  React.useEffect(() => {
    const t = setTimeout(() => setDebounced(query), 250)
    return () => clearTimeout(t)
  }, [query])

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === 'k' || e.key === 'K') && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  const { data, isFetching } = useQuery({
    queryKey: ['search', wsId, debounced],
    queryFn: () => api.get<SearchResult>(`/api/search?q=${encodeURIComponent(debounced)}&workspaceId=${wsId}`),
    enabled: open && debounced.length >= 2,
  })

  const hasResults = data && (data.projects.length > 0 || data.tasks.length > 0 || data.members.length > 0)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="hidden md:flex items-center gap-2 rounded-lg border bg-muted/40 px-3 py-1.5 text-sm text-muted-foreground hover:bg-accent transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring w-56 lg:w-72"
        aria-label="Search workspace"
      >
        <Search className="h-4 w-4" />
        <span className="flex-1 text-left">Search…</span>
        <kbd className="pointer-events-none hidden lg:inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px]">⌘K</kbd>
      </button>
      <Button variant="ghost" size="icon" className="md:hidden h-9 w-9" aria-label="Search" onClick={() => setOpen(true)}>
        <Search className="h-4 w-4" />
      </Button>
      <CommandDialog open={open} onOpenChange={setOpen} title="Search workspace" description="Find projects, tasks, and teammates">
        <CommandInput placeholder="Search projects, tasks, members…" value={query} onValueChange={setQuery} />
        <CommandList className="min-h-72">
          {debounced.length < 2 && <CommandEmpty>Type at least 2 characters to search.</CommandEmpty>}
          {debounced.length >= 2 && isFetching && !hasResults && <CommandEmpty>Searching…</CommandEmpty>}
          {debounced.length >= 2 && !isFetching && !hasResults && <CommandEmpty>No results found in this workspace.</CommandEmpty>}
          {data && data.projects.length > 0 && (
            <CommandGroup heading="Projects">
              {data.projects.map((p) => (
                <CommandItem key={p.id} value={`project-${p.id}`} onSelect={() => { setOpen(false); setQuery(''); openProject(p.id) }}>
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="flex-1">{p.name}</span>
                  <span className="text-xs text-muted-foreground">{p.taskCount} tasks</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {data && data.tasks.length > 0 && (
            <CommandGroup heading="Tasks">
              {data.tasks.map((t) => (
                <CommandItem key={t.id} value={`task-${t.id}`} onSelect={() => { setOpen(false); setQuery(''); openTaskDialog(t.id) }}>
                  <CheckSquare className="h-4 w-4 text-muted-foreground" />
                  <span className="flex-1 truncate">{t.title}</span>
                  <span className="text-xs text-muted-foreground truncate max-w-32">{t.projectName}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
          {data && data.members.length > 0 && (
            <CommandGroup heading="Members">
              {data.members.map((m) => (
                <CommandItem key={m.id} value={`member-${m.id}`} onSelect={() => { setOpen(false); setQuery(''); navigate('team') }}>
                  <UserAvatar name={m.name} color={m.avatarColor} size="xs" />
                  <span className="flex-1">{m.name}</span>
                  <span className="text-xs text-muted-foreground">{m.email}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          )}
        </CommandList>
      </CommandDialog>
    </>
  )
}

function NotificationsPopover() {
  const qc = useQueryClient()
  const { session, openProject, openTaskDialog, navigate } = useAppStore()
  const [open, setOpen] = React.useState(false)
  const { data } = useQuery({
    queryKey: qk.notifications,
    queryFn: () => api.get<{ notifications: NotificationDTO[]; unread: number }>('/api/notifications'),
    refetchInterval: 30_000,
  })
  const unread = data?.unread ?? 0
  const list = data?.notifications ?? []

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}`),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  })
  const markAll = useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  })

  const onItemClick = (n: NotificationDTO) => {
    if (!n.read) markRead.mutate(n.id)
    setOpen(false)
    if (!session?.currentWorkspaceId) return
    if (n.resourceType === 'TASK' && n.resourceId) openTaskDialog(n.resourceId)
    else if (n.resourceType === 'PROJECT' && n.resourceId) openProject(n.resourceId)
    else if (n.type === 'INVITATION') navigate('team')
    else if (n.type === 'BILLING') navigate('settings', { settingsTab: 'billing' })
    else navigate('inbox')
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-9 w-9" aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`}>
          <Bell className="h-4 w-4" />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold text-white" aria-hidden>
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[380px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2">
          <h4 className="text-sm font-semibold">Notifications</h4>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => markAll.mutate()} disabled={unread === 0}>
            Mark all read
          </Button>
        </div>
        <ScrollArea className="h-[380px]">
          {list.length === 0 ? (
            <div className="flex flex-col items-center py-10 text-center px-6">
              <Inbox className="h-8 w-8 text-muted-foreground mb-2" />
              <p className="text-sm font-medium">Your inbox is clear</p>
              <p className="text-xs text-muted-foreground mt-1">Assignments, mentions, and updates will appear here.</p>
            </div>
          ) : (
            <div className="divide-y">
              {list.map((n) => (
                <button
                  key={n.id}
                  onClick={() => onItemClick(n)}
                  className={cn('flex w-full items-start gap-3 px-3 py-2.5 text-left hover:bg-accent/60 transition-colors', !n.read && 'bg-primary/[0.04]')}
                >
                  <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', n.read ? 'bg-transparent' : 'bg-primary')} aria-hidden />
                  <span className="flex-1 min-w-0">
                    <span className="block text-sm font-medium leading-snug">{n.title}</span>
                    {n.body && <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</span>}
                    <span className="block text-[11px] text-muted-foreground/80 mt-1">{formatRelativeTime(n.createdAt)}{n.workspaceName ? ` · ${n.workspaceName}` : ''}</span>
                  </span>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}

function CreateMenu({ wsId }: { wsId: string }) {
  const { navigate } = useAppStore()
  const { data: wsDetail } = useQuery({
    queryKey: qk.workspace(wsId),
    queryFn: () => api.get<WorkspaceDetail>(`/api/workspaces/${wsId}`),
  })
  const role = wsDetail?.myRole
  const canCreateProject = can(role, 'project.create')
  const canInvite = can(role, 'member.invite')
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="h-9 gap-1.5">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Create</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem disabled={!canCreateProject} onClick={() => navigate('projects')} className="gap-2">
          <FolderKanban className="h-4 w-4" /> New project
          {!canCreateProject && <span className="ml-auto text-[10px] text-muted-foreground">No access</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => navigate('my-tasks')} className="gap-2">
          <CheckSquare className="h-4 w-4" /> New task
        </DropdownMenuItem>
        <DropdownMenuItem disabled={!canInvite} onClick={() => navigate('team')} className="gap-2">
          <Users className="h-4 w-4" /> Invite member
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function Header() {
  const { view, sidebarOpen, setSidebarOpen, session, currentWorkspace } = useAppStore()
  const wsId = session?.currentWorkspaceId
  const ws = currentWorkspace()
  const crumbs: { label: string; onClick?: () => void }[] = []
  if (ws) crumbs.push({ label: ws.name })
  const navLabels: Record<string, string> = {
    dashboard: 'Overview', inbox: 'Inbox', 'my-tasks': 'My Tasks', projects: 'Projects',
    project: 'Project', calendar: 'Calendar', team: 'Team', reports: 'Reports', settings: 'Settings',
  }
  if (view.name !== 'dashboard') crumbs.push({ label: navLabels[view.name] ?? '' })
  if (view.name === 'project') crumbs.push({ label: 'Board' })
  if (view.name === 'settings' && view.settingsTab) crumbs.push({ label: view.settingsTab.charAt(0).toUpperCase() + view.settingsTab.slice(1) })

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80 px-3 sm:px-4">
      <Button variant="ghost" size="icon" className="lg:hidden h-9 w-9" onClick={() => setSidebarOpen(true)} aria-label="Open navigation">
        <PanelLeft className="h-4 w-4" />
      </Button>
      <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-1.5 text-sm min-w-0">
        {crumbs.map((c, i) => (
          <React.Fragment key={i}>
            {i > 0 && <span className="text-muted-foreground/50">/</span>}
            <span className={cn('truncate', i === crumbs.length - 1 ? 'font-medium' : 'text-muted-foreground')}>{c.label}</span>
          </React.Fragment>
        ))}
      </nav>
      <div className="flex-1" />
      {wsId && <SearchBox wsId={wsId} />}
      {wsId && <CreateMenu wsId={wsId} />}
      <NotificationsPopover />
    </header>
  )
}

// ===========================================================================
// Shell
// ===========================================================================

export default function AppShell({ children }: { children: React.ReactNode }) {
  const { session, sidebarOpen, setSidebarOpen } = useAppStore()
  if (!session) return null
  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-60 shrink-0 flex-col border-r bg-sidebar">
        <SidebarNavContent />
      </aside>
      {/* Mobile drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0" aria-describedby={undefined}>
          <SheetTitle className="sr-only">Navigation</SheetTitle>
          <SidebarNavContent />
        </SheetContent>
      </Sheet>
      <div className="flex flex-1 flex-col min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto w-full max-w-7xl px-3 sm:px-6 py-4 sm:py-6 pb-16">{children}</div>
        </main>
      </div>
    </div>
  )
}

// Re-export for task dialog global mount
export { }
