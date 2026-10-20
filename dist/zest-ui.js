// v0.32.0「手感」的界面：大事卡片、手机上的说法、任务手记里的早间广播、成就册里的三本图鉴。
import { MOMENT, MOMENT_KINDS, TOUCH_WORDS } from "./zest-data.js";

const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ================= 手机上的说法 =================
const KEYISH = /[A-Z]|空格|左键|右键|数字键/;
const touchCache = new Map();
export function touchWords(text) {
  const src = String(text ?? "");
  if (!KEYISH.test(src)) return src;
  const hit = touchCache.get(src);
  if (hit !== undefined) return hit;
  let out = src;
  for (const [re, to] of TOUCH_WORDS) out = out.replace(re, to);
  if (touchCache.size > 400) touchCache.clear();
  touchCache.set(src, out);
  return out;
}
// 画面上写的字（路灯、警钟、营火旁边的那一行）：手机上也换成按钮上的字
export function touchifyRenderer(r, touch) {
  if (!r || r._zTouch) return r;
  r._zTouch = true;
  for (const k of ["_pixelText", "_pixelBadge", "text"]) {
    const fn = r[k];
    if (typeof fn !== "function") continue;
    r[k] = function (label, ...rest) {
      return fn.call(this, typeof label === "string" && touch() ? touchWords(label) : label, ...rest);
    };
  }
  return r;
}
// 只改看得见的字（不碰属性）
export function touchifyDom(root) {
  if (!root || typeof document === "undefined" || !document.createTreeWalker) return 0;
  // “按 <kbd>X</kbd> 推开”：先把键名并回句子里，再整句换
  for (const k of [...(root.querySelectorAll?.("kbd") || [])]) {
    const prev = k.previousSibling,
      key = String(k.textContent || "").trim();
    if (!prev || prev.nodeType !== 3 || !/按\s?$/.test(prev.nodeValue || "") || !/^([A-Z]|空格|Space)$/i.test(key)) continue;
    prev.nodeValue += key.length === 1 ? key.toUpperCase() : "空格";
    const next = k.nextSibling;
    k.remove?.();
    if (next && next.nodeType === 3) {
      prev.nodeValue += next.nodeValue;
      next.remove?.();
    }
  }
  const walker = document.createTreeWalker(root, 4);
  let n = 0;
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const t = node.nodeValue;
    if (!t || !/[A-Z]|空格|（J）|左键|右键|数字键/.test(t)) continue;
    const next = touchWords(t);
    if (next !== t) {
      node.nodeValue = next;
      n++;
    }
  }
  return n;
}

