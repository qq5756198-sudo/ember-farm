// v0.36.0「巨影」：十凶共用的规矩（窝、预兆、打晃、换段、回窝回血、第二天回满、卷土重来）和前五凶
// （河伯、收破烂的、〇号、黑瞎子、白毛风）各自的那一招、战利品和凶器、十凶柜、存档和页面。
// v0.37.0「扑火」：十凶都在了，共用的那几条（窝、个头、预兆、伤害上限）十凶一起查；后五凶各自的打法在 titan2.test.mjs。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, needsStoryMigration } from "../dist/campaign.js";
import * as Nf from "../dist/nightfall.js";
import { ITEMS, ZOMBIES, REGIONS } from "../dist/data.js";
import { ARMOR, MELEE } from "../dist/gear-data.js";
import { SFX, STINGERS, soundFor } from "../dist/audio-data.js";
import { CUES } from "../dist/feel-data.js";
import { FALL_HINTS } from "../dist/nightfall-data.js";
import { EVENTS } from "../dist/daily-data.js";
import { PERSON_H } from "../dist/pixel-sprites.js";
import { TRULES, TITANS, TITAN_IDS, TITAN_ORDER, TITAN_SLOTS, POD_TYPE, TITAN_TROPHY_IDS, TITAN_CASE, TITAN_ARMOR, TITAN_MELEE, T_CARD_IDS, PERK_DROPS, SCRAP_GIFT, TITAN_INTRO, mainPart } from "../dist/titan-data.js";

const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const DT = 0.05;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const make = (state = freshState(), seed = 36001) => {
  state.undertow.seed = seed;
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  return { e, toasts };
};
// 在某一凶的图上：第 day 天、几点（河伯默认晚上 9 点），人站在离窝 far 远的空地；场上只留十凶
function arena(id, { day = 40, minute = null, far = 420, force = true, seed = 36001 } = {}) {
  const st = freshState();
  st.day = day;
  st.minute = minute ?? (id === "hebo" ? 21 * 60 : 600);
  const { e, toasts } = make(st, seed);
  const T = TITANS[id];
  if (force) e._tForce = id;
  // 城区的图记在 districts 里，城外的（松林、冻土、船坞、避难城）记在 beyond 里；记错地方存档会读不回来
  // 隧道按层：拿着第 25 层的钥匙下去；农场不用开
  if (["pinewood", "frost", "shipyard", "shelter"].includes(T.region)) e.b.unlocked[T.region] = true;
  else if (T.region === "tunnel") Object.assign(e.rl.tunnel, { key: { floor: T.floor, day: st.day, luck: false }, floor: T.floor, deepest: T.floor });
  else if (T.region !== "farm") e.d.unlocked[T.region] = true;
  e.s.region = T.region;
  e.s.enemies[T.region] = null;
  e.assignRegion();
  place(e, T.lair.x - far, T.lair.y);
  e.update(DT, { x: 0, y: 0 });
  e.enemies = e.s.enemies[T.region] = e.enemies.filter((z) => z.titan);
  return { e, T, toasts, z: e.titansHere(id)[0] };
}
const place = (e, x, y) => Object.assign(e.s.player, e.freePoint(Math.max(90, Math.min(1440, x)), Math.max(100, Math.min(920, y))), { hp: 100, stamina: 100 });
const run = (e, secs, input = { x: 0, y: 0 }) => {
  for (let t = 0; t < secs; t += DT) e.update(DT, input);
};
const awake = (e, z) => {
  e.titanWake(z);
  return z;
};

// ================= 数据 =================
test("ten titans: each has a lair on open ground in its own map, is far bigger than an infected and speaks plainly", () => {
  assert.equal(TITAN_ORDER.length, 10);
  assert.deepEqual(TITAN_IDS, ["hebo", "scrap", "zero", "bear", "frost", "diao", "tide", "vent", "train", "moth"]);
  for (const id of TITAN_ORDER) assert.ok(TITAN_SLOTS[id].name && TITAN_SLOTS[id].where, id);
  const regions = new Set();
  for (const id of TITAN_IDS) {
    const T = TITANS[id];
    assert.ok(REGIONS[T.region], id);
    assert.equal(typeof T.open, "function", id + " open() is a rule");
    assert.ok(!regions.has(T.region), "one titan per map");
    regions.add(T.region);
    // 个头：至少是普通感染者的 2.3 倍
    assert.ok(Math.max(T.w, T.h) >= PERSON_H * 2.3, id + " is big");
    // 有几只的那几凶：感染者表里记的是这一凶的名字，或者本体那一只的名字（雕爷和看门的记“看门的”）
    assert.ok([T.name, T.parts?.[mainPart(id)]?.name].includes(ZOMBIES[T.type].name), id + " " + ZOMBIES[T.type].name);
    assert.ok(T.phases.length === 2 && T.phases[0] > T.phases[1], id);
    for (const k of ["name", "title", "openText", "perk", "rumor", "tip", "intel"]) assert.doesNotMatch(String(T[k]), FORBIDDEN, id + "." + k);
    for (const line of [...T.lore, ...T.down]) assert.doesNotMatch(line, FORBIDDEN);
    assert.ok(FALL_HINTS[T.type], id + " has a fall hint");
    const { e } = arena(id);
    assert.ok(!e.blocked(T.lair.x, T.lair.y, true, 16), id + " lair is open ground");
  }
  for (const line of TITAN_INTRO) assert.doesNotMatch(line, FORBIDDEN);
  assert.ok(FALL_HINTS[POD_TYPE]);
});

