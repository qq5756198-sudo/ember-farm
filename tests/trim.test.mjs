// v0.42.0「删繁」：一物一用方案第二版。设施 36 样变 26 样（拆掉的退料、并掉的折算）；种地只留种、浇、收和一种肥；
// 营地一个士气；动静、电台节目和指令、机床加急、改良、手气签、夜里的抉择、鸽子、纸条、假货、垫付、鼎丰、偷东西去掉；
// 天赋按顺序自己学；地区仓库并进农场仓库；喜好明着写；麦穗只要摸。旧档读进来只转换一次，升级前那一份留着。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// 先用 v0.41 的引擎（下面那一层）做一份旧档：这时删繁那一层的数和字还没改
import { Engine as OldEngine } from "../dist/clear.js";
import { newGameState as oldNewGame } from "../dist/simple.js";
import { Engine, freshState, newGameState, needsUpgrade as needsStoryMigration } from "../dist/ahead.js";
import { Engine as TrimEngine } from "../dist/trim.js";
import { ITEMS, BUILDINGS, CROPS } from "../dist/data.js";
import { BUILD_GROUPS, HUD_CARD, MENUS } from "../dist/simple-data.js";
import { FERTS } from "../dist/bounty-data.js";
import { TALENTS } from "../dist/thief-data.js";
import { MUSHROOM } from "../dist/almanac-data.js";
import { prefsOf } from "../dist/kin-data.js";
import { GOODS, MARKET_ORDER, START, goodItem } from "../dist/hope-data.js";
import { GAME_VERSION, GAME_EDITION, GAME_RELEASE } from "../dist/version.js";
import {
  REFUND_TYPES,
  WINE_JAR,
  PICKLE_JAR,
  DECOR_LOOKS,
  DECOR_TILE,
  FINE,
  SOIL_FLAT,
  FERT,
  SPRINKLE,
  CANAL_R,
  MORALE,
  MORALE_FACTORS,
  TALENT_ORDER,
  CONVERT_TITLE,
  REST,
  ECO_ORDER,
  buildCount,
  jarRecipe,
} from "../dist/trim-data.js";
import { Renderer as TrimRenderer } from "../dist/trim-renderer.js";
import { Renderer as ClearRenderer } from "../dist/clear-renderer.js";
import { Renderer as CampaignRenderer } from "../dist/campaign-renderer.js";

const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|Joja|祝尼魔|星之果实|\[object Object\]/;

// ================= 一份 v0.41 的旧档 =================
// 第 42 天：雨水桶（改良过）、太阳能板、照看机、药柜、正在酿的土酒坛、一把椅子一盏灯；提质肥保水肥、特性种子；
// 三个人心情 40/80/66、一个伤员、一条法令、出货箱挂着牌、欠贺满仓的垫付、鸽舍、妙手经验和一个妙手天赋、两处地区仓库、路上存的物资
function buildOld() {
  const old = new OldEngine(oldNewGame("farmer"), () => {});
  const s = old.s;
  s.day = 42;
  for (const id of ["farmer", "medic", "mechanic"]) old.recruit(id);
  s.colony.residents.forEach((r, i) => (r.morale = [40, 80, 66][i]));
  const put = (type, x, y, extra = {}) => {
    const b = { id: "old-" + type + "-" + s.idCounter++, type, x, y, rotation: 0, hp: BUILDINGS[type].hp, ...extra };
    s.buildings.push(b);
    return b;
  };
  put("rain", 600, 640, { hnUp: "big" });
  put("solar", 660, 640);
  put("drone", 720, 640);
  put("medCabinet", 500, 235);
  const jar = put("alWineJar", 760, 520);
  old.al.jars[jar.id] = { item: "corn", n: 4, start: 40 };
  put("chair", 420, 300);
  put("lamp", 450, 300);
  s.inventory.fertCare = 2;
  s.storage.fertWater = 3;
  s.inventory.seed_radish_early = 4;
  const farm = s.plots.filter((p) => p.region !== "valley");
  Object.assign(farm[0], { tilled: true, crop: "radish", growth: 10, trait: "early", fertility: 30 });
  old.injure("r:farmer", "老周");
  s.winter.decrees = ["curfew"];
  s.tidy.listing = [{ id: "list-1", item: "potato", qty: 4 }];
  s.far.hemc = { phase: "open", debt: { type: "coop", total: { wood: 10 }, paid: { wood: 4 }, day: 30 }, advances: 1 };
  s.hope.goods.dove = 30;
  s.skills.thiefXp = 120;
  s.skills.talents = ["pickpocket"];
  s.districts.stores.valley = { wood: 5 };
  s.beyond.stores.pinewood = { resin: 3 };
  s.echoes.caches = [{ id: "c1", region: "warehouse", x: 300, y: 300, items: { scrap: 7 } }];
  s.bustle.noise.v = 3;
  s.frontier.canals.open = false;
  // 唐九的商队这会儿在农场，车上一样是假货（假货去掉了：读进来就是真货，存档照样认）
  s.outpost.caravan.offers = [{ key: 0, item: "medkit", tech: null, qty: 2, price: 58, fake: "bandage", inspected: null, sold: false }];
  s.outpost.caravan.until = s.day * 1440 + 20 * 60;
  // 今天早上播过的广播（任务手记、通信站照它写）：念了签，说了旧站商街的稀罕货
  s.zest.radio = { day: s.day, text: "电台早间播报。老琴抽了支吉签：今天柜子里多翻一样的机会大一点；旧站商街这周的稀罕货是大号浇水壶；明天小雨。" };
  return { text: old.serialize(), jar: jar.id, plot: farm[0].id };
}
const OLD = buildOld();
const OLD_GROUPS = 39;

