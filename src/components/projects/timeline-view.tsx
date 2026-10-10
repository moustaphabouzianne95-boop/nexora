'use client'

/**
 * Project Timeline tab — horizontal task bars grouped by assignee, positioned
 * between startDate||createdAt and dueDate within the visible range. Supports
 * month and week scale with a today marker. Bars open the TaskDialog.
 */

import * as React from 'react'
import { useAppStore } from '@/store/app-store'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { TASK_STATUS_COLOR, TASK_STATUS_LABEL } from '@/lib/constants'
import type { TaskDTO } from '@/types'
import { Button } from '@/components/ui/button'
import { UserAvatar } from '@/components/shared/ui-primitives'
import { addDays, addMonths, monthLabel, startOfMonth, startOfWeek } from '@/components/projects/project-shared'
import { cn } from '@/lib/utils'

type Scale = 'month' | 'week'

export function TimelineTab({ tasks }: { tasks: TaskDTO[] }) {
  const openTaskDialog = useAppStore((s) => s.openTaskDialog)
  const [scale, setScale] = React.useState<Scale>('month')
  const [anchor, setAnchor] = React.useState<Date>(() => new Date())

  const range = React.useMemo(() => {
    if (scale === 'month') {
      const start = startOfMonth(anchor)
      const end = addMonths(start, 1)
      return { start, end, days: Math.round((end.getTime() - start.getTime()) / 86_400_000) }
    }
    const start = startOfWeek(anchor)
    const end = addDays(start, 7)
    return { start, end, days: 7 }
  }, [scale, anchor])

  const today = new Date()
  const todayPct =
    today >= range.start && today < range.end
      ? ((today.getTime() - range.start.getTime()) / (range.end.getTime() - range.start.getTime())) * 100
      : null

  // Tasks overlapping the range
  const bars = React.useMemo(() => {
    return tasks
      .map((t) => {
        const startRaw = t.startDate ? new Date(t.startDate) : new Date(t.createdAt)
        const endRaw = t.dueDate ? new Date(t.dueDate) : addDays(startRaw, 1)
        if (Number.isNaN(startRaw.getTime())) return null
        const start = startRaw < range.start ? range.start : startRaw
        const end = endRaw > range.end ? range.end : endRaw
        if (endRaw <= range.start || startRaw >= range.end) return null
        const leftPct = ((start.getTime() - range.start.getTime()) / (range.end.getTime() - range.start.getTime())) * 100
        const widthPct = Math.max(((end.getTime() - start.getTime()) / (range.end.getTime() - range.start.getTime())) * 100, 1.5)
        return { task: t, leftPct: Math.min(leftPct, 99), widthPct: Math.min(widthPct, 100 - Math.min(leftPct, 99)) }
      })
      .filter((b): b is { task: TaskDTO; leftPct: number; widthPct: number } => b !== null)
  }, [tasks, range])

  const groups = React.useMemo(() => {
    const map = new Map<string, { key: string; name: string; color: string; bars: typeof bars }>()
    for (const bar of bars) {
      const key = bar.task.assignee?.id ?? 'unassigned'
      const entry = map.get(key) ?? {
        key,
        name: bar.task.assignee?.name ?? 'Unassigned',
        color: bar.task.assignee?.avatarColor ?? '#8b949e',
        bars: [],
      }
      entry.bars.push(bar)
      map.set(key, entry)
    }
    return [...map.values()].sort((a, b) => (a.key === 'unassigned' ? 1 : b.key === 'unassigned' ? -1 : a.name.localeCompare(b.name)))
  }, [bars])

  // Tick marks (weekly for month scale, daily for week scale)
  const ticks = React.useMemo(() => {
    const out: { pct: number; label: string | null; strong: boolean }[] = []
    if (scale === 'month') {
      for (let d = 0; d < range.days; d += 7) {
        const day = addDays(range.start, d)
        out.push({
          pct: (d / range.days) * 100,
          label: day.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          strong: true,
        })
      }
    } else {
      for (let d = 0; d < range.days; d++) {
        const day = addDays(range.start, d)
        out.push({
          pct: (d / range.days) * 100,
          label: d % 2 === 0 ? day.toLocaleDateString('en-US', { weekday: 'short' }) : null,
          strong: false,
        })
      }
    }
    return out
  }, [scale, range])

  const shift = (dir: number) => {
    setAnchor((a) => (scale === 'month' ? addMonths(a, dir) : addDays(a, dir * 7)))
  }

  const rangeLabel =
    scale === 'month'
      ? monthLabel(range.start)
      : `${range.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${addDays(range.end, -1).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="min-w-[150px] text-sm font-semibold">{rangeLabel}</h3>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(-1)} aria-label="Previous period">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="min-h-8"
            onClick={() => {
              setAnchor(new Date())
            }}
          >
            Today
          </Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => shift(1)} aria-label="Next period">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
          <div className="flex items-center rounded-lg border p-0.5" role="group" aria-label="Timeline scale">
            {(['month', 'week'] as Scale[]).map((s) => (
              <button
                key={s}
                onClick={() => setScale(s)}
                aria-pressed={scale === s}
                className={cn(
                  'min-h-7 rounded-md px-2.5 text-xs font-medium capitalize outline-none focus-visible:ring-2 focus-visible:ring-ring',
                  scale === s ? 'bg-accent text-accent-foreground' : 'text-muted-foreground hover:bg-accent/60'
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border">
        <div className="min-w-[640px] p-3">
          {/* Tick ruler */}
          <div className="relative ml-[136px] mb-1 h-5">
            {ticks.map((t, i) => (
              <div key={i} className="absolute top-0 h-full" style={{ left: `${t.pct}%` }}>
                <div className={cn('h-full w-px', t.strong ? 'bg-border' : 'bg-border/50')} aria-hidden />
                {t.label && <span className="absolute left-1 top-0 text-[10px] text-muted-foreground">{t.label}</span>}
              </div>
            ))}
          </div>

          {groups.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">No tasks fall within this {scale}.</p>
          ) : (
            <div className="space-y-1">
              {groups.map((g) => (
                <div key={g.key} className="flex items-center gap-2 rounded-lg py-1 hover:bg-muted/40">
                  <div className="flex w-[128px] shrink-0 items-center gap-1.5">
                    <UserAvatar name={g.name} color={g.color} size="xs" />
                    <span className="truncate text-xs font-medium">{g.name}</span>
                    <span className="text-[10px] text-muted-foreground">{g.bars.length}</span>
                  </div>
                  <div className="relative h-7 flex-1 rounded-md bg-muted/40">
                    {ticks.map((t, i) => (
                      <div key={i} className={cn('absolute top-0 h-full w-px', t.strong ? 'bg-border/70' : 'bg-border/40')} style={{ left: `${t.pct}%` }} aria-hidden />
                    ))}
                    {todayPct !== null && (
                      <div className="absolute top-0 z-10 h-full w-0.5 bg-red-500/70" style={{ left: `${todayPct}%` }} aria-label="Today" />
                    )}
                    {g.bars.map((b) => (
                      <button
                        key={b.task.id}
                        onClick={() => openTaskDialog(b.task.id)}
                        title={`${b.task.title} · ${TASK_STATUS_LABEL[b.task.status]}`}
                        aria-label={`${b.task.title} (${TASK_STATUS_LABEL[b.task.status]})`}
                        className={cn(
                          'absolute top-1 h-5 overflow-hidden rounded-full border text-left text-[10px] leading-[18px] outline-none focus-visible:ring-2 focus-visible:ring-ring',
                          b.task.status === 'CANCELLED' && 'line-through opacity-60'
                        )}
                        style={{
                          left: `${b.leftPct}%`,
                          width: `${b.widthPct}%`,
                          backgroundColor: `${TASK_STATUS_COLOR[b.task.status]}26`,
                          borderColor: `${TASK_STATUS_COLOR[b.task.status]}66`,
                          color: TASK_STATUS_COLOR[b.task.status],
                        }}
                      >
                        <span className="block truncate px-1.5 font-medium text-foreground/90">{b.task.title}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {todayPct !== null && groups.length > 0 && (
            <p className="mt-2 text-right text-[10px] text-muted-foreground">
              <span className="mr-1 inline-block h-2 w-0.5 bg-red-500 align-middle" aria-hidden /> today ·{' '}
              {today.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
