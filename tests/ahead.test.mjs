// v0.46.0「有奔头」：钱的去处（复兴工程：第二年起每个时节开一处，收复以后开第二期）、手记最上面的“眼下”、
// 奖励随进度放大、少弹几条提示。依据：《余烬农场 v0.44 试玩报告》第二、三部分。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Engine, freshState, newGameState, needsStoryMigration } from "../dist/campaign.js";
import { Engine as AheadEngine, aheadQuiet, aheadDefaults } from "../dist/ahead.js";
import { Engine as HandyEngine } from "../dist/handy.js";
import * as UI from "../dist/campaign-ui.js";
import { aheadPage, aheadJournal, aheadHud, aheadMap, handleAheadAction } from "../dist/ahead-ui.js";
import { PROJECTS, PROJECT_BY_ID, BATCH1, BATCH2, START, OUTSIDE, KID_LETTERS, NOW, QUIET, PAGE, FARM_SPOTS, CRATE } from "../dist/ahead-data.js";
import { ITEMS, CROPS } from "../dist/data.js";
import { decorItem, CROP_SEASON, seasonOf } from "../dist/almanac-data.js";
import { GAME_VERSION, GAME_EDITION, GAME_RELEASE } from "../dist/version.js";
import { Renderer as AheadRenderer } from "../dist/ahead-renderer.js";
import { Renderer as HandyRenderer } from "../dist/handy-renderer.js";
import { Renderer as CampaignRenderer } from "../dist/campaign-renderer.js";
import { DRAW as ICON_DRAW } from "../dist/item-sprites.js";
import { DECOR_DRAW } from "../dist/almanac-data.js";
import { DISTRICTS } from "../dist/district-data.js";
import { BMAPS } from "../dist/beyond-data.js";

const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|Joja|祝尼魔|星之果实|\[object Object\]/;
const make = (state = freshState(), said = []) => {
  const e = new Engine(state, (t) => said.push(t));
  e.paused = false;
  if (e.dy) e.dy.pending = null;
  return e;
};
// 第二年、主线打完了（联盟来信那一段段都领完了）、地区都修通了、钱和材料够
function late(day = START.day, said = []) {
  const e = make(newGameState("farmer"), said);
  e.s.day = day;
  e.s.minute = 5 * 60;
  e.s.region = "farm";
  e.storyGoal = () => null;
  // 五个地区修通、五张边境的图开了（各记在各的地方）
  for (const p of PROJECTS) if (DISTRICTS[p.place]) e.d.unlocked[p.place] = true;
  else if (BMAPS[p.place]) e.b.unlocked[p.place] = true;
  e.ahEnsure();
  return e;
}
const rich = (e) => {
  e.s.money = 500000;
  for (const k of ["wood", "stone", "scrap", "parts", "cloth", "herb"]) e.s.storage[k] = 999;
  return e;
};
// 出钱、第二天 06:00 完工
function build(e, ...ids) {
  rich(e);
  for (const id of ids) {
    if (!e.ah.opened[id]) e.ah.opened[id] = e.s.day;
    assert.equal(e.ahReason(id), "", id);
    assert.ok(e.ahFund(id), id);
  }
  e.s.day += 1;
  e.s.minute = 6 * 60;
  e.ahFinish();
  for (const id of ids) assert.ok(e.ahDone(id), id + " done");
  return e;
}
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const btn = (action, id = "") => ({ dataset: { action, id } });

// ================= 版本、层 =================
test("version: v0.46.0 有奔头 in the title, the loading page and settings; the new files are preloaded; the engine and the scene each got a layer on top", () => {
  assert.equal(GAME_VERSION, "v0.46.0");
  assert.equal(GAME_EDITION, "有奔头");
  assert.equal(GAME_RELEASE, "v0.46.0 · 有奔头");
  const html = read("dist/index.html");
  assert.match(html, /<title>余烬农场 v0\.46\.0 · 有奔头<\/title>/);
  assert.match(html, /data-release>v0\.46\.0 · 有奔头</);
  for (const f of ["ahead.js", "ahead-data.js", "ahead-ui.js", "ahead-renderer.js"]) assert.ok(html.includes('<link rel="modulepreload" href="' + f + '">'), f + " preloaded");
  assert.equal(Engine, AheadEngine);
  assert.equal(Object.getPrototypeOf(AheadEngine), HandyEngine);
  assert.equal(CampaignRenderer, AheadRenderer);
  assert.equal(Object.getPrototypeOf(AheadRenderer), HandyRenderer);
});

