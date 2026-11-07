export type AppConfig = {
  databaseUrl: string | null;
  baseUrl: string;
  authSecret: string;
  adminEmails: string[];
  resendApiKey: string | null;
  mailFrom: string;
  mailLogFile: string | null;
  allowPrivateHosts: boolean;
  evidenceDir: string; // where the local evidence store keeps files; Workers use the EVIDENCE bucket instead
};

export function readConfig(env: Record<string, string | undefined> = process.env): AppConfig {
  const value = (name: string) => env[name]?.trim() || null;

  const authSecret = value('BETTER_AUTH_SECRET') ?? '';
  if (authSecret.length < 32) throw new Error('BETTER_AUTH_SECRET must be at least 32 characters');
  const baseUrl = value('PUBLIC_BASE_URL')?.replace(/\/+$/, '');
  if (!baseUrl) throw new Error('PUBLIC_BASE_URL is required');
  if (!/^https?:$/.test(URL.parse(baseUrl)?.protocol ?? '')) {
    throw new Error(`PUBLIC_BASE_URL must be an http(s) URL such as https://xbul.io, got "${baseUrl}"`);
  }
  const resendApiKey = value('RESEND_API_KEY');
  // The console mailer prints magic links, which are bearer tokens, so production logs must never get them.
  if (env.NODE_ENV === 'production' && !resendApiKey && env.ALLOW_CONSOLE_MAILER !== '1') {
    throw new Error('RESEND_API_KEY is required in production (set ALLOW_CONSOLE_MAILER=1 to log mail instead)');
  }

  return {
    databaseUrl: value('DATABASE_URL'),
    baseUrl,
    authSecret,
    adminEmails: (env.ADMIN_EMAILS ?? '').split(',').map((e) => e.trim().toLowerCase()).filter(Boolean),
    resendApiKey,
    mailFrom: value('MAIL_FROM') ?? 'xbul <hello@mail.xbul.io>',
    mailLogFile: value('MAIL_LOG_FILE'),
    allowPrivateHosts: env.FETCH_ALLOW_PRIVATE_HOSTS === '1',
    evidenceDir: value('EVIDENCE_DIR') ?? './.data/evidence',
  };
}

// An explicit DATABASE_URL wins, then the Workers Hyperdrive binding, then the local PGlite folder.
export function resolveDatabaseUrl(config: AppConfig, cf: { env: { HYPERDRIVE?: { connectionString: string } } } | null): string {
  return config.databaseUrl ?? cf?.env.HYPERDRIVE?.connectionString ?? './.data/dev';
}
