// Reading the decks in a folder: finding them, parsing each one's slides,
// notes and timing stamps, and checking that those stamps hold together.

import { spawn } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';

const SKIP_DIRS = new Set(['.git', 'dist', 'node_modules']);

// Slide minutes are authored with one decimal, so compare with a tolerance.
const EPS = 1e-6;
const DECK_RE = /<!-- timing-deck\n([\s\S]*?)\n-->/;
const SLIDE_RE = /<!-- timing-slide (\{.*?\}) -->/;
const FRONT_MATTER_RE = /^---\n[\s\S]*?\n---\n/;
const COMMENT_RE = /<!--([\s\S]*?)-->/g;
const FENCE_RE = /^```[\s\S]*?^```/gm;

// Marp reads these comments as directives, not as speaker notes.
const DIRECTIVE_RE =
  /^_?(class|footer|header|paginate|color|theme|style|size|transition|marp|background(Color|Image|Position|Repeat|Size)?)\s*:/;

/**
 * One folder of decks: the index the console runs on — timing plan where the
 * stamps hold up, slides/titles/notes always — and the folder's own path
 * safety, so everything that resolves a path against the deck root goes
 * through the object that owns it.
 */
export class DeckIndex {

  #cache = new Map();
  #includeIgnored;

  constructor(root, includeIgnored = false) {
    this.root = root;
    this.#includeIgnored = includeIgnored;
  }

  /**
   * Every deck under the root. Call it again whenever a deck may have changed
   * on disk — a deck is re-parsed only once its mtime moves.
   */
  async getDecks() {
    const files = await findDecks(this.root, this.#includeIgnored);
    const decks = [];

    for (const file of files) {
      const { mtimeMs } = await stat(join(this.root, file));
      let entry = this.#cache.get(file);

      if (!entry || entry.mtimeMs !== mtimeMs) {
        const deck = parseDeck(await readFile(join(this.root, file), 'utf8'), file.split(sep).join('/'));
        entry = {
          mtimeMs,
          deck: {
            ...deck,
            id: deckId(file),
            syncId: syncId(file),
            url: `/decks/${file.split(sep).map(encodeURIComponent).join('/')}`,
          },
        };
        this.#cache.set(file, entry);
      }

      decks.push(entry.deck);
    }

    return decks;
  }

  /**
   * `requested`, a path relative to the root, as an absolute path — or `null`
   * when it points outside the folder, which is what keeps a `..` in a URL
   * from reaching the rest of the disk.
   *
   * Only containment is decided here, not existence: a deck that is simply
   * gone should read as missing where it is opened, not as a refusal here.
   */
  getFile(requested) {
    const target = resolve(this.root, requested);
    return target === this.root || target.startsWith(this.root + sep) ? target : null;
  }

}

/**
 * Every Marp deck under `root`, as paths relative to it. Files whose name
 * starts with `_` are templates and partials, not decks to present, so they are
 * left out along with anything git ignores — pass `includeIgnored` for both.
 */
async function findDecks(root, includeIgnored) {
  const found = [];

  async function walk(dir) {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!SKIP_DIRS.has(entry.name) && !entry.name.startsWith('.')) await walk(full);
      } else if (entry.isFile() && extname(entry.name) === '.md') {
        if (!includeIgnored && entry.name.startsWith('_')) continue;
        // Marp decks declare themselves in front matter; plain Markdown in the
        // folder (READMEs, notes, handouts) is not a deck.
        const head = (await readFile(full, 'utf8')).slice(0, 500);
        if (/^---\r?\n[\s\S]*?^marp:\s*true\s*$/m.test(head)) found.push(relative(root, full));
      }
    }
  }

  await walk(root);
  if (includeIgnored || found.length === 0) return found;

  const ignored = await gitIgnored(root, found);
  return found.filter((file) => !ignored.has(file));
}

/**
 * Paths git is told to ignore. Generated decks (a merged handout, a build
 * artifact) are normally gitignored, and presenting them is never the intent —
 * so they stay out of the picker unless asked for.
 */
function gitIgnored(root, files) {
  return new Promise((done) => {
    let out = '';
    try {
      const git = spawn('git', ['-C', root, 'check-ignore', '--stdin'], { stdio: ['pipe', 'pipe', 'ignore'] });
      git.stdout.on('data', (chunk) => (out += chunk));
      git.on('error', () => done(new Set())); // no git, or not a repo
      git.on('close', () => done(new Set(out.split('\n').filter(Boolean))));
      git.stdin.on('error', () => done(new Set()));
      git.stdin.end(files.join('\n'));
    } catch {
      done(new Set());
    }
  });
}

/**
 * Parse one deck's Markdown into `{ …deck fields, slides, hasPlan, errors }`.
 * `file` is the path relative to the deck root, e.g. `week-01/lecture-1.md`.
 *
 * This never throws. A deck with no timing stamps, or with stamps that do not
 * hold together, still yields its slides, titles and notes — the presenter can
 * run those without a plan, showing only the elapsed clock.
 */
