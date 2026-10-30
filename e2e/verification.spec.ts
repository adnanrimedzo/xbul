import { expect, test, type Browser, type Page } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';
import { signIn } from './helpers';

const pdf = { name: 'invoice.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 demo') };

// A claim that is under review or verified offers nothing to change.
async function expectNothingToEdit(page: Page) {
  await expect(page.getByLabel(/add a document/i)).toHaveCount(0);
  await expect(page.getByRole('button', { name: /^(remove|submit for review)$/i })).toHaveCount(0);
}

// Another supplier opening the page gets the same 404 as for a claim that doesn't exist, and sees nothing of it.
async function expectHiddenFrom(stranger: Page, url: string, secrets: string[]) {
  expect((await stranger.goto(url))?.status()).toBe(404);
  const html = await stranger.content();
  for (const secret of secrets) expect(html).not.toContain(secret);
}

async function signedInPage(browser: Browser, email: string): Promise<Page> {
  const page = await (await browser.newContext({ baseURL: 'http://localhost:3100' })).newPage();
  await signIn(page, email);
  return page;
}

test('a supplier submits evidence, an admin approves it, and the badge appears', async ({ page, browser }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/m/indigo-mill');
  await page.getByTestId('mill-garment').filter({ hasText: 'Printed Denim Jacket' }).getByRole('link', { name: /get verified/i }).click();
  await expect(page).toHaveURL(/\/verify\//);
  const verifyUrl = page.url();
  await page.getByLabel(/add a document/i).setInputFiles({ name: 'notes.pdf', mimeType: 'application/pdf', buffer: Buffer.from('not a pdf') });
  // Inside <main>: Next's own route announcer is a second role="alert" on every page.
  await expect(page.locator('main').getByRole('alert')).toHaveText('Upload a PDF, JPG or PNG file.');
  await page.getByLabel(/add a document/i).setInputFiles(pdf);
  const file = page.getByRole('link', { name: 'invoice.pdf' });
  await expect(file).toBeVisible();
  const fileUrl = (await file.getAttribute('href'))!;
  await page.getByRole('button', { name: /submit for review/i }).click();
  await expect(page.getByText(/under review/i)).toBeVisible();
  await expectNothingToEdit(page);

  // Anyone else gets a 404 for the file.
  const stranger = await browser.newContext();
  expect((await stranger.request.get(`http://localhost:3100${fileUrl}`)).status()).toBe(404);
  await stranger.close();

  const admin = await signedInPage(browser, 'admin@example.test');
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

  await page.goto(verifyUrl);
  await expect(page.getByText('Verified', { exact: true })).toBeVisible();
  await expectNothingToEdit(page);
});

test('a rejected supplier sees why and can try again', async ({ page, browser }) => {
  await signIn(page, 'bursa@example.test');
  await page.goto(`/add`);
  await page.getByLabel(/brand links/i).fill('http://localhost:4010/washed-denim-jacket.html');
  await page.getByRole('button', { name: /fetch/i }).click();
  await page.getByRole('button', { name: /publish 1 products?/i }).click();
  await page.getByTestId('mill-garment').filter({ hasText: 'Washed Denim Jacket' }).getByRole('link', { name: /get verified/i }).click();
  await expect(page).toHaveURL(/\/verify\//);
  const verifyUrl = page.url();
  await page.getByLabel(/add a document/i).setInputFiles(pdf);
  await expect(page.getByRole('link', { name: 'invoice.pdf' })).toBeVisible();

  const stranger = await signedInPage(browser, 'denizli@example.test'); // another supplier
  await expectHiddenFrom(stranger, verifyUrl, ['invoice.pdf']);
  await page.getByRole('button', { name: /submit for review/i }).click();

  const admin = await signedInPage(browser, 'admin@example.test');
  await admin.goto('/admin/claims');
  const row = admin.getByTestId('pending-review').filter({ hasText: 'Bursa Weave' });
  await row.getByLabel(/reason/i).fill('The invoice is unreadable.');
  await row.getByRole('button', { name: /^reject$/i }).click();
  await expect(row).toHaveCount(0);
  await expectHiddenFrom(stranger, verifyUrl, ['The invoice is unreadable']);

  // On its company page the tile says it was rejected, not the same "Get verified" as a claim that sent nothing.
  await page.goto('/m/bursa-weave');
  const tile = page.getByTestId('mill-garment').filter({ hasText: 'Washed Denim Jacket' });
  await expect(tile.getByRole('link', { name: /get verified/i })).toHaveCount(0);
  await tile.getByRole('link', { name: 'Rejected: see why' }).click();
  await expect(page).toHaveURL(verifyUrl);
  await expect(page.getByText('Rejected: The invoice is unreadable. Add new documents and submit again.')).toBeVisible(); // one full stop, not two
  await expect(page.getByLabel(/add a document/i)).toBeVisible();

  // Sent in again, it is under review once more, and the old reason is gone.
  await page.getByLabel(/add a document/i).setInputFiles(pdf);
  await expect(page.getByRole('link', { name: 'invoice.pdf' })).toBeVisible();
  await page.getByRole('button', { name: /submit for review/i }).click();
  await expect(page.getByText(/under review/i)).toBeVisible();
  await expect(page.getByText('The invoice is unreadable')).toHaveCount(0);
  await expectNothingToEdit(page);
});

test('a supplier whose session has ended is sent to sign in from the upload form', async ({ page }) => {
  await signIn(page, 'maker@example.test');
  await page.goto('/add');
  await page.getByLabel(/brand links/i).fill('http://localhost:4010/washed-denim-jacket.html');
  await page.getByRole('button', { name: /fetch/i }).click();
  await page.getByRole('button', { name: /publish 1 products?/i }).click();
  await page.getByTestId('mill-garment').filter({ hasText: 'Washed Denim Jacket' }).getByRole('link', { name: /get verified/i }).click();
  await expect(page.getByLabel(/add a document/i)).toBeVisible();
  await page.context().clearCookies();
  await page.getByLabel(/add a document/i).setInputFiles(pdf);
  await expect(page).toHaveURL(/\/sign-in/);
});
