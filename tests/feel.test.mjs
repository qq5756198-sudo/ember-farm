// v0.23.0「回响」：翻滚、命中停顿、挨打动作、尸体血迹、事件带位置、开局那一拨、生涯记录、
// 每日抉择“稍后再选”、平安的早上不弹日终总结、手记的“今天”，以及这些在界面上的样子。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, newGameState } from "../dist/campaign.js";
import { Engine as GearEngine, freshState as gearFresh } from "../dist/gear.js";
import { ROLL, HITSTOP, REMAINS, OPENING, CAREER, LATER } from "../dist/feel-data.js";
import { EVENTS } from "../dist/daily-data.js";
import { RULES } from "../dist/gear-data.js";
import { ITEMS } from "../dist/data.js";
import { renderCampaignView, renderCampaignJournal, handleCampaignAction, menuLock, soundRows, helpHtml, patchPadHelp, radialItems, radialHtml, radialPick, coachHtml, CueQueue, careerHtml, todayHtml } from "../dist/campaign-ui.js";
import { patchPhone } from "../dist/feel-ui.js";
import { alertItems } from "../dist/winter-ui.js";
import * as Session from "../dist/player-session.js";

const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const make = (state = freshState()) => {
  const toasts = [];
  const e = new Engine(state, (t, tone) => toasts.push({ t, tone }));
  e.paused = false;
  e.toasts = toasts;
  e.update(0.016, { x: 0, y: 0 });
  return e;
};
const run = (e, secs, input = { x: 0, y: 0 }) => {
  for (let t = 0; t < secs; t += 0.05) e.update(0.05, input);
};
const go = (e, region) => {
  e.travel(region);
  e.paused = false;
  e.update(0.016, { x: 0, y: 0 });
};
const open = (e, x, y) => {
  Object.assign(e.s.player, { x, y });
};

// ================= 翻滚 =================
test("dodge roll: 110 far in 0.35 s, 15 stamina, 0.8 s apart, no damage for the first 0.25 s", () => {
  const e = make(),
    p = e.s.player;
  open(e, 700, 640);
  const x0 = p.x;
  assert.equal(e.dodgeReason(), "");
  assert.equal(e.dodge({ x: -1, y: 0 }), true);
  assert.equal(p.stamina, 100 - ROLL.cost);
  assert.ok(e.invulnerable >= ROLL.inv - 1e-9);
  // 不受伤：普通出手、扑人、冲撞都打不中
  const hp = p.hp;
  e.damagePlayer(20);
  assert.equal(p.hp, hp, "invulnerable in the first 0.25 s");
  assert.equal(e.dodge({ x: 1, y: 0 }), false, "one roll at a time");
  run(e, 0.4);
  assert.equal(Math.round(x0 - p.x), ROLL.dist);
  assert.equal(e.dodging(), null);
  assert.equal(e.dodge({ x: 1, y: 0 }), false, "0.8 s between rolls");
  run(e, 0.45);
  assert.equal(e.dodge({ x: 1, y: 0 }), true);
  assert.equal(e.feel.stats.rolls, 2);
  assert.ok(e.events.some((v) => v.type === "roll" && Number.isFinite(v.x)), "a roll makes a sound where you are");
});

test("dodge roll: heavier gear rolls shorter and costs more; no roll when grabbed, knocked down or out of stamina", () => {
  const e = make(),
    p = e.s.player;
  e.add({ riotSuit: 1, riotHelmet: 1, steelBracers: 1, motoGreaves: 1, workBoots: 1 });
  for (const id of ["riotSuit", "riotHelmet", "steelBracers", "motoGreaves", "workBoots"]) e.equip(id);
  assert.equal(e.dodgeTier(), "heavy");
  assert.equal(e.dodgeCost(), ROLL.cost + ROLL.tier.heavy.cost);
  open(e, 700, 640);
  const x0 = p.x;
  e.dodge({ x: -1, y: 0 });
  run(e, 0.4);
  assert.equal(Math.round(x0 - p.x), Math.round(ROLL.dist * ROLL.tier.heavy.dist));
  run(e, 1);
  p.stamina = 10;
  assert.equal(e.dodge(), false);
  assert.match(e.toasts.at(-1).t, /体力不够/);
  p.stamina = 100;
  e.gx.down = 0.5;
  assert.equal(e.dodge(), false);
  e.gx.down = 0;
  go(e, "residential");
  const z = e.enemies.find((x) => !x.dead);
  open(e, z.x - 30, z.y);
  e.startGrab(z);
  assert.equal(e.dodge(), false);
  assert.match(e.dodgeReason(), /被抓住/);
});

