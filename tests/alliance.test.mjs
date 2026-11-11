import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, needsStoryMigration } from "../dist/alliance.js";
import { Engine as GuidanceEngine, freshState as guidanceFresh } from "../dist/guidance-engine.js";
import { freshState as oldEngineFresh } from "../dist/engine.js";
import { districtDemoState } from "../dist/districts.js";
import { WELL_SPOT, TERMINAL_SPOT, WELL_COST, CAMP_COST, SUPPLY, storyGoal } from "../dist/alliance-data.js";
import { CROPS } from "../dist/data.js";

const make = (state = freshState()) => {
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  return { e, toasts };
};
const at = (e, spot, dy = 30) => Object.assign(e.s.player, { x: spot.x, y: spot.y + dy });
const plant = (e, ids = [0, 2]) => {
  for (const i of ids) {
    const p = e.s.plots[i];
    assert.ok(e.toolPlot(p, "hoe"));
    assert.ok(e.toolPlot(p, "seedRadish"));
    assert.ok(e.toolPlot(p, "water"));
  }
};
const bag = (e) => JSON.stringify([e.s.inventory, e.s.storage]);
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
// Plays act 1 with real actions only: field, well, camp, harvest, meal and the reply at the terminal.
function playAct1(e) {
  plant(e);
  at(e, WELL_SPOT);
  e.interact();
  const site = e.campSite();
  at(e, site);
  e.interact();
  e.advanceMinutes(200);
  for (const i of [0, 2]) assert.ok(e.harvest(e.s.plots[i]));
  at(e, { x: 830, y: 450 });
  e.checkStory();
  assert.ok(e.r.claimed.includes("harvest"));
  assert.ok(e.craft("trailBread"));
  e.advanceMinutes(25);
  assert.ok(e.collectProduction(e.c.production.find((j) => j.ready).id));
  assert.ok(e.r.claimed.includes("meal"), "a cost-free task is recorded as soon as it is achieved on the farm");
  at(e, TERMINAL_SPOT);
  e.interact();
}


test("while crops grow the task points to the well, and repairing it charges exactly once", () => {
  const { e, toasts } = make();
  plant(e);
  assert.equal(storyGoal(e).step.id, "well", "growing crops redirect to a nearby short goal");
  const stone = e.quantityForCost("stone", true),
    scrap = e.quantityForCost("scrap", true);
  e.s.plots[1].crop = "radish";
  e.s.plots[1].tilled = true;
  e.s.plots[1].growth = 0;
  e.s.plots[1].wateredDay = 0;
  at(e, WELL_SPOT);
  e.interact();
  assert.ok(e.sc.flags.well);
  assert.equal(e.quantityForCost("stone", true), stone - WELL_COST.stone);
  assert.equal(e.quantityForCost("scrap", true), scrap - WELL_COST.scrap);
  assert.ok(e.plotWatered(e.s.plots[1]), "the trough waters the first row immediately");
  assert.ok(toasts.some((t) => /水井修好了/.test(t.text)));
  const before = bag(e);
  assert.equal(e.repairWell(), false);
  e.interact();
  assert.equal(bag(e), before, "repeated well use never charges again");
  e.s.plots[1].wateredDay = 0;
  e.s.plots[12].crop = "radish";
  e.s.plots[12].tilled = true;
  e.s.plots[12].wateredDay = 0;
  e.advanceMinutes(1440 - e.s.minute + 1);
  assert.ok(e.plotWatered(e.s.plots[1]), "row one is watered again the next morning");
  assert.ok(!e.plotWatered(e.s.plots[12]) || ["小雨", "暴雨"].includes(e.s.weather), "other rows still need care");
});

