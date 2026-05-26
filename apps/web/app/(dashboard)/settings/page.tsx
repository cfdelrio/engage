export const dynamic = "force-dynamic";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { TenantCard } from "./_components/TenantCard";
import { ApiKeysManager } from "./_components/ApiKeysManager";
import { FeatureFlagsCard } from "./_components/FeatureFlagsCard";
import { AiKeysCard } from "./_components/AiKeysCard";

export default function SettingsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[26px] font-bold tracking-tight">Configuración</h1>
        <p className="text-muted-foreground mt-2">
          Administrá la configuración del tenant, las API keys y las
          funcionalidades
        </p>
      </div>

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="api-keys">API Keys</TabsTrigger>
          <TabsTrigger value="ai-models">Modelos de IA</TabsTrigger>
          <TabsTrigger value="feature-flags">Funcionalidades</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-6">
          <TenantCard />
        </TabsContent>

        <TabsContent value="api-keys" className="mt-6">
          <ApiKeysManager />
        </TabsContent>

        <TabsContent value="ai-models" className="mt-6">
          <AiKeysCard />
        </TabsContent>

        <TabsContent value="feature-flags" className="mt-6">
          <FeatureFlagsCard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