function parseDeck(src, file = '') {
  const chunks = splitSlides(src);
  const errors = [];

  const slides = chunks.map((chunk, position) => {
    const notes = extractNotes(chunk);
    const stamp = chunk.match(SLIDE_RE);

    if (stamp) {
      try {
        const slide = JSON.parse(stamp[1]);
        // Where the clock should stand when this slide goes up.
        slide.start = round(slide.cumulative - slide.minutes);
        return { ...slide, notes, stamped: true };
      } catch {
        errors.push(`slide ${position + 1}: timing-slide stamp is not valid JSON`);
      }
    }

    return {
      index: position + 1,
      kind: null,
      title: headingOf(chunk),
      minutes: null,
      cumulative: null,
      start: null,
      notes,
      stamped: false,
    };
  });

  let meta = null;
  const deckMatch = src.match(DECK_RE);
  if (deckMatch) {
    try {
      meta = JSON.parse(deckMatch[1]);
    } catch {
      errors.push('timing-deck comment is not valid JSON');
    }
  }

  const stamped = slides.filter((slide) => slide.stamped);

  const deck = {
    ...meta,
    file,
    // The file name is the deck's name — nothing is inferred from a footer,
    // a leading id, or the folder it sits in.
    title: file.split('/').pop().replace(/\.md$/, ''),
    markdownSlideCount: chunks.length,
    slides,
  };

  if (meta) {
    // Validate against the stamped slides only, so a slide that lost its stamp
    // reads as a missing stamp rather than as a shifted running total.
    errors.push(...validateDeck({ ...deck, slides: stamped }));
  } else if (stamped.length > 0) {
    errors.push(`${stamped.length} slide${stamped.length === 1 ? "" : "s"} carry stamps but the deck has no timing-deck comment`);
  }

  // No stamps at all is not an error — it is simply a deck without a plan.
  deck.stampedCount = stamped.length;
  deck.errors = errors;
  deck.hasPlan = Boolean(meta) && errors.length === 0;
  return deck;
}

/**
 * Split a deck into one string per slide. Fenced code is skipped while
 * scanning, because a `---` inside a code block is content, not a slide break.
 */
function splitSlides(src) {
  const frontMatter = src.match(FRONT_MATTER_RE);
  const body = frontMatter ? src.slice(frontMatter[0].length) : src;
  const chunks = [[]];
  let inFence = false;

  for (const line of body.split('\n')) {
    if (line.startsWith('```')) inFence = !inFence;
    else if (!inFence && /^---\s*$/.test(line)) {
      chunks.push([]);
      continue;
    }
    chunks[chunks.length - 1].push(line);
  }

  return chunks.map((lines) => lines.join('\n'));
}

/**
 * Speaker notes for one slide: every HTML comment that is neither a Marp
 * directive nor a timing stamp. Comments inside fenced code are HTML being
 * taught, not notes, so they are stripped first.
 */
function extractNotes(chunk) {
  return [...chunk.replace(FENCE_RE, '').matchAll(COMMENT_RE)]
    .map((match) => match[1].trim())
    .filter((text) => text && !text.startsWith('timing-') && !DIRECTIVE_RE.test(text))
    .join('\n\n');
}

/** The slide's own heading, for decks that carry no `title` in a stamp. */
function headingOf(chunk) {
  const heading = chunk.replace(FENCE_RE, '').match(/^#{1,6}\s+(.+?)\s*$/m);
  return heading ? heading[1] : null;
}

/**
 * Check the invariants the stamps are supposed to hold. Nothing recomputes
 * `index` / `cumulative`, so editing a deck silently desyncs every stamp after
 * the edit — this is what catches that.
 */
function validateDeck(deck) {
  const errors = [];
  const { slides } = deck;

  if (slides.length !== deck.slideCount)
    errors.push(`slideCount says ${deck.slideCount}, found ${slides.length} timing-slide stamps`);

  if (deck.markdownSlideCount !== slides.length)
    errors.push(
      `deck has ${deck.markdownSlideCount} slides but ${slides.length} are stamped` +
        ` — a slide is missing its timing-slide comment (or has a stray one)`,
    );

  let running = 0;
  slides.forEach((slide, i) => {
    if (slide.index !== i + 1) errors.push(`slide ${i + 1}: index is stamped ${slide.index}`);
    running = round(running + slide.minutes);
    if (Math.abs(slide.cumulative - running) > EPS)
      errors.push(
        `slide ${slide.index} (${slide.title ?? '—'}): cumulative is ${slide.cumulative}, running total is ${running}`,
      );
  });

  const sum = round(slides.reduce((total, s) => total + s.minutes, 0));
  if (Math.abs(sum - deck.estimatedMinutes) > EPS)
    errors.push(`estimatedMinutes is ${deck.estimatedMinutes}, slide minutes sum to ${sum}`);

  const last = slides[slides.length - 1];
  if (last && Math.abs(last.cumulative - deck.estimatedMinutes) > EPS)
    errors.push(`last cumulative is ${last.cumulative}, estimatedMinutes is ${deck.estimatedMinutes}`);

  const delta = round(deck.estimatedMinutes - deck.lectureBudgetMinutes);
  if (Math.abs(delta - deck.deltaMinutes) > EPS)
    errors.push(`deltaMinutes is ${deck.deltaMinutes}, should be ${delta}`);

  const status = delta > 0 ? 'over' : -delta <= 4 ? 'tight' : 'ok';
  if (deck.status !== status)
    errors.push(`status is "${deck.status}", ${delta > 0 ? 'over' : `${-delta} min spare`} means "${status}"`);

  return errors;
}

/** Minutes are authored with at most one decimal; keep sums off float dust. */
function round(value) {
  return Math.round(value * 1000) / 1000;
}

/** The deck's ID: Its path relative to the deck folder, without the extension. */
const deckId = (file) => file.split(sep).join('/').replace(/\.md$/, '');

/**
 * base64url of the deck's path: one opaque token per deck, built only from
 * `A-Za-z0-9-_`. Nothing decodes it — it just names a BroadcastChannel, a
 * window and a localStorage key, and rides in a query string untouched. Folding
 * the path's punctuation into `-` instead would let `a/b-c` and `a-b/c` land on
 * the same channel.
 */
const syncId = (file) => Buffer.from(deckId(file), 'utf8').toString('base64url');
