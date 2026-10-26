import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';
import type { Db } from '@/shared/db/client';
import type { Mailer } from '@/shared/mail/mailer';
import { account, rateLimit, session, user, verification } from './auth-schema';

// `rateLimit` forces the limiter on or off; left out, Better Auth enables it in production only.
export function createAuth(deps: { db: Db; mailer: Mailer; baseUrl: string; secret: string; rateLimit?: boolean }) {
  return betterAuth({
    baseURL: deps.baseUrl,
    secret: deps.secret,
    database: drizzleAdapter(deps.db, { provider: 'pg', schema: { user, session, account, verification, rateLimit } }),
    emailAndPassword: { enabled: false },
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
            subject: 'Your xmanufacture sign-in link',
            text: `Sign in to xmanufacture:\n\n${url}\n\nThis link expires in 10 minutes.`,
          }),
      }),
      nextCookies(),
    ],
  });
}

export type Auth = ReturnType<typeof createAuth>;
