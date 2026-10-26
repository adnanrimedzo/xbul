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
  expect(mailer.sent[0]).toMatchObject({ to: 'mill@example.test', subject: 'Your xmanufacture sign-in link' });
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
