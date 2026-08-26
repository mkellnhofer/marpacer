// The BroadcastChannel protocol that keeps the presenter console and the deck
// window on the same slide.
//
// Both pages speak it, so it lives on its own rather than in either of them.
// Like timing.js this is fetched by the browser as an ES module with no build
// step, and it stays framework-free: the console may grow a framework, the
// deck window renders Marp's own markup and never will.
//
// Two messages, both carrying 1-based slide numbers — the same numbers the
// deck window and the slide counter show:
//
//   { type: 'slide', index }  — I moved here; follow me.
//   { type: 'hello' }         — where are you? (answered with a `slide`)
//
// Neither side is the master. Whoever moves announces it, whoever is asked
// answers, and so a window opened or reloaded mid-lecture rejoins on the slide
// the other one is already showing.

const CHANNEL_PREFIX = 'presenter-';

/**
 * Join the channel for one deck.
 *
 * `getSlide()` is asked where this window stands, to answer a `hello`.
 * `onSlide(index)` fires when the *other* window moved: move locally in
 * response, but never call `announce()` from it, or the two windows echo each
 * other around the deck.
 *
 * A missing `syncId` — or a browser without BroadcastChannel — yields a sync
 * that does nothing, so callers need no null checks. The console's preview
 * frames lean on that: they mirror a deck without joining its channel.
 */
export function createSync(syncId, { getSlide, onSlide }) {
  if (!syncId || !('BroadcastChannel' in globalThis)) return { announce() {} };

  const channel = new BroadcastChannel(CHANNEL_PREFIX + syncId);
  const announce = (index) => channel.postMessage({ type: 'slide', index });

  channel.addEventListener('message', ({ data }) => {
    if (data?.type === 'slide') onSlide(data.index);
    else if (data?.type === 'hello') announce(getSlide());
  });

  // Announce ourselves last, once we are able to answer: a window that opens
  // mid-lecture adopts the slide the other one is on.
  channel.postMessage({ type: 'hello' });

  return { announce };
}
