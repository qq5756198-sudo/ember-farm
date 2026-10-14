import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState } from "../dist/campaign.js";
import { Engine as WinterEngine, freshState as winterFresh } from "../dist/winter.js";
import { TASKS } from "../dist/rebuild-data.js";
import { ITEMS, BUILDINGS, RECIPES } from "../dist/data.js";
import { MEAL_ITEMS } from "../dist/outpost-data.js";
import { LADDER, PROGRAMS } from "../dist/winter-data.js";
import {
  SSPOTS,
  SHEET_SPOTS,
  FESTIVALS,
  TASTES,
  HE_DISHES,
  HE_BONUS,
  JIANG_TASKS,
  BIRTHDAYS,
  CANTEEN_GUESTS,
} from "../dist/seasons-data.js";
import { renderSeasonsView, renderSeasonsJournal, handleSeasonsAction, itemLinks, stationExtras, renderManualSeasons } from "../dist/seasons-ui.js";
import { renderCampaignView, campaignTitle, campaignHud, handleCampaignAction } from "../dist/campaign-ui.js";
import { renderWinterView } from "../dist/winter-ui.js";

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
const stock = (e, items) => {
  for (const [k, v] of Object.entries(items)) e.s.storage[k] = (e.s.storage[k] || 0) + v;
};
const clear = (e, ids) => {
  for (const id of ids) {
    delete e.s.storage[id];
    delete e.s.inventory[id];
  }
};
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const view = (e, ui) => renderCampaignView(e, ui);
// 第 n 段开头的存档（只改进度字段）。
function toAct(e, n) {
  const sc = e.sc;
  sc.act = n;
  sc.claimed = ["act1", "supply", "act2", ...[3, 4, 5, 6, 7].filter((k) => k < n).map((k) => "act" + k)];
  sc.choice = "ration";
  sc.letters = ["act1", "act2", ...[3, 4, 5, 6, 7, 8].filter((k) => k <= n).map((k) => "act" + k)];
  sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true;
  sc.camp = { x: 560, y: 735 };
  const last = { 3: "table", 4: "hospitalDefense", 5: "warehouse", 6: "network", 7: "radio", 8: "broadcast" }[n];
  e.r.claimed = TASKS.slice(0, TASKS.findIndex((t) => t.id === last) + 1).map((t) => t.id);
  if (n >= 4) e.o.hospital = "water";
  if (n >= 5) Object.assign(e.o, { youke: true, lathe: { mode: "parts", day: 0 } });
  if (n >= 6) Object.assign(e.o, { cargo: "food", convoy: { departs: 0, arrives: 10, escorted: true, spawned: true, foes: [], done: true, lost: false } });
  if (n >= 7) {
    e.r.radio = true;
    e.o.toll = "refuse";
    e.o.raid.phase = "won";
  }
  e.assignRegion();
}
function camp(e) {
  toAct(e, 5);
  e.recruit("farmer");
  e.recruit("medic");
  e.addHelper("tieqiao");
  stock(e, { bread: 20 });
}
function place(e, type, near) {
  go(e, "farm");
  e.buildMode = type;
  for (let r = 0; r < 500; r += 12)
    for (let a = 0; a < 6.28; a += 0.25) {
      const x = Math.round((near.x + Math.cos(a) * r) / 8) * 8,
        y = Math.round((near.y + Math.sin(a) * r) / 8) * 8;
      Object.assign(e.s.player, { x: x + 30, y: y + 30 });
      if (!e.buildReason(type, x, y)) {
        for (const [k, v] of Object.entries(BUILDINGS[type].cost)) stock(e, { [k]: v });
        assert.equal(e.placeBuilding(x, y), true, "placing " + type);
        e.buildMode = null;
        return e.s.buildings.at(-1);
      }
    }
  throw Error("no spot for " + type);
}
function room(e, x, y) {
  e.s.buildings.push(
    { id: "rf" + x, type: "floor", x, y, rotation: 0, hp: 100, open: false },
    { id: "rc" + x, type: "chair", x: x + 20, y, rotation: 0, hp: BUILDINGS.chair.hp, open: false },
    { id: "rl" + x, type: "lamp", x: x - 20, y: y + 10, rotation: 0, hp: BUILDINGS.lamp.hp, open: false },
  );
}
function festivalDay(e, day = 7) {
  e.s.day = day;
  e.s.minute = 16 * 60 + 5;
  at(e, SSPOTS.plaza);
}

// ---------- 存档 ----------
test("new saves carry seasons defaults and a v0.16-or-later version", async () => {
  const { e } = make();
  assert.equal(e.ss.schema, 1);
  assert.equal(e.ss.he.stage, 0);
  assert.equal(e.festivalsOpen(), false, "festivals start from act three");
  const v = await import("../dist/version.js");
  assert.match(v.GAME_VERSION, /^v0\.(1[6-9]|[2-9]\d)\.\d+$/);
  assert.ok(v.GAME_EDITION);
  const text = e.serialize();
  assert.deepEqual(Engine.parse(text).seasons, JSON.parse(text).seasons);
});

