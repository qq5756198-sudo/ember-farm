// v0.26.0「整顿」：去掉与合并（旧档转换只做一次、材料一个不少）、出货箱的挂牌和明天的行情、心情三档与来劲、
// 法令的代价、长夜按时来波和警钟、陷阱、信标、维修点、守卫、修理包、贺满仓的期限、机床加急、运输骡、借宿、
// 带徒改学职能、设施卡和警报栏、存档。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, needsStoryMigration } from "./pre-trim.mjs";
import * as Old from "../dist/longnight.js";
import { BUILDINGS, ITEMS } from "../dist/data.js";
import { TASKS } from "../dist/rebuild-data.js";
import { LN } from "../dist/longnight-data.js";
import { LATHE_MODES } from "../dist/outpost-data.js";
import { BOSSES } from "../dist/undertow-data.js";
import { LISTING, MOOD, MOOD_FACTORS, INSPIRE, LN_PACE, TRAP_ALL, TOWER, LURE, HEMC, RETRAIN, CARGO_RETURN, RETIRED, CARD_TYPES } from "../dist/tidy-data.js";
import * as UI from "../dist/campaign-ui.js";
import { RESIDENT_HOOKS, residentExtras } from "../dist/people-hooks.js";
import { preserveBeforeUpgrade, UPGRADE_CHECKPOINT, CAMPAIGN_SAVE } from "../dist/player-session.js";

const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN/;
const make = (state = freshState(), seed = 20241) => {
  const toasts = [];
  if (state.undertow) state.undertow.seed = seed;
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  if (e.dy) e.dy.pending = null;
  return { e, toasts };
};
// 主线走到第 n 段开头
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
const run = (e, secs) => {
  for (let t = 0; t < secs - 1e-9; t += 0.05) {
    e.invulnerable = 5;
    e.s.player.hp = 100;
    e.update(0.05, { x: 0, y: 0 });
  }
};
const clock = (e, day, minute) => {
  e.s.day = day;
  e.s.minute = minute;
  e.c.workClock = minute % 60;
};
const stock = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);
const near = (a, b, msg = "") => assert.ok(Math.abs(a - b) < 1e-6, msg + " " + a + " vs " + b);
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const residents = (e, n = 3) => {
  for (const id of ["farmer", "medic", "mechanic"].slice(0, n)) e.recruit(id);
  put(e, "bed", 700, 330);
  put(e, "bed", 760, 330);
  for (const r of e.c.residents) r.fed = true;
};

// 一份 v0.25 的旧档：罐装机（一批做好、一批没做完）、鱼篓（今天没收）、摊位（三格，一格超过 20 件）、
// 农舍开着加班和伤员优先、法令位只剩一个、机床停在弹药、欠贺满仓一笔
function oldSave() {
  const e = new Old.Engine(Old.freshState(), () => {});
  const sc = e.sc;
  sc.act = 7;
  sc.claimed = ["act1", "supply", "act2", "act3", "act4", "act5", "act6"];
  sc.choice = "ration";
  sc.letters = ["act1", "act2", "act3", "act4", "act5", "act6", "act7"];
  sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true;
  sc.camp = { x: 560, y: 735 };
  e.r.claimed = TASKS.slice(0, TASKS.findIndex((t) => t.id === "network") + 1).map((t) => t.id);
  e.o.hospital = "water";
  e.o.youke = true;
  e.o.lathe = { mode: "ammo", day: 0 };
  e.s.day = 12;
  put(e, "canner", 700, 600);
  put(e, "fishTrap", 1000, 800, { fishDay: 11 });
  put(e, "stall", 760, 600);
  e.c.stall = [
    { item: "potato", qty: 7, band: "fair" },
    { item: "bread", qty: 25, band: "fair" },
    { item: "tomato", qty: 3, band: "premium" },
  ];
  e.c.production.push(
    { id: "job-1", recipe: "parcel", out: { parcel: 1 }, cost: { jam: 2, cloth: 1 }, station: "canner", remaining: 30, ready: false },
    { id: "job-2", recipe: "parcel", out: { parcel: 1 }, cost: { jam: 2, cloth: 1 }, station: "canner", remaining: 0, ready: true },
  );
  e.f.policy.work = "overtime";
  e.f.policy.food = "injured";
  e.w.decrees = ["kitchen", "patrol", "silence"];
  e.fr.hemc.phase = "open";
  e.fr.hemc.debt = { type: "solar", total: { parts: 6, scrap: 9 }, paid: { parts: 2, scrap: 3 }, day: 3 };
  return { text: e.serialize(), storage: JSON.parse(JSON.stringify(e.s.storage)) };
}

