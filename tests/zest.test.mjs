// v0.32.0「手感」：提示分三档（日常小事头顶飘字、一遍田记一行；大事卡片）、教三次的操作说明、按住交互连做、
// 送礼和交清单的反馈、第一次钓到的鱼、余烬核卡片、早间广播进任务手记、手机上的说法、存档。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Engine, freshState, needsUpgrade as needsStoryMigration } from "../dist/ahead.js";
import * as Relight from "../dist/relight.js";
import { ITEMS, CROPS } from "../dist/data.js";
import { LISTS, WALL_LISTS, CORES } from "../dist/relight-data.js";
import { FISH_IDS } from "../dist/kin-data.js";
import { TEACH_TIMES, HOLD, ROUTINE, PLAIN, MOMENT_KINDS, INTRO_LINES } from "../dist/zest-data.js";
import { SFX, STINGERS, soundFor, ZEST_SOUND_EVENTS, MOMENT_SOUND } from "../dist/audio-data.js";

const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const make = (state = freshState(), seed = 32001) => {
  const toasts = [];
  if (state.undertow) state.undertow.seed = seed;
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  if (e.dy) e.dy.pending = null;
  return { e, toasts };
};
const said = (toasts, re) => toasts.some((t) => re.test(t.text));
const moments = (e, kind) => e.events.filter((x) => x.type === "moment" && (!kind || x.kind === kind));
const go = (e, region, x = 768, y = 512) => {
  e.s.visited = { ...(e.s.visited || {}), [region]: true };
  e.s.region = region;
  e.enemies = e.s.enemies[region] ||= [];
  e.assignRegion();
  Object.assign(e.s.player, { x, y });
};
const stock = (e, items) => {
  for (const [id, n] of Object.entries(items)) e.s.storage[id] = (e.s.storage[id] || 0) + n;
};
// 一排熟了的萝卜（农场最上面那排）
function ripeRow(e, n = 9) {
  go(e, "farm");
  const row = e.s.plots
    .filter((p) => e.isFarmPlot(p))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, n);
  for (const p of row) Object.assign(p, { tilled: true, crop: "radish", growth: CROPS.radish.grow, wateredDay: e.s.day });
  e.s.debris = [];
  return row;
}
function station(e) {
  go(e, "farm", 830, 600);
  for (const [id, n] of Object.entries({ wood: 20, stone: 12, scrap: 8 })) e.s.inventory[id] = (e.s.inventory[id] || 0) + n;
  assert.ok(e.startBuild("rlStation"));
  e.buildMode = "rlStation";
  for (const y of [640, 700, 760, 820, 580])
    for (let x = 220; x <= 1340; x += 40) {
      Object.assign(e.s.player, { x, y: y - 60 });
      if (!e.buildReason("rlStation", x, y)) {
        assert.ok(e.placeBuilding(x, y));
        const b = e.rlStationB();
        Object.assign(e.s.player, { x: b.x, y: b.y + 50 });
        return b;
      }
    }
  throw new Error("no room for the station");
}

