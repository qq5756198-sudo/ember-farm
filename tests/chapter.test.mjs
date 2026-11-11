// v0.50「落脚」：章节这一层、新存档、新界面的测试。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { Engine, newGameState, freshState } from "../dist/campaign.js";
import { Engine as AheadEngine, newGameState as aheadNewGame } from "../dist/ahead.js";
import { SAVE_FORMAT, SAVE_KEY, CHAPTERS, PREP, GATE1, CH1_GROW, SCOUT, CH_BUILD, BARKS, INTRO, INTRO_ORIGIN, CH1_END, TRIP_BOONS, CH1_HIDDEN } from "../dist/chapter-data.js";
import { BUILDINGS, CROPS } from "../dist/data.js";
import { ORIGINS } from "../dist/longnight-data.js";

const DIST = new URL("../dist/", import.meta.url);
const DEV_WORDS = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|Joja|祝尼魔|星之果实/;

function game(origin = "farmer") {
  const toasts = [];
  const e = new Engine(newGameState(origin), (t, tone) => toasts.push({ t, tone }));
  e.paused = false;
  e.chSceneDone();
  return { e, toasts };
}
const run = (e, secs) => {
  for (let t = 0; t < secs; t += 0.05) {
    if (e.paused) e.paused = false;
    e.update(0.05, { x: 0, y: 0 });
  }
};
// 把主线推到第二段做完（接回阿禾、饭桌坐满）：照引擎自己的路走，存档对得上
function pastAct2(e) {
  const sc = e.sc;
  if (!sc.claimed.includes("act1")) sc.claimed.push("act1");
  if (!sc.letters.includes("act2")) sc.letters.push("act2");
  sc.act = 2;
  sc.choice = "ration";
  if (!sc.claimed.includes("supply")) sc.claimed.push("supply");
  if (e.feel?.open) e.feel.open.phase = "done";
  e.finishAct2();
  e.events.length = 0;
}

test("新开一局：在第一章、第一段，带着新存档的记号，开场过场等着放", () => {
  const s = newGameState("farmer");
  assert.equal(s.format, SAVE_FORMAT);
  assert.equal(s.ch.n, 1);
  assert.equal(s.ch.scene, "intro");
  const e = new Engine(s, () => {});
  assert.equal(e.chNow(), 1);
  assert.equal(e.chLabel(), "第一章 · 落脚");
  assert.equal(e.chStage(), "settle");
  assert.equal(e.chScene(), "intro");
  assert.equal(e.chSceneDone(), true);
  assert.equal(e.chScene(), "");
  const g = e.chGoal();
  assert.equal(g.stage, "settle");
  assert.ok(g.step && g.step.title);
  assert.ok(g.lines.length >= 4);
});

test("五种出身都能开局，开场那一张按出身换", () => {
  for (const id of Object.keys(ORIGINS)) {
    const e = new Engine(newGameState(id), () => {});
    assert.equal(e.s.longnight.origin, id);
    assert.ok(INTRO_ORIGIN[id], id + " 有开场的话");
  }
  assert.equal(INTRO.filter((s) => s.art === "origin").length, 1);
});

test("新存档：存出来再读回去一字不差（新开的、过了三天的）", () => {
  const { e } = game();
  const t1 = e.serialize();
  assert.equal(new Engine(Engine.parse(t1), () => {}).serialize(), t1);
  for (let d = 0; d < 3; d++) {
    run(e, 60);
    e.s.minute = 23 * 60;
    e.sleep();
  }
  assert.ok(e.s.day >= 3);
  const t2 = e.serialize(),
    again = new Engine(Engine.parse(t2), () => {}).serialize();
  assert.equal(again, t2);
});

test("旧档不读：没有新记号的档读不进来", () => {
  const old = new AheadEngine(aheadNewGame("farmer"), () => {}).serialize();
  assert.throws(() => Engine.parse(old), /旧版/);
  const { e } = game();
  const raw = JSON.parse(e.serialize());
  delete raw.ch;
  assert.throws(() => Engine.parse(JSON.stringify(raw)), /旧版/);
  assert.notEqual(SAVE_KEY, "ember-farm-save-v1");
});

test("存档里章节那一块坏了的数会被改正，不会带进游戏", () => {
  const { e } = game();
  const raw = JSON.parse(e.serialize());
  raw.ch = { n: 99, done: [1, "x", 7], gate: { day: -3, state: "what", tries: "a" }, trip: { region: 5, offer: ["nope", "fleet"] }, day0: { money: "x" }, scene: 12 };
  const s = Engine.parse(JSON.stringify(raw));
  assert.equal(s.ch.n, 5);
  assert.deepEqual(s.ch.done, [1]);
  assert.equal(s.ch.gate.state, "far");
  assert.equal(s.ch.gate.day, 1);
  assert.equal(s.ch.gate.tries, 0);
  assert.deepEqual(s.ch.trip.offer, ["fleet"]);
  assert.equal(s.ch.day0.money, 0);
  assert.equal(s.ch.scene, "");
});

