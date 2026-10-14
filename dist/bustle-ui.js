// v0.28.0「热闹」的界面：顶栏的动静格；通信站的电台指令；红薯那一页的跑商；设施卡上的二选一改良；
// 伤员（居民卡、队员卡、药柜、长夜战报）；房间的舒适度（家具卡、农舍「房间与家具」那一页）；
// 广场上的食堂（不开菜单）和节庆供品；档案馆「往事」一柜；江伯的鱼汛；警报栏和日历里的这些事。
import { ITEMS, BUILDINGS } from "./data.js";
import { ALERT_HOOKS } from "./winter-ui.js";
import { RESIDENT_HOOKS, ROOM_HOOKS } from "./people-hooks.js";
import { buildingExtras as bountyExtras } from "./bounty-ui.js";
import { consequence } from "./alliance-ui.js";
import { SHOWCASES, WSPOTS } from "./winter-data.js";
import { FESTIVALS, TASTES, SSPOTS } from "./seasons-data.js";
import { NPCS } from "./outpost-data.js";
import {
  NOISE,
  RADIO_CMDS,
  RADIO_CMD_IDS,
  MULE,
  MULE_DESTS,
  UPGRADES,
  upClassOf,
  UP_PAPER,
  INJURY,
  COMFORT,
  COMFORT_CATS,
  CANTEEN2,
  FEST_PICK,
  PAST,
  FISH_RUN,
  ALLY,
} from "./bustle-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const act = (a, id, label, reason, primary = false) => button(a, id, label, reason ? `disabled title="${esc(reason)}"` : primary ? 'class="primary"' : "") + (reason ? `<small class="story-lack">${esc(reason)}</small>` : "");
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " ×" + n)
    .join("、");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const fmt = (v) => String(Math.round(v * 10) / 10);
const P = (text, cls = "") => `<p${cls ? ` class="${cls}"` : ""}>${esc(text)}</p>`;
const card = (lines, cls = "") => `<section class="td-card hn-card${cls ? " " + cls : ""}">${lines.join("")}</section>`;
const FARM = (x, y, label) => ({ region: "farm", x, y, label });
const HOME = FARM(328, 315, "农舍");

// ================= 顶栏：动静格 =================
export function noiseHud(e) {
  if (!e?.hn) return null;
  const z = e.hn.noise,
    live = e.hn.attack.state === "live";
  if (!(z.v > 0) && !live && !e.r?.radio) return null;
  const t = e.noiseTier(z.v),
    why = e.noiseWhy();
  const tone = live || (t && t.at >= 6) ? "danger" : t ? "warn" : "";
  const title =
    (live ? "循着动静来的感染者还没打完。" : "") +
    "营地动静 " +
    fmt(z.v) +
    (why ? "：今天 " + why : "") +
    "。每天 0 点结算：4 以上当夜来 3 只、6 以上 6 只、8 以上 10 只；来过一场清零，没来减半。电台、机床加急、食堂、节庆、拉响信标都会攒动静。";
  return { text: (live ? "⚠ " : "") + "动静 " + fmt(z.v), title, tone };
}

// ================= 通信站：电台指令 =================
function cmdCard(e, id) {
  const c = RADIO_CMDS[id],
    reason = e.cmdReason(id),
    left = e.cmdLeft(id);
  return `<article class="hn-cmd"><small>电 ${c.power} · 动静 +${c.noise} · 每 ${c.cd} 天一次${left ? " · 第 " + e.hn.cmd[id] + " 天再发" : ""}</small><h3>${esc(c.name)}</h3><p>${esc(c.desc)}</p>${act("hnCmd", id, "发出", reason, true)}</article>`;
}
function radioCmds(e) {
  const z = e.hn.noise,
    t = e.noiseTier(z.v),
    sc = e.hn.scout;
  const meter = `<p class="hn-meter">营地的电 ${Math.floor(e.c.energy || 0)}/100 · 营地动静 <b>${fmt(z.v)}</b>${t ? "：今夜 0 点会有 " + t.n + " 只循声摸来" : "（4 以上当夜有感染者循声摸来）"}${e.noiseWhy() ? " · 今天：" + esc(e.noiseWhy()) : ""}</p>`;
  const scout = sc.day === e.s.day && sc.text ? `<p class="hn-scout gold">今天的侦察：${esc(sc.text)}</p>` : "";
  const help = e.hn.help.armed ? `<p class="gold">雨巷的${esc(ALLY.names.join("、"))}答应了：下一场长夜或尸潮来帮你守。</p>` : e.hn.help.live ? `<p class="gold">${esc(ALLY.names.join("、"))}正在营门帮你守。</p>` : "";
  return `<section class="hn-radio"><h3>电台指令</h3>${meter}${scout}${help}<div class="story-choice">${RADIO_CMD_IDS.map((id) => cmdCard(e, id)).join("")}</div></section>`;
}
function patchRadio(e, html) {
  if (!e.r?.radio) return html;
  const out = html.replace(/（现在 [\d.]+\/4，满了会引来尸群）/g, "（营地动静现在 " + fmt(e.hn.noise.v) + "，0 点结算）");
  return out + radioCmds(e);
}

