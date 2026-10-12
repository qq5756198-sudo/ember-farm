// v0.24.0「暗涌」：搜东西随机（柜子、四档稀有度、撬锁、身上掉的）、感染者换摆法、
// 膨胀者、装死者、吐酸者、夜行者、大块头、护士长、加强的仓库守卫、七种废墟小事件，
// 电台、档案馆、宵禁、每日抉择、麦穗、手记“今天”，以及存档。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState } from "../dist/campaign.js";
import { Engine as FeelEngine, freshState as feelFresh } from "../dist/feel.js";
import { ITEMS, REGIONS, ZOMBIES } from "../dist/data.js";
import { RULES, RUIN_PACKS, ZSTATS, GRAB_BITE_PARTS, CRAWL_BITE_PARTS } from "../dist/gear-data.js";
import { EVENTS } from "../dist/daily-data.js";
import { DECREES } from "../dist/winter-data.js";
import * as U from "../dist/undertow-data.js";
import { hashOf } from "../dist/undertow.js";

const make = (state = freshState(), seed = Number(process.env.USEED || 20241)) => {
  if (seed) state.undertow.seed = seed;
  const toasts = [];
  const e = new Engine(state, (t, tone) => toasts.push({ t, tone }));
  e.paused = false;
  e.toasts = toasts;
  e.update(0.016, { x: 0, y: 0 });
  return e;
};
const run = (e, secs, input = { x: 0, y: 0 }) => {
  for (let t = 0; t < secs - 1e-9; t += 0.05) e.update(0.05, input);
};
// 直接站到某张图（不走路上的时间），当天的感染者重新刷
const at = (e, region, day = e.s.day, fresh = true) => {
  e.s.day = day;
  e.s.minute = 600;
  e.s.region = region;
  if (fresh) e.s.enemies[region] = null;
  e.assignRegion();
  e.paused = false;
  e.update(0.016, { x: 0, y: 0 });
  return e;
};
const stand = (e, x, y) => Object.assign(e.s.player, { x, y });
const clearFoes = (e) => {
  for (const z of e.enemies) z.dead = true;
  e.enemies = e.s.enemies[e.s.region] = [];
};
const total = (e, id) => e.qty(id, true);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const withRandom = (v, fn) => {
  const r = Math.random;
  Math.random = typeof v === "function" ? v : () => v;
  try {
    return fn();
  } finally {
    Math.random = r;
  }
};

// ================= 数据 =================
test("loot tables only name real items; candidates, event spots, corpses and lairs stand on open ground", () => {
  for (const [k, kind] of Object.entries(U.KINDS))
    for (const t of U.TIERS)
      for (const entry of kind[t]) {
        if (Array.isArray(entry)) assert.ok(ITEMS[entry[0]], k + " " + entry[0]);
        else for (const key of ["once", "bp"]) if (entry[key]) assert.ok(ITEMS[entry[key]], k + " " + entry[key]);
      }
  for (const c of U.SEED_CROPS) for (const tr of ["early", "abundant", "hardy"]) assert.ok(ITEMS["seed_" + c + "_" + tr], c + tr);
  const e = make();
  for (const id of U.RUINS) {
    at(e, id);
    for (const c of U.CANDIDATES[id].filter((c) => !c.orig)) assert.equal(e.blocked(c.x, c.y, true, 18), false, id + " " + c.id);
    for (const s of U.EVENT_SPOTS[id]) assert.equal(e.blocked(s.x, s.y, true, 40), false, id + " event " + s.x);
    for (const [x, y] of U.DECOR_SPOTS[id]) assert.equal(e.blocked(x, y, true, 24), false, id + " corpse " + x);
  }
  for (const b of ["brute", "nurse"]) {
    at(e, U.BOSSES[b].region);
    assert.equal(e.blocked(U.BOSSES[b].lair.x, U.BOSSES[b].lair.y, true, 80), false, b + " lair has room");
  }
});

test("three layouts per ruin and phase keep the same count and kinds; the warehouse guard never moves", () => {
  for (const id of U.RUINS)
    for (let ph = 0; ph < 3; ph++) {
      const base = RUIN_PACKS[id][ph],
        kinds = (list) => list.map((m) => m[0]).sort().join(",");
      assert.equal(U.LAYOUTS[id][ph].length, 3);
      for (const lay of U.LAYOUTS[id][ph]) {
        assert.equal(lay.length, base.length, id + ph);
        assert.equal(kinds(lay), kinds(base), id + ph);
        const g0 = base.find((m) => m[0] === "elite"),
          g1 = lay.find((m) => m[0] === "elite");
        if (g0) assert.deepEqual([g1[1], g1[2]], [g0[1], g0[2]]);
      }
      // 第 2、3 套确实换了地方
      assert.notEqual(JSON.stringify(U.LAYOUTS[id][ph][1]), JSON.stringify(base));
    }
});

// ================= 存档 =================
test("a v0.23 save without undertow loads with nothing reset, gets its own seed and keeps it after a reload", () => {
  const old = feelFresh();
  old.day = 9;
  old.money = 321;
  old.inventory.scrap = 17;
  delete old.undertow;
  const text = JSON.stringify(old);
  const e = new Engine(Engine.parse(text), () => {});
  assert.equal(e.s.day, 9);
  assert.equal(e.s.money, 321);
  assert.equal(e.s.inventory.scrap, 17);
  assert.ok(e.ut.seed > 0);
  assert.equal(e.ut.old, true);
  const again = new Engine(Engine.parse(JSON.stringify(e.s)), () => {});
  assert.equal(again.ut.seed, e.ut.seed);
});

