"use client";

import { apiFetch } from "@/lib/api-client";
import { useEffect, useState, useRef, useCallback } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Edit,
  Zap,
  ArrowDown,
  Mail,
  MessageSquare,
  Bell,
  Phone,
  Search,
  Bot,
  X,
} from "lucide-react";

interface SingleCondition {
  field: string;
  operator: string;
  value?: unknown;
}

interface ConditionGroupNode {
  operator: "AND" | "OR";
  conditions: Array<SingleCondition | ConditionGroupNode>;
}

interface RuleAction {
  type: string;
  params: Record<string, unknown>;
}

interface Rule {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  conditions: ConditionGroupNode;
  actions: RuleAction[];
  cooldownSeconds?: number;
}

interface RuleStat {
  total: number;
  matched: number;
  matchRate: number;
  lastExecutedAt: string | null;
}

interface AIResult {
  answer: string;
  matchedIds: Set<string> | null;
}

function getActionChannels(actions: RuleAction[]): string[] {
  return actions.flatMap((a) => {
    if (a.type === "SEND_NOTIFICATION") {
      const ch = (a.params as { channel?: string }).channel;
      return ch ? [ch] : [];
    }
    if (a.type === "START_VOICE_CAMPAIGN") return ["voice"];
    if (a.type === "START_PUSH_CAMPAIGN") return ["push"];
    if (a.type === "START_WHATSAPP_CAMPAIGN") return ["whatsapp"];
    return [];
  });
}

function getEventType(group: ConditionGroupNode): string | null {
  if (!group?.conditions) return null;
  for (const c of group.conditions) {
    if ("operator" in c && "conditions" in c) {
      const r = getEventType(c as ConditionGroupNode);
      if (r) return r;
    } else {
      const s = c as SingleCondition;
      if (s.field === "event.type" && s.operator === "eq") return String(s.value);
    }
  }
  return null;
}

const OP_LABELS: Record<string, string> = {
  eq: "=",
  neq: "≠",
  gt: ">",
  lt: "<",
  gte: "≥",
  lte: "≤",
  in: "in",
  nin: "not in",
  contains: "contains",
  exists: "exists",
  changed: "changed",
};

const CHANNEL_CONFIG: Record<
  string,
  { icon: React.ReactNode; label: string }
> = {
  email: { icon: <Mail className="h-3 w-3" />, label: "Email" },
  sms: { icon: <MessageSquare className="h-3 w-3" />, label: "SMS" },
  push: { icon: <Bell className="h-3 w-3" />, label: "Push" },
  whatsapp: { icon: <MessageSquare className="h-3 w-3" />, label: "WhatsApp" },
  voice: { icon: <Phone className="h-3 w-3" />, label: "Voice" },
};

const ALL_CHANNELS = ["email", "sms", "push", "whatsapp", "voice"];

const ACTION_LABELS: Record<string, string> = {
  SEND_NOTIFICATION: "Notificación",
  ADD_TO_CAMPAIGN: "Agregar a campaña",
  START_VOICE_CAMPAIGN: "Campaña de voz",
  START_PUSH_CAMPAIGN: "Campaña push",
  START_WHATSAPP_CAMPAIGN: "Campaña WhatsApp",
  SUPPRESS: "Suprimir",
  ESCALATE: "Escalar",
  UPDATE_SCORE: "Actualizar score",
  TRIGGER_WEBHOOK: "Webhook",
};

