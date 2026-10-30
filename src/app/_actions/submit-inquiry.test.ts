import { createHash } from 'node:crypto';
import { beforeEach, expect, it, vi } from 'vitest';
import { createClaimRepository } from '@/modules/claims';
import { createUserDirectory } from '@/modules/identity';
import { createInquiryRepository } from '@/modules/inquiry';
import { createSupplierRepositories } from '@/modules/supplier';
import { DEMO } from '@/server/demo-ids';
import { seedDemo } from '@/server/seed-demo';
import { createTestDb } from '@/shared/db/testing';
import { createRecordingMailer } from '@/shared/mail/testing';
import { submitInquiryAction } from './submit-inquiry';

const container = vi.hoisted(() => ({ current: null as unknown }));
vi.mock('@/server/container', () => ({ getContainer: async () => container.current }));
const request = vi.hoisted(() => ({ headers: new Headers() }));
vi.mock('next/headers', () => ({ headers: async () => request.headers }));
beforeEach(() => {
  request.headers = new Headers();
});

const GENERIC = 'Something went wrong. Please try again.';
const SECRET = 's'.repeat(32);
const valid = {
  companyId: DEMO.companies.indigo,
  productId: DEMO.products.guess,
  articleId: DEMO.articles.indigo60219,
  kind: 'swatch',
  buyerName: 'Ana Buyer',
  buyerEmail: 'ana@brand.test',
  quantityMeters: '1000',
};

async function setup() {
  const db = await createTestDb();
  await seedDemo(db);
  const inquiries = createInquiryRepository(db);
  const mailer = createRecordingMailer();
  // Every argument the action hands the inquiry repository, to prove what reaches storage.
  const repoCalls: unknown[] = [];
  const recorded = Object.fromEntries(
    Object.entries(inquiries).map(([name, fn]) => [name, (...args: unknown[]) => (repoCalls.push(args), (fn as (...a: unknown[]) => unknown)(...args))]),
  );
  container.current = {
    inquiries: recorded,
    mailer,
    claims: createClaimRepository(db),
    ...createSupplierRepositories(db),
    users: createUserDirectory(db),
    config: { baseUrl: 'http://localhost:3100', authSecret: SECRET },
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
  return { mailer, submit, saved, repoCalls };
}

it('saves and emails the mill owner', async () => {
  const { mailer, submit, saved } = await setup();
  expect(await submit(valid)).toEqual({ ok: true, data: undefined });
  expect(await saved()).toBe(1);
  expect(mailer.sent[0]).toMatchObject({ to: DEMO.emails.mill });
});

it('ignores a leftover via field from an old page', async () => {
  const { mailer, submit, repoCalls } = await setup();
  expect(await submit({ ...valid, via: 'lauramartin-demo' })).toEqual({ ok: true, data: undefined });
  expect(repoCalls.flat()).toContainEqual(expect.objectContaining({ buyerEmail: 'ana@brand.test', viaAgentHandle: null }));
  expect(mailer.sent[0]!.text).not.toContain('Via agent');
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

it.each([
  ['cf-connecting-ip over x-forwarded-for', { 'cf-connecting-ip': '203.0.113.7', 'x-forwarded-for': '198.51.100.4' }, '203.0.113.7'],
  ['the first x-forwarded-for hop', { 'x-forwarded-for': '198.51.100.4, 10.0.0.1' }, '198.51.100.4'],
])('stores only a hash of the client IP, taking %s', async (_name, headers, ip) => {
  const { submit, repoCalls } = await setup();
  request.headers = new Headers(headers);
  expect(await submit(valid)).toEqual({ ok: true, data: undefined });
  const hash = createHash('sha256').update(`${ip}:${SECRET}`).digest('hex');
  expect(repoCalls.flat()).toContainEqual(expect.objectContaining({ buyerEmail: 'ana@brand.test', clientIpHash: hash }));
  const sent = JSON.stringify(repoCalls);
  for (const raw of ['203.0.113.7', '198.51.100.4', '10.0.0.1']) expect(sent).not.toContain(raw);
});

it('stores no IP hash when the request carries no client IP', async () => {
  const { submit, repoCalls } = await setup();
  expect(await submit(valid)).toEqual({ ok: true, data: undefined });
  expect(repoCalls.flat()).toContainEqual(expect.objectContaining({ buyerEmail: 'ana@brand.test', clientIpHash: null }));
});
