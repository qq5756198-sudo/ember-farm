// v0.42.0「删繁」：一物一用方案第二版。设施 36 样变 26 样（拆掉的退料、并掉的折算）；种地只留种、浇、收和一种肥；
// 营地一个士气；动静、电台节目和指令、机床加急、改良、手气签、夜里的抉择、鸽子、纸条、假货、垫付、鼎丰、偷东西去掉；
// 天赋按顺序自己学；地区仓库并进农场仓库；喜好明着写；麦穗只要摸。旧档读进来只转换一次，升级前那一份留着。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
// 先用 v0.41 的引擎（下面那一层）做一份旧档：这时删繁那一层的数和字还没改
import { Engine as OldEngine } from "../dist/clear.js";
import { newGameState as oldNewGame } from "../dist/simple.js";
import { Engine, freshState, newGameState, needsStoryMigration } from "../dist/campaign.js";
import * as UI from "../dist/campaign-ui.js";
import { statusRows } from "../dist/look-ui.js";
import { ITEMS, BUILDINGS, CROPS } from "../dist/data.js";
import { BUILD_GROUPS, HUD_CARD, MENUS } from "../dist/simple-data.js";
import { MESSAGE_VIEWS } from "../dist/simple-ui.js";
import { FERTS } from "../dist/bounty-data.js";
import { TALENTS } from "../dist/thief-data.js";
import { MUSHROOM } from "../dist/almanac-data.js";
import { prefsOf } from "../dist/kin-data.js";
import { GAME_VERSION, GAME_EDITION, GAME_RELEASE } from "../dist/version.js";
import { preserveBeforeUpgrade, readCampaign, writeCampaign, UPGRADE_CHECKPOINT, CAMPAIGN_SAVE, CAMPAIGN_BACKUP } from "../dist/player-session.js";
import {
  REFUND_TYPES,
  WINE_JAR,
  PICKLE_JAR,
  DECOR_LOOKS,
  DECOR_TILE,
  FINE,
  SOIL_FLAT,
  FERT,
  SPRINKLE,
  CANAL_R,
  MORALE,
  MORALE_FACTORS,
  TALENT_ORDER,
  CONVERT_TITLE,
  REST,
  ECO_ORDER,
  buildCount,
  jarRecipe,
} from "../dist/trim-data.js";
import { trimUiOn, dropBlock, dropActions, handleTrimAction } from "../dist/trim-ui.js";
import { Renderer as TrimRenderer } from "../dist/trim-renderer.js";
import { Renderer as ClearRenderer } from "../dist/clear-renderer.js";
import { Renderer as CampaignRenderer } from "../dist/campaign-renderer.js";

const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|Joja|祝尼魔|星之果实|\[object Object\]/;

// ================= 一份 v0.41 的旧档 =================
// 第 42 天：雨水桶（改良过）、太阳能板、照看机、药柜、正在酿的土酒坛、一把椅子一盏灯；提质肥保水肥、特性种子；
// 三个人心情 40/80/66、一个伤员、一条法令、出货箱挂着牌、欠贺满仓的垫付、鸽舍、妙手经验和一个妙手天赋、两处地区仓库、路上存的物资
function buildOld() {
  const old = new OldEngine(oldNewGame("farmer"), () => {});
  const s = old.s;
  s.day = 42;
  for (const id of ["farmer", "medic", "mechanic"]) old.recruit(id);
  s.colony.residents.forEach((r, i) => (r.morale = [40, 80, 66][i]));
  const put = (type, x, y, extra = {}) => {
    const b = { id: "old-" + type + "-" + s.idCounter++, type, x, y, rotation: 0, hp: BUILDINGS[type].hp, ...extra };
    s.buildings.push(b);
    return b;
  };
  put("rain", 600, 640, { hnUp: "big" });
  put("solar", 660, 640);
  put("drone", 720, 640);
  put("medCabinet", 500, 235);
  const jar = put("alWineJar", 760, 520);
  old.al.jars[jar.id] = { item: "corn", n: 4, start: 40 };
  put("chair", 420, 300);
  put("lamp", 450, 300);
  s.inventory.fertCare = 2;
  s.storage.fertWater = 3;
  s.inventory.seed_radish_early = 4;
  const farm = s.plots.filter((p) => p.region !== "valley");
  Object.assign(farm[0], { tilled: true, crop: "radish", growth: 10, trait: "early", fertility: 30 });
  old.injure("r:farmer", "老周");
  s.winter.decrees = ["curfew"];
  s.tidy.listing = [{ id: "list-1", item: "potato", qty: 4 }];
  s.far.hemc = { phase: "open", debt: { type: "coop", total: { wood: 10 }, paid: { wood: 4 }, day: 30 }, advances: 1 };
  s.hope.goods.dove = 30;
  s.skills.thiefXp = 120;
  s.skills.talents = ["pickpocket"];
  s.districts.stores.valley = { wood: 5 };
  s.beyond.stores.pinewood = { resin: 3 };
  s.echoes.caches = [{ id: "c1", region: "warehouse", x: 300, y: 300, items: { scrap: 7 } }];
  s.bustle.noise.v = 3;
  s.frontier.canals.open = false;
  return { text: old.serialize(), jar: jar.id, plot: farm[0].id };
}
const OLD = buildOld();
const OLD_GROUPS = 39;

