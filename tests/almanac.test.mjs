// v0.29.0「四时」：四个时节（长势、天气、寒潮、秋收迁徙）、早间广播（手气签、明天的天气、当季菜）、雨天、上品、
// 腌缸和土酒坛、牲口亲近、老果园嫁接、旧物摆件、野物和蘑菇、夜里的好事、油灯下念账、界面和存档。
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { Engine, freshState, newGameState, needsStoryMigration } from "../dist/campaign.js";
import * as Bustle from "../dist/bustle.js";
// v0.30：最上面又接了一层（人情）；这里测的是四时这一层，“下面那一层”从四时的 Engine 往下找
import * as Almanac from "../dist/almanac.js";
import { ITEMS, BUILDINGS, CROPS, RECIPES } from "../dist/data.js";
import { TASKS } from "../dist/rebuild-data.js";
import { WEATHER } from "../dist/expansion-data.js";
import { FESTIVALS } from "../dist/seasons-data.js";
import { COMFORT, COMFORT_CATS } from "../dist/bustle-data.js";
import { PIECES } from "../dist/audio-data.js";
import {
  YEAR,
  SEASON_DAYS,
  SEASONS,
  seasonOf,
  seasonDay,
  yearOf,
  nextSeasonDay,
  coldStartFrom,
  CROP_SEASON,
  SEASON_RATE,
  SEASON_WEATHER,
  LUCK,
  LUCK_BY_ID,
  RAIN,
  PRIME,
  JARS,
  HERD,
  TREES,
  TREE_IDS,
  TREE_RULES,
  treeType,
  cuttingId,
  DECOR,
  decorItem,
  DECOR_RULES,
  FORAGE,
  FORAGE_SPOTS,
  FORAGE_RULES,
  MUSHROOM,
  NIGHT_GOOD,
  DISHES,
  AL_BUILD_TYPES,
} from "../dist/almanac-data.js";
import * as UI from "../dist/campaign-ui.js";
import { residentExtras, roomExtras } from "../dist/people-hooks.js";
import { MISSING_ICONS } from "../dist/item-sprites.js";
import { buildingArt, objectArt } from "../dist/pixel-props.js";

// 画图要一块画布：装了 @napi-rs/canvas 就用它（和 visual.test 一样），四时的画在 almanac-renderer.js 里登记
const require = createRequire(import.meta.url);
let canvasLib = null;
try {
  canvasLib = require("@napi-rs/canvas");
} catch {
  canvasLib = null;
}
const kit = await import("../dist/pixel-kit.js");
if (canvasLib) kit.setCanvasFactory((w, h) => canvasLib.createCanvas(w, h));
await import("../dist/almanac-renderer.js");

