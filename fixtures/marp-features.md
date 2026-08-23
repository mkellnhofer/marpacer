---
marp: true
theme: test
paginate: true
footer: 'marp-features'
---

# <!--fit--> This heading is long enough that Marp must scale it down to fit

Auto-scaling, via Marp's browser helper.

---

## Math

$$ \int_0^\infty e^{-x^2}\,dx = \frac{\sqrt{\pi}}{2} $$

And inline $E = mc^2$ as well.

<!-- Rendered by MathJax, as inline SVG. -->

---

## A local image

![width:420px](assets/diagram.svg)

Served from the deck folder, so relative paths must resolve.

---

## A custom theme

This deck uses `theme: test`, which begins with `@import 'default'`.

<!-- The slide background should be a pale tint, not white. -->

---

## Auto-scaling code

```js
// A long line that Marp's auto-scaling should shrink rather than clip ..........
const wide = 'x'.repeat(120);
```
