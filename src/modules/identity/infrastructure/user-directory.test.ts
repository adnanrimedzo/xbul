import { expect, it } from 'vitest';
import { createTestDb } from '@/shared/db/testing';
import { user } from './auth-schema';
import { createUserDirectory } from './user-directory';

it('looks up a user email by id', async () => {
  const db = await createTestDb();
  await db.insert(user).values({ id: 'u1', name: 'u1', email: 'mill@example.test' });
  const directory = createUserDirectory(db);
  expect(await directory.getEmail('u1')).toBe('mill@example.test');
  expect(await directory.getEmail('missing')).toBeNull();
});
