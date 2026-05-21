"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Edit, Save, X } from "lucide-react";

interface ChannelProvider {
  id: string;
  channel: string;
  provider: string;
  isActive: boolean;
  isDefault: boolean;
  configEncrypted?: string;
}

const API_URL =
  process.env["INTERNAL_API_URL"] ??
  process.env["NEXT_PUBLIC_API_URL"] ??
  "http://localhost:3001";

const CHANNEL_EMOJI: Record<string, string> = {
  email: "📧",
  sms: "💬",
  push: "🔔",
  whatsapp: "💚",
  voice: "📞",
  "in-app": "📱",
};

const CHANNEL_NAMES: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  whatsapp: "WhatsApp",
  voice: "Voz",
  "in-app": "In-App",
};

export function ChannelsList() {
  const [providers, setProviders] = useState<ChannelProvider[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState("");

  useEffect(() => {
    fetchProviders();
  }, []);

  async function fetchProviders() {
    try {
      const apiKey = localStorage.getItem("engage_api_key") ?? "";
      const res = await fetch(`${API_URL}/v1/providers`, {
        headers: { "x-api-key": apiKey },
      });
      const data = await res.json();
      setProviders(data);
    } catch (err) {
      console.error("Failed to fetch providers:", err);
    } finally {
      setLoading(false);
    }
  }

  const startEdit = (provider: ChannelProvider) => {
    setEditing(provider.id);
    setEditConfig(provider.configEncrypted || "");
  };

  const cancelEdit = () => {
    setEditing(null);
    setEditConfig("");
  };

  const saveConfig = async (providerId: string) => {
    try {
      const apiKey = localStorage.getItem("engage_api_key") ?? "";
      await fetch(`${API_URL}/v1/providers/${providerId}`, {
        method: "PUT",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ configEncrypted: editConfig }),
      });
      await fetchProviders();
      setEditing(null);
    } catch (err) {
      console.error("Failed to save provider config:", err);
    }
  };

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-20" />
          </Card>
        ))}
      </div>
    );
  }

  // Group providers by channel
  const providersByChannel: Record<string, ChannelProvider[]> = {};
  for (const p of providers) {
    if (!providersByChannel[p.channel]) {
      providersByChannel[p.channel] = [];
    }
    const channel = providersByChannel[p.channel];
    if (channel) {
      channel.push(p);
    }
  }

  return (
    <div className="space-y-6">
      {Object.entries(providersByChannel).map(([channel, channelProviders]) => (
        <Card key={channel}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <span className="text-3xl">{CHANNEL_EMOJI[channel] || "🔧"}</span>
              {CHANNEL_NAMES[channel] || channel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {channelProviders.map((provider) => (
              <div
                key={provider.id}
                className="border rounded-lg p-4 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm">{provider.provider}</p>
                    <div className="flex gap-2 mt-2">
                      <Badge
                        variant={provider.isActive ? "default" : "secondary"}
                      >
                        {provider.isActive ? "✓ Activo" : "Inactivo"}
                      </Badge>
                      {provider.isDefault && (
                        <Badge variant="outline">Por defecto</Badge>
                      )}
                    </div>
                  </div>
                  {editing !== provider.id && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => startEdit(provider)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  )}
                </div>

                {editing === provider.id && (
                  <div className="space-y-3 border-t pt-4">
                    <div>
                      <label className="text-sm font-medium">
                        Configuración (JSON)
                      </label>
                      <textarea
                        value={editConfig}
                        onChange={(e) => setEditConfig(e.target.value)}
                        className="w-full h-32 p-3 border rounded font-mono text-sm"
                        placeholder='{"apiKey": "...", "accountSid": "..."}'
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => saveConfig(provider.id)}>
                        <Save className="h-4 w-4 mr-2" />
                        Guardar
                      </Button>
                      <Button size="sm" variant="outline" onClick={cancelEdit}>
                        <X className="h-4 w-4 mr-2" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
