import { expect, test } from '@playwright/test';
import { DEMO } from '../src/server/demo-ids';

test.describe('a visitor from Türkiye', () => {
  test.use({ extraHTTPHeaders: { 'cf-ipcountry': 'TR' } });

  test('gets Turkish by default, and keeps English once they choose it', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveURL(/\/tr$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bunu kim üretti?');

    await page.getByRole('banner').getByRole('link', { name: 'EN' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Who made this?');
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  });
});

test('search engines see both languages, each naming the other', async ({ page }) => {
  await page.goto(`/tr/p/${DEMO.products.guess}`);
  await expect(page.locator('html')).toHaveAttribute('lang', 'tr');
  await expect(page.getByText('Bunu biz ürettik').first()).toBeVisible();
  await expect(page.locator('link[rel=alternate][hreflang=en]')).toHaveAttribute('href', new RegExp(`/p/${DEMO.products.guess}$`));
  await expect(page.locator('link[rel=alternate][hreflang=tr]')).toHaveAttribute('href', new RegExp(`/tr/p/${DEMO.products.guess}$`));
});

test('a Turkish search lands on the Turkish product page', async ({ page }) => {
  await page.goto('/tr');
  await page.getByPlaceholder('Bir ürün linki yapıştırın').fill('https://www.guess.eu/en/cropped-denim-blazer-W5RN12');
  await page.getByRole('button', { name: 'Üreticileri bul' }).click();
  await expect(page).toHaveURL(new RegExp(`/tr/p/${DEMO.products.guess}$`));
});

test('brand pages answer the question and list that brand’s products', async ({ page }) => {
  await page.goto('/brands/guess');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Who makes GUESS clothes?');
  await expect(page.getByTestId('garment-tile').first()).toBeVisible();
  const ld = await page.locator('script[type="application/ld+json"]').first().textContent();
  expect(ld).toContain('FAQPage');
});
