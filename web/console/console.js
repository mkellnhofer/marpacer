// The presenter console: the clock, the plan it is measured against, and the
// two slide previews.
//
// Everything on screen derives from three pieces of state — the deck, the
// timer, and `now`. The interval below moves `now` and nothing else; every
// figure on the panel is a computed hanging off it. That is the whole reason
// this is a component rather than a render function: there is no step where
// the code decides which readouts to touch.

import { createSync } from '/core/sync.js';
import { blankTimer, elapsedMs, isIdle, loadTimer, movedTo, onSlideMs, saveTimer, toggled } from '/core/timer.js';
import { computeStatus, formatClock, formatSigned } from '/core/timing.js';
import { SlidePreview } from '/console/preview.js';

/** How often the clock readouts refresh. Fast enough to look continuous. */
const TICK_MS = 250;

/** How long "Reset" stays armed before it forgets you asked. */
const RESET_ARMED_MS = 3000;

/** A big number with a caption: elapsed, buffer, and the pace multiplier. */
const StatCard = {
  props: {
    label: { type: String, required: true },
    value: { type: String, required: true },
    valueClass: { type: [String, Array, Object], default: '' },
    sub: { type: String, default: '' },
    subClass: { type: [String, Array, Object], default: '' },
  },

  template: `
    <div class="card">
      <div class="label">{{ label }}</div>
      <div class="big num" :class="valueClass">{{ value }}</div>
      <div class="sub" :class="subClass">{{ sub }}</div>
    </div>
  `,
};

/**
 * A progress bar with a figure at each end. `tick` marks where the plan says
 * you should be, on the bars that have a plan to compare against.
 */
const BarCard = {
  props: {
    label: { type: String, required: true },
    state: { type: String, default: '' },
    width: { type: String, required: true },
    tick: { type: String, default: '' },
    tickHidden: { type: Boolean, default: false },
    legendLeft: { type: String, required: true },
    legendRight: { type: String, required: true },
  },

  template: `
    <div class="card">
      <div class="label">{{ label }}</div>
      <div class="bar" :class="state" style="margin-top: 10px">
        <i :style="{ width }"></i>
        <b v-if="tick" :style="{ left: tick, opacity: tickHidden ? 0 : null }"></b>
      </div>
      <div class="bar-legend">
        <span class="num">{{ legendLeft }}</span>
        <span class="num">{{ legendRight }}</span>
      </div>
    </div>
  `,
};

/** The deck's name, how it is doing against its plan, and the controls. */
const ConsoleHeader = {
  props: {
    title: { type: String, required: true },
    hasPlan: { type: Boolean, required: true },
    planLabel: { type: String, default: '' },
    status: { type: String, default: '' },
    note: { type: String, default: '' },
    toggleLabel: { type: String, required: true },
    resetArmed: { type: Boolean, default: false },
  },

  emits: ['back', 'open-deck', 'toggle', 'reset'],

  template: `
    <header>
      <button class="back" title="Back to all decks" @click="$emit('back')">←</button>
      <span class="deck-title">{{ title }}</span>
      <template v-if="hasPlan">
        <span class="chip num">plan {{ planLabel }}</span>
        <span class="chip" :class="status" :title="note">{{ status }}</span>
      </template>
      <span v-else class="chip">no timing plan</span>
      <span class="spacer"></span>
      <button @click="$emit('open-deck')">Open deck window</button>
      <button class="primary" @click="$emit('toggle')">{{ toggleLabel }}</button>
      <button :class="{ armed: resetArmed }" @click="$emit('reset')">
        {{ resetArmed ? 'Reset — sure?' : 'Reset' }}
      </button>
    </header>
  `,
};

