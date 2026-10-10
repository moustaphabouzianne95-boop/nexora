# NEXORA Build Worklog

Shared log for all agents. READ BEFORE WORKING. APPEND after finishing.
Entry format: `---` / Task ID / Agent / Task / Work Log / Stage Summary.

---

Task ID: 1
Agent: main orchestrator
Task: Foundation — schema, seed, core libs, app shell, view router

Work Log:
- Wrote full multi-tenant Prisma schema (SQLite): User, Session, PasswordResetToken, Workspace, WorkspaceMember, WorkspaceInvitation, Project, ProjectMember, Task, Label, TaskLabel, TaskDependency, Milestone, Comment, Attachment, Notification, NotificationPreference, ActivityLog, Subscription, BillingEvent, Invoice. Indexes on workspaceId/userId/projectId/assigneeId/status/priority/dueDate/createdAt.
- `bun run db:push` OK.
- prisma/seed.ts: 12 users, 3 workspaces (NEXORA Product Team PRO, Digital Agency BUSINESS, Startup Operations FREE), 8 projects, 105 tasks (mix of DONE/IN_PROGRESS/IN_REVIEW/TODO/BACKLOG/CANCELLED incl. overdue + unassigned), 52 comments, 21 labels, 8 milestones, 7 dependencies, 12 notifications, 72 activities, subscriptions + invoices + billing events, 2 pending invitations.
- Demo accounts (password `Demo1234!`): owner@nexora.dev (OWNER), admin@nexora.dev (ADMIN), pm@nexora.dev (PM), member@nexora.dev (MEMBER), viewer@nexora.dev (VIEWER), david@, nina@, omar@, grace@, leo@, yuki@, ella@.
- Core libs: src/lib/auth.ts (scrypt password hashing, hashed session tokens in DB, httpOnly cookie `nexora_session`, 30d TTL, reset tokens), src/lib/api-helpers.ts (ok/fail/HttpError/handler wrapper, requireAuth/requireWorkspace/requireProject/requireTask guards, parseBody/parseQuery zod validation, logActivity, notify honoring NotificationPreference), src/lib/rate-limit.ts (in-memory sliding window), src/lib/entitlements.ts (assertCanCreateProject, assertCanInviteMember, assertFeature — server-side plan enforcement), src/lib/validation.ts (all zod schemas), src/lib/permissions.ts (capability matrix shared client/server), src/lib/constants.ts (statuses/priorities/plans with limits: FREE 3 members/3 projects, PRO 15/25 $10/mo, BUSINESS 50/100 $20/mo; annual pricing 19200/9600 cents).
- Shared types: src/types/index.ts. Client API: src/lib/api-client.ts (api.get/post/patch/delete + qk query keys). Store: src/store/app-store.ts (zustand: session, view navigation, sidebar, task dialog).
- App shell: src/components/app/app-shell.tsx (workspace switcher, sidebar nav, header w/ breadcrumbs, ⌘K search dialog, notifications popover w/ unread badge + mark read/all, create menu, theme toggle, profile menu, mobile Sheet drawer).
- Shared UI: src/components/shared/ui-primitives.tsx (UserAvatar, AvatarStack, PriorityBadge, StatusBadge, ProjectStatusBadge, RoleBadge, LabelChip, DateChip, isOverdue, EmptyState, ErrorState, StatCardSkeleton, CardGridSkeleton, TableSkeleton, ChartSkeleton, BoardSkeleton, ProgressBar, formatRelativeTime, formatDateTime).
- Root: src/app/page.tsx (SessionGate → ViewRouter), layout.tsx (next-themes ThemeProvider + sonner Toaster), view stubs under src/components/{landing,auth,onboarding,dashboard,inbox,my-tasks,projects,tasks,calendar,team,reports,settings}.
- IMPORTANT ARCHITECTURE: single visible route `/` (SPA). All "pages" are views switched by the zustand store. Auth pages + landing are public surfaces; app views live inside AppShell.

Stage Summary:
- Foundation complete & seeded. Subagents MUST NOT modify: prisma/schema.prisma, src/lib/{auth,api-helpers,permissions,entitlements,constants,rate-limit,validation,db,api-client,utils}.ts, src/types/index.ts, src/store/app-store.ts, src/app/{layout,page}.tsx, src/components/app/app-shell.tsx, src/components/shared/ui-primitives.tsx without coordinating here.
- API CONTRACT below is BINDING for tasks 2-a and 2-b.
- View CONTRACT below is BINDING for tasks 3-a/3-b/4-a/4-b.

=== API CONTRACT (binding) =====================================================

