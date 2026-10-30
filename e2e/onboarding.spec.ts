import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('a new mill signs in, registers its company and lands on Add', async ({ page }) => {
  await signIn(page, 'new-mill@example.test');
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel(/company name/i).fill('Aksu Denim');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/add$/);
});

test('someone who already has a company skips onboarding', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await expect(page).toHaveURL(/\/add$/);
});

test('onboarding errors are shown inline', async ({ page }) => {
  await signIn(page, 'bad-mill@example.test');
  await page.getByLabel(/company name/i).fill('A');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('Company name must be 2–80 characters.')).toBeVisible();
});