test("a v0.15 save without seasons data loads unchanged and gains empty seasons state", () => {
  const old = new WinterEngine(winterFresh(), () => {});
  old.s.money = 432;
  old.s.winter.forecast = true;
  const text = old.serialize();
  assert.equal(JSON.parse(text).seasons, undefined);
  const s = Engine.parse(text);
  assert.equal(s.money, 432);
  assert.equal(s.winter.forecast, true);
  assert.equal(s.seasons.canteen.rep, 30);
  const { e } = make(s);
  assert.equal(Engine.parse(e.serialize()).money, 432);
});

test("corrupted or inconsistent seasons fields are refused with a recoverable message", () => {
  const { e } = make();
  camp(e);
  const text = e.serialize();
  const broken = [
    (s) => (s.seasons.schema = 2),
    (s) => (s.seasons.extra = 1),
    (s) => (s.seasons.decor = ["castle"]),
    (s) => (s.seasons.trust = { farmer: 11 }),
    (s) => (s.seasons.he.stage = 5),
    (s) => (s.seasons.qin.wishes = ["moon"]),
    (s) => (s.seasons.adou.phase = "king"),
    (s) => (s.seasons.laoqin.sheets = ["moon"]),
    (s) => (s.seasons.jiang.rod = 3),
    (s) => (s.seasons.skills = { tieqiao: "fly" }),
    (s) => (s.seasons.seen = ["nothing"]),
    (s) => (s.seasons.canteen.night = { day: 1, customers: [], spawned: 0, nextIn: 0, income: 0, score: 0, served: 0, wrong: 0, missed: 0 }),
    (s) => (s.seasons.fest.held = [7, 7]),
  ];
  for (const change of broken) {
    const s = JSON.parse(text);
    change(s);
    assert.throws(() => Engine.parse(JSON.stringify(s)), /四季存档异常/);
  }
});

test("saves keep loading on day 400 with long festival history", () => {
  const { e } = make();
  camp(e);
  e.ss.fest.held = Array.from({ length: 60 }, (_, i) => (i + 1) * 7);
  e.ss.fest.lastDay = 420;
  e.s.day = 400;
  e.ss.gifts = { farmer: 399 };
  assert.doesNotThrow(() => Engine.parse(e.serialize()));
});

// ---------- 节庆 ----------
test("festivals come every seven days in a four-kind rotation and need the plaza in the evening", () => {
  const { e, toasts } = make();
  camp(e);
  assert.deepEqual([7, 14, 21, 28, 35].map((d) => e.festivalKind(d)), ["seeds", "lanterns", "harvest", "vigil", "seeds"]);
  assert.equal(e.nextFestivalDay(8), 14);
  e.s.day = 6;
  assert.match(e.festivalReason(), /不是节庆日/);
  hour(e, 8);
  assert.ok(toasts.some((t) => /明天是「换种集」/.test(t.text)));
  e.s.day = 7;
  e.s.minute = 10 * 60;
  assert.match(e.festivalReason(), /16:00/);
  e.s.minute = 17 * 60;
  clear(e, Object.keys(ITEMS).filter((id) => ITEMS[id].type === "seed"));
  assert.match(e.festivalReason(), /3 种种子/);
  stock(e, { seedRadish: 4, seedPotato: 2, seedBean: 2 });
  assert.equal(e.festivalReason(), "");
  go(e, "farm");
  Object.assign(e.s.player, { x: 300, y: 400 });
  assert.equal(e.hostFestival(), false, "must stand on the plaza");
  assert.equal(e.s.storage.seedRadish, 4);
});

test("hosting a festival pays once, grants decor and counts as hope for the living standard", () => {
  const { e } = make();
  camp(e);
  festivalDay(e, 7);
  stock(e, { seedRadish: 4, seedPotato: 2, seedBean: 2 });
  const rep = e.c.reputation,
    pay = e.festivalPay(),
    before = Object.fromEntries(Object.keys(pay).map((id) => [id, e.quantityForCost(id, true)]));
  assert.equal(Object.keys(pay).length, 3);
  assert.equal(e.hostFestival(), true);
  for (const id of Object.keys(pay)) assert.equal(e.quantityForCost(id, true), before[id] - 2, id);
  assert.ok(e.ss.decor.includes("banner"));
  assert.ok(e.c.reputation >= rep + 3);
  assert.ok((e.s.storage.seedRye || 0) >= 2);
  assert.equal(e.festivalRecent(), true);
  assert.equal(e.ladderChecks()[3], true, "a festival in the last week counts as hope");
  assert.match(LADDER[3].need, /节庆/);
  assert.equal(e.hostFestival(), false, "only once a day");
  assert.equal(e.ss.ali.phase, "here", "阿砾 shows up after the first festival");
  const { e: e2 } = make(Engine.parse(e.serialize()));
  e2.paused = false;
  assert.equal(e2.hostFestival(), false, "no second reward after reload");
});

