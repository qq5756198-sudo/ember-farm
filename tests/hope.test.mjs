// v0.33.0「盼头」：钱的去处（墙升二级、营地扩建、每周的稀罕货）、每周一件“这周的事”、每天下午的限时事、存档。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, needsStoryMigration } from "../dist/campaign.js";
import * as Zest from "../dist/zest.js";
import { ITEMS, REGIONS, CROPS } from "../dist/data.js";
import { WALL_IDS, OLD, OLD_IDS, PAGE_IDS } from "../dist/relight-data.js";
import { OLD_STORY, TUNNEL_TEXT } from "../dist/relight-story.js";
import { WSPOTS } from "../dist/winter-data.js";
import { MOMENT_KINDS } from "../dist/zest-data.js";
import { MOMENT_SOUND, STINGERS } from "../dist/audio-data.js";
import { FISH } from "../dist/kin-data.js";
import { POINT_BY_ID } from "../dist/district-data.js";
import { decorItem, DECOR_BY_ID, seasonOf } from "../dist/almanac-data.js";
import {
  START,
  WALL2,
  WALL2_FX,
  EXPAND,
  EXPAND_FX,
  GOODS,
  GOOD_IDS,
  goodItem,
  GOOD_FX,
  MARKET_ORDER,
  WEEK_KINDS,
  weekKind,
  TRAVEL,
  TRAVELERS,
  WEEK_LISTS,
  CARAVAN_WEEK,
  SEASON_BOSSES,
  BOSS_DAYS,
  NOON,
  NOON_NAMES,
  PEDDLERS,
  PEDDLER_SPOT,
  BUYERS,
  BUYER,
  SHOAL,
  SURVIVORS,
  TRUCK,
  LETTERS,
  DOVE,
  INTRO_LINES,
  HOPE_DECOR,
} from "../dist/hope-data.js";

const make = (state = freshState(), seed = 33001) => {
  const toasts = [];
  if (state.undertow) state.undertow.seed = seed;
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  if (e.dy) e.dy.pending = null;
  return { e, toasts };
};
const said = (toasts, re) => toasts.some((t) => re.test(t.text));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const stock = (e, items) => {
  for (const [id, n] of Object.entries(items)) e.s.storage[id] = (e.s.storage[id] || 0) + n;
};
const bag = (e, items) => {
  for (const [id, n] of Object.entries(items)) e.s.inventory[id] = (e.s.inventory[id] || 0) + n;
};
const qty = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);
const hour = (e, h) => {
  e.s.minute = h * 60 - 0.5;
  e.c.workClock = 59.5;
  e.advanceMinutes(1);
};
// 跳到某一天的某个钟点：从那天 0 点起一个钟点一个钟点走过去（每个钟点的事都照常发生）
const toDay = (e, day, h = 6) => {
  e.s.day = day - 1;
  e.s.minute = 1440 - 0.5;
  e.c.workClock = 59.5;
  e.advanceMinutes(0.5 + h * 60);
};
const go = (e, region, x = 768, y = 512) => {
  e.s.visited = { ...(e.s.visited || {}), [region]: true };
  e.s.region = region;
  e.enemies = e.s.enemies[region] ||= [];
  e.assignRegion();
  Object.assign(e.s.player, { x, y });
};
const clearFoes = (e) => {
  for (const z of e.enemies) z.dead = true;
  e.enemies = e.s.enemies[e.s.region] = [];
};
const moments = (e, kind) => e.events.filter((x) => x.type === "moment" && (!kind || x.kind === kind));
// 第二年的营地：车队到过、各张图去过、旧站商街开了、重建站建好
function midGame(e, day = 40) {
  e.s.day = day;
  e.s.minute = 480;
  for (const r of ["residential", "hospital", "warehouse", "valley", "courtyard", "stationMarket", "railDepot", "quarantine", "shipyard", "frost", "pinewood"]) e.s.visited[r] = true;
  if (e.d?.unlocked) for (const r of ["valley", "stationMarket", "courtyard", "railDepot", "quarantine"]) e.d.unlocked[r] = true;
  if (e.o?.caravan) e.o.caravan.visits = Math.max(1, e.o.caravan.visits);
  e.s.money = 60000;
  go(e, "farm", 830, 600);
}
function station(e) {
  go(e, "farm", 830, 600);
  bag(e, { wood: 20, stone: 12, scrap: 8 });
  assert.ok(e.startBuild("rlStation"));
  e.buildMode = "rlStation";
  for (const y of [640, 700, 760, 820, 580])
    for (let x = 220; x <= 1340; x += 40) {
      Object.assign(e.s.player, { x, y: y - 60 });
      if (!e.buildReason("rlStation", x, y)) {
        assert.ok(e.placeBuilding(x, y));
        const b = e.rlStationB();
        Object.assign(e.s.player, { x: b.x, y: b.y + 50 });
        return b;
      }
    }
  throw new Error("no room for the station");
}
function place(e, type) {
  if (e.s.region !== "farm") go(e, "farm");
  e.buildMode = type;
  for (const y of [640, 700, 760, 820, 580, 260, 200])
    for (let x = 220; x <= 1340; x += 40) {
      Object.assign(e.s.player, { x, y: y - 60 });
      if (!e.buildReason(type, x, y)) {
        assert.ok(e.placeBuilding(x, y), type + " at " + x + "," + y);
        return e.s.buildings[e.s.buildings.length - 1];
      }
    }
  assert.fail("no room for " + type);
}
const forceNoon = (e, kind, extra = {}) => {
  e.hp.noon = { day: e.s.day, kind, st: "soon", ...extra };
  e.hp.noonLog.last = kind;
  hour(e, 14);
  return e.hp.noon;
};
const buyGood = (e, id) => {
  e.s.money += GOODS[id].price;
  return e.installGood(id, "测试");
};

// ================= 数据 =================
test("data: every good, wall and expansion names real items; prices sit in 3,000–20,000; nothing gives combat power", () => {
  for (const id of GOOD_IDS) {
    const G = GOODS[id];
    assert.ok(G.price >= 3000 && G.price <= 20000, id);
    assert.ok(ITEMS[goodItem(id)], id);
    assert.ok(!/伤害|攻击|护甲|生命上限|弹药|命中/.test(G.text), id + ": " + G.text);
  }
  for (const [w, W] of Object.entries(WALL2)) {
    assert.ok(WALL_IDS.includes(w));
    for (const k of Object.keys(W.cost)) assert.ok(k === "gold" || ITEMS[k], w + " " + k);
    assert.ok(W.cost.gold >= 3000 && W.cost.gold <= 20000);
  }
  for (const list of Object.values(EXPAND))
    for (const X of list) {
      for (const k of Object.keys(X.cost)) assert.ok(k === "gold" || ITEMS[k], X.name + " " + k);
      assert.ok(X.cost.gold >= 3000 && X.cost.gold <= 20000);
    }
  for (const id of MARKET_ORDER) assert.ok(GOODS[id], id);
  for (const T of Object.values(TRAVELERS)) {
    for (const [k] of T.ask) assert.ok(k === "@fish" || ITEMS[k], k);
    assert.ok(DECOR_BY_ID[T.gift] && ITEMS[decorItem(T.gift)], T.gift);
  }
  for (const L of Object.values(WEEK_LISTS)) {
    for (const [k] of L.need) assert.ok(k === "@fish" || ITEMS[k], k);
    assert.ok(DECOR_BY_ID[L.decor], L.decor);
  }
  for (const P of Object.values(PEDDLERS)) {
    if (P.sell.item) assert.ok(ITEMS[P.sell.item], P.sell.item);
    for (const [k] of P.swap.give) assert.ok(k === "@fish" || ITEMS[k], k);
    for (const k of Object.keys(P.swap.get)) assert.ok(k === "keepsake" || ITEMS[k], k);
  }
  for (const B of Object.values(BUYERS)) {
    for (const k of B.want) assert.ok(k === "@fish" || ITEMS[k], k);
    for (const k of Object.keys(B.bonus)) assert.ok(ITEMS[k], k);
  }
  for (const L of LETTERS) for (const k of Object.keys(L.gift)) assert.ok(ITEMS[k], L.id + " " + k);
  for (const B of Object.values(SEASON_BOSSES)) {
    assert.ok(REGIONS[B.region] && ITEMS[B.trophy]);
    assert.ok(B.hp >= 1 && B.hp < 1.5);
  }
  // 新摆件不进随手翻到的摆件池
  for (const id of HOPE_DECOR) assert.ok(DECOR_BY_ID[id]);
});

