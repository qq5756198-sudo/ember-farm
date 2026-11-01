// v0.46.0「有奔头」的界面：
// · 复兴工程那一页（任务手记“眼下”那张、重建站那一页最上面、顶上的提醒都能打开）：这个时节开了哪一处、要多少、修好了给什么；
//   出钱办；正在修的；修好了的；第二期（收复以后）；
// · 任务手记：主线打完以后最上面那张换成“眼下”最值得做的一件，老的家园计划折在下面；复兴工程的来信、孩子们的信；
// · 左下角“当前目标”：主线打完以后跟着“眼下”（game.js 里接）；
// · 世界地图：修好了的地方挂一块小牌子；
// · 顶上的提醒：这个时节开的那一处办得起了。
import { ITEMS, REGIONS } from "./data.js";
import { ALERT_HOOKS, alertItems } from "./winter-ui.js";
import { ATLAS_POINTS } from "./wayfinding.js";
import { addMomentIcons } from "./zest-ui.js";
import { PROJECTS, PROJECT_BY_ID, BATCH1, BATCH2, KID_LETTERS, NOW, PAGE, START } from "./ahead-data.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const act = (a, id, label, reason, primary = false) => button(a, id, label, reason ? `disabled title="${esc(reason)}"` : primary ? 'class="primary"' : "") + (reason ? `<small class="story-lack">${esc(reason)}</small>` : "");
const on = (e) => !!e?.ah && typeof e.ahNow === "function";
const gold = (n) => Number(n || 0).toLocaleString("en-US");
const costText = (cost) =>
  Object.entries(cost || {})
    .map(([k, n]) => (k === "gold" ? gold(n) + " 金币" : (ITEMS[k]?.name || k) + " " + n))
    .join("、");
const placeName = (p) => (p.place === "farm" ? "余烬农场" : REGIONS[p.place]?.name || "");
const ALERT_HEAD = "复兴工程 · ";

addMomentIcons({}, { ahead: ["#203a1c", "#e8f2d8", "#a8d89a"] });

