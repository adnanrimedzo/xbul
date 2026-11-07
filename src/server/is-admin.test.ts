import { expect, it } from 'vitest';
import { isAdmin } from './is-admin';

it('grants admin only to a listed address the sign-in method has verified', () => {
  const admins = ['owner@x.test'];
  expect(isAdmin({ email: 'Owner@X.test', emailVerified: true }, admins)).toBe(true);
  // A Microsoft directory can put any address on its own users: an unverified one must never pass as an admin.
  expect(isAdmin({ email: 'owner@x.test', emailVerified: false }, admins)).toBe(false);
  expect(isAdmin({ email: 'someone@x.test', emailVerified: true }, admins)).toBe(false);
});
