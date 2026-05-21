import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";
import { RulesList } from "./_components/RulesList";

export const dynamic = "force-dynamic";

export default function RulesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold">Rules</h1>
          <p className="text-muted-foreground mt-2">
            Create IF/THEN rules to automate engagement decisions based on
            events and user actions
          </p>
        </div>
        <Link href="/rules/new">
          <Button className="gap-2">
            <Zap className="h-4 w-4" />
            New Rule
          </Button>
        </Link>
      </div>

      <RulesList />
    </div>
  );
}
