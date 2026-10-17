// v0.31.0「重光」：重建站和 28 份清单（六面墙的效果、信号烟花）、旧世界陈列和锁着的铁盒、地铁隧道 30 层、残页和藏货点、
// 年终评定和收复度、鼎丰物资、余烬核和上限、界面和存档。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, needsStoryMigration } from "../dist/campaign.js";
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
import * as UI from "../dist/campaign-ui.js";
import { residentExtras } from "../dist/people-hooks.js";
import { alertItems } from "../dist/winter-ui.js";
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
test("data: six walls and 28 lists of real items, 48 old things in eight groups of six with a story each, 24 pages, eight dig spots on open ground, seven cores; every new item is drawn", () => {
  assert.equal(WALL_IDS.length, 6);
  assert.equal(LIST_IDS.length, 28);
  for (const w of WALL_IDS) assert.ok(WALL_LISTS[w].length >= 4 && WALL_LISTS[w].length <= 5, w);
  for (const id of LIST_IDS) {
    const L = LISTS[id];
    assert.ok(L.need.length >= 1 && L.need.length <= 6, id);
    for (const [k, n] of L.need) {
      assert.ok(k.startsWith("@") || ITEMS[k], id + " " + k);
      assert.ok(Number.isInteger(n) && n >= 1, id);
    }
    for (const k of Object.keys(L.reward)) assert.ok(k === "gold" || ITEMS[k], id + " reward " + k);
    assert.ok(L.hint && L.name, id);
  }
  // 每份清单的东西来自不同的地方：同一面墙里不全是一种东西
  assert.equal(OLD_IDS.length, 48);
  assert.equal(OLD_GROUP_IDS.length, 8);
  for (const g of OLD_GROUP_IDS) assert.equal(OLD_IDS.filter((id) => OLD[id].group === g).length, 6, g);
  for (const id of OLD_IDS) {
    assert.ok(ITEMS[id] && OLD_STORY[id] && OLD_STORY[id].length > 8, id);
    assert.ok(["residential", "hospital", "warehouse", "tunnel"].includes(OLD[id].home.region), id);
  }
  for (const g of ["family", "classroom", "lastbus"]) assert.ok(["一家人", "一间教室", "最后一班车"].includes(OLD_GROUPS[g].name));
  assert.equal(PAGE_IDS.length, 24);
  for (const k of ["diary", "riddle", "lore"]) assert.equal(PAGE_IDS.filter((id) => PAGES[id].kind === k).length, 8, k);
  assert.equal(LORE.length, 8);
  for (const who of Object.keys(DIARY)) for (const f of prefsOf(who).fav) assert.ok(ITEMS[f], who + " " + f);
  const { e } = make();
  for (const id of DIG_IDS) {
    const d = DIGS[id];
    assert.ok(RIDDLE[id], id);
    go(e, d.region);
    assert.ok(!e.blocked(d.x, d.y, false, 24), id + " is on open ground in " + d.region);
  }
  assert.equal(CORE_IDS.length, 7);
  for (const id of CORE_IDS) assert.ok(CORE_LINES[id]?.length, id);
  for (const id of [...OLD_IDS, "rlIronBox", "rlCopper", "rlBulb", "rlSpike", "rlRelay"]) assert.ok(!MISSING_ICONS().includes(id), id + " has its own icon");
  // 地铁隧道是另外拼出来的一张图，不在世界地图上
  assert.ok(REGIONS.tunnel && !ATLAS_POINTS.tunnel);
});

