# Redesign Audit — hearth-ai v2 (2026-10-19)

Supersedes the 2026-10-13 audit. The v1 pass (dark ember-ink icon sidebar, terracotta accent,
sharp zero-radius geometry, icon nav, chat restyle, morning-briefing hero) holds and stays —
this pass evolves the same identity rather than replacing it, and closes the functional gaps
that keep Hearth from feeling shippable next to real health apps.

## Competitors studied

1. **Apple Health (iPhone)** — Summary tab built from pinned Favorites cards; **Highlights**
   section showing health trends over time with **trend arrows** on every metric; drill-down
   per metric with Day/Week/Month granularity; a dedicated **Medications** section with drug
   detail cards, interaction facts, and a chronological daily schedule.
2. **Oura (app)** — **Today tab**: one screen that opens with the single most important
   score/insight of the day; three 0–100 core scores (Readiness / Sleep / Activity) each with
   **contributor breakdowns** (what moved the score and why); calm color scheme, score-first
   typography; **My Health tab** with strengths, important trends, and opportunity areas.
3. **Google Fit** — **Two goal rings** at the top of Home (Heart Points / Move Minutes, now
   Steps too); rings visibly morph when a goal is met; **Journal** timeline of activities with
   tap-to-detail breakdowns; **Browse** tab for every measurement; a **+ FAB** for one-tap
   logging; per-metric graphs with **Day / Week / Month** granularity.

## Patterns worth borrowing (health-dashboard language)

1. **Today-first hero (Oura Today tab).** Health apps never open on a blank form. The Health
   view must open on a "Today's pulse": today's goal progress at a glance, then logging
   forms, then trends. *Implemented:* new pulse card atop the Health view.
2. **Goal rings (Google Fit).** Circular daily-goal gauges are the lingua franca of health
   apps — goals feel tangible when they fill. *Implemented:* SVG rings for sleep / steps /
   water / mood against their daily goals, filling as you log.
3. **Trend arrows (Apple Health Highlights).** Averages alone don't answer "am I getting
   better?" — every metric gets a directional arrow (last 7 days vs prior 7) like Apple's
   Highlights. *Implemented:* `health.trendArrow(type)` + arrows in each chart header.
4. **Drill-down granularity (Google Fit Day/Week/Month).** Fixed 14-day charts flatten
   both recent dips and long arcs. *Implemented:* 7 / 14 / 30-day period toggle on the
   Trends card.
5. **Medication schedule timeline (Apple Health Medications).** Apple shows the day's meds
   as a chronological schedule with a "next dose" emphasis. Our rows were grouped by drug,
   unordered. *Implemented:* "Today's doses" re-rendered as a time-ordered timeline with
   per-dose status (taken / due now / in Xh / missed) and a next-dose banner.
6. **Lead with one insight (Oura).** The morning briefing was a flat card stack; Oura's
   Today tab opens with the one thing that matters. *Implemented:* briefing opens with a
   dark hero — greeting + full date + the lead insight (top priority nudge / med alert /
   all-clear) + stat chips (events, tasks due, pills taken, sleep).

## Functional gaps closed (v2)

| # | Gap vs competitors | Fix |
|---|--------------------|-----|
| G1 | No at-a-glance daily health status — forms and 14-day bars, but nothing answers "how am I doing today" (Oura Today, Fit rings) | `dailyPulse()`: today's value vs goal per metric, rendered as goal rings |
| G2 | Trends locked to a fixed 14-day window (Google Fit has Day/Week/Month) | 7/14/30-day period toggle on the Trends card |
| G3 | Trends show only averages — no direction (Apple Highlights trend arrows) | `trendArrow()`: last-7 vs prior-7 comparison per metric, arrow glyph in each chart header |
| G4 | Medications: doses grouped by drug, no chronological schedule, no "next dose" (Apple Health schedule) | Time-ordered dose timeline with countdown to next dose; missed/taken/due states |
| G5 | Briefing was a flat stack of cards (Oura leads with one insight) | Hero banner with lead insight + stat chips; Morning / Weekly-review tabs |
| B1 | **Bug:** `proactive.morningBriefing(now)` ignored the injected `now` when computing med status — `meds.dayStatus()` used the real wall clock, making e2e flow 16 time-of-day-flaky | `dayStatus(today, currentHHMM)` derived from `now` — deterministic |

## Visual identity: "Hearth glow" (evolved, not replaced)

The v1 "Home OS" foundation stays: dark ember-ink sidebar with icon nav, light warm content
canvas, terracotta accent, zero border-radius everywhere, tabular numerals, no gradients,
no emoji chrome. v2 layers on top of it:

- **Briefing hero:** a dark ember-ink banner panel (echoing the sidebar) with a large
  greeting, the lead insight in warm cream text, and stat chips — the page's one visual
  "moment", distinct from the card stack below.
- **Goal rings:** true-circle SVG gauges (circles are data, exempt from the no-rounded rule)
  in terracotta / sage / wheat — a deliberate material contrast against the sharp-edged
  cards, exactly how Google Fit's rings sit inside its square cards.
- **Timeline:** a left-rule timeline with diamond (45°-rotated square) markers for med
  doses — sharp, unmistakable, no rounded dots.
- **Typography:** kickers (11px, letterspaced, uppercase) label each section; large
  tabular-figure numerals carry the "premium" feel instead of decoration.
- **Restraint:** health metrics in sage, meds in terracotta, schedule in wheat/amber —
  functional color only, never decorative gradients.

## Preserved (hard)

Everything from the 2026-10-19 consolidation: `js/meds.js` — per-profile namespaced
localStorage, dose check-off with pill-count decrement, refill math (days left, order-by
date, lead time, threshold alerts), 7-day adherence %, streaks, missed-dose flags,
due-soon reminders, PRN meds with daily caps, "not medical advice" disclaimer; Medications
sidebar view; morning-briefing Medications section; chat answering "did I take my pills?"
and variants. All other modules (chat, meals, health, schedule, comms, sheets, research,
briefing), multi-profile, planner-mode notices, Apple Health import, pantry/budget, workout
log, sleep-debt, sleep-mood insight. No localStorage key or schema renamed — no migration
needed.

## Deliberately not done

- No "readiness score" composite (would need HRV/RHR sensors Hearth doesn't have; honest
  goal rings + arrows instead of a fake score).
- Per-metric drill-down pages (Fit's tap-to-detail) — the period toggle + arrows cover the
  honest 80%; full drill-downs are a hosted upgrade.
- Meds drug-facts / interaction data — would need a licensed drug database (paid); the
  notes field stays the free equivalent.
