import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileText } from "lucide-react";
import { TemplateList } from "./_components/TemplateList";

export const dynamic = "force-dynamic";

export default function TemplatesPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">Templates</h1>
          <p className="text-muted-foreground mt-2">
            Manage message templates for all channels with dynamic variable
            support
          </p>
        </div>
        <Link href="/templates/new">
          <Button className="gap-2">
            <FileText className="h-4 w-4" />
            New Template
          </Button>
        </Link>
      </div>

      <TemplateList />
    </div>
  );
}
