// v0.23.0「回响」的界面：设置里的四个音量和“声音提示”、按键说明（先列常用的，其余在“更多按键”）、
// 按住 Tab 的轮盘、开局提示条、声音提示的字、每日抉择“稍后再选”、任务手记最上面的“今天”、成就册里的生涯记录。
// 都放在现有的页面里，不加新面板。
import { ITEMS, REGIONS, WEAPONS } from "./data.js";
import { PHASE_NAMES } from "./gear-data.js";
import { keyLabel } from "./farlands-data.js";
import { ALERT_HOOKS, alertItems } from "./winter-ui.js";
import { CUES, CUE_TIME, CAREER_RESULTS, CAREER } from "./feel-data.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const K = (settings, action, fallback) => (keyLabel(settings, action) || fallback).toUpperCase();

// ================= 设置：声音 =================
export function soundRows(settings, audio = {}) {
  const row = (id, title, desc, value) =>
    `<div class="settings-row sound-row"><div>${esc(title)}<small>${esc(desc)}</small></div><input id="${id}" type="range" min="0" max="1" step="0.05" value="${Number(value ?? 0).toFixed(2)}" aria-label="${esc(title)}"></div>`;
  return (
    row("volume", "总音量", "所有声音一起调", settings.sound) +
    row("vol-music", "音乐", "白天、夜里、外面、打仗各有一段", audio.music) +
    row("vol-ambience", "环境", "风、雨、虫鸣、远处的低吼", audio.ambience) +
    row("vol-sfx", "音效", "打击、脚步、感染者的声音和预兆", audio.sfx) +
    `<div class="settings-row"><div>声音提示<small>听不到声音时，预兆和尖叫在屏幕下方出一行带方向的字</small></div><button data-action="feelCues" aria-pressed="${!!audio.cues}">${audio.cues ? "已开启" : "已关闭"}</button></div>`
  );
}

// ================= 按键说明：先列常用的十来个，其余放在“更多按键” =================
export function helpGroups(settings) {
  const k = (a, d) => K(settings, a, d);
  const main = [
    [k("up", "W") + k("left", "A") + k("down", "S") + k("right", "D") + " / 方向键", "移动"],
    ["Shift", "跑步（耗体力）"],
    ["左键", "用工具或攻击"],
    ["空格", "翻滚：前 0.25 秒不受伤，15 体力起（穿得越重越多）"],
    [k("interact", "E"), "交互；踩爬行者；被抓住时连按挣开"],
    [k("shove", "X"), "推开身边的感染者；被抓住时立刻挣开"],
    [k("crouch", "V"), "蹲行（没有脚步声）"],
    ["Tab", "背包；按住是轮盘（制作、建造、地图……）"],
    ["1–0", "快捷栏（远程栏选中时再按 5 换下一把）"],
    [k("map", "M") + " / " + k("journal", "J"), "地图 / 任务手记"],
    ["Esc", "设置；关闭菜单"],
  ];
  const more = [
    [k("craft", "C") + " / " + k("build", "B"), "制作 / 建造"],
    ["K", "技能"],
    [k("log", "L"), "消息记录"],
    [k("defense", "Z"), "防线视图"],
    [k("photo", "H"), "拍照"],
    [k("aim", "T"), "精英部位（拿着枪时）"],
    [k("stone", "G"), "投石"],
    [k("reload", "R"), "装填（拿着枪时）"],
    [k("rotate", "Q"), "旋转建造预览（摆建筑时）"],
    ["F", "远征途中：选下一站"],
    ["滚轮", "切换快捷栏"],
    ["右键", "取消建造"],
  ];
  return { main, more };
}
export function helpHtml(settings) {
  const { main, more } = helpGroups(settings),
    rows = (list) => list.map(([key, v]) => `<div><kbd>${esc(key)}</kbd>${esc(v)}</div>`).join("");
  return `<div class="help-grid">${rows(main)}</div><details class="help-more"><summary>更多按键</summary><div class="help-grid">${rows(more)}</div></details>`;
}
export const PAD_ROWS = [
  ["左摇杆 / 十字键", "移动；菜单里移动焦点"],
  ["A", "交互 / 确认"],
  ["B", "翻滚；建造时取消；菜单里返回"],
  ["X", "使用工具或攻击（自动瞄准最近的感染者）"],
  ["Y", "背包"],
  ["LB / RB", "切换快捷栏"],
  ["LT", "推开；被抓住时立刻挣开"],
  ["RT", "跑步"],
  ["右摇杆", "朝向"],
  ["Start / Back", "设置 / 任务手记"],
];
// 手柄那一节里把 B 的说明换成翻滚
export function patchPadHelp(html) {
  return html.replace("<div><kbd>B</kbd>返回 / 取消建造</div>", "<div><kbd>B</kbd>翻滚；建造时取消；菜单里返回</div>");
}