// ================= 红薯：跑商 =================
function muleView(e) {
  const m = e.hn.mule,
    o = e.o,
    mood = m.trip ? NPCS.hongshu.lines.paid : e.stockOf("radish") < 1 ? NPCS.hongshu.lines.strike : NPCS.hongshu.lines.hello;
  const head = `<header class="bt-head"><div><small>要工钱的运输骡</small><h3>红薯</h3><p>${esc(mood)}</p></div></header>`;
  if (!e.muleOpen())
    return `${head}<p>红薯每拉一趟车要 1 个萝卜当工钱，仓库或背包里没有萝卜它就罢工。${o.cargo ? "第一趟车：" + (o.convoy?.done ? "已到站" : "在路上") + "。" : "第五段的“装车”会用到它。"}第五段的车队到站以后，它每 ${MULE.every} 天能替你跑一趟买卖。</p>`;
  const log = m.log.length
    ? `<section><h3>前几趟</h3><ul class="ledger">${m.log.map((r) => `<li>第 ${r.day} 天去${esc(MULE.dest[r.dest].short)}：${r.n} 件货卖了 ${r.value}（直接出货约 ${r.ship}）${r.robbed ? "，路上被截走一半" : r.escort ? "，你跟了车" : ""}，带回 ${r.money} 金币${Object.keys(r.got || {}).length ? "和" + esc(itemsText(r.got)) : ""}</li>`).join("")}</ul></section>`
    : "";
  if (m.trip) {
    const t = m.trip,
      d = MULE.dest[t.dest],
      back = Math.floor(t.returns / 1440);
    const escort = t.escort
      ? `<p class="gold">你跟过车了：这一趟不会被截。</p>`
      : t.day === e.s.day
        ? `<p class="story-lack">想跟车：今天到${esc(e.regionName(t.map))}，把拦路的感染者打掉，这一趟就不会被截（不跟车有 ${Math.round(e.muleRobChance() * 100)}% 被截走一半）。</p>`
        : `<p class="muted">路上被截的机会：${Math.round((t.risky ? MULE.rob.risky : MULE.rob.base) * 100)}%（截走一半）。</p>`;
    return `${head}<section class="hn-mule"><h3>在路上</h3><p>去${esc(d.name)}：装了 ${e.muleCount(t.load)} 件（${esc(itemsText(t.load))}），那边能卖约 <b>${t.value}</b> 金币（直接出货约 ${t.ship}），带回：${esc(MULE.backNames[t.back])}。第 ${back} 天 08:00 回来。</p>${escort}</section>${log}`;
  }
  const p = m.plan,
    reason = e.muleReason(),
    dest = MULE.dest[p.dest];
  const dests = MULE_DESTS.map((k) => {
    const d = MULE.dest[k],
      map = e.muleMap(k),
      on = p.dest === k;
    return `<li class="${on ? "on" : ""}"><span><b>${esc(d.name)}</b><small>${esc(d.cats.map((c) => MULE.catNames[c]).join("、"))}按 ${d.mult} 倍收；有 ${esc(itemsText(d.stock))}${map && k !== "market" ? " · 去" + esc(e.regionName(map)) : ""}</small></span>${map ? button("hnMuleDest", k, on ? "就去这" : "去这", on ? 'class="primary" disabled' : "") : "<small class='story-lack'>还没去过</small>"}</li>`;
  }).join("");
  const backs = MULE.backs
    .map((k) => {
      const on = p.back === k,
        lim = k === "money" ? "" : "（那边有 " + (dest.stock[k] || 0) + "）";
      return button("hnMuleBack", k, MULE.backNames[k] + lim, on ? 'class="primary" disabled' : "");
    })
    .join("");
  const items = Object.keys({ ...e.s.storage, ...e.s.inventory, ...p.load })
    .filter((id) => e.muleLoadable(id) && (e.stockOf(id) > 0 || p.load[id]))
    .sort((a, b) => (dest.cats.includes(e.muleCat(b)) ? 1 : 0) - (dest.cats.includes(e.muleCat(a)) ? 1 : 0) || e.muleUnit(b, p.dest) - e.muleUnit(a, p.dest))
    .slice(0, 18);
  const rows = items
    .map((id) => {
      const n = p.load[id] || 0,
        unit = e.muleUnit(id, p.dest),
        ship = Math.floor(e.shipPrice ? e.shipPrice(id) : ITEMS[id].sell || 0),
        up = unit > ship;
      return `<tr><th>${esc(ITEMS[id].name)}</th><td>${e.stockOf(id)}</td><td class="${up ? "gold" : ""}">${unit}${up ? "（出货 " + ship + "）" : ""}</td><td class="hn-qty">${button("hnMuleLoad", id + ":-1", "−", n ? "" : "disabled")}<b>${n}</b>${button("hnMuleLoad", id + ":1", "+")}${button("hnMuleLoad", id + ":5", "+5")}${button("hnMuleLoad", id + ":" + MULE.max, "装满")}</td></tr>`;
    })
    .join("");
  const n = e.muleCount(),
    value = e.muleValue(p.load, p.dest),
    ship = e.muleShipValue(p.load),
    gain = ship ? Math.round(((value - ship) / ship) * 100) : 0;
  const sum = `<p class="hn-sum">车上 <b>${n}/${MULE.max}</b> 件 · 那边能卖约 <b>${value}</b> 金币${n ? "（直接出货约 " + ship + "，" + (gain >= 0 ? "多 " : "少 ") + Math.abs(gain) + "%）" : ""} · 工钱 1 个萝卜 · 路上被截 ${Math.round(e.muleRobChance() * 100)}%（截走一半；出发当天你跟车就不会被截）</p>`;
  return `${head}<section class="hn-mule"><h3>去哪卖</h3><ul class="bt-list">${dests}</ul><h3>带回什么</h3><div class="button-row">${backs}</div><p class="muted">卖得的钱先按当地的价换你点的材料（看当地存货），剩下的带回金币。</p><h3>装车（最多 ${MULE.max} 件）</h3>${rows ? `<div class="g-table"><table><thead><tr><th>货</th><th>有</th><th>那边一件</th><th>装几件</th></tr></thead><tbody>${rows}</tbody></table></div>` : "<p class='muted'>仓库里没有能卖的货。</p>"}${sum}<div class="button-row">${act("hnMuleGo", "", "出发（第 " + (e.s.day + MULE.every) + " 天 08:00 回来）", reason, true)}</div></section>${log}`;
}

