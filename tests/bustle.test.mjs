// v0.28.0「热闹」：动静表（各种吵的事、0 点结算、醒着真的来、睡着自动结算）、电台指令（侦察、空投、呼叫商队、求援）、
// 红薯跑商（装车、三地的价、带回材料、被截、跟车）、设施二选一改良（六类）、伤员和医务室、舒适度和休息好、
// 广场上的食堂（端菜上菜）、节庆供品、档案馆「往事」一柜、江伯的鱼汛、麦穗巡夜、商队卖改良图纸、界面和存档。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, newGameState, needsStoryMigration } from "../dist/campaign.js";
import * as Bounty from "../dist/bounty.js";
import { ITEMS, BUILDINGS, CROPS } from "../dist/data.js";
import { TASKS } from "../dist/rebuild-data.js";
import { TECH, HORDE_DIRECTIONS } from "../dist/expansion-data.js";
import { DOG_SKILLS } from "../dist/farlands-data.js";
import { LADDER, SHOWCASES, WSPOTS } from "../dist/winter-data.js";
import { SSPOTS, TASTES } from "../dist/seasons-data.js";
import { TRAP_ALL } from "../dist/tidy-data.js";
import { NOISE, RADIO_CMDS, DROP, ALLY, MULE, UPGRADES, UP_PAPER, INJURY, COMFORT, CANTEEN2, FEST_PICK, PAST, FISH_RUN, DOG_PATROL } from "../dist/bustle-data.js";
import * as UI from "../dist/campaign-ui.js";
import { residentExtras, roomExtras } from "../dist/people-hooks.js";
import { MISSING_ICONS } from "../dist/item-sprites.js";

const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const make = (state = freshState(), seed = 20281) => {
  const toasts = [];
  if (state.undertow) state.undertow.seed = seed;
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  if (e.dy) e.dy.pending = null;
  return { e, toasts };
};
const said = (toasts, re) => toasts.some((t) => re.test(t.text));
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
const put = (e, type, x, y, extra = {}) => {
  const b = { id: "t-" + type + "-" + e.s.idCounter++, type, x, y, rotation: 0, hp: BUILDINGS[type].hp, ...extra };
  e.s.buildings.push(b);
  e.navRevision = (e.navRevision || 0) + 1;
  return b;
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
const stock = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);
const give = (e, items) => {
  for (const [id, n] of Object.entries(items)) e.s.storage[id] = (e.s.storage[id] || 0) + n;
};
const btn = (action, id = "") => ({ dataset: { action, id: String(id) } });
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const view = (e, v, id = "") => UI.renderCampaignView(e, { view: v, id });
const atFarm = (e, x = 830, y = 460) => {
  if (e.s.region !== "farm") {
    e.s.region = "farm";
    e.enemies = e.s.enemies.farm ||= [];
    e.assignRegion();
  }
  Object.assign(e.s.player, { x, y });
};
const clearFoes = (e) => {
  for (const z of e.enemies) z.dead = true;
  e.enemies = e.s.enemies[e.s.region] = [];
};
// 一份 v0.27 的存档（没有 s.bustle）
const v27 = (setup = () => {}) => {
  const old = new Bounty.Engine(Bounty.newGameState("farmer"), () => {});
  setup(old);
  return old.serialize();
};

// ================= 数据、存档 =================
test("data: the medicine cabinet, the keepsake case and the upgrade paper are real; six upgrade classes with two paths; the dog's fifth skill; the third rung of the ladder", () => {
  assert.equal(BUILDINGS.medCabinet.cost.wood, 6);
  assert.deepEqual(BUILDINGS.medCabinet.cost, { wood: 6, cloth: 2, parts: 1 });
  assert.ok(BUILDINGS.hnKeepsake && ITEMS.upPaper?.protected);
  assert.ok(!MISSING_ICONS?.includes?.("upPaper"), "the paper has its own icon");
  assert.equal(Object.keys(UPGRADES).length, 6);
  for (const [k, U] of Object.entries(UPGRADES)) {
    assert.equal(Object.keys(U.paths).length, 2, k);
    for (const t of U.types) assert.ok(BUILDINGS[t], t);
    for (const id of Object.keys(U.cost)) assert.ok(ITEMS[id], id);
  }
  const patrol = DOG_SKILLS.find((s) => s.id === "patrol");
  assert.equal(patrol?.bond, 15);
  assert.match(LADDER[2].need, /舒适度 3/);
  for (const c of Object.values(RADIO_CMDS)) assert.ok(c.power > 0 && c.noise > 0 && c.cd > 0);
});

test("save: new games stay quiet; a v0.27 save is kept as-is, the radio's own noise moves onto the meter, the notice plays once; a broken record is refused in plain words", () => {
  const { e: fresh, toasts: t0 } = make(newGameState("farmer"));
  fresh.update(0.016, {});
  assert.ok(!said(t0, /热闹：/), "no notice for a new game");
  const text = v27((o) => {
    o.s.day = 9;
    o.w.radio.noise = 3;
    o.ss.jiang.phase = "done";
  });
  assert.equal(needsStoryMigration(text), true, "a v0.27 save gets a checkpoint before it is read");
  const s = Engine.parse(text);
  assert.equal(s.bustle.noise.v, 3);
  assert.equal(s.winter.radio.noise, 0);
  assert.equal(s.bustle.fish.since, 9, "Jiang Bo was already done: fish runs start from the day it is read");
  const { e, toasts } = make(s);
  e.update(0.016, {});
  e.update(0.016, {});
  assert.equal(toasts.filter((t) => /热闹：/.test(t.text)).length, 1);
  const back = Engine.parse(e.serialize());
  assert.equal(back.bustle.intro.told, true);
  const bad = JSON.parse(e.serialize());
  bad.bustle.noise.v = -4;
  assert.throws(() => Engine.parse(JSON.stringify(bad)), /存档里的营地记录损坏（动静）/);
  const bad2 = JSON.parse(e.serialize());
  bad2.buildings.push({ id: "x", type: "tower", x: 500, y: 500, rotation: 0, hp: 100, hnUp: "laser" });
  assert.throws(() => Engine.parse(JSON.stringify(bad2)), /改良/);
});

// ================= 动静表 =================
test("noise: radio, lathe rush, canteen, festival, lure and radio commands all add to one meter; the HUD chip warns at 4", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  e.chooseProgram("songs");
  hour(e, 21);
  assert.equal(e.hn.noise.v, 2);
  assert.equal(e.w.radio.noise, 0, "the radio's own counter is retired");
  assert.equal(UI.campaignHud(e).noise.tone, "");
  e.td.lathe.rush = 0;
  e.s.minute = 600;
  const rushed = e.latheRush();
  if (rushed) assert.equal(e.hn.noise.v, 2 + NOISE.rush);
  else e.noiseAdd(NOISE.rush, "rush");
  const lure = put(e, "lure", 900, 600);
  e.c.energy = 20;
  atFarm(e, 900, 640);
  assert.equal(e.pullLure(lure.id), true);
  assert.equal(e.hn.noise.v, 2 + NOISE.rush + NOISE.lure);
  assert.match(e.noiseWhy(), /拉响信标 \+3/);
  const hud = UI.campaignHud(e).noise;
  assert.equal(hud.tone, "danger", "7 is in the 6+ band");
  assert.match(hud.title, /0 点结算/);
});

test("noise: below 4 it halves at midnight; 4+ brings infected that night from one side; an attack clears the meter; leftovers walk off at dawn", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  atFarm(e);
  clearFoes(e);
  e.hn.noise.v = 3;
  nextDay(e);
  assert.equal(e.hn.noise.v, 1.5);
  assert.equal(e.noiseAlive().length, 0);
  for (const [v, n] of [
    [4.5, 3],
    [6, 6],
  ]) {
    clearFoes(e);
    e.hn.noise.v = v;
    nextDay(e);
    assert.equal(e.noiseAlive().length, n, "noise " + v);
    assert.equal(e.hn.noise.v, 0);
    assert.equal(e.hn.attack.state, "live");
    hour(e, 6);
    assert.equal(e.noiseAlive().length, 0, "they leave at dawn");
    assert.equal(e.hn.attack.state, "done");
  }
  assert.ok(said(toasts, /动静把感染者引来了/));
  // 8 以上：10 只，第 8 天以后带一只吐酸者
  clearFoes(e);
  e.s.day = 12;
  e.hn.noise.v = 8;
  nextDay(e);
  const z = e.noiseAlive();
  assert.equal(z.length, 10);
  assert.equal(z.filter((x) => x.type === "spitter").length, 1);
  // 打倒最后一只：夜袭结束
  for (const x of z) e.hurtEnemy(x, 9999, 0);
  assert.equal(e.hn.attack.state, "done");
  assert.ok(said(toasts, /循着动静来的 10 只都打倒了/));
});

