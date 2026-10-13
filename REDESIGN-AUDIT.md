# Redesign Audit — hearth-ai (2026-10-13)

**Competitors studied:** Notion (sidebar app: icon nav, clean cards, command palette), Linear (dark sidebar, sharp geometry, dense premium UI), Cozi (family organizer dashboard), ChatGPT (chat UX: quick prompts, message bubbles).

## Visual gaps
1. **Rounded corners everywhere** — 12px cards, 9–10px buttons/inputs, 999px pills/chips, circular nav dots. Directly violates Alex's no-rounded-edges rule. → sharp geometry pass across the whole app.
2. **Sidebar is flat light.** Linear-grade hubs use a dark sidebar for hierarchy and premium feel. Ours is white-on-white with the content. → dark warm-ink sidebar, light content canvas.
3. **Nav has no icons.** Notion/Linear navs are icon+label. Ours is text with a dot. → per-section SVG icons.
4. **Chat looks like a form.** ChatGPT-grade chat: quick-prompt chips, distinct user/assistant bubbles, generous spacing. → restyle chat within sharp geometry.
5. **Briefing is a card stack.** → morning-briefing hero with date + sections.

## Functional / flow gaps
1. **No visual section identity.** → icons + distinct empty states (skip empty states; icons suffice).
2. **View subtitles exist** — keep. Add keyboard-accessible nav (buttons already).

## Decisions
- Keep: all 8 modules (chat, meals, health, schedule, comms, sheets, research, briefing), multi-profile, planner-mode notices, proactive nudges, Apple Health import, pantry/budget.
- Identity: "home OS" — dark warm-ink sidebar, terracotta accent, sharp Linear-grade geometry, light warm content canvas.
- Scope note: CSS + nav icons + chat/briefing polish only; module internals preserved.
