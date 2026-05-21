"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Clock, Calendar, RotateCw, X } from "lucide-react";

type ScheduleType = "manual" | "scheduled" | "recurring";
type RecurrenceFrequency = "daily" | "weekly" | "monthly";

interface CampaignSchedulingProps {
  campaignId: string;
  currentStatus: "draft" | "active" | "paused" | "completed";
  startAt?: string;
  endAt?: string;
  onUpdate?: () => void;
}

export function CampaignScheduling({
  campaignId,
  currentStatus,
  startAt,
  endAt,
  onUpdate,
}: CampaignSchedulingProps) {
  const [scheduleType, setScheduleType] = useState<ScheduleType>(
    startAt ? "scheduled" : "manual",
  );
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Scheduled
  const [scheduledDateTime, setScheduledDateTime] = useState(
    startAt ? new Date(startAt).toISOString().slice(0, 16) : "",
  );
  const [timezone, setTimezone] = useState("UTC");
  const [endDateTime, setEndDateTime] = useState(
    endAt ? new Date(endAt).toISOString().slice(0, 16) : "",
  );

  // Recurring
  const [frequency, setFrequency] = useState<RecurrenceFrequency>("daily");
  const [recurringStartDate, setRecurringStartDate] = useState(
    startAt ? new Date(startAt).toISOString().slice(0, 10) : "",
  );
  const [recurringEndDate, setRecurringEndDate] = useState(
    endAt ? new Date(endAt).toISOString().slice(0, 10) : "",
  );
  const [daysOfWeek, setDaysOfWeek] = useState<string[]>([
    "Monday",
    "Wednesday",
    "Friday",
  ]);
  const [sendTime, setSendTime] = useState("09:00");

  async function handleSaveSchedule() {
    setError(null);

    try {
      if (scheduleType === "scheduled") {
        if (!scheduledDateTime) {
          setError("Please select a date and time");
          return;
        }

        const scheduledDate = new Date(scheduledDateTime);
        if (scheduledDate <= new Date()) {
          setError("Schedule must be in the future");
          return;
        }
      }

      if (scheduleType === "recurring") {
        if (!recurringStartDate) {
          setError("Please select a start date");
          return;
        }
        if (frequency === "weekly" && daysOfWeek.length === 0) {
          setError("Please select at least one day of week");
          return;
        }
      }

      setLoading(true);

      let payload: Record<string, unknown> = {};

      if (scheduleType === "manual") {
        payload = { startAt: null, endAt: null };
      } else if (scheduleType === "scheduled") {
        payload = {
          startAt: new Date(scheduledDateTime).toISOString(),
          endAt: endDateTime ? new Date(endDateTime).toISOString() : null,
        };
      } else if (scheduleType === "recurring") {
        payload = {
          schedulingType: "recurring",
          frequency,
          startAt: new Date(`${recurringStartDate}T${sendTime}`).toISOString(),
          endAt: recurringEndDate
            ? new Date(`${recurringEndDate}T23:59:59`).toISOString()
            : null,
          daysOfWeek: frequency === "weekly" ? daysOfWeek : undefined,
        };
      }

      // Get the API endpoint based on campaign type (inferred from campaignId pattern or passed prop)
      // For now, try to detect from URL or use a generic endpoint
      const pathname =
        typeof window !== "undefined" ? window.location.pathname : "";
      let endpoint = "/api/v1/campaigns";

      if (pathname.includes("/email/")) endpoint = "/api/v1/email-campaigns";
      else if (pathname.includes("/sms/")) endpoint = "/api/v1/sms-campaigns";
      else if (pathname.includes("/push/")) endpoint = "/api/v1/push-campaigns";
      else if (pathname.includes("/voice/"))
        endpoint = "/api/v1/voice-campaigns";
      else if (pathname.includes("/whatsapp/"))
        endpoint = "/api/v1/whatsapp-campaigns";

      const res = await fetch(`${endpoint}/${campaignId}`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) throw new Error(await res.text());

      setEditing(false);
      onUpdate?.();
    } catch (err) {
      setError(String(err).replace("Error: ", ""));
    } finally {
      setLoading(false);
    }
  }

  if (currentStatus !== "draft") {
    return null;
  }

  const displaySchedule = () => {
    if (!startAt) return "Manual (send now)";
    if (scheduleType === "scheduled") {
      return `Scheduled: ${new Date(startAt).toLocaleString()}`;
    }
    return "Recurring schedule";
  };

  if (!editing) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-semibold text-slate-900 mb-2">Scheduling</h2>
            <p className="text-sm text-slate-600">{displaySchedule()}</p>
          </div>
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => setEditing(true)}
          >
            <Calendar size={18} />
            Edit Schedule
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-semibold text-slate-900">Scheduling</h2>
        <button
          onClick={() => setEditing(false)}
          className="text-slate-400 hover:text-slate-600"
        >
          <X size={20} />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Schedule Type Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-slate-900 mb-3">
          Schedule Type
        </label>
        <div className="grid grid-cols-3 gap-3">
          {(["manual", "scheduled", "recurring"] as const).map((type) => (
            <button
              key={type}
              onClick={() => setScheduleType(type)}
              className={`p-3 rounded-lg border-2 transition text-left ${
                scheduleType === type
                  ? "border-blue-500 bg-blue-50"
                  : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex items-center gap-2 mb-1">
                {type === "manual" && <Clock size={16} />}
                {type === "scheduled" && <Calendar size={16} />}
                {type === "recurring" && <RotateCw size={16} />}
                <span className="font-medium text-sm capitalize">{type}</span>
              </div>
              <p className="text-xs text-slate-600">
                {type === "manual" && "Send immediately"}
                {type === "scheduled" && "Send at specific time"}
                {type === "recurring" && "Repeat on schedule"}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Scheduled Options */}
      {scheduleType === "scheduled" && (
        <div className="space-y-4 mb-6 p-4 bg-slate-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Send Date & Time
            </label>
            <input
              type="datetime-local"
              value={scheduledDateTime}
              onChange={(e) => setScheduledDateTime(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
            <p className="text-xs text-slate-600 mt-1">
              Campaign will send at this exact time
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Timezone
            </label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            >
              <option>UTC</option>
              <option>America/New_York</option>
              <option>America/Chicago</option>
              <option>America/Denver</option>
              <option>America/Los_Angeles</option>
              <option>Europe/London</option>
              <option>Europe/Paris</option>
              <option>Asia/Tokyo</option>
              <option>Asia/Singapore</option>
              <option>Australia/Sydney</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              End Date (Optional)
            </label>
            <input
              type="datetime-local"
              value={endDateTime}
              onChange={(e) => setEndDateTime(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
            <p className="text-xs text-slate-600 mt-1">
              Campaign will stop sending after this time
            </p>
          </div>
        </div>
      )}

      {/* Recurring Options */}
      {scheduleType === "recurring" && (
        <div className="space-y-4 mb-6 p-4 bg-slate-50 rounded-lg">
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Frequency
            </label>
            <select
              value={frequency}
              onChange={(e) =>
                setFrequency(e.target.value as RecurrenceFrequency)
              }
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            >
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>

          {frequency === "weekly" && (
            <div>
              <label className="block text-sm font-medium text-slate-900 mb-2">
                Days of Week
              </label>
              <div className="grid grid-cols-7 gap-2">
                {[
                  "Monday",
                  "Tuesday",
                  "Wednesday",
                  "Thursday",
                  "Friday",
                  "Saturday",
                  "Sunday",
                ].map((day) => (
                  <button
                    key={day}
                    onClick={() =>
                      setDaysOfWeek((prev) =>
                        prev.includes(day)
                          ? prev.filter((d) => d !== day)
                          : [...prev, day],
                      )
                    }
                    className={`py-2 rounded text-sm font-medium transition ${
                      daysOfWeek.includes(day)
                        ? "bg-blue-500 text-white"
                        : "bg-white border border-slate-200 text-slate-700 hover:border-slate-300"
                    }`}
                  >
                    {day.slice(0, 3)}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Send Time
            </label>
            <input
              type="time"
              value={sendTime}
              onChange={(e) => setSendTime(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              Start Date
            </label>
            <input
              type="date"
              value={recurringStartDate}
              onChange={(e) => setRecurringStartDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">
              End Date (Optional)
            </label>
            <input
              type="date"
              value={recurringEndDate}
              onChange={(e) => setRecurringEndDate(e.target.value)}
              className="w-full px-4 py-2 border border-slate-300 rounded-lg"
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-2 justify-end">
        <Button
          variant="outline"
          onClick={() => setEditing(false)}
          disabled={loading}
        >
          Cancel
        </Button>
        <Button onClick={handleSaveSchedule} disabled={loading}>
          {loading ? "Saving..." : "Save Schedule"}
        </Button>
      </div>
    </Card>
  );
}
