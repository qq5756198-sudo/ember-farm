// v0.42.0「删繁」的界面：去掉的东西不再出现在页面上，并到一起的写成一样。
// · 田边选种、这块田、菜地告示牌重写：只剩种、浇、收和一种肥（没有照料分、肥力、搭配、杂草、虫、盖布、水网）；
// · 通信站只听广播；堆肥桶只出一种肥；腌缸也能酿酒；麦穗只要摸；法令、偷东西、夜里的抉择那几页换成一句“去掉了”；
// · 消息里多一条“这次简化退回了什么”；技能页写明天赋自己学；设施卡上没有改良、舒适度、房间、医务室；
// · 建造页的“摆件”一格挑样子；农舍那一页放农舍扩建和「休息好」；地区和前哨的仓库那一页换成休整点；
// · 顶栏不再有动静，菜单最上面一行多一个全营士气。
import { ITEMS, CROPS, BUILDINGS, REGIONS } from "./data.js";
import { COMPOST, GIANT, REGROW, STORM, ORDERS, DEX } from "./bounty-data.js";
import { seasonOf, seasonDay, CROP_SEASON, SEASON_RATE, SEASON_EXTRA } from "./almanac-data.js";
import { cropInfo, WEATHER_WORD } from "./garden-data.js";
import { DOG_SKILLS, DOG_MAX } from "./farlands-data.js";
import { EXPAND, EXPAND_NAMES, GOODS, GOOD_IDS, START } from "./hope-data.js";
import { FEATURES } from "./seasons-data.js";
import { BMAPS } from "./beyond-data.js";
import { STRIP, MESSAGE_VIEWS, SX_LABELS } from "./simple-ui.js";
import { almanacBuildExtras } from "./almanac-ui.js";
import { dexBlock } from "./bounty-ui.js";
import { DECOR_LOOKS, DECOR_SPECIAL, FERT, MORALE, MORALE_TEXT, CONVERT_TITLE, SPRINKLE, CANAL_R, JAR_ANY, jarRecipe, REST } from "./trim-data.js";

const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const dis = (reason) => (reason ? `disabled title="${esc(reason)}"` : "");
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const act = (a, id, label, reason, primary = false) => button(a, id, label, reason ? dis(reason) : primary ? 'class="primary"' : "") + (reason ? `<small class="story-lack">${esc(reason)}</small>` : "");
const P = (text, cls = "") => `<p${cls ? ` class="${cls}"` : ""}>${esc(text)}</p>`;
const card = (lines, cls = "") => `<section class="td-card tr-card${cls ? " " + cls : ""}">${lines.join("")}</section>`;
const word = (w) => WEATHER_WORD[w] || w || "—";
const cropName = (c) => CROPS[c]?.name || c;
const ripeOf = (p) => !!p?.crop && !!CROPS[p.crop] && p.growth >= CROPS[p.crop].grow;
const pct = (r) => Math.round(Math.abs(r - 1) * 100);
const stock = (e, id) => (e.s.inventory?.[id] || 0) + (e.s.storage?.[id] || 0);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const realTime = (hours) => {
  const sec = (hours * 60) / 1.6;
  return sec < 90 ? "现实约 " + Math.max(10, Math.round(sec / 10) * 10) + " 秒" : "现实约 " + Math.round(sec / 60) + " 分钟";
};
const costText = (cost) =>
  Object.entries(cost || {})
    .map(([k, n]) => (k === "gold" ? n + " 金币" : (ITEMS[k]?.name || k) + " " + n))
    .join("、");
const safe = (fn, d) => {
  try {
    return fn();
  } catch {
    return d;
  }
};

// ================= 这一层改的几句话（第一次画删繁的引擎时改一次；下面几层自己的测试不碰） =================
let uiOn = false;
function applyTrimUi() {
  if (uiOn) return;
  uiOn = true;
  SX_LABELS.dog = "麦穗 · 摸摸它";
  if (FEATURES.people) FEATURES.people.intro = "每个人的信任、这会儿在哪、喜欢什么讨厌什么、心里话。每人 7 天最多送 2 次，要走到人跟前送。";
  if (FEATURES.radio) Object.assign(FEATURES.radio, { name: "通信站", intro: "每天早上 7 点播一回广播：明天的天气、今天废墟里的事、十凶的传闻。" });
  // 消息里多一条：这次简化退回了什么（新开的档没有这一条）
  if (!MESSAGE_VIEWS.some(([id]) => id === "trConv")) MESSAGE_VIEWS.splice(1, 0, ["trConv", CONVERT_TITLE]);
  // 画完以后拿掉的：援建营地的居民页（心情、伤、法令簿、生活水准），地区、前哨的存取、预留、托运
  for (const k of ["camp:residents", "rebuild:residents"]) STRIP[k] = [...(STRIP[k] || []), ".td-mood", ".hn-hurt", '[data-action="wView"][data-id="decrees"]', ".ladder-row", ".ladder", ".ladder-need", ".winter-card"];
  STRIP.districts = [...(STRIP.districts || []), '[data-action="dDeposit"]', '[data-action="dWithdraw"]', '[data-action="dReserve"]'];
  STRIP.beyond = [...(STRIP.beyond || []), '[data-action="bDeposit"]', '[data-action="bWithdraw"]', '[data-action="bWithdrawAll"]', '[data-action="bShip"]', '[data-action="bStoreTrack"]'];
}
// 是删繁的引擎：页面照这一层画（第一次时把上面那几句改好）
function on(e) {
  if (!e?.tr) return false;
  applyTrimUi();
  return true;
}
export const trimUiOn = () => uiOn;

// ================= 拿掉一段 HTML 的小工具 =================
// 拿掉 data-action 是这几样的按钮
export function dropActions(html, actions) {
  if (!html || !actions.length) return html;
  const re = new RegExp(`<button\\b[^>]*data-action="(?:${actions.join("|")})"[^>]*>[\\s\\S]*?<\\/button>`, "g");
  return html.replace(re, "");
}
// 从 start 那个标签开始，配对到它的结束标签，返回结束位置（找不到返回 -1）
function blockEnd(html, start, tag) {
  const scan = new RegExp(`<(\\/?)${tag}\\b[^>]*>`, "g");
  scan.lastIndex = start;
  let depth = 0,
    t;
  while ((t = scan.exec(html))) {
    depth += t[1] ? -1 : 1;
    if (depth === 0) return t.index + t[0].length;
  }
  return -1;
}
// 拿掉 class 里带着这一个（或这几个连着的）名字的整块（同名标签按层数配对）
export function dropBlock(html, cls) {
  if (!html) return html;
  const open = new RegExp(`<(section|div|article|p|ul|li|details|dl|aside|header|span)\\b[^>]*class="(?:[^"]*\\s)?${cls}(?:\\s[^"]*)?"[^>]*>`, "g");
  let out = html,
    m,
    guard = 0;
  while ((m = open.exec(out)) && guard++ < 60) {
    const start = m.index,
      end = blockEnd(out, start, m[1]);
    if (end < 0) break;
    out = out.slice(0, start) + out.slice(end);
    open.lastIndex = start;
  }
  return out;
}