test("rolling through a runner's leap: the lunge passes, no damage and no knockdown", () => {
  const e = make(),
    p = e.s.player;
  go(e, "residential");
  for (const z of e.enemies) z.dead = true;
  open(e, 700, 640);
  const r = e.enemy("runner", p.x + 130, p.y);
  Object.assign(r, { state: "chase", alert: 8, lunge: { phase: "leap", t: RULES.lunge.time, a: Math.PI } });
  e.enemies.push(r);
  const hp = p.hp;
  e.dodge({ x: 0, y: 1 });
  run(e, 0.25);
  assert.equal(p.hp, hp);
  assert.equal(e.gx.down, 0);
  assert.equal(e.gx.grab, null);
});

test("no attacking, using tools, throwing or shoving in the middle of a roll", () => {
  const e = make();
  e.s.slot = 3;
  e.dodge({ x: 1, y: 0 });
  assert.equal(e.attack({ x: e.s.player.x + 50, y: e.s.player.y }), false);
  assert.equal(e.use({ x: e.s.player.x + 50, y: e.s.player.y }), false);
  assert.equal(e.shove(), false);
  assert.equal(e.throwItem({ x: e.s.player.x + 50, y: e.s.player.y }, "stone"), false);
});

// ================= 打中 =================
test("hitstop by weapon class: blunt 60 ms, +30 on the kill, sledgehammer 90, capped at 120, once every 0.25 s; guns don't stop", () => {
  const e = make(),
    p = e.s.player;
  go(e, "residential");
  const z = e.enemies.find((x) => !x.dead);
  z.hp = 500;
  z.maxHp = 500;
  open(e, z.x - 40, z.y);
  e.s.slot = 3;
  e.cooldown = 0;
  e.attack({ x: z.x, y: z.y - 20 });
  assert.equal(e.fx.hitstop, HITSTOP.blunt);
  // 停顿时世界不动
  const at = { x: z.x, y: z.y, t: e.s.minute };
  e.update(0.016, { x: 1, y: 0 });
  assert.deepEqual({ x: z.x, y: z.y, t: e.s.minute }, at);
  // 0.25 秒内再打一下不再顿
  e.fx.hitstop = 0;
  e.cooldown = 0;
  open(e, z.x - 40, z.y);
  e.attack({ x: z.x, y: z.y - 20 });
  assert.ok(z.hp < 500 - 30, "the second swing landed");
  assert.equal(e.fx.hitstop, 0);
  // 打死的那一下多 30
  e.fx.lastStop = -9;
  e.cooldown = 0;
  z.hp = 1;
  open(e, z.x - 40, z.y);
  e.attack({ x: z.x, y: z.y - 20 });
  assert.equal(z.dead, true);
  assert.ok(Math.abs(e.fx.hitstop - (HITSTOP.blunt + HITSTOP.kill)) < 1e-9);
  // 大锤：90，打死 +30 = 120（上限）
  assert.equal(e.hitstopFor({ kind: "blunt", id: "sledge" }, false), HITSTOP.heavy);
  assert.equal(e.hitstopFor({ kind: "blunt", id: "sledge" }, true), HITSTOP.max);
  assert.equal(e.hitstopFor({ kind: "blade", id: "knife" }, false), HITSTOP.blade);
  assert.equal(e.hitstopFor({ kind: "pole", id: "spear" }, false), HITSTOP.pole);
  for (const kind of ["ranged", "throw", "trap", "dot"]) assert.equal(e.hitstopFor({ kind }, true), 0, kind);
  // 减少闪烁与震屏：减半
  e.s.settings.access = { calm: true };
  assert.equal(e.hitstopFor({ kind: "blunt", id: "club" }, false), HITSTOP.blunt / 2);
});

test("hit reactions lean back (heavy hits stagger longer); kills leave a falling body and a pool of blood; armor sheds metal", () => {
  const e = make(),
    p = e.s.player;
  go(e, "residential");
  const z = e.enemies.find((x) => !x.dead && x.type === "slow");
  z.hp = z.maxHp = 400;
  open(e, z.x - 40, z.y);
  e.s.slot = 3;
  e.cooldown = 0;
  e.attack({ x: z.x, y: z.y - 20 });
  const r = e.reactOf(z);
  assert.ok(r && !r.heavy && Math.abs(r.max - 0.2) < 1e-9);
  e.fx.hitstop = 0;
  run(e, 0.3);
  assert.equal(e.reactOf(z), null, "the lean is over");
  // 重击：矛（击退 34）
  e._hit = { id: "spear", kind: "pole", knock: 34, pierce: 1 };
  e.hurtEnemy(z, 5, 0);
  e._hit = null;
  assert.equal(e.reactOf(z).heavy, true);
  assert.ok(Math.abs(e.reactOf(z).max - 0.4) < 1e-9);
  const blood = e.fx.blood.length;
  e._hit = { id: "club", kind: "blunt", knock: 20, pierce: 1 };
  z.hp = 1;
  e.hurtEnemy(z, 5, 0);
  e._hit = null;
  assert.equal(z.dead, true);
  assert.equal(e.fx.corpses.length, 1);
  assert.equal(e.fx.corpses[0].type, "slow");
  assert.equal(e.fx.blood.length, blood + 1);
  assert.equal(e.fx.blood.at(-1).big, true);
  // 重甲：铁片，不是血
  const a = e.enemy("armor", p.x + 40, p.y);
  e.enemies.push(a);
  e._hit = { id: "club", kind: "blunt", knock: 20, pierce: 1 };
  e.hurtEnemy(a, 5, 0);
  e._hit = null;
  assert.equal(e.fx.blood.at(-1).spark, true);
  assert.ok(e.events.some((v) => v.type === "hitMetal" && Number.isFinite(v.x)));
});

