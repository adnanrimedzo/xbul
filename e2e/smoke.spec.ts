import { expect, test } from '@playwright/test';

test('chrome renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('xmanufacture', { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/ISTANBUL, TR/i)).toBeVisible();
});
