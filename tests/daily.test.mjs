import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState } from "../dist/ahead.js";
import { Engine as FarEngine, freshState as farFresh } from "../dist/farlands.js";
import { TASKS } from "../dist/rebuild-data.js";
import { ITEMS, CROPS } from "../dist/data.js";
import { EVENTS, EVENT_IDS, CHAINS, PERKS, BUFFS, CATS, NEWBIE_DAYS } from "../dist/daily-data.js";
import { CACHE_SPOTS } from "../dist/daily.js";

const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
// v0.19 的妙手卡另加了 6 个动作（rumor thiefXp confess clearCase blame giveTreasure）；v0.24 加了打听头目（uIntel）和缝口罩（uMask）
const OPS = new Set("give money rep mood fatigue hp stamina research xp trust cheer buff later debt night drain spawn ambush cache crew perk peng dog lose water fertility growthBack harvestRipe sick heal visitor clearRuin repair rush killJob stationHit visitBlock hordeShift hordeTomorrow raidDelay raidLess raidWarn seeds seedsAll seedsOwned rareSeeds mod random time caravanDisc caravanOrder festNext talkUsed sellTop payGoods tell flag next mark rumor thiefXp confess clearCase blame giveTreasure bp fixGear gear uIntel uMask tIntel".split(" "));
const make = (state = freshState()) => {
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  return { e, toasts };
};
const go = (e, region) => {
  if (e.s.region !== region) {
    e.s.region = region;
    e.enemies = e.s.enemies[region] ||= [];
    e.assignRegion();
  }
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
const stock = (e, items) => {
  for (const [k, v] of Object.entries(items)) e.s.storage[k] = (e.s.storage[k] || 0) + v;
};
const clear = (e, ids) => {
  for (const id of ids) {
    delete e.s.storage[id];
    delete e.s.inventory[id];
  }
};
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const btn = (action, id = "") => ({ dataset: { action, id } });
function toAct(e, n) {
  const sc = e.sc;
  sc.act = n;
  sc.claimed = ["act1", "supply", "act2", ...[3, 4, 5, 6, 7, 8].filter((k) => k < n).map((k) => "act" + k)];
  sc.choice = "ration";
  sc.letters = ["act1", "act2", ...[3, 4, 5, 6, 7, 8].filter((k) => k <= n).map((k) => "act" + k)];
  sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true;
  sc.camp = { x: 560, y: 735 };
  const last = { 1: null, 2: "farmer", 3: "table", 4: "hospitalDefense", 5: "warehouse", 6: "network", 7: "radio", 8: "broadcast", 9: "broadcast" }[n];
  e.r.claimed = last ? TASKS.slice(0, TASKS.findIndex((t) => t.id === last) + 1).map((t) => t.id) : [];
  if (n >= 4) e.o.hospital = "water";
  if (n >= 5) Object.assign(e.o, { youke: true, lathe: { mode: "parts", day: 0 } });
  if (n >= 6) Object.assign(e.o, { cargo: "food", convoy: { departs: 0, arrives: 10, escorted: true, spawned: true, foes: [], done: true, lost: false } });
  if (n >= 7) {
    e.r.radio = true;
    e.o.toll = "refuse";
    e.o.raid.phase = "won";
  }
  e.assignRegion();
}
// 直接把某个事件设成今天的卡
function setCard(e, id, rolls = [0.5, 0.5, 0.5], extra = {}) {
  e.dy.pending = { day: e.s.day, id, rolls, tier: e.tier(), luck: false, choice: null, win: null, lines: [], ...extra };
  const ev = EVENTS[id];
  if (ev.chain && !e.dy.chains[ev.chain]) {
    delete e.dy.done[ev.chain];
    e.dy.chains[ev.chain] = { step: id, due: e.s.day, flags: ["numbers", "searched"], mark: null, start: e.s.day };
  }
  return e.dy.pending;
}
const finite = (v, path = "s") => {
  if (typeof v === "number") assert.ok(Number.isFinite(v), "non-finite number at " + path);
  else if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) finite(x, path + "." + k);
};

