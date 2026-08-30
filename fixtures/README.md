# Test decks

Fixtures for the presenter. Point the tool at this folder:

```bash
marp-presenter path/to/fixtures
```

Each deck exercises something specific.

| Deck | What it is for |
|------|----------------|
| `01-timing-ok.md` | 35 stamped minutes against a 45 minute target — buffer, pace and both bars, plus notes, a very long heading, a slide with no heading, a comment inside a code fence that must **not** become a note |
| `02-timing-tight.md` | 43 minutes against a 45 minute target: two minutes spare against a 4.5 minute threshold, so the status chip reads `tight` while every readout stays live |
| `03-timing-over.md` | 52 minutes against a 45 minute target: the status chip reads `over`, and leaving the clock running turns the buffer red and overruns the whole-slides bar |
| `04-no-timing.md` | No stamps at all — the console runs without a plan: previews, notes, navigation and the clock, with the plan cards hidden |
| `05-broken-timing.md` | Every way a single stamp can go wrong: a leftover `cumulative` field, `minutes` that is not a number, a stamp that is not valid JSON, and a slide with no stamp at all. `check` fails on this deck **by design**, and the console lists every problem in a red banner |
| `06-duplicate-stamps.md` | A stamp that turns up twice, at both levels: two `timing-deck` comments, and one slide carrying two `timing-slide` stamps. The first of each pair wins, but the deck is reported as broken rather than quietly following one of them — every stamp in it is otherwise valid, so the duplicates are the only errors |
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
2 of 11 decks have inconsistent timing stamps.
```

Those are `05-broken-timing.md` and `06-duplicate-stamps.md`, on purpose — a folder
of fixtures should contain its broken cases. Exit code 1 is the correct outcome here.
