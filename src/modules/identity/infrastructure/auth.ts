import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';
import type { Db } from '@/shared/db/client';
import type { Mailer } from '@/shared/mail/mailer';
import { account, rateLimit, session, user, verification } from './auth-schema';

type OAuthKeys = { clientId: string; clientSecret: string };

// `rateLimit` forces the limiter on or off; left out, Better Auth enables it in production only.
// `oauth` turns on each sign-in provider whose keys are given.
export function createAuth(deps: {
  db: Db;
  mailer: Mailer;
  baseUrl: string;
  secret: string;
  rateLimit?: boolean;
  oauth?: { google: OAuthKeys | null; microsoft: OAuthKeys | null };
}) {
  const { google, microsoft } = deps.oauth ?? { google: null, microsoft: null };
  return betterAuth({
    baseURL: deps.baseUrl,
    secret: deps.secret,
    database: drizzleAdapter(deps.db, { provider: 'pg', schema: { user, session, account, verification, rateLimit } }),
    emailAndPassword: { enabled: false },
    // A provider signs in only an address it has verified. That also gates linking: Better Auth joins a provider login
    // to an existing account with the same email only when the provider vouches for it. Microsoft matters most: any
    // directory's admin can put any address on its own users. `common` takes personal and work accounts alike.
    account: { encryptOAuthTokens: true }, // provider tokens are never used by the app; at rest they stay unreadable
    socialProviders: {
      ...(google && { google: { ...google, requireEmailVerification: true, prompt: 'select_account' as const } }),
      ...(microsoft && { microsoft: { ...microsoft, tenantId: 'common', requireEmailVerification: true, prompt: 'select_account' as const } }),
    },
    // Counts live in Postgres: on Workers each request builds its own auth, so an in-memory limiter would never trip.
    rateLimit: { enabled: deps.rateLimit, storage: 'database' },
    // Cloudflare sets cf-connecting-ip to the real client; x-forwarded-for covers other proxies.
    advanced: { ipAddress: { ipAddressHeaders: ['cf-connecting-ip', 'x-forwarded-for'] } },
    plugins: [
      magicLink({
        expiresIn: 600,
        storeToken: 'hashed', // the emailed token stays plain; only its hash is stored
        sendMagicLink: ({ email, url }) =>
          deps.mailer.send({
            to: email,
            subject: 'Your xbul sign-in link',
            text: `Sign in to xbul:\n\n${url}\n\nThis link expires in 10 minutes.`,
          }),
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
