import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { TemplateEditor } from "../_components/TemplateEditor";

export const dynamic = "force-dynamic";

interface TemplateDetailPageProps {
  params: Promise<{ id: string }>;
}

export default async function TemplateDetailPage({
  params,
}: TemplateDetailPageProps) {
  const { id } = await params;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/templates">
          <Button variant="ghost" size="sm">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-[26px] font-bold tracking-tight">
            Edit Template
          </h1>
          <p className="text-muted-foreground mt-1">
            Update template content and settings
          </p>
        </div>
      </div>

      <TemplateEditor templateId={id} />
    </div>
  );
}
