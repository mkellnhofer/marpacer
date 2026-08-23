# Test decks

Fixtures for the presenter.

Each deck exercises something specific.

| Deck | What it is for |
|------|----------------|
| `01-timing-ok.md` | A plan that adds up, with slack — drift, pace and both bars, plus notes, several slide kinds, a very long heading, a slide with no heading, and a comment inside a code fence that must **not** become a note |
| `02-timing-tight.md` | 43 minutes against a 45 minute budget: two minutes spare against a 4.5 minute threshold, so the status chip reads `tight` while every readout stays live |
| `03-timing-over.md` | 52 minutes against a 45 minute budget: the status chip reads `over`, and leaving the clock running turns drift red and overruns the whole-slides bar |
| `04-no-timing.md` | No stamps at all — the console runs without a plan: previews, notes, navigation and the clock, with the plan cards hidden |
| `05-broken-timing.md` | Stamps that contradict each other (a wrong running total, and a slide with no stamp). |
| `marp-features.md` | marp-core itself: `<!--fit-->` auto-scaling, MathJax math, highlighted code, a local image from `assets/`, and the custom theme in `themes/`. It carries no timing stamps — what it renders is the point, so it runs in no-plan mode |
| `built-in-themes/gaia.md`, `built-in-themes/uncover.md` | Marp's built-in themes, and decks in a subfolder |
| `edge-cases/ümlauts & spaces.md` | Spaces, an ampersand and non-ASCII in the path — URL encoding and the base64url sync id |
| `edge-cases/single-slide.md` | A one-slide deck: Prev and Next both disabled, next preview reads *End of slides* |
| `_partial.md` | Must **not** appear: files starting with `_` are skipped by deck discovery |

`themes/test-theme.css` is a small theme that starts with `@import 'default'`, so it also
checks that `--theme-set` loading and theme imports work.
