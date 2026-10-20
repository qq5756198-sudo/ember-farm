import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState } from "../dist/campaign.js";
import { Engine as OutpostEngine, freshState as outpostFresh } from "../dist/outpost.js";
import { TASKS } from "../dist/rebuild-data.js";
import { ITEMS, BUILDINGS, RECIPES } from "../dist/data.js";
import { TERMINAL_SPOT } from "../dist/alliance-data.js";
import { MEAL_ITEMS } from "../dist/outpost-data.js";
import {
  WINTER,
  HEAT,
  DECREES,
  DECREE_SLOTS,
  PROGRAMS,
  NOISE_LIMIT,
  GE_COST,
  ALAN_FEED,
  SUYAN_COST,
  WSPOTS,
  SHOWCASES,
} from "../dist/winter-data.js";
import { winterSteps } from "../dist/winter-story.js";
import {
  renderWinterView,
  renderWinterJournal,
  renderRebuildPlus,
  renderAtlasPlus,
  handleWinterAction,
  alertItems,
  alertBar,
  winterHud,
  collectionRows,
  winterTitle,
} from "../dist/winter-ui.js";
import { campaignHud, handleCampaignAction, renderCampaignView } from "../dist/campaign-ui.js";
import { renderOutpost } from "../dist/outpost-ui.js";

