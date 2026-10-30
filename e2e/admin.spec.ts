import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('non-admins are sent home', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/admin/claims');
  await expect(page).toHaveURL('http://localhost:3100/');
});
test('the request inbox is gone', async ({ page }) => {
  expect((await page.goto('/requests'))?.status()).toBe(404);
});
