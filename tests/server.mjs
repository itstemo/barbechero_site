/**
 * A static file server for `dist/`, used only by the Playwright suite.
 *
 * `astro preview` would be the obvious choice, but in Astro 7.2 it always
 * detaches into a background daemon and the foreground process exits
 * immediately — Playwright reads that as "the web server died" and aborts the
 * run before the first test. Forty lines of `http` avoid both that and a
 * dependency, and serving the directory directly is a closer match to GitHub
 * Pages than a dev server would be anyway.
 */
import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';

const ROOT = path.resolve('dist');
const PORT = Number(process.env.PORT ?? 4321);

const TYPES = new Map(
  Object.entries({
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.xml': 'application/xml; charset=utf-8',
    '.txt': 'text/plain; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
  }),
);

/** Resolve a URL path to a file inside dist/, or null. */
async function resolveFile(urlPath) {
  const decoded = decodeURIComponent(urlPath.split('?')[0]);
  const candidate = path.resolve(ROOT, `.${decoded}`);
  /* Never serve outside dist/, whatever the request says. */
  if (candidate !== ROOT && !candidate.startsWith(ROOT + path.sep)) return null;

  try {
    const info = await stat(candidate);
    if (info.isDirectory()) {
      const index = path.join(candidate, 'index.html');
      await stat(index);
      return index;
    }
    return candidate;
  } catch {
    return null;
  }
}

const server = http.createServer(async (request, response) => {
  const file = await resolveFile(request.url ?? '/');
  if (!file) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }
  response.writeHead(200, {
    'Content-Type': TYPES.get(path.extname(file).toLowerCase()) ?? 'application/octet-stream',
    'Cache-Control': 'no-store',
  });
  createReadStream(file).pipe(response);
});

server.listen(PORT, '127.0.0.1', () => {
  process.stdout.write(`serving dist/ on http://127.0.0.1:${PORT}\n`);
});
