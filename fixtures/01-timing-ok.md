---
marp: true
theme: default
paginate: true
footer: '01-timing-ok'
---

<!-- timing-deck
{
  "targetMinutes": 45,
  "note": "The happy path: 35 stamped minutes against a 45 minute target, so ten minutes of slack and a green status."
}
-->

<!-- timing-slide {"minutes": 1} -->

# A Deck With A Plan

Every slide here carries a timing stamp.

<!-- Say hello. This deck is the happy path. -->

---

<!-- timing-slide {"minutes": 3} -->

## What this deck exercises

- Buffer, pace and both progress bars
- Speaker notes, including multi-line ones
- Several slide kinds

<!-- The rail should show every card:
elapsed, buffer, pace, this slide, whole slides. -->

---

<!-- timing-slide {"minutes": 6} -->

## Six minutes, to watch the slide bar fill

Long enough that the *this slide* bar turns amber if you linger.

<!-- Two comments on one slide are joined together. -->

<!-- This is the second one. -->

---

<!-- timing-slide {"minutes": 4} -->

## A deliberately long heading that runs on and on so the console has something awkward to lay out

Checks that long titles do not break anything.

---

<!-- timing-slide {"minutes": 2} -->

Some slides have no heading at all.

The stamp records `"title": null`.

---

<!-- timing-slide {"minutes": 8} -->

## Code in several languages

```js
const buffer = planned - elapsed;
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

<!-- timing-slide {"minutes": 5} -->

## Tables and quotes

| Readout | Shows |
|---------|-------|
| Buffer  | time in hand against the plan |
| Pace    | how much faster to run |

> A blockquote, for good measure.

---

<!-- timing-slide {"minutes": 6} -->

## Recap

- 35 planned minutes against a target of 45
- Ten minutes of slack, so this deck reads **ok**

<!-- Last slide: Next is disabled and the next preview says "End of slides". -->
