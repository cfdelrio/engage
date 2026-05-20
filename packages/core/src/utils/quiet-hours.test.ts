import { describe, it, expect } from 'vitest';
import { isQuietHours } from './quiet-hours.js';

// Buenos Aires is UTC-3
const BUE = 'America/Argentina/Buenos_Aires';

function makeDateAtHour(utcHour: number): Date {
  const d = new Date('2024-06-15T00:00:00Z');
  d.setUTCHours(utcHour, 0, 0, 0);
  return d;
}

describe('isQuietHours', () => {
  describe('same-day window (22:00–08:00 local → simple case with overnight)', () => {
    it('returns true at 23:00 local (02:00 UTC)', () => {
      const now = makeDateAtHour(2); // 02:00 UTC = 23:00 BUE
      expect(isQuietHours(BUE, 22, 8, now)).toBe(true);
    });

    it('returns true at 07:00 local (10:00 UTC)', () => {
      const now = makeDateAtHour(10); // 10:00 UTC = 07:00 BUE
      expect(isQuietHours(BUE, 22, 8, now)).toBe(true);
    });

    it('returns false at 12:00 local (15:00 UTC)', () => {
      const now = makeDateAtHour(15); // 15:00 UTC = 12:00 BUE
      expect(isQuietHours(BUE, 22, 8, now)).toBe(false);
    });

    it('returns false at exactly 08:00 local (boundary)', () => {
      const now = makeDateAtHour(11); // 11:00 UTC = 08:00 BUE
      expect(isQuietHours(BUE, 22, 8, now)).toBe(false);
    });

    it('returns true at exactly 22:00 local (boundary start)', () => {
      const d = new Date('2024-06-15T22:00:00-03:00');
      expect(isQuietHours(BUE, 22, 8, d)).toBe(true);
    });
  });

  describe('within-day window (09:00–17:00 — business hours, no overnight)', () => {
    it('returns true at 12:00 local (during window)', () => {
      const d = new Date('2024-06-15T12:00:00-03:00');
      expect(isQuietHours(BUE, 9, 17, d)).toBe(true);
    });

    it('returns false at 08:00 local (before window)', () => {
      const d = new Date('2024-06-15T08:00:00-03:00');
      expect(isQuietHours(BUE, 9, 17, d)).toBe(false);
    });

    it('returns false at 18:00 local (after window)', () => {
      const d = new Date('2024-06-15T18:00:00-03:00');
      expect(isQuietHours(BUE, 9, 17, d)).toBe(false);
    });
  });

  describe('different timezone — New York (UTC-4 in summer)', () => {
    it('returns true at 23:30 NYC (overnight quiet hours 22–07)', () => {
      const d = new Date('2024-06-15T23:30:00-04:00');
      expect(isQuietHours('America/New_York', 22, 7, d)).toBe(true);
    });

    it('returns false at 14:00 NYC', () => {
      const d = new Date('2024-06-15T14:00:00-04:00');
      expect(isQuietHours('America/New_York', 22, 7, d)).toBe(false);
    });
  });
});
