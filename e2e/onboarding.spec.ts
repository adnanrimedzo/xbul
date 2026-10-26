import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('a new mill signs in, registers its company and lands on Add', async ({ page }) => {
  await signIn(page, 'new-mill@example.test');
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('radio', { name: /i'm at a mill/i }).check();
  await page.getByLabel(/your name/i).fill('Ali Kaya');
  await page.getByLabel(/company name/i).fill('Aksu Denim');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/add$/);
});

test('a new agent signs in and gets a handle', async ({ page }) => {
  await signIn(page, 'new-agent@example.test');
  await page.getByRole('radio', { name: /i'm an agent/i }).check();
  await page.getByLabel(/your name/i).fill('Laura Test');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL('http://localhost:3100/');
});

test('onboarding errors are shown inline', async ({ page }) => {
  await signIn(page, 'bad-mill@example.test');
  await page.getByRole('radio', { name: /i'm at a mill/i }).check();
  await page.getByLabel(/your name/i).fill('Ali');
  await page.getByLabel(/company name/i).fill('A');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('Company name must be 2–80 characters.')).toBeVisible();
});