const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const make = (state = freshState(), seed = 20291) => {
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
const put = (e, type, x, y, extra = {}) => {
  const b = { id: "t-" + type + "-" + e.s.idCounter++, type, x, y, rotation: 0, hp: BUILDINGS[type].hp, ...extra };
  e.s.buildings.push(b);
  e.navRevision = (e.navRevision || 0) + 1;
  return b;
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
const stock = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);
const give = (e, items) => {
  for (const [id, n] of Object.entries(items)) e.s.storage[id] = (e.s.storage[id] || 0) + n;
};
const btn = (action, id = "") => ({ dataset: { action, id: String(id) } });
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const view = (e, v, id = "") => UI.renderCampaignView(e, { view: v, id });
const go = (e, region, x = 768, y = 512) => {
  e.s.visited = { ...(e.s.visited || {}), [region]: true };
  e.s.region = region;
  e.enemies = e.s.enemies[region] ||= [];
  e.assignRegion();
  Object.assign(e.s.player, { x, y });
};
const atFarm = (e, x = 830, y = 460) => go(e, "farm", x, y);
const clearFoes = (e) => {
  for (const z of e.enemies) z.dead = true;
  e.enemies = e.s.enemies[e.s.region] = [];
};
// 找一块能建的空地，站过去再放
function place(e, type) {
  for (let y = 352; y < 930; y += 40)
    for (let x = 192; x < 1420; x += 40) {
      Object.assign(e.s.player, { x: x + 60, y });
      if (!e.buildReason(type, x, y)) {
        assert.ok(e.placeBuilding(x, y), "placing " + type);
        e.buildMode = null;
        return e.s.buildings.at(-1);
      }
    }
  assert.fail("no room for " + type);
}
// 按条件找一天
const dayWhere = (ok, from = 1, span = 400) => {
  for (let d = from; d < from + span; d++) if (ok(d)) return d;
  throw new Error("no such day");
};
const v28 = (setup = () => {}) => {
  const old = new Bustle.Engine(Bustle.newGameState("farmer"), () => {});
  setup(old);
  return old.serialize();
};

// ================= 数据 =================
test("data: a 28-day year in four 7-day seasons, each ending on its festival; the cold season holds the cold snap; every crop has a good and a bad season", () => {
  assert.equal(YEAR, 28);
  assert.equal(SEASON_DAYS, 7);
  assert.deepEqual(
    SEASONS.map((s) => s.id),
    ["thaw", "heat", "harvest", "cold"],
  );
  // 第 7、14、21、28 天的节庆正好是各个时节收尾的那个
  const e = make().e;
  for (const [i, s] of SEASONS.entries()) {
    const last = (i + 1) * SEASON_DAYS;
    assert.ok(FESTIVALS[s.fest], s.id);
    assert.equal(e.festivalKind(last), s.fest, "day " + last);
    assert.equal(seasonOf(last).id, s.id);
    assert.equal(seasonOf(last + YEAR).id, s.id, "the next year too");
  }
  assert.equal(seasonDay(22), 1);
  assert.equal(seasonOf(22).id, "cold");
  assert.equal(yearOf(28), 1);
  assert.equal(yearOf(29), 2);
  assert.equal(nextSeasonDay(9), 15);
  // 寒潮对齐到寒潮时节第一天
  for (const d of [1, 21, 22, 23, 50, 68, 100]) {
    const c = coldStartFrom(d);
    assert.ok(c >= d && c < d + YEAR, "d " + d);
    assert.equal(seasonOf(c).id, "cold");
    assert.equal(seasonDay(c), 1);
  }
  for (const [crop, [good, bad]] of Object.entries(CROP_SEASON)) {
    assert.ok(CROPS[crop], crop);
    assert.notEqual(good, bad, crop);
    assert.ok(SEASONS.some((s) => s.id === good) && SEASONS.some((s) => s.id === bad), crop);
  }
  for (const id of Object.keys(CROPS)) if (id !== "hybrid" && !CROPS[id].hybrid) assert.ok(CROP_SEASON[id], "season for " + id);
  assert.deepEqual(SEASON_RATE, { good: 1.15, bad: 0.85 });
});

test("data: the weather follows the seasons — 28 days a year with the same mix every year, more rain when it thaws, heat waves in summer; new games still open 晴、晴、小雨; never three storms in a row", () => {
  assert.equal(WEATHER.length, YEAR * 4);
  assert.deepEqual(WEATHER.slice(0, 3), ["晴朗", "晴朗", "小雨"]);
  for (let y = 0; y < 4; y++)
    for (const [i, s] of SEASONS.entries()) {
      const week = WEATHER.slice(y * YEAR + i * SEASON_DAYS, y * YEAR + (i + 1) * SEASON_DAYS);
      const count = {};
      for (const w of week) count[w] = (count[w] || 0) + 1;
      assert.deepEqual(count, Object.fromEntries(Object.entries(SEASON_WEATHER[s.id]).sort()) && count, "year " + (y + 1) + " " + s.id);
      for (const [w, n] of Object.entries(SEASON_WEATHER[s.id])) assert.equal(count[w], n, "year " + (y + 1) + " " + s.id + " " + w);
    }
  const bad = (w) => w === "暴雨" || w === "酸雨";
  for (let i = 0; i + 2 < WEATHER.length; i++) assert.ok(!(bad(WEATHER[i]) && bad(WEATHER[i + 1]) && bad(WEATHER[i + 2])), "three bad days from " + (i + 1));
  // 回暖雨多、酷暑才有高温
  const rainy = (id) => ["小雨", "暴雨"].reduce((a, w) => a + (SEASON_WEATHER[id][w] || 0), 0);
  assert.ok(rainy("thaw") > rainy("harvest") && rainy("thaw") > rainy("cold"));
  assert.equal(SEASON_WEATHER.heat.高温, 3);
  assert.ok(!SEASON_WEATHER.cold.高温 && !SEASON_WEATHER.harvest.高温);
  // 天气就是按表来的：今天的、预报的
  const { e } = make();
  for (const d of [1, 9, 30, 77]) {
    e.s.day = d;
    assert.deepEqual(
      e.forecast().map((x) => x.weather),
      [0, 1, 2].map((k) => WEATHER[(d - 1 + k) % WEATHER.length]),
    );
  }
  e.s.day = 9;
  nextDay(e);
  assert.equal(e.s.weather, WEATHER[9]);
});

test("data: new things are real items with icons; the four season dishes are recipes; jars, trees and the decor are buildings with their own pages and pictures", () => {
  for (const id of ["alShepherd", "alPurslane", "alBerry", "alChestnut", "alJujube", "alFrostPersimmon", "alMushroomRaw", "alMushroom", "alPickle", "alPickleOld", "alWine", "alWineAged", "alLoach"]) assert.ok(ITEMS[id], id);
  for (const k of TREE_IDS) {
    const f = TREES[k].fruit;
    for (const id of [f, "fine_" + f, "prime_" + f, cuttingId(k)]) assert.ok(ITEMS[id], id);
    assert.ok(ITEMS[cuttingId(k)].protected, "cuttings are not sold by mistake");
  }
  for (const id of Object.keys(CROPS)) if (id !== "hybrid" && ITEMS[id]) assert.equal(ITEMS["prime_" + id]?.sell, Math.round(ITEMS[id].sell * PRIME.sell), "prime " + id);
  assert.equal(DECOR.length, 24);
  for (const d of DECOR) assert.equal(ITEMS[decorItem(d.id)]?.decor, d.id);
  assert.ok(ITEMS.alMushroomRaw.protected, "raw mushrooms are never sold");
  const missing = typeof MISSING_ICONS === "function" ? MISSING_ICONS() : MISSING_ICONS || [];
  assert.deepEqual(missing, [], "every item has an icon");
  for (const dish of Object.values(DISHES)) assert.ok(RECIPES.some((r) => r.id === dish && r.station === "cook"), dish);
  assert.ok(RECIPES.some((r) => r.id === "alSpiritBandage" && r.cost.alWine === 1 && r.out.bandage === 3));
  for (const t of AL_BUILD_TYPES) {
    assert.ok(BUILDINGS[t], t);
    if (canvasLib && t !== "alDecor") assert.ok(buildingArt(t)?.canvas, "picture for " + t);
  }
  if (canvasLib) for (const t of ["alDebris", "alParcel"]) assert.ok(objectArt(t)?.canvas, "picture for " + t);
  assert.equal(BUILDINGS[treeType("peach")].cost[cuttingId("peach")], 1);
  assert.ok(COMFORT_CATS.includes("alDecor"));
  assert.equal(COMFORT.max, COMFORT_CATS.length);
  assert.ok(PIECES.farmDay_heat && PIECES.farmDay_harvest && PIECES.farmDay_cold);
});

// ================= 存档 =================
test("save: new games stay quiet; a v0.28 save is kept as-is, the cold snap moves onto the cold season, the notice plays once; a broken record is refused in plain words", () => {
  const { e: fresh, toasts: t0 } = make(newGameState("farmer"));
  fresh.update(0.016, {});
  assert.ok(!said(t0, /四时：/), "no notice for a new game");
  assert.ok(!fresh.al.intro);
  const text = v28((o) => {
    o.s.day = 40;
    o.bt.cold.next = 60;
    o.s.inventory.radish = 3;
  });
  assert.equal(needsStoryMigration(text), true, "a v0.28 save gets a checkpoint before it is read");
  const s = Engine.parse(text);
  assert.equal(s.day, 40);
  assert.equal(s.inventory.radish, 3);
  assert.ok(s.almanac && s.almanac.intro);
  const { e, toasts } = make(s);
  assert.equal(e.bt.cold.next, coldStartFrom(60), "the old cold snap waits for the cold season");
  assert.equal(seasonOf(e.bt.cold.next).id, "cold");
  e.update(0.016, {});
  e.update(0.016, {});
  assert.equal(toasts.filter((t) => /四时：/.test(t.text)).length, 1, "the notice plays once");
  // 存了再读，原样
  const again = Engine.parse(e.serialize());
  assert.deepEqual(again.almanac, JSON.parse(e.serialize()).almanac);
  assert.equal(needsStoryMigration(e.serialize()), false);
  // 坏了的记录：说人话，不读
  const broken = JSON.parse(e.serialize());
  broken.almanac.jars = { x: { item: "nope", n: 4, start: 1 } };
  assert.throws(() => Engine.parse(JSON.stringify(broken)), /存档里的四时记录损坏（缸），请从设置恢复有效备份/);
  const b2 = JSON.parse(e.serialize());
  b2.almanac.herd.flock.pts = 500;
  assert.throws(() => Engine.parse(JSON.stringify(b2)), /四时记录损坏（牲口）/);
  const b3 = JSON.parse(e.serialize());
  b3.buildings.push({ id: "bx", type: "alDecor", x: 500, y: 500, rotation: 0, hp: 60, decor: "nope" });
  assert.throws(() => Engine.parse(JSON.stringify(b3)), /四时记录损坏（摆件）/);
});

// ================= 四个时节 =================
test("seasons: a crop grows 15% faster in its season and 15% slower out of it; under the greenhouse the bad season does not bite; the HUD date names the season", () => {
  const { e } = make();
  const p = e.s.plots[0];
  p.crop = "potato";
  const base = (q) => Object.getPrototypeOf(Almanac.Engine.prototype).cropGrowthRate.call(e, q);
  e.s.weather = "晴朗";
  e.s.day = 3; // 回暖：土豆当季
  assert.equal(e.seasonKind("potato"), "good");
  assert.ok(Math.abs(e.cropGrowthRate(p) - base(p) * 1.15) < 1e-9);
  e.s.day = 10; // 酷暑：土豆反季
  assert.equal(e.seasonKind("potato"), "bad");
  assert.ok(Math.abs(e.cropGrowthRate(p) - base(p) * 0.85) < 1e-9);
  e.s.day = 17; // 秋收：平常
  assert.equal(e.seasonKind("potato"), "");
  assert.ok(Math.abs(e.cropGrowthRate(p) - base(p)) < 1e-9);
  // 温室里：反季也照常
  e.s.day = 10;
  put(e, "greenhouse", p.x + 40, p.y + 30);
  assert.ok(e.underGlass(p));
  assert.equal(e.cropSeasonRate(p), 1);
  // 顶栏
  e.s.day = 16;
  const hud = UI.campaignHud(e);
  assert.equal(hud.date.text, "第 16 天 · 秋收");
  assert.match(hud.date.title, /第 1 年 · 秋收第 2 天（还有 6 天到寒潮）/);
  e.s.day = 30;
  assert.match(UI.campaignHud(e).date.title, /第 2 年 · 回暖第 2 天/);
});

test("seasons: the calendar shows the four seasons with what grows and what grows wild, season starts and the coming cold snap; the farm board and the seed picker say what is in season", () => {
  const { e } = make();
  toAct(e, 8);
  e.w.winter.phase = "done";
  e.s.day = 18;
  e.bt.cold.next = 22;
  const cal = view(e, "calendar");
  assert.match(cal, /第 1 年 · 现在是秋收第 4 天/);
  for (const s of SEASONS) assert.match(cal, new RegExp(s.name + "<small>"));
  assert.match(cal, /当季（长得快 15%、每收多 1 份）<\/b>：萝卜、玉米、南瓜/);
  assert.match(cal, /<b>第22天<\/b>(<span class="tag [a-z]+">[^<]+<\/span>)*<span class="tag gold">寒潮时节<\/span>/);
  assert.match(cal, /<b>第22天<\/b>(<span class="tag [a-z]+">[^<]+<\/span>)*<span class="tag cold">寒潮到<\/span>/);
  assert.match(cal, /<b>第29天<\/b><span class="tag gold">回暖时节<\/span>/);
  assert.match(cal, /当季菜：栗子焖南瓜/);
  assert.doesNotMatch(cal, DEV);
  // 告示牌
  const board = UI.renderManualPlus(e, "farm", {}, {}, {});
  assert.match(board, /秋收第 4 天：这一季种什么/);
  assert.match(board, /当季（长得快 15%、每收多 1 份）：萝卜、玉米、南瓜/);
  assert.doesNotMatch(board, /长得慢/, "nothing is out of season in the harvest season");
  assert.doesNotMatch(board, DEV);
  e.s.day = 10;
  assert.match(UI.renderManualPlus(e, "farm", {}, {}, {}), /长得慢 -15%：萝卜、土豆/);
  e.s.day = 18;
  // 田边选种
  atFarm(e);
  const p = e.s.plots.find((q) => !q.crop);
  p.tilled = true;
  e.s.debris = e.s.debris.filter((d) => Math.hypot(d.x - p.x, d.y - p.y) >= 15);
  e.s.inventory.seedRadish = 2;
  e.s.inventory.seedTomato = 2;
  const pick = view(e, "gPick", String(p.id));
  assert.match(pick, /data-id="[^"]*\|seedRadish"[\s\S]*?<span class="seed-tags"><span class="g-tag good">当季 快 15% · 多收 1 份/);
  assert.match(pick, /data-id="[^"]*\|seedTomato"[\s\S]*?<span class="seed-tags"><span class="g-tag give">/, "tomatoes are neither in nor out of season now");
  e.s.day = 10;
  assert.match(view(e, "gPick", String(p.id)), /data-id="[^"]*\|seedRadish"[\s\S]*?<span class="seed-tags"><span class="g-tag bad">反季 长得慢 -15%（温室里不受影响）/);
  e.s.day = 18;
  // 种下以后这块田的卡也说
  e.s.inventory.seedPumpkin = 1;
  assert.ok(e.plantSeed(p.id, "seedPumpkin"));
  assert.match(view(e, "gPlot", String(p.id)), /秋收时节：南瓜当季，长得快 15%、收的时候多 1 份/);
});

test("seasons: cold snaps after the story land on the first day of the cold season; in the harvest season half the hazards are migrations", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  const wi = e.w.winter;
  Object.assign(wi, { phase: "done", coldDay: 40, endDay: 43, prepDay: 37 });
  e.s.day = 44;
  e.bt.cold.next = 0;
  nextDay(e);
  const c = e.bt.cold.next;
  assert.ok(c > e.s.day);
  assert.equal(seasonOf(c).id, "cold");
  assert.equal(seasonDay(c), 1);
  e.s.day = c - 2;
  nextDay(e);
  assert.equal(wi.phase, "prep");
  assert.equal(wi.coldDay, c);
  assert.equal(e.bt.cold.next, c + YEAR);
  assert.ok(said(toasts, /寒潮又到/));
  // 秋收时节：迁徙多
  e.s.visited = { residential: true, hospital: true, warehouse: true };
  let mig = 0,
    n = 0,
    other = 0,
    m2 = 0;
  for (let d = 15; d < 400; d++) {
    const h = e.hazardFor(d);
    if (!h) continue;
    if (seasonOf(d).id === "harvest") {
      n++;
      if (h.kind === "migration") mig++;
    } else {
      other++;
      if (h.kind === "migration") m2++;
    }
  }
  assert.ok(n > 20 && mig / n > 0.45, "harvest: " + mig + "/" + n);
  assert.ok(mig / n > m2 / other + 0.15, "more than the other seasons (" + m2 + "/" + other + ")");
});