const make = (state = newGameState("farmer")) => {
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  if (e.dy) e.dy.pending = null;
  return { e, toasts };
};
const said = (toasts, re) => toasts.some((t) => re.test(t.text));
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
const put = (e, type, x, y, extra = {}) => {
  const b = { id: "t-" + type + "-" + e.s.idCounter++, type, x, y, rotation: 0, hp: BUILDINGS[type].hp, ...extra };
  e.s.buildings.push(b);
  e.navRevision = (e.navRevision || 0) + 1;
  return b;
};
// 直接种上一块田（不走手）
const sow = (e, p, crop = "radish", frac = 0) => {
  e.s.debris = e.s.debris.filter((d) => Math.hypot(d.x - p.x, d.y - p.y) >= 15);
  Object.assign(p, { tilled: true, crop, growth: Math.round(CROPS[crop].grow * frac), trait: null, wateredDay: 0, waterUnits: 0 });
  if (e.g) e.g.plots[p.id] = { c: 50, pd: e.s.day, t: 0, wd: 0, w: 0, b: 0, cv: 0, rot: 0, pk: 0 };
  delete e.tr.dry[p.id];
  return p;
};
const bare = (e) => {
  for (const p of e.s.plots) Object.assign(p, { crop: null, growth: 0, wateredDay: 0 });
  e.s.buildings = e.s.buildings.filter((b) => !["rain", "irrigation", "drone", "greenhouse"].includes(b.type));
  if (e.sc?.flags) e.sc.flags.well = false;
};
const mem = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });

// ================= 版本 =================

// ================= 旧档：转换一次，退料对得上，升级前那一份留着 =================


// ================= 设施：26 样 =================

// ================= 种地 =================
test("farming: sprinklers water the plots around them every day, canal-side plots water themselves, others need you", () => {
  const { e, toasts } = make();
  bare(e);
  const farm = e.farmPlots();
  const a = sow(e, farm[0]),
    far = sow(e, farm.reduce((m, p) => (Math.hypot(p.x - farm[0].x, p.y - farm[0].y) > Math.hypot(m.x - farm[0].x, m.y - farm[0].y) ? p : m), farm[0]));
  put(e, "irrigation", a.x + 20, a.y + 20);
  assert.ok(Math.hypot(far.x - a.x, far.y - a.y) > SPRINKLE.r + 30);
  e.s.minute = 10 * 60;
  e.netDistribute(["sprinkler"]);
  assert.ok(e.plotWatered(a), "the sprinkler watered its plot");
  assert.ok(!e.plotWatered(far), "not one out of its reach");
  assert.equal(e.toggleSprinkler(), false, "always on");
  assert.match(e.automationStatus(e.s.buildings.find((b) => b.type === "irrigation")), /开着 · 每天浇 300 以内的田/);
  // 水渠：从源头挖到田边，闸门一直开着
  e.f.canals.dug = [0, 4, 5, 6, 7, 11, 15];
  assert.equal(e.canalReady(), true);
  assert.equal(e.waterControl("gate"), false);
  assert.ok(said(toasts, /闸门一直开着/));
  const side = e.farmPlots().find((p) => Math.hypot(p.x - 770, p.y - 695) < CANAL_R && !e.plotWatered(p));
  if (side) {
    sow(e, side);
    assert.equal(e.trCanal() >= 1, true);
    assert.ok(e.plotWatered(side), "canal-side plot has water");
  }
  // 浇水台：一块该浇的田，按 E 先浇水
  const b = sow(e, farm[5]);
  assert.equal(typeof e.zAutoAct(b), "function");
  assert.match(e.plotContext(b) || "", /浇|查看/);
  assert.doesNotMatch(e.plotContext(b) || "", /照料分/);
});


