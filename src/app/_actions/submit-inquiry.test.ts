import { expect, it, vi } from 'vitest';
import { createClaimRepository } from '@/modules/claims';
import { createProfileRepository, createUserDirectory } from '@/modules/identity';
import { createInquiryRepository } from '@/modules/inquiry';
import { createSupplierRepositories } from '@/modules/supplier';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { createRecordingMailer } from '@/shared/mail/testing';
import { submitInquiryAction } from './submit-inquiry';

const container = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));

const GENERIC = 'Something went wrong. Please try again.';
const valid = {
  companyId: DEMO.companies.indigo,
  productId: DEMO.products.guess,
  articleId: DEMO.articles.indigo60219,
  kind: 'swatch',
  buyerName: 'Ana Buyer',
  buyerEmail: 'ana@brand.test',
  quantityMeters: '1000',
  via: DEMO.agentHandle,
};

async function setup() {
  const db = await createTestDb();
  await seedDemo(db);
  const inquiries = createInquiryRepository(db);
  const mailer = createRecordingMailer();
  container.current = {
    inquiries,
    mailer,
    claims: createClaimRepository(db),
    ...createSupplierRepositories(db),
    profiles: createProfileRepository(db),
    users: createUserDirectory(db),
    config: { baseUrl: 'http://localhost:3100' },
  };
  const submit = (fields: Record<string, string>) => {
    const form = new FormData();
    for (const [name, value] of Object.entries(fields)) form.set(name, value);
    return submitInquiryAction(null, form);
  };
  // Across every mill, so a request saved under the wrong company still counts.
  const saved = async () => {
    const counts = await Promise.all(Object.values(DEMO.companies).map((id) => inquiries.countRecentFrom(id, 'ana@brand.test', new Date(0))));
    return counts.reduce((a, b) => a + b, 0);
  };
  return { mailer, submit, saved };
}

it('saves, credits the agent and emails the mill owner', async () => {
  const { mailer, submit, saved } = await setup();
  expect(await submit(valid)).toEqual({ ok: true, data: undefined });
  expect(await saved()).toBe(1);
  expect(mailer.sent[0]).toMatchObject({ to: DEMO.emails.mill });
  expect(mailer.sent[0]!.text).toContain('Via agent: @lauramartin-demo');
});

it('answers a filled honeypot with success and saves nothing', async () => {
  const { mailer, submit, saved } = await setup();
  expect(await submit({ ...valid, website: 'https://spam.test' })).toEqual({ ok: true, data: undefined });
  expect(await saved()).toBe(0);
  expect(mailer.sent).toEqual([]);
});

it.each([
  ['a product the company has no claim on', { productId: DEMO.products.armani }],
  ['an article of another company', { companyId: DEMO.companies.denizli }],
  ['a malformed company id', { companyId: 'not-a-uuid' }],
  ['an unknown kind', { kind: 'order' }],
])('refuses %s without saving', async (_name, override) => {
  const { submit, saved } = await setup();
  expect(await submit({ ...valid, ...override })).toEqual({ ok: false, error: GENERIC });
  expect(await saved()).toBe(0);
});

it('explains a fractional quantity', async () => {
  const { submit, saved } = await setup();
  expect(await submit({ ...valid, quantityMeters: '1.5' })).toEqual({ ok: false, error: 'Quantity must be a whole number of metres from 1 to 1,000,000.' });
  expect(await saved()).toBe(0);
});
