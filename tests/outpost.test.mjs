import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState } from "../dist/outpost.js";
import { Engine as AllianceEngine, freshState as allianceFresh } from "../dist/alliance.js";
import { TASKS } from "../dist/rebuild-data.js";
import { BUILDINGS, ITEMS } from "../dist/data.js";
import {
  UPKEEP,
  SPOTS,
  LATHE_COST,
  CARGO,
  TOLL_COST,
  BUNDLES,
  HOSPITAL_CHOICE,
  NPCS,
} from "../dist/outpost-data.js";
import { outpostGoal } from "../dist/outpost-story.js";
import {
  renderOutpost,
  renderOutpostJournal,
  handleOutpostAction,
  stationExtras,
  outpostHud,
  portrait,
} from "../dist/outpost-ui.js";
import { handleAllianceAction } from "../dist/alliance-ui.js";

const make = (state = freshState()) => {
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  return { e, toasts };
};
const at = (e, spot, dy = 20) => {
  if (e.s.region !== (spot.region || "farm")) e.travel(spot.region || "farm");
  Object.assign(e.s.player, { x: spot.x, y: spot.y + dy });
};
const home = (e) => {
  if (e.s.region !== "farm") e.travel("farm");
  Object.assign(e.s.player, { x: 830, y: 480 });
};
const snapshot = (e) => JSON.stringify([e.s.inventory, e.s.storage, e.s.money]);
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
// 只改故事进度字段，模拟已经走到第 n 段开头的存档。
function toAct(e, n) {
  const sc = e.sc;
  sc.act = n;
  sc.claimed = ["act1", "supply", "act2", ...[3, 4, 5, 6].filter((k) => k < n).map((k) => "act" + k)];
  sc.choice = "ration";
  sc.letters = ["act1", "act2", ...[3, 4, 5, 6, 7].filter((k) => k <= n).map((k) => "act" + k)];
  sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true;
  sc.camp = { x: 560, y: 735 };
  const lastTask = { 3: "table", 4: "hospitalDefense", 5: "warehouse", 6: "network", 7: "network" }[n];
  claimUpTo(e, lastTask);
  if (n >= 4) {
    e.o.hospital = "water";
  }
  if (n >= 5) {
    e.o.youke = true;
    e.o.lathe = { mode: "parts", day: 0 };
  }
  if (n >= 6) {
    e.o.cargo = "food";
    e.o.convoy = { departs: 0, arrives: 10, escorted: true, spawned: true, foes: [], done: true, lost: false };
  }
  e.assignRegion();
}
// 把时钟拨到某个整点之前，再推进一分钟，触发那个整点的结算。
function hour(e, h) {
  e.s.minute = h * 60 - 0.5;
  e.c.workClock = 59.5;
  e.advanceMinutes(1);
}

test("new saves start with outpost defaults, a food estimate and the new version", async () => {
  const { e } = make();
  assert.equal(e.o.schema, 1);
  assert.equal(e.o.raid.phase, "none");
  assert.deepEqual(e.o.crew, []);
  const hud = outpostHud(e);
  assert.match(hud.food.text, /^口粮 [\d.]+ 天$/);
  assert.equal(e.foodNeed(), UPKEEP.playerDaily, "a lone player needs their own two meals plus sleep");
  const v = await import("../dist/version.js");
  assert.match(v.GAME_VERSION, /^v0\.(1[4-9]|[2-9]\d)\.\d+$/, "later rounds keep a newer explicit version");
  assert.ok(v.GAME_EDITION.length > 0);
});

test("v0.13 saves without outpost data load unchanged and gain empty outpost state", () => {
  const old = new AllianceEngine(allianceFresh(), () => {});
  old.s.money = 321;
  old.s.storyCampaign.act = 2;
  old.s.storyCampaign.claimed = ["act1"];
  const text = old.serialize();
  assert.ok(!JSON.parse(text).outpost);
  const s = Engine.parse(text);
  assert.equal(s.money, 321);
  assert.equal(s.storyCampaign.act, 2);
  assert.equal(s.outpost.schema, 1);
  const { e } = make(s);
  assert.equal(e.storyGoal().act, 2, "acts one and two keep their v0.13 cards");
});

test("player hunger drains about 1.85x faster on top of the unified difficulty, and running low slows walking", () => {
  const a = new AllianceEngine(allianceFresh(), () => {});
  const { e } = make();
  a.paused = false;
  for (const x of [a, e]) Object.assign(x.s.player, { hunger: 90, x: 830, y: 480 });
  for (let i = 0; i < 100; i++) {
    a.update(0.05, {});
    e.update(0.05, {});
  }
  const ratio = (90 - e.s.player.hunger) / (90 - a.s.player.hunger);
  assert.ok(Math.abs(ratio - UPKEEP.playerHunger) < 0.05, "ratio " + ratio);
  e.s.player.hunger = 15;
  Object.assign(e.s.player, { x: 830, y: 480 });
  e.update(0.05, { x: 1, y: 0 });
  const slow = e.s.player.x - 830;
  e.s.player.hunger = 90;
  Object.assign(e.s.player, { x: 830, y: 480 });
  e.update(0.05, { x: 1, y: 0 });
  const normal = e.s.player.x - 830;
  assert.ok(slow < normal * 0.85 && slow > normal * 0.7, slow + " vs " + normal);
});

test("hunger warnings fire once per dip and starving at zero hunger ends in a faint, not a 1-HP limbo", () => {
  const { e, toasts } = make();
  e.s.player.hunger = 24;
  e.update(0.05, {});
  e.update(0.05, {});
  assert.equal(toasts.filter((t) => t.text.includes("肚子在叫")).length, 1);
  e.s.player.hunger = 9;
  e.update(0.05, {});
  assert.equal(toasts.filter((t) => t.text.includes("眼前发黑")).length, 1);
  Object.assign(e.s.player, { hunger: 0, hp: 2 });
  const money = e.s.money;
  for (let i = 0; i < 200 && !e.paused; i++) e.update(0.05, {});
  assert.ok(e.paused, "the faint opens the death menu");
  assert.equal(e.lastDeath, "hunger");
  assert.equal(e.events.filter((x) => x.type === "menu").at(-1).menu, "death");
  assert.ok(e.s.money < money);
  assert.ok(e.s.player.hunger > 0 && e.s.player.hp > 0);
});

