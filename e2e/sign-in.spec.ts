import { expect, test } from '@playwright/test';

test('the email box comes first, with Google and Microsoft as one-tap shortcuts under it', async ({ page }) => {
  await page.goto('/sign-in');
  const email = page.getByLabel(/email/i);
  const google = page.getByRole('button', { name: 'Google' });
  const microsoft = page.getByRole('button', { name: 'Microsoft' });
  await expect(email).toBeVisible();
  await expect(google).toBeEnabled();
  await expect(microsoft).toBeEnabled();
  // Layout B: the providers sit below the email form.
  expect((await google.boundingBox())!.y).toBeGreaterThan((await email.boundingBox())!.y);

  // Stop at Google's door: no real network, but the request shows where the button sends people and back.
  await page.route('https://accounts.google.com/**', (route) => route.fulfill({ body: 'google' }));
  const [request] = await Promise.all([page.waitForRequest('https://accounts.google.com/**'), google.click()]);
  const url = new URL(request.url());
  expect(url.searchParams.get('client_id')).toBe('e2e-google-id');
  expect(url.searchParams.get('redirect_uri')).toBe('http://localhost:3100/api/auth/callback/google');
});

test('a provider sign-in that comes back refused says what to do instead', async ({ page }) => {
  await page.goto('/sign-in?error=email_not_verified');
  await expect(page.getByRole('alert')).toHaveText(/couldn.t sign you in with that account.*email link/i);
});
