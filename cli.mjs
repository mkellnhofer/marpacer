#!/usr/bin/env node
// marp-presenter — a custom presenter console for Marp decks with timing estimates.
//
//   marp-presenter [dir]          serve the console for every deck under dir
//   marp-presenter check [dir]    verify the decks' timing stamps
//
// Run with --help for options.

import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { createIndexer } from './decks.mjs';

const HELP = `marp-presenter — presenter console for Marp decks

Usage
  marp-presenter check [dir]          verify timing stamps, exit 1 on problems

Options
  -h, --help            show this help
      --all             include decks normally hidden: those git ignores
                        (generated ones) and those whose name starts with _
`;

function parseArgs(argv) {
  const options = { port: 4321, themeSet: null, command: 'serve', dir: null, includeIgnored: false };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === 'check' && options.command === 'serve' && !options.dir) options.command = 'check';
    else if (arg === '-h' || arg === '--help') options.command = 'help';
    else if (arg === '--all') options.includeIgnored = true;
    else if (arg.startsWith('-')) throw new Error(`Unknown option "${arg}"`);
    else if (!options.dir) options.dir = arg;
    else throw new Error(`Unexpected argument "${arg}"`);
  }

  return options;
}

async function check(root, includeIgnored) {
  const indexer = createIndexer(root, includeIgnored);
  const decks = await indexer();
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