// ================= 轮盘：按住 Tab =================
export function radialItems(e) {
  const s = e?.s?.settings || {},
    k = (a, d) => K(s, a, d),
    gun = !!WEAPONS[e?.currentItem?.()]?.mag;
  const items = [
    { id: "craft", label: "制作", glyph: "⚒", key: k("craft", "C") },
    { id: "build", label: "建造", glyph: "⌂", key: k("build", "B") },
    { id: "map", label: "地图", glyph: "◇", key: k("map", "M") },
    { id: "journal", label: "任务手记", glyph: "✦", key: k("journal", "J") },
    { id: "skills", label: "技能", glyph: "★", key: "K" },
    { id: "log", label: "消息记录", glyph: "✉", key: k("log", "L") },
    { id: "defense", label: "防线视图", glyph: "▦", key: k("defense", "Z") },
    { id: "photo", label: "拍照", glyph: "◉", key: k("photo", "H") },
  ];
  if (gun) items.push({ id: "aim", label: "精英部位", glyph: "⌖", key: k("aim", "T") });
  if (e?.f?.route) items.push({ id: "route", label: "远征路线", glyph: "➤", key: "F" });
  return items;
}
// pos：轮盘中心在场景里的位置（打开时鼠标在哪就在哪，不出画面）；不给就在正中
export function radialHtml(items, selected = -1, pos = null) {
  const n = items.length,
    at = pos && Number.isFinite(pos.x) && Number.isFinite(pos.y) ? ` style="left:${Math.round(pos.x)}px;top:${Math.round(pos.y)}px"` : "";
  return `<div class="radial-ring"${at}>${items
    .map((it, i) => {
      const a = -Math.PI / 2 + (i / n) * Math.PI * 2,
        x = Math.round(Math.cos(a) * 118),
        y = Math.round(Math.sin(a) * 118);
      return `<button class="radial-item${i === selected ? " selected" : ""}" data-radial="${i}" style="transform:translate(${x}px,${y}px)" title="${esc(it.label)}（${esc(it.key)}）"><span aria-hidden="true">${esc(it.glyph)}</span>${esc(it.label)}${i < 9 ? `<kbd>${i + 1}</kbd>` : ""}</button>`;
    })
    .join("")}<div class="radial-center">${selected >= 0 ? esc(items[selected]?.label) : "松开 Tab 打开"}</div></div>`;
}
// 鼠标在中心的哪个方向，就选哪一格（离中心太近不选）
export function radialPick(n, dx, dy) {
  if (Math.hypot(dx, dy) < 36 || n <= 0) return -1;
  let a = Math.atan2(dy, dx) + Math.PI / 2;
  if (a < 0) a += Math.PI * 2;
  return Math.round((a / (Math.PI * 2)) * n) % n;
}

// ================= 开局提示条 =================
// 触屏上没有键盘：按键换成屏幕上的按钮名
const TOUCH_COACH = {
  arm: "路那头来了感染者！点快捷栏 4 拿起木棍",
  hit: "点“使用”打它们：看见它抬手就是要出手了",
  shove: "两只贴上来了：点“推开”",
  roll: "奔跑者蹲下了，马上要扑：点“翻滚”躲开",
  stomp: "它摔成了爬行者：走过去点“交互”踩它",
  fence: "路口没东西挡：点“建造”选“围栏”，摆在东边路口",
};
export function coachHtml(e, touch = false) {
  const c = e?.coach?.();
  if (!c) return "";
  return `<b>${esc(touch ? c.touch || TOUCH_COACH[c.id] || c.text : c.text)}</b>`;
}

