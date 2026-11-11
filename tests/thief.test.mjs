import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState } from "./pre-trim.mjs";
import { Engine as DailyEngine, freshState as dailyFresh } from "../dist/daily.js";
import { TASKS } from "../dist/rebuild-data.js";
import { ITEMS, BUILDINGS, CROPS } from "../dist/data.js";
import { EVENTS, EVENT_IDS, MODS, RARE_SEEDS } from "../dist/daily-data.js";
import { TALENTS, TALENT_IDS, TARGETS, TREASURES, TREASURE_IDS, TIERS, VALUE_CAP, THIEF_SPOTS, BOXES, JOBS, MANUALS, JUNK_IDS, THIEF_EVENT_IDS } from "../dist/thief-data.js";

const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const make = (state = freshState()) => {
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  return { e, toasts };
};
const go = (e, region) => {
  if (e.s.region !== region) {
    e.s.region = region;
    e.enemies = e.s.enemies[region] ||= [];
    e.assignRegion();
  }
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
const stock = (e, items) => {
  for (const [k, v] of Object.entries(items)) e.s.storage[k] = (e.s.storage[k] || 0) + v;
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
  if (n >= 4) e.o.hospital = "water";
  if (n >= 5) Object.assign(e.o, { youke: true, lathe: { mode: "parts", day: 0 } });
  if (n >= 7) {
    e.r.radio = true;
    e.o.toll = "refuse";
    e.o.raid.phase = "won";
  }
  e.assignRegion();
}
// 一个能偷的局面：第九段、三位居民、给够技能点、学会顺手牵羊
function thiefGame(talents = ["pickpocket"], xp = 0) {
  const { e, toasts } = make();
  toAct(e, 9);
  for (const id of ["farmer", "medic", "mechanic"]) if (!e.resident(id)) e.recruit(id);
  e.s.day = 12;
  e.s.minute = 10 * 60;
  e.dy.pending = null;
  e.sk.thiefXp = xp;
  for (const k of ["agriculture", "manufacturing", "exploration", "combat"]) e.s.xp[k] = 160;
  for (const t of talents) assert.ok(e.learnTalent(t), "learn " + t);
  go(e, "farm");
  e.assignRegion();
  return { e, toasts };
}
const resident = (e, id) => e.objects.find((o) => o.type === "resident" && o.resident === id);
const behind = (e, ob) => {
  Object.assign(e.s.player, { x: ob.x + 4, y: ob.y - 46 });
  e.f.crouch = true;
};
// 换种子，直到这一次下手的运气满足条件
function seedFor(e, key, pred) {
  for (let s = 1; s < 20000; s++) {
    e.th.seed = s;
    if (pred(e.stealRoll(key))) return s;
  }
  throw Error("no seed");
}
// 摆到安全区里再按
function hitZone(e) {
  const st = e.steal;
  for (let i = 0; i < 400 && st.phase === "swing"; i++) {
    if (st.marker > st.zone.a + 0.005 && st.marker < st.zone.a + st.zone.w - 0.005) return e.stealPress();
    e.stealTick(0.01);
  }
  return false;
}
function missZone(e) {
  const st = e.steal;
  for (let i = 0; i < 400 && st.phase === "swing"; i++) {
    if (st.marker < st.zone.a - 0.03 || st.marker > st.zone.a + st.zone.w + 0.03) return e.stealPress();
    e.stealTick(0.01);
  }
  return true;
}
const finite = (v, path = "s") => {
  if (typeof v === "number") assert.ok(Number.isFinite(v), "non-finite number at " + path);
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) finite(x, path + "." + k);
};
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const btn = (action, id = "") => ({ dataset: { action, id } });

