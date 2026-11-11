// v0.50 新界面：整页（队友、仓库、地图、手记、设置）和建造抽屉。
// 只排版；按钮上写 data-act，真正改东西的在 pageAct 里调引擎。
import { ITEMS, BUILDINGS, RECIPES, TRADERS, REGIONS, WEAPONS } from "./data.js";
import { BCARD, BUILD_GROUPS } from "./simple-data.js";
import { LETTERS, letterText, letterTitle } from "./alliance-data.js";
import { slotOfGear } from "./gear-sprites.js";
import { gearDef, ARMOR } from "./gear-data.js";
import { CHAPTERS, CN_NUM, BUILD_TABS, CH_BUILD, GATE1 } from "./chapter-data.js";
import { GAME_RELEASE } from "./version.js";
import { esc, svg, itemIcon, portrait, buildArt, costTags, tabsHtml, escBtn, itemName, fmt, hhmm } from "./app-kit.js";

const pageHead = (title, tabs = "", right = "") => `<div class="head"><div class="left"><h1 class="h1">${esc(title)}</h1>${tabs}</div><div class="row">${right}${escBtn()}</div></div>`;

// ================= 建造抽屉 =================
function buildList(e, tab) {
  const group = BUILD_GROUPS.find((g) => g[0] === tab);
  if (!group) return [];
  return group[2].filter((id) => BUILDINGS[id] && !BUILDINGS[id].retired && e.chBuildChapter(id) > 0 && e.chBuildChapter(id) <= e.chNow() + 1);
}
export function buildHtml(G) {
  const e = G.e,
    ui = G.ui,
    tab = ui.tab || "guard",
    tabs = BUILD_TABS.map((t) => ({ id: t.id, name: t.name, locked: t.chapter && t.chapter > e.chNow(), note: t.chapter && t.chapter > e.chNow() ? "第" + CN_NUM[t.chapter] + "章" : "" }));
  let want = "";
  try {
    want = e.hyWant?.().build || "";
  } catch {
    want = "";
  }
  const ids = buildList(e, tab).sort((a, b) => (b === want) - (a === want) || e.chBuildChapter(a) - e.chBuildChapter(b));
  const sel = ids.includes(ui.sel) ? ui.sel : ids.find((id) => e.chBuildOpen(id)) || "";
  ui.sel = sel;
  const count = (id) => e.s.buildings.filter((b) => b.type === id && b.hp > 0).length;
  const cards = ids
    .map((id) => {
      const b = BUILDINGS[id],
        c = BCARD[id] || [b.desc, ""],
        open = e.chBuildOpen(id),
        n = count(id);
      if (!open) return `<div class="bcard locked"><span class="art">${svg("lock", 26, "#8a8478")}</span><span class="nm">${esc(b.name)}</span><span class="small mut">${esc(c[0])}</span><span class="small amber" style="margin-top:auto">第${CN_NUM[e.chBuildChapter(id)]}章能建</span></div>`;
      return `<button class="bcard${id === sel ? " on" : ""}" data-act="bsel" data-id="${id}" aria-pressed="${id === sel}"><span class="art">${buildArt(id, 168, 60)}</span><span class="nm">${esc(b.name)}<small>${id === want ? '<span class="amber">这一步要</span>' : n ? "已有 " + n : ""}</small></span><span class="fx">${esc(c[0])}</span><span class="cost">${costTags(e, b.cost)}</span></button>`;
    })
    .join("");
  let detail = `<div class="detail"><p class="mut">这一格里现在没有能建的。</p></div>`;
  if (sel) {
    const b = BUILDINGS[sel],
      c = BCARD[sel] || [b.desc, ""],
      away = e.s.region !== "farm",
      ok = e.afford(b.cost) && !away;
    detail = `<div class="detail"><div class="between"><b class="h2">${esc(b.name)}</b><span class="small mut">已有 ${count(sel)}</span></div><p class="small mut">${esc(c[1] || c[0])}</p><div class="cost">${costTags(e, b.cost)}</div>${away ? `<p class="why">回到农场才能建。</p>` : !ok ? `<p class="why">材料不够：缺的那一格标红了。</p>` : `<p class="small mut">放下去的那一刻才花材料。</p>`}<button class="btn primary" style="margin-top:auto" data-act="bplace" data-id="${sel}" ${ok ? "" : "disabled"}>拿去放</button></div>`;
  }
  return `<div class="head"><div class="left"><h1 class="h1">建造</h1>${tabsHtml(tabs, tab, "btab")}</div><div class="row"><button class="btn small" data-act="bdismantle">拆掉一样设施</button>${escBtn()}</div></div><div class="body"><div class="cards">${cards || `<div class="empty grow">这一格的东西后面几章才有。</div>`}</div>${detail}</div>`;
}

