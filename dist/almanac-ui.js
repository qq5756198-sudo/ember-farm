// v0.29.0「四时」的界面：顶栏日期带时节；节庆日历上的四个时节；菜地告示牌和田边选种的“当季 / 反季”；
// 腌缸、土酒坛、嫁接果树、旧物摆件、鸡舍（亲近）、药柜（认蘑菇）的设施卡；建设页的旧物摆件；
// 居民卡：许医生认蘑菇；警报栏：野物、能取的缸、熟了的果子、夜里的好事、吃坏肚子。
import { ITEMS, BUILDINGS, CROPS } from "./data.js";
import { ALERT_HOOKS } from "./winter-ui.js";
import { RESIDENT_HOOKS, ROOM_HOOKS } from "./people-hooks.js";
import { buildingExtras as bustleExtras } from "./bustle-ui.js";
import { FESTIVALS } from "./seasons-data.js";
import {
  SEASONS,
  SEASON_BY_ID,
  SEASON_EXTRA,
  YEAR,
  SEASON_DAYS,
  seasonOf,
  seasonDay,
  yearOf,
  nextSeasonDay,
  CROP_SEASON,
  SEASON_RATE,
  FORAGE,
  JARS,
  TREES,
  TREE_IDS,
  treeType,
  cuttingId,
  TREE_RULES,
  DECOR,
  DECOR_BY_ID,
  decorItem,
  DECOR_RULES,
  HERD,
  HERD_NAMES,
  MUSHROOM,
  RAINY,
  DISHES,
} from "./almanac-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const act = (a, id, label, reason, primary = false) => button(a, id, label, reason ? `disabled title="${esc(reason)}"` : primary ? 'class="primary"' : "") + (reason ? `<small class="story-lack">${esc(reason)}</small>` : "");
const P = (text, cls = "") => `<p${cls ? ` class="${cls}"` : ""}>${esc(text)}</p>`;
const card = (lines, cls = "") => `<section class="td-card al-card${cls ? " " + cls : ""}">${lines.join("")}</section>`;
const FARM = (x, y, label) => ({ region: "farm", x, y, label });
const TREE_BY_TYPE = Object.fromEntries(TREE_IDS.map((id) => [treeType(id), id]));
const cropName = (id) => ITEMS[id]?.name || CROPS[id]?.name || id;
const goodCrops = (sid) => Object.entries(CROP_SEASON).filter(([id, [g]]) => g === sid && ITEMS[id]).map(([id]) => cropName(id));
const badCrops = (sid) => Object.entries(CROP_SEASON).filter(([id, [, b]]) => b === sid && ITEMS[id]).map(([id]) => cropName(id));
const pct = (v) => Math.round((v - 1) * 100);

// ================= 顶栏日期 =================
export function almanacDate(e) {
  if (!e?.al) return null;
  const d = e.s.day,
    s = seasonOf(d),
    next = nextSeasonDay(d),
    ns = seasonOf(next);
  return {
    text: "第 " + d + " 天 · " + s.name,
    title: "第 " + yearOf(d) + " 年 · " + s.name + "第 " + seasonDay(d) + " 天（还有 " + (next - d) + " 天到" + ns.name + "）· 点开看节庆日历和四个时节",
    season: s.id,
  };
}

