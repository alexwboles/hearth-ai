# Hearth — Personal Health & Home Hub

A chat-first personal hub for health and home life. Talk to Hearth and it **plans** — meals, groceries, health trends, schedules, email drafts, call scripts, spreadsheets, research briefs, and a proactive morning briefing.

**Planner model:** Hearth proposes and drafts everything; you approve. It never orders groceries, never sends email, never dials a phone. Real-world actions are explicit future upgrades — the approval step is already the architecture.

## Features

- **Chat (home screen)** — rule-based local assistant: "plan my meals this week", "log 7 hours of sleep", "draft email", "morning briefing". Action chips run follow-ups inline.
- **Profiles** — multiple people, one app. Every byte of data is namespaced per profile in localStorage (the multi-user foundation).
- **Meals & groceries** — 14-recipe bank across diets, 7-day plan generator (no repeats), grocery list auto-aggregated and grouped by store aisle, prep-cart with approve step.
- **Health** — manual logs (sleep, steps, water, mood, weight), **Apple Health `export.xml` import** (steps, sleep, weight parsed locally), hand-rolled SVG trend charts, rule-based predictive nudges ("running low on sleep + busy tomorrow", staple restock predictions).
- **Schedule** — tasks with due dates/priorities, calendar with week grid, overlap conflict detection, meeting prep-note generator.
- **Comms** — email reply drafter (5 templates × 3 tones), phone call script generator (3 scenarios), follow-up queue. Drafts approve; nothing sends.
- **Sheets** — editable grid, add rows/columns, CSV import/export (handles quotes, commas, newlines).
- **Research** — structured brief generator (quick/standard/deep) with honest disclosure that briefs are template-drafted locally.
- **Briefing** — morning briefing combining calendar, due tasks, conflicts, health, grocery carts; weekly review with completion stats.

## Stack

Static web app — HTML, CSS, vanilla JS. Client-side only, `localStorage` persistence, **zero paid services, zero external API calls, zero credentials**. Open `index.html` or serve the folder:

```bash
python3 -m http.server 8080   # then open http://localhost:8080
```

## Tests

```bash
test/smoke.sh   # 13 fast checks: files, syntax, logic spot-checks, design + privacy greps
test/e2e.sh     # 8 realistic flows through the logic layer (node)
```

## Roadmap (hosted upgrades)

- Real grocery ordering via store integrations (planner cart becomes a real cart)
- Email sending + calendar sync via connected accounts (drafts become sendable)
- Voice calling via telephony provider (scripts become calls)
- Live web research (template briefs become sourced briefs)
- Hosted multi-user accounts with sync (profiles become logins)

Built free and local-first. No data leaves the browser.
