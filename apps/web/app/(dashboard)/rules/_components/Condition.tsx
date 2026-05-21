"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Trash2 } from "lucide-react";

interface ConditionType {
  field: string;
  operator: string;
  value?: unknown;
}

interface ConditionProps {
  condition: ConditionType;
  onChange: (condition: ConditionType) => void;
  onRemove: () => void;
}

const FIELD_OPTIONS = [
  { label: "Event Type", value: "event.type" },
  { label: "Event Payload", value: "event.payload" },
  { label: "User Fatigue Score", value: "user.fatigueScore" },
  { label: "User Engagement Score", value: "user.engagementScore" },
  { label: "User Tags", value: "user.tags" },
  { label: "User Active Session", value: "user.isActiveSession" },
  { label: "User Metadata", value: "user.metadata" },
  { label: "Days Inactive", value: "user.daysInactive" },
];

const OPERATORS_BY_TYPE: Record<string, string[]> = {
  string: ["eq", "neq", "contains", "changed"],
  number: ["eq", "neq", "gt", "lt", "gte", "lte"],
  boolean: ["eq", "neq"],
  array: ["in", "nin", "contains"],
  default: ["eq", "neq", "exists"],
};

function getOperatorsForField(field: string): string[] {
  if (field.includes("Score")) return OPERATORS_BY_TYPE.number;
  if (field.includes("Session")) return OPERATORS_BY_TYPE.boolean;
  if (field.includes("Tags")) return OPERATORS_BY_TYPE.array;
  return OPERATORS_BY_TYPE.default;
}

export function Condition({ condition, onChange, onRemove }: ConditionProps) {
  const [operators, setOperators] = useState<string[]>(
    OPERATORS_BY_TYPE.default || ["eq", "neq", "exists"],
  );

  useEffect(() => {
    setOperators(getOperatorsForField(condition.field));
  }, [condition.field]);

  const needsValue = !["exists", "changed"].includes(condition.operator);

  return (
    <div className="flex gap-2 items-end bg-white p-3 rounded-lg border border-gray-200">
      <Select
        value={condition.field}
        onValueChange={(field) =>
          onChange({ ...condition, field, operator: "eq" })
        }
      >
        <SelectTrigger className="w-40">
          <SelectValue placeholder="Select field" />
        </SelectTrigger>
        <SelectContent>
          {FIELD_OPTIONS.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={condition.operator}
        onValueChange={(operator) => onChange({ ...condition, operator })}
      >
        <SelectTrigger className="w-32">
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op} value={op}>
              {op.toUpperCase()}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {needsValue && (
        <Input
          placeholder="Value"
          value={String(condition.value ?? "")}
          onChange={(e) => {
            const val = e.target.value;
            let parsed: unknown = val;
            if (val === "true") parsed = true;
            else if (val === "false") parsed = false;
            else if (!isNaN(Number(val))) parsed = Number(val);
            onChange({ ...condition, value: parsed });
          }}
          className="flex-1"
        />
      )}

      <Button type="button" variant="ghost" size="sm" onClick={onRemove}>
        <Trash2 className="h-4 w-4 text-red-600" />
      </Button>
    </div>
  );
}