test("lantern night, harvest contest and vigil each pay out their own reward with stars", () => {
  const { e } = make();
  camp(e);
  festivalDay(e, 14);
  stock(e, { wood: 4, cloth: 2 });
  place(e, "lamp", { x: 1150, y: 560 });
  place(e, "lamp", { x: 1320, y: 560 });
  at(e, SSPOTS.plaza);
  const morale = e.resident("farmer").morale;
  assert.equal(e.festivalStars("lanterns")[0], true);
  assert.equal(e.hostFestival(), true);
  assert.ok(e.resident("farmer").morale >= Math.min(100, morale + 8));
  festivalDay(e, 21);
  stock(e, { radish: 2, potato: 2, bean: 2 });
  const money = e.s.money;
  assert.equal(e.hostFestival(), true);
  assert.ok(e.s.money >= money + 60);
  festivalDay(e, 28);
  stock(e, { bread: 6 });
  assert.equal(e.hostFestival(), true);
  assert.ok((e.ss.trust.farmer || 0) >= 1);
  assert.deepEqual([...e.ss.decor].sort(), ["arch", "lanterns", "stone"]);
});

test("a missed festival is logged once and no horde is scheduled on a festival day", () => {
  const { e } = make();
  camp(e);
  e.s.day = 7;
  nextDay(e);
  assert.equal(e.ss.fest.missed, 1);
  nextDay(e);
  assert.equal(e.ss.fest.missed, 1);
  e.c.nextHordeDay = 14;
  hour(e, 9);
  assert.equal(e.c.nextHordeDay, 15);
});

// ---------- 相邻加成 ----------
test("adjacency preview shows real bonuses and hints, and only ever adds", () => {
  const { e } = make();
  const cook = e.s.buildings.find((b) => b.type === "cook");
  const chest = e.s.buildings.find((b) => b.type === "chest");
  assert.ok(e.adjActive(cook).some((r) => r.id === "cookChest"), "the starting cook sits next to the chest");
  assert.match(e.adjacencyPreview("cook", chest.x + 60, chest.y + 40)[0], /^＋ 靠近仓库箱/);
  assert.match(e.adjacencyPreview("cook", 200, 900)[0], /^提示：/);
  assert.deepEqual(e.adjacencyPreview("fence", 200, 900), []);
  assert.match(stationExtras(e, cook), /靠近仓库箱：篝火灶加工 \+20%/);
});

test("a cook next to a chest finishes jobs faster than one far away", () => {
  const run = (moveChest) => {
    const { e } = make();
    const chest = e.s.buildings.find((b) => b.type === "chest");
    if (moveChest) Object.assign(chest, { x: 200, y: 900 });
    e.c.production.push({ id: "j1", station: "cook", recipe: "stew", out: { stew: 1 }, remaining: 60, ready: false });
    e.processProduction(30);
    return e.c.production.find((j) => j.id === "j1").remaining;
  };
  const near = run(false),
    far = run(true);
  assert.ok(near < far, "near " + near + " far " + far);
  assert.ok(Math.abs(60 - far - (60 - near) / 1.2) < 1.5);
});

test("coops and rain barrels among fields speed nearby crops; towers by fences fire faster", () => {
  const { e } = make();
  const p = e.s.plots[0];
  const base = e.cropGrowthRate(p);
  e.s.buildings.push({ id: "coop1", type: "coop", x: p.x + 40, y: p.y + 40, rotation: 0, hp: BUILDINGS.coop.hp, open: false });
  const near = e.s.plots.filter((q) => Math.hypot(q.x - p.x - 40, q.y - p.y - 40) <= 180).length;
  if (near >= 3) assert.ok(e.cropGrowthRate(p) > base * 1.05);
  e.s.buildings.push(
    { id: "t1", type: "tower", x: 1300, y: 500, rotation: 0, hp: BUILDINGS.tower.hp, open: false, shotTimer: 1 },
    { id: "f1", type: "fence", x: 1340, y: 500, rotation: 0, hp: BUILDINGS.fence.hp, open: false },
  );
  const t = e.s.buildings.find((b) => b.id === "t1");
  assert.ok(e.adjActive(t).some((r) => r.tower));
});

// ---------- 何大勺与食堂 ----------
test("何大勺 in the market teaches three dishes in order, then joins and teaches two more", () => {
  const { e, toasts } = make();
  toAct(e, 3);
  at(e, SSPOTS.he);
  assert.ok(e.objects.some((o) => o.type === "seasonHe"));
  const armyStew = RECIPES.find((r) => r.id === "armyStew");
  assert.match(e.recipeReason(armyStew), /何大勺/);
  e.interact();
  assert.equal(e.ss.he.stage, 1);
  assert.doesNotMatch(e.recipeReason(armyStew) || "", /何大勺/);
  clear(e, HE_DISHES);
  assert.equal(e.heDeliver(), false, "needs the dish");
  assert.equal(e.ss.he.stage, 1);
  stock(e, { radishCake: 1 });
  assert.equal(e.heDeliver(), false, "the wrong dish does not count");
  for (const d of HE_DISHES) {
    stock(e, { [d]: 1 });
    assert.equal(e.heDeliver(), true);
  }
  assert.equal(e.ss.he.stage, 4);
  assert.equal(e.canteenOpen(), true);
  assert.ok(!e.objects.some((o) => o.type === "seasonHe"));
  for (const id of HE_BONUS) assert.doesNotMatch(e.recipeReason(RECIPES.find((r) => r.id === id)) || "", /何大勺/);
  for (const id of [...HE_DISHES, ...HE_BONUS]) assert.ok(MEAL_ITEMS.includes(id));
  assert.ok(toasts.some((t) => /一周开两晚食堂/.test(t.text)));
});

