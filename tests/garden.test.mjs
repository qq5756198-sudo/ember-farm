import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState } from "../dist/campaign.js";
import { Engine as ThiefEngine, freshState as thiefFresh } from "../dist/thief.js";
import { TASKS } from "../dist/rebuild-data.js";
import { ITEMS, BUILDINGS, CROPS } from "../dist/data.js";
import { CROP_INFO, BUFFS, CARE, WEEDS, BUGS, CROWS, COVER, FODDER_SOIL, FODDER_FEED, EARLY, LIKED, GARDEN_ITEMS } from "../dist/garden-data.js";
import { renderCampaignView, campaignTitle, renderCampaignJournal, handleCampaignAction, renderManualPlus, placeTitle } from "../dist/campaign-ui.js";

const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const make = (state = freshState()) => {
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  return { e, toasts };
};
const hour = (e, h) => {
  e.s.minute = h * 60 - 0.5;
  e.c.workClock = 59.5;
  e.advanceMinutes(1);
};
const nextDay = (e) => {
  e.s.minute = 1440 - 0.5;
  e.c.workClock = 0;
  e.advanceMinutes(1);
};
const stand = (e, p) => Object.assign(e.s.player, { x: p.x + 2, y: p.y + 6 });
// 一块开垦好、没有杂物的田
const clean = (e, i) => {
  const p = e.s.plots[i];
  e.s.debris = e.s.debris.filter((d) => Math.hypot(d.x - p.x, d.y - p.y) >= 15);
  p.tilled = true;
  return p;
};
const plant = (e, i, crop) => {
  const p = clean(e, i);
  e.s.inventory[CROPS[crop].seed] = (e.s.inventory[CROPS[crop].seed] || 0) + 1;
  assert.ok(e.plantSeed(p.id, CROPS[crop].seed), "plant " + crop);
  return p;
};
const ripen = (p) => (p.growth = CROPS[p.crop].grow);
const btn = (action, id = "") => ({ dataset: { action, id } });
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const finite = (v, path = "s") => {
  if (typeof v === "number") assert.ok(Number.isFinite(v), "non-finite number at " + path);
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) finite(x, path + "." + k);
};
function toAct(e, n) {
  const sc = e.sc;
  sc.act = n;
  sc.claimed = ["act1", "supply", "act2", ...[3, 4, 5, 6, 7, 8].filter((k) => k < n).map((k) => "act" + k)];
  sc.choice = "ration";
  sc.letters = ["act1", "act2", ...[3, 4, 5, 6, 7, 8].filter((k) => k <= n).map((k) => "act" + k)];
  sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true;
  sc.camp = { x: 560, y: 735 };
  const last = { 1: null, 2: "farmer", 3: "table", 4: "hospitalDefense", 5: "warehouse", 6: "network", 7: "radio", 8: "broadcast", 9: "broadcast" }[n];
  e.r.claimed = last ? TASKS.slice(0, TASKS.findIndex((t) => t.id === last) + 1).map((t) => t.id) : [];
  e.assignRegion();
}
// 临时改一个概率，用完还原
const withOdds = (obj, patch, fn) => {
  const old = { ...obj };
  Object.assign(obj, patch);
  try {
    return fn();
  } finally {
    Object.assign(obj, old);
  }
};

// ================= 数据 =================
test("data: every crop has a buff, soil, liked and feared weather; new items and the scarecrow are real", () => {
  // v0.27：杂交苗不是种下去的作物，没有搭配和土性
  for (const id of Object.keys(CROPS).filter((c) => !CROPS[c].hybrid)) {
    const i = CROP_INFO[id];
    assert.ok(i, id);
    assert.ok(BUFFS[i.buff], id + " buff");
    assert.ok(["light", "heavy", "feed"].includes(i.soil));
    assert.notEqual(i.likes, i.hates);
  }
  for (const id of GARDEN_ITEMS) assert.ok(ITEMS[id]?.name && !ITEMS[id].protected);
  assert.ok(BUILDINGS.scarecrow && BUILDINGS.scarecrow.cost.wood === 4 && BUILDINGS.scarecrow.cost.cloth === 1);
  assert.equal(CARE.fine, 80);
});

