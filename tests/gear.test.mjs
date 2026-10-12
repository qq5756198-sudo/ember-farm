// v0.22.0「披挂」：前期感染者加强 + 装备与防具
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState } from "../dist/campaign.js";
import { Engine as GardenEngine, freshState as gardenFresh } from "../dist/garden.js";
import { ITEMS, RECIPES, WEAPONS, ZOMBIES, REGIONS } from "../dist/data.js";
import { EVENTS } from "../dist/daily-data.js";
import { TREASURES } from "../dist/thief-data.js";
import { KEY_ACTIONS } from "../dist/farlands-data.js";
import {
  ZSTATS,
  RULES,
  ARMOR,
  MELEE,
  RANGED,
  THROWN,
  TRAPS,
  RUIN_PACKS,
  DISTRICT_EXTRA,
  GEAR_SPOTS,
  BLUEPRINTS,
  BP_IDS,
  OLD_SAVE_GIFT,
  INFECTION,
  REPAIR,
  SUMMON,
  GEAR_CARD_IDS,
  GEAR_ICON_IDS,
  MODS,
  ARMOR_CAP,
  WEIGHT_TIERS,
  phaseOf,
  slotOf,
} from "../dist/gear-data.js";
import { renderCampaignView, campaignTitle, handleCampaignAction, renderGearPanel, gearUI, stationExtras, gearStatusHtml, renderManualPlus, gearDetailHtml } from "../dist/campaign-ui.js";
import { renderGearBench } from "../dist/gear-ui.js";

const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const make = (state = freshState()) => {
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  return { e, toasts };
};
// 进一张图：重新摆感染者
const go = (e, region) => {
  e.s.region = region;
  delete e.s.enemies[region];
  e.assignRegion();
};
// 空图：只留自己摆的感染者
const arena = (e, region = "residential") => {
  e.s.region = region;
  e.s.enemies[region] = [];
  e.assignRegion();
  e.enemies.length = 0;
  Object.assign(e.s.player, { x: 700, y: 520, facing: 0, stamina: 100, hp: 100 });
  e.s.minute = 12 * 60;
  return e;
};
const spawn = (e, type, dx, dy, extra = {}) => {
  const p = e.s.player,
    z = e.enemy(type, p.x + dx, p.y + dy);
  Object.assign(z, { state: "chase", alert: 8, targetX: p.x, targetY: p.y, facing: Math.atan2(-dy, -dx) }, extra);
  e.enemies.push(z);
  return z;
};
const tick = (e, seconds, input = { x: 0, y: 0, run: false }) => {
  for (let t = 0; t < seconds; t += 0.05) e.update(0.05, input);
};
// 固定随机数
function withRandom(v, fn) {
  const real = Math.random;
  Math.random = typeof v === "function" ? v : () => v;
  try {
    return fn();
  } finally {
    Math.random = real;
  }
}
const btn = (action, id = "") => ({ dataset: { action, id } });
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const bench = (e) => {
  e.s.region = "farm";
  e.assignRegion();
  if (!e.s.buildings.some((b) => b.type === "weaponbench")) e.s.buildings.push({ id: "wb-test", type: "weaponbench", x: 900, y: 640, hp: 100, rotation: 0 });
};
const oldSave = (day = 1) => {
  const s = gardenFresh();
  s.day = day;
  delete s.gear;
  return s;
};

// ================= 数据 =================
test("data: 19 armour pieces in five slots, 20 weapons, three phases, unique icons and blueprints", () => {
  assert.equal(Object.keys(ARMOR).length, 19);
  for (const slot of ["head", "body", "hands", "legs", "feet"]) assert.ok(Object.values(ARMOR).some((a) => a.slot === slot), slot);
  assert.equal(Object.keys(MELEE).length + Object.keys(RANGED).length + Object.keys(THROWN).length + Object.keys(TRAPS).length, 20);
  assert.deepEqual([phaseOf(1), phaseOf(3), phaseOf(4), phaseOf(7), phaseOf(8), phaseOf(40)], [0, 0, 1, 1, 2, 2]);
  assert.equal(ZSTATS.length, 3);
  for (const ph of ZSTATS) assert.ok(ph.slow.hp < ph.armor.hp && ph.runner.speed > ph.slow.speed);
  assert.ok(ZSTATS[0].slow.hp > ZOMBIES.slow.hp * 1.25, "slow infected are tougher than before from day one");
  // 每件新物品都有名字、说明、小图（"g" 开头的编号不重复）
  const icons = new Set();
  for (const id of GEAR_ICON_IDS) {
    assert.ok(ITEMS[id], id);
    assert.ok(ITEMS[id].name && ITEMS[id].desc, id);
    assert.match(String(ITEMS[id].icon), /^g\d+$/, id);
    assert.ok(!icons.has(ITEMS[id].icon), "icon unique " + id);
    icons.add(ITEMS[id].icon);
    assert.doesNotMatch(ITEMS[id].name + ITEMS[id].desc, FORBIDDEN, id);
  }
  assert.equal(BP_IDS.length, 7);
  for (const bp of BP_IDS) {
    assert.equal(ITEMS[bp].type, "blueprint");
    for (const m of BLUEPRINTS[bp].makes) assert.ok(RECIPES.some((r) => r.out[m] && r.unlock === "bp:" + bp), bp + " gates " + m);
  }
  // 所有配方的材料和产出都是真物品
  for (const r of RECIPES) for (const id of [...Object.keys(r.cost), ...Object.keys(r.out)]) assert.ok(ITEMS[id], r.id + " " + id);
  // 装备卡：六张，三个选项，至少一个免费
  assert.equal(GEAR_CARD_IDS.length, 6);
  for (const id of GEAR_CARD_IDS) {
    assert.equal(EVENTS[id].opts.length, 3);
    assert.ok(EVENTS[id].opts.some((o) => !o.cost && !o.pay && !o.req));
  }
  assert.ok(KEY_ACTIONS.some(([a, k]) => a === "shove" && k === "x"));
  assert.ok(WEAPONS.bat.melee && WEAPONS.crossbow.bow);
});