// ================= 数据 =================
test("data: 26 talents in five skills, 20 treasures with real owners, pockets made of real items", () => {
  assert.equal(TALENT_IDS.length, 26);
  const by = {};
  for (const t of Object.values(TALENTS)) by[t.skill] = (by[t.skill] || 0) + t.cost;
  assert.deepEqual(by, { agriculture: 7, manufacturing: 7, exploration: 7, combat: 7, thief: 20 });
  assert.equal(TREASURE_IDS.length, 20);
  for (const [id, tr] of Object.entries(TREASURES)) {
    assert.equal(TARGETS[tr.owner].treasure, id, id);
    for (const k of Object.keys(tr.effect.items || {})) assert.ok(ITEMS[k], id + " " + k);
    for (const k of Object.keys(tr.effect.fallback || {})) assert.ok(ITEMS[k], id + " " + k);
    if (tr.effect.stash) assert.ok(THIEF_SPOTS.stash[tr.effect.stash], id);
    assert.doesNotMatch(tr.name + tr.text, FORBIDDEN);
  }
  for (const id of JUNK_IDS) assert.ok(ITEMS[id] && !ITEMS[id].protected);
  for (const [id, m] of Object.entries(MANUALS)) assert.ok(ITEMS[id]?.protected && JOBS[m.job]);
  assert.equal(THIEF_EVENT_IDS.length, 7);
  for (const id of THIEF_EVENT_IDS) assert.ok(EVENT_IDS.includes(id) && EVENTS[id].cat === "thief");
});

// ================= 技能点 =================
test("skill points come from levels and story acts, so old saves are topped up without bookkeeping", () => {
  const old = new DailyEngine(dailyFresh(), () => {});
  old.s.xp.agriculture = 80; // 3 级
  old.s.xp.combat = 40; // 2 级
  toAct(old, 4); // 完成三段
  const raw = old.serialize();
  assert.ok(!JSON.parse(raw).skills && !JSON.parse(raw).theft);
  const { e } = make(Engine.parse(raw));
  assert.deepEqual(e.skillPoints(), { earned: 2 + 1 + 3, spent: 0, free: 6 });
  assert.equal(e.level("thief"), 1);
  assert.ok(e.th.seed > 0);
  // 满级满段：一局最多 28 点
  const { e: f } = make();
  f.sc.act = 9;
  for (const k of ["agriculture", "manufacturing", "exploration", "combat"]) f.s.xp[k] = 999;
  f.sk.thiefXp = 999;
  assert.equal(f.skillPoints().earned, 28);
});


test("farming, crafting, exploring and fighting talents each change the game", () => {
  const { e } = make();
  e.sc.act = 9;
  for (const k of ["agriculture", "manufacturing", "exploration", "combat"]) e.s.xp[k] = 999;
  e.sk.thiefXp = 999;
  // 背包、加工、受伤、枪
  const cap = e.capacity();
  e.sk.talents = ["packer", "toughBone", "steadyAim", "finisher"];
  assert.equal(e.capacity(), cap + 4);
  const gun = Object.keys(ITEMS).find((id) => e.weaponStats(id)?.mag);
  const melee = Object.keys(ITEMS).find((id) => e.weaponStats(id) && !e.weaponStats(id).mag && e.weaponStats(id).damage);
  e.sk.talents = [];
  const g0 = e.weaponStats(gun).damage,
    m0 = e.weaponStats(melee).damage;
  e.sk.talents = ["steadyAim", "finisher"];
  assert.ok(Math.abs(e.weaponStats(gun).damage - g0 * 1.1) < 1e-9);
  assert.ok(Math.abs(e.weaponStats(melee).damage - m0 * 1.25) < 1e-9);
  // 受伤
  e.sk.talents = [];
  e.s.player.hp = 100;
  e.invulnerable = 0;
  e.damagePlayer(20);
  const plain = 100 - e.s.player.hp;
  e.s.player.hp = 100;
  e.invulnerable = 0;
  e.sk.talents = ["toughBone"];
  e.damagePlayer(20);
  assert.ok(100 - e.s.player.hp < plain);
  // 路上：识途少 5 分钟
  e.sk.talents = [];
  go(e, "farm");
  let t = e.s.day * 1440 + e.s.minute;
  e.travel("hospital");
  const base = e.s.day * 1440 + e.s.minute - t;
  e.travel("farm");
  e.sk.talents = ["pathfinder"];
  t = e.s.day * 1440 + e.s.minute;
  e.travel("hospital");
  assert.equal(e.s.day * 1440 + e.s.minute - t, Math.max(1, base - 5));
  e.travel("farm");
  // 引水 + 勤保养：清晨 07:00
  e.sk.talents = ["irrigate", "upkeep"];
  const dry = e.s.plots.filter((p) => !p.crop).slice(0, 4);
  for (const p of dry) Object.assign(p, { tilled: true, crop: "radish", growth: 0, wateredDay: 0, waterUnits: 0 });
  e.s.buildings.push({ id: "bT", type: "fence", x: 200, y: 900, rotation: 0, hp: 10 });
  nextDay(e);
  hour(e, 7);
  assert.equal(dry.filter((p) => e.plotWatered(p)).length >= 3, true);
  assert.ok(e.s.buildings.find((b) => b.id === "bT").hp > 10);
  // 收获：老把式省体力，好收成多 1 份，留种每三株一颗
  e.sk.talents = ["bumper", "keepSeed", "oldHand"];
  const crop = "radish",
    seed = CROPS[crop].seed;
  let seeds = 0;
  for (let i = 0; i < 3; i++) {
    const p = dry[i];
    Object.assign(p, { crop, growth: CROPS[crop].grow, trait: null });
    const n0 = e.stockOf(crop),
      s0 = e.stockOf(seed);
    assert.ok(e.harvest(p));
    assert.ok(e.stockOf(crop) - n0 >= CROPS[crop].yield + 1);
    seeds += e.stockOf(seed) - s0;
  }
  assert.equal(seeds, 1);
  // 废料回收：撬棍拆货架多 1 废金属
  e.sk.talents = ["scrapper"];
  e.s.inventory.crowbar = 1;
  e.c.toolLevel = 3;
  go(e, "residential");
  const shelf = e.objects.find((o) => o.type === "salvage" && o.level <= 3);
  const sc0 = e.stockOf("scrap");
  e._lastLoot = null;
  if (shelf && e.salvageObject(shelf)) assert.equal(e.stockOf("scrap") - sc0, ((e._lastLoot || shelf.loot).scrap || 0) + 1);
  // 留得青山：倒下丢的东西减半
  e.sk.talents = ["survivor"];
  e.s.inventory.cloth = 10;
  e.s.outing = { cloth: 10 };
  e.die();
  assert.equal(e.s.inventory.cloth, 10 - 2);
});