const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN/;
const make = (state = freshState()) => {
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
const at = (e, spot, dy = 20) => {
  go(e, spot.region || "farm");
  Object.assign(e.s.player, { x: spot.x, y: spot.y + dy });
};
const home = (e) => at(e, { x: 830, y: 460 });
const hour = (e, h) => {
  e.s.minute = h * 60 - 0.5;
  e.c.workClock = 59.5;
  e.advanceMinutes(1);
};
// 跨到下一天的 00:01（会经过午夜结算）。
const nextDay = (e) => {
  e.s.minute = 1440 - 0.5;
  e.c.workClock = 0;
  e.advanceMinutes(1);
};
const snapshot = (e) => JSON.stringify([e.s.inventory, e.s.storage, e.s.money, e.s.winter]);
const ctx = (e, extra = {}) => ({
  engine: e,
  ui: {},
  rebuildUI: {},
  showMenu() {},
  closeMenu() {},
  renderMenu() {},
  save() {},
  toast() {},
  ...extra,
});
const claimUpTo = (e, id) => {
  e.r.claimed = TASKS.slice(0, TASKS.findIndex((t) => t.id === id) + 1).map((t) => t.id);
};
// 只改进度字段：模拟已经走到第 n 段开头的存档。
function toAct(e, n) {
  const sc = e.sc;
  sc.act = n;
  sc.claimed = ["act1", "supply", "act2", ...[3, 4, 5, 6, 7].filter((k) => k < n).map((k) => "act" + k)];
  sc.choice = "ration";
  sc.letters = ["act1", "act2", ...[3, 4, 5, 6, 7, 8].filter((k) => k <= n).map((k) => "act" + k)];
  sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true;
  sc.camp = { x: 560, y: 735 };
  claimUpTo(e, n >= 8 ? "broadcast" : "radio");
  e.r.radio = true;
  Object.assign(e.o, {
    hospital: "water",
    youke: true,
    lathe: { mode: "parts", day: 0 },
    cargo: "food",
    convoy: { departs: 0, arrives: 10, escorted: true, spawned: true, foes: [], done: true, lost: false },
    toll: "refuse",
  });
  e.o.raid.phase = "won";
  if (n >= 8) {
    Object.assign(e.w, { forecast: true, forecastDay: 1 });
    Object.assign(e.w.winter, { phase: "done", prepDay: 1, coldDay: 3, endDay: 6, priority: "food" });
  }
  e.assignRegion();
}
// 在 near 附近找一块真能放的空地，用正常的建造流程放下。
function place(e, type, near) {
  home(e);
  e.buildMode = type;
  for (let r = 40; r < 500; r += 16)
    for (let a = 0; a < 6.28; a += 0.25) {
      const x = Math.round((near.x + Math.cos(a) * r) / 8) * 8,
        y = Math.round((near.y + Math.sin(a) * r) / 8) * 8;
      // v0.38：建东西不能罩住自己，人站在外框下边一点
      Object.assign(e.s.player, { x, y: y + Math.max(40, e.buildingRect(type, x, y).h / 2 + 24) });
      if (!e.buildReason(type, x, y)) {
        assert.equal(e.placeBuilding(x, y), true, "placing " + type);
        e.buildMode = null;
        return e.s.buildings.at(-1);
      }
    }
  throw Error("no spot for " + type);
}
const stock = (e, items) => {
  for (const [k, v] of Object.entries(items)) e.s.storage[k] = (e.s.storage[k] || 0) + v;
};
const point = (e, id, key) => {
  e.b.points[id] = { count: 1, flags: { [key]: true }, days: {}, choice: null, readyDay: 0 };
};
// 有了预报和火炉后进入准备期。
function startWinter(e) {
  toAct(e, 7);
  at(e, TERMINAL_SPOT);
  assert.equal(e.contactFrost(), true);
  stock(e, { wood: 40, stone: 20, scrap: 20, bread: 40 });
  place(e, "stove", { x: 430, y: 520 });
  hour(e, 9);
  assert.equal(e.w.winter.phase, "prep");
}

// ---------- 存档 ----------
test("new saves carry winter defaults and a v0.15-or-later version", async () => {
  const { e } = make();
  assert.equal(e.w.schema, 1);
  assert.equal(e.w.winter.phase, "none");
  assert.deepEqual(e.w.decrees, []);
  assert.equal(e.ladderLevel() >= 0, true);
  const v = await import("../dist/version.js");
  assert.match(v.GAME_VERSION, /^v0\.(1[5-9]|[2-9]\d)\.\d+$/, "later rounds keep a newer explicit version");
  assert.ok(v.GAME_EDITION.length > 0);
  const back = Engine.parse(e.serialize());
  assert.deepEqual(back.winter, JSON.parse(e.serialize()).winter);
});

test("a v0.14 outpost save without winter data loads unchanged and gains empty winter state", () => {
  const old = new OutpostEngine(outpostFresh(), () => {});
  old.s.money = 321;
  old.o.caravan.visits = 2;
  const text = old.serialize();
  assert.equal(JSON.parse(text).winter, undefined);
  const s = Engine.parse(text);
  assert.equal(s.money, 321);
  assert.equal(s.outpost.caravan.visits, 2);
  assert.equal(s.winter.winter.phase, "none");
  const { e } = make(s);
  assert.equal(e.w.museum.built, false);
  assert.equal(Engine.parse(e.serialize()).money, 321);
});

test("corrupted or inconsistent winter fields are refused with a recoverable message", () => {
  const { e } = make();
  startWinter(e);
  const text = e.serialize();
  const broken = [
    (s) => (s.winter.schema = 2),
    (s) => (s.winter.extra = 1),
    (s) => (s.winter.decrees = ["rotation", "rotation"]),
    (s) => (s.winter.decrees = ["gold"]),
    (s) => (s.winter.ladder = 7),
    (s) => (s.winter.winter.phase = "spring"),
    (s) => (s.winter.winter.priority = "luck"),
    (s) => (s.winter.radio.noise = -3),
    (s) => (s.winter.ge.phase = "king"),
    (s) => (s.winter.museum.photos = ["x"]),
    (s) => (s.winter.caught = ["dragon"]),
    (s) => (s.winter.assault.phase = "lost"),
    (s) => (s.winter.forecast = false),
    (s) => (s.winter.mealLog = [{ day: 1, types: ["gold"] }]),
  ];
  for (const change of broken) {
    const s = JSON.parse(text);
    change(s);
    assert.throws(() => Engine.parse(JSON.stringify(s)), /寒潮存档异常/);
  }
});

// ---------- 法令簿 ----------
test("decree slots grow with the story, changes have a two-day cooldown and full slots are refused", () => {
  const { e, toasts } = make();
  assert.equal(e.decreeSlots(), DECREE_SLOTS(1));
  toAct(e, 7);
  assert.equal(e.decreeSlots(), 4);
  assert.equal(e.toggleDecree("rotation"), true);
  assert.equal(e.decree("rotation"), true);
  assert.equal(e.toggleDecree("curfew"), false, "cooldown blocks a second change the same day");
  assert.match(toasts.at(-1).text, /第\d+天才能再改/);
  e.s.day += 2;
  for (const id of ["curfew", "kitchen", "patrol"]) {
    e.w.decreeDay = 0;
    assert.equal(e.toggleDecree(id), true);
  }
  e.w.decreeDay = 0;
  assert.equal(e.toggleDecree("salvage"), false, "four slots are full");
  assert.match(e.decreeReason("salvage"), /法令位已满/);
  assert.equal(e.toggleDecree("rotation"), true, "revoking frees a slot");
  assert.equal(e.decree("rotation"), false);
  assert.equal(e.toggleDecree("nonsense"), false);
});

test("ration cards make two people share a portion and cost morale; the ladder stops at hungry", () => {
  const { e } = make();
  toAct(e, 7);
  e.recruit("farmer");
  e.addHelper("tieqiao");
  const morale = e.resident("farmer").morale;
  stock(e, { bread: 10 });
  // 同样的营地不发配给卡，用来对照
  const { e: plain } = make(JSON.parse(e.serialize()));
  plain.paused = false;
  e.toggleDecree("ration");
  const before = e.s.storage.bread;
  hour(e, 18);
  hour(plain, 18);
  assert.equal(e.o.missed.length, 0);
  assert.equal(before - e.s.storage.bread, before - plain.s.storage.bread - 1, "two eaters shared one portion at dinner");
  assert.equal(e.ladderChecks()[0], false, "rationing never counts as fed");
  nextDay(e);
  assert.ok(e.resident("farmer").morale <= morale - 3);
});

test("the public kitchen burns a log at dinner and counts two meal types as eating well", () => {
  const { e } = make();
  toAct(e, 7);
  e.recruit("farmer");
  e.addHelper("tieqiao");
  stock(e, { bread: 4, jam: 4, wood: 3 });
  e.toggleDecree("kitchen");
  const wood = e.qty("wood", true);
  hour(e, 18);
  assert.equal(e.qty("wood", true), wood - 1);
  assert.deepEqual(new Set(e.w.mealLog[0].types), new Set(["bread", "jam"]), "dinner rotates meal types");
  assert.equal(e.ladderChecks()[1], true);
});

test("double patrol speeds guards and adds defence; curfew gives raids and hordes 30 more seconds", () => {
  const { e } = make();
  toAct(e, 7);
  const base = e.guardCooldown(),
    power = e.raidPower();
  e.toggleDecree("patrol");
  assert.ok(e.guardCooldown() < base);
  assert.equal(e.raidPower(), power + 2);
  e.w.decreeDay = 0;
  e.toggleDecree("curfew");
  home(e);
  e.s.horde.phase = "warning";
  e.s.horde.timer = 20;
  e.update(0.016, {});
  assert.ok(e.s.horde.timer > 45);
  const t = e.s.horde.timer;
  e.update(0.016, {});
  assert.ok(e.s.horde.timer < t, "the bonus is applied once per horde");
});

test("salvage brings scrap at 06:00 and overtime speeds production but tires residents", () => {
  const { e } = make();
  toAct(e, 7);
  e.addHelper("tieqiao");
  e.toggleDecree("salvage");
  const scrap = e.s.storage.scrap || 0;
  hour(e, 6);
  assert.equal(e.s.storage.scrap, scrap + 2);
  const plain = e.efficiency();
  e.w.decreeDay = 0;
  e.toggleDecree("overtime");
  assert.ok(e.efficiency() >= plain + 0.25 - 1e-9);
});

// ---------- 生活水准 ----------
test("living standard climbs rung by rung and each rung speeds production by 5%", () => {
  const { e } = make();
  toAct(e, 7);
  e.recruit("farmer");
  stock(e, { bread: 3, jam: 3, beanMeal: 3 });
  for (let d = 0; d < 3; d++) {
    hour(e, 18);
    nextDay(e);
  }
  const checks = e.ladderChecks();
  assert.equal(checks[0], true);
  assert.equal(checks[1], true, "three dinners rotated through three meal types");
  assert.equal(e.ladderLevel() >= 2, true);
  // 房间：地板 + 椅子 + 灯
  e.s.buildings.push(
    { id: "bf", type: "floor", x: 600, y: 600, rotation: 0, hp: 100, open: false },
    { id: "bc", type: "chair", x: 620, y: 600, rotation: 0, hp: BUILDINGS.chair.hp, open: false },
    { id: "bl", type: "lamp", x: 580, y: 610, rotation: 0, hp: BUILDINGS.lamp.hp, open: false },
  );
  // v0.28：第 3 级要一间舒适度 3 以上的房间——椅子、灯只有 2 分，再摆一张餐桌
  assert.equal(e.ladderChecks()[2], false, "a bare room (comfort 2) is not enough since v0.28");
  e.s.buildings.push({ id: "bt", type: "table", x: 600, y: 640, rotation: 0, hp: BUILDINGS.table.hp, open: false });
  assert.equal(e.ladderChecks()[2], true);
  e.w.radio.day = e.s.day;
  assert.equal(e.ladderLevel(), 4);
  e.w.ladder = 4;
  assert.ok(Math.abs(e.efficiency() - 1.2) < 1e-9);
});

// ---------- 电台节目 ----------
test("radio programs air once at 21:00, cost noise and can draw infected to the farm", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  e.recruit("farmer");
  e.resident("farmer").morale = 50;
  assert.equal(e.chooseProgram("songs"), true);
  assert.equal(e.chooseProgram("news"), false, "one program per night");
  hour(e, 21);
  assert.equal(e.w.radio.aired, 1);
  assert.equal(e.c.residents[0].morale, 55);
  // v0.28：节目的动静记在营地的动静表上（电台自己的计数不再用），0 点结算
  assert.equal(e.w.radio.noise, 0);
  assert.equal(e.hn.noise.v, PROGRAMS.songs.noise);
  assert.match(e.programReason("lesson"), /播完|已过/);
  nextDay(e);
  assert.equal(e.hn.noise.v, PROGRAMS.songs.noise / 2, "below 4 the noise halves at midnight");
  e.hn.noise.v = NOISE_LIMIT - 1;
  home(e);
  const before = e.enemies.length;
  e.chooseProgram("missing");
  hour(e, 21);
  assert.equal(e.enemies.length, before, "nothing comes at 21:00 any more");
  assert.equal(e.o.visitors.next, e.s.day + 1);
  assert.equal(e.w.radio.forceHonest, true);
  nextDay(e);
  assert.equal(e.enemies.filter((z) => z.hnNoise && !z.dead).length, 3, "noise 4+ brings 3 infected at midnight");
  assert.ok(toasts.some((t) => /动静把感染者引来了/.test(t.text)));
  assert.equal(e.hn.noise.v, 0, "an attack clears the meter");
});

