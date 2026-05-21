"use client";

import { useParams } from "next/navigation";
import { RuleBuilder } from "../_components/RuleBuilder";

export default function RuleDetailPage() {
  const params = useParams();
  const ruleId = params.id as string;

  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Edit Rule</h1>
        <p className="text-muted-foreground">
          Update rule conditions and actions
        </p>
      </div>
      <RuleBuilder ruleId={ruleId} />
    </div>
  );
}