// ================= 去掉与合并：旧档转换 =================
test("an old save is tidied once: canner, fish trap and stall come down with every material back, the stall goods move to the listing, parcels come back, policies become decrees, the lathe leaves ammo", () => {
  const { text, storage } = oldSave();
  assert.equal(JSON.parse(text).tidy, undefined);
  assert.equal(needsStoryMigration(text), true, "an old save is kept once before it is upgraded");
  const s = Engine.parse(text);
  const { e, toasts } = make(s);
  // 三样都拆了
  for (const type of RETIRED) assert.ok(!e.s.buildings.some((b) => b.type === type), type + " is gone");
  // 退的材料一个不少：罐装机 木 8 废金属 8 零件 3；鱼篓 木 6 布 1（加今天的一条鱼）；摊位 木 10 废金属 2；
  // 摊位超出 20 件的 5 份干粮；没做完的配送箱退 番茄罐头 2、布 1；做好的配送箱 1
  const diff = {};
  for (const [k, v] of Object.entries(e.s.storage)) if ((storage[k] || 0) !== v) diff[k] = v - (storage[k] || 0);
  assert.deepEqual(diff, { wood: 24, scrap: 10, parts: 3, cloth: 2, fish: 1, bread: 5, jam: 2, parcel: 1 });
  assert.deepEqual(
    e.td.listing.map((l) => [l.item, l.qty]),
    [
      ["potato", 7],
      ["bread", 20],
      ["tomato", 3],
    ],
  );
  assert.deepEqual(e.c.stall, []);
  assert.ok(!e.c.production.some((j) => j.station === "canner"));
  // 加班并进了法令簿（还有一个位）；伤员优先没位置，记下来等你签；农舍的规矩跟着法令走
  assert.deepEqual(e.w.decrees, ["kitchen", "patrol", "silence", "overtime"]);
  assert.deepEqual(e.f.policy, { work: "overtime", food: "equal" });
  assert.equal(e.o.lathe.mode, "parts");
  const notes = e.td.converted.notes.join("\n");
  for (const word of ["罐装机拆了", "鱼篓拆了", "摊位拆了", "挂牌", "配送箱", "加班周", "伤员优先", "法令位满了", "贺满仓", "机床不再做弹药"]) assert.ok(notes.includes(word), word);
  assert.ok(!toasts.some((t) => t.text.startsWith("营地整顿")), "not on the title screen");
  e.update(0.016, { x: 0, y: 0 });
  assert.ok(toasts.some((t) => t.text.startsWith("营地整顿")), "said so on the first frame in the game");
  // 贺满仓的旧账：期限从今天算（还过一期，第二期在 12 + 6 天）
  assert.deepEqual(e.hemcDue(), { k: 2, due: 18, late: 0, extra: 0 });
  // 只转一次：存档读回去不再动，也不再弹
  const again = Engine.parse(e.serialize());
  assert.deepEqual(again.tidy.converted.notes, e.td.converted.notes);
  assert.equal(again.buildings.length, e.s.buildings.length);
  assert.equal(needsStoryMigration(e.serialize()), false);
  const m2 = make(again);
  m2.e.update(0.016, { x: 0, y: 0 });
  assert.ok(!m2.toasts.some((t) => t.text.startsWith("营地整顿")));
  // 第二天早上的日终总结里有清单
  e.o.report = { day: 12, money: 0, kills: 0, harvested: 0, foodStart: 1, foodEnd: 1, night: [], days: 3, threats: [] };
  const sum = UI.renderCampaignView(e, { view: "summary" });
  assert.match(sum, /营地整顿/);
  assert.match(sum, /罐装机拆了/);
  e.o.report.day = 13;
  assert.doesNotMatch(UI.renderCampaignView(e, { view: "summary" }), /营地整顿/);
});

test("before an old save is read for the first time its exact bytes are kept once in the upgrade checkpoint, when that slot is free", () => {
  const { text } = oldSave();
  const store = new Map([[CAMPAIGN_SAVE, text]]);
  const storage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, v) };
  assert.equal(preserveBeforeUpgrade(storage, needsStoryMigration), true);
  assert.equal(JSON.parse(store.get(UPGRADE_CHECKPOINT)).main, text);
  assert.equal(preserveBeforeUpgrade(storage, needsStoryMigration), false, "only once");
});

test("retired buildings cannot be built any more and say where their job went; a new game has nothing to tidy", () => {
  const { e, toasts } = make();
  for (const type of RETIRED) {
    assert.equal(BUILDINGS[type].retired, true);
    assert.equal(e.startBuild(type), false);
  }
  assert.ok(toasts.some((t) => /出货箱挂牌/.test(t.text)));
  assert.ok(toasts.some((t) => /篝火灶/.test(t.text)));
  assert.ok(toasts.some((t) => /林边池塘/.test(t.text)));
  assert.equal(e.td.converted, null);
  assert.equal(needsStoryMigration(e.serialize()), false);
  // 机床的弹药不在选单里，修理包在
  assert.ok(LATHE_MODES.ammo.retired);
  assert.ok(LATHE_MODES.repair);
  assert.equal(ITEMS.repairKit.type, "resource");
});

test("the fish-migration water sample now pays at the pond on rainy days (it used to hang on the fish trap); old pages stop talking about the fish trap and the stall", async () => {
  const { e, toasts } = make();
  clock(e, 10, 600);
  const pond = e.objects.find((o) => o.type === "pond");
  Object.assign(e.s.player, { x: pond.x, y: pond.y + 40 });
  e.v.benefits.migration = "sample";
  e.s.weather = "小雨";
  const catchOne = () => {
    assert.ok(e.startFishing(false));
    e.c.fishing.phase = "bite";
    return e.hookFish();
  };
  const n0 = stock(e, "riverFish");
  assert.ok(catchOne());
  // 雨天本来就钓上一条蓝背鱼，迁徙记录再给一条
  assert.equal(stock(e, "riverFish"), n0 + 2);
  assert.ok(toasts.some((t) => /迁徙记录/.test(t.text)));
  assert.ok(catchOne());
  assert.equal(stock(e, "riverFish"), n0 + 3, "only once every three days");
  e.s.day += 3;
  assert.ok(catchOne());
  assert.equal(stock(e, "riverFish"), n0 + 5);
  e.s.day += 3;
  e.s.weather = "晴";
  const f0 = stock(e, "fish"),
    r0 = stock(e, "riverFish");
  assert.ok(catchOne());
  assert.equal(stock(e, "fish"), f0 + 1);
  assert.equal(stock(e, "riverFish"), r0, "no extra on a dry day");
  // 没选检验水样的照旧
  const other = make().e;
  clock(other, 10, 600);
  Object.assign(other.s.player, { x: pond.x, y: pond.y + 40 });
  other.s.weather = "小雨";
  assert.ok(other.startFishing(false));
  other.c.fishing.phase = "bite";
  const o0 = stock(other, "riverFish");
  assert.ok(other.hookFish());
  assert.equal(stock(other, "riverFish"), o0 + 1);
  // 旧说明：任务、营地事务、柱子入口、回响事件
  const { ECHO_EVENTS } = await import("../dist/echoes-data.js");
  const { HOME_LESSONS } = await import("../dist/guidance-data.js");
  const { FEATURES } = await import("../dist/expansion-data.js");
  const { PILLARS } = await import("../dist/rebuild-data.js");
  const sample = ECHO_EVENTS.find((x) => x.id === "migration").options.find((o) => o.id === "sample");
  assert.match(sample.result, /池塘/);
  const fishing = HOME_LESSONS.find((x) => x.id === "fishing");
  for (const text of [sample.result, fishing.result, fishing.label, ...FEATURES.flat().filter((x) => typeof x === "string"), ...PILLARS.flatMap((p) => (p.tools || []).map((t) => t[2]))]) assert.doesNotMatch(text, /鱼篓|摊位/, text);
});

