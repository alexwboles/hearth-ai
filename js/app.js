// Hearth AI — UI wiring (browser only).
(function () {
"use strict";

const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

const S = window.HearthStore, D = window.HearthData, M = window.HearthMeals,
      H = window.HearthHealth, Sch = window.HearthSchedule, C = window.HearthComms,
      Sh = window.HearthSheets, R = window.HearthResearch, P = window.HearthProactive,
      Chat = window.HearthChat;

let toastTimer = null;
function toast(msg) {
  const t = $("toast");
  t.textContent = msg;
  t.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
}

// ---------- Navigation ----------
const VIEWS = [
  ["chat", "Chat", "Talk to Hearth"],
  ["meals", "Meals & Groceries", "Plan meals, build the list, prep the cart"],
  ["health", "Health", "Logs, trends and predictive nudges"],
  ["schedule", "Schedule", "Tasks, calendar and meeting prep"],
  ["comms", "Comms", "Draft emails and call scripts — you approve"],
  ["sheets", "Sheets", "Editable grids with CSV import/export"],
  ["research", "Research", "Structured briefs on any topic"],
  ["briefing", "Briefing", "Your morning briefing and weekly review"]
];
function buildNav() {
  $("nav").innerHTML = VIEWS.map(v =>
    '<button class="nav-btn' + (v[0] === "chat" ? " active" : "") + '" data-view="' + v[0] + '"><span class="dot"></span>' + esc(v[1]) + "</button>").join("");
  $("nav").querySelectorAll(".nav-btn").forEach(b => b.addEventListener("click", () => showView(b.dataset.view)));
}
function showView(id) {
  document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
  document.querySelectorAll(".nav-btn").forEach(b => b.classList.toggle("active", b.dataset.view === id));
  $("view-" + id).classList.add("active");
  const v = VIEWS.find(x => x[0] === id);
  $("viewTitle").textContent = v[1];
  $("viewSub").textContent = v[2];
  if (id === "meals") renderMeals();
  if (id === "health") renderHealth();
  if (id === "schedule") renderSchedule();
  if (id === "comms") renderComms();
  if (id === "sheets") renderSheets();
  if (id === "research") renderResearch();
  if (id === "briefing") renderBriefing();
  window.scrollTo(0, 0);
}

// ---------- Profiles ----------
function refreshProfiles() {
  const sel = $("profileSelect");
  const profiles = S.listProfiles();
  sel.innerHTML = profiles.map(p => '<option value="' + p.id + '">' + esc(p.name) + "</option>").join("");
  sel.value = S.activeProfileId();
}
function switchProfileTo(id) {
  S.switchProfile(id);
  renderAll();
  toast("Switched to " + S.activeProfile().name);
}

// ---------- Chat ----------
const QUICK = ["Morning briefing", "Plan my meals this week", "Log 7 hours of sleep", "What nudges do you have?", "Draft email", "Research robot vacuum"];
function renderChat() {
  $("chatQuick").innerHTML = QUICK.map(q => '<button class="chip" data-q="' + esc(q) + '">' + esc(q) + "</button>").join("");
  $("chatQuick").querySelectorAll(".chip").forEach(c => c.addEventListener("click", () => sendChat(c.dataset.q)));
  const log = $("chatLog");
  const hist = Chat.getLog();
  log.innerHTML = "";
  if (!hist.length) addBotMsg("Hello " + esc(S.activeProfile().name) + ". I'm Hearth — I plan, draft and predict across your meals, health, schedule and more. Everything I make is a proposal for you to approve. What shall we sort out first?", [
    { label: "Morning briefing", run: "briefing" }, { label: "Plan my meals", run: "plan_meals" }, { label: "What can you do?", run: "help" }
  ]);
  hist.forEach(h => { addUserMsg(h.user, true); addBotMsg(h.assistant, [], true); });
  log.scrollTop = log.scrollHeight;
}
function addUserMsg(text, skip) {
  const d = document.createElement("div");
  d.className = "msg user";
  d.textContent = text;
  $("chatLog").appendChild(d);
  if (!skip) $("chatLog").scrollTop = $("chatLog").scrollHeight;
  return d;
}
function addBotMsg(html, actions, skip) {
  const d = document.createElement("div");
  d.className = "msg bot";
  d.innerHTML = '<div class="who">Hearth</div><div>' + html.replace(/\n/g, "<br>") + "</div>";
  if (actions && actions.length) {
    const chips = document.createElement("div");
    chips.className = "chips";
    actions.forEach(a => {
      const b = document.createElement("button");
      b.className = "chip";
      b.textContent = a.label;
      b.addEventListener("click", () => {
        const res = Chat.runAction(a.run);
        addUserMsg(a.label);
        Chat.saveExchange(a.label, res);
        addBotMsg(esc(res.reply), res.actions);
        if (res.view) showView(res.view);
      });
      chips.appendChild(b);
    });
    d.appendChild(chips);
  }
  $("chatLog").appendChild(d);
  if (!skip) $("chatLog").scrollTop = $("chatLog").scrollHeight;
}
function sendChat(text) {
  text = (text == null ? $("chatInput").value : text).trim();
  if (!text) return;
  $("chatInput").value = "";
  addUserMsg(text);
  const res = Chat.respond(text);
  Chat.saveExchange(text, res);
  addBotMsg(esc(res.reply), res.actions);
}

// ---------- Meals ----------
function renderMeals() {
  const prefs = M.getPrefs();
  $("dietSel").innerHTML = D.DIETS.map(d => '<option value="' + d.id + '"' + (d.id === prefs.diet ? " selected" : "") + ">" + esc(d.name) + "</option>").join("");
  $("servingsIn").value = prefs.servings;
  renderPlan(); renderCarts(); renderPantry(); renderBudget();
}

// ---------- Pantry ----------
function renderPantry() {
  const items = M.listPantry();
  const exp = M.expiringPantry(4);
  const warn = exp.length
    ? '<div class="warnbox"><strong>Use soon (' + exp.length + '):</strong> ' +
      exp.map(x => esc(x.name) + " <span class='meta'>by " + esc(x.expires) + "</span>").join(" · ") + "</div>"
    : "";
  $("pantryWarn").innerHTML = warn;
  $("pantryOut").innerHTML = items.length
    ? '<table class="data"><tbody>' + items.map(x =>
      "<tr><td><strong>" + esc(x.name) + "</strong> <span class='meta'>" + x.qty + " " + esc(x.unit) +
      (x.expires ? " · expires " + esc(x.expires) : "") + "</span></td>" +
      '<td style="text-align:right"><button class="btn btn-ghost btn-sm" data-pantry-del="' + x.id + '">Remove</button></td></tr>'
    ).join("") + "</tbody></table>"
    : '<div class="empty">Pantry is empty — add what you have on hand.</div>';
  $("pantryOut").querySelectorAll("[data-pantry-del]").forEach(b =>
    b.addEventListener("click", () => { M.removePantryItem(b.dataset.pantryDel); renderPantry(); }));
  const sug = M.recipesUsingPantry(3);
  $("pantryRecipes").innerHTML = sug.length
    ? '<h3>Cook from the pantry</h3><p class="lede">Recipes using what you already have:</p>' +
      sug.map(s => '<div class="list-item"><div class="grow"><div class="title">' + esc(s.recipe.name) + "</div>" +
        '<div class="meta">uses ' + s.hits + " pantry item" + (s.hits === 1 ? "" : "s") + ": " + esc(s.names.join(", ")) + "</div></div></div>").join("")
    : "";
}

// ---------- Grocery budget ----------
function renderBudget() {
  const ym = M.todayISO().slice(0, 7);
  const budget = M.getGroceryBudget();
  $("budgetIn").value = budget != null ? budget : "";
  const total = M.grocerySpendTotal(ym);
  const spends = M.listGrocerySpend().filter(s => s.date.slice(0, 7) === ym);
  let h = "";
  if (budget != null) {
    const pct = Math.min(100, Math.round((total / budget) * 100));
    h += '<div style="margin:12px 0"><div style="display:flex;justify-content:space-between;font-size:14px">' +
      "<span><strong>$" + total.toFixed(2) + "</strong> of $" + budget.toFixed(2) + " spent in " + esc(ym) + "</span>" +
      '<span class="' + (pct > 100 ? "over" : "") + '">' + pct + "%</span></div>" +
      '<div class="meter"><div class="meter-fill' + (pct > 100 ? " bad" : "") + '" style="width:' + Math.min(100, pct) + '%"></div></div></div>';
  } else {
    h += '<p class="lede">Set a monthly budget above to track against it. Spent in ' + esc(ym) + ': <strong>$' + total.toFixed(2) + "</strong>.</p>";
  }
  h += spends.length
    ? '<table class="data"><tbody>' + spends.map(s =>
      "<tr><td><strong>$" + s.amount.toFixed(2) + "</strong> <span class='meta'>" + esc(s.date) +
      (s.note ? " · " + esc(s.note) : "") + "</span></td>" +
      '<td style="text-align:right"><button class="btn btn-ghost btn-sm" data-spend-del="' + s.id + '">Remove</button></td></tr>'
    ).join("") + "</tbody></table>"
    : '<div class="empty">No grocery trips logged this month.</div>';
  $("budgetOut").innerHTML = h;
  $("budgetOut").querySelectorAll("[data-spend-del]").forEach(b =>
    b.addEventListener("click", () => { M.removeGrocerySpend(b.dataset.spendDel); renderBudget(); }));
}

// ---------- Sleep debt ----------
function renderSleepDebt() {
  const d = H.sleepDebt(7, 8);
  const out = $("sleepDebtOut");
  if (!d.logged) { out.innerHTML = ""; return; }
  const rows = d.rows.map(r => {
    const w = r.slept == null ? 0 : Math.min(100, (r.slept / 12) * 100);
    const cls = r.diff == null ? "dim" : r.diff < 0 ? "bad" : "good";
    return '<div class="debt-row"><span class="debt-day">' + esc(r.date.slice(5)) + "</span>" +
      '<div class="debt-bar"><i class="' + cls + '" style="width:' + w.toFixed(0) + '%"></i></div>' +
      '<span class="debt-val">' + (r.slept == null ? "—" : r.slept + "h" + (r.diff < 0 ? " (" + r.diff + ")" : "")) + "</span></div>";
  }).join("");
  out.innerHTML = '<div class="debt-card"><h3>Sleep debt — last 7 days</h3>' +
    '<p class="lede">' + (d.debt < 0
      ? 'You are <strong class="over">' + Math.abs(d.debt) + 'h</strong> short of 8h/night this week. Avg: ' + d.avg + 'h.'
      : 'No sleep debt — averaging ' + d.avg + 'h against an 8h target. Keep it up.') + "</p>" +
    rows + "</div>";
}

// Cross-metric insight: does sleep line up with mood?
function renderInsight() {
  const link = H.sleepMoodLink(30);
  $("insightOut").innerHTML = link
    ? '<div class="insight"><strong>Sleep × mood.</strong> ' + esc(link.copy) + "</div>"
    : "";
}

// Workouts: weekly progress vs goal + recent sessions.
function renderWorkouts() {
  const wk = H.workoutWeek();
  $("woGoal").placeholder = "Weekly goal (min) — now " + wk.goal;
  const recent = H.listWorkouts(30);
  $("workoutsOut").innerHTML =
    '<div class="workout-progress"><div class="workout-bar"><i style="width:' + wk.pct + '%"></i></div>' +
    '<div class="workout-meta">' + wk.minutes + " / " + wk.goal + " min this week · " + wk.sessions +
    (wk.sessions === 1 ? " session" : " sessions") + (wk.met ? ' · <strong class="good">goal met</strong>' : "") + "</div></div>" +
    (recent.length ? '<div class="workout-list">' + recent.slice(0, 10).map(w =>
      '<div class="list-item slim"><div class="grow"><div class="title">' + esc(w.type) + ' — ' + w.minutes + ' min</div>' +
      '<div class="meta">' + esc(w.date) + '</div></div>' +
      '<button class="btn btn-danger-ghost btn-sm" data-delworkout="' + w.id + '">Delete</button></div>').join("") + "</div>"
      : '<div class="empty">No workouts in the last 30 days.</div>');
  $("workoutsOut").querySelectorAll("[data-delworkout]").forEach(b => b.addEventListener("click", () => {
    H.deleteWorkout(b.dataset.delworkout); renderWorkouts(); renderHealth();
  }));
}
function renderPlan() {
  const out = $("planOut");
  const plan = M.getPlan();
  if (!plan) { out.innerHTML = '<div class="card"><div class="empty"><div class="big">No meal plan yet</div>Generate one above — or ask in chat.</div></div>'; return; }
  let h = '<div class="card"><h2>This week\'s plan</h2><p class="lede">' +
    esc(plan.days) + " days · " + esc(plan.diet === "none" ? "no diet restriction" : plan.diet) + " · " + plan.servings + " servings</p>";
  plan.plan.forEach(day => {
    h += '<h3 style="margin:14px 0 8px">' + esc(day.day) + "</h3><div class='grid3'>";
    ["breakfast", "lunch", "dinner"].forEach(slot => {
      const r = M.recipeById(day.meals[slot]);
      h += '<div class="recipe-card"><h4>' + esc(r.name) + "</h4><div class='meta'>" + esc(slot) + " · " + r.timeMin + " min · " + r.kcal + " kcal</div>" +
        r.tags.map(t => '<span class="tag">' + esc(t) + "</span>").join("") +
        "<div style='margin-top:8px;font-size:13px;color:var(--muted)'>" + r.ingredients.map(i => esc(i.name)).join(", ") + "</div></div>";
    });
    h += "</div>";
  });
  const list = M.groceryFromPlan(plan);
  h += "<h3>Grocery list — " + list.length + " items</h3>";
  const cov = M.pantryCoverage(list);
  const coveredN = cov.filter(i => i.covered).length;
  const partialN = cov.filter(i => !i.covered && i.have > 0).length;
  if (coveredN || partialN) {
    h += '<p class="lede">Pantry check: <strong>' + coveredN + "</strong> fully covered" +
      (partialN ? ", <strong>" + partialN + "</strong> partially" : "") + " by what's on hand.</p>";
  }
  M.groupByAisle(cov).forEach(g => {
    h += '<div class="aisle-head">' + esc(g.aisle) + "</div>";
    h += '<table class="data"><tbody>' + g.items.map(i =>
      "<tr><td><strong>" + esc(i.name) + "</strong><div class='meta'>" + esc(i.recipes.slice(0, 3).join(", ")) + (i.recipes.length > 3 ? "…" : "") + "</div></td>" +
      "<td style='text-align:right;white-space:nowrap'>" + i.qty + " " + esc(i.unit) +
      (i.have > 0 ? "<div class='meta have'>have " + i.have + (i.need > 0 ? " · buy " + i.need : " · covered") + "</div>" : "") + "</td></tr>").join("") + "</tbody></table>";
  });
  h += '<div class="btn-row"><button class="btn btn-primary" id="prepCartBtn">Prep cart for approval</button>' +
    '<button class="btn btn-ghost" id="prepCartPantryBtn" title="Prep a cart with only what the pantry does not cover">Prep cart minus pantry</button></div></div>';
  out.innerHTML = h;
  $("prepCartBtn").addEventListener("click", () => {
    const cart = M.prepCart(M.groceryFromPlan(M.getPlan()), "Weekly shop");
    renderCarts();
    toast("Cart prepped: " + cart.items.length + " items — review and approve below");
  });
  $("prepCartPantryBtn").addEventListener("click", () => {
    const needed = M.pantryCoverage(M.groceryFromPlan(M.getPlan()))
      .filter(i => i.need > 0)
      .map(i => ({ name: i.name, qty: i.need, unit: i.unit, aisle: i.aisle }));
    const cart = M.prepCart(needed, "Weekly shop (minus pantry)");
    renderCarts();
    toast("Cart prepped: " + cart.items.length + " items after pantry — review and approve below");
  });
}
function renderCarts() {
  const carts = M.listCarts();
  const out = $("cartsOut");
  if (!carts.length) { out.innerHTML = '<div class="empty">No carts yet. Generate a plan, then prep a cart.</div>'; return; }
  out.innerHTML = carts.map(c => {
    const done = c.items.filter(i => i.checked).length;
    return '<div class="card" style="margin-bottom:12px"><div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">' +
      "<strong>" + esc(c.label) + "</strong>" +
      '<span class="pill ' + (c.status === "approved" ? "good" : "warn") + '">' + c.status + "</span>" +
      '<span class="meta" style="font-size:13px;color:var(--muted)">' + done + "/" + c.items.length + " checked</span>" +
      (c.status === "draft" ? '<button class="btn btn-primary btn-sm" data-approve="' + c.id + '">Approve cart</button>' : "") +
      "</div>" +
      M.groupByAisle(c.items.map((it, idx) => Object.assign({ idx }, it))).map(g =>
        '<div class="aisle-head">' + esc(g.aisle) + "</div>" + g.items.map(it =>
          '<label class="list-item" style="cursor:pointer"><input type="checkbox" class="done-check" data-cart="' + c.id + '" data-idx="' + it.idx + '"' + (it.checked ? " checked" : "") + ">" +
          '<span class="grow ' + (it.checked ? "strike" : "") + '">' + esc(it.name) + ' <span class="meta">' + it.qty + " " + esc(it.unit) + "</span></span></label>").join("")
      ).join("") + "</div>";
  }).join("");
  out.querySelectorAll("[data-approve]").forEach(b => b.addEventListener("click", () => { M.approveCart(b.dataset.approve); renderCarts(); toast("Cart approved — take it to the store"); }));
  out.querySelectorAll(".done-check").forEach(cb => cb.addEventListener("change", () => { M.toggleCartItem(cb.dataset.cart, +cb.dataset.idx); renderCarts(); }));
}

// ---------- Health ----------
const LOG_TYPES = ["sleep", "steps", "water", "mood", "weight"];
function renderHealth() {
  const t = id => (D.HEALTH_TYPES.find(x => x.id === id) || {});
  $("logForm").innerHTML = LOG_TYPES.map(id => {
    const meta = t(id);
    return '<div class="form-row"><div><label class="f">' + esc(meta.name) + " (" + esc(meta.unit) + ")" + "</label>" +
      '<input type="number" step="any" min="0" id="log-' + id + '" placeholder="goal: ' + esc(meta.good) + '"></div>' +
      '<div style="flex:0;display:flex;align-items:flex-end"><button class="btn btn-ghost btn-sm" data-log="' + id + '">Log</button></div></div>';
  }).join("");
  $("logForm").querySelectorAll("[data-log]").forEach(b => b.addEventListener("click", () => {
    const id = b.dataset.log, v = parseFloat($("log-" + id).value);
    if (!isFinite(v)) { toast("Enter a number first"); return; }
    try { H.logEntry(id, v); $("log-" + id).value = ""; renderHealth(); toast("Logged"); }
    catch (e) { toast(e.message); }
  }));

  const avgs = H.weeklyAverages();
  const n = Object.keys(avgs).filter(k => avgs[k]).length;
  $("healthN").textContent = n + " of 5 tracked this week";
  let ch = "";
  ["sleep", "steps", "water", "mood", "weight"].forEach(id => {
    const meta = t(id), series = H.trendSeries(id, 14);
    const vals = series.map(p => p.value).filter(v => v != null);
    ch += '<h3>' + esc(meta.name) + ' <span class="pill">' + (vals.length ? "avg " + (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) + " " + esc(meta.unit) : "no data") + "</span></h3>";
    ch += barChart(series, meta.goal);
  });
  $("chartsOut").innerHTML = ch;

  const nudges = H.nudges();
  renderSleepDebt();
  renderInsight();
  renderWorkouts();
  $("nudgesOut").innerHTML = nudges.length ? nudges.map(x =>
    '<div class="list-item"><div class="grow"><div class="title">' + esc(x.title) + ' <span class="pill ' + (x.priority === 1 ? "bad" : x.priority === 2 ? "warn" : "") + '">' + (x.priority === 1 ? "priority" : x.priority === 2 ? "watch" : "idea") + "</span></div>" +
    '<div class="meta">' + esc(x.detail) + "</div></div>" +
    (x.id.indexOf("staple-") === 0 ? '<button class="btn btn-ghost btn-sm" data-bought="' + esc(x.id.slice(7)) + '">Mark bought</button>' : "") +
    "</div>").join("")
    : '<div class="empty">All quiet — nothing needs your attention.</div>';
  $("nudgesOut").querySelectorAll("[data-bought]").forEach(b => b.addEventListener("click", () => { H.markStapleBought(b.dataset.bought); renderHealth(); toast("Marked as bought"); }));
}
function barChart(series, goal) {
  const W = 560, Ht = 130, max = Math.max.apply(null, series.map(p => p.value || 0).concat([goal || 0, 1]));
  let bars = "";
  const bw = W / series.length;
  series.forEach((p, i) => {
    const hgt = p.value == null ? 0 : Math.max(2, (p.value / max) * (Ht - 24));
    bars += '<rect class="bar' + (p.value == null ? " dim" : "") + '" x="' + (i * bw + 2).toFixed(1) + '" y="' + (Ht - 14 - hgt).toFixed(1) +
      '" width="' + (bw - 4).toFixed(1) + '" height="' + hgt.toFixed(1) + '"><title>' + p.date + ": " + (p.value == null ? "—" : p.value) + "</title></rect>";
  });
  const goalY = goal ? Ht - 14 - (goal / max) * (Ht - 24) : null;
  return '<svg class="chart" viewBox="0 0 ' + W + " " + Ht + '" preserveAspectRatio="none">' + bars +
    (goalY != null ? '<line x1="0" x2="' + W + '" y1="' + goalY.toFixed(1) + '" y2="' + goalY.toFixed(1) + '" stroke="#15803d" stroke-dasharray="5,4" stroke-width="1.5"><title>Goal: ' + goal + "</title></line>" : "") +
    '<line class="axis" x1="0" x2="' + W + '" y1="' + (Ht - 14) + '" y2="' + (Ht - 14) + '"/></svg>';
}

// ---------- Schedule ----------
function renderSchedule() {
  renderTasks(); renderEvents();
}
function renderTasks() {
  const tasks = Sch.listTasks("open").concat(Sch.listTasks("done"));
  $("tasksOut").innerHTML = tasks.length ? tasks.map(t =>
    '<div class="list-item"><input type="checkbox" class="done-check" data-task="' + t.id + '"' + (t.done ? " checked" : "") + ">" +
    '<div class="grow"><div class="title ' + (t.done ? "strike" : "") + '">' + esc(t.title) +
    (t.repeat && t.repeat !== "none" ? ' <span class="pill">' + esc(t.repeat) + "</span>" : "") + "</div>" +
    '<div class="meta">' + (t.due ? esc(t.due) + " · " : "") + esc(t.priority) + (t.notes ? " · " + esc(t.notes) : "") + "</div></div>" +
    '<button class="btn btn-danger-ghost btn-sm" data-deltask="' + t.id + '">Delete</button></div>').join("")
    : '<div class="empty">No tasks. Add one above or say "add task buy milk" in chat.</div>';
  $("tasksOut").querySelectorAll("[data-task]").forEach(cb => cb.addEventListener("change", () => {
    const done = Sch.toggleTask(cb.dataset.task);
    if (done.spawned) toast("Done — next " + done.spawned.repeat + " one queued" + (done.spawned.due ? " for " + done.spawned.due : ""));
    renderTasks();
  }));
  $("tasksOut").querySelectorAll("[data-deltask]").forEach(b => b.addEventListener("click", () => { Sch.deleteTask(b.dataset.deltask); renderTasks(); }));
}
function renderEvents() {
  const upcoming = Sch.upcomingEvents(14);
  const conflicts = Sch.detectConflicts(upcoming);
  $("conflictOut").innerHTML = conflicts.length
    ? '<div class="notice"><strong>Schedule conflict.</strong> ' + conflicts.map(c => "\"" + esc(c.a.title) + "\" overlaps \"" + esc(c.b.title) + "\" on " + esc(c.date)).join("; ") + "</div>"
    : "";
  const grid = Sch.weekGrid();
  let h = '<div class="grid3" style="grid-template-columns:repeat(7,1fr);gap:8px;margin-bottom:14px">';
  grid.forEach(d => {
    h += '<div class="recipe-card" style="padding:10px"><div style="font-weight:700;font-size:13px">' + esc(d.label) + " " + d.num + "</div>" +
      (d.events.length ? d.events.map(e => '<div style="font-size:12px;margin-top:4px"><a href="#" data-prep="' + e.id + '" style="color:var(--accent-dark)">' + esc((e.start ? e.start + " " : "") + e.title) + "</a></div>").join("") : '<div style="font-size:12px;color:var(--faint)">—</div>') + "</div>";
  });
  h += "</div>";
  h += upcoming.length ? upcoming.map(e =>
    '<div class="list-item" id="ev-' + e.id + '"><div class="grow"><div class="title">' + esc(e.title) + "</div>" +
    '<div class="meta">' + esc(e.date) + (e.start ? " · " + esc(e.start) + (e.end ? "–" + esc(e.end) : "") : "") + (e.attendees ? " · with " + esc(e.attendees) : "") + "</div>" +
    '<div class="prepOut"></div></div>' +
    '<button class="btn btn-ghost btn-sm" data-meetprep="' + e.id + '">Prep notes</button> ' +
    '<button class="btn btn-danger-ghost btn-sm" data-delev="' + e.id + '">Delete</button></div>').join("")
    : '<div class="empty">No upcoming events.</div>';
  $("weekOut").innerHTML = h;
  $("weekOut").querySelectorAll("[data-delev]").forEach(b => b.addEventListener("click", () => { Sch.deleteEvent(b.dataset.delev); renderEvents(); }));
  $("weekOut").querySelectorAll("[data-meetprep], [data-prep]").forEach(b => b.addEventListener("click", ev => {
    ev.preventDefault();
    const id = b.dataset.meetprep || b.dataset.prep;
    const e = Sch.listEvents().find(x => x.id === id);
    const prep = Sch.meetingPrep(e);
    const host = document.querySelector("#ev-" + id + " .prepOut") || b.closest(".recipe-card");
    const box = document.createElement("div");
    box.className = "notice";
    box.style.marginTop = "10px";
    box.innerHTML = "<strong>Prep: " + esc(prep.title) + "</strong> — " + esc(prep.when) + "<br>" +
      "<strong>Agenda:</strong><br>· " + prep.agenda.map(esc).join("<br>· ") + "<br>" +
      "<strong>Ask:</strong><br>· " + prep.questions.map(esc).join("<br>· ") + "<br>" +
      "<strong>Checklist:</strong> " + prep.checklist.map(esc).join(" · ");
    host.appendChild(box);
    b.disabled = true;
  }));
}

// ---------- Comms ----------
function parseCtx(text) {
  const fields = {};
  (text || "").split("\n").forEach(line => {
    const i = line.indexOf(":");
    if (i > 0) fields[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  });
  return fields;
}
function renderComms() {
  $("tplSel").innerHTML = D.EMAIL_TEMPLATES.map(t => '<option value="' + t.id + '">' + esc(t.name) + "</option>").join("");
  $("toneSel").innerHTML = D.TONES.map(t => '<option value="' + t.id + '">' + esc(t.name) + " — " + esc(t.note) + "</option>").join("");
  $("callSel").innerHTML = D.CALL_SCRIPTS.map(s => '<option value="' + s.id + '">' + esc(s.name) + "</option>").join("");
  renderDrafts(); renderFollowUps();
}
function renderDrafts() {
  const drafts = C.listDrafts();
  $("draftsOut").innerHTML = drafts.length ? drafts.map(d =>
    '<div class="card" style="margin-bottom:12px"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap">' +
    "<strong>" + esc(d.subject) + "</strong>" +
    '<span class="pill">' + esc(d.templateName) + "</span>" +
    '<span class="pill ' + (d.status === "approved" ? "good" : "warn") + '">' + d.status + "</span></div>" +
    '<div class="meta" style="font-size:13px;color:var(--muted);margin:6px 0">To: ' + esc(d.to || "—") + " · Tone: " + esc(d.tone) + "</div>" +
    '<pre style="white-space:pre-wrap;font:inherit;font-size:14px;background:#faf7f2;border:1px solid var(--border-soft);border-radius:8px;padding:12px">' + esc(d.body) + "</pre>" +
    '<div class="btn-row">' + (d.status === "draft" ? '<button class="btn btn-primary btn-sm" data-appr="' + d.id + '">Approve</button>' : "") +
    '<button class="btn btn-danger-ghost btn-sm" data-deldraft="' + d.id + '">Delete</button></div></div>').join("")
    : '<div class="empty">No drafts yet. Draft one above — or ask in chat.</div>';
  $("draftsOut").querySelectorAll("[data-appr]").forEach(b => b.addEventListener("click", () => { C.approveDraft(b.dataset.appr); renderDrafts(); toast("Draft approved — send it yourself when ready"); }));
  $("draftsOut").querySelectorAll("[data-deldraft]").forEach(b => b.addEventListener("click", () => { C.deleteDraft(b.dataset.deldraft); renderDrafts(); }));
}
function renderFollowUps() {
  const items = C.listFollowUps(false);
  $("fuOut").innerHTML = items.length ? items.map(i =>
    '<div class="list-item"><input type="checkbox" class="done-check" data-fu="' + i.id + '"' + (i.done ? " checked" : "") + ">" +
    '<div class="grow"><div class="title ' + (i.done ? "strike" : "") + '">' + esc(i.who) + "</div>" +
    '<div class="meta">' + esc(i.about) + (i.due ? " · due " + esc(i.due) : "") + " · " + esc(i.channel) + "</div></div></div>").join("")
    : '<div class="empty">Follow-up queue is clear.</div>';
  $("fuOut").querySelectorAll("[data-fu]").forEach(cb => cb.addEventListener("change", () => { C.toggleFollowUp(cb.dataset.fu); renderFollowUps(); }));
}

// ---------- Sheets ----------
let activeSheetId = null;
function renderSheets() {
  const list = Sh.listSheets();
  $("sheetTabs").innerHTML = list.map(s => '<button class="tab' + (s.id === activeSheetId ? " active" : "") + '" data-sheet="' + s.id + '">' + esc(s.name) + "</button>").join("");
  $("sheetTabs").querySelectorAll("[data-sheet]").forEach(t => t.addEventListener("click", () => { activeSheetId = t.dataset.sheet; renderSheets(); }));
  if (!list.length) { $("sheetOut").innerHTML = '<div class="empty"><div class="big">No sheets yet</div>Create one or import a CSV.</div>'; return; }
  if (!list.some(s => s.id === activeSheetId)) activeSheetId = list[0].id;
  const s = Sh.getSheet(activeSheetId);
  const cols = s.grid[0] ? s.grid[0].length : 0;
  let h = '<div style="display:flex;gap:10px;align-items:center;margin-bottom:12px;flex-wrap:wrap"><strong>' + esc(s.name) + '</strong>' +
    '<span class="pill">' + s.grid.length + " × " + cols + "</span>" +
    '<button class="btn btn-ghost btn-sm" id="shAddRow">+ Row</button><button class="btn btn-ghost btn-sm" id="shAddCol">+ Column</button>' +
    '<button class="btn btn-ghost btn-sm" id="shExport">Export CSV</button>' +
    '<button class="btn btn-ghost btn-sm" id="shRename">Rename</button>' +
    '<button class="btn btn-danger-ghost btn-sm" id="shDelete">Delete</button></div>';
  h += '<div class="sheet-grid"><table><thead><tr><th></th>' + Array.from({ length: cols }, (_, c) => "<th>" + String.fromCharCode(65 + (c % 26)) + "</th>").join("") + "</tr></thead><tbody>";
  s.grid.forEach((row, r) => {
    h += "<tr><th>" + (r + 1) + "</th>" + row.map((cell, c) =>
      '<td><input data-r="' + r + '" data-c="' + c + '" value="' + esc(cell) + '"></td>').join("") + "</tr>";
  });
  $("sheetOut").innerHTML = h + "</tbody></table></div>";
  $("sheetOut").querySelectorAll("td input").forEach(inp => inp.addEventListener("change", () => {
    Sh.setCell(activeSheetId, +inp.dataset.r, +inp.dataset.c, inp.value);
  }));
  $("shAddRow").addEventListener("click", () => { Sh.addRow(activeSheetId); renderSheets(); });
  $("shAddCol").addEventListener("click", () => { Sh.addCol(activeSheetId); renderSheets(); });
  $("shExport").addEventListener("click", () => {
    const csv = Sh.csvExport(activeSheetId);
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = Sh.getSheet(activeSheetId).name.replace(/[^\w\-]+/g, "-") + ".csv";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    toast("CSV exported");
  });
  $("shRename").addEventListener("click", () => {
    const name = prompt("Sheet name:", Sh.getSheet(activeSheetId).name);
    if (name) { Sh.renameSheet(activeSheetId, name); renderSheets(); }
  });
  $("shDelete").addEventListener("click", () => {
    if (confirm("Delete this sheet?")) { Sh.deleteSheet(activeSheetId); activeSheetId = null; renderSheets(); }
  });
}

// ---------- Research ----------
function renderResearch() {
  $("resDepth").innerHTML = D.RESEARCH_DEPTHS.map(d => '<option value="' + d.id + '">' + esc(d.name) + " — " + esc(d.note) + "</option>").join("");
  const briefs = R.listBriefs();
  $("briefsOut").innerHTML = briefs.length ? briefs.map(b =>
    '<div class="card"><div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap"><h2 style="margin:0">' + esc(b.topic) + "</h2>" +
    '<span class="pill accent">' + esc(b.depth) + "</span>" +
    '<button class="btn btn-danger-ghost btn-sm" data-delbrief="' + b.id + '">Delete</button></div>' +
    '<p class="lede">' + esc(b.summary) + "</p>" +
    b.sections.map(s => "<h3>" + esc(s.heading) + "</h3><ul>" + s.bullets.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>").join("") +
    "<h3>Next steps</h3><ul>" + b.nextSteps.map(x => "<li>" + esc(x) + "</li>").join("") + "</ul>" +
    '<p style="font-size:12.5px;color:var(--faint)">' + esc(b.disclaimer) + "</p></div>").join("")
    : '<div class="card"><div class="empty"><div class="big">No briefs yet</div>Generate one above — or ask in chat.</div></div>';
  $("briefsOut").querySelectorAll("[data-delbrief]").forEach(x => x.addEventListener("click", () => { R.deleteBrief(x.dataset.delbrief); renderResearch(); }));
}

// ---------- Briefing ----------
function renderBriefing() { renderBrief(false); }
function renderBrief(regen) {
  const b = P.morningBriefing();
  $("briefGreet").textContent = b.greeting;
  $("briefOut").innerHTML = b.sections.map(s =>
    '<div class="card"><h2>' + esc(s.title) + "</h2>" + s.lines.map(l => '<div class="list-item"><div class="grow">' + esc(l) + "</div></div>").join("") + "</div>").join("");
  $("weekRevOut").innerHTML = "";
  if (regen) toast("Briefing regenerated");
}
function renderWeekReview() {
  const w = P.weeklyReview();
  const avgs = w.health;
  $("weekRevOut").innerHTML = '<div class="card"><h2>Weekly review</h2>' +
    '<div class="grid3">' +
    '<div class="recipe-card"><h4>' + w.completed + "</h4><div class='meta'>tasks completed</div></div>" +
    '<div class="recipe-card"><h4>' + w.open + "</h4><div class='meta'>tasks open</div></div>" +
    '<div class="recipe-card"><h4>' + w.overdue + "</h4><div class='meta'>tasks overdue</div></div></div>" +
    "<h3>Health averages</h3><ul>" + Object.keys(avgs).map(k => "<li>" + esc(k) + ": " + (avgs[k] ? esc(avgs[k].avg + " " + avgs[k].unit) : "no data") + "</li>").join("") + "</ul>" +
    '<p class="lede">' + esc(w.note) + "</p></div>";
}

// ---------- Apple Health file import ----------
function wireFileImports() {
  $("ahImportBtn").addEventListener("click", () => {
    const f = $("ahFile").files[0];
    if (!f) { toast("Choose your export.xml first"); return; }
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const parsed = H.parseAppleHealthXML(rd.result);
        const imp = H.importAppleHealth(parsed);
        $("ahOut").textContent = "Imported " + imp.added + " day-entries from " + parsed.records + " records.";
        renderHealth();
        toast("Apple Health data imported");
      } catch (e) { toast("Import failed: " + e.message); }
    };
    rd.readAsText(f);
  });
  $("sheetImportBtn").addEventListener("click", () => $("csvFile").click());
  $("csvFile").addEventListener("change", () => {
    const f = $("csvFile").files[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = () => {
      try {
        const s = Sh.csvImport(rd.result, f.name.replace(/\.csv$/i, ""));
        activeSheetId = s.id;
        renderSheets();
        toast("Imported " + s.grid.length + " rows");
      } catch (e) { toast("Import failed: " + e.message); }
    };
    rd.readAsText(f);
    $("csvFile").value = "";
  });
}

// ---------- Init ----------
function renderAll() {
  refreshProfiles();
  renderChat(); renderMeals(); renderHealth(); renderSchedule();
  renderComms(); renderSheets(); renderResearch(); renderBriefing();
}

document.addEventListener("DOMContentLoaded", () => {
  buildNav();
  if (!S.listProfiles().length) S.createProfile("Home");
  refreshProfiles();
  $("profileSelect").addEventListener("change", e => switchProfileTo(e.target.value));
  $("addProfileBtn").addEventListener("click", () => {
    const name = prompt("Profile name:", "Family");
    if (name && name.trim()) { const p = S.createProfile(name.trim()); switchProfileTo(p.id); }
  });

  $("chatSend").addEventListener("click", () => sendChat());
  $("chatInput").addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });

  $("genPlanBtn").addEventListener("click", () => {
    const prefs = { diet: $("dietSel").value, servings: Math.max(1, +$("servingsIn").value || 2) };
    M.savePrefs(prefs);
    M.savePlan(M.generatePlan({ diet: prefs.diet, servings: prefs.servings, startOffset: Math.floor(Math.random() * 7) }));
    renderPlan();
    toast("Meal plan generated");
  });

  $("pantryAdd").addEventListener("click", () => {
    try {
      M.addPantryItem({ name: $("pantryName").value, qty: $("pantryQty").value, unit: $("pantryUnit").value, expires: $("pantryExp").value });
      $("pantryName").value = ""; $("pantryQty").value = ""; $("pantryUnit").value = ""; $("pantryExp").value = "";
      renderPantry(); renderPlan();
      toast("Added to pantry");
    } catch (e) { toast(e.message); }
  });

  $("budgetSave").addEventListener("click", () => {
    try {
      M.setGroceryBudget($("budgetIn").value);
      renderBudget();
      toast($("budgetIn").value === "" ? "Budget cleared" : "Budget set");
    } catch (e) { toast(e.message); }
  });

  $("spendAdd").addEventListener("click", () => {
    try {
      M.logGrocerySpend($("spendAmt").value, $("spendDate").value || undefined, $("spendNote").value);
      $("spendAmt").value = ""; $("spendDate").value = ""; $("spendNote").value = "";
      renderBudget();
      toast("Trip logged");
    } catch (e) { toast(e.message); }
  });

  $("taskAdd").addEventListener("click", () => {
    const title = $("taskTitle").value.trim();
    if (!title) { toast("Give the task a title"); return; }
    Sch.addTask({ title, due: $("taskDue").value || null, repeat: $("taskRepeat").value });
    $("taskTitle").value = ""; $("taskDue").value = ""; $("taskRepeat").value = "none";
    renderTasks(); toast("Task added");
  });
  $("woAdd").addEventListener("click", () => {
    const mins = parseFloat($("woMin").value);
    if (!isFinite(mins)) { toast("Enter minutes first"); return; }
    try {
      H.logWorkout($("woType").value, mins);
      $("woMin").value = "";
      renderHealth(); toast("Workout logged");
    } catch (e) { toast(e.message); }
  });
  $("woGoalBtn").addEventListener("click", () => {
    const g = parseFloat($("woGoal").value);
    if (!isFinite(g)) { toast("Enter a goal first"); return; }
    try {
      H.setWorkoutGoal(g);
      $("woGoal").value = "";
      renderHealth(); toast("Workout goal updated");
    } catch (e) { toast(e.message); }
  });

  $("evAdd").addEventListener("click", () => {
    try {
      Sch.addEvent({ title: $("evTitle").value, date: $("evDate").value, start: $("evStart").value || null, end: $("evEnd").value || null, attendees: $("evAtt").value });
      ["evTitle", "evDate", "evStart", "evEnd", "evAtt"].forEach(id => $(id).value = "");
      renderEvents(); toast("Event added");
    } catch (e) { toast(e.message); }
  });

  $("draftEmailBtn").addEventListener("click", () => {
    C.draftEmail({ templateId: $("tplSel").value, tone: $("toneSel").value, to: $("emTo").value.trim(), fields: Object.assign({ name: $("emName").value.trim() }, parseCtx($("emCtx").value)) });
    renderDrafts(); toast("Draft created — review and approve");
  });
  $("callScriptBtn").addEventListener("click", () => {
    const s = C.callScript({ scenarioId: $("callSel").value, fields: parseCtx($("callCtx").value) });
    $("scriptOut").innerHTML = '<div class="card" style="margin-bottom:0"><h3 style="margin-top:0">' + esc(s.scenarioName) + "</h3>" +
      s.sections.map(x => "<p><strong>" + esc(x.heading) + ":</strong> " + esc(x.text) + "</p>").join("") + "</div>";
  });
  $("fuAdd").addEventListener("click", () => {
    if (!$("fuWho").value.trim()) { toast("Who is it for?"); return; }
    C.addFollowUp({ who: $("fuWho").value, about: $("fuAbout").value, due: $("fuDue").value || null });
    ["fuWho", "fuAbout", "fuDue"].forEach(id => $(id).value = "");
    renderFollowUps(); toast("Follow-up queued");
  });

  $("sheetNew").addEventListener("click", () => {
    const s = Sh.createSheet($("sheetName").value.trim() || "Untitled sheet", 10, 5);
    $("sheetName").value = "";
    activeSheetId = s.id;
    renderSheets(); toast("Sheet created");
  });

  $("resGen").addEventListener("click", () => {
    try {
      R.generateBrief({ topic: $("resTopic").value, depth: $("resDepth").value });
      $("resTopic").value = "";
      renderResearch(); toast("Brief generated");
    } catch (e) { toast(e.message); }
  });

  $("briefGen").addEventListener("click", () => renderBrief(true));
  $("weekRevBtn").addEventListener("click", renderWeekReview);

  wireFileImports();
  renderAll();
});
})();
