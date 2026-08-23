// A tiny static server that renders Marp decks on demand, so the presenter
// console can run against any folder of decks with no build step.
//
// Rendering is Marpit plus highlight.js; the page around the slides is ours
// (see deck.template.html), which is what keeps the deck free of any on-screen
// controls.

import { createServer } from 'node:http';
import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Marp } from '@marp-team/marp-core';

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

export function createPresenterServer({ root, indexer, themeDir }) {
  const renderer = createRenderer(root, themeDir);

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

/** Render one deck to HTML, reusing the last result until the file changes. */
function createRenderer(root, themeDir) {
  const cache = new Map();
  let engine;

  return async function render(file) {
    const { mtimeMs } = await stat(join(root, file));

    const cached = cache.get(file);
    if (cached && cached.mtimeMs === mtimeMs) return cached.html;

    engine ??= await createEngine(themeDir);
    const markdown = await readFile(join(root, file), 'utf8');
    const html = await renderDeck(engine, markdown, {
      title: deckId(file).split('/').pop(),
      syncId: syncId(file),
    });

    cache.set(file, { mtimeMs, html });
    return html;
  };
}

/**
 * A Marp instance carrying its own built-in themes (`default`, `gaia`,
 * `uncover`) plus every `*.css` in the deck folder's theme directory. Decks
 * pick one with `theme:` in their front matter, and custom themes can build on
 * a built-in one with `@import 'default'`.
 */
export async function createEngine(themeDir) {
  const marp = new Marp({
    inlineSVG: true, // wraps each slide in an SVG, which is what makes it scale
    html: true, // decks are local files you wrote; render their HTML as-is

    // `script` is left at its default: Marp inlines its browser helper, which
    // drives auto-scaling (`<!-- fit -->`) and polyfills SVG slides in Safari.
  });

  if (themeDir) {
    for (const name of await readdir(themeDir)) {
      if (extname(name) !== '.css') continue;
      try {
        marp.themeSet.add(await readFile(join(themeDir, name), 'utf8'));
      } catch (error) {
        // A CSS file without `/* @theme name */` is not a theme — skip it.
        console.warn(`  theme skipped: ${name} — ${error.message}`);
      }
    }
  }

  return marp;
}

/** The deck window's markup, styles and script, read once. */
let template;

/**
 * Render one deck's Markdown into a page for the deck window, by dropping the
 * slides and their theme into `deck.template.html`.
 */
export async function renderDeck(marp, markdown, { title, syncId }) {
  const { html, css } = marp.render(markdown);

  template ??= await readFile(join(toolDir, 'deck.template.html'), 'utf8');
  const values = { title: escapeHtml(title), themeCss: css, syncId: escapeHtml(syncId), slides: html };

  // Replace with a function, so a `$&` or `$1` inside a deck or its theme is
  // never mistaken for a replacement pattern.
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => values[key] ?? match);
}

const escapeHtml = (value) =>
  String(value).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

const deckId = (file) => file.split(sep).join('/').replace(/\.md$/, '');
const syncId = (file) => deckId(file).replace(/[^a-zA-Z0-9]+/g, '-');
