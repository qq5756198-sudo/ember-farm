// v0.36.0「巨影」的界面：屏幕上方的十凶血条（名字、它现在在干什么、换段的刻度、冰甲、两半、打晃）、
// v0.37.0「扑火」：有几只的那几凶在血条下面每一只一小条（同名的排在一起）；十凶录里最后一凶写哪天夜里来；结局卡的小图。
// 成就册里的十凶录（十个格子：没见过是一团黑影）和两行进度、档案馆的十凶柜（捐战利品）、
// 每日抉择传闻卡上“打听它怎么打”的说明、大事卡片的小图。不加新面板：都放在原来的页面里。
import { ITEMS } from "./data.js";
import { bossBarHtml as baseBossBar } from "./undertow-ui.js";
import { consequence } from "./alliance-ui.js";
import { PREVIEW_HOOKS } from "./daily-ui.js";
import { addMomentIcons } from "./zest-ui.js";
import { makeCanvas } from "./pixel-kit.js";
import { TITANS, TITAN_CASE, tPoss } from "./titan-data.js";
import { heboSprite, scrapSprite, zeroSprite, bearSprite, frostSprite } from "./titan-sprites.js";
import { dogSprite, tideSprite, ventSprite, trainHeadSprite, mothSprite } from "./titan-sprites2.js";

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const pct = (a, b) => Math.max(0, Math.min(100, Math.round((a / Math.max(1, b)) * 100)));
const mmss = (s) => (s >= 60 ? Math.floor(s / 60) + " 分 " + (s % 60) + " 秒" : s + " 秒");

// ================= 头目血条 =================
export function titanBossBar(e) {
  const b = e?.bossBar?.();
  if (b?.kind !== "titan") return baseBossBar(e);
  const hp = pct(b.hp, b.max),
    ticks = (b.phases || []).map((th) => `<em style="left:${Math.round(th * 100)}%"></em>`).join(""),
    armor = b.armor ? `<div class="t-armor" role="progressbar" aria-label="冰甲" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct(b.armor.hp, b.armor.max)}"><i style="width:${pct(b.armor.hp, b.armor.max)}%"></i><span>冰甲</span></div>` : "",
    halves = b.halves ? `<div class="t-halves">${b.halves.map((h, i) => `<span aria-label="${i ? "右" : "左"}半"><i style="width:${pct(h.hp, h.max)}%"></i></span>`).join("")}</div>` : "",
    parts = b.parts?.length ? partsHtml(b.parts) : "",
    poise = b.poise >= 1 ? 100 : Math.round(b.poise * 100);
  return `<div class="t-bar"><div class="boss-name"><b>${esc(b.name)}<span class="t-title">${esc(b.title)}</span></b>${b.tag ? `<small>${esc(b.tag)}</small>` : ""}</div>${armor}<div class="boss-hp t-hp" role="progressbar" aria-label="${esc(tPoss(b.name))}血" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${hp}"><i style="width:${hp}%"></i>${ticks}</div>${halves}${parts}<div class="t-poise${b.poise >= 1 ? " full" : ""}" aria-label="打晃"><span>晃</span><b><i style="width:${poise}%"></i></b></div>${b.note ? `<small class="boss-note">${esc(b.note)}</small>` : ""}</div>`;
}

// 有几只的：同名的排在一起（风机 ▮ 肺 ▮▮▮▮），打没了的是空的
function partsHtml(list) {
  const groups = [];
  for (const P of list) {
    const g = groups.find((x) => x.name === P.name);
    if (g) g.list.push(P);
    else groups.push({ name: P.name, list: [P] });
  }
  return `<div class="t-parts">${groups
    .map(
      (g) =>
        `<span class="t-pgroup"><b>${esc(g.name)}</b>${g.list
          .map((P) => `<span class="t-pbar${P.hp > 0 ? "" : " gone"}" role="progressbar" aria-label="${esc(g.name)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct(P.hp, P.max)}"><i style="width:${pct(P.hp, P.max)}%"></i></span>`)
          .join("")}</span>`,
    )
    .join("")}</div>`;
}

