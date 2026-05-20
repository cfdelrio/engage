'use client';

import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';

interface Preference {
  channel: string;
  category?: string;
  enabled: boolean;
}

interface CategoryPreferencesProps {
  channels: readonly string[];
  categories: readonly string[];
  preferences: Preference[];
  onToggle: (channel: string, category: string, enabled: boolean) => void;
  disabled?: boolean;
}

const CATEGORY_LABELS: Record<string, string> = {
  promotions: 'Promotions & Offers',
  updates: 'Product Updates',
  alerts: 'Important Alerts',
  news: 'News & Announcements',
  announcements: 'General Announcements',
};

const CHANNEL_LABELS: Record<string, string> = {
  email: 'Email',
  sms: 'SMS',
  push: 'Push',
  whatsapp: 'WhatsApp',
  voice: 'Voice',
};

export function CategoryPreferences({
  channels,
  categories,
  preferences,
  onToggle,
  disabled,
}: CategoryPreferencesProps) {
  return (
    <div className="space-y-6">
      {categories.map((category) => (
        <div key={category} className="space-y-3">
          <h3 className="font-medium text-sm">{CATEGORY_LABELS[category] || category}</h3>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
            {channels.map((channel) => {
              const pref = preferences.find((p) => p.channel === channel && p.category === category);
              const enabled = pref?.enabled ?? true;
              const id = `${channel}-${category}`;

              return (
                <div key={id} className="flex items-center gap-2">
                  <Checkbox
                    id={id}
                    checked={enabled}
                    onCheckedChange={(checked) => onToggle(channel, category, checked as boolean)}
                    disabled={disabled}
                  />
                  <Label htmlFor={id} className="font-normal text-xs cursor-pointer">
                    {CHANNEL_LABELS[channel] || channel}
                  </Label>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
