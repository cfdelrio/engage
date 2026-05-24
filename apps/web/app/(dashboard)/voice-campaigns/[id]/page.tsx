"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useRouter, useParams } from "next/navigation";
import { apiFetch } from "@/lib/api-client";
import { VoiceCampaignBuilder } from "../_components/VoiceCampaignBuilder";
import { VoiceCampaignStats } from "../_components/VoiceCampaignStats";
import { VoiceCallLog } from "../_components/VoiceCallLog";
import { AudienceManager } from "../_components/AudienceManager";

export const dynamic = "force-dynamic";

export default function VoiceCampaignDetailPage() {
  const params = useParams();
  const id = params["id"] as string;
  const router = useRouter();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    try {
      setDeleting(true);
      const res = await apiFetch(`/v1/voice-campaigns/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? "Error al eliminar",
        );
      }
      router.push("/voice-campaigns");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al eliminar");
      setDeleting(false);
      setConfirmOpen(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/voice-campaigns">
            <Button variant="ghost" size="sm">
              <ChevronLeft className="h-4 w-4 mr-2" />
              Volver
            </Button>
          </Link>
          <h1 className="text-[26px] font-bold tracking-tight">
            Voice Campaign
          </h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300 gap-2"
          onClick={() => setConfirmOpen(true)}
        >
          <Trash2 className="h-4 w-4" />
          Eliminar campaña
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <Tabs defaultValue="settings" className="w-full">
        <TabsList>
          <TabsTrigger value="settings">Settings</TabsTrigger>
          <TabsTrigger value="audience">Audience</TabsTrigger>
          <TabsTrigger value="metrics">Metrics</TabsTrigger>
          <TabsTrigger value="calls">Calls</TabsTrigger>
        </TabsList>

        <TabsContent value="settings" className="space-y-4">
          <VoiceCampaignBuilder campaignId={id} />
        </TabsContent>

        <TabsContent value="audience" className="space-y-4">
          <AudienceManager campaignId={id} />
        </TabsContent>

        <TabsContent value="metrics" className="space-y-4">
          <VoiceCampaignStats campaignId={id} />
        </TabsContent>

        <TabsContent value="calls" className="space-y-4">
          <VoiceCallLog campaignId={id} />
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>Eliminar campaña</AlertDialogTitle>
          <AlertDialogDescription>
            Esta acción no se puede deshacer. La campaña y todos sus datos serán
            eliminados permanentemente.
          </AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={deleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {deleting ? "Eliminando..." : "Eliminar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
