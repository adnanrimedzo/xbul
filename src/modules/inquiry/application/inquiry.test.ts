import { expect, it, vi } from 'vitest';
import { createProduct, createProductRepository } from '@/modules/catalog';
import { createCompany, createSupplierRepositories } from '@/modules/supplier';
import { createTestDb } from '@/shared/db/testing';
import { createRecordingMailer } from '@/shared/mail/testing';
import { createInquiryRepository } from '../infrastructure/drizzle-inquiry-repository';
import { countNewInquiries, markInquiryAnswered } from './manage-inquiries';
import { submitInquiry } from './submit-inquiry';

async function setup({ agents, ownerEmail, now }: { agents: string[]; ownerEmail: string | null; now?: () => Date }) {
  const db = await createTestDb();
  const { companies } = createSupplierRepositories(db);
  const mill = async (name: string, owner: string) => {
    const c = createCompany({ name, city: 'Istanbul', country: 'TR', ownerUserId: owner });
    await companies.save(c);
    return c.id;
  };
  const p = createProduct({ canonicalUrl: 'https://example.com/guess', sourceUrl: 'https://example.com/guess', brand: 'GUESS', name: 'Cropped Denim Blazer', imageUrl: null, composition: null });
  await createProductRepository(db).save(p);
  const ids = { indigo: await mill('Indigo Mill', 'u1'), denizli: await mill('Denizli Indigo', 'u2'), guess: p.id };
  const mailer = createRecordingMailer();
  const deps = {
    inquiries: createInquiryRepository(db),
    mailer,
    agentHandleExists: async (h: string) => agents.includes(h),
    companyOwnerEmail: async () => ownerEmail,
    baseUrl: 'http://localhost:3000',
    now,
  };
  return { deps, ids, mailer };
}

it('saves, credits a real agent and emails the mill owner', async () => {
  const { deps, ids, mailer } = await setup({ agents: ['lauramartin-x7k2'], ownerEmail: 'mill@example.test' });
  const inq = await submitInquiry(deps, { companyId: ids.indigo, productId: ids.guess, articleId: null, kind: 'swatch', buyerName: 'Ana Buyer', buyerEmail: 'ana@brand.test', buyerCompany: 'Brand Co', quantityMeters: 1000, message: 'Need it by May', viaAgentHandle: 'lauramartin-x7k2' });
  expect(inq.viaAgentHandle).toBe('lauramartin-x7k2');
  expect(await deps.inquiries.findById(inq.id)).toEqual(inq);
  expect(mailer.sent).toHaveLength(1);
  // Reply-To is the buyer, so the mill answers them straight from the notification.
  expect(mailer.sent[0]).toMatchObject({ to: 'mill@example.test', subject: 'New swatch request from Brand Co', replyTo: 'ana@brand.test' });
  expect(mailer.sent[0].text).toBe([
    'Name: Ana Buyer', 'Email: ana@brand.test', 'Company: Brand Co', 'Quantity: 1000 m', 'Message: Need it by May', 'Via agent: @lauramartin-x7k2',
    '', 'Open your requests: http://localhost:3000/requests',
  ].join('\n'));
});

it('omits absent fields from the email and falls back to the buyer name in the subject', async () => {
  const { deps, ids, mailer } = await setup({ agents: [], ownerEmail: 'mill@example.test' });
  await submitInquiry(deps, { companyId: ids.indigo, productId: ids.guess, articleId: null, kind: 'quote', buyerName: 'Ana Buyer', buyerEmail: 'ana@brand.test' });
  expect(mailer.sent[0].subject).toBe('New quote request from Ana Buyer');
  expect(mailer.sent[0].text).toBe(['Name: Ana Buyer', 'Email: ana@brand.test', '', 'Open your requests: http://localhost:3000/requests'].join('\n'));
});

it('saves the inquiry but sends nothing when the mill has no owner email', async () => {
  const { deps, ids, mailer } = await setup({ agents: [], ownerEmail: null });
  const inq = await submitInquiry(deps, { companyId: ids.indigo, productId: ids.guess, articleId: null, kind: 'quote', buyerName: 'B', buyerEmail: 'b@x.test' });
  expect(await deps.inquiries.findById(inq.id)).toEqual(inq);
  expect(mailer.sent).toEqual([]);
});

it.each([
  ['the mailer', { mailer: { send: async () => { throw new Error('resend: boom'); } } }],
  ['the owner email lookup', { companyOwnerEmail: async () => { throw new Error('db: boom'); } }],
])('still returns the saved inquiry when %s fails', async (_name, broken) => {
  const log = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const { deps, ids } = await setup({ agents: [], ownerEmail: 'mill@example.test' });
    const inq = await submitInquiry({ ...deps, ...broken }, { companyId: ids.indigo, productId: ids.guess, articleId: null, kind: 'quote', buyerName: 'B', buyerEmail: 'b@x.test' });
    expect(await deps.inquiries.findById(inq.id)).toEqual(inq);
    expect(log).toHaveBeenCalledTimes(1);
    expect(log.mock.calls[0].join(' ')).toContain(inq.id);
  } finally {
    log.mockRestore();
  }
});