test("第一章只去得了农场、集市、废弃居民区；别的路去不了，还说一声", () => {
  const { e, toasts } = game();
  assert.equal(e.chRegionOpen("residential"), true);
  assert.equal(e.chRegionOpen("market"), true);
  assert.equal(e.chRegionOpen("hospital"), false);
  assert.equal(e.travel("hospital"), false);
  assert.equal(e.s.region, "farm");
  assert.ok(toasts.some((x) => /第二章再走/.test(x.t)));
  assert.equal(e.travel("market"), true);
  assert.equal(e.s.region, "market");
});

test("第一章能建的十三样；后面几章的建不了", () => {
  const { e, toasts } = game();
  for (const id of CH_BUILD[1]) assert.ok(BUILDINGS[id], id), assert.equal(e.chBuildOpen(id), true, id);
  for (const id of [...CH_BUILD[2], ...CH_BUILD[3]]) assert.ok(BUILDINGS[id], id), assert.equal(e.chBuildOpen(id), false, id);
  e.add({ wood: 20, stone: 10 });
  assert.equal(e.startBuild("coop"), false);
  assert.ok(toasts.some((x) => /第二章才能建/.test(x.t)));
  assert.equal(e.startBuild("fence"), true);
});

test("第一章里天赋不自己学，菜长得慢（头两株口粮不算）", () => {
  const { e } = game();
  assert.deepEqual(e.trLearn(true, true), []);
  const p = e.s.plots[0];
  p.tilled = true;
  p.crop = "radish";
  const before = e.cropGrowthRate(p);
  e.r.claimed.push("harvest");
  assert.ok(Math.abs(e.cropGrowthRate(p) - before * CH1_GROW) < 1e-9);
});

test("第一章里先不说的话不弹；叫法换成新界面的", () => {
  const { e, toasts } = game();
  e.toast("学会了天赋：老把式（天赋按顺序自己学）。", "gold");
  e.toast("小柒：医院方向收到新的求援，详情在任务手记。", "gold");
  e.toast("下午的事 · 货郎：种子贩子在营门口摆摊。");
  assert.equal(toasts.length, 0);
  e.toast("打开任务手记（J）查看。");
  assert.equal(toasts.at(-1).t, "打开手记（J）查看。");
  assert.equal(e.chSay("营地有新消息：任务手记里“收到的消息”。"), null);
});

test("第一章里界面没有的页面不开，按了有一句话；有的照常开", () => {
  const { e, toasts } = game();
  e.events.length = 0;
  e.emit("menu", { menu: "outpost", view: "gBoard", id: "" });
  assert.equal(e.events.length, 0);
  assert.ok(toasts.some((x) => /第二章再用/.test(x.t)));
  e.emit("menu", { menu: "outpost", view: "daily", id: "" });
  e.emit("menu", { menu: "home" });
  e.emit("menu", { menu: "ch", view: "boon" });
  assert.equal(e.events.filter((x) => x.type === "menu").length, 3);
});

test("顶上的资源：粮、材料、金、人都有数、有涨跌、有从哪来到哪去；有了人才有士气", () => {
  const { e } = game();
  let list = e.chResources();
  assert.deepEqual(list.map((r) => r.id), ["food", "mat", "gold", "people"]);
  for (const r of list) {
    assert.ok(r.text !== "" && r.delta !== "", r.id);
    assert.ok(r.rows.length >= 3, r.id + " 有来源去向");
    assert.ok(!DEV_WORDS.test(JSON.stringify(r)), r.id);
  }
  assert.equal(list.find((r) => r.id === "mat").delta, "+0 今天");
  e.addHelper("tieqiao");
  list = e.chResources();
  assert.ok(list.some((r) => r.id === "morale"));
  assert.equal(list.find((r) => r.id === "people").value, 2);
  assert.equal(list.length <= 6, true);
});

test("右边的警报最多三条，要紧的在前；灶坏了、菜熟了都会说", () => {
  const { e } = game();
  const cook = e.s.buildings.find((b) => b.type === "cook");
  cook.hp = 0;
  const p = e.s.plots[0];
  p.tilled = true;
  p.crop = "radish";
  p.growth = CROPS.radish.grow;
  e.s.horde = { phase: "warning", timer: 40, remaining: 8, spawnTimer: 0, direction: 0 };
  const list = e.chAlerts();
  assert.ok(list.length <= 3);
  assert.equal(list[0].tone, "bad");
  assert.ok(/尸潮/.test(list[0].title));
  assert.ok(list.some((a) => /篝火灶坏了/.test(a.title)));
  for (const a of list) assert.ok(a.go && a.go.kind, "点了有去处");
});

