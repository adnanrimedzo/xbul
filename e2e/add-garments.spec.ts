import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('mill pastes links, fixes a blocked one by hand, and publishes', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/add');
  await page.getByLabel(/brand links/i).fill('http://localhost:4010/washed-denim-jacket.html\nhttp://localhost:4010/blocked.html\nnot a url');
  await page.getByRole('button', { name: /fetch/i }).click();
  const rows = page.getByTestId('preview-row');
  await expect(rows.nth(0)).toContainText('Washed Denim Jacket');
  await expect(rows.nth(0).getByRole('link', { name: /photo: localhost/i })).toHaveAttribute('href', 'http://localhost:4010/washed-denim-jacket.html');
  await expect(rows.nth(1)).toContainText(/couldn.t read this page/i);
  await expect(rows.nth(2)).toContainText(/not a valid link/i);
  await rows.nth(1).getByLabel(/brand/i).fill('ZARA');
  await rows.nth(1).getByLabel(/name/i).fill('Black Denim Overshirt');
  await rows.nth(1).getByRole('button', { name: /save/i }).click();
  await rows.nth(0).getByLabel(/article code/i).fill('60219/1');
  await rows.nth(1).getByLabel(/article code/i).fill('60777/2');
  await rows.nth(1).getByRole('radio', { name: /equivalent/i }).check();
  await page.getByRole('button', { name: /publish 2 garments/i }).click();
  await expect(page).toHaveURL(/\/m\/indigo-mill$/);
  await expect(page.getByText('Black Denim Overshirt')).toBeVisible();
});

test('a page with only a title is offered for manual entry, pre-filled', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/add');
  await page.getByLabel(/brand links/i).fill('http://localhost:4010/title-only.html');
  await page.getByRole('button', { name: /fetch/i }).click();
  const row = page.getByTestId('preview-row');
  await expect(row).toContainText(/only has a title/i);
  await expect(row.getByLabel(/brand/i)).toHaveValue('LOCALHOST');
  await expect(row.getByLabel(/name/i)).toHaveValue('Selvedge Jeans');
  await expect(page.getByRole('button', { name: /publish 0 garments/i })).toBeDisabled();
});

test('the owner removes a garment from its mill page; visitors get no Remove', async ({ page }) => {
  await page.goto('/m/indigo-mill');
  await expect(page.getByRole('button', { name: /remove/i })).toHaveCount(0);
  await signIn(page, 'mill@example.test');
  await page.goto('/m/indigo-mill');
  const garment = page.getByTestId('mill-garment').filter({ hasText: 'Black Denim Overshirt' }); // published by the first test
  await garment.getByRole('button', { name: /^remove$/i }).click();
  await garment.getByRole('button', { name: /confirm remove/i }).click();
  await expect(page.getByText('Black Denim Overshirt')).toHaveCount(0);
  await expect(page.getByText('Washed Denim Jacket')).toBeVisible();
});