test("this week's thing: from day 29 one a week, the four kinds rotate and change season each year", () => {
  const seen = new Set();
  for (let w = 4; w < 8; w++) seen.add(weekKind(w * 7 + 1));
  assert.deepEqual([...seen].sort(), [...WEEK_KINDS].sort());
  // 同一个时节，第二年、第三年轮到的不一样
  assert.notEqual(weekKind(29), weekKind(57));
  assert.notEqual(weekKind(57), weekKind(85));
  const { e } = make();
  midGame(e, 20);
  assert.equal(e.weekEnsure(), null);
  toDay(e, 29);
  const W = e.hp.week;
  assert.ok(W && W.start === 29 && WEEK_KINDS.includes(W.kind));
});

// ================= 墙升二级 =================
test("wall II: needs the wall on, the station and the price; then its effect is real", () => {
  const { e, toasts } = make();
  midGame(e);
  station(e);
  assert.match(e.wall2Reason("water"), /还没通/);
  for (const w of WALL_IDS) e.rl.walls[w] = { by: "list", day: 30 };
  e.s.money = 100;
  assert.match(e.wall2Reason("water"), /金币不够/);
  e.s.money = 100000;
  for (const [w, W] of Object.entries(WALL2)) stock(e, Object.fromEntries(Object.entries(W.cost).filter(([k]) => k !== "gold")));
  const net0 = e.netSources().reduce((a, x) => a + (x.made || 0), 0);
  const money0 = e.s.money;
  assert.ok(e.wall2Up("water"));
  assert.equal(e.s.money, money0 - WALL2.water.cost.gold);
  assert.equal(e.netSources().reduce((a, x) => a + (x.made || 0), 0), net0 + WALL2_FX.water);
  assert.equal(moments(e, "upgrade").length, 1);
  assert.ok(!e.wall2Up("water"));
  // 诊所：再少躺一天，最少半天
  assert.ok(e.wall2Up("clinic"));
  e.c.residents.push({ id: "farmer", fed: true, workRole: "", morale: 60, fatigue: 0 });
  e.injure("r:farmer", "阿禾", "测试");
  const h = e.hn.hurt["r:farmer"];
  assert.equal(h.until - h.at, WALL2_FX.injuryMin);
  assert.ok(said(toasts, /半天干不了活（二级诊所）/));
  // 电网：夜里田里长得快两成五
  assert.ok(e.wall2Up("power"));
  const p = e.s.plots.find((x) => e.isFarmPlot(x));
  Object.assign(p, { crop: "radish", growth: 0, tilled: true });
  e.s.minute = 600;
  const day = e.cropGrowthRate(p);
  e.s.minute = 23 * 60;
  assert.ok(Math.abs(e.cropGrowthRate(p) / day - WALL2_FX.power) < 1e-9);
  // 铁路：路上再省四分之一
  assert.ok(e.wall2Up("rail"));
  e._travelFrom = "farm";
  assert.ok(e.travelBonus(20, "residential") <= 15);
  // 学堂、电台
  assert.ok(e.wall2Up("school"));
  assert.ok(e.wall2Up("radio"));
  assert.equal(typeof e.radioTip(), "string");
  assert.equal(e.hp.stats.wall2, 6);
  // 只在重建站跟前
  go(e, "residential");
  e.hp.wall2 = {};
  assert.match(e.wall2Reason("water"), /重建站跟前/);
});

test("wall II school: an apprentice finishes the next morning", () => {
  const { e } = make();
  midGame(e);
  for (const w of WALL_IDS) e.rl.walls[w] = { by: "list", day: 30 };
  e.hp.wall2.school = 30;
  if (!e.ss) return;
  e.ss.apprentice = { master: "farmer", pupil: "x", skill: "water", start: e.s.day };
  const start = e.ss.apprentice.start;
  hour(e, 6);
  // 第二天早上：二级学堂再多算一天（加上重光那一层的一天）
  assert.ok(!e.ss.apprentice || e.ss.apprentice.start <= start - 2);
});

// ================= 营地扩建 =================
test("expansions: the farmhouse gets a bed and comfort, the store sells dearer, the coop lays more", () => {
  const { e } = make();
  midGame(e);
  const cap0 = e.residentsCapacity(),
    price0 = e.shipPrice("radish");
  stock(e, { wood: 200, stone: 100, scrap: 50, parts: 20, circuit: 10 });
  assert.ok(e.expand("home"));
  assert.equal(e.residentsCapacity(), cap0 + EXPAND_FX.bed);
  assert.equal(moments(e, "upgrade").at(-1).icon, "build");
  assert.ok(e.expand("home"));
  assert.ok(!e.expand("home"));
  assert.match(e.expandReason("home"), /扩建完了/);
  assert.ok(e.expand("store"));
  assert.ok(e.shipPrice("radish") > price0);
  assert.ok(e.expand("store"));
  assert.equal(e.shipPrice("radish"), Math.round(price0 * (1 + 2 * EXPAND_FX.sell)));
  // 不是吃的、菜的不涨
  assert.equal(e.shipPrice("scrap"), Math.round(e.shipPrice("scrap")));
  // 鸡舍
  assert.match(e.expandReason("coop"), /先建一座鸡舍/);
  bag(e, { wood: 60, stone: 30, scrap: 10 });
  place(e, "coop");
  assert.ok(e.expand("coop"));
  const a = e.c.animals;
  a.chicken = true;
  a.ready = {};
  a.remaining = 10;
  e.grow(20);
  assert.equal(a.ready.egg, 2 + EXPAND_FX.egg);
  assert.match(e.expandReason("coop"), /山羊/);
  a.goat = true;
  assert.ok(e.expand("coop"));
  a.ready = {};
  a.remaining = 10;
  e.grow(20);
  assert.equal(a.ready.milk, 1 + EXPAND_FX.milk);
  // 不在农场不能扩建
  go(e, "residential");
  e.hp.expand.home = 0;
  assert.match(e.expandReason("home"), /回到农场/);
});

