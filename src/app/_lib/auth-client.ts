import { createAuthClient } from 'better-auth/client';
import { magicLinkClient } from 'better-auth/client/plugins';

// Browser-side Better Auth client: its requests go through /api/auth, where the rate limiter and origin checks run
// (calling auth.api from a server action would skip them). The base URL defaults to the current origin.
export const authClient = createAuthClient({ plugins: [magicLinkClient()] });
