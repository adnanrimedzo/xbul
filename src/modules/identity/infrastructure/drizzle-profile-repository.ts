import { eq, type SQL } from 'drizzle-orm';
import type { Db } from '@/shared/db/client';
import type { Profile, Role } from '../domain/profile';
import type { ProfileRepository } from '../domain/repositories';
import { profiles } from './schema';

const toProfile = (r: typeof profiles.$inferSelect): Profile =>
  Object.freeze({ userId: r.userId, role: r.role as Role, displayName: r.displayName, handle: r.handle, createdAt: r.createdAt });

export function createProfileRepository(db: Db): ProfileRepository {
  const profileBy = async (where: SQL) => {
    const [row] = await db.select().from(profiles).where(where).limit(1);
    return row ? toProfile(row) : null;
  };

  return {
    async save(p) {
      await db.insert(profiles).values(p).onConflictDoUpdate({ target: profiles.userId, set: p });
    },
    findByUserId: (id) => profileBy(eq(profiles.userId, id)),
    findByHandle: (handle) => profileBy(eq(profiles.handle, handle)),
    async handleExists(handle) {
      return (await db.select({ userId: profiles.userId }).from(profiles).where(eq(profiles.handle, handle)).limit(1)).length > 0;
    },
  };
}