test("notices sort into three tiers: the player's own farm work floats over the head and the pass is one line; background work says nothing", () => {
  const { e, toasts } = make();
  e.s.day = 9;
  const row = ripeRow(e, 4);
  Object.assign(e.s.player, { x: row[0].x, y: row[0].y + 20 });
  const f0 = e.effects.length;
  e.interact();
  assert.ok(!said(toasts, /收获/), "no harvest line in the bar");
  assert.ok(e.effects.length > f0, "a float over the plot");
  // 种下（从田的页面里点，也算自己动手）：飘“种下…”，不进提示栏
  const p = row[0];
  assert.ok(!p.crop);
  e.s.inventory.seedPotato = 3;
  e.paused = true;
  assert.ok(e.plantSeed(p.id, "seedPotato"));
  e.paused = false;
  assert.ok(e.effects.some((x) => x.text === "种下土豆"));
  assert.ok(!said(toasts, /种下土豆/));
  // 停手一会儿：这一遍田记一行
  e.advanceMinutes(10);
  const line = toasts.find((t) => /^这一遍田：/.test(t.text));
  assert.ok(line, "one summary line");
  assert.match(line.text, /收了 萝卜 ×\d+/);
  assert.match(line.text, /种下 1 块/);
  assert.equal(line.tone, "normal");
  // 在背后发生的（不是自己按的）：连飘字也没有
  const f1 = e.effects.length,
    n1 = toasts.length;
  e.toast("照看了萝卜 · 照料分 60");
  assert.equal(e.effects.length, f1);
  assert.equal(toasts.length, n1);
  // 页面开着：照常进提示栏（头顶的字看不见），但不是金色
  e.paused = true;
  e.toast("萝卜收获 · 肥力58 · 优质收成", "gold");
  assert.equal(toasts.at(-1).tone, "normal");
});

test("routine rules: every routine pattern is either dropped, floated or tallied; plain ones keep the bar but lose the gold", () => {
  const { e, toasts } = make();
  go(e, "farm");
  const cases = [
    ["鸡蛋与羊奶已领取。", "鸡蛋、羊奶 +1"],
    ["捡到 野莓 2。", "捡到 野莓 2"],
    ["到达 余烬农场", "余烬农场"],
    ["浇水壶已补满 · 24格水", "水壶满了"],
    ["从腌缸里取出 老坛腌菜 4。", "老坛腌菜 4"],
    ["手气旺：咬钩的是一条金尾夜鱼！", "手气旺：金尾夜鱼"],
  ];
  for (const [text, float] of cases) {
    const n = toasts.length;
    e.toast(text, "gold");
    assert.equal(toasts.length, n, text);
    assert.equal(e.effects.at(-1).text, float, text);
  }
  for (const text of ["第 3 天 · 晴朗 · 恢复体力", "机床今天做了1批零件：机械零件×1，已入仓。", "已收复区域 · 威胁降低，路途节省10分钟。"]) {
    const n = toasts.length,
      f = e.effects.length;
    e.toast(text);
    assert.equal(toasts.length, n, text);
    assert.equal(e.effects.length, f, text);
  }
  for (const text of ["许医生挑出 5 朵有毒的（灰盖、白伞），剩下 4 朵能吃（平菇、鸡枞）。", "秦奶奶在营门口敲门，想借宿一晚（23:00 前答复）。"]) {
    e.toast(text, "gold");
    assert.equal(toasts.at(-1).text, text);
    assert.equal(toasts.at(-1).tone, "normal", text);
  }
  // 重建站交一格：页面上看得见（数字、盖章、那一格闪），提示栏里不再一格一行；没开页面时头顶飘一下
  const n0 = toasts.length;
  e.toast("交了木材 ×5（「教室」5/27）。", "gold");
  assert.equal(toasts.length, n0);
  assert.equal(e.effects.at(-1).text, "交了木材 ×5（5/27）");
  e.paused = true;
  e.toast("交了木材 ×2（「教室」7/27）。", "gold");
  e.paused = false;
  assert.equal(toasts.length, n0);
  // 警告照常
  e.toast("乌鸦啄了 3 块熟了的菜（每块少收 1 份）。", "warn");
  assert.equal(toasts.at(-1).tone, "warn");
  assert.ok(ROUTINE.length >= 15 && PLAIN.length >= 8);
});

