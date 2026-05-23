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

interface Tenant {
  id: string;
  slug: string;
  name: string;
  plan: string;
  settings: Record<string, unknown>;
  brandingConfig: Record<string, unknown>;
  createdAt: string;
}

interface AIConfig {
  provider?: string;
  model?: string;
  toneInstructions?: string;
}

export function TenantCard() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    apiFetch(`/admin/tenant`, {})
      .then((res) => (res.ok ? res.json() : null))
      .then((data: Tenant | null) => {
        if (data) {
          setTenant(data);
          setName(data.name);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch(`/admin/tenant`, {
        method: "PUT",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({ name }),
      });
      if (res.ok) {
        const updated: Tenant = await res.json();
        setTenant(updated);
        setEditing(false);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  const aiConfig = (tenant?.settings as { aiConfig?: AIConfig } | undefined)
    ?.aiConfig;

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-40 bg-muted rounded animate-pulse" />
        <div className="h-32 bg-muted rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Tenant</CardTitle>
              <CardDescription>
                General configuration for your tenant
              </CardDescription>
            </div>
            {!editing && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setEditing(true)}
              >
                Edit
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal text-muted-foreground">
              Name
            </Label>
            {editing ? (
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-64"
              />
            ) : (
              <span className="font-medium">{tenant?.name}</span>
            )}
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal text-muted-foreground">
              Slug
            </Label>
            <code className="text-sm bg-muted px-2 py-0.5 rounded">
              {tenant?.slug}
            </code>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal text-muted-foreground">
              Plan
            </Label>
            <Badge className="capitalize">{tenant?.plan ?? "starter"}</Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal text-muted-foreground">
              Tenant ID
            </Label>
            <code className="text-xs bg-muted px-2 py-0.5 rounded">
              {tenant?.id}
            </code>
          </div>

          {editing && (
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setEditing(false);
                  setName(tenant?.name ?? "");
                }}
              >
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={saving}>
                {saving ? "Saving..." : "Save"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI Configuration</CardTitle>
          <CardDescription>
            AI provider settings for this tenant
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal text-muted-foreground">
              Active Provider
            </Label>
            <Badge variant="outline" className="capitalize">
              {aiConfig?.provider ?? "anthropic"}
            </Badge>
          </div>
          <Separator />
          <div className="flex items-center justify-between">
            <Label className="text-sm font-normal text-muted-foreground">
              Available Providers
            </Label>
            <div className="flex gap-1 flex-wrap justify-end">
              {["Anthropic", "OpenAI", "Gemini", "Mistral", "Ollama"].map(
                (p) => (
                  <Badge key={p} variant="outline" className="text-xs">
                    {p}
                  </Badge>
                ),
              )}
            </div>
          </div>
          {aiConfig?.toneInstructions && (
            <>
              <Separator />
              <div>
                <Label className="text-sm font-normal text-muted-foreground block mb-2">
                  Tone Instructions
                </Label>
                <p className="text-sm bg-muted rounded p-3">
                  {aiConfig.toneInstructions}
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