test("broken undertow fields are refused with a recoverable message", () => {
  const e = make();
  for (const bad of [{ schema: 9 }, { ...e.ut, ev: { day: 1, id: "nope", region: "residential", spot: 0, st: "wait", bits: 0, spawned: false } }, { ...e.ut, trophies: ["trophyBrute", "trophyBrute"] }, { ...e.ut, lit: { residential: { day: 2, ids: ["zz"] } } }, { ...e.ut, extra: 1 }]) {
    const s = JSON.parse(JSON.stringify(e.s));
    s.undertow = bad;
    assert.throws(() => Engine.parse(JSON.stringify(s)), /废墟记录损坏/);
  }
  assert.doesNotThrow(() => Engine.parse(JSON.stringify(e.s)));
});

// ================= 柜子 =================
test("4–5 containers are lit a day, never-opened supply boxes always among them, the same all day and after a reload", () => {
  const e = make();
  const seen = new Set();
  for (let day = 2; day < 40; day++) {
    at(e, "hospital", day);
    const lit = e.objects.filter((o) => o.type === "crate" && o.ukind && !["pile", "airdrop", "cache"].includes(o.ukind) && !o.id.includes("uroom"));
    assert.ok(lit.length >= 4 && lit.length <= 5, "day " + day + ": " + lit.length);
    for (const c of ["garden", "medicine", "ambulance"]) assert.ok(lit.some((o) => o.id === "hospital-" + c), "unopened " + c + " is lit");
    const ids = lit.map((o) => o.id).sort().join();
    e.assignRegion();
    assert.equal(e.objects.filter((o) => o.type === "crate" && o.ukind && lit.some((x) => x.id === o.id)).length, lit.length);
    const back = new Engine(Engine.parse(JSON.stringify(e.s)), () => {});
    assert.equal(back.objects.filter((o) => o.type === "crate" && o.ukind && lit.some((x) => x.id === o.id)).length, lit.length, "same after reload");
    for (const o of lit) seen.add(o.id);
    assert.ok(ids.length);
  }
  assert.ok(seen.size >= 8, "different cabinets on different days");
});

test("the first open still gives the original pack; afterwards each box rolls by its kind, fixed for the day", () => {
  const e = make();
  at(e, "residential", 5);
  clearFoes(e);
  const road = e.objects.find((o) => o.id === "residential-road");
  stand(e, road.x, road.y + 4);
  const wood0 = total(e, "wood");
  e._picked = road;
  e.openContainer(road);
  e._picked = null;
  // 原来那一包（打三分之二折，和以前一样）
  assert.ok(total(e, "wood") - wood0 >= 9, "original pack");
  assert.equal(e.s.opened["residential-road"].day, 5);
  e.openContainer(road);
  assert.ok(e.toasts.some((t) => /今天已经搜索过了/.test(t.t)));
  // 第二天：按货箱抽，抽到什么当天就定了
  e.s.day = 6;
  const r1 = e.rollContainer(road, 6),
    r2 = new Engine(Engine.parse(JSON.stringify(e.s)), () => {}).rollContainer(road, 6);
  assert.deepEqual(r1, r2);
  assert.ok(Object.keys(r1.bundle).every((id) => ITEMS[id]));
  assert.ok(U.TIERS.includes(r1.tier));
});

test("rolled boxes give the full amounts (no extra two-thirds cut) and name the box; rare and precious flash and sound", () => {
  const e = make();
  at(e, "warehouse", 9);
  clearFoes(e);
  const o = e.objects.find((x) => x.type === "crate" && x.ukind && !x.orig && !x.locked) || e.objects.find((x) => x.type === "crate" && x.orig);
  e.s.opened[o.id] ??= { day: 1, unique: true };
  // 找一天让它抽到稀有
  let day = 10;
  while (!["rare", "precious"].includes(e.rollContainer(o, day).tier)) day++;
  e.s.day = day;
  const roll = e.rollContainer(o, day),
    before = {};
  for (const id of Object.keys(roll.bundle)) before[id] = total(e, id);
  stand(e, o.x, o.y + 4);
  e.events.length = 0;
  e._picked = o;
  e.openContainer(o);
  e._picked = null;
  for (const [id, n] of Object.entries(roll.bundle)) {
    if (id.startsWith("bp_")) continue;
    assert.equal(total(e, id) - before[id], n, id);
  }
  assert.ok(e.events.some((v) => v.type === (roll.tier === "precious" ? "preciousLoot" : "rareLoot")));
  assert.ok(e.ux.flashes.length > 0);
  assert.ok(e.toasts.some((t) => t.t.startsWith(o.name + "：") && t.t.includes(U.TIER_NAMES[roll.tier])));
});

