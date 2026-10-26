import { expect, test } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';

test('pasting a tagged garment link (with tracking params) opens its page', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/paste a garment link/i).fill('https://www.guess.eu/en/cropped-denim-blazer-W5RN12?utm_source=whatsapp');
  await page.getByRole('button', { name: /^find$/i }).click();
  await expect(page).toHaveURL(new RegExp(`/p/${DEMO.products.guess}$`));
});
test('an untagged link says so and invites mills', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/paste a garment link/i).fill('https://example.com/nothing');
  await page.getByRole('button', { name: /^find$/i }).click();
  await expect(page.getByText(/no mill has tagged this garment yet/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /are you the mill/i })).toHaveAttribute('href', '/add');
});
test('recently tagged grid', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByTestId('garment-tile').first()).toBeVisible();
  await expect(page.getByText('1 original · 2 equiv.', { exact: false })).toBeVisible();
});
test('the find input shows a keyboard focus ring', async ({ page }) => {
  await page.goto('/');
  const input = page.getByPlaceholder(/paste a garment link/i);
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
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Who made this fabric?');
});