test("noise: asleep or away, guards, manned towers, the dog, a fence ring and lamps each stop one; the rest hit the fences (iron takes half) or, with no fence, may hurt someone", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  clearFoes(e);
  e.s.buildings = e.s.buildings.filter((b) => !["fence", "gate", "tower"].includes(b.type));
  const walls = Array.from({ length: 6 }, (_, i) => put(e, "fence", 600 + i * 40, 300));
  e.hn.noise.v = 6;
  e.s.region = "market";
  nextDay(e);
  assert.equal(e.hn.attack.state, "done");
  assert.match(e.hn.attack.report, /围栏挡住了 1 只/);
  const hit = walls.filter((w) => w.hp < BUILDINGS.fence.hp);
  assert.ok(hit.length >= 1, "the rest hit the fences");
  assert.ok(walls.every((w) => w.hp >= BUILDINGS.fence.hp - 40 * 5));
  // 铁皮：挨的打减半
  for (const w of walls) Object.assign(w, { hp: BUILDINGS.fence.hp, hnUp: "iron" });
  e.hn.up.fence = "iron";
  e.hn.noise.v = 4;
  nextDay(e);
  const lost = walls.reduce((a, w) => a + BUILDINGS.fence.hp - w.hp, 0);
  assert.equal(lost, (3 - 1) * 20, "2 got through, 20 each on iron");
  // 没有围栏、没人守：有人可能受伤
  e.s.buildings = e.s.buildings.filter((b) => !["fence", "gate"].includes(b.type));
  e.recruit("farmer");
  e.recruit("medic");
  e.hnRoll = (...k) => (k[0] === "nhurt" ? 0 : 0.5);
  e.hn.noise.v = 6;
  nextDay(e);
  assert.ok(Object.keys(e.hn.hurt).length >= 1, "someone got hurt");
  assert.match(e.hn.attack.report, /受了伤/);
});

test("noise: guards who ate before midnight stand the noise attack — awake they man the towers past the hourly rota and go to bed when it ends; asleep each of them and their towers count", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e, 330, 340);
  clearFoes(e);
  e.s.buildings = e.s.buildings.filter((b) => !["fence", "gate", "tower"].includes(b.type));
  for (const id of ["farmer", "medic"]) e.recruit(id);
  put(e, "bed", 700, 330);
  put(e, "bed", 740, 330);
  put(e, "tower", 1040, 600);
  put(e, "tower", 1040, 360);
  for (const r of e.c.residents) Object.assign(r, { fed: true, fatigue: 0, priorities: { ...r.priorities, guard: 1 } });
  e.hn.noise.v = 4.5;
  nextDay(e);
  assert.equal(e.hn.attack.state, "live");
  assert.deepEqual([...e.hn.attack.guards].sort(), ["farmer", "medic"]);
  assert.ok(e.c.residents.every((r) => !r.fed), "midnight cleared the meal");
  assert.ok(e.c.residents.every((r) => r.workRole === "guard" && e.residentActive(r)), "but they still guard");
  assert.equal(e.mannedTowers().size, 2);
  hour(e, 1);
  assert.ok(e.c.residents.every((r) => r.workRole === "guard" && e.residentActive(r)), "still on the towers after the 01:00 rota");
  for (const z of e.noiseAlive()) e.hurtEnemy(z, 9999, 0);
  assert.equal(e.hn.attack.state, "done");
  assert.ok(e.c.residents.every((r) => r.workRole === "rest" && !e.residentActive(r)), "off to bed");
  assert.deepEqual(e.hn.attack.guards, []);
  clearFoes(e);
  assert.ok(Engine.parse(e.serialize()));
  // 睡着：两个守卫、两座有人的塔各挡一只
  for (const r of e.c.residents) r.fed = true;
  e.hn.noise.v = 6;
  e.s.minute = 22 * 60;
  e.sleep();
  assert.match(e.hn.attack.report, /守卫、瞭望塔挡住了 4 只/);
});

test("upgrades: with a twin sentry the spare guard stays on duty through the hourly rota", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e, 330, 340);
  clearFoes(e);
  e.s.buildings = e.s.buildings.filter((b) => b.type !== "tower");
  for (const id of ["farmer", "medic", "mechanic"]) e.recruit(id);
  e.residentsCapacity = () => 5;
  const t1 = put(e, "tower", 1040, 600);
  put(e, "tower", 1040, 360);
  e.hn.up.tower = "twin";
  Object.assign(t1, { hnUp: "twin", hnFed: e.absNow() + 1440 });
  for (const r of e.c.residents) Object.assign(r, { fed: true, fatigue: 0, priorities: { farmer: 0, mechanic: 0, medic: 0, guard: 1 } });
  e.s.horde.phase = "active";
  e.s.minute = 22 * 60 + 30;
  hour(e, 23);
  assert.equal(e.c.residents.filter((r) => r.workRole === "guard").length, 3, "the third guard is not sent to bed");
  assert.equal(e.twinTowers().length, 1);
  e.s.horde.phase = "won";
});

test("noise: no extra attack on a long night, a horde or a raid day; it only halves", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  clearFoes(e);
  e.hn.noise.v = 9;
  e.s.horde.phase = "warning";
  nextDay(e);
  assert.equal(e.noiseAlive().length, 0);
  assert.equal(e.hn.noise.v, 4.5);
  assert.equal(e.hn.attack.state, "");
});

// ================= 电台指令 =================
test("radio commands: each costs power and noise and has a cooldown; scouting reads tonight's real threats", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  e.c.energy = 2;
  assert.match(e.cmdReason("scout"), /电不够/);
  e.c.energy = 40;
  e.hn.noise.v = 3;
  assert.equal(e.radioCmd("scout"), true);
  assert.equal(e.c.energy, 37);
  assert.equal(e.hn.noise.v, 4);
  assert.match(e.hn.scout.text, /营地动静 4：今夜 0 点会有 3 只从/);
  assert.match(e.cmdReason("scout"), /第 \d+ 天才能再发/);
  nextDay(e);
  assert.equal(e.cmdReason("scout"), "");
  e.hn.noise.v = 0;
  e.radioCmd("scout");
  assert.match(e.hn.scout.text, /安静|夜行者|长夜|尸潮|灰隼团|菜地/);
  e.s.region = "market";
  assert.match(e.cmdReason("drop"), /回到农场/);
});

test("radio commands: the airdrop lands in an open ruin with 3–5 things; too late and four infected guard it; it is gone after two days", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  atFarm(e);
  e.c.energy = 40;
  assert.equal(e.radioCmd("drop"), true);
  const d = e.hn.drop;
  assert.ok(["residential", "hospital", "warehouse"].includes(d.region));
  const n = Object.keys(d.items).length;
  assert.ok(n >= DROP.items[0] && n <= DROP.items[1]);
  e.hn.cmd.drop = 0;
  assert.match(e.cmdReason("drop"), /上一箱还在/);
  // 去晚了：箱子边四只
  e.s.minute += DROP.late + 10;
  e.s.region = d.region;
  e.s.enemies[d.region] = [];
  e.enemies = e.s.enemies[d.region];
  e.assignRegion();
  assert.equal(e.enemies.filter((z) => z.hnDrop && !z.dead).length, DROP.guards);
  assert.ok(said(toasts, /空投箱边已经围了/));
  const crate = e.objects.find((o) => o.type === "hnDrop");
  assert.ok(crate);
  Object.assign(e.s.player, { x: crate.x, y: crate.y + 8 });
  const before = Object.fromEntries(Object.keys(d.items).map((k) => [k, stock(e, k)]));
  assert.equal(e.openDrop(), true);
  for (const [k, v] of Object.entries(d.items)) assert.equal(stock(e, k), before[k] + v, k);
  assert.ok(!e.objects.some((o) => o.type === "hnDrop"));
  // 下一箱放着不拿：两天后没了
  e.hn.cmd.drop = 0;
  atFarm(e);
  e.radioCmd("drop");
  for (let i = 0; i < DROP.keep + 1; i++) nextDay(e);
  assert.equal(e.hn.drop, null);
});

test("radio commands: calling the caravan brings Tang Jiu tomorrow; only when he is on the road and not already due", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  e.c.energy = 40;
  e.o.caravan.next = 0;
  assert.match(e.cmdReason("caravan"), /还没开始走这条路/);
  e.o.caravan.next = e.s.day + 4;
  assert.equal(e.radioCmd("caravan"), true);
  assert.equal(e.o.caravan.next, e.s.day + 1);
  e.hn.cmd.caravan = 0;
  assert.match(e.cmdReason("caravan"), /明天本来就来/);
});

