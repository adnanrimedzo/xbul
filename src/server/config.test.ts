import { describe, expect, it } from 'vitest';
import { readConfig } from './config';

const secret = 's'.repeat(32);

describe('readConfig', () => {
  it('parses env with safe defaults', () => {
    expect(readConfig({ DATABASE_URL: './.data/dev', BETTER_AUTH_SECRET: secret, PUBLIC_BASE_URL: 'http://localhost:3000', ADMIN_EMAILS: ' A@x.test, b@x.test ' }))
      .toMatchObject({ adminEmails: ['a@x.test', 'b@x.test'], resendApiKey: null, allowPrivateHosts: false, baseUrl: 'http://localhost:3000' });
    expect(() => readConfig({ BETTER_AUTH_SECRET: 'short', PUBLIC_BASE_URL: 'http://x' })).toThrow(/BETTER_AUTH_SECRET/);
  });

  it('treats blank values as unset and reads the optional switches', () => {
    expect(readConfig({ DATABASE_URL: '  ', BETTER_AUTH_SECRET: secret, PUBLIC_BASE_URL: 'http://x', ADMIN_EMAILS: ',, ,', RESEND_API_KEY: '', MAIL_FROM: '' }))
      .toEqual({ databaseUrl: null, baseUrl: 'http://x', authSecret: secret, adminEmails: [], resendApiKey: null, mailFrom: 'xmanufacture <hello@xmanufacture.com>', mailLogFile: null, allowPrivateHosts: false });
    expect(readConfig({ BETTER_AUTH_SECRET: secret, PUBLIC_BASE_URL: 'http://x', RESEND_API_KEY: 're_1', MAIL_LOG_FILE: '.outbox/mail.log', FETCH_ALLOW_PRIVATE_HOSTS: '1' }))
      .toMatchObject({ resendApiKey: 're_1', mailLogFile: '.outbox/mail.log', allowPrivateHosts: true });
  });

  it('requires a base url', () => {
    expect(() => readConfig({ BETTER_AUTH_SECRET: secret })).toThrow(/PUBLIC_BASE_URL/);
  });
});
