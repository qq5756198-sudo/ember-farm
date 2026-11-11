// v0.38.0「修缮」：卡位逃脱（自己挪出来、设置和快捷菜单里的“挪到能走的地方”），和这一轮修好的毛病，每一条一个回归测试。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Engine, freshState } from "../dist/ahead.js";
import { Engine as PreEngine, freshState as preFresh } from "./pre-trim.mjs";
import { BUILDINGS, REGIONS, WORLD, ITEMS } from "../dist/data.js";
import { MEND, MEND_TEXT } from "../dist/mend-data.js";
import { FORAGE_SPOTS } from "../dist/almanac-data.js";
import { PEDDLER_SPOT, BUYER } from "../dist/hope-data.js";
import { DRONE } from "../dist/bounty-data.js";
import { SHAFT } from "../dist/relight.js";

const DT = 0.05;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const make = (state = freshState(), seed = 38001) => {
  state.undertow.seed = seed;
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  return { e, toasts };
};
const run = (e, secs, input = { x: 0, y: 0 }) => {
  for (let t = 0; t < secs; t += DT) e.update(DT, input);
};
const stuck = (e) => e.blocked(e.s.player.x, e.s.player.y, false, MEND.r);
const addB = (e, type, x, y, extra = {}) => {
  const b = { id: "t-" + type + "-" + e.s.buildings.length, type, x, y, rotation: 0, hp: BUILDINGS[type].hp, open: false, ...extra };
  e.s.buildings.push(b);
  e.navRevision = (e.navRevision || 0) + 1;
  return b;
};
// 农场上一处空地：人站在 (x, y)，四周 160 步内没有设施、田、交互的东西
function openSpot(e) {
  for (let y = 600; y < 940; y += 20)
    for (let x = 700; x < 1300; x += 20) {
      const p = { x, y };
      if (e.blocked(x, y, false, 60)) continue;
      if (e.s.plots.some((q) => dist(q, p) < 160) || e.objects.some((o) => dist(o, p) < 160)) continue;
      if (dist(p, REGIONS.farm.exit) < 260 || dist(p, MEND.home) < 200) continue;
      return p;
    }
  throw Error("no open spot");
}

// ================= 卡位逃脱 =================
test("stuck inside a building: the game moves you out to the nearest place you can stand within a moment", () => {
  const { e, toasts } = make();
  const at = openSpot(e);
  Object.assign(e.s.player, at);
  addB(e, "bed", at.x, at.y);
  assert.ok(stuck(e), "standing inside the bed");
  run(e, 0.4);
  assert.equal(stuck(e), false, "moved out");
  assert.ok(dist(e.s.player, at) < 80, "to somewhere close by");
  assert.ok(toasts.some((t) => t.text === MEND_TEXT.pushed));
});

test("walled in by your own fences: the button moves you to the nearest place that reaches the exit; otherwise it says why not", () => {
  const { e } = make();
  const at = openSpot(e);
  Object.assign(e.s.player, at);
  assert.equal(e.unstuckReason(), MEND_TEXT.why.free, "free to walk: nothing to do");
  assert.equal(e.unstuck(), false);
  // 一圈围栏（横的 72×18，竖的转 90 度）
  for (const dx of [-72, 0, 72]) {
    addB(e, "fence", at.x + dx, at.y - 60);
    addB(e, "fence", at.x + dx, at.y + 60);
  }
  for (const dy of [-36, 36]) {
    addB(e, "fence", at.x - 110, at.y + dy, { rotation: 1 });
    addB(e, "fence", at.x + 110, at.y + dy, { rotation: 1 });
  }
  for (const dy of [-60, 60]) {
    addB(e, "fence", at.x - 110, at.y + dy, { rotation: 1 });
    addB(e, "fence", at.x + 110, at.y + dy, { rotation: 1 });
  }
  assert.equal(stuck(e), false, "not inside anything");
  assert.equal(e.unstuckReason(), "", "but walled in");
  e.gx.grab = { z: null };
  e._mendWhy = null;
  assert.equal(e.unstuckReason(), MEND_TEXT.why.grabbed);
  e.gx.grab = null;
  assert.equal(e.unstuck(), true);
  assert.equal(stuck(e), false);
  // 挪到的地方走得到出口
  assert.equal(e.unstuckReason(), MEND_TEXT.why.cool, "a few seconds before the next one");
  e._mendAt = 0;
  e._mendWhy = null;
  assert.equal(e.unstuckReason(), MEND_TEXT.why.free, "now it reaches the exit");
});


