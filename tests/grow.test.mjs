// v0.34.0「成长」：技能 6–10 级（老手的小本事）、每样近战擅长的场合、打法挑战、第二年的清单、存档和页面。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, needsStoryMigration } from "../dist/campaign.js";
import * as Hope from "../dist/hope.js";
import { ITEMS, REGIONS, CROPS, RECIPES } from "../dist/data.js";
import { MELEE, ARMOR, RULES } from "../dist/gear-data.js";
import { WALL_IDS, WALL_LISTS, LIST_IDS } from "../dist/relight-data.js";
import { WALL2 } from "../dist/hope-data.js";
import * as U from "../dist/undertow-data.js";
import { MOMENT_KINDS } from "../dist/zest-data.js";
import { MOMENT_SOUND, STINGERS } from "../dist/audio-data.js";
import { decorItem, DECOR_BY_ID } from "../dist/almanac-data.js";
import { SKILL_NAMES } from "../dist/thief-data.js";
import { TIERS as REEL_TIERS } from "../dist/kin-data.js";
import {
  MASTER_XP,
  MASTER_TOP,
  PERKS,
  PERK_BY_ID,
  PERK_FX,
  WEAPON_FX,
  WEAPON_USE,
  CHALLENGES,
  CHALLENGE_IDS,
  LISTS2,
  LIST2_IDS,
  LISTS2_START,
  WALL_KEEPSAKE,
  GROW_COMPLETION,
  INTRO_LINES,
  GROW_DECOR,
} from "../dist/grow-data.js";

const make = (state = freshState(), seed = 34001) => {
  const toasts = [];
  if (state.undertow) state.undertow.seed = seed;
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  if (e.dy) e.dy.pending = null;
  e.update(0.016, { x: 0, y: 0 });
  return { e, toasts };
};
const said = (toasts, re) => toasts.some((t) => re.test(t.text));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const run = (e, secs, input = { x: 0, y: 0 }) => {
  for (let t = 0; t < secs - 1e-9; t += 0.05) e.update(0.05, input);
};
const at = (e, region, day = e.s.day) => {
  e.s.day = day;
  e.s.minute = 600;
  e.s.region = region;
  e.s.visited = { ...(e.s.visited || {}), [region]: true };
  e.s.enemies[region] = null;
  e.assignRegion();
  e.paused = false;
  return e;
};
const clearFoes = (e) => {
  for (const z of e.enemies) z.dead = true;
  e.enemies = e.s.enemies[e.s.region] = [];
};
const stand = (e, x, y) => Object.assign(e.s.player, { x, y });
const qty = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);
const stock = (e, items) => {
  for (const [id, n] of Object.entries(items)) e.s.storage[id] = (e.s.storage[id] || 0) + n;
};
const moments = (e, kind) => e.events.filter((x) => x.type === "moment" && (!kind || x.kind === kind));
const withRandom = (v, fn) => {
  const r = Math.random;
  Math.random = typeof v === "function" ? v : () => v;
  try {
    return fn();
  } finally {
    Math.random = r;
  }
};
// 把一项技能的经验给到某一级
const toLevel = (e, skill, L) => {
  const x = L >= 6 ? MASTER_XP[skill][L - 6] : (L - 1) * (skill === "thief" ? 60 : 40);
  if (skill === "thief") e.sk.thiefXp = x;
  else e.s.xp[skill] = x;
  e.masterSweep();
};
const allTo = (e, L) => {
  for (const k of Object.keys(MASTER_XP)) toLevel(e, k, L);
};
// 一只感染者站在你正前方
const foe = (e, type, d = 40, facing = "toward") => {
  const p = e.s.player,
    z = e.enemy(type, p.x + d, p.y);
  z.state = "chase";
  z.facing = facing === "toward" ? Math.PI : 0;
  e.enemies.push(z);
  return z;
};
const arm = (e, id) => {
  e.s.inventory[id] = 1;
  e.gr.slots.melee = id;
  e.s.slot = 3;
  e.cooldown = 0;
};
const hitWith = (e, z, id) => {
  arm(e, id);
  const p = e.s.player;
  e.meleeHit(z, e.meleeStats(id), id, Math.atan2(z.y - p.y, z.x - p.x));
};

