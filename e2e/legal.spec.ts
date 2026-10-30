import { expect, test } from '@playwright/test';

test('a signed-out visitor can reach privacy and terms from the footer', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('contentinfo').getByRole('link', { name: 'Privacy' }).click();
  await expect(page.getByRole('heading', { name: 'Privacy' })).toBeVisible();
  await expect(page.getByText('deleted', { exact: false }).first()).toBeVisible();
  await page.getByRole('contentinfo').getByRole('link', { name: 'Terms' }).click();
  await expect(page.getByRole('heading', { name: 'Terms' })).toBeVisible();
});
