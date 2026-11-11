// v0.43.0「上手」：一物一用方案第三版——用得上的时候才出现、第一次见到的小卡、新档前三天的引导。
// 新开的档：第 1 天菜单里只有用得上的几格、菜单最上面一行没有士气；第一次走近一样东西、第一次建得起一样设施、菜单里第一次多出一格，
// 角上停一张小卡（不挡路、不停游戏，几秒后收起，每张只弹一次，设置里能关）；第 2、3 天早上一张小卡说今天先做什么。
// 旧档（v0.42 和以前的档、带着记忆重新开始的档）用过的都算见过：菜单都在，不弹小卡。这一层不改玩法的数、不碰随机数、不加存档键。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Engine, freshState, newGameState, newGamePlusState, needsUpgrade as needsStoryMigration } from "../dist/ahead.js";
import { Engine as TrimEngine, newGameState as trimNewGame, freshState as trimFresh } from "../dist/trim.js";
import { easeSay } from "../dist/ease.js";
import { JOBS, MANUAL_IDS } from "../dist/thief-data.js";
import { EVENTS as DAILY_EVENTS } from "../dist/daily-data.js";
import { EASE_SCHEMA, CARD_MS, CARD_QUEUE, GUIDE_DAYS, MENU_ALWAYS, MENU_IDS, CARD_TAG, CARD_NOW, MENU_FRESH, OBJ_CARD, PERSON_CARD, PERSON_TYPES, MORALE_CARD, GUIDE } from "../dist/ease-data.js";
import { MENUS, BCARD } from "../dist/simple-data.js";
import { BUILDINGS, ITEMS } from "../dist/data.js";
import { DECOR_LOOKS, DECOR_SPECIAL } from "../dist/trim-data.js";
import { GAME_VERSION, GAME_EDITION, GAME_RELEASE } from "../dist/version.js";

const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|Joja|祝尼魔|星之果实|\[object Object\]/;
const make = (state = newGameState("farmer")) => {
  const e = new Engine(state, () => {});
  e.paused = false;
  if (e.dy) e.dy.pending = null;
  return e;
};
// 一份 v0.42 的档（下面那一层的引擎做的，没有上手那一块）
const oldText = (day = 12) => {
  const o = new TrimEngine(trimNewGame("farmer"), () => {});
  o.s.day = day;
  o.s.minute = 600;
  if (o.feel?.open) o.feel.open.phase = "done";
  return o.serialize();
};
const mem = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
// 站到一样东西跟前
const standAt = (e, o) => Object.assign(e.s.player, { x: o.x, y: o.y + 26 });
const objOf = (e, type) => e.objects.find((o) => o.type === type);
// 假的页面：只有角上那张卡、页面最外层的 class、body 的 class
function fakeDoc() {
  const cls = new Set();
  const card = { hidden: true, innerHTML: "" };
  const body = { className: "" };
  return {
    card,
    body,
    cls,
    documentElement: { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)), contains: (c) => cls.has(c) } },
    querySelector: (s) => (s === "#ease-card" ? card : null),
  };
}

// ================= 版本 =================

// ================= 第 1 天：只有用得上的 =================

test("a menu tile appears once it can be used and stays; the first time it appears a card says so (the tiles a new game starts with say nothing)", () => {
  const e = make();
  assert.deepEqual(e.easeTick(), [], "the first look writes down what is there, quietly");
  assert.ok(e.ez.buildInit);
  assert.deepEqual(e.ez.shown.sort(), ["menu:build", "menu:craft"]);
  // 第一次有经验：技能；第一次收菜：成就册；第一条消息：消息；认识第一个人（或者救回麦穗）：人；去过别的地方：地图
  e.s.xp.agriculture = 2;
  e.s.stats.harvested = 1;
  e.o.log.push({ day: 1, text: "一条消息" });
  const cards = e.easeTick();
  assert.deepEqual(
    cards.map((c) => c.key),
    ["menu:collection", "menu:messages", "menu:skills"],
  );
  for (const c of cards) {
    assert.equal(c.tag, CARD_TAG.menu);
    assert.equal(c.now, CARD_NOW.menu);
    const m = MENUS[MENU_IDS.indexOf(c.key.slice(5))];
    assert.equal(c.name, m[0]);
    assert.ok(c.does && !DEV.test(c.does));
  }
  assert.deepEqual(e.easeTick(), [], "said once");
  // 用不上了也还在（出现过的不再收回去）
  e.s.xp.agriculture = 0;
  e.s.stats.harvested = 0;
  e.o.log.length = 0;
  assert.ok(["skills", "collection", "messages"].every((id) => e.easeMenuVisible(id)));
  // 人：麦穗救回来就有那一页（“人”那一页有麦穗的按钮）
  e.f.dog.rescued = true;
  assert.equal(e.easeMenuVisible("people"), true);
  assert.deepEqual(
    e.easeTick().map((c) => c.key),
    ["menu:people"],
  );
  // 地图：去过别的地方，或者过了前三天
  const f = make();
  f.easeTick();
  assert.equal(f.easeMenuVisible("map"), false);
  f.s.visited.ruins = true;
  assert.equal(f.easeMenuVisible("map"), true);
  const g = make();
  g.easeTick();
  g.s.day = GUIDE_DAYS + 1;
  assert.ok(g.easeTick().some((c) => c.key === "menu:map"));
});


