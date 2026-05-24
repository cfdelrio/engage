"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
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
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogClose,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import {
  MoreHorizontal,
  Play,
  Trash2,
  Download,
  Zap,
  Users,
} from "lucide-react";

interface RemoteCampaign {
  id: string;
  name: string;
  description?: string;
  status: string;
  ttsProvider: string;
  elevenLabsVoiceId?: string;
  createdAt: string;
}

interface VoiceCampaign {
  id: string;
  name: string;
  status: string;
  audienceSize?: number;
  orkestaiCampaignId?: string | null;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-gray-100 text-gray-900",
  active: "bg-green-100 text-green-900",
  paused: "bg-yellow-100 text-yellow-900",
  completed: "bg-blue-100 text-blue-900",
};

export function VoiceCampaignList() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<VoiceCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [remoteCampaigns, setRemoteCampaigns] = useState<RemoteCampaign[]>([]);
  const [remotLoading, setRemoteLoading] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);
  const [fireTarget, setFireTarget] = useState<VoiceCampaign | null>(null);
  const [fireConsentOnly, setFireConsentOnly] = useState(false);
  const [firing, setFiring] = useState(false);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/v1/voice-campaigns`);
      if (!response.ok) throw new Error("Failed to fetch campaigns");
      const data = await response.json();
      setCampaigns(data.campaigns || data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCampaigns();
  }, [fetchCampaigns]);

  const handleDelete = async (id: string) => {
    try {
      setDeleting(true);
      const response = await apiFetch(`/v1/voice-campaigns/${id}`, {
        method: "DELETE",
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

  const openImport = async () => {
    setImportOpen(true);
    setRemoteLoading(true);
    try {
      const res = await apiFetch("/v1/voice-campaigns/remote");
      if (!res.ok) throw new Error("Failed to fetch remote campaigns");
      const data = await res.json();
      setRemoteCampaigns(data.campaigns ?? []);
    } catch (err) {
      setRemoteCampaigns([]);
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setRemoteLoading(false);
    }
  };

  const handleImport = async (remote: RemoteCampaign) => {
    try {
      setImporting(remote.id);
      const res = await apiFetch("/v1/voice-campaigns", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          name: remote.name,
          description: remote.description,
          orkestaiCampaignId: remote.id,
          ttsProvider: remote.ttsProvider ?? "elevenlabs",
          elevenLabsVoiceId: remote.elevenLabsVoiceId,
        }),
      });
      if (!res.ok) throw new Error("Failed to import campaign");
      const created = await res.json();
      setImportOpen(false);
      router.push(`/voice-campaigns/${created.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setImporting(null);
    }
  };

  const openFireConfirm = (campaign: VoiceCampaign) => {
    setFireTarget(campaign);
    setFireConsentOnly(false);
  };

  const handleConfirmFire = async () => {
    if (!fireTarget) return;
    setFiring(true);
    try {
      const response = await apiFetch(
        `/v1/voice-campaigns/${fireTarget.id}/start`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ consentOnly: fireConsentOnly }),
        },
      );
      if (!response.ok) throw new Error("Failed to start campaign");
      setFireTarget(null);
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFiring(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-2">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 bg-muted rounded animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  return (
    <>
      <div className="space-y-4">
        {campaigns.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground mb-4">No campaigns yet</p>
            <div className="flex gap-2 justify-center">
              <Link href="/voice-campaigns/new">
                <Button>Create First Campaign</Button>
              </Link>
              <Button variant="outline" onClick={openImport}>
                <Download className="h-4 w-4 mr-2" />
                Import from orkestai-voice
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={openImport}>
                <Download className="h-4 w-4 mr-2" />
                Import from orkestai-voice
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Audience</TableHead>
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
                      <Badge className={STATUS_COLORS[campaign.status] || ""}>
                        {campaign.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {campaign.audienceSize ?? 0} contacts
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
                            <Link href={`/voice-campaigns/${campaign.id}`}>
                              View Details
                            </Link>
                          </DropdownMenuItem>
                          {campaign.status === "draft" &&
                            (campaign.audienceSize ? (
                              <DropdownMenuItem
                                onClick={() => openFireConfirm(campaign)}
                              >
                                <Zap className="h-4 w-4 mr-2" />
                                Disparar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem asChild>
                                <span
                                  className="pointer-events-none opacity-50 flex items-center"
                                  title="Add audience first in campaign settings"
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Start
                                  <span className="ml-auto text-xs">
                                    (no audience)
                                  </span>
                                </span>
                              </DropdownMenuItem>
                            ))}
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
          </>
        )}
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Import from orkestai-voice</DialogTitle>
            <DialogDescription>
              Select a campaign created in orkestai-voice to link it to ENGAGE.
            </DialogDescription>
          </DialogHeader>
          {remotLoading ? (
            <div className="space-y-2 py-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-10 bg-muted rounded animate-pulse" />
              ))}
            </div>
          ) : remoteCampaigns.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              No campaigns found in orkestai-voice.
            </p>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {remoteCampaigns.map((rc) => (
                <button
                  key={rc.id}
                  onClick={() => handleImport(rc)}
                  disabled={!!importing}
                  className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{rc.name}</p>
                      {rc.description && (
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {rc.description}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1">
                      <Badge variant="outline" className="text-xs">
                        {rc.status}
                      </Badge>
                      {importing === rc.id && (
                        <span className="text-xs text-muted-foreground">
                          Importing...
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Fire confirmation dialog */}
      <Dialog
        open={!!fireTarget}
        onOpenChange={(open) => !open && setFireTarget(null)}
      >
        <DialogContent className="max-w-md p-0 overflow-hidden">
          <div className="flex items-start justify-between px-6 pt-5 pb-4">
            <div>
              <DialogTitle className="text-base font-semibold">
                {fireTarget?.name}
              </DialogTitle>
              <DialogDescription className="mt-0.5">
                Confirmá la audiencia antes de disparar.
              </DialogDescription>
            </div>
            <DialogClose onClose={() => setFireTarget(null)} />
          </div>

          <div className="border-t border-border" />

          <div className="px-6 py-4 bg-muted/40">
            <div className="flex items-center gap-2 mb-2 text-muted-foreground">
              <Users className="h-4 w-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Audiencia de ENGAGE
              </span>
            </div>
            <p className="text-2xl font-bold tabular-nums">
              {fireTarget?.audienceSize ?? 0}
            </p>
            <p className="text-sm text-muted-foreground">
              usuarios se van a llamar
            </p>
          </div>

          <div className="border-t border-border" />

          <div className="px-6 py-4">
            <div className="flex items-start gap-3">
              <Checkbox
                id="consentOnly"
                checked={fireConsentOnly}
                onCheckedChange={(v) => setFireConsentOnly(!!v)}
              />
              <div>
                <label
                  htmlFor="consentOnly"
                  className="text-sm font-medium cursor-pointer"
                >
                  Solo usuarios con consentimiento
                </label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Filtra por{" "}
                  <code className="bg-muted px-1 py-0.5 rounded text-[11px]">
                    phone_consent: true
                  </code>{" "}
                  en los metadatos del usuario
                </p>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          <div className="flex justify-end gap-2 px-6 py-4">
            <Button
              variant="outline"
              onClick={() => setFireTarget(null)}
              disabled={firing}
            >
              Cancelar
            </Button>
            <Button
              onClick={handleConfirmFire}
              disabled={firing}
              className="gap-2"
            >
              <Zap className="h-4 w-4" />
              {firing ? "Disparando..." : "Confirmar y Disparar"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

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
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={deleting}
            >
              {deleting ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
