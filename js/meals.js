// Hearth AI — meals & groceries: plan generator, grocery aggregation, prep-cart (planner mode).
(function () {
"use strict";

const D = (typeof require !== "undefined") ? require("./data.js") : window.HearthData;
const store = (typeof require !== "undefined") ? require("./store.js") : window.HearthStore;

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function recipesForDiet(diet) {
  if (!diet || diet === "none") return D.RECIPES.slice();
  return D.RECIPES.filter(r => (r.tags || []).indexOf(diet) !== -1);
}

// Deterministic-ish rotation: pick meals so nothing repeats within the plan.
function generatePlan(opts) {
  opts = opts || {};
  const diet = opts.diet || "none";
  const servings = Math.max(1, opts.servings || 2);
  const days = Math.max(1, Math.min(14, opts.days || 7));
  const startOffset = opts.startOffset || 0; // rotate variety between generations
  const pool = recipesForDiet(diet);
  if (!pool.length) throw new Error("no recipes match diet: " + diet);

  const byMeal = { breakfast: [], lunch: [], dinner: [] };
  pool.forEach(r => {
    const m = r.meal || "any";
    if (m === "breakfast") byMeal.breakfast.push(r);
    else if (m === "lunch") byMeal.lunch.push(r);
    else byMeal.dinner.push(r);
    if (m === "any") { byMeal.lunch.push(r); byMeal.dinner.push(r); }
  });
  ["breakfast", "lunch", "dinner"].forEach(k => { if (!byMeal[k].length) byMeal[k] = pool.slice(); });

  const plan = [];
  const used = {};
  for (let d = 0; d < days; d++) {
    const day = { day: DAYS[d % 7], meals: {} };
    ["breakfast", "lunch", "dinner"].forEach(slot => {
      const list = byMeal[slot];
      let pick = null;
      for (let i = 0; i < list.length; i++) {
        const cand = list[(d + startOffset + i) % list.length];
        if (!used[cand.id]) { pick = cand; break; }
      }
      if (!pick) pick = list[(d + startOffset) % list.length];
      used[pick.id] = true;
      day.meals[slot] = pick.id;
    });
    plan.push(day);
  }
  return { diet, servings, days: plan.length, createdAt: new Date().toISOString(), plan };
}

function recipeById(id) { return D.RECIPES.find(r => r.id === id) || null; }

// Scale a recipe's ingredients to the plan's servings.
function scaledIngredients(recipe, servings) {
  const factor = servings / (recipe.servings || 1);
  return recipe.ingredients.map(i => ({
    name: i.name, qty: Math.round(i.qty * factor * 100) / 100,
    unit: i.unit, aisle: i.aisle, recipe: recipe.name
  }));
}

// Aggregate across the whole plan; same name+unit merges.
function groceryFromPlan(planObj) {
  const map = {};
  planObj.plan.forEach(day => {
    Object.keys(day.meals).forEach(slot => {
      const r = recipeById(day.meals[slot]);
      if (!r) return;
      scaledIngredients(r, planObj.servings).forEach(i => {
        const key = i.name + "|" + i.unit;
        if (!map[key]) map[key] = { name: i.name, qty: 0, unit: i.unit, aisle: i.aisle, recipes: [] };
        map[key].qty = Math.round((map[key].qty + i.qty) * 100) / 100;
        if (map[key].recipes.indexOf(i.recipe) === -1) map[key].recipes.push(i.recipe);
      });
    });
  });
  return Object.keys(map).map(k => map[k]).sort((a, b) => a.name.localeCompare(b.name));
}

function groupByAisle(items) {
  const order = {};
  D.AISLE_ORDER.forEach((a, i) => { order[a] = i; });
  const groups = {};
  items.forEach(it => {
    const a = it.aisle || "Pantry";
    (groups[a] = groups[a] || []).push(it);
  });
  return Object.keys(groups)
    .sort((a, b) => (order[a] == null ? 99 : order[a]) - (order[b] == null ? 99 : order[b]))
    .map(aisle => ({ aisle, items: groups[aisle].sort((x, y) => x.name.localeCompare(y.name)) }));
}

// Planner mode: the cart is prepared, never ordered. Approve = ready to take to the store.
function prepCart(list, label) {
  const cart = {
    id: "cart-" + Date.now().toString(36),
    label: label || "Weekly groceries",
    createdAt: new Date().toISOString(),
    status: "draft",
    items: list.map(it => ({ name: it.name, qty: it.qty, unit: it.unit, aisle: it.aisle, checked: false }))
  };
  const carts = store.get("groceryCarts", []);
  carts.unshift(cart);
  store.set("groceryCarts", carts);
  return cart;
}
function listCarts() { return store.get("groceryCarts", []); }
function getCart(id) { return listCarts().find(c => c.id === id) || null; }
function saveCart(cart) {
  const carts = listCarts().map(c => (c.id === cart.id ? cart : c));
  store.set("groceryCarts", carts);
  return cart;
}
function approveCart(id) {
  const cart = getCart(id);
  if (!cart) throw new Error("unknown cart: " + id);
  cart.status = "approved";
  cart.approvedAt = new Date().toISOString();
  return saveCart(cart);
}
function toggleCartItem(cartId, idx) {
  const cart = getCart(cartId);
  if (!cart || !cart.items[idx]) throw new Error("bad cart item");
  cart.items[idx].checked = !cart.items[idx].checked;
  return saveCart(cart);
}

function savePlan(planObj) { store.set("mealPlan", planObj); return planObj; }
function getPlan() { return store.get("mealPlan", null); }
function savePrefs(prefs) { store.set("mealPrefs", prefs); return prefs; }
function getPrefs() { return store.get("mealPrefs", { diet: "none", servings: 2 }); }

const api = { DAYS, recipesForDiet, recipeById, generatePlan, scaledIngredients,
              groceryFromPlan, groupByAisle, prepCart, listCarts, getCart, saveCart,
              approveCart, toggleCartItem, savePlan, getPlan, savePrefs, getPrefs };

if (typeof window !== "undefined") window.HearthMeals = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
