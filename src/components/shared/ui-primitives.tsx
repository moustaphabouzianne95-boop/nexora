'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import type { Priority, TaskStatus, ProjectStatus, Role } from '@/types'
import { PRIORITY_LABEL, PRIORITY_COLOR, TASK_STATUS_LABEL, TASK_STATUS_COLOR, PROJECT_STATUS_LABEL, PROJECT_STATUS_COLOR, ROLE_LABEL } from '@/lib/constants'

// ------------------------------------------------------------------ Avatar
export function UserAvatar({
  name,
  color,
  size = 'md',
  className,
}: {
  name: string
  color: string
  size?: 'xs' | 'sm' | 'md' | 'lg'
  className?: string
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
  const sizeCls = { xs: 'h-5 w-5 text-[9px]', sm: 'h-7 w-7 text-[10px]', md: 'h-9 w-9 text-xs', lg: 'h-12 w-12 text-sm' }[size]
  return (
    <Avatar className={cn(sizeCls, className)}>
      <AvatarFallback
        style={{ backgroundColor: `${color}22`, color }}
        className="font-semibold border"
      >
        {initials}
      </AvatarFallback>
    </Avatar>
  )
}

export function AvatarStack({
  people,
  max = 4,
  size = 'sm',
}: {
  people: { name: string; avatarColor: string }[]
  max?: number
  size?: 'xs' | 'sm' | 'md'
}) {
  const shown = people.slice(0, max)
  const rest = people.length - shown.length
  return (
    <div className="flex items-center -space-x-1.5">
      {shown.map((p, i) => (
        <UserAvatar key={i} name={p.name} color={p.avatarColor} size={size} className="ring-2 ring-background" />
      ))}
      {rest > 0 && (
        <span className="inline-flex items-center justify-center h-7 w-7 rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-2 ring-background">
          +{rest}
        </span>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ badges
export function PriorityBadge({ priority, className }: { priority: Priority; className?: string }) {
  return (
    <Badge variant="outline" className={cn('gap-1.5 font-medium', className)} style={{ borderColor: `${PRIORITY_COLOR[priority]}55`, color: PRIORITY_COLOR[priority] }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: PRIORITY_COLOR[priority] }} aria-hidden />
      {PRIORITY_LABEL[priority]}
    </Badge>
  )
}

export function StatusBadge({ status, className }: { status: TaskStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', className)} style={{ borderColor: `${TASK_STATUS_COLOR[status]}55`, color: TASK_STATUS_COLOR[status], backgroundColor: `${TASK_STATUS_COLOR[status]}14` }}>
      {TASK_STATUS_LABEL[status]}
    </Badge>
  )
}

export function ProjectStatusBadge({ status, className }: { status: ProjectStatus; className?: string }) {
  return (
    <Badge variant="outline" className={cn('font-medium', className)} style={{ borderColor: `${PROJECT_STATUS_COLOR[status]}55`, color: PROJECT_STATUS_COLOR[status], backgroundColor: `${PROJECT_STATUS_COLOR[status]}14` }}>
      {PROJECT_STATUS_LABEL[status]}
    </Badge>
  )
}

export function RoleBadge({ role, className }: { role: Role; className?: string }) {
  const tone = role === 'OWNER' ? 'default' : 'secondary'
  return (
    <Badge variant={tone} className={cn('text-[11px]', className)}>
      {ROLE_LABEL[role]}
    </Badge>
  )
}

export function LabelChip({ label, className }: { label: { name: string; color: string }; className?: string }) {
  return (
    <span
      className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium border', className)}
      style={{ color: label.color, borderColor: `${label.color}55`, backgroundColor: `${label.color}14` }}
    >
      <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: label.color }} aria-hidden />
      {label.name}
    </span>
  )
}

// ------------------------------------------------------------------ helpers
export function DateChip({ date, className }: { date: string | Date; className?: string }) {
  const d = typeof date === 'string' ? new Date(date) : date
  const today = new Date()
  const isOverdueDate = d.getTime() < today.getTime() && d.toDateString() !== today.toDateString()
  return (
    <span className={cn('inline-flex items-center gap-1 text-xs', isOverdueDate ? 'text-destructive font-medium' : 'text-muted-foreground', className)}>
      {d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
    </span>
  )
}

export function isOverdue(date: string | Date | null | undefined): boolean {
  if (!date) return false
  const d = typeof date === 'string' ? new Date(date) : date
  return d.getTime() < new Date().setHours(0, 0, 0, 0)
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center py-14 px-6 rounded-xl border border-dashed', className)}>
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Icon className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="text-sm text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-14 px-6">
      <div className="h-12 w-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
        <span className="text-destructive text-xl">!</span>
      </div>
      <h3 className="text-sm font-semibold">Something went wrong</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="mt-4 text-sm font-medium text-primary hover:underline">
          Try again
        </button>
      )}
    </div>
  )
}

// ------------------------------------------------------------------ skeletons
export function StatCardSkeleton() {
  return (
    <div className="rounded-xl border p-4 space-y-3">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-8 w-16" />
    </div>
  )
}

export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="rounded-xl border p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Skeleton className="h-3 w-3 rounded-full" />
            <Skeleton className="h-4 w-32" />
          </div>
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-2/3" />
          <div className="flex items-center justify-between pt-2">
            <Skeleton className="h-6 w-20" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function TableSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="border-b bg-muted/40 px-4 py-3">
        <Skeleton className="h-4 w-40" />
      </div>
      <div className="divide-y">
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 px-4 py-3">
            <Skeleton className="h-8 w-8 rounded-full" />
            <Skeleton className="h-4 flex-1 max-w-xs" />
            <Skeleton className="h-5 w-16 hidden sm:block" />
            <Skeleton className="h-5 w-20 hidden md:block" />
            <Skeleton className="h-4 w-12" />
          </div>
        ))}
      </div>
    </div>
  )
}

export function ChartSkeleton({ height = 260 }: { height?: number }) {
  return (
    <div className="rounded-xl border p-4 space-y-4">
      <Skeleton className="h-4 w-32" />
      <div className="flex items-end gap-2" style={{ height }}>
        {Array.from({ length: 12 }).map((_, i) => (
          <Skeleton key={i} className="flex-1" style={{ height: `${25 + ((i * 37) % 70)}%` }} />
        ))}
      </div>
    </div>
  )
}

export function BoardSkeleton() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {Array.from({ length: 4 }).map((_, c) => (
        <div key={c} className="w-72 shrink-0 space-y-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 2 + (c % 2) }).map((_, r) => (
            <div key={r} className="rounded-xl border p-3 space-y-2">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-3 w-2/3" />
              <div className="flex justify-between pt-1">
                <Skeleton className="h-5 w-14" />
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}

// --------------------------------------------------------------- progress
export function ProgressBar({ value, className, color }: { value: number; className?: string; color?: string }) {
  return (
    <div className={cn('h-1.5 w-full rounded-full bg-muted overflow-hidden', className)} role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, Math.max(0, value))}%`, backgroundColor: color ?? 'var(--primary)' }} />
    </div>
  )
}

export function formatRelativeTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  const diff = Date.now() - date.getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function formatDateTime(input: string | Date): string {
  const date = typeof input === 'string' ? new Date(input) : input
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}