test("sleeping costs extra hunger and opens a day summary with tomorrow's risks", () => {
  const { e } = make();
  home(e);
  e.s.player.hunger = 80;
  e.s.minute = 21 * 60;
  assert.ok(e.sleep());
  assert.ok(e.s.player.hunger <= 80 - 12 - UPKEEP.sleepHunger + 0.001);
  const ev = e.events.find((x) => x.type === "menu" && x.view === "summary");
  assert.ok(ev, "summary menu emitted");
  assert.ok(e.o.report.threats.some((t) => t.startsWith("口粮还能撑")));
  const html = renderOutpost(e, { view: "summary" });
  assert.match(html, /今天要留意/);
});

test("dinner at 18:00 feeds residents, helpers and crew from storage first; the hungry lose morale or speed", () => {
  const { e, toasts } = make();
  toAct(e, 3);
  e.recruit("farmer");
  e.addHelper("tieqiao");
  e.addCrew({ id: "v1", name: "冯岩", trait: "glutton", role: "carry", look: 0 });
  for (const k of Object.keys(e.s.storage)) delete e.s.storage[k];
  e.s.inventory.bread = 0;
  delete e.s.inventory.bread;
  e.s.storage.bread = 2;
  const morale = e.resident("farmer").morale;
  hour(e, 18);
  assert.equal(e.o.dinnerDay, e.s.day);
  assert.equal(e.s.storage.bread || 0, 0);
  assert.ok(e.o.missed.includes("c:v1"), "the big eater needs two at dinner");
  assert.ok(toasts.some((t) => t.text.startsWith("晚饭不够")));
  const before = JSON.stringify(e.o.missed);
  e.serveDinner();
  assert.equal(JSON.stringify(e.o.missed), before, "dinner is served once a day");
  // 第二天：昨晚没吃上的人干活慢一半。
  e.s.day++;
  e.s.minute = 9 * 60 + 1;
  const c = e.o.crew[0];
  c.fedDay = e.s.day;
  e.crewHour(c);
  assert.match(c.status, /慢一半/);
  assert.ok(e.resident("farmer").morale <= morale);
});

test("missing resident dinners cost morale and residents in storage-fed camps keep their spirits", () => {
  const { e } = make();
  toAct(e, 3);
  e.recruit("farmer");
  for (const k of Object.keys(e.s.storage)) delete e.s.storage[k];
  delete e.s.inventory.bread;
  const r = e.resident("farmer");
  r.morale = 60;
  hour(e, 18);
  assert.equal(r.morale, 52);
  assert.ok(e.o.missed.includes("r:farmer"));
});

test("the shipping box refuses protected items, returns goods on request and pays exactly once overnight", () => {
  const { e } = make();
  home(e);
  assert.equal(e.shipItem("hoe", 1), false, "tools are protected");
  e.s.inventory.radish = 5;
  assert.ok(e.shipItem("radish", 3));
  assert.equal(e.s.inventory.radish, 2);
  const each = e.shipPrice("radish");
  assert.ok(each >= ITEMS.radish.sell, "uses the best current trader price");
  assert.equal(e.shipValue(), each * 3);
  // 背包满时取不回来，也不丢东西。
  delete e.s.inventory.radish;
  const free = Object.keys(ITEMS).filter((id) => !e.s.inventory[id] && id !== "radish");
  while (Object.keys(e.s.inventory).filter((k) => e.s.inventory[k] > 0).length < e.capacity()) e.s.inventory[free.shift()] = 1;
  assert.equal(e.unshipItem("radish"), false);
  assert.equal(e.o.shipBox.radish, 3);
  const money = e.s.money;
  e.s.minute = 1439.5;
  e.c.workClock = 59.5;
  e.advanceMinutes(1);
  assert.equal(e.s.money, money + each * 3);
  assert.deepEqual(e.o.shipBox, {});
  assert.equal(e.o.ledger[0].income, each * 3);
  const reloaded = make(Engine.parse(e.serialize())).e;
  reloaded.onNewDay();
  assert.equal(reloaded.s.money, e.s.money, "reloading never pays twice");
});

test("rushing a station job halves the time once; incidents freeze it until fixed, and expire into real losses", () => {
  const { e, toasts } = make();
  home(e);
  e.s.inventory.radish = 9;
  assert.ok(e.craftBatch("trailBread", 1));
  const job = e.c.production[0];
  e.roll = () => 0.99;
  assert.ok(e.rushJob(job.id));
  assert.equal(job.remaining, 10);
  assert.equal(e.rushJob(job.id), false, "a batch can only be rushed once");
  e.s.inventory.radish = 9;
  assert.ok(e.craftBatch("trailBread", 1));
  const job2 = e.c.production[1];
  e.roll = () => 0.01;
  assert.ok(e.rushJob(job2.id));
  const inc = e.o.incidents[0];
  assert.equal(inc.type, "fire");
  assert.ok(Number.isInteger(inc.deadline));
  const left = job2.remaining;
  e.processProduction(5);
  assert.equal(job2.remaining, left, "a burning batch does not progress");
  e.c.water = 1;
  assert.equal(e.fixIncident(job2.id), false, "not enough water");
  assert.equal(e.o.incidents.length, 1);
  e.c.water = 2;
  assert.ok(e.fixIncident(job2.id));
  assert.equal(e.c.water, 0);
  // 第三批：不处理，期限到了就报废并损坏设施。
  e.s.inventory.radish = 9;
  assert.ok(e.craftBatch("trailBread", 1));
  const job3 = e.c.production.at(-1);
  assert.ok(e.rushJob(job3.id));
  const cook = e.s.buildings.find((b) => b.type === "cook");
  const hp = cook.hp;
  e.o.incidents[0].deadline = Math.floor(e.abs());
  e.checkIncidents();
  assert.ok(!e.c.production.includes(job3));
  assert.equal(cook.hp, Math.max(1, hp - Math.ceil(BUILDINGS.cook.hp * 0.2)));
  assert.ok(toasts.some((t) => t.text.includes("烧光")));
});