// ---------- 数据 ----------
test("the event library holds 100 events: 9 chains with 36 steps and 64 standalone events, three options each", () => {
  // v0.19 在后面加了 7 张“妙手”卡，v0.22 又加了 6 张装备卡，v0.24 加了 3 张新感染者和头目的卡，v0.36–v0.37 加了十张十凶的传闻卡；这里数的是 v0.18 的一百张
  const BASE = EVENT_IDS.filter((id) => EVENTS[id].cat !== "thief" && !["gear", "undertow", "titan"].includes(EVENTS[id].pack));
  assert.equal(BASE.length, 100);
  assert.equal(EVENT_IDS.filter((id) => EVENTS[id].cat === "thief").length, 7);
  assert.equal(EVENT_IDS.filter((id) => EVENTS[id].pack === "gear").length, 6);
  assert.equal(EVENT_IDS.filter((id) => EVENTS[id].pack === "undertow").length, 3);
  // 十凶的传闻卡：一凶一张，名字不跟扒手那几张（T01–T07）撞
  assert.equal(EVENT_IDS.filter((id) => EVENTS[id].pack === "titan").length, 10);
  const chain = EVENT_IDS.filter((id) => EVENTS[id].chain);
  assert.equal(chain.length, 36);
  assert.equal(BASE.length - chain.length, 64);
  assert.equal(Object.keys(CHAINS).length, 9);
  for (const [c, def] of Object.entries(CHAINS)) {
    const steps = chain.filter((id) => EVENTS[id].chain === c);
    assert.ok(steps.length >= def.steps, c);
    assert.ok(steps.some((id) => EVENTS[id].step === 1), c + " has a start");
    assert.ok(steps.some((id) => EVENTS[id].step === def.steps), c + " has an ending");
  }
  assert.equal(EVENT_IDS.filter((id) => EVENTS[id].newbie).length, 13);
  const cats = {};
  for (const id of EVENT_IDS) cats[EVENTS[id].cat] = (cats[EVENTS[id].cat] || 0) + 1;
  // 装备卡：搜刮 2、交易 2、危机 1、运气 1；v0.24 的三张：危机 2、搜刮 1；十凶的十张传闻卡：危机 10
  assert.deepEqual(cats, { chain: 36, farm: 12, scav: 13, camp: 12, trade: 12, crisis: 23, luck: 11, thief: 7 });
  for (const id of EVENT_IDS) {
    const ev = EVENTS[id];
    assert.ok(CATS[ev.cat], id);
    assert.equal(ev.opts.length, 3, id);
    assert.doesNotMatch(ev.name + ev.text, FORBIDDEN, id);
    assert.ok(ev.opts.some((o) => !o.cost && !o.pay && !o.req), id + " has a free option");
    for (const o of ev.opts) {
      for (const k of Object.keys(o.cost || {})) assert.ok(ITEMS[k], id + " cost " + k);
      for (const op of [...(o.fx || []), ...(o.win || []), ...(o.lose || [])]) {
        assert.ok(OPS.has(op[0]), id + " op " + op[0]);
        if (op[0] === "give" || op[0] === "cache") for (const k of Object.keys(op[1])) assert.ok(ITEMS[k], id + " item " + k);
        if (op[0] === "next" || op[0] === "mark") assert.equal(EVENTS[op[1]]?.chain, ev.chain, id + " → " + op[1]);
        if (op[0] === "perk") assert.ok(PERKS[op[1]], id + " perk " + op[1]);
        if (op[0] === "buff") assert.ok(BUFFS[op[1]], id + " buff " + op[1]);
      }
      if (o.p) assert.ok(o.p > 0 && o.p < 1 && (o.win || o.lose), id + " gamble");
    }
    if (ev.chain && ev.step === CHAINS[ev.chain].steps) for (const o of ev.opts) assert.ok(!(o.fx || []).some((op) => op[0] === "next"), id + " ending has no next");
  }
});

// ---------- 抽卡 ----------
test("no card on day one; days 2–5 draw only newbie events; a card is fixed for the day, also after reloading", () => {
  const { e } = make();
  assert.equal(e.dailyCard(), null);
  const seen = [];
  for (let d = 2; d <= NEWBIE_DAYS; d++) {
    nextDay(e);
    const p = e.dailyCard();
    assert.ok(p, "card on day " + d);
    assert.ok(EVENTS[p.id].newbie, p.id + " is a newbie event");
    seen.push(p.id);
    const again = Engine.parse(e.serialize());
    assert.deepEqual(again.daily.pending, JSON.parse(e.serialize()).daily.pending, "reload shows the same card and rolls");
    assert.ok(e.chooseDaily(EVENTS[p.id].opts.findIndex((o) => !o.cost && !o.pay && !o.req)));
  }
  assert.equal(new Set(seen).size, seen.length, "different newbie events each day");
});



