// v0.20.0「一亩田」的界面：田边选种、这块田、菜地告示牌，任务手记里的“菜地”条，
// 以及去掉营地手册后，每个地方自己的那一页的标题。
import { CROPS, ITEMS } from "./data.js";
import { TRAITS } from "./expansion-data.js";
import { CAMP_TABS } from "./camp-ui.js";
import { FRONTIER_TABS } from "./frontier-ui.js";
import { renderThiefJournal, thiefTitle, renderThiefView, handleThiefAction } from "./thief-ui.js";
import { BUFFS, BUFF_IDS, CROP_INFO, SOIL, cropInfo, CARE, COVER, FODDER_SOIL, WEATHER_WORD, cropName } from "./garden-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const dis = (reason) => (reason ? `disabled title="${esc(reason)}"` : "");
const word = (w) => WEATHER_WORD[w] || w || "—";
const realTime = (hours) => {
  const sec = (hours * 60) / 1.6;
  return sec < 90 ? "现实约 " + Math.max(10, Math.round(sec / 10) * 10) + " 秒" : "现实约 " + Math.round(sec / 60) + " 分钟";
};
const fert = (p) => Math.round(p.fertility ?? 65);
const fertWord = (f) => (f >= 85 ? "肥" : f < 30 ? "贫" : "一般");
const tag = (text, cls = "") => `<span class="g-tag${cls ? " " + cls : ""}">${esc(text)}</span>`;

// ================= 田边选种 =================
function viewPick(e, ui) {
  const p = e.plotById(ui.id);
  const why = e.pickReason(p);
  if (!p || why) return `<p>${esc(why || "这块田不在这里。")}</p>`;
  const opts = e.seedOptions(p),
    w = e.s.weather;
  const head = `<header class="g-head"><div><small>第 ${e.s.plots.indexOf(p) + 1} 块田 · 肥力 ${fert(p)}（${fertWord(fert(p))}）${p.lastCrop ? " · 上一茬：" + esc(cropName(p.lastCrop)) : ""}</small><h3>种点什么？</h3><p>今天${esc(word(w))}。点一种种子，或按数字键。</p></div></header>`;
  if (!opts.length) return head + `<p class="story-lack">背包和仓库里都没有种子：去集市找林姨买，或者从补给箱、每日抉择里拿。</p><div class="button-row">${button("gFodder", p.id, "埋草肥田（" + FODDER_SOIL.fodder + " 草料，肥力 +" + FODDER_SOIL.fertility + "）", dis(e.fodderReason(p)))}${button("close", "", "知道了")}</div>`;
  const rows = opts
    .map((o, i) => {
      const crop = o.crop,
        info = cropInfo(crop),
        b = e.buffsFor(p, crop),
        got = BUFF_IDS.filter((k) => b[k]),
        soil = e.soilForecast(p, crop),
        hours = e.growHours(p, crop, o.trait),
        c = CROPS[crop];
      const tags = [
        info.buff ? tag("给邻居：" + BUFFS[info.buff].name, "give") : "",
        ...got.map((k) => tag("这里能拿到：" + BUFFS[k].name + "（" + b.from[k].join("、") + "）", "get")),
        info.likes ? tag("喜欢" + word(info.likes) + (info.likes === w ? " · 今天" : ""), info.likes === w ? "good" : "") : "",
        info.hates ? tag("怕" + word(info.hates) + (info.hates === w ? " · 今天" : ""), info.hates === w ? "bad" : "") : "",
        soil.rotation ? tag("换茬 照料 +" + CARE.rotation, "good") : soil.repeat ? tag("连作：少收 1 份", "bad") : "",
        tag("种后肥力 " + soil.after + "（" + SOIL[info.soil].name + "）", soil.after < 30 ? "bad" : ""),
      ].join("");
      const name = ITEMS[o.id].name;
      return `<li><button class="seed-opt" data-action="gPlant" data-id="${esc(p.id + "|" + o.id)}" data-hotkey="${i + 1}"><span class="seed-no">${i + 1}</span><span class="seed-main"><b>${esc(name)}</b><small>背包 ${o.bag}${o.box ? " · 仓库 " + o.box : ""}</small></span><span class="seed-time">约 ${hours} 游戏小时熟（${realTime(hours)}）· 收 ${c.yield} 份</span><span class="seed-tags">${tags}</span></button></li>`;
    })
    .join("");
  return head + `<ul class="seed-list">${rows}</ul><p class="muted">种下后再按 E：浇水、照看，日常照料最多攒到 ${CARE.cap} 分。照料分 ${CARE.fine} 以上收成必是优质：换茬、肥地、邻居“提质”能把分数顶上去。</p><div class="button-row">${button("gFodder", p.id, "先埋草肥田（" + FODDER_SOIL.fodder + " 草料，肥力 +" + FODDER_SOIL.fertility + "）", dis(e.fodderReason(p)))}</div>`;
}

