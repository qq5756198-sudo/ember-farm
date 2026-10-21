// v0.39.0「一物一用」的界面：说明卡、菜单十项、顶栏数字的卡、各样东西只留一件事的那一页。
// 说明卡：名字 · 做什么（一句话）· 好处（带数）· 现在怎样 · 一个按钮（自己干活的东西没有按钮）。
// 各页“只留一件事”：页面照原来画，画完以后把挂在这样东西身上的别的功能（去别处的链接、别的系统的按钮）拿掉（sxAfterRender）。
import { BUILDINGS, ITEMS } from "./data.js";
import { DISTRICTS } from "./district-data.js";
import { BMAPS } from "./beyond-data.js";
import { BCARD, BUILD_GROUPS, MENUS, HUD_CARD, PAGE_CARD, REBUILD_CARD, DISTRICT_CARD, WORDING } from "./simple-data.js";
import { MEND_TEXT } from "./mend-data.js";

const escH = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- 说明卡 ----------
// card({ key, name, does, good, now, icon, button: { action, id, label, disabled, why, cls }, extra })
export function cardHtml(c = {}) {
  const b = c.button;
  const btn = b
    ? `<div class="sx-act"><button class="${escH(b.cls || "primary")}" data-action="${escH(b.action)}"${b.id != null ? ` data-id="${escH(b.id)}"` : ""}${b.disabled ? " disabled" : ""}>${escH(b.label)}</button>${b.disabled && b.why ? `<small>${escH(b.why)}</small>` : ""}</div>`
    : "";
  return `<div class="sx-card${b ? "" : " sx-plain"}${c.icon ? " sx-with-icon" : ""}" data-sx-card="${escH(c.key || "")}">${c.icon ? `<span class="sx-icon">${c.icon}</span>` : ""}<h3>${escH(c.name)}</h3><p class="sx-does">${escH(c.does)}</p>${c.good ? `<p class="sx-good"><b>好处</b>${escH(c.good)}</p>` : ""}${c.now ? `<p class="sx-now"><b>现在</b>${escH(c.now)}</p>` : ""}${btn}${c.extra || ""}</div>`;
}

// ---------- 设施的说明卡（按交互打开、建造页里点开都是这一张）----------
export function buildingCardHtml(e, b, { confirm = false, icon = "" } = {}) {
  const d = BUILDINGS[b.type];
  if (!d) return "";
  const [does, good] = BCARD[b.type] || [d.desc || d.name, ""];
  const low = b.hp < d.hp * 0.7;
  const now = [`耐久 ${Math.max(0, Math.ceil(b.hp))} / ${d.hp}`];
  if (b.type === "gate") now.push(b.open ? "开着" : "关着");
  if (b.hp <= 0) now.push("坏了，不干活");
  else if (low) now.push("受损了");
  const repairCost = (e.level?.("manufacturing") ?? 0) >= 3 ? "木材 1" : "木材 2、废金属 1";
  let button = null;
  if (confirm) button = { action: "dismantle", id: b.id, label: "拆掉它（退一半材料）", cls: "danger" };
  else if (low) button = { action: "repair", id: b.id, label: "修好它（" + repairCost + "）" };
  return cardHtml({ key: "b:" + b.type, name: d.name, does, good, now: now.join(" · "), icon, button });
}

// ---------- 建造页：分四组 ----------
export function buildGroups(ids) {
  const left = new Set(ids),
    out = [];
  for (const [key, title, list] of BUILD_GROUPS) {
    const mine = list.filter((id) => left.has(id));
    mine.forEach((id) => left.delete(id));
    if (mine.length) out.push({ key, title, ids: mine });
  }
  if (left.size) out.push({ key: "other", title: "其他", ids: [...left] });
  return out;
}

// ---------- 菜单十项 ----------
export function menusHtml(e) {
  const tiles = MENUS.map(([name, line, open]) => {
    const attrs = open.menu ? `data-menu="${open.menu}"` : `data-action="${open.action}" data-id="${open.id}"`;
    return `<button ${attrs}><b>${escH(name)}</b><small>${escH(line)}</small></button>`;
  });
  const quick = [];
  const cam = !!e.qty?.("camera");
  quick.push(`<button data-action="fPhoto"${cam ? "" : ' disabled title="先组装相机"'}><b>拍照</b><small>${cam ? "把眼前的画面存下来" : "先组装相机"}</small></button>`);
  // 卡住走不动了：和 v0.38 快捷菜单里那一格一样（按不了时写一句短的为什么）
  if (e.unstuckReason) {
    const why = e.unstuckReason(),
      key = why ? Object.keys(MEND_TEXT.why).find((k) => MEND_TEXT.why[k] === why) : "",
      note = key ? MEND_TEXT.short[key] || "" : "";
    quick.push(`<button class="phone-tile" data-action="mendUnstuck"${why ? ' disabled title="' + escH(why) + '"' : ""}><span aria-hidden="true">⇱</span>${escH(MEND_TEXT.tile)}${note ? "<small>" + escH(note) + "</small>" : ""}</button>`);
  }
  return `<div class="sx-menus">${tiles.join("")}</div>${quick.length ? `<h3 class="sx-sub">顺手的</h3><div class="sx-menus">${quick.join("")}</div>` : ""}`;
}

