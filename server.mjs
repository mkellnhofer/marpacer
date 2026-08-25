// A tiny static server for the presenter console and the decks it presents.
//
// Both pages it serves — presenter.html and deck.html — are static files that
// fetch what they need over HTTP: the deck index, and a deck's slides and
// stylesheet. Rendering happens in render.mjs, on demand and cached by mtime.
//
// The page around the slides being ours is what keeps the deck window free of
// any on-screen controls.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

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

/** The two halves of a rendered deck, each on its own endpoint. */
const API_PARTS = [
  ['/api/slides/', 'html', MIME['.html']],
  ['/api/style/', 'css', MIME['.css']],
];

export function createPresenterServer({ deckIndex, renderer }) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = decodeURIComponent(url.pathname);

      if (path === '/' || path === '/presenter.html')
        return send(res, 200, await readFile(getToolFile('presenter.html')), MIME['.html']);

      if (path === '/timing.js')
        return send(res, 200, await readFile(getToolFile('timing.js')), MIME['.js']);

      if (path === '/api/decks')
        return send(
          res,
          200,
          JSON.stringify({ root: deckIndex.root, decks: await deckIndex.getDecks() }),
          MIME['.json']
        );

      // A deck's slides and its stylesheet, each addressed by the deck's own path.
      for (const [prefix, part, type] of API_PARTS) {
        if (!path.startsWith(prefix)) continue;

        const file = deckIndex.getFile(path.slice(prefix.length));
        if (!file) return send(res, 403, 'Forbidden', 'text/plain');

        const rendered = await renderer(file);
        return send(res, 200, rendered[part], type);
      }

      if (path.startsWith('/decks/')) {
        const file = deckIndex.getFile(path.slice('/decks/'.length));
        if (!file) return send(res, 403, 'Forbidden', 'text/plain');

        // A deck's URL serves the deck window itself — a static page that then
        // asks for the slides at that same path. `stat` first, so a deck that
        // does not exist is a 404 here rather than a puzzle in the browser.
        if (extname(file) === '.md') {
          await stat(file);
          return send(res, 200, await readFile(getToolFile('deck.html')), MIME['.html']);
        }

        return send(
          res,
          200,
          await readFile(target),
          MIME[extname(target)] ?? 'application/octet-stream'
        );
      }

      send(res, 404, 'Not found', 'text/plain');
    } catch (error) {
      if (error.code === 'ENOENT') return send(res, 404, 'Not found', 'text/plain');
      console.error(error);
      send(res, 500, `Presenter error: ${error.message}`, 'text/plain');
    }
  });
}

function getToolFile(path) {
  return join(toolDir, path);
}

function send(res, status, body, type) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}