test("the same line again within 45 s only floats (numbers aside); gold lines and open pages are not folded", () => {
  const { e, toasts } = make();
  go(e, "farm");
  e.s.playSeconds = 100;
  e.toast("尖叫声从远处又引来了 3 只感染者", "warn");
  e.s.playSeconds = 120;
  e.toast("尖叫声从远处又引来了 2 只感染者", "warn");
  assert.equal(toasts.filter((t) => /尖叫声/.test(t.text)).length, 1);
  assert.match(e.effects.at(-1).text, /^尖叫声从远处又引来了 2 只/);
  e.s.playSeconds = 200;
  e.toast("尖叫声从远处又引来了 4 只感染者", "warn");
  assert.equal(toasts.filter((t) => /尖叫声/.test(t.text)).length, 2, "after 45 s it is a new line");
  for (let i = 0; i < 2; i++) e.toast("锁着的铁柜：弹药 ×2（稀有）", "gold");
  assert.equal(toasts.filter((t) => /锁着的铁柜/.test(t.text)).length, 2, "gold is never folded");
  e.paused = true;
  for (let i = 0; i < 2; i++) e.toast("背包已满，请把材料存入仓库。", "warn");
  assert.equal(toasts.filter((t) => /背包已满/.test(t.text)).length, 2, "a page is open: nothing floats over it");
});

test("teaching lines are shown three times, then only the float (bite) or nothing (cast); the count is saved", () => {
  const { e, toasts } = make();
  go(e, "farm");
  const bite = "咬钩了！按住 E（手机按住「交互」）收线，鱼一挣就松手。";
  for (let i = 0; i < TEACH_TIMES + 2; i++) e.toast(bite, "gold");
  assert.equal(toasts.filter((t) => t.text === bite).length, TEACH_TIMES);
  assert.equal(e.effects.at(-1).text, "咬钩了！");
  for (let i = 0; i < TEACH_TIMES + 2; i++) e.toast("鱼线已抛出 · 出现“咬钩”时按 E！");
  assert.equal(toasts.filter((t) => /鱼线已抛出/.test(t.text)).length, TEACH_TIMES);
  const back = Engine.parse(e.serialize());
  assert.equal(back.zest.taught.bite, TEACH_TIMES);
  assert.equal(back.zest.taught.cast, TEACH_TIMES);
});

test("big moments: a level, a wall, a boss and precious loot come up as a card above the scene instead of a gold line", () => {
  const { e, toasts } = make();
  go(e, "farm");
  e.s.xp.agriculture = 0;
  e.xp("agriculture", 45);
  const lv = moments(e, "level").at(-1);
  assert.ok(lv);
  assert.equal(lv.title, "农业 Lv.2");
  assert.ok(lv.lines.some((l) => /三级起每株收成/.test(l)));
  assert.ok(!said(toasts, /升至 Lv/));
  e.toast("打赢了大块头（第一次，奖励翻倍）：机械零件 ×4。战利品可以捐给档案馆", "gold");
  const boss = moments(e, "boss").at(-1);
  assert.equal(boss.title, "打赢了大块头");
  assert.match(boss.lines[0], /第一次，奖励翻倍/);
  // 柜子：珍贵登场、稀有照旧金色、普通只飘一下
  for (const [tier, kind] of [
    ["precious", "big"],
    ["rare", "gold"],
    ["common", "float"],
  ]) {
    e._uLoot = { name: "急救箱", bundle: { bandage: 2 }, tier };
    const n = toasts.length,
      m = moments(e).length;
    e.toast("急救箱：绷带 ×2" + (tier === "precious" ? "（珍贵）" : tier === "rare" ? "（稀有）" : ""), "gold");
    if (kind === "big") assert.equal(moments(e, "precious").at(-1).title, "珍贵！急救箱");
    if (kind === "gold") assert.equal(toasts.at(-1).tone, "gold");
    if (kind === "float") {
      assert.equal(toasts.length, n);
      assert.equal(moments(e).length, m);
      assert.equal(e.effects.at(-1).text, "绷带 ×2");
    }
  }
  e._uLoot = null;
  for (const ev of moments(e)) assert.ok(MOMENT_KINDS[ev.kind], ev.kind);
});


