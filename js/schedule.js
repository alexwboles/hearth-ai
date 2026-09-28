// Hearth AI — schedule: tasks, calendar events, conflict detection, meeting prep.
(function () {
"use strict";

const store = (typeof require !== "undefined") ? require("./store.js") : window.HearthStore;

function uid(p) { return (p || "id") + "-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

function addTask(t) {
  t = t || {};
  if (!(t.title || "").trim()) throw new Error("task needs a title");
  const tasks = store.get("tasks", []);
  const task = { id: uid("task"), title: t.title.trim(), due: t.due || null,
                 priority: t.priority || "normal", notes: t.notes || "",
                 done: false, createdAt: new Date().toISOString() };
  tasks.push(task);
  store.set("tasks", tasks);
  return task;
}
function listTasks(filter) {
  let tasks = store.get("tasks", []);
  if (filter === "open") tasks = tasks.filter(t => !t.done);
  if (filter === "done") tasks = tasks.filter(t => t.done);
  if (filter === "today") {
    const today = new Date().toISOString().slice(0, 10);
    tasks = tasks.filter(t => !t.done && t.due && t.due.slice(0, 10) <= today);
  }
  const pw = { high: 0, normal: 1, low: 2 };
  return tasks.slice().sort((a, b) => (pw[a.priority] - pw[b.priority]) || (a.due || "9999").localeCompare(b.due || "9999"));
}
function toggleTask(id) {
  const tasks = store.get("tasks", []);
  const t = tasks.find(x => x.id === id);
  if (!t) throw new Error("unknown task: " + id);
  t.done = !t.done;
  t.doneAt = t.done ? new Date().toISOString() : null;
  store.set("tasks", tasks);
  return t;
}
function deleteTask(id) {
  store.set("tasks", store.get("tasks", []).filter(t => t.id !== id));
}

function addEvent(e) {
  e = e || {};
  if (!(e.title || "").trim()) throw new Error("event needs a title");
  if (!e.date) throw new Error("event needs a date (YYYY-MM-DD)");
  const events = store.get("events", []);
  const ev = { id: uid("ev"), title: e.title.trim(), date: e.date,
               start: e.start || null, end: e.end || null,
               attendees: e.attendees || "", notes: e.notes || "",
               createdAt: new Date().toISOString() };
  events.push(ev);
  store.set("events", events);
  return ev;
}
function listEvents(date) {
  let events = store.get("events", []);
  if (date) events = events.filter(e => e.date === date);
  return events.slice().sort((a, b) => (a.date + (a.start || "")).localeCompare(b.date + (b.start || "")));
}
function deleteEvent(id) {
  store.set("events", store.get("events", []).filter(e => e.id !== id));
}
function upcomingEvents(days) {
  days = days || 7;
  const today = new Date().toISOString().slice(0, 10);
  const end = new Date(Date.now() + days * 864e5).toISOString().slice(0, 10);
  return listEvents().filter(e => e.date >= today && e.date <= end);
}

function toMin(t) { const p = (t || "").split(":"); return (+p[0]) * 60 + (+p[1] || 0); }

// Overlapping timed events on the same day.
function detectConflicts(events) {
  const out = [];
  const byDay = {};
  (events || []).forEach(e => { (byDay[e.date] = byDay[e.date] || []).push(e); });
  Object.keys(byDay).forEach(day => {
    const timed = byDay[day].filter(e => e.start && e.end).sort((a, b) => toMin(a.start) - toMin(b.start));
    for (let i = 0; i < timed.length; i++) for (let j = i + 1; j < timed.length; j++) {
      if (toMin(timed[j].start) < toMin(timed[i].end))
        out.push({ date: day, a: timed[i], b: timed[j] });
    }
  });
  return out;
}

function meetingPrep(ev) {
  if (!ev) throw new Error("meetingPrep needs an event");
  const attendees = (ev.attendees || "").split(",").map(s => s.trim()).filter(Boolean);
  return {
    title: ev.title,
    when: ev.date + (ev.start ? " " + ev.start + (ev.end ? "-" + ev.end : "") : ""),
    attendees,
    agenda: [
      "Confirm the goal of this meeting in one sentence.",
      "Review any open items from last time.",
      "Decide: what must be true for this to be a success?"
    ],
    questions: attendees.length
      ? attendees.map(a => "What does " + a + " need from this meeting?")
      : ["Who should be there, and what does each person need from it?"],
    checklist: ["Notes doc open", "Previous action items reviewed", "One clear ask prepared"],
    notes: ev.notes || ""
  };
}

function weekGrid(anchorDate) {
  const base = anchorDate ? new Date(anchorDate) : new Date();
  const monday = new Date(base);
  monday.setDate(base.getDate() - ((base.getDay() + 6) % 7));
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    days.push({ key, label: d.toLocaleDateString("en-US", { weekday: "short" }), num: d.getDate(), events: listEvents(key) });
  }
  return days;
}

const api = { addTask, listTasks, toggleTask, deleteTask, addEvent, listEvents,
              deleteEvent, upcomingEvents, detectConflicts, meetingPrep, weekGrid };

if (typeof window !== "undefined") window.HearthSchedule = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
