// v0.27.0「丰年」：水网（出水、存水、按顺序浇、喷灌头每个钟点、下雨）、照看机和居民不抢收、堆肥和三种肥、
// 番茄豆子多次收获、2×2 巨型作物、田里杂交、神秘种子包、菜地图鉴、天灾前抢收、菜地夜袭、偷菜、按时来的寒潮和温室、
// 订单板（旧的每日订单不再出）、放鸡下地、生态三种动物、每日卡里的农事、林姨的菜园、收获展、鸡蛋上桌、界面和存档。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, newGameState, needsStoryMigration } from "./pre-trim.mjs";
import * as Tidy from "../dist/tidy.js";
import { ITEMS, BUILDINGS, CROPS } from "../dist/data.js";
import { TASKS } from "../dist/rebuild-data.js";
import { CROP_INFO, CARE } from "../dist/garden-data.js";
import { PERKS } from "../dist/daily-data.js";
import { WATER, FERTS, COMPOST, REGROW, GIANT, MYSTERY, DEX, DEX_CROPS, RAID, THEFT, STORM, ORDERS, CHICKENS, COLD, DRONE, RIPE_WAIT, NEW_CROP_IDS, GIANT_ITEMS, MARKET_GARDEN, ECO_HELP } from "../dist/bounty-data.js";
import { MISSING_ICONS } from "../dist/item-sprites.js";
import { WEATHER } from "../dist/expansion-data.js";
import { coldStartFrom, seasonOf, seasonDay } from "../dist/almanac-data.js";
// v0.29：天气按时节排（不再是 8 天一轮）：找一天，它的第二天是要的天气
const dayBefore = (ok, from = 1) => {
  for (let d = from; d < from + 400; d++) if (ok(WEATHER[d % WEATHER.length])) return d;
  throw new Error("no such day");
};

const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const make = (state = freshState(), seed = 20271) => {
  const toasts = [];
  if (state.undertow) state.undertow.seed = seed;
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  if (e.dy) e.dy.pending = null;
  return { e, toasts };
};
const said = (toasts, re) => toasts.some((t) => re.test(t.text));
function toAct(e, n) {
  const sc = e.sc;
  sc.act = n;
  sc.claimed = ["act1", "supply", "act2", ...[3, 4, 5, 6, 7, 8].filter((k) => k < n).map((k) => "act" + k)];
  sc.choice = "ration";
  sc.letters = ["act1", "act2", ...[3, 4, 5, 6, 7, 8].filter((k) => k <= n).map((k) => "act" + k)];
  sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true;
  sc.camp = { x: 560, y: 735 };
  e.r.claimed = TASKS.slice(0, TASKS.findIndex((t) => t.id === "broadcast") + 1).map((t) => t.id);
  e.o.hospital = "water";
  Object.assign(e.o, { youke: true, lathe: { mode: "parts", day: 0 } });
  e.r.radio = true;
  e.o.toll = "refuse";
  e.o.raid.phase = "won";
  e.assignRegion();
}
const put = (e, type, x, y, extra = {}) => {
  const b = { id: "t-" + type + "-" + e.s.idCounter++, type, x, y, rotation: 0, hp: BUILDINGS[type].hp, ...extra };
  e.s.buildings.push(b);
  e.navRevision = (e.navRevision || 0) + 1;
  return b;
};
const clean = (e, i) => {
  const p = e.s.plots[i];
  e.s.debris = e.s.debris.filter((d) => Math.hypot(d.x - p.x, d.y - p.y) >= 15);
  p.tilled = true;
  if (e.g?.plots[p.id]?.w) e.g.plots[p.id].w = 0;
  return p;
};
// 直接种上（不走手），长到 frac
const sow = (e, i, crop, frac = 0) => {
  const p = clean(e, i);
  Object.assign(p, { crop, growth: Math.round(CROPS[crop].grow * frac), trait: null, wateredDay: 0, waterUnits: 0, soilCharged: true });
  if (e.g) e.g.plots[p.id] = { c: CARE.base, pd: e.s.day, t: 0, wd: 0, w: 0, b: 0, cv: 0, rot: 0, pk: 0 };
  delete e.bt.plots[p.id];
  return p;
};
const ripen = (p) => (p.growth = CROPS[p.crop].grow);
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
const stock = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);
const btn = (action, id = "") => ({ dataset: { action, id: String(id) } });
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const stand = (e, p) => Object.assign(e.s.player, { x: p.x + 2, y: p.y + 6 });
// 掷骰子：key 第一段是这个时返回 v，其余照常
const rig = (e, first, v) => {
  const orig = e.btRoll.bind(e);
  e.btRoll = (...key) => (key[0] === first ? v : orig(...key));
};
// 把所有田清掉、没有水源的干净农场
const bare = (e) => {
  for (const p of e.s.plots) Object.assign(p, { crop: null, growth: 0, wateredDay: 0 });
  e.s.buildings = e.s.buildings.filter((b) => !["rain", "irrigation", "drone", "greenhouse"].includes(b.type));
  e.sc.flags.well = false;
  e.bt.net.pool = 0;
  // 清晨的菜青虫按存档种子随机落：测试里关掉
  e.gMorning = () => {
    e.g.bugDay = e.s.day;
  };
};