// ================= 这块田 =================
function viewPlot(e, ui) {
  const p = e.plotById(ui.id);
  if (!p) return `<p>这块田不在这里。</p>`;
  if (!p.crop) return viewPick(e, ui);
  const rec = e.g.plots[p.id] || {},
    day = e.s.day,
    c = CROPS[p.crop],
    info = cropInfo(p.crop),
    score = e.careScore(p),
    chance = Math.round(e.fineChance(score) * 100),
    ripe = p.growth >= c.grow,
    hours = e.hoursLeft(p),
    b = e.buffsFor(p),
    got = BUFF_IDS.filter((k) => b[k]),
    fc = e.forecast?.() || [];
  const need = TRAITS[p.trait]?.water || 1,
    watered = e.plotWatered(p),
    canWater = (e.c?.water ?? need) >= need;
  const today = [
    [watered ? "今天喝到水了" : "今天还没浇水", watered],
    [rec.t === day ? "今天照看过" : "今天还没照看", rec.t === day],
    [rec.w ? "地里有草：吸肥、扣照料分" : "没有杂草", !rec.w],
    [rec.b ? "叶子上有 " + rec.b + " 只菜青虫：长得慢" : "没有虫", !rec.b],
    rec.pk ? ["被乌鸦啄过 " + rec.pk + " 次：少收 " + rec.pk + " 份", false] : null,
    rec.cv >= day ? ["盖着布（到第 " + rec.cv + " 天）", true] : null,
  ].filter(Boolean);
  const tomorrow = fc[1]?.weather;
  const weatherLine = [
    info.likes ? "喜欢" + word(info.likes) + (info.likes === e.s.weather ? "（今天就是，长得快 25%）" : "") : "",
    info.hates ? "怕" + word(info.hates) + (info.hates === e.s.weather ? "（今天就是：盖块布能挡）" : info.hates === tomorrow ? "（明天就是：今天盖上布）" : "") : "",
  ]
    .filter(Boolean)
    .join(" · ");
  const parts = e.careParts(p).map(([l, v]) => `${esc(l)} ${v > 0 ? "+" : "−"}${Math.abs(v)}`);
  const tendWhy = rec.t === day ? "今天已经照看过" : "",
    waterWhy = watered ? "今天已经喝到水了" : !canWater ? "浇水壶没水了：去旧水井或雨水桶补满" : "",
    coverWhy = e.coverReason(p),
    fodderWhy = e.fodderReason(p);
  const buttons = [
    ripe ? button("gHarvest", p.id, "收获", 'class="primary" data-hotkey="1"') : "",
    rec.w ? button("gWeed", p.id, "拔草") : "",
    rec.b ? button("gBug", p.id, "捉虫") : "",
    button("gTend", p.id, "照看（照料 +" + CARE.tend + "）", dis(tendWhy) + (ripe ? "" : ' class="primary"')),
    button("gWater", p.id, "浇水", dis(waterWhy)),
    button("gCover", p.id, "盖布（" + COVER.cloth + " 布料）", dis(coverWhy)),
    button("gFodder", p.id, "埋草肥田（" + FODDER_SOIL.fodder + " 草料，肥力 +" + FODDER_SOIL.fertility + "）", dis(fodderWhy)),
  ].join("");
  return `<div class="g-plot"><header class="g-head"><div><small>第 ${e.s.plots.indexOf(p) + 1} 块田 · 肥力 ${fert(p)}（${fertWord(fert(p))}）${p.trait && TRAITS[p.trait] ? " · " + esc(TRAITS[p.trait].name) : ""}</small><h3>${esc(c.name)} · ${ripe ? "熟了" : "长到 " + Math.floor((p.growth / c.grow) * 100) + "%"}</h3><p>${ripe ? "可以收了。熟了别放太久，乌鸦会来。" : "还要约 " + hours + " 游戏小时（" + realTime(hours) + "）"}</p></div><div class="care-dial ${score >= CARE.fine ? "top" : score >= CARE.maybe ? "mid" : "low"}"><small>照料分</small><b>${score}</b><small>${p.trait === "hardy" ? "耐旱作物不出优质" : "优质机会 " + chance + "%"}</small></div></header><ul class="g-today">${today.map(([t, ok]) => `<li class="${ok === true ? "ok" : ok === false ? "bad" : ""}">${esc(t)}</li>`).join("")}</ul><div class="button-row g-actions">${buttons}</div><dl class="g-facts"><dt>邻居给它</dt><dd>${got.length ? got.map((k) => esc(BUFFS[k].name + "（" + b.from[k].join("、") + "）：" + BUFFS[k].text)).join("；") : "没有：把不同的作物种在它上下左右"}</dd><dt>它给邻居</dt><dd>${info.buff ? esc(BUFFS[info.buff].name + "：" + BUFFS[info.buff].text) : "没有"}</dd><dt>天气</dt><dd>${esc(weatherLine || "不挑天")}</dd><dt>照料分</dt><dd>日常照料 ${Math.round(Math.min(rec.c ?? CARE.base, CARE.cap))}/${CARE.cap}${parts.length ? " · " + parts.join(" · ") : ""}。日常：每天浇水 +${CARE.water}、照看 +${CARE.tend}，最多攒到 ${CARE.cap}；没浇 ${CARE.dry}、没照看 ${CARE.idle}、杂草 ${CARE.weed}、每只虫 ${CARE.bug}、遇上怕的天气没盖布 ${CARE.hated}。再往上靠换茬 +${CARE.rotation}、肥地 +${CARE.rich}、邻居提质 +${CARE.quality}。${CARE.fine} 分以上必出优质。</dd></dl></div>`;
}

