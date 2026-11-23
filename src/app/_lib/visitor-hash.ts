import { createHash } from 'node:crypto';

// Stands in for the visitor in the search log: the same address gives the same hash for one UTC day, so a
// returning visitor counts once a day, and the address itself is never stored. The secret keeps the hash
// from being reversed by trying every address.
export function visitorHash(ip: string | null, secret: string, now: Date): string | null {
  if (!ip) return null;
  return createHash('sha256').update(`${now.toISOString().slice(0, 10)}:${ip}:${secret}`).digest('hex');
}

// The visitor's address as Cloudflare reports it, else the first hop a proxy recorded (next dev), else none.
export function clientIp(h: { get(name: string): string | null }): string | null {
  return h.get('cf-connecting-ip') || h.get('x-forwarded-for')?.split(',')[0]?.trim() || null;
}