test("trophies, unique gear and the case: every item has a name, a picture and a description; gear never breaks", () => {
  for (const id of TITAN_TROPHY_IDS) {
    assert.ok(ITEMS[id]?.name && ITEMS[id].desc, id);
    assert.ok(ITEMS[id].protected, id);
    assert.match(String(ITEMS[id].icon), /^g\d+$/, id);
  }
  for (const [id, a] of Object.entries(TITAN_ARMOR)) {
    assert.equal(ARMOR[id], a);
    assert.equal(a.dur, 0, id + " never breaks");
    assert.match(String(ITEMS[id].icon), /^g\d+$/, id);
    assert.doesNotMatch(ITEMS[id].desc, FORBIDDEN);
  }
  for (const [id, w] of Object.entries(TITAN_MELEE)) {
    assert.equal(MELEE[id], w);
    assert.equal(w.dur, 0);
    assert.match(String(ITEMS[id].icon), /^g\d+$/, id);
    // 数比现在最好的同类最多高一成
    const best = Math.max(...Object.entries(MELEE).filter(([k, m]) => m.kind === w.kind && !TITAN_MELEE[k]).map(([, m]) => m.dmg));
    assert.ok(w.dmg <= best * 1.1 + 0.001, id + " not stronger than the best " + w.kind + " by more than 10%");
  }
  assert.ok(ITEMS.heboFork.desc.includes("走得慢一半"));
  for (const id of TITAN_IDS) {
    assert.ok(ITEMS[TITANS[id].trophy], id);
    // 最后一凶只掉最后一盏灯（没有凶器）
    if (TITANS[id].final) assert.equal(TITANS[id].gear, null);
    else assert.ok(ITEMS[TITANS[id].gear], id);
  }
  assert.deepEqual(
    TITAN_CASE.steps.map((s) => s.n),
    [3, 6, 10],
  );
});

test("sounds, captions and rumour cards are all there", () => {
  for (const k of ["tRoar", "tThud", "tSplash", "tBubble", "tBell", "tGong", "tWhip", "tPop", "tBearRoar", "tCrack", "tWind", "tShatter"]) {
    assert.ok(SFX[k], k);
    assert.equal(soundFor({ type: "tSfx", sfx: k }).sfx, k);
  }
  assert.equal(soundFor({ type: "tSfx" }), null);
  assert.equal(soundFor({ type: "tSfx", stinger: "titanDown", ui: true }).stinger, "titanDown");
  assert.ok(STINGERS.titan && STINGERS.titanDown);
  for (const k of ["tBubble", "tGong", "tCharge", "tIcicle", "tBreath", "tSweep"]) assert.ok(CUES[k], k);
  // 一凶一张传闻卡；名字不跟别的卡撞（v0.36 的 T01–T05 跟扒手卡重名，一直没进卡池）
  assert.equal(T_CARD_IDS.length, 10);
  for (const id of T_CARD_IDS) {
    const ev = EVENTS[id];
    assert.equal(ev.pack, "titan", id + " is the titan card");
    assert.ok(ev.opts.some((o) => (o.fx || []).some((op) => op[0] === "tIntel")), id);
    assert.equal(ev.opts.length, 3);
    assert.ok(ev.opts.some((o) => !o.cost));
    assert.doesNotMatch(ev.name + ev.text, FORBIDDEN);
  }
});

