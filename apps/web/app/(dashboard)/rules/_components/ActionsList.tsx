"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ActionEditor } from "./ActionEditor";
import { Plus } from "lucide-react";

interface Action {
  type: string;
  params: Record<string, unknown>;
}

interface ActionsListProps {
  actions: Action[];
  onChange: (actions: Action[]) => void;
}

const ACTION_TYPES = [
  {
    label: "Send Notification",
    value: "SEND_NOTIFICATION",
    params: ["channel", "templateId"],
  },
  {
    label: "Add to Campaign",
    value: "ADD_TO_CAMPAIGN",
    params: ["campaignId"],
  },
  {
    label: "Suppress",
    value: "SUPPRESS",
    params: ["reason"],
  },
  {
    label: "Escalate",
    value: "ESCALATE",
    params: ["priority", "assignee"],
  },
  {
    label: "Update Score",
    value: "UPDATE_SCORE",
    params: ["scoreType", "delta"],
  },
  {
    label: "Trigger Webhook",
    value: "TRIGGER_WEBHOOK",
    params: ["url", "method"],
  },
];

export function ActionsList({ actions, onChange }: ActionsListProps) {
  const addAction = () => {
    onChange([
      ...actions,
      {
        type: "SEND_NOTIFICATION",
        params: {},
      },
    ]);
  };

  const removeAction = (index: number) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, action: Action) => {
    const updated = [...actions];
    updated[index] = action;
    onChange(updated);
  };

  return (
    <div className="space-y-3">
      {actions.map((action, index) => (
        <Card key={index} className="p-4">
          <ActionEditor
            action={action}
            actionTypes={ACTION_TYPES}
            onChange={(updated) => updateAction(index, updated)}
            onRemove={() => removeAction(index)}
          />
        </Card>
      ))}

      <Button
        type="button"
        variant="outline"
        onClick={addAction}
        className="w-full gap-2"
      >
        <Plus className="h-4 w-4" />
        Add Action
      </Button>
    </div>
  );
}
