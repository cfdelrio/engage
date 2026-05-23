"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { MoreHorizontal, Trash2, Copy } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

interface Template {
  id: string;
  name: string;
  channel: string;
  subject?: string;
  body?: string;
  bodyHtml?: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  variables?: string[];
}

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";
const CHANNEL_COLORS: Record<string, string> = {
  email: "bg-blue-100 text-blue-900",
  sms: "bg-green-100 text-green-900",
  push: "bg-purple-100 text-purple-900",
  whatsapp: "bg-emerald-100 text-emerald-900",
  voice: "bg-orange-100 text-orange-900",
};

export function TemplateList() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [filter, setFilter] = useState<string>("");
  const apiKey = useApiKey();

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const url = filter
        ? `${API_URL}/v1/templates?channel=${filter}`
        : `${API_URL}/v1/templates`;
      const response = await fetch(url, {
        headers: { "x-api-key": apiKey },
      });
      if (!response.ok) throw new Error("Failed to fetch templates");
      const data = await response.json();
      setTemplates(data.templates || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiKey, filter]);

  useEffect(() => {
    if (!apiKey) {
      setLoading(false);
      return;
    }
    fetchTemplates();
  }, [apiKey, fetchTemplates]);

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const response = await fetch(`${API_URL}/v1/templates/${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      if (!response.ok) throw new Error("Failed to delete template");
      setTemplates((prev) => prev.filter((t) => t.id !== id));
      setDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeleting(false);
    }
  };

  const handleDuplicate = async (template: Template) => {
    try {
      const response = await fetch(`${API_URL}/v1/templates`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name: `${template.name} (Copy)`,
          channel: template.channel,
          subject: template.subject,
          body: template.body,
          bodyHtml: template.bodyHtml,
        }),
      });
      if (!response.ok) throw new Error("Failed to duplicate template");
      const newTemplate = await response.json();
      setTemplates((prev) => [newTemplate, ...prev]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (loading) return <div className="p-4">Loading templates...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Templates</h1>
          <Link href="/templates/new">
            <Button>New Template</Button>
          </Link>
        </div>

        <div className="flex gap-2">
          <Button
            variant={filter === "" ? "default" : "outline"}
            onClick={() => setFilter("")}
          >
            All
          </Button>
          {["email", "sms", "push", "whatsapp", "voice"].map((channel) => (
            <Button
              key={channel}
              variant={filter === channel ? "default" : "outline"}
              onClick={() => setFilter(channel)}
            >
              {channel.charAt(0).toUpperCase() + channel.slice(1)}
            </Button>
          ))}
        </div>

        {templates.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No templates yet</p>
            <Link href="/templates/new">
              <Button>Create First Template</Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead>Variables</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {templates.map((template) => (
                <TableRow key={template.id}>
                  <TableCell>
                    <Link href={`/templates/${template.id}`}>
                      <span className="text-blue-600 hover:underline">
                        {template.name}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge className={CHANNEL_COLORS[template.channel]}>
                      {template.channel}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {template.variables?.length ?? 0} variables
                  </TableCell>
                  <TableCell className="text-sm">{template.version}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(template.updatedAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem asChild>
                          <Link href={`/templates/${template.id}`}>Edit</Link>
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleDuplicate(template)}
                        >
                          <Copy className="h-4 w-4 mr-2" />
                          Duplicate
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteId(template.id)}
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </div>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Delete Template</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The template will be permanently
            deleted.
          </AlertDialogDescription>
          <div className="flex justify-end gap-2">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
