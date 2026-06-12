# Bread Recipe Scaling App — Implementation Plan

## Context

Kunal bakes bread in pans of different sizes: a "2 kin" pan (2 lb ≈ 907 g of dough) and a "1.5 kin" pan (1.5 lb ≈ 680 g), plus other dough sizes like buns and rolls defined directly by gram weight (e.g., large bun = 150 g, small bun = 100 g). He wants an app that scales recipes to arbitrary batches — e.g., "3 × 2-kin loaves + 4 × 1.5-kin loaves" — and shows exactly how many grams of each ingredient to use. It must be deployable online for free so it's usable from multiple places (kitchen phone, laptop, etc.).

Decisions made:

- **Static web app** — no backend server, free hosting (GitHub Pages). All math runs client-side.
- **Recipes are stored as baker's percentages** relative to bread flour (= 100%). The app computes grams from the batch's target dough weight, so any batch scales exactly — no anchor size needed.
- **Sizes are defined by dough weight in grams** (2 kin = 907 g, 1.5 kin = 680 g), and custom sizes can be added anytime. Sizes cover both pans and freestanding items (buns, rolls).
- **Multiple saved recipes**, each with **ingredient groups/stages** (e.g., scald + main dough) displayed as separate sections.

## Scaling model (baker's percentages)

Each ingredient stores a percentage relative to bread flour (bread flour = 100%). For a batch:

```
targetDough = Σ (quantity × size.doughGrams)        // e.g., 3×907 + 4×680 = 5441 g
flourGrams  = targetDough × 100 / Σ(all percentages)
ingredient  = flourGrams × pct / 100
```

The seed recipe's percentages sum to **192.64%**, so:

- 1 × 2 kin (907 g) → flour = 907 / 1.9264 = **471 g**; water (21.6%) = 102 g; salt (1.6%) = 7.5 g.
- 3 × 2 kin + 4 × 1.5 kin (5441 g) → flour = **2824 g**; water = 610 g; salt = 45 g.
- 6 × 150 g buns (900 g) → flour = 467 g.

Every batch produces exactly its target dough weight. Display rounding: computed values ≥ 10 g → whole grams; < 10 g (salt, yeast) → 0.1 g precision. Results show each ingredient's percentage alongside its grams, plus per-group subtotals, total dough, and flour weight.

## Architecture

Plain HTML + CSS + vanilla JavaScript — no framework, no build step, no dependencies. Instantly deployable to GitHub Pages, trivial to maintain.

```
Bread Scaling/
├── index.html        # App shell: calculator, recipe editor, size manager
├── styles.css        # Mobile-first styling (kitchen phone is a primary device)
├── app.js            # All logic: state, scaling math, rendering
├── data.js           # Default recipes + sizes (the "available everywhere" baseline)
├── plan.md           # This plan
└── CLAUDE.md
```

### Data model

```js
// Sizes — pans and freestanding items alike, defined by dough grams
{ id: "size-2kin",  name: "2 kin (2 lb)",   doughGrams: 907 }
{ id: "size-15kin", name: "1.5 kin (1.5 lb)", doughGrams: 680 }
// user-addable: { id, name: "Large bun", doughGrams: 150 }, etc.

// Recipes — ingredients as baker's percentages; groups support stages/preferments
{
  id: "recipe-dishsoap",
  name: "dishsoapeddishwasher (extra salt)",
  groups: [
    { name: "Scald", ingredients: [
      { name: "Water", pct: 21.6 },
      { name: "Rice flour", pct: 5.6 },
    ]},
    { name: "Main dough", ingredients: [
      { name: "Milk", pct: 14.4 },
      { name: "Yeast", pct: 2.24 },
      { name: "Bread flour", pct: 100 },
      { name: "Egg", pct: 16 },
      { name: "Brown sugar", pct: 8 },
      { name: "Rice syrup", pct: 3.2 },
      { name: "Buttermilk", pct: 8 },
      { name: "Milk powder", pct: 2.4 },
      { name: "Salt", pct: 1.6 },
      { name: "Butter", pct: 9.6 },
    ]},
  ],
}
```

