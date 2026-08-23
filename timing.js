// The drift and pace maths behind the presenter console.
//
// This is the one module the browser loads directly, so it must stay free of
// Node builtins and of any build step. Everything it needs comes in as plain
// numbers: a deck's plan, the slide you are on, and minutes on the clock.

// Slide minutes are authored with one decimal, so compare with a tolerance.
const EPS = 1e-6;

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

  const drift = elapsedMin - planPosition; // + behind, − ahead, 0 on plan
  const remainingClock = budget - elapsedMin;
  const remainingPlan = budget - planPosition;

  return {
    index: i,
    current,
    next: slides[i + 1] ?? null,
    budget,
    planPosition,
    drift,
    level: driftLevel(drift),
    remainingClock,
    remainingPlan,
    // How much faster than planned you must talk to still land on estimatedMinutes.
    requiredSpeed: remainingClock > EPS ? remainingPlan / remainingClock : Infinity,
    finished: i === slides.length - 1 && elapsedMin >= current.cumulative,
  };
}

function driftLevel(drift) {
  if (drift < -1) return 'ahead';
  if (drift <= 1) return 'ok';
  if (drift <= 3) return 'warn';
  return 'bad';
}

/** Minutes → `12:30`, negatives → `−1:05`. */
export function formatClock(minutes) {
  const sign = minutes < 0 ? '−' : '';
  const totalSeconds = Math.floor(Math.abs(minutes) * 60 + 0.5);
  const mins = Math.floor(totalSeconds / 60);
  return `${sign}${mins}:${String(totalSeconds % 60).padStart(2, '0')}`;
}
