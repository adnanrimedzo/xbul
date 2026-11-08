import { eq } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import { user } from './auth-schema';

export async function findUserEmail(db: Db, userId: string): Promise<string | null> {
  const [row] = await db.select({ email: user.email }).from(user).where(eq(user.id, userId)).limit(1);
  return row?.email ?? null;
}