// ================= 出货箱：挂牌与明天的行情 =================
test("the listing sells one piece every 90 minutes by day at 1.25 times the price, in turn, and nothing at night", () => {
  const { e } = make();
  delete e.s.inventory.bread;
  delete e.s.inventory.potato;
  Object.assign(e.s.storage, { potato: 30, bread: 10 });
  e.s.minute = 300;
  assert.match(e.listReason("potato", 25), /最多挂 20/);
  assert.match(e.listReason("bread", 11), /不够/);
  assert.match(e.listReason("hoe", 1), /不能挂牌/);
  assert.equal(e.listItem("potato", 5), true);
  assert.equal(e.listItem("bread", 3), true);
  assert.equal(e.listItem("potato", 2), true);
  assert.match(e.listReason("bread", 1), /挂满/);
  assert.equal(stock(e, "potato"), 23);
  const price = { potato: e.listPrice("potato"), bread: e.listPrice("bread") };
  assert.equal(price.potato, Math.round(ITEMS.potato.sell * LISTING.mult));
  // 05:00 → 06:00 没人路过
  const m0 = e.s.money;
  e.advanceMinutes(60);
  assert.equal(e.s.money, m0);
  // 06:00 → 22:00：16 个钟点能卖 10 件，挂了 10 件
  e.advanceMinutes(16 * 60);
  assert.equal(e.td.listing.length, 0);
  assert.equal(e.s.money - m0, 7 * price.potato + 3 * price.bread);
  assert.ok(e.td.listLog.length > 0 && e.td.listLog.length <= LISTING.log);
  // 取下：回仓库
  e.listItem("bread", 4);
  const id = e.td.listing[0].id;
  assert.equal(e.unlistItem(id), true);
  assert.equal(stock(e, "bread"), 7);
  // 换种集的那颗星：这周挂过牌
  assert.equal(e.festivalStars("seeds")[0], true);
});

test("tomorrow's price is shown today and is what the shipping box will pay tomorrow", () => {
  const { e } = make();
  for (const id of ["potato", "bread", "scrap"]) assert.equal(e.shipTrendTomorrow(id), e.shipTrend(id, e.s.day + 1));
  e.s.inventory.potato = 3;
  assert.match(UI.renderCampaignView(e, { view: "shipping" }), /明天/);
  assert.match(UI.renderCampaignView(e, { view: "shipping" }), /挂牌 · 0\/3 格/);
});

// ================= 心情三档 =================
test("mood: the target is 50 plus the reasons written out, morale moves four tenths of the way each night, and the old daily bumps no longer pile up", () => {
  const { e } = make();
  toAct(e, 7);
  residents(e, 3);
  const r = e.resident("farmer");
  r.morale = 60;
  // 法令：配给卡、加班周
  e.w.decrees = ["ration", "overtime"];
  const keys = e.moodFactors(r).map((f) => f.key);
  assert.ok(keys.includes("ration") && keys.includes("overtime"));
  const target = e.moodTarget(r);
  assert.equal(target, Math.max(MOOD.min, MOOD.home + e.moodFactors(r).reduce((a, f) => a + f.v, 0)));
  // 一夜之后：往该有的心情走四成（winter、seasons 原来每天加减的那几处不再叠加）
  clock(e, 9, 1380);
  const before = r.morale;
  e.advanceMinutes(60);
  assert.equal(e.s.day, 10);
  assert.equal(r.morale, Math.round(before + (e.moodTarget(r) - before) * MOOD.drift));
  // 住不下的人：心情 −10
  e.recruit("cartographer");
  const extra = e.c.residents[e.c.residents.length - 1];
  if (extra && e.c.residents.indexOf(extra) >= e.residentsCapacity()) assert.ok(e.moodFactors(extra).some((f) => f.key === "noBed"));
  // 昨晚没吃上饭
  e.o.dinnerDay = e.s.day - 1;
  e.o.missed = ["r:farmer"];
  assert.ok(e.moodFactors(r).some((f) => f.key === "missed" && f.v === MOOD_FACTORS.missed.v));
  assert.equal(e.moodTier({ morale: 20 }), "low");
  assert.equal(e.moodTier({ morale: 50 }), "normal");
  assert.equal(e.moodTier({ morale: 75 }), "high");
});

