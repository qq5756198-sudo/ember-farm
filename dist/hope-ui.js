// v0.33.0「盼头」的界面：都放在已有的地方——重建站那一页（这周的清单、墙升二级）、农舍「房间与家具」（农舍扩建、家里添的东西）、
// 仓库箱和鸡舍的设施卡（扩建）、唐九的商队（稀罕货、收菜）、旧站商街「两间铺位经营」（这周的稀罕货）、档案馆（账本记下的旧物）、
// 任务手记（今天、这周）、顶上的提醒；营门口的过路人、货郎、收购的人各一页（走到跟前按 E）。
import { ITEMS } from "./data.js";
import { ALERT_HOOKS } from "./winter-ui.js";
import { ROOM_HOOKS } from "./people-hooks.js";
import { consequence } from "./alliance-ui.js";
import { portrait } from "./outpost-ui.js";
import { WALLS, WALL_IDS, OLD } from "./relight-data.js";
import { DECOR_BY_ID } from "./almanac-data.js";
import { POINT_BY_ID } from "./district-data.js";
import { addMomentIcons } from "./zest-ui.js";
import {
  WALL2,
  EXPAND,
  EXPAND_IDS,
  EXPAND_NAMES,
  GOODS,
  GOOD_IDS,
  START,
  TRAVEL,
  TRAVELERS,
  WEEK_LISTS,
  WEEK_LIST_TIME,
  WEEK_NAMES,
  CARAVAN_WEEK,
  SEASON_BOSSES,
  BOSS_DAYS,
  NOON,
  NOON_NAMES,
  PEDDLERS,
  PEDDLER_SPOT,
  BUYER,
  BUYERS,
  SHOAL,
  SURVIVORS,
  LETTERS,
} from "./hope-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const act = (a, id, label, reason, primary = false) => button(a, id, label, reason ? `disabled title="${esc(reason)}"` : primary ? 'class="primary"' : "") + (reason ? `<small class="story-lack">${esc(reason)}</small>` : "");
const name = (id) => ITEMS[id]?.name || id;
const costText = (cost) =>
  Object.entries(cost || {})
    .map(([k, n]) => (k === "gold" ? n + " 金币" : name(k) + " " + n))
    .join("、");
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => name(id) + (n > 1 ? " ×" + n : ""))
    .join("、");
const hhmm = (m) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(Math.floor(m % 60)).padStart(2, "0");
const head = (look, who, title, line) => `<header class="npc-head">${portrait(look, who)}<div><b>${esc(who)}</b><small>${esc(title || "")}</small><p class="npc-line">${esc(line)}</p></div></header>`;

// ================= 大事卡片的小图 =================
addMomentIcons(
  {
    build: ["............", ".....aa.....", "....abba....", "...abbbba...", "..abbbbbba..", ".aaaaaaaaaa.", "..acbbbbca..", "..acbbbbca..", "..abbccbba..", "..abbccbba..", "..aaaaaaaa..", "............"],
    good: ["............", "....a..a....", "...aba.aba..", "....aaaa....", ".aaaaaaaaaa.", ".abbbcbbbba.", ".abbbcbbbba.", ".aaaaaaaaaa.", ".abbbcbbbba.", ".abbbcbbbba.", ".aaaaaaaaaa.", "............"],
    traveler: ["....aaa.....", "...abbba....", "...abbba....", "....aaa.....", "...accca.aa.", "..acccccaba.", "..acccccaba.", "..acccccaa..", "...accca....", "...a...a....", "..aa...aa...", "............"],
    week: ["..aaaaaaa...", ".abbbbbbba..", ".ab.aaa.ba..", ".abbbbbbba..", ".abcbbbbba..", ".abbbbbbba..", ".abcbbbbba..", ".abbbbbbba..", ".abcbbbbba..", ".abbbbbbba..", ".aaaaaaaaa..", "............"],
    // 档案馆收下的旧物（一只老瓶子）、残页（下边撕破的一页）、检修电梯（铁笼子里一个往上的箭头）
    old: ["............", "....aaaa....", "....abba....", ".....aa.....", "....abba....", "...abbbba...", "..abbccbba..", "..abbccbba..", "..abbbbbba..", "...abbbba...", "....aaaa....", "............"],
    page: ["............", "..aaaaaaa...", "..abbbbbaa..", "..abccccba..", "..abbbbbba..", "..abcccbba..", "..abbbbbba..", "..abccccba..", "..abbbbbba..", "..abbbbbba..", "..aaba.aaa..", "............"],
    lift: ["aaaaaaaaaaaa", "abbbbbbbbbba", "abaaaaaaaaba", "aba..cc..aba", "aba.cccc.aba", "abaccccccaba", "aba..cc..aba", "aba..cc..aba", "aba..cc..aba", "abaaaaaaaaba", "abbbbbbbbbba", "aaaaaaaaaaaa"],
  },
  {
    upgrade: ["#4a3016", "#ffcf6a", "#fff3c4"],
    traveler: ["#2c3d17", "#e8d2a6", "#9fd16a"],
    week: ["#173246", "#e9f4ff", "#8fd0ff"],
    old: ["#4a3016", "#e6c48a", "#fff3c4"],
    page: ["#5a4a32", "#efe4c8", "#8a7a5a"],
    lift: ["#2c3d17", "#6f7f5a", "#cfe7a6"],
  },
);

