import { expect, it, vi } from 'vitest';
import type { Company } from '@/modules/supplier';
import OnboardingPage from './page';

const viewer = vi.hoisted(() => ({ current: {} as object }));
vi.mock('@/server/viewer', () => ({ requireViewer: async () => viewer.current }));

const company = { id: 'c1', slug: 'indigo-mill', status: 'approved' } as Company;
const visit = async (v: { isAdmin: boolean; company: Company | null }) => {
  // mode and modeChosen are what resolveMode gives a viewer who has not picked one
  viewer.current = { email: 'someone@example.test', modeChosen: false, mode: v.company ? 'manufacturer' : v.isAdmin ? 'admin' : 'search', ...v };
  return OnboardingPage().then(
    () => null,
    (e: { digest?: string }) => e.digest ?? null, // redirect() works by throwing
  );
};

it('sends a supplier that has an approved company to Add, and one still registering to its registration page', async () => {
  expect(await visit({ isAdmin: false, company })).toContain('/add');
  expect(await visit({ isAdmin: false, company: { ...company, status: 'draft' } })).toContain('/m/indigo-mill/registration');
});

it('sends an admin with no company to the review queue, so filling the form in cannot create a public supplier', async () => {
  expect(await visit({ isAdmin: true, company: null })).toContain('/admin/claims');
});

it('still sends an admin that has a company to Add', async () => {
  expect(await visit({ isAdmin: true, company })).toContain('/add');
});

it('shows the form to anyone else without a company', async () => {
  expect(await visit({ isAdmin: false, company: null })).toBeNull();
});
