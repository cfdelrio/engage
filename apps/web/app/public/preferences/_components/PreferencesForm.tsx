"use client";

import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChannelPreferences } from "./ChannelPreferences";
import { QuietHoursForm } from "./QuietHoursForm";
import { CategoryPreferences } from "./CategoryPreferences";

interface PublicPreferencesResponse {
  preferences: Array<{
    id: string;
    userId: string;
    channel: string;
    category?: string;
    enabled: boolean;
    quietHoursStart: number | null;
    quietHoursEnd: number | null;
    createdAt: string;
    updatedAt: string;
  }>;
  user: {
    email?: string;
    phone?: string;
    timezone: string;
  };
}

interface PreferencesFormProps {
  initialData: PublicPreferencesResponse;
  token: string;
}

const CHANNELS = ["email", "sms", "push", "whatsapp", "voice"] as const;
const CATEGORIES = [
  "promotions",
  "updates",
  "alerts",
  "news",
  "announcements",
] as const;

export function PreferencesForm({ initialData, token }: PreferencesFormProps) {
  const [preferences, setPreferences] = useState(initialData.preferences);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [selectedChannel, setSelectedChannel] = useState<string | null>(null);

  const handleChannelToggle = (channel: string, enabled: boolean) => {
    setPreferences((prev) =>
      prev.map((p) =>
        p.channel === channel && !p.category ? { ...p, enabled } : p,
      ),
    );
    setSuccess(false);
  };

  const handleQuietHoursSave = (
    channel: string,
    start: number | null,
    end: number | null,
  ) => {
    setPreferences((prev) =>
      prev.map((p) =>
        p.channel === channel && !p.category
          ? { ...p, quietHoursStart: start, quietHoursEnd: end }
          : p,
      ),
    );
    setSelectedChannel(null);
    setSuccess(false);
  };

  const handleCategoryToggle = (
    channel: string,
    category: string,
    enabled: boolean,
  ) => {
    setPreferences((prev) => {
      const existing = prev.find(
        (p) => p.channel === channel && p.category === category,
      );
      if (existing) {
        return prev.map((p) => (p.id === existing.id ? { ...p, enabled } : p));
      }
      return [
        ...prev,
        {
          id: `${channel}_${category}_new`,
          userId: initialData.preferences[0].userId,
          channel,
          category,
          enabled,
          quietHoursStart: null,
          quietHoursEnd: null,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ];
    });
    setSuccess(false);
  };

  const handleSave = async () => {
    setLoading(true);
    setError(null);
    setSuccess(false);

    try {
      const updates = preferences.map((p) => ({
        channel: p.channel,
        category: p.category,
        enabled: p.enabled,
        quietHoursStart: p.quietHoursStart,
        quietHoursEnd: p.quietHoursEnd,
      }));

      const response = await fetch("/api/public/preferences", {
        method: "PUT",
        headers: {
          "X-Preference-Token": token,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ preferences: updates }),
      });

      if (!response.ok) {
        throw new Error("Failed to save preferences");
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleOptOut = async () => {
    if (!confirm("Are you sure you want to opt out of all communications?")) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/public/preferences/opt-out", {
        method: "POST",
        headers: { "X-Preference-Token": token },
      });

      if (!response.ok) {
        throw new Error("Failed to opt out");
      }

      // Disable all preferences
      setPreferences((prev) => prev.map((p) => ({ ...p, enabled: false })));
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-8 px-4">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center">
          <h1 className="text-3xl font-bold text-gray-900">
            Communication Preferences
          </h1>
          <p className="text-gray-600 mt-2">
            Manage how and when you receive messages
          </p>
        </div>

        {/* User Info */}
        <Card className="bg-white shadow-sm">
          <CardContent className="pt-6">
            <div className="space-y-2 text-sm">
              {initialData.user.email && (
                <div>
                  <span className="text-muted-foreground">Email:</span>
                  <span className="ml-2 font-medium">
                    {initialData.user.email}
                  </span>
                </div>
              )}
              {initialData.user.phone && (
                <div>
                  <span className="text-muted-foreground">Phone:</span>
                  <span className="ml-2 font-medium">
                    {initialData.user.phone}
                  </span>
                </div>
              )}
              <div>
                <span className="text-muted-foreground">Timezone:</span>
                <span className="ml-2 font-medium">
                  {initialData.user.timezone}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Alerts */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="border-green-200 bg-green-50">
            <AlertDescription className="text-green-800">
              ✓ Preferences updated successfully
            </AlertDescription>
          </Alert>
        )}

        {/* Channel Preferences */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Communication Channels</CardTitle>
            <CardDescription>
              Choose which channels you want to receive messages through
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ChannelPreferences
              channels={CHANNELS}
              preferences={preferences}
              onToggle={handleChannelToggle}
              onQuietHoursClick={setSelectedChannel}
              disabled={loading}
              userTimezone={initialData.user.timezone}
            />
          </CardContent>
        </Card>

        {/* Quiet Hours */}
        {selectedChannel && (
          <Card className="bg-white shadow-sm border-blue-200 bg-blue-50">
            <CardHeader>
              <CardTitle className="text-lg">
                Quiet Hours - {selectedChannel.toUpperCase()}
              </CardTitle>
              <CardDescription>
                Set a time window when you don&apos;t want to receive messages
              </CardDescription>
            </CardHeader>
            <CardContent>
              <QuietHoursForm
                channel={selectedChannel}
                preferences={preferences}
                onSave={handleQuietHoursSave}
                userTimezone={initialData.user.timezone}
                disabled={loading}
              />
            </CardContent>
          </Card>
        )}

        {/* Category Preferences */}
        <Card className="bg-white shadow-sm">
          <CardHeader>
            <CardTitle>Message Types</CardTitle>
            <CardDescription>
              Choose which types of messages you want to receive
            </CardDescription>
          </CardHeader>
          <CardContent>
            <CategoryPreferences
              channels={CHANNELS}
              categories={CATEGORIES}
              preferences={preferences}
              onToggle={handleCategoryToggle}
              disabled={loading}
            />
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex gap-3">
          <Button onClick={handleSave} disabled={loading} className="flex-1">
            {loading ? "Saving..." : "Save Preferences"}
          </Button>
          <Button
            onClick={handleOptOut}
            disabled={loading}
            variant="outline"
            className="text-red-600 hover:text-red-700"
          >
            Unsubscribe All
          </Button>
        </div>
      </div>
    </div>
  );
}
