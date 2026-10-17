// v0.35.0「长夜」：夜相（按时节轮换、提前一天说、各改一样东西）、没守住留下的（第二天早上的卡片、守夜笔记、纪念物、弱点提示）、
// 废墟和隧道里倒下的记号、存档和页面。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, needsStoryMigration } from "../dist/campaign.js";
import * as Grow from "../dist/grow.js";
import { TASKS } from "../dist/rebuild-data.js";
import { ITEMS, ZOMBIES, REGIONS } from "../dist/data.js";
import { LN, WAVE_MIX } from "../dist/longnight-data.js";
import { TOWER, TRAP_ALL, LN_PACE } from "../dist/tidy-data.js";
import { HORDE_DIRECTIONS } from "../dist/expansion-data.js";
import { MOMENT_KINDS } from "../dist/zest-data.js";
import { MOMENT_SOUND, STINGERS } from "../dist/audio-data.js";
import { decorItem, DECOR_BY_ID, DECOR_DRAW, seasonOf, yearOf } from "../dist/almanac-data.js";
import { DRAW as ICON_DRAW } from "../dist/item-sprites.js";
import { PHASES, PHASE_IDS, SEASON_PHASES, NF_KEEPSAKE, NF_DECOR, NOTES_MAX, MORNING_LINES, FALL_MARK, FALL_HINTS, INTRO_LINES, PHASE_LOOK } from "../dist/nightfall-data.js";

const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const make = (state = freshState(), seed = 35001) => {
  state.undertow.seed = seed;
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
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
function postStory(day = 30, state = freshState()) {
  const { e, toasts } = make(state);
  toAct(e, 9);
  e.s.day = day;
  e.s.minute = 600;
  e.c.workClock = 0;
  e.s.stats.hordes = 6;
  e.s.horde = { phase: "won", timer: 0, remaining: 0, spawnTimer: 0, direction: 0 };
  e.c.nextHordeDay = day + 60;
  e.dy.pending = null;
  go(e, "farm");
  e.update(0.016, { x: 0, y: 0 });
  return { e, toasts };
}
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
  e.c.nextHordeDay = Math.max(e.c.nextHordeDay || 0, day + 30);
};
// 长夜开始（22:00）：force 指定夜相（不给就按日子）
function night(e, day, force = null) {
  e._nfForce = force;
  clock(e, day, 1319.9);
  run(e, 0.2);
  assert.ok(e.ln.night, "the night started on day " + day + ": horde " + e.s.horde.phase + ", raid " + (e.raidState?.().phase || "") + ", region " + e.s.region + ", pending " + e.lnPending(day) + ", paused " + e.paused);
  return e.ln.night;
}
const moments = (e, kind) => e.events.filter((ev) => ev.type === "moment" && ev.kind === kind);
const FIRST = 38;
const B = (e, type, x, y) => {
  const b = { id: "t-" + type + "-" + e.s.buildings.length, type, x, y, rotation: 0, hp: 200 };
  e.s.buildings.push(b);
  e.navRevision = (e.navRevision || 0) + 1;
  return b;
};

// ================= 数据 =================
test("eight phases, two per season, each with a rule, a hint, what it favours, a look and a keepsake that sells for nothing", () => {
  assert.equal(PHASE_IDS.length, 8);
  const all = Object.values(SEASON_PHASES).flat();
  assert.deepEqual([...all].sort(), [...PHASE_IDS].sort());
  for (const [season, list] of Object.entries(SEASON_PHASES)) for (const ph of list) assert.equal(PHASES[ph].season, season);
  for (const id of PHASE_IDS) {
    const P = PHASES[id];
    for (const k of ["name", "short", "rule", "hint", "good", "bad"]) assert.ok(typeof P[k] === "string" && P[k].length > 1, id + " " + k);
    assert.ok(Object.keys(P.fx).length >= 1, id + " changes something");
    assert.ok(PHASE_LOOK[id], id + " has a look");
    const item = decorItem(NF_KEEPSAKE[id]);
    assert.ok(ITEMS[item], id + " keepsake item");
    assert.equal(ITEMS[item].sell, 0, "keepsakes sell for nothing");
    assert.equal(ITEMS[item].decor, NF_KEEPSAKE[id]);
    assert.ok(DECOR_BY_ID[NF_KEEPSAKE[id]] && DECOR_DRAW[NF_KEEPSAKE[id]] && ICON_DRAW[item], id + " keepsake drawn");
    for (const s of [P.name, P.short, P.rule, P.hint, ITEMS[item].name, ITEMS[item].desc]) assert.doesNotMatch(s, FORBIDDEN);
  }
  assert.equal(new Set(PHASE_IDS.map((p) => PHASES[p].name)).size, 8);
  assert.equal(NF_DECOR.length, 8);
  for (const t of Object.keys(ZOMBIES)) assert.ok(FALL_HINTS[t], "a fall hint for " + t);
  for (const k of ["nfPhase", "nfLost"]) {
    assert.ok(MOMENT_KINDS[k]?.label, k);
    assert.ok(STINGERS[MOMENT_SOUND[k].stinger], k + " sound");
  }
  for (const lines of Object.values(MORNING_LINES)) for (const l of lines) assert.doesNotMatch(l, FORBIDDEN);
});

