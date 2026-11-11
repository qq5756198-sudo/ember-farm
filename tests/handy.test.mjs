// v0.45.0「顺手」：新开局的第一个小时——开局先教打架再派出门、建造页和设施页只列用得上的（手记要的排第一并默认选中）、
// 场景的字不互相挡、过时的小卡不弹、去掉的东西不再露字、一样东西一个叫法、早上一页说完（昨天的总结、今日抉择、前三天的“今天先做”）。
// 这一层只改开局那一拨来的时候，别的玩法的数不动；存档不加东西。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Engine, freshState, newGameState, needsUpgrade as needsStoryMigration } from "../dist/ahead.js";
import { Engine as EaseEngine, newGameState as easeNewGame } from "../dist/ease.js";
import { Engine as HandyEngine, handySay, needsUpgrade as handyNeedsUpgrade, freshState as handyFresh } from "../dist/handy.js";
import { EARLY_WAVE_MIN, ROAD, OPEN_STEP, SAY_WAVE, SAY_GO, HANDY_SAY, MENU_MSG, FARMER_ORIGIN, FENCE_CARD, EXIT_LABEL, CARD_STALE, PAGE, FIRST_DAYS, FOOT, GHOST_HINT, PURPOSE_EARLY } from "../dist/handy-data.js";
import { OPENING } from "../dist/feel-data.js";
import { ORIGINS } from "../dist/longnight-data.js";
import { MENUS, BCARD } from "../dist/simple-data.js";
import { BUILDINGS, RECIPES } from "../dist/data.js";
import { EVENTS as DAILY_EVENTS } from "../dist/daily-data.js";
import { LESSONS } from "../dist/guidance-data.js";
import { GAME_VERSION, GAME_EDITION, GAME_RELEASE } from "../dist/version.js";
import { Renderer as HandyRenderer } from "../dist/handy-renderer.js";
import { Renderer as FourRenderer } from "../dist/four-renderer.js";
import { Renderer as CampaignRenderer } from "../dist/campaign-renderer.js";

const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|Joja|祝尼魔|星之果实|\[object Object\]/;
const make = (state = newGameState("farmer"), said = []) => {
  const e = new Engine(state, (t) => said.push(t));
  e.paused = false;
  if (e.dy) e.dy.pending = null;
  return e;
};
// 第一段做完、回信（10:00）
function replied(said = []) {
  const e = make(newGameState("farmer"), said);
  e.s.minute = 600;
  e.r.claimed.push("harvest", "meal");
  e.sc.flags.well = true;
  e.sc.flags.camp = true;
  assert.equal(e.replyReason(), "");
  assert.ok(e.replyAlliance());
  return e;
}
const tick = (e, sec) => {
  for (let i = 0; i < Math.round(sec / 0.05); i++) e.update(0.05, {});
};
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const btn = (action, id = "") => ({ dataset: { action, id } });

// ================= 版本、层 =================

// ================= 开局先教打架再派出门 =================
test("the opening wave comes 20 game minutes after the reply instead of waiting for 13:00; without a reply it still waits for 13:00", () => {
  const e = replied();
  e.chooseSupply("ration");
  const t0 = e.s.minute;
  tick(e, ((EARLY_WAVE_MIN - 2) / 1.6) * 1);
  assert.equal(e.feel.open.phase, "wait", "not yet");
  tick(e, 4);
  assert.equal(e.feel.open.phase, "fight");
  assert.ok(e.s.minute < OPENING.at, "well before 13:00");
  assert.ok(e.s.minute - t0 >= EARLY_WAVE_MIN);
  assert.equal(e.storyGoal().step.title, OPEN_STEP.fight.title);
  assert.match(e.storyGoal().step.text, /按 X 推开/);
  // 没回信：照旧等到 13:00
  const f = make();
  f.s.minute = 700;
  tick(f, 30);
  assert.equal(f.feel.open.phase, "wait");
  f.s.minute = OPENING.at;
  tick(f, 0.2);
  assert.equal(f.feel.open.phase, "fight");
});
test("an old save whose opening is long done replies the old way (residential marked at once), only the name is the map's", () => {
  const said = [];
  const e = make(newGameState("farmer"), said);
  e.feel.open.phase = "done";
  e.s.minute = 600;
  e.r.claimed.push("harvest", "meal");
  e.sc.flags.well = true;
  e.sc.flags.camp = true;
  assert.ok(e.replyAlliance());
  assert.equal(e.guidance.target.region, "residential");
  assert.ok(said.includes("小柒：废弃居民区的求援信号已标在地图上。"));
  assert.ok(!said.includes(SAY_WAVE));
});

// ================= 建造页、设施页、农舍页 =================

// ================= 早上一页 =================

