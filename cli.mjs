#!/usr/bin/env node
// marp-presenter — a custom presenter console for Marp decks with timing estimates.
//
//   marp-presenter serve [dir]    serve the console for every deck under dir
//   marp-presenter check [dir]    verify the decks' timing stamps
//
// Run "marp-presenter help" for options.

import { existsSync } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';
import { DeckIndex } from './server/decks.mjs';
import { createRenderer } from './server/render.mjs';
import { createPresenterServer } from './server/server.mjs';

const HELP = `marp-presenter — presenter console for Marp decks

Usage
  marp-presenter serve [options] [dir]   serve the console for the decks under dir
  marp-presenter check [options] [dir]   verify their timing stamps, exit 1 on problems
  marp-presenter help                    show this help

  dir defaults to the current folder.

Options (general)
      --all             include decks normally hidden: those git ignores
                        (generated ones) and those whose name starts with _

Options (serve only)
  -p, --port <n>        port to listen on (default 4321)
      --theme-set <dir> folder of theme CSS files (default: <dir>/themes)
`;

const SERVE_DEFAULTS = {
  includeIgnored: false,
  port: 4321,
  themeSet: null
};

const CHECK_DEFAULTS = {
  includeIgnored: false
};

function parseArgs(argv) {
  if (argv.length === 0 || argv[0] === 'help') {
    return { command: 'help' };
  }

  const command = argv[0];

  if (command.startsWith('-')) {
    throw new Error(`Command missing! See "marp-presenter help" for usage.`);
  }

  const optionArgs = argv.slice(1);

  let options = {};
  switch (command) {
    case 'serve':
      options = parseOptions(command, optionArgs, SERVE_DEFAULTS);
      break;
    case 'check':
      options = parseOptions(command, optionArgs, CHECK_DEFAULTS);
      break;
    default:
      throw new Error(`Unknown command "${command}". See "marp-presenter help" for usage.`);
  }

  return {
    command: command,
    ...options
  };
}

/**
 * The options and the folder a command was given, so `--all slides` reads as
 * `{ options: { includeIgnored: true }, dir: 'slides' }`.
 *
 * `defaults` doubles as the list of options the command accepts: a flag the
 * command has no default for is rejected rather than quietly ignored, so
 * `check --port 8080` reads as the mistake it is.
 */
function parseOptions(cmd, argv, defaults) {
  const options = { ...defaults };
  let dir = null;

  const set = (flag, name, value) => {
    if (!(name in defaults)) throw new Error(`Command "${cmd}" takes no "${flag}" option.`);
    options[name] = value;
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    switch (arg) {
      case '--all':
        set(arg, 'includeIgnored', true);
        break;
      case '-p':
      case '--port':
        set(arg, 'port', parsePort(arg, argv[++i]));
        break;
      case '--theme-set':
        set(arg, 'themeSet', getOptionValue(arg, argv[++i]));
        break;
      default:
        if (arg.startsWith('-')) throw new Error(`Unknown option "${arg}".`);
        if (dir !== null) throw new Error(`Unexpected argument "${arg}" — "${cmd}" takes one folder.`);
        dir = arg;
    }
  }

  return { options, dir };
}

function parsePort(flag, value) {
  const port = Number(getOptionValue(flag, value));
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error(`Option "${flag}" needs a port between 1 and 65535, not "${value}".`);
  return port;
}

function getOptionValue(flag, value) {
  if (value === undefined || value.startsWith('-')) throw new Error(`Option "${flag}" needs a value.`);
  return value;
}

function checkDecks(decks) {
  let failed = 0;
  for (const deck of decks) {
    if (deck.errors.length > 0) {
      failed += 1;
      console.log(`  FAIL  ${deck.file}`);
      for (const error of deck.errors) console.log(`          ${error}`);
    } else if (deck.hasPlan) {
      console.log(
        `  OK    ${deck.file}  (`
        + `${deck.estimatedMinutes} of ${deck.targetMinutes} min, `
        + `${deck.slides.length} slide(s), `
        + `${deck.status}`
        + `)`,
      );
    } else {
      console.log(`  --    ${deck.file}  (no timing plan, ${deck.slides.length} slide(s))`);
    }
  }

  const deckCount = decks.length;
  console.log(
    failed === 0
      ? `\n${deckCount} deck${deckCount === 1 ? '' : 's'}, all timing stamps consistent.`
      : `\n${failed} of ${deckCount} decks have inconsistent timing stamps.`,
  );

  return failed === 0;
}

function logDecks(root, decks) {
  console.log(`${decks.length} decks found in '${root}'`);
  
  const unplannedDecks = decks.filter((deck) => !deck.hasPlan);

  if (unplannedDecks.length > 0) {
    console.log(`${unplannedDecks.length} deck(s) run without a timing plan:`);
    for (const deck of unplannedDecks) {
      const errors = deck.errors;
      console.log(
        `  ${deck.file} — `
        + `${errors.length > 0 ? errors[0] : 'no timing stamps'}`
        + `${errors.length > 1 ? ` (+${errors.length - 1} more)` : ''}`
      );
    }
  }
}

function startServer(deckIndex, options) {
  const root = deckIndex.root;
  const themes = options.themeSet ?? (existsSync(join(root, 'themes')) ? 'themes' : null);
  const themeDir = themes && (isAbsolute(themes) ? themes : join(root, themes));

  if (themes) {
    console.log(`Themes used from: ${themes}`);
  }

  const renderer = createRenderer(themeDir);

  const server = createPresenterServer({ deckIndex, renderer });

  server.on('listening', () => {
    console.log(`Server started at: http://localhost:${options.port}/`);
    console.log('Ctrl+C to stop.');
  });

  server.on('error', (error) => {
    console.error('Could start server:', error.message);
  });

  server.listen(options.port, '127.0.0.1');
}

let args;
try {
  args = parseArgs(process.argv.slice(2));
} catch (error) {
  console.error(`${error.message}\n\n${HELP}`);
  process.exit(2);
}

if (args.command === 'help') {
  console.log(HELP);
  process.exit(0);
}

const root = resolve(args.dir ?? '.');
if (!existsSync(root)) {
  console.error(`No such folder: ${root}`);
  process.exit(2);
}

const deckIndex = new DeckIndex(root, args.options.includeIgnored);

const decks = await deckIndex.getDecks();
if (decks.length === 0) {
  console.log(`No Marp decks found under ${root}`);
  process.exit(0);
}

switch (args.command) {
  case 'check':
    const ok = checkDecks(decks);
    process.exit(ok ? 0 : 1);
  case 'serve':
    logDecks(root, decks);
    startServer(deckIndex, args.options);
    break;
  default:
    console.error(`Unknown command: ${args.command}`);
    process.exit(2);
}