// ================= 早间广播 =================
test("radio: at 07:00 the repaired radio tells tomorrow's weather and 老琴's luck; on a season's first day 何大勺 teaches its dish (locked until then); no radio, no broadcast", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  atFarm(e);
  e.s.day = 21;
  nextDay(e); // 第 22 天：寒潮时节第一天
  hour(e, 7);
  const L = e.luckOf(22);
  // v0.32：早间广播的全文进任务手记的“今天”（提示栏里只有要紧的一句）
  const line = e.radioToday() || toasts.find((t) => /电台早间播报/.test(t.text))?.text || "";
  assert.ok(line.includes(L.line.replace(/。$/, "")), line);
  assert.match(line, new RegExp("明天" + WEATHER[22 % WEATHER.length]));
  assert.match(line, /今天起是寒潮时节/);
  assert.match(line, /腌菜炖土豆/);
  assert.doesNotMatch(line, /。；|；；/);
  assert.ok(e.al.dishes.includes("alPickleStew"));
  assert.ok(e.o.log.some((l) => /早间广播：/.test(l.text)));
  // 菜谱：学会了才能做，没学的说去哪学
  const soup = RECIPES.find((r) => r.id === "alColdSoup");
  assert.match(e.recipeReason(soup), /酷暑时节第一天的早间广播/);
  assert.ok(!e.recipeReason(RECIPES.find((r) => r.id === "alPickleStew"))?.includes("广播"));
  // 收音机坏了：没有手气、学不到菜
  const { e: q, toasts: t2 } = make();
  q.r.radio = false;
  q.s.day = 7;
  nextDay(q);
  hour(q, 7);
  assert.ok(!said(t2, /老琴抽了/));
  assert.equal(q.radioToday(), "");
  assert.ok(!q.al.dishes.includes("alColdSoup"));
  // 电台那一页：今天的签、明天的天气、学会的菜
  const page = view(e, "radio");
  assert.match(page, /早间广播（每天 07:00）/);
  assert.match(page, new RegExp("今天的手气签：<b[^>]*>" + L.name));
  assert.match(page, /学会了：腌菜炖土豆/);
  assert.doesNotMatch(page, DEV);
});