// ================= 节庆日历：四个时节 =================
function seasonsCard(e) {
  const d = e.s.day,
    cur = seasonOf(d),
    y0 = (yearOf(d) - 1) * YEAR;
  const cols = SEASONS.map((s, i) => {
    const from = y0 + i * SEASON_DAYS + 1,
      to = from + SEASON_DAYS - 1,
      good = goodCrops(s.id),
      bad = badCrops(s.id),
      wild = (FORAGE[s.id] || []).map((id) => ITEMS[id]?.name).filter(Boolean);
    return `<article class="al-season${s.id === cur.id ? " now" : ""}"><h4>${esc(s.name)}<small>第 ${from}–${to} 天</small></h4><p>${esc(s.hint)}</p>${good.length ? `<p><b>当季（长得快 ${pct(SEASON_RATE.good)}%、每收多 ${SEASON_EXTRA} 份）</b>：${esc(good.join("、"))}</p>` : ""}${bad.length ? `<p class="muted">长得慢 ${pct(SEASON_RATE.bad)}%：${esc(bad.join("、"))}（温室里不受影响）</p>` : ""}<p class="muted">野地里：${esc(wild.join("、"))} · 收尾的节庆：${esc(FESTIVALS[s.fest]?.name || "")} · 当季菜：${esc(ITEMS[DISHES[s.id]]?.name || "")}${e.al.dishes.includes(DISHES[s.id]) ? "（学会了）" : ""}</p></article>`;
  }).join("");
  return `<section class="al-seasons"><h3>第 ${yearOf(d)} 年 · 现在是${esc(cur.name)}第 ${seasonDay(d)} 天</h3><p class="muted">一年 ${YEAR} 天，七天一个时节；每个时节最后一天是节庆，寒潮固定落在寒潮时节。早上电台说明天的天气和手气，每个时节第一天何大勺讲一道当季菜（电台修好才听得到）。</p><div class="al-season-grid">${cols}</div></section>`;
}
export function patchAlmanacCalendar(e, html) {
  if (!e?.al) return html;
  let out = html;
  const tagAt = (d, cls, text) => {
    const mark = "<b>第" + d + "天</b>",
      at = out.indexOf(mark);
    if (at < 0) return;
    const rest = out.slice(at + mark.length).replace(/^<span class="tag quiet">—<\/span>/, "");
    out = out.slice(0, at + mark.length) + '<span class="tag ' + cls + '">' + esc(text) + "</span>" + rest;
  };
  const wi = e.w?.winter,
    cold = !(wi && ["prep", "cold"].includes(wi.phase)) ? e.coldNext?.() : null;
  for (let d = e.s.day; d < e.s.day + 14; d++) {
    if (seasonDay(d) === 1) tagAt(d, "gold", seasonOf(d).name + "时节");
    if (cold && !cold.now && d >= cold.day && d < cold.day + cold.days) tagAt(d, "cold", d === cold.day ? "寒潮到" : "寒潮");
  }
  const at = out.indexOf("<p>未来两周");
  return at >= 0 ? out.slice(0, at) + seasonsCard(e) + out.slice(at) : out + seasonsCard(e);
}

// ================= 菜地告示牌、田边选种 =================
export function patchAlmanacBoard(e, html) {
  if (!e?.al || !html.includes('<div class="g-board">')) return html;
  const s = seasonOf(e.s.day),
    good = goodCrops(s.id),
    bad = badCrops(s.id);
  const sec = `<section class="al-board"><h3>${esc(s.name)}第 ${seasonDay(e.s.day)} 天：这一季种什么</h3><p>${good.length ? "当季（长得快 " + pct(SEASON_RATE.good) + "%、每收多 " + SEASON_EXTRA + " 份）：" + esc(good.join("、")) + "。" : ""}${bad.length ? "长得慢 " + pct(SEASON_RATE.bad) + "%：" + esc(bad.join("、")) + "（温室里不受影响）。" : ""}</p><p class="muted">当季的菜照料分 70 以上、收成是优质的时候，那一份优质有四分之一的机会是「上品」（卖价 2.2 倍）；这一茬施过提质肥，机会差不多一半。</p></section>`;
  return html.replace('<div class="g-board">', '<div class="g-board">' + sec);
}
export function patchSeedPicker(e, html) {
  if (!e?.al) return html;
  return html.replace(/data-action="gPlant" data-id="([^"]*)"([\s\S]*?)<span class="seed-tags">/g, (m, id, mid) => {
    const crop = ITEMS[id.split("|")[1]]?.crop,
      k = crop ? e.seasonKind(crop) : "";
    if (!k) return m;
    return m + `<span class="g-tag ${k}">${k === "good" ? "当季 快 " + pct(SEASON_RATE.good) + "% · 多收 " + SEASON_EXTRA + " 份" : "反季 长得慢 " + pct(SEASON_RATE.bad) + "%（温室里不受影响）"}</span>`;
  });
}
// 这块田：种着的作物这一季长得快还是慢
export function patchPlotSeason(e, ui, html) {
  if (!e?.al) return html;
  const p = e.plotById?.(ui?.id);
  if (!p?.crop) return patchSeedPicker(e, html);
  const k = e.seasonKind(p.crop),
    s = seasonOf(e.s.day);
  if (!k) return html;
  const glass = k === "bad" && e.underGlass(p);
  const line = `<p class="al-plot ${k === "good" ? "gold" : glass ? "muted" : "story-lack"}">${esc(s.name)}时节：${esc(cropName(p.crop))}${k === "good" ? "当季，长得快 " + pct(SEASON_RATE.good) + "%、收的时候多 " + SEASON_EXTRA + " 份" + (e.primeChance(p) ? "；照料分够，收成是优质时有 " + Math.round(e.primeChance(p) * 100) + "% 的机会出上品" : "") : glass ? "反季，但在温室里，照常长" : "反季，长得慢 " + pct(SEASON_RATE.bad) + "%（挪进温室就不受影响）"}。</p>`;
  const at = html.indexOf("</header>");
  return at >= 0 ? html.slice(0, at + 9) + line + html.slice(at + 9) : line + html;
}
// 电台：今天的手气签、明天的天气、学会的当季菜
export function patchAlmanacRadio(e, html) {
  if (!e?.al || !e.radioOn()) return html;
  const L = e.luckToday(),
    fc = e.forecast?.() || [],
    tom = fc.find((d) => d.day === e.s.day + 1)?.weather || "",
    learned = e.al.dishes.map((id) => ITEMS[id]?.name).filter(Boolean);
  return (
    html +
    `<section class="al-radio"><h3>早间广播（每天 07:00）</h3><p>今天的手气签：<b class="${L.tone === "warn" ? "story-lack" : L.tone === "gold" ? "gold" : ""}">${esc(L.name)}</b>——${esc(L.line)}</p>${tom ? `<p>明天：${esc(tom)}${RAINY.includes(tom) ? "（下雨天废墟里的感染者耳朵不灵，撬锁的声音也传不远）" : ""}</p>` : ""}<p class="muted">每个时节第一天何大勺在广播里讲一道当季菜，听过就会做（篝火灶）。学会了：${learned.length ? esc(learned.join("、")) : "还没有"}。</p></section>`
  );
}
// 四时这一层的页面补丁（套在热闹那一层外面）
export function renderAlmanacView(e, ui, base) {
  const html = base(e, ui);
  if (!e?.al || !ui) return html;
  if (ui.view === "calendar") return patchAlmanacCalendar(e, html);
  if (ui.view === "gPick") return patchSeedPicker(e, html);
  if (ui.view === "gPlot") return patchPlotSeason(e, ui, html);
  if (ui.view === "gBoard") return patchAlmanacBoard(e, html);
  if (ui.view === "radio") return patchAlmanacRadio(e, html);
  return html;
}