const make = (state = newGameState("farmer")) => {
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  if (e.dy) e.dy.pending = null;
  return { e, toasts };
};
const said = (toasts, re) => toasts.some((t) => re.test(t.text));
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
const put = (e, type, x, y, extra = {}) => {
  const b = { id: "t-" + type + "-" + e.s.idCounter++, type, x, y, rotation: 0, hp: BUILDINGS[type].hp, ...extra };
  e.s.buildings.push(b);
  e.navRevision = (e.navRevision || 0) + 1;
  return b;
};
// 直接种上一块田（不走手）
const sow = (e, p, crop = "radish", frac = 0) => {
  e.s.debris = e.s.debris.filter((d) => Math.hypot(d.x - p.x, d.y - p.y) >= 15);
  Object.assign(p, { tilled: true, crop, growth: Math.round(CROPS[crop].grow * frac), trait: null, wateredDay: 0, waterUnits: 0 });
  if (e.g) e.g.plots[p.id] = { c: 50, pd: e.s.day, t: 0, wd: 0, w: 0, b: 0, cv: 0, rot: 0, pk: 0 };
  delete e.tr.dry[p.id];
  return p;
};
const bare = (e) => {
  for (const p of e.s.plots) Object.assign(p, { crop: null, growth: 0, wateredDay: 0 });
  e.s.buildings = e.s.buildings.filter((b) => !["rain", "irrigation", "drone", "greenhouse"].includes(b.type));
  if (e.sc?.flags) e.sc.flags.well = false;
};
const mem = () => {
  const m = new Map();
  return { m, getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
};
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });

// ================= 版本 =================
test("version: v0.42.0 删繁 in the title, the loading page and settings", () => {
  assert.equal(GAME_VERSION, "v0.42.0");
  assert.equal(GAME_EDITION, "删繁");
  assert.equal(GAME_RELEASE, "v0.42.0 · 删繁");
  const html = read("dist/index.html");
  assert.match(html, /<title>余烬农场 v0.42.0 · 删繁<\/title>/);
  assert.match(html, /data-release>v0.42.0 · 删繁</);
  assert.match(read("dist/game.js"), /document\.title=`余烬农场 \$\{GAME_VERSION\} · \$\{GAME_EDITION\}`/);
  assert.match(read("dist/game.js"), /\[data-version\]/, "settings shows the version");
});

