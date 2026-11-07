import { expect, it } from 'vitest';
import { createTestDb } from '@/shared/db/testing';
import { createRecordingMailer } from '@/shared/mail/testing';
import { createAuth } from './auth';
import { rateLimit } from './auth-schema';

const secret = 'test-secret-test-secret-test-secret';

it('emails a magic link', async () => {
  const mailer = createRecordingMailer();
  const auth = createAuth({ db: await createTestDb(), mailer, baseUrl: 'http://localhost:3000', secret });
  await auth.api.signInMagicLink({ body: { email: 'mill@example.test', callbackURL: '/onboarding' }, headers: new Headers() });
  expect(mailer.sent[0]).toMatchObject({ to: 'mill@example.test', subject: 'Your xbul sign-in link' });
  expect(mailer.sent[0].text).toMatch(/http:\/\/localhost:3000\/api\/auth\/magic-link\/verify\?token=/);
});

it('rate-limits magic-link requests per client IP in the database, across auth instances', async () => {
  const db = await createTestDb();
  // On Workers every request builds its own auth, so the count must live in the database, not in memory.
  const newAuth = () => createAuth({ db, mailer: createRecordingMailer(), baseUrl: 'http://localhost:3000', secret, rateLimit: true });
  const signIn = (auth: ReturnType<typeof newAuth>) =>
    auth.handler(new Request('http://localhost:3000/api/auth/sign-in/magic-link', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.7' },
      body: JSON.stringify({ email: 'mill@example.test' }),
    }));

  const first = newAuth();
  const statuses: number[] = [];
  for (let i = 0; i < 5; i++) statuses.push((await signIn(first)).status);
  statuses.push((await signIn(newAuth())).status);

  expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  expect(await db.select().from(rateLimit)).toMatchObject([{ key: '203.0.113.7|/sign-in/magic-link', count: 5 }]);
});

it('sends Google and Microsoft sign-ins to the provider with a callback on this site, and refuses unconfigured ones', async () => {
  const oauth = { google: { clientId: 'g-id', clientSecret: 'g-secret' }, microsoft: { clientId: 'm-id', clientSecret: 'm-secret' } };
  const auth = createAuth({ db: await createTestDb(), mailer: createRecordingMailer(), baseUrl: 'https://xbul.test', secret, oauth });
  const start = (provider: string) =>
    auth.handler(new Request('https://xbul.test/api/auth/sign-in/social', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://xbul.test' },
      body: JSON.stringify({ provider, callbackURL: '/onboarding' }),
    }));

  const google = new URL((await (await start('google')).json()).url);
  expect(google.origin).toBe('https://accounts.google.com');
  expect(google.searchParams.get('client_id')).toBe('g-id');
  expect(google.searchParams.get('redirect_uri')).toBe('https://xbul.test/api/auth/callback/google');

  const microsoft = new URL((await (await start('microsoft')).json()).url);
  expect(microsoft.origin).toBe('https://login.microsoftonline.com');
  expect(microsoft.pathname).toMatch(/^\/common\//); // personal and work accounts alike
  expect(microsoft.searchParams.get('redirect_uri')).toBe('https://xbul.test/api/auth/callback/microsoft');

  const plain = createAuth({ db: await createTestDb(), mailer: createRecordingMailer(), baseUrl: 'https://xbul.test', secret });
  const refused = await plain.handler(new Request('https://xbul.test/api/auth/sign-in/social', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://xbul.test' },
    body: JSON.stringify({ provider: 'google', callbackURL: '/onboarding' }),
  }));
  expect(refused.ok).toBe(false);
});

it('trusts the address of a personal Microsoft account, but a work account only when Microsoft vouches for it', async () => {
  const oauth = { google: null, microsoft: { clientId: 'm-id', clientSecret: 'm-secret' } };
  const auth = createAuth({ db: await createTestDb(), mailer: createRecordingMailer(), baseUrl: 'https://xbul.test', secret, oauth });
  const microsoft = (await auth.$context).socialProviders.find((p) => p.id === 'microsoft')!;
  // getUserInfo only decodes the ID token (in the real flow it comes straight from Microsoft), so an unsigned one will do.
  const idToken = (claims: object) =>
    ['{"alg":"none"}', JSON.stringify({ oid: 'o-1', name: 'N', ...claims }), ''].map((p) => Buffer.from(p).toString('base64url')).join('.');
  const info = (claims: object) => microsoft.getUserInfo({ idToken: idToken(claims), accessToken: 'a' } as never);

  // Microsoft's directory for personal accounts: Microsoft checked the address before creating the account.
  expect((await info({ tid: '9188040d-6c67-4c5b-b112-36a304b66dad', email: 'a@hotmail.com' }))?.user).toMatchObject({ email: 'a@hotmail.com', emailVerified: true });
  // Any other directory can put any address on its users, so only Microsoft's own verified claims count.
  expect((await info({ tid: '11111111-2222-3333-4444-555555555555', email: 'owner@x.test' }))?.user.emailVerified).toBe(false);
  expect((await info({ tid: '11111111-2222-3333-4444-555555555555', email: 'w@x.test', verified_primary_email: ['w@x.test'] }))?.user.emailVerified).toBe(true);
  // No photo is fetched or stored: the user keeps no image from Microsoft.
  expect((await info({ tid: '9188040d-6c67-4c5b-b112-36a304b66dad', email: 'a@hotmail.com' }))?.user.image).toBeUndefined();
});
