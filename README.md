# marp-presenter

A custom presenter console for [Marp](https://marp.app/) decks.

## Features

TODO

## Use

TODO

## Speaker notes

Any HTML comment in a slide that is **not** a Marp directive and not a timing stamp is
picked up as that slide's notes:

```markdown
## Anatomy of a URL

<!-- Draw the URL on the board first.
Ask for the scheme before revealing it. -->
```

Multi-line comments keep their line breaks, and several comments on one slide are joined.
Comments inside fenced code blocks are left alone — those are HTML being taught, not notes.

## Timing stamps

The plan lives in HTML comments, which Marp treats as presenter notes, so they never
render onto a slide. A stamp carries only what cannot be derived from the deck itself —
everything else is computed while parsing, so it cannot fall out of sync with the slides.

One `timing-deck` block per deck, directly after the front matter:

```
<!-- timing-deck
{ "targetMinutes": 45, "note": "where this deck is likely to slip" }
-->
```

and one `timing-slide` comment per slide, on a single line, first thing in the slide
(after a `_class:` directive if the slide has one):

```
<!-- timing-slide {"minutes": 4} -->
```

| Stamped         | Meaning                                                 |
|-----------------|---------------------------------------------------------|
| `targetMinutes` | The slot the deck has to fit, e.g. `45`                 |
| `note`          | Optional prose: where this deck is likely to slip       |
| `minutes`       | Estimate for one slide                                  |

| Computed                     | How                                                    |
|------------------------------|--------------------------------------------------------|
| `estimatedMinutes`           | Sum of every slide's `minutes`                         |
| `remainingMinutes`           | `targetMinutes - estimatedMinutes`                     |
| `status`                     | `over` past the target · `tight` with less than a tenth of the target to spare · `ok` |
| slide `index`                | The slide's position in the deck                       |
| slide `start` / `cumulative` | Running total — where the clock should stand when you enter and leave that slide |
| slide `title`                | The slide's own heading, or `null` on a slide with none |

`check` reports what is left to get wrong: a stamp that is not valid JSON, `minutes` or
`targetMinutes` that is not a number above 0, a slide with no stamp, and any field a
stamp no longer knows — an `index` or `cumulative` left over from an older deck.

## Themes and rendering

A deck picks its theme with `theme:` in front matter. Marp's own `default`, `gaia` and
`uncover` come built in, and every `*.css` in the `--theme-set` folder is added alongside
them, so a custom theme can build on a built-in one with `@import 'default'`.

Everything else marp-core does works too, because it *is* marp-core: syntax highlighting,
math (`$$…$$`, rendered by MathJax), and auto-scaling directives such as `<!-- fit -->`.
Marp's browser helper is inlined into each deck page, which is what makes auto-scaling
work and what keeps SVG slides correct in Safari.

marp-core is the tool's only runtime dependency. It is a chunky one — roughly 73 MB
installed, most of that the MathJax and KaTeX engines it bundles for math support.

Raw HTML in decks is rendered as written — these are your own files, presented locally.
