// Hearth AI — comms: email drafts, call scripts, follow-up queue. Planner mode: drafts only, nothing is ever sent.
(function () {
"use strict";

const D = (typeof require !== "undefined") ? require("./data.js") : window.HearthData;
const store = (typeof require !== "undefined") ? require("./store.js") : window.HearthStore;

function uid(p) { return (p || "id") + "-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

function fill(template, fields) {
  return template.replace(/\{\{(\w+)\}\}/g, (m, k) =>
    (fields[k] != null && fields[k] !== "") ? fields[k] : "[" + k + "]");
}

function toneAdjust(body, tone) {
  if (tone === "concise") {
    return body.split("\n").filter(l => l.trim() !== "" && !/^best,|^gratefully,/i.test(l.trim()))
      .slice(0, 6).join("\n");
  }
  if (tone === "warm") {
    return body.replace(/^Hi ([^,]+),/m, "Hi $1 — hope you're doing well,")
               .replace(/\n\nBest,/m, "\n\nWarmly,");
  }
  return body;
}

function draftEmail(opts) {
  opts = opts || {};
  const tpl = D.EMAIL_TEMPLATES.find(t => t.id === opts.templateId) || D.EMAIL_TEMPLATES[0];
  const tone = opts.tone || "professional";
  if (!D.TONES.some(t => t.id === tone)) throw new Error("unknown tone: " + tone);
  const fields = Object.assign({ sender: (store.activeProfile() || {}).name || "Me" }, opts.fields);
  const draft = {
    id: uid("email"), templateId: tpl.id, templateName: tpl.name,
    to: opts.to || "", tone,
    subject: fill(tpl.subject, fields),
    body: toneAdjust(fill(tpl.body, fields), tone),
    status: "draft", createdAt: new Date().toISOString()
  };
  const drafts = store.get("emailDrafts", []);
  drafts.unshift(draft);
  store.set("emailDrafts", drafts);
  return draft;
}

function listDrafts() { return store.get("emailDrafts", []); }

function approveDraft(id) {
  // Planner mode: approving marks it ready for the user to send themselves. Nothing is sent by Hearth.
  const drafts = store.get("emailDrafts", []);
  const d = drafts.find(x => x.id === id);
  if (!d) throw new Error("unknown draft: " + id);
  d.status = "approved";
  d.approvedAt = new Date().toISOString();
  store.set("emailDrafts", drafts);
  return d;
}

function deleteDraft(id) {
  store.set("emailDrafts", store.get("emailDrafts", []).filter(d => d.id !== id));
}

function callScript(opts) {
  opts = opts || {};
  const tpl = D.CALL_SCRIPTS.find(s => s.id === opts.scenarioId) || D.CALL_SCRIPTS[0];
  const fields = Object.assign({ sender: (store.activeProfile() || {}).name || "Me" }, opts.fields);
  return {
    id: uid("call"), scenarioId: tpl.id, scenarioName: tpl.name,
    sections: tpl.sections.map(s => ({ heading: s.h, text: fill(s.t, fields) })),
    createdAt: new Date().toISOString()
  };
}

function addFollowUp(f) {
  f = f || {};
  if (!(f.who || "").trim()) throw new Error("follow-up needs a person");
  const items = store.get("followUps", []);
  const item = { id: uid("fu"), who: f.who.trim(), about: f.about || "",
                 channel: f.channel || "email", due: f.due || null,
                 done: false, createdAt: new Date().toISOString() };
  items.push(item);
  store.set("followUps", items);
  return item;
}
function listFollowUps(openOnly) {
  let items = store.get("followUps", []);
  if (openOnly) items = items.filter(i => !i.done);
  return items.slice().sort((a, b) => (a.due || "9999").localeCompare(b.due || "9999"));
}
function toggleFollowUp(id) {
  const items = store.get("followUps", []);
  const it = items.find(x => x.id === id);
  if (!it) throw new Error("unknown follow-up: " + id);
  it.done = !it.done;
  store.set("followUps", items);
  return it;
}
function deleteFollowUp(id) {
  store.set("followUps", store.get("followUps", []).filter(i => i.id !== id));
}

const api = { draftEmail, listDrafts, approveDraft, deleteDraft,
              callScript, addFollowUp, listFollowUps, toggleFollowUp, deleteFollowUp };

if (typeof window !== "undefined") window.HearthComms = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