test("jams cost a machine part; a handy crew member clears them for free", () => {
  const { e } = make();
  home(e);
  e.c.production.push({ id: "job-x", recipe: "cloth", out: { cloth: 2 }, cost: { cotton: 3 }, station: "workbench", remaining: 30, ready: false });
  e.s.buildings.push({ id: "wb", type: "workbench", x: 1100, y: 600, rotation: 0, hp: BUILDINGS.workbench.hp });
  e.roll = () => 0.01;
  assert.ok(e.rushJob("job-x"));
  assert.equal(e.o.incidents[0].type, "jam");
  delete e.s.inventory.parts;
  delete e.s.storage.parts;
  const before = snapshot(e);
  assert.equal(e.fixIncident("job-x"), false);
  assert.equal(snapshot(e), before);
  e.addCrew({ id: "v2", name: "白桦", trait: "handy", role: "build", look: 1 });
  assert.deepEqual(e.incidentCost(e.o.incidents[0]), {});
  assert.ok(e.fixIncident("job-x"));
});

test("alliance bundles open in act three, never charge when short, deliver once and switch on their services", () => {
  const { e } = make();
  home(e);
  assert.match(e.bundleReason("workshop"), /第三段/);
  toAct(e, 3);
  home(e);
  for (const k of Object.keys(e.s.storage)) delete e.s.storage[k];
  const before = snapshot(e);
  assert.equal(e.deliverBundle("workshop"), false);
  assert.equal(snapshot(e), before);
  Object.assign(e.s.storage, { ...BUNDLES.workshop.items, wood: BUNDLES.workshop.items.wood + 3 });
  assert.ok(e.deliverBundle("workshop"));
  assert.equal(e.deliverBundle("workshop"), false);
  assert.equal(e.o.bundles.filter((b) => b === "workshop").length, 1);
  const fence = { id: "f1", type: "fence", x: 1300, y: 400, rotation: 0, hp: 1 };
  e.s.buildings.push(fence);
  const wood = e.qty("wood", true);
  assert.ok(e.repair("f1"));
  assert.equal(e.qty("wood", true), wood - 1);
  assert.equal(fence.hp, BUILDINGS.fence.hp);
  // 医院急救包：外出重伤时每天包扎一次。
  Object.assign(e.s.storage, BUNDLES.clinic.items);
  assert.ok(e.deliverBundle("clinic"));
  e.travel("residential");
  e.s.player.hp = 20;
  e.update(0.05, {});
  assert.ok(e.s.player.hp >= 49);
  e.s.player.hp = 20;
  e.update(0.05, {});
  assert.ok(e.s.player.hp < 30, "only once a day");
});

test("defence bundle lets towers fire without spending ammo", () => {
  const { e } = make();
  toAct(e, 3);
  home(e);
  e.o.bundles.push("defense");
  e.s.storage.ammo = 0;
  e._freeAmmo = true;
  assert.ok(e.takeFarm({ ammo: 1 }));
  e._freeAmmo = false;
  assert.equal(e.takeFarm({ ammo: 1 }), false);
});

test("the caravan arrives with four offers; inspecting, buying, fakes and exposure all change real state once", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  e.o.caravan.next = e.s.day;
  hour(e, 8);
  assert.ok(e.caravanHere());
  assert.equal(e.o.caravan.offers.length, 4);
  assert.ok(e.objects.some((o) => o.type === "outpostCaravan"));
  const offer = e.o.caravan.offers.find((o) => o.item) || e.o.caravan.offers[0];
  offer.item = "parts";
  offer.tech = null;
  offer.qty = 3;
  offer.fake = "scrap";
  offer.price = 50;
  e.roll = () => 0.99;
  assert.ok(e.inspectOffer(offer.key));
  assert.equal(offer.inspected, "unclear", "a failed look reveals nothing");
  assert.equal(e.inspectOffer(offer.key), false, "one look per offer");
  // 另一件看穿的假货不能再买。
  const other = e.o.caravan.offers.find((o) => o !== offer);
  Object.assign(other, { item: "medkit", tech: null, qty: 2, fake: "bandage", price: 40, inspected: null, sold: false });
  e.roll = () => 0;
  assert.ok(e.inspectOffer(other.key));
  assert.equal(other.inspected, "fake");
  e.s.money = 500;
  assert.equal(e.buyOffer(other.key), false);
  assert.equal(e.s.money, 500);
  e.s.money = 10;
  assert.equal(e.buyOffer(offer.key), false);
  assert.equal(offer.sold, false);
  e.s.money = 500;
  const price = e.offerPrice(offer);
  assert.ok(price > 50, "the toll raises prices before the raid is won");
  assert.ok(e.buyOffer(offer.key));
  assert.equal(e.s.money, 500 - price);
  assert.ok(e.s.inventory.scrap >= 3);
  assert.equal(e.buyOffer(offer.key), false, "sold goods cannot be bought twice");
  assert.equal(e.o.caravan.cheated.length, 1);
  assert.ok(e.exposeCheat());
  assert.equal(e.s.money, 500);
  assert.equal(e.exposeCheat(), false, "refund happens once");
  assert.equal(e.o.caravan.exposed, 1);
  hour(e, 20);
  assert.ok(!e.caravanHere());
  assert.equal(e.o.caravan.next, e.s.day + 4);
});

