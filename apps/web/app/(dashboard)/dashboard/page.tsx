export const dynamic = "force-dynamic";
import { MetricsGrid } from "./MetricsGrid";
import { LiveEventFeed } from "./LiveEventFeed";
import { ChannelBreakdown } from "./ChannelBreakdown";
import { TimeSeriesChart } from "./TimeSeriesChart";

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Real-time engagement overview
        </p>
      </div>

      <MetricsGrid />

      <TimeSeriesChart />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LiveEventFeed />
        </div>
        <ChannelBreakdown />
      </div>
    </div>
  );
}