test("low mood: an idle hour and a sulking day (guards still take their post in a fight); high mood: one more job some hours", () => {
  const { e } = make();
  toAct(e, 7);
  residents(e, 3);
  for (const r of e.c.residents) r.priorities = { farmer: 1, mechanic: 0, medic: 0, guard: 0 };
  for (const p of e.s.plots.slice(0, 10)) Object.assign(p, { tilled: true, crop: "potato", growth: 0, wateredDay: -1 });
  // 骰子固定：歇着、闹情绪、多干都必中
  e.tdRoll = () => 0;
  const [a, b, c] = e.c.residents;
  a.morale = 20;
  b.morale = 50;
  c.morale = 90;
  clock(e, 9, 360 - 1);
  e.advanceMinutes(2);
  assert.equal(e.td.mood[a.id].strike, 9, "sulks for the day");
  assert.equal(a.workRole, "rest");
  assert.match(a.status, /闹情绪/);
  assert.ok(e.striking(a));
  assert.notEqual(b.workRole, "rest");
  assert.match(c.status, /心情好/);
  // 打仗时闹情绪的守卫还上岗
  a.priorities.guard = 1;
  e.s.horde.phase = "active";
  a.workRole = "guard";
  assert.equal(e.residentActive(a), true);
  e.s.horde.phase = "won";
  // 只是低落、不闹情绪的那天：这个钟点歇着
  e.td.mood[a.id].strike = 0;
  e.tdRoll = (kind) => (kind === "idle" ? 0 : 1);
  e.advanceMinutes(60);
  assert.equal(a.workRole, "rest");
  assert.match(a.status, /心情低落/);
});

test("inspiration: only in high spirits, at 08:00, once a week; each person has their own (lucky harvest, free medkits, everything mended, sharp eyes)", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  residents(e, 3);
  for (const r of e.c.residents) r.morale = 90;
  e.resident("farmer").priorities = { farmer: 1, mechanic: 0, medic: 0, guard: 0 };
  e.resident("medic").priorities = { farmer: 0, mechanic: 0, medic: 1, guard: 0 };
  e.resident("mechanic").priorities = { farmer: 0, mechanic: 1, medic: 0, guard: 0 };
  const fence = put(e, "fence", 900, 600);
  fence.hp = 10;
  const kits = stock(e, "medkit");
  e.tdRoll = (kind) => (kind === "insp" ? 0 : 1);
  clock(e, 9, 479);
  e.advanceMinutes(2);
  for (const r of e.c.residents) assert.ok(e.inspired(r), r.id + " inspired");
  assert.equal(stock(e, "medkit"), kits + INSPIRE.medic.give.medkit);
  assert.equal(fence.hp, BUILDINGS.fence.hp);
  assert.ok(toasts.some((t) => /来劲了：好手气/.test(t.text)));
  // 好手气：她今天照看过的田，你收的时候多 2 份
  const p = e.s.plots[0];
  Object.assign(p, { tilled: true, crop: "potato", growth: 999, wateredDay: e.s.day });
  e.td.lucky.plots = [p.id];
  e.s.region = "farm";
  const before = stock(e, "potato") + stock(e, "fine_potato") + stock(e, "hardy_potato");
  Object.assign(e.s.player, { x: p.x + 18, y: p.y + 6 });
  assert.ok(e.handHarvest(p));
  const after = stock(e, "potato") + stock(e, "fine_potato") + stock(e, "hardy_potato");
  assert.ok(after - before >= INSPIRE.farmer.bonus + 1, "two more than usual");
  // 7 天里不会再来
  e.tdRoll = () => 0;
  clock(e, 12, 479);
  e.advanceMinutes(2);
  for (const r of e.c.residents) assert.equal(e.td.mood[r.id].insp.day, 9);
  // 守卫的眼尖：瞭望塔伤害 +50%
  const g = e.resident("mechanic");
  e.td.mood[g.id].insp = { day: e.s.day, kind: "guard" };
  const z = e.enemy("slow", 900, 500, false);
  e.enemies.push(z);
  const hp = z.hp;
  e._damageSource = "tower";
  e.hurtEnemy(z, 10, 0);
  e._damageSource = null;
  near(hp - z.hp, 10 * TOWER.mult * INSPIRE.guard.mult);
});

test("the shared kitchen with no wood does not count as eating well; the salvage team takes 铁锹 along too", () => {
  const { e } = make();
  toAct(e, 7);
  residents(e, 1);
  Object.assign(e.s.storage, { bread: 20, stew: 10, jam: 10 });
  delete e.s.storage.wood;
  delete e.s.inventory.wood;
  e.w.decrees = ["kitchen", "salvage"];
  clock(e, 9, 1079);
  e.advanceMinutes(2);
  assert.equal(e.o.dinnerDay, 9);
  assert.equal(e.td.coldKitchen, 9);
  assert.equal(e.ladderChecks()[1], false);
  // 有柴的那晚：两种就算吃得好
  e.s.storage.wood = 5;
  clock(e, 10, 1079);
  e.advanceMinutes(2);
  assert.equal(e.ladderChecks()[1], true);
  // 拾荒队：铁锹上午十点前也跟着出去
  const h = e.sc.helpers[0] || (e.addHelper?.("tieqiao"), e.sc.helpers[0]);
  assert.ok(h, "a helper");
  clock(e, 11, 7 * 60 + 30);
  e.helperHour(h);
  assert.equal(h.status, "跟拾荒队出去了");
});

// ================= 长夜：按时来波、警钟 =================
function postStory(day = 30) {
  const { e, toasts } = make();
  toAct(e, 9);
  e.sc.claimed = ["act1", "supply", "act2", "act3", "act4", "act5", "act6", "act7", "act8"];
  e.s.day = day;
  e.s.minute = 600;
  e.c.workClock = 0;
  e.s.stats.hordes = 6;
  e.s.horde = { phase: "won", timer: 0, remaining: 0, spawnTimer: 0, direction: 0 };
  e.c.nextHordeDay = day + 20;
  e.update(0.016, { x: 0, y: 0 });
  return { e, toasts };
}
const FIRST = 38;
const killWave = (e) => {
  for (const z of e.enemies.filter((q) => q.horde && !q.dead)) e.hurtEnemy(z, z.hp + 999, 0);
};

