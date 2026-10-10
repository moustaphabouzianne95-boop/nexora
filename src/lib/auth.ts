import 'server-only'
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'crypto'
import { cookies } from 'next/headers'
import { db } from '@/lib/db'
import type { PublicUser, Role } from '@/types'
import type { Workspace, User } from '@prisma/client'

const SESSION_COOKIE = 'nexora_session'
const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

// ------------------------------------------------------------ passwords
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [salt, hash] = stored.split(':')
    if (!salt || !hash) return false
    const candidate = scryptSync(password, salt, 64)
    const expected = Buffer.from(hash, 'hex')
    return candidate.length === expected.length && timingSafeEqual(candidate, expected)
  } catch {
    return false
  }
}

// -------------------------------------------------------------- sessions
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

export async function createSession(userId: string, userAgent?: string): Promise<string> {
  const raw = randomBytes(32).toString('hex')
  await db.session.create({
    data: {
      token: hashToken(raw),
      userId,
      userAgent: userAgent?.slice(0, 255),
      expiresAt: new Date(Date.now() + SESSION_TTL_MS),
    },
  })
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE, raw, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: SESSION_TTL_MS / 1000,
  })
  return raw
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE)?.value
  if (raw) {
    await db.session.deleteMany({ where: { token: hashToken(raw) } })
  }
  cookieStore.delete(SESSION_COOKIE)
}

export interface AuthContext {
  user: User
  roleByWorkspace: Map<string, Role>
}

/** Resolve the current authenticated user + workspace roles. Returns null when signed out. */
export async function getAuth(): Promise<AuthContext | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get(SESSION_COOKIE)?.value
  if (!raw) return null
  const session = await db.session.findUnique({
    where: { token: hashToken(raw) },
    include: { user: true },
  })
  if (!session) return null
  if (session.expiresAt.getTime() < Date.now()) {
    await db.session.delete({ where: { id: session.id } }).catch(() => {})
    return null
  }
  if (session.user.status !== 'ACTIVE') return null
  const memberships = await db.workspaceMember.findMany({
    where: { userId: session.user.id },
    select: { workspaceId: true, role: true },
  })
  const roleByWorkspace = new Map<string, Role>()
  memberships.forEach((m) => roleByWorkspace.set(m.workspaceId, m.role as Role))
  return { user: session.user, roleByWorkspace }
}

export function toPublicUser(user: User): PublicUser {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    avatarColor: user.avatarColor,
    timezone: user.timezone,
    locale: user.locale,
    themePref: user.themePref as PublicUser['themePref'],
    status: user.status as PublicUser['status'],
    createdAt: user.createdAt.toISOString(),
  }
}

// ------------------------------------------------------- reset tokens
export async function createPasswordResetToken(userId: string): Promise<string> {
  const raw = randomBytes(24).toString('hex')
  await db.passwordResetToken.create({
    data: {
      token: hashToken(raw),
      userId,
      expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
    },
  })
  return raw
}

export async function consumePasswordResetToken(raw: string): Promise<string | null> {
  const record = await db.passwordResetToken.findUnique({ where: { token: hashToken(raw) } })
  if (!record) return null
  if (record.usedAt || record.expiresAt.getTime() < Date.now()) return null
  await db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } })
  return record.userId
}

export function invitationToken(): string {
  return randomBytes(24).toString('hex')
}