// ================= 十凶录的头像 =================
const FACE = {
  hebo: () => heboSprite("up", 0),
  scrap: () => scrapSprite("walk", 0),
  zero: () => zeroSprite("walk", 0, ""),
  bear: () => bearSprite("walk", 0),
  frost: () => frostSprite("walk", 0, true),
  diao: () => dogSprite("walk", 0, false),
  tide: () => tideSprite("walk", 0, 0),
  vent: () => ventSprite("idle", 0, false),
  train: () => trainHeadSprite(true, 0, false),
  moth: () => mothSprite("walk", 0),
};
const faces = new Map();
// 见过的：本来的样子；没见过的：一团黑影（还没有的那几凶用一团说不清的影子）
function faceUrl(id, seen) {
  const key = id + (seen ? ":1" : ":0");
  if (faces.has(key)) return faces.get(key);
  let url = "";
  try {
    const src = FACE[id]?.() || null,
      S = 44,
      cv = makeCanvas(S, S);
    if (cv) {
      const g = cv.getContext("2d");
      g.imageSmoothingEnabled = false;
      if (src) {
        const k = Math.min(S / src.width, S / src.height);
        g.drawImage(src, Math.round((S - src.width * k) / 2), Math.round(S - src.height * k), Math.round(src.width * k), Math.round(src.height * k));
      } else {
        g.fillStyle = "#18130f";
        g.beginPath();
        g.ellipse(S / 2, S * 0.62, S * 0.3, S * 0.36, 0, 0, Math.PI * 2);
        g.ellipse(S / 2, S * 0.24, S * 0.14, S * 0.14, 0, 0, Math.PI * 2);
        g.fill();
      }
      if (!seen) {
        g.globalCompositeOperation = "source-in";
        g.fillStyle = "#18130f";
        g.fillRect(0, 0, S, S);
        g.globalCompositeOperation = "source-over";
        g.fillStyle = "#bf5a28";
        g.fillRect(S / 2 - 4, Math.round(S * 0.28), 2, 2);
        g.fillRect(S / 2 + 3, Math.round(S * 0.28), 2, 2);
      }
      url = cv.toDataURL?.("image/png") || "";
    }
  } catch {
    url = "";
  }
  faces.set(key, url);
  return url;
}

// ================= 成就册：十凶录 =================
export function titanBookHtml(e) {
  const info = e?.titanInfo?.();
  if (!info) return "";
  const cards = info.rows
    .map((r) => {
      const known = r.ready && (r.known || r.seen),
        img = faceUrl(r.id, r.ready && r.seen),
        face = img ? `<img class="t-face" src="${img}" alt="" width="44" height="44">` : `<span class="t-face" aria-hidden="true"></span>`;
      if (!known)
        return `<article class="t-card unknown">${face}<div><h4>一团黑影</h4><p class="muted">还没听说过。${r.ready ? "日子到了，电台会说它在哪。" : "没有人知道它在哪。"}</p></div></article>`;
      const T = TITANS[r.id],
        bits = [];
      if (r.tries) bits.push("打了 " + r.tries + " 回");
      if (r.wins) bits.push("打赢 " + r.wins + " 回");
      if (r.falls) bits.push("在它手里倒下 " + r.falls + " 回");
      if (r.best) bits.push("最快 " + mmss(r.best));
      // 最后一凶：不回窝、不回来；写它哪天夜里来
      const state = r.final
          ? r.wins
            ? `<p class="t-gone">那一夜守住了。它不会再来。</p>`
            : r.nextFinal
              ? `<p class="t-gone">电台说：第 ${r.nextFinal} 天夜里 22:00，从农场东边的林子里来。</p>`
              : ""
          : r.gone
            ? `<p class="t-gone">打赢了，第 ${r.back} 天回来（更难打）。</p>`
            : r.wins
              ? `<p class="t-gone">又回窝里了。</p>`
              : "",
        lore = r.seen ? r.lore.map((l) => `<p class="t-lore">${esc(l)}</p>`).join("") : `<p class="muted">听说过，还没碰上。</p>`,
        trophy = r.trophy ? `<p class="t-loot"><i class="item-icon" data-icon="${esc(ITEMS[T.trophy]?.icon ?? 55)}"></i>${esc(r.trophy)}${r.donated ? "（捐进十凶柜了）" : "（可以捐给档案馆的十凶柜）"}</p>` : "",
        gear = r.gear ? `<p class="t-loot"><i class="item-icon" data-icon="${esc(ITEMS[T.gear]?.icon ?? 55)}"></i>${esc(r.gear)}</p>` : "",
        perk = r.perk ? `<p class="t-perk">地方变了：${esc(r.perk)}</p>` : "",
        intel = r.intel ? `<p class="t-intel">打法：${esc(r.intel)}</p>` : "",
        mark = r.open && !r.gone && !r.final ? `<div class="button-row">${button("tMark", r.id, "标出它的窝")}</div>` : "";
      return `<article class="t-card${r.seen ? " seen" : ""}${r.wins ? " won" : ""}">${face}<div><h4>${esc(r.name)}<small>${esc(r.title)}</small></h4><p class="t-where">${esc(r.where)} · ${esc(r.when)}</p>${bits.length ? `<p>${esc(bits.join(" · "))}</p>` : ""}${state}${lore}${intel}${trophy}${gear}${perk}${mark}</div></article>`;
    })
    .join("");
  return `<section class="t-book" aria-label="十凶录"><h3>十凶录</h3><p class="muted">见过 ${info.seen}/${info.total} · 打赢 ${info.wins}/${info.total}。每一凶第一次打赢给一件战利品、一件凶器，那片地方也跟着变；打赢以后 28 天它会回来，再打赢给金币和稀罕货。打不过就走：它回窝，第二天回满血。最后一凶不在窝里等你：它在一个夜里来农场，守到天亮或者打倒它。</p><div class="t-grid">${cards}</div></section>`;
}
export function patchTitanCollection(e, html) {
  if (!e?.tg || typeof html !== "string") return html;
  const info = e.titanInfo(),
    C = e.titanCase();
  if (!info || !C) return html;
  const won = info.rows.filter((r) => r.wins > 0).map((r) => r.name),
    li = (label, have, total, small, done) => `<li class="${done ? "done" : ""}"><b>${esc(label)}</b><span class="bar"><i style="width:${pct(have, total)}%"></i></span><span>${have}/${total}</span><small>${small}</small></li>`,
    next = TITAN_CASE.steps.find((st) => !C.done.includes(st.n));
  const rows =
    li("十凶", info.wins, info.total, won.length ? "✓ " + esc(won.join("、")) : "末日以后长成的十个巨物，各守着自己的窝", info.wins >= info.total) +
    li("十凶柜", C.donated.length, C.total, esc(next ? "捐满 " + next.n + " 件：" + next.text : "✓ 十件都捐齐了：全营士气一直 +3"), !next);
  let out = html;
  const start = out.indexOf('<ul class="collection">'),
    at = start >= 0 ? out.indexOf("</ul>", start) : -1;
  out = at > 0 ? out.slice(0, at) + rows + out.slice(at) : out + `<ul class="collection">${rows}</ul>`;
  // 十凶录接在第一张表后面（生涯记录前面）
  const book = titanBookHtml(e),
    s2 = out.indexOf('<ul class="collection">'),
    end = s2 >= 0 ? out.indexOf("</ul>", s2) : -1;
  return end > 0 ? out.slice(0, end + 5) + book + out.slice(end + 5) : out + book;
}

