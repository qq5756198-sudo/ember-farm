// v0.43.0「上手」：一物一用方案第三版——用得上的时候才出现、第一次见到的小卡、新档前三天的引导。
// 新开的档：第 1 天菜单里只有用得上的几格、菜单最上面一行没有士气；第一次走近一样东西、第一次建得起一样设施、菜单里第一次多出一格，
// 角上停一张小卡（不挡路、不停游戏，几秒后收起，每张只弹一次，设置里能关）；第 2、3 天早上一张小卡说今天先做什么。
// 旧档（v0.42 和以前的档、带着记忆重新开始的档）用过的都算见过：菜单都在，不弹小卡。这一层不改玩法的数、不碰随机数、不加存档键。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { Engine, freshState, newGameState, newGamePlusState, needsStoryMigration } from "../dist/campaign.js";
import { Engine as TrimEngine, newGameState as trimNewGame, freshState as trimFresh } from "../dist/trim.js";
import { easeSay } from "../dist/ease.js";
import { alertItems } from "../dist/winter-ui.js";
import { JOBS, MANUAL_IDS } from "../dist/thief-data.js";
import { EVENTS as DAILY_EVENTS } from "../dist/daily-data.js";
import * as UI from "../dist/campaign-ui.js";
import { easeJournal, easeFrame, easeCardHtml, handleEaseAction, easeRadial, easeMenus, easeSettings } from "../dist/ease-ui.js";
import { EASE_SCHEMA, CARD_MS, CARD_QUEUE, GUIDE_DAYS, MENU_ALWAYS, MENU_IDS, CARD_TAG, CARD_NOW, MENU_FRESH, OBJ_CARD, PERSON_CARD, PERSON_TYPES, MORALE_CARD, GUIDE } from "../dist/ease-data.js";
import { menusHtml } from "../dist/simple-ui.js";
import { MENUS, BCARD } from "../dist/simple-data.js";
import { statusRows } from "../dist/look-ui.js";
import { BUILDINGS, ITEMS } from "../dist/data.js";
import { DECOR_LOOKS, DECOR_SPECIAL } from "../dist/trim-data.js";
import { GAME_VERSION, GAME_EDITION, GAME_RELEASE } from "../dist/version.js";
import { preserveBeforeUpgrade, readCampaign, UPGRADE_CHECKPOINT, CAMPAIGN_SAVE } from "../dist/player-session.js";

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
test("version: v0.43.0 上手 in the title, the loading page and settings", () => {
  assert.equal(GAME_VERSION, "v0.43.0");
  assert.equal(GAME_EDITION, "上手");
  assert.equal(GAME_RELEASE, "v0.43.0 · 上手");
  const html = read("dist/index.html");
  assert.match(html, /<title>余烬农场 v0\.43\.0 · 上手<\/title>/);
  assert.match(html, /data-release>v0\.43\.0 · 上手</);
  assert.match(html, /<div id="ease-card" class="ease-card" role="status" aria-live="polite" hidden><\/div><\/section>/, "the corner card sits in the scene");
  for (const f of ["ease.js", "ease-data.js", "ease-ui.js"]) assert.ok(html.includes('<link rel="modulepreload" href="' + f + '">'), f + " preloaded");
  assert.match(read("dist/game.js"), /document\.title=`余烬农场 \$\{GAME_VERSION\} · \$\{GAME_EDITION\}`/);
});