// 规则里写的数和真起作用的数一样（“三成五”“多一倍”“慢两成”“02:45”……）
const CN = ["", "一", "两", "三", "四", "五", "六", "七", "八", "九"];
const cheng = (f) => {
  const t = Math.round(f * 100),
    a = Math.floor(t / 10),
    b = t % 10;
  return (a ? CN[a] + "成" : "") + (b ? CN[b] : "");
};
const more = (m) => (m >= 2 ? CN[Math.round(m - 1)] + "倍" : cheng(m - 1));
const less = (m) => (Math.abs(m - 0.5) < 1e-9 ? "一半" : cheng(1 - m));
test("each rule says the numbers its effects use", () => {
  const { e } = make();
  const mixName = { runner: "奔跑者", armor: "重甲", stalker: "夜行者", slow: "游荡者", screamer: "尖叫者", spitter: "吐酸者", bloater: "膨胀者" };
  for (const id of PHASE_IDS) {
    const { rule, fx } = PHASES[id],
      want = [];
    // 瞭望塔原来够得着 320（expansion.js 的 updateDefense）
    if (fx.towerRange) want.push("原来的" + cheng(Math.round((fx.towerRange / 320) * 10) / 10));
    if (fx.clear) want.push("看不清");
    if (fx.towerDmg) want.push((fx.towerDmg > 1 ? "多" + more(fx.towerDmg) : "少" + less(fx.towerDmg)));
    if (fx.trapMute) want.push(cheng(fx.trapMute) + "哑火");
    if (fx.trapFirst) want.push("第一下不响");
    if (fx.count) want.push((fx.count < 1 ? "少来" + less(fx.count) : "多来" + more(fx.count)));
    for (const [k, m] of Object.entries(fx.mix || {})) want.push(mixName[k] + (m > 1 ? "多" + more(m) : "少" + less(m)));
    if (fx.speed) want.push("慢" + less(fx.speed));
    if (fx.hp) want.push("血多" + more(fx.hp));
    if (fx.regen) want.push("体力回得慢" + less(fx.regen));
    if (fx.warmRegen) want.push("快" + more(fx.warmRegen));
    if (fx.bossEarly) want.push("（" + e.nfClock(LN_PACE.bossAt - fx.bossEarly) + "）");
    if (fx.oneDir) want.push("同一个方向");
    assert.ok(want.length >= 2, id + " has at least two effects");
    for (const w of want) assert.ok(rule.includes(w), `${id}: the rule says “${w}” (${rule})`);
  }
});

// ================= 1. 夜相 =================
test("phases follow the season and the year: four long nights in a row are four different phases, eight in a row are all eight", () => {
  const { e } = postStory(30);
  const days = [];
  for (let d = 31; days.length < 16; d++) if (e.isLongNight(d)) days.push(d);
  assert.equal(days[0], FIRST);
  const ph = days.map((d) => e.nfPhase(d));
  assert.ok(ph.every(Boolean), "every long night has a phase");
  for (let i = 0; i + 4 <= ph.length; i++) assert.equal(new Set(ph.slice(i, i + 4)).size, 4, "4 in a row differ: " + ph.slice(i, i + 4));
  for (let i = 0; i + 8 <= ph.length; i++) assert.equal(new Set(ph.slice(i, i + 8)).size, 8, "8 in a row are all eight");
  for (const d of days) {
    const list = SEASON_PHASES[seasonOf(d).id];
    assert.equal(e.nfPhase(d), list[(yearOf(d) - 1) % 2], "day " + d);
  }
  assert.equal(e.nfPhase(FIRST + 1), null, "not a long night");
  // 和存档无关的日子算法：读档以后一样
  const back = new Engine(Engine.parse(JSON.stringify(e.s)), () => {});
  assert.deepEqual(days.map((d) => back.nfPhase(d)), ph);
});

