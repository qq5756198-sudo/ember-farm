// v0.31.0「重光」：重建站和 28 份清单（六面墙的效果、信号烟花）、旧世界陈列和锁着的铁盒、地铁隧道 30 层、残页和藏货点、
// 年终评定和收复度、鼎丰物资、余烬核和上限、界面和存档。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, needsStoryMigration } from "./pre-trim.mjs";
import * as Kin from "../dist/kin.js";
import { ITEMS, REGIONS, CROPS } from "../dist/data.js";
import { TASKS } from "../dist/rebuild-data.js";
import { ATLAS_POINTS } from "../dist/wayfinding.js";
import { prefsOf, HEART_IDS, FISH_IDS } from "../dist/kin-data.js";
import {
  WALLS,
  WALL_IDS,
  WALL_LISTS,
  LISTS,
  LIST_IDS,
  OLD,
  OLD_IDS,
  OLD_GROUPS,
  OLD_GROUP_IDS,
  PAGES,
  PAGE_IDS,
  DIGS,
  DIG_IDS,
  TUNNEL,
  CORES,
  CORE_IDS,
  CORE_BONUS,
  REVIEW,
  COMPANY,
  WALL_FX,
  BOX,
} from "../dist/relight-data.js";
import { OLD_STORY, DIARY, RIDDLE, LORE, CORE_LINES } from "../dist/relight-story.js";
import { tunnelLayout, SPAWN, UP, LAST_FLOOR } from "../dist/tunnel-gen.js";
import { SHAFT } from "../dist/relight.js";
import { MISSING_ICONS } from "../dist/item-sprites.js";

const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const make = (state = freshState(), seed = 31001) => {
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
const stock = (e, items) => {
  for (const [id, n] of Object.entries(items)) e.s.storage[id] = (e.s.storage[id] || 0) + n;
};
const bag = (e, items) => {
  for (const [id, n] of Object.entries(items)) e.s.inventory[id] = (e.s.inventory[id] || 0) + n;
};
const qty = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);
const take = (e, id) => {
  delete e.s.inventory[id];
  delete e.s.storage[id];
};
const hour = (e, h) => {
  e.s.minute = h * 60 - 0.5;
  e.c.workClock = 59.5;
  e.advanceMinutes(1);
};
const nextMorning = (e, h = 6) => {
  e.s.minute = 1440 - 0.5;
  e.c.workClock = 0;
  e.advanceMinutes(1);
  hour(e, h);
};
const go = (e, region, x = 768, y = 512) => {
  e.s.visited = { ...(e.s.visited || {}), [region]: true };
  e.s.region = region;
  e.enemies = e.s.enemies[region] ||= [];
  e.assignRegion();
  Object.assign(e.s.player, { x, y });
};
const view = (e, v, id = "") => UI.renderCampaignView(e, { view: v, id });
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const btn = (action, id = "") => ({ dataset: { action, id: String(id) } });
// 农场上找一块能放这种建筑的空地（人先走过去），放下
function place(e, type) {
  if (e.s.region !== "farm") go(e, "farm");
  e.buildMode = type;
  for (const y of [640, 700, 760, 820, 580, 260, 200])
    for (let x = 220; x <= 1340; x += 40) {
      Object.assign(e.s.player, { x, y: y - 60 });
      if (!e.buildReason(type, x, y)) {
        assert.ok(e.placeBuilding(x, y), type + " at " + x + "," + y);
        return e.s.buildings[e.s.buildings.length - 1];
      }
    }
  assert.fail("no room for " + type);
}
// 农场上建一座重建站，站在它跟前
function station(e) {
  go(e, "farm", 830, 600);
  bag(e, { wood: 20, stone: 12, scrap: 8 });
  assert.ok(e.startBuild("rlStation"));
  const b = place(e, "rlStation");
  Object.assign(e.s.player, { x: b.x, y: b.y + 50 });
  return e.rlStationB();
}
// 一份清单要的东西全放进仓库，然后一格格交
function fillList(e, id) {
  for (const [k, n] of LISTS[id].need) {
    const item = k.startsWith("@") ? "alDecor_teddy" : k;
    stock(e, { [item]: n });
    e.rlDeliver(id, k);
  }
  return e.listDone(id);
}
// 地底避难城开了、医院升降井修好了，站到检修平台上
function shaft(e) {
  // 检修平台主线打完才接通：主线打到头（第 9 段，第 8 段的奖励领过）
  if (!e.sc.claimed.includes("act8")) {
    e.sc.act = 9;
    e.sc.claimed = [...new Set([...e.sc.claimed, "act3", "act4", "act5", "act6", "act7", "act8"])];
    e.sc.letters = [...new Set([...e.sc.letters, "act3", "act4", "act5", "act6", "act7", "act8", "act9"])];
  }
  e.b.unlocked.shelter = true;
  e.b.points.shelter_lift = e.bpoint("shelter_lift");
  e.b.points.shelter_lift.flags.repair = true;
  go(e, "shelter", SHAFT.x, SHAFT.y);
}
const old30 = (setup = () => {}) => {
  const old = new Kin.Engine(Kin.newGameState("farmer"), () => {});
  setup(old);
  return old.serialize();
};