// ================= 菜地告示牌 =================
export function renderGardenBoard(e) {
  const s = e.gSummary(),
    fc = e.forecast?.() || [{ day: e.s.day, weather: e.s.weather }];
  const stat = (n, label, warn) => `<span class="g-stat${n && warn ? " warn" : ""}"><b>${n}</b>${esc(label)}</span>`;
  const crow =
    s.crops >= 15
      ? s.crowRisk
        ? `<p class="story-lack">种了 ${s.crops} 块，乌鸦盯上这里了：${s.crowRisk} 块熟菜没有稻草人护着，明早可能被啄。</p>`
        : `<p class="muted">种了 ${s.crops} 块，乌鸦会来；熟菜都有稻草人或布护着。</p>`
      : `<p class="muted">种到 15 块以上，乌鸦就会来啄熟了没收的菜。</p>`;
  const crops = Object.keys(CROP_INFO).filter((c) => CROPS[c]);
  const days = fc
    .slice(0, 3)
    .map((d, i) => {
      const like = crops.filter((c) => CROP_INFO[c].likes === d.weather).map(cropName),
        hate = crops.filter((c) => CROP_INFO[c].hates === d.weather).map(cropName);
      return `<li><b>${["今天", "明天", "后天"][i]} · ${esc(word(d.weather))}</b><small>喜欢：${esc(like.join("、") || "—")}</small><small>${hate.length ? "怕：" + esc(hate.join("、")) + (i === 1 ? " → 今天先盖布" : "") : "没有作物怕"}</small></li>`;
    })
    .join("");
  const guide = crops
    .map((c) => {
      const i = CROP_INFO[c];
      return `<tr><th>${esc(cropName(c))}</th><td>${esc(BUFFS[i.buff]?.name || "—")}</td><td>${esc(SOIL[i.soil].name)}</td><td>${esc(word(i.likes))}</td><td>${esc(word(i.hates))}</td></tr>`;
    })
    .join("");
  const soilOn = !!e.f?.soilView;
  return `<div class="g-board"><section><h3>今天的菜地</h3><div class="g-stats">${stat(s.ripe, "块熟了")}${stat(s.thirsty, "块该浇", true)}${stat(s.untended, "块没照看")}${stat(s.weeds, "处杂草", true)}${stat(s.bugs, "只菜青虫", true)}${stat(s.empty, "块空地")}</div>${crow}${s.fineReady ? `<p class="g-good">${s.fineReady} 块熟菜照料分 80 以上，收了必是优质。</p>` : ""}</section><section><h3>这三天的天气</h3><ul class="g-days">${days}</ul></section><section><h3>作物怎么搭</h3><p class="muted">每种作物把它的加成给上下左右“不同种”的作物。豆类、药草养地；玉米、棉花、南瓜吃地，换着种照料分 +${CARE.rotation}。</p><div class="g-table"><table><thead><tr><th>作物</th><th>给邻居</th><th>地力</th><th>喜欢</th><th>怕</th></tr></thead><tbody>${guide}</tbody></table></div><p class="muted">${BUFF_IDS.map((k) => esc(BUFFS[k].name + "：" + BUFFS[k].text)).join("；")}。</p></section><div class="button-row">${button("gJournal", "", "打开任务手记")}${button("gScare", "", "立一个稻草人（木 4、布 1）")}${button("gSoil", "", soilOn ? "关掉地上的肥力数字" : "在地上显示肥力数字")}${button("gShow", "exhibition", "收获展")}</div></div>`;
}