// ================= 设施卡 =================
function jarCard(e, b) {
  const J = JARS[b.type],
    st = e.jarState(b.id),
    rec = e.al.jars[b.id],
    lines = [];
  if (st.state === "empty") {
    lines.push(P("空着。装 " + J.take + " 份同一种东西，" + J.ready + " 天后能取（" + ITEMS[J.out].name + " ×" + J.n + "），放到 " + J.agedDays + " 天变成" + ITEMS[J.aged].name + "（卖 " + ITEMS[J.aged].sell + " 金，普通的 " + ITEMS[J.out].sell + " 金）。"));
    const rows = J.inputs
      .filter((id) => ITEMS[id])
      .map((id) => `<li>${esc(ITEMS[id].name)} <small>有 ${e.quantityForCost(id, true)}</small>${act("alJarFill", b.id + "|" + id, J.verb + " " + J.take + " 份", e.jarFillReason(b.id, id))}</li>`)
      .join("");
    lines.push(`<ul class="bt-list">${rows}</ul>`);
  } else {
    const what = ITEMS[rec.item]?.name || "";
    if (st.state === "brewing") lines.push(P(J.verb + "着 " + rec.n + " 份" + what + "：还要 " + st.left + " 天能取。"));
    else if (st.state === "ready") lines.push(P("能取了：" + ITEMS[J.out].name + " ×" + J.n + "。再放 " + st.left + " 天就是" + ITEMS[J.aged].name + "（价钱翻倍）——现在取、还是再等，看你。"));
    else lines.push(P("陈了：" + ITEMS[J.aged].name + " ×" + J.n + "。", "gold"));
    lines.push(`<div class="button-row">${act("alJarTake", b.id, "取出来", st.state === "brewing" ? "还要 " + st.left + " 天" : "", st.state !== "brewing")}</div>`);
  }
  if (b.type === "alWineJar") lines.push(P("土酒能在制作台和布一起做成 3 条消毒绷带；守夜纪念日能和 2 份腌菜一起当供品（最好的一档）。", "muted"));
  else lines.push(P("寒潮时节田里几乎不长，腌菜和老坛腌菜就是口粮；老坛腌菜还能做「腌菜炖土豆」。", "muted"));
  return card(lines, "al-jar");
}
function treeCard(e, b) {
  const k = TREE_BY_TYPE[b.type],
    T = TREES[k],
    rec = e.al.trees[b.id] || { planted: e.s.day, fruit: 0, stop: 0, winters: 0 },
    grown = e.s.day - rec.planted >= TREE_RULES.grow,
    lines = [];
  const tier = rec.winters >= 2 ? "上品" : rec.winters >= 1 ? "优质" : "普通";
  if (!grown) lines.push(P("还要 " + (TREE_RULES.grow - (e.s.day - rec.planted)) + " 天长成。长成以后" + SEASON_BY_ID[T.season].name + "时节每天早上结一个" + ITEMS[T.fruit].name + "，树上最多挂 " + TREE_RULES.hold + " 个。"));
  else lines.push(P(SEASON_BY_ID[T.season].name + "时节每天结一个" + ITEMS[T.fruit].name + "（现在结的是" + tier + "的；熬过 " + rec.winters + " 个寒潮时节，每熬过一个好一档）。树上挂着 " + rec.fruit + " 个。"));
  if (rec.stop > e.s.day) lines.push(P("枝条被感染者折断了，第 " + rec.stop + " 天才接着结果。", "story-lack"));
  lines.push(`<div class="button-row">${act("alTreePick", b.id, "摘果子（" + rec.fruit + "）", rec.fruit ? "" : grown ? "还没有熟的" : "还没长成", !!rec.fruit)}</div>`);
  return card(lines, "al-tree");
}
function decorCard(e, b) {
  const d = DECOR_BY_ID[b.decor];
  const n = e.decorOutside();
  return card([P(d ? d.desc : "一件从废墟柜子里翻出来的旧东西。"), P("摆在房间地板边算一类家具（舒适度 +1）；摆在屋外，营地里每摆一种不同的，大家心情 +" + DECOR_RULES.mood + "（最多 +" + DECOR_RULES.moodMax + "）。现在屋外摆着 " + n + " 种。回收会把摆件原样还给你。", "muted")], "al-decor");
}
function herdCard(e) {
  const rows = ["flock", "goat"]
    .filter((k) => e.herdHas(k))
    .map((k) => {
      const lv = e.herdLevel(k),
        pts = Math.round(e.al.herd[k].pts);
      return `<li><b>${esc(HERD_NAMES[k])}</b> 亲近 ${lv} 级 <small>（${pts}/${HERD.max}）</small>${act("alHerdPet", k, k === "goat" ? "梳梳毛" : "摸一摸", e.herdPetReason(k))}</li>`;
    })
    .join("");
  if (!rows) return "";
  const spooked = e.al.herd.spookDay === e.s.day;
  return card(
    [
      `<h4>牲口亲近</h4><ul class="bt-list">${rows}</ul>`,
      P("每天摸一摸 +" + HERD.pet + "、按时喂 +" + HERD.fed + "、鸡放出去吃虫 +" + HERD.out + "，一天没人摸 −" + HERD.decay + "。鸡群每高一级，每回多下一枚蛋的机会 +" + Math.round(HERD.eggPer * 100) + "%（5 级 " + Math.round(5 * HERD.eggPer * 100) + "%）；山羊 " + HERD.milkFrom + " 级起有机会多出一份奶（5 级 " + Math.round((5 - HERD.milkFrom + 1) * HERD.milkPer * 100) + "%）。", "muted"),
      spooked ? P("昨晚动静太大，它们受了惊：今天这一回不下蛋。", "story-lack") : P("夜里动静大（循声来的、夜袭）的话，它们会受惊，第二天那一回不产。", "muted"),
    ],
    "al-herd",
  );
}
function mushroomBlock(e) {
  const n = e.qty(MUSHROOM.raw, true);
  if (!n) return "";
  return card([P("没认过的野蘑菇 ×" + n + "：里面混着灰盖和白伞两种毒蘑菇。"), `<div class="button-row">${act("alMushroom", "", "请许医生认一认", e.mushroomReason(), true)}</div>`], "al-mush");
}
export function buildingExtras(e, b) {
  const base = bustleExtras(e, b);
  if (!e?.al || !b || !BUILDINGS[b.type]) return base;
  let out = "";
  if (JARS[b.type]) out += jarCard(e, b);
  if (TREE_BY_TYPE[b.type]) out += treeCard(e, b);
  if (b.type === "alDecor") out += decorCard(e, b);
  if (b.type === "coop") out += herdCard(e);
  if (b.type === "medCabinet") out += mushroomBlock(e);
  return base + out;
}
// 建设页：旧物摆件挑一件摆；果树写枝条从哪来
export function almanacBuildExtras(e, type) {
  if (!e?.al) return "";
  if (type === "alDecor") {
    const owned = e.decorOwned();
    if (!owned.length) return `<p class="muted">还没有摆件：废墟里的柜子偶尔翻得到（锁着的铁柜更容易）。</p>`;
    return `<div class="al-decor-pick">${owned.map((id) => button("alDecorPick", id, DECOR_BY_ID[id].name + " ×" + e.qty(decorItem(id), true))).join("")}</div>`;
  }
  const k = TREE_BY_TYPE[type];
  if (k && e.qty(cuttingId(k), true) < 1) return `<p class="muted">枝条去废弃居民区找那棵老${esc(TREES[k].name)}剪（按 E，每棵 ${TREE_RULES.cut} 天一次）。</p>`;
  return "";
}

