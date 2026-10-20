// v0.38.0「修缮」：卡位逃脱（自己挪出来、设置和快捷菜单里的“挪到能走的地方”），和这一轮修好的毛病，每一条一个回归测试。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Engine, freshState } from "../dist/campaign.js";
import { BUILDINGS, REGIONS, WORLD, ITEMS } from "../dist/data.js";
import { MEND, MEND_TEXT } from "../dist/mend-data.js";
import { FORAGE_SPOTS } from "../dist/almanac-data.js";
import { PEDDLER_SPOT, BUYER } from "../dist/hope-data.js";
import { DRONE } from "../dist/bounty-data.js";
import { SHAFT } from "../dist/relight.js";
import { touchWords } from "../dist/zest-ui.js";

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

test("the escape is in the settings and in the phone menu, and the handler moves you for real", () => {
  const game = readFileSync(new URL("../dist/game.js", import.meta.url), "utf8");
  assert.match(game, /action==='mendUnstuck'\)\{if\(engine\.unstuck\?\.\(\)\)/);
  assert.match(game, /function unstuckRow\(\)/);
  assert.match(game, /\$\{started\?unstuckRow\(\):''\}/);
  const phone = readFileSync(new URL("../dist/farlands-ui.js", import.meta.url), "utf8");
  assert.match(phone, /e\.unstuckReason \? unstuckTile\(e\) : ""/);
  for (const k of Object.keys(MEND_TEXT.why)) assert.ok(MEND_TEXT.short[k], "a short line for " + k);
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
test("the drone, harvesting while you are away, no longer replants a plot that has weeds", () => {
  const { e } = make();
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
test("on touch a 部位 button switches which part of an elite you aim at (T on a keyboard)", () => {
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<button data-action="touchAim" hidden[^>]*>部位<\/button>/);
  const game = readFileSync(new URL("../dist/game.js", import.meta.url), "utf8");
  assert.match(game, /if\(action==='touchAim'\)\{engine\.cycleAim\?\.\(\);/);
  assert.match(game, /z\.type==='elite'&&!z\.dead&&Math\.hypot\(z\.x-p\.x,z\.y-p\.y\)<420/);
  const { e } = make();
  const before = e.f.aimPart;
  e.cycleAim();
  assert.notEqual(e.f.aimPart, before);
});

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
test("on touch no keyboard or mouse words are left on the hotbar line, fishing, reeling, crouching, camera, expedition, build page, build badge, defence view, gate and chooser", () => {
  const lines = [
    "回收撬棍<span>左键挥 · 耐久 58/60 · X 推开</span>",
    "燃烧瓶<span>剩 52 · 左键扔出去</span>",
    "钉板<span>剩 3 · 左键摆在脚前</span>",
    "手枪<span>6 / 8 · 备用 20 · R 装填</span>",
    "近战栏空着<span>Tab 打开行囊换装</span>",
    "建设家园 <span>B 打开建造</span>",
    "萝卜种子<span>剩余 4 · E 播种</span>",
    "杂物<span>左键使用</span>",
    "正在等待咬钩 · 看到提示后按 E",
    "咬钩了！现在按 E 提竿",
    "蹲行 · V站起",
    "相机取景 · H拍照",
    "远征第2/3站 · F选择下一站",
    "按住 E（手机按住「收线」）收；线绷红了就松",
    "选择设施，走到空地，左键放置。Q 旋转，右键或 Esc 取消。",
    "左键放置 · Q 旋转 · 右键取消",
    "防线视图：绿圈是有人驻守的射程，红框是薄弱的围栏。再按 Z 关闭。",
    "角色可以通过。E 切换开关；关闭时阻挡僵尸。",
    "附近不止一样东西。按数字键或点一下：",
  ];
  const KEYS = /按\s?[A-Z]\b|\b[A-Z]\s?(推开|装填|打开|播种|站起|拍照|选择|旋转|切换|关闭)|左键|右键|数字键|Esc|Tab|[A-Z](站起|拍照|选择)/;
  for (const t of lines) {
    const out = touchWords(t);
    assert.doesNotMatch(out, KEYS, t + " → " + out);
  }
  const game = readFileSync(new URL("../dist/game.js", import.meta.url), "utf8");
  assert.match(game, /\$\('#selected-label'\)\.innerHTML=tw\(/);
  assert.match(game, /fishing\.textContent=tw\(/);
  assert.match(game, /el\.textContent=tw\(r\?`远征第/);
  assert.match(game, /tw\('按住 E（手机按住「收线」）收；线绷红了就松'\)/);
  const css = readFileSync(new URL("../dist/mend.css", import.meta.url), "utf8");
  assert.match(css, /@media \(pointer: coarse\) \{\s*\.dock-hints \{\s*display: none !important;/);
});

// ================= 14. 手机上的提示 =================
test("on a phone, where only one notice shows, a warning is not pushed out by a later small notice", () => {
  const game = readFileSync(new URL("../dist/game.js", import.meta.url), "utf8");
  assert.match(game, /narrow=!!window\.matchMedia\?\.\('\(max-width:850px\)'\)\.matches,rank=t=>t==='warn'\?2:t==='gold'\?1:0/);
  // 和 CSS 里只显示最后一条的那个断点一样
  const css = readFileSync(new URL("../dist/clarity.css", import.meta.url), "utf8");
  const i = css.indexOf("#toasts .toast:not(:last-child){display:none}");
  assert.ok(i > 0 && css.lastIndexOf("@media(max-width:850px)", i) > 0);
});

// ================= 22. 手机竖着拿打开菜单时的提示条 =================
test("on a phone held upright, the notice strip under a menu shows one notice instead of squeezing the first into a column", () => {
  const css = readFileSync(new URL("../dist/mend.css", import.meta.url), "utf8");
  assert.match(css, /@media \(max-width: 850px\) \{\s*#menu-toasts \.toast:not\(:last-child\) \{\s*display: none;/);
  // 场景里那条（只显示最后一条）本来就这样
  const clarity = readFileSync(new URL("../dist/clarity.css", import.meta.url), "utf8");
  assert.ok(clarity.includes("#toasts .toast:not(:last-child){display:none}"));
});

// ================= 15. 大屏手机横着拿 =================
test("large phones held sideways keep the small touch buttons in their own column instead of under 翻滚 / 使用 / 交互", () => {
  const css = readFileSync(new URL("../dist/mend.css", import.meta.url), "utf8");
  assert.match(css, /@media \(pointer: coarse\) and \(max-height: 500px\) and \(min-width: 851px\) \{\s*\.touch-extras \{\s*display: grid;/);
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.ok(html.indexOf('href="mend.css"') > html.indexOf('href="clarity.css"'), "loaded after the layout it fixes");
  assert.ok(html.indexOf('href="mend.css"') > html.indexOf('href="titan.css"'));
});

// ================= 16. 过了半夜才睡 =================
test("going to bed after midnight sleeps to 8 that morning instead of sleeping the whole day away", () => {
  const { e, toasts } = make();
  e.s.day = 12;
  e.s.minute = 2 * 60 + 30;
  e.s.player.hp = 40;
  e.s.player.stamina = 10;
  assert.equal(e.sleep(), true);
  assert.equal(e.s.day, 12, "the same day");
  assert.equal(e.s.minute, 8 * 60);
  assert.equal(e.s.player.hp, 75);
  assert.equal(e.s.player.stamina, e.maxSta());
  assert.ok(toasts.some((t) => t.text === MEND_TEXT.nap));
  // 晚上睡照旧睡到第二天 8 点
  e.s.minute = 22 * 60;
  assert.equal(e.mendNapOk(), false);
  assert.equal(e.sleep(), true);
  assert.equal(e.s.day, 13);
  assert.equal(e.s.minute, 8 * 60);
  // 尸潮打着：照原来的规矩不让睡
  e.s.minute = 60;
  e.s.horde.phase = "active";
  assert.equal(e.sleep(), false);
  e.s.horde.phase = "locked";
  if (e.dy) e.dy.pending = null;
  // 农舍那一页：这一觉睡到今天 8 点就写“睡到早上 8 点”——长夜刚过去的清晨也是（原来写“休息至次日”）
  e.s.minute = 2 * 60;
  assert.equal(e.napToday(), true);
  e.s.minute = 22 * 60;
  assert.equal(e.napToday(), false, "an evening sleep goes to tomorrow");
  e.s.minute = 5 * 60;
  e.ln.last = { held: true, end: e.s.day * 1440 + 4 * 60 };
  assert.equal(e.mendNapOk(), false, "after a long night its own nap applies");
  assert.equal(e.napToday(), true, "and the farmhouse still says 8 this morning");
  const game = readFileSync(new URL("../dist/game.js", import.meta.url), "utf8");
  assert.match(game, /engine\.napToday\?\.\(\)\?MEND_TEXT\.napNote/);
  assert.match(game, /engine\.napToday\?\.\(\)\?MEND_TEXT\.napButton/);
});

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
  // 两样东西挨着：照样让你选（不算它）
  const box2 = { ...box, id: "t-box2", x: at.x + 46, y: at.y + 6 };
  e.objects.push(box, box2);
  assert.equal(e.pickCandidates().length, 2);
  assert.ok(!e.pickCandidates().includes(dog));
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
test("when a save cannot be written for a reason other than a full browser, the page says so instead of telling you to clear the browser", () => {
  const game = readFileSync(new URL("../dist/game.js", import.meta.url), "utf8");
  assert.match(game, /catch\(err\)\{saveError=err\|\|null;/);
  assert.match(game, /function saveFull\(err\)\{/);
  assert.match(game, /\$\{saveFull\(saveError\)\?'浏览器的空间不够/);
  assert.match(MEND_TEXT.saveBad, /不要清理浏览器的数据/);
  assert.match(MEND_TEXT.saveBad, /\{why\}/);
  // 读不回来的原因（比如以前死了的感染者攒过 200 条）写进去
  const saveFull = new Function("err", game.match(/function saveFull\(err\)\{([\s\S]*?)\}\nfunction unstuckRow/)[1]);
  assert.equal(saveFull({ name: "QuotaExceededError", message: "The quota has been exceeded." }), true);
  assert.equal(saveFull(new Error("敌人数据损坏。")), false);
});

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
test("saves: nothing new is written; a v0.37 save loads as it was, and the version is 0.38.0 修缮", () => {
  const { e } = make();
  const text = e.serialize();
  const back = new Engine(Engine.parse(text), () => {});
  assert.deepEqual(Object.keys(JSON.parse(back.serialize())).sort(), Object.keys(JSON.parse(text)).sort());
  const v = readFileSync(new URL("../dist/version.js", import.meta.url), "utf8");
  assert.match(v, /GAME_VERSION='v0\.38\.0'/);
  assert.match(v, /GAME_EDITION='修缮'/);
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>余烬农场 v0\.38\.0 · 修缮<\/title>/);
});