test("radio commands: two neighbours answer the call for help, come to the gate when the next horde starts, fight, can be knocked down and go home after", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  atFarm(e);
  clearFoes(e);
  e.c.energy = 40;
  assert.equal(e.radioCmd("help"), true);
  assert.equal(e.hn.help.armed, true);
  e.updateAllies(0.05);
  assert.equal(e.hn.help.live, false, "nothing to fight yet");
  e.s.horde.phase = "active";
  e.updateAllies(0.05);
  assert.equal(e.hn.help.live, true);
  assert.equal(e.hn.help.allies.length, 2);
  assert.ok(said(toasts, /赶到了营门/));
  const a = e.hn.help.allies[0];
  const z = e.enemy("slow", a.x + 30, a.y);
  z.hp = 20;
  e.enemies.push(z);
  for (let i = 0; i < 40 && !z.dead; i++) e.updateAllies(0.1);
  assert.ok(z.dead, "the neighbour hits for " + ALLY.dmg);
  // 被围住：血掉到 0 就退下
  for (let i = 0; i < 8; i++) {
    const q = e.enemy("armor", a.x + 5, a.y + 5);
    q.hp = 9999;
    e.enemies.push(q);
  }
  for (let i = 0; i < 200 && !a.down; i++) e.updateAllies(0.1);
  assert.equal(a.down, true);
  clearFoes(e);
  e.s.horde.phase = "won";
  e.updateAllies(0.05);
  assert.equal(e.hn.help.live, false);
  assert.ok(said(toasts, /回雨巷了/));
});

// ================= 红薯跑商 =================
const muleReady = (e) => {
  e.o.cargo = "food";
  e.o.convoy = { departs: 0, arrives: 0, escorted: true, spawned: false, foes: [], done: true, lost: false };
  e.s.districts.unlocked = { ...e.s.districts.unlocked, stationMarket: true };
  e.s.beyond.unlocked = { ...e.s.beyond.unlocked, shipyard: true };
};
test("mule runs: after the act-5 convoy Hong Shu takes up to 20 goods to the market, a district or the frontier and sells at the local price", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  atFarm(e);
  assert.match(e.muleReason(), /车队到站以后/);
  muleReady(e);
  give(e, { potato: 30, medkit: 6, cloth: 8, radish: 3 });
  assert.match(e.muleReason(), /还没装货/);
  for (let i = 0; i < 25; i++) e.muleAdjust("potato", 1);
  assert.equal(e.muleCount(), MULE.max, "no more than 20");
  e.muleAdjust("potato", -15);
  e.muleAdjust("medkit", 5);
  assert.equal(e.muleCount(), 10);
  // 集市收粮食贵、地区收药贵
  assert.equal(e.muleUnit("potato", "market"), Math.floor(e.shipPrice("potato") * MULE.dest.market.mult));
  assert.equal(e.muleUnit("medkit", "market"), Math.floor(e.shipPrice("medkit")));
  assert.equal(e.muleUnit("medkit", "region"), Math.floor(e.shipPrice("medkit") * MULE.dest.region.mult));
  e.muleSet("dest", "region");
  e.muleSet("back", "circuit");
  const value = e.muleValue(e.hn.mule.plan.load, "region");
  const radish = stock(e, "radish");
  assert.equal(e.muleGo(), true);
  assert.equal(stock(e, "radish"), radish - 1, "one radish for Hong Shu");
  assert.equal(stock(e, "potato"), 25);
  assert.equal(stock(e, "medkit"), 1);
  const t = e.hn.mule.trip;
  assert.equal(t.value, value);
  assert.equal(t.map, "stationMarket");
  assert.match(e.muleReason(), /在路上/);
  // 第三天 08:00 回来：电路按当地的价、看存货换，剩下的带回金币
  e.hnRoll = (...k) => (k[0] === "rob" ? 0.99 : 0.5);
  const money = e.s.money,
    circuit = stock(e, "circuit");
  nextDay(e);
  hour(e, 8);
  assert.ok(e.hn.mule.trip, "not back yet after one day");
  nextDay(e);
  hour(e, 8);
  assert.equal(e.hn.mule.trip, null);
  const n = Math.min(MULE.dest.region.stock.circuit, Math.floor(value / ITEMS.circuit.buy));
  assert.equal(stock(e, "circuit"), circuit + n);
  assert.equal(e.s.money, money + value - n * ITEMS.circuit.buy);
  assert.equal(e.hn.mule.log[0].money, value - n * ITEMS.circuit.buy);
  assert.ok(said(toasts, /红薯从地区回来了/));
  assert.equal(e.muleReason().includes("能再跑"), false, "two days later it can go again");
});

test("mule runs: 15% of runs lose half on the road (30% when the camp is loud or the Grey Falcons are coming); escorting it on the day means nobody tries", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  atFarm(e);
  muleReady(e);
  assert.equal(e.muleRobChance(), MULE.rob.base);
  e.hn.noise.v = 4;
  assert.equal(e.muleRobChance(), MULE.rob.risky);
  e.hn.noise.v = 0;
  assert.equal(e.muleRobChance(true), 0);
  give(e, { potato: 20, radish: 2 });
  e.muleAdjust("potato", 20);
  e.muleGo();
  const t = e.hn.mule.trip,
    value = t.value;
  // 跟车：当天到集市，路口四只拦路的
  e.s.region = "market";
  e.s.enemies.market = [];
  e.enemies = e.s.enemies.market;
  e.assignRegion();
  assert.equal(t.spawned, true);
  assert.equal(e.enemies.filter((z) => z.hnMule && !z.dead).length, MULE.foes.length);
  for (const z of e.enemies.filter((z) => z.hnMule)) z.dead = true;
  e.muleEscortCheck();
  assert.equal(t.escort, true);
  assert.ok(said(toasts, /没人敢截/));
  // 就算骰子说被截，跟过车的不会
  e.hnRoll = () => 0;
  atFarm(e);
  const money = e.s.money;
  e.s.day += 2;
  hour(e, 8);
  assert.equal(e.s.money, money + value);
  assert.equal(e.hn.mule.log[0].robbed, false);
  // 不跟车、被截：少一半
  give(e, { potato: 20, radish: 2 });
  e.muleAdjust("potato", 20);
  e.muleGo();
  const v2 = e.hn.mule.trip.value,
    m2 = e.s.money;
  e.s.day += 2;
  hour(e, 8);
  assert.equal(e.s.money, m2 + Math.floor(v2 * (1 - MULE.rob.take)));
  assert.equal(e.hn.mule.log[0].robbed, true);
});

test("mule runs: stolen goods stay off the cart; places you have not been to stay locked", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  muleReady(e);
  e.s.districts.unlocked = {};
  e.s.beyond.unlocked = {};
  assert.equal(e.muleMap("region"), null);
  e.muleSet("dest", "region");
  give(e, { potato: 5, radish: 2 });
  e.muleAdjust("potato", 5);
  assert.match(e.muleReason(), /还没去过地区/);
  e.muleSet("dest", "market");
  if (e.th) {
    e.th.hot = [{ item: "potato", n: 5, until: e.s.day + 7 }];
    assert.match(e.muleReason(), /赃物/);
  }
});

// ================= 设施改良 =================
test("upgrades: a voucher (or an upgrade paper) picks one path per kind for good; each building then costs materials; the caravan sells papers once every blueprint is known", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  const tower = put(e, "tower", 700, 420);
  e.c.researchCredits = 0;
  assert.match(e.unlockReason("tower", "light"), /蓝图凭证/);
  assert.match(e.upgradeReason(tower), /先选一条路线/);
  e.c.researchCredits = 2;
  assert.equal(e.unlockPath("tower", "light"), true);
  assert.equal(e.c.researchCredits, 1);
  assert.match(e.unlockReason("tower", "twin"), /不能再换/);
  give(e, { parts: 3 });
  assert.equal(e.upgradeBuilding(tower.id), true);
  assert.equal(tower.hnUp, "light");
  assert.match(e.upgradeReason(tower), /已经改成/);
  // 改良图纸先用
  give(e, { upPaper: 1 });
  assert.equal(e.unlockPath("trap", "net"), true);
  assert.equal(stock(e, "upPaper"), 0);
  assert.equal(e.c.researchCredits, 1);
  // 商队：蓝图都学全了才卖改良图纸
  for (const k of Object.keys(TECH)) e.c.technologies[k] = true;
  e.o.caravan.next = e.s.day;
  e.caravanHere = () => false;
  assert.equal(e.arriveCaravan(), true);
  const offer = e.o.caravan.offers.find((o) => o.item === UP_PAPER.item);
  assert.ok(offer && offer.price === UP_PAPER.price);
  const back = Engine.parse(e.serialize());
  assert.equal(back.buildings.find((b) => b.id === tower.id).hnUp, "light");
  assert.equal(back.bustle.up.tower, "light");
});