test("short materials, money or requirements refuse an option and change nothing; one choice a day", () => {
  const { e, toasts } = make();
  toAct(e, 3);
  setCard(e, "S03");
  clear(e, ["wood"]);
  assert.match(e.optionReason(1), /还缺/);
  const core = () => {
    const x = JSON.parse(e.serialize());
    delete x.echoes; // 提示记录会多一条“还缺…”
    return JSON.stringify(x);
  };
  const before = core();
  assert.equal(e.chooseDaily(1), null);
  assert.equal(core(), before);
  assert.match(toasts.at(-1).text, /还缺/);
  setCard(e, "V02");
  e.s.money = 10;
  assert.match(e.optionReason(0), /金币/);
  assert.equal(e.chooseDaily(0), null);
  setCard(e, "N02");
  e.s.buildings = e.s.buildings.filter((b) => b.type !== "coop");
  assert.match(e.optionReason(2), /鸡舍/);
  setCard(e, "J02");
  const money = e.s.money;
  assert.ok(e.chooseDaily(1));
  assert.equal(e.s.money, money + e.scaleN(50));
  assert.equal(e.chooseDaily(1), null, "no second choice");
  assert.equal(e.dailyCard(), null);
  const { e: e2 } = make(Engine.parse(e.serialize()));
  assert.equal(e2.dailyCard(), null, "reload does not bring the card back");
  assert.equal(e2.s.money, money + e.scaleN(50));
});



// ---------- 连贯事件 ----------
test("a chain walks step by step to its ending, the ending's perk works, and it never starts again", () => {
  const { e } = make();
  toAct(e, 3);
  e.s.day = 10;
  setCard(e, "C1-1");
  delete e.dy.chains.C1;
  stock(e, { bread: 5, cloth: 5, medkit: 2, bandage: 4 });
  assert.ok(e.chooseDaily(0));
  assert.equal(e.dy.chains.C1.step, "C1-2");
  assert.equal(e.dy.chains.C1.due, 13);
  for (const [step, opt] of [["C1-2", 0], ["C1-3", 0], ["C1-E", 0]]) {
    while (!(e.dailyCard()?.id === step)) {
      nextDay(e);
      if (e.dailyCard() && e.dailyCard().id !== step) e.chooseDaily(EVENTS[e.dailyCard().id].opts.findIndex((o) => !o.cost && !o.pay && !o.req));
    }
    assert.ok(e.chooseDaily(opt), step);
  }
  assert.equal(e.dy.chains.C1, undefined);
  assert.equal(e.dy.done.C1.ending, "加入种子网");
  assert.ok(e.hasPerk("seedNet"));
  while (e.s.day % 7 !== 6) nextDay(e);
  nextDay(e);
  const seeds = () => Object.entries(e.s.storage).filter(([k]) => /^seed/.test(k)).reduce((n, [, v]) => n + v, 0);
  const before = seeds();
  hour(e, 7);
  assert.equal(seeds(), before + 2);
  hour(e, 7);
  assert.equal(seeds(), before + 2, "once a week");
  assert.ok(!e.candidates(e.s.day + 1).some((c) => c.id === "C1-1"), "the chain does not restart");
});

test("a visit step leaves a marker; visiting it brings the next step the following morning", () => {
  const { e } = make();
  toAct(e, 6);
  e.s.day = 20;
  setCard(e, "C4-2");
  assert.equal(e.regionReady("warehouse"), "");
  assert.ok(e.chooseDaily(1));
  const c = e.dy.chains.C4;
  assert.ok(c.mark && c.due === null);
  go(e, "warehouse");
  const mark = e.objects.find((o) => o.type === "dailyMark");
  assert.ok(mark);
  assert.equal(e.blocked(mark.x, mark.y, false, 14), false, "marker stands on walkable ground");
  Object.assign(e.s.player, { x: mark.x, y: mark.y + 20 });
  e.interact();
  assert.equal(e.dy.chains.C4.due, 21);
  assert.ok(!e.objects.some((o) => o.type === "dailyMark"));
  nextDay(e);
  assert.equal(e.dailyCard().id, "C4-E");
});

