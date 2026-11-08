import type { CompanyStatus } from '@/modules/supplier';

// A mode is display-only: it picks which links and home the viewer sees. It never authorizes anything;
// requireAdmin and requireMill check isAdmin and company.
export type Mode = 'search' | 'manufacturer' | 'admin';
export const MODE_COOKIE = 'xb_mode';

export function availableModes(v: { isAdmin: boolean }): Mode[] {
  return v.isAdmin ? ['search', 'manufacturer', 'admin'] : ['search', 'manufacturer'];
}

export function resolveMode(
  v: { isAdmin: boolean; hasCompany: boolean },
  cookie: string | undefined,
): { mode: Mode; chosen: boolean } {
  const held = availableModes(v).find((m) => m === cookie); // a forged mode the viewer doesn't hold is ignored
  if (held) return { mode: held, chosen: true };
  return { mode: v.hasCompany ? 'manufacturer' : v.isAdmin ? 'admin' : 'search', chosen: false };
}

export function modeHome(mode: Mode, companySlug: string | null): string {
  if (mode === 'search') return '/';
  if (mode === 'admin') return '/admin/manufacturers';
  return companySlug ? `/m/${companySlug}` : '/onboarding';
}

export function onboardingRedirect(v: {
  company: { slug: string; status: CompanyStatus } | null;
  mode: Mode;
  modeChosen: boolean;
  isAdmin: boolean;
}): string | null {
  if (v.company && v.mode !== 'manufacturer') return modeHome(v.mode, v.company.slug);
  if (v.company) return v.company.status === 'approved' ? '/add' : `/m/${v.company.slug}/registration`; // not public until approved
  if (v.modeChosen && v.mode !== 'manufacturer') return modeHome(v.mode, null);
  if (!v.modeChosen && v.isAdmin) return modeHome('admin', null);
  return null;
}
