"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { TemplateEditor } from "../_components/TemplateEditor";

export default function NewTemplatePage() {
  return (
    <div className="space-y-6">
      <div>
        <Link href="/templates">
          <Button variant="ghost" size="sm" className="-ml-3">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-3xl font-bold mt-2">Create Template</h1>
        <p className="text-muted-foreground mt-1">
          Use {"{{variable}}"} for dynamic content. Example:{" "}
          {"{{user.firstName}}"}
        </p>
      </div>

      <TemplateEditor />
    </div>
  );
}
