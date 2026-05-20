/**
 * User Preferences Types
 * Quiet hours, channel opt-in, category filters
 */

export interface UserPreferenceResponse {
  userId: string;
  tenantId: string;
  channel: string; // 'email', 'sms', 'push', 'whatsapp', 'voice'
  category: string; // 'all', 'promotions', 'updates', 'alerts', or custom
  enabled: boolean;
  quietHoursStart: number | null; // 0-1439 (minutes from midnight UTC)
  quietHoursEnd: number | null;
  updatedAt: string;
}

export interface UpdateUserPreferenceRequest {
  channel: string;
  category?: string;
  enabled?: boolean;
  quietHoursStart?: number | null; // null to clear
  quietHoursEnd?: number | null;
}

export interface BulkUpdateUserPreferenceRequest {
  preferences: Array<{
    channel: string;
    category?: string;
    enabled?: boolean;
    quietHoursStart?: number | null;
    quietHoursEnd?: number | null;
  }>;
}

/**
 * Validation result for delivery pipeline
 * Determines if message should be sent based on user preferences
 */
export interface PreferenceValidationResult {
  allowed: boolean;
  reason?: string; // 'disabled_channel' | 'quiet_hours' | 'disabled_category' | 'ok'
}

/**
 * Quiet hours helper
 * quietHoursStart/End are minutes from midnight in UTC
 * To convert: HH:MM → (HH * 60) + MM
 */
export function timeToMinutes(hours: number, minutes: number): number {
  return hours * 60 + minutes;
}

export function minutesToTime(minutes: number): { hours: number; minutes: number } {
  return {
    hours: Math.floor(minutes / 60),
    minutes: minutes % 60,
  };
}

import { isQuietHours } from '../utils/quiet-hours.js';

/**
 * Check if current time (in user's timezone) is within quiet hours
 * Wrapper for backward compatibility (params in different order than isQuietHours)
 */
export function isInQuietHours(
  quietHoursStart: number | null,
  quietHoursEnd: number | null,
  userTimezone: string,
): boolean {
  if (!quietHoursStart || !quietHoursEnd) return false;
  return isQuietHours(userTimezone, quietHoursStart, quietHoursEnd);
}

/**
 * Categories (extensible)
 * Can be extended per tenant
 */
export const DEFAULT_CATEGORIES = [
  'all',
  'promotions',
  'updates',
  'alerts',
  'news',
  'announcements',
] as const;

export type PreferenceCategory = (typeof DEFAULT_CATEGORIES)[number] | string;
