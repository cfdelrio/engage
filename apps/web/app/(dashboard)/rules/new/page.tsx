import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { RuleBuilder } from "../_components/RuleBuilder";

export default function NewRulePage() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/rules">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-4xl font-bold">Create New Rule</h1>
          <p className="text-muted-foreground mt-1">
            Build engagement automation rules with visual condition and action
            builders
          </p>
        </div>
      </div>
      <RuleBuilder />
    </div>
  );
}