test("missing materials or distance leave the well and camp unbuilt and nothing is deducted", () => {
  const { e, toasts } = make();
  e.s.inventory.stone = 1;
  delete e.s.inventory.scrap;
  at(e, WELL_SPOT);
  const before = bag(e);
  e.interact();
  assert.equal(e.sc.flags.well, false);
  assert.ok(toasts.some((t) => t.tone === "warn" && /修水井还缺/.test(t.text)));
  assert.equal(JSON.stringify(e.s.storage), JSON.parse(before)[1] && JSON.stringify(JSON.parse(before)[1]));
  e.s.inventory.stone = 8;
  e.s.inventory.scrap = 4;
  at(e, { x: 200, y: 900 });
  assert.equal(e.repairWell(), false);
  assert.equal(e.buildCamp(), false);
  assert.equal(e.s.inventory.stone, 8);
  e.s.inventory.wood = 2;
  at(e, e.campSite());
  assert.equal(e.buildCamp(), false);
  assert.equal(e.sc.camp, null);
  assert.equal(e.s.inventory.wood, 2);
  e.s.inventory.wood = 10;
  assert.ok(e.buildCamp());
  assert.equal(e.s.inventory.wood, 10 - CAMP_COST.wood);
  assert.equal(e.buildCamp(), false, "a second camp is never built");
  assert.equal(e.s.inventory.wood, 10 - CAMP_COST.wood);
});

test("act one through the real loop brings the helper, two meals and the residential mark exactly once", () => {
  const { e, toasts } = make();
  playAct1(e);
  assert.equal(e.sc.act, 2);
  assert.deepEqual(e.sc.claimed, ["act1"]);
  assert.equal(e.sc.helpers.length, 1);
  assert.equal(e.sc.helpers[0].id, "tieqiao");
  assert.equal(e.s.storage.bread, 2);
  assert.equal(e.guidance.target.region, "residential");
  assert.ok(toasts.some((t) => /小柒/.test(t.text)));
  assert.ok(e.events.some((x) => x.type === "menu" && x.menu === "journey"));
  const snapshot = bag(e);
  assert.equal(e.replyAlliance(), false);
  e.interact();
  assert.equal(e.sc.helpers.length, 1);
  assert.equal(bag(e), snapshot, "replying again gives nothing extra");
  assert.equal(storyGoal(e).step.id, "choice");
});

test("reply waits for every act one step and explains what is missing", () => {
  const { e, toasts } = make();
  at(e, TERMINAL_SPOT);
  assert.equal(e.canReply(), false);
  assert.equal(e.replyAlliance(), false);
  assert.ok(toasts.some((t) => /回信前还要：记录第一份收成、做出第一份干粮、修好水井、搭起援建营地/.test(t.text)));
  e.interact();
  assert.equal(e.sc.unread, false, "reading the terminal marks the letter read");
  assert.equal(e.sc.act, 1);
});

test("supply choice is a one-time real delivery and survives a full bag", () => {
  const { e } = make();
  playAct1(e);
  const radish = e.qty("seedRadish"),
    potato = e.qty("seedPotato");
  assert.ok(e.chooseSupply("ration"));
  assert.equal(e.qty("seedRadish"), radish + 6);
  assert.equal(e.qty("seedPotato"), potato + 4);
  assert.equal(e.r.farmPlan, "radish");
  assert.equal(e.chooseSupply("cotton"), false);
  assert.equal(e.qty("seedCotton", true), 6, "only the harvest reward cotton exists");
  const full = make();
  playAct1(full.e);
  const before = full.e.quantityForCost("seedCotton", true);
  full.e.canAdd = () => false;
  assert.ok(full.e.chooseSupply("cotton"));
  assert.equal(full.e.quantityForCost("seedCotton", true), before + 6, "seeds wait in storage when the bag is full");
  assert.equal(full.e.s.storage.cloth >= SUPPLY.cotton.items.cloth, true);
});