test("radio silence halves both noise and effect", () => {
  const { e } = make();
  toAct(e, 7);
  e.toggleDecree("silence");
  const xp = e.s.skills?.agriculture?.xp ?? null;
  e.chooseProgram("lesson");
  hour(e, 21);
  assert.equal(e.hn.noise.v, PROGRAMS.lesson.noise * 0.5);
  if (xp !== null) assert.ok(e.s.skills.agriculture.xp > xp);
});

// ---------- 霜降 ----------
test("the forecast needs the repaired radio at the terminal and gives rye seeds once", () => {
  const { e } = make();
  toAct(e, 7);
  e.r.radio = false;
  at(e, TERMINAL_SPOT);
  assert.equal(e.contactFrost(), false);
  e.r.radio = true;
  home(e);
  assert.equal(e.contactFrost(), false, "must stand at the terminal");
  at(e, TERMINAL_SPOT);
  const seeds = e.s.storage.seedRye || 0;
  assert.equal(e.contactFrost(), true);
  assert.equal(e.s.storage.seedRye, seeds + 6);
  assert.equal(e.contactFrost(), false);
  assert.equal(e.s.storage.seedRye, seeds + 6);
  assert.equal(e.storyGoal().step.id, "warmth");
});

test("a clear night after the forecast brings a meteor shower; the soup recipe is claimed once", () => {
  const { e } = make();
  toAct(e, 7);
  at(e, TERMINAL_SPOT);
  e.contactFrost();
  const soup = RECIPES.find((r) => r.id === "warmSoup");
  assert.match(e.recipeReason(soup), /流星夜/);
  e.s.day += 1;
  e.s.weather = "晴朗";
  hour(e, 21);
  assert.equal(e.meteorTonight(), true);
  assert.match(e.context(e.nearestObject()), /流星/);
  e.interact();
  assert.equal(e.w.meteor.claimed, true);
  assert.equal(e.s.storage.warmSoup, 2);
  assert.equal(e.claimMeteor(), false);
  assert.equal(e.s.storage.warmSoup, 2);
  assert.notEqual(e.recipeReason(soup), "需要霜降在流星夜念给你的配方");
  assert.ok(MEAL_ITEMS.includes("warmSoup"));
});

