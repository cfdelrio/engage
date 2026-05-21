"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

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

interface Props {
  channels: string[];
  value: string | undefined;
  onChange: (templateId: string | undefined) => void;
}

const CHANNEL_COLORS: Record<string, string> = {
  email: "bg-blue-100 text-blue-700",
  sms: "bg-green-100 text-green-700",
  push: "bg-purple-100 text-purple-700",
  whatsapp: "bg-emerald-100 text-emerald-700",
  voice: "bg-orange-100 text-orange-700",
};

export function TemplateSelector({ channels, value, onChange }: Props) {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(
    null,
  );

  useEffect(() => {
    if (channels.length === 0) {
      setTemplates([]);
      return;
    }

    setLoading(true);
    const apiKey = localStorage.getItem("engage_api_key") ?? "";

    Promise.all(
      channels.map((ch) =>
        fetch(`${API_URL}/v1/templates?channel=${ch}&limit=100`, {
          headers: { "x-api-key": apiKey },
        })
          .then((res) => (res.ok ? res.json() : { templates: [] }))
          .catch(() => ({ templates: [] })),
      ),
    )
      .then((results) => {
        const allTemplates = results.flatMap((r) => r.templates);
        setTemplates(allTemplates);
        if (value) {
          const selected = allTemplates.find((t) => t.id === value);
          setSelectedTemplate(selected || null);
        }
      })
      .finally(() => setLoading(false));
  }, [channels, value]);

  if (channels.length === 0) {
    return (
      <div className="border rounded-lg p-4 bg-amber-50 flex gap-3 items-start">
        <AlertCircle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
        <p className="text-sm text-amber-800">
          Selecciona al menos un canal en el paso anterior para ver templates
          disponibles
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <div className="border rounded-lg p-4 bg-muted/30">
        <p className="text-sm text-muted-foreground">
          No hay templates para los canales seleccionados. Crea uno en la
          sección Templates.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-2">
        {templates.map((template) => (
          <button
            key={template.id}
            onClick={() => {
              setSelectedTemplate(template);
              onChange(template.id);
            }}
            className={`p-3 border rounded-lg text-left transition-colors ${
              value === template.id
                ? "border-primary bg-primary/5"
                : "border-muted hover:border-muted-foreground/50"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{template.name}</div>
                <div className="flex gap-2 mt-1 flex-wrap">
                  <Badge
                    className={`text-xs ${
                      CHANNEL_COLORS[template.channel] || "bg-gray-100"
                    }`}
                  >
                    {template.channel}
                  </Badge>
                  {template.variables.length > 0 && (
                    <Badge variant="outline" className="text-xs">
                      {template.variables.length} variable
                      {template.variables.length > 1 ? "s" : ""}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-xs">
                    v{template.version}
                  </Badge>
                </div>
              </div>
            </div>
          </button>
        ))}
      </div>

      {selectedTemplate && (
        <Card className="bg-muted/30">
          <CardHeader>
            <CardTitle className="text-sm">Preview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedTemplate.subject && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Asunto
                </div>
                <div className="text-sm p-2 bg-background rounded border">
                  {selectedTemplate.subject}
                </div>
              </div>
            )}
            <div>
              <div className="text-xs font-medium text-muted-foreground mb-1">
                Contenido
              </div>
              <div className="text-sm p-2 bg-background rounded border whitespace-pre-wrap break-words max-h-40 overflow-auto">
                {selectedTemplate.body}
              </div>
            </div>
            {selectedTemplate.variables.length > 0 && (
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  Variables
                </div>
                <div className="flex gap-1 flex-wrap">
                  {selectedTemplate.variables.map((v) => (
                    <Badge key={v} variant="outline" className="text-xs">
                      {"{"}
                      {"{v}"}
                      {"}"}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Button
        onClick={() => {
          onChange(undefined);
          setSelectedTemplate(null);
        }}
        variant="outline"
        size="sm"
        disabled={!value}
      >
        Limpiar selección
      </Button>
    </div>
  );
}