// ================= 声音提示：带方向的一行字 =================
const ARROWS = ["→", "↘", "↓", "↙", "←", "↖", "↑", "↗"];
export function cueArrow(from, to) {
  const a = Math.atan2(to.y - from.y, to.x - from.x);
  return ARROWS[(Math.round(a / (Math.PI / 4)) + 8) % 8];
}
// 哪个事件说哪句：灰隼团的枪声单独说；警报看是尸潮、灰隼团还是别的事
export function cueText(ev, e) {
  if (!ev) return "";
  if (ev.type === "shot") return ev.weapon === "raider" ? CUES.raiderShot : "";
  if (ev.type === "alarm") {
    if (["warning", "active"].includes(e?.raidState?.()?.phase)) return CUES.raid;
    if (["warning", "active"].includes(e?.s?.horde?.phase)) return CUES.horde;
    return CUES.alarm;
  }
  if (["horde", "raid", "raiderShot"].includes(ev.type)) return "";
  return CUES[ev.type] || "";
}
export class CueQueue {
  constructor() {
    this.list = [];
  }
  push(ev, e, now) {
    const text = e ? cueText(ev, e) : "";
    if (!text) return false;
    const p = e.s.player,
      far = Number.isFinite(ev.x) ? Math.hypot(ev.x - p.x, ev.y - p.y) : 0;
    if (far > 900) return false;
    const arrow = Number.isFinite(ev.x) && far > 30 ? cueArrow(p, ev) + " " : "";
    const line = arrow + text;
    const same = this.list.find((c) => c.text === line);
    if (same) same.until = now + CUE_TIME;
    else this.list.push({ text: line, until: now + CUE_TIME });
    while (this.list.length > 3) this.list.shift();
    return true;
  }
  html(now) {
    this.list = this.list.filter((c) => c.until > now);
    return this.list.map((c) => `<span>${esc(c.text)}</span>`).join("");
  }
}

// ================= 每日抉择：稍后再选 =================
export function patchDailyCard(e, html) {
  if (!e?.feel || !html.includes('class="daily-card')) return html;
  if (e.dailyDeferred?.()) {
    // 放着的卡从手记里打开：可以关上，再写一句什么时候过期
    return html.replace(/(class="daily-card[^"]*?) locked"/, '$1"').replace('<p class="daily-stock">', '<p class="daily-later-note">12:00 前选好。到了中午：有不花钱、不吃亏的那一项就替你选它；没有就把卡片拿出来，你来定。</p><p class="daily-stock">');
  }
  if (e.dailyLaterReason?.()) return html;
  return html.replace('<p class="daily-stock">', `<div class="button-row daily-later">${button("feelLater", "", "稍后再选（12:00 前）")}<small>先去做别的；卡片放进任务手记和顶上的提醒里。</small></div><p class="daily-stock">`);
}
// 顶上的提醒：放着的卡
ALERT_HOOKS.push((e, add) => {
  if (e.dailyDeferred?.()) add(1, "今日抉择 · 12:00 前要选", "gold", null);
});

// ================= 任务手记最上面：今天 =================
export function todayHtml(e) {
  const items = e?.todayItems?.() || [];
  if (!items.length) return "";
  return `<section class="journal-today" aria-label="今天"><b>今天</b><ul>${items
    .map((it) => `<li>${it.action ? button(it.action, it.id, it.text) : `<span>${esc(it.text)}</span>`}</li>`)
    .join("")}</ul></section>`;
}
export function patchJournal(e, html) {
  const today = todayHtml(e);
  if (!today || !html.startsWith('<div class="journal-page">')) return html;
  const at = html.indexOf("</header>");
  return at > 0 ? html.slice(0, at + 9) + today + html.slice(at + 9) : html.replace('<div class="journal-page">', '<div class="journal-page">' + today);
}