// ================= 旧档：转换一次，退料对得上，升级前那一份留着 =================
test("an old save: the before-upgrade copy is kept, removed facilities are refunded once, and loading it twice refunds nothing more", () => {
  assert.equal("trim" in JSON.parse(OLD.text), false, "made by the v0.41 engine");
  assert.equal(needsStoryMigration(OLD.text), true);
  const store = mem();
  store.setItem(CAMPAIGN_SAVE, OLD.text);
  assert.equal(preserveBeforeUpgrade(store, needsStoryMigration), true);
  assert.equal(JSON.parse(store.getItem(UPGRADE_CHECKPOINT)).main, OLD.text, "the exact old bytes are kept");
  const info = readCampaign(store, Engine.parse);
  assert.ok(info.state && !info.recovered);
  const before = JSON.parse(OLD.text);
  const { e, toasts } = make(info.state);
  // 设施：四样拆掉，土酒坛换成腌缸（坛里的照样在），椅子灯还在
  for (const t of REFUND_TYPES) assert.ok(!e.s.buildings.some((b) => b.type === t), t + " is gone");
  // 拆掉的原来的样子记在档里（只记）
  assert.deepEqual(e.tr.conv.removed.map((b) => b.type).sort(), [...REFUND_TYPES].sort());
  assert.equal(e.tr.conv.removed.find((b) => b.type === "rain").hnUp, "big");
  const jar = e.s.buildings.find((b) => b.id === OLD.jar);
  assert.equal(jar.type, PICKLE_JAR);
  assert.deepEqual(e.al.jars[OLD.jar], { item: "corn", n: 4, start: 40 }, "the brew keeps going");
  assert.equal(e.jarOf(OLD.jar).J.verb, "酿", "corn brews in the pickle jar");
  assert.ok(e.s.buildings.some((b) => b.type === "chair") && e.s.buildings.some((b) => b.type === "lamp"));
  // 退料：四样的材料 + 雨水桶改良的布 + 药柜，地区仓库、路上存的、挂牌的
  const cost = (t) => BUILDINGS[t].cost;
  const want = {};
  const addB = (b) => Object.entries(b).forEach(([k, n]) => (want[k] = (want[k] || 0) + n));
  for (const t of REFUND_TYPES) addB(cost(t));
  addB({ cloth: 2 }); // 雨水桶的改良
  addB({ wood: 5, resin: 3, scrap: 7, potato: 4 });
  assert.deepEqual(e.tr.conv.items, want);
  for (const [k, n] of Object.entries(want)) assert.equal((e.s.storage[k] || 0) - (before.storage[k] || 0), k === "fertWater" ? n - 3 : n, k);
  assert.equal(e.s.money - before.money, 9000, "the dove loft is paid back");
  // 东西：肥并成一种，特性种子一颗换两颗
  assert.equal(e.s.inventory.fertCare || 0, 0);
  assert.equal(e.s.storage.fertWater || 0, 0);
  assert.equal((e.s.inventory[FERT.id] || 0) + (e.s.storage[FERT.id] || 0), 5);
  assert.equal(e.s.inventory.seed_radish_early || 0, 0);
  assert.equal(e.s.inventory.seedRadish, (before.inventory.seedRadish || 0) + 8);
  const p = e.plotById(OLD.plot);
  assert.equal(p.trait, null);
  assert.equal(p.fertility, SOIL_FLAT);
  // 人：一个士气（三个人的平均），伤员当天就好，法令取消
  assert.equal(e.tr.morale, 62);
  assert.ok(e.c.residents.every((r) => r.morale === 62 && !r.fatigue && r.status !== "受伤了"));
  assert.deepEqual(e.hn.hurt, {});
  assert.deepEqual(e.w.decrees, []);
  // 别的：动静清零、挂牌取下、垫付结清、妙手经验折给探索（天赋退点重学）、闸门开着
  assert.equal(e.hn.noise.v, 0);
  assert.deepEqual(e.td.listing, []);
  assert.equal(e.fr.hemc.debt, null);
  assert.equal(e.s.skills.thiefXp, 0);
  assert.ok(e.s.xp.exploration >= 120);
  assert.ok(!e.sk.talents.some((id) => TALENTS[id]?.skill === "thief"), "the thief talent's point comes back");
  assert.deepEqual(e.sk.talents, TALENT_ORDER.slice(0, e.sk.talents.length), "and goes to the talents in order");
  assert.equal(e.f.canals.open, true);
  assert.deepEqual(e.d.stores.valley, {});
  assert.deepEqual(e.b.stores.pinewood, {});
  assert.deepEqual(e.v.caches, []);
  // 消息里的那一条
  const lines = e.trConvLines();
  for (const re of [/拆掉了 雨水桶 ×1/, /土酒坛 ×1 换成了腌缸/, /全营士气 62/, /鸽舍拆了，9000 金币/, /妙手的经验 120 折给了探索/, /退进仓库的：/, /退回的金币：9000/]) assert.ok(lines.some((l) => re.test(l)), String(re));
  e.update(1 / 30, {});
  assert.ok(said(toasts, /删繁：营地里一样东西只做一件事/), "said once when the game starts");
  const n = toasts.length;
  e.update(1 / 30, {});
  assert.equal(toasts.filter((t) => /删繁：/.test(t.text)).length, 1, "only once");
  assert.ok(toasts.length >= n);
  const page = UI.renderCampaignView(e, { view: "trConv" });
  assert.match(page, /第 42 天读进来时/);
  assert.doesNotMatch(page, DEV);
  assert.ok(MESSAGE_VIEWS.some(([id, name]) => id === "trConv" && name === CONVERT_TITLE), "the messages menu lists it");
  // 存一次：旧档进了备用那一格；再读不再退
  const text = e.serialize();
  assert.equal(needsStoryMigration(text), false);
  writeCampaign(store, text, Engine.parse);
  assert.equal(store.getItem(CAMPAIGN_BACKUP), OLD.text, "the old save is the backup after the first save");
  assert.equal(preserveBeforeUpgrade(store, needsStoryMigration), false);
  assert.equal(JSON.parse(store.getItem(UPGRADE_CHECKPOINT)).main, OLD.text, "the checkpoint is not replaced");
  const again = make(readCampaign(store, Engine.parse).state).e;
  assert.deepEqual(again.s.storage, e.s.storage, "no second refund");
  assert.equal(again.s.money, e.s.money);
  assert.deepEqual(again.tr.conv.items, e.tr.conv.items);
  assert.equal(again.tr.conv.told, true);
  assert.deepEqual(again.sk.talents, e.sk.talents);
  // 同一份旧档读两回，结果一样（不碰随机数）
  const twice = make(Engine.parse(OLD.text)).e;
  assert.deepEqual(twice.s.storage, e.s.storage);
  assert.deepEqual(twice.tr.conv.notes, e.tr.conv.notes);
});

test("a new game has nothing to convert: no message entry, the canal gate is open, morale starts at 60", () => {
  for (const s of [freshState(), newGameState("farmer"), newGameState("medic")]) {
    assert.equal(s.trim.conv, null);
    assert.equal(s.trim.morale, MORALE.start);
    assert.equal(s.frontier.canals.open, true);
  }
  const { e, toasts } = make();
  e.update(1 / 30, {});
  assert.ok(!said(toasts, /删繁：/));
  assert.deepEqual(e.trConvLines(), []);
  assert.match(UI.renderCampaignView(e, { view: "trConv" }), /没有内容/);
  // 存档坏了的删繁记录读不进来（原档留着）
  const bad = JSON.parse(e.serialize());
  bad.trim.morale = 500;
  assert.throws(() => Engine.parse(JSON.stringify(bad)), /删繁记录损坏/);
});