// ================= 队友 =================
export function teamHtml(G) {
  const e = G.e,
    ui = G.ui,
    team = e.chTeam(),
    tab = ui.tab || "roster",
    tabs = [
      { id: "roster", name: "名册" },
      { id: "jobs", name: "岗位", locked: !e.chOpen("jobs"), note: e.chOpen("jobs") ? "" : "第二章" },
      { id: "squad", name: "出门队伍", locked: !e.chOpen("squad"), note: e.chOpen("squad") ? "" : "第二章" },
    ];
  const sel = team.find((t) => t.key === ui.sel) || team[0];
  ui.sel = sel?.key || "";
  const people = e.chPeople();
  const list = team.map((t) => `<button class="person${t.key === ui.sel ? " on" : ""}" data-act="psel" data-id="${t.key}">${portrait(t.lookKey, t.lookRole, 48)}<span class="grow"><b style="font-size:16px;display:block">${esc(t.name)}</b><span class="small mut">${esc(t.job)} · ${esc(t.temper)}</span></span>${t.fed ? "" : `<span class="tag bad">没吃上</span>`}</button>`).join("");
  const jobs = team.map((t) => `<div class="card col"><div class="between"><b class="h2">${esc(t.job)}</b><span class="small mut">${esc(t.name)}</span></div><div class="row">${portrait(t.lookKey, t.lookRole, 52)}<p class="small grow">${esc(t.does)}</p></div><p class="small mut" style="margin-top:auto">${esc(t.status)}</p></div>`).join("");
  const detail = sel
    ? `<div class="side card" style="width:320px"><div class="row">${portrait(sel.lookKey, sel.lookRole, 88)}<div class="col" style="gap:2px"><span class="h1">${esc(sel.name)}</span><span class="small mut">${esc(sel.from)}</span><span class="tag ${sel.fed ? "good" : "bad"}" style="align-self:flex-start">${sel.fed ? "今天吃过了" : "今天还没吃上"}</span></div></div><div><div class="small mut">在做的事</div><p><b>${esc(sel.job)}</b>：${esc(sel.does)}</p></div><div><div class="small mut">脾气</div><p>${esc(sel.temper)}</p></div><div><div class="small mut">眼下</div><p>${esc(sel.status || "在营地里")}</p></div><p class="small mut" style="margin-top:auto">每人每天吃 2 份口粮，晚上 18:00 开饭。没吃上的人第二天干活慢一半。</p><p class="small amber">第二章起可以给每个人派岗位、带两个人出门。</p></div>`
    : "";
  return `${pageHead("队友", tabsHtml(tabs, tab))}<div class="body"><div class="side" style="width:280px"><div class="small mut">营地里 ${people.n} 个人（连你），床位 ${people.beds}</div><div class="list scroll grow">${list || `<div class="empty">还没有人来。</div>`}</div><div class="empty small" style="padding:10px 12px;text-align:left">出门时救下的人会住进来。多一个人多一张嘴，也多一双手。</div></div><div class="pane scroll"><div class="jobs">${jobs}<div class="card locked col"><b class="h2">岗位</b><p class="small">田地、灶台、望台……第二章起每个岗位都能自己派人。</p></div><div class="card locked col"><b class="h2">跟我出门</b><p class="small">第二章起出门可以带两个人：会打、会背东西、倒下了要你救。</p></div></div></div>${detail}</div>`;
}

