import type { ProductPageFetcher } from '../application/ports';
import { assertPublicHttpUrl, parseHttpUrl } from '../domain/product-url';

const MAX_REDIRECTS = 5;
const HEADERS = {
  'user-agent': 'Mozilla/5.0 (compatible; xbul-bot/1.0; +https://xbul.ai/bot)',
  accept: 'text/html',
  'accept-language': 'en',
};

export function createHttpProductPageFetcher(opts: { timeoutMs?: number; maxBytes?: number; allowPrivateHosts?: boolean } = {}): ProductPageFetcher {
  const { timeoutMs = 8000, maxBytes = 2_000_000, allowPrivateHosts = false } = opts;

  return {
    async fetchHtml(startUrl) {
      const signal = AbortSignal.timeout(timeoutMs); // one budget for every hop
      let url = parseHttpUrl(startUrl);
      for (let redirects = 0; ; redirects++) {
        assertPublicHttpUrl(url, { allowPrivateHosts }); // every hop, so a redirect cannot reach a private host
        const res = await fetch(url, { redirect: 'manual', signal, headers: HEADERS });

        const location = res.headers.get('location');
        if (res.status >= 300 && res.status < 400 && location) {
          await res.body?.cancel();
          if (redirects === MAX_REDIRECTS) throw new Error('too many redirects');
          url = parseHttpUrl(new URL(location, url).href);
          continue;
        }
        if (!res.ok) {
          await res.body?.cancel();
          throw new Error(`HTTP ${res.status}`);
        }
        const type = res.headers.get('content-type') ?? '';
        if (!/html/i.test(type) || !res.body) {
          await res.body?.cancel();
          throw new Error(`not html (${type || 'no content-type'})`);
        }

        // ponytail: decodes as UTF-8 only, add charset sniffing if a brand serves legacy encodings
        const decoder = new TextDecoder();
        const reader = res.body.getReader();
        let html = '';
        let bytes = 0;
        for (;;) {
          const { done, value } = await reader.read();
          if (done) return html + decoder.decode();
          bytes += value.byteLength;
          if (bytes > maxBytes) {
            await reader.cancel();
            throw new Error('response too large');
          }
          html += decoder.decode(value, { stream: true });
        }
      }
    },
  };
}