// ================= 设施：26 样 =================
test("the build page: 26 buildables in four groups, the decor tile picks a look, the four removed ones and the wine jar can't be built", () => {
  const { e, toasts } = make();
  assert.equal(OLD_GROUPS, 39);
  assert.equal(buildCount(), 26);
  assert.deepEqual(
    BUILD_GROUPS.map((g) => g[0]),
    ["farm", "live", "guard", "decor"],
  );
  assert.deepEqual(BUILD_GROUPS.find((g) => g[0] === "decor")[2], [DECOR_TILE]);
  const all = BUILD_GROUPS.flatMap((g) => g[2]);
  for (const t of [...REFUND_TYPES, WINE_JAR, ...DECOR_LOOKS]) assert.ok(!all.includes(t), t);
  for (const t of [...REFUND_TYPES, WINE_JAR]) {
    assert.equal(e.startBuild(t), false, t);
    assert.ok(BUILDINGS[t].retired);
  }
  assert.ok(said(toasts, /不再建造了/));
  assert.deepEqual(UI.trimBuildIds(e, ["field", "alDecor", "hnKeepsake", "rlWatch", "bed"]), ["field", "bed", DECOR_TILE]);
  // 摆件那一格：六种样子都能挑（奖杯要先得过）
  e.s.storage.wood = 40;
  e.s.storage.scrap = 20;
  e.s.storage.parts = 10;
  const card = UI.decorCard(e, "");
  for (const id of DECOR_LOOKS) assert.match(card, new RegExp('data-action="build" data-id="' + id + '"'), id);
  assert.match(card, /data-id="harvestTrophy"[^>]*disabled/);
  assert.doesNotMatch(card, DEV);
  assert.ok(e.startBuild("chair"), "a look from the decor tile");
  assert.equal(e.buildMode, "chair");
  assert.equal(BUILDINGS.chair.retired, true, "still off the list afterwards");
});

// ================= 种地 =================
test("farming: sprinklers water the plots around them every day, canal-side plots water themselves, others need you", () => {
  const { e, toasts } = make();
  bare(e);
  const farm = e.farmPlots();
  const a = sow(e, farm[0]),
    far = sow(e, farm.reduce((m, p) => (Math.hypot(p.x - farm[0].x, p.y - farm[0].y) > Math.hypot(m.x - farm[0].x, m.y - farm[0].y) ? p : m), farm[0]));
  put(e, "irrigation", a.x + 20, a.y + 20);
  assert.ok(Math.hypot(far.x - a.x, far.y - a.y) > SPRINKLE.r + 30);
  e.s.minute = 10 * 60;
  e.netDistribute(["sprinkler"]);
  assert.ok(e.plotWatered(a), "the sprinkler watered its plot");
  assert.ok(!e.plotWatered(far), "not one out of its reach");
  assert.equal(e.toggleSprinkler(), false, "always on");
  assert.match(e.automationStatus(e.s.buildings.find((b) => b.type === "irrigation")), /开着 · 每天浇 300 以内的田/);
  // 水渠：从源头挖到田边，闸门一直开着
  e.f.canals.dug = [0, 4, 5, 6, 7, 11, 15];
  assert.equal(e.canalReady(), true);
  assert.equal(e.waterControl("gate"), false);
  assert.ok(said(toasts, /闸门一直开着/));
  const side = e.farmPlots().find((p) => Math.hypot(p.x - 770, p.y - 695) < CANAL_R && !e.plotWatered(p));
  if (side) {
    sow(e, side);
    assert.equal(e.trCanal() >= 1, true);
    assert.ok(e.plotWatered(side), "canal-side plot has water");
  }
  // 浇水台：一块该浇的田，按 E 先浇水
  const b = sow(e, farm[5]);
  assert.equal(typeof e.zAutoAct(b), "function");
  assert.match(e.plotContext(b) || "", /浇|查看/);
  assert.doesNotMatch(e.plotContext(b) || "", /照料分/);
});

test("farming: a crop watered every day can come out fine; one missed day and this crop can't", () => {
  const { e } = make();
  bare(e);
  const farm = e.farmPlots();
  const wet = sow(e, farm[0]),
    dry = sow(e, farm[1]);
  e.trWater(wet);
  e.trWater(dry);
  nextDay(e);
  e.trWater(wet);
  nextDay(e);
  assert.equal(e.tr.dry[wet.id], undefined);
  assert.equal(e.tr.dry[dry.id], 1, "dry marked after a day without water");
  assert.equal(e.careScore(wet), FINE.wetScore);
  assert.equal(e.careScore(dry), FINE.dryScore);
  assert.equal(e.fineChance(e.careScore(wet)), FINE.chance);
  assert.equal(e.fineChance(e.careScore(dry)), 0);
  assert.ok(FINE.chance > 0.5 && FINE.chance < 0.8);
  // 没有照看、盖布、肥力、杂草
  assert.equal(e.tend(), false);
  assert.equal(e.cover(), false);
  assert.deepEqual(e.careParts(), []);
  assert.equal(e.primeChance(), 0);
  for (const p of farm) assert.equal(p.fertility, SOIL_FLAT);
  assert.ok(Object.values(e.g.plots).every((r) => !r.w && !r.b));
  // 收了以后，记号清掉；再种下从头算
  wet.growth = CROPS.radish.grow;
  assert.ok(e.harvest(wet));
  assert.equal(e.tr.dry[wet.id], undefined);
  // 这块田那一页：写今天浇没浇、能不能出优质，没有照料分
  e.s.player.x = dry.x;
  const page = UI.renderCampaignView(e, { view: "gPlot", id: String(dry.id) });
  assert.match(page, /漏浇过一天：这一茬不出优质/);
  assert.doesNotMatch(page, /照料分|肥力|杂草|菜青虫|盖布|轮作|搭配/);
  assert.doesNotMatch(page, DEV);
});