All endpoints return JSON. Errors: `{ error: string, code?: string, details?: Record<string,string> }` with proper HTTP status (401 unauthenticated, 403 forbidden/plan gate uses 402 for plan limits, 404 not found, 422 validation with `details` field map, 409 conflict, 429 rate limited). Success returns the exact shapes from src/types/index.ts. Server identity ALWAYS from session — never trust body userIds. Every workspace-scoped endpoint MUST verify membership via requireWorkspace() and capability via requireCapability().

Auth (task 2-a):
- POST /api/auth/register {name,email,password} → 201 {user, workspaces, currentWorkspaceId} (SessionUser). Creates user + personal workspace? NO — creates user only; first-run goes through onboarding. Rate-limited 10/hour.
- POST /api/auth/login {email,password} → SessionUser. Sets cookie. Rate-limited 10/15min. Generic error on bad creds (no user enumeration). 429 after limit.
- POST /api/auth/logout → {ok:true}
- GET /api/auth/me → SessionUser (user + workspaces with role counts + currentWorkspaceId from most recent membership; null-safe when signed out returns 401 — client treats as signed out) — NOTE: return 200 with `null` body instead of 401 when signed out: `ok(null)`.
- POST /api/auth/forgot-password {email} → always {ok:true} (no enumeration). Creates token. Dev mode: returns {ok:true, devToken} ONLY when NODE_ENV!=='production' so demo flow works. Documented.
- POST /api/auth/reset-password {token,password} → {ok:true}
- PATCH /api/user/profile {name?,avatarColor?,timezone?,locale?,themePref?} → PublicUser
- POST /api/user/password {currentPassword,newPassword} → {ok:true}
- GET /api/user/preferences → {userId,taskAssigned,taskMention,comments,dueSoon,invitations,billing}
- PATCH /api/user/preferences (partial same shape) → updated prefs

Workspaces (task 2-a):
- GET /api/workspaces → {workspaces: WorkspaceSummary[]} (for switcher refresh)
- POST /api/workspaces {name,slug,type,teamSize,description?} → 201 {workspace: WorkspaceDetail}. Creates workspace + OWNER membership + default labels? (no default labels needed) + FREE subscription. Validate slug unique → 409.
- GET /api/workspaces/:id → WorkspaceDetail (must be member)
- PATCH /api/workspaces/:id {name?,description?,logoColor?,timezone?} → WorkspaceDetail (cap: workspace.settings.edit)
- POST /api/workspaces/:id/archive → {ok:true} (cap workspace.archive; sets archivedAt or unarchives toggle) body {archived:boolean}
- DELETE /api/workspaces/:id → {ok:true} (OWNER only; cascades)
- POST /api/workspaces/switch {workspaceId} → SessionUser (must be member)

Members & Invitations (task 2-a):
- GET /api/workspaces/:id/members → {members: WorkspaceMemberDTO[]} with task counts (assigned/completed/open/overdue). Member-visible; emails only for same-workspace members (cap member.view_details).
- GET /api/workspaces/:id/invitations → {invitations: InvitationDTO[]} (cap member.invite)
- POST /api/workspaces/:id/invitations {email,role} → 201 InvitationDTO. Rate-limit. Checks assertCanInviteMember (402 on plan limit). Prevent duplicate: 409 if member exists or pending invite. Dev mode: no email sent; response includes {devLink} when NODE_ENV!=='production'.
- POST /api/invitations/accept {token} → SessionUser. Requires auth; email must match invitation email (case-insensitive); checks expiry → 410 GONE, revoked → 410.
- DELETE /api/workspaces/:id/invitations/:invitationId → {ok:true} (revokes; cap member.invite)
- POST /api/workspaces/:id/invitations/:invitationId/resend → InvitationDTO (extends expiry 7d)
- PATCH /api/workspaces/:id/members/:memberId {role} → WorkspaceMemberDTO (cap member.role_change; canChangeRole rules; cannot target OWNER; audit via logActivity ROLE_CHANGED)
- DELETE /api/workspaces/:id/members/:memberId → {ok:true} (cap member.remove; cannot remove OWNER; cannot remove self unless owner leaving? NO — cannot remove self; owner must transfer first; audit)

Notifications & Activity (task 2-a):
- GET /api/notifications?limit=50 → {notifications: NotificationDTO[], unread:number} (user-scoped, includes workspaceName)
- PATCH /api/notifications/:id → {ok:true} (mark read; owner = session user)
- POST /api/notifications/read-all → {ok:true}
- GET /api/workspaces/:id/activity?limit=50&cursor= → {activities: ActivityDTO[], nextCursor: string|null}

Search (task 2-a):
- GET /api/search?q=&workspaceId= → SearchResult {projects, tasks, members} scoped to workspace membership; members limited to name/email/role visibility; tasks matched on title (ILIKE-like contains, case-insensitive); limit 5 each.