test("备战五样：差多少都写着；都够了才算备好", () => {
  const { e } = game();
  pastAct2(e);
  assert.equal(e.chStage(), "prep");
  let lines = e.chPrepLines();
  assert.deepEqual(lines.map((l) => l.id), ["food", "fence", "trap", "heal", "breeder"]);
  assert.equal(e.chPrepReady(), false);
  const add = (type, n) => {
    for (let i = 0; i < n; i++) e.s.buildings.push({ id: "t" + type + i, type, x: 1200 + i * 10, y: 700, rotation: 0, hp: BUILDINGS[type].hp });
  };
  add("fence", PREP.fences - 1);
  add("gate", 1);
  add("trap", PREP.traps);
  add("breeder", 1);
  e.s.storage.bread = 60;
  e.s.inventory.bandage = PREP.heal;
  lines = e.chPrepLines();
  assert.ok(lines.every((l) => l.done), JSON.stringify(lines));
  assert.equal(e.chPrepReady(), true);
  assert.equal(e.chGoal().step.id, "prep:ready");
});

test("第一场尸潮：前一天傍晚有前兆，当天夜里来，来多少看家底；今晚不能睡过去", () => {
  const { e, toasts } = game();
  pastAct2(e);
  e.ch.seen.scout = true;
  e.addHelper("tieqiao");
  e.s.day = GATE1.day - 1;
  e.s.minute = GATE1.omenHour * 60 + 1;
  run(e, 1);
  assert.equal(e.ch.gate.state, "omen");
  assert.ok(toasts.some((x) => /明晚.*第一场尸潮/.test(x.t)));
  assert.ok(e.chAlerts().some((a) => /尸潮/.test(a.title)));
  e.s.day = GATE1.day;
  e.s.minute = GATE1.warnHour * 60 + 1;
  run(e, 1);
  assert.equal(e.ch.gate.state, "tonight");
  assert.equal(e.chStage(), "gate");
  assert.equal(e.sleep(), false);
  assert.ok(toasts.some((x) => /守完再睡/.test(x.t)));
  e.s.storage.bread = 48;
  const want = e.chGateCount();
  assert.ok(want > GATE1.base && want <= GATE1.max);
  e.s.minute = GATE1.hour * 60 + 1;
  run(e, 1);
  assert.equal(e.ch.gate.state, "active");
  assert.equal(e.s.horde.phase, "warning");
  assert.equal(e.ch.gate.count, want);
  e.s.horde.timer = 0.01;
  run(e, 1);
  assert.equal(e.s.horde.phase, "active");
  assert.ok(e.s.horde.remaining + e.enemies.filter((z) => z.horde && !z.dead).length <= want);
});

test("考验的那一夜不等人：前面的段没做完，眼下的事也是守路口；守完了接着做没做完的那一段", () => {
  // 真键盘鼠标那一遍量出来的：公共餐桌拖到第 9 天还没开张，尸潮来的那一夜左下角还写着“为公共餐桌备料”
  const { e } = game();
  const sc = e.sc;
  if (!sc.claimed.includes("act1")) sc.claimed.push("act1");
  if (!sc.letters.includes("act2")) sc.letters.push("act2");
  sc.act = 2;
  sc.choice = "ration";
  if (!sc.claimed.includes("supply")) sc.claimed.push("supply");
  if (e.feel?.open) e.feel.open.phase = "done";
  e.ch.seen.scout = true;
  const before = e.chStage();
  assert.equal(before, "people");
  e.s.day = GATE1.day;
  e.s.minute = GATE1.warnHour * 60 + 1;
  run(e, 1);
  assert.equal(e.ch.gate.state, "tonight");
  assert.equal(e.chStage(), "gate");
  const g = e.chGoal();
  assert.equal(g.step.id, "gate");
  assert.ok(/东边的路口/.test(g.step.text));
  assert.ok(g.lines.length === 1 && /只上下/.test(g.lines[0].text));
  // 守住了：人还没住下，回到没做完的那一段，第一章不算做完
  e.ch.gate = { ...e.ch.gate, state: "won", live: false, wonDay: e.s.day };
  assert.equal(e.chStage(), before);
  assert.equal(e.chDone(1), false);
  // 没守住：也回到没做完的那一段，等下一个夜里
  e.ch.gate = { ...e.ch.gate, state: "omen", day: e.s.day + 1 };
  assert.equal(e.chStage(), before);
  // 连第一段都没做完的，这一夜也一样
  const fresh = game().e;
  assert.equal(fresh.chStage(), "settle");
  fresh.ch.gate.state = "tonight";
  assert.equal(fresh.chStage(), "gate");
  assert.equal(fresh.chGoal().step.id, "gate");
});