// ================= 感染者 =================
test("infected scale by phase: days 1–3, 4–7 and 8+ use the plan's hit points", () => {
  const { e } = make();
  // 三段数值只用在废墟和地区图上；农场的尸潮按原来的规则
  e.s.region = "residential";
  for (const [day, ph] of [[1, 0], [5, 1], [9, 2]]) {
    e.s.day = day;
    assert.equal(e.phase(), ph);
    for (const type of ["slow", "runner", "screamer", "armor"]) assert.equal(e.enemy(type, 600, 500).hp, ZSTATS[ph][type].hp, day + " " + type);
  }
  // 农场尸潮不吃三段数值：和上一版的规则算出来一样
  e.s.region = "farm";
  const z = e.enemy("slow", 600, 500),
    before = Object.getPrototypeOf(Engine.prototype).enemy.call(e, "slow", 600, 500);
  assert.equal(z.ph, undefined);
  assert.equal(z.hp, before.hp);
  assert.notEqual(z.hp, ZSTATS[2].slow.hp);
});

test("ruins are guarded by packs: residential, hospital and warehouse follow the pack tables; district maps gain extras", () => {
  const { e } = make();
  for (const [day, ph] of [[1, 0], [5, 1], [9, 2]]) {
    e.s.day = day;
    for (const id of ["residential", "hospital", "warehouse"]) {
      go(e, id);
      // v0.24 起：废墟小事件（尸堆里的装死者、灰隼团的搜索队）和头目不算在摆法里
      const live = e.enemies.filter((z) => !z.nest && !z.nightWander && !z.pile && !z.uParty && !z.boss && !z.escort);
      assert.equal(live.length, RUIN_PACKS[id][ph].length, id + " day " + day);
      const packs = new Set(live.filter((z) => z.pack).map((z) => z.pack));
      assert.ok(packs.size >= 2, id + " has several packs");
      for (const z of live) assert.equal(z.hp, ZSTATS[ph][z.type].hp);
    }
  }
  // 只数：居民区 10 / 12 / 14；医院 12 / 14 / 14、仓库 13 / 15 / 15（第 8 天以后不再加只数，只是更强）
  assert.deepEqual(["residential", "hospital", "warehouse"].map((id) => RUIN_PACKS[id].map((p) => p.length)), [[10, 12, 14], [12, 14, 14], [13, 15, 15]]);
  assert.deepEqual(RUIN_PACKS.hospital.map((p) => p.filter(([t]) => t === "armor").length), [1, 2, 2]);
  // 地图上的危险说明写的只数和这里一样
  assert.match(REGIONS.residential.risk, /10–14 只/);
  assert.match(REGIONS.hospital.risk, /12–14 只/);
  assert.match(REGIONS.warehouse.risk, /13–15 只/);
  e.s.day = 1;
  go(e, "railDepot");
  assert.ok(e.enemies.filter((z) => String(z.pack || "").includes(":x")).length >= DISTRICT_EXTRA[0].length);
});

test("a pack wakes together: one member chasing turns the rest within half a second", () => {
  const { e } = make();
  arena(e);
  const a = spawn(e, "slow", 160, 0, { state: "patrol", pack: "t:1" }),
    b = spawn(e, "slow", 200, 40, { state: "patrol", pack: "t:1" }),
    far = spawn(e, "slow", 900, 0, { state: "patrol", pack: "t:1" });
  e.alertPack(a);
  assert.ok(b.turnT > 0);
  assert.ok(!(far.turnT > 0), "only nearby pack members");
  tick(e, 0.6);
  assert.equal(b.state, "chase");
});

test("damage: windup hits use the phase damage, armour cuts it and is capped at 50%", () => {
  const { e } = make();
  arena(e);
  const z = spawn(e, "slow", 40, 0);
  const hit = (armorSet) => {
    e.gr.slots = { ...e.gr.slots, head: null, body: null, hands: null, legs: null, feet: null, ...armorSet };
    for (const id of Object.values(armorSet)) e.s.inventory[id] = 1;
    Object.assign(e.s.player, { hp: 100 });
    e.invulnerable = 0;
    e.gx.grab = null;
    withRandom(0.99, () => {
      e._zAtk = z;
      try {
        e.damagePlayer(ZOMBIES.slow.damage);
      } finally {
        e._zAtk = null;
      }
    });
    return Math.round((100 - e.s.player.hp) * 10) / 10;
  };
  assert.equal(hit({}), ZSTATS[0].slow.damage);
  assert.equal(hit({ body: "leatherJacket" }), Math.round(ZSTATS[0].slow.damage * 0.9 * 10) / 10);
  const heavy = hit({ head: "riotHelmet", body: "steelVest", hands: "steelBracers", legs: "motoGreaves", feet: "workBoots" });
  assert.equal(e.armorTotals().armor, ARMOR_CAP);
  assert.equal(heavy, Math.round(ZSTATS[0].slow.damage * (1 - ARMOR_CAP) * 10) / 10);
  // 挨打后不受伤的时间缩短到 0.45 秒
  assert.ok(e.invulnerable <= RULES.iframe + 1e-9);
});

