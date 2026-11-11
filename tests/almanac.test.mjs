// v0.29.0「四时」：四个时节（长势、天气、寒潮、秋收迁徙）、早间广播（手气签、明天的天气、当季菜）、雨天、上品、
// 腌缸和土酒坛、牲口亲近、老果园嫁接、旧物摆件、野物和蘑菇、夜里的好事、油灯下念账、界面和存档。
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Engine, freshState, newGameState, needsStoryMigration } from "./pre-trim.mjs";
import * as Bustle from "../dist/bustle.js";
// v0.30：最上面又接了一层（人情）；这里测的是四时这一层，“下面那一层”从四时的 Engine 往下找
import * as Almanac from "../dist/almanac.js";
import { ITEMS, BUILDINGS, CROPS, RECIPES } from "../dist/data.js";
import { TASKS } from "../dist/rebuild-data.js";
import { WEATHER } from "../dist/expansion-data.js";
import { FESTIVALS } from "../dist/seasons-data.js";
import { COMFORT, COMFORT_CATS } from "../dist/bustle-data.js";
import { PIECES } from "../dist/audio-data.js";
import {
  YEAR,
  SEASON_DAYS,
  SEASONS,
  seasonOf,
  seasonDay,
  yearOf,
  nextSeasonDay,
  coldStartFrom,
  CROP_SEASON,
  SEASON_RATE,
  SEASON_WEATHER,
  LUCK,
  LUCK_BY_ID,
  RAIN,
  PRIME,
  JARS,
  HERD,
  TREES,
  TREE_IDS,
  TREE_RULES,
  treeType,
  cuttingId,
  DECOR,
  decorItem,
  DECOR_RULES,
  FORAGE,
  FORAGE_SPOTS,
  FORAGE_RULES,
  MUSHROOM,
  NIGHT_GOOD,
  DISHES,
  AL_BUILD_TYPES,
} from "../dist/almanac-data.js";
import { MISSING_ICONS } from "../dist/item-sprites.js";
import { buildingArt, objectArt } from "../dist/pixel-props.js";

// 画图要一块画布：装了 @napi-rs/canvas 就用它（和 visual.test 一样），四时的画在 almanac-renderer.js 里登记
const require = createRequire(import.meta.url);
let canvasLib = null;
try {
  canvasLib = require("@napi-rs/canvas");
} catch {
  canvasLib = null;
}
const kit = await import("../dist/pixel-kit.js");
if (canvasLib) kit.setCanvasFactory((w, h) => canvasLib.createCanvas(w, h));
await import("../dist/almanac-renderer.js");