// ================= 设施卡：改良、舒适度、药柜 =================
function upgradeBlock(e, b, cls) {
  const U = UPGRADES[cls],
    path = e.upPath(cls),
    lines = [];
  if (!path) {
    const credits = e.c.researchCredits || 0,
      papers = e.stockOf(UP_PAPER.item);
    lines.push(`<h4>改良（二选一）</h4><p class="muted">花 1 张蓝图凭证（现在 ${credits} 张${papers ? "，改良图纸 " + papers + " 张" : ""}）给${esc(U.name)}选一条路线，选了就不能换；之后每座再花${esc(itemsText(U.cost))}。</p>`);
    lines.push(
      `<div class="story-choice hn-paths">${Object.entries(U.paths)
        .map(([k, x]) => `<article><h3>${esc(x.name)}</h3><p>${esc(x.text)}</p>${act("hnUpPath", cls + ":" + k, "选这条", e.unlockReason(cls, k))}</article>`)
        .join("")}</div>`,
    );
    return lines.join("");
  }
  const X = U.paths[path];
  lines.push(`<h4>改良 · ${esc(X.name)}</h4>`);
  if (b.hnUp) lines.push(P("这座已经改成「" + X.name + "」：" + X.text + "。", "gold"));
  else lines.push(`<div class="button-row">${act("hnUpBuild", b.id, "改成「" + X.name + "」（" + itemsText(U.cost) + "）", e.upgradeReason(b), true)}</div><p class="muted">${esc(X.text)}。</p>`);
  if (cls === "fence") {
    const near = e.fenceBatch(b).length;
    if (near) lines.push(`<div class="button-row">${button("hnUpFences", b.id, "附近还没改的 " + near + " 段一起改（每段" + itemsText(U.cost) + "）")}</div>`);
  }
  if (cls === "tower" && path === "twin") {
    const twins = e.twinTowers?.() || [];
    lines.push(P("双人哨要守卫比塔多：多出来的人站到双人哨上，每天晚饭多吃 1 份干粮。现在有两个人守的：" + twins.length + " 座。", "muted"));
  }
  return lines.join("");
}
function roomOf(e, b) {
  if (!e.roomInfo) return null;
  if (b.type === "floor") return e.roomInfo(b);
  const floor = e.s.buildings.filter((x) => x.type === "floor" && x.hp > 0 && dist(x, b) < 75).sort((a, c) => dist(a, b) - dist(c, b))[0];
  return floor ? e.roomInfo(floor) : null;
}
function comfortLine(e, room) {
  const c = e.roomComfort(room),
    have = e.comfortList(room),
    miss = COMFORT_CATS.filter((k) => !room.types.includes(k)).map((k) => COMFORT.cats[k]);
  const home = e.homeRoom()?.floor === room.floor;
  const fx = [
    home ? "你睡完觉「休息好」" + (COMFORT.rested.base + c) + " 个钟点" : "",
    c >= COMFORT.ladder ? "够生活水准第 3 级" : "舒适度 " + COMFORT.ladder + " 够生活水准第 3 级",
    c >= COMFORT.moodAt ? "大家该有的心情 +" + COMFORT.mood : "舒适度 " + COMFORT.moodAt + " 起大家该有的心情 +" + COMFORT.mood,
    "在这歇着的居民疲劳每小时多降 " + fmt(c * COMFORT.restFatigue),
  ].filter(Boolean);
  return `<p class="hn-comfort"><b>舒适度 ${c}/${COMFORT.max}</b>：${esc(have.join("、") || "还没有家具")}${miss.length ? "；还能添 " + esc(miss.join("、")) : ""}。</p><p class="muted">${esc(fx.join("；"))}。</p>`;
}
// 一间房的用处：书架是学习室、餐桌是食堂、床和药柜是医务室，摆在一间就都算
function roomUses(room) {
  const t = room.types,
    out = [];
  if (room.type === "医务室") out.push("医务室（伤员躺进来，用绷带 1 天就好）");
  if (t.includes("bookshelf")) out.push("阅览室（当学习室用：带徒、改学职能快一倍）");
  if (t.includes("table")) out.push("食堂（在这里吃的晚饭多算一种菜：「吃得好」少要一样）");
  if (!out.length) out.push(room.type);
  return out;
}
function hurtRows(e) {
  const list = Object.entries(e.hn.hurt);
  if (!list.length) return "<p class='muted'>现在没有伤员。</p>";
  return `<ul class="bt-list">${list
    .map(([k, h]) => {
      const left = Math.ceil(e.hurtLeft(k) / 60);
      return `<li><span><b>${esc(h.name)}</b><small>还要养 ${left} 个钟点${h.care ? "（用过" + (h.care === "medkit" ? "药包" : "绷带") + "）" : ""}</small></span><span class="bt-btns">${h.care ? "" : act("hnTreat", k + "|bandage", "绷带（1 天好）", e.treatReason(k, "bandage")) + act("hnTreat", k + "|medkit", "药包（下午就好）", e.treatReason(k, "medkit"))}</span></li>`;
    })
    .join("")}</ul>`;
}
function infirmaryBlock(e) {
  const room = e.infirmary();
  return `<h4>伤员</h4>${room ? "" : "<p class='story-lack'>还没有医务室：一块地板 75 步内摆一张居民床和一个药柜。没有医务室只能用药包。</p>"}${hurtRows(e)}`;
}
const ROOM_TYPES = ["floor", "chair", "lamp", "bookshelf", "table", "harvestTrophy", "bed", "stove", "medCabinet", "hnKeepsake"];
export function buildingExtras(e, b) {
  const base = bountyExtras(e, b);
  if (!e?.hn || !b || !BUILDINGS[b.type]) return base;
  const out = [];
  const cls = upClassOf(b.type);
  if (cls) out.push(card([upgradeBlock(e, b, cls)], "hn-up"));
  if (ROOM_TYPES.includes(b.type)) {
    const room = roomOf(e, b),
      lines = [];
    if (b.type === "medCabinet") lines.push(P("药柜放在房间地板 75 步内，旁边再有一张居民床，这间就是医务室：伤员躺进来，用 1 条绷带 1 天就好。"));
    if (b.type === "hnKeepsake") lines.push(P("档案馆「往事」一柜填满后苏砚送的，只有一件。放进房间算一样家具。"));
    if (room?.active) {
      lines.push(P("这间是" + roomUses(room).join("，也是") + "。"));
      lines.push(comfortLine(e, room));
    } else if (room) lines.push(P("这间房还没成形：地板 75 步内要有木椅和暖光灯（医务室是床和药柜）。", "muted"));
    if (b.type === "medCabinet" || room?.type === "医务室") lines.push(infirmaryBlock(e));
    if (lines.length) out.push(card(lines, "hn-room"));
  }
  if (b.type === "solar") out.push(card([P("电台指令也用电：侦察 3、空投 5、呼叫商队 6、求援 10。", "muted")]));
  return base + out.join("");
}
// 工作台页（篝火灶）上的改良
export function stationExtras(e, b) {
  if (!e?.hn || !b || b.type !== "cook") return "";
  return card([upgradeBlock(e, b, "cook")], "hn-up");
}
// 水网那一页：雨水桶、喷灌头的改良（雨水桶按 E 是补水，改良放在这里）
function patchWater(e, html) {
  const barrels = e.s.buildings.filter((b) => b.type === "rain" && b.hp > 0),
    heads = e.s.buildings.filter((b) => b.type === "irrigation" && b.hp > 0);
  if (!barrels.length && !heads.length) return html;
  const row = (b, cls) => {
    const U = UPGRADES[cls],
      path = e.upPath(cls);
    const right = !path
      ? Object.entries(U.paths)
          .map(([k, x]) => act("hnUpPath", cls + ":" + k, "选「" + x.name + "」", e.unlockReason(cls, k)))
          .join("")
      : b.hnUp
        ? "<small class='gold'>已改成「" + esc(U.paths[b.hnUp].name) + "」</small>"
        : act("hnUpBuild", b.id, "改成「" + U.paths[path].name + "」（" + itemsText(U.cost) + "）", e.upgradeReason(b));
    return `<li><span><b>${esc(BUILDINGS[b.type].name)}</b><small>${path ? esc(U.paths[path].text) : esc(Object.values(U.paths).map((x) => x.name + "：" + x.text).join("；"))}</small></span><span class="bt-btns">${right}</span></li>`;
  };
  return html + `<section><h3>改良</h3><p class="muted">每类花 1 张蓝图凭证选一条路线（选了不能换），之后每座再花材料。</p><ul class="bt-list">${[...barrels.map((b) => row(b, "rain")), ...heads.map((b) => row(b, "irrigation"))].join("")}</ul></section>`;
}