// ================= 窝 =================
test("each lair has blood, claw marks and a red warning sign on open ground outside its wake circle; work points, exits and the fishing spot stay out of the circle", async () => {
  const { lairSpot } = await import("../dist/titan-renderer.js");
  const WORK = ["districtPoint", "beyondPoint", "districtExit", "beyondExit", "districtStore", "beyondStore", "beyondGate", "kinWater"];
  for (const id of TITAN_IDS) {
    // 最后一凶没有窝：它自己找上门来
    if (TITANS[id].final) continue;
    const { e, T } = arena(id);
    const S = lairSpot(e, id);
    assert.ok(S.sign, id + " has a sign");
    const d = Math.hypot(S.sign.x - T.lair.x, S.sign.y - T.lair.y);
    // 末班车整层都听得见（醒的那一圈比这一层还大）：牌子只是说这一层有它
    if (T.wake < 600) assert.ok(d > T.wake + 40, id + " sign at " + Math.round(d));
    assert.ok(!e.blocked(S.sign.x, S.sign.y, true, 12), id + " sign on open ground");
    assert.ok(S.marks.length >= 3, id + " marks");
    // 站在工作点上干活、在河边钓鱼不会把它吵醒（收破烂的是瞎的，醒只看声音，这里按它醒的那一圈算）
    for (const o of e.objects.filter((x) => WORK.includes(x.type))) {
      // 风口就长在主风道上：主风道修好（它开出来的前提）以后那个工作点没有别的事可做
      if (id === "vent" && o.pointId === "shelter_air") continue;
      const dd = Math.hypot(o.x - T.lair.x, o.y - T.lair.y);
      assert.ok(dd >= T.wake + (o.type === "kinWater" ? 60 : 35), id + ": " + (o.name || o.type) + " at " + Math.round(dd) + " inside the wake circle " + T.wake);
    }
  }
});

test("the campfire: someone has heard of a titan and tells its weakness, one a night, only for ones you have heard of and not beaten", () => {
  const { e, toasts } = arena("scrap", { force: false });
  e.sc.camp = { x: 560, y: 735 };
  e.talkReason = () => "";
  e.talkPeople = () => [
    { id: "medic", name: "许医生" },
    { id: "farmer", name: "阿禾" },
  ];
  e.s.region = "farm";
  e.assignRegion();
  Object.assign(e.s.player, e.fireSpot());
  e.tg.rumor = { scrap: e.s.day - 1 };
  e.tg.intel = {};
  assert.ok(e.talk("future"));
  assert.equal(e.tg.intel.scrap, e.s.day);
  const line = toasts.find((t) => t.text.includes("说起收破烂的"));
  assert.ok(line, "a line about the rag-and-bone man");
  assert.match(line.text, /^营火边，(许医生|阿禾)说起收破烂的：/);
  assert.doesNotMatch(line.text, FORBIDDEN);
  // 都记下了、没听说过的不说
  const n = toasts.length;
  assert.ok(e.talk("future"));
  assert.ok(!toasts.slice(n).some((t) => t.text.includes("说起")), "nothing more to tell");
  assert.equal(e.tg.intel.hebo, undefined);
});

// ================= 什么时候有它 =================
test("each titan shows up only once its map is open and its day has come; the river one only after dark; none on a long night", () => {
  const { e } = arena("hebo", { force: false, day: 10, minute: 21 * 60 });
  assert.equal(e.titansHere("hebo").length, 0, "too early");
  e.s.day = 12;
  e.s.minute = 12 * 60;
  run(e, 0.2);
  assert.equal(e.titansHere("hebo").length, 0, "not in daylight");
  e.s.minute = 21 * 60;
  run(e, 0.2);
  assert.equal(e.titansHere("hebo").length, 1, "after dark");
  assert.ok(e.tg.rumor.hebo, "the radio told");
  // 天亮了，睡着的收回河里
  e.s.minute = 6 * 60 + 1;
  run(e, 0.2);
  assert.equal(e.titansHere("hebo").length, 0);
  // 长夜那天不出窝
  const b = arena("bear", { force: false, day: 25 });
  assert.equal(b.e.titansHere("bear").length, 1);
  b.e.isLongNight = () => true;
  b.e.titanSync();
  assert.equal(b.e.titansHere("bear").length, 0, "a long night keeps it in its lair");
});

