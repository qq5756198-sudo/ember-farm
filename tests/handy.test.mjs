// v0.45.0「顺手」：新开局的第一个小时——开局先教打架再派出门、建造页和设施页只列用得上的（手记要的排第一并默认选中）、
// 场景的字不互相挡、过时的小卡不弹、去掉的东西不再露字、一样东西一个叫法、早上一页说完（昨天的总结、今日抉择、前三天的“今天先做”）。
// 这一层只改开局那一拨来的时候，别的玩法的数不动；存档不加东西。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Engine, freshState, newGameState, needsStoryMigration } from "../dist/campaign.js";
import { Engine as EaseEngine, newGameState as easeNewGame } from "../dist/ease.js";
import { Engine as HandyEngine, handySay } from "../dist/handy.js";
import * as UI from "../dist/campaign-ui.js";
import { handyBuildGroups, handyRecipes, handyHome, handyFooter, handyView, handyWantCard, handyFold, handyJournal, handleHandyAction, handyWords, handyLockedShown } from "../dist/handy-ui.js";
import { EARLY_WAVE_MIN, ROAD, OPEN_STEP, SAY_WAVE, SAY_GO, HANDY_SAY, MENU_MSG, FARMER_ORIGIN, FENCE_CARD, EXIT_LABEL, CARD_STALE, PAGE, FIRST_DAYS, FOOT, GHOST_HINT, PURPOSE_EARLY } from "../dist/handy-data.js";
import { OPENING } from "../dist/feel-data.js";
import { ORIGINS } from "../dist/longnight-data.js";
import { MENUS, BCARD } from "../dist/simple-data.js";
import { BUILDINGS, RECIPES } from "../dist/data.js";
import { EVENTS as DAILY_EVENTS } from "../dist/daily-data.js";
import { buildGroups } from "../dist/simple-ui.js";
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
test("version: v0.45.0 顺手 in the title, the loading page and settings; the new files are preloaded; the engine and the scene each got a layer on top", () => {
  assert.equal(GAME_VERSION, "v0.45.0");
  assert.equal(GAME_EDITION, "顺手");
  assert.equal(GAME_RELEASE, "v0.45.0 · 顺手");
  const html = read("dist/index.html");
  assert.match(html, /<title>余烬农场 v0\.45\.0 · 顺手<\/title>/);
  assert.match(html, /data-release>v0\.45\.0 · 顺手</);
  for (const f of ["handy.js", "handy-data.js", "handy-ui.js", "handy-renderer.js"]) assert.ok(html.includes('<link rel="modulepreload" href="' + f + '">'), f + " preloaded");
  assert.equal(Engine, HandyEngine);
  assert.equal(Object.getPrototypeOf(HandyEngine), EaseEngine);
  assert.equal(CampaignRenderer, HandyRenderer);
  assert.equal(Object.getPrototypeOf(HandyRenderer), FourRenderer);
});