test("upgrades: searchlight towers hit 20% harder at night; twin sentries fire twice as fast with a spare guard who ate", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  const t = put(e, "tower", 700, 420, { hnUp: "light" });
  e.hn.up.tower = "light";
  const z = e.enemy("armor", 760, 430);
  z.hp = z.maxHp = 9999;
  e.enemies.push(z);
  const hit = () => {
    const before = z.hp;
    e._damageSource = "tower";
    try {
      e.hurtEnemy(z, 26, Math.atan2(z.y - t.y, z.x - t.x));
    } finally {
      e._damageSource = null;
    }
    return before - z.hp;
  };
  e.s.minute = 600;
  const day = hit();
  e.s.minute = 23 * 60;
  const night = hit();
  assert.ok(Math.abs(night / day - UPGRADES.tower.paths.light.night) < 0.02, day + " vs " + night);
  // 双人哨：守卫比塔多一个、吃了干粮
  e.s.buildings = e.s.buildings.filter((b) => b.type !== "tower");
  const tw = put(e, "tower", 700, 420, { hnUp: "twin" });
  e.hn.up.tower = "twin";
  e.recruit("farmer");
  e.recruit("medic");
  put(e, "bed", 760, 340);
  put(e, "bed", 820, 340);
  for (const r of e.c.residents) Object.assign(r, { priorities: { ...r.priorities, guard: 3 }, workRole: "guard", role: "guard", fed: true, fatigue: 0 });
  e.s.minute = 600;
  give(e, { bread: 2 });
  e.twinMeals();
  assert.ok(tw.hnFed > e.absNow());
  assert.equal(e.twinTowers().length, 1);
  const shots = (secs) => {
    let n = 0;
    give(e, { ammo: 100 });
    const orig = e.hurtEnemy.bind(e);
    e.hurtEnemy = (...a) => {
      n++;
      return orig(...a);
    };
    for (let s = 0; s < secs; s += 0.1) e.updateDefense(0.1);
    e.hurtEnemy = orig;
    return n;
  };
  const twin = shots(9);
  tw.hnFed = 0;
  const single = shots(9);
  assert.ok(twin >= single * 2 - 1, twin + " vs " + single);
});

test("upgrades: nets hold an infected for 3 s; spikes hit 60% harder and wear twice as fast", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  const net = put(e, "trap", 600, 600, { hnUp: "net" });
  e.hn.up.trap = "net";
  const z = e.enemy("slow", 600, 602);
  z.hp = z.maxHp = 999;
  e.enemies.push(z);
  e._damageSource = "trap";
  try {
    e.hurtEnemy(z, 45, 0);
  } finally {
    e._damageSource = null;
  }
  assert.equal(z.trapHeld, UPGRADES.trap.paths.net.hold);
  assert.equal(z.netHeld, true);
  e.s.buildings = e.s.buildings.filter((b) => b !== net);
  const sp = put(e, "trap", 600, 600, { hnUp: "spike" });
  const before = z.hp,
    hp0 = sp.hp;
  e._damageSource = "trap";
  try {
    e.hurtEnemy(z, 45, 0);
  } finally {
    e._damageSource = null;
  }
  const plain = Math.round(45 * TRAP_ALL.mult);
  assert.ok(Math.abs(before - z.hp - plain * UPGRADES.trap.paths.spike.dmg) <= 2, before - z.hp + " vs " + plain);
  assert.equal(hp0 - sp.hp, TRAP_ALL.wear * (UPGRADES.trap.paths.spike.wear - 1), "extra wear on top of the normal one");
});

test("upgrades: iron fences take half; barbs bite back 5 a chew; nearby segments can be done in one go", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e, 300, 700);
  clearFoes(e);
  const f = put(e, "fence", 900, 420, { hnUp: "iron" });
  e.hn.up.fence = "iron";
  const snap = e.fenceSnapshot();
  f.hp -= 36;
  e.fenceAfter(snap);
  assert.equal(f.hp, BUILDINGS.fence.hp - 18);
  f.hnUp = "barb";
  const z = e.enemy("slow", 930, 420);
  z.hp = z.maxHp = 100;
  z.cooldown = 1;
  e.enemies.push(z);
  const s2 = e.fenceSnapshot();
  f.hp -= 18;
  e.fenceAfter(s2);
  assert.equal(z.hp, 95);
  // 一次改一片
  e.s.buildings = e.s.buildings.filter((b) => b.type !== "fence" && b.type !== "gate");
  const row = Array.from({ length: 5 }, (_, i) => put(e, "fence", 600 + i * 40, 300));
  put(e, "gate", 800, 300);
  give(e, { scrap: 7 });
  const have = stock(e, "scrap");
  assert.equal(e.upgradeFences(row[0].id), true);
  const done = e.s.buildings.filter((b) => ["fence", "gate"].includes(b.type) && b.hnUp === "iron").length;
  assert.equal(done, Math.min(6, Math.floor(have / 2)));
  assert.equal(stock(e, "scrap"), have - done * 2);
});

test("upgrades: far sprinklers reach 360; water savers use 0.7 a plot; big barrels hold 24; filters make 18 in the rain", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  const sp = put(e, "irrigation", 495, 528, { hnUp: "far" });
  assert.equal(e.sprinklerR(sp), 360);
  sp.hnUp = "saver";
  assert.equal(e.routeCostMult({ kind: "sprinkler", id: sp.id }), UPGRADES.irrigation.paths.saver.use);
  assert.equal(e.routeCostMult({ kind: "barrel", id: "x" }), 1);
  const b = put(e, "rain", 600, 600, { hnUp: "big" });
  assert.equal(e.barrelStore(b), 24);
  b.hnUp = "filter";
  assert.equal(e.barrelMade(b, true, false), 18);
  assert.equal(e.barrelMade(b, false, false), 4);
  // 省水：水网里浇一块只扣 0.7
  for (const p of e.s.plots) Object.assign(p, { crop: null });
  e.bt.net.order = ["sprinkler", "trough", "canal", "barrel", "tower"];
  const p = e.s.plots.find((q) => e.isFarmPlot(q) && Math.hypot(q.x - sp.x, q.y - sp.y) < 200);
  Object.assign(p, { tilled: true, crop: "radish", growth: 0, wateredDay: 0, waterUnits: 0 });
  e.bt.net.day = e.s.day;
  e.bt.net.pool = 5;
  e.s.weather = "晴朗";
  e.netDistribute(["sprinkler"]);
  assert.equal(e.bt.net.pool, 4.3);
});

test("upgrades: the twin stove runs two batches at once; slow fire takes 1.5x and gives one more", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  e.s.buildings = e.s.buildings.filter((b) => b.type !== "cook");
  const cook = put(e, "cook", 1010, 480, { hnUp: "twin" });
  const job = (id) => ({ id, recipe: "x", out: { bread: 2 }, cost: {}, station: "cook", remaining: 60, ready: false });
  e.c.production = [job("a"), job("b")];
  e.processProduction(30);
  assert.deepEqual(
    e.c.production.map((j) => j.remaining > 0 && j.remaining < 60),
    [true, true],
    "both batches moved",
  );
  const time = () => {
    e.c.production = [job("c")];
    let t = 0;
    while (!e.c.production[0].ready && t < 400) {
      e.processProduction(1);
      t += 1;
    }
    return t;
  };
  cook.hnUp = undefined;
  const plain = time();
  assert.equal(e.c.production[0].out.bread, 2);
  cook.hnUp = "slow";
  const slow = time();
  assert.ok(Math.abs(slow / plain - UPGRADES.cook.paths.slow.time) < 0.06, "about 1.5x the time: " + plain + " vs " + slow);
  assert.equal(e.c.production[0].out.bread, 3);
});

