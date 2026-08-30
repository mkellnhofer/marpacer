# Test decks

Fixtures for the presenter. Point the tool at this folder:

```bash
marp-presenter path/to/fixtures
```

Each deck exercises something specific.

| Deck | What it is for |
|------|----------------|
| `01-timing-ok.md` | A plan that adds up, with slack — buffer, pace and both bars, plus notes, several slide kinds, a very long heading, a slide with no heading, and a comment inside a code fence that must **not** become a note |
| `02-timing-tight.md` | 43 minutes against a 45 minute budget: two minutes spare against a 4.5 minute threshold, so the status chip reads `tight` while every readout stays live |
| `03-timing-over.md` | 52 minutes against a 45 minute budget: the status chip reads `over`, and leaving the clock running turns the buffer red and overruns the whole-slides bar |
| `04-no-timing.md` | No stamps at all — the console runs without a plan: previews, notes, navigation and the clock, with the plan cards hidden |
| `05-broken-timing.md` | Stamps that contradict each other (a wrong running total, and a slide with no stamp). `check` fails on this deck **by design**, and the console lists every problem in a red banner |
| `marp-features.md` | marp-core itself: `<!--fit-->` auto-scaling, MathJax math, highlighted code, a local image from `assets/`, and the custom theme in `themes/`. It carries no timing stamps — what it renders is the point, so it runs in no-plan mode |
| `built-in-themes/gaia.md`, `built-in-themes/uncover.md` | Marp's built-in themes, and decks in a subfolder |
| `edge-cases/ümlauts & spaces.md` | Spaces, an ampersand and non-ASCII in the path — URL encoding and the base64url sync id |
| `edge-cases/single-slide.md` | A one-slide deck: Prev and Next both disabled, next preview reads *End of slides* |
| `_partial.md` | Must **not** appear: files starting with `_` are skipped by deck discovery |

`themes/test-theme.css` is a small theme that starts with `@import 'default'`, so it also
checks that `--theme-set` loading and theme imports work.

## Expected `check` result

```
$ marp-presenter check .
…
1 of 10 decks have inconsistent timing stamps.
```

That one is `05-broken-timing.md`, on purpose — a folder of fixtures should contain a
broken case. Exit code 1 is the correct outcome here.
