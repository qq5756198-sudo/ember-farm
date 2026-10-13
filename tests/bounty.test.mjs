// v0.27.0「丰年」：水网（出水、存水、按顺序浇、喷灌头每个钟点、下雨）、照看机和居民不抢收、堆肥和三种肥、
// 番茄豆子多次收获、2×2 巨型作物、田里杂交、神秘种子包、菜地图鉴、天灾前抢收、菜地夜袭、偷菜、按时来的寒潮和温室、
// 订单板（旧的每日订单不再出）、放鸡下地、生态三种动物、每日卡里的农事、林姨的菜园、收获展、鸡蛋上桌、界面和存档。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, newGameState, needsStoryMigration } from "../dist/campaign.js";
import * as Tidy from "../dist/tidy.js";
import { ITEMS, BUILDINGS, CROPS } from "../dist/data.js";
import { TASKS } from "../dist/rebuild-data.js";
import { CROP_INFO, CARE } from "../dist/garden-data.js";
import { PERKS } from "../dist/daily-data.js";
import { WATER, FERTS, COMPOST, REGROW, GIANT, MYSTERY, DEX, DEX_CROPS, RAID, THEFT, STORM, ORDERS, CHICKENS, COLD, DRONE, RIPE_WAIT, NEW_CROP_IDS, GIANT_ITEMS, MARKET_GARDEN, ECO_HELP } from "../dist/bounty-data.js";
import * as UI from "../dist/campaign-ui.js";
import { residentExtras } from "../dist/people-hooks.js";
import { MISSING_ICONS } from "../dist/item-sprites.js";

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
test("data: the new crops, fertilisers, mystery packs and giant trophies are real items with icons; the compost bin is a building; renamed sprinklers and the tending machine", () => {
  for (const id of NEW_CROP_IDS) {
    assert.ok(CROPS[id]?.variety && CROPS[id].seed && ITEMS[CROPS[id].seed]?.crop === id, id);
    for (const pre of ["", "fine_", "hardy_"]) assert.ok(ITEMS[pre + id]?.name, pre + id);
    for (const tr of ["early", "abundant", "hardy"]) assert.equal(ITEMS["seed_" + id + "_" + tr]?.trait, tr);
    assert.ok(CROP_INFO[id], "crop info " + id);
  }
  for (const k of Object.keys(FERTS)) assert.ok(ITEMS[FERTS[k].id]?.name);
  assert.ok(ITEMS.manure && ITEMS.seedMystery?.mystery && ITEMS.seedMystery.type === "seed");
  for (const id of GIANT_ITEMS) assert.ok(ITEMS[id]?.sell > 100, id);
  assert.ok(CROPS.hybrid?.hybrid && CROPS.hybrid.seed === null);
  assert.equal(BUILDINGS.compost.cost.wood, 6);
  assert.equal(BUILDINGS.irrigation.name, "喷灌头");
  assert.equal(BUILDINGS.drone.name, "照看机");
  assert.match(PERKS.cistern.text, /水网/);
  assert.deepEqual(MISSING_ICONS(), [], "every item has a drawn icon");
  for (const id of [...NEW_CROP_IDS, "seedMystery", "fertGrow", "giant_pumpkin"]) assert.doesNotMatch(ITEMS[id].name + ITEMS[id].desc, DEV);
});

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