// ================= 重建站和清单 =================
test("station: built once on the farm, E opens its page; lists take things from the bag and the store (crops in any quality), only at the station; a full list pays, a full wall says what came back", () => {
  const { e, toasts } = make();
  const b = station(e);
  assert.ok(b);
  bag(e, { wood: 20, stone: 12, scrap: 8 });
  assert.equal(e.startBuild("rlStation"), false, "only one");
  assert.ok(said(toasts, /已经有一座/));
  // E 打开重建站
  e.events.length = 0;
  Object.assign(e.s.player, { x: b.x, y: b.y + 40 });
  assert.match(e.context(e.nearestObject()), /重建站/);
  e.interact();
  assert.ok(e.events.some((x) => x.type === "menu" && x.view === "rlStation"));
  // 背包和仓库都算；作物优质、上品也收；多了不收
  e.s.inventory.potato = 3;
  stock(e, { potato: 2, fine_potato: 4 });
  assert.ok(e.rlDeliver("w_thaw", "potato"));
  assert.equal(e.listGot("w_thaw", "potato"), 8);
  assert.equal(qty(e, "fine_potato"), 1, "took the cheaper ones first and stopped at 8");
  assert.match(e.rlDeliverReason("w_thaw", "potato"), /交满/);
  // 离开重建站交不了
  Object.assign(e.s.player, { x: 300, y: 300 });
  stock(e, { herb: 4 });
  assert.match(e.rlDeliverReason("w_thaw", "herb"), /跟前/);
  Object.assign(e.s.player, { x: b.x, y: b.y + 40 });
  // 一面墙五份都交满：墙通了
  const gold0 = e.s.money;
  for (const id of WALL_LISTS.water) assert.ok(fillList(e, id), id);
  assert.ok(e.wallOn("water"));
  assert.equal(e.rl.walls.water.by, "list");
  assert.ok(e.s.money >= gold0);
  // v0.32：交满一面墙是大事，在画面上方停一张卡片
  assert.ok(e.events.some((x) => x.type === "moment" && x.kind === "wall" && /「通水」通了/.test(x.title)));
  assert.ok(e.o.log.some((l) => /旧水厂的支管接上了/.test(l.text)));
  // 被打坏了：清单都还在，再建一座不行，走到跟前按 E 修
  const sb = e.s.buildings.find((b) => b.type === "rlStation");
  sb.hp = 0;
  e.assignRegion();
  bag(e, { wood: 2, scrap: 1 });
  Object.assign(e.s.player, { x: sb.x, y: sb.y + 50 });
  assert.equal(e.startBuild("rlStation"), false, "only one station, even broken");
  assert.match(e.context(e.nearestObject()), /被打坏了，按 E 修/);
  e.interact();
  assert.equal(sb.hp, 160);
  assert.ok(e.wallOn("water") && e.listDone("w_pond"), "the lists are kept");
  const h = view(e, "rlStation");
  assert.doesNotMatch(h, DEV);
  assert.match(h, /通水/);
  assert.match(h, /5\/5 份/);
});

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
test("old things: cabinets give only the ones that live there and are still missing; donating at the archive tells the owner's story; a full group pays; all 48 give a core", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  e.w.museum.built = true;
  // 居民区的厨房柜子只出居民区厨房的旧物
  const pool = e.oldPool("residential", "kitchen");
  assert.ok(pool.length > 0 && pool.every((id) => OLD[id].home.region === "residential" && OLD[id].home.kinds.includes("kitchen")));
  assert.ok(e.oldPool("hospital", "medicine").every((id) => OLD[id].home.region === "hospital"));
  bag(e, { [pool[0]]: 1 });
  assert.ok(!e.oldPool("residential", "kitchen").includes(pool[0]), "not twice");
  // 柜子：一千个居民区的柜子里翻得到旧物，也翻得到铁盒
  go(e, "residential");
  let got = 0,
    boxes = 0;
  for (let i = 0; i < 1000; i++) {
    const r = e.rollContainer({ id: "residential-t" + i, ukind: "kitchen" }, 20);
    if (Object.keys(r.bundle).some((k) => OLD[k])) got++;
    if (r.bundle.rlIronBox) boxes++;
  }
  assert.ok(got > 40 && got < 160, "old things " + got);
  assert.ok(boxes > 10 && boxes < 60, "boxes " + boxes);
  // 捐：要在档案馆
  go(e, "farm", 300, 300);
  assert.match(e.donateOldReason(pool[0]), /档案馆/);
  go(e, "farm", 1300, 200);
  assert.equal(e.donateOldReason(pool[0]), "");
  assert.ok(e.donateOld(pool[0]));
  assert.ok(said(toasts, new RegExp(OLD_STORY[pool[0]].slice(0, 6))));
  // 一组凑齐
  const fam = OLD_IDS.filter((id) => OLD[id].group === "family" && !e.oldDonated(id));
  const rep0 = e.c.reputation;
  for (const id of fam) {
    bag(e, { [id]: 1 });
    assert.ok(e.donateOld(id), id);
  }
  if (OLD[pool[0]].group === "family" || fam.length === 6) assert.ok(e.rl.groups.includes("family"));
  assert.ok(e.c.reputation > rep0);
  // 全部 48 件
  for (const id of OLD_IDS) {
    if (e.oldDonated(id)) continue;
    bag(e, { [id]: 1 });
    e.donateOld(id);
  }
  assert.equal(e.rl.old.length, 48);
  assert.equal(e.rl.groups.length, 8);
  assert.ok(e.rl.cores.includes("museum"));
  const h = view(e, "museum");
  assert.doesNotMatch(h, DEV);
  assert.match(h, /旧世界陈列 48\/48/);
});