it('drops unknown or malformed agent handles', async () => {
  const { deps, ids, mailer } = await setup({ agents: [], ownerEmail: 'mill@example.test' });
  for (const via of ['ghost-0000', '<script>alert(1)</script>']) {
    const inq = await submitInquiry(deps, { companyId: ids.indigo, productId: ids.guess, articleId: null, kind: 'quote', buyerName: 'B', buyerEmail: `b${via.length}@x.test`, viaAgentHandle: via });
    expect(inq.viaAgentHandle).toBeNull();
  }
  expect(mailer.sent.every(m => !m.text.includes('Via agent'))).toBe(true);
});

it('never looks up a malformed handle', async () => {
  const { deps, ids } = await setup({ agents: [], ownerEmail: null });
  const strict = { ...deps, agentHandleExists: async (h: string) => {
    if (!/^[a-z0-9-]{3,40}$/.test(h)) throw new Error(`lookup reached with ${h}`);
    return false;
  } };
  for (const via of ['<script>alert(1)</script>', 'AB', 'a'.repeat(41), 'under_score', '', "x'; drop table--"]) {
    const inq = await submitInquiry(strict, { companyId: ids.indigo, productId: ids.guess, articleId: null, kind: 'quote', buyerName: 'B', buyerEmail: `b${via.length}@x.test`, viaAgentHandle: via });
    expect(inq.viaAgentHandle).toBeNull();
  }
});

it('rate-limits 5 per buyer email per company per 24h', async () => {
  let now = new Date('2026-10-25T10:00:00Z'); const { deps, ids } = await setup({ agents: [], ownerEmail: null, now: () => now });
  const send = () => submitInquiry(deps, { companyId: ids.indigo, productId: ids.guess, articleId: null, kind: 'quote', buyerName: 'B', buyerEmail: 'spam@x.test' });
  for (let i = 0; i < 5; i++) await send();
  await expect(send()).rejects.toMatchObject({ code: 'inquiry.rate_limited' });
  expect(await countNewInquiries(deps, ids.indigo)).toBe(5);
  now = new Date('2026-10-26T11:00:00Z'); await expect(send()).resolves.toBeTruthy();
});

it('rate-limits per company and per normalized email, not globally', async () => {
  const { deps, ids } = await setup({ agents: [], ownerEmail: null, now: () => new Date('2026-10-25T10:00:00Z') });
  const send = (companyId: string, buyerEmail: string) => submitInquiry(deps, { companyId, productId: ids.guess, articleId: null, kind: 'quote', buyerName: 'B', buyerEmail });
  for (let i = 0; i < 5; i++) await send(ids.indigo, i % 2 ? ' SPAM@x.test ' : 'spam@x.test');
  await expect(send(ids.indigo, 'Spam@X.test')).rejects.toMatchObject({ code: 'inquiry.rate_limited' });
  await expect(send(ids.denizli, 'spam@x.test')).resolves.toBeTruthy();
  await expect(send(ids.indigo, 'other@x.test')).resolves.toBeTruthy();
});

it('does not save or email an invalid inquiry', async () => {
  const { deps, ids, mailer } = await setup({ agents: [], ownerEmail: 'mill@example.test', now: () => new Date('2026-10-25T10:00:00Z') });
  await expect(submitInquiry(deps, { companyId: ids.indigo, productId: null, articleId: null, kind: 'quote', buyerName: 'B', buyerEmail: 'b@x.test' }))
    .rejects.toMatchObject({ code: 'inquiry.target_required' });
  expect(await deps.inquiries.countNew(ids.indigo)).toBe(0);
  expect(mailer.sent).toEqual([]);
});

it('only the owning company marks answered', async () => {
  const { deps, ids } = await setup({ agents: [], ownerEmail: null });
  const inq = await submitInquiry(deps, { companyId: ids.indigo, productId: ids.guess, articleId: null, kind: 'quote', buyerName: 'B', buyerEmail: 'b@x.test' });
  expect(await countNewInquiries(deps, ids.indigo)).toBe(1);
  await expect(markInquiryAnswered(deps, { companyId: ids.denizli, inquiryId: inq.id })).rejects.toMatchObject({ code: 'auth.forbidden' });
  expect(await countNewInquiries(deps, ids.indigo)).toBe(1);
  expect((await markInquiryAnswered(deps, { companyId: ids.indigo, inquiryId: inq.id })).status).toBe('answered');
  expect(await countNewInquiries(deps, ids.indigo)).toBe(0);
});

it('rejects marking an unknown inquiry', async () => {
  const { deps, ids } = await setup({ agents: [], ownerEmail: null });
  await expect(markInquiryAnswered(deps, { companyId: ids.indigo, inquiryId: crypto.randomUUID() })).rejects.toMatchObject({ code: 'inquiry.not_found' });
});
