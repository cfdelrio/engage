export function isQuietHours(
  timezone: string,
  quietStart: number, // hour 0-23
  quietEnd: number,   // hour 0-23
  now: Date = new Date(),
): boolean {
  const localHour = getLocalHour(timezone, now);

  if (quietStart <= quietEnd) {
    // Same-day window: e.g., 09:00-18:00
    return localHour >= quietStart && localHour < quietEnd;
  } else {
    // Overnight window: e.g., 22:00-08:00
    return localHour >= quietStart || localHour < quietEnd;
  }
}

function getLocalHour(timezone: string, date: Date): number {
  const formatted = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    hour: 'numeric',
    hour12: false,
  }).format(date);
  return parseInt(formatted, 10);
}