test("canteen nights: guests order by taste, wait in real time and set the canteen's reputation", () => {
  const { e, toasts } = make();
  camp(e);
  e.ss.he.stage = 4;
  e.s.day = 9;
  e.s.minute = 18 * 60;
  at(e, SSPOTS.plaza);
  assert.match(e.canteenReason(), /19:00/);
  e.s.minute = 19 * 60 + 1;
  clear(e, Object.values(TASTES).flatMap((t) => t.dishes));
  assert.match(e.canteenReason(), /一道做好的菜都没有/);
  stock(e, { stew: 4, jam: 2, fishStew: 2, chefMeal: 2, bread: 2 });
  assert.equal(e.startCanteen(), true);
  assert.equal(e.startCanteen(), false);
  const n = e.ss.canteen.night,
    g = n.customers[0];
  const good = TASTES[g.taste].dishes.find((d) => e.quantityForCost(d, true));
  assert.ok(good, "the first guest always orders something in stock");
  const money = e.s.money;
  assert.equal(e.serveGuest(g.id, good), true);
  assert.ok(e.s.money > money);
  assert.equal(e.serveGuest(g.id, good), false, "a served guest cannot be served twice");
  // 存档往返（营业中）
  const { e: again } = make(Engine.parse(e.serialize()));
  assert.equal(again.ss.canteen.night.customers[0].state, "served");
  for (let i = 0; i < 200 && e.ss.canteen.night; i++) e.advanceMinutes(1);
  assert.equal(e.ss.canteen.night, null);
  assert.equal(e.ss.canteen.nights, 1);
  assert.ok(toasts.some((t) => /等不及，走了/.test(t.text)));
  assert.ok(toasts.some((t) => /食堂打烊/.test(t.text)));
  assert.equal(e.canteenReason(), "今晚已经营业过了");
});

test("a good canteen reputation raises food sale prices and brings the caravan a day earlier", () => {
  const { e } = make();
  camp(e);
  const plain = e.price("food", "stew", "sell");
  e.ss.canteen.rep = 75;
  assert.ok(e.price("food", "stew", "sell") > plain);
  assert.equal(e.price("food", "parts", "sell"), e.__proto__.__proto__.price.call(e, "food", "parts", "sell"));
  e.o.caravan.offers = [{ key: 0, item: "bread", qty: 1, price: 10, sold: false }];
  e.leaveCaravan();
  assert.equal(e.o.caravan.next, e.s.day + 3);
});

// ---------- 营火夜谈与信任 ----------
test("campfire talks happen once a night after dinner and build trust or morale", () => {
  const { e, toasts } = make();
  camp(e);
  e.s.minute = 15 * 60;
  at(e, e.fireSpot());
  assert.match(e.talkReason(), /19:00/);
  e.s.minute = 19 * 60 + 30;
  assert.equal(e.talkReason(), "");
  assert.equal(e.talkReady("tieqiao"), true);
  go(e, "farm");
  Object.assign(e.s.player, { x: 1200, y: 300 });
  assert.equal(e.talk("past"), false, "must sit by the fire");
  at(e, e.fireSpot());
  assert.equal(e.talk("past"), true);
  assert.ok(e.ss.trust.farmer >= 1 && e.ss.trust.tieqiao >= 1);
  assert.equal(e.talk("future"), false, "once a night");
  e.s.day++;
  e.resident("medic").morale = 30;
  assert.ok(e.talkPeople().find((p) => p.id === "medic").sad);
  assert.equal(e.talk("comfort:medic"), true);
  // v0.26：低落的人聊完当晚回到平常（士气至少 45）
  assert.equal(e.resident("medic").morale, 45);
  e.s.day++;
  e.c.nextHordeDay = e.s.day + 3;
  assert.equal(e.talk("today"), true);
  assert.ok(toasts.some((t) => /尸潮大概第/.test(t.text)), "every third talk brings news");
});

// v0.30「人情」改了送礼：喜好要猜（什么都能送，送的是一般就不长信任）、每人 7 天最多 2 次、要走到他跟前；生日照旧翻倍
test("gifts: likes are guessed, two a week per person, given in person, doubled on birthdays; trust has real effects", () => {
  const { e, toasts } = make();
  camp(e);
  stock(e, { jam: 3, herb: 2 });
  const r = e.resident("farmer");
  Object.assign(e.s.player, { x: r.x, y: r.y });
  assert.equal(e.giftReason("farmer", "herb"), "", "anything giftable can be tried");
  assert.equal(e.giveGift("farmer", "jam"), true);
  assert.equal(e.ss.trust.farmer, 1);
  assert.equal(e.giveGift("farmer", "herb"), true, "a plain gift is taken politely");
  assert.equal(e.ss.trust.farmer, 1);
  assert.match(e.giftReason("farmer", "jam"), /7 天送过 2 次/);
  assert.equal(e.giveGift("farmer", "jam"), false, "twice a week");
  e.s.day = BIRTHDAYS.farmer + 28;
  assert.equal(e.birthday("farmer"), true);
  Object.assign(e.s.player, { x: r.x, y: r.y });
  assert.equal(e.giveGift("farmer", "jam"), true);
  assert.equal(e.ss.trust.farmer, 3);
  assert.ok(toasts.some((t) => /生日/.test(t.text)));
  e.ss.trust.tieqiao = 6;
  e.o.missed = ["h:tieqiao"];
  assert.equal(e.slowed("h:tieqiao"), false, "a trusted helper does not sulk over a missed meal");
  const morale = (e.resident("farmer").morale = 50);
  e.ss.trust.farmer = 6;
  nextDay(e);
  assert.ok(e.resident("farmer").morale >= morale + 1 - 0);
});

