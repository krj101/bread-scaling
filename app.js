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
let crossedOut       = new Set(); // transient: "recipeId-gi-ii"

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

  function renderBatchSummary() {
    const totalDough = batchDoughGrams(quantities, data.sizes);
    if (totalDough === 0) return '';
    const lines = data.sizes
      .filter(s => (quantities[s.id] || 0) > 0)
      .map(s => {
        const qty = quantities[s.id];
        return `<div class="summary-line">${qty} × ${esc(s.name)} = ${qty * s.doughGrams} g</div>`;
      })
      .join('');
    return `<div class="sidebar-summary">
      ${lines}
      <div class="summary-total">Total: ${fmtGrams(totalDough)}</div>
    </div>`;
  }

  function renderCalculator() {
    if (!data.recipes.length) {
      return `<div class="card"><p class="muted">No recipes yet — add one on the <button class="tab-link" data-action="nav" data-view="recipes">Recipes</button> tab.</p></div>`;
    }
    if (!data.sizes.length) {
      return `<div class="card"><p class="muted">No sizes yet — add one on the <button class="tab-link" data-action="nav" data-view="sizes">Sizes</button> tab.</p></div>`;
    }

    const recipeOptions = data.recipes.map(r =>
      `<option value="${esc(r.id)}"${r.id === selectedRecipeId ? ' selected' : ''}>${esc(r.name)}</option>`
    ).join('');

    const sizeRows = data.sizes.map(s =>
      `<div class="size-row">
        <span class="size-label">${esc(s.name)}</span>
        <input class="qty-input" type="number" min="0" inputmode="numeric" value="${quantities[s.id] || 0}" data-qty="${esc(s.id)}">
      </div>`
    ).join('');

    return `
      <div class="calc-layout">
        <aside class="calc-sidebar no-print">
          <div class="card sidebar-card">
            <div class="field-group">
              <span class="field-label">Recipe</span>
              <select data-action="select-recipe">${recipeOptions}</select>
            </div>
            <div class="field-label" style="margin-bottom:0.5rem">Quantity</div>
            <div class="sizes-list">${sizeRows}</div>
          </div>
          <div id="batch-summary">${renderBatchSummary()}</div>
        </aside>
        <div class="calc-main">
          <div id="results">${renderResults()}</div>
        </div>
      </div>
    `;
  }

  function renderResults() {
    const recipe = data.recipes.find(r => r.id === selectedRecipeId) || data.recipes[0];
    if (!recipe) return '';

    const totalDough = batchDoughGrams(quantities, data.sizes);

    if (totalDough === 0) {
      return `<div class="card"><p class="muted">Enter quantities to the left to see scaled amounts.</p></div>`;
    }

    const pctSum = pctTotal(recipe);
    if (!pctSum) {
      return `<div class="card"><p class="muted">This recipe has no ingredients — add some on the Recipes tab.</p></div>`;
    }

    const flour = flourGrams(totalDough, pctSum);

    const groupSections = recipe.groups.map((g, gi) => {
      const rows = g.ingredients.map((ing, ii) => {
        const grams = ingredientGrams(ing.pct, flour);
        const key   = `${selectedRecipeId}-${gi}-${ii}`;
        const cls   = crossedOut.has(key) ? ' crossed' : '';
        return `<tr class="ing-result-row${cls}" data-action="toggle-cross" data-gi="${gi}" data-ii="${ii}">
          <td>${esc(ing.name)}</td>
          <td class="num">${fmtGrams(grams)}</td>
        </tr>`;
      }).join('');

      const groupTotal = g.ingredients.reduce((sum, ing) => sum + ingredientGrams(ing.pct, flour), 0);

      return `<div class="group-section">
        <h3 class="group-name">${esc(g.name)}</h3>
        <table class="results-table">
          <tbody>${rows}</tbody>
          <tfoot>
            <tr class="subtotal-row">
              <td>Subtotal</td>
              <td class="num">${fmtGrams(groupTotal)}</td>
            </tr>
          </tfoot>
        </table>
      </div>`;
    }).join('');

    return `<div class="card">
      ${groupSections}
      <div class="print-bar no-print">
        <button class="secondary" data-action="print">Print</button>
      </div>
    </div>`;
  }

  function renderRecipeEditor(r) {
    const groupFields = r.groups.map((g, gi) => {
      const ingRows = g.ingredients.map((ing, ii) => `
        <div class="ing-row">
          <input class="text-input" type="text" value="${esc(ing.name)}" placeholder="Ingredient" data-field="ing-name" data-gi="${gi}" data-ii="${ii}">
          <div class="pct-field">
            <input class="num-input" type="number" step="0.01" min="0" value="${ing.pct}" data-field="ing-pct" data-gi="${gi}" data-ii="${ii}">
            <span class="pct-suffix">%</span>
          </div>
          <button class="icon" data-action="delete-ingredient" data-gi="${gi}" data-ii="${ii}" title="Delete">✕</button>
        </div>`).join('');

      return `<fieldset class="group-fieldset">
        <div class="group-header">
          <input class="text-input" type="text" value="${esc(g.name)}" placeholder="Group name" data-field="group-name" data-gi="${gi}">
          <button class="icon" data-action="delete-group" data-gi="${gi}" title="Delete group">✕</button>
        </div>
        <div class="ing-list">${ingRows}</div>
        <button class="secondary small" data-action="add-ingredient" data-gi="${gi}">+ Ingredient</button>
      </fieldset>`;
    }).join('');

    return `<div class="card editor-card">
      <div class="field-group">
        <span class="field-label">Recipe name</span>
        <input class="text-input" type="text" value="${esc(r.name)}" data-field="recipe-name">
      </div>
      ${groupFields}
      <div class="editor-actions">
        <button class="secondary" data-action="add-group">+ Group</button>
        <div class="editor-actions-right">
          <button class="danger" data-action="delete-recipe" data-rid="${esc(r.id)}">Delete</button>
          <button class="primary" data-action="done-edit">Done</button>
        </div>
      </div>
    </div>`;
  }

  function renderRecipes() {
    const newBtn = `<button class="primary" data-action="add-recipe">+ New recipe</button>`;

    if (!data.recipes.length) {
      return `<div class="card">
        <p class="muted" style="margin-bottom:0.75rem">No recipes yet.</p>
        ${newBtn}
      </div>`;
    }

    const cards = data.recipes.map(r => {
      if (r.id === editingRecipeId) return renderRecipeEditor(r);
      const groupCount = r.groups.length;
      const ingCount   = r.groups.reduce((s, g) => s + g.ingredients.length, 0);
      return `<div class="card recipe-card">
        <div class="recipe-card-header">
          <strong>${esc(r.name)}</strong>
          <button class="secondary" data-action="edit-recipe" data-rid="${esc(r.id)}">Edit</button>
        </div>
        <p class="muted">${groupCount} group${groupCount !== 1 ? 's' : ''}, ${ingCount} ingredient${ingCount !== 1 ? 's' : ''} · Σ ${pctTotal(r)}%</p>
      </div>`;
    }).join('');

    return cards + `<div class="add-recipe-bar">${newBtn}</div>`;
  }

  function renderSizes() {
    const rows = data.sizes.map((s, si) => `
      <div class="size-editor-row">
        <input class="text-input" type="text" value="${esc(s.name)}" placeholder="Size name" data-field="size-name" data-si="${si}">
        <div class="pct-field">
          <input class="num-input" type="number" min="0" value="${s.doughGrams}" data-field="size-grams" data-si="${si}">
          <span class="pct-suffix">g</span>
        </div>
        <button class="icon" data-action="delete-size" data-si="${si}" title="Delete">✕</button>
      </div>`
    ).join('');

    return `<div class="card">
      <div class="size-editor-list">${rows || '<p class="muted" style="margin-bottom:0.75rem">No sizes yet.</p>'}</div>
      <button class="primary" data-action="add-size">+ Add size</button>
    </div>`;
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
    } else if (action === 'toggle-cross') {
      const key = `${selectedRecipeId}-${el.dataset.gi}-${el.dataset.ii}`;
      crossedOut.has(key) ? crossedOut.delete(key) : crossedOut.add(key);
      const results = document.getElementById('results');
      if (results) results.innerHTML = renderResults();
    } else if (action === 'print') {
      window.print();
    } else if (action === 'edit-recipe') {
      editingRecipeId = el.dataset.rid;
      render();
    } else if (action === 'add-recipe') {
      const newRecipe = {
        id: uid('recipe'),
        name: 'New recipe',
        groups: [{ name: 'Main dough', ingredients: [{ name: 'Bread flour', pct: 100 }] }],
      };
      data.recipes.push(newRecipe);
      editingRecipeId = newRecipe.id;
      save();
      render();
    } else if (action === 'done-edit') {
      editingRecipeId = null;
      render();
    } else if (action === 'delete-recipe') {
      if (!confirm('Delete this recipe? This cannot be undone.')) return;
      const rid = el.dataset.rid;
      data.recipes = data.recipes.filter(r => r.id !== rid);
      if (selectedRecipeId === rid) selectedRecipeId = data.recipes[0]?.id ?? null;
      editingRecipeId = null;
      save();
      render();
    } else if (action === 'add-group') {
      const recipe = data.recipes.find(r => r.id === editingRecipeId);
      if (recipe) { recipe.groups.push({ name: 'New group', ingredients: [] }); save(); render(); }
    } else if (action === 'delete-group') {
      const recipe = data.recipes.find(r => r.id === editingRecipeId);
      if (!recipe) return;
      const gi = parseInt(el.dataset.gi, 10);
      const g  = recipe.groups[gi];
      if (g.ingredients.length && !confirm(`Delete "${g.name}" and its ${g.ingredients.length} ingredient${g.ingredients.length !== 1 ? 's' : ''}?`)) return;
      recipe.groups.splice(gi, 1);
      save();
      render();
    } else if (action === 'add-ingredient') {
      const recipe = data.recipes.find(r => r.id === editingRecipeId);
      if (!recipe) return;
      recipe.groups[parseInt(el.dataset.gi, 10)].ingredients.push({ name: '', pct: 0 });
      save();
      render();
    } else if (action === 'delete-ingredient') {
      const recipe = data.recipes.find(r => r.id === editingRecipeId);
      if (!recipe) return;
      recipe.groups[parseInt(el.dataset.gi, 10)].ingredients.splice(parseInt(el.dataset.ii, 10), 1);
      save();
      render();
    } else if (action === 'add-size') {
      data.sizes.push({ id: uid('size'), name: '', doughGrams: 0 });
      save();
      render();
    } else if (action === 'delete-size') {
      const si     = parseInt(el.dataset.si, 10);
      const sizeId = data.sizes[si].id;
      data.sizes.splice(si, 1);
      delete quantities[sizeId];
      save();
      render();
    }
  });

  document.addEventListener('change', e => {
    if (e.target.id === 'import-file') importData(e.target);
    if (e.target.dataset.action === 'select-recipe') {
      selectedRecipeId = e.target.value;
      const results = document.getElementById('results');
      const summary = document.getElementById('batch-summary');
      if (results) results.innerHTML = renderResults();
      if (summary) summary.innerHTML = renderBatchSummary();
    }
  });

  document.addEventListener('input', e => {
    const qtyId = e.target.dataset.qty;
    if (qtyId) {
      quantities[qtyId] = parseInt(e.target.value, 10) || 0;
      const results  = document.getElementById('results');
      const summary  = document.getElementById('batch-summary');
      if (results) results.innerHTML = renderResults();
      if (summary) summary.innerHTML = renderBatchSummary();
      return;
    }

    const field = e.target.dataset.field;
    if (field && 'si' in e.target.dataset) {
      const si = parseInt(e.target.dataset.si, 10);
      if      (field === 'size-name')  data.sizes[si].name       = e.target.value;
      else if (field === 'size-grams') data.sizes[si].doughGrams = parseInt(e.target.value, 10) || 0;
      save();
      return;
    }
    if (field && editingRecipeId) {
      const recipe = data.recipes.find(r => r.id === editingRecipeId);
      if (!recipe) return;
      const gi = 'gi' in e.target.dataset ? parseInt(e.target.dataset.gi, 10) : null;
      const ii = 'ii' in e.target.dataset ? parseInt(e.target.dataset.ii, 10) : null;
      if      (field === 'recipe-name')                    recipe.name = e.target.value;
      else if (field === 'group-name'  && gi !== null)     recipe.groups[gi].name = e.target.value;
      else if (field === 'ing-name'    && gi !== null && ii !== null) recipe.groups[gi].ingredients[ii].name = e.target.value;
      else if (field === 'ing-pct'     && gi !== null && ii !== null) recipe.groups[gi].ingredients[ii].pct  = parseFloat(e.target.value) || 0;
      save();
    }
  });

  // ── Init ────────────────────────────────────────────────────────────────────

  function init() {
    loadData();
    selectedRecipeId = data.recipes[0]?.id ?? null;
    render();
  }

  init();
}
