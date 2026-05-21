"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("event-triggered");
  const [channels, setChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChannelChange = (channel: string, checked: boolean) => {
    if (checked) {
      setChannels((prev) => [...prev, channel]);
    } else {
      setChannels((prev) => prev.filter((c) => c !== channel));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const apiKey = localStorage.getItem("engage_api_key") ?? "";

    try {
      const res = await fetch(`${API_URL}/v1/campaigns`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          type,
          channels,
          status: "draft",
        }),
      });

      if (!res.ok) {
        setError("Error al crear la campaña");
        return;
      }

      const campaign = await res.json();
      router.push(`/campaigns/${campaign.id}`);
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="-ml-3">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Nueva campaña</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Crear campaña</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">
                Nombre de la campaña
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="ej: Black Friday 2024"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="event-triggered">Disparado por evento</option>
                <option value="scheduled">Programado</option>
                <option value="recurring">Recurrente</option>
                <option value="voice">Voz</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-3 block">Canales</label>
              <div className="space-y-2">
                {["email", "sms", "push", "whatsapp", "voice"].map(
                  (channel) => (
                    <label key={channel} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={channels.includes(channel)}
                        onChange={(e) =>
                          handleChannelChange(channel, e.target.checked)
                        }
                        className="rounded"
                      />
                      <span className="text-sm capitalize">{channel}</span>
                    </label>
                  ),
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={!name || loading}>
                {loading ? "Creando..." : "Crear campaña"}
              </Button>
              <Link href="/campaigns">
                <Button type="button" variant="outline">
                  Cancelar
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