test("a core is one card with its monologue and the new caps (the old small card is folded in)", () => {
  const { e, toasts } = make();
  go(e, "farm");
  e.events.length = 0;
  assert.ok(e.grantCore("harvest"));
  const c = moments(e, "core").at(-1);
  assert.equal(c.title, "余烬核 · " + CORES.harvest.name);
  assert.ok(c.lines.some((l) => /体力上限 \+15、生命上限 \+5/.test(l)));
  assert.ok(!e.events.some((x) => x.type === "ledger" && /余烬核/.test(x.title)));
  assert.ok(e.events.some((x) => x.type === "rlCore"), "the core's own sound stays");
  assert.ok(!said(toasts, /拿到一颗余烬核/));
});

test("the first catch of a kind of fish is a card; the next one only floats", () => {
  const { e, toasts } = make();
  go(e, "valley", 700, 500);
  e.kin.cast = { water: "river" };
  const land = () => {
    e._reel = { water: "river", sp: "kinMinnow", tier: "common", bait: false, biteAt: 2 };
    return e.reelLand();
  };
  assert.ok(land());
  const f = moments(e, "fish").at(-1);
  assert.equal(f.title, "新鱼：" + ITEMS.kinMinnow.name);
  assert.match(f.lines[0], new RegExp("鱼类图鉴 1/" + FISH_IDS.length));
  assert.ok(!said(toasts, /钓到马口鱼/));
  const m = moments(e, "fish").length;
  e.kin.cast = { water: "river" };
  assert.ok(land());
  assert.equal(moments(e, "fish").length, m);
  assert.ok(e.effects.some((x) => /^钓到马口鱼/.test(x.text)));
});

test("a gift shows a face over the person and makes a sound by how much they like it", () => {
  const { e, toasts } = make();
  toAct(e, 8);
  e.recruit("medic");
  const P = prefsOf("medic");
  const w = e.whereNow("medic");
  go(e, w.region, w.x, w.y);
  const seen = {};
  for (const [item, cat] of [
    [P.fav[1], "fav"],
    [P.hate[0], "hate"],
  ]) {
    if (cat === "hate") {
      e.s.day += 7;
      const w2 = e.whereNow("medic");
      go(e, w2.region, w2.x, w2.y);
    }
    stock(e, { [item]: 1 });
    e.events.length = 0;
    assert.equal(e.giftReason("medic", item), "", "can give " + item);
    assert.ok(e.giveGift("medic", item));
    const ev = e.events.find((x) => x.type === "gift");
    assert.equal(ev?.cat, cat);
    assert.ok(SFX[soundFor(ev).sfx]);
    seen[cat] = e.effects.at(-1).text;
  }
  assert.match(seen.fav, /^♥♥ 信任 \+2$/);
  assert.match(seen.hate, /^✗ 信任 -1$/);
  assert.ok(said(toasts, /送给/), "the line about the gift is still said");
});

test("hold interact to keep going: walking along a row harvests, replants the last seed and waters without more presses", () => {
  const { e, toasts } = make();
  e.s.day = 9;
  const row = ripeRow(e, 9);
  e.s.storage.seedRadish = 20;
  e.s.seed = "seedRadish";
  e.c.water = 24;
  Object.assign(e.s.player, { x: row[0].x, y: row[0].y + 20 });
  e.interact();
  for (let step = 0; step < 360; step++) {
    const target = row[Math.min(row.length - 1, Math.floor(step / 40))];
    e.s.player.x += Math.sign(target.x - e.s.player.x) * Math.min(4, Math.abs(target.x - e.s.player.x));
    e.update(0.05, { hold: true });
  }
  e.update(0.05, {});
  assert.ok(row.every((p) => p.crop === "radish" && p.growth < CROPS.radish.grow), "harvested and replanted");
  // v0.42 删繁：照看去掉了，按住一路是收、种、浇
  assert.ok(row.every((p) => e.plotWatered(p)), "watered");
  assert.ok(e.zx.stats.holds >= 1 && e.zx.stats.holdActs >= 20);
  // 一路做下来只记一行
  for (let i = 0; i < 100; i++) e.update(0.05, {});
  assert.equal(toasts.filter((t) => /^这一遍田：/.test(t.text)).length, 1);
  // 不按住：什么也不做；钓鱼时按住是收线，不碰田
  const before = JSON.stringify(row.map((p) => p.growth));
  for (let i = 0; i < 40; i++) e.update(0.05, {});
  e.c.fishing = { phase: "wait", elapsed: 0, biteAt: 9 };
  for (let i = 0; i < 40; i++) e.update(0.05, { hold: true });
  e.c.fishing = null;
  assert.ok(HOLD.after > 0.2 && HOLD.every < 0.3);
  assert.ok(before.length > 0);
});

