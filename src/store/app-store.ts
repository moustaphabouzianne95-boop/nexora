'use client'

import { create } from 'zustand'
import type { SessionUser, WorkspaceSummary } from '@/types'

// ---------------------------------------------------------------- view model
export type ViewName =
  | 'landing'
  | 'auth'
  | 'onboarding'
  | 'dashboard'
  | 'inbox'
  | 'my-tasks'
  | 'projects'
  | 'project'
  | 'calendar'
  | 'team'
  | 'reports'
  | 'settings'

export interface ViewState {
  name: ViewName
  authMode?: 'login' | 'register' | 'forgot' | 'reset'
  projectId?: string
  settingsTab?: 'profile' | 'workspace' | 'members' | 'billing'
  resetToken?: string
}

interface AppState {
  session: SessionUser | null
  sessionLoading: boolean
  sessionError: string | null
  view: ViewState
  sidebarOpen: boolean
  taskDialogTaskId: string | null
  setSession: (s: SessionUser | null) => void
  setSessionLoading: (b: boolean) => void
  setSessionError: (e: string | null) => void
  navigate: (view: ViewName, extra?: Partial<ViewState>) => void
  openProject: (projectId: string) => void
  setSidebarOpen: (open: boolean) => void
  openTaskDialog: (taskId: string | null) => void
  currentWorkspace: () => WorkspaceSummary | null
}

export const useAppStore = create<AppState>((set, get) => ({
  session: null,
  sessionLoading: true,
  sessionError: null,
  view: { name: 'landing' },
  sidebarOpen: false,
  taskDialogTaskId: null,
  setSession: (session) => {
    set({ session })
    // Derive initial view from session state
    const cur = get().view
    if (!session) {
      set({ view: { name: 'landing' } })
    } else if (session.workspaces.length === 0) {
      set({ view: { name: 'onboarding' } })
    } else if (cur.name === 'landing' || cur.name === 'auth') {
      set({ view: { name: 'dashboard' } })
    }
  },
  setSessionLoading: (sessionLoading) => set({ sessionLoading }),
  setSessionError: (sessionError) => set({ sessionError }),
  navigate: (name, extra) => {
    set({ view: { name, ...extra }, sidebarOpen: false, taskDialogTaskId: null })
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 })
  },
  openProject: (projectId) => set({ view: { name: 'project', projectId }, sidebarOpen: false, taskDialogTaskId: null }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  openTaskDialog: (taskDialogTaskId) => set({ taskDialogTaskId }),
  currentWorkspace: () => {
    const s = get().session
    if (!s || !s.currentWorkspaceId) return null
    return s.workspaces.find((w) => w.id === s.currentWorkspaceId) ?? null
  },
}))
