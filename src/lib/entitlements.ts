import 'server-only'
import { db } from '@/lib/db'
import { HttpError } from '@/lib/api-helpers'
import { entitlementsFor } from '@/lib/constants'
import type { Plan, PlanEntitlements } from '@/types'

/**
 * Central plan-entitlement service.
 * All resource-creating operations must pass through here so that
 * plan limits are enforced server-side (never from client state).
 */
export async function getSubscription(workspaceId: string) {
  let sub = await db.subscription.findUnique({ where: { workspaceId } })
  if (!sub) {
    sub = await db.subscription.create({ data: { workspaceId, plan: 'FREE', status: 'ACTIVE' } })
  }
  return sub
}

export async function getEntitlements(workspaceId: string): Promise<PlanEntitlements> {
  const sub = await getSubscription(workspaceId)
  return entitlementsFor(sub.plan as Plan)
}

export async function assertCanCreateProject(workspaceId: string): Promise<void> {
  const ent = await getEntitlements(workspaceId)
  if (ent.maxActiveProjects === null) return
  const active = await db.project.count({
    where: { workspaceId, archivedAt: null, status: { not: 'ARCHIVED' } },
  })
  if (active >= ent.maxActiveProjects) {
    throw new HttpError(
      402,
      `Your plan allows up to ${ent.maxActiveProjects} active projects. Upgrade to add more — your existing data is safe.`,
      'PLAN_LIMIT_PROJECTS'
    )
  }
}

export async function assertCanInviteMember(workspaceId: string, currentMembers: number): Promise<void> {
  const ent = await getEntitlements(workspaceId)
  if (ent.maxMembers === null) return
  if (currentMembers >= ent.maxMembers) {
    throw new HttpError(
      402,
      `Your plan allows up to ${ent.maxMembers} members. Upgrade to invite more teammates.`,
      'PLAN_LIMIT_MEMBERS'
    )
  }
}

export async function assertFeature(workspaceId: string, feature: keyof PlanEntitlements & ('attachments' | 'dependencies' | 'customLabels' | 'calendarView' | 'timelineView' | 'advancedAnalytics')): Promise<void> {
  const ent = await getEntitlements(workspaceId)
  if (!ent[feature]) {
    throw new HttpError(402, `This feature is not available on your current plan. Upgrade to unlock it.`, 'PLAN_FEATURE_LOCKED')
  }
}

/** Effective seats used for billing previews (members count). */
export async function countMembers(workspaceId: string): Promise<number> {
  return db.workspaceMember.count({ where: { workspaceId } })
}