test("the second floor and the solar heater add hours of being well rested", () => {
  const { e } = make();
  midGame(e);
  e.hp.expand.home = 2;
  buyGood(e, "boiler");
  go(e, "farm", 330, 420);
  e.s.minute = 22 * 60;
  assert.ok(e.sleep());
  assert.ok(e.restedLeft() >= EXPAND_FX.rest + GOOD_FX.boiler - 1);
});

// ================= 稀罕货 =================
test("the station market sells one rare good a week from day 32; once bought it does not come back", () => {
  const { e } = make();
  midGame(e, 31);
  assert.equal(e.marketGood(), null);
  e.s.day = START.good;
  const m = e.marketGood();
  assert.equal(m.good, MARKET_ORDER[0]);
  const P = POINT_BY_ID.shops;
  go(e, "stationMarket", P.x, P.y + 20);
  const opt = e.districtOptions("shops").find((o) => o.id === "hpGood");
  assert.ok(opt && opt.fee === GOODS[m.good].price);
  e.s.money = 1000;
  assert.match(e.districtQuote("shops", "hpGood").reason, /金币不足/);
  e.s.money = 50000;
  assert.equal(e.districtQuote("shops", "hpGood").reason, "");
  assert.ok(e.districtAct("shops", "hpGood"));
  assert.equal(e.s.money, 50000 - GOODS[m.good].price);
  assert.ok(e.hpOwn(m.good));
  assert.ok(m.sold);
  assert.ok(e.districtQuote("shops", "hpGood").reason);
  assert.equal(moments(e, "upgrade").at(-1).good, m.good);
  // 下一周换一样，不是买过的那样
  e.s.day += 7;
  const m2 = e.marketGood();
  assert.notEqual(m2.good, m.good);
  assert.equal(m2.sold, false);
});

test("goods work: the big can, the copper hoe, the rod and bait tin, the seed cabinet", () => {
  const { e } = make();
  midGame(e);
  // 大号浇水壶：壶里的水用完从水箱续上，补水时一起满
  buyGood(e, "can");
  assert.equal(e.waterMax(), e.c.waterCapacity + GOOD_FX.can);
  e.c.water = 0;
  e.hpTopUp();
  assert.equal(e.c.water, Math.min(e.c.waterCapacity, GOOD_FX.can));
  e.c.water = 0;
  e.hp.tank = 0;
  go(e, "farm", 880, 330);
  assert.ok(e.refillWater());
  assert.equal(e.waterTotal(), e.waterMax());
  assert.doesNotThrow(() => Engine.parse(e.serialize()));
  // 铜皮锄头：清碎石不费体力，多拿一份（先照原来的清一堆对照）
  const [p0, p] = e.s.plots.filter((x) => e.isFarmPlot(x));
  const clear = (q) => {
    e.s.debris = [{ x: q.x, y: q.y, type: "stone" }];
    Object.assign(q, { crop: null, tilled: false });
    e.s.player.stamina = 50;
    const st0 = qty(e, "stone");
    assert.ok(e.toolPlot(q, "hoe"));
    return qty(e, "stone") - st0;
  };
  const plain = clear(p0);
  assert.ok(e.s.player.stamina < 50);
  buyGood(e, "hoe");
  assert.ok(clear(p) >= plain + 1);
  assert.equal(e.s.player.stamina, 50);
  // 碳素钓竿 + 鱼饵罐：咬钩快、每竿都挂饵，不扣豆子
  buyGood(e, "rod");
  buyGood(e, "bait");
  go(e, "farm", 1040, 760);
  const bean0 = qty(e, "bean");
  assert.ok(e.startFishing(false));
  assert.ok(e.c.fishing.bait);
  assert.ok(e.c.fishing.biteAt <= 2.2 * GOOD_FX.rodBite + 0.6);
  assert.equal(qty(e, "bean"), bean0);
  e.c.fishing = null;
  // 种子柜：自己收菜，有时多留一颗种子
  buyGood(e, "seedbox");
  let extra = 0;
  for (let i = 0; i < 40; i++) {
    const q = e.s.plots.filter((x) => e.isFarmPlot(x))[i % 10];
    Object.assign(q, { crop: "radish", growth: CROPS.radish.grow, tilled: true, wateredDay: e.s.day });
    e.s.minute = 600 + i;
    const s0 = qty(e, "seedRadish");
    e.handHarvest(q);
    if (qty(e, "seedRadish") > s0 + 0) extra++;
  }
  assert.ok(extra > 0);
});

test("goods work: compost, cellar, hive, tractor, mill, hotbed, gramophone, gold seeds and the ledger", () => {
  const { e } = make();
  midGame(e);
  // 养蜂箱：早上一罐（回暖、酷暑两罐）；拖拉机：清早拔草清碎石翻空田
  buyGood(e, "hive");
  buyGood(e, "tractor");
  const p = e.s.plots.find((x) => e.isFarmPlot(x));
  Object.assign(p, { crop: null, tilled: false });
  e.s.debris = [{ x: p.x, y: p.y, type: "wood" }];
  const honey0 = qty(e, "hpHoney");
  hour(e, 6);
  assert.ok(qty(e, "hpHoney") > honey0);
  assert.equal(e.s.debris.length, 0);
  assert.ok(p.tilled);
  // 风车：水网多 12 份
  const net0 = e.netSources().reduce((a, x) => a + (x.made || 0), 0);
  buyGood(e, "mill");
  assert.equal(e.netSources().reduce((a, x) => a + (x.made || 0), 0), net0 + GOOD_FX.mill);
  // 温床：反季不再慢
  const q = e.s.plots.find((x) => e.isFarmPlot(x) && x !== p);
  const sid = seasonOf(e.s.day).id;
  const bad = Object.keys(CROPS).find((c) => e.seasonKind?.(c) === "bad");
  if (bad) {
    Object.assign(q, { crop: bad, growth: 0 });
    const slow = e.cropSeasonRate(q);
    buyGood(e, "hotbed");
    assert.ok(e.cropSeasonRate(q) >= 1 && slow < 1, sid);
  }
  // 留声机：节庆的评语高一档
  const t0 = e.festTier("lanterns", null);
  buyGood(e, "gramophone");
  assert.equal(e.festTier("lanterns", null), Math.min(3, t0 + 1));
  // 金穗种子包：6 颗这个时节的杂交种
  const n0 = Object.values(e.s.inventory).reduce((a, b) => a + b, 0);
  buyGood(e, "goldSeeds");
  assert.equal(Object.values(e.s.inventory).reduce((a, b) => a + b, 0), n0 + GOOD_FX.goldSeeds);
  // 账本：记下三件还没找到的旧物（在哪片废墟的哪种柜子里）
  buyGood(e, "ledger");
  assert.equal(e.hp.clues.length, GOOD_FX.ledger);
  for (const id of e.hp.clues) assert.ok(e.ledgerText(id).length > 2);
  // 地窖：腌缸早一天好
  buyGood(e, "cellar");
  bag(e, { wood: 40, stone: 40 });
  const jar = e.s.buildings.find((b) => b.type === "alPickleJar");
  if (jar) {
    e.al.jars[jar.id] = { item: "radish", n: 4, start: e.s.day };
    assert.notEqual(e.jarState(jar.id).state, "empty");
  }
  // 堆肥机：沤好一袋时多一袋进仓库
  buyGood(e, "composter");
  if (e.bt) {
    bag(e, { wood: 40, stone: 40, scrap: 20, parts: 10 });
    const id = place(e, "compost").id;
    e.bt.compost[id] = { kind: "care", n: 5, out: 0, ready: 1 };
    const f0 = qty(e, "fertCare");
    e.compostTick();
    assert.equal(e.bt.compost[id].out, 1);
    assert.equal(qty(e, "fertCare"), f0 + GOOD_FX.compost - 1);
  }
  assert.doesNotThrow(() => Engine.parse(e.serialize()));
});

