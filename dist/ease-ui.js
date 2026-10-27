// v0.43.0「上手」的界面：
// · 菜单十项、菜单最上面一行的士气、任务手记里的几行：新开的档用得上了才出现；
// · 角上的小卡：第一次见到一样东西、第一次能建一样设施、菜单里第一次多出一格、前三天的早上（不挡路、不停游戏，几秒后收起，点一下也收）；
// · 设置里一行“第一次见到的小卡”能关；
// · 任务手记：v0.42 去掉的生活水准和法令簿那一条不再画（所有的档）。
import { BUILDINGS } from "./data.js";
import { ALERT_HOOKS } from "./winter-ui.js";
import { easeSay } from "./ease.js";
import { cardHtml } from "./simple-ui.js";
import { dropBlock } from "./trim-ui.js";
import { touchWords } from "./zest-ui.js";
import { CARD_MS, GUIDE_DAYS, MENU_FRESH, CAMP_EVENT_GO, DAILY_SAY } from "./ease-data.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const on = (e) => !!e?.ez;
const fresh = (e) => on(e) && e.easeFresh();
const touch = () => !!globalThis.matchMedia?.("(pointer:coarse)")?.matches;
// 拿掉一个按钮：data-action 是这个（data-id 是那个）
function dropButton(html, action, id = null) {
  const re = new RegExp(`<button\\b[^>]*data-action="${action}"${id == null ? "" : `[^>]*data-id="${id}"`}[^>]*>[\\s\\S]*?<\\/button>`, "g");
  return html.replace(re, "");
}

// ================= 顶上的提醒：说错了的几条改过来（所有的档） =================
// 和删繁那一层一样包一层；包过的记一下（删繁那一层的记号也照抄，免得两层轮流再包）
function wrapAlerts() {
  for (let i = 0; i < ALERT_HOOKS.length; i++) {
    const h = ALERT_HOOKS[i];
    if (h.ezWrapped) continue;
    const w = (e, add) => h(e, e?.ez ? (pri, text, ...rest) => add(pri, easeSay(text), ...rest) : add);
    w.ezWrapped = true;
    w.trWrapped = !!h.trWrapped;
    ALERT_HOOKS[i] = w;
  }
}
wrapAlerts();

// ================= 菜单十项 =================
// 菜单里每一格对应的按钮（和 simple-data.js 的 MENUS 一样）
const MENU_BUTTON = {
  craft: ['data-menu="craft"'],
  build: ['data-menu="build"'],
  map: ['data-menu="map"'],
  people: ['data-action="sView"', 'data-id="people"'],
  collection: ['data-action="wView"', 'data-id="collection"'],
  messages: ['data-action="sxOpen"', 'data-id="messages"'],
  skills: ['data-menu="skills"'],
};
export function easeMenus(e, html) {
  if (!fresh(e) || typeof html !== "string") return html;
  let out = html;
  for (const [id, attrs] of Object.entries(MENU_BUTTON)) {
    if (e.easeMenuVisible(id)) continue;
    const re = new RegExp(`<button ${attrs.join(" ")}>[\\s\\S]*?<\\/button>`, "g");
    out = out.replace(re, "");
  }
  // 格子下面那行小字：新开的档没有“这一版退回的东西”
  for (const [was, now] of Object.values(MENU_FRESH)) out = out.split(">" + was + "<").join(">" + now + "<");
  // 顺手的：拍照要先有相机（卡住走不动了那一格一直在）
  if (!(e.qty?.("camera") > 0)) out = dropButton(out, "fPhoto");
  return out;
}
// 有没有防线可看：建了围栏一类的东西，或者灰隼团、尸潮要来过
function guardUsable(e) {
  const s = e.s;
  return s.buildings.some((b) => ["fence", "gate", "trap", "tower", "lure", "repairpost"].includes(b.type)) || ["scheduled", "warning", "active"].includes(e.raidState?.()?.phase) || (s.stats?.hordes || 0) > 0;
}
// 按住 Tab 的轮盘：和菜单一样，用不上的先不放（制作、建造、任务手记一直在）
const RADIAL_GATE = {
  map: (e) => e.easeMenuVisible("map"),
  skills: (e) => e.easeMenuVisible("skills"),
  log: (e) => e.easeMenuVisible("messages"),
  defense: (e) => guardUsable(e),
  photo: (e) => e.qty?.("camera") > 0,
};
export function easeRadial(e, items) {
  if (!fresh(e) || !Array.isArray(items)) return items;
  return items.filter((it) => !RADIAL_GATE[it.id] || RADIAL_GATE[it.id](e));
}
// 顶栏：士气营地里有人以后才出现
export function easeHud(e, hud) {
  wrapAlerts();
  if (!on(e) || !hud || e.easeMoraleVisible()) return hud;
  return { ...hud, morale: null };
}

