---
marp: true
theme: default
paginate: true
footer: '05-broken-timing'
---

<!-- timing-deck
{
  "block": "04",
  "lectureBudgetMinutes": 45,
  "exerciseBudgetMinutes": 45,
  "estimatedMinutes": 17,
  "deltaMinutes": -28,
  "status": "ok",
  "slideCount": 4,
  "note": "Intentionally inconsistent: one running total is wrong and the last slide lost its stamp."
}
-->

<!-- timing-slide {"index": 1, "kind": "title", "title": "Broken Stamps", "minutes": 2, "cumulative": 2} -->

# Broken Stamps

This deck's plan does not add up, on purpose.

---

<!-- timing-slide {"index": 2, "kind": "content", "title": "This slide's cumulative is wrong", "minutes": 5, "cumulative": 10} -->

## This slide's cumulative is wrong

Its stamp claims a running total three minutes ahead of the real one.

---

<!-- timing-slide {"index": 3, "kind": "content", "title": "This one is fine", "minutes": 5, "cumulative": 12} -->

## This one is fine

---

## This slide has no stamp at all

So the stamped count no longer matches the number of slides.

<!-- `check` should report both problems, and the console should list
them in a red banner and fall back to no-plan mode. -->