test("bodies stay 60 s and fade over 3 s, at most 40; blood lasts 2 minutes, at most 80; a new map clears both", () => {
  const e = make();
  go(e, "residential");
  for (let i = 0; i < 50; i++) e.addCorpse({ type: "slow", x: 500 + i, y: 500, facing: 0, id: 9000 + i });
  for (let i = 0; i < 100; i++) e.addBlood({ type: "slow", x: 500, y: 500 }, "drop");
  assert.equal(e.fx.corpses.length, REMAINS.corpseMax);
  assert.equal(e.fx.blood.length, REMAINS.bloodMax);
  for (const z of e.enemies) z.dead = true;
  run(e, REMAINS.corpseLife + 1);
  assert.equal(e.fx.corpses.length, REMAINS.corpseMax, "still there during the fade");
  run(e, REMAINS.corpseFade + 0.2);
  assert.equal(e.fx.corpses.length, 0);
  assert.ok(e.fx.blood.length > 0);
  run(e, REMAINS.bloodLife - REMAINS.corpseLife);
  assert.equal(e.fx.blood.length, 0);
  e.addCorpse({ type: "runner", x: 1, y: 1, id: 1 });
  go(e, "farm");
  assert.equal(e.fx.corpses.length, 0);
  // 尸体不进存档
  assert.ok(!e.serialize().includes('"corpses"'));
});

test("engine events carry where the sound came from; new events for being spotted, wind-ups, the screamer's breath and grabs", () => {
  const e = make(),
    p = e.s.player;
  go(e, "residential");
  for (const z of e.enemies) z.dead = true;
  open(e, 700, 640);
  e.events.length = 0;
  const z = e.enemy("slow", p.x + 150, p.y);
  // 在废墟里要面朝你、看清一会儿才发现（潜行规则）：这里让它已经快看清了
  Object.assign(z, { facing: Math.PI, awareness: 0.95 });
  e.enemies.push(z);
  run(e, 0.3);
  const spot = e.events.find((v) => v.type === "spot");
  assert.ok(spot, "it spotted you");
  assert.equal(spot.z, "slow");
  assert.equal(spot.id, z.id);
  assert.ok(Math.abs(spot.x - z.x) < 30);
  // 尖叫者吸气
  const s = e.enemy("screamer", p.x + 120, p.y);
  Object.assign(s, { state: "chase", alert: 8, facing: Math.PI, awareness: 1 });
  e.enemies.push(s);
  e.events.length = 0;
  run(e, 0.2);
  assert.ok(e.events.some((v) => v.type === "inhale" && v.z === "screamer"));
  // 被围住时要抓人：闷吼
  for (const k of [0, 1]) {
    const g = e.enemy("slow", p.x + 30 + k * 6, p.y + 8);
    Object.assign(g, { state: "chase", alert: 8, cooldown: 0, facing: Math.PI, awareness: 1 });
    e.enemies.push(g);
  }
  e.events.length = 0;
  run(e, 0.3);
  assert.ok(e.events.some((v) => v.type === "grabCue" || v.type === "windup"));
  // 所有带位置的事件位置都是数
  for (const v of e.events) if (!["menu", "closeMenu", "quest", "level", "victory", "alarm", "travel", "sleep", "trade"].includes(v.type)) assert.ok(Number.isFinite(v.x) && Number.isFinite(v.y), v.type);
  // 挥动带上武器类
  e.events.length = 0;
  e.s.slot = 3;
  e.cooldown = 0;
  e.fx.roll = null;
  e.attack({ x: p.x + 40, y: p.y });
  assert.equal(e.events.find((v) => v.type === "swing")?.kind, "blunt");
});

