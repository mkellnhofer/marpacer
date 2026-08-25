#!/usr/bin/env node
// marp-presenter — a custom presenter console for Marp decks with timing estimates.
//
//   marp-presenter [dir]          serve the console for every deck under dir
//   marp-presenter check [dir]    verify the decks' timing stamps
//
// Run with --help for options.

import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { DeckIndex } from './decks.mjs';
import { createRenderer } from './render.mjs';
import { createPresenterServer } from './server.mjs';

const HELP = `marp-presenter — presenter console for Marp decks

Usage
  marp-presenter [dir] [options]      serve the console (dir defaults to .)
  marp-presenter check [dir]          verify timing stamps, exit 1 on problems

Options
  -p, --port <n>        port to listen on (default 4321, next free port if taken)
      --theme-set <dir> folder of theme CSS files (default: <dir>/themes)
      --all             include decks normally hidden: those git ignores
                        (generated ones) and those whose name starts with _
  -h, --help            show this help
`;

function parseArgs(argv) {
  const options = { port: 4321, themeSet: null, command: 'serve', dir: null, includeIgnored: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === 'check' && options.command === 'serve' && !options.dir) options.command = 'check';
    else if (arg === '-p' || arg === '--port') options.port = Number(argv[++i]);
    else if (arg === '--theme-set') options.themeSet = argv[++i];
    else if (arg === '--all') options.includeIgnored = true;
    else if (arg === '-h' || arg === '--help') options.command = 'help';
    else if (arg.startsWith('-')) throw new Error(`Unknown option "${arg}"`);
    else if (!options.dir) options.dir = arg;
    else throw new Error(`Unexpected argument "${arg}"`);
  }

  return options;
}

async function check(root, includeIgnored) {
  const deckIndex = new DeckIndex(root, options.includeIgnored);
  const decks = await deckIndex.getDecks();
  if (decks.length === 0) {
    console.log(`No Marp decks found under ${root}`);
    return true;
  }

  let failed = 0;
  for (const deck of decks) {
    if (deck.errors.length > 0) {
      failed += 1;
      console.log(`  FAIL  ${deck.file}`);
      for (const error of deck.errors) console.log(`          ${error}`);
    } else if (deck.hasPlan) {
      console.log(`  ok    ${deck.file}  (${deck.estimatedMinutes} min, ${deck.slideCount} slide(s))`);
    } else {
      console.log(`  --    ${deck.file}  (no timing plan, ${deck.slides.length} slide(s))`);
    }
  }

  console.log(
    failed === 0
      ? `\n${decks.length} deck${decks.length === 1 ? '' : 's'}, all timing stamps consistent.`
      : `\n${failed} of ${decks.length} decks have inconsistent timing stamps.`,
  );
  return failed === 0;
}

/** Listen on `port`, stepping to the next free one if something already has it. */
function listen(server, port, attempts = 20) {
  return new Promise((resolvePort, reject) => {
    const onError = (error) => {
      if (error.code === 'EADDRINUSE' && attempts > 0) {
        server.removeListener('error', onError);
        listen(server, port + 1, attempts - 1).then(resolvePort, reject);
      } else reject(error);
    };

    server.once('error', onError);
    server.listen(port, '127.0.0.1', () => {
      server.removeListener('error', onError);
      resolvePort(port);
    });
  });
}

let options;
try {
  options = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`${error.message}\n\n${HELP}`);
  process.exit(2);
}

if (options.command === 'help') {
  console.log(HELP);
  process.exit(0);
}

const root = resolve(options.dir ?? '.');
if (!existsSync(root)) {
  console.error(`No such folder: ${root}`);
  process.exit(2);
}

if (options.command === 'check') {
  process.exit((await check(root, options.includeIgnored)) ? 0 : 1);
}

const deckIndex = new DeckIndex(root, options.includeIgnored);

const themes = options.themeSet ?? (existsSync(join(root, 'themes')) ? 'themes' : null);
const themeDir = themes && (isAbsolute(themes) ? themes : join(root, themes));
const renderer = createRenderer(themeDir);

const server = createPresenterServer({ deckIndex, renderer });
const port = await listen(server, options.port);

console.log(`marp-presenter  http://localhost:${port}/`);

const decks = await deckIndex.getDecks();

console.log(`  decks   ${root} (${decks.length} found${themes ? `, themes from ${themes}` : ''})`);

const unplanned = decks.filter((deck) => !deck.hasPlan);
if (unplanned.length > 0) {
  console.log(`  note    ${unplanned.length} deck(s) run without a timing plan:`);
  for (const deck of unplanned) {
    const why = deck.errors.length > 0 ? deck.errors[0] : 'no timing stamps';
    console.log(`            ${deck.file} — ${why}${deck.errors.length > 1 ? ` (+${deck.errors.length - 1} more)` : ''}`);
  }
}

console.log('\n  Ctrl+C to stop.');