test("locked cabinets: no crowbar no luck; a crowbar takes 8 loud seconds and walking off stops it; lockpicking takes 4 quiet ones", () => {
  const e = make();
  at(e, "residential", 6);
  clearFoes(e);
  let o = e.objects.find((x) => x.locked);
  let day = 6;
  while (!o) {
    day++;
    at(e, "residential", day);
    clearFoes(e);
    o = e.objects.find((x) => x.locked);
  }
  delete e.s.inventory.crowbar;
  delete e.s.storage.crowbar;
  stand(e, o.x, o.y + 4);
  e._picked = o;
  e.interact();
  e._picked = null;
  assert.ok(e.toasts.at(-1).t.includes("回收撬棍"));
  assert.equal(e.ux.pry, null);
  e.s.inventory.crowbar = 1;
  e._picked = o;
  e.interact();
  e._picked = null;
  assert.ok(e.ux.pry);
  run(e, 2);
  assert.ok(e.noise.some((n) => n.r === U.PRY.noise), "prying is loud");
  run(e, 0.5, { x: 1, y: 0 });
  assert.equal(e.ux.pry, null, "walking away stops it");
  stand(e, o.x, o.y + 4);
  e._picked = o;
  e.interact();
  e._picked = null;
  run(e, U.PRY.time + 0.2);
  assert.equal(e.s.opened[o.id]?.day, e.s.day, "opened after 8 s");
  // 开锁天赋：4 秒、没声音
  const e2 = make(freshState(), e.ut.seed);
  e2.hasTalent = (id) => id === "lockpick";
  at(e2, "residential", day);
  clearFoes(e2);
  const o2 = e2.objects.find((x) => x.id === o.id);
  stand(e2, o2.x, o2.y + 4);
  e2._picked = o2;
  e2.interact();
  e2._picked = null;
  e2.noise.length = 0;
  run(e2, U.PRY.fast + 0.2);
  assert.equal(e2.s.opened[o2.id]?.day, e2.s.day);
  assert.ok(!e2.noise.some((n) => n.r === U.PRY.noise), "silent");
});

test("kill drops: no more scrap every third kill outside the farm, but by kind; the farm horde keeps the old rule", () => {
  const e = make();
  at(e, "residential", 2);
  clearFoes(e);
  const p = e.s.player;
  const kill = (type) => {
    const z = e.enemy(type, p.x + 30, p.y);
    e.enemies.push(z);
    e.hurtEnemy(z, 9999, 0);
    return z;
  };
  e.s.stats.kills = 2;
  const scrap0 = total(e, "scrap");
  withRandom(0.99, () => kill("slow"));
  assert.equal(total(e, "scrap"), scrap0, "third kill no longer drops 2 scrap");
  withRandom(0.01, () => kill("slow"));
  assert.ok(total(e, "scrap") > scrap0, "15% scrap from a walker");
  const parts0 = total(e, "parts");
  withRandom(0.01, () => kill("armor"));
  assert.ok(total(e, "parts") > parts0, "armour can drop parts");
  // 农场的尸潮：照旧
  at(e, "farm", 2);
  e.s.stats.kills = 2;
  const s1 = total(e, "scrap");
  const z = e.enemy("slow", p.x + 30, p.y, true);
  e.enemies.push(z);
  withRandom(0.99, () => e.hurtEnemy(z, 9999, 0));
  assert.ok(total(e, "scrap") > s1, "horde kill keeps the scrap");
});

// ================= 摆法和新感染者 =================
test("layouts change with each refresh; from day 4 a bloater and a faker replace walkers, from day 8 spitters too", () => {
  const e = make();
  const layouts = new Set();
  for (let day = 2; day <= 30; day += 2) {
    at(e, "warehouse", day);
    layouts.add(e.ut.gen.warehouse.k);
    const types = e.enemies.map((z) => z.type);
    const base = RUIN_PACKS.warehouse[e.phase()].length;
    assert.equal(e.enemies.filter((z) => !z.boss && !z.escort && !z.pile && !z.nest).length, base, "same count, day " + day);
    if (day >= 4) {
      assert.equal(types.filter((t) => t === "bloater").length, 1);
      assert.ok(e.enemies.some((z) => z.type === "faker" && z.lying));
    } else assert.ok(!types.includes("bloater") && !types.includes("faker"));
    if (day >= 8) assert.equal(types.filter((t) => t === "spitter").length, U.PLACE.spitter.warehouse);
    else assert.ok(!types.includes("spitter"));
    const guard = e.enemies.find((z) => z.type === "elite");
    const g0 = RUIN_PACKS.warehouse[e.phase()].find((m) => m[0] === "elite");
    assert.ok(dist(guard, { x: g0[1], y: g0[2] }) < 60, "guard stays put");
  }
  assert.equal(layouts.size, 3, "all three layouts show up");
});

test("bloater: dies with a 1 s flash, then a green cloud r90 for 6 s: 4 hp a second, stamina won't refill; a mask halves it", () => {
  const e = make();
  at(e, "residential", 5);
  clearFoes(e);
  const p = e.s.player;
  stand(e, 700, 640);
  const z = e.enemy("bloater", 740, 640);
  e.enemies.push(z);
  e.hurtEnemy(z, 9999, Math.PI);
  assert.equal(e.ux.fuses.length, 1);
  assert.ok(e.events.some((v) => v.type === "fuse"));
  run(e, 0.6);
  assert.equal(e.ux.clouds.length, 0, "not yet");
  run(e, 0.5);
  assert.equal(e.ux.clouds.length, 1, "burst after 1 s");
  p.hp = 80;
  p.stamina = 40;
  run(e, 1);
  assert.ok(Math.abs(80 - p.hp - 4) < 0.6, "about 4 hp in a second: " + (80 - p.hp));
  assert.ok(p.stamina <= 40.01, "no stamina back inside the cloud");
  e.ut.mask = e.s.day;
  p.hp = 80;
  run(e, 1);
  assert.ok(Math.abs(80 - p.hp - 2) < 0.6, "mask halves it: " + (80 - p.hp));
  run(e, 5);
  assert.equal(e.ux.clouds.length, 0, "gone after 6 s");
});

