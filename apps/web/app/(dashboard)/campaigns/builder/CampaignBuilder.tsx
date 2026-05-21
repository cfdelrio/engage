"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Circle } from "lucide-react";
import { RuleBuilder } from "../../rules/_components/RuleBuilder";
import { TemplateSelector } from "./TemplateSelector";

interface BuilderStep {
  id: string;
  label: string;
  description: string;
}

const STEPS: BuilderStep[] = [
  { id: "name", label: "Nombre", description: "Nombre de la campaña" },
  { id: "trigger", label: "Trigger", description: "Cuándo se dispara" },
  { id: "rules", label: "Reglas", description: "A quién enviar" },
  { id: "template", label: "Template", description: "Qué enviar" },
  { id: "channels", label: "Canales", description: "Por dónde enviar" },
  { id: "review", label: "Revisar", description: "Confirmar antes de guardar" },
];

const TRIGGER_TYPES = [
  {
    value: "manual",
    label: "Manual",
    description: "Disparar manualmente cuando quieras",
  },
  {
    value: "scheduled",
    label: "Programada",
    description: "En una fecha/hora específica",
  },
  {
    value: "event-triggered",
    label: "Por evento",
    description: "Cuando ocurra un evento",
  },
  {
    value: "recurring",
    label: "Recurrente",
    description: "Cada día/semana/mes",
  },
];

interface ConditionGroup {
  operator: "AND" | "OR";
  conditions: unknown[];
}

interface CampaignData {
  name: string;
  trigger: {
    type: string;
    date?: string;
    time?: string;
    eventType?: string;
    frequency?: string;
  };
  rules: ConditionGroup;
  templateId?: string;
  channels: string[];
}

interface CampaignBuilderProps {
  onSave?: (data: CampaignData) => Promise<void>;
}