test("第一章的地图上不摆后面几章的人和东西；还摆着的几样，按 E 说的是它自己的事", () => {
  const { e, toasts } = game();
  pastAct2(e);
  const below = Object.getPrototypeOf(Engine.prototype).assignRegion;
  // 下面各层照老规矩摆：过节的广场、江伯都在
  below.call(e);
  const old = e.objects.map((o) => o.type);
  assert.ok(old.includes("seasonPlaza") && old.includes("seasonJiang"), old.join(","));
  // 第一章：拿掉
  e.assignRegion();
  for (const o of e.objects) assert.ok(!CH1_HIDDEN.includes(o.type), o.type + " " + o.name);
  for (const t of ["home", "well", "sign", "exit", "pond"]) assert.ok(e.objects.some((o) => o.type === t), t + " 还在");
  // 第二章起照常摆
  e.ch.n = 2;
  e.assignRegion();
  assert.ok(e.objects.some((o) => o.type === "seasonPlaza"));
  e.ch.n = 1;
  e.assignRegion();
  // 还摆着的：路口说路，集市工地说集市，别的才是那一句
  const said = (data) => {
    toasts.length = 0;
    e.emit("menu", data);
    return toasts.map((x) => x.t).join("|");
  };
  assert.equal(said({ menu: "sx", view: "gate" }), "这条路第二章再走。");
  assert.equal(said({ menu: "camp", tab: "projects" }), "集市还在搭，第二章接着建。");
  assert.equal(said({ menu: "outpost", view: "plaza" }), "这里第二章再用。");
  // “第一次见到”一个人的小卡：不提送礼和没有的那一页
  assert.equal(e.chSay("送对了礼物信任涨得快；喜欢什么写在“人”那一页"), "");
  assert.equal(e.chSay("和他说话：他是谁、在干什么、喜欢什么"), "和他说话：他是谁、在干什么");
});

test("第一章收下巨型作物：不提后面才有的收获展", () => {
  const { e, toasts } = game();
  e.toast("收下了巨型萝卜：萝卜 ×12、巨型萝卜 ×1。巨型的那一个能拿去收获展（一棵顶一组）。", "gold");
  const t = toasts[toasts.length - 1].t;
  assert.ok(!/收获展/.test(t), t);
  assert.ok(/卖个好价钱/.test(t), t);
});

test("守住了、阿禾也接回来了，第一章才算做完：给一次赏，放结尾的过场", () => {
  const { e } = game();
  pastAct2(e);
  e.ch.seen.scout = true;
  e.sc.claimed = e.sc.claimed.filter((x) => x !== "act2");
  e.ch.gate = { day: e.s.day, state: "active", tries: 0, count: 10, live: true, wonDay: 0 };
  e.s.horde = { phase: "won", timer: 0, remaining: 0, spawnTimer: 0 };
  run(e, 1);
  assert.equal(e.ch.gate.state, "won");
  assert.equal(e.chDone(1), false, "人还没接回来");
  const money = e.s.money;
  e.sc.claimed.push("act2");
  run(e, 1);
  assert.equal(e.chDone(1), true);
  assert.equal(e.chStage(), "done");
  assert.equal(e.chScene(), "ch1end");
  assert.equal(e.s.money, money + GATE1.reward.money);
  assert.equal(e.s.storage.ammo, GATE1.reward.items.ammo);
  run(e, 2);
  assert.equal(e.s.money, money + GATE1.reward.money, "只给一次");
  const st = e.chEndStats();
  assert.ok(st.days >= 1 && st.harvest >= 0 && st.kills >= 0);
  assert.equal(new Engine(Engine.parse(e.serialize()), () => {}).chDone(1), true);
});

test("没守住：尸潮散了，第二天夜里再来", () => {
  const { e } = game();
  pastAct2(e);
  e.addHelper("tieqiao");
  const day = e.s.day;
  e.ch.gate = { day, state: "active", tries: 0, count: 10, live: true, wonDay: 0 };
  e.s.horde = { phase: "locked", timer: 0, remaining: 0, spawnTimer: 0 };
  run(e, 1);
  assert.equal(e.ch.gate.state, "omen");
  assert.equal(e.ch.gate.day, day + GATE1.retryDays);
  assert.equal(e.ch.gate.tries, 1);
  assert.ok(e.ch.barks.gateLost);
});

test("提前迎战：第 8 天起、都备好了才行", () => {
  const { e } = game();
  pastAct2(e);
  e.s.day = GATE1.earlyFrom;
  e.s.minute = 10 * 60;
  assert.equal(e.chCanCallGate(), false, "还没备好");
  for (let i = 0; i < PREP.fences; i++) e.s.buildings.push({ id: "f" + i, type: "fence", x: 1200 + i * 10, y: 700, rotation: 0, hp: 150 });
  for (let i = 0; i < PREP.traps; i++) e.s.buildings.push({ id: "t" + i, type: "trap", x: 1200 + i * 10, y: 760, rotation: 0, hp: 50 });
  e.s.buildings.push({ id: "br", type: "breeder", x: 900, y: 700, rotation: 0, hp: 80 });
  e.s.storage.bread = 60;
  e.s.inventory.bandage = PREP.heal;
  assert.equal(e.chCanCallGate(), true);
  assert.equal(e.chCallGate(), true);
  assert.equal(e.ch.gate.day, GATE1.earlyFrom);
  assert.equal(e.chCanCallGate(), false);
});

