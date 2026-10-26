import { expect, test } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';
import { signIn } from './helpers';

test('mill sees credited requests and marks one answered', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/requests');
  const badge = page.getByTestId('new-requests-count');
  const before = Number(await badge.textContent());
  const row = page.getByTestId('inquiry-row').filter({ hasText: 'Seed Buyer Co' });
  await expect(row).toContainText('Via agent @lauramartin-demo');
  await expect(row).toContainText('GUESS — Cropped Denim Blazer');
  await row.getByRole('button', { name: /mark answered/i }).click();
  await expect(row).toContainText(/answered/i);
  if (before > 1) await expect(badge).toHaveText(String(before - 1));
  else await expect(badge).toHaveCount(0);
});
test('admin verifies a declared original', async ({ page }) => {
  await signIn(page, 'admin@example.test');
  await page.goto('/admin/claims');
  await page.getByTestId('declared-original').filter({ hasText: 'LIU-JO' }).getByRole('button', { name: /verify/i }).click();
  await page.goto(`/p/${DEMO.products.liujo}`);
  await expect(page.getByTestId('original-claim')).toContainText('Verified');
});
test('non-admins are sent home', async ({ page }) => {
  await signIn(page, 'agent@example.test');
  await page.goto('/admin/claims');
  await expect(page).toHaveURL('http://localhost:3100/');
});
