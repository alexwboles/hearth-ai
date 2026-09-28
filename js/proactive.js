// Hearth AI — proactive: morning briefing, conflict surfacing, weekly review.
(function () {
"use strict";

const schedule = (typeof require !== "undefined") ? require("./schedule.js") : window.HearthSchedule;
const health = (typeof require !== "undefined") ? require("./health.js") : window.HearthHealth;
const store = (typeof require !== "undefined") ? require("./store.js") : window.HearthStore;

function greetingFor(hour) {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

function morningBriefing(now) {
  now = now || new Date();
  const profile = store.activeProfile();
  const today = now.toISOString().slice(0, 10);
  const events = schedule.listEvents(today);
  const tasks = schedule.listTasks("today");
  const openTasks = schedule.listTasks("open");
  const conflicts = schedule.detectConflicts(schedule.upcomingEvents(1));
  const sleep = health.getLogs("sleep", 1);
  const nudges = health.nudges({ busyTomorrow: schedule.listEvents(new Date(Date.now() + 864e5).toISOString().slice(0, 10)).length > 2 });
  const carts = (typeof require !== "undefined" ? require("./meals.js") : window.HearthMeals).listCarts();
  const draftCart = carts.find(c => c.status === "draft");

  const sections = [];
  if (events.length)
    sections.push({ title: "Today's schedule", lines: events.map(e => (e.start ? e.start + " " : "") + e.title + (e.attendees ? " — with " + e.attendees : "")) });
  else
    sections.push({ title: "Today's schedule", lines: ["Nothing on the calendar — a clear day."] });

  if (tasks.length)
    sections.push({ title: "Due tasks", lines: tasks.map(t => t.title + " (" + t.priority + ")") });
  else if (openTasks.length)
    sections.push({ title: "Due tasks", lines: ["Nothing due today. " + openTasks.length + " open task(s) in the backlog."] });
  else
    sections.push({ title: "Due tasks", lines: ["Inbox zero. Nice."] });

  if (conflicts.length)
    sections.push({ title: "Watch out", lines: conflicts.map(c => "Overlap on " + c.date + ": \"" + c.a.title + "\" clashes with \"" + c.b.title + "\"") });

  if (sleep.length)
    sections.push({ title: "Last night", lines: ["You logged " + sleep[sleep.length - 1].value + "h of sleep."] });

  const topNudges = nudges.slice(0, 3);
  if (topNudges.length)
    sections.push({ title: "Heads up", lines: topNudges.map(n => n.title + ": " + n.detail) });

  if (draftCart)
    sections.push({ title: "Groceries", lines: ["A draft cart (\"" + draftCart.label + "\", " + draftCart.items.length + " items) is waiting for your approval."] });

  return {
    greeting: greetingFor(now.getHours()) + ", " + (profile ? profile.name : "there") + ".",
    date: today,
    sections
  };
}

function weeklyReview() {
  const tasks = store.get("tasks", []);
  const done = tasks.filter(t => t.done && t.doneAt && t.doneAt >= new Date(Date.now() - 7 * 864e5).toISOString());
  const open = tasks.filter(t => !t.done);
  const overdue = open.filter(t => t.due && t.due.slice(0, 10) < new Date().toISOString().slice(0, 10));
  const avgs = health.weeklyAverages();
  return {
    completed: done.length, open: open.length, overdue: overdue.length,
    health: avgs,
    note: done.length >= open.length ? "Strong week — more finished than left open."
      : overdue.length ? overdue.length + " task(s) overdue. Consider re-scheduling or dropping them."
      : "Steady progress. Keep the momentum."
  };
}

const api = { morningBriefing, weeklyReview, greetingFor };

if (typeof window !== "undefined") window.HearthProactive = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