// ================= 旧档 =================

// ================= 第一次见到的小卡 =================
test("the first time you walk up to something a card is queued; the same kind never again (also after a save and load); each person gets one", () => {
  const e = make();
  e.easeTick();
  const well = objOf(e, "well");
  standAt(e, well);
  assert.equal(e.nearestObject()?.type, "well");
  const c = e.easeLook();
  assert.ok(c);
  assert.equal(c.tag, CARD_TAG.seen);
  assert.equal(c.key, "well");
  assert.deepEqual([c.does, c.good], OBJ_CARD.well);
  assert.match(c.now, /^走近按交互：/);
  assert.ok(c.name && !DEV.test(c.name + c.does + c.good + c.now));
  assert.deepEqual(e.easeQueued(), [c]);
  assert.equal(e.easeLook(), null, "not twice");
  assert.equal(e.easeNextCard(), c);
  assert.equal(e.easeNextCard(), null);
  // 存档读回来：见过的还算见过
  const back = make(Engine.parse(e.serialize()));
  standAt(back, objOf(back, "well"));
  assert.equal(back.easeLook(), null);
  // 告示牌、农舍各一张
  for (const t of ["sign", "home"]) {
    standAt(back, objOf(back, t));
    assert.equal(back.nearestObject()?.type, t);
    const k = back.easeLook();
    assert.ok(k && k.key === t, t);
    assert.deepEqual([k.does, k.good], OBJ_CARD[t]);
  }
  // 设施：按种类记（同一种的第二座不再弹），卡上是建造页那两句
  const cook = e.s.buildings.find((b) => b.type === "cook") || (e.s.buildings.push({ id: "t-cook", type: "cook", x: 1000, y: 620, rotation: 0, hp: BUILDINGS.cook.hp }), e.s.buildings.at(-1));
  e.navRevision = (e.navRevision || 0) + 1;
  const near = { type: "building", building: cook, x: cook.x, y: cook.y };
  assert.equal(e.easeKey(near), "b:cook");
  const bc = e.easeCardFor(near, "b:cook");
  assert.deepEqual([bc.does, bc.good], BCARD.cook);
  // 人：一个人一张
  assert.equal(e.easeKey({ type: "resident", id: "farmer" }), "p:farmer");
  assert.notEqual(e.easeKey({ type: "resident", id: "medic" }), e.easeKey({ type: "resident", id: "farmer" }));
  assert.deepEqual([e.easeCardFor({ type: "resident", id: "farmer", name: "老周" }, "p:farmer").does, PERSON_CARD[1]], PERSON_CARD);
  // 认不得的东西不弹
  assert.equal(e.easeKey({ type: "somethingElse" }), "");
  assert.equal(e.easeKey(null), "");
});

test("cards wait in a short queue (four at most); what does not fit is not marked seen and comes back the next time", () => {
  const e = make();
  e.easeTick();
  for (let i = 0; i < CARD_QUEUE; i++) assert.ok(e.easePush({ key: "x" + i, tag: "", name: "x", does: "", good: "", now: "" }));
  assert.equal(e.easePush({ key: "x9" }), false);
  standAt(e, objOf(e, "well"));
  assert.equal(e.easeLook(), null);
  assert.ok(!e.ez.seen.includes("well"), "not marked while the queue is full");
  while (e.easeNextCard());
  assert.ok(e.easeLook(), "comes back when there is room");
  assert.ok(e.ez.seen.includes("well"));
});