// ---------- 寒潮 ----------
test("forecast plus a heat source starts preparation; the cold arrives, burns wood and ends on schedule", () => {
  const { e, toasts } = make();
  startWinter(e);
  const wi = e.w.winter;
  assert.equal(wi.coldDay, e.s.day + WINTER.prepDays);
  assert.equal(e.w.ge.phase, "arrived");
  assert.equal(e.w.alan.phase, "here");
  assert.equal(e.storyGoal().step.id, "priority");
  e.chooseStory("priority", "engineering");
  const wood = e.s.storage.wood;
  nextDay(e);
  hour(e, 6);
  assert.equal(wi.lit, true);
  assert.ok(e.s.storage.wood <= wood - 1 + 2, "the stove burns a log a day under engineering priority");
  e.s.day = wi.coldDay;
  hour(e, 6);
  assert.equal(wi.phase, "cold");
  assert.ok(toasts.some((t) => /寒潮来了/.test(t.text)));
  e.s.storage.wood = 0;
  delete e.s.inventory.wood;
  e.s.day++;
  hour(e, 6);
  assert.equal(wi.lit, false, "no wood, no fire");
  assert.equal(e.heatSources().some((h) => h.kind === "stove"), false);
  e.s.day = wi.endDay;
  hour(e, 6);
  assert.equal(wi.phase, "done");
  assert.equal(wi.lit, false);
});

test("in the cold, crops outside warm zones crawl and the player starves faster without a warm coat", () => {
  const { e } = make();
  startWinter(e);
  e.chooseStory("priority", "medicine");
  e.w.winter.phase = "cold";
  const plot = e.s.plots[0] || { x: 1300, y: 900 };
  const far = { ...plot, x: 1400, y: 950 };
  const rate = e.cropGrowthRate(far);
  e.w.winter.phase = "done";
  const normal = e.cropGrowthRate(far);
  e.w.winter.phase = "cold";
  assert.ok(Math.abs(rate - normal * WINTER.cropCold) < 1e-9);
  at(e, { x: 1350, y: 900 });
  assert.equal(e.playerCold(), true);
  e.s.player.hunger = 80;
  e.update(1, {});
  const coldDrop = 80 - e.s.player.hunger;
  // v0.22：保暖看身上穿的（保温衣 4 点），光放在背包里不算
  e.s.inventory.warmCoat = 1;
  assert.equal(e.playerCold(), true);
  assert.ok(e.equip("warmCoat"));
  assert.equal(e.playerCold(), false);
  e.s.player.hunger = 80;
  e.update(1, {});
  const warmDrop = 80 - e.s.player.hunger;
  assert.ok(coldDrop > warmDrop * 1.3, "cold drains ~40% faster");
  delete e.s.inventory.warmCoat;
  const stove = e.s.buildings.find((b) => b.type === "stove");
  e.w.winter.lit = true;
  Object.assign(e.s.player, { x: stove.x + 40, y: stove.y + 40 });
  assert.equal(e.playerCold(), false, "standing by a lit stove is warm");
});

test("an unheated camp catches a chill each cold morning unless medicine comes first", () => {
  const { e } = make();
  startWinter(e);
  e.addHelper("tieqiao");
  e.w.winter.phase = "cold";
  e.w.winter.fuelDay = e.s.day + 1;
  e.s.day++;
  e.w.winter.fuelDay = e.s.day;
  hour(e, 6);
  assert.equal(e.o.sick, e.s.day, "the brazier alone cannot heat the camp overnight");
  assert.equal(e.ladderChecks()[2], false);
  const { e: e2 } = make();
  startWinter(e2);
  e2.chooseStory("priority", "medicine");
  e2.addHelper("tieqiao");
  e2.w.winter.phase = "cold";
  e2.s.day++;
  e2.w.winter.fuelDay = e2.s.day;
  hour(e2, 6);
  assert.notEqual(e2.o.sick, e2.s.day);
});