// ================= 大事卡片 =================
// 12×12 的小图：每个字母是一种颜色，“.” 是透明
const ICONS = {
  level: ["....aa......", "...abba.....", "..abbbba....", ".abbbbbba...", "aaabbbbaaa..", "...abbba....", "...abbba....", "...abbba....", "...abbba....", "...aaaaa....", "............", "............"],
  water: [".....a......", "....aba.....", "....aba.....", "...abbba....", "...abbba....", "..abbbbba...", "..abbcbba...", "..abbbcba...", "..abbbbba...", "...abbba....", "....aaa.....", "............"],
  clinic: ["............", "...aaaaa....", "...abbba....", "...abbba....", "aaaabbbaaaa.", "abbbbbbbbba.", "abbbbbbbbba.", "aaaabbbaaaa.", "...abbba....", "...abbba....", "...aaaaa....", "............"],
  school: ["............", ".aaaaa.aaaa.", ".abbbbabbba.", ".abccbabcba.", ".abbbbabbba.", ".abccbabcba.", ".abbbbabbba.", ".abccbabcba.", ".abbbbabbba.", ".aaaaaaaaaa.", "............", "............"],
  radio: [".....a......", "....aba.....", ".....a......", "..a..a..a...", ".a...a...a..", ".....a......", "....aaa.....", "...aabaa....", "..aabbbaa...", ".aabbbbbaa..", "aaaaaaaaaaa.", "............"],
  power: ["....aaaa....", "...abbbba...", "..abbccbba..", "..abcccbba..", "..abbccbba..", "..abbbbbba..", "...abbbba...", "....abba....", "....aaaa....", "....a..a....", "....aaaa....", "............"],
  rail: ["..a......a..", "aaaaaaaaaaa.", "..a......a..", "..a......a..", "aaaaaaaaaaa.", "..a......a..", "..a......a..", "aaaaaaaaaaa.", "..a......a..", "..a......a..", "aaaaaaaaaaa.", "............"],
  core: [".....a......", "....aba.....", "....aba.....", "...abcba....", "...abcba....", "..abccbba...", "..abcccba...", ".abcccccba..", ".abccccbba..", "..abbbbba...", "...aaaaa....", "............"],
  boss: ["............", "..aaaaaaa...", ".abbbbbbba..", ".abccbccba..", ".abccbccba..", ".abbbbbbba..", "..abbcbba...", "..abbbbba...", "...ababa....", "...aaaaa....", "............", "............"],
  precious: ["............", "...aaaaa....", "..abbcbba...", ".abbcccbba..", "aaaaaaaaaaa.", ".abbbbbbba..", "..abbbbba...", "...abbba....", "....aba.....", ".....a......", "............", "............"],
  fish: ["............", "............", "..aaaa....a.", ".abbbba..aa.", "abcbbbbaaba.", "abbbbbbbbba.", "abbbbbbaaba.", ".abbbba..aa.", "..aaaa....a.", "............", "............", "............"],
  harvest: [".....a......", "....aba.a...", "....abaaba..", ".aa.ababa...", "abba.aba....", ".abbaab.....", "..abab......", "....a.......", "..aaaaaa....", ".acccccca...", "aaaaaaaaaa..", "............"],
  intro: ["............", "..a.a.a.....", "..a.a.a.a...", "..a.a.a.a...", "..abababa...", "..abbbbba.a.", "..abbbbbaba.", "..abbbbbba..", "...abbbba...", "....abbba...", "....aaaaa...", "............"],
};
const PALETTE = {
  level: ["#5b3a12", "#ffd76a", "#fff3c4"],
  wall: ["#3a2a1a", "#ffcf6a", "#fff3c4"],
  core: ["#5a2410", "#ff9a5c", "#ffe2a8"],
  boss: ["#3d1d18", "#d8c9b0", "#5a2410"],
  precious: ["#5b3a12", "#ffcf6a", "#fffbe8"],
  fish: ["#173246", "#8fd0ff", "#ffffff"],
  harvest: ["#2c3d17", "#9fd16a", "#d9b06a"],
  intro: ["#3a2a1a", "#f3e6c4", "#ffd76a"],
};
// 后来的版本加的卡片种类：自带小图和颜色（v0.33：营地升级、过路人、这周的事）
export function addMomentIcons(icons = {}, palettes = {}) {
  for (const [k, rows] of Object.entries(icons)) if (Array.isArray(rows) && rows.length === 12) ICONS[k] ??= rows;
  for (const [k, pal] of Object.entries(palettes)) if (Array.isArray(pal)) PALETTE[k] ??= pal;
}
export function momentIcon(ev) {
  if (ev?.icon && ICONS[ev.icon]) return ev.icon;
  if (ev?.kind === "wall") return ICONS[ev.wall] ? ev.wall : "power";
  return ICONS[ev?.kind] ? ev.kind : "intro";
}
export function paintMomentIcon(canvas, ev) {
  if (!canvas?.getContext) return false;
  const ctx = canvas.getContext("2d");
  if (!ctx) return false;
  const rows = ICONS[momentIcon(ev)],
    pal = PALETTE[ev?.kind] || PALETTE.intro,
    px = Math.floor(canvas.width / 12) || 1;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const c = row[x];
      if (c === ".") continue;
      ctx.fillStyle = pal["abc".indexOf(c)] || pal[1];
      ctx.fillRect(x * px, y * px, px, px);
    }
  });
  return true;
}
export function momentHtml(ev, touch = false) {
  const K = MOMENT_KINDS[ev?.kind] || { label: "大事", color: "#ffd76a" };
  const lines = (ev?.lines || []).filter(Boolean);
  const text = (s) => esc(touch ? touchWords(s) : s);
  return `<canvas class="zm-icon" width="48" height="48" aria-hidden="true"></canvas><div class="zm-body"><small style="color:${K.color}">${esc(K.label)}</small><h3>${text(ev?.title || "")}</h3>${lines.map((l) => `<p>${text(l)}</p>`).join("")}<span class="zm-hint">${touch ? "点一下收起" : "点一下收起"}</span></div>`;
}
// 一张一张地放：每张至少停 MOMENT.min 秒（点一下可以早收），开着页面时也照样放在最上面
export class MomentShow {
  constructor(el) {
    this.el = el;
    this.queue = [];
    this.cur = null;
    this.left = 0;
    this.shown = 0;
  }
  push(ev) {
    if (!ev) return;
    this.queue.push(ev);
    while (this.queue.length > MOMENT.queue) this.queue.shift();
  }
  // dt：秒；blocked：标题页（这时不放、也不走表）
  tick(dt, blocked, touch = false) {
    const el = this.el;
    if (!el) return;
    if (blocked) {
      if (!el.hidden) el.hidden = true;
      return;
    }
    if (this.cur) {
      this.left -= dt;
      this.shown += dt;
      if (this.left <= 0) this.close();
      else if (el.hidden) el.hidden = false;
      return;
    }
    const ev = this.queue.shift();
    if (!ev) return;
    this.cur = ev;
    this.left = MOMENT.show;
    this.shown = 0;
    el.className = "zest-moment k-" + (ev.kind || "intro");
    el.innerHTML = momentHtml(ev, touch);
    paintMomentIcon(el.querySelector("canvas"), ev);
    el.hidden = false;
  }
  close() {
    this.cur = null;
    this.left = 0;
    if (this.el) this.el.hidden = true;
  }
  // 点一下收起（刚出来 0.4 秒内的点击不算，免得误触）
  tap() {
    if (this.cur && this.shown >= 0.4) this.close();
  }
}