// ================= 任务手记 =================
// 营地的小事：列在“收到的消息”里（原来只能从商人那一页的“信任与故事”进去），点“去处理”打开它
function campEventLine(e, html) {
  const ev = e.easeCampEvent?.();
  if (!ev) return html;
  const line = `<p>${esc(ev.title)} <button data-action="openMessages" data-id="">${CAMP_EVENT_GO}</button></p>`;
  const head = /<summary>收到的消息 · (\d+)件<\/summary>/;
  if (head.test(html)) return html.replace(head, (m, n) => `<summary>收到的消息 · ${Number(n) + 1}件</summary>${line}`);
  const box = `<details class="journal-extra"><summary>收到的消息 · 1件</summary>${line}</details>`;
  const at = html.indexOf('<details class="journal-extra');
  if (at >= 0) return html.slice(0, at) + box + html.slice(at);
  const end = html.lastIndexOf("</div>");
  return end >= 0 ? html.slice(0, end) + box + html.slice(end) : html + box;
}
export function easeJournal(e, html) {
  if (!on(e) || typeof html !== "string") return html;
  // v0.42 去掉了生活水准和法令簿：那一条不再画
  let out = campEventLine(e, dropBlock(html, "winter-strip"));
  if (!fresh(e)) return out;
  const s = e.s;
  // 选别的委托：主线第一段做完以后再出现
  if (!e.sc?.claimed?.includes("act1")) out = dropButton(out, "gCatalog");
  // 重建站那一行：建得起或者建好了、已经碰到过旧物残页隧道余烬核，或者过了前三天
  const rl = e.rl || {};
  const started = (rl.old?.length || 0) + (rl.pages?.length || 0) + (rl.cores?.length || 0) + (rl.tunnel?.deepest || 0) > 0;
  const station = s.buildings.some((b) => b.type === "rlStation") || (BUILDINGS.rlStation && e.afford?.(BUILDINGS.rlStation.cost || {})) || started || s.day > GUIDE_DAYS;
  if (!station) out = dropBlock(out, "rl-strip");
  // 前哨状况下面的几个按钮：出货账本（卖过东西以后）、消息记录（有消息以后）、查看防线（建了防线或者有人要来以后）
  if (!(e.o?.ledger?.length > 0)) out = dropButton(out, "oView", "ledger");
  if (!e.easeMenuVisible("messages")) out = dropButton(out, "oView", "log");
  if (!guardUsable(e)) out = dropButton(out, "oDefense");
  // 主线卡上的“查看地图”：地图用得上以后
  if (!e.easeMenuVisible("map")) out = dropButton(out, "aOpen");
  // 别的地方（地区和边境的事务页）：修通或者去过一个地区以后
  const away = Object.values(e.d?.unlocked || {}).some(Boolean) || Object.values(e.b?.unlocked || {}).some(Boolean) || Object.keys(s.visited || {}).some((r) => r !== "farm");
  if (!away) out = out.replace(/<details class="journal-extra">\s*<summary>别的地方<\/summary>[\s\S]*?<\/details>/, "");
  // 按钮都拿掉了的那一排不留空框
  return out.replace(/<div class="outpost-links"><\/div>/g, "");
}

// ================= 每日抉择的卡、结果、记录 =================
export function easeView(e, ui, html) {
  if (!on(e) || typeof html !== "string" || !["daily", "dlog"].includes(ui?.view)) return html;
  let out = html;
  for (const [re, to] of DAILY_SAY) out = out.replace(re, to);
  return out;
}