test("the steady hand halves rush accidents and suppression stops a raider's shot", () => {
  const { e } = make();
  e.sc.act = 9;
  e.s.xp.manufacturing = 999;
  e.s.xp.combat = 999;
  e.sk.talents = ["steadyHand", "suppress"];
  let rolled = 0;
  e.roll = () => {
    rolled++;
    return 0.2; // 0.2 < 0.3 会出事故；手稳把它变成 0.4，不出事
  };
  e.s.inventory.radish = 6;
  e.c.production.length = 0;
  if (e.craft("trailBread")) {
    const job = e.c.production[0];
    job.remaining = 60;
    e.rushJob(job.id);
    assert.equal(e.o.incidents.length, 0);
    assert.ok(rolled > 0);
  }
  delete e.roll;
  assert.equal(Object.hasOwn(e, "roll"), false, "the roll is put back");
  const raider = e.enemy("slow", 300, 300);
  raider.type = "raider";
  raider.hp = 999;
  raider.aim = 0.5;
  raider.cooldown = 0;
  e.enemies.push(raider);
  e.hurtEnemy(raider, 5, 0, {});
  assert.equal(raider.aim, 0);
  assert.ok(raider.cooldown >= 2);
});

// ================= 偷盗 =================
test("without the opener nothing can be stolen; crouched E on a person opens the preview", () => {
  const { e } = make();
  toAct(e, 3);
  e.recruit("farmer");
  go(e, "farm");
  const ob = resident(e, "farmer");
  behind(e, ob);
  assert.equal(e.stealReason("farmer").includes("顺手牵羊"), true);
  e.events = [];
  e.interact();
  assert.ok(!e.events.some((ev) => ev.view === "stealPrep"));
  e.s.xp.agriculture = 40;
  assert.ok(e.learnTalent("pickpocket"));
  e.events = [];
  e.interact();
  assert.ok(e.events.some((ev) => ev.type === "menu" && ev.view === "stealPrep" && ev.id === "farmer"));
  assert.match(e.context(ob), /阿禾 · 下手/);
  e.f.crouch = false;
  assert.doesNotMatch(e.context(ob), /下手/);
});

