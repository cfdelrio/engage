"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Sparkles, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const API_URL = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

interface CampaignSuggestion {
  campaignName: string;
  description: string;
  recommendedChannels: string[];
  suggestedTiming: string;
  tone: string;
  reasoning: string;
}

interface Props {
  campaignType: string;
  selectedChannels: string[];
  targetAudience?: string;
  onSuggestName: (name: string) => void;
  onSuggestChannels: (channels: string[]) => void;
}

export function CampaignSuggestions({
  campaignType,
  selectedChannels,
  targetAudience,
  onSuggestName,
  onSuggestChannels,
}: Props) {
  const [suggestion, setSuggestion] = useState<CampaignSuggestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateSuggestions = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiKey = localStorage.getItem("engage_api_key") ?? "";

      const response = await fetch(`${API_URL}/v1/campaigns/suggest`, {
        method: "POST",
        headers: {
          "x-api-key": apiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          type: campaignType,
          channels: selectedChannels.length > 0 ? selectedChannels : undefined,
          targetAudience: targetAudience || undefined,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to generate suggestions");
      }

      const data = (await response.json()) as CampaignSuggestion;
      setSuggestion(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  };

  if (!suggestion) {
    return (
      <Card className="border-blue-200 bg-blue-50">
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-blue-600" />
            AI-Powered Suggestions
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Get AI-powered suggestions for your campaign name, timing, and
            channels based on your selection.
          </p>
          <Button
            onClick={generateSuggestions}
            disabled={loading || !campaignType}
            size="sm"
            className="w-full"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generate Suggestions
              </>
            )}
          </Button>
          {error && <p className="text-xs text-red-600">{error}</p>}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 bg-green-50">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-green-600" />
              Suggestions
            </CardTitle>
          </div>
          <Button
            onClick={() => setSuggestion(null)}
            variant="ghost"
            size="sm"
            className="text-xs"
          >
            Clear
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Campaign Name Suggestion */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">
            Suggested Campaign Name
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="text-sm font-semibold text-green-900">
                {suggestion.campaignName}
              </div>
              <p className="text-xs text-green-800 mt-1">
                {suggestion.description}
              </p>
            </div>
            <Button
              onClick={() => onSuggestName(suggestion.campaignName)}
              variant="outline"
              size="sm"
              className="flex-shrink-0"
            >
              Use
            </Button>
          </div>
        </div>

        {/* Channel Recommendations */}
        <div className="space-y-2 border-t pt-3">
          <label className="text-xs font-medium text-muted-foreground">
            Recommended Channels
          </label>
          <div className="flex gap-2 flex-wrap">
            {suggestion.recommendedChannels.map((channel) => (
              <Badge
                key={channel}
                variant={
                  selectedChannels.includes(channel) ? "default" : "outline"
                }
                className="text-xs cursor-pointer"
              >
                {channel}
              </Badge>
            ))}
          </div>
          {selectedChannels.length === 0 &&
            suggestion.recommendedChannels.length > 0 && (
              <Button
                onClick={() =>
                  onSuggestChannels(suggestion.recommendedChannels)
                }
                variant="outline"
                size="sm"
                className="w-full mt-2"
              >
                Apply Channel Recommendations
              </Button>
            )}
        </div>

        {/* Tone Suggestion */}
        <div className="space-y-1 border-t pt-3">
          <label className="text-xs font-medium text-muted-foreground">
            Suggested Tone
          </label>
          <Badge variant="secondary" className="text-xs">
            {suggestion.tone}
          </Badge>
        </div>

        {/* Timing Suggestion */}
        <div className="space-y-1 border-t pt-3">
          <label className="text-xs font-medium text-muted-foreground">
            Suggested Timing
          </label>
          <p className="text-xs text-green-900">{suggestion.suggestedTiming}</p>
        </div>

        {/* Reasoning */}
        <div className="space-y-1 border-t pt-3 bg-green-100/50 rounded p-2">
          <label className="text-xs font-medium text-muted-foreground">
            Why These Suggestions?
          </label>
          <p className="text-xs text-green-800">{suggestion.reasoning}</p>
        </div>
      </CardContent>
    </Card>
  );
}