test("long night: waves come at 22:00, 00:00 and 02:00 and the boss at 03:00 even when you clear them early; the bell calls the next one up to twice a night for one more rare draw each", () => {
  const { e, toasts } = postStory(30);
  clock(e, FIRST, 1319.9);
  run(e, 0.2);
  const N = e.ln.night;
  assert.ok(N);
  assert.ok(e.objects.some((o) => o.type === "tdBell"), "the bell is on the farm");
  assert.ok(toasts.some((t) => /22:00、00:00、02:00，03:00/.test(t.text)));
  assert.match(e.lnBellReason(), /还没打完/);
  run(e, 24);
  killWave(e);
  run(e, 1);
  assert.equal(e.lnBetween(), true);
  assert.ok(toasts.some((t) => /这一波打完了/.test(t.text)));
  run(e, 25);
  assert.equal(N.wave, 1, "no early wave by itself");
  const info = e.lnInfo().night;
  assert.equal(info.next.what, "wave");
  assert.ok(info.next.secs > 0 && info.bell);
  assert.match(e.context({ type: "tdBell" }), /第 2 波还有 \d+ 秒/);
  // 走到警钟边按 E
  Object.assign(e.s.player, { x: LN_PACE.bell.x, y: LN_PACE.bell.y + 20 });
  e.interact();
  assert.equal(N.wave, 2);
  assert.equal(e.td.bell.early, 1);
  // 第三波照时间来（02:00）
  run(e, 28);
  killWave(e);
  clock(e, FIRST + 1, LN.waveAt[2] - 120);
  run(e, 0.2);
  assert.equal(N.wave, 3);
  run(e, 32);
  killWave(e);
  run(e, 0.5);
  assert.equal(N.boss, 0, "the boss keeps to 03:00");
  assert.equal(e.lnNext().what, "boss");
  assert.equal(e.lnNext().at, N.start + LN_PACE.bossAt);
  // 再敲一次：头目提前来；第三次敲不了
  assert.equal(e.lnBell(), true);
  assert.equal(N.boss, 1);
  assert.equal(e.td.bell.early, 2);
  assert.ok(e.lnBellReason(), "no third call");
  e.td.bell.early = 2;
  assert.equal(e.lnBell(), false);
  // 稀有掉落：每提前一次多抽一次
  let asked = 0;
  const real = e.rareDraws.bind(e);
  e.rareDraws = (key, n) => ((asked = n), real(key, n));
  e.lnDraws(N, 1);
  assert.equal(asked, 1 + Math.floor(1 / 3) + 2);
});

test("the dawn report says how many the traps and towers took down", () => {
  const { e } = postStory(30);
  clock(e, FIRST, 1319.9);
  run(e, 0.2);
  const N = e.ln.night;
  const trap = put(e, "trap", 800, 500);
  const z = e.enemy("spitter", trap.x, trap.y, true);
  z.hp = 10;
  e.enemies.push(z);
  e.updateEnemy(z, 0.05);
  assert.ok(z.dead, "the spitter stepped on it");
  assert.equal(e.td.night.trap, 1);
  e._damageSource = "tower";
  const y = e.enemy("slow", 900, 500, true);
  e.enemies.push(y);
  e.hurtEnemy(y, 999, 0);
  e._damageSource = null;
  assert.equal(e.td.night.tower, 1);
  clock(e, FIRST + 1, 239.9);
  run(e, 1);
  assert.equal(e.ln.night, null);
  assert.equal(e.ln.last.day, N.day);
  const html = UI.renderCampaignView(e, { view: "lnight" });
  assert.match(html, /陷阱打倒 1 只，瞭望塔打倒 1 只/);
});

// ================= 陷阱、信标、维修点、守卫 =================
test("traps: infected with their own moves step on them too, bosses take half, raiders see through half of them", () => {
  const { e } = make();
  toAct(e, 7);
  const trap = put(e, "trap", 800, 500);
  const sp = e.enemy("spitter", 800, 500, false),
    br = e.enemy("brute", 800, 500, false);
  Object.assign(br, { boss: "brute", hp: 400, maxHp: 400 });
  e.enemies.push(sp, br);
  const h0 = sp.hp;
  e.trapCheck(sp, 0.05);
  near(h0 - sp.hp, TRAP_ALL.hit * TRAP_ALL.mult);
  e.trapCheck(sp, 0.05);
  near(h0 - sp.hp, TRAP_ALL.hit * TRAP_ALL.mult, "cooldown");
  const b0 = br.hp;
  e.trapCheck(br, 0.05);
  // 头目只吃一半（大块头背后挨打照它自己的规矩再乘）
  near(b0 - br.hp, TRAP_ALL.hit * TRAP_ALL.mult * TRAP_ALL.boss * BOSSES.brute.back);
  assert.equal(trap.hp, BUILDINGS.trap.hp - 2 * TRAP_ALL.wear);
  // 灰隼团：每人每个陷阱定一次，大约一半认出来
  let seen = 0;
  for (let i = 0; i < 200; i++) if (e.tdRoll("spot", 1000 + i, trap.id) < TRAP_ALL.spot) seen++;
  assert.ok(seen > 70 && seen < 130, "about half: " + seen);
});

