"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users } from "lucide-react";

interface AudienceManagerProps {
  campaignId: string;
}

export function AudienceManager({ campaignId }: AudienceManagerProps) {
  const [audienceSize, setAudienceSize] = useState<number>(0);
  const [loadingSize, setLoadingSize] = useState(true);
  const [contactsText, setContactsText] = useState("");
  const [adding, setAdding] = useState(false);
  const [result, setResult] = useState<{
    added: number;
    skipped: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchAudienceSize = useCallback(async () => {
    try {
      const res = await apiFetch(`/v1/voice-campaigns/${campaignId}`);
      if (!res.ok) return;
      const campaign = await res.json();
      setAudienceSize(campaign.audienceSize ?? 0);
    } finally {
      setLoadingSize(false);
    }
  }, [campaignId]);

  useEffect(() => {
    fetchAudienceSize();
  }, [fetchAudienceSize]);

  const parseContacts = (text: string) => {
    const lines = text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean);
    const contacts: Array<{
      phone: string;
      firstName: string;
      lastName?: string;
    }> = [];
    const invalid: string[] = [];

    for (const line of lines) {
      const parts = line.split(",").map((p) => p.trim());
      const phone = parts[0];
      const firstName = parts[1];
      if (!phone || !firstName) {
        invalid.push(line);
        continue;
      }
      if (!phone.startsWith("+")) {
        invalid.push(line);
        continue;
      }
      contacts.push({
        phone,
        firstName,
        ...(parts[2] ? { lastName: parts[2] } : {}),
      });
    }

    return { contacts, invalid };
  };

  const handleAdd = async () => {
    setError(null);
    setResult(null);

    const { contacts, invalid } = parseContacts(contactsText);

    if (invalid.length > 0) {
      setError(
        `Invalid lines (phone must start with +, format: +phone,FirstName):\n${invalid.join("\n")}`,
      );
      return;
    }

    if (contacts.length === 0) {
      setError("No valid contacts to add");
      return;
    }

    try {
      setAdding(true);
      const res = await apiFetch(
        `/v1/voice-campaigns/${campaignId}/add-audience`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ contacts }),
        },
      );

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || "Failed to add audience");
      }

      const data = await res.json();
      setResult({ added: data.added, skipped: data.skipped });
      setAudienceSize(data.audienceSize);
      setContactsText("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Current Audience
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loadingSize ? (
            <div className="h-8 w-24 bg-muted rounded animate-pulse" />
          ) : (
            <p className="text-2xl font-bold">
              {audienceSize}{" "}
              <span className="text-sm font-normal text-muted-foreground">
                contacts
              </span>
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Add Contacts</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-sm">
              One contact per line:{" "}
              <code className="text-xs bg-muted px-1 rounded">
                +phone,FirstName[,LastName]
              </code>
            </Label>
            <Textarea
              value={contactsText}
              onChange={(e) => setContactsText(e.target.value)}
              placeholder={
                "+5491122334455,Carlos\n+5491166778899,María,García\n+5491100112233,Juan"
              }
              className="mt-2 font-mono text-sm min-h-36"
            />
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-lg text-sm whitespace-pre-wrap">
              {error}
            </div>
          )}

          {result && (
            <div className="p-3 bg-green-50 text-green-800 rounded-lg text-sm">
              Added {result.added} contact{result.added !== 1 ? "s" : ""}
              {result.skipped > 0 && ` (${result.skipped} skipped)`}
            </div>
          )}

          <Button onClick={handleAdd} disabled={adding || !contactsText.trim()}>
            {adding ? "Adding..." : "Add Contacts"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
