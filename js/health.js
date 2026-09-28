// Hearth AI — health: manual logs, Apple Health export parsing, trends, predictive nudges.
(function () {
"use strict";

const D = (typeof require !== "undefined") ? require("./data.js") : window.HearthData;
const store = (typeof require !== "undefined") ? require("./store.js") : window.HearthStore;

function dayKey(d) {
  d = d || new Date();
  const m = ("0" + (d.getMonth() + 1)).slice(-2), day = ("0" + d.getDate()).slice(-2);
  return d.getFullYear() + "-" + m + "-" + day;
}

function logEntry(type, value, date) {
  const t = D.HEALTH_TYPES.find(x => x.id === type);
  if (!t) throw new Error("unknown health type: " + type);
  value = Number(value);
  if (!isFinite(value) || value < 0) throw new Error("invalid value for " + type);
  if (type === "mood" && (value < 1 || value > 5)) throw new Error("mood must be 1-5");
  const logs = store.get("healthLogs", []);
  const key = dayKey(date ? new Date(date) : new Date());
  const existing = logs.findIndex(l => l.type === type && l.date === key);
  const entry = { type, value, date: key, at: new Date().toISOString(), source: "manual" };
  if (existing >= 0) logs[existing] = entry; else logs.push(entry);
  store.set("healthLogs", logs);
  return entry;
}

function getLogs(type, days) {
  const logs = store.get("healthLogs", []).filter(l => l.type === type);
  logs.sort((a, b) => a.date < b.date ? -1 : 1);
  if (days) {
    const cutoff = dayKey(new Date(Date.now() - (days - 1) * 864e5));
    return logs.filter(l => l.date >= cutoff);
  }
  return logs;
}

function avg(values) {
  if (!values.length) return null;
  return Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 10) / 10;
}

function weeklyAverages() {
  const out = {};
  D.HEALTH_TYPES.forEach(t => {
    const vals = getLogs(t.id, 7).map(l => l.value);
    out[t.id] = vals.length ? { avg: avg(vals), n: vals.length, goal: t.goal, unit: t.unit } : null;
  });
  return out;
}

function trendSeries(type, days) {
  days = days || 14;
  const byDay = {};
  getLogs(type, days).forEach(l => { byDay[l.date] = l.value; });
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const k = dayKey(new Date(Date.now() - i * 864e5));
    out.push({ date: k, value: byDay[k] != null ? byDay[k] : null });
  }
  return out;
}

// Parse an Apple Health export.xml (Health app > profile > Export All Health Data).
// Handles StepCount (sum per day), SleepAnalysis (hours per day), BodyMass (latest per day).
function parseAppleHealthXML(xml) {
  if (typeof xml !== "string" || xml.indexOf("<HealthData") === -1)
    throw new Error("not an Apple Health export file");
  const result = { steps: {}, sleep: {}, weight: {}, records: 0, errors: [] };

  const recRe = /<Record\s+([^>]*?)\/>/g;
  let m;
  while ((m = recRe.exec(xml)) !== null) {
    const attrs = m[1];
    const type = /type="([^"]+)"/.exec(attrs);
    const start = /startDate="([^"]+)"/.exec(attrs);
    const end = /endDate="([^"]+)"/.exec(attrs);
    const val = /value="([^"]+)"/.exec(attrs);
    if (!type || !start || !val) continue;
    const t = type[1], v = val[1];
    try {
      if (t === "HKQuantityTypeIdentifierStepCount") {
        const d = dayKey(new Date(start[1]));
        const unit = /unit="([^"]+)"/.exec(attrs);
        let steps = parseFloat(v);
        if (unit && unit[1] === "count/min") {
          const mins = (new Date(end[1]) - new Date(start[1])) / 60000;
          steps = steps * mins;
        }
        result.steps[d] = Math.round((result.steps[d] || 0) + steps);
        result.records++;
      } else if (t === "HKCategoryTypeIdentifierSleepAnalysis") {
        if (v === "HKCategoryValueSleepAnalysisAsleep" || v === "HKCategoryValueSleepAnalysisAsleepCore" ||
            v === "HKCategoryValueSleepAnalysisAsleepDeep" || v === "HKCategoryValueSleepAnalysisAsleepREM") {
          const hours = (new Date(end[1]) - new Date(start[1])) / 36e5;
          const d = dayKey(new Date(end[1]));
          result.sleep[d] = Math.round(((result.sleep[d] || 0) + hours) * 10) / 10;
          result.records++;
        }
      } else if (t === "HKQuantityTypeIdentifierBodyMass") {
        const d = dayKey(new Date(start[1]));
        let w = parseFloat(v);
        const unit = /unit="([^"]+)"/.exec(attrs);
        if (unit && unit[1] === "kg") w = w * 2.20462;
        result.weight[d] = Math.round(w * 10) / 10;
        result.records++;
      }
    } catch (e) { result.errors.push("record skipped: " + e.message); }
  }
  return result;
}

