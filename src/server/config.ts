export type AppConfig = {
  databaseUrl: string | null;
  baseUrl: string;
  authSecret: string;
  adminEmails: string[];
  resendApiKey: string | null;
  mailFrom: string;
  mailLogFile: string | null;
  allowPrivateHosts: boolean;
};

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const value = (name: string) => env[name]?.trim() || null;

  const authSecret = value('BETTER_AUTH_SECRET') ?? '';
  if (authSecret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');
  const baseUrl = value('PUBLIC_BASE_URL')?.replace(/\/+$/, '');
  if (!baseUrl) throw new Error('PUBLIC_BASE_URL is required');

  return {
    databaseUrl: value('DATABASE_URL'),
    baseUrl,
    authSecret,
    adminEmails: (env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    resendApiKey: value('RESEND_API_KEY'),
    mailFrom: value('MAIL_FROM') ?? 'xmanufacture <hello@xmanufacture.com>',
    mailLogFile: value('MAIL_LOG_FILE'),
    allowPrivateHosts: env.FETCH_ALLOW_PRIVATE_HOSTS === '1',
  };
}
