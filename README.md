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
render onto a slide. One `timing-deck` block per deck, directly after the front matter:

```
<!-- timing-deck
{ "block": "1a", "lectureBudgetMinutes": 45, "exerciseBudgetMinutes": 45,
  "estimatedMinutes": 58.5, "deltaMinutes": 13.5, "status": "over",
  "slideCount": 30, "note": "where this deck is likely to slip" }
-->
```

and one `timing-slide` comment per slide, on a single line, first thing in the slide
(after a `_class:` directive if the slide has one):

```
<!-- timing-slide {"index": 9, "kind": "content", "title": "Anatomy of a URL", "minutes": 4, "cumulative": 16} -->
```

`cumulative` is the running total from slide 1 — where the clock should stand when you
leave that slide. Fields the console does not read — `block`, `exerciseBudgetMinutes`,
and `kind` — are carried along and ignored, so a deck that has no id or index needs
neither. `status` is `over` when the estimate exceeds `lectureBudgetMinutes`,
`tight` with 4 minutes or less to spare, otherwise `ok`.

Nothing recomputes `index` or `cumulative`, so inserting, deleting or reordering a slide
silently desyncs every stamp after it.

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
