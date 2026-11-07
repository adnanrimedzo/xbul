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
  oauth: OAuthConfig; // a provider's sign-in button shows only when its keys are set
};

export type OAuthKeys = { clientId: string; clientSecret: string };
export type OAuthConfig = { google: OAuthKeys | null; microsoft: OAuthKeys | null };

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

  // Half a pair turns the provider off rather than failing the request: the two secrets are set or removed one after
  // the other, and every page would break in between. The error lands in Workers Logs so a typo doesn't go unseen.
  const oauthKeys = (prefix: string, label: string): OAuthKeys | null => {
    const clientId = value(`${prefix}_CLIENT_ID`);
    const clientSecret = value(`${prefix}_CLIENT_SECRET`);
    if (clientId && clientSecret) return { clientId, clientSecret };
    if (clientId || clientSecret) {
      console.error(`[config] ${prefix}_${clientId ? 'CLIENT_SECRET' : 'CLIENT_ID'} is missing, so ${label} sign-in is off`);
    }
    return null;
  };

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
    oauth: { google: oauthKeys('GOOGLE', 'Google'), microsoft: oauthKeys('MICROSOFT', 'Microsoft') },
  };
}

// An explicit DATABASE_URL wins, then the Workers Hyperdrive binding, then the local PGlite folder.
export function resolveDatabaseUrl(config: AppConfig, cf: { env: { HYPERDRIVE?: { connectionString: string } } } | null): string {
  return config.databaseUrl ?? cf?.env.HYPERDRIVE?.connectionString ?? './.data/dev';
}