// ---------- 学徒 ----------
test("apprentices train for three days at a production cost and then do real second jobs", () => {
  const { e } = make();
  camp(e);
  assert.match(e.apprenticeReason("youke", "tieqiao"), /师父/);
  assert.match(e.apprenticeReason("farmer", "nobody"), /援建队员/);
  const plain = e.efficiency();
  assert.equal(e.startApprentice("farmer", "tieqiao"), true);
  assert.ok(Math.abs(e.efficiency() - plain * 0.9) < 1e-9);
  assert.equal(e.startApprentice("medic", "tieqiao"), false, "one at a time");
  e.s.day += 3;
  hour(e, 6);
  assert.equal(e.ss.skills.tieqiao, "water");
  assert.equal(e.ss.apprentice, null);
  for (const p of e.s.plots.slice(0, 3)) Object.assign(p, { crop: "radish", growth: 0, wateredDay: 0 });
  hour(e, 7);
  assert.ok(e.s.plots.slice(0, 3).every((p) => p.wateredDay === e.s.day));
  assert.match(e.apprenticeReason("medic", "tieqiao"), /已经学会/);
  // 包扎
  e.ss.skills.tieqiao = "bandage";
  e.o.sick = e.s.day;
  stock(e, { bandage: 1 });
  hour(e, 18);
  assert.equal(e.o.sick, 0);
});

// ---------- 借宿与秦奶奶 ----------
test("lodgers need a bed or furnished room and a meal; the first is 秦奶奶 with three wishes", () => {
  const { e, toasts } = make();
  camp(e);
  hour(e, 20);
  assert.equal(e.ss.lodger.name, "秦奶奶");
  at(e, SSPOTS.gate);
  assert.match(e.context(e.nearestObject()), /秦奶奶/);
  e.residentsCapacity = () => 2;
  assert.match(e.lodgerReason(), /没有空床/);
  delete e.residentsCapacity;
  room(e, 600, 560);
  assert.equal(e.lodgerReason(), "");
  const bread = e.foodPortions();
  assert.equal(e.decideLodger("host"), true);
  assert.equal(e.foodPortions(), bread - 1);
  assert.equal(e.ss.qin.phase, "staying");
  // 三个心愿
  clear(e, ["radishCake"]);
  assert.equal(e.qinCake(), false);
  stock(e, { radishCake: 1 });
  assert.equal(e.qinCake(), true);
  e.qinWish("sea", "看了海");
  e.w.radio.program = "songs";
  e.w.radio.pickDay = e.s.day;
  e.r.radio = true;
  hour(e, 21);
  assert.deepEqual([...e.ss.qin.wishes].sort(), ["cake", "sea", "song"]);
  e.s.day++;
  hour(e, 7);
  assert.equal(e.ss.qin.phase, "left");
  assert.equal(e.s.storage.oldPhoto, 1);
  e.ss.qin.phase = "staying";
  e.qinMorning();
  assert.equal(e.s.storage.oldPhoto, 1, "the photo is given once");
  assert.ok(toasts.some((t) => /老照片已入仓/.test(t.text)));
});

test("ordinary lodgers leave a gift next morning; some want to stay and go through the gate review", () => {
  const { e } = make();
  camp(e);
  room(e, 600, 560);
  e.ss.qin.phase = "left";
  e.roll = () => 0.1;
  hour(e, 20);
  const l = e.ss.lodger;
  assert.ok(l && !l.qin);
  assert.equal(l.stay, true);
  assert.equal(e.decideLodger("host"), true);
  e.s.day++;
  hour(e, 7);
  assert.equal(e.ss.lodger, null);
  assert.equal(e.ss.pendingGuest, l.name);
  delete e.roll;
  e.o.visitors.current = null;
  e.o.visitors.next = e.s.day;
  hour(e, 9);
  assert.equal(e.o.visitors.current?.name, l.name);
  assert.equal(e.o.visitors.current?.kind, "honest");
  // 婉拒与等到深夜
  e.s.day = e.ss.lodgerNext;
  hour(e, 20);
  assert.ok(e.ss.lodger);
  hour(e, 23);
  assert.equal(e.ss.lodger, null);
});