const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const make = (state = freshState(), seed = 20291) => {
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
const give = (e, items) => {
  for (const [id, n] of Object.entries(items)) e.s.storage[id] = (e.s.storage[id] || 0) + n;
};
const btn = (action, id = "") => ({ dataset: { action, id: String(id) } });
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const view = (e, v, id = "") => UI.renderCampaignView(e, { view: v, id });
const go = (e, region, x = 768, y = 512) => {
  e.s.visited = { ...(e.s.visited || {}), [region]: true };
  e.s.region = region;
  e.enemies = e.s.enemies[region] ||= [];
  e.assignRegion();
  Object.assign(e.s.player, { x, y });
};
const atFarm = (e, x = 830, y = 460) => go(e, "farm", x, y);
const clearFoes = (e) => {
  for (const z of e.enemies) z.dead = true;
  e.enemies = e.s.enemies[e.s.region] = [];
};
// 找一块能建的空地，站过去再放
function place(e, type) {
  for (let y = 352; y < 930; y += 40)
    for (let x = 192; x < 1420; x += 40) {
      Object.assign(e.s.player, { x: x + 60, y });
      if (!e.buildReason(type, x, y)) {
        assert.ok(e.placeBuilding(x, y), "placing " + type);
        e.buildMode = null;
        return e.s.buildings.at(-1);
      }
    }
  assert.fail("no room for " + type);
}
// 按条件找一天
const dayWhere = (ok, from = 1, span = 400) => {
  for (let d = from; d < from + span; d++) if (ok(d)) return d;
  throw new Error("no such day");
};
const v28 = (setup = () => {}) => {
  const old = new Bustle.Engine(Bustle.newGameState("farmer"), () => {});
  setup(old);
  return old.serialize();
};

// ================= 数据 =================
test("data: a 28-day year in four 7-day seasons, each ending on its festival; the cold season holds the cold snap; every crop has a good and a bad season", () => {
  assert.equal(YEAR, 28);
  assert.equal(SEASON_DAYS, 7);
  assert.deepEqual(
    SEASONS.map((s) => s.id),
    ["thaw", "heat", "harvest", "cold"],
  );
  // 第 7、14、21、28 天的节庆正好是各个时节收尾的那个
  const e = make().e;
  for (const [i, s] of SEASONS.entries()) {
    const last = (i + 1) * SEASON_DAYS;
    assert.ok(FESTIVALS[s.fest], s.id);
    assert.equal(e.festivalKind(last), s.fest, "day " + last);
    assert.equal(seasonOf(last).id, s.id);
    assert.equal(seasonOf(last + YEAR).id, s.id, "the next year too");
  }
  assert.equal(seasonDay(22), 1);
  assert.equal(seasonOf(22).id, "cold");
  assert.equal(yearOf(28), 1);
  assert.equal(yearOf(29), 2);
  assert.equal(nextSeasonDay(9), 15);
  // 寒潮对齐到寒潮时节第一天
  for (const d of [1, 21, 22, 23, 50, 68, 100]) {
    const c = coldStartFrom(d);
    assert.ok(c >= d && c < d + YEAR, "d " + d);
    assert.equal(seasonOf(c).id, "cold");
    assert.equal(seasonDay(c), 1);
  }
  for (const [crop, [good, bad]] of Object.entries(CROP_SEASON)) {
    assert.ok(CROPS[crop], crop);
    assert.notEqual(good, bad, crop);
    assert.ok(SEASONS.some((s) => s.id === good) && SEASONS.some((s) => s.id === bad), crop);
  }
  for (const id of Object.keys(CROPS)) if (id !== "hybrid" && !CROPS[id].hybrid) assert.ok(CROP_SEASON[id], "season for " + id);
  assert.deepEqual(SEASON_RATE, { good: 1.15, bad: 0.85 });
});

test("data: the weather follows the seasons — 28 days a year with the same mix every year, more rain when it thaws, heat waves in summer; new games still open 晴、晴、小雨; never three storms in a row", () => {
  assert.equal(WEATHER.length, YEAR * 4);
  assert.deepEqual(WEATHER.slice(0, 3), ["晴朗", "晴朗", "小雨"]);
  for (let y = 0; y < 4; y++)
    for (const [i, s] of SEASONS.entries()) {
      const week = WEATHER.slice(y * YEAR + i * SEASON_DAYS, y * YEAR + (i + 1) * SEASON_DAYS);
      const count = {};
      for (const w of week) count[w] = (count[w] || 0) + 1;
      assert.deepEqual(count, Object.fromEntries(Object.entries(SEASON_WEATHER[s.id]).sort()) && count, "year " + (y + 1) + " " + s.id);
      for (const [w, n] of Object.entries(SEASON_WEATHER[s.id])) assert.equal(count[w], n, "year " + (y + 1) + " " + s.id + " " + w);
    }
  const bad = (w) => w === "暴雨" || w === "酸雨";
  for (let i = 0; i + 2 < WEATHER.length; i++) assert.ok(!(bad(WEATHER[i]) && bad(WEATHER[i + 1]) && bad(WEATHER[i + 2])), "three bad days from " + (i + 1));
  // 回暖雨多、酷暑才有高温
  const rainy = (id) => ["小雨", "暴雨"].reduce((a, w) => a + (SEASON_WEATHER[id][w] || 0), 0);
  assert.ok(rainy("thaw") > rainy("harvest") && rainy("thaw") > rainy("cold"));
  assert.equal(SEASON_WEATHER.heat.高温, 3);
  assert.ok(!SEASON_WEATHER.cold.高温 && !SEASON_WEATHER.harvest.高温);
  // 天气就是按表来的：今天的、预报的
  const { e } = make();
  for (const d of [1, 9, 30, 77]) {
    e.s.day = d;
    assert.deepEqual(
      e.forecast().map((x) => x.weather),
      [0, 1, 2].map((k) => WEATHER[(d - 1 + k) % WEATHER.length]),
    );
  }
  e.s.day = 9;
  nextDay(e);
  assert.equal(e.s.weather, WEATHER[9]);
});


// ================= 存档 =================
test("save: new games stay quiet; a v0.28 save is kept as-is, the cold snap moves onto the cold season, the notice plays once; a broken record is refused in plain words", () => {
  const { e: fresh, toasts: t0 } = make(newGameState("farmer"));
  fresh.update(0.016, {});
  assert.ok(!said(t0, /四时：/), "no notice for a new game");
  assert.ok(!fresh.al.intro);
  const text = v28((o) => {
    o.s.day = 40;
    o.bt.cold.next = 60;
    o.s.inventory.radish = 3;
  });
  assert.equal(needsStoryMigration(text), true, "a v0.28 save gets a checkpoint before it is read");
  const s = Engine.parse(text);
  assert.equal(s.day, 40);
  assert.equal(s.inventory.radish, 3);
  assert.ok(s.almanac && s.almanac.intro);
  const { e, toasts } = make(s);
  assert.equal(e.bt.cold.next, coldStartFrom(60), "the old cold snap waits for the cold season");
  assert.equal(seasonOf(e.bt.cold.next).id, "cold");
  e.update(0.016, {});
  e.update(0.016, {});
  assert.equal(toasts.filter((t) => /四时：/.test(t.text)).length, 1, "the notice plays once");
  // 存了再读，原样
  const again = Engine.parse(e.serialize());
  assert.deepEqual(again.almanac, JSON.parse(e.serialize()).almanac);
  assert.equal(needsStoryMigration(e.serialize()), false);
  // 坏了的记录：说人话，不读
  const broken = JSON.parse(e.serialize());
  broken.almanac.jars = { x: { item: "nope", n: 4, start: 1 } };
  assert.throws(() => Engine.parse(JSON.stringify(broken)), /存档里的四时记录损坏（缸），请从设置恢复有效备份/);
  const b2 = JSON.parse(e.serialize());
  b2.almanac.herd.flock.pts = 500;
  assert.throws(() => Engine.parse(JSON.stringify(b2)), /四时记录损坏（牲口）/);
  const b3 = JSON.parse(e.serialize());
  b3.buildings.push({ id: "bx", type: "alDecor", x: 500, y: 500, rotation: 0, hp: 60, decor: "nope" });
  assert.throws(() => Engine.parse(JSON.stringify(b3)), /四时记录损坏（摆件）/);
});

// ================= 四个时节 =================


test("seasons: cold snaps after the story land on the first day of the cold season; in the harvest season half the hazards are migrations", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  const wi = e.w.winter;
  Object.assign(wi, { phase: "done", coldDay: 40, endDay: 43, prepDay: 37 });
  e.s.day = 44;
  e.bt.cold.next = 0;
  nextDay(e);
  const c = e.bt.cold.next;
  assert.ok(c > e.s.day);
  assert.equal(seasonOf(c).id, "cold");
  assert.equal(seasonDay(c), 1);
  e.s.day = c - 2;
  nextDay(e);
  assert.equal(wi.phase, "prep");
  assert.equal(wi.coldDay, c);
  assert.equal(e.bt.cold.next, c + YEAR);
  assert.ok(said(toasts, /寒潮又到/));
  // 秋收时节：迁徙多
  e.s.visited = { residential: true, hospital: true, warehouse: true };
  let mig = 0,
    n = 0,
    other = 0,
    m2 = 0;
  for (let d = 15; d < 400; d++) {
    const h = e.hazardFor(d);
    if (!h) continue;
    if (seasonOf(d).id === "harvest") {
      n++;
      if (h.kind === "migration") mig++;
    } else {
      other++;
      if (h.kind === "migration") m2++;
    }
  }
  assert.ok(n > 20 && mig / n > 0.45, "harvest: " + mig + "/" + n);
  assert.ok(mig / n > m2 / other + 0.15, "more than the other seasons (" + m2 + "/" + other + ")");
});

