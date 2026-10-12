'use client'

import * as React from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useForm, useWatch, Controller } from 'react-hook-form'
import { toast } from 'sonner'
import { Moon, SunMedium, Monitor, Loader2 } from 'lucide-react'
import { useTheme } from 'next-themes'
import { api, qk } from '@/lib/api-client'
import { useAppStore } from '@/store/app-store'
import { toastMutationError } from '@/components/team/errors'
import { PROJECT_COLORS, TIMEZONES } from '@/lib/constants'
import type { PublicUser, SessionUser } from '@/types'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { UserAvatar } from '@/components/shared/ui-primitives'

// qk has no preferences key; keep it local & stable
const PREFERENCES_KEY = ['user-preferences'] as const

/** GET/PATCH /api/user/preferences shape (per API contract). */
export interface NotificationPreferences {
  userId: string
  taskAssigned: boolean
  taskMention: boolean
  comments: boolean
  dueSoon: boolean
  invitations: boolean
  billing: boolean
}

const LOCALES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية (Arabic)' },
]

const NOTIFICATION_LABELS: Record<keyof Omit<NotificationPreferences, 'userId'>, string> = {
  taskAssigned: 'Task assigned to me',
  taskMention: 'I am mentioned in a comment',
  comments: 'Comments on tasks I follow',
  dueSoon: 'Due-soon reminders',
  invitations: 'Workspace invitations',
  billing: 'Billing & plan updates',
}

interface ProfileFormValues {
  name: string
  avatarColor: string
  timezone: string
  locale: string
}

interface PasswordFormValues {
  currentPassword: string
  newPassword: string
  confirmPassword: string
}