// ================= 数据、存档 =================

test("saves: a fresh game has an empty farm record and no notice; a v0.26 save gets one (canal water level becomes stored water), is kept before the upgrade, and loads; broken records are refused", () => {
  const fresh = freshState();
  assert.equal(fresh.bounty.schema, 1);
  assert.equal(fresh.bounty.intro, undefined);
  assert.equal(newGameState("farmer").bounty.intro, undefined);
  // 一份 v0.26 的档：水渠蓄着 2 格水
  const old = new Tidy.Engine(Tidy.freshState(), () => {});
  old.f.canals.level = 2;
  old.s.day = 9;
  const text = old.serialize();
  assert.equal(JSON.parse(text).bounty, undefined);
  assert.equal(needsStoryMigration(text), true, "kept once before the upgrade");
  const s = Engine.parse(text);
  assert.equal(s.bounty.net.pool, 10, "two levels of canal water = 10 stored");
  assert.deepEqual(s.bounty.intro, { day: 9, told: false });
  const { e, toasts } = make(s);
  e.update(0.016, {});
  assert.ok(said(toasts, /丰年：水井、雨水桶、水塔、喷灌头、水渠并成了一张水网/));
  const n = toasts.length;
  e.update(0.016, {});
  assert.equal(toasts.length, n, "told once");
  const again = Engine.parse(e.serialize());
  assert.equal(again.bounty.intro.told, true);
  assert.equal(needsStoryMigration(e.serialize()), false);
  // 坏记录
  const bad = (fn) => {
    const raw = JSON.parse(e.serialize());
    fn(raw.bounty);
    assert.throws(() => Engine.parse(JSON.stringify(raw)), /存档里的菜地记录损坏（.+），请从设置恢复有效备份；原存档会保留。/);
  };
  bad((t) => (t.net.pool = -1));
  bad((t) => (t.net.order = ["trough", "canal"]));
  bad((t) => (t.plots["3"] = { fz: "gold" }));
  bad((t) => (t.giants["1"] = { crop: "tomato", ids: [1, 2, 10, 11], day: 3, hits: 0 }));
  bad((t) => (t.orders.list = [1, 2, 3, 4]));
  bad((t) => (t.compost.x = { kind: "grow", n: 9, ready: 0, out: 0 }));
  bad((t) => (t.dex.banana = { h: 1 }));
  bad((t) => (t.net.log = [{ d: 1, made: 1, used: 1, missed: -2 }]));
});

