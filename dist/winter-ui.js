// v0.15.0「寒潮之后」的界面：法令簿、电台节目单、档案馆、成就册、寒潮状况、新人物对话、警报栏、地图活化与营地手册居民页。
import { HERBS } from "./frontier-data.js";
import { LETTER_IDS, costLine, missingCost } from "./alliance-data.js";
import { consequence } from "./alliance-ui.js";
import { portrait, renderOutpost, outpostTitle, renderOutpostJournal } from "./outpost-ui.js";
import { renderAtlas, ATLAS_POINTS, ATLAS_ROUTES, regionOpen } from "./wayfinding.js";
import { renderRebuild } from "./rebuild-ui.js";
import { NPCS } from "./outpost-data.js";
import {
  DECREES,
  LADDER,
  PROGRAMS,
  NOISE_LIMIT,
  SHOWCASES,
  PRIORITIES,
  WNPCS,
  WSPOTS,
  ALAN_FEED,
  GE_COST,
  WINTER,
} from "./winter-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") =>
  `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const head = (key, line, look = key, name, title) => {
  const n = WNPCS[key] || NPCS[key];
  return `<header class="npc-head">${portrait(n?.look ? key : look, name || n?.name)}<div><b>${esc(name || n?.name)}</b><small>${esc(title || n?.title || "")}</small><p class="npc-line">${esc(line)}</p></div></header>`;
};
// outpost-ui 的立绘按 NPCS 查外观；新人物登记进去即可共用。
for (const [id, n] of Object.entries(WNPCS)) NPCS[id] ??= n;

// ---------- 顶栏与警报栏 ----------
export function winterHud(e) {
  const w = e.w;
  if (!w) return null;
  const wi = w.winter;
  if (wi.phase === "prep")
    return {
      text: "寒潮 " + Math.max(0, wi.coldDay - e.s.day) + " 天后",
      tone: "warn",
      title: "寒潮第" + wi.coldDay + "天清晨到，持续三天；火炉" + (wi.lit ? "已点着" : wi.fuelDay ? "缺柴熄火" : "明早 06:00 开始烧柴"),
    };
  if (wi.phase === "cold") {
    const cold = e.playerCold();
    return {
      text: "寒潮 " + Math.max(1, e.s.day - wi.coldDay + 1) + "/" + WINTER.coldDays + (cold ? " · 冷" : " · 暖"),
      tone: cold ? "danger" : "ok",
      title: cold ? "你在暖区外，饿得更快。待在火炉、灶台、农舍或房间附近，或带上保温衣。" : "你在暖区里（或带着保温衣）。",
    };
  }
  return null;
}
// 后面的层可以往这里挂自己的“需要处理的事”。
export const ALERT_HOOKS = [];
export function alertItems(e) {
  if (!e.o) return [];
  const out = [],
    add = (pri, text, tone, target) => out.push({ pri, text, tone, target });
  const r = e.raidState();
  const who = r === e.o.raid ? "灰隼团" : "灰隼团残部";
  if (["warning", "active"].includes(r.phase)) add(0, who + (r.phase === "warning" ? "就要进攻" : "正在进攻"), "danger", { region: "farm", x: 1300, y: 420, label: "东侧围栏" });
  if (["warning", "active"].includes(e.s.horde.phase)) add(0, "尸潮来袭", "danger", { region: "farm", x: 1300, y: 420, label: "迎敌" });
  const days = e.foodDays();
  if (days < 1) {
    const cook = e.s.buildings.find((b) => b.type === "cook" && b.hp > 0) || { x: 1010, y: 480 };
    add(1, "口粮不到一天", "danger", { region: "farm", x: cook.x, y: cook.y + 20, label: "篝火灶 · 做口粮" });
  }
  for (const inc of e.o.incidents.slice(0, 1)) {
    const b = e.s.buildings.find((x) => x.type === inc.station && x.hp > 0);
    if (b) add(1, inc.type === "fire" ? "加工站起火" : "加工站卡料", "danger", { region: "farm", x: b.x, y: b.y + 20, label: "排除故障" });
  }
  if (e.playerCold?.()) {
    const src = e.heatSources().filter((h) => h.kind !== "greenhouse").sort((a, b) => Math.hypot(a.x - e.s.player.x, a.y - e.s.player.y) - Math.hypot(b.x - e.s.player.x, b.y - e.s.player.y))[0];
    if (src && e.s.region === "farm") add(2, "你在暖区外", "warn", { region: "farm", x: src.x, y: src.y + 30, label: "暖区" });
  }
  const wi = e.w?.winter;
  if (wi && ["prep", "cold"].includes(wi.phase) && !wi.lit) {
    const stove = e.s.buildings.find((b) => b.type === "stove" && b.hp > 0);
    if (!stove) add(2, "还没有火炉", "warn", null);
    else if (wi.fuelDay) add(2, "火炉熄了（缺木材）", "warn", { region: "farm", x: stove.x, y: stove.y + 30, label: "火炉 · 明早 06:00 再烧柴" });
  }
  if (e.o.sick >= e.s.day) add(2, "营地有病号", "warn", e.sc?.camp ? { region: "farm", x: e.sc.camp.x, y: e.sc.camp.y + 30, label: "援建营地" } : null);
  if (e.w?.ge.phase === "warned") add(2, "葛队长要走了", "warn", { region: "farm", ...WSPOTS.ge, label: "葛队长" });
  if (e.o.visitors.current) add(3, e.o.visitors.current.name + "在营门等审查", "normal", { region: "farm", x: 1340, y: 368, label: "营门" });
  if (e.meteorTonight?.()) add(3, "今晚有流星雨", "gold", { region: "farm", x: 754, y: 374, label: "联盟终端" });
  const ready = e.c.production.filter((j) => j.ready);
  if (ready.length >= 2 && !e.o.gadgets.includes("collector")) {
    const b = e.s.buildings.find((x) => x.type === ready[0].station && x.hp > 0);
    add(4, ready.length + "批成品待领", "normal", b ? { region: "farm", x: b.x, y: b.y + 20, label: "领取成品" } : null);
  }
  if (e.c.residents.length > e.residentsCapacity()) add(3, "床位不够", "warn", null);
  for (const hook of ALERT_HOOKS) hook(e, add);
  return out.sort((a, b) => a.pri - b.pri).slice(0, 3);
}
export function alertBar(e) {
  const items = alertItems(e);
  return items.map((a, i) => `<button class="alert-item ${a.tone}" data-action="wAlert" data-id="${i}" title="${esc(a.target ? "点击标记：" + a.target.label : a.text)}">${esc(a.text)}</button>`).join("");
}

// ---------- 任务手记：前哨状况的冬季部分 ----------
function ladderPips(e) {
  const checks = e.ladderChecks(),
    level = e.ladderLevel();
  return `<ol class="ladder" aria-label="生活水准 第${level}级">${LADDER.map(
    (l, i) => `<li class="${i < level ? "on" : checks[i] ? "partial" : ""}" title="${esc(l.need)}"><span>${i < level ? "●" : "○"}</span>${esc(l.name)}</li>`,
  ).join("")}</ol>`;
}
function winterStrip(e) {
  const w = e.w,
    wi = w.winter,
    act = e.sc?.act || 1,
    fc = w.forecast ? e.forecast() : null;
  const links = [
    button("wView", "decrees", "法令簿 " + w.decrees.length + "/" + e.decreeSlots()),
    e.r.radio ? button("wView", "radio", "电台节目单") : "",
    w.museum.built || e.s.region === "archive" ? button("wView", "museum", "档案馆") : "",
    button("wView", "collection", "成就册"),
    wi.phase !== "none" || w.forecast ? button("wView", "winter", "寒潮与暖区") : "",
  ].join("");
  const forecast = fc ? `<p class="frost-forecast">霜降的预报：${fc.map((d) => "第" + d.day + "天 " + esc(d.weather)).join(" · ")}</p>` : "";
  const cold =
    wi.phase === "prep"
      ? `<p class="outpost-alert">寒潮第${wi.coldDay}天清晨到（持续三天）。火炉${wi.lit ? "已点着" : wi.fuelDay ? "缺柴熄火" : "明早 06:00 开始烧柴"}；口粮还能撑 ${e.foodDays()} 天。</p>`
      : wi.phase === "cold"
        ? `<p class="outpost-alert">寒潮第 ${Math.max(1, e.s.day - wi.coldDay + 1)}/${WINTER.coldDays} 天。${e.playerCold() ? "你在暖区外，饿得更快。" : "你在暖区里。"}</p>`
        : "";
  return `<section class="winter-strip" aria-label="生活水准与法令"><div class="ladder-row"><b>生活水准</b>${ladderPips(e)}</div>${cold}${forecast}<div class="outpost-links">${links}</div></section>`;
}
export function renderWinterJournal(e, ui = {}) {
  const html = renderOutpostJournal(e, ui);
  if (ui.catalog || !e.w) return html;
  const at = html.indexOf('<section class="outpost-strip"');
  if (at < 0) return html;
  const end = html.indexOf("</section>", at) + "</section>".length;
  return html.slice(0, end) + winterStrip(e) + html.slice(end);
}

// ---------- 营地手册居民页 ----------
export function renderRebuildPlus(e, tab, h, ui, fui) {
  const html = renderRebuild(e, tab, h, ui, fui);
  if (tab !== "residents" || !e.w) return html;
  const card = `<section class="rebuild-card winter-card"><h3>前哨法令簿与生活水准</h3>${ladderPips(e)}<p>生活水准每升一级，加工快 5%；第二级起队员不因缺餐变慢，第三级起居民士气每天 +2。现行法令：${e.w.decrees.length ? e.w.decrees.map((d) => DECREES[d].name).join("、") : "无"}（${e.w.decrees.length}/${e.decreeSlots()}）。</p><div class="button-row">${button("wView", "decrees", "翻开法令簿")}</div></section>`;
  const at = html.indexOf('<div class="detail-scroll">');
  return at < 0 ? html + card : html.slice(0, at + 27) + card + html.slice(at + 27);
}

// ---------- 地图活化 ----------
function safeRegion(e, id) {
  if (["farm", "market"].includes(id)) return true;
  if (["residential", "hospital", "warehouse"].includes(id)) return !!e.f.territory?.[id] || (e.r.outposts?.[id] || 0) >= 2;
  return regionOpen(e, id) && (!!e.d?.unlocked?.[id] || !!e.b?.unlocked?.[id]);
}
export function renderAtlasPlus(e, ui = {}) {
  const html = renderAtlas(e, ui);
  if (ui.tab === "local" || !e.o) return html;
  const pt = (id) => ATLAS_POINTS[id];
  let svg = "";
  for (const id of Object.keys(ATLAS_POINTS))
    if (safeRegion(e, id)) {
      const [x, y] = pt(id);
      svg += `<circle cx="${x}" cy="${y}" r="46" fill="#cfe0a8" opacity=".09"/><circle cx="${x}" cy="${y}" r="46" fill="none" stroke="#cfe0a8" stroke-opacity=".25" stroke-dasharray="4 6"/>`;
    }
  for (const [a, b] of ATLAS_ROUTES)
    if (safeRegion(e, a) && safeRegion(e, b)) {
      const [x, y] = pt(a),
        [xx, yy] = pt(b);
      svg += `<path class="lit-route" d="M${x} ${y} Q${x} ${yy} ${xx} ${yy}" fill="none" stroke="#f3d27a" stroke-width="8" opacity=".22"/>`;
      for (let k = 1; k < 4; k++) {
        const t = k / 4,
          lx = (1 - t) * (1 - t) * x + 2 * (1 - t) * t * x + t * t * xx,
          ly = (1 - t) * (1 - t) * y + 2 * (1 - t) * t * yy + t * t * yy;
        svg += `<circle cx="${lx.toFixed(1)}" cy="${ly.toFixed(1)}" r="3" fill="#f6d98a" opacity=".85"/>`;
      }
    }
  const [fx, fy] = pt("farm"),
    [mx, my] = pt("market");
  const c = e.o.caravan;
  if (e.caravanHere()) svg += `<g transform="translate(${fx + 22} ${fy - 30})"><rect width="22" height="12" rx="2" fill="#c9bf9c"/><circle cx="5" cy="13" r="3" fill="#5b4a33"/><circle cx="17" cy="13" r="3" fill="#5b4a33"/></g><text x="${fx + 48}" y="${fy - 18}" fill="#f1d98a" font-size="12">唐九在农场</text>`;
  else if (c.next && c.next - e.s.day <= 1)
    svg += `<g><rect width="22" height="12" rx="2" fill="#c9bf9c"><animateMotion dur="8s" repeatCount="indefinite" path="M${mx} ${my} Q${mx} ${fy} ${fx} ${fy}"/></rect></g><text x="${(fx + mx) / 2}" y="${(fy + my) / 2 + 26}" fill="#f1d98a" font-size="12">唐九的商队在路上</text>`;
  if (e.o.convoy && !e.o.convoy.done)
    svg += `<g><rect width="18" height="10" rx="2" fill="#9b7653"><animateMotion dur="10s" repeatCount="indefinite" path="M${fx} ${fy} Q${fx} ${my} ${mx} ${my}"/></rect></g>`;
  const r = e.raidState();
  if (["scheduled", "warning", "active"].includes(r.phase)) svg += `<circle cx="${fx + 40}" cy="${fy}" r="10" fill="#d06a58" opacity=".85"><animate attributeName="r" values="8;14;8" dur="1.6s" repeatCount="indefinite"/></circle><text x="${fx + 56}" y="${fy + 4}" fill="#ffb3a6" font-size="12">灰隼团</text>`;
  svg += `<text x="24" y="52" fill="#f1d98a" font-size="11" opacity=".9">亮灯的路：两端都已安全 · 淡圈：安全范围</text>`;
  const at = html.indexOf("</svg>");
  return at < 0 ? html : html.slice(0, at) + svg + html.slice(at);
}

// ---------- 各个视图 ----------
function viewDecrees(e) {
  const w = e.w;
  const cards = Object.entries(DECREES)
    .map(([id, d]) => {
      const on = w.decrees.includes(id),
        reason = e.decreeReason(id);
      return `<article class="${on ? "current" : ""}"><small>${on ? "生效中" : "未颁布"}</small><h3>${esc(d.name)}</h3>${consequence({ cost: d.cost, gain: d.good, effect: on ? "废除后 " + 2 + " 天内不能再改" : "占一个法令位；改签后 2 天内不能再改" })}${button("wDecree", id, on ? "废除" : "颁布", reason ? `disabled title="${esc(reason)}"` : on ? "" : 'class="primary"')}${reason ? `<small class="story-lack">${esc(reason)}</small>` : ""}</article>`;
    })
    .join("");
  return `<p>法令位 ${w.decrees.length}/${e.decreeSlots()}（剧情推进会开放更多）。${w.decreeDay ? "上次改签：第" + w.decreeDay + "天。" : ""}每条法令都有代价。</p><div class="ladder-row"><b>生活水准</b>${ladderPips(e)}</div><div class="story-choice decree-grid">${cards}</div>`;
}
function viewRadio(e) {
  const w = e.w,
    r = w.radio;
  if (!e.r.radio) return "<p>电台还没修好（主线“让沉默的电台再响一次”）。</p>";
  const host = w.yeying.phase;
  const hostLine =
    host === "hosting" || host === "apologized"
      ? head("yeying", host === "apologized" ? WNPCS.yeying.lines.apology : WNPCS.yeying.lines.hello)
      : host === "exposed"
        ? head("yeying", WNPCS.yeying.lines.exposed) +
          `<div class="story-choice"><article><h3>让她公开道歉</h3>${consequence({ cost: "不花材料", gain: "节目效果 ×2，商队更常来", effect: "有人会不满，但听的人更多" })}${button("wYeying", "apologize", "公开道歉", 'class="primary"')}</article><article><h3>请她离开</h3>${consequence({ cost: "不花材料", gain: "不再有争议", effect: "电台由小柒主持，效果回到 ×1" })}${button("wYeying", "dismiss", "请她离开")}</article></div>`
        : `<p class="muted">主持：小柒（效果 ×1）。第八段广播之后会有人来主持。</p>`;
  const cards = Object.entries(PROGRAMS)
    .map(([id, p]) => {
      const reason = e.programReason(id),
        noise = p.noise * (e.decree("silence") ? 0.5 : 1);
      return `<article class="${r.program === id && r.pickDay === e.s.day ? "current" : ""}"><h3>${esc(p.name)}</h3>${consequence({ cost: "动静 +" + noise + "（现在 " + r.noise + "/" + NOISE_LIMIT + "，满了会引来尸群）", gain: p.desc, effect: "效果 ×" + (e.radioHost() * (e.decree("silence") ? 0.5 : 1)) })}${r.program === id && r.pickDay === e.s.day ? "<b>今晚 21:00 播出</b>" : button("wProgram", id, "今晚播这个", reason ? `disabled title="${esc(reason)}"` : 'class="primary"')}</article>`;
    })
    .join("");
  return `${hostLine}<p>每晚 21:00 播一档节目，每天一档。播过节目的两天里算“有盼头”。已播 ${r.aired} 期${r.last ? "，上一期《" + PROGRAMS[r.last].name + "》" : ""}。</p><div class="story-choice">${cards}</div>`;
}
function viewMuseum(e) {
  const w = e.w,
    m = w.museum;
  const here = e.museumHere();
  const cases = Object.entries(SHOWCASES)
    .map(([cat, c]) => {
      const done = m.claimed.includes(cat),
        have = m[cat].length,
        need = e.showcaseNeed(cat),
        can = e.donatable(cat);
      const items = m[cat].map((id) => `<span class="exhibit">${esc(e.exhibitName(cat, id))}</span>`).join("");
      return `<article class="${done ? "done" : ""}"><small>${have}/${need}</small><h3>${esc(c.name)}</h3><p class="exhibits">${items || "<span class='muted'>还空着</span>"}</p>${consequence({ cost: cat === "fish" ? "捐一条对应的鱼" : cat === "herbs" ? "已鉴定的药草 + 1 份药草" : "不花（捐记录）", gain: "填满：" + c.reward, effect: done ? "加成已生效" : "每样只捐一次" })}${can.length ? `<div class="button-row">${can.slice(0, 4).map((id) => button("wDonate", cat + ":" + id, "捐：" + e.exhibitName(cat, id), here ? "" : "disabled")).join("")}</div>` : ""}</article>`;
    })
    .join("");
  return `${head("suyan", m.built ? WNPCS.suyan.lines.built : WNPCS.suyan.lines.hello)}${here ? "" : '<p class="outpost-alert">走到档案馆分馆（农场东北角）或档案岛展厅才能捐赠。</p>'}<div class="story-choice">${cases}</div><div class="button-row">${button("wView", "collection", "打开成就册")}</div>`;
}
export function collectionRows(e) {
  const w = e.w,
    o = e.o,
    f = e.f,
    sc = e.sc;
  const met = [
    !!sc?.helpers.length,
    o.caravan.visits > 0,
    o.crew.some((c) => c.id === "huer"),
    !!o.cargo,
    Object.values(o.cai).some((n) => n > 0),
    !!o.prisoner && o.prisoner !== "held",
    o.youke,
    w.forecast,
    w.yeying.phase !== "none",
    w.museum.built,
    w.ge.phase !== "none",
    w.alan.phase !== "none",
    w.amo.met,
  ];
  return [
    { name: "鱼类", have: w.caught.length, need: 3, reward: SHOWCASES.fish.reward, done: e.showcaseDone("fish") },
    { name: "药草鉴定", have: f.identified.length, need: HERBS.length, reward: SHOWCASES.herbs.reward + "（展柜）", done: e.showcaseDone("herbs") },
    { name: "三地日志", have: f.clues.length, need: 3, reward: SHOWCASES.logs.reward + "（展柜）", done: e.showcaseDone("logs") },
    { name: "照片", have: f.photos.filter((p) => p.subjects?.length).length, need: 3, reward: SHOWCASES.photos.reward + "（展柜）", done: e.showcaseDone("photos") },
    { name: "遗物", have: SHOWCASES.relics.items.filter((id) => e.r.finds.includes(id)).length, need: 4, reward: SHOWCASES.relics.reward + "（展柜）", done: e.showcaseDone("relics") },
    { name: "联盟来信", have: sc?.letters.length || 0, need: LETTER_IDS.length, reward: "每段故事的奖励", done: (sc?.letters.length || 0) >= LETTER_IDS.length },
    { name: "认识的人", have: met.filter(Boolean).length, need: met.length, reward: "各自的能力", done: met.every(Boolean) },
    { name: "蔡眼镜的考验", have: ["gunKills", "crouchKills", "raiders"].filter((k) => o.claimed.includes("cai:" + k)).length, need: 3, reward: "三件枪械配件", done: ["gunKills", "crouchKills", "raiders"].every((k) => o.claimed.includes("cai:" + k)) },
    { name: "尤可的小发明", have: o.gadgets.length, need: 2, reward: "警报铃、自动收集架", done: o.gadgets.length >= 2 },
    { name: "联盟援建清单", have: o.bundles.length, need: 4, reward: "四项长期服务", done: o.bundles.length >= 4 },
  ];
}
function viewCollection(e) {
  const rows = collectionRows(e)
    .map(
      (r) =>
        `<li class="${r.done ? "done" : ""}"><b>${esc(r.name)}</b><span class="bar"><i style="width:${Math.min(100, (r.have / Math.max(1, r.need)) * 100)}%"></i></span><span>${Math.min(r.have, r.need)}/${r.need}</span><small>${r.done ? "✓ " : ""}${esc(r.reward)}</small></li>`,
    )
    .join("");
  return `<p>一页看全部收藏进度与已经拿到的奖励。展柜要到档案馆捐赠后才算填满。</p><ul class="collection">${rows}</ul>`;
}
function viewWinter(e) {
  const w = e.w,
    wi = w.winter;
  const sources = e.heatSources().filter((h) => !["home", "camp"].includes(h.kind));
  const status =
    wi.phase === "none"
      ? w.forecast
        ? "有了预报。建一处保温来源（火炉、温室或布置好的房间）后，寒潮准备期就开始。"
        : "还没有白霜站的预报。"
      : wi.phase === "prep"
        ? "准备期：寒潮第" + wi.coldDay + "天清晨到。"
        : wi.phase === "cold"
          ? "寒潮第 " + Math.max(1, e.s.day - wi.coldDay + 1) + "/" + WINTER.coldDays + " 天，第" + wi.endDay + "天清晨结束。"
          : "寒潮已经过去：冻病 " + (wi.report?.sick || 0) + " 次。";
  return `${head("shuangjiang", wi.phase === "done" ? WNPCS.shuangjiang.lines.saved : w.forecast ? WNPCS.shuangjiang.lines.forecast : WNPCS.shuangjiang.lines.hello)}<p>${esc(status)}</p><dl class="summary-grid"><div><dt>火炉</dt><dd>${e.s.buildings.filter((b) => b.type === "stove" && b.hp > 0).length} 座 · ${wi.lit ? "点着" : "未点"}</dd></div><div><dt>其他热源</dt><dd>${sources.filter((h) => h.kind !== "stove").length} 处</dd></div><div><dt>优先</dt><dd>${wi.priority ? esc(PRIORITIES[wi.priority].pick) : "未选"}</dd></div><div><dt>保温衣</dt><dd>${e.qty("warmCoat") ? "带着" : "没有"}</dd></div></dl><ul class="summary-threats"><li>暖区：火炉 220、温室 200、农舍 150、灶台 140、布置好的房间 120、营地火盆 110（建造时会显示范围）。</li><li>寒潮里暖区外：你饿得快 40%，作物只长三成半，队员单数钟点冻得歇着；营地或农舍不暖，每天清晨可能有人冻病。</li><li>火炉在准备期和寒潮期间每天清晨烧 2 份木材（冬储令或工程保障少烧 1 份）。</li></ul>`;
}
function viewDialog(e, id) {
  const w = e.w;
  if (id === "alan") {
    const a = w.alan;
    if (a.phase === "here")
      return `${head("alan", WNPCS.alan.lines.hello)}<div class="story-choice"><article><h3>分饲料给羊群</h3>${consequence({ cost: costLine(e, ALAN_FEED), gain: "寒潮后留下两只羊，隔两天剪一次毛", effect: "羊每天吃 1 份豆子" })}${button("wAlan", "feed", "分给他", missingCost(e, ALAN_FEED).length ? "disabled" : 'class="primary"')}</article><article><h3>婉拒</h3>${consequence({ cost: "不花", gain: "省下饲料", effect: "没有羊，保温衣只能用布料缝" })}${button("wAlan", "decline", "婉拒")}</article></div>`;
    return head("alan", a.phase === "fed" ? WNPCS.alan.lines.fed : a.phase === "left" ? WNPCS.alan.lines.left : WNPCS.alan.lines.declined);
  }
  if (id === "ge") {
    const g = w.ge,
      level = e.ladderLevel();
    const line = g.phase === "warned" ? WNPCS.ge.lines.unhappy : g.phase === "stayed" ? WNPCS.ge.lines.stayed : WNPCS.ge.lines.hello;
    const choices =
      ["arrived", "warned"].includes(g.phase)
        ? `<div class="story-choice"><article><h3>说服他们留下</h3>${consequence({ cost: "每天多 6 份口粮", gain: "三人砍柴、加工快一成", effect: "需要生活水准第三级（现在第 " + level + " 级）" })}${button("wGe", "persuade", "说服", level >= 3 ? 'class="primary"' : "disabled")}</article><article><h3>护送回城</h3>${consequence({ cost: costLine(e, GE_COST), gain: "营地声望 +5", effect: "少三个人吃饭，也少三个帮手" })}${button("wGe", "escort", "护送", missingCost(e, GE_COST).length ? "disabled" : "")}</article></div>`
        : "";
    return `${head("ge", line)}<div class="ladder-row"><b>生活水准</b>${ladderPips(e)}</div>${choices}`;
  }
  if (id === "amo") {
    const a = w.amo,
      night = e.amoOpen();
    return `${head("amo", night ? WNPCS.amo.lines.hello : WNPCS.amo.lines.day)}<div class="story-choice"><article><h3>买一株月影草</h3>${consequence({ cost: "25 金币（每晚一株）", gain: "月影草 → 特效药（工作台：月影草 1、药草 2）", effect: "特效药在营地用掉时，病号全好" })}${button("wAmo", "buy", "买", night && a.tradeDay !== e.s.day ? 'class="primary"' : "disabled")}</article>${(e.sc?.act || 1) >= 8 && !a.sample ? `<article><h3>请他给一份血样</h3>${consequence({ cost: "不花", gain: "阿默的血样（证据链）", effect: "他会被当成人，而不是怪物" })}${button("wAmo", "sample", "请求血样", night ? 'class="primary"' : "disabled")}</article>` : ""}</div>`;
  }
  return null;
}

const TITLES = {
  decrees: "前哨法令簿",
  radio: "电台节目单",
  museum: "档案馆",
  collection: "成就册",
  winter: "寒潮与暖区",
};
export function winterTitle(ui) {
  if (ui.view === "dialog" && WNPCS[ui.id]) return WNPCS[ui.id].name;
  return TITLES[ui.view] || outpostTitle(ui);
}
export function renderWinterView(e, ui = {}) {
  if (!e.w) return renderOutpost(e, ui);
  let body = null;
  if (ui.view === "decrees") body = viewDecrees(e);
  else if (ui.view === "radio") body = viewRadio(e);
  else if (ui.view === "museum") body = viewMuseum(e);
  else if (ui.view === "collection") body = viewCollection(e);
  else if (ui.view === "winter") body = viewWinter(e);
  else if (ui.view === "dialog") body = viewDialog(e, ui.id);
  if (body === null) return renderOutpost(e, ui);
  return `<div class="outpost-page view-${esc(ui.view)}">${body}</div>`;
}

const ACTIONS = ["wView", "wDecree", "wProgram", "wYeying", "wDonate", "wAlan", "wGe", "wAmo", "wAlert"];
export function handleWinterAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, showMenu, closeMenu, renderMenu, save, toast, rebuildUI } = ctx,
    id = el.dataset.id || "";
  if (!e.w) return true;
  const stay = () => {
    renderMenu();
    save();
  };
  if (action === "wView") {
    const [view, sub] = id.split(":");
    showMenu("outpost", { view, id: sub || "" });
  } else if (action === "wDecree") {
    e.toggleDecree(id);
    stay();
  } else if (action === "wProgram") {
    e.chooseProgram(id);
    stay();
  } else if (action === "wYeying") {
    e.decideYeying(id);
    stay();
  } else if (action === "wDonate") {
    const [cat, ...rest] = id.split(":");
    e.donate(cat, rest.join(":"));
    stay();
  } else if (action === "wAlan") {
    e.feedAlan(id);
    stay();
  } else if (action === "wGe") {
    if (e.chooseStory("ge", id)) {
      closeMenu();
      save();
    } else stay();
  } else if (action === "wAmo") {
    if (id === "buy") e.buyMoonHerb();
    else if (id === "sample" && e.amoSample()) e.checkStory();
    stay();
  } else if (action === "wAlert") {
    const a = alertItems(e)[Number(id)];
    if (!a) return true;
    if (!a.target) {
      toast(a.text + "：打开任务手记看怎么处理。");
      return true;
    }
    e.guidance.focus = null;
    e.guidance.target = { ...a.target };
    if (e.d) e.d.track = null;
    if (e.b) e.b.track = null;
    if (rebuildUI) rebuildUI.target = e.guidance.target;
    if (e.s.region === a.target.region) toast("金色路标：" + a.target.label + "。");
    else showMenu("map", { selected: a.target.region });
  }
  return true;
}
