// The buffer maths behind the presenter console.
//
// This is the one module the browser loads directly, so it must stay free of
// Node builtins and of any build step. Everything it needs comes in as plain
// numbers: a deck's plan, the slide you are on, and minutes on the clock.

/**
 * Everything the presenter console shows, derived from the deck plan, the
 * slide you are on, and minutes on the clock. Time is always minutes elapsed
 * since you hit Start — never a wall-clock time of day.
 */
export function computeStatus(deck, index0, elapsedMin) {
  const slides = deck.slides;
  const i = Math.min(Math.max(index0, 0), slides.length - 1);
  const current = slides[i];
  const budget = deck.estimatedMinutes;

  // Where the *plan* says you are. Inside the current slide's planned window
  // this is simply the clock, so being anywhere in that window reads as "on
  // plan"; outside it, the plan sticks to the window's near edge.
  const planPosition = Math.min(Math.max(elapsedMin, current.start), current.cumulative);

  // Signed the way a presenter reads it: + is time in hand, − is time owed.
  const buffer = planPosition - elapsedMin;
  const remainingClock = budget - elapsedMin;

  return {
    index: i,
    current,
    next: slides[i + 1] ?? null,
    budget,
    planPosition,
    buffer,
    bufferLevel: bufferLevel(buffer),
    remainingClock,
    finished: i === slides.length - 1 && elapsedMin >= current.cumulative,
  };
}

function bufferLevel(buffer) {
  if (buffer > 1) return 'ahead';
  if (buffer >= -1) return 'ok';
  if (buffer >= -3) return 'warn';
  return 'bad';
}

/** Minutes → `12:30`, negatives → `−1:05`. */
export function formatClock(minutes) {
  return formatMinutes(minutes, '');
}

/**
 * Minutes with the sign always spelled out — `+2:30`, `−1:05`, `0:00`. The
 * buffer is read at a glance mid-sentence, so its direction cannot hang on
 * spotting a missing character.
 */
export function formatSigned(minutes) {
  return formatMinutes(minutes, '+');
}

// Rounded to whole seconds before the sign is picked, so that nothing which
// reads as `0:00` can carry one — a hair below zero is still zero on a clock.
function formatMinutes(minutes, plus) {
  const totalSeconds = Math.round(Math.abs(minutes) * 60);
  const sign = totalSeconds === 0 ? '' : minutes < 0 ? '−' : plus;
  const mins = Math.floor(totalSeconds / 60);
  return `${sign}${mins}:${String(totalSeconds % 60).padStart(2, '0')}`;
}
