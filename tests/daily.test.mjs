import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState } from "../dist/campaign.js";
import { Engine as FarEngine, freshState as farFresh } from "../dist/farlands.js";
import { TASKS } from "../dist/rebuild-data.js";
import { ITEMS, CROPS } from "../dist/data.js";
import { EVENTS, EVENT_IDS, CHAINS, PERKS, BUFFS, CATS, NEWBIE_DAYS } from "../dist/daily-data.js";
import { CACHE_SPOTS } from "../dist/daily.js";
import { renderCampaignView, campaignTitle, campaignHud, handleCampaignAction, renderCampaignJournal, dailyLocked } from "../dist/campaign-ui.js";
import { optionModel } from "../dist/daily-ui.js";
import { alertItems } from "../dist/winter-ui.js";

const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const OPS = new Set("give money rep mood fatigue hp stamina research xp trust cheer buff later debt night drain spawn ambush cache crew perk peng dog lose water fertility growthBack harvestRipe sick heal visitor clearRuin repair rush killJob stationHit visitBlock hordeShift hordeTomorrow raidDelay raidLess raidWarn seeds seedsAll seedsOwned rareSeeds mod random time caravanDisc caravanOrder festNext talkUsed sellTop payGoods tell flag next mark".split(" "));
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
  assert.equal(EVENT_IDS.length, 100);
  const chain = EVENT_IDS.filter((id) => EVENTS[id].chain);
  assert.equal(chain.length, 36);
  assert.equal(EVENT_IDS.length - chain.length, 64);
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
  assert.deepEqual(cats, { chain: 36, farm: 12, scav: 10, camp: 12, trade: 10, crisis: 10, luck: 10 });
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

test("the card shows from 06:00 and waits while you fight, fish or build", () => {
  const { e } = make();
  nextDay(e);
  e.s.minute = 300;
  assert.equal(e.dailyShouldShow(), false, "before dawn");
  e.s.minute = 361;
  assert.equal(e.dailyShouldShow(), true);
  e.s.horde.phase = "warning";
  assert.equal(e.dailyShouldShow(), false, "horde warning");
  assert.ok(alertItems(e).some((a) => a.text === "今日抉择等你决定"));
  e.s.horde.phase = "none";
  const z = e.enemy("runner", e.s.player.x + 80, e.s.player.y);
  z.state = "chase";
  e.enemies.push(z);
  assert.equal(e.dailyShouldShow(), false, "infected chasing nearby");
  z.dead = true;
  e.buildMode = "fence";
  assert.equal(e.dailyShouldShow(), false, "placing a building");
  e.buildMode = null;
  assert.equal(e.dailyShouldShow(), true);
});

