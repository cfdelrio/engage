"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useCallback } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Phone, Volume2 } from "lucide-react";

interface VoiceCall {
  id: string;
  phone: string;
  status: string;
  duration?: number;
  sentiment?: string;
  transcription?: string;
  dtmfResponse?: string;
  responses?: Array<{ stepId: string; value: string }>;
  recordingUrl?: string;
  errorMessage?: string;
  createdAt: string;
}

interface VoiceCallLogProps {
  campaignId: string;
}

const STATUS_COLORS: Record<string, string> = {
  queued: "bg-gray-100 text-gray-900",
  ringing: "bg-blue-100 text-blue-900",
  in_progress: "bg-yellow-100 text-yellow-900",
  completed: "bg-green-100 text-green-900",
  no_answer: "bg-orange-100 text-orange-900",
  failed: "bg-red-100 text-red-900",
};

export function VoiceCallLog({ campaignId }: VoiceCallLogProps) {
  const [calls, setCalls] = useState<VoiceCall[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCall, setSelectedCall] = useState<VoiceCall | null>(null);

  const fetchCalls = useCallback(async () => {
    try {
      const response = await apiFetch(
        `/v1/voice-campaigns/${campaignId}/calls`,
      );
      if (!response.ok) throw new Error("Failed to fetch calls");
      const data = await response.json();
      setCalls(data.calls || []);
    } catch (err) {
      console.error("Failed to fetch calls:", err);
    } finally {
      setLoading(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchCalls();
  }, [fetchCalls]);

  if (loading) return <div className="p-4">Loading calls...</div>;
  if (calls.length === 0)
    return <div className="p-4 text-muted-foreground">No calls yet</div>;

  return (
    <>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Phone</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead>Sentiment</TableHead>
            <TableHead>Responses</TableHead>
            <TableHead>Date</TableHead>
            <TableHead className="text-right">Actions</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {calls.map((call) => (
            <TableRow key={call.id}>
              <TableCell className="font-medium">{call.phone}</TableCell>
              <TableCell>
                <Badge className={STATUS_COLORS[call.status] || "bg-gray-100"}>
                  {call.status.replace("_", " ")}
                </Badge>
              </TableCell>
              <TableCell>{call.duration ? `${call.duration}s` : "-"}</TableCell>
              <TableCell>
                {call.sentiment ? (
                  <Badge
                    variant={
                      call.sentiment === "positive"
                        ? "default"
                        : call.sentiment === "negative"
                          ? "destructive"
                          : "secondary"
                    }
                  >
                    {call.sentiment}
                  </Badge>
                ) : (
                  "-"
                )}
              </TableCell>
              <TableCell>
                {call.responses && call.responses.length > 0
                  ? `${call.responses.length} response${call.responses.length > 1 ? "s" : ""}`
                  : call.dtmfResponse || "-"}
              </TableCell>
              <TableCell className="text-sm">
                {new Date(call.createdAt).toLocaleDateString()}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSelectedCall(call)}
                >
                  <Phone className="h-4 w-4" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      <Dialog
        open={!!selectedCall}
        onOpenChange={(open) => !open && setSelectedCall(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Call Details</DialogTitle>
          </DialogHeader>
          {selectedCall && (
            <div className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground">Phone</p>
                <p className="font-medium">{selectedCall.phone}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge>{selectedCall.status}</Badge>
              </div>
              {selectedCall.duration && (
                <div>
                  <p className="text-sm text-muted-foreground">Duration</p>
                  <p className="font-medium">{selectedCall.duration} seconds</p>
                </div>
              )}
              {selectedCall.responses && selectedCall.responses.length > 0 ? (
                <div>
                  <p className="text-sm text-muted-foreground">Responses</p>
                  <div className="space-y-1 mt-1">
                    {selectedCall.responses.map((r, i) => (
                      <p key={i} className="text-sm">
                        Step <span className="font-mono">{r.stepId}</span>:{" "}
                        <strong>{r.value}</strong>
                      </p>
                    ))}
                  </div>
                </div>
              ) : selectedCall.dtmfResponse ? (
                <div>
                  <p className="text-sm text-muted-foreground">DTMF Response</p>
                  <p className="font-medium">{selectedCall.dtmfResponse}</p>
                </div>
              ) : null}
              {selectedCall.sentiment && (
                <div>
                  <p className="text-sm text-muted-foreground">Sentiment</p>
                  <Badge>{selectedCall.sentiment}</Badge>
                </div>
              )}
              {selectedCall.transcription && (
                <div>
                  <p className="text-sm text-muted-foreground">Transcription</p>
                  <p className="text-sm">{selectedCall.transcription}</p>
                </div>
              )}
              {selectedCall.recordingUrl && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">
                    Recording
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-2"
                    onClick={() =>
                      window.open(selectedCall.recordingUrl, "_blank")
                    }
                  >
                    <Volume2 className="h-4 w-4" />
                    Listen
                  </Button>
                </div>
              )}
              {selectedCall.errorMessage && (
                <div className="bg-red-50 p-3 rounded-lg">
                  <p className="text-sm text-red-900">
                    {selectedCall.errorMessage}
                  </p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