test("the odds read position, sleep, work, night, idle onlookers, alertness and suspicion, capped per tier", () => {
  const { e } = thiefGame(["pickpocket", "seeThrough"]);
  const ob = resident(e, "farmer");
  behind(e, ob);
  const a = e.stealOdds("farmer", ob);
  Object.assign(e.s.player, { x: ob.x, y: ob.y + 46 });
  const b = e.stealOdds("farmer", ob);
  assert.equal(a.P - b.P, 50, "behind +20, front −30");
  behind(e, ob);
  e.s.minute = 23.5 * 60;
  const n = e.stealOdds("farmer", ob);
  assert.ok(n.sleeping && n.parts.some(([l]) => l === "他睡着了") && n.parts.some(([l]) => l === "深夜"));
  e.s.minute = 19 * 60; // 闲着：别的人会看着你
  const idle = e.stealOdds("farmer", ob);
  assert.ok(idle.parts.some(([l, v]) => /闲着的人/.test(l) && v < 0));
  e.s.minute = 10 * 60;
  assert.ok(!e.stealOdds("farmer", ob).parts.some(([l]) => /闲着的人/.test(l)), "busy workers do not watch");
  e.th.sus.farmer = 3;
  const s = e.stealOdds("farmer", ob);
  assert.ok(s.P <= a.P - 60);
  assert.equal(s.byTier.normal, 5);
  e.th.sus.farmer = 0;
  e.s.minute = 23.5 * 60;
  e.sk.thiefXp = 4 * 60;
  const hi = e.stealOdds("farmer", ob, { distract: true });
  assert.equal(hi.byTier.normal, 90);
  assert.equal(hi.byTier.important, 75);
  assert.equal(hi.byTier.treasure, 55);
  e.sk.talents.push("planHand");
  assert.equal(e.stealOdds("farmer", ob, { distract: true }).byTier.treasure, 70);
});

test("pockets are fixed for the week (also after reloading), refill next week, and gate by level and value", () => {
  const { e } = thiefGame();
  const a = JSON.stringify(e.pockets("farmer"));
  const { e: f } = make(Engine.parse(e.serialize()));
  assert.equal(JSON.stringify(f.pockets("farmer")), a);
  assert.ok(e.pockets("farmer").length >= 3);
  e.s.day += 7;
  assert.notEqual(JSON.stringify(e.pockets("farmer")), a);
  // 档与价值
  const imp = { id: "x", tier: "important", item: "medkit", n: 1 };
  assert.match(e.slotReason(imp), /妙手要到 3 级/);
  e.sk.thiefXp = 2 * 60;
  assert.equal(e.slotReason(imp), "");
  assert.match(e.slotReason({ id: "y", tier: "important", item: "coins", n: 95 }), /手还不够稳/);
  assert.match(e.slotReason({ id: "z", tier: "treasure", item: "gunPlans", n: 1 }), /4 级/);
  assert.equal(VALUE_CAP.length, 6);
});

test("a clean theft: hit the zone, take it home, one try per person per day, no double rewards", () => {
  const { e } = thiefGame(["pickpocket", "seeThrough"]);
  const ob = resident(e, "farmer");
  behind(e, ob);
  seedFor(e, "farmer", (r) => r < 0.1);
  const slots = e.pockets("farmer");
  const i = slots.findIndex((s) => s.tier !== "important");
  const money0 = e.s.money,
    stock0 = e.stockOf(slots[i].item);
  const st = e.startSteal("farmer");
  assert.equal(st.phase, "pick");
  assert.ok(e.stealPick(i));
  assert.equal(st.phase, "swing");
  assert.ok(hitZone(e));
  assert.equal(st.taken.length, 1);
  const r = e.stealStop();
  assert.ok(r.win);
  const s = slots[i];
  if (s.item === "coins") assert.equal(e.s.money - money0, s.n);
  else if (s.item !== "letter") assert.equal(e.stockOf(s.item) - stock0, s.n);
  assert.ok(e.sk.thiefXp >= TIERS[s.tier].xp);
  assert.ok(!e.pockets("farmer").some((x) => x.id === s.id), "the slot is gone until next week");
  assert.match(e.stealReason("farmer"), /今天已经/);
  assert.equal(e.startSteal("farmer"), null);
  // 读档后不能再拿一次
  const { e: f } = make(Engine.parse(e.serialize()));
  assert.ok(!f.pockets("farmer").some((x) => x.id === s.id));
  assert.match(f.stealReason("farmer"), /今天已经/);
  for (const line of r.lines) assert.doesNotMatch(line, FORBIDDEN);
});

