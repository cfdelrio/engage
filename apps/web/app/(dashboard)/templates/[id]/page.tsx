'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import Handlebars from 'handlebars';
import { AlertCircle } from 'lucide-react';

interface Template {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body: string;
  bodyHtml?: string;
  variables: string[];
  version: number;
  createdAt: string;
}

const API_URL = process.env['INTERNAL_API_URL'] ?? process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

const CHANNELS = ['email', 'sms', 'push', 'whatsapp', 'voice'];

export default function TemplateDetailPage({ params }: { params: { id: string } }) {
  const [template, setTemplate] = useState<Template | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [variables, setVariables] = useState<string[]>([]);
  const [previewData, setPreviewData] = useState<Record<string, string>>({});
  const [preview, setPreview] = useState('');

  async function fetchTemplate() {
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      const res = await fetch(`${API_URL}/v1/templates/${params.id}`, {
        headers: { 'x-api-key': apiKey },
      });
      const data = await res.json();
      setTemplate(data);
      setName(data.name);
      setChannel(data.channel);
      setSubject(data.subject || '');
      setBody(data.body);
      setVariables(data.variables || []);
    } catch (err) {
      console.error('Failed to fetch template:', err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchTemplate();
  }, [params.id]);

  useEffect(() => {
    try {
      const template = Handlebars.compile(body);
      const rendered = template(previewData);
      setPreview(rendered);
    } catch {
      setPreview('Error en template de Handlebars');
    }
  }, [body, previewData]);

  async function handleSave() {
    setSaving(true);
    try {
      const apiKey = localStorage.getItem('engage_api_key') ?? '';
      const payload = {
        name,
        channel,
        subject: subject || undefined,
        body,
      };
      await fetch(`${API_URL}/v1/templates/${params.id}`, {
        method: 'PUT',
        headers: {
          'x-api-key': apiKey,
          'content-type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
    } catch (err) {
      console.error('Failed to save template:', err);
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="flex justify-center py-12">Cargando...</div>;
  }

  if (!template) {
    return <div className="text-center py-12">Template no encontrado</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Editor de Template</h1>
        <p className="text-muted-foreground text-sm mt-1">Crea plantillas de mensajes reutilizables</p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Configuración */}
        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium">Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre del template" />
          </div>

          <div>
            <label className="text-sm font-medium">Canal</label>
            <Select value={channel} onValueChange={(value) => value && setChannel(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecciona canal" />
              </SelectTrigger>
              <SelectContent>
                {CHANNELS.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {channel === 'email' && (
            <div>
              <label className="text-sm font-medium">Asunto</label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Asunto del email" />
            </div>
          )}

          <div>
            <label className="text-sm font-medium">Body (Handlebars)</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="w-full h-64 p-3 border rounded font-mono text-sm"
              placeholder="Hola {{user.firstName}}, tu score es {{score}}"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Usa {'{{variable}}'} para variables dinámicas extraídas del contexto del usuario
            </p>
          </div>

          <div className="flex gap-4">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Guardando...' : 'Guardar Template'}
            </Button>
            <Button variant="outline" onClick={() => window.history.back()}>
              Cancelar
            </Button>
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Preview</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="text-sm font-medium">Datos de Preview</label>
                <div className="space-y-2 mt-2">
                  {['firstName', 'lastName', 'email', 'score', 'rank'].map((key) => (
                    <div key={key} className="flex gap-2">
                      <span className="text-sm font-mono text-muted-foreground min-w-24">{key}:</span>
                      <input
                        type="text"
                        value={previewData[key] || ''}
                        onChange={(e) =>
                          setPreviewData((prev) => ({
                            ...prev,
                            [key]: e.target.value,
                          }))
                        }
                        className="flex-1 h-7 px-2 border rounded text-sm"
                        placeholder={`ej: ${key === 'firstName' ? 'Juan' : 'valor'}`}
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-medium">Resultado Renderizado</label>
                <div className="bg-muted p-4 rounded mt-2 min-h-32 text-sm whitespace-pre-wrap break-words">{preview}</div>
              </div>

              {variables.length > 0 && (
                <div>
                  <label className="text-sm font-medium">Variables Detectadas</label>
                  <div className="flex flex-wrap gap-2 mt-2">
                    {variables.map((v) => (
                      <span key={v} className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded font-mono">
                        {v}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {preview.includes('Undefined') && (
                <div className="flex gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded text-sm">
                  <AlertCircle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
                  <p className="text-yellow-800">Algunas variables no están en los datos de preview</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