test("grab: surrounded players get grabbed; three presses or a shove break free; a held grab ends in a bite and infection", () => {
  const { e, toasts } = make();
  arena(e);
  const z = spawn(e, "slow", 30, 0),
    other = spawn(e, "slow", -40, 10);
  withRandom(0.1, () => {
    e._zAtk = z;
    try {
      e.damagePlayer(ZOMBIES.slow.damage);
    } finally {
      e._zAtk = null;
    }
  });
  assert.ok(e.gx.grab, "grabbed while surrounded");
  assert.ok(toasts.some((t) => /被抓住了/.test(t.text)), "first grab explains the keys");
  // 被抓住时动不了、也不能挥
  const x0 = e.s.player.x;
  e.update(0.05, { x: 1, y: 0, run: false });
  assert.equal(e.s.player.x, x0);
  e.s.slot = 3;
  e.cooldown = 0;
  assert.equal(e.attack({ x: z.x, y: z.y }), false);
  // 别的感染者打被抓住的人多 30%
  e.invulnerable = 0;
  const hp0 = e.s.player.hp;
  withRandom(0.99, () => {
    e._zAtk = other;
    try {
      e.damagePlayer(ZOMBIES.slow.damage);
    } finally {
      e._zAtk = null;
    }
  });
  assert.equal(Math.round((hp0 - e.s.player.hp) * 10) / 10, Math.round(ZSTATS[0].slow.damage * RULES.grab.others * 10) / 10);
  // 连按三下
  e.interact();
  e.interact();
  assert.ok(e.gx.grab);
  e.interact();
  assert.equal(e.gx.grab, null);
  assert.equal(e.gr.stats.escapes, 1);
  // 推开：立刻挣开，花 10 体力
  e.startGrab(z);
  const st = e.s.player.stamina;
  assert.ok(e.shove());
  assert.equal(e.gx.grab, null);
  assert.equal(e.s.player.stamina, st - RULES.shove.cost);
  // 不挣：时间到被咬，感染 +34
  e.gx.shoveCd = 0;
  e.invulnerable = 0;
  e.startGrab(z);
  withRandom(0.99, () => tick(e, RULES.grab.time + 0.1));
  assert.equal(e.gx.grab, null);
  assert.equal(e.gr.inf, INFECTION.bite);
  assert.equal(e.gr.stats.bites, 1);
  // 同一张图里别的系统刷新人物（营地消息、夜里游荡的）不会把人放开；换图才放开
  e.gx.shoveCd = 0;
  e.startGrab(z);
  e.assignRegion();
  assert.ok(e.gx.grab, "same map refresh keeps the grab");
  e.gx.down = 2;
  e.s.region = "hospital";
  e.assignRegion();
  assert.equal(e.gx.grab, null, "a new map lets go");
  assert.equal(e.gx.down, 0);
});

test("bite protection: a riot helmet and bracers can catch the bite", () => {
  const { e } = make();
  arena(e);
  const z = spawn(e, "slow", 30, 0);
  Object.assign(e.s.inventory, { riotHelmet: 1, riotSuit: 1, steelBracers: 1 });
  Object.assign(e.gr.slots, { head: "riotHelmet", body: "riotSuit", hands: "steelBracers" });
  withRandom(0.3, () => assert.equal(e.biteFrom(z, ["head", "body", "hands"]), false));
  assert.equal(e.gr.inf, 0);
  assert.ok(e.cond("riotHelmet").d < e.cond("riotHelmet").m || e.cond("riotSuit").d < e.cond("riotSuit").m || e.cond("steelBracers").d < e.cond("steelBracers").m, "the piece that caught it wears");
});

test("runner lunge: crouch telegraph, leap knocks down, a braced spear turns it into a stumble", () => {
  const { e } = make();
  arena(e);
  const r = spawn(e, "runner", 130, 0);
  r.lcd = 0;
  e.lineClear = () => true;
  e.updateEnemy(r, 0.05);
  assert.equal(r.lunge?.phase, "crouch");
  assert.ok(r.lunge.t >= RULES.lunge.crouch - 0.06, "half a second of warning");
  withRandom(0.99, () => tick(e, 0.9));
  assert.ok(e.gr.stats.lunges >= 1);
  assert.ok(e.s.player.hp < 100, "the leap landed");
  // 拿矛对准顶住
  const { e: f } = make();
  arena(f);
  f.lineClear = () => true;
  f.add({ spear: 1 });
  f.equip("spear");
  f.s.slot = 3;
  f.s.player.facing = 0;
  const q = spawn(f, "runner", 130, 0);
  q.lcd = 0;
  tick(f, 0.9);
  assert.equal(f.gr.stats.counters, 1, "braced");
  assert.equal(f.s.player.hp, 100);
});

test("armoured charge: stomp telegraph, a wall stops it and stunned armour takes 50% more", () => {
  const { e } = make();
  arena(e);
  const a = spawn(e, "armor", 200, 0);
  a.ccd = 0;
  e.lineClear = () => true;
  e.updateEnemy(a, 0.05);
  assert.equal(a.charge?.phase, "stomp");
  // 冲的方向上有墙：撞晕
  a.charge.t = 0;
  e.updateEnemy(a, 0.05);
  assert.equal(a.charge.phase, "run");
  e.moveEntity = (z) => z; // 动不了 = 撞墙
  e.updateEnemy(a, 0.05);
  assert.equal(a.charge.phase, "stun");
  const hp0 = a.hp;
  e._hit = { kind: "blunt", pierce: 1, knock: 0 };
  e.hurtEnemy(a, 20, Math.PI);
  e._hit = null;
  assert.ok(hp0 - a.hp >= 20 * RULES.weakHit - 1e-6);
});