// ================= 新档开局那一拨 =================
test("new games only: around 13:00 three wanderers and a runner come up the east road; old saves never see it", () => {
  const old = make(freshState());
  old.s.minute = OPENING.at + 5;
  run(old, 1);
  assert.equal(old.feel.open.phase, "done");
  assert.ok(!old.enemies.some((z) => z.tut));
  const e = make(newGameState());
  assert.equal(e.feel.open.phase, "wait");
  e.s.minute = OPENING.at - 1;
  run(e, 0.2);
  assert.equal(e.feel.open.phase, "wait");
  run(e, 1);
  assert.equal(e.feel.open.phase, "fight");
  const tut = e.enemies.filter((z) => z.tut && !z.dead);
  assert.deepEqual(tut.map((z) => z.type).sort(), ["runner", "slow", "slow", "slow"]);
  assert.ok(tut.every((z) => z.x > 1200), "they come from the east road");
  assert.ok(e.events.some((v) => v.type === "wave"));
  // 一步一步教：先拿木棍，再打
  e.s.slot = 0;
  assert.equal(e.coach().id, "arm");
  e.s.slot = 3;
  run(e, 0.1);
  assert.equal(e.coach()?.id, "hit");
  assert.match(coachHtml(e), /左键/);
});

test("the opening wave can't kill: health stops at 25, below 30 the rest walk away; bites there don't infect", () => {
  const e = make(newGameState());
  e.s.minute = OPENING.at;
  run(e, 0.2);
  const p = e.s.player,
    tut = e.enemies.filter((z) => z.tut);
  p.hp = 32;
  e.invulnerable = 0;
  e.damagePlayer(0, { eff: 40, from: tut[0] });
  assert.ok(p.hp >= OPENING.floor);
  assert.equal(e.feel.open.fled, true);
  assert.ok(tut.every((z) => z.flee));
  const inf = e.gr.inf;
  e.invulnerable = 0;
  e.biteFrom(tut[0], ["legs"]);
  assert.equal(e.gr.inf, inf, "no infection from the teaching wave");
  run(e, 14);
  assert.ok(tut.every((z) => z.dead), "they left");
  assert.equal(e.feel.open.phase, "fence");
  assert.match(e.toasts.map((x) => x.t).join("|"), /围栏/);
});

test("after the wave: build a fence to finish, get a rag hood once; a crawler is forced so the stomp can be taught", () => {
  const e = make(newGameState());
  e.s.minute = OPENING.at;
  run(e, 0.2);
  const w = e.enemies.find((z) => z.tut && z.type === "slow");
  e._hit = { id: "club", kind: "blunt", knock: 20, pierce: 1 };
  w.hp = w.maxHp * 0.35;
  e.hurtEnemy(w, w.maxHp * 0.1, 0);
  e._hit = null;
  assert.equal(w.crawl, true, "the first badly hurt wanderer falls into a crawler");
  assert.equal(e.coach().id, "stomp");
  for (const z of e.enemies) if (z.tut) z.dead = true;
  run(e, 0.3);
  assert.equal(e.feel.open.phase, "fence");
  assert.equal(e.coach().id, "fence");
  assert.match(e.coach().text, /B/);
  const head = e.qty("ragHood");
  // 别处建的、或者早就塌了的不算；要在东边路口附近新建一段
  e.s.buildings.push({ id: "b" + e.s.idCounter++, type: "fence", x: 400, y: 900, rotation: 0, hp: 150 });
  run(e, 0.1);
  assert.equal(e.feel.open.phase, "fence", "a fence somewhere else doesn't block the road");
  e.s.buildings.push({ id: "b" + e.s.idCounter++, type: "fence", x: 1330, y: 400, rotation: 0, hp: 150 });
  run(e, 0.1);
  assert.equal(e.feel.open.phase, "done");
  assert.equal(e.qty("ragHood") + (e.s.storage.ragHood || 0), head + 1);
  e.s.buildings.push({ id: "b" + e.s.idCounter++, type: "fence", x: 1330, y: 460, rotation: 0, hp: 150 });
  run(e, 0.1);
  assert.equal(e.qty("ragHood") + (e.s.storage.ragHood || 0), head + 1, "the reward comes once");
  assert.equal(e.coach(), null);
});

test("the road is already fenced when the wave is beaten: the opening finishes at once, the reward still comes once", () => {
  const e = make(newGameState());
  e.s.buildings.push({ id: "b" + e.s.idCounter++, type: "fence", x: 1340, y: 410, rotation: 0, hp: 150 });
  e.s.minute = OPENING.at;
  run(e, 0.2);
  assert.equal(e.feel.open.phase, "fight");
  for (const z of e.enemies) if (z.tut) z.dead = true;
  const head = e.qty("ragHood") + (e.s.storage.ragHood || 0);
  run(e, 0.3);
  assert.equal(e.feel.open.phase, "done");
  assert.equal(e.qty("ragHood") + (e.s.storage.ragHood || 0), head + 1);
  assert.equal(e.coach(), null);
});