// ================= 1. 建东西罩住自己 =================
test("a building can no longer be placed over yourself (it used to only keep its centre 38 steps away)", () => {
  const { e } = make();
  const at = openSpot(e);
  Object.assign(e.s.player, at);
  e.s.storage.wood = 99;
  // 围栏 72 宽：中心在你右边 40 步，外框罩着你
  const x = Math.round((at.x + 40) / 8) * 8,
    y = Math.round(at.y / 8) * 8;
  assert.ok(dist({ x, y }, at) >= 38);
  assert.equal(e.buildReason("fence", x, y), MEND_TEXT.coverSelf);
  e.buildMode = "fence";
  assert.equal(e.placeBuilding(x, y), false);
  assert.equal(stuck(e), false);
  // 挪开一点就能放
  assert.equal(e.buildReason("fence", x, y - 48), "");
  // 地板、陷阱、大门人走得过去，照原来的规矩
  assert.equal(e.buildReason("trap", x, y), "");
});

// ================= 2. 盖住回家的落脚点 =================
test("the spot you land on when you come home (or are carried home) stays clear", () => {
  const { e } = make();
  e.s.storage.wood = 99;
  const h = MEND.home;
  Object.assign(e.s.player, { x: h.x, y: h.y + 90 });
  assert.equal(e.buildReason("fence", h.x, h.y - 8), MEND_TEXT.coverHome);
  // 旧档里已经盖住了：回到农场落在里面，马上挪出来
  addB(e, "bed", h.x, h.y);
  e.travel("market");
  e.travel("farm");
  assert.equal(stuck(e), false, "arrived free");
});

// ================= 3. 修好倒了的设施时站在原地基上 =================
test("a broken fence repaired while you stand on its footprint no longer traps you", () => {
  const { e } = make();
  const at = openSpot(e);
  Object.assign(e.s.player, at);
  const f = addB(e, "fence", at.x, at.y, { hp: 0 });
  assert.equal(stuck(e), false, "a broken fence does not block");
  e.s.storage.repairKit = 1;
  assert.equal(e.useKitOn(f.id), true);
  assert.ok(stuck(e), "the repaired fence is on you");
  run(e, 0.4);
  assert.equal(stuck(e), false);
});

// ================= 4. 照看机替你补种 =================
// 照看机和杂草 v0.42 删繁时去掉了（旧档里的照看机拆掉退料）：这一条按删繁以前的引擎测
test("the drone, harvesting while you are away, no longer replants a plot that has weeds", () => {
  const st = preFresh();
  st.undertow.seed = 38001;
  const e = new PreEngine(st, () => {});
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  const p = e.s.plots[20];
  e.s.debris = e.s.debris.filter((d) => d.id !== p.id);
  Object.assign(p, { tilled: true, crop: "radish", trait: null, growth: 999, wateredDay: e.s.day });
  e.gRec(p).w = e.s.day;
  e.c.technologies.drone = true;
  addB(e, "drone", p.x + 70, p.y + 70);
  e.c.energy = 50;
  e.s.storage.seedRadish = 10;
  e.travel("market");
  e.bt.away = e.absNow() - DRONE.away - 10;
  // 照看机今天不拔草（看补种这一下）
  e.btDroneTend = () => 0;
  e.workHour();
  assert.equal(p.crop, null, "harvested, not replanted among the weeds");
  assert.ok((e.s.storage.radish || 0) + (e.s.storage.fine_radish || 0) > 0);
});

// ================= 5. 阿禾按计划补种 =================
test("阿禾's replanting plan skips a plot with weeds, as you would have to", () => {
  const { e } = make();
  e.s.minute = 10 * 60;
  e.recruit("farmer");
  const r = e.resident("farmer");
  Object.assign(r, { fed: true, workRole: "farmer", priorities: { ...r.priorities, farmer: 1 } });
  e.r.arcs.farmer = 2;
  e.r.farmPlan = "radish";
  e.s.storage.seedRadish = 10;
  // 只留两块：先找到的那块有草
  const [a, b] = e.s.plots;
  for (const p of e.s.plots) Object.assign(p, { tilled: false, crop: null });
  e.s.debris = [];
  Object.assign(a, { tilled: true });
  Object.assign(b, { tilled: true });
  e.gRec(a).w = e.s.day;
  e.workHour();
  assert.equal(a.crop, null, "not on the weeds");
  assert.equal(b.crop, "radish", "on the clean one");
});

// ================= 6. 野物点贴着货郎 =================
test("no wild-forage spot on the farm sits next to the peddler's or the buyer's stall", () => {
  for (const p of FORAGE_SPOTS.farm) {
    assert.ok(dist(p, PEDDLER_SPOT) > 100, "forage at " + p.x + "," + p.y);
    assert.ok(dist(p, BUYER.farmSpot) > 100);
  }
  const { e } = make();
  for (const p of FORAGE_SPOTS.farm) assert.equal(e.blocked(p.x, p.y, true, 18), false, "standable " + p.x + "," + p.y);
});