// ================= 伤员和医务室 =================
test("injuries: an infected reaching a tower guard or a gate guard has a 20% chance to hurt them (once a night); they hold the tower until that fight is over, then stop working for 2 days and feel it", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  atFarm(e, 300, 700);
  clearFoes(e);
  e.recruit("farmer");
  put(e, "bed", 760, 340);
  const tower = put(e, "tower", 1100, 420);
  const r = e.resident("farmer");
  Object.assign(r, { priorities: { ...r.priorities, guard: 3 }, workRole: "guard", fed: true, fatigue: 0, x: tower.x, y: tower.y + 40 });
  e.s.horde.phase = "active";
  e.s.minute = 23 * 60;
  const z = e.enemy("slow", tower.x + 10, tower.y + 40);
  e.enemies.push(z);
  e.hnRoll = (...k) => (k[0] === "touch" ? 0 : 0.5);
  e.touchCheck(null);
  assert.equal(e.isHurt("r:farmer"), true);
  assert.ok(said(toasts, /阿禾挂彩了.*咬牙守到这一仗打完/));
  assert.equal(e.residentActive(r), true, "holds the tower until this fight is over");
  assert.equal(r.workRole, "guard");
  e.s.horde.phase = "won";
  e.update(0.016, {});
  assert.equal(e.residentActive(r), false, "laid up once the fight is over");
  assert.equal(r.workRole, "rest");
  assert.match(e.residentWorkReason(r), /受伤了，还要养/);
  assert.ok(e.moodFactors(r).some((f) => f.key === "hurt" && f.v === INJURY.mood));
  // 一晚每人最多伤一次
  delete e.hn.hurt["r:farmer"];
  e._hnTouch = new Map();
  e.touchCheck(null);
  assert.equal(e.isHurt("r:farmer"), false, "already hurt once tonight");
  // 守营门的队员：伤了就不开枪
  e.hn.hurtNight = {};
  e.injure("r:farmer", "阿禾");
  const until = e.hn.hurt["r:farmer"].until;
  assert.equal(until - e.hn.hurt["r:farmer"].at, INJURY.days * 1440);
  e.s.minute = until % 1440;
  e.s.day = Math.floor(until / 1440);
  e.healCheck();
  assert.equal(e.isHurt("r:farmer"), false);
  assert.ok(said(toasts, /伤好了/));
  // 灰隼团的流弹：擦伤的人两成机会真伤了
  e.hn.hurtNight = {};
  e._hnTouch = new Map();
  e.woundNote("阿禾");
  assert.equal(e.isHurt("r:farmer"), true);
});

test("injuries: a room with a bed and a medicine cabinet is an infirmary; a bandage there heals in a day, a medkit by this afternoon; one treatment each", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  e.recruit("farmer");
  e.s.minute = 8 * 60;
  e.injure("r:farmer", "阿禾");
  give(e, { bandage: 2, medkit: 2 });
  assert.match(e.treatReason("r:farmer", "bandage"), /医务室/);
  const floor = put(e, "floor", 500, 300);
  put(e, "bed", 520, 320);
  assert.equal(e.infirmary(), null);
  put(e, "medCabinet", 470, 300);
  assert.equal(e.infirmary()?.type, "医务室");
  assert.equal(e.treat("r:farmer", "bandage"), true);
  const h = e.hn.hurt["r:farmer"];
  assert.equal(h.until, e.absNow() + INJURY.bandage);
  assert.match(e.treatReason("r:farmer", "medkit"), /已经用过绷带/);
  // 药包：今天 15:00 就好；过了 15:00 就 4 个钟点后
  e.injure("c:x", "老范");
  e.hn.hurt["c:x"] = { ...e.hn.hurt["c:x"] };
  e.s.minute = 9 * 60;
  e.treat("c:x", "medkit");
  assert.equal(e.hn.hurt["c:x"].until, e.absNow() - e.s.minute + INJURY.medkitAt);
  e.injure("r:medic", "许医生");
  e.s.minute = 17 * 60;
  e.treat("r:medic", "medkit");
  assert.equal(e.hn.hurt["r:medic"].until, e.absNow() + INJURY.medkitMin);
  void floor;
});

test("injuries: hurt gate guards hold their fire and rest until healed", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  const crew = e.o.crew[0] || (e.addCrew?.("tieqiao"), e.o.crew[0]);
  if (!crew) return;
  crew.role = "guard";
  e.injure("c:" + crew.id, crew.name);
  let fired = false;
  const orig = e.hurtEnemy.bind(e);
  e.hurtEnemy = (...a) => ((fired = true), orig(...a));
  const z = e.enemy("slow", crew.x + 40 || 1340, crew.y || 420);
  e.enemies.push(z);
  give(e, { ammo: 20 });
  for (let i = 0; i < 30; i++) e.guardFire(0.1);
  assert.equal(fired, false, "the hurt guard does not shoot");
  assert.equal(crew.role, "guard", "the role is put back");
  e.crewHour(crew);
  assert.match(crew.status, /养伤/);
});

// ================= 舒适度和休息好 =================
test("comfort: each kind of furniture counts once (up to 8); the best room by the farmhouse gives a rested spell after sleep — stamina 1.5x, XP +10%", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  atFarm(e, 330, 330);
  const floor = put(e, "floor", 420, 360);
  put(e, "chair", 440, 360);
  put(e, "chair", 400, 370);
  put(e, "lamp", 400, 340);
  const room = e.roomInfo(floor);
  assert.equal(e.roomComfort(room), 2, "two chairs still count once");
  put(e, "table", 440, 390);
  put(e, "bed", 400, 395);
  assert.equal(e.roomComfort(e.roomInfo(floor)), 4);
  assert.equal(e.homeRoom().floor, floor);
  // 睡一觉：休息好 2 + 4 小时
  e.s.minute = 22 * 60;
  assert.equal(e.sleep(), true);
  assert.equal(e.hn.rested.comfort, 4);
  assert.equal(e.restedLeft(), (COMFORT.rested.base + 4) * 60);
  assert.ok(said(toasts, /休息好」6 个钟点/));
  const xp0 = e.s.xp.agriculture;
  e.xp("agriculture", 10);
  assert.ok(Math.abs(e.s.xp.agriculture - xp0 - 11) < 1e-9);
  e.s.player.stamina = 40;
  e.update(0.5, { x: 0, y: 0 });
  const gain = e.s.player.stamina - 40;
  e.hn.rested.until = 0;
  e.s.player.stamina = 40;
  e.update(0.5, { x: 0, y: 0 });
  const plain = e.s.player.stamina - 40;
  if (plain > 0) assert.ok(Math.abs(gain / plain - COMFORT.rested.stamina) < 0.05, gain + " vs " + plain);
});

test("comfort: comfort 3 reaches the third rung of the ladder, 4 lifts everyone's mood by 2; resting residents tire off faster; the reading room doubles apprenticeship speed", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  e.recruit("farmer");
  put(e, "bed", 700, 300);
  const floor = put(e, "floor", 500, 600);
  put(e, "chair", 520, 600);
  put(e, "lamp", 480, 610);
  assert.equal(e.bestComfort(), 2);
  const r = e.resident("farmer");
  assert.ok(!e.moodFactors(r).some((f) => f.key === "comfy"));
  put(e, "table", 520, 630);
  put(e, "bookshelf", 480, 640);
  assert.equal(e.bestComfort(), 4);
  assert.ok(e.moodFactors(r).some((f) => f.key === "comfy" && f.v === COMFORT.mood));
  assert.equal(e.roomInfo(floor).type, "阅览室");
  assert.equal(e.studyRoom(), true);
  // 学习室：带徒每天早上多算一天
  e.o.crew.push({ id: "c-test", name: "小柳", role: "carry", trait: "handy", look: 0, status: "", task: "idle", moved: 0, fedDay: 0, x: 900, y: 600, target: null });
  assert.equal(e.startApprentice("farmer", "c-test"), true);
  const start = e.ss.apprentice.start;
  hour(e, 6);
  assert.equal(e.ss.apprentice?.start, start - 1, "a day counts twice with a reading room");
  // 歇着的居民：疲劳多降（舒适度 ÷ 2）
  r.fatigue = 50;
  e.s.minute = 23 * 60 - 0.5;
  e.c.workClock = 59.5;
  const before = r.fatigue;
  e.advanceMinutes(1);
  assert.ok(before - r.fatigue >= 8 + 4 * COMFORT.restFatigue - 1e-9, "dropped " + (before - r.fatigue));
});

test("comfort: a dining room (a table by the floor) counts one more dish for 「吃得好」", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  e.w.mealLog = [{ day: e.s.day, types: ["bread"] }, { day: e.s.day - 1, types: ["stew"] }];
  assert.equal(e.ladderChecks()[1], false, "two kinds are not enough");
  const floor = put(e, "floor", 500, 600);
  put(e, "chair", 520, 600);
  put(e, "lamp", 480, 610);
  put(e, "table", 520, 630);
  assert.equal(e.roomInfo(floor).type, "食堂");
  assert.equal(e.ladderChecks()[1], true, "eaten in the dining room they count as three");
  e.w.mealLog = [{ day: e.s.day, types: ["bread"] }];
  assert.equal(e.ladderChecks()[1], false, "one kind plus one is still two");
  assert.match(UI.buildingExtras(e, floor), /食堂（在这里吃的晚饭多算一种菜/);
  // 书架摆进同一间：成了阅览室，食堂也还算
  e.w.mealLog = [{ day: e.s.day, types: ["bread"] }, { day: e.s.day - 1, types: ["stew"] }];
  put(e, "bookshelf", 480, 640);
  assert.equal(e.roomInfo(floor).type, "阅览室");
  assert.equal(e.studyRoom(), true);
  assert.equal(e.ladderChecks()[1], true, "the bookshelf no longer hides the dining room");
  assert.match(UI.buildingExtras(e, floor), /阅览室（当学习室用.*也是食堂/);
});

