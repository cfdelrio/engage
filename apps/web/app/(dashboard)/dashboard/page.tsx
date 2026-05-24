export const dynamic = "force-dynamic";
import { MetricsGrid } from "./MetricsGrid";
import { LiveEventFeed } from "./LiveEventFeed";
import { ChannelBreakdown } from "./ChannelBreakdown";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { EventJourney } from "./EventJourney";

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold tracking-tight">Dashboard</h1>
          <p className="text-[13px] text-muted-foreground mt-1">
            Plataforma de engagement en tiempo real · actualización en vivo
          </p>
        </div>
      </div>

      {/* KPIs */}
      <MetricsGrid />

      {/* Event journey visualization */}
      <EventJourney />

      {/* Time series */}
      <TimeSeriesChart />

      {/* Live feed + channel breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <LiveEventFeed />
        </div>
        <ChannelBreakdown />
      </div>
    </div>
  );
}
