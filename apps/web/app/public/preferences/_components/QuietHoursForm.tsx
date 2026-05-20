'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface Preference {
  channel: string;
  category?: string;
  enabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

interface QuietHoursFormProps {
  channel: string;
  preferences: Preference[];
  onSave: (channel: string, start: number | null, end: number | null) => void;
  userTimezone: string;
  disabled?: boolean;
}

function minutesToTime(minutes: number | null): { hours: string; minutes: string } {
  if (minutes === null) {
    return { hours: '', minutes: '' };
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return {
    hours: String(h).padStart(2, '0'),
    minutes: String(m).padStart(2, '0'),
  };
}

function timeToMinutes(hours: string, minutes: string): number | null {
  if (!hours || !minutes) return null;
  return parseInt(hours) * 60 + parseInt(minutes);
}

export function QuietHoursForm({
  channel,
  preferences,
  onSave,
  userTimezone,
  disabled,
}: QuietHoursFormProps) {
  const pref = preferences.find((p) => p.channel === channel && !p.category);
  const [startTime, setStartTime] = useState(minutesToTime(pref?.quietHoursStart ?? null));
  const [endTime, setEndTime] = useState(minutesToTime(pref?.quietHoursEnd ?? null));
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    setError(null);

    const start = timeToMinutes(startTime.hours, startTime.minutes);
    const end = timeToMinutes(endTime.hours, endTime.minutes);

    // Validation
    if ((startTime.hours || startTime.minutes) && !start) {
      setError('Invalid start time');
      return;
    }
    if ((endTime.hours || endTime.minutes) && !end) {
      setError('Invalid end time');
      return;
    }

    if (start !== null && end !== null && start === end) {
      setError('Start and end times cannot be the same');
      return;
    }

    onSave(channel, start, end);
  };

  const handleClear = () => {
    setStartTime({ hours: '', minutes: '' });
    setEndTime({ hours: '', minutes: '' });
    onSave(channel, null, null);
  };

  return (
    <div className="space-y-4">
      <div className="text-sm text-muted-foreground">
        Set a time window when you don&apos;t want to receive {channel} messages (in {userTimezone})
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label>From</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="HH"
              min="0"
              max="23"
              value={startTime.hours}
              onChange={(e) => setStartTime({ ...startTime, hours: e.target.value })}
              disabled={disabled}
              className="w-16"
            />
            <span className="flex items-center">:</span>
            <Input
              type="number"
              placeholder="MM"
              min="0"
              max="59"
              value={startTime.minutes}
              onChange={(e) => setStartTime({ ...startTime, minutes: e.target.value })}
              disabled={disabled}
              className="w-16"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label>To</Label>
          <div className="flex gap-2">
            <Input
              type="number"
              placeholder="HH"
              min="0"
              max="23"
              value={endTime.hours}
              onChange={(e) => setEndTime({ ...endTime, hours: e.target.value })}
              disabled={disabled}
              className="w-16"
            />
            <span className="flex items-center">:</span>
            <Input
              type="number"
              placeholder="MM"
              min="0"
              max="59"
              value={endTime.minutes}
              onChange={(e) => setEndTime({ ...endTime, minutes: e.target.value })}
              disabled={disabled}
              className="w-16"
            />
          </div>
        </div>
      </div>

      {error && <div className="text-sm text-red-600">{error}</div>}

      <div className="flex gap-2">
        <Button onClick={handleSave} disabled={disabled} className="flex-1">
          Save Quiet Hours
        </Button>
        <Button onClick={handleClear} variant="outline" disabled={disabled}>
          Clear
        </Button>
      </div>
    </div>
  );
}
