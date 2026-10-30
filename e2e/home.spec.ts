import { expect, test } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';

test('pasting a tagged product link (with tracking params) opens its page', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/paste a product link/i).fill('https://www.guess.eu/en/cropped-denim-blazer-W5RN12?utm_source=whatsapp');
  await page.getByRole('button', { name: /^find$/i }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${DEMO.products.guess}$`));
});
test('an untagged link says so and invites suppliers', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/paste a product link/i).fill('https://example.com/nothing');
  await page.getByRole('button', { name: /^find$/i }).click();
  await expect(page.getByText(/no supplier has tagged this product yet/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /are you the supplier/i })).toHaveAttribute('href', '/add');
});
test('recently tagged grid', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('garment-tile').first()).toBeVisible();
  await expect(page.getByText('2 original · 2 equiv.', { exact: false })).toBeVisible();
});
test('the find input shows a keyboard focus ring', async ({ page }) => {
  await page.goto('/');
  const input = page.getByPlaceholder(/paste a product link/i);
  for (let i = 0; i < 12 && !(await input.evaluate((el) => el === document.activeElement)); i++) await page.keyboard.press('Tab');
  await expect(input).toBeFocused();
  const ring = await input.evaluate((el) => {
    const { outlineStyle, outlineWidth } = getComputedStyle(el);
    return { outlineStyle, outlineWidth };
  });
  expect(ring.outlineStyle).not.toBe('none');
  expect(ring.outlineWidth).toBe('2px');
});
test('the display text keeps a space between its two lines', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Who made this?');
});
test('the home page says supplier and product, not mill and garment', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByPlaceholder("Paste a product link from any brand's site")).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Recently tagged products' })).toBeVisible();
  await expect(page.getByText('Contact suppliers directly').first()).toBeAttached(); // the ticker is aria-hidden
  await expect(page.locator('meta[name=description]')).toHaveAttribute('content', 'Find the supplier behind any product.');
});
