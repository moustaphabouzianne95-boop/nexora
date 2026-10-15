-- NEXORA — Turso initialization script
-- Generated from db/custom.db (schema + demo data).
-- Generated at: 2026-10-15T18:28:15.412Z
-- Usage: turso db shell <db-name> < deploy/turso-init.sql
--        (or paste into the Turso web console → SQL editor)

PRAGMA foreign_keys=OFF;
BEGIN TRANSACTION;

CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "resourceType" TEXT NOT NULL,
    "resourceId" TEXT,
    "action" TEXT NOT NULL,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ActivityLog_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ActivityLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "uploaderId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "data" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Attachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Attachment_uploaderId_fkey" FOREIGN KEY ("uploaderId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "BillingEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "BillingEvent_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Comment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "taskId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Comment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "status" TEXT NOT NULL DEFAULT 'PAID',
    "plan" TEXT NOT NULL,
    "interval" TEXT NOT NULL,
    "periodStart" DATETIME NOT NULL,
    "periodEnd" DATETIME NOT NULL,
    "testMode" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Invoice_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Label" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Label_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Milestone_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "workspaceId" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "resourceType" TEXT,
    "resourceId" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Notification_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "NotificationPreference" (
    "userId" TEXT NOT NULL PRIMARY KEY,
    "taskAssigned" BOOLEAN NOT NULL DEFAULT true,
    "taskMention" BOOLEAN NOT NULL DEFAULT true,
    "comments" BOOLEAN NOT NULL DEFAULT true,
    "dueSoon" BOOLEAN NOT NULL DEFAULT true,
    "invitations" BOOLEAN NOT NULL DEFAULT true,
    "billing" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "PasswordResetToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "usedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Project" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT NOT NULL DEFAULT '#6366f1',
    "icon" TEXT NOT NULL DEFAULT 'folder',
    "ownerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "startDate" DATETIME,
    "dueDate" DATETIME,
    "visibility" TEXT NOT NULL DEFAULT 'WORKSPACE',
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Project_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Project_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "ProjectMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CONTRIBUTOR',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectMember_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProjectMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Session" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "token" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "interval" TEXT NOT NULL DEFAULT 'monthly',
    "provider" TEXT NOT NULL DEFAULT 'test-mode',
    "providerCustomerId" TEXT,
    "providerSubscriptionId" TEXT,
    "cancelAtPeriodEnd" BOOLEAN NOT NULL DEFAULT false,
    "currentPeriodStart" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "currentPeriodEnd" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Subscription_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "Task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'TODO',
    "priority" TEXT NOT NULL DEFAULT 'MEDIUM',
    "assigneeId" TEXT,
    "creatorId" TEXT NOT NULL,
    "startDate" DATETIME,
    "dueDate" DATETIME,
    "estimatedHours" REAL,
    "position" REAL NOT NULL DEFAULT 0,
    "parentTaskId" TEXT,
    "milestoneId" TEXT,
    "completedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Task_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Task_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Task_parentTaskId_fkey" FOREIGN KEY ("parentTaskId") REFERENCES "Task" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Task_milestoneId_fkey" FOREIGN KEY ("milestoneId") REFERENCES "Milestone" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "TaskDependency" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "blockerTaskId" TEXT NOT NULL,
    "blockedTaskId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TaskDependency_blockerTaskId_fkey" FOREIGN KEY ("blockerTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskDependency_blockedTaskId_fkey" FOREIGN KEY ("blockedTaskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "TaskLabel" (
    "taskId" TEXT NOT NULL,
    "labelId" TEXT NOT NULL,

    PRIMARY KEY ("taskId", "labelId"),
    CONSTRAINT "TaskLabel_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "TaskLabel_labelId_fkey" FOREIGN KEY ("labelId") REFERENCES "Label" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "avatarColor" TEXT NOT NULL DEFAULT '#6366f1',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "themePref" TEXT NOT NULL DEFAULT 'system',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "logoColor" TEXT NOT NULL DEFAULT '#6366f1',
    "type" TEXT NOT NULL DEFAULT 'TEAM',
    "teamSize" TEXT NOT NULL DEFAULT '1_10',
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "ownerId" TEXT NOT NULL,
    "archivedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workspace_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "WorkspaceInvitation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "invitedById" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceInvitation_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "WorkspaceMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "workspaceId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'MEMBER',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WorkspaceMember_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "Workspace" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WorkspaceMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- ActivityLog (76 rows)
INSERT INTO "ActivityLog" ("id", "workspaceId", "actorId", "resourceType", "resourceId", "action", "metadata", "createdAt") VALUES
  ('cmv2tjwrt00dcm8279andxh45', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90003m827juefdyeo', 'TASK', 'cmv2tjwlv0048m827a0ig5ym9', 'STATUS_CHANGED', '{"from":"TODO","to":"BACKLOG"}', 1791662432329),
  ('cmv2tjwru00dem827135bwlac', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0006m827ldg151yt', 'TASK', 'cmv2tjwlw004am827j2qynx82', 'CREATED', NULL, 1791576032329),
  ('cmv2tjwrv00dgm82770mowgrg', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwke0008m827o4rq4ja7', 'TASK', 'cmv2tjwlx004cm827vw4x3r9m', 'CREATED', NULL, 1791489632329),
  ('cmv2tjwrw00dim827faclizj3', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'TASK', 'cmv2tjwly004em8274tw4ricg', 'CREATED', NULL, 1791403232329),
  ('cmv2tjwrw00dkm827rtjo7ro2', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90003m827juefdyeo', 'TASK', 'cmv2tjwm0004gm8275yzfrdtj', 'STATUS_CHANGED', '{"from":"TODO","to":"DONE"}', 1791316832329),
  ('cmv2tjwrx00dmm827or9ni5du', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0006m827ldg151yt', 'TASK', 'cmv2tjwm0004im827rruld315', 'CREATED', NULL, 1791230432329),
  ('cmv2tjwry00dom827yw7nzko6', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwke0008m827o4rq4ja7', 'TASK', 'cmv2tjwm5004km8271epsuvxq', 'CREATED', NULL, 1791144032329),
  ('cmv2tjwrz00dqm8277abqxeav', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'TASK', 'cmv2tjwm6004mm827d6c4k20x', 'CREATED', NULL, 1791057632329),
  ('cmv2tjwrz00dsm827opxt3ay1', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'TASK', 'cmv2tjwm7004om82779guxcsq', 'STATUS_CHANGED', '{"from":"TODO","to":"CANCELLED"}', 1790971232329),
  ('cmv2tjws000dum8279q58lftu', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0006m827ldg151yt', 'TASK', 'cmv2tjwm8004qm82781haw74u', 'CREATED', NULL, 1790884832329),
  ('cmv2tjws100dwm827tyof2j3y', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwke0008m827o4rq4ja7', 'TASK', 'cmv2tjwm9004sm827ncijza3b', 'CREATED', NULL, 1790798432329),
  ('cmv2tjws100dym827bw2ttqp2', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'TASK', 'cmv2tjwma004um827biofa7de', 'CREATED', NULL, 1790712032329),
  ('cmv2tjws100e0m8272uioikrg', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90003m827juefdyeo', 'TASK', 'cmv2tjwmb004wm8273atxuhmn', 'STATUS_CHANGED', '{"from":"TODO","to":"IN_REVIEW"}', 1790625632329),
  ('cmv2tjws200e2m827taxtjsaj', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0006m827ldg151yt', 'TASK', 'cmv2tjwmc004ym827d7btjh18', 'CREATED', NULL, 1790539232329),
  ('cmv2tjws300e4m827oqp6s0ku', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwke0008m827o4rq4ja7', 'TASK', 'cmv2tjwmc0050m827cgzffbtj', 'CREATED', NULL, 1790452832329),
  ('cmv2tjws400e6m827a45cb4bo', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'TASK', 'cmv2tjwme0052m8274n0j8nvs', 'CREATED', NULL, 1790366432329),
  ('cmv2tjws400e8m827g8zis0u8', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90003m827juefdyeo', 'TASK', 'cmv2tjwmf0054m827olrskbk6', 'STATUS_CHANGED', '{"from":"TODO","to":"DONE"}', 1790280032329),
  ('cmv2tjws500eam827l1tvevt4', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0006m827ldg151yt', 'TASK', 'cmv2tjwmg0056m827ug3cr64m', 'CREATED', NULL, 1790193632329),
  ('cmv2tjws600ecm827a8jlf4ti', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'TASK', 'cmv2tjwmi0058m827uef0zf5o', 'CREATED', NULL, 1790107232329),
  ('cmv2tjwss00eem8274y7yskka', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'TASK', 'cmv2tjwmj005am827xakl4df5', 'CREATED', NULL, 1790020832329),
  ('cmv2tjwsu00egm827n310x9dn', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90003m827juefdyeo', 'TASK', 'cmv2tjwmk005cm8279nrljn5c', 'STATUS_CHANGED', '{"from":"TODO","to":"BACKLOG"}', 1789934432329),
  ('cmv2tjwsv00eim827w2dqt8or', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'TASK', 'cmv2tjwml005em827kvak5emd', 'CREATED', NULL, 1789848032329),
  ('cmv2tjwsv00ekm8273hes2515', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90002m82726cedz5f', 'TASK', 'cmv2tjwml005gm82726ecduae', 'CREATED', NULL, 1789761632329),
  ('cmv2tjwsw00emm827w8srgt6f', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0005m827i8ohmc9s', 'TASK', 'cmv2tjwmm005im827ogbluitq', 'CREATED', NULL, 1789675232329),
  ('cmv2tjwsx00eom827e8fq8csp', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkd0007m827dck2ys5e', 'TASK', 'cmv2tjwmn005km8270zde944e', 'STATUS_CHANGED', '{"from":"TODO","to":"DONE"}', 1789588832329),
  ('cmv2tjwsx00eqm827xi8zd0wb', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'TASK', 'cmv2tjwmo005mm827s7glahwa', 'CREATED', NULL, 1791662432329),
  ('cmv2tjwsy00esm8279hzvhq8c', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'TASK', 'cmv2tjwmp005om827g3czr5qd', 'CREATED', NULL, 1791576032329),
  ('cmv2tjwsz00eum8275vy9ottt', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0005m827i8ohmc9s', 'TASK', 'cmv2tjwmq005qm827lhpemxk9', 'CREATED', NULL, 1791489632329),
  ('cmv2tjwt000ewm827tkvr0ycp', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkd0007m827dck2ys5e', 'TASK', 'cmv2tjwna005sm827pxuh59xg', 'STATUS_CHANGED', '{"from":"TODO","to":"BACKLOG"}', 1791403232329),
  ('cmv2tjwt000eym82778oklnc0', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'TASK', 'cmv2tjwnb005um827sildc5lu', 'CREATED', NULL, 1791316832329),
  ('cmv2tjwt100f0m827mn8kyztb', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90002m82726cedz5f', 'TASK', 'cmv2tjwnd005wm827t15cia5w', 'CREATED', NULL, 1791230432329),
  ('cmv2tjwt200f2m827ibos56z4', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0005m827i8ohmc9s', 'TASK', 'cmv2tjwne005ym827ns5u6czf', 'CREATED', NULL, 1791144032329),
  ('cmv2tjwt200f4m827klpqzu55', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkd0007m827dck2ys5e', 'TASK', 'cmv2tjwnf0060m827b0zorb7g', 'STATUS_CHANGED', '{"from":"TODO","to":"DONE"}', 1791057632329),
  ('cmv2tjwt300f6m827361fwk6y', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'TASK', 'cmv2tjwnh0062m82731hmjn8s', 'CREATED', NULL, 1790971232329),
  ('cmv2tjwt400f8m827madp93mq', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90002m82726cedz5f', 'TASK', 'cmv2tjwnj0064m827om5ha739', 'CREATED', NULL, 1790884832329),
  ('cmv2tjwt400fam827ini7845p', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0005m827i8ohmc9s', 'TASK', 'cmv2tjwnk0066m827juz0kegv', 'CREATED', NULL, 1790798432329),
  ('cmv2tjwt500fcm827xhwb11ed', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'TASK', 'cmv2tjwnl0068m827slm31oo6', 'STATUS_CHANGED', '{"from":"TODO","to":"CANCELLED"}', 1790712032329),
  ('cmv2tjwt500fem827qd6soqxg', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'TASK', 'cmv2tjwnm006am827j2qoauaw', 'CREATED', NULL, 1790625632329),
  ('cmv2tjwt600fgm827dleubtf8', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90003m827juefdyeo', 'TASK', 'cmv2tjwnn006cm827r9nszkbc', 'CREATED', NULL, 1790539232329),
  ('cmv2tjwt700fim827xil6rks5', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0006m827ldg151yt', 'TASK', 'cmv2tjwnp006em827kasmbcru', 'CREATED', NULL, 1790452832329),
  ('cmv2tjwt700fkm827y151864y', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwke0008m827o4rq4ja7', 'TASK', 'cmv2tjwnq006gm827orustt76', 'STATUS_CHANGED', '{"from":"TODO","to":"IN_REVIEW"}', 1790366432329),
  ('cmv2tjwt800fmm827f4upfitk', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'TASK', 'cmv2tjwnr006im827q9dh2cil', 'CREATED', NULL, 1790280032329),
  ('cmv2tjwt900fom827c6gfs6js', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90003m827juefdyeo', 'TASK', 'cmv2tjwnv006km827zotvq5oi', 'CREATED', NULL, 1790193632329),
  ('cmv2tjwta00fqm827coyuknvf', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0006m827ldg151yt', 'TASK', 'cmv2tjwnw006mm8270b7oif9e', 'CREATED', NULL, 1790107232329),
  ('cmv2tjwtb00fsm82730g50en4', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwke0008m827o4rq4ja7', 'TASK', 'cmv2tjwnx006om827oxvx89cq', 'STATUS_CHANGED', '{"from":"TODO","to":"DONE"}', 1790020832329),
  ('cmv2tjwtb00fum8271sz0kqvc', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'TASK', 'cmv2tjwnz006qm827amylez6y', 'CREATED', NULL, 1789934432329),
  ('cmv2tjwtc00fwm827i43scewy', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'TASK', 'cmv2tjwnz006sm827szvlwuoi', 'CREATED', NULL, 1789848032329),
  ('cmv2tjwtc00fym827mk8ltz77', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0006m827ldg151yt', 'TASK', 'cmv2tjwo0006um827k02iwjac', 'CREATED', NULL, 1789761632329),
  ('cmv2tjwtd00g0m8276gajy4jh', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90003m827juefdyeo', 'TASK', 'cmv2tjwo2006wm827qo6xzpi0', 'STATUS_CHANGED', '{"from":"TODO","to":"DONE"}', 1789675232329),
  ('cmv2tjwte00g2m82712tfh9j7', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0006m827ldg151yt', 'TASK', 'cmv2tjwo3006ym827xdzu9x9s', 'CREATED', NULL, 1789588832329);
INSERT INTO "ActivityLog" ("id", "workspaceId", "actorId", "resourceType", "resourceId", "action", "metadata", "createdAt") VALUES
  ('cmv2tjwtf00g4m8278sbcfb9g', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwke0008m827o4rq4ja7', 'TASK', 'cmv2tjwo30070m827aekvt9nr', 'CREATED', NULL, 1791662432329),
  ('cmv2tjwtf00g6m827n0rf06nn', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'TASK', 'cmv2tjwo50072m827zmsdeh90', 'CREATED', NULL, 1791576032329),
  ('cmv2tjwtg00g8m827sbcairxf', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'TASK', 'cmv2tjwo80074m827ufofpwzq', 'STATUS_CHANGED', '{"from":"TODO","to":"CANCELLED"}', 1791489632329),
  ('cmv2tjwth00gam8273jwzbizs', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0006m827ldg151yt', 'TASK', 'cmv2tjwo90076m827kv97v6tx', 'CREATED', NULL, 1791403232329),
  ('cmv2tjwth00gcm827addt739s', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwke0008m827o4rq4ja7', 'TASK', 'cmv2tjwoa0078m827k6vnlew6', 'CREATED', NULL, 1791316832329),
  ('cmv2tjwti00gem827hetqz71c', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'TASK', 'cmv2tjwob007am827bs4c8aid', 'CREATED', NULL, 1791230432329),
  ('cmv2tjwtj00ggm8270h36yn9j', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90003m827juefdyeo', 'TASK', 'cmv2tjwoc007cm827a9ys5l4b', 'STATUS_CHANGED', '{"from":"TODO","to":"IN_REVIEW"}', 1791144032329),
  ('cmv2tjwtj00gim827dnvxs7qs', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0006m827ldg151yt', 'TASK', 'cmv2tjwoe007em827w6f9gr6w', 'CREATED', NULL, 1791057632329),
  ('cmv2tjwtk00gkm827hhlxfo6v', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwke0008m827o4rq4ja7', 'TASK', 'cmv2tjwoe007gm827fgrgyq1e', 'CREATED', NULL, 1790971232329),
  ('cmv2tjwtk00gmm827jvow7o3i', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'TASK', 'cmv2tjwof007im827xks3ii83', 'CREATED', NULL, 1790884832329),
  ('cmv2tjwtl00gom8276dfoxmy8', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90002m82726cedz5f', 'PROJECT', 'cmv2tjwlc002nm827y7yt0u45', 'CREATED', NULL, 1788206432329),
  ('cmv2tjwtm00gqm827llwc3lw3', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'PROJECT', 'cmv2tjwle002tm8277ac7puuo', 'CREATED', NULL, 1786478432329),
  ('cmv2tjwtm00gsm827gcqi9ms3', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'PROJECT', 'cmv2tjwlf002zm827w0fl3674', 'CREATED', NULL, 1783886432329),
  ('cmv2tjwtn00gum827yphxy8hd', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'PROJECT', 'cmv2tjwlg0033m827y3d1i96s', 'CREATED', NULL, 1792094432329),
  ('cmv2tjwto00gwm827jw0wgzm6', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwk80001m8273lnmx95j', 'PROJECT', 'cmv2tjwli0038m827n352kbe2', 'CREATED', NULL, 1789934432329),
  ('cmv2tjwto00gym827vw2aiamu', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwk80001m8273lnmx95j', 'PROJECT', 'cmv2tjwlk003em827snoprvvy', 'CREATED', NULL, 1785614432329),
  ('cmv2tjwtq00h0m827k2u8c61q', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwkc0006m827ldg151yt', 'PROJECT', 'cmv2tjwlm003jm827y3gpu943', 'CREATED', NULL, 1789070432329),
  ('cmv2tjwtr00h2m827i7ffvvnn', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwk60000m8279o1payok', 'PROJECT', 'cmv2tjwln003om827whg1rlwg', 'CREATED', NULL, 1790366432329),
  ('cmv2tjwts00h4m82733c0ot3o', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'SUBSCRIPTION', NULL, 'PLAN_CHANGED', '{"from":"FREE","to":"PRO"}', 1788206432329),
  ('cmv2tjwts00h6m827zx9ikqdv', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwk80001m8273lnmx95j', 'SUBSCRIPTION', NULL, 'PLAN_CHANGED', '{"from":"PRO","to":"BUSINESS"}', 1786478432329),
  ('cmv2tjwtt00h8m827fypsudif', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'MEMBER', NULL, 'INVITED', '{"email":"grace@nexora.dev","role":"MEMBER"}', 1790625632329),
  ('cmv2tjwtt00ham827sb185s3l', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwk80001m8273lnmx95j', 'MEMBER', NULL, 'ROLE_CHANGED', '{"member":"nina@nexora.dev","from":"MEMBER","to":"ADMIN"}', 1789070432329),
  ('cmv2towzu000rm8q7y74rm63q', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'TASK', 'cmv2tjwlw004am827j2qynx82', 'STATUS_CHANGED', '{"title":"Define design tokens and color palette","from":"TODO","to":"IN_PROGRESS"}', 1791662666250),
  ('cmv2tq2hz000xm8q778i4qfq6', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'TASK', 'cmv2tjwlw004am827j2qynx82', 'STATUS_CHANGED', '{"title":"Define design tokens and color palette","from":"IN_PROGRESS","to":"IN_REVIEW"}', 1791662720040),
  ('cmv2tsh8s0015m8q71ml88b8z', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'SUBSCRIPTION', 'cmv2tjwkm000dm827egw47sja', 'PLAN_CHANGED', '{"from":"PRO","to":"BUSINESS","interval":"monthly"}', 1791662832460),
  ('cmv2tss1t001fm8q73z3teqxu', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'SUBSCRIPTION', 'cmv2tjwkm000dm827egw47sja', 'PLAN_CHANGED', '{"from":"BUSINESS","to":"PRO","interval":"monthly"}', 1791662846465);

-- Attachment: no rows

-- BillingEvent (4 rows)
INSERT INTO "BillingEvent" ("id", "workspaceId", "type", "payload", "createdAt") VALUES
  ('cmv2tjwkr000sm827e41smt00', 'cmv2tjwkm000dm827egw47sja', 'PLAN_CHANGED', '{"from":"FREE","to":"PRO","testMode":true}', 1791662432427),
  ('cmv2tjwku0017m827iar81avr', 'cmv2tjwkr000um827cq3g0pae', 'PLAN_CHANGED', '{"from":"FREE","to":"BUSINESS","testMode":true}', 1791662432431),
  ('cmv2tsh8p0013m8q7x8xuii1t', 'cmv2tjwkm000dm827egw47sja', 'PLAN_CHANGED', '{"from":"PRO","to":"BUSINESS","interval":"monthly","seats":9,"actorId":"cmv2tjwk60000m8279o1payok"}', 1791662832458),
  ('cmv2tss1r001dm8q7kn2f6fe1', 'cmv2tjwkm000dm827egw47sja', 'PLAN_CHANGED', '{"from":"BUSINESS","to":"PRO","interval":"monthly","seats":9,"actorId":"cmv2tjwk60000m8279o1payok"}', 1791662846463);

-- Comment (52 rows)
INSERT INTO "Comment" ("id", "taskId", "authorId", "body", "createdAt", "updatedAt") VALUES
  ('cmv2tjwqy00agm827pxfn15py', 'cmv2tjwlv0048m827a0ig5ym9', 'cmv2tjwk90002m82726cedz5f', 'Picked this up — starting with the data model and I will share a draft tomorrow.', 1791662432329, 1791662432650),
  ('cmv2tjwqy00aim8271sr7uxx0', 'cmv2tjwly004em8274tw4ricg', 'cmv2tjwk90003m827juefdyeo', 'Blocked until the upstream dependency ships. Flagging for the next stand-up.', 1791576032329, 1791662432651),
  ('cmv2tjwqz00akm8273iuvbcyo', 'cmv2tjwly004em8274tw4ricg', 'cmv2tjwkc0006m827ldg151yt', 'Added test coverage for the edge cases we discussed last week.', 1791576032329, 1791662432652),
  ('cmv2tjwr000amm8276eobra9f', 'cmv2tjwm5004km8271epsuvxq', 'cmv2tjwkc0006m827ldg151yt', 'Added test coverage for the edge cases we discussed last week.', 1791403232329, 1791662432652),
  ('cmv2tjwr000aom827iqpzetxq', 'cmv2tjwm8004qm82781haw74u', 'cmv2tjwkd0007m827dck2ys5e', 'QA passed on staging. Ready for review and merge.', 1791316832329, 1791662432653),
  ('cmv2tjwr000aqm827k43wyejo', 'cmv2tjwm8004qm82781haw74u', 'cmv2tjwk60000m8279o1payok', 'Sharing the latest mockups in the attachments. Feedback welcome.', 1791316832329, 1791662432653),
  ('cmv2tjwr100asm827xkpy5p1f', 'cmv2tjwmb004wm8273atxuhmn', 'cmv2tjwk60000m8279o1payok', 'Sharing the latest mockups in the attachments. Feedback welcome.', 1791144032329, 1791662432653),
  ('cmv2tjwr200aum827yx8sqngb', 'cmv2tjwme0052m8274n0j8nvs', 'cmv2tjwk80001m8273lnmx95j', 'Nice work everyone — closing this out and moving to the release notes.', 1791057632329, 1791662432654),
  ('cmv2tjwr200awm827dnxux42z', 'cmv2tjwme0052m8274n0j8nvs', 'cmv2tjwk90003m827juefdyeo', 'Reminder: this must land before the milestone cut-off.', 1791057632329, 1791662432655),
  ('cmv2tjwr300aym827sa8onl43', 'cmv2tjwmi0058m827uef0zf5o', 'cmv2tjwk90003m827juefdyeo', 'Reminder: this must land before the milestone cut-off.', 1790884832329, 1791662432655),
  ('cmv2tjwr300b0m827x6cm7l0e', 'cmv2tjwml005em827kvak5emd', 'cmv2tjwkc0005m827i8ohmc9s', 'Picked this up — starting with the data model and I will share a draft tomorrow.', 1790798432329, 1791662432656),
  ('cmv2tjwr400b2m8279usidxw8', 'cmv2tjwml005em827kvak5emd', 'cmv2tjwkd0007m827dck2ys5e', 'Design looks good to me. One note: the empty state needs a localized string.', 1790798432329, 1791662432656),
  ('cmv2tjwr400b4m827esvm6nlm', 'cmv2tjwmn005km8270zde944e', 'cmv2tjwkd0007m827dck2ys5e', 'Design looks good to me. One note: the empty state needs a localized string.', 1790625632329, 1791662432657),
  ('cmv2tjwr500b6m827u7fd8oza', 'cmv2tjwmq005qm827lhpemxk9', 'cmv2tjwke0008m827o4rq4ja7', 'Added test coverage for the edge cases we discussed last week.', 1790539232329, 1791662432657),
  ('cmv2tjwr500b8m827wf343x9e', 'cmv2tjwmq005qm827lhpemxk9', 'cmv2tjwk80001m8273lnmx95j', 'Updated the estimate after profiling; this is bigger than we thought.', 1790539232329, 1791662432658),
  ('cmv2tjwr600bam8275bd6sjdp', 'cmv2tjwnd005wm827t15cia5w', 'cmv2tjwk80001m8273lnmx95j', 'Updated the estimate after profiling; this is bigger than we thought.', 1790366432329, 1791662432658),
  ('cmv2tjwr700bcm827lhpppgfi', 'cmv2tjwnh0062m82731hmjn8s', 'cmv2tjwk90002m82726cedz5f', 'Sharing the latest mockups in the attachments. Feedback welcome.', 1790280032329, 1791662432659),
  ('cmv2tjwr800bem82706dsulgd', 'cmv2tjwnh0062m82731hmjn8s', 'cmv2tjwkc0005m827i8ohmc9s', 'Can we split this into smaller tickets? It keeps slipping across sprints.', 1790280032329, 1791662432660),
  ('cmv2tjwr800bgm827oj7cxtjw', 'cmv2tjwnl0068m827slm31oo6', 'cmv2tjwkc0005m827i8ohmc9s', 'Can we split this into smaller tickets? It keeps slipping across sprints.', 1790107232329, 1791662432661),
  ('cmv2tjwr900bim827pkxz33gp', 'cmv2tjwnp006em827kasmbcru', 'cmv2tjwkc0006m827ldg151yt', 'Reminder: this must land before the milestone cut-off.', 1790020832329, 1791662432661),
  ('cmv2tjwr900bkm827m4pe9xeq', 'cmv2tjwnp006em827kasmbcru', 'cmv2tjwke0008m827o4rq4ja7', 'Blocked until the upstream dependency ships. Flagging for the next stand-up.', 1791662432329, 1791662432662),
  ('cmv2tjwra00bmm827m8teqbfv', 'cmv2tjwnv006km827zotvq5oi', 'cmv2tjwke0008m827o4rq4ja7', 'Blocked until the upstream dependency ships. Flagging for the next stand-up.', 1791576032329, 1791662432662),
  ('cmv2tjwrb00bom827lntesctc', 'cmv2tjwnz006qm827amylez6y', 'cmv2tjwk60000m8279o1payok', 'Design looks good to me. One note: the empty state needs a localized string.', 1791489632329, 1791662432663),
  ('cmv2tjwrc00bqm827dkqgc7gd', 'cmv2tjwnz006qm827amylez6y', 'cmv2tjwk90002m82726cedz5f', 'QA passed on staging. Ready for review and merge.', 1791489632329, 1791662432664),
  ('cmv2tjwrc00bsm827fttsjq5c', 'cmv2tjwo2006wm827qo6xzpi0', 'cmv2tjwk90002m82726cedz5f', 'QA passed on staging. Ready for review and merge.', 1791316832329, 1791662432665),
  ('cmv2tjwre00bum827ap18jtcj', 'cmv2tjwo50072m827zmsdeh90', 'cmv2tjwk90003m827juefdyeo', 'Updated the estimate after profiling; this is bigger than we thought.', 1791230432329, 1791662432666),
  ('cmv2tjwrf00bwm827l5hte99o', 'cmv2tjwo50072m827zmsdeh90', 'cmv2tjwkc0006m827ldg151yt', 'Nice work everyone — closing this out and moving to the release notes.', 1791230432329, 1791662432667),
  ('cmv2tjwrf00bym827bnbmy632', 'cmv2tjwoa0078m827k6vnlew6', 'cmv2tjwkc0006m827ldg151yt', 'Nice work everyone — closing this out and moving to the release notes.', 1791057632329, 1791662432668),
  ('cmv2tjwrg00c0m827n2vlsacz', 'cmv2tjwoe007em827w6f9gr6w', 'cmv2tjwkd0007m827dck2ys5e', 'Can we split this into smaller tickets? It keeps slipping across sprints.', 1790971232329, 1791662432668),
  ('cmv2tjwrh00c2m827k1xyrwom', 'cmv2tjwoe007em827w6f9gr6w', 'cmv2tjwk60000m8279o1payok', 'Picked this up — starting with the data model and I will share a draft tomorrow.', 1790971232329, 1791662432669),
  ('cmv2tjwrh00c4m827xrhx6riz', 'cmv2tjwog007km8277jkeoq4n', 'cmv2tjwkg000am8272maeb2rl', 'Picked this up — starting with the data model and I will share a draft tomorrow.', 1790798432329, 1791662432670),
  ('cmv2tjwri00c6m827sar7h9gq', 'cmv2tjwoj007qm827ny06emrv', 'cmv2tjwki000bm827ik6vg12b', 'Blocked until the upstream dependency ships. Flagging for the next stand-up.', 1790712032329, 1791662432670),
  ('cmv2tjwri00c8m8270fr3ry64', 'cmv2tjwoj007qm827ny06emrv', 'cmv2tjwk80001m8273lnmx95j', 'Added test coverage for the edge cases we discussed last week.', 1790712032329, 1791662432671),
  ('cmv2tjwrj00cam8275sxr9g5s', 'cmv2tjwoo007wm827637h7l09', 'cmv2tjwk80001m8273lnmx95j', 'Added test coverage for the edge cases we discussed last week.', 1790539232329, 1791662432671),
  ('cmv2tjwrj00ccm827vypz2zjp', 'cmv2tjwos0082m827owziy8kd', 'cmv2tjwkc0006m827ldg151yt', 'QA passed on staging. Ready for review and merge.', 1790452832329, 1791662432672),
  ('cmv2tjwrk00cem8279noy499n', 'cmv2tjwos0082m827owziy8kd', 'cmv2tjwkf0009m827qopjy2j0', 'Sharing the latest mockups in the attachments. Feedback welcome.', 1790452832329, 1791662432672),
  ('cmv2tjwrl00cgm827edv78jar', 'cmv2tjwov0088m827nficsouw', 'cmv2tjwkf0009m827qopjy2j0', 'Sharing the latest mockups in the attachments. Feedback welcome.', 1790280032329, 1791662432673),
  ('cmv2tjwrl00cim827qk4wrm3j', 'cmv2tjwoy008em827g3dxf53c', 'cmv2tjwkg000am8272maeb2rl', 'Nice work everyone — closing this out and moving to the release notes.', 1790193632329, 1791662432673),
  ('cmv2tjwrl00ckm827podx390v', 'cmv2tjwoy008em827g3dxf53c', 'cmv2tjwkd0007m827dck2ys5e', 'Reminder: this must land before the milestone cut-off.', 1790193632329, 1791662432674),
  ('cmv2tjwrm00cmm827x37jzmxr', 'cmv2tjwp2008km827q5mo6nt0', 'cmv2tjwkd0007m827dck2ys5e', 'Reminder: this must land before the milestone cut-off.', 1790020832329, 1791662432674),
  ('cmv2tjwrm00com8273okpxe67', 'cmv2tjwp6008qm8279esbiugk', 'cmv2tjwk80001m8273lnmx95j', 'Picked this up — starting with the data model and I will share a draft tomorrow.', 1791662432329, 1791662432674),
  ('cmv2tjwrm00cqm8270gh0uqj9', 'cmv2tjwp6008qm8279esbiugk', 'cmv2tjwk90002m82726cedz5f', 'Design looks good to me. One note: the empty state needs a localized string.', 1791662432329, 1791662432675),
  ('cmv2tjwrn00csm827jlqehrqu', 'cmv2tjwpa008wm827olxm2rgy', 'cmv2tjwk90002m82726cedz5f', 'Design looks good to me. One note: the empty state needs a localized string.', 1791489632329, 1791662432675),
  ('cmv2tjwro00cum827vpkh3o68', 'cmv2tjwpd0092m82716oq4u7n', 'cmv2tjwkf0009m827qopjy2j0', 'Added test coverage for the edge cases we discussed last week.', 1791403232329, 1791662432676),
  ('cmv2tjwro00cwm8274b11hze8', 'cmv2tjwpd0092m82716oq4u7n', 'cmv2tjwki000bm827ik6vg12b', 'Updated the estimate after profiling; this is bigger than we thought.', 1791403232329, 1791662432677),
  ('cmv2tjwrp00cym827jg83yzvc', 'cmv2tjwph0098m827d1jmizyn', 'cmv2tjwki000bm827ik6vg12b', 'Updated the estimate after profiling; this is bigger than we thought.', 1791230432329, 1791662432677),
  ('cmv2tjwrq00d0m827qax1598b', 'cmv2tjwq5009em827q5616e4v', 'cmv2tjwke0008m827o4rq4ja7', 'Sharing the latest mockups in the attachments. Feedback welcome.', 1791144032329, 1791662432678),
  ('cmv2tjwrq00d2m827m3c81c6c', 'cmv2tjwq5009em827q5616e4v', 'cmv2tjwk60000m8279o1payok', 'Can we split this into smaller tickets? It keeps slipping across sprints.', 1791144032329, 1791662432679),
  ('cmv2tjwrr00d4m82749tcj4ez', 'cmv2tjwq9009km827cw8t2sp2', 'cmv2tjwk60000m8279o1payok', 'Can we split this into smaller tickets? It keeps slipping across sprints.', 1790971232329, 1791662432679),
  ('cmv2tjwrr00d6m827047gvx6p', 'cmv2tjwqc009qm827vl5x9mf3', 'cmv2tjwke0008m827o4rq4ja7', 'Reminder: this must land before the milestone cut-off.', 1790884832329, 1791662432679);
INSERT INTO "Comment" ("id", "taskId", "authorId", "body", "createdAt", "updatedAt") VALUES
  ('cmv2tjwrr00d8m827qn5vlk6j', 'cmv2tjwqc009qm827vl5x9mf3', 'cmv2tjwk60000m8279o1payok', 'Blocked until the upstream dependency ships. Flagging for the next stand-up.', 1790884832329, 1791662432680),
  ('cmv2tjwrs00dam827rvbllvr6', 'cmv2tjwqf009wm827imsjmg86', 'cmv2tjwk60000m8279o1payok', 'Blocked until the upstream dependency ships. Flagging for the next stand-up.', 1790712032329, 1791662432681);

-- Invoice (4 rows)
INSERT INTO "Invoice" ("id", "workspaceId", "number", "amountCents", "currency", "status", "plan", "interval", "periodStart", "periodEnd", "testMode", "createdAt") VALUES
  ('cmv2tjwkq000qm827q8og6cyz', 'cmv2tjwkm000dm827egw47sja', 'NEX-NEXO-AAD5DF43', 9000, 'USD', 'PAID', 'PRO', 'monthly', 1790625632329, 1793217632329, 1, 1791662432426),
  ('cmv2tjwku0015m827fk23i47g', 'cmv2tjwkr000um827cq3g0pae', 'NEX-DIGI-CC10866C', 168000, 'USD', 'PAID', 'BUSINESS', 'annual', 1790625632329, 1822161632329, 1, 1791662432430),
  ('cmv2tsh8o0011m8q7zf4xvptw', 'cmv2tjwkm000dm827egw47sja', 'NEX-MV2TSH8N', 18000, 'USD', 'PAID', 'BUSINESS', 'monthly', 1791662832451, 1794254832451, 1, 1791662832456),
  ('cmv2tss1p001bm8q72eoxehln', 'cmv2tjwkm000dm827egw47sja', 'NEX-MV2TSS1P', 9000, 'USD', 'PAID', 'PRO', 'monthly', 1791662846457, 1794254846457, 1, 1791662846462);

-- Label (21 rows)
INSERT INTO "Label" ("id", "workspaceId", "name", "color", "description", "createdAt") VALUES
  ('cmv2tjwkx001hm827tn9k0sep', 'cmv2tjwkm000dm827egw47sja', 'Bug', '#ef4444', 'Something is broken', 1791662432433),
  ('cmv2tjwky001jm827ytoj47y5', 'cmv2tjwkm000dm827egw47sja', 'Feature', '#6366f1', 'New functionality', 1791662432434),
  ('cmv2tjwky001lm827zf8hv7q0', 'cmv2tjwkm000dm827egw47sja', 'Improvement', '#22c55e', 'Enhancement to existing work', 1791662432435),
  ('cmv2tjwkz001nm827aj39jsve', 'cmv2tjwkm000dm827egw47sja', 'Design', '#ec4899', 'UI/UX related', 1791662432436),
  ('cmv2tjwl0001pm827tgk4elfd', 'cmv2tjwkm000dm827egw47sja', 'Urgent', '#f97316', 'Needs immediate attention', 1791662432437),
  ('cmv2tjwl1001rm827hyktglqv', 'cmv2tjwkm000dm827egw47sja', 'Research', '#06b6d4', 'Investigation and discovery', 1791662432437),
  ('cmv2tjwl1001tm827xkts3brc', 'cmv2tjwkm000dm827egw47sja', 'Tech Debt', '#a855f7', 'Refactoring and cleanup', 1791662432438),
  ('cmv2tjwl2001vm827v7c4zcwb', 'cmv2tjwkm000dm827egw47sja', 'Content', '#eab308', 'Copy and content work', 1791662432438),
  ('cmv2tjwl3001xm827bo12takr', 'cmv2tjwkr000um827cq3g0pae', 'Bug', '#ef4444', 'Something is broken', 1791662432439),
  ('cmv2tjwl3001zm8273wbcyk8b', 'cmv2tjwkr000um827cq3g0pae', 'Feature', '#6366f1', 'New functionality', 1791662432440),
  ('cmv2tjwl40021m827nrquaeqr', 'cmv2tjwkr000um827cq3g0pae', 'Improvement', '#22c55e', 'Enhancement to existing work', 1791662432440),
  ('cmv2tjwl50023m8274car4sd7', 'cmv2tjwkr000um827cq3g0pae', 'Design', '#ec4899', 'UI/UX related', 1791662432442),
  ('cmv2tjwl60025m827wpu3k6oy', 'cmv2tjwkr000um827cq3g0pae', 'Urgent', '#f97316', 'Needs immediate attention', 1791662432442),
  ('cmv2tjwl60027m8278k15a9ri', 'cmv2tjwkr000um827cq3g0pae', 'Research', '#06b6d4', 'Investigation and discovery', 1791662432443),
  ('cmv2tjwl70029m827kroq0zcb', 'cmv2tjwkr000um827cq3g0pae', 'Tech Debt', '#a855f7', 'Refactoring and cleanup', 1791662432443),
  ('cmv2tjwl8002bm827ry0gf9d9', 'cmv2tjwkr000um827cq3g0pae', 'Content', '#eab308', 'Copy and content work', 1791662432444),
  ('cmv2tjwl9002dm827ezrlv2ls', 'cmv2tjwkv0019m827a7g7rrgs', 'Feature', '#6366f1', 'New functionality', 1791662432445),
  ('cmv2tjwla002fm827u48h00v4', 'cmv2tjwkv0019m827a7g7rrgs', 'Improvement', '#22c55e', 'Enhancement to existing work', 1791662432446),
  ('cmv2tjwlb002hm827fmmou3yn', 'cmv2tjwkv0019m827a7g7rrgs', 'Design', '#ec4899', 'UI/UX related', 1791662432447),
  ('cmv2tjwlb002jm82796b9g706', 'cmv2tjwkv0019m827a7g7rrgs', 'Urgent', '#f97316', 'Needs immediate attention', 1791662432448),
  ('cmv2tjwlc002lm827iv01hsku', 'cmv2tjwkv0019m827a7g7rrgs', 'Research', '#06b6d4', 'Investigation and discovery', 1791662432448);

-- Milestone (8 rows)
INSERT INTO "Milestone" ("id", "projectId", "name", "description", "dueDate", "status", "createdAt") VALUES
  ('cmv2tjwlo003sm827jsoc6b6f', 'cmv2tjwlc002nm827y7yt0u45', 'Design system approved', 'Milestone for Design system approved', 1790798432329, 'COMPLETED', 1791662432461),
  ('cmv2tjwlq003um827mzlgyeq6', 'cmv2tjwlc002nm827y7yt0u45', 'Marketing pages launched', 'Milestone for Marketing pages launched', 1792353632329, 'OPEN', 1791662432462),
  ('cmv2tjwlq003wm827t30byv5f', 'cmv2tjwlc002nm827y7yt0u45', 'SEO & analytics wired', 'Milestone for SEO & analytics wired', 1793217632329, 'OPEN', 1791662432463),
  ('cmv2tjwlr003ym827tluk5ypn', 'cmv2tjwle002tm8277ac7puuo', 'Beta release', 'Milestone for Beta release', 1792958432329, 'OPEN', 1791662432464),
  ('cmv2tjwls0040m827f1si971p', 'cmv2tjwle002tm8277ac7puuo', 'App store submission', 'Milestone for App store submission', 1795118432329, 'OPEN', 1791662432464),
  ('cmv2tjwls0042m827qmt3u272', 'cmv2tjwlf002zm827w0fl3674', 'Gateway migration complete', 'Milestone for Gateway migration complete', 1792699232329, 'OPEN', 1791662432465),
  ('cmv2tjwlt0044m82716ufwot5', 'cmv2tjwli0038m827n352kbe2', 'Campaign assets ready', 'Milestone for Campaign assets ready', 1792094432329, 'OPEN', 1791662432465),
  ('cmv2tjwlu0046m82714937tem', 'cmv2tjwlm003jm827y3gpu943', 'First client demo', 'Milestone for First client demo', 1792526432329, 'OPEN', 1791662432466);

-- Notification (14 rows)
INSERT INTO "Notification" ("id", "userId", "workspaceId", "type", "title", "body", "resourceType", "resourceId", "read", "createdAt") VALUES
  ('cmv2tjwtu00hcm827wy1aerms', 'cmv2tjwk90003m827juefdyeo', 'cmv2tjwkm000dm827egw47sja', 'TASK_ASSIGNED', 'You were assigned "Build responsive navigation component"', 'Sarah Chen assigned you a task in Website Redesign.', NULL, NULL, 0, 1791576032329),
  ('cmv2tjwtv00hem8279zzq45io', 'cmv2tjwk90003m827juefdyeo', 'cmv2tjwkm000dm827egw47sja', 'COMMENT_ADDED', 'New comment on "Wire up contact form to backend"', 'Aisha Patel: QA passed on staging. Ready for review and merge.', NULL, NULL, 0, 1791662432329),
  ('cmv2tjwtw00hgm827ngdxgyxf', 'cmv2tjwk90003m827juefdyeo', 'cmv2tjwkm000dm827egw47sja', 'DUE_SOON', 'Task due soon: "Migrate blog content to CMS"', 'This task is due in 2 days.', NULL, NULL, 1, 1791489632329),
  ('cmv2tjwtx00him8273wa5pj2l', 'cmv2tjwk60000m8279o1payok', 'cmv2tjwkm000dm827egw47sja', 'OVERDUE', 'Overdue: "Set up 301 redirects for changed URLs"', 'This task is past its due date.', NULL, NULL, 0, 1791576032329),
  ('cmv2tjwtx00hkm82732a1zj4g', 'cmv2tjwk60000m8279o1payok', 'cmv2tjwkr000um827cq3g0pae', 'BILLING', 'Invoice paid — BUSINESS (annual)', 'Test-mode invoice NEX-DIGI processed successfully.', NULL, NULL, 1, 1790625632329),
  ('cmv2tjwty00hmm827yrnkbp04', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwkr000um827cq3g0pae', 'INVITATION', 'Leo Martins joined Digital Agency', 'Invitation accepted.', NULL, NULL, 0, 1791403232329),
  ('cmv2tjwtz00hom827e1u3ikgp', 'cmv2tjwk90002m82726cedz5f', 'cmv2tjwkm000dm827egw47sja', 'TASK_ASSIGNED', 'You were assigned "Write homepage copy"', 'Sarah Chen assigned you a task in Website Redesign.', NULL, NULL, 1, 1791230432329),
  ('cmv2tjwu000hqm827wlnxucgb', 'cmv2tjwk90002m82726cedz5f', 'cmv2tjwkr000um827cq3g0pae', 'PROJECT', 'You were added to Marketing Launch', 'Marcus Webb added you as a project member.', NULL, NULL, 0, 1791316832329),
  ('cmv2tjwu000hsm827wfqmk6xr', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwkv0019m827a7g7rrgs', 'TASK_ASSIGNED', 'You were assigned "Rewrite onboarding guide"', 'Sarah Chen assigned you a task in Documentation Refresh.', NULL, NULL, 0, 1791662432329),
  ('cmv2tjwu100hum8271sroh0pn', 'cmv2tjwkc0005m827i8ohmc9s', 'cmv2tjwkm000dm827egw47sja', 'TASK_MENTION', 'You were mentioned in "Offline sync conflict resolution"', 'Tom Becker mentioned you in a comment.', NULL, NULL, 0, 1791576032329),
  ('cmv2tjwu200hwm827yltxafwu', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwkm000dm827egw47sja', 'COMMENT_ADDED', 'New comment on "Audit current site information architecture"', 'Omar Haddad: Updated the estimate after profiling.', NULL, NULL, 1, 1791144032329),
  ('cmv2tjwu300hym8270v3716s9', 'cmv2tjwkg000am8272maeb2rl', 'cmv2tjwkr000um827cq3g0pae', 'DUE_SOON', 'Task due soon: "Schedule social media calendar"', 'This task is due in 3 days.', NULL, NULL, 0, 1791489632329),
  ('cmv2tsh8y0017m8q7pw87lv9o', 'cmv2tjwk60000m8279o1payok', 'cmv2tjwkm000dm827egw47sja', 'BILLING', 'Subscription updated', 'NEXORA Product Team is now on the BUSINESS plan (monthly).', 'SUBSCRIPTION', 'cmv2tjwkm000dm827egw47sja', 0, 1791662832467),
  ('cmv2tss1x001hm8q78a64hai8', 'cmv2tjwk60000m8279o1payok', 'cmv2tjwkm000dm827egw47sja', 'BILLING', 'Subscription updated', 'NEXORA Product Team is now on the PRO plan (monthly).', 'SUBSCRIPTION', 'cmv2tjwkm000dm827egw47sja', 0, 1791662846470);

-- NotificationPreference (12 rows)
INSERT INTO "NotificationPreference" ("userId", "taskAssigned", "taskMention", "comments", "dueSoon", "invitations", "billing", "updatedAt") VALUES
  ('cmv2tjwk60000m8279o1payok', 1, 1, 1, 1, 1, 1, 1791662432421),
  ('cmv2tjwk80001m8273lnmx95j', 1, 1, 1, 1, 1, 1, 1791662432421),
  ('cmv2tjwk90002m82726cedz5f', 1, 1, 1, 1, 1, 1, 1791662432421),
  ('cmv2tjwk90003m827juefdyeo', 1, 1, 1, 1, 1, 1, 1791662432421),
  ('cmv2tjwkb0004m827hbdryg5t', 1, 1, 1, 1, 1, 1, 1791662432421),
  ('cmv2tjwkc0005m827i8ohmc9s', 1, 1, 1, 1, 1, 1, 1791662432421),
  ('cmv2tjwkc0006m827ldg151yt', 1, 1, 1, 1, 1, 1, 1791662432421),
  ('cmv2tjwkd0007m827dck2ys5e', 1, 1, 1, 1, 1, 1, 1791662432421),
  ('cmv2tjwke0008m827o4rq4ja7', 1, 1, 1, 1, 1, 1, 1791662432421),
  ('cmv2tjwkf0009m827qopjy2j0', 1, 1, 1, 1, 1, 1, 1791662432421),
  ('cmv2tjwkg000am8272maeb2rl', 1, 1, 1, 1, 1, 1, 1791662432421),
  ('cmv2tjwki000bm827ik6vg12b', 1, 1, 1, 1, 1, 1, 1791662432421);

-- PasswordResetToken: no rows

-- Project (8 rows)
INSERT INTO "Project" ("id", "workspaceId", "name", "description", "color", "icon", "ownerId", "status", "priority", "startDate", "dueDate", "visibility", "archivedAt", "createdAt", "updatedAt") VALUES
  ('cmv2tjwlc002nm827y7yt0u45', 'cmv2tjwkm000dm827egw47sja', 'Website Redesign', 'Complete overhaul of the marketing website with a new design system.', '#6366f1', 'palette', 'cmv2tjwk90002m82726cedz5f', 'ACTIVE', 'HIGH', 1788206432329, 1793390432329, 'WORKSPACE', NULL, 1788206432329, 1791662432449),
  ('cmv2tjwle002tm8277ac7puuo', 'cmv2tjwkm000dm827egw47sja', 'Mobile App Development', 'Cross-platform mobile client for NEXORA with offline sync.', '#8b5cf6', 'smartphone', 'cmv2tjwk60000m8279o1payok', 'ACTIVE', 'URGENT', 1786478432329, 1795550432329, 'WORKSPACE', NULL, 1786478432329, 1791662432450),
  ('cmv2tjwlf002zm827w0fl3674', 'cmv2tjwkm000dm827egw47sja', 'API Infrastructure', 'Scalable API gateway, rate limiting, and observability stack.', '#06b6d4', 'server', 'cmv2tjwk80001m8273lnmx95j', 'ACTIVE', 'HIGH', 1783886432329, 1794254432329, 'WORKSPACE', NULL, 1783886432329, 1791662432451),
  ('cmv2tjwlg0033m827y3d1i96s', 'cmv2tjwkm000dm827egw47sja', 'Product Roadmap', 'Strategic roadmap planning and quarterly OKRs for the product team.', '#22c55e', 'map', 'cmv2tjwk60000m8279o1payok', 'PLANNING', 'MEDIUM', 1792094432329, 1799438432329, 'WORKSPACE', NULL, 1792094432329, 1791662432453),
  ('cmv2tjwli0038m827n352kbe2', 'cmv2tjwkr000um827cq3g0pae', 'Marketing Launch', 'Go-to-market campaign for a client product launch across channels.', '#ec4899', 'rocket', 'cmv2tjwk80001m8273lnmx95j', 'ACTIVE', 'URGENT', 1789934432329, 1792872032329, 'WORKSPACE', NULL, 1789934432329, 1791662432454),
  ('cmv2tjwlk003em827snoprvvy', 'cmv2tjwkr000um827cq3g0pae', 'Customer Portal', 'Self-service client portal with reporting and file exchange.', '#f97316', 'layout-dashboard', 'cmv2tjwk80001m8273lnmx95j', 'ON_HOLD', 'MEDIUM', 1785614432329, 1796846432329, 'WORKSPACE', NULL, 1785614432329, 1791662432456),
  ('cmv2tjwlm003jm827y3gpu943', 'cmv2tjwkr000um827cq3g0pae', 'Analytics Dashboard', 'Campaign performance analytics dashboard for client reporting.', '#14b8a6', 'bar-chart', 'cmv2tjwkc0006m827ldg151yt', 'ACTIVE', 'HIGH', 1789070432329, 1793822432329, 'WORKSPACE', NULL, 1789070432329, 1791662432458),
  ('cmv2tjwln003om827whg1rlwg', 'cmv2tjwkv0019m827a7g7rrgs', 'Documentation Refresh', 'Rewrite internal playbooks and onboarding documentation.', '#eab308', 'book-open', 'cmv2tjwk60000m8279o1payok', 'ACTIVE', 'LOW', 1790366432329, 1795118432329, 'WORKSPACE', NULL, 1790366432329, 1791662432460);

-- ProjectMember (25 rows)
INSERT INTO "ProjectMember" ("id", "projectId", "userId", "role", "createdAt") VALUES
  ('cmv2tjwld002om827p4jnlg0c', 'cmv2tjwlc002nm827y7yt0u45', 'cmv2tjwk90002m82726cedz5f', 'LEAD', 1791662432449),
  ('cmv2tjwld002pm827hokglnyo', 'cmv2tjwlc002nm827y7yt0u45', 'cmv2tjwk90003m827juefdyeo', 'CONTRIBUTOR', 1791662432449),
  ('cmv2tjwld002qm827adihlu8b', 'cmv2tjwlc002nm827y7yt0u45', 'cmv2tjwkc0005m827i8ohmc9s', 'CONTRIBUTOR', 1791662432449),
  ('cmv2tjwld002rm827vfgirq4i', 'cmv2tjwlc002nm827y7yt0u45', 'cmv2tjwkc0006m827ldg151yt', 'CONTRIBUTOR', 1791662432449),
  ('cmv2tjwle002um827b555s2nw', 'cmv2tjwle002tm8277ac7puuo', 'cmv2tjwk80001m8273lnmx95j', 'CONTRIBUTOR', 1791662432451),
  ('cmv2tjwle002vm827yuzzr1i4', 'cmv2tjwle002tm8277ac7puuo', 'cmv2tjwkc0005m827i8ohmc9s', 'CONTRIBUTOR', 1791662432451),
  ('cmv2tjwle002wm827iu726m1t', 'cmv2tjwle002tm8277ac7puuo', 'cmv2tjwke0008m827o4rq4ja7', 'CONTRIBUTOR', 1791662432451),
  ('cmv2tjwle002xm827e7g145fj', 'cmv2tjwle002tm8277ac7puuo', 'cmv2tjwk60000m8279o1payok', 'LEAD', 1791662432451),
  ('cmv2tjwlg0030m8278q8w5gea', 'cmv2tjwlf002zm827w0fl3674', 'cmv2tjwk80001m8273lnmx95j', 'LEAD', 1791662432452),
  ('cmv2tjwlg0031m827c4kk4z2t', 'cmv2tjwlf002zm827w0fl3674', 'cmv2tjwkd0007m827dck2ys5e', 'CONTRIBUTOR', 1791662432452),
  ('cmv2tjwlh0034m8277lpfjlff', 'cmv2tjwlg0033m827y3d1i96s', 'cmv2tjwk90002m82726cedz5f', 'CONTRIBUTOR', 1791662432454),
  ('cmv2tjwlh0035m827opfw4jgt', 'cmv2tjwlg0033m827y3d1i96s', 'cmv2tjwkb0004m827hbdryg5t', 'CONTRIBUTOR', 1791662432454),
  ('cmv2tjwlh0036m8276uhopud0', 'cmv2tjwlg0033m827y3d1i96s', 'cmv2tjwk60000m8279o1payok', 'LEAD', 1791662432454),
  ('cmv2tjwlj0039m827c1ifeh4o', 'cmv2tjwli0038m827n352kbe2', 'cmv2tjwk90002m82726cedz5f', 'CONTRIBUTOR', 1791662432455),
  ('cmv2tjwlj003am827rdhvig2e', 'cmv2tjwli0038m827n352kbe2', 'cmv2tjwkf0009m827qopjy2j0', 'CONTRIBUTOR', 1791662432455),
  ('cmv2tjwlj003bm827fnlf5osx', 'cmv2tjwli0038m827n352kbe2', 'cmv2tjwkg000am8272maeb2rl', 'CONTRIBUTOR', 1791662432455),
  ('cmv2tjwlj003cm827qpcl90g1', 'cmv2tjwli0038m827n352kbe2', 'cmv2tjwk80001m8273lnmx95j', 'LEAD', 1791662432455),
  ('cmv2tjwlk003fm827xn60q6k2', 'cmv2tjwlk003em827snoprvvy', 'cmv2tjwki000bm827ik6vg12b', 'CONTRIBUTOR', 1791662432457),
  ('cmv2tjwlk003gm827qbatn8jf', 'cmv2tjwlk003em827snoprvvy', 'cmv2tjwkd0007m827dck2ys5e', 'CONTRIBUTOR', 1791662432457),
  ('cmv2tjwlk003hm82724tgishx', 'cmv2tjwlk003em827snoprvvy', 'cmv2tjwk80001m8273lnmx95j', 'LEAD', 1791662432457),
  ('cmv2tjwln003km827nxj3dxvw', 'cmv2tjwlm003jm827y3gpu943', 'cmv2tjwkg000am8272maeb2rl', 'CONTRIBUTOR', 1791662432459),
  ('cmv2tjwln003lm827686a9ga8', 'cmv2tjwlm003jm827y3gpu943', 'cmv2tjwkf0009m827qopjy2j0', 'CONTRIBUTOR', 1791662432459),
  ('cmv2tjwln003mm827e5nwnpjt', 'cmv2tjwlm003jm827y3gpu943', 'cmv2tjwkc0006m827ldg151yt', 'LEAD', 1791662432459),
  ('cmv2tjwlo003pm827n8p0geek', 'cmv2tjwln003om827whg1rlwg', 'cmv2tjwke0008m827o4rq4ja7', 'CONTRIBUTOR', 1791662432460),
  ('cmv2tjwlo003qm827ytmhntjz', 'cmv2tjwln003om827whg1rlwg', 'cmv2tjwk60000m8279o1payok', 'LEAD', 1791662432460);

-- Session (14 rows)
INSERT INTO "Session" ("id", "token", "userId", "userAgent", "expiresAt", "createdAt") VALUES
  ('cmv2tkht4000dm8q780ip7bc1', 'd7e5ed7187a240cf74a00541a2de726cd9b24586edb49a4aaa25d23d872a6e8a', 'cmv2tjwk90003m827juefdyeo', 'Bun/1.3.14', 1794254459943, 1791662459944),
  ('cmv2tkvnv000fm8q74w6scj9s', '87d98663b8bd8a94ae05f2f3b27187a85e3d3ced2ce88905cd8f199193bb1b38', 'cmv2tjwk60000m8279o1payok', 'Bun/1.3.14', 1794254477898, 1791662477899),
  ('cmv2tkvp4000hm8q7k1zey7ad', 'd81a1346f37d5f752dd17ac69c406c0fb87a938c601895496e449cecce0e0e0b', 'cmv2tjwk90003m827juefdyeo', 'Bun/1.3.14', 1794254477943, 1791662477944),
  ('cmv2tl0i8000jm8q7sm1ddafo', '71232d10931452bfb701c35b4aba06018d09be87d787ac26819e83f2620ac1f6', 'cmv2tjwk80001m8273lnmx95j', 'Bun/1.3.14', 1794254484175, 1791662484176),
  ('cmv2tl0jh000lm8q7tlen38w6', '44e6010ae812060af46613812f3447f9e015c67ae29ce2712daa33987962b31e', 'cmv2tjwk90003m827juefdyeo', 'Bun/1.3.14', 1794254484221, 1791662484222),
  ('cmv2tl2hr000nm8q7acm3bpiv', '2117a0bc14180dfb96a790b6e033a28a51f43edc78dcc20695afef1c7ce48efe', 'cmv2tjwkb0004m827hbdryg5t', 'Bun/1.3.14', 1794254486751, 1791662486752),
  ('cmv2tn8qt000pm8q7pzknvdfz', 'a8cdd07888f122f5ef127908cbd6103eb2b62050b4c908897a59e6a939b3d1c6', 'cmv2tjwk60000m8279o1payok', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36', 1794254588164, 1791662588165),
  ('cmv2tpbj4000tm8q7yvk5911k', '61d38f570bec0a8dea3eaf90b6e22c08e27ddea1c30a67f5909e81ec1d53760f', 'cmv2tjwk60000m8279o1payok', 'curl/8.14.1', 1794254685088, 1791662685089),
  ('cmv2tpg50000vm8q7mrvkedv4', 'ca71af0c889b650b85b3b8284f6d9b5604ddfd95776253c6ac35c645c7aacf0e', 'cmv2tjwk60000m8279o1payok', 'curl/8.14.1', 1794254691059, 1791662691060),
  ('cmv2txrvc001jm8q7ldns5ilm', '5376e9ca7c7e6667d8ca62c9211f73d20dd0955d33e9e6250aed5efee16f82af', 'cmv2tjwk60000m8279o1payok', 'curl/8.14.1', 1794255079511, 1791663079512),
  ('cmv2u2e1k0001m83zw9b79sl4', '3c4f45112c5b20a38ee07cd4e1f6ea609e069d0d0c72561803bb798ea331bd4b', 'cmv2tjwk60000m8279o1payok', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36', 1794255294872, 1791663294873),
  ('cmv5mdepv0001mkskbab2b1k1', 'a75bfd2174632289bffdcd1ff178d4e9223b0d0dcb884da9dd8b759fc7a797df', 'cmv2tjwk60000m8279o1payok', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36', 1794423770562, 1791831770564),
  ('cmv5mjp0e0003mkskcln0yp5n', '638ae13587c5141dc1a46f9d4df85a938c4c73e9a53e2b773ccb80c9b6a85e43', 'cmv2tjwk80001m8273lnmx95j', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/154.0.0.0 Safari/537.36', 1794424063837, 1791832063838),
  ('cmv5n70nj0005mksk271ydae5', 'ab7f9fe17106fbd4fd6c14f268084b8e03681778c141fb1943f6d9fc113ac0ac', 'cmv2tjwk60000m8279o1payok', 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/155.0.0.0 Safari/537.36', 1794425152014, 1791833152015);

-- Subscription (3 rows)
INSERT INTO "Subscription" ("id", "workspaceId", "plan", "status", "interval", "provider", "providerCustomerId", "providerSubscriptionId", "cancelAtPeriodEnd", "currentPeriodStart", "currentPeriodEnd", "createdAt", "updatedAt") VALUES
  ('cmv2tjwkp000om8270ia8e4li', 'cmv2tjwkm000dm827egw47sja', 'PRO', 'ACTIVE', 'monthly', 'test-mode', NULL, NULL, 0, 1791662846457, 1794254846457, 1791662432425, 1791662846460),
  ('cmv2tjwkt0013m8276g68o1m3', 'cmv2tjwkr000um827cq3g0pae', 'BUSINESS', 'ACTIVE', 'annual', 'test-mode', NULL, NULL, 0, 1790625632329, 1822161632329, 1791662432429, 1791662432429),
  ('cmv2tjwkw001fm827r9j6rduo', 'cmv2tjwkv0019m827a7g7rrgs', 'FREE', 'ACTIVE', 'monthly', 'test-mode', NULL, NULL, 0, 1790625632329, 1793217632329, 1791662432433, 1791662432433);

-- Task (105 rows)
INSERT INTO "Task" ("id", "workspaceId", "projectId", "title", "description", "status", "priority", "assigneeId", "creatorId", "startDate", "dueDate", "estimatedHours", "position", "parentTaskId", "milestoneId", "completedAt", "createdAt", "updatedAt") VALUES
  ('cmv2tjwlv0048m827a0ig5ym9', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Audit current site information architecture', 'Audit current site information architecture. Break work into subtasks and track progress on the board.', 'BACKLOG', 'MEDIUM', 'cmv2tjwk90003m827juefdyeo', 'cmv2tjwk60000m8279o1payok', 1788379232329, 1791316832329, 2, 10500, NULL, NULL, NULL, 1788206432329, 1791662432467),
  ('cmv2tjwlw004am827j2qynx82', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Define design tokens and color palette', 'Define design tokens and color palette. Coordinate with the team before shipping; follow the definition of done.', 'IN_REVIEW', 'URGENT', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk60000m8279o1payok', 1788292832329, 1791403232329, 3, 10600, NULL, 'cmv2tjwlo003sm827jsoc6b6f', NULL, 1788120032329, 1791662720038),
  ('cmv2tjwlx004cm827vw4x3r9m', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Design hero section variants', 'Design hero section variants. This item was prioritized during the latest planning cycle.', 'IN_REVIEW', 'MEDIUM', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwk60000m8279o1payok', 1788206432329, 1791230432329, 5, 10500, NULL, 'cmv2tjwlo003sm827jsoc6b6f', NULL, 1788033632329, 1791662432636),
  ('cmv2tjwly004em8274tw4ricg', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Build responsive navigation component', 'Build responsive navigation component. Owned delivery includes coordination with design and review sign-off.', 'IN_PROGRESS', 'URGENT', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk60000m8279o1payok', 1788120032329, 1791576032329, 8, 10500, NULL, NULL, NULL, 1787947232329, 1791662432471),
  ('cmv2tjwm0004gm8275yzfrdtj', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Implement pricing page layout', 'Implement pricing page layout. Break work into subtasks and track progress on the board.', 'DONE', 'MEDIUM', 'cmv2tjwk90003m827juefdyeo', 'cmv2tjwk60000m8279o1payok', 1788033632329, 1791662432329, 1, 10500, NULL, 'cmv2tjwlq003um827mzlgyeq6', 1791230432329, 1787860832329, 1791662432639),
  ('cmv2tjwm0004im827rruld315', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Migrate blog content to CMS', 'Migrate blog content to CMS. Coordinate with the team before shipping; follow the definition of done.', 'DONE', 'URGENT', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk60000m8279o1payok', 1787947232329, 1791748832329, 2, 10500, NULL, NULL, 1791230432329, 1787774432329, 1791662432473),
  ('cmv2tjwm5004km8271epsuvxq', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Set up 301 redirects for changed URLs', 'Set up 301 redirects for changed URLs. This item was prioritized during the latest planning cycle.', 'DONE', 'MEDIUM', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwk60000m8279o1payok', 1787860832329, 1791835232329, 3, 10500, NULL, NULL, 1791230432329, 1787688032329, 1791662432477),
  ('cmv2tjwm6004mm827d6c4k20x', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Optimize hero images for Core Web Vitals', 'Optimize hero images for Core Web Vitals. Owned delivery includes coordination with design and review sign-off.', 'DONE', 'URGENT', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk60000m8279o1payok', 1787774432329, 1791921632329, 5, 10500, NULL, NULL, 1791230432329, 1787601632329, 1791662432478),
  ('cmv2tjwm7004om82779guxcsq', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Write homepage copy', 'Write homepage copy. Break work into subtasks and track progress on the board.', 'CANCELLED', 'MEDIUM', NULL, 'cmv2tjwk60000m8279o1payok', 1787688032329, 1792008032329, 8, 10500, NULL, NULL, NULL, 1787515232329, 1791662432479),
  ('cmv2tjwm8004qm82781haw74u', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Add testimonial carousel', 'Add testimonial carousel. Coordinate with the team before shipping; follow the definition of done.', 'TODO', 'URGENT', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk60000m8279o1payok', 1787601632329, 1792094432329, 1, 10500, NULL, NULL, NULL, 1787428832329, 1791662432481),
  ('cmv2tjwm9004sm827ncijza3b', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Wire up contact form to backend', 'Wire up contact form to backend. This item was prioritized during the latest planning cycle.', 'BACKLOG', 'MEDIUM', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwk60000m8279o1payok', 1787515232329, 1792180832329, 2, 10500, NULL, NULL, NULL, 1787342432329, 1791662432481),
  ('cmv2tjwma004um827biofa7de', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Cross-browser QA pass', 'Cross-browser QA pass. Owned delivery includes coordination with design and review sign-off.', 'TODO', 'URGENT', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk60000m8279o1payok', 1787428832329, 1792267232329, 3, 10500, NULL, NULL, NULL, 1787256032329, 1791662432482),
  ('cmv2tjwmb004wm8273atxuhmn', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Dark mode support for marketing pages', 'Dark mode support for marketing pages. Break work into subtasks and track progress on the board.', 'IN_REVIEW', 'MEDIUM', 'cmv2tjwk90003m827juefdyeo', 'cmv2tjwk60000m8279o1payok', 1787342432329, 1792353632329, 5, 10500, NULL, NULL, NULL, 1787169632329, 1791662432483),
  ('cmv2tjwmc004ym827d7btjh18', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Favicon and meta images update', 'Favicon and meta images update. Coordinate with the team before shipping; follow the definition of done.', 'IN_PROGRESS', 'URGENT', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk60000m8279o1payok', 1787256032329, 1792440032329, 8, 10500, NULL, NULL, NULL, 1787083232329, 1791662432484),
  ('cmv2tjwmc0050m827cgzffbtj', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Launch checklist review', 'Launch checklist review. This item was prioritized during the latest planning cycle.', 'DONE', 'MEDIUM', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwk60000m8279o1payok', 1787169632329, 1792526432329, 1, 10500, NULL, NULL, 1791230432329, 1786996832329, 1791662432485),
  ('cmv2tjwme0052m8274n0j8nvs', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Newsletter signup integration', 'Newsletter signup integration. Owned delivery includes coordination with design and review sign-off.', 'DONE', 'URGENT', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk60000m8279o1payok', 1787083232329, 1792612832329, 2, 10500, NULL, NULL, 1791230432329, 1786910432329, 1791662432486),
  ('cmv2tjwmf0054m827olrskbk6', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Cookie consent and privacy banner', 'Cookie consent and privacy banner. Break work into subtasks and track progress on the board.', 'DONE', 'MEDIUM', 'cmv2tjwk90003m827juefdyeo', 'cmv2tjwk60000m8279o1payok', 1786996832329, 1792699232329, 3, 10500, NULL, NULL, 1791230432329, 1786824032329, 1791662432488),
  ('cmv2tjwmg0056m827ug3cr64m', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Case studies section build', 'Case studies section build. Coordinate with the team before shipping; follow the definition of done.', 'DONE', 'URGENT', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk60000m8279o1payok', 1786910432329, 1792785632329, 5, 10500, NULL, NULL, 1791230432329, 1786737632329, 1791662432488),
  ('cmv2tjwmi0058m827uef0zf5o', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Careers page with open roles', 'Careers page with open roles. This item was prioritized during the latest planning cycle.', 'CANCELLED', 'MEDIUM', NULL, 'cmv2tjwk60000m8279o1payok', 1786824032329, 1792872032329, 8, 10500, NULL, NULL, NULL, 1786651232329, 1791662432490),
  ('cmv2tjwmj005am827xakl4df5', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'SEO metadata template rollout', 'SEO metadata template rollout. Owned delivery includes coordination with design and review sign-off.', 'TODO', 'URGENT', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk60000m8279o1payok', 1786737632329, 1792958432329, 1, 10500, NULL, NULL, NULL, 1786564832329, 1791662432491),
  ('cmv2tjwmk005cm8279nrljn5c', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlc002nm827y7yt0u45', 'Performance budget enforcement in CI', 'Performance budget enforcement in CI. Break work into subtasks and track progress on the board.', 'BACKLOG', 'MEDIUM', 'cmv2tjwk90003m827juefdyeo', 'cmv2tjwk60000m8279o1payok', 1786651232329, 1791230432329, 2, 10500, NULL, NULL, NULL, 1786478432329, 1791662432492),
  ('cmv2tjwml005em827kvak5emd', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Set up Expo project and CI pipeline', 'Set up Expo project and CI pipeline. Coordinate with the team before shipping; follow the definition of done.', 'IN_PROGRESS', 'HIGH', 'cmv2tjwk60000m8279o1payok', 'cmv2tjwk60000m8279o1payok', 1786651232329, 1793131232329, 3, 10500, NULL, NULL, NULL, 1786478432329, 1791662432493),
  ('cmv2tjwml005gm82726ecduae', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Design onboarding flow screens', 'Design onboarding flow screens. This item was prioritized during the latest planning cycle.', 'DONE', 'LOW', 'cmv2tjwk90002m82726cedz5f', 'cmv2tjwk60000m8279o1payok', 1786564832329, 1793217632329, 5, 10500, NULL, 'cmv2tjwlr003ym827tluk5ypn', 1791230432329, 1786392032329, 1791662432640),
  ('cmv2tjwmm005im827ogbluitq', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Implement secure token storage', 'Implement secure token storage. Owned delivery includes coordination with design and review sign-off.', 'DONE', 'HIGH', 'cmv2tjwkc0005m827i8ohmc9s', 'cmv2tjwk60000m8279o1payok', 1786478432329, 1793304032329, 8, 10500, NULL, NULL, 1791230432329, 1786305632329, 1791662432494),
  ('cmv2tjwmn005km8270zde944e', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Build task list screen with virtualization', 'Build task list screen with virtualization. Break work into subtasks and track progress on the board.', 'DONE', 'LOW', 'cmv2tjwkd0007m827dck2ys5e', 'cmv2tjwk60000m8279o1payok', 1786392032329, 1793390432329, 1, 10500, NULL, NULL, 1791230432329, 1786219232329, 1791662432496),
  ('cmv2tjwmo005mm827s7glahwa', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Offline sync conflict resolution', 'Offline sync conflict resolution. Coordinate with the team before shipping; follow the definition of done.', 'DONE', 'HIGH', 'cmv2tjwk60000m8279o1payok', 'cmv2tjwk60000m8279o1payok', 1786305632329, 1793476832329, 2, 10500, NULL, NULL, 1791230432329, 1786132832329, 1791662432497),
  ('cmv2tjwmp005om827g3czr5qd', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Push notification integration', 'Push notification integration. This item was prioritized during the latest planning cycle.', 'CANCELLED', 'LOW', NULL, 'cmv2tjwk60000m8279o1payok', 1786219232329, 1793563232329, 3, 10500, NULL, 'cmv2tjwlr003ym827tluk5ypn', NULL, 1786046432329, 1791662432641),
  ('cmv2tjwmq005qm827lhpemxk9', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Biometric authentication support', 'Biometric authentication support. Owned delivery includes coordination with design and review sign-off.', 'TODO', 'HIGH', 'cmv2tjwkc0005m827i8ohmc9s', 'cmv2tjwk60000m8279o1payok', 1786132832329, 1793649632329, 5, 10500, NULL, NULL, NULL, 1785960032329, 1791662432498),
  ('cmv2tjwna005sm827pxuh59xg', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Deep linking for tasks and projects', 'Deep linking for tasks and projects. Break work into subtasks and track progress on the board.', 'BACKLOG', 'LOW', 'cmv2tjwkd0007m827dck2ys5e', 'cmv2tjwk60000m8279o1payok', 1786046432329, 1793736032329, 8, 10500, NULL, NULL, NULL, 1785873632329, 1791662432518),
  ('cmv2tjwnb005um827sildc5lu', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Reduce cold start below 2s', 'Reduce cold start below 2s. Coordinate with the team before shipping; follow the definition of done.', 'TODO', 'HIGH', 'cmv2tjwk60000m8279o1payok', 'cmv2tjwk60000m8279o1payok', 1785960032329, 1791230432329, 1, 10500, NULL, NULL, NULL, 1785787232329, 1791662432520),
  ('cmv2tjwnd005wm827t15cia5w', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Crash reporting integration', 'Crash reporting integration. This item was prioritized during the latest planning cycle.', 'IN_REVIEW', 'LOW', 'cmv2tjwk90002m82726cedz5f', 'cmv2tjwk60000m8279o1payok', 1785873632329, 1791316832329, 2, 10500, NULL, NULL, NULL, 1785700832329, 1791662432521),
  ('cmv2tjwne005ym827ns5u6czf', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Beta tester feedback triage', 'Beta tester feedback triage. Owned delivery includes coordination with design and review sign-off.', 'IN_PROGRESS', 'HIGH', 'cmv2tjwkc0005m827i8ohmc9s', 'cmv2tjwk60000m8279o1payok', 1785787232329, 1791403232329, 3, 10500, NULL, NULL, NULL, 1785614432329, 1791662432522),
  ('cmv2tjwnf0060m827b0zorb7g', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Accessibility audit for core flows', 'Accessibility audit for core flows. Break work into subtasks and track progress on the board.', 'DONE', 'LOW', 'cmv2tjwkd0007m827dck2ys5e', 'cmv2tjwk60000m8279o1payok', 1785700832329, 1791489632329, 5, 10500, NULL, NULL, 1791230432329, 1785528032329, 1791662432524),
  ('cmv2tjwnh0062m82731hmjn8s', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Localization scaffolding (EN/FR/AR)', 'Localization scaffolding (EN/FR/AR). Coordinate with the team before shipping; follow the definition of done.', 'DONE', 'HIGH', 'cmv2tjwk60000m8279o1payok', 'cmv2tjwk60000m8279o1payok', 1785614432329, 1791576032329, 8, 10500, NULL, NULL, 1791230432329, 1785441632329, 1791662432525),
  ('cmv2tjwnj0064m827om5ha739', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'App icon and splash screen', 'App icon and splash screen. This item was prioritized during the latest planning cycle.', 'DONE', 'LOW', 'cmv2tjwk90002m82726cedz5f', 'cmv2tjwk60000m8279o1payok', 1785528032329, 1791662432329, 1, 10500, NULL, NULL, 1791230432329, 1785355232329, 1791662432527),
  ('cmv2tjwnk0066m827juz0kegv', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwle002tm8277ac7puuo', 'Store listing copy', 'Store listing copy. Owned delivery includes coordination with design and review sign-off.', 'DONE', 'HIGH', 'cmv2tjwkc0005m827i8ohmc9s', 'cmv2tjwk60000m8279o1payok', 1785441632329, 1791748832329, 2, 10500, NULL, NULL, 1791230432329, 1785268832329, 1791662432528),
  ('cmv2tjwnl0068m827slm31oo6', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlf002zm827w0fl3674', 'Design gateway routing schema', 'Design gateway routing schema. Break work into subtasks and track progress on the board.', 'CANCELLED', 'MEDIUM', NULL, 'cmv2tjwk60000m8279o1payok', 1784059232329, 1791835232329, 3, 10500, NULL, 'cmv2tjwls0042m827qmt3u272', NULL, 1783886432329, 1791662432642),
  ('cmv2tjwnm006am827j2qoauaw', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlf002zm827w0fl3674', 'Implement per-workspace rate limiting', 'Implement per-workspace rate limiting. Coordinate with the team before shipping; follow the definition of done.', 'TODO', 'URGENT', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk60000m8279o1payok', 1783972832329, 1791921632329, 5, 10500, NULL, NULL, NULL, 1783800032329, 1791662432531),
  ('cmv2tjwnn006cm827r9nszkbc', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlf002zm827w0fl3674', 'Add structured request logging', 'Add structured request logging. This item was prioritized during the latest planning cycle.', 'BACKLOG', 'MEDIUM', 'cmv2tjwk90003m827juefdyeo', 'cmv2tjwk60000m8279o1payok', 1783886432329, 1791230432329, 8, 10500, NULL, NULL, NULL, 1783713632329, 1791662432531),
  ('cmv2tjwnp006em827kasmbcru', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlf002zm827w0fl3674', 'Set up distributed tracing', 'Set up distributed tracing. Owned delivery includes coordination with design and review sign-off.', 'TODO', 'URGENT', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk60000m8279o1payok', 1783800032329, 1792094432329, 1, 10500, NULL, NULL, NULL, 1783627232329, 1791662432533),
  ('cmv2tjwnq006gm827orustt76', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlf002zm827w0fl3674', 'Postgres connection pooling tuning', 'Postgres connection pooling tuning. Break work into subtasks and track progress on the board.', 'IN_REVIEW', 'MEDIUM', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwk60000m8279o1payok', 1783713632329, 1792180832329, 2, 10500, NULL, NULL, NULL, 1783540832329, 1791662432535),
  ('cmv2tjwnr006im827q9dh2cil', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlf002zm827w0fl3674', 'Write API versioning policy', 'Write API versioning policy. Coordinate with the team before shipping; follow the definition of done.', 'IN_PROGRESS', 'URGENT', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk60000m8279o1payok', 1783627232329, 1792267232329, 3, 10500, NULL, NULL, NULL, 1783454432329, 1791662432536),
  ('cmv2tjwnv006km827zotvq5oi', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlf002zm827w0fl3674', 'Load test with 10k concurrent connections', 'Load test with 10k concurrent connections. This item was prioritized during the latest planning cycle.', 'DONE', 'MEDIUM', 'cmv2tjwk90003m827juefdyeo', 'cmv2tjwk60000m8279o1payok', 1783540832329, 1792353632329, 5, 10500, NULL, NULL, 1791230432329, 1783368032329, 1791662432539),
  ('cmv2tjwnw006mm8270b7oif9e', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlf002zm827w0fl3674', 'Document error envelope format', 'Document error envelope format. Owned delivery includes coordination with design and review sign-off.', 'DONE', 'URGENT', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk60000m8279o1payok', 1783454432329, 1792440032329, 8, 10500, NULL, NULL, 1791230432329, 1783281632329, 1791662432540),
  ('cmv2tjwnx006om827oxvx89cq', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlf002zm827w0fl3674', 'Rotate internal service credentials', 'Rotate internal service credentials. Break work into subtasks and track progress on the board.', 'DONE', 'MEDIUM', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwk60000m8279o1payok', 1783368032329, 1792526432329, 1, 10500, NULL, NULL, 1791230432329, 1783195232329, 1791662432541),
  ('cmv2tjwnz006qm827amylez6y', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlf002zm827w0fl3674', 'Set up blue-green deployment', 'Set up blue-green deployment. Coordinate with the team before shipping; follow the definition of done.', 'DONE', 'URGENT', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk60000m8279o1payok', 1783281632329, 1792612832329, 2, 10500, NULL, NULL, 1791230432329, 1783108832329, 1791662432543),
  ('cmv2tjwnz006sm827szvlwuoi', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlf002zm827w0fl3674', 'Webhook delivery retry mechanism', 'Webhook delivery retry mechanism. This item was prioritized during the latest planning cycle.', 'CANCELLED', 'MEDIUM', NULL, 'cmv2tjwk60000m8279o1payok', 1783195232329, 1792699232329, 3, 10500, NULL, NULL, NULL, 1783022432329, 1791662432544),
  ('cmv2tjwo0006um827k02iwjac', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlf002zm827w0fl3674', 'Audit log retention policy', 'Audit log retention policy. Owned delivery includes coordination with design and review sign-off.', 'TODO', 'URGENT', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk60000m8279o1payok', 1783108832329, 1792785632329, 5, 10500, NULL, NULL, NULL, 1782936032329, 1791662432544),
  ('cmv2tjwo2006wm827qo6xzpi0', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlg0033m827y3d1i96s', 'Collect customer feedback themes', 'Collect customer feedback themes. Break work into subtasks and track progress on the board.', 'DONE', 'MEDIUM', 'cmv2tjwk90003m827juefdyeo', 'cmv2tjwk60000m8279o1payok', 1791662432329, 1792872032329, 8, 10500, NULL, NULL, 1791230432329, 1791576032329, 1791662432546),
  ('cmv2tjwo3006ym827xdzu9x9s', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlg0033m827y3d1i96s', 'Draft Q3 objectives and key results', 'Draft Q3 objectives and key results. Coordinate with the team before shipping; follow the definition of done.', 'DONE', 'URGENT', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk60000m8279o1payok', 1791662432329, 1792958432329, 1, 10500, NULL, NULL, 1791230432329, 1791576032329, 1791662432547);
INSERT INTO "Task" ("id", "workspaceId", "projectId", "title", "description", "status", "priority", "assigneeId", "creatorId", "startDate", "dueDate", "estimatedHours", "position", "parentTaskId", "milestoneId", "completedAt", "createdAt", "updatedAt") VALUES
  ('cmv2tjwo30070m827aekvt9nr', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlg0033m827y3d1i96s', 'Competitive analysis refresh', 'Competitive analysis refresh. This item was prioritized during the latest planning cycle.', 'DONE', 'MEDIUM', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwk60000m8279o1payok', 1791662432329, 1793044832329, 2, 10500, NULL, NULL, 1791230432329, 1791576032329, 1791662432548),
  ('cmv2tjwo50072m827zmsdeh90', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlg0033m827y3d1i96s', 'Prioritize backlog with RICE scoring', 'Prioritize backlog with RICE scoring. Owned delivery includes coordination with design and review sign-off.', 'DONE', 'URGENT', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk60000m8279o1payok', 1791662432329, 1793131232329, 3, 10500, NULL, NULL, 1791230432329, 1791576032329, 1791662432550),
  ('cmv2tjwo80074m827ufofpwzq', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlg0033m827y3d1i96s', 'Align roadmap with sales commitments', 'Align roadmap with sales commitments. Break work into subtasks and track progress on the board.', 'CANCELLED', 'MEDIUM', NULL, 'cmv2tjwk60000m8279o1payok', 1791662432329, 1793217632329, 5, 10500, NULL, NULL, NULL, 1791576032329, 1791662432553),
  ('cmv2tjwo90076m827kv97v6tx', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlg0033m827y3d1i96s', 'Publish roadmap to stakeholders', 'Publish roadmap to stakeholders. Coordinate with the team before shipping; follow the definition of done.', 'TODO', 'URGENT', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk60000m8279o1payok', 1791662432329, 1793304032329, 8, 10500, NULL, NULL, NULL, 1791576032329, 1791662432553),
  ('cmv2tjwoa0078m827k6vnlew6', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlg0033m827y3d1i96s', 'Interview churned customers about gaps', 'Interview churned customers about gaps. This item was prioritized during the latest planning cycle.', 'BACKLOG', 'MEDIUM', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwk60000m8279o1payok', 1791662432329, 1793390432329, 1, 10500, NULL, NULL, NULL, 1791576032329, 1791662432555),
  ('cmv2tjwob007am827bs4c8aid', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlg0033m827y3d1i96s', 'Model pricing sensitivity scenarios', 'Model pricing sensitivity scenarios. Owned delivery includes coordination with design and review sign-off.', 'TODO', 'URGENT', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk60000m8279o1payok', 1791662432329, 1793476832329, 2, 10500, NULL, NULL, NULL, 1791489632329, 1791662432555),
  ('cmv2tjwoc007cm827a9ys5l4b', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlg0033m827y3d1i96s', 'Define enterprise readiness criteria', 'Define enterprise readiness criteria. Break work into subtasks and track progress on the board.', 'IN_REVIEW', 'MEDIUM', 'cmv2tjwk90003m827juefdyeo', 'cmv2tjwk60000m8279o1payok', 1791576032329, 1791230432329, 3, 10500, NULL, NULL, NULL, 1791403232329, 1791662432557),
  ('cmv2tjwoe007em827w6f9gr6w', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlg0033m827y3d1i96s', 'Review platform extension strategy', 'Review platform extension strategy. Coordinate with the team before shipping; follow the definition of done.', 'IN_PROGRESS', 'URGENT', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk60000m8279o1payok', 1791489632329, 1793649632329, 5, 10500, NULL, NULL, NULL, 1791316832329, 1791662432558),
  ('cmv2tjwoe007gm827fgrgyq1e', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlg0033m827y3d1i96s', 'Assist discovery: workflow automation', 'Assist discovery: workflow automation. This item was prioritized during the latest planning cycle.', 'DONE', 'MEDIUM', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwk60000m8279o1payok', 1791403232329, 1793736032329, 8, 10500, NULL, NULL, 1791230432329, 1791230432329, 1791662432559),
  ('cmv2tjwof007im827xks3ii83', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwlg0033m827y3d1i96s', 'Validate mobile-first hypotheses', 'Validate mobile-first hypotheses. Owned delivery includes coordination with design and review sign-off.', 'DONE', 'URGENT', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk60000m8279o1payok', 1791316832329, 1791230432329, 1, 10500, NULL, NULL, 1791230432329, 1791144032329, 1791662432559),
  ('cmv2tjwog007km8277jkeoq4n', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwli0038m827n352kbe2', 'Finalize campaign messaging matrix', 'Finalize campaign messaging matrix. Break work into subtasks and track progress on the board.', 'BACKLOG', 'MEDIUM', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk80001m8273lnmx95j', 1790107232329, 1791316832329, 2, 10500, NULL, NULL, NULL, 1789934432329, 1791662432560),
  ('cmv2tjwoh007mm827yl28bcd5', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwli0038m827n352kbe2', 'Produce launch video assets', 'Produce launch video assets. Coordinate with the team before shipping; follow the definition of done.', 'TODO', 'URGENT', 'cmv2tjwk90002m82726cedz5f', 'cmv2tjwk80001m8273lnmx95j', 1790020832329, 1791403232329, 3, 10500, NULL, 'cmv2tjwlt0044m82716ufwot5', NULL, 1789848032329, 1791662432643),
  ('cmv2tjwoi007om827s6zo6k45', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwli0038m827n352kbe2', 'Build landing page variants for A/B tests', 'Build landing page variants for A/B tests. This item was prioritized during the latest planning cycle.', 'IN_REVIEW', 'MEDIUM', 'cmv2tjwkg000am8272maeb2rl', 'cmv2tjwk80001m8273lnmx95j', 1789934432329, 1791489632329, 5, 10500, NULL, NULL, NULL, 1789761632329, 1791662432562),
  ('cmv2tjwoj007qm827ny06emrv', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwli0038m827n352kbe2', 'Coordinate influencer outreach', 'Coordinate influencer outreach. Owned delivery includes coordination with design and review sign-off.', 'IN_PROGRESS', 'URGENT', 'cmv2tjwkd0007m827dck2ys5e', 'cmv2tjwk80001m8273lnmx95j', 1789848032329, 1791576032329, 8, 10500, NULL, NULL, NULL, 1789675232329, 1791662432563),
  ('cmv2tjwol007sm827cw9sahm0', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwli0038m827n352kbe2', 'Schedule social media calendar', 'Schedule social media calendar. Break work into subtasks and track progress on the board.', 'DONE', 'MEDIUM', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk80001m8273lnmx95j', 1789761632329, 1791662432329, 1, 10500, NULL, NULL, 1791230432329, 1789588832329, 1791662432565),
  ('cmv2tjwom007um827j3fo1bf2', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwli0038m827n352kbe2', 'Set up conversion tracking pixels', 'Set up conversion tracking pixels. Coordinate with the team before shipping; follow the definition of done.', 'DONE', 'URGENT', 'cmv2tjwkf0009m827qopjy2j0', 'cmv2tjwk80001m8273lnmx95j', 1789675232329, 1791748832329, 2, 10500, NULL, NULL, 1791230432329, 1789502432329, 1791662432567),
  ('cmv2tjwoo007wm827637h7l09', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwli0038m827n352kbe2', 'Draft press release', 'Draft press release. This item was prioritized during the latest planning cycle.', 'DONE', 'MEDIUM', 'cmv2tjwki000bm827ik6vg12b', 'cmv2tjwk80001m8273lnmx95j', 1789588832329, 1791835232329, 3, 10500, NULL, NULL, 1791230432329, 1789416032329, 1791662432568),
  ('cmv2tjwop007ym827gd35xca9', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwli0038m827n352kbe2', 'Email drip sequence copywriting', 'Email drip sequence copywriting. Owned delivery includes coordination with design and review sign-off.', 'DONE', 'URGENT', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk80001m8273lnmx95j', 1789502432329, 1791921632329, 5, 10500, NULL, NULL, 1791230432329, 1789329632329, 1791662432569),
  ('cmv2tjwoq0080m8278iuojn01', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwli0038m827n352kbe2', 'Post-launch performance review', 'Post-launch performance review. Break work into subtasks and track progress on the board.', 'CANCELLED', 'MEDIUM', NULL, 'cmv2tjwk80001m8273lnmx95j', 1789416032329, 1792008032329, 8, 10500, NULL, NULL, NULL, 1789243232329, 1791662432570),
  ('cmv2tjwos0082m827owziy8kd', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlk003em827snoprvvy', 'Define portal user roles', 'Define portal user roles. Coordinate with the team before shipping; follow the definition of done.', 'DONE', 'HIGH', 'cmv2tjwk90002m82726cedz5f', 'cmv2tjwk80001m8273lnmx95j', 1785787232329, 1792094432329, 1, 10500, NULL, NULL, 1791230432329, 1785614432329, 1791662432572),
  ('cmv2tjwot0084m827t7ydnkx1', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlk003em827snoprvvy', 'Design file exchange module', 'Design file exchange module. This item was prioritized during the latest planning cycle.', 'CANCELLED', 'LOW', NULL, 'cmv2tjwk80001m8273lnmx95j', 1785700832329, 1792180832329, 2, 10500, NULL, NULL, NULL, 1785528032329, 1791662432573),
  ('cmv2tjwot0086m827cgkipjmc', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlk003em827snoprvvy', 'Implement SSO with client identity providers', 'Implement SSO with client identity providers. Owned delivery includes coordination with design and review sign-off.', 'TODO', 'HIGH', 'cmv2tjwkd0007m827dck2ys5e', 'cmv2tjwk80001m8273lnmx95j', 1785614432329, 1792267232329, 3, 10500, NULL, NULL, NULL, 1785441632329, 1791662432574),
  ('cmv2tjwov0088m827nficsouw', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlk003em827snoprvvy', 'Reporting export to CSV/PDF', 'Reporting export to CSV/PDF. Break work into subtasks and track progress on the board.', 'BACKLOG', 'LOW', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk80001m8273lnmx95j', 1785528032329, 1792353632329, 5, 10500, NULL, NULL, NULL, 1785355232329, 1791662432575),
  ('cmv2tjwow008am827o6vqt2mu', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlk003em827snoprvvy', 'Permission matrix review', 'Permission matrix review. Coordinate with the team before shipping; follow the definition of done.', 'TODO', 'HIGH', 'cmv2tjwkf0009m827qopjy2j0', 'cmv2tjwk80001m8273lnmx95j', 1785441632329, 1792440032329, 8, 10500, NULL, NULL, NULL, 1785268832329, 1791662432576),
  ('cmv2tjwox008cm827c4pmvg93', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlk003em827snoprvvy', 'Session timeout policy', 'Session timeout policy. This item was prioritized during the latest planning cycle.', 'IN_REVIEW', 'LOW', 'cmv2tjwki000bm827ik6vg12b', 'cmv2tjwk80001m8273lnmx95j', 1785355232329, 1791230432329, 1, 10500, NULL, NULL, NULL, 1785182432329, 1791662432577),
  ('cmv2tjwoy008em827g3dxf53c', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlk003em827snoprvvy', 'White-label theming for client brands', 'White-label theming for client brands. Owned delivery includes coordination with design and review sign-off.', 'IN_PROGRESS', 'HIGH', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk80001m8273lnmx95j', 1785268832329, 1792612832329, 2, 10500, NULL, NULL, NULL, 1785096032329, 1791662432579),
  ('cmv2tjwp0008gm8279rpazx89', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlk003em827snoprvvy', 'Notification digest settings', 'Notification digest settings. Break work into subtasks and track progress on the board.', 'DONE', 'LOW', 'cmv2tjwk90002m82726cedz5f', 'cmv2tjwk80001m8273lnmx95j', 1785182432329, 1792699232329, 3, 10500, NULL, NULL, 1791230432329, 1785009632329, 1791662432580),
  ('cmv2tjwp0008im827fj0b7md0', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlk003em827snoprvvy', 'Data residency review for EU clients', 'Data residency review for EU clients. Coordinate with the team before shipping; follow the definition of done.', 'DONE', 'HIGH', 'cmv2tjwkg000am8272maeb2rl', 'cmv2tjwk80001m8273lnmx95j', 1785096032329, 1792785632329, 5, 10500, NULL, NULL, 1791230432329, 1784923232329, 1791662432581),
  ('cmv2tjwp2008km827q5mo6nt0', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlk003em827snoprvvy', 'Onboarding checklist automation', 'Onboarding checklist automation. This item was prioritized during the latest planning cycle.', 'DONE', 'LOW', 'cmv2tjwkd0007m827dck2ys5e', 'cmv2tjwk80001m8273lnmx95j', 1785009632329, 1792872032329, 8, 10500, NULL, NULL, 1791230432329, 1784836832329, 1791662432583),
  ('cmv2tjwp3008mm827zxo9wo2i', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlk003em827snoprvvy', 'Bulk invite client users', 'Bulk invite client users. Owned delivery includes coordination with design and review sign-off.', 'DONE', 'HIGH', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk80001m8273lnmx95j', 1784923232329, 1792958432329, 1, 10500, NULL, NULL, 1791230432329, 1784750432329, 1791662432584),
  ('cmv2tjwp5008om827hb2qv665', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlk003em827snoprvvy', 'Audit trail for portal actions', 'Audit trail for portal actions. Break work into subtasks and track progress on the board.', 'CANCELLED', 'LOW', NULL, 'cmv2tjwk80001m8273lnmx95j', 1784836832329, 1793044832329, 2, 10500, NULL, NULL, NULL, 1784664032329, 1791662432585),
  ('cmv2tjwp6008qm8279esbiugk', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlm003jm827y3gpu943', 'Define KPI taxonomy with clients', 'Define KPI taxonomy with clients. Coordinate with the team before shipping; follow the definition of done.', 'IN_PROGRESS', 'HIGH', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk80001m8273lnmx95j', 1789243232329, 1793131232329, 3, 10500, NULL, 'cmv2tjwlu0046m82714937tem', NULL, 1789070432329, 1791662432644),
  ('cmv2tjwp7008sm8276fotayru', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlm003jm827y3gpu943', 'Build chart component library', 'Build chart component library. This item was prioritized during the latest planning cycle.', 'DONE', 'LOW', 'cmv2tjwk90002m82726cedz5f', 'cmv2tjwk80001m8273lnmx95j', 1789156832329, 1793217632329, 5, 10500, NULL, NULL, 1791230432329, 1788984032329, 1791662432588),
  ('cmv2tjwp8008um827v37gwit2', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlm003jm827y3gpu943', 'Implement date-range filtering', 'Implement date-range filtering. Owned delivery includes coordination with design and review sign-off.', 'DONE', 'HIGH', 'cmv2tjwkg000am8272maeb2rl', 'cmv2tjwk80001m8273lnmx95j', 1789070432329, 1793304032329, 8, 10500, NULL, NULL, 1791230432329, 1788897632329, 1791662432589),
  ('cmv2tjwpa008wm827olxm2rgy', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlm003jm827y3gpu943', 'Add scheduled email reports', 'Add scheduled email reports. Break work into subtasks and track progress on the board.', 'DONE', 'LOW', 'cmv2tjwkd0007m827dck2ys5e', 'cmv2tjwk80001m8273lnmx95j', 1788984032329, 1793390432329, 1, 10500, NULL, NULL, 1791230432329, 1788811232329, 1791662432590),
  ('cmv2tjwpb008ym827szqmuv5b', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlm003jm827y3gpu943', 'Optimize query performance for large ranges', 'Optimize query performance for large ranges. Coordinate with the team before shipping; follow the definition of done.', 'DONE', 'HIGH', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk80001m8273lnmx95j', 1788897632329, 1793476832329, 2, 10500, NULL, NULL, 1791230432329, 1788724832329, 1791662432591),
  ('cmv2tjwpc0090m827u8rk0wj0', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlm003jm827y3gpu943', 'Client feedback session', 'Client feedback session. This item was prioritized during the latest planning cycle.', 'CANCELLED', 'LOW', NULL, 'cmv2tjwk80001m8273lnmx95j', 1788811232329, 1793563232329, 3, 10500, NULL, NULL, NULL, 1788638432329, 1791662432592),
  ('cmv2tjwpd0092m82716oq4u7n', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlm003jm827y3gpu943', 'Anomaly highlighting on trend lines', 'Anomaly highlighting on trend lines. Owned delivery includes coordination with design and review sign-off.', 'TODO', 'HIGH', 'cmv2tjwki000bm827ik6vg12b', 'cmv2tjwk80001m8273lnmx95j', 1788724832329, 1793649632329, 5, 10500, NULL, NULL, NULL, 1788552032329, 1791662432593),
  ('cmv2tjwpf0094m827ha3ozoni', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlm003jm827y3gpu943', 'Export dashboard snapshots', 'Export dashboard snapshots. Break work into subtasks and track progress on the board.', 'BACKLOG', 'LOW', 'cmv2tjwk80001m8273lnmx95j', 'cmv2tjwk80001m8273lnmx95j', 1788638432329, 1793736032329, 8, 10500, NULL, NULL, NULL, 1788465632329, 1791662432595),
  ('cmv2tjwpf0096m827ulr6kf5h', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlm003jm827y3gpu943', 'Cohort retention visualization', 'Cohort retention visualization. Coordinate with the team before shipping; follow the definition of done.', 'TODO', 'HIGH', 'cmv2tjwk90002m82726cedz5f', 'cmv2tjwk80001m8273lnmx95j', 1788552032329, 1791230432329, 1, 10500, NULL, NULL, NULL, 1788379232329, 1791662432596),
  ('cmv2tjwph0098m827d1jmizyn', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlm003jm827y3gpu943', 'Attribution model comparison view', 'Attribution model comparison view. This item was prioritized during the latest planning cycle.', 'IN_REVIEW', 'LOW', 'cmv2tjwkg000am8272maeb2rl', 'cmv2tjwk80001m8273lnmx95j', 1788465632329, 1791316832329, 2, 10500, NULL, NULL, NULL, 1788292832329, 1791662432597),
  ('cmv2tjwq1009am8277v622x7j', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlm003jm827y3gpu943', 'Custom metric builder prototype', 'Custom metric builder prototype. Owned delivery includes coordination with design and review sign-off.', 'IN_PROGRESS', 'HIGH', 'cmv2tjwkd0007m827dck2ys5e', 'cmv2tjwk80001m8273lnmx95j', 1788379232329, 1791403232329, 3, 10500, NULL, NULL, NULL, 1788206432329, 1791662432618),
  ('cmv2tjwq2009cm827h8znr66g', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwlm003jm827y3gpu943', 'Cache layer for expensive aggregates', 'Cache layer for expensive aggregates. Break work into subtasks and track progress on the board.', 'DONE', 'LOW', 'cmv2tjwkc0006m827ldg151yt', 'cmv2tjwk80001m8273lnmx95j', 1788292832329, 1791489632329, 5, 10500, NULL, NULL, 1791230432329, 1788120032329, 1791662432619),
  ('cmv2tjwq5009em827q5616e4v', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwln003om827whg1rlwg', 'Inventory existing documentation', 'Inventory existing documentation. Coordinate with the team before shipping; follow the definition of done.', 'TODO', 'HIGH', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwk60000m8279o1payok', 1790539232329, 1791576032329, 8, 10500, NULL, NULL, NULL, 1790366432329, 1791662432622),
  ('cmv2tjwq6009gm827bf3j37e1', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwln003om827whg1rlwg', 'Rewrite onboarding guide', 'Rewrite onboarding guide. This item was prioritized during the latest planning cycle.', 'BACKLOG', 'LOW', 'cmv2tjwk60000m8279o1payok', 'cmv2tjwk60000m8279o1payok', 1790452832329, 1791662432329, 1, 10500, NULL, NULL, NULL, 1790280032329, 1791662432623),
  ('cmv2tjwq7009im827nm301jeq', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwln003om827whg1rlwg', 'Document workspace permissions model', 'Document workspace permissions model. Owned delivery includes coordination with design and review sign-off.', 'TODO', 'HIGH', 'cmv2tjwkc0005m827i8ohmc9s', 'cmv2tjwk60000m8279o1payok', 1790366432329, 1791748832329, 2, 10500, NULL, NULL, NULL, 1790193632329, 1791662432624),
  ('cmv2tjwq9009km827cw8t2sp2', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwln003om827whg1rlwg', 'Create troubleshooting playbooks', 'Create troubleshooting playbooks. Break work into subtasks and track progress on the board.', 'IN_REVIEW', 'LOW', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwk60000m8279o1payok', 1790280032329, 1791835232329, 3, 10500, NULL, NULL, NULL, 1790107232329, 1791662432625),
  ('cmv2tjwq9009mm827xhepb6i7', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwln003om827whg1rlwg', 'Set up docs versioning', 'Set up docs versioning. Coordinate with the team before shipping; follow the definition of done.', 'IN_PROGRESS', 'HIGH', 'cmv2tjwk60000m8279o1payok', 'cmv2tjwk60000m8279o1payok', 1790193632329, 1791921632329, 5, 10500, NULL, NULL, NULL, 1790020832329, 1791662432626),
  ('cmv2tjwqa009om827qx69yq7p', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwln003om827whg1rlwg', 'Review and publish', 'Review and publish. This item was prioritized during the latest planning cycle.', 'DONE', 'LOW', 'cmv2tjwkc0005m827i8ohmc9s', 'cmv2tjwk60000m8279o1payok', 1790107232329, 1792008032329, 8, 10500, NULL, NULL, 1791230432329, 1789934432329, 1791662432627),
  ('cmv2tjwqc009qm827vl5x9mf3', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwln003om827whg1rlwg', 'Record walkthrough videos', 'Record walkthrough videos. Owned delivery includes coordination with design and review sign-off.', 'DONE', 'HIGH', 'cmv2tjwke0008m827o4rq4ja7', 'cmv2tjwk60000m8279o1payok', 1790020832329, 1792094432329, 1, 10500, NULL, NULL, 1791230432329, 1789848032329, 1791662432628);
INSERT INTO "Task" ("id", "workspaceId", "projectId", "title", "description", "status", "priority", "assigneeId", "creatorId", "startDate", "dueDate", "estimatedHours", "position", "parentTaskId", "milestoneId", "completedAt", "createdAt", "updatedAt") VALUES
  ('cmv2tjwqd009sm827q3drpm1k', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwln003om827whg1rlwg', 'Translate core guides to French', 'Translate core guides to French. Break work into subtasks and track progress on the board.', 'DONE', 'LOW', 'cmv2tjwk60000m8279o1payok', 'cmv2tjwk60000m8279o1payok', 1789934432329, 1792180832329, 2, 10500, NULL, NULL, 1791230432329, 1789761632329, 1791662432630),
  ('cmv2tjwqe009um827g639hdqu', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwln003om827whg1rlwg', 'API reference examples update', 'API reference examples update. Coordinate with the team before shipping; follow the definition of done.', 'DONE', 'HIGH', 'cmv2tjwkc0005m827i8ohmc9s', 'cmv2tjwk60000m8279o1payok', 1789848032329, 1792267232329, 3, 10500, NULL, NULL, 1791230432329, 1789675232329, 1791662432630),
  ('cmv2tjwqf009wm827imsjmg86', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwln003om827whg1rlwg', 'Style guide for technical writers', 'Style guide for technical writers. This item was prioritized during the latest planning cycle.', 'CANCELLED', 'LOW', NULL, 'cmv2tjwk60000m8279o1payok', 1789761632329, 1792353632329, 5, 10500, NULL, NULL, NULL, 1789588832329, 1791662432632),
  ('cmv2tjwqg009ym82724phdtt9', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwln003om827whg1rlwg', 'Feedback widget on docs pages', 'Feedback widget on docs pages. Owned delivery includes coordination with design and review sign-off.', 'TODO', 'HIGH', 'cmv2tjwk60000m8279o1payok', 'cmv2tjwk60000m8279o1payok', 1789675232329, 1792440032329, 8, 10500, NULL, NULL, NULL, 1789502432329, 1791662432633),
  ('cmv2tjwqi00a0m827xp36sjmi', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwln003om827whg1rlwg', 'Archive outdated runbooks', 'Archive outdated runbooks. Break work into subtasks and track progress on the board.', 'BACKLOG', 'LOW', 'cmv2tjwkc0005m827i8ohmc9s', 'cmv2tjwk60000m8279o1payok', 1789588832329, 1790971232329, 1, 10500, NULL, NULL, NULL, 1789416032329, 1791662432635);

-- TaskDependency (7 rows)
INSERT INTO "TaskDependency" ("id", "blockerTaskId", "blockedTaskId", "createdAt") VALUES
  ('cmv2tjwqs00a2m827dxlrif5s', 'cmv2tjwlw004am827j2qynx82', 'cmv2tjwlx004cm827vw4x3r9m', 1791662432645),
  ('cmv2tjwqt00a4m827jhcl41hs', 'cmv2tjwly004em8274tw4ricg', 'cmv2tjwm0004gm8275yzfrdtj', 1791662432646),
  ('cmv2tjwqu00a6m827qh4e1s25', 'cmv2tjwml005em827kvak5emd', 'cmv2tjwmm005im827ogbluitq', 1791662432646),
  ('cmv2tjwqv00a8m8273x3ffl88', 'cmv2tjwml005gm82726ecduae', 'cmv2tjwmp005om827g3czr5qd', 1791662432647),
  ('cmv2tjwqv00aam8278irmq6ki', 'cmv2tjwnl0068m827slm31oo6', 'cmv2tjwnm006am827j2qoauaw', 1791662432647),
  ('cmv2tjwqv00acm827f27y9af7', 'cmv2tjwog007km8277jkeoq4n', 'cmv2tjwoi007om827s6zo6k45', 1791662432648),
  ('cmv2tjwqw00aem827ux9vvxf6', 'cmv2tjwp6008qm8279esbiugk', 'cmv2tjwp7008sm8276fotayru', 1791662432649);

-- TaskLabel (67 rows)
INSERT INTO "TaskLabel" ("taskId", "labelId") VALUES
  ('cmv2tjwlx004cm827vw4x3r9m', 'cmv2tjwkz001nm827aj39jsve'),
  ('cmv2tjwly004em8274tw4ricg', 'cmv2tjwl0001pm827tgk4elfd'),
  ('cmv2tjwly004em8274tw4ricg', 'cmv2tjwl2001vm827v7c4zcwb'),
  ('cmv2tjwm0004im827rruld315', 'cmv2tjwl1001tm827xkts3brc'),
  ('cmv2tjwm6004mm827d6c4k20x', 'cmv2tjwkx001hm827tn9k0sep'),
  ('cmv2tjwm6004mm827d6c4k20x', 'cmv2tjwkz001nm827aj39jsve'),
  ('cmv2tjwm7004om82779guxcsq', 'cmv2tjwky001jm827ytoj47y5'),
  ('cmv2tjwma004um827biofa7de', 'cmv2tjwl0001pm827tgk4elfd'),
  ('cmv2tjwmc0050m827cgzffbtj', 'cmv2tjwl2001vm827v7c4zcwb'),
  ('cmv2tjwme0052m8274n0j8nvs', 'cmv2tjwkx001hm827tn9k0sep'),
  ('cmv2tjwme0052m8274n0j8nvs', 'cmv2tjwkz001nm827aj39jsve'),
  ('cmv2tjwmg0056m827ug3cr64m', 'cmv2tjwky001lm827zf8hv7q0'),
  ('cmv2tjwmj005am827xakl4df5', 'cmv2tjwl0001pm827tgk4elfd'),
  ('cmv2tjwmj005am827xakl4df5', 'cmv2tjwl2001vm827v7c4zcwb'),
  ('cmv2tjwmk005cm8279nrljn5c', 'cmv2tjwl1001rm827hyktglqv'),
  ('cmv2tjwmm005im827ogbluitq', 'cmv2tjwkx001hm827tn9k0sep'),
  ('cmv2tjwmp005om827g3czr5qd', 'cmv2tjwkz001nm827aj39jsve'),
  ('cmv2tjwmq005qm827lhpemxk9', 'cmv2tjwl0001pm827tgk4elfd'),
  ('cmv2tjwmq005qm827lhpemxk9', 'cmv2tjwl2001vm827v7c4zcwb'),
  ('cmv2tjwnb005um827sildc5lu', 'cmv2tjwl1001tm827xkts3brc'),
  ('cmv2tjwne005ym827ns5u6czf', 'cmv2tjwkx001hm827tn9k0sep'),
  ('cmv2tjwne005ym827ns5u6czf', 'cmv2tjwkz001nm827aj39jsve'),
  ('cmv2tjwnf0060m827b0zorb7g', 'cmv2tjwky001jm827ytoj47y5'),
  ('cmv2tjwnk0066m827juz0kegv', 'cmv2tjwl0001pm827tgk4elfd'),
  ('cmv2tjwnn006cm827r9nszkbc', 'cmv2tjwl2001vm827v7c4zcwb'),
  ('cmv2tjwnp006em827kasmbcru', 'cmv2tjwkx001hm827tn9k0sep'),
  ('cmv2tjwnp006em827kasmbcru', 'cmv2tjwkz001nm827aj39jsve'),
  ('cmv2tjwnr006im827q9dh2cil', 'cmv2tjwky001lm827zf8hv7q0'),
  ('cmv2tjwnw006mm8270b7oif9e', 'cmv2tjwl0001pm827tgk4elfd'),
  ('cmv2tjwnw006mm8270b7oif9e', 'cmv2tjwl2001vm827v7c4zcwb'),
  ('cmv2tjwnx006om827oxvx89cq', 'cmv2tjwl1001rm827hyktglqv'),
  ('cmv2tjwo0006um827k02iwjac', 'cmv2tjwkx001hm827tn9k0sep'),
  ('cmv2tjwo30070m827aekvt9nr', 'cmv2tjwkz001nm827aj39jsve'),
  ('cmv2tjwo50072m827zmsdeh90', 'cmv2tjwl0001pm827tgk4elfd'),
  ('cmv2tjwo50072m827zmsdeh90', 'cmv2tjwl2001vm827v7c4zcwb'),
  ('cmv2tjwo90076m827kv97v6tx', 'cmv2tjwl1001tm827xkts3brc'),
  ('cmv2tjwob007am827bs4c8aid', 'cmv2tjwkx001hm827tn9k0sep'),
  ('cmv2tjwob007am827bs4c8aid', 'cmv2tjwkz001nm827aj39jsve'),
  ('cmv2tjwoc007cm827a9ys5l4b', 'cmv2tjwky001jm827ytoj47y5'),
  ('cmv2tjwof007im827xks3ii83', 'cmv2tjwl0001pm827tgk4elfd'),
  ('cmv2tjwoi007om827s6zo6k45', 'cmv2tjwl8002bm827ry0gf9d9'),
  ('cmv2tjwoj007qm827ny06emrv', 'cmv2tjwl3001xm827bo12takr'),
  ('cmv2tjwoj007qm827ny06emrv', 'cmv2tjwl50023m8274car4sd7'),
  ('cmv2tjwom007um827j3fo1bf2', 'cmv2tjwl40021m827nrquaeqr'),
  ('cmv2tjwop007ym827gd35xca9', 'cmv2tjwl60025m827wpu3k6oy'),
  ('cmv2tjwop007ym827gd35xca9', 'cmv2tjwl8002bm827ry0gf9d9'),
  ('cmv2tjwoq0080m8278iuojn01', 'cmv2tjwl60027m8278k15a9ri'),
  ('cmv2tjwot0086m827cgkipjmc', 'cmv2tjwl3001xm827bo12takr'),
  ('cmv2tjwox008cm827c4pmvg93', 'cmv2tjwl50023m8274car4sd7'),
  ('cmv2tjwoy008em827g3dxf53c', 'cmv2tjwl60025m827wpu3k6oy');
INSERT INTO "TaskLabel" ("taskId", "labelId") VALUES
  ('cmv2tjwoy008em827g3dxf53c', 'cmv2tjwl8002bm827ry0gf9d9'),
  ('cmv2tjwp0008im827fj0b7md0', 'cmv2tjwl70029m827kroq0zcb'),
  ('cmv2tjwp3008mm827zxo9wo2i', 'cmv2tjwl3001xm827bo12takr'),
  ('cmv2tjwp3008mm827zxo9wo2i', 'cmv2tjwl50023m8274car4sd7'),
  ('cmv2tjwp5008om827hb2qv665', 'cmv2tjwl3001zm8273wbcyk8b'),
  ('cmv2tjwp8008um827v37gwit2', 'cmv2tjwl60025m827wpu3k6oy'),
  ('cmv2tjwpc0090m827u8rk0wj0', 'cmv2tjwl8002bm827ry0gf9d9'),
  ('cmv2tjwpd0092m82716oq4u7n', 'cmv2tjwl3001xm827bo12takr'),
  ('cmv2tjwpd0092m82716oq4u7n', 'cmv2tjwl50023m8274car4sd7'),
  ('cmv2tjwpf0096m827ulr6kf5h', 'cmv2tjwl40021m827nrquaeqr'),
  ('cmv2tjwq1009am8277v622x7j', 'cmv2tjwl60025m827wpu3k6oy'),
  ('cmv2tjwq1009am8277v622x7j', 'cmv2tjwl8002bm827ry0gf9d9'),
  ('cmv2tjwq2009cm827h8znr66g', 'cmv2tjwl60027m8278k15a9ri'),
  ('cmv2tjwqa009om827qx69yq7p', 'cmv2tjwlb002hm827fmmou3yn'),
  ('cmv2tjwqc009qm827vl5x9mf3', 'cmv2tjwlb002jm82796b9g706'),
  ('cmv2tjwqg009ym82724phdtt9', 'cmv2tjwlb002hm827fmmou3yn'),
  ('cmv2tjwqi00a0m827xp36sjmi', 'cmv2tjwl9002dm827ezrlv2ls');

-- User (12 rows)
INSERT INTO "User" ("id", "email", "passwordHash", "name", "avatarColor", "timezone", "locale", "themePref", "status", "createdAt", "updatedAt") VALUES
  ('cmv2tjwk60000m8279o1payok', 'owner@nexora.dev', 'c5e05b6f2d705eb7e93d7b87b32a46c8:3cb6fcba64a8502592d15230fdd941f28d6864d121de8db5271c95c0d6f5f14802e8b099dd15b5af012b066d2806e9f2eba682581e4b410f9b584f7f31af7973', 'Sarah Chen', '#6366f1', 'UTC', 'en', 'system', 'ACTIVE', 1791662432406, 1791662432406),
  ('cmv2tjwk80001m8273lnmx95j', 'admin@nexora.dev', 'c5e05b6f2d705eb7e93d7b87b32a46c8:3cb6fcba64a8502592d15230fdd941f28d6864d121de8db5271c95c0d6f5f14802e8b099dd15b5af012b066d2806e9f2eba682581e4b410f9b584f7f31af7973', 'Marcus Webb', '#06b6d4', 'UTC', 'en', 'system', 'ACTIVE', 1791662432408, 1791832243925),
  ('cmv2tjwk90002m82726cedz5f', 'pm@nexora.dev', 'c5e05b6f2d705eb7e93d7b87b32a46c8:3cb6fcba64a8502592d15230fdd941f28d6864d121de8db5271c95c0d6f5f14802e8b099dd15b5af012b066d2806e9f2eba682581e4b410f9b584f7f31af7973', 'Aisha Patel', '#ec4899', 'UTC', 'en', 'system', 'ACTIVE', 1791662432409, 1791662432409),
  ('cmv2tjwk90003m827juefdyeo', 'member@nexora.dev', 'c5e05b6f2d705eb7e93d7b87b32a46c8:3cb6fcba64a8502592d15230fdd941f28d6864d121de8db5271c95c0d6f5f14802e8b099dd15b5af012b066d2806e9f2eba682581e4b410f9b584f7f31af7973', 'Tom Becker', '#f97316', 'UTC', 'en', 'system', 'ACTIVE', 1791662432410, 1791662432410),
  ('cmv2tjwkb0004m827hbdryg5t', 'viewer@nexora.dev', 'c5e05b6f2d705eb7e93d7b87b32a46c8:3cb6fcba64a8502592d15230fdd941f28d6864d121de8db5271c95c0d6f5f14802e8b099dd15b5af012b066d2806e9f2eba682581e4b410f9b584f7f31af7973', 'Lena Fischer', '#22c55e', 'UTC', 'en', 'system', 'ACTIVE', 1791662432411, 1791662432411),
  ('cmv2tjwkc0005m827i8ohmc9s', 'david@nexora.dev', 'c5e05b6f2d705eb7e93d7b87b32a46c8:3cb6fcba64a8502592d15230fdd941f28d6864d121de8db5271c95c0d6f5f14802e8b099dd15b5af012b066d2806e9f2eba682581e4b410f9b584f7f31af7973', 'David Kim', '#14b8a6', 'UTC', 'en', 'system', 'ACTIVE', 1791662432412, 1791662432412),
  ('cmv2tjwkc0006m827ldg151yt', 'nina@nexora.dev', 'c5e05b6f2d705eb7e93d7b87b32a46c8:3cb6fcba64a8502592d15230fdd941f28d6864d121de8db5271c95c0d6f5f14802e8b099dd15b5af012b066d2806e9f2eba682581e4b410f9b584f7f31af7973', 'Nina Rossi', '#06b6d4', 'UTC', 'en', 'system', 'ACTIVE', 1791662432413, 1791662432413),
  ('cmv2tjwkd0007m827dck2ys5e', 'omar@nexora.dev', 'c5e05b6f2d705eb7e93d7b87b32a46c8:3cb6fcba64a8502592d15230fdd941f28d6864d121de8db5271c95c0d6f5f14802e8b099dd15b5af012b066d2806e9f2eba682581e4b410f9b584f7f31af7973', 'Omar Haddad', '#ef4444', 'UTC', 'en', 'system', 'ACTIVE', 1791662432413, 1791662432413),
  ('cmv2tjwke0008m827o4rq4ja7', 'grace@nexora.dev', 'c5e05b6f2d705eb7e93d7b87b32a46c8:3cb6fcba64a8502592d15230fdd941f28d6864d121de8db5271c95c0d6f5f14802e8b099dd15b5af012b066d2806e9f2eba682581e4b410f9b584f7f31af7973', 'Grace Okafor', '#a855f7', 'UTC', 'en', 'system', 'ACTIVE', 1791662432414, 1791662432414),
  ('cmv2tjwkf0009m827qopjy2j0', 'leo@nexora.dev', 'c5e05b6f2d705eb7e93d7b87b32a46c8:3cb6fcba64a8502592d15230fdd941f28d6864d121de8db5271c95c0d6f5f14802e8b099dd15b5af012b066d2806e9f2eba682581e4b410f9b584f7f31af7973', 'Leo Martins', '#eab308', 'UTC', 'en', 'system', 'ACTIVE', 1791662432415, 1791662432415),
  ('cmv2tjwkg000am8272maeb2rl', 'yuki@nexora.dev', 'c5e05b6f2d705eb7e93d7b87b32a46c8:3cb6fcba64a8502592d15230fdd941f28d6864d121de8db5271c95c0d6f5f14802e8b099dd15b5af012b066d2806e9f2eba682581e4b410f9b584f7f31af7973', 'Yuki Tanaka', '#f43f5e', 'UTC', 'en', 'system', 'ACTIVE', 1791662432416, 1791662432416),
  ('cmv2tjwki000bm827ik6vg12b', 'ella@nexora.dev', 'c5e05b6f2d705eb7e93d7b87b32a46c8:3cb6fcba64a8502592d15230fdd941f28d6864d121de8db5271c95c0d6f5f14802e8b099dd15b5af012b066d2806e9f2eba682581e4b410f9b584f7f31af7973', 'Ella Novak', '#10b981', 'UTC', 'en', 'system', 'ACTIVE', 1791662432419, 1791662432419);

-- Workspace (3 rows)
INSERT INTO "Workspace" ("id", "name", "slug", "description", "logoColor", "type", "teamSize", "timezone", "ownerId", "archivedAt", "createdAt", "updatedAt") VALUES
  ('cmv2tjwkm000dm827egw47sja', 'NEXORA Product Team', 'nexora-product', 'Core product development for the NEXORA platform.', '#6366f1', 'STARTUP', '11_50', 'UTC', 'cmv2tjwk60000m8279o1payok', NULL, 1781294432329, 1791662432422),
  ('cmv2tjwkr000um827cq3g0pae', 'Digital Agency', 'digital-agency', 'Client delivery teams for web, brand, and marketing engagements.', '#ec4899', 'AGENCY', '11_50', 'UTC', 'cmv2tjwk80001m8273lnmx95j', NULL, 1781294432329, 1791662432428),
  ('cmv2tjwkv0019m827a7g7rrgs', 'Startup Operations', 'startup-ops', 'Operations, hiring, and fundraising for an early-stage startup.', '#f97316', 'STARTUP', '1_10', 'UTC', 'cmv2tjwk60000m8279o1payok', NULL, 1781294432329, 1791662432431);

-- WorkspaceInvitation (2 rows)
INSERT INTO "WorkspaceInvitation" ("id", "workspaceId", "email", "role", "token", "status", "invitedById", "expiresAt", "createdAt") VALUES
  ('cmv2tjwu300i0m8274w2lf2bs', 'cmv2tjwkm000dm827egw47sja', 'newteammate@external.dev', 'MEMBER', '323d861dc167f5fc2c26b9be91ebc9530ed6ead4c8bb5080', 'PENDING', 'cmv2tjwk60000m8279o1payok', 1792267232329, 1791662432764),
  ('cmv2tjwu400i2m8276upslq2c', 'cmv2tjwkr000um827cq3g0pae', 'freelancer@studio.dev', 'VIEWER', 'accd169207096150894f816f5e920edcdb60a5c3c3654170', 'PENDING', 'cmv2tjwk80001m8273lnmx95j', 1792267232329, 1791662432765);

-- WorkspaceMember (20 rows)
INSERT INTO "WorkspaceMember" ("id", "workspaceId", "userId", "role", "createdAt") VALUES
  ('cmv2tjwkn000em827lysg8wxd', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk60000m8279o1payok', 'OWNER', 1783713632329),
  ('cmv2tjwkn000fm8270uzbec9i', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk80001m8273lnmx95j', 'ADMIN', 1784145632329),
  ('cmv2tjwkn000gm827kmd9nhfw', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90002m82726cedz5f', 'PROJECT_MANAGER', 1785268832329),
  ('cmv2tjwkn000hm8273jcu4w1q', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwk90003m827juefdyeo', 'MEMBER', 1786564832329),
  ('cmv2tjwko000im82722g93pv4', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkb0004m827hbdryg5t', 'VIEWER', 1785873632329),
  ('cmv2tjwko000jm8271tecmpii', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0005m827i8ohmc9s', 'MEMBER', 1784059232329),
  ('cmv2tjwko000km827b193bl3u', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkc0006m827ldg151yt', 'MEMBER', 1786305632329),
  ('cmv2tjwko000lm827qykt1hor', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwkd0007m827dck2ys5e', 'PROJECT_MANAGER', 1786737632329),
  ('cmv2tjwko000mm827ddzwyrb6', 'cmv2tjwkm000dm827egw47sja', 'cmv2tjwke0008m827o4rq4ja7', 'MEMBER', 1787083232329),
  ('cmv2tjwks000vm827gwv6uqu9', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwk80001m8273lnmx95j', 'OWNER', 1787860832329),
  ('cmv2tjwks000wm827dxfrg6hv', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwkc0006m827ldg151yt', 'ADMIN', 1785960032329),
  ('cmv2tjwks000xm8271d482us9', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwk90002m82726cedz5f', 'PROJECT_MANAGER', 1787774432329),
  ('cmv2tjwks000ym827ldoy8p6y', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwkf0009m827qopjy2j0', 'MEMBER', 1788033632329),
  ('cmv2tjwks000zm8276k377a2y', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwkg000am8272maeb2rl', 'MEMBER', 1786564832329),
  ('cmv2tjwks0010m827g1iuxo8r', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwki000bm827ik6vg12b', 'MEMBER', 1784232032329),
  ('cmv2tjwks0011m827hk7zeqrk', 'cmv2tjwkr000um827cq3g0pae', 'cmv2tjwkd0007m827dck2ys5e', 'MEMBER', 1783108832329),
  ('cmv2tjwkv001am8271bumd1x0', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwk60000m8279o1payok', 'OWNER', 1783022432329),
  ('cmv2tjwkv001bm827blregjxn', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwke0008m827o4rq4ja7', 'MEMBER', 1787342432329),
  ('cmv2tjwkv001cm827on5dprno', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwkc0005m827i8ohmc9s', 'MEMBER', 1787601632329),
  ('cmv2tjwkv001dm827xdvew05s', 'cmv2tjwkv0019m827a7g7rrgs', 'cmv2tjwkg000am8272maeb2rl', 'VIEWER', 1786132832329);

CREATE INDEX "ActivityLog_resourceType_resourceId_idx" ON "ActivityLog"("resourceType", "resourceId");
CREATE INDEX "ActivityLog_workspaceId_createdAt_idx" ON "ActivityLog"("workspaceId", "createdAt");
CREATE INDEX "Attachment_taskId_idx" ON "Attachment"("taskId");
CREATE INDEX "BillingEvent_workspaceId_createdAt_idx" ON "BillingEvent"("workspaceId", "createdAt");
CREATE INDEX "Comment_taskId_idx" ON "Comment"("taskId");
CREATE UNIQUE INDEX "Invoice_number_key" ON "Invoice"("number");
CREATE INDEX "Invoice_workspaceId_createdAt_idx" ON "Invoice"("workspaceId", "createdAt");
CREATE UNIQUE INDEX "Label_workspaceId_name_key" ON "Label"("workspaceId", "name");
CREATE INDEX "Milestone_projectId_idx" ON "Milestone"("projectId");
CREATE INDEX "Notification_userId_createdAt_idx" ON "Notification"("userId", "createdAt");
CREATE INDEX "Notification_userId_read_idx" ON "Notification"("userId", "read");
CREATE UNIQUE INDEX "PasswordResetToken_token_key" ON "PasswordResetToken"("token");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE UNIQUE INDEX "ProjectMember_projectId_userId_key" ON "ProjectMember"("projectId", "userId");
CREATE INDEX "ProjectMember_userId_idx" ON "ProjectMember"("userId");
CREATE INDEX "Project_ownerId_idx" ON "Project"("ownerId");
CREATE INDEX "Project_workspaceId_status_idx" ON "Project"("workspaceId", "status");
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");
CREATE INDEX "Session_userId_idx" ON "Session"("userId");
CREATE UNIQUE INDEX "Subscription_workspaceId_key" ON "Subscription"("workspaceId");
CREATE INDEX "TaskDependency_blockedTaskId_idx" ON "TaskDependency"("blockedTaskId");
CREATE UNIQUE INDEX "TaskDependency_blockerTaskId_blockedTaskId_key" ON "TaskDependency"("blockerTaskId", "blockedTaskId");
CREATE INDEX "TaskLabel_labelId_idx" ON "TaskLabel"("labelId");
CREATE INDEX "Task_assigneeId_idx" ON "Task"("assigneeId");
CREATE INDEX "Task_dueDate_idx" ON "Task"("dueDate");
CREATE INDEX "Task_parentTaskId_idx" ON "Task"("parentTaskId");
CREATE INDEX "Task_projectId_status_idx" ON "Task"("projectId", "status");
CREATE INDEX "Task_workspaceId_idx" ON "Task"("workspaceId");
CREATE INDEX "User_email_idx" ON "User"("email");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE INDEX "WorkspaceInvitation_email_idx" ON "WorkspaceInvitation"("email");
CREATE UNIQUE INDEX "WorkspaceInvitation_token_key" ON "WorkspaceInvitation"("token");
CREATE INDEX "WorkspaceInvitation_workspaceId_idx" ON "WorkspaceInvitation"("workspaceId");
CREATE INDEX "WorkspaceMember_userId_idx" ON "WorkspaceMember"("userId");
CREATE UNIQUE INDEX "WorkspaceMember_workspaceId_userId_key" ON "WorkspaceMember"("workspaceId", "userId");
CREATE INDEX "Workspace_ownerId_idx" ON "Workspace"("ownerId");
CREATE UNIQUE INDEX "Workspace_slug_key" ON "Workspace"("slug");
COMMIT;
PRAGMA foreign_keys=ON;
