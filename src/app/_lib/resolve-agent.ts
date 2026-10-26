import { getContainer } from '@/server/container';

const HANDLE = /^[a-z0-9-]{3,40}$/;

// `?via=` is attacker-controlled: only a well-formed handle reaches the lookup, and only an agent's profile counts.
export async function resolveAgent(via: string | undefined): Promise<{ handle: string; displayName: string } | null> {
  if (!via || !HANDLE.test(via)) return null;
  const profile = await (await getContainer()).profiles.findByHandle(via);
  return profile?.role === 'agent' ? { handle: via, displayName: profile.displayName } : null;
}
