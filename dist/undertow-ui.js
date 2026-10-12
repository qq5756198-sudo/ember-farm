// v0.24.0「暗涌」的界面：屏幕上方的头目血条（不弹窗）、世界地图上的“动静”和头目标记、
// 任务手记里“废墟里的动静”一栏、顶上的提醒、档案馆的第六个展柜（头目战利品）、成就册里的头目记录。
// 不加新面板：都放在原来的页面里。
import { ITEMS, REGIONS } from "./data.js";
import { ATLAS_POINTS } from "./wayfinding.js";
import { ALERT_HOOKS } from "./winter-ui.js";
import { PREVIEW_HOOKS } from "./daily-ui.js";
import { consequence } from "./alliance-ui.js";
import { RUIN_EVENTS, BOSSES, TROPHY_IDS, EVENT_SPOTS } from "./undertow-data.js";

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const regionName = (id) => REGIONS[id]?.name || id;

// ---------- 头目血条 ----------
export function bossBarHtml(e) {
  const b = e?.bossBar?.();
  if (!b) return "";
  const pct = Math.max(0, Math.min(100, Math.round((b.hp / Math.max(1, b.max)) * 100)));
  return `<div class="boss-name"><b>${esc(b.name)}</b>${b.tag ? `<small>${esc(b.tag)}</small>` : ""}</div><div class="boss-hp" role="progressbar" aria-label="${esc(b.name)}的血" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div>${b.note ? `<small class="boss-note">${esc(b.note)}</small>` : ""}`;
}

// ---------- 世界地图 ----------
export function patchUnderMap(e, ui, html) {
  if (ui?.tab === "local" || !e?.ruinNews) return html;
  const news = e.ruinNews();
  if (!news.length) return html;
  const pins = [],
    used = {};
  for (const n of news) {
    const pt = ATLAS_POINTS[n.region];
    if (!pt) continue;
    const k = (used[n.region] = (used[n.region] || 0) + 1) + 1,
      tone = n.kind === "boss" ? (n.when === "today" ? "danger" : "night") : n.kind === "cache" ? "hazard" : "night",
      text = n.kind === "boss" ? n.text : n.kind === "cache" ? "对讲机说的箱子" : n.text.length > 14 ? "今天这里有动静" : n.text;
    pins.push(`<span class="far-pin u-pin ${tone}" style="left:${((pt[0] + 70) / 10).toFixed(1)}%;top:${((pt[1] - 14 + k * 26) / 7).toFixed(1)}%">${esc(text)}</span>`);
  }
  const at = html.indexOf("</svg>");
  return at < 0 ? html : html.slice(0, at + 6) + pins.join("") + html.slice(at + 6);
}

// ---------- 任务手记：废墟里的动静 ----------
export function underStrip(e) {
  if (!e?.ruinNews) return "";
  const news = e.ruinNews();
  const rows = [];
  for (const n of news) {
    if (n.kind === "event")
      rows.push(`<div class="far-row"><p><b>今天</b>${esc(regionName(n.region))}${e.r?.radio ? "：" + esc(RUIN_EVENTS[e.ut.ev.id].hint) : "好像有动静"}</p>${e.r?.radio ? "" : "<small>修好电台以后，每天早上 7 点会播今天哪里有什么动静。</small>"}</div>`);
    if (n.kind === "boss") {
      const B = BOSSES[n.boss];
      rows.push(`<div class="far-row ${n.when === "today" ? "danger" : ""}"><p><b>${n.when === "today" ? "今天" : "明天"}</b>${esc(regionName(n.region))}有${esc(B.name)}${n.when === "today" ? "（只待今天）" : ""}</p>${n.when === "today" ? button("uMark", "boss:" + n.boss, "标出位置") : ""}</div>`);
    }
    if (n.kind === "cache") rows.push(`<div class="far-row"><p><b>今天</b>${esc(regionName(n.region))}有对讲机说的箱子</p>${button("uMark", "cache", "标出位置")}</div>`);
  }
  const rec = e.bossRecord?.().filter((r) => r.wins > 0) || [];
  if (rec.length) rows.push(`<div class="far-row muted"><p><b>头目</b>${rec.map((r) => esc(r.name) + " 打赢 " + r.wins + " 次").join(" · ")}</p></div>`);
  if (!rows.length) return "";
  return `<section class="far-strip u-strip" aria-label="废墟里的动静">${rows.join("")}</section>`;
}
export function patchUnderJournal(e, html) {
  const strip = underStrip(e);
  if (!strip) return html;
  for (const mark of ['<section class="far-strip"', '<section class="journal-today"']) {
    const at = html.indexOf(mark);
    if (at >= 0) {
      const end = html.indexOf("</section>", at) + "</section>".length;
      return html.slice(0, end) + strip + html.slice(end);
    }
  }
  const at = html.indexOf("</header>");
  return at > 0 ? html.slice(0, at + 9) + strip + html.slice(at + 9) : html;
}

