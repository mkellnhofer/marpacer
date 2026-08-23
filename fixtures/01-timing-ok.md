---
marp: true
theme: default
paginate: true
footer: '01-timing-ok'
---

<!-- timing-deck
{
  "block": "01",
  "lectureBudgetMinutes": 45,
  "exerciseBudgetMinutes": 45,
  "estimatedMinutes": 35,
  "deltaMinutes": -10,
  "status": "ok",
  "slideCount": 8,
  "note": "The happy path: stamps add up, five minutes of slack."
}
-->

<!-- timing-slide {"index": 1, "kind": "title", "title": "A Deck With A Plan", "minutes": 1, "cumulative": 1} -->

# A Deck With A Plan

Every slide here carries a timing stamp.

<!-- Say hello. This deck is the happy path. -->

---

<!-- timing-slide {"index": 2, "kind": "objectives", "title": "What this deck exercises", "minutes": 3, "cumulative": 4} -->

## What this deck exercises

- Drift, pace and both progress bars
- Speaker notes, including multi-line ones
- Several slide kinds

<!-- The rail should show every card:
elapsed, drift, pace, this slide, whole slides. -->

---

<!-- timing-slide {"index": 3, "kind": "content", "title": "Six minutes, to watch the slide bar fill", "minutes": 6, "cumulative": 10} -->

## Six minutes, to watch the slide bar fill

Long enough that the *this slide* bar turns amber if you linger.

<!-- Two comments on one slide are joined together. -->

<!-- This is the second one. -->

---

<!-- timing-slide {"index": 4, "kind": "content", "title": "A deliberately long heading that runs on and on so the console has something awkward to lay out", "minutes": 4, "cumulative": 14} -->

## A deliberately long heading that runs on and on so the console has something awkward to lay out

Checks that long titles do not break anything.

---

<!-- timing-slide {"index": 5, "kind": "content", "title": null, "minutes": 2, "cumulative": 16} -->

Some slides have no heading at all.

The stamp records `"title": null`.

---

<!-- timing-slide {"index": 6, "kind": "content", "title": "Code in several languages", "minutes": 8, "cumulative": 24} -->

## Code in several languages

```js
const drift = elapsed - planned;
```

```css
section { color: rebeccapurple; }
```

```html
<!-- inside a fence, so NOT a speaker note -->
<p>markup</p>
```

<!-- The fenced comment above must not reach the notes panel. -->

---

<!-- timing-slide {"index": 7, "kind": "content", "title": "Tables and quotes", "minutes": 5, "cumulative": 29} -->

## Tables and quotes

| Readout | Shows |
|---------|-------|
| Drift   | how far off plan |
| Pace    | how much faster to run |

> A blockquote, for good measure.

---

<!-- timing-slide {"index": 8, "kind": "recap", "title": "Recap", "minutes": 6, "cumulative": 35} -->

## Recap

- 35 planned minutes against a budget of 45
- Ten minutes of slack, so this deck reads **ok**

<!-- Last slide: Next is disabled and the next preview says "End of slides". -->