// ================= 数据 =================
test("data: six to ten get slower each level, one perk a level, keepsakes and list items are real", () => {
  for (const [k, t] of Object.entries(MASTER_XP)) {
    assert.equal(t.length, MASTER_TOP - 5, k);
    const base = k === "thief" ? 240 : 160;
    const steps = [t[0] - base, ...t.slice(1).map((x, i) => x - t[i])];
    for (let i = 1; i < steps.length; i++) assert.ok(steps[i] >= steps[i - 1], k + " level " + (i + 6) + " is slower than the one before");
    assert.deepEqual(
      PERKS[k].map((p) => p.lv),
      [6, 7, 8, 9, 10],
      k,
    );
    assert.ok(PERKS[k].at(-1).decor, k + " ten gives a keepsake");
  }
  for (const id of GROW_DECOR) {
    assert.ok(DECOR_BY_ID[id], id);
    assert.ok(ITEMS[decorItem(id)], id);
  }
  for (const C of Object.values(CHALLENGES)) assert.ok(GROW_DECOR.includes(C.decor), C.name);
  for (const w of WALL_IDS) {
    assert.equal(LIST2_IDS.filter((id) => LISTS2[id].wall === w).length, 2, w);
    assert.ok(GROW_DECOR.includes(WALL_KEEPSAKE[w]), w);
  }
  for (const [id, L] of Object.entries(LISTS2)) {
    for (const [k, n] of L.need) assert.ok(k.startsWith("@") || ITEMS[k], id + " " + k);
    for (const k of Object.keys(L.reward)) assert.ok(k === "gold" || ITEMS[k], id + " reward " + k);
    assert.ok(L.hint.length > 6);
  }
  for (const id of Object.keys(WEAPON_USE)) assert.match(ITEMS[id].desc, /擅长：/, id);
  assert.match(REGIONS.hospital.risk, /长矛伸不开/);
  for (const k of ["master", "challenge", "list2"]) {
    assert.ok(MOMENT_KINDS[k], k);
    assert.ok(MOMENT_SOUND[k] && STINGERS[MOMENT_SOUND[k].stinger], k);
  }
  assert.equal(GROW_COMPLETION.find((c) => c.id === "challenges").max, CHALLENGE_IDS.length);
});

// ================= 老手 =================
test("six to ten: levels count past five, the old effects stay at five, no new skill points", () => {
  const { e } = make();
  toLevel(e, "combat", 5);
  const points5 = e.skillPoints().earned,
    dmg5 = e.meleeStats("ironspear").dmg;
  for (let L = 6; L <= 10; L++) {
    toLevel(e, "combat", L);
    assert.equal(e.masterLv("combat"), L);
    assert.equal(e.level("combat"), 5, "the old level stays at five");
  }
  assert.equal(e.skillPoints().earned, points5, "six to ten give no talent points");
  assert.equal(e.meleeStats("ironspear").dmg, dmg5, "no more damage");
  // 下一级还差多少
  const { e: f } = make();
  toLevel(f, "agriculture", 6);
  f.s.xp.agriculture += 10;
  const nx = f.masterNext("agriculture");
  assert.equal(nx.lv, 6);
  assert.equal(nx.left, MASTER_XP.agriculture[1] - MASTER_XP.agriculture[0] - 10);
  toLevel(f, "agriculture", 10);
  assert.equal(f.masterNext("agriculture").left, 0);
});

test("a level past five is a big card with its perk; ten brings a keepsake; one card covers a jump", () => {
  const { e } = make();
  toLevel(e, "exploration", 5);
  e.events.length = 0;
  e.xp("exploration", MASTER_XP.exploration[0] - e.s.xp.exploration);
  let cards = moments(e, "master");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].title, "探索 Lv.6");
  assert.match(cards[0].lines[0], /多翻一下/);
  e.update(0.05, {});
  assert.equal(moments(e, "master").length, 1, "said once");
  // 一下跳到 10 级：一张卡片写全，纪念物进了背包或仓库
  e.events.length = 0;
  e.xp("exploration", MASTER_XP.exploration[4]);
  cards = moments(e, "master");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].title, "探索 Lv.10");
  assert.equal(qty(e, decorItem("grCompass")), 1);
  // 妙手也一样（偷东西给的经验）
  e.events.length = 0;
  toLevel(e, "thief", 5);
  e.thiefXp(MASTER_XP.thief[0] - e.sk.thiefXp);
  assert.equal(moments(e, "master").at(-1)?.title, "妙手 Lv.6");
});

test("perks never make a fight easier: max HP, stamina, every weapon and armor hit the same at ten", () => {
  const { e: a } = make();
  const { e: b } = make();
  allTo(a, 5);
  allTo(b, 10);
  assert.equal(a.maxHp(), b.maxHp());
  assert.equal(a.maxSta(), b.maxSta());
  for (const id of Object.keys(MELEE)) assert.equal(JSON.stringify(a.meleeStats(id)), JSON.stringify(b.meleeStats(id)), id);
  for (const id of ["pistol", "shotgun", "rifle", "crossbow", "slingshot"]) assert.equal(JSON.stringify(a.weaponStats(id)), JSON.stringify(b.weaponStats(id)), id);
  assert.equal(JSON.stringify(a.armorTotals()), JSON.stringify(b.armorTotals()));
});

