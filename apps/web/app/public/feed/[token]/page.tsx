import { Suspense } from "react";

interface FeedEntry {
  id: string;
  type: string;
  content: Record<string, unknown>;
  priority: number;
  expiresAt: string | null;
  createdAt: string;
}

interface FeedData {
  feed: {
    id: string;
    name: string;
    slug: string;
    type: string;
    config: Record<string, unknown>;
  };
  entries: FeedEntry[];
}

interface Props {
  params: Promise<{ token: string }>;
}

export const dynamic = "force-dynamic";

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

const ENTRY_TYPE_COLORS: Record<string, string> = {
  ranking: "bg-yellow-50 border-yellow-200",
  goal: "bg-green-50 border-green-200",
  match: "bg-blue-50 border-blue-200",
  achievement: "bg-purple-50 border-purple-200",
  alert: "bg-red-50 border-red-200",
  news: "bg-gray-50 border-gray-200",
};

const ENTRY_TYPE_LABELS: Record<string, string> = {
  ranking: "🏆 Ranking",
  goal: "⚽ Goal",
  match: "🎮 Match",
  achievement: "🎖️ Achievement",
  alert: "🔔 Alert",
  news: "📰 News",
};

function EntryCard({ entry }: { entry: FeedEntry }) {
  const colorClass =
    ENTRY_TYPE_COLORS[entry.type] ?? "bg-gray-50 border-gray-200";
  const label = ENTRY_TYPE_LABELS[entry.type] ?? entry.type;
  const title =
    typeof entry.content["title"] === "string" ? entry.content["title"] : null;
  const body =
    typeof entry.content["body"] === "string"
      ? entry.content["body"]
      : typeof entry.content["message"] === "string"
        ? entry.content["message"]
        : null;
  const imageUrl =
    typeof entry.content["imageUrl"] === "string"
      ? entry.content["imageUrl"]
      : null;

  return (
    <div
      className={`border rounded-xl p-4 ${colorClass} transition-shadow hover:shadow-sm`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-medium text-muted-foreground">
              {label}
            </span>
            {entry.priority > 0 && (
              <span className="text-xs bg-white border rounded px-1.5 py-0.5 text-orange-600 font-medium">
                Featured
              </span>
            )}
          </div>
          {title && (
            <h3 className="font-semibold text-sm text-gray-900 mb-1">
              {title}
            </h3>
          )}
          {body && <p className="text-sm text-gray-700">{body}</p>}
          {imageUrl && (
            <img
              src={imageUrl}
              alt=""
              className="mt-2 rounded-lg w-full object-cover max-h-40"
            />
          )}
        </div>
        <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
          {timeAgo(entry.createdAt)}
        </span>
      </div>
    </div>
  );
}

async function FeedContent({ token }: { token: string }) {
  const apiUrl = process.env["NEXT_PUBLIC_API_URL"] ?? "http://localhost:3001";

  let data: FeedData | null = null;
  let errorMessage: string | null = null;

  try {
    const res = await fetch(`${apiUrl}/embed/feed/${token}`, {
      cache: "no-store",
    });

    if (res.status === 404) {
      errorMessage = "This feed is not available or the link has expired.";
    } else if (!res.ok) {
      errorMessage = "Unable to load feed. Please try again later.";
    } else {
      data = (await res.json()) as FeedData;
    }
  } catch {
    errorMessage = "Unable to connect. Please try again later.";
  }

  if (errorMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-muted">
        <div className="text-center px-4">
          <p className="text-2xl mb-2">📭</p>
          <h1 className="text-lg font-semibold text-gray-900 mb-1">
            Feed Unavailable
          </h1>
          <p className="text-sm text-muted-foreground">{errorMessage}</p>
        </div>
      </div>
    );
  }

  if (!data) return null;

  const { feed, entries } = data;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 py-6 px-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="text-center mb-6">
          <h1 className="text-xl font-bold text-gray-900">{feed.name}</h1>
          {entries.length === 0 && (
            <p className="text-sm text-muted-foreground mt-2">
              No activity yet — check back soon.
            </p>
          )}
        </div>

        {entries.map((entry) => (
          <EntryCard key={entry.id} entry={entry} />
        ))}

        <p className="text-center text-xs text-muted-foreground pt-4">
          Powered by ORKESTAI ENGAGE
        </p>
      </div>
    </div>
  );
}

export default async function FeedPage({ params }: Props) {
  const { token } = await params;

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-muted">
          <p className="text-sm text-muted-foreground">Loading feed...</p>
        </div>
      }
    >
      <FeedContent token={token} />
    </Suspense>
  );
}