test("the phase is told a day ahead (morning radio, alert, journal), on the day by an 08:00 card and at 22:00 by one short line", async () => {
  const UI = await import("../dist/campaign-ui.js");
  const { alertItems } = await import("../dist/winter-ui.js");
  const { e, toasts } = postStory(30);
  const ph = e.nfPhase(FIRST),
    P = PHASES[ph];
  // 前一天
  clock(e, FIRST - 1, 410);
  run(e, 0.1);
  assert.ok(!alertItems(e).some((a) => /明晚长夜/.test(a.text)), "not before the 07:00 radio");
  const parts = e.morningParts(FIRST - 1);
  assert.match(parts[0], new RegExp("^明晚是长夜，" + P.name + "："));
  clock(e, FIRST - 1, 430);
  run(e, 0.1);
  assert.ok(alertItems(e).some((a) => a.text === "明晚长夜 · " + P.name));
  assert.ok(e.todayItems().some((x) => x.text === "明天是长夜 · " + P.name));
  assert.ok(UI.renderCampaignJournal(e, {}).includes("下一个在第 " + FIRST + " 天（明天）· " + P.name + " · 约"));
  // 当天 08:00：一张卡片，只一张
  clock(e, FIRST, 470);
  run(e, 0.2);
  assert.equal(moments(e, "nfPhase").length, 0);
  clock(e, FIRST, 481);
  run(e, 0.5);
  const cards = moments(e, "nfPhase");
  assert.equal(cards.length, 1);
  assert.equal(cards[0].title, "今晚是" + P.name);
  assert.ok(cards[0].lines.some((l) => l.includes("吃香的")));
  run(e, 1);
  assert.equal(moments(e, "nfPhase").length, 1, "once");
  assert.ok(e.todayItems().some((x) => x.text.startsWith("今晚 22:00 长夜") && x.text.endsWith(" · " + P.name)));
  // 22:00：一句短的
  night(e, FIRST);
  assert.ok(toasts.some((t) => t.text === "今晚是" + P.name + "：" + P.short + "。"));
  assert.equal(e.nf.seen[ph], FIRST);
  assert.match(UI.campaignHud(e).raid, new RegExp("长夜 · " + P.name + " · 第 1/3 波"));
});

test("an old save gets phases only after the day it is loaded, so none comes unannounced, and one card explains", () => {
  const { e } = postStory(30);
  clock(e, FIRST, 600);
  const raw = JSON.parse(JSON.stringify(e.s));
  delete raw.nightfall;
  assert.equal(needsStoryMigration(JSON.stringify(raw)), true);
  const { e: old } = make(Engine.parse(JSON.stringify(raw)));
  assert.equal(old.nf.since, FIRST);
  assert.equal(old.nfPhase(FIRST), null, "today's night stays as it was");
  assert.ok(old.nfPhase(FIRST + 7), "the next one has a phase");
  old.update(0.016, { x: 0, y: 0 });
  const intro = old.events.filter((ev) => ev.type === "moment" && ev.title === "长夜");
  assert.equal(intro.length, 1);
  assert.deepEqual(intro[0].lines, INTRO_LINES.slice(0, 4).map((l) => l.slice(0, 120)));
  old.update(0.016, { x: 0, y: 0 });
  assert.equal(old.events.filter((ev) => ev.type === "moment" && ev.title === "长夜").length, 1);
  // 新开的局没有这张卡片，从第一天起就有夜相
  const { e: fresh } = make();
  assert.equal(fresh.nf.since, 0);
  assert.equal(fresh.nf.intro, undefined);
  assert.equal(needsStoryMigration(JSON.stringify(fresh.s)), false);
});

test("fog: towers don't reach as far as on a clear night", () => {
  const { e } = postStory(30);
  night(e, FIRST, "fog");
  const r = PHASES.fog.fx.towerRange,
    tower = B(e, "tower", 830, 600),
    near = { x: 830, y: 600 - (r - 40) },
    far = { x: 830, y: 600 - (r + 50) };
  assert.ok(r + 50 < 320, "the far one is still in reach on a clear night");
  assert.equal(e.towerLineClear(tower, near), true);
  assert.equal(e.towerLineClear(tower, far), false, "fog hides it");
  e._nfForce = "none";
  assert.equal(e.towerLineClear(tower, far), true, "a clear night sees it");
});

