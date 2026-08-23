// A tiny static server that renders Marp decks on demand, so the presenter
// console can run against any folder of decks without `marp --server`.
//
// Rendering goes through marp-cli's own API, so the decks are byte-for-byte
// what `marp` would produce — same themes, same bespoke template, and with it
// the sync channel and hash navigation the console drives.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { marpCli } from '@marp-team/marp-cli';

const toolDir = dirname(fileURLToPath(import.meta.url));

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/html; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

/** Render one deck to HTML through marp-cli, reusing the last result until it changes. */
function createRenderer(root, themeSet) {
  const cache = new Map();
  const inFlight = new Map();

  return async function render(file) {
    const source = join(root, file);
    const { mtimeMs } = await stat(source);

    const cached = cache.get(file);
    if (cached && cached.mtimeMs === mtimeMs) return cached.html;

    // The console asks for the same deck from three windows at once; render it
    // once and let the others wait on the same promise.
    const pending = inFlight.get(file);
    if (pending) return pending;

    const job = (async () => {
      const out = join(tmpdir(), `marp-presenter-${process.pid}-${Buffer.from(file).toString('hex')}.html`);
      const argv = [source, '--html', '--allow-local-files', '--quiet', '-o', out];
      if (themeSet) argv.push('--theme-set', themeSet);

      const code = await marpCli(argv);
      if (code !== 0) throw new Error(`marp exited with code ${code} converting ${file}`);

      const html = await readFile(out, 'utf8');
      cache.set(file, { mtimeMs, html });
      return html;
    })().finally(() => inFlight.delete(file));

    inFlight.set(file, job);
    return job;
  };
}

export function createPresenterServer({ root, indexer, themeSet }) {
  const renderer = createRenderer(root, themeSet);

  const send = (res, status, body, type) => {
    res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
    res.end(body);
  };

  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = decodeURIComponent(url.pathname);

      if (path === '/' || path === '/presenter.html')
        return send(res, 200, await readFile(join(toolDir, 'presenter.html')), MIME['.html']);

      if (path === '/timing.js')
        return send(res, 200, await readFile(join(toolDir, 'timing.js')), MIME['.js']);

      if (path === '/api/decks')
        return send(res, 200, JSON.stringify({ root, decks: await indexer() }), MIME['.json']);

      if (path.startsWith('/decks/')) {
        const requested = path.slice('/decks/'.length);
        const target = resolve(root, requested);
        // Never serve outside the deck folder, however the path is spelled.
        if (target !== root && !target.startsWith(root + sep)) return send(res, 403, 'Forbidden', 'text/plain');

        const file = relative(root, target);
        if (extname(target) === '.md') return send(res, 200, await renderer(file), MIME['.html']);
        return send(res, 200, await readFile(target), MIME[extname(target)] ?? 'application/octet-stream');
      }

      send(res, 404, 'Not found', 'text/plain');
    } catch (error) {
      if (error.code === 'ENOENT') return send(res, 404, 'Not found', 'text/plain');
      console.error(error);
      send(res, 500, `Presenter error: ${error.message}`, 'text/plain');
    }
  });
}
