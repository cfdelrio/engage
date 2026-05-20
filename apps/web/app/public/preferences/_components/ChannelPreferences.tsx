'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface Preference {
  channel: string;
  category?: string;
  enabled: boolean;
  quietHoursStart: number | null;
  quietHoursEnd: number | null;
}

interface ChannelPreferencesProps {
  channels: readonly string[];
  preferences: Preference[];
  onToggle: (channel: string, enabled: boolean) => void;
  onQuietHoursClick: (channel: string) => void;
  disabled?: boolean;
  userTimezone: string;
}

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  sms: 'SMS / Text Messages',
  push: 'Push Notifications',
  whatsapp: 'WhatsApp',
  voice: 'Voice Calls',
};

function minutesToTimeString(minutes: number | null | undefined): string {
  if (!minutes && minutes !== 0) return '-';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
}

export function ChannelPreferences({
  channels,
  preferences,
  onToggle,
  onQuietHoursClick,
  disabled,
  userTimezone,
}: ChannelPreferencesProps) {
  return (
    <div className="space-y-4">
      {channels.map((channel) => {
        const pref = preferences.find((p) => p.channel === channel && !p.category);
        const enabled = pref?.enabled ?? true;
        const hasQuietHours = pref?.quietHoursStart !== null || pref?.quietHoursEnd !== null;

        return (
          <div key={channel} className="border rounded-lg p-4 bg-white">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3 flex-1">
                <Checkbox
                  id={`channel-${channel}`}
                  checked={enabled}
                  onCheckedChange={(checked) => onToggle(channel, checked as boolean)}
                  disabled={disabled}
                />
                <div className="flex-1">
                  <Label htmlFor={`channel-${channel}`} className="font-medium cursor-pointer">
                    {CHANNEL_LABELS[channel] || channel}
                  </Label>
                  {hasQuietHours && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Quiet hours: {minutesToTimeString(pref?.quietHoursStart)} -{' '}
                      {minutesToTimeString(pref?.quietHoursEnd)} ({userTimezone})
                    </p>
                  )}
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onQuietHoursClick(channel)}
                disabled={disabled || !enabled}
              >
                Set Quiet Hours
              </Button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
