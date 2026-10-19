#!/usr/bin/env bash
# Hearth AI smoke tests — fast sanity checks. Exit non-zero on first failure.
set -euo pipefail
cd "$(dirname "$0")/.."

npass=0
pass() { npass=$((npass + 1)); echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

# 1: required files exist
for f in index.html css/style.css js/data.js js/store.js js/meals.js js/health.js js/meds.js js/schedule.js js/comms.js js/sheets.js js/research.js js/proactive.js js/chat.js js/app.js README.md test/e2e.sh test/run-e2e.js; do
  [ -f "$f" ] || fail "missing file $f"
done
pass "all required files exist"

# 2: JS syntax valid
for f in js/*.js test/run-e2e.js; do
  node --check "$f" || fail "syntax error in $f"
done
pass "JS syntax valid ($(ls js/*.js test/run-e2e.js | wc -l) files)"

# 3: recipe bank sanity
node -e "
const D = require('./js/data.js');
if (D.RECIPES.length < 12) throw new Error('need 12+ recipes');
D.RECIPES.forEach(r => {
  if (!r.id || !r.name || !r.meal || !r.ingredients.length || !r.steps.length) throw new Error('bad recipe ' + r.id);
  r.ingredients.forEach(i => { if (!i.name || !i.aisle || !(i.qty > 0)) throw new Error('bad ingredient in ' + r.id); });
});
if (D.STAPLES.length < 8) throw new Error('need 8+ staples');
if (D.EMAIL_TEMPLATES.length < 4 || D.CALL_SCRIPTS.length < 3) throw new Error('need comms templates');
console.log('OK: ' + D.RECIPES.length + ' recipes, ' + D.STAPLES.length + ' staples');
" || fail "seed data sanity"
pass "seed data sane"

# 4: profile namespacing isolates data
node -e "
const store = require('./js/store.js');
store.resetForTests();
const a = store.createProfile('A'), b = store.createProfile('B');
store.switchProfile(a.id); store.set('k', 'va');
store.switchProfile(b.id);
if (store.get('k', null) !== null) throw new Error('cross-profile leak');
store.switchProfile(a.id);
if (store.get('k') !== 'va') throw new Error('profile data lost');
console.log('OK');
" || fail "profile isolation"
pass "per-profile namespacing isolates data"

# 5: meal plan respects diet + grocery aggregation merges quantities
node -e "
const store = require('./js/store.js'); store.resetForTests(); store.createProfile('H');
const meals = require('./js/meals.js');
const plan = meals.generatePlan({ diet: 'vegan', servings: 4, days: 3, startOffset: 1 });
plan.plan.forEach(d => Object.values(d.meals).forEach(id => {
  const r = meals.recipeById(id);
  if (r.tags.indexOf('vegan') === -1) throw new Error(r.name + ' breaks vegan');
}));
const list = meals.groceryFromPlan(plan);
const dupes = list.filter(i => list.filter(j => j.name === i.name && j.unit === i.unit).length > 1);
if (dupes.length) throw new Error('unmerged grocery items');
const groups = meals.groupByAisle(list);
if (groups[0].aisle !== 'Produce') throw new Error('aisle order wrong');
console.log('OK: ' + list.length + ' items, ' + groups.length + ' aisles');
" || fail "meals logic"
pass "meal plan honors diet; groceries aggregate and group by aisle"

# 6: apple health xml parse + nudge rules
node -e "
const store = require('./js/store.js'); store.resetForTests(); store.createProfile('H');
const health = require('./js/health.js');
const xml = '<HealthData><Record type=\"HKQuantityTypeIdentifierStepCount\" unit=\"count\" startDate=\"2026-09-27 08:00:00 -0400\" endDate=\"2026-09-27 08:10:00 -0400\" value=\"500\"/></HealthData>';
const p = health.parseAppleHealthXML(xml);
if (p.steps['2026-09-27'] !== 500) throw new Error('step parse failed');
health.logEntry('sleep', 5); health.logEntry('sleep', 5.5, new Date(Date.now() - 864e5));
const n = health.nudges();
if (!n.some(x => x.id === 'sleep-low')) throw new Error('sleep nudge missing');
console.log('OK: ' + n.length + ' nudges');
" || fail "health logic"
pass "apple health import parses; low-sleep nudge fires"

# 7: schedule conflicts + meeting prep
node -e "
const store = require('./js/store.js'); store.resetForTests(); store.createProfile('H');
const s = require('./js/schedule.js');
s.addEvent({ title: 'A', date: '2026-10-01', start: '10:00', end: '11:00' });
s.addEvent({ title: 'B', date: '2026-10-01', start: '10:30', end: '11:30' });
s.addEvent({ title: 'C', date: '2026-10-01', start: '12:00', end: '13:00' });
const c = s.detectConflicts(s.listEvents('2026-10-01'));
if (c.length !== 1 || c[0].a.title !== 'A') throw new Error('conflict detection wrong');
console.log('OK');
" || fail "schedule logic"
pass "calendar conflict detection works"

# 8: comms planner model — drafts only, never sent
node -e "
const store = require('./js/store.js'); store.resetForTests(); store.createProfile('H');
const c = require('./js/comms.js');
const d = c.draftEmail({ templateId: 'thank-you', tone: 'concise', fields: { name: 'Jo', reason: 'the referral' } });
if (d.status !== 'draft' || /{{/.test(d.body)) throw new Error('bad draft');
const a = c.approveDraft(d.id);
if (a.status !== 'approved') throw new Error('approve failed');
if (JSON.stringify(a).indexOf('\"sent\"') !== -1) throw new Error('planner model violated');
const sc = c.callScript({ scenarioId: 'follow-up-call', fields: { name: 'Jo', topic: 'the quote' } });
if (sc.sections.length !== 4) throw new Error('script needs 4 sections');
console.log('OK');
" || fail "comms logic"
pass "email drafts approve without ever sending; call scripts structured"

# 9: sheets csv handles quotes/commas/newlines
node -e "
const store = require('./js/store.js'); store.resetForTests(); store.createProfile('H');
const sh = require('./js/sheets.js');
const s = sh.createSheet('T', 2, 2);
sh.setCell(s.id, 0, 0, 'a,b'); sh.setCell(s.id, 0, 1, 'q\"q');
const back = sh.getSheet(sh.csvImport(sh.csvExport(s.id), 'C').id);
if (back.grid[0][0] !== 'a,b' || back.grid[0][1] !== 'q\"q') throw new Error('csv roundtrip failed');
console.log('OK');
" || fail "sheets logic"
pass "sheets CSV round-trips tricky fields"

# 10: chat parses core intents
node -e "
const chat = require('./js/chat.js');
const cases = { 'plan my meals': 'plan_meals', 'log 8 hours of sleep': 'log_sleep', 'morning briefing': 'briefing', 'add task x': 'add_task', 'draft email': 'draft_email', 'research solar': 'research' };
Object.keys(cases).forEach(k => {
  if (chat.parseIntent(k).intent !== cases[k]) throw new Error('intent miss: ' + k);
});
console.log('OK');
" || fail "chat intents"
pass "chat intent parsing covers core commands"

# 11: premium design checks — no gradients, single accent, responsive meta
grep -q "linear-gradient" css/style.css && fail "gradient found in css"
grep -q "linear-gradient" index.html && fail "gradient found in html"
grep -q -- "--accent:" css/style.css || fail "accent token missing"
grep -q "viewport" index.html || fail "viewport meta missing"
grep -q "max-width" css/style.css || fail "no responsive rules"
pass "premium design: no gradients, accent token, viewport + responsive rules"

# 12: no emoji in UI chrome (data, logic, markup, styles)
if grep -rP '[\x{1F300}-\x{1FAFF}\x{2600}-\x{27BF}\x{2B00}-\x{2BFF}]' index.html css/style.css js/ test/run-e2e.js >/dev/null 2>&1; then
  fail "emoji found in UI chrome"
fi
pass "emoji-free chrome"

# 13: no external network calls or credentials in code
if grep -rE "https?://" js/ index.html | grep -v "w3.org" | grep -v "github.com/alexwboles" >/dev/null 2>&1; then
  fail "external URL found in app code"
fi
if grep -riE "api[_-]?key|secret|token|password" js/ index.html >/dev/null 2>&1; then
  fail "credential-like string found"
fi
pass "zero external calls, zero credentials"


# 14: pantry — add/remove, expiry warnings, coverage math
node -e "
const store = require('./js/store.js'); store.resetForTests(); store.createProfile('H');
const meals = require('./js/meals.js');
const a = meals.addPantryItem({ name: 'Chicken breast', qty: 2, unit: 'lb', expires: '2026-10-14' });
meals.addPantryItem({ name: 'Rice', qty: 5, unit: 'lb' });
if (meals.listPantry().length !== 2) throw new Error('pantry count');
const exp = meals.expiringPantry(4, '2026-10-12');
if (exp.length !== 1 || exp[0].name !== 'Chicken breast') throw new Error('expiry filter: ' + JSON.stringify(exp));
const cov = meals.pantryCoverage([{ name: 'chicken breast', qty: 3, unit: 'lb' }, { name: 'Rice', qty: 5, unit: 'lb' }, { name: 'Broccoli', qty: 1, unit: 'head' }]);
if (cov[0].need !== 1 || cov[0].have !== 2) throw new Error('partial coverage: ' + JSON.stringify(cov[0]));
if (!cov[1].covered || cov[1].need !== 0) throw new Error('full coverage failed');
if (cov[2].have !== 0 || cov[2].need !== 1) throw new Error('no-stock failed');
const sug = meals.recipesUsingPantry(3);
if (!sug.length || !sug.every(x => x.hits > 0)) throw new Error('pantry recipe suggestions empty');
meals.removePantryItem(a.id);
if (meals.listPantry().length !== 1) throw new Error('remove failed');
let threw = false;
try { meals.addPantryItem({ name: '', qty: 1 }); } catch (e) { threw = true; }
if (!threw) throw new Error('empty name accepted');
console.log('OK: coverage + expiry + suggestions');
" || fail "pantry logic"
pass "pantry inventory: expiry warnings, coverage math, cook-from-pantry"

# 15: grocery budget — log trips, monthly totals, budget set/clear
node -e "
const store = require('./js/store.js'); store.resetForTests(); store.createProfile('H');
const meals = require('./js/meals.js');
meals.logGrocerySpend(84.20, '2026-10-05', 'Weekly shop');
meals.logGrocerySpend(32.50, '2026-10-11', 'Top-up');
meals.logGrocerySpend(50, '2026-09-28', 'Last month');
if (meals.grocerySpendTotal('2026-10') !== 116.7) throw new Error('oct total: ' + meals.grocerySpendTotal('2026-10'));
if (meals.grocerySpendTotal('2026-09') !== 50) throw new Error('sep total wrong');
meals.setGroceryBudget(400);
if (meals.getGroceryBudget() !== 400) throw new Error('budget not set');
meals.setGroceryBudget('');
if (meals.getGroceryBudget() !== null) throw new Error('budget not cleared');
const list = meals.listGrocerySpend();
if (list[0].date !== '2026-10-11') throw new Error('not newest-first');
meals.removeGrocerySpend(list[0].id);
if (meals.listGrocerySpend().length !== 2) throw new Error('remove failed');
let threw = false;
try { meals.logGrocerySpend(-5, '2026-10-12'); } catch (e) { threw = true; }
if (!threw) throw new Error('negative spend accepted');
console.log('OK');
" || fail "grocery budget logic"
pass "grocery budget: trip logging, monthly totals, set/clear"

# 16: sleep debt — deficits accumulate, surpluses do not repay
node -e "
const store = require('./js/store.js'); store.resetForTests(); store.createProfile('H');
const health = require('./js/health.js');
const day = (off) => { const d = new Date(Date.now() - off * 864e5); return d.toISOString().slice(0, 10); };
health.logEntry('sleep', 6, new Date(day(2) + 'T12:00:00'));
health.logEntry('sleep', 9.5, new Date(day(1) + 'T12:00:00'));
health.logEntry('sleep', 7, new Date(day(0) + 'T12:00:00'));
const d = health.sleepDebt(3, 8, day(0));
if (d.debt !== -3) throw new Error('debt should be -3 (6h night), got ' + d.debt);
if (d.logged !== 3) throw new Error('logged count');
if (d.avg !== 7.5) throw new Error('avg: ' + d.avg);
if (d.rows.length !== 3 || d.rows[0].date !== day(2)) throw new Error('rows oldest-first');
const empty = health.sleepDebt(7, 8);
if (empty.logged !== 3) throw new Error('default window should include the 3 logs');
console.log('OK: debt=' + d.debt + 'h avg=' + d.avg + 'h');
" || fail "sleep debt logic"
pass "sleep debt: rolling deficits vs 8h target"

# 17: UI wiring — pantry, budget, sleep debt
for id in pantryName pantryQty pantryUnit pantryExp pantryAdd pantryOut pantryWarn pantryRecipes budgetIn budgetSave spendAmt spendDate spendNote spendAdd budgetOut sleepDebtOut prepCartPantryBtn; do
  grep -q "id=\"$id\"" index.html || grep -q "\"$id\"" js/app.js || fail "missing UI id: $id"
done
pass "pantry/budget/sleep-debt UI wired"

# 18: UI wiring — workouts, recurring tasks, sleep-mood insight
for id in woType woMin woAdd woGoal woGoalBtn workoutsOut insightOut taskRepeat; do
  grep -q "id=\"$id\"" index.html || grep -q "\"$id\"" js/app.js || fail "missing UI id: $id"
done
pass "workout log / recurring tasks / insight UI wired"

# 19: sleep-mood link, workout log, recurring tasks
node -e "
const store = require('./js/store.js'); store.resetForTests(); store.createProfile('H');
const health = require('./js/health.js');
const schedule = require('./js/schedule.js');
const day = (off) => { const d = new Date(Date.now() - off * 864e5); return d.toISOString().slice(0, 10); };
const at = (off) => new Date(day(off) + 'T12:00:00');
// sleep-mood: 2 rested + 2 short paired nights
health.logEntry('sleep', 8, at(4)); health.logEntry('mood', 5, at(4));
health.logEntry('sleep', 7.5, at(3)); health.logEntry('mood', 4, at(3));
health.logEntry('sleep', 5, at(2)); health.logEntry('mood', 2, at(2));
health.logEntry('sleep', 5.5, at(1)); health.logEntry('mood', 3, at(1));
const link = health.sleepMoodLink(30);
if (!link) throw new Error('link should exist');
if (link.restedMood !== 4.5) throw new Error('rested mood: ' + link.restedMood);
if (link.shortMood !== 2.5) throw new Error('short mood: ' + link.shortMood);
if (link.gap !== 2) throw new Error('gap: ' + link.gap);
if (link.pairs !== 4) throw new Error('pairs: ' + link.pairs);
if (!/sleep/.test(link.copy)) throw new Error('no human copy');
if (health.sleepMoodLink(1) !== null) throw new Error('1-day window must be null');
// workouts (Monday-anchored so the week total holds on any weekday)
const _now = new Date();
const _mon = new Date(_now);
_mon.setDate(_now.getDate() - ((_now.getDay() + 6) % 7));
const _mday = (off) => new Date(_mon.getTime() + off * 864e5).toISOString().slice(0, 10);
const w = health.logWorkout('run', 30, new Date(_mday(0) + 'T12:00:00'));
if (w.type !== 'run' || w.minutes !== 30) throw new Error('workout shape');
health.logWorkout('yoga', 20, new Date(_mday(1) + 'T12:00:00'));
const wk = health.workoutWeek(_mday(0));
if (wk.minutes !== 50 || wk.sessions !== 2) throw new Error('week minutes: ' + JSON.stringify(wk));
if (health.workoutGoal() !== 150) throw new Error('default goal should be 150');
health.setWorkoutGoal(60);
if (health.workoutGoal() !== 60) throw new Error('goal not set');
let threw = false; try { health.logWorkout('run', 0); } catch (e) { threw = true; }
if (!threw) throw new Error('zero minutes accepted');
threw = false; try { health.setWorkoutGoal(5); } catch (e) { threw = true; }
if (!threw) throw new Error('tiny goal accepted');
health.deleteWorkout(w.id);
if (health.listWorkouts().length !== 1) throw new Error('delete failed');
// recurring tasks
const t = schedule.addTask({ title: 'Water plants', due: day(0), repeat: 'daily' });
if (t.repeat !== 'daily') throw new Error('repeat not stored');
const done = schedule.toggleTask(t.id);
if (!done.spawned) throw new Error('no next occurrence spawned');
if (done.spawned.due !== day(-1)) throw new Error('next due should be tomorrow, got ' + done.spawned.due);
if (done.spawned.repeat !== 'daily' || done.spawned.done) throw new Error('spawn shape wrong');
const tw = schedule.addTask({ title: 'Pay rent', due: day(0), repeat: 'weekly' });
const doneW = schedule.toggleTask(tw.id);
if (doneW.spawned.due !== day(-7)) throw new Error('weekly next due: ' + doneW.spawned.due);
const once = schedule.addTask({ title: 'One-off' });
if (schedule.toggleTask(once.id).spawned) throw new Error('one-off should not spawn');
const bad = schedule.addTask({ title: 'X', repeat: 'bogus' });
if (bad.repeat !== 'none') throw new Error('bad repeat not normalized to none');
console.log('OK');
" || fail "workout / sleep-mood / recurring logic"
pass "sleep-mood insight, workout log with weekly goal, recurring tasks"

echo ""
echo "All $npass smoke checks passed (pre-redesign-sweep suite)."

# redesign sweep: icon nav, dark sidebar, sharp geometry
node -e "
const fs = require('fs'), a = fs.readFileSync('js/app.js', 'utf8');
if (!/const ICONS = \{[\s\S]*chat:/.test(a)) throw new Error('no ICONS map');
for (const v of ['chat','meals','health','schedule','comms','sheets','research','briefing'])
  if (!a.includes(v + ':')) throw new Error('missing icon ' + v);
if (!a.includes('nav-ico')) throw new Error('no nav-ico class');
console.log('OK');" || fail "sidebar icon nav in app.js"
pass "sidebar icon nav in app.js"

node -e "
const fs = require('fs'), c = fs.readFileSync('css/style.css', 'utf8');
const radii = c.match(/border-(?:top-|bottom-)?(?:left-|right-)?radius:\s*([^;]+);/g) || [];
const bad = radii.filter(r => !/:\s*0;/.test(r));
if (bad.length) throw new Error('rounded remnants: ' + bad.slice(0, 3).join(', '));
if (!c.includes('background: #211a13')) throw new Error('no dark sidebar');
if (!c.includes('.nav-btn .nav-ico')) throw new Error('no nav-ico css');
if (!c.includes('border-left: 3px solid var(--accent)')) throw new Error('no chat accent bar');
console.log('OK');" || fail "sharp geometry + dark sidebar css"
pass "sharp geometry + dark sidebar css"

# 20: medications — dose check-off, refill math, adherence, validation, per-profile isolation
node -e "
const store = require('./js/store.js'); store.resetForTests(); store.createProfile('H');
const meds = require('./js/meds.js');
const fresh = (id) => meds.listMeds().find(x => x.id === id);
const m = meds.addMed({ name: 'Lisinopril', dose: '10mg', times: ['08:00', '20:00'], pillsRemaining: 30, today: '2026-10-15' });
if (meds.daysLeft(fresh(m.id)) !== 15) throw new Error('daysLeft wrong');
meds.logDose(m.id, '2026-10-15', '08:00');
if (fresh(m.id).pillsRemaining !== 29) throw new Error('check-off did not decrement');
meds.logDose(m.id, '2026-10-15', '20:00');
const st = meds.dayStatus('2026-10-15', '21:00');
if (st.meds[0].taken !== 2 || !st.meds[0].allTaken) throw new Error('day status');
if (st.missed.length !== 0) throw new Error('false missed dose');
if (meds.adherence(fresh(m.id), 7, '2026-10-15') !== 100) throw new Error('adherence');
if (meds.refillAlert(fresh(m.id)) !== false) throw new Error('false refill alert');
meds.undoDose(m.id, '2026-10-15', '08:00');
if (fresh(m.id).pillsRemaining !== 29) throw new Error('undo did not restore');
const prn = meds.addMed({ name: 'Ibuprofen', dose: '200mg', prn: true, maxPerDay: 3, pillsRemaining: 20, today: '2026-10-15' });
meds.logPrnDose(prn.id, '2026-10-15');
if (meds.prnTakenOn(fresh(prn.id), '2026-10-15') !== 1) throw new Error('prn log');
const r = meds.refillMed(m.id, 90);
if (r.pillsRemaining !== 90) throw new Error('refill');
let threw = false;
try { meds.addMed({ name: '', dose: 'x', times: ['09:00'], pillsRemaining: 5 }); } catch (e) { threw = true; }
if (!threw) throw new Error('empty name accepted');
threw = false;
try { meds.logDose(m.id, '2026-10-15', '99:99'); } catch (e) { threw = true; }
if (!threw) throw new Error('unscheduled slot accepted');
store.createProfile('B');
store.switchProfile(store.listProfiles().find(p => p.name === 'B').id);
if (meds.listMeds().length !== 0) throw new Error('meds leaked across profiles');
console.log('OK: dose check-off, refill math, adherence, validation, isolation');
" || fail "medications logic"
pass "medications: dose check-off, refill math, adherence, validation, per-profile isolation"

# 21: UI wiring — medications view
grep -q 'id="view-meds"' index.html || fail "view-meds missing"
for id in medsTodayOut medsRefillOut medsAdhOut medsListOut medName medDose medTimes medPills medNotes medAdd medPrn medMaxPerDay medThreshold; do
  grep -q "id=\"$id\"" index.html || fail "missing UI id: $id"
done
grep -q 'src="js/meds.js"' index.html || fail "meds.js script tag missing"
grep -q 'require("../js/meds.js")\|require("./meds.js")\|js/meds.js' test/run-e2e.js test/smoke.sh || fail "meds.js not wired in tests"
pass "medications UI wired (view, forms, script tag)"

# 22: chat understands medication questions
node -e "
const chat = require('./js/chat.js');
['did i take my pills', 'did i take my pills?', 'how are my medications', 'refill status', 'my pills'].forEach(q => {
  if (chat.parseIntent(q).intent !== 'meds_status') throw new Error('intent miss: ' + q);
});
const store = require('./js/store.js'); store.resetForTests(); store.createProfile('H');
const r = chat.respond('did i take my pills');
if (r.reply.indexOf('No medications tracked yet') === -1) throw new Error('empty-state reply: ' + r.reply);
const meds = require('./js/meds.js');
meds.addMed({ name: 'Lisinopril', dose: '10mg', times: ['08:00'], pillsRemaining: 30, refillThreshold: 7, today: meds.todayStr() });
const r2 = chat.respond('did i take my pills');
if (r2.reply.indexOf('Lisinopril') === -1 || r2.reply.indexOf('days left') === -1) throw new Error('status reply: ' + r2.reply);
if (r2.view !== 'meds') throw new Error('meds_status should open the meds view');
console.log('OK');
" || fail "chat meds intent"
pass "chat answers \"did I take my pills?\" with status + meds view"

echo ""
echo "All $npass smoke checks passed."
