// Hearth AI end-to-end tests — realistic user flows through the logic layer (node).
"use strict";
const assert = require("assert");

const store = require("../js/store.js");
const data = require("../js/data.js");
const meals = require("../js/meals.js");
const health = require("../js/health.js");
const schedule = require("../js/schedule.js");
const comms = require("../js/comms.js");
const sheets = require("../js/sheets.js");
const research = require("../js/research.js");
const proactive = require("../js/proactive.js");
const chat = require("../js/chat.js");

let n = 0;
function ok(name, fn) {
  store.resetForTests();
  fn();
  n++;
  console.log("PASS " + n + ": " + name);
}

// 1. Profiles isolate all data (multi-user foundation).
ok("profile isolation", () => {
  const a = store.createProfile("Alex");
  const b = store.createProfile("Sam");
  store.switchProfile(a.id);
  schedule.addTask({ title: "Alex task" });
  assert.strictEqual(schedule.listTasks().length, 1);
  store.switchProfile(b.id);
  assert.strictEqual(schedule.listTasks().length, 0, "Sam must not see Alex's tasks");
  health.logEntry("sleep", 7);
  store.switchProfile(a.id);
  assert.strictEqual(health.getLogs("sleep").length, 0, "Alex must not see Sam's health logs");
  store.switchProfile(b.id);
  assert.strictEqual(health.getLogs("sleep").length, 1);
});

// 2. Meal plan -> grocery list -> prep cart -> approve (planner model).
ok("meal plan to approved cart", () => {
  store.createProfile("Home");
  const plan = meals.generatePlan({ diet: "vegetarian", servings: 2, days: 7, startOffset: 0 });
  assert.strictEqual(plan.plan.length, 7);
  plan.plan.forEach(day => ["breakfast", "lunch", "dinner"].forEach(slot => {
    const r = meals.recipeById(day.meals[slot]);
    assert.ok(r.tags.indexOf("vegetarian") !== -1, r.name + " breaks vegetarian diet");
  }));
  const ids = plan.plan.flatMap(d => [d.meals.breakfast, d.meals.lunch, d.meals.dinner]);
  const poolSize = meals.recipesForDiet("vegetarian").length;
  // 9 slots but a small diet pool: generator must use every available recipe before repeating
  assert.strictEqual(new Set(ids).size, Math.min(9, poolSize), "plan should exhaust variety before repeating");
  meals.savePlan(plan);
  const list = meals.groceryFromPlan(plan);
  assert.ok(list.length > 10, "grocery list too small: " + list.length);
  const groups = meals.groupByAisle(list);
  assert.ok(groups.length >= 4, "should span aisles");
  assert.strictEqual(groups[0].aisle, "Produce", "Produce should come first");
  const cart = meals.prepCart(list, "Weekly shop");
  assert.strictEqual(cart.status, "draft");
  const approved = meals.approveCart(cart.id);
  assert.strictEqual(approved.status, "approved");
  assert.ok(approved.approvedAt);
});

// 3. Health logging + Apple Health import + predictive nudges.
ok("health logs, apple health import, nudges", () => {
  store.createProfile("Home");
  health.logEntry("sleep", 5.5);
  health.logEntry("sleep", 6, new Date(Date.now() - 864e5));
  health.logEntry("water", 2);
  const xml = `<HealthData locale="en_US"><Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch" unit="count" startDate="2026-09-27 08:00:00 -0400" endDate="2026-09-27 08:30:00 -0400" value="1200"/><Record type="HKQuantityTypeIdentifierStepCount" sourceName="Watch" unit="count" startDate="2026-09-27 09:00:00 -0400" endDate="2026-09-27 09:30:00 -0400" value="800"/><Record type="HKCategoryTypeIdentifierSleepAnalysis" startDate="2026-09-26 23:00:00 -0400" endDate="2026-09-27 06:30:00 -0400" value="HKCategoryValueSleepAnalysisAsleepCore"/><Record type="HKQuantityTypeIdentifierBodyMass" unit="lb" startDate="2026-09-27 07:00:00 -0400" endDate="2026-09-27 07:00:00 -0400" value="180.5"/></HealthData>`;
  const parsed = health.parseAppleHealthXML(xml);
  assert.strictEqual(parsed.records, 4, "expected 4 records, got " + parsed.records);
  assert.strictEqual(parsed.steps["2026-09-27"], 2000);
  assert.strictEqual(parsed.sleep["2026-09-27"], 7.5);
  assert.strictEqual(parsed.weight["2026-09-27"], 180.5);
  const imp = health.importAppleHealth(parsed);
  assert.ok(imp.added >= 3);
  const series = health.trendSeries("steps", 7);
  assert.strictEqual(series.length, 7);
  const nudges = health.nudges();
  assert.ok(nudges.some(x => x.id === "sleep-low"), "low sleep should nudge");
  assert.throws(() => health.parseAppleHealthXML("<nope/>"), /not an Apple Health/);
  assert.throws(() => health.logEntry("mood", 9), /1-5/);
});