test("luck: draws follow 15/35/35/15 over many days; a great day finds more in cabinets, a bad day pries 20% slower and the caravan slips in more fakes", () => {
  const { e } = make();
  const count = { great: 0, good: 0, plain: 0, bad: 0 };
  for (let d = 1; d <= 2000; d++) count[e.luckOf(d).id]++;
  for (const l of LUCK) assert.ok(Math.abs(count[l.id] / 2000 - l.p) < 0.035, l.id + " " + count[l.id]);
  // 同一个柜子：大吉那天平均翻得多
  toAct(e, 7);
  go(e, "residential");
  const box = { id: "lucky-box", ukind: "kitchen", x: 500, y: 500 };
  const total = (luck) => {
    const keep = e.luckOf;
    e.luckOf = () => LUCK_BY_ID[luck];
    let n = 0;
    try {
      for (let d = 1; d <= 400; d++) n += Object.values(e.rollContainer(box, d).bundle).reduce((a, b) => a + b, 0);
    } finally {
      e.luckOf = keep;
    }
    return n;
  };
  const great = total("great"),
    plain = total("plain"),
    bad = total("bad");
  assert.ok(great > plain * 1.05, "great " + great + " plain " + plain);
  assert.ok(bad >= plain * 0.98 && bad <= plain * 1.02, "a bad day takes nothing away from cabinets: bad " + bad + " plain " + plain);
  // 商队：凶的那天假货多
  const fakes = (luck) => {
    let n = 0;
    for (let k = 0; k < 120; k++) {
      const { e: q } = make(freshState(), 9000 + k);
      toAct(q, 5);
      q.o.caravan.next = q.s.day;
      q.o.caravan.exposed = 0;
      q.luckToday = () => LUCK_BY_ID[luck];
      q.roll = () => 0.99; // 平常的那两成五假货先拿掉，只看手气多混进来的
      q.arriveCaravan();
      n += q.o.caravan.offers.filter((o) => o.fake).length;
    }
    return n;
  };
  assert.equal(fakes("plain"), 0);
  assert.ok(fakes("bad") > 0, "a bad day slips in fakes");
});

test("luck: a bad day really makes prying slower, a rainy day makes it quieter, and both are said", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  go(e, "residential");
  clearFoes(e);
  // 一个锁着的铁柜、一根撬棍
  const o = { type: "crate", id: "t-locked", x: 900, y: 640, loot: {}, name: "锁着的铁柜", icon: 40, elite: false, ukind: "locked", odds: "locked" };
  e.objects.push(o);
  e.s.inventory.crowbar = 1;
  const tryPry = (luck, weather) => {
    e.ux.pry = null;
    e.luckToday = () => LUCK_BY_ID[luck];
    e.s.weather = weather;
    Object.assign(e.s.player, { x: o.x + 10, y: o.y + 30 });
    o.opened = false;
    o.pried = false;
    const ok = e.startPry(o);
    const P = ok ? { ...e.ux.pry } : null;
    e.ux.pry = null;
    return P;
  };
  const plain = tryPry("plain", "晴朗");
  assert.ok(plain, "prying starts");
  const bad = tryPry("bad", "晴朗");
  assert.ok(Math.abs(bad.max - plain.max * 1.2) < 0.11, bad.max + " vs " + plain.max);
  assert.ok(said(toasts, /下签，手生/));
  const wet = tryPry("plain", "小雨");
  if (!plain.silent) {
    assert.equal(wet.noise, Math.round(plain.noise * RAIN.pry));
    assert.ok(said(toasts, /下着雨，撬的声音只传一半远/));
  }
});

// ================= 雨天 =================
test("rain: in the ruins infected hear 20% less far; after a rainy day the camp's noise is drowned out 35% of the time; residents craft 10% faster; the pond gives loaches", () => {
  const { e } = make();
  toAct(e, 7);
  go(e, "residential");
  e.s.weather = "小雨";
  assert.ok(e.rainingOut());
  // 听觉：把基类的 enemySenses 换成记下当时的声音半径
  const below = Object.getPrototypeOf(Almanac.Engine.prototype);
  const orig = below.enemySenses;
  let seen = null;
  below.enemySenses = function () {
    seen = this.noise.map((n) => n.r);
  };
  try {
    e.noise = [{ x: 1, y: 1, r: 300, t: 1 }];
    e.enemySenses({}, 0.016);
    assert.deepEqual(seen, [300 * RAIN.hear]);
    assert.equal(e.noise[0].r, 300, "the real sound is left alone");
    e.s.weather = "晴朗";
    e.enemySenses({}, 0.016);
    assert.deepEqual(seen, [300]);
  } finally {
    below.enemySenses = orig;
  }
  // 动静：下了一天雨，到了线也有三成半的晚上被雨声盖住（不来，动静照平常减半）
  atFarm(e);
  clearFoes(e);
  e._btSleep = true;
  const masked = dayWhere((d) => e.alRoll("rainmask", d) < RAIN.mask, 20),
    heard = dayWhere((d) => e.alRoll("rainmask", d) >= RAIN.mask, 20);
  const night = (day, weather) => {
    clearFoes(e);
    e.s.day = day - 1;
    e.s.weather = weather;
    e.hn.noise.v = 5;
    e.hn.attack.state = "";
    const a0 = e.hn.stats.attacks || 0;
    nextDay(e);
    return (e.hn.stats.attacks || 0) - a0;
  };
  assert.equal(night(masked, "小雨"), 0, "drowned out by the rain");
  assert.equal(e.hn.noise.v, 2.5, "halved like a quiet night");
  assert.equal(e.al.stats.rainNights, 1);
  assert.equal(e._alRainCut, masked);
  assert.equal(night(masked, "晴朗"), 1, "a dry day: they come");
  assert.equal(night(heard, "小雨"), 1, "not every rainy night");
  let n = 0;
  for (let d = 1; d <= 1000; d++) if (e.alRoll("rainmask", d) < RAIN.mask) n++;
  assert.ok(Math.abs(n / 1000 - RAIN.mask) < 0.04, "mask rate " + n);
  e._btSleep = false;
  // 手工：雨天快一成
  let got = 0;
  const base = Object.getPrototypeOf(Almanac.Engine.prototype).processProduction;
  Object.getPrototypeOf(Almanac.Engine.prototype).processProduction = function (n) {
    got = n;
  };
  try {
    e.s.weather = "暴雨";
    e.processProduction(10);
    assert.ok(Math.abs(got - 11) < 1e-9);
    e.s.weather = "晴朗";
    e.processProduction(10);
    assert.equal(got, 10);
  } finally {
    Object.getPrototypeOf(Almanac.Engine.prototype).processProduction = base;
  }
  // 雨鳅：雨天池塘里约三成五
  const fishBase = Object.getPrototypeOf(Almanac.Engine.prototype).hookFish;
  Object.getPrototypeOf(Almanac.Engine.prototype).hookFish = function () {
    this.s.inventory.fish = (this.s.inventory.fish || 0) + 1;
    this.c.metrics.fish = (this.c.metrics.fish || 0) + 1;
    return true;
  };
  try {
    e.s.weather = "小雨";
    e.luckToday = () => LUCK_BY_ID.plain;
    for (let i = 0; i < 200; i++) e.hookFish();
    const loach = e.s.inventory.alLoach || 0;
    assert.ok(loach > 45 && loach < 95, "loaches " + loach);
    e.s.weather = "晴朗";
    const before = e.s.inventory.alLoach;
    for (let i = 0; i < 50; i++) e.hookFish();
    assert.equal(e.s.inventory.alLoach, before, "no loaches when it is dry");
  } finally {
    Object.getPrototypeOf(Almanac.Engine.prototype).hookFish = fishBase;
  }
});