// ================= E 在田边 =================
test("E on a plot: till, open the seed picker, plant from bag or chest, water, tend, then the plot card", () => {
  const { e, toasts } = make();
  const p = e.s.plots[1];
  stand(e, p);
  assert.match(e.context(e.nearestObject()), /开垦/);
  e.interact();
  assert.equal(p.tilled, true);
  e.events = [];
  e.interact();
  assert.deepEqual(e.events.at(-1), { type: "menu", menu: "outpost", view: "gPick", id: String(p.id) });
  // 选种页：只列手上有的种子，带数字键
  const html = renderCampaignView(e, { view: "gPick", id: String(p.id) });
  assert.doesNotMatch(html, FORBIDDEN);
  assert.match(html, /data-hotkey="1"/);
  assert.match(html, /萝卜种子/);
  assert.match(html, /游戏小时熟/);
  assert.equal(campaignTitle({ view: "gPick" }), "选种");
  // 仓库里的种子也能直接种
  delete e.s.inventory.seedPotato;
  e.s.storage.seedPotato = 2;
  assert.ok(e.seedOptions(p).some((o) => o.id === "seedPotato" && o.box === 2));
  handleCampaignAction("gPlant", btn("gPlant", p.id + "|seedPotato"), ctx(e));
  assert.equal(p.crop, "potato");
  assert.equal(e.s.storage.seedPotato, 1);
  assert.equal(e.s.seed, "seedPotato");
  assert.match(toasts.at(-1).text, /种下土豆 · 照料分 \d+/);
  assert.equal(e.g.plots[p.id].pd, e.s.day);
  // 种下了再按 E：浇水 → 照看 → 打开这块田
  const c0 = e.careScore(p);
  e.interact();
  assert.ok(e.plotWatered(p));
  assert.equal(e.careScore(p), c0 + CARE.water);
  const st = e.s.player.stamina;
  e.interact();
  assert.equal(e.g.plots[p.id].t, e.s.day);
  assert.equal(e.careScore(p), c0 + CARE.water + CARE.tend);
  assert.equal(e.s.player.stamina, st - 1);
  e.events = [];
  e.interact();
  assert.equal(e.events.at(-1).view, "gPlot");
  const card = renderCampaignView(e, { view: "gPlot", id: String(p.id) });
  assert.doesNotMatch(card, FORBIDDEN);
  assert.match(card, /照料分/);
  assert.match(card, /data-action="gTend"[^>]*disabled/);
  // 种了作物的田不能再种
  assert.equal(e.plantSeed(p.id, "seedRadish"), false);
});

// ================= 搭配 =================
test("companions: each crop gives its buff only to different crops beside it (not diagonal, not the same crop)", () => {
  const { e } = make();
  e.s.day = 6;
  // 第 20 块（第 3 行中间）四周：上 11、下 29、左 19、右 21；斜对角 10
  const mid = plant(e, 20, "tomato");
  plant(e, 11, "corn"); // 增产
  plant(e, 19, "cotton"); // 提质
  plant(e, 21, "tomato"); // 同种，不给
  plant(e, 10, "radish"); // 斜对角，不给
  const b = e.buffsFor(mid);
  assert.equal(b.yield, true);
  assert.equal(b.quality, true);
  assert.equal(b.weed, false, "the diagonal radish gives nothing");
  assert.equal(b.water, false, "the same crop gives nothing");
  assert.deepEqual(e.buffsFor(mid).from.yield, ["玉米"]);
  // 提质 +15 直接算进照料分
  const parts = e.careParts(mid);
  assert.ok(parts.some(([l, v]) => /提质/.test(l) && v === CARE.quality));
  // 增产：收获多 1 份（照料分压低，不让优质收成掺进来）
  ripen(mid);
  const plain = plant(e, 40, "tomato");
  ripen(plain);
  e.g.plots[mid.id].c = 0;
  e.g.plots[plain.id].c = 0;
  stand(e, plain);
  const n0 = e.stockOf("tomato") + e.stockOf("fine_tomato");
  e.harvest(plain);
  const base = e.stockOf("tomato") + e.stockOf("fine_tomato") - n0;
  e.gLast = -99;
  const n1 = e.stockOf("tomato") + e.stockOf("fine_tomato");
  e.harvest(mid);
  assert.equal(e.stockOf("tomato") + e.stockOf("fine_tomato") - n1, base + 1);
  // 保水：昨天浇过，今天也算
  const pot = plant(e, 30, "potato");
  const rad = plant(e, 31, "radish");
  e.waterPlot(rad);
  e.waterPlot(pot);
  nextDay(e);
  if (["小雨", "暴雨"].includes(e.s.weather)) e.s.weather = "晴朗";
  rad.wateredDay = e.s.day - 1;
  assert.equal(e.plotWatered(rad), true, "the potato keeps the radish wet one more day");
  e.s.day += 1;
  assert.equal(e.plotWatered(rad), false, "but not two days");
});