// ================= 居民卡、队员卡：受伤 =================
RESIDENT_HOOKS.push((e, r) => {
  if (!e?.hn || !r) return "";
  const k = "r:" + r.id,
    h = e.hn.hurt[k];
  if (!h) return "";
  return `<div class="hn-hurt"><p class="story-lack">受伤了：还要养 ${Math.ceil(e.hurtLeft(k) / 60)} 个钟点，干不了活，心情 ${INJURY.mood}。${h.care ? "用过" + (h.care === "medkit" ? "药包" : "绷带") + "了。" : ""}</p>${h.care ? "" : `<div class="button-row">${act("hnTreat", k + "|bandage", "绷带（医务室，1 天好）", e.treatReason(k, "bandage"))}${act("hnTreat", k + "|medkit", "药包（今天下午就好）", e.treatReason(k, "medkit"))}</div>`}</div>`;
});
function crewHurt(e, id) {
  const k = "c:" + id,
    h = e.hn?.hurt[k];
  if (!h) return "";
  return card([`<p class="story-lack">${esc(h.name)}受伤了：还要养 ${Math.ceil(e.hurtLeft(k) / 60)} 个钟点，守不了营门。</p>`, h.care ? "" : `<div class="button-row">${act("hnTreat", k + "|bandage", "绷带（医务室，1 天好）", e.treatReason(k, "bandage"))}${act("hnTreat", k + "|medkit", "药包（今天下午就好）", e.treatReason(k, "medkit"))}</div>`]);
}
// 长夜战报：这一夜谁伤了、邻居打倒几只
function patchNight(e, html) {
  const r = e.ln?.last;
  if (!r) return html;
  const from = r.day * 1440 + 18 * 60,
    to = from + 14 * 60;
  const hurt = Object.entries(e.hn.hurt).filter(([, h]) => h.at >= from && h.at <= to);
  if (!hurt.length) return html;
  return html + `<section class="td-card"><p class="story-lack">这一夜受伤的：${esc(hurt.map(([, h]) => h.name).join("、"))}。早上到医务室分药：绷带 1 天好，药包今天下午就好。</p></section>`;
}

