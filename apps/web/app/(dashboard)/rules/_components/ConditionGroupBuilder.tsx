"use client";

import { ConditionGroup } from "./ConditionGroup";
import type { ConditionGroupNode } from "./ConditionGroup";

interface ConditionGroupBuilderProps {
  value: ConditionGroupNode;
  onChange: (group: ConditionGroupNode) => void;
}

export function ConditionGroupBuilder({
  value,
  onChange,
}: ConditionGroupBuilderProps) {
  return <ConditionGroup group={value} onChange={onChange} />;
}
