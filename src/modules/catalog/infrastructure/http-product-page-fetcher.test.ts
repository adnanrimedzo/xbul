import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHttpProductPageFetcher } from './http-product-page-fetcher';

let server: Server;
let base: string;
const seen: string[] = [];

beforeAll(async () => {
  server = createServer((req, res) => {
    const path = req.url ?? '/';
    seen.push(path);
    const hop = /^\/(slow-)?hop\/(\d+)$/.exec(path);
    if (hop) {
      const next = Number(hop[2]) > 0 ? `/${hop[1] ?? ''}hop/${Number(hop[2]) - 1}` : '/ok';
      setTimeout(() => res.writeHead(302, { location: next }).end(), hop[1] ? 150 : 0);
    } else if (path === '/redir') {
      res.writeHead(302, { location: '/ok' }).end();
    } else if (path === '/ok') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<html><head><title>Blazer</title></head></html>');
    } else if (path === '/json') {
      res.writeHead(200, { 'content-type': 'application/json' }).end('{}');
    } else if (path === '/big') {
      res.writeHead(200, { 'content-type': 'text/html' }).end(`<html>${'a'.repeat(3_000_000)}</html>`);
    } else if (path !== '/hang') {
      res.writeHead(404, { 'content-type': 'text/html' }).end('nope');
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterEach(() => vi.restoreAllMocks());

afterAll(async () => {
  server.closeAllConnections();
  await new Promise((resolve) => server.close(resolve));
});

describe('createHttpProductPageFetcher', () => {
  const local = (opts: { timeoutMs?: number } = {}) => createHttpProductPageFetcher({ timeoutMs: 2000, maxBytes: 2_000_000, allowPrivateHosts: true, ...opts });

  it('returns html, rejects non-2xx, non-html and oversize bodies', async () => {
    expect(await local().fetchHtml(`${base}/ok`)).toContain('<title>');
    await expect(local().fetchHtml(`${base}/404`)).rejects.toThrow();
    await expect(local().fetchHtml(`${base}/json`)).rejects.toThrow(/html/i);
    await expect(local().fetchHtml(`${base}/big`)).rejects.toThrow(/too large/i);
  });

  it('follows a redirect hop, up to 5 hops', async () => {
    expect(await local().fetchHtml(`${base}/redir`)).toContain('<title>');
    expect(await local().fetchHtml(`${base}/hop/4`)).toContain('<title>'); // 5 redirects
    await expect(local().fetchHtml(`${base}/hop/5`)).rejects.toThrow(/too many redirects/i); // 6 redirects
  });

  it('times out across all hops, not per hop', async () => {
    await expect(local({ timeoutMs: 500 }).fetchHtml(`${base}/hang`)).rejects.toThrow(/timeout/i);
    // each hop takes 150ms, four of them take longer than the 500ms budget
    await expect(local({ timeoutMs: 500 }).fetchHtml(`${base}/slow-hop/3`)).rejects.toThrow(/timeout/i);
  });

  it('refuses private hosts without connecting', async () => {
    seen.length = 0;
    await expect(createHttpProductPageFetcher({ timeoutMs: 2000 }).fetchHtml(`${base}/ok`)).rejects.toMatchObject({ code: 'product.url_not_public' });
    expect(seen).toEqual([]);
  });

  it('refuses a redirect to a private host', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(null, { status: 302, headers: { location: 'http://169.254.169.254/latest' } }));
    await expect(createHttpProductPageFetcher().fetchHtml('https://shop.example.com/p1')).rejects.toMatchObject({ code: 'product.url_not_public' });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
  });
});