// ================= 水网 =================
test("water network: sources make water at midnight, routes water in the order you set, what is left over is stored up to the cap, the trough waters the first row", () => {
  const { e } = make();
  bare(e);
  e.s.day = 9;
  e.sc.flags.well = true; // 旧水井 10 份
  put(e, "rain", 560, 640); // 雨水桶 4 份，能存 12
  const a = sow(e, 0, "radish", 0.2),
    b = sow(e, 1, "radish", 0.2),
    c = sow(e, 40, "potato", 0.2); // 最下面一排，靠近雨水桶
  nextDay(e); // 第 10 天，晴
  assert.equal(e.s.weather, "晴朗");
  const n = e.bt.net;
  assert.equal(n.made, 14);
  assert.ok(e.plotWatered(a) && e.plotWatered(b), "trough waters the first row");
  assert.ok(e.plotWatered(c), "the barrel waters what is near it");
  assert.equal(n.used, 3);
  assert.equal(n.pool, 11);
  const L = e.netLine();
  assert.equal(L.can, 14);
  assert.equal(L.planted, 3);
  // 存不下的流走：能存的只有雨水桶的 12
  nextDay(e);
  assert.equal(e.bt.net.kept, 11);
  assert.equal(e.bt.net.log[0].d, 10);
  assert.equal(e.bt.net.log[0].used, 3);
  // 新田（重建开出来的）水塔不管
  const fresh = e.s.plots.find((p) => p.rebuildNew);
  if (fresh) {
    e.r.claimed = TASKS.map((t) => t.id);
    assert.ok(!e.netRoutes().some((r) => r.kind === "tower" && r.plots.includes(fresh)));
  }
});




// ================= 自动化只接无聊的活 =================
test("the tending machine tends, waters from the network and catches bugs but never harvests while you are on the farm; a day away it harvests and replants", () => {
  const { e } = make();
  bare(e);
  e.s.day = 10;
  e.s.weather = "晴朗";
  const d = put(e, "drone", 495, 560);
  e.c.energy = 50;
  e.bt.net = { ...e.bt.net, day: 10, pool: 10, made: 10, used: 0 };
  const ripe = sow(e, 13, "radish", 1);
  const dry = sow(e, 22, "potato", 0.3);
  const bug = sow(e, 23, "potato", 0.3);
  e.gRec(bug).b = 2;
  e.s.storage.seedRadish = 3;
  hour(e, 9);
  assert.equal(ripe.crop, "radish", "no harvest while you are here");
  assert.ok(e.plotWatered(dry), "watered from the network");
  assert.ok(!e.plotWatered(ripe), "ripe crops are not watered (they do not grow any more)");
  assert.equal(e.bt.net.pool, 10 - 1);
  assert.equal(e.g.plots[bug.id].b, 0, "bugs caught");
  const weedy = clean(e, 31);
  e.gRec(weedy).w = 9;
  hour(e, 11);
  assert.equal(e.g.plots[weedy.id].w, 0, "weeds pulled too");
  assert.ok(stock(e, "grub") >= 2);
  assert.ok(e.c.energy < 50);
  assert.match(e.automationStatus(d), /照看、浇水、捉虫/);
  // 出门一整天以上：替你收
  e.s.region = "market";
  e.enemies = e.s.enemies.market ||= [];
  e.assignRegion();
  e.bt.away = e.absNow() - DRONE.away - 1;
  assert.ok(e.droneHarvests());
  hour(e, 12);
  assert.ok(ripe.growth < CROPS.radish.grow, "harvested and replanted");
  assert.ok(stock(e, "radish") > 0);
});


// ================= 堆肥、肥 =================