test("screamer: hitting it during the windup cuts the scream; a finished scream calls new infected (capped at 8)", () => {
  const { e } = make();
  arena(e);
  const s = spawn(e, "screamer", 200, 0, { windup: 0.8 });
  e._hit = { kind: "throw", pierce: 1, knock: 0, interrupt: true };
  e.hurtEnemy(s, 6, Math.PI);
  e._hit = null;
  assert.equal(s.windup, 0);
  assert.ok(e.gr.stats.interrupts >= 1);
  const before = e.enemies.length;
  e.summonFor(s);
  assert.equal(e.enemies.length - before, SUMMON[0]);
  assert.ok(e.enemies.slice(-SUMMON[0]).every((z) => z.summoned && z.state === "chase"));
  for (let i = 0; i < 5; i++) e.summonFor(s);
  assert.ok(e.enemies.filter((z) => z.summoned && !z.dead).length <= 8);
});

test("crawlers: low-health infected can fall and crawl; a stomp with work boots finishes them", () => {
  const { e } = make();
  arena(e);
  const z = spawn(e, "slow", 30, 0);
  z.hp = ZSTATS[0].slow.hp * 0.35;
  withRandom(0.01, () => {
    e._hit = { kind: "blunt", pierce: 1, knock: 0, crawl: RULES.crawl.chance };
    e.hurtEnemy(z, 10, 0);
    e._hit = null;
  });
  assert.ok(z.crawl);
  assert.equal(e.enemySpeed(z), RULES.crawl.speed);
  Object.assign(e.s.inventory, { workBoots: 1 });
  e.gr.slots.feet = "workBoots";
  const hp = z.hp;
  e.interact();
  assert.ok(z.dead || hp - z.hp >= 40 * 2 - 1e-6, "boots double the stomp");
  assert.equal(e.gr.stats.stomps, 1);
});

test("night: wanderers come once per night, sight shrinks without a light and a headlamp gives you away", () => {
  const { e } = make();
  e.s.minute = 22 * 60;
  go(e, "residential");
  const base = e.enemies.filter((z) => !z.nightWander && !z.nest && !z.dead && z.type !== "elite").length,
    extra = e.enemies.filter((z) => z.nightWander).length;
  assert.ok(extra > 0 && extra <= Math.round(base * RULES.night.more));
  e.assignRegion();
  assert.equal(e.enemies.filter((z) => z.nightWander).length, extra, "not twice in one night");
  // 天亮：没在追你的走了
  e.s.minute = 7 * 60;
  e.nightWanderers("residential", true);
  assert.equal(e.enemies.filter((z) => z.nightWander && !z.dead).length, 0);
  assert.equal(e.playerLit(), false);
  e.add({ headlamp: 1 });
  e.equip("headlamp");
  assert.equal(e.playerLit(), true);
});

// ================= 人 =================
test("tired swings are slower; heavy armour slows walking and stamina regeneration", () => {
  const { e } = make();
  arena(e);
  e.s.slot = 3;
  e.cooldown = 0;
  e.s.player.stamina = 100;
  e.meleeSwing({ x: e.s.player.x + 50, y: e.s.player.y - 20 }, "club");
  const fresh = e.cooldown;
  e.cooldown = 0;
  e.s.player.stamina = 10;
  e.meleeSwing({ x: e.s.player.x + 50, y: e.s.player.y - 20 }, "club");
  assert.ok(Math.abs(e.cooldown - fresh * RULES.tired.mul) < 1e-9);
  Object.assign(e.s.inventory, { steelVest: 1, riotHelmet: 1 });
  Object.assign(e.gr.slots, { body: "steelVest", head: "riotHelmet" });
  assert.equal(e.armorTotals().tier.id, "heavy");
  const p = e.s.player;
  Object.assign(p, { x: 700, y: 520, stamina: 50 });
  tick(e, 1, { x: 1, y: 0, run: false });
  const heavy = p.x - 700;
  const { e: f } = make();
  arena(f);
  Object.assign(f.s.player, { x: 700, y: 520, stamina: 50 });
  tick(f, 1, { x: 1, y: 0, run: false });
  const light = f.s.player.x - 700;
  assert.ok(heavy < light * 0.95 && heavy > light * 0.8, "about 12% slower: " + heavy + " vs " + light);
  assert.equal(WEIGHT_TIERS[2].speed, 0.88);
});

test("bandage and medkit heal over time; bandages stop bleeding; a bleed drains 1.2 per second", () => {
  const { e } = make();
  arena(e, "farm");
  e.s.player.hp = 40;
  e.gx.bleed = 10;
  tick(e, 1);
  assert.ok(Math.abs(e.s.player.hp - (40 - RULES.bleed.dps)) < 0.2);
  e.s.inventory.bandage = 2;
  assert.ok(e.consume("bandage"));
  assert.equal(e.gx.bleed, 0);
  const now = e.s.player.hp;
  assert.ok(now < 45, "not instant");
  tick(e, 5.2);
  assert.ok(Math.abs(e.s.player.hp - (now + RULES.heal.bandage.hp)) < 0.6);
});

