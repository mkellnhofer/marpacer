// Reading the decks in a folder: finding them, parsing each one's slides,
// notes and timing stamps, and checking that those stamps hold together.

import { spawn } from 'node:child_process';
import { readFile, readdir, stat } from 'node:fs/promises';
import { extname, join, relative, resolve, sep } from 'node:path';

const SKIP_DIRS = new Set(['.git', 'dist', 'node_modules']);

const DECK_RE = /<!-- timing-deck\n([\s\S]*?)\n-->/;
const SLIDE_RE = /<!-- timing-slide (\{.*?\}) -->/;
const FRONT_MATTER_RE = /^---\n[\s\S]*?\n---\n/;
const COMMENT_RE = /<!--([\s\S]*?)-->/g;
const FENCE_RE = /^```[\s\S]*?^```/gm;

// Everything else about a deck's timing is derived, not stamped.
const PLAN_FIELDS = new Set(['targetMinutes', 'note']);
const SLIDE_FIELDS = new Set(['minutes']);

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
 * A stamp carries only what cannot be derived: the deck's target, and each
 * slide's minutes. Slide numbers, running totals, the deck's estimate and its
 * status are computed here, so editing a deck cannot desync them.
 *
 * This never throws. A deck with no timing stamps, or with stamps that do not
 * hold together, still yields its slides, titles and notes — the presenter can
 * run those without a plan, showing only the elapsed clock.
 */
function parseDeck(src, file = '') {
  const errors = [];
  const chunks = splitSlides(src);
  const plan = parsePlan(src, errors);
  const slides = chunks.map((chunk, position) => parseSlide(chunk, position, errors));

  if (plan) {
    errors.push(...validatePlan(plan, slides));
  } else if (slides.some((slide) => slide.stamped)) {
    const stamped = slides.filter((slide) => slide.stamped).length;
    errors.push(
      `${stamped} slide${stamped === 1 ? '' : 's'} carry stamps but the deck has no timing-deck comment`,
    );
  }

  // No stamps at all is not an error — it is simply a deck without a plan.
  const hasPlan = Boolean(plan) && errors.length === 0;
  const estimatedMinutes = hasPlan ? round(sumMinutes(slides)) : null;

  return {
    file,
    // The file name is the deck's name — nothing is inferred from a footer,
    // a leading id, or the folder it sits in.
    title: file.split('/').pop().replace(/\.md$/, ''),
    targetMinutes: plan?.targetMinutes ?? null,
    note: plan?.note ?? '',
    estimatedMinutes,
    remainingMinutes: hasPlan ? round(plan.targetMinutes - estimatedMinutes) : null,
    status: hasPlan ? statusOf(plan.targetMinutes, estimatedMinutes) : null,
    slides: hasPlan ? withRunningTotals(slides) : slides,
    errors,
    hasPlan,
  };
}

/** The deck's `timing-deck` stamp, or `null` when it has none. */
function parsePlan(src, errors) {
  const match = src.match(DECK_RE);
  if (!match) return null;

  let plan;
  try {
    plan = JSON.parse(match[1]);
  } catch {
    errors.push('timing-deck comment is not valid JSON');
    return null;
  }

  if (plan === null || typeof plan !== 'object' || Array.isArray(plan)) {
    errors.push('timing-deck comment is not a JSON object');
    return null;
  }

  return plan;
}

/**
 * One slide: its stamped minutes if it carries a usable stamp, plus everything
 * read from the Markdown itself. `cumulative` and `start` stay null here —
 * only a deck whose plan holds up gets running totals.
 */
function parseSlide(chunk, position, errors) {
  const index = position + 1;
  const slide = {
    index,
    title: headingOf(chunk),
    minutes: null,
    cumulative: null,
    start: null,
    notes: extractNotes(chunk),
    stamped: false,
  };

  const match = chunk.match(SLIDE_RE);
  if (!match) return slide;

  let stamp;
  try {
    stamp = JSON.parse(match[1]);
  } catch {
    errors.push(`slide ${index}: timing-slide stamp is not valid JSON`);
    return slide;
  }

  errors.push(...unknownFields(stamp, SLIDE_FIELDS, `slide ${index}: timing-slide`));

  if (!isMinutes(stamp.minutes)) {
    errors.push(`slide ${index}: minutes is ${JSON.stringify(stamp.minutes ?? null)}, expected a number above 0`);
    return slide;
  }

  return { ...slide, minutes: stamp.minutes, stamped: true };
}

/**
 * Check what the stamps still can get wrong now that the derived numbers are
 * computed: a missing target, a slide the author forgot to stamp, and fields
 * left over from an older stamp format.
 */
function validatePlan(plan, slides) {
  const errors = unknownFields(plan, PLAN_FIELDS, 'timing-deck');

  if (!isMinutes(plan.targetMinutes))
    errors.push(`targetMinutes is ${JSON.stringify(plan.targetMinutes ?? null)}, expected a number above 0`);

  if (plan.note !== undefined && typeof plan.note !== 'string')
    errors.push('note is not a string');

  const unstamped = slides.filter((slide) => !slide.stamped).map((slide) => slide.index);
  if (unstamped.length > 0)
    errors.push(
      `slide${unstamped.length === 1 ? '' : 's'} ${unstamped.join(', ')}: no usable timing-slide stamp` +
        ` — the deck has ${slides.length} slides, ${slides.length - unstamped.length} of them stamped`,
    );

  return errors;
}

/** Where the clock should stand when each slide goes up, and when to leave it. */
function withRunningTotals(slides) {
  let running = 0;

  return slides.map((slide) => {
    const start = running;
    running = round(running + slide.minutes);
    return { ...slide, start, cumulative: running };
  });
}

/**
 * How the estimate sits against the target: `ok` while a tenth of the target
 * is still spare, `tight` once that slack is spent, `over` past the target.
 */
function statusOf(targetMinutes, estimatedMinutes) {
  const remaining = targetMinutes - estimatedMinutes;

  if (remaining < 0) return 'over';
  if (remaining < targetMinutes * 0.1) return 'tight';
  return 'ok';
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

/** The slide's own heading, for the console and for naming a slide in an error. */
function headingOf(chunk) {
  const heading = chunk.replace(FENCE_RE, '').match(/^#{1,6}\s+(.+?)\s*$/m);
  return heading ? heading[1] : null;
}

/** Fields a stamp no longer knows — usually left over from an older format. */
function unknownFields(stamp, known, label) {
  return Object.keys(stamp)
    .filter((key) => !known.has(key))
    .map((key) => `${label} has an unknown field "${key}"`);
}

/** Minutes are a positive number — everything else is a broken stamp. */
const isMinutes = (value) => typeof value === 'number' && Number.isFinite(value) && value > 0;

const sumMinutes = (slides) => slides.reduce((total, slide) => total + slide.minutes, 0);

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
