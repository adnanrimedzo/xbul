import { expect, it } from 'vitest';
import { createSupplierRepositories, registerCompany } from '@/modules/supplier';
import type { Db } from '@/shared/db/client';
import { createTestDb } from '@/shared/db/testing';
import { createProfile } from '../domain/profile';
import { user } from '../infrastructure/auth-schema';
import { createProfileRepository } from '../infrastructure/drizzle-profile-repository';
import { createUserDirectory } from '../infrastructure/user-directory';
import { completeOnboarding } from './complete-onboarding';

// profiles.user_id references the Better Auth user table, so every userId needs a real row.
const insertUser = (db: Db, id: string, email = `${id}@example.test`) =>
  db.insert(user).values({ id, name: id, email });

it('onboards a mill with its company, once', async () => {
  const db = await createTestDb(); const profiles = createProfileRepository(db); const supplier = createSupplierRepositories(db);
  await insertUser(db, 'u1'); await insertUser(db, 'u9');
  const deps = { profiles, registerCompany: (i: Parameters<typeof registerCompany>[1]) => registerCompany(supplier, i) };
  const r = await completeOnboarding(deps, { userId: 'u1', displayName: 'Ali Kaya', role: 'mill', company: { name: 'Aksu Denim', city: 'Istanbul', country: 'TR' } });
  expect(r).toMatchObject({ companySlug: 'aksu-denim', profile: { role: 'mill', handle: null } });
  await expect(completeOnboarding(deps, { userId: 'u1', displayName: 'Ali', role: 'agent' })).rejects.toMatchObject({ code: 'profile.exists' });
  await expect(completeOnboarding(deps, { userId: 'u9', displayName: 'No Co', role: 'mill' })).rejects.toMatchObject({ code: 'profile.company_required' });
});

it('retries colliding agent handles', async () => {
  const db = await createTestDb(); const profiles = createProfileRepository(db);
  await insertUser(db, 'u0'); await insertUser(db, 'u1');
  await profiles.save(createProfile({ userId: 'u0', role: 'agent', displayName: 'Laura Martin' }, () => 'aaaa'));
  const seq = ['aaaa', 'aaaa', 'bbbb']; const r = await completeOnboarding({ profiles, registerCompany: async () => ({ slug: '' }), randomSuffix: () => seq.shift()! },
    { userId: 'u1', displayName: 'Laura Martin', role: 'agent' });
  expect(r.profile.handle).toBe('lauramartin-bbbb');
});

it('gives up after five colliding handles', async () => {
  const db = await createTestDb(); const profiles = createProfileRepository(db);
  await insertUser(db, 'u0'); await insertUser(db, 'u1');
  await profiles.save(createProfile({ userId: 'u0', role: 'agent', displayName: 'Laura Martin' }, () => 'aaaa'));
  let calls = 0;
  await expect(completeOnboarding({ profiles, registerCompany: async () => ({ slug: '' }), randomSuffix: () => (calls++, 'aaaa') },
    { userId: 'u1', displayName: 'Laura Martin', role: 'agent' })).rejects.toMatchObject({ code: 'profile.handle_unavailable' });
  expect(calls).toBe(5);
  expect(await profiles.findByUserId('u1')).toBeNull();
});

it('draws a four-character [a-z0-9] suffix by default', async () => {
  const db = await createTestDb(); const profiles = createProfileRepository(db);
  await insertUser(db, 'u1');
  const r = await completeOnboarding({ profiles, registerCompany: async () => ({ slug: '' }) }, { userId: 'u1', displayName: 'Laura Martin', role: 'agent' });
  expect(r).toMatchObject({ companySlug: null });
  expect(r.profile.handle).toMatch(/^lauramartin-[a-z0-9]{4}$/);
});

it('registers the company before saving the profile', async () => {
  const db = await createTestDb(); const profiles = createProfileRepository(db);
  await insertUser(db, 'u1');
  const deps = { profiles, registerCompany: async () => { throw new Error('company down'); } };
  await expect(completeOnboarding(deps, { userId: 'u1', displayName: 'Ali Kaya', role: 'mill', company: { name: 'Aksu Denim', city: 'Istanbul', country: 'TR' } }))
    .rejects.toThrow('company down');
  expect(await profiles.findByUserId('u1')).toBeNull();
});

it('persists profiles and reads back plain domain objects', async () => {
  const db = await createTestDb(); const profiles = createProfileRepository(db);
  await insertUser(db, 'u1'); await insertUser(db, 'u2');
  const agent = createProfile({ userId: 'u1', role: 'agent', displayName: 'Laura Martin' }, () => 'x7k2');
  const mill = createProfile({ userId: 'u2', role: 'mill', displayName: 'Ali Kaya' }, () => 'zzzz');
  await profiles.save(agent); await profiles.save(mill);
  expect(await profiles.findByUserId('u1')).toEqual(agent);
  expect(await profiles.findByUserId('u2')).toEqual(mill);
  expect(await profiles.findByHandle('lauramartin-x7k2')).toEqual(agent);
  expect(await profiles.handleExists('lauramartin-x7k2')).toBe(true);
  expect(await profiles.handleExists('nobody-0000')).toBe(false);
  expect(await profiles.findByHandle('nobody-0000')).toBeNull();
  expect(Object.isFrozen(await profiles.findByUserId('u1'))).toBe(true);
});

it('looks up a user email by id', async () => {
  const db = await createTestDb();
  await insertUser(db, 'u1', 'mill@example.test');
  const directory = createUserDirectory(db);
  expect(await directory.getEmail('u1')).toBe('mill@example.test');
  expect(await directory.getEmail('missing')).toBeNull();
});
