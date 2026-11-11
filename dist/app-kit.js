// v0.50 新界面的零件：小工具、线条图标、把物品小图 / 头像 / 建筑图画到小画布上、界面放大多少。
import { ITEMS, BUILDINGS } from "./data.js";
import { ATLAS_RECTS } from "./atlas.js";
import { FRONTIER_RECTS } from "./frontier-data.js";
import { gearIconSheet, gearIconIndex } from "./gear-sprites.js";
import { personSprite, lookFor, PLAYER_LOOK } from "./pixel-sprites.js";
import { buildingArt } from "./pixel-props.js";

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
export const fmt = (n) => Math.floor(n).toLocaleString("zh-CN");
export const hhmm = (m) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(Math.floor(m % 60)).padStart(2, "0");
export const itemName = (id) => ITEMS[id]?.name || id;

// 1366×768 → 1；1920×1080 → 1.25；最多 2 倍。按 0.05 取整。
export function uiZoom(w, h) {
  const z = 0.9 * Math.min((w || 1366) / 1366, (h || 768) / 768);
  return Math.max(1, Math.min(2, Math.round(z * 20) / 20));
}

// ---------- 线条图标（自己画的，24×24） ----------
const P = {
  food: '<path d="M12 21V8"/><path d="M12 8c0-3 2-5 2-5s-4 0-4 3"/><path d="M12 13c-3 0-5-2-5-2M12 13c3 0 5-2 5-2M12 18c-3 0-5-2-5-2M12 18c3 0 5-2 5-2"/>',
  mat: '<path d="M3 8l9-5 9 5v8l-9 5-9-5z"/><path d="M3 8l9 5 9-5M12 13v8"/>',
  power: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  gold: '<circle cx="12" cy="12" r="9"/><path d="M9 9h6v6H9z"/>',
  people: '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c0-4 3-6 7-6s7 2 7 6"/>',
  morale: '<path d="M12 3c1 4 5 5 5 10a5 5 0 01-10 0c0-2 1-3 2-4 0 2 1 3 2 3 0-3-1-5 1-9z"/>',
  build: '<path d="M5 19l8-8"/><path d="M12 4l8 8-2.5 2.5-8-8z"/>',
  team: '<circle cx="9" cy="8" r="3"/><path d="M3 19c0-3.5 2.5-5 6-5s6 1.5 6 5"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14c2.5 0 4 1.2 4 4"/>',
  store: '<path d="M4 8h16v11H4z"/><path d="M2 5h20v3H2z"/><path d="M10 12h4"/>',
  map: '<path d="M3 6l6-2 6 2 6-2v14l-6 2-6-2-6 2z"/><path d="M9 4v14M15 6v14"/>',
  journal: '<path d="M5 4h11a3 3 0 013 3v13H8a3 3 0 01-3-3z"/><path d="M9 9h6M9 13h6"/>',
  alert: '<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17v.5"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>',
  go: '<path d="M9 6l6 6-6 6"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4L7 17M17 7l1.4-1.4"/>',
  rain: '<path d="M7 15a4 4 0 010-8 5 5 0 019.6 1A3.5 3.5 0 0117 15z"/><path d="M8 18v2M12 18v3M16 18v2"/>',
  moon: '<path d="M20 14A8 8 0 019 4a8 8 0 1011 10z"/>',
  gear: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  bowl: '<path d="M4 11h16a8 8 0 01-16 0zM9 4c0 2 2 2 2 4M14 4c0 2 2 2 2 4"/>',
};
const FILLED = {
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 017-2 4 4 0 017 2c0 5.5-7 10-7 10z"/>',
  bolt: '<path d="M13 2L5 14h6l-1 8 8-12h-6z"/>',
  pause: '<rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/>',
  play: '<path d="M7 4l13 8-13 8z"/>',
  fast: '<path d="M4 5l8 7-8 7zM13 5l8 7-8 7z"/>',
};
export function svg(name, size = 22, color = "currentColor", sw = 2) {
  if (FILLED[name]) return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="${color}">${FILLED[name]}</svg>`;
  return `<svg aria-hidden="true" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${P[name] || P.info}</svg>`;
}

// ---------- 小画布：物品、头像、建筑 ----------
export const itemIcon = (id, size = 44) => `<canvas class="ic" data-item="${esc(id)}" width="${size}" height="${size}" style="width:${size}px;height:${size}px"></canvas>`;
export const portrait = (key, role = "", size = 48) => `<canvas class="pt" data-person="${esc(key)}" data-role="${esc(role)}" width="${size}" height="${size}" style="width:${size}px;height:${size}px" role="img" aria-label="头像"></canvas>`;
export const buildArt = (type, w = 168, h = 60) => `<canvas class="ba" data-build="${esc(type)}" width="${w}" height="${h}" style="width:${w}px;height:${h}px"></canvas>`;

let sheets = null;
export function setSheets(s) {
  sheets = s;
}
function drawFit(c, src, sx, sy, sw, sh, W, H, pad = 0) {
  const k = Math.min((W - pad * 2) / sw, (H - pad * 2) / sh),
    // 像素画放大取整数倍，放不下才缩
    scale = k >= 1 ? Math.max(1, Math.floor(k)) : k,
    dw = sw * scale,
    dh = sh * scale;
  c.imageSmoothingEnabled = false;
  c.drawImage(src, sx, sy, sw, sh, Math.round((W - dw) / 2), Math.round((H - dh) / 2), dw, dh);
}
function paintItem(el) {
  const id = el.dataset.item,
    it = id === "build" ? { icon: BUILDINGS.fence?.icon ?? 40 } : ITEMS[id],
    c = el.getContext("2d"),
    W = el.width,
    H = el.height;
  c.clearRect(0, 0, W, H);
  if (!it) return;
  if (typeof it.icon === "string" && it.icon[0] === "g") {
    const sh = gearIconSheet(),
      i = gearIconIndex(it.icon);
    if (sh?.canvas && i >= 0) drawFit(c, sh.canvas, (i % sh.cols) * sh.cell, Math.floor(i / sh.cols) * sh.cell, sh.cell, sh.cell, W, H, 1);
    return;
  }
  if (!sheets) return;
  if (it.frontierIcon != null && FRONTIER_RECTS[it.frontierIcon] && sheets.frontier) {
    const r = FRONTIER_RECTS[it.frontierIcon];
    drawFit(c, sheets.frontier, r[0], r[1], r[2], r[3], W, H, 2);
    return;
  }
  if (it.atlas != null && ATLAS_RECTS[it.atlas] && sheets.expansion) {
    const r = ATLAS_RECTS[it.atlas];
    drawFit(c, sheets.expansion, r[0], r[1], r[2], r[3], W, H, 2);
    return;
  }
  const sp = sheets.sprites;
  if (!sp) return;
  const cell = sp.width / 8,
    i = Number(it.icon) || 0;
  c.imageSmoothingEnabled = false;
  c.drawImage(sp, (i % 8) * cell, Math.floor(i / 8) * cell, cell, cell, 0, 0, W, H);
}
function paintPerson(el) {
  const key = el.dataset.person,
    role = el.dataset.role || null,
    c = el.getContext("2d"),
    W = el.width,
    H = el.height;
  c.clearRect(0, 0, W, H);
  let sp = null;
  try {
    sp = key === "player" ? personSprite(PLAYER_LOOK, "player", "down", 0, "stand") : personSprite(lookFor(key, role), (role || "p") + ":" + key, "down", 0, "stand");
  } catch {
    sp = null;
  }
  if (!sp) return;
  // 只取头和肩膀：上面 17 行
  const sw = sp.width,
    shh = Math.min(17, sp.height),
    scale = Math.max(1, Math.floor(Math.min(W / sw, H / shh)));
  c.imageSmoothingEnabled = false;
  c.fillStyle = "#2a3138";
  c.fillRect(0, 0, W, H);
  c.drawImage(sp, 0, 0, sw, shh, Math.round((W - sw * scale) / 2), H - shh * scale, sw * scale, shh * scale);
}
function paintBuild(el) {
  const type = el.dataset.build,
    c = el.getContext("2d"),
    W = el.width,
    H = el.height;
  c.clearRect(0, 0, W, H);
  let art = null;
  try {
    art = buildingArt(type, false, false);
  } catch {
    art = null;
  }
  const src = art?.canvas || art?.img || art;
  if (src && src.width) {
    drawFit(c, src, 0, 0, src.width, src.height, W, H, 3);
    return;
  }
  // 没有单独的图：用它的小图
  const b = BUILDINGS[type];
  if (!b) return;
  const tmp = document.createElement("canvas");
  tmp.width = tmp.height = 44;
  tmp.dataset.item = "__b";
  const save = ITEMS.__b;
  ITEMS.__b = { icon: b.icon, frontierIcon: b.frontierIcon, atlas: b.atlas };
  paintItem(tmp);
  if (save) ITEMS.__b = save;
  else delete ITEMS.__b;
  c.imageSmoothingEnabled = false;
  c.drawImage(tmp, Math.round((W - 44) / 2), Math.round((H - 44) / 2));
}
export function paint(root = document) {
  for (const el of root.querySelectorAll("canvas.ic")) paintItem(el);
  for (const el of root.querySelectorAll("canvas.pt")) paintPerson(el);
  for (const el of root.querySelectorAll("canvas.ba")) paintBuild(el);
}

// ---------- 花费：够不够直接标在那一格上 ----------
export function costTags(e, cost) {
  return Object.entries(cost || {})
    .map(([id, n]) => {
      const have = e.quantityForCost ? e.quantityForCost(id) : e.qty(id, true);
      return have >= n ? `<span class="tag">${esc(itemName(id))} ${n}</span>` : `<span class="tag bad">${esc(itemName(id))} ${have}/${n}</span>`;
    })
    .join("");
}
export const tabsHtml = (tabs, on, act = "tab") =>
  `<div class="tabs" role="tablist">${tabs
    .map((t) => `<button class="tab${t.id === on ? " on" : ""}" role="tab" aria-selected="${t.id === on}" data-act="${act}" data-id="${esc(t.id)}" ${t.locked ? "disabled" : ""}>${t.locked ? svg("lock", 16) : ""}${esc(t.name)}${t.note ? `<span class="small"> · ${esc(t.note)}</span>` : ""}</button>`)
    .join("")}</div>`;
export const escBtn = () => `<button class="esc" data-act="close"><kbd>Esc</kbd>返回</button>`;