// ================= 居民卡：许医生认蘑菇 =================
RESIDENT_HOOKS.push((e, r) => {
  if (!e?.al || !r || r.id !== "medic" || e.qty(MUSHROOM.raw, true) < 1) return "";
  return `<div class="al-mush"><p>许医生：“采回来的蘑菇先拿给我看看，灰盖、白伞那两种吃了要拉一整天。”</p>${act("alMushroom", "", "认蘑菇（" + e.qty(MUSHROOM.raw, true) + " 朵）", e.mushroomReason())}</div>`;
});

// ================= 农舍「房间与家具」：手上的摆件 =================
ROOM_HOOKS.push((e) => {
  if (!e?.al) return "";
  const owned = e.decorOwned();
  if (!owned.length) return "";
  return `<article class="frontier-card"><h3>旧物摆件</h3><p>摆在房间地板 75 步内算一类家具（摆件，舒适度 +1）；摆在屋外，营地里每摆一种不同的，大家心情 +${DECOR_RULES.mood}（最多 +${DECOR_RULES.moodMax}）。点一件，走到空地放下。</p>${almanacBuildExtras(e, "alDecor")}</article>`;
});

// ================= 警报栏 =================
ALERT_HOOKS.push((e, add) => {
  if (!e?.al) return;
  if (e.sickNow()) add(5, "吃坏肚子了：体力最多 60（还要 " + Math.ceil((e.al.sick - e.absNow()) / 60) + " 个钟点）", "warn", null);
  const g = e.al.good && !e.al.good.taken && e.al.good.day === e.s.day && e.al.good.x !== undefined ? e.al.good : null;
  if (g) add(6, g.kind === "debris" ? "田边落了一块卫星残骸：拆开有电路和零件" : "门口有个包裹", "gold", FARM(g.x, g.y, g.kind === "debris" ? "卫星残骸" : "包裹"));
  const f = e.al.forage;
  if (f.day === e.s.day) {
    const left = f.spots.filter((p) => !p.taken);
    const farm = left.filter((p) => p.region === "farm");
    if (left.length) add(9, "野地里还有 " + left.length + " 处野物" + (farm.length ? "（农场边 " + farm.length + " 处）" : ""), "normal", farm[0]?.x !== undefined ? FARM(farm[0].x, farm[0].y, ITEMS[farm[0].item]?.name || "野物") : null);
  }
  const ready = e.s.buildings.filter((b) => JARS[b.type] && ["ready", "aged"].includes(e.jarState(b.id).state));
  if (ready.length) add(8, ready.map((b) => JARS[b.type].name).join("、") + "能取了", "gold", FARM(ready[0].x, ready[0].y, JARS[ready[0].type].name));
  const fruit = e.s.buildings.filter((b) => TREE_BY_TYPE[b.type] && (e.al.trees[b.id]?.fruit || 0) >= TREE_RULES.hold);
  if (fruit.length) add(9, "果树挂满了，再不摘就不长了", "normal", FARM(fruit[0].x, fruit[0].y, "果树"));
});

// ================= 动作 =================
const ACTIONS = ["alJarFill", "alJarTake", "alTreePick", "alHerdPet", "alDecorPick", "alMushroom"];
export function handleAlmanacAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, closeMenu, renderMenu, save } = ctx,
    id = el?.dataset?.id || "";
  if (!e?.al) return true;
  let ok = false;
  if (action === "alJarFill") {
    const [bid, item] = id.split("|");
    ok = e.jarFill(bid, item);
  } else if (action === "alJarTake") ok = e.jarTake(id);
  else if (action === "alTreePick") ok = e.treePick(id);
  else if (action === "alHerdPet") ok = e.herdPet(id);
  else if (action === "alMushroom") ok = e.identifyMushrooms();
  else if (action === "alDecorPick") {
    ok = e.decorChoose(id);
    if (ok) {
      save();
      closeMenu();
      return true;
    }
  }
  if (ok) save();
  renderMenu();
  return true;
}
