---
marp: true
theme: default
paginate: true
footer: '05-broken-timing'
---

[timing-deck]: # '{ "targetMinutes": 45, "note": "Intentionally broken: every way a slimmed-down stamp can still go wrong." }'

[timing-slide]: # '{ "minutes": 2 }'

# Broken Stamps

This deck's stamps do not hold up, on purpose. Only what cannot be derived is
stamped, so these are the four failures left to catch.

---

[timing-slide]: # '{ "minutes": 5, "cumulative": 7 }'

## A field left over from the old format

`cumulative` is computed now, so a stamp that still carries one is stale.

---

[timing-slide]: # '{ "minutes": "five" }'

## Minutes that are not a number

A stamp has to carry a number above 0.

---

[timing-slide]: # '{ "minutes": 4, }'

## A stamp that is not valid JSON

That trailing comma makes the whole stamp unreadable.

---

## This slide has no stamp at all

So the deck has more slides than stamps.

<!-- `check` should report all four problems, and the console should list
them in a red banner and fall back to no-plan mode. -->