// ================= 仓库：物品、生产、买卖 =================
const TYPE_ORDER = { tool: 0, weapon: 1, gear: 2, food: 3, medicine: 4, crop: 5, seed: 6, resource: 7, blueprint: 8 };
const sortItems = (list) => list.sort(([a], [b]) => (TYPE_ORDER[ITEMS[a]?.type] ?? 9) - (TYPE_ORDER[ITEMS[b]?.type] ?? 9) || (ITEMS[a]?.name || a).localeCompare(ITEMS[b]?.name || b, "zh-CN"));
function itemsTab(G) {
  const e = G.e,
    ui = G.ui,
    s = e.s,
    farm = s.region === "farm",
    bag = sortItems(Object.entries(s.inventory).filter(([id, n]) => n > 0 && ITEMS[id])),
    box = sortItems(Object.entries(s.storage).filter(([id, n]) => n > 0 && ITEMS[id]));
  if (!ui.item || (!e.qty(ui.item) && !(s.storage[ui.item] > 0))) ui.item = bag[0]?.[0] || box[0]?.[0] || "";
  const cell = (id, n, where) => `<button class="cell${ui.item === id && ui.where === where ? " on" : ""}" data-act="isel" data-id="${id}" data-a="${where}" title="${esc(itemName(id))}" aria-label="${esc(itemName(id) + " " + n)}">${itemIcon(id, 44)}${e.isWorn?.(id) && where === "bag" ? `<span class="w">${WEAPONS[id] || ITEMS[id]?.type === "weapon" ? "带" : "穿"}</span>` : ""}<span class="q">${n}</span></button>`;
  let detail = `<p class="mut">点一样东西，看它是干什么的。</p>`;
  const id = ui.item;
  if (id && ITEMS[id]) {
    const it = ITEMS[id],
      inBag = e.qty(id),
      inBox = s.storage[id] || 0,
      slot = slotOfGear?.(id),
      worn = !!e.isWorn?.(id),
      eqWhy = slot ? e.equipReason?.(id) || "" : "",
      useWhy = it.use && e.useItemReason ? e.useItemReason(id) : "";
    const btns = [];
    if ((it.food || it.heal) && inBag) btns.push(`<button class="btn primary" data-act="eat" data-id="${id}">${it.type === "medicine" ? "用一份" : "吃一份"}</button>`);
    if (it.use && e.useItem) btns.push(`<button class="btn" data-act="useitem" data-id="${id}" ${useWhy ? "disabled" : ""}>${esc(it.use)}</button>`);
    if (it.type === "seed" && inBag) btns.push(`<button class="btn" data-act="seed" data-id="${id}">放到快捷栏 3</button>`);
    if (slot && inBag) btns.push(`<button class="btn" data-act="equip" data-id="${id}" ${eqWhy || worn ? "disabled" : ""}>${worn ? "已经带着" : WEAPONS[id] || it.type === "weapon" ? "拿上" : "穿上"}</button>`);
    if (!it.protected && inBag && farm) btns.push(`<button class="btn" data-act="put" data-id="${id}">存进仓库</button>`);
    if (inBox && farm) btns.push(`<button class="btn" data-act="take" data-id="${id}">取到身上</button>`);
    const purpose = e.itemPurpose?.(id) || "";
    detail = `<div class="row"><div class="cell" style="flex:none">${itemIcon(id, 44)}</div><div><b class="h2">${esc(it.name)}</b><div class="small mut">身上 ${inBag} · 仓库 ${inBox}</div></div></div><p class="small">${esc(it.desc || purpose)}</p>${purpose && purpose !== it.desc ? `<p class="small good">${esc(purpose)}</p>` : ""}${wearHtml(e, id)}${eqWhy && !worn ? `<p class="why">${esc(eqWhy)}</p>` : ""}${useWhy ? `<p class="why">${esc(useWhy)}</p>` : ""}<div class="btn-row" style="margin-top:auto">${btns.join("")}</div>${!farm ? `<p class="small mut">仓库在农场，回去才能存取。</p>` : `<p class="small mut">按住 Shift 点存取，一次一整组。</p>`}`;
  }
  const used = Object.keys(s.inventory).filter((k) => s.inventory[k] > 0).length;
  return `<div class="pane col" style="gap:14px"><div class="between"><b class="h2">身上</b><span class="small ${used >= e.capacity() ? "bad" : "mut"}">${used} / ${e.capacity()} 格</span></div><div class="cells scroll" style="max-height:44%">${bag.map(([i, n]) => cell(i, n, "bag")).join("") || `<span class="mut">空的</span>`}</div><div class="between"><b class="h2">仓库</b><div class="btn-row"><button class="btn small" data-act="putall" ${farm ? "" : "disabled"}>普通东西都存进去</button></div></div><div class="cells scroll grow">${box.map(([i, n]) => cell(i, n, "box")).join("") || `<span class="mut">仓库里还没有东西。做好的东西、队友搬回来的东西会放在这里。</span>`}</div></div><div class="side card" style="width:320px">${detail}</div>`;
}
// 会坏的家伙（武器、防具）：耐久多少、坏了会怎样、能不能修。只读，不动存档里的数。
function wearOf(e, id) {
  const def = gearDef(id);
  if (!def?.dur || !e.gr) return null;
  const c = e.gr.cond?.[id],
    max = c?.m ?? e.baseMax(id),
    d = c?.d ?? max;
  return { d: Math.max(0, Math.ceil(d)), max, worn: d < max, broken: d <= 0, armor: !!ARMOR[id] };
}
function wearHtml(e, id, compact = false) {
  const w = wearOf(e, id);
  if (!w) return "";
  const bar = `<div class="between small"><span class="mut">耐久</span><span class="${w.broken ? "bad" : w.d <= w.max * 0.25 ? "amber" : ""}">${w.d} / ${w.max}${w.broken ? (w.armor ? " · 坏了，没有保护" : " · 坏了，伤害减半") : ""}</span></div><span class="bar"><i style="width:${Math.round((w.d / Math.max(1, w.max)) * 100)}%${w.broken ? ";background:var(--bad)" : ""}"></i></span>`;
  if (!w.worn) return compact ? "" : bar;
  let why = e.repairReason(id);
  const cost = e.repairCost(id);
  // 农场上还没有武器工作台：说清楚要先建一座
  if (/武器台/.test(why) && !e.s.buildings.some((b) => b.type === "weaponbench" && b.hp > 0)) why = "要先建一座武器工作台（建造 · 吃住），再在那儿修";
  return `${bar}<div class="between" style="gap:8px"><span class="cost">${cost ? costTags(e, cost) : ""}</span><button class="btn small${why || compact ? "" : " primary"}" style="height:40px" data-act="repairgear" data-id="${id}" ${why ? "disabled" : ""}>修好它</button></div>${why ? `<p class="why">${esc(why)}</p>` : compact ? "" : `<p class="small mut">修一次，耐久上限少一成；修过 5 次只能换新的。</p>`}`;
}
const STATION_ORDER = ["", "cook", "workbench", "weaponbench", "breeder"];
function makeTab(G) {
  const e = G.e,
    ui = G.ui,
    farm = e.s.region === "farm",
    has = (st) => !st || e.s.buildings.some((b) => b.type === st && b.hp > 0),
    stations = STATION_ORDER.filter(has);
  if (!stations.includes(ui.station ?? "x")) ui.station = stations.includes("cook") ? "cook" : "";
  const st = ui.station;
  let want = "";
  try {
    want = e.hyWant?.().recipe || "";
  } catch {
    want = "";
  }
  const list = RECIPES.filter((r) => (st ? (st === "weaponbench" ? String(r.station || "").startsWith("weaponbench") : r.station === st) : !r.station))
    .map((r) => ({ r, why: e.recipeReason(r) }))
    .filter((x) => !/蓝图|先探索|二级/.test(x.why) || x.r.id === want)
    .sort((a, b) => (b.r.id === want) - (a.r.id === want) || !!a.why - !!b.why);
  const rows = list
    .map(({ r, why }) => {
      const out = Object.keys(r.out)[0],
        batch = r.minutes ? why || e.batchReason(r.id, 5) : "x";
      return `<div class="item-row"><span class="well">${itemIcon(out, 40)}</span><span class="grow"><b>${esc(itemName(out))} ×${r.out[out]}${r.id === want ? ` <span class="tag amber">这一步要</span>` : ""}</b><span class="small mut" style="display:block">${esc(e.itemPurpose?.(out) || r.desc || "")}</span><span class="cost" style="margin-top:4px">${costTags(e, e.effectiveCost ? e.effectiveCost(r.cost) : r.cost)}${r.minutes ? `<span class="tag info">${r.minutes} 游戏分钟</span>` : ""}</span>${why && why !== "材料不足" ? `<span class="why" style="display:block">${esc(why)}</span>` : ""}</span><span class="btn-row"><button class="btn${why ? "" : " primary"} small" style="height:40px" data-act="craft" data-id="${r.id}" ${why || !farm && r.station ? "disabled" : ""}>${r.minutes ? "放进去做" : "做一个"}</button>${r.minutes ? `<button class="btn small" style="height:40px" data-act="craft5" data-id="${r.id}" ${batch || !farm ? "disabled" : ""}>放 5 批</button>` : ""}</span></div>`;
    })
    .join("");
  const jobs = e.c?.production || [];
  const queue = jobs
    .map((j) => {
      const o = Object.keys(j.out)[0];
      return `<div class="item-row"><span class="well">${itemIcon(o, 40)}</span><span class="grow"><b>${esc(itemName(o))} ×${j.out[o]}</b><span class="small ${j.ready ? "good" : "mut"}" style="display:block">${j.ready ? "做好了" : "还要 " + Math.ceil(j.remaining) + " 游戏分钟"}</span></span>${j.ready ? `<button class="btn primary small" style="height:40px" data-act="collect" data-id="${j.id}" ${farm ? "" : "disabled"}>收起来</button>` : ""}</div>`;
    })
    .join("");
  // 武器台：用旧了的武器、防具在这里修
  let fix = "";
  if (st === "weaponbench") {
    const ids = [...new Set([...Object.keys(e.s.inventory), ...Object.keys(e.s.storage)])].filter((i) => (e.s.inventory[i] || 0) + (e.s.storage[i] || 0) > 0 && wearOf(e, i)?.worn);
    fix = ids.length
      ? ids.map((i) => `<div class="item-row" style="align-items:flex-start"><span class="well">${itemIcon(i, 40)}</span><span class="grow col" style="gap:4px"><b>${esc(itemName(i))}${e.isWorn?.(i) ? ` <span class="tag">${WEAPONS[i] || ITEMS[i]?.type === "weapon" ? "带着" : "穿着"}</span>` : ""}</b>${wearHtml(e, i, true)}</span></div>`).join("")
      : `<div class="empty small">武器和防具都没用旧。用旧了回这里修。</div>`;
    fix = `<div class="between"><b class="h2">修理</b><span class="small mut">修一次，耐久上限少一成；修过 5 次只能换新的</span></div>${fix}<b class="h2" style="margin-top:6px">做新的</b>`;
  }
  const stTabs = stations.map((x) => ({ id: x || "hand", name: x ? BUILDINGS[x].name : "随手做" }));
  return `<div class="pane col" style="gap:10px">${tabsHtml(stTabs, st || "hand", "station")}${!farm && st ? `<p class="why">设施在农场，回去才能用。</p>` : ""}<div class="list scroll grow">${fix}${rows || `<div class="empty">这里现在没有能做的东西。</div>`}</div></div><div class="side" style="width:340px"><div class="between"><b class="h2">在做的</b><span class="small mut">${jobs.length} / 12</span></div><div class="list scroll grow">${queue || `<div class="empty small">灶上、台子上都空着。</div>`}</div>${jobs.some((j) => j.ready) ? `<button class="btn primary" data-act="collectall" ${farm ? "" : "disabled"}>做好的都收进仓库</button>` : ""}<p class="small mut">做好的东西到钟点自己进仓库；铁锹在的话会替你搬。</p></div>`;
}
function tradeTab(G) {
  const e = G.e,
    ui = G.ui,
    s = e.s,
    farm = s.region === "farm",
    tid = ui.trader && TRADERS[ui.trader] && s.region === "market" ? ui.trader : "";
  if (tid) {
    const tr = TRADERS[tid],
      dir = ui.dir === "sell" ? "sell" : "buy",
      stock = e.traderStock(tid),
      entries = dir === "buy" ? Object.entries(stock).filter(([, n]) => n > 0) : Object.entries(s.inventory).filter(([i, n]) => n > 0 && ITEMS[i]?.sell && (!ITEMS[i].protected || ITEMS[i].type === "seed"));
    const rows = entries
      .map(([i, n]) => {
        const price = e.price(tid, i, dir),
          poor = dir === "buy" && s.money < price;
        return `<div class="item-row"><span class="well">${itemIcon(i, 40)}</span><span class="grow"><b>${esc(itemName(i))}${dir === "sell" && tr.want?.includes(i) ? ` <span class="tag good">他正缺</span>` : ""}</b><span class="small mut" style="display:block">${dir === "buy" ? "摊上有" : "身上有"} ${n} · 一份 <span class="${poor ? "bad" : ""}">${price} 金</span></span></span><input class="qty" type="number" min="1" max="${n}" value="1" aria-label="${esc(itemName(i))}几份"><button class="btn small${poor ? "" : " primary"}" style="height:40px" data-act="trade" data-id="${i}" ${poor ? "disabled" : ""}>${dir === "buy" ? "买" : "卖"}</button></div>`;
      })
      .join("");
    return `<div class="pane col" style="gap:10px"><div class="between">${tabsHtml(
      [
        { id: "buy", name: "买" },
        { id: "sell", name: "卖" },
      ],
      dir,
      "tdir",
    )}<span>手上 <b class="pix" style="font-size:24px">${fmt(s.money)}</b> 金</span></div><div class="list scroll grow">${rows || `<div class="empty">${dir === "buy" ? "今天摊上卖空了，明天补货。" : "身上没有能卖的东西。"}</div>`}</div></div><div class="side card" style="width:320px"><b class="h2">${esc(tr.name)}</b><p class="small mut">${esc(tr.desc || "")}</p><p class="small">每天 0 点补货。他正缺的东西，卖价高一成半。</p></div>`;
  }
  // 出货箱（在农场）
  const goods = sortItems(Object.entries(s.inventory).filter(([i, n]) => n > 0 && ITEMS[i] && !ITEMS[i].protected && e.shipPrice?.(i) > 0)),
    boxed = Object.entries(e.o?.shipBox || {});
  const rows = goods.map(([i, n]) => `<div class="item-row"><span class="well">${itemIcon(i, 40)}</span><span class="grow"><b>${esc(itemName(i))} ×${n}</b><span class="small mut" style="display:block">一份 ${e.shipPrice(i)} 金</span></span><span class="btn-row"><button class="btn small" style="height:40px" data-act="ship" data-id="${i}" data-a="1" ${farm ? "" : "disabled"}>放 1 份</button><button class="btn small" style="height:40px" data-act="ship" data-id="${i}" data-a="${n}" ${farm ? "" : "disabled"}>全放</button></span></div>`).join("");
  const box = boxed.map(([i, n]) => `<div class="item-row"><span class="well">${itemIcon(i, 40)}</span><span class="grow"><b>${esc(itemName(i))} ×${n}</b><span class="small good" style="display:block">明早 +${e.shipPrice(i) * n} 金</span></span><button class="btn small" style="height:40px" data-act="unship" data-id="${i}" ${farm ? "" : "disabled"}>取回</button></div>`).join("");
  return `<div class="pane col" style="gap:10px"><div class="between"><b class="h2">出货箱</b><span class="small mut">放进去的东西，夜里 0 点按收购价卖掉，钱直接入账</span></div>${farm ? "" : `<p class="why">出货箱在农场，回去才能放。</p>`}<div class="list scroll grow">${rows || `<div class="empty">身上没有能卖的东西。菜、做好的吃食、多的材料都能卖。</div>`}</div></div><div class="side" style="width:340px"><div class="between"><b class="h2">箱子里</b><span class="good">明早 +${e.shipValue?.() || 0} 金</span></div><div class="list scroll grow">${box || `<div class="empty small">箱子是空的。</div>`}</div><p class="small mut">想当场换东西，去集市找林姨（粮食、种子）和老周（零件、工具）：地图上点“幸存者集市”。</p></div>`;
}
export function storeHtml(G) {
  const ui = G.ui,
    tab = ui.tab || "items",
    ready = (G.e.c?.production || []).filter((j) => j.ready).length,
    tabs = [
      { id: "items", name: "物品" },
      { id: "make", name: "生产", note: ready ? ready + " 份好了" : "" },
      { id: "trade", name: "买卖" },
    ];
  return `${pageHead("仓库", tabsHtml(tabs, tab))}<div class="body">${tab === "make" ? makeTab(G) : tab === "trade" ? tradeTab(G) : itemsTab(G)}</div>`;
}