// 4. Schedule: tasks, events, conflict detection, briefing.
ok("schedule tasks, conflicts, briefing", () => {
  store.createProfile("Home");
  const t = schedule.addTask({ title: "Buy milk", due: new Date().toISOString().slice(0, 10), priority: "high" });
  assert.ok(!t.done);
  schedule.toggleTask(t.id);
  assert.ok(schedule.listTasks("done").some(x => x.id === t.id));
  const today = new Date().toISOString().slice(0, 10);
  const e1 = schedule.addEvent({ title: "Dentist", date: today, start: "14:00", end: "15:00", attendees: "Dr. Lee" });
  schedule.addEvent({ title: "Call mom", date: today, start: "14:30", end: "15:30" });
  const conflicts = schedule.detectConflicts(schedule.listEvents(today));
  assert.strictEqual(conflicts.length, 1, "should detect the overlap");
  const prep = schedule.meetingPrep(e1);
  assert.ok(prep.questions.some(q => q.indexOf("Dr. Lee") !== -1));
  assert.ok(prep.agenda.length >= 3 && prep.checklist.length >= 3);
  const b = proactive.morningBriefing();
  assert.ok(b.greeting && b.sections.length >= 4, "briefing needs sections");
  assert.ok(b.sections.some(s => s.title === "Watch out"), "conflict should surface in briefing");
  const grid = schedule.weekGrid();
  assert.strictEqual(grid.length, 7);
});

// 5. Comms: draft -> approve (never sent), call script, follow-ups.
ok("comms planner flow", () => {
  store.createProfile("Home");
  const d = comms.draftEmail({ templateId: "schedule-request", to: "sam@example.com", tone: "warm",
    fields: { name: "Sam", topic: "the kitchen remodel", availability: "Tue afternoons" } });
  assert.strictEqual(d.status, "draft");
  assert.ok(d.subject.indexOf("kitchen remodel") !== -1);
  assert.ok(d.body.indexOf("{{") === -1, "all placeholders must be filled: " + d.body);
  assert.ok(d.body.indexOf("Warmly,") !== -1, "warm tone should sign warmly");
  const approved = comms.approveDraft(d.id);
  assert.strictEqual(approved.status, "approved");
  assert.ok(!("sent" in approved) && approved.status !== "sent", "planner model: nothing is ever sent");
  const script = comms.callScript({ scenarioId: "service-inquiry", fields: { service: "gutter cleaning" } });
  assert.strictEqual(script.sections.length, 4);
  assert.ok(script.sections[0].text.indexOf("gutter cleaning") !== -1);
  const fu = comms.addFollowUp({ who: "Sam", about: "remodel quote", due: "2026-10-05" });
  assert.strictEqual(comms.listFollowUps(true).length, 1);
  comms.toggleFollowUp(fu.id);
  assert.strictEqual(comms.listFollowUps(true).length, 0);
});

// 6. Sheets: CRUD + CSV roundtrip with tricky fields.
ok("sheets csv roundtrip", () => {
  store.createProfile("Home");
  const s = sheets.createSheet("Budget", 3, 3);
  sheets.setCell(s.id, 0, 0, "Rent, monthly");
  sheets.setCell(s.id, 0, 1, 'He said "hi"');
  sheets.setCell(s.id, 1, 0, "Line1\nLine2");
  const csv = sheets.csvExport(s.id);
  assert.ok(csv.indexOf('"Rent, monthly"') !== -1, "commas must be quoted");
  assert.ok(csv.indexOf('"He said ""hi"""') !== -1, "quotes must be escaped");
  const imp = sheets.csvImport(csv, "Budget copy");
  const back = sheets.getSheet(imp.id);
  assert.strictEqual(back.grid[0][0], "Rent, monthly");
  assert.strictEqual(back.grid[0][1], 'He said "hi"');
  assert.strictEqual(back.grid[1][0], "Line1\nLine2");
  assert.throws(() => sheets.setCell(s.id, 99, 0, "x"), /out of range/);
  assert.throws(() => sheets.csvImport("   ", "empty"), /empty CSV/);
});

// 7. Research brief generation.
ok("research brief", () => {
  store.createProfile("Home");
  const b = research.generateBrief({ topic: "robot vacuum", depth: "deep", audience: "buying decision" });
  assert.ok(b.summary.indexOf("robot vacuum") !== -1);
  assert.ok(b.sections.length >= 6, "deep brief needs 6+ sections, got " + b.sections.length);
  assert.ok(b.sections.some(s => s.heading === "Risks & mitigations"));
  assert.ok(b.disclaimer.indexOf("template") !== -1, "must disclose template basis");
  assert.ok(b.nextSteps.length >= 2);
  assert.throws(() => research.generateBrief({ topic: "  " }), /needs a topic/);
});

