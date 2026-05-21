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
import { MoreHorizontal, Play, Pause, Trash2, Phone } from "lucide-react";
import { useApiKey } from "@/hooks/useApiKey";

interface VoiceCampaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  _count?: { calls: number };
  createdAt: string;
  stats: Record<string, unknown>;
}

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

export function VoiceCampaignList() {
  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const apiKey = useApiKey();

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_URL}/v1/voice-campaigns`, {
        headers: { "x-api-key": apiKey },
      });
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      const data = await response.json();
      setCampaigns(data.campaigns || []);
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
      const response = await fetch(`${API_URL}/v1/voice-campaigns/${id}`, {
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
      const response = await fetch(
        `${API_URL}/v1/voice-campaigns/${id}/start`,
        {
          method: "POST",
          headers: { "x-api-key": apiKey },
        },
      );
      if (!response.ok) throw new Error("Failed to start campaign");
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  const handlePause = async (id: string) => {
    try {
      const response = await fetch(
        `${API_URL}/v1/voice-campaigns/${id}/pause`,
        {
          method: "POST",
          headers: { "x-api-key": apiKey },
        },
      );
      if (!response.ok) throw new Error("Failed to pause campaign");
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  };

  if (loading) return <div className="p-4">Loading campaigns...</div>;
  if (error) return <div className="p-4 text-red-600">{error}</div>;

  return (
    <>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold">Voice Campaigns</h1>
          <Link href="/voice-campaigns/new">
            <Button className="gap-2">
              <Phone className="h-4 w-4" />
              New Campaign
            </Button>
          </Link>
        </div>

        {campaigns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No campaigns yet</p>
            <Link href="/voice-campaigns/new">
              <Button>Create First Campaign</Button>
            </Link>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Calls</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {campaigns.map((campaign) => (
                <TableRow key={campaign.id}>
                  <TableCell>
                    <Link href={`/voice-campaigns/${campaign.id}`}>
                      <span className="text-blue-600 hover:underline">
                        {campaign.name}
                      </span>
                    </Link>
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        campaign.status === "active" ? "default" : "secondary"
                      }
                    >
                      {campaign.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{campaign._count?.calls ?? 0}</TableCell>
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
                          <Link href={`/voice-campaigns/${campaign.id}`}>
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