// ================= 第 1 天：只有用得上的 =================
test("a new game on day 1 shows only what it can use: five menu tiles, no morale, three entries on the Tab wheel, no photo tile, the unstuck tile kept", () => {
  const e = make();
  assert.equal(e.easeFresh(), true);
  assert.equal(e.ez.schema, EASE_SCHEMA);
  assert.deepEqual(e.easeMenus(), ["rebuild", "inventory", "craft", "build", "pause"]);
  assert.equal(e.easeMoraleVisible(), false);
  // 十格菜单那一页
  const html = UI.easeMenus(e, menusHtml(e));
  for (const a of ['data-menu="rebuild"', 'data-menu="inventory"', 'data-menu="craft"', 'data-menu="build"', 'data-menu="pause"', 'data-action="mendUnstuck"']) assert.ok(html.includes(a), a);
  for (const a of ['data-menu="map"', 'data-menu="skills"', 'data-id="people"', 'data-id="collection"', 'data-id="messages"', 'data-action="fPhoto"']) assert.ok(!html.includes(a), "not yet " + a);
  assert.equal((html.match(/<button /g) || []).length, 6);
  assert.doesNotMatch(html, DEV);
  // 菜单最上面一行：金、口粮，没有士气
  const hud = UI.campaignHud(e);
  assert.equal(hud.morale, null);
  assert.deepEqual(
    statusRows(e, hud).map((r) => r.key),
    ["money", "food"],
  );
  // 按住 Tab 的轮盘
  assert.deepEqual(
    UI.easeRadial(e, UI.radialItems(e)).map((x) => x.id),
    ["craft", "build", "journal"],
  );
  // 菜单格下面的小字：新开的档没有“这一版退回的东西”
  const desc = MENU_FRESH.messages;
  assert.ok(MENUS.some((m) => m[1] === desc[0]), "the v0.42 line is still what old saves read");
  e.s.xp.agriculture = 1;
  e.o.log.push({ day: 1, text: "一条消息" });
  assert.ok(UI.easeMenus(e, menusHtml(e)).includes(">" + desc[1] + "<"));
  assert.ok(!UI.easeMenus(e, menusHtml(e)).includes(desc[0]));
});

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

test("morale shows in the status row once someone lives in the camp, with one card", () => {
  const e = make();
  e.easeTick();
  assert.equal(e.easeMoraleVisible(), false);
  assert.ok(e.recruit("farmer"));
  assert.equal(e.easeMoraleVisible(), true);
  const cards = e.easeTick();
  const mo = cards.find((c) => c.key === "stat:morale");
  assert.ok(mo, "the morale card");
  assert.equal(mo.tag, CARD_TAG.stat);
  assert.deepEqual([mo.name, mo.does, mo.good], MORALE_CARD);
  assert.ok(statusRows(e, UI.campaignHud(e)).some((r) => r.key === "morale"), "morale in the status row");
  // 人走了，士气那一格也还在
  e.c.residents.length = 0;
  assert.equal(e.easeMoraleVisible(), true);
});

// ================= 旧档 =================
test("an old save: every menu, the morale and the journal as before, no cards, no settings line; the bytes before the upgrade are kept", () => {
  const text = oldText();
  assert.ok(!("ease" in JSON.parse(text)), "made by the v0.42 engine");
  assert.equal(needsStoryMigration(text), true);
  const store = mem();
  store.setItem(CAMPAIGN_SAVE, text);
  assert.equal(preserveBeforeUpgrade(store, needsStoryMigration), true);
  assert.equal(JSON.parse(store.getItem(UPGRADE_CHECKPOINT)).main, text, "the exact old bytes are kept");
  const e = make(readCampaign(store, Engine.parse).state);
  assert.equal(e.easeFresh(), false);
  assert.deepEqual(e.easeMenus(), MENU_IDS);
  assert.equal(e.easeMoraleVisible(), true);
  const html = UI.easeMenus(e, menusHtml(e));
  assert.equal(html, menusHtml(e), "the menu page untouched");
  assert.equal(UI.easeRadial(e, UI.radialItems(e)).length, UI.radialItems(e).length);
  assert.equal(easeSettings(e), "");
  // 走到水井跟前、过一天：没有小卡
  standAt(e, objOf(e, "well"));
  assert.equal(e.easeLook(), null);
  assert.deepEqual(e.easeTick(), []);
  assert.deepEqual(e.easeQueued(), []);
  e.s.day = 2;
  e.s.minute = 7 * 60;
  assert.deepEqual(e.easeTick(), [], "no morning card");
  // 任务手记：和 v0.42 一样（只有生活水准和法令簿那一条不再画）
  const j = UI.renderCampaignJournal(e, {});
  for (const a of ['data-action="gCatalog"', 'data-action="aOpen"', 'data-action="oDefense"', "rl-strip", "<summary>别的地方</summary>"]) assert.ok(j.includes(a), "an old save keeps " + a);
  // 存回去以后不用再升级
  const saved = e.serialize();
  assert.equal(JSON.parse(saved).ease.fresh, false);
  assert.equal(needsStoryMigration(saved), false);
  // 带着记忆重新开始：也算玩过的人
  const plus = make(newGamePlusState(JSON.parse(saved)));
  assert.equal(plus.easeFresh(), false);
  assert.deepEqual(plus.easeMenus(), MENU_IDS);
});

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

