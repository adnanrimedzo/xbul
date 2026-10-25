import { describe, expect, it } from 'vitest';
import { assertPublicHttpUrl, brandFromHost, canonicalizeProductUrl, parseHttpUrl } from './product-url';

const notPublic = expect.objectContaining({ code: 'product.url_not_public' });
const invalid = expect.objectContaining({ code: 'product.url_invalid' });

describe('canonicalizeProductUrl', () => {
  it.each([
    ['https://www.guess.eu/en/blazer-W5RN12?utm_source=wa&color=blue#top', 'https://guess.eu/en/blazer-W5RN12?color=blue'],
    ['http://ZARA.com/tr/jacket-p0123.html/', 'https://zara.com/tr/jacket-p0123.html'],
    ['https://liujo.com/it/x?b=2&a=1&gclid=z&fbclid=y&srsltid=q', 'https://liujo.com/it/x?a=1&b=2'],
    ['https://mango.com/', 'https://mango.com/'],
  ])('canonicalizes %s', (raw, canon) => expect(canonicalizeProductUrl(raw)).toBe(canon));

  it.each(['ftp://x.com/a', 'not a url', 'javascript:alert(1)'])('rejects %s', (raw) =>
    expect(() => canonicalizeProductUrl(raw)).toThrow(invalid));

  it('strips _ga, mc_* and ref too', () =>
    expect(canonicalizeProductUrl('https://a.com/p?mc_eid=1&_ga=2&ref=3&UTM_x=4&size=m')).toBe('https://a.com/p?size=m'));
});

describe('parseHttpUrl', () => {
  it('trims and returns a URL for http and https', () => {
    expect(parseHttpUrl('  http://a.com/x ').href).toBe('http://a.com/x');
    expect(parseHttpUrl('https://a.com').protocol).toBe('https:');
  });
  it.each(['ftp://x.com/a', 'nope', ''])('rejects %j', (raw) => expect(() => parseHttpUrl(raw)).toThrow(invalid));
});

describe('assertPublicHttpUrl', () => {
  const block = (raw: string) => expect(() => assertPublicHttpUrl(new URL(raw), { allowPrivateHosts: false })).toThrow(notPublic);
  const pass = (raw: string) => expect(() => assertPublicHttpUrl(new URL(raw), { allowPrivateHosts: false })).not.toThrow();

  it.each([
    'http://localhost:3000/x', 'http://127.0.0.1/', 'http://10.1.2.3/', 'http://172.20.0.1/', 'http://192.168.0.5/',
    'http://169.254.169.254/latest', 'http://[::1]/', 'http://[fd00::1]/', 'http://printer.local/', 'http://0.0.0.0/',
  ])('blocks private host %s', block);

  it('allows public hosts, and private ones when allowed', () => {
    expect(() => assertPublicHttpUrl(new URL('https://guess.eu/x'), { allowPrivateHosts: false })).not.toThrow();
    expect(() => assertPublicHttpUrl(new URL('http://localhost:4010/x'), { allowPrivateHosts: true })).not.toThrow();
  });

  it('blocks a decimal-integer host, which URL normalises to 127.0.0.1', () => block('http://2130706433/'));
  it('blocks IPv4-mapped IPv6 loopback in both notations', () => {
    block('http://[::ffff:127.0.0.1]/');
    block('http://[::ffff:7f00:1]/');
  });
  it('blocks trailing-dot hostnames', () => {
    block('http://localhost./');
    block('http://printer.local./');
    block('http://svc.internal/');
  });
  it('blocks link-local and ULA IPv6 ranges', () => {
    block('http://[fe80::1]/');
    block('http://[fc00::1]/');
    block('http://[febf::1]/');
  });
  it('blocks the edges of the private IPv4 ranges and allows their neighbours', () => {
    block('http://172.16.0.1/');
    block('http://172.31.255.255/');
    block('http://0.1.2.3/');
    pass('http://172.15.0.1/');
    pass('http://172.32.0.1/');
    pass('http://11.0.0.1/');
    pass('http://169.255.0.1/');
    pass('http://192.169.0.1/');
    pass('http://8.8.8.8/');
  });
  it('allows public IPv6 and IPv4-mapped public addresses', () => {
    pass('http://[2606:4700::1111]/');
    pass('http://[::ffff:8.8.8.8]/');
  });
  it('does not mistake look-alike public hostnames for private ones', () => {
    pass('https://localhost.example.com/');
    pass('https://notlocal.com/');
    pass('https://10.example.com/');
  });
});

describe('brandFromHost', () => {
  it.each([['guess.eu', 'GUESS'], ['www.liujo.com', 'LIUJO'], ['shop.mango.com', 'MANGO'], ['zara.co.uk', 'ZARA'], ['lcwaikiki.com.tr', 'LCWAIKIKI']])(
    'brandFromHost(%s)', (host, brand) => expect(brandFromHost(host)).toBe(brand));
});
