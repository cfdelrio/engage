"use client";

import { apiFetch } from "@/lib/api-client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Globe, Copy, Check } from "lucide-react";

interface Feed {
  id: string;
  slug: string;
  name: string;
  type: string;
  isPublic: boolean;
  embedToken: string;
  _count?: { entries: number };
}

export default function FeedsPage() {
  const [feeds, setFeeds] = useState<Feed[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    apiFetch(`/v1/feeds`)
      .then((res) => (res.ok ? res.json() : []))
      .then((d: Feed[]) => setFeeds(d))
      .catch(() => setFeeds([]))
      .finally(() => setLoading(false));
  }, []);

  const handleCopy = (feed: Feed) => {
    const snippet = `<!-- ORKESTAI ENGAGE — Public Feed Widget -->
<div id="engage-feed"></div>
<script src="https://cdn.orkestai.com/widget.js"
  data-feed="${feed.slug}"
  data-token="${feed.embedToken}">
</script>`;
    void navigator.clipboard.writeText(snippet);
    setCopiedId(feed.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Feeds</h1>
        <p className="text-muted-foreground mt-2">
          Embeddable real-time public feeds
        </p>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="rounded-lg border bg-card p-6 animate-pulse"
            >
              <div className="h-5 w-48 bg-muted rounded mb-4" />
              <div className="h-20 bg-muted rounded" />
            </div>
          ))}
        </div>
      ) : feeds.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Globe className="h-8 w-8 text-muted-foreground mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              No feeds configured yet
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {feeds.map((feed) => (
            <Card key={feed.id}>
              <CardHeader className="flex flex-row items-center gap-3">
                <Globe className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-base">{feed.name}</CardTitle>
                  <p className="text-xs text-muted-foreground font-mono">
                    {feed.slug}
                  </p>
                </div>
                <Badge variant={feed.isPublic ? "default" : "secondary"}>
                  {feed.isPublic ? "Public" : "Private"}
                </Badge>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-medium mb-2">Embed code</p>
                  <div className="relative">
                    <pre className="text-xs bg-muted rounded-lg p-4 overflow-auto pr-12">{`<!-- ORKESTAI ENGAGE — Public Feed Widget -->
<div id="engage-feed"></div>
<script src="https://cdn.orkestai.com/widget.js"
  data-feed="${feed.slug}"
  data-token="${feed.embedToken}">
</script>`}</pre>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7"
                      onClick={() => handleCopy(feed)}
                    >
                      {copiedId === feed.id ? (
                        <Check className="h-3.5 w-3.5 text-green-600" />
                      ) : (
                        <Copy className="h-3.5 w-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: "Entries", value: feed._count?.entries ?? "—" },
                    { label: "Type", value: feed.type },
                    {
                      label: "Status",
                      value: feed.isPublic ? "Live" : "Draft",
                    },
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-muted rounded-lg p-3">
                      <p className="text-xl font-bold">{value}</p>
                      <p className="text-xs text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