// ================= 生涯记录 =================
test("career record: every trip out is one line — where, phase, gear, result, time, damage, grabs, bites, rolls, kills, fights", () => {
  const e = make(),
    p = e.s.player;
  go(e, "residential");
  const cur = e.feel.career.cur;
  assert.equal(cur.r, "residential");
  assert.equal(cur.ph, 0);
  assert.equal(cur.g[5], "club");
  // 一场仗
  const z = e.enemies.find((x) => !x.dead);
  Object.assign(z, { state: "chase", alert: 8 });
  open(e, z.x - 100, z.y);
  run(e, 1);
  e.invulnerable = 0;
  e.damagePlayer(0, { eff: 10, from: z });
  e.fx.roll = null;
  e.fx.rollCd = 0;
  // 这一下要滚得出去：刚才那一秒里被扑倒、被抓住（随机的）就先放开（v0.40：约 1/40 的时候会这样，测试时好时坏）
  e.gx.grab = null;
  e.gx.down = 0;
  if (e.tx) e.tx.hold = null;
  p.stamina = Math.max(p.stamina, 60);
  e.dodge({ x: -1, y: 0 });
  for (const x of e.enemies) x.dead = true;
  e.s.stats.kills += 2;
  run(e, CAREER.fightGap + 1);
  go(e, "farm");
  const t = e.feel.career.trips.at(-1);
  assert.equal(t.r, "residential");
  assert.equal(t.res, "done");
  assert.ok(t.hp >= 9);
  assert.equal(t.ro, 1);
  assert.equal(t.k, 2);
  assert.equal(t.f.length, 1);
  assert.ok(t.f[0] >= 1);
  assert.equal(e.feel.career.cur, null);
});

test("career record: leaving while chased counts as fled, dying out there as downed with who did it; only 200 kept", () => {
  const e = make();
  go(e, "hospital");
  const z = e.enemies.find((x) => !x.dead);
  Object.assign(z, { state: "chase", alert: 8, x: e.s.player.x + 80, y: e.s.player.y });
  run(e, 0.2);
  go(e, "farm");
  assert.equal(e.feel.career.trips.at(-1).res, "fled");
  go(e, "warehouse");
  const k = e.enemies.find((x) => !x.dead && x.type === "slow") || e.enemies.find((x) => !x.dead);
  e.s.player.hp = 1;
  e.invulnerable = 0;
  e.damagePlayer(0, { eff: 50, from: k });
  const t = e.feel.career.trips.at(-1);
  assert.equal(t.res, "down");
  assert.equal(t.by, k.type);
  assert.equal(e.s.region, "farm");
  for (let i = 0; i < CAREER.max + 20; i++) e.feel.career.trips.push({ ...t, d: 1 + i });
  e.feel.career.cur = null;
  go(e, "residential");
  go(e, "farm");
  assert.equal(e.feel.career.trips.length, CAREER.max);
  const table = e.careerTable();
  assert.ok(table.some((r) => r.r === "warehouse" && r.down > 0 && r.downPct > 0));
});

test("career record and the opening state survive save/parse; broken records are refused, old v0.22 saves load with nothing reset", () => {
  const e = make(newGameState());
  go(e, "residential");
  go(e, "farm");
  const back = Engine.parse(e.serialize());
  assert.equal(back.feel.career.trips.length, 1);
  assert.equal(back.feel.open.phase, "wait");
  const bad = JSON.parse(e.serialize());
  bad.feel.career.trips[0].r = "moon";
  assert.throws(() => Engine.parse(JSON.stringify(bad)), /生涯记录/);
  const extra = JSON.parse(e.serialize());
  extra.feel.secret = 1;
  assert.throws(() => Engine.parse(JSON.stringify(extra)));
  // v0.22 的存档：没有 s.feel
  const g = new GearEngine(gearFresh(), () => {});
  g.s.day = 9;
  g.s.money = 321;
  const old = Engine.parse(g.serialize());
  assert.equal(old.money, 321);
  assert.equal(old.day, 9);
  assert.equal(old.feel.old, true);
  assert.equal(old.feel.open.phase, "done", "no opening wave for an old save");
});

