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
  await createConsoleMailer(file).send({ to: 'a@b.test', subject: 'Hi', text: 'Body', replyTo: 'c@d.test' });
  expect(JSON.parse(readFileSync(file, 'utf8').trim())).toMatchObject({ to: 'a@b.test', subject: 'Hi', text: 'Body', replyTo: 'c@d.test' });
  expect(info).toHaveBeenCalledOnce();
  info.mockRestore();
});

it('resend mailer sends from the configured address and passes Reply-To through', async () => {
  await createResendMailer('re_test', 'xm <hello@x.test>').send({ to: 'a@b.test', subject: 'Hi', text: 'Body', replyTo: 'c@d.test' });
  expect(resendSent).toEqual([{ from: 'xm <hello@x.test>', to: 'a@b.test', subject: 'Hi', text: 'Body', replyTo: 'c@d.test' }]);
});

it('recording mailer keeps sent messages', async () => {
  const m = createRecordingMailer();
  await m.send({ to: 'x@y.test', subject: 's', text: 't' });
  expect(m.sent).toHaveLength(1);
});
