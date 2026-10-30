import { createHash } from 'node:crypto';

// Stands in for the visitor in the search log: the same address gives the same hash for one UTC day, so a
// returning visitor counts once a day, and the address itself is never stored. The secret keeps the hash
// from being reversed by trying every address.
export function visitorHash(ip: string | null, secret: string, now: Date): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${now.toISOString().slice(0, 10)}:${ip}:${secret}`).digest('hex');
}