This real recipe ships as the default seed data in `data.js`. The first group (water + rice flour) is labeled "Scald" — rename in-app if it should be something else. No special "flour" flag is needed: grams = targetDough × pct / Σpct, which automatically makes the 100% ingredient the flour weight.

### Persistence & multi-device strategy

- `data.js` holds default sizes and recipes, checked into the repo — baseline data loads on **every** device.
- `localStorage` stores edits/additions made in the browser (per-device).
- **Export / Import JSON** buttons move edited data between devices. When a recipe becomes permanent, bake it into `data.js` and redeploy.

## Build steps

### Step 1 — Scaffold & data layer

- **`index.html`**: static shell — header with app title and a 3-button tab nav (`Calculator`, `Recipes`, `Sizes`, each with `data-view`); an empty `<main id="app">` that JS renders into; a footer with `Export data` / `Import data` / `Reset to defaults` buttons and a hidden `<input type="file" accept=".json">` for import. Loads `data.js` then `app.js` at the end of `<body>`. Mobile viewport meta tag.
- **`data.js`**: just the `DEFAULT_DATA` global from the data model section (the dishsoapeddishwasher recipe + 2 kin / 1.5 kin sizes).
- **`app.js` layout** (one file, three zones):
  1. *Pure functions first, no DOM access* — so the math can be smoke-tested from the CLI with Node: `pctTotal(recipe)` (sum of all ingredient percentages), `batchDoughGrams(quantities, sizes)`, `flourGrams(targetDough, pctSum)`, `ingredientGrams(pct, flour)`, `roundGrams(g)` (≥10 → whole, <10 → 0.1), `fmtGrams(g)`, `esc(s)` (HTML-escape user text before interpolating into templates), `uid(prefix)`, `deepCopy(x)`.
  2. *State*: `data` (persisted) plus transient UI state — `view` ("calculator" default), `selectedRecipeId`, `editingRecipeId`, `quantities` (`{sizeId: count}`, in-memory only).
  3. *DOM code*: renderers + `init()`, with `if (typeof document !== "undefined") init();` at the bottom so Node can `eval` the file for testing without a browser.
- **Persistence**: `loadData()` reads localStorage key `breadScaling.v1`, validates shape (`sizes` and `recipes` are arrays), falls back to `deepCopy(DEFAULT_DATA)` on missing/corrupt data. `save()` is a one-line `localStorage.setItem`. Saves happen eagerly on every edit — no save button.
- **`styles.css`**: mobile-first, system font stack, single centered column (max-width ~720 px), card components, shared button classes (`.primary`, `.secondary`, `.danger`, `.icon`).

### Step 2 — Batch calculator (the core screen, default view)

- **Rendering pattern (used app-wide)**: views are template-literal HTML strings; `render()` swaps `#app.innerHTML` based on `view`. Event handling is *delegation only* — one `click`, one `input`, one `change` listener attached to `#app` once in `init()`, dispatching on `data-action` / `data-field` / `data-qty` attributes. Listeners survive re-renders; no per-element wiring.
- **Inputs card**: recipe `<select>` (`data-action="select-recipe"`), then one row per size: "2 kin (907 g)" + a number input (`min=0`, `inputmode="numeric"`, `data-qty="<sizeId>"`). This card gets class `no-print`.
- **Live results**: on qty input or recipe change, re-render *only* `#results` (not the whole view) so the focused input keeps focus while typing.
- **Results card** shows: per-line batch summary ("3 × 2 kin (907 g) = 2721 g"), prominent total dough weight and flour weight, then one table per group: ingredient name, computed grams (rounded per the display rules), baker's percentage in a muted third column, and a per-group subtotal row in grams. A small Print button (`window.print()`).
- **Empty states**: all quantities zero → "Enter quantities above…" hint; recipe whose percentages sum to zero → hint instead of dividing by zero; no recipes/sizes → pointer to the relevant tab.