// ================= 每日抉择：稍后再选 =================
const dailyDay = () => {
  const e = make();
  e.s.day = 2;
  e.s.minute = 359;
  e.dailyGenerate?.(2);
  e.s.minute = 361;
  return e;
};
test("daily card 'decide later': it stops popping up, can be closed, sleeping still needs a choice, at noon the free option is taken", () => {
  const e = dailyDay();
  assert.ok(e.dailyCard());
  assert.equal(e.dailyShouldShow(), true);
  assert.equal(menuLock(e, { view: "daily" }), "先选一个，再开始新的一天。");
  assert.equal(e.dailyLater(), true);
  assert.equal(e.dailyDeferred(), true);
  assert.equal(e.dailyShouldShow(), false, "no more popping up");
  assert.equal(menuLock(e, { view: "daily" }), "", "opened from the journal it can be closed");
  // 睡前必须选
  e.events.length = 0;
  assert.equal(e.sleep(), false);
  assert.ok(e.events.some((v) => v.type === "menu" && v.view === "daily"));
  // 中午还没选：按不花钱的那一项算
  const p = e.dailyCard(),
    pick = e.freeDailyOption(p);
  assert.ok(pick >= 0);
  const o = EVENTS[p.id].opts[pick];
  assert.ok(!o.cost && !o.pay, "the free option");
  const money = e.s.money;
  e.s.minute = LATER.deadline - 0.1;
  run(e, 0.2);
  assert.equal(e.dailyCard(), null, "decided at noon");
  assert.equal(e.dy.pending.choice, pick);
  assert.ok(e.s.money >= money - 0, "no money spent");
  assert.match(e.toasts.map((x) => x.t).join("|"), /到中午了，今日抉择按「/);
});

