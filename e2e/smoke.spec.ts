import { expect, test } from '@playwright/test';

test('chrome renders', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('xmanufacture', { exact: false }).first()).toBeVisible();
  await expect(page.getByText(/ISTANBUL, TR/i)).toBeVisible();
});
test('pages refuse to be framed', async ({ request }) => {
  for (const path of ['/', '/sign-in', '/p/not-a-uuid']) {
    const headers = (await request.get(path)).headers();
    expect(headers['x-frame-options'], path).toBe('DENY');
    expect(headers['content-security-policy'], path).toBe("frame-ancestors 'none'");
  }
});
