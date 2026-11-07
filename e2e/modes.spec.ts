import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('a manufacturer switches to search and back', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  const modes = page.getByRole('group', { name: /mode/i });
  await expect(modes.getByRole('button')).toHaveText(['Search', 'Manufacturer']);
  await modes.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole('link', { name: 'Add products' })).toHaveCount(0);
  await modes.getByRole('button', { name: 'Manufacturer' }).click();
  await expect(page).toHaveURL(/\/m\/indigo-mill$/);
});

test('a forged admin cookie grants nothing', async ({ page, context, baseURL }) => {
  await signIn(page, 'mill@example.test');
  await context.addCookies([{ name: 'xb_mode', value: 'admin', url: baseURL! }]);
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Claims' })).toHaveCount(0);
  await page.goto('/admin/claims');
  await expect(page).toHaveURL(/\/$/);
});

test('an admin can also register a company', async ({ page }) => {
  await signIn(page, 'admin-maker@example.test');
  await expect(page).toHaveURL(/\/admin\/claims$/);
  await page.getByRole('group', { name: /mode/i }).getByRole('button', { name: 'Manufacturer' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);
  await expect(page.getByLabel(/company name/i)).toBeVisible();
});

test('a searcher picks search once and lands there next time', async ({ page }) => {
  await signIn(page, 'just-looking@example.test');
  await page.getByRole('button', { name: /search manufacturers/i }).click();
  await expect(page).toHaveURL(/\/$/);
  await signIn(page, 'just-looking@example.test');
  await expect(page).toHaveURL(/\/$/);
});