// ================= 数据 =================

// ================= 重建站和清单 =================

test("walls: water adds 10 a day, the clinic takes a day off an injury, the school speeds apprentices, radio calls a third neighbour, power keeps half the night walkers off, rail halves the road to and from the farm", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  for (const r of ["farmer", "medic", "mechanic"]) e.recruit(r);
  const before = e.netSources().reduce((a, x) => a + x.made, 0);
  e.rl.walls.water = { by: "list", day: 1 };
  assert.equal(e.netSources().reduce((a, x) => a + x.made, 0), before + WALL_FX.water);
  // 开诊
  e.rl.walls.clinic = { by: "list", day: 1 };
  assert.ok(e.injure("r:farmer", "阿禾", "测试"));
  const hurt = e.hn.hurt["r:farmer"];
  assert.equal(hurt.until - hurt.at, 1440);
  assert.ok(said(toasts, /1 天干不了活（门诊少躺一天）/));
  // 开课：带徒 3 天变 2 天
  e.addCrew({ id: "huer", name: "胡二", trait: "chatty", role: "guard", look: "huer" });
  e.rl.walls.school = { by: "list", day: 1 };
  assert.ok(e.startApprentice("medic", "huer"));
  assert.ok(said(toasts, /2 天后出师（营地的小课堂快一倍）/));
  const start = e.s.day;
  nextMorning(e);
  assert.ok(e.ss.apprentice, "still learning after one day");
  nextMorning(e);
  assert.equal(e.ss.apprentice, null, "done on the second morning");
  assert.equal(e.s.day - start, 2);
  // 通话：多来一个邻居
  e.rl.walls.radio = { by: "list", day: 1 };
  assert.deepEqual(e.allyNames(), ["阿川", "石头", WALL_FX.ally.name]);
  e.hn.help.armed = true;
  e.spawnAllies();
  assert.equal(e.hn.help.allies.length, 3);
  assert.doesNotThrow(() => Engine.parse(e.serialize()));
  e.dismissAllies();
  // 通电：大约一半的晚上夜行者不来
  e.rl.walls.power = { by: "list", day: 1 };
  let blocked = 0;
  for (let d = 1; d <= 400; d++) if (e.powerBlocks(d)) blocked++;
  assert.ok(blocked > 160 && blocked < 240, "about half: " + blocked);
  // 通车：进出农场路上省一半
  const ride = (to) => {
    go(e, "farm");
    const m = e.s.minute + e.s.day * 1440;
    e.travel(to);
    return e.s.minute + e.s.day * 1440 - m;
  };
  delete e.rl.walls.rail;
  const slow = ride("market");
  e.rl.walls.rail = { by: "list", day: 1 };
  const fast = ride("market");
  assert.ok(fast <= Math.ceil(slow / 2) + 0.01 && fast < slow, slow + " → " + fast);
});

test("fireworks: only after all 28 lists, in the evening at the station; the noise goes to the top and the neighbours come for that night's attack", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  for (const r of ["farmer", "medic", "mechanic"]) e.recruit(r);
  station(e);
  assert.match(e.rlFireReason(), /28 份/);
  e.rl.done = [...LIST_IDS];
  for (const w of WALL_IDS) e.rl.walls[w] = { by: "list", day: 1 };
  e.s.minute = 10 * 60;
  assert.match(e.rlFireReason(), /18:00/);
  e.s.minute = 19 * 60;
  e.s.horde.phase = "won";
  assert.equal(e.rlFireReason(), "");
  assert.ok(e.rlFireworks());
  assert.equal(e.hn.noise.v, 30);
  assert.ok(e.hn.help.armed);
  assert.match(e.rlFireReason(), /放过了/);
  assert.ok(e.events.some((x) => x.type === "fireworks"));
  // 0 点：循声来袭，邻居赶到（通话那面墙通了：三个人）
  hour(e, 24);
  assert.equal(e.hn.attack.state, "live");
  assert.ok(e.fightOn());
  e.update(0.05, {});
  assert.ok(e.hn.help.live);
  assert.equal(e.hn.help.allies.length, 3);
  assert.ok(said(toasts, /信号烟花/));
});

// ================= 旧世界陈列 =================


// ================= 头目的战利品：清单还要就再掉 =================
test("trophies: a boss beaten again drops its trophy while a list still needs it and you have none; not otherwise", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  const z = { x: 500, y: 500 };
  e.ut.boss.nurse.wins = 1;
  e.bossDown("nurse", z);
  assert.equal(qty(e, "trophyNurse"), 1, "the list still wants one");
  assert.ok(said(toasts, /护士长的胸牌/));
  e.bossDown("nurse", z);
  assert.equal(qty(e, "trophyNurse"), 1, "not while you hold one");
  e.rl.lists.c_nurse = { trophyNurse: 1 };
  take(e, "trophyNurse");
  e.bossDown("nurse", z);
  assert.equal(qty(e, "trophyNurse"), 0, "already handed in");
});

// ================= 残页 =================

// ================= 地铁隧道 =================