// ================= 田边选种 =================
function seasonTag(e, crop) {
  const k = e.seasonKind?.(crop) || "";
  if (k === "good") return `<span class="g-tag good">当季 快 ${pct(SEASON_RATE.good)}% · 多收 ${SEASON_EXTRA} 份</span>`;
  if (k === "bad") return `<span class="g-tag bad">反季 长得慢 ${pct(SEASON_RATE.bad)}%（温室里不受影响）</span>`;
  return "";
}
function weatherTags(e, crop) {
  const info = cropInfo(crop),
    w = e.s.weather;
  return [info.likes ? `<span class="g-tag${info.likes === w ? " good" : ""}">喜欢${esc(word(info.likes))}${info.likes === w ? " · 今天" : ""}</span>` : "", info.hates ? `<span class="g-tag${info.hates === w ? " bad" : ""}">怕${esc(word(info.hates))}${info.hates === w ? " · 今天" : ""}</span>` : ""].join("");
}
function viewPick(e, ui) {
  const p = e.plotById(ui.id),
    why = p ? e.pickReason(p) : "这块田不在这里";
  if (!p || why) return `<p>${esc(why || "这块田不在这里。")}</p>`;
  const opts = e.seedOptions(p),
    packs = safe(() => e.mysteryCount?.(), 0) || 0;
  const head = `<header class="g-head"><div><small>第 ${e.s.plots.indexOf(p) + 1} 块田</small><h3>种点什么？</h3><p>今天${esc(word(e.s.weather))}。点一种种子，或按数字键。</p></div></header>`;
  const mystery = packs ? `<div class="bt-mystery"><div class="button-row">${button("btMystery", p.id, "种一包神秘种子（有 " + packs + " 包）", 'class="primary"')}</div><small>拆开才知道：多半是普通的菜，二十包里有一包是新品种（金萝卜、冬土豆、夜光豆）。</small></div>` : "";
  if (!opts.length) return head + `<p class="story-lack">背包和仓库里${packs ? "没有普通种子" : "都没有种子"}：去集市找林姨买，或者从柜子、每日抉择里拿。</p>${mystery}<div class="button-row">${button("close", "", "知道了")}</div>`;
  const rows = opts
    .map((o, i) => {
      const c = CROPS[o.crop],
        hours = e.growHours(p, o.crop, null),
        more = e.seasonKind?.(o.crop) === "good" ? SEASON_EXTRA : 0;
      return `<li><button class="seed-opt" data-action="gPlant" data-id="${esc(p.id + "|" + o.id)}" data-hotkey="${i + 1}"><span class="seed-no">${i + 1}</span><span class="seed-main"><b>${esc(ITEMS[o.id].name)}</b><small>背包 ${o.bag}${o.box ? " · 仓库 " + o.box : ""}</small></span><span class="seed-time">约 ${hours} 游戏小时熟（${realTime(hours)}）· 收 ${c.yield + more} 份</span><span class="seed-tags">${seasonTag(e, o.crop)}${weatherTags(e, o.crop)}</span></button></li>`;
    })
    .join("");
  return head + `<ul class="seed-list">${rows}</ul>${mystery}<p class="muted">种下以后天天浇上水，收的时候有机会出一份优质；漏浇一天，这一茬就不出优质了。</p>`;
}