// ================= 营门口的过路人 =================
function viewTraveler(e) {
  const W = e.hp?.week;
  if (!W || W.kind !== "traveler" || !["here", "done"].includes(W.st)) return `<div class="outpost-page view-hpTraveler"><p>营门口现在没有过路人。</p></div>`;
  const T = TRAVELERS[W.id];
  if (W.st === "done") return `<div class="outpost-page view-hpTraveler">${head(W.id, T.name, "过路人", T.done)}<p class="gold">留下了「${esc(DECOR_BY_ID[T.gift].name)}」：在建设里选「旧物摆件」摆出来。</p></div>`;
  const rows = T.ask.map(([k, n]) => `<li><span>${esc(e.hpKeyName(k))}</span><small>要 ${n} · 有 ${e.hpAcceptsHave(k)}</small></li>`).join("");
  const leave = W.start + TRAVEL.stay - 1;
  return `<div class="outpost-page view-hpTraveler">${head(W.id, T.name, "过路人 · 待到第 " + leave + " 天 " + hhmm(TRAVEL.leave), T.story[0])}<p>${esc(T.story[1])}</p><article class="rl-list hp-ask"><h4>他想要</h4><ul>${rows}</ul><p class="rl-reward">给了：他留下一件「${esc(DECOR_BY_ID[T.gift].name)}」（摆件）</p></article>${consequence({ cost: T.ask.map(([k, n]) => e.hpKeyName(k) + " " + n).join("、"), gain: "一件摆件，以后可能还有他的信", effect: "第 " + leave + " 天 " + hhmm(TRAVEL.leave) + " 前不给，他就往下一个营地走了" })}<div class="button-row">${act("hpGive", W.id, "给他", e.travelerReason(), true)}</div></div>`;
}

// ================= 货郎 =================
function viewPeddler(e) {
  const N = e.hp?.noon;
  if (!N || N.kind !== "peddler" || N.day !== e.s.day || !["on", "done"].includes(N.st)) return `<div class="outpost-page view-hpPeddler"><p>货郎已经收摊了。</p></div>`;
  const P = PEDDLERS[N.id],
    o = e.peddlerOffer(N);
  const sellName = o.item === "clue" ? "一条旧物的下落（他翻旧账给你找）" : name(o.item) + (o.n > 1 ? " ×" + o.n : "");
  const sell = `<article class="offer${N.sold ? " sold" : ""}"><h3>卖：${esc(sellName)}</h3><p>${esc(o.item === "clue" ? "记进档案馆那一页：在哪片废墟的哪种柜子里。" : ITEMS[o.item]?.desc || "")}</p>${consequence({ cost: o.price + " 金币（现有 " + e.s.money + "）", gain: sellName, effect: "只卖这一回" })}<div class="button-row">${N.sold ? "<b>已买下</b>" : act("hpPeddle", "sell", "买下", e.peddlerReason("sell"), true)}</div></article>`;
  const give = P.swap.give.map(([k, n]) => e.hpKeyName(k) + " " + n).join("、"),
    get = itemsText(P.swap.get).replace("keepsake", "一件老物件");
  const swap = `<article class="offer${N.swapped ? " sold" : ""}"><h3>换：${esc(give)} → ${esc(P.swap.get.keepsake ? "一件老物件（谁的心头好）" : get)}</h3>${consequence({ cost: give, gain: P.swap.get.keepsake ? "一件老物件" : get, effect: "只换这一回" })}<div class="button-row">${N.swapped ? "<b>已换过</b>" : act("hpPeddle", "swap", "换", e.peddlerReason("swap"), true)}</div></article>`;
  const bonus = N.bonus ? `<p class="gold">添头已经塞给你了。</p>` : `<p class="rl-reward">买了也换了，他从箱底摸一样东西当添头。</p>`;
  return `<div class="outpost-page view-hpPeddler">${head(P.look, P.name, "货郎 · 摆到 " + hhmm(NOON.peddlerEnd), P.line)}<div class="offer-grid">${sell}${swap}</div>${bonus}</div>`;
}