// ---------- 档案馆：头目战利品展柜 ----------
export function trophyCaseHtml(e) {
  const T = e?.trophyCase?.();
  if (!T) return "";
  const here = !!e.museumHere?.(),
    items = T.donated.map((id) => `<span class="exhibit">${esc(ITEMS[id]?.name || id)}</span>`).join(""),
    can = T.can.map((id) => button("uDonate", id, "捐：" + (ITEMS[id]?.name || id), here ? "" : "disabled")).join("");
  return `<article class="${T.done ? "done" : ""} u-trophies"><small>${T.donated.length}/${T.need}</small><h3>${esc(T.name)}</h3><p class="exhibits">${items || "<span class='muted'>还空着：打赢大块头、护士长、仓库守卫各一次就有</span>"}</p>${consequence({ cost: "不花（捐战利品）", gain: "填满：" + T.reward, effect: T.done ? "加成已生效" : "每样只捐一次" })}${can ? `<div class="button-row">${can}</div>` : ""}</article>`;
}
export function patchMuseum(e, html) {
  const card = trophyCaseHtml(e);
  if (!card) return html;
  const tail = '</div><div class="button-row">';
  const at = html.lastIndexOf(tail);
  return at > 0 ? html.slice(0, at) + card + html.slice(at) : html + card;
}
// 成就册：展柜进度 + 头目
export function patchUnderCollection(e, html) {
  const T = e?.trophyCase?.();
  if (!T) return html;
  const rec = e.bossRecord(),
    li = `<li class="${T.done ? "done" : ""}"><b>${esc(T.name)}</b><span class="bar"><i style="width:${Math.min(100, (T.donated.length / T.need) * 100)}%"></i></span><span>${T.donated.length}/${T.need}</span><small>${T.done ? "✓ " : ""}${esc(T.reward)}</small></li>`,
    wins = rec.filter((r) => r.wins > 0).length,
    li2 = `<li class="${wins >= rec.length ? "done" : ""}"><b>头目</b><span class="bar"><i style="width:${Math.round((wins / rec.length) * 100)}%"></i></span><span>${wins}/${rec.length}</span><small>${rec.map((r) => esc(r.name) + (r.wins ? " ✓ " + r.wins + " 次（第一次在第 " + r.first + " 天）" : " 还没打赢")).join(" · ")}</small></li>`;
  const at = html.indexOf("</ul>");
  return at > 0 ? html.slice(0, at) + li + li2 + html.slice(at) : html;
}

// ---------- 顶上的提醒 ----------
ALERT_HOOKS.push((e, add) => {
  if (!e?.ruinNews) return;
  for (const n of e.ruinNews()) {
    if (n.kind === "boss" && n.when === "today") {
      const B = BOSSES[n.boss];
      add(3, B.name + "今天在" + regionName(n.region), "warn", { region: n.region, x: B.lair.x, y: B.lair.y, label: B.name });
    }
    if (n.kind === "cache") {
      const c = e.ut.cache,
        s = EVENT_SPOTS[c.region][c.spot] || EVENT_SPOTS[c.region][0];
      add(4, "对讲机说的箱子 · " + regionName(c.region), "gold", { region: c.region, x: s.x + 50, y: s.y + 30, label: "对讲机说的箱子" });
    }
  }
});

// ---------- 每日抉择卡上新动作的说明 ----------
PREVIEW_HOOKS.push((e, op) => {
  if (op[0] === "uIntel") return op[1] === "nurse" ? "记下护士长的习惯（打她时，血条上数着下一声尖叫）" : "记下大块头的习惯（车门那条线早一点亮）";
  if (op[0] === "uMask") return "今天在绿雾里少掉一半血";
  return "";
});

// ---------- 动作 ----------
const ACTIONS = ["uDonate", "uMark"];
export function handleUnderAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, showMenu, renderMenu, save, toast, rebuildUI } = ctx,
    id = el.dataset.id || "";
  if (!e?.ut) return true;
  if (action === "uDonate") {
    e.donateTrophy(id);
    renderMenu();
    save();
    return true;
  }
  if (action === "uMark") {
    let target = null;
    if (id.startsWith("boss:")) {
      const B = BOSSES[id.slice(5)];
      if (B?.lair) target = { region: B.region, x: B.lair.x, y: B.lair.y, label: B.name };
    } else if (id === "cache" && e.ut.cache) {
      const c = e.ut.cache,
        s = EVENT_SPOTS[c.region][c.spot] || EVENT_SPOTS[c.region][0];
      target = { region: c.region, x: s.x + 50, y: s.y + 30, label: "对讲机说的箱子" };
    }
    if (!target) {
      toast("今天没有要标的地方。");
      return true;
    }
    if (e.guidance) {
      e.guidance.focus = null;
      e.guidance.target = { ...target };
    }
    if (e.d) e.d.track = null;
    if (e.b) e.b.track = null;
    if (rebuildUI) rebuildUI.target = { ...target };
    if (e.s.region === target.region) toast("金色路标：" + target.label + "。");
    else showMenu("map", { selected: target.region });
    return true;
  }
  return true;
}
export const TROPHY_LIST = TROPHY_IDS;