test("greed costs: misses and full attention get you caught and everything drops", () => {
  const { e } = thiefGame(["pickpocket", "seeThrough"]);
  const ob = resident(e, "medic");
  behind(e, ob);
  seedFor(e, "medic", (r) => r < 0.1);
  const st = e.startSteal("medic");
  const money0 = e.s.money;
  e.stealPick(0);
  assert.ok(hitZone(e));
  const a1 = st.attention;
  e.stealPick(1);
  missZone(e);
  assert.ok(st.attention >= a1 + 0.39, "a miss adds 40%");
  // 什么都不做，等注意力满
  for (let i = 0; i < 1000 && ["pick", "swing"].includes(st.phase); i++) e.stealTick(0.05);
  assert.equal(st.phase, "caught");
  assert.equal(e.s.money, money0, "nothing from this attempt is kept");
  assert.ok(e.th.pending);
  assert.equal(e.th.sus.medic, 1);
  assert.ok(e.th.cool.medic > e.s.day);
  // 轻手：第一次手抖只涨一半
  const { e: g } = thiefGame(["pickpocket", "lightHand"]);
  const o2 = resident(g, "farmer");
  behind(g, o2);
  seedFor(g, "farmer", (r) => r < 0.1);
  const s2 = g.startSteal("farmer");
  g.stealPick(0);
  const before = s2.attention;
  missZone(g);
  assert.ok(s2.attention - before < 0.25);
});



test("stolen goods: no shipping box or market, a fence pays 35% (70% with the talent), the mark wears off", () => {
  const { e } = thiefGame(["pickpocket", "fence"], 3 * 60);
  e.s.inventory.bread = 0;
  e.receive({ bread: 3 });
  e.th.hot = [{ item: "bread", n: 3, until: e.s.day + 7 }];
  assert.equal(e.hotCount("bread"), 3);
  e.s.storage.bread = 0;
  assert.equal(e.shipItem("bread", 3), false);
  assert.equal(e.trade("food", "bread", 1, "sell"), false);
  // 不是赃物的部分照常
  e.s.inventory.bread = 5;
  assert.ok(e.shipItem("bread", 2));
  e.s.minute = 19 * 60;
  const fence = e.fences().find((f) => f.id === "rat");
  assert.ok(fence.open);
  const m0 = e.s.money;
  assert.ok(e.sellHot("bread", "rat"));
  assert.equal(e.s.money - m0, Math.round(ITEMS.bread.sell * 3 * 0.7));
  assert.equal(e.hotCount("bread"), 0);
  e.th.hot = [{ item: "cloth", n: 1, until: e.s.day }];
  e.s.inventory.cloth = 1;
  nextDay(e);
  assert.equal(e.hotItems().length, 0);
});

test("treasures: a rumour lights the slot, one miss loses it for good, a hit makes the leap", () => {
  const { e } = thiefGame(["pickpocket", "seeThrough", "lightHand"], 4 * 60);
  e.th.seen.farmer = 1;
  assert.ok(!e.pockets("farmer").some((s) => s.tier === "treasure"), "hidden until heard of");
  e.revealRumor("farmer");
  assert.equal(e.th.treasures.heirloomSeeds, "known");
  const ob = resident(e, "farmer");
  behind(e, ob);
  e.s.minute = 23.5 * 60;
  seedFor(e, "farmer", (r) => r < 0.05);
  let st = e.startSteal("farmer");
  const i = st.slots.findIndex((s) => s.tier === "treasure");
  assert.ok(i >= 0);
  e.stealPick(i);
  missZone(e);
  assert.equal(e.th.treasures.heirloomSeeds, "lost");
  e.stealStop();
  assert.ok(!e.pockets("farmer").some((s) => s.tier === "treasure"));
  // 另一件：命中就解锁
  const { e: g } = thiefGame(["pickpocket", "seeThrough", "lightHand", "planHand"], 4 * 60);
  g.sk.thiefXp = 4 * 60;
  g.th.treasures.genBlueprint = "known";
  delete g.c.technologies.solar;
  const o2 = resident(g, "mechanic");
  behind(g, o2);
  g.s.minute = 23.5 * 60;
  seedFor(g, "mechanic", (r) => r < 0.05);
  st = g.startSteal("mechanic");
  const k = st.slots.findIndex((s) => s.tier === "treasure");
  g.stealPick(k);
  assert.ok(hitZone(g));
  const res = g.stealStop();
  assert.equal(g.th.treasures.genBlueprint, "taken");
  assert.equal(g.c.technologies.solar, true);
  assert.ok(res.lines.some((l) => /宝贝/.test(l)));
  // 营地里的人第二天发现，出“失窃案”
  assert.ok(g.th.discovery);
  nextDay(g);
  const ids = g.candidates(g.s.day).map((c) => c.id);
  assert.ok(ids.includes("T04"));
});

