import { DomainError } from '@/shared/domain/errors';

const TRACKING_PARAM = /^(utm_.*|mc_.*|gclid|fbclid|srsltid|_ga|ref)$/i;

export function parseHttpUrl(raw: string): URL {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new DomainError('product.url_invalid');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new DomainError('product.url_invalid');
  return url;
}

export function canonicalizeProductUrl(raw: string): string {
  const url = parseHttpUrl(raw);
  url.protocol = 'https:';
  url.hostname = url.hostname.replace(/^www\./, '');
  url.username = '';
  url.password = '';
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  url.searchParams.sort();
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '') || '/';
  return url.href;
}

function isPrivateIPv4(a: number, b: number): boolean {
  return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateHost(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.+$/, '');
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return true;

  const v4 = /^(\d+)\.(\d+)\.\d+\.\d+$/.exec(host);
  if (v4) return isPrivateIPv4(Number(v4[1]), Number(v4[2]));

  if (!host.includes(':')) return false;
  if (host === '::' || host === '::1') return true;
  const first = parseInt(host.split(':')[0] ?? '', 16);
  if ((first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80) return true; // fc00::/7, fe80::/10
  // URL normalises ::ffff:a.b.c.d to ::ffff:xxxx:xxxx
  const mapped = /^::ffff:([0-9a-f]{1,4}):[0-9a-f]{1,4}$/.exec(host);
  const hi = mapped ? parseInt(mapped[1]!, 16) : 0;
  return mapped ? isPrivateIPv4(hi >> 8, hi & 0xff) : false;
}

// ponytail: no DNS resolution, so rebinding isn't covered; Workers' global_fetch_strictly_public covers prod
export function assertPublicHttpUrl(url: URL, opts: { allowPrivateHosts: boolean }): void {
  if (!opts.allowPrivateHosts && isPrivateHost(url.hostname)) throw new DomainError('product.url_not_public');
}

export function brandFromHost(host: string): string {
  const labels = host.toLowerCase().replace(/\.+$/, '').split('.');
  const n = labels.length;
  const secondLevel = n >= 3 && ['co', 'com', 'net', 'org'].includes(labels[n - 2]!) && labels[n - 1]!.length === 2;
  return (labels[secondLevel ? n - 3 : n - 2] ?? labels[0]!).toUpperCase();
}