Projects/Tasks/etc (task 2-b):
- GET /api/workspaces/:id/projects?status=&q=&page=&pageSize= → {projects: ProjectDTO[], total, page, pageSize} (taskCount/completedCount/memberCount/progress computed; includes ARCHIVED when status=ARCHIVED; default excludes archived)
- POST /api/workspaces/:id/projects (projectCreateSchema) → 201 ProjectDTO (cap project.create; assertCanCreateProject 402; creator becomes OWNER member + LEAD project member; logActivity)
- GET /api/projects/:id → {project: ProjectDTO, members: ProjectMemberDTO[], milestones: MilestoneDTO[]} (member of workspace)
- PATCH /api/projects/:id (projectUpdateSchema) → ProjectDTO (cap project.edit; status COMPLETED sets completedAt? no; ARCHIVED handled via archive endpoint; logActivity)
- POST /api/projects/:id/archive {archived:boolean} → ProjectDTO (cap project.archive; sets archivedAt + status ARCHIVED/ACTIVE; logActivity)
- DELETE /api/projects/:id → {ok:true} (cap project.delete; confirm required client-side; cascade deletes tasks; logActivity DELETED)
- GET /api/projects/:id/tasks?view=board|list&assignee=&priority=&label=&q=&includeDone=1 → {tasks: TaskDTO[]} (board excludes CANCELLED by default; ordered by position)
- POST /api/projects/:id/tasks (taskCreateSchema minus projectId) → 201 TaskDTO (cap task.create; validate assignee is workspace member; position = min-100 or given; notify assignee TASK_ASSIGNED; logActivity CREATED)
- GET /api/tasks/:id → {task: TaskDTO, comments: CommentDTO[], attachments: AttachmentDTO[], subtasks: TaskDTO[], dependencies: {blockedBy: TaskDTO[], blocks: TaskDTO[]}, activity: ActivityDTO[]} (workspace member only)
- PATCH /api/tasks/:id (taskUpdateSchema) → TaskDTO (MEMBER may edit if creator/assignee; PM+ edit any; validate assignee membership; STATUS→DONE sets completedAt, leaving DONE clears it; logActivity with changed fields incl. STATUS_CHANGED {from,to}, ASSIGNED {to}; notify assignee on change; notify on mention not required v1)
- DELETE /api/tasks/:id → {ok:true} (creator or PM+; logActivity DELETED)
- POST /api/tasks/reorder {taskId,status,position} → {ok:true} (cap task.edit_any OR creator/assignee; updates status+position atomically; sets/clears completedAt on DONE; used by Kanban DnD)
- POST /api/tasks/bulk (bulkTaskSchema) → {ok:true} (cap task.edit_any; delete cascades; logActivity each)
- POST /api/tasks/:id/comments {body} → 201 CommentDTO (cap task.comment; logActivity COMMENTED)
- PATCH /api/tasks/:id/comments/:commentId {body} → CommentDTO (author only)
- DELETE /api/tasks/:id/comments/:commentId → {ok:true} (author or cap task.edit_any)
- POST /api/tasks/:id/attachments (attachmentCreateSchema) → 201 AttachmentDTO (cap task.attach + assertFeature 'attachments' 402; enforce MAX_ATTACHMENT_BYTES=2MB, ALLOWED_ATTACHMENT_TYPES; store base64)
- GET /api/attachments/:id/download → binary with Content-Disposition (workspace member only)
- DELETE /api/attachments/:id → {ok:true} (uploader or cap task.edit_any)
- GET /api/workspaces/:id/labels → {labels: LabelDTO[]}
- POST /api/workspaces/:id/labels (labelCreateSchema) → 201 LabelDTO (cap label.manage + assertFeature customLabels; 409 dup name)
- PATCH /api/labels/:id → LabelDTO; DELETE /api/labels/:id → {ok:true} (cap label.manage; detaches)
- GET /api/projects/:id/milestones → {milestones: MilestoneDTO[]} (in GET /api/projects/:id too)
- POST /api/projects/:id/milestones (milestoneCreateSchema) → 201 MilestoneDTO (cap milestone.manage)
- PATCH /api/milestones/:id → MilestoneDTO; DELETE /api/milestones/:id → {ok:true}
- POST /api/tasks/:id/dependencies (dependencyCreateSchema) → 201 {dependency} (assertFeature dependencies; prevent self/circular via DFS; 409 on cycle or dup)
- DELETE /api/tasks/:id/dependencies/:depId → {ok:true}

