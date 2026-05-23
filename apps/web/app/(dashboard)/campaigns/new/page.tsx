"use client";

import { apiFetch } from "@/lib/api-client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ChevronLeft } from "lucide-react";

export default function NewCampaignPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [type, setType] = useState("event-triggered");
  const [channels, setChannels] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChannelChange = (channel: string, checked: boolean) => {
    if (checked) {
      setChannels((prev) => [...prev, channel]);
    } else {
      setChannels((prev) => prev.filter((c) => c !== channel));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await apiFetch(`/v1/campaigns`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          name,
          type,
          channels,
          status: "draft",
        }),
      });

      if (!res.ok) {
        setError("Failed to create campaign");
        return;
      }

      const campaign = await res.json();
      router.push(`/campaigns/${campaign.id}`);
    } catch {
      setError("Network error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Link href="/campaigns">
          <Button variant="ghost" size="sm" className="-ml-3">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>
        <h1 className="text-4xl font-bold mt-2">New Campaign</h1>
      </div>

      <Card className="max-w-2xl">
        <CardHeader>
          <CardTitle className="text-base">Create Campaign</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-3 bg-destructive/10 text-destructive rounded text-sm">
                {error}
              </div>
            )}

            <div>
              <label className="text-sm font-medium mb-2 block">
                Campaign name
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Black Friday 2024"
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                className="w-full px-3 py-2 border rounded-md bg-background"
              >
                <option value="event-triggered">Event-triggered</option>
                <option value="scheduled">Scheduled</option>
                <option value="recurring">Recurring</option>
                <option value="voice">Voice</option>
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-3 block">Channels</label>
              <div className="space-y-2">
                {["email", "sms", "push", "whatsapp", "voice"].map(
                  (channel) => (
                    <label key={channel} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={channels.includes(channel)}
                        onChange={(e) =>
                          handleChannelChange(channel, e.target.checked)
                        }
                        className="rounded"
                      />
                      <span className="text-sm capitalize">{channel}</span>
                    </label>
                  ),
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={!name || loading}>
                {loading ? "Creating..." : "Create Campaign"}
              </Button>
              <Link href="/campaigns">
                <Button type="button" variant="outline">
                  Cancel
                </Button>
              </Link>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