// ================= 农舍「房间与家具」：舒适度 =================
ROOM_HOOKS.push((e) => {
  if (!e?.hn || !e.rooms) return "";
  const rooms = e.rooms();
  const rows = rooms.length
    ? rooms
        .map((r) => {
          const c = e.roomComfort(r);
          return `<div class="resident-line"><b>${esc(roomUses(r).map((x) => x.replace(/（.*$/, "")).join(" · "))}</b><span>舒适度 ${c}/${COMFORT.max}</span><small>${esc(e.comfortList(r).join("、") || "还没成形")}</small></div>`;
        })
        .join("")
    : "<p>还没有房间。</p>";
  const home = e.homeRoom(),
    rest = e.restedNow() ? "现在「休息好」：还有 " + Math.ceil(e.restedLeft() / 60) + " 个钟点。" : "";
  const build = ["medCabinet", "hnKeepsake"]
    .filter((id) => id !== "hnKeepsake" || (e.hn.past.pick === "keepsake" && !e.s.buildings.some((b) => b.type === "hnKeepsake")))
    .map((id) => `<div>${esc(BUILDINGS[id].name)}<small>${esc(itemsText(BUILDINGS[id].cost) || "免费")}</small>${button("build", id, "建造")}</div>`)
    .join("");
  return `<article class="frontier-card"><h3>舒适度和「休息好」</h3><p>房间里每类家具算 1 分（${esc(Object.values(COMFORT.cats).join("、"))}），同类只算一件，最多 ${COMFORT.max} 分。${home ? "你睡觉时边上最好的那间舒适度 " + e.roomComfort(home) + "：睡醒「休息好」" + (COMFORT.rested.base + e.roomComfort(home)) + " 个钟点（体力恢复快五成，经验多一成）。" : "农舍边上还没有布置好的房间：睡醒没有「休息好」。"}${rest}</p>${rows}<p class="muted">舒适度 ${COMFORT.ladder} 以上够生活水准第 3 级；${COMFORT.moodAt} 以上大家该有的心情 +${COMFORT.mood}。阅览室当学习室用：带徒、改学职能快一倍；有餐桌的是食堂，在这里吃的晚饭多算一种菜；地板边摆床和药柜就是医务室。</p><div class="furniture-list">${build}</div></article>`;
});