test("the noise lure only pulls once you sound it: 5 power or a part as battery, for 96 game minutes; spitters walk to it as well", () => {
  const { e, toasts } = make();
  toAct(e, 7);
  const lure = put(e, "lure", 1100, 500);
  assert.equal(e.pulledLure(), null);
  assert.equal(e.lurePulling(lure), false);
  e.c.energy = 3;
  delete e.s.storage.parts;
  delete e.s.inventory.parts;
  assert.match(e.pullLureReason(lure.id), /没电/);
  e.s.storage.parts = 2;
  assert.equal(e.pullLure(lure.id), true);
  assert.equal(stock(e, "parts"), 1);
  assert.ok(toasts.some((t) => /零件 −1/.test(t.text)));
  assert.match(e.pullLureReason(lure.id), /正在响/);
  assert.ok(e.lureLeft() > 55 && e.lureLeft() <= 60);
  Object.assign(e.s.player, { x: 300, y: 300 });
  const sp = e.enemy("spitter", 1100 - 300, 500, false);
  e.enemies.push(sp);
  const d0 = Math.hypot(sp.x - lure.x, sp.y - lure.y);
  for (let i = 0; i < 40; i++) e.updateEnemy(sp, 0.05);
  assert.ok(Math.hypot(sp.x - lure.x, sp.y - lure.y) < d0 - 30, "walked toward the lure");
  e.advanceMinutes(LURE.minutes + 1);
  assert.equal(e.pulledLure(), null);
  e.c.energy = 50;
  assert.equal(e.pullLure(lure.id), true);
  assert.equal(e.c.energy, 50 - LURE.power);
});

test("the repair post only works in a fight and keeps a tally; only guards who can really take a post count, and only their towers light up", () => {
  const { e } = make();
  toAct(e, 7);
  e.s.region = "farm";
  put(e, "repairpost", 830, 560);
  const fence = put(e, "fence", 900, 560);
  fence.hp = 50;
  e.s.storage.wood = 10;
  for (let i = 0; i < 200; i++) e.updateDefense(0.05);
  assert.equal(fence.hp, 50, "no repairs in peace");
  e.s.horde.phase = "active";
  for (let i = 0; i < 200; i++) e.updateDefense(0.05);
  assert.ok(fence.hp > 50);
  assert.ok(e.td.repair.on && e.td.repair.hp > 0 && e.td.repair.wood > 0);
  e.s.horde.phase = "won";
  e.updateDefense(0.05);
  assert.equal(e.td.repair.on, false);
  assert.match(UI.buildingExtras(e, e.s.buildings.find((b) => b.type === "repairpost")), /上一场/);
  // 守卫：吃饱、有床、不太累、没闹情绪的才算
  residents(e, 3);
  for (const r of e.c.residents) r.priorities.guard = 1;
  assert.equal(e.readyGuards(), 3);
  e.c.residents[0].fed = false;
  e.c.residents[1].fatigue = 90;
  assert.equal(e.readyGuards(), 1);
  e.c.residents[2].morale = 10;
  e.td.mood[e.c.residents[2].id] = { insp: null, last: 0, strike: e.s.day };
  assert.equal(e.readyGuards(), 0);
  // 塔顶的灯：上岗的守卫守前几座塔
  e.c.residents[0].fed = true;
  e.c.residents[0].workRole = "guard";
  e.s.minute = 600;
  const t1 = put(e, "tower", 640, 600),
    t2 = put(e, "tower", 1040, 600);
  const lit = e.mannedTowers();
  assert.equal(lit.has(t1.id), true);
  assert.equal(lit.has(t2.id), false);
  assert.match(UI.buildingExtras(e, t2), /没人守/);
});

test("repair kits: fix the worst defence nearby, or the one whose page you opened; outside they mend your melee weapon by 40%", () => {
  const { e } = make();
  e.s.region = "farm";
  Object.assign(e.s.player, { x: 830, y: 480 });
  const f1 = put(e, "fence", 900, 480),
    f2 = put(e, "trap", 950, 480);
  f1.hp = 100;
  f2.hp = 10;
  assert.match(e.useItemReason("repairKit"), /没有修理包/);
  e.s.storage.repairKit = 2;
  assert.equal(e.useItem("repairKit"), true);
  assert.equal(f2.hp, BUILDINGS.trap.hp, "the worst one");
  assert.equal(e.useKitOn(f1.id), true);
  assert.equal(f1.hp, BUILDINGS.fence.hp);
  assert.equal(stock(e, "repairKit"), 0);
  assert.match(e.kitReason(f1), /不用修/);
  assert.equal(e.td.kits, 2);
});

// ================= 贺满仓、机床、运输骡 =================
test("贺满仓: each installment is due three days apart; late ones cost a tenth more a day up to three tenths, and he will not advance again for a week after", () => {
  const { e } = make();
  toAct(e, 8);
  e.fr.hemc.phase = "open";
  e.s.day = 20;
  e.fr.hemc.debt = { type: "solar", total: { parts: 6 }, paid: {}, day: 20 };
  assert.deepEqual(e.hemcDue(), { k: 1, due: 23, late: 0, extra: 0 });
  assert.deepEqual(e.installment(), { parts: 2 });
  e.s.storage.parts = 30;
  e.s.day = 25;
  assert.deepEqual(e.hemcDue(), { k: 1, due: 23, late: 2, extra: 0.2 });
  assert.deepEqual(e.installment(), { parts: 3 });
  assert.equal(e.repay(), true);
  assert.equal(e.fr.hemc.debt.paid.parts, 2, "the surcharge does not count as principal");
  e.s.day = 40;
  assert.equal(e.hemcDue().extra, HEMC.cap);
  assert.equal(e.repay(), true);
  assert.equal(e.repay(), true);
  assert.equal(e.fr.hemc.debt, null);
  assert.equal(e.td.hemc.refuseUntil, 40 + HEMC.refuse);
  assert.match(e.advanceReason("solar"), /不再垫付/);
});