test("faker: lies among the corpses, grabs your ankle within 50 and bites a leg or foot; a hit while it lies does ×1.5 and wakes it", () => {
  const e = make();
  at(e, "hospital", 5);
  clearFoes(e);
  const z = e.makeFaker(800, 640);
  e.enemies.push(z);
  stand(e, 800, 760);
  run(e, 1);
  assert.equal(z.lying, true, "lies still");
  assert.ok(z.x === 800 && z.y === 640);
  stand(e, 800, 600);
  run(e, 0.1);
  assert.ok(e.gx.grab?.z === z, "grabbed");
  assert.equal(z.lying, false);
  for (const k of ["legs", "feet"]) e.gr.slots[k] = null;
  const bites = e.gr.stats.bites;
  run(e, 1.3);
  assert.equal(e.gr.stats.bites, bites + 1, "bitten");
  assert.ok(e.toasts.some((t) => /^(腿|脚)被咬了/.test(t.t)), "bites a leg or foot");
  // 躺着时被打：×1.5，醒过来
  const y = e.makeFaker(500, 500);
  e.enemies.push(y);
  const hp = y.hp;
  e.hurtEnemy(y, 20, 0);
  assert.equal(Math.round(hp - y.hp), 30);
  assert.equal(y.lying, false);
  assert.ok(y.stagger > 0);
});

test("a corpse closer than the box gets stomped by E; the box wins when it is closer; real corpses only get a kick", () => {
  const e = make();
  at(e, "residential", 5);
  clearFoes(e);
  const box = e.objects.find((o) => o.type === "crate" && o.ukind);
  const z = e.makeFaker(box.x + 60, box.y);
  e.enemies.push(z);
  stand(e, box.x + 5, box.y + 2);
  const hp = z.hp;
  e._picked = null;
  e.interact();
  assert.equal(z.hp, hp, "box first");
  stand(e, box.x + 52, box.y + 2);
  e.invulnerable = 5;
  e.interact();
  assert.ok(z.hp < hp, "stomped the faker");
  // 真尸体：踢一脚
  const k = e.decorCorpses()[0];
  if (k && !e.objects.some((o) => dist(o, k) < 90)) {
    stand(e, k.x + 20, k.y);
    e.effects.length = 0;
    e.interact();
    assert.ok(e.effects.some((f) => f.text === "真死了"));
  }
});

test("麦穗 growls at a lying faker once and marks it", () => {
  const e = make();
  at(e, "residential", 6);
  clearFoes(e);
  e.dogFollowing = () => true;
  e.f.dog.rescued = true;
  Object.assign(e.f.dog, { x: 600, y: 600 });
  const z = e.makeFaker(700, 620);
  e.enemies.push(z);
  stand(e, 560, 600);
  e.events.length = 0;
  e.tickDog(0.05);
  assert.ok(e.ux.spotted.has(z.id));
  assert.ok(e.events.some((v) => v.type === "dogGrowl"));
  const n = e.toasts.length;
  e.tickDog(0.05);
  assert.equal(e.toasts.length, n, "only once");
});

test("spitter keeps 200–300 away, rears back 0.7 s with a mark where you stand, the acid lands 0.5 s later: r50 for 5 s, 6 a second", () => {
  const e = make();
  at(e, "hospital", 9);
  clearFoes(e);
  const z = e.enemy("spitter", 900, 640);
  e.enemies.push(z);
  stand(e, 700, 640);
  z.state = "chase";
  z.alert = 8;
  z.scd = 0;
  e.update(0.05, {});
  assert.ok(z.spit, "rears back");
  assert.ok(Math.abs(z.spit.x - 700) < 2);
  run(e, 0.7);
  assert.equal(e.ux.acid.length, 1);
  run(e, 0.55);
  assert.equal(e.ux.puddles.length, 1);
  const p = e.s.player;
  p.hp = 90;
  stand(e, e.ux.puddles[0].x, e.ux.puddles[0].y);
  e.invulnerable = 0;
  run(e, 1);
  assert.ok(90 - p.hp > 4, "acid burns");
  // 打断：弹弓
  const z2 = e.enemy("spitter", 1100, 400);
  e.enemies.push(z2);
  z2.spit = { t: 0.5, x: 0, y: 0 };
  e._hit = { id: "slingshot", kind: "ranged", interrupt: true, knock: 0 };
  e.hurtEnemy(z2, 5, 0);
  e._hit = null;
  assert.equal(z2.spit, null);
});

test("stalkers: three in ten night wanderers from day 8; only strike from behind; a lamp in the face sends them off", () => {
  const e = make();
  at(e, "residential", 9);
  e.s.minute = 1380;
  e.gr.night = {};
  let stalkers = 0,
    wanderers = 0;
  for (let day = 9; day < 160; day++) {
    e.s.day = day;
    e.s.minute = 1380;
    e.gr.night = {};
    e.s.enemies.residential = null;
    e.assignRegion();
    wanderers += e.enemies.filter((z) => z.nightWander).length;
    stalkers += e.enemies.filter((z) => z.type === "stalker").length;
  }
  assert.ok(stalkers > wanderers * 0.2 && stalkers < wanderers * 0.4, stalkers + "/" + wanderers);
  clearFoes(e);
  const p = e.s.player;
  stand(e, 800, 600);
  p.facing = 0; // 看着东边
  const z = e.enemy("stalker", 990, 600);
  Object.assign(z, { state: "chase", alert: 8 });
  e.enemies.push(z);
  const hp = p.hp;
  for (let i = 0; i < 40; i++) {
    p.facing = Math.atan2(z.y - p.y, z.x - p.x);
    e.update(0.05, {});
  }
  assert.equal(p.hp, hp, "never from the front");
  // 打着手电对着它：退
  e.s.inventory.flashlight = 1;
  z.x = 960;
  z.y = 600;
  p.facing = 0;
  e.update(0.05, {});
  assert.ok(z.flee > 0, "backs off from the light");
  // 背对它：会冲过来
  delete e.s.inventory.flashlight;
  z.flee = 0;
  z.dcd = 0;
  z.x = 640;
  z.y = 600;
  p.facing = 0;
  e.invulnerable = 0;
  let hit = false;
  for (let i = 0; i < 40 && !hit; i++) {
    p.facing = 0;
    e.update(0.05, {});
    hit = p.hp < hp;
  }
  assert.ok(hit, "strikes from behind");
});