// ================= 限时收购 =================
function viewBuyer(e) {
  const N = e.hp?.noon;
  if (!N || N.kind !== "buyer" || N.day !== e.s.day) return `<div class="outpost-page view-hpBuyer"><p>收购的人已经走了。</p></div>`;
  const B = BUYERS[N.id];
  if (N.st !== "on") return `<div class="outpost-page view-hpBuyer">${head(B.look, B.name, "限时收购", N.st === "done" ? "“收满了，谢谢你！”" : "“下回再来。”")}</div>`;
  const ids = e.hpAccepts(N.item),
    prices = (ids.length ? ids : [N.item]).filter((id) => ITEMS[id]).map((id) => name(id) + " " + Math.round((ITEMS[id].sell || 1) * BUYER.mult));
  return `<div class="outpost-page view-hpBuyer">${head(B.look, B.name, "限时收购 · 到 " + hhmm(NOON.end), B.line)}<article class="rl-list hp-ask"><h4>收${esc(e.hpKeyName(N.item))} <small>${N.got}/${N.n}</small></h4><p>每份按卖价的两倍半：${esc(prices.join("、") || "—")} 金币。手上有 ${e.hpAcceptsHave(N.item)} 份（${e.s.region === "farm" ? "背包和仓库" : "背包里"}）。</p><p class="rl-reward">收满了多给：${esc(itemsText(B.bonus))}</p></article><div class="button-row">${act("hpSell", "", "卖给他", e.buyerReason(), true)}</div></div>`;
}

// ================= 重建站：这周的清单、墙升二级 =================
function weekListCard(e) {
  const W = e.hp?.week;
  if (!W || W.kind !== "list" || W.st === "soon") return "";
  const L = WEEK_LISTS[W.id],
    open = W.st === "open",
    close = W.start + WEEK_LIST_TIME.closeDay - 1;
  const rows = L.need
    .map(([k, n]) => {
      const got = Math.min(n, W.got[k] || 0),
        full = got >= n;
      const st = e._zStamp,
        stamped = st && st.list === W.id && st.key === k && Date.now() - st.at < 900;
      return `<li class="${full ? "full" : ""}${stamped ? " z-stamped" : ""}"><span>${esc(e.hpKeyName(k))}</span><small>${got}/${n}${full ? " ✓" : " · 有 " + e.hpAcceptsHave(k)}</small>${open && !full ? act("hpList", k, "交", e.weekListReason(k), true) : ""}</li>`;
    })
    .join("");
  const tag = W.st === "done" ? "交满了 ✓" : W.st === "closed" ? "收走了" : "到第 " + close + " 天 " + hhmm(WEEK_LIST_TIME.close);
  return `<article class="rl-list hp-week${W.st === "done" ? " done" : ""}"><h4>这周的清单 · ${esc(L.name)} <small>${esc(tag)}</small></h4><p class="muted">${esc(L.hint)}</p><ul>${rows}</ul><p class="rl-reward">交满：${L.reward.gold} 金币、一件「${esc(DECOR_BY_ID[L.decor].name)}」（摆件）</p></article>`;
}
function wall2Block(e, w) {
  const X = WALL2[w];
  if (e.wall2On(w)) return `<p class="hp-wall2 done"><b>二级 · ${esc(X.name)}</b> ✓ ${esc(X.text)}</p>`;
  return `<div class="hp-wall2"><p><b>升二级 · ${esc(X.name)}</b>：${esc(X.text)}</p><p class="muted">要 ${esc(costText(X.cost))}</p>${act("hpWall2", w, "升到二级", e.wall2Reason(w))}</div>`;
}
export function patchStation(e, html) {
  if (!e?.hp || typeof html !== "string") return html;
  let out = html;
  const card = weekListCard(e);
  if (card) {
    const at = out.indexOf("</header>");
    out = at >= 0 ? out.slice(0, at + 9) + card + out.slice(at + 9) : card + out;
  }
  for (const w of WALL_IDS) {
    if (!e.wallOn(w)) continue;
    const mark = `<p class="rl-effect">${esc(WALLS[w].text)}</p>`,
      at = out.indexOf(mark);
    if (at >= 0) out = out.slice(0, at + mark.length) + wall2Block(e, w) + out.slice(at + mark.length);
  }
  return out;
}