test("the plot hint tells about holding until it has been used three times", () => {
  const { e } = make();
  e.s.day = 9;
  const [p] = ripeRow(e, 1);
  assert.match(e.plotContext(p), /按住 E 一路做下去/);
  e.zx.taught.hold = TEACH_TIMES;
  assert.doesNotMatch(e.plotContext(p), /按住/);
});







test("sounds: gift, stamp and the wall, fish and first-harvest phrases exist", () => {
  for (const type of ZEST_SOUND_EVENTS) for (const cat of ["fav", "like", "meh", "hate"]) assert.ok(SFX[soundFor({ type, cat }).sfx], type + cat);
  for (const k of ["wall", "fish", "harvest"]) assert.ok(STINGERS[MOMENT_SOUND[k].stinger], k);
  assert.equal(soundFor({ type: "moment", kind: "level" }), null, "a level already has its own sound");
});


test("saves: the new field is kept, checked and old saves get a checkpoint and a one-time card", () => {
  const { e } = make();
  const text = e.serialize();
  const back = Engine.parse(text);
  assert.deepEqual(Object.keys(back.zest).sort(), ["moments", "radio", "schema", "stats", "taught"]);
  // 坏了拒收
  const bad = JSON.parse(text);
  bad.zest.taught.bite = -1;
  assert.throws(() => Engine.parse(JSON.stringify(bad)), /手感/);
  const bad2 = JSON.parse(text);
  bad2.zest.radio = { day: 1, text: "x".repeat(500) };
  assert.throws(() => Engine.parse(JSON.stringify(bad2)), /手感/);
  // v0.31 的存档：读进来以前留检查点，第一帧一张卡片，只说一次
  const old = new Relight.Engine(Relight.freshState(), () => {});
  const oldText = old.serialize();
  assert.ok(!JSON.parse(oldText).zest);
  assert.equal(needsStoryMigration(oldText), true);
  assert.equal(needsStoryMigration(text), false);
  const { e: o } = make(Engine.parse(oldText));
  o.update(0.016, {});
  // v0.33 起旧档还会接着来一张“盼头”的卡片（各一张、各说一次）
  const mine = () => moments(o, "intro").filter((m) => m.title === "手感");
  const intro = mine();
  assert.equal(intro.length, 1);
  assert.deepEqual(intro[0].lines, INTRO_LINES);
  o.update(0.016, {});
  assert.equal(mine().length, 1);
  const again = Engine.parse(o.serialize());
  assert.equal(again.zest.intro.told, true);
});

