"use client";

import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { KPICards } from "./KPICards";
import { TimeSeriesChart } from "./TimeSeriesChart";
import { ChannelComparison } from "./ChannelComparison";
import { CampaignPerformance } from "./CampaignPerformance";
import { DateRangePicker } from "./DateRangePicker";

const QUICK_DAYS = [7, 14, 30] as const;

function buildDateRange(days: number) {
  const to = new Date();
  const from = new Date(to.getTime() - days * 24 * 60 * 60 * 1000);
  return { from, to };
}

export function AnalyticsV2() {
  const [selectedDays, setSelectedDays] = useState<number>(7);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>(() =>
    buildDateRange(7),
  );

  const handleRangeQuick = (days: number) => {
    setSelectedDays(days);
    setDateRange(buildDateRange(days));
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
            {QUICK_DAYS.map((days) => (
              <Button
                key={days}
                variant={selectedDays === days ? "default" : "outline"}
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