Analytics & Billing (task 2-b):
- GET /api/workspaces/:id/dashboard → DashboardStats (exactly src/types shape; real aggregates only)
- GET /api/workspaces/:id/analytics?range=7d|30d|90d|custom&from&to → AnalyticsReport (memberAnalytics only when entitlements.advancedAnalytics; cap analytics.view_workspace)
- GET /api/workspaces/:id/calendar?from=ISO&to=ISO&assignee=&status= → {tasks: TaskDTO[], milestones: {id,name,dueDate,projectId,projectName,color,status}[]} (tasks with dueDate in range)
- GET /api/workspaces/:id/my-tasks → {tasks: TaskDTO[]} (assigned to me, open statuses first, sorted dueDate, includes overdue flag via dueDate)
- GET /api/billing/plans → {plans: PlanInfo[]}
- GET /api/workspaces/:id/subscription → SubscriptionDTO (seats=member count, usage, entitlements from constants; cap billing.view)
- POST /api/workspaces/:id/subscription {plan,interval} (billingChangeSchema) → SubscriptionDTO (cap billing.manage; TEST MODE: creates/updates subscription, creates Invoice testMode=true PAID via prisma transaction, BillingEvent PLAN_CHANGED, logActivity, notify workspace owner BILLING; downgrade to FREE keeps data, entitlements enforce limits read-only)
- POST /api/workspaces/:id/subscription/cancel → SubscriptionDTO (status CANCELLED, cancelAtPeriodEnd=true; cap billing.manage)
- POST /api/workspaces/:id/subscription/resume → SubscriptionDTO (back to ACTIVE; cap billing.manage)
- GET /api/workspaces/:id/invoices → {invoices: InvoiceDTO[]} (cap billing.view)
- POST /api/billing/webhook → {received:true} (verifies `x-nexora-signature` HMAC-SHA256 with process.env.BILLING_WEBHOOK_SECRET when set; idempotent by eventId in BillingEvent; TEST-MODE STRUCTURE ONLY — documented)

=== VIEW CONTRACT (binding) ====================================================

Each stub file must be REPLACED with a real default-export React client component ('use client'). Use ONLY: existing shadcn/ui in src/components/ui, shared primitives in src/components/shared/ui-primitives, TanStack Query (query keys from qk), api client, zustand store navigation (useAppStore().navigate/openProject/openTaskDialog), lucide icons. NO new route files. NO absolute fetch paths. Tailwind v4 tokens (bg-background etc). Dark mode must work (test both). Mobile responsive mandatory. Loading/empty/error states mandatory. All data from API — never hardcode stats.

