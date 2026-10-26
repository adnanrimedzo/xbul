import { describe, expect, it } from 'vitest';
import { readConfig, resolveDatabaseUrl } from './config';

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

  it('rejects a base url that is not an http(s) URL', () => {
    for (const url of ['xmanufacture.com', 'localhost:3000', 'ftp://xmanufacture.com']) {
      expect(() => readConfig({ BETTER_AUTH_SECRET: secret, PUBLIC_BASE_URL: url }), url).toThrow(/PUBLIC_BASE_URL must be an http\(s\) URL/);
    }
  });

  it('refuses the console mailer in production unless it is allowed, so magic links never land in logs', () => {
    const prod = { BETTER_AUTH_SECRET: secret, PUBLIC_BASE_URL: 'https://xmanufacture.com', NODE_ENV: 'production' };
    expect(() => readConfig(prod)).toThrow(/RESEND_API_KEY/);
    expect(readConfig({ ...prod, RESEND_API_KEY: 're_1' }).resendApiKey).toBe('re_1');
    expect(readConfig({ ...prod, ALLOW_CONSOLE_MAILER: '1' }).resendApiKey).toBeNull();
  });
});

describe('resolveDatabaseUrl', () => {
  it('prefers DATABASE_URL, then Hyperdrive, then local PGlite', () => {
    const base = readConfig({ BETTER_AUTH_SECRET: 's'.repeat(32), PUBLIC_BASE_URL: 'https://xmanufacture.com' });
    expect(resolveDatabaseUrl({ ...base, databaseUrl: 'postgres://a' }, null)).toBe('postgres://a');
    expect(resolveDatabaseUrl(base, { env: { HYPERDRIVE: { connectionString: 'postgres://hd' } } })).toBe('postgres://hd');
    expect(resolveDatabaseUrl(base, null)).toBe('./.data/dev');
  });
});