test("'decide later' only before noon and only once; the card markup gets the button and loses the lock", () => {
  const e = dailyDay();
  const card = renderCampaignView(e, { view: "daily" });
  assert.match(card, /data-action="feelLater"/);
  assert.match(card, /daily-card[^"]* locked"/);
  assert.doesNotMatch(card, FORBIDDEN);
  handleCampaignAction("feelLater", { dataset: { action: "feelLater", id: "" } }, { engine: e, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {} });
  assert.equal(e.dailyDeferred(), true);
  const again = renderCampaignView(e, { view: "daily" });
  assert.doesNotMatch(again, /data-action="feelLater"/);
  assert.doesNotMatch(again, /daily-card[^"]* locked"/);
  assert.match(again, /12:00 前选好/);
  assert.match(e.dailyLaterReason(), /放着/);
  const late = dailyDay();
  late.s.minute = LATER.deadline + 1;
  assert.equal(late.dailyLater(), false);
  assert.doesNotMatch(renderCampaignView(late, { view: "daily" }), /data-action="feelLater"/);
});

test("a card with no option that costs nothing comes back at noon to be decided; the note and the toast say which way it will go", () => {
  const e = dailyDay();
  e.dy.pending = { day: 2, id: "D01", rolls: [0.5, 0.5, 0.5], tier: 1, luck: false, choice: null, win: null, lines: [] };
  assert.equal(e.freeDailyOption(), -1, "every option of this card costs or risks something");
  assert.equal(e.dailyLater(), true);
  assert.match(e.toasts.at(-1).t, /没有不吃亏的选项，到了中午会再拿出来/);
  assert.match(renderCampaignView(e, { view: "daily" }), /没有就把卡片拿出来/);
  e.s.minute = LATER.deadline - 0.1;
  run(e, 0.2);
  assert.ok(e.dailyCard(), "nothing was chosen for you");
  assert.equal(e.dailyDeferred(), false);
  assert.equal(e.dailyShouldShow(), true, "the card pops up again");
  assert.match(e.toasts.map((x) => x.t).join("|"), /要你定下来/);
  assert.equal(e.dailyLater(), false, "and it can't be put off again");
  // 有不吃亏的选项时，提示里直接写出会按哪一项算
  const f = dailyDay(),
    i = f.freeDailyOption();
  assert.ok(i >= 0);
  f.dailyLater();
  assert.ok(f.toasts.at(-1).t.includes("「" + EVENTS[f.dailyCard().id].opts[i].label + "」"));
});

test("a put-off card shows one reminder at the top, not two, even in the middle of a fight", () => {
  const e = dailyDay();
  e.dailySafe = () => false;
  assert.ok(alertItems(e).some((a) => a.text === "今日抉择等你决定"), "an open card waits while it isn't safe");
  e.dailyLater();
  const texts = alertItems(e).map((a) => a.text);
  assert.ok(texts.includes("今日抉择 · 12:00 前要选"));
  assert.ok(!texts.includes("今日抉择等你决定"));
});

// ================= 平安的早上不弹日终总结 =================
test("a quiet night gives a one-line note and a log entry instead of the summary page; a hungry night still shows the page", () => {
  // 固定种子：平安的晚上约 4% 会出一件夜里的好事（候鸟、残骸……），那天的账本写的是那件事
  const st = freshState();
  st.undertow.seed = 39017;
  const e = make(st);
  e.s.storage.bread = 40;
  e.s.minute = 1200;
  e.events.length = 0;
  assert.equal(e.sleep(), true);
  assert.ok(!e.events.some((v) => v.type === "menu" && v.view === "summary"), "no summary page");
  assert.ok(e.o.log.some((l) => /平安过去/.test(l.text)));
  // v0.29：那一行改成睡醒的账本（在场景上方停一会儿，全文进消息记录）
  const led = e.events.find((v) => v.type === "ledger");
  assert.ok(led, "the ledger shows instead of the one-line note");
  assert.match(led.lines.join(" "), /夜里：平安/);
  assert.ok(e.o.log.some((l) => /的账：/.test(l.text)));
  const h = make();
  for (const id of Object.keys(h.s.storage)) if (ITEMS[id]?.food) delete h.s.storage[id];
  for (const id of Object.keys(h.s.inventory)) if (ITEMS[id]?.food) delete h.s.inventory[id];
  h.s.minute = 1200;
  h.events.length = 0;
  assert.ok(h.foodDays() < 2);
  h.sleep();
  assert.ok(h.events.some((v) => v.type === "menu" && v.view === "summary"), "short on food: the page shows");
});

// ================= 手记的“今天” =================
test("the journal starts with 'today': up to three things — the daily card, the road fence, a coming raid, broken gear", () => {
  const e = dailyDay();
  e.dailyLater();
  let items = e.todayItems();
  assert.equal(items[0].action, "dView");
  assert.match(items[0].text, /12:00/);
  e.add({ riotHelmet: 1 });
  e.equip("riotHelmet");
  e.cond("riotHelmet").d = 0;
  items = e.todayItems();
  assert.ok(items.some((x) => /坏了/.test(x.text) && x.action === "rOpen"));
  assert.ok(items.length <= 3);
  const html = renderCampaignJournal(e, {});
  assert.match(html, /class="journal-today"/);
  assert.ok(html.indexOf("journal-today") < html.indexOf("journal-options") || !html.includes("journal-options"));
  assert.doesNotMatch(html, FORBIDDEN);
  assert.doesNotMatch(renderCampaignJournal(e, { catalog: true }), /journal-today/);
  const quiet = make();
  quiet.s.storage.bread = 40;
  assert.equal(todayHtml(quiet), "", "nothing pressing, no 'today' box");
  const hungry = make();
  assert.match(todayHtml(hungry), /口粮只够/, "a fresh farm is short on food");
});

// ================= 老存档：空格 =================
test("an old save hears once that Space now rolls; a new game doesn't", () => {
  const g = new GearEngine(gearFresh(), () => {});
  const old = make(Engine.parse(g.serialize()));
  assert.equal(old.feel.old, true);
  assert.equal(old.spaceTip(), true);
  assert.match(old.toasts.at(-1).t, /空格现在是翻滚/);
  assert.equal(old.spaceTip(), false, "only once");
  const back = Engine.parse(old.serialize());
  assert.equal(back.feel.spaceTip, true, "remembered in the save");
  const fresh = make(newGameState());
  assert.equal(fresh.spaceTip(), false);
});

// ================= 界面 =================
test("settings: four volumes and the sound-cue switch; help lists the eleven common keys first, the rest under 更多按键; pad B rolls", () => {
  const html = soundRows({ sound: 0.35 }, { music: 0.6, ambience: 0.7, sfx: 0.9, cues: false });
  for (const id of ["volume", "vol-music", "vol-ambience", "vol-sfx"]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(html, /data-action="feelCues"/);
  assert.match(html, /已关闭/);
  const help = helpHtml({});
  const [main, more] = help.split("更多按键");
  assert.equal((main.match(/<kbd>/g) || []).length, 11);
  assert.match(main, /空格<\/kbd>翻滚/);
  assert.match(more, /K<\/kbd>技能/);
  assert.doesNotMatch(main, /左键 \/ 空格/);
  assert.match(patchPadHelp("<div><kbd>B</kbd>返回 / 取消建造</div>"), /翻滚/);
  for (const s of [html, help]) assert.doesNotMatch(s, FORBIDDEN);
});

test("radial menu: eight entries (plus 精英部位 with a gun, 远征路线 on an expedition), picked by direction or number", () => {
  const e = make();
  const items = radialItems(e);
  assert.deepEqual(
    items.map((x) => x.id),
    ["craft", "build", "map", "journal", "skills", "log", "defense", "photo"],
  );
  e.add({ pistol: 1 });
  e.equip("pistol");
  e.s.slot = 4;
  assert.ok(radialItems(e).some((x) => x.id === "aim"));
  const html = radialHtml(items, 2);
  assert.equal((html.match(/data-radial=/g) || []).length, 8);
  assert.match(html, /radial-item selected/);
  assert.doesNotMatch(html, FORBIDDEN);
  assert.equal(radialPick(8, 0, -100), 0, "up is the first");
  assert.equal(radialPick(8, 100, 0), 2, "right is the third");
  assert.equal(radialPick(8, 0, 100), 4);
  assert.equal(radialPick(8, -100, 0), 6);
  assert.equal(radialPick(8, 5, 5), -1, "too close to the centre picks nothing");
  // 打开时鼠标在哪，轮盘就在哪
  assert.match(radialHtml(items, -1, { x: 300, y: 220 }), /class="radial-ring" style="left:300px;top:220px"/);
  assert.match(radialHtml(items, -1), /class="radial-ring">/);
  // 第十格没有数字键
  const ten = [...items, { id: "aim", label: "精英部位", glyph: "⌖", key: "T" }, { id: "route", label: "远征路线", glyph: "➤", key: "F" }];
  const tenHtml = radialHtml(ten, -1);
  assert.equal((tenHtml.match(/<kbd>/g) || []).length, 9);
  assert.doesNotMatch(tenHtml, /<kbd>10<\/kbd>/);
});

test("sound cues: one line with a direction for warnings, only the warning kinds, kept briefly", () => {
  const e = make(),
    p = e.s.player,
    q = new CueQueue();
  assert.equal(q.push({ type: "hiss", x: p.x - 200, y: p.y }, e, 0), true);
  assert.equal(q.push({ type: "swing", x: p.x, y: p.y }, e, 0), false);
  assert.equal(q.push({ type: "stomp", x: p.x + 200, y: p.y - 10 }, e, 0), true);
  const html = q.html(0.5);
  assert.match(html, /← 奔跑者在嘶叫/);
  assert.match(html, /→ 重甲在跺脚/);
  assert.equal(q.html(5), "");
  assert.equal(q.push({ type: "hiss", x: p.x + 2000, y: p.y }, e, 0), false, "too far to matter");
  // 枪声：只有灰隼团的；自己的枪不出字
  assert.equal(q.push({ type: "shot", weapon: "pistol", x: p.x, y: p.y }, e, 0), false);
  assert.equal(q.push({ type: "shot", weapon: "raider", x: p.x + 300, y: p.y }, e, 0), true);
  assert.match(q.html(0.1), /→ 灰隼团在开枪/);
  // 警报：尸潮、灰隼团、别的事各说各的
  const w = new CueQueue();
  w.push({ type: "alarm" }, e, 0);
  assert.match(w.html(0.1), /警报声/);
  e.s.horde.phase = "active";
  w.push({ type: "alarm" }, e, 1);
  assert.match(w.html(1.1), /尸潮来了/);
  e.s.horde.phase = "won";
  e.raidState().phase = "warning";
  w.push({ type: "alarm" }, e, 2);
  assert.match(w.html(2.1), /灰隼团来了/);
});

test("the achievements book gets the career table and recent trips; the quick menu gets 拍照", () => {
  const e = make();
  go(e, "residential");
  go(e, "farm");
  const html = renderCampaignView(e, { view: "collection", id: "" });
  assert.match(html, /生涯记录/);
  assert.match(html, /class="career-table"/);
  assert.match(html, /废弃居民区/);
  assert.match(html, /第 1–3 天/);
  assert.doesNotMatch(html, FORBIDDEN);
  assert.match(careerHtml(make()), /还没有出过门/);
  // 饿晕的单说，不写成“被……打倒”
  const t = e.feel.career.trips.at(-1);
  e.feel.career.trips.push({ ...t, res: "down", by: "hunger" });
  const starved = careerHtml(e);
  assert.match(starved, /饿晕了/);
  assert.doesNotMatch(starved, /被饥饿打倒|被饿晕了打倒/);
  const phone = patchPhone('<div class="phone-grid"><button class="phone-tile" data-menu="map">地图</button><button class="phone-tile" data-menu="pause">设置</button></div>');
  assert.match(phone, /data-action="fPhoto"[^]*data-menu="pause"/);
});

test("audio preferences live in the existing preferences key and never in the save", () => {
  const store = new Map(),
    S = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  Session.writePreferences(S, { sound: 0.4, zoom: 1, uiScale: 1, miniMap: true }, { music: 0.2, ambience: 0.3, sfx: 0.5, cues: true });
  assert.deepEqual([...store.keys()], [Session.PREFERENCES]);
  assert.deepEqual(Session.readAudioPreferences(S), { music: 0.2, ambience: 0.3, sfx: 0.5, cues: true });
  Session.writePreferences(S, { sound: 0.6, zoom: 1, uiScale: 1, miniMap: true });
  assert.deepEqual(Session.readAudioPreferences(S), { music: 0.2, ambience: 0.3, sfx: 0.5, cues: true }, "kept when other settings change");
  const e = make();
  assert.ok(!e.serialize().includes('"music"') && !e.serialize().includes('"cues"'));
});
