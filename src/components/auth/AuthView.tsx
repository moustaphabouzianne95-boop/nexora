'use client'

import * as React from 'react'
import { useForm, useWatch, type UseFormRegisterReturn } from 'react-hook-form'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import {
  Loader2,
  Eye,
  EyeOff,
  Info,
  KeyRound,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
} from 'lucide-react'
import { api, qk, ApiError } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import type { SessionUser } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RoleBadge } from '@/components/shared/ui-primitives'
import { BrandLogo } from '@/components/landing/brand'

const DEMO_PASSWORD = 'Demo1234!'

const DEMO_ACCOUNTS = [
  { email: 'owner@nexora.dev', role: 'OWNER' as const },
  { email: 'admin@nexora.dev', role: 'ADMIN' as const },
  { email: 'pm@nexora.dev', role: 'PROJECT_MANAGER' as const },
  { email: 'member@nexora.dev', role: 'MEMBER' as const },
  { email: 'viewer@nexora.dev', role: 'VIEWER' as const },
]

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function passwordIssues(pw: string): string | null {
  if (pw.length < 8) return 'Password must be at least 8 characters'
  if (!/[A-Za-z]/.test(pw)) return 'Password must contain a letter'
  if (!/[0-9]/.test(pw)) return 'Password must contain a number'
  return null
}

/** Maps server errors (ApiError.details) to react-hook-form fields; returns a toast message. */
function applyServerError(
  setError: (name: string, error: { type: string; message: string }) => void,
  err: unknown
): string {
  if (err instanceof ApiError) {
    if (err.details) {
      for (const [field, message] of Object.entries(err.details)) {
        setError(field, { type: 'server', message })
      }
      if (Object.keys(err.details).length > 0) return err.message
    }
    return err.message || 'Request failed. Please try again.'
  }
  return 'Something went wrong. Please try again.'
}

// ===========================================================================
// Password input with visibility toggle
// ===========================================================================

function PasswordInput({
  id,
  registration,
  invalid,
  autoComplete,
  placeholder,
}: {
  id: string
  registration: UseFormRegisterReturn
  invalid?: boolean
  autoComplete: string
  placeholder?: string
}) {
  const [show, setShow] = React.useState(false)
  return (
    <div className="relative">
      <Input
        id={id}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete={autoComplete}
        aria-invalid={invalid || undefined}
        className="h-10 pr-10"
        {...registration}
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? 'Hide password' : 'Show password'}
        className="absolute right-1 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-sm text-muted-foreground outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
      >
        {show ? <EyeOff className="h-4 w-4" aria-hidden /> : <Eye className="h-4 w-4" aria-hidden />}
      </button>
    </div>
  )
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null
  return (
    <p role="alert" className="text-xs font-medium text-destructive">
      {message}
    </p>
  )
}

// ===========================================================================
// AuthView
// ===========================================================================

export default function AuthView() {
  const view = useAppStore((s) => s.view)
  const mode = view.authMode ?? 'login'

  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      {/* decorative gradient */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-96 bg-gradient-to-b from-primary/10 to-transparent" />
      <div aria-hidden className="pointer-events-none absolute left-1/2 top-24 h-64 w-64 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl" />

      <header className="relative z-10 flex items-center justify-between px-4 py-4 sm:px-6">
        <button
          type="button"
          onClick={() => useAppStore.getState().navigate('landing')}
          aria-label="Back to NEXORA home"
          className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandLogo />
        </button>
        <Button variant="ghost" className="text-muted-foreground" onClick={() => useAppStore.getState().navigate('landing')}>
          <ArrowLeft className="h-4 w-4" aria-hidden />
          Back to home
        </Button>
      </header>

      <main className="relative z-10 flex flex-1 items-start justify-center px-4 pb-16 pt-4 sm:items-center sm:pt-0">
        <div className="w-full max-w-md">
          {mode === 'login' && <LoginCard />}
          {mode === 'register' && <RegisterCard />}
          {mode === 'forgot' && <ForgotCard />}
          {mode === 'reset' && <ResetCard />}
        </div>
      </main>
    </div>
  )
}

// ===========================================================================
// Card shell
// ===========================================================================

function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string
  subtitle: string
  children: React.ReactNode
  footer?: React.ReactNode
}) {
  return (
    <div className="rounded-2xl border bg-card p-6 shadow-xl shadow-foreground/5 sm:p-8">
      <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      <p className="mt-1.5 text-sm text-muted-foreground">{subtitle}</p>
      <div className="mt-6">{children}</div>
      {footer && <div className="mt-6 border-t pt-4 text-center text-sm text-muted-foreground">{footer}</div>}
    </div>
  )
}

