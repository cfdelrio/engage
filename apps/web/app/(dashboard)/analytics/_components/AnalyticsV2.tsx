"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { KPICards } from "./KPICards";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { ChannelComparison } from "./ChannelComparison";
import { CampaignPerformance } from "./CampaignPerformance";
import { DateRangePicker } from "./DateRangePicker";

export function AnalyticsV2() {
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    to: new Date(),
  });

  const handleRangeQuick = (days: number) => {
    setDateRange({
      from: new Date(Date.now() - days * 24 * 60 * 60 * 1000),
      to: new Date(),
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-4xl font-bold">Analytics</h1>
          <p className="text-muted-foreground mt-2">
            Real-time engagement performance and insights
          </p>
        </div>

        {/* Date Range Picker */}
        <div className="flex flex-col gap-2">
          <DateRangePicker value={dateRange} onChange={setDateRange} />
          <div className="flex gap-2">
            {[7, 14, 30].map((days) => (
              <Button
                key={days}
                variant={
                  dateRange.from.getTime() ===
                  new Date(Date.now() - days * 24 * 60 * 60 * 1000).getTime()
                    ? "default"
                    : "outline"
                }
                size="sm"
                onClick={() => handleRangeQuick(days)}
              >
                {days}d
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* KPI Summary */}
      <KPICards dateRange={dateRange} />

      {/* Main Charts */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="channels">Channels</TabsTrigger>
          <TabsTrigger value="campaigns">Campaigns</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="mt-6 space-y-6">
          <TimeSeriesChart dateRange={dateRange} />
        </TabsContent>

        {/* Channels Tab */}
        <TabsContent value="channels" className="mt-6 space-y-6">
          <ChannelComparison dateRange={dateRange} />
        </TabsContent>

        {/* Campaigns Tab */}
        <TabsContent value="campaigns" className="mt-6 space-y-6">
          <CampaignPerformance dateRange={dateRange} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