test("chain requirements read earlier choices; at most three chains run at once", () => {
  const { e } = make();
  toAct(e, 9);
  e.s.day = 30;
  setCard(e, "C6-3");
  e.dy.chains.C6.flags = [];
  assert.match(e.optionReason(0), /记下数字/);
  e.dy.chains.C6.flags = ["numbers"];
  assert.equal(e.optionReason(0), "");
  e.dy.chains = { C1: { step: "C1-2", due: 99, flags: [], mark: null, start: 1 }, C2: { step: "C2-2", due: 99, flags: [], mark: null, start: 1 }, C3: { step: "C3-2", due: 99, flags: [], mark: null, start: 1 } };
  assert.ok(!e.candidates(31).some((c) => EVENTS[c.id].chain), "no new chain while three are running");
});

// ---------- 效果 ----------
test("buffs change growth, crafting, prices, travel and damage, and wear off", () => {
  const { e } = make();
  toAct(e, 3);
  e.s.day = 12;
  const plot = e.s.plots.find((p) => (p.region || "farm") === "farm");
  plot.crop = "radish";
  // v0.29：时节也改长势（第 12 天是酷暑，第 15 天是秋收），比的时候把它除掉
  const season = () => (e.cropSeasonRate ? e.cropSeasonRate(plot) : 1);
  const g0 = e.cropGrowthRate(plot),
    s0 = season();
  setCard(e, "J01");
  e.chooseDaily(0);
  assert.ok(Math.abs(e.cropGrowthRate(plot) - g0 * 1.5) < 1e-9);
  const p0 = e.shipPrice("radish");
  e.dy.buffs.push({ kind: "ship", from: 12, until: 12, value: 0.25 });
  assert.ok(e.shipPrice("radish") > p0, "today's price is higher");
  e.s.player.hp = 100;
  e.invulnerable = 0;
  e.damagePlayer(10);
  const plain = 100 - e.s.player.hp;
  e.dy.buffs.push({ kind: "guard", from: 12, until: 14, value: 0.3 });
  e.s.player.hp = 100;
  e.invulnerable = 0;
  e.damagePlayer(10);
  assert.ok(plain > 0 && Math.abs(100 - e.s.player.hp - plain * 0.7) < 0.01, "30% less damage");
  e.dy.buffs.push({ kind: "travel", from: 12, until: 12, value: 1 });
  go(e, "farm");
  const m = e.s.minute;
  e.travel("market");
  assert.ok(e.s.minute - m <= 2, "free travel today");
  nextDay(e);
  nextDay(e);
  nextDay(e);
  assert.ok(!e.dy.buffs.some((b) => b.kind === "guard"), "expired");
  e.s.weather = "晴朗"; // 同样的天气下（萝卜喜欢晴天）才能比
  assert.ok(Math.abs(e.cropGrowthRate(plot) / season() - g0 / s0) < 1e-9);
});

test("later gifts arrive once at 08:00; debts collect; night losses are stopped by a sentry", () => {
  const { e, toasts } = make();
  toAct(e, 3);
  e.s.day = 15;
  setCard(e, "J10");
  e.chooseDaily(1);
  nextDay(e);
  nextDay(e);
  nextDay(e);
  const parts = e.s.storage.parts || 0;
  hour(e, 8);
  assert.equal(e.s.storage.parts, parts + e.scaleN(4));
  hour(e, 8);
  assert.equal(e.s.storage.parts, parts + e.scaleN(4), "once");
  setCard(e, "D07");
  stock(e, { bread: 2 });
  e.chooseDaily(1);
  const due = e.dy.later.find((l) => l.kind === "debt").day;
  while (e.s.day < due) nextDay(e);
  clear(e, ["bread"]);
  stock(e, { bread: 3 });
  const rep = (e.c.reputation = 10);
  hour(e, 8);
  assert.equal(e.qty("bread", true), 0);
  assert.equal(e.c.reputation, rep - 2, "short repayment costs reputation");
  setCard(e, "D01");
  stock(e, { bread: 20, wood: 20 });
  e.chooseDaily(2);
  e.dy.perks.push("sentry");
  const bread = e.qty("bread", true);
  hour(e, 23);
  assert.equal(e.qty("bread", true), bread);
  assert.ok(toasts.some((t) => /守夜的人赶跑了/.test(t.text)));
});