- landing/LandingView: full marketing page per spec §6 (hero "Turn ambitious plans into exceptional results.", product preview mock, features grid, collaboration, analytics, pricing (PLANS from constants + formatPrice), FAQ (accordion), final CTA, footer with links → navigate('auth', {authMode:'register'}) etc). Header: logo, Features/Pricing links (scroll anchors), Sign in → auth login, Get started → auth register. Sticky footer bottom on short viewport (min-h-screen flex flex-col + mt-auto).
- auth/AuthView: renders based on view.authMode: login | register | forgot | reset (resetToken from view.resetToken). react-hook-form + zod-lite manual validation ok. On success: qc.setQueryData(qk.session, SessionUser) + setSession. Include demo account quick-fill buttons (owner/admin/pm/member/viewer @nexora.dev). Link back to landing. Error display from ApiError.details.
- onboarding/OnboardingView: guided workspace creation wizard (name, slug auto-slugified editable, type select, team size, intended use→description). POST /api/workspaces then qc.setQueryData(qk.session, returned SessionUser). Show sign-out option.
- dashboard/DashboardView: GET qk.dashboard(wsId) → stat cards (active projects, open, completed, overdue, my open, completed this week), upcoming deadlines list, team workload (bars), recent activity feed, charts: tasks completed over time + tasks by status + tasks by priority (recharts, use CSS vars --chart-1..5 or hex from constants). Date-range filter (7d/30d/90d) refetching analytics-lite from dashboard endpoint. Skeletons while loading.
- inbox/InboxView: full notification list with filters (all/unread), mark read, mark all, click → navigate via resourceType. Empty state "Your inbox is clear."
- my-tasks/MyTasksView: GET /api/workspaces/:id/my-tasks. Grouped sections: Overdue, Due soon (7d), Later, No due date. Row click → openTaskDialog(id). Quick status change (status badge dropdown). Empty state with CTA to projects.
- projects/ProjectsView: GET /api/workspaces/:id/projects. Toolbar: search, status filter, New project (dialog, react-hook-form; error 402 shows upgrade toast + link to billing settings). Grid of project cards (color dot, name, status badge, progress bar, task counts, members stack, due date). Card click → openProject. Include archived section (filter). Empty states per spec.
- projects/ProjectDetailView: props none; projectId from view. Header: color, name, status, priority, dates, edit dialog (PM+), archive/delete menu (perms). Tabs: Board | List | Calendar | Timeline. Board: @dnd-kit sortable columns BOARD_COLUMNS, optimistic reorder via POST /api/tasks/reorder with rollback (invalidate on error), filters (assignee, priority, label, search), per-column add task, card shows title/labels/priority/avatar/due/comments count/attachment count/blocked warning icon. List: table w/ sortable columns + inline status select. Calendar: month grid of tasks by dueDate (read; click opens dialog); PRO gate → upgrade CTA if !entitlements.calendarView (fetch subscription). Timeline: horizontal bars by startDate→dueDate grouped by assignee (PRO gate similarly). Members management dialog (project members add/remove). Milestones section.
- tasks/TaskDialog: global dialog mounted in page.tsx; taskId from store.taskDialogTaskId. GET qk.task(id). Editable: title, description, status, priority, assignee (workspace member select), due date, labels multi-select, milestone. Sections: subtasks (create/check/uncheck → PATCH), dependencies (add/remove w/ cycle error toast), attachments (upload via base64 FileReader, size/type validation, download link /api/attachments/:id/download, delete), comments (list + add + edit own + delete own/PM), activity log. Optimistic status changes. Closes on Esc/backdrop. Plan-gate errors (402) → toast w/ Upgrade action navigating settings/billing.
- calendar/CalendarView: workspace-level month/week calendar from /api/workspaces/:id/calendar; filters assignee/status; tasks + milestones dots; click → openTaskDialog; prev/next/today; PRO gate w/ upgrade CTA.
- team/TeamView: members directory (GET members + invitations): cards w/ avatar, name, role badge, email (if visible), task stats, workload; invite dialog (email+role; show devLink in dev toast); role change dropdown (canChangeRole perms); remove member (AlertDialog confirm); pending invitations list w/ revoke/resend. Empty state → invite CTA.
- reports/ReportsView: GET /api/workspaces/:id/analytics?range=. Range selector 7d/30d/90d/custom (from/to date inputs). Charts (recharts): created vs completed over time (AreaChart/LineChart), tasks by status (BarChart or PieChart), by priority (BarChart), workload by member (horizontal BarChart), project progress list (ProgressBar). KPI cards: completion rate, overdue rate, avg completion time, on-time rate. memberAnalytics table (gated: if !advancedAnalytics show upgrade card). Skeletons + empty state.
- settings/SettingsView: Tabs from view.settingsTab (profile | workspace | members | billing). Profile: name, avatar color picker (PROJECT_COLORS), timezone, locale, theme (updates /api/user/profile + setTheme), password change form, notification preferences switches. Workspace: name/desc/logo color/timezone edit (cap settings), slug display, archive toggle, danger zone delete (OWNER; AlertDialog typing name), ownership transfer (OWNER; select member). Members: link/redirect to team view content or embed invite + member mgmt (reuse team components if simpler). Billing: current plan card w/ status + usage vs limits, plan comparison grid w/ upgrade/downgrade buttons (POST subscription; test-mode notice; invoice created toast), billing interval toggle monthly/annual w/ prices, cancel/resume, invoices table (GET invoices; formatMoney). All settings enforce role visibility client-side; server enforces anyway.

=== UI/UX RULES (binding) ======================================================
- Sticky footer for landing (min-h-screen flex flex-col, footer mt-auto).
- No indigo/blue hardcoded hex outside constants (use tokens).
- Min 44px touch targets on mobile controls. No horizontal overflow. Tables → cards or scroll on mobile.
- Toast feedback on every mutation (sonner). AlertDialog for destructive ops. Optimistic updates only w/ rollback.
- Long lists: max-h + overflow-y-auto + scrollbar styling in globals.css if needed.
- Accessibility: semantic elements, aria-labels on icon buttons, focus-visible rings, keyboard DnD alternative (status select on card menu).

=== RUNTIME ====================================================================
Dev server: `bun run dev` (port 3000, logs /home/z/my-project/dev.log). Lint: `bun run lint`. DB: `bun run db:push`, seed: `bun prisma/seed.ts`. NEVER run `bun run build`. z-ai-web-dev-sdk backend-only (not needed here).
---
Task ID: 4-b
Agent: frontend-team-reports-settings-calendar
Task: Team / Reports / Settings / Calendar views (View Contract) — replace stubs with full client UIs

