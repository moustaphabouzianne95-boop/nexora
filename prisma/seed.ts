/**
 * NEXORA — Database seed script
 * Creates realistic, internally consistent development data:
 * 12 users, 3 workspaces, 8 projects, 120+ tasks, labels, comments,
 * milestones, dependencies, notifications, activity logs, subscriptions.
 *
 * Run: bun prisma/seed.ts
 */
import { PrismaClient } from '@prisma/client'
import { randomBytes, scryptSync, randomUUID } from 'crypto'

const db = new PrismaClient()

const DEMO_PASSWORD = 'Demo1234!'

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, 64).toString('hex')
  return `${salt}:${hash}`
}

const now = new Date()
const DAY = 24 * 60 * 60 * 1000
const daysAgo = (n: number) => new Date(now.getTime() - n * DAY)
const daysFromNow = (n: number) => new Date(now.getTime() + n * DAY)

const PALETTE = ['#6366f1', '#8b5cf6', '#ec4899', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#ef4444', '#a855f7']

async function main() {
  console.log('Seeding NEXORA database...')
  // Cleanup in FK-safe order
  await db.taskDependency.deleteMany({})
  await db.taskLabel.deleteMany({})
  await db.attachment.deleteMany({})
  await db.comment.deleteMany({})
  await db.activityLog.deleteMany({})
  await db.notification.deleteMany({})
  await db.notificationPreference.deleteMany({})
  await db.invoice.deleteMany({})
  await db.billingEvent.deleteMany({})
  await db.subscription.deleteMany({})
  await db.milestone.deleteMany({})
  await db.projectMember.deleteMany({})
  await db.task.deleteMany({})
  await db.project.deleteMany({})
  await db.label.deleteMany({})
  await db.workspaceInvitation.deleteMany({})
  await db.workspaceMember.deleteMany({})
  await db.workspace.deleteMany({})
  await db.session.deleteMany({})
  await db.passwordResetToken.deleteMany({})
  await db.user.deleteMany({})

  // ---------------------------------------------------------------- Users
  const userDefs = [
    { email: 'owner@nexora.dev', name: 'Sarah Chen', color: '#6366f1' },
    { email: 'admin@nexora.dev', name: 'Marcus Webb', color: '#8b5cf6' },
    { email: 'pm@nexora.dev', name: 'Aisha Patel', color: '#ec4899' },
    { email: 'member@nexora.dev', name: 'Tom Becker', color: '#f97316' },
    { email: 'viewer@nexora.dev', name: 'Lena Fischer', color: '#22c55e' },
    { email: 'david@nexora.dev', name: 'David Kim', color: '#14b8a6' },
    { email: 'nina@nexora.dev', name: 'Nina Rossi', color: '#06b6d4' },
    { email: 'omar@nexora.dev', name: 'Omar Haddad', color: '#ef4444' },
    { email: 'grace@nexora.dev', name: 'Grace Okafor', color: '#a855f7' },
    { email: 'leo@nexora.dev', name: 'Leo Martins', color: '#eab308' },
    { email: 'yuki@nexora.dev', name: 'Yuki Tanaka', color: '#f43f5e' },
    { email: 'ella@nexora.dev', name: 'Ella Novak', color: '#10b981' },
  ]
  const passwordHash = hashPassword(DEMO_PASSWORD)
  const users: Record<string, { id: string; name: string; email: string }> = {}
  for (const u of userDefs) {
    const user = await db.user.create({
      data: {
        email: u.email,
        name: u.name,
        passwordHash,
        avatarColor: u.color,
        timezone: 'UTC',
        locale: 'en',
      },
    })
    users[u.email] = { id: user.id, name: user.name, email: user.email }
  }
  const U = (email: string) => users[email]
  await db.notificationPreference.createMany({
    data: userDefs.map((u) => ({ userId: U(u.email).id })),
  })

  // ------------------------------------------------------------ Workspaces
  const wsDefs = [
    { name: 'NEXORA Product Team', slug: 'nexora-product', type: 'STARTUP', teamSize: '11_50', description: 'Core product development for the NEXORA platform.', logoColor: '#6366f1', plan: 'PRO', interval: 'monthly', seats: 9 },
    { name: 'Digital Agency', slug: 'digital-agency', type: 'AGENCY', teamSize: '11_50', description: 'Client delivery teams for web, brand, and marketing engagements.', logoColor: '#ec4899', plan: 'BUSINESS', interval: 'annual', seats: 7 },
    { name: 'Startup Operations', slug: 'startup-ops', type: 'STARTUP', teamSize: '1_10', description: 'Operations, hiring, and fundraising for an early-stage startup.', logoColor: '#f97316', plan: 'FREE', interval: 'monthly', seats: 4 },
  ]
  const workspaces: Record<string, { id: string }> = {}
  const membershipsByWs: Record<string, { email: string; role: string }[]> = {
    'nexora-product': [
      { email: 'owner@nexora.dev', role: 'OWNER' },
      { email: 'admin@nexora.dev', role: 'ADMIN' },
      { email: 'pm@nexora.dev', role: 'PROJECT_MANAGER' },
      { email: 'member@nexora.dev', role: 'MEMBER' },
      { email: 'viewer@nexora.dev', role: 'VIEWER' },
      { email: 'david@nexora.dev', role: 'MEMBER' },
      { email: 'nina@nexora.dev', role: 'MEMBER' },
      { email: 'omar@nexora.dev', role: 'PROJECT_MANAGER' },
      { email: 'grace@nexora.dev', role: 'MEMBER' },
    ],
    'digital-agency': [
      { email: 'admin@nexora.dev', role: 'OWNER' },
      { email: 'nina@nexora.dev', role: 'ADMIN' },
      { email: 'pm@nexora.dev', role: 'PROJECT_MANAGER' },
      { email: 'leo@nexora.dev', role: 'MEMBER' },
      { email: 'yuki@nexora.dev', role: 'MEMBER' },
      { email: 'ella@nexora.dev', role: 'MEMBER' },
      { email: 'omar@nexora.dev', role: 'MEMBER' },
    ],
    'startup-ops': [
      { email: 'owner@nexora.dev', role: 'OWNER' },
      { email: 'grace@nexora.dev', role: 'MEMBER' },
      { email: 'david@nexora.dev', role: 'MEMBER' },
      { email: 'yuki@nexora.dev', role: 'VIEWER' },
    ],
  }

  for (const w of wsDefs) {
    const ws = await db.workspace.create({
      data: {
        name: w.name,
        slug: w.slug,
        description: w.description,
        logoColor: w.logoColor,
        type: w.type,
        teamSize: w.teamSize,
        ownerId: U(w.slug === 'digital-agency' ? 'admin@nexora.dev' : 'owner@nexora.dev').id,
        createdAt: daysAgo(120),
      },
    })
    workspaces[w.slug] = { id: ws.id }
    await db.workspaceMember.createMany({
      data: membershipsByWs[w.slug].map((m) => ({
        workspaceId: ws.id,
        userId: U(m.email).id,
        role: m.role,
        createdAt: daysAgo(100 - Math.floor(Math.random() * 60)),
      })),
    })
    const priceCents = w.plan === 'PRO' ? 1000 : w.plan === 'BUSINESS' ? 2000 : 0
    await db.subscription.create({
      data: {
        workspaceId: ws.id,
        plan: w.plan,
        status: 'ACTIVE',
        interval: w.interval,
        provider: 'test-mode',
        currentPeriodStart: daysAgo(12),
        currentPeriodEnd: w.interval === 'annual' ? daysFromNow(353) : daysFromNow(18),
      },
    })
    if (w.plan !== 'FREE') {
      await db.invoice.create({
        data: {
          workspaceId: ws.id,
          number: `NEX-${w.slug.toUpperCase().replace(/-/g, '').slice(0, 4)}-${randomUUID().slice(0, 8).toUpperCase()}`,
          amountCents: w.interval === 'annual' ? priceCents * w.seats * 12 : priceCents * w.seats,
          status: 'PAID',
          plan: w.plan,
          interval: w.interval,
          periodStart: daysAgo(12),
          periodEnd: w.interval === 'annual' ? daysFromNow(353) : daysFromNow(18),
          testMode: true,
        },
      })
      await db.billingEvent.create({
        data: {
          workspaceId: ws.id,
          type: 'PLAN_CHANGED',
          payload: JSON.stringify({ from: 'FREE', to: w.plan, testMode: true }),
        },
      })
    }
  }

  // ---------------------------------------------------------------- Labels
  const labelDefs = [
    { name: 'Bug', color: '#ef4444', description: 'Something is broken' },
    { name: 'Feature', color: '#6366f1', description: 'New functionality' },
    { name: 'Improvement', color: '#22c55e', description: 'Enhancement to existing work' },
    { name: 'Design', color: '#ec4899', description: 'UI/UX related' },
    { name: 'Urgent', color: '#f97316', description: 'Needs immediate attention' },
    { name: 'Research', color: '#06b6d4', description: 'Investigation and discovery' },
    { name: 'Tech Debt', color: '#a855f7', description: 'Refactoring and cleanup' },
    { name: 'Content', color: '#eab308', description: 'Copy and content work' },
  ]
  const labelsByWs: Record<string, Record<string, string>> = {}
  for (const slug of ['nexora-product', 'digital-agency', 'startup-ops']) {
    labelsByWs[slug] = {}
    const subset = slug === 'startup-ops' ? labelDefs.slice(1, 6) : labelDefs
    for (const l of subset) {
      const label = await db.label.create({
        data: { workspaceId: workspaces[slug].id, name: l.name, color: l.color, description: l.description },
      })
      labelsByWs[slug][l.name] = label.id
    }
  }

  // -------------------------------------------------------------- Projects
  type ProjectDef = {
    ws: string; name: string; description: string; color: string; icon: string;
    status: string; priority: string; start: number; due: number; visibility?: string;
    members: string[]; ownerEmail: string;
  }
  const projectDefs: ProjectDef[] = [
    { ws: 'nexora-product', name: 'Website Redesign', description: 'Complete overhaul of the marketing website with a new design system.', color: '#6366f1', icon: 'palette', status: 'ACTIVE', priority: 'HIGH', start: -40, due: 20, members: ['pm@nexora.dev', 'member@nexora.dev', 'david@nexora.dev', 'nina@nexora.dev'], ownerEmail: 'pm@nexora.dev' },
    { ws: 'nexora-product', name: 'Mobile App Development', description: 'Cross-platform mobile client for NEXORA with offline sync.', color: '#8b5cf6', icon: 'smartphone', status: 'ACTIVE', priority: 'URGENT', start: -60, due: 45, members: ['admin@nexora.dev', 'david@nexora.dev', 'grace@nexora.dev'], ownerEmail: 'owner@nexora.dev' },
    { ws: 'nexora-product', name: 'API Infrastructure', description: 'Scalable API gateway, rate limiting, and observability stack.', color: '#06b6d4', icon: 'server', status: 'ACTIVE', priority: 'HIGH', start: -90, due: 30, members: ['admin@nexora.dev', 'omar@nexora.dev'], ownerEmail: 'admin@nexora.dev' },
    { ws: 'nexora-product', name: 'Product Roadmap', description: 'Strategic roadmap planning and quarterly OKRs for the product team.', color: '#22c55e', icon: 'map', status: 'PLANNING', priority: 'MEDIUM', start: 5, due: 90, members: ['pm@nexora.dev', 'viewer@nexora.dev'], ownerEmail: 'owner@nexora.dev' },
    { ws: 'digital-agency', name: 'Marketing Launch', description: 'Go-to-market campaign for a client product launch across channels.', color: '#ec4899', icon: 'rocket', status: 'ACTIVE', priority: 'URGENT', start: -20, due: 14, members: ['pm@nexora.dev', 'leo@nexora.dev', 'yuki@nexora.dev'], ownerEmail: 'admin@nexora.dev' },
    { ws: 'digital-agency', name: 'Customer Portal', description: 'Self-service client portal with reporting and file exchange.', color: '#f97316', icon: 'layout-dashboard', status: 'ON_HOLD', priority: 'MEDIUM', start: -70, due: 60, members: ['ella@nexora.dev', 'omar@nexora.dev'], ownerEmail: 'admin@nexora.dev' },
    { ws: 'digital-agency', name: 'Analytics Dashboard', description: 'Campaign performance analytics dashboard for client reporting.', color: '#14b8a6', icon: 'bar-chart', status: 'ACTIVE', priority: 'HIGH', start: -30, due: 25, members: ['yuki@nexora.dev', 'leo@nexora.dev'], ownerEmail: 'nina@nexora.dev' },
    { ws: 'startup-ops', name: 'Documentation Refresh', description: 'Rewrite internal playbooks and onboarding documentation.', color: '#eab308', icon: 'book-open', status: 'ACTIVE', priority: 'LOW', start: -15, due: 40, members: ['grace@nexora.dev'], ownerEmail: 'owner@nexora.dev' },
  ]
  const projects: Record<string, { id: string; ws: string }> = {}
  for (const p of projectDefs) {
    const project = await db.project.create({
      data: {
        workspaceId: workspaces[p.ws].id,
        name: p.name,
        description: p.description,
        color: p.color,
        icon: p.icon,
        ownerId: U(p.ownerEmail).id,
        status: p.status,
        priority: p.priority,
        startDate: daysAgo(-p.start),
        dueDate: daysFromNow(p.due),
        visibility: p.visibility ?? 'WORKSPACE',
        createdAt: daysAgo(-p.start),
      },
    })
    projects[p.name] = { id: project.id, ws: p.ws }
    const memberRows = new Set(p.members)
    memberRows.add(p.ownerEmail)
    await db.projectMember.createMany({
      data: [...memberRows].map((email, i) => ({
        projectId: project.id,
        userId: U(email).id,
        role: email === p.ownerEmail ? 'LEAD' : i % 3 === 0 ? 'CONTRIBUTOR' : 'CONTRIBUTOR',
      })),
    })
  }

  // ------------------------------------------------------------ Milestones
  const milestoneDefs = [
    { project: 'Website Redesign', name: 'Design system approved', due: -10, status: 'COMPLETED' },
    { project: 'Website Redesign', name: 'Marketing pages launched', due: 8, status: 'OPEN' },
    { project: 'Website Redesign', name: 'SEO & analytics wired', due: 18, status: 'OPEN' },
    { project: 'Mobile App Development', name: 'Beta release', due: 15, status: 'OPEN' },
    { project: 'Mobile App Development', name: 'App store submission', due: 40, status: 'OPEN' },
    { project: 'API Infrastructure', name: 'Gateway migration complete', due: 12, status: 'OPEN' },
    { project: 'Marketing Launch', name: 'Campaign assets ready', due: 5, status: 'OPEN' },
    { project: 'Analytics Dashboard', name: 'First client demo', due: 10, status: 'OPEN' },
  ]
  const milestones: Record<string, string> = {}
  for (const m of milestoneDefs) {
    const ms = await db.milestone.create({
      data: {
        projectId: projects[m.project].id,
        name: m.name,
        description: `Milestone for ${m.name}`,
        dueDate: daysFromNow(m.due),
        status: m.status,
      },
    })
    milestones[m.name] = ms.id
  }

  // ----------------------------------------------------------------- Tasks
  type TaskDef = {
    project: string; title: string; description?: string; status: string; priority: string;
    assignee?: string; created: number; due?: number; estimate?: number;
    labels?: string[]; milestone?: string; parent?: string; subtasks?: number; completed?: number;
  }

  // Generate a realistic mix: completed, in-progress, upcoming, overdue, unassigned
  const taskSeed: TaskDef[] = []
  const taskTitles: Record<string, string[]> = {
    'Website Redesign': [
      'Audit current site information architecture', 'Define design tokens and color palette', 'Design hero section variants',
      'Build responsive navigation component', 'Implement pricing page layout', 'Migrate blog content to CMS',
      'Set up 301 redirects for changed URLs', 'Optimize hero images for Core Web Vitals', 'Write homepage copy',
      'Add testimonial carousel', 'Wire up contact form to backend', 'Cross-browser QA pass',
      'Dark mode support for marketing pages', 'Favicon and meta images update', 'Launch checklist review',
      'Newsletter signup integration', 'Cookie consent and privacy banner', 'Case studies section build',
      'Careers page with open roles', 'SEO metadata template rollout', 'Performance budget enforcement in CI',
    ],
    'Mobile App Development': [
      'Set up Expo project and CI pipeline', 'Design onboarding flow screens', 'Implement secure token storage',
      'Build task list screen with virtualization', 'Offline sync conflict resolution', 'Push notification integration',
      'Biometric authentication support', 'Deep linking for tasks and projects', 'Reduce cold start below 2s',
      'Crash reporting integration', 'Beta tester feedback triage', 'Accessibility audit for core flows',
      'Localization scaffolding (EN/FR/AR)', 'App icon and splash screen', 'Store listing copy',
    ],
    'API Infrastructure': [
      'Design gateway routing schema', 'Implement per-workspace rate limiting', 'Add structured request logging',
      'Set up distributed tracing', 'Postgres connection pooling tuning', 'Write API versioning policy',
      'Load test with 10k concurrent connections', 'Document error envelope format', 'Rotate internal service credentials',
      'Set up blue-green deployment', 'Webhook delivery retry mechanism', 'Audit log retention policy',
    ],
    'Product Roadmap': [
      'Collect customer feedback themes', 'Draft Q3 objectives and key results', 'Competitive analysis refresh',
      'Prioritize backlog with RICE scoring', 'Align roadmap with sales commitments', 'Publish roadmap to stakeholders',
      'Interview churned customers about gaps', 'Model pricing sensitivity scenarios', 'Define enterprise readiness criteria',
      'Review platform extension strategy', 'Assist discovery: workflow automation', 'Validate mobile-first hypotheses',
    ],
    'Marketing Launch': [
      'Finalize campaign messaging matrix', 'Produce launch video assets', 'Build landing page variants for A/B tests',
      'Coordinate influencer outreach', 'Schedule social media calendar', 'Set up conversion tracking pixels',
      'Draft press release', 'Email drip sequence copywriting', 'Post-launch performance review',
    ],
    'Customer Portal': [
      'Define portal user roles', 'Design file exchange module', 'Implement SSO with client identity providers',
      'Reporting export to CSV/PDF', 'Permission matrix review', 'Session timeout policy',
      'White-label theming for client brands', 'Notification digest settings', 'Data residency review for EU clients',
      'Onboarding checklist automation', 'Bulk invite client users', 'Audit trail for portal actions',
    ],
    'Analytics Dashboard': [
      'Define KPI taxonomy with clients', 'Build chart component library', 'Implement date-range filtering',
      'Add scheduled email reports', 'Optimize query performance for large ranges', 'Client feedback session',
      'Anomaly highlighting on trend lines', 'Export dashboard snapshots', 'Cohort retention visualization',
      'Attribution model comparison view', 'Custom metric builder prototype', 'Cache layer for expensive aggregates',
    ],
    'Documentation Refresh': [
      'Inventory existing documentation', 'Rewrite onboarding guide', 'Document workspace permissions model',
      'Create troubleshooting playbooks', 'Set up docs versioning', 'Review and publish',
      'Record walkthrough videos', 'Translate core guides to French', 'API reference examples update',
      'Style guide for technical writers', 'Feedback widget on docs pages', 'Archive outdated runbooks',
    ],
  }
  const assigneePool: Record<string, string[]> = {
    'nexora-product': ['pm@nexora.dev', 'member@nexora.dev', 'david@nexora.dev', 'nina@nexora.dev', 'omar@nexora.dev', 'grace@nexora.dev', 'owner@nexora.dev', 'admin@nexora.dev'],
    'digital-agency': ['pm@nexora.dev', 'leo@nexora.dev', 'yuki@nexora.dev', 'ella@nexora.dev', 'omar@nexora.dev', 'admin@nexora.dev', 'nina@nexora.dev'],
    'startup-ops': ['owner@nexora.dev', 'grace@nexora.dev', 'david@nexora.dev'],
  }
  const priorities = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const
  const labelPool = ['Bug', 'Feature', 'Improvement', 'Design', 'Urgent', 'Research', 'Tech Debt', 'Content']

  let taskIdx = 0
  for (const [projectName, titles] of Object.entries(taskTitles)) {
    const proj = projects[projectName]
    const pool = assigneePool[proj.ws]
    titles.forEach((title, i) => {
      taskIdx++
      // Deterministic-ish distribution across statuses
      const bucket = (taskIdx * 7 + i * 2) % 10
      let status: string
      if (bucket < 4) status = 'DONE'
      else if (bucket === 4) status = 'IN_PROGRESS'
      else if (bucket === 5) status = 'IN_REVIEW'
      else if (bucket === 6) status = 'TODO'
      else if (bucket === 7) status = 'BACKLOG'
      else if (bucket === 8) status = 'TODO'
      else status = 'CANCELLED'

      const wsDef = projectDefs.find((p) => p.name === projectName)!
      const assignee = bucket === 9 ? undefined : pool[(taskIdx + i) % pool.length]
      const isOverdueCandidate = status !== 'DONE' && status !== 'CANCELLED' && taskIdx % 6 === 3
      const due = isOverdueCandidate ? -Math.floor(2 + (taskIdx % 9)) : Math.floor(-5 + (taskIdx % 30))
      const priority = priorities[(taskIdx + i) % 4]
      const description = `${title}. ${['Owned delivery includes coordination with design and review sign-off.', 'Break work into subtasks and track progress on the board.', 'Coordinate with the team before shipping; follow the definition of done.', 'This item was prioritized during the latest planning cycle.'][taskIdx % 4]}`
      taskSeed.push({
        project: projectName,
        title,
        description,
        status,
        priority,
        assignee,
        created: Math.max(1, -wsDef.start + i),
        due,
        estimate: [1, 2, 3, 5, 8][taskIdx % 5],
        labels: taskIdx % 3 === 0 ? [labelPool[taskIdx % labelPool.length]] : taskIdx % 4 === 0 ? [labelPool[taskIdx % labelPool.length], labelPool[(taskIdx + 3) % labelPool.length]] : [],
        milestone: taskIdx % 5 === 0 ? undefined : undefined,
      })
    })
  }

  const createdTasks: { id: string; title: string; project: string; ws: string; status: string; assignee?: string; due?: number }[] = []

  for (const t of taskSeed) {
    const proj = projects[t.project]
    const wsMembership = membershipsByWs[proj.ws]
    const creatorEmail = wsMembership[0].email
    const isDone = t.status === 'DONE'
    const isCancelled = t.status === 'CANCELLED'
    const task = await db.task.create({
      data: {
        workspaceId: workspaces[proj.ws].id,
        projectId: proj.id,
        title: t.title,
        description: t.description,
        status: t.status,
        priority: t.priority,
        assigneeId: t.assignee ? U(t.assignee).id : null,
        creatorId: U(creatorEmail).id,
        startDate: daysAgo(Math.max(0, t.created - 2)),
        dueDate: t.due !== undefined ? daysFromNow(t.due) : null,
        estimatedHours: t.estimate,
        position: taskIdx * 100,
        completedAt: isDone ? daysAgo(Math.max(1, Math.floor(taskIdx % 25))) : null,
        createdAt: daysAgo(t.created),
      },
    })
    createdTasks.push({ id: task.id, title: t.title, project: t.project, ws: proj.ws, status: t.status, assignee: t.assignee, due: t.due })

    if (t.labels && t.labels.length > 0) {
      await db.taskLabel.createMany({
        data: t.labels.map((ln) => ({ taskId: task.id, labelId: labelsByWs[proj.ws][ln] })).filter((r) => r.labelId),
      })
    }
  }

  // Link some tasks to milestones
  const msLinks = [
    ['Website Redesign', 'Design hero section variants', 'Design system approved'],
    ['Website Redesign', 'Define design tokens and color palette', 'Design system approved'],
    ['Website Redesign', 'Implement pricing page layout', 'Marketing pages launched'],
    ['Mobile App Development', 'Design onboarding flow screens', 'Beta release'],
    ['Mobile App Development', 'Push notification integration', 'Beta release'],
    ['API Infrastructure', 'Design gateway routing schema', 'Gateway migration complete'],
    ['Marketing Launch', 'Produce launch video assets', 'Campaign assets ready'],
    ['Analytics Dashboard', 'Define KPI taxonomy with clients', 'First client demo'],
  ]
  for (const [proj, taskTitle, msName] of msLinks) {
    const t = createdTasks.find((x) => x.project === proj && x.title === taskTitle)
    if (t && milestones[msName]) {
      await db.task.update({ where: { id: t.id }, data: { milestoneId: milestones[msName] } })
    }
  }

  // ---------------------------------------------------------- Dependencies
  const depPairs: [string, string, string, string][] = [
    ['Website Redesign', 'Define design tokens and color palette', 'Website Redesign', 'Design hero section variants'],
    ['Website Redesign', 'Build responsive navigation component', 'Website Redesign', 'Implement pricing page layout'],
    ['Mobile App Development', 'Set up Expo project and CI pipeline', 'Mobile App Development', 'Implement secure token storage'],
    ['Mobile App Development', 'Design onboarding flow screens', 'Mobile App Development', 'Push notification integration'],
    ['API Infrastructure', 'Design gateway routing schema', 'API Infrastructure', 'Implement per-workspace rate limiting'],
    ['Marketing Launch', 'Finalize campaign messaging matrix', 'Marketing Launch', 'Build landing page variants for A/B tests'],
    ['Analytics Dashboard', 'Define KPI taxonomy with clients', 'Analytics Dashboard', 'Build chart component library'],
  ]
  for (const [pa, ta, pb, tb] of depPairs) {
    const a = createdTasks.find((x) => x.project === pa && x.title === ta)
    const b = createdTasks.find((x) => x.project === pb && x.title === tb)
    if (a && b) {
      await db.taskDependency.create({ data: { blockerTaskId: a.id, blockedTaskId: b.id } })
    }
  }

  // -------------------------------------------------------------- Comments
  const commentBodies = [
    'Picked this up — starting with the data model and I will share a draft tomorrow.',
    'Blocked until the upstream dependency ships. Flagging for the next stand-up.',
    'Design looks good to me. One note: the empty state needs a localized string.',
    'Added test coverage for the edge cases we discussed last week.',
    'QA passed on staging. Ready for review and merge.',
    'Updated the estimate after profiling; this is bigger than we thought.',
    'Sharing the latest mockups in the attachments. Feedback welcome.',
    'Nice work everyone — closing this out and moving to the release notes.',
    'Can we split this into smaller tickets? It keeps slipping across sprints.',
    'Reminder: this must land before the milestone cut-off.',
  ]
  let commentCount = 0
  const commentedTasks = createdTasks.filter((_, i) => i % 3 === 0).slice(0, 40)
  for (const t of commentedTasks) {
    const wsPool = assigneePool[t.ws]
    const nComments = 1 + (commentCount % 3)
    for (let c = 0; c < nComments; c++) {
      const author = wsPool[(commentCount + c) % wsPool.length]
      await db.comment.create({
        data: {
          taskId: t.id,
          authorId: U(author).id,
          body: commentBodies[(commentCount + c) % commentBodies.length],
          createdAt: daysAgo(Math.max(0, (commentCount % 20) - c)),
        },
      })
      commentCount++
    }
  }

  // ---------------------------------------------------------- Activity logs
  const activities: { ws: string; actor: string; resourceType: string; resourceId?: string; action: string; metadata?: string; days: number }[] = []
  createdTasks.slice(0, 60).forEach((t, i) => {
    activities.push({ ws: t.ws, actor: t.assignee ?? 'owner@nexora.dev', resourceType: 'TASK', resourceId: t.id, action: i % 4 === 0 ? 'STATUS_CHANGED' : 'CREATED', metadata: i % 4 === 0 ? JSON.stringify({ from: 'TODO', to: t.status }) : undefined, days: i % 25 })
  })
  for (const p of projectDefs) {
    activities.push({ ws: p.ws, actor: p.ownerEmail, resourceType: 'PROJECT', resourceId: projects[p.name].id, action: 'CREATED', days: -p.start })
  }
  activities.push({ ws: 'nexora-product', actor: 'owner@nexora.dev', resourceType: 'SUBSCRIPTION', action: 'PLAN_CHANGED', metadata: JSON.stringify({ from: 'FREE', to: 'PRO' }), days: 40 })
  activities.push({ ws: 'digital-agency', actor: 'admin@nexora.dev', resourceType: 'SUBSCRIPTION', action: 'PLAN_CHANGED', metadata: JSON.stringify({ from: 'PRO', to: 'BUSINESS' }), days: 60 })
  activities.push({ ws: 'nexora-product', actor: 'owner@nexora.dev', resourceType: 'MEMBER', action: 'INVITED', metadata: JSON.stringify({ email: 'grace@nexora.dev', role: 'MEMBER' }), days: 12 })
  activities.push({ ws: 'digital-agency', actor: 'admin@nexora.dev', resourceType: 'MEMBER', action: 'ROLE_CHANGED', metadata: JSON.stringify({ member: 'nina@nexora.dev', from: 'MEMBER', to: 'ADMIN' }), days: 30 })
  for (const a of activities) {
    await db.activityLog.create({
      data: {
        workspaceId: workspaces[a.ws].id,
        actorId: U(a.actor).id,
        resourceType: a.resourceType,
        resourceId: a.resourceId,
        action: a.action,
        metadata: a.metadata,
        createdAt: daysAgo(a.days),
      },
    })
  }

  // ---------------------------------------------------------- Notifications
  const notifications: { user: string; ws?: string; type: string; title: string; body: string; read: boolean; days: number }[] = [
    { user: 'member@nexora.dev', ws: 'nexora-product', type: 'TASK_ASSIGNED', title: 'You were assigned "Build responsive navigation component"', body: 'Sarah Chen assigned you a task in Website Redesign.', read: false, days: 1 },
    { user: 'member@nexora.dev', ws: 'nexora-product', type: 'COMMENT_ADDED', title: 'New comment on "Wire up contact form to backend"', body: 'Aisha Patel: QA passed on staging. Ready for review and merge.', read: false, days: 0 },
    { user: 'member@nexora.dev', ws: 'nexora-product', type: 'DUE_SOON', title: 'Task due soon: "Migrate blog content to CMS"', body: 'This task is due in 2 days.', read: true, days: 2 },
    { user: 'owner@nexora.dev', ws: 'nexora-product', type: 'OVERDUE', title: 'Overdue: "Set up 301 redirects for changed URLs"', body: 'This task is past its due date.', read: false, days: 1 },
    { user: 'owner@nexora.dev', ws: 'digital-agency', type: 'BILLING', title: 'Invoice paid — BUSINESS (annual)', body: 'Test-mode invoice NEX-DIGI processed successfully.', read: true, days: 12 },
    { user: 'admin@nexora.dev', ws: 'digital-agency', type: 'INVITATION', title: 'Leo Martins joined Digital Agency', body: 'Invitation accepted.', read: false, days: 3 },
    { user: 'pm@nexora.dev', ws: 'nexora-product', type: 'TASK_ASSIGNED', title: 'You were assigned "Write homepage copy"', body: 'Sarah Chen assigned you a task in Website Redesign.', read: true, days: 5 },
    { user: 'pm@nexora.dev', ws: 'digital-agency', type: 'PROJECT', title: 'You were added to Marketing Launch', body: 'Marcus Webb added you as a project member.', read: false, days: 4 },
    { user: 'grace@nexora.dev', ws: 'startup-ops', type: 'TASK_ASSIGNED', title: 'You were assigned "Rewrite onboarding guide"', body: 'Sarah Chen assigned you a task in Documentation Refresh.', read: false, days: 0 },
    { user: 'david@nexora.dev', ws: 'nexora-product', type: 'TASK_MENTION', title: 'You were mentioned in "Offline sync conflict resolution"', body: 'Tom Becker mentioned you in a comment.', read: false, days: 1 },
    { user: 'nina@nexora.dev', ws: 'nexora-product', type: 'COMMENT_ADDED', title: 'New comment on "Audit current site information architecture"', body: 'Omar Haddad: Updated the estimate after profiling.', read: true, days: 6 },
    { user: 'yuki@nexora.dev', ws: 'digital-agency', type: 'DUE_SOON', title: 'Task due soon: "Schedule social media calendar"', body: 'This task is due in 3 days.', read: false, days: 2 },
  ]
  for (const n of notifications) {
    await db.notification.create({
      data: {
        userId: U(n.user).id,
        workspaceId: n.ws ? workspaces[n.ws].id : null,
        type: n.type,
        title: n.title,
        body: n.body,
        read: n.read,
        createdAt: daysAgo(n.days),
      },
    })
  }

  // ---------------------------------------------------- Pending invitations
  await db.workspaceInvitation.create({
    data: {
      workspaceId: workspaces['nexora-product'].id,
      email: 'newteammate@external.dev',
      role: 'MEMBER',
      token: randomBytes(24).toString('hex'),
      status: 'PENDING',
      invitedById: U('owner@nexora.dev').id,
      expiresAt: daysFromNow(7),
    },
  })
  await db.workspaceInvitation.create({
    data: {
      workspaceId: workspaces['digital-agency'].id,
      email: 'freelancer@studio.dev',
      role: 'VIEWER',
      token: randomBytes(24).toString('hex'),
      status: 'PENDING',
      invitedById: U('admin@nexora.dev').id,
      expiresAt: daysFromNow(7),
    },
  })

  // Count summary
  const counts = {
    users: await db.user.count(),
    workspaces: await db.workspace.count(),
    projects: await db.project.count(),
    tasks: await db.task.count(),
    comments: await db.comment.count(),
    labels: await db.label.count(),
    milestones: await db.milestone.count(),
    dependencies: await db.taskDependency.count(),
    notifications: await db.notification.count(),
    activities: await db.activityLog.count(),
  }
  console.log('Seed complete:', JSON.stringify(counts, null, 2))
  console.log(`\nDemo accounts (password: ${DEMO_PASSWORD}):`)
  console.log('  owner@nexora.dev  — OWNER   (NEXORA Product Team)')
  console.log('  admin@nexora.dev  — ADMIN   (NEXORA Product Team / Owner of Digital Agency)')
  console.log('  pm@nexora.dev     — PROJECT_MANAGER')
  console.log('  member@nexora.dev — MEMBER')
  console.log('  viewer@nexora.dev — VIEWER')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await db.$disconnect()
  })
