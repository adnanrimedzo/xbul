import { sql } from 'drizzle-orm';
import { getContainer } from '@/server/container';

export const dynamic = 'force-dynamic';

const answer = (status: 'ok' | 'unavailable', code: number) => Response.json({ status }, { status: code, headers: { 'Cache-Control': 'no-store' } });

// For uptime monitors and scripts/smoke.mjs. It reads and writes nothing of ours, and the public never learns why it failed.
export async function GET(): Promise<Response> {
  try {
    const { db } = await getContainer();
    await db.execute(sql`select 1`);
    return answer('ok', 200);
  } catch (e) {
    console.error('[health] database check failed', e);
    return answer('unavailable', 503);
  }
}