test("farming perks: water the next plot too, an extra crop now and then, a seed saved, a dry day forgiven", () => {
  const { e } = make();
  at(e, "farm", 10);
  e.s.debris = [];
  const plots = e.s.plots.filter((p) => !p.region);
  const p = plots[0],
    q = plots.filter((x) => x !== p).sort((a, b) => dist(a, p) - dist(b, p))[0];
  assert.ok(dist(p, q) <= PERK_FX.neighbor, "two plots side by side");
  for (const x of [p, q]) Object.assign(x, { tilled: true, crop: "radish", growth: 0, wateredDay: 0, waterUnits: 0, trait: null });
  e.c.water = 10;
  stand(e, p.x, p.y + 20);
  assert.ok(e.toolPlot(p, "water"));
  assert.notEqual(q.wateredDay, e.s.day, "not before level 6");
  p.wateredDay = 0;
  p.waterUnits = 0;
  toLevel(e, "agriculture", 6);
  const water0 = e.c.water;
  assert.ok(e.toolPlot(p, "water"));
  assert.equal(q.wateredDay, e.s.day, "the next plot is watered too");
  assert.equal(water0 - e.c.water, 2, "both use water from the can");
  // 照看也一样：亲手照看一块，旁边一块今天还没照看的也照看上（不另外费体力）
  {
    const { e: f } = make();
    at(f, "farm", 10);
    f.s.debris = [];
    const ps = f.s.plots.filter((x) => !x.region),
      a = ps[0],
      b = ps.filter((x) => x !== a).sort((x, y) => dist(x, a) - dist(y, a))[0];
    for (const x of [a, b]) Object.assign(x, { tilled: true, crop: "radish", growth: 0, wateredDay: f.s.day, waterUnits: 1, trait: null });
    stand(f, a.x, a.y + 20);
    assert.ok(f.tend(a));
    assert.notEqual(f.g.plots[b.id]?.t, f.s.day, "not before level 6");
    f.g.plots[a.id].t = 0;
    toLevel(f, "agriculture", 6);
    const c0 = f.gRec(b).c,
      st0 = f.s.player.stamina;
    assert.ok(f.tend(a));
    assert.equal(f.g.plots[b.id].t, f.s.day, "the next plot is tended too");
    assert.ok(f.gRec(b).c > c0);
    assert.equal(st0 - f.s.player.stamina, 1, "one tend's stamina");
    assert.equal(f.gw.stats.perkTend, 1);
  }
  // 手熟、惜种：一成机会（照存档里的种子掷，一样的局面一样的结果）
  toLevel(e, "agriculture", 8);
  let extra = 0,
    saved = 0;
  for (let i = 0; i < 80; i++) {
    Object.assign(p, { crop: "radish", growth: CROPS.radish.grow, wateredDay: e.s.day });
    const before = qty(e, "radish");
    assert.ok(e.harvest(p));
    const got = qty(e, "radish") - before;
    if (got > e.harvestYield?.(p) || got > CROPS.radish.yield + 2) extra++;
    e.s.inventory.seedRadish = 5;
    const s0 = e.s.inventory.seedRadish;
    Object.assign(p, { crop: null, growth: 0, tilled: true });
    if (e.toolPlot(p, "seedRadish") && e.s.inventory.seedRadish === s0) saved++;
    e.s.stats.harvested++;
  }
  assert.ok(e.gw.stats.perkExtra >= 2 && e.gw.stats.perkExtra <= 20, "about one in ten: " + e.gw.stats.perkExtra);
  assert.ok(saved >= 2 && saved <= 20, "about one in ten: " + saved);
  // 护苗：昨天浇过的今天也算浇过
  Object.assign(q, { crop: "radish", growth: 0, wateredDay: e.s.day - 1, waterUnits: 1 });
  assert.equal(e.plotWatered(q), false, "not before level 9");
  toLevel(e, "agriculture", 9);
  assert.equal(e.plotWatered(q), true);
  assert.equal(e.wateredOn(q, e.s.day), true);
});

test("making perks: processing a bit faster, cheaper repairs, a little more from scrapping, a spare meal", () => {
  const { e } = make();
  at(e, "farm");
  const job = () => ({ id: "job-t" + Math.random(), recipe: "stew", out: { stew: 1 }, cost: {}, station: "cook", remaining: 100, ready: false });
  e.s.buildings.push({ id: "t-cook", type: "cook", x: 900, y: 300, rotation: 0, hp: 100 });
  const a = job();
  e.c.production.push(a);
  e.processProduction(10);
  const plain = 100 - a.remaining;
  toLevel(e, "manufacturing", 6);
  const b = job();
  e.c.production = [b];
  e.processProduction(10);
  assert.ok(Math.abs(100 - b.remaining - plain * PERK_FX.quick) < 1e-6, "ten percent faster");
  // 省料
  const c5 = e.repairCost("ironspear");
  toLevel(e, "manufacturing", 7);
  const c7 = e.repairCost("ironspear");
  for (const [k, n] of Object.entries(c5)) assert.equal(c7[k], Math.max(1, n - 1), k);
  // 巧手：吃的做好那一下，一成机会多一份
  toLevel(e, "manufacturing", 9);
  let more = 0;
  for (let i = 0; i < 60; i++) {
    const j = { ...job(), id: "job-c" + i, remaining: 1 };
    e.c.production = [j];
    e.processProduction(5);
    assert.ok(j.ready);
    if (j.out.stew > 1) more++;
  }
  assert.ok(more >= 1 && more <= 15, "about one in ten: " + more);
});