// ================= 头目 =================
test("the brute comes to the residential ruin on day 4, 11, 18…; the map says so the day before; gone the next day", () => {
  const e = make();
  for (const [day, on] of [
    [3, false],
    [4, true],
    [5, false],
    [10, false],
    [11, true],
    [18, true],
  ])
    assert.equal(e.bossOn("brute", day), on, "day " + day);
  e.s.day = 3;
  assert.ok(e.ruinNews().some((n) => n.boss === "brute" && n.when === "tomorrow"));
  at(e, "residential", 4);
  const b = e.enemies.find((z) => z.boss === "brute");
  assert.ok(b);
  assert.equal(b.hp, ZSTATS[1].brute.hp);
  assert.ok(dist(b, U.BOSSES.brute.lair) < 80);
  assert.ok(e.todayItems().some((t) => /大块头/.test(t.text)));
  at(e, "farm", 4);
  e.s.day = 5;
  e.onNewDay();
  assert.ok(!(e.s.enemies.residential || []).some((z) => z.boss), "gone next day");
  // 护士长：第 8 天起，医院
  assert.equal(e.bossOn("nurse", 8), true);
  assert.equal(e.bossOn("nurse", 1), false);
  at(e, "hospital", 8);
  assert.ok(e.enemies.some((z) => z.boss === "nurse"));
  assert.equal(e.enemies.filter((z) => z.escort).length, U.BOSSES.nurse.escorts);
});

test("brute: red circle then a slam that knocks you down; door throw along a line; ×1.5 from behind; faster when below half", () => {
  const e = make();
  at(e, "residential", 4);
  const b = e.enemies.find((z) => z.boss === "brute");
  e.enemies = e.s.enemies.residential = [b];
  const p = e.s.player;
  stand(e, b.x + 60, b.y);
  b.state = "chase";
  e.update(0.05, {});
  assert.equal(b.act?.kind, "slam");
  assert.ok(e.events.some((v) => v.type === "slamCue"));
  const hp = p.hp;
  e.invulnerable = 0;
  run(e, U.BOSSES.brute.slam.warn + 0.1);
  assert.ok(p.hp < hp, "slam hits");
  assert.ok(e.gx.down > 0, "knocked down");
  // 背后 ×1.5，正面 ×0.85
  b.facing = 0;
  const h0 = b.hp;
  e.hurtEnemy(b, 100, 0); // 从西边往东打 = 打它背后
  assert.equal(Math.round(h0 - b.hp), 150);
  const h1 = b.hp;
  e.hurtEnemy(b, 100, Math.PI);
  assert.equal(Math.round(h1 - b.hp), 85);
  // 车门
  b.act = null;
  b.dcd = 0;
  b.scd = 99;
  let spot = null;
  for (let k = 0; k < 32 && !spot; k++) {
    const a = (k / 32) * Math.PI * 2,
      q = { x: Math.round(b.x + Math.cos(a) * 300), y: Math.round(b.y + Math.sin(a) * 300) };
    if (!e.blocked(q.x, q.y, true, 14) && e.lineClear(b, q)) spot = q;
  }
  stand(e, spot.x, spot.y);
  e.gx.down = 0;
  e.update(0.05, {});
  assert.equal(b.act?.kind, "door");
  run(e, U.BOSSES.brute.door.warn + 0.05);
  assert.ok(e.ux.doors.length === 1 || e.events.some((v) => v.type === "doorHit"));
  // 发狂
  b.hp = b.maxHp * 0.4;
  b.act = null;
  e.update(0.05, {});
  assert.equal(b.rage, true);
});

test("first brute win: rewards doubled, sledge plan or riot helmet, trophy; later wins plain", () => {
  const e = make();
  at(e, "residential", 4);
  const b = e.enemies.find((z) => z.boss === "brute");
  const parts0 = total(e, "parts");
  e.hurtEnemy(b, 99999, 0);
  assert.equal(e.ut.boss.brute.wins, 1);
  assert.equal(e.ut.boss.brute.first, 4);
  assert.ok(total(e, "parts") - parts0 >= 8);
  assert.equal(total(e, "trophyBrute"), 1);
  assert.ok(e.knows("bp_sledge") || total(e, "bp_sledge") === 1);
  assert.ok(!e.enemies.some((z) => z.boss && !z.dead));
  at(e, "residential", 4, false);
  assert.ok(!e.enemies.some((z) => z.boss && !z.dead), "beaten today: no new one");
  at(e, "residential", 11);
  const b2 = e.enemies.find((z) => z.boss === "brute");
  const p1 = total(e, "parts");
  e.hurtEnemy(b2, 99999, 0);
  assert.ok(total(e, "parts") - p1 >= 4 && total(e, "parts") - p1 < 8);
  assert.equal(total(e, "trophyBrute"), 1, "one trophy only");
});