// ================= 多次收获、巨型、杂交、神秘种子、图鉴 =================
test("tomatoes and beans regrow: after a harvest they start again at 40%, the second and third crops give 60%, after the third the plot is empty and the collection book marks it", () => {
  const { e } = make();
  bare(e);
  const p = sow(e, 13, "tomato", 1);
  p.wateredDay = e.s.day;
  stand(e, p);
  const yieldOf = () => {
    const before = stock(e, "tomato") + stock(e, "fine_tomato");
    ripen(p);
    assert.ok(e.fromMenu(() => e.handHarvest(p)));
    return stock(e, "tomato") + stock(e, "fine_tomato") - before;
  };
  const first = yieldOf();
  assert.equal(p.crop, "tomato");
  assert.equal(p.growth, Math.round(CROPS.tomato.grow * REGROW.back));
  assert.equal(e.bt.plots[p.id].n, 1);
  const second = yieldOf();
  assert.ok(second < first, "the second crop is smaller: " + first + " → " + second);
  assert.equal(e.bt.plots[p.id].n, 2);
  yieldOf();
  assert.equal(p.crop, null, "after the third harvest the plot is free");
  assert.ok(e.bt.dex.tomato.h && e.bt.dex.tomato.g, "first harvest and the third cell (three crops)");
  assert.ok(e.bt.stats.regrow >= 2);
});





// ================= 天灾、夜袭、偷菜 =================



// ================= 寒潮、温室 =================

// ================= 订单板 =================

// ================= 放鸡下地、生态 =================

test("ecology helps the field: butterflies raise the fine chance, frogs eat two bugs at dawn", () => {
  const { e } = make();
  bare(e);
  const base = e.fineChance(70);
  e.f.species.push("butterfly");
  assert.ok(Math.abs(e.fineChance(70) - Math.min(1, base + ECO_HELP.butterfly)) < 1e-9);
  e.f.species.push("frog");
  const p = sow(e, 13, "radish", 0.4);
  e.gRec(p).b = 3;
  hour(e, 6);
  assert.equal(e.g.plots[p.id].b, 1);
});

// ================= 每日卡里的农事 =================
test("daily farm cards show up in the field: pests crawl onto six plots and the herb spray clears them; field mice dig holes that cost a portion until filled; the odd pumpkin sits at the corner", () => {
  const { e } = make();
  bare(e);
  e.s.day = 9;
  const plots = [10, 11, 12, 13].map((i) => sow(e, i, "potato", 0.4));
  e.dy.pending = { day: 9, id: "N02", rolls: [0.1, 0.1, 0.1], tier: 1, luck: false, choice: null, win: null, lines: [] };
  hour(e, 6);
  assert.ok(plots.every((p) => e.g.plots[p.id].b >= 1), "bugs on the plots");
  e.s.inventory.herb = 5;
  const res = e.chooseDaily(0);
  assert.ok(res);
  assert.ok(plots.every((p) => !e.g.plots[p.id].b), "the spray cleared them");
  assert.ok(res.lines.some((l) => /只虫都没了/.test(l)));
  // 田鼠
  const { e: f } = make();
  bare(f);
  f.s.day = 9;
  const q = [10, 11, 12].map((i) => sow(f, i, "potato", 0.4));
  f.dy.pending = { day: 9, id: "N11", rolls: [0.1, 0.1, 0.1], tier: 1, luck: false, choice: null, win: null, lines: [] };
  hour(f, 6);
  assert.ok(q.every((p) => f.bt.plots[p.id]?.mh));
  assert.equal(f.adjacent(q[0]).yield, -1);
  f.s.inventory.scrap = 5;
  f.chooseDaily(1);
  assert.ok(q.every((p) => !f.bt.plots[p.id]?.mh), "the traps filled the holes");
  // 怪南瓜
  const { e: g } = make();
  g.s.day = 9;
  g.dy.pending = { day: 9, id: "N04", rolls: [0.1, 0.1, 0.1], tier: 1, luck: false, choice: null, win: null, lines: [] };
  hour(g, 6);
  assert.equal(g.bt.pumpkin, 9);
  g.chooseDaily(1);
  nextDay(g);
  assert.equal(g.bt.pumpkin, 0);
});