export function ProfileTab() {
  const { session } = useAppStore()
  const qc = useQueryClient()
  const user = session?.user

  // ------------------------------------------------------------ profile form
  const profileForm = useForm<ProfileFormValues>({
    values: React.useMemo(
      () => ({
        name: user?.name ?? '',
        avatarColor: user?.avatarColor ?? PROJECT_COLORS[0],
        timezone: user?.timezone ?? 'UTC',
        locale: user?.locale ?? 'en',
      }),
      [user?.name, user?.avatarColor, user?.timezone, user?.locale]
    ),
  })

  const saveProfile = useMutation({
    mutationFn: (values: ProfileFormValues) => api.patch<PublicUser>('/api/user/profile', values),
    onSuccess: (updated) => {
      qc.setQueryData<SessionUser | null>(qk.session, (old) => (old ? { ...old, user: updated } : old))
      toast.success('Profile updated')
    },
    onError: (e) => toastMutationError(e, 'Failed to update profile'),
  })

  // ---------------------------------------------------------------- theme
  const { theme, setTheme } = useTheme()
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => setMounted(true), [])

  const themePref = useMutation({
    mutationFn: (pref: 'LIGHT' | 'DARK' | 'SYSTEM') =>
      api.patch<PublicUser>('/api/user/profile', { themePref: pref }),
    onSuccess: (updated) => {
      qc.setQueryData<SessionUser | null>(qk.session, (old) => (old ? { ...old, user: updated } : old))
    },
    onError: () => toast.error('Could not save theme preference'),
  })

  const applyTheme = (value: string) => {
    setTheme(value) // light | dark | system — applies instantly
    themePref.mutate(value.toUpperCase() as 'LIGHT' | 'DARK' | 'SYSTEM')
  }

  // -------------------------------------------------------------- password
  const passwordForm = useForm<PasswordFormValues>()

  const changePassword = useMutation({
    mutationFn: (values: { currentPassword: string; newPassword: string }) =>
      api.post<{ ok: boolean }>('/api/user/password', values),
    onSuccess: () => {
      passwordForm.reset()
      toast.success('Password changed')
    },
    onError: (e) => toastMutationError(e, 'Failed to change password'),
  })

  // ---------------------------------------------------------- notifications
  const prefsQuery = useQuery({
    queryKey: PREFERENCES_KEY,
    queryFn: () => api.get<NotificationPreferences>('/api/user/preferences'),
  })

  const savePref = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) =>
      api.patch<NotificationPreferences>('/api/user/preferences', patch),
    onSuccess: (updated) => {
      qc.setQueryData(PREFERENCES_KEY, updated)
      toast.success('Notification preferences updated')
    },
    onError: (e) => toastMutationError(e, 'Failed to update notification preferences'),
  })

  // useWatch hooks must run before any early return
  const watchedColor = useWatch({ control: profileForm.control, name: 'avatarColor' }) ?? PROJECT_COLORS[0]
  const watchedName = useWatch({ control: profileForm.control, name: 'name' }) ?? ''

  if (!user) return null

  return (
    <div className="space-y-6 max-w-3xl">
      {/* ------------------------------------------------ profile details */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Profile</CardTitle>
          <CardDescription>How you appear across all of your workspaces.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={profileForm.handleSubmit((v) => saveProfile.mutate(v))}
            className="space-y-5"
            noValidate
          >
            <div className="flex items-center gap-4">
              <UserAvatar name={watchedName || user.name} color={watchedColor} size="lg" />
              <div>
                <Label className="text-sm">Avatar color</Label>
                <div className="mt-1.5 flex flex-wrap items-center gap-2" role="radiogroup" aria-label="Avatar color">
                  {PROJECT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      role="radio"
                      aria-checked={watchedColor === c}
                      aria-label={`Avatar color ${c}`}
                      onClick={() => profileForm.setValue('avatarColor', c, { shouldDirty: true })}
                      className={cn(
                        'h-8 w-8 rounded-full border-2 transition-transform outline-none focus-visible:ring-2 focus-visible:ring-ring hover:scale-110',
                        watchedColor === c ? 'border-foreground ring-2 ring-ring ring-offset-2 ring-offset-background' : 'border-transparent'
                      )}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="profile-name">Full name</Label>
                <Input
                  id="profile-name"
                  autoComplete="name"
                  aria-invalid={!!profileForm.formState.errors.name}
                  {...profileForm.register('name', { required: 'Name is required', minLength: { value: 2, message: 'Too short' } })}
                />
                {profileForm.formState.errors.name && (
                  <p className="text-xs text-destructive" role="alert">{profileForm.formState.errors.name.message}</p>
                )}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-email">Email</Label>
                <Input id="profile-email" value={user.email} readOnly disabled className="opacity-70" />
                <p className="text-[11px] text-muted-foreground">Contact support to change your email.</p>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-timezone">Timezone</Label>
                <Controller
                  control={profileForm.control}
                  name="timezone"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="profile-timezone" className="w-full" aria-label="Timezone">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-72">
                        {TIMEZONES.map((tz) => (
                          <SelectItem key={tz} value={tz}>{tz}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="profile-locale">Language</Label>
                <Controller
                  control={profileForm.control}
                  name="locale"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="profile-locale" className="w-full" aria-label="Language">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {LOCALES.map((l) => (
                          <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="flex justify-end">
              <Button type="submit" disabled={saveProfile.isPending || !profileForm.formState.isDirty}>
                {saveProfile.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Save profile
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------ theme */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Appearance</CardTitle>
          <CardDescription>Choose how NEXORA looks on this device.</CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            value={mounted ? (theme ?? 'system') : 'system'}
            onValueChange={applyTheme}
            className="grid gap-3 sm:grid-cols-3"
          >
            {([
              { value: 'light', label: 'Light', icon: SunMedium },
              { value: 'dark', label: 'Dark', icon: Moon },
              { value: 'system', label: 'System', icon: Monitor },
            ]).map(({ value, label, icon: Icon }) => (
              <Label
                key={value}
                className={cn(
                  'flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border p-3 font-normal transition-colors hover:bg-accent/50',
                  mounted && (theme ?? 'system') === value && 'border-primary ring-1 ring-primary'
                )}
              >
                <RadioGroupItem value={value} aria-label={`${label} theme`} />
                <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
                <span className="text-sm">{label}</span>
              </Label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      {/* ---------------------------------------------------- password */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Password</CardTitle>
          <CardDescription>Use at least 8 characters with a mix of letters and numbers.</CardDescription>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={passwordForm.handleSubmit((v) =>
              changePassword.mutate({ currentPassword: v.currentPassword, newPassword: v.newPassword })
            )}
            className="grid gap-4 sm:grid-cols-3"
            noValidate
          >
            <div className="space-y-1.5">
              <Label htmlFor="pw-current">Current password</Label>
              <Input
                id="pw-current"
                type="password"
                autoComplete="current-password"
                {...passwordForm.register('currentPassword', { required: 'Required' })}
              />
              {passwordForm.formState.errors.currentPassword && (
                <p className="text-xs text-destructive" role="alert">Current password is required</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-new">New password</Label>
              <Input
                id="pw-new"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!passwordForm.formState.errors.newPassword}
                {...passwordForm.register('newPassword', {
                  required: 'Required',
                  minLength: { value: 8, message: 'At least 8 characters' },
                })}
              />
              {passwordForm.formState.errors.newPassword && (
                <p className="text-xs text-destructive" role="alert">{passwordForm.formState.errors.newPassword.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pw-confirm">Confirm new password</Label>
              <Input
                id="pw-confirm"
                type="password"
                autoComplete="new-password"
                aria-invalid={!!passwordForm.formState.errors.confirmPassword}
                {...passwordForm.register('confirmPassword', {
                  validate: (v, form) => v === form.newPassword || 'Passwords do not match',
                })}
              />
              {passwordForm.formState.errors.confirmPassword && (
                <p className="text-xs text-destructive" role="alert">{passwordForm.formState.errors.confirmPassword.message}</p>
              )}
            </div>
            <div className="sm:col-span-3 flex justify-end">
              <Button type="submit" variant="outline" disabled={changePassword.isPending}>
                {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin" />} Change password
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ------------------------------------------------- notifications */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Notification preferences</CardTitle>
          <CardDescription>Choose what lands in your inbox.</CardDescription>
        </CardHeader>
        <CardContent>
          {prefsQuery.isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}
            </div>
          ) : prefsQuery.isError || !prefsQuery.data ? (
            <p className="text-sm text-muted-foreground">Could not load preferences. Try refreshing the page.</p>
          ) : (
            <div className="divide-y">
              {(Object.keys(NOTIFICATION_LABELS) as (keyof typeof NOTIFICATION_LABELS)[]).map((key) => (
                <div key={key} className="flex items-center justify-between gap-4 py-3">
                  <span className="text-sm">{NOTIFICATION_LABELS[key]}</span>
                  <Switch
                    checked={prefsQuery.data[key]}
                    disabled={savePref.isPending}
                    onCheckedChange={(checked) => savePref.mutate({ [key]: checked })}
                    aria-label={NOTIFICATION_LABELS[key]}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Separator />
      <p className="text-xs text-muted-foreground">
        Member since {new Date(user.createdAt).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })} · Account status: {user.status}
      </p>
    </div>
  )
}
