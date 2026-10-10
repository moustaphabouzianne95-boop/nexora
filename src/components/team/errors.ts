'use client'

import { toast } from 'sonner'
import { ApiError } from '@/lib/api-client'

type NavigateFn = (view: 'settings', extra?: { settingsTab: 'billing' }) => void

/**
 * Central mutation error toast. 402 (plan limit / feature gate) shows an
 * Upgrade action that navigates to Settings → Billing; everything else shows
 * the server-provided message.
 */
export function toastMutationError(
  error: unknown,
  fallback: string,
  navigate?: NavigateFn
): void {
  if (error instanceof ApiError && error.status === 402) {
    toast.warning('Plan limit reached', {
      description: error.message || 'This action requires a higher plan.',
      action: navigate
        ? {
            label: 'Upgrade',
            onClick: () => navigate('settings', { settingsTab: 'billing' }),
          }
        : undefined,
      duration: 8000,
    })
    return
  }
  if (error instanceof ApiError) {
    // Surface per-field validation details when present
    const detail = error.details ? Object.values(error.details)[0] : undefined
    toast.error(detail ?? error.message)
    return
  }
  toast.error(fallback)
}