test("a full bag blocks caravan purchases without taking money", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  e.o.caravan.next = e.s.day;
  hour(e, 8);
  const offer = e.o.caravan.offers.find((o) => o.item) || e.o.caravan.offers[0];
  Object.assign(offer, { item: "medkit", tech: null, fake: null, qty: 2 });
  e.s.money = 999;
  delete e.s.inventory.medkit;
  const free = Object.keys(ITEMS).filter((id) => !e.s.inventory[id] && id !== "medkit");
  while (Object.keys(e.s.inventory).filter((k) => e.s.inventory[k] > 0).length < e.capacity()) e.s.inventory[free.shift()] = 1;
  assert.equal(e.buyOffer(offer.key), false);
  assert.equal(e.s.money, 999);
  assert.equal(offer.sold, false);
});

test("visitors queue at the gate from act three; accepting, rejecting and quarantine are one-time real decisions", () => {
  const { e, toasts } = make();
  home(e);
  hour(e, 9);
  assert.equal(e.o.visitors.current, null, "no visitors before act three");
  toAct(e, 3);
  e.o.visitors.next = e.s.day;
  e.o.visitors.count = 0;
  e.roll = () => 0.1;
  hour(e, 9);
  const v = e.o.visitors.current;
  assert.ok(v && v.kind === "honest");
  assert.ok(e.objects.some((o) => o.type === "outpostVisitor"));
  assert.ok(e.checkVisitor("body"));
  assert.equal(e.checkVisitor("body"), false);
  assert.ok(e.decideVisitor("accept"));
  assert.equal(e.o.crew.length, 1);
  assert.equal(e.decideVisitor("accept"), false, "nobody left to accept");
  // 满员时拒绝接纳，来访者留在门口。
  e.addCrew({ id: "v8", name: "甲", trait: "chatty", role: "carry", look: 0 });
  e.addCrew({ id: "v9", name: "乙", trait: "chatty", role: "carry", look: 1 });
  e.o.visitors.current = { ...v, id: "v7", name: "丙", checked: ["papers"] };
  assert.equal(e.decideVisitor("accept"), false);
  assert.ok(e.o.visitors.current);
  assert.ok(toasts.some((t) => t.text.includes("满员")));
  // 隔离要先给一份口粮。
  for (const k of Object.keys(e.s.storage)) delete e.s.storage[k];
  delete e.s.inventory.bread;
  assert.equal(e.decideVisitor("quarantine"), false);
  e.s.storage.bread = 1;
  assert.ok(e.decideVisitor("quarantine"));
  assert.equal(e.s.storage.bread || 0, 0);
  assert.ok(e.o.visitors.quarantine);
});

test("an accepted thief steals overnight and an accepted infected visitor makes the camp sick until treated", () => {
  const { e, toasts } = make();
  toAct(e, 3);
  home(e);
  e.o.visitors.current = { id: "v3", name: "祁冬", kind: "thief", huer: null, from: "x", role: "carry", trait: "diligent", look: 0, clues: { papers: "a", body: "b", bag: "c" }, story: "s", checked: ["papers"], day: 1 };
  assert.ok(e.decideVisitor("accept"));
  e.s.storage.bread = 8;
  e.s.storage.ammo = 20;
  e.visitorNight();
  assert.ok(!e.o.crew.some((c) => c.id === "v3"));
  assert.ok(e.s.storage.bread < 8 || e.s.storage.ammo < 20);
  assert.ok(toasts.some((t) => t.text.includes("溜了")));
  e.o.visitors.current = { id: "v4", name: "陆远", kind: "infected", huer: null, from: "x", role: "build", trait: "handy", look: 1, clues: { papers: "a", body: "b", bag: "c" }, story: "s", checked: ["papers"], day: 1 };
  assert.ok(e.decideVisitor("accept"));
  e.visitorNight();
  assert.ok(e.o.sick >= e.s.day);
  assert.ok(e.enemies.some((z) => z.type === "runner" && !z.dead), "the turned visitor attacks on the farm");
  for (const k of ["medkit", "bandage"]) {
    delete e.s.storage[k];
    delete e.s.inventory[k];
  }
  assert.equal(e.curePlague(), false);
  e.s.storage.bandage = 2;
  assert.ok(e.curePlague());
  assert.equal(e.o.sick, 0);
  assert.equal(e.curePlague(), false);
});

test("Hu Er's first two forged visits only cost a meal; the third genuine visit makes him a guard once", () => {
  const { e } = make();
  toAct(e, 3);
  home(e);
  e.s.storage.bread = 10;
  for (let stage = 0; stage < 3; stage++) {
    e.o.visitors.current = null;
    e.o.visitors.next = e.s.day;
    e.o.visitors.count = 1;
    e.o.visitors.huer = stage;
    hour(e, 9);
    const v = e.o.visitors.current;
    assert.equal(v.id, "huer");
    assert.equal(e.decideVisitor("quarantine"), false, "Hu Er refuses quarantine");
    assert.ok(e.decideVisitor("accept"));
    assert.equal(e.o.visitors.huer, stage + 1);
    assert.equal(e.o.crew.some((c) => c.id === "huer"), stage === 2);
  }
  const huer = e.o.crew.find((c) => c.id === "huer");
  assert.equal(huer.role, "guard");
  assert.ok(e.o.claimed.includes("huer"));
});

test("act three: hospital choice is one-off, water repairs charge only when affordable, patients turn into a helper", () => {
  const { e } = make();
  toAct(e, 3);
  home(e);
  claimUpTo(e, "medical");
  assert.equal(e.storyGoal().step.id, "hospitalChoice");
  for (const k of ["parts", "wood"]) {
    delete e.s.storage[k];
    delete e.s.inventory[k];
  }
  const before = snapshot(e);
  assert.equal(e.chooseStory("hospitalChoice", "water"), false);
  assert.equal(snapshot(e), before);
  assert.ok(e.chooseStory("hospitalChoice", "patients"));
  assert.equal(e.chooseStory("hospitalChoice", "water"), false);
  assert.ok(e.patientsHere());
  assert.ok(e.eaters().some((x) => x.key === "p:zou"));
  e.s.storage.bread = 4;
  hour(e, 18);
  assert.equal(e.o.patients.fedDays, 1);
  e.s.day++;
  e.s.storage.bread = 4;
  hour(e, 18);
  assert.ok(e.o.patients.done);
  assert.ok(e.o.crew.some((c) => c.id === "zou" && c.trait === "glutton"));
  claimUpTo(e, "hospitalDefense");
  const money = e.s.money;
  e.checkStory();
  assert.equal(e.sc.act, 4);
  assert.ok(e.sc.claimed.includes("act3"));
  assert.equal(e.s.money, money + 50);
  assert.ok(e.sc.letters.includes("act4"));
  e.checkStory();
  assert.equal(e.s.money, money + 50, "act rewards are paid once");
});