test("warm coats are craftable from wool or cloth; the stove shows its warm range when building", () => {
  assert.ok(BUILDINGS.stove && ITEMS.warmCoat && ITEMS.remedy && ITEMS.wool);
  assert.ok(RECIPES.some((r) => r.id === "warmCoatWool" && r.cost.wool === 2));
  assert.ok(RECIPES.some((r) => r.id === "warmCoatCloth" && r.cost.cloth === 4));
  assert.equal(HEAT.stove, 220);
});

// ---------- 葛队长 ----------
test("葛队长 warns after two poor dinners, leaves two days later, and returns to calm if the camp improves", () => {
  const { e, toasts } = make();
  startWinter(e);
  e.chooseStory("priority", "food");
  const g = e.w.ge;
  assert.ok(e.eaters().some((x) => x.key === "g:ge" && x.meals === 6));
  hour(e, 18);
  nextDay(e);
  hour(e, 18);
  assert.equal(g.phase, "warned");
  assert.ok(toasts.some((t) => /两天，再这样/.test(t.text)));
  // 生活水准到第三级就安心
  const { e: calm } = make(JSON.parse(e.serialize()));
  calm.w.ladder = 3;
  calm.ladderLevel = () => 3;
  calm.geDinner();
  assert.equal(calm.w.ge.phase, "arrived");
  nextDay(e);
  hour(e, 18);
  nextDay(e);
  hour(e, 18);
  assert.equal(g.phase, "left");
  assert.equal(e.storyGoal().step.id, "cold");
});

test("persuading 葛队长 needs living standard three; escorting costs bread and gives reputation", () => {
  const { e } = make();
  startWinter(e);
  e.chooseStory("priority", "food");
  const before = snapshot(e);
  assert.ok(e.ladderLevel() < 3);
  assert.equal(e.chooseStory("ge", "persuade"), false);
  assert.equal(snapshot(e), before);
  for (const k of Object.keys(GE_COST)) {
    e.s.storage[k] = 0;
    delete e.s.inventory[k];
  }
  assert.equal(e.chooseStory("ge", "escort"), false, "not enough bread");
  stock(e, GE_COST);
  const rep = e.c.reputation ?? 0;
  assert.equal(e.chooseStory("ge", "escort"), true);
  assert.equal(e.w.ge.phase, "escorted");
  assert.ok((e.c.reputation ?? 0) >= rep + 5 || rep === undefined);
  assert.equal(e.chooseStory("ge", "escort"), false, "only once");
  const { e: e2 } = make();
  startWinter(e2);
  e2.ladderLevel = () => 3;
  assert.equal(e2.decideGe("persuade"), true);
  assert.equal(e2.w.ge.phase, "stayed");
  assert.ok(e2.efficiency() >= 1.1 - 1e-9);
});

// ---------- 阿兰 ----------
test("feeding 阿兰's flock leaves two sheep that eat beans and give wool every two days", () => {
  const { e } = make();
  startWinter(e);
  for (const k of Object.keys(ALAN_FEED)) {
    e.s.storage[k] = 0;
    delete e.s.inventory[k];
  }
  assert.equal(e.feedAlan("feed"), false);
  stock(e, ALAN_FEED);
  assert.equal(e.feedAlan("feed"), true);
  assert.equal(e.feedAlan("feed"), false, "only once");
  e.w.winter.phase = "cold";
  e.winterEnd();
  assert.equal(e.w.alan.sheep, 2);
  stock(e, { bean: 5 });
  e.s.day += 2;
  hour(e, 6);
  assert.equal(e.s.storage.wool, 2);
  assert.equal(e.s.storage.bean, 4);
  e.s.day += 1;
  hour(e, 6);
  assert.equal(e.s.storage.wool, 2, "wool only every two days");
  const { e: e2 } = make();
  startWinter(e2);
  assert.equal(e2.feedAlan("decline"), true);
  assert.equal(e2.w.alan.phase, "declined");
});

// ---------- 阿默 ----------
test("阿默 trades only at night, once a night, and refuses with a full bag or empty purse", () => {
  const { e } = make();
  toAct(e, 7);
  at(e, WSPOTS.amo);
  assert.ok(e.objects.some((o) => o.type === "winterAmo"));
  e.s.minute = 12 * 60;
  e.s.money = 100;
  assert.equal(e.buyMoonHerb(), false);
  e.s.minute = 22 * 60;
  e.s.money = 10;
  assert.equal(e.buyMoonHerb(), false);
  e.s.money = 100;
  const free = Object.keys(ITEMS).filter((id) => !e.s.inventory[id] && id !== "moonHerb");
  const saved = { ...e.s.inventory };
  while (Object.keys(e.s.inventory).filter((k) => e.s.inventory[k] > 0).length < e.capacity()) e.s.inventory[free.shift()] = 1;
  assert.equal(e.buyMoonHerb(), false);
  assert.equal(e.s.money, 100);
  e.s.inventory = saved;
  assert.equal(e.buyMoonHerb(), true);
  assert.equal(e.s.money, 75);
  assert.equal(e.buyMoonHerb(), false, "one a night");
  assert.equal(e.w.amo.met, true);
  assert.equal(e.recipeReason(RECIPES.find((r) => r.id === "remedy")), e.__proto__.__proto__.recipeReason.call(e, RECIPES.find((r) => r.id === "remedy")));
  assert.equal(e.amoSample(), false, "the sample only matters in act eight");
});

