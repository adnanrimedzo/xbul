import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('the code page shows the supplier’s own products only', async ({ page }) => {
  await page.goto('/m/indigo-mill/a/60219-1');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Code 60219/1');
  await expect(page.getByLabel('Breadcrumb')).toHaveText('Suppliers / Indigo Mill / 60219/1');
  await expect(page.getByText(/^linked to \d+ products?$/i)).toBeVisible();
  await expect(page.getByText('Cropped Denim Blazer')).toBeVisible();
  await expect(page.getByText('Denizli Indigo')).toHaveCount(0);
  await expect(page.getByText('1,000 m', { exact: false })).toBeVisible();
});
test('the copied article link carries no handle', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto('/m/indigo-mill/a/60219-1');
  await page.getByRole('button', { name: /copy link/i }).click();
  await expect(page.getByRole('button', { name: /copied/i })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://localhost:3100/m/indigo-mill/a/60219-1');
});
test('the owner edits specs; others cannot see the form', async ({ page }) => {
  await page.goto('/m/indigo-mill/a/60219-1');
  await expect(page.getByRole('button', { name: /edit specs/i })).toHaveCount(0);
  await signIn(page, 'mill@example.test');
  await page.goto('/m/indigo-mill/a/60219-1');
  await page.getByRole('button', { name: /edit specs/i }).click();
  await page.getByLabel(/moq/i).fill('1,500 m');
  await page.getByRole('button', { name: /save specs/i }).click();
  await expect(page.getByText('1,500 m', { exact: false })).toBeVisible();
});
test('the owner edits contact details; visitors cannot see the form', async ({ page }) => {
  await page.goto('/m/indigo-mill');
  await expect(page.getByRole('button', { name: /edit contact details/i })).toHaveCount(0);
  await signIn(page, 'mill@example.test');
  await page.goto('/m/indigo-mill');
  await page.getByRole('button', { name: /edit contact details/i }).click();
  await page.getByLabel('Phone').fill('+90 212 555 0100');
  await page.getByRole('button', { name: /save contact/i }).click();
  await expect(page.getByRole('link', { name: '+90 212 555 0100' })).toHaveAttribute('href', 'tel:+902125550100');
});
test('the company page lists product codes and products', async ({ page }) => {
  await page.goto('/m/indigo-mill');
  await expect(page.getByRole('heading', { name: 'Product codes' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Products', exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: /60219\/1 · \d+ products?/ })).toHaveAttribute('href', '/m/indigo-mill/a/60219-1');
});
