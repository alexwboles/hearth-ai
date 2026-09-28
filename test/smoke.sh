#!/usr/bin/env bash
# Hearth AI smoke tests — fast sanity checks. Exit non-zero on first failure.
set -euo pipefail
cd "$(dirname "$0")/.."

pass() { echo "PASS: $1"; }
fail() { echo "FAIL: $1"; exit 1; }

# 1: required files exist
for f in index.html css/style.css js/data.js js/store.js js/meals.js js/health.js js/schedule.js js/comms.js js/sheets.js js/research.js js/proactive.js js/chat.js js/app.js README.md test/e2e.sh test/run-e2e.js; do
  [ -f "$f" ] || fail "missing file $f"
done
pass "all required files exist"

# 2: JS syntax valid
for f in js/*.js test/run-e2e.js; do
  node --check "$f" || fail "syntax error in $f"
done
pass "JS syntax valid (11 files)"

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

echo ""
echo "All 13 smoke checks passed."