test("exploring perks: an extra draw sometimes, a steadier line, a shorter road, a star over good boxes", () => {
  const { e } = make();
  at(e, "residential", 12);
  clearFoes(e);
  const boxes = e.objects.filter((o) => o.type === "crate" && o.ukind && !o.orig);
  assert.ok(boxes.length >= 2);
  const plain = boxes.map((o) => e.rollContainer(o));
  toLevel(e, "exploration", 6);
  const more = boxes.map((o) => e.rollContainer(o));
  for (let i = 0; i < boxes.length; i++) {
    const n0 = Object.values(plain[i].bundle).reduce((a, b) => a + b, 0),
      n1 = Object.values(more[i].bundle).reduce((a, b) => a + b, 0);
    assert.ok(n1 >= n0, "never less");
  }
  // 多翻一样的机会多一成五：很多个柜子里看比例
  let extra = 0;
  for (let k = 0; k < 400; k++) if (e.rollContainer({ ...boxes[0], id: "t-box-" + k }).grMore) extra++;
  assert.ok(extra > 30 && extra < 100, "about 15%: " + extra);
  // 收线：线绷紧得慢一成五
  const tense = (lv) => {
    const { e: f } = make();
    toLevel(f, "exploration", lv);
    f._reel = { water: "pond", sp: "fish", tier: "common", prog: 0.3, tense: 0.1, t: 0, pull: 0, pullT: 0, next: 9, warn: false, held: false, r: () => 0.5 };
    f.reelTick(0.1, true);
    return f._reel.tense - 0.1;
  };
  assert.ok(Math.abs(tense(7) - tense(5) * PERK_FX.reel) < 1e-9);
  assert.ok(REEL_TIERS.common.tense > 0);
  // 认路
  const road = (lv) => {
    const { e: f } = make();
    toLevel(f, "exploration", lv);
    return f.travelBonus(30, "hospital");
  };
  assert.equal(road(8), road(5) - PERK_FX.road);
  // 眼尖：走近了看得出哪个柜子今天有好东西
  toLevel(e, "exploration", 9);
  const p = e.s.player;
  for (const o of boxes) {
    stand(e, o.x, o.y + 40);
    const tier = e.grPeek(o),
      star = e.grStars().some((s) => s.x === o.x && s.y === o.y);
    assert.equal(tier, e.rollContainer(o).tier);
    assert.equal(star, tier === "rare" || tier === "precious", o.id + " " + tier);
  }
  stand(e, p.x + 2000, p.y);
  assert.equal(e.grStars().length, 0, "only when near");
});

test("fighting perks: a cheaper roll, gear wears slower, more off the bodies, a cleared ruin lights one more box", () => {
  const { e } = make();
  at(e, "residential", 12);
  const c5 = e.dodgeCost();
  toLevel(e, "combat", 6);
  assert.equal(e.dodgeCost(), c5 - PERK_FX.roll);
  // 爱惜家伙：五下里有一下不掉
  toLevel(e, "combat", 7);
  arm(e, "ironspear");
  const c = e.cond("ironspear"),
    d0 = c.d;
  for (let i = 0; i < 10; i++) e.wear("ironspear", 1);
  assert.equal(d0 - c.d, 8);
  // 摸尸：单独再掷一次，多一半
  toLevel(e, "combat", 8);
  let extra0 = e.gw.stats.perkLoot;
  for (let i = 0; i < 300; i++) {
    const z = e.enemy("slow", 600, 600);
    z.dead = true;
    e.afterKill(z);
  }
  const got = e.gw.stats.perkLoot - extra0;
  assert.ok(got > 8 && got < 45, "about half of 15%: " + got);
  // 清场
  toLevel(e, "combat", 9);
  at(e, "residential", 12);
  const lit0 = e.ut.lit.residential.ids.length,
    crates0 = e.objects.filter((o) => o.type === "crate").length;
  for (const z of e.enemies) z.dead = true;
  run(e, 0.6);
  assert.equal(e.ut.lit.residential.ids.length, lit0 + 1);
  assert.equal(e.objects.filter((o) => o.type === "crate").length, crates0 + 1);
  run(e, 1);
  assert.equal(e.ut.lit.residential.ids.length, lit0 + 1, "once a day");
});

test("thief perks: calmer neighbours, one more pocket seen, more for hot goods, a wider zone", () => {
  const { e } = make();
  const f0 = e.fenceRate();
  assert.equal(e.pocketsSeen(), 1);
  toLevel(e, "thief", 8);
  assert.equal(e.pocketsSeen(), 2);
  assert.ok(Math.abs(e.fenceRate() - f0 - 0.1) < 1e-9);
  // 怀疑每 5 天消一格
  e.th.sus.farmer = 2;
  e.th.susDay.farmer = e.s.day;
  e.s.day += 5;
  e.onNewDay();
  assert.equal(e.th.sus.farmer, 1);
  // 手快：安全区宽一成
  const zone = (lv) => {
    const { e: g } = make();
    toLevel(g, "thief", lv);
    g.steal = { practice: true, phase: "pick", slots: [{ id: "a", tier: "normal", item: "bread" }], taken: [], roll: 0.3, picks: 0 };
    assert.ok(g.stealPick(0));
    return g.steal.zone.w;
  };
  assert.ok(Math.abs(zone(9) - zone(5) * 1.1) < 1e-9);
});

