// The deck list you land on: one card per deck under the served folder.
//
// Picking a deck is a real navigation rather than a swap in place — the URL is
// what identifies the deck, and the clock is keyed to it, so landing on
// ?deck=… directly has to work the same as clicking a card.

import { formatClock } from '/timing.js';

/**
 * One deck, summarised. Everything it shows it works out from its own deck,
 * so the list above it stays a list; picking is the list's business, hence
 * the event rather than a navigation from in here.
 */
const DeckCard = {
  props: {
    deck: { type: Object, required: true },
  },

  emits: ['select'],

  template: `
    <button class="card deck-card" @click="$emit('select')">
      <span class="row">
        <span class="title">{{ deck.title }}</span>
      </span>
      <span class="row">
        <span class="meta num">{{ summary }}</span>
        <span class="spacer"></span>
        <span class="chip" :class="chipClass">{{ chipLabel }}</span>
      </span>
      <span class="meta path">{{ deck.file }}</span>
    </button>
  `,

  computed: {
    summary() {
      const slides = `${this.deck.slides.length} slides`;
      return this.deck.hasPlan ? `${formatClock(this.deck.estimatedMinutes)} · ${slides}` : slides;
    },

    // A deck with a plan shows how that plan looks; one without says why not.
    chipLabel() {
      if (this.deck.hasPlan) return this.deck.status;
      return this.deck.errors.length ? 'stamps broken' : 'no plan';
    },

    chipClass() {
      if (this.deck.hasPlan) return this.deck.status;
      return this.deck.errors.length ? 'over' : '';
    },
  },
};

export const DeckPicker = {
  components: { DeckCard },

  props: {
    root: { type: String, required: true },
    decks: { type: Array, required: true },
  },

  template: `
    <div class="picker">
      <h1>Presenter console</h1>
      <p>{{ root }}</p>
      <div class="deck-list">
        <deck-card v-for="deck in decks" :key="deck.id" :deck="deck" @select="open(deck)" />
      </div>
    </div>
  `,

  methods: {
    open(deck) {
      location.search = `?deck=${encodeURIComponent(deck.id)}`;
    },
  },
};
