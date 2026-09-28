// Hearth AI — research: template-based structured brief generator.
// Note: live web research is a future hosted upgrade; the brief is drafted locally from the topic.
(function () {
"use strict";

const D = (typeof require !== "undefined") ? require("./data.js") : window.HearthData;
const store = (typeof require !== "undefined") ? require("./store.js") : window.HearthStore;

function uid(p) { return (p || "id") + "-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

function generateBrief(opts) {
  opts = opts || {};
  const topic = (opts.topic || "").trim();
  if (!topic) throw new Error("brief needs a topic");
  const depth = D.RESEARCH_DEPTHS.some(d => d.id === opts.depth) ? opts.depth : "standard";
  const audience = (opts.audience || "").trim() || "personal decision-making";

  const sections = [
    { heading: "Background",
      bullets: ["What " + topic + " is and why it matters for " + audience + ".",
                "Key terms and how they are usually defined.",
                "How this topic has changed recently."] },
    { heading: "Options",
      bullets: ["Option A: the most common approach to " + topic + ".",
                "Option B: a lower-cost or simpler alternative.",
                "Option C: the premium / do-it-for-me route."] },
    { heading: "Comparison",
      bullets: ["Cost ranges for each option.",
                "Time and effort required.",
                "Risks or downsides to watch for."] }
  ];
  if (depth === "deep") {
    sections.push({ heading: "Risks & mitigations",
      bullets: ["What could go wrong with each option.", "How to de-risk the preferred option."] });
    sections.push({ heading: "Costs",
      bullets: ["Upfront costs vs ongoing costs.", "Hidden fees or gotchas to verify."] });
    sections.push({ heading: "Timeline",
      bullets: ["Realistic timeline from decision to done.", "What can be parallelized."] });
  }
  sections.push({ heading: "Recommendation",
    bullets: ["The option that best fits " + audience + ", and why.",
              "The single most important factor in this decision."] });
  sections.push({ heading: "Sources to check",
    bullets: ["2-3 recent expert reviews or guides on " + topic + ".",
              "Community discussions (forums, owner groups) for real-world experience.",
              "Official documentation or spec sheets where applicable."] });

  const brief = {
    id: uid("brief"), topic, depth, audience,
    summary: "A " + depth + " research brief on " + topic + ", prepared for " + audience +
             ". Covers background, options, comparison and a recommendation — verify key facts against primary sources before deciding.",
    sections,
    nextSteps: ["Skim the background and options.", "Check the listed source types for current pricing and reviews.",
                "Decide using the recommendation as a starting point, not a verdict."],
    disclaimer: "Drafted locally from a template — Hearth does not browse the web in this version. Treat specifics as starting points and verify against current sources.",
    createdAt: new Date().toISOString()
  };
  const briefs = store.get("briefs", []);
  briefs.unshift(brief);
  store.set("briefs", briefs);
  return brief;
}
function listBriefs() { return store.get("briefs", []); }
function getBrief(id) { return listBriefs().find(b => b.id === id) || null; }
function deleteBrief(id) {
  store.set("briefs", store.get("briefs", []).filter(b => b.id !== id));
}

const api = { generateBrief, listBriefs, getBrief, deleteBrief };

if (typeof window !== "undefined") window.HearthResearch = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