// ================= 复兴工程：每个时节开一处 =================
test("projects: none before the second year; from day 29 one opens on each season's first day, in order, skipping places you can't reach yet", () => {
  assert.equal(BATCH1.length, 12);
  assert.equal(BATCH2.length, 6);
  for (const p of PROJECTS) {
    assert.ok(p.cost.gold >= 3000, p.id + " is worth saving for");
    assert.ok(p.text && p.letter && p.who && p.keep?.name, p.id);
    assert.doesNotMatch(p.text + p.letter + p.name, DEV);
  }
  // 第一期从 3,000 到 10,000，第二期 13,000 起
  assert.deepEqual([Math.min(...BATCH1.map((id) => PROJECT_BY_ID[id].cost.gold)), Math.max(...BATCH1.map((id) => PROJECT_BY_ID[id].cost.gold))], [3000, 10000]);
  assert.ok(BATCH2.every((id) => PROJECT_BY_ID[id].cost.gold >= 13000));
  const e = make();
  e.s.day = 28;
  assert.deepEqual(e.ahEnsure(), []);
  e.s.day = 29;
  // 溪谷还没修通：先开去得了的（旧医院的药房），溪谷那一处等修通了再开
  assert.deepEqual(e.ahEnsure(), ["pharmacy"]);
  e.s.day = 35;
  assert.deepEqual(e.ahEnsure(), []);
  e.d.unlocked.valley = true;
  e.s.day = 36;
  assert.deepEqual(e.ahEnsure(), ["waterwheel"]);
  // 一个时节只开一处
  assert.deepEqual(e.ahEnsure(), []);
  const f = late(29);
  assert.deepEqual(Object.keys(f.ah.opened), ["waterwheel"]);
  f.s.day = 43;
  f.ahEnsure();
  assert.deepEqual(Object.keys(f.ah.opened), ["waterwheel", "teahouse", "bath"]);
  // 旧档读进来已经是第 200 天：第一期一下子都开了，第二期等收复
  const g = late(200);
  assert.equal(BATCH1.filter((id) => g.ah.opened[id]).length, 12);
  assert.equal(BATCH2.filter((id) => g.ah.opened[id]).length, 0);
});
test("the second batch opens on the day the region is liberated (the 10th long night held), then one more every 7 days", () => {
  const e = late(100);
  assert.equal(BATCH2.filter((id) => e.ah.opened[id]).length, 0);
  e.ln.ended = true;
  e.ln.endDay = 100;
  assert.deepEqual(e.ahEnsure(), ["train"]);
  // 第 106 天是时节头一天：第一期最后一处（钟楼）照常开
  e.s.day = 106;
  assert.deepEqual(e.ahEnsure(), ["bell"]);
  e.s.day = 107;
  assert.deepEqual(e.ahEnsure(), ["school"]);
  e.s.day = 200;
  e.ahEnsure();
  assert.equal(BATCH2.filter((id) => e.ah.opened[id]).length, 6);
});

// ================= 出钱、第二天完工 =================
test("funding: on the farm, with the gold and materials; it's done at 06:00 the next morning with a letter card and a keepsake in the store", () => {
  const e = late(29);
  assert.equal(e.ahReason("teahouse"), "还没开");
  e.s.money = 1000;
  assert.match(e.ahReason("waterwheel"), /金币不够/);
  e.s.region = "residential";
  rich(e);
  assert.equal(e.ahReason("waterwheel"), "回到农场再办");
  assert.equal(e.ahFund("waterwheel"), false);
  e.s.region = "farm";
  const money = e.s.money,
    wood = e.qty("wood", true);
  assert.ok(e.ahFund("waterwheel"));
  assert.equal(e.s.money, money - 3000);
  assert.equal(e.qty("wood", true), wood - 20);
  assert.ok(e.ahBuilding("waterwheel"));
  assert.equal(e.ahReason("waterwheel"), "工人正在修，明早完工");
  // 当天不完工
  e.s.minute = 23 * 60;
  e.ahFinish();
  assert.equal(e.ahDone("waterwheel"), false);
  e.events.length = 0;
  e.s.day = 30;
  e.s.minute = 6 * 60;
  e.workHour();
  assert.equal(e.ah.done.waterwheel, 30);
  const m = e.events.find((x) => x.type === "moment" && x.kind === "ahead");
  assert.ok(m, "a big card");
  assert.match(m.title, /水车修好了/);
  assert.ok(m.lines.some((l) => l.includes(PROJECT_BY_ID.waterwheel.letter)), "the letter is on the card");
  assert.equal(e.qty(decorItem("ahWheelModel"), true), 1);
  assert.ok(e.decorOwned().includes("ahWheelModel"), "the keepsake can be put out with the other ornaments");
  assert.equal(e.ahReason("waterwheel"), "已经修好了");
});

