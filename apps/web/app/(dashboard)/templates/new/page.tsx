"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft } from "lucide-react";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export default function NewTemplatePage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const apiKey = localStorage.getItem("engage_api_key") ?? "";

    try {
      const res = await fetch(`${API_URL}/v1/templates`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          channel,
          ...(subject ? { subject } : {}),
          body,
        }),
      });

      if (!res.ok) {
        setError("Error al crear el template");
        return;
      }

      const template = await res.json();
      router.push(`/templates/${template.id}`);
    } catch {
      setError("Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/templates">
          <Button variant="ghost" size="sm" className="-ml-3">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Nuevo template</h1>
      </div>

      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="text-base">Crear template</CardTitle>
          <p className="text-xs text-muted-foreground mt-2">
            Usa {"{{variable}}"} para placeholders. Ej: {"{{user.email}}"},{" "}
            {"{{event.data}}"}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded text-sm">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-2 block">Nombre</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="ej: Welcome Email"
                  required
                />
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">Canal</label>
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value)}
                  className="w-full px-3 py-2 border rounded-md bg-background"
                >
                  <option value="email">Email</option>
                  <option value="sms">SMS</option>
                  <option value="push">Push</option>
                  <option value="whatsapp">WhatsApp</option>
                  <option value="voice">Voice</option>
                </select>
              </div>
            </div>

            {channel === "email" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Asunto</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="ej: ¡Bienvenido {{user.firstName}}!"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Cuerpo</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder={
                  channel === "email"
                    ? "Cuerpo del email..."
                    : channel === "sms"
                      ? "Mensaje SMS (160 chars)..."
                      : channel === "push"
                        ? "Título + descripción..."
                        : channel === "whatsapp"
                          ? "Mensaje WhatsApp..."
                          : "Script de voz..."
                }
                required
                className="w-full px-3 py-2 border rounded-md bg-background font-mono text-sm min-h-32"
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={!name || !body || loading}>
                {loading ? "Creando..." : "Crear template"}
              </Button>
              <Link href="/templates">
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