// ================= 轮作与地力 =================
test("rotation and soil: a new crop after another gives +10 care, the same crop again yields one less; herbs and beans feed the soil", () => {
  const { e } = make();
  e.s.day = 6;
  const p = clean(e, 5);
  p.lastCrop = "radish";
  e.s.inventory.seedPotato = 2;
  assert.ok(e.plantSeed(p.id, "seedPotato"));
  assert.equal(e.g.plots[p.id].rot, 1);
  assert.equal(e.g.plots[p.id].c, CARE.base);
  assert.equal(e.careScore(p), CARE.base + CARE.rotation, "换茬 +10 counts on top of daily care");
  assert.ok(e.careParts(p).some(([l, v]) => /换了茬/.test(l) && v === CARE.rotation));
  const q = clean(e, 6);
  q.lastCrop = "potato";
  assert.ok(e.plantSeed(q.id, "seedPotato"));
  assert.equal(e.g.plots[q.id].rot, -1);
  assert.equal(e.adjacent(q).yield, -1);
  // 南瓜吃地（−14），香草养地（不耗，收完 +10）
  const r = clean(e, 7);
  assert.equal(e.soilForecast(r, "pumpkin").cost, 14);
  assert.equal(e.soilForecast(r, "herb").cost, 0);
  r.fertility = 50;
  e.s.inventory.seedHerb = 1;
  const seedHerb = CROPS.herb.seed;
  e.s.inventory[seedHerb] = 1;
  assert.ok(e.plantSeed(r.id, seedHerb));
  ripen(r);
  const f0 = r.fertility;
  e.harvest(r);
  assert.equal(r.fertility, Math.min(100, f0 + 10));
});

// ================= 天气 =================
test("weather: a crop grows 25% faster on its liked weather; cloth cover stops bad weather and the night penalty", () => {
  const { e, toasts } = make();
  e.s.day = 8;
  const p = plant(e, 3, "radish"); // 喜欢晴朗，怕高温
  e.s.weather = "晴朗";
  const liked = e.cropGrowthRate(p);
  e.s.weather = "小雨";
  const plain = e.cropGrowthRate(p);
  assert.ok(Math.abs(liked / plain - LIKED) < 1e-9);
  // 盖布：要布料，盖了今明两天不怕坏天气
  e.s.inventory.cloth = 0;
  e.s.storage.cloth = 0;
  assert.equal(e.cover(p), false);
  e.s.inventory.cloth = 1;
  e.s.weather = "高温";
  const hot = e.cropGrowthRate(p) * e.weatherRate(p);
  assert.ok(e.cover(p));
  assert.equal(e.s.inventory.cloth || 0, 0);
  assert.equal(e.g.plots[p.id].cv, e.s.day + COVER.days - 1);
  assert.equal(e.cover(p), false, "already covered");
  const covered = e.cropGrowthRate(p) * e.weatherRate(p);
  assert.ok(covered > hot * 1.9, "the heat no longer halves growth");
  // 怕的天气、没盖布：夜里照料分 −10
  const q = plant(e, 4, "radish");
  e.g.plots[q.id].pd = e.s.day - 1;
  e.g.plots[p.id].pd = e.s.day - 1;
  for (const x of [p, q]) {
    e.waterPlot(x);
    e.g.plots[x.id].t = e.s.day;
  }
  const cp = e.g.plots[p.id].c,
    cq = e.g.plots[q.id].c;
  e.g.bugDay = e.s.day; // 今天不来虫，只看天气
  hour(e, 20);
  e.s.weather = "高温";
  e.g.wx = { day: e.s.day, weather: "高温" };
  nextDay(e);
  assert.equal(e.g.plots[q.id].c, cq + CARE.hated);
  assert.equal(e.g.plots[p.id].c, cp, "covered: no loss");
  assert.ok(toasts.length > 0);
});

// ================= 每晚结算 =================
test("every night: no water −10, nobody tended −5, a weed −10, each bug −5; the score stays 0–100", () => {
  const { e } = make();
  e.s.day = 9;
  const p = plant(e, 2, "potato");
  const rec = e.g.plots[p.id];
  rec.pd = e.s.day - 1;
  rec.c = 50;
  rec.w = e.s.day - 1;
  rec.b = 2;
  e.g.wx = { day: e.s.day, weather: "晴朗" };
  e.s.weather = "晴朗";
  p.wateredDay = 0;
  nextDay(e);
  // 浇水 −10、照看 −5、草 −10、两只虫 −10
  assert.equal(e.g.plots[p.id].c, 50 + CARE.dry + CARE.idle + CARE.weed + CARE.bug * 2);
  e.g.plots[p.id].c = 3;
  e.g.plots[p.id].pd = e.s.day - 1;
  nextDay(e);
  assert.equal(e.g.plots[p.id].c >= 0, true);
});

