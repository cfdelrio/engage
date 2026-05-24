import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { AIRuleBuilder } from "../_components/AIRuleBuilder";

export default function AINewRulePage() {
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
          <h1 className="text-4xl font-bold">AI Rule Builder</h1>
          <p className="text-muted-foreground mt-1">
            Describe your rule in natural language and AI will create it for you
          </p>
        </div>
      </div>
      <AIRuleBuilder />
    </div>
  );
}