// ================= 档案馆：十凶柜 =================
export function titanCaseHtml(e) {
  const C = e?.titanCase?.();
  if (!C) return "";
  const here = !!e.museumHere?.(),
    items = C.donated.map((id) => `<span class="exhibit">${esc(ITEMS[id]?.name || id)}</span>`).join(""),
    can = C.can.map((id) => button("tDonate", id, "捐：" + (ITEMS[id]?.name || id), here ? "" : "disabled")).join(""),
    steps = TITAN_CASE.steps.map((st) => (C.done.includes(st.n) ? "✓ " : "") + "满 " + st.n + " 件：" + st.text).join("；");
  return `<article class="${C.done.length >= TITAN_CASE.steps.length ? "done" : ""} t-case"><small>${C.donated.length}/${C.total}</small><h3>${esc(C.name)}</h3><p class="exhibits">${items || "<span class='muted'>还空着：每打赢一凶（第一次）给一件战利品</span>"}</p>${consequence({ cost: "不花（捐战利品）", gain: steps, effect: "每样只捐一次" })}${can ? `<div class="button-row">${can}</div>` : ""}</article>`;
}
export function patchTitanMuseum(e, html) {
  const card = titanCaseHtml(e);
  if (!card || typeof html !== "string") return html;
  const tail = '</div><div class="button-row">';
  const at = html.lastIndexOf(tail);
  return at > 0 ? html.slice(0, at) + card + html.slice(at) : html + card;
}

// ================= 每日抉择卡：传闻卡上“打听它怎么打”的说明 =================
PREVIEW_HOOKS.push((e, op) => {
  if (op[0] === "tIntel" && TITANS[op[1]]) return "记下" + tPoss(TITANS[op[1]].name) + "打法：大招的预兆长一点，血条下面写着怎么打";
  return "";
});

// ================= 大事卡片的小图 =================
addMomentIcons(
  {
    // 十凶露面：一团大黑影，两只红眼；打赢：一只铜铃
    titan: ["............", "....aaaa....", "...abbbba...", "..abbbbbba..", "..abcbbcba..", "..abbbbbba..", ".aabbbbbbaa.", "abbbbbbbbbba", "abbabbbbabba", "abba.bb.abba", "aaa..aa..aaa", "............"],
    titanDown: ["............", ".....aa.....", "....abba....", "...abbbba...", "...abccba...", "..abbbbbba..", "..abbbbbba..", ".abbbbbbbba.", ".aaaaaaaaaa.", ".....aa.....", "....abba....", "............"],
    // 守住了最后一夜：地平线上升起来的太阳，底下一堆篝火
    titanEnd: ["............", "....cccc....", "...cbbbbc...", "..cbbbbbbc..", "aaaaaaaaaaaa", "............", ".....bb.....", "....bccb....", "....bccb....", "...aabbaa...", "..aa....aa..", "............"],
  },
  {
    titan: ["#1c140f", "#352a21", "#ff6a4a"],
    titanDown: ["#3a2a1a", "#e9c05a", "#fff2c0"],
    titanEnd: ["#704a2f", "#f6b05a", "#ffdb8c"],
  },
);

// ================= 动作 =================
const ACTIONS = ["tDonate", "tMark"];
export function handleTitanAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, showMenu, renderMenu, save, toast, rebuildUI } = ctx,
    id = el.dataset.id || "";
  if (!e?.tg) return true;
  if (action === "tDonate") {
    e.donateTitanTrophy(id);
    renderMenu();
    save();
    return true;
  }
  if (action === "tMark") {
    const T = TITANS[id];
    if (!T || !e.titanKnown(id)) {
      toast("还不知道它的窝在哪。");
      return true;
    }
    const target = { region: T.region, x: T.lair.x, y: T.lair.y, label: tPoss(T.name) + "窝" };
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
