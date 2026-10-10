'use client'

/**
 * Project Calendar tab — custom month grid of tasks by due date with
 * milestone diamonds. Tasks open the global TaskDialog when clicked.
 */

import * as React from 'react'
import { useAppStore } from '@/store/app-store'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { PRIORITY_COLOR } from '@/lib/constants'
import type { MilestoneDTO, TaskDTO } from '@/types'
import { Button } from '@/components/ui/button'
import { addMonths, isSameDay, monthLabel, startOfMonth } from '@/components/projects/project-shared'
import { cn } from '@/lib/utils'

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function groupByDay(tasks: TaskDTO[], year: number, monthIdx: number): Map<number, TaskDTO[]> {
  const result: [number, TaskDTO[]][] = []
  for (const t of tasks) {
    if (!t.dueDate) continue
    const d = new Date(t.dueDate)
    if (d.getFullYear() !== year || d.getMonth() !== monthIdx) continue
    const day = d.getDate()
    const existing = result.find(([k]) => k === day)
    if (existing) existing[1].push(t)
    else result.push([day, [t]])
  }
  return new Map(result)
}

function groupMilestonesByDay(milestones: MilestoneDTO[], year: number, monthIdx: number): Map<number, MilestoneDTO[]> {
  const result: [number, MilestoneDTO[]][] = []
  for (const m of milestones) {
    if (!m.dueDate) continue
    const d = new Date(m.dueDate)
    if (d.getFullYear() !== year || d.getMonth() !== monthIdx) continue
    const day = d.getDate()
    const existing = result.find(([k]) => k === day)
    if (existing) existing[1].push(m)
    else result.push([day, [m]])
  }
  return new Map(result)
}

export function CalendarTab({ tasks, milestones }: { tasks: TaskDTO[]; milestones: MilestoneDTO[] }) {
  const openTaskDialog = useAppStore((s) => s.openTaskDialog)
  const [month, setMonth] = React.useState<Date>(() => startOfMonth(new Date()))

  const year = month.getFullYear()
  const monthIdx = month.getMonth()
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate()
  const firstWeekday = new Date(year, monthIdx, 1).getDay()
  const today = new Date()

  // Tasks & milestones grouped by day of month (plain helpers — compiler-friendly)
  const tasksByDay = groupByDay(tasks, year, monthIdx)
  const milestonesByDay = groupMilestonesByDay(milestones, year, monthIdx)

  const cells: (number | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  while (cells.length % 7 !== 0) cells.push(null)

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-sm font-semibold min-w-[140px]">{monthLabel(month)}</h3>
        <div className="ml-auto flex items-center gap-1.5">
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth((m) => addMonths(m, -1))} aria-label="Previous month">
            <ChevronLeft className="h-4 w-4" aria-hidden />
          </Button>
          <Button variant="outline" size="sm" className="min-h-8" onClick={() => setMonth(startOfMonth(new Date()))}>Today</Button>
          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setMonth((m) => addMonths(m, 1))} aria-label="Next month">
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          <div className="grid grid-cols-7 gap-px rounded-t-xl border border-b-0 bg-border" role="row">
            {WEEKDAYS.map((d) => (
              <div key={d} className="bg-background px-2 py-1.5 text-center text-[11px] font-medium text-muted-foreground">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px rounded-b-xl border bg-border" role="grid" aria-label={`Tasks calendar for ${monthLabel(month)}`}>
            {cells.map((day, i) => {
              const dayTasks = day ? tasksByDay.get(day) ?? [] : []
              const dayMilestones = day ? milestonesByDay.get(day) ?? [] : []
              const isToday = day !== null && isSameDay(new Date(year, monthIdx, day), today)
              return (
                <div
                  key={i}
                  role="gridcell"
                  aria-label={day ? `${monthLabel(month)} ${day}` : undefined}
                  className={cn(
                    'min-h-[88px] bg-background p-1.5 sm:min-h-[104px]',
                    day === null && 'bg-muted/30',
                    isToday && 'bg-primary/5 ring-1 ring-inset ring-primary/50'
                  )}
                >
                  {day !== null && (
                    <>
                      <div className="mb-1 flex items-center justify-between">
                        <span className={cn('text-xs font-medium', isToday ? 'text-primary' : 'text-muted-foreground')}>
                          {day}
                        </span>
                        {dayMilestones.length > 0 && (
                          <span className="flex items-center gap-0.5" title={dayMilestones.map((m) => m.name).join(', ')}>
                            {dayMilestones.slice(0, 3).map((m) => (
                              <span
                                key={m.id}
                                className="inline-block h-2 w-2 rotate-45 rounded-[2px] bg-violet-500 dark:bg-violet-400"
                                aria-label={`Milestone: ${m.name}`}
                                title={m.status === 'COMPLETED' ? `✓ ${m.name}` : m.name}
                                style={{ opacity: m.status === 'COMPLETED' ? 0.45 : 1 }}
                              />
                            ))}
                          </span>
                        )}
                      </div>
                      <div className="space-y-1">
                        {dayTasks.slice(0, 3).map((t) => (
                          <button
                            key={t.id}
                            onClick={() => openTaskDialog(t.id)}
                            className="flex w-full items-center gap-1 rounded border border-border/70 bg-muted/50 px-1.5 py-0.5 text-left text-[11px] leading-tight outline-none hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
                            title={t.title}
                          >
                            <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: PRIORITY_COLOR[t.priority] }} aria-hidden />
                            <span className="truncate">{t.title}</span>
                          </button>
                        ))}
                        {dayTasks.length > 3 && (
                          <span className="block text-[10px] text-muted-foreground">+{dayTasks.length - 3} more</span>
                        )}
                      </div>
                    </>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
