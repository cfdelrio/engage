"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Bot, Send, Edit2, Check, RefreshCw, AlertCircle } from "lucide-react";

interface ConditionLeaf {
  field: string;
  operator: string;
  value?: unknown;
}
interface ConditionGroup {
  operator: "AND" | "OR";
  conditions: Array<ConditionLeaf | ConditionGroup>;
}
interface RuleAction {
  type: string;
  params: Record<string, unknown>;
}
interface GeneratedRule {
  name: string;
  description?: string;
  conditions: ConditionGroup;
  actions: RuleAction[];
  cooldownSeconds?: number | null;
}
interface AIInterpretation {
  rule?: GeneratedRule;
  explanation: string;
  confidence: number;
  needsClarification: boolean;
  clarificationQuestion?: string | null;
}
type ChatMessage = {
  id: string;
  role: "assistant" | "user";
  content: string;
  interpretation?: AIInterpretation;
};

const WELCOME: ChatMessage = {
  id: "welcome",
  role: "assistant",
  content:
    '¡Hola! Describime la regla que querés crear en lenguaje natural. Por ejemplo: "enviar email cuando el usuario no se conectó en 7 días".',
};

function formatConditionGroup(g: ConditionGroup, depth = 0): string {
  return g.conditions
    .map((c) => {
      if ("conditions" in c) {
        const inner = formatConditionGroup(c as ConditionGroup, depth + 1);
        return depth > 0 ? `(${inner})` : inner;
      }
      const leaf = c as ConditionLeaf;
      const val =
        leaf.value !== undefined ? ` ${JSON.stringify(leaf.value)}` : "";
      return `${leaf.field} ${leaf.operator}${val}`;
    })
    .join(` ${g.operator} `);
}

function RulePreview({
  interp,
}: {
  interp: AIInterpretation & { rule: GeneratedRule };
}) {
  const rule = interp.rule;
  const pct = Math.round(interp.confidence * 100);
  const filled = Math.round(interp.confidence * 5);

  return (
    <div className="rounded-lg border bg-background p-4 space-y-3 mt-1 text-sm">
      <div className="flex items-start justify-between gap-2">
        <span className="font-semibold">{rule.name}</span>
        <Badge variant="secondary" className="text-xs shrink-0">
          {pct}% confidence
        </Badge>
      </div>
      {rule.description && (
        <p className="text-xs text-muted-foreground">{rule.description}</p>
      )}
      <div className="space-y-1">
        <div className="text-[10px] font-semibold text-blue-600 uppercase tracking-widest">
          IF
        </div>
        <div className="rounded bg-blue-50 dark:bg-blue-950/30 px-3 py-1.5 font-mono text-xs text-blue-900 dark:text-blue-100">
          {formatConditionGroup(rule.conditions)}
        </div>
      </div>
      <div className="space-y-1">
        <div className="text-[10px] font-semibold text-green-600 uppercase tracking-widest">
          THEN
        </div>
        <div className="space-y-1">
          {rule.actions.map((a, i) => (
            <div
              key={i}
              className="rounded bg-green-50 dark:bg-green-950/30 px-3 py-1.5 font-mono text-xs text-green-900 dark:text-green-100"
            >
              {a.type}
              {a.params["channel"] ? ` → ${a.params["channel"]}` : ""}
            </div>
          ))}
        </div>
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {rule.cooldownSeconds != null && rule.cooldownSeconds > 0 && (
          <span>
            Cooldown:{" "}
            {rule.cooldownSeconds >= 3600
              ? `${rule.cooldownSeconds / 3600}h`
              : `${rule.cooldownSeconds}s`}
          </span>
        )}
        <span className="ml-auto flex gap-0.5">
          {Array.from({ length: 5 }, (_, i) => (
            <span
              key={i}
              className={
                i < filled ? "text-primary" : "text-muted-foreground/30"
              }
            >
              ●
            </span>
          ))}
        </span>
      </div>
    </div>
  );
}