function importAppleHealth(parsed) {
  const logs = store.get("healthLogs", []);
  let added = 0;
  const upsert = (type, date, value) => {
    const i = logs.findIndex(l => l.type === type && l.date === date && l.source === "apple-health");
    const entry = { type, value, date, at: new Date().toISOString(), source: "apple-health" };
    if (i >= 0) logs[i] = entry; else logs.push(entry);
    added++;
  };
  Object.keys(parsed.steps || {}).forEach(d => upsert("steps", d, parsed.steps[d]));
  Object.keys(parsed.sleep || {}).forEach(d => upsert("sleep", d, parsed.sleep[d]));
  Object.keys(parsed.weight || {}).forEach(d => upsert("weight", d, parsed.weight[d]));
  store.set("healthLogs", logs);
  store.set("appleHealthImportedAt", new Date().toISOString());
  return { added, records: parsed.records };
}

// Simple rule-based predictive nudges.
function nudges(ctx) {
  ctx = ctx || {};
  const out = [];
  const sleep = getLogs("sleep", 3).map(l => l.value);
  const steps = getLogs("steps", 3).map(l => l.value);
  const water = getLogs("water", 3).map(l => l.value);
  const mood = getLogs("mood", 3).map(l => l.value);

  if (sleep.length >= 2 && avg(sleep) < 6.5)
    out.push({ id: "sleep-low", priority: 1, title: "Sleep running low",
      detail: "Averaging " + avg(sleep) + "h over the last " + sleep.length + " logged nights (goal 7-9h). " +
              ((ctx.busyTomorrow ? "Tomorrow looks busy — consider an earlier bedtime tonight." : "An earlier bedtime tonight could help.")) });
  if (steps.length >= 2 && avg(steps) < 5000)
    out.push({ id: "steps-low", priority: 2, title: "Activity dip",
      detail: "Averaging " + Math.round(avg(steps)) + " steps lately vs your 8,000 goal. A short walk today would close the gap." });
  if (water.length && water[water.length - 1] < 4)
    out.push({ id: "water-low", priority: 2, title: "Hydration check",
      detail: "Only " + water[water.length - 1] + " glasses logged most recently. Keep water nearby today." });
  if (mood.length >= 2 && avg(mood) <= 2.5)
    out.push({ id: "mood-low", priority: 1, title: "Mood check-in",
      detail: "Mood has been low the last couple of days. Be gentle with yourself — consider one small enjoyable activity today." });
  if (!sleep.length && !steps.length && !water.length)
    out.push({ id: "no-data", priority: 3, title: "Start your health picture",
      detail: "No health logs yet. Log tonight's sleep or import your Apple Health export to unlock trends and predictions." });

  // Staple prediction: items whose avg consumption window is nearly up.
  const bought = store.get("stapleBought", {});
  const now = Date.now();
  (D.STAPLES || []).forEach(s => {
    const last = bought[s.name];
    const daysSince = last ? (now - new Date(last).getTime()) / 864e5 : 999;
    if (daysSince >= s.avgDays * 0.85)
      out.push({ id: "staple-" + s.name, priority: 3, title: "Running low: " + s.name,
        detail: last ? "Last bought " + Math.round(daysSince) + " days ago (typical " + s.avgDays + "). Add a " + s.unit + " to the grocery list?"
                     : "No purchase recorded — a " + s.unit + " typically lasts " + s.avgDays + " days. Add to the grocery list?" });
  });

  out.sort((a, b) => a.priority - b.priority);
  return out;
}

function markStapleBought(name) {
  const bought = store.get("stapleBought", {});
  bought[name] = new Date().toISOString();
  store.set("stapleBought", bought);
  return bought[name];
}

const api = { dayKey, logEntry, getLogs, weeklyAverages, trendSeries,
              parseAppleHealthXML, importAppleHealth, nudges, markStapleBought };

if (typeof window !== "undefined") window.HearthHealth = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