test("patients leave early when a dinner is missed", () => {
  const { e } = make();
  toAct(e, 3);
  home(e);
  assert.ok(e.chooseStory("hospitalChoice", "patients"));
  for (const k of Object.keys(e.s.storage)) delete e.s.storage[k];
  delete e.s.inventory.bread;
  hour(e, 18);
  assert.ok(e.o.patients.gone);
  assert.ok(!e.patientsHere());
  assert.ok(!e.o.crew.length);
});

test("act four: You Ke is found in the warehouse, the lathe needs her, the right place and materials, then runs at dinner", () => {
  const { e } = make();
  toAct(e, 4);
  home(e);
  claimUpTo(e, "power");
  assert.equal(e.storyGoal().step.id, "youke");
  assert.equal(e.rescueYouke(), false, "she is in the warehouse, not here");
  at(e, SPOTS.lathe);
  assert.equal(e.restoreLathe(), false, "nobody can fix it yet");
  at(e, SPOTS.youke);
  assert.ok(e.objects.some((o) => o.type === "outpostYouke"));
  assert.ok(e.doStory("youke"));
  assert.equal(e.doStory("youke"), false);
  at(e, SPOTS.lathe);
  for (const k of Object.keys(LATHE_COST)) {
    delete e.s.storage[k];
    delete e.s.inventory[k];
  }
  const before = snapshot(e);
  assert.equal(e.doStory("lathe"), false);
  assert.equal(snapshot(e), before);
  Object.assign(e.s.storage, LATHE_COST);
  assert.ok(e.doStory("lathe"));
  assert.equal(e.storyGoal().step.id, "latheMode");
  assert.ok(e.chooseStory("latheMode", "ammo"));
  e.s.storage.scrap = 2;
  delete e.s.storage.ammo;
  hour(e, 18);
  assert.equal(e.s.storage.ammo, 12);
  assert.equal(e.s.storage.scrap || 0, 0);
  e.latheRun();
  assert.equal(e.s.storage.ammo, 12, "one run per day");
});

test("act five: the mule wants a radish, the convoy can be escorted, and an unescorted convoy loses a third", () => {
  const { e } = make();
  toAct(e, 5);
  home(e);
  Object.assign(e.s.storage, CARGO.food.cost);
  for (const k of ["radish", "hardy_radish", "fine_radish"]) {
    delete e.s.storage[k];
    delete e.s.inventory[k];
  }
  const before = snapshot(e);
  assert.equal(e.chooseStory("cargo", "food"), false, "no radish, no mule");
  assert.equal(snapshot(e), before);
  e.s.storage.radish = 1;
  assert.ok(e.chooseStory("cargo", "food"));
  assert.equal(e.chooseStory("cargo", "medicine"), false);
  assert.equal(e.storyGoal().step.whileWaiting, "convoy", "the network step is shown while the convoy travels");
  at(e, SPOTS.escort);
  const foes = e.enemies.filter((z) => e.o.convoy.foes.includes(z.id));
  assert.equal(foes.length, 4);
  for (const z of foes) e.hurtEnemy(z, 999, 0, {});
  e.checkEscort();
  assert.ok(e.o.convoy.escorted);
  home(e);
  const money = e.s.money;
  e.advanceMinutes(260);
  e.arriveConvoy();
  assert.ok(e.o.convoy.done && !e.o.convoy.lost);
  assert.equal(e.s.money, money + 60);
  assert.equal(e.o.caravan.next, e.s.day + 1);
  e.arriveConvoy();
  assert.equal(e.s.money, money + 60, "arrival pays once");

  const b = make().e;
  toAct(b, 5);
  home(b);
  Object.assign(b.s.storage, CARGO.medicine.cost, { radish: 1 });
  assert.ok(b.chooseStory("cargo", "medicine"));
  const m = b.s.money;
  b.advanceMinutes(260);
  b.arriveConvoy();
  assert.ok(b.o.convoy.lost);
  assert.equal(b.s.money, m + 40);
});

test("act six: the toll can be paid or refused, preparation is one choice, and the cache must be visited", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  assert.equal(e.storyGoal().step.id, "toll");
  for (const k of Object.keys(TOLL_COST)) {
    delete e.s.storage[k];
    delete e.s.inventory[k];
  }
  const before = snapshot(e);
  assert.equal(e.chooseStory("toll", "pay"), false);
  assert.equal(snapshot(e), before);
  Object.assign(e.s.storage, TOLL_COST);
  assert.ok(e.chooseStory("toll", "pay"));
  assert.equal(e.o.raid.phase, "scheduled");
  assert.equal(e.o.raid.day, e.s.day + 3);
  assert.equal(e.chooseStory("toll", "refuse"), false);
  assert.ok(e.chooseStory("prep", "supply"));
  assert.equal(e.chooseStory("prep", "towers"), false);
  assert.equal(e.storyGoal().step.id, "cache");
  assert.equal(e.destroyCache(), false);
  const size = e.raidSize();
  at(e, SPOTS.cache);
  assert.ok(e.objects.some((o) => o.type === "outpostCache"));
  assert.ok(e.doStory("cache"));
  assert.equal(e.raidSize(), size - 4);
  assert.equal(e.doStory("cache"), false);
});

