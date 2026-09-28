// Hearth AI — sheets: editable grid model with CSV import/export.
(function () {
"use strict";

const store = (typeof require !== "undefined") ? require("./store.js") : window.HearthStore;

function uid(p) { return (p || "id") + "-" + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }

function blankGrid(rows, cols) {
  const g = [];
  for (let r = 0; r < rows; r++) { const row = []; for (let c = 0; c < cols; c++) row.push(""); g.push(row); }
  return g;
}

function createSheet(name, rows, cols) {
  rows = Math.max(1, Math.min(200, rows || 10));
  cols = Math.max(1, Math.min(26, cols || 5));
  const sheets = store.get("sheets", []);
  const sheet = { id: uid("sheet"), name: (name || "").trim() || "Untitled sheet",
                  grid: blankGrid(rows, cols), updatedAt: new Date().toISOString() };
  sheets.push(sheet);
  store.set("sheets", sheets);
  return sheet;
}
function listSheets() {
  return store.get("sheets", []).map(s => ({ id: s.id, name: s.name, rows: s.grid.length, cols: s.grid[0] ? s.grid[0].length : 0, updatedAt: s.updatedAt }));
}
function getSheet(id) {
  const s = store.get("sheets", []).find(x => x.id === id);
  if (!s) throw new Error("unknown sheet: " + id);
  return s;
}
function saveSheet(sheet) {
  const sheets = store.get("sheets", []).map(s => (s.id === sheet.id ? sheet : s));
  sheet.updatedAt = new Date().toISOString();
  store.set("sheets", sheets);
  return sheet;
}
function deleteSheet(id) {
  store.set("sheets", store.get("sheets", []).filter(s => s.id !== id));
}
function renameSheet(id, name) {
  const s = getSheet(id);
  s.name = (name || "").trim() || s.name;
  return saveSheet(s);
}
function setCell(id, r, c, value) {
  const s = getSheet(id);
  if (!s.grid[r] || c < 0 || c >= s.grid[r].length) throw new Error("cell out of range");
  s.grid[r][c] = value == null ? "" : String(value);
  return saveSheet(s);
}
function addRow(id) { const s = getSheet(id); s.grid.push(s.grid[0].map(() => "")); return saveSheet(s); }
function addCol(id) { const s = getSheet(id); s.grid.forEach(row => row.push("")); return saveSheet(s); }

function csvCell(v) {
  v = v == null ? "" : String(v);
  return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v;
}
function csvExport(id) {
  const s = getSheet(id);
  return s.grid.map(row => row.map(csvCell).join(",")).join("\n");
}

// Minimal RFC-4180 parse: quoted fields, escaped quotes, embedded newlines.
function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else inQ = false;
      } else field += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ",") { row.push(field); field = ""; }
    else if (ch === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (ch === "\r") { /* skip */ }
    else field += ch;
  }
  row.push(field); rows.push(row);
  while (rows.length && rows[rows.length - 1].every(c => c === "")) rows.pop();
  return rows;
}

function csvImport(text, name) {
  if (typeof text !== "string" || !text.trim()) throw new Error("empty CSV");
  const rows = parseCSV(text);
  if (!rows.length) throw new Error("no rows parsed");
  const width = Math.max.apply(null, rows.map(r => r.length));
  const grid = rows.map(r => { while (r.length < width) r.push(""); return r; });
  const sheets = store.get("sheets", []);
  const sheet = { id: uid("sheet"), name: (name || "Imported sheet").trim(),
                  grid, updatedAt: new Date().toISOString() };
  sheets.push(sheet);
  store.set("sheets", sheets);
  return sheet;
}

const api = { createSheet, listSheets, getSheet, saveSheet, deleteSheet, renameSheet,
              setCell, addRow, addCol, csvExport, csvImport, parseCSV };

if (typeof window !== "undefined") window.HearthSheets = api;
if (typeof module !== "undefined" && module.exports) module.exports = api;
})();