// ================= 上品 =================
test("prime: in season with care 70+, a fine harvest's fine portion is prime 25% of the time (45% with care fertiliser), worth 2.2×; in-season harvests give one more portion; prime counts for costs and the harvest festival", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  e.s.day = 16; // 秋收：萝卜当季
  let prime = 0,
    tries = 0;
  for (const p of e.s.plots.slice(0, 12)) {
    p.tilled = true;
    p.crop = "radish";
    p.growth = CROPS.radish.grow;
    p.trait = null;
    // 天天照看（65）+ 换了茬（10）= 75：优质必出（80 以上）要再加一点，这里给提质肥
    e.g.plots[p.id] = { c: 100, pd: 1, t: e.s.day, wd: e.s.day, w: 0, b: 0, cv: 0, rot: 1, pk: 0 };
    e.btPlot(p).fz = "care";
    assert.ok(e.careScore(p) >= PRIME.care, "score " + e.careScore(p));
    assert.equal(e.primeChance(p), PRIME.fert);
    Object.assign(e.s.player, { x: p.x, y: p.y + 6 });
    const before = stock(e, "prime_radish"),
      all0 = stock(e, "radish") + stock(e, "fine_radish") + stock(e, "prime_radish");
    assert.ok(e.harvest(p));
    tries++;
    if (stock(e, "prime_radish") > before) prime++;
    // 当季：多收 1 份（上品是从优质那一份换的，总数不变）
    assert.ok(stock(e, "radish") + stock(e, "fine_radish") + stock(e, "prime_radish") - all0 >= CROPS.radish.yield + 1);
  }
  assert.ok(prime > 0 && prime < tries, "prime " + prime + "/" + tries);
  assert.ok(e.al.stats.prime > 0 && e.al.stats.seasonExtra >= tries);
  // 没施肥：25%；照料分不够、不当季：没有
  const p = e.s.plots[13];
  p.crop = "radish";
  p.growth = 1;
  e.g.plots[p.id] = { c: 100, pd: 1, t: e.s.day, wd: e.s.day, w: 0, b: 0, cv: 0, rot: 1, pk: 0 };
  assert.equal(e.primeChance(p), PRIME.chance, "no fertiliser");
  e.g.plots[p.id].c = 30;
  assert.ok(e.careScore(p) < PRIME.care);
  assert.equal(e.primeChance(p), 0, "care too low");
  e.g.plots[p.id].c = 100;
  e.btPlot(p).fz = "care";
  e.s.day = 10;
  assert.equal(e.primeChance(p), 0, "out of season");
  // 反季：不多收
  e.s.day = 10;
  p.growth = CROPS.radish.grow;
  const n0 = stock(e, "radish") + stock(e, "fine_radish") + stock(e, "prime_radish");
  Object.assign(e.s.player, { x: p.x, y: p.y + 6 });
  assert.ok(e.harvest(p));
  assert.ok(stock(e, "radish") + stock(e, "fine_radish") + stock(e, "prime_radish") - n0 <= CROPS.radish.yield + 1, "no extra portion out of season");
  // 卖价、顶用、评比
  assert.equal(ITEMS.prime_radish.sell, Math.round(ITEMS.radish.sell * 2.2));
  for (const k of Object.keys(e.s.inventory)) if (/radish/.test(k)) delete e.s.inventory[k];
  for (const k of Object.keys(e.s.storage)) if (/radish/.test(k)) delete e.s.storage[k];
  give(e, { prime_radish: 3 });
  assert.equal(e.quantityForCost("radish", true), 3);
  assert.deepEqual(e.costPlan({ radish: 2 }, true), { prime_radish: 2 });
  assert.ok(e.festPickable("harvest").includes("prime_radish"));
});

// ================= 腌缸和土酒坛 =================
test("jars: four of one thing in; ready after 3 (4) days, aged after 7 (10) worth about double; taking out early gives the plain one; a destroyed jar gives its contents back; the page's buttons are real", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  atFarm(e);
  const jar = put(e, "alPickleJar", 600, 860);
  give(e, { radish: 6, rye: 4 });
  assert.equal(e.jarFillReason(jar.id, "tomato"), "这口缸不装这个");
  assert.match(e.jarFillReason(jar.id, "potato"), /土豆不够 4 份/);
  // 页面上的按钮
  let page = UI.buildingExtras(e, jar);
  assert.match(page, /data-action="alJarFill" data-id="[^"]*\|radish"/);
  assert.doesNotMatch(page, DEV);
  assert.equal(UI.handleCampaignAction("alJarFill", btn("alJarFill", jar.id + "|radish"), ctx(e)), true);
  assert.equal(stock(e, "radish"), 2);
  assert.deepEqual(e.jarState(jar.id), { state: "brewing", age: 0, left: 3 });
  assert.equal(e.jarFillReason(jar.id, "radish"), "里面还装着东西");
  assert.equal(e.jarTake(jar.id), false);
  assert.ok(said(toasts, /还没好，再等 3 天/));
  e.s.day += 3;
  assert.equal(e.jarState(jar.id).state, "ready");
  page = UI.buildingExtras(e, jar);
  assert.match(page, /能取了：腌菜 ×4/);
  assert.match(e.buildingContext(jar), /能取了/);
  e.s.day += 4;
  assert.equal(e.jarState(jar.id).state, "aged");
  assert.match(UI.campaignHud(e).alerts, /腌缸能取了/);
  assert.equal(UI.handleCampaignAction("alJarTake", btn("alJarTake", jar.id), ctx(e)), true);
  assert.equal(stock(e, "alPickleOld"), JARS.alPickleJar.n);
  assert.ok(ITEMS.alPickleOld.sell >= ITEMS.alPickle.sell * 1.8);
  assert.equal(e.al.jars[jar.id], undefined);
  // 土酒坛：拆了退回原料
  const wine = put(e, "alWineJar", 680, 860);
  assert.ok(e.jarFill(wine.id, "rye"));
  assert.equal(stock(e, "rye"), 0);
  assert.ok(e.dismantle(wine.id));
  assert.equal(stock(e, "rye"), 4);
  // 被毁：第二天退回仓库
  const j2 = put(e, "alPickleJar", 760, 860);
  give(e, { potato: 4 });
  assert.ok(e.jarFill(j2.id, "potato"));
  e.s.buildings = e.s.buildings.filter((b) => b !== j2);
  nextDay(e);
  assert.equal(stock(e, "potato") >= 4, true);
  assert.equal(e.al.jars[j2.id], undefined);
  // 土酒做绷带；守夜纪念日：腌菜 2、土酒 1 当供品（最好的一档）
  assert.ok(ITEMS.alWine && RECIPES.find((r) => r.id === "alSpiritBandage"));
  e.ss.he.stage = 4;
  e.s.day = 28;
  give(e, { alPickle: 2, alWine: 1 });
  assert.equal(e.festivalKind(), "vigil");
  assert.ok(e.festPickable("vigil").includes("alJar"));
  assert.ok(e.festPick("alJar"));
  assert.deepEqual(e.festivalPay("vigil"), { alPickle: 2, alWine: 1 });
});