// ================= 复兴工程那一页 =================
function giftLine(p) {
  const bits = [p.who + "来一封信", "留一样摆件「" + p.keep.name + "」"];
  if (p.special) bits.push("三天后送来头一批" + p.special.name + "（以后每个时节头一天再送）");
  return "修好了：" + bits.join("、") + "。";
}
function projectCard(e, p) {
  const why = e.ahReason(p.id);
  return `<article class="rl-list ah-card"><h4>${esc(placeName(p))} · ${esc(p.name)} <small>${esc(costText(p.cost))}</small></h4><p>${esc(p.text)}</p><p class="muted">${esc(giftLine(p))}</p>${act("ahFund", p.id, PAGE.go + "（" + gold(p.cost.gold) + " 金）", why, true)}</article>`;
}
function nextLine(e, batch) {
  const h = e.ah,
    ids = batch === 1 ? BATCH1 : BATCH2;
  const left = ids.filter((id) => !h.opened[id]);
  if (!left.length) return "";
  if (batch === 2 && !e.ln?.ended) return `<p class="muted">${esc(PAGE.wait2)}</p>`;
  const day = e.s.day,
    base = batch === 1 ? START.day : e.ln.endDay;
  const next = day < base ? base : base + (Math.floor((day - base) / 7) + 1) * 7;
  const p = PROJECT_BY_ID[left.find((id) => e.ahReach(PROJECT_BY_ID[id])) || ""];
  const stuck = !p ? "（剩下的那几处，地方修通了才开）" : "";
  return `<p class="muted">${esc(PAGE.next(next, p ? placeName(p) + "的" + p.name : "") + stuck)}</p>`;
}
function doneList(e) {
  const h = e.ah,
    done = PROJECTS.filter((p) => h.done[p.id]);
  if (!done.length) return "";
  const rows = done.map((p) => `<li class="full"><span>${esc(placeName(p))} · ${esc(p.name)} ✓ <small>第 ${h.done[p.id]} 天</small></span><small>${esc(p.text)}</small></li>`).join("");
  return `<details class="journal-extra ah-done"><summary>修好了的 · ${done.length} 处</summary><ul class="hp-rows">${rows}</ul></details>`;
}
export function aheadPage(e) {
  if (!on(e)) return "";
  const h = e.ah;
  const d1 = BATCH1.filter((id) => h.done[id]).length,
    d2 = BATCH2.filter((id) => h.done[id]).length;
  const sum = `<section class="far-strip ah-sum"><p><b>余烬地区复兴</b>：第一期 ${d1}/${BATCH1.length} 处 · 第二期 ${e.ln?.ended ? d2 + "/" + BATCH2.length + " 处" : "收复以后开"}</p></section>`;
  const parts = [];
  for (const [batch, ids] of [
    [1, BATCH1],
    [2, BATCH2],
  ]) {
    const open = ids.map((id) => PROJECT_BY_ID[id]).filter((p) => h.opened[p.id] && !h.paid[p.id] && !h.done[p.id]);
    const building = ids.map((id) => PROJECT_BY_ID[id]).filter((p) => e.ahBuilding(p.id));
    const cards = [...open.map((p) => projectCard(e, p)), ...building.map((p) => `<article class="rl-list ah-card ah-building"><h4>${esc(placeName(p))} · ${esc(p.name)} <small>${esc(PAGE.building)}</small></h4><p>${esc(p.text)}</p></article>`)].join("");
    const head = batch === 2 ? `<h3 class="ah-batch">${esc(PAGE.batch2)}</h3>` : "";
    const next = nextLine(e, batch);
    if (batch === 2 && !cards && !next && !d2) continue;
    parts.push(head + cards + next);
  }
  return `<div class="outpost-page view-ahead"><p class="muted">${esc(PAGE.intro)}</p>${sum}${parts.join("")}${doneList(e)}</div>`;
}
export function aheadTitle(ui, fallback) {
  return ui?.view === "ahead" ? PAGE.title : fallback(ui);
}
// 重建站那一页最上面：复兴工程一行（有开着没办的写“开着一处”）
function stationLink(e, html) {
  if (typeof html !== "string" || !Object.keys(e.ah.opened).length) return html;
  const open = PROJECTS.filter((p) => e.ah.opened[p.id] && !e.ah.paid[p.id] && !e.ah.done[p.id]);
  const line = `<section class="far-strip ah-strip"><p><b>${esc(PAGE.title)}</b>${open.length ? "开着 " + open.length + " 处没办：" + esc(open.map((p) => p.name).join("、")) : "这个时节的办了"}</p><div class="outpost-links">${button("oView", "ahead", "去看复兴工程")}</div></section>`;
  const at = html.indexOf("</header>");
  return at >= 0 ? html.slice(0, at + 9) + line + html.slice(at + 9) : line + html;
}
export function aheadView(e, ui, html) {
  if (!on(e)) return html;
  if (ui?.view === "ahead") return aheadPage(e);
  if (ui?.view === "rlStation") return stationLink(e, html);
  // 今日抉择卡上的“奖励 ×2”写成算数时真用的倍数（守住的长夜让它变大）
  if (ui?.view === "daily") {
    const t = e.dy?.pending?.tier,
      eff = t && e.ahTier ? e.ahTier(t) : t;
    if (t && eff !== t) html = html.replace(`<span class="daily-tag">奖励 ×${t}</span>`, `<span class="daily-tag" title="主线打完以后每守住一个长夜多 0.2 倍">奖励 ×${eff}</span>`);
  }
  return html;
}