Work Log:
- src/components/team/members-shared.tsx (NEW): shared `TeamManager` surface used by both TeamView and Settings→Members. Members grid cards (avatar, name, email gated by member.view_details, RoleBadge, joined date, assigned/completed/open/overdue stat chips, open-tasks workload bar scaled to team max, Crown for OWNER, "You" badge). Role change DropdownMenu driven by canChangeRole+grantableRoles (OWNER target excluded; menu hidden when no legal change). Remove member via AlertDialog confirm (cap member.remove, never OWNER/self) → DELETE + invalidate members/session/subscription. InviteDialog (react-hook-form: email + role Select w/ ROLE_DESCRIPTION hints) → POST /api/workspaces/:id/invitations; 409 → inline error; 402 → upgrade toast (→ settings/billing); devLink response renders copyable-link panel with "Email delivery is not configured…" note + Copy button. Pending invitations section (cap member.invite): email, RoleBadge, PENDING/EXPIRED badge, expiry DateChip, Resend (POST …/resend) + Revoke (AlertDialog + DELETE). Search by name/email; TableSkeleton / EmptyState "Invite your team to start collaborating." / ErrorState.
- src/components/team/errors.ts (NEW): toastMutationError helper — maps ApiError 402 → sonner toast with Upgrade action navigating to settings{settingsTab:'billing'}; 422 details surfaced; used by all mutations in my four views.
- src/components/team/TeamView.tsx: header "Team" + live member count + Invite button (can member.invite); delegates to TeamManager.
- src/components/reports/ReportsView.tsx: range selector 7d/30d/90d + Custom (from/to date inputs, Apply, valid-range check) → GET /api/workspaces/:id/analytics?range=…&from&to with qk.analytics(wsId, rangeKey). KPI cards: completion rate, overdue rate, avg completion time (hours → humanized h/d), on-time rate (null → "—"); rates normalized whether server sends fraction or percent. Charts (recharts, token-styled tooltips/axes, series colors from TASK_STATUS_COLOR/PRIORITY_COLOR): Created vs completed AreaChart (merged timeseries, legend+tooltip), Tasks-by-status + Tasks-by-priority BarCharts side by side, Workload-by-member stacked horizontal BarChart (open vs completed), Project progress list (ProgressBar + completed/total, top 10). Member analytics table gated: if response omits memberAnalytics → blurred lock card "Advanced analytics is a Pro feature" + Upgrade; entitlement confirmed via qk.subscription when fetchable (billing.view roles), fallback infers from response. No-access state for roles without analytics.view_workspace; ChartSkeleton/StatCardSkeleton loading, ErrorState retry, EmptyState when no tasks in range.
- src/components/settings/SettingsView.tsx + settings/{profile,workspace,billing}-tab.tsx (NEW): Tabs (profile|workspace|members|billing) bound to view.settingsTab; onValueChange → navigate('settings',{settingsTab}) so header breadcrumb follows. PROFILE: RHF form (name, avatar color swatches from PROJECT_COLORS, timezone Select from TIMEZONES, locale en/fr/ar) → PATCH /api/user/profile + merge into qk.session user; theme RadioGroup (Light/Dark/System) → useTheme().setTheme + PATCH themePref; password change (current/new/confirm) → POST /api/user/password, fields cleared on success; notification preference switches (GET/PATCH /api/user/preferences) with per-type labels. WORKSPACE: editable form (name/description/logoColor swatches/timezone) when cap workspace.settings.edit, read-only otherwise; slug display + Copy; Archive/Unarchive AlertDialog (cap workspace.archive) → POST /api/workspaces/:id/archive; Danger zone Delete (OWNER, type-workspace-name-to-confirm) → DELETE → fresh GET /api/auth/me → setQueryData + setSession; ownership transfer rendered as "Contact support" info card (no contract endpoint — intentionally not faked). MEMBERS: reuses TeamManager (headingLevel h2). BILLING (cap billing.view gates tab; billing.manage gates buttons): current plan card (name, status badge, interval, TEST chip, renews/currentPeriodEnd via formatDateTime, cancelAtPeriodEnd note), usage vs limits bars (members/active projects, null max → ∞ + "Unlimited"), Monthly/Annual interval toggle w/ computed "N months free" savings, plan comparison grid from PLANS w/ feature checklists, Current highlighted, Upgrade/Downgrade → POST /api/workspaces/:id/subscription {plan,interval} + invalidate subscription/invoices + toast (test-mode invoice note), test-mode banner, Cancel (AlertDialog, "Cancels at period end") → POST …/cancel; Resume → POST …/resume; invoices table (number, date, plan+interval, formatMoney amount, status badge, TEST chip) in max-h-96 scroll.
- src/components/calendar/CalendarView.tsx: workspace month/week toggle, Today + prev/next, assignee (from qk.members) + status filters folded into qk.calendar cache key; GET /api/workspaces/:id/calendar?from&to&assignee&status (local-day ISO bounds). Month grid (7 cols, 6 rows): day cells with up to 3 task chips (project color dot + title → openTaskDialog), "+N more" Popover with full day list, milestone diamonds (→ openProject) with count marker, today ring, overdue chips red; week view taller cells with 6 chips. PRO gate: entitlements.calendarView from qk.subscription when fetchable; if subscription not fetchable (no billing.view) or errors, calendar renders (server enforces anyway); false → locked EmptyState with Upgrade CTA. Skeleton/error/empty ("No deadlines this month/week") states; horizontal scroll (min-w-[700px]) on small screens.
- Verification: bunx tsc --noEmit → 0 errors in team/reports/settings/calendar files; bun run lint → 0 findings in my files (remaining lint errors are in landing/onboarding/projects files owned by other tasks); dev server compile clean (GET / 200), no dev.log errors referencing my files.