// ================= 成就册：生涯记录 =================
const RESULT_TONE = { done: "good", fled: "warn", down: "danger" };
export function careerHtml(e) {
  const C = e?.feel?.career;
  if (!C) return "";
  const rows = e
    .careerTable()
    .map(
      (r) =>
        `<tr><td>${esc(REGIONS[r.r]?.name || r.r)}</td><td>${esc(PHASE_NAMES[r.ph] || "")}</td><td>${r.trips}</td><td>${r.down} 次（${r.downPct}%）</td><td>${r.fled}</td><td>${r.fight == null ? "—" : r.fight + " 秒"}</td></tr>`,
    )
    .join("");
  const ITEM = (id) => (id ? ITEMS[id]?.name || id : "");
  const recent = C.trips
    .slice(-10)
    .reverse()
    .map((t) => {
      const worn = (t.g || []).filter(Boolean).map(ITEM).slice(0, 4).join("、") || "空手";
      return `<li class="${RESULT_TONE[t.res] || ""}"><b>第 ${t.d} 天 · ${esc(REGIONS[t.r]?.name || t.r)}</b> ${esc(CAREER_RESULTS[t.res] || "")} · ${Math.round(t.t)} 秒 · 掉血 ${t.hp} · 被抓 ${t.gr} · 被咬 ${t.bi} · 翻滚 ${t.ro} · 打倒 ${t.k}${t.f?.length ? " · 每场仗 " + t.f.join("、") + " 秒" : ""}${t.by ? " · " + esc(downBy(t.by)) : ""}<small>${esc(worn)}</small></li>`;
    })
    .join("");
  return `<section class="career" aria-label="生涯记录"><h3>生涯记录</h3><p class="muted">每趟出门记一行：去哪、穿了什么、结果、用了多久、掉了多少血、被抓被咬几次、滚了几次、打倒几只、每场仗多长。只留最近 ${CAREER.max} 趟，导出存档时一起带走。</p>${
    rows
      ? `<div class="career-scroll"><table class="career-table"><thead><tr><th>地方</th><th>时候</th><th>去了</th><th>倒下</th><th>逃回</th><th>一场仗</th></tr></thead><tbody>${rows}</tbody></table></div><details class="career-recent"><summary>最近 ${Math.min(10, C.trips.length)} 趟</summary><ol>${recent}</ol></details>`
      : "<p>还没有出过门。去一趟废墟回来，这里就有记录。</p>"
  }</section>`;
}
const ZNAMES = { slow: "游荡者", runner: "奔跑者", screamer: "尖叫者", armor: "重甲感染者", elite: "仓库守卫", raider: "灰隼团" };
const nameOf = (id) => ZNAMES[id] || "感染者";
// 倒下的原因：饿晕的单说
const downBy = (id) => (id === "hunger" ? "饿晕了" : "被" + nameOf(id) + "打倒");
export function patchCollection(e, html) {
  const tail = "</ul>";
  const at = html.lastIndexOf(tail);
  const add = careerHtml(e);
  if (!add) return html;
  return at > 0 ? html.slice(0, at + tail.length) + add + html.slice(at + tail.length) : html + add;
}

// ================= 窄屏“☰ 菜单”：触屏的“拍照”按钮收进这里 =================
export function patchPhone(html) {
  if (!html.includes('class="phone-grid"') || html.includes('data-action="fPhoto"')) return html;
  const tile = '<button class="phone-tile" data-action="fPhoto"><span aria-hidden="true">◉</span>拍照</button>';
  const at = html.indexOf('<button class="phone-tile" data-menu="pause"');
  return at > 0 ? html.slice(0, at) + tile + html.slice(at) : html.replace("</div>", tile + "</div>");
}

// ================= 动作 =================
const ACTIONS = ["feelLater", "feelBuild", "feelCues"];
export function handleFeelAction(action, el, ctx) {
  const { engine: e, showMenu, closeMenu, renderMenu, save, toast } = ctx,
    id = el.dataset.id || "";
  if (action === "wAlert" && e.dailyDeferred?.()) {
    // 放着的卡：点提醒直接打开
    const a = alertItems(e)[Number(id)];
    if (a?.text === "今日抉择 · 12:00 前要选") {
      showMenu("outpost", { view: "daily", id: "" });
      return true;
    }
  }
  if (!ACTIONS.includes(action)) return false;
  if (action === "feelLater") {
    if (e.dailyLater()) {
      closeMenu();
      save();
    } else renderMenu();
    return true;
  }
  if (action === "feelBuild") {
    showMenu("build", { focusBuild: "fence" });
    return true;
  }
  if (action === "feelCues") {
    ctx.toggleCues?.();
    renderMenu();
    return true;
  }
  return true;
}