// ================= 这块田 =================
function waterWho(e, p) {
  const sp = e.s.buildings.find((b) => b.type === "irrigation" && b.hp > 0 && dist(b, p) < (e.sprinklerR?.(b) || SPRINKLE.r));
  if (sp) return ["喷灌头管这块：每天给它浇上水。", true];
  if (e.canalReady?.() && dist(p, { x: 770, y: 695 }) < CANAL_R) return ["挨着水渠：每天自己有水。", true];
  return ["要你自己浇：浇水壶到旧水井灌满；旁边建一个喷灌头，就不用天天浇了。", null];
}
function viewPlot(e, ui) {
  const p = e.plotById(ui.id);
  if (!p) return `<p>这块田不在这里。</p>`;
  if (!p.crop || !CROPS[p.crop]) return viewPick(e, ui);
  const c = CROPS[p.crop],
    ripe = ripeOf(p),
    hours = e.hoursLeft(p),
    watered = e.plotWatered(p),
    canWater = (e.c?.water ?? 1) >= 1,
    dry = !!e.tr?.dry[p.id],
    r = e.bt?.plots[p.id] || {},
    g = e.giantOf?.(p),
    day = e.s.day,
    lines = [],
    li = (text, ok = null) => lines.push(`<li class="${ok === true ? "ok" : ok === false ? "bad" : ""}">${esc(text)}</li>`);
  if (!ripe) li(watered ? "今天喝到水了" : "今天还没浇水", watered);
  if (p.crop !== "hybrid") li(dry ? "种下以后漏浇过一天：这一茬不出优质。" : "种下以后天天浇过水：收的时候有 " + Math.round(e.fineChance(e.careScore(p)) * 100) + "% 的机会出一份优质。", !dry);
  const k = e.seasonKind?.(p.crop) || "";
  if (k) li(seasonOf(day).name + "时节：" + (k === "good" ? "当季，长得快 " + pct(SEASON_RATE.good) + "%、收的时候多 " + SEASON_EXTRA + " 份" : e.underGlass?.(p) ? "反季，但在温室里，照常长" : "反季，长得慢 " + pct(SEASON_RATE.bad) + "%（挪进温室就不受影响）") + "。", k === "good" ? true : e.underGlass?.(p) ? null : false);
  if (g) li("这是巨型" + cropName(g.crop) + "的一角：要锄 " + GIANT.hits + " 下才收得动（已经锄了 " + g.hits + " 下）。熟着放在地里，夜里会招来感染者。", true);
  if (p.crop === "hybrid") li("杂交苗：" + (r.hy || []).map(cropName).join(" × ") + "。照常浇水，长大收下来是一包种子（两成五是新品种）。", true);
  if (REGROW.crops.includes(p.crop)) {
    const n = r.n || 0;
    const left = Math.max(0, REGROW.max - n - 1);
    li("第 " + (n + 1) + " 茬：" + (left > 0 ? "收完不用重种，还能再收 " + left + " 茬。" : "这是最后一茬，收完要重种。"));
  }
  if (r.fz) li("施了肥料：" + FERT.text + "。", true);
  if (r.tr === day) li("夜里被感染者踩过：长势退回一半。", false);
  if (r.mh) li("田边有田鼠洞：收的时候少 1 份。", false);
  const pk = e.g?.plots[p.id]?.pk || 0;
  if (pk) li("被乌鸦啄过 " + pk + " 次：少收 " + pk + " 份。", false);
  if (safe(() => e.dexDone?.(p.crop), false)) li("图鉴这一行集齐了：收" + cropName(p.crop) + "多 " + DEX.bonus + " 份。", true);
  if (ripe && r.ra && !g) {
    const hrs = Math.floor((e.absNow() - r.ra) / 60);
    if (hrs >= 1) li("熟了 " + hrs + " 个钟点了" + (hrs >= 4 ? "：居民会替你收" : "") + "。熟了别放太久，乌鸦会来。");
  }
  if (!ripe) {
    const [t, ok] = waterWho(e, p);
    li(t, ok);
  }
  if (safe(() => e.coldActive?.(), false) && p.crop !== "winterPotato" && !safe(() => e.inGreenhouse?.(p), false)) li("寒潮里：温室外的田不长。", false);
  const st = e.bt?.storm;
  if (st && st.day === day + 1 && st.kind) li("明天坏天气：熟了、快熟的会少收。今天能抢收的先收。", false);
  const btns = [];
  if (g) btns.push(button("btGiant", p.id, "锄一下（还要 " + (GIANT.hits - g.hits) + " 下）", 'class="primary"'));
  else if (ripe) btns.push(button("gHarvest", p.id, "收获", 'class="primary" data-hotkey="1"'));
  if (!ripe) btns.push(button("gWater", p.id, "浇水", dis(watered ? "今天已经喝到水了" : !canWater ? "浇水壶没水了：去旧水井补满" : "")));
  if (!g && !ripe && p.crop !== "hybrid" && !r.fz) btns.push(button("btFert", p.id + "|grow", "施肥料（有 " + stock(e, FERT.id) + "）", dis(safe(() => e.fertReason?.(p, "grow"), "") || "")));
  if (!g && !ripe && p.crop !== "hybrid" && p.growth / c.grow >= STORM.rush) btns.push(button("btRush", p.id, "现在抢收（" + (safe(() => e.fieldRushPortions?.(p), 0) || 0) + " 份，不出优质）", dis(safe(() => e.fieldRushReason?.(p), "") || "")));
  const info = cropInfo(p.crop);
  const weather = [info.likes ? "喜欢" + word(info.likes) + (info.likes === e.s.weather ? "（今天就是，长得快）" : "") : "", info.hates ? "怕" + word(info.hates) : ""].filter(Boolean).join(" · ");
  return `<div class="g-plot"><header class="g-head"><div><small>第 ${e.s.plots.indexOf(p) + 1} 块田</small><h3>${esc(c.name)} · ${ripe ? "熟了" : "长到 " + Math.floor((p.growth / c.grow) * 100) + "%"}</h3><p>${ripe ? "可以收了。" : "还要约 " + hours + " 游戏小时（" + realTime(hours) + "）"}</p></div></header><ul class="g-today">${lines.join("")}</ul><div class="button-row g-actions">${btns.join("")}</div><dl class="g-facts"><dt>天气</dt><dd>${esc(weather || "不挑天")}</dd><dt>优质</dt><dd>从种下那天起天天浇上水，收的时候有机会多一份优质（卖得贵六成）；漏浇一天，这一茬就不出了。</dd><dt>肥料</dt><dd>堆肥桶沤的，一茬施一袋：${esc(FERT.text)}。</dd></dl></div>`;
}

// ================= 菜地告示牌：这个时节、这三天种什么好 =================
function viewBoard(e) {
  const day = e.s.day,
    s = seasonOf(day),
    crops = Object.keys(CROP_SEASON).filter((c) => CROPS[c]),
    good = crops.filter((c) => e.seasonKind?.(c) === "good").map(cropName),
    bad = crops.filter((c) => e.seasonKind?.(c) === "bad").map(cropName);
  let fc = safe(() => (e.forecast?.() || []).slice(0, 3), []);
  if (!fc.length) fc = [{ day, weather: e.s.weather }];
  const all = Object.keys(CROPS).filter((c) => !CROPS[c].hybrid && ITEMS[c]);
  const days = fc
    .map((d, i) => {
      const like = all.filter((c) => cropInfo(c).likes === d.weather).map(cropName);
      return `<li><b>${["今天", "明天", "后天"][i] || "第 " + d.day + " 天"} · ${esc(word(d.weather))}</b><small>${like.length ? "喜欢这天的：" + esc(like.join("、")) : "没什么特别"}</small></li>`;
    })
    .join("");
  const plots = safe(() => e.farmPlots?.(), null) || e.s.plots,
    planted = plots.filter((p) => p.crop && CROPS[p.crop]),
    ripe = planted.filter(ripeOf).length,
    thirsty = planted.filter((p) => !ripeOf(p) && !e.plotWatered(p)).length,
    empty = plots.filter((p) => p.tilled && !p.crop).length;
  const stat = (n, label, warn) => `<span class="g-stat${n && warn ? " warn" : ""}"><b>${n}</b>${esc(label)}</span>`;
  const warn = [];
  const bt = e.bt;
  if (bt?.raid?.state === "warned" && bt.raid.day === day) warn.push(["bad", "今晚 01:00 菜地夜袭：" + bt.raid.n + " 只感染者冲着熟菜来。收菜、修围栏、留守卫都管用。"]);
  if (bt?.storm?.day === day + 1 && bt.storm.kind) warn.push(["bad", "明天坏天气：今天抢收长过七成的菜。"]);
  const ripeLong = safe(() => e.ripeLong?.(), 0) || 0;
  if (ripeLong > 7) warn.push(["warn", "熟了好几个钟点还没收的有 " + ripeLong + " 块：超过 10 块，晚上会招来夜袭。"]);
  if (planted.length >= 15) warn.push(["", "种了 " + planted.length + " 块：乌鸦会来啄熟了没收的菜，稻草人 160 步内的不啄。"]);
  for (const g of Object.values(bt?.giants || {})) warn.push(["good", "巨型" + cropName(g.crop) + "长在地里：锄 " + GIANT.hits + " 下就能收。"]);
  const comp = Object.values(bt?.compost || {}).reduce((a, x) => a + (x.out || 0), 0);
  if (comp) warn.push(["good", "堆肥桶里有 " + comp + " 袋肥料可以取。"]);
  const orders = day >= ORDERS.fromDay && bt?.orders ? button("bView", "bOrders", "订单板 · " + (bt.orders.list || []).length + " 张") : "";
  return `<div class="g-board tr-board"><section><h3>${esc(s.name)}第 ${seasonDay(day)} 天：这一季种什么</h3><p>${good.length ? "当季（长得快 " + pct(SEASON_RATE.good) + "%、每收多 " + SEASON_EXTRA + " 份）：" + esc(good.join("、")) + "。" : ""}${bad.length ? "反季（长得慢 " + pct(SEASON_RATE.bad) + "%，温室里不受影响）：" + esc(bad.join("、")) + "。" : ""}</p></section><section><h3>这三天</h3><ul class="g-days">${days}</ul></section><section><h3>今天的菜地</h3><div class="g-stats">${stat(ripe, "块熟了")}${stat(thirsty, "块该浇", true)}${stat(empty, "块空地")}</div>${warn.length ? `<ul class="bt-warn">${warn.map(([cls, t]) => `<li class="${cls}">${esc(t)}</li>`).join("")}</ul>` : ""}<p class="muted">天天浇上水的菜收的时候有机会出优质；喷灌头旁边、水渠边的田每天自己有水。</p></section>${bt ? safe(() => dexBlock(e), "") : ""}${orders ? `<div class="button-row">${orders}</div>` : ""}</div>`;
}