// ================= 地图 =================
const POINTS = { farm: [160, 350], market: [365, 450], residential: [475, 270], hospital: [660, 400], warehouse: [665, 170], valley: [145, 200], stationMarket: [400, 610], courtyard: [440, 110], quarantine: [860, 405], railDepot: [790, 170], pinewood: [125, 75], shipyard: [655, 610], shelter: [675, 285], frost: [895, 70], archive: [890, 610] };
const ROUTES = [["farm", "market"], ["market", "residential"], ["residential", "hospital"], ["hospital", "warehouse"], ["farm", "valley"], ["market", "stationMarket"], ["residential", "courtyard"], ["hospital", "quarantine"], ["warehouse", "railDepot"], ["valley", "pinewood"], ["stationMarket", "shipyard"], ["courtyard", "shelter"], ["railDepot", "frost"], ["shipyard", "archive"]];
const REGION_NOTE = { farm: "家。种地、做饭、睡觉都在这儿。", market: "林姨卖粮食和种子，老周卖零件和工具。没有感染者。", residential: "废弃的住宅区。柜子里有木头、铁皮和种子；感染者不多，但会叫。" };
export function mapHtml(G) {
  const e = G.e,
    ui = G.ui,
    here = e.s.region,
    sel = REGIONS[ui.sel] ? ui.sel : here;
  ui.sel = sel;
  const open = (id) => e.chRegionOpen(id),
    busy = e.s.horde.phase === "active";
  const lines = ROUTES.filter(([a, b]) => POINTS[a] && POINTS[b] && REGIONS[a] && REGIONS[b])
    .map(([a, b]) => `<line x1="${POINTS[a][0]}" y1="${POINTS[a][1]}" x2="${POINTS[b][0]}" y2="${POINTS[b][1]}" stroke="${open(a) && open(b) ? "#c9b98a" : "#4a564e"}" stroke-width="${open(a) && open(b) ? 4 : 2}" stroke-dasharray="${open(a) && open(b) ? "" : "6 8"}" />`)
    .join("");
  const places = Object.keys(POINTS)
    .filter((id) => REGIONS[id])
    .map((id) => `<button class="place${id === here ? " here" : ""}${id === sel ? " on" : ""}${open(id) ? "" : " locked"}" style="left:${POINTS[id][0] / 10}%;top:${POINTS[id][1] / 7}%" data-act="msel" data-id="${id}"><b>${esc(REGIONS[id].name)}</b>${id === here ? `<span class="good">你在这儿</span>` : open(id) ? "" : `<span>还去不了</span>`}</button>`)
    .join("");
  const r = REGIONS[sel],
    grave = e.s.grave?.region === sel;
  const side = `<div class="side card" style="width:320px"><b class="h1">${esc(r.name)}</b>${open(sel) ? `<p>${esc(REGION_NOTE[sel] || r.res || "")}</p>` : `<p class="mut">这条路后面几章再走。先把农场守住。</p>`}${grave ? `<span class="tag amber" style="align-self:flex-start">你掉的背包还在这儿</span>` : ""}${sel !== "farm" && open(sel) && e.isNight?.() ? `<span class="tag bad" style="align-self:flex-start">天黑了：外面看不远，感染者更多</span>` : ""}${busy && sel !== "farm" ? `<p class="why">尸潮正在进攻，先守住家。</p>` : ""}<div style="margin-top:auto" class="col">${sel === here ? `<button class="btn" disabled>你就在这儿</button>` : `<button class="btn primary" data-act="travel" data-id="${sel}" ${open(sel) && !busy ? "" : "disabled"}>去${esc(r.name)}</button>`}<p class="small mut">出门一趟：翻到头一样东西以后，三样好处里挑一样，只管这一趟。带回来的东西都留下。</p></div></div>`;
  return `${pageHead("地图")}<div class="body"><div class="atlas"><svg viewBox="0 0 1000 700" preserveAspectRatio="none" aria-hidden="true"><rect width="1000" height="700" fill="#22382d"/><path d="M0 20L70 0H430L470 62L440 150L330 205L290 325L165 390L0 352Z" fill="#2f4a36"/><path d="M570 0H1000V180L910 155L850 190L740 145L650 120Z" fill="#4c5a52"/><path d="M0 575L170 565L255 530L335 563L440 533L580 580L700 529L755 540L820 479L1000 470V700H0Z" fill="#2c4e52"/><path d="M250 140L290 225L265 320L325 360L340 465L415 545" fill="none" stroke="#4d7a74" stroke-width="14"/>${lines}</svg>${places}</div>${side}</div>`;
}

