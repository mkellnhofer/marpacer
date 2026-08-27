// A live deck window, shrunk into a card.
//
// The preview is a real deck.html in an iframe rather than a re-render of the
// slide, so what you see here is exactly what the room sees. In preview mode
// that page keeps to itself — no keyboard, no sync channel, no history — and
// exposes `deck.go()` for us to position it.

export const SlidePreview = {
  props: {
    deckUrl: { type: String, required: true },
    slide: { type: Number, required: true },
    label: { type: String, required: true },
    // The slide after the last one: nothing to show, so say so instead.
    atEnd: { type: Boolean, default: false },
  },

  data() {
    return {
      // Set once, from the slide we open on. Every later move goes through
      // `deck.go()`, so binding this to `slide` would be a bug: it would
      // reload the iframe on every step through the deck.
      src: `${this.deckUrl}?preview=1&slide=${this.slide}`,
      // Not for rendering — it records whether the frame can take a `go()` yet.
      loaded: false,
    };
  },

  watch: {
    slide: 'moveFrame',
  },

  template: `
    <div class="preview" :class="{ 'at-end': atEnd }">
      <iframe ref="frame" :src="src" :title="label" @load="onLoad"></iframe>
      <div v-if="atEnd" class="end">End of slides</div>
    </div>
  `,

  methods: {
    onLoad() {
      this.loaded = true;
      // A move that arrived while the frame was still loading lands now.
      this.moveFrame();
    },

    moveFrame() {
      if (this.loaded) this.$refs.frame.contentWindow?.deck?.go(this.slide);
    },
  },
};
