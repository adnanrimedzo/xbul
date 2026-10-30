import { expect, test } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';
import { signIn } from './helpers';

test('a supplier pastes links, fixes a blocked one by hand, and publishes', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/add');
  const nav = page.getByRole('navigation', { name: 'Main' });
  await expect(nav.getByRole('link', { name: 'My company' })).toHaveAttribute('href', '/m/indigo-mill');
  await expect(nav.getByRole('link', { name: 'Add products' })).toHaveAttribute('href', '/add');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Add products');
  await expect(page.getByText(/paste the brand links for products you.ve made or can make/i)).toBeVisible();
  await expect(page.getByText('Fetched products appear here.')).toBeVisible();
  await expect(page.getByText('"We made this" shows without the Verified badge until evidence is reviewed.')).toBeVisible();
  await page.getByLabel(/brand links/i).fill('http://localhost:4010/washed-denim-jacket.html\nhttp://localhost:4010/blocked.html\nnot a url');
  await page.getByRole('button', { name: /fetch/i }).click();
  const rows = page.getByTestId('preview-row');
  await expect(rows.nth(0)).toContainText('Washed Denim Jacket');
  await expect(rows.nth(0).getByRole('radio', { name: /we made this/i })).toBeChecked();
  await expect(page.getByText('1 product found')).toBeVisible();
  await expect(rows.nth(0).getByRole('link', { name: /photo: localhost/i })).toHaveAttribute('href', 'http://localhost:4010/washed-denim-jacket.html');
  await expect(rows.nth(1)).toContainText(/couldn.t read this page/i);
  await expect(rows.nth(2)).toContainText(/not a valid link/i);
  await rows.nth(1).getByLabel(/brand/i).fill('ZARA');
  await rows.nth(1).getByLabel(/name/i).fill('Black Denim Overshirt');
  await rows.nth(1).getByRole('button', { name: /save/i }).click();
  await rows.nth(0).getByLabel(/product code/i).fill('60219/1');
  await rows.nth(1).getByLabel(/product code/i).fill('60777/2');
  await rows.nth(1).getByRole('radio', { name: /equivalent/i }).check();
  await page.getByRole('button', { name: /publish 2 products/i }).click();
  await expect(page).toHaveURL(/\/m\/indigo-mill$/);
  await expect(page.getByText('Black Denim Overshirt')).toBeVisible();
});

test('pasting a product that is already on the page keeps its code, role and Verified badge', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/add');
  await page.getByLabel(/brand links/i).fill('https://guess.eu/en/cropped-denim-blazer-W5RN12');
  await page.getByRole('button', { name: /fetch/i }).click();
  const row = page.getByTestId('preview-row');
  await expect(row).toContainText('Already on your page');
  await expect(row.getByLabel(/product code/i)).toHaveValue('60219/1');
  await expect(row.getByRole('radio', { name: /we made this/i })).toBeChecked();
  await page.getByRole('button', { name: /publish 1 product/i }).click();
  await expect(page).toHaveURL(/\/m\/indigo-mill$/);
  await page.goto(`/p/${DEMO.products.guess}`);
  const original = page.getByTestId('fabric-suppliers').getByTestId('original-claim');
  await expect(original).toContainText('Verified');
  await expect(original).toContainText('Code 60219/1');
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
  await expect(page.getByRole('button', { name: /publish 0 products/i })).toBeDisabled();
});

test('the owner removes a product from its company page; visitors get no Remove', async ({ page }) => {
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
