import { expect, test } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';
import { signIn } from './helpers';

test('admin verifies a declared original', async ({ page }) => {
  await signIn(page, 'admin@example.test');
  await page.goto('/admin/claims');
  const row = page.getByTestId('declared-original').filter({ hasText: 'LIU-JO' });
  await row.getByRole('button', { name: /verify/i }).click();
  await expect(row).toHaveCount(0); // the action has finished and the page re-rendered
  await page.goto(`/p/${DEMO.products.liujo}`);
  await expect(page.getByTestId('original-claim')).toContainText('Verified');
});
test('non-admins are sent home', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/admin/claims');
  await expect(page).toHaveURL('http://localhost:3100/');
});
test('the request inbox is gone', async ({ page }) => {
  expect((await page.goto('/requests'))?.status()).toBe(404);
});
