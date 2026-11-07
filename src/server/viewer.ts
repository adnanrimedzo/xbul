import { cookies, headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import type { Company } from '@/modules/supplier';
import { getContainer } from './container';
import { availableModes, MODE_COOKIE, type Mode, resolveMode } from './modes';

export type Viewer = {
  userId: string;
  email: string;
  isAdmin: boolean;
  company: Company | null;
  modes: Mode[];
  mode: Mode;
  modeChosen: boolean;
};

// Cached per request: the layout and the page both ask.
export const getViewer = cache(async (): Promise<Viewer | null> => {
  const requestHeaders = await headers(); // first, so prerendering bails out before config is read
  const { auth, companies, config } = await getContainer();
  const session = await auth.api.getSession({ headers: requestHeaders });
  if (!session) return null;
  const { id: userId, email } = session.user;
  const company = await companies.findByOwner(userId);
  const isAdmin = config.adminEmails.includes(email.toLowerCase());
  const { mode, chosen } = resolveMode({ isAdmin, hasCompany: !!company }, (await cookies()).get(MODE_COOKIE)?.value);
  return { userId, email, isAdmin, company, modes: availableModes({ isAdmin }), mode, modeChosen: chosen };
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
