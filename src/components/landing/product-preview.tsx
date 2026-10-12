'use client'

import {
  LayoutDashboard,
  CheckSquare,
  FolderKanban,
  Calendar,
  Users,
  Settings,
  Plus,
  Search,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { PROJECT_COLORS, TASK_STATUS_COLOR } from '@/lib/constants'

/**
 * Hand-built product preview: a stylized NEXORA workspace inside a browser
 * chrome frame. Pure CSS/JSX (no images) so it stays crisp in light & dark.
 */

const NAV = [
  { icon: LayoutDashboard, label: 'Overview', active: true },
  { icon: CheckSquare, label: 'My Tasks', active: false },
  { icon: FolderKanban, label: 'Projects', active: false },
  { icon: Calendar, label: 'Calendar', active: false },
  { icon: Users, label: 'Team', active: false },
  { icon: Settings, label: 'Settings', active: false },
]

const COLUMNS = [
  { label: 'To Do', color: TASK_STATUS_COLOR.TODO, cards: [0, 1] },
  { label: 'In Progress', color: TASK_STATUS_COLOR.IN_PROGRESS, cards: [2, 3, 4] },
  { label: 'Done', color: TASK_STATUS_COLOR.DONE, cards: [5] },
]

const CARDS = [
  { title: 'Design system audit', chip: 'Design', chipColor: PROJECT_COLORS[1], progress: null, avatar: 0 },
  { title: 'API rate limiting', chip: 'Backend', chipColor: PROJECT_COLORS[6], progress: null, avatar: 1 },
  { title: 'Onboarding flow v2', chip: 'Frontend', chipColor: PROJECT_COLORS[2], progress: 64, avatar: 2 },
  { title: 'Billing webhook retries', chip: 'Backend', chipColor: PROJECT_COLORS[6], progress: 38, avatar: 3 },
  { title: 'Mobile nav polish', chip: 'Design', chipColor: PROJECT_COLORS[1], progress: null, avatar: 4 },
  { title: 'Q3 launch checklist', chip: 'Planning', chipColor: PROJECT_COLORS[4], progress: null, avatar: 0 },
]

const AVATAR_COLORS = [PROJECT_COLORS[0], PROJECT_COLORS[2], PROJECT_COLORS[5], PROJECT_COLORS[6], PROJECT_COLORS[7]]

function PreviewCard({ card }: { card: (typeof CARDS)[number] }) {
  return (
    <div className="rounded-md border bg-background p-2 shadow-xs">
      <p className="truncate text-[11px] font-medium leading-snug">{card.title}</p>
      <div className="mt-1.5 flex items-center justify-between gap-1.5">
        <span
          className="inline-flex items-center gap-1 truncate rounded-full px-1.5 py-0.5 text-[9px] font-medium"
          style={{ color: card.chipColor, backgroundColor: `${card.chipColor}18` }}
        >
          <span className="h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: card.chipColor }} aria-hidden />
          {card.chip}
        </span>
        <span
          className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[8px] font-bold text-background"
          style={{ backgroundColor: AVATAR_COLORS[card.avatar] }}
          aria-hidden
        >
          A
        </span>
      </div>
      {card.progress !== null && (
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted" aria-hidden>
          <div className="h-full rounded-full" style={{ width: `${card.progress}%`, backgroundColor: card.chipColor }} />
        </div>
      )}
    </div>
  )
}

export function ProductPreview({ className }: { className?: string }) {
  return (
    <div className={cn('relative', className)}>
      {/* glow */}
      <div
        aria-hidden
        className="absolute -inset-x-8 -top-10 bottom-8 rounded-full bg-primary/10 blur-3xl dark:bg-primary/15"
      />

      <div className="relative rounded-xl border bg-card shadow-xl shadow-foreground/5">
        {/* browser chrome */}
        <div className="flex items-center gap-2 border-b bg-muted/40 px-4 py-2.5">
          <div className="flex gap-1.5" aria-hidden>
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/25" />
          </div>
          <span className="mx-auto flex h-6 w-48 max-w-[55%] items-center justify-center gap-1.5 rounded-md border bg-background text-[11px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-chart-2" aria-hidden />
            nexora.app
          </span>
          <div className="w-10" aria-hidden />
        </div>

        {/* app mock */}
        <div className="flex h-[320px] overflow-hidden sm:h-[400px]" aria-hidden>
          {/* sidebar */}
          <div className="hidden w-44 shrink-0 flex-col border-r bg-sidebar p-2.5 sm:flex">
            <div className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-[11px] font-bold text-primary-foreground">
                N
              </span>
              <span className="truncate text-xs font-semibold">NEXORA HQ</span>
            </div>
            <div className="mt-2 space-y-0.5">
              {NAV.map((item) => (
                <div
                  key={item.label}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2 py-1.5 text-xs font-medium',
                    item.active ? 'bg-accent text-accent-foreground' : 'text-muted-foreground'
                  )}
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0" />
                  {item.label}
                </div>
              ))}
            </div>
            <div className="mt-auto rounded-lg border bg-background p-2">
              <div className="flex items-center gap-1.5 text-[10px] font-medium text-muted-foreground">
                <TrendingUp className="h-3 w-3" />
                Velocity up 12%
              </div>
              <div className="mt-1.5 flex h-6 items-end gap-1">
                {[35, 55, 40, 70, 60, 90].map((h, i) => (
                  <span key={i} className="flex-1 rounded-sm bg-primary/70" style={{ height: `${h}%` }} />
                ))}
              </div>
            </div>
          </div>

          {/* main */}
          <div className="flex min-w-0 flex-1 flex-col bg-muted/30">
            <div className="flex items-center gap-2 border-b bg-background px-3 py-2">
              <span className="truncate text-sm font-semibold">Website Redesign</span>
              <span className="hidden rounded-full border px-2 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">
                24 tasks
              </span>
              <div className="flex-1" />
              <div className="hidden items-center gap-1.5 rounded-md border bg-muted/50 px-2 py-1 text-[10px] text-muted-foreground md:flex">
                <Search className="h-3 w-3" /> Search
              </div>
              <div className="flex -space-x-1" aria-hidden>
                {AVATAR_COLORS.slice(0, 3).map((c, i) => (
                  <span
                    key={i}
                    className="h-5 w-5 rounded-full border-2 border-card text-[8px] font-bold leading-[18px] text-background"
                    style={{ backgroundColor: c }}
                  >
                    A
                  </span>
                ))}
              </div>
              <span className="flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-[10px] font-semibold text-primary-foreground">
                <Plus className="h-3 w-3" /> New
              </span>
            </div>

            <div className="grid flex-1 grid-cols-3 gap-2 overflow-hidden p-2 sm:gap-3 sm:p-3">
              {COLUMNS.map((col) => (
                <div key={col.label} className="flex min-w-0 flex-col gap-2 rounded-lg border bg-card p-2">
                  <div className="flex items-center gap-1.5">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full" style={{ backgroundColor: col.color }} />
                    <span className="truncate text-[11px] font-semibold">{col.label}</span>
                    <span className="ml-auto rounded-full bg-muted px-1.5 text-[9px] font-medium text-muted-foreground">
                      {col.cards.length}
                    </span>
                  </div>
                  <div className="space-y-2">
                    {col.cards.map((idx) => (
                      <PreviewCard key={idx} card={CARDS[idx]} />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