test("iron box: needs 陈工 in camp and a part; opens to an old thing, a circuit or seeds", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  bag(e, { rlIronBox: 3, parts: 1 });
  go(e, "farm");
  assert.match(e.rlBoxReason(), /陈工/);
  e.recruit("mechanic");
  assert.equal(e.rlBoxReason(), "");
  assert.ok(e.rlOpenBox());
  assert.equal(qty(e, "rlIronBox"), 2);
  assert.equal(qty(e, "parts"), 0);
  assert.match(e.rlBoxReason(), /零件/);
  assert.ok(said(toasts, /铁盒开了/));
  // 居民卡上有按钮
  const html = residentExtras(e, e.resident("mechanic"));
  assert.match(html, /让陈工撬一个/);
  // 撬开的东西只会是旧物、电路板或种子
  bag(e, { rlIronBox: 2, parts: 2 });
  const before = { ...e.s.inventory, ...e.s.storage };
  assert.ok(e.rlOpenBox());
  const got = Object.keys({ ...e.s.inventory, ...e.s.storage }).filter((k) => (e.s.inventory[k] || 0) + (e.s.storage[k] || 0) > (before[k] || 0));
  assert.ok(got.length && got.every((k) => k.startsWith("rlOld_") || ["circuit", "seedMystery", "seed_pumpkin_abundant", "seedHerb"].includes(k)), got.join(","));
  assert.equal(BOX.cost.parts, 1);
});

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
test("pages: cabinets, the fallen and the hook all turn some up; a diary marks the person's two loves, a riddle leaves loose earth on that map to dig once, the water pages come in order", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  // 日记
  assert.ok(e.readPage("p02"));
  for (const f of prefsOf("medic").fav) assert.equal(e.kin.know.medic[f], "fav");
  assert.ok(said(toasts, /残页「急诊科的交班本」/));
  // 水的来历按顺序
  const lore = [];
  for (let i = 0; i < 30 && lore.length < 3; i++) {
    const id = e.pageChance(1, "t", i);
    if (id && PAGES[id].kind === "lore") lore.push(PAGES[id].n);
  }
  assert.deepEqual(lore, [1, 2, 3]);
  // 谜题：那张图上多一处松土，挖一次
  e.readPage("p13");
  go(e, "courtyard");
  const spot = e.objects.find((o) => o.type === "rlDig");
  assert.ok(spot && spot.dig === "d5");
  Object.assign(e.s.player, { x: spot.x, y: spot.y + 10 });
  assert.match(e.context(e.nearestObject()), /松的/);
  const gold = e.s.money;
  e.interact();
  assert.ok(e.rl.dug.includes("d5"));
  assert.ok(e.s.money > gold);
  assert.ok(!e.objects.some((o) => o.type === "rlDig"), "gone after digging");
  // 来源：柜子、感染者、鱼钩都会出
  const rates = { box: 0, kill: 0 };
  for (let i = 0; i < 2000; i++) {
    if (e.rlRoll("page", "box", "x" + i, 9) < 0.035) rates.box++;
    if (e.rlRoll("page", "kill", i, 9) < 0.006) rates.kill++;
  }
  assert.ok(rates.box > 40 && rates.kill > 2);
  const j = UI.renderCampaignJournal(e, {});
  assert.doesNotMatch(j, DEV);
  assert.match(j, /残页 \d+\/24/);
  assert.match(j, /挖过了/);
});