test("old saves: experience counts, one card says how far it went, no flood of level cards, keepsakes once", () => {
  const old = new Hope.Engine(Hope.freshState(), () => {});
  old.s.xp.combat = MASTER_XP.combat[2] + 5;
  old.s.xp.agriculture = MASTER_XP.agriculture[4] + 1;
  const text = old.serialize();
  assert.ok(!JSON.parse(text).grow);
  assert.equal(needsStoryMigration(text), true);
  const { e } = make(Engine.parse(text));
  run(e, 0.2);
  const cards = moments(e, "intro").filter((m) => m.title === "成长");
  assert.equal(cards.length, 1);
  assert.match(cards[0].lines.join(" "), /战斗直接到了 Lv\.8/);
  assert.match(cards[0].lines.join(" "), /农业直接到了 Lv\.10/);
  assert.equal(moments(e, "master").length, 0, "no level-by-level cards");
  assert.equal(qty(e, decorItem("grHat")), 1);
  run(e, 0.2);
  assert.equal(moments(e, "intro").filter((m) => m.title === "成长").length, 1);
  const back = Engine.parse(e.serialize());
  assert.equal(back.grow.intro.told, true);
  assert.equal(back.grow.lv.combat, 8);
  const { e: again } = make(back);
  run(again, 0.2);
  assert.equal(moments(again, "intro").length + moments(again, "master").length, 0);
  assert.equal(qty(again, decorItem("grHat")), 1, "the keepsake is not given twice");
  // 新开的档：没有这张卡
  const { e: n } = make();
  run(n, 0.2);
  assert.equal(moments(n, "intro").length, 0);
  assert.deepEqual(INTRO_LINES.length, 3);
});

test("saves: the new field is kept and checked; a broken one is refused", () => {
  const { e } = make();
  toLevel(e, "combat", 7);
  e.grChallenge("axeSplit", 3);
  const text = e.serialize();
  const back = Engine.parse(text);
  assert.equal(back.grow.ch.axeSplit, 3);
  for (const breakIt of [(g) => (g.lv = { combat: 99 }), (g) => (g.ch.flying = 1), (g) => (g.l2.w2_deep = { nothing: 1 }), (g) => (g.trip = { region: "moon", boxes: 1, quiet: true, light: true, down: false }), (g) => (g.stats.ups = -1)]) {
    const bad = JSON.parse(text);
    breakIt(bad.grow);
    assert.throws(() => Engine.parse(JSON.stringify(bad)), /成长/);
  }
});

// ================= 武器 =================
test("the spear is cramped only in the old hospital; nothing else changes its numbers there", () => {
  const { e } = make();
  at(e, "residential", 10);
  const open = e.meleeStats("ironspear").range;
  at(e, "hospital", 10);
  assert.equal(e.meleeStats("ironspear").range, open - WEAPON_FX.ironspear.cut);
  assert.equal(e.meleeStats("spear").range, MELEE.spear.range - WEAPON_FX.spear.cut);
  for (const id of ["bat", "crowbar", "sledge", "machete", "axe"]) {
    at(e, "residential", 10);
    const a = e.meleeStats(id).range;
    at(e, "hospital", 10);
    assert.equal(e.meleeStats(id).range, a, id);
  }
  at(e, "tunnel" in REGIONS ? "farm" : "farm", 10);
  assert.equal(e.meleeStats("ironspear").range, open);
  // 拿着长矛进旧医院：当场说一次伸不开（只说一次）
  const { e: f, toasts } = make();
  arm(f, "ironspear");
  at(f, "hospital", 10);
  run(f, 0.2);
  assert.equal(toasts.filter((t) => /病床推车多.+伸不开/.test(t.text)).length, 1);
  at(f, "farm", 11);
  run(f, 0.2);
  at(f, "hospital", 12);
  run(f, 0.2);
  assert.equal(toasts.filter((t) => /病床推车多/.test(t.text)).length, 1, "once");
});

test("fire axe: full damage on armor's front, the plate splits, a split one cannot charge", () => {
  const { e } = make();
  at(e, "hospital", 10);
  clearFoes(e);
  stand(e, 700, 600);
  const z = foe(e, "armor");
  const hp0 = z.hp;
  withRandom(0.99, () => hitWith(e, z, "axe"));
  const dmgAxe = hp0 - z.hp;
  assert.ok(Math.abs(dmgAxe - e.meleeStats("axe").dmg) < 1.5, "front, no cut: " + dmgAxe);
  assert.equal(z.split, true);
  assert.equal(e.updateCharge(z, 0.05), false, "no charge once split");
  // 劈开了以后，铁头矛打它也不减
  const hp1 = z.hp;
  withRandom(0.99, () => hitWith(e, z, "ironspear"));
  assert.ok(Math.abs(hp1 - z.hp - e.meleeStats("ironspear").dmg) < 1.5);
  // 没劈开的：铁头矛正面打掉三成
  const y = foe(e, "armor");
  const h2 = y.hp;
  withRandom(0.99, () => hitWith(e, y, "ironspear"));
  assert.ok(h2 - y.hp < e.meleeStats("ironspear").dmg * 0.8);
  assert.equal(e.gw.ch.axeSplit, 1);
});

test("machete: runners trip, a runner in mid-leap always goes down, half-dead walkers may crawl", () => {
  const { e } = make();
  at(e, "residential", 10);
  clearFoes(e);
  stand(e, 700, 600);
  const r = foe(e, "runner");
  withRandom(0.1, () => hitWith(e, r, "machete"));
  assert.ok(r.stunT >= WEAPON_FX.machete.tripT, "tripped");
  const leap = foe(e, "runner", 50);
  leap.lunge = { phase: "leap", t: 0.2, a: Math.PI };
  withRandom(0.99, () => hitWith(e, leap, "machete"));
  assert.equal(leap.lunge.phase, "stumble", "the leap is stopped");
  assert.ok(leap.stunT > 0);
  const s = foe(e, "slow");
  s.hp = s.maxHp * 0.45;
  withRandom(0.05, () => hitWith(e, s, "machete"));
  assert.ok(s.crawl || s.dead, "below half: may fall to a crawler");
});

