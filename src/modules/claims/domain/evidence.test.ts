import { expect, it } from 'vitest';
import { createEvidence, sniffEvidenceType } from './evidence';

const PDF = new TextEncoder().encode('%PDF-1.7 hello');
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0]);

it.each([[PDF, 'application/pdf'], [PNG, 'image/png'], [JPG, 'image/jpeg']])('recognises the type from the bytes', (bytes, type) =>
  expect(sniffEvidenceType(bytes)).toBe(type));

it('recognises nothing in anything else, including a file that is too short to tell', () => {
  for (const bytes of [new Uint8Array(0), new Uint8Array([0x25, 0x50]), new TextEncoder().encode('<svg onload=alert(1)>'), PNG.slice(0, 7)]) {
    expect(sniffEvidenceType(bytes)).toBeNull();
  }
});

it('refuses a file whose bytes aren’t an allowed type, whatever its name', () =>
  expect(() => createEvidence({ claimId: 'c1', fileName: 'invoice.pdf', bytes: new TextEncoder().encode('<script>') }))
    .toThrow(expect.objectContaining({ code: 'evidence.type_invalid' })));

it('refuses empty and oversize files', () => {
  expect(() => createEvidence({ claimId: 'c1', fileName: 'a.pdf', bytes: new Uint8Array(0) })).toThrow(expect.objectContaining({ code: 'evidence.type_invalid' }));
  const big = new Uint8Array(10 * 1024 * 1024 + 1); big.set(PDF);
  expect(() => createEvidence({ claimId: 'c1', fileName: 'a.pdf', bytes: big })).toThrow(expect.objectContaining({ code: 'evidence.too_large' }));
  const exactly = new Uint8Array(10 * 1024 * 1024); exactly.set(PDF);
  expect(createEvidence({ claimId: 'c1', fileName: 'a.pdf', bytes: exactly }).sizeBytes).toBe(10 * 1024 * 1024);
});

it('records the type found in the bytes, not the one the name suggests', () =>
  expect(createEvidence({ claimId: 'c1', fileName: 'scan.pdf', bytes: PNG })).toMatchObject({ contentType: 'image/png', sizeBytes: PNG.length, claimId: 'c1' }));

it('cleans the file name and never uses it in the storage key', () => {
  const e = createEvidence({ claimId: 'c1', fileName: '../../etc/pass\u0000wd.pdf', bytes: PDF });
  expect(e.fileName).toBe('passwd.pdf');
  expect(e.storageKey).toBe(`evidence/c1/${e.id}`);
});

it('keeps only the last part of a path, drops direction overrides, trims, shortens and falls back', () => {
  const nameOf = (fileName: string) => createEvidence({ claimId: 'c1', fileName, bytes: PDF }).fileName;
  expect(nameOf('C:\\Users\\me\\invoice 3.pdf')).toBe('invoice 3.pdf');
  expect(nameOf('invoice\u202Efdp.exe')).toBe('invoicefdp.exe');
  expect(nameOf('  a.pdf ')).toBe('a.pdf');
  expect(nameOf(`${'x'.repeat(200)}.pdf`)).toHaveLength(120);
  expect(nameOf('')).toBe('evidence');
  expect(nameOf('dir/')).toBe('evidence');
  expect(nameOf('\u0001\u0002')).toBe('evidence');
});
