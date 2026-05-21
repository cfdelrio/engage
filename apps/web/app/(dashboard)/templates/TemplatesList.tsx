"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Edit } from "lucide-react";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface Template {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
  version: number;
  variables: string[];
  createdAt: string;
}

interface TemplatesResponse {
  templates: Template[];
  total: number;
}

const CHANNEL_COLORS: Record<string, string> = {
  email: "bg-blue-100 text-blue-700",
  sms: "bg-green-100 text-green-700",
  push: "bg-purple-100 text-purple-700",
  whatsapp: "bg-emerald-100 text-emerald-700",
  voice: "bg-orange-100 text-orange-700",
};

export function TemplatesList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("");

  useEffect(() => {
    const apiKey = localStorage.getItem("engage_api_key") ?? "";
    let cancelled = false;

    const params = new URLSearchParams({ limit: "100" });
    if (filter) params.set("channel", filter);

    fetch(`${API_URL}/v1/templates?${params.toString()}`, {
      headers: { "x-api-key": apiKey },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data: TemplatesResponse | null) => {
        if (cancelled) return;
        if (data) {
          setTemplates(data.templates);
        } else {
          setTemplates([]);
        }
      })
      .catch(() => {
        if (!cancelled) setTemplates([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [filter]);

  const onDelete = async (id: string) => {
    if (!confirm("¿Eliminar este template?")) return;
    const apiKey = localStorage.getItem("engage_api_key") ?? "";
    try {
      const res = await fetch(`${API_URL}/v1/templates/${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      if (res.ok) {
        setTemplates((prev) => prev.filter((t) => t.id !== id));
      }
    } catch {
      // ignore
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">
            Templates ({templates.length})
          </CardTitle>
          <div className="flex gap-2">
            {["", "email", "sms", "push", "whatsapp", "voice"].map((ch) => (
              <Button
                key={ch}
                variant={filter === ch ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter(ch)}
              >
                {ch || "Todos"}
              </Button>
            ))}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading && templates.length === 0 ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 bg-muted rounded animate-pulse" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No hay templates
          </p>
        ) : (
          <div className="divide-y">
            {templates.map((template) => (
              <div
                key={template.id}
                className="flex items-center gap-4 py-3 hover:bg-muted/30 rounded-md px-2 -mx-2 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <Link
                    href={`/templates/${template.id}`}
                    className="font-medium text-sm hover:underline"
                  >
                    {template.name}
                  </Link>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <Badge className={CHANNEL_COLORS[template.channel]}>
                      {template.channel}
                    </Badge>
                    {template.variables.length > 0 && (
                      <span>
                        {template.variables.length} variable
                        {template.variables.length > 1 ? "s" : ""}
                      </span>
                    )}
                    <span>v{template.version}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Link href={`/templates/${template.id}`}>
                    <Button variant="outline" size="sm">
                      <Edit className="h-3 w-3" />
                    </Button>
                  </Link>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(template.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