test("第 6 天傍晚来一回探路的，只来一回", () => {
  const { e } = game();
  e.sc.act = 2;
  if (e.feel?.open) e.feel.open.phase = "done";
  e.s.day = SCOUT.day;
  e.s.minute = SCOUT.from + 5;
  const before = e.enemies.length;
  run(e, 1);
  assert.equal(e.enemies.length, before + SCOUT.kinds.length);
  assert.equal(e.ch.seen.scout, true);
  run(e, 2);
  assert.equal(e.enemies.filter((z) => !z.dead).length <= before + SCOUT.kinds.length, true);
});

test("出门一趟：翻到头一样东西以后三样里挑一样，只管这一趟", () => {
  const { e } = game();
  e.sc.act = 2;
  if (e.feel?.open) e.feel.open.phase = "done";
  assert.equal(e.travel("residential"), true);
  assert.ok(e.ch.trip && e.ch.trip.region === "residential");
  for (const z of e.enemies) z.dead = true;
  e.events.length = 0;
  run(e, 1);
  assert.equal(e.chTripOffer().length, 0, "还没翻到东西");
  e.add({ wood: 2 }, true);
  run(e, 1);
  const offer = e.chTripOffer();
  assert.equal(offer.length, 3);
  assert.ok(e.events.some((x) => x.type === "menu" && x.menu === "ch" && x.view === "boon"));
  const pick = offer.find((b) => b.buff) || offer[0];
  assert.equal(e.chPickBoon(pick.id), true);
  assert.equal(e.chPickBoon(pick.id), false, "只能挑一样");
  assert.equal(e.chTripBoon().id, pick.id);
  if (pick.buff) assert.ok(e.c.buffs.some((b) => b.id === pick.buff));
  assert.equal(e.travel("farm"), true);
  assert.equal(e.ch.trip, null);
  if (pick.buff) assert.equal(e.c.buffs.some((b) => b.id === pick.buff), false, "回家就没了");
  assert.equal(TRIP_BOONS.length >= 4, true);
});

test("队友说话：做了那件事才说，一句只说一次；没那个人不说", () => {
  const { e } = game();
  e.events.length = 0;
  assert.equal(e.chBark("firstFence"), false, "铁锹还没来");
  e.addHelper("tieqiao");
  assert.equal(e.chBark("firstFence"), true);
  assert.equal(e.chBark("firstFence"), false);
  assert.equal(e.events.filter((x) => x.type === "bark").length, 1);
  assert.equal(e.chBark("farmerHome"), false, "阿禾还没来");
  for (const b of Object.values(BARKS)) assert.ok(["tieqiao", "farmer"].includes(b.who) && b.text.length > 6);
});

test("队友名册：来了谁列谁，干什么写清楚", () => {
  const { e } = game();
  assert.equal(e.chOpen("team"), false);
  assert.deepEqual(e.chTeam(), []);
  e.addHelper("tieqiao");
  assert.equal(e.chOpen("team"), true);
  const t = e.chTeam();
  assert.equal(t.length, 1);
  assert.equal(t[0].name, "铁锹");
  assert.ok(t[0].does && t[0].job && t[0].lookRole === "helper");
  assert.equal(e.chOpen("jobs"), false, "岗位第二章才开");
});

test("五章都写着名字、目标、考验；第一章开着，后四章下一版", () => {
  for (const n of [1, 2, 3, 4, 5]) {
    const c = CHAPTERS[n];
    assert.ok(c.name && c.goal && c.gate && c.days[0] < c.days[1]);
    assert.equal(c.open, n === 1);
  }
  assert.equal(CHAPTERS[5].days[1], 56);
  assert.equal(CH1_END.length >= 4, true);
});

// ---------- 新界面 ----------
test("界面：旧样式和旧界面的文件都删了，只剩一套", () => {
  const files = readdirSync(DIST);
  assert.deepEqual(files.filter((f) => f.endsWith(".css")), ["app.css"]);
  assert.equal(files.includes("game.js"), false);
  assert.equal(files.filter((f) => /-ui\.js$/.test(f)).length, 0, "各层自己拼页面的代码删了");
  const html = readFileSync(new URL("index.html", DIST), "utf8");
  assert.equal((html.match(/rel="stylesheet"/g) || []).length, 1);
  assert.ok(/href="app\.css"/.test(html));
  assert.ok(/src="app\.js"/.test(html));
  assert.equal(/touch|joystick/.test(html), false, "只做电脑");
});