// ---------- 顶栏的数：点开的卡 ----------
const HUD_BUTTON = {
  date: { action: "sView", id: "calendar", label: "看日历" },
  daily: { action: "dView", id: "dlog", label: "看抉择" },
  cold: { action: "wView", id: "winter", label: "看寒潮" },
};
export function hudCardHtml(e, key, now) {
  const c = HUD_CARD[key];
  if (!c) return "";
  const [name, what, how] = c;
  const b = HUD_BUTTON[key];
  return `<button class="sx-close" data-sx-close aria-label="关上">×</button><h3>${escH(name)}</h3><p>${escH(what)}</p><p>${escH(how)}</p>${now ? `<p class="muted">现在：${escH(now)}</p>` : ""}${b ? `<div class="button-row"><button class="primary" data-action="${b.action}" data-id="${b.id}">${escH(b.label)}</button></div>` : ""}`;
}

// ---------- 从一段 HTML 里取出一整块（按标签配对）----------
export function pickBlocks(html, startRe, tag) {
  const out = [];
  const open = new RegExp("<" + tag + "\\b", "g"),
    close = "</" + tag + ">";
  let m;
  const re = new RegExp(startRe.source, "g");
  while ((m = re.exec(html))) {
    let depth = 0,
      i = m.index;
    open.lastIndex = i;
    for (;;) {
      open.lastIndex = i;
      const o = open.exec(html);
      const c = html.indexOf(close, i);
      if (c < 0) {
        i = html.length;
        break;
      }
      if (o && o.index < c) {
        depth++;
        i = o.index + 1;
      } else {
        depth--;
        i = c + close.length;
        if (depth <= 0) break;
      }
    }
    out.push(html.slice(m.index, i));
    re.lastIndex = i;
  }
  return out;
}

// ---------- 联盟终端：只读来信 ----------
export function lettersHtml(e, journalHtml) {
  const main = pickBlocks(journalHtml, /<article class="journal-main[^"]*story-card/, "article");
  const letters = pickBlocks(journalHtml, /<details class="[^"]*(story-letters|hp-letters|rl-reviews|rl-pages)[^"]*"/, "details");
  const intro = cardHtml({ key: "sign", name: "联盟终端", does: "读联盟的来信：主线下一步写在信里", good: "", now: e.s?.storyCampaign?.unread ? "有新来信" : "" });
  const body = (main[0] || "") + letters.join("");
  return intro + (body || `<p class="muted">还没有来信。</p>`);
}

// ---------- 消息：发生过的事 ----------
export const MESSAGE_VIEWS = [
  ["log", "消息记录"],
  ["raid", "上次战报"],
  ["lnight", "长夜战报"],
  ["nightlog", "夜里的事"],
  ["dlog", "抉择记录"],
  ["ledger", "出货账本"],
];
export function messagesHtml(e, render, journalHtml = "") {
  const parts = [];
  MESSAGE_VIEWS.forEach(([id, title], i) => {
    let html = "";
    try {
      html = render(id) || "";
    } catch {
      html = "";
    }
    if (!html || /没有内容。/.test(html)) return;
    parts.push(`<details class="sx-msg"${i === 0 ? " open" : ""}><summary>${escH(title)}</summary>${html}</details>`);
  });
  const got = pickBlocks(journalHtml, /<details class="journal-extra"/, "details").filter((h) => /收到的消息/.test(h));
  return (got.join("") + parts.join("")) || `<p class="muted">还没有消息。</p>`;
}

// ---------- 入口：修通路 ----------
export function gateHtml(e, args) {
  const id = args.id,
    beyond = args.kind === "beyond",
    def = beyond ? BMAPS[id] : DISTRICTS[id];
  if (!def) return `<p class="muted">没有这个地方。</p>`;
  const why = beyond ? e.beyondUnlockReason?.(id) || "" : e.districtUnlockReason?.(id) || "";
  const cost = e.bundleText ? e.bundleText(def.cost || {}) : "";
  const here = e.s.region === def.parent;
  return cardHtml({
    key: "gate:" + id,
    name: def.name + "入口",
    does: "修通去" + def.name + "的路；修通以后按交互就能进去",
    good: def.purpose || "",
    now: (why ? why + "。" : "") + (cost ? "要：" + cost : ""),
    button: { action: beyond ? "bUnlock" : "dUnlock", id, label: "修通路", disabled: !!why || !here, why: why || (here ? "" : "要站在入口旁边") },
  });
}

export function sxTitle(e, args) {
  return { letters: "联盟终端 · 来信", messages: "消息", menus: "菜单", gate: "修通路" }[args?.view] || "";
}

