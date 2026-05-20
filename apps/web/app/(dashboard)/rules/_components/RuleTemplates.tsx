'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Copy } from 'lucide-react';

interface RuleTemplate {
  name: string;
  description: string;
  conditions: unknown;
  actions: unknown;
}

const TEMPLATES: RuleTemplate[] = [
  {
    name: 'Top 3 Rankings',
    description: 'Envía push cuando usuario entra en top 3',
    conditions: {
      operator: 'AND',
      conditions: [
        { field: 'event.type', operator: 'eq', value: 'prode.ranking.changed' },
        { field: 'event.payload.newRank', operator: 'lte', value: 3 },
      ],
    },
    actions: [
      {
        type: 'SEND_NOTIFICATION',
        params: { channel: 'push', template: 'top3_ranking' },
      },
    ],
  },
  {
    name: 'Reactivación (7 días inactivo)',
    description: 'Llama por teléfono cuando usuario está 7 días sin actividad',
    conditions: {
      operator: 'AND',
      conditions: [
        { field: 'event.type', operator: 'eq', value: 'user.inactive_7d' },
        { field: 'user.fatigueScore', operator: 'lt', value: 0.6 },
      ],
    },
    actions: [
      {
        type: 'START_VOICE_CAMPAIGN',
        params: { campaignId: 'voice_reactivation' },
      },
    ],
  },
  {
    name: 'Fatiga alta → Digest only',
    description: 'Suprime notificaciones individuales si fatiga es muy alta',
    conditions: {
      operator: 'AND',
      conditions: [{ field: 'user.fatigueScore', operator: 'gte', value: 0.8 }],
    },
    actions: [
      {
        type: 'SUPPRESS',
        params: { duration: 3600 },
      },
    ],
  },
];

export function RuleTemplates({ onSelectTemplate }: { onSelectTemplate: (template: RuleTemplate) => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Plantillas Predefinidas</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {TEMPLATES.map((template) => (
          <div key={template.name} className="border rounded-lg p-3 space-y-2 bg-muted/50">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm">{template.name}</p>
                <p className="text-xs text-muted-foreground">{template.description}</p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onSelectTemplate(template)}
                className="flex-shrink-0"
              >
                <Copy className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
