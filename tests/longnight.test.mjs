// v0.25.0「长夜」：主线打完以后的长夜（哪天来、预兆、三波、头目、守住/没守住、奖励、纪念品展柜、结局卡、
// 长夜后睡到早上、别的仗让开长夜）以及存档。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState } from "../dist/campaign.js";
import { TASKS } from "../dist/rebuild-data.js";
import { ITEMS, ZOMBIES } from "../dist/data.js";
import { BOSSES } from "../dist/undertow-data.js";
import { LN, WAVE_MIX, MEMENTO_AT, MEMENTO_IDS, LN_CASE, ENDING } from "../dist/longnight-data.js";

const make = (state = freshState(), seed = 20241) => {
  state.undertow.seed = seed;
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
// 主线打完的一局：第 day 天上午，在农场
function postStory(day = 30, { act = 9 } = {}) {
  const { e, toasts } = make();
  toAct(e, act);
  e.s.day = day;
  e.s.minute = 600;
  e.c.workClock = 0;
  e.s.stats.hordes = 6;
  e.s.horde = { phase: "won", timer: 0, remaining: 0, spawnTimer: 0, direction: 0 };
  e.c.nextHordeDay = day + 20;
  e.dy.pending = null;
  go(e, "farm");
  e.update(0.016, { x: 0, y: 0 });
  return { e, toasts };
}
// 安全地跑几秒：不让人被打倒
const run = (e, secs, input = { x: 0, y: 0 }) => {
  for (let t = 0; t < secs - 1e-9; t += 0.05) {
    e.invulnerable = 5;
    e.s.player.hp = 100;
    e.update(0.05, input);
  }
};
const clock = (e, day, minute) => {
  e.s.day = day;
  e.s.minute = minute;
  e.c.workClock = minute % 60;
};
const killWave = (e) => {
  for (const z of e.enemies.filter((q) => q.horde && !q.dead)) e.hurtEnemy(z, z.hp + 999, 0);
};
const horde = (e) => e.enemies.filter((z) => z.horde && !z.dead);
const FIRST = 38; // 第 30 天打完主线：最早第 32 天，第 7n+3 天 → 第 38 天

// ================= 哪天来 =================
test("long nights start after the story: storyDay is set once, the first night is the first day 7n+3 at least two days later", () => {
  const { e, toasts } = postStory(30);
  assert.equal(e.ln.storyDay, 30);
  assert.equal(e.nextLongNight(), FIRST);
  assert.ok(toasts.some((t) => t.text.includes("第 " + FIRST + " 天")), "the first night is announced");
  assert.equal(e.isLongNight(31), false, "too early");
  assert.equal(e.isLongNight(FIRST), true);
  assert.equal(e.isLongNight(FIRST + 7), true);
  assert.equal(e.isLongNight(FIRST + 1), false);
  for (let d = 1; d < 200; d++) if (e.isLongNight(d)) assert.notEqual(d % 7, 0, "never on a festival day");
  // 主线没打完就没有长夜
  const { e: f } = postStory(30, { act: 8 });
  assert.equal(f.ln.storyDay, 0);
  assert.equal(f.isLongNight(FIRST), false);
  assert.equal(f.nextLongNight(), 0);
  // 旧档读进来时主线已经打完：按读进来那天算
  const raw = JSON.parse(e.serialize());
  delete raw.longnight;
  raw.day = 52;
  const { e: g } = make(Engine.parse(JSON.stringify(raw)));
  g.update(0.016, { x: 0, y: 0 });
  assert.equal(g.ln.storyDay, 52);
  assert.equal(g.nextLongNight(), 59);
});

test("the size grows by a fifth per night held and stops at double", () => {
  const { e } = postStory(30);
  assert.deepEqual([0, 1, 2].map((k) => e.waveCount(k, 1)), LN.base);
  const sizes = [];
  for (let h = 0; h <= 12; h++) sizes.push(e.nightTotal(e.lnMult(h)));
  // v0.26：每波 12/15/18（原来 10/12/14）
  assert.equal(sizes[0], LN.base.reduce((a, b) => a + b, 0));
  for (let h = 1; h <= 12; h++) assert.ok(sizes[h] >= sizes[h - 1], "never shrinks");
  assert.ok(sizes[1] > sizes[0] * 1.15 && sizes[1] < sizes[0] * 1.25);
  assert.equal(e.lnMult(4), 2);
  assert.equal(sizes[10], 2 * LN.base.reduce((a, b) => a + b, 0), "capped at double");
  assert.equal(sizes[12], sizes[10]);
});

// ================= 预兆 =================
test("on the day the date turns red at 08:00, the sky reddens and thunder rolls from 18:00, and sleep cannot skip the night", () => {
  const { e, toasts } = postStory(30);
  clock(e, FIRST, 470);
  run(e, 0.2);
  assert.equal(e.lnRed(), false);
  clock(e, FIRST, 481);
  run(e, 0.2);
  assert.equal(e.lnRed(), true);
  const red = toasts.filter((t) => t.text.includes("今天是长夜"));
  assert.equal(red.length, 1);
  assert.match(red[0].text, /22:00/);
  assert.match(red[0].text, /大块头/, "the first boss is named");
  run(e, 1);
  assert.equal(toasts.filter((t) => t.text.includes("今天是长夜")).length, 1, "said once");
  assert.equal(e.lnSky(), 0);
  // 不能一觉睡过去；“等到天黑”可以
  assert.equal(e.sleep(), false);
  assert.ok(toasts.at(-1).text.includes("长夜"));
  assert.equal(e.s.day, FIRST);
  assert.ok(e.waitUntilNight());
  assert.equal(e.s.minute, 1140);
  const n0 = e.events.length;
  run(e, 0.1);
  assert.ok(e.lnSky() > 0, "red sky after 18:00");
  assert.ok(toasts.some((t) => t.text.includes("天边发红")));
  assert.ok(e.events.slice(n0).some((ev) => ev.type === "lnThunder") || e.lx.bolt > 0, "thunder");
  const bolts = e.lx.bolt;
  run(e, 30);
  assert.ok(e.lx.bolt > bolts, "thunder keeps rolling");
  assert.equal(e.ln.night, null, "not yet");
});

// ================= 三波 =================
test("at 22:00 a scream starts three waves from the map edges; new infected come along and the third wave brings the boss", () => {
  const { e, toasts } = postStory(30);
  clock(e, FIRST, 1319);
  const n0 = e.events.length;
  run(e, 1);
  const N = e.ln.night;
  assert.ok(N, "started");
  assert.equal(e.s.horde.phase, "active");
  assert.equal(N.n, 1);
  assert.equal(N.wave, 1);
  assert.ok(e.events.slice(n0).some((ev) => ev.type === "lnScream"));
  assert.ok(e.events.slice(n0).some((ev) => ev.type === "alarm"));
  assert.ok(toasts.some((t) => t.text.includes("长夜开始了")));
  // 尸潮里不能出门、不能睡
  assert.equal(e.travel("residential"), false);
  assert.equal(e.s.region, "farm");
  assert.equal(e.sleep(), false);
  // 第一波：一只一只从边上来（v0.26 起 12 只）
  run(e, 24);
  assert.equal(N.made, LN.base[0]);
  assert.equal(N.left, 0);
  const kinds = new Set(e.enemies.filter((z) => z.horde).map((z) => z.type));
  for (const k of kinds) assert.ok(WAVE_MIX[0][k], "wave one only has its own kinds: " + k);
  for (const z of e.enemies.filter((q) => q.horde && !["spitter", "stalker"].includes(q.type))) assert.ok(z.homeX < 160 || z.homeX > 1280 || z.homeY < 160 || z.homeY > 860, "came from the edge: " + z.homeX + "," + z.homeY);
  // v0.26：打完以后第二波照样 00:00 来（空档用来修补）；等不及就敲警钟提前叫
  killWave(e);
  assert.equal(N.kills, LN.base[0]);
  run(e, 1);
  assert.equal(N.wave, 1);
  assert.ok(toasts.some((t) => t.text.includes("这一波打完了")));
  run(e, LN.gap + 1);
  assert.equal(N.wave, 1, "no early wave by itself any more");
  assert.equal(e.lnBell(), true);
  assert.equal(N.wave, 2);
  assert.ok(toasts.some((t) => t.text.includes("第 2 波来了")));
  run(e, 30);
  assert.equal(N.made, LN.base[0] + LN.base[1]);
  const kinds2 = new Set(e.enemies.filter((z) => z.horde && z.lnWave === 2).map((z) => z.type));
  for (const k of kinds2) assert.ok(WAVE_MIX[1][k], "wave two kinds: " + k);
  // 第二波没打完，到 02:00（离 22:00 四个小时）第三波照样来；v0.26：头目按时 03:00 来，血条在农场上方
  clock(e, FIRST + 1, LN.waveAt[2] - 120 + 0);
  e.s.minute = 120;
  run(e, 0.1);
  assert.equal(N.wave, 3);
  assert.equal(N.boss, 0, "the boss comes at 03:00");
  assert.ok(toasts.some((t) => t.text.includes("03:00，大块头会来")));
  for (let s = 0; s < 20; s++) {
    run(e, 1);
    killWave(e);
  }
  assert.equal(N.boss, 0, "still before 03:00");
  clock(e, FIRST + 1, 180);
  run(e, 0.1);
  assert.equal(N.boss, 1);
  const boss = e.enemies.find((z) => z.lnBoss && !z.dead);
  // 尸潮里的感染者都多两成五的血（统一高难度）；长夜的头目按 0.8 算回来，和废墟里的差不多
  assert.equal(boss.maxHp, Math.round(e.enemy("brute", 800, 500, true).maxHp * LN.bossHp));
  assert.ok(boss.maxHp >= ZOMBIES.brute.hp * 0.95 && boss.maxHp <= ZOMBIES.brute.hp * 1.1, "about the ruin boss's blood: " + boss.maxHp);
  assert.ok(boss && boss.boss === "brute" && boss.horde);
  const bar = e.bossBar();
  assert.equal(bar.kind, "brute");
  assert.match(bar.tag, /长夜/);
  assert.ok(e.hordeIntel().theme.includes("3/3"));
});

test("infected with their own moves still head for you in the horde (spitter, stalker, boss)", () => {
  const { e } = postStory(30);
  clock(e, FIRST, 1319.9);
  run(e, 0.2);
  assert.ok(e.ln.night);
  // 清掉第一波，换成三只自己会动的，摆在远处
  for (const z of horde(e)) z.dead = true;
  e.ln.night.left = 0;
  const p = e.s.player;
  const at = (x, y) => e.freePoint(x, y),
    a = at(1300, 300),
    b = at(300, 850),
    c = at(1420, 560),
    sp = e.enemy("spitter", a.x, a.y, true),
    st = e.enemy("stalker", b.x, b.y, true),
    br = e.enemy("brute", c.x, c.y, true);
  Object.assign(br, { boss: "brute", lnBoss: true, bossDay: e.s.day });
  e.enemies.push(sp, st, br);
  const d0 = [sp, st, br].map((z) => Math.hypot(z.x - p.x, z.y - p.y));
  run(e, 4);
  const d1 = [sp, st, br].map((z) => Math.hypot(z.x - p.x, z.y - p.y));
  for (let i = 0; i < 3; i++) assert.ok(d1[i] < d0[i] - 40, ["spitter", "stalker", "brute"][i] + " closed in: " + Math.round(d0[i]) + " → " + Math.round(d1[i]));
});

// ================= 守住 =================
test("holding till dawn: the rest retreat, rewards land, a memento is given and the next night is a fifth bigger", () => {
  const { e, toasts } = postStory(30);
  const money = e.s.money;
  clock(e, FIRST, 1319.9);
  run(e, 0.2);
  run(e, 6);
  const alive = horde(e).length;
  assert.ok(alive > 0);
  const n0 = e.events.length;
  clock(e, FIRST + 1, 239);
  run(e, 1);
  assert.equal(e.ln.night, null, "dawn ends it");
  assert.equal(horde(e).length, 0, "the rest retreated");
  assert.equal(e.s.horde.phase, "won");
  assert.equal(e.ln.held, 1);
  assert.equal(e.ln.tried, 1);
  const last = e.ln.last;
  assert.equal(last.held, true);
  assert.equal(last.how, "dawn");
  assert.equal(last.money, 140);
  assert.equal(e.s.money, money + 140);
  assert.equal(last.memento, MEMENTO_AT[1]);
  assert.ok(e.qty(MEMENTO_AT[1], true) >= 1);
  const loot = Object.keys(last.items).filter((id) => id !== MEMENTO_AT[1]);
  assert.ok(loot.length >= 1, "a rare draw");
  assert.ok(toasts.some((t) => t.text.includes("守住了")));
  assert.ok(e.events.slice(n0).some((ev) => ev.type === "menu" && ev.view === "lnight"));
  assert.ok(e.events.slice(n0).some((ev) => ev.type === "victory"));
  assert.equal(e.lnMult(), 1.2);
  assert.equal(e.nextLongNight(), FIRST + 7);
  // 天亮时的分钟带小数：存档照样读得回
  assert.deepEqual(Engine.parse(e.serialize()).longnight.last, e.ln.last);
  // 之后照常：能出门
  assert.ok(e.travel("residential"));
});

test("the fallen of each night are cleared from the farm's list, so night after night the save stays under its limit", () => {
  const { e } = postStory(30);
  // 上一次普通尸潮留下的尸体：长夜开始时一起清掉（和普通尸潮开始时一样）
  for (let i = 0; i < 5; i++) {
    const z = e.enemy("slow", 700 + i * 10, 500, false);
    z.dead = true;
    e.enemies.push(z);
  }
  let day = FIRST;
  for (let n = 0; n < 5; n++) {
    clock(e, day, 1319.9);
    run(e, 0.2);
    if (n === 0) assert.ok(!e.s.enemies.farm.some((z) => z.dead && !z.horde), "old bodies are cleared when the night starts");
    for (let k = 0; k < 6; k++) {
      killWave(e);
      run(e, 3);
    }
    killWave(e);
    clock(e, day + 1, 239);
    run(e, 1);
    assert.equal(e.ln.night, null);
    assert.equal(e.s.enemies.farm.filter((z) => z.dead || z.horde).length, 0, "no fallen or leftover horde on the list after night " + (n + 1));
    // 一晚一晚下来存档照样读得回（名单超过 200 只会被当成坏档）
    assert.doesNotThrow(() => Engine.parse(e.serialize()));
    day += 7;
    e.c.nextHordeDay = day + 20;
  }
  assert.ok(e.ln.kills > 0);
});

test("clearing all three waves holds the night early; the boss kill counts as a boss win without cancelling that day's ruin boss", () => {
  const { e } = postStory(30);
  clock(e, FIRST, 1319.9);
  run(e, 0.2);
  const N = e.ln.night;
  // v0.26：第二波敲警钟提前叫；第三波照时间 02:00 来；打完再敲一次叫头目（每晚最多提前两次）
  for (let w = 1; w <= 3; w++) {
    run(e, 32);
    assert.equal(N.wave, w);
    assert.equal(N.left, 0, "wave " + w + " all out");
    killWave(e);
    run(e, 1);
    if (w === 1) assert.equal(e.lnBell(), true);
    if (w === 2) {
      clock(e, FIRST + 1, LN.waveAt[2] - 120);
      run(e, 0.2);
    }
  }
  assert.equal(N.boss, 0);
  assert.equal(e.lnBell(), true);
  assert.equal(N.boss, 1);
  assert.equal(e.lnBell(), false, "two early calls a night at most");
  killWave(e);
  const rec = e.ut.boss.brute;
  assert.equal(rec.wins, 1, "boss win recorded");
  assert.equal(rec.last, 0, "the ruin boss of that day is still there");
  run(e, 0.2);
  assert.equal(e.ln.night, null);
  assert.equal(e.ln.last.how, "cleared");
  assert.equal(e.ln.last.boss, true);
  // 三波 36 只加头目，每一只都算上（扔车门、尖叫招来的也算）
  assert.ok(e.ln.last.kills >= LN.base.reduce((a, b) => a + b, 0) + 1, "every kill counted: " + e.ln.last.kills);
});

// ================= 没守住 =================
test("going down in the long night fails it: the horde leaves, nothing grows, and the next one is the same size", () => {
  const { e, toasts } = postStory(30);
  clock(e, FIRST, 1319.9);
  run(e, 0.2);
  run(e, 8);
  assert.ok(horde(e).length > 0);
  e.invulnerable = 0;
  e.damagePlayer(500);
  assert.equal(e.ln.night, null);
  assert.equal(horde(e).length, 0);
  assert.equal(e.s.horde.phase, "won");
  assert.equal(e.ln.held, 0);
  assert.equal(e.ln.failed, 1);
  assert.equal(e.ln.tried, 1);
  assert.equal(e.ln.last.held, false);
  assert.ok(toasts.some((t) => t.text.includes("没守住")));
  assert.equal(e.lnMult(), 1);
  assert.equal(e.nextLongNight(), FIRST + 7);
  // 下一个还是第 2 个 n，头目轮到护士长
  assert.equal(e.lnBossId(e.ln.tried + 1), "nurse");
});

// ================= 睡觉 =================
test("after the night, sleeping before 08:00 wakes at 08:00 the same day instead of skipping a day", () => {
  const { e, toasts } = postStory(30);
  clock(e, FIRST, 1319.9);
  run(e, 0.2);
  clock(e, FIRST + 1, 239.9);
  run(e, 0.5);
  assert.equal(e.ln.night, null);
  e.s.player.hp = 40;
  e.s.player.stamina = 10;
  assert.ok(e.lnNapOk());
  assert.ok(e.sleep());
  assert.equal(e.s.day, FIRST + 1);
  assert.equal(e.s.minute, 480);
  assert.equal(e.s.player.hp, 75);
  assert.equal(e.s.player.stamina, 100);
  assert.ok(toasts.some((t) => t.text.includes("睡到早上 8 点")));
  assert.equal(e.lnNapOk(), false, "once");
});

// ================= 别的仗让开 =================
test("regular hordes skip the long-night day and the day after; a raid set on that day moves to the next", () => {
  const { e, toasts } = postStory(30);
  e.c.nextHordeDay = FIRST;
  e.lnShiftThreats();
  assert.equal(e.c.nextHordeDay, FIRST + 2);
  e.c.nextHordeDay = FIRST + 1;
  e.lnShiftThreats();
  assert.equal(e.c.nextHordeDay, FIRST + 2);
  // 灰隼团排到长夜那天：改到第二天
  e.o.raid.phase = "scheduled";
  e.o.raid.day = FIRST;
  e.lnShiftThreats();
  assert.equal(e.o.raid.day, FIRST + 1);
  assert.ok(toasts.some((t) => t.text.includes("改了日子")));
  e.s.day = FIRST - 3;
  e.scheduleRaid(3);
  assert.equal(e.o.raid.day, FIRST + 1);
  // 跨过午夜进入长夜那天时也会挪
  const { e: f } = postStory(30);
  f.c.nextHordeDay = FIRST;
  clock(f, FIRST - 1, 1439.5);
  f.c.workClock = 59.5;
  f.advanceMinutes(1);
  assert.equal(f.s.day, FIRST);
  assert.equal(f.s.horde.phase, "won", "no regular horde warning on the long-night day");
  assert.equal(f.c.nextHordeDay, FIRST + 2);
});

test("away at 22:00 you are brought back to the farm; a regular horde still running delays the start", () => {
  const { e, toasts } = postStory(30);
  clock(e, FIRST, 1250);
  go(e, "residential");
  e.s.minute = 1262;
  run(e, 0.2);
  assert.ok(toasts.some((t) => t.text.includes("22:00 前回农场")));
  e.s.minute = 1320;
  run(e, 0.2);
  assert.equal(e.s.region, "farm");
  assert.ok(e.ln.night);
  assert.ok(toasts.some((t) => t.text.includes("赶回了农场")));
  const { e: f } = postStory(30);
  clock(f, FIRST, 1320);
  f.s.horde = { phase: "warning", timer: 60, remaining: 10, spawnTimer: 0, direction: 1 };
  f.update(0.05, { x: 0, y: 0 });
  assert.equal(f.ln.night, null, "waits for the regular horde");
});

// ================= 十个、展柜 =================
test("ten nights held give the ending card and the archive broadcast; three mementos fill the seventh museum case", () => {
  const { e, toasts } = postStory(30);
  // 跳着过日子：灰隼团反扑当作已经打完
  e.ct.step = 4;
  e.ct.done = true;
  const rep = e.c.reputation;
  let day = FIRST;
  for (let n = 1; n <= LN.goal; n++) {
    // 跳着过日子：普通尸潮先往后放
    e.c.nextHordeDay = day + 100;
    clock(e, day, 1319.9);
    run(e, 0.2);
    assert.ok(e.ln.night, "night " + n);
    assert.equal(e.ln.night.mult, Math.round(Math.min(2, Math.pow(1.2, n - 1)) * 100));
    clock(e, day + 1, 239.9);
    const n0 = e.events.length;
    run(e, 0.3);
    assert.equal(e.ln.held, n);
    if (n === LN.goal) assert.ok(e.events.slice(n0).some((ev) => ev.type === "menu" && ev.view === "lnEnd"));
    day += 7;
  }
  assert.equal(e.ln.ended, true);
  assert.ok(e.o.log.some((l) => l.text === ENDING.broadcast));
  for (const id of MEMENTO_IDS) assert.ok(e.qty(id, true) >= 1, id);
  // 之后长夜还来，但不再变大
  assert.equal(e.nightTotal(), 2 * LN.base.reduce((a, b) => a + b, 0));
  // 展柜：到档案馆捐
  e.w.museum.built = true;
  assert.equal(e.donateMemento(MEMENTO_IDS[0]), false, "must be at the museum");
  const near = e.museumHere;
  e.museumHere = () => true;
  for (const id of MEMENTO_IDS) assert.ok(e.donateMemento(id));
  e.museumHere = near;
  assert.equal(e.ln.caseDone, true);
  assert.equal(e.lnCase().donated.length, LN_CASE.need);
  assert.equal(e.c.reputation >= rep + 10, true);
  assert.equal(e.donateMemento(MEMENTO_IDS[0]), false, "only once");
  assert.ok(toasts.some((t) => t.text.includes("长夜纪念")));
});

// ================= 存档 =================
test("a save in the middle of the night loads and carries on; broken long-night data is refused", () => {
  const { e } = postStory(30);
  clock(e, FIRST, 1319.9);
  run(e, 0.2);
  run(e, 5);
  const N = { ...e.ln.night };
  const raw = e.serialize();
  const { e: g } = make(Engine.parse(raw));
  g.paused = false;
  assert.deepEqual(g.ln.night, N);
  assert.equal(g.s.horde.phase, "active");
  assert.equal(g.hordeAlive().length, horde(e).length);
  run(g, 10);
  assert.ok(g.ln.night.made > N.made, "keeps spawning");
  // 旧档没有长夜字段：照常读进来
  const old = JSON.parse(raw);
  delete old.longnight;
  old.horde = { phase: "won", timer: 0, remaining: 0, spawnTimer: 0 };
  assert.ok(Engine.parse(JSON.stringify(old)).longnight);
  // 坏数据拒收
  for (const bad of [
    (x) => (x.longnight.night.wave = 7),
    (x) => (x.longnight.night.mult = 999),
    (x) => (x.longnight.held = -1),
    (x) => (x.longnight.mementos = ["lnWhistle", "lnWhistle"]),
    (x) => (x.longnight.schema = 9),
    (x) => (x.longnight.extra = 1),
    (x) => (x.longnight.last = { day: 1 }),
  ]) {
    const x = JSON.parse(raw);
    bad(x);
    assert.throws(() => Engine.parse(JSON.stringify(x)), /长夜/);
  }
});

test("long-night items are real, protected and named in plain words", () => {
  for (const id of MEMENTO_IDS) {
    assert.ok(ITEMS[id], id);
    assert.equal(ITEMS[id].protected, true);
    assert.match(ITEMS[id].desc, /档案馆/);
  }
  for (const mix of WAVE_MIX) for (const k of Object.keys(mix)) assert.ok(ZOMBIES[k], k);
  for (const b of ["brute", "nurse"]) assert.ok(BOSSES[b]);
});

test("the long night's thunder, scream and waves have sounds and written cues", async () => {
  const { SFX, STINGERS, soundFor, LN_SOUND_EVENTS, U_SOUND_EVENTS } = await import("../dist/audio-data.js");
  const { CUES } = await import("../dist/feel-data.js");
  for (const type of [...LN_SOUND_EVENTS, ...U_SOUND_EVENTS]) {
    const m = soundFor({ type, x: 0, y: 0 });
    assert.ok(m, type);
    if (m.sfx) assert.ok(SFX[m.sfx], type + " → " + m.sfx);
    if (m.stinger) assert.ok(STINGERS[m.stinger], type + " → " + m.stinger);
  }
  for (const type of LN_SOUND_EVENTS) assert.ok(CUES[type], "cue for " + type);
});

// ================= 界面 =================
test("the journal, alerts, top bar, report, ending card, museum, collection and calendar all speak plainly about the long night", async () => {
  const UI = await import("../dist/campaign-ui.js");
  const { alertItems } = await import("../dist/winter-ui.js");
  const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
  const { e } = postStory(30);
  const journal = () => UI.renderCampaignJournal(e, {});
  assert.match(journal(), /下一个在第 38 天/);
  const cal = UI.renderCampaignView(e, { view: "calendar" });
  assert.match(cal, /第38天<\/b><span class="tag danger">长夜/);
  // 当天：日期变红、提醒、手记
  clock(e, FIRST, 600);
  run(e, 0.1);
  let hud = UI.campaignHud(e);
  assert.equal(hud.lnRed, true);
  assert.ok(alertItems(e).some((a) => a.text === "今晚 22:00 长夜"));
  assert.match(journal(), /今晚<\/b>22:00 长夜/);
  assert.ok(UI.renderCampaignView(e, { view: "outpost" }) !== undefined);
  // 打着的时候：横幅、提醒、血条
  clock(e, FIRST, 1319.9);
  run(e, 0.2);
  run(e, 3);
  hud = UI.campaignHud(e);
  // v0.26：横幅上多一段“下一波还有几秒”
  assert.match(hud.raid, /长夜 · 第 1\/3 波 · 还剩 \d+ 只 · 第 2 波 \d+ 秒后 · 天亮还有 5 小时/);
  assert.match(hud.alerts, /长夜 · 第 1\/3 波/);
  assert.doesNotMatch(hud.alerts, /尸潮来袭/);
  assert.match(journal(), /第 1\/3 波/);
  // 守住：战报（睡到 8 点的按钮）
  clock(e, FIRST + 1, 239.9);
  run(e, 0.5);
  const report = UI.renderCampaignView(e, { view: "lnight" });
  assert.equal(UI.campaignTitle({ view: "lnight" }), "长夜战报");
  assert.match(report, /第 1 个长夜 · 守住了/);
  assert.match(report, /lnNap/);
  assert.match(report, /长夜的铁哨/);
  assert.match(report, /下一个长夜：第 45 天/);
  // 档案馆、成就册
  e.w.museum.built = true;
  const museum = UI.renderCampaignView(e, { view: "museum" });
  assert.match(museum, /长夜纪念/);
  assert.match(museum, /lnDonate/);
  const book = UI.renderCampaignView(e, { view: "collection" });
  assert.match(book, /<b>长夜<\/b>/);
  assert.match(book, /1\/10/);
  // 按钮：睡到早上 8 点
  let closed = 0;
  const ctx = { engine: e, renderMenu: () => {}, closeMenu: () => closed++, save: () => {}, toast: () => {}, showMenu: () => {} };
  assert.equal(UI.handleCampaignAction("lnNap", { dataset: { id: "" } }, ctx), true);
  assert.equal(e.s.minute, 480);
  assert.equal(closed, 1);
  // 捐纪念品
  e.museumHere = () => true;
  assert.equal(UI.handleCampaignAction("lnDonate", { dataset: { id: "lnWhistle" } }, ctx), true);
  assert.deepEqual(e.ln.mementos, ["lnWhistle"]);
  // 结局卡
  const end = UI.renderCampaignView(e, { view: "lnEnd" });
  assert.equal(UI.campaignTitle({ view: "lnEnd" }), "余烬地区收复");
  assert.match(end, /余烬地区，收复了/);
  for (const html of [journal(), cal, report, museum, book, end, hud.alerts, hud.raid]) assert.doesNotMatch(html, FORBIDDEN);
});

// ================= 灰隼团反扑 =================
const COUNTERD = await import("../dist/longnight-data.js");
const { COUNTER, LEADER, SCOUT_MAP, COUNTER_REWARD } = COUNTERD;
const UNDER = await import("../dist/undertow-data.js");
const withTower = (e) => {
  e.s.buildings.push({ id: "t-test", type: "tower", x: 1180, y: 300, rotation: 0, hp: 240 });
  e.navRevision++;
  return e.s.buildings.at(-1);
};
const scoutsOf = (e) => e.enemies.filter((z) => z.scout && !z.dead);
const sabsOf = (e) => (e.s.enemies.farm || []).filter((z) => z.saboteur && !z.dead);

test("the counterattack is scheduled from the story's end: scouts on day +5 in one ruin, never on a long-night day", () => {
  const { e } = postStory(30);
  const c = e.ct;
  assert.equal(c.step, 1);
  assert.equal(c.day, 35);
  assert.ok(UNDER.RUINS.includes(c.region));
  // 第 +5 天碰上长夜就挪一天
  const { e: f } = postStory(33);
  assert.equal(f.ct.day, 39, "day 38 is a long night");
  assert.equal(f.isLongNight(38), true);
});

test("scouts: two gunmen in the ruin for one day; downing both gives their map, ammo and tells when and what they'll hit", () => {
  const { e, toasts } = postStory(30);
  withTower(e);
  const c = e.ct;
  clock(e, 35, 430);
  run(e, 0.1);
  assert.ok(toasts.some((t) => t.text.includes("像是探子")), "morning notice");
  assert.ok(e.ruinNews().some((n) => n.kind === "scouts" && n.region === c.region));
  e.travel(c.region);
  assert.equal(e.s.region, c.region);
  const scouts = scoutsOf(e);
  assert.equal(scouts.length, 2);
  // 再进一次图不会多出来
  e.assignRegion();
  assert.equal(scoutsOf(e).length, 2);
  const ammo = e.qty("ammo", true);
  e.hurtEnemy(scouts[0], 999, 0);
  assert.equal(c.scouts, 1);
  assert.ok(e.qty("ammo", true) > ammo);
  e.hurtEnemy(scouts[1], 999, 0);
  assert.equal(c.intel, true);
  assert.ok(e.qty(SCOUT_MAP, true) >= 1);
  assert.ok(toasts.some((t) => t.text.includes("搜出一张地图") && t.text.includes("瞭望塔")));
  run(e, 0.1);
  assert.equal(c.step, 2);
  assert.equal(c.day, 37);
  assert.equal(c.target, "t-test");
});

test("a scout that is badly hurt runs for the map edge; if it gets away there is no map", () => {
  const { e } = postStory(30);
  const c = e.ct;
  clock(e, 35, 600);
  e.travel(c.region);
  const [a, b] = scoutsOf(e);
  e.hurtEnemy(a, a.maxHp * 0.7, 0);
  run(e, 0.2);
  assert.equal(a.flee, true);
  a.x = 1520;
  run(e, 0.2);
  assert.equal(c.fled, 1);
  e.hurtEnemy(b, 999, 0);
  run(e, 0.1);
  assert.equal(c.step, 2);
  assert.equal(c.intel, false);
  assert.equal(e.qty(SCOUT_MAP, true), 0);
});

test("night sabotage: two come at 23:00 for the tower; a hit sets the planting back, eleven seconds blows it up, then they run", () => {
  const { e, toasts } = postStory(30);
  const tower = withTower(e);
  const c = e.ct;
  // 探子那天没去：直接到第二步
  clock(e, 36, 600);
  run(e, 0.1);
  assert.equal(c.step, 2);
  assert.equal(c.intel, false);
  clock(e, c.day, 1379.9);
  run(e, 0.2);
  assert.equal(c.sabOn, true);
  const [s1, s2] = sabsOf(e);
  assert.ok(s1 && s2);
  // 直接摆到塔边上开始埋
  for (const s of [s1, s2]) Object.assign(s, { x: tower.x, y: tower.y + 30 });
  e.s.player.x = 300;
  e.s.player.y = 800;
  run(e, 4);
  assert.ok(s1.plant > 3);
  const before = s1.plant;
  e.hurtEnemy(s1, 1, 0);
  assert.ok(s1.plant <= before - COUNTER.sabotage.setback + 0.01, "a hit sets it back");
  run(e, 9);
  assert.equal(tower.hp, 0, "blown");
  assert.equal(c.sab, "blown");
  assert.ok(toasts.some((t) => t.text.includes("被炸坏了")));
  assert.ok(sabsOf(e).every((z) => z.flee));
  for (const z of sabsOf(e)) z.x = 1420;
  run(e, 0.3);
  assert.equal(c.sabOn, false);
  assert.equal(c.step, 3);
  assert.equal(c.raid.phase, "scheduled");
  assert.equal(c.raid.day, 40);
  assert.equal(e.raidState(), c.raid);
});

test("sabotage foiled by downing both gives a little loot; away or asleep, the night watch decides by defence power", () => {
  const { e } = postStory(30);
  withTower(e);
  const c = e.ct;
  clock(e, 36, 600);
  run(e, 0.1);
  clock(e, c.day, 1379.9);
  run(e, 0.2);
  const ammo = e.qty("ammo", true);
  for (const z of sabsOf(e)) e.hurtEnemy(z, 999, 0);
  run(e, 0.2);
  assert.equal(c.sab, "foiled");
  assert.equal(e.qty("ammo", true), ammo + COUNTER_REWARD.foiled.ammo);
  assert.equal(c.step, 3);
  // 不在农场：防守力不够就被炸
  const { e: f, toasts } = postStory(30);
  const tw = withTower(f);
  clock(f, 36, 600);
  run(f, 0.1);
  f.raidPower = () => 2;
  clock(f, f.ct.day, 1300);
  go(f, "residential");
  f.s.minute = 1381;
  run(f, 0.2);
  assert.equal(f.ct.sab, "blownAway");
  assert.equal(tw.hp, 0);
  assert.ok(toasts.some((t) => t.text.includes("防守力 2")));
  // 睡过去：第二天早上看结果；防守力够就赶跑了
  const { e: g } = postStory(30);
  withTower(g);
  clock(g, 36, 600);
  run(g, 0.1);
  g.raidPower = () => 9;
  clock(g, g.ct.day, 1290);
  assert.ok(g.sleep());
  run(g, 0.2);
  assert.equal(g.ct.sab, "guards");
  assert.equal(g.ct.step, 3);
});

test("the last raid: the leader comes third, throws smoke that hides his men from towers and halves your damage, and when he falls the rest run", () => {
  const { e, toasts } = postStory(30);
  withTower(e);
  const c = e.ct;
  clock(e, 36, 600);
  run(e, 0.1);
  clock(e, c.day, 1379.9);
  run(e, 0.2);
  for (const z of sabsOf(e)) e.hurtEnemy(z, 999, 0);
  run(e, 0.2);
  assert.equal(c.step, 3);
  // 不能一觉睡过 19:00
  clock(e, c.raid.day, 900);
  assert.equal(e.sleep(), false);
  e.s.minute = 1139.9;
  e.s.player.x = 900;
  e.s.player.y = 480;
  run(e, 0.2);
  assert.equal(c.raid.phase, "warning");
  assert.ok(toasts.some((t) => t.text.includes("亲自来了")));
  c.raid.timer = 0.01;
  run(e, 0.2);
  assert.equal(c.raid.phase, "active");
  assert.equal(c.raid.total, COUNTER.final.size + 1);
  run(e, 3.5 * COUNTER.final.leaderAt + 1);
  const leader = e.enemies.find((z) => z.leader && !z.dead);
  assert.ok(leader, "leader spawned");
  assert.equal(leader.maxHp, LEADER.hp);
  // 烟雾弹
  leader.smokeT = 0;
  // 找一条中间没东西挡着的线
  let spot = null;
  for (const y of [600, 560, 640, 700, 520, 760]) {
    const L = { x: 1200, y },
      P = { x: 1000, y };
    if (e.lineClear(L, P) && !e.blocked(L.x, L.y, true, 14) && !e.blocked(P.x, P.y, false, 14)) {
      spot = y;
      break;
    }
  }
  assert.ok(spot, "an open line on the farm");
  Object.assign(leader, { x: 1200, y: spot, aim: 0 });
  e.s.player.x = 1000;
  e.s.player.y = spot;
  e.update(0.05, { x: 0, y: 0 });
  assert.equal(e.lx.grenades.length, 1);
  run(e, 1);
  assert.equal(e.lx.smoke.length, 1);
  const sm = e.lx.smoke[0];
  const man = e.enemies.find((z) => z.type === "raider" && !z.leader && !z.dead);
  Object.assign(man, { x: sm.x, y: sm.y, cover: false });
  assert.equal(e.inSmoke(man), true);
  const hp0 = man.hp;
  e.hurtEnemy(man, 20, 0);
  assert.ok(Math.abs(hp0 - man.hp - 20 * LEADER.smoke.cut) < 0.5, "half damage in smoke: " + (hp0 - man.hp));
  assert.equal(e.towerLineClear(e.s.buildings.find((b) => b.id === "t-test"), { ...man, fled: true }), false);
  // 头领倒下：剩下的跑
  e.hurtEnemy(leader, 999, 0);
  assert.equal(c.leader, 2);
  assert.ok(e.enemies.filter((z) => z.type === "raider" && !z.dead && !z.leader).every((z) => z.retreat));
  assert.equal(c.raid.total, c.raid.spawned, "no more come");
  for (const z of e.enemies.filter((q) => q.type === "raider" && !q.dead)) z.x = 1420;
  const money = e.s.money;
  run(e, 0.5);
  assert.equal(c.raid.phase, "won");
  assert.equal(c.step, 4);
  assert.equal(c.done, true);
  assert.equal(e.s.money, money + COUNTER_REWARD.final.money);
  assert.equal(e.lastRaidReport().won, true);
  assert.match(e.lastRaidReport().wonText, /灰隼团散了/);
  assert.notEqual(e.raidState(), c.raid, "no longer the live raid");
});

test("losing the last raid loots the storage and brings them back in two days (not on a long night); a reload mid-raid brings the leader back", () => {
  const { e } = postStory(30);
  const c = e.ct;
  c.step = 3;
  Object.assign(c.raid, { phase: "scheduled", day: 41, tries: 0 });
  e.s.storage.ammo = 50;
  clock(e, 41, 1139.9);
  run(e, 0.2);
  c.raid.timer = 0.01;
  run(e, 0.2);
  assert.equal(c.raid.phase, "active");
  run(e, 8);
  assert.equal(c.leader, 1);
  // 读档：头领不写进存档，按剩下的人数重来
  const raw = e.serialize();
  const { e: g } = make(Engine.parse(raw));
  g.paused = false;
  assert.equal(g.ct.leader, 0);
  assert.equal(g.ct.raid.spawned, g.ct.raid.killed + g.ct.raid.retreated);
  // 倒下：输了
  e.invulnerable = 0;
  e.damagePlayer(999);
  assert.equal(c.raid.phase, "scheduled");
  assert.equal(c.raid.tries, 1);
  assert.equal(c.raid.day, 43);
  assert.ok(e.s.storage.ammo < 50, "looted");
  assert.equal(e.isLongNight(c.raid.day), false);
  // 坏数据拒收
  for (const bad of [(x) => (x.longnight.counter.step = 9), (x) => (x.longnight.counter.raid.phase = "boom"), (x) => (x.longnight.counter.region = "moon"), (x) => (x.longnight.counter.sab = "x"), (x) => (x.longnight.counter.scouts = 5)]) {
    const x = JSON.parse(raw);
    bad(x);
    assert.throws(() => Engine.parse(JSON.stringify(x)), /长夜/);
  }
});

test("the counterattack shows up in the journal, alerts, calendar and the achievements book in plain words", async () => {
  const UI = await import("../dist/campaign-ui.js");
  const { alertItems } = await import("../dist/winter-ui.js");
  const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
  const { e } = postStory(30);
  const c = e.ct;
  let journal = UI.renderCampaignJournal(e, {});
  assert.match(journal, /灰隼团<\/b>第 35 天：灰隼团的探子在/);
  const cal = UI.renderCampaignView(e, { view: "calendar" });
  assert.match(cal, /第35天<\/b><span class="tag danger">灰隼团的探子/);
  clock(e, 35, 600);
  run(e, 0.1);
  assert.ok(alertItems(e).some((a) => a.text.startsWith("灰隼团的探子")));
  journal = UI.renderCampaignJournal(e, {});
  assert.match(journal, /今天：灰隼团的探子/);
  const book = UI.renderCampaignView(e, { view: "collection" });
  assert.match(book, /灰隼团反扑/);
  assert.match(book, /0\/3/);
  for (const html of [journal, cal, book]) assert.doesNotMatch(html, FORBIDDEN);
});

// ================= 出身 =================
const ORI = await import("../dist/longnight.js");
const { ORIGINS, ORIGIN_IDS } = COUNTERD;
const GEARD = await import("../dist/gear-data.js");
const fresh = (origin) => {
  const s = ORI.newGameState(origin);
  s.undertow.seed = 20241;
  const toasts = [];
  const e = new Engine(s, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  e.toasts = toasts;
  return e;
};

test("five origins: each starts with its kit (the farmer is the old start) and the save remembers it", () => {
  const base = ORI.newGameState("farmer"),
    plain = freshState();
  assert.deepEqual(base.inventory, plain.inventory, "the farmer is the old start");
  assert.deepEqual(base.gear.slots, plain.gear.slots);
  assert.equal(ORIGIN_IDS.length, 5);
  const medic = ORI.newGameState("medic");
  assert.equal(medic.inventory.medkit, 1);
  assert.equal(medic.gear.slots.hands, "leatherBracers");
  const hunter = ORI.newGameState("hunter");
  assert.equal(hunter.inventory.club, undefined, "no club");
  assert.equal(hunter.gear.slots.melee, null);
  assert.equal(hunter.gear.slots.ranged, "slingshot");
  assert.equal(hunter.gear.slots.feet, "softShoes");
  assert.equal(hunter.inventory.stone, plain.inventory.stone + 10);
  assert.equal(hunter.inventory.bread, plain.inventory.bread - 2);
  const mech = ORI.newGameState("mechanic");
  assert.equal(mech.inventory.parts, (plain.inventory.parts || 0) + 4);
  assert.equal(mech.gear.slots.head, "headlamp");
  const vet = ORI.newGameState("veteran");
  assert.equal(vet.gear.slots.melee, "pipe");
  assert.equal(vet.gear.slots.body, null, "no body armour: with a jacket the bot died 8.7 points less than the farmer on day 1 in the hospital");
  assert.equal(vet.inventory.ammo, (plain.inventory.ammo || 0) + 10);
  // 存档里记着；不认得的出身拒收；旧档是“种地的”
  const e = fresh("hunter");
  const raw = e.serialize();
  assert.equal(Engine.parse(raw).longnight.origin, "hunter");
  const bad = JSON.parse(raw);
  bad.longnight.origin = "wizard";
  assert.throws(() => Engine.parse(JSON.stringify(bad)), /长夜/);
  const old = JSON.parse(raw);
  delete old.longnight;
  assert.equal(Engine.parse(JSON.stringify(old)).longnight.origin, "farmer");
  assert.equal(ORI.newGameState("nobody").longnight.origin, "farmer");
});

test("origin rules: medic heals more and hits softer, hunter sneaks faster and gets an extra trap use, mechanic repairs cheaper with less stamina, veteran shoves cheaper, slips grabs sooner and gets hungry faster", () => {
  const f = fresh("farmer"),
    m = fresh("medic"),
    h = fresh("hunter"),
    c = fresh("mechanic"),
    v = fresh("veteran");
  // 卫生员：绷带
  assert.equal(m.medBonus("bandage") - f.medBonus("bandage"), Math.round(GEARD.RULES.heal.bandage.hp * 0.3));
  assert.ok(Math.abs(m.meleeStats("club").dmg - f.meleeStats("club").dmg * 0.9) < 1e-6);
  for (const e of [f, m]) {
    e.gr.inf = 50;
    e.s.minute = 1300;
    e.dy.pending = null;
    assert.ok(e.sleep());
  }
  assert.equal(f.gr.inf - m.gr.inf, 10);
  // 猎人：蹲行、陷阱
  for (const e of [f, h]) {
    e.s.minute = 600;
    e.f.crouch = true;
    Object.assign(e.s.player, { x: 600, y: 700 });
  }
  for (let i = 0; i < 20; i++) {
    f.update(0.05, { x: 1, y: 0 });
    h.update(0.05, { x: 1, y: 0 });
  }
  const df = f.s.player.x - 600,
    dh = h.s.player.x - 600;
  assert.ok(dh > df * 1.07 && dh < df * 1.13, "crouch +10%: " + df.toFixed(1) + " → " + dh.toFixed(1));
  const trap = Object.keys(GEARD.TRAPS)[0];
  for (const e of [f, h]) {
    e.f.crouch = false;
    e.s.inventory[trap] = 1;
    e.gr.trap = trap;
    e.s.slot = 6;
    assert.ok(e.placeTrap({ x: e.s.player.x + 50, y: e.s.player.y }), "trap placed");
  }
  assert.equal(h.gr.traps.at(-1).uses, f.gr.traps.at(-1).uses + 1);
  assert.equal(GEARD.TRAPS[trap].uses, f.gr.traps.at(-1).uses, "the table is untouched");
  // 机修工：修理、体力
  assert.deepEqual(c.repairCost("pipe"), { scrap: 1 });
  assert.deepEqual(f.repairCost("pipe"), { scrap: 2 });
  c.s.player.stamina = 100;
  c.update(0.05, { x: 0, y: 0 });
  assert.equal(c.s.player.stamina, 90);
  c.s.minute = 1300;
  c.dy.pending = null;
  assert.ok(c.sleep());
  assert.equal(c.s.player.stamina, 90);
  // 退伍兵：推开、被抓、饿
  for (const e of [f, v]) {
    e.s.minute = 600;
    e.s.player.stamina = 50;
    e.gx.shoveCd = 0;
    assert.ok(e.shove());
  }
  assert.equal(v.s.player.stamina - f.s.player.stamina, 3);
  assert.equal(GEARD.RULES.shove.cost, 10, "the rule table is untouched");
  const z1 = f.enemy("slow", f.s.player.x + 20, f.s.player.y, false),
    z2 = v.enemy("slow", v.s.player.x + 20, v.s.player.y, false);
  f.startGrab(z1);
  v.startGrab(z2);
  assert.ok(Math.abs(v.gx.grab.t - f.gx.grab.t * 0.8) < 1e-6);
  f.releaseGrab(true);
  v.releaseGrab(true);
  for (const e of [f, v]) {
    e.s.player.hunger = 80;
    e.s.player.stamina = 100;
  }
  for (let i = 0; i < 400; i++) {
    f.update(0.05, { x: 0, y: 0 });
    v.update(0.05, { x: 0, y: 0 });
  }
  const hf = 80 - f.s.player.hunger,
    hv = 80 - v.s.player.hunger;
  assert.ok(hf > 0 && hv > hf * 1.07 && hv < hf * 1.13, "hunger +10%: " + hf.toFixed(2) + " → " + hv.toFixed(2));
});

test("the opening tip names the weapon you actually have: the hunter's slingshot, the veteran's pipe", () => {
  for (const [o, want] of [
    ["hunter", /按 5 拿起弹弓/],
    ["veteran", /按 4 拿起铁管/],
    ["farmer", /按 4 拿起木棍/],
  ]) {
    const e = fresh(o);
    e.feel.open.phase = "fight";
    const z = e.enemy("slow", 1200, 420, false);
    z.tut = true;
    e.enemies.push(z);
    e.s.slot = 0;
    const c = e.coach();
    assert.ok(c, o);
    assert.match(c.text, want);
    if (o === "hunter") {
      assert.match(c.touch, /点快捷栏 5/);
      e.s.slot = 4;
      assert.notEqual(e.coach()?.id, "armSling");
      assert.equal(e.feel.open.seen.arm, true);
    }
  }
});

// ================= 二周目 =================
test("a second run carries blueprints, the career record, the achievements and one chosen piece of gear at full durability, and nothing else", async () => {
  const UI = await import("../dist/campaign-ui.js");
  const { e } = postStory(30);
  e.gr.bp.bp_sledge = 12;
  e.feel.career.trips = Array.from({ length: 5 }, (_, i) => ({ d: i + 1, r: "residential", ph: 0, g: ["club"], res: "done", t: 120, hp: 10, gr: 1, bi: 0, ro: 2, k: 5, f: [12], by: null }));
  e.s.inventory.riotHelmet = 1;
  e.cond("riotHelmet").d = 3;
  e.s.money = 9999;
  e.ln.held = 4;
  // 设置里出现“带着记忆重新开始”；没打完主线时没有
  assert.match(UI.ngPlusRow(e), /restartPlus/);
  const { e: young } = postStory(30, { act: 8 });
  assert.equal(UI.ngPlusRow(young), "");
  // 选出身和装备
  const args = { plus: true, origin: "medic", keep: "riotHelmet" };
  const html = UI.restartPicker(e, args);
  assert.match(html, /卫生员/);
  assert.match(html, /pickKeep/);
  assert.match(html, /防暴头盔|riotHelmet/);
  assert.match(UI.restartTitle(args), /带着记忆/);
  const s = UI.restartState(args, e);
  const g = new Engine(s, () => {});
  assert.equal(g.s.day, 1);
  assert.equal(g.storyDone(), false);
  assert.ok(g.s.money < 1000, "money is not carried");
  assert.equal(g.ln.origin, "medic");
  assert.equal(g.s.inventory.medkit, 1);
  assert.ok(g.gr.bp.bp_sledge, "blueprint carried");
  assert.equal(g.feel.career.trips.length, 5);
  assert.equal(g.s.inventory.riotHelmet, 1);
  assert.equal(g.gr.slots.head, "riotHelmet");
  assert.equal(g.cond("riotHelmet").d, g.cond("riotHelmet").m, "full durability");
  assert.equal(g.ln.legacy.ng, 1);
  assert.equal(g.ln.legacy.fromDay, 30);
  assert.equal(g.ln.legacy.held, 4);
  assert.equal(g.ln.legacy.keep, "riotHelmet");
  // 成就册里看得到上一周目
  const book = UI.renderCampaignView(g, { view: "collection" });
  if (g.ln.legacy.book.length) assert.match(book, /上一周目/);
  // 行囊上写着出身和第几周目
  assert.match(UI.renderGearPanel(g, {}), /出身：卫生员/);
  assert.match(UI.renderGearPanel(g, {}), /第 2 周目/);
  // 不能带没有的东西
  const s2 = UI.restartState({ plus: true, origin: "farmer", keep: "steelVest" }, e);
  assert.equal(s2.inventory.steelVest, undefined);
  assert.equal(s2.longnight.legacy.keep, "");
  // 存档：坏的 legacy 拒收
  const raw = g.serialize();
  for (const bad of [(x) => (x.longnight.legacy.ng = -1), (x) => (x.longnight.legacy.book = [1, 2]), (x) => (x.longnight.legacy.keep = "notAThing")]) {
    const x = JSON.parse(raw);
    bad(x);
    assert.throws(() => Engine.parse(JSON.stringify(x)), /长夜/);
  }
  assert.deepEqual(Engine.parse(raw).longnight.legacy, g.ln.legacy);
});

// ================= 存档提醒 =================
test("more than seven game days without an export: sleeping shows a one-click export card once a week; exporting resets it", async () => {
  const UI = await import("../dist/campaign-ui.js");
  const e = fresh("farmer");
  e.s.day = 8;
  assert.equal(e.exportDue(), false);
  assert.match(UI.exportLine(e), /还没导出过/);
  e.s.day = 9;
  assert.equal(e.exportDue(), true);
  e.s.minute = 1300;
  e.dy.pending = null;
  // 口粮多一点：平安的夜里不弹总结页，单独弹一张导出卡
  e.s.storage.bread = 40;
  const n0 = e.events.length;
  assert.ok(e.sleep());
  assert.ok(e.events.slice(n0).some((ev) => ev.type === "menu" && ev.view === "lnExport"), JSON.stringify(e.events.slice(n0).filter((ev) => ev.type === "menu")));
  const card = UI.renderCampaignView(e, { view: "lnExport" });
  assert.match(card, /data-action="export"/);
  assert.match(card, /还没导出过/);
  assert.equal(UI.campaignTitle({ view: "lnExport" }), "导出一份存档");
  // 第二晚不再提醒
  e.s.minute = 1300;
  const n1 = e.events.length;
  assert.ok(e.sleep());
  assert.ok(!e.events.slice(n1).some((ev) => ev.view === "lnExport"));
  // 导出以后清零，设置里写着第几天
  e.markExported();
  assert.equal(e.ln.exportDay, e.s.day);
  assert.equal(e.exportDue(), false);
  assert.match(UI.exportLine(e), /上次导出：第 \d+ 天（今天）/);
  e.s.day += 8;
  assert.equal(e.exportDue(), true);
  assert.match(UI.exportLine(e), /8 天前/);
  assert.match(UI.exportLine(e), /该导出一份了/);
  // 要弹日终总结的早上：提醒写在总结页里
  const g = fresh("farmer");
  g.s.day = 12;
  g.s.minute = 1300;
  g.dy.pending = null;
  g.s.storage = {};
  g.s.inventory.bread = 0;
  const m0 = g.events.length;
  assert.ok(g.sleep());
  const menus = g.events.slice(m0).filter((ev) => ev.type === "menu");
  assert.ok(menus.some((ev) => ev.view === "summary"));
  assert.ok(!menus.some((ev) => ev.view === "lnExport"));
  assert.equal(g.ln.remindDay, g.s.day);
  assert.match(UI.renderCampaignView(g, { view: "summary" }), /存档.*没导出[\s\S]*data-action="export"/);
  // 存档里记着，坏的拒收
  const raw = e.serialize();
  assert.equal(Engine.parse(raw).longnight.exportDay, e.ln.exportDay);
  const bad = JSON.parse(raw);
  bad.longnight.exportDay = -3;
  assert.throws(() => Engine.parse(JSON.stringify(bad)), /长夜/);
});