test("raiders telegraph with an aim line before shooting, take less damage in cover and retreat when hurt", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  e.chooseStory("toll", "refuse");
  const r = e.o.raid;
  e.s.day = r.day;
  e.s.minute = 1139.99;
  e.c.workClock = 59.5;
  e.update(0.05, {});
  e.update(0.05, {});
  assert.equal(r.phase, "warning");
  r.timer = 0.01;
  e.update(0.05, {});
  assert.equal(r.phase, "active");
  e.update(0.05, {});
  const z = e.enemies.find((x) => x.type === "raider");
  assert.ok(z);
  Object.assign(e.s.player, { x: 1150, y: 620 });
  Object.assign(z, { x: 1370, y: 620, cooldown: 0, aim: 0, post: null, path: [] });
  e.updateRaider(z, 0.05);
  assert.ok(z.aim > 0.8, "aims first");
  assert.equal(e.raidShots.length, 0, "no shot during the telegraph");
  e.updateRaider(z, 0.5);
  e.updateRaider(z, 0.5);
  assert.equal(e.raidShots.length, 1);
  const hp = e.s.player.hp;
  e.invulnerable = 0;
  for (let i = 0; i < 20 && e.raidShots.length; i++) e.updateRaidShots(0.05);
  assert.ok(e.s.player.hp < hp, "the shot hits a player who stayed in the aim line");
  z.cover = true;
  const zh = z.hp;
  e.hurtEnemy(z, 20, 0, {});
  assert.equal(Math.round(zh - z.hp), 12);
  z.cover = false;
  z.hp = z.maxHp * 0.3;
  e.updateRaider(z, 0.05);
  assert.ok(z.retreat);
});

test("winning a raid takes a prisoner, lowers prices and completes act six after deciding Yaozi's fate", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  e.chooseStory("toll", "refuse");
  e.chooseStory("prep", "lure");
  const r = e.o.raid;
  e.s.day = r.day;
  e.s.minute = 1139.99;
  e.update(0.05, {});
  e.update(0.05, {});
  r.timer = 0.01;
  e.update(0.05, {});
  const price = e.price("food", "seedRadish", "buy");
  e.invulnerable = 1e6;
  for (let t = 0; t < 4000 && r.phase === "active"; t++) {
    for (const z of e.enemies.filter((x) => x.type === "raider" && !x.dead)) e.hurtEnemy(z, 999, 0, { id: "pistol" });
    e.update(0.05, {});
    e.s.player.hp = 100;
  }
  assert.equal(r.phase, "won");
  assert.ok(r.report.won);
  assert.equal(e.o.prisoner, "held");
  assert.ok(e.o.cai.raiders >= 1 && e.o.cai.gunKills >= 1);
  assert.ok(e.price("food", "seedRadish", "buy") < price);
  assert.ok(e.objects.some((o) => o.type === "outpostPrisoner"));
  assert.equal(e.storyGoal().step.id, "yaozi");
  const money = e.s.money;
  assert.ok(e.chooseStory("yaozi", "interrogate"));
  assert.equal(e.chooseStory("yaozi", "release"), false);
  assert.equal(e.sc.act, 7);
  assert.ok(e.sc.letters.includes("act7"));
  assert.equal(e.s.money, money + 100);
  assert.equal(e.storyGoal(), null, "act seven hands back to the main task card");
});

test("losing a raid (or not being there) costs real stock and schedules a retry; dying mid-raid counts as a loss", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  e.chooseStory("toll", "refuse");
  e.travel("residential");
  Object.assign(e.s.storage, { bread: 10, ammo: 30, scrap: 20 });
  const r = e.o.raid;
  e.s.day = r.day;
  e.s.minute = 1139.99;
  e.update(0.05, {});
  e.update(0.05, {});
  assert.equal(r.phase, "scheduled", "auto-resolved and rescheduled");
  assert.equal(r.report.auto, true);
  assert.equal(r.report.won, false);
  assert.ok(Object.keys(r.report.lost).length > 0);
  assert.ok(e.s.storage.bread < 10);
  assert.equal(r.day, e.s.day + 2);
  assert.equal(r.tries, 1);
  assert.equal(e.raidSize(), 9, "a retry brings one more gunman");
  home(e);
  e.s.day = r.day;
  e.s.minute = 1139.99;
  e.update(0.05, {});
  e.update(0.05, {});
  r.timer = 0.01;
  e.update(0.05, {});
  assert.equal(r.phase, "active");
  e.die();
  assert.equal(r.phase, "scheduled");
  assert.equal(r.tries, 2);
  assert.ok(!e.enemies.some((z) => z.type === "raider"));
});

test("sleep is blocked when the raid would arrive overnight", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  e.chooseStory("toll", "refuse");
  e.s.day = e.o.raid.day;
  e.s.minute = 600;
  assert.equal(e.sleep(), false);
});

test("raiders are never written to the save; a reload mid-raid brings back the ones still standing", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  e.chooseStory("toll", "refuse");
  const r = e.o.raid;
  e.s.day = r.day;
  e.s.minute = 1139.99;
  e.update(0.05, {});
  e.update(0.05, {});
  r.timer = 0.01;
  e.update(0.05, {});
  for (let i = 0; i < 60; i++) e.update(0.05, {});
  const alive = e.enemies.filter((z) => z.type === "raider" && !z.dead).length;
  assert.ok(alive > 0);
  const text = e.serialize();
  assert.ok(!JSON.parse(text).enemies.farm.some((z) => z.type === "raider"));
  assert.ok(e.enemies.some((z) => z.type === "raider"), "serialising does not remove live raiders");
  const b = make(Engine.parse(text)).e;
  assert.equal(b.o.raid.phase, "active");
  assert.equal(b.o.raid.spawned, b.o.raid.killed + b.o.raid.retreated);
});