function ModeLink({
  prefix,
  linkLabel,
  mode,
}: {
  prefix: string
  linkLabel: string
  mode: 'login' | 'register' | 'forgot'
}) {
  return (
    <p>
      {prefix}{' '}
      <button
        type="button"
        onClick={() => useAppStore.getState().navigate('auth', { authMode: mode })}
        className="font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
      >
        {linkLabel}
      </button>
    </p>
  )
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <Button type="submit" className="h-11 w-full text-sm" disabled={pending}>
      {pending && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  )
}

// ===========================================================================
// Login
// ===========================================================================

interface LoginValues {
  email: string
  password: string
}

function LoginCard() {
  const qc = useQueryClient()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    clearErrors,
    formState: { errors },
  } = useForm<LoginValues>({ defaultValues: { email: '', password: '' } })

  const mutation = useMutation({
    mutationFn: (values: LoginValues) =>
      api.post<SessionUser>('/api/auth/login', {
        email: values.email.trim().toLowerCase(),
        password: values.password,
      }),
    onSuccess: (data) => {
      qc.setQueryData(qk.session, data)
      // Store navigation derives the destination (dashboard) from the session.
      useAppStore.getState().setSession(data)
      toast.success(`Welcome back, ${data.user.name.split(' ')[0]}!`)
    },
    onError: (err) => {
      setServerError(applyServerError((n, e) => setError(n as keyof LoginValues, e), err))
      toast.error(err instanceof ApiError ? err.message : 'Sign in failed. Please try again.')
    },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    let ok = true
    if (!EMAIL_RE.test(values.email.trim())) {
      setError('email', { type: 'manual', message: 'Enter a valid email address' })
      ok = false
    }
    if (!values.password) {
      setError('password', { type: 'manual', message: 'Password is required' })
      ok = false
    }
    if (ok) mutation.mutate(values)
  })

  const fillDemo = (email: string) => {
    clearErrors()
    setServerError(null)
    setValue('email', email, { shouldValidate: false, shouldDirty: true })
    setValue('password', DEMO_PASSWORD, { shouldValidate: false, shouldDirty: true })
  }

  return (
    <AuthCard
      title="Sign in to NEXORA"
      subtitle="Pick up right where your team left off."
      footer={
        <div className="space-y-1.5">
          <ModeLink prefix="Don’t have an account?" linkLabel="Sign up" mode="register" />
          <p>
            <button
              type="button"
              onClick={() => useAppStore.getState().navigate('auth', { authMode: 'forgot' })}
              className="font-medium text-primary underline-offset-4 outline-none hover:underline focus-visible:ring-2 focus-visible:ring-ring"
            >
              Forgot your password?
            </button>
          </p>
        </div>
      }
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="login-email">Email</Label>
          <Input
            id="login-email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            className="h-10"
            {...register('email')}
          />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="login-password">Password</Label>
          <PasswordInput
            id="login-password"
            autoComplete="current-password"
            registration={register('password')}
            invalid={!!errors.password}
          />
          <FieldError message={errors.password?.message} />
        </div>

        {serverError && <FieldError message={serverError} />}

        <SubmitButton pending={mutation.isPending}>Sign in</SubmitButton>
      </form>

      {/* Demo accounts */}
      <div className="mt-6 rounded-xl border border-dashed p-4">
        <p className="flex items-center gap-1.5 text-xs font-semibold">
          <Info className="h-3.5 w-3.5 text-primary" aria-hidden />
          Demo accounts
        </p>
        <p className="mt-1 text-xs text-muted-foreground">
          One click fills the form (password <span className="font-mono">{DEMO_PASSWORD}</span>).
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
          {DEMO_ACCOUNTS.map((acc) => (
            <button
              key={acc.email}
              type="button"
              onClick={() => fillDemo(acc.email)}
              aria-label={`Fill demo form for ${acc.role.toLowerCase()} account ${acc.email}`}
              className="flex min-h-11 items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-left outline-none transition-colors hover:border-primary/50 hover:bg-accent/50 focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-medium">{acc.email}</span>
                <span className="block text-[10px] text-muted-foreground">{DEMO_PASSWORD}</span>
              </span>
              <RoleBadge role={acc.role} />
            </button>
          ))}
        </div>
      </div>
    </AuthCard>
  )
}

// ===========================================================================
// Register
// ===========================================================================

interface RegisterValues {
  name: string
  email: string
  password: string
}