// ================= 地铁隧道 =================
test("tunnel: the platform by the hospital lift goes down once the lift is fixed; each floor is the same for the same seed, day and luck; ladders, lifts, storerooms and floor 30", () => {
  const a = tunnelLayout(5, 7, 30, false),
    b = tunnelLayout(5, 7, 30, false),
    c = tunnelLayout(5, 7, 31, false);
  assert.deepEqual(a.rects, b.rects);
  assert.notDeepEqual(a.rects, c.rects, "another day, another layout");
  assert.equal(tunnelLayout(5, 7, 30, true).ladders.length, 2, "great luck: a second ladder");
  assert.equal(tunnelLayout(5, 10, 30, false).foes.length, 0, "storeroom");
  assert.ok(tunnelLayout(5, 10, 30, false).lift);
  assert.ok(tunnelLayout(5, LAST_FLOOR, 30, false).core);
  assert.equal(tunnelLayout(5, LAST_FLOOR, 30, false).ladders.length, 0);
  assert.ok(tunnelLayout(5, 29, 30, false).foes.length > tunnelLayout(5, 1, 30, false).foes.length);
  const { e, toasts } = make();
  toAct(e, 8);
  go(e, "shelter", SHAFT.x, SHAFT.y);
  assert.ok(!e.objects.some((o) => o.type === "rlShaft"), "no platform before the lift is fixed");
  // 升降井修好了、主线还没打完：平台在，下不去
  e.b.unlocked.shelter = true;
  e.b.points.shelter_lift = e.bpoint("shelter_lift");
  e.b.points.shelter_lift.flags.repair = true;
  go(e, "shelter", SHAFT.x, SHAFT.y);
  assert.ok(e.objects.some((o) => o.type === "rlShaft"));
  assert.match(e.tunnelReason(1), /主线打完以后/);
  assert.equal(e.tunnelEnter(1), false);
  shaft(e);
  assert.ok(e.objects.some((o) => o.type === "rlShaft"));
  assert.equal(e.travel("tunnel"), false, "not through the map");
  assert.equal(e.tunnelReason(5), "第 5 层的检修电梯还没修好");
  const m0 = e.s.minute;
  assert.ok(e.tunnelEnter(1));
  assert.equal(e.s.region, "tunnel");
  assert.equal(e.s.minute - m0, TUNNEL.ride);
  assert.equal(e.region.name, "地铁隧道 · 第 1 层");
  assert.deepEqual({ x: e.s.player.x, y: e.s.player.y }, SPAWN);
  assert.ok(!e.blocked(SPAWN.x, SPAWN.y), "spawn is open");
  assert.ok(e.colliders().length > 5);
  assert.ok(e.enemies.length >= 4);
  // 从别的图走不出去，只能顺着梯子回去
  assert.equal(e.travel("market"), false);
  // 下一层
  const L = e.tunnelLayoutNow();
  Object.assign(e.s.player, L.ladders[0]);
  assert.match(e.context(e.nearestObject()), /往下（第 2 层）/);
  e.interact();
  assert.equal(e.tunnelFloor(), 2);
  assert.equal(e.rl.tunnel.deepest, 2);
  // 读档还是这一层
  const e2 = new Engine(Engine.parse(e.serialize()), () => {});
  assert.equal(e2.tunnelFloor(), 2);
  assert.deepEqual(e2.colliders().map((r) => [r.x, r.y, r.w, r.h]), e.colliders().map((r) => [r.x, r.y, r.w, r.h]));
  assert.equal(e2.enemies.length, e.enemies.length);
  // 第 5 层的电梯：带够东西修好，以后从平台直达
  e.rl.tunnel.key = { floor: 5, day: e.s.day, luck: false };
  e.rl.tunnel.floor = 5;
  e.s.enemies.tunnel = null;
  e.assignRegion();
  const lift = e.objects.find((o) => o.type === "rlLift");
  assert.ok(lift);
  Object.assign(e.s.player, { x: lift.x, y: lift.y + 20 });
  assert.match(e.liftReason(), /还缺/);
  bag(e, TUNNEL.liftCost[5]);
  e.interact();
  assert.ok(e.rl.tunnel.lifts.includes(5));
  // 回升降井：在平台旁边
  Object.assign(e.s.player, UP);
  e.interact();
  assert.equal(e.s.region, "shelter");
  assert.ok(Math.hypot(e.s.player.x - SHAFT.x, e.s.player.y - SHAFT.y) < 120);
  assert.equal(e.rl.tunnel.key, null);
  assert.deepEqual(e.tunnelFloors(), [1, 5]);
  const html = view(e, "rlShaft");
  assert.doesNotMatch(html, DEV);
  assert.match(html, /坐检修电梯到第 5 层/);
  // 第 30 层的光
  Object.assign(e.s.player, { x: SHAFT.x, y: SHAFT.y });
  assert.ok(e.tunnelEnter(1));
  e.rl.tunnel.key = { floor: 30, day: e.s.day, luck: false };
  e.s.enemies.tunnel = null;
  e.assignRegion();
  assert.equal(e.enemies.length, 0, "the pump room is quiet");
  const core = e.objects.find((o) => o.type === "rlCore");
  Object.assign(e.s.player, { x: core.x, y: core.y + 10 });
  e.interact();
  assert.ok(e.rl.cores.includes("tunnel"));
  assert.ok(!e.objects.some((o) => o.type === "rlCore"));
  // v0.32：拿到余烬核是大事卡片（独白和上限都写在卡片上）
  assert.ok(e.events.some((x) => x.type === "moment" && x.kind === "core" && x.core === "tunnel"));
});

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
test("year review: on the vigil night at 21:00 a letter scores eight things and lights 1–4 lamps on the stone; four lamps the first time give the old watch and a core", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  for (const r of ["farmer", "medic", "mechanic"]) e.recruit(r);
  e.s.day = 28;
  hour(e, REVIEW.hour);
  assert.equal(e.rl.reviews.length, 1);
  const r = e.rl.reviews[0];
  assert.equal(r.y, 1);
  assert.equal(r.s.length, 8);
  assert.ok(r.lamps >= 1 && r.lamps <= 4);
  assert.ok(said(toasts, /评定信/));
  assert.equal(e.sc.unread, true);
  hour(e, REVIEW.hour);
  assert.equal(e.rl.reviews.length, 1, "once a year");
  // 一年里做得多：四盏灯
  e.s.day = 56;
  stock(e, { bread: 300 });
  e.s.stats.harvested += 200;
  for (const x of e.c.residents) x.morale = 90;
  e.s.stats.hordes += 6;
  e.rl.done = LIST_IDS.slice(0, 20);
  e.rl.old = OLD_IDS.slice(0, 30);
  for (const id of ["farmer", "medic", "mechanic", "jiang", "qin"]) e.ss.trust[id] = 7;
  e.rl.cores = ["longnight", "harvest", "trust", "tunnel", "lists"];
  hour(e, REVIEW.hour);
  const r2 = e.lastReview();
  assert.equal(r2.lamps, 4);
  assert.equal(e.rl.watch, 1);
  assert.ok(e.rl.cores.includes("review"));
  // 老怀表：建设页能摆，摆出来心情 +3
  assert.ok(e.startBuild("rlWatch"));
  place(e, "rlWatch");
  assert.equal(e.rl.watch, 2);
  assert.ok(e.moodFactors(e.c.residents[0]).some((f) => f.key === "watch" && f.v === REVIEW.watchMood));
  const h = view(e, "rlReview", "2");
  assert.doesNotMatch(h, DEV);
  assert.match(h, /第 2 年的评定/);
  assert.match(UI.renderCampaignJournal(e, {}), /年终评定信 · 2 封/);
});