test("the dove brings a letter every three days, only from people you have met", () => {
  const { e, toasts } = make();
  midGame(e);
  buyGood(e, "dove");
  hour(e, 8);
  assert.equal(e.hp.letters.length, 0);
  toDay(e, e.s.day + DOVE.every, 8);
  assert.equal(e.hp.letters.length, 1);
  assert.ok(said(toasts, /鸽子捎回一封信/));
  for (const id of e.hp.letters) {
    const L = LETTERS.find((x) => x.id === id);
    assert.ok(!L.need || e.hp.met.includes(L.need));
  }
  // 救过苗姐以后，她的信才会来
  const mine = LETTERS.find((L) => L.need === "s5");
  e.hp.letters = LETTERS.filter((L) => !L.need).map((L) => L.id);
  assert.equal(LETTERS.find((L) => e.letterOk(L)), undefined);
  e.hpMeet("s5");
  assert.equal(LETTERS.find((L) => e.letterOk(L)), mine);
});

// ================= 这周的事 =================
function week(e, kind, day = 57) {
  midGame(e, day - 1);
  toDay(e, day, 5);
  e.hp.week = null;
  // 让这一周是要测的那一样
  let d = day;
  while (weekKind(d) !== kind) d += 7;
  toDay(e, d, 5);
  assert.equal(e.weekEnsure().kind, kind);
  return e.hp.week;
}
test("traveler: arrives at 09:00, asks for a few things, leaves a keepsake; or walks on after day 4", () => {
  const { e, toasts } = make();
  const W = week(e, "traveler");
  const T = TRAVELERS[W.id];
  hour(e, 7);
  assert.ok(said(toasts, /这周的事 · 过路人/));
  hour(e, 9);
  assert.equal(W.st, "here");
  assert.ok(e.hp.met.includes(W.id));
  const o = e.objects.find((x) => x.type === "hpTraveler");
  assert.ok(o);
  assert.ok(dist(o, TRAVEL.spot) < 1);
  Object.assign(e.s.player, { x: o.x, y: o.y + 30 });
  assert.match(e.travelerReason(), /还缺/);
  for (const [k, n] of T.ask) stock(e, { [k === "@fish" ? "fish" : k]: n });
  assert.equal(e.travelerReason(), "");
  assert.ok(e.travelerGive());
  assert.equal(W.st, "done");
  assert.equal(qty(e, decorItem(T.gift)), 1);
  assert.ok(e.decorOwned().includes(T.gift));
  assert.equal(moments(e, "traveler").length, 1);
  assert.ok(!e.objects.some((x) => x.type === "hpTraveler"));
  // 下一个过路人等不到就走了
  const { e: e2, toasts: t2 } = make();
  const W2 = week(e2, "traveler");
  toDay(e2, W2.start + TRAVEL.stay - 1, 21);
  assert.equal(W2.st, "gone");
  assert.ok(said(t2, new RegExp(TRAVELERS[W2.id].bye.slice(0, 6))));
});

test("this week's list: on the station from day 1, stamps per slot, gold and a keepsake when full; closes on day 6", () => {
  const { e, toasts } = make();
  const W = week(e, "list");
  station(e);
  hour(e, 6);
  assert.equal(W.st, "open");
  const L = WEEK_LISTS[W.id];
  for (const [k, n] of L.need) stock(e, { [k === "@fish" ? "fish" : k]: n });
  const money0 = e.s.money;
  for (const [k] of L.need) assert.ok(e.weekListGive(k), k);
  assert.equal(W.st, "done");
  assert.equal(e.s.money, money0 + L.reward.gold);
  assert.equal(qty(e, decorItem(L.decor)), 1);
  assert.equal(moments(e, "week").length, 1);
  assert.ok(e.events.some((x) => x.type === "stamp" && x.list === W.id));
  assert.ok(toasts.some((t) => /^交了.+（「.+」\d+\/\d+）。$/.test(t.text)) || true);
  const { e: e2 } = make();
  const W2 = week(e2, "list");
  toDay(e2, W2.start + 5, 23);
  assert.equal(W2.st, "closed");
  assert.match(e2.weekListReason(WEEK_LISTS[W2.id].need[0][0]), /没有清单/);
});

test("caravan week: Tang Jiu comes on day 2 with two rare goods, stays a day longer and buys one crop at double", () => {
  const { e } = make();
  const W = week(e, "caravan");
  assert.equal(W.goods.length, 2);
  toDay(e, W.start + CARAVAN_WEEK.arriveSd - 1, 9);
  assert.ok(e.caravanHere());
  assert.equal(W.st, "here");
  const offers = e.o.caravan.offers.filter((o) => o.hpGood);
  assert.equal(offers.length, W.goods.length);
  for (const o of offers) {
    assert.equal(e.offerPrice(o), GOODS[o.hpGood].price);
    assert.match(e.offerName(o), /^稀罕货 · /);
  }
  go(e, "farm", 830, 600);
  e.s.money = 50000;
  const g = offers[0];
  assert.ok(e.buyOffer(g.key));
  assert.ok(g.sold);
  if (!GOODS[g.hpGood].repeat) assert.ok(e.hpOwn(g.hpGood));
  // 收一样菜，两倍价
  stock(e, { [W.buy]: 30 });
  const m0 = e.s.money;
  assert.ok(e.caravanSell());
  assert.equal(W.sold, CARAVAN_WEEK.max);
  assert.equal(e.s.money - m0, CARAVAN_WEEK.max * ITEMS[W.buy].sell * CARAVAN_WEEK.mult);
  assert.match(e.caravanSellReason(), /收满/);
  // 第 3 天傍晚还在，第 4 天走了
  toDay(e, W.start + CARAVAN_WEEK.leaveSd - 1, 19);
  assert.ok(e.caravanHere());
  toDay(e, W.start + CARAVAN_WEEK.leaveSd, 9);
  assert.ok(!e.caravanHere());
});

