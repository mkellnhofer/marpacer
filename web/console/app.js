// The console's root: fetch the deck index, then show either the picker or one
// deck's console, depending on ?deck= in the URL.

import { DeckPicker } from '/console/picker.js';
import { PresenterConsole } from '/console/console.js';

export const PresenterApp = {
  components: { DeckPicker, PresenterConsole },

  template: `
    <div v-if="error" class="picker">
      <h1 class="error">No decks</h1>
      <p>{{ error }}. Start the console with
      <code>marpacer &lt;folder with decks&gt;</code> — it serves this page
      and renders the decks itself.</p>
    </div>
    <presenter-console v-else-if="deck" :deck="deck" />
    <deck-picker v-else-if="decks" :root="root" :decks="decks" />
  `,

  data() {
    return { root: '', decks: null, error: null };
  },

  computed: {
    /** The deck named in the URL, if it is one the server actually serves. */
    deck() {
      const id = new URLSearchParams(location.search).get('deck');
      return this.decks?.find((deck) => deck.id === id) ?? null;
    },
  },

  async created() {
    try {
      // Cache-busted: a deck edited between reloads must show its new timing.
      const response = await fetch(`/api/decks?t=${Date.now()}`);
      if (!response.ok) throw new Error(`/api/decks → HTTP ${response.status}`);

      const data = await response.json();
      this.root = data.root;
      this.decks = data.decks;
    } catch (error) {
      this.error = error.message;
    }
  },
};