test("infection: fever at 100% caps health at 70 until a medkit and a night's sleep", () => {
  const { e } = make();
  arena(e, "farm");
  e.s.player.hp = 100;
  e.infect(INFECTION.bite);
  e.infect(INFECTION.bite);
  assert.equal(e.gr.fever, false);
  e.infect(40);
  assert.equal(e.gr.fever, true);
  assert.equal(e.maxHp(), INFECTION.feverHp);
  tick(e, 0.1);
  assert.ok(e.s.player.hp <= INFECTION.feverHp);
  // 只睡觉不吃药：还烧
  e.s.minute = 22 * 60;
  e.sleep();
  assert.equal(e.gr.fever, true);
  e.s.inventory.medkit = 1;
  assert.ok(e.consume("medkit"));
  assert.ok(e.gr.cure);
  e.s.minute = 22 * 60;
  e.sleep();
  assert.equal(e.gr.fever, false);
  assert.equal(e.gr.inf, 0);
  // 没发烧时每睡一晚降 20
  e.gr.inf = 50;
  e.s.minute = 22 * 60;
  e.sleep();
  assert.equal(e.gr.inf, 50 - INFECTION.sleep);
});

// ================= 装备 =================
test("fresh game: club, lure stones, rag gloves and cloth shoes are worn; the hotbar has the new layout", () => {
  const { e } = make();
  assert.deepEqual(
    { ...e.gr.slots },
    { head: null, body: null, hands: "ragGloves", legs: null, feet: "clothShoes", melee: "club", ranged: null, throw: "stone", }
  );
  assert.deepEqual(e.hotbarSlots(), ["hoe", "water", e.s.seed, "club", "", "stone", "", "bread", "bandage", "build"]);
  e.s.slot = 4;
  assert.equal(e.currentItem(), "");
  assert.equal(e.use({ x: 0, y: 0 }), false);
  e.add({ spikeBoard: 2 });
  assert.equal(e.hotbarSlots()[6], "spikeBoard");
});

test("worn gear takes no bag slot; equipping, unequipping and swapping change real state", () => {
  const { e, toasts } = make();
  const cap = e.capacity();
  e.add({ leatherJacket: 1 });
  assert.equal(e.gr.slots.body, "leatherJacket", "an empty slot is filled when you pick something up");
  assert.equal(e.capacity(), cap + 1);
  e.add({ tireArmor: 1 });
  assert.equal(e.gr.slots.body, "leatherJacket");
  assert.ok(e.equip("tireArmor"));
  assert.equal(e.gr.slots.body, "tireArmor");
  assert.ok(toasts.some((t) => /换下皮夹克/.test(t.text)));
  assert.equal(e.equipReason("tireArmor"), "已经穿着了");
  assert.match(e.equipReason("steelVest"), /背包/);
  e.s.region = "farm";
  assert.ok(e.unequip("body"));
  assert.equal(e.gr.slots.body, null);
  assert.equal(e.unequipReason("body"), "这一栏是空的");
});

test("you cannot store or sell what you wear, but spares go through", () => {
  const { e } = make();
  e.s.region = "farm";
  e.add({ leatherJacket: 1 });
  assert.equal(e.transfer("leatherJacket", true), false);
  assert.equal(e.s.inventory.leatherJacket, 1);
  e.add({ leatherJacket: 1 });
  assert.ok(e.transfer("leatherJacket", true, true));
  assert.equal(e.s.inventory.leatherJacket, 1);
  assert.equal(e.s.storage.leatherJacket, 1);
  e.depositAll();
  assert.equal(e.gr.slots.body, "leatherJacket");
  assert.equal(e.trade("mechanic", "leatherJacket", 1, "sell"), false);
});

test("durability: swings and hits wear gear; broken weapons hit for half, broken armour stops protecting, nothing vanishes", () => {
  const { e } = make();
  arena(e);
  const z = spawn(e, "slow", 40, 0);
  e.s.slot = 3;
  e.cooldown = 0;
  const d0 = e.cond("club").d;
  e.meleeSwing({ x: z.x, y: z.y - 20 }, "club");
  assert.equal(e.cond("club").d, d0 - 1);
  const full = e.meleeStats("club").dmg;
  e.cond("club").d = 0;
  assert.equal(e.meleeStats("club").dmg, full * 0.5);
  assert.ok(e.qty("club") > 0, "a broken club is still in the bag");
  e.add({ leatherJacket: 1 });
  e.cond("leatherJacket").d = 0;
  assert.equal(e.armorTotals().armor, 0);
  assert.equal(e.armorTotals().bite.body, 0);
});

test("repairs at the weapon bench: costs a third of the materials, lose 10% max each time, five times then only scrap", () => {
  const { e } = make();
  bench(e);
  e.add({ bat: 1 });
  Object.assign(e.s.storage, { wood: 20, scrap: 20 });
  const c = e.cond("bat");
  c.d = 10;
  assert.ok(e.repairGear("bat"));
  assert.equal(c.r, 1);
  assert.equal(c.m, Math.round(MELEE.bat.dur * (1 - REPAIR.drop)));
  assert.equal(c.d, c.m);
  for (let i = 2; i <= REPAIR.maxRepairs; i++) {
    c.d = 1;
    assert.ok(e.repairGear("bat"), "repair " + i);
  }
  c.d = 1;
  assert.match(e.repairReason("bat"), /只能拆/);
  const scrap = e.qty("scrap", true);
  assert.ok(e.dismantleGear("bat"));
  assert.equal(e.qty("bat", true), 0);
  assert.ok(e.qty("scrap", true) > scrap);
  // 不在农场修不了
  e.add({ pipe: 1 });
  e.cond("pipe").d = 5;
  e.s.region = "residential";
  assert.match(e.repairReason("pipe"), /武器台/);
});

