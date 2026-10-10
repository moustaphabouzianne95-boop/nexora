'use client'

import * as React from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api, qk } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import type { SessionUser } from '@/types'
import { Loader2 } from 'lucide-react'

import AppShell from '@/components/app/app-shell'
import { Providers } from '@/components/app/providers'
import LandingView from '@/components/landing/LandingView'
import AuthView from '@/components/auth/AuthView'
import OnboardingView from '@/components/onboarding/OnboardingView'
import DashboardView from '@/components/dashboard/DashboardView'
import InboxView from '@/components/inbox/InboxView'
import MyTasksView from '@/components/my-tasks/MyTasksView'
import ProjectsView from '@/components/projects/ProjectsView'
import ProjectDetailView from '@/components/projects/ProjectDetailView'
import CalendarView from '@/components/calendar/CalendarView'
import TeamView from '@/components/team/TeamView'
import ReportsView from '@/components/reports/ReportsView'
import SettingsView from '@/components/settings/SettingsView'
import TaskDialog from '@/components/tasks/TaskDialog'

export default function Page() {
  return (
    <Providers>
      <SessionGate>
        <ViewRouter />
      </SessionGate>
    </Providers>
  )
}

/**
 * Bootstraps the session once and decides between public and app surfaces.
 */
function SessionGate({ children }: { children: React.ReactNode }) {
  const { session, sessionLoading, setSession, setSessionLoading } = useAppStore()
  const qc = useQueryClient()

  const { isLoading } = useQuery({
    queryKey: qk.session,
    queryFn: async () => {
      try {
        const data = await api.get<SessionUser>('/api/auth/me')
        setSession(data)
        return data
      } catch {
        setSession(null)
        return null
      } finally {
        setSessionLoading(false)
      }
    },
    staleTime: Infinity,
    retry: false,
  })

  React.useEffect(() => {
    if (!isLoading) setSessionLoading(false)
  }, [isLoading, setSessionLoading])

  React.useEffect(() => {
    // keep store in sync when query cache updates (login/logout flows)
    const unsub = qc.getQueryCache().subscribe((event) => {
      if (event.query.queryKey.join() === qk.session.join() && event.query.state.data !== undefined) {
        const data = event.query.state.data as SessionUser | null
        if (data !== useAppStore.getState().session) setSession(data)
      }
    })
    return unsub
  }, [qc, setSession])

  if (sessionLoading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background" role="status" aria-label="Loading NEXORA">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-black text-xl">N</div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading workspace…
          </div>
        </div>
      </div>
    )
  }

  if (!session) {
    return (
      <>
        <PublicSurface />
      </>
    )
  }

  return (
    <AppShell>
      {children}
      {session.currentWorkspaceId && <TaskDialog />}
    </AppShell>
  )
}

function PublicSurface() {
  const { view } = useAppStore()
  if (view.name === 'auth') return <AuthView />
  return <LandingView />
}

function ViewRouter() {
  const { view, session } = useAppStore()
  if (!session) return null

  // No workspace yet → onboarding
  if (session.workspaces.length === 0) {
    return <OnboardingView />
  }

  // Onboarding still reachable explicitly
  if (view.name === 'onboarding') return <OnboardingView />

  switch (view.name) {
    case 'auth':
      return <DashboardView />
    case 'landing':
      return <DashboardView />
    case 'dashboard':
      return <DashboardView />
    case 'inbox':
      return <InboxView />
    case 'my-tasks':
      return <MyTasksView />
    case 'projects':
      return <ProjectsView />
    case 'project':
      return view.projectId ? <ProjectDetailView key={view.projectId} /> : <ProjectsView />
    case 'calendar':
      return <CalendarView />
    case 'team':
      return <TeamView />
    case 'reports':
      return <ReportsView />
    case 'settings':
      return <SettingsView />
    default:
      return <DashboardView />
  }
}