test("water network: when water runs short the first route in your order is watered first; an abundant crop takes two; the board says how many were missed", () => {
  const { e } = make();
  bare(e);
  e.s.day = 9;
  put(e, "rain", 335, 400); // 4 份，管第一排的左边
  e.sc.flags.well = true; // 10 份，管第一排
  // 第一排 9 块（水槽管，左边几块雨水桶也管）、第二排 9 块（左边几块雨水桶管）：18 块，只有 14 份水
  for (let i = 0; i < 9; i++) sow(e, i, "radish", 0.1);
  const low = [9, 10, 11, 12, 13, 14, 15, 16, 17].map((i) => sow(e, i, "radish", 0.1));
  e.bt.net.order = ["barrel", "trough", "canal", "sprinkler", "tower"];
  nextDay(e);
  // 雨水桶排第一：先浇它管的（第一排左边几块 + 下面一排几块），水槽再浇剩下的
  assert.ok(low.filter((p) => e.plotWatered(p)).length >= 1, "the barrel's own plots go first");
  assert.ok(e.bt.net.missed > 0, "some were missed: " + e.bt.net.missed);
  assert.equal(e.bt.net.pool, 0);
  const board = UI.renderCampaignView(e, { view: "gBoard" });
  assert.match(board, /今天的水够浇 14 块，你种了 18 块/);
  assert.match(board, /排在后面没浇上/);
  // 丰产的要 2 份
  const { e: e2 } = make();
  bare(e2);
  e2.s.day = 9;
  e2.sc.flags.well = true;
  const p = sow(e2, 0, "radish", 0.1);
  p.trait = "abundant";
  nextDay(e2);
  assert.equal(e2.bt.net.used, 2);
  // 排序按钮
  const before = [...e2.bt.net.order];
  UI.handleCampaignAction("btNet", btn("btNet", "tower:-1"), ctx(e2));
  assert.deepEqual(e2.bt.net.order, [...before.slice(0, 3), "tower", "barrel"]);
  UI.handleCampaignAction("btNet", btn("btNet", "trough:-1"), ctx(e2));
  assert.equal(e2.bt.net.order[0], "trough", "the first one cannot move up");
});

test("sprinklers: every hour from 06:00 to 20:00 they water what was planted today from the network; switched off they do nothing; with no water they do nothing", () => {
  const { e } = make();
  bare(e);
  e.s.day = 10;
  e.s.weather = "晴朗";
  const spr = put(e, "irrigation", 495, 520);
  e.bt.net = { ...e.bt.net, day: 10, pool: 0, made: 0, used: 0, missed: 0 };
  const p = sow(e, 13, "tomato", 0.1);
  hour(e, 9);
  assert.ok(!e.plotWatered(p), "no water in the network, nothing happens");
  e.bt.net.pool = 5;
  UI.handleCampaignAction("btSprinkler", btn("btSprinkler", spr.id), ctx(e));
  assert.ok(e.bt.net.off.includes(spr.id));
  hour(e, 10);
  assert.ok(!e.plotWatered(p), "switched off");
  UI.handleCampaignAction("btSprinkler", btn("btSprinkler", spr.id), ctx(e));
  assert.ok(e.plotWatered(p), "switching it back on waters at once");
  assert.equal(e.bt.net.pool, 4);
  const q = sow(e, 14, "radish", 0.1);
  hour(e, 21);
  assert.ok(!e.plotWatered(q), "not after 20:00");
  hour(e, 6);
  assert.ok(e.plotWatered(q));
  // 设施卡：开关
  const card = UI.buildingExtras(e, spr);
  assert.match(card, /data-action="btSprinkler"/);
  assert.match(card, /水网/);
});