// ================= 早间广播 =================

test("luck: draws follow 15/35/35/15 over many days; a great day finds more in cabinets, a bad day pries 20% slower and the caravan slips in more fakes", () => {
  const { e } = make();
  const count = { great: 0, good: 0, plain: 0, bad: 0 };
  for (let d = 1; d <= 2000; d++) count[e.luckOf(d).id]++;
  for (const l of LUCK) assert.ok(Math.abs(count[l.id] / 2000 - l.p) < 0.035, l.id + " " + count[l.id]);
  // 同一个柜子：大吉那天平均翻得多
  toAct(e, 7);
  go(e, "residential");
  const box = { id: "lucky-box", ukind: "kitchen", x: 500, y: 500 };
  const total = (luck) => {
    const keep = e.luckOf;
    e.luckOf = () => LUCK_BY_ID[luck];
    let n = 0;
    try {
      for (let d = 1; d <= 400; d++) n += Object.values(e.rollContainer(box, d).bundle).reduce((a, b) => a + b, 0);
    } finally {
      e.luckOf = keep;
    }
    return n;
  };
  const great = total("great"),
    plain = total("plain"),
    bad = total("bad");
  assert.ok(great > plain * 1.05, "great " + great + " plain " + plain);
  assert.ok(bad >= plain * 0.98 && bad <= plain * 1.02, "a bad day takes nothing away from cabinets: bad " + bad + " plain " + plain);
  // 商队：凶的那天假货多
  const fakes = (luck) => {
    let n = 0;
    for (let k = 0; k < 120; k++) {
      const { e: q } = make(freshState(), 9000 + k);
      toAct(q, 5);
      q.o.caravan.next = q.s.day;
      q.o.caravan.exposed = 0;
      q.luckToday = () => LUCK_BY_ID[luck];
      q.roll = () => 0.99; // 平常的那两成五假货先拿掉，只看手气多混进来的
      q.arriveCaravan();
      n += q.o.caravan.offers.filter((o) => o.fake).length;
    }
    return n;
  };
  assert.equal(fakes("plain"), 0);
  assert.ok(fakes("bad") > 0, "a bad day slips in fakes");
});

