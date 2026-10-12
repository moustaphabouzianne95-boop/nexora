'use client'

import * as React from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  User,
  Users,
  Rocket,
  Briefcase,
  Building2,
  Check,
  Loader2,
  LogOut,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Palette,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { slugify } from '@/lib/validation'
import {
  PROJECT_COLORS,
  WORKSPACE_TYPES,
  WORKSPACE_TYPE_LABEL,
  TEAM_SIZES,
  TEAM_SIZE_LABEL,
} from '@/lib/constants'
import type { SessionUser, WorkspaceDetail } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { ProgressBar } from '@/components/shared/ui-primitives'

const SLUG_RE = /^[a-z0-9-]+$/

const TYPE_OPTIONS: { value: string; icon: React.ComponentType<{ className?: string }>; hint: string }[] = [
  { value: 'PERSONAL', icon: User, hint: 'Just your own work' },
  { value: 'TEAM', icon: Users, hint: 'Collaborate with a group' },
  { value: 'STARTUP', icon: Rocket, hint: 'Move fast, iterate' },
  { value: 'AGENCY', icon: Briefcase, hint: 'Client work, many accounts' },
  { value: 'ENTERPRISE', icon: Building2, hint: 'Scale with structure' },
]

function computeStep1Errors(name: string, slug: string): Record<string, string> {
  const errs: Record<string, string> = {}
  const trimmedName = name.trim()
  if (trimmedName.length < 2) errs.name = 'Workspace name must be at least 2 characters'
  else if (trimmedName.length > 80) errs.name = 'Workspace name must be at most 80 characters'
  const trimmedSlug = slug.trim()
  if (trimmedSlug.length < 2 || trimmedSlug.length > 40) errs.slug = 'Slug must be 2–40 characters'
  else if (!SLUG_RE.test(trimmedSlug)) errs.slug = 'Lowercase letters, numbers and dashes only'
  else if (trimmedSlug.startsWith('-') || trimmedSlug.endsWith('-'))
    errs.slug = 'Slug cannot start or end with a dash'
  return errs
}