// ---------- 第八段 ----------
test("act eight: 夜莺, 阿默's sample, the museum, evidence and the broadcast assault", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  assert.equal(e.storyGoal().step.id, "yeying");
  home(e);
  assert.equal(e.doStory("yeying"), false);
  at(e, TERMINAL_SPOT);
  assert.equal(e.doStory("yeying"), true);
  assert.equal(e.radioHost(), 1.5);
  at(e, WSPOTS.amo);
  e.s.minute = 23 * 60;
  assert.equal(e.doStory("amo"), true);
  assert.ok(e.qty("amoSample", true) > 0);
  assert.equal(e.doStory("amo"), false);
  go(e, "farm");
  assert.equal(e.storyGoal().step.id, "air");
  at(e, TERMINAL_SPOT);
  assert.equal(e.startFinale(), false, "not before every preparation");
  point(e, "shelter_air", "service");
  point(e, "shipyard_ferry", "service");
  e.assignRegion();
  at(e, WSPOTS.museum);
  for (const k of Object.keys(SUYAN_COST)) {
    e.s.storage[k] = 0;
    delete e.s.inventory[k];
  }
  assert.equal(e.buildMuseum(), false);
  stock(e, SUYAN_COST);
  e.assignRegion();
  e.interact();
  assert.equal(e.w.museum.built, true);
  assert.equal(e.buildMuseum(), false);
  at(e, WSPOTS.evidence);
  assert.equal(e.deliverEvidence(), false, "needs three logs");
  e.f.clues = ["residential", "hospital", "warehouse"];
  e.interact();
  assert.equal(e.w.evidence, true);
  assert.equal(e.qty("amoSample", true), 0);
  at(e, TERMINAL_SPOT);
  assert.equal(e.storyGoal().step.id, "finale");
  assert.equal(e.doStory("finale"), true);
  assert.equal(e.raidState(), e.w.assault);
  assert.equal(e.raidState().phase, "warning");
  assert.ok(toasts.some((t) => /残部来了/.test(t.text)));
  // 第一次没守住：明天再来，人多一个
  e.raidState().timer = 0;
  e.update(0.05, {});
  assert.equal(e.w.assault.phase, "active");
  assert.equal(e.w.assault.total, 12);
  e.finishRaid(false);
  assert.equal(e.w.assault.phase, "scheduled");
  assert.equal(e.w.assault.day, e.s.day + 1);
  assert.equal(e.w.assault.tries, 1);
  assert.equal(e.sc.act, 8);
  assert.equal(e.storyGoal().step.title, "灰隼团残部还会再来");
  e.w.assault.phase = "active";
  e.w.assault.total = e.raidSize();
  assert.equal(e.w.assault.total, 13);
  const money = e.s.money;
  e.finishRaid(true);
  assert.equal(e.w.assault.phase, "won");
  assert.equal(e.sc.act, 9);
  assert.equal(e.s.money, money + 150 + 200);
  assert.ok(e.sc.letters.includes("act9"));
  const report = renderOutpost(e, { view: "raid" });
  assert.match(report, /击退灰隼团残部/);
  assert.doesNotMatch(report, /鹞子/);
  // 重复结算不会重复发奖
  e.checkStory();
  assert.equal(e.s.money, money + 350);
  assert.equal(e.o.raid.phase, "won", "the first raid record is untouched");
  const back = Engine.parse(e.serialize());
  assert.equal(back.winter.assault.phase, "won");
});

test("an active assault survives save and reload with the right count of gunmen still to come", () => {
  const { e } = make();
  toAct(e, 8);
  Object.assign(e.w, { evidence: true });
  Object.assign(e.w.assault, { phase: "active", day: e.s.day, total: 12, spawned: 6, killed: 3, retreated: 1, spawnTimer: 2, clock: 20 });
  home(e);
  const text = e.serialize();
  const { e: again } = make(Engine.parse(text));
  assert.equal(again.raidState(), again.w.assault);
  assert.equal(again.w.assault.spawned, 4, "gunmen not yet beaten come back on reload");
});

test("夜莺 is recognised after two programs; apologising doubles the radio and dismissing returns to 小柒", () => {
  const { e } = make();
  toAct(e, 8);
  e.w.yeying.phase = "hosting";
  e.chooseProgram("news");
  hour(e, 21);
  nextDay(e);
  e.chooseProgram("lesson");
  hour(e, 21);
  assert.equal(e.w.yeying.phase, "exposed");
  assert.equal(e.decideYeying("apologize"), true);
  assert.equal(e.radioHost(), 2);
  assert.equal(e.decideYeying("dismiss"), false);
  const { e: e2 } = make();
  toAct(e2, 8);
  e2.w.yeying.phase = "exposed";
  assert.equal(e2.decideYeying("dismiss"), true);
  assert.equal(e2.radioHost(), 1);
});