// ================= 通信站：只听广播 =================
function viewRadio(e) {
  if (!e.r?.radio) return "<p>电台还没修好（主线“让沉默的电台再响一次”）。</p>";
  const text = safe(() => e.radioToday?.(), "") || "";
  const fc = safe(() => e.forecast?.(), []) || [];
  const tom = fc.find((d) => d.day === e.s.day + 1)?.weather || "";
  const learned = (e.al?.dishes || []).map((id) => ITEMS[id]?.name).filter(Boolean);
  return `<section class="tr-radio"><h3>今天早上的广播</h3>${text ? `<p>${esc(text)}</p>` : `<p class="muted">每天早上 7 点播一回：明天的天气、今天废墟里的事、十凶的传闻。${e.s.minute < 420 ? "今天的还没播。" : ""}</p>`}${tom ? `<p>明天：${esc(word(tom))}。</p>` : ""}<p class="muted">每个时节第一天何大勺在广播里讲一道当季菜，听过就会做（篝火灶）。学会了：${learned.length ? esc(learned.join("、")) : "还没有"}。</p></section>`;
}

// ================= 堆肥桶：只出一种肥 =================
function viewCompost(e, ui) {
  const id = ui.id,
    b = e.s.buildings.find((x) => x.id === id && x.type === "compost");
  if (!b || !e.bt) return `<p>堆肥桶不在了。</p>`;
  const r = e.bt.compost[id] || { kind: "grow", n: 0, ready: 0, out: 0 },
    farm = e.s.region === "farm";
  const state = r.ready ? "正在沤：明早 06:00 出 1 袋肥料。" : r.out ? "沤好了 " + r.out + " 袋肥料，可以取出来。" : "桶里 " + r.n + "/" + COMPOST.batch + " 份，满了过一夜出 1 袋肥料。";
  const left = COMPOST.batch - r.n;
  const stuff = safe(() => e.compostStuff?.(), []) || [];
  const rows = stuff.length
    ? `<ul class="bt-list">${stuff
        .map((item) => {
          const why = e.compostReason(id, item),
            k = Math.min(left, stock(e, item));
          return `<li><span><b>${esc(ITEMS[item]?.name || item)}</b><small>有 ${stock(e, item)}</small></span><span class="bt-btns">${button("btCompAdd", id + "|" + item + "|1", "丢 1 份", dis(why))}${k > 1 ? button("btCompAdd", id + "|" + item + "|" + k, "丢 " + k + " 份", dis(why)) : ""}</span></li>`;
        })
        .join("")}</ul>`
    : `<p class="muted">身上和仓库里没有能沤的：多的菜、草料、鸡粪都行。</p>`;
  const take = r.out ? `<div class="button-row">${button("btCompTake", id, "取出 " + r.out + " 袋肥料（入仓）", farm ? 'class="primary"' : dis("回到农场再取"))}</div>` : "";
  const why = r.ready ? "正在沤" : r.out >= COMPOST.max ? "先把沤好的肥料取出来" : !farm ? "回到农场再弄" : "";
  return `<header class="bt-head"><div><small>堆肥桶 · 肥料 ${stock(e, FERT.id)} 袋</small><h3>${esc(state)}</h3><p>多的菜、草料、鸡粪丢进去，${COMPOST.batch} 份过一夜出 1 袋肥料；施在田里，${esc(FERT.text)}。</p></div></header>${take}<section><h3>丢进去</h3>${why ? `<p class="story-lack">${esc(why)}。</p>` : rows}</section><p class="muted">施肥：打开那块田，一茬施一袋。</p>`;
}

// ================= 麦穗：只要摸 =================
function viewDog(e) {
  if (!e.dogReady?.()) return "<p>还没有找到麦穗。</p>";
  const d = e.fr.dog,
    got = DOG_SKILLS.filter((s) => d.bond >= s.bond).map((s) => s.name),
    next = DOG_SKILLS.find((s) => d.bond < s.bond),
    why = safe(() => e.petReason?.(), "") || "";
  return `<section class="tr-dog"><h3>麦穗 · 默契 ${d.bond}/${DOG_MAX}</h3><p>它一直跟着你；饭自己吃（每天早上从仓库里拿一份干粮）。每天摸一摸，默契 +1。</p><p>${got.length ? "学会了：" + esc(got.join("、")) + "。" : "还没学会本事。"}${next ? "默契到 " + next.bond + "：" + esc(next.name) + "。" : ""}</p><div class="button-row">${button("xDog", "pet", "摸摸它", dis(why))}</div></section>`;
}

// ================= 消息：这次简化退回了什么 =================
function viewConv(e) {
  const lines = e.trConvLines?.() || [];
  if (!lines.length) return "<p>没有内容。</p>";
  return `<section class="tr-conv"><p>第 ${e.tr.conv.day} 天读进来时，营地照“一样东西只做一件事”收拾了一回，退回的东西都在仓库里：</p><ul>${lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul></section>`;
}

