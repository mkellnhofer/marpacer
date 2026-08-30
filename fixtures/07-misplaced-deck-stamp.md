---
marp: true
theme: default
paginate: true
footer: '07-misplaced-deck-stamp'
---

[timing-slide]: # '{ "minutes": 3 }'

# The Plan Is Somewhere Else

This deck carries exactly one `timing-deck` stamp, and every slide stamp is
valid — but the plan is not where a plan belongs.

---

[timing-deck]: # '{ "targetMinutes": 45, "note": "Intentionally broken: the only timing-deck stamp sits on the second slide instead of before the first." }'

[timing-slide]: # '{ "minutes": 5 }'

## Here it is, one slide too late

The deck still parses — `targetMinutes` is read from this stamp — but a plan
that hides mid-deck is easy to miss when editing, so `check` refuses it.

---

[timing-slide]: # '{ "minutes": 4 }'

## Nothing else is wrong here

One stamp per slide, one `timing-deck` in the deck. Placement is the only fault.

<!-- `check` should report the placement and nothing else, and the console
should fall back to no-plan mode. -->