test("nurse: screams every 20 s for four more (hit her while she inhales to stop it); her green pulse heals the others", () => {
  const e = make();
  at(e, "hospital", 8);
  const n = e.enemies.find((z) => z.boss === "nurse");
  const p = e.s.player;
  stand(e, n.x + 200, n.y);
  n.state = "chase";
  n.sct = 0.01;
  e.invulnerable = 999;
  e.update(0.05, {});
  assert.equal(n.act?.kind, "scream");
  e.hurtEnemy(n, 5, 0);
  assert.notEqual(n.act?.kind, "scream", "interrupted");
  const before = e.enemies.filter((z) => z.summoned).length;
  n.act = null;
  n.sct = 0.01;
  e.update(0.05, {});
  run(e, U.BOSSES.nurse.scream.warn + 0.1);
  assert.equal(e.enemies.filter((z) => z.summoned).length - before, U.BOSSES.nurse.scream.summon);
  const esc = e.enemies.find((z) => z.escort);
  stand(e, n.x + 400, n.y);
  Object.assign(esc, { x: n.x + 40, y: n.y, hp: 20 });
  n.act = null;
  n.pct = 0;
  n.sct = 99;
  e.update(0.05, {});
  assert.equal(n.act?.kind, "pulse");
  run(e, U.BOSSES.nurse.pulse.warn + 0.1);
  assert.equal(esc.hp, 20 + U.BOSSES.nurse.pulse.heal);
});

test("the guard keeps to its post: chased too far while you walk away, it goes back; come near its post again and it comes for you", () => {
  const e = make();
  at(e, "warehouse", 9);
  const g = e.enemies.find((z) => z.type === "elite");
  e.enemies = e.s.enemies.warehouse = [g];
  const home = { x: g.homeX, y: g.homeY };
  // 把它引到守的地方 480 以外，你自己也在更远处
  const away = e.freePoint(home.x - 480, home.y);
  Object.assign(g, { x: away.x, y: away.y, state: "chase", alert: 8 });
  const far = e.freePoint(home.x - 700, home.y);
  stand(e, far.x, far.y);
  if (e.fx) e.fx.hitstop = 0;
  e.update(0.05, {});
  assert.equal(g.homing, true, "gives up");
  const d0 = dist(g, home);
  run(e, 3);
  assert.ok(dist(g, home) < d0 - 60, "walks back");
  assert.notEqual(g.state, "chase");
  // 存档里带着这一步
  const back = Engine.parse(JSON.stringify(e.s));
  assert.equal(back.enemies.warehouse.find((z) => z.type === "elite").homing, true);
  // 你回到它守的地方附近：再追
  stand(e, home.x - 200, home.y + 10);
  e.update(0.05, {});
  assert.equal(g.homing, false);
});

test("days 1–3 the warehouse guard is the old elite: no boss bar, the old armour rule, nothing extra when it dies", () => {
  const e = make();
  at(e, "warehouse", 2);
  const g = e.enemies.find((z) => z.type === "elite");
  assert.ok(g);
  assert.equal(e.isGuard(g), false);
  assert.equal(e.bossKind(g), null);
  stand(e, g.x - 120, g.y);
  g.state = "chase";
  assert.equal(e.bossBar(), null, "no bar on days 1–3");
  g.facing = 0;
  const h0 = g.hp;
  e.hurtEnemy(g, 100, Math.PI); // 正面：照旧 0.45
  assert.equal(Math.round(h0 - g.hp), 45);
  e.hurtEnemy(g, 99999, 0);
  assert.equal(e.ut.boss.guard.wins, 0);
  assert.equal(total(e, "trophyGuard"), 0);
});

test("warehouse guard: armour in front (×0.2), back hits get through (×0.7); past half its plates fall and it charges again and again", () => {
  const e = make();
  at(e, "warehouse", 9);
  const g = e.enemies.find((z) => z.type === "elite");
  e.enemies = e.s.enemies.warehouse = [g];
  g.facing = 0;
  const h0 = g.hp;
  e.hurtEnemy(g, 100, Math.PI); // 正面
  assert.equal(Math.round(h0 - g.hp), 20);
  const h1 = g.hp;
  e.hurtEnemy(g, 100, 0); // 背后
  assert.equal(Math.round(h1 - g.hp), Math.round(100 * U.BOSSES.guard.back));
  // 出手打不断
  g.windup = 0.5;
  e._hit = { id: "ironspear", kind: "pole", knock: 36, pierce: 0.7 };
  e.hurtEnemy(g, 10, 0);
  e._hit = null;
  assert.equal(g.windup, 0.5, "super armour");
  g.windup = 0; // 这一下打完了
  if (e.fx) e.fx.hitstop = 0;
  g.hp = g.maxHp * 0.45;
  stand(e, g.x - 220, g.y);
  g.state = "chase";
  g.ccd = 0;
  e.update(0.05, {});
  assert.equal(g.g2, true);
  assert.equal(g.parts.armor, 0);
  assert.ok(g.charge, "charges");
  assert.ok(e.events.some((v) => v.type === "armorOff"));
  // 打死：另加机械零件（第一次翻倍）和战利品
  const parts0 = total(e, "parts");
  e.hurtEnemy(g, 99999, 0);
  assert.ok(total(e, "parts") - parts0 >= 8);
  assert.equal(total(e, "trophyGuard"), 1);
  assert.equal(e.ut.boss.guard.wins, 1);
});

test("boss bar shows the one you fight; intel counts down the nurse's next scream", () => {
  const e = make();
  at(e, "hospital", 8);
  const n = e.enemies.find((z) => z.boss === "nurse");
  stand(e, n.x + 300, n.y);
  n.state = "chase";
  n.sct = 7.2;
  let bar = e.bossBar();
  assert.equal(bar.name, "护士长");
  assert.equal(bar.note, "");
  e.ut.intel.nurse = 1;
  bar = e.bossBar();
  assert.match(bar.note, /下一声尖叫 8 秒/);
  stand(e, 120, 520);
  n.state = "patrol";
  assert.equal(e.bossBar(), null);
});

