export const formatClock = (d: Date): string =>
  d.toLocaleTimeString('en-GB', { timeZone: 'Europe/Istanbul', hour12: false });