// ---------- 阿豆 ----------
test("阿豆 steals bread two nights, can be caught at night, and becomes a runner after medicine", () => {
  const { e, toasts } = make();
  camp(e);
  e.ss.fest.held = [7];
  stock(e, { bread: 10 });
  const bread = e.s.storage.bread;
  hour(e, 3);
  e.s.day++;
  hour(e, 3);
  assert.equal(e.s.storage.bread, bread - 2);
  assert.equal(e.ss.adou.thefts, 2);
  e.s.minute = 14 * 60;
  assert.equal(e.adouVisible(), false);
  assert.equal(e.adouDecide("catch"), false, "only at night");
  hour(e, 22);
  at(e, SSPOTS.adou);
  assert.ok(e.objects.some((o) => o.type === "seasonAdou"));
  assert.equal(e.adouDecide("catch"), true);
  clear(e, ["bandage", "herbTea", "medkit"]);
  assert.equal(e.adouMedicine(), false);
  stock(e, { bandage: 1 });
  assert.equal(e.adouMedicine(), true);
  assert.equal(e.ss.adou.phase, "runner");
  stock(e, { parts: 5 });
  assert.deepEqual(e.stealFromStorage("小偷", 2), {});
  assert.equal(e.s.storage.parts, 5);
  assert.ok(toasts.some((t) => /阿豆喊破/.test(t.text)));
});

// ---------- 阿砾 ----------
test("阿砾 paints one mural a day for each finished act, or comes back after the next festival if scolded", () => {
  const { e } = make();
  camp(e);
  e.aliArrive();
  assert.equal(e.aliDecide("scold"), true);
  assert.equal(e.ss.ali.phase, "scolded");
  festivalDay(e, 7);
  stock(e, { seedRadish: 4, seedPotato: 2, seedBean: 2 });
  e.hostFestival();
  assert.equal(e.ss.ali.phase, "here");
  assert.equal(e.aliDecide("paint"), true);
  const acts = e.actsDone();
  for (let d = 0; d < acts + 2; d++) {
    e.s.day++;
    hour(e, 6);
  }
  assert.equal(e.ss.ali.murals, Math.min(8, acts));
  e.s.day++;
  hour(e, 6);
  assert.equal(e.ss.ali.murals, Math.min(8, acts), "no more murals than finished acts");
});

// ---------- 老琴 ----------
test("老琴 sings at festivals, hands out a sheet-music quest and the sheets become a radio program", () => {
  const { e } = make();
  camp(e);
  e.r.radio = true;
  assert.equal(e.laoqinSong(), false, "only on festival evenings");
  festivalDay(e, 7);
  assert.equal(e.laoqinSong(), true);
  assert.equal(e.laoqinSong(), false, "once a festival");
  assert.equal(e.ss.laoqin.quest, true);
  assert.match(e.programReason("oldsongs"), /歌谱/);
  for (const [reg, sp] of Object.entries(SHEET_SPOTS)) {
    at(e, sp);
    assert.ok(e.objects.some((o) => o.type === "seasonSheet" && o.sheet === reg), reg);
    e.interact();
    assert.ok(e.ss.laoqin.sheets.includes(reg));
    assert.equal(e.pickSheet(reg), false);
  }
  go(e, "farm");
  e.s.day++;
  e.s.minute = 10 * 60;
  assert.equal(e.programReason("oldsongs"), "");
  e.chooseProgram("oldsongs");
  const morale = e.resident("farmer").morale;
  hour(e, 21);
  assert.ok(e.resident("farmer").morale >= Math.min(100, morale + 8));
  assert.ok(PROGRAMS.oldsongs);
});

// ---------- 江伯 ----------
test("江伯's commissions upgrade the rod, then a mutant fish and a fry release", () => {
  const { e } = make();
  camp(e);
  at(e, SSPOTS.jiang);
  e.interact();
  assert.equal(e.ss.jiang.phase, "c1");
  clear(e, ["fish"]);
  assert.equal(e.jiangTalk(), false);
  stock(e, JIANG_TASKS.c1.need);
  assert.equal(e.jiangTalk(), true);
  assert.equal(e.ss.jiang.rod, 1);
  stock(e, JIANG_TASKS.c2.need);
  assert.equal(e.jiangTalk(), true);
  assert.equal(e.ss.jiang.phase, "mutant");
  stock(e, { mutantFish: 1 });
  const credits = e.c.researchCredits || 0;
  assert.equal(e.jiangTalk(), true);
  assert.equal(e.c.researchCredits, credits + 1);
  stock(e, JIANG_TASKS.release.need);
  assert.equal(e.jiangTalk(), true);
  assert.equal(e.ss.jiang.phase, "done");
  assert.ok(!e.objects.some((o) => o.type === "seasonJiang"));
});

// ---------- 同处多对象选择 ----------
test("E near two equally close objects opens a chooser; picking runs that object's real action", () => {
  const { e } = make();
  camp(e);
  let menu = null;
  e.notify = () => {};
  const orig = e.emit.bind(e);
  e.emit = (type, data) => {
    if (type === "menu") menu = data;
    return orig(type, data);
  };
  // 江伯与一张假借宿记录挨在一起
  e.ss.qin.phase = "left";
  e.ss.lodger = { name: "赶路的木匠老韩", look: 1, gift: "item", stay: false, phase: "staying", day: 1, qin: false };
  e.assignRegion();
  const lod = e.objects.find((o) => o.type === "seasonLodger");
  Object.assign(lod, { x: SSPOTS.jiang.x + 40, y: SSPOTS.jiang.y });
  Object.assign(e.s.player, { x: SSPOTS.jiang.x + 20, y: SSPOTS.jiang.y + 10 });
  assert.ok(e.pickCandidates().length >= 2);
  assert.match(e.context(e.nearestObject()), /^选择：/);
  e.interact();
  assert.equal(menu?.view, "pick");
  const list = e._pickList;
  const i = list.findIndex((o) => o.type === "seasonJiang");
  assert.match(view(e, { view: "pick" }), /data-hotkey="1"/);
  e.pick(i);
  assert.equal(e.ss.jiang.phase, "c1", "the chosen object really acted");
  assert.equal(e._picked, null);
});