// ================= 手记：主线、消息 =================
function mainTab(G) {
  const e = G.e,
    g = e.chGoal(),
    n = e.chNow(),
    gate = g.gate;
  const chapters = [1, 2, 3, 4, 5]
    .map((k) => {
      const c = CHAPTERS[k],
        cls = e.chDone(k) ? "done" : k === n ? "now" : "later";
      return `<div class="chap ${cls}"><div class="small ${k === n ? "amber" : ""}">第${CN_NUM[k]}章${e.chDone(k) ? " · 做完了" : k === n ? " · 现在" : c.open ? "" : " · 下一版"}</div><b class="pix" style="font-size:24px;line-height:28px">${esc(c.name)}</b><p class="small">${esc(c.goal)}</p><p class="small mut">考验：${esc(c.gate)}</p></div>`;
    })
    .join("");
  const steps = g.lines.map((l) => `<div class="step${l.done ? " done" : ""}${!l.done && g.step && (l.id === g.step.id || g.step.id === "prep:" + l.id) ? " now" : ""}"><span>${l.done ? svg("check", 16, "#7fd1a0") + " " : ""}${esc(l.text)}</span><span class="${l.done ? "" : "amber"}">${esc(l.note || (l.done ? "好了" : ""))}</span></div>`).join("");
  const gateBox =
    gate.state === "won"
      ? `<div class="card col"><b class="h2">第一场尸潮</b><p class="good">守住了。</p></div>`
      : `<div class="card col${["omen", "tonight", "active"].includes(gate.state) ? " warn" : ""}"><div class="between"><b class="h2">把关的考验：第一场尸潮</b><span class="tag ${["omen", "tonight", "active"].includes(gate.state) ? "bad" : "amber"}">${esc(gate.when)} ${gate.hour}:00</span></div><p class="small">它们从东边的路口进来，来 ${gate.count} 只上下。仓库里的粮越多、围栏越多，来得越多。那一夜倒下一回，铁锹会把你拖回农舍；再倒下就算没守住，下一个夜里重来。${gate.tries ? "上一回没守住，这是第 " + (gate.tries + 1) + " 回。" : ""}</p><div class="steps">${e
          .chPrepLines()
          .map((l) => `<div class="step${l.done ? " done" : ""}"><span>${esc(l.text)}</span><span class="${l.done ? "good" : "bad"}">${esc(l.note)}</span></div>`)
          .join("")}</div>${gate.canCall ? `<button class="btn" data-act="callgate">都备好了：今晚就迎战</button>` : `<p class="small mut">${e.s.day < GATE1.earlyFrom ? "第 " + GATE1.earlyFrom + " 天起，备好了可以提前一晚迎战。" : "备好上面三样、接回阿禾以后，可以提前迎战。"}</p>`}</div>`;
  // 这一步当场能做的事：直接给按钮
  const farm = e.s.region === "farm";
  let doing = "";
  if (g.step?.id === "choice") doing = `<button class="btn primary" style="height:44px" data-act="opensupply">挑一包</button>`;
  else if (g.step?.id === "farmerMeal") doing = `<button class="btn primary" style="height:44px" data-act="feed" ${farm && e.quantityForCost("bread", true) ? "" : "disabled"}>现在就开饭</button>`;
  else if (g.step?.id === "table") {
    const stage = e.projectStage("market") >= 1,
      bench = e.chCount("workbench") > 0,
      beds = e.residentsCapacity() >= 2,
      row = (ok, text, btn) => `<div class="step${ok ? " done" : ""}"><span>${ok ? svg("check", 16, "#7fd1a0") + " " : ""}${text}</span>${ok ? `<span>好了</span>` : btn}</div>`;
    doing = `<div class="steps" style="width:100%">${row(stage, `公共餐桌备料 <span class="cost" style="display:inline-flex;margin-left:8px">${stage ? "" : costTags(e, { wood: 12, radish: 9 })}</span>`, `<button class="btn small primary" data-act="project" data-id="market" ${farm && e.afford({ wood: 12, radish: 9 }) ? "" : "disabled"}>交料</button>`)}${row(bench, "一张制作台", `<button class="btn small" data-act="tobuild" data-id="workbench">去建造</button>`)}${row(beds, "再添一张床位", `<button class="btn small" data-act="tobuild" data-id="bed">去建造</button>`)}</div>`;
  } else if (g.step?.kind === "do" && g.step.doLabel) doing = `<button class="btn primary" style="height:44px" data-act="dostep">${esc(g.step.doLabel)}</button>`;
  else if (g.step?.id?.startsWith("prep:") && ["fence", "trap", "breeder"].includes(g.step.id.slice(5))) doing = `<button class="btn primary" style="height:44px" data-act="tobuild" data-id="${g.step.id.slice(5)}">去建造</button>`;
  else if (g.step?.id === "prep:heal" || g.step?.id === "prep:food") doing = `<button class="btn primary" style="height:44px" data-act="tomake">去做</button>`;
  const step = g.step ? `<div class="card col sel"><div class="small amber">眼下这一步</div><b class="h2">${esc(g.step.title)}</b><p>${esc(e.chSay(g.step.text) ?? g.step.text)}</p>${g.step.cost ? `<div class="cost">${costTags(e, g.step.cost)}</div>` : ""}${g.step.gain ? `<p class="small good">${esc(e.chSay(g.step.gain) ?? "")}</p>` : ""}<div class="btn-row">${doing}${g.step.target ? `<button class="btn" data-act="mark">${g.step.target.region && g.step.target.region !== e.s.region ? "在地图上看" : "在画面上标出来"}</button>` : ""}</div></div>` : "";
  return `<div class="pane col scroll" style="gap:12px"><div class="chapters">${chapters}</div><div class="row" style="align-items:flex-start;gap:12px"><div class="col grow"><div><div class="small amber">${esc(g.label)}</div><b class="h1">${esc(g.title)}</b><p class="mut">${esc(g.why)}</p></div>${step}${g.stage === "prep" || g.stage === "gate" ? "" : `<div class="steps">${steps}</div>`}</div><div class="col" style="width:420px;flex:none">${gateBox}</div></div></div>`;
}
function logTab(G) {
  const e = G.e,
    sc = e.sc,
    ids = (sc?.letters || []).filter((id) => ["act1", "act2"].includes(id) || e.chNow() > 1),
    letters = ids
      .slice()
      .reverse()
      .map((id) => `<div class="card col"><div class="between"><b class="h2">${esc(letterTitle(sc, id))}</b><span class="small mut">${esc(LETTERS[id].from)} 来信</span></div><p>${esc(e.chSay(letterText(sc, id)) ?? "")}</p></div>`)
      .join("");
  const rows = [...(G.toastLog || [])]
    .slice(0, 60)
    .map((l) => `<p class="${l.tone || ""}"><time>${esc(l.time)}</time><span>${esc(l.text)}</span></p>`)
    .join("");
  return `<div class="pane col scroll" style="gap:10px"><b class="h2">来信</b>${letters || `<div class="empty">还没有信。</div>`}</div><div class="side" style="width:460px"><b class="h2">这几天的事</b><div class="log scroll grow card">${rows || `<p class="mut"><span>还没有记下什么。</span></p>`}</div></div>`;
}
export function journalHtml(G) {
  const tab = G.ui.tab || "main",
    tabs = [
      { id: "main", name: "主线" },
      { id: "log", name: "消息" },
      { id: "codex", name: "图鉴", locked: !G.e.chOpen("codex"), note: G.e.chOpen("codex") ? "" : "第二章" },
    ];
  return `${pageHead("手记", tabsHtml(tabs, tab))}<div class="body">${tab === "log" ? logTab(G) : mainTab(G)}</div>`;
}

