// Hearth AI — per-profile namespaced persistence (localStorage, in-memory fallback for node).
(function () {
"use strict";

const PREFIX = "hearth:";

const mem = {};
const backend = (typeof localStorage !== "undefined") ? {
  get: k => { try { return localStorage.getItem(PREFIX + k); } catch (e) { return null; } },
  set: (k, v) => { try { localStorage.setItem(PREFIX + k, v); } catch (e) {} },
  del: k => { try { localStorage.removeItem(PREFIX + k); } catch (e) {} },
  keys: () => { try { const out = []; for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.indexOf(PREFIX) === 0) out.push(k.slice(PREFIX.length)); } return out; } catch (e) { return []; } }
} : {
  get: k => (k in mem ? mem[k] : null),
  set: (k, v) => { mem[k] = v; },
  del: k => { delete mem[k]; },
  keys: () => Object.keys(mem)
};

function read(key, fallback) {
  const raw = backend.get(key);
  if (raw == null) return fallback;
  try { return JSON.parse(raw); } catch (e) { return fallback; }
}
function write(key, val) { backend.set(key, JSON.stringify(val)); }

function listProfiles() { return read("profiles", []); }

function createProfile(name) {
  name = (name || "").trim() || "New profile";
  const profiles = listProfiles();
  const id = "p" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36);
  const p = { id, name, createdAt: new Date().toISOString() };
  profiles.push(p);
  write("profiles", profiles);
  if (!read("activeProfile", null)) write("activeProfile", id);
  return p;
}

function activeProfileId() {
  const profiles = listProfiles();
  let id = read("activeProfile", null);
  if (!id || !profiles.some(p => p.id === id)) {
    if (!profiles.length) {
      const p = createProfile("Home");
      return p.id;
    }
    id = profiles[0].id;
    write("activeProfile", id);
  }
  return id;
}

function activeProfile() {
  const id = activeProfileId();
  return listProfiles().find(p => p.id === id) || null;
}

function switchProfile(id) {
  if (!listProfiles().some(p => p.id === id)) throw new Error("unknown profile: " + id);
  write("activeProfile", id);
  return activeProfile();
}

function renameProfile(id, name) {
  const profiles = listProfiles();
  const p = profiles.find(x => x.id === id);
  if (!p) throw new Error("unknown profile: " + id);
  p.name = (name || "").trim() || p.name;
  write("profiles", profiles);
  return p;
}

function deleteProfile(id) {
  const profiles = listProfiles().filter(p => p.id !== id);
  write("profiles", profiles);
  backend.keys().filter(k => k.indexOf("profile:" + id + ":") === 0).forEach(k => backend.del(k));
  if (read("activeProfile", null) === id) write("activeProfile", profiles.length ? profiles[0].id : null);
  return profiles;
}

// Per-profile data access: every module key is namespaced under the active profile.
function ns(key) { return "profile:" + activeProfileId() + ":" + key; }
function get(key, fallback) { return read(ns(key), fallback); }
function set(key, value) { write(ns(key), value); }
function del(key) { backend.del(ns(key)); }

function exportProfile(id) {
  const out = { profile: listProfiles().find(p => p.id === id), data: {} };
  backend.keys().forEach(k => {
    if (k.indexOf("profile:" + id + ":") === 0) out.data[k.slice(("profile:" + id + ":").length)] = read(k, null);
  });
  return out;
}

function resetForTests() {
  backend.keys().slice().forEach(k => backend.del(k));
}

const api = { listProfiles, createProfile, activeProfileId, activeProfile, switchProfile,
              renameProfile, deleteProfile, get, set, del, exportProfile, resetForTests };

if (typeof window !== "undefined") window.HearthStore = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
