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
import { createRequire } from 'node:module';
import { dirname, extname, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Everything the browser may load lives under web/, and everything under web/
// is meant for the browser — so the whole folder is served, and a request can
// name any file in it without the server having to be told about it first.
// Nothing outside it is reachable: see getWebFile.
const webDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'web');

// Browser dependencies, resolved out of node_modules once at startup and
// served from here rather than a CDN, so no network connection is needed.
//
// Swap to `vue.esm-browser.js` while working on the components — it explains
// template and prop mistakes that the production build fails silently on.
const VENDOR_MODULES = {
  '/vendor/vue.js': createRequire(import.meta.url).resolve('vue/dist/vue.esm-browser.prod.js'),
};

const MIME = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
};

export function createPresenterServer({ deckIndex, renderer }) {
  return createServer(async (req, res) => {
    try {
      const url = new URL(req.url, 'http://localhost');
      const path = decodeURIComponent(url.pathname);

      if (path === '/')
        return await sendFile(res, join(webDir, 'presenter.html'), MIME['.html']);

      if (VENDOR_MODULES[path])
        return await sendFile(res, VENDOR_MODULES[path], MIME['.js']);

      if (path === '/api/decks')
        return sendJson(res, { root: deckIndex.root, decks: await deckIndex.getDecks() });

      if (path.startsWith('/api/slides/')) {
        const file = deckIndex.getFile(path.slice('/api/slides/'.length));
        if (!file) return send403(res);

        const rendered = await renderer(file);
        return sendText(res, rendered.html, MIME['.html']);
      }

      if (path.startsWith('/api/style/')) {
        const file = deckIndex.getFile(path.slice('/api/style/'.length));
        if (!file) return send403(res);

        const rendered = await renderer(file);
        return sendText(res, rendered.css, MIME['.css']);
      }

      if (path.startsWith('/decks/')) {
        const file = deckIndex.getFile(path.slice('/decks/'.length));
        if (!file) return send403(res);

        // A deck's URL serves the deck window itself — a static page that then
        // asks for the slides at that same path. `stat` first, so a deck that
        // does not exist is a 404 here rather than a puzzle in the browser.
        if (extname(file) === '.md') {
          await stat(file);
          return await sendFile(res, join(webDir, 'deck.html'), MIME['.html']);
        }

        return await sendFile(res, file, MIME[extname(file)]);
      }

      // Last: anything else may name a file under web/. The routes above win,
      // so a deck or an API path is never shadowed by a file of ours.
      const webFile = getWebFile(path);
      if (webFile) return await sendFile(res, webFile, MIME[extname(webFile)]);

      send404(res);
    } catch (error) {
      if (error.code === 'ENOENT') return send404(res);
      console.error(error);
      send500(res, error);
    }
  });
}

/**
 * The file a request names inside web/, or null if it points anywhere else.
 * `..` in the URL resolves before the check, so it cannot climb out.
 */
function getWebFile(urlPath) {
  const target = resolve(webDir, '.' + urlPath);
  return target.startsWith(webDir + sep) ? target : null;
}

function sendText(res, content, type) {
  send(res, 200, content, type);
}

function sendJson(res, data) {
  send(res, 200, JSON.stringify(data), 'application/json; charset=utf-8');
}

async function sendFile(res, filePath, type) {
  send(res, 200, await readFile(filePath), type || 'application/octet-stream');
}

function send403(res) {
  send(res, 403, 'Forbidden', 'text/plain');
}

function send404(res) {
  send(res, 404, 'Not found', 'text/plain');
}

function send500(res, error) {
  send(res, 500, `Presenter error: ${error.message}`, 'text/plain');
}

function send(res, status, body, type) {
  res.writeHead(status, { 'content-type': type, 'cache-control': 'no-store' });
  res.end(body);
}
