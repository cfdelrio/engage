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
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  MoreHorizontal,
  Play,
  Trash2,
  Zap,
  ArrowLeft,
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
  running: "bg-green-100 text-green-900",
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

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [remoteCampaigns, setRemoteCampaigns] = useState<RemoteCampaign[]>([]);
  const [remoteLoading, setRemoteLoading] = useState(false);

  // 2-step: null = lista, RemoteCampaign = confirmación
  const [selectedRemote, setSelectedRemote] = useState<RemoteCampaign | null>(
    null,
  );
  const [requireConsent, setRequireConsent] = useState(false);
  const [audienceCount, setAudienceCount] = useState<{
    count: number;
    total: number;
    withConsent: number;
  } | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [firing, setFiring] = useState(false);
  const [importing, setImporting] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiFetch(`/v1/voice-campaigns`);
      if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
          `Failed to fetch campaigns (${response.status})${body ? `: ${body}` : ""}`,
        );
      }
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

  const openDialog = async () => {
    setDialogOpen(true);
    setSelectedRemote(null);
    setAudienceCount(null);
    setRequireConsent(false);
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

  const selectForLaunch = async (rc: RemoteCampaign) => {
    setSelectedRemote(rc);
    setAudienceLoading(true);
    setAudienceCount(null);
    try {
      const res = await apiFetch("/v1/voice-campaigns/audience-preview");
      if (res.ok) {
        const data = await res.json();
        setAudienceCount(data);
      }
    } catch {
      // non-critical
    } finally {
      setAudienceLoading(false);
    }
  };

  // Re-fetch audience count when consent toggle changes
  useEffect(() => {
    if (!selectedRemote) return;
    setAudienceLoading(true);
    apiFetch(
      `/v1/voice-campaigns/audience-preview?requireConsent=${requireConsent}`,
    )
      .then((r) => r.json())
      .then((data) => setAudienceCount(data))
      .catch(() => {})
      .finally(() => setAudienceLoading(false));
  }, [requireConsent, selectedRemote]);

  const handleLaunch = async () => {
    if (!selectedRemote) return;
    setFiring(true);
    setError(null);
    try {
      const res = await apiFetch("/v1/voice-campaigns/launch-remote", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          orkestaiCampaignId: selectedRemote.id,
          name: selectedRemote.name,
          requireConsent,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error ?? "Failed to launch",
        );
      }
      setDialogOpen(false);
      await fetchCampaigns();
      router.push(
        `/voice-campaigns/${(data as { campaignId: string }).campaignId}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setFiring(false);
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
      setDialogOpen(false);
      router.push(`/voice-campaigns/${(created as { id: string }).id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setImporting(null);
    }
  };

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

  const handleStart = async (id: string) => {
    try {
      const response = await apiFetch(`/v1/voice-campaigns/${id}/start`, {
        method: "POST",
      });
      if (!response.ok) throw new Error("Failed to start campaign");
      await fetchCampaigns();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
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
            <p className="text-muted-foreground mb-4">
              No hay campañas todavía
            </p>
            <div className="flex gap-2 justify-center">
              <Link href="/voice-campaigns/new">
                <Button>Crear campaña</Button>
              </Link>
              <Button variant="outline" onClick={openDialog}>
                <Zap className="h-4 w-4 mr-2" />
                Disparar desde orkestai-voice
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={openDialog}>
                <Zap className="h-4 w-4 mr-2" />
                Importar de orkestai-voice
              </Button>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nombre</TableHead>
                  <TableHead>Estado</TableHead>
                  <TableHead>Audiencia</TableHead>
                  <TableHead>Creada</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
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
                      {campaign.audienceSize ?? 0} contactos
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
                              Ver detalles
                            </Link>
                          </DropdownMenuItem>
                          {campaign.status === "draft" &&
                            (campaign.audienceSize ? (
                              <DropdownMenuItem
                                onClick={() => handleStart(campaign.id)}
                              >
                                <Play className="h-4 w-4 mr-2" />
                                Iniciar
                              </DropdownMenuItem>
                            ) : (
                              <DropdownMenuItem asChild>
                                <span
                                  className="pointer-events-none opacity-50 flex items-center"
                                  title="Agregá audiencia primero"
                                >
                                  <Play className="h-4 w-4 mr-2" />
                                  Iniciar
                                  <span className="ml-auto text-xs">
                                    (sin audiencia)
                                  </span>
                                </span>
                              </DropdownMenuItem>
                            ))}
                          {campaign.status !== "running" && (
                            <DropdownMenuItem
                              onClick={() => setDeleteId(campaign.id)}
                              className="text-red-600"
                            >
                              <Trash2 className="h-4 w-4 mr-2" />
                              Eliminar
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

      {/* Dialog: 2 pasos — lista de campañas → confirmación de audiencia */}
      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setSelectedRemote(null);
            setAudienceCount(null);
            setError(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          {!selectedRemote ? (
            <>
              <DialogHeader>
                <DialogTitle>Importar campaña de voz</DialogTitle>
                <DialogDescription>
                  Seleccioná una campaña ya construida en orkestai-voice.
                  Después, crea una regla o evento en ENGAGE para dispararla
                  automáticamente.
                </DialogDescription>
              </DialogHeader>
              {remoteLoading ? (
                <div className="space-y-2 py-2">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-10 bg-muted rounded animate-pulse"
                    />
                  ))}
                </div>
              ) : remoteCampaigns.length === 0 ? (
                <p className="text-sm text-muted-foreground py-4 text-center">
                  No se encontraron campañas en orkestai-voice.
                </p>
              ) : (
                <div className="space-y-2 max-h-80 overflow-y-auto">
                  {remoteCampaigns.map((rc) => (
                    <div
                      key={rc.id}
                      className="rounded-lg border p-3 space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-sm truncate">
                            {rc.name}
                          </p>
                          {rc.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                              {rc.description}
                            </p>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs shrink-0">
                          {rc.status}
                        </Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="flex-1 h-7 text-xs gap-1"
                          onClick={() => selectForLaunch(rc)}
                        >
                          <Zap className="h-3 w-3" />
                          Disparar ahora
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                          disabled={!!importing}
                          onClick={() => handleImport(rc)}
                        >
                          {importing === rc.id ? "Importando..." : "Importar"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <DialogHeader>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRemote(null);
                      setAudienceCount(null);
                    }}
                    className="text-muted-foreground hover:text-foreground"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <DialogTitle className="truncate">
                    {selectedRemote.name}
                  </DialogTitle>
                </div>
                <DialogDescription>
                  Disparar inmediatamente con la audiencia de ENGAGE. (Para
                  disparo automático via evento/regla, importa la campaña sin
                  lanzarla.)
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4 py-2">
                {/* Audience summary */}
                <div className="rounded-lg border bg-muted/40 p-4 space-y-2">
                  <div className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    Audiencia de ENGAGE
                  </div>
                  {audienceLoading ? (
                    <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                  ) : audienceCount ? (
                    <div className="text-sm text-muted-foreground space-y-1">
                      <p>
                        <span className="text-foreground font-semibold text-base">
                          {requireConsent
                            ? audienceCount.withConsent
                            : audienceCount.total}
                        </span>{" "}
                        usuarios se van a llamar
                      </p>
                      {!requireConsent &&
                        audienceCount.withConsent < audienceCount.total && (
                          <p className="text-xs">
                            {audienceCount.withConsent} de {audienceCount.total}{" "}
                            tienen consentimiento registrado
                          </p>
                        )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No se pudo calcular la audiencia
                    </p>
                  )}
                </div>

                {/* Consent filter */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={requireConsent}
                    onChange={(e) => setRequireConsent(e.target.checked)}
                    className="rounded"
                  />
                  <div>
                    <p className="text-sm font-medium">
                      Solo usuarios con consentimiento
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Filtra por <code>whatsapp_consent: true</code> en los
                      metadatos del usuario
                    </p>
                  </div>
                </label>

                {error && <p className="text-sm text-destructive">{error}</p>}

                <Button
                  className="w-full gap-2"
                  disabled={
                    firing ||
                    audienceLoading ||
                    (!!audienceCount &&
                      (requireConsent
                        ? audienceCount.withConsent
                        : audienceCount.total) === 0)
                  }
                  onClick={handleLaunch}
                >
                  <Zap className="h-4 w-4" />
                  {firing ? "Disparando..." : "Confirmar y Disparar"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteId}
        onOpenChange={(open) => !open && setDeleteId(null)}
      >
        <AlertDialogContent>
          <AlertDialogTitle>Eliminar campaña</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. La campaña será eliminada
            permanentemente.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && handleDelete(deleteId)}
              disabled={deleting}
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
