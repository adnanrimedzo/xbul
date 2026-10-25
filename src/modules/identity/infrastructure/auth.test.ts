import { expect, it } from 'vitest';
import { createTestDb } from '@/shared/db/testing';
import { createRecordingMailer } from '@/shared/mail/testing';
import { createAuth } from './auth';

it('emails a magic link', async () => {
  const mailer = createRecordingMailer();
  const auth = createAuth({ db: await createTestDb(), mailer, baseUrl: 'http://localhost:3000', secret: 'test-secret-test-secret-test-secret' });
  await auth.api.signInMagicLink({ body: { email: 'mill@example.test', callbackURL: '/onboarding' }, headers: new Headers() });
  expect(mailer.sent[0]).toMatchObject({ to: 'mill@example.test', subject: 'Your xmanufacture sign-in link' });
  expect(mailer.sent[0].text).toMatch(/http:\/\/localhost:3000\/api\/auth\/magic-link\/verify\?token=/);
});