// ================= 牲口亲近 =================
test("herd: petting once a day, feeding and letting the chickens out raise the bond, a day without petting lowers it; each level adds 12% to an extra egg per lay, the goat from level 4 an extra milk; a loud night spooks them", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  atFarm(e);
  const coop = put(e, "coop", 980, 860);
  e.c.animals.chicken = true;
  e.c.animals.goat = true;
  assert.equal(e.herdHas("flock"), true);
  assert.equal(e.herdHas("goat"), true);
  let page = UI.buildingExtras(e, coop);
  assert.match(page, /牲口亲近/);
  assert.match(page, /data-action="alHerdPet" data-id="flock"/);
  assert.doesNotMatch(page, DEV);
  assert.equal(UI.handleCampaignAction("alHerdPet", btn("alHerdPet", "flock"), ctx(e)), true);
  assert.equal(e.al.herd.flock.pts, HERD.pet);
  assert.equal(e.herdPet("flock"), false, "once a day");
  assert.match(e.herdPetReason("flock"), /今天已经摸过了/);
  // 一天过去：摸过的不掉，没摸的掉
  const day = e.s.day;
  e.herdDay(day);
  assert.equal(e.al.herd.flock.pts, HERD.pet);
  assert.equal(e.al.herd.goat.pts, 0, "never below zero");
  e.al.herd.goat.pts = 50;
  e.herdDay(day);
  assert.equal(e.al.herd.goat.pts, 50 - HERD.decay);
  // 喂了以后照常一回：2 枚蛋、1 份奶，亲近 0 级不多
  e.al.herd.flock.pts = 0;
  e.al.herd.goat.pts = 0;
  give(e, { corn: 10 });
  e.c.animals.ready = {};
  e.c.animals.feedDay = 0;
  assert.ok(e.feedAnimals());
  e.grow(e.c.animals.remaining);
  assert.equal(e.c.animals.ready.egg, 2);
  assert.equal(e.c.animals.ready.milk, 1);
  // 亲近高：多下一枚、多出一份奶的机会按级数算（一天一回，按天掷）
  const extra = (flock, goat) => {
    let eggs = 0,
      milk = 0;
    for (let d = 1; d <= 400; d++) {
      e.s.day = d;
      e.al.herd.spookDay = 0;
      e.al.herd.flock.pts = flock;
      e.al.herd.goat.pts = goat;
      e.c.animals.ready = {};
      e.c.animals.remaining = 10;
      e.grow(10);
      eggs += e.c.animals.ready.egg - 2;
      milk += e.c.animals.ready.milk - 1;
    }
    return [eggs / 400, milk / 400];
  };
  const [e3, m3] = extra(60, 60),
    [e5, m5] = extra(100, 100);
  assert.ok(Math.abs(e3 - 3 * HERD.eggPer) < 0.07, "level 3 eggs " + e3);
  assert.equal(m3, 0, "no extra milk below level " + HERD.milkFrom);
  assert.ok(Math.abs(e5 - 5 * HERD.eggPer) < 0.07, "level 5 eggs " + e5);
  assert.ok(Math.abs(m5 - 2 * HERD.milkPer) < 0.07, "level 5 milk " + m5);
  e.s.day = day;
  // 受惊：那一回不产，亲近掉
  e.herdSpook(e.s.day);
  assert.equal(e.al.herd.flock.pts, 100 - HERD.spook);
  e.c.animals.ready = {};
  e.c.animals.remaining = 10;
  e.grow(10);
  assert.ok(!e.c.animals.ready.egg && !e.c.animals.ready.milk);
  assert.ok(said(toasts, /受了惊/));
  page = UI.buildingExtras(e, coop);
  assert.match(page, /昨晚动静太大/);
});

// ================= 老果园嫁接 =================
test("trees: cut a branch off an old fruit tree in the residential yards (once a week each), graft it on the farm with wood and manure, 14 days to grow, then a fruit a day in its season up to 3; each winter makes them better", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  go(e, "residential");
  const olds = e.objects.filter((o) => o.type === "alOldTree");
  assert.deepEqual(olds.map((o) => o.tree).sort(), [...TREE_IDS].sort());
  const peach = olds.find((o) => o.tree === "peach");
  Object.assign(e.s.player, { x: peach.x, y: peach.y + 20 });
  assert.match(e.context(peach), /剪枝条/);
  e.interact();
  assert.equal(stock(e, cuttingId("peach")), 1);
  assert.equal(e.cutTree("peach"), false);
  assert.ok(said(toasts, /过 7 天再来/));
  assert.match(e.context(peach), /刚剪过（7 天后再来）/);
  // 回农场嫁接
  atFarm(e);
  give(e, { wood: 4, manure: 2 });
  assert.match(UI.buildCardExtras(e, treeType("apple")), /枝条去废弃居民区/);
  assert.ok(e.startBuild(treeType("peach")));
  const tree = place(e, treeType("peach"));
  assert.equal(tree.type, treeType("peach"));
  assert.deepEqual(e.al.trees[tree.id], { planted: e.s.day, fruit: 0, stop: 0, winters: 0 });
  assert.equal(stock(e, cuttingId("peach")), 0);
  // 没长成：不结果
  e.s.day = 8;
  e.al.trees[tree.id].planted = 1;
  e.treeDay(8);
  assert.equal(e.al.trees[tree.id].fruit, 0, "not grown yet");
  assert.match(UI.buildingExtras(e, tree), /还要 7 天长成/);
  // 长成：桃树酷暑结果（第 8–14 天），挂满 3 个
  for (let d = 15; d <= 20; d++) e.treeDay(d);
  assert.equal(e.al.trees[tree.id].fruit, 0, "the peach does not fruit in the harvest season");
  e.al.trees[tree.id].planted = 1;
  for (let d = 36; d <= 41; d++) e.treeDay(d); // 第二年的酷暑
  assert.equal(e.al.trees[tree.id].fruit, TREE_RULES.hold);
  assert.equal(e.al.trees[tree.id].winters, 0, "no year start in between");
  e.treeDay(29);
  assert.equal(e.al.trees[tree.id].winters, 1);
  assert.match(UI.campaignHud(e).alerts, /果树挂满了/);
  // 摘：熬过一个寒潮是优质的
  assert.equal(UI.handleCampaignAction("alTreePick", btn("alTreePick", tree.id), ctx(e)), true);
  assert.equal(stock(e, "fine_alPeach"), 3);
  assert.equal(e.al.trees[tree.id].fruit, 0);
  e.al.trees[tree.id].winters = 2;
  e.al.trees[tree.id].fruit = 1;
  e.treePick(tree.id);
  assert.equal(stock(e, "prime_alPeach"), 1);
  // 夜里被摸进来：枝条断了停 3 天
  let hurt = 0;
  for (let d = 40; d < 80 && !hurt; d++) {
    e.treeHurt(d);
    if (e.al.trees[tree.id].stop > d) hurt = d;
  }
  assert.ok(hurt, "sooner or later a branch breaks");
  assert.equal(e.al.trees[tree.id].stop, hurt + TREE_RULES.stop);
  assert.ok(said(toasts, /折断了桃树的枝条/));
  // 拆掉：记录一起去掉
  assert.ok(e.dismantle(tree.id));
  assert.equal(e.al.trees[tree.id], undefined);
});