test("one fertiliser: the three kinds are one (this crop grows half again as fast), the compost bin makes only that", () => {
  const { e } = make();
  bare(e);
  assert.equal(FERTS.grow.name, "肥料");
  assert.equal(FERTS.grow.grow, 1.5);
  assert.equal(ITEMS.fertGrow.name, "肥料");
  const p = sow(e, e.farmPlots()[2]);
  e.s.storage[FERT.id] = 2;
  assert.equal(e.fertReason(p, "care"), e.fertReason(p, "grow"));
  assert.ok(e.applyFert(p, "water"));
  assert.equal(e.bt.plots[p.id].fz, "grow", "whatever kind is asked for, it's the one fertiliser");
  const bin = put(e, "compost", 900, 500);
  assert.equal(e.compostRec(bin.id).kind, "grow");
  assert.equal(e.compostKind(bin.id), true);
  assert.equal(e.compostRec(bin.id).kind, "grow");
  // 特性种子：到了手上一颗换两颗
  e.s.inventory.seed_potato_hardy = 3;
  e.s.storage.fertCare = 1;
  e.trTraitSweep();
  assert.equal(e.s.inventory.seed_potato_hardy, undefined);
  assert.equal(e.s.inventory.seedPotato >= 6, true);
  assert.equal(e.s.storage.fertCare, undefined);
  assert.equal(e.breedTrait(), false);
});

test("the coop feeds itself, lays into storage, and nobody needs to pet the animals", () => {
  const { e } = make();
  const coop = put(e, "coop", 860, 360);
  if (!e.c.animals) e.c.animals = {};
  Object.assign(e.c.animals, { chicken: 2, ready: { egg: 2 } });
  e.s.storage.corn = 5;
  const eggs = e.s.storage.egg || 0;
  e.s.minute = 6 * 60 + 5;
  e.trCoop();
  assert.equal(e.c.animals.feedDay, e.s.day, "fed at 06:00 from storage");
  assert.equal(e.s.storage.corn, 4);
  assert.equal(e.s.storage.egg, eggs + 2, "the eggs go into storage");
  assert.equal(e.feedAnimals(), false);
  assert.equal(e.herdPet(), false);
  assert.equal(e.releaseChickens(), false);
  assert.ok(coop);
});

// ================= 一个士气 =================

test("a night injury is a morale drop, not two days in bed; the clinic makes it smaller; a lost long night weighs two days", () => {
  const { e, toasts } = make();
  for (const id of ["farmer", "medic"]) e.recruit(id);
  e.s.minute = 23 * 60;
  assert.equal(e.injure("r:farmer", "老周", "守夜"), false, "nobody is laid up");
  assert.equal(e.isHurt("r:farmer"), false);
  assert.equal(e.laidUp("r:farmer"), false);
  assert.deepEqual(e.hn.hurt, {});
  assert.equal(e.tr.hurt.n, 1);
  assert.ok(said(toasts, /老周被抓伤了（守夜）：包扎一下接着守，全营士气 -3/));
  assert.equal(e.injure("r:farmer", "老周"), false);
  assert.equal(e.tr.hurt.n, 1, "the same person once a night");
  e.injure("r:medic", "许医生");
  assert.equal(e.tr.hurt.n, 2);
  const hurt = e.moodFactors().find((x) => x.key === "hurt");
  assert.equal(hurt.v, -6);
  assert.equal(e.trHurtPer(), MORALE_FACTORS.hurt.v);
  e.wallOn = (k) => k === "clinic";
  assert.equal(e.trHurtPer(), MORALE_FACTORS.hurt.v + 1);
  e.wall2On = (k) => k === "clinic";
  assert.equal(e.trHurtPer(), MORALE_FACTORS.hurt.v + 2);
  assert.equal(e.treat(), false);
  assert.match(e.treatReason(), /去掉了/);
  e.tr.lost = e.s.day;
  assert.ok(e.moodFactors().some((x) => x.key === "lost" && x.v === MORALE_FACTORS.lost.v));
});

// ================= 天赋 =================

// ================= 去掉的系统 =================




