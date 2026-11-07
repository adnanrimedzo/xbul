import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { createConsoleMailer, createResendMailer } from './mailer';
import { createRecordingMailer } from './testing';

const resendSent = vi.hoisted(() => [] as unknown[]);
vi.mock('resend', () => ({
  Resend: class {
    emails = { send: async (body: unknown) => (resendSent.push(body), { error: null }) };
  },
}));

it('console mailer appends a JSON line per message', async () => {
  const info = vi.spyOn(console, 'info').mockImplementation(() => {});
  const file = join(mkdtempSync(join(tmpdir(), 'xm-')), 'out', 'mail.log');
  await createConsoleMailer(file).send({ to: 'a@b.test', subject: 'Hi', text: 'Body' });
  expect(JSON.parse(readFileSync(file, 'utf8').trim())).toMatchObject({ to: 'a@b.test', subject: 'Hi', text: 'Body' });
  expect(info).toHaveBeenCalledOnce();
  info.mockRestore();
});

it('resend mailer sends from the configured address, with replies going to the contact address', async () => {
  await createResendMailer('re_test', 'xm <hello@mail.x.test>', 'hello@x.test').send({ to: 'a@b.test', subject: 'Hi', text: 'Body' });
  expect(resendSent).toEqual([{ from: 'xm <hello@mail.x.test>', replyTo: 'hello@x.test', to: 'a@b.test', subject: 'Hi', text: 'Body' }]);
});

it('recording mailer keeps sent messages', async () => {
  const m = createRecordingMailer();
  await m.send({ to: 'x@y.test', subject: 's', text: 't' });
  expect(m.sent).toHaveLength(1);
});