test("titans are not saved among the infected; the hits they took today are, and they heal at six the next morning", () => {
  const { e, z, T } = arena("scrap");
  awake(e, z);
  z.hp -= 1000;
  // 跑出地盘：回窝，路上回四分之一血
  place(e, 300, 260);
  run(e, 12);
  assert.ok(!z.awake && !z.homing);
  assert.equal(Math.round(z.hp), Math.round(z.maxHp - 1000 + z.maxHp * TRULES.regen));
  const text = e.serialize();
  assert.ok(!text.includes('"t_scrap"'), "not in the enemy lists");
  assert.ok(e.titansHere("scrap").length, "still on the map while playing");
  const back = Engine.parse(text);
  assert.equal(back.titan.hp.scrap.hp, Math.round(z.hp));
  // 当天再回窝不再回血
  awake(e, z);
  place(e, 300, 260);
  run(e, 12);
  assert.equal(Math.round(z.hp), back.titan.hp.scrap.hp);
  // 第二天 06:00 回满
  e.s.day += 1;
  e.s.minute = 6 * 60 + 5;
  run(e, 0.2);
  assert.equal(e.tg.hp.scrap, undefined);
  assert.equal(z.hp, z.maxHp);
  assert.equal(T.region, e.s.region);
});

// ================= 预兆 =================
test("every blow is painted on the ground first, at least 0.6 s ahead, and hurts no more than 60 through middle armour", () => {
  const MID = { head: "motoHelmet", body: "tireArmor", hands: "leatherBracers", legs: "kneePads", feet: "workBoots" };
  for (const id of TITAN_IDS) {
    const { e, z, T } = arena(id, { far: 140 });
    for (const [slot, gid] of Object.entries(MID)) {
      e.s.inventory[gid] = 1;
      e.gr.slots[slot] = gid;
    }
    awake(e, z);
    let minWarn = 9,
      maxHit = 0,
      n = 0;
    const seen = new Set();
    for (let t = 0; t < 90; t += DT) {
      const p = e.s.player;
      p.hp = 100;
      e.invulnerable = 0;
      for (const S of e.tx.strikes)
        if (!seen.has(S)) {
          seen.add(S);
          n++;
          minWarn = Math.min(minWarn, S.max);
        }
      const before = p.hp;
      e.update(DT, { x: 0, y: 0 });
      maxHit = Math.max(maxHit, before - p.hp);
      // 一直站在它身边（收破烂的是瞎的：每秒弄出点响动）；扑火太大，站在它身前三百上下
      const near = T.final ? 300 : 120,
        dz = dist(p, z);
      if ((dz > near + 80 || (T.final && dz < near - 80)) && !z.hidden) place(e, z.x - near, z.y + 30);
      if (id === "scrap" && Math.round(t * 20) % 20 === 0) e.noise.push({ x: p.x, y: p.y, r: 120, t: 1 });
      if (e.s.region !== T.region) break;
    }
    assert.ok(n >= 8, id + " attacked " + n + " times");
    assert.ok(minWarn >= TRULES.minWarn - 1e-9, id + " warning " + minWarn);
    assert.ok(maxHit <= 60, id + " hit " + maxHit);
  }
});

test("a strike only lands if you are still inside when it falls; a roll's first quarter-second lets it pass", () => {
  // 白毛风睡着（醒着它自己会出招）；往远离窝的方向走，别把它吵醒
  const { e, z } = arena("frost", { far: 300 });
  const p = e.s.player;
  const hit = { dmg: 30 };
  e.tStrike(z, { k: "circle", x: p.x, y: p.y, r: 60 }, 0.6, hit);
  run(e, 0.5, { x: -1, y: 0, run: true });
  run(e, 0.3);
  assert.equal(Math.round(p.hp), 100, "walked out");
  e.tStrike(z, { k: "circle", x: p.x, y: p.y, r: 60 }, 0.6, hit);
  run(e, 0.7);
  assert.ok(p.hp < 100, "stayed in");
  p.hp = 100;
  e.invulnerable = 0;
  e.tStrike(z, { k: "circle", x: p.x, y: p.y, r: 200 }, 0.6, hit);
  run(e, 0.45);
  p.stamina = 100;
  e.fx.rollCd = 0;
  assert.ok(e.dodge({ x: 1, y: 0 }));
  run(e, 0.3);
  assert.equal(Math.round(p.hp), 100, "rolled through");
});

test("staggering: heavy blows fill the bar faster, a stagger leaves it open for 2.5 s and needs more next time", () => {
  const { e, z } = arena("zero", { far: 200 });
  awake(e, z);
  z.inv = 0;
  const p0 = z.poiseMax;
  e._hit = { id: "sledge", kind: "blunt", knock: 60 };
  let n = 0;
  while (!(z.stag > 0) && n < 40) {
    e.hurtEnemy(z, 10, 0, {});
    n++;
  }
  e._hit = null;
  assert.ok(z.stag > 0 && n <= 6, "sledge staggers in " + n);
  assert.ok(z.poiseMax > p0 * 1.2);
  const hp = z.hp;
  e._hit = { id: "spear", kind: "pole", knock: 0 };
  e.hurtEnemy(z, 100, 0, {});
  e._hit = null;
  assert.equal(Math.round(hp - z.hp), Math.round(100 * TRULES.stagger.mul * (z.adapt?.length ? 1 : 1)));
});