test("infected called in by an event pay their bounty once when all are down", () => {
  const { e } = make();
  toAct(e, 3);
  go(e, "farm");
  e.s.day = 9;
  setCard(e, "D02");
  e.chooseDaily(0);
  const foes = e.enemies.filter((z) => z.daily);
  assert.equal(foes.length, 4);
  for (const z of foes) assert.equal(e.blocked(z.x, z.y, true, 13), false);
  const ammo = e.qty("ammo", true);
  for (const z of foes) z.dead = true;
  e.update(0.016, {});
  assert.equal(e.qty("ammo", true), ammo + e.scaleN(6));
  e.update(0.016, {});
  assert.equal(e.qty("ammo", true), ammo + e.scaleN(6));
});

test("today's supply point stands on open ground, opens once and is gone tomorrow", () => {
  const { e } = make();
  toAct(e, 5);
  e.s.day = 11;
  for (const [region, spot] of Object.entries(CACHE_SPOTS)) {
    go(e, region);
    assert.equal(e.blocked(spot.x, spot.y, false, 14), false, region);
    assert.ok(!e.objects.some((o) => o.type !== "dailyCache" && Math.hypot(o.x - spot.x, o.y - spot.y) < 90), region + " clear of other objects");
  }
  setCard(e, "S02");
  e.chooseDaily(0);
  const c = e.dy.caches[0];
  go(e, c.region);
  const ob = e.objects.find((o) => o.type === "dailyCache");
  Object.assign(e.s.player, { x: ob.x, y: ob.y + 20 });
  const ammo = e.qty("ammo", true);
  e.interact();
  assert.equal(e.qty("ammo", true), ammo + e.scaleN(6));
  assert.ok(!e.objects.some((o) => o.type === "dailyCache"));
  setCard(e, "S02");
  e.dy.claimed = e.dy.claimed.filter((x) => !x.startsWith("card:"));
  e.chooseDaily(0);
  nextDay(e);
  assert.equal(e.dy.caches.length, 0, "expired");
});

test("chain perks: shelter keeps residents out of raider fire, truck halves travel, smuggling lifts prices", () => {
  const { e } = make();
  toAct(e, 6);
  go(e, "farm");
  e.recruit("farmer");
  const r = e.c.residents[0];
  Object.assign(r, { x: 600, y: 600, fatigue: 0 });
  e.dy.perks.push("shelter");
  e.raidShots.push({ x: 560, y: 574, vx: 520, vy: 0, life: 0.85, damage: 8 });
  for (let i = 0; i < 10; i++) e.updateRaidShots(0.016);
  assert.equal(r.fatigue, 0);
  assert.equal(r.x, 600, "position restored");
  e.dy.perks.push("truck");
  const m = e.s.minute;
  e.travel("market");
  assert.ok(e.s.minute - m <= 11);
  const p0 = e.shipPrice("radish");
  e.dy.perks.push("smuggle");
  assert.ok(e.shipPrice("radish") >= p0);
});

// ---------- 存档 ----------
test("a v0.17 save without daily data loads unchanged and gets its first card the next morning", () => {
  const old = new FarEngine(farFresh(), () => {});
  old.s.money = 321;
  old.s.day = 9;
  const text = old.serialize();
  assert.equal(JSON.parse(text).daily, undefined);
  const { e } = make(Engine.parse(text));
  assert.equal(e.s.money, 321);
  assert.equal(e.dailyCard(), null);
  nextDay(e);
  assert.ok(e.dailyCard());
  assert.doesNotThrow(() => Engine.parse(e.serialize()));
});

test("corrupted daily fields are refused with a recoverable message", () => {
  const { e } = make();
  nextDay(e);
  const base = JSON.parse(e.serialize());
  const bad = [
    (d) => (d.schema = 7),
    (d) => (d.extra = 1),
    (d) => (d.pending = { ...d.pending, id: "Z99" }),
    (d) => (d.pending = { ...d.pending, rolls: [2, 0, 0] }),
    (d) => (d.pending = { ...d.pending, choice: 5 }),
    (d) => (d.chains = { C1: { step: "C2-2", due: 3, flags: [], mark: null } }),
    (d) => (d.perks = ["flying"]),
    (d) => (d.buffs = [{ kind: "growth", from: 5, until: 2, value: 0.1 }]),
    (d) => (d.later = [{ id: "x", day: 3, hour: 9, items: {}, money: 0, text: "", kind: "gift" }]),
    (d) => (d.caches = [{ id: "x", day: 3, region: "moon", x: 1, y: 1, items: {} }]),
    (d) => (d.claimed = ["a", "a"]),
  ];
  for (const change of bad) {
    const s = structuredClone(base);
    change(s.daily);
    assert.throws(() => Engine.parse(JSON.stringify(s)), /每日抉择存档异常|存档/);
  }
});

