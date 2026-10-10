'use client'

/**
 * Shared helpers for the Projects / ProjectDetail views and the TaskDialog.
 * Owns: session-derived context hooks, entitlements, plan-gate UI, icon mapping,
 * date helpers, task-related cache invalidation and mutation error toasts.
 */

import * as React from 'react'
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { DEFAULT_ENTITLEMENTS, PLANS, formatPrice } from '@/lib/constants'
import type { PlanEntitlements, PublicUser, Role, SessionUser, SubscriptionDTO, TaskDTO } from '@/types'
import {
  BarChart3, BookOpen, Folder, Globe, LayoutDashboard, Lock, Map, Palette,
  Rocket, Server, Shield, Smartphone, Zap,
} from 'lucide-react'

// ------------------------------------------------------------------ icons

export const PROJECT_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  folder: Folder,
  palette: Palette,
  smartphone: Smartphone,
  server: Server,
  rocket: Rocket,
  map: Map,
  'layout-dashboard': LayoutDashboard,
  'bar-chart': BarChart3,
  'book-open': BookOpen,
  globe: Globe,
  shield: Shield,
  zap: Zap,
}

export function ProjectIcon({ icon, className }: { icon: string; className?: string }) {
  const Icon = PROJECT_ICON_MAP[icon] ?? Folder
  return <Icon className={className} />
}

// ------------------------------------------------------------------ session context

export interface WorkspaceSession {
  session: SessionUser | null
  wsId: string | null
  role: Role | null
  me: PublicUser | null
}

export function useWorkspaceSession(): WorkspaceSession {
  const session = useAppStore((s) => s.session)
  const wsId = session?.currentWorkspaceId ?? null
  const role = wsId ? session?.workspaces.find((w) => w.id === wsId)?.role ?? null : null
  return { session, wsId, role, me: session?.user ?? null }
}

// ------------------------------------------------------------------ plan / entitlements

export function useSubscription(wsId: string | null) {
  return useQuery({
    queryKey: qk.subscription(wsId ?? 'none'),
    queryFn: () => api.get<SubscriptionDTO>(`/api/workspaces/${wsId}/subscription`),
    enabled: !!wsId,
    staleTime: 60_000,
    retry: false,
  })
}

export function useEntitlements(wsId: string | null): PlanEntitlements {
  const { data } = useSubscription(wsId)
  return data?.entitlements ?? DEFAULT_ENTITLEMENTS
}

/** Toast with an "Upgrade" action that navigates to billing settings. */
export function useUpgradeToast() {
  const navigate = useAppStore((s) => s.navigate)
  return React.useCallback(
    (feature?: string) => {
      toast.error(feature ? `${feature} requires a higher plan` : 'Not available on your plan', {
        description: 'Upgrade the workspace plan to unlock this feature.',
        action: { label: 'Upgrade', onClick: () => navigate('settings', { settingsTab: 'billing' }) },
      })
    },
    [navigate]
  )
}

/** Map any mutation error to the right toast (402 → upgrade toast). */
export function useMutationErrorHandler() {
  const upgrade = useUpgradeToast()
  return React.useCallback(
    (e: unknown, feature?: string, fallback = 'Something went wrong') => {
      if (e instanceof ApiError && e.status === 402) {
        upgrade(feature)
        return
      }
      if (e instanceof ApiError) {
        toast.error(e.message || fallback)
        return
      }
      toast.error(fallback)
    },
    [upgrade]
  )
}

// ------------------------------------------------------------------ locked feature UI

export function UpgradeGate({ feature, entitlementKey }: { feature: string; entitlementKey: keyof PlanEntitlements }) {
  const navigate = useAppStore((s) => s.navigate)
  const pro = PLANS.find((p) => p.id === 'PRO')
  const included = PLANS.filter((p) => p.id !== 'FREE' && p.limits[entitlementKey]).map((p) => p.name)
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 px-6 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/15 mb-4">
        <Lock className="h-5 w-5 text-amber-600 dark:text-amber-400" aria-hidden />
      </div>
      <h3 className="text-sm font-semibold">{feature} is a plan feature</h3>
      <p className="mt-1 max-w-sm text-sm text-muted-foreground">
        Your current plan doesn&apos;t include the {feature.toLowerCase()}. Upgrade to {included.join(' or ')} to unlock it — from{' '}
        {pro ? formatPrice(pro.monthlyPriceCents) : '$10/mo'}.
      </p>
      <button
        onClick={() => navigate('settings', { settingsTab: 'billing' })}
        className="mt-4 inline-flex min-h-9 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Upgrade plan
      </button>
    </div>
  )
}

// ------------------------------------------------------------------ cache helpers

export interface TaskDetailEnvelope {
  task: TaskDTO
  comments: unknown[]
  attachments: unknown[]
  subtasks: TaskDTO[]
  dependencies: { blockedBy: TaskDTO[]; blocks: TaskDTO[] }
  activity: unknown[]
}

/** Invalidate every query affected by a task mutation. */
export function invalidateAfterTaskChange(qc: QueryClient, taskId: string | null | undefined, wsId: string | null) {
  if (taskId) qc.invalidateQueries({ queryKey: qk.task(taskId) })
  qc.invalidateQueries({ queryKey: ['project-tasks'] })
  if (wsId) {
    qc.invalidateQueries({ queryKey: qk.dashboard(wsId) })
    qc.invalidateQueries({ queryKey: qk.myTasks(wsId) })
    qc.invalidateQueries({ queryKey: qk.activity(wsId) })
  }
}

// ------------------------------------------------------------------ date helpers

export function dateInputValue(iso: string | null | undefined): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const m = `${d.getMonth() + 1}`.padStart(2, '0')
  const day = `${d.getDate()}`.padStart(2, '0')
  return `${d.getFullYear()}-${m}-${day}`
}

/** Convert a yyyy-mm-dd input value to an ISO datetime string (noon UTC-safe local). */
export function isoFromDateInput(value: string): string | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 12, 0, 0).toISOString()
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '—'
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

export function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

export function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1)
}

export function startOfWeek(d: Date): Date {
  const out = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  out.setDate(out.getDate() - out.getDay())
  return out
}

export function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setDate(out.getDate() + n)
  return out
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function monthLabel(d: Date): string {
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}