test("every treasure's effect is real: items, tech, flags and stashes that open once", () => {
  for (const id of TREASURE_IDS) {
    const { e } = thiefGame(["pickpocket"]);
    const lines = e.takeTreasure(id);
    assert.ok(lines.length >= 2, id);
    assert.equal(e.th.treasures[id], "taken");
    assert.deepEqual(e.takeTreasure(id), [], id + " only once");
    for (const l of lines) assert.doesNotMatch(l, FORBIDDEN, id);
    assert.ok(Engine.parse(e.serialize()), id);
  }
  // 藏货点：站得住、只开一次
  const { e } = thiefGame(["pickpocket"]);
  e.takeTreasure("supplyMap");
  e.takeTreasure("armyList");
  for (const st of [...e.th.stashes]) {
    go(e, st.region);
    assert.equal(e.blocked(st.x, st.y, false, 14), false, st.id);
    const ob = e.objects.find((o) => o.type === "thiefStash" && o.stash === st.id);
    assert.ok(ob);
    const before = JSON.stringify(e.s.inventory) + JSON.stringify(e.s.storage);
    Object.assign(e.s.player, { x: ob.x, y: ob.y + 20 });
    e.interact();
    assert.notEqual(JSON.stringify(e.s.inventory) + JSON.stringify(e.s.storage), before);
    assert.ok(!e.objects.some((o) => o.type === "thiefStash" && o.stash === st.id));
  }
  // 情报类：唐九打八折、林姨便宜、鹞子的暗号、地道、拨款
  const { e: f } = thiefGame(["pickpocket"]);
  const p0 = f.price("food", "bread", "buy");
  f.takeTreasure("purchaseList");
  assert.ok(f.price("food", "bread", "buy") < p0);
  const size0 = f.raidSize();
  f.takeTreasure("raidCodes");
  assert.ok(f.raidSize() <= Math.max(2, Math.floor(size0 / 2)));
  f.takeTreasure("tunnelMap");
  go(f, "farm");
  const t = f.s.day * 1440 + f.s.minute;
  f.travel("warehouse");
  assert.equal(f.s.day * 1440 + f.s.minute - t, 1);
  f.takeTreasure("grantSlip");
  const m = f.s.money;
  while (f.s.day % 7 !== 0) nextDay(f);
  hour(f, 7);
  assert.ok(f.s.money >= m + 60);
});


test("the practice dummy trains only up to level two; lockboxes need the talent and open once a week", () => {
  const { e } = thiefGame(["pickpocket"]);
  go(e, "farm");
  const dummy = e.objects.find((o) => o.type === "thiefDummy");
  assert.ok(dummy);
  assert.equal(e.blocked(dummy.x, dummy.y, false, 14), false);
  Object.assign(e.s.player, { x: dummy.x, y: dummy.y + 24 });
  e.f.crouch = false;
  e.events = [];
  e.interact();
  assert.ok(e.steal?.practice);
  e.stealPick(0);
  hitZone(e);
  e.stealStop();
  assert.equal(e.sk.thiefXp, 2);
  assert.equal(e.startPractice(), null, "once a day");
  e.sk.thiefXp = 59;
  nextDay(e);
  hour(e, 9);
  e.startPractice();
  e.stealPick(0);
  hitZone(e);
  e.stealPick(1);
  hitZone(e);
  e.stealStop();
  assert.equal(e.sk.thiefXp, 60, "the dummy stops at level two");
  // 钱箱
  assert.match(e.boxReason("linyi"), /开锁/);
  e.sk.thiefXp = 3 * 60;
  e.s.xp.agriculture = 999;
  assert.ok(e.learnTalent("lockpick"));
  go(e, "market");
  const box = e.objects.find((o) => o.type === "thiefBox" && o.box === "linyi");
  assert.ok(box);
  assert.equal(e.blocked(box.x, box.y, false, 14), false);
  seedFor(e, "box:linyi", (r) => r < 0.05);
  const st = e.startBox("linyi");
  assert.ok(st && st.slots.every((s) => s.tier !== "junk"));
  e.stealStop();
  assert.match(e.boxReason("linyi"), /这周已经撬过了/);
});