const GONE = {
  decrees: "法令去掉了：营地的规矩不用再签。",
  hemc: "贺满仓回联盟去了：垫付不再有。",
  stealPrep: "偷东西去掉了。",
  steal: "偷东西去掉了。",
  caught: "偷东西去掉了。",
  thief: "偷东西去掉了：妙手的经验折给了探索。",
  night: "夜里的抉择去掉了。",
};
export function trimTitle(ui, base) {
  if (uiOn && ui?.view === "trConv") return CONVERT_TITLE;
  if (uiOn && ui?.view === "radio") return "通信站";
  if (uiOn && ui?.view === "bWater") return "菜地告示牌";
  return base(ui);
}
const wrap = (view, html, cls = "") => `<div class="outpost-page view-${esc(view)}${cls ? " " + cls : ""}">${html}</div>`;
// 这几页整页换成这一层的
export function trimView(e, ui) {
  if (!on(e) || !ui) return null;
  const v = ui.view;
  if (v === "gPick") return wrap("gPick", viewPick(e, ui));
  if (v === "gPlot") return wrap("gPlot", viewPlot(e, ui));
  if (v === "gBoard" || v === "bWater") return wrap("gBoard", viewBoard(e));
  if (v === "radio") return wrap("radio", viewRadio(e));
  if (v === "bCompost") return wrap("bCompost", viewCompost(e, ui), "bt-page");
  if (v === "dog") return wrap("dog", viewDog(e));
  if (v === "trConv") return wrap("trConv", viewConv(e));
  if (GONE[v]) return wrap(v, `<p>${esc(GONE[v])}</p>`);
  if (v === "dialog" && ui.id === "hemc") return wrap("dialog", `<p>${esc(GONE.hemc)}</p>`);
  return null;
}
export const boardHtml = (e) => wrap("gBoard", viewBoard(e));

// ================= 别的页：拿掉去掉了的那几样 =================
// 哪一页都可能写到的几句：房间不再算暖区
const SAY = [
  ["、布置好的房间 120", ""],
  ["（火炉、温室或布置好的房间）", "（火炉或温室）"],
  ["待在火炉、灶台、农舍或房间附近", "待在火炉、灶台、农舍附近"],
];
export function trimPatch(e, ui, html) {
  if (!on(e) || !ui || typeof html !== "string") return html;
  const v = ui.view;
  let out = html;
  for (const [a, b] of SAY) if (out.includes(a)) out = out.split(a).join(b);
  if (v === "shipping") out = dropBlock(out, "td-listing");
  if (v === "lathe") out = dropBlock(out, "td-rush");
  if (v === "plaza") {
    out = dropBlock(out, "hn-fest");
    out = dropActions(out, ["sCanteen", "hnFestPick"]);
    out = out.replace("生活水准到“吃得好”", "每个人吃上晚饭，最近三顿有三样菜");
    out = out.replace(/走到跟前按 E 说句话：心情 \+3，还会透露一样喜好。/, "走到跟前按 E 说句话：全营士气高一点。");
    // 食堂：到日子自己开张，口碑不再算
    out = out.replace(/<small>前哨食堂 · 口碑 \d+<\/small>/, "<small>前哨食堂</small>");
    out = out.replace("；口碑高了集市收购食物贵一成（≥50）、唐九早一天来（≥70）", "");
    out = out.replace("客人等不及会走，口碑下降", "客人等不及会走");
    out = out.replace(/(<h3>食堂营业夜<\/h3>[\s\S]*?)(<\/article>)/, `$1<p class="muted">营业的晚上（19:00–21:00）你走到广场，食堂就自己开张，用仓库和背包里做好的菜。</p>$2`);
    out = out.replace("（两件以上，居民士气每天 +1；四件 +2）", "（两件以上，全营士气 +2；四件 +4）");
  }
  if (v === "collection") out = out.replace(/ · 妙手 Lv\.\d+/g, "");
  if (v === "museum") out = out.replace("往事陈列柜（算舒适度的摆设）", "往事陈列柜（摆出来算一种摆件）");
  if (v === "rlReview") out = out.split("平均心情").join("全营士气");
  if (v === "calendar") out = out.replace("早上电台说明天的天气和手气", "早上电台说明天的天气");
  if (v === "phone") out = out.replace(/<button class="phone-tile" data-action="wView" data-id="decrees">[\s\S]*?<\/button>/, "");
  if (v === "dialog" && ui.id === "ge") {
    out = out.replace("<div class=\"ladder-row\"><b>生活水准</b>", "<div class=\"ladder-row\"><b>吃住</b>");
    out = out.replace(/需要生活水准第三级（现在第 (\d) 级）/, (m, n) => (Number(n) >= 3 ? "吃得饱、吃得好、住得暖都做到了" : "要吃得饱、吃得好、住得暖（现在做到 " + n + " 样）"));
  }
  if (v === "people") {
    out = dropBlock(out, "kin-notes");
    out = out.replace(/<p>每个人最爱 2 样[^<]*<\/p>/, "<p>每个人最爱 2 样、喜欢 4 样、讨厌 2 样，都写在他那一格里：最爱 +2、喜欢 +1、一般不变、讨厌 −1。每人一周最多送两回，要走到他跟前送，生日那天翻倍。</p>");
  }
  if (v === "rlStation") {
    out = dropBlock(out, "rl-co");
    out = out.replace("作物交普通、优质、上品都行", "作物交普通、优质都行");
  }
  if (v === "caravan") {
    out = dropActions(out, ["oInspect", "oExpose"]);
    out = out.replace(/<em class="tag[^"]*">(?:看出是假货|验过是真货|没看出名堂)<\/em>/g, "");
    out = out.replace(/<p class="muted">细看成功率[^<]*<\/p>/, "");
    out = out.replace(/<div class="outpost-alert">你买到过假货[\s\S]*?<\/div>/, "");
  }
  if (v === "dialog" && ui.id === "hemc") out = dropActions(out, ["xAdvance", "xRepay"]);
  if (v === "crew" || v === "lnight") out = dropBlock(out, "hn-hurt");
  return out;
}

