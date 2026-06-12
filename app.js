// ── Zone 1: Pure functions ────────────────────────────────────────────────────
// No DOM or localStorage access — safe to eval in Node for smoke testing.

function deepCopy(x) {
  return JSON.parse(JSON.stringify(x));
}

function uid(prefix) {
  return prefix + '-' + Math.random().toString(36).slice(2, 9);
}

function esc(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Sum of all ingredient percentages across all groups in a recipe.
function pctTotal(recipe) {
  let sum = 0;
  for (const g of recipe.groups)
    for (const ing of g.ingredients) sum += ing.pct || 0;
  return sum;
}

// Total dough grams for a batch, e.g. {size-2kin: 3, size-15kin: 4} = 5441 g.
function batchDoughGrams(quantities, sizes) {
  let total = 0;
  for (const size of sizes)
    total += (quantities[size.id] || 0) * size.doughGrams;
  return total;
}

// Flour weight from target dough and percent sum (targetDough × 100 / pctSum).
function flourGrams(targetDough, pctSum) {
  if (!pctSum) return 0;
  return (targetDough * 100) / pctSum;
}

// Grams for one ingredient given its baker's percentage and the flour weight.
function ingredientGrams(pct, flour) {
  return (flour * pct) / 100;
}

// Display rounding: ≥10 g → whole gram; <10 g → one decimal place.
function roundGrams(g) {
  if (g >= 10) return Math.round(g);
  return Math.round(g * 10) / 10;
}

function fmtGrams(g) {
  return roundGrams(g) + ' g';
}


// ── Zone 2: State + persistence ──────────────────────────────────────────────

const LS_KEY = 'breadScaling.v1';

let data;
let view             = 'calculator';
let selectedRecipeId = null;
let editingRecipeId  = null;
let quantities       = {};

function loadData() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed.sizes) && Array.isArray(parsed.recipes)) {
        data = parsed;
        return;
      }
    }
  } catch (_) {}
  data = deepCopy(DEFAULT_DATA);
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}


// ── Zone 3: DOM ───────────────────────────────────────────────────────────────

if (typeof document !== 'undefined') {

  // ── Renderers ──────────────────────────────────────────────────────────────

  function renderNav() {
    const tabs = [
      { id: 'calculator', label: 'Calculator' },
      { id: 'recipes',    label: 'Recipes'    },
      { id: 'sizes',      label: 'Sizes'      },
    ];
    return tabs.map(t =>
      `<button class="tab${view === t.id ? ' active' : ''}" data-action="nav" data-view="${t.id}">${t.label}</button>`
    ).join('');
  }

  function renderCalculator() {
    return `<div class="card"><p class="muted">Calculator — step 2.</p></div>`;
  }

  function renderRecipes() {
    return `<div class="card"><p class="muted">Recipe manager — step 3.</p></div>`;
  }

  function renderSizes() {
    return `<div class="card"><p class="muted">Size manager — step 4.</p></div>`;
  }

  function render() {
    document.getElementById('nav').innerHTML = renderNav();
    const views = {
      calculator: renderCalculator,
      recipes:    renderRecipes,
      sizes:      renderSizes,
    };
    document.getElementById('app').innerHTML = (views[view] || renderCalculator)();
  }

  // ── Export / Import ─────────────────────────────────────────────────────────

  function exportData() {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'bread-scaling-data.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  function importData(input) {
    const file = input.files[0];
    if (!file) return;
    file.text().then(text => {
      try {
        const parsed = JSON.parse(text);
        if (!Array.isArray(parsed.sizes) || !Array.isArray(parsed.recipes))
          throw new Error('invalid shape');
        data             = parsed;
        selectedRecipeId = data.recipes[0]?.id ?? null;
        editingRecipeId  = null;
        quantities       = {};
        save();
        render();
      } catch (_) {
        alert('Could not import — expected a valid bread-scaling-data.json file.');
      }
    });
    input.value = '';
  }

  // ── Event delegation ────────────────────────────────────────────────────────

  document.addEventListener('click', e => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const action = el.dataset.action;

    if (action === 'nav') {
      view = el.dataset.view;
      render();
    } else if (action === 'export') {
      exportData();
    } else if (action === 'import') {
      document.getElementById('import-file').click();
    } else if (action === 'reset') {
      if (confirm('Reset all data to defaults? This will erase any saved changes.')) {
        data             = deepCopy(DEFAULT_DATA);
        selectedRecipeId = data.recipes[0]?.id ?? null;
        editingRecipeId  = null;
        quantities       = {};
        save();
        render();
      }
    }
  });

  document.addEventListener('change', e => {
    if (e.target.id === 'import-file') importData(e.target);
  });

  // ── Init ────────────────────────────────────────────────────────────────────

  function init() {
    loadData();
    selectedRecipeId = data.recipes[0]?.id ?? null;
    render();
  }

  init();
}