test("the lathe: a rush makes one more batch tonight, a jam rests it the next day; ammo is gone from the menu, repair kits are in", () => {
  const { e } = make();
  toAct(e, 7);
  e.s.region = "farm";
  assert.equal(e.setLatheMode("ammo"), false);
  assert.equal(e.setLatheMode("repair"), true);
  Object.assign(e.s.storage, { scrap: 30, wood: 30 });
  e.tdRoll = (kind) => (kind === "jam" ? 0 : 1);
  clock(e, 9, 600);
  assert.equal(e.latheRush(), true);
  assert.match(e.latheRushReason(), /加过急/);
  const k0 = stock(e, "repairKit");
  clock(e, 9, 1079);
  e.advanceMinutes(2);
  assert.equal(stock(e, "repairKit") - k0, e.latheSlots() + 1);
  assert.equal(e.td.lathe.jam, 10);
  const k1 = stock(e, "repairKit");
  clock(e, 10, 1079);
  e.advanceMinutes(2);
  assert.equal(stock(e, "repairKit"), k1, "jammed for a day");
  assert.match(UI.renderCampaignView(e, { view: "lathe" }), /今晚加急/);
  assert.doesNotMatch(UI.renderCampaignView(e, { view: "lathe" }), /优先弹药/);
});

test("the mule: a new load brings one cart of goods back; old loads keep the effects they had", () => {
  const { e, toasts } = make();
  toAct(e, 6);
  e.o.cargo = "repair";
  e.o.convoy = { departs: 0, arrives: 0, escorted: true, spawned: true, foes: [], done: false, lost: false };
  e.td.cargoNew = true;
  const p0 = stock(e, "parts");
  assert.ok(e.arriveConvoy());
  assert.equal(stock(e, "parts") - p0, CARGO_RETURN.repair.parts);
  assert.ok(toasts.some((t) => /回程捎回/.test(t.text)));
  e.arriveConvoy();
  assert.equal(stock(e, "parts") - p0, CARGO_RETURN.repair.parts, "only once");
  // 新装的车：长期的修理折扣不再有
  e.s.region = "farm";
  const f = put(e, "fence", 900, 480);
  f.hp = 10;
  e.s.storage.wood = 5;
  e.repair(f.id);
  assert.ok(f.hp < BUILDINGS.fence.hp || stock(e, "wood") !== 4, "not the old one-wood full repair");
  // 旧档的车：照旧
  e.td.cargoNew = false;
  f.hp = 10;
  e.s.storage.wood = 5;
  e.repair(f.id);
  assert.equal(f.hp, BUILDINGS.fence.hp);
});

// ================= 借宿、带徒 =================
test("a lodger nobody answered by 23:00 is put up under the open-gate decree, otherwise politely sent on", () => {
  const { e } = make();
  toAct(e, 7);
  residents(e, 1);
  e.s.storage.bread = 10;
  const ask = () => (e.ss.lodger = { name: "过路人", look: 0, gift: "item", stay: false, phase: "asking", day: e.s.day, qin: false });
  ask();
  e.w.decrees = ["openGate"];
  clock(e, 9, 1379);
  e.advanceMinutes(2);
  assert.equal(e.ss.lodger?.phase, "staying");
  e.ss.lodger = null;
  ask();
  e.w.decrees = [];
  clock(e, 10, 1379);
  e.advanceMinutes(2);
  assert.equal(e.ss.lodger, null);
  assert.ok(e.o.log.some((l) => /另找地方/.test(l.text)));
});

test("retraining on the crew card: someone who does the job teaches for three days, then the crew member changes role", () => {
  const { e } = make();
  toAct(e, 7);
  residents(e, 3);
  e.o.crew.push({ id: "c-test", name: "小柳", role: "carry", trait: "handy", look: 0, status: "", task: "idle", moved: 0, fedDay: 0, x: 900, y: 600, target: null });
  assert.match(e.retrainReason("c-test", "carry"), /本来就是/);
  assert.match(e.retrainReason("tieqiao-x", "build"), /只有援建队员/);
  assert.equal(e.retrainMasters("build")[0].id, "mechanic");
  assert.equal(e.startRetrain("c-test", "build"), true);
  assert.match(e.retrainReason("c-test", "guard"), /已经有人在带/);
  assert.match(e.apprenticeReason("farmer", "c-test"), /已经有人在带/);
  const eff = e.efficiency();
  e.td.retrain.start = e.s.day;
  for (let d = 1; d <= RETRAIN.days; d++) {
    clock(e, e.s.day + 1, 359);
    e.advanceMinutes(2);
  }
  const c = e.o.crew.find((x) => x.id === "c-test");
  assert.equal(c.role, "build");
  assert.equal(e.td.retrain, null);
  assert.ok(e.efficiency() > eff);
  assert.match(UI.renderCampaignView(e, { view: "crew", id: "c-test" }), /改做/);
});

// ================= 界面：设施卡、警报栏、居民卡、法令 =================
test("every facility page says what it does in plain words, and its buttons are real", () => {
  const { e } = make();
  toAct(e, 7);
  e.s.region = "farm";
  residents(e, 2);
  for (const type of [...CARD_TYPES, "trap", "fence", "gate"]) {
    const b = put(e, type, 900, 600);
    if (["trap", "fence", "gate", "tower", "lure", "repairpost"].includes(type)) b.hp = 1;
    const html = UI.buildingExtras(e, b);
    assert.ok(html.length > 40, type + " has a card");
    assert.doesNotMatch(html, DEV, type);
    if (["trap", "fence", "gate", "tower", "lure", "repairpost"].includes(type)) assert.match(html, /data-action="tdKit"/, type + " kit button");
  }
  const lure = e.s.buildings.find((b) => b.type === "lure");
  assert.match(UI.buildingExtras(e, lure), /data-action="tdLure"/);
  // 按 E 打开自己那一页
  const events = [];
  const emit = e.emit.bind(e);
  e.emit = (name, data) => (events.push({ name, data }), emit(name, data));
  const solar = e.s.buildings.find((b) => b.type === "solar");
  Object.assign(e.s.player, { x: solar.x, y: solar.y + 30 });
  e.s.buildings = e.s.buildings.filter((b) => b === solar || Math.hypot(b.x - solar.x, b.y - solar.y) > 120);
  e.interact();
  assert.ok(events.some((ev) => ev.name === "menu" && ev.data.menu === "building" && ev.data.buildingId === solar.id));
  assert.match(e.buildingContext(solar), /看看情况/);
  // 按钮：拉信标、修理包
  e.c.energy = 50;
  const lure2 = put(e, "lure", 1200, 500);
  assert.equal(UI.handleCampaignAction("tdLure", { dataset: { id: lure2.id } }, ctx(e)), true);
  assert.ok(e.pulledLure());
  e.s.storage.repairKit = 1;
  const t = put(e, "trap", 1250, 700);
  t.hp = 5;
  Object.assign(e.s.player, { x: t.x, y: t.y });
  UI.handleCampaignAction("tdKit", { dataset: { id: t.id } }, ctx(e));
  assert.equal(t.hp, BUILDINGS.trap.hp);
});