export function CampaignBuilder({ onSave }: CampaignBuilderProps) {
  const [currentStep, setCurrentStep] = useState(0);
  const [data, setData] = useState<CampaignData>({
    name: "",
    trigger: { type: "manual" },
    rules: { operator: "AND", conditions: [] },
    channels: [],
  });
  const [saving, setSaving] = useState(false);

  const handleNext = () => {
    if (currentStep < STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (onSave) {
        await onSave(data);
      }
    } finally {
      setSaving(false);
    }
  };

  const isComplete = currentStep === STEPS.length - 1;
  const step = STEPS[currentStep];

  if (!step) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
      {/* Sidebar */}
      <div className="lg:col-span-1">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Progreso</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {STEPS.map((s, idx) => (
                <button
                  key={s.id}
                  onClick={() => setCurrentStep(idx)}
                  className={`w-full flex items-start gap-3 p-2 rounded transition-colors ${
                    idx === currentStep
                      ? "bg-primary/10"
                      : idx < currentStep
                        ? "hover:bg-muted"
                        : "opacity-60"
                  }`}
                >
                  {idx < currentStep ? (
                    <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  ) : (
                    <Circle
                      className={`h-5 w-5 flex-shrink-0 mt-0.5 ${
                        idx === currentStep
                          ? "text-primary"
                          : "text-muted-foreground"
                      }`}
                    />
                  )}
                  <div className="text-left">
                    <div className="text-xs font-medium">{s.label}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.description}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Content */}
      <div className="lg:col-span-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Paso {currentStep + 1} de {STEPS.length}: {step.label}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Step 1: Name */}
            {step.id === "name" && (
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Nombre de campaña
                  </label>
                  <Input
                    value={data.name}
                    onChange={(e) => setData({ ...data, name: e.target.value })}
                    placeholder="ej: Black Friday 2024"
                    className="text-base"
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  Elige un nombre descriptivo para identificar tu campaña
                </p>
              </div>
            )}

            {/* Step 2: Trigger */}
            {step.id === "trigger" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-3 block">
                    Tipo de trigger
                  </label>
                  <div className="grid gap-2">
                    {TRIGGER_TYPES.map((t) => (
                      <button
                        key={t.value}
                        onClick={() =>
                          setData({
                            ...data,
                            trigger: { ...data.trigger, type: t.value },
                          })
                        }
                        className={`p-3 border rounded-lg text-left transition-colors ${
                          data.trigger.type === t.value
                            ? "border-primary bg-primary/5"
                            : "border-muted hover:border-muted-foreground/50"
                        }`}
                      >
                        <div className="font-medium text-sm">{t.label}</div>
                        <div className="text-xs text-muted-foreground">
                          {t.description}
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {data.trigger.type === "scheduled" && (
                  <div className="grid grid-cols-2 gap-3 pt-3 border-t">
                    <div>
                      <label className="text-xs font-medium mb-1 block">
                        Fecha
                      </label>
                      <Input
                        type="date"
                        value={data.trigger.date ?? ""}
                        onChange={(e) =>
                          setData({
                            ...data,
                            trigger: { ...data.trigger, date: e.target.value },
                          })
                        }
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium mb-1 block">
                        Hora
                      </label>
                      <Input
                        type="time"
                        value={data.trigger.time ?? ""}
                        onChange={(e) =>
                          setData({
                            ...data,
                            trigger: { ...data.trigger, time: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                )}

                {data.trigger.type === "event-triggered" && (
                  <div className="pt-3 border-t">
                    <label className="text-xs font-medium mb-1 block">
                      Evento
                    </label>
                    <Input
                      value={data.trigger.eventType ?? ""}
                      onChange={(e) =>
                        setData({
                          ...data,
                          trigger: {
                            ...data.trigger,
                            eventType: e.target.value,
                          },
                        })
                      }
                      placeholder="ej: user.signup, order.completed"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Step 3: Rules */}
            {step.id === "rules" && (
              <div className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-1">
                    Condiciones de audiencia
                  </p>
                  <p className="text-xs text-muted-foreground mb-4">
                    Define qué usuarios recibirán esta campaña. Sin condiciones,
                    se envía a todos.
                  </p>
                  <RuleBuilder
                    value={data.rules}
                    onChange={(v) =>
                      setData({ ...data, rules: v as ConditionGroup })
                    }
                  />
                </div>
              </div>
            )}

            {/* Step 4: Template */}
            {step.id === "template" && (
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium mb-3 block">
                    Selecciona un template (opcional)
                  </label>
                  <p className="text-xs text-muted-foreground mb-4">
                    Los templates están filtrados por los canales seleccionados.
                    Puedes crear más en la sección Templates.
                  </p>
                  <TemplateSelector
                    channels={data.channels}
                    value={data.templateId}
                    onChange={(templateId) => setData({ ...data, templateId })}
                  />
                </div>
              </div>
            )}

            {/* Step 5: Channels */}
            {step.id === "channels" && (
              <div className="space-y-4">
                <label className="text-sm font-medium mb-2 block">
                  Selecciona los canales
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {["email", "sms", "push", "whatsapp", "voice"].map((ch) => (
                    <label
                      key={ch}
                      className={`flex items-center gap-2 p-3 border rounded-lg cursor-pointer transition-colors ${
                        data.channels.includes(ch)
                          ? "border-primary bg-primary/5"
                          : "border-muted hover:border-muted-foreground/50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={data.channels.includes(ch)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setData({
                              ...data,
                              channels: [...data.channels, ch],
                            });
                          } else {
                            setData({
                              ...data,
                              channels: data.channels.filter((c) => c !== ch),
                            });
                          }
                        }}
                        className="rounded"
                      />
                      <span className="text-sm capitalize font-medium">
                        {ch}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Step 6: Review */}
            {step.id === "review" && (
              <div className="space-y-4">
                <div className="grid gap-3">
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs font-medium text-muted-foreground">
                      Nombre
                    </div>
                    <div className="font-medium">
                      {data.name || "Sin nombre"}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs font-medium text-muted-foreground">
                      Trigger
                    </div>
                    <div className="font-medium capitalize">
                      {data.trigger.type}
                      {data.trigger.date &&
                        ` — ${data.trigger.date} ${data.trigger.time ?? ""}`}
                      {data.trigger.eventType &&
                        ` — evento: ${data.trigger.eventType}`}
                    </div>
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs font-medium text-muted-foreground mb-1">
                      Reglas de audiencia
                    </div>
                    {data.rules.conditions.length === 0 ? (
                      <span className="text-sm text-muted-foreground">
                        Sin filtros — se envía a todos
                      </span>
                    ) : (
                      <span className="text-sm font-medium">
                        {data.rules.conditions.length} condición
                        {data.rules.conditions.length > 1 ? "es" : ""}{" "}
                        <Badge variant="outline" className="text-xs ml-1">
                          {data.rules.operator}
                        </Badge>
                      </span>
                    )}
                  </div>
                  <div className="p-3 bg-muted rounded-lg">
                    <div className="text-xs font-medium text-muted-foreground">
                      Canales
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {data.channels.length === 0 ? (
                        <span className="text-sm text-muted-foreground">
                          Sin canales
                        </span>
                      ) : (
                        data.channels.map((ch) => (
                          <Badge
                            key={ch}
                            variant="secondary"
                            className="text-xs"
                          >
                            {ch}
                          </Badge>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex gap-2 pt-6 border-t">
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={currentStep === 0}
              >
                Anterior
              </Button>
              {!isComplete ? (
                <Button
                  onClick={handleNext}
                  disabled={!data.name && currentStep === 0}
                >
                  Siguiente
                </Button>
              ) : (
                <Button
                  onClick={handleSave}
                  disabled={saving || !data.name || data.channels.length === 0}
                >
                  {saving ? "Guardando..." : "Crear campaña"}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