function ConditionTree({
  group,
  depth = 0,
}: {
  group: ConditionGroupNode;
  depth?: number;
}) {
  if (!group?.conditions?.length) {
    return (
      <p className="text-xs text-muted-foreground italic">Sin condiciones</p>
    );
  }

  return (
    <div className={depth > 0 ? "pl-3 border-l border-blue-200 ml-1 mt-1" : ""}>
      {depth > 0 && (
        <p className="text-[10px] font-semibold text-blue-500 uppercase tracking-wide mb-1">
          {group.operator}
        </p>
      )}
      <ul className="space-y-1">
        {group.conditions.map((c, i) => {
          if ("operator" in c && "conditions" in c) {
            return (
              <li key={i}>
                <ConditionTree
                  group={c as ConditionGroupNode}
                  depth={depth + 1}
                />
              </li>
            );
          }
          const s = c as SingleCondition;
          const op = OP_LABELS[s.operator] ?? s.operator;
          const val = s.value != null ? JSON.stringify(s.value) : "";
          return (
            <li key={i} className="text-xs font-mono leading-5">
              <span className="text-blue-600">{s.field}</span>{" "}
              <span className="text-muted-foreground">{op}</span>{" "}
              {val && <span className="text-orange-600">{val}</span>}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function ActionList({ actions }: { actions: RuleAction[] }) {
  if (!actions?.length) {
    return (
      <p className="text-xs text-muted-foreground italic">Sin acciones</p>
    );
  }

  return (
    <ul className="space-y-2">
      {actions.map((action, i) => {
        const label = ACTION_LABELS[action.type] ?? action.type;
        const channel =
          action.type === "SEND_NOTIFICATION"
            ? (action.params as { channel?: string }).channel
            : action.type === "START_VOICE_CAMPAIGN"
              ? "voice"
              : action.type === "START_PUSH_CAMPAIGN"
                ? "push"
                : action.type === "START_WHATSAPP_CAMPAIGN"
                  ? "whatsapp"
                  : null;
        const channelCfg = channel ? CHANNEL_CONFIG[channel] : null;
        const relevantParams = Object.entries(action.params)
          .filter(([k]) => !["tenantId"].includes(k))
          .slice(0, 3);

        return (
          <li key={i} className="text-xs">
            <div className="flex items-center gap-1.5 font-medium text-green-700">
              {channelCfg?.icon}
              <span>{label}</span>
            </div>
            {relevantParams.length > 0 && (
              <div className="ml-4 mt-0.5 font-mono text-muted-foreground">
                {relevantParams.map(([k, v]) => (
                  <span key={k} className="mr-3">
                    {k}:{" "}
                    <span className="text-orange-600">{JSON.stringify(v)}</span>
                  </span>
                ))}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export function RulesList() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "all" | "active" | "disabled"
  >("all");
  const [channelFilter, setChannelFilter] = useState<string>("all");
  const [triggerFilter, setTriggerFilter] = useState<string>("all");
  const [toggling, setToggling] = useState<Set<string>>(new Set());
  const [toggleError, setToggleError] = useState<Record<string, string>>({});
  const [ruleStats, setRuleStats] = useState<Record<string, RuleStat> | null>(
    null,
  );

  const [aiQuery, setAiQuery] = useState("");
  const [aiResult, setAiResult] = useState<AIResult | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load rules and stats on mount
  useEffect(() => {
    void Promise.all([
      apiFetch("/v1/rules", {})
        .then((r) => r.json())
        .then((data: unknown) => setRules(Array.isArray(data) ? data : [])),
      apiFetch("/v1/rules/stats", {})
        .then((r) => r.json())
        .then((data: unknown) => {
          if (data && typeof data === "object" && "stats" in data) {
            setRuleStats((data as { stats: Record<string, RuleStat> }).stats);
          }
        }),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleToggle = async (id: string, currentEnabled: boolean) => {
    if (toggling.has(id)) return;
    setToggling((prev) => new Set(prev).add(id));
    setRules((prev) =>
      prev.map((r) => (r.id === id ? { ...r, enabled: !currentEnabled } : r)),
    );
    try {
      const res = await apiFetch(`/v1/rules/${id}/toggle`, { method: "POST" });
      if (!res.ok) throw new Error();
    } catch {
      setRules((prev) =>
        prev.map((r) => (r.id === id ? { ...r, enabled: currentEnabled } : r)),
      );
      setToggleError((prev) => ({
        ...prev,
        [id]: "No se pudo guardar el cambio",
      }));
      setTimeout(
        () =>
          setToggleError((prev) => {
            const n = { ...prev };
            delete n[id];
            return n;
          }),
        3000,
      );
    } finally {
      setToggling((prev) => {
        const n = new Set(prev);
        n.delete(id);
        return n;
      });
    }
  };

  const runAiQuery = useCallback(
    async (question: string) => {
      if (!question.trim() || rules.length === 0) {
        setAiResult(null);
        return;
      }
      setAiLoading(true);
      try {
        const serializedRules = rules.map((r) => ({
          id: r.id,
          name: r.name,
          description: r.description,
          conditions: r.conditions,
          actions: r.actions,
          enabled: r.enabled,
          priority: r.priority,
        }));
        const res = await apiFetch("/v1/ai/rules/interpret/query", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            question,
            rules: serializedRules,
            stats: ruleStats ?? undefined,
          }),
        });
        if (!res.ok) {
          setAiResult({ answer: "Error al consultar AI.", matchedIds: null });
          return;
        }
        const data = (await res.json()) as {
          answer: string;
          matchedRuleIds: string[] | null;
        };
        setAiResult({
          answer: data.answer,
          matchedIds: data.matchedRuleIds ? new Set(data.matchedRuleIds) : null,
        });
      } catch {
        setAiResult({ answer: "Error al consultar AI.", matchedIds: null });
      } finally {
        setAiLoading(false);
      }
    },
    [rules, ruleStats],
  );

  // Debounce AI query
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!aiQuery.trim()) {
      setAiResult(null);
      return;
    }
    debounceRef.current = setTimeout(() => {
      void runAiQuery(aiQuery);
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [aiQuery, runAiQuery]);

  const availableTriggers = [
    ...new Set(
      rules.map((r) => getEventType(r.conditions)).filter(Boolean) as string[],
    ),
  ].sort();

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("all");
    setChannelFilter("all");
    setTriggerFilter("all");
  };

  const hasActiveFilters =
    search !== "" ||
    statusFilter !== "all" ||
    channelFilter !== "all" ||
    triggerFilter !== "all";

  const filtered = rules.filter((rule) => {
    if (
      search &&
      !rule.name.toLowerCase().includes(search.toLowerCase()) &&
      !rule.description?.toLowerCase().includes(search.toLowerCase())
    )
      return false;
    if (statusFilter === "active" && !rule.enabled) return false;
    if (statusFilter === "disabled" && rule.enabled) return false;
    if (
      channelFilter !== "all" &&
      !getActionChannels(rule.actions).includes(channelFilter)
    )
      return false;
    if (
      triggerFilter !== "all" &&
      getEventType(rule.conditions) !== triggerFilter
    )
      return false;
    return true;
  });

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

  return (
    <div className="space-y-4">
      {/* AI search bar */}
      <div className="space-y-2">
        <div className="relative">
          <Bot className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={aiQuery}
            onChange={(e) => setAiQuery(e.target.value)}
            placeholder="Buscar con AI: ej. reglas que envían WhatsApp al top 3…"
            className="pl-9 pr-9"
          />
          {aiQuery && (
            <button
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => {
                setAiQuery("");
                setAiResult(null);
              }}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        {(aiLoading || aiResult) && (
          <div className="text-sm px-1">
            {aiLoading ? (
              <span className="text-muted-foreground italic">
                Consultando AI…
              </span>
            ) : aiResult ? (
              <span className="text-muted-foreground">{aiResult.answer}</span>
            ) : null}
          </div>
        )}
      </div>

      {/* Filter bar */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            className="pl-9"
            placeholder="Buscar por nombre o descripción..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium w-14 shrink-0">
            Estado
          </span>
          {(["all", "active", "disabled"] as const).map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => setStatusFilter(s)}
            >
              <Badge
                variant={statusFilter === s ? "default" : "outline"}
                className="cursor-pointer gap-1"
              >
                {s === "all" && "Todas"}
                {s === "active" && (
                  <>
                    <CheckCircle className="h-3 w-3" /> Activas
                  </>
                )}
                {s === "disabled" && (
                  <>
                    <XCircle className="h-3 w-3" /> Desactivadas
                  </>
                )}
              </Badge>
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-muted-foreground font-medium w-14 shrink-0">
            Canal
          </span>
          <button type="button" onClick={() => setChannelFilter("all")}>
            <Badge
              variant={channelFilter === "all" ? "default" : "outline"}
              className="cursor-pointer"
            >
              Todos
            </Badge>
          </button>
          {ALL_CHANNELS.map((ch) => {
            const cfg = CHANNEL_CONFIG[ch];
            if (!cfg) return null;
            return (
              <button
                key={ch}
                type="button"
                onClick={() => setChannelFilter(ch)}
              >
                <Badge
                  variant={channelFilter === ch ? "default" : "outline"}
                  className="cursor-pointer gap-1"
                >
                  {cfg.icon} {cfg.label}
                </Badge>
              </button>
            );
          })}
        </div>

        {availableTriggers.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium w-14 shrink-0">
              Trigger
            </span>
            <button type="button" onClick={() => setTriggerFilter("all")}>
              <Badge
                variant={triggerFilter === "all" ? "default" : "outline"}
                className="cursor-pointer"
              >
                Todos
              </Badge>
            </button>
            {availableTriggers.map((t) => (
              <button key={t} type="button" onClick={() => setTriggerFilter(t)}>
                <Badge
                  variant={triggerFilter === t ? "default" : "outline"}
                  className="cursor-pointer gap-1 font-mono"
                >
                  <Zap className="h-3 w-3" />
                  {t}
                </Badge>
              </button>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            {filtered.length} {filtered.length === 1 ? "regla" : "reglas"}
            {rules.length !== filtered.length && ` de ${rules.length}`}
          </p>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <X className="h-3 w-3" /> Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {/* Rules list */}
      {filtered.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground gap-2">
            <p>No hay reglas que coincidan con los filtros.</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={clearFilters}
                className="text-primary text-sm hover:underline"
              >
                Limpiar filtros
              </button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((rule) => {
            const channels = getActionChannels(rule.actions);
            const eventType = getEventType(rule.conditions);
            const isExpanded = expanded.has(rule.id);
            const stat = ruleStats?.[rule.id];
            const dimmed =
              aiResult?.matchedIds !== null &&
              aiResult?.matchedIds !== undefined &&
              !aiResult.matchedIds.has(rule.id);

            return (
              <Card
                key={rule.id}
                className={`overflow-hidden transition-opacity ${dimmed ? "opacity-40" : ""}`}
              >
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
                    {/* Clickable toggle */}
                    <button
                      type="button"
                      aria-label={
                        rule.enabled ? "Desactivar regla" : "Activar regla"
                      }
                      disabled={toggling.has(rule.id)}
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleToggle(rule.id, rule.enabled);
                      }}
                      className="flex-shrink-0 disabled:opacity-40 transition-opacity"
                    >
                      {rule.enabled ? (
                        <CheckCircle className="h-4 w-4 text-green-500 hover:text-green-600 transition-colors" />
                      ) : (
                        <XCircle className="h-4 w-4 text-muted-foreground hover:text-foreground transition-colors" />
                      )}
                    </button>

                    {/* Name + description */}
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-sm">{rule.name}</CardTitle>
                      {rule.description && (
                        <p className="text-xs text-muted-foreground mt-0.5 truncate">
                          {rule.description}
                        </p>
                      )}
                      {toggleError[rule.id] && (
                        <p className="text-xs text-destructive mt-0.5">
                          {toggleError[rule.id]}
                        </p>
                      )}
                    </div>

                    {/* Chips */}
                    <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap justify-end">
                      {eventType && (
                        <Badge
                          variant="secondary"
                          className="text-xs gap-1 font-mono"
                        >
                          <Zap className="h-2.5 w-2.5" />
                          {eventType}
                        </Badge>
                      )}
                      {channels.map((ch, i) => {
                        const cfg = CHANNEL_CONFIG[ch];
                        return cfg ? (
                          <Badge
                            key={i}
                            variant="outline"
                            className="text-xs gap-1 px-1.5"
                          >
                            {cfg.icon}
                          </Badge>
                        ) : null;
                      })}
                      <Badge variant="secondary" className="text-xs">
                        P{rule.priority}
                      </Badge>
                      {rule.cooldownSeconds && (
                        <Badge variant="outline" className="text-xs">
                          {rule.cooldownSeconds / 3600}h
                        </Badge>
                      )}
                      {stat && (
                        <Badge variant="outline" className="text-xs tabular-nums">
                          {stat.total} exec
                        </Badge>
                      )}
                      <Link
                        href={`/rules/${rule.id}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                        >
                          <Edit className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      )}
                    </div>
                  </div>
                </CardHeader>

                {isExpanded && (
                  <CardContent className="pt-0 pb-4">
                    {stat && (
                      <div className="flex gap-4 text-xs text-muted-foreground mb-3">
                        <span>
                          {stat.total} ejecuciones ·{" "}
                          {Math.round(stat.matchRate * 100)}% match
                        </span>
                        {stat.lastExecutedAt && (
                          <span>
                            Última:{" "}
                            {new Date(stat.lastExecutedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    )}
                    <div className="space-y-2">
                      {/* IF block */}
                      <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3">
                        <p className="text-[10px] font-semibold text-blue-700 uppercase tracking-wide mb-2">
                          IF ({rule.conditions?.operator ?? "AND"})
                        </p>
                        <ConditionTree group={rule.conditions} />
                      </div>

                      {/* Arrow */}
                      <div className="flex items-center gap-1.5 px-2">
                        <ArrowDown className="h-3.5 w-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">
                          entonces
                        </span>
                      </div>

                      {/* THEN block */}
                      <div className="rounded-lg border border-green-200 bg-green-50/60 p-3">
                        <p className="text-[10px] font-semibold text-green-700 uppercase tracking-wide mb-2">
                          THEN
                        </p>
                        <ActionList actions={rule.actions} />
                      </div>
                    </div>
                  </CardContent>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
