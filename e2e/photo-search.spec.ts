import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { signIn } from './helpers';

// Photo search end to end, with the fake model (PHOTO_AI=fake): it decides by pixel size, and each fixture in
// e2e/fixtures/photos has the size of one concept (denim jacket, fabric close-up, sweater, mug, dark, AI failure).
// The tests share state in order: a supplier publishes a photo, buyers find it, the supplier takes it down.
test.describe.configure({ mode: 'serial' });

const fixture = (name: string) => `e2e/fixtures/photos/${name}`;
const main = (page: Page) => page.locator('main');
// The real file input behind the "Choose a photo" button (hidden from assistive tech). The last one is the close-up's.
const fileInput = (page: Page) => page.locator('[data-testid="photo-dropzone"] input[type="file"]').last();

async function searchWith(page: Page, name: string, path = '/photo') {
  await page.goto(path);
  await fileInput(page).setInputFiles(fixture(name));
}

// Waits for the photo check and returns the results URL.
async function openResults(page: Page, name: string): Promise<string> {
  await searchWith(page, name);
  await page.getByRole('link', { name: /^(find suppliers|search anyway)$/i }).click();
  await expect(page).toHaveURL(/\/photo\/[0-9a-f-]{36}$/);
  return page.url();
}

test('a supplier uploads a product photo, reviews the suggested tags and publishes it', async ({ page }) => {
  await signIn(page, 'mill@example.test');

  // The fabric spec the buyer's fabric details are compared with, set through the existing technical sheet form.
  await page.goto('/m/indigo-mill/a/60219-1');
  await page.getByRole('button', { name: 'Edit technical sheet' }).click();
  await page.getByLabel('Construction').selectOption('woven');
  await page.getByLabel('Pattern').selectOption('twill');
  await page.getByLabel('Twill ratio').selectOption('3/1');
  await page.getByLabel('Twill direction').selectOption('rht');
  await page.getByLabel('Fibre 1', { exact: true }).selectOption('CO');
  await page.getByLabel('Fibre 1 %').fill('100');
  await page.getByRole('spinbutton', { name: 'Weight' }).fill('12');
  await page.getByRole('combobox', { name: 'Weight' }).selectOption('oz');
  await page.getByLabel('Dyeing').selectOption('rope');
  await page.getByRole('button', { name: 'Save technical sheet' }).click();
  await expect(page.getByText('Technical sheet saved.')).toBeVisible();

  await page.getByRole('navigation', { name: /main/i }).getByRole('link', { name: 'Product photos' }).click();
  await expect(page).toHaveURL(/\/m\/indigo-mill\/photos$/);
  await fileInput(page).setInputFiles([fixture('denim-jacket-supplier.jpg'), fixture('mug.jpg')]);
  const rows = page.getByTestId('upload-row');
  await expect(rows.filter({ hasText: 'mug.jpg' })).toContainText("We couldn't find a textile product in this photo.");
  await expect(rows.filter({ hasText: 'denim-jacket-supplier.jpg' })).toHaveAttribute('data-status', 'ready');

  const draft = page.getByTestId('draft-photo');
  await expect(draft).toHaveCount(1); // the mug added nothing
  await expect(draft.getByLabel(/what the photo shows/i)).toHaveValue('garment');
  await expect(draft.getByLabel(/product type/i)).toHaveValue('jacket');
  await expect(draft.getByLabel(/weave or knit/i)).toHaveValue('twill');
  await expect(draft.getByText('Suggested').first()).toBeVisible();
  await expect(draft.getByRole('checkbox', { name: 'Blue' })).toBeChecked();
  await draft.getByRole('checkbox', { name: 'Navy' }).check();
  await draft.getByLabel(/product code/i).selectOption({ label: '60219/1' });
  await draft.getByRole('button', { name: /approve and publish/i }).click();

  await expect(page.getByTestId('published-photo')).toHaveCount(1);
  await expect(page.getByTestId('draft-photo')).toHaveCount(0);
  await page.goto('/m/indigo-mill');
  await expect(page.getByTestId('company-photos').getByRole('img')).toHaveCount(1);
});

test("another company's photo page is a 404", async ({ page }) => {
  await signIn(page, 'mill@example.test');
  expect((await page.goto('/m/bursa-weave/photos'))?.status()).toBe(404);
});