test("mushrooms are known as they are picked: the edible ones stay, the poisonous ones are thrown away", () => {
  const { e } = make();
  const words = [],
    toast0 = e.toast.bind(e);
  e.toast = (t, tone) => (words.push(t), toast0(t, tone));
  e.s.inventory[MUSHROOM.raw] = 5;
  e.s.storage[MUSHROOM.raw] = 3;
  const r = e.trSortMushrooms(true);
  assert.equal(r.n, 8);
  assert.equal(e.s.inventory[MUSHROOM.raw], undefined);
  assert.equal(e.s.storage[MUSHROOM.raw], undefined);
  assert.equal((e.s.inventory[MUSHROOM.good] || 0) + (e.s.storage[MUSHROOM.good] || 0), 8 - r.bad);
  // 只在头顶飘一下（“捡到 …。”那一类），不进提示栏
  assert.ok(words.includes("捡到 蘑菇 ×8：" + r.bad + " 朵有毒，扔了。"), words.join("|"));
  assert.match(e.mushroomReason(), /捡到就认得了/);
});

test("the pickle jar also brews: corn goes in as a brew, radish as pickles", () => {
  const { e } = make();
  assert.equal(jarRecipe("corn").verb, "酿");
  assert.equal(jarRecipe("radish").verb, "腌");
  assert.equal(jarRecipe("corn").name, "腌缸");
  const jar = put(e, PICKLE_JAR, 760, 520);
  e.s.storage.corn = 4;
  assert.equal(e.jarFill(jar.id, "corn"), true);
  assert.deepEqual(e.al.jars[jar.id], { item: "corn", n: 4, start: e.s.day });
  assert.equal(e.jarOf(jar.id).J.verb, "酿");
});

test("ecology repairs itself with the reclaimed share; tiles you changed are left alone", () => {
  const { e } = make();
  e.rlCompletion = () => ({ pct: 50 });
  e.f.ecology[1] = { ...e.f.ecology[1], type: "field" };
  const n = e.trEcology();
  assert.ok(n >= 6);
  for (const [i, type] of ECO_ORDER.slice(0, 8)) {
    const t = e.f.ecology[i];
    if (i === 1) assert.equal(t.type, "field");
    else assert.ok(t.clean && t.type === type, "tile " + i);
  }
  assert.equal(e.trEcology(), 0, "nothing more until the share grows");
});


test("treasures you used to steal are handed over when the owner trusts you (not the family photo)", () => {
  const { e } = make();
  e.ss.trust = { ...(e.ss.trust || {}), amo: 8, qin: 10 };
  e.trTreasures();
  assert.equal(e.th.treasures.tunnelMap, "given");
  assert.notEqual(e.th.treasures.familyPhoto, "given");
  assert.ok(e.tr.given.includes("tunnelMap"));
});

// ================= 页面 =================


test("the scene: the campaign renderer is the trim layer; the ♪ / 愁 bubble follows the camp morale over one resident only", () => {
  // v0.44 起上面还有一层（四季）；这一层照旧在里面
  assert.ok(CampaignRenderer === TrimRenderer || CampaignRenderer.prototype instanceof TrimRenderer);
  assert.ok(TrimRenderer.prototype instanceof ClearRenderer);
  const { e } = make();
  for (const id of ["farmer", "medic", "mechanic"]) e.recruit(id);
  const before = e.c.residents.map((r) => r.morale);
  const seen = [],
    orig = ClearRenderer.prototype.drawNeeds;
  ClearRenderer.prototype.drawNeeds = function (en) {
    seen.push(en.c.residents.map((r) => r.morale));
  };
  try {
    for (const m of [20, 85, 50]) {
      e.tr.morale = m;
      TrimRenderer.prototype.drawNeeds.call({}, e);
    }
  } finally {
    ClearRenderer.prototype.drawNeeds = orig;
  }
  assert.deepEqual(seen, [
    [30, 60, 60],
    [80, 60, 60],
    [60, 60, 60],
  ]);
  assert.deepEqual(
    e.c.residents.map((r) => r.morale),
    before,
    "put back after drawing",
  );
  // 田边的肥力色条不画（肥力一直是 85，下面几层看到 85 会画一条绿条）
  const soil0 = e.s.plots.map((p) => p.fertility),
    seenSoil = [],
    og = ClearRenderer.prototype.drawGarden;
  ClearRenderer.prototype.drawGarden = function (en) {
    seenSoil.push(en.s.plots.every((p) => p.fertility === 65));
  };
  try {
    TrimRenderer.prototype.drawGarden.call({ trNoSoil: TrimRenderer.prototype.trNoSoil }, e);
  } finally {
    ClearRenderer.prototype.drawGarden = og;
  }
  assert.deepEqual(seenSoil, [true]);
  assert.deepEqual(
    e.s.plots.map((p) => p.fertility),
    soil0,
    "put back after drawing",
  );
  assert.ok(e.farmPlots().every((p) => p.fertility === SOIL_FLAT), "a new farm is at the flat fertility");
});