test("every option of all 100 events runs, keeps the save loadable and writes clean text", () => {
  const { e } = make();
  toAct(e, 9);
  e.s.day = 40;
  for (const id of ["farmer", "medic", "mechanic"]) if (!e.resident(id)) e.recruit(id);
  if (!e.sc.helpers.length) e.addHelper("tieqiao");
  e.addCrew({ id: "c1", name: "石头", role: "build", trait: "handy", look: 2 });
  e.f.dog.rescued = true;
  e.fr.dog.bond = 10;
  e.r.radio = true;
  e.d.unlocked.railDepot = true;
  e.s.buildings.push({ id: "coopT", type: "coop", x: 300, y: 300, rotation: 0, hp: 100, open: false });
  const basics = {};
  for (const [id, it] of Object.entries(ITEMS)) if (!it.protected) basics[id] = 120;
  stock(e, basics);
  for (const id of ["bread", "potato", "tomato", "radish"]) e.s.inventory[id] = 60;
  e.s.money = 5000;
  e.c.nextHordeDay = e.s.day + 2;
  e.scheduleRaid(3);
  e.craft("stew");
  const job = e.c.production.find((j) => !j.ready);
  if (job) job.remaining = Math.max(job.remaining, 30);
  const base = e.serialize();
  let runs = 0;
  for (const id of EVENT_IDS) {
    const ev = EVENTS[id];
    for (let i = 0; i < 3; i++)
      for (const roll of ev.opts[i].p ? [0, 0.999] : [0.5]) {
        const { e: x } = make(Engine.parse(base));
        setCard(x, id, [roll, roll, roll]);
        const card = renderCampaignView(x, { view: "daily" });
        assert.doesNotMatch(card, FORBIDDEN, id);
        assert.equal((card.match(/data-action="dPick"/g) || []).length, 3, id);
        const reason = x.optionReason(i);
        assert.equal(reason, "", id + " option " + (i + 1) + " should be available: " + reason);
        const r = x.chooseDaily(i);
        assert.ok(r, id + " option " + (i + 1));
        for (const line of r.lines) assert.doesNotMatch(line, FORBIDDEN, id + " " + line);
        assert.doesNotMatch(renderCampaignView(x, { view: "daily", dailyResult: r }), FORBIDDEN, id);
        finite(x.s);
        assert.doesNotThrow(() => Engine.parse(x.serialize()), id + " option " + (i + 1));
        runs++;
      }
  }
  assert.ok(runs > 300);
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

test("rewards and costs scale ×1.5 from act three and ×2 from act six, and the card says so", () => {
  const { e } = make();
  setCard(e, "J02");
  assert.equal(optionModel(e, e.dailyCard(), 1).gain, "金币 +50");
  toAct(e, 3);
  setCard(e, "J02");
  assert.equal(optionModel(e, e.dailyCard(), 1).gain, "金币 +75");
  assert.match(renderCampaignView(e, { view: "daily" }), /奖励 ×1.5/);
  toAct(e, 6);
  setCard(e, "S03");
  assert.match(optionModel(e, e.dailyCard(), 1).costText, /木材 \d+\/8/);
});

test("gambles use the roll fixed with the card; two misses in a row bring better luck", () => {
  const { e } = make();
  toAct(e, 3);
  e.s.day = 10;
  setCard(e, "J01", [0.9, 0.9, 0.9]);
  const m0 = e.s.money;
  assert.ok(e.chooseDaily(2));
  assert.equal(e.s.money, m0);
  assert.equal(e.dy.streak, 1);
  e.s.day++;
  setCard(e, "J01", [0.9, 0.9, 0.9]);
  e.chooseDaily(2);
  assert.equal(e.dy.streak, 2);
  e.s.day++;
  e.dy.pending = null;
  e.dailyGenerate(e.s.day);
  assert.equal(e.dy.pending.luck, true);
  setCard(e, "J01", [0.65, 0.65, 0.65], { luck: true });
  assert.equal(e.optionChance(2), 0.7);
  assert.match(renderCampaignView(e, { view: "daily" }), /运气在你这边/);
  assert.ok(e.chooseDaily(2));
  assert.ok(e.s.money > m0, "0.65 < 0.5 + 0.2 wins");
  assert.equal(e.dy.streak, 0);
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
  const g0 = e.cropGrowthRate(plot);
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
  assert.ok(Math.abs(e.cropGrowthRate(plot) - g0) < 1e-9);
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
test("the card, result, journal strip and record page render clean text and real buttons", () => {
  const { e } = make();
  toAct(e, 3);
  nextDay(e);
  const p = e.dailyCard();
  const html = renderCampaignView(e, { view: "daily" });
  assert.match(html, /data-hotkey="1"/);
  assert.match(html, /data-hotkey="3"/);
  assert.match(html, /第 \d+ 天 · 清晨/);
  assert.equal(campaignTitle({ view: "daily" }), "今日抉择");
  assert.equal(dailyLocked(e, { view: "daily" }), false, "opened early by hand, before 06:00, it can still be closed");
  e.s.minute = 360;
  assert.ok(dailyLocked(e, { view: "daily" }));
  assert.match(renderCampaignView(e, { view: "daily" }), /class="daily-card[^"]* locked"/);
  assert.match(renderCampaignJournal(e, {}), /还没选/);
  const ui = {};
  const c = ctx(e, { ui });
  const free = EVENTS[p.id].opts.findIndex((o) => !o.cost && !o.pay && !o.req);
  assert.ok(handleCampaignAction("dPick", btn("dPick", String(free)), c));
  assert.ok(ui.dailyResult);
  const res = renderCampaignView(e, { view: "daily", dailyResult: ui.dailyResult });
  assert.match(res, /开始第 \d+ 天/);
  assert.doesNotMatch(res, FORBIDDEN);
  assert.equal(dailyLocked(e, { view: "daily", dailyResult: ui.dailyResult }), false);
  let closed = 0;
  handleCampaignAction("dStart", btn("dStart"), ctx(e, { ui, closeMenu: () => closed++ }));
  assert.equal(closed, 1);
  assert.match(renderCampaignJournal(e, {}), /今日抉择/);
  const log = renderCampaignView(e, { view: "dlog" });
  assert.match(log, /迷路的信鸽/);
  assert.doesNotMatch(log, FORBIDDEN);
  e.dy.buffs.push({ kind: "growth", from: e.s.day, until: e.s.day + 2, value: 0.1 });
  assert.match(campaignHud(e).daily.title, /作物生长 \+10%/);
});

// ---------- 审查后补的回归测试 ----------
const fillCrew = (e) => {
  for (const id of ["a1", "a2", "a3"]) e.addCrew({ id, name: "队员" + id, role: "carry", trait: "diligent", look: 0 });
};
test("a full crew turns newcomers into real items, and the save still loads", () => {
  for (const [id, opt, flags] of [["C1-E", 2, []], ["C6-E", 1, ["searched"]], ["C2-3", 2, []], ["C3-E", 2, []], ["V03", 1, []]]) {
    if (!EVENTS[id]) continue;
    for (const o of EVENTS[id].opts) for (const op of [...(o.fx || []), ...(o.win || [])]) if (op[0] === "crew") for (const k of Object.keys(op[2] || {})) assert.ok(ITEMS[k], id + " fallback " + k);
    const { e } = make();
    toAct(e, 6);
    e.s.day = 40;
    e.s.minute = 400;
    fillCrew(e);
    assert.ok(e.crewFull());
    setCard(e, id, [0.1, 0.1, 0.1]);
    if (EVENTS[id].chain) e.dy.chains[EVENTS[id].chain].flags = flags;
    stock(e, { bread: 10, wood: 10, cloth: 6, parts: 6 });
    const html = renderCampaignView(e, { view: "daily" });
    assert.doesNotMatch(html, /seedsAll|research \d/);
    const r = e.chooseDaily(opt);
    assert.ok(r, id);
    assert.match(r.lines.join(" "), /住满了/);
    assert.ok(Engine.parse(e.serialize()), id + " save loads");
  }
  // 同一个人第二次来：不说“住满了”
  for (const o of Object.values(EVENTS).flatMap((ev) => ev.opts)) for (const op of [...(o.fx || []), ...(o.win || []), ...(o.lose || [])]) if (op[0] === "crew") for (const k of Object.keys(op[2] || {})) assert.ok(ITEMS[k], "fallback item " + k);
});
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
test("a chain keeps the reward scale of the day it began: borrow and repay match", () => {
  const { e } = make();
  toAct(e, 2);
  e.s.day = 20;
  e.s.money = 0;
  setCard(e, "C7-1");
  e.dy.chains = {};
  e.chooseDaily(0);
  assert.equal(e.s.money, 150);
  assert.equal(e.dy.chains.C7.tier, 1);
  toAct(e, 6);
  e.s.day = 30;
  e.dy.pending = null;
  e.dailyGenerate(30);
  assert.equal(e.dailyCard().id, "C7-2");
  assert.equal(e.dailyCard().tier, 1, "repayment uses the borrowing day's scale");
  assert.match(optionModel(e, e.dailyCard(), 0).costText, /金币 200/);
  assert.match(optionModel(e, e.dailyCard(), 1).costText, /抵 200 金币/);
  assert.doesNotMatch(EVENTS["C7-1"].text + EVENTS["C7-2"].text, /\d/);
  // 物资抵账也按倍率
  const { e: f } = make();
  toAct(f, 6);
  f.s.day = 30;
  f.dy.chains.C7 = { step: "C7-2", due: 30, flags: [], mark: null, start: 20, tier: 2 };
  f.dailyGenerate(30);
  f.s.inventory.pumpkin = 30;
  const before = f.goodsValue();
  assert.equal(f.optionReason(1), "");
  f.chooseDaily(1);
  assert.ok(before - f.goodsValue() >= 400, "goods worth the scaled 400 are handed over");
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
test("a marker chosen while standing in its region appears at once", () => {
  const { e } = make();
  toAct(e, 6);
  e.s.day = 20;
  go(e, "warehouse");
  setCard(e, "C4-2");
  e.chooseDaily(1);
  assert.ok(e.objects.some((o) => o.type === "dailyMark"));
  // 下井摸清过的线索：不用再跑一趟
  const { e: f } = make();
  toAct(f, 6);
  f.s.day = 20;
  setCard(f, "C4-2");
  f.dy.chains.C4.flags = ["clue"];
  assert.match(optionModel(f, f.dailyCard(), 1).follow, /明天有下文/);
  f.chooseDaily(1);
  assert.equal(f.dy.chains.C4.mark, null);
  assert.equal(f.dy.chains.C4.due, 21);
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
  // 21:30 接下“你亲自跑一趟”
  e.s.minute = 21.5 * 60;
  setCard(e, "V08");
  e.dy.claimed = e.dy.claimed.filter((x) => !x.startsWith("card:"));
  const day = e.s.day;
  const r = e.chooseDaily(1);
  assert.equal(e.s.day, day, "still the same day");
  assert.match(r.lines.join(" "), /深夜/);
  assert.equal(e.dy.history.filter((h) => h.day === day).length, 1);
});
test("a botched lock halves the seeds; outcomes that continue either way do not say 'only if it works'", () => {
  const { e } = make();
  toAct(e, 6);
  e.s.day = 30;
  setCard(e, "C8-E");
  e.dy.chains.C8.flags = ["damaged"];
  assert.match(optionModel(e, e.dailyCard(), 0).gain, /坏了一半/);
  const n = e.qty("seedRadish", true);
  e.chooseDaily(0);
  assert.equal(e.qty("seedRadish", true) - n, 5);
  const { e: f } = make();
  toAct(f, 3);
  f.s.day = 10;
  setCard(f, "C4-1");
  f.s.storage.herb = 4;
  assert.doesNotMatch(optionModel(f, f.dailyCard(), 1).follow, /成了才有/);
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