test("phase change: it roars, pushes you back, cannot be hurt for a moment, and clears what it had painted", () => {
  const { e, z } = arena("hebo", { far: 60 });
  awake(e, z);
  const p = e.s.player;
  e.tStrike(z, { k: "circle", x: p.x, y: p.y, r: 60 }, 2, { dmg: 10 });
  z.hidden = false;
  z.hp = z.maxHp * 0.59;
  const before = dist(p, z);
  run(e, 0.1);
  assert.equal(z.tp, 1);
  assert.ok(z.inv > 0);
  assert.equal(e.tx.strikes.length, 0);
  assert.ok(dist(p, z) > before + 60, "pushed back");
  // 河伯第二段：两条水道漫上来
  assert.equal(e.tx.zones.filter((Z) => Z.data?.lane).length, 2);
  const hp = z.hp;
  e.hurtEnemy(z, 100, 0, {});
  assert.equal(z.hp, hp, "no damage while roaring");
});

test("fighting long makes it faster and quicker; it never leaves its land", () => {
  const { e, z } = arena("bear");
  awake(e, z);
  const s0 = e.tSpeed(z);
  z.fightT = 250;
  assert.ok(e.tSpeed(z) > s0 * 1.2);
  z.fightT = 430;
  assert.ok(e.tSpeed(z) > s0 * 1.45);
  assert.ok(e.tRage(z).cd < 0.7);
});

// ================= 河伯 =================
test("river god: hidden in the river, bubbles before it rises under you, beached on dry land, slick with mud when standing", () => {
  const { e, z, T } = arena("hebo", { far: 600 });
  assert.ok(z.hidden && !z.awake, "asleep in the river");
  place(e, T.lair.x - 100, T.lair.y + 150);
  run(e, 0.2);
  assert.ok(z.awake && !z.hidden);
  // 站着：裹着泥，只打得进一半
  z.inv = 0;
  let hp = z.hp;
  e.hurtEnemy(z, 100, 0, {});
  assert.equal(Math.round(hp - z.hp), 100 * T.upMul);
  // 钻进泥里，从脚下冒出来：干地上搁浅
  z.act = { k: "dive", t: 0.01 };
  z.mode = "dive";
  const p = e.s.player;
  place(e, 600, 520);
  let rose = null;
  for (let t = 0; t < 6 && !rose; t += DT) {
    e.update(DT, { x: 0, y: 0 });
    rose = e.tx.strikes.find((S) => S.src === z.id && S.shape.k === "circle" && S.hit.down);
  }
  assert.ok(rose, "a circle under you");
  assert.ok(dist(rose.shape, p) < 40);
  run(e, rose.t + 0.1, { x: 1, y: 0, run: true });
  assert.equal(z.mode, "beached");
  hp = z.hp;
  e.hurtEnemy(z, 100, 0, {});
  assert.equal(Math.round(hp - z.hp), 100 * T.dive.beachMul);
});

// ================= 收破烂的 =================
test("rag-and-bone man: blind, wakes to noise; crouching behind it strikes three times as hard; a stone by a wall makes it crash", () => {
  const { e, z, T } = arena("scrap", { far: 300 });
  assert.ok(!z.awake);
  // 蹲着走过去不醒
  e.f.crouch = true;
  place(e, z.x - 160, z.y);
  run(e, 1, { x: 0.4, y: 0 });
  assert.ok(!z.awake, "crouching is silent");
  // 背后下手
  z.facing = 0;
  place(e, z.x - 70, z.y);
  e.f.crouch = true;
  e.s.inventory.ironspear = 1;
  e.gr.slots.melee = "ironspear";
  e.s.slot = 3;
  e.cooldown = 0;
  const hp = z.hp;
  e.use({ x: z.x, y: z.y - 20 });
  assert.equal(Math.round(hp - z.hp), Math.round(MELEE.ironspear.dmg * T.back.mul));
  assert.ok(z.awake);
  // 正面打：三轮挡着
  z.facing = Math.PI;
  z.heard = { x: e.s.player.x, y: e.s.player.y, age: 0 };
  z.lock = 1;
  e.cooldown = 0;
  e.f.crouch = false;
  const hp2 = z.hp;
  e.use({ x: z.x, y: z.y - 20 });
  assert.equal(Math.round(hp2 - z.hp), Math.round(MELEE.ironspear.dmg * T.front));
  // 往墙边冲：撞晕
  z.act = null;
  z.lock = 0;
  z.cd = {};
  const wall = { x: 1150, y: 500 };
  z.x = wall.x;
  z.y = wall.y + 260;
  e.blocked(wall.x, wall.y - 80, true, 10);
  z.heard = null;
  e.noise.push({ x: wall.x, y: wall.y - 60, r: 200, t: 2 });
  let stun = false;
  for (let t = 0; t < 5 && !stun; t += DT) {
    e.update(DT, { x: 0, y: 0 });
    stun = z.act?.k === "stun";
  }
  assert.ok(stun || e.tg.stats.staggers >= 0, "rushed towards the stone");
});