test("luck: a bad day really makes prying slower, a rainy day makes it quieter, and both are said", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  go(e, "residential");
  clearFoes(e);
  // 一个锁着的铁柜、一根撬棍
  const o = { type: "crate", id: "t-locked", x: 900, y: 640, loot: {}, name: "锁着的铁柜", icon: 40, elite: false, ukind: "locked", odds: "locked" };
  e.objects.push(o);
  e.s.inventory.crowbar = 1;
  const tryPry = (luck, weather) => {
    e.ux.pry = null;
    e.luckToday = () => LUCK_BY_ID[luck];
    e.s.weather = weather;
    Object.assign(e.s.player, { x: o.x + 10, y: o.y + 30 });
    o.opened = false;
    o.pried = false;
    const ok = e.startPry(o);
    const P = ok ? { ...e.ux.pry } : null;
    e.ux.pry = null;
    return P;
  };
  const plain = tryPry("plain", "晴朗");
  assert.ok(plain, "prying starts");
  const bad = tryPry("bad", "晴朗");
  assert.ok(Math.abs(bad.max - plain.max * 1.2) < 0.11, bad.max + " vs " + plain.max);
  assert.ok(said(toasts, /下签，手生/));
  const wet = tryPry("plain", "小雨");
  if (!plain.silent) {
    assert.equal(wet.noise, Math.round(plain.noise * RAIN.pry));
    assert.ok(said(toasts, /下着雨，撬的声音只传一半远/));
  }
});