/** Why the timing panels are missing — a broken plan, or none at all. */
const NoPlanBanner = {
  props: {
    errors: { type: Array, default: () => [] },
  },

  template: `
    <div class="banner" :class="{ info: !errors.length }">
      <b>Running without a timing plan.</b>
      <template v-if="errors.length">
        This deck's timing stamps do not hold together:
        <ul><li v-for="error in errors" :key="error">{{ error }}</li></ul>
      </template>
      <template v-else>
        The deck carries no <code>timing-deck</code> / <code>timing-slide</code>
        comments, so buffer and pace are hidden.
      </template>
    </div>
  `,
};

/** What is on the beamer right now: the slide, the way forward, the notes. */
const SlideStage = {
  components: { SlidePreview },

  props: {
    deckUrl: { type: String, required: true },
    slide: { type: Number, required: true },
    slideCount: { type: Number, required: true },
    notes: { type: String, required: true },
    hasNotes: { type: Boolean, required: true },
    atStart: { type: Boolean, required: true },
    atEnd: { type: Boolean, required: true },
  },

  emits: ['prev', 'next'],

  template: `
    <section class="stage">
      <slide-preview :deck-url="deckUrl" :slide="slide" label="Current slide" />
      <div class="nav">
        <button :disabled="atStart" @click="$emit('prev')">◀ Prev</button>
        <div class="nav-meta">
          <span class="label num counter">Slide {{ slide }} of {{ slideCount }}</span>
        </div>
        <button :disabled="atEnd" @click="$emit('next')">Next ▶</button>
      </div>
      <div class="card notes-card">
        <div class="label">Notes</div>
        <div class="notes" :class="{ empty: !hasNotes }">{{ notes }}</div>
      </div>
    </section>
  `,
};