test("one fertiliser: the three kinds are one (this crop grows half again as fast), the compost bin makes only that", () => {
  const { e } = make();
  bare(e);
  assert.equal(FERTS.grow.name, "肥料");
  assert.equal(FERTS.grow.grow, 1.5);
  assert.equal(ITEMS.fertGrow.name, "肥料");
  const p = sow(e, e.farmPlots()[2]);
  e.s.storage[FERT.id] = 2;
  assert.equal(e.fertReason(p, "care"), e.fertReason(p, "grow"));
  assert.ok(e.applyFert(p, "water"));
  assert.equal(e.bt.plots[p.id].fz, "grow", "whatever kind is asked for, it's the one fertiliser");
  const bin = put(e, "compost", 900, 500);
  assert.equal(e.compostRec(bin.id).kind, "grow");
  assert.equal(e.compostKind(bin.id), true);
  assert.equal(e.compostRec(bin.id).kind, "grow");
  // 特性种子：到了手上一颗换两颗
  e.s.inventory.seed_potato_hardy = 3;
  e.s.storage.fertCare = 1;
  e.trTraitSweep();
  assert.equal(e.s.inventory.seed_potato_hardy, undefined);
  assert.equal(e.s.inventory.seedPotato >= 6, true);
  assert.equal(e.s.storage.fertCare, undefined);
  assert.equal(e.breedTrait(), false);
});

test("the coop feeds itself, lays into storage, and nobody needs to pet the animals", () => {
  const { e } = make();
  const coop = put(e, "coop", 860, 360);
  if (!e.c.animals) e.c.animals = {};
  Object.assign(e.c.animals, { chicken: 2, ready: { egg: 2 } });
  e.s.storage.corn = 5;
  const eggs = e.s.storage.egg || 0;
  e.s.minute = 6 * 60 + 5;
  e.trCoop();
  assert.equal(e.c.animals.feedDay, e.s.day, "fed at 06:00 from storage");
  assert.equal(e.s.storage.corn, 4);
  assert.equal(e.s.storage.egg, eggs + 2, "the eggs go into storage");
  assert.equal(e.feedAnimals(), false);
  assert.equal(e.herdPet(), false);
  assert.equal(e.releaseChickens(), false);
  assert.ok(coop);
});

// ================= 一个士气 =================
test("one camp morale: everyone follows it, gifts and cheer go into it, it drifts four tenths a night toward what it should be", () => {
  const { e } = make();
  for (const id of ["farmer", "medic", "mechanic"]) e.recruit(id);
  hour(e, 9);
  assert.ok(e.c.residents.every((r) => r.morale === e.tr.morale));
  const f = e.moodFactors();
  assert.ok(f.some((x) => x.key === "noBed" && x.v === MORALE_FACTORS.noBed.v), "three people, one bed");
  const m0 = e.tr.morale;
  assert.equal(e.residentsMood(5), true);
  assert.equal(e.tr.morale, m0 + 5);
  // 原来给一个人加的心情，按人数折进全营
  e.c.residents[0].morale += 9;
  e.trMoraleSync();
  assert.equal(e.tr.morale, m0 + 5 + 3);
  const target = e.moodTarget(),
    now = e.tr.morale;
  e.moodDrift();
  assert.equal(e.tr.morale, Math.round(now + (target - now) * MORALE.drift));
  // 高了干活快，低了慢
  e.tr.morale = 80;
  const hi = e.efficiency();
  e.tr.morale = 20;
  const lo = e.efficiency();
  assert.ok(hi > lo);
  assert.equal(e.moodTier(), "low");
  assert.equal(e.striking(), false);
  assert.equal(e.inspired(), false);
  // 摆件：每多一种 +1
  put(e, "chair", 420, 300);
  put(e, "lamp", 450, 300);
  put(e, "chair", 480, 300);
  assert.equal(e.trDecorKinds(), 2);
  assert.ok(e.moodFactors().some((x) => x.key === "decor" && x.v === 2));
  // 顶栏：动静不见了，菜单最上面一行有士气
  const hud = UI.campaignHud(e);
  assert.equal(hud.noise, null);
  assert.equal(hud.morale.name, "士气");
  assert.equal(hud.morale.value, String(Math.round(e.tr.morale)));
  assert.equal(hud.morale.tone, "danger");
  assert.match(hud.morale.now, /明天往 \d+ 走/);
  const rows = statusRows(e, hud);
  assert.ok(!rows.some((r) => r.key === "noise"));
  assert.ok(rows.some((r) => r.key === "morale"));
  assert.ok(HUD_CARD.morale && /士气/.test(HUD_CARD.morale[0]));
});

