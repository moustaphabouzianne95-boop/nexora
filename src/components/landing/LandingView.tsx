'use client'

import * as React from 'react'
import { useReducedMotion } from 'framer-motion'
import { toast } from 'sonner'
import {
  Sparkles,
  Columns3,
  Users,
  BarChart3,
  ShieldCheck,
  FolderKanban,
  CalendarDays,
  Check,
  AtSign,
  MessageSquare,
  UserPlus,
  Menu,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { APP_TAGLINE, PLANS, formatPrice } from '@/lib/constants'
import type { BillingInterval } from '@/types'
import { useAppStore } from '@/store/app-store'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { ProgressBar } from '@/components/shared/ui-primitives'
import { BrandLogo } from './brand'
import { Reveal } from './reveal'
import { ProductPreview } from './product-preview'

const NAV_LINKS = [
  { id: 'features', label: 'Features' },
  { id: 'workflow', label: 'Workflow' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'pricing', label: 'Pricing' },
  { id: 'faq', label: 'FAQ' },
]

const TRUST_ITEMS = [
  { icon: Columns3, title: 'Kanban boards', text: 'Visualize work from backlog to done' },
  { icon: Users, title: 'Real-time collaboration', text: 'Comment, mention, and decide together' },
  { icon: BarChart3, title: 'Powerful analytics', text: 'Velocity, workload, and delivery insights' },
  { icon: ShieldCheck, title: 'Granular permissions', text: 'Five roles from Owner to Viewer' },
]

const FEATURES = [
  {
    icon: FolderKanban,
    title: 'Projects',
    text: 'Create projects with owners, priorities, dates, and live progress at a glance.',
  },
  {
    icon: Columns3,
    title: 'Kanban boards',
    text: 'Move work across stages with drag-and-drop — plus a keyboard-friendly list view.',
  },
  {
    icon: CalendarDays,
    title: 'Calendar & timeline',
    text: 'Plan sprints and spot due dates, milestones, and conflicts before they bite.',
  },
  {
    icon: Users,
    title: 'Team collaboration',
    text: 'Mentions, comments, and email invitations keep everyone in the loop.',
  },
  {
    icon: BarChart3,
    title: 'Analytics & reporting',
    text: 'Track created vs. completed work, completion rates, and workload by member.',
  },
  {
    icon: ShieldCheck,
    title: 'Roles & permissions',
    text: 'Owner, Admin, PM, Member, and Viewer roles — enforced on every request.',
  },
]

const WORKFLOW_POINTS = [
  'Projects with priorities, dates, and live progress',
  'Tasks with subtasks, labels, and dependencies',
  'Milestones to mark the moments that matter',
  'Activity logs for full team accountability',
]

const COLLAB_ITEMS = [
  {
    icon: AtSign,
    title: 'Mentions',
    text: 'Pull the right person into any task with @mentions and instant notifications.',
    mock: 'mention' as const,
  },
  {
    icon: MessageSquare,
    title: 'Comments',
    text: 'Discuss decisions in context — every task has its own conversation thread.',
    mock: 'comment' as const,
  },
  {
    icon: UserPlus,
    title: 'Invitations',
    text: 'Invite teammates by email with the right role and expiring invite links.',
    mock: 'invite' as const,
  },
]

const ANALYTICS_CHIPS = [
  'Completion & on-time rates',
  'Workload by member',
  'Created vs. completed trends',
  'Project progress rollups',
]

const FAQS = [
  {
    q: 'How does the Free plan work?',
    a: 'Free gives you one workspace with up to 3 active members and 3 active projects, list and Kanban board views, and basic analytics. No credit card required — upgrade only when you need more room.',
  },
  {
    q: 'What are the member and project limits?',
    a: 'Free includes 3 members and 3 active projects. Pro raises that to 15 members and 25 active projects, and Business to 50 members and 100 active projects — plus calendar, timeline, attachments, and advanced analytics.',
  },
  {
    q: 'Is my data isolated from other teams?',
    a: 'Yes. NEXORA is multi-tenant with strict workspace isolation: every API request is scoped to your membership and role, so other workspaces can never see your projects, tasks, or files.',
  },
  {
    q: 'Can I change or cancel my plan anytime?',
    a: 'Absolutely. Upgrade, downgrade, or cancel from Settings → Billing at any time. Downgrades keep your data — plan limits are enforced read-only if you exceed them, so nothing is deleted.',
  },
  {
    q: 'Is there a demo account I can try?',
    a: 'Yes — sign in with owner@nexora.dev and the password Demo1234! to explore a fully seeded workspace with projects, tasks, and analytics. Admin, PM, Member, and Viewer demo accounts are available too.',
  },
  {
    q: 'How do invitations work?',
    a: 'Owners and admins invite teammates by email from the Team page. Invitations expire after 7 days and can be revoked or resent at any time from the same place.',
  },
]

const CHART_GROUPS = [
  [30, 18], [45, 32], [38, 30], [62, 48], [52, 44], [70, 61], [58, 55],
]

export default function LandingView() {
  const navigate = useAppStore((s) => s.navigate)
  const reduceMotion = useReducedMotion()
  const [mobileOpen, setMobileOpen] = React.useState(false)
  const [billingInterval, setBillingInterval] = React.useState<BillingInterval>('monthly')
  const [legal, setLegal] = React.useState<'terms' | 'privacy' | null>(null)

  const scrollTo = React.useCallback(
    (id: string) => {
      setMobileOpen(false)
      const el = document.getElementById(id)
      if (!el) return
      el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'start' })
    },
    [reduceMotion]
  )

  const goAuth = React.useCallback(
    (mode: 'login' | 'register') => navigate('auth', { authMode: mode }),
    [navigate]
  )

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      <Navbar onNavigate={scrollTo} onAuth={goAuth} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />

      <main className="flex-1">
        {/* ============================================================ Hero */}
        <section className="relative overflow-hidden border-b">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 -top-40 h-96 bg-gradient-to-b from-primary/10 to-transparent"
          />
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-10 h-72 w-72 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
          />
          <div className="relative mx-auto max-w-6xl px-4 pb-16 pt-16 text-center sm:px-6 sm:pb-20 sm:pt-24">
            <Reveal>
              <Badge variant="outline" className="mx-auto gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium">
                <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
                Project management for modern teams
              </Badge>
            </Reveal>
            <Reveal delay={0.05}>
              <h1 className="mx-auto mt-6 max-w-3xl text-balance text-4xl font-extrabold tracking-tight sm:text-6xl">
                Turn ambitious plans into exceptional results.
              </h1>
            </Reveal>
            <Reveal delay={0.1}>
              <p className="mx-auto mt-5 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
                Plan projects, organize your team, track progress, and deliver better work with one powerful workspace.
              </p>
            </Reveal>
            <Reveal delay={0.15}>
              <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" className="h-11 w-full px-6 text-base sm:w-auto" onClick={() => goAuth('register')}>
                  Start for free
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-11 w-full px-6 text-base sm:w-auto"
                  onClick={() => scrollTo('features')}
                >
                  Explore the platform
                </Button>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                Free plan available &middot; No credit card required
              </p>
            </Reveal>
          </div>
        </section>

        {/* ================================================== Product preview */}
        <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-20" aria-label="Product preview">
          <Reveal>
            <ProductPreview />
          </Reveal>
        </section>

        {/* ================================================ Trusted workflows */}
        <section className="border-y bg-muted/30" aria-label="Trusted workflows">
          <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-10 sm:grid-cols-2 sm:px-6 lg:grid-cols-4">
            {TRUST_ITEMS.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.05}>
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border bg-background">
                    <item.icon className="h-5 w-5 text-primary" aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold">{item.title}</p>
                    <p className="mt-0.5 text-sm text-muted-foreground">{item.text}</p>
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </section>

        {/* ========================================================= Features */}
        <SectionShell id="features" eyebrow="Features" title="Everything your team needs to ship" >
          <p className="mx-auto mt-4 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            One workspace for planning, tracking, and collaborating — without stitching five tools together.
          </p>
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={(i % 3) * 0.06}>
                <div className="group h-full rounded-xl border bg-card p-5 transition-colors hover:border-primary/40">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <f.icon className="h-5 w-5 text-primary" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{f.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </SectionShell>

        {/* ================================================== Workflow section */}
        <section id="workflow" className="scroll-mt-20 border-t bg-muted/30" aria-label="Workflow">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
            <Reveal>
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Workflow</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                From idea to shipped, without the chaos
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Break ambitious initiatives into clear projects and tasks. Assign owners, set due dates,
                and watch progress update itself as work moves across the board.
              </p>
              <ul className="mt-6 space-y-3">
                {WORKFLOW_POINTS.map((point) => (
                  <li key={point} className="flex items-start gap-2.5 text-sm">
                    <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                    <span>{point}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="mt-8 h-11 px-5" onClick={() => goAuth('register')}>
                Get started free
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Reveal>
            <Reveal delay={0.1}>
              <WorkflowMock />
            </Reveal>
          </div>
        </section>

        {/* ==================================================== Collaboration */}
        <SectionShell eyebrow="Collaboration" title="Built for the way teams actually talk">
          <p className="mx-auto mt-4 max-w-2xl text-balance text-base text-muted-foreground sm:text-lg">
            Context lives where the work happens — no more digging through chat history.
          </p>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {COLLAB_ITEMS.map((item, i) => (
              <Reveal key={item.title} delay={i * 0.06}>
                <div className="h-full rounded-xl border bg-card p-5">
                  <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <item.icon className="h-5 w-5 text-primary" aria-hidden />
                  </span>
                  <h3 className="mt-4 text-base font-semibold">{item.title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{item.text}</p>
                  <div className="mt-4 rounded-lg border bg-background p-3">
                    <CollabMock kind={item.mock} />
                  </div>
                </div>
              </Reveal>
            ))}
          </div>
        </SectionShell>

        {/* ========================================================= Analytics */}
        <section id="analytics" className="scroll-mt-20 border-t" aria-label="Analytics">
          <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-2">
            <Reveal className="order-2 lg:order-1">
              <AnalyticsMock />
            </Reveal>
            <Reveal className="order-1 lg:order-2">
              <p className="text-xs font-semibold uppercase tracking-widest text-primary">Analytics</p>
              <h2 className="mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
                Know exactly where work stands
              </h2>
              <p className="mt-4 text-base leading-relaxed text-muted-foreground">
                Real-time dashboards turn raw activity into answers: what shipped, what stalled,
                and who needs a hand — before deadlines slip.
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {ANALYTICS_CHIPS.map((chip) => (
                  <span
                    key={chip}
                    className="rounded-full border bg-muted/50 px-3 py-1.5 text-xs font-medium"
                  >
                    {chip}
                  </span>
                ))}
              </div>
              <Button variant="outline" className="mt-8 h-11 px-5" onClick={() => goAuth('register')}>
                Explore analytics
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Button>
            </Reveal>
          </div>
        </section>

        {/* =========================================================== Pricing */}
        <section id="pricing" className="scroll-mt-20 border-t bg-muted/30" aria-label="Pricing">
          <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
            <Reveal>
              <p className="text-center text-xs font-semibold uppercase tracking-widest text-primary">Pricing</p>
              <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">
                Simple pricing that scales with you
              </h2>
              <p className="mx-auto mt-4 max-w-2xl text-center text-base text-muted-foreground">
                Start free and upgrade when your team grows. Every plan includes unlimited tasks.
              </p>
              <div className="mt-8 flex justify-center">
                <div
                  role="group"
                  aria-label="Billing interval"
                  className="inline-flex items-center rounded-lg border bg-background p-1"
                >
                  <button
                    type="button"
                    aria-pressed={billingInterval === 'monthly'}
                    onClick={() => setBillingInterval('monthly')}
                    className={cn(
                      'min-h-9 rounded-md px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      billingInterval === 'monthly'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Monthly
                  </button>
                  <button
                    type="button"
                    aria-pressed={billingInterval === 'annual'}
                    onClick={() => setBillingInterval('annual')}
                    className={cn(
                      'min-h-9 rounded-md px-4 text-sm font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring',
                      billingInterval === 'annual'
                        ? 'bg-primary text-primary-foreground'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    Annual
                    <span
                      className={cn(
                        'ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
                        billingInterval === 'annual' ? 'bg-primary-foreground/20' : 'bg-primary/10 text-primary'
                      )}
                    >
                      Save 20%
                    </span>
                  </button>
                </div>
              </div>
            </Reveal>

            <div className="mt-12 grid gap-6 lg:grid-cols-3">
              {PLANS.map((plan, i) => {
                const cents = billingInterval === 'annual' ? plan.annualPriceCents : plan.monthlyPriceCents
                return (
                  <Reveal key={plan.id} delay={i * 0.07}>
                    <div
                      className={cn(
                        'relative flex h-full flex-col rounded-2xl border bg-card p-6',
                        plan.highlighted && 'border-primary shadow-lg shadow-primary/10 ring-1 ring-primary'
                      )}
                    >
                      {plan.highlighted && (
                        <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full px-3">
                          Most popular
                        </Badge>
                      )}
                      <h3 className="text-lg font-semibold">{plan.name}</h3>
                      <p className="mt-1 min-h-10 text-sm text-muted-foreground">{plan.description}</p>
                      <div className="mt-5 flex items-baseline gap-2">
                        <span className="text-4xl font-extrabold tracking-tight">
                          {formatPrice(cents, billingInterval)}
                        </span>
                        {cents > 0 && billingInterval === 'annual' && (
                          <span className="text-xs font-medium text-chart-2">2 months free</span>
                        )}
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {cents === 0
                          ? 'Free forever'
                          : billingInterval === 'annual'
                            ? 'Per workspace, billed annually'
                            : 'Per workspace, billed monthly'}
                      </p>
                      <ul className="mt-6 flex-1 space-y-2.5">
                        {plan.features.map((feature) => (
                          <li key={feature} className="flex items-start gap-2 text-sm">
                            <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                            <span className="text-muted-foreground">{feature}</span>
                          </li>
                        ))}
                      </ul>
                      <Button
                        className="mt-6 h-11 w-full"
                        variant={plan.highlighted ? 'default' : 'outline'}
                        onClick={() => goAuth('register')}
                      >
                        {plan.id === 'FREE' ? 'Start for free' : `Get started with ${plan.name}`}
                      </Button>
                    </div>
                  </Reveal>
                )
              })}
            </div>
            <p className="mt-8 text-center text-xs text-muted-foreground">
              Prices in USD. Cancel anytime — plan limits are enforced read-only, never destructive.
            </p>
          </div>
        </section>

        {/* =============================================================== FAQ */}
        <section id="faq" className="scroll-mt-20" aria-label="Frequently asked questions">
          <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 sm:py-24">
            <Reveal>
              <p className="text-center text-xs font-semibold uppercase tracking-widest text-primary">FAQ</p>
              <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">
                Frequently asked questions
              </h2>
            </Reveal>
            <Reveal delay={0.08}>
              <Accordion type="single" collapsible className="mt-10">
                {FAQS.map((faq, i) => (
                  <AccordionItem key={faq.q} value={`faq-${i}`}>
                    <AccordionTrigger className="text-left text-sm sm:text-base">{faq.q}</AccordionTrigger>
                    <AccordionContent className="text-sm leading-relaxed text-muted-foreground">
                      {faq.a}
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </Reveal>
          </div>
        </section>

        {/* ========================================================= Final CTA */}
        <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-24" aria-label="Get started">
          <Reveal>
            <div className="relative overflow-hidden rounded-2xl border bg-card px-6 py-14 text-center sm:px-12">
              <div
                aria-hidden
                className="pointer-events-none absolute -top-24 left-1/2 h-64 w-[32rem] -translate-x-1/2 rounded-full bg-primary/10 blur-3xl"
              />
              <h2 className="relative text-3xl font-bold tracking-tight sm:text-4xl">
                Ready to deliver better work?
              </h2>
              <p className="relative mx-auto mt-3 max-w-xl text-base text-muted-foreground">
                Create your workspace in under a minute — free, and fully featured from day one.
              </p>
              <div className="relative mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
                <Button size="lg" className="h-11 w-full px-6 sm:w-auto" onClick={() => goAuth('register')}>
                  Start for free
                  <ArrowRight className="h-4 w-4" aria-hidden />
                </Button>
                <Button
                  size="lg"
                  variant="ghost"
                  className="h-11 w-full px-6 sm:w-auto"
                  onClick={() => goAuth('login')}
                >
                  Sign in
                </Button>
              </div>
            </div>
          </Reveal>
        </section>
      </main>

      {/* ============================================================= Footer */}
      <footer className="mt-auto border-t bg-muted/30" aria-label="Footer">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
          <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <BrandLogo />
              <p className="mt-3 max-w-xs text-sm text-muted-foreground">{APP_TAGLINE}</p>
              <p className="mt-4 inline-flex items-center gap-2 rounded-md border bg-background px-2.5 py-1.5 font-mono text-[11px] text-muted-foreground">
                Demo: owner@nexora.dev / Demo1234!
              </p>
            </div>
            <FooterColumn title="Product">
              {NAV_LINKS.map((link) => (
                <FooterLink key={link.id} onClick={() => scrollTo(link.id)}>
                  {link.label}
                </FooterLink>
              ))}
            </FooterColumn>
            <FooterColumn title="Company">
              <FooterLink onClick={() => toast.info('Coming soon', { description: 'The NEXORA story is on its way.' })}>
                About
              </FooterLink>
              <FooterLink onClick={() => scrollTo('faq')}>FAQ</FooterLink>
              <FooterLink onClick={() => goAuth('register')}>Get started</FooterLink>
            </FooterColumn>
            <FooterColumn title="Legal">
              <FooterLink onClick={() => setLegal('terms')}>Terms of Service</FooterLink>
              <FooterLink onClick={() => setLegal('privacy')}>Privacy Policy</FooterLink>
            </FooterColumn>
          </div>
          <Separator className="my-8" />
          <div className="flex flex-col items-center justify-between gap-3 text-xs text-muted-foreground sm:flex-row">
            <p>&copy; {new Date().getFullYear()} NEXORA. All rights reserved.</p>
            <p>Demo application — billing runs in test mode.</p>
          </div>
        </div>
      </footer>

      {/* Legal dialog */}
      <Dialog open={legal !== null} onOpenChange={(open) => !open && setLegal(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{legal === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</DialogTitle>
            <DialogDescription>
              {legal === 'terms'
                ? 'The short version of the agreement for using NEXORA.'
                : 'How NEXORA handles your data.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 text-sm leading-relaxed text-muted-foreground">
            {legal === 'terms' ? (
              <>
                <p>
                  NEXORA is provided as a demonstration application. Your workspace and its contents
                  belong to you and the members you invite; plan limits apply per workspace.
                </p>
                <p>
                  Billing runs in test mode — no payment provider is contacted and no real charges are
                  made. Subscriptions, invoices, and plan changes are simulated for evaluation purposes.
                </p>
                <p>
                  Abuse, disruption of other workspaces, or attempts to bypass role and plan
                  enforcement are grounds for account suspension.
                </p>
              </>
            ) : (
              <>
                <p>
                  We collect only what the product needs: your name, email, and the content you create
                  in your workspaces. Session cookies keep you signed in — nothing else is tracked.
                </p>
                <p>
                  Workspace data is strictly isolated between tenants and visible only to members of
                  that workspace, enforced server-side on every request.
                </p>
                <p>
                  Deleting a workspace cascades its projects, tasks, and comments. You can sign out
                  and clear your session at any time.
                </p>
              </>
            )}
            <p className="text-xs">This is placeholder text for the demo build.</p>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ===========================================================================
// Navbar
// ===========================================================================

function Navbar({
  onNavigate,
  onAuth,
  mobileOpen,
  setMobileOpen,
}: {
  onNavigate: (id: string) => void
  onAuth: (mode: 'login' | 'register') => void
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}) {
  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <button
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'auto' })}
          aria-label="NEXORA — back to top"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo />
        </button>

        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV_LINKS.map((link) => (
            <button
              key={link.id}
              type="button"
              onClick={() => onNavigate(link.id)}
              className="rounded-md px-3 py-2 text-sm font-medium text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              {link.label}
            </button>
          ))}
        </nav>

        <div className="hidden items-center gap-2 md:flex">
          <Button variant="ghost" onClick={() => onAuth('login')}>
            Sign in
          </Button>
          <Button onClick={() => onAuth('register')}>Get started</Button>
        </div>

        <button
          type="button"
          className="flex h-11 w-11 items-center justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
          aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={mobileOpen}
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <Menu className="h-5 w-5" aria-hidden />
        </button>
      </div>

      {/* Mobile menu */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="right" className="w-72 p-0">
          <SheetHeader className="border-b p-4">
            <SheetTitle>
              <BrandLogo />
            </SheetTitle>
            <SheetDescription className="sr-only">Site navigation</SheetDescription>
          </SheetHeader>
          <div className="flex flex-col p-3">
            {NAV_LINKS.map((link) => (
              <button
                key={link.id}
                type="button"
                onClick={() => onNavigate(link.id)}
                className="rounded-md px-3 py-3 text-left text-sm font-medium outline-none transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring"
              >
                {link.label}
              </button>
            ))}
            <div className="mt-3 space-y-2 border-t pt-3">
              <Button variant="outline" className="h-11 w-full" onClick={() => { setMobileOpen(false); onAuth('login') }}>
                Sign in
              </Button>
              <Button className="h-11 w-full" onClick={() => { setMobileOpen(false); onAuth('register') }}>
                Get started
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>
    </header>
  )
}

// ===========================================================================
// Shared section shell
// ===========================================================================

function SectionShell({
  id,
  eyebrow,
  title,
  children,
}: {
  id?: string
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <section id={id} className={cn('scroll-mt-20', id !== 'features' && 'border-t')} aria-label={title}>
      <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <Reveal>
          <p className="text-center text-xs font-semibold uppercase tracking-widest text-primary">{eyebrow}</p>
          <h2 className="mt-3 text-center text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
        </Reveal>
        {children}
      </div>
    </section>
  )
}

// ===========================================================================
// Workflow mock (right column)
// ===========================================================================

function WorkflowMock() {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xl shadow-foreground/5" aria-hidden>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-chart-2" />
          <span className="text-sm font-semibold">Website Redesign</span>
        </div>
        <span className="rounded-full border border-chart-2/50 bg-chart-2/10 px-2 py-0.5 text-[10px] font-medium text-chart-2">
          Active
        </span>
      </div>
      <div className="mt-4">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>Progress</span>
          <span className="font-semibold text-foreground">68%</span>
        </div>
        <ProgressBar value={68} className="mt-1.5" />
      </div>
      <div className="mt-5 space-y-2.5">
        {[
          { title: 'Finalize homepage hero', dot: 'bg-chart-2', pct: '100%' },
          { title: 'Migrate case studies', dot: 'bg-primary', pct: '60%' },
          { title: 'QA responsive layouts', dot: 'bg-primary', pct: '25%' },
        ].map((row) => (
          <div key={row.title} className="flex items-center gap-3 rounded-lg border bg-background px-3 py-2.5">
            <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', row.dot)} />
            <span className="min-w-0 flex-1 truncate text-xs font-medium">{row.title}</span>
            <span className="h-1.5 w-16 shrink-0 overflow-hidden rounded-full bg-muted">
              <span className="block h-full rounded-full bg-primary/70" style={{ width: row.pct }} />
            </span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed px-3 py-2.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-chart-4" />
        Milestone — Launch day · Nov 14
      </div>
    </div>
  )
}

// ===========================================================================
// Collaboration mocks
// ===========================================================================

function CollabMock({ kind }: { kind: 'mention' | 'comment' | 'invite' }) {
  if (kind === 'mention') {
    return (
      <div className="space-y-2" aria-hidden>
        <div className="flex items-center gap-2">
          <span className="h-6 w-6 rounded-full bg-primary/15 text-center text-[9px] font-bold leading-6 text-primary">
            MK
          </span>
          <p className="min-w-0 truncate text-xs">
            <span className="font-medium text-primary">@maya</span> can you review this by Friday?
          </p>
        </div>
        <div className="ml-8 rounded-md bg-muted px-2 py-1.5 text-[10px] text-muted-foreground">
          On it — adding notes now.
        </div>
      </div>
    )
  }
  if (kind === 'comment') {
    return (
      <div className="space-y-2" aria-hidden>
        <div className="rounded-md bg-muted px-2.5 py-2 text-[11px] text-muted-foreground">
          Moved to review — the new nav is live on staging.
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="h-4 w-4 rounded-full bg-primary/15 text-center text-[8px] font-bold leading-4 text-primary">
            JR
          </span>
          Jonas · 2m ago
          <span className="ml-auto rounded-full border px-1.5 py-0.5">Reply</span>
        </div>
      </div>
    )
  }
  return (
    <div className="space-y-2" aria-hidden>
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-2.5 py-2 text-[11px]">
        <UserPlus className="h-3.5 w-3.5 text-primary" />
        <span className="min-w-0 flex-1 truncate">grace@team.dev</span>
        <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold text-primary">
          Member
        </span>
      </div>
      <p className="text-[10px] text-muted-foreground">Invite link expires in 7 days</p>
    </div>
  )
}

// ===========================================================================
// Analytics mock
// ===========================================================================

function AnalyticsMock() {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-xl shadow-foreground/5" aria-hidden>
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Throughput</p>
        <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-muted-foreground/30" /> Created
          </span>
          <span className="flex items-center gap-1">
            <span className="h-2 w-2 rounded-sm bg-primary" /> Completed
          </span>
        </div>
      </div>
      <div className="mt-6 flex h-40 items-end justify-between gap-2 sm:gap-3">
        {CHART_GROUPS.map(([created, completed], i) => (
          <div key={i} className="flex h-full flex-1 items-end justify-center gap-1">
            <span
              className="w-2.5 rounded-t-sm bg-muted-foreground/30 sm:w-3.5"
              style={{ height: `${created}%` }}
            />
            <span className="w-2.5 rounded-t-sm bg-primary sm:w-3.5" style={{ height: `${completed}%` }} />
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-between text-[10px] text-muted-foreground">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
          <span key={d} className="flex-1 text-center">{d}</span>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-2">
        <div className="rounded-lg border bg-background p-3">
          <p className="text-[10px] text-muted-foreground">Completion rate</p>
          <p className="mt-0.5 text-lg font-bold">87%</p>
        </div>
        <div className="rounded-lg border bg-background p-3">
          <p className="text-[10px] text-muted-foreground">On-time delivery</p>
          <p className="mt-0.5 text-lg font-bold">92%</p>
        </div>
      </div>
      <p className="mt-3 text-center text-[10px] text-muted-foreground">Sample data from a demo workspace</p>
    </div>
  )
}

// ===========================================================================
// Footer helpers
// ===========================================================================

function FooterColumn({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-3 space-y-2">{children}</ul>
    </div>
  )
}

function FooterLink({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        className="rounded-sm text-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {children}
      </button>
    </li>
  )
}