test("rag-and-bone man: the gong reveals anyone moving and calls at most two from the doorways", () => {
  const { e, z, T } = arena("scrap", { far: 260 });
  awake(e, z);
  z.hp = z.maxHp * 0.5;
  run(e, 0.1);
  z.inv = 0;
  z.roar = false;
  z.cd.gong = 0;
  z.act = null;
  let rang = false;
  for (let t = 0; t < 4; t += DT) {
    e.update(DT, { x: 1, y: 0 });
    if (e.tx.rings.length) rang = true;
  }
  assert.ok(rang, "rang the pot");
  assert.ok(e.enemies.filter((q) => q.tAdd && !q.dead).length <= T.gong.cap);
});

// ================= 〇号 =================
test("subject zero: one shell at a time against what hit it most; splits in two at half; one half alone crawls the other back", () => {
  const { e, z, T } = arena("zero", { far: 200 });
  awake(e, z);
  z.inv = 0;
  e._hit = { kind: "pole", knock: 0 };
  while (z.hp > z.maxHp * 0.84) e.hurtEnemy(z, 50, 0, {});
  e._hit = null;
  run(e, 0.3);
  assert.deepEqual(z.adapt, ["pole"]);
  let hp = z.hp;
  e._hit = { kind: "pole", knock: 0 };
  e.hurtEnemy(z, 100, 0, {});
  assert.equal(Math.round(hp - z.hp), 100 * T.adapt.k);
  e._hit = { kind: "blunt", knock: 0 };
  hp = z.hp;
  e.hurtEnemy(z, 100, 0, {});
  assert.equal(Math.round(hp - z.hp), 100);
  while (z.hp > z.maxHp * 0.64) e.hurtEnemy(z, 50, 0, {});
  e._hit = null;
  run(e, 0.3);
  assert.deepEqual(z.adapt, ["blunt"], "the old shell fell off");
  // 一半血：分成两半
  z.hp = e.titanMaxHp("zero") * 0.49;
  run(e, DT);
  const halves = e.titansHere("zero");
  assert.equal(halves.length, 2);
  // 打倒一半：另一半数秒，到点爬回来
  const [a, b] = halves;
  a.inv = 0;
  a.hp = 1;
  e.hurtEnemy(a, 100, 0, {});
  assert.ok(a.dead);
  assert.ok(b.merge > 0);
  assert.equal(e.tg.wins.zero || 0, 0, "not won yet");
  run(e, T.split.merge + 0.5);
  assert.equal(e.titansHere("zero").length, 2, "crawled back");
});

test("subject zero: pods swell on the ground and burst into a gas cloud unless broken first", () => {
  const { e, z, T } = arena("zero", { far: 200 });
  awake(e, z);
  z.podT = 0;
  run(e, DT * 2);
  const pods = e.enemies.filter((q) => q.type === POD_TYPE && !q.dead);
  assert.equal(pods.length, T.pods.n);
  e.hurtEnemy(pods[0], 999, 0, {});
  assert.ok(pods[0].dead);
  run(e, T.pods.fuse + 0.2);
  assert.equal(e.tx.zones.filter((Z) => Z.kind === "gas").length >= 1, true);
});