// ================= 7. 瞭望塔的子弹 =================
test("a tower shot takes a bullet from the storage first, and yours only when the storage is out", () => {
  const { e } = make();
  e.s.storage.ammo = 2;
  e.s.inventory.ammo = 5;
  e._tDef = true;
  try {
    assert.ok(e.takeFarm({ ammo: 1 }));
    assert.ok(e.takeFarm({ ammo: 1 }));
    assert.equal(e.s.storage.ammo || 0, 0);
    assert.equal(e.s.inventory.ammo, 5, "yours untouched");
    assert.ok(e.takeFarm({ ammo: 1 }));
    assert.equal(e.s.inventory.ammo, 4);
  } finally {
    e._tDef = false;
  }
  // 塔以外的东西照原来的（先身上的）
  e.s.storage.ammo = 3;
  assert.ok(e.takeFarm({ ammo: 1 }));
  assert.equal(e.s.inventory.ammo, 3);
});

// ================= 8. 触屏切换精英部位 =================

// ================= 9. 死了的感染者留在名单里 =================
test("dead infected leave the lists (they piled up: 200 in one map and the save would not load)", () => {
  const { e } = make();
  e.s.enemies.market = [];
  const one = e.enemy("slow", 600, 600);
  for (let i = 0; i < 230; i++) e.s.enemies.market.push({ ...one, id: "dead" + i, path: [], dead: true, hp: -5 });
  e.s.enemies.market.push({ ...one, id: "alive", path: [] });
  const text = e.serialize();
  const s = Engine.parse(text);
  assert.equal(s.enemies.market.length, 1, "the dead ones dropped on loading");
  assert.equal(s.enemies.market[0].id, "alive");
  // 过一天：别的图里死了的都拿掉
  const { e: g } = make();
  g.s.enemies.courtyard = [{ ...one, id: "a", path: [], dead: true }, { ...one, id: "b", path: [] }];
  g.s.minute = 1439;
  g.advanceMinutes(2);
  assert.deepEqual(g.s.enemies.courtyard.map((z) => z.id), ["b"]);
  // 走出这张图：这张图里死了的拿掉
  g.travel("residential");
  for (const z of g.enemies.slice(0, 3)) z.dead = true;
  g.travel("farm");
  assert.equal(g.s.enemies.residential.some((z) => z.dead), false);
});

// ================= 10. 设施、田的上限 =================
test("the farm takes up to 300 buildings and 600 plots, so the save still loads", () => {
  const { e } = make();
  const at = openSpot(e);
  Object.assign(e.s.player, at);
  e.s.storage.wood = 99;
  while (e.s.buildings.length < MEND.maxBuildings) e.s.buildings.push({ id: "pad" + e.s.buildings.length, type: "floor", x: 100, y: 100, rotation: 0, hp: BUILDINGS.floor.hp });
  assert.equal(e.buildReason("fence", Math.round(at.x / 8) * 8, Math.round((at.y - 70) / 8) * 8), MEND_TEXT.tooManyBuildings);
  // 多一座就读不回来了（这就是要拦住的）
  const raw = JSON.parse(e.serialize());
  raw.buildings.push({ ...raw.buildings.at(-1), id: "one-more" });
  assert.throws(() => Engine.parse(JSON.stringify(raw)));
  while (e.s.plots.length < MEND.maxPlots) e.s.plots.push({ id: e.s.idCounter++, x: 100, y: 100, tilled: true, crop: null, growth: 0, wateredDay: 0 });
  assert.equal(e.buildReason("field", Math.round(at.x / 8) * 8, Math.round((at.y - 70) / 8) * 8), MEND_TEXT.tooManyPlots);
});

// ================= 11. 隧道里掉在地上的东西 =================
test("things dropped in the tunnel are brought up to the shaft when you go down a floor or leave", () => {
  const { e, toasts } = make();
  e.b.unlocked.shelter = true;
  Object.assign(e.rl.tunnel, { key: { floor: 3, day: e.s.day, luck: false }, floor: 3, deepest: 3 });
  e.s.region = "tunnel";
  e.s.enemies.tunnel = null;
  e._tunnel = null;
  e.assignRegion();
  e.s.drops.push({ region: "tunnel", x: 400, y: 520, items: { rlOld_reg: 1 } });
  const L = e.tunnelLayoutNow();
  Object.assign(e.s.player, { x: L.ladders[0].x, y: L.ladders[0].y, stamina: 100 });
  assert.equal(e.tunnelDown(), true);
  const d = e.s.drops.at(-1);
  assert.equal(d.region, SHAFT.region);
  assert.ok(dist(d, { x: SHAFT.x + 50, y: SHAFT.y - 40 }) < 82, "next to where you come up");
  assert.ok(toasts.some((t) => t.text === MEND_TEXT.tunnelDrops));
  // 离开隧道也一样
  e.s.drops.push({ region: "tunnel", x: 300, y: 520, items: { cloth: 1 } });
  e.tunnelLeave("shelter");
  assert.equal(e.s.drops.filter((x) => x.region === "tunnel").length, 0);
  assert.equal(e.s.region, "shelter");
  // 在升降井口按交互捡得起来
  const near = e.s.drops.filter((x) => x.region === "shelter");
  Object.assign(e.s.player, { x: SHAFT.x + 50, y: SHAFT.y - 40 });
  assert.ok(near.every((x) => dist(x, e.s.player) < 82));
  assert.equal(e.blocked(SHAFT.x + 50, SHAFT.y - 40, false, MEND.r), false);
});