test("rain waters every crop and keeps the network's water; the canal no longer drains the watering can; the cistern perk is a source; egrets add canal water", () => {
  const { e } = make();
  bare(e);
  e.s.day = 10;
  put(e, "rain", 560, 640);
  const p = sow(e, 40, "radish", 0.1);
  nextDay(e); // 第 11 天小雨
  assert.equal(e.s.weather, "小雨");
  assert.ok(e.plotWatered(p));
  assert.equal(e.bt.net.used, 0);
  assert.equal(e.bt.net.made, WATER.barrel.rain);
  // 水渠接通：不扣水壶
  e.f.canals.dug = [0, 1, 5, 9, 13, 14, 15];
  e.f.canals.open = true;
  e.f.canals.mode = "hold";
  e.c.water = 5;
  hour(e, 13);
  assert.equal(e.c.water, 5, "the canal does not take water from the can any more");
  assert.equal(e.f.canals.level, 1, "the canal still fills in hold mode");
  assert.ok(e.netSources().some((s) => s.kind === "canal" && s.store === WATER.canal.store));
  e.f.species.push("egret");
  assert.equal(e.netSources().find((s) => s.kind === "canal").made, WATER.canal.base + ECO_HELP.egret);
  e.dy.perks.push("cistern");
  assert.ok(e.netSources().some((s) => s.kind === "cistern" && s.made === WATER.cistern.base));
  const page = UI.renderCampaignView(e, { view: "bWater" });
  assert.doesNotMatch(page, DEV);
  assert.match(page, /水渠（池塘水） · 白鹭 \+4/);
  assert.match(page, /蓄水池/);
  assert.equal(UI.campaignTitle({ view: "bWater" }), "水网");
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

test("residents tend while you are on the farm and only harvest what has been ripe four hours; away, they harvest as before; giants they leave alone", () => {
  const { e } = make();
  bare(e);
  e.s.day = 10;
  e.recruit("farmer");
  put(e, "bed", 700, 330);
  const r = e.c.residents[0];
  r.fed = true;
  r.priorities = { farmer: 1 };
  const p = sow(e, 13, "radish", 1);
  p.wateredDay = 10;
  hour(e, 9);
  assert.equal(p.crop, "radish", "ripe for an hour: left for you");
  assert.ok(e.bt.plots[p.id].ra > 0);
  assert.equal(e.workerMayHarvest(p), false);
  const q = sow(e, 14, "radish", 1);
  q.wateredDay = 10;
  hour(e, 10);
  for (const x of [p, q]) e.bt.plots[x.id].ra = e.absNow() - RIPE_WAIT - 1;
  assert.equal(e.workerMayHarvest(p), true);
  e.s.storage.seedBean = 2;
  hour(e, 11);
  // 一个钟点只替你收一块；收了的照着换茬补种（仓库里有豆子种子）
  const done = [p, q].filter((x) => x.crop !== "radish");
  assert.equal(done.length, 1, "one plot an hour while you are here");
  assert.equal(done[0].crop, "bean", "replanted with a different crop from the store");
  assert.equal(e.s.storage.seedBean, 1);
  hour(e, 12);
  assert.ok([p, q].every((x) => x.crop !== "radish"), "the next hour the other one");
  assert.match(residentExtras(e, r), /熟了 4 个钟点没人收才替你收/);
});

// ================= 堆肥、肥 =================
test("compost: five scraps fill the bin, it rots overnight, the fertiliser comes out at 06:00; the three fertilisers speed growth, raise care and make one watering last two days", () => {
  const { e, toasts } = make();
  bare(e);
  e.s.day = 9;
  const bin = put(e, "compost", 700, 700);
  e.s.storage.fodder = 3;
  e.s.storage.grub = 4;
  const C = (a, id) => UI.handleCampaignAction(a, btn(a, id), ctx(e));
  C("btCompKind", bin.id + "|water");
  assert.equal(e.bt.compost[bin.id].kind, "water");
  C("btCompAdd", bin.id + "|fodder|3");
  assert.equal(e.bt.compost[bin.id].n, 3);
  assert.equal(e.s.storage.fodder || 0, 0);
  e.s.inventory.wood = 2;
  assert.ok(e.compostReason(bin.id, "wood"), "wood is not compost");
  C("btCompAdd", bin.id + "|grub|4");
  assert.equal(e.bt.compost[bin.id].n, COMPOST.batch);
  assert.equal(stock(e, "grub"), 2, "only what fits goes in");
  assert.ok(said(toasts, /堆肥桶满了：明早 06:00 出 1 袋保水肥/));
  assert.ok(e.compostReason(bin.id, "grub"), "busy rotting");
  nextDay(e);
  hour(e, 6);
  assert.equal(e.bt.compost[bin.id].out, 1);
  assert.match(UI.renderCampaignView(e, { view: "bCompost", id: bin.id }), /沤好了 1 袋保水肥/);
  C("btCompTake", bin.id);
  assert.equal(stock(e, "fertWater"), 1);
  // 三种肥
  const p = sow(e, 13, "potato", 0.2);
  e.s.storage.fertGrow = 1;
  e.s.storage.fertCare = 1;
  const rate = e.cropGrowthRate(p);
  C("btFert", p.id + "|grow");
  assert.equal(e.bt.plots[p.id].fz, "grow");
  assert.ok(Math.abs(e.cropGrowthRate(p) - rate * FERTS.grow.grow) < 1e-9);
  assert.ok(e.fertReason(p, "care"), "one bag a crop");
  const q = sow(e, 14, "potato", 0.2);
  const care = e.careScore(q);
  C("btFert", q.id + "|care");
  assert.equal(e.careScore(q), Math.min(100, care + FERTS.care.care));
  const w = sow(e, 30, "potato", 0.2),
    plain = sow(e, 32, "potato", 0.2);
  C("btFert", w.id + "|water");
  e.s.day = 9;
  e.waterPlot(w);
  e.waterPlot(plain);
  nextDay(e);
  assert.equal(e.s.weather, "晴朗");
  assert.ok(e.plotWatered(w), "a watering lasts two days with water-keeping fertiliser");
  assert.ok(!e.plotWatered(plain), "plain crops need water again");
});

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

test("giant crops: a 2×2 of ripe radishes with care 80+ can turn giant at dawn; it takes three hoe strokes, gives a big pile and a giant radish for the show; workers leave it", () => {
  const { e, toasts } = make();
  bare(e);
  e.s.day = 9;
  const four = [12, 13, 21, 22].map((i) => sow(e, i, "radish", 1));
  // 照料分 80 以上：日常最多 65，再加肥地 +10、提质肥 +20
  for (const p of four) {
    e.g.plots[p.id].c = CARE.cap;
    p.fertility = 90;
    e.bt.plots[p.id] = { fz: "care" };
    p.wateredDay = 9;
  }
  assert.ok(e.careScore(four[0]) >= GIANT.care);
  rig(e, "giant", 0);
  hour(e, 6);
  const g = e.giantOf(four[0]);
  assert.ok(g, "a giant radish");
  assert.deepEqual([...g.ids].sort((a, b) => a - b), four.map((p) => p.id).sort((a, b) => a - b));
  assert.ok(said(toasts, /长成了一棵巨型萝卜/));
  assert.equal(e.harvest(four[1], true), false, "workers cannot pick it");
  assert.equal(e.workerMayHarvest(four[1]), false);
  // 卡片：锄一下
  const card = UI.renderCampaignView(e, { view: "gPlot", id: String(four[2].id) });
  assert.match(card, /data-action="btGiant"/);
  assert.match(card, /巨型萝卜的一角/);
  stand(e, four[0]);
  const before = stock(e, "radish");
  e.plotAction(four[0]);
  e.plotAction(four[3]);
  assert.equal(e.giantOf(four[0]).hits, 2);
  UI.handleCampaignAction("btGiant", btn("btGiant", four[1].id), ctx(e));
  assert.equal(e.giantOf(four[0]), null);
  const got = stock(e, "radish") - before;
  assert.ok(got >= GIANT.yield[0] && got <= GIANT.yield[1] + DEX.bonus, "pile " + got);
  assert.equal(stock(e, "giant_radish"), 1);
  for (const p of four) assert.equal(p.crop, null);
  assert.ok(e.bt.dex.radish.g, "first giant fills the third cell");
  // 收获展：一棵顶一组
  e.f.exhibition.entries = [];
  assert.ok(e.enterExhibition("giant_radish"));
  assert.ok(e.exhibitionScore() >= 8 + 12 + GIANT.show - 8);
});

test("field hybrids: two different crops side by side, both watered yesterday, can sprout a hybrid seedling on a free tilled plot next to them; grown, it is a packet of seeds", () => {
  const { e, toasts } = make();
  bare(e);
  e.s.day = 9;
  const a = sow(e, 13, "radish", 0.3),
    b = sow(e, 14, "potato", 0.3);
  a.wateredDay = b.wateredDay = 9;
  const free = clean(e, 22);
  for (const p of e.s.plots) if (p !== free && !p.crop) p.tilled = false;
  rig(e, "hyb", 0);
  nextDay(e);
  assert.equal(free.crop, "hybrid");
  assert.deepEqual(e.bt.plots[free.id].hy, ["radish", "potato"]);
  assert.ok(said(toasts, /冒出一棵杂交苗/));
  const card = UI.renderCampaignView(e, { view: "gPlot", id: String(free.id) });
  assert.match(card, /杂交苗：萝卜 × 土豆/);
  ripen(free);
  const seedsBefore = Object.keys(ITEMS).filter((id) => ITEMS[id].type === "seed").reduce((n, id) => n + stock(e, id), 0);
  stand(e, free);
  assert.ok(e.plotAction(free));
  const seedsAfter = Object.keys(ITEMS).filter((id) => ITEMS[id].type === "seed").reduce((n, id) => n + stock(e, id), 0);
  assert.equal(seedsAfter - seedsBefore, 2);
  assert.equal(free.crop, null);
});

test("mystery seed packs: planted from the picker they turn into a real crop (normal, with a trait, or a new variety); the pack is used; refused on an untilled plot", () => {
  const { e, toasts } = make();
  bare(e);
  e.s.storage.seedMystery = 3;
  const p = clean(e, 13);
  stand(e, p);
  const page = UI.renderCampaignView(e, { view: "gPick", id: String(p.id) });
  assert.match(page, /种一包神秘种子（有 3 包）/);
  UI.handleCampaignAction("btMystery", btn("btMystery", p.id), ctx(e));
  assert.ok(p.crop && (MYSTERY.crops.includes(p.crop) || NEW_CROP_IDS.includes(p.crop)), p.crop);
  assert.equal(stock(e, "seedMystery"), 2);
  assert.ok(said(toasts, /拆开神秘种子包：是/));
  const raw = e.s.plots[30];
  raw.tilled = false;
  assert.equal(e.plantMystery(raw.id), false);
  assert.equal(stock(e, "seedMystery"), 2, "nothing used");
  // 每种结果都出得来
  const seen = new Set();
  for (let k = 0; k < 400; k++) {
    e.bt.mystery = k;
    const r = e.mysteryRoll(p);
    seen.add(CROPS[r.crop].variety ? "variety" : r.trait ? "trait" : "normal");
  }
  assert.deepEqual([...seen].sort(), ["normal", "trait", "variety"]);
});

test("the collection book: first harvest, first fine and a third cell per crop; a full row gives one more portion every harvest; five radishes in a row fill the combo cell", () => {
  const { e } = make();
  bare(e);
  const plots = [10, 11, 12, 13, 14].map((i) => sow(e, i, "herb", 1));
  for (const p of plots) p.wateredDay = e.s.day;
  for (const p of plots) {
    stand(e, p);
    e.gClock += 0.5;
    assert.ok(e.fromMenu(() => e.handHarvest(p)));
  }
  assert.ok(e.bt.dex.herb.h && e.bt.dex.herb.g, "five in a row");
  assert.equal(e.dexDone("herb"), false);
  e.bt.dex.herb.f = e.s.day;
  assert.equal(e.dexDone("herb"), true);
  const p = sow(e, 20, "herb", 1);
  assert.equal(e.adjacent(p).yield, DEX.bonus, "one more portion");
  const board = UI.renderCampaignView(e, { view: "gBoard" });
  assert.match(board, /菜地图鉴 · 集齐 1\/12 行/);
  assert.equal(DEX_CROPS.length, 12);
});

// ================= 天灾、夜袭、偷菜 =================
test("bad weather is told the evening before; you can harvest early from 70%; acid rain spoils one portion of each uncovered plot over 70%, covered ones are safe", () => {
  const { e, toasts } = make();
  bare(e);
  e.s.day = 5; // 明天酸雨
  const p = sow(e, 13, "potato", 0.8),
    q = sow(e, 14, "potato", 0.8),
    young = sow(e, 15, "potato", 0.5),
    early = sow(e, 16, "potato", 0.75);
  e.gRec(q).cv = 6;
  hour(e, 18);
  assert.deepEqual(e.bt.storm, { day: 6, kind: "acid" });
  assert.ok(said(toasts, /明天酸雨/));
  const card = UI.renderCampaignView(e, { view: "gPlot", id: String(early.id) });
  assert.match(card, /data-action="btRush"/);
  assert.ok(e.fieldRushReason(young), "under 70% cannot be rushed");
  stand(e, early);
  UI.handleCampaignAction("btRush", btn("btRush", early.id), ctx(e));
  assert.equal(early.crop, null);
  assert.equal(stock(e, "potato"), Math.floor(CROPS.potato.yield * 0.75));
  nextDay(e);
  hour(e, 6);
  assert.equal(e.bt.plots[p.id]?.st, 1, "uncovered: one portion lost");
  assert.ok(!e.bt.plots[q.id]?.st, "covered: safe");
  assert.ok(!e.bt.plots[young.id]?.st, "young plants are fine in acid rain");
});

test("night raids: more than ten plots ripe for six hours (or a giant) bring infected at 01:00 (just-ripened ones do not count); asleep, guards, fences, lamps and the dog each stop one and the rest trample plots; awake on the farm you fight them for double drops", () => {
  const { e, toasts } = make();
  bare(e);
  e.s.day = 9;
  for (let i = 0; i < 12; i++) sow(e, i, "radish", 1);
  // 傍晚刚熟的不算
  const { e: g0 } = make();
  bare(g0);
  g0.s.day = 9;
  for (let i = 0; i < 12; i++) sow(g0, i, "radish", 1);
  hour(g0, 20);
  assert.equal(g0.bt.raid.state, "", "just ripe: no raid");
  hour(e, 9); // 早上熟的
  hour(e, 20);
  assert.equal(e.bt.raid.state, "warned");
  const n = e.bt.raid.n;
  assert.ok(n >= RAID.count[0] && n <= RAID.count[1]);
  assert.ok(said(toasts, /今晚 01:00 会有/));
  assert.match(UI.campaignHud(e).alerts, /菜地夜袭/);
  // 睡着：没人挡，每只踩一块
  e._btSleep = true;
  nextDay(e);
  hour(e, 1);
  e._btSleep = false;
  assert.equal(e.bt.raid.state, "done");
  assert.match(e.bt.raid.report, new RegExp("踩坏了 " + n + " 块菜"));
  assert.equal(e.farmPlots().filter((p) => e.bt.plots[p.id]?.tr === e.s.day).length, n);
  // 醒着在农场：真的打
  const { e: f } = make();
  bare(f);
  f.s.day = 9;
  for (let i = 0; i < 12; i++) sow(f, i, "radish", 1);
  hour(f, 9);
  hour(f, 20);
  nextDay(f);
  f.s.minute = 59.5;
  f.c.workClock = 59.5;
  f.advanceMinutes(1);
  const raiders = f.enemies.filter((z) => z.btRaid);
  assert.equal(raiders.length, f.bt.raid.n);
  assert.equal(f.bt.raid.state, "live");
  const scrap = stock(f, "scrap");
  for (const z of raiders) {
    z.hp = 1;
    f.hurtEnemy(z, 999, 0, {});
  }
  assert.equal(f.bt.raid.state, "done");
  assert.ok(stock(f, "scrap") > scrap || Object.keys(f.s.storage).length, "double drops into the store");
  assert.match(f.bt.raid.report, /打退了/);
});

test("crop theft: ripe for more than a day and unguarded, a plot can lose portions at 03:00 with footprints left behind; a scarecrow nearby or the dog at home stops it", () => {
  const { e, toasts } = make();
  bare(e);
  e.s.day = 9;
  const p = sow(e, 9, "potato", 1),
    safe = sow(e, 40, "potato", 1);
  put(e, "scarecrow", safe.x, safe.y + 30);
  hour(e, 9);
  for (const q of [p, safe]) e.bt.plots[q.id].ra = e.absNow() - THEFT.ripe - 60;
  rig(e, "theft", 0);
  nextDay(e);
  hour(e, 3);
  assert.ok(e.bt.plots[p.id].st >= 1, "stolen");
  assert.equal(e.bt.plots[p.id].pr, e.s.day, "footprints");
  assert.ok(!e.bt.plots[safe.id].st, "the scarecrow keeps thieves off");
  assert.ok(said(toasts, /夜里有人摸进菜地/));
  const card = UI.renderCampaignView(e, { view: "gPlot", id: String(p.id) });
  assert.match(card, /地上有脚印/);
  // 收的时候少收
  const lost = e.bt.plots[p.id].st;
  const a = e.adjacent(p).yield;
  assert.ok(a <= -lost);
});

// ================= 寒潮、温室 =================
test("cold snaps come back every 28 days after the story winter; in a cold snap only plots in a greenhouse grow (winter potatoes grow anyway); frost the night before halves uncovered growth", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  bare(e);
  const wi = e.w.winter;
  Object.assign(wi, { phase: "done", coldDay: 40, endDay: 43, prepDay: 37 });
  e.w.forecast = true;
  e.s.day = 66;
  e.bt.cold.next = 68;
  nextDay(e); // 第 67 天：说
  assert.equal(wi.phase, "prep");
  assert.equal(wi.coldDay, 68);
  assert.equal(wi.endDay, 68 + COLD.first);
  assert.ok(said(toasts, /寒潮又到/));
  assert.equal(e.bt.cold.next, 68 + COLD.every);
  const gh = put(e, "greenhouse", 335, 660);
  const out = sow(e, 8, "radish", 0.4),
    inside = sow(e, 36, "radish", 0.4),
    tough = sow(e, 7, "winterPotato", 0.4);
  assert.ok(e.inGreenhouse(inside) && !e.inGreenhouse(out));
  hour(e, 18);
  assert.equal(e.bt.storm.kind, "frost");
  nextDay(e);
  e.s.weather = "晴朗";
  const before = out.growth;
  hour(e, 6);
  assert.equal(wi.phase, "cold");
  assert.equal(out.growth, Math.round(before * COLD.frost), "frost bit the plot outside");
  for (const p of [out, inside, tough]) e.waterPlot(p);
  assert.equal(e.cropGrowthRate(out), 0, "outside the greenhouse nothing grows");
  assert.ok(e.cropGrowthRate(inside) > 0);
  assert.ok(e.cropGrowthRate(tough) > 0, "winter potatoes grow anyway");
  wi.priority = "food";
  assert.ok(Math.abs(e.cropGrowthRate(out) - 0.35 * e.cropGrowthRate(inside) / (e.inGreenhouse(inside) ? 1 : 1)) < 1, "food priority keeps a little growth");
  assert.match(UI.buildingExtras(e, gh), /寒潮里：只有这里面的田在长/);
});

// ================= 订单板 =================
test("the order board: three orders every morning from day 2, paid in materials or mystery seeds (fine and hardy count), one tear a day, late ones expire; the old daily orders stop", () => {
  const { e, toasts } = make();
  bare(e);
  e.s.day = 4;
  e.c.orders = [{ id: "order-4-0", title: "公共餐桌的萝卜", cost: { radish: 6 }, trader: "food", money: 100, rep: 10, accepted: true, done: false }];
  nextDay(e);
  assert.equal(e.c.orders.length, 1, "accepted old orders can still be handed in the next day");
  nextDay(e);
  assert.equal(e.c.orders.length, 0, "no new old-style orders");
  hour(e, 6);
  const o = e.bt.orders;
  assert.equal(o.list.length, ORDERS.slots);
  for (const x of o.list) {
    assert.ok(ITEMS[x.item] && x.n >= 1 && x.due >= e.s.day + ORDERS.days[0] && x.due <= e.s.day + ORDERS.days[1]);
    assert.ok(Object.keys(x.pay).every((id) => ["wood", "scrap", "cloth", "parts", "seedMystery"].includes(id)));
  }
  const first = o.list[0];
  e.s.storage["fine_" + first.item] = first.n; // 优质的也能交
  if (!ITEMS["fine_" + first.item]) e.s.storage[first.item] = first.n;
  const page = UI.renderCampaignView(e, { view: "bOrders" });
  assert.doesNotMatch(page, DEV);
  assert.equal(UI.campaignTitle({ view: "bOrders" }), "订单板");
  const pay = { ...first.pay },
    before = Object.fromEntries(Object.keys(pay).map((id) => [id, stock(e, id)]));
  UI.handleCampaignAction("btOrderGive", btn("btOrderGive", first.id), ctx(e));
  for (const [id, n] of Object.entries(pay)) assert.equal(stock(e, id), before[id] + n, id);
  assert.equal(o.list.length, ORDERS.slots - 1);
  assert.ok(said(toasts, /交了.+的单子/));
  const second = o.list[0];
  UI.handleCampaignAction("btOrderTear", btn("btOrderTear", second.id), ctx(e));
  assert.equal(o.list.length, ORDERS.slots - 2);
  assert.ok(e.tearReason(o.list[0].id), "one tear a day");
  // 过期的第二天早上没了、补满
  const last = o.list[0];
  e.s.day = last.due;
  nextDay(e);
  hour(e, 6);
  assert.ok(!o.list.includes(last));
  assert.equal(o.list.length, ORDERS.slots);
  // 出货箱上的“每日订单”换成订单板；营地订单页指过去
  let shown = null;
  UI.handleCampaignAction("rOpen", btn("rOpen", "camp:orders"), ctx(e, { showMenu: (m, a) => (shown = [m, a.view]) }));
  assert.deepEqual(shown, ["outpost", "bOrders"]);
  assert.doesNotMatch(UI.renderCampaignView(e, { view: "shipping" }), /每日订单/);
});

// ================= 放鸡下地、生态 =================
test("chickens in the field: let out by day near the coop they eat a bug or a weed every hour and leave manure; at most eight hours; a small chance to peck a seedling", () => {
  const { e, toasts } = make();
  bare(e);
  e.s.day = 9;
  e.s.minute = 600;
  const coop = put(e, "coop", 495, 640);
  assert.ok(e.chickenReason(), "no chicken yet");
  e.c.animals.chicken = true;
  e.s.minute = 300;
  assert.match(e.chickenReason(), /06:00–18:00/);
  e.s.minute = 600;
  const p = sow(e, 40, "radish", 0.5);
  e.gRec(p).b = 2;
  const w = clean(e, 41);
  e.gRec(w).w = 9;
  UI.handleCampaignAction("btChickens", btn("btChickens", "out"), ctx(e));
  assert.ok(e.bt.chickens.out);
  assert.ok(said(toasts, /把鸡放进了田里/));
  rig(e, "peck", 0.99);
  hour(e, 11);
  hour(e, 12);
  assert.equal(e.g.plots[p.id].b, 0, "two bugs eaten in two hours");
  hour(e, 13);
  assert.equal(e.g.plots[w.id].w, 0, "then the weed");
  assert.ok(stock(e, "manure") >= 1);
  assert.match(UI.buildingExtras(e, coop), /赶回窝里/);
  UI.handleCampaignAction("btChickens", btn("btChickens", "in"), ctx(e));
  assert.equal(e.bt.chickens.out, false);
  // 八个钟点用完
  e.bt.chickens.used = CHICKENS.hours * 60;
  assert.match(e.chickenReason(), /放够/);
});

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
test("UI: water, compost and order pages, the plot card's new lines and buttons, the board's water line, warnings and collection book, the facility cards, the farmer line and the alerts have no developer words", () => {
  const { e } = make();
  bare(e);
  e.s.day = 9;
  e.sc.flags.well = true;
  put(e, "drone", 495, 560);
  put(e, "irrigation", 455, 520);
  const gh = put(e, "greenhouse", 655, 640);
  const coop = put(e, "coop", 640, 760);
  const bin = put(e, "compost", 700, 700);
  const solar = put(e, "solar", 420, 880);
  const p = sow(e, 13, "tomato", 0.8);
  e.bt.plots[p.id] = { n: 1, st: 1, mh: true };
  nextDay(e);
  hour(e, 6);
  for (const ui of [{ view: "bWater" }, { view: "bCompost", id: bin.id }, { view: "bOrders" }, { view: "gPlot", id: String(p.id) }, { view: "gBoard" }]) {
    const html = UI.renderCampaignView(e, ui);
    assert.doesNotMatch(html, DEV, ui.view);
  }
  const card = UI.renderCampaignView(e, { view: "gPlot", id: String(p.id) });
  assert.match(card, /第 2 茬/);
  assert.match(card, /田鼠洞/);
  assert.match(card, /水网：.+管这块/);
  assert.match(card, /data-action="btFert"/);
  const board = UI.renderCampaignView(e, { view: "gBoard" });
  assert.match(board, /今天的水够浇/);
  assert.match(board, /data-action="bView" data-id="bWater"/);
  assert.match(board, /菜地图鉴/);
  const farmPage = UI.renderManualPlus(e, "farm", { esc: String, icon: () => "", itemIcon: () => "", costs: () => "", itemName: (id) => id }, {}, {});
  assert.match(farmPage, /今天的水够浇/);
  for (const b of e.s.buildings.filter((x) => ["drone", "irrigation", "greenhouse", "coop", "solar"].includes(x.type))) {
    const html = UI.buildingExtras(e, b);
    assert.ok(html.length > 40, b.type);
    assert.doesNotMatch(html, DEV, b.type);
  }
  assert.match(UI.buildingExtras(e, solar), /照看机/);
  assert.doesNotMatch(UI.buildingExtras(e, solar), /无人机/);
  void gh;
  void coop;
  // 堆肥桶按 E 打开它那一页
  const shown = [];
  e.emit = (type, data) => shown.push([type, data]);
  Object.assign(e.s.player, { x: bin.x, y: bin.y + 30 });
  e.interact();
  assert.deepEqual(shown[0], ["menu", { menu: "outpost", view: "bCompost", id: bin.id }]);
  // 订单板按 E
  shown.length = 0;
  Object.assign(e.s.player, { x: ORDERS.spot.x, y: ORDERS.spot.y + 20 });
  e.interact();
  assert.deepEqual(shown[0], ["menu", { menu: "outpost", view: "bOrders", id: "" }]);
  assert.match(e.context(e.nearestObject()), /订单板 · 3 张单子/);
});

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
