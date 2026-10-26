import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('article page shows the mill’s own garments only', async ({ page }) => {
  await page.goto('/m/indigo-mill/a/60219-1');
  await expect(page.getByRole('heading', { name: /60219\/1/ })).toBeVisible();
  await expect(page.getByText('Cropped Denim Blazer')).toBeVisible();
  await expect(page.getByText('Denizli Indigo')).toHaveCount(0);
  await expect(page.getByText('1,000 m', { exact: false })).toBeVisible();
});
test('an agent copies a link carrying their handle', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page, 'agent@example.test');
  await page.goto('/m/indigo-mill/a/60219-1');
  await page.getByRole('button', { name: /copy link for agents/i }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('http://localhost:3100/m/indigo-mill/a/60219-1?via=lauramartin-demo');
});
test('the owner edits specs; others cannot see the form', async ({ page }) => {
  await page.goto('/m/indigo-mill/a/60219-1');
  await expect(page.getByRole('button', { name: /edit specs/i })).toHaveCount(0);
  await signIn(page, 'mill@example.test');
  await page.goto('/m/indigo-mill/a/60219-1');
  await page.getByRole('button', { name: /edit specs/i }).click();
  await page.getByLabel(/moq/i).fill('1500');
  await page.getByRole('button', { name: /save specs/i }).click();
  await expect(page.getByText('1,500 m', { exact: false })).toBeVisible();
});
test('mill page lists articles', async ({ page }) => {
  await page.goto('/m/indigo-mill');
  await expect(page.getByRole('link', { name: /60219\/1/ })).toHaveAttribute('href', '/m/indigo-mill/a/60219-1');
});