test("a night injury is a morale drop, not two days in bed; the clinic makes it smaller; a lost long night weighs two days", () => {
  const { e, toasts } = make();
  for (const id of ["farmer", "medic"]) e.recruit(id);
  e.s.minute = 23 * 60;
  assert.equal(e.injure("r:farmer", "老周", "守夜"), false, "nobody is laid up");
  assert.equal(e.isHurt("r:farmer"), false);
  assert.equal(e.laidUp("r:farmer"), false);
  assert.deepEqual(e.hn.hurt, {});
  assert.equal(e.tr.hurt.n, 1);
  assert.ok(said(toasts, /老周被抓伤了（守夜）：包扎一下接着守，全营士气 -3/));
  assert.equal(e.injure("r:farmer", "老周"), false);
  assert.equal(e.tr.hurt.n, 1, "the same person once a night");
  e.injure("r:medic", "许医生");
  assert.equal(e.tr.hurt.n, 2);
  const hurt = e.moodFactors().find((x) => x.key === "hurt");
  assert.equal(hurt.v, -6);
  assert.equal(e.trHurtPer(), MORALE_FACTORS.hurt.v);
  e.wallOn = (k) => k === "clinic";
  assert.equal(e.trHurtPer(), MORALE_FACTORS.hurt.v + 1);
  e.wall2On = (k) => k === "clinic";
  assert.equal(e.trHurtPer(), MORALE_FACTORS.hurt.v + 2);
  assert.equal(e.treat(), false);
  assert.match(e.treatReason(), /去掉了/);
  e.tr.lost = e.s.day;
  assert.ok(e.moodFactors().some((x) => x.key === "lost" && x.v === MORALE_FACTORS.lost.v));
});

// ================= 天赋 =================
test("talents are learned by themselves in a fixed order (28 points), never chosen or reset; thief XP goes to exploration", () => {
  const { e, toasts } = make();
  assert.equal(
    TALENT_ORDER.reduce((n, id) => n + TALENTS[id].cost, 0),
    28,
  );
  assert.ok(TALENT_ORDER.every((id) => TALENTS[id] && TALENTS[id].skill !== "thief"));
  assert.equal(e.skillPoints().free, 0);
  e.sc.act = 5; // 四段主线：4 个点
  const got = e.trLearn(true);
  assert.deepEqual(got, TALENT_ORDER.slice(0, 4));
  assert.deepEqual(e.tr.learned, got);
  assert.ok(said(toasts, /学会了天赋：老把式、识途、手稳、稳手/));
  assert.equal(e.learnTalent("irrigate"), false);
  assert.equal(e.respec(), false);
  assert.match(e.talentReason("irrigate"), /\S/);
  // 06:00 有点数就学下一个（打着仗不学）
  e.sc.act = 6;
  e.s.xp.agriculture = Math.max(e.s.xp.agriculture || 0, 5000);
  hour(e, 6);
  assert.ok(e.sk.talents.includes("irrigate"), "the next one at 06:00");
  // 妙手：经验折给探索
  const x0 = e.s.xp.exploration || 0;
  e.thiefXp(30);
  assert.ok((e.s.xp.exploration || 0) > x0);
  assert.equal(e.sk.thiefXp, 0);
  assert.equal(e.startPractice(), false);
  assert.equal(e.targetNear(), null);
  assert.match(e.stealReason(), /去掉了/);
  const page = UI.renderSkillPage(e);
  assert.doesNotMatch(page, /data-action="kLearn"|data-action="kRespec"|妙手/);
  assert.doesNotMatch(page, DEV);
});

// ================= 去掉的系统 =================
test("removed systems say so and change nothing: noise, radio programme and commands, lathe rush, upgrades, luck slips, night choices, fakes, advances, 鼎丰, listing, decrees", () => {
  const { e } = make();
  assert.equal(e.noiseTier(), null);
  e.noiseAdd?.(5);
  assert.ok(!e.hn?.noise?.v);
  assert.equal(e.radioCmd("help"), false);
  assert.equal(e.chooseProgram("songs"), false);
  assert.equal(e.latheRush(), false);
  assert.equal(e.upgradeBuilding("x"), false);
  assert.equal(e.unlockPath("x"), false);
  assert.equal(e.luckOf().id, "plain");
  assert.match(e.nightReason(), /去掉了/);
  assert.equal(e.inspectOffer(1), false);
  assert.equal(e.exposeCheat(1), false);
  assert.equal(e.startAdvance("coop"), false);
  assert.equal(e.coSign(), false);
  assert.equal(e.listItem("potato", 1), false);
  assert.match(e.listReason(), /挂牌并进出货箱/);
  assert.equal(e.decree("curfew"), false);
  assert.equal(e.toggleDecree("curfew"), false);
  assert.equal(e.setPolicy("work", "long"), false);
  assert.equal(e.respec(), false);
  // 页面上的按钮（手柄、快捷键还能按到）：说一句，什么都不变
  const said = [];
  e.toast = (t) => said.push(t);
  for (const a of ["wDecree", "wProgram", "hnCmd", "tdRush", "hnUpBuild", "btNet", "xNight", "xAdvance", "oInspect", "rlCoSign", "tdList", "kLearn", "kRespec", "dDeposit", "bShip", "sCanteen"]) {
    assert.equal(handleTrimAction(a, { dataset: { id: "" } }, ctx(e)), true, a);
  }
  assert.equal(said.length, 16);
  for (const v of ["decrees", "night", "steal", "thief", "stealPrep", "caught"]) assert.match(UI.renderCampaignView(e, { view: v }), /去掉了/, v);
  assert.match(UI.renderCampaignView(e, { view: "dialog", id: "hemc" }), /垫付不再有/);
});