export default function OnboardingView() {
  const session = useAppStore((s) => s.session)
  const qc = useQueryClient()

  const [step, setStep] = React.useState<1 | 2>(1)
  const [name, setName] = React.useState('')
  const [slug, setSlug] = React.useState('')
  const [slugEdited, setSlugEdited] = React.useState(false)
  const [type, setType] = React.useState<string>('TEAM')
  const [teamSize, setTeamSize] = React.useState<string>('1_10')
  const [description, setDescription] = React.useState('')
  const [logoColor, setLogoColor] = React.useState<string>(PROJECT_COLORS[0])
  const [errors, setErrors] = React.useState<Record<string, string>>({})

  // ------------------------------------------------------------ field events
  const handleNameChange = (value: string) => {
    setName(value)
    if (!slugEdited) setSlug(slugify(value))
  }

  const handleSlugChange = (value: string) => {
    setSlug(value)
    // Follow the name until the user deliberately types a different slug.
    setSlugEdited(value !== slugify(name))
  }

  const clearError = (key: string) =>
    setErrors((prev) => {
      if (!(key in prev)) return prev
      const next = { ...prev }
      delete next[key]
      return next
    })

  // ------------------------------------------------------------ wizard logic
  const goNext = () => {
    const errs = computeStep1Errors(name, slug)
    setErrors(errs)
    if (Object.keys(errs).length === 0) setStep(2)
  }

  const createMutation = useMutation({
    mutationFn: async (): Promise<SessionUser> => {
      const res = await api.post<{ workspace: WorkspaceDetail }>('/api/workspaces', {
        name: name.trim(),
        slug: slug.trim(),
        type,
        teamSize,
        description: description.trim() ? description.trim() : undefined,
      })
      let workspace = res.workspace
      // logoColor is a PATCH-only field per the API contract — apply after create.
      if (logoColor.toLowerCase() !== workspace.logoColor.toLowerCase()) {
        try {
          workspace = await api.patch<WorkspaceDetail>(`/api/workspaces/${workspace.id}`, { logoColor })
        } catch {
          /* cosmetic only — do not block onboarding */
        }
      }
      // Refresh the session so the new workspace appears in the switcher.
      return api.get<SessionUser>('/api/auth/me')
    },
    onSuccess: (freshSession) => {
      qc.setQueryData(qk.session, freshSession)
      useAppStore.getState().setSession(freshSession)
      // setSession keeps non-landing/auth views in place — route to the dashboard explicitly.
      useAppStore.getState().navigate('dashboard')
      toast.success('Workspace created — welcome aboard!')
    },
    onError: (err) => {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setStep(1)
          setErrors({ slug: err.details?.slug ?? 'That slug is already taken — try another.' })
          toast.error(err.message)
          return
        }
        if (err.status === 422 && err.details) {
          setErrors({ ...err.details })
          if (err.details.slug || err.details.name) setStep(1)
          toast.error(err.message)
          return
        }
        toast.error(err.message)
        return
      }
      toast.error('Something went wrong while creating your workspace. Please try again.')
    },
  })

  const signOut = useMutation({
    mutationFn: () => api.post('/api/auth/logout'),
    onSuccess: () => {
      qc.setQueryData(qk.session, null)
      qc.clear()
      useAppStore.getState().setSession(null)
      toast.success('Signed out')
    },
    onError: () => toast.error('Could not sign out. Please try again.'),
  })

  if (!session) return null

  const slugLiveError =
    (slug.trim() && !SLUG_RE.test(slug.trim()) ? 'Lowercase letters, numbers and dashes only' : undefined) ??
    errors.slug
  const nameLiveError = name.trim() && name.trim().length < 2 ? 'At least 2 characters' : errors.name

  return (
    <div className="mx-auto w-full max-w-2xl">
      {/* ------------------------------------------------------------ header */}
      <div className="pt-4 text-center sm:pt-8">
        <span className="inline-flex items-center gap-1.5 rounded-full border bg-muted/50 px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" aria-hidden />
          Welcome to NEXORA, {session.user.name.split(' ')[0]}
        </span>
        <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">Let&rsquo;s set up your workspace</h1>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">
          A home for your projects, your team, and everything you&rsquo;ll deliver together. This takes
          less than a minute.
        </p>
      </div>

      {/* ---------------------------------------------------------- progress */}
      <div className="mt-8" aria-label={`Step ${step} of 2`} role="group">
        <div className="flex items-center gap-3">
          <StepDot n={1} label="Workspace" active={step === 1} done={step === 2} />
          <div className="h-px flex-1 bg-border" aria-hidden />
          <StepDot n={2} label="Personalize" active={step === 2} done={false} />
        </div>
        <ProgressBar value={step === 1 ? 50 : 100} className="mt-3" />
      </div>

      {/* -------------------------------------------------------------- card */}
      <div className="mt-4 rounded-2xl border bg-card p-5 shadow-sm sm:p-8">
        {step === 1 ? (
          <div className="space-y-6">
            {/* Workspace name */}
            <div className="space-y-1.5">
              <Label htmlFor="ws-name">Workspace name</Label>
              <Input
                id="ws-name"
                value={name}
                onChange={(e) => handleNameChange(e.target.value)}
                placeholder="Acme Inc."
                maxLength={80}
                autoComplete="organization"
                aria-invalid={nameLiveError ? true : undefined}
                aria-describedby="ws-name-hint"
                className="h-10"
              />
              <p id="ws-name-hint" className="text-xs text-muted-foreground">
                Usually your company or team name.
              </p>
              {nameLiveError && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {nameLiveError}
                </p>
              )}
            </div>

            {/* Slug */}
            <div className="space-y-1.5">
              <Label htmlFor="ws-slug">Workspace URL</Label>
              <div
                className={cn(
                  'flex items-center rounded-md border shadow-xs transition-colors focus-within:border-ring focus-within:ring-[3px] focus-within:ring-ring/50',
                  slugLiveError ? 'border-destructive' : 'border-input'
                )}
              >
                <span className="select-none pl-3 text-sm text-muted-foreground">nexora.app/</span>
                <Input
                  id="ws-slug"
                  value={slug}
                  onChange={(e) => {
                    handleSlugChange(e.target.value)
                    clearError('slug')
                  }}
                  placeholder="acme"
                  maxLength={40}
                  aria-invalid={slugLiveError ? true : undefined}
                  className="h-10 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent"
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Auto-generated from the name — editable. Lowercase letters, numbers, and dashes.
              </p>
              {slugLiveError && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {slugLiveError}
                </p>
              )}
            </div>

            {/* Workspace type */}
            <div className="space-y-2">
              <Label>Workspace type</Label>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Workspace type">
                {WORKSPACE_TYPES.map((wt) => {
                  const option = TYPE_OPTIONS.find((o) => o.value === wt)
                  const Icon = option?.icon ?? Users
                  const selected = type === wt
                  return (
                    <button
                      key={wt}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => {
                        setType(wt)
                        clearError('type')
                      }}
                      className={cn(
                        'flex min-h-11 flex-col items-start gap-1 rounded-lg border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring',
                        selected
                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                          : 'hover:border-foreground/25 hover:bg-accent/50'
                      )}
                    >
                      <span className="flex items-center gap-1.5 text-sm font-semibold">
                        <Icon className="h-4 w-4 text-primary" aria-hidden />
                        {WORKSPACE_TYPE_LABEL[wt]}
                      </span>
                      <span className="text-[11px] leading-tight text-muted-foreground">{option?.hint}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Team size */}
            <div className="space-y-2">
              <Label>Team size</Label>
              <RadioGroup
                value={teamSize}
                onValueChange={(v) => {
                  setTeamSize(v)
                  clearError('teamSize')
                }}
                className="grid grid-cols-2 gap-2 sm:grid-cols-3"
              >
                {TEAM_SIZES.map((ts) => (
                  <Label
                    key={ts}
                    htmlFor={`ts-${ts}`}
                    className={cn(
                      'flex min-h-11 cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors',
                      teamSize === ts
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'hover:bg-accent/50'
                    )}
                  >
                    <RadioGroupItem value={ts} id={`ts-${ts}`} />
                    {TEAM_SIZE_LABEL[ts]}
                  </Label>
                ))}
              </RadioGroup>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Live preview */}
            <div className="flex items-center gap-3 rounded-xl border bg-muted/40 p-3">
              <span
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-base font-bold text-white"
                style={{ backgroundColor: logoColor }}
                aria-hidden
              >
                {(name.trim()[0] ?? 'N').toUpperCase()}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{name.trim() || 'Your workspace'}</p>
                <p className="truncate text-xs text-muted-foreground">
                  nexora.app/{slug.trim() || 'your-team'} · {WORKSPACE_TYPE_LABEL[type]} ·{' '}
                  {TEAM_SIZE_LABEL[teamSize]}
                </p>
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label htmlFor="ws-description">
                <span className="inline-flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5" aria-hidden />
                  What will this workspace be used for? <span className="text-muted-foreground">(optional)</span>
                </span>
              </Label>
              <Textarea
                id="ws-description"
                value={description}
                onChange={(e) => {
                  setDescription(e.target.value)
                  clearError('description')
                }}
                placeholder="e.g. Product roadmap, marketing campaigns, and the website relaunch."
                rows={4}
                maxLength={500}
                aria-invalid={errors.description ? true : undefined}
              />
              <p className="text-right text-[11px] text-muted-foreground">{description.length}/500</p>
              {errors.description && (
                <p role="alert" className="text-xs font-medium text-destructive">
                  {errors.description}
                </p>
              )}
            </div>

            {/* Logo color */}
            <div className="space-y-2">
              <Label>
                <span className="inline-flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" aria-hidden />
                  Workspace color
                </span>
              </Label>
              <div className="flex flex-wrap gap-2.5">
                {PROJECT_COLORS.map((color) => {
                  const selected = logoColor === color
                  return (
                    <button
                      key={color}
                      type="button"
                      aria-label={`Choose workspace color ${color}`}
                      aria-pressed={selected}
                      onClick={() => setLogoColor(color)}
                      className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full border border-black/10 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
                        selected ? 'scale-110 ring-2 ring-foreground ring-offset-2 ring-offset-background' : 'hover:scale-105'
                      )}
                      style={{ backgroundColor: color }}
                    >
                      {selected && <Check className="h-4 w-4 text-white" aria-hidden />}
                    </button>
                  )
                })}
              </div>
              <p className="text-xs text-muted-foreground">
                Used for the workspace avatar and accent moments across the app.
              </p>
            </div>
          </div>
        )}

        {/* ------------------------------------------------------------ nav */}
        <div className="mt-8 flex items-center justify-between border-t pt-5">
          {step === 2 ? (
            <Button
              variant="outline"
              className="min-h-11"
              onClick={() => setStep(1)}
              disabled={createMutation.isPending}
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Back
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Step 1 of 2</span>
          )}
          {step === 1 ? (
            <Button className="min-h-11" onClick={goNext} disabled={createMutation.isPending}>
              Continue
              <ArrowRight className="h-4 w-4" aria-hidden />
            </Button>
          ) : (
            <Button className="min-h-11" onClick={() => createMutation.mutate()} disabled={createMutation.isPending}>
              {createMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Create workspace
            </Button>
          )}
        </div>
      </div>

      {/* ------------------------------------------------------------ footer */}
      <div className="mt-6 flex flex-col items-center justify-between gap-3 pb-6 text-xs text-muted-foreground sm:flex-row">
        <p>
          Signed in as <span className="font-medium text-foreground">{session.user.email}</span>
        </p>
        <button
          type="button"
          onClick={() => signOut.mutate()}
          disabled={signOut.isPending}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-md px-2 font-medium outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 sm:min-h-0"
        >
          {signOut.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <LogOut className="h-3.5 w-3.5" aria-hidden />
          )}
          Sign out
        </button>
      </div>
    </div>
  )
}

// ===========================================================================
// Step indicator dot
// ===========================================================================

function StepDot({ n, label, active, done }: { n: number; label: string; active: boolean; done: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span
        aria-hidden
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold transition-colors',
          done
            ? 'border-primary bg-primary text-primary-foreground'
            : active
              ? 'border-primary bg-primary/10 text-primary'
              : 'border-border bg-muted text-muted-foreground'
        )}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : n}
      </span>
      <span className={cn('text-sm font-medium', active || done ? 'text-foreground' : 'text-muted-foreground')}>
        {label}
      </span>
    </div>
  )
}