// ================= 设置 =================
const KEYS = [["W A S D", "走"], ["Shift", "跑"], ["E", "交互、收菜、开柜子"], ["鼠标左键", "用手上的东西、挥、开枪"], ["空格", "翻滚（头 0.25 秒不受伤）"], ["X", "推开贴上来的"], ["R", "装填"], ["V", "蹲着走"], ["G", "扔石头引开"], ["1–0 或滚轮", "换手上的东西"], ["B", "建造"], ["T", "队友"], ["I 或 Tab", "仓库"], ["M", "地图"], ["J", "手记"], ["P", "暂停 / 接着走"], ["Esc", "返回；画面上按是设置"], ["Q", "摆建筑时转向"]];
export function settingsHtml(G) {
  const s = G.e.s.settings,
    a = G.audioPrefs,
    started = G.started;
  const range = (id, name, note, v) => `<div class="set-row"><div>${name}<small>${note}</small></div><div class="row"><input type="range" min="0" max="1" step="0.05" value="${v}" data-set="${id}" aria-label="${name}"><span class="small mut" style="width:44px;text-align:right">${Math.round(v * 100)}%</span></div></div>`;
  return `${pageHead("设置")}<div class="body"><div class="pane col scroll" style="gap:14px"><div class="card">${range("sound", "总音量", "所有声音", s.sound ?? 0.35)}${range("music", "音乐", "", a.music)}${range("ambience", "环境声", "风、雨、虫鸣", a.ambience)}${range("sfx", "音效", "脚步、挥砍、提示音", a.sfx)}<div class="set-row"><div>画面远近<small>角色和地图画多大</small></div><select data-set="zoom">${[[0.85, "远一点"], [1, "正常"], [1.2, "近一点"]].map(([v, n]) => `<option value="${v}" ${s.zoom === v ? "selected" : ""}>${n}</option>`).join("")}</select></div><div class="set-row"><div>全屏<small>F11 也行</small></div><button class="btn small" data-act="fullscreen">切换全屏</button></div></div><div class="card col"><b class="h2">存档</b><p class="small mut">${esc(G.saveState)} 存档在这个浏览器里；清浏览器数据以前先导出一份。旧版（v0.46 以前）的存档新版读不了。</p><div class="btn-row">${started ? `<button class="btn primary" style="height:44px" data-act="save">现在存一下</button>` : ""}<button class="btn" data-act="export" ${G.hasSave || started ? "" : "disabled"}>导出存档</button><button class="btn" data-act="import">导入存档</button>${started ? `<button class="btn" data-act="unstuck" ${G.e.unstuckReason?.() ? "disabled" : ""}>卡住了：挪到能走的地方</button>` : ""}</div></div>${started ? `<div class="btn-row"><button class="btn" data-act="asktitle">回到标题页</button></div>` : ""}<p class="small mut">${esc(GAME_RELEASE)}</p></div><div class="side card scroll" style="width:460px"><b class="h2">按键</b><div class="keys">${KEYS.map(([k, v]) => `<div><span><kbd>${esc(k)}</kbd></span><span>${esc(v)}</span></div>`).join("")}</div></div></div>`;
}