test("thunder: each wave is a little smaller and traps sometimes misfire, without wearing out", () => {
  const { e } = postStory(30);
  const N = night(e, FIRST, "thunder");
  assert.equal(e.waveCount(0, 1), Math.round(LN.base[0] * PHASES.thunder.fx.count));
  e._nfForce = "none";
  assert.equal(e.waveCount(0, 1), LN.base[0]);
  e._nfForce = "thunder";
  const trap = B(e, "trap", 700, 500);
  let muted = 0,
    hit = 0;
  for (let i = 0; i < 200; i++) {
    const z = e.enemy("slow", 700, 500, true);
    z.id = "mute-" + i;
    const hp0 = z.hp;
    e._damageSource = "trap";
    e.hurtEnemy(z, 20, 0);
    e._damageSource = null;
    if (z.hp === hp0) muted++;
    else hit++;
  }
  const want = 200 * PHASES.thunder.fx.trapMute,
    sd = Math.sqrt(want * (1 - PHASES.thunder.fx.trapMute));
  assert.ok(Math.abs(muted - want) < 4 * sd, "about " + want + " of 200 misfire: " + muted);
  assert.ok(hit > 100);
  // 哑了的不掉耐久：踩着陷阱跑，掉的耐久只算真打中的
  const z = e.enemy("slow", 700, 500, true);
  z.id = "walker";
  e.enemies.push(z);
  const hp0 = trap.hp,
    m0 = e.nf.stats.muted;
  let bites = 0;
  for (let i = 0; i < 400 && !z.dead; i++) {
    const before = z.hp;
    z.x = 700;
    z.y = 500;
    z.trapCooldown = 0;
    e.updateEnemy(z, 0.016);
    if (z.hp < before) bites++;
  }
  const wore = hp0 - trap.hp;
  assert.ok(e.nf.stats.muted > m0, "some misfired");
  assert.equal(wore, bites * 10, "only real hits wear the trap");
  assert.equal(N.day, FIRST);
});

test("moon: towers hit harder (the boss harder still) and more stalkers come in waves two and three", () => {
  const { e } = postStory(30);
  night(e, FIRST, "moon");
  const fx = PHASES.moon.fx;
  const dmg = (force, boss = false) => {
    e._nfForce = force;
    const z = e.enemy(boss ? "brute" : "slow", 900, 500, true);
    if (boss) z.lnBoss = true;
    const hp0 = z.hp;
    e._damageSource = "tower";
    e.hurtEnemy(z, 10, 0);
    e._damageSource = null;
    return hp0 - z.hp;
  };
  const moon = dmg("moon"),
    plain = dmg("none");
  assert.ok(Math.abs(moon / plain - fx.towerDmg) < 0.02, moon + " vs " + plain);
  if (fx.towerBoss) {
    const mb = dmg("moon", true),
      pb = dmg("none", true);
    assert.ok(pb > 0 && Math.abs(mb / pb - fx.towerDmg * fx.towerBoss) < 0.05, "the boss: " + mb + " vs " + pb);
  }
  const share = (force) => {
    e._nfForce = force;
    const N = e.ln.night;
    N.wave = 2;
    let st = 0;
    const made0 = N.made;
    for (let i = 0; i < 400; i++) {
      N.left = 5;
      const z = e.lnSpawn();
      if (z.type === "stalker") st++;
      e.enemies.pop();
    }
    N.made = made0;
    return st / 400;
  };
  const a = share("moon"),
    b = share("none");
  const w = WAVE_MIX[1],
    tot = Object.values(w).reduce((x, y) => x + y, 0);
  assert.ok(Math.abs(b - w.stalker / tot) < 0.05, "plain share " + b);
  const m = fx.mix.stalker;
  assert.ok(m > 1);
  assert.ok(Math.abs(a - (m * w.stalker) / (tot + (m - 1) * w.stalker)) < 0.05, "moon share " + a);
});

test("swelter: your stamina comes back slower and the horde walks slower", () => {
  const { e } = postStory(30);
  night(e, FIRST, "swelter");
  const regen = (force) => {
    e._nfForce = force;
    e.s.player.stamina = 20;
    const s0 = e.s.player.stamina;
    run(e, 1);
    return e.s.player.stamina - s0;
  };
  const hot = regen("swelter"),
    plain = regen("none");
  assert.ok(plain > 0);
  assert.ok(Math.abs(hot / plain - PHASES.swelter.fx.regen) < 0.06, hot + " vs " + plain);
  const z = e.enemy("slow", 900, 500, true);
  e._nfForce = "swelter";
  const v1 = e.enemySpeed(z);
  e._nfForce = "none";
  const v0 = e.enemySpeed(z);
  assert.ok(Math.abs(v1 / v0 - PHASES.swelter.fx.speed) < 1e-9);
  if (PHASES.swelter.fx.count) assert.equal(e.waveCount(0, 1), Math.max(1, Math.round(LN.base[0] * PHASES.swelter.fx.count)));
});