test("nail bat: bleeding ones walk at half speed; crowbar: a hit on a wind-up knocks it aside", () => {
  const { e } = make();
  at(e, "residential", 10);
  clearFoes(e);
  stand(e, 700, 600);
  const z = foe(e, "slow");
  const sp0 = e.enemySpeed(z);
  withRandom(0.1, () => hitWith(e, z, "bat"));
  assert.ok(z.bleedT > 0 && z.slowT > 0);
  assert.ok(Math.abs(e.enemySpeed(z) - sp0 * 0.5) < 1e-6);
  const w = foe(e, "slow");
  w.windup = 0.4;
  withRandom(0.99, () => hitWith(e, w, "crowbar"));
  assert.equal(w.windup, 0, "interrupted");
  const v = foe(e, "slow");
  v.windup = 0.4;
  withRandom(0.99, () => hitWith(e, v, "machete"));
  assert.ok(v.windup > 0, "a light blade does not");
});

test("sledge: the blow lands a moment after the click; front blows loosen the warehouse guard's plates", () => {
  const { e } = make();
  at(e, "residential", 10);
  clearFoes(e);
  stand(e, 700, 600);
  const z = foe(e, "slow", 50);
  z.stunT = 5;
  arm(e, "sledge");
  const hp0 = z.hp;
  assert.ok(e.use({ x: z.x, y: z.y - 20 }));
  assert.equal(z.hp, hp0, "not yet");
  run(e, WEAPON_FX.sledge.windup + 0.1);
  assert.ok(z.hp < hp0, "landed");
  // 仓库守卫：正面砸，甲片松了
  at(e, "warehouse", 12);
  clearFoes(e);
  stand(e, 700, 600);
  const g = foe(e, "elite", 60);
  assert.ok(e.isGuard(g));
  for (let i = 0; i < 6 && (g.parts?.armor ?? 150) > 0; i++) withRandom(0.99, () => hitWith(e, g, "sledge"));
  assert.equal(g.parts.armor, 0);
  assert.ok(e.chDone("sledgeGuard"));
});

test("crowbar in hand: a locked cabinet gives one more thing; fire axe in hand chops the storeroom door in 4 s", () => {
  const { e, toasts } = make();
  at(e, "residential", 12);
  clearFoes(e);
  const o = { type: "crate", id: "t-locked", x: 900, y: 640, loot: {}, name: "锁着的铁柜", icon: 40, elite: false, ukind: "locked", odds: "locked", locked: true };
  e.objects.push(o);
  const plain = e.rollContainer(o);
  arm(e, "crowbar");
  stand(e, o.x, o.y + 30);
  assert.ok(e.startPry(o));
  assert.equal(e.ux.pry.grTool, "hand");
  assert.match(e.context(o), /撬锁中/);
  run(e, U.PRY.time + 0.3);
  assert.equal(e.ut.pried[o.id], 12);
  assert.equal(e.gw.ch.crowbarPry, 1);
  const handed = e.rollContainer(o);
  assert.ok(handed.grMore >= 1);
  assert.ok(Object.values(handed.bundle).reduce((a, b) => a + b, 0) > Object.values(plain.bundle).reduce((a, b) => a + b, 0));
  // 储藏室的铁门
  const { e: f, toasts: t2 } = make();
  f.s.day = 12;
  f.ut.evDay = 12;
  f.ut.ev = { day: 12, id: "storeroom", region: "warehouse", spot: 0, st: "wait", bits: 0, spawned: false };
  at(f, "warehouse", 12);
  f.update(0.016, {});
  clearFoes(f);
  const door = f.objects.find((x) => x.type === "uDoor");
  assert.ok(door);
  arm(f, "axe");
  stand(f, door.x, door.y + 30);
  f._picked = door;
  assert.match(f.context(door), /劈开 · 储藏室的铁门（4 秒/);
  f.interact();
  f._picked = null;
  assert.equal(f.ux.pry?.max, WEAPON_FX.axe.door);
  run(f, WEAPON_FX.axe.door + 0.3);
  assert.equal(f.ut.ev.st, "open");
  assert.ok(said(t2, /铁门劈开了/));
  assert.ok(!said(toasts, /undefined/));
});

// ================= 打法挑战 =================
test("challenges: each one counts its own thing, gives its keepsake once and raises the recovery", () => {
  const { e } = make();
  const pct0 = e.rlCompletion().pct;
  for (const id of CHALLENGE_IDS) {
    assert.equal(e.chDone(id), false);
    e.grChallenge(id, CHALLENGES[id].need - 1);
    assert.equal(e.chDone(id), false, id);
    e.grChallenge(id, 1);
    assert.ok(e.chDone(id), id);
    assert.equal(qty(e, decorItem(CHALLENGES[id].decor)), 1, id);
    e.grChallenge(id, 1);
    assert.equal(qty(e, decorItem(CHALLENGES[id].decor)), 1, id + " once");
  }
  assert.equal(moments(e, "challenge").length, CHALLENGE_IDS.length);
  assert.ok(e.rlCompletion().pct > pct0);
  assert.equal(e.rlCompletion().parts.find((p) => p.id === "challenges").have, CHALLENGE_IDS.length);
});