// ================= 援建营地那一页（派活）：去掉了的几句 =================
// 原来“家园与远行”里的几页：房间、土地（肥力、搭配）、生态修复都不用你管了；水渠只剩挖
const FRONTIER_GONE = {
  rooms: "房间去掉了：地板、椅子、灯、书架、餐桌都算摆件（建造页“摆件”那一格），每多一种全营士气 +1。农舍扩建在农舍那一页（走到农舍按 E）。",
  land: "肥力、轮作、搭配去掉了：每块田都一样，种什么都不挑前一茬。当季的菜长得快，天天浇水有机会出优质。",
  ecology: "生态修复区不用你管了：收复度每涨一截，就自己修好一格；草地林地连成片来蝴蝶（优质的机会多一成），湿地连成片来青蛙，修满了来白鹭。",
};
export function trimManual(e, tab, ui, html) {
  if (!on(e) || typeof html !== "string") return html;
  const ft = ui?.tool?.menu === "frontier" ? ui.tool.tab : "";
  if (FRONTIER_GONE[ft]) return `<div class="place-page"><div class="detail-scroll"><p>${esc(FRONTIER_GONE[ft])}</p></div></div>`;
  let out = dropBlock(html, "winter-card");
  if (ft === "water") {
    out = out.replace(/<button\b[^>]*data-action="fWaterControl"[^>]*data-id="gate"[^>]*>[\s\S]*?<\/button>|<button\b[^>]*data-id="gate"[^>]*data-action="fWaterControl"[^>]*>[\s\S]*?<\/button>/g, "");
    out = out.replace(/ · 闸门(开启|关闭)/, "");
    out = out.replace("5号格是闸门；", "5号格原来是闸门，现在一直开着；");
    out = out.replace(/连通后池塘水接进水网：[^<]*排水立即开放浅滩。/, "挖通了，水渠边 190 步内的田每天自己有水；选“蓄水灌溉”时水位慢慢涨。排水立即开放浅滩。");
  }
  out = out.split("你在农场时只浇水、照看；").join("你在农场时只浇水；");
  return out;
}

// ================= 设施卡 =================
function jarCard(e, b) {
  const st = e.jarState(b.id),
    rec = e.al?.jars?.[b.id],
    pj = jarRecipe("radish"),
    wj = jarRecipe("rye"),
    lines = [];
  if (st.state === "empty" || !rec) {
    lines.push(P("空着。装 " + pj.take + " 份同一种东西：菜 " + pj.ready + " 天出" + ITEMS[pj.out].name + "（放到 " + pj.agedDays + " 天成" + ITEMS[pj.aged].name + "），粮食和果子 " + wj.ready + " 天出" + ITEMS[wj.out].name + "（放到 " + wj.agedDays + " 天成" + ITEMS[wj.aged].name + "）。"));
    const rows = JAR_ANY.inputs
      .filter((id) => ITEMS[id])
      .map((id) => {
        const J = jarRecipe(id);
        return `<li>${esc(ITEMS[id].name)} <small>有 ${e.quantityForCost(id, true)}</small>${act("alJarFill", b.id + "|" + id, J.verb + " " + J.take + " 份", e.jarFillReason(b.id, id))}</li>`;
      })
      .join("");
    lines.push(`<ul class="bt-list">${rows}</ul>`);
  } else {
    const J = jarRecipe(rec.item),
      what = ITEMS[rec.item]?.name || "";
    if (st.state === "brewing") lines.push(P(J.verb + "着 " + rec.n + " 份" + what + "：还要 " + st.left + " 天能取。"));
    else if (st.state === "ready") lines.push(P("能取了：" + ITEMS[J.out].name + " ×" + J.n + "。再放 " + st.left + " 天就是" + ITEMS[J.aged].name + "（价钱翻倍）——现在取、还是再等，看你。"));
    else lines.push(P("陈了：" + ITEMS[J.aged].name + " ×" + J.n + "。", "gold"));
    lines.push(`<div class="button-row">${act("alJarTake", b.id, "取出来", st.state === "brewing" ? "还要 " + st.left + " 天" : "", st.state !== "brewing")}</div>`);
  }
  lines.push(P("寒潮时节田里几乎不长，腌菜就是口粮；土酒能在制作台和布一起做成消毒绷带。", "muted"));
  return `<section class="td-card al-card al-jar tr-jar">${lines.join("")}</section>`;
}
const DECOR_ALL = [...DECOR_LOOKS, ...DECOR_SPECIAL];
export function trimBuildingExtras(e, b, html) {
  if (!on(e) || !b) return html;
  let out = dropBlock(dropBlock(html, "hn-up"), "hn-room");
  out = dropActions(out, ["feedAnimals", "collectAnimals", "btChickens", "alHerdPet", "btSprinkler", "rOpen", "serviceAutomation", "hnTreat"]);
  out = out.replace(/<button\b[^>]*data-action="bView"[^>]*data-id="bWater"[^>]*>[\s\S]*?<\/button>/g, "");
  // 信标：不再用电；守塔的人不再“太累”；床不够睡跌的是全营士气；火炉不再管生活水准
  out = out.replace(/要 \d+ 电，没电就拿 \d+ 个零件当电池。/, "拉一次用 1 个零件。");
  out = out.replace("（要吃上工作餐、有床、不太累）", "（要吃上工作餐、有床）");
  out = out.replace(/他们不干活，心情 −10。/, "他们不干活，全营士气 −10。");
  out = out.replace(/；农舍和援建营地在暖区里，生活水准才算“住得暖”。/, "。");
  const extra = [];
  if (b.hnUp) extra.push(P("这座改良过，照样算。", "gold"));
  if (b.type === "coop") {
    out = dropBlock(out, "td-card");
    const a = e.c?.animals || {},
      fed = a.feedDay === e.s.day;
    extra.push(P((a.chicken ? "有鸡" : "还没有鸡（去居民区把走失的鸡救回来）") + (a.goat ? " · 有山羊" : "") + "。每天早上自己喂（仓库里的玉米，没有就用草料），蛋" + (a.goat ? "和奶" : "") + "自己进仓库。"));
    if (a.chicken) extra.push(P(fed ? "今天喂过了。" : "今天还没喂上：仓库里放点玉米（或 3 份草料）。", fed ? "muted" : "story-lack"));
  }
  if (b.type === "alPickleJar" || b.type === "alWineJar") {
    out = dropBlock(out, "al-jar");
    out = jarCard(e, b) + out;
  }
  if (DECOR_ALL.includes(b.type)) {
    if (DECOR_LOOKS.includes(b.type)) out = dropBlock(out, "td-card");
    out = out.replace(/摆在房间地板边算一类家具（舒适度 \+1）；摆在屋外，营地里每摆一种不同的，大家心情 \+1（最多 \+3）。现在屋外摆着 \d+ 种。/, "");
    const n = Math.min(6, e.trDecorKinds?.() || 0);
    extra.push(P("摆着好看：营地里摆着 " + n + " 种摆件，全营士气 +" + n + "（最多 +6）。", "gold"));
  }
  return out + (extra.length ? card(extra) : "");
}
export function trimStationExtras(e, b, html) {
  if (!on(e)) return html;
  return dropBlock(html, "hn-up");
}