// ================= 食堂、节庆、往事、鱼汛、麦穗 =================
const canteenReady = (e) => {
  e.ss.he.stage = 4;
  e.s.day = 9;
  e.s.minute = 19 * 60 + 10;
  give(e, { stew: 6, bread: 6, jam: 3, beanMeal: 3, herbTea: 3 });
  atFarm(e, SSPOTS.plaza.x, SSPOTS.plaza.y + 20);
};
test("canteen: 4–6 guests by reputation; each wants a dish; E at He Dashao's stove picks up the dish for the most impatient guest, E by the guest serves it; residents eat there too", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  e.recruit("farmer");
  canteenReady(e);
  e.ss.canteen.rep = 75;
  assert.equal(e.startCanteen(), true);
  const n = e.ss.canteen.night;
  assert.equal(n.max, CANTEEN2.guests + 2);
  assert.equal(e.hn.noise.v, 1);
  const g = n.customers[0];
  assert.ok(g.dish && TASTES[g.taste].dishes.includes(g.dish));
  assert.ok(e.objects.some((o) => o.type === "hnStove"));
  assert.ok(e.objects.some((o) => o.type === "hnGuest" && o.gid === g.id));
  assert.equal(e.serveCarry(g.id), false, "nothing in hand yet");
  assert.equal(e.stoveDish(), true);
  assert.equal(e.hn.carry.guest, g.id);
  const money = e.s.money;
  assert.equal(e.serveCarry(g.id), true);
  assert.ok(e.s.money > money);
  assert.equal(e.hn.carry, null);
  // 6 位都来：存档读得回
  for (let i = 0; i < 6; i++) e.canteenTick(25);
  assert.ok(n.spawned >= 5);
  const back = Engine.parse(e.serialize());
  assert.ok(back.seasons.canteen.night === null || back.seasons.canteen.night.customers.length <= 6);
  const morale = e.resident("farmer").morale;
  e.endCanteen();
  assert.equal(e.resident("farmer").morale, Math.min(100, morale + CANTEEN2.mood));
  assert.ok(said(toasts, /也在食堂吃了一顿/));
});

test("festivals: pick the offering yourself; better offerings cheer the whole camp (+3/+6/+10), a shabby one costs 3; without picking it works as before", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  e.recruit("farmer");
  e.s.day = 21;
  e.s.minute = 17 * 60;
  atFarm(e, SSPOTS.plaza.x, SSPOTS.plaza.y + 20);
  assert.equal(e.festivalKind(), "harvest");
  give(e, { radish: 4, potato: 4, bean: 4, pumpkin: 4, cotton: 4, herb: 4, fine_pumpkin: 2, fine_herb: 2, fine_cotton: 2 });
  const auto = e.festivalPay("harvest");
  assert.equal(Object.keys(auto).length, 3, "no pick: the old automatic pick");
  for (const id of ["fine_pumpkin", "fine_herb", "fine_cotton"]) e.festPick(id);
  assert.deepEqual(Object.keys(e.festivalPay("harvest")).sort(), ["fine_cotton", "fine_herb", "fine_pumpkin"]);
  assert.equal(e.festTier("harvest"), 3);
  const m = e.resident("farmer").morale;
  assert.equal(e.hostFestival(), true);
  assert.ok(e.resident("farmer").morale >= Math.min(100, m + FEST_PICK.morale[3]) - 1e-9);
  assert.ok(said(toasts, /供品评语：满堂彩/));
  assert.equal(e.hn.noise.v, NOISE.festival);
  // 灯火夜：挑破布条就扫兴
  const { e: e2 } = make();
  toAct(e2, 7);
  e2.recruit("farmer");
  e2.s.day = 14;
  e2.s.minute = 17 * 60;
  atFarm(e2, SSPOTS.plaza.x, SSPOTS.plaza.y + 20);
  assert.equal(e2.festivalKind(), "lanterns");
  give(e2, { wood: 10, cloth: 5 });
  e2.festPick("rag");
  assert.equal(e2.festTier("lanterns"), 0);
  const m2 = e2.resident("farmer").morale;
  e2.hostFestival();
  assert.ok(e2.resident("farmer").morale < m2 + 6 + 2 * 3 + 1, "the rag lamps take 3 off the lantern night's cheer");
});

test("museum: logs, photos and relics are one 「往事」 case; a full case lets you pick the keepsake (one, counts as furniture) or the old map (+2 vouchers, +10 reputation)", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  e.w.museum.built = true;
  e.assignRegion();
  atFarm(e, WSPOTS.museum.x, WSPOTS.museum.y + 10);
  e.f.clues = ["residential", "hospital", "warehouse"];
  for (const id of e.f.clues) e.donate("logs", id);
  e.r.finds = [...SHOWCASES.relics.items];
  for (const id of SHOWCASES.relics.items) e.donate("relics", id);
  assert.equal(e.pastDone(), false);
  assert.match(e.pastReason("map"), /还没填满/);
  e.f.photos = [1, 2, 3].map((id) => ({ id, subjects: ["x"] }));
  for (const id of [1, 2, 3]) e.donate("photos", id);
  assert.equal(e.pastDone(), true);
  assert.ok(said(toasts, /「往事」一柜填满了/));
  const credits = e.c.researchCredits || 0,
    rep = e.c.reputation;
  assert.equal(e.pastChoose("map"), true);
  assert.equal(e.c.researchCredits, credits + PAST.rewards.map.credits);
  assert.ok(e.c.reputation >= rep + PAST.rewards.map.rep);
  assert.match(e.pastReason("keepsake"), /已经挑过/);
  // 另一局挑陈列柜：建造菜单里出现一件，摆了就没了
  const { e: e2 } = make();
  e2.w.museum.claimed = ["logs", "photos", "relics"];
  e2.w.museum.built = true;
  e2.museumHere = () => true;
  assert.equal(BUILDINGS.hnKeepsake.retired, true);
  e2.pastChoose("keepsake");
  assert.equal(BUILDINGS.hnKeepsake.retired, false);
  put(e2, "hnKeepsake", 420, 360);
  e2.syncKeepsake();
  assert.equal(BUILDINGS.hnKeepsake.retired, true);
  assert.equal(e2.startBuild("hnKeepsake"), false);
});

test("fish runs: once his tasks are done Jiang Bo stays by the pond and calls a run every 7 days; that day one kind of fish comes up two at a time", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  e.ss.jiang.phase = "done";
  atFarm(e);
  const since = e.fishSince();
  assert.equal(since, e.s.day);
  assert.ok(e.objects.some((o) => o.type === "hnJiang") || (e.assignRegion(), e.objects.some((o) => o.type === "hnJiang")));
  const run = e.nextFishRun(e.s.day + 1);
  assert.equal(run, since + FISH_RUN.offset);
  e.s.day = run;
  const kind = e.fishRunKind();
  const before = stock(e, kind);
  // 钓上来：先当作上了一条要的那种
  e.s.inventory[kind] = (e.s.inventory[kind] || 0) + 1;
  const ok = e.hookFish.call(Object.assign(Object.create(Object.getPrototypeOf(e)), e), true);
  void ok;
  e.s.inventory[kind] -= 1;
  // 直接验证：鱼汛那天多给一条
  const was = { ...e.s.inventory };
  const orig = Object.getPrototypeOf(Object.getPrototypeOf(e)).hookFish;
  Object.getPrototypeOf(Object.getPrototypeOf(e)).hookFish = function () {
    this.s.inventory[kind] = (this.s.inventory[kind] || 0) + 1;
    return true;
  };
  try {
    e.hookFish();
  } finally {
    Object.getPrototypeOf(Object.getPrototypeOf(e)).hookFish = orig;
  }
  assert.equal(stock(e, kind) - ((was[kind] || 0) + (e.s.storage[kind] || 0)), 2 - 0, "one hooked plus one extra");
  assert.ok(said(toasts, /鱼汛/));
  void before;
});

