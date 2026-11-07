import { describe, expect, it } from 'vitest';
import type { CheckSubject } from '../domain/checks';
import { createGleifChecker, createViesChecker } from './registry-checkers';

const subject = (o: Partial<CheckSubject> = {}): CheckSubject => ({
  country: 'DE', legalName: 'Muster Textil GmbH', taxId: 'DE123456789', mersisNumber: null, lei: null,
  naceCodes: [], website: null, ownerEmail: null, ...o,
});

function fake(respond: () => Response | Promise<Response>) {
  const calls: { url: string; init?: RequestInit }[] = [];
  const fetchFn = (async (url: string, init?: RequestInit) => { calls.push({ url: String(url), init }); return respond(); }) as unknown as typeof fetch;
  return { calls, fetchFn };
}
const json = (body: unknown, status = 200) => () => Response.json(body, { status });

describe('VIES', () => {
  it('calls the member-state path without the prefix and passes on a name match', async () => {
    const f = fake(json({ isValid: true, userError: 'VALID', name: 'MUSTER TEXTIL GMBH', address: 'x' }));
    const r = await createViesChecker(f.fetchFn)(subject());
    expect(f.calls[0]!.url).toBe('https://ec.europa.eu/taxation_customs/vies/rest-api/ms/DE/vat/123456789');
    expect(f.calls[0]!.init?.signal).toBeInstanceOf(AbortSignal);
    expect(f.calls[0]!.init?.headers).toEqual({ accept: 'application/json' });
    expect(r).toMatchObject({ source: 'eu_vies', outcome: 'pass', summary: 'VIES: valid, name matches' });
  });
  it('uses EL for Greece', async () => {
    const f = fake(json({ isValid: true, name: 'A B' }));
    await createViesChecker(f.fetchFn)(subject({ country: 'GR', taxId: 'EL123456789' }));
    expect(f.calls[0]!.url).toContain('/ms/EL/vat/123456789');
  });
  it('passes when the member state withholds the name', async () => {
    const r = await createViesChecker(fake(json({ isValid: true, name: '---' })).fetchFn)(subject());
    expect(r).toMatchObject({ outcome: 'pass', summary: "VIES: valid, the member state doesn't share the name" });
  });
  it('is unknown for a valid number with another name', async () => {
    const r = await createViesChecker(fake(json({ isValid: true, name: 'OTHER AG' })).fetchFn)(subject());
    expect(r?.outcome).toBe('unknown');
  });
  it('fails on INVALID', async () => {
    const r = await createViesChecker(fake(json({ isValid: false, userError: 'INVALID' })).fetchFn)(subject());
    expect(r?.outcome).toBe('fail');
  });
  it.each([
    ['MS_UNAVAILABLE', json({ isValid: false, userError: 'MS_UNAVAILABLE' })],
    ['a 500', json({ error: 'x' }, 500)],
    ['junk', () => new Response('<html>oops</html>', { status: 200 })],
    ['a timeout', () => { throw new DOMException('timed out', 'AbortError'); }],
  ])('is unknown on %s', async (_n, respond) => {
    const r = await createViesChecker(fake(respond).fetchFn)(subject());
    expect(r).toMatchObject({ source: 'eu_vies', outcome: 'unknown' });
  });
  it('does not apply to TR, other countries or a missing tax number', async () => {
    const f = fake(json({}));
    const check = createViesChecker(f.fetchFn);
    expect(await check(subject({ country: 'TR', taxId: '1234567890' }))).toBeNull();
    expect(await check(subject({ country: 'SA', taxId: '300000000000003' }))).toBeNull();
    expect(await check(subject({ taxId: null }))).toBeNull();
    expect(f.calls).toHaveLength(0);
  });
});

const LEI = '5493001KJTIIGC8Y1R12';
const record = (o: { name?: string; status?: string; reg?: string; country?: string; lei?: string } = {}) => ({
  id: o.lei ?? LEI,
  attributes: {
    lei: o.lei ?? LEI,
    entity: { legalName: { name: o.name ?? 'Muster Textil GmbH' }, status: o.status ?? 'ACTIVE', legalAddress: { country: o.country ?? 'DE' } },
    registration: { status: o.reg ?? 'ISSUED' },
  },
});

describe('GLEIF', () => {
  it('passes for an active, issued LEI with the same name and country', async () => {
    const f = fake(json({ data: record() }));
    const r = await createGleifChecker(f.fetchFn)(subject({ lei: LEI }));
    expect(f.calls[0]!.url).toBe(`https://api.gleif.org/api/v1/lei-records/${LEI}`);
    expect(r).toMatchObject({ source: 'gleif', outcome: 'pass' });
    expect(r!.summary).toContain(LEI);
  });
  it('fails on 404', async () => {
    const r = await createGleifChecker(fake(json({}, 404)).fetchFn)(subject({ lei: LEI }));
    expect(r?.outcome).toBe('fail');
  });
  it('is unknown for a lapsed registration, another name or another country', async () => {
    for (const rec of [record({ reg: 'LAPSED' }), record({ name: 'Other AG' }), record({ country: 'FR' })]) {
      expect((await createGleifChecker(fake(json({ data: rec })).fetchFn)(subject({ lei: LEI })))?.outcome).toBe('unknown');
    }
  });
  it('is unknown when the registry errors or returns junk', async () => {
    expect((await createGleifChecker(fake(json({}, 500)).fetchFn)(subject({ lei: LEI })))?.outcome).toBe('unknown');
    expect((await createGleifChecker(fake(() => new Response('nope')).fetchFn)(subject({ lei: LEI })))?.outcome).toBe('unknown');
  });
  it('searches by name and country without an LEI', async () => {
    const f = fake(json({ data: [record({ name: 'Other AG', lei: 'A'.repeat(20) }), record({ country: 'TR', lei: LEI })] }));
    const r = await createGleifChecker(f.fetchFn)(subject({ country: 'TR', legalName: 'Muster Textil A.Ş.' }));
    expect(f.calls[0]!.url).toBe(
      'https://api.gleif.org/api/v1/lei-records?filter[fulltext]=Muster%20Textil%20A.%C5%9E.&filter[entity.legalAddress.country]=TR&page[size]=5',
    );
    expect(r).toMatchObject({ outcome: 'pass' });
    expect(r!.summary).toContain(LEI);
  });
  it('is not applicable when the search finds nothing, fails, or there is no name', async () => {
    expect(await createGleifChecker(fake(json({ data: [record({ name: 'Other AG' })] })).fetchFn)(subject())).toBeNull();
    expect(await createGleifChecker(fake(json({}, 500)).fetchFn)(subject())).toBeNull();
    expect(await createGleifChecker(() => Promise.reject(new TypeError('network')))(subject())).toBeNull();
    const f = fake(json({}));
    expect(await createGleifChecker(f.fetchFn)(subject({ legalName: null }))).toBeNull();
    expect(f.calls).toHaveLength(0);
  });
});
