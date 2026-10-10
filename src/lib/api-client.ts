'use client'

/**
 * Typed API client for NEXORA. All requests are same-origin relative paths.
 * Throws ApiClientError with server-provided messages when !res.ok.
 */

export class ApiClientError extends Error {
  constructor(
    public status: number,
    message: string,
    public code?: string,
    public details?: Record<string, string>
  ) {
    super(message)
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(path, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  })
  let data: unknown = null
  try {
    data = await res.json()
  } catch {
    /* no body */
  }
  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; code?: string; details?: Record<string, string> }
    throw new ApiClientError(res.status, err.error ?? `Request failed (${res.status})`, err.code, err.details)
  }
  return data as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

// ------------------------------------------------------------------ query keys
export const qk = {
  session: ['session'] as const,
  workspace: (id: string) => ['workspace', id] as const,
  members: (id: string) => ['members', id] as const,
  invitations: (id: string) => ['invitations', id] as const,
  projects: (id: string) => ['projects', id] as const,
  project: (id: string) => ['project', id] as const,
  tasks: (wsId: string, filters?: unknown) => ['tasks', wsId, filters ?? {}] as const,
  projectTasks: (projectId: string) => ['project-tasks', projectId] as const,
  task: (id: string) => ['task', id] as const,
  labels: (wsId: string) => ['labels', wsId] as const,
  notifications: ['notifications'] as const,
  activity: (wsId: string) => ['activity', wsId] as const,
  dashboard: (wsId: string) => ['dashboard', wsId] as const,
  analytics: (wsId: string, range: string) => ['analytics', wsId, range] as const,
  subscription: (wsId: string) => ['subscription', wsId] as const,
  invoices: (wsId: string) => ['invoices', wsId] as const,
  myTasks: (wsId: string) => ['my-tasks', wsId] as const,
  calendar: (wsId: string, month: string) => ['calendar', wsId, month] as const,
}

export { ApiClientError as ApiError }
