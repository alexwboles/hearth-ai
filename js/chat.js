// Hearth AI — chat: rule-based assistant. Parses intents, routes to modules, proposes actions.
(function () {
"use strict";

const D = (typeof require !== "undefined") ? require("./data.js") : window.HearthData;
const store = (typeof require !== "undefined") ? require("./store.js") : window.HearthStore;
const meals = (typeof require !== "undefined") ? require("./meals.js") : window.HearthMeals;
const health = (typeof require !== "undefined") ? require("./health.js") : window.HearthHealth;
const schedule = (typeof require !== "undefined") ? require("./schedule.js") : window.HearthSchedule;
const comms = (typeof require !== "undefined") ? require("./comms.js") : window.HearthComms;
const research = (typeof require !== "undefined") ? require("./research.js") : window.HearthResearch;
const proactive = (typeof require !== "undefined") ? require("./proactive.js") : window.HearthProactive;

function parseIntent(text) {
  const t = (text || "").toLowerCase().trim();
  const has = (...words) => words.some(w => t.indexOf(w) !== -1);

  if (has("meal plan", "plan my meals", "plan meals", "weekly menu", "what should i eat", "meal prep"))
    return { intent: "plan_meals" };
  if (has("grocery", "shopping list", "groceries"))
    return { intent: "groceries" };
  if (has("recipe", "cook", "dinner idea", "lunch idea", "breakfast idea"))
    return { intent: "recipes", query: t };
  // Health logging: match the metric word + a logging cue, so "log 8000 steps" works.
  if (has("sleep") && (has("log") || has("slept")))
    return { intent: "log_sleep", value: firstNumber(t) };
  if (has("step") && (has("log") || has("walk")))
    return { intent: "log_steps", value: firstNumber(t) };
  if (has("water") && (has("log") || has("glass") || has("drank")))
    return { intent: "log_water", value: firstNumber(t) };
  if (has("mood") && (has("log") || has("feeling")))
    return { intent: "log_mood", value: firstNumber(t) };
  if ((has("weight") || has("weigh")) && has("log"))
    return { intent: "log_weight", value: firstNumber(t) };
  if (has("health", "how am i doing", "my trends", "my stats"))
    return { intent: "health_summary" };
  if (has("briefing", "morning briefing", "my day", "what's today", "whats today", "today's plan"))
    return { intent: "briefing" };
  if (has("add task", "new task", "remind me to", "todo", "to-do", "to do"))
    return { intent: "add_task", title: extractAfter(t, ["add task", "new task", "remind me to"]) };
  if (has("schedule", "meeting", "calendar", "appointment", "add event"))
    return { intent: "schedule" };
  if (has("draft email", "write email", "email reply", "reply to"))
    return { intent: "draft_email" };
  if (has("call script", "phone call", "calling"))
    return { intent: "call_script" };
  if (has("research", "look into", "compare"))
    return { intent: "research", topic: extractAfter(t, ["research", "look into", "compare"]) };
  if (has("spreadsheet", "sheet", "csv"))
    return { intent: "sheets" };
  if (has("nudge", "predict", "heads up", "running low"))
    return { intent: "nudges" };
  if (has("help", "what can you do", "commands"))
    return { intent: "help" };
  if (has("hello", "hi", "hey", "good morning", "good evening"))
    return { intent: "greet" };
  if (has("thank"))
    return { intent: "thanks" };
  return { intent: "unknown" };
}

function firstNumber(t) {
  const m = t.match(/(\d+(\.\d+)?)/);
  return m ? parseFloat(m[1]) : null;
}
function extractAfter(t, phrases) {
  for (const p of phrases) {
    const i = t.indexOf(p);
    if (i !== -1) { const rest = t.slice(i + p.length).trim().replace(/^(to|:|-)\s*/, ""); if (rest) return rest; }
  }
  return "";
}

function respond(text) {
  const parsed = parseIntent(text);
  const profile = store.activeProfile();
  const name = profile ? profile.name : "there";
  const R = (reply, actions, view) => ({ reply, actions: actions || [], view: view || null });

  switch (parsed.intent) {
    case "greet":
      return R("Hello " + name + ". What shall we sort out — meals, health, schedule, or something to draft?",
        [{ label: "Morning briefing", run: "briefing" }, { label: "Plan my meals", run: "plan_meals" }]);
    case "thanks":
      return R("Anytime. I'm here whenever you need a plan, a draft, or a nudge.");
    case "help":
      return R("I can: plan your week's meals and build the grocery list; log health and spot trends; manage tasks and your calendar; draft emails and call scripts (you approve everything — I never send); keep simple spreadsheets; write research briefs; and give you a morning briefing with predictive nudges. Try \"plan my meals this week\" or \"log 7 hours of sleep\".");
    case "plan_meals": {
      const prefs = meals.getPrefs();
      const plan = meals.generatePlan({ diet: prefs.diet, servings: prefs.servings, startOffset: Math.floor(Math.random() * 7) });
      meals.savePlan(plan);
      const list = meals.groceryFromPlan(plan);
      const days = plan.plan.map(d => d.day + ": " + ["breakfast", "lunch", "dinner"].map(s => meals.recipeById(d.meals[s]).name).join(" / ")).join("\n");
      return R("Here's a " + plan.days + "-day plan (" + (prefs.diet === "none" ? "no diet restriction" : prefs.diet) + ", " + plan.servings + " servings):\n\n" + days +
        "\n\nThat rolls up to " + list.length + " grocery items. Want me to prep the cart?",
        [{ label: "Prep grocery cart", run: "prep_cart" }, { label: "Regenerate", run: "plan_meals" }], "meals");
    }
    case "groceries": {
      const plan = meals.getPlan();
      if (!plan) return R("No meal plan yet — generate one first and I'll build the grocery list from it.", [{ label: "Plan my meals", run: "plan_meals" }], "meals");
      const list = meals.groceryFromPlan(plan);
      return R("Your grocery list has " + list.length + " items aggregated from the current meal plan. Review it in Meals, then prep the cart for approval.",
        [{ label: "Prep grocery cart", run: "prep_cart" }], "meals");
    }
    case "recipes": {
      const q = parsed.query.replace(/recipe|cook|idea|dinner|lunch|breakfast/g, "").trim();
      const hits = meals.recipesForDiet("none").filter(r =>
        !q || r.name.toLowerCase().indexOf(q) !== -1 || r.ingredients.some(i => i.name.toLowerCase().indexOf(q) !== -1));
      const top = hits.slice(0, 5);
      return R(top.length ? "Ideas for you:\n\n" + top.map(r => r.name + " (" + r.timeMin + " min, " + r.tags.join(", ") + ")").join("\n")
                         : "Nothing matched \"" + q + "\" — try an ingredient like chickpea or salmon.",
        [], "meals");
    }
    case "log_sleep": case "log_steps": case "log_water": case "log_mood": case "log_weight": {
      const type = parsed.intent.replace("log_", "");
      if (parsed.value == null) return R("How much? Tell me like \"log 7 hours of sleep\" or \"log 8000 steps\".");
      try {
        health.logEntry(type, parsed.value);
        const unit = (D.HEALTH_TYPES.find(x => x.id === type) || {}).unit || "";
        return R("Logged: " + parsed.value + " " + unit + " for " + type + " today.", [], "health");
      } catch (e) { return R("Couldn't log that: " + e.message); }
    }
    case "health_summary": {
      const avgs = health.weeklyAverages();
      const lines = Object.keys(avgs).map(k => {
        const a = avgs[k];
        return a ? k + ": " + a.avg + " " + a.unit + " avg (goal " + (a.goal || "steady") + ")" : k + ": no data yet";
      });
      const n = health.nudges();
      return R("Your week at a glance:\n\n" + lines.join("\n") +
        (n.length ? "\n\nWorth knowing: " + n[0].title + " — " + n[0].detail : ""), [], "health");
    }
    case "briefing": {
      const b = proactive.morningBriefing();
      const body = b.sections.map(s => s.title + "\n" + s.lines.map(l => "- " + l).join("\n")).join("\n\n");
      return R(b.greeting + "\n\n" + body, [], "briefing");
    }
    case "add_task": {
      if (!parsed.title) return R("What should I add? Say \"add task: buy milk\" or \"remind me to call the dentist\".");
      const t = schedule.addTask({ title: parsed.title });
      return R("Added to your tasks: \"" + t.title + "\".", [], "schedule");
    }
    case "schedule":
      return R("I can add events, spot overlaps, and write meeting prep notes. Open Schedule to manage the calendar, or tell me \"add event: dentist tomorrow 2pm\" — I'll do my best with the date you give me.", [], "schedule");
    case "draft_email": {
      const d = comms.draftEmail({ templateId: "meeting-followup", fields: { name: "[name]", summary: "[what was discussed]", next1: "[next step]", next2: "[next step]" } });
      return R("Drafted a \"" + d.templateName + "\" email in Comms — fill in the bracketed bits, pick a tone, then approve it when it's ready. Remember: I draft, you send.",
        [], "comms");
    }
    case "call_script": {
      const s = comms.callScript({ scenarioId: "appointment-booking", fields: { purpose: "[purpose]", availability: "[your availability]" } });
      return R("Prepared a \"" + s.scenarioName + "\" call script in Comms with an opening, details, confirm and close. Fill in the bracketed bits before you dial.", [], "comms");
    }
    case "research": {
      if (!parsed.topic) return R("What should I research? Say \"research: best robot vacuum under $300\".");
      const b = research.generateBrief({ topic: parsed.topic, depth: "standard" });
      return R("Brief on \"" + b.topic + "\" is ready in Research: " + b.sections.length + " sections plus next steps. Note: I draft from a template here — verify specifics against current sources.",
        [], "research");
    }
    case "sheets":
      return R("Sheets gives you an editable grid with CSV import/export — handy for budgets, lists, or tracking. Open it from the sidebar.", [], "sheets");
    case "nudges": {
      const n = health.nudges();
      return R(n.length ? "Here's what I'm seeing:\n\n" + n.map(x => x.title + ": " + x.detail).join("\n\n")
                        : "All quiet — nothing needs your attention right now.", [], "briefing");
    }
    default:
      return R("I didn't quite catch that. I can plan meals, log health, manage tasks and calendar, draft emails and call scripts, keep spreadsheets, research topics, or give you a briefing. What would help most right now?");
  }
}

// Follow-up action chips rendered under a reply.
function runAction(action) {
  if (action === "briefing") return respond("morning briefing");
  if (action === "plan_meals") return respond("plan my meals this week");
  if (action === "prep_cart") {
    const plan = meals.getPlan();
    if (!plan) return respond("plan my meals this week");
    const list = meals.groceryFromPlan(plan);
    const cart = meals.prepCart(list, "Chat-generated groceries");
    return { reply: "Cart prepped: " + cart.items.length + " items, grouped by aisle, waiting in Meals. Review and approve it there — I never order anything myself.",
             actions: [], view: "meals" };
  }
  return respond(action);
}

function saveExchange(user, assistant) {
  const log = store.get("chatLog", []);
  log.push({ user, assistant: assistant.reply, at: new Date().toISOString() });
  if (log.length > 100) log.splice(0, log.length - 100);
  store.set("chatLog", log);
}
function getLog() { return store.get("chatLog", []); }

const api = { parseIntent, respond, runAction, saveExchange, getLog };

if (typeof window !== "undefined") window.HearthChat = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
