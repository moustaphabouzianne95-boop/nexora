# NEXORA

**Plan smarter. Build together. Deliver better.**

NEXORA is a production-grade, multi-tenant project management and team collaboration SaaS. It ships with real workspaces (tenant isolation), role-based access control, projects, tasks, an interactive Kanban board with persisted drag & drop, calendar & timeline views, comments, attachments, notifications, analytics computed from live data, and a subscription/billing module with server-enforced plan entitlements — all backed by a seeded, realistic demo dataset.

---

## 1. Project overview

NEXORA serves individuals, startups, agencies, and companies that need one unified workspace for planning and delivery. Every organization gets an isolated workspace with its own members, projects, tasks, labels, activity history, and subscription.

- Single-page application experience on `/` (public marketing site → auth → app shell), backed by a REST API under `/api/*`.
- Multi-tenant data access is enforced **server-side** on every request; the frontend never decides authorization.

## 2. Main features

| Area | Highlights |
| --- | --- |
| Public site | Landing page, pricing (Free / Pro / Business), FAQ, legal notes |
| Authentication | Register, login, logout, forgot/reset password (dev-token flow), sessions, rate limiting |
| Workspaces | Multi-workspace membership, switcher with persisted selection, onboarding wizard, archive/delete, slug URLs |
| Roles | OWNER, ADMIN, PROJECT_MANAGER, MEMBER, VIEWER with a central capability matrix enforced on the server |
| Members & invitations | Invite by email (dev link fallback), role changes, removal, revoke/resend invitations, expiry |
| Projects | Full CRUD, archive/restore, member management, milestones, progress computed from tasks |
| Tasks | Full CRUD, statuses, priorities, assignees, due dates, estimates, labels, subtasks, dependencies (cycle-safe), activity log |
| Kanban | @dnd-kit drag & drop with optimistic updates and rollback, keyboard alternative via card menu, per-column creation, filters |
| Views | Board, List (sort/group/bulk edit), Calendar (month/week, milestones), Timeline (per-assignee bars) |
| Collaboration | Comments (edit own, delete own/PM+), attachments (type/size validated, workspace-scoped download), notifications & inbox, preferences |
| Analytics | Dashboard stats + workspace analytics (completion/overdue/on-time rates, timeseries, workload), member analytics gated by plan |
| Billing | Test-mode subscription lifecycle (upgrade/downgrade/cancel/resume), invoices, usage vs limits, entitlement service enforcing limits server-side (HTTP 402) |
| Settings | Profile (name, avatar color, timezone, locale, theme), password change, notification preferences, workspace settings, danger zone |

## 3. Technology stack

- **Framework:** Next.js 16 (App Router), React 19, TypeScript (strict)
- **UI:** Tailwind CSS 4, shadcn/ui (New York), Lucide icons, next-themes (light/dark/system), sonner toasts
- **Data fetching:** TanStack Query v5; client state: Zustand
- **Forms/validation:** react-hook-form + Zod (shared schemas client/server)
- **DnD:** @dnd-kit (core/sortable/utilities)
- **Charts:** Recharts
- **Database:** Prisma ORM + SQLite (see “Platform adaptations”)
- **Auth:** Custom session auth — scrypt password hashing (node:crypto), hashed session tokens stored in DB, httpOnly SameSite=Lax cookies
- **Runtime:** Bun (dev) / Node (standalone build)

## 4. Architecture overview

```
src/
  app/
    page.tsx                # the only visible route: session gate → view router (SPA)
    layout.tsx              # ThemeProvider + Toaster
    api/                    # REST API (route handlers), grouped by domain
      auth/ user/           # sessions, profile, password, preferences
      workspaces/           # workspaces, members, invitations, labels, analytics, billing…
      projects/ tasks/      # projects, tasks, comments, attachments, dependencies
      notifications/ search/ billing/
  components/
    app/                    # app shell (sidebar/header/switcher/search/notifications)
    landing/ auth/ onboarding/
    dashboard/ inbox/ my-tasks/
    projects/ tasks/        # board/list/calendar/timeline views, task dialog
    team/ reports/ settings/ calendar/
    shared/ui-primitives.tsx
  lib/
    auth.ts                 # hashing, sessions, reset tokens
    api-helpers.ts          # handler wrapper, guards (requireWorkspace/Project/Task), validation, activity, notify
    permissions.ts          # capability matrix (shared client/server)
    entitlements.ts         # plan-limit enforcement (402 on breach)
    validation.ts           # Zod schemas
    constants.ts            # statuses, roles, plans & limits
    rate-limit.ts           # in-memory sliding window
    db.ts                   # Prisma client singleton
  store/app-store.ts        # session + view navigation (zustand)
  types/index.ts            # shared DTOs
prisma/
  schema.prisma             # full multi-tenant schema (indexes, cascades)
  seed.ts                   # realistic demo data
```