test("planting: slip bread into a pocket, or put the family photo back", () => {
  const { e } = thiefGame(["pickpocket"], 4 * 60);
  e.sk.talents.push("plant");
  e.s.xp.combat = 999;
  stock(e, { bread: 2 });
  const ob = resident(e, "farmer");
  behind(e, ob);
  e.th.sus.farmer = 1;
  seedFor(e, "plant:farmer", (r) => r < 0.05);
  const r = e.plant("farmer", "bread");
  assert.ok(r.win);
  assert.equal(e.th.sus.farmer, 0);
  assert.match(e.stealReason("farmer"), /今天已经/);
  e.takeTreasure("familyPhoto");
  assert.ok(e.plantOptions("qin").some((o) => o.id === "photo"));
});

test("the morning after: guilt costs stamina, 彭姐 notices, suspicion fades after a quiet week", () => {
  const { e } = thiefGame(["pickpocket"]);
  e.th.guilt = e.s.day + 1;
  e.th.flags.pengNotice = e.s.day + 1;
  e.th.sus.farmer = 2;
  e.th.susDay.farmer = e.s.day;
  const rel = e.fr.peng.relation || 0;
  nextDay(e);
  e.s.player.stamina = 100;
  hour(e, 7);
  assert.equal(e.s.player.stamina, 80);
  assert.equal(e.fr.peng.relation, Math.max(-10, rel - 2));
  for (let i = 0; i < 7; i++) nextDay(e);
  assert.equal(e.th.sus.farmer, 1);
});



test("saves: v0.18 saves load, corrupted theft fields are refused, random play stays finite", () => {
  const { e } = thiefGame(["pickpocket"]);
  for (const bad of [
    (x) => (x.skills.talents = ["seeThrough"]),
    (x) => (x.skills.talents = ["nope"]),
    (x) => (x.skills.thiefXp = -5),
    (x) => (x.theft.treasures = { constructor: "known" }),
    (x) => (x.theft.sus = { farmer: 7 }),
    (x) => (x.theft.hot = [{ item: "gold", n: 1, until: 3 }]),
    (x) => (x.theft.flags = { magic: true }),
    (x) => (x.theft.pending = { target: "farmer" }),
    (x) => (x.theft.stashes = [{ id: "moon", region: "farm", x: 1, y: 1, label: "x", items: {} }]),
    (x) => (x.theft.extra = 1),
  ]) {
    const raw = JSON.parse(e.serialize());
    bad(raw);
    assert.throws(() => Engine.parse(JSON.stringify(raw)), /技能存档异常|妙手存档异常/);
  }
  // 随机下手几十次：数值有限、存档能读
  const { e: g } = thiefGame(["pickpocket", "seeThrough", "lightHand"], 4 * 60);
  g.takeTreasure("tunnelMap");
  let tries = 0;
  for (let d = 0; d < 20; d++) {
    for (const o of g.objects.filter((ob) => g.targetOf(ob))) {
      const t = g.targetOf(o);
      if (g.stealReason(t.id)) continue;
      Object.assign(g.s.player, { x: o.x + ((d % 3) - 1) * 40, y: o.y + ((d % 2) * 2 - 1) * 46 });
      g.f.crouch = d % 2 === 0;
      const st = g.startSteal(t.id);
      if (!st) continue;
      tries++;
      for (let k = 0; k < st.slots.length && st.phase === "pick"; k++) {
        if (g.stealPick(k) && st.phase === "swing") (k + d) % 2 ? hitZone(g) : missZone(g);
      }
      if (["pick", "swing"].includes(st.phase)) g.stealStop();
      if (g.th.pending) g.resolveCaught(d % 2);
      g.steal = null;
    }
    nextDay(g);
    hour(g, 10);
    finite(g.s);
    assert.ok(Engine.parse(g.serialize()));
  }
  assert.ok(tries > 10);
});

// ================= 审查后补的回归 =================


