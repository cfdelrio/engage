"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { ConditionGroup } from "./ConditionGroup";
import type { ConditionGroupNode } from "./ConditionGroup";
import { ActionsList } from "./ActionsList";
import { RulePreview } from "./RulePreview";
import { Save } from "lucide-react";

interface RuleData {
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: ConditionGroupNode;
  actions: Array<{
    type: string;
    params: Record<string, unknown>;
  }>;
  cooldownSeconds?: number;
}

export function RuleBuilder({ ruleId }: { ruleId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [fetchLoading, setFetchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rule, setRule] = useState<RuleData>({
    name: "",
    description: "",
    enabled: true,
    priority: 0,
    conditions: {
      operator: "AND",
      conditions: [],
    },
    actions: [],
    cooldownSeconds: undefined,
  });

  // Load existing rule when editing
  useEffect(() => {
    if (!ruleId) return;
    setFetchLoading(true);
    apiFetch(`/v1/rules/${ruleId}`, {})
      .then((r) => r.json())
      .then((data) => {
        setRule({
          name: data.name ?? "",
          description: data.description ?? "",
          enabled: data.enabled ?? true,
          priority: data.priority ?? 0,
          conditions: data.conditions ?? { operator: "AND", conditions: [] },
          actions: data.actions ?? [],
          cooldownSeconds: data.cooldownSeconds ?? undefined,
        });
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Failed to load rule"),
      )
      .finally(() => setFetchLoading(false));
  }, [ruleId]);

  // Prefill from AI Rule Builder ("Edit manually" flow)
  useEffect(() => {
    if (ruleId) return;
    try {
      const raw = localStorage.getItem("ai-prefill-rule");
      if (!raw) return;
      localStorage.removeItem("ai-prefill-rule");
      const prefill = JSON.parse(raw) as Partial<RuleData>;
      setRule((prev) => ({
        ...prev,
        ...(prefill.name && { name: prefill.name }),
        ...(prefill.description !== undefined && {
          description: prefill.description,
        }),
        ...(prefill.conditions && {
          conditions: prefill.conditions as RuleData["conditions"],
        }),
        ...(prefill.actions && { actions: prefill.actions }),
        ...(prefill.cooldownSeconds != null && {
          cooldownSeconds: prefill.cooldownSeconds,
        }),
      }));
    } catch {
      // ignore malformed prefill data
    }
  }, [ruleId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rule.name.trim()) {
      setError("Rule name is required");
      return;
    }
    if (rule.conditions.conditions.length === 0) {
      setError("At least one condition is required");
      return;
    }
    if (rule.actions.length === 0) {
      setError("At least one action is required");
      return;
    }

    try {
      setLoading(true);
      const method = ruleId ? "PUT" : "POST";
      const url = ruleId ? `/v1/rules/${ruleId}` : `/v1/rules`;

      const response = await apiFetch(url, {
        method,
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify(rule),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Failed to save rule");
      }

      router.push("/rules");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (fetchLoading) {
    return (
      <div className="space-y-4 max-w-6xl">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-6xl">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2">
          <Label htmlFor="name">Rule Name *</Label>
          <Input
            id="name"
            value={rule.name}
            onChange={(e) => setRule({ ...rule, name: e.target.value })}
            placeholder="e.g., High-value users welcome campaign"
            required
          />
        </div>
        <div>
          <Label htmlFor="priority">Priority</Label>
          <Input
            id="priority"
            type="number"
            value={rule.priority}
            onChange={(e) =>
              setRule({ ...rule, priority: parseInt(e.target.value) })
            }
            min={0}
            max={100}
          />
        </div>
      </div>

      <div>
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          value={rule.description || ""}
          onChange={(e) => setRule({ ...rule, description: e.target.value })}
          placeholder="Why this rule exists and what it does"
          rows={3}
        />
      </div>

      <Tabs defaultValue="conditions" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="conditions">Conditions</TabsTrigger>
          <TabsTrigger value="actions">Actions</TabsTrigger>
          <TabsTrigger value="preview">Preview</TabsTrigger>
        </TabsList>

        <TabsContent value="conditions">
          <Card>
            <CardHeader>
              <div className="flex justify-between items-center">
                <CardTitle>Condition Group</CardTitle>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setRule({
                        ...rule,
                        conditions: {
                          ...rule.conditions,
                          operator:
                            rule.conditions.operator === "AND" ? "OR" : "AND",
                        },
                      });
                    }}
                  >
                    Switch to{" "}
                    {rule.conditions.operator === "AND" ? "OR" : "AND"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Badge variant="secondary">
                  {rule.conditions.operator} logic
                </Badge>
                <p className="text-sm text-muted-foreground mt-2">
                  {rule.conditions.operator === "AND"
                    ? "All conditions must be true"
                    : "At least one condition must be true"}
                </p>
              </div>

              <ConditionGroup
                group={rule.conditions}
                onChange={(updated) =>
                  setRule({ ...rule, conditions: updated })
                }
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="actions">
          <Card>
            <CardHeader>
              <CardTitle>Actions</CardTitle>
            </CardHeader>
            <CardContent>
              <ActionsList
                actions={rule.actions}
                onChange={(updated) => setRule({ ...rule, actions: updated })}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="preview">
          <RulePreview rule={rule} />
        </TabsContent>
      </Tabs>

      <div className="flex gap-2 justify-between">
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="enabled"
            checked={rule.enabled}
            onChange={(e) => setRule({ ...rule, enabled: e.target.checked })}
          />
          <Label htmlFor="enabled" className="cursor-pointer">
            Enabled
          </Label>
        </div>

        <div className="flex gap-2">
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={loading} className="gap-2">
            <Save className="h-4 w-4" />
            {loading ? "Saving..." : "Save Rule"}
          </Button>
        </div>
      </div>
    </form>
  );
}
