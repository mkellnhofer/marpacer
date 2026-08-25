// Renders Marp decks with marp-core — the renderer Marp itself uses — so a deck
// looks exactly as it does under `marp`.
//
// This module knows nothing about the page the slides end up in. It takes
// Markdown and hands back the slides and their stylesheet; deck.html asks for
// both over HTTP and assembles them in the browser.

import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { Marp } from '@marp-team/marp-core';

/** Render one deck's slides and stylesheet, reusing the last result until the file changes. */
export function createRenderer(root, themeDir) {
  const cache = new Map();
  let engine;

  return async function render(file) {
    const { mtimeMs } = await stat(join(root, file));

    const cached = cache.get(file);
    if (cached && cached.mtimeMs === mtimeMs) return cached.result;

    engine ??= await createEngine(themeDir);
    const result = engine.render(await readFile(join(root, file), 'utf8'));

    cache.set(file, { mtimeMs, result });

    return result;
  };
}

/**
 * A Marp instance carrying its own built-in themes (`default`, `gaia`,
 * `uncover`) plus every `*.css` in the deck folder's theme directory. Decks
 * pick one with `theme:` in their front matter, and custom themes can build on
 * a built-in one with `@import 'default'`.
 */
async function createEngine(themeDir) {
  const marp = new Marp({
    inlineSVG: true, // wraps each slide in an SVG, which is what makes it scale
    html: true, // decks are local files you wrote; render their HTML as-is

    // `script` stays at its default: Marp inlines its browser helper with the
    // slides, which drives auto-scaling (`<!-- fit -->`) and polyfills SVG
    // slides in Safari. deck.html re-runs it after inserting the markup.
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
