export function isQuietHours(
  timezone: string,
  quietStartMinutes: number, // 0-1439 (minutes from midnight)
  quietEndMinutes: number,   // 0-1439
  now: Date = new Date(),
): boolean {
  const localMinutes = getLocalMinutes(timezone, now);

  if (quietStartMinutes <= quietEndMinutes) {
    // Same-day window: e.g., 09:00-18:00 (540-1080 minutes)
    return localMinutes >= quietStartMinutes && localMinutes < quietEndMinutes;
  } else {
    // Overnight window: e.g., 22:00-08:00 (1320-480 minutes)
    return localMinutes >= quietStartMinutes || localMinutes < quietEndMinutes;
  }
}

function getLocalMinutes(timezone: string, date: Date): number {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    minute: 'numeric',
    hour12: false,
  });

  const parts = formatter.formatToParts(date);
  const hour = parseInt(parts.find((p) => p.type === 'hour')?.value ?? '0', 10);
  const minute = parseInt(parts.find((p) => p.type === 'minute')?.value ?? '0', 10);

  return hour * 60 + minute;
}