export const PresenterConsole = {
  components: { BarCard, ConsoleHeader, NoPlanBanner, SlidePreview, SlideStage, StatCard },

  props: {
    deck: { type: Object, required: true },
  },

  template: `
    <console-header
      :title="deck.title"
      :has-plan="hasPlan"
      :plan-label="planLabel"
      :status="deck.status"
      :note="deck.note ?? ''"
      :toggle-label="toggleLabel"
      :reset-armed="resetArmed"
      @back="goBack"
      @open-deck="openDeckWindow"
      @toggle="toggleTimer"
      @reset="pressReset"
    />

    <no-plan-banner v-if="!hasPlan" :errors="deck.errors" />

    <main>
      <slide-stage
        :deck-url="deck.url"
        :slide="current.index"
        :slide-count="slideCount"
        :notes="notesText"
        :has-notes="!!current.notes"
        :at-start="timer.index === 0"
        :at-end="timer.index === slideCount - 1"
        @prev="jumpTo(timer.index - 1)"
        @next="jumpTo(timer.index + 1)"
      />

      <aside class="rail">
        <div class="stats" :style="hasPlan ? null : { gridTemplateColumns: '1fr' }">
          <stat-card
            label="Elapsed"
            :value="elapsedText"
            :value-class="{ idle }"
            :sub="remainingText"
            sub-class="num"
          />
          <stat-card
            v-if="hasPlan"
            label="Buffer"
            :value="bufferText"
            :value-class="['state', status.bufferLevel, { idle }]"
            :sub="bufferLabel"
          />
        </div>

        <stat-card
          v-if="hasPlan"
          label="Pace needed for the remaining slides"
          :value="pace.text"
          :value-class="pace.classes"
          :sub="pace.label"
        />

        <bar-card
          v-if="hasPlan"
          label="This slide"
          :state="slideBar.state"
          :width="slideBar.width"
          :legend-left="slideBar.onSlide"
          :legend-right="slideBar.plan"
        />

        <bar-card
          v-if="hasPlan"
          label="Whole slides"
          :state="deckBar.state"
          :width="deckBar.width"
          :tick="deckBar.tickLeft"
          :tick-hidden="idle"
          :legend-left="deckBar.position"
          :legend-right="deckBar.left"
        />

        <div class="card">
          <div class="label">Next</div>
          <slide-preview
            :deck-url="deck.url"
            :slide="nextSlideNumber"
            :at-end="!next"
            label="Next slide"
            style="margin-top: 10px"
          />
          <div class="sub">{{ nextLabel }}</div>
        </div>
      </aside>
    </main>
  `,

  data() {
    return {
      timer: loadTimer(this.deck.syncId),
      // The only thing the interval moves. Every clock readout derives from it.
      now: Date.now(),
      resetArmed: false,
    };
  },

  computed: {
    slideCount() {
      return this.deck.slides.length;
    },

    // Without a usable plan the console still runs — previews, notes,
    // navigation and the elapsed clock — it just has nothing to compare
    // the clock against, so the plan panels drop out entirely.
    hasPlan() {
      return this.deck.hasPlan;
    },

    elapsedMin() {
      return elapsedMs(this.timer, this.now) / 60000;
    },

    onSlideMin() {
      return onSlideMs(this.timer, this.now) / 60000;
    },

    idle() {
      return isIdle(this.timer);
    },

    current() {
      return this.deck.slides[Math.min(this.timer.index, this.slideCount - 1)];
    },

    next() {
      return this.deck.slides[this.timer.index + 1] ?? null;
    },

    /** On the last slide there is nothing after it, so the frame simply stays. */
    nextSlideNumber() {
      return this.next ? this.next.index : this.slideCount;
    },

    status() {
      return this.hasPlan ? computeStatus(this.deck, this.timer.index, this.elapsedMin) : null;
    },

    planLabel() {
      return this.hasPlan ? formatClock(this.deck.estimatedMinutes) : '';
    },

    toggleLabel() {
      if (this.timer.running) return 'Pause';
      return this.timer.accMs === 0 ? 'Start' : 'Resume';
    },

    elapsedText() {
      return formatClock(this.elapsedMin);
    },

    notesText() {
      return this.current.notes || 'No notes on this slide.';
    },

    // The preview shows the slide itself; only its budget is worth spelling
    // out — and only when the plan it came from is one we trust.
    nextLabel() {
      if (!this.hasPlan || !this.next || this.next.minutes === null) return '';
      return `planned ${formatClock(this.next.minutes)}`;
    },

    remainingText() {
      if (!this.hasPlan) return '';
      const plan = formatClock(this.deck.estimatedMinutes);
      return this.status.remainingClock >= 0 ? `of ${plan} planned` : `over the ${plan} plan`;
    },

    // Signed both ways round: + minutes are yours to spend, − minutes are owed.
    bufferText() {
      return formatSigned(this.status.buffer);
    },

    // The figure above says how far off and its colour says how bad; the
    // caption is only left with which way.
    bufferLabel() {
      return {
        ok: 'on plan',
        ahead: 'ahead of plan',
        warn: 'behind plan',
        bad: 'behind plan',
      }[this.status.bufferLevel];
    },

    /** How much faster than planned the rest of the deck has to run. */
    pace() {
      const { remainingPlan, remainingClock, requiredSpeed } = this.status;

      if (remainingPlan <= 0) {
        return { text: 'done', classes: [], label: 'last slide — the plan is spent' };
      }

      if (remainingClock <= 0) {
        return {
          text: '—',
          classes: ['state', 'bad'],
          label: `no plan time left, ${formatClock(remainingPlan)} of slides to go`,
        };
      }

      const state = requiredSpeed <= 1.02 ? 'ok' : requiredSpeed <= 1.15 ? 'warn' : 'bad';
      return {
        text: `${requiredSpeed.toFixed(2)}×`,
        classes: ['state', state, { idle: this.idle }],
        label:
          state === 'ok'
            ? `${formatClock(remainingPlan)} of slides, ${formatClock(remainingClock)} of plan left`
            : `${formatClock(remainingPlan)} of slides in ${formatClock(remainingClock)}`,
      };
    },

    slideBar() {
      const ratio = this.onSlideMin / this.current.minutes;
      return {
        state: ratio > 1.5 ? 'bad' : ratio > 1 ? 'warn' : '',
        width: `${Math.min(ratio, 1) * 100}%`,
        onSlide: `${formatClock(this.onSlideMin)} on this slide`,
        plan: `planned ${formatClock(this.current.minutes)} · leave at ${formatClock(this.current.cumulative)}`,
      };
    },

    // The clock filling up the plan, with a tick where the plan says you
    // should be — fill past the tick means you are running behind.
    deckBar() {
      const { bufferLevel, budget, planPosition, remainingClock } = this.status;
      return {
        state: bufferLevel === 'bad' || bufferLevel === 'warn' ? bufferLevel : '',
        width: `${Math.min(this.elapsedMin / budget, 1) * 100}%`,
        tickLeft: `${Math.min(planPosition / budget, 1) * 100}%`,
        position: `Slide ${this.current.index} of ${this.slideCount}`,
        left:
          remainingClock >= 0
            ? `${formatClock(remainingClock)} left of ${formatClock(budget)}`
            : `${formatClock(-remainingClock)} over ${formatClock(budget)}`,
      };
    },
  },

  // The transitions in timer.js return new objects, so a shallow watch catches
  // every one of them: persistence is not something any handler has to
  // remember to do.
  watch: {
    timer(value) {
      saveTimer(this.deck.syncId, value);
    },
  },

  created() {
    // The console counts slides from 0; the channel speaks the 1-based numbers
    // the deck window and the slide counter show. Convert at this boundary.
    // Not reactive — it is a connection, not state to render.
    this.sync = createSync(this.deck.syncId, {
      getSlide: () => this.timer.index + 1,
      // The deck window moved (clicker, keyboard) — follow it without echoing:
      // setIndex only moves us, where jumpTo would announce the move straight
      // back to the window it came from.
      onSlide: (index) => this.setIndex(index - 1),
    });
  },

  mounted() {
    this.ticker = setInterval(() => (this.now = Date.now()), TICK_MS);
    document.addEventListener('keydown', this.onKeydown);
  },

  unmounted() {
    clearInterval(this.ticker);
    clearTimeout(this.resetTimeout);
    document.removeEventListener('keydown', this.onKeydown);
  },

  methods: {
    toggleTimer() {
      this.timer = toggled(this.timer);
    },

    /** Move, and tell the deck window to follow. */
    jumpTo(index) {
      const clamped = Math.min(Math.max(index, 0), this.slideCount - 1);
      this.setIndex(clamped);
      this.sync.announce(clamped + 1);
    },

    /** Move without announcing it — the local half of a move. */
    setIndex(index) {
      if (index === this.timer.index) return;
      this.timer = movedTo(this.timer, index);
    },

    openDeckWindow() {
      // The deck window opens straight onto the current slide, so reopening
      // one mid-lecture needs no correction afterwards.
      const { url, syncId } = this.deck;
      window.open(`${url}?slide=${this.timer.index + 1}&sync=${syncId}`, `deck-${syncId}`);
    },

    // The clock is stored per deck, so stepping out to the picker and back
    // resumes it exactly where it was.
    goBack() {
      location.assign('/');
    },

    /** Reset mid-lecture would be painful, so make it a two-click action. */
    pressReset() {
      if (this.resetArmed) {
        clearTimeout(this.resetTimeout);
        this.resetArmed = false;
        this.timer = blankTimer();
        this.jumpTo(0);
        return;
      }
      this.resetArmed = true;
      this.resetTimeout = setTimeout(() => (this.resetArmed = false), RESET_ARMED_MS);
    },

    onKeydown(event) {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (event.key === 'ArrowRight') this.jumpTo(this.timer.index + 1);
      else if (event.key === 'ArrowLeft') this.jumpTo(this.timer.index - 1);
      else if (event.key === 's') this.toggleTimer();
      else return;
      event.preventDefault();
    },
  },
};
