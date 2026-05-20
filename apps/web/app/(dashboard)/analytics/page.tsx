export const dynamic = 'force-dynamic';
import { Suspense } from 'react';
import { EngagementCharts } from './EngagementCharts';
import { AIPerformance } from './AIPerformance';
import { EventTypeBreakdown } from './EventTypeBreakdown';

export default function AnalyticsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Engagement score, fatiga y rendimiento por canal</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Suspense fallback={<ChartSkeleton />}>
          <EngagementCharts />
        </Suspense>
        <Suspense fallback={<ChartSkeleton />}>
          <AIPerformance />
        </Suspense>
      </div>

      <Suspense fallback={<ChartSkeleton />}>
        <EventTypeBreakdown />
      </Suspense>
    </div>
  );
}

function ChartSkeleton() {
  return <div className="rounded-lg border bg-card h-64 animate-pulse" />;
}