test("the settings switch: off — things are still marked seen but no card comes, the queue empties; on again — only new things", () => {
  const e = make();
  e.easeTick();
  const s0 = easeSettings(e);
  assert.match(s0, /<summary>上手<\/summary>/);
  assert.match(s0, /data-action="eCards" data-id="" aria-pressed="true">已开启/);
  assert.doesNotMatch(s0, DEV);
  e.easePush({ key: "q", tag: "", name: "q", does: "", good: "", now: "" });
  let rendered = 0;
  assert.equal(handleEaseAction("eCards", null, { engine: e, renderMenu: () => rendered++ }), true);
  assert.equal(e.ez.cards, false);
  assert.equal(rendered, 1);
  assert.deepEqual(e.easeQueued(), [], "the queue empties");
  assert.match(easeSettings(e), /aria-pressed="false">已关闭/);
  standAt(e, objOf(e, "well"));
  assert.equal(e.easeLook(), null);
  assert.ok(e.ez.seen.includes("well"), "seen anyway");
  e.s.xp.agriculture = 1;
  assert.deepEqual(e.easeTick(), []);
  assert.ok(e.ez.shown.includes("menu:skills"), "the tile is there, quietly");
  handleEaseAction("eCards", null, { engine: e });
  assert.equal(e.ez.cards, true);
  assert.equal(e.easeLook(), null, "the well was seen while off");
  assert.equal(JSON.parse(e.serialize()).ease.cards, true);
  assert.equal(handleEaseAction("somethingElse", null, { engine: e }), false);
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
test("the journal of a new game: only the story card's button on day 1; the rest appears when it can be used; the dropped living-standard strip is gone for every save", () => {
  const e = make();
  const acts = (h) => [...h.matchAll(/data-action="([^"]+)"/g)].map((m) => m[1]);
  const j = UI.renderCampaignJournal(e, {});
  assert.deepEqual(acts(j), ["gMainAction"]);
  assert.doesNotMatch(j, /rl-strip|<summary>别的地方<\/summary>|<div class="outpost-links"><\/div>/);
  assert.match(j, /清理一块农田/);
  assert.doesNotMatch(j, DEV);
  // 重建站那一行：碰到第一件旧物
  e.rl.old.push("rlOld_eraser");
  assert.match(UI.renderCampaignJournal(e, {}), /旧物 1\/48/);
  // 查看防线：建了一段围栏
  e.s.buildings.push({ id: "t-fence", type: "fence", x: 1200, y: 600, rotation: 0, hp: BUILDINGS.fence.hp });
  assert.ok(acts(UI.renderCampaignJournal(e, {})).includes("oDefense"));
  // 查看地图、别的地方：去过别的地方
  e.s.visited.ruins = true;
  const k = UI.renderCampaignJournal(e, {});
  assert.ok(acts(k).includes("aOpen"));
  assert.match(k, /<summary>别的地方<\/summary>/);
  // 选别的委托：主线第一段做完
  e.sc.claimed.push("act1");
  assert.ok(acts(UI.renderCampaignJournal(e, {})).includes("gCatalog"));
  // 生活水准和法令簿那一条：所有的档都不画
  const strip = '<div class="journal-page"><section class="winter-strip"><p>生活水准 2 · 法令簿 0/4</p><button data-action="wView" data-id="decrees">法令</button></section><p>留下</p></div>';
  for (const s of [newGameState("farmer"), JSON.parse(make(Engine.parse(oldText())).serialize())]) {
    const out = easeJournal(make(s), strip);
    assert.doesNotMatch(out, /winter-strip|生活水准|法令簿/);
    assert.match(out, /<p>留下<\/p>/);
  }
});

// ================= 角上的小卡怎么停 =================
test("the corner card: one at a time for 6.5 s, hidden (and its clock held) while a menu is open, hidden on the title page, × closes it, the page classes follow", () => {
  const e = make();
  const doc = fakeDoc();
  standAt(e, objOf(e, "well"));
  let t = 100000;
  assert.ok(easeFrame(e, doc, t), "the first frame looks and shows");
  assert.equal(doc.card.hidden, false);
  assert.match(doc.card.innerHTML, /<small class="ease-tag">第一次见到<\/small>/);
  assert.match(doc.card.innerHTML, /data-action="eCardClose"/);
  assert.match(doc.card.innerHTML, /灌满水壶/);
  assert.doesNotMatch(doc.card.innerHTML, DEV);
  assert.ok(doc.cls.has("ease-showing"));
  assert.ok(doc.cls.has("ease-nomap"), "no map yet");
  // 菜单开着：收起来、计时停
  t += CARD_MS - 1000;
  easeFrame(e, doc, t);
  assert.equal(doc.card.hidden, false);
  e.paused = true;
  for (let i = 0; i < 8; i++) easeFrame(e, doc, (t += 250));
  assert.equal(doc.card.hidden, true);
  assert.ok(!doc.cls.has("ease-showing"));
  e.paused = false;
  easeFrame(e, doc, (t += 10));
  assert.equal(doc.card.hidden, false, "back with the time that was left");
  easeFrame(e, doc, (t += 1100));
  assert.equal(doc.card.hidden, true, "gone after 6.5 s in the scene");
  assert.equal(UI.easeCardNow(), null);
  // 下一张；点 × 收起
  e.easePush({ key: "t1", tag: CARD_TAG.seen, name: "测试", does: "做一件事", good: "", now: "" });
  easeFrame(e, doc, (t += 300));
  assert.equal(doc.card.hidden, false);
  assert.equal(handleEaseAction("eCardClose", null, { engine: e, doc }), true);
  assert.equal(doc.card.hidden, true);
  assert.ok(!doc.cls.has("ease-showing"));
  // 标题页上不看也不停
  e.easePush({ key: "t2", tag: CARD_TAG.seen, name: "测试二", does: "做一件事", good: "", now: "" });
  doc.body.className = "title-screen";
  assert.equal(easeFrame(e, doc, (t += 300)), null);
  assert.equal(doc.card.hidden, true);
  assert.equal(e.easeQueued().length, 1, "still waiting");
  doc.body.className = "";
  // 旧档：没有小卡，两个 class 都不挂
  const o = make(Engine.parse(oldText()));
  standAt(o, objOf(o, "well"));
  assert.equal(easeFrame(o, doc, (t += 300)), null);
  assert.equal(doc.card.hidden, true);
  assert.ok(!doc.cls.has("ease-nomap") && !doc.cls.has("ease-showing"));
  // 手机上：卡上的按键说法换成按钮上的字
  const mm = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    assert.doesNotMatch(easeCardHtml({ key: "k", tag: "x", name: "n", does: "按 E 打开", good: "", now: "" }), /按 E/);
  } finally {
    if (mm) globalThis.matchMedia = mm;
    else delete globalThis.matchMedia;
  }
  assert.match(easeCardHtml({ key: "k", tag: "x", name: "n", does: "按 E 打开", good: "", now: "" }), /按 E 打开/);
  assert.equal(easeCardHtml(null), "");
});

// ================= 存档 =================
test("saves: the ease block round-trips; a partial or damaged block is put right on the way in (it only says what was seen, so nothing is lost); no new storage key", () => {
  const e = make();
  e.easeTick();
  standAt(e, objOf(e, "well"));
  e.easeLook();
  e.ez.mornings.push(2);
  const text = e.serialize();
  const raw = JSON.parse(text);
  assert.deepEqual(Object.keys(raw.ease).sort(), ["buildInit", "built", "cards", "fresh", "mornings", "schema", "seen", "shown"]);
  const back = make(Engine.parse(text));
  assert.deepEqual(back.ez, e.ez);
  // 缺了几样：补上（不是新档）
  const part = JSON.parse(text);
  part.ease = { schema: 1, seen: ["well"] };
  const p = make(Engine.parse(JSON.stringify(part)));
  assert.equal(p.ez.fresh, false);
  assert.deepEqual(p.ez.seen, ["well"]);
  assert.equal(p.ez.cards, true);
  // 坏了：读的时候就理顺（太长的截掉、不是开关的按开着、多出来的字段不留、不认得的东西不留），不会读不进来
  const fix = (ease) => {
    const t2 = JSON.parse(text);
    t2.ease = ease;
    return Engine.parse(JSON.stringify(t2)).ease;
  };
  assert.equal(fix({ ...raw.ease, cards: "yes" }).cards, true);
  assert.equal(fix({ ...raw.ease, cards: false }).cards, false);
  assert.equal(fix({ ...raw.ease, seen: Array.from({ length: 700 }, (_, i) => "k" + i) }).seen.length, 600);
  assert.ok(!("extra" in fix({ ...raw.ease, extra: 1 })));
  assert.equal(fix({ ...raw.ease, schema: 0 }).schema, EASE_SCHEMA);
  assert.deepEqual(fix({ ...raw.ease, seen: ["well", 3, null, "x".repeat(80)] }).seen, ["well"]);
  assert.deepEqual(fix({ ...raw.ease, mornings: [2, "3", 0, 1.5, 3] }).mornings, [2, 3]);
  assert.equal(fix({ ...raw.ease, fresh: "true" }).fresh, false, "only a real true counts as a new game");
  assert.deepEqual(fix("garbage"), { schema: EASE_SCHEMA, fresh: false, seen: [], shown: [], built: [], buildInit: false, cards: true, mornings: [] });
  // 新档、新开的档、带着记忆重新开始
  assert.equal(freshState().ease.fresh, true);
  assert.equal(newGameState("farmer").ease.fresh, true);
  // 这一层的文件不碰存储、不加存档键
  for (const f of ["dist/ease.js", "dist/ease-ui.js", "dist/ease-data.js"]) {
    const src = read(f);
    assert.doesNotMatch(src, /localStorage|sessionStorage|indexedDB|ember-farm-/, f);
  }
});

// ================= 不碰玩法的数 =================
test("the layer draws no random numbers and does not run the lower migrations again: new games, loads and every check draw what v0.42 drew", () => {
  const count = (fn) => {
    const real = Math.random;
    let n = 0;
    Math.random = () => {
      n++;
      return real();
    };
    try {
      fn();
    } finally {
      Math.random = real;
    }
    return n;
  };
  const text = oldText(20);
  assert.equal(
    count(() => new Engine(Engine.parse(text), () => {})),
    count(() => new TrimEngine(TrimEngine.parse(text), () => {})),
    "a load draws the same",
  );
  assert.equal(
    count(() => new Engine(newGameState("farmer"), () => {})),
    count(() => new TrimEngine(trimNewGame("farmer"), () => {})),
    "a new game draws the same",
  );
  assert.equal(
    count(() => new Engine(freshState(), () => {})),
    count(() => new TrimEngine(trimFresh(), () => {})),
  );
  const e = make();
  standAt(e, objOf(e, "well"));
  const doc = fakeDoc();
  assert.equal(
    count(() => {
      e.easeTick();
      e.easeLook();
      e.easeMenus();
      e.easeGuide();
      e.s.day = 2;
      e.s.minute = 400;
      e.easeTick();
      easeFrame(e, doc, 5e6);
      UI.easeMenus(e, menusHtml(e));
      UI.renderCampaignJournal(e, {});
      easeRadial(e, UI.radialItems(e));
    }),
    0,
  );
  for (const f of ["dist/ease.js", "dist/ease-ui.js", "dist/ease-data.js"]) assert.doesNotMatch(read(f), /Math\.random/, f);
});

// ================= 字 =================
test("words: no developer words or keyboard keys in the cards; every object card has two lines; the menu tiles match the menu list", () => {
  for (const f of ["dist/ease.js", "dist/ease-ui.js", "dist/ease-data.js"]) {
    const t = read(f).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(t, DEV, f);
  }
  for (const [k, v] of Object.entries(OBJ_CARD)) {
    assert.equal(v.length, 2, k);
    for (const line of v) {
      assert.ok(typeof line === "string" && line.length >= 2 && line.length <= 60, k + ": " + line);
      assert.doesNotMatch(line, /[A-Z]|空格|左键|右键/, k);
    }
  }
  for (const line of [...PERSON_CARD, ...MORALE_CARD, ...Object.values(CARD_TAG), CARD_NOW.menu, CARD_NOW.build, GUIDE.tip[2], GUIDE.tip[3], ...Object.values(MENU_FRESH).flat()]) {
    assert.doesNotMatch(line, DEV);
    assert.doesNotMatch(line, /[A-Z]|空格|左键|右键/, line);
  }
  assert.equal(MENU_IDS.length, MENUS.length, "one id per menu tile");
  assert.ok(MENU_ALWAYS.every((id) => MENU_IDS.includes(id)));
  assert.ok(PERSON_TYPES.length > 5);
  assert.ok(Object.keys(OBJ_CARD).length >= 50);
});

// ================= 说错了的几条提示 =================
test("texts that pointed nowhere are put right for every save: new messages point to the journal's 收到的消息 (the bottom-right box is long gone), storm warnings no longer say to cover crops (covers went in v0.42); a camp event is listed there with a button", () => {
  for (const state of [newGameState("farmer"), Engine.parse(oldText())]) {
    const said = [];
    const e = new Engine(state, (t) => said.push(t));
    e.paused = false;
    // 新消息、营地的小事
    e.toast("新消息：两天后的一顿回礼 · 右下角“营地消息”", "gold");
    e.toast("营地有新消息：点右下角“营地消息”查看。", "gold");
    assert.deepEqual(said.slice(-2), ["新消息：两天后的一顿回礼 · 任务手记里“收到的消息”", "营地有新消息：任务手记里“收到的消息”。"]);
    // 坏天气前一天傍晚：提示、消息记录、顶上的提醒都不再说盖布
    const plot = e.farmPlots().find((p) => !p.crop) || e.farmPlots()[0];
    Object.assign(plot, { tilled: true, crop: "radish", growth: 999 });
    for (const w of ["酸雨", "暴雨"]) {
      e.tomorrowWeather = () => w;
      e.stormWarn();
      const last = said.at(-1);
      assert.match(last, new RegExp("^明天" + w + "："));
      assert.match(last, /今天可以抢收（在田边按 E 打开那块田）。$/);
      assert.doesNotMatch(last, /盖布/);
      assert.equal(e.o.log[0].text, last, "the message log says the same");
    }
    UI.campaignHud(e);
    for (const kind of ["acid", "storm", "frost"]) {
      e.bt.storm = { day: e.s.day + 1, kind };
      const alerts = alertItems(e).map((a) => a.text);
      assert.ok(alerts.some((x) => /^明天.+ · 今天抢收$/.test(x)), kind + ": " + alerts.join(" / "));
      assert.ok(!alerts.some((x) => /盖布/.test(x)));
    }
    // 营地的小事：任务手记“收到的消息”里一行，点“去处理”打开它
    e.c.event = { type: "radio", day: e.s.day, done: false };
    const j = UI.renderCampaignJournal(e, {});
    const box = j.match(/<details class="journal-extra"><summary>收到的消息 · (\d+)件<\/summary>[\s\S]*?<\/details>/);
    assert.ok(box, "the 收到的消息 box");
    assert.match(box[0], /<p>无线电求援 <button data-action="openMessages" data-id="">去处理<\/button><\/p>/);
    assert.equal(Number(box[1]), (box[0].match(/<p>/g) || []).length, "the count includes it");
    e.c.event.done = true;
    assert.doesNotMatch(UI.renderCampaignJournal(e, {}), /无线电求援/);
  }
  // 原话里的“盖布去掉了”这类别的话不动
  assert.equal(easeSay("盖布去掉了：坏天气前一天傍晚说一声，长得差不多的能抢收。"), "盖布去掉了：坏天气前一天傍晚说一声，长得差不多的能抢收。");
  assert.equal(easeSay(null), null);
});

test("leftovers of v0.42 in passing texts: canteen, songs and festival chats say morale (not mood, reputation or noise); daily cards and their results no longer list fatigue or fertility; two job manuals and the radio cards say what they do now", () => {
  const said = [];
  const e = new Engine(newGameState("farmer"), (t) => said.push(t));
  e.paused = false;
  // 提示里的数
  for (const [from, to] of [
    ["今晚 4 位客人。客人头上写着要什么菜：到何大勺的灶台按 E 端菜，走到客人跟前按 E 上菜。（动静 +1）", "今晚 4 位客人。客人头上写着要什么菜：到何大勺的灶台按 E 端菜，走到客人跟前按 E 上菜。"],
    ["食堂打烊：招待 4 位（2 位对口），走掉 0 位；收入 48 金币，口碑 +10（现在 40）。", "食堂打烊：招待 4 位（2 位对口），走掉 0 位；收入 48 金币。"],
    ["老琴起了个头，大家跟着哼（心情 +2）。", "老琴起了个头，大家跟着哼（全营士气 +2）。"],
    ["阿禾：收成好，人心就定。（心情 +3）", "阿禾：收成好，人心就定。（全营士气涨了一点）"],
    ["纪念石前，大家轮流念一个没走到今天的人。（居民心情 +4；今晚想说心里话的人，在广场上就说得出口）", "纪念石前，大家轮流念一个没走到今天的人。（全营士气 +4；今晚想说心里话的人，在广场上就说得出口）"],
  ]) {
    e.toast(from);
    assert.equal(said.at(-1), to);
    assert.equal(easeSay(from), to);
  }
  // 两本职业手册
  assert.equal(JOBS.medicJob.text, "每天 07:00 给大家看病：你的生命 +10");
  assert.doesNotMatch(JOBS.weatherJob.text, /盖布/);
  for (const id of MANUAL_IDS) assert.doesNotMatch(ITEMS[id].desc, /妙手|疲劳|盖布/);
  // 东西的说明：优质收成、草料、稀罕货（删繁改过的那一句）、以前的上品
  assert.match(ITEMS.fine_radish.desc, /天天浇上水/);
  assert.doesNotMatch(ITEMS.fodder.desc, /杂草/);
  for (const id of ["hpGood_mill", "hpGood_tractor", "hpGood_bait"]) assert.doesNotMatch(ITEMS[id].desc, /水网|杂草|菜青虫/, id);
  assert.match(ITEMS.prime_radish.desc, /不再出上品/);
  // 每日抉择：卡上、结果里都不写疲劳和肥力；什么都不剩的写“什么也不发生”
  e.s.day = 9;
  e.s.minute = 359;
  e.dailyGenerate(9);
  e.s.minute = 361;
  const base = { ...e.dy.pending };
  const card = (id) => {
    e.dy.pending = { ...base, id, choice: null, win: null };
    return UI.renderCampaignView(e, { view: "daily", id: "" });
  };
  for (const id of Object.keys(DAILY_EVENTS)) {
    const html = card(id);
    assert.doesNotMatch(html, /疲劳|肥力|节目效果|心情最差/, id);
    assert.doesNotMatch(html, /<dd><\/dd>/, id);
  }
  assert.match(card("L05"), /熬药草茶<\/h4>[\s\S]*?<dd>什么也不发生<\/dd>/);
  assert.match(card("N05"), /换种豆子养地<\/h4>[\s\S]*?<dd>豆类种子 \+4<\/dd>/);
  assert.match(card("L10"), /一位居民：信任 \+2，全营士气涨了一点/);
  // 选了以后的结果：疲劳那一行不写，别的照旧；什么都没有就是“什么也没发生”
  e.dy.pending = { ...base, id: "L10", choice: null, win: null };
  const opt = DAILY_EVENTS.L10.opts.findIndex((o) => o.label === "给他放一天假");
  const r = e.chooseDaily(opt);
  assert.ok(r && !r.lines.some((l) => /疲劳/.test(l)));
  assert.deepEqual(r.lines, ["什么也没发生，日子照常过。"]);
  e.dy.pending = { ...base, day: 10, id: "N05", choice: null, win: null };
  e.s.day = 10;
  const r2 = e.chooseDaily(DAILY_EVENTS.N05.opts.findIndex((o) => o.label === "换种豆子养地"));
  assert.ok(r2.lines.some((l) => /豆类种子/.test(l)) && !r2.lines.some((l) => /肥力/.test(l)));
});

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