**Request flow:** client (TanStack Query) → route handler → `requireAuth()` → `requireWorkspace/Project/Task()` (membership + capability check) → Zod-validated business logic → Prisma → DTO mapping (`src/types`) → JSON. Errors are normalized to `{ error, code?, details? }` with safe messages; unexpected failures never leak stack traces.

## 5. Database model overview

Core models (SQLite dialect; see `prisma/schema.prisma`):

- **Identity:** `User`, `Session` (SHA-256 hashed tokens), `PasswordResetToken`
- **Tenancy:** `Workspace`, `WorkspaceMember` (unique per workspace+user, role), `WorkspaceInvitation` (hashed token, status, expiry)
- **Delivery:** `Project`, `ProjectMember`, `Task` (self-relation for subtasks, milestone link, position float for board ordering), `Milestone`, `Label`, `TaskLabel`, `TaskDependency` (unique pair, cycle-checked in service)
- **Collaboration:** `Comment`, `Attachment` (base64 in dev — see limitations), `Notification`, `NotificationPreference`, `ActivityLog`
- **Billing:** `Subscription` (plan/status/interval/period), `Invoice` (minor units, test-mode flag), `BillingEvent` (audit + webhook idempotency)

Indexes cover `workspaceId`, `userId`, `projectId`, `assigneeId`, `status`, `priority`, `dueDate`, `createdAt`; money is stored as integer minor units (`amountCents`). Deletes cascade from Workspace → Project → Task to prevent orphans.

## 6. Local setup

```bash
bun install                # or npm install
cp .env.example .env       # then adjust if needed
bun run db:push            # create/sync SQLite database (db/custom.db)
bun prisma/seed.ts         # seed demo data (idempotent: wipes + reseeds)
bun run dev                # http://localhost:3000
```

## 7. Environment variables

See `.env.example`. Summary:

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Prisma connection (SQLite `file:` URL in this sandbox) |
| `BILLING_WEBHOOK_SECRET` | Optional. When set, `/api/billing/webhook` verifies `x-nexora-signature` (HMAC-SHA256 over the raw body) |
| `APP_URL` | Absolute app URL used in dev invite links |
| `NODE_ENV` | `development` enables dev-only flows (password-reset token in response, invite dev links) |

Secrets are only ever read server-side; no secret is bundled into client code.

## 8. Database migrations

Development uses `prisma db push` (fast iteration). For production-style history:

```bash
bun run db:migrate         # prisma migrate dev
bun run db:generate        # regenerate client after schema edits
```

## 9. Seed data

`bun prisma/seed.ts` creates 12 users, 3 workspaces (Pro, Business, Free), 8 projects, 105 tasks (completed / in-progress / in-review / upcoming / overdue / unassigned mix), 21 labels, 52 comments, 8 milestones, 7 dependencies, notifications, activity history, subscriptions, and invoices. Re-running resets the database.

## 10. Demo accounts

Password for all demo accounts: **`Demo1234!`**

| Email | Role | Notes |
| --- | --- | --- |
| `owner@nexora.dev` | OWNER | NEXORA Product Team (Pro) + Startup Operations (Free) |
| `admin@nexora.dev` | ADMIN | Product Team; **owner** of Digital Agency (Business) |
| `pm@nexora.dev` | PROJECT_MANAGER | Product Team + Digital Agency |
| `member@nexora.dev` | MEMBER | Product Team only |
| `viewer@nexora.dev` | VIEWER | Product Team only (read-only) |

Additional members: `david@`, `nina@`, `omar@`, `grace@`, `leo@`, `yuki@`, `ella@` (@nexora.dev). The login screen includes one-click demo fills.

## 11. Running the application

```bash
bun run dev      # development server (port 3000) with logs in dev.log
bun run lint     # ESLint
bunx tsc --noEmit  # type-check
```

## 12. Running tests