// ================= 技能页：天赋自己学 =================
export function trimSkillPage(e, html) {
  if (!on(e) || typeof html !== "string") return html;
  let out = dropBlock(html, "skill-thief");
  out = dropBlock(out, "respec");
  out = dropActions(out, ["kLearn", "kRespec"]);
  const p = safe(() => e.skillPoints?.(), null) || { free: 0 };
  const n = e.sk?.talents?.length || 0;
  out = out.replace(/<div class="skill-head"><p>[\s\S]*?<\/p>/, `<div class="skill-head"><p><b class="skill-points">天赋自己学</b>任何一项技能升到 2–5 级各得 1 点，每完成一段主线 1 点（一局最多 28 点）。每天早上和睡醒时有点数，就按顺序学下一个（打着仗不学）。现在学会了 ${n} 个，还剩 ${Math.max(0, p.free || 0)} 点。</p>`);
  out = out.replace("；打感染者涨战斗；偷东西涨妙手。", "；打感染者涨战斗。");
  return out;
}

// ================= 任务手记 =================
export function trimJournal(e, html) {
  if (!on(e) || typeof html !== "string") return html;
  let out = dropBlock(html, "far-row night");
  out = dropBlock(out, "far-row hemc");
  out = dropBlock(out, "far-row amends");
  out = out.replace(/<div class="far-row muted"><p>19:00 后，三处废墟里会有一件事等你决定。<\/p><\/div>/, "");
  out = out.replace(/<button\b[^>]*data-action="xView"[^>]*data-id="(?:dog|nightlog)"[^>]*>[\s\S]*?<\/button>/g, "");
  return out;
}

// ================= 顶栏：动静去掉；菜单最上面一行多一个士气 =================
export function moraleNow(e) {
  if (!on(e)) return "";
  const m = Math.round(e.tr.morale),
    tier = m < MORALE.low ? "低" : m >= MORALE.high ? "高" : "照常";
  const f = safe(() => (e.moodFactors?.() || []).slice().sort((a, b) => Math.abs(b.v) - Math.abs(a.v)), []);
  const target = safe(() => e.moodTarget?.(), MORALE.home) ?? MORALE.home;
  const why = f.map((x) => x.text + " " + (x.v > 0 ? "+" : "−") + Math.abs(x.v)).join("、");
  return m + "（" + tier + "）· 明天往 " + target + " 走" + (why ? "：" + why : "");
}
export function trimHud(e, hud) {
  if (!on(e) || !hud) return hud;
  const m = Math.round(e.tr.morale);
  return { ...hud, noise: null, morale: { name: MORALE_TEXT.name, value: String(m), tone: m < MORALE.low ? "danger" : "", now: moraleNow(e) } };
}

// ================= 建造页：摆件一格 =================
export function decorCard(e, icon = "") {
  const farm = e.s.region === "farm";
  const looks = DECOR_LOOKS.filter((id) => BUILDINGS[id]).map((id) => {
    const b = BUILDINGS[id],
      cost = costText(b.cost),
      why = !farm ? "回到农场再建" : id === "harvestTrophy" && !e.f?.trophies ? "先在收获展得个奖杯" : !e.afford(b.cost) ? "材料不够" : "";
    return button("build", id, b.name + (cost ? "（" + cost + "）" : ""), dis(why));
  });
  const special = ["hnKeepsake", "rlWatch"].filter((id) => BUILDINGS[id] && !BUILDINGS[id].retired).map((id) => button("build", id, BUILDINGS[id].name + "（摆出来）", dis(!farm ? "回到农场再摆" : "")));
  const keep = BUILDINGS.alDecor && !BUILDINGS.alDecor.retired ? `<p><b>旧物摆件：</b>挑一件摆出来</p>${almanacBuildExtras(e, "alDecor")}` : "";
  const kinds = Math.min(6, e.trDecorKinds?.() || 0);
  return `<article class="recipe tr-decor">${icon}<div class="recipe-body"><h3>摆件</h3><p>摆着好看：椅子、灯、书架、餐桌、地板、奖杯、旧物摆件、陈列柜，每样算一种（老怀表另算，一直 +3）。</p><p class="item-purpose"><b>好处：</b>营地里每多一种摆件，全营士气 +1（最多 +6）。现在摆着 ${kinds} 种。</p><div class="button-row tr-looks">${[...looks, ...special].join("")}</div>${keep}</div></article>`;
}
// 建造页：旧物摆件、陈列柜、老怀表不单列（都在“摆件”那一格里挑），多一格“摆件”
export function trimBuildIds(e, ids, focused = false) {
  if (!on(e)) return ids;
  const out = ids.filter((id) => !DECOR_ALL.includes(id));
  return focused ? out : [...out, "trDecor"];
}
// 建造页每一格下面：贺满仓垫付不再有
export function trimBuildCardExtras(e, far, almanac) {
  return on(e) ? almanac : far + almanac;
}

// ================= 农舍：扩建和「休息好」 =================
export function trimHomeExtras(e) {
  if (!on(e)) return "";
  const add = safe(() => e.trRestMinutes?.(), 0) || REST.base * 60;
  const rest = e.restedNow?.() ? "现在「休息好」：还有 " + Math.ceil((e.restedLeft?.() || 0) / 60) + " 个钟点。" : "";
  const lines = [P("在农舍睡一觉，醒来「休息好」" + Math.round(add / 60) + " 个钟点：体力恢复快五成，经验多一成。" + rest)];
  let expand = "";
  if (e.hp && EXPAND.home) {
    const lv = e.hpLv?.("home") || 0;
    const rows = EXPAND.home
      .map((X, i) => {
        if (i < lv) return `<li class="full"><span>${esc(X.name)} ✓</span><small>${esc(X.text)}</small></li>`;
        if (i > lv) return `<li><span>${esc(X.name)}</span><small>先扩建上一样</small></li>`;
        return `<li><span>${esc(X.name)}</span><small>${esc(X.text)} 要 ${esc(costText(X.cost))}</small>${act("hpExpand", "home", "扩建", safe(() => e.expandReason?.("home"), "") || "", true)}</li>`;
      })
      .join("");
    const have = GOOD_IDS.filter((id) => !GOODS[id].repeat && e.hpOwn?.(id));
    const goods = have.length ? `<ul class="hp-rows">${have.map((id) => `<li class="full"><span>${esc(GOODS[id].name)}</span><small>${esc(GOODS[id].text)}</small></li>`).join("")}</ul>` : `<p class="muted">还没有添置稀罕货：唐九的商队来的那一周带着（第 ${START.good} 天起）。</p>`;
    expand = `<article class="frontier-card hp-expand"><h3>${esc(EXPAND_NAMES.home)}扩建 <small>${lv}/${EXPAND.home.length}</small></h3><ul class="hp-rows">${rows}</ul><p class="muted">仓库箱、鸡舍的扩建在它们自己的设施卡上（走到跟前按 E）。</p><h4>家里添的东西</h4>${goods}</article>`;
  }
  return card(lines, "tr-home") + expand;
}