// ---------- 界面 ----------
test("every seasons view renders without leaks and links into the journal and manual", () => {
  const { e } = make();
  camp(e);
  e.ss.he.stage = 2;
  e.ss.qin.phase = "staying";
  e.ss.adou.phase = "sister";
  e.ss.ali.phase = "painting";
  e.ss.jiang.phase = "c2";
  e.ss.lodger = { name: "退休的邮差孙伯", look: 2, gift: "tip", stay: false, phase: "asking", day: 1, qin: false };
  for (const v of ["plaza", "talk", "calendar", "people", "pick"]) {
    const html = view(e, { view: v });
    assert.doesNotMatch(html, FORBIDDEN, v);
    assert.ok(campaignTitle({ view: v }).length);
  }
  for (const id of ["he", "qin", "lodger", "adou", "ali", "jiang"]) assert.doesNotMatch(view(e, { view: "dialog", id }), FORBIDDEN, id);
  assert.match(view(e, { view: "decrees" }), /法令/);
  const journal = renderSeasonsJournal(e, {});
  assert.match(journal, /seasons-strip/);
  assert.match(journal, /下一次节庆：第7天「换种集」/);
  assert.doesNotMatch(journal, FORBIDDEN);
  const cal = view(e, { view: "calendar" });
  assert.match(cal, /换种集/);
  assert.match(cal, /生日/);
  const h = { esc: (s) => String(s), icon: () => "", itemIcon: () => "", costs: () => "", itemName: (id) => id };
  assert.match(renderManualSeasons(e, "residents", h, {}, {}), /人物关系与带徒/);
  assert.match(itemLinks(e, "potato"), /能做：/);
  assert.match(itemLinks(e, "potato"), /种土豆种子/);
  assert.match(itemLinks(e, "bread"), /林姨/);
  assert.match(itemLinks(e, "fish"), /林边池塘/);
});

test("new features carry a 新 mark until opened once, and the first open shows a short intro card", () => {
  const { e } = make();
  camp(e);
  assert.ok(e.featureNew("calendar"));
  assert.equal(campaignHud(e).fresh, true);
  assert.match(renderSeasonsJournal(e, {}), /new-badge/);
  const ui = {};
  let shown = null;
  handleCampaignAction("sView", { dataset: { id: "calendar" } }, ctx(e, { ui, showMenu: (m, a) => (shown = a) }));
  assert.equal(shown.view, "calendar");
  assert.equal(ui.intro, "calendar");
  assert.match(view(e, { ...ui, view: "calendar" }), /intro-card/);
  assert.equal(e.featureNew("calendar"), false);
  handleCampaignAction("sView", { dataset: { id: "calendar" } }, ctx(e, { ui }));
  assert.equal(ui.intro, null, "the card does not come back");
  // 冬季页面也走同一套标记
  handleCampaignAction("wView", { dataset: { id: "decrees" } }, ctx(e, { ui, showMenu() {} }));
  assert.equal(e.featureNew("decrees"), false);
  for (const k of e.newFeatures()) e.markSeen(k);
  assert.equal(campaignHud(e).fresh, false);
});

test("plaza, gift, apprentice, lodger and link buttons change real state through the handler", () => {
  const { e } = make();
  camp(e);
  stock(e, { jam: 2 });
  const c = ctx(e);
  handleSeasonsAction("sGift", { dataset: { id: "farmer:jam" } }, c);
  assert.equal(e.ss.trust.farmer, 1);
  handleSeasonsAction("sApprentice", { dataset: { id: "farmer:tieqiao" } }, c);
  assert.equal(e.ss.apprentice.pupil, "tieqiao");
  handleSeasonsAction("sApprentice", { dataset: { id: "stop" } }, c);
  assert.equal(e.ss.apprentice, null);
  festivalDay(e, 7);
  stock(e, { seedRadish: 4, seedPotato: 2, seedBean: 2 });
  handleSeasonsAction("sHost", { dataset: { id: "" } }, c);
  assert.ok(e.festivalHosted(7));
  let opened = null;
  handleSeasonsAction("sLink", { dataset: { id: "station:cook" } }, ctx(e, { showMenu: (m, a) => (opened = [m, a]) }));
  assert.equal(opened[0], "station");
  handleSeasonsAction("sLink", { dataset: { id: "station:canner" } }, ctx(e, { showMenu: (m, a) => (opened = [m, a]) }));
  assert.deepEqual(opened, ["build", { focusBuild: "canner" }]);
  handleSeasonsAction("sLink", { dataset: { id: "trader:food" } }, ctx(e, { showMenu: (m, a) => (opened = [m, a]) }));
  assert.equal(e.guidance.target.region, "market");
  assert.equal(handleSeasonsAction("oNothing", { dataset: {} }, c), false);
});