Stage Summary:
- Task 4-b complete: Team, Reports, Settings, Calendar are real, contract-driven client views with role gating (can/canChangeRole/grantableRoles), 402→Upgrade-to-billing flow, AlertDialog for destructive ops, sonner toast on every mutation + qk invalidation, loading/empty/error states, dark-mode tokens, mobile responsiveness (grids stack, calendar scrolls horizontally), ≥44px mobile controls, aria labels.
- Contract gap (important): ownership transfer has NO endpoint in the API contract; per instruction the Settings→Workspace tab shows a "Contact support" card instead of calling anything. If the backend later adds POST /api/workspaces/:id/transfer-ownership (or PATCH members {role:'OWNER'}), swap the card in src/components/settings/workspace-tab.tsx.
- Notes: (1) shared member-management UI lives in src/components/team/members-shared.tsx and is imported by SettingsView per contract option A; (2) src/components/team/errors.ts is a tiny shared 402-toast helper reused by reports/settings/calendar (kept inside my owned dirs); (3) rates normalized to tolerate fraction-or-percent responses; (4) notification prefs use local query key ['user-preferences'] since qk has no preferences key; (5) PRO gates fetch qk.subscription only for billing.view roles and degrade gracefully for others.
- Follow-ups: re-run lint after tasks 3-a/3-b fix their remaining files (landing/onboarding/projects); once backend 2-a/2-b routes land, smoke-test invite devLink, billing plan switch invoice rows, and calendar milestone clicks end-to-end.

---
Task ID: 5 (integration)
Agent: main orchestrator
Task: Integrate all subagent output, fix cross-cutting bugs, verify API security model

Work Log:
- Recovered from 5/6 subagent infra timeouts; all agents had completed their work (verified file-by-file).
- Fixed directory typo in worklog display (members/[memberId] was already correct on disk — display-layer artifact strips "[m" sequences; no real corruption).
- Fixed prisma/seed.ts depPairs tuple type: [string,string][] → [string,string,string,string][].
- Fixed TaskDialog.tsx: DescriptionEditor onSave called patchMutation.mutate({description}) instead of patchTask({description}).
- Fixed seed bucket formula (taskIdx*7+i*3)%10 collapsed to constant 7 for first project → (taskIdx*7+i*2)%10; re-seeded: realistic mix per project (DONE/IN_PROGRESS/IN_REVIEW/TODO/BACKLOG/CANCELLED, 21 overdue, 11 unassigned).
- Silenced prisma per-query logging in db.ts (warn+error only).
- tsc --noEmit: clean (excluding pre-existing examples/skills errors outside app scope). bun run lint: 0 errors, 1 benign RHF warning.
- API verification (curl/bun): login/me/dashboard/projects/tasks/task-detail/reorder/analytics/subscription/invoices/notifications/search all 200 with real data. Plan gates: FREE workspace → 402 PLAN_FEATURE_LOCKED on attachments/dependencies/labels. Isolation: member sees only own workspace; member→agency 403 on projects/members/dashboard/subscription; anon 401; self-promotion 403; viewer edit/create 403.

Stage Summary:
- Backend + frontend integrated and green. Remaining: browser E2E verification (Task 6), README/.env.example (Task 7).

---
Task ID: 2-a, 2-b, 3-a, 3-b, 4-a, 4-b (completion record)
Agent: main orchestrator (on behalf of timed-out subagents)
Task: Record completed work of subagents whose Task results were lost to infra timeouts