test("mods: nails, wrap and sharpening change the numbers and can be removed; blades lose their edge", () => {
  const { e } = make();
  bench(e);
  Object.assign(e.s.storage, { scrap: 20, cloth: 10, wood: 10, stone: 10 });
  const dmg = e.meleeStats("club").dmg;
  assert.ok(e.applyMod("club", "nails"));
  assert.equal(e.level("combat"), 1);
  assert.equal(e.meleeStats("club").dmg, dmg + 8);
  assert.ok(e.meleeStats("club").bleed >= 0.3);
  assert.match(e.modReason("club", "wrap"), /改装位满了/);
  assert.ok(e.removeMod("club", "nails"));
  assert.ok(e.applyMod("club", "wrap"));
  assert.equal(e.cond("club").m, Math.round(MELEE.club.dur * 1.4));
  e.add({ knife: 1 });
  assert.ok(e.applyMod("knife", "edge"));
  assert.equal(e.cond("knife").mods.edge, MODS.edge.n);
  assert.match(e.modReason("knife", "nails"), /装不了/);
});

test("a spare copy can replace a worn-out one; dismantling the worn one brings the spare out of storage", () => {
  const { e } = make();
  bench(e);
  e.add({ leatherJacket: 1 });
  e.s.storage.leatherJacket = 1;
  e.cond("leatherJacket").d = 3;
  assert.ok(e.freshCopy("leatherJacket"));
  assert.equal(e.gr.slots.body, "leatherJacket");
  assert.equal(e.cond("leatherJacket").d, ARMOR.leatherJacket.dur);
  assert.equal((e.s.inventory.leatherJacket || 0) + (e.s.storage.leatherJacket || 0), 1);
});

test("blueprints are learned on pickup, each once; recipes need them; a second copy turns into scrap", () => {
  const { e } = make();
  const r = RECIPES.find((x) => x.out.machete);
  assert.match(e.recipeReason(r), /砍刀图纸/);
  e.add({ bp_machete: 1 });
  e.learnBlueprints();
  assert.ok(e.knows("bp_machete"));
  assert.equal(e.qty("bp_machete"), 0, "the paper is used up");
  assert.doesNotMatch(e.recipeReason(r), /图纸/);
  const scrap = e.qty("scrap", true);
  e.add({ bp_machete: 1 });
  e.learnBlueprints();
  assert.equal(e.qty("scrap", true), scrap + 4);
});

test("gear spots open once and remember it; guarded plans wait for the guard", () => {
  const { e } = make();
  go(e, "residential");
  const crates = e.objects.filter((o) => o.type === "gearCrate");
  assert.equal(crates.length, GEAR_SPOTS.residential.length);
  const garage = crates.find((o) => o.id === "gear:residential:garage");
  assert.ok(e.openGearCrate(garage));
  assert.ok(e.qty("motoHelmet") > 0);
  go(e, "residential");
  assert.ok(!e.objects.some((o) => o.id === "gear:residential:garage"), "gone after opening");
  go(e, "warehouse");
  const plans = e.objects.find((o) => o.id === "gear:warehouse:plans");
  assert.ok(plans.guard);
  assert.ok(e.enemies.some((z) => z.type === "elite" && !z.dead), "the warehouse guard is there");
  assert.equal(e.openGearCrate(plans), false);
  assert.equal(e.knows("bp_steelVest"), false);
  for (const z of e.enemies) if (z.type === "elite") z.dead = true;
  assert.ok(e.openGearCrate(plans));
  assert.ok(e.knows("bp_steelVest"));
});

test("throws and traps: lure stones ring 2.8 s, molotovs burn, a bear trap holds an infected 4 s", () => {
  const { e } = make();
  arena(e);
  e.lineClear = () => true;
  const p = e.s.player;
  e.s.slot = 5;
  assert.ok(e.use({ x: p.x + 150, y: p.y }));
  assert.ok(e.noise.some((n) => n.r === THROWN.stone.noise && Math.abs(n.t - THROWN.stone.ring) < 1e-9));
  e.cooldown = 0;
  e.add({ molotov: 1 });
  const z = spawn(e, "armor", 150, 0);
  e.equip("molotov");
  assert.ok(e.use({ x: z.x, y: z.y }));
  const hp = z.hp;
  tick(e, 1);
  assert.ok(hp - z.hp >= THROWN.molotov.dmg * 0.9, "fire ignores armour");
  // 捕兽夹
  const { e: f } = make();
  arena(f);
  f.add({ bearTrap: 1 });
  f.s.slot = 6;
  assert.equal(f.currentItem(), "bearTrap");
  assert.ok(f.use({ x: f.s.player.x + 50, y: f.s.player.y }));
  const t = f.gr.traps[0];
  const y = spawn(f, "slow", 0, 0);
  Object.assign(y, { x: t.x, y: t.y });
  f.updateTraps(0.05);
  assert.equal(y.trapHeld, TRAPS.bearTrap.hold);
  assert.equal(f.enemySpeed(y), 0);
  assert.equal(t.uses, TRAPS.bearTrap.uses - 1);
});

test("winter warmth comes from what you wear: a warm coat is enough, rags only help a little", () => {
  const { e } = make();
  assert.equal(e.warmthTier(0).extra, 0.4);
  assert.equal(e.warmthTier(2).extra, 0.25);
  assert.equal(e.warmthTier(3).extra, 0.1);
  assert.equal(e.warmthTier(4).extra, 0);
  e.add({ warmCoat: 1 });
  assert.equal(e.gr.slots.body, "warmCoat");
  assert.equal(e.warmth(), 4);
});