test("regions: the district and outpost stores are the farm storage; freight and routes stop", () => {
  const { e, toasts } = make();
  assert.equal(e.districtStore("valley"), e.s.storage);
  assert.equal(e.districtStore("farm"), e.s.storage);
  assert.equal(e.sendDistrictFreight(), false);
  assert.equal(e.setDistrictRoute(), false);
  assert.equal(e.districtTransfer(), false);
  assert.equal(e.startRoute("x"), false);
  assert.equal(e.bship("resin", 2), false);
  assert.ok(said(toasts, /货运停了/));
  const bs = e.bstore("pinewood");
  if (bs) assert.equal(bs, e.s.storage);
  const html = UI.patchBeyond(e, { view: "storage" }, '<section class="b-card"><p>工作产出与奖励都放在这里。</p><button data-action="bShip">运</button></section>');
  assert.match(html, /休整点/);
  assert.doesNotMatch(html, /data-action="bShip"/);
});

test("people: likes are written out; 麦穗 only wants petting, eats by itself and always follows", () => {
  const { e } = make();
  const P = prefsOf("amo");
  const k = e.prefKnown("amo");
  for (const x of P.fav) assert.equal(k[x], "fav");
  for (const x of P.like) assert.equal(k[x], "like");
  for (const x of P.hate) assert.equal(k[x], "hate");
  assert.equal(e.bdog("stay"), false);
  assert.equal(e.bdog("home"), false);
  const page = UI.renderCampaignView(e, { view: "dog" });
  assert.doesNotMatch(page, DEV);
});

test("mushrooms are known as they are picked: the edible ones stay, the poisonous ones are thrown away", () => {
  const { e } = make();
  const words = [],
    toast0 = e.toast.bind(e);
  e.toast = (t, tone) => (words.push(t), toast0(t, tone));
  e.s.inventory[MUSHROOM.raw] = 5;
  e.s.storage[MUSHROOM.raw] = 3;
  const r = e.trSortMushrooms(true);
  assert.equal(r.n, 8);
  assert.equal(e.s.inventory[MUSHROOM.raw], undefined);
  assert.equal(e.s.storage[MUSHROOM.raw], undefined);
  assert.equal((e.s.inventory[MUSHROOM.good] || 0) + (e.s.storage[MUSHROOM.good] || 0), 8 - r.bad);
  // 只在头顶飘一下（“捡到 …。”那一类），不进提示栏
  assert.ok(words.includes("捡到 蘑菇 ×8：" + r.bad + " 朵有毒，扔了。"), words.join("|"));
  assert.match(e.mushroomReason(), /捡到就认得了/);
});

test("the pickle jar also brews: corn goes in as a brew, radish as pickles", () => {
  const { e } = make();
  assert.equal(jarRecipe("corn").verb, "酿");
  assert.equal(jarRecipe("radish").verb, "腌");
  assert.equal(jarRecipe("corn").name, "腌缸");
  const jar = put(e, PICKLE_JAR, 760, 520);
  e.s.storage.corn = 4;
  assert.equal(e.jarFill(jar.id, "corn"), true);
  assert.deepEqual(e.al.jars[jar.id], { item: "corn", n: 4, start: e.s.day });
  assert.equal(e.jarOf(jar.id).J.verb, "酿");
});

test("ecology repairs itself with the reclaimed share; tiles you changed are left alone", () => {
  const { e } = make();
  e.rlCompletion = () => ({ pct: 50 });
  e.f.ecology[1] = { ...e.f.ecology[1], type: "field" };
  const n = e.trEcology();
  assert.ok(n >= 6);
  for (const [i, type] of ECO_ORDER.slice(0, 8)) {
    const t = e.f.ecology[i];
    if (i === 1) assert.equal(t.type, "field");
    else assert.ok(t.clean && t.type === type, "tile " + i);
  }
  assert.equal(e.trEcology(), 0, "nothing more until the share grows");
});

test("sleeping at the farmhouse always leaves you well rested (the wing and the second floor add hours)", () => {
  const { e, toasts } = make();
  assert.equal(e.trRestMinutes(), REST.base * 60);
  Object.assign(e.s.player, { x: 330, y: 420 });
  e.s.minute = 22 * 60;
  assert.ok(e.sleep());
  assert.ok(e.restedNow(), "rested after sleeping");
  assert.ok(e.restedLeft() >= REST.base * 60 - 60);
  assert.ok(said(toasts, /睡得好：「休息好」4 个钟点/));
  const xp0 = e.s.xp.agriculture || 0;
  e.xp("agriculture", 10);
  assert.ok(Math.abs((e.s.xp.agriculture || 0) - xp0 - 11) < 1e-9, "a tenth more experience while rested");
  const home = UI.trimHomeExtras(e);
  assert.match(home, /醒来「休息好」4 个钟点/);
  assert.doesNotMatch(home, DEV);
});

test("treasures you used to steal are handed over when the owner trusts you (not the family photo)", () => {
  const { e } = make();
  e.ss.trust = { ...(e.ss.trust || {}), amo: 8, qin: 10 };
  e.trTreasures();
  assert.equal(e.th.treasures.tunnelMap, "given");
  assert.notEqual(e.th.treasures.familyPhoto, "given");
  assert.ok(e.tr.given.includes("tunnelMap"));
});