// ---------- 画完以后：拿掉挂在这样东西身上的别的功能 ----------
// 键：菜单名，或“菜单:view”
const STRIP = {
  journey: [
    "section.outpost-strip",
    "section.winter-strip",
    "section.seasons-strip",
    "section.garden-strip",
    "section.thief-strip",
    "section.rl-strip",
    ".journal-options",
    "details.journal-extra",
    '[data-action="gTool"]',
    ".outpost-links",
    '[data-action="oView"][data-id="lnight"]',
  ],
  inventory: ['[data-action="skills"]', '[data-action="quests"]'],
  "outpost:shipping": [".g-station"],
  "outpost:gBoard": ['[data-action="gJournal"]', '[data-action="gScare"]', '[data-action="gShow"]', ".bt-water .button-row"],
  "outpost:museum": ['[data-action="wView"][data-id="collection"]'],
  "camp:residents": [".seasons-card", '[data-action="openBuild"]'],
  "rebuild:residents": [".seasons-card", '[data-action="openBuild"]'],
  districts: [".district-nav", ".district-list", '[data-action="dBack"]', ".simple-site-other", '[data-action="gJournal"]', ".feature-purpose", '[data-action="dOptional"]', '[data-action="gFocus"]', ".district-form", '[data-action="dView"]', ".district-caption"],
  beyond: [".b-nav", '[data-action="gJournal"]', '[data-action="gFocus"]', '[data-action="bView"]'],
};
export function stripKey(menu, args = {}) {
  if (menu === "outpost") return "outpost:" + (args.view || "");
  if (menu === "camp" || menu === "rebuild") return menu + ":" + (args.tab || "");
  return menu || "";
}
// 拿掉一样以后，空了的外层（只剩空白的按钮行、链接行）一起拿掉
function emptyBox(el) {
  if (!el || !el.children) return false;
  if (el.children.length) return false;
  return !String(el.textContent || "").trim();
}
export function sxAfterRender(root, key) {
  const list = STRIP[key];
  if (!root || !list || !root.querySelectorAll) return 0;
  let n = 0;
  for (const sel of list) {
    let found;
    try {
      found = [...root.querySelectorAll(sel)];
    } catch {
      continue;
    }
    for (const el of found) {
      let parent = el.parentElement || el.parentNode;
      el.remove?.();
      n++;
      // 往上把空了的那一层也拿掉（不超过页面本身）
      for (let k = 0; k < 3 && parent && parent !== root && emptyBox(parent); k++) {
        const up = parent.parentElement || parent.parentNode;
        parent.remove?.();
        parent = up;
      }
    }
  }
  return n;
}

// ---------- 挪过来的功能：原来挂在别处，现在放在管这件事的那一页 ----------
// 人：麦穗那一格（喂它、叫它做事）、今晚营火边（原来在援建营地上）
// 重建站：联盟援建清单（原来在任务手记里）
// 前哨广场：收获展（原来在菜地告示牌上）
const btn = (action, id, label) => `<button data-action="${action}" data-id="${escH(id)}">${escH(label)}</button>`;
// 一页最上面那张卡（只有名字、做什么、好处）
export function pageCard(table, key) {
  const c = table[key];
  return c ? cardHtml({ key: "page:" + key, name: c[0], does: c[1], good: c[2] }) : "";
}
export function sxViewExtra(e, ui) {
  const v = ui?.view;
  const out = { before: v === "pick" ? "" : pageCard(PAGE_CARD, v), after: "" };
  if (v === "people") {
    const rows = [];
    if (e.dogReady?.()) rows.push(btn("xView", "dog", "麦穗 · 喂它、叫它做事"));
    let talk = "x";
    try {
      talk = typeof e.talkReason === "function" ? e.talkReason() : "x";
    } catch {
      talk = "x";
    }
    if (!talk) rows.push(btn("sView", "talk", "今晚营火边 · 坐过去聊聊"));
    if (rows.length) out.before += `<div class="button-row sx-extra">${rows.join("")}</div>`;
  } else if (v === "rlStation" && e.o) out.after = `<div class="button-row sx-extra">${btn("oView", "bundles", "联盟援建清单")}</div>`;
  else if (v === "plaza" && e.g) out.after = `<div class="button-row sx-extra">${btn("gShow", "exhibition", "收获展")}</div>`;
  // 成就册：伙伴与相册（原来在农舍里）
  else if (v === "collection" && e.f) out.after = `<div class="button-row sx-extra">${btn("rOpen", "frontier:life", "伙伴与相册")}</div>`;
  return out;
}

// 援建营地（派活那一页）、地区仓库：最上面那张卡
export function rebuildCard(tool) {
  return tool?.tab ? pageCard(REBUILD_CARD, tool.tab) : "";
}
export function districtCard(ui) {
  return ui?.detail && !ui?.point ? pageCard(DISTRICT_CARD, ui.view) : "";
}

// 做好的东西自己进仓库以后，“领取”那几句换个说法（页面、提示、底栏的目标都过一遍）
export function sxWords(text) {
  let s = String(text ?? "");
  if (!/领取/.test(s)) return s;
  for (const [re, to] of WORDING) s = s.replace(re, to);
  return s;
}