// ================= 杂草 =================
test("weeds: none before day 3; they block planting, drain the soil, spread after two nights; pulling gives fodder", () => {
  const { e, toasts } = make();
  for (let i = 0; i < 9; i++) clean(e, i);
  withOdds(WEEDS, { empty: 1, crop: 1 }, () => {
    nextDay(e); // 第 2 天
    assert.ok(!Object.values(e.g.plots).some((r) => r.w), "no weeds on day 2");
    nextDay(e); // 第 3 天
  });
  const weedy = e.s.plots.filter((p) => e.g.plots[p.id]?.w);
  assert.ok(weedy.length >= 9);
  assert.match(toasts.map((t) => t.text).join(" "), /杂草/);
  const p = weedy[0];
  e.s.inventory.seedRadish = 3;
  assert.equal(e.plantSeed(p.id, "seedRadish"), false, "weeds block planting");
  assert.match(e.pickReason(p), /拔草/);
  stand(e, p);
  assert.match(e.context(e.nearestObject()), /拔草/);
  const f0 = e.stockOf("fodder");
  e.interact();
  assert.equal(e.stockOf("fodder"), f0 + 1);
  assert.equal(e.g.plots[p.id]?.w || 0, 0);
  // 吸肥：同样两块土豆，有草的那块每晚多掉 2 点肥力；空地有草就不再回肥
  const { e: k } = make();
  k.s.day = 5;
  const a = plant(k, 30, "potato"),
    b = plant(k, 34, "potato");
  k.gRec(a).w = 4;
  withOdds(WEEDS, { empty: 0, crop: 0 }, () => nextDay(k));
  assert.equal(b.fertility - a.fertility, WEEDS.fertility);
  const q = weedy[1],
    fert = q.fertility ?? 65;
  withOdds(WEEDS, { empty: 0, crop: 0 }, () => nextDay(e));
  assert.equal(q.fertility, fert, "an empty plot with weeds no longer recovers");
  // 两夜后蔓延到隔壁
  const { e: f } = make();
  for (let i = 0; i < 45; i++) clean(f, i);
  f.s.day = 10;
  f.gRec(f.s.plots[22]).w = 8;
  withOdds(WEEDS, { empty: 0, crop: 0 }, () => nextDay(f));
  assert.equal(Object.values(f.g.plots).filter((r) => r.w).length, 2);
  // 防草：萝卜旁边的番茄不长草
  const { e: g } = make();
  g.s.day = 5;
  const tom = plant(g, 20, "tomato");
  plant(g, 21, "radish");
  withOdds(WEEDS, { empty: 1, crop: 1 }, () => nextDay(g));
  assert.equal(g.g.plots[tom.id]?.w || 0, 0);
});

// ================= 虫与乌鸦 =================
test("bugs at 06:00 from day 2 slow a crop; catching them gives grubs that work as fishing bait", () => {
  const { e, toasts } = make();
  const p = plant(e, 1, "potato");
  hour(e, 7);
  assert.equal(e.g.plots[p.id]?.b || 0, 0, "no bugs on day 1");
  nextDay(e);
  hour(e, 6);
  assert.ok(e.g.plots[p.id].b >= 1);
  assert.match(toasts.map((t) => t.text).join(" "), /菜青虫/);
  const slow = e.cropGrowthRate(p);
  const n = e.g.plots[p.id].b;
  stand(e, p);
  e.interact();
  assert.equal(e.stockOf("grub"), n);
  assert.ok(Math.abs(e.cropGrowthRate(p) / slow - 1 / BUGS.slow) < 1e-9);
  hour(e, 9);
  assert.equal(e.g.plots[p.id].b, 0, "only one swarm a morning");
  // 菜青虫当鱼饵
  delete e.s.inventory.bean;
  e.s.storage.bean = 0;
  const pond = e.objects.find((o) => o.type === "pond");
  if (pond) {
    Object.assign(e.s.player, { x: pond.x, y: pond.y + 40 });
    assert.ok(e.startFishing(true));
    assert.equal(e.stockOf("grub"), n - 1);
    assert.equal(e.stockOf("bean"), 0);
  }
});

test("crows peck ripe crops once 15 are planted; a scarecrow within 160 or a cloth cover protects", () => {
  const { e, toasts } = make();
  e.s.day = 6;
  const plots = [];
  for (let i = 0; i < 16; i++) plots.push(plant(e, i, "radish"));
  for (const p of plots) ripen(p);
  e.g.bugDay = 0;
  withOdds(CROWS, { chance: 1 }, () => hour(e, 6));
  assert.ok(plots.every((p) => e.g.plots[p.id].pk === 1));
  assert.match(toasts.map((t) => t.text).join(" "), /乌鸦/);
  // 少收 1 份
  assert.equal(e.adjacent(plots[0]).yield <= -1, true);
  // 稻草人和布
  const { e: f } = make();
  f.s.day = 6;
  const list = [];
  for (let i = 0; i < 16; i++) list.push(plant(f, i, "radish"));
  for (const p of list) ripen(p);
  f.s.buildings.push({ id: "sc1", type: "scarecrow", x: list[0].x, y: list[0].y - 60, rotation: 0, hp: 40 });
  f.s.inventory.cloth = 1;
  assert.ok(f.cover(list[15]));
  f.g.bugDay = 0;
  withOdds(CROWS, { chance: 1 }, () => hour(f, 6));
  const near = list.filter((p) => Math.hypot(p.x - list[0].x, p.y - (list[0].y - 60)) <= CROWS.radius);
  assert.ok(near.length >= 3);
  for (const p of near) assert.equal(f.g.plots[p.id].pk || 0, 0, "the scarecrow keeps them off");
  assert.equal(f.g.plots[list[15].id].pk || 0, 0, "the cloth keeps them off");
  // 不到 15 块，乌鸦不来
  const { e: g } = make();
  g.s.day = 6;
  const few = [];
  for (let i = 0; i < 10; i++) few.push(plant(g, i, "radish"));
  for (const p of few) ripen(p);
  withOdds(CROWS, { chance: 1 }, () => hour(g, 6));
  assert.ok(few.every((p) => !(g.g.plots[p.id].pk > 0)));
});

