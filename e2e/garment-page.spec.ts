import { expect, test } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';
import { lastMailTo, signIn } from './helpers';

const url = `/p/${DEMO.products.guess}`;
test('buyer arrives via an agent link and requests a swatch', async ({ page }) => {
  await page.goto(`${url}?via=lauramartin-demo`);
  await expect(page.getByText(/shared by agent/i)).toContainText('Laura Martin');
  const original = page.getByTestId('original-claim');
  await expect(original).toContainText('Indigo Mill'); await expect(original).toContainText('Verified'); await expect(original).toContainText('60219/1');
  await expect(page.getByTestId('equivalent-claim').first()).toContainText('Denizli Indigo');
  await original.getByRole('button', { name: /request swatch/i }).click();
  await page.getByLabel(/your name/i).fill('Ana Buyer'); await page.getByLabel(/email/i).fill('ana@brand.test');
  await page.getByLabel(/company/i).fill('Brand Co'); await page.getByLabel(/quantity/i).fill('1000');
  await page.getByRole('button', { name: /send request/i }).click();
  await expect(page.getByText(/request sent/i)).toBeVisible();
  expect((await lastMailTo('mill@example.test')).text).toContain('Via agent: @lauramartin-demo');
});
test('an agent copies a garment link carrying their handle', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write']);
  await signIn(page, 'agent@example.test');
  await page.goto(url);
  await page.getByRole('button', { name: /copy link/i }).click();
  await expect(page.getByRole('button', { name: /copied/i })).toBeVisible();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(`http://localhost:3100/p/${DEMO.products.guess}?via=lauramartin-demo`);
});
test('a tampered via is ignored and never rendered raw', async ({ page }) => {
  await page.goto(`${url}?via=%3Cscript%3Ealert(1)%3C%2Fscript%3E`);
  await expect(page.getByText(/shared by agent/i)).toHaveCount(0);
});
test('link previews carry title and description', async ({ request }) => {
  const html = await (await request.get(url)).text();
  expect(html).toContain('<meta property="og:title" content="GUESS — Cropped Denim Blazer"');
  expect(html).toMatch(/<meta property="og:description" content="Fabric by Indigo Mill \(article 60219\/1\) · 2 mills can make an equivalent"/);
});
test('unknown product is a 404', async ({ page }) => {
  expect((await page.goto('/p/not-a-uuid'))?.status()).toBe(404);
});