// ---------- 档案馆 ----------
test("museum donations fill showcases once each and grant their permanent bonus", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  e.w.museum.built = true;
  e.assignRegion();
  home(e);
  assert.equal(e.donate("relics", "seedArchive"), false, "must stand in the museum");
  at(e, WSPOTS.museum);
  e.r.finds = [...SHOWCASES.relics.items];
  const rep = e.c.reputation;
  for (const id of SHOWCASES.relics.items) assert.equal(e.donate("relics", id), true);
  assert.equal(e.donate("relics", "seedArchive"), false, "no duplicates");
  assert.ok(e.showcaseDone("relics"));
  // v0.28：日志、照片、遗物并成「往事」一柜，一层摆满不再单给奖励
  if (rep !== undefined) assert.equal(e.c.reputation, rep);
  assert.ok(toasts.some((t) => /「往事」一柜的「遗物」一层摆满了/.test(t.text)));
  // 鱼：要真有鱼
  assert.equal(e.donate("fish", "fish"), false);
  stock(e, { fish: 1, riverFish: 1, nightFish: 1 });
  for (const id of SHOWCASES.fish.items) assert.equal(e.donate("fish", id), true);
  assert.equal(e.s.storage.fish || 0, 0);
  assert.ok(e.showcaseDone("fish"));
  // 日志
  e.f.clues = ["residential", "hospital", "warehouse"];
  const credits = e.c.researchCredits || 0;
  for (const id of e.f.clues) e.donate("logs", id);
  assert.equal(e.c.researchCredits, credits, "the logs shelf alone gives nothing since v0.28");
  // 药草：要鉴定过，还要 1 份药草
  e.f.samples = [0, 1, 2, 3];
  e.f.identified = [0, 1, 2, 3];
  e.s.storage.herb = 0;
  delete e.s.inventory.herb;
  assert.equal(e.donate("herbs", "mint"), false);
  stock(e, { herb: 4 });
  for (const id of ["mint", "yarrow", "calendula", "sage"]) assert.equal(e.donate("herbs", id), true);
  assert.ok(e.showcaseDone("herbs"));
  const back = Engine.parse(e.serialize());
  assert.deepEqual(back.winter.museum.claimed.sort(), ["fish", "herbs", "logs", "relics"]);
  assert.equal(collectionRows(e).find((r) => r.name === "遗物").done, true);
});

test("evidence makes medkits stronger and lets one bandage cure the sick camp", () => {
  const { e } = make();
  toAct(e, 8);
  e.w.evidence = true;
  home(e);
  e.o.sick = e.s.day;
  stock(e, { bandage: 1 });
  assert.equal(e.curePlague(), true);
  assert.equal(e.o.sick, 0);
  e.s.inventory.medkit = 1;
  e.s.player.hp = 20;
  e.consume("medkit");
  // v0.22：药包 8 秒内慢慢回；证据多回的 20 一起算进去
  for (let i = 0; i < 180; i++) e.update(0.05, { x: 0, y: 0 });
  const plain = (ITEMS.medkit.heal || 0) + 20;
  assert.ok(e.s.player.hp >= Math.min(100, 20 + plain));
});

// ---------- 界面 ----------
test("every winter view renders without leaks and the journal gains the living-standard strip", () => {
  const { e } = make();
  startWinter(e);
  e.recruit("farmer");
  for (const view of ["decrees", "radio", "museum", "collection", "winter"]) {
    const html = renderWinterView(e, { view });
    assert.doesNotMatch(html, FORBIDDEN, view);
    assert.ok(winterTitle({ view }).length > 0);
  }
  for (const id of ["alan", "ge", "amo"]) assert.doesNotMatch(renderWinterView(e, { view: "dialog", id }), FORBIDDEN, id);
  assert.equal(winterTitle({ view: "dialog", id: "ge" }), "葛队长");
  assert.match(renderCampaignView(e, { view: "log", toastLog: [] }), /前哨记录/, "older views still render");
  const journal = renderWinterJournal(e, {});
  assert.match(journal, /winter-strip/);
  assert.match(journal, /生活水准/);
  assert.doesNotMatch(journal, FORBIDDEN);
  const hud = campaignHud(e);
  assert.match(hud.season.text, /寒潮 \d+ 天后/);
  assert.equal(typeof hud.alerts, "string");
  const map = renderAtlasPlus(e, {});
  assert.match(map, /亮灯的路/);
  assert.doesNotMatch(map, FORBIDDEN);
});

test("decree, program, gift and dialog buttons change real state through the handler", () => {
  const { e } = make();
  startWinter(e);
  let shown = null;
  const c = ctx(e, { showMenu: (m, a) => (shown = [m, a]) });
  assert.equal(handleWinterAction("wView", { dataset: { id: "decrees" } }, c), true);
  assert.deepEqual(shown, ["outpost", { view: "decrees", id: "" }]);
  handleWinterAction("wDecree", { dataset: { id: "rotation" } }, c);
  assert.equal(e.decree("rotation"), true);
  handleWinterAction("wDecree", { dataset: { id: "rotation" } }, c);
  assert.equal(e.decree("rotation"), true, "the cooldown blocks a double click");
  handleWinterAction("wProgram", { dataset: { id: "songs" } }, c);
  assert.equal(e.w.radio.program, "songs");
  stock(e, ALAN_FEED);
  handleWinterAction("wAlan", { dataset: { id: "feed" } }, c);
  assert.equal(e.w.alan.phase, "fed");
  stock(e, GE_COST);
  assert.equal(handleCampaignAction("wGe", { dataset: { id: "escort" } }, c), true);
  assert.equal(e.w.ge.phase, "escorted");
  assert.equal(handleCampaignAction("oNothing", { dataset: {} }, c), false);
});