test("migration: more runners and less armour", () => {
  const { e } = postStory(30);
  night(e, FIRST, "migrate");
  const count = (force) => {
    e._nfForce = force;
    const N = e.ln.night;
    N.wave = 1;
    const c = {},
      made0 = N.made;
    for (let i = 0; i < 400; i++) {
      N.left = 5;
      const z = e.lnSpawn();
      c[z.type] = (c[z.type] || 0) + 1;
      e.enemies.pop();
    }
    N.made = made0;
    return c;
  };
  const m = count("migrate"),
    p = count("none");
  assert.ok(m.runner > p.runner * 1.4, "runners " + m.runner + " vs " + p.runner);
  assert.ok((m.armor || 0) < (p.armor || 0), "armour " + m.armor + " vs " + p.armor);
});

test("gale: all three waves come from one side, named the day before", () => {
  const { e, toasts } = postStory(30);
  const day = FIRST;
  e._nfForce = "gale";
  const dirs = e.lnDirs(day);
  assert.equal(dirs.length, 1);
  const name = HORDE_DIRECTIONS[dirs[0]].name;
  assert.match(e.nfRule("gale", day), new RegExp("（从" + name + "来）"));
  clock(e, day - 1, 430);
  assert.ok(e.morningParts(day - 1)[0].includes(name));
  const N = night(e, day, "gale");
  run(e, 20);
  // 三波都从那一边：叫第二、三波，名字只有一个方向
  e.lnWave(2);
  e.lnWave(3);
  assert.ok(toasts.some((t) => t.text === "第 2 波来了（共 3 波）：从" + name + "过来。"), "wave two from one side");
  const pts = HORDE_DIRECTIONS[dirs[0]].spawns;
  for (const z of e.enemies.filter((q) => q.horde && !q.lnBoss)) assert.ok(pts.some(([x, y]) => Math.hypot(z.homeX - x, z.homeY - y) < 140), "spawned on that side");
  assert.equal(N.wave, 3);
  const shot = (force) => {
    e._nfForce = force;
    const z = e.enemy("slow", 900, 500, true),
      hp0 = z.hp;
    e._damageSource = "tower";
    e.hurtEnemy(z, 10, 0);
    e._damageSource = null;
    return hp0 - z.hp;
  };
  assert.ok(Math.abs(shot("gale") / shot("none") - (PHASES.gale.fx.towerDmg ?? 1)) < 0.01);
  if (PHASES.gale.fx.count) assert.equal(e.waveCount(0, 1), Math.max(1, Math.round(LN.base[0] * PHASES.gale.fx.count)));
  assert.ok(TOWER.mult > 0);
});

test("frost: slower, tougher infected, and stamina comes back faster by a fire", () => {
  const { e } = postStory(30);
  night(e, FIRST, "frost");
  const N = e.ln.night;
  const made0 = N.made;
  N.left = 5;
  const a = e.lnSpawn();
  e.enemies.pop();
  N.made = made0;
  N.left = 5;
  e._nfForce = "none";
  const b = e.lnSpawn();
  e.enemies.pop();
  assert.equal(a.type, b.type, "same draw");
  assert.ok(Math.abs(a.maxHp / b.maxHp - PHASES.frost.fx.hp) < 0.02, a.maxHp + " vs " + b.maxHp);
  e._nfForce = "frost";
  const v1 = e.enemySpeed(a);
  e._nfForce = "none";
  const v0 = e.enemySpeed(a);
  assert.ok(Math.abs(v1 / v0 - PHASES.frost.fx.speed) < 1e-9);
  // 火边（农舍门口算暖区）
  const regen = (force, x, y) => {
    e._nfForce = force;
    e.s.player.x = x;
    e.s.player.y = y;
    e.s.player.stamina = 20;
    run(e, 1);
    return e.s.player.stamina - 20;
  };
  const warm = regen("frost", 340, 330),
    cold = regen("frost", 700, 720),
    plainWarm = regen("none", 340, 330);
  assert.ok(e.warmAt({ x: 340, y: 330 }), "by the farmhouse is warm");
  assert.ok(!e.warmAt({ x: 700, y: 720 }), "out in the field is not");
  assert.ok(Math.abs(warm / plainWarm - PHASES.frost.fx.warmRegen) < 0.1, warm + " vs " + plainWarm);
  assert.ok(Math.abs(cold / plainWarm - 1) < 0.1, "away from the fire as usual");
});