test("dying keeps your gear on you but every worn piece loses a quarter of its durability", () => {
  const { e } = make();
  arena(e);
  e.add({ leatherJacket: 1, bat: 1 });
  e.equip("bat");
  e.die();
  assert.equal(e.s.region, "farm");
  assert.equal(e.gr.slots.body, "leatherJacket");
  assert.equal(e.cond("leatherJacket").d, ARMOR.leatherJacket.dur - Math.round(ARMOR.leatherJacket.dur * REPAIR.deathWear));
  assert.equal(e.cond("bat").d, MELEE.bat.dur - Math.round(MELEE.bat.dur * REPAIR.deathWear));
});

test("guns jam below 20% durability; a DIY suppressor is quiet for 25 shots", () => {
  const { e, toasts } = make();
  arena(e);
  e.add({ pistol: 1, ammo: 40 });
  e.equip("pistol");
  e.s.slot = 4;
  e.s.magazines.pistol = 8;
  e.cond("pistol").d = 10;
  e.cooldown = 0;
  withRandom(0.01, () => assert.equal(e.attack({ x: e.s.player.x + 200, y: e.s.player.y }), false));
  assert.ok(toasts.some((t) => /卡壳/.test(t.text)));
  e.cond("pistol").d = 300;
  e.cond("pistol").mods = { diySuppressor: 25 };
  const quiet = e.weaponStats("pistol").noise;
  e.cond("pistol").mods = {};
  assert.ok(quiet < e.weaponStats("pistol").noise * 0.5);
});

// ================= 存档 =================
test("old saves upgrade once: weapons go into slots, a warm coat is worn, day 4+ gets three easier days and a gift in storage", () => {
  const s = oldSave(9);
  s.inventory.pistol = 1;
  s.inventory.warmCoat = 1;
  s.slot = 5;
  const { e } = make(s);
  assert.equal(e.gr.old, true);
  assert.equal(e.gr.intro, false);
  assert.equal(e.gearIntroDue(), true);
  assert.equal(e.gr.slots.melee, "club");
  assert.equal(e.gr.slots.ranged, "pistol");
  assert.equal(e.gr.slots.body, "warmCoat");
  assert.equal(e.s.slot, 4, "the old shotgun slot points at the new ranged slot");
  assert.equal(e.gr.grace, 11);
  assert.equal(e.phase(), 1, "grace: day 9 plays like days 4–7");
  for (const [id, n] of Object.entries(OLD_SAVE_GIFT)) assert.equal(e.s.storage[id], n);
  // 再读一次不重复送
  const again = new Engine(Engine.parse(e.serialize()), () => {});
  assert.equal(again.s.storage.motoHelmet, OLD_SAVE_GIFT.motoHelmet);
  again.s.day = 12;
  assert.equal(again.phase(), 2);
  e.markGearIntro();
  assert.equal(e.gearIntroDue(), false);
  // 头 3 天的旧档不送、不缓
  const { e: early } = make(oldSave(2));
  assert.equal(early.gr.grace, 0);
  assert.equal(early.gr.gift, false);
});

test("saves: gear survives a round trip; broken data is refused and the original kept", () => {
  const { e } = make();
  bench(e);
  e.add({ bat: 1, leatherJacket: 1 });
  e.equip("bat");
  e.cond("bat").d = 33;
  e.gr.inf = 40;
  e.learn("bp_sledge", true);
  const copy = new Engine(Engine.parse(e.serialize()), () => {});
  assert.equal(copy.gr.slots.melee, "bat");
  assert.equal(copy.cond("bat").d, 33);
  assert.equal(copy.gr.inf, 40);
  assert.ok(copy.knows("bp_sledge"));
  for (const bad of [
    (g) => (g.slots.body = "bat"),
    (g) => (g.cond.bat.d = -1),
    (g) => (g.inf = 140),
    (g) => (g.bp.bp_nothing = 1),
    (g) => (g.traps = [{ kind: "landmine", region: "farm", x: 1, y: 1, uses: 1 }]),
    (g) => (g.schema = 99),
  ]) {
    const raw = JSON.parse(e.serialize());
    bad(raw.gear);
    assert.throws(() => Engine.parse(JSON.stringify(raw)), /装备存档异常/);
  }
  // 没有 gear 字段的旧存档照常读
  assert.ok(Engine.parse(JSON.stringify(oldSave(5))).gear);
});

// ================= 来源 =================
test("sources: raids drop riot gear in turn, the caravan sells a blueprint, the gun plans teach two, daily ops work", () => {
  const { e } = make();
  e.s.region = "farm";
  e.finishRaid(true, false, "");
  e.finishRaid(true, false, "");
  assert.equal(e.s.storage.riotHelmet, 1);
  assert.equal(e.s.storage.riotSuit, 1);
  const lines = [];
  e.applyTreasure("gunPlans", lines);
  assert.ok(e.knows("bp_crossbow") && e.knows("bp_suppressor"));
  assert.match(TREASURES.gunPlans.text, /自制弩/);
  assert.match(e.applyOp(["bp", "bp_molotov"], { flags: [] }, 1), /学会/);
  assert.match(e.applyOp(["bp", "bp_molotov"], { flags: [] }, 1), /废金属 4/);
  e.add({ leatherJacket: 1 });
  e.cond("leatherJacket").d = 2;
  assert.match(e.applyOp(["fixGear"], { flags: [] }, 1), /皮夹克/);
  assert.equal(e.cond("leatherJacket").d, e.cond("leatherJacket").m);
});

