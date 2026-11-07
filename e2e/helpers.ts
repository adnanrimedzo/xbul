import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

// The console mailer appends one JSON line per message here (MAIL_LOG_FILE in playwright.config.ts).
const MAIL_LOG = new URL('../.outbox/e2e-mail.log', import.meta.url);

type Mail = { to: string; subject: string; text: string };

async function mailsTo(email: string): Promise<Mail[]> {
  const log = await readFile(MAIL_LOG, 'utf8').catch(() => '');
  return log
    .split('\n')
    .flatMap((line) => {
      try {
        return [JSON.parse(line) as Mail];
      } catch {
        return []; // blank, or a last line still being written: the next poll picks it up
      }
    })
    .filter((m) => m.to.toLowerCase() === email.toLowerCase());
}

export async function lastMailTo(email: string): Promise<{ subject: string; text: string }> {
  const mail = (await mailsTo(email)).at(-1);
  if (!mail) throw new Error(`no mail to ${email}`);
  return { subject: mail.subject, text: mail.text };
}

export async function signIn(page: Page, email: string): Promise<void> {
  const before = (await mailsTo(email)).length;
  await page.goto('/sign-in');
  await page.getByLabel(/email/i).fill(email);
  await page.getByLabel(/email/i).press('Enter');

  // The suite's first sign-in compiles the sign-in page and auth route in `next dev`, which takes well over 5 s on a
  // 2-core CI runner; later ones are instant. 20 s still fails inside the 30 s test timeout with this clearer message.
  const deadline = Date.now() + 20_000;
  let mails = await mailsTo(email);
  while (mails.length <= before) {
    if (Date.now() > deadline) throw new Error(`no sign-in mail to ${email} within 20 s`);
    await new Promise((r) => setTimeout(r, 100));
    mails = await mailsTo(email);
  }
  const link = /https?:\/\/\S+/.exec(mails.at(-1)!.text)?.[0];
  if (!link) throw new Error(`no link in the mail to ${email}`);
  await page.goto(link);
}