// ================= 雨天 =================
test("rain: in the ruins infected hear 20% less far; after a rainy day the camp's noise is drowned out 35% of the time; residents craft 10% faster; the pond gives loaches", () => {
  const { e } = make();
  toAct(e, 7);
  go(e, "residential");
  e.s.weather = "小雨";
  assert.ok(e.rainingOut());
  // 听觉：把基类的 enemySenses 换成记下当时的声音半径
  const below = Object.getPrototypeOf(Almanac.Engine.prototype);
  const orig = below.enemySenses;
  let seen = null;
  below.enemySenses = function () {
    seen = this.noise.map((n) => n.r);
  };
  try {
    e.noise = [{ x: 1, y: 1, r: 300, t: 1 }];
    e.enemySenses({}, 0.016);
    assert.deepEqual(seen, [300 * RAIN.hear]);
    assert.equal(e.noise[0].r, 300, "the real sound is left alone");
    e.s.weather = "晴朗";
    e.enemySenses({}, 0.016);
    assert.deepEqual(seen, [300]);
  } finally {
    below.enemySenses = orig;
  }
  // 动静：下了一天雨，到了线也有三成半的晚上被雨声盖住（不来，动静照平常减半）
  atFarm(e);
  clearFoes(e);
  e._btSleep = true;
  const masked = dayWhere((d) => e.alRoll("rainmask", d) < RAIN.mask, 20),
    heard = dayWhere((d) => e.alRoll("rainmask", d) >= RAIN.mask, 20);
  const night = (day, weather) => {
    clearFoes(e);
    e.s.day = day - 1;
    e.s.weather = weather;
    e.hn.noise.v = 5;
    e.hn.attack.state = "";
    const a0 = e.hn.stats.attacks || 0;
    nextDay(e);
    return (e.hn.stats.attacks || 0) - a0;
  };
  assert.equal(night(masked, "小雨"), 0, "drowned out by the rain");
  assert.equal(e.hn.noise.v, 2.5, "halved like a quiet night");
  assert.equal(e.al.stats.rainNights, 1);
  assert.equal(e._alRainCut, masked);
  assert.equal(night(masked, "晴朗"), 1, "a dry day: they come");
  assert.equal(night(heard, "小雨"), 1, "not every rainy night");
  let n = 0;
  for (let d = 1; d <= 1000; d++) if (e.alRoll("rainmask", d) < RAIN.mask) n++;
  assert.ok(Math.abs(n / 1000 - RAIN.mask) < 0.04, "mask rate " + n);
  e._btSleep = false;
  // 手工：雨天快一成
  let got = 0;
  const base = Object.getPrototypeOf(Almanac.Engine.prototype).processProduction;
  Object.getPrototypeOf(Almanac.Engine.prototype).processProduction = function (n) {
    got = n;
  };
  try {
    e.s.weather = "暴雨";
    e.processProduction(10);
    assert.ok(Math.abs(got - 11) < 1e-9);
    e.s.weather = "晴朗";
    e.processProduction(10);
    assert.equal(got, 10);
  } finally {
    Object.getPrototypeOf(Almanac.Engine.prototype).processProduction = base;
  }
  // 雨鳅：雨天池塘里约三成五
  const fishBase = Object.getPrototypeOf(Almanac.Engine.prototype).hookFish;
  Object.getPrototypeOf(Almanac.Engine.prototype).hookFish = function () {
    this.s.inventory.fish = (this.s.inventory.fish || 0) + 1;
    this.c.metrics.fish = (this.c.metrics.fish || 0) + 1;
    return true;
  };
  try {
    e.s.weather = "小雨";
    e.luckToday = () => LUCK_BY_ID.plain;
    for (let i = 0; i < 200; i++) e.hookFish();
    const loach = e.s.inventory.alLoach || 0;
    assert.ok(loach > 45 && loach < 95, "loaches " + loach);
    e.s.weather = "晴朗";
    const before = e.s.inventory.alLoach;
    for (let i = 0; i < 50; i++) e.hookFish();
    assert.equal(e.s.inventory.alLoach, before, "no loaches when it is dry");
  } finally {
    Object.getPrototypeOf(Almanac.Engine.prototype).hookFish = fishBase;
  }
});

// ================= 上品 =================
test("prime: in season with care 70+, a fine harvest's fine portion is prime 25% of the time (45% with care fertiliser), worth 2.2×; in-season harvests give one more portion; prime counts for costs and the harvest festival", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  e.s.day = 16; // 秋收：萝卜当季
  let prime = 0,
    tries = 0;
  for (const p of e.s.plots.slice(0, 12)) {
    p.tilled = true;
    p.crop = "radish";
    p.growth = CROPS.radish.grow;
    p.trait = null;
    // 天天照看（65）+ 换了茬（10）= 75：优质必出（80 以上）要再加一点，这里给提质肥
    e.g.plots[p.id] = { c: 100, pd: 1, t: e.s.day, wd: e.s.day, w: 0, b: 0, cv: 0, rot: 1, pk: 0 };
    e.btPlot(p).fz = "care";
    assert.ok(e.careScore(p) >= PRIME.care, "score " + e.careScore(p));
    assert.equal(e.primeChance(p), PRIME.fert);
    Object.assign(e.s.player, { x: p.x, y: p.y + 6 });
    const before = stock(e, "prime_radish"),
      all0 = stock(e, "radish") + stock(e, "fine_radish") + stock(e, "prime_radish");
    assert.ok(e.harvest(p));
    tries++;
    if (stock(e, "prime_radish") > before) prime++;
    // 当季：多收 1 份（上品是从优质那一份换的，总数不变）
    assert.ok(stock(e, "radish") + stock(e, "fine_radish") + stock(e, "prime_radish") - all0 >= CROPS.radish.yield + 1);
  }
  assert.ok(prime > 0 && prime < tries, "prime " + prime + "/" + tries);
  assert.ok(e.al.stats.prime > 0 && e.al.stats.seasonExtra >= tries);
  // 没施肥：25%；照料分不够、不当季：没有
  const p = e.s.plots[13];
  p.crop = "radish";
  p.growth = 1;
  e.g.plots[p.id] = { c: 100, pd: 1, t: e.s.day, wd: e.s.day, w: 0, b: 0, cv: 0, rot: 1, pk: 0 };
  assert.equal(e.primeChance(p), PRIME.chance, "no fertiliser");
  e.g.plots[p.id].c = 30;
  assert.ok(e.careScore(p) < PRIME.care);
  assert.equal(e.primeChance(p), 0, "care too low");
  e.g.plots[p.id].c = 100;
  e.btPlot(p).fz = "care";
  e.s.day = 10;
  assert.equal(e.primeChance(p), 0, "out of season");
  // 反季：不多收
  e.s.day = 10;
  p.growth = CROPS.radish.grow;
  const n0 = stock(e, "radish") + stock(e, "fine_radish") + stock(e, "prime_radish");
  Object.assign(e.s.player, { x: p.x, y: p.y + 6 });
  assert.ok(e.harvest(p));
  assert.ok(stock(e, "radish") + stock(e, "fine_radish") + stock(e, "prime_radish") - n0 <= CROPS.radish.yield + 1, "no extra portion out of season");
  // 卖价、顶用、评比
  assert.equal(ITEMS.prime_radish.sell, Math.round(ITEMS.radish.sell * 2.2));
  for (const k of Object.keys(e.s.inventory)) if (/radish/.test(k)) delete e.s.inventory[k];
  for (const k of Object.keys(e.s.storage)) if (/radish/.test(k)) delete e.s.storage[k];
  give(e, { prime_radish: 3 });
  assert.equal(e.quantityForCost("radish", true), 3);
  assert.deepEqual(e.costPlan({ radish: 2 }, true), { prime_radish: 2 });
  assert.ok(e.festPickable("harvest").includes("prime_radish"));
});

