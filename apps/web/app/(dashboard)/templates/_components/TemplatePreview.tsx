"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TemplateData {
  name: string;
  channel: string;
  subject?: string;
  body: string;
  bodyHtml?: string;
}

interface TemplatePreviewProps {
  template: TemplateData;
  sampleVariables: Record<string, string>;
}

function renderHandlebars(
  template: string,
  variables: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, "g");
    result = result.replace(regex, value);
  }
  // Remove any unreplaced variables and show them as empty
  result = result.replace(/\{\{[^}]+\}\}/g, "");
  return result;
}

export function TemplatePreview({
  template,
  sampleVariables,
}: TemplatePreviewProps) {
  const renderedBody = renderHandlebars(template.body, sampleVariables);
  const renderedSubject = template.subject
    ? renderHandlebars(template.subject, sampleVariables)
    : "";

  return (
    <div className="space-y-4">
      {template.channel === "email" && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">Subject Line Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="p-4 bg-gray-50 rounded border border-gray-200">
              <p className="text-sm font-medium">
                {renderedSubject || "(empty)"}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Body Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="p-4 bg-gray-50 rounded border border-gray-200 whitespace-pre-wrap text-sm font-mono">
            {renderedBody || "(empty)"}
          </div>
        </CardContent>
      </Card>

      {template.channel === "email" && template.bodyHtml && (
        <Card>
          <CardHeader>
            <CardTitle className="text-sm">HTML Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="border border-gray-200 rounded overflow-hidden bg-white">
              <iframe
                srcDoc={renderHandlebars(template.bodyHtml, sampleVariables)}
                className="w-full h-[400px] border-0"
                title="HTML Preview"
              />
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Sample Variables Used</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            {Object.entries(sampleVariables).map(([key, value]) => (
              <div
                key={key}
                className="flex justify-between items-center p-2 bg-gray-50 rounded"
              >
                <code className="text-blue-600">{"{{" + key + "}}"}</code>
                <span className="text-gray-600">= {value}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