test("completion: the collection book adds the lists, old things, pages, cores, fish, heart talks, tunnel depth and long nights into one percentage; 100% plays the closing broadcast once", () => {
  const { e } = make();
  toAct(e, 8);
  const c0 = e.rlCompletion();
  assert.equal(c0.parts.length, 8);
  assert.ok(c0.pct < 5);
  const h = view(e, "collection");
  assert.doesNotMatch(h, DEV);
  assert.match(h, /收复度/);
  assert.match(h, /余烬核 0\/7/);
  // 全做完
  e.rl.done = [...LIST_IDS];
  e.rl.old = [...OLD_IDS];
  e.rl.pages = [...PAGE_IDS];
  e.rl.cores = [...CORE_IDS];
  e.rl.tunnel.deepest = 30;
  e.ln.held = 10;
  for (const id of HEART_IDS) e.kin.heart[id] = { ...(e.kin.heart[id] || {}), seg: 3 };
  for (const id of FISH_IDS) e.kin.fish[id] = 1;
  assert.equal(e.rlCompletion().pct, 100);
  e.events.length = 0;
  hour(e, 7);
  assert.ok(e.rl.finale > 0);
  assert.ok(e.events.some((x) => x.type === "menu" && x.view === "rlFinale"));
  const f = view(e, "rlFinale");
  assert.match(f, /重光/);
  e.events.length = 0;
  hour(e, 7);
  assert.ok(!e.events.some((x) => x.view === "rlFinale"), "once");
});