// ================= 废墟里的小事 =================
test("about a third of days carry a ruin event, never in today's hazard ruin, fixed by seed", () => {
  const e = make();
  let n = 0;
  for (let day = 2; day < 402; day++) {
    e.s.day = day;
    e.ut.evDay = 0;
    e.ensureDay();
    const ev = e.ut.ev;
    if (!ev) continue;
    n++;
    assert.ok(U.RUINS.includes(ev.region));
    const h = e.hazardToday?.();
    if (h) assert.notEqual(h.region, ev.region);
  }
  assert.ok(n > 400 * 0.27 && n < 400 * 0.43, "rate " + n);
  e.s.day = 50;
  e.ut.evDay = 0;
  e.ensureDay();
  const a = JSON.stringify(e.ut.ev);
  e.ut.evDay = 0;
  e.ensureDay();
  assert.equal(JSON.stringify(e.ut.ev), a);
});

const forceEvent = (e, id, region = "residential", day = 12) => {
  e.s.day = day;
  e.ut.evDay = day;
  e.ut.ev = { day, id, region, spot: 0, st: "wait", bits: 0, spawned: false };
  at(e, region, day);
  return e.ut.ev;
};

test("trapped survivor: walk him to the exit; reputation and what he carries; he can join the crew", () => {
  const e = make();
  const ev = forceEvent(e, "trapped");
  clearFoes(e);
  const o = e.objects.find((x) => x.type === "uSurvivor");
  assert.ok(o);
  stand(e, o.x + 20, o.y);
  e._picked = o;
  e.interact();
  e._picked = null;
  assert.equal(ev.st, "follow");
  const rep0 = e.c.reputation;
  // 走回出口
  const exit = REGIONS.residential.exit;
  for (let i = 0; i < 1200 && ev.st === "follow"; i++) {
    const p = e.s.player;
    const path = e.pathTo(p, exit);
    const nx = path[0] || exit;
    const a = Math.atan2(nx.y - p.y, nx.x - p.x);
    if (dist(o, p) > 120) e.update(0.05, {});
    else e.update(0.05, { x: Math.cos(a), y: Math.sin(a) });
  }
  assert.equal(ev.st, "safe");
  assert.ok(e.c.reputation >= rep0 + 5);
  const join = e.objects.find((x) => x.type === "uJoin");
  if (e.joinable()) {
    assert.ok(join);
    const crew0 = e.o.crew.length;
    e.survivorJoin();
    assert.equal(e.o.crew.length, crew0 + 1);
  }
  assert.equal(ev.st, "done");
});

test("airdrop: lands 60 s after you arrive, loud enough to pull the infected over; a box that rolls rare or better", () => {
  const e = make();
  const ev = forceEvent(e, "airdrop");
  assert.equal(ev.st, "fall");
  assert.ok(e.ux.drop);
  const z = e.enemy("slow", e.ux.drop.x + 300, e.ux.drop.y);
  e.enemies.push(z);
  stand(e, 170, 520);
  e.invulnerable = 999;
  run(e, 61);
  assert.equal(ev.st, "landed");
  assert.ok(e.events.some((v) => v.type === "airdropLand"));
  const box = e.objects.find((o) => o.id === "residential-uair");
  assert.ok(box);
  const roll = e.rollContainer(box);
  assert.ok(["rare", "precious"].includes(roll.tier));
});

test("corpse pile: two or three fakers among the bodies (from day 4), a box under it", () => {
  const e = make();
  forceEvent(e, "pile", "hospital", 12);
  const fakers = e.enemies.filter((z) => z.pile && z.lying);
  assert.ok(fakers.length >= 2 && fakers.length <= 3);
  assert.ok(e.objects.some((o) => o.id === "hospital-upile"));
  assert.ok(e.decorCorpses().filter((k) => k.pile).length >= 5);
  at(e, "hospital", 12, false);
  assert.equal(e.enemies.filter((z) => z.pile).length, fakers.length, "spawned once");
});

test("storeroom: 15 s on the door with a crowbar (half the map hears it), then two locked cabinets already open", () => {
  const e = make();
  const ev = forceEvent(e, "storeroom", "warehouse", 12);
  clearFoes(e);
  e.s.inventory.crowbar = 1;
  const door = e.objects.find((o) => o.type === "uDoor");
  stand(e, door.x, door.y + 30);
  e._picked = door;
  e.interact();
  e._picked = null;
  run(e, 2);
  assert.ok(e.noise.some((n) => n.r === U.EVENT_RULES.storeroom.noise));
  run(e, 13.5);
  assert.equal(ev.st, "open");
  const boxes = e.objects.filter((o) => String(o.id || "").startsWith("warehouse-uroom"));
  assert.equal(boxes.length, 2);
  for (const b of boxes) {
    stand(e, b.x, b.y + 4);
    e._picked = b;
    e.interact();
    e._picked = null;
    assert.equal(e.s.opened[b.id]?.day, 12);
  }
  assert.equal(ev.st, "done");
});

test("raider search party only when a raid is coming; drop both for ammo and two fewer raiders that night", () => {
  const e = make();
  e.o.raid.phase = "scheduled";
  e.o.raid.day = 20;
  const ev = forceEvent(e, "raiders", "residential", 12);
  const party = e.enemies.filter((z) => z.uParty);
  assert.equal(party.length, 2);
  const size = e.raidSize();
  const ammo0 = total(e, "ammo");
  for (const z of party) e.hurtEnemy(z, 9999, 0);
  assert.equal(ev.st, "done");
  assert.equal(total(e, "ammo") - ammo0, 12);
  assert.equal(e.raidSize(), Math.max(3, size - 2));
  // 没有定下袭击：不出搜索队
  const e2 = make();
  e2.o.raid.phase = "won";
  e2.s.day = 12;
  e2.ut.evDay = 0;
  for (let d = 2; d < 300; d++) {
    e2.s.day = d;
    e2.ut.evDay = 0;
    e2.ensureDay();
    assert.notEqual(e2.ut.ev?.id, "raiders");
  }
});