> **Platform note:** automated test suites (Vitest/Playwright per the original spec) are **not included** in this sandbox build — the deployment environment forbids test code and running build/test harnesses. The behaviors the spec required tests for were verified manually against the running app and are documented here for future porting:
>
> - **Tenant isolation:** user B receives 403 for workspace A’s projects/members/dashboard/subscription; anonymous receives 401; search returns only member-visible records.
> - **Authorization:** MEMBER self-promotion → 403; VIEWER task edit/project create → 403; role changes respect `canChangeRole`; OWNER is immutable/removal-protected.
> - **Plan entitlements:** FREE workspace → HTTP 402 for attachments, dependencies, custom labels, calendar/timeline; project/member creation limits return 402 with upgrade messaging.
> - **Task lifecycle:** status→DONE sets `completedAt`, leaving DONE clears it; reorder persists; dependency cycles rejected (409); comment/attachment ownership enforced.
>
> Recommended first porting step: extract the `curl`-based verification into Vitest integration tests against a seeded database.

## 13. Billing test mode

Stripe credentials are unavailable in this environment, so billing runs in a clearly-labeled **test mode**:

- Plan changes apply instantly, record a `PAID` test invoice (minor units) and a `BillingEvent`, and notify the workspace owner. The UI shows a persistent “Test-mode billing” disclosure; invoices carry a `TEST` chip.
- **No real payments are processed and no payment credentials exist.** Do not enter card data anywhere — there is no card input by design.
- Entitlements are enforced server-side regardless of what the client displays (HTTP 402 + upgrade messaging).
- To go live: set provider credentials, implement the hosted-checkout handoff in `POST /api/workspaces/:id/subscription`, and verify webhooks at `POST /api/billing/webhook` (signature verification is implemented and activates when `BILLING_WEBHOOK_SECRET` is set; processing is idempotent via `BillingEvent`).

## 14. Deployment

1. Provision managed **PostgreSQL** (recommended) — switch `prisma/schema.prisma` `datasource db.provider` to `"postgresql"`, keep the identical schema, run `prisma migrate deploy`.
2. Set env vars (`DATABASE_URL`, `APP_URL`, `BILLING_WEBHOOK_SECRET`, provider keys).
3. `bun run build` → `bun run start` (standalone output) or deploy to Vercel/any Node host.
4. Seed only non-production databases; the seed script wipes data.
5. Move attachments to object storage (S3/R2) before production — see limitations.
6. Health check: `GET /api/auth/me` returns `200` (with `null` body when signed out) — suitable for liveness probes.

## 15. Security considerations

- Server-side authorization on every workspace-scoped endpoint (`requireWorkspace`/`requireProject`/`requireTask`); the browser is never trusted for identity, roles, workspace IDs, or billing state.
- Passwords: scrypt with per-user salt; sessions: 256-bit random tokens, SHA-256 hashed at rest, httpOnly/SameSite=Lax cookies, 30-day expiry, DB revocable.
- Rate limiting on auth endpoints (register 10/h, login 10/15min, forgot 5/h); generic error messages prevent user enumeration.
- Input validated with Zod on every endpoint; output rendered as React text (no `dangerouslySetInnerHTML`); attachments type/size whitelisted server-side.
- Security headers (X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy) applied globally via `next.config.ts`.
- Audit/activity log records sensitive actions (role changes, removals, plan changes, deletions) with actor + safe metadata; passwords/tokens are never logged.

## 16. Known limitations

1. **SQLite instead of PostgreSQL** (sandbox constraint). Schema is PostgreSQL-ready; no row-level security — tenant isolation is enforced in the service layer (sufficient and verified here).
2. **Attachments stored as base64 in the database** with a 2 MB cap and type whitelist. Production should stream to S3-compatible object storage with signed, access-checked URLs.
3. **Email delivery not configured** — password reset exposes a dev token in non-production responses, and workspace invitations return a copyable `devLink`. The UI labels both as dev conveniences; no claim of a sent email is made.
4. **Billing is test-mode only** (see §13).
5. **Automated tests omitted** (see §12).
6. **Ownership transfer** is intentionally surfaced as “Contact support” rather than simulated — it requires a verified two-step handoff flow.
7. **Localization** is architecture-ready (locale/timezone stored per user & workspace, centralized constants/dictionaries) but only English ships; French/Arabic (RTL) are future work.
8. Real-time push uses polling (30 s) rather than WebSockets; activity/notification fan-out is transactional and immediate for the acting user.

## 17. Future roadmap

- Stripe (or Paddle) live billing with hosted checkout + portal
- Real-time collaboration (WebSocket presence + live board updates)
- S3-backed attachments with signed URLs and antivirus scanning
- Full i18n (FR/AR with RTL), per-workspace locale defaults
- Portfolio/roadmap Gantt with dependency-aware scheduling
-granular custom roles & permission sets (Business tier)
- Automated E2E suite (Playwright) covering the golden workflow in §12
