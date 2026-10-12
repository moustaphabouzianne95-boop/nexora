'use client'

import * as React from 'react'
import { useAppStore } from '@/store/app-store'
import { User, Building2, Users, CreditCard } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ProfileTab } from '@/components/settings/profile-tab'
import { WorkspaceTab } from '@/components/settings/workspace-tab'
import { BillingTab } from '@/components/settings/billing-tab'
import { TeamManager } from '@/components/team/members-shared'

const TABS = [
  { value: 'profile' as const, label: 'Profile', icon: User },
  { value: 'workspace' as const, label: 'Workspace', icon: Building2 },
  { value: 'members' as const, label: 'Members', icon: Users },
  { value: 'billing' as const, label: 'Billing', icon: CreditCard },
]

export default function SettingsView() {
  const session = useAppStore((s) => s.session)
  const view = useAppStore((s) => s.view)
  const navigate = useAppStore((s) => s.navigate)
  const wsId = session?.currentWorkspaceId

  const activeTab = view.name === 'settings' && view.settingsTab ? view.settingsTab : 'profile'

  const onTabChange = (tab: string) => {
    // keep header breadcrumb + deep links in sync with the store
    navigate('settings', { settingsTab: tab as 'profile' | 'workspace' | 'members' | 'billing' })
  }

  if (!wsId) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground">Manage your account, workspace, team, and billing.</p>
      </div>

      <Tabs value={activeTab} onValueChange={onTabChange} className="gap-6">
        <TabsList className="grid h-11 w-full max-w-xl grid-cols-4">
          {TABS.map((t) => (
            <TabsTrigger key={t.value} value={t.value} className="gap-1.5">
              <t.icon className="h-4 w-4" aria-hidden />
              <span>{t.label}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="profile">
          <ProfileTab />
        </TabsContent>
        <TabsContent value="workspace">
          <WorkspaceTab wsId={wsId} />
        </TabsContent>
        <TabsContent value="members">
          <TeamManager wsId={wsId} title="Members" headingLevel="h2" />
        </TabsContent>
        <TabsContent value="billing">
          <BillingTab wsId={wsId} />
        </TabsContent>
      </Tabs>
    </div>
  )
}
