"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Condition } from "./Condition";
import { Plus, Trash2 } from "lucide-react";

export interface SingleCondition {
  field: string;
  operator: string;
  value?: unknown;
}

export interface ConditionGroupNode {
  operator: "AND" | "OR";
  conditions: Array<SingleCondition | ConditionGroupNode>;
}

interface ConditionGroupProps {
  group: ConditionGroupNode;
  onChange: (group: ConditionGroupNode) => void;
  depth?: number;
}

export function ConditionGroup({
  group,
  onChange,
  depth = 0,
}: ConditionGroupProps) {
  const isRoot = depth === 0;
  const paddingClass = `${depth > 0 ? "ml-4 pl-4 border-l-2 border-gray-300" : ""}`;

  const addCondition = () => {
    const newCondition = {
      field: "",
      operator: "eq",
      value: undefined,
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newCondition],
    });
  };

  const addNestedGroup = () => {
    const newGroup = {
      operator: "AND" as const,
      conditions: [],
    };
    onChange({
      ...group,
      conditions: [...group.conditions, newGroup],
    });
  };

  const removeCondition = (index: number) => {
    onChange({
      ...group,
      conditions: group.conditions.filter((_, i) => i !== index),
    });
  };

  const updateCondition = (
    index: number,
    condition: SingleCondition | ConditionGroupNode,
  ) => {
    const updated = [...group.conditions];
    updated[index] = condition;
    onChange({ ...group, conditions: updated });
  };

  const isNestedGroup = (
    item: SingleCondition | ConditionGroupNode,
  ): item is ConditionGroupNode => {
    return (
      typeof item === "object" &&
      item !== null &&
      "operator" in item &&
      "conditions" in item
    );
  };

  return (
    <div className={paddingClass}>
      {isRoot && (
        <div className="mb-4 flex items-center gap-2">
          <Badge variant="secondary">{group.operator}</Badge>
          <span className="text-sm text-muted-foreground">
            {group.operator === "AND"
              ? "All conditions must match"
              : "Any condition can match"}
          </span>
        </div>
      )}

      <div className="space-y-2">
        {group.conditions.map((condition, index) =>
          isNestedGroup(condition) ? (
            <div key={index} className="bg-gray-50 rounded-lg p-4">
              <div className="flex justify-between items-center mb-2">
                <Badge>{condition.operator}</Badge>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeCondition(index)}
                >
                  <Trash2 className="h-4 w-4 text-red-600" />
                </Button>
              </div>
              <ConditionGroup
                group={condition}
                onChange={(updated) => updateCondition(index, updated)}
                depth={depth + 1}
              />
            </div>
          ) : (
            <Condition
              key={index}
              condition={condition as SingleCondition}
              onChange={(updated) => updateCondition(index, updated)}
              onRemove={() => removeCondition(index)}
            />
          ),
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCondition}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Condition
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addNestedGroup}
          className="gap-2"
        >
          <Plus className="h-4 w-4" />
          Add Group
        </Button>
      </div>
    </div>
  );
}
