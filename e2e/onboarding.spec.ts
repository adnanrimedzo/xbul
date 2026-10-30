import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('a new mill signs in, registers its company and lands on Add', async ({ page }) => {
  await signIn(page, 'new-mill@example.test');
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByLabel(/company name/i).fill('Aksu Denim');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByLabel(/contact email/i).fill('sales@aksu-denim.test');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/add$/);
  await page.goto('/m/aksu-denim');
  await expect(page.getByRole('link', { name: 'sales@aksu-denim.test' })).toHaveAttribute('href', 'mailto:sales@aksu-denim.test');
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

test('a supplier must give a way to be reached', async ({ page }) => {
  await signIn(page, 'no-contact-mill@example.test');
  await expect(page.getByLabel(/contact email/i)).toHaveValue('no-contact-mill@example.test'); // defaults to the sign-in email
  await page.getByLabel(/company name/i).fill('Quiet Mill');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByLabel(/contact email/i).fill('');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('Add an email, phone or website so buyers can reach you.')).toBeVisible();
  await expect(page.getByLabel(/company name/i)).toHaveValue('Quiet Mill'); // what was typed stays
  await expect(page).toHaveURL(/\/onboarding/);
});