test("the alert bar lists at most three real problems and clicking one plants a gold marker", () => {
  const { e } = make();
  startWinter(e);
  e.w.winter.phase = "cold";
  e.w.winter.fuelDay = e.s.day;
  e.w.winter.lit = false;
  e.o.sick = e.s.day;
  e.w.ge.phase = "warned";
  for (const k of Object.keys(e.s.storage)) if (MEAL_ITEMS.includes(k)) delete e.s.storage[k];
  for (const k of Object.keys(e.s.inventory)) if (MEAL_ITEMS.includes(k)) delete e.s.inventory[k];
  const items = alertItems(e);
  assert.ok(items.length <= 3 && items.length > 0);
  assert.equal(items[0].text, "口粮不到一天");
  assert.match(alertBar(e), /data-action="wAlert"/);
  const c = ctx(e);
  handleWinterAction("wAlert", { dataset: { id: "0" } }, c);
  assert.equal(e.guidance.target.label, items[0].target.label);
  assert.equal(winterHud(e).tone, e.playerCold() ? "danger" : "ok");
});

test("the camp manual residents page shows the decree card", () => {
  const { e } = make();
  toAct(e, 7);
  const h = { esc: (s) => String(s), icon: () => "", itemIcon: () => "", costs: () => "", itemName: (id) => id };
  const html = renderRebuildPlus(e, "residents", h, {}, {});
  assert.match(html, /前哨法令簿与生活水准/);
  assert.match(html, /data-action="wView" data-id="decrees"/);
  assert.doesNotMatch(html, FORBIDDEN);
});

test("act seven completes once when the cold is over and pays its reward a single time", () => {
  const { e } = make();
  startWinter(e);
  e.chooseStory("priority", "food");
  stock(e, GE_COST);
  e.chooseStory("ge", "escort");
  const money = e.s.money;
  e.w.winter.phase = "cold";
  e.s.day = e.w.winter.endDay;
  hour(e, 6);
  assert.equal(e.sc.act, 8);
  assert.equal(e.s.money, money + 120);
  e.checkStory();
  e.winterEnd();
  assert.equal(e.s.money, money + 120);
  assert.ok(e.sc.letters.includes("act8"));
  assert.equal(e.storyGoal().act, 8);
  assert.deepEqual(
    winterSteps(e).map((s) => s.id),
    ["broadcast", "yeying", "amo", "air", "ferry", "suyan", "evidence", "finale"],
  );
});

// ---------- 审查发现的回归 ----------
test("saves keep loading past day 99 with 阿兰's sheep (wool and feed days are day numbers)", () => {
  const { e } = make();
  startWinter(e);
  stock(e, ALAN_FEED);
  e.feedAlan("feed");
  e.s.day = 120;
  e.w.winter.phase = "cold";
  e.winterEnd();
  stock(e, { bean: 4 });
  e.s.day = 123;
  hour(e, 6);
  assert.equal(e.w.alan.woolDay, 123);
  assert.doesNotThrow(() => Engine.parse(e.serialize()));
});

test("full showcases stop accepting donations, so the museum can never overflow the save", () => {
  const { e } = make();
  toAct(e, 8);
  e.w.museum.built = true;
  e.assignRegion();
  at(e, WSPOTS.museum);
  for (let i = 1; i <= 14; i++) e.f.photos.unshift({ id: 900 + i, data: "data:image/jpeg;base64,AAAA", day: 1, region: "farm", subjects: ["frog"] });
  e.f.photos = e.f.photos.slice(0, 6);
  let n = 0;
  for (const id of e.donatable("photos")) if (e.donate("photos", id)) n++;
  assert.equal(n, 3);
  assert.ok(e.showcaseDone("photos"));
  e.f.photos.unshift({ id: 999, data: "data:image/jpeg;base64,AAAA", day: 2, region: "farm", subjects: ["rainSign"] });
  e.f.photos = e.f.photos.slice(0, 6);
  assert.deepEqual(e.donatable("photos"), []);
  assert.equal(e.donate("photos", 999), false);
  assert.doesNotThrow(() => Engine.parse(e.serialize()));
  assert.doesNotMatch(renderWinterView(e, { view: "museum" }), /wDonate" data-id="photos/);
});

test("after a reload the last battle report is still the newest one (the act-eight assault)", () => {
  const { e } = make();
  toAct(e, 8);
  e.o.raid.report = { day: 3, won: true, kind: "first", total: 8, killed: 8, retreated: 0, prep: null, power: 3, lost: {}, gain: { ammo: 12 } };
  e.s.day = 12;
  home(e);
  Object.assign(e.w.assault, { phase: "active", day: 12, total: 12, spawned: 12, killed: 2 });
  e.finishRaid(false);
  const before = renderOutpost(e, { view: "raid" });
  assert.match(before, /没守住 · 第12天/);
  const { e: again } = make(Engine.parse(e.serialize()));
  const after = renderOutpost(again, { view: "raid" });
  assert.match(after, /没守住 · 第12天/);
  assert.match(after, /第13天 19:00 还会再来/);
  assert.equal(again.lastRaidRecord(), again.w.assault);
});

test("food priority: a missed dinner in the cold brings two breads from the neighbours next morning", () => {
  const { e, toasts } = make();
  startWinter(e);
  e.chooseStory("priority", "food");
  e.w.winter.phase = "cold";
  e.o.dinnerDay = e.s.day;
  e.o.missed = ["h:tieqiao"];
  e.s.day++;
  e.w.winter.fuelDay = e.s.day;
  const bread = e.s.storage.bread || 0;
  hour(e, 6);
  assert.equal(e.s.storage.bread, bread + 2);
  assert.ok(toasts.some((t) => /邻居一早送来/.test(t.text)));
});