// ---------- 界面 ----------

// ---------- 审查后补的回归测试 ----------
const fillCrew = (e) => {
  for (const id of ["a1", "a2", "a3"]) e.addCrew({ id, name: "队员" + id, role: "carry", trait: "diligent", look: 0 });
};
test("a cleared ruin stays quiet today and tomorrow, even after the midnight refill", () => {
  const { e } = make();
  toAct(e, 4);
  e.s.day = 19;
  e.s.minute = 600;
  stock(e, { bread: 20 });
  for (const r of ["residential", "hospital", "warehouse"]) e.travel(r);
  e.travel("farm");
  nextDay(e);
  hour(e, 7);
  setCard(e, "V07");
  const r = e.chooseDaily(0);
  const id = e.dy.clear.region;
  assert.match(r.lines.join(" "), /清掉了/);
  e.travel(id);
  assert.equal(e.enemies.filter((z) => !z.dead && !z.boss && !z.nest).length, 0);
  e.travel("farm");
  nextDay(e);
  e.travel(id);
  // 险地“尸群过境”是另一件事，不算在内
  assert.equal(e.enemies.filter((z) => !z.dead && !z.boss && !z.nest && !z.hazard).length, 0, "still quiet the next day");
  e.travel("farm");
  nextDay(e);
  nextDay(e);
  assert.equal(e.dy.clear, null);
});
test("the scavenging buff adds thirty percent of what the crate really gave, never a second key item", () => {
  const { e, toasts } = make();
  toAct(e, 6);
  e.s.day = 20;
  e.s.minute = 600;
  go(e, "warehouse");
  for (const z of e.enemies) z.dead = true;
  const crate = e.objects.find((o) => o.type === "crate" && o.loot?.blueprint);
  e.dy.buffs.push({ kind: "loot", from: 20, until: 20, value: 0.3 });
  Object.assign(e.s.player, { x: crate.x, y: crate.y + 20 });
  e.interact();
  if (e._pickList?.length) e.pick(e._pickList.findIndex((o) => o.id === crate.id));
  assert.equal(e.qty("blueprint", true), 1, "one blueprint only");
  const bonus = toasts.find((t) => /运气好/.test(t.text));
  assert.ok(bonus);
  assert.doesNotMatch(bonus.text, /蓝图/);
});
test("owned perks cannot be bought twice; paved roads do not collapse", () => {
  const { e } = make();
  toAct(e, 6);
  e.s.day = 20;
  e.dy.perks = ["sentry", "road"];
  assert.equal(e.eventOk("D08"), false);
  fillCrew(e);
  setCard(e, "L03");
  assert.match(e.optionReason(1), /已经有/);
  assert.equal(e.chooseDaily(1), null);
  // 剧团驻演 + 下一次节庆加星：两颗都算
  e.dy.perks = ["festStar"];
  e.dy.flags.festNext = true;
  const stars = e.festivalStars(Object.keys(e.ss?.fest?.held || {})[0] || "harvest");
  assert.ok(stars.filter(Boolean).length >= 2 || !stars.includes(false));
});
test("ambushes only wait in the three ruins; place names never show raw ids", () => {
  const { e, toasts } = make();
  toAct(e, 9);
  e.s.day = 30;
  e.s.minute = 600;
  e.dy.ambush = 2;
  e.d.unlocked.courtyard = true;
  e.travel("courtyard");
  assert.equal(e.dy.ambush, 2, "no ambush outside the ruins");
  e.travel("farm");
  e.travel("hospital");
  assert.equal(e.dy.ambush, 0);
  assert.ok(toasts.some((t) => /刚进旧医院/.test(t.text)));
  for (const id of ["stationMarket", "shelter", "valley", "frost", "courtyard"]) assert.doesNotMatch(e.regionLabel(id), /^[a-zA-Z]+$/);
});
test("truck and road still shorten the trip for scouts", () => {
  const trip = (setup) => {
    const { e } = make();
    toAct(e, 6);
    e.s.day = 20;
    e.s.minute = 600;
    setup(e);
    const t = e.s.day * 1440 + e.s.minute;
    e.travel("hospital");
    return e.s.day * 1440 + e.s.minute - t;
  };
  const scout = (e) => (e.c.specializations.exploration = "scout");
  assert.equal(trip(scout), 10);
  assert.equal(trip((e) => (scout(e), e.dy.perks.push("truck"))), 5);
  assert.equal(trip((e) => (scout(e), e.dy.perks.push("road"))), 5);
  assert.equal(trip((e) => e.dy.perks.push("truck")), 10);
});
test("going to bed after midnight first asks for today's card; long errands never cross midnight", () => {
  const { e } = make();
  toAct(e, 3);
  e.s.day = 9;
  e.s.minute = 1000;
  stock(e, { bread: 30 });
  nextDay(e);
  e.s.minute = 120;
  go(e, "farm");
  assert.ok(e.dailyCard());
  e.events = [];
  assert.equal(e.sleep(), false);
  assert.ok(e.events.some((ev) => ev.type === "menu" && ev.view === "daily"));
  const free = EVENTS[e.dailyCard().id].opts.findIndex((o, i) => !e.optionReason(i));
  e.chooseDaily(free);
  assert.equal(e.sleep(), true);
  assert.equal(e.dy.history.filter((h) => h.day === 10).length, 1);
  // v0.38：半夜以后睡，睡到当天早上 8 点（不把第 10 天睡过去）
  assert.equal(e.s.day, 10);
  assert.equal(e.s.minute, 8 * 60);
  // 21:30 接下“你亲自跑一趟”（换一天）
  nextDay(e);
  e.s.minute = 21.5 * 60;
  setCard(e, "V08");
  e.dy.claimed = e.dy.claimed.filter((x) => !x.startsWith("card:"));
  const day = e.s.day;
  const r = e.chooseDaily(1);
  assert.equal(e.s.day, day, "still the same day");
  assert.match(r.lines.join(" "), /深夜/);
  assert.equal(e.dy.history.filter((h) => h.day === day).length, 1);
});
test("field dogs stop night theft; a closed gate keeps visitors out; dogs warn once per raid", () => {
  const { e } = make();
  toAct(e, 7);
  e.s.day = 20;
  e.dy.perks = ["fieldDogs"];
  stock(e, { bread: 10 });
  setCard(e, "L11", [0.99, 0.99, 0.99]);
  e.chooseDaily(2);
  const bread = e.stockOf("bread");
  hour(e, 23);
  assert.equal(e.stockOf("bread"), bread);
  // 封门期间的访客
  const { e: f } = make();
  toAct(f, 6);
  f.s.day = 20;
  f.applyOp(["visitBlock", 3], { flags: [] }, 1);
  f.o.visitors.current = null;
  if (f.ss) f.ss.pendingGuest = null;
  f.applyOp(["visitor", "老韩"], { flags: [] }, 1);
  assert.ok(f.o.visitors.next >= 23, "the block holds");
  // 守夜犬：同一次袭击只加一次
  const { e: g } = make();
  toAct(g, 6);
  g.s.day = 20;
  g.dy.perks = ["watchDogs"];
  const r = g.raidState();
  Object.assign(r, { phase: "warning", day: 20, timer: 60 });
  g.update(0.01);
  const t1 = r.timer;
  g.s.horde.phase = "warning";
  g.s.horde.timer = 60;
  g.update(0.01);
  assert.ok(r.timer <= t1, "the raid is not boosted again when the horde warns");
  assert.ok(g.s.horde.timer > 60 - 1);
});
test("crafted saves with prototype keys are refused", () => {
  const { e } = make();
  toAct(e, 3);
  nextDay(e);
  for (const bad of [(d) => (d.pending.id = "constructor"), (d) => d.history.push({ day: 1, id: "toString", choice: 0, win: null }), (d) => (d.perks = ["constructor"]), (d) => (d.seen = { constructor: 1 })]) {
    const raw = JSON.parse(e.serialize());
    bad(raw.daily);
    assert.throws(() => Engine.parse(JSON.stringify(raw)), /每日抉择存档异常/);
  }
});