// ================= 第一次建得起 =================
test("the first time a facility on the build page can be afforded a card says so (what a new game can already build says nothing; decor, removed and locked ones never)", () => {
  const e = make();
  const cards0 = e.easeTick();
  assert.deepEqual(cards0, []);
  const open = e.easeBuildable();
  for (const id of open) {
    assert.ok(!BUILDINGS[id].retired, id);
    assert.ok(![...DECOR_LOOKS, ...DECOR_SPECIAL].includes(id), id);
    assert.ok(!(BUILDINGS[id].tech && !e.c.technologies[BUILDINGS[id].tech]), id);
  }
  const already = [...e.ez.built];
  assert.ok(already.length > 0 && already.every((id) => e.afford(BUILDINGS[id].cost || {})));
  // 鸡舍：木材 12、石材 4
  assert.ok(open.includes("coop") && !already.includes("coop"));
  e.s.storage.wood = (e.s.storage.wood || 0) + 40;
  e.s.storage.stone = (e.s.storage.stone || 0) + 20;
  const cards = e.easeTick();
  const coop = cards.find((c) => c.key === "build:coop");
  assert.ok(coop, "能建了：鸡舍");
  assert.equal(coop.tag, CARD_TAG.build);
  assert.equal(coop.name, BUILDINGS.coop.name);
  assert.deepEqual([coop.does, coop.good], BCARD.coop);
  assert.equal(coop.now, CARD_NOW.build);
  assert.ok(cards.length <= CARD_QUEUE);
  while (e.easeNextCard());
  for (let i = 0; i < 6; i++) {
    e.easeTick();
    while (e.easeNextCard());
  }
  assert.ok(!e.easeTick().some((c) => c.key === "build:coop"), "once");
});

// ================= 前三天的早上 =================
test("days 2 and 3: from 06:00 a card says what to do first today (the story step from the journal) and one tip; once a day; not on day 1 or day 4", () => {
  const e = make();
  e.easeTick();
  e.s.minute = 7 * 60;
  assert.ok(!e.easeTick().some((c) => c.tag === CARD_TAG.day), "not on day 1");
  e.s.day = 2;
  e.s.minute = 5 * 60 + 50;
  assert.ok(!e.easeTick().some((c) => c.tag === CARD_TAG.day), "not before 06:00");
  e.s.minute = 6 * 60 + 5;
  const g = e.easeGuide();
  assert.ok(g && g.title, "the story step");
  assert.equal(g.title, e.storyGoal().step.title, "the same step as the journal's story card");
  const day2 = e.easeTick().find((c) => c.tag === CARD_TAG.day);
  assert.ok(day2);
  assert.equal(day2.name, GUIDE.day(2));
  assert.equal(day2.does, GUIDE.morning(g));
  assert.equal(day2.good, GUIDE.tip[2]);
  assert.equal(day2.now, GUIDE.where(g));
  assert.ok(!e.easeTick().some((c) => c.tag === CARD_TAG.day), "once");
  e.s.day = 3;
  assert.equal(e.easeTick().find((c) => c.tag === CARD_TAG.day)?.good, GUIDE.tip[3]);
  e.s.day = 4;
  assert.ok(!e.easeTick().some((c) => c.tag === CARD_TAG.day), "not on day 4");
  assert.equal(e.easeGuide(), null);
  assert.deepEqual(e.ez.mornings, [2, 3]);
  // 小卡关着：照样记下这天说过了
  const f = make();
  f.easeTick();
  f.easeCards(false);
  f.s.day = 2;
  f.s.minute = 7 * 60;
  assert.deepEqual(f.easeTick(), []);
  assert.deepEqual(f.ez.mornings, [2]);
});

// ================= 任务手记 =================

// ================= 角上的小卡怎么停 =================

// ================= 存档 =================

// ================= 不碰玩法的数 =================

// ================= 字 =================

// ================= 说错了的几条提示 =================


// ================= 跟着手记走 =================
test("a bot that only follows the journal's story card finishes the first part of the main story within three days, never needing a menu tile that is not there", () => {
  const r = spawnSync(process.execPath, [new URL("../scripts/guide-bot.mjs", import.meta.url).pathname, "1,2", "3"], { encoding: "utf8", timeout: 120000 });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.match(r.stdout, /合计：2 个种子，2 个照手记走通/);
  assert.doesNotMatch(r.stdout, /✗/);
  assert.match(r.stdout, /主线第一段 d[1-3] \d\d:\d\d/);
  assert.match(r.stdout, /小卡 d1 \d\d:\d\d 第一次见到：/);
  assert.match(r.stdout, /小卡 d2 \d\d:\d\d 前三天：第 2 天/);
});