// ================= 页面 =================
test("pages: nothing removed is offered, no dev words; the menus and cards say what changed", () => {
  const { e } = make();
  for (const id of ["farmer", "medic"]) e.recruit(id);
  const farm = e.farmPlots();
  const p = sow(e, farm[3], "radish", 0.3);
  const empty = farm[4];
  Object.assign(empty, { tilled: true, crop: null });
  e.s.inventory.seedRadish = 3;
  const comp = put(e, "compost", 900, 500);
  const views = [
    ["gBoard", {}],
    ["bWater", {}],
    ["radio", {}],
    ["dog", {}],
    ["trConv", {}],
    ["gPlot", { id: String(p.id) }],
    ["gPick", { id: String(empty.id) }],
    ["bCompost", { id: comp.id }],
    ["shipping", {}],
    ["lathe", {}],
    ["plaza", {}],
    ["people", {}],
    ["caravan", {}],
  ];
  for (const [view, extra] of views) {
    const html = UI.renderCampaignView(e, { view, ...extra });
    assert.equal(typeof html, "string", view);
    assert.doesNotMatch(html, DEV, view);
    assert.doesNotMatch(html, /data-action="(?:wProgram|hnCmd|tdRush|hnUpBuild|hnUpPath|tdList|oInspect|xAdvance|btNet|btSprinkler|btCompKind|gTend|btCover|sCanteen)"/, view);
  }
  assert.equal(trimUiOn(), true);
  assert.match(UI.renderCampaignView(e, { view: "radio" }), /今天早上的广播|电台还没修好/);
  assert.match(UI.renderCampaignView(e, { view: "gBoard" }), /今天的菜地/);
  assert.match(UI.renderCampaignView(e, { view: "bCompost", id: comp.id }), /肥料/);
  assert.equal(UI.campaignTitle({ view: "trConv" }), CONVERT_TITLE);
  assert.equal(UI.campaignTitle({ view: "radio" }), "通信站");
  assert.ok(MENUS.some((m) => m[0] === "消息" && /退回的东西/.test(m[1])));
  // 拿掉一块 HTML 的小工具：同名标签按层数配对
  assert.equal(dropBlock('<div class="a"><div class="x"><div>in</div></div><p>keep</p></div>', "x"), '<div class="a"><p>keep</p></div>');
  assert.equal(dropActions('<button data-action="a">1</button><button data-action="b">2</button>', ["a"]), '<button data-action="b">2</button>');
});

test("the code: the new layer never rolls dice, never touches storage keys, and has no dev words", () => {
  for (const f of ["dist/trim.js", "dist/trim-data.js", "dist/trim-ui.js", "dist/trim-renderer.js"]) {
    const src = read(f);
    assert.doesNotMatch(src, /Math\.random/, f);
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB/, f);
    assert.doesNotMatch(src.replace(/\/\/.*$/gm, ""), /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|Joja|祝尼魔|星之果实/, f);
  }
  const keys = new Set();
  for (const f of ["dist/game.js", "dist/player-session.js", "dist/campaign-ui.js", "dist/look-ui.js"]) for (const m of read(f).matchAll(/ember-farm-[a-z0-9-]+-v\d+/g)) keys.add(m[0]);
  const allowed = ["ember-farm-save-v1", "ember-farm-backup-v1", "ember-farm-preferences-v1", "ember-farm-before-new-v1", "ember-farm-before-import-v1", "ember-farm-before-alliance-v1"];
  for (const k of keys) assert.ok(allowed.includes(k) || /^ember-farm-demo(-backup)?-v\d$/.test(k), k);
});

test("the scene: the campaign renderer is the trim layer; the ♪ / 愁 bubble follows the camp morale over one resident only", () => {
  assert.equal(CampaignRenderer, TrimRenderer);
  assert.ok(TrimRenderer.prototype instanceof ClearRenderer);
  const { e } = make();
  for (const id of ["farmer", "medic", "mechanic"]) e.recruit(id);
  const before = e.c.residents.map((r) => r.morale);
  const seen = [],
    orig = ClearRenderer.prototype.drawNeeds;
  ClearRenderer.prototype.drawNeeds = function (en) {
    seen.push(en.c.residents.map((r) => r.morale));
  };
  try {
    for (const m of [20, 85, 50]) {
      e.tr.morale = m;
      TrimRenderer.prototype.drawNeeds.call({}, e);
    }
  } finally {
    ClearRenderer.prototype.drawNeeds = orig;
  }
  assert.deepEqual(seen, [
    [30, 60, 60],
    [80, 60, 60],
    [60, 60, 60],
  ]);
  assert.deepEqual(
    e.c.residents.map((r) => r.morale),
    before,
    "put back after drawing",
  );
  // 田边的肥力色条不画（肥力一直是 85，下面几层看到 85 会画一条绿条）
  const soil0 = e.s.plots.map((p) => p.fertility),
    seenSoil = [],
    og = ClearRenderer.prototype.drawGarden;
  ClearRenderer.prototype.drawGarden = function (en) {
    seenSoil.push(en.s.plots.every((p) => p.fertility === 65));
  };
  try {
    TrimRenderer.prototype.drawGarden.call({ trNoSoil: TrimRenderer.prototype.trNoSoil }, e);
  } finally {
    ClearRenderer.prototype.drawGarden = og;
  }
  assert.deepEqual(seenSoil, [true]);
  assert.deepEqual(
    e.s.plots.map((p) => p.fertility),
    soil0,
    "put back after drawing",
  );
  assert.ok(e.farmPlots().every((p) => p.fertility === SOIL_FLAT), "a new farm is at the flat fertility");
});