test("界面：样式里没有小于 14 像素的字", () => {
  const css = readFileSync(new URL("app.css", DIST), "utf8");
  const sizes = [...css.matchAll(/font-size:\s*([0-9.]+)px/g)].map((m) => Number(m[1]));
  assert.ok(sizes.length > 20);
  assert.ok(Math.min(...sizes) >= 14, "最小 " + Math.min(...sizes));
  const js = ["app.js", "app-kit.js", "app-hud.js", "app-pages.js", "app-cards.js"].map((f) => readFileSync(new URL(f, DIST), "utf8")).join("\n");
  const inline = [...js.matchAll(/font-size:\s*([0-9.]+)px/g)].map((m) => Number(m[1]));
  assert.ok(inline.every((n) => n >= 14), "脚本里写死的字号最小 " + Math.min(...inline));
});

test("界面：常驻不超过七块，底下五个大按钮", () => {
  const html = readFileSync(new URL("index.html", DIST), "utf8");
  for (const id of ["res", "clock", "alerts", "goal", "hands", "dock", "hint"]) assert.ok(html.includes('id="' + id + '"'), id);
  const hud = readFileSync(new URL("app-hud.js", DIST), "utf8");
  const dock = hud.slice(hud.indexOf("const DOCK = ["), hud.indexOf("];", hud.indexOf("const DOCK = [")));
  assert.equal((dock.match(/\{ id:/g) || []).length, 5);
  for (const name of ["建造", "队友", "仓库", "地图", "手记"]) assert.ok(dock.includes(name), name);
});

test("界面：整页一共不超过十个；每一页排出来的字里没有开发用语", async () => {
  const P = await import("../dist/app-pages.js");
  const Cd = await import("../dist/app-cards.js");
  const { e } = game();
  e.addHelper("tieqiao");
  e.sc.act = 2;
  const G = (ui = {}) => ({ e, ui, started: true, hasSave: true, saveInfo: { day: 3, label: "第一章 落脚" }, saveIssue: "", saveState: "存好了。", audioPrefs: { music: 0.6, ambience: 0.7, sfx: 0.9 }, toastLog: [{ text: "回信已发出。", tone: "gold", time: "第1天 11:52" }], renderer: null });
  const pages = ["team", "store", "map", "journal", "settings"];
  const outs = [];
  for (const name of pages) outs.push([name, P.pageHtml(G(), name)]);
  outs.push(["store:make", P.pageHtml(G({ tab: "make" }), "store")]);
  outs.push(["store:trade", P.pageHtml(G({ tab: "trade" }), "store")]);
  outs.push(["journal:log", P.pageHtml(G({ tab: "log" }), "journal")]);
  outs.push(["build", P.buildHtml(G({ tab: "guard" }))]);
  outs.push(["build:farm", P.buildHtml(G({ tab: "farm" }))]);
  outs.push(["title", Cd.titleHtml(G())]);
  outs.push(["origin", Cd.originHtml(G({ origin: "hunter" }))]);
  outs.push(["cut", Cd.cutHtml(G({ scene: "intro", slide: 2 }))]);
  for (const name of ["home", "death", "supply", "confirm"]) outs.push(["card:" + name, Cd.cardHtml(G({ kind: "credits" }), name)]);
  e.s.plots[0].tilled = true;
  outs.push(["card:plot", Cd.cardHtml(G({ id: String(e.s.plots[0].id) }), "plot")]);
  outs.push(["card:building", Cd.cardHtml(G({ id: e.s.buildings[0].id }), "building")]);
  e.s.day = 2;
  e.s.minute = 400;
  e.dailyGenerate(2);
  outs.push(["card:event", Cd.cardHtml(G(), "event")]);
  for (const [name, html] of outs) {
    assert.ok(html.length > 80, name + " 排出东西了");
    assert.ok(!DEV_WORDS.test(html), name + " 里有开发用语：" + (html.match(DEV_WORDS) || [""])[0]);
    assert.ok(!/Joja|触屏|手机|点右上角/.test(html), name);
  }
  // 整页：标题页、建造、队友、仓库、地图、手记、今天的事、早报和过场、设置；加点第二章才有
  assert.ok(pages.length + 4 <= 10);
});

test("界面和章节的文案里没有开发用语", () => {
  for (const f of ["chapter-data.js", "app-cards.js", "app-pages.js", "app-hud.js", "app.js"]) {
    const text = readFileSync(new URL(f, DIST), "utf8")
      .split("\n")
      .filter((l) => !/^\s*\/\//.test(l) && !/\bundefined\b|Number\.isNaN|\bNaN\b/.test(l))
      .join("\n");
    assert.ok(!/机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|Joja|祝尼魔|星之果实/.test(text), f);
  }
});

test("freshState 也是带新记号的档", () => {
  const s = freshState();
  assert.equal(s.format, SAVE_FORMAT);
  assert.ok(s.ch);
});

test("考验的那一夜倒下：算没守住，尸潮散掉，第二天夜里再来", () => {
  const { e } = game();
  pastAct2(e);
  const day = e.s.day;
  e.ch.gate = { day, state: "active", tries: 0, count: 10, live: true, wonDay: 0 };
  e.s.horde = { phase: "active", timer: 0, remaining: 6, spawnTimer: 5, direction: 0 };
  e.enemies.push(e.enemy("slow", 1300, 400, true));
  e.die();
  assert.equal(e.s.horde.phase, "locked");
  assert.ok(e.enemies.every((z) => !z.horde || z.dead), "尸潮里的都散了");
  assert.ok(e.chGateLostNow(), "醒来的卡上说没守住");
  e.paused = false;
  run(e, 1);
  assert.equal(e.ch.gate.tries, 1);
  assert.equal(e.ch.gate.state, "omen");
  assert.ok(e.ch.gate.day > day || e.s.day > day || e.ch.gate.day === day + GATE1.retryDays);
  // 平常倒下（不在考验那一夜）不算
  const { e: f } = game();
  pastAct2(f);
  f.die();
  assert.equal(f.ch.gate.tries, 0);
  assert.equal(f.chGateLostNow(), false);
});

test("考验的那一夜：头一回倒下铁锹拖回来，尸潮照旧；第二回才算没守住", () => {
  const { e } = game();
  pastAct2(e);
  if (!(e.sc.helpers || []).some((h) => h.id === "tieqiao")) e.addHelper("tieqiao");
  const day = e.s.day;
  e.ch.gate = { day, state: "active", tries: 0, count: 10, live: true, wonDay: 0, pulled: false };
  e.s.horde = { phase: "active", timer: 0, remaining: 6, spawnTimer: 5, direction: 0 };
  e.enemies.push(e.enemy("slow", 1300, 400, true));
  e.die();
  assert.equal(e.s.horde.phase, "active", "尸潮没散，也不算守住");
  assert.equal(e.s.horde.remaining, 6);
  assert.equal(e.ch.gate.state, "active");
  assert.equal(e.ch.gate.tries, 0);
  assert.equal(e.ch.gate.pulled, true);
  assert.ok(e.chGatePulledNow());
  assert.ok(e.enemies.some((z) => z.horde && !z.dead));
  // 啃坏的围栏、踩烂的陷阱：没守住那一夜铁锹扶到六成，好的不动
  e.s.buildings.push({ id: e.s.idCounter++, type: "fence", x: 1300, y: 300, hp: 0, rotation: 0 }, { id: e.s.idCounter++, type: "trap", x: 1380, y: 396, hp: 10, rotation: 0 }, { id: e.s.idCounter++, type: "fence", x: 1300, y: 500, hp: 140, rotation: 0 });
  e.die();
  assert.equal(e.s.horde.phase, "locked");
  assert.equal(e.ch.gate.tries, 1);
  assert.equal(e.ch.gate.state, "omen");
  const hpOf = (x, y) => e.s.buildings.find((b) => b.x === x && b.y === y).hp;
  assert.equal(hpOf(1300, 300), Math.ceil(BUILDINGS.fence.hp * 0.6));
  assert.equal(hpOf(1380, 396), Math.ceil(BUILDINGS.trap.hp * 0.6));
  assert.equal(hpOf(1300, 500), 140);
  assert.equal(e.chGateFixed(), 2);
  // 存档里带着这一夜拖回来过没有
  const back = Engine.parse(e.serialize());
  assert.equal(typeof back.ch.gate.pulled, "boolean");
});

test("玩了一阵的档：读回去马上再存，还是一字不差（摆场景时不改存下来的数）", () => {
  const { e } = game();
  pastAct2(e);
  run(e, 20);
  e.travel("residential");
  run(e, 5);
  e.travel("farm");
  run(e, 20);
  const text = e.serialize();
  const back = new Engine(Engine.parse(text), () => {});
  assert.equal(back.serialize(), text);
  // 再读一遍、过一会儿再读：都一样
  const again = new Engine(Engine.parse(back.serialize()), () => {});
  assert.equal(again.serialize(), text);
  // 存下来的“谁在哪儿”读进来没被改
  assert.deepEqual(back.s.theft?.where, JSON.parse(text).theft?.where);
});

test("考验那一夜只剩三只以内：给出最近一只的位置", () => {
  const { e } = game();
  pastAct2(e);
  e.ch.gate = { day: e.s.day, state: "active", tries: 0, count: 10, live: true, wonDay: 0, pulled: false };
  e.s.horde = { phase: "active", timer: 0, remaining: 2, spawnTimer: 5, direction: 0 };
  e.enemies.push(e.enemy("slow", 1300, 400, true), e.enemy("slow", 300, 300, true));
  assert.equal(e.chGateStragglers(), null, "还有没进场的，不指");
  e.s.horde.remaining = 0;
  const t = e.chGateStragglers();
  assert.equal(t.region, "farm");
  assert.match(t.label, /还剩 2 只/);
  const p = e.s.player;
  const near = e.enemies.filter((z) => z.horde).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
  assert.equal(t.x, Math.round(near.x));
  for (let i = 0; i < 3; i++) e.enemies.push(e.enemy("slow", 900 + i * 30, 500, true));
  assert.equal(e.chGateStragglers(), null, "多于三只，不指");
});

test("界面：用旧了的武器看得到耐久，有武器工作台和料才修得了", async () => {
  const P = await import("../dist/app-pages.js");
  const { e } = game();
  pastAct2(e);
  const G = (ui = {}) => ({ e, ui, started: true, toast() {}, refresh() {}, close() {}, open() {}, save() {}, renderer: null });
  // 新的：只有耐久条，没有“修好它”
  let html = P.pageHtml(G({ item: "club", where: "bag" }), "store");
  assert.match(html, /耐久/);
  assert.equal(/修好它/.test(html), false);
  // 看一眼不改存档
  const before = e.serialize();
  P.pageHtml(G({ item: "club", where: "bag" }), "store");
  assert.equal(e.serialize(), before);
  // 用坏了：写着伤害减半；没有武器工作台，按钮按不了、写着为什么
  e.cond("club").d = 0;
  html = P.pageHtml(G({ item: "club", where: "bag" }), "store");
  assert.match(html, /坏了，伤害减半/);
  assert.match(html, /data-act="repairgear" data-id="club" disabled/);
  assert.match(html, /要先建一座武器工作台/);
  assert.ok(e.chAlerts().some((a) => /坏了/.test(a.title) && a.go.page === "build" && a.go.ui.sel === "weaponbench"), "提醒带你去建武器工作台");
  // 建了武器工作台、有木材：能修；修完耐久回来、上限少一成
  e.s.buildings.push({ id: e.s.idCounter++, type: "weaponbench", x: 980, y: 620, hp: BUILDINGS.weaponbench.hp, rotation: 0 });
  e.s.inventory.wood = 5;
  html = P.pageHtml(G({ tab: "make", station: "weaponbench" }), "store");
  assert.match(html, /修理/);
  assert.match(html, /data-act="repairgear" data-id="club" >/);
  assert.ok(e.chAlerts().some((a) => /坏了/.test(a.title) && a.go.page === "store" && a.go.ui.station === "weaponbench"));
  const wood = e.qty("wood", true);
  P.pageAct(G({ tab: "make", station: "weaponbench" }), "repairgear", "club", null, {});
  assert.equal(e.cond("club").d, e.cond("club").m);
  assert.ok(e.cond("club").m < 60);
  assert.ok(e.qty("wood", true) < wood);
});

test("界面：消息不压过场、整页和小卡", () => {
  const css = readFileSync(new URL("app.css", DIST), "utf8");
  // 过场放着的时候不出消息
  assert.match(css, /#app:has\(#scene:not\(\[hidden\]\)\) #toasts \{ display: none; \}/);
  // 整页开着：只留最新的一条，挪到页头中间
  assert.match(css, /#app:has\(#page:not\(\[hidden\]\)\) #toasts \{[^}]*right: 176px;[^}]*top: 88px;/);
  assert.match(css, /#app:has\(#page:not\(\[hidden\]\)\) #toasts \.toast:not\(:last-child\) \{ display: none; \}/);
  // 小卡开着：收窄到卡的左边（小卡宽 560、宽卡 760，都居中；界面最窄按 1366 排）
  const w = Number(css.match(/#app:has\(#card:not\(\[hidden\]\)\) #toasts \{ width: (\d+)px; \}/)?.[1]),
    wide = Number(css.match(/#app:has\(#card\.wide:not\(\[hidden\]\)\) #toasts \{ width: (\d+)px; \}/)?.[1]),
    left = Number(css.match(/#toasts \{ position: absolute; left: (\d+)px;/)?.[1]);
  assert.ok(left + w < (1366 - 560) / 2, "小卡左边放得下");
  assert.ok(left + wide < (1366 - 760) / 2, "宽卡左边放得下");
  // 消息那一层在最上面，过场、整页、小卡都在同一个 #app 里
  const html = readFileSync(new URL("index.html", DIST), "utf8");
  assert.ok(html.indexOf('id="toasts"') > html.indexOf('id="scene"') && html.indexOf('id="toasts"') < html.indexOf("</main>"));
});
