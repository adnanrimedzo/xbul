import { expect, test } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';

const url = `/p/${DEMO.products.guess}`;
test('a visitor can reach the original supplier and an equivalent directly, with no account', async ({ page }) => {
  await page.goto(url);
  const original = page.getByTestId('fabric-suppliers').getByTestId('original-claim');
  await expect(original).toContainText('Indigo Mill'); await expect(original).toContainText('Verified'); await expect(original).toContainText('Code 60219/1');
  await expect(original.getByRole('link', { name: 'sales@indigo-mill.example' })).toHaveAttribute('href', 'mailto:sales@indigo-mill.example');
  await expect(page.getByTestId('equivalent-claim').first().getByTestId('supplier-contact')).toBeVisible();
  await expect(page.getByRole('button', { name: /request/i })).toHaveCount(0);
});
test('the garment page shows who made the fabric and who made the garment', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByTestId('fabric-suppliers').getByTestId('original-claim')).toContainText('Indigo Mill');
  const garment = page.getByTestId('garment-suppliers');
  await expect(garment.getByTestId('original-claim')).toContainText('Anka Garments');
  await expect(garment.getByTestId('original-claim')).toContainText('Verified');
});
test('a visitor is invited to claim the product as a supplier', async ({ page }) => {
  await page.goto(url);
  await expect(page.getByRole('link', { name: /are you a supplier\? claim this product/i })).toHaveAttribute('href', '/add');
});
test('the copied garment link carries no handle', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await page.goto(url);
  await page.getByRole('button', { name: /copy link/i }).click();
  await expect(page.getByRole('button', { name: /copied/i })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3100/p/${DEMO.products.guess}`);
});
test('link previews carry title and description', async ({ request }) => {
  const html = await (await request.get(url)).text();
  expect(html).toContain('<meta property="og:title" content="GUESS — Cropped Denim Blazer"');
  expect(html).toMatch(/<meta property="og:description" content="Fabric by Indigo Mill \(code 60219\/1\) · Garment by Anka Garments · 2 suppliers can make an equivalent"/);
});
test('unknown product is a 404, with the site chrome and a way home', async ({ page }) => {
  expect((await page.goto('/p/not-a-uuid'))?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/not found/i);
  await expect(page.getByRole('link', { name: /back to xbul/i })).toHaveAttribute('href', '/');
});