// ================= 任务手记里的“菜地”条 =================
function gardenStrip(e) {
  if (!e.g || e.s.day < 1) return "";
  const s = e.gSummary();
  if (!s.crops && !s.empty && !s.weeds) return "";
  const bits = [s.ripe ? s.ripe + " 块熟了" : "", s.thirsty ? s.thirsty + " 块该浇" : "", s.weeds ? s.weeds + " 处杂草" : "", s.bugs ? s.bugs + " 只菜青虫" : "", s.empty ? s.empty + " 块空地" : ""].filter(Boolean);
  return `<section class="garden-strip" aria-label="菜地"><div class="far-row"><p><b>菜地</b>${esc(bits.join(" · ") || "都照看好了")}。</p>${button("gView", "gBoard", "看菜地告示牌")}</div></section>`;
}
export function renderGardenJournal(e, ui = {}) {
  let html = renderThiefJournal(e, ui);
  if (ui.catalog || !e.g) return html;
  const strip = gardenStrip(e);
  if (!strip) return html;
  for (const mark of ['<section class="thief-strip"', '<section class="daily-strip"', '<section class="far-strip"', '<section class="seasons-strip"', '<section class="winter-strip"', '<section class="outpost-strip"']) {
    const at = html.indexOf(mark);
    if (at >= 0) return html.slice(0, at) + strip + html.slice(at);
  }
  const end = html.lastIndexOf("</div>");
  return end > 0 ? html.slice(0, end) + strip + html.slice(end) : html + strip;
}