// ================= 唐九的商队：这一回多待一天、收一样菜 =================
export function patchCaravan(e, html) {
  const W = e?.hp?.week,
    c = e?.o?.caravan;
  if (!W || W.kind !== "caravan" || W.st !== "here" || !e.caravanHere?.() || typeof html !== "string") return html;
  const until = Math.floor((c.until || 0) / 1440);
  let out = until > e.s.day ? html.replace("今天 20:00 收摊。", "第 " + until + " 天 20:00 收摊。") : html;
  const each = Math.round((ITEMS[W.buy]?.sell || 1) * CARAVAN_WEEK.mult);
  const sell = `<article class="rl-list hp-ask"><h4>这回唐九还收${esc(e.hpKeyName(W.buy))} <small>${W.sold || 0}/${CARAVAN_WEEK.max}</small></h4><p>两倍价：每份 ${each} 金币起（优质、上品更贵）。手上有 ${e.hpAcceptsHave(W.buy)} 份。</p>${act("hpCaravanSell", "", "卖给唐九", e.caravanSellReason(), true)}</article>`;
  const at = out.indexOf('<div class="offer-grid">');
  return at >= 0 ? out.slice(0, at) + sell + out.slice(at) : out + sell;
}

// ================= 旧站商街：这周的稀罕货（地区页里那一格写清楚它是干什么的） =================
export function patchHopeDistricts(e, html) {
  if (!e?.hp || typeof html !== "string") return html;
  const m = e.marketGood?.();
  if (!m) return html;
  const G = GOODS[m.good],
    label = "这周的稀罕货 · " + G.name + "（" + G.price + " 金币）",
    at = html.indexOf("<b>" + label + "</b>");
  if (at < 0) return html;
  const s0 = html.indexOf("<small>", at),
    s1 = html.indexOf("</small>", s0);
  if (s0 < 0 || s1 < 0) return html;
  return html.slice(0, s0) + "<small>" + esc(G.text + (G.repeat ? "（每周都可能再来）" : "（买下就一直有，不会再卖第二次）")) + html.slice(s1);
}