// ================= 鼎丰物资 =================
test("company: 2000 to sign, a wall bought is fixed by the next morning; meanwhile curfew, a tenth of the harvest, camp mood −5 instead of the curfew's, no neighbours; someone asks to leave and can be talked round; tearing the contract stops it and keeps the money", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  for (const r of ["farmer", "medic", "mechanic"]) e.recruit(r);
  e.addCrew({ id: "huer", name: "胡二", trait: "chatty", role: "guard", look: "huer" });
  station(e);
  assert.match(e.coReason(), /2000/);
  e.s.money = 30000;
  assert.ok(e.coSign());
  assert.equal(e.s.money, 28000);
  assert.ok(e.decree("curfew"));
  assert.ok(!e.w.decrees.includes("curfew"), "the decree book itself is not touched");
  const f = e.moodFactors(e.c.residents[0]);
  assert.ok(f.some((x) => x.key === "company" && x.v === COMPANY.mood));
  assert.ok(!f.some((x) => /宵禁/.test(x.text)), "the curfew's own −3 is folded in");
  assert.match(e.cmdReason("help"), /邻居不肯来/);
  assert.match(view(e, "decrees"), /公司规矩/);
  // 买一面墙：明早修好
  assert.ok(e.coBuy("power"));
  assert.equal(e.s.money, 28000 - COMPANY.price.power);
  assert.ok(!e.wallOn("power"));
  nextMorning(e);
  assert.ok(e.wallOn("power"));
  assert.equal(e.rl.walls.power.by, "co");
  // 收成抽一成
  const p = e.s.plots[0];
  let got = 0;
  for (let i = 0; i < 10; i++) {
    Object.assign(p, { tilled: true, crop: "radish", growth: 999, wateredDay: e.s.day });
    const before = qty(e, "radish");
    e.harvest(p);
    got += qty(e, "radish") - before;
  }
  assert.ok(e.rl.co.cut >= 2, "cut " + e.rl.co.cut + " of " + (got + e.rl.co.cut));
  // 有人想走：两天后；走到他跟前按 E 劝住
  e.rl.co.asked = e.s.day - COMPANY.leaveEvery;
  hour(e, 9);
  assert.ok(e.rl.co.leave);
  assert.equal(e.rl.co.leave.id, "huer");
  assert.ok(said(toasts, /两天后我就走/));
  const helper = e.objects.find((o) => o.type === "allianceHelper" && o.helper === "huer");
  if (helper) {
    Object.assign(e.s.player, { x: helper.x, y: helper.y + 10 });
    assert.match(e.context(e.nearestObject()), /劝劝/);
  }
  assert.ok(e.coPersuade("huer"));
  assert.equal(e.rl.co.leave, null);
  // 再来一次，没劝就走了
  e.rl.co.asked = e.s.day - COMPANY.leaveEvery;
  hour(e, 9);
  assert.ok(e.rl.co.leave);
  nextMorning(e);
  nextMorning(e);
  assert.ok(!e.o.crew.some((c) => c.id === "huer"), "left after two days");
  // 结局卡换样子
  const end = view(e, "lnEnd");
  assert.match(end, /公司的余烬地区/);
  // 撕合同
  assert.ok(e.coTear());
  assert.ok(!e.decree("curfew"));
  assert.equal(e.cmdReason("help") === "鼎丰的车队在，雨巷的邻居不肯来了", false);
  assert.match(e.coReason(), /不会再来/);
  assert.ok(e.wallOn("power"), "the bought wall stays");
  // 花钱买的墙不算交满清单：那几份清单还能交
  assert.equal(e.listDone("p_copper"), false);
  assert.doesNotMatch(view(e, "rlStation"), DEV);
});