// ================= 任务手记 =================
function nowCard(n) {
  const row = (dt, dd, cls = "") => (dd ? `<div class="story-line${cls}"><dt>${dt}</dt><dd>${esc(dd)}</dd></div>` : "");
  const rows = `<dl class="story-lines">${row("现在做什么", n.text, " now")}${row("要花", n.cost)}${row("能得到什么", n.gain)}${row("也等着你", (n.also || []).join("；"))}</dl>`;
  const go = n.go ? button(n.go.action, n.go.id, n.go.label, 'class="primary"') : "";
  return `<article class="journal-main story-card ah-now"><span class="journal-eyebrow">${esc(NOW.eyebrow)}</span><h2>${esc(n.title)}</h2>${rows}<div class="journal-actions">${go}</div></article>`;
}
// 一整个 <article>…</article>（从 at 开始；里面再套的 article 也算进去）
function articleAt(html, at) {
  let depth = 0,
    m;
  const re = /<article\b|<\/article>/g;
  re.lastIndex = at;
  while ((m = re.exec(html))) {
    if (m[0] === "</article>") {
      depth--;
      if (depth === 0) return html.slice(at, m.index + 10);
    } else depth++;
  }
  return html.slice(at);
}
function letters(e) {
  const h = e.ah,
    done = PROJECTS.filter((p) => h.done[p.id]).sort((a, b) => h.done[b.id] - h.done[a.id]);
  const kids = h.kids.map((id) => KID_LETTERS.find((k) => k.id === id)).filter(Boolean).reverse();
  if (!done.length && !kids.length) return "";
  const a = done.map((p) => `<article class="story-letter ah-letter"><b>${esc(p.who)} · ${esc(p.name)}修好了</b><p>${esc(p.letter)}</p></article>`).join("");
  const b = kids.map((k) => `<article class="story-letter ah-letter"><b>${esc(k.from)}</b><p>${esc(k.text)}</p></article>`).join("");
  return `<details class="journal-extra ah-letters"><summary>${esc(PAGE.letters)} · ${done.length + kids.length} 封</summary>${b}${a}</details>`;
}
export function aheadJournal(e, ui, html) {
  if (!on(e) || typeof html !== "string" || ui?.catalog) return html;
  let out = html;
  const n = e.guidance?.focus ? null : e.ahNow();
  if (n) {
    const at = out.indexOf('<article class="journal-main');
    if (at >= 0) {
      const old = articleAt(out, at);
      let rest = out.slice(at + old.length);
      // 老任务跟着的那道配方也收进去
      let recipe = "";
      const r0 = rest.indexOf('<section class="journal-recipe">');
      if (r0 === 0 || (r0 > 0 && !rest.slice(0, r0).trim())) {
        const r1 = rest.indexOf("</section>", r0);
        recipe = rest.slice(r0, r1 + 10);
        rest = rest.slice(0, r0) + rest.slice(r1 + 10);
      }
      out = out.slice(0, at) + nowCard(n) + rest;
      if (/task-card/.test(old)) {
        const tag = (old.match(/<span class="journal-eyebrow">([^<]*)<\/span>/) || [])[1] || "";
        const title = (old.match(/<h2>([^<]*)<\/h2>/) || [])[1] || "";
        const fold = `<details class="journal-extra ah-old"><summary>${esc(NOW.fold)}${tag ? " · " + tag.replace(/^家园计划 · /, "") : ""}${title ? " · " + title : ""}</summary>${old.replace('class="journal-main story-card task-card"', 'class="story-card task-card ah-folded"')}${recipe}</details>`;
        out = insertExtra(out, fold);
      }
    }
  }
  const l = letters(e);
  return l ? insertExtra(out, l) : out;
}
// 放在“别的地方”那一格前面（没有就放在最后）
function insertExtra(html, block) {
  const mark = html.indexOf('<details class="journal-extra"><summary>别的地方');
  if (mark >= 0) return html.slice(0, mark) + block + html.slice(mark);
  const end = html.lastIndexOf("</div>");
  return end >= 0 ? html.slice(0, end) + block + html.slice(end) : html + block;
}
// 左下角当前目标：主线打完以后（联盟来信那一段段都领完了）
export function aheadHud(e) {
  if (!on(e) || e.guidance?.focus) return null;
  const n = e.ahNow();
  return n ? { number: NOW.eyebrow, body: n.title } : null;
}

// ================= 世界地图：修好了的地方挂一块小牌子 =================
export function aheadMap(e, ui, html) {
  if (!on(e) || ui?.tab === "local" || typeof html !== "string") return html;
  const by = {};
  for (const p of PROJECTS) if (e.ah.done[p.id]) (by[p.place] ||= []).push(p.name);
  const ids = Object.keys(by).filter((id) => ATLAS_POINTS[id]);
  if (!ids.length) return html;
  const pins = ids
    .map((id) => {
      const [x, y] = ATLAS_POINTS[id];
      const text = by[id].length > 1 ? by[id][0] + "等 " + by[id].length + " 处" : by[id][0];
      return `<span class="far-pin ah-pin" style="left:${((x + 70) / 10).toFixed(1)}%;top:${((y + 40) / 7).toFixed(1)}%">${esc(text)} ✓</span>`;
    })
    .join("");
  const at = html.indexOf("</svg>");
  return at < 0 ? html : html.slice(0, at + 6) + pins + html.slice(at + 6);
}

// ================= 顶上的提醒 =================
ALERT_HOOKS.push((e, add) => {
  if (!on(e) || e.s.region !== "farm") return;
  const p = PROJECTS.find((x) => e.ah.opened[x.id] && !e.ah.paid[x.id] && !e.ah.done[x.id] && !e.hpLack(x.cost));
  // 和这周的清单（8）差不多要紧：每周一处、钱的去处
  if (p) add(7, ALERT_HEAD + p.name + "（" + gold(p.cost.gold) + " 金）办得起了", "gold", null);
});

// ================= 动作 =================
export function handleAheadAction(action, el, ctx) {
  const { engine: e } = ctx,
    id = el?.dataset?.id || "";
  if (action === "ahFund") {
    if (!on(e)) return true;
    if (e.ahFund(id)) ctx.save();
    ctx.renderMenu();
    return true;
  }
  // 顶上那条“复兴工程 · …办得起了”：直接打开复兴工程那一页
  if (action === "wAlert" && on(e)) {
    const a = alertItems(e)[Number(id)];
    if (a && String(a.text || "").startsWith(ALERT_HEAD)) {
      ctx.showMenu("outpost", { view: "ahead", id: "" });
      return true;
    }
  }
  return false;
}
