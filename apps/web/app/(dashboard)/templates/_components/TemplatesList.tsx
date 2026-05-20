'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Edit, Trash2 } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
  variables: string[];
  version: number;
  createdAt: string;
}

const API_URL = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

const CHANNEL_EMOJI: Record<string, string> = {
  email: '📧',
  sms: '💬',
  push: '🔔',
  whatsapp: '💚',
  voice: '📞',
};

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
  whatsapp: 'WhatsApp',
  voice: 'Voz',
};

export function TemplatesList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  async function fetchTemplates() {
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      const res = await fetch(`${API_URL}/v1/templates`, {
        headers: { 'x-api-key': apiKey },
      });
      const data = await res.json();
      setTemplates(data);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplates();
  }, []);

  async function deleteTemplate(id: string) {
    if (!confirm('¿Estás seguro de que querés eliminar este template?')) return;

    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      await fetch(`${API_URL}/v1/templates/${id}`, {
        method: 'DELETE',
        headers: { 'x-api-key': apiKey },
      });
      await fetchTemplates();
    } catch (err) {
      console.error('Failed to delete template:', err);
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="h-24" />
          </Card>
        ))}
      </div>
    );
  }

  if (templates.length === 0) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center h-32 text-muted-foreground">
          No hay templates creados
        </CardContent>
      </Card>
    );
  }

  // Group by channel
  const templatesByChannel = templates.reduce(
    (acc, t) => {
      if (!acc[t.channel]) acc[t.channel] = [];
      acc[t.channel].push(t);
      return acc;
    },
    {} as Record<string, Template[]>,
  );

  return (
    <div className="space-y-6">
      {Object.entries(templatesByChannel).map(([channel, channelTemplates]) => (
        <Card key={channel}>
          <CardHeader>
            <CardTitle className="flex items-center gap-3 text-lg">
              <span className="text-3xl">{CHANNEL_EMOJI[channel] || '📄'}</span>
              {CHANNEL_LABELS[channel] || channel}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {channelTemplates.map((template) => (
              <div key={template.id} className="border rounded-lg p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm">{template.name}</h3>
                    {template.subject && <p className="text-xs text-muted-foreground mt-1">Asunto: {template.subject}</p>}
                    <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{template.body}</p>
                    {template.variables.length > 0 && (
                      <div className="flex gap-1 mt-3 flex-wrap">
                        {template.variables.map((variable) => (
                          <Badge key={variable} variant="secondary" className="text-xs">
                            {`{{${variable}}}`}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <Link href={`/dashboard/templates/${template.id}`}>
                      <Button size="sm" variant="outline">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </Link>
                    <Button size="sm" variant="ghost" onClick={() => deleteTemplate(template.id)}>
                      <Trash2 className="h-4 w-4 text-red-500" />
                    </Button>
                  </div>
                </div>
                <div className="text-xs text-muted-foreground pt-2 border-t">
                  v{template.version} • {new Date(template.createdAt).toLocaleDateString('es-AR')}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