// ================= 修好的地方给的方便 =================
test("what the places give: more fields watered, camp morale, longer rest, shorter roads (home by half with the bell), quicker bites, a three-day forecast", () => {
  const e = late(29);
  const water = e.trAutoCount(),
    rest = e.trRestMinutes(),
    road = e.travelBonus(100, "residential"),
    home = e.travelBonus(100, "farm");
  build(e, "waterwheel", "teahouse", "bath", "handcar", "boat", "windtower", "bell");
  assert.equal(e.trAutoCount(), water + 8);
  assert.ok(e.moodFactors().some((f) => f.key === "ah_teahouse" && f.v === 2));
  assert.equal(e.trRestMinutes(), rest + 60);
  assert.equal(e.travelBonus(100, "residential"), Math.max(1, Math.ceil(road * 0.85)));
  assert.equal(e.travelBonus(100, "farm"), Math.max(1, Math.ceil(home * 0.85 * 0.5)));
  assert.equal(e.travelBonus(100, "tunnel"), e.travelBonus(100, "tunnel"), "the tunnel isn't shortened");
  e.c.fishing = { biteAt: 10 };
  e.hpBite("pond");
  assert.equal(e.c.fishing.biteAt, 8);
  e.c.fishing = null;
  const fc = e.forecast();
  assert.ok(fc.some((d) => d.day === e.s.day + 3), "three days ahead");
  assert.ok(e.morningParts(e.s.day).some((p) => p.startsWith("测风塔：后天")));
});
test("deliveries: the forest lodge every morning; three days after it's done the first batch, then on a season's first day each place's specialty, cloth and bandages, medicine, in-season seeds, a sea crate, a thing from outside, a children's letter, a relic clue", () => {
  const e = late(29);
  build(e, "lodge", "sewing", "pharmacy", "greenhouse", "workshop", "teahouse");
  // 第 30 天：每天的照送，特产等时节头一天
  const wood = e.s.storage.wood;
  assert.equal(e.ah.lastDay, 0);
  e.ahSend();
  assert.equal(e.s.storage.wood, wood + 6);
  assert.equal(e.qty("ahOsmanthus", true), 0);
  // 同一天不送两回
  e.ahSend();
  assert.equal(e.s.storage.wood, wood + 6);
  e.s.day = 36;
  e.s.minute = 6 * 60;
  const cloth = e.s.storage.cloth,
    clues = e.hp.clues.length;
  e.ahSend();
  assert.equal(e.qty("ahOsmanthus", true), 3);
  assert.equal(e.qty("ahPineNut", true), 3);
  assert.equal(e.s.storage.cloth, cloth + 6);
  assert.ok(e.qty("bandage", true) >= 3);
  assert.ok(e.qty("medkit", true) >= 2);
  const season = seasonOf(36).id;
  const crop = Object.keys(CROP_SEASON).find((c) => CROP_SEASON[c][0] === season && CROPS[c]?.seed);
  assert.ok(e.qty(CROPS[crop].seed, true) >= 3, "in-season seeds");
  assert.equal(e.hp.clues.length, clues + 1, "a relic clue");
  assert.ok(e.o.log.some((l) => l.text.startsWith("复兴工程送来：")), "one line in the message log, not a toast");
  // 第二期：火车、学校、灯塔
  e.ln.ended = true;
  e.ln.endDay = 36;
  e.ahEnsure();
  build(e, "train", "school", "lighthouse");
  e.s.day = 43;
  e.ahSend();
  assert.equal(e.qty(OUTSIDE[0].id, true), 1);
  assert.equal(e.ah.kids.length, 1);
  assert.ok(e.qty(CRATE.fish[Math.floor((43 - 1) / 7) % CRATE.fish.length], true) >= CRATE.n);
  // 修好三天后的早上先送来头一批，以后每个时节头一天再送
  const f = late(29);
  build(f, "teahouse", "boat");
  f.s.day = 32;
  f.ahSend();
  assert.equal(f.qty("ahOsmanthus", true), 0);
  f.s.day = 33;
  f.ahSend();
  assert.deepEqual([f.qty("ahOsmanthus", true), f.qty("ahDriedFish", true)], [3, 2], "the first batch three days on");
  f.ahSend();
  f.s.day = 34;
  f.ahSend();
  assert.equal(f.qty("ahOsmanthus", true), 3, "once");
  f.s.day = 36;
  f.ahSend();
  assert.equal(f.qty("ahOsmanthus", true), 6, "then on each season's first day");
  // 三天后正好是时节头一天：只送一回
  const g = late(29);
  g.s.day = 32;
  build(g, "teahouse");
  g.s.day = 36;
  g.ahSend();
  assert.equal(g.qty("ahOsmanthus", true), 3);
});

