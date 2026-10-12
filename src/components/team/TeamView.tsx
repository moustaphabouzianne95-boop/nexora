'use client'

import { useAppStore } from '@/store/app-store'
import { TeamManager } from '@/components/team/members-shared'

/**
 * Team directory: members grid + invite flow + pending invitations.
 * Full management UI lives in members-shared.tsx so Settings → Members can
 * render the exact same surface.
 */
export default function TeamView() {
  const session = useAppStore((s) => s.session)
  const wsId = session?.currentWorkspaceId

  if (!wsId) return null

  return <TeamManager wsId={wsId} title="Team" />
}
