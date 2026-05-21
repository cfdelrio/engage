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
import { MoreHorizontal, Play, Pause, Trash2 } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

interface SmsCampaign {
  id: string;
  name: string;
  body: string;
  status: string;
  triggerType: string;
  createdAt: string;
  startAt?: string;
  _count?: { deliveries: number };
}

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-900",
  active: "bg-green-100 text-green-900",
  paused: "bg-yellow-100 text-yellow-900",
  completed: "bg-blue-100 text-blue-900",
};

export function SmsCampaignList() {
  const [campaigns, setCampaigns] = useState<SmsCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const apiKey = useApiKey();

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/v1/sms-campaigns`, {
        headers: { "x-api-key": apiKey },
      });
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      const data = await response.json();
      setCampaigns(data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [apiKey]);

  useEffect(() => {
    if (!apiKey) return;
    fetchCampaigns();
  }, [apiKey, fetchCampaigns]);

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const response = await fetch(`${API_URL}/v1/sms-campaigns/${id}`, {
        method: "DELETE",
        headers: { "x-api-key": apiKey },
      });
      if (!response.ok) throw new Error("Failed to delete campaign");
      setCampaigns((prev) => prev.filter((c) => c.id !== id));
      setDeleteId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setDeleting(false);
    }
  };

  const handleStart = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/v1/sms-campaigns/${id}/start`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
      });
      if (!response.ok) throw new Error("Failed to start campaign");
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handlePause = async (id: string) => {
    try {
      const response = await fetch(`${API_URL}/v1/sms-campaigns/${id}/pause`, {
        method: "POST",
        headers: { "x-api-key": apiKey },
      });
      if (!response.ok) throw new Error("Failed to pause campaign");
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-destructive bg-destructive/10 p-4 rounded">
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {campaigns.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p className="mb-4">No SMS campaigns yet.</p>
            <Link href="/sms-campaigns/new">
              <Button variant="outline">Create First Campaign</Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Message</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <Link href={`/sms-campaigns/${campaign.id}`}>
                      <span className="text-blue-600 hover:underline">
                        {campaign.name}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                    {campaign.body}
                  </TableCell>
                  <TableCell>
                    <Badge className={STATUS_COLORS[campaign.status] || ""}>
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {campaign.triggerType}
                  </TableCell>
                  <TableCell className="text-sm">
                    {campaign._count?.deliveries ?? 0}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {new Date(campaign.createdAt).toLocaleDateString()}
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
                          <Link href={`/sms-campaigns/${campaign.id}`}>
                            View Details
                          </Link>
                        </DropdownMenuItem>
                        {campaign.status === "draft" && (
                          <DropdownMenuItem
                            onClick={() => handleStart(campaign.id)}
                          >
                            <Play className="h-4 w-4 mr-2" />
                            Start
                          </DropdownMenuItem>
                        )}
                        {campaign.status === "active" && (
                          <DropdownMenuItem
                            onClick={() => handlePause(campaign.id)}
                          >
                            <Pause className="h-4 w-4 mr-2" />
                            Pause
                          </DropdownMenuItem>
                        )}
                        {campaign.status === "draft" && (
                          <DropdownMenuItem
                            onClick={() => setDeleteId(campaign.id)}
                            className="text-red-600"
                          >
                            <Trash2 className="h-4 w-4 mr-2" />
                            Delete
                          </DropdownMenuItem>
                        )}
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
          <AlertDialogTitle>Delete Campaign</AlertDialogTitle>
          <AlertDialogDescription>
            This action cannot be undone. The campaign will be permanently
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