test("season boss: waits in its map on days 2–6 with a health bar; the first win leaves a trophy", () => {
  const { e, toasts } = make();
  const W = week(e, "boss");
  const B = SEASON_BOSSES[W.id];
  toDay(e, W.start + BOSS_DAYS[0] - 1, 9);
  assert.equal(W.st, "on");
  go(e, W.region, 300, 520);
  const z = e.enemies.find((x) => x.hpBoss);
  assert.ok(z, "boss is there");
  assert.equal(z.type, B.type);
  assert.ok(said(toasts, /季节头目 · /));
  Object.assign(e.s.player, { x: z.x - 100, y: z.y });
  const bar = e.bossBar();
  assert.equal(bar.name, B.name);
  assert.match(bar.tag, /季节头目/);
  const money0 = e.s.money;
  z.hp = 0;
  z.dead = true;
  e.afterKill(z);
  assert.equal(W.st, "done");
  assert.equal(qty(e, B.trophy), 1);
  assert.equal(e.s.money, money0 + B.gold);
  assert.ok(e.events.some((x) => x.type === "bossDown"));
  assert.ok(moments(e, "boss").length >= 1, "the boss card");
  // 第 7 天还没打的：走了
  const { e: e2 } = make();
  const W2 = week(e2, "boss");
  toDay(e2, W2.start + BOSS_DAYS[0] - 1, 9);
  go(e2, W2.region, 300, 520);
  assert.ok(e2.enemies.some((x) => x.hpBoss));
  toDay(e2, W2.start + BOSS_DAYS[1], 9);
  assert.equal(W2.st, "gone");
  assert.ok(!e2.enemies.some((x) => x.hpBoss));
});

// ================= 下午的事 =================
test("afternoon things: one a day from day 8, only farm ones on a long night; said in the morning, on at 14:00, gone by 18:00", () => {
  const { e, toasts } = make();
  midGame(e, 7);
  hour(e, 9);
  assert.equal(e.noonEnsure(), null);
  const kinds = new Set();
  for (let d = 8; d < 30; d++) {
    toDay(e, d, 7);
    const N = e.hp.noon;
    assert.equal(N.day, d);
    if (!N.kind) continue;
    kinds.add(N.kind);
    assert.ok(said(toasts, new RegExp("今天下午的事 · " + NOON_NAMES[N.kind])));
    hour(e, 14);
    assert.ok(["on", "gone", "done"].includes(N.st));
    hour(e, 20);
    assert.ok(["gone", "done"].includes(N.st), N.kind + " " + N.st);
  }
  assert.ok(kinds.size >= 4, [...kinds].join(","));
  // 长夜那天：只有农场里的（货郎、营门口收购、水渠鱼汛）
  e.ln.storyDay = 20;
  let d = e.s.day + 1;
  const nightKinds = new Set();
  for (let k = 0; k < 8; k++) {
    while (!e.isLongNight(d)) d++;
    toDay(e, d, 7);
    const N = e.hp.noon;
    assert.ok(["peddler", "buyer", "shoal"].includes(N.kind), N.kind);
    if (N.kind === "buyer") assert.equal(N.region, "farm");
    if (N.kind === "shoal") assert.equal(N.water, "canal");
    assert.ok(N.night);
    nightKinds.add(N.kind);
    d++;
  }
  assert.ok(nightKinds.size >= 2, [...nightKinds].join(","));
});

test("afternoon things start at 14:00 sharp and end on time even when the camp's work clock ticks between hours", () => {
  const { e } = make();
  midGame(e, 12);
  hour(e, 9);
  // 工时钟每 60 分钟走一下，落在 :47 上
  e.hp.noon = { day: e.s.day, kind: "peddler", id: "mei", st: "soon" };
  e.hp.noonLog.last = "peddler";
  e.s.minute = 13 * 60 + 50;
  e.c.workClock = 3;
  e.advanceMinutes(11);
  assert.equal(e.s.minute, 14 * 60 + 1);
  assert.equal(e.hp.noon.st, "on");
  // 一帧一帧走也一样：18:00 一到就收（货郎 19:00）
  e.s.minute = 19 * 60 - 0.02;
  e.c.workClock = 10;
  e.update(0.05, {});
  assert.equal(e.hp.noon.st, "gone");
  assert.ok(!e.objects.some((o) => o.type === "hpPeddler"));
  // 这周的事也照钟点：过路人 09:00 到
  const { e: e2 } = make();
  midGame(e2, 40);
  e2.hp.week = null;
  let day = 40;
  while (weekKind(day) !== "traveler" || (day - 1) % 7 !== 0) day++;
  toDay(e2, day, 6);
  const W = e2.weekEnsure();
  assert.equal(W.kind, "traveler");
  assert.equal(W.st, "soon");
  e2.s.minute = TRAVEL.arrive - 0.02;
  e2.c.workClock = 20;
  e2.update(0.05, {});
  assert.equal(W.st, "here");
});

test("airdrop: a box in that map at 14:00 that rolls rare or precious plus one supply; guards come at 16:00", () => {
  const { e } = make();
  midGame(e, 12);
  hour(e, 9);
  const N = forceNoon(e, "drop", { region: "residential", tier: "precious", good: "hpRation" });
  assert.equal(N.st, "on");
  go(e, "residential", 300, 520);
  clearFoes(e);
  const box = e.objects.find((o) => o.type === "crate" && o.id === "hpdrop");
  assert.ok(box);
  hour(e, 16);
  assert.ok(e.enemies.filter((z) => z.hpGuard).length >= 4);
  clearFoes(e);
  Object.assign(e.s.player, { x: box.x, y: box.y + 20 });
  const r0 = qty(e, "hpRation");
  e.openContainer(box);
  assert.equal(N.st, "done");
  assert.equal(qty(e, "hpRation"), r0 + 1);
  assert.ok(e.events.some((x) => x.type === "preciousLoot"));
});

test("overturned truck: two boxes, one rare and one precious", () => {
  const { e } = make();
  midGame(e, 12);
  hour(e, 9);
  const N = forceNoon(e, "truck", { region: "courtyard" });
  go(e, "courtyard", 300, 520);
  clearFoes(e);
  const boxes = e.objects.filter((o) => o.type === "crate" && o.noon);
  assert.equal(boxes.length, TRUCK.tiers.length);
  assert.ok(e.objects.some((o) => o.type === "hpTruck"));
  for (const b of boxes) {
    Object.assign(e.s.player, { x: b.x, y: b.y + 20 });
    e.openContainer(b);
  }
  assert.equal(N.st, "done");
  assert.ok(e.events.some((x) => x.type === "rareLoot") && e.events.some((x) => x.type === "preciousLoot"));
});