// ================= 照料分与优质 =================
test("quality comes from the care score: daily care alone tops out at 65; planning lifts it past 80, which is always fine; under 50 never; hardy never", () => {
  const { e } = make();
  e.s.day = 6;
  const hi = plant(e, 1, "radish");
  // 日常照料再多也只到 65
  for (let d = 0; d < 4; d++) {
    e.g.plots[hi.id].t = 0;
    e.g.plots[hi.id].wd = 0;
    e.waterPlot(hi);
    e.tend(hi);
  }
  assert.equal(e.g.plots[hi.id].c, CARE.cap);
  assert.equal(e.careScore(hi), CARE.cap);
  // 换茬 + 肥地把它顶到 85
  e.g.plots[hi.id].rot = 1;
  hi.fertility = 90;
  assert.equal(e.careScore(hi), CARE.cap + CARE.rotation + CARE.rich);
  ripen(hi);
  const f0 = e.stockOf("fine_radish");
  e.harvest(hi);
  assert.equal(e.stockOf("fine_radish"), f0 + 1);
  assert.equal(e.g.stats.fine, 1);
  for (let i = 0; i < 6; i++) {
    const lo = plant(e, 10 + i, "radish");
    e.g.plots[lo.id].c = 20;
    ripen(lo);
    const before = e.stockOf("fine_radish");
    e.gLast = -99;
    e.harvest(lo);
    assert.equal(e.stockOf("fine_radish"), before);
  }
  const hardy = clean(e, 30);
  e.s.inventory.seed_radish_hardy = 1;
  assert.ok(e.plantSeed(hardy.id, "seed_radish_hardy"));
  e.g.plots[hardy.id].c = 100;
  ripen(hardy);
  const h0 = e.stockOf("fine_radish");
  e.harvest(hardy);
  assert.equal(e.stockOf("fine_radish"), h0);
  assert.equal(e.fineChance(65), 0.5);
});

// ================= 连收 =================
test("harvest combo: within 3 seconds the next plot gives +1, then +2, up to +3; a pause resets it", () => {
  const { e } = make();
  e.s.day = 6;
  const plots = [];
  for (let i = 0; i < 6; i++) plots.push(plant(e, i, "radish"));
  for (const p of plots) {
    ripen(p);
    e.g.plots[p.id].c = 10;
  }
  const got = [];
  for (const p of plots.slice(0, 5)) {
    const n0 = e.stockOf("radish");
    stand(e, p);
    e.interact();
    got.push(e.stockOf("radish") - n0);
    for (let i = 0; i < 10; i++) e.update(0.1, { x: 0, y: 0 });
  }
  assert.deepEqual(got.map((g) => g - got[0]), [0, 1, 2, 3, 3]);
  assert.match(e.effects.at(-1).text, /连收 \+3/);
  for (let i = 0; i < 40; i++) e.update(0.1, { x: 0, y: 0 });
  const n0 = e.stockOf("radish");
  stand(e, plots[5]);
  e.interact();
  assert.equal(e.stockOf("radish") - n0, got[0], "a pause resets the combo");
});