test("the helper eats real bread, carries finished goods, drops and debris, and slows down when hungry", () => {
  const { e, toasts } = make();
  playAct1(e);
  const h = e.sc.helpers[0];
  e.s.minute = 9 * 60;
  delete e.s.storage.bread;
  delete e.s.inventory.bread;
  e.c.workClock = 0;
  const hungry = toasts.length;
  e.workHour();
  assert.notEqual(h.fedDay, e.s.day);
  assert.ok(toasts.slice(hungry).some((t) => /今天还没吃上工作餐/.test(t.text)));
  e.s.minute = 10 * 60;
  e.workHour();
  assert.equal(toasts.filter((t) => /今天还没吃上工作餐/.test(t.text)).length, 1, "one reminder per day");
  e.s.minute = 11 * 60;
  e.workHour();
  assert.equal(h.task, "hungry");
  e.s.storage.bread = 3;
  e.s.minute = 13 * 60;
  e.c.production.push({
    id: "test-job",
    recipe: "trailBread",
    station: "cook",
    out: { bread: 2 },
    cost: { radish: 3 },
    remaining: 0,
    ready: true,
  });
  const food = e.r.metrics.food;
  e.workHour();
  assert.equal(h.fedDay, e.s.day);
  assert.equal(e.s.storage.bread, 3 - 1 + 2, "ate one, stored two");
  assert.equal(e.c.production.length, 0);
  assert.equal(e.r.metrics.food, food + 2);
  e.s.drops.push({ region: "farm", x: 700, y: 700, items: { ammo: 5 } });
  e.s.minute = 14 * 60;
  e.workHour();
  assert.equal(e.s.storage.ammo, 5);
  assert.equal(e.s.drops.length, 0);
  const debris = e.s.debris.length,
    moved = h.moved;
  e.s.minute = 15 * 60;
  e.workHour();
  assert.equal(e.s.debris.length, debris - 1);
  assert.equal(h.moved, moved + 1);
  e.s.minute = 21 * 60;
  e.workHour();
  assert.equal(h.task, "rest");
});


test("meals put fed residents and the helper at the table seats", () => {
  const { e } = make();
  playAct1(e);
  e.recruit("farmer");
  e.resident("farmer").fed = true;
  e.s.minute = 12 * 60;
  e.sc.helpers[0].fedDay = e.s.day;
  e.workHour();
  const seat = e.diningSeat(0);
  assert.deepEqual(e.resident("farmer").target, seat);
  assert.match(e.resident("farmer").status, /午饭/);
  assert.equal(e.sc.helpers[0].task, "meal");
});

test("cost-free main tasks are recorded on the farm only; delivery tasks still wait for confirmation", () => {
  const { e } = make();
  plant(e);
  e.advanceMinutes(200);
  for (const i of [0, 2]) e.harvest(e.s.plots[i]);
  e.s.region = "market";
  e.assignRegion();
  e.checkStory();
  assert.ok(!e.r.claimed.includes("harvest"));
  e.s.region = "farm";
  e.assignRegion();
  e.checkStory();
  assert.ok(e.r.claimed.includes("harvest"));
  const vet = make(districtDemoState()).e;
  vet.s.districts.demo = false;
  vet.r.claimed = ["harvest", "meal", "farmer", "table", "signal"];
  vet.r.metrics.medicine = 3;
  vet.s.inventory.bandage = 5;
  vet.s.inventory.herb = 5;
  vet.checkStory();
  assert.ok(!vet.r.claimed.includes("medical"), "physical delivery is never auto-confirmed");
});


test("story save data round-trips and corrupted story fields are refused", () => {
  const { e } = make();
  playAct1(e);
  e.chooseSupply("ration");
  const text = e.serialize();
  assert.deepEqual(Engine.parse(text).storyCampaign, JSON.parse(text).storyCampaign);
  const broken = [
    (s) => (s.storyCampaign.schema = 2),
    (s) => (s.storyCampaign.extra = 1),
    (s) => (s.storyCampaign.act = 1),
    (s) => (s.storyCampaign.choice = "gold"),
    (s) => (s.storyCampaign.claimed = ["act1", "act1"]),
    (s) => (s.storyCampaign.helpers[0].x = -50),
    (s) => (s.storyCampaign.helpers[0].id = "stranger"),
    (s) => (s.storyCampaign.flags.well = "yes"),
    (s) => (s.storyCampaign.letters = ["act10"]),
  ];
  for (const change of broken) {
    const s = JSON.parse(text);
    change(s);
    assert.throws(() => Engine.parse(JSON.stringify(s)), /联盟故事存档异常/);
  }
});