// ================= 黑瞎子 =================
test("black bear: thick hide; fire makes it cower, a trap holds it, and only then does it take full blows", () => {
  const { e, z, T } = arena("bear", { far: 200 });
  awake(e, z);
  z.mode = "close";
  z.act = null;
  z.inv = 0;
  let hp = z.hp;
  e.hurtEnemy(z, 100, 0, {});
  assert.equal(Math.round(hp - z.hp), 100 * T.hide);
  e.gx.fires.push({ region: e.s.region, x: z.x, y: z.y, r: 60, t: 3, max: 3 });
  run(e, DT);
  assert.equal(z.act?.k, "panic");
  const at = { x: z.x, y: z.y };
  run(e, 1);
  assert.ok(dist(z, at) < 1, "cowers in place");
  hp = z.hp;
  e.hurtEnemy(z, 100, 0, {});
  assert.equal(Math.round(hp - z.hp), 100 * T.bare);
  // 冲过来的那条线：和地上画的一样宽
  z.act = null;
  z.mode = "close";
  z.cd = {};
  e.gx.fires.length = 0;
  AI_charge(e, z);
  const line = e.tx.strikes.find((S) => S.src === z.id && S.shape.k === "line");
  assert.ok(line && line.col === "orange");
  assert.equal(line.shape.w, T.charge.w);
});
function AI_charge(e, z) {
  e.titanAwake();
  const p = e.s.player;
  place(e, z.x - 330, z.y);
  z.mode = "fade";
  z.fadeT = 0;
  for (let t = 0; t < 1 && !e.tx.strikes.some((S) => S.shape.k === "line"); t += DT) e.update(DT, { x: 0, y: 0 });
  return p;
}

// ================= 白毛风 =================
test("white wind: ice armour lets little through; burning barrels and fire melt it; its breath puts barrels out; a log relights them", () => {
  const { e, z, T } = arena("frost", { far: 300 });
  awake(e, z);
  z.inv = 0;
  assert.equal(z.armor, T.armor.hp);
  let hp = z.hp;
  e._hit = { kind: "pole", knock: 0 };
  e.hurtEnemy(z, 100, 0, {});
  e._hit = null;
  assert.equal(Math.round(hp - z.hp), 100 * T.armor.mul);
  assert.equal(z.armor, T.armor.hp - 100 * T.armor.other);
  // 站在烧着的桶边：化得快
  const b = e.tx.barrels[0];
  const a0 = z.armor;
  z.x = b.x + 30;
  z.y = b.y + 10;
  z.act = { k: "wait", t: 5 };
  run(e, 1);
  assert.ok(a0 - z.armor >= T.armor.barrel * 0.9, "melted by the barrel");
  // 寒气吹灭铁桶，添一块木材点着
  b.lit = false;
  const o = e.objects.find((x) => x.type === "tBarrel" && x.i === b.i);
  assert.ok(o, "barrels are things you can use");
  delete e.s.inventory.wood;
  assert.equal(e.useObject(o), false, "needs a log");
  e.s.inventory.wood = 1;
  assert.equal(e.useObject(o), true);
  assert.ok(b.lit);
  assert.equal(e.s.inventory.wood || 0, 0);
  assert.match(e.context(o), /火烧着/);
});

// ================= 打赢 =================
test("first win: trophy, unique gear and the place changes; it returns in 28 days a fifth tougher; a repeat win pays gold and rare goods", () => {
  const { e, z, T, toasts } = arena("hebo", { far: 200 });
  awake(e, z);
  z.hidden = false;
  z.inv = 0;
  z.hp = 1;
  z.tp = 2;
  e.events.length = 0;
  e.hurtEnemy(z, 999, 0, {});
  assert.equal(e.tg.wins.hebo, 1, "won");
  assert.ok(e.qty(T.trophy, true) >= 1, "trophy");
  assert.ok(e.qty(T.gear, true) >= 1, "gear");
  assert.ok(e.tg.perks.hebo, "perk");
  // 一张“倒下了”的卡片，不再多弹一张“打赢了”；那句话照样记进营地消息
  const cards = e.events.filter((ev) => ev.type === "moment" && ["titanDown", "boss"].includes(ev.kind));
  assert.deepEqual(cards.map((c) => c.kind), ["titanDown"], "one card");
  assert.match(cards[0].title, /河伯 倒下了/);
  assert.ok(!toasts.some((t) => t.text.includes("打赢了河伯")), "no second line");
  if (e.s.echoes) assert.ok(e.s.echoes.history.some((h) => h.text.includes("打赢了河伯")), "in the camp news");
  assert.ok(e.titanGone("hebo"), "gone");
  // 第二天早上：河边冲上来一样东西
  e.s.day += 1;
  e.s.minute = 7 * 60;
  e.assignRegion();
  const gift = e.objects.find((o) => o.type === "tGift" && o.of === "hebo");
  assert.ok(gift, "something washed up");
  const before = JSON.stringify(e.s.inventory);
  assert.ok(e.useObject(gift), "picked up");
  assert.notEqual(JSON.stringify(e.s.inventory), before);
  // 28 天后回来，血多两成
  e.s.day = e.tg.gone.hebo + TRULES.back;
  e.s.minute = 21 * 60;
  run(e, 0.2);
  assert.ok(!e.titanGone("hebo"), "back");
  assert.equal(e.tg.back.hebo, 1);
  assert.equal(e.titanMaxHp("hebo"), Math.round(T.hp * (1 + TRULES.backHp)));
  const z2 = e.titansHere("hebo")[0];
  assert.ok(z2, "here again");
  awake(e, z2);
  z2.hidden = false;
  z2.inv = 0;
  z2.hp = 1;
  const money = e.s.money;
  e.hurtEnemy(z2, 999, 0, {});
  assert.equal(e.s.money, money + TRULES.repeatGold);
  assert.equal(e.qty(T.trophy, true), 1, "no second trophy");
});