// ================= 地区、前哨的仓库那一页：休整点 =================
export function trimDistricts(e, html) {
  if (!on(e) || typeof html !== "string") return html;
  const a = html.indexOf('<div class="district-kicker">物资位置 / ');
  if (a < 0) return html;
  const tail = "查看运输</button></div>";
  let b = html.indexOf(tail, a);
  if (b < 0) return html;
  b += tail.length;
  const cap = '<p class="district-caption">休整需要';
  if (html.startsWith(cap, b)) b = html.indexOf("</p>", b) + 4;
  const local = html.slice(a, b).indexOf('class="district-reason"') < 0,
    name = REGIONS[e.s.region]?.name || "这里";
  const panel = `<div class="district-kicker">休整点 / ${esc(name)}</div><h2>休整点</h2><p>地区仓库并进了农场仓库：这里干活出的、捡到的东西都直接进农场仓库。</p><div class="button-row">${button("dRest", "", "在休整点歇 1 个钟点", local ? "" : dis("走到这一区的休整点再歇"))}</div><p class="muted">要靠近休整点、附近没有感染者：补满水壶、恢复体力，消耗 5 饥饿。</p>`;
  return html.slice(0, a) + panel + html.slice(b);
}
export function trimBeyond(e, ui, html) {
  if (!on(e) || typeof html !== "string") return html;
  let out = html;
  const at = out.indexOf("<p>工作产出与奖励都放在这里。");
  if (at >= 0) {
    const start = out.lastIndexOf('<section class="b-card', at),
      end = start >= 0 ? blockEnd(out, start, "section") : -1;
    if (end > start) {
      const region = BMAPS[e.s.region] ? e.s.region : "",
        near = !!region && Math.hypot(e.s.player.x - 220, e.s.player.y - 570) < 130,
        name = BMAPS[region]?.name || "前哨";
      const panel = `<section class="b-card tr-rest"><h3>${esc(name)}休整点</h3><p>前哨的仓库并进了农场仓库：这里干活出的、得到的东西都直接进农场仓库。</p><div class="b-actions">${button("bRest", "", "休整一小时 · 饥饿−5", near ? "" : dis("先走到入口旁的休整点"))}</div></section>`;
      out = out.slice(0, start) + panel + out.slice(end);
    }
  }
  // 河道船班：货运停了，只投信
  out = out.replace(/<p>农场与船坞之间运输。[^<]*<\/p>/, "<p>货运停了：各处的东西直接进农场仓库。船班只帮你投信。</p>");
  out = out.replace(/<label>货物<select id="b-cargo">[\s\S]*?<\/select><\/label>/, "");
  out = dropActions(out, ["bShip", "bStoreTrack", "bDeposit", "bWithdraw", "bWithdrawAll"]);
  return out;
}

// ================= 动作 =================
const GONE_ACTIONS = {
  wDecree: "法令去掉了。",
  wProgram: "节目单去掉了：通信站只播早上的广播。",
  hnCmd: "电台指令去掉了。",
  tdRush: "机床加急去掉了。",
  hnUpPath: "设施改良去掉了：已经改好的照样算。",
  hnUpBuild: "设施改良去掉了：已经改好的照样算。",
  hnUpFences: "设施改良去掉了：已经改好的照样算。",
  btNet: "水网去掉了。",
  btSprinkler: "喷灌头一直开着。",
  btCompKind: "肥只有一种了。",
  kLearn: "天赋会按顺序自己学。",
  kRespec: "天赋不能重新分配了。",
  xNight: "夜里的抉择去掉了。",
  xAdvance: "贺满仓不再垫付了。",
  xRepay: "欠贺满仓的那笔已经结清了。",
  oInspect: "唐九的货都是真的，不用验。",
  oExpose: "唐九的货都是真的。",
  rlCoSign: "鼎丰物资不再有了。",
  rlCoBuy: "鼎丰物资不再有了。",
  rlCoTear: "鼎丰物资不再有了。",
  tdList: "挂牌并进出货箱了：放进出货箱，当晚卖掉。",
  hnFestPick: "节庆的供品自己会挑。",
  alHerdPet: "鸡和山羊天天有人摸。",
  btChickens: "放鸡下地去掉了。",
  hnTreat: "伤员去掉了。",
  feedAnimals: "鸡舍每天早上自己喂。",
  collectAnimals: "蛋和奶自己进仓库。",
  gSoil: "肥力不再算了。",
  fSoilView: "肥力不再算了。",
  dDeposit: "地区仓库并进了农场仓库。",
  dWithdraw: "地区仓库并进了农场仓库。",
  dReserve: "地区仓库并进了农场仓库。",
  bDeposit: "前哨的仓库并进了农场仓库。",
  bWithdraw: "前哨的仓库并进了农场仓库。",
  bWithdrawAll: "前哨的仓库并进了农场仓库。",
  bShip: "货运停了：各处的东西直接进农场仓库。",
  sCanteen: "营业的晚上走到广场，食堂就自己开张。",
};
export function handleTrimAction(action, el, ctx) {
  const e = ctx?.engine;
  if (!on(e)) return false;
  // 去掉了的那几样：按钮可能还留在老页面上（手柄、快捷键），按了说一句
  if (GONE_ACTIONS[action]) {
    e.toast(GONE_ACTIONS[action], "warn");
    ctx.renderMenu?.();
    return true;
  }
  if (action === "btFert") {
    const [pid] = String(el?.dataset?.id || "").split("|");
    const p = e.plotById?.(pid) || e.plotById?.(Number(pid));
    if (p && e.applyFert(p, "grow")) ctx.save?.();
    ctx.renderMenu?.();
    return true;
  }
  return false;
}