// ================= 农舍「房间与家具」：农舍扩建、家里添的东西 =================
function expandRows(e, k) {
  const lv = e.hpLv(k);
  return EXPAND[k]
    .map((X, i) => {
      if (i < lv) return `<li class="full"><span>${esc(X.name)} ✓</span><small>${esc(X.text)}</small></li>`;
      if (i > lv) return `<li><span>${esc(X.name)}</span><small>先扩建上一样</small></li>`;
      return `<li><span>${esc(X.name)}</span><small>${esc(X.text)} 要 ${esc(costText(X.cost))}</small>${act("hpExpand", k, "扩建", e.expandReason(k), true)}</li>`;
    })
    .join("");
}
function expandCard(e, k, extra = "") {
  return `<article class="frontier-card hp-expand"><h3>${esc(EXPAND_NAMES[k])}扩建 <small>${e.hpLv(k)}/${EXPAND[k].length}</small></h3><ul class="hp-rows">${expandRows(e, k)}</ul>${extra}</article>`;
}
function goodsOwned(e) {
  const have = GOOD_IDS.filter((id) => !GOODS[id].repeat && e.hpOwn(id));
  if (!have.length) return `<p class="muted">还没有添置稀罕货：旧站商街每周一样（第 ${START.good} 天起），唐九的商队那一周多两样。</p>`;
  return `<ul class="hp-rows">${have.map((id) => `<li class="full"><span>${esc(GOODS[id].name)}</span><small>${esc(GOODS[id].text)}${id === "can" ? "（备用水箱 " + (e.hp.tank || 0) + "/" + (e.waterMax() - e.c.waterCapacity) + "）" : ""}</small></li>`).join("")}</ul>`;
}
ROOM_HOOKS.push((e) => {
  if (!e?.hp) return "";
  return expandCard(e, "home", `<p class="muted">仓库箱、鸡舍的扩建在它们自己的设施卡上（走到跟前按 E）。</p><h4>家里添的东西</h4>${goodsOwned(e)}`);
});
// 仓库箱、鸡舍的设施卡
export function hopeBuildingExtras(e, b) {
  if (!e?.hp || !b) return "";
  if (b.type === "chest") return expandCard(e, "store");
  if (b.type === "coop") return expandCard(e, "coop");
  return "";
}

// ================= 档案馆：账本记下的旧物 =================
export function patchHopeMuseum(e, html) {
  const list = e?.hp?.clues || [];
  if (!list.length || typeof html !== "string") return html;
  const rows = list.map((id) => `<li class="${e.clueFound(id) ? "on" : ""}"><b>${esc(OLD[id].name)}</b><small>${e.clueFound(id) ? "找到了" : esc(e.ledgerText(id))}</small></li>`).join("");
  const block = `<section class="hp-clues"><h3>账本里记着的旧物</h3><p class="muted">货郎的账本、旧书摊翻出来的：去那片废墟的那种柜子里找，比别处容易翻到。</p><ul class="rl-old">${rows}</ul></section>`;
  const at = html.indexOf('<section class="rl-oldworld">');
  return at >= 0 ? html.slice(0, at) + block + html.slice(at) : html + block;
}

// ================= 任务手记：一行盼头、来信 =================
function hopeStrip(e) {
  const h = e.hp,
    W = h.week,
    N = h.noon,
    bits = [];
  if (N?.kind && N.day === e.s.day && ["soon", "on"].includes(N.st)) bits.push("今天下午 · " + NOON_NAMES[N.kind]);
  if (W && !["gone", "closed"].includes(W.st)) bits.push("这周 · " + WEEK_NAMES[W.kind]);
  const goods = GOOD_IDS.filter((id) => !GOODS[id].repeat),
    own = goods.filter((id) => e.hpOwn(id)).length,
    w2 = Object.keys(h.wall2).length,
    ex = Object.values(h.expand).reduce((a, b) => a + b, 0),
    exMax = EXPAND_IDS.reduce((a, k) => a + EXPAND[k].length, 0);
  if (own || w2 || ex) bits.push("稀罕货 " + own + "/" + goods.length + (w2 ? " · 二级墙 " + w2 + "/6" : "") + (ex ? " · 扩建 " + ex + "/" + exMax : ""));
  if (!bits.length) return "";
  const links = [button("oView", "hpWeek", "这周和今天"), e.rlStationB?.() ? button("sView", "rlStation", "重建站") : ""].join("");
  return `<section class="far-strip hp-strip" aria-label="盼头"><p>${esc(bits.join(" · "))}</p><div class="outpost-links">${links}</div></section>`;
}
function lettersBlock(e) {
  const list = e.hp?.letters || [];
  if (!list.length) return "";
  const items = [...list]
    .reverse()
    .map((id) => LETTERS.find((L) => L.id === id))
    .filter(Boolean)
    .map((L) => `<article class="story-letter hp-letter"><b>${esc(L.from)}</b><p>${esc(L.text)}</p><small>信里夹着：${esc(itemsText(L.gift))}</small></article>`)
    .join("");
  return `<details class="journal-extra hp-letters"><summary>鸽子捎回的信 · ${list.length} 封</summary>${items}</details>`;
}
export function patchHopeJournal(e, html) {
  if (!e?.hp || typeof html !== "string") return html;
  let out = html;
  const s = hopeStrip(e);
  if (s) {
    let placed = false;
    for (const mark of ['<section class="far-strip rl-strip"', '<section class="far-strip ln-strip"', '<section class="far-strip"', '<section class="journal-today"']) {
      const at = out.indexOf(mark);
      if (at >= 0) {
        const end = out.indexOf("</section>", at) + "</section>".length;
        out = out.slice(0, end) + s + out.slice(end);
        placed = true;
        break;
      }
    }
    if (!placed) {
      const at = out.indexOf("</header>");
      out = at > 0 ? out.slice(0, at + 9) + s + out.slice(at + 9) : out + s;
    }
  }
  const extra = lettersBlock(e);
  if (!extra) return out;
  const at = out.indexOf('<details class="journal-extra');
  if (at >= 0) return out.slice(0, at) + extra + out.slice(at);
  const end = out.lastIndexOf("</div>");
  return end >= 0 ? out.slice(0, end) + extra + out.slice(end) : out + extra;
}

