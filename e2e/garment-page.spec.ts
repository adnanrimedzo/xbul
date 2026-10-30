import { expect, test } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';

const url = `/p/${DEMO.products.guess}`;
test('a visitor can reach the original supplier and an equivalent directly, with no account', async ({ page }) => {
  await page.goto(url);
  const original = page.getByTestId('original-claim');
  await expect(original).toContainText('Indigo Mill'); await expect(original).toContainText('Verified'); await expect(original).toContainText('60219/1');
  await expect(original.getByRole('link', { name: 'sales@indigo-mill.example' })).toHaveAttribute('href', 'mailto:sales@indigo-mill.example');
  await expect(page.getByTestId('equivalent-claim').first().getByTestId('supplier-contact')).toBeVisible();
  await expect(page.getByRole('button', { name: /request/i })).toHaveCount(0);
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
  expect(html).toMatch(/<meta property="og:description" content="Fabric by Indigo Mill \(article 60219\/1\) · 2 mills can make an equivalent"/);
});
test('unknown product is a 404, with the site chrome and a way home', async ({ page }) => {
  expect((await page.goto('/p/not-a-uuid'))?.status()).toBe(404);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/not found/i);
  await expect(page.getByRole('link', { name: /back to xmanufacture/i })).toHaveAttribute('href', '/');
  await expect(page.getByText(/ISTANBUL, TR/i)).toBeVisible();
});
