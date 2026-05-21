export const dynamic = "force-dynamic";
import { EngagementCharts } from "./EngagementCharts";
import { AIPerformance } from "./AIPerformance";
import { EventTypeBreakdown } from "./EventTypeBreakdown";

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-4xl font-bold">Analytics</h1>
        <p className="text-muted-foreground mt-2">
          Engagement performance and AI decision metrics
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <EngagementCharts />
        <AIPerformance />
      </div>

      <EventTypeBreakdown />
    </div>
  );
}