// ================= 眼下 =================
test("the journal: once the story is over, the top card is the one thing most worth doing now; the old home-plan chapter folds below; the bottom-left goal follows it", () => {
  const e = late(29);
  // 主线还没打完：照旧
  const f = make();
  assert.equal(f.ahNow(), null);
  assert.equal(aheadHud(f), null);
  // 这个时节开的那一处办得起
  rich(e);
  let n = e.ahNow();
  assert.equal(n.kind, "project");
  assert.equal(n.title, NOW.project.title(PROJECT_BY_ID.waterwheel));
  assert.match(n.cost, /3,000 金币/);
  let html = UI.renderCampaignJournal(e, {});
  assert.match(html, /class="journal-main story-card ah-now"/);
  assert.match(html, /<span class="journal-eyebrow">眼下<\/span><h2>复兴工程 · 水车<\/h2>/);
  assert.match(html, /data-action="oView" data-id="ahead"/);
  // 老的家园计划折在下面
  assert.match(html, /<details class="journal-extra ah-old"><summary>家园计划（老章节）/);
  assert.equal((html.match(/class="journal-main/g) || []).length, 1, "one card on top");
  assert.deepEqual(aheadHud(e), { number: "眼下", body: "复兴工程 · 水车" });
  assert.equal(e.guidedGoal().title, "复兴工程 · 水车");
  // 钱不够：攒钱
  e.s.money = 100;
  n = e.ahNow();
  assert.equal(n.kind, "save");
  assert.match(n.cost, /金币不够/);
  // 今晚长夜：先说长夜
  e.ln.storyDay = 20;
  const pend = e.lnPending;
  e.lnPending = () => true;
  n = e.ahNow();
  assert.equal(n.kind, "night");
  e.lnPending = pend;
  // 今晚最后一夜（扑火）：先说它
  const fin = e.tg.final,
    open = e.titanOpen;
  e.tg.final = { ...(fin || {}), day: e.s.day, won: false, on: false };
  e.titanOpen = (id) => id === "moth" || open.call(e, id);
  n = e.ahNow();
  assert.equal(n.kind, "final");
  assert.equal(n.title, "今晚 22:00 最后一夜");
  assert.equal(n.go.action, "oDefense");
  e.tg.final = fin;
  e.titanOpen = open;
  // 出了钱：明早完工
  rich(e);
  e.ahFund("waterwheel");
  n = e.ahNow();
  assert.ok(["building", "rest", "week"].includes(n.kind), n.kind);
  // 跟着一件委托时照旧
  e.guidance.focus = "cooking";
  assert.equal(aheadHud(e), null);
  e.guidance.focus = null;
});
test("the journal keeps the letters: each finished place's letter and the children's letters, newest first", () => {
  const e = late(29);
  build(e, "waterwheel", "teahouse");
  const html = UI.renderCampaignJournal(e, {});
  assert.match(html, /<details class="journal-extra ah-letters"><summary>复兴工程的来信 · 2 封<\/summary>/);
  assert.ok(html.includes(PROJECT_BY_ID.teahouse.letter));
  assert.doesNotMatch(html, DEV);
});

// ================= 页面 =================
test("the projects page: what's open and what it costs, what you get when it's done, the one being built, the next one and when, the second batch waits for liberation", () => {
  const e = late(36);
  rich(e);
  e.ahFund("waterwheel");
  const html = aheadPage(e);
  assert.match(html, /<div class="outpost-page view-ahead">/);
  assert.match(html, /旧站商街 · 老茶馆 <small>3,500 金币、木材 20、布料 4<\/small>/);
  assert.match(html, /data-action="ahFund" data-id="teahouse" class="primary">出钱办（3,500 金）/);
  assert.match(html, /溪谷试验田 · 水车 <small>工人进场了，明早 6 点完工<\/small>/);
  assert.match(html, /下一处第 43 天开：雨巷住区的公共澡堂/);
  assert.match(html, /第二期 · 把余烬地区接回外面/);
  assert.ok(html.includes(PAGE.wait2));
  assert.doesNotMatch(html, DEV);
  assert.equal(UI.campaignTitle({ view: "ahead" }), "复兴工程");
  assert.equal(UI.renderCampaignView(e, { view: "ahead" }), html);
  // 不在农场：按钮灰着、写着为什么
  e.s.region = "valley";
  assert.match(aheadPage(e), /disabled title="回到农场再办"/);
  // 出钱的按钮
  e.s.region = "farm";
  let saved = 0;
  assert.ok(handleAheadAction("ahFund", btn("ahFund", "teahouse"), ctx(e, { save: () => saved++ })));
  assert.equal(saved, 1);
  assert.ok(e.ahBuilding("teahouse"));
  // 重建站那一页最上面有一行
  const st = UI.renderCampaignView(e, { view: "rlStation" });
  if (st.includes("</header>")) assert.match(st, /<section class="far-strip ah-strip">/);
});
test("the world map hangs a small sign on each place that's been rebuilt; the top alert says when this season's project is affordable and opens the page", () => {
  const e = late(29);
  const svg = '<div class="atlas"><svg></svg></div>';
  assert.equal(aheadMap(e, {}, svg), svg);
  build(e, "waterwheel");
  const out = aheadMap(e, {}, svg);
  assert.match(out, /<span class="far-pin ah-pin"[^>]*>水车 ✓<\/span>/);
  assert.equal(aheadMap(e, { tab: "local" }, svg), svg);
  e.s.day = 36;
  e.ahEnsure();
  rich(e);
  const hud = UI.campaignHud(e);
  assert.match(hud.alerts, /复兴工程 · 老茶馆（3,500 金）办得起了/);
  let opened = null;
  const idx = (hud.alerts.match(/data-id="(\d+)"[^>]*>复兴工程/) || [])[1];
  assert.ok(handleAheadAction("wAlert", btn("wAlert", idx), ctx(e, { showMenu: (m, o) => (opened = [m, o.view]) })));
  assert.deepEqual(opened, ["outpost", "ahead"]);
});

// ================= 奖励随进度 =================
test("rewards grow with progress: after the story each long night held adds 0.2 to the daily choice (up to 4x, the saved tier stays 1/1.5/2, the card shows the real one); the week's list, the season boss and a rescued survivor pay more gold", () => {
  const e = late(60);
  e.sc.act = 8;
  assert.equal(e.tier(), 2);
  assert.equal(e.ahTier(), 2);
  e.ln.storyDay = 30;
  e.ln.held = 5;
  // 存档里那一档照旧是 2（每日抉择的存档只认 1 / 1.5 / 2），算数的时候乘上
  assert.equal(e.tier(), 2);
  assert.equal(e.ahTier(), 3);
  assert.equal(e.scaleN(100, 2), 300);
  assert.deepEqual(e.scaleB({ wood: 10 }, 2), { wood: 30 });
  e.ln.held = 24;
  assert.equal(e.ahTier(), 4);
  // 主线前几段照旧
  assert.equal(e.ahTier(1.5), 1.5);
  assert.equal(e.scaleN(10, 1.5), 15);
  assert.equal(e.ahGoldMult(), 3);
  const m = e.s.money;
  assert.equal(e.ahBonusGold(300, "这周的清单"), 600);
  assert.equal(e.s.money, m + 600);
  assert.ok(e.o.log.some((l) => /守住了 10 个长夜，多给 600 金币/.test(l.text)));
  e.ln.held = 0;
  assert.equal(e.ahBonusGold(300, "x"), 0);
  // 今日抉择卡上写的倍数跟着变（存档里照旧是 2）
  const c = late(61);
  c.sc.act = 8;
  c.ln.storyDay = 30;
  c.ln.held = 3;
  c.s.minute = 7 * 60;
  assert.ok(c.dailyGenerate(61));
  assert.equal(c.dy.pending.tier, 2);
  const card = UI.renderCampaignView(c, { view: "daily" });
  assert.match(card, /奖励 ×2\.6</);
  assert.doesNotMatch(card, /奖励 ×2</);
});

// ================= 少弹几条提示 =================
test("fewer pop-ups: the same everyday lines go to the message log (some float over your head); crows and the missing rations still pop up the first three times; warnings stay", () => {
  const said = [];
  const e = late(40, said);
  const n0 = said.length;
  e.toast("睡得好：「休息好」4 个钟点——体力恢复快五成，经验多一成。", "gold");
  e.toast("明天的险地：旧医院 · 浓雾。风险：雾里看不清。", "normal");
  e.toast("今天下午的事 · 货郎：营门口来了货郎。", "normal");
  assert.equal(said.length, n0, "none popped up");
  assert.ok(e.o.log.some((l) => l.text.startsWith("明天的险地")), "still in the log");
  // 隔一会儿再来一回（同一句话 45 秒里又来只在头顶飘，那是另一回事）
  for (let i = 0; i < 5; i++) {
    e.s.playSeconds = (e.s.playSeconds || 0) + 100;
    e.toast("乌鸦啄了 2 块熟了的菜（每块少收 1 份）。熟了早点收，或者立个稻草人。", "warn");
  }
  assert.equal(said.length - n0, 3, "the first three times");
  assert.equal(e.ah.said.crow, 3);
  e.toast("饿醒了：先吃点东西再干活。", "warn");
  e.toast("电台：明天有尸潮（全文在任务手记）", "warn");
  assert.equal(said.length - n0, 5, "warnings stay");
  assert.equal(aheadQuiet("尸潮来了 · 守住家园！", "warn"), null);
  for (const q of QUIET) assert.ok(q.id && q.re instanceof RegExp);
});

// ================= 存档 =================
test("saves: a new game has the block (a card when the first project opens); an old save gets it with a checkpoint first (the card at once if it is already in the second year); a bad block is refused; a round trip keeps everything", () => {
  const e = make(newGameState("farmer"));
  assert.deepEqual(Object.keys(e.ah).sort(), Object.keys(aheadDefaults()).sort());
  assert.equal(e.ah.intro, undefined);
  const old = JSON.parse(make(newGameState("farmer")).serialize());
  delete old.ahead;
  assert.equal(needsStoryMigration(JSON.stringify(old)), true);
  assert.equal(needsStoryMigration(make(newGameState("farmer")).serialize()), false);
  // 第二年以前的旧档读进来不弹（和新开的档一样，等头一处开了再说）
  assert.equal(make(Engine.parse(JSON.stringify(old))).ah.intro, undefined);
  old.day = 40;
  const o = make(Engine.parse(JSON.stringify(old)));
  assert.equal(o.ah.intro.told, false);
  o.update(0.05, {});
  assert.equal(o.ah.intro.told, true);
  const card = o.events.find((x) => x.type === "moment" && x.title === "复兴工程");
  assert.ok(card && card.kind === "ahead", "the card is named after the thing, not the version");
  // 新开的档：第 29 天早上头一处开了，弹一回
  const n = late(29);
  assert.equal(n.ah.intro, undefined);
  n.s.minute = 6 * 60;
  n.workHour();
  assert.equal(n.ah.intro.told, false);
  n.update(0.05, {});
  assert.equal(n.events.filter((x) => x.type === "moment" && x.title === "复兴工程").length, 1);
  n.s.minute = 7 * 60;
  n.workHour();
  n.update(0.05, {});
  assert.equal(n.events.filter((x) => x.type === "moment" && x.title === "复兴工程").length, 1, "only once");
  // 一帧一帧走到 06:00（分钟一小截一小截加，到整点差一丝）：照样是 6 点完工，不是 7 点
  const r = late(36);
  rich(r);
  r.s.minute = 9 * 60;
  r.c.workClock = 0;
  assert.ok(r.ahFund("waterwheel"));
  r.s.day = 37;
  r.s.minute = 5 * 60 + 58;
  r.c.workClock = 58;
  if (r.dy) r.dy.pending = null;
  for (let i = 0; i < 200 && !r.ah.done.waterwheel; i++) {
    r.paused = false;
    r.update(0.05, {});
  }
  assert.equal(r.ah.done.waterwheel, 37);
  assert.ok(r.s.minute < 6 * 60 + 5, "done at 06:00, not an hour later");
  // 坏了的几样读成空的（不丢别的进度）
  const bad = JSON.parse(make(newGameState("farmer")).serialize());
  bad.ahead = { schema: 1, opened: [], paid: { nope: 3 }, done: {}, kids: ["k9"], said: { crow: -1 } };
  const b = Engine.parse(JSON.stringify(bad)).ahead;
  assert.deepEqual([b.opened, b.paid, b.kids, b.said], [{}, {}, [], {}]);
  const worse = JSON.parse(make(newGameState("farmer")).serialize());
  worse.ahead = "坏的";
  assert.equal(Engine.parse(JSON.stringify(worse)).ahead.schema, 1);
  const f = late(29);
  build(f, "waterwheel", "teahouse");
  f.toast("乌鸦啄了 2 块熟了的菜（每块少收 1 份）。", "warn");
  const g = make(Engine.parse(f.serialize()));
  assert.deepEqual(g.ah.done, f.ah.done);
  assert.deepEqual(g.ah.said, f.ah.said);
  assert.equal(JSON.stringify(Engine.parse(JSON.stringify(g.s)).ahead), JSON.stringify(g.s.ahead));
});

// ================= 小图、画面 =================
test("every new thing has its own small picture; the keepsakes stand out with the other ornaments; the bell tower (on the barn's ridge) and the monument (by the plaza) stand on the farm when they're done", () => {
  for (const p of PROJECTS) {
    assert.equal(typeof DECOR_DRAW[p.keep.id], "function", p.keep.id);
    assert.equal(typeof ICON_DRAW[decorItem(p.keep.id)], "function", p.keep.id);
    assert.ok(ITEMS[decorItem(p.keep.id)]?.decor === p.keep.id);
    if (p.special) {
      assert.equal(typeof ICON_DRAW[p.special.id], "function", p.special.id);
      assert.ok(ITEMS[p.special.id]?.name);
    }
  }
  for (const o of OUTSIDE) assert.equal(typeof ICON_DRAW[o.id], "function", o.id);
  for (const k of KID_LETTERS) for (const id of Object.keys(k.gift)) assert.ok(ITEMS[id], id);
  const drawn = [];
  const r = Object.create(AheadRenderer.prototype);
  r.drawAhBell = () => drawn.push("bell");
  r.drawAhMonument = () => drawn.push("monument");
  const proto = Object.getPrototypeOf(AheadRenderer.prototype);
  const base = proto.drawFarm;
  proto.drawFarm = function () {};
  try {
    r.drawFarm({ s: { minute: 600 }, ah: { done: { bell: 50, workshop: 60 } } });
    r.drawFarm({ s: { minute: 600 }, ah: { done: { monument: 99 } } });
    r.drawFarm({ s: { minute: 600 } });
  } finally {
    proto.drawFarm = base;
  }
  assert.deepEqual(drawn, ["bell", "monument"]);
  // 钟楼在谷仓屋脊上（谁也建不到屋顶上），纪念碑在前哨广场边上
  assert.deepEqual(FARM_SPOTS.bell, { x: 776, y: 86 });
  // 真画一遍：画得出来、不出错
  const calls = [];
  const R2 = Object.create(AheadRenderer.prototype);
  R2.ctx = { set fillStyle(v) {}, fillRect: () => calls.push(1), beginPath() {}, moveTo() {}, lineTo() {}, closePath() {}, fill: () => calls.push(2) };
  R2.drawAhBell(FARM_SPOTS.bell, 1);
  R2.drawAhMonument(FARM_SPOTS.monument);
  assert.ok(calls.length > 20);
});

// ================= 台子 =================
test("the bench bot funds this season's project in the evening (buying missing wood, stone, scrap, parts, cloth and herbs) and counts each finished place, its letter and each children's letter as new", () => {
  const b = read("scripts/relight-bench.mjs");
  assert.match(b, /function aheadEvening\(e, X\)/);
  assert.match(b, /aheadEvening\(e, X\);/);
  assert.match(b, /seen\("ahead:" \+ id\)/);
  assert.match(b, /seen\("ahLetter:" \+ id\)/);
  assert.match(b, /seen\("ahKid:" \+ k\)/);
});
