import { expect, test } from '@playwright/test';
import { lastMailTo, signIn } from './helpers';

test('a Turkish mill registers, uploads its documents and submits', async ({ page }) => {
  await signIn(page, 'aksu@example.test');
  await page.getByRole('radio', { name: /we make fabric/i }).check();
  await page.getByLabel(/company name/i).fill('Aksu Denim');
  await page.getByLabel(/city/i).fill('Istanbul');
  await page.getByLabel(/country/i).fill('TR');
  await page.getByLabel(/contact email/i).fill('sales@aksu-denim.test');
  await page.getByRole('button', { name: /continue/i }).click();
  await expect(page).toHaveURL(/\/m\/aksu-denim\/registration$/);
  await expect(page.getByText('Not public yet.')).toBeVisible();

  await page.getByLabel(/tax number \(vkn/i).fill('123 456 7891');
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText('Enter a valid tax number for your country.')).toBeVisible();
  await expect(page.getByLabel(/tax number \(vkn/i)).toHaveValue('123 456 7891'); // what was typed stays

  await page.getByLabel(/legal name/i).fill('Aksu Denim Tekstil San. ve Tic. A.Ş.');
  await page.getByLabel(/tax number \(vkn/i).fill('1234567890');
  await page.getByLabel('Registry number', { exact: true }).fill('123456');
  await page.getByLabel('Registered address').fill('Atışalanı Cd. 1, Esenler, İstanbul');
  await page.getByLabel('Production facility address').fill('OSB 5. Cd. 12, Çorlu, Tekirdağ');
  await page.getByLabel(/activity codes/i).fill('13.20');
  await page.getByRole('button', { name: /save/i }).click();
  await expect(page.getByText('Saved.')).toBeVisible();

  const documents = page.getByRole('list', { name: 'Documents' }).getByRole('listitem');
  for (const [i, kind] of ['Tax certificate', 'Registry extract', 'Capacity report'].entries()) {
    await page.getByLabel(/document type/i).selectOption({ label: kind });
    await page.getByLabel(/file/i).setInputFiles('e2e/fixtures/document.pdf');
    await page.getByRole('button', { name: /upload/i }).click();
    await expect(documents).toHaveCount(i + 1); // the upload is done before the next one starts
  }
  await expect(page.getByText('Everything is in.')).toBeVisible();

  await page.getByRole('button', { name: /submit for review/i }).click();
  await expect(page.getByText('Under review.')).toBeVisible();
  await expect(page.getByLabel(/legal name/i)).toBeDisabled();
  await expect.poll(async () => (await lastMailTo('admin@example.test').catch(() => null))?.subject).toBe('New manufacturer to review: Aksu Denim');
});
