export const dynamic = "force-dynamic";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantCard } from "./_components/TenantCard";
import { ApiKeysManager } from "./_components/ApiKeysManager";
import { FeatureFlagsCard } from "./_components/FeatureFlagsCard";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-2">
          Manage tenant configuration, API keys, and feature flags
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="feature-flags">Feature Flags</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <TenantCard />
        </TabsContent>

        <TabsContent value="api-keys" className="mt-6">
          <ApiKeysManager />
        </TabsContent>

        <TabsContent value="feature-flags" className="mt-6">
          <FeatureFlagsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
