// Read-only check of a running site: node scripts/smoke.mjs https://xbul.io
const origin = process.argv[2];
if (!origin) {
  console.error('Usage: node scripts/smoke.mjs <origin>');
  process.exit(1);
}

const checks = [
  ['home page', '/', async (res) => res.status === 200 && (await res.text()).includes('xbul')],
  ['sign-in page', '/sign-in', (res) => res.status === 200],
  ['database', '/api/health', async (res) => res.status === 200 && (await res.json()).status === 'ok'],
  ['private files stay hidden', '/api/evidence/00000000-0000-4000-8000-000000000000', async (res) => res.status === 404 && (await res.text()) === ''],
  ['admin pages turn visitors away', '/admin/stats', (res) => res.status === 307 && !(res.headers.get('location') ?? '').includes('/admin')],
  ['logo (static file)', '/logos/xbul-logo-white.svg', (res) => res.status === 200 && (res.headers.get('content-type') ?? '').includes('image/svg+xml')],
  ['pages refuse framing', '/', (res) => res.headers.get('x-frame-options') === 'DENY'],
  // Only production lets search engines in; staging and local must block everything.
  ['robots rules', '/robots.txt', async (res) => res.status === 200 && (await res.text()).includes('Disallow: /\n') === (new URL(origin).origin !== 'https://xbul.io')],
  ['scripts cached for good', '/', async (res) => {
    const script = (await res.text()).match(/\/_next\/static\/[^"']+\.js/)?.[0];
    if (!script) return false;
    const asset = await fetch(new URL(script, origin), { signal: AbortSignal.timeout(15_000) });
    return asset.status === 200 && (asset.headers.get('cache-control') ?? '').includes('immutable');
  }],
];

let failed = 0;
for (const [name, path, passes] of checks) {
  let result;
  try {
    const res = await fetch(new URL(path, origin), { redirect: 'manual', signal: AbortSignal.timeout(15_000) });
    result = (await passes(res)) ? 'ok' : `FAILED (status ${res.status})`;
  } catch (e) {
    result = `FAILED (${e.cause?.code ?? e.message})`;
  }
  if (result !== 'ok') failed++;
  console.log(`${name}: ${result}`);
}
process.exit(failed ? 1 : 0);
