import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

// Ege Örme and Marmara Denim are submitted in the seed. These tests move Ege to changes_requested and approve Marmara.

test('an admin asks for changes and the owner sees why', async ({ page }) => {
  await signIn(page, 'admin@example.test');
  await page.getByRole('link', { name: 'Manufacturers' }).click();
  await page.getByRole('link', { name: 'Ege Örme' }).click();
  await page.getByLabel(/note/i).first().fill('Upload your kapasite raporu.');
  await page.getByRole('button', { name: /request changes/i }).click();
  await expect(page.getByText('Changes requested')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reject' })).toBeVisible(); // a company that never answers can still be rejected
  await signIn(page, 'pending@example.test');
  await page.goto('/m/ege-orme/registration');
  await expect(page.getByText('Upload your kapasite raporu.')).toBeVisible();
});

test('approving makes the company public', async ({ page, browser }) => {
  const visitor = await (await browser.newContext()).newPage();
  expect((await visitor.goto('/m/marmara-denim'))?.status()).toBe(404);
  await signIn(page, 'admin@example.test');
  await page.goto('/admin/manufacturers');
  await page.getByRole('link', { name: 'Marmara Denim' }).click();
  await page.getByRole('button', { name: /approve/i }).click();
  await page.getByRole('button', { name: /confirm/i }).click();
  await expect(page.getByRole('button', { name: /confirm/i })).toHaveCount(0); // the decision is saved before the visitor looks
  expect((await visitor.goto('/m/marmara-denim'))?.status()).toBe(200);
  await expect(visitor.getByText('OEKO-TEX 100 21.HTR.40001')).toBeVisible(); // its certificate is public now
});
