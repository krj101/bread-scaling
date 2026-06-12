# Bread Scaling — Handoff

**Plan file:** `plan.md` (full context, scaling math, step-by-step build spec)  
**Status:** All 6 steps complete. App is live at **https://krj101.github.io/bread-scaling/**

## What exists

| File | State |
|---|---|
| `data.js` | Complete. `DEFAULT_DATA` global with the real recipe + 2 sizes. |
| `index.html` | Complete. Static shell: sticky header, `<main id="app">`, footer with export/import/reset. |
| `styles.css` | Complete. Mobile-first; card, button, tab, calculator, recipe/size editor, print styles. |
| `app.js` | Complete. All 5 functional zones implemented and deployed. |
| `plan.md` | The authoritative spec for all 6 steps. |

## `app.js` structure

Three clearly commented zones:

- **Zone 1 (pure functions)** — `deepCopy`, `uid`, `esc`, `pctTotal`, `batchDoughGrams`, `flourGrams`, `ingredientGrams`, `roundGrams`, `fmtGrams`. No DOM or localStorage access.
- **Zone 2 (state + persistence)** — `data`, `view`, `selectedRecipeId`, `editingRecipeId`, `quantities`, `crossedOut` (transient Set). `loadData()` reads `LS_KEY = 'breadScaling.v1'`, falls back to `deepCopy(DEFAULT_DATA)`. `save()` is a one-liner setItem.
- **Zone 3 (DOM)** — All renderers + event delegation + `init()`.

Renderers: `renderNav`, `renderBatchSummary`, `renderCalculator`, `renderResults`, `renderRecipeEditor`, `renderRecipes`, `renderSizes`.

## Calculator layout (differs from plan.md spec)

The plan described a stacked layout. The actual implementation uses a **two-column sidebar layout**:

- **Left sidebar** (`.calc-sidebar`, 240px, `no-print`): recipe `<select>` + quantity inputs per size, then `#batch-summary` below (per-size breakdown + total dough weight). Updates live on qty input.
- **Right main** (`.calc-main`, `flex: 1`): `#results` — ingredient tables, centered. Stacks vertically below 540px.

Partial re-renders (preserve input focus): qty input → update `#results` + `#batch-summary`. Recipe change → same two targets.

## UI decisions not in plan.md

- **Baker's percentages column removed** from the results table — user preference, only grams shown.
- **Total dough / flour header removed** from the results card — that info lives in the sidebar summary instead.
- **Ingredient cross-off**: clicking any ingredient row in the results toggles a strikethrough. State lives in `crossedOut` Set (session-only, resets on reload). Keys are `"${recipeId}-${gi}-${ii}"`.
- **Subtotal rows** are shown per group in the results table.

## Patterns (follow these for any future edits)

- **Event delegation only.** All click/input/change handling goes through delegated listeners on `document`, dispatching on `data-action` / `data-field` / `data-qty` / `data-si` attributes. No per-element `.addEventListener` calls.
- **Structural changes** (add/delete items, change view, Done button): `save()` then `render()`.
- **Text/number field edits**: mutate `data` and `save()` on the `input` event *without* calling `render()` — preserves focus and cursor.
- **Partial re-render for the calculator**: qty input → update only `#results` and `#batch-summary` (not the whole view).
- HTML-escape all user-supplied strings with `esc()` before interpolating into template literals.
- Size fields use `data-si` index. Recipe/group/ingredient fields use `data-gi` / `data-ii` indices + `data-field` name. The editing recipe is identified by `editingRecipeId` state.

## Data persistence

- `data.js` — baseline defaults, loaded on every device on every load.
- `localStorage` (`breadScaling.v1`) — per-browser edits (new sizes, recipe changes). Device-local only.
- Export/Import JSON buttons in the footer move data between devices.
- To make something permanent everywhere: edit `data.js`, commit, push → GitHub Pages auto-serves it.

## Deploy

- Repo: https://github.com/krj101/bread-scaling (branch: `master`)
- Live URL: https://krj101.github.io/bread-scaling/
- GitHub Pages is configured on `master` branch root. Push to `master` → live within ~1 minute.
- `gh auth status` confirms `krj101` is authenticated.

## Things to address if returning

- **Recipe name** is `dishsoapeddishwasher (extra salt)` — the user's real name, rename via the Recipes tab if desired.
- **"Scald" group label** — the water + rice flour group; rename via the Recipes tab.
- **Grams → percentages converter** — noted in plan.md as a future idea (out of scope). Would live in the Recipes tab as an import helper.
- **Cross-off state is session-only** — if persistence across reloads is ever wanted, serialize `crossedOut` to localStorage separately (don't put it in `data`).
- **Multi-device sync** — currently manual via Export/Import. No backend; any real-time sync would require a third-party service or a small backend.
