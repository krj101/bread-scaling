# Bread Scaling — Handoff

**Plan file:** `plan.md` (full context, scaling math, step-by-step build spec)  
**Status:** Step 1 complete. Steps 2–5 remaining before deploy (Step 6).

## What exists

| File | State |
|---|---|
| `data.js` | Complete. `DEFAULT_DATA` global with the real recipe + 2 sizes. |
| `index.html` | Complete. Static shell: sticky header, `<main id="app">`, footer with export/import/reset. |
| `styles.css` | Complete. Mobile-first base; card, button, tab styles; print media query. |
| `app.js` | Step 1 skeleton. Pure functions + persistence + tab nav + placeholder views. |
| `plan.md` | The authoritative spec for all 6 steps. |

## `app.js` structure — important for future editing

The file is divided into three clearly commented zones:

- **Zone 1 (pure functions)** — `deepCopy`, `uid`, `esc`, `pctTotal`, `batchDoughGrams`, `flourGrams`, `ingredientGrams`, `roundGrams`, `fmtGrams`. No DOM or localStorage access. Safe to eval in Node for testing.
- **Zone 2 (state + persistence)** — `data`, `view`, `selectedRecipeId`, `editingRecipeId`, `quantities`. `loadData()` (reads `LS_KEY = 'breadScaling.v1'` from localStorage, falls back to `deepCopy(DEFAULT_DATA)`), `save()` (one-liner setItem).
- **Zone 3 (DOM)** — Everything inside `if (typeof document !== 'undefined') { ... }`. Renderers return template-literal HTML strings. Single `render()` function swaps `#nav` innerHTML and `#app` innerHTML. Three delegated event listeners on `document` (click, change, input when added in later steps) dispatching on `data-action` attributes.

`DEFAULT_DATA` is a global defined in `data.js`, which is loaded before `app.js` in `index.html`. Zone 1 and 2 can reference it safely.

## Patterns established (follow these in Steps 2–5)

- **Event delegation only.** All click/input/change handling goes through the existing `document.addEventListener` blocks in Zone 3, dispatching on `data-action` / `data-field` / `data-qty` attributes. No per-element `.addEventListener` calls.
- **Structural changes** (add/delete items, change view, Done button): `save()` then `render()`.
- **Text/number field edits**: mutate `data` and `save()` on the `input` event *without* calling `render()` — this preserves focus and cursor position.
- **Partial re-render for the calculator**: when quantities change, re-render only `#results` (`document.getElementById('results').innerHTML = renderResults()`) rather than the whole view, so the focused qty input doesn't lose focus while typing.
- HTML-escape all user-supplied strings with `esc()` before interpolating into template literals.

## CSS notes

- Uses `color-mix(in srgb, ...)` for button hover backgrounds (~93% browser support, IE excluded — fine for this use case).
- Uses `100dvh` (dynamic viewport height) for the body — correct on mobile where browser chrome collapses/expands.
- Tab active indicator: `.tab` has `margin-bottom: -2px` so its `border-bottom` overlaps the `header`'s `border-bottom`, giving a seamless underline effect.
- Print styles are already in place: `@media print` hides header, footer, and `.no-print` elements. The calculator results card just needs `class="card"` (no extra work) to print cleanly.

## Smoke test results (Step 1 verification)

```
pctTotal: 192.64          ✓
1×2kin → flour: 470.8 g   ✓  water: 102 g  salt: 7.5 g
3×2kin + 4×1.5kin → dough: 5441 g  flour: 2824.4 g  salt: 45 g  ✓
```

## Things to address in later steps

- **Recipe name** is `dishsoapeddishwasher (extra salt)` — a real name the user chose. Don't change it; the user can rename via the Recipes tab (Step 3) once it's built.
- **"Scald" group label** — the water + rice flour group was named "Scald" based on the ingredient pair. The user may want to rename it; that will be trivial once the recipe editor (Step 3) is live.
- **Grams → percentages converter** — noted in plan.md as a future idea (out of scope). If the user raises it, it belongs in Step 3 as an optional import helper, not a core feature.
- **`gh` auth for deploy** — Step 6 requires `gh auth status` to be green. If not authenticated, provide manual GitHub instructions instead of failing silently.

## Conversation decisions not in plan.md

- **1.5 kin = 680 g**, not 450 g. The user initially said 450 g but corrected it to 1.5 lb ≈ 680 g.
- The "anchor size" concept from early planning was dropped entirely when the recipe format switched to baker's percentages. Every batch now scales exactly to its target dough weight — there is no reference loaf.
- The recipe as written in `data.js` sums to 192.64% (flour = 100%), which means flour weight for one 2-kin loaf is 907 / 1.9264 ≈ 471 g. The user is aware of this; the app will display actual ingredient grams, not the nominal pan weight.
