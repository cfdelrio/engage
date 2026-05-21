"use client";

import { Calendar } from "lucide-react";
import { format } from "date-fns";

interface DateRangePickerProps {
  value: { from: Date; to: Date };
}

export function DateRangePicker({ value }: DateRangePickerProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border border-border rounded-lg bg-background">
      <Calendar className="h-4 w-4 text-muted-foreground" />
      <span className="text-sm font-medium">
        {format(value.from, "MMM dd")} – {format(value.to, "MMM dd, yyyy")}
      </span>
    </div>
  );
}