// ================= 旧物摆件 =================
test("decor: cabinets sometimes hold an old ornament (locked ones twice as often); the build entry shows only when you have one; placed in a room it counts as furniture, outside each kind lifts the mood up to +3; taking it down gives it back", () => {
  const { e } = make();
  toAct(e, 7);
  go(e, "residential");
  let found = 0,
    lockedFound = 0;
  for (let d = 1; d <= 600; d++) {
    if (Object.keys(e.rollContainer({ id: "dc-" + d, ukind: "kitchen", x: 1, y: 1 }, d).bundle).some((k) => k.startsWith("alDecor_"))) found++;
    if (Object.keys(e.rollContainer({ id: "dl-" + d, ukind: "locked", x: 1, y: 1 }, d).bundle).some((k) => k.startsWith("alDecor_"))) lockedFound++;
  }
  assert.ok(found / 600 > DECOR_RULES.chance * 0.6 && found / 600 < DECOR_RULES.chance * 1.5, "kitchen " + found);
  assert.ok(lockedFound > found * 1.4, "locked " + lockedFound);
  // 建设页：没有摆件就没有这一格
  atFarm(e);
  e.syncDecor();
  assert.equal(BUILDINGS.alDecor.retired, true);
  assert.equal(e.startBuild("alDecor"), false);
  give(e, { [decorItem("bike")]: 1, [decorItem("lion")]: 2 });
  e.update(0.016, {});
  assert.equal(BUILDINGS.alDecor.retired, false);
  const card = UI.buildCardExtras(e, "alDecor");
  assert.match(card, /data-action="alDecorPick" data-id="bike"/);
  assert.match(card, /小石狮 ×2/);
  // 挑一件：直接进摆放
  let closed = 0;
  assert.equal(UI.handleCampaignAction("alDecorPick", btn("alDecorPick", "lion"), ctx(e, { closeMenu: () => closed++ })), true);
  assert.equal(e.buildMode, "alDecor");
  assert.ok(closed > 0);
  e.buildMode = null;
  e.al.decorPick = "lion";
  assert.ok(e.startBuild("alDecor"));
  const out = place(e, "alDecor");
  assert.equal(out.decor, "lion");
  assert.equal(stock(e, decorItem("lion")), 1);
  assert.match(UI.buildingExtras(e, out), /嘴里的石球还能滚/);
  // 屋外：心情 +1（同种不叠）
  const r = e.c.residents[0] || (e.recruit("farmer"), e.c.residents[0]);
  assert.ok(e.moodFactors(r).some((f) => f.key === "decor" && f.v === 1));
  e.al.decorPick = "lion";
  e.startBuild("alDecor");
  place(e, "alDecor");
  assert.equal(e.decorOutside(), 1, "the same kind counts once");
  e.al.decorPick = "bike";
  e.startBuild("alDecor");
  place(e, "alDecor");
  assert.equal(e.decorOutside(), 2);
  assert.equal(stock(e, decorItem("bike")), 0);
  assert.equal(BUILDINGS.alDecor.retired, true, "nothing left to place");
  // 房间里：算一类家具
  const floor = put(e, "floor", 420, 360);
  put(e, "chair", 440, 360);
  put(e, "lamp", 400, 340);
  const inside = put(e, "alDecor", 430, 380, { decor: "tv" });
  const room = e.rooms().find((x) => x.floor === floor);
  const before = e.roomComfort(room);
  assert.ok(room.types.includes("alDecor"));
  assert.ok(e.comfortList(room).includes("摆件"));
  assert.equal(e.decorOutside(), 2, "the one in the room is not outside");
  // 回收：原样还回来
  assert.ok(e.dismantle(inside.id));
  assert.equal(stock(e, decorItem("tv")), 1);
  const room2 = e.rooms().find((x) => x.floor === floor);
  assert.equal(e.roomComfort(room2), before - 1);
  // 农舍「房间与家具」页：手上的摆件
  assert.match(roomExtras(e), /旧物摆件/);
  assert.doesNotMatch(roomExtras(e), DEV);
});

// ================= 野物和蘑菇 =================
test("forage: 4–8 spots a day on the farm and in visited ruins by season; picked with E; the day after rain two are mushrooms, half poisonous — 许医生 sorts them, eating one raw may make you sick", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  e.s.visited = { residential: true, hospital: true, warehouse: true };
  for (const d of [3, 10, 17, 24]) {
    e.s.day = d;
    e.s.weather = "晴朗";
    e.forageSpawn(d);
    const f = e.al.forage;
    assert.ok(f.spots.length >= FORAGE_RULES.min && f.spots.length <= FORAGE_RULES.max, "day " + d);
    for (const p of f.spots) {
      assert.ok(FORAGE_SPOTS[p.region], p.region);
      if (p.item !== MUSHROOM.raw && !(WEATHER[(d - 2 + WEATHER.length) % WEATHER.length] && ["小雨", "暴雨"].includes(WEATHER[(d - 2 + WEATHER.length) % WEATHER.length]))) assert.ok(FORAGE[seasonOf(d).id].includes(p.item), d + " " + p.item);
    }
  }
  // 农场上的：E 捡起来
  e.s.day = 3;
  e.forageSpawn(3);
  e.al.forage.spots[0].region = "farm";
  atFarm(e);
  const o = e.objects.find((x) => x.type === "alForage");
  assert.ok(o, "a forage spot on the farm");
  assert.doesNotMatch(e.context(o), DEV);
  Object.assign(e.s.player, { x: o.x, y: o.y + 4 });
  const item = o.item,
    before = stock(e, item);
  e.interact();
  assert.ok(stock(e, item) > before);
  assert.ok(!e.objects.some((x) => x.type === "alForage" && x.sid === o.sid));
  if (e.al.forage.spots.some((p) => !p.taken && p.region === "farm")) assert.match(UI.campaignHud(e).alerts, /野地里还有 \d+ 处野物（农场边 \d+ 处）/);
  // 雨后：蘑菇
  const rainyDay = dayWhere((d) => ["小雨", "暴雨"].includes(WEATHER[(d - 2) % WEATHER.length]), 5);
  e.s.day = rainyDay;
  e.forageSpawn(rainyDay);
  assert.equal(e.al.forage.spots.filter((p) => p.item === MUSHROOM.raw).length, MUSHROOM.spots);
  // 许医生认蘑菇
  give(e, { [MUSHROOM.raw]: 10 });
  assert.equal(e.mushroomReason(), "许医生不在营地");
  e.recruit("medic");
  assert.equal(e.mushroomReason(), "");
  const medic = e.c.residents.find((r) => r.id === "medic");
  assert.match(residentExtras(e, medic), /data-action="alMushroom"/);
  assert.equal(UI.handleCampaignAction("alMushroom", btn("alMushroom"), ctx(e)), true);
  assert.equal(stock(e, MUSHROOM.raw), 0);
  const good = stock(e, MUSHROOM.good);
  assert.ok(good >= 3 && good <= 9, "kept " + good);
  assert.ok(said(toasts, /许医生挑出 \d+ 朵有毒的/));
  // 生吃：四成吃坏肚子，体力最多 60
  let sick = 0;
  for (let i = 0; i < 40; i++) {
    e.s.inventory[MUSHROOM.raw] = 1;
    e.al.sick = 0;
    e.s.minute = 600 + i;
    e.s.player.hunger = 40;
    assert.ok(e.consume(MUSHROOM.raw));
    if (e.sickNow()) sick++;
  }
  assert.ok(sick > 8 && sick < 26, "sick " + sick);
  e.al.sick = e.absNow() + 600;
  e.s.player.stamina = 100;
  e.update(0.016, {});
  assert.ok(e.s.player.stamina <= 60);
  assert.match(UI.campaignHud(e).alerts, /吃坏肚子了/);
});

