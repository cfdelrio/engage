import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { TemplateEditor } from "../_components/TemplateEditor";

export default function NewTemplatePage() {
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
          <h1 className="text-4xl font-bold">Create Template</h1>
          <p className="text-muted-foreground mt-1">
            Use {"{{variable}}"} for dynamic content. Example:{" "}
            {"{{user.firstName}}"}
          </p>
        </div>
      </div>

      <TemplateEditor />
    </div>
  );
}