// ================= 这周和今天（从任务手记、提醒里打开） =================
function viewWeek(e) {
  const h = e.hp,
    W = h.week,
    N = h.noon,
    parts = [];
  if (N?.kind && N.day === e.s.day) {
    const st = N.st === "soon" ? "14:00 开始" : N.st === "on" ? "正在进行" : N.st === "done" ? "做完了" : "已经过去了";
    parts.push(`<article class="rl-list"><h4>今天下午 · ${esc(NOON_NAMES[N.kind])} <small>${esc(st)}</small></h4><p>${esc(e.noonText(N))}</p></article>`);
  } else if (e.s.day >= 8) parts.push(`<article class="rl-list"><h4>今天下午</h4><p>${e.isLongNight?.(e.s.day) ? "今天是长夜：下午没有别的事，好好准备。" : "今天下午没什么事。"}</p></article>`);
  if (W) {
    const st = { soon: "还没开始", here: "在营门口", open: "贴在重建站", on: "在那张图上", done: "做完了", gone: "走了", closed: "收走了" }[W.st] || "";
    parts.push(`<article class="rl-list"><h4>这周 · ${esc(WEEK_NAMES[W.kind])} <small>${esc(st)}</small></h4><p>${esc(e.weekText(W))}</p></article>`);
  } else parts.push(`<article class="rl-list"><h4>这周的事</h4><p>第二年（第 29 天）起每周一件：过路人、这周的清单、唐九的商队、季节头目轮着来。</p></article>`);
  const m = e.marketGood?.();
  if (m) parts.push(`<article class="rl-list"><h4>旧站商街这周的稀罕货 <small>${m.sold ? "已买下" : GOODS[m.good].price + " 金币"}</small></h4><p>${esc(GOODS[m.good].name)}：${esc(GOODS[m.good].text)}</p><p class="muted">到旧站商街「两间铺位经营」那一处买。</p></article>`);
  return `<div class="outpost-page view-hpWeek"><p class="muted">每天早上 7 点说一遍今天下午的事；每周第一天说这周的事（电台修好了，任务手记里还有全文）。</p>${parts.join("")}</div>`;
}

// ================= 页面 =================
export function renderHopeView(e, ui, base) {
  if (!e?.hp || !ui) return base(e, ui);
  if (ui.view === "hpTraveler") return viewTraveler(e);
  if (ui.view === "hpPeddler") return viewPeddler(e);
  if (ui.view === "hpBuyer") return viewBuyer(e);
  if (ui.view === "hpWeek") return viewWeek(e);
  const html = base(e, ui);
  if (ui.view === "rlStation") return patchStation(e, html);
  if (ui.view === "caravan") return patchCaravan(e, html);
  if (ui.view === "museum") return patchHopeMuseum(e, html);
  return html;
}
const TITLES = { hpTraveler: "过路人", hpPeddler: "货郎", hpBuyer: "限时收购", hpWeek: "这周和今天" };
export function hopeTitle(ui, fallback) {
  return TITLES[ui?.view] || fallback(ui);
}