test("the residents' cards say why they are happy or not and what their inspiration looks like once they trust you", () => {
  const { e } = make();
  toAct(e, 7);
  residents(e, 3);
  const r = e.resident("farmer");
  r.morale = 20;
  e.w.decrees = ["ration"];
  assert.ok(RESIDENT_HOOKS.length >= 1);
  let html = residentExtras(e, r);
  assert.match(html, /心情 低落/);
  assert.match(html, /配给卡/);
  assert.match(html, /信任到 3/);
  e.ss.trust.farmer = 3;
  html = residentExtras(e, r);
  assert.match(html, /好手气/);
  assert.doesNotMatch(html, DEV);
});

test("the alert bar shows the festival, the canteen, a lodger, the campfire, the caravan, a due payment and the bell", () => {
  const { e } = make();
  toAct(e, 8);
  residents(e, 2);
  e.s.region = "farm";
  e.ss.lodger = { name: "过路人", look: 0, gift: "item", stay: false, phase: "asking", day: e.s.day, qin: false };
  const html = UI.campaignHud(e).alerts;
  assert.match(html, /想借宿/);
  e.ss.lodger = null;
  e.s.day = 20;
  e.fr.hemc.debt = { type: "solar", total: { parts: 6 }, paid: {}, day: 15 };
  assert.match(UI.campaignHud(e).alerts, /逾期/);
  e.fr.hemc.debt = null;
  e.s.storage.bread = 40;
  e.s.day = 14;
  e.s.minute = 600;
  assert.ok(e.isFestivalDay());
  assert.match(UI.campaignHud(e).alerts, /今天节庆 · 16:00 开始/);
  e.s.minute = 19 * 60 + 30;
  e.ss.fest.held = [14];
  assert.equal(e.talkReason(), "");
  assert.match(UI.campaignHud(e).alerts, /营火边有 \d+ 个人/);
  e.s.day = 16;
  e.s.minute = 600;
  e.ss.he.stage = 4;
  assert.match(UI.campaignHud(e).alerts, /今晚食堂营业/);
  e.o.caravan.until = e.abs() + 300;
  e.o.caravan.offers = [{ id: "x" }];
  assert.match(UI.campaignHud(e).alerts.replace(/<[^>]+>/g, " "), /唐九的商队在营地|今晚食堂营业/);
});

test("decrees say whose mood they cost; the ladder says which step is missing", () => {
  const { e } = make();
  toAct(e, 7);
  residents(e, 3);
  const html = UI.renderCampaignView(e, { view: "decrees" });
  assert.match(html, /让谁不高兴：阿禾、许医生、陈工，心情 −10/);
  assert.match(html, /让谁不高兴：阿禾、陈工，心情 −3（许医生不受影响）/);
  assert.match(html, /差「/);
  assert.doesNotMatch(html, DEV);
});

test("the shipping box lists and takes down through its buttons", () => {
  const { e } = make();
  e.s.region = "farm";
  e.s.storage.potato = 9;
  const root = { querySelector: (sel) => (sel === "#td-list-item" ? { value: "potato" } : sel === "#td-list-qty" ? { value: "4" } : null) };
  const el = { dataset: { id: "" }, closest: () => root };
  assert.equal(UI.handleCampaignAction("tdList", el, ctx(e)), true);
  assert.deepEqual(e.td.listing.map((l) => [l.item, l.qty]), [["potato", 4]]);
  UI.handleCampaignAction("tdUnlist", { dataset: { id: e.td.listing[0].id } }, ctx(e));
  assert.equal(e.td.listing.length, 0);
  assert.equal(stock(e, "potato"), 9);
});

// ================= 存档 =================
test("saves: the tidy field round-trips and broken data is refused", () => {
  const { e } = make();
  e.s.storage.potato = 5;
  e.s.region = "farm";
  e.listItem("potato", 3);
  e.td.mood.farmer = { insp: { day: 3, kind: "farmer" }, last: 3, strike: 0 };
  const back = Engine.parse(e.serialize());
  assert.deepEqual(back.tidy.listing, e.td.listing);
  assert.deepEqual(back.tidy.mood, e.td.mood);
  for (const bad of [(t) => (t.listing[0].qty = 999), (t) => (t.mood.farmer.insp.kind = "wizard"), (t) => (t.bell.early = 9), (t) => (t.hemc.since = -1), (t) => (t.lure.until = "soon")]) {
    const raw = JSON.parse(e.serialize());
    bad(raw.tidy);
    assert.throws(() => Engine.parse(JSON.stringify(raw)), /营地整顿记录损坏（.+），请从设置恢复有效备份；原存档会保留/);
  }
});
