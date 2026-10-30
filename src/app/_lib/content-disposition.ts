// A Content-Disposition value that downloads a file under its own name. The name is whatever the uploader called the
// file, so it must not be able to break the header: a quote would end the quoted name, and a name outside Latin-1
// makes `Headers` throw. The `filename` parameter is a printable-ASCII fallback; `filename*` (RFC 5987) carries the real name.
export function attachmentDisposition(fileName: string): string {
  const name = /^\.*$/.test(fileName) ? 'evidence' : fileName.toWellFormed(); // a name of only dots means nothing to a file system
  const fallback = name.replace(/[^\x20-\x7e]|["\\%]/gu, '_');
  // encodeURIComponent leaves ' ( ) * alone, which RFC 5987 does not allow unescaped.
  const encoded = encodeURIComponent(name).replace(/['()*]/g, (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`);
  return `attachment; filename="${fallback}"; filename*=UTF-8''${encoded}`;
}