test("wandering trader: two goods for bread and bandages, each once", () => {
  const e = make();
  const ev = forceEvent(e, "merchant", "hospital", 12);
  clearFoes(e);
  const goods = e.objects.filter((o) => o.type === "uGood");
  assert.equal(goods.length, 2);
  e.s.inventory.bread = 0;
  stand(e, goods[0].x, goods[0].y);
  assert.equal(e.buyGood(goods[0]), false);
  e.s.inventory.bread = 9;
  e.s.inventory.bandage = 3;
  assert.equal(e.buyGood(goods[0]), true);
  assert.equal(e.buyGood(goods[0]), false, "once");
  assert.equal(e.buyGood(goods[1]), true);
  assert.equal(ev.st, "done");
});

test("walkie-talkie: beeps when you take it; tomorrow another ruin has a rare box, marked on the map", () => {
  const e = make();
  const ev = forceEvent(e, "radio", "warehouse", 12);
  const t = e.objects.find((o) => o.type === "uTalkie");
  e.pickTalkie(t);
  assert.equal(ev.st, "done");
  const c = e.ut.cache;
  assert.equal(c.day, 13);
  assert.notEqual(c.region, "warehouse");
  e.s.day = 13;
  e.ut.evDay = 0;
  assert.ok(e.ruinNews().some((n) => n.kind === "cache" && n.region === c.region));
  at(e, c.region, 13);
  const box = e.objects.find((o) => o.id === c.region + "-ucache");
  assert.ok(box);
  assert.ok(["rare", "precious"].includes(e.rollContainer(box).tier));
});

// ================= 电台、宵禁、每日抉择、档案馆 =================
test("radio at 07:00 tells where something is going on and the boss rumours; before it is fixed the map only says 'something'", () => {
  const e = make();
  forceEvent(e, "airdrop", "hospital", 10);
  e.r.radio = false;
  assert.ok(e.ruinNews().some((n) => n.kind === "event" && n.text === "好像有动静"));
  assert.equal(e.radioMorning(), false);
  e.r.radio = true;
  assert.ok(e.ruinNews().some((n) => n.kind === "event" && /天上有飞机的声音/.test(n.text)));
  assert.equal(e.radioMorning(), true);
  assert.ok(e.toasts.at(-1).t.startsWith("电台早间播报："));
  assert.match(e.toasts.at(-1).t, /明天废弃居民区可能有大块头/);
  assert.equal(e.radioMorning(), false, "once a day");
});

test("curfew keeps the stalkers away from the farm; without it some nights from day 8 two prowl the edge until 04:00", () => {
  assert.match(DECREES.curfew.good, /夜行者/);
  const e = make();
  at(e, "farm", 9);
  let nights = 0;
  for (let day = 9; day < 70; day++) {
    e.s.day = day;
    e.s.minute = 1330;
    e.ut.prowl = 0;
    e.tickProwl();
    if (e.enemies.some((z) => z.prowl)) nights++;
    e.s.minute = 300;
    e.s.day = day + 1;
    e.tickProwl();
    assert.ok(!e.enemies.some((z) => z.prowl), "gone at dawn");
  }
  assert.ok(nights > 61 * 0.15 && nights < 61 * 0.45, "nights " + nights);
  e.decree = (id) => id === "curfew";
  for (let day = 70; day < 120; day++) {
    e.s.day = day;
    e.s.minute = 1330;
    e.ut.prowl = 0;
    e.tickProwl();
    assert.ok(!e.enemies.some((z) => z.prowl), "curfew");
  }
});

test("new daily cards: asking about the nurse or the brute leaves intel; a mask halves the gas today", () => {
  for (const id of U.U_CARD_IDS) {
    assert.ok(EVENTS[id]);
    assert.equal(EVENTS[id].opts.length, 3);
  }
  const e = make();
  assert.match(e.applyOp(["uIntel", "nurse"], {}, 1), /护士长/);
  assert.equal(e.ut.intel.nurse, e.s.day);
  assert.match(e.applyOp(["uMask"], {}, 1), /口罩/);
  assert.equal(e.ut.mask, e.s.day);
});

test("museum: three boss trophies fill their own case for reputation and morale; only at the museum", () => {
  const e = make();
  for (const id of U.TROPHY_IDS) e.s.storage[id] = 1;
  e.museumHere = () => false;
  assert.equal(e.donateTrophy("trophyBrute"), false);
  e.museumHere = () => true;
  const rep = e.c.reputation;
  for (const id of U.TROPHY_IDS) assert.equal(e.donateTrophy(id), true);
  assert.equal(e.ut.trophyDone, true);
  assert.equal(e.c.reputation, rep + 10);
  assert.equal(e.donateTrophy("trophyBrute"), false, "no second time");
  assert.deepEqual(e.trophyCase().donated.sort(), [...U.TROPHY_IDS].sort());
});

test("hashOf and the seed: the same inputs give the same number", () => {
  assert.equal(hashOf(1, "a", 2), hashOf(1, "a", 2));
  assert.notEqual(hashOf(1, "a", 2), hashOf(1, "a", 3));
});