test("challenges in play: a long night held with the machete only, a quiet trip, a light trip, crossbow on screamers, spear braces", () => {
  const { e } = make();
  // 长夜：这一夜亲手打倒的全用砍刀
  e.ln.night = { wave: 1 };
  run(e, 0.1);
  assert.ok(e.gw.night);
  at(e, "farm", e.s.day);
  arm(e, "machete");
  for (let i = 0; i < CHALLENGES.nightBlade.min; i++) {
    const z = foe(e, "slow");
    z.hp = 1;
    withRandom(0.99, () => hitWith(e, z, "machete"));
    assert.ok(z.dead);
  }
  e.ln.night = null;
  e.ln.last = { held: true, waves: 3, boss: true };
  run(e, 0.1);
  assert.ok(e.chDone("nightBlade"));
  // 有一只是别的家伙打的：不算
  const { e: b } = make();
  b.ln.night = { wave: 1 };
  run(b, 0.1);
  at(b, "farm", b.s.day);
  for (let i = 0; i < 20; i++) {
    const z = foe(b, "slow");
    z.hp = 1;
    withRandom(0.99, () => hitWith(b, z, i ? "machete" : "ironspear"));
  }
  b.ln.night = null;
  b.ln.last = { held: true };
  run(b, 0.1);
  assert.equal(b.chDone("nightBlade"), false);
  // 一趟废墟：没惊动、三个柜子、身体栏空着
  const { e: c } = make();
  c.gr.slots.body = null;
  at(c, "residential", 12);
  run(c, 0.1);
  clearFoes(c);
  c.gw.trip.boxes = 3;
  at(c, "farm", 12);
  run(c, 0.1);
  assert.ok(c.chDone("quiet"));
  assert.ok(c.chDone("light"));
  // 倒下被抬回来的不算
  const { e: d } = make();
  at(d, "residential", 12);
  run(d, 0.1);
  d.gw.trip.boxes = 3;
  d.gw.trip.down = true;
  at(d, "farm", 12);
  run(d, 0.1);
  assert.equal(d.chDone("quiet"), false);
  // 弩打尖叫者
  const { e: f } = make();
  at(f, "residential", 12);
  clearFoes(f);
  const s = foe(f, "screamer");
  s.hp = 1;
  f.hurtEnemy(s, 10, Math.PI, { id: "crossbow" });
  assert.equal(f.gw.ch.bolt, 1);
  // 长矛顶住
  arm(f, "ironspear");
  run(f, 0.1);
  f.gr.stats.counters += 3;
  run(f, 0.1);
  assert.equal(f.gw.ch.spearBrace, 3);
});

// ================= 第二年的清单 =================
function withStation(e) {
  at(e, "farm", e.s.day);
  e.s.inventory.wood = 20;
  e.s.inventory.stone = 12;
  e.s.inventory.scrap = 8;
  e.buildMode = "rlStation";
  for (const y of [640, 700, 760, 820, 580])
    for (let x = 220; x <= 1340; x += 40) {
      stand(e, x, y - 60);
      if (!e.buildReason("rlStation", x, y)) {
        assert.ok(e.placeBuilding(x, y));
        const b = e.rlStationB();
        stand(e, b.x, b.y + 50);
        return b;
      }
    }
  throw new Error("no room");
}
test("second-year lists: open from day 29 once a wall's first lists are full; both full lift that place to level II", () => {
  const { e, toasts } = make();
  e.s.day = 20;
  withStation(e);
  const w = "water",
    ids = LIST2_IDS.filter((id) => LISTS2[id].wall === w);
  for (const id of WALL_LISTS[w]) if (!e.rl.done.includes(id)) e.rl.done.push(id);
  e.rl.walls[w] = { by: "list", day: 15 };
  assert.equal(e.list2Open(ids[0]), false, "not before day 29");
  assert.match(e.list2Reason(ids[0], LISTS2[ids[0]].need[0][0]), /第二年/);
  e.s.day = LISTS2_START;
  assert.equal(e.list2Open(ids[0]), true);
  assert.equal(e.list2Open(LIST2_IDS.find((id) => LISTS2[id].wall === "rail")), false, "a wall whose first lists are not full stays shut");
  // 交一格：和第一批一样一声章、那一格闪一下，提示栏里不占一行（只在头顶飘）
  {
    const [k0, n0] = LISTS2[ids[0]].need[0];
    stock(e, { [k0]: 1 });
    e.events.length = 0;
    const t0 = toasts.length;
    assert.ok(e.list2Deliver(ids[0], k0));
    assert.ok(e.events.some((x) => x.type === "stamp" && x.list === ids[0] && x.key === k0));
    assert.equal(e._zStamp.list, ids[0]);
    assert.equal(toasts.length, t0, "one slot is not a line in the bar");
    assert.match(e.effects.at(-1).text, new RegExp("^交了" + ITEMS[k0].name + " ×1（\\d+/\\d+）$"));
    assert.ok(n0 > 1);
  }
  for (const id of ids) {
    for (const [k, n] of LISTS2[id].need) stock(e, { [k]: n });
    for (const [k] of LISTS2[id].need) assert.ok(e.list2Deliver(id, k), id + " " + k);
    assert.ok(e.list2Done(id));
  }
  assert.equal(e.wall2On(w), true, "water lifted to level II for free");
  assert.equal(moments(e, "list2").length, 2);
  assert.equal(e.rlCompletion().parts.find((p) => p.id === "lists2").have, 2);
  // 已经花钱升过二级的那一处：换一件纪念物
  const { e: f } = make();
  f.s.day = 30;
  withStation(f);
  const v = "clinic";
  for (const id of WALL_LISTS[v]) f.rl.done.push(id);
  f.rl.walls[v] = { by: "list", day: 20 };
  f.hp.wall2[v] = 25;
  for (const id of LIST2_IDS.filter((x) => LISTS2[x].wall === v)) {
    for (const [k, n] of LISTS2[id].need) stock(f, k.startsWith("@") ? { [decorItem("neon")]: n } : { [k]: n });
    for (const [k] of LISTS2[id].need) f.list2Deliver(id, k);
  }
  assert.equal(qty(f, decorItem(WALL_KEEPSAKE[v])), 1);
  assert.equal(f.hp.wall2[v], 25, "the bought day is kept");
});