Work Log:
- All 5 timed-out agents had actually completed their implementation before the timeout. Verification was done file-by-file + tsc + lint + curl + browser E2E.
- 2-a (auth/workspaces/members/invitations/notifications/search/user): all routes implemented incl. rate limiting, dev-mode reset tokens + invite devLinks, member task stats, canChangeRole enforcement, notification prefs.
- 2-b (projects/tasks/comments/attachments/labels/milestones/dependencies/analytics/billing): all routes implemented incl. TaskDTO mapping helper (src/app/api/projects/_lib.ts), reorder, bulk, cycle-safe dependencies, base64 attachments w/ 402 gates, dashboard/analytics aggregates, test-mode billing + invoices + webhook signature verification.
- 3-a: LandingView (930 lines + brand/product-preview/reveal), AuthView (716, demo quick-fill), OnboardingView (483, 2-step wizard).
- 3-b: DashboardView (527, stats + recharts + range filter), InboxView (240, filters + mark read), MyTasksView (476, grouped sections + inline status).
- 4-a: ProjectsView + ProjectDetailView (board w/ @dnd-kit, list, calendar, timeline, members popover, milestones, project form dialog) + TaskDialog (589, subtasks/deps/attachments/comments/activity).
- 4-b: TeamView (+members-shared reused in settings), ReportsView (611), SettingsView (+profile/workspace/billing tabs), CalendarView (425, month/week + PRO gate).

Stage Summary:
- Combined output integrated; golden path verified end-to-end in browser (see Task 6 entry).

---
Task ID: 6
Agent: main orchestrator
Task: Agent Browser end-to-end verification

Work Log:
- Landing page: hero/CTAs/product preview/pricing/FAQ/footer verified (desktop + scroll).
- Auth: demo quick-fill login → dashboard; register (new user) → onboarding wizard → workspace creation → empty-state dashboard with real zeros.
- Dashboard: stat cards + 4 charts render from live aggregates (dark + light).
- Projects: grid with real progress; project detail board/list/calendar/timeline tabs present.
- Kanban DnD: card dragged To Do → In Review; toast "Moved to In Review"; server persisted (GET verified IN_REVIEW). Status change from task dialog also verified.
- Task dialog: status/priority/assignee/due/labels controls, subtasks, dependencies (blocked-by/blocks), attachments (2MB note), comments.
- Team: 9 members w/ roles + task stats + workload; pending invitations w/ resend/revoke.
- Reports: KPIs (completion 48%, overdue 17%, avg 46.9d, on-time 100%) + created-vs-completed area chart + status/priority charts + workload.
- Settings/Billing: test-mode banner, current plan card, usage vs limits (9/15 members, 4/25 projects), plan comparison; Upgrade to Business executed → invoice NEX-… recorded (TEST chip) + toast; downgraded back to Pro.
- Calendar (workspace level): month grid w/ task chips + milestone diamonds + today ring.
- Plan gate: FREE workspace (Startup Operations) → Calendar shows "Calendar view is a Pro feature" + Upgrade.
- Dark mode toggle works (persisted). Mobile 390px: stat grid stacks, calendar horizontal scroll, drawer navigation works.
- BUG FOUND + FIXED: workspace switch didn't persist — /api/auth/me recomputed "latest membership" overriding switch. Fixed via nexora_ws httpOnly cookie set by /api/workspaces/switch and honored by buildSessionUser (membership re-verified server-side). Verified via curl + browser (switch now sticks across reloads).
- Removed nextjs-portal overlay interference during testing (dev-only, not shipped).

Stage Summary:
- All golden-path flows verified working in a real browser. Security model verified earlier via API (401/403/402 paths).

---
Task ID: 7
Agent: main orchestrator
Task: Documentation, env example, security headers, final quality gate

Work Log:
- README.md: overview, features, stack, architecture, DB model, setup, env vars, migrations, seed, demo accounts, testing note (tests omitted per platform rule; manual verification documented), billing test mode, deployment, security, limitations (SQLite, base64 attachments, no email provider, test-mode billing, ownership transfer, i18n scaffolding), roadmap.
- .env.example with placeholders (DATABASE_URL, APP_URL, BILLING_*, FILE_STORAGE_*, EMAIL_*).
- next.config.ts: global security headers (X-Frame-Options DENY, nosniff, Referrer-Policy, Permissions-Policy).
- db.ts: prisma logging reduced to warn/error.
- Deleted registration test artifacts (nora.tester@example.com + workspace).
- Final gates: bun run lint → 0 errors (1 benign RHF watch warning); tsc --noEmit → clean (excluding pre-existing examples/skills errors outside app scope); server restarted with headers, GET / → 200; final browser regression: login + dashboard OK.

Stage Summary:
- NEXORA build complete and verified. Deliverable: real, responsive, multi-tenant SaaS with persistent storage, secure auth, enforced permissions, projects/tasks/kanban, collaboration, analytics, test-mode billing, seed data, and docs.
