# marp-presenter

A custom presenter console for [Marp](https://marp.app/) decks.

## Features

TODO

## Use

TODO

## Speaker notes

Any HTML comment in a slide that is **not** a Marp directive is
picked up as that slide's notes:

```markdown
## Anatomy of a URL

<!-- Draw the URL on the board first.
Ask for the scheme before revealing it. -->
```

Multi-line comments keep their line breaks, and several comments on one slide are joined.
Comments inside fenced code blocks are left alone — those are HTML being taught, not notes.

## Timing stamps

A deck's timing plan lives in the deck, written as link reference definitions — a piece
of Markdown that no renderer shows. It never appears on a slide, and never as a speaker
note.

One stamp per deck, before the first slide:

```
[timing-deck]: # '{ "targetMinutes": 45, "note": "where this deck is likely to slip" }'
```

and one per slide:

```
[timing-slide]: # '{ "minutes": 4 }'
```

| Field           | Meaning                                           |
|-----------------|---------------------------------------------------|
| `targetMinutes` | The slot the deck has to fit, e.g. `45`           |
| `note`          | Optional: where this deck is likely to slip       |
| `minutes`       | Estimate for one slide                            |

That is everything you write. Slide numbers, running totals and the deck's estimate are
worked out from those, so inserting or reordering a slide leaves no stale number behind.
The console reads the deck as `ok`, `tight` — less than a tenth of the target to spare —
or `over`.

An apostrophe inside a stamp is written `\'`, because the JSON sits in a single-quoted
title.

`marp-presenter check` goes through a folder of decks and exits 1 if any stamp is
unreadable, missing, duplicated, or not a number.

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