const PAGES = { team: teamHtml, store: storeHtml, map: mapHtml, journal: journalHtml, settings: settingsHtml };
export const pageHtml = (G, name) => (PAGES[name] ? PAGES[name](G) : "");

// ================= 按了以后 =================
export function pageAct(G, act, id, el, ev) {
  const e = G.e,
    ui = G.ui;
  const done = (save = true) => {
    G.refresh();
    if (save) G.save();
    return true;
  };
  switch (act) {
    case "tab":
      ui.tab = id;
      return done(false);
    // 建造
    case "btab":
      ui.tab = id;
      ui.sel = "";
      return done(false);
    case "bsel":
      ui.sel = id;
      return done(false);
    case "bplace":
      G.close();
      if (e.startBuild(id)) e.buildMode = id;
      return true;
    case "bdismantle":
      G.close();
      G.startDismantle();
      return true;
    // 队友
    case "psel":
      ui.sel = id;
      return done(false);
    // 仓库
    case "isel":
      ui.item = id;
      ui.where = el.dataset.a;
      if (ev?.shiftKey && e.s.region === "farm") e.transfer(id, el.dataset.a === "bag", true);
      return done(!!ev?.shiftKey);
    case "eat":
      e.consume(id);
      return done();
    case "useitem":
      e.useItem(id);
      return done();
    case "seed":
      e.s.seed = id;
      e.s.slot = 2;
      G.toast(itemName(id) + " 放到快捷栏 3 了。");
      return done();
    case "repairgear":
      e.repairGear(id);
      return done();
    case "equip": {
      e.equip(id);
      const slot = e.hotbarSlots().indexOf(id);
      if (slot >= 0) e.s.slot = slot;
      return done();
    }
    case "put":
      e.transfer(id, true, !!ev?.shiftKey);
      return done();
    case "take":
      e.transfer(id, false, !!ev?.shiftKey);
      return done();
    case "putall":
      e.depositAll();
      return done();
    case "station":
      ui.station = id === "hand" ? "" : id;
      return done(false);
    case "craft":
      e.craft(id);
      return done();
    case "craft5":
      e.craftBatch(id, 5);
      return done();
    case "collect":
      if (!e.collectProduction(Number.isNaN(Number(id)) ? id : Number(id))) e.storeProduction?.(Number.isNaN(Number(id)) ? id : Number(id));
      return done();
    case "collectall":
      for (const j of [...(e.c?.production || [])].filter((x) => x.ready)) e.storeProduction ? e.storeProduction(j.id) : e.collectProduction(j.id);
      return done();
    case "tdir":
      ui.dir = id;
      return done(false);
    case "trade": {
      const n = Math.max(1, Math.floor(Number(el.closest(".item-row")?.querySelector("input")?.value) || 1));
      e.trade(ui.trader, id, n, ui.dir === "sell" ? "sell" : "buy");
      return done();
    }
    case "ship":
      e.shipItem(id, Number(el.dataset.a) || 1);
      return done();
    case "unship":
      e.unshipItem(id);
      return done();
    // 地图
    case "msel":
      ui.sel = id;
      return done(false);
    case "travel":
      G.close();
      if (e.travel(id)) G.save();
      return true;
    // 手记
    case "mark": {
      const t = e.chGoal().step?.target;
      if (!t) return true;
      if (t.region && t.region !== e.s.region) G.open("page", "map", { sel: t.region });
      else {
        e.guidance.target = t;
        G.close();
        G.toast("画面上的金色标记：" + (t.label || "那儿") + "。");
      }
      return true;
    }
    case "opensupply":
      G.open("card", "supply");
      return true;
    case "feed":
      e.feedFarmer();
      return done();
    case "project":
      e.contributeProject(id);
      return done();
    case "tobuild":
      G.open("drawer", "build", { tab: BUILD_GROUPS.find((x) => x[2].includes(id))?.[0] || "guard", sel: id });
      return true;
    case "tomake":
      G.open("page", "store", { tab: "make" });
      return true;
    case "dostep": {
      const st = e.chGoal().step;
      if (st?.id === "well") e.repairWell();
      else if (st?.id === "camp") e.buildCamp();
      return done();
    }
    case "callgate":
      e.chCallGate();
      return done();
  }
  return false;
}
