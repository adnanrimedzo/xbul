import { expect, test } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';
import { signIn } from './helpers';

const pdf = { name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 demo') };

test('a supplier submits evidence, an admin approves it, and the badge appears', async ({ page, browser }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/m/indigo-mill');
  await page.getByTestId('mill-garment').filter({ hasText: 'Printed Denim Jacket' }).getByRole('link', { name: /get verified/i }).click();
  await page.getByLabel(/add a document/i).setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
  // Inside <main>: Next's own route announcer is a second role="alert" on every page.
  await expect(page.locator('main').getByRole('alert')).toHaveText('Upload a PDF, JPG or PNG file.');
  await page.getByLabel(/add a document/i).setInputFiles(pdf);
  const file = page.getByRole('link', { name: 'invoice.pdf' });
  await expect(file).toBeVisible();
  const fileUrl = (await file.getAttribute('href'))!;
  await page.getByRole('button', { name: /submit for review/i }).click();
  await expect(page.getByText(/under review/i)).toBeVisible();

  // Anyone else gets a 404 for the file.
  const stranger = await browser.newContext();
  expect((await stranger.request.get(`http://localhost:3100${fileUrl}`)).status()).toBe(404);
  await stranger.close();

  const admin = await (await browser.newContext({ baseURL: 'http://localhost:3100' })).newPage();
  await signIn(admin, 'admin@example.test');
  await admin.goto('/admin/claims');
  const row = admin.getByTestId('pending-review').filter({ hasText: 'LIU-JO' });
  const download = await admin.request.get(`http://localhost:3100${fileUrl}`);
  expect(download.status()).toBe(200);
  expect(download.headers()['content-disposition']).toContain('attachment');
  expect(download.headers()['x-content-type-options']).toBe('nosniff');
  await row.getByRole('button', { name: /^approve$/i }).click();
  await expect(row).toHaveCount(0);
  await admin.goto(`/p/${DEMO.products.liujo}`);
  await expect(admin.getByTestId('original-claim')).toContainText('Verified');
  expect((await admin.request.get(`http://localhost:3100${fileUrl}`)).status()).toBe(404); // deleted once decided
});

test('a rejected supplier sees why and can try again', async ({ page, browser }) => {
  await signIn(page, 'bursa@example.test');
  await page.goto(`/add`);
  await page.getByLabel(/brand links/i).fill('http://localhost:4010/washed-denim-jacket.html');
  await page.getByRole('button', { name: /fetch/i }).click();
  await page.getByRole('button', { name: /publish 1 products?/i }).click();
  await page.getByTestId('mill-garment').filter({ hasText: 'Washed Denim Jacket' }).getByRole('link', { name: /get verified/i }).click();
  await page.getByLabel(/add a document/i).setInputFiles(pdf);
  await expect(page.getByRole('link', { name: 'invoice.pdf' })).toBeVisible();
  await page.getByRole('button', { name: /submit for review/i }).click();

  const admin = await (await browser.newContext({ baseURL: 'http://localhost:3100' })).newPage();
  await signIn(admin, 'admin@example.test');
  await admin.goto('/admin/claims');
  const row = admin.getByTestId('pending-review').filter({ hasText: 'Bursa Weave' });
  await row.getByLabel(/reason/i).fill('The invoice is unreadable');
  await row.getByRole('button', { name: /^reject$/i }).click();
  await expect(row).toHaveCount(0);

  await page.reload();
  await expect(page.getByText('The invoice is unreadable')).toBeVisible();
  await expect(page.getByLabel(/add a document/i)).toBeVisible();
});