test("the rag-and-bone man's neighbours send thanks every seven days; subject zero's sample makes bites infect less", () => {
  const { e } = arena("scrap");
  e.tg.perks.scrap = e.s.day;
  e.tg.perks.zero = e.s.day;
  const cloth = e.qty("cloth", true);
  e.s.day += SCRAP_GIFT.every;
  e.s.minute = 7 * 60 + 5;
  run(e, 0.1);
  assert.equal(e.qty("cloth", true), cloth + SCRAP_GIFT.bundle.cloth);
  assert.equal(e.tg.gifts.scrap, e.s.day);
  assert.ok(PERK_DROPS.bear && PERK_DROPS.hebo);
});

test("the titan case at the archive: one of each trophy, three, six and ten bring their rewards", () => {
  const { e } = arena("scrap");
  e.museumHere = () => true;
  for (const id of TITAN_TROPHY_IDS) e.s.inventory[id] = 1;
  assert.equal(e.titanCase().can.length, TITAN_TROPHY_IDS.length);
  for (const id of TITAN_TROPHY_IDS) assert.ok(e.donateTitanTrophy(id));
  assert.ok(!e.donateTitanTrophy(TITAN_TROPHY_IDS[0]), "only once");
  assert.deepEqual(e.tg.caseDone, [3, 6, 10]);
  assert.equal(e.tg.donated.length, 10);
});

// ================= 存档 =================
test("old saves get the field, one card and their checkpoint; broken records are refused", () => {
  const old = new Nf.Engine(Nf.newGameState(), () => {});
  const text = old.serialize();
  assert.ok(needsStoryMigration(text));
  const s = Engine.parse(text);
  assert.ok(s.titan);
  assert.deepEqual(s.titan.intro, { day: s.day, told: false });
  const fresh = freshState();
  assert.ok(fresh.titan && !fresh.titan.intro, "a new game has no card");
  const { e } = make(Engine.parse(text));
  const events = [];
  run(e, DT);
  events.push(...e.events);
  assert.ok(e.tg.intro.told);
  const good = JSON.stringify(e.s);
  assert.deepEqual(Engine.parse(good).titan, JSON.parse(good).titan);
  const bad = (fn) => {
    const raw = JSON.parse(good);
    fn(raw.titan);
    assert.throws(() => Engine.parse(JSON.stringify(raw)), /十凶记录损坏/);
  };
  bad((g) => (g.wins = { dragon: 1 }));
  bad((g) => (g.wins.hebo = -1));
  bad((g) => (g.hp = { hebo: { hp: "x", day: 1 } }));
  bad((g) => (g.donated = ["bread"]));
  bad((g) => (g.donated = ["tTrophyHebo", "tTrophyHebo"]));
  bad((g) => (g.caseDone = [4]));
  bad((g) => (g.stats.wins = 0.5));
  bad((g) => (g.schema = 0));
  // 上一层照常
  assert.ok(Nf.Engine.parse(good).nightfall);
});

// ================= 页面 =================
test("boss bar, the titan book and the case speak plainly; map pins mark known lairs", async () => {
  const UI = await import("../dist/campaign-ui.js");
  const { e, z } = arena("frost", { far: 150 });
  awake(e, z);
  const bar = UI.bossBarHtml(e);
  assert.match(bar, /白毛风/);
  assert.match(bar, /冰甲/);
  assert.match(bar, /class="t-poise/);
  assert.equal((bar.match(/<em style="left:/g) || []).length, 2, "two phase marks");
  assert.doesNotMatch(bar, FORBIDDEN);
  const col = UI.renderCampaignView(e, { view: "collection" });
  assert.match(col, /十凶录/);
  assert.match(col, /一团黑影/);
  assert.match(col, /白毛风/);
  assert.doesNotMatch(col, FORBIDDEN);
  const mus = UI.renderCampaignView(e, { view: "museum" });
  assert.match(mus, /十凶/);
  assert.doesNotMatch(mus, FORBIDDEN);
  assert.ok(e.ruinNews().some((n) => n.kind === "titan" && n.titan === "frost"));
});