test('a buyer finds the supplier from a photo of the same product', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('link', { name: 'Search with a photo', exact: true })).toBeVisible();
  await page.getByRole('link', { name: 'Or search with a photo' }).click();
  await expect(page).toHaveURL(/\/photo$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Search with a photo');
  await expect(page.getByTestId('photo-dropzone')).toContainText('JPG, PNG or WebP, up to 10 MB. One product per photo, in good light.');

  await fileInput(page).setInputFiles(fixture('denim-jacket.jpg'));
  const seen = page.getByTestId('photo-seen');
  await expect(seen).toContainText('Jacket or blazer');
  await expect(seen).toContainText('Blue');
  await page.getByRole('link', { name: 'Find suppliers' }).click();
  await expect(page).toHaveURL(/\/photo\/[0-9a-f-]{36}$/);

  const result = page.getByTestId('photo-result').filter({ hasText: 'Indigo Mill' });
  await expect(result).toContainText('Looks the same');
  await expect(result).toContainText('Matches: Woven · Twill · Denim');
  await expect(result.getByRole('link', { name: 'Code 60219/1' })).toBeVisible();
  await expect(result.getByTestId('supplier-contact')).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);
  const own = page.getByRole('img', { name: 'Your photo' });
  expect((await page.request.get((await own.getAttribute('src'))!)).status()).toBe(200);
});

test('a fabric close-up adds the twill details, and Refine corrects or filters without a new check', async ({ page }) => {
  await searchWith(page, 'denim-jacket.jpg');
  await expect(page.getByTestId('photo-seen')).toContainText('Twill');
  await expect(page.getByTestId('photo-seen')).not.toContainText('3/1');
  await page.getByRole('button', { name: /add a close-up of the fabric/i }).click();
  await fileInput(page).setInputFiles(fixture('denim-fabric.jpg'));
  await expect(main(page).getByRole('status').filter({ hasText: 'Close-up added.' })).toBeVisible();
  await expect(page.getByTestId('photo-seen')).toContainText('3/1 right-hand twill (RHT)');
  await page.getByRole('link', { name: 'Find suppliers' }).click();
  await expect(page.getByTestId('photo-seen')).toContainText('Rope-dyed');

  let checks = 0;
  page.on('request', (r) => void (r.method() === 'POST' && checks++));
  await page.getByText('Refine', { exact: true }).click();
  await page.getByLabel('Weave or knit').selectOption('plain');
  await page.getByRole('button', { name: 'Show matches' }).click();
  await expect(page).toHaveURL(/pattern=plain/);
  const result = page.getByTestId('photo-result').filter({ hasText: 'Indigo Mill' });
  await expect(result).toContainText('Similar');
  await expect(result).not.toContainText('Looks the same');

  await page.getByLabel('Contains fibre').selectOption('CO');
  await page.getByRole('button', { name: 'Show matches' }).click();
  await expect(page.getByTestId('photo-result').filter({ hasText: 'Indigo Mill' })).toBeVisible();
  await page.getByLabel('From').fill('2000');
  await page.getByRole('button', { name: 'Show matches' }).click();
  await expect(page.getByTestId('photo-no-results')).toContainText('No supplier matches these filters.');
  await page.getByTestId('photo-no-results').getByRole('link', { name: 'Clear filters' }).click();
  await expect(page.getByTestId('photo-result').filter({ hasText: 'Indigo Mill' })).toContainText('Looks the same');
  expect(checks).toBe(0); // Refine is plain GET navigation
});

test('paste and drag and drop both start a search', async ({ page }) => {
  const bytes = readFileSync(fixture('denim-jacket.jpg')).toString('base64');
  // The listeners attach on hydration, which `next dev` can finish after load: repeat until the page reacts. Once it has,
  // the dropzone is gone, so a repeat can't start a second search.
  await page.goto('/photo');
  await expect(async () => {
    await page.evaluate((b64) => {
      const file = new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'pasted.jpg', { type: 'image/jpeg' });
      const data = new DataTransfer();
      data.items.add(file);
      document.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true }));
    }, bytes);
    await expect(page.getByTestId('photo-dropzone')).toHaveCount(0, { timeout: 1000 });
  }).toPass();
  await expect(page.getByTestId('photo-seen')).toContainText('Jacket or blazer');

  await page.goto('/photo');
  const zone = page.getByTestId('photo-dropzone');
  const data = await page.evaluateHandle((b64) => {
    const d = new DataTransfer();
    d.items.add(new File([Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))], 'dropped.jpg', { type: 'image/jpeg' }));
    return d;
  }, bytes);
  await expect(async () => {
    await zone.dispatchEvent('dragenter', { dataTransfer: data });
    await expect(zone).toHaveAttribute('data-over', 'true', { timeout: 1000 });
  }).toPass();
  await expect(zone).toContainText('Drop to use this photo');
  await zone.dispatchEvent('drop', { dataTransfer: data });
  await expect(page.getByTestId('photo-seen')).toContainText('Jacket or blazer');
});

