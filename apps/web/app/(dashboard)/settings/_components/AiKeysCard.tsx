"use client";

import { apiFetch } from "@/lib/api-client";
import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";

interface AiKeyStatus {
  hasAnthropicKey: boolean;
  hasOpenaiKey: boolean;
}

type Provider = "anthropic" | "openai";

interface ProviderRowProps {
  label: string;
  provider: Provider;
  isConfigured: boolean;
  onSave: (provider: Provider, key: string) => Promise<void>;
  onDelete: (provider: Provider) => Promise<void>;
}

function ProviderRow({
  label,
  provider,
  isConfigured,
  onSave,
  onDelete,
}: ProviderRowProps) {
  const [editing, setEditing] = useState(false);
  const [keyValue, setKeyValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const handleSave = async () => {
    if (!keyValue.trim()) return;
    setSaving(true);
    try {
      await onSave(provider, keyValue.trim());
      setKeyValue("");
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await onDelete(provider);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Label className="text-sm font-normal text-muted-foreground">
            {label}
          </Label>
          {isConfigured ? (
            <Badge variant="default" className="text-xs">
              Configurada
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs text-muted-foreground">
              Sin configurar
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isConfigured && !editing && (
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive text-xs h-7"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </Button>
          )}
          {!editing && (
            <Button
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onClick={() => setEditing(true)}
            >
              {isConfigured ? "Reemplazar" : "Configurar"}
            </Button>
          )}
        </div>
      </div>
      {editing && (
        <div className="flex items-center gap-2 pt-1">
          <Input
            type="password"
            placeholder={provider === "anthropic" ? "sk-ant-..." : "sk-..."}
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            className="flex-1 font-mono text-sm"
            autoFocus
          />
          <Button
            size="sm"
            className="h-9 shrink-0"
            onClick={handleSave}
            disabled={saving || !keyValue.trim()}
          >
            {saving ? "Guardando..." : "Guardar"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 shrink-0"
            onClick={() => {
              setEditing(false);
              setKeyValue("");
            }}
          >
            Cancelar
          </Button>
        </div>
      )}
    </div>
  );
}

export function AiKeysCard() {
  const [status, setStatus] = useState<AiKeyStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await apiFetch("/admin/tenant/ai-keys", {});
      if (res.ok) {
        const data: AiKeyStatus = await res.json();
        setStatus(data);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchStatus();
  }, []);

  const handleSave = async (provider: Provider, key: string) => {
    setError(null);
    const res = await apiFetch("/admin/tenant/ai-keys", {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ provider, key }),
    });
    if (res.ok) {
      await fetchStatus();
    } else {
      setError(
        "No se pudo guardar la clave. Verificá que el servidor esté configurado.",
      );
    }
  };

  const handleDelete = async (provider: Provider) => {
    setError(null);
    const res = await apiFetch(`/admin/tenant/ai-keys/${provider}`, {
      method: "DELETE",
    });
    if (res.ok || res.status === 204) {
      await fetchStatus();
    }
  };

  if (loading) {
    return <div className="h-40 bg-muted rounded animate-pulse" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Claves de modelos de IA</CardTitle>
        <CardDescription>
          Configurá las API keys para los proveedores de IA. Las claves se
          almacenan cifradas.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <ProviderRow
          label="Anthropic"
          provider="anthropic"
          isConfigured={status?.hasAnthropicKey ?? false}
          onSave={handleSave}
          onDelete={handleDelete}
        />
        <Separator />
        <ProviderRow
          label="OpenAI"
          provider="openai"
          isConfigured={status?.hasOpenaiKey ?? false}
          onSave={handleSave}
          onDelete={handleDelete}
        />
        <Separator />
        <p className="text-xs text-muted-foreground">
          Las claves se cifran con AES-256-GCM antes de almacenarse. Solo se
          muestra si están configuradas, nunca el valor real.
        </p>
      </CardContent>
    </Card>
  );
}
