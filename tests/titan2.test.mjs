// v0.37.0「扑火」：后五凶各自的那一招（雕爷和看门的、黑潮、风口、末班车、扑火），有几只的那几凶按只记血、读档补回来，
// 最后一夜（提前三天说、那天另有仗往后挪、22:00 在农场打起来、走不开睡不着、守卫上塔、钟慢一半、没守住的三种结局、打赢的结局卡），
// 打赢以后地方的变化（雕爷的库存只有一回、沉湾的鱼、居住舱两张床、防毒面具）、存档。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, needsStoryMigration } from "../dist/campaign.js";
import { TITANS, TITAN_IDS, FINAL, FINAL_TEXT, FINAL_END, PERK_DROPS, VENT_BEDS, SMOKE_CUT, TITAN_ARMOR, partKeys, mainPart, TITAN_SCHEMA } from "../dist/titan-data.js";
import { CORE_IDS } from "../dist/relight-data.js";

const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const DT = 0.05;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const make = (state = freshState(), seed = 37001) => {
  state.undertow.seed = seed;
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  return { e, toasts };
};
// 在某一凶的图上（跟 titan.test.mjs 的一样，多了隧道第 25 层和农场）
function arena(id, { day = 60, minute = 600, far = 420, force = true, seed = 37001 } = {}) {
  const st = freshState();
  st.day = day;
  st.minute = minute;
  const { e, toasts } = make(st, seed);
  const T = TITANS[id];
  if (force) e._tForce = id;
  if (["pinewood", "frost", "shipyard", "shelter"].includes(T.region)) e.b.unlocked[T.region] = true;
  else if (T.region === "tunnel") Object.assign(e.rl.tunnel, { key: { floor: T.floor, day, luck: false }, floor: T.floor, deepest: T.floor });
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
const one = (e, id, p) => e.titansHere(id).find((z) => z.part === p) || null;
const all = (e, id, p) => e.titansHere(id).filter((z) => z.part === p);
// 打一下，看掉了多少（近战：长矛；远程：弩；火：烧）
function hit(e, z, n, kind = "pole", angle = 0) {
  const before = z.hp;
  z.inv = 0;
  z.stag = 0;
  if (kind === "ranged") e.hurtEnemy(z, n, angle, { bow: true });
  else if (kind === "fire") {
    e._tFire = true;
    try {
      e.dotHurt(z, n);
    } finally {
      e._tFire = false;
    }
  } else {
    e._hit = { id: "ironspear", kind, knock: 36 };
    try {
      e.hurtEnemy(z, n, angle, {});
    } finally {
      e._hit = null;
    }
  }
  z.stag = 0;
  return Math.round((before - z.hp) * 100) / 100;
}
// 让最后一凶开得出来：主线打完、七凶打赢、三颗余烬核
function finalReady(e) {
  if (!e.sc.claimed.includes("act8")) e.sc.claimed.push("act8");
  for (const id of TITAN_IDS.slice(0, 7)) e.tg.first[id] ||= 1;
  for (const id of CORE_IDS.slice(0, 3)) e.grantCore(id);
  e.isLongNight = () => false;
}
// 在农场：营火在、三个守卫会上塔
function farmGame({ day = 60, minute = 6 * 60 + 50 } = {}) {
  const st = freshState();
  st.day = day;
  st.minute = minute;
  st.weather = "晴朗";
  const { e, toasts } = make(st);
  e.s.region = "farm";
  e.assignRegion();
  e.sc.camp = e.campSite?.() || { x: 560, y: 735 };
  for (const rid of ["farmer", "medic", "mechanic"]) e.recruit(rid);
  e.residentsCapacity = () => 5;
  for (const r of e.c.residents) {
    r.fed = true;
    r.priorities.guard = 1;
  }
  if (e.dy) e.dy.pending = null;
  finalReady(e);
  return { e, toasts };
}

// ================= 有几只的那几凶 =================
test("titans in parts: every part is its own creature with its own name and health, the parts add up to the titan, and the bar shows one strip each", () => {
  for (const id of ["diao", "vent", "train", "moth"]) {
    const { e, T, z } = arena(id);
    const keys = partKeys(id),
      here = e.titansHere(id);
    assert.equal(here.length, keys.length, id + " parts");
    assert.deepEqual(here.map((q) => q.pkey).sort(), [...keys].sort(), id);
    assert.equal(z.part, mainPart(id), id + " main part first");
    assert.equal(z.type, T.type);
    const total = here.reduce((a, q) => a + q.maxHp, 0);
    assert.ok(Math.abs(total - T.hp) <= keys.length, id + " parts add up: " + total + " vs " + T.hp);
    e.titanWake(z);
    assert.ok(here.every((q) => q.awake), id + " all wake together");
    const bar = e.bossBar();
    assert.equal(bar.kind, "titan");
    assert.equal(bar.parts.length, keys.length);
    assert.deepEqual(bar.phases, [], id + " the parts decide the phases");
    for (const P of bar.parts) assert.ok(P.name && P.max > 0 && P.hp === P.max, id + " " + P.key);
  }
});

test("a titan in parts remembers each part's damage for the day: leave and come back, a broken part stays broken; at six the next morning all are back", () => {
  const { e, z } = arena("vent");
  e.titanWake(z);
  const lungs = all(e, "vent", "lung");
  hit(e, lungs[0], 99999, "ranged");
  hit(e, lungs[1], 150, "ranged");
  hit(e, z, 400, "ranged");
  assert.equal(all(e, "vent", "lung").length, 3, "one lung broken");
  // 走开（回农场）：每一只回窝、回自己的四分之一血，按只记一笔
  e._tForce = null;
  e.invulnerable = 999;
  assert.ok(e.travel("farm"));
  const rec = e.tg.hp.vent;
  assert.ok(rec && rec.day === e.s.day && rec.parts, "recorded by part");
  assert.equal(rec.parts.lung0, 0, "the broken one is 0");
  assert.equal(rec.parts.lung1, Math.round(Math.min(lungs[1].maxHp, lungs[1].maxHp - 150 + lungs[1].maxHp * 0.25)), "a quarter back");
  // 存档读回（记录里每一只都是整数）
  const back = Engine.parse(e.serialize());
  assert.deepEqual(back.titan.hp.vent.parts, rec.parts);
  // 当天再来：打破的那个还是破的，打过的那几只照旧
  e._tForce = "vent";
  assert.ok(e.travel("shelter"));
  e.enemies = e.s.enemies.shelter = e.enemies.filter((q) => q.titan);
  run(e, 0.1);
  const again = e.titansHere("vent");
  assert.equal(all(e, "vent", "lung").length, 3, "still three lungs");
  assert.ok(!again.some((q) => q.pkey === "lung0"));
  assert.equal(Math.round(one(e, "vent", "fan").hp), Math.min(rec.parts.fan, one(e, "vent", "fan").maxHp));
  // 第二天 06:00：都回来了
  e.s.day += 1;
  e.s.minute = 6 * 60 + 5;
  run(e, 0.2);
  assert.equal(e.tg.hp.vent, undefined);
  assert.equal(all(e, "vent", "lung").length, 4, "all four back");
  assert.ok(e.titansHere("vent").every((q) => q.hp === q.maxHp));
});

test("broken part records are refused when a save is read", () => {
  const { e, z } = arena("train");
  e.titanWake(z);
  hit(e, all(e, "train", "car")[0], 200);
  // 存档时当天打掉的按只记一笔
  const good = e.serialize();
  assert.ok(Engine.parse(good).titan.hp.train.parts);
  const bad = (fn) => {
    const raw = JSON.parse(good);
    fn(raw.titan);
    assert.throws(() => Engine.parse(JSON.stringify(raw)), /十凶记录损坏/);
  };
  bad((g) => (g.hp.train.parts.car9 = 10));
  bad((g) => (g.hp.train.parts.head = 1.5));
  bad((g) => (g.hp.train.parts.car0 = -3));
  bad((g) => (g.final.on = "x"));
  bad((g) => (g.intro2 = { day: 1, told: "no" }));
});

// ================= 第六凶：雕爷和看门的 =================
test("雕爷 and 看门的: the chain holds the brute near the boss; the coat turns blows from the front unless he is aiming; whoever falls first changes the other", () => {
  const { e, T } = arena("diao", { far: 300 });
  const dog = one(e, "diao", "dog"),
    boss = one(e, "diao", "boss");
  assert.ok(dog && boss && boss.coat, "both, the boss in his coat");
  e.titanWake(dog);
  // 链子：你跑得再远，看门的也离雕爷不过链子那么长
  place(e, boss.x - 700, boss.y);
  e.invulnerable = 999;
  let far = 0;
  for (let t = 0; t < 12; t += DT) {
    e.update(DT, { x: 0, y: 0 });
    far = Math.max(far, dist(dog, boss));
    if (dog.act?.k === "charge" || dog.act?.k === "chargeWind") continue;
  }
  assert.ok(far <= T.chain + 40, "held by the chain: " + Math.round(far));
  // 大氅：正面挡七成，侧面、背后不挡；他瞄你的那一下大氅敞着
  boss.act = null;
  boss.facing = 0;
  assert.equal(hit(e, boss, 100, "pole", Math.PI), 100 * T.coat.front, "from the front");
  assert.equal(hit(e, boss, 100, "pole", Math.PI / 2), 100, "from the side");
  boss.act = { k: "aim", t: 1, lock: 0 };
  boss.facing = 0;
  assert.equal(hit(e, boss, 100, "pole", Math.PI), 100, "aiming: the coat is open");
  boss.act = null;
  // 雕爷先倒下：看门的挣断链子、嘴套掉了，快一半
  boss.hp = 1;
  hit(e, boss, 999, "pole", Math.PI / 2);
  assert.ok(!one(e, "diao", "boss"), "the boss is down");
  assert.ok(e.titansHere("diao").length === 1 && one(e, "diao", "dog"), "the fight goes on");
  run(e, 2.5);
  assert.equal(dog.tp >= 1, true, "the next phase");
  assert.ok(dog.speedK >= T.free.speed - 0.001, "free of the chain: " + dog.speedK);
  assert.equal(e.tg.wins.diao || 0, 0, "not won yet");
});

test("雕爷 calls his men from the yard gates (never more than three) and throws smoke: shots into the smoke do half; his men are never saved", () => {
  const { e, T } = arena("diao", { far: 300 });
  const boss = one(e, "diao", "boss"),
    dog = one(e, "diao", "dog");
  e.titanWake(dog);
  e.invulnerable = 999;
  for (let i = 0; i < 4; i++) {
    boss.menT = 0;
    run(e, 0.1);
  }
  const men = e.enemies.filter((q) => q.tMan && !q.dead);
  assert.ok(men.length >= 2 && men.length <= T.adds.cap, "men: " + men.length);
  assert.ok(men.every((q) => q.type === "raider" && q.tOf === "diao"));
  // 烟：远程打进烟里只进一半（雕爷、手下都一样），近战照旧
  boss.smokeT = 0;
  run(e, 0.1);
  const smoke = e.tx.zones.find((Z) => Z.kind === "smoke");
  assert.ok(smoke, "a smoke cloud");
  Object.assign(boss, { x: smoke.x, y: smoke.y });
  boss.facing = Math.PI;
  boss.act = null;
  assert.equal(hit(e, boss, 100, "ranged", Math.PI / 2), 100 * SMOKE_CUT);
  const m = men[0];
  Object.assign(m, { x: smoke.x + 10, y: smoke.y });
  const hp0 = m.hp;
  e.hurtEnemy(m, 20, 0, { bow: true });
  assert.equal(Math.round(hp0 - m.hp), 20 * SMOKE_CUT, "a man in the smoke");
  // 存档里没有他的人
  const back = Engine.parse(e.serialize());
  assert.ok(!Object.values(back.enemies || {}).some((l) => Array.isArray(l) && l.some((q) => q.tMan || q.titan)));
  // 打赢：他的人散了
  for (const q of e.titansHere("diao")) {
    q.hp = 1;
    hit(e, q, 999, "pole", Math.PI / 2);
  }
  assert.equal(e.tg.wins.diao, 1);
  assert.ok(!e.enemies.some((q) => q.tMan && !q.dead), "his men scattered");
});

test("雕爷's stash: once he is beaten, a crate in the freight yard that can be taken only once", () => {
  const { e } = arena("diao", { force: false });
  assert.ok(PERK_DROPS.diao.once);
  e.tg.perks.diao = e.s.day;
  e.titanPerkObjects();
  const o = e.objects.find((q) => q.type === "tGift" && q.of === "diao");
  assert.ok(o, "the stash is there");
  const ammo = e.qty("ammo", true);
  assert.ok(e.useObject(o));
  assert.ok(e.qty("ammo", true) > ammo, "taken");
  assert.equal(e.useObject(o), false, "only once");
  e.objects = e.objects.filter((q) => q !== o);
  e.s.day += 3;
  e.titanPerkObjects();
  assert.ok(!e.objects.some((q) => q.type === "tGift" && q.of === "diao"), "never comes back");
});

// ================= 第七凶：黑潮 =================
test("黑潮: its wet suit shrugs off fire, then once the suit breaks blades slip off and fire burns it fast; standing in burning oil sets it alight", () => {
  const { e, T, z } = arena("tide", { far: 300 });
  e.titanWake(z);
  e.invulnerable = 999;
  assert.equal(hit(e, z, 100, "fire"), 0, "the wet suit does not burn");
  assert.equal(hit(e, z, 100, "pole"), 100, "but takes blows");
  // 第二段
  z.hp = z.maxHp * (T.phases[0] - 0.02);
  run(e, 0.1);
  z.inv = 0;
  assert.equal(z.tp, 1);
  assert.equal(hit(e, z, 100, "pole"), 100 * T.slick, "blows slip off the oil");
  assert.equal(hit(e, z, 100, "fire"), 100, "fire bites");
  // 站进着了的油里：每秒一大截，身上着起来
  const hp = z.hp;
  e.tZone("fire", { x: z.x, y: z.y, r: 90 }, 4, { dps: 8, by: "t_tide", of: "tide" });
  z.act = { k: "wait", t: 3 };
  run(e, 1);
  assert.ok(hp - z.hp >= T.burnHp * 0.8, "burned " + Math.round(hp - z.hp));
  assert.ok(z.aflame > 0, "alight");
  // 第三段：油烧干了，打得进
  z.hp = z.maxHp * (T.phases[1] - 0.02);
  run(e, 0.1);
  z.inv = 0;
  assert.equal(z.tp, 2);
  assert.equal(hit(e, z, 100, "pole"), 100);
});

test("oil on the ground: it slows you and clings for a few seconds; a molotov's fire lights it and the fire runs along touching puddles", () => {
  const { e, T } = arena("tide", { far: 500 });
  const p = e.s.player;
  const a = e.tZone("oil", { x: p.x, y: p.y, r: T.oil.r }, T.oil.t, { slow: T.oil.slow, coat: T.oil.coat, of: "tide" }),
    b = e.tZone("oil", { x: p.x + 100, y: p.y, r: T.oil.r }, T.oil.t, { slow: T.oil.slow, coat: T.oil.coat, of: "tide" }),
    c = e.tZone("oil", { x: p.x + 600, y: p.y, r: T.oil.r }, T.oil.t, { slow: T.oil.slow, coat: T.oil.coat, of: "tide" });
  run(e, 0.2);
  assert.ok(e.tx.oiled > 0, "oil clings to you");
  // 燃烧瓶落在第一滩上
  e.gx.fires.push({ x: a.x, y: a.y, r: 60, t: 3, region: e.s.region });
  run(e, 0.1);
  assert.equal(a.kind, "fire", "lit");
  assert.equal(b.kind, "fire", "the touching puddle caught");
  assert.equal(c.kind, "oil", "the far one did not");
  // 身上沾着油站在火里：烫得更狠
  const hp = p.hp;
  e.invulnerable = 0;
  run(e, 0.5);
  assert.ok(hp - p.hp >= T.oil.oiledDps * 0.5 * 0.6, "burned " + (hp - p.hp));
});

test("beating 黑潮: the oil leak is stopped and the fish of the sunken bay no longer need testing", () => {
  const { e, z } = arena("tide");
  e.titanWake(z);
  z.hp = 1;
  hit(e, z, 999);
  assert.equal(e.tg.wins.tide, 1);
  assert.equal(e.kin?.waters?.sea, true);
  assert.ok(e.qty("tideHelm", true) >= 1 && e.qty("tTrophyTide", true) >= 1);
});

// ================= 第八凶：风口 =================
test("风口: while its four lungs live the fan barely takes hits, the wire net turns arrows; with the lungs gone the blades spin over the floor and stop the sucking", () => {
  const { e, T, z } = arena("vent", { far: 300 });
  e.titanWake(z);
  e.invulnerable = 999;
  assert.equal(all(e, "vent", "lung").length, 4);
  assert.ok(all(e, "vent", "lung").every((q) => q.front && q.still));
  assert.equal(hit(e, z, 100, "pole"), 100 * T.shield, "lungs up: the fan barely moves");
  assert.equal(hit(e, z, 100, "ranged"), 100 * T.shield * T.net, "and the net turns arrows");
  const L = all(e, "vent", "lung")[0];
  assert.equal(hit(e, L, 100, "ranged"), 100, "the lungs have no net");
  for (const q of all(e, "vent", "lung")) {
    q.hp = 1;
    hit(e, q, 999, "ranged");
  }
  run(e, 0.2);
  z.inv = 0;
  assert.equal(z.tp, 1, "blades");
  assert.equal(hit(e, z, 100, "pole"), 100, "now it takes blows");
  assert.equal(hit(e, z, 100, "ranged"), 100 * T.net, "arrows still meet the net");
  const a0 = z.bladeA;
  z.cd.suck = 0;
  run(e, 1);
  assert.ok(z.bladeA > a0, "the blades turn");
  assert.notEqual(z.act?.k, "suckWind", "no sucking while the blades spin");
  // 最后一口气：又吸起来
  z.hp = z.maxHp * (T.last - 0.02);
  z.cd.suck = 0;
  z.act = null;
  place(e, z.x, z.y + 260);
  let sucked = false;
  for (let t = 0; t < 4 && !sucked; t += DT) {
    e.update(DT, { x: 0, y: 0 });
    sucked = ["suckWind", "suck"].includes(z.act?.k);
  }
  assert.equal(z.tp, 2);
  assert.ok(sucked, "the last breath sucks again");
});

test("beating 风口: the shelter's air is clean and two more beds; the gas mask keeps gas from hurting you and your breath steady, the diving helmet halves it", () => {
  const { e, z } = arena("vent");
  const beds = e.residentsCapacity();
  e.titanWake(z);
  for (const q of [...all(e, "vent", "lung"), z]) {
    q.hp = 1;
    hit(e, q, 999, "ranged");
  }
  assert.equal(e.tg.wins.vent, 1);
  assert.equal(e.residentsCapacity(), beds + VENT_BEDS);
  assert.ok(e.qty("ventMask", true) >= 1);
  // 面具：毒雾里不掉血、体力照样回
  const p = e.s.player;
  e.s.inventory.ventMask = 1;
  e.gr.slots.head = "ventMask";
  assert.equal(e.tGasK(), 0);
  e.tZone("gas", { x: p.x, y: p.y, r: 120 }, 9, { dps: 10, of: "test" });
  p.hp = 80;
  p.stamina = 40;
  e.invulnerable = 0;
  run(e, 1);
  assert.equal(Math.round(p.hp), 80, "no harm");
  assert.ok(p.stamina > 40, "breath steady");
  // 潜水头盔：掉一半
  e.s.inventory.tideHelm = 1;
  e.gr.slots.head = "tideHelm";
  assert.equal(e.tGasK(), TITAN_ARMOR.tideHelm.gas);
});

// ================= 第九凶：末班车 =================
test("末班车 lives on the 25th floor only; while it is there the floor has no other infected", () => {
  const { e, T } = arena("train");
  assert.equal(e.titansHere("train").length, partKeys("train").length);
  assert.deepEqual(e.generateEnemies("tunnel"), [], "no other infected on its floor");
  // 换到第 24 层：没有它
  e.rl.tunnel.floor = 24;
  e.rl.tunnel.key = { floor: 24, day: e.s.day, luck: false };
  run(e, 0.1);
  assert.equal(e.titansHere("train").length, 0, "not on another floor");
  assert.equal(T.floor, 25);
});

test("末班车: a light in the dark and the rails hum before it runs the track; stopped, the cars take blows but the head barely does while they hold; all cars gone, it leaves the rails", () => {
  const { e, T, z } = arena("train", { far: 300 });
  const head = z;
  e.titanWake(head);
  e.invulnerable = 999;
  // 进站之前：整条轨道一道橙色，至少 1.6 秒
  let warn = null;
  for (let t = 0; t < 20 && !warn; t += DT) {
    e.update(DT, { x: 0, y: 0 });
    warn = e.tx.strikes.find((S) => S.titan === "train" && S.shape.k === "rect" && S.col === "orange" && S.shape.w >= 1400);
  }
  assert.ok(warn, "the track lights up first");
  assert.ok(warn.max >= T.run.warn - 1e-9, "warned " + warn.max);
  // 停在你跟前：车厢连着，车头只打得进一成；车厢照常
  let stopped = false;
  for (let t = 0; t < 30 && !stopped; t += DT) {
    e.update(DT, { x: 0, y: 0 });
    stopped = head.act?.k === "stop" && !head.hidden;
  }
  assert.ok(stopped, "it stops by you");
  assert.ok(Math.abs(head.x - e.s.player.x) < 200, "head first, right by you");
  assert.equal(hit(e, head, 100), 100 * T.linked);
  const car = all(e, "train", "car")[0];
  assert.equal(hit(e, car, 100), 100);
  for (const q of all(e, "train", "car")) {
    q.hp = 1;
    hit(e, q, 999);
  }
  run(e, 0.3);
  head.inv = 0;
  assert.ok(head.tp >= 1 && head.derailed, "off the rails");
  assert.equal(hit(e, head, 100), 100, "the head takes blows now");
  head.hp = 1;
  hit(e, head, 999);
  assert.equal(e.tg.wins.train, 1);
  assert.ok(e.qty("spikeMaul", true) >= 1 && e.tg.perks.train);
});

// ================= 最后一凶：扑火 =================
test("扑火: the four lights shield its body; arrows break the lights fast, but not while one is dim; all out, the mountain falls into waves with one gap, then the heart shows", () => {
  const { e, T, z } = arena("moth", { minute: 22 * 60 + 10, far: 500 });
  const body = z;
  e.titanWake(body);
  e.invulnerable = 999;
  assert.equal(all(e, "moth", "light").length, 4);
  assert.equal(hit(e, body, 100, "ranged"), 100 * T.shield, "the lights shield it");
  const L = all(e, "moth", "light")[0];
  L.dim = false;
  assert.equal(hit(e, L, 100, "ranged"), 100 * T.lightRanged, "arrows break the light");
  L.dim = true;
  assert.equal(hit(e, L, 100, "ranged"), 100 * T.lightRanged * T.pulse.dim, "not while it is dim");
  L.dim = false;
  for (const q of all(e, "moth", "light")) {
    q.dim = false;
    q.hp = 1;
    hit(e, q, 999, "ranged");
  }
  run(e, 0.2);
  assert.ok(body.hidden && body.act?.k === "collapse", "it falls down");
  let waves = 0,
    gap = null;
  for (let t = 0; t < 20 && !body.heart; t += DT) {
    e.update(DT, { x: 0, y: 0 });
    for (const w of e.tx.waves) if (!w.seen) {
      w.seen = true;
      waves++;
      gap = w.gy1 - w.gy0;
    }
  }
  assert.equal(waves, T.wave.n, "three waves");
  assert.equal(gap, T.wave.gap, "each with one gap");
  assert.ok(body.heart && !body.hidden, "the heart shows");
  body.inv = 0;
  assert.equal(hit(e, body, 100), 100, "and takes blows");
});

test("the heart's last sliver (under a tenth) crawls for the fire; shoving and traps slow it; reaching the fire ends the night as lost", () => {
  const { e, toasts } = farmGame({ minute: 22 * 60 });
  e.tg.final.day = e.s.day;
  run(e, 0.2);
  assert.ok(e.finalLive());
  const M = TITANS.moth,
    body = one(e, "moth", "body");
  for (const q of all(e, "moth", "light")) q.dead = true;
  e.enemies = e.s.enemies.farm = e.enemies.filter((q) => !q.dead);
  Object.assign(body, { hidden: false, heart: true, act: null, inv: 0, awake: true, r: M.heart.r });
  body.hp = body.maxHp * (M.crawl.at - 0.01);
  e.invulnerable = 999;
  const fire = e.fireSpot();
  Object.assign(body, { x: fire.x + 260, y: fire.y });
  run(e, 2);
  assert.equal(body.tp, 2, "crawling");
  const d0 = dist(body, fire);
  run(e, 3);
  const d1 = dist(body, fire);
  assert.ok(d1 < d0 - M.crawl.speed * 2, "toward the fire: " + Math.round(d0) + " → " + Math.round(d1));
  // 推一下：慢下来
  place(e, body.x - 40, body.y);
  e.s.player.stamina = 100;
  e.s.player.facing = Math.atan2(body.y - e.s.player.y, body.x - e.s.player.x);
  e.gx.shoveCd = 0;
  e.shove();
  assert.ok(body.crawlSlow > 0, "slowed by a shove");
  // 扑到了：这一夜没守住
  const lost = e.tg.final.lost;
  Object.assign(body, { x: fire.x + M.crawl.reach + 10, y: fire.y, crawlSlow: 0 });
  run(e, 2);
  assert.equal(e.tg.final.lost, lost + 1);
  assert.equal(e.finalLive(), false);
  assert.equal(e.titansHere("moth").length, 0, "back into the woods");
  assert.ok(toasts.some((t) => t.text.includes("篝火被扑灭了")));
  assert.equal(e.tg.final.day, e.s.day + FINAL.retry, "seven days later");
});

test("the final night by the clock: told three days ahead, a busy day pushes it on, the morning and 21:00 lines, no sleeping through it, and at 22:00 you are called home", () => {
  const { e, toasts } = farmGame();
  const d = e.s.day;
  assert.ok(e.titanOpen("moth"), "seven won, three cores, the story done");
  assert.equal(e.tg.final.day, 0);
  e.s.minute = 7 * 60 + 1;
  run(e, 0.2);
  assert.equal(e.tg.final.day, d + FINAL.notice, "three days ahead");
  assert.ok(toasts.some((t) => t.text.includes("（第 " + (d + 3) + " 天）夜里 22:00")), "the radio says the day");
  // 那一天另有一场长夜：往后挪一天
  e.isLongNight = (day = e.s.day) => day === d + 3;
  e.s.day = d + 3;
  e.s.minute = 7 * 60;
  run(e, 0.2);
  assert.equal(e.tg.final.day, d + 4, "pushed by a long night");
  assert.ok(toasts.some((t) => t.text.includes("往后挪一天")));
  e.isLongNight = () => false;
  // 那天早上、21:00
  e.s.day = d + 4;
  e.s.minute = 7 * 60 + 1;
  run(e, 0.2);
  assert.ok(toasts.some((t) => t.text === FINAL_TEXT.morning));
  assert.equal(e.sleep(), false, "no sleeping on the day");
  e.s.minute = FINAL.warn + 1;
  run(e, 0.2);
  assert.ok(toasts.some((t) => t.text === FINAL_TEXT.warn));
  // 21:30 在溪谷：22:00 被叫回农场
  e.d.unlocked.valley = true;
  assert.ok(e.travel("valley"));
  assert.equal(e.s.region, "valley");
  e.s.minute = FINAL.hour - 1;
  run(e, 0.2);
  e.s.minute = FINAL.hour;
  run(e, 0.2);
  assert.equal(e.s.region, "farm", "called home");
  assert.ok(e.finalLive());
  assert.equal(e.tg.final.tries, 1);
  assert.ok(toasts.some((t) => t.text === FINAL_TEXT.home));
  assert.ok(e.titansHere("moth").length, "it came");
});

test("during the final night: the guards man the towers, the clock runs at half speed, you cannot leave or sleep; dawn sends it back keeping half the damage, and the next try starts that much weaker", () => {
  const { e, toasts } = farmGame({ minute: 21 * 60 + 59 });
  e.tg.final.day = e.s.day;
  e.s.minute = FINAL.hour;
  // 这一项量的是钟、守卫、天亮，不是挨打：人不会倒下（扑火的巨手、扔过来的感染者打不着）
  e.invulnerable = 1e9;
  run(e, 0.2);
  assert.ok(e.finalLive());
  // 这一夜只有它：夜行者不来摸农场
  assert.ok(!e.enemies.some((q) => q.prowl), "no night stalkers");
  e.ut.prowl = null;
  e.ut.prowlSpawned = null;
  e.tickProwl();
  assert.ok(!e.enemies.some((q) => q.prowl), "none come later either");
  assert.ok(e._fGuards?.length >= 3, "the guards");
  assert.ok(e.c.residents.filter((r) => e._fGuards.includes(r.id)).every((r) => r.workRole === "guard" && r.status === "守最后一夜"));
  assert.ok(e.c.residents.filter((r) => e._fGuards.includes(r.id)).every((r) => e.residentActive(r) || !e._tDef), "on the towers at defence time");
  // 钟慢一半
  const m0 = e.s.day * 1440 + e.s.minute;
  run(e, 10);
  const m1 = e.s.day * 1440 + e.s.minute;
  const st = freshState();
  st.day = 60;
  st.minute = 12 * 60;
  const { e: e2 } = make(st);
  e2.s.region = "farm";
  e2.assignRegion();
  const n0 = e2.s.day * 1440 + e2.s.minute;
  run(e2, 10);
  const n1 = e2.s.day * 1440 + e2.s.minute;
  assert.ok(Math.abs((m1 - m0) - (n1 - n0) * FINAL.clock) < 0.6, "half speed: " + (m1 - m0).toFixed(2) + " vs " + (n1 - n0).toFixed(2));
  // 走不开、睡不着
  e.d.unlocked.valley = true;
  assert.equal(e.travel("valley"), false);
  assert.ok(toasts.some((t) => t.text === FINAL_TEXT.travel));
  assert.equal(e.sleep(), false);
  // 打掉四成，天快亮了：退回去，伤留一半（两成），7 天后再来
  const parts = e.titansHere("moth");
  const max = e.titanMaxHp("moth");
  let cut = max * 0.4;
  for (const q of parts) {
    const take = Math.min(cut, q.hp - 1);
    q.hp -= take;
    cut -= take;
  }
  e.s.day += 1;
  e.s.minute = FINAL.dawn;
  run(e, 0.2);
  assert.equal(e.finalLive(), false, "dawn");
  assert.equal(e.tg.final.lost, 1);
  assert.ok(Math.abs(e.tg.final.keep - 0.2) < 0.01, "keeps half: " + e.tg.final.keep);
  assert.equal(e.tg.final.day, e.s.day - 1 + FINAL.retry);
  assert.ok(toasts.some((t) => t.text.includes("天快亮了")));
  assert.equal(e._fGuards, null, "the guards stand down");
  // 下一回：一开始就少两成
  e.s.day = e.tg.final.day;
  e.s.minute = FINAL.hour;
  run(e, 0.2);
  assert.ok(e.finalLive());
  const hp = e.titansHere("moth").reduce((a, q) => a + q.hp, 0);
  assert.ok(Math.abs(hp / max - 0.8) < 0.02, "starts weaker: " + (hp / max).toFixed(3));
});

test("on the final night the towers shoot what they can hurt — the lights, then the heart — never the shielded body, and take their bullets from the storage first", () => {
  const { e } = farmGame({ minute: FINAL.hour });
  e.tg.final.day = e.s.day;
  run(e, 0.2);
  assert.ok(e.finalLive());
  e.enemies = e.s.enemies.farm = e.enemies.filter((q) => q.titan === "moth");
  const body = one(e, "moth", "body"),
    lights = all(e, "moth", "light");
  const at = e.freePoint(body.x - 190, body.y - 150);
  e.s.buildings.push({ id: "test-tower", type: "tower", x: Math.round(at.x), y: Math.round(at.y), rotation: 0, hp: 300 });
  e.navRevision = (e.navRevision || 0) + 1;
  const tower = e.s.buildings.at(-1);
  assert.equal(e.towerLineClear(tower, body), false, "not at the body while the lights burn");
  assert.ok(lights.some((q) => e.towerLineClear(tower, q)), "the lights are fair game");
  e.s.storage.ammo = 6;
  e.s.inventory.ammo = 20;
  const bodyHp = body.hp,
    lightHp = lights.reduce((a, q) => a + q.hp, 0);
  for (let i = 0; i < 4; i++) {
    tower.shotTimer = 0;
    e.updateDefense(DT);
  }
  assert.equal(body.hp, bodyHp, "the body untouched");
  assert.ok(lights.reduce((a, q) => a + q.hp, 0) < lightHp, "the lights take the shots");
  assert.equal(e.s.storage.ammo, 2, "the tower's bullets come from the storage first");
  assert.equal(e.s.inventory.ammo, 20, "yours are kept for you");
  // 光全灭了：心打得动，塔就往它身上打
  for (const q of lights) q.dead = true;
  e.enemies = e.s.enemies.farm = e.enemies.filter((q) => !q.dead);
  Object.assign(body, { hidden: false, heart: true, act: null });
  assert.equal(e.tShielded(body), false);
  // 平常（不是最后一夜）还是先用身上的
  e.finalEnd("dawn");
  e._tDef = true;
  try {
    assert.ok(e.takeFarm({ ammo: 1 }));
  } finally {
    e._tDef = false;
  }
  assert.equal(e.s.inventory.ammo, 19, "other nights as before");
});

test("the one you live with stands by you on the final night too, as on a long night", () => {
  const { e, toasts } = farmGame({ minute: FINAL.hour });
  e.kin.partner = { id: "medic", stage: "home", day: 1, hurt: 0 };
  e.tg.final.day = e.s.day;
  run(e, 0.3);
  assert.ok(e.finalLive());
  assert.ok(e._kinAlly && e._kinAlly.id === "medic" && e._kinAlly.final, "at your side");
  assert.ok(toasts.some((t) => t.text.includes("站到了你身边")));
  assert.equal(e.residentActive(e.c.residents.find((r) => r.id === "medic")), false, "not at the post while beside you");
});

test("falling on the final night or missing it: falling sends it back (and counts), missing it does not count", () => {
  const { e, toasts } = farmGame({ minute: FINAL.hour });
  e.tg.final.day = e.s.day;
  run(e, 0.2);
  assert.ok(e.finalLive());
  e.s.player.hp = 0;
  e.die();
  assert.equal(e.finalLive(), false);
  assert.equal(e.tg.final.lost, 1);
  assert.ok(toasts.some((t) => t.text.includes("你倒下了，扑火的退回了林子里")));
  // 倒下的那一页点过去
  e.paused = false;
  // 错过了：远征在外、那一夜过去了
  const lost = e.tg.final.lost;
  e.s.day = e.tg.final.day + 1;
  e.s.minute = FINAL.dawn + 10;
  run(e, 0.2);
  assert.equal(e.tg.final.lost, lost, "missing it does not count as lost");
  assert.ok(toasts.some((t) => t.text.includes("没找到篝火边上的人")));
  assert.ok(e.tg.final.day > e.s.day);
});

test("winning the final night: one ending card, the last lamp and no weapon, the 十凶碑, the night over for good", () => {
  const { e } = farmGame({ minute: FINAL.hour });
  e.tg.final.day = e.s.day;
  run(e, 0.2);
  assert.ok(e.finalLive());
  for (const L of all(e, "moth", "light")) {
    L.hp = 1;
    hit(e, L, 999, "ranged");
  }
  run(e, 0.1);
  const body = one(e, "moth", "body");
  e.tx.waves = [];
  Object.assign(body, { hidden: false, heart: true, act: null, inv: 0, hp: 1 });
  e.events.length = 0;
  hit(e, body, 999);
  const card = e.events.find((ev) => ev.type === "moment" && ev.kind === "titanEnd");
  assert.ok(card, "the ending card");
  assert.equal(card.title, FINAL_END.title);
  assert.ok(card.lines.some((l) => l.includes("十凶的名号")));
  for (const l of card.lines) assert.doesNotMatch(l, FORBIDDEN);
  assert.ok(!e.events.some((ev) => ev.type === "moment" && ev.kind === "titanDown"), "no 倒下了 card");
  assert.ok(e.events.some((ev) => ev.type === "tSfx" && ev.stinger === "titanEnd"));
  assert.equal(e.qty("tTrophyMoth", true), 1);
  assert.ok(e.tg.final.won && !e.finalLive());
  assert.ok(e.tg.perks.moth);
  assert.ok(e.titanGone("moth"), "never again");
  e.s.day += 40;
  e.s.minute = 8 * 60;
  run(e, 0.2);
  assert.equal(e.tg.final.day, 0, "no new date");
  assert.equal(e.titansHere("moth").length, 0);
  const info = e.titanInfo().rows.find((r) => r.id === "moth");
  assert.ok(info.final && info.wins === 1 && !info.nextFinal);
});

// ================= 存档 =================
test("a v0.36 save gets the 后五凶 card once and the final-night record; a new game gets neither card", () => {
  const { e } = arena("scrap", { force: false });
  const raw = JSON.parse(e.serialize());
  raw.titan.schema = 1;
  delete raw.titan.final;
  delete raw.titan.intro2;
  raw.titan.intro = { day: raw.day, told: true };
  // 读之前先留一份（检查点）；这一版的档不用
  assert.equal(needsStoryMigration(JSON.stringify(raw)), true, "a v0.36 save gets a checkpoint first");
  assert.equal(needsStoryMigration(e.serialize()), false);
  const s = Engine.parse(JSON.stringify(raw));
  assert.equal(s.titan.schema, TITAN_SCHEMA);
  assert.deepEqual(s.titan.intro2, { day: s.day, told: false });
  assert.deepEqual(s.titan.final, { day: 0, on: 0, tries: 0, lost: 0, keep: 0, won: 0 });
  const { e: e2 } = make(s);
  e2.events.length = 0;
  run(e2, DT * 2);
  assert.ok(e2.tg.intro2.told);
  const cards = e2.events.filter((ev) => ev.type === "moment" && ev.title === "后五凶");
  assert.equal(cards.length, 1);
  for (const l of cards[0].lines) assert.doesNotMatch(l, FORBIDDEN);
  run(e2, DT * 4);
  assert.equal(e2.events.filter((ev) => ev.type === "moment" && ev.title === "后五凶").length, 1, "only once");
  // 这一版的档读回不再给
  const again = Engine.parse(e2.serialize());
  assert.equal(again.titan.intro2.told, true);
  const fresh = freshState();
  assert.ok(!fresh.titan.intro && !fresh.titan.intro2, "a new game has no card");
});
