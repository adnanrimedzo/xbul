import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Resend } from 'resend';

export type MailMessage = { to: string; subject: string; text: string };

export interface Mailer {
  send(m: MailMessage): Promise<void>;
}

export function createConsoleMailer(logFile?: string): Mailer {
  return {
    async send(m) {
      console.info('[mail]', m);
      if (!logFile) return;
      await mkdir(dirname(logFile), { recursive: true });
      await appendFile(logFile, JSON.stringify({ ...m, at: new Date().toISOString() }) + '\n');
    },
  };
}

// `from` is on the sending subdomain, which receives no mail, so replies go to `replyTo`.
export function createResendMailer(apiKey: string, from: string, replyTo: string): Mailer {
  const resend = new Resend(apiKey);
  return {
    async send({ to, subject, text }) {
      const { error } = await resend.emails.send({ from, replyTo, to, subject, text });
      if (error) throw new Error(`resend: ${error.message}`);
    },
  };
}