test("snow: each trap's first bite is silent and the boss comes early, said at 22:00 and with the third wave", () => {
  const { e, toasts } = postStory(30);
  const N = night(e, FIRST, "snow");
  const at = e.nfClock(LN_PACE.bossAt - PHASES.snow.fx.bossEarly);
  assert.match(at, /^0[23]:[0-5]\d$/);
  assert.ok(toasts.some((t) => t.text.includes("，" + at + " ")), "the start line names " + at);
  assert.ok(!toasts.some((t) => t.text.includes("，03:00 ")));
  N.wave = 3;
  const next = e.lnNext();
  assert.equal(next.what, "boss");
  assert.equal(next.at, N.start + LN_PACE.bossAt - PHASES.snow.fx.bossEarly);
  assert.ok(e.lnBossNote(N).startsWith(at + "，"), e.lnBossNote(N));
  const trap = B(e, "trap", 700, 500);
  const bite = (id) => {
    const z = e.enemy("slow", 700, 500, true);
    z.id = id;
    const hp0 = z.hp;
    e._damageSource = "trap";
    e.hurtEnemy(z, 20, 0);
    e._damageSource = null;
    return hp0 - z.hp;
  };
  assert.equal(bite("s1"), 0, "first bite silent");
  assert.ok(bite("s2") > 0, "then it works");
  assert.ok(bite("s3") > 0);
  const t2 = B(e, "trap", 1000, 500);
  void t2;
  const z = e.enemy("slow", 1000, 500, true),
    hp0 = z.hp;
  e._damageSource = "trap";
  e.hurtEnemy(z, 20, 0);
  e._damageSource = null;
  assert.equal(z.hp, hp0, "another trap's first bite is silent too");
  assert.equal(trap.hp, 200);
});

test("phases leave holding, rewards and the size of the next night as they were", () => {
  const { e } = postStory(30);
  const N = night(e, FIRST, "fog");
  const before = e.lnMult();
  clock(e, FIRST + 1, 240.5);
  run(e, 0.2);
  assert.equal(e.ln.night, null);
  assert.equal(e.ln.held, 1);
  assert.equal(e.nf.held.fog, 1);
  assert.ok(e.lnMult() > before);
  assert.equal(N.day, FIRST);
});

test("the farm sounds like the phase on a long night: rain with thunder, a strong wind, snow; nowhere else and not on other nights", () => {
  const { e } = postStory(30);
  clock(e, FIRST - 1, 1380);
  e._nfForce = "thunder";
  assert.equal(e.soundWeather(), null, "the night before is a plain night");
  clock(e, FIRST, 600);
  assert.equal(e.soundWeather(), null, "nothing in the morning of the long night");
  clock(e, FIRST, 1140);
  assert.equal(e.lnSky() >= 0.5, true);
  assert.equal(e.soundWeather(), "rainHeavy", "from when the sky is half red");
  const want = { fog: null, thunder: "rainHeavy", moon: null, swelter: null, migrate: null, gale: "windStrong", frost: "snow", snow: "snow" };
  night(e, FIRST, "fog");
  for (const ph of PHASE_IDS) {
    e._nfForce = ph;
    assert.equal(e.soundWeather(), want[ph], ph);
    assert.equal(PHASE_LOOK[ph].sound || null, want[ph]);
  }
  e._nfForce = "gale";
  go(e, "residential");
  assert.equal(e.soundWeather(), null, "not in a ruin");
});

