import { expect, test } from '@playwright/test';
import { signIn } from './helpers';

test('a new mill signs in, registers its company and lands on its registration page', async ({ page }) => {
  await signIn(page, 'new-mill@example.test');
  await expect(page).toHaveURL(/\/onboarding/);
  await page.getByRole('radio', { name: /we make fabric/i }).check();
  await page.getByLabel(/company name/i).fill('Kartal Denim');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByLabel(/contact email/i).fill('sales@kartal-denim.test');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/m\/kartal-denim\/registration$/);
  await page.goto('/m/kartal-denim');
  await expect(page.getByText('No products linked yet.')).toBeVisible();
  await expect(page.getByRole('link', { name: 'sales@kartal-denim.test' })).toHaveAttribute('href', 'mailto:sales@kartal-denim.test');
});

test('a garment maker registers and its claims count as garment claims', async ({ page }) => {
  await signIn(page, 'new-maker@example.test');
  await page.getByRole('radio', { name: /we make garments/i }).check();
  await page.getByLabel(/company name/i).fill('Yeni Konfeksiyon');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByLabel(/contact email/i).fill('a@yeni.test');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/m\/yeni-konfeksiyon\/registration$/);
  await page.goto('/m/yeni-konfeksiyon');
  await expect(page.getByText('Garment maker')).toBeVisible();
});

test('someone who already has a company skips onboarding', async ({ page }) => {
  await signIn(page, 'mill@example.test');
  await expect(page).toHaveURL(/\/add$/);
});

test('onboarding errors are shown inline', async ({ page }) => {
  await signIn(page, 'bad-mill@example.test');
  await page.getByRole('radio', { name: /we make fabric/i }).check();
  await page.getByLabel(/company name/i).fill('A');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('Company name must be 2–80 characters.')).toBeVisible();
});

test('a supplier must give a way to be reached', async ({ page }) => {
  await signIn(page, 'no-contact-mill@example.test');
  await expect(page.getByLabel(/contact email/i)).toHaveValue('no-contact-mill@example.test'); // defaults to the sign-in email
  await expect(page.getByText('These are shown publicly on your page.')).toBeVisible(); // so that default doesn't surprise anyone
  await page.getByRole('radio', { name: /we make fabric/i }).check();
  await page.getByLabel(/company name/i).fill('Quiet Mill');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByLabel(/contact email/i).fill('');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page.getByText('Add an email, phone or website so buyers can reach you.')).toBeVisible();
  await expect(page.getByLabel(/company name/i)).toHaveValue('Quiet Mill'); // what was typed stays
  await expect(page.getByRole('radio', { name: /we make fabric/i })).toBeChecked();
  await expect(page).toHaveURL(/\/onboarding/);
});