### Step 3 — Recipe manager

- **List view**: one card per recipe showing name, "N groups, M ingredients, Σ% total", and an Edit button (`data-action="edit-recipe"`). A "+ New recipe" button appends a skeleton recipe (`{id: uid("recipe"), name: "New recipe", groups: [{name: "Main dough", ingredients: [{name: "Bread flour", pct: 100}]}]}`) and opens it for editing.
- **Inline editor** (replaces that recipe's card when `editingRecipeId` matches): recipe-name text input; per group a `<fieldset>` with group-name input + delete-group ✕; ingredient rows as a 3-column grid (name input / percentage number input with "%" suffix / ✕); "+ Ingredient" per group; "+ Group", "Delete recipe" (wrapped in `confirm()`), and "Done" buttons at the bottom.
- **Edit mechanics**: text/number edits mutate `data` and `save()` on the `input` event *without* re-rendering (preserves focus and cursor); structural actions (add/delete group/ingredient/recipe, Done) `save()` then `render()`. Row identity travels on the elements as `data-gi` (group index) and `data-ii` (ingredient index).
- **Deletion guards**: deleting the currently selected recipe re-points `selectedRecipeId` at the first remaining recipe; deleting a non-empty group asks for confirmation.

### Step 4 — Size manager

- Single card listing sizes as 3-column grid rows: name input, dough-grams number input, ✕ delete — same `input`-event editing pattern as the recipe editor, indices via `data-si`. "+ Add size" appends `{id: uid("size"), name: "", doughGrams: 0}`.
- **Guard**: deleting a size removes its entry from `quantities`.

### Step 5 — Export/Import + polish

- **Export**: `JSON.stringify(data, null, 2)` → `Blob` → temporary `<a download="bread-scaling-data.json">` click → revoke object URL.
- **Import**: hidden file input → `file.text()` → `JSON.parse` → same shape validation as `loadData()` → replace `data`, reset transient state, `save()` + `render()`; `alert()` on invalid file. Reset-to-defaults button restores `deepCopy(DEFAULT_DATA)` behind a `confirm()`.
- **Print stylesheet**: `@media print` hides header/nav, footer, and `.no-print` elements — printing from the calculator yields just the scaled recipe card.
- **Mobile pass**: check at ~375 px width — touch-target sizes, number inputs wide enough for 4 digits, tables not overflowing.
- *(Future idea, not in scope: a grams→percentages converter for entering new recipes that were written in grams.)*

### Step 6 — Deploy

- `git init` + initial commit in the project directory.
- `gh repo create bread-scaling --public --source . --push` (verify `gh auth status` first; if `gh` is missing/unauthenticated, hand the user the manual steps instead).
- Enable Pages from the main branch root: `gh api repos/{owner}/bread-scaling/pages -X POST -f "source[branch]=main" -f "source[path]=/"`.
- Confirm `https://<owner>.github.io/bread-scaling/` serves the app; report the URL.

Steps 1–5 are pure local development; each step leaves the app in a working state. After step 1, smoke-test the pure functions in Node (e.g., `batchDoughGrams({"size-2kin": 3, "size-15kin": 4}, sizes) === 5441` and `flourGrams(907, 192.64) ≈ 470.8`) before building UI on top of them.

## Verification

- Serve locally (`python -m http.server` or open `index.html`) and check:
  - 1 × 2 kin shows total dough **907 g**, flour **471 g**, water 102 g, salt 7.5 g.
  - 3 × 2 kin + 4 × 1.5 kin shows total dough **5441 g**, flour **2824 g**, salt 45 g.
  - Adding a custom size (e.g., "Large bun", 150 g) immediately appears in the calculator; 6 buns → 900 g total dough.
  - Edits to recipes/sizes survive a page reload (localStorage).
  - Export then import on a fresh browser profile restores the data.
  - Layout is usable at phone width (~375 px); print preview is clean.
- After deploy: load the GitHub Pages URL on a second device and confirm default data appears.
