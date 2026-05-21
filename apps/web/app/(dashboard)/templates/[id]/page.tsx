"use client";

import { useEffect, useState, use } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ArrowLeft, Copy } from "lucide-react";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface Template {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
  bodyHtml?: string;
  version: number;
  variables: string[];
  createdAt: string;
}

export default function TemplateDetailPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = use(props.params);
  const templateId = params.id;

  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const apiKey = localStorage.getItem("engage_api_key") ?? "";
    let cancelled = false;

    fetch(`${API_URL}/v1/templates/${templateId}`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Template | null) => {
        if (cancelled) return;
        if (data) {
          setTemplate(data);
          setName(data.name);
          setSubject(data.subject ?? "");
          setBody(data.body);
        } else {
          setError("Template no encontrado");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Error al cargar");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [templateId]);

  const handleSave = async () => {
    if (!template) return;
    setSaving(true);
    const apiKey = localStorage.getItem("engage_api_key") ?? "";

    try {
      const res = await fetch(`${API_URL}/v1/templates/${templateId}`, {
        method: "PUT",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          subject: template.channel === "email" ? subject : undefined,
          body,
        }),
      });

      if (res.ok) {
        const updated = await res.json();
        setTemplate(updated);
        setEditing(false);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-64 bg-muted rounded animate-pulse" />
        <div className="h-48 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="space-y-4">
        <Link href="/templates">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
        <p className="text-sm text-muted-foreground">{error ?? "Sin datos"}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Link href="/templates">
          <Button variant="ghost" size="sm" className="-ml-3">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Volver
          </Button>
        </Link>
        <div className="flex items-center gap-2 mt-2">
          <h1 className="text-2xl font-semibold">{template.name}</h1>
          <Badge>{template.channel}</Badge>
          <Badge variant="outline">v{template.version}</Badge>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">
              {editing ? "Editar" : "Contenido"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Nombre</label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!editing}
                className="disabled:opacity-50"
              />
            </div>

            {template.channel === "email" && (
              <div>
                <label className="text-sm font-medium mb-2 block">Asunto</label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  disabled={!editing}
                  className="disabled:opacity-50 font-mono text-xs"
                />
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">Cuerpo</label>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                disabled={!editing}
                className="w-full px-3 py-2 border rounded-md bg-background font-mono text-xs min-h-48 disabled:opacity-50"
              />
            </div>

            {!editing && (
              <Button onClick={() => setEditing(true)}>Editar</Button>
            )}

            {editing && (
              <div className="flex gap-2 pt-4">
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? "Guardando..." : "Guardar cambios"}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditing(false);
                    setName(template.name);
                    setSubject(template.subject ?? "");
                    setBody(template.body);
                  }}
                >
                  Cancelar
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Variables</CardTitle>
          </CardHeader>
          <CardContent>
            {template.variables.length === 0 ? (
              <p className="text-xs text-muted-foreground">
                Sin variables detectadas
              </p>
            ) : (
              <div className="space-y-2">
                {template.variables.map((v) => (
                  <div key={v} className="flex items-center gap-2">
                    <code className="flex-1 text-xs bg-muted px-2 py-1 rounded">
                      {"{{"}
                      {v}
                      {"}"}
                    </code>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        navigator.clipboard.writeText(`{{${v}}}`);
                      }}
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
