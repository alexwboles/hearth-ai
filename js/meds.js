// Hearth AI — medications: dose check-off, refill math, adherence.
// Ported (with permission by consolidation) from the retired medtrack-ai project.
// Schedule/reminder organizer only — NOT medical advice.
// Per-profile namespaced persistence via HearthStore. Browser + node compatible.
(function () {
"use strict";

const store = (typeof require !== "undefined") ? require("./store.js") : window.HearthStore;

const DISCLAIMER = "Not medical advice. Always follow your prescriber's instructions — Hearth only helps you remember your own schedule.";

function pad(n) { return (n < 10 ? "0" : "") + n; }
function toStr(d) {
  return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
}
function parse(str) {
  const p = String(str).split("-");
  return new Date(parseInt(p[0], 10), parseInt(p[1], 10) - 1, parseInt(p[2], 10));
}
function addDays(str, n) {
  const d = parse(str);
  d.setDate(d.getDate() + n);
  return toStr(d);
}
function todayStr() { return toStr(new Date()); }
function nowHHMM() {
  const d = new Date();
  return pad(d.getHours()) + ":" + pad(d.getMinutes());
}

let _seq = 0;
function genId() {
  _seq += 1;
  return "med" + Date.now().toString(36) + _seq.toString(36);
}

function validTime(t) { return /^\d{2}:\d{2}$/.test(t) && t >= "00:00" && t <= "23:59"; }

function validateMed(input) {
  const errors = [];
  if (!input.name || !String(input.name).trim()) errors.push("Medication name is required.");
  if (!input.dose || !String(input.dose).trim()) errors.push("Dose is required (e.g. \"10mg\", \"1 tablet\").");
  const prn = !!input.prn;
  const times = input.times || [];
  if (prn) {
    const mpd = Number(input.maxPerDay);
    if (isNaN(mpd) || mpd < 1 || Math.floor(mpd) !== mpd)
      errors.push("As-needed meds need a whole-number max doses per day ≥ 1.");
  } else if (!times.length) {
    errors.push("Add at least one scheduled time.");
  }
  times.forEach(t => { if (!validTime(t)) errors.push("Bad time: " + t + " (use HH:MM)."); });
  const pills = Number(input.pillsRemaining);
  if (isNaN(pills) || pills < 0 || Math.floor(pills) !== pills) errors.push("Pills remaining must be a whole number ≥ 0.");
  const thr = Number(input.refillThreshold == null ? 7 : input.refillThreshold);
  if (isNaN(thr) || thr < 0) errors.push("Refill alert threshold must be ≥ 0 days.");
  const lead = Number(input.refillLeadDays == null ? 3 : input.refillLeadDays);
  if (isNaN(lead) || lead < 0) errors.push("Refill lead time must be ≥ 0 days.");
  return { ok: errors.length === 0, errors };
}

// ---------- persistence ----------
function getMeds() { return store.get("meds", []); }
function saveMeds(meds) { store.set("meds", meds); }
function findMed(meds, id) {
  for (let i = 0; i < meds.length; i++) if (meds[i].id === id) return meds[i];
  return null;
}

function addMed(input) {
  const v = validateMed(input);
  if (!v.ok) throw new Error(v.errors.join(" "));
  const meds = getMeds();
  const med = {
    id: genId(),
    name: String(input.name).trim(),
    dose: String(input.dose).trim(),
    prn: !!input.prn,
    maxPerDay: input.prn ? Number(input.maxPerDay) : 0,
    times: (input.times || []).slice().sort(),
    pillsRemaining: Number(input.pillsRemaining),
    refillThreshold: Number(input.refillThreshold == null ? 7 : input.refillThreshold),
    refillLeadDays: Number(input.refillLeadDays == null ? 3 : input.refillLeadDays),
    notes: String(input.notes || "").trim(),
    remind: input.remind !== false,
    createdAt: input.today || todayStr(),
    log: []
  };
  meds.push(med);
  saveMeds(meds);
  return med;
}

function deleteMed(id) {
  const meds = getMeds().filter(m => m.id !== id);
  saveMeds(meds);
  return meds;
}

function takenOn(med, date, time) {
  return med.log.some(e => e.date === date && e.time === time);
}

function logDose(id, date, time) {
  const meds = getMeds();
  const med = findMed(meds, id);
  if (!med) throw new Error("Medication not found.");
  if (med.times.indexOf(time) === -1) throw new Error("Not a scheduled time for this medication.");
  if (takenOn(med, date, time)) return { already: true, med };
  med.log.push({ date, time, at: new Date().toISOString() });
  med.pillsRemaining = Math.max(0, med.pillsRemaining - 1);
  saveMeds(meds);
  return { already: false, med };
}

function undoDose(id, date, time) {
  const meds = getMeds();
  const med = findMed(meds, id);
  if (!med) throw new Error("Medication not found.");
  for (let i = 0; i < med.log.length; i++) {
    if (med.log[i].date === date && med.log[i].time === time) {
      med.log.splice(i, 1);
      med.pillsRemaining += 1;
      saveMeds(meds);
      return med;
    }
  }
  throw new Error("No logged dose to undo.");
}

function prnTakenOn(med, date) {
  return med.log.filter(e => e.date === date).length;
}

function logPrnDose(id, date) {
  const meds = getMeds();
  const med = findMed(meds, id);
  if (!med) throw new Error("Medication not found.");
  if (!med.prn) throw new Error("Not an as-needed medication.");
  const taken = prnTakenOn(med, date);
  if (taken >= med.maxPerDay) throw new Error("Daily limit reached (" + med.maxPerDay + " per day).");
  const d = new Date();
  med.log.push({ date, time: pad(d.getHours()) + ":" + pad(d.getMinutes()), at: d.toISOString(), prn: true });
  med.pillsRemaining = Math.max(0, med.pillsRemaining - 1);
  saveMeds(meds);
  return { med, takenToday: taken + 1 };
}

function refillMed(id, newCount) {
  const meds = getMeds();
  const med = findMed(meds, id);
  if (!med) throw new Error("Medication not found.");
  const n = Number(newCount);
  if (isNaN(n) || n < 0 || Math.floor(n) !== n) throw new Error("New pill count must be a whole number ≥ 0.");
  med.pillsRemaining = n;
  saveMeds(meds);
  return med;
}

// ---------- math (pure) ----------
function dosesPerDay(med) {
  if (med.prn) return med.maxPerDay > 0 ? med.maxPerDay : 0;
  return med.times.length;
}
function daysLeft(med) {
  const dpd = dosesPerDay(med);
  if (dpd === 0) return Infinity;
  return Math.floor(med.pillsRemaining / dpd);
}
function refillAlert(med) {
  return daysLeft(med) <= med.refillThreshold;
}
function refillLeadDays(med) {
  const n = Number(med.refillLeadDays);
  return (isNaN(n) || n < 0) ? 3 : Math.floor(n);
}
function orderByDate(med, today) {
  today = today || todayStr();
  return addDays(today, daysLeft(med) - refillLeadDays(med));
}
function orderAlert(med, today) {
  today = today || todayStr();
  return orderByDate(med, today) <= today;
}

function missedDoses(med, date, current) {
  return med.times.filter(t => {
    if (takenOn(med, date, t)) return false;
    if (current && t >= current) return false;
    return true;
  }).map(t => ({ medId: med.id, name: med.name, dose: med.dose, date, time: t }));
}
function allMissed(meds, date, current) {
  let out = [];
  meds.forEach(m => { out = out.concat(missedDoses(m, date, current)); });
  return out.sort((a, b) => (a.time < b.time ? -1 : 1));
}

function historyFor(meds, days, today) {
  today = today || todayStr();
  const out = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    let scheduled = 0, taken = 0;
    meds.forEach(m => {
      const hasLogs = m.log.some(e => e.date === date);
      if (m.createdAt > date && !hasLogs) return;
      m.times.forEach(t => {
        scheduled++;
        if (takenOn(m, date, t)) taken++;
      });
    });
    out.push({ date, scheduled, taken, missed: scheduled - taken });
  }
  return out;
}
function adherence(med, days, today) {
  const hist = historyFor([med], days, today || todayStr());
  let s = 0, t = 0;
  hist.forEach(d => { s += d.scheduled; t += d.taken; });
  if (!s) return null;
  return Math.round((t / s) * 100);
}

function streakDays(meds, today, current) {
  today = today || todayStr();
  let streak = 0;
  for (let back = 0; back < 365; back++) {
    const date = addDays(today, -back);
    let scheduled = 0, missed = 0;
    (meds || []).forEach(m => {
      if (m.prn) return;
      const hasLogs = m.log.some(e => e.date === date);
      if (m.createdAt > date && !hasLogs) return;
      (m.times || []).forEach(t => {
        if (back === 0 && current && t >= current) return;
        scheduled++;
        if (!takenOn(m, date, t)) missed++;
      });
    });
    if (scheduled === 0) {
      if (back === 0) continue;
      break;
    }
    if (missed > 0) break;
    streak++;
  }
  return streak;
}

// Doses due within `withinMin` minutes or overdue by at most `lateMin` — unlogged only.
function dueReminders(meds, date, current, withinMin, lateMin) {
  const toMin = hhmm => {
    const p = String(hhmm || "").split(":");
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  };
  const now = toMin(current);
  const w = Math.max(0, Number(withinMin) || 10);
  const l = Math.max(0, Number(lateMin) || 30);
  const out = [];
  (meds || []).forEach(m => {
    if (m.prn || m.remind === false) return;
    (m.times || []).forEach(t => {
      if (takenOn(m, date, t)) return;
      const diff = toMin(t) - now;
      if (diff <= w && diff >= -l) out.push({ medId: m.id, name: m.name, dose: m.dose, time: t, overdue: diff < 0 });
    });
  });
  return out.sort((a, b) => (a.time < b.time ? -1 : 1));
}

// One-glance status for the morning briefing and the chat "did I take my pills" command.
function dayStatus(today, current) {
  today = today || todayStr();
  current = current || nowHHMM();
  const meds = getMeds();
  const missed = allMissed(meds, today, current);
  const dueSoon = dueReminders(meds, today, current, 120, 30);
  const refills = meds.filter(m => refillAlert(m) || orderAlert(m, today)).map(m => ({
    medId: m.id, name: m.name, dose: m.dose,
    pillsRemaining: m.pillsRemaining, daysLeft: daysLeft(m),
    orderBy: orderByDate(m, today), orderNow: orderAlert(m, today)
  }));
  const perMed = meds.map(m => {
    const taken = m.prn
      ? prnTakenOn(m, today)
      : m.times.filter(t => takenOn(m, today, t)).length;
    const scheduled = m.prn ? m.maxPerDay : m.times.length;
    return {
      id: m.id, name: m.name, dose: m.dose, prn: m.prn,
      taken, scheduled,
      allTaken: scheduled > 0 && taken >= scheduled,
      adherence7: m.prn ? null : adherence(m, 7, today),
      daysLeft: daysLeft(m)
    };
  });
  return { today, meds: perMed, missed, dueSoon, refills, streak: streakDays(meds, today, current) };
}

function refillBoard(today) {
  today = today || todayStr();
  return getMeds().map(m => ({
    id: m.id, name: m.name, dose: m.dose,
    pillsRemaining: m.pillsRemaining,
    dosesPerDay: dosesPerDay(m),
    daysLeft: daysLeft(m),
    alert: refillAlert(m),
    orderBy: orderByDate(m, today),
    orderNow: orderAlert(m, today)
  })).sort((a, b) => a.daysLeft - b.daysLeft);
}

const api = {
  DISCLAIMER,
  toStr, parse, addDays, todayStr,
  validateMed, addMed, listMeds: getMeds, deleteMed, findMedById: (id) => findMed(getMeds(), id),
  logDose, undoDose, takenOn, logPrnDose, prnTakenOn, refillMed,
  dosesPerDay, daysLeft, refillAlert, refillLeadDays, orderByDate, orderAlert,
  missedDoses, allMissed, historyFor, adherence,
  streakDays, dueReminders, dayStatus, refillBoard
};

if (typeof window !== "undefined") window.HearthMeds = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
