"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RulePreviewProps {
  rule: {
    name: string;
    description?: string;
    enabled: boolean;
    priority: number;
    conditions: {
      operator: "AND" | "OR";
      conditions: unknown[];
    };
    actions: Array<{
      type: string;
      params: Record<string, unknown>;
    }>;
    cooldownSeconds?: number;
  };
}

export function RulePreview({ rule }: RulePreviewProps) {
  const conditionCount = rule.conditions.conditions.length;
  const actionCount = rule.actions.length;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Rule Summary</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <p className="text-sm text-muted-foreground">Name</p>
            <p className="font-medium">{rule.name || "Untitled Rule"}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <Badge variant={rule.enabled ? "default" : "secondary"}>
              {rule.enabled ? "Enabled" : "Disabled"}
            </Badge>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Priority</p>
            <p className="font-medium">{rule.priority}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Conditions</p>
            <p className="font-medium">
              {conditionCount} condition
              {conditionCount !== 1 ? "s" : ""} ({rule.conditions.operator})
            </p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Actions</p>
            <p className="font-medium">
              {actionCount} action{actionCount !== 1 ? "s" : ""}
            </p>
            {actionCount > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {rule.actions.map((action, i) => (
                  <Badge key={i} variant="outline">
                    {action.type
                      .replace(/_/g, " ")
                      .replace(/([A-Z])/g, " $1")
                      .trim()}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">JSON Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-gray-50 p-4 rounded-lg overflow-auto text-xs">
            {JSON.stringify(rule, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
