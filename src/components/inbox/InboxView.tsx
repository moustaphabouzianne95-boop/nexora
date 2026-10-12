'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Inbox as InboxIcon, Bell, UserPlus, MessageSquare, Mail, Clock, AlertTriangle,
  CreditCard, FolderKanban, CheckCheck, Check,
} from 'lucide-react'

import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { cn } from '@/lib/utils'
import type { NotificationDTO } from '@/types'
import { EmptyState, ErrorState, formatRelativeTime } from '@/components/shared/ui-primitives'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Skeleton } from '@/components/ui/skeleton'

type NotificationsResponse = { notifications: NotificationDTO[]; unread: number }

function typeIcon(type: string): React.ComponentType<{ className?: string }> {
  switch (type) {
    case 'TASK_ASSIGNED': return UserPlus
    case 'COMMENT_ADDED': return MessageSquare
    case 'INVITATION': return Mail
    case 'DUE_SOON': return Clock
    case 'OVERDUE': return AlertTriangle
    case 'BILLING': return CreditCard
    case 'PROJECT': return FolderKanban
    default: return Bell
  }
}

function RowSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-3">
      <Skeleton className="h-9 w-9 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2 py-0.5">
        <Skeleton className="h-4 w-2/3 max-w-xs" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  )
}

export default function InboxView() {
  const qc = useQueryClient()
  const openProject = useAppStore((s) => s.openProject)
  const openTaskDialog = useAppStore((s) => s.openTaskDialog)
  const navigate = useAppStore((s) => s.navigate)

  const [tab, setTab] = React.useState<'all' | 'unread'>('all')

  const { data, isPending, isError, refetch, error } = useQuery({
    queryKey: qk.notifications,
    queryFn: async () => {
      const res = await api.get<NotificationsResponse | null>('/api/notifications')
      if (!res) throw new ApiError(503, 'Notifications are unavailable right now.')
      return res
    },
    refetchInterval: 30_000,
    staleTime: 10_000,
  })

  const notifications = data?.notifications ?? []
  const unread = data?.unread ?? 0
  const filtered = tab === 'unread' ? notifications.filter((n) => !n.read) : notifications

  const markRead = useMutation({
    mutationFn: (id: string) => api.patch(`/api/notifications/${id}`),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: qk.notifications })
      const prev = qc.getQueryData<NotificationsResponse>(qk.notifications)
      if (prev) {
        const target = prev.notifications.find((n) => n.id === id)
        qc.setQueryData<NotificationsResponse>(qk.notifications, {
          notifications: prev.notifications.map((n) => (n.id === id ? { ...n, read: true } : n)),
          unread: Math.max(0, prev.unread - (target && !target.read ? 1 : 0)),
        })
      }
      return { prev }
    },
    onError: (e, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.notifications, ctx.prev)
      toast.error(e instanceof ApiError ? e.message : 'Failed to mark notification as read')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  })

  const markAllRead = useMutation({
    mutationFn: () => api.post('/api/notifications/read-all'),
    onMutate: async () => {
      await qc.cancelQueries({ queryKey: qk.notifications })
      const prev = qc.getQueryData<NotificationsResponse>(qk.notifications)
      if (prev) {
        qc.setQueryData<NotificationsResponse>(qk.notifications, {
          notifications: prev.notifications.map((n) => ({ ...n, read: true })),
          unread: 0,
        })
      }
      return { prev }
    },
    onSuccess: () => toast.success('All notifications marked as read'),
    onError: (e, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(qk.notifications, ctx.prev)
      toast.error(e instanceof ApiError ? e.message : 'Failed to mark all as read')
    },
    onSettled: () => qc.invalidateQueries({ queryKey: qk.notifications }),
  })

  const openNotification = (n: NotificationDTO) => {
    if (!n.read) markRead.mutate(n.id)
    if (n.resourceType === 'TASK' && n.resourceId) {
      openTaskDialog(n.resourceId)
    } else if (n.resourceType === 'PROJECT' && n.resourceId) {
      openProject(n.resourceId)
    } else if (n.type === 'INVITATION') {
      navigate('team')
    } else if (n.type === 'BILLING') {
      navigate('settings', { settingsTab: 'billing' })
    }
    // otherwise: staying in inbox is the correct action
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Inbox</h1>
          {unread > 0 && (
            <Badge aria-label={`${unread} unread notifications`} className="rounded-full">
              {unread > 99 ? '99+' : unread}
            </Badge>
          )}
        </div>
        <Button
          variant="outline"
          size="sm"
          className="min-h-[36px] gap-1.5"
          onClick={() => markAllRead.mutate()}
          disabled={unread === 0 || markAllRead.isPending}
          aria-label="Mark all notifications as read"
        >
          <CheckCheck className="h-4 w-4" />
          Mark all read
        </Button>
      </div>

      {/* Filter tabs */}
      <Tabs value={tab} onValueChange={(v) => setTab(v as 'all' | 'unread')}>
        <TabsList aria-label="Filter notifications">
          <TabsTrigger value="all" className="min-h-[34px] px-3">
            All
            <span className="text-xs text-muted-foreground tabular-nums">{notifications.length}</span>
          </TabsTrigger>
          <TabsTrigger value="unread" className="min-h-[34px] px-3">
            Unread
            {unread > 0 && <span className="text-xs font-semibold text-primary tabular-nums">{unread}</span>}
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Content */}
      {isError && !data ? (
        <ErrorState
          message={error instanceof ApiError ? error.message : 'Failed to load notifications.'}
          onRetry={() => refetch()}
        />
      ) : isPending ? (
        <div className="divide-y rounded-xl border bg-card">
          {Array.from({ length: 7 }).map((_, i) => <RowSkeleton key={i} />)}
        </div>
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={InboxIcon}
          title="Your inbox is clear."
          description="Assignments, mentions, deadlines, and workspace updates will appear here."
        />
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-14 px-6 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted mb-4">
            <Check className="h-6 w-6 text-muted-foreground" />
          </div>
          <h2 className="text-sm font-semibold">You&apos;re all caught up</h2>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">No unread notifications right now.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card" role="list" aria-label="Notifications">
          <ul className="max-h-96 divide-y overflow-y-auto">
            {filtered.map((n) => {
              const Icon = typeIcon(n.type)
              return (
                <li key={n.id} role="listitem">
                  <button
                    onClick={() => openNotification(n)}
                    className={cn(
                      'flex w-full min-h-[44px] items-start gap-3 px-4 py-3 text-left transition-colors outline-none focus-visible:bg-accent/60 hover:bg-accent/50',
                      !n.read && 'bg-primary/[0.045]'
                    )}
                    aria-label={`${n.read ? 'Read' : 'Unread'} notification: ${n.title}`}
                  >
                    <span className="relative shrink-0">
                      <span
                        className={cn(
                          'flex h-9 w-9 items-center justify-center rounded-full bg-muted text-muted-foreground',
                          !n.read && 'bg-primary/10 text-primary'
                        )}
                        aria-hidden
                      >
                        <Icon className="h-4 w-4" />
                      </span>
                      {!n.read && (
                        <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" aria-hidden />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className={cn('block text-sm leading-snug', n.read ? 'text-foreground' : 'font-semibold')}>
                        {n.title}
                      </span>
                      {n.body && (
                        <span className="mt-0.5 block text-xs text-muted-foreground line-clamp-2">{n.body}</span>
                      )}
                      <span className="mt-1 block text-[11px] text-muted-foreground/80">
                        {formatRelativeTime(n.createdAt)}
                        {n.workspaceName ? ` · ${n.workspaceName}` : ''}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
        </div>
      )}
    </div>
  )
}