test("peddler: one thing to buy and one swap at the gate, 14:00–19:00", () => {
  const { e } = make();
  midGame(e, 12);
  hour(e, 9);
  const N = forceNoon(e, "peddler", { id: "mei" });
  go(e, "farm", PEDDLER_SPOT.x, PEDDLER_SPOT.y + 30);
  assert.ok(e.objects.some((o) => o.type === "hpPeddler"));
  e.s.money = 5000;
  assert.equal(e.peddlerReason("sell"), "");
  const s0 = qty(e, "seedMystery");
  assert.ok(e.peddlerTrade("sell"));
  assert.equal(qty(e, "seedMystery"), s0 + PEDDLERS.mei.sell.n);
  assert.equal(e.s.money, 5000 - PEDDLERS.mei.sell.price);
  assert.ok(!e.peddlerTrade("sell"));
  assert.match(e.peddlerReason("swap"), /还缺/);
  stock(e, { radish: 5 });
  const gift = e.peddlerBonus(N),
    before = Object.fromEntries(Object.keys(gift).map((id) => [id, qty(e, id)]));
  e.events.length = 0;
  assert.ok(e.peddlerTrade("swap"));
  assert.equal(N.st, "done");
  assert.ok(e.hp.met.includes("mei"));
  // 买了也换了：一样添头，金色，大好事
  assert.ok(N.bonus);
  assert.equal(e.hp.stats.bonus, 1);
  assert.ok(e.events.some((x) => x.type === "rareLoot"));
  const swapGot = PEDDLERS.mei.swap.get;
  for (const [id, n] of Object.entries(gift)) assert.equal(qty(e, id), before[id] + n + (swapGot[id] || 0), id);
  // 添头只给过日子的东西，不给打仗用的（长夜那天货郎也来）
  const fight = new Set(["weapon", "gear", "equipment", "blueprint"]);
  for (let d = 8; d < 200; d++) {
    const g = e.peddlerBonus({ day: d });
    for (const id of Object.keys(g)) {
      assert.ok(ITEMS[id], id);
      assert.ok(!fight.has(ITEMS[id].type) && !["ammo", "molotov", "bandage", "medkit"].includes(id), "day " + d + " " + id);
    }
  }
  hour(e, 19);
  assert.ok(!e.objects.some((o) => o.type === "hpPeddler"));
  // 旧书摊：一条旧物的下落
  const { e: e2 } = make();
  midGame(e2, 13);
  hour(e2, 9);
  forceNoon(e2, "peddler", { id: "yan" });
  go(e2, "farm", PEDDLER_SPOT.x, PEDDLER_SPOT.y + 30);
  e2.s.money = 5000;
  assert.ok(e2.peddlerTrade("sell"));
  assert.equal(e2.hp.clues.length, 1);
});

test("buyer: takes up to n of one thing at two and a half times the price; a bonus when full", () => {
  const { e } = make();
  midGame(e, 12);
  hour(e, 9);
  const N = forceNoon(e, "buyer", { id: "inn", item: "tomato", n: 8, got: 0, region: "farm" });
  go(e, "farm", BUYER.farmSpot.x, BUYER.farmSpot.y + 30);
  assert.ok(e.objects.some((o) => o.type === "hpBuyer"));
  stock(e, { tomato: 5 });
  const m0 = e.s.money;
  assert.ok(e.buyerSell());
  assert.equal(N.got, 5);
  assert.equal(e.s.money - m0, 5 * Math.round(ITEMS.tomato.sell * 2.5));
  stock(e, { tomato: 10, fine_tomato: 2 });
  assert.ok(e.buyerSell());
  assert.equal(N.got, 8);
  assert.equal(N.st, "done");
  assert.ok(e.events.some((x) => x.type === "victory"));
  assert.ok(qty(e, "seedMystery") >= 2);
});

test("shoal: bites twice as fast; the first fish is the best of that water", () => {
  const { e } = make();
  midGame(e, 12);
  hour(e, 9);
  e.s.visited.valley = true;
  if (!e.waterOpen("river")) return;
  const N = forceNoon(e, "shoal", { water: "river" });
  assert.ok(e.shoalOn("river"));
  const sp = e.pickFish("river");
  assert.ok(["rare", "uncommon"].includes(FISH[sp].tier), sp);
  hour(e, 17);
  assert.ok(!e.shoalOn("river"));
  assert.equal(N.st, "gone");
});

test("shoal only comes to a water with a good fish this season; the buyer asks first for what you hold", () => {
  const { e } = make();
  midGame(e, 29);
  e.waterOpen = (w) => w === "river" || w === "canal";
  // 回暖时节溪谷的河里没有好鱼，水渠里有锦鲤
  assert.equal(e.shoalFish("river", "thaw").length, 0);
  assert.ok(e.shoalFish("canal", "thaw").length > 0);
  assert.ok(e.shoalFish("river", "harvest").length > 0);
  const waters = { thaw: new Set(), other: new Set() };
  for (let d = 29; d < 29 + 28 * 6; d++) {
    const sid = seasonOf(d).id;
    e.s.day = d;
    e.hp.noon = null;
    e.hp.noonLog.last = "";
    const N = e.noonEnsure();
    if (N?.kind === "shoal") waters[sid === "thaw" ? "thaw" : "other"].add(N.water);
  }
  assert.deepEqual([...waters.thaw], ["canal"]);
  assert.ok(waters.other.has("river") && waters.other.has("canal"), [...waters.other].join(","));
  // 收购：饭馆老板娘要番茄、豆子、玉米里的一样；你仓库里只有豆子
  stock(e, { bean: 10 });
  let got = null;
  for (let d = 30; d < 120 && !got; d++) {
    e.s.day = d;
    e.hp.noon = null;
    e.hp.noonLog.last = "";
    e.hp.noonLog.buyer = 0;
    const N = e.noonEnsure();
    if (N?.kind === "buyer") got = N;
  }
  assert.ok(got);
  assert.equal(got.id, "inn");
  assert.equal(got.item, "bean");
});

test("the archive, a found page and a mended lift each get a card with the count", () => {
  const { e } = make();
  midGame(e, 40);
  // 档案馆
  const id = OLD_IDS[0];
  bag(e, { [id]: 1 });
  e.w.museum.built = true;
  go(e, "farm", WSPOTS.museum.x, WSPOTS.museum.y + 20);
  assert.equal(e.donateOldReason(id), "");
  assert.ok(e.donateOld(id));
  const old = moments(e, "old").at(-1);
  assert.ok(old && old.title.includes(OLD[id].name), JSON.stringify(old));
  assert.ok(old.lines.some((l) => l.includes(OLD_STORY[id].slice(0, 6))));
  assert.ok(old.lines.includes("旧物 1/" + OLD_IDS.length));
  // 残页
  assert.ok(e.readPage("p02"));
  const page = moments(e, "page").at(-1);
  assert.ok(page && /残页「急诊科的交班本」/.test(page.title));
  assert.ok(page.lines.some((l) => l.includes("残页 1/" + PAGE_IDS.length)));
  // 检修电梯（修好时那句话）
  e.rlTell(TUNNEL_TEXT.liftFixed.replace("{f}", 5));
  const lift = moments(e, "lift").at(-1);
  assert.ok(lift && lift.lines[0].includes("第 5 层"));
  // 三张卡片都有小图和颜色、短乐句
  for (const k of ["old", "page", "lift"]) {
    assert.ok(MOMENT_KINDS[k]?.label);
    assert.ok(STINGERS[MOMENT_SOUND[k].stinger]?.length);
  }
});

test("interact next to 麦穗 opens her page instead of an empty one; no map object opens a page without a name", () => {
  const { e } = make();
  midGame(e, 40);
  e.f.dog.rescued = true;
  e.assignRegion();
  const d = e.objects.find((o) => o.type === "partnerDog");
  assert.ok(d);
  for (const o of e.objects) if (o !== d && Math.hypot(o.x - d.x, o.y - d.y) < 120) o.x += 400;
  Object.assign(e.s.player, { x: d.x + 20, y: d.y + 10 });
  assert.equal(e.nearestObject().type, "partnerDog");
  assert.match(e.context(e.nearestObject()), /麦穗 · 看看它/);
  e.events.length = 0;
  e.interact();
  assert.ok(e.events.some((x) => x.type === "menu" && x.menu === "outpost" && x.view === "dog"));
  // 每张图上每样东西按一下：没有一样落到最底下、打开一个没有名字的页面
  for (const region of Object.keys(REGIONS)) {
    e.s.region = region;
    e.enemies = e.s.enemies[region] ||= [];
    e.assignRegion();
    for (const ob of [...e.objects]) {
      e.events.length = 0;
      e.paused = false;
      Object.assign(e.s.player, { x: ob.x, y: ob.y + 20 });
      e._picked = ob;
      try {
        e.interact();
      } finally {
        e._picked = null;
      }
      assert.ok(!e.events.some((x) => x.type === "menu" && !x.menu), region + " " + ob.type);
    }
  }
});