// ================= 过时的小卡 =================
test("a queued corner card that's gone stale isn't shown: walked away (told again next time), a night passed, the thing is gone or already built", () => {
  const e = make();
  assert.ok(e.easeFresh());
  e.easeTick();
  const well = e.objects.find((o) => o.type === "well"),
    home = e.objects.find((o) => o.type === "home");
  // 走近水井、再走近农舍：两张排队
  Object.assign(e.s.player, { x: well.x, y: well.y + 26 });
  assert.ok(e.easeLook());
  Object.assign(e.s.player, { x: home.x, y: home.y + 26 });
  assert.ok(e.easeLook());
  assert.equal(e.easeQueued().length, 2);
  // 人还在农舍边上：水井那张轮到时人已经走远了——不弹，下回走近再说
  const first = e.easeNextCard();
  assert.equal(first.key, "home");
  assert.ok(!e.ez.seen.includes("well"), "the well card will come again");
  assert.ok(e.ez.seen.includes("home"));
  // 过了一夜：昨天排着的不说了
  Object.assign(e.s.player, { x: well.x, y: well.y + 26 });
  assert.ok(e.easeLook());
  e.s.day += 1;
  assert.equal(e.easeNextCard(), null);
  // 能建了的卡：已经建了就不说
  e.s.day -= 1;
  const card = { key: "build:fence", tag: "能建了", name: "围栏", does: "", good: "", now: "" };
  assert.ok(e.easePush(card));
  e.s.buildings.push({ id: "bX", type: "fence", x: 100, y: 100, hp: 60 });
  assert.equal(e.easeNextCard(), null);
  // 等太久的不弹
  Object.assign(e.s.player, { x: well.x, y: well.y + 26 });
  e.ez.seen = e.ez.seen.filter((k) => k !== "well");
  assert.ok(e.easeLook());
  e._ezq[0]._hy.t -= CARD_STALE.ms + 1;
  assert.equal(e.easeNextCard(), null);
});

// ================= 叫法、去掉的东西 =================
test("the exit in a ruin says it leads home or elsewhere, and opens the map with the farm already picked", () => {
  const e = make();
  e.feel.open.phase = "done";
  e.travel("residential");
  assert.equal(e.s.region, "residential");
  const ex = e.objects.find((o) => o.type === "exit");
  assert.equal(e.simpleLabel(ex), EXIT_LABEL);
  Object.assign(e.s.player, { x: ex.x, y: ex.y });
  const n0 = e.events.length;
  e.emit("menu", { menu: "map" });
  assert.equal(e.events.slice(n0).find((v) => v.type === "menu").selected, "farm");
});

// ================= 场景的字 =================
function layoutOf(entries, over = []) {
  const r = Object.create(HandyRenderer.prototype);
  r.canvas = { width: 1366, height: 594 };
  r.dpr = 1;
  r.time = 0;
  r.hySafe = () => ({ top: 6, bottom: 6 });
  r.hyOverlays = () => over;
  const m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  r._hyQ = entries.map((x, i) => ({ kind: "badge", size: 12, center: true, m, i, dx: 0, dy: 0, drop: false, pri: 1, ...x }));
  r.hyLayout();
  return r;
}
test("scene words: overlapping words move up a line, the same words close together are written once, small ground words with no room are dropped, the near label stays put", () => {
  const r = layoutOf([
    { label: "联盟终端 · 读来信", x: 500, y: 300, pri: 3 },
    { label: "目标：援建营地 · 22步", x: 505, y: 302, pri: 2 },
    { label: "农田", x: 520, y: 300, pri: 0 },
    { label: "+35 金", x: 700, y: 2, kind: "text" },
    { label: "农田", x: 900, y: 200, pri: 0 },
    { label: "农田", x: 930, y: 205, pri: 0 },
  ]);
  const [near, goal, field, coin, a, b] = r._hyQ;
  assert.equal(near.dy, 0);
  assert.ok(goal.dy < 0, "the gold mark's words step up off the near label");
  assert.ok(field.drop, "a ground word under both is dropped");
  assert.ok(coin.dy > 0, "the coin float stays inside the picture");
  assert.ok(!a.drop && b.drop, "two 农田 side by side: written once");
  assert.equal(r._hyLast.dropped, 2);
});
test("scene words: the near label steps away from a toast or card laid over the picture", () => {
  const r = layoutOf([{ label: "农田 · 播种", x: 500, y: 520, pri: 3 }], [{ x: 380, y: 510, w: 640, h: 60 }]);
  assert.ok(r._hyQ[0].dy < 0);
});
test("untilled ground draws as a light, dashed patch with tufts; tilled soil keeps its sprite", () => {
  const ops = [];
  const r = Object.create(HandyRenderer.prototype);
  Object.defineProperty(r, "v", { value: true });
  r.ctx = { fillRect: (...a) => ops.push(a), set fillStyle(v) { ops.push(["style", v]); } };
  r.drawPlot({ x: 100, y: 100, tilled: false, id: 1 }, { plotWatered: () => false });
  assert.ok(ops.some((o) => o[0] === "style" && /^rgba\(170,140,92/.test(o[1])));
  assert.ok(ops.filter((o) => typeof o[0] === "number").length > 20);
});

// ================= 存档 =================
test("saves: nothing new is written by this layer; an old v0.44 save loads and saves back byte for byte the same", () => {
  const o = new EaseEngine(easeNewGame("farmer"), () => {});
  o.s.day = 12;
  o.s.minute = 600;
  const text = o.serialize();
  assert.equal(handyNeedsUpgrade(text), false);
  // 读进来、存出去：和上手那一层的引擎一字不差（v0.46 起最上面一层另加了自己的一块，那是它的事）
  const a = new EaseEngine(EaseEngine.parse(text), () => {}).serialize(),
    b = new HandyEngine(HandyEngine.parse(text), () => {}).serialize();
  assert.equal(b, a);
  assert.equal(new HandyEngine(HandyEngine.parse(b), () => {}).serialize(), b);
  const s = handyFresh();
  assert.deepEqual(Object.keys(s).sort(), Object.keys(new EaseEngine(undefined, () => {}).s).sort());
});