// ================= 开局先教打架再派出门 =================
test("replying to the first letter no longer marks the residential area while the opening wave hasn't come: the gold mark goes to the east road and Xiao Qi says why", () => {
  const said = [];
  const e = replied(said);
  assert.equal(e.feel.open.phase, "wait");
  assert.deepEqual(e.guidance.target, ROAD);
  assert.ok(said.includes(SAY_WAVE));
  assert.ok(!said.some((t) => /求援信号已标在地图上/.test(t)), "the residential line waits");
  // 第二段：选完援建物资，下一步是“守住东边路口”，在“接回阿禾”前面
  assert.ok(e.chooseSupply("ration"));
  const g = e.storyGoal();
  assert.equal(g.step.id, OPEN_STEP.id);
  assert.equal(g.step.title, OPEN_STEP.wait.title);
  assert.deepEqual(g.steps.map((s) => s.id), ["choice", "opening", "farmer", "farmerMeal", "table"]);
  assert.equal(g.index + "/" + g.total, "2/5");
  assert.equal(g.step.target.region, "farm");
  assert.equal(e.easeGuideOutside(), false, "the map isn't needed yet");
  assert.equal(UI.campaignHud(e) !== null, true);
});
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
test("beaten back: the step becomes 'fence the east road', the build page wants the fence; fenced: the residential area is marked and Xiao Qi says it now", () => {
  const said = [];
  const e = replied(said);
  e.chooseSupply("ration");
  tick(e, 15);
  for (const z of e.enemies) if (z.tut) z.dead = true;
  tick(e, 0.1);
  assert.equal(e.feel.open.phase, "fence");
  assert.equal(e.storyGoal().step.title, OPEN_STEP.fence.title);
  assert.deepEqual(e.hyWant(), { build: "fence", recipe: null });
  // 手记上多一个“去建围栏”
  const j = UI.renderCampaignJournal(e, {});
  assert.match(j, /data-action="hyFence"/);
  let opened = "";
  assert.ok(handleHandyAction("hyFence", btn("hyFence"), ctx(e, { showMenu: (m) => (opened = m) })));
  assert.equal(opened, "build");
  e.s.inventory.wood = 20;
  Object.assign(e.s.player, { x: 1240, y: 330 });
  e.buildMode = "fence";
  assert.ok(e.placeBuilding(ROAD.x, ROAD.y));
  assert.equal(e.buildMode, null, "placing one leaves build mode");
  tick(e, 0.1);
  assert.equal(e.feel.open.phase, "done");
  assert.equal(e.guidance.target.region, "residential");
  assert.ok(said.includes(SAY_GO));
  const g = e.storyGoal();
  assert.equal(g.step.id, "farmer");
  assert.match(g.step.title, /废弃居民区/);
  assert.doesNotMatch(JSON.stringify(g), /住宅区/);
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
test("build page: the facility the journal wants comes first in its own group; on a new game's first days only affordable ones are listed, later the rest fold away", () => {
  const e = replied();
  e.feel.open.phase = "fence";
  const ids = Object.keys(BUILDINGS).filter((id) => !BUILDINGS[id].retired && !BUILDINGS[id].tech);
  const groups = handyBuildGroups(e, buildGroups(ids));
  assert.equal(groups[0].key, "want");
  assert.equal(groups[0].title, PAGE.want);
  assert.deepEqual(groups[0].ids, ["fence"]);
  assert.ok(groups.every((g) => g.key === "want" || g.ids.every((id) => !BUILDINGS[id] || e.afford(BUILDINGS[id].cost || {}))), "only affordable ones on day 1");
  assert.ok(!groups.some((g) => g.fold));
  assert.equal(handyLockedShown(e), false);
  // 过了前三天：建不起的收进最下面一组，折着
  e.s.day = FIRST_DAYS + 1;
  const later = handyBuildGroups(e, buildGroups(ids));
  const fold = later.at(-1);
  assert.equal(fold.fold, true);
  assert.equal(fold.title, PAGE.lack(fold.ids.length));
  assert.ok(fold.ids.every((id) => !e.afford(BUILDINGS[id].cost || {})));
  assert.equal(handyLockedShown(e), true);
  // 开着某一样时（focused）不动
  assert.deepEqual(handyBuildGroups(e, buildGroups(["fence"]), true), buildGroups(["fence"]));
  // 那一格加个记号，建造页先选它
  assert.match(handyWantCard('<article class="recipe">x</article>'), /class="recipe hy-want"/);
  assert.match(read("dist/look-ui.js"), /tiles\.find\(\(t\) => t\.classList\.contains\("hy-want"\)\)/);
  assert.match(handyFold("还缺材料 · 2 样", "<i></i>"), /^<details class="hy-fold"><summary>还缺材料 · 2 样<\/summary><i><\/i><\/details>$/);
});
test("stove: the ration the journal wants comes first; what can't be made folds away; recipes a person must teach aren't listed on the first days", () => {
  const e = make();
  e.r.claimed.push("harvest");
  e.s.inventory.radish = 4;
  e.s.inventory.potato = 2;
  assert.equal(e.storyGoal().step.id, "meal");
  const cook = RECIPES.filter((r) => r.station === "cook");
  const r = handyRecipes(e, cook);
  assert.equal(r.want.id, "trailBread");
  assert.equal(r.main[0].id, "trailBread");
  assert.ok(r.main.some((x) => x.id === "stew"), "the stew can be made now");
  assert.ok(r.fold.every((x) => e.recipeReason(x) === "材料不足"));
  const hidden = cook.filter((x) => !r.main.includes(x) && !r.fold.includes(x));
  assert.ok(hidden.length >= 8, "taught recipes and blueprints aren't listed");
  assert.ok(hidden.every((x) => e.recipeReason(x) && e.recipeReason(x) !== "材料不足"));
  // 过了前三天：一样不少，做不了的都在折着的那一组
  e.s.day = FIRST_DAYS + 1;
  const r2 = handyRecipes(e, cook);
  assert.equal(r2.main.length + r2.fold.length, cook.length);
  // 用处只说眼下的
  e.s.day = 1;
  assert.equal(e.itemPurpose("bread"), PURPOSE_EARLY.bread);
  e.s.day = FIRST_DAYS + 1;
  assert.notEqual(e.itemPurpose("bread"), PURPOSE_EARLY.bread);
  // 做不了的时候“放 5 批”也灰掉
  assert.match(read("dist/game.js"), /batch=reason\|\|engine\.batchReason\(r\.id,5\)/);
});
test("farmhouse page: only the next extension is listed, the rare-goods line waits for its day, and on a new game's first days a far-off extension isn't listed", () => {
  const e = make();
  const html = UI.trimHomeExtras(e);
  assert.doesNotMatch(html, /先扩建上一样/);
  assert.doesNotMatch(html, /还没有添置稀罕货/);
  assert.doesNotMatch(html, /hp-expand/, "6000 gold away on day 1: not listed");
  assert.match(html, /休息好/);
  e.s.day = 40;
  const later = UI.trimHomeExtras(e);
  assert.match(later, /hp-expand/);
  assert.match(later, /东厢房/);
  assert.doesNotMatch(later, /二楼/);
  assert.doesNotMatch(later, /舒适度/);
});

// ================= 早上一页 =================
test("a hungry first night: no separate summary page — yesterday sits on top of today's choice, the first days' 'do first' at the bottom, and the corner morning card isn't repeated", () => {
  const e = new Engine(newGameState("farmer"), () => {});
  e.paused = false;
  e.s.minute = 22 * 60;
  const n0 = e.events.length;
  assert.ok(e.sleep());
  assert.ok(!e.events.slice(n0).some((v) => v.type === "menu" && v.view === "summary"));
  assert.ok(e.dailyCard());
  assert.equal(e.hyMorningReport(), true);
  const html = UI.renderCampaignView(e, { view: "daily" });
  assert.match(html, /^<div class="hy-morning"><section class="hy-yesterday"><h4 class="hy-sec">昨天 · 第 1 天<\/h4>/);
  assert.match(html, /金币 0 · 击败 0 · 收获 0 株 · 口粮 \d+ → \d+ 份/);
  assert.match(html, /口粮还能撑/);
  assert.match(html, /data-hotkey="1"/);
  assert.match(html, /<section class="hy-plan"><h4 class="hy-sec">今天先做<\/h4>/);
  assert.ok(e.ez.mornings.includes(2), "the corner morning card is told");
  assert.equal(e.easeTick().some((c) => c.key === "day:2"), false);
  assert.doesNotMatch(html, DEV);
  assert.equal(handyFooter(e, { view: "daily" }, { log: "L", defense: "Z" }), e.s.minute >= 360 ? FOOT.pick : FOOT.esc);
});
test("picking a choice with no risk and nothing to follow starts the day at once (one line on top); a gamble still turns over the result in the same page", () => {
  const e = new Engine(newGameState("farmer"), () => {});
  e.paused = false;
  e.s.minute = 22 * 60;
  e.sleep();
  const p = e.dailyCard();
  const opts = DAILY_EVENTS[p.id].opts;
  const free = opts.findIndex((o, i) => !o.p && !o.cost && !o.pay && !e.optionReason(i, p));
  if (free >= 0) {
    let shut = 0;
    const said = [];
    const ui = {};
    assert.ok(handleHandyAction("dPick", btn("dPick", String(free)), ctx(e, { ui, closeMenu: () => shut++, toast: (t) => said.push(t) })));
    const q = e.dy.pending;
    if (!q.lines.some((l) => /^后续：/.test(l))) {
      assert.equal(shut, 1);
      assert.ok(!ui.dailyResult);
      assert.match(said[0], /^今日抉择 · /);
    }
  }
  // 冒险的那一项：结果页
  const g = new Engine(newGameState("farmer"), () => {});
  g.paused = false;
  for (let tries = 0; tries < 30; tries++) {
    g.s.minute = 22 * 60;
    g.sleep();
    const c = g.dailyCard();
    const risky = c ? DAILY_EVENTS[c.id].opts.findIndex((o, i) => o.p && !g.optionReason(i, c)) : -1;
    if (risky < 0) {
      if (c) g.chooseDaily(DAILY_EVENTS[c.id].opts.findIndex((o, i) => !g.optionReason(i, c)));
      continue;
    }
    const ui = {};
    let shut = 0;
    handleHandyAction("dPick", btn("dPick", String(risky)), ctx(g, { ui, closeMenu: () => shut++ }));
    assert.equal(shut, 0);
    assert.ok(ui.dailyResult);
    assert.match(UI.renderCampaignView(g, { view: "daily", dailyResult: ui.dailyResult }), /开始第 \d+ 天/);
    return;
  }
  assert.fail("no gamble card in 30 days");
});
test("the bottom line of a dialog only names keys that page uses", () => {
  const e = make();
  assert.equal(handyFooter(e, { view: "gPick" }, { log: "L", defense: "Z" }), FOOT.esc);
  assert.equal(handyFooter(e, { view: "summary" }, { log: "L", defense: "Z" }), FOOT.esc);
  assert.equal(handyFooter(e, { view: "log" }, { log: "L", defense: "Z" }), "Esc 回到场景 · L 消息记录 · Z 防线");
  assert.match(read("dist/game.js"), /handyFooter\(engine,outpostUI,\{log:keyLabel\(engine\.s\.settings,'log'\),defense:keyLabel\(engine\.s\.settings,'defense'\)\}\)/);
});

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
test("one name for one thing, no removed systems or version names in words: residential area, camp morale, the conversion note, soil fertility, the talent note", () => {
  assert.equal(handySay("前往住宅区，找到阿禾"), "前往废弃居民区，找到阿禾");
  assert.equal(handySay("居民士气 +3"), "全营士气 +3");
  assert.equal(handySay("学会了天赋：快手（天赋按顺序自己学）。"), "学会了天赋：快手。");
  assert.equal(handySay("删繁：营地里一样东西只做一件事。拆掉的设施材料全退进了仓库，去掉的玩法退回的东西都在仓库里。"), "营地整理过了：一样东西只做一件事。拆掉的设施材料全退进了仓库，不再用的东西折成的材料都在仓库里。");
  assert.equal(handySay("这次简化退回了什么"), "营地整理退回了什么");
  assert.equal(handyWords("<p>还有这一版退回的东西</p>"), "<p>还有营地整理退回的东西</p>");
  for (const [re] of HANDY_SAY) assert.ok(re.global, "every rule replaces all");
  const e = make();
  // 走近田：不写肥力
  const plot = e.objects.find((o) => o.type === "plot");
  assert.doesNotMatch(String(e.context(plot)), /肥力|邻接/);
  // 菜单“消息”那一格、出身、围栏那张卡
  assert.equal(MENUS.find((m) => m[0] === "消息")[1], MENU_MSG[0]);
  assert.equal(ORIGINS.farmer.kit, FARMER_ORIGIN.kit);
  assert.doesNotMatch(ORIGINS.farmer.line, /原来的开局/);
  assert.deepEqual(BCARD.fence, FENCE_CARD);
  // 新开的档：菜单格下面没有“退回的东西”
  assert.doesNotMatch(UI.easeMenus(e, '<button data-action="sxOpen" data-id="messages"><b>消息</b><small>' + MENU_MSG[0] + "</small></button>"), /退回的东西/);
  // 页面的外壳和当前目标那一行都过一遍
  const g = read("dist/game.js");
  assert.match(g, /function shell\(title,body,sub,footer\)\{return head\(handyWords\(title\),handyWords\(sub\)\)/);
  assert.match(g, /textContent=handyWords\(sxWords\(goalLine\)\)/);
});
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
test("placing a facility leaves build mode unless Shift is held; the hint under the cursor says so", () => {
  const e = make();
  e.feel.open.phase = "done";
  e.s.inventory.wood = 30;
  Object.assign(e.s.player, { x: 1240, y: 330 });
  e.buildMode = "fence";
  e.hyKeepBuild = true;
  assert.ok(e.placeBuilding(1330, 400));
  assert.equal(e.buildMode, "fence");
  e.hyKeepBuild = false;
  assert.ok(e.placeBuilding(1250, 400));
  assert.equal(e.buildMode, null);
  assert.match(GHOST_HINT[1], /按住 Shift 连着放/);
  assert.match(read("dist/game.js"), /engine\.hyKeepBuild=keys\.has\('shift'\);engine\.use\(/);
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
test("saves: nothing new is written; an old v0.44 save loads and saves back byte for byte the same", () => {
  const o = new EaseEngine(easeNewGame("farmer"), () => {});
  o.s.day = 12;
  o.s.minute = 600;
  const text = o.serialize();
  assert.equal(needsStoryMigration(text), false);
  // 读进来、存出去：和上手那一层的引擎一字不差
  const a = new EaseEngine(EaseEngine.parse(text), () => {}).serialize(),
    b = new Engine(Engine.parse(text), () => {}).serialize();
  assert.equal(b, a);
  assert.equal(new Engine(Engine.parse(b), () => {}).serialize(), b);
  const s = freshState();
  assert.deepEqual(Object.keys(s).sort(), Object.keys(new EaseEngine(undefined, () => {}).s).sort());
});