// ================= 顶上的提醒 =================
ALERT_HOOKS.push((e, add) => {
  const h = e?.hp;
  if (!h) return;
  const day = e.s.day,
    m = e.s.minute,
    N = h.noon,
    W = h.week;
  if (N?.kind && N.day === day) {
    const place = N.region && N.region !== "farm" ? e.regionName(N.region) : "营门口";
    const target = N.kind === "peddler" ? { region: "farm", x: PEDDLER_SPOT.x, y: PEDDLER_SPOT.y + 40, label: PEDDLERS[N.id].name } : N.kind === "buyer" ? { region: N.region, ...(N.region === "farm" ? BUYER.farmSpot : BUYER.spot), label: BUYERS[N.id].name } : N.kind === "shoal" ? null : N.region ? { region: N.region, x: N.x ?? 900, y: N.y ?? 520, label: NOON_NAMES[N.kind] } : null;
    const end = N.kind === "peddler" ? NOON.peddlerEnd : N.kind === "shoal" ? SHOAL.until : NOON.end;
    if (N.st === "on") add(2, "下午的事 · " + NOON_NAMES[N.kind] + (N.kind === "shoal" ? "" : "：" + place) + "（到 " + hhmm(end) + "）", "gold", target);
    else if (N.st === "soon" && m >= 7 * 60) add(7, "今天 14:00 · " + NOON_NAMES[N.kind] + (N.kind === "shoal" ? "" : "（" + place + "）"), "normal", target);
  }
  if (W) {
    if (W.kind === "traveler" && W.st === "here") add(5, "过路人" + TRAVELERS[W.id].name + "在营门口（到第 " + (W.start + 3) + " 天 20:00）", "gold", { region: "farm", x: TRAVEL.spot.x, y: TRAVEL.spot.y + 40, label: TRAVELERS[W.id].name });
    if (W.kind === "list" && W.st === "open") {
      const L = WEEK_LISTS[W.id],
        got = L.need.reduce((a, [k, n]) => a + Math.min(n, W.got[k] || 0), 0),
        need = L.need.reduce((a, [, n]) => a + n, 0),
        b = e.rlStationB?.();
      add(8, "这周的清单「" + L.name + "」" + got + "/" + need + "：到重建站交", "normal", b ? { region: "farm", x: b.x, y: b.y + 50, label: "重建站" } : null);
    }
    if (W.kind === "caravan" && W.st === "here" && e.caravanHere?.()) add(6, "唐九带了稀罕货（到第 " + Math.floor((e.o.caravan.until || 0) / 1440) + " 天 20:00）", "gold", null);
    if (W.kind === "boss" && W.st === "on") {
      const B = SEASON_BOSSES[W.id];
      add(6, "季节头目 · " + B.name + "在" + e.regionName(W.region) + "（到第 " + (W.start + BOSS_DAYS[1] - 1) + " 天）", "warn", { region: W.region, x: W.lair.x, y: W.lair.y, label: B.name });
    }
  }
  const mk = e.marketGood?.();
  if (mk && !mk.sold && day >= START.good && !e.goodReason(mk.good)) {
    const P = POINT_BY_ID.shops;
    add(11, "旧站商街这周的稀罕货：" + GOODS[mk.good].name + "（" + GOODS[mk.good].price + " 金币）", "normal", P ? { region: P.region, x: P.x, y: P.y + 30, label: "两间铺位经营" } : null);
  }
});

// ================= 动作 =================
const ACTIONS = ["hpGive", "hpList", "hpWall2", "hpExpand", "hpPeddle", "hpSell", "hpCaravanSell"];
export function handleHopeAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, renderMenu, save } = ctx,
    id = el?.dataset?.id || "";
  if (!e?.hp) return true;
  let ok = false;
  if (action === "hpGive") ok = e.travelerGive();
  else if (action === "hpList") ok = e.weekListGive(id);
  else if (action === "hpWall2") ok = e.wall2Up(id);
  else if (action === "hpExpand") ok = e.expand(id);
  else if (action === "hpPeddle") ok = e.peddlerTrade(id === "swap" ? "swap" : "sell");
  else if (action === "hpSell") ok = e.buyerSell();
  else if (action === "hpCaravanSell") ok = e.caravanSell();
  if (ok) save();
  renderMenu();
  return true;
}
void SURVIVORS;