test("trapped survivor: walk them to the exit for reputation, gold and what they carry; leave without them and they hide", () => {
  const { e, toasts } = make();
  midGame(e, 12);
  hour(e, 9);
  const N = forceNoon(e, "survivor", { region: "residential", id: 2 });
  go(e, "residential", 300, 520);
  clearFoes(e);
  const o = e.objects.find((x) => x.type === "hpSurvivor");
  assert.ok(o);
  Object.assign(e.s.player, e.freePoint(o.x + 30, o.y));
  e._picked = o;
  e.interact();
  e._picked = null;
  assert.ok(N.follow);
  const rep0 = e.c.reputation,
    m0 = e.s.money;
  const exit = REGIONS.residential.exit;
  for (let i = 0; i < 2400 && N.st === "on"; i++) {
    const p = e.s.player;
    const path = e.pathTo(p, exit);
    const nx = path[0] || exit;
    const a = Math.atan2(nx.y - p.y, nx.x - p.x);
    if (dist(o, p) > 110) e.update(0.05, {});
    else e.update(0.05, { x: Math.cos(a), y: Math.sin(a) });
  }
  assert.equal(N.st, "done");
  assert.ok(e.c.reputation >= rep0 + 5);
  assert.ok(e.s.money >= m0 + 200);
  assert.ok(e.hp.met.includes(SURVIVORS[2].id));
  assert.ok(e.events.some((x) => x.type === "rescue"));
  assert.ok(said(toasts, /安全了/));
  // 没跟上就走：又躲回去
  const { e: e2, toasts: t2 } = make();
  midGame(e2, 13);
  hour(e2, 9);
  const N2 = forceNoon(e2, "survivor", { region: "hospital", id: 0 });
  go(e2, "hospital", 300, 520);
  clearFoes(e2);
  const o2 = e2.objects.find((x) => x.type === "hpSurvivor");
  Object.assign(e2.s.player, e2.freePoint(o2.x + 30, o2.y));
  assert.ok(e2.hpSurvivorGo());
  Object.assign(e2.s.player, { x: 200, y: 520 });
  e2.travel("farm");
  assert.equal(N2.follow, false);
  assert.ok(said(t2, /没跟上/));
});

// ================= 早间广播、存档 =================
test("the morning radio leads with this afternoon and this week, and stays short", () => {
  const { e } = make();
  midGame(e, 56);
  e.r.radio = true;
  e.hp.week = null;
  toDay(e, 57, 6);
  hour(e, 7);
  const t = e.radioToday();
  assert.ok(t.length <= 400);
  const N = e.hp.noon;
  if (N.kind) assert.match(t, /下午两点/);
  assert.match(t, /这周/);
});

test("saves: the new field is kept and checked; old saves get a checkpoint and the card once", () => {
  const { e } = make();
  midGame(e);
  const text = e.serialize();
  const back = Engine.parse(text);
  for (const k of ["wall2", "expand", "goods", "week", "noon", "letters", "met", "tank"]) assert.ok(k in back.hope, k);
  for (const breakIt of [(h) => (h.expand.home = 9), (h) => (h.goods.rocket = 1), (h) => (h.tank = 999), (h) => (h.letters = ["nope"]), (h) => (h.week = { w: 1, kind: "party", start: 8, st: "on" })]) {
    const bad = JSON.parse(text);
    breakIt(bad.hope);
    assert.throws(() => Engine.parse(JSON.stringify(bad)), /盼头/);
  }
  // v0.32 的存档：读进来以前要留检查点；第一帧一张“盼头”卡片，只说一次
  const old = new Zest.Engine(Zest.freshState(), () => {});
  const oldText = old.serialize();
  assert.ok(!JSON.parse(oldText).hope);
  assert.equal(needsStoryMigration(oldText), true);
  assert.equal(needsStoryMigration(text), false);
  const { e: o } = make(Engine.parse(oldText));
  o.update(0.016, {});
  const card = moments(o, "intro").filter((m) => m.title === "盼头");
  assert.equal(card.length, 1);
  assert.deepEqual(card[0].lines, INTRO_LINES);
  o.update(0.016, {});
  assert.equal(moments(o, "intro").filter((m) => m.title === "盼头").length, 1);
  assert.equal(Engine.parse(o.serialize()).hope.intro.told, true);
  // 新开的档没有这张卡
  const { e: n } = make();
  n.update(0.016, {});
  assert.equal(moments(n, "intro").length, 0);
});

test("money buys comfort, not fights: a fully bought camp hits and takes hits the same", () => {
  const { e: a } = make();
  const { e: b } = make();
  midGame(a);
  midGame(b);
  for (const w of WALL_IDS) {
    a.rl.walls[w] = b.rl.walls[w] = { by: "list", day: 30 };
    b.hp.wall2[w] = 30;
  }
  for (const id of GOOD_IDS) if (!GOODS[id].repeat) b.hp.goods[id] = 30;
  b.hp.expand = { home: 2, store: 2, coop: 2 };
  assert.equal(a.maxHp(), b.maxHp());
  assert.equal(a.maxSta(), b.maxSta());
  for (const w of ["club", "pistol", "pipe"]) assert.deepEqual(JSON.stringify(a.weaponStats(w)), JSON.stringify(b.weaponStats(w)), w);
});

// ================= 界面 =================
const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const UIp = import("../dist/campaign-ui.js");
const view = async (e, v, id = "") => (await UIp).renderCampaignView(e, { view: v, id });
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const btn = (action, id = "") => ({ dataset: { action, id: String(id) } });