// ================= 界面 =================
test("bag panel, bench and intro render clean text; their buttons change real state through the handler", () => {
  const { e } = make();
  bench(e);
  e.add({ leatherJacket: 1, bat: 1, tireArmor: 1 });
  Object.assign(e.s.storage, { scrap: 20, cloth: 10, wood: 10 });
  gearUI.slot = null;
  let html = renderGearPanel(e);
  assert.match(html, /gear-slot/);
  assert.doesNotMatch(html, FORBIDDEN);
  let rendered = 0;
  const c = ctx(e, { renderMenu: () => rendered++ });
  assert.ok(handleCampaignAction("gSlot", btn("gSlot", "body"), c));
  assert.equal(gearUI.slot, "body");
  html = renderGearPanel(e);
  assert.match(html, /废胎护甲/);
  assert.match(html, /▲|▼/);
  assert.ok(handleCampaignAction("gEquip", btn("gEquip", "tireArmor"), c));
  assert.equal(e.gr.slots.body, "tireArmor");
  assert.ok(handleCampaignAction("gUnequip", btn("gUnequip", "body"), c));
  assert.equal(e.gr.slots.body, null);
  gearUI.slot = null;
  // 武器台：修理与改装就在“武器与潜行”那一页的下面，不是新面板
  const b = e.s.buildings.find((x) => x.type === "weaponbench");
  assert.match(stationExtras(e, b), /武器与潜行 · 修理改装/);
  const h = { esc: (v) => String(v), icon: () => "", itemIcon: () => "", costs: () => "", itemName: (id) => ITEMS[id]?.name || id };
  html = renderManualPlus(e, "defense", h, { tool: { menu: "frontier", tab: "combat" } }, {});
  assert.match(html, /修理与改装/);
  assert.match(html, /data-action="gRepair"/);
  assert.doesNotMatch(html, FORBIDDEN);
  // 修理与改装放在同一个滚动区里，跟着整页上下滚（不在旁边单独一栏）
  assert.ok(html.indexOf('class="detail-scroll"') < html.indexOf("gear-bench-section"));
  assert.ok(html.endsWith("</section></div></div></div></div>"), "inside .frontier-body");
  assert.doesNotMatch(renderManualPlus(e, "defense", h, { tool: { menu: "frontier", tab: "kitchen" } }, {}), /gear-bench-section/);
  // 背包里点一件装备：和身上的比
  assert.match(gearDetailHtml(e, "tireArmor"), /这一栏空着/);
  assert.ok(e.equip("leatherJacket"));
  assert.match(gearDetailHtml(e, "tireArmor"), /身栏/);
  assert.match(gearDetailHtml(e, "tireArmor"), /▲|▼/);
  assert.equal(gearDetailHtml(e, "wood"), "");
  e.cond("bat").d = 5;
  assert.ok(handleCampaignAction("gRepair", btn("gRepair", "bat"), c));
  assert.equal(e.cond("bat").d, e.cond("bat").m);
  assert.ok(handleCampaignAction("gMod", btn("gMod", "bat|wrap"), c));
  assert.ok(e.cond("bat").mods.wrap);
  assert.ok(handleCampaignAction("gDismantle", btn("gDismantle", "tireArmor"), c));
  assert.equal(e.qty("tireArmor", true), 0);
  // 说明卡
  e.gr.intro = false;
  e.gr.old = true;
  html = renderCampaignView(e, { view: "gIntro", id: "" });
  assert.match(html, /你的家园已经升级/);
  assert.doesNotMatch(html, FORBIDDEN);
  assert.ok(handleCampaignAction("gIntroOk", btn("gIntroOk"), c));
  assert.equal(e.gr.intro, true);
  // 顶栏的小图标：点一下说明怎么治
  e.gx.bleed = 3;
  e.gr.inf = 20;
  html = gearStatusHtml(e);
  assert.match(html, /流血/);
  assert.match(html, /感染 20%/);
  assert.match(html, /data-action="gStatus"/);
  assert.doesNotMatch(html, FORBIDDEN);
  let told = "";
  assert.ok(handleCampaignAction("gStatus", btn("gStatus", "bleed"), ctx(e, { toast: (t) => (told = t) })));
  assert.match(told, /绷带/);
  // 触屏的推开
  assert.ok(handleCampaignAction("touchShove", btn("touchShove"), c));
  assert.ok(rendered > 0);
});

test("every gear item reads cleanly in the bag panel and bench for each slot", () => {
  const { e } = make();
  bench(e);
  const all = Object.fromEntries([...Object.keys(ARMOR), ...Object.keys(MELEE), "slingshot", "crossbow", "firecracker", "molotov", "bearTrap", "spikeBoard"].map((id) => [id, 1]));
  Object.assign(e.s.storage, all);
  for (const slot of ["head", "body", "hands", "legs", "feet", "melee", "ranged", "throw", "trap"]) {
    gearUI.slot = slot;
    const html = renderGearPanel(e);
    assert.doesNotMatch(html, FORBIDDEN, slot);
  }
  gearUI.slot = null;
  const html = renderGearBench(e);
  assert.doesNotMatch(html, FORBIDDEN);
  for (const id of Object.keys(all)) if (slotOf(id) && slotOf(id) !== "throw") assert.ok(html.includes(ITEMS[id].name), id);
});