// ================= 12、13. 触屏上的键盘说法 =================

// ================= 14. 手机上的提示 =================

// ================= 22. 手机竖着拿打开菜单时的提示条 =================

// ================= 15. 大屏手机横着拿 =================

// ================= 16. 过了半夜才睡 =================

// ================= 17. 麦穗挡着按交互 =================
test("麦穗 walking at your heel no longer turns every press next to something into a 'pick one'", () => {
  const { e } = make();
  const at = openSpot(e);
  Object.assign(e.s.player, at);
  const box = { type: "crate", id: "t-box", name: "补给箱", x: at.x + 40, y: at.y, loot: {}, icon: 40 };
  const dog = { type: "partnerDog", name: "麦穗", x: at.x - 30, y: at.y + 8, icon: 40 };
  e.objects.push(box, dog);
  assert.equal(e.pickCandidates().length, 0, "no chooser");
  assert.equal(e.nearestObject(), box, "the box, though the dog is closer");
  // 身边只有它：还是摸它
  e.objects = e.objects.filter((o) => o !== box);
  assert.equal(e.nearestObject(), dog);
  // 两样东西挨着：v0.39 起不再弹“选一个”，按的就是头上写着字的那一样（最近的）
  const box2 = { ...box, id: "t-box2", x: at.x + 46, y: at.y + 6 };
  e.objects.push(box, box2);
  assert.equal(e.pickCandidates().length, 0);
  assert.equal(e.nearestObject(), box);
});

// ================= 18. 麦穗在三处废墟里卡在墙里 =================
test("麦穗 follows you in the abandoned district, the old hospital and the warehouse (it used to arrive inside the row of houses and stay there)", () => {
  const { e } = make();
  e.f.dog.rescued = true;
  for (const id of ["residential", "hospital", "warehouse"]) {
    e.travel(id);
    for (const z of e.enemies) z.dead = true;
    const d = e.f.dog;
    assert.equal(e.blocked(d.x, d.y, false, MEND.r), false, id + ": arrives where it can walk");
    for (let t = 0; t < 6; t += DT) e.update(DT, { x: 1, y: 0 });
    for (let t = 0; t < 3; t += DT) e.update(DT, { x: 0, y: 0 });
    assert.ok(dist(d, e.s.player) < 120, id + ": it came along (" + Math.round(dist(d, e.s.player)) + ")");
    e.travel("farm");
  }
});
test("someone on the farm caught inside a new building (a resident, a helper) is moved out instead of standing there for good", () => {
  const { e } = make();
  e.recruit("farmer");
  const r = e.resident("farmer");
  Object.assign(r, { x: 1000, y: 760 });
  addB(e, "bed", 1000, 760);
  assert.ok(e.blocked(r.x, r.y, false, MEND.r));
  run(e, 0.8);
  assert.equal(e.blocked(r.x, r.y, false, MEND.r), false);
  assert.ok(Math.hypot(r.x - 1000, r.y - 760) < 90);
});

// ================= 20. 存不进去的时候怎么说 =================

// ================= 21. 一个人知道的喜好过了 60 样 =================
test("knowing more than sixty of one person's likes and dislikes (every gift is remembered) no longer breaks the save", () => {
  const { e } = make();
  const id = Object.keys(e.kin.know)[0] || "jiang";
  const items = Object.keys(ITEMS).filter((i) => !i.startsWith("prime_")).slice(0, 90);
  e.kin.know[id] = Object.fromEntries(items.map((i) => [i, "meh"]));
  assert.ok(Object.keys(e.kin.know[id]).length > 60);
  assert.doesNotThrow(() => Engine.parse(e.serialize()));
  // 不是东西的、不认识的类别照样当成损坏
  e.kin.know[id] = { notAThing: "meh" };
  assert.throws(() => Engine.parse(e.serialize()));
});

// ================= 存档 =================
