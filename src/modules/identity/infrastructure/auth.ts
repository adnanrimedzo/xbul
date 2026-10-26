import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { nextCookies } from 'better-auth/next-js';
import { magicLink } from 'better-auth/plugins';
import type { Db } from '@/shared/db/client';
import type { Mailer } from '@/shared/mail/mailer';
import { account, session, user, verification } from './auth-schema';

export function createAuth(deps: { db: Db; mailer: Mailer; baseUrl: string; secret: string }) {
  return betterAuth({
    baseURL: deps.baseUrl,
    secret: deps.secret,
    database: drizzleAdapter(deps.db, { provider: 'pg', schema: { user, session, account, verification } }),
    emailAndPassword: { enabled: false },
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
