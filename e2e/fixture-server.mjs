// Serves e2e/fixtures/*.html on :4010 as stand-in brand pages. /blocked.html answers 403 like a bot wall.
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';

const fixtures = new URL('./fixtures/', import.meta.url);

createServer(async (req, res) => {
  const { pathname } = new URL(req.url ?? '/', 'http://localhost');
  if (pathname === '/blocked.html') return res.writeHead(403, { 'content-type': 'text/plain' }).end('Forbidden');
  if (!/^\/[\w-]+\.html$/.test(pathname)) return res.writeHead(404).end();
  try {
    const html = await readFile(new URL(`.${pathname}`, fixtures));
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end(html);
  } catch {
    res.writeHead(404).end();
  }
}).listen(4010);
