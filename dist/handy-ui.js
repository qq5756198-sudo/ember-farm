// v0.45.0「顺手」的界面：
// · 所有对话框、顶上的提醒、当前目标那一行：一样东西一个叫法、去掉了的东西不再露字（game.js 的 shell、sxWords 都过一遍 handyWords）；
// · 建造页：手记要的那样放在最上面一组“现在要建”、默认选中；建不起的收进最下面“还缺材料”（折着）；新开的档前三天建不起的不列；
// · 设施页（灶台、制作台……）：手记要的那道排第一、写“手记要的”；做不了的收进“还做不了”（折着）；新开的档前三天要人教、要图纸、要先去哪的不列；
// · 农舍页：扩建只列下一样；稀罕货开张以前不写；新开的档前三天钱差得远时扩建那张卡不列；
// · 早上一页：睡醒以后昨天的总结、今日抉择、前三天的“今天先做”在同一页；选了不冒险的一项直接开始这一天（顶上说一句），冒险的那一项在这一页看成没成；
// · 对话框底下那一行键：只写这一页用得上的；
// · 任务手记：要堵路口时，“守住东边路口”那张卡上多一个“去建围栏”。
import { handySay } from "./handy.js";
import { BUILDINGS } from "./data.js";
import { EXPAND, START } from "./hope-data.js";
import { EVENTS as DAILY_EVENTS } from "./daily-data.js";
import { MORNING, PICK_SAY, PAGE, FIRST_DAYS, FOOT_KEYS, FOOT, OPEN_STEP } from "./handy-data.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const on = (e) => typeof e?.hyWant === "function";
// 新开的档、前三天：只列用得上的
const firstDays = (e) => !!e?.easeFresh?.() && (e.s?.day || 1) <= FIRST_DAYS;
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;

// ================= 叫法 =================
// 页面上的字（整段 HTML 也行：要换的这几个词不会出现在标签和属性名里）
export const handyWords = (html) => handySay(html);
// 顶栏：顶上那一排提醒
export function handyHud(e, hud) {
  if (!hud || !on(e) || typeof hud.alerts !== "string") return hud;
  return { ...hud, alerts: handySay(hud.alerts) };
}

// ================= 建造页 =================
// buildGroups 排好的组：手记要的那样拿出来放最上面，建不起的收到最下面一组（折着；新开的档前三天不列）
export function handyBuildGroups(e, groups, focused = false) {
  if (!on(e) || focused || !Array.isArray(groups)) return groups;
  let want = null;
  try {
    want = e.hyWant().build;
  } catch {
    want = null;
  }
  const can = (id) => !BUILDINGS[id] || !!e.afford?.(BUILDINGS[id].cost || {});
  const out = [],
    lack = [];
  let found = false;
  for (const g of groups) {
    const ids = [];
    for (const id of g.ids || []) {
      if (id === want) found = true;
      else if (can(id)) ids.push(id);
      else lack.push(id);
    }
    if (ids.length) out.push({ ...g, ids });
  }
  if (found) out.unshift({ key: "want", title: PAGE.want, ids: [want], want: true });
  if (lack.length && !firstDays(e)) out.push({ key: "lack", title: PAGE.lack(lack.length), ids: lack, fold: true });
  return out;
}
// 建造页“先研究才能建”那一段：新开的档前三天不写
export const handyLockedShown = (e) => !(on(e) && firstDays(e));
// 一格设施卡：手记要的那一格加个记号（look-ui.js 的 buildTiles 先选它）
export const handyWantCard = (html) => String(html).replace('<article class="recipe"', '<article class="recipe hy-want"');
// 折着的那一组
export const handyFold = (title, inner) => `<details class="hy-fold"><summary>${esc(title)}</summary>${inner}</details>`;

// ================= 设施页（灶台、制作台……）和制作页 =================
// 分三堆：手记要的（排第一）、现在做得了的、做不了的（折着）；新开的档前三天，要人教、要图纸、要先去哪的不列
export function handyRecipes(e, list) {
  if (!on(e) || !Array.isArray(list)) return { want: null, main: list || [], fold: [] };
  let want = null;
  try {
    want = e.hyWant().recipe;
  } catch {
    want = null;
  }
  const fresh = firstDays(e),
    main = [],
    fold = [];
  let w = null;
  for (const r of list) {
    if (r.id === want) {
      w = r;
      continue;
    }
    let why = "";
    try {
      why = String(e.recipeReason?.(r) || "");
    } catch {
      why = "";
    }
    if (!why || why.startsWith("加工队列已满")) main.push(r);
    else if (why === "材料不足" || !fresh) fold.push(r);
  }
  return { want: w, main: w ? [w, ...main] : main, fold };
}
export const handyRecipeTag = () => `<small class="hy-tag">${esc(PAGE.wantTag)}</small>`;
export const handyLaterTitle = (n) => PAGE.later(n);