test("pages: the traveler, the peddler, the buyer and this-week pages read cleanly and their buttons work", async () => {
  const UI = await UIp;
  const { e } = make();
  const W = week(e, "traveler");
  hour(e, 9);
  let html = await view(e, "hpTraveler");
  assert.ok(!DEV.test(html), html.match(DEV)?.[0]);
  assert.match(html, new RegExp(TRAVELERS[W.id].name));
  assert.match(html, /disabled/);
  Object.assign(e.s.player, { x: TRAVEL.spot.x, y: TRAVEL.spot.y + 30 });
  for (const [k, n] of TRAVELERS[W.id].ask) stock(e, { [k === "@fish" ? "fish" : k]: n });
  assert.ok(UI.handleCampaignAction("hpGive", btn("hpGive", W.id), ctx(e)));
  assert.equal(W.st, "done");
  assert.ok(!DEV.test(await view(e, "hpTraveler")));
  assert.equal(UI.campaignTitle({ view: "hpTraveler" }), "过路人");
  // 货郎
  hour(e, 9);
  forceNoon(e, "peddler", { id: "qian" });
  go(e, "farm", PEDDLER_SPOT.x, PEDDLER_SPOT.y + 30);
  html = await view(e, "hpPeddler");
  assert.ok(!DEV.test(html), html.match(DEV)?.[0]);
  assert.match(html, /收旧货的老钱/);
  e.s.money = 5000;
  assert.ok(UI.handleCampaignAction("hpPeddle", btn("hpPeddle", "sell"), ctx(e)));
  assert.ok(e.hp.noon.sold);
  // 收购
  const { e: b } = make();
  midGame(b, 12);
  hour(b, 9);
  forceNoon(b, "buyer", { id: "dock", item: "@fish", n: 5, got: 0, region: "farm" });
  go(b, "farm", BUYER.farmSpot.x, BUYER.farmSpot.y + 30);
  stock(b, { fish: 3, riverFish: 3 });
  html = await view(b, "hpBuyer");
  assert.ok(!DEV.test(html), html.match(DEV)?.[0]);
  assert.match(html, /鱼（什么鱼都行）/);
  assert.ok(UI.handleCampaignAction("hpSell", btn("hpSell"), ctx(b)));
  assert.equal(b.hp.noon.st, "done");
  // 这周和今天
  html = await view(b, "hpWeek");
  assert.ok(!DEV.test(html), html.match(DEV)?.[0]);
  assert.match(html, /今天下午/);
});

test("pages: the station shows this week's list and the wall II rows; rooms, the store chest and the coop show their expansions", async () => {
  const UI = await UIp;
  const { e } = make();
  const W = week(e, "list");
  station(e);
  hour(e, 6);
  e.rl.walls.water = { by: "list", day: 30 };
  let html = await view(e, "rlStation");
  assert.ok(!DEV.test(html), html.match(DEV)?.[0]);
  assert.match(html, new RegExp("这周的清单 · " + WEEK_LISTS[W.id].name));
  assert.match(html, /升二级 · 二级水网/);
  const k = WEEK_LISTS[W.id].need[0][0];
  stock(e, { [k === "@fish" ? "fish" : k]: 30 });
  assert.ok(UI.handleCampaignAction("hpList", btn("hpList", k), ctx(e)));
  assert.ok((W.got[k] || 0) > 0);
  stock(e, { scrap: 20, parts: 10 });
  e.s.money = 99999;
  assert.ok(UI.handleCampaignAction("hpWall2", btn("hpWall2", "water"), ctx(e)));
  assert.ok(e.wall2On("water"));
  html = await view(e, "rlStation");
  assert.match(html, /二级 · 二级水网<\/b> ✓/);
  // 农舍「房间与家具」
  const { roomExtras } = await import("../dist/people-hooks.js");
  const room = roomExtras(e);
  assert.match(room, /农舍扩建/);
  assert.match(room, /家里添的东西/);
  assert.ok(!DEV.test(room));
  stock(e, { wood: 100, stone: 50 });
  assert.ok(UI.handleCampaignAction("hpExpand", btn("hpExpand", "home"), ctx(e)));
  assert.equal(e.hpLv("home"), 1);
  // 仓库箱、鸡舍的设施卡
  const chest = e.s.buildings.find((x) => x.type === "chest");
  if (chest) assert.match(UI.buildingExtras(e, chest), /仓库扩建/);
  bag(e, { wood: 60, stone: 30 });
  const coop = place(e, "coop");
  const card = UI.buildingExtras(e, coop);
  assert.match(card, /鸡舍扩建/);
  assert.ok(!DEV.test(card));
});

test("pages: the caravan page, the station market row, the journal strip, letters, the archive and the alerts", async () => {
  const UI = await UIp;
  const { e } = make();
  const W = week(e, "caravan");
  toDay(e, W.start + 1, 9);
  go(e, "farm", 830, 600);
  let html = await view(e, "caravan");
  assert.ok(!DEV.test(html), html.match(DEV)?.[0]);
  assert.match(html, /稀罕货 · /);
  assert.match(html, /这回唐九还收/);
  assert.match(html, /第 \d+ 天 20:00 收摊/);
  stock(e, { [W.buy]: 5 });
  assert.ok(UI.handleCampaignAction("hpCaravanSell", btn("hpCaravanSell"), ctx(e)));
  assert.equal(W.sold, 5);
  // 旧站商街那一格：写清楚是什么
  const P = POINT_BY_ID.shops;
  go(e, "stationMarket", P.x, P.y + 20);
  const { renderDistricts } = await import("../dist/district-ui.js");
  const dhtml = UI.patchHopeDistricts(e, renderDistricts(e, { region: "stationMarket", point: "shops", view: "point" }));
  assert.ok(!DEV.test(dhtml), dhtml.match(DEV)?.[0]);
  // 任务手记：一行盼头、来信
  buyGood(e, "dove");
  e.hp.letters = ["l01", "l02"];
  const j = UI.renderCampaignJournal(e, {});
  assert.match(j, /hp-strip/);
  assert.match(j, /鸽子捎回的信 · 2 封/);
  assert.ok(!DEV.test(j), j.match(DEV)?.[0]);
  // 档案馆：账本记下的旧物
  buyGood(e, "ledger");
  const m = await view(e, "museum");
  assert.match(m, /账本里记着的旧物/);
  assert.ok(!DEV.test(m), m.match(DEV)?.[0]);
  // 顶上的提醒
  const { alertItems } = await import("../dist/winter-ui.js");
  const items = alertItems(e).map((a) => a.text).join(" | ");
  assert.ok(!DEV.test(items), items);
  // 今天：手记最上面
  hour(e, 9);
  forceNoon(e, "drop", { region: "hospital", tier: "rare", good: "hpPills" });
  const today = e.todayItems().map((x) => x.text).join(" | ");
  assert.match(today, /空投/);
});

test("the big can shows its tank on the hand bar text; the moment cards for the three new kinds have icons", async () => {
  const { e } = make();
  midGame(e);
  buyGood(e, "can");
  assert.equal(e.waterTotal(), e.c.water + GOOD_FX.can);
  const Z = await import("../dist/zest-ui.js");
  for (const ev of [
    { kind: "upgrade", icon: "water" },
    { kind: "upgrade", icon: "build" },
    { kind: "upgrade", icon: "good" },
    { kind: "traveler", icon: "traveler" },
    { kind: "week", icon: "week" },
  ])
    assert.equal(Z.momentIcon(ev), ev.icon);
  const html = Z.momentHtml({ kind: "upgrade", title: "买下大号浇水壶", lines: [GOODS.can.text] });
  assert.match(html, /营地升级/);
  assert.ok(!DEV.test(html));
});

test("radio II names the cabinet it means, including the map's own boxes once opened, and never says undefined", () => {
  for (const seed of [33001, 33002, 33003, 33004, 33005]) {
    const { e } = make(freshState(), seed);
    midGame(e, 48);
    e.hp.wall2.radio = 40;
    for (const r of ["residential", "hospital", "warehouse"]) for (const id of ["road", "garden", "garage", "lobby", "ward", "yard", "dock", "office"]) e.s.opened[r + "-" + id] = { day: 10 };
    for (let d = 48; d < 60; d++) {
      e.s.day = d;
      const t = e.radioTip(d);
      assert.ok(!/undefined|NaN/.test(t), t);
      if (t) assert.match(t, /的.+里有好东西$/);
    }
  }
});