// ---------- 审查发现的回归 ----------
// v0.30「人情」：咬钩后按 E 不再直接钓上来，而是开始收线；收满了才上来
test("a bite next to 江伯 is hooked by E instead of opening his dialog", () => {
  const { e } = make();
  camp(e);
  let menu = null;
  const orig = e.emit.bind(e);
  e.emit = (type, data) => {
    if (type === "menu") menu = data;
    return orig(type, data);
  };
  Object.assign(e.s.player, { x: 990, y: 790 });
  assert.equal(e.startFishing(), true);
  e.c.fishing.phase = "bite";
  assert.doesNotMatch(e.context(e.nearestObject()) || "", /江伯/);
  // 池塘里钓上来的可能是原来那几种，也可能是回暖、秋收白天的鲫鱼：数一数图鉴里记下的条数
  const caught = () => Object.values(e.kin.fish).reduce((a, b) => a + b, 0);
  const fish = caught();
  e.interact();
  assert.equal(menu, null, "no dialog opened");
  assert.equal(e.c.fishing, null);
  assert.ok(e.reeling(), "the reel starts");
  e._reel.prog = 0.99;
  e.reelTick(0.1, true);
  assert.ok(!e.reeling());
  assert.equal(caught(), fish + 1);
});

test("the chooser never hides the object older rules would pick (backpack, terminal, plots)", () => {
  const { e } = make();
  camp(e);
  const sign = e.objects.find((o) => o.type === "sign");
  e.s.grave = { region: "farm", x: sign.x + 20, y: sign.y, items: {} };
  Object.assign(e.s.player, { x: sign.x + 20, y: sign.y + 10 });
  assert.deepEqual(e.pickCandidates(), [], "standing on a backpack");
  e.s.grave = null;
  Object.assign(e.s.player, { x: sign.x, y: sign.y + 12 });
  assert.deepEqual(e.pickCandidates(), [], "the terminal keeps its priority");
});

test("apprentice watering counts as real watering, also for abundant plots", () => {
  const { e } = make();
  camp(e);
  e.ss.skills.tieqiao = "water";
  const plots = e.s.plots.filter((p) => (p.region || "farm") === "farm").slice(0, 2);
  Object.assign(plots[0], { crop: "radish", growth: 0, wateredDay: 0, waterUnits: 0, trait: null });
  Object.assign(plots[1], { crop: "radish", growth: 0, wateredDay: 0, waterUnits: 0, trait: "abundant" });
  hour(e, 7);
  assert.ok(plots.every((p) => e.plotWatered(p)));
});

test("a lodger who stays shows up at the gate under their own name everywhere", () => {
  const { e, toasts } = make();
  camp(e);
  e.ss.pendingGuest = "赶路的木匠老韩";
  e.o.visitors.current = null;
  e.o.visitors.next = e.s.day;
  hour(e, 9);
  const v = e.o.visitors.current;
  assert.equal(v.name, "赶路的木匠老韩");
  assert.ok(toasts.some((t) => /赶路的木匠老韩/.test(t.text)));
  if (typeof v.story === "string" && /我叫/.test(v.story)) assert.match(v.story, /赶路的木匠老韩/);
  assert.ok(e.o.log.some((l) => /赶路的木匠老韩/.test(l.text)) || !e.o.log.length);
});

test("item links send hand-made recipes to the craft menu; the canteen cannot open at closing time; sleeping closes it", () => {
  const { e } = make();
  camp(e);
  assert.match(itemLinks(e, "wood"), /data-id="craft"|data-id="station:/);
  let opened = null;
  handleSeasonsAction("sLink", { dataset: { id: "craft" } }, ctx(e, { showMenu: (m) => (opened = m) }));
  assert.equal(opened, "craft");
  e.ss.he.stage = 4;
  e.s.day = 9;
  e.s.minute = 21 * 60 + 10;
  at(e, SSPOTS.plaza);
  stock(e, { stew: 2 });
  assert.match(e.canteenReason(), /21:00/);
  e.s.minute = 19 * 60 + 10;
  assert.equal(e.startCanteen(), true);
  go(e, "farm");
  Object.assign(e.s.player, { x: 330, y: 360 });
  e.sleep();
  assert.equal(e.ss.canteen.night, null);
});

test("秦奶奶 leaves after a week even if a wish is still open, so other lodgers can come again", () => {
  const { e } = make();
  camp(e);
  room(e, 600, 560);
  hour(e, 20);
  e.decideLodger("host");
  assert.equal(e.ss.qin.phase, "staying");
  e.s.day += 7;
  nextDay(e);
  assert.equal(e.ss.qin.phase, "left");
  assert.ok(!e.s.storage.oldPhoto, "no photo without all three wishes");
  e.ss.lodgerNext = e.s.day;
  hour(e, 20);
  assert.ok(e.ss.lodger && !e.ss.lodger.qin);
});