// ================= 广场：食堂和节庆供品 =================
function canteenCard(e) {
  const n = e.ss.canteen.night;
  const guests = n.customers
    .map((g) => {
      if (g.state !== "waiting") return `<li class="guest ${g.state}"><b>${esc(g.name)}</b><span>${g.state === "served" ? "吃完了" : "走了"}</span></li>`;
      const left = Math.max(0, 1 - g.waited / g.patience),
        want = g.dish && ITEMS[g.dish] ? ITEMS[g.dish].name : TASTES[g.taste].name,
        have = g.dish ? e.stockOf(g.dish) : 0;
      return `<li class="guest"><div><b>${esc(g.name)}</b><small>想吃${esc(want)}（${esc(TASTES[g.taste].name)}）${have ? " · 有 " + have + " 份" : " · 没有现成的：同口味的也行"}</small><span class="patience"><i style="width:${Math.round(left * 100)}%"></i></span></div></li>`;
    })
    .join("");
  const carry = e.hn.carry ? "手里端着" + ITEMS[e.hn.carry.dish].name + "。" : "";
  return `<article class="current canteen-live"><small>营业中 · 第 ${n.spawned}/${e.canteenMax(n)} 位客人 · 21:30 打烊</small><h3>前哨食堂</h3><p class="gold">不开菜单：到何大勺的灶台（广场西头）按 E 端起菜，走到客人跟前按 E 上菜。${esc(carry)}</p><ul class="guests">${guests}</ul><p>收入 ${n.income} 金币 · 招待 ${n.served} 位 · 走了 ${n.missed} 位。有客人吃上的这晚，营地里的人也在食堂吃，士气 +${CANTEEN2.mood}。</p></article>`;
}
function festPicker(e) {
  if (!e.isFestivalDay?.() || e.festivalHosted?.()) return "";
  const kind = e.festivalKind(),
    picked = e.festPicked(kind),
    pay = e.festivalPay(kind),
    tier = e.festTier(kind, pay),
    m = FEST_PICK.morale[tier];
  let body = "";
  if (kind === "harvest" || kind === "seeds") {
    const list = e.festPickable(kind);
    body = list.length
      ? `<div class="hn-picks">${list
          .slice(0, 14)
          .map((id) => button("hnFestPick", id, (picked.includes(id) ? "✓ " : "") + ITEMS[id].name + " ×" + e.qty(id, true), picked.includes(id) ? 'class="primary"' : ""))
          .join("")}</div><p class="muted">挑 ${FEST_PICK[kind].n} 样（每样 ${FEST_PICK[kind].each} 份${kind === "harvest" ? "，巨型作物 1 个" : ""}）。${picked.length < FEST_PICK[kind].n ? "没挑满就照原来的办法，拿仓库里最多的几样。" : ""}</p>`
      : "<p class='story-lack'>仓库里凑不出来。</p>";
  } else {
    body = `<div class="hn-picks">${(FEST_PICK[kind] || [])
      .map((o) => {
        const lack = Object.entries(o.cost).some(([k, n]) => e.stockOf(k) < n),
          on = picked[0] === o.id;
        return button("hnFestPick", o.id, (on ? "✓ " : "") + o.name + "（" + itemsText(o.cost) + "）", on ? 'class="primary"' : lack ? 'disabled title="不够"' : "");
      })
      .join("")}</div>`;
  }
  return `<div class="hn-fest"><b>${kind === "lanterns" ? "挑灯油" : kind === "vigil" ? "挑供品" : kind === "seeds" ? "挑要换的种子" : "挑三样菜去评比"}</b>${body}<p class="${m > 0 ? "gold" : "story-lack"}">大家会觉得：${esc(FEST_PICK.words[tier])}（全营士气 ${m > 0 ? "+" : ""}${m}）</p></div>`;
}
function patchPlaza(e, html) {
  let out = html;
  if (e.ss?.canteen.night) out = out.replace(/<article class="current canteen-live">[\s\S]*?<\/article>/, canteenCard(e));
  const pick = festPicker(e);
  if (pick) {
    const at = out.indexOf('<ul class="fest-stars">');
    out = at > 0 ? out.slice(0, at) + pick + out.slice(at) : out + pick;
  }
  return out;
}

