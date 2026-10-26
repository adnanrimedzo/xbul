import { expect, test } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';
import { signIn } from './helpers';

test('mill sees credited requests and marks one answered', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/requests');
  const badge = page.getByTestId('new-requests-count');
  const before = Number(await badge.textContent());
  const row = page.getByTestId('inquiry-row').filter({ hasText: 'Seed Buyer Co' });
  await expect(row).toContainText('Via agent @lauramartin-demo');
  await expect(row).toContainText('GUESS — Cropped Denim Blazer');
  await row.getByRole('button', { name: /mark answered/i }).click();
  await expect(row).toContainText(/answered/i);
  // The line above also matches the button label, so these prove the row re-rendered as answered.
  await expect(row.getByRole('button', { name: /mark answered/i })).toHaveCount(0);
  await expect(row.getByText('Answered', { exact: true })).toBeVisible();
  if (before > 1) await expect(badge).toHaveText(String(before - 1));
  else await expect(badge).toHaveCount(0);
});
test('admin verifies a declared original', async ({ page }) => {
  await signIn(page, 'admin@example.test');
  await page.goto('/admin/claims');
  const row = page.getByTestId('declared-original').filter({ hasText: 'LIU-JO' });
  await row.getByRole('button', { name: /verify/i }).click();
  await expect(row).toHaveCount(0); // the action has finished and the page re-rendered
  await page.goto(`/p/${DEMO.products.liujo}`);
  await expect(page.getByTestId('original-claim')).toContainText('Verified');
});
test('non-admins are sent home', async ({ page }) => {
  await signIn(page, 'agent@example.test');
  await page.goto('/admin/claims');
  await expect(page).toHaveURL('http://localhost:3100/');
});
test('buyer-supplied text cannot prefill the mail window or overflow the inbox on mobile', async ({ page }) => {
  const local = `${'e'.repeat(100)}?bcc=evil`;
  await page.goto(`/p/${DEMO.products.guess}`);
  await page.getByRole('button', { name: /request swatch/i }).click();
  await page.getByLabel(/your name/i).fill('N'.repeat(100));
  await page.getByLabel(/email/i).fill(`${local}@b.test`);
  await page.getByLabel(/company/i).fill('Mallory Co');
  await page.getByLabel(/message/i).fill('W'.repeat(400));
  await page.getByRole('button', { name: /send request/i }).click();
  await expect(page.getByText(/request sent/i)).toBeVisible();

  await signIn(page, 'mill@example.test');
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/requests');
  const row = page.getByTestId('inquiry-row').filter({ hasText: 'Mallory Co' });
  await expect(row.getByRole('link', { name: `${local}@b.test` })).toHaveAttribute('href', `mailto:${encodeURIComponent(local)}@b.test`);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
