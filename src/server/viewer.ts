import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Profile } from '@/modules/identity';
import type { Company } from '@/modules/supplier';
import { getContainer } from './container';

export type Viewer = { userId: string; email: string; isAdmin: boolean; profile: Profile | null; company: Company | null };

// Cached per request: the layout and the page both ask.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const requestHeaders = await headers(); // first, so prerendering bails out before config is read
  const { auth, profiles, companies, config } = await getContainer();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { id: userId, email } = session.user;
  const [profile, company] = await Promise.all([profiles.findByUserId(userId), companies.findByOwner(userId)]);
  return { userId, email, isAdmin: config.adminEmails.includes(email.toLowerCase()), profile, company };
});

export async function requireViewer(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer) redirect('/sign-in');
  return viewer;
}

export async function requireMill(): Promise<Viewer & { company: Company }> {
  const viewer = await requireViewer();
  if (!viewer.company) redirect('/onboarding');
  return { ...viewer, company: viewer.company };
}

export async function requireAdmin(): Promise<Viewer> {
  const viewer = await getViewer();
  if (!viewer?.isAdmin) redirect('/');
  return viewer;
}