// ================= 任务手记：今天的早间广播 =================
export function radioLine(e) {
  const t = e?.radioToday?.();
  if (!t) return "";
  return `<p class="zest-radio"><b>电台</b>${esc(t.replace(/^电台早间播报[：。]?/, ""))}</p>`;
}
export function patchZestJournal(e, html) {
  const line = radioLine(e);
  if (!line || typeof html !== "string") return html;
  const at = html.indexOf('<section class="journal-today"');
  if (at >= 0) {
    const end = html.indexOf("</section>", at);
    if (end > 0) return html.slice(0, end) + line + html.slice(end);
  }
  const head = html.indexOf("</header>");
  const block = `<section class="journal-today zest-today" aria-label="今天"><b>今天</b>${line}</section>`;
  return head > 0 ? html.slice(0, head + 9) + block + html.slice(head + 9) : html;
}

// ================= 成就册：三本图鉴放在一处 =================
export function patchZestCollection(e, html) {
  if (typeof html !== "string" || !e || html.includes('class="zest-dex"')) return html;
  const btn = (a, id, label) => `<button data-action="${a}" data-id="${esc(id)}">${esc(label)}</button>`;
  const fish = e.kin ? Object.values(e.kin.fish || {}).filter((n) => n > 0).length : 0;
  const block = `<section class="zest-dex"><h3>图鉴</h3><p class="muted">鱼类图鉴在下面${fish ? "（钓到过 " + fish + " 种）" : ""}；另外两本在原来的地方，从这里也能翻。</p><div class="button-row">${btn("gView", "gBoard", "菜地图鉴（告示牌）")}${btn("rOpen", "frontier:investigation", "植物图鉴（调查）")}</div></section>`;
  const at = html.lastIndexOf("</div>");
  return at > 0 ? html.slice(0, at) + block + html.slice(at) : html + block;
}
