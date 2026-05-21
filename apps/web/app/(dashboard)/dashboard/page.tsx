export const dynamic = "force-dynamic";
import { Suspense } from "react";
import { MetricsGrid } from "./MetricsGrid";
import { LiveEventFeed } from "./LiveEventFeed";
import { ChannelBreakdown } from "./ChannelBreakdown";
import { TimeSeriesChart } from "./TimeSeriesChart";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Engagement en tiempo real
        </p>
      </div>

      <Suspense fallback={<MetricsSkeleton />}>
        <MetricsGrid />
      </Suspense>

      <Suspense fallback={<ChartSkeleton />}>
        <TimeSeriesChart />
      </Suspense>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LiveEventFeed />
        </div>
        <ChannelBreakdown />
      </div>
    </div>
  );
}

function ChartSkeleton() {
  return (
    <div className="rounded-lg border bg-card p-6 animate-pulse">
      <div className="h-4 w-48 bg-muted rounded mb-6" />
      <div className="h-64 bg-muted rounded" />
    </div>
  );
}

function MetricsSkeleton() {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-lg border bg-card p-6 animate-pulse">
          <div className="h-4 w-24 bg-muted rounded mb-4" />
          <div className="h-8 w-16 bg-muted rounded" />
        </div>
      ))}
    </div>
  );
}