test("helper never steals the E key from a nearby field or facility", () => {
  const { e } = make();
  playAct1(e);
  const h = e.sc.helpers[0],
    p = e.s.plots[4];
  Object.assign(h, { x: p.x + 4, y: p.y });
  e.assignRegion();
  Object.assign(e.s.player, { x: p.x + 2, y: p.y + 2 });
  assert.equal(e.nearestObject().type, "plot");
  Object.assign(h, { x: 1300, y: 900 });
  e.assignRegion();
  Object.assign(e.s.player, { x: 1300, y: 930 });
  assert.equal(e.nearestObject().type, "allianceHelper");
  assert.match(e.context(e.nearestObject()), /铁锹/);
});

test("crops planted anywhere still finish growing and the story never blocks farming", () => {
  const { e } = make();
  const p = e.s.plots[30];
  e.s.debris = e.s.debris.filter((d) => Math.hypot(d.x - p.x, d.y - p.y) > 15);
  assert.ok(e.toolPlot(p, "hoe"));
  assert.ok(e.toolPlot(p, "seedRadish"));
  assert.ok(e.toolPlot(p, "water"));
  for (let i = 0; i < 40 && p.growth < CROPS.radish.grow; i++) e.advanceMinutes(30);
  assert.ok(e.harvest(p));
});

test("camp site avoids player buildings and is only chosen on the farm map", () => {
  const s = guidanceFresh();
  s.buildings.push({ id: "old-bed", type: "bed", x: 560, y: 740, rotation: 0, hp: 90 });
  const { e } = make(Engine.parse(JSON.stringify(s)));
  const site = e.campSite();
  assert.ok(site);
  assert.ok(Math.hypot(site.x - 560, site.y - 740) > 80, "an old bed keeps its place");
  assert.ok(e.campSpotFree(site));
  const away = make().e;
  away.sc.site = null;
  away.s.region = "residential";
  away.assignRegion();
  assert.equal(away.campSite(), null);
  assert.match(storyGoal(away).step.id === "camp" ? storyGoal(away).step.text : "回到农场", /回到农场|清理/);
  away.s.region = "farm";
  away.assignRegion();
  assert.ok(away.campSite());
});

test("after act two the residential neighbours trade one meal a day, never charging on a full bag", () => {
  const { e } = make();
  e.s.region = "residential";
  e.assignRegion();
  assert.ok(!e.objects.some((o) => o.type === "allianceNeighbors"), "closed before act two");
  e.s.region = "farm";
  e.assignRegion();
  playAct1(e);
  e.chooseSupply("ration");
  e.recruit("farmer");
  e.r.finds.push("seedArchive");
  e.checkStory();
  e.c.projects.market = 1;
  e.s.buildings.push({ id: "n-bench", type: "workbench", x: 1200, y: 760, rotation: 0, hp: 130 });
  e.s.buildings.push({ id: "n-bed", type: "bed", x: 1280, y: 880, rotation: 0, hp: 90 });
  e.resident("farmer").fed = true;
  e.checkStory();
  assert.equal(e.sc.act, 3);
  e.s.region = "residential";
  e.s.enemies.residential = [];
  e.assignRegion();
  const spot = e.objects.find((o) => o.type === "allianceNeighbors");
  assert.ok(spot);
  Object.assign(e.s.player, { x: spot.x, y: spot.y + 30 });
  e.s.inventory.bread = 0;
  delete e.s.inventory.bread;
  assert.equal(e.neighborAid(), false);
  e.s.inventory.bread = 2;
  const wood = e.qty("wood"),
    seeds = e.qty("seedRadish");
  const realAdd = e.canAdd;
  e.canAdd = () => false;
  assert.equal(e.neighborAid(), false);
  assert.equal(e.s.inventory.bread, 2, "full bag: nothing taken");
  e.canAdd = realAdd;
  e.interact();
  assert.equal(e.s.inventory.bread, 1);
  assert.equal(e.qty("wood"), wood + 3);
  assert.equal(e.qty("seedRadish"), seeds + 2);
  assert.equal(e.neighborAid(), false, "once per day");
  assert.equal(e.s.inventory.bread, 1);
  e.advanceMinutes(1440);
  e.s.inventory.bread = 1;
  Object.assign(e.s.player, { x: spot.x, y: spot.y + 30 });
  assert.ok(e.neighborAid());
  assert.equal(e.sc.neighborHelps, 2);
  assert.equal(Engine.parse(e.serialize()).storyCampaign.neighborHelps, 2);
});

