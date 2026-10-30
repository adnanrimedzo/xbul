import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('an admin with no company lands on the review queue, not the company form', async ({ page }) => {
  await signIn(page, 'admin@example.test');
  await expect(page).toHaveURL(/\/admin\/claims$/);
  await page.goto('/onboarding');
  await expect(page).toHaveURL(/\/admin\/claims$/);
  await expect(page.getByLabel(/company name/i)).toHaveCount(0);
});
test('non-admins are sent home', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/admin/claims');
  await expect(page).toHaveURL('http://localhost:3100/');
});
test('an admin sees the search it just ran counted', async ({ page }) => {
  await signIn(page, 'admin@example.test');
  await page.goto('/admin/stats');
  await expect(page.getByRole('heading', { name: 'Visitor-days' })).toBeVisible();
  await expect(page.getByText('Target: 10–20 customers. One address counts once a day, so this overstates customers.')).toBeVisible();
  const before = Number(await page.getByTestId('stat-searches').textContent());
  await page.goto('/');
  await page.getByPlaceholder(/paste a product link/i).fill('https://example.com/counted');
  await page.getByRole('button', { name: /^find suppliers$/i }).click();
  await expect(page.getByText(/no supplier has tagged/i)).toBeVisible();
  await page.goto('/admin/stats');
  await expect(page.getByTestId('stat-searches')).toHaveText(String(before + 1));
});
test('non-admins can’t see stats', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/admin/stats');
  await expect(page).toHaveURL('http://localhost:3100/');
});
test('the request inbox is gone', async ({ page }) => {
  expect((await page.goto('/requests'))?.status()).toBe(404);
});