// ================= 九个核心动作：每样至少有声音、画面、数字里的两样（体检方案第 5 条） =================
import { TASKS } from "../dist/rebuild-data.js";
import { prefsOf } from "../dist/kin-data.js";
import { SHAFT } from "../dist/relight.js";
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
// 做一件事，看它有没有声音（事件配得上音效）、画面（飘字、粒子、闪光、卡片、顿帧、来了一群）、数字（字里有数）
function feedback(e, toasts, fn) {
  const ev0 = e.events.length,
    fx0 = e.effects.length,
    pt0 = e.particles.length,
    fl0 = e.ux?.flashes?.length || 0,
    t0 = toasts.length,
    foes0 = e.enemies.filter((z) => !z.dead).length,
    stamp0 = e._zStamp?.at || 0;
  e.fx && (e.fx.hitstop = 0);
  fn();
  const evs = e.events.slice(ev0),
    floats = e.effects.slice(fx0).map((x) => String(x.text || "")),
    lines = toasts.slice(t0).map((t) => t.text),
    cards = evs.filter((v) => v.type === "moment");
  const sound = evs.some((v) => {
    const s = soundFor(v);
    return !!s && (!!SFX[s.sfx] || !!STINGERS[s.stinger]);
  });
  const picture = floats.length > 0 || e.particles.length > pt0 || (e.ux?.flashes?.length || 0) > fl0 || cards.length > 0 || (e.fx?.hitstop || 0) > 0 || e.enemies.filter((z) => !z.dead).length > foes0 || (e._zStamp?.at || 0) > stamp0;
  const number = [...floats, ...lines, ...cards.flatMap((c) => [c.title, ...c.lines])].some((s) => /\d/.test(s));
  return { sound, picture, number, n: sound + picture + number, said: [...floats, ...lines].slice(0, 4).join(" | "), types: evs.map((v) => v.type).join(",") };
}
test("nine core actions each answer with at least two of a sound, something on screen and a number", () => {
  const out = {};
  // 种地：收一块熟了的萝卜，停手后那一行账
  {
    const { e, toasts } = make();
    e.s.day = 9;
    const [p] = ripeRow(e, 1);
    Object.assign(e.s.player, { x: p.x, y: p.y + 20 });
    out.种地 = feedback(e, toasts, () => {
      e.interact();
      e.advanceMinutes(10);
    });
  }
  // 搜废墟：居民区路边那只箱子
  {
    const { e, toasts } = make();
    e.s.day = 5;
    e.s.minute = 600;
    e.s.region = "residential";
    e.s.enemies.residential = null;
    e.assignRegion();
    e.update(0.016, { x: 0, y: 0 });
    for (const z of e.enemies) z.dead = true;
    e.enemies = e.s.enemies.residential = [];
    const road = e.objects.find((o) => o.id === "residential-road");
    Object.assign(e.s.player, { x: road.x, y: road.y + 4 });
    out.搜废墟 = feedback(e, toasts, () => {
      e._picked = road;
      e.openContainer(road);
      e._picked = null;
    });
  }
  // 战斗：手上的家伙打一只感染者
  {
    const { e, toasts } = make();
    go(e, "residential");
    e.update(0.016, { x: 0, y: 0 });
    e.s.slot = 3;
    const z = e.enemy("slow", e.s.player.x + 40, e.s.player.y);
    e.enemies.push(z);
    Object.assign(z, { hp: 500, maxHp: 500 });
    e.cooldown = 0;
    e.fx.lastStop = -9;
    out.战斗 = feedback(e, toasts, () => assert.ok(e.attack(z)));
    assert.ok(z.hp < 500, "the swing landed");
  }
  // 建造：放下重建站
  {
    const { e, toasts } = make();
    let placed = null;
    out.建造 = feedback(e, toasts, () => (placed = station(e)));
    assert.ok(placed);
  }
  // 交清单：交一格
  {
    const { e, toasts } = make();
    station(e);
    const L = WALL_LISTS.water[0],
      [key, n] = LISTS[L].need[0];
    stock(e, { [key.startsWith("@") ? "alDecor_teddy" : key]: Math.max(1, n - 1) });
    out.交清单 = feedback(e, toasts, () => assert.ok(e.rlDeliver(L, key)));
  }
  // 送礼：当面送许医生她最爱的东西
  {
    const { e, toasts } = make();
    toAct(e, 8);
    e.recruit("medic");
    const P = prefsOf("medic");
    stock(e, { [P.fav[1]]: 2 });
    const w = e.whereNow("medic");
    go(e, w.region, w.x, w.y);
    out.送礼 = feedback(e, toasts, () => assert.ok(e.giveGift("medic", P.fav[1])));
  }
  // 钓鱼：第一次钓到马口鱼，再钓一条
  {
    const { e, toasts } = make();
    go(e, "valley", 700, 500);
    const land = () => {
      e.kin.cast = { water: "river" };
      e._reel = { water: "river", sp: "kinMinnow", tier: "common", bait: false, biteAt: 2 };
      return e.reelLand();
    };
    out.钓鱼 = feedback(e, toasts, () => assert.ok(land()));
    out["钓鱼（第二条）"] = feedback(e, toasts, () => assert.ok(land()));
  }
  // 守长夜：主线打完以后第一个长夜，22:00 那一声
  {
    const { e, toasts } = make();
    toAct(e, 9);
    Object.assign(e.s, { day: 30, minute: 600 });
    e.c.workClock = 0;
    e.s.stats.hordes = 6;
    e.s.horde = { phase: "won", timer: 0, remaining: 0, spawnTimer: 0, direction: 0 };
    e.c.nextHordeDay = 50;
    e.dy.pending = null;
    go(e, "farm");
    e.update(0.016, { x: 0, y: 0 });
    Object.assign(e.s, { day: 38, minute: 1319 });
    e.c.workClock = 1319 % 60;
    out.守长夜 = feedback(e, toasts, () => {
      for (let t = 0; t < 30; t += 0.05) {
        e.invulnerable = 5;
        e.s.player.hp = 100;
        e.update(0.05, { x: 0, y: 0 });
      }
    });
    assert.ok(e.ln.night, "the night started");
  }
  // 下隧道：顺着检修梯下一层
  {
    const { e, toasts } = make();
    toAct(e, 8);
    e.sc.act = 9;
    e.sc.claimed = [...new Set([...e.sc.claimed, "act3", "act4", "act5", "act6", "act7", "act8"])];
    e.sc.letters = [...new Set([...e.sc.letters, "act3", "act4", "act5", "act6", "act7", "act8", "act9"])];
    e.b.unlocked.shelter = true;
    e.b.points.shelter_lift = e.bpoint("shelter_lift");
    e.b.points.shelter_lift.flags.repair = true;
    go(e, "shelter", SHAFT.x, SHAFT.y);
    assert.ok(e.tunnelEnter(1));
    for (const z of e.enemies) z.dead = true;
    const lad = e.tunnelLayoutNow().ladders[0];
    Object.assign(e.s.player, { x: lad.x, y: lad.y, stamina: 100 });
    out.下隧道 = feedback(e, toasts, () => assert.ok(e.tunnelDown()));
  }
  const weak = Object.entries(out).filter(([, r]) => r.n < 2);
  assert.deepEqual(weak.map(([k, r]) => k + " " + JSON.stringify(r)), [], "every action has two kinds of feedback");
  // 原来最薄的两样：送礼（0 样）、交清单（1 样）现在都是三样
  assert.equal(out.送礼.n, 3, JSON.stringify(out.送礼));
  assert.equal(out.交清单.n, 3, JSON.stringify(out.交清单));
  if (process.env.ZEST_FEEDBACK) console.log(JSON.stringify(out, null, 1));
});

test("a new game starts without the one-time card and the first harvest is its own small moment", () => {
  const { e } = make();
  e.update(0.016, {});
  assert.equal(moments(e, "intro").length, 0);
  e.s.day = 2;
  e.s.milestones = {};
  const [p] = ripeRow(e, 1);
  Object.assign(e.s.player, { x: p.x, y: p.y + 20 });
  e.interact();
  const h = moments(e, "harvest");
  assert.equal(h.length, 1);
  assert.match(h[0].lines[0], /萝卜 \+\d+/);
});