test("crew guards shoot nearby enemies with real ammo, scouts bring materials, builders repair", () => {
  const { e } = make();
  toAct(e, 3);
  home(e);
  e.addCrew({ id: "huer", name: "胡二", trait: "chatty", role: "guard", look: "huer" });
  const g = e.o.crew[0];
  Object.assign(g, { x: 1200, y: 420 });
  const z = e.enemy("slow", 1300, 420);
  e.enemies.push(z);
  e.s.storage.ammo = 3;
  delete e.s.inventory.ammo;
  const hp = z.hp;
  e.guardFire(0.05);
  assert.ok(z.hp < hp);
  assert.equal(e.s.storage.ammo, 2);
  e.addCrew({ id: "yaozi", name: "鹞子", trait: "diligent", role: "scout", look: "yaozi" });
  const s = e.o.crew.find((c) => c.id === "yaozi");
  s.fedDay = e.s.day;
  e.s.minute = 8 * 60 + 5;
  e.crewHour(s);
  assert.equal(s.outDay, e.s.day);
  const scrap = e.s.storage.scrap || 0;
  e.s.minute = 16 * 60 + 5;
  e.crewHour(s);
  assert.ok((e.s.storage.scrap || 0) > scrap);
  e.addCrew({ id: "v5", name: "苗青", trait: "handy", role: "build", look: 2 });
  const b = e.o.crew.find((c) => c.id === "v5");
  b.fedDay = e.s.day;
  const fence = { id: "f9", type: "fence", x: 1250, y: 500, rotation: 0, hp: 5 };
  e.s.buildings.push(fence);
  e.s.storage.wood = 5;
  const wood = e.qty("wood", true);
  e.s.minute = 10 * 60 + 5;
  e.crewHour(b);
  assert.ok(fence.hp > 5);
  assert.equal(e.qty("wood", true), wood - 1);
});

test("Cai Glasses' challenges pay their weapon parts once, only after the real count", () => {
  const { e } = make();
  toAct(e, 4);
  home(e);
  assert.equal(e.claimCai("gunKills"), false);
  e.o.cai.gunKills = 10;
  assert.ok(e.claimCai("gunKills"));
  assert.ok(e.qty("extendedMag", true) >= 1);
  assert.equal(e.claimCai("gunKills"), false);
  e.travel("market");
  assert.ok(e.objects.some((o) => o.type === "outpostCai"));
});

test("You Ke's gadgets cost real materials and work: the alarm adds warning time once per wave", () => {
  const { e } = make();
  toAct(e, 5);
  home(e);
  e.addCrew({ id: "youke", name: "尤可", trait: "nightowl", role: "build", look: "youke" });
  for (const k of ["scrap", "parts"]) {
    delete e.s.storage[k];
    delete e.s.inventory[k];
  }
  assert.equal(e.buildGadget("alarm"), false);
  Object.assign(e.s.storage, NPCS.youke.gadgets.alarm.cost);
  assert.ok(e.buildGadget("alarm"));
  assert.equal(e.buildGadget("alarm"), false);
  e.s.horde = { phase: "warning", timer: 90, remaining: 8, spawnTimer: 0, direction: 0 };
  e.alarmBoost();
  e.alarmBoost();
  assert.equal(e.s.horde.timer, 135);
});

test("story save data round-trips; corrupted or inconsistent outpost fields are refused", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  e.chooseStory("toll", "refuse");
  e.shipItem("bread", 1);
  const text = e.serialize();
  const s = Engine.parse(text);
  assert.deepEqual(s.outpost, JSON.parse(text).outpost);
  const bad = (mut) => {
    const raw = JSON.parse(text);
    mut(raw);
    assert.throws(() => Engine.parse(JSON.stringify(raw)));
  };
  bad((r) => (r.outpost.schema = 2));
  bad((r) => (r.outpost.unknown = 1));
  bad((r) => (r.outpost.raid.phase = "party"));
  bad((r) => (r.outpost.prisoner = "held"));
  bad((r) => (r.outpost.shipBox = { notAnItem: 1 }));
  bad((r) => (r.outpost.crew = [{ id: "x" }]));
  bad((r) => (r.outpost.cargo = null));
  bad((r) => (r.outpost.toll = null));
  bad((r) => (r.storyCampaign.act = 8));
  bad((r) => (r.storyCampaign.claimed = r.storyCampaign.claimed.filter((x) => x !== "act5")));
});

test("journal story cards offer every new choice with a cost/gain/impact preview and the buttons act through the engine", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  const html = renderOutpostJournal(e, {});
  assert.match(html, /灰隼团要过路费/);
  assert.match(html, /class="consequence"/);
  assert.match(html, /outpost-strip/);
  assert.match(html, /data-action="aStoryChoose" data-id="refuse"/);
  handleAllianceAction("aStoryChoose", { dataset: { id: "refuse" } }, ctx(e, { ui: {} }));
  assert.equal(e.o.toll, "refuse");
  const html2 = renderOutpostJournal(e, {});
  assert.match(html2, /选一种备战方式/);
});

test("outpost menus render with portraits and every button is handled", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  e.addCrew({ id: "youke", name: "尤可", trait: "nightowl", role: "build", look: "youke" });
  e.o.caravan.next = e.s.day;
  hour(e, 8);
  e.o.visitors.current = { id: "v3", name: "祁冬", kind: "honest", huer: null, from: "x", role: "carry", trait: "diligent", look: 0, clues: { papers: "a", body: "b", bag: "c" }, story: "s", checked: ["papers"], day: 1 };
  e.s.inventory.radish = 3;
  const views = [
    ["shipping", ""],
    ["caravan", ""],
    ["review", ""],
    ["lathe", ""],
    ["crew", "youke"],
    ["dialog", "cai"],
    ["dialog", "hongshu"],
    ["log", ""],
    ["ledger", ""],
    ["bundles", ""],
  ];
  const handled = new Set();
  for (const [view, id] of views) {
    const html = renderOutpost(e, { view, id, toastLog: [{ text: "x", tone: "warn", time: "第1天" }] });
    assert.ok(html.length > 50, view);
    for (const m of html.matchAll(/data-action="(o[A-Z]\w+)"/g)) handled.add(m[1]);
  }
  assert.match(renderOutpost(e, { view: "caravan" }), /<svg class="portrait"/);
  for (const a of handled) assert.ok(handleOutpostAction(a, { dataset: { id: "" } }, ctx(e)), a + " handled");
  assert.ok(portrait("tangjiu").startsWith("<svg"));
  assert.ok(portrait(2).includes("rect"));
});

