import { expect, it, vi } from 'vitest';
import type { Company } from '@/modules/supplier';
import OnboardingPage from './page';

const viewer = vi.hoisted(() => ({ current: {} as { email: string; isAdmin: boolean; company: unknown } }));
vi.mock('@/server/viewer', () => ({ requireViewer: async () => viewer.current }));

const company = { id: 'c1', slug: 'indigo-mill' } as Company;
const visit = async (v: { isAdmin: boolean; company: Company | null }) => {
  viewer.current = { email: 'someone@example.test', ...v };
  return OnboardingPage().then(
    () => null,
    (e: { digest?: string }) => e.digest ?? null, // redirect() works by throwing
  );
};

it('sends a supplier that has a company to Add', async () => {
  expect(await visit({ isAdmin: false, company })).toContain('/add');
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