function RegisterCard() {
  const qc = useQueryClient()
  const [serverError, setServerError] = React.useState<string | null>(null)

  const form = useForm<RegisterValues>({ defaultValues: { name: '', email: '', password: '' } })
  const { register, handleSubmit, setError, control } = form
  const {
    formState: { errors },
  } = form
  const password = useWatch({ control, name: 'password' }) ?? ''

  const mutation = useMutation({
    mutationFn: (values: RegisterValues) =>
      api.post<SessionUser>('/api/auth/register', {
        name: values.name.trim(),
        email: values.email.trim().toLowerCase(),
        password: values.password,
      }),
    onSuccess: (data) => {
      qc.setQueryData(qk.session, data)
      // Zero workspaces → the store routes straight into onboarding.
      useAppStore.getState().setSession(data)
      toast.success('Account created — let’s set up your workspace.')
    },
    onError: (err) => {
      setServerError(applyServerError((n, e) => setError(n as keyof RegisterValues, e), err))
      toast.error(err instanceof ApiError ? err.message : 'Registration failed. Please try again.')
    },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    let ok = true
    if (values.name.trim().length < 2) {
      setError('name', { type: 'manual', message: 'Name must be at least 2 characters' })
      ok = false
    }
    if (!EMAIL_RE.test(values.email.trim())) {
      setError('email', { type: 'manual', message: 'Enter a valid email address' })
      ok = false
    }
    const pwIssue = passwordIssues(values.password)
    if (pwIssue) {
      setError('password', { type: 'manual', message: pwIssue })
      ok = false
    }
    if (ok) mutation.mutate(values)
  })

  const pwChecks = [
    { ok: password.length >= 8, label: 'At least 8 characters' },
    { ok: /[A-Za-z]/.test(password), label: 'Contains a letter' },
    { ok: /[0-9]/.test(password), label: 'Contains a number' },
  ]

  return (
    <AuthCard
      title="Create your account"
      subtitle="Start free — your workspace takes less than a minute to set up."
      footer={<ModeLink prefix="Already have an account?" linkLabel="Sign in" mode="login" />}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="register-name">Full name</Label>
          <Input
            id="register-name"
            type="text"
            placeholder="Alex Rivera"
            autoComplete="name"
            aria-invalid={errors.name ? true : undefined}
            className="h-10"
            {...register('name')}
          />
          <FieldError message={errors.name?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="register-email">Email</Label>
          <Input
            id="register-email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            className="h-10"
            {...register('email')}
          />
          <FieldError message={errors.email?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="register-password">Password</Label>
          <PasswordInput
            id="register-password"
            autoComplete="new-password"
            registration={register('password')}
            invalid={!!errors.password}
          />
          <div className="flex flex-wrap gap-1.5" aria-live="polite">
            {pwChecks.map((c) => (
              <span
                key={c.label}
                className={
                  c.ok
                    ? 'inline-flex items-center gap-1 rounded-full border border-chart-2/50 bg-chart-2/10 px-2 py-0.5 text-[10px] font-medium text-chart-2'
                    : 'inline-flex items-center gap-1 rounded-full border bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground'
                }
              >
                {c.ok && <CheckCircle2 className="h-3 w-3" aria-hidden />}
                {c.label}
              </span>
            ))}
          </div>
          <FieldError message={errors.password?.message} />
        </div>

        {serverError && <FieldError message={serverError} />}

        <SubmitButton pending={mutation.isPending}>Create account</SubmitButton>
      </form>
    </AuthCard>
  )
}

// ===========================================================================
// Forgot password
// ===========================================================================

interface ForgotValues {
  email: string
}

function ForgotCard() {
  const [sentEmail, setSentEmail] = React.useState<string | null>(null)
  const [devToken, setDevToken] = React.useState<string | null>(null)
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotValues>({ defaultValues: { email: '' } })

  const mutation = useMutation({
    mutationFn: (values: ForgotValues) =>
      api.post<{ ok: boolean; devToken?: string }>('/api/auth/forgot-password', {
        email: values.email.trim().toLowerCase(),
      }),
    onSuccess: (res, values) => {
      setSentEmail(values.email.trim().toLowerCase())
      setDevToken(res.devToken ?? null)
    },
    onError: (err) => {
      setServerError(applyServerError((n, e) => setError(n as keyof ForgotValues, e), err))
      toast.error(err instanceof ApiError ? err.message : 'Request failed. Please try again.')
    },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    if (!EMAIL_RE.test(values.email.trim())) {
      setError('email', { type: 'manual', message: 'Enter a valid email address' })
      return
    }
    mutation.mutate(values)
  })

  if (sentEmail) {
    return (
      <AuthCard
        title="Check your inbox"
        subtitle="If the email exists, a reset link was sent."
        footer={<ModeLink prefix="Remembered it?" linkLabel="Back to sign in" mode="login" />}
      >
        <div className="space-y-4">
          <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-chart-2" aria-hidden />
            <p className="text-sm text-muted-foreground">
              A password reset link was sent to <span className="font-medium text-foreground">{sentEmail}</span>.
              The link expires shortly, so use it soon.
            </p>
          </div>

          {devToken && (
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4">
              <p className="flex items-center gap-1.5 text-xs font-semibold">
                <Info className="h-3.5 w-3.5 text-primary" aria-hidden />
                Dev convenience
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                Email delivery is disabled in demo mode — open the reset link directly:
              </p>
              <Button
                className="mt-3 h-10 w-full"
                onClick={() =>
                  useAppStore.getState().navigate('auth', { authMode: 'reset', resetToken: devToken })
                }
              >
                Open reset link
                <ExternalLink className="h-4 w-4" aria-hidden />
              </Button>
            </div>
          )}

          <Button
            variant="outline"
            className="h-10 w-full"
            onClick={() => {
              setSentEmail(null)
              setDevToken(null)
            }}
          >
            Use a different email
          </Button>
        </div>
      </AuthCard>
    )
  }

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your email and we’ll send you a reset link."
      footer={<ModeLink prefix="Remembered it?" linkLabel="Back to sign in" mode="login" />}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="forgot-email">Email</Label>
          <Input
            id="forgot-email"
            type="email"
            placeholder="you@company.com"
            autoComplete="email"
            aria-invalid={errors.email ? true : undefined}
            className="h-10"
            {...register('email')}
          />
          <FieldError message={errors.email?.message} />
        </div>
        {serverError && <FieldError message={serverError} />}
        <SubmitButton pending={mutation.isPending}>
          Send reset link
          <ArrowRight className="h-4 w-4" aria-hidden />
        </SubmitButton>
      </form>
    </AuthCard>
  )
}

// ===========================================================================
// Reset password
// ===========================================================================

interface ResetValues {
  password: string
  confirm: string
}

function ResetCard() {
  const view = useAppStore((s) => s.view)
  const resetToken = view.resetToken

  if (!resetToken) {
    return (
      <AuthCard
        title="Invalid reset link"
        subtitle="This reset link is missing its token."
        footer={<ModeLink prefix="Need a new link?" linkLabel="Request password reset" mode="forgot" />}
      >
        <div className="flex items-start gap-3 rounded-xl border bg-muted/40 p-4">
          <KeyRound className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Reset links are single-use and expire quickly. Request a fresh one and open it from your
            email (or the dev panel on the forgot-password screen).
          </p>
        </div>
      </AuthCard>
    )
  }

  return <ResetForm resetToken={resetToken} />
}

function ResetForm({ resetToken }: { resetToken: string }) {
  const [serverError, setServerError] = React.useState<string | null>(null)

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetValues>({ defaultValues: { password: '', confirm: '' } })

  const mutation = useMutation({
    mutationFn: (values: ResetValues) =>
      api.post<{ ok: boolean }>('/api/auth/reset-password', { token: resetToken, password: values.password }),
    onSuccess: () => {
      toast.success('Password updated — sign in with your new password.')
      useAppStore.getState().navigate('auth', { authMode: 'login' })
    },
    onError: (err) => {
      setServerError(applyServerError((n, e) => setError(n as keyof ResetValues, e), err))
      toast.error(err instanceof ApiError ? err.message : 'Reset failed. Please try again.')
    },
  })

  const onSubmit = handleSubmit((values) => {
    setServerError(null)
    let ok = true
    const pwIssue = passwordIssues(values.password)
    if (pwIssue) {
      setError('password', { type: 'manual', message: pwIssue })
      ok = false
    }
    if (values.confirm !== values.password) {
      setError('confirm', { type: 'manual', message: 'Passwords do not match' })
      ok = false
    }
    if (ok) mutation.mutate(values)
  })

  return (
    <AuthCard
      title="Set a new password"
      subtitle="Choose a strong password you haven’t used before."
      footer={<ModeLink prefix="Changed your mind?" linkLabel="Back to sign in" mode="login" />}
    >
      <form onSubmit={onSubmit} noValidate className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="reset-password">New password</Label>
          <PasswordInput
            id="reset-password"
            autoComplete="new-password"
            registration={register('password')}
            invalid={!!errors.password}
          />
          <FieldError message={errors.password?.message} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reset-confirm">Confirm password</Label>
          <PasswordInput
            id="reset-confirm"
            autoComplete="new-password"
            registration={register('confirm')}
            invalid={!!errors.confirm}
          />
          <FieldError message={errors.confirm?.message} />
        </div>

        {serverError && <FieldError message={serverError} />}

        <SubmitButton pending={mutation.isPending}>Update password</SubmitButton>
      </form>
    </AuthCard>
  )
}