// ================= 设置 =================
export function easeSettings(e) {
  if (!fresh(e)) return "";
  const z = e.ez;
  return `<details class="settings-section" open><summary>上手</summary><div class="settings-row"><div>第一次见到的小卡<small>第一次走近一样东西、第一次能建一样设施时，屏幕角上停一张它的说明卡，几秒后收起</small></div><button data-action="eCards" data-id="" aria-pressed="${z.cards}">${z.cards ? "已开启" : "已关闭"}</button></div></details>`;
}

// ================= 角上的小卡 =================
let shown = null,
  until = 0,
  last = 0,
  lastLook = 0,
  lastTick = 0,
  engineRef = null;
export function easeCardHtml(c) {
  if (!c) return "";
  const w = (v) => (touch() ? touchWords(v || "") : v || "");
  return `<small class="ease-tag">${esc(c.tag || "")}</small>${cardHtml({ key: c.key, name: c.name, does: w(c.does), good: w(c.good), now: w(c.now) })}<button class="ease-close" data-action="eCardClose" data-id="" aria-label="收起">×</button>`;
}
// 每一帧调一回（game.js 的主循环）：看一眼走近了什么、每秒看一眼新出现的；小卡一张一张停，菜单开着时先收起来、计时也停
const cardEl = (doc) => doc?.querySelector?.("#ease-card") || null;
const hasClass = (el, c) => (el?.classList?.contains ? el.classList.contains(c) : (" " + (el?.className || "") + " ").includes(" " + c + " "));
export function easeFrame(e, doc = globalThis.document, now = globalThis.performance?.now?.() ?? Date.now()) {
  if (!doc?.querySelector) return null;
  const el = cardEl(doc);
  // 标题页上不看（后面那张图是存档的样子，还没开始玩）
  if (hasClass(doc.body, "title-screen")) {
    if (el) el.hidden = true;
    return null;
  }
  if (e !== engineRef) {
    engineRef = e;
    shown = null;
    until = 0;
    lastLook = lastTick = 0;
    if (el) el.hidden = true;
  }
  const dt = last ? Math.min(250, Math.max(0, now - last)) : 0;
  last = now;
  const cls = doc.documentElement?.classList;
  cls?.toggle?.("ease-nomap", fresh(e) && !e.easeMenuVisible("map"));
  if (!fresh(e) || !el) {
    cls?.toggle?.("ease-showing", false);
    if (el) el.hidden = true;
    return null;
  }
  if (e.paused) {
    // 菜单开着：先收起来，回到场景再接着停完
    if (shown) until += dt;
    el.hidden = true;
    cls?.toggle?.("ease-showing", false);
    return shown;
  }
  if (now - lastLook >= 250) {
    lastLook = now;
    e.easeLook();
  }
  if (now - lastTick >= 1000) {
    lastTick = now;
    e.easeTick();
  }
  if (shown && now >= until) shown = null;
  if (!shown) {
    const next = e.easeNextCard();
    if (next) {
      shown = next;
      until = now + CARD_MS;
      el.innerHTML = easeCardHtml(next);
    }
  }
  el.hidden = !shown;
  cls?.toggle?.("ease-showing", !!shown);
  return shown;
}
export function easeCardNow() {
  return shown;
}

// ================= 动作 =================
const ACTIONS = ["eCards", "eCardClose"];
export function handleEaseAction(action, el, ctx = {}) {
  if (!ACTIONS.includes(action)) return false;
  const e = ctx.engine;
  if (action === "eCardClose") {
    until = 0;
    shown = null;
    const doc = ctx.doc || globalThis.document,
      card = cardEl(doc);
    if (card) card.hidden = true;
    doc?.documentElement?.classList?.toggle?.("ease-showing", false);
    return true;
  }
  if (!on(e)) return true;
  if (action === "eCards") {
    e.easeCards(!e.ez.cards);
    if (!e.ez.cards) {
      until = 0;
      shown = null;
    }
    ctx.renderMenu?.();
    return true;
  }
  return true;
}