// ================= 夜里的好事 =================
test("night: on a quiet night about one in 25 brings something good — satellite debris, migrating birds, a parcel at the door or a radio fix on a crate; never after an attack, a raid or a long night", () => {
  const { e } = make();
  toAct(e, 7);
  e.s.visited = { residential: true, hospital: true, warehouse: true };
  let n = 0;
  const kinds = {};
  for (let d = 1; d <= 3000; d++) {
    const r = e.alRoll("good", d);
    if (r < NIGHT_GOOD.chance) n++;
  }
  assert.ok(n / 3000 > 0.025 && n / 3000 < 0.055, "rate " + n);
  // 每一种都真的给东西
  for (const kind of NIGHT_GOOD.kinds) {
    const { e: q } = make();
    toAct(q, 7);
    q.s.visited = { residential: true };
    q.ut.cache = null;
    const d = dayWhere((x) => q.alRoll("good", x) < NIGHT_GOOD.chance && NIGHT_GOOD.kinds[Math.floor(q.alRoll("goodk", x) * NIGHT_GOOD.kinds.length) % NIGHT_GOOD.kinds.length] === kind, 1, 20000);
    q.s.day = d;
    atFarm(q);
    const plots = q.farmPlots();
    const g = q.nightGood(d);
    assert.equal(g.kind, kind);
    kinds[kind] = true;
    if (kind === "debris" || kind === "parcel") {
      q.goodObjects();
      const o = q.objects.find((x) => x.type === (kind === "debris" ? "alDebris" : "alParcel"));
      assert.ok(o, kind + " is on the farm");
      assert.match(UI.campaignHud(q).alerts, kind === "debris" ? /卫星残骸/ : /门口有个包裹/);
      Object.assign(q.s.player, { x: o.x, y: o.y + 4 });
      const before = Object.values(q.s.inventory).reduce((a, b) => a + b, 0);
      q.interact();
      assert.ok(Object.values(q.s.inventory).reduce((a, b) => a + b, 0) > before, kind + " gives things");
      assert.equal(q.al.good.taken, true);
      assert.ok(!q.objects.some((x) => x.type === "alDebris" || x.type === "alParcel"));
      if (kind === "debris") assert.ok(plots.every((p) => p.crop === q.farmPlots().find((x) => x.id === p.id).crop), "the debris never lands on a crop");
    }
    if (kind === "birds") assert.ok(stock(q, "manure") >= NIGHT_GOOD.birds.manure);
    if (kind === "signal") {
      assert.ok(q.ut.cache && q.ut.cache.day === d && !q.ut.cache.opened);
      assert.ok(q.ruinNews().some((p) => p.kind === "cache" && p.when === "today"), "the crate is pinned on the map today");
    }
    assert.doesNotThrow(() => Engine.parse(q.serialize()));
  }
  assert.equal(Object.keys(kinds).length, 4);
  // 坏的夜里：不出
  const { e: b } = make();
  toAct(b, 7);
  atFarm(b);
  const d = dayWhere((x) => b.alRoll("good", x) < NIGHT_GOOD.chance, 3);
  b.s.day = d - 1;
  nextDay(b); // 0 点记一下
  assert.equal(b.al.mark.day, d);
  b.hn.stats.attacks = (b.hn.stats.attacks || 0) + 1;
  hour(b, 6);
  assert.ok(!b.al.good || b.al.good.day !== d, "an attack that night: nothing good");
  // 平安的夜里：出
  const { e: c } = make();
  toAct(c, 7);
  atFarm(c);
  c.s.day = d - 1;
  nextDay(c);
  hour(c, 6);
  assert.equal(c.al.good?.day, d, "a quiet night: something good");
  assert.ok(c.o.log.some((l) => /夜里的好事：/.test(l.text)));
});

// ================= 油灯下念账 =================
test("ledger: waking up shows a three-line ledger (shipping, the night, today) instead of a page; a short-on-food morning still shows the summary page; it goes into the log", () => {
  const { e } = make();
  toAct(e, 7);
  atFarm(e);
  give(e, { bread: 80 });
  e.s.minute = 22 * 60;
  e.events.length = 0;
  assert.equal(e.sleep(), true);
  const led = e.events.find((v) => v.type === "ledger");
  assert.ok(led, "ledger event");
  assert.equal(led.lines.length, 3);
  assert.match(led.lines[0], /^出货箱/);
  assert.match(led.lines[1], /^夜里：/);
  assert.match(led.lines[2], new RegExp("^今天：" + seasonOf(e.s.day).name + "第 " + seasonDay(e.s.day) + " 天"));
  assert.equal(led.day, e.s.day);
  assert.ok(led.ms >= 3000);
  assert.ok(!e.events.some((v) => v.type === "menu" && v.view === "summary"));
  assert.ok(e.o.log.some((l) => /的账：出货箱/.test(l.text)));
  for (const t of led.lines) assert.doesNotMatch(t, DEV);
  // 缺粮：照旧弹日终总结，不出账本
  const { e: h } = make();
  toAct(h, 7);
  atFarm(h);
  for (const id of Object.keys(h.s.storage)) if (ITEMS[id]?.food) delete h.s.storage[id];
  for (const id of Object.keys(h.s.inventory)) if (ITEMS[id]?.food) delete h.s.inventory[id];
  h.s.minute = 22 * 60;
  h.events.length = 0;
  h.sleep();
  assert.ok(h.events.some((v) => v.type === "menu" && v.view === "summary"));
  assert.ok(!h.events.some((v) => v.type === "ledger"));
});

// ================= 其他 =================
test("music: the farm's daytime piece changes with the season; the farm day piece stays for the thaw", () => {
  const { e } = make();
  e.s.day = 3;
  assert.equal(e.seasonPiece("farmDay"), "farmDay");
  e.s.day = 10;
  assert.equal(e.seasonPiece("farmDay"), "farmDay_heat");
  e.s.day = 17;
  assert.equal(e.seasonPiece("farmDay"), "farmDay_harvest");
  e.s.day = 24;
  assert.equal(e.seasonPiece("farmDay"), "farmDay_cold");
  for (const id of ["farmDay_heat", "farmDay_harvest", "farmDay_cold"]) assert.ok(PIECES[id]);
});

test("UI: every new page and card renders without dev words; new alerts point to the farm; buttons that cannot work say why", () => {
  const { e } = make();
  toAct(e, 8);
  atFarm(e);
  e.recruit("medic");
  const jar = put(e, "alWineJar", 600, 860),
    tree = put(e, treeType("apple"), 700, 900),
    deco = put(e, "alDecor", 760, 900, { decor: "globe" }),
    coop = put(e, "coop", 980, 860),
    cab = put(e, "medCabinet", 500, 300);
  e.c.animals.chicken = true;
  e.al.trees[tree.id] = { planted: 1, fruit: 3, stop: 0, winters: 0 };
  give(e, { [MUSHROOM.raw]: 2, corn: 2 });
  e.s.day = 20;
  for (const b of [jar, tree, deco, coop, cab]) {
    const html = UI.buildingExtras(e, b);
    assert.ok(html.length > 40, b.type);
    assert.doesNotMatch(html, DEV, b.type);
  }
  // 不能用的按钮：灰掉并写原因
  const jarPage = UI.buildingExtras(e, jar);
  assert.match(jarPage, /<button data-action="alJarFill" data-id="[^"]*\|corn" disabled title="玉米不够 4 份">/);
  assert.match(UI.buildingExtras(e, cab), /data-action="alMushroom"/);
  for (const v of ["calendar", "radio", "gBoard"]) assert.doesNotMatch(view(e, v), DEV, v);
  const alerts = UI.campaignHud(e).alerts;
  assert.match(alerts, /果树挂满了/);
  assert.doesNotMatch(alerts, DEV);
  // 建设页的每一格
  for (const t of AL_BUILD_TYPES) assert.doesNotMatch(UI.buildCardExtras(e, t), DEV, t);
  // 引擎里的提示：E 的那一行
  for (const b of [jar, tree, deco]) assert.doesNotMatch(e.buildingContext(b), DEV);
  // 存档读得回
  assert.doesNotThrow(() => Engine.parse(e.serialize()));
});
