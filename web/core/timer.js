// The presenter's clock: elapsed time, and when the current slide went up.
//
// Plain data in, new plain data out — no closure holding the state, so the
// console can keep it wherever it likes and still get the transitions from
// here. Like timing.js this is fetched by the browser as an ES module, and
// nothing in it touches the DOM.
//
// Every duration is milliseconds; `now` is injectable so the transitions can
// be tested without waiting for a real clock.

const STORAGE_PREFIX = 'presenter-timer-';

/** A clock that has never been started, sitting on the deck's first slide. */
export function blankTimer() {
  return { running: false, startedAt: 0, accMs: 0, index: 0, slideEnteredMs: 0 };
}

/** Milliseconds on the clock, counting the current run if it is going. */
export function elapsedMs(timer, now = Date.now()) {
  return timer.accMs + (timer.running ? now - timer.startedAt : 0);
}

/** Milliseconds spent on the slide currently up. */
export function onSlideMs(timer, now = Date.now()) {
  return Math.max(0, elapsedMs(timer, now) - timer.slideEnteredMs);
}

/** Never started — the console greys the clock out rather than showing 0:00. */
export function isIdle(timer) {
  return !timer.running && timer.accMs === 0;
}

/** Start a stopped clock, or bank the current run and stop a going one. */
export function toggled(timer, now = Date.now()) {
  return timer.running
    ? { ...timer, running: false, accMs: elapsedMs(timer, now), startedAt: 0 }
    : { ...timer, running: true, startedAt: now };
}

/**
 * Move to a slide, remembering when it went up in *elapsed* terms rather than
 * wall-clock — that is what keeps time-on-slide honest across a pause.
 */
export function movedTo(timer, index, now = Date.now()) {
  return { ...timer, index, slideEnteredMs: elapsedMs(timer, now) };
}

// ---- persistence: one clock per deck, so a reload never loses it ----

/** The stored clock for a deck, falling back to a blank one. */
export function loadTimer(syncId) {
  return { ...blankTimer(), ...readJSON(STORAGE_PREFIX + syncId) };
}

export function saveTimer(syncId, timer) {
  localStorage.setItem(STORAGE_PREFIX + syncId, JSON.stringify(timer));
}

function readJSON(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? {};
  } catch {
    return {};
  }
}