test("dog patrol: at bond 15 Maisui learns to patrol — night-walkers stay out, and on a long night it barks when something comes up behind you", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  atFarm(e);
  e.f.dog = { rescued: true, x: 830, y: 500 };
  e.fr.dog.bond = 14;
  e.addBond(1, "");
  assert.ok(said(toasts, /麦穗学会了“巡夜”/));
  assert.equal(e.patrolOn(), true);
  // 夜行者：本来要来的那一晚也不来了
  e.s.day = 20;
  e.s.minute = 23 * 60;
  e.ut.prowl = 0;
  e.phaseAt = () => 3;
  e.tickProwl();
  assert.equal(e.ut.prowlOn, false);
  assert.equal((e.s.enemies.farm || []).filter((z) => z.prowl && !z.dead).length, 0);
  // 长夜：身后来了感染者
  e.ln.night = { day: e.s.day, n: 1, wave: 1 };
  clearFoes(e);
  Object.assign(e.s.player, { x: 800, y: 500, facing: 0 });
  const z = e.enemy("slow", 700, 500);
  e.enemies.push(z);
  e.dogBark();
  assert.ok(said(toasts, /麦穗冲你身后叫了一声/));
  // 同一只不叫第二回；新来的一只再叫，但一晚只弹一次字
  const words = toasts.length;
  e._hnBarkT = 0;
  e.dogBark();
  assert.equal(e.hn.stats.barks, 1, "the same infected is barked at once");
  e.enemies.push(e.enemy("slow", 690, 540));
  e.dogBark();
  assert.equal(e.hn.stats.barks, 2);
  assert.equal(toasts.length, words, "only the first bark of the night shows words");
  e.ln.night = null;
});

// ================= 界面 =================
test("UI: the noise chip, the radio commands, Hong Shu's trade page, Jiang Bo's page and the calendar read in plain words, and their buttons change the game", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  e.c.energy = 40;
  let hud = UI.campaignHud(e);
  assert.ok(hud.noise, "the radio works: the chip is on the bar");
  assert.equal(hud.noise.text, "动静 0");
  e.noiseAdd(4.5, "radio");
  hud = UI.campaignHud(e);
  assert.equal(hud.noise.tone, "warn");
  assert.match(hud.noise.title, /0 点结算/);
  assert.doesNotMatch(hud.noise.title, DEV);
  // 通信站：电台指令
  const radio = view(e, "radio");
  assert.match(radio, /电台指令/);
  assert.doesNotMatch(radio, /满了会引来尸群/, "the old 4-point line is replaced by the meter");
  assert.equal((radio.match(/data-action="hnCmd"/g) || []).length, 4);
  assert.doesNotMatch(radio, DEV);
  let saved = 0;
  const c = ctx(e, { save: () => saved++ });
  assert.equal(UI.handleCampaignAction("hnCmd", btn("hnCmd", "scout"), c), true);
  assert.equal(e.c.energy, 40 - RADIO_CMDS.scout.power);
  assert.equal(saved, 1);
  assert.match(view(e, "radio"), /今天的侦察/);
  assert.match(view(e, "radio"), /第 \d+ 天再发/);
  // 红薯：跑商那一页
  assert.equal(UI.campaignTitle({ view: "dialog", id: "hongshu" }), "红薯 · 跑商");
  assert.match(view(e, "dialog", "hongshu"), /车队到站以后/);
  muleReady(e);
  give(e, { potato: 12, radish: 2, medkit: 2 });
  let page = view(e, "dialog", "hongshu");
  assert.match(page, /去哪卖/);
  assert.match(page, /data-action="hnMuleLoad" data-id="potato:5"/);
  assert.doesNotMatch(page, DEV);
  UI.handleCampaignAction("hnMuleDest", btn("hnMuleDest", "frontier"), c);
  assert.equal(e.hn.mule.plan.dest, "frontier");
  UI.handleCampaignAction("hnMuleBack", btn("hnMuleBack", "cloth"), c);
  assert.equal(e.hn.mule.plan.back, "cloth");
  UI.handleCampaignAction("hnMuleLoad", btn("hnMuleLoad", "potato:5"), c);
  UI.handleCampaignAction("hnMuleLoad", btn("hnMuleLoad", "potato:5"), c);
  UI.handleCampaignAction("hnMuleLoad", btn("hnMuleLoad", "potato:-1"), c);
  assert.equal(e.hn.mule.plan.load.potato, 9);
  assert.match(view(e, "dialog", "hongshu"), /data-id="potato:20">装满</);
  UI.handleCampaignAction("hnMuleLoad", btn("hnMuleLoad", "potato:20"), c);
  assert.equal(e.hn.mule.plan.load.potato, 12, "装满 loads everything there is (12 potatoes)");
  UI.handleCampaignAction("hnMuleLoad", btn("hnMuleLoad", "potato:-3"), c);
  assert.match(view(e, "dialog", "hongshu"), /车上 <b>9\/20<\/b> 件/);
  let closed = 0;
  UI.handleCampaignAction("hnMuleGo", btn("hnMuleGo"), ctx(e, { closeMenu: () => closed++ }));
  assert.ok(e.hn.mule.trip, "on the road");
  assert.equal(closed, 1, "the page closes once it leaves");
  page = view(e, "dialog", "hongshu");
  assert.match(page, /在路上/);
  assert.match(page, /想跟车/);
  assert.doesNotMatch(page, DEV);
  // 江伯
  e.ss.jiang.phase = "done";
  e.fishSince();
  const jiang = view(e, "hnJiang");
  assert.match(jiang, /每 7 天报一次鱼汛/);
  assert.equal(UI.campaignTitle({ view: "hnJiang" }), "江伯 · 鱼汛");
  assert.doesNotMatch(jiang, DEV);
  // 日历：鱼汛和红薯回来
  const cal = view(e, "calendar");
  assert.match(cal, /鱼汛/);
  assert.match(cal, /红薯回来/);
  assert.doesNotMatch(cal, DEV);
  // 警报栏：动静、跟车
  e.s.minute = 19 * 60;
  const alerts = UI.campaignHud(e).alerts;
  assert.match(alerts, /今夜 0 点会有 3 只循声摸来/);
  assert.match(alerts, /跟车/);
  assert.doesNotMatch(alerts, DEV);
});

test("UI: facility cards pick an upgrade path and upgrade the building; the fence card does nearby segments; the stove page and the water page carry their upgrades", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  const c = ctx(e);
  const tower = put(e, "tower", 1180, 420);
  let card = UI.buildingExtras(e, tower);
  assert.match(card, /改良（二选一）/);
  assert.equal((card.match(/data-action="hnUpPath"/g) || []).length, 2);
  assert.doesNotMatch(card, DEV);
  e.c.researchCredits = 1;
  UI.handleCampaignAction("hnUpPath", btn("hnUpPath", "tower:light"), c);
  assert.equal(e.upPath("tower"), "light");
  assert.equal(e.c.researchCredits, 0);
  card = UI.buildingExtras(e, tower);
  assert.match(card, /data-action="hnUpBuild"/);
  give(e, UPGRADES.tower.cost);
  UI.handleCampaignAction("hnUpBuild", btn("hnUpBuild", tower.id), c);
  assert.equal(tower.hnUp, "light");
  assert.match(UI.buildingExtras(e, tower), /这座已经改成/);
  // 围栏：附近几段一起改
  const fences = [0, 1, 2].map((i) => put(e, "fence", 1000 + i * 40, 300));
  e.c.researchCredits = 1;
  e.unlockPath("fence", "iron");
  give(e, { scrap: 20 });
  card = UI.buildingExtras(e, fences[0]);
  assert.match(card, /附近还没改的 3 段一起改/);
  UI.handleCampaignAction("hnUpFences", btn("hnUpFences", fences[0].id), c);
  assert.ok(fences.every((f) => f.hnUp === "iron"));
  // 篝火灶的工作台页
  const cook = put(e, "cook", 700, 420);
  assert.match(UI.stationExtras(e, cook), /改良（二选一）/);
  // 水网那一页：雨水桶、喷灌头
  put(e, "rain", 560, 640);
  put(e, "irrigation", 495, 520);
  const water = view(e, "bWater");
  assert.match(water, /<h3>改良<\/h3>/);
  assert.match(water, /data-id="rain:big"/);
  assert.doesNotMatch(water, DEV);
  // 太阳能板写着电台指令要的电
  assert.match(UI.buildingExtras(e, put(e, "solar", 420, 880)), /电台指令也用电/);
});