export function AIRuleBuilder() {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [pendingInterp, setPendingInterp] = useState<AIInterpretation | null>(
    null,
  );
  const [displayedText, setDisplayedText] = useState("");
  const [savingRule, setSavingRule] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, displayedText]);

  // Typing animation when pendingInterp updates
  useEffect(() => {
    if (!pendingInterp?.explanation) return;
    setDisplayedText("");
    let i = 0;
    const target = pendingInterp.explanation;
    let rafId: number;
    const tick = () => {
      i = Math.min(i + 3, target.length);
      setDisplayedText(target.slice(0, i));
      if (i < target.length) rafId = requestAnimationFrame(tick);
    };
    rafId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafId);
  }, [pendingInterp?.explanation]);

  const conversationHistory = messages
    .filter((m) => m.id !== "welcome")
    .map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.interpretation?.explanation ?? m.content,
    }));

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setError(null);
    setInput("");
    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const res = await apiFetch("/v1/ai/rules/interpret", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message: text, conversationHistory }),
      });

      const body = await res.json();
      if (!res.ok) {
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }

      const interp = body as AIInterpretation;
      setPendingInterp(interp);

      const assistantMsg: ChatMessage = {
        id: crypto.randomUUID(),
        role: "assistant",
        content: interp.needsClarification
          ? (interp.clarificationQuestion ?? interp.explanation)
          : interp.explanation,
        interpretation: interp.needsClarification ? undefined : interp,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      // Remove optimistic user message on total failure
      setMessages((prev) => prev.filter((m) => m.id !== userMsg.id));
      setInput(text);
    } finally {
      setLoading(false);
    }
  }, [input, loading, conversationHistory]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleEditManually = () => {
    if (!pendingInterp?.rule) return;
    localStorage.setItem("ai-prefill-rule", JSON.stringify(pendingInterp.rule));
    router.push("/rules/new");
  };

  const handleSaveRule = async () => {
    if (!pendingInterp?.rule) return;
    setSavingRule(true);
    setError(null);
    try {
      const res = await apiFetch("/v1/rules", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(pendingInterp.rule),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({ error: "Save failed" }));
        throw new Error(
          (b as { error?: string }).error ?? "Failed to save rule",
        );
      }
      router.push("/rules");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setSavingRule(false);
    }
  };

  const reset = () => {
    setMessages([WELCOME]);
    setPendingInterp(null);
    setDisplayedText("");
    setError(null);
  };

  const lastMsgId = messages.at(-1)?.id;

  return (
    <div className="max-w-3xl">
      <Card>
        <CardHeader className="pb-3 border-b">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bot className="h-5 w-5 text-primary" />
            AI Rule Builder
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {/* Message thread */}
          <div className="px-6 py-4 space-y-4 max-h-[500px] overflow-y-auto">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
              >
                {msg.role === "assistant" && (
                  <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`flex flex-col gap-1.5 max-w-[85%] ${msg.role === "user" ? "items-end" : "items-start"}`}
                >
                  <div
                    className={`rounded-2xl px-4 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-tr-sm"
                        : "bg-muted rounded-tl-sm"
                    }`}
                  >
                    {msg.id === lastMsgId &&
                    msg.role === "assistant" &&
                    pendingInterp &&
                    !pendingInterp.needsClarification
                      ? displayedText || " "
                      : msg.content}
                  </div>
                  {msg.interpretation?.rule && msg.id === lastMsgId && (
                    <div className="w-full">
                      <RulePreview
                        interp={
                          msg.interpretation as AIInterpretation & {
                            rule: GeneratedRule;
                          }
                        }
                      />
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex gap-3">
                <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
                <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3">
                  <div className="flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.3s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce [animation-delay:-0.15s]" />
                    <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50 animate-bounce" />
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Pending rule actions */}
          {pendingInterp?.rule && !loading && (
            <div className="border-t px-6 py-3 flex flex-wrap gap-2 items-center bg-muted/30">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleEditManually}
              >
                <Edit2 className="h-3.5 w-3.5" />
                Edit manually
              </Button>
              <Button
                size="sm"
                className="gap-1.5"
                onClick={() => void handleSaveRule()}
                disabled={savingRule}
              >
                <Check className="h-3.5 w-3.5" />
                {savingRule ? "Saving..." : "Save Rule"}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 ml-auto"
                onClick={reset}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Start over
              </Button>
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="border-t px-6 py-2.5 bg-destructive/5 flex items-center gap-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          {/* Input */}
          <div className="border-t px-6 py-4 flex gap-3 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Describí tu regla en lenguaje natural… (Enter para enviar, Shift+Enter para nueva línea)"
              rows={2}
              className="resize-none flex-1 text-sm"
              disabled={loading}
            />
            <Button
              onClick={() => void sendMessage()}
              disabled={!input.trim() || loading}
              size="icon"
              className="h-10 w-10 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
