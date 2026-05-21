"use client";

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

export function ActionEditor({
  action,
  actionTypes,
  onChange,
  onRemove,
}: ActionEditorProps) {
  const actionType = actionTypes.find((t) => t.value === action.type);
  const paramFields = actionType?.params || [];

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
          {paramFields.map((param) => (
            <div key={param}>
              <Label className="text-xs text-muted-foreground">
                {param
                  .replace(/([A-Z])/g, " $1")
                  .replace(/^./, (str) => str.toUpperCase())}
              </Label>
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
          ))}
        </div>
      )}
    </div>
  );
}