// ================= 前三天、阿禾、草料 =================
test("the first three days grow 1.5× faster; 阿禾 tends 4 plots an hour from day 5; fodder feeds chickens or the soil", () => {
  const { e } = make();
  const p = plant(e, 1, "potato");
  e.s.weather = "晴朗";
  const d1 = e.cropGrowthRate(p);
  e.s.day = 4;
  assert.ok(Math.abs(d1 / e.cropGrowthRate(p) - EARLY.boost) < 1e-9);
  // 阿禾
  const { e: f } = make();
  toAct(f, 3);
  if (!f.resident("farmer")) f.recruit("farmer");
  f.s.day = 6;
  const list = [];
  for (let i = 0; i < 6; i++) list.push(plant(f, i, "potato"));
  const farmer = f.resident("farmer");
  if (f.residentActive(farmer)) {
    hour(f, 9);
    assert.equal(list.filter((q) => f.g.plots[q.id].t === f.s.day).length, 4);
    assert.equal(f.g.stats.helped, 4);
  }
  // 草料喂鸡、埋进土里
  f.s.buildings.push({ id: "coop1", type: "coop", x: 900, y: 700, rotation: 0, hp: 150 });
  f.c.animals.chicken = true;
  f.c.animals.feedDay = 0;
  f.s.inventory.corn = 0;
  f.s.storage.corn = 0;
  f.s.inventory.fodder = FODDER_FEED;
  f.s.region = "farm";
  assert.ok(f.feedAnimals());
  assert.equal(f.stockOf("fodder"), 0);
  assert.equal(f.c.animals.feedDay, f.s.day);
  const q = list[0];
  q.fertility = 40;
  f.s.inventory.fodder = 2;
  assert.equal(f.fodderSoil(q), false);
  f.s.inventory.fodder = FODDER_SOIL.fodder;
  assert.ok(f.fodderSoil(q));
  assert.equal(q.fertility, 40 + FODDER_SOIL.fertility);
});

// ================= 界面 =================
test("UI: the plot card, the farm board, the journal strip, place pages and every garden button change real state", () => {
  const { e } = make();
  e.s.day = 6;
  const p = plant(e, 1, "tomato");
  plant(e, 2, "corn");
  e.g.plots[p.id].b = 1;
  e.g.plots[p.id].w = 5;
  // 告示牌
  const board = renderCampaignView(e, { view: "gBoard" });
  assert.doesNotMatch(board, FORBIDDEN);
  assert.match(board, /今天的菜地/);
  assert.match(board, /这三天的天气/);
  assert.match(board, /作物怎么搭/);
  assert.equal(campaignTitle({ view: "gBoard" }), "菜地告示牌");
  // 营地手册的“农业”一页就是告示牌
  const farmPage = renderManualPlus(e, "farm", { esc: String, icon: () => "", itemIcon: () => "", costs: () => "", itemName: (id) => id }, {}, {});
  assert.match(farmPage, /今天的菜地/);
  assert.doesNotMatch(farmPage, /manual-nav/);
  assert.equal(placeTitle({ tool: { menu: "frontier", tab: "water" } }, "farm"), "水渠");
  assert.equal(placeTitle({}, "production"), "生产与加工");
  // 手记
  const j = renderCampaignJournal(e, {});
  assert.match(j, /class="garden-strip"/);
  assert.doesNotMatch(j, /营地事务与熟悉的功能|data-action="gManage"/);
  // 这块田的按钮
  const card = renderCampaignView(e, { view: "gPlot", id: String(p.id) });
  assert.match(card, /data-action="gWeed"/);
  assert.match(card, /data-action="gBug"/);
  handleCampaignAction("gWeed", btn("gWeed", p.id), ctx(e));
  assert.equal(e.g.plots[p.id].w, 0);
  handleCampaignAction("gBug", btn("gBug", p.id), ctx(e));
  assert.equal(e.g.plots[p.id].b, 0);
  handleCampaignAction("gTend", btn("gTend", p.id), ctx(e));
  assert.equal(e.g.plots[p.id].t, e.s.day);
  e.c.water = 5;
  handleCampaignAction("gWater", btn("gWater", p.id), ctx(e));
  assert.ok(e.plotWatered(p));
  e.s.inventory.cloth = 1;
  handleCampaignAction("gCover", btn("gCover", p.id), ctx(e));
  assert.ok(e.g.plots[p.id].cv >= e.s.day);
  const before = JSON.stringify([p.fertility, e.s.inventory, e.s.storage]);
  handleCampaignAction("gFodder", btn("gFodder", p.id), ctx(e));
  assert.equal(JSON.stringify([p.fertility, e.s.inventory, e.s.storage]), before, "no fodder, nothing changes");
  let shown = null;
  handleCampaignAction("gScare", btn("gScare"), ctx(e, { showMenu: (m, a) => (shown = [m, a.focusBuild]) }));
  assert.deepEqual(shown, ["build", "scarecrow"]);
  const soil = !!e.f.soilView;
  handleCampaignAction("gSoil", btn("gSoil"), ctx(e));
  assert.equal(e.f.soilView, !soil);
  ripen(p);
  e.paused = true; // 菜单开着时世界暂停，页面上的按钮照样管用
  handleCampaignAction("gHarvest", btn("gHarvest", p.id), ctx(e));
  // v0.27：番茄收完不用重种，从四成长起再收两茬
  assert.equal(p.crop, "tomato");
  assert.equal(p.growth, Math.round(CROPS.tomato.grow * 0.4));
  const empty = clean(e, 8);
  e.s.inventory.seedRadish = 2;
  handleCampaignAction("gPlant", btn("gPlant", empty.id + "|seedRadish"), ctx(e));
  assert.equal(empty.crop, "radish");
  e.c.water = 3;
  handleCampaignAction("gWater", btn("gWater", empty.id), ctx(e));
  assert.ok(e.plotWatered(empty));
  assert.equal(e.paused, true);
  e.paused = false;
  // 告示牌就是菜地边那块牌子：按 E 打开
  const sign = e.objects.find((o) => o.type === "frontierBoard");
  assert.equal(sign.name, "菜地告示牌");
  Object.assign(e.s.player, { x: sign.x, y: sign.y + 20 });
  e.events = [];
  e.interact();
  assert.equal(e.events.at(-1).view, "gBoard");
});