// ================= 档案馆：「往事」一柜 =================
function pastCard(e) {
  const m = e.w.museum,
    here = e.museumHere(),
    done = e.pastDone(),
    pick = e.hn.past.pick;
  const shelves = PAST.cats
    .map((cat) => {
      const can = e.donatable(cat),
        items = m[cat].map((id) => `<span class="exhibit">${esc(e.exhibitName(cat, id))}</span>`).join("");
      return `<div class="hn-shelf"><small>${esc(SHOWCASES[cat].name)} ${Math.min(m[cat].length, e.showcaseNeed(cat))}/${e.showcaseNeed(cat)}</small><p class="exhibits">${items || "<span class='muted'>还空着</span>"}</p>${can.length ? `<div class="button-row">${can
        .slice(0, 4)
        .map((id) => button("wDonate", cat + ":" + id, "捐：" + e.exhibitName(cat, id), here ? "" : "disabled"))
        .join("")}</div>` : ""}</div>`;
    })
    .join("");
  const reward = pick
    ? P("回礼已经挑了：" + PAST.rewards[pick].name + "（" + PAST.rewards[pick].text + "）。", "gold")
    : done
      ? `<div class="story-choice">${Object.entries(PAST.rewards)
          .map(([k, r]) => `<article><h3>${esc(r.name)}</h3><p>${esc(r.text)}</p>${act("hnPast", k, "要这个", e.pastReason(k), true)}</article>`)
          .join("")}</div>`
      : P("三层都摆满（" + e.pastHave() + "/" + e.pastNeed() + "），挑一样回礼：往事陈列柜（算舒适度的摆设），或老地图（蓝图凭证 +2、声望 +10）。", "muted");
  return `<article class="${pick ? "done" : ""} hn-past"><small>${e.pastHave()}/${e.pastNeed()}</small><h3>往事</h3>${consequence({ cost: "不花（捐记录）", gain: "填满挑一样回礼", effect: "日志、照片、遗物三个柜并成了这一柜" })}${shelves}${reward}</article>`;
}
function patchMuseum(e, html) {
  const names = PAST.cats.map((c) => SHOWCASES[c].name);
  const parts = html.split("<article");
  if (parts.length < 2) return html;
  const keep = [parts[0]];
  let placed = false;
  for (const seg of parts.slice(1)) {
    const h = /<h3>([^<]*)<\/h3>/.exec(seg)?.[1];
    if (names.includes(h)) {
      if (!placed) {
        // 这一段的 </article> 后面可能还连着别的东西（比如容器的结尾），留着
        const end = seg.indexOf("</article>");
        keep.push(pastCard(e).slice("<article".length) + (end >= 0 ? seg.slice(end + "</article>".length) : ""));
        placed = true;
      } else {
        const end = seg.indexOf("</article>");
        if (end >= 0) keep[keep.length - 1] += seg.slice(end + "</article>".length);
      }
      continue;
    }
    keep.push(seg);
  }
  return keep.join("<article");
}

// ================= 江伯 =================
function jiangView(e) {
  const day = e.s.day,
    next = e.nextFishRun(day),
    today = e.fishRunDay(day);
  const line = today ? "今天" + ITEMS[e.fishRunKind(day)].name + "成群，去池塘下竿，钓上来一条多给一条。" : next ? "第 " + next + " 天" + ITEMS[e.fishRunKind(next)].name + "要来，多一倍。" : "鱼会回来的。";
  const runs = [];
  for (let d = day, k = 0; d < day + 22 && k < 3; d++) if (e.fishRunDay(d)) runs.push("第 " + d + " 天：" + ITEMS[e.fishRunKind(d)].name), k++;
  return `<header class="bt-head"><div><small>老渔夫 · 留在池塘边</small><h3>江伯</h3><p>“${esc(line)}”</p></div></header><p>委托做完以后江伯没走：每 ${FISH_RUN.every} 天报一次鱼汛，那天那种鱼钓上来多一条。</p><ul class="ledger">${runs.map((t) => `<li>${esc(t)}</li>`).join("")}</ul><p class="muted">林边池塘按 E 抛竿。银鳞鱼白天多，蓝背鱼下雨天多，夜鱼夜里多。</p>`;
}

// ================= 警报栏 =================
ALERT_HOOKS.push((e, add) => {
  if (!e?.hn) return;
  const day = e.s.day,
    m = e.s.minute,
    a = e.hn.attack;
  if (a.state === "live") add(1, "循声来的感染者：还有 " + e.noiseAlive().length + " 只", "danger", FARM(1240, 470, "营地"));
  const t = e.noiseTier();
  if (t && m >= 18 * 60 && !e.noiseBlocked()) add(4, "营地动静 " + fmt(e.hn.noise.v) + "：今夜 0 点会有 " + t.n + " 只循声摸来", "warn", null);
  if (e.hn.help.live) add(3, "雨巷的" + ALLY.names.join("、") + "在营门帮你守", "gold", FARM(ALLY.post.x, ALLY.post.y, "营门"));
  const hurt = Object.keys(e.hn.hurt).length;
  if (hurt) {
    const room = e.infirmary(),
      open = Object.values(e.hn.hurt).filter((h) => !h.care).length;
    add(open ? 5 : 8, hurt + " 人受伤" + (open ? "：分药（" + (room ? "医务室里绷带 1 天好，" : "") + "药包下午就好）" : "，在养伤"), open ? "warn" : "normal", room ? FARM(room.floor.x, room.floor.y, "医务室") : HOME);
  }
  const d = e.hn.drop;
  if (d && !d.opened && d.until >= day) add(6, "空投箱在" + e.regionName(d.region) + "（第 " + d.until + " 天前去拿" + (e.absNow() - d.at > 240 ? "，已经围了感染者" : "") + "）", "gold", { region: d.region, x: d.x, y: d.y, label: "空投箱" });
  const tr = e.hn.mule.trip;
  if (tr && !tr.escort && tr.day === day) add(6, "跟车：今天到" + e.regionName(tr.map) + "打掉拦路的，红薯这一趟就不会被截", "normal", { region: tr.map, x: 700, y: 500, label: "红薯的车" });
  if (e.jiangStays?.()) {
    if (e.fishRunDay(day)) add(7, "鱼汛：今天" + ITEMS[e.fishRunKind(day)].name + "多一倍（池塘按 E）", "gold", FARM(1040, 820, "池塘"));
    else if (m >= FISH_RUN.warnAt && e.fishRunDay(day + 1)) add(8, "江伯：明天" + ITEMS[e.fishRunKind(day + 1)].name + "鱼汛", "normal", FARM(FISH_RUN.spot.x, FISH_RUN.spot.y, "江伯"));
  }
  if (e.pastDone() && !e.hn.past.pick && e.w?.museum.built) add(8, "「往事」一柜填满了：到档案馆挑回礼", "gold", FARM(WSPOTS.museum.x, WSPOTS.museum.y, "档案馆"));
  if (e.restedNow()) add(9, "休息好：还有 " + Math.ceil(e.restedLeft() / 60) + " 个钟点（体力快五成、经验多一成）", "gold", null);
});

