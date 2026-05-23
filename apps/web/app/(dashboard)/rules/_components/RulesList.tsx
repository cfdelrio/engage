"use client";

import { apiFetch } from "@/lib/api-client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Edit,
} from "lucide-react";

interface Rule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: unknown;
  actions: unknown;
  cooldownSeconds?: number;
}

export function RulesList() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    apiFetch(`/v1/rules`, {})
      .then((r) => r.json())
      .then((data: unknown) => setRules(Array.isArray(data) ? data : []))
      .catch(() => setRules([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-16" />
          </Card>
        ))}
      </div>
    );
  }

  if (rules.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32 text-muted-foreground">
          No hay reglas configuradas
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {rules.map((rule) => (
        <Card key={rule.id} className="overflow-hidden">
          <CardHeader
            className="cursor-pointer py-4 hover:bg-muted/50 transition-colors"
            onClick={() =>
              setExpanded((prev) => {
                const next = new Set(prev);
                if (next.has(rule.id)) next.delete(rule.id);
                else next.add(rule.id);
                return next;
              })
            }
          >
            <div className="flex items-center gap-3">
              {rule.enabled ? (
                <CheckCircle className="h-4 w-4 text-green-500 flex-shrink-0" />
              ) : (
                <XCircle className="h-4 w-4 text-gray-400 flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <CardTitle className="text-sm">{rule.name}</CardTitle>
                {rule.description && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {rule.description}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant="secondary" className="text-xs">
                  P{rule.priority}
                </Badge>
                {rule.cooldownSeconds && (
                  <Badge variant="outline" className="text-xs">
                    Cooldown {rule.cooldownSeconds / 3600}h
                  </Badge>
                )}
                <Link href={`/dashboard/rules/${rule.id}`}>
                  <Button size="sm" variant="ghost">
                    <Edit className="h-4 w-4" />
                  </Button>
                </Link>
                {expanded.has(rule.id) ? (
                  <ChevronDown className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                )}
              </div>
            </div>
          </CardHeader>

          {expanded.has(rule.id) && (
            <CardContent className="pt-0 pb-4 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">
                    Condiciones
                  </p>
                  <div className="bg-blue-50 border border-blue-200 rounded p-3 text-xs">
                    {typeof rule.conditions === "object" &&
                    rule.conditions !== null &&
                    "operator" in rule.conditions ? (
                      <>
                        <p className="font-mono font-semibold mb-2">
                          {
                            (rule.conditions as unknown as { operator: string })
                              .operator
                          }
                        </p>
                        <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                          {JSON.stringify(
                            (
                              rule.conditions as unknown as {
                                conditions: unknown;
                              }
                            ).conditions,
                            null,
                            2,
                          )}
                        </pre>
                      </>
                    ) : (
                      <p className="text-muted-foreground">Sin condiciones</p>
                    )}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">
                    Acciones
                  </p>
                  <div className="bg-green-50 border border-green-200 rounded p-3 text-xs">
                    {Array.isArray(rule.actions) && rule.actions.length > 0 ? (
                      <pre className="text-xs overflow-auto max-h-40 whitespace-pre-wrap">
                        {JSON.stringify(rule.actions, null, 2)}
                      </pre>
                    ) : (
                      <p className="text-muted-foreground">Sin acciones</p>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          )}
        </Card>
      ))}
    </div>
  );
}