test("tunnel: deeper cabinets carry copper from floor 1, bulbs from 6, spikes from 11, relays from 21; the storeroom is emptied for a week; falling down there leaves the pack at the lift shaft", () => {
  const { e } = make();
  toAct(e, 8);
  shaft(e);
  e.tunnelEnter(1);
  const count = (f, id) => {
    let n = 0;
    for (let i = 0; i < 300; i++) n += e.rollContainer({ id: "tunnel-" + f + "-c" + i, ukind: "toolbox", rlDepth: f }, 40).bundle[id] ? 1 : 0;
    return n;
  };
  // 300 个柜子里大约几成有（照 TUNNEL.mats 的几率，留出误差）
  const about = (f, id) => Math.round(300 * TUNNEL.mats[id].chance * 0.6);
  assert.ok(count(1, "rlCopper") > about(1, "rlCopper"));
  assert.equal(count(5, "rlBulb"), 0);
  assert.ok(count(6, "rlBulb") > about(6, "rlBulb"));
  assert.equal(count(10, "rlSpike"), 0);
  assert.ok(count(11, "rlSpike") > about(11, "rlSpike"));
  assert.equal(count(20, "rlRelay"), 0);
  assert.ok(count(21, "rlRelay") > about(21, "rlRelay"));
  // 物资库：一个柜子开过以后 7 天里打不开
  e.rl.tunnel.key = { floor: 10, day: e.s.day, luck: false };
  e.s.enemies.tunnel = null;
  e.assignRegion();
  const box = e.objects.find((o) => o.type === "crate" && o.rlStore);
  Object.assign(e.s.player, { x: box.x, y: box.y + 10 });
  e.interact();
  assert.equal(e.s.opened[box.id].day, e.s.day);
  e.s.day += 2;
  const before = JSON.stringify(e.s.inventory);
  e.openContainer(box);
  assert.equal(JSON.stringify(e.s.inventory), before, "emptied this week");
  // 倒下
  e.s.outing = { scrap: 10 };
  e.s.inventory.scrap = 10;
  e.die();
  assert.equal(e.s.region, "farm");
  assert.equal(e.s.grave.region, "shelter");
  assert.equal(e.rl.tunnel.key, null);
});

// ================= 年终评定 =================


// ================= 鼎丰物资 =================

// ================= 余烬核 =================

// ================= 存档 =================
test("save: a new game says nothing; a v0.30 save keeps a checkpoint, says 重光 once, gets cores already earned and reads back the same; broken records are refused", () => {
  const { e: n, toasts: t0 } = make();
  n.update(0.05, {});
  assert.ok(!said(t0, /^重光/));
  assert.equal(n.rl.intro, undefined);
  const text = old30((old) => {
    old.ss.trust.medic = 10;
  });
  assert.equal(needsStoryMigration(text), true);
  const { e, toasts } = make(Engine.parse(text));
  e.update(0.05, {});
  e.update(0.05, {});
  assert.equal(toasts.filter((t) => /^重光/.test(t.text)).length, 1);
  assert.ok(e.rl.cores.includes("trust"), "trust 10 from before counts");
  const again = Engine.parse(e.serialize());
  assert.deepEqual(again.relight.cores, e.rl.cores);
  assert.equal(needsStoryMigration(e.serialize()), false);
  const bad = (fn) => {
    const s = JSON.parse(e.serialize());
    fn(s.relight);
    assert.throws(() => Engine.parse(JSON.stringify(s)), /重光记录损坏/);
  };
  bad((r) => (r.lists.w_pond = { fish: 99 }));
  bad((r) => (r.done = ["nope"]));
  bad((r) => (r.walls.water = { by: "magic", day: 1 }));
  bad((r) => (r.old = ["rlOld_photo", "rlOld_photo"]));
  bad((r) => (r.pages = ["p99"]));
  bad((r) => (r.tunnel.floor = 31));
  bad((r) => (r.tunnel.lifts = [7]));
  bad((r) => (r.reviews = [{ y: 1, day: 28, s: [9], v: [1], lamps: 5 }]));
  bad((r) => (r.cores = ["moon"]));
  bad((r) => (r.co.state = "owned"));
  bad((r) => (r.watch = 3));
});

// ================= 界面 =================

// v0.36 查出来的：长夜打着的时候存档（每 20 秒一次），守住过 4 个以上、身上有余烬核时这一夜的“多多少”超过两倍，读不回来
test("a save made in the middle of a long night reads back even with every ember core", () => {
  const e = new Engine(freshState(), () => {});
  e.ln.storyDay = 30;
  e.ln.held = e.ln.tried = 9;
  e.rl.cores = [...CORE_IDS];
  const mult = Math.round(e.lnMult() * 100);
  assert.ok(mult > 200, "cores push it past twice: " + mult);
  e.s.day = 94;
  e.ln.night = { day: 94, n: 10, mult, wave: 2, left: 40, made: 30, boss: 0, kills: 20, start: 94 * 1440 + 1320, prev: "won" };
  const back = Engine.parse(e.serialize());
  assert.equal(back.longnight.night.mult, mult);
});