// ================= 农舍页 =================
export function handyHome(e, html) {
  if (!on(e) || typeof html !== "string") return html;
  // 扩建：只列下一样（后面那几样“先扩建上一样”不写）
  let out = html.replace(/<li><span>[^<]*<\/span><small>先扩建上一样<\/small><\/li>/g, "");
  // 稀罕货开张以前不写那一句
  if ((e.s?.day || 1) < START.good) out = out.replace(/<p class="muted">还没有添置稀罕货：[\s\S]*?<\/p>/, "");
  // 新开的档前三天：钱差一半以上时扩建那张卡不列
  if (firstDays(e)) {
    const lv = e.hpLv?.("home") || 0,
      X = EXPAND.home?.[lv];
    if (X && (e.s.money || 0) * 2 < (X.cost?.gold || 0)) out = out.replace(/<article class="frontier-card hp-expand">[\s\S]*?<\/article>/, "");
  }
  return handySay(out);
}

// ================= 对话框底下那一行键 =================
// keys：{ log, defense } 这两个键现在是哪个
export function handyFooter(e, ui, keys = {}) {
  const v = ui?.view || "";
  if (v === "daily" && e?.dailyCard?.() && (e.s?.minute || 0) >= 360 && !e.dailyDeferred?.()) return FOOT.pick;
  if (FOOT_KEYS.includes(v)) return FOOT.esc + " · " + (keys.log || "L") + " 消息记录 · " + (keys.defense || "Z") + " 防线";
  return FOOT.esc;
}

// ================= 早上一页 =================
// 昨天的总结（短的）：一行数、夜里的事、今天要留意；别的几层加在总结那一页上的几段（整顿退回的、该导出存档了）照抄
function reportBody(e, html) {
  const r = e.o?.report;
  if (!r) return "";
  const sign = (n) => (n > 0 ? "+" + n : String(n));
  const night = (r.night || []).length ? `<ul class="hy-night">${r.night.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const warn = (r.threats || []).length ? `<ul class="summary-threats">${r.threats.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  const extra = (String(html || "").match(/<section class="td-converted">[\s\S]*?<\/section>|<p class="ln-export-note">[\s\S]*?<\/p>/g) || []).join("");
  return `<p class="hy-sum">${esc(MORNING.line(r, sign))}</p>${night}${warn}${extra}`;
}
// 今日抉择那一页：最上面昨天的总结（睡醒时并进来的），最下面前三天的“今天先做”
export function handyView(e, ui, html, render = null) {
  if (typeof html !== "string") return html;
  const out = handySay(html);
  if (!on(e) || ui?.view !== "daily" || !e.dailyCard?.()) return out;
  let top = "";
  if (e.hyMorningReport?.()) {
    let rep = "";
    try {
      rep = reportBody(e, typeof render === "function" ? render({ view: "summary", id: "" }) : "");
    } catch {
      rep = "";
    }
    if (rep) top = `<section class="hy-yesterday"><h4 class="hy-sec">${esc(MORNING.report(e.o.report.day))}</h4>${handySay(rep)}</section>`;
  }
  let g = null;
  try {
    g = e.hyMorningPlan?.();
  } catch {
    g = null;
  }
  const plan = g ? `<section class="hy-plan"><h4 class="hy-sec">${esc(MORNING.plan)}</h4><p><b>${esc(g.title)}</b>${g.text ? " · " + esc(g.text) : ""}</p><p class="muted">${esc(MORNING.where)}</p></section>` : "";
  if (!top && !plan) return out;
  return `<div class="hy-morning">${top}${out}${plan}</div>`;
}

// ================= 任务手记 =================
export function handyJournal(e, html) {
  if (typeof html !== "string") return html;
  let out = handySay(html);
  if (!on(e)) return out;
  let g = null;
  try {
    g = e.storyGoal?.();
  } catch {
    g = null;
  }
  // 要堵路口：主线卡上多一个“去建围栏”
  if (g?.step?.id === OPEN_STEP.id && g.step.phase === "fence") {
    const at = out.indexOf('<div class="journal-actions">');
    if (at >= 0) {
      const k = at + '<div class="journal-actions">'.length;
      out = out.slice(0, k) + button("hyFence", "", OPEN_STEP.build, 'class="primary"') + out.slice(k);
    }
  }
  return out;
}

// ================= 动作 =================
const ACTIONS = ["dPick", "hyFence"];
export function handleHandyAction(action, el, ctx = {}) {
  if (!ACTIONS.includes(action)) return false;
  const e = ctx.engine;
  if (!on(e)) return false;
  if (action === "hyFence") {
    ctx.showMenu?.("build");
    return true;
  }
  // 今日抉择选了一项：不冒险、没有后续的，直接开始这一天（顶上说一句）；冒险的、有后续的照原来翻出结果页
  if (action === "dPick") {
    if (!e.dy) return false;
    const i = Number(el?.dataset?.id || 0);
    const r = e.chooseDaily(i);
    const ui = ctx.ui || {};
    if (r && r.win === null && !r.lines.some((l) => /^后续：/.test(l))) {
      ui.dailyResult = null;
      const ev = DAILY_EVENTS[r.event],
        name = ev?.opts?.[r.choice]?.label || ev?.name || "";
      ctx.closeMenu?.();
      ctx.toast?.(handySay(PICK_SAY(name, r.lines)), "gold");
    } else {
      if (r) ui.dailyResult = r;
      ctx.renderMenu?.();
    }
    ctx.save?.();
    return true;
  }
  return false;
}
