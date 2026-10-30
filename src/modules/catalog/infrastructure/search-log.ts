import type { Db } from '@/shared/db/client';
import { searchEvents } from './schema';

export type SearchLog = { record(input: { matched: boolean; visitorHash: string | null }): Promise<void> };

export function createSearchLog(db: Db): SearchLog {
  return {
    async record({ matched, visitorHash }) {
      await db.insert(searchEvents).values({ id: crypto.randomUUID(), matched, visitorHash });
    },
  };
}
