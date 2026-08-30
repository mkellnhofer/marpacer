---
marp: true
theme: default
paginate: true
footer: '06-duplicate-stamps'
---

<!-- timing-deck
{
  "targetMinutes": 45,
  "note": "Intentionally broken: a stamp that turns up twice, once at deck level and once on a slide. The first of each pair wins, but the deck is reported as broken rather than quietly following one of them."
}
-->

<!-- timing-slide {"minutes": 3} -->

# Two Plans, One Deck

The stamp above is this deck's plan. A second one turns up on the next slide.

---

<!-- timing-deck
{
  "targetMinutes": 90,
  "note": "The second plan. A deck carries one, so this one never takes effect."
}
-->

<!-- timing-slide {"minutes": 5} -->

## The second timing-deck comment

The first stamp wins, so `targetMinutes` stays 45 — and `check` says so instead of
letting the deck run on either plan.

---

<!-- timing-slide {"minutes": 3} -->
<!-- timing-slide {"minutes": 30} -->

## Two stamps on one slide

Which one counts? Neither — a slide carries one.

---

<!-- timing-slide {"minutes": 4} -->

## Nothing else is wrong here

Every stamp in this deck is valid JSON with a sensible `minutes`. Only the two
duplicates are at fault.

<!-- `check` should report both duplicates and nothing else, and the console
should fall back to no-plan mode. -->