// ================= 加工台、出货箱上的入口（原来只在营地手册里） =================
const STATION_PAGES = {
  cook: [["frontier:kitchen", "掌勺料理（小游戏）"]],
  workbench: [["camp:orders", "每日订单"]],
  weaponbench: [["frontier:combat", "武器与潜行"]],
};
export function gardenStationExtras(e, b) {
  const list = STATION_PAGES[b?.type] || [];
  return list.length ? `<div class="button-row g-station">${list.map(([id, label]) => button("rOpen", id, label)).join("")}</div>` : "";
}
const SHIPPING_PAGES = [["camp:orders", "每日订单"], ["camp:messages", "商人与消息"]];

// ================= 视图、标题、动作 =================
const TITLES = { gPick: "选种", gPlot: "这块田", gBoard: "菜地告示牌" };
export function gardenTitle(ui, fallback) {
  return TITLES[ui.view] || thiefTitle(ui, fallback);
}
export function renderGardenView(e, ui = {}, fallback) {
  if (!e.g) return renderThiefView(e, ui, fallback);
  let body = null;
  if (ui.view === "gPick") body = viewPick(e, ui);
  else if (ui.view === "gPlot") body = viewPlot(e, ui);
  else if (ui.view === "gBoard") body = renderGardenBoard(e);
  if (body === null) {
    const html = renderThiefView(e, ui, fallback);
    if (ui.view !== "shipping") return html;
    const extra = `<div class="button-row g-station">${SHIPPING_PAGES.map(([id, label]) => button("rOpen", id, label)).join("")}</div>`;
    const end = html.lastIndexOf("</div>");
    return end > 0 ? html.slice(0, end) + extra + html.slice(end) : html + extra;
  }
  return `<div class="outpost-page view-${esc(ui.view)}">${body}</div>`;
}
// 去掉营地手册之后，每一页的标题就是这个地方的名字
const PILLAR_PLACES = { farm: "菜地告示牌", production: "生产与加工", expedition: "远征与前哨", residents: "居民", defense: "防线", research: "调查与研究", events: "营地消息", overview: "任务手记" };
export function placeTitle(rui, tab) {
  if (rui?.tool) {
    const list = rui.tool.menu === "camp" ? CAMP_TABS : FRONTIER_TABS;
    return list.find(([id]) => id === rui.tool.tab)?.[1] || "营地";
  }
  return PILLAR_PLACES[tab] || "营地";
}
const ACTIONS = ["gPlant", "gHarvest", "gTend", "gWater", "gWeed", "gBug", "gCover", "gFodder", "gScare", "gSoil", "gShow", "gView"];
export function handleGardenAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return handleThiefAction(action, el, ctx);
  const { engine: e, ui = {}, showMenu, closeMenu, renderMenu, save } = ctx,
    id = el.dataset.id || "";
  if (!e.g) return true;
  const plot = () => e.plotById(id);
  const after = (ok, close = false) => {
    if (ok) save();
    if (ok && close) closeMenu();
    else renderMenu();
  };
  switch (action) {
    case "gPlant": {
      const [pid, seed] = id.split("|");
      after(e.plantSeed(pid, seed), true);
      break;
    }
    case "gHarvest": {
      const p = plot();
      after(!!p && e.fromMenu(() => e.handHarvest(p)), true);
      break;
    }
    case "gTend":
      after(e.tend(plot()));
      break;
    case "gWater": {
      const p = plot();
      after(!!p && e.waterFromCard(p));
      break;
    }
    case "gWeed":
      after(e.pullWeed(plot()));
      break;
    case "gBug":
      after(e.catchBugs(plot()));
      break;
    case "gCover":
      after(e.cover(plot()));
      break;
    case "gFodder":
      after(e.fodderSoil(plot()));
      break;
    case "gScare":
      showMenu("build", { focusBuild: "scarecrow" });
      break;
    case "gSoil":
      if (e.f) {
        e.f.soilView = !e.f.soilView;
        save();
      }
      renderMenu();
      break;
    case "gShow":
      showMenu("frontier", { tab: id || "exhibition" });
      break;
    case "gView":
      showMenu("outpost", { view: id, id: "" });
      break;
  }
  return true;
}
