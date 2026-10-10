'use client'

import { cn } from '@/lib/utils'
import { APP_NAME } from '@/lib/constants'

/**
 * Brand mark — rounded square with "N". Pure tokens, works in light & dark.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        'flex h-8 w-8 shrink-0 select-none items-center justify-center rounded-lg bg-primary text-base font-black leading-none text-primary-foreground shadow-xs',
        className
      )}
    >
      N
    </span>
  )
}

/**
 * Brand mark + NEXORA wordmark.
 */
export function BrandLogo({
  className,
  markClassName,
  textClassName,
}: {
  className?: string
  markClassName?: string
  textClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <BrandMark className={markClassName} />
      <span className={cn('text-lg font-bold tracking-tight', textClassName)}>{APP_NAME}</span>
    </span>
  )
}
