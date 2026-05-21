import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Zap } from "lucide-react";

export default function RulesPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold">Rules</h1>
          <p className="text-muted-foreground">
            Create IF/THEN rules to automate engagement decisions
          </p>
        </div>
        <Link href="/rules/new">
          <Button className="gap-2">
            <Zap className="h-4 w-4" />
            New Rule
          </Button>
        </Link>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
        <p className="text-muted-foreground mb-4">
          Visual rule builder coming soon. Start building rules with the
          intuitive condition and action editor.
        </p>
        <Link href="/rules/new">
          <Button>Create Your First Rule</Button>
        </Link>
      </div>
    </div>
  );
}