// ================= 林姨的菜园、鸡蛋上桌 =================
test("Lin's garden behind the market: with the pick-pocket talent, crouched, once a day; caught counts as stealing from her; her pockets' record is left alone", () => {
  const { e, toasts } = make();
  toAct(e, 5);
  assert.match(e.gardenStealReason(), /顺手牵羊/);
  e.sk.talents = ["pickpocket"];
  e.s.region = MARKET_GARDEN.region;
  e.enemies = e.s.enemies.market ||= [];
  e.assignRegion();
  assert.ok(e.objects.some((o) => o.type === "btGarden"));
  const keep = { w: 1, ids: ["a"] };
  e.th.taken.linyi = { ...keep, ids: [...keep.ids] };
  e.stealRoll = () => 0; // 第一关没被察觉
  const st = e.startGardenSteal();
  assert.ok(st && st.garden && st.slots.length === 3);
  assert.equal(st.phase, "pick");
  assert.equal(e.bt.market, e.s.day);
  st.taken.push(st.slots[0]);
  const res = e.stealStop();
  assert.ok(res.win);
  assert.ok(stock(e, st.slots[0].item) >= st.slots[0].n, "the vegetables are yours");
  assert.deepEqual(e.th.taken.linyi, keep, "Lin's pocket record unchanged");
  assert.match(e.gardenStealReason(), /今天已经下过手/);
  // 被抓：按偷林姨算
  const { e: f } = make();
  toAct(f, 5);
  f.sk.talents = ["pickpocket"];
  f.s.region = "market";
  f.enemies = f.s.enemies.market ||= [];
  f.assignRegion();
  f.stealRoll = () => 0.99;
  f.startGardenSteal();
  assert.equal(f.th.pending?.target, "linyi");
  assert.equal(f.th.market.caught, 1);
  void toasts;
});

test("an egg from the store goes on the dinner table as its own dish and counts for the living standard that night", () => {
  const { e } = make();
  toAct(e, 7);
  e.recruit("farmer");
  put(e, "bed", 700, 330);
  e.s.storage.egg = 2;
  e.s.storage.bread = 10;
  e.o.dinnerDay = 0;
  e.serveDinner();
  assert.equal(e.s.storage.egg, 1);
  assert.ok(e.w.mealLog[0].types.includes("egg"));
});

// ================= 界面 =================

test("thirty random days with the network, the drone, compost, chickens and raids stay finite and keep loading", () => {
  const { e } = make();
  e.sc.flags.well = true;
  put(e, "rain", 560, 640);
  put(e, "irrigation", 495, 520);
  put(e, "drone", 495, 560);
  put(e, "compost", 700, 700);
  put(e, "coop", 640, 760);
  e.c.animals.chicken = true;
  e.c.energy = 60;
  for (let i = 0; i < 30; i++) sow(e, i, ["radish", "potato", "tomato", "bean", "corn", "herb"][i % 6], (i % 5) / 5);
  for (let d = 0; d < 30; d++) {
    if (d % 3 === 0) e.s.storage.fodder = (e.s.storage.fodder || 0) + 5;
    for (const h of [6, 9, 12, 15, 18, 20]) hour(e, h);
    if (d % 4 === 1 && e.s.minute < 1080) e.releaseChickens();
    const bin = e.s.buildings.find((b) => b.type === "compost");
    if (bin && !e.compostReason(bin.id, "fodder")) e.compostAdd(bin.id, "fodder", 5);
    for (const p of e.farmPlots()) if (p.crop && p.growth >= CROPS[p.crop].grow && !e.giantOf(p)) e.fromMenu(() => e.handHarvest(p));
    nextDay(e);
    const text = e.serialize();
    const back = Engine.parse(text);
    assert.equal(back.bounty.schema, 1);
  }
  const walk = (v, path) => {
    if (typeof v === "number") assert.ok(Number.isFinite(v), "non-finite at " + path);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, path + "." + k);
  };
  walk(e.s.bounty, "bounty");
});