test("shipping and review buttons change real state through the UI handler", () => {
  const { e } = make();
  toAct(e, 3);
  home(e);
  e.s.inventory.radish = 4;
  const c = ctx(e);
  handleOutpostAction("oShip", { dataset: { id: "radish:all" } }, c);
  assert.equal(e.o.shipBox.radish, 4);
  handleOutpostAction("oUnship", { dataset: { id: "radish" } }, c);
  assert.equal(e.s.inventory.radish, 4);
  e.o.visitors.current = { id: "v3", name: "祁冬", kind: "honest", huer: null, from: "x", role: "carry", trait: "diligent", look: 0, clues: { papers: "a", body: "b", bag: "c" }, story: "s", checked: ["papers"], day: 1 };
  handleOutpostAction("oCheck", { dataset: { id: "bag" } }, c);
  assert.ok(e.o.visitors.current.checked.includes("bag"));
  let closed = false;
  handleOutpostAction("oVisitor", { dataset: { id: "accept" } }, ctx(e, { closeMenu: () => (closed = true) }));
  assert.ok(closed);
  assert.equal(e.o.crew.length, 1);
});

test("station menus list rush and incident controls with previews", () => {
  const { e } = make();
  home(e);
  e.s.inventory.radish = 3;
  assert.ok(e.craftBatch("trailBread", 1));
  const cook = e.s.buildings.find((b) => b.type === "cook");
  let html = stationExtras(e, cook);
  assert.match(html, /data-action="oRush"/);
  assert.match(html, /剩余时间减半/);
  e.roll = () => 0.01;
  handleOutpostAction("oRush", { dataset: { id: e.c.production[0].id } }, ctx(e));
  html = stationExtras(e, cook);
  assert.match(html, /data-action="oFix"/);
  assert.match(html, /起火/);
});

test("HUD shows food days with danger tone and a live raid banner", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  for (const k of Object.keys(e.s.storage)) delete e.s.storage[k];
  delete e.s.inventory.bread;
  assert.equal(outpostHud(e).food.tone, "danger");
  e.s.storage.bread = 40;
  assert.equal(outpostHud(e).food.tone, "ok");
  e.chooseStory("toll", "refuse");
  e.o.raid.phase = "warning";
  e.o.raid.timer = 30;
  assert.match(outpostHud(e).raid, /30 秒后进攻/);
});

test("the old rebuild outpost construction sites keep their own E action", () => {
  const { e } = make();
  toAct(e, 3);
  e.travel("warehouse");
  const site = e.objects.find((o) => o.type === "outpost");
  if (!site) return;
  Object.assign(e.s.player, { x: site.x, y: site.y + 10 });
  const spy = [];
  e.outpostInteract = (o) => spy.push(o.type);
  e.interact();
  assert.deepEqual(spy, []);
});

test("an expired incident on a supply-plan batch leaves a loadable save and frees the plan slot", () => {
  const { e } = make();
  home(e);
  e.c.production.push({ id: "job-auto", recipe: "trailBread", out: { bread: 2 }, cost: { radish: 3 }, station: "cook", remaining: 20, ready: false });
  e.u.autoJobs.push("job-auto");
  e.roll = () => 0.01;
  assert.ok(e.rushJob("job-auto"));
  e.o.incidents[0].deadline = Math.floor(e.abs());
  e.checkIncidents();
  assert.ok(!e.u.autoJobs.includes("job-auto"));
  assert.ok(Engine.parse(e.serialize()));
});

test("a burning supply-plan batch stays frozen through sleep instead of being stored", () => {
  const { e } = make();
  home(e);
  e.c.production.push({ id: "job-auto2", recipe: "trailBread", out: { bread: 2 }, cost: { radish: 3 }, station: "cook", remaining: 20, ready: false });
  e.u.autoJobs.push("job-auto2");
  e.roll = () => 0.01;
  assert.ok(e.rushJob("job-auto2"));
  const left = e.c.production.find((j) => j.id === "job-auto2").remaining;
  e.processProduction(30);
  const job = e.c.production.find((j) => j.id === "job-auto2");
  assert.ok(job && !job.ready && job.remaining === left && job.station === "cook");
});

test("dying mid-raid shows the raid report after the faint and keeps the loot record", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  e.chooseStory("toll", "refuse");
  const r = e.o.raid;
  e.s.day = r.day;
  e.s.minute = 1139.99;
  e.update(0.05, {});
  e.update(0.05, {});
  r.timer = 0.01;
  e.update(0.05, {});
  e.events = [];
  e.die();
  const menus = e.events.filter((x) => x.type === "menu");
  assert.equal(menus.at(-1).view, "raid");
  assert.equal(r.report.won, false);
  assert.match(renderOutpostJournal(e, {}), /上次战报/);
});

test("an infected recruit turns at the farm camp even when the night passes elsewhere", () => {
  const { e } = make();
  toAct(e, 3);
  home(e);
  e.o.visitors.current = { id: "v6", name: "韩霜", kind: "infected", huer: null, from: "x", role: "carry", trait: "chatty", look: 1, clues: { papers: "a", body: "b", bag: "c" }, story: "s", checked: ["papers"], day: 1 };
  assert.ok(e.decideVisitor("accept"));
  e.travel("residential");
  const before = e.enemies.length;
  e.visitorNight();
  assert.equal(e.enemies.length, before, "the residential map gains no runner");
  assert.ok(e.s.enemies.farm.some((z) => z.type === "runner" && !z.dead));
});

test("the farmhouse offers waiting until 19:00 so raid day never needs real-time idling", () => {
  const { e } = make();
  toAct(e, 6);
  home(e);
  e.chooseStory("toll", "refuse");
  e.s.day = e.o.raid.day;
  e.s.minute = 600;
  assert.equal(e.sleep(), false);
  assert.ok(e.waitUntilNight());
  e.update(0.05, {});
  assert.equal(e.o.raid.phase, "warning");
});