// ================= 存档 =================
test("saves: v0.19 saves load with an empty garden; bad garden data is refused; records for plots that no longer exist are dropped; 30 random days stay finite", () => {
  const old = new ThiefEngine(thiefFresh(), () => {});
  old.s.plots[0].tilled = true;
  old.s.plots[0].crop = "radish";
  const raw = old.serialize();
  assert.ok(!JSON.parse(raw).garden);
  const { e } = make(Engine.parse(raw));
  assert.equal(e.s.plots[0].crop, "radish");
  assert.deepEqual(e.g.plots, {});
  assert.ok(e.g.seed > 0);
  assert.ok(e.careScore(e.s.plots[0]) >= 0);
  // 往返
  const p = plant(e, 3, "potato");
  e.g.plots[p.id].w = 2;
  const back = Engine.parse(e.serialize());
  assert.deepEqual(back.garden.plots[p.id], e.g.plots[p.id]);
  // 坏数据
  for (const bad of [
    (g) => (g.schema = 2),
    (g) => (g.extra = 1),
    (g) => Object.defineProperty(g.plots, "__proto__", { value: { c: 1 }, enumerable: true }),
    (g) => (g.plots.constructor = { c: 1 }),
    (g) => (g.plots["3"] = { c: 101 }),
    (g) => (g.plots["3"] = { c: 10, b: 9 }),
    (g) => (g.plots["3"] = { c: 10, rot: 2 }),
    (g) => (g.plots["3"] = { c: 10, zz: 1 }),
    (g) => (g.stats.tended = -1),
    (g) => (g.wx = { day: 1, weather: "x".repeat(20) }),
  ]) {
    const r = JSON.parse(e.serialize());
    bad(r.garden);
    assert.throws(() => Engine.parse(JSON.stringify(r)), /菜地存档异常/);
  }
  const r = JSON.parse(e.serialize());
  r.garden.plots["99999"] = { c: 10 };
  assert.ok(!(99999 in Engine.parse(JSON.stringify(r)).garden.plots));
  // 随机 30 天
  const { e: f } = make();
  let seed = 7;
  const R = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);
  for (let i = 0; i < 45; i++) clean(f, i);
  f.s.inventory.seedRadish = 40;
  f.s.inventory.seedPotato = 40;
  f.s.inventory.cloth = 10;
  for (let d = 0; d < 30; d++) {
    for (const h of [7, 10, 14, 18]) {
      hour(f, h);
      for (const p of f.s.plots) {
        if (R() < 0.3) continue;
        stand(f, p);
        if (!p.crop && p.tilled && !f.g.plots[p.id]?.w) f.plantSeed(p.id, R() < 0.5 ? "seedRadish" : "seedPotato");
        else if (R() < 0.8) f.interact();
        else if (p.crop && R() < 0.2) f.cover(p);
        f.c.water = 20;
      }
      for (let i = 0; i < 30; i++) f.update(0.05, { x: 0, y: 0 });
    }
    nextDay(f);
    finite(f.s);
    for (const v of Object.values(f.g.plots)) assert.ok(v.c >= 0 && v.c <= 100);
    assert.ok(Engine.parse(f.serialize()));
  }
  assert.ok(f.g.stats.planted > 30 && f.s.stats.harvested > 20);
});