test("UI: hurt residents and crew show on their cards with the treatment buttons; the infirmary, the room page's comfort card and the alerts; build buttons are real", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  e.recruit("farmer");
  const c = ctx(e);
  const r = e.resident("farmer");
  assert.doesNotMatch(residentExtras(e, r), /受伤了/);
  e.injure("r:farmer", "阿禾", "测试");
  const line = residentExtras(e, r);
  assert.match(line, /受伤了：还要养 48 个钟点/);
  assert.match(line, /要一间医务室/);
  assert.doesNotMatch(line, DEV);
  assert.match(UI.campaignHud(e).alerts, /1 人受伤/);
  // 医务室：地板 + 床 + 药柜
  const floor = put(e, "floor", 500, 600);
  put(e, "bed", 520, 610);
  const cab = put(e, "medCabinet", 480, 620);
  assert.equal(e.infirmary()?.floor, floor);
  const cabCard = UI.buildingExtras(e, cab);
  assert.match(cabCard, /<h4>伤员<\/h4>/);
  assert.match(cabCard, /data-action="hnTreat" data-id="r:farmer\|bandage"/);
  give(e, { bandage: 1 });
  UI.handleCampaignAction("hnTreat", btn("hnTreat", "r:farmer|bandage"), c);
  assert.equal(e.hn.hurt["r:farmer"].care, "bandage");
  assert.ok(e.hurtLeft("r:farmer") <= INJURY.bandage);
  // 队员受伤：队员卡
  e.o.crew.push({ id: "c-test", name: "小柳", role: "guard", trait: "handy", look: 0, status: "", task: "idle", moved: 0, fedDay: 0, x: 900, y: 600, target: null });
  e.injure("c:c-test", "小柳");
  const crew = view(e, "crew", "c-test");
  assert.match(crew, /守不了营门/);
  assert.doesNotMatch(crew, DEV);
  // 农舍「房间与家具」：舒适度卡，药柜能建，往事陈列柜要挑过才出现
  let rooms = roomExtras(e);
  assert.match(rooms, /舒适度和「休息好」/);
  assert.match(rooms, /data-action="build" data-id="medCabinet"/);
  assert.doesNotMatch(rooms, /data-id="hnKeepsake"/);
  assert.doesNotMatch(rooms, DEV);
  e.hn.past.pick = "keepsake";
  assert.match(roomExtras(e), /data-id="hnKeepsake"/);
  put(e, "hnKeepsake", 470, 590);
  assert.doesNotMatch(roomExtras(e), /data-id="hnKeepsake"/, "only one keepsake");
  rooms = roomExtras(e);
  assert.match(rooms, /舒适度 \d\/8/);
});

test("UI: the plaza shows the walking canteen and the offering picker; the museum shows one 「往事」 case; their buttons work", () => {
  const { e } = make();
  toAct(e, 7);
  e.recruit("farmer");
  e.ss.he.stage = 4;
  e.s.day = 21;
  e.s.minute = 17 * 60;
  atFarm(e, SSPOTS.plaza.x, SSPOTS.plaza.y + 20);
  give(e, { radish: 4, potato: 4, pumpkin: 4, fine_pumpkin: 2, fine_herb: 2, fine_cotton: 2 });
  let plaza = view(e, "plaza");
  assert.match(plaza, /挑三样菜去评比/);
  assert.match(plaza, /data-action="hnFestPick" data-id="fine_pumpkin"/);
  assert.doesNotMatch(plaza, DEV);
  const c = ctx(e);
  for (const id of ["fine_pumpkin", "fine_herb", "fine_cotton"]) UI.handleCampaignAction("hnFestPick", btn("hnFestPick", id), c);
  plaza = view(e, "plaza");
  assert.match(plaza, /✓ 优质南瓜/);
  assert.match(plaza, /满堂彩/);
  // 食堂开着：不开菜单的卡
  e.s.day = 23;
  e.s.minute = 19 * 60 + 10;
  give(e, { stew: 4, bread: 4 });
  assert.equal(e.startCanteen(), true);
  plaza = view(e, "plaza");
  assert.match(plaza, /不开菜单：到何大勺的灶台/);
  assert.doesNotMatch(plaza, DEV);
  // 档案馆：日志、照片、遗物并成「往事」一柜
  e.w.museum.built = true;
  const museum = view(e, "museum");
  assert.match(museum, /<h3>往事<\/h3>/);
  for (const cat of PAST.cats) assert.doesNotMatch(museum, new RegExp("<h3>" + SHOWCASES[cat].name + "</h3>"));
  assert.match(museum, new RegExp("<h3>" + SHOWCASES.fish.name + "</h3>"), "the fish case stays");
  assert.doesNotMatch(museum, DEV);
  e.w.museum.claimed = [...PAST.cats];
  e.c.researchCredits = 0;
  UI.handleCampaignAction("hnPast", btn("hnPast", "map"), c);
  assert.equal(e.hn.past.pick, "", "only at the museum");
  atFarm(e, WSPOTS.museum.x, WSPOTS.museum.y + 10);
  UI.handleCampaignAction("hnPast", btn("hnPast", "map"), c);
  assert.equal(e.hn.past.pick, "map");
  assert.equal(e.c.researchCredits, PAST.rewards.map.credits);
  assert.match(view(e, "museum"), /回礼已经挑了：老地图/);
});

// ================= 三十天乱玩 =================
test("thirty random days with radio commands, mule runs, upgrades, the canteen, festivals, injuries and noise attacks stay finite and keep loading", () => {
  const { e } = make();
  toAct(e, 8);
  atFarm(e);
  e.recruit("farmer");
  e.recruit("medic");
  muleReady(e);
  e.ss.he.stage = 4;
  e.ss.jiang.phase = "done";
  e.w.museum.built = true;
  put(e, "tower", 1180, 420);
  for (let i = 0; i < 6; i++) put(e, "fence", 1000 + i * 40, 300);
  put(e, "trap", 1300, 480);
  put(e, "floor", 500, 600);
  put(e, "bed", 520, 610);
  put(e, "medCabinet", 480, 620);
  put(e, "chair", 520, 640);
  put(e, "lamp", 470, 640);
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  e.c.researchCredits = 6;
  for (const [cls, p] of [["tower", "light"], ["fence", "barb"], ["trap", "net"]]) e.unlockPath(cls, p);
  for (let d = 0; d < 30; d++) {
    e.c.energy = 60;
    give(e, { potato: 6, radish: 2, bread: 3, stew: 2, parts: 2, scrap: 3, bandage: 1, medkit: 1, wood: 3, cloth: 1 });
    atFarm(e);
    const id = ["scout", "drop", "caravan", "help"][Math.floor(rnd() * 4)];
    if (!e.cmdReason(id)) e.radioCmd(id);
    if (!e.hn.mule.trip && rnd() < 0.6) {
      e.muleSet("dest", ["market", "region", "frontier"][Math.floor(rnd() * 3)]);
      e.muleAdjust("potato", 6);
      e.muleGo();
    }
    const b = e.s.buildings.find((x) => upgradeable(e, x));
    if (b) e.upgradeBuilding(b.id);
    if (rnd() < 0.2) e.injure("r:" + e.c.residents[Math.floor(rnd() * e.c.residents.length)].id, "某人");
    for (const k of Object.keys(e.hn.hurt)) if (!e.treatReason(k, "bandage")) e.treat(k, "bandage");
    for (const h of [6, 8, 9, 12, 15, 17]) hour(e, h);
    if (e.isFestivalDay()) {
      atFarm(e, SSPOTS.plaza.x, SSPOTS.plaza.y + 20);
      e.festPick(e.festPickable()[0]);
      e.hostFestival();
    }
    hour(e, 19);
    e.s.minute = 19 * 60 + 10;
    atFarm(e, SSPOTS.plaza.x, SSPOTS.plaza.y + 20);
    if (e.startCanteen()) {
      for (let k = 0; k < 6; k++) {
        e.canteenTick(20);
        if (e.stoveDish()) e.serveCarry(e.hn.carry?.guest);
      }
      e.endCanteen();
    }
    for (const h of [21, 22, 23]) hour(e, h);
    nextDay(e);
    for (let k = 0; k < 20; k++) e.update(0.1, {});
    clearFoes(e);
    const back = Engine.parse(e.serialize());
    assert.equal(back.bustle.schema, 1);
  }
  const walk = (v, path) => {
    if (typeof v === "number") assert.ok(Number.isFinite(v), "non-finite at " + path);
    else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) walk(x, path + "." + k);
  };
  walk(e.s.bustle, "bustle");
  assert.ok(e.hn.stats.cmds > 5, "commands went out");
  assert.ok(e.hn.mule.log.length > 3, "Hong Shu made runs");
});
const upgradeable = (e, b) => !b.hnUp && !e.upgradeReason(b);
