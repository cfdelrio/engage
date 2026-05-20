import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  timeToMinutes,
  minutesToTime,
  isInQuietHours,
  PreferenceCategory,
} from '../src/types/user-preferences.js';

describe('User Preferences Helpers', () => {
  describe('timeToMinutes', () => {
    it('should convert hours and minutes to minutes from midnight', () => {
      expect(timeToMinutes(0, 0)).toBe(0);
      expect(timeToMinutes(1, 0)).toBe(60);
      expect(timeToMinutes(12, 0)).toBe(720);
      expect(timeToMinutes(23, 59)).toBe(1439);
      expect(timeToMinutes(9, 30)).toBe(570);
    });

    it('should handle edge cases', () => {
      expect(timeToMinutes(0, 1)).toBe(1);
      expect(timeToMinutes(23, 0)).toBe(1380);
    });
  });

  describe('minutesToTime', () => {
    it('should convert minutes from midnight to hours and minutes', () => {
      const result0 = minutesToTime(0);
      expect(result0.hours).toBe(0);
      expect(result0.minutes).toBe(0);

      const result60 = minutesToTime(60);
      expect(result60.hours).toBe(1);
      expect(result60.minutes).toBe(0);

      const result570 = minutesToTime(570);
      expect(result570.hours).toBe(9);
      expect(result570.minutes).toBe(30);

      const result1439 = minutesToTime(1439);
      expect(result1439.hours).toBe(23);
      expect(result1439.minutes).toBe(59);
    });

    it('should handle edge cases', () => {
      const result1 = minutesToTime(1);
      expect(result1.hours).toBe(0);
      expect(result1.minutes).toBe(1);

      const result1380 = minutesToTime(1380);
      expect(result1380.hours).toBe(23);
      expect(result1380.minutes).toBe(0);
    });

    it('should be inverse of timeToMinutes', () => {
      const testCases = [
        [0, 0],
        [1, 30],
        [12, 45],
        [23, 59],
        [9, 5],
      ];

      for (const [hours, minutes] of testCases) {
        const converted = timeToMinutes(hours, minutes);
        const back = minutesToTime(converted);
        expect(back.hours).toBe(hours);
        expect(back.minutes).toBe(minutes);
      }
    });
  });

  describe('isInQuietHours', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('should return false if quietHoursStart is null', () => {
      const result = isInQuietHours(null, 480, 'America/New_York');
      expect(result).toBe(false);
    });

    it('should return false if quietHoursEnd is null', () => {
      const result = isInQuietHours(1320, null, 'America/New_York');
      expect(result).toBe(false);
    });

    it('should return false if both are null', () => {
      const result = isInQuietHours(null, null, 'America/New_York');
      expect(result).toBe(false);
    });

    it('should detect when within quiet hours (no wrap-around)', () => {
      // Set time to 10:00 UTC (600 minutes from midnight)
      vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));

      // Quiet hours: 08:00 - 17:00 (480 - 1020 minutes)
      // 10:00 is within this range
      const result = isInQuietHours(480, 1020, 'UTC');
      expect(result).toBe(true);
    });

    it('should detect when outside quiet hours (no wrap-around)', () => {
      // Set time to 19:00 UTC
      vi.setSystemTime(new Date('2024-01-01T19:00:00Z'));

      // Quiet hours: 08:00 - 17:00
      // 19:00 is outside this range
      const result = isInQuietHours(480, 1020, 'UTC');
      expect(result).toBe(false);
    });

    it('should handle wrap-around quiet hours (midnight crossing)', () => {
      // Set time to 23:30 UTC (1410 minutes)
      vi.setSystemTime(new Date('2024-01-01T23:30:00Z'));

      // Quiet hours: 22:00 - 08:00 (1320 - 480 minutes, wraps around midnight)
      // 23:30 is within this range
      const result = isInQuietHours(1320, 480, 'UTC');
      expect(result).toBe(true);
    });

    it('should handle wrap-around: early morning in quiet hours', () => {
      // Set time to 05:00 UTC
      vi.setSystemTime(new Date('2024-01-01T05:00:00Z'));

      // Quiet hours: 22:00 - 08:00
      // 05:00 is within this range
      const result = isInQuietHours(1320, 480, 'UTC');
      expect(result).toBe(true);
    });

    it('should handle wrap-around: outside quiet hours', () => {
      // Set time to 10:00 UTC
      vi.setSystemTime(new Date('2024-01-01T10:00:00Z'));

      // Quiet hours: 22:00 - 08:00
      // 10:00 is outside this range
      const result = isInQuietHours(1320, 480, 'UTC');
      expect(result).toBe(false);
    });

    it('should respect user timezone', () => {
      // Set time to 2024-01-01T00:00:00Z (midnight UTC)
      vi.setSystemTime(new Date('2024-01-01T00:00:00Z'));

      // In Argentina (UTC-3), this is 21:00 on 2023-12-31
      // Quiet hours: 22:00 - 08:00 (1320 - 480), so 21:00 is NOT in quiet hours
      const result = isInQuietHours(1320, 480, 'America/Buenos_Aires');
      expect(result).toBe(false);

      // For comparison, set time to 01:00 UTC (which is 22:00 Argentina previous day)
      vi.setSystemTime(new Date('2024-01-01T01:00:00Z'));
      const result2 = isInQuietHours(1320, 480, 'America/Buenos_Aires');
      expect(result2).toBe(true);
    });

    it('should handle boundary times correctly', () => {
      // Test at exact start of quiet hours
      vi.setSystemTime(new Date('2024-01-01T08:00:00Z'));
      const result1 = isInQuietHours(480, 1020, 'UTC');
      expect(result1).toBe(true);

      // Test one minute before end (should be in quiet hours)
      vi.setSystemTime(new Date('2024-01-01T16:59:00Z'));
      const result2 = isInQuietHours(480, 1020, 'UTC');
      expect(result2).toBe(true);

      // Test at exact end (should be outside)
      vi.setSystemTime(new Date('2024-01-01T17:00:00Z'));
      const result3 = isInQuietHours(480, 1020, 'UTC');
      expect(result3).toBe(false);
    });

    it('should work with various timezones', () => {
      vi.setSystemTime(new Date('2024-01-01T12:00:00Z'));

      // Test with EST (UTC-5)
      const estResult = isInQuietHours(480, 1020, 'America/New_York');
      // 12:00 UTC is 07:00 EST, which is before quiet hours start at 08:00
      expect(estResult).toBe(false);

      // Test with IST (UTC+5:30)
      const istResult = isInQuietHours(480, 1020, 'Asia/Kolkata');
      // 12:00 UTC is 17:30 IST, which is after quiet hours end at 17:00 (outside)
      expect(istResult).toBe(false);
    });
  });

  describe('PreferenceCategory type', () => {
    it('should accept default category values', () => {
      const categories: PreferenceCategory[] = [
        'all',
        'promotions',
        'updates',
        'alerts',
        'news',
        'announcements',
        'custom-category',
      ];

      expect(categories).toBeTruthy();
      expect(categories.length).toBe(7);
    });
  });
});