// ================= 审查后补的回归 =================
test("review fixes: no combo from the daily harvest card, fishing comes first, grubs unlock the bait button, 保水 days count as watered", () => {
  const { e } = make();
  e.s.day = 6;
  const plots = [];
  for (let i = 0; i < 6; i++) plots.push(plant(e, i, "radish"));
  for (const p of plots) {
    ripen(p);
    e.g.plots[p.id].c = 0;
  }
  const n0 = e.stockOf("radish");
  e.applyOp(["harvestRipe"], {}, 1);
  assert.equal(e.stockOf("radish") - n0, 6 * CROPS.radish.yield, "no combo from a card");
  assert.equal(e.g.stats.combos, 0);
  // 钓鱼时按 E 是收线，不是动田
  const q = clean(e, 20);
  stand(e, q);
  e.c.fishing = { elapsed: 0, biteAt: 2, phase: "wait", bait: false };
  assert.doesNotMatch(e.context(e.nearestObject()) || "", /选种/);
  e.c.fishing = null;
  // 只有菜青虫时，“作饵”按钮也能点
  const pond = e.objects.find((o) => o.type === "pond");
  if (pond) {
    Object.assign(e.s.player, { x: pond.x, y: pond.y + 40 });
    delete e.s.inventory.bean;
    e.s.inventory.grub = 1;
    const life = renderManualPlus(e, "farm", { esc: String, icon: () => "", itemIcon: () => "", costs: () => "", itemName: (id) => id }, { tool: { menu: "camp", tab: "life" } }, {});
    assert.match(life, /data-action="startFishingBait"(?![^>]*disabled)/);
    assert.match(life, /菜青虫作饵/);
  }
  // 保水：被土豆护着的萝卜，第二天不浇也算浇过，照料分照样 +10
  const { e: f } = make();
  f.s.day = 6;
  const rad = plant(f, 20, "radish");
  plant(f, 21, "potato");
  f.waterPlot(rad);
  f.g.plots[rad.id].t = f.s.day;
  nextDay(f);
  f.s.weather = "晴朗";
  // 不让这天下雨替它浇水：只看保水
  rad.wateredDay = f.s.day - 1;
  f.g.plots[rad.id].wd = f.s.day - 1;
  for (const k of Object.keys(f.g.plots)) f.g.plots[k].w = 0;
  f.g.plots[rad.id].c = 30;
  const c1 = f.g.plots[rad.id].c;
  f.g.plots[rad.id].t = f.s.day;
  f.g.wx = { day: f.s.day, weather: "晴朗" };
  assert.ok(f.plotWatered(rad));
  withOdds(WEEDS, { empty: 0, crop: 0 }, () => nextDay(f));
  // 昨天（保水日）+10；如果今天一早下雨，今天的水也 +10
  assert.equal(f.g.plots[rad.id].c, Math.min(CARE.cap, c1 + CARE.water + (rad.wateredDay === f.s.day ? CARE.water : 0)));
  assert.ok(c1 + CARE.water <= CARE.cap, "the test starts below the cap");
});

test("review fixes: worker replants start a fresh record, partial records load filled, diagonals are not neighbours, the old task marker says what it is", () => {
  const { e } = make();
  e.s.day = 6;
  const p = clean(e, 3);
  e.g.plots[p.id] = { c: 90, pd: 0, t: 0, wd: 0, w: 5, b: 0, cv: 0, rot: 0, pk: 0 };
  p.crop = "potato"; // 无人机补种
  const rec = e.gRec(p);
  assert.equal(rec.pd, e.s.day);
  assert.equal(rec.c, CARE.base);
  assert.equal(rec.w, 5, "the weed stays");
  // 只有 c 的旧记录：读进来补齐
  const r = JSON.parse(e.serialize());
  r.garden.plots[String(e.s.plots[4].id)] = { c: 10 };
  const back = Engine.parse(JSON.stringify(r));
  assert.deepEqual(Object.keys(back.garden.plots[String(e.s.plots[4].id)]).sort(), ["b", "c", "cv", "pd", "pk", "rot", "t", "w", "wd"]);
  // 斜对角不算邻居（生态改耕地的格子只有 28 像素）
  const base = e.s.idCounter;
  e.s.plots.push({ id: base, x: 1200, y: 900, tilled: true, crop: "tomato", growth: 0, wateredDay: 0 }, { id: base + 1, x: 1228, y: 928, tilled: true, crop: "corn", growth: 0, wateredDay: 0 }, { id: base + 2, x: 1228, y: 900, tilled: true, crop: "radish", growth: 0, wateredDay: 0 });
  const t = e.s.plots.find((x) => x.id === base);
  assert.equal(e.buffsFor(t).yield, false, "the corn is diagonal");
  assert.equal(e.buffsFor(t).weed, true, "the radish is beside it");
  // 换一块田，邻居表跟着变
  e.s.plots = e.s.plots.filter((x) => x.id !== base + 2);
  e.s.plots.push({ id: base + 3, x: 1200, y: 928, tilled: true, crop: "bean", growth: 0, wateredDay: 0 });
  assert.equal(e.buffsFor(t).weed, false);
  assert.equal(e.buffsFor(t).yield, true);
  // 任务标记
  const d = e.taskDestination("meal");
  if (d) assert.doesNotMatch(d.label, /^重建计划板$/);
  // 选种页能先埋草肥田
  const empty = clean(e, 8);
  assert.match(renderCampaignView(e, { view: "gPick", id: String(empty.id) }), /data-action="gFodder"/);
});