// ================= 2. 没守住留下的 =================
test("a lost night always leaves something: a page in the night notes, next morning's card, and the first time for a phase a keepsake; never money", async () => {
  const UI = await import("../dist/campaign-ui.js");
  const { e } = postStory(30);
  e.recruit("medic");
  const ph = e.nfPhase(FIRST),
    P = PHASES[ph],
    item = decorItem(NF_KEEPSAKE[ph]);
  night(e, FIRST);
  run(e, 3);
  const money0 = e.s.money;
  e.invulnerable = 0;
  e.damagePlayer(999);
  assert.equal(e.ln.night, null);
  assert.equal(e.ln.failed, 1);
  assert.equal(e.nf.lost[ph], 1);
  assert.equal(e.nf.hint[ph], FIRST);
  assert.equal(e.nf.notes.length, 1);
  assert.equal(e.nf.notes[0].phase, ph);
  assert.ok(e.s.money <= money0, "no money for losing");
  // 战报写夜相和记下的那一句
  const rep = UI.renderCampaignView(e, { view: "lnight" });
  assert.match(rep, new RegExp("第 1 个长夜 · " + P.name + " · 没守住"));
  assert.ok(rep.includes("守夜笔记记下了：" + P.hint));
  assert.doesNotMatch(rep, FORBIDDEN);
  // 第二天 06:00 前没有卡片
  e.paused = false;
  clock(e, FIRST + 1, 300);
  run(e, 0.2);
  assert.equal(moments(e, "nfLost").length, 0);
  clock(e, FIRST + 1, 361);
  run(e, 0.2);
  const card = moments(e, "nfLost");
  assert.equal(card.length, 1);
  assert.equal(card[0].title, "第 1 个长夜没守住 · " + P.name);
  assert.ok(MORNING_LINES.medic.includes(card[0].lines[0]), "the medic says it: " + card[0].lines[0]);
  assert.ok(card[0].lines.some((l) => l.includes(ITEMS[item].name)));
  assert.equal((e.s.inventory[item] || 0) + (e.s.storage[item] || 0), 1, "the keepsake");
  assert.equal(e.nf.keep[ph], FIRST + 1);
  run(e, 1);
  assert.equal(moments(e, "nfLost").length, 1, "once");
  // 下一回同样的夜相：前一天的广播多一句
  const again = FIRST + 56;
  assert.equal(e.nfPhase(again), ph);
  assert.ok(e.morningParts(again - 1).some((p) => p.startsWith("上回" + P.name + "没守住，记下了：")));
  // 同一夜相再输：笔记照记、早上照样一张卡片，不再给纪念物（故意输刷不出东西）
  night(e, again);
  e.invulnerable = 0;
  e.damagePlayer(999);
  e.paused = false;
  clock(e, again + 1, 400);
  run(e, 0.2);
  assert.equal(moments(e, "nfLost").length, 2);
  assert.equal(e.nf.notes.length, 2);
  assert.equal((e.s.inventory[item] || 0) + (e.s.storage[item] || 0), 1, "still one keepsake");
  assert.equal(ITEMS[item].sell, 0);
  assert.equal(e.nf.stats.keepsakes, 1);
});

test("every lost night of a long run leaves a page and a card; the notes keep the last twelve", () => {
  const { e } = postStory(30);
  // 灰隼团反扑打完了（不然最后那一仗的那天，长夜要等它打完）
  Object.assign(e.ct, { step: 4, done: true });
  const days = [];
  for (let d = FIRST; days.length < 14; d++) if (e.isLongNight(d)) days.push(d);
  let cards = 0;
  for (const d of days) {
    night(e, d);
    e.invulnerable = 0;
    e.damagePlayer(999);
    e.paused = false;
    clock(e, d + 1, 420);
    run(e, 0.1);
    cards = moments(e, "nfLost").length;
  }
  assert.equal(cards, days.length, "a card every time");
  assert.equal(e.nf.stats.lost, days.length);
  assert.equal(e.nf.notes.length, NOTES_MAX);
  assert.equal(e.nf.stats.keepsakes, 8, "one keepsake per phase, no more");
  const back = new Engine(Engine.parse(JSON.stringify(e.s)), () => {});
  assert.equal(back.nf.notes.length, NOTES_MAX);
});

// ================= 3. 废墟、隧道倒下也记一笔 =================
test("going down in a ruin leaves a flag for seven days and one reminder of who did it and what to do next time", () => {
  const { e, toasts } = postStory(30);
  clock(e, 40, 600);
  go(e, "residential");
  run(e, 0.1);
  e.fx.lastHitBy = "runner";
  const px = e.s.player.x;
  e.invulnerable = 0;
  e.damagePlayer(999);
  assert.equal(e.s.region, "farm");
  assert.equal(e.nf.falls.length, 1);
  assert.equal(e.nf.falls[0].by, "runner");
  assert.equal(e.nf.falls[0].x, Math.round(px));
  assert.equal(e.nfFallMarks("residential").length, 1);
  e.paused = false;
  run(e, 0.1);
  go(e, "residential");
  run(e, 0.1);
  const told = toasts.filter((t) => t.text.startsWith("上回你在这里倒下"));
  assert.equal(told.length, 1);
  assert.ok(told[0].text.includes("被奔跑者打倒") && told[0].text.includes(FALL_HINTS.runner));
  go(e, "farm");
  run(e, 0.1);
  go(e, "residential");
  run(e, 0.1);
  assert.equal(toasts.filter((t) => t.text.startsWith("上回你在这里倒下")).length, 1, "once per fall");
  clock(e, 40 + FALL_MARK.days + 1, 600);
  assert.equal(e.nfFallMarks("residential").length, 0, "the flag is gone after a week");
  // 长夜里倒下不算这个（长夜有自己的笔记）
  assert.equal(e.nfFallMarks("farm").length, 0);
});

