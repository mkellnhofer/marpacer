// The deck list you land on: one card per deck under the served folder.
//
// Picking a deck is a real navigation rather than a swap in place — the URL is
// what identifies the deck, and the clock is keyed to it, so landing on
// ?deck=… directly has to work the same as clicking a card.

import { formatClock } from '/timing.js';

export const DeckPicker = {
  props: {
    root: { type: String, required: true },
    decks: { type: Array, required: true },
  },

  template: `
    <div class="picker">
      <h1>Presenter console</h1>
      <p>{{ root }}</p>
      <div class="deck-list">
        <button v-for="deck in decks" :key="deck.id" class="card deck-card" @click="open(deck)">
          <span class="row">
            <span class="title">{{ deck.title }}</span>
          </span>
          <span class="row">
            <span class="meta num">{{ summary(deck) }}</span>
            <span class="spacer"></span>
            <span class="chip" :class="chipClass(deck)">{{ chipLabel(deck) }}</span>
          </span>
          <span class="meta path">{{ deck.file }}</span>
        </button>
      </div>
    </div>
  `,

  methods: {
    open(deck) {
      location.search = `?deck=${encodeURIComponent(deck.id)}`;
    },

    summary(deck) {
      const slides = `${deck.slides.length} slides`;
      return deck.hasPlan ? `${formatClock(deck.estimatedMinutes)} · ${slides}` : slides;
    },

    // A deck with a plan shows how that plan looks; one without says why not.
    chipLabel(deck) {
      if (deck.hasPlan) return deck.status;
      return deck.errors.length ? 'stamps broken' : 'no plan';
    },

    chipClass(deck) {
      if (deck.hasPlan) return deck.status;
      return deck.errors.length ? 'over' : '';
    },
  },
};