// ================= 腌缸和土酒坛 =================

// ================= 牲口亲近 =================

// ================= 老果园嫁接 =================

// ================= 旧物摆件 =================

// ================= 野物和蘑菇 =================

// ================= 夜里的好事 =================

// ================= 油灯下念账 =================
test("ledger: waking up shows a three-line ledger (shipping, the night, today) instead of a page; a short-on-food morning still shows the summary page; it goes into the log", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  give(e, { bread: 80 });
  e.s.minute = 22 * 60;
  e.events.length = 0;
  assert.equal(e.sleep(), true);
  const led = e.events.find((v) => v.type === "ledger");
  assert.ok(led, "ledger event");
  assert.equal(led.lines.length, 3);
  assert.match(led.lines[0], /^出货箱/);
  assert.match(led.lines[1], /^夜里：/);
  assert.match(led.lines[2], new RegExp("^今天：" + seasonOf(e.s.day).name + "第 " + seasonDay(e.s.day) + " 天"));
  assert.equal(led.day, e.s.day);
  assert.ok(led.ms >= 3000);
  assert.ok(!e.events.some((v) => v.type === "menu" && v.view === "summary"));
  assert.ok(e.o.log.some((l) => /的账：出货箱/.test(l.text)));
  for (const t of led.lines) assert.doesNotMatch(t, DEV);
  // 缺粮：照旧弹日终总结，不出账本
  const { e: h } = make();
  toAct(h, 7);
  atFarm(h);
  for (const id of Object.keys(h.s.storage)) if (ITEMS[id]?.food) delete h.s.storage[id];
  for (const id of Object.keys(h.s.inventory)) if (ITEMS[id]?.food) delete h.s.inventory[id];
  h.s.minute = 22 * 60;
  h.events.length = 0;
  h.sleep();
  assert.ok(h.events.some((v) => v.type === "menu" && v.view === "summary"));
  assert.ok(!h.events.some((v) => v.type === "ledger"));
});

// ================= 其他 =================
test("music: the farm's daytime piece changes with the season; the farm day piece stays for the thaw", () => {
  const { e } = make();
  e.s.day = 3;
  assert.equal(e.seasonPiece("farmDay"), "farmDay");
  e.s.day = 10;
  assert.equal(e.seasonPiece("farmDay"), "farmDay_heat");
  e.s.day = 17;
  assert.equal(e.seasonPiece("farmDay"), "farmDay_harvest");
  e.s.day = 24;
  assert.equal(e.seasonPiece("farmDay"), "farmDay_cold");
  for (const id of ["farmDay_heat", "farmDay_harvest", "farmDay_cold"]) assert.ok(PIECES[id]);
});