test("the recovery adds two parts; the ending still comes when the original eight are full", () => {
  const { e } = make();
  const C = e.rlCompletion();
  assert.deepEqual(
    C.parts.slice(-2).map((p) => p.id),
    ["challenges", "lists2"],
  );
  assert.ok(C.core !== undefined);
  // 原来八项都满：结尾照常来，收复度还没到 100%
  e.rlCompletion = function () {
    const r = Object.getPrototypeOf(Object.getPrototypeOf(this)).rlCompletion.call(this);
    return this._grCore ? { ...r, pct: 100 } : { ...r, pct: 91 };
  };
  e.rl.finale = 0;
  assert.equal(e.checkFinale(), true);
});

// ================= 页面 =================
const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const UIp = import("../dist/campaign-ui.js");
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const btn = (action, id = "") => ({ dataset: { action, id: String(id) } });

test("pages: the skill page shows levels to ten with their perks; the HUD summary reads the full level", async () => {
  const UI = await UIp;
  const { e } = make();
  toLevel(e, "agriculture", 7);
  toLevel(e, "combat", 10);
  const html = UI.renderSkillPage(e);
  assert.ok(!DEV.test(html), html.match(DEV)?.[0]);
  assert.match(html, /农业<span>Lv\.7<\/span>/);
  assert.match(html, /战斗<span>Lv\.10<\/span>/);
  assert.match(html, /满级/);
  for (const k of Object.keys(PERKS)) for (const p of PERKS[k]) assert.ok(html.includes(p.name), p.name);
  assert.equal((html.match(/gr-perk on/g) || []).length, 2 + 5);
  assert.match(html, /6–10 级不给技能点/);
  for (const k of Object.keys(SKILL_NAMES)) assert.ok(html.includes(SKILL_NAMES[k]));
});

test("pages: the station shows each wall's second-year lists and their buttons work; the collection shows challenges", async () => {
  const UI = await UIp;
  const { e } = make();
  e.s.day = 30;
  withStation(e);
  const w = "water";
  for (const id of WALL_LISTS[w]) e.rl.done.push(id);
  e.rl.walls[w] = { by: "list", day: 15 };
  let html = UI.renderCampaignView(e, { view: "rlStation" });
  assert.ok(!DEV.test(html), html.match(DEV)?.[0]);
  assert.match(html, /第二年的清单/);
  assert.match(html, /深水里的鱼/);
  const [k, n] = LISTS2.w2_deep.need[0];
  stock(e, { [k]: n });
  assert.ok(UI.handleCampaignAction("grL2", btn("grL2", "w2_deep|" + k), ctx(e)));
  assert.equal(e.list2Got("w2_deep", k), n);
  // 还没开的墙：一行说明
  assert.match(html, /第一批清单交满以后开|第二年（第 29 天）起开/);
  html = UI.renderCampaignView(e, { view: "collection" });
  assert.ok(!DEV.test(html), html.match(DEV)?.[0]);
  assert.match(html, /打法挑战/);
  assert.match(html, /砍刀守夜/);
  assert.match(html, /老手（技能 6–10 级）/);
  assert.equal((html.match(/<b>打法挑战<\/b>/g) || []).length, 1, "one row, not two");
});

test("pages: the weapon bench says what each melee weapon is good at; a cramped spear says so in the hospital", async () => {
  const { renderGearBench } = await import("../dist/gear-ui.js");
  const { patchGrowBench } = await import("../dist/grow-ui.js");
  const { e } = make();
  at(e, "farm");
  for (const id of ["ironspear", "axe", "machete", "bat", "crowbar", "sledge"]) e.s.storage[id] = 1;
  const html = patchGrowBench(e, renderGearBench(e, { icon: () => "" }));
  assert.ok(!DEV.test(html), html.match(DEV)?.[0]);
  for (const id of ["ironspear", "axe", "machete", "bat", "crowbar", "sledge"]) assert.ok(html.includes(WEAPON_USE[id].replace(/^擅长：/, "擅长 · ")), id);
  at(e, "hospital", 10);
  e.s.inventory.ironspear = 1;
  assert.match(patchGrowBench(e, renderGearBench(e, { icon: () => "" })), /现在这里伸不开/);
});