test("in the tunnel the fall is kept by floor, without a flag (the floor looks different every day)", () => {
  const { e, toasts } = postStory(30);
  e.s.region = "tunnel";
  e.tunnelFloor = () => 4;
  e.fx.lastHitBy = "spitter";
  e.invulnerable = 0;
  e.die();
  assert.equal(e.nf.falls.at(-1).region, "tunnel");
  assert.equal(e.nf.falls.at(-1).floor, 4);
  assert.equal(e.nfFallMarks("tunnel").length, 0);
  e.s.region = "tunnel";
  e.tunnelFloor = () => 3;
  e.nfFallTick();
  assert.ok(!toasts.some((t) => t.text.startsWith("上回你在这里倒下")), "a different floor");
  e.tunnelFloor = () => 4;
  e.nfFallTick();
  assert.ok(toasts.some((t) => t.text.startsWith("上回你在这里倒下") && t.text.includes(FALL_HINTS.spitter)));
});

// ================= 存档 =================
test("the nightfall record saves and loads; broken records are refused", () => {
  const { e } = postStory(30);
  night(e, FIRST);
  e.invulnerable = 0;
  e.damagePlayer(999);
  const good = JSON.stringify(e.s);
  const back = Engine.parse(good);
  assert.deepEqual(back.nightfall, JSON.parse(good).nightfall);
  const bad = (fn) => {
    const raw = JSON.parse(good);
    fn(raw.nightfall);
    assert.throws(() => Engine.parse(JSON.stringify(raw)), /夜相记录损坏/);
  };
  bad((g) => (g.seen = { blizzard: 3 }));
  bad((g) => (g.lost.fog = -1));
  bad((g) => (g.notes = Array.from({ length: NOTES_MAX + 1 }, () => ({ day: 3, n: 1, phase: "fog", wave: 1, kills: 0 }))));
  bad((g) => (g.notes[0].phase = "storm"));
  bad((g) => (g.morning = { day: "x" }));
  bad((g) => (g.falls = [{ region: "moon", x: 1, y: 1, day: 3, by: "", floor: 0, told: false }]));
  bad((g) => (g.falls = [{ region: "farm", x: 1, y: 1, day: 3, by: "", floor: 0, told: false }]));
  bad((g) => (g.falls = [{ region: "residential", x: 1, y: 1, day: 3, by: "dragon", floor: 0, told: false }]));
  bad((g) => (g.since = -2));
  bad((g) => (g.stats.lost = 1.5));
  // 上一层照常（旧档能读、成长的记录照常）
  assert.ok(Grow.Engine.parse(good).grow);
});

// ================= 页面 =================
test("journal, alerts, report, calendar and the achievements book speak plainly about phases", async () => {
  const UI = await import("../dist/campaign-ui.js");
  const { e } = postStory(30);
  const ph = e.nfPhase(FIRST),
    P = PHASES[ph];
  const j = UI.renderCampaignJournal(e, {});
  assert.match(j, /<b>夜相<\/b>见过 0\/8 种/);
  assert.doesNotMatch(j, FORBIDDEN);
  const cal = UI.renderCampaignView(e, { view: "calendar" });
  assert.ok(cal.includes('<span class="tag danger">长夜 · ' + P.name + "</span>"));
  clock(e, FIRST, 600);
  run(e, 0.1);
  const hud = UI.campaignHud(e);
  assert.ok(hud.alerts.includes("今晚 22:00 长夜 · " + P.name));
  const j2 = UI.renderCampaignJournal(e, {});
  assert.ok(j2.includes("22:00 长夜（第 1 个 · " + P.name + "）"));
  assert.ok(j2.includes(P.name + "：" + e.nfRule(ph, FIRST)));
  const rep = UI.renderCampaignView(e, { view: "lnight" });
  assert.ok(rep.includes("夜相 · 见过 0/8"));
  assert.ok(rep.includes("今晚：" + P.name));
  for (const id of PHASE_IDS) assert.ok(rep.includes("<b>" + PHASES[id].name + "</b>"));
  assert.doesNotMatch(rep, FORBIDDEN);
  const col = UI.renderCampaignView(e, { view: "collection" });
  assert.match(col, /见过的夜相/);
  assert.match(col, /守住过的夜相/);
  assert.doesNotMatch(col, FORBIDDEN);
});
