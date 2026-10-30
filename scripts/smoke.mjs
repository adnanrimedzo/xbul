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