// ================= 余烬核 =================
test("cores: each adds 15 stamina and 5 health to the caps, kept by food, sleep and rest; the first long night held, three harvest stars and trust 10 each give one", () => {
  const { e } = make();
  toAct(e, 8);
  assert.equal(e.maxSta(), 100);
  assert.ok(e.grantCore("trust"));
  assert.ok(!e.grantCore("trust"), "once");
  assert.equal(e.maxSta(), 100 + CORE_BONUS.sta);
  assert.equal(e.maxHp(), 100 + CORE_BONUS.hp);
  // v0.32：独白的小卡片并进大事卡片
  assert.ok(e.events.some((x) => x.type === "moment" && x.kind === "core" && /余烬核/.test(x.title) && x.lines.some((l) => /体力上限 \+15/.test(l))));
  assert.ok(!e.events.some((x) => x.type === "ledger" && /余烬核/.test(x.title)));
  // 睡觉、吃东西不把它压回 100
  go(e, "farm");
  e.s.player.hp = 50;
  e.s.player.stamina = 20;
  e.sleep();
  assert.equal(e.s.player.stamina, e.maxSta());
  e.s.player.stamina = e.maxSta();
  e.paused = false;
  for (let i = 0; i < 20; i++) e.update(0.05, {});
  assert.ok(e.s.player.stamina > 100, "regen does not clip it");
  e.s.player.hp = e.maxHp() - 1;
  bag(e, { bread: 2 });
  e.s.player.hunger = 50;
  e.consume("bread");
  assert.ok(e.s.player.hp >= 100);
  // 存档上限放宽了
  e.s.player.hp = e.maxHp();
  assert.doesNotThrow(() => Engine.parse(e.serialize()));
  // 丰收评比三星
  const { e: f } = make();
  toAct(f, 8);
  f.festivalKind = () => "harvest";
  f.festivalStars = () => [true, true, true];
  f.festivalReason = () => "";
  f.atSpot = () => true;
  f.festivalPay = () => ({});
  assert.ok(f.hostFestival());
  assert.ok(f.rl.cores.includes("harvest"));
  // 信任到 10
  const { e: g } = make();
  toAct(g, 8);
  g.ss.trust.farmer = 10;
  hour(g, 6);
  assert.ok(g.rl.cores.includes("trust"));
  assert.match(view(g, "collection"), /体力上限 115/);
});

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
test("pages and actions: the station, the platform, the review, the museum, the collection, the decree book and the journal render without dev words; the buttons change real state", () => {
  const { e } = make();
  toAct(e, 8);
  for (const r of ["farmer", "medic", "mechanic"]) e.recruit(r);
  e.w.museum.built = true;
  station(e);
  e.readPage("p01");
  e.readPage("p09");
  for (const v of ["rlStation", "rlShaft", "rlReview", "rlFinale", "museum", "collection", "decrees", "plaza", "people"]) assert.doesNotMatch(view(e, v), DEV, v);
  assert.doesNotMatch(UI.renderCampaignJournal(e, {}), DEV);
  assert.equal(UI.campaignTitle({ view: "rlStation" }), "重建站");
  assert.equal(UI.campaignTitle({ view: "rlShaft" }), "检修平台");
  // 按钮
  stock(e, { fish: 3 });
  assert.ok(UI.handleCampaignAction("rlGive", btn("rlGive", "w_pond|fish"), ctx(e)));
  assert.equal(e.listGot("w_pond", "fish"), 3);
  e.s.money = 3000;
  UI.handleCampaignAction("rlCoSign", btn("rlCoSign"), ctx(e));
  assert.equal(e.rl.co.state, "signed");
  UI.handleCampaignAction("rlCoTear", btn("rlCoTear"), ctx(e));
  assert.equal(e.rl.co.state, "torn");
  bag(e, { rlIronBox: 1, parts: 1 });
  UI.handleCampaignAction("rlBox", btn("rlBox"), ctx(e));
  assert.equal(qty(e, "rlIronBox"), 0);
  // 警报栏：有锁着的铁盒、陈工在营地时提醒
  bag(e, { rlIronBox: 1 });
  const alerts = alertItems(e).map((a) => a.text).join("|");
  assert.match(alerts, /铁盒/);
});