// ================= 日历：鱼汛、红薯回来 =================
export function patchCalendar(e, html) {
  if (!e?.hn) return html;
  let out = html;
  const tagAt = (d, cls, text) => {
    const mark = "<b>第" + d + "天</b>",
      at = out.indexOf(mark);
    if (at < 0) return;
    const rest = out.slice(at + mark.length).replace(/^<span class="tag quiet">—<\/span>/, "");
    out = out.slice(0, at + mark.length) + '<span class="tag ' + cls + '">' + esc(text) + "</span>" + rest;
  };
  const tr = e.hn.mule.trip;
  for (let d = e.s.day; d < e.s.day + 14; d++) {
    if (e.jiangStays?.() && e.fishRunDay(d)) tagAt(d, "gold", "鱼汛");
    if (tr && Math.floor(tr.returns / 1440) === d) tagAt(d, "", "红薯回来");
  }
  return out;
}

// ================= 视图、标题、动作 =================
const TITLES = { hnJiang: "江伯 · 鱼汛" };
export function bustleTitle(ui, fallback) {
  if (ui?.view === "dialog" && ui.id === "hongshu") return "红薯 · 跑商";
  return TITLES[ui?.view] || fallback(ui);
}
export function renderBustleView(e, ui, base) {
  if (!e?.hn || !ui) return base(e, ui);
  let body = null;
  if (ui.view === "hnJiang") body = jiangView(e);
  else if (ui.view === "dialog" && ui.id === "hongshu") body = muleView(e);
  if (body !== null) return `<div class="outpost-page view-${esc(ui.view)} bt-page hn-page">${body}</div>`;
  let html = base(e, ui);
  if (ui.view === "radio") html = patchRadio(e, html);
  else if (ui.view === "plaza") html = patchPlaza(e, html);
  else if (ui.view === "museum") html = patchMuseum(e, html);
  else if (ui.view === "bWater") html = patchWater(e, html);
  else if (ui.view === "crew") html = html + crewHurt(e, ui.id);
  else if (ui.view === "lnight") html = patchNight(e, html);
  else if (ui.view === "calendar") html = patchCalendar(e, html);
  return html;
}
const ACTIONS = ["hnCmd", "hnMuleDest", "hnMuleBack", "hnMuleLoad", "hnMuleGo", "hnUpPath", "hnUpBuild", "hnUpFences", "hnTreat", "hnFestPick", "hnPast", "hnView"];
export function handleBustleAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, showMenu, closeMenu, renderMenu, save } = ctx,
    id = el?.dataset?.id || "";
  if (!e?.hn) return true;
  let ok = false,
    close = false;
  if (action === "hnView") {
    showMenu("outpost", { view: id, id: "" });
    return true;
  }
  if (action === "hnCmd") ok = e.radioCmd(id);
  else if (action === "hnMuleDest") ok = e.muleSet("dest", id);
  else if (action === "hnMuleBack") ok = e.muleSet("back", id);
  else if (action === "hnMuleLoad") {
    const at = id.lastIndexOf(":");
    ok = e.muleAdjust(id.slice(0, at), Number(id.slice(at + 1)) || 0);
  } else if (action === "hnMuleGo") {
    ok = e.muleGo();
    close = ok;
  } else if (action === "hnUpPath") {
    const [cls, path] = id.split(":");
    ok = e.unlockPath(cls, path);
  } else if (action === "hnUpBuild") ok = e.upgradeBuilding(id);
  else if (action === "hnUpFences") ok = e.upgradeFences(id);
  else if (action === "hnTreat") {
    const [key, item] = id.split("|");
    ok = e.treat(key, item);
  } else if (action === "hnFestPick") ok = e.festPick(id);
  else if (action === "hnPast") ok = e.pastChoose(id);
  if (ok) save();
  if (ok && close) closeMenu();
  else renderMenu();
  return true;
}
