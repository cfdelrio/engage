import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { RuleBuilder } from "../_components/RuleBuilder";

export const dynamic = "force-dynamic";

interface RuleDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function RuleDetailPage({ params }: RuleDetailPageProps) {
  const { id } = await params;

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
          <h1 className="text-4xl font-bold">Edit Rule</h1>
          <p className="text-muted-foreground mt-1">
            Update rule conditions and actions
          </p>
        </div>
      </div>
      <RuleBuilder ruleId={id} />
    </div>
  );
}