test('a photo that is not a textile product is refused before any search', async ({ page }) => {
  await searchWith(page, 'mug.jpg');
  await expect(main(page).getByRole('alert')).toContainText("We couldn't find a textile product in this photo.");
  await expect(page).toHaveURL(/\/photo$/);
  await expect(page.getByRole('link', { name: 'Find suppliers' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Try another photo' })).toBeFocused();
  await page.getByRole('button', { name: 'Try another photo' }).click();
  await expect(page.getByTestId('photo-dropzone')).toBeVisible();
});

test('an unclear photo can still be searched, and an unmatched one says so', async ({ page }) => {
  await searchWith(page, 'dark.jpg');
  await expect(page.getByText('This photo is too dark or blurry to read.')).toBeVisible();
  await page.getByRole('link', { name: 'Search anyway' }).click();
  await expect(page).toHaveURL(/\/photo\/[0-9a-f-]{36}$/);

  await openResults(page, 'sweater.jpg');
  await expect(page.getByTestId('photo-no-results')).toContainText('No supplier photos look like this yet.');
  await expect(page.getByRole('link', { name: 'Paste a product link instead' })).toBeVisible();
});

test('files the browser cannot use never reach the server', async ({ page }) => {
  await page.goto('/photo');
  let posts = 0;
  page.on('request', (r) => void (r.method() === 'POST' && posts++));
  await fileInput(page).setInputFiles({ name: 'invoice.jpg', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7') });
  await expect(main(page).getByRole('alert')).toHaveText('Choose a JPG, PNG or WebP photo.');
  await page.getByRole('button', { name: 'Try another photo' }).click();
  await fileInput(page).setInputFiles({ name: 'huge.jpg', mimeType: 'image/jpeg', buffer: Buffer.alloc(11 * 1024 * 1024, 1) });
  await expect(main(page).getByRole('alert')).toHaveText("We couldn't read this photo. Try another one.");
  expect(posts).toBe(0);
});

test('a busy model can be retried, and a big photo is shrunk before upload', async ({ page }) => {
  await searchWith(page, 'ai-failure.jpg');
  await expect(main(page).getByRole('alert')).toHaveText('Photo search is busy. Try again in a minute.');
  await expect(page.getByRole('button', { name: 'Try again' })).toBeVisible();

  await page.goto('/photo');
  const upload = page.waitForResponse((r) => r.request().method() === 'POST');
  await fileInput(page).setInputFiles(fixture('big-photo.jpg'));
  expect((await (await upload).request().sizes()).requestBodySize).toBeLessThan(1024 * 1024);
  await expect(page.getByTestId('photo-seen')).toContainText('Jacket or blazer');
});

test('an unknown or expired search, Turkish, phone width and keyboard', async ({ page }) => {
  await page.goto(`/photo/${crypto.randomUUID()}`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('This search has expired');

  await searchWith(page, 'denim-jacket.jpg', '/tr/photo');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Fotoğrafla arayın');
  await expect(page.getByTestId('photo-seen')).toContainText('Ceket');
  await expect(page.getByTestId('photo-seen')).toContainText('Mavi');

  await page.setViewportSize({ width: 375, height: 812 });
  const results = await openResults(page, 'denim-jacket.jpg');
  for (const url of ['/photo', results]) {
    await page.goto(url);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
  }

  await page.goto('/photo');
  await page.getByRole('button', { name: 'Choose a photo' }).focus();
  const chooser = page.waitForEvent('filechooser');
  await page.keyboard.press('Enter');
  await (await chooser).setFiles(fixture('denim-jacket.jpg'));
  await expect(page.getByTestId('photo-seen')).toContainText('Jacket or blazer');
});

test('once the supplier unpublishes, buyers no longer see the photo, but a fabric close-up still finds the matching article', async ({ page, browser }) => {
  await signIn(page, 'mill@example.test');
  await page.goto('/m/indigo-mill/photos');
  await page.getByTestId('published-photo').getByRole('button', { name: 'Unpublish' }).click();
  await expect(page.getByTestId('draft-photo')).toHaveCount(1);

  const buyer = await (await browser.newContext({ baseURL: 'http://localhost:3100' })).newPage();
  await openResults(buyer, 'denim-jacket.jpg');
  await expect(buyer.getByTestId('photo-no-results')).toBeVisible();
  await openResults(buyer, 'denim-fabric.jpg');
  const result = buyer.getByTestId('photo-result').filter({ hasText: 'Indigo Mill' });
  await expect(result).toContainText('Fabric spec matches');
  await expect(result.getByRole('link', { name: 'Code 60219/1' })).toBeVisible();

  // Tidy up for the specs that follow.
  await page.getByTestId('draft-photo').getByRole('button', { name: 'Delete' }).click();
  await page.getByTestId('draft-photo').getByRole('button', { name: 'Delete for good' }).click();
  await expect(page.getByTestId('draft-photo')).toHaveCount(0);
});
