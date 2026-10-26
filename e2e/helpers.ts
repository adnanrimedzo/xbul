import { readFile } from 'node:fs/promises';
import type { Page } from '@playwright/test';

// The console mailer appends one JSON line per message here (MAIL_LOG_FILE in playwright.config.ts).
const MAIL_LOG = new URL('../.outbox/e2e-mail.log', import.meta.url);

type Mail = { to: string; subject: string; text: string };

async function mailsTo(email: string): Promise<Mail[]> {
  const log = await readFile(MAIL_LOG, 'utf8').catch(() => '');
  return log
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as Mail)
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

  const deadline = Date.now() + 5000;
  let mails = await mailsTo(email);
  while (mails.length <= before) {
    if (Date.now() > deadline) throw new Error(`no sign-in mail to ${email} within 5 s`);
    await new Promise((r) => setTimeout(r, 100));
    mails = await mailsTo(email);
  }
  const link = /https?:\/\/\S+/.exec(mails.at(-1)!.text)?.[0];
  if (!link) throw new Error(`no link in the mail to ${email}`);
  await page.goto(link);
}
