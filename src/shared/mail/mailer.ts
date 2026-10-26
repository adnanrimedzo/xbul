import { appendFile, mkdir } from 'node:fs/promises';
import { dirname } from 'node:path';
import { Resend } from 'resend';

export type MailMessage = { to: string; subject: string; text: string; replyTo?: string };

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

export function createResendMailer(apiKey: string, from: string): Mailer {
  const resend = new Resend(apiKey);
  return {
    async send({ to, subject, text, replyTo }) {
      const { error } = await resend.emails.send({ from, to, subject, text, replyTo });
      if (error) throw new Error(`resend: ${error.message}`);
    },
  };
}