// 8. Chat intents end to end.
ok("chat assistant flows", () => {
  store.createProfile("Home");
  const cases = [
    ["hello", "greet"], ["help", "help"], ["plan my meals this week", "plan_meals"],
    ["log 7 hours of sleep", "log_sleep"], ["log 8000 steps", "log_steps"],
    ["morning briefing", "briefing"], ["add task buy milk", "add_task"],
    ["research robot vacuum", "research"], ["draft email", "draft_email"],
    ["call script", "call_script"], ["what nudges do you have", "nudges"]
  ];
  cases.forEach(([input, intent]) => {
    assert.strictEqual(chat.parseIntent(input).intent, intent, "intent for: " + input);
  });
  assert.strictEqual(chat.parseIntent("log 7 hours of sleep").value, 7);
  const r1 = chat.respond("plan my meals this week");
  assert.ok(r1.reply.indexOf("day plan") !== -1);
  assert.ok(r1.actions.some(a => a.label === "Prep grocery cart"));
  const r2 = chat.respond("log 7 hours of sleep");
  assert.ok(r2.reply.indexOf("Logged") === 0);
  assert.strictEqual(health.getLogs("sleep").length, 1);
  const r3 = chat.runAction("prep_cart");
  assert.ok(r3.reply.indexOf("Cart prepped") === 0);
  assert.strictEqual(meals.getCart(meals.listCarts()[0].id).status, "draft");
  const r4 = chat.respond("blargle wibble");
  assert.strictEqual(chat.parseIntent("blargle wibble").intent, "unknown");
  assert.ok(r4.reply.length > 20);
  chat.saveExchange("hi", r1);
  assert.strictEqual(chat.getLog().length, 1);
});


// 9. Pantry -> grocery list coverage -> prep cart minus pantry.
ok("pantry coverage and prep-cart-minus-pantry", () => {
  store.createProfile("H");
  const plan = meals.generatePlan({ diet: "none", servings: 2, days: 2, startOffset: 0 });
  const list = meals.groceryFromPlan(plan);
  assert.ok(list.length > 3, "need a real list");
  // stock the pantry with the first item in full and the second partially
  meals.addPantryItem({ name: list[0].name, qty: list[0].qty, unit: list[0].unit });
  meals.addPantryItem({ name: list[1].name, qty: Math.max(0.01, Math.round(list[1].qty / 2 * 100) / 100), unit: list[1].unit });
  const cov = meals.pantryCoverage(list);
  assert.strictEqual(cov[0].covered, true, "first item fully covered");
  assert.strictEqual(cov[1].covered, false, "second item partial");
  assert.ok(cov[1].need > 0 && cov[1].need < cov[1].qty, "partial need math");
  const needed = cov.filter(i => i.need > 0).map(i => ({ name: i.name, qty: i.need, unit: i.unit, aisle: i.aisle }));
  const cart = meals.prepCart(needed, "minus pantry");
  assert.strictEqual(cart.items.length, list.length - 1, "cart drops the covered item");
  assert.ok(cart.items.every(i => i.qty > 0), "no zero-qty items");
});

// 10. Pantry expiry warnings + cook-from-pantry suggestions.
ok("pantry expiry and cook-from-pantry", () => {
  store.createProfile("H");
  const t = meals.todayISO();
  const plus = (n) => { const d = new Date(t + "T12:00:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  meals.addPantryItem({ name: "Milk", qty: 1, unit: "gal", expires: plus(2) });
  meals.addPantryItem({ name: "Yogurt", qty: 2, unit: "cups", expires: plus(10) });
  const exp = meals.expiringPantry(4, t);
  assert.strictEqual(exp.length, 1);
  assert.strictEqual(exp[0].name, "Milk");
  const sug = meals.recipesUsingPantry(5);
  assert.ok(Array.isArray(sug), "suggestions return an array");
});

// 11. Grocery budget tracking across months.
ok("grocery budget month totals", () => {
  store.createProfile("H");
  meals.logGrocerySpend(100, "2026-10-01", "big shop");
  meals.logGrocerySpend(25.5, "2026-10-15");
  meals.logGrocerySpend(75, "2026-09-20");
  assert.strictEqual(meals.grocerySpendTotal("2026-10"), 125.5);
  assert.strictEqual(meals.grocerySpendTotal("2026-09"), 75);
  meals.setGroceryBudget(500);
  assert.strictEqual(meals.getGroceryBudget(), 500);
  const pct = meals.grocerySpendTotal("2026-10") / meals.getGroceryBudget();
  assert.ok(pct < 1, "under budget");
});

// 12. Sleep debt accumulates deficits over a rolling window.
ok("sleep debt rolling window", () => {
  store.createProfile("H");
  const day = (off) => { const d = new Date(Date.now() - off * 864e5); return d.toISOString().slice(0, 10); };
  health.logEntry("sleep", 5, new Date(day(3) + "T12:00:00"));
  health.logEntry("sleep", 8.5, new Date(day(2) + "T12:00:00"));
  health.logEntry("sleep", 6.5, new Date(day(1) + "T12:00:00"));
  const d = health.sleepDebt(4, 8, day(0));
  assert.strictEqual(d.debt, -4.5, "deficits: -3 + -1.5, surplus ignored; got " + d.debt);
  assert.strictEqual(d.logged, 3);
  assert.ok(d.rows.every(r => r.diff === null || typeof r.diff === "number"));
  const d2 = health.sleepDebt(4, 8, day(0));
  assert.strictEqual(d2.debt, d.debt, "deterministic");
});

console.log("\\nAll " + n + " e2e flows passed.");

