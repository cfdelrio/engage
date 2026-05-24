"use client";

import { useEffect, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Trash2 } from "lucide-react";

interface Action {
  type: string;
  params: Record<string, unknown>;
}

interface ActionEditorProps {
  action: Action;
  actionTypes: Array<{
    label: string;
    value: string;
    params: string[];
  }>;
  onChange: (action: Action) => void;
  onRemove: () => void;
}

const CHANNELS = ["email", "sms", "push", "whatsapp", "voice"] as const;

const CHANNEL_LABELS: Record<string, string> = {
  email: "Email",
  sms: "SMS",
  push: "Push",
  whatsapp: "WhatsApp",
  voice: "Voice",
};

export function ActionEditor({
  action,
  actionTypes,
  onChange,
  onRemove,
}: ActionEditorProps) {
  const actionType = actionTypes.find((t) => t.value === action.type);
  const paramFields = actionType?.params || [];

  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    if (action.type !== "SEND_NOTIFICATION") {
      setTemplates([]);
      return;
    }
    const ch = action.params.channel as string | undefined;
    const url = `/v1/templates?limit=200${ch ? `&channel=${ch}` : ""}`;
    apiFetch(url, {})
      .then((r) => r.json())
      .then((data: unknown) => {
        if (data && typeof data === "object" && "templates" in data) {
          setTemplates(
            (data as { templates: Array<{ id: string; name: string }> })
              .templates,
          );
        }
      })
      .catch(() => {});
  }, [action.type, action.params.channel]);

  const renderParamField = (param: string) => {
    const label = param
      .replace(/([A-Z])/g, " $1")
      .replace(/^./, (str) => str.toUpperCase());

    if (action.type === "SEND_NOTIFICATION" && param === "channel") {
      return (
        <div key={param}>
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Select
            value={String(action.params.channel ?? "")}
            onValueChange={(v) =>
              onChange({
                ...action,
                params: {
                  ...action.params,
                  channel: v || undefined,
                  templateId: undefined,
                },
              })
            }
          >
            <SelectTrigger>
              <SelectValue placeholder="Seleccionar canal..." />
            </SelectTrigger>
            <SelectContent>
              {CHANNELS.map((ch) => (
                <SelectItem key={ch} value={ch}>
                  {CHANNEL_LABELS[ch]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    if (action.type === "SEND_NOTIFICATION" && param === "templateId") {
      const currentChannel = action.params.channel as string | undefined;
      return (
        <div key={param}>
          <Label className="text-xs text-muted-foreground">{label}</Label>
          <Select
            value={String(action.params.templateId ?? "")}
            onValueChange={(v) =>
              onChange({
                ...action,
                params: { ...action.params, templateId: v || undefined },
              })
            }
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  currentChannel
                    ? "Seleccionar template..."
                    : "Elegí canal primero"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      );
    }

    return (
      <div key={param}>
        <Label className="text-xs text-muted-foreground">{label}</Label>
        <Input
          placeholder={`Enter ${param}`}
          value={String(action.params[param] ?? "")}
          onChange={(e) =>
            onChange({
              ...action,
              params: {
                ...action.params,
                [param]: e.target.value || undefined,
              },
            })
          }
        />
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-sm">Action Type</Label>
          <Select
            value={action.type}
            onValueChange={(type) =>
              onChange({
                type,
                params: {},
              })
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {actionTypes.map((at) => (
                <SelectItem key={at.value} value={at.value}>
                  {at.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
          <Trash2 className="h-4 w-4 text-red-600" />
        </Button>
      </div>

      {paramFields.length > 0 && (
        <div className="grid grid-cols-2 gap-4 pl-4 border-l-2 border-gray-300">
          {paramFields.map((param) => renderParamField(param))}
        </div>
      )}
    </div>
  );
}
