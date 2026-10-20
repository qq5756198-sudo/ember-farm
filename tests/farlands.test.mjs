import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState } from "../dist/campaign.js";
import { Engine as SeasonsEngine, freshState as seasonsFresh } from "../dist/seasons.js";
import { TASKS } from "../dist/rebuild-data.js";
import { ITEMS, BUILDINGS } from "../dist/data.js";
import { NIGHT, NIGHT_SPOTS, HAZARDS, HAZARD_SPOTS, FSPOTS, DOG_MAX, PENG_LEND, PENG_AID, PENG_TRADES, RUINS } from "../dist/farlands-data.js";
import {
  renderFarlandsJournal,
  buildCardExtras,
  settingsExtras,
  applyAccess,
  mapKey,
  keyLabel,
  startKeyCapture,
  captureKey,
  keyCaptureActive,
  helpRows,
  readPad,
  keymapOf,
} from "../dist/farlands-ui.js";
import { renderCampaignView, campaignTitle, campaignHud, handleCampaignAction, renderMapPlus } from "../dist/campaign-ui.js";
import { alertItems } from "../dist/winter-ui.js";
import { readPreferences, writePreferences } from "../dist/player-session.js";

const FORBIDDEN = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN/;
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
const at = (e, spot, dy = 20) => {
  go(e, spot.region || "farm");
  Object.assign(e.s.player, { x: spot.x, y: spot.y + dy });
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
  const last = { 3: "table", 4: "hospitalDefense", 5: "warehouse", 6: "network", 7: "radio", 8: "broadcast", 9: "broadcast" }[n];
  e.r.claimed = TASKS.slice(0, TASKS.findIndex((t) => t.id === last) + 1).map((t) => t.id);
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
// 某一天的夜里抉择（day % 3：0 废墟、1 伤者、2 储藏）
// 找到下一个出现某种夜里抉择的日子（从 from 天起）
function dayOf(e, kind, from = 3) {
  for (let d = from; d < from + 200; d++) if (e.nightFor(d).kind === kind) return d;
  throw Error("no day for " + kind);
}
function nightOf(e, kind, from = 3) {
  return nightOn(e, dayOf(e, kind, from));
}
function nightOn(e, day) {
  e.s.day = day;
  e.fr.night = null;
  hour(e, 19);
  return e.fr.night;
}
function freeSpot(e, type) {
  go(e, "farm");
  for (let r = 0; r < 600; r += 12)
    for (let a = 0; a < 6.28; a += 0.25) {
      const x = Math.round((760 + Math.cos(a) * r) / 8) * 8,
        y = Math.round((620 + Math.sin(a) * r) / 8) * 8;
      // v0.38：建东西不能罩住自己，人站在外框下边一点
      Object.assign(e.s.player, { x, y: y + Math.max(40, e.buildingRect(type, x, y).h / 2 + 24) });
      if (!e.buildReason(type, x, y)) return { x, y };
    }
  throw Error("no spot for " + type);
}

// ---------- 存档 ----------
test("new saves carry farlands defaults and the v0.17 version", async () => {
  const { e } = make();
  assert.equal(e.fr.schema, 1);
  assert.equal(e.fr.peng.phase, "none");
  assert.equal(e.fr.dog.bond, 0);
  const v = await import("../dist/version.js");
  assert.match(v.GAME_VERSION, /^v0\.(1[7-9]|[2-9]\d)\.\d+$/);
  assert.ok(v.GAME_EDITION);
  const text = e.serialize();
  assert.deepEqual(Engine.parse(text).far, JSON.parse(text).far);
});

test("a v0.16 save without farlands data loads unchanged and gains empty farlands state", () => {
  const old = new SeasonsEngine(seasonsFresh(), () => {});
  old.s.money = 777;
  old.s.storage.bread = 9;
  old.ss.he.stage = 2;
  const text = old.serialize();
  assert.equal(JSON.parse(text).far, undefined);
  const s = Engine.parse(text);
  const { e } = make(s);
  assert.equal(e.s.money, 777);
  assert.equal(e.s.storage.bread, 9);
  assert.equal(e.ss.he.stage, 2);
  assert.equal(e.fr.night, null);
  const again = Engine.parse(e.serialize());
  assert.equal(again.money, 777);
  assert.equal(again.far.schema, 1);
});

test("corrupted farlands fields are refused with a recoverable message", () => {
  const { e } = make();
  const base = JSON.parse(e.serialize());
  const bad = [
    (f) => (f.schema = 9),
    (f) => (f.extra = 1),
    (f) => (f.night = { day: 1, region: "moon", kind: "ruin", done: false, choice: null }),
    (f) => (f.night = { day: 1, region: "hospital", kind: "ruin", done: true, choice: "fly" }),
    (f) => (f.dog = { bond: 99 }),
    (f) => (f.peng = { phase: "king" }),
    (f) => (f.peng = { phase: "trader", bought: ["gold"] }),
    (f) => (f.hemc = { phase: "met", debt: { type: "fence", total: { wood: 3 }, paid: {}, day: 1 } }),
    (f) => (f.hemc = { phase: "open", debt: { type: "fence", total: { wood: 3 }, paid: { wood: 9 }, day: 1 } }),
    (f) => (f.later = [{ id: "x", day: 1, items: { gold: 1 }, text: "?" }]),
    (f) => (f.amends = [{ id: "x", kind: "ruin", text: "t", cost: { bread: -1 }, rep: 1 }]),
    (f) => (f.claimed = ["a", "a"]),
    (f) => (f.hazard = { day: 1, region: "farm", kind: "fog" }),
  ];
  for (const change of bad) {
    const s = structuredClone(base);
    change(s.far);
    assert.throws(() => Engine.parse(JSON.stringify(s)), /远方存档异常|存档/);
  }
});

test("settings carry only known accessibility and key fields after loading", () => {
  const { e } = make();
  const s = JSON.parse(e.serialize());
  s.settings.access = { text: "yes", color: true, hack: 1 };
  s.settings.keymap = { interact: "much too long" };
  const p = Engine.parse(JSON.stringify(s));
  assert.deepEqual(p.settings.access, { text: false, color: true, calm: false });
  assert.deepEqual(p.settings.keymap, {});
});

test("night choices can lower reputation without breaking the save", () => {
  const { e } = make();
  toAct(e, 3);
  e.c.reputation = 1;
  const n = nightOf(e, "ruin");
  assert.equal(n.kind, "ruin");
  at(e, NIGHT_SPOTS[n.region]);
  assert.ok(e.chooseNight("take"));
  assert.equal(e.c.reputation, 0);
  assert.doesNotThrow(() => Engine.parse(e.serialize()));
});

// ---------- 夜里的抉择 ----------
test("night choices open from act three at 19:00 in one open ruin and only there", () => {
  const { e, toasts } = make();
  e.s.day = 3;
  hour(e, 19);
  assert.equal(e.fr.night, null, "nothing before act three");
  toAct(e, 3);
  const n = nightOf(e, "ruin");
  assert.ok(n && RUINS.includes(n.region) && n.kind === "ruin");
  go(e, n.region);
  assert.ok(e.objects.some((o) => o.type === "farNight"));
  const other = e.openRuins().find((r) => r !== n.region);
  if (other) {
    go(e, other);
    assert.ok(!e.objects.some((o) => o.type === "farNight"));
  }
  go(e, n.region);
  assert.equal(e.chooseNight("take"), false, "must walk there first");
  assert.match(toasts.at(-1).text, /走到那里/);
  at(e, NIGHT_SPOTS[n.region]);
  const rep = (e.c.reputation = 10);
  clear(e, ["bread", "cloth", "parts"]);
  assert.ok(e.chooseNight("take"));
  assert.equal(e.qty("bread"), 3);
  assert.equal(e.c.reputation, rep - 3);
  assert.equal(e.chooseNight("leave"), false, "one decision a night");
  assert.equal(e.fr.amends.length, 1);
  assert.ok(!e.objects.some((o) => o.type === "farNight"), "object leaves after deciding");
  // 补救：东西不够时不动；够了才扣、声望回来
  const id = e.fr.amends[0].id;
  clear(e, ["bread", "cloth"]);
  assert.equal(e.makeAmends(id), false);
  assert.equal(e.fr.amends.length, 1);
  stock(e, { bread: 3, cloth: 2 });
  assert.ok(e.makeAmends(id));
  assert.equal(e.fr.amends.length, 0);
  assert.equal(e.c.reputation, rep - 3 + 4);
  assert.equal(e.makeAmends(id), false, "no double amends");
});

test("the window closes at 05:00 and the choice is gone after that", () => {
  const { e } = make();
  toAct(e, 3);
  const n = nightOf(e, "stranger");
  at(e, NIGHT_SPOTS[n.region]);
  nextDay(e);
  e.s.minute = 4 * 60;
  assert.ok(e.nightHere());
  hour(e, 5);
  e.s.minute = 5 * 60 + 1;
  assert.equal(e.nightHere(), false);
  assert.equal(e.chooseNight("bandage"), false);
});

test("sharing pays from the farm, refuses when short and sends a thank-you once", () => {
  const { e } = make();
  toAct(e, 3);
  const n = nightOf(e, "ruin");
  at(e, NIGHT_SPOTS[n.region]);
  clear(e, ["bread"]);
  assert.match(e.nightReason("share"), /还缺/);
  assert.equal(e.chooseNight("share"), false);
  assert.equal(e.fr.night.done, false);
  stock(e, { bread: 2 });
  assert.ok(e.chooseNight("share"));
  assert.equal(e.qty("bread", true), 0);
  assert.equal(e.fr.later.length, 1);
  const due = e.fr.later[0].day;
  clear(e, ["medkit"]);
  while (e.s.day < due) nextDay(e);
  hour(e, 8);
  assert.equal(e.s.storage.medkit, 1);
  // 重新读档、再到 08:00 也不会重复
  const { e: e2 } = make(Engine.parse(e.serialize()));
  hour(e2, 8);
  assert.equal(e2.s.storage.medkit, 1);
});

test("helping the wounded stranger brings him to the gate; walking away lets you go back the next night", () => {
  const { e } = make();
  toAct(e, 3);
  let n = nightOf(e, "stranger");
  assert.equal(n.kind, "stranger");
  at(e, NIGHT_SPOTS[n.region]);
  assert.ok(e.chooseNight("leave"));
  assert.equal(e.fr.amends.length, 1);
  assert.ok(e.fr.amends[0].revisit);
  assert.match(e.amendsReason(e.fr.amends[0].id), /明晚/);
  const region = n.region;
  nextDay(e);
  n = nightOn(e, e.s.day);
  assert.equal(n.kind, "stranger");
  assert.equal(n.region, region);
  assert.ok(n.revisit);
  assert.equal(e.fr.amends.length, 0);
  at(e, NIGHT_SPOTS[n.region]);
  stock(e, { bandage: 1 });
  assert.ok(e.chooseNight("bandage"));
  assert.equal(e.ss.pendingGuest, "腿伤的猎户阿川");
  e.o.visitors.current = null;
  e.o.visitors.count = 0;
  nextDay(e);
  hour(e, 9);
  assert.equal(e.o.visitors.current?.name, "腿伤的猎户阿川");
});

test("the rain-alley stash: taking half leaves an IOU, taking all upsets 彭姐; a full bag spills to storage", () => {
  const { e } = make();
  toAct(e, 3);
  let n = nightOf(e, "stash");
  assert.equal(n.kind, "stash");
  at(e, NIGHT_SPOTS[n.region]);
  // 背包塞满
  for (const id of Object.keys(ITEMS).slice(0, 80)) if (!ITEMS[id].protected) e.s.inventory[id] = 999;
  const before = e.s.storage.ammo || 0;
  assert.ok(e.chooseNight("takeAll"));
  assert.ok((e.s.storage.ammo || 0) >= before + 12 || e.qty("ammo") >= 12);
  assert.equal(e.fr.peng.relation, -2);
  assert.equal(e.fr.amends[0].kind, "stash");
  nextDay(e);
  n = nightOf(e, "stash", e.s.day + 1);
  at(e, NIGHT_SPOTS[n.region]);
  assert.ok(e.chooseNight("takeHalf"));
  assert.ok(e.fr.amends.some((a) => a.kind === "iou"));
});

// ---------- 今日险地 ----------
test("the 20:00 forecast matches tomorrow's hazard and is deterministic", () => {
  const { e, toasts } = make();
  toAct(e, 3);
  e.s.day = 10;
  hour(e, 20);
  const f = e.fr.nextHazard;
  assert.equal(f.day, 11);
  assert.ok(toasts.some((t) => /明天的险地/.test(t.text)));
  nextDay(e);
  const h = e.hazardToday();
  assert.equal(h.region, f.region);
  assert.equal(h.kind, f.kind);
  assert.deepEqual(e.hazardFor(30), e.hazardFor(30));
});

function hazardDay(e, kind) {
  for (let d = 2; d < 60; d++) if (e.hazardFor(d).kind === kind) return d;
  throw Error("no day for " + kind);
}
test("a migration hazard adds four infected that must be cleared before the supply opens once", () => {
  const { e } = make();
  toAct(e, 3);
  const d = hazardDay(e, "migration");
  e.s.day = d - 1;
  nextDay(e);
  const h = e.hazardToday();
  assert.equal(h.kind, "migration");
  e.s.region = "farm";
  assert.ok(e.travel(h.region) || (go(e, h.region), true));
  e.hazardEnter();
  assert.equal(e.hazardFoes(), 4);
  at(e, HAZARD_SPOTS[h.region]);
  assert.match(e.hazardReason(), /还有 4 只/);
  assert.equal(e.openHazard(), false);
  for (const z of e.enemies) if (z.hazard) z.dead = true;
  clear(e, ["ammo", "parts"]);
  assert.ok(e.openHazard());
  assert.equal(e.qty("ammo"), 10);
  assert.equal(e.openHazard(), false, "only once");
  e.hazardEnter();
  assert.equal(e.hazardFoes(), 0, "entering again does not respawn");
  const { e: e2 } = make(Engine.parse(e.serialize()));
  go(e2, h.region);
  at(e2, HAZARD_SPOTS[h.region]);
  assert.equal(e2.openHazard(), false, "not again after reload");
});

test("fog wakes two infected when opened; drift supplies wash away at 18:00", () => {
  const { e } = make();
  toAct(e, 3);
  let d = hazardDay(e, "fog");
  e.s.day = d - 1;
  nextDay(e);
  let h = e.hazardToday();
  at(e, HAZARD_SPOTS[h.region]);
  const n = e.enemies.length;
  assert.ok(e.openHazard());
  assert.equal(e.enemies.length, n + 2);
  assert.ok(e.enemies.slice(-2).every((z) => z.state === "chase"));
  d = hazardDay(e, "ashore");
  e.s.day = d - 1;
  nextDay(e);
  h = e.hazardToday();
  at(e, HAZARD_SPOTS[h.region]);
  e.s.minute = 18 * 60 + 1;
  e.assignRegion();
  assert.ok(!e.objects.some((o) => o.type === "farHazard"));
  assert.match(e.hazardReason(), /冲走/);
  assert.equal(e.openHazard(), false);
});

// ---------- 麦穗 ----------
test("麦穗 learns skills from feeding, petting and outings; once a day each; capped at 15", () => {
  const { e, toasts } = make();
  toAct(e, 3);
  assert.equal(e.feedDog(), false, "no dog yet");
  e.f.dog.rescued = true;
  clear(e, ["bread"]);
  assert.match(e.feedReason(), /还缺/);
  assert.equal(e.feedDog(), false);
  stock(e, { bread: 5 });
  assert.ok(e.feedDog());
  assert.equal(e.feedDog(), false, "once a day");
  assert.equal(e.fr.dog.bond, 1);
  Object.assign(e.s.player, { x: e.f.dog.x + 20, y: e.f.dog.y });
  assert.equal(e.petReason(), "");
  assert.ok(e.petDog());
  assert.equal(e.fr.dog.bond, 2);
  assert.equal(e.petDog(), false);
  e.s.region = "farm";
  e.travel(e.openRuins()[0]);
  assert.equal(e.fr.dog.bond, 3);
  assert.ok(toasts.some((t) => /学会了“刨种子”/.test(t.text)));
  assert.ok(e.dogSkill("dig"));
  e.fr.dog.bond = DOG_MAX;
  e.addBond(5);
  assert.equal(e.fr.dog.bond, DOG_MAX);
});

test("dog skills: seeds every other morning, an extra egg, earlier warnings and fetching the lost pack", () => {
  const { e, toasts } = make();
  toAct(e, 3);
  e.f.dog.rescued = true;
  e.fr.dog.bond = 12;
  go(e, "farm");
  e.s.day = 10;
  const seeds = () => Object.entries(e.s.storage).filter(([k]) => k.startsWith("seed")).reduce((a, [, v]) => a + v, 0);
  const s0 = seeds();
  // 人情那一版的麦穗早上还会随机叼一样东西（可能是一颗种子）：这一天算它已经叼过了，只看这里的本事
  if (e.kin) e.kin.dog = 10;
  hour(e, 6);
  assert.equal(seeds(), s0 + 2);
  hour(e, 6);
  assert.equal(seeds(), s0 + 2, "not twice the same day");
  e.s.buildings.push({ id: "coopx", type: "coop", x: 300, y: 300, rotation: 0, hp: BUILDINGS.coop?.hp || 100, open: false });
  const eggs = e.s.storage.egg || 0;
  hour(e, 7);
  assert.equal(e.s.storage.egg, eggs + 1);
  // 吠叫：预警多 20 秒，只加一次
  e.s.horde.phase = "warning";
  e.s.horde.timer = 30;
  e.update(0.016, {});
  const t1 = e.s.horde.timer;
  assert.ok(t1 > 45);
  e.update(0.016, {});
  assert.ok(e.s.horde.timer <= t1);
  assert.ok(toasts.some((t) => /狂吠/.test(t.text)));
  e.s.horde.phase = "none";
  // 叼回背包
  e.s.grave = { region: "hospital", x: 500, y: 500, items: { scrap: 4 } };
  const scrap = e.s.storage.scrap || 0;
  e.s.day = 11;
  // 人情那一版的麦穗早上还会随机叼一样东西（可能正好是废金属）：这一天算它已经叼过了，只看叼回背包
  if (e.kin) e.kin.dog = 11;
  hour(e, 6);
  assert.equal(e.s.grave, null);
  assert.equal(e.s.storage.scrap, scrap + 4);
});

// ---------- 彭姐 ----------
test("彭姐 asks for food from act four; short stock refuses; lending, siege and aid lead to an alliance", () => {
  const { e } = make();
  toAct(e, 3);
  hour(e, 8);
  assert.equal(e.fr.peng.phase, "none");
  toAct(e, 4);
  hour(e, 8);
  assert.equal(e.fr.peng.phase, "asking");
  at(e, { region: "farm", ...FSPOTS.peng });
  assert.ok(e.objects.some((o) => o.type === "farPeng"));
  clear(e, ["bread"]);
  assert.equal(e.pengDecide("lend"), false);
  assert.equal(e.fr.peng.phase, "asking");
  stock(e, PENG_LEND);
  assert.ok(e.pengDecide("lend"));
  assert.equal(e.fr.peng.phase, "waiting");
  assert.equal(e.fr.peng.relation, 2);
  const due = e.fr.peng.day;
  while (e.s.day < due) nextDay(e);
  hour(e, 8);
  assert.equal(e.fr.peng.phase, "attacked");
  at(e, { region: "farm", ...FSPOTS.peng });
  assert.match(e.pengRescueReason(), /入口还没修通/);
  clear(e, ["ammo", "bandage"]);
  assert.equal(e.pengDecide("aid"), false);
  stock(e, PENG_AID);
  const rep = e.c.reputation;
  assert.ok(e.pengDecide("aid"));
  assert.equal(e.fr.peng.phase, "offer");
  assert.equal(e.c.reputation, rep + 5);
  const power = e.raidPower();
  assert.ok(e.pengDecide("ally"));
  assert.equal(e.fr.peng.phase, "allied");
  assert.equal(e.raidPower(), power + 2);
  // 每 7 天轮流供粮：先送来，再轮到前哨；不够时记一次欠账
  const bread = e.s.storage.bread || 0;
  e.s.day = e.fr.peng.week + 7;
  hour(e, 8);
  assert.equal(e.s.storage.bread, bread + 6);
  clear(e, ["bread"]);
  e.s.day = e.fr.peng.week + 7;
  hour(e, 8);
  assert.equal(e.fr.peng.misses, 1);
});

test("a rescue in person: the courtyard spawns five, clearing them earns the offer once", () => {
  const { e } = make();
  toAct(e, 4);
  e.fr.peng.phase = "attacked";
  e.fr.peng.day = e.s.day;
  e.d.unlocked.courtyard = true;
  assert.equal(e.pengRescueReason(), "");
  go(e, "farm");
  e.s.region = "farm";
  e.pengCampEnter = e.pengCampEnter.bind(e);
  go(e, "courtyard");
  e.pengCampEnter();
  assert.equal(e.enemies.filter((z) => z.peng && !z.dead).length, 5);
  e.pengCampEnter();
  assert.equal(e.enemies.filter((z) => z.peng).length, 5, "not twice the same day");
  for (const z of e.enemies) if (z.peng) z.dead = true;
  const rep = e.c.reputation;
  e.update(0.016, {});
  assert.equal(e.fr.peng.phase, "offer");
  assert.equal(e.c.reputation, rep + 5);
  e.fr.peng.phase = "attacked";
  e.pengHelped(1, "again");
  assert.equal(e.c.reputation, rep + 5, "reputation reward only once");
});

test("ignoring the plea: the camp falls, then 彭姐 trades weekly; purchases are limited and checked", () => {
  const { e } = make();
  toAct(e, 4);
  e.fr.peng.phase = "attacked";
  e.fr.peng.day = e.s.day;
  nextDay(e);
  nextDay(e);
  hour(e, 8);
  assert.equal(e.fr.peng.phase, "fallen");
  for (let i = 0; i < 3; i++) nextDay(e);
  hour(e, 8);
  assert.equal(e.fr.peng.phase, "trader");
  while (!e.tradeDay()) nextDay(e);
  at(e, { region: "farm", ...FSPOTS.peng });
  e.s.minute = 9 * 60;
  assert.ok(e.pengHere());
  e.s.money = 10;
  assert.match(e.pengTradeReason("ammo"), /金币/);
  assert.equal(e.pengTrade("ammo"), false);
  e.s.money = 500;
  const ammo = e.qty("ammo");
  assert.ok(e.pengTrade("ammo"));
  assert.equal(e.qty("ammo"), ammo + 10);
  assert.equal(e.s.money, 500 - PENG_TRADES[0].price);
  assert.equal(e.pengTrade("ammo"), false, "once a week");
  e.s.minute = 19 * 60;
  assert.equal(e.pengHere(), false);
});

// ---------- 贺满仓 ----------
test("贺满仓 audits the books, then advances one building at a time and is repaid in three installments", () => {
  const { e } = make();
  toAct(e, 8);
  go(e, "farm");
  assert.equal(e.hemcHere(), false);
  toAct(e, 9);
  assert.ok(e.objects.some((o) => o.type === "farHemc"));
  at(e, { region: "farm", ...FSPOTS.hemc });
  assert.ok(e.hemcTalk());
  assert.equal(e.fr.hemc.phase, "met");
  e.o.ledger = [1, 2, 3].map((d) => ({ day: d, income: 10, items: { radish: 1 } }));
  e.o.bundles = ["clinic", "caravan"];
  assert.ok(e.hemcTalk());
  assert.equal(e.fr.hemc.phase, "open");
  const [type, def] = Object.entries(BUILDINGS).find(([id, b]) => !b.tech && id !== "field" && Object.keys(b.cost).length >= 1 && Object.values(b.cost).some((n) => n >= 3));
  const cost = def.cost;
  clear(e, Object.keys(cost));
  assert.ok(buildCardExtras(e, type).includes("xAdvance"));
  const spot = freeSpot(e, type);
  assert.ok(e.startAdvance(type));
  const n = e.s.buildings.length;
  assert.ok(e.placeBuilding(spot.x, spot.y));
  assert.equal(e.s.buildings.length, n + 1);
  assert.ok(e.fr.hemc.debt);
  assert.equal(e.buildMode, null);
  assert.match(e.advanceReason(type), /还没还清/);
  assert.equal(buildCardExtras(e, type), "");
  // 读档后欠账还在
  const { e: e2 } = make(Engine.parse(e.serialize()));
  assert.deepEqual(e2.fr.hemc.debt, e.fr.hemc.debt);
  clear(e, Object.keys(cost));
  assert.match(e.repayReason(), /还缺/);
  assert.equal(e.repay(), false);
  stock(e, cost);
  let rounds = 0;
  while (e.fr.hemc.debt && rounds < 5) {
    assert.ok(e.repay());
    rounds++;
  }
  assert.equal(rounds, 3);
  assert.equal(e.fr.hemc.advances, 1);
  assert.equal(e.repay(), false, "nothing left to repay");
  // 材料够的时候用不着垫付
  stock(e, cost);
  assert.match(e.advanceReason(type), /用不着/);
});

// ---------- 出货行情 ----------
test("shipping prices drift daily within ±18% and settle at the price of the day goods went in", () => {
  const { e } = make();
  toAct(e, 3);
  const ids = ["radish", "potato", "bread"].filter((id) => e.shipPrice(id));
  const trends = [];
  for (let d = 1; d < 30; d++) for (const id of ids) {
    const t = e.shipTrend(id, d);
    assert.ok(t >= -18 && t <= 18);
    trends.push(t);
  }
  assert.ok(new Set(trends).size > 5, "prices actually move");
  e._settling = true;
  assert.equal(e.shipTrend("radish"), e.shipTrend("radish", e.s.day - 1));
  e._settling = false;
  go(e, "farm");
  e.s.inventory.radish = 5;
  const expect = e.shipPrice("radish") * 5;
  assert.ok(e.shipItem("radish", 5));
  const money = e.s.money;
  nextDay(e);
  const income = e.s.money - money;
  assert.ok(income > 0);
  assert.equal(e.o.ledger[0].income, income);
  assert.ok(Math.abs(income - expect) <= Math.ceil(expect * 0.25), "settles near the day's quoted price");
});

// ---------- 灰隼团 ----------
test("raid shots now hurt residents, crew and fences, and the report counts wounds", () => {
  const { e } = make();
  toAct(e, 6);
  go(e, "farm");
  e.recruit?.("farmer");
  const r = e.c.residents[0];
  assert.ok(r);
  Object.assign(r, { x: 600, y: 600, fatigue: 0, morale: 60 });
  Object.assign(e.s.player, { x: 200, y: 200 });
  e.raidShots.push({ x: 600 - 40, y: 574, vx: 520, vy: 0, life: 0.85, damage: 8 });
  for (let i = 0; i < 10; i++) e.updateRaidShots(0.016);
  assert.equal(r.fatigue, 15);
  assert.equal(r.morale, 56);
  assert.equal(e.fr.wounded, 1);
  const spot = freeSpot(e, "fence");
  stock(e, BUILDINGS.fence.cost);
  e.buildMode = "fence";
  assert.ok(e.placeBuilding(spot.x, spot.y));
  e.buildMode = null;
  const fence = e.s.buildings.at(-1);
  const hp = fence.hp;
  e.raidShots.push({ x: fence.x - 60, y: fence.y - 24, vx: 520, vy: 0, life: 0.85, damage: 8 });
  for (let i = 0; i < 10; i++) e.updateRaidShots(0.016);
  assert.equal(fence.hp, hp - 6);
  // 枪手会在看不见你时转而瞄准附近的人
  fence.hp = 0;
  for (const c of e.o.crew) c.x = c.y = null;
  for (const q of e.c.residents) if (q !== r) q.x = q.y = null;
  const z = { x: 700, y: 600, dead: false, retreat: false, aim: 0, cooldown: 0, flash: 0, pathTimer: 0, path: [] };
  Object.assign(e.s.player, { x: 100, y: 100 });
  e.updateRaider(z, 0.016);
  assert.equal(z.aim, 1);
  assert.ok(Math.hypot(z.aimX - r.x, z.aimY - (r.y - 24)) < 1);
});

test("calm mode keeps the camera still", () => {
  const { e } = make();
  e.shake = 5;
  assert.equal(e.shake, 5);
  e.s.settings.access = { text: false, color: false, calm: true };
  e.shake = 5;
  assert.equal(e.shake, 0);
});

// ---------- 界面 ----------
test("night, dog, phone, 彭姐 and 贺满仓 pages render clean text and real buttons", () => {
  const { e } = make();
  toAct(e, 9);
  e.f.dog.rescued = true;
  const n = nightOn(e, 3);
  at(e, NIGHT_SPOTS[n.region]);
  e.fr.peng.phase = "asking";
  for (const [view, id] of [["night", ""], ["dog", ""], ["phone", ""], ["dialog", "peng"], ["dialog", "hemc"], ["nightlog", ""]]) {
    const html = renderCampaignView(e, { view, id });
    assert.doesNotMatch(html, FORBIDDEN, view + id);
    if (view !== "nightlog") assert.ok(html.includes("<button"), view + id);
    assert.ok(campaignTitle({ view, id }));
  }
  assert.match(renderCampaignView(e, { view: "night" }), /就这么办/);
  assert.match(renderCampaignView(e, { view: "phone" }), /data-menu="inventory"/);
  for (const phase of ["attacked", "offer", "allied", "trader", "fallen", "waiting"]) {
    e.fr.peng.phase = phase;
    assert.doesNotMatch(renderCampaignView(e, { view: "dialog", id: "peng" }), FORBIDDEN, phase);
  }
});

test("the journal shows today's hazard, tonight's choice, amends and 彭姐; buttons mark real places", () => {
  const { e } = make();
  toAct(e, 4);
  e.s.day = 9;
  hour(e, 6);
  e.fr.hazard = null;
  e.hazardMorning();
  const n = nightOn(e, 9);
  hour(e, 20);
  e.fr.peng.phase = "attacked";
  e.fr.peng.day = e.s.day;
  const html = renderFarlandsJournal(e, {});
  assert.match(html, /今日险地/);
  assert.match(html, /明天的险地/);
  assert.match(html, /今晚/);
  assert.match(html, /雨巷/);
  assert.doesNotMatch(html, FORBIDDEN);
  let shown = null;
  const c = ctx(e, { showMenu: (m, a) => (shown = [m, a]) });
  go(e, "farm");
  assert.ok(handleCampaignAction("xMark", btn("xMark", "night"), c));
  assert.equal(e.guidance.target.region, n.region);
  assert.equal(shown[0], "map");
  const alerts = alertItems(e).map((a) => a.text);
  assert.ok(alerts.includes("雨巷求援"));
  const map = renderMapPlus(e, {});
  assert.match(map, /雨巷求援/);
  assert.match(map, /今晚/);
  assert.ok(campaignHud(e));
});

test("journal actions: deciding the night and paying amends go through the handler", () => {
  const { e } = make();
  toAct(e, 3);
  const n = nightOf(e, "ruin");
  at(e, NIGHT_SPOTS[n.region]);
  let closed = 0;
  const c = ctx(e, { closeMenu: () => closed++ });
  assert.ok(handleCampaignAction("xNight", btn("xNight", "take"), c));
  assert.equal(closed, 1);
  assert.ok(e.fr.night.done);
  stock(e, { bread: 3, cloth: 2 });
  assert.ok(handleCampaignAction("xAmends", btn("xAmends", e.fr.amends[0].id), c));
  assert.equal(e.fr.amends.length, 0);
  // 重复点击不会再扣
  const bread = e.qty("bread", true);
  handleCampaignAction("xAmends", btn("xAmends", "ruin:" + n.day), c);
  assert.equal(e.qty("bread", true), bread);
});

test("key remapping translates keys, swaps clashes, refuses reserved keys and resets", () => {
  const settings = {};
  assert.equal(mapKey(settings, "e"), "e");
  assert.ok(startKeyCapture("interact"));
  assert.ok(keyCaptureActive());
  // v0.22 起 X 默认是“推开”，这里换一个空着的 Y
  assert.match(captureKey(settings, "y"), /交互改为 Y/);
  assert.equal(keyCaptureActive(), false);
  assert.equal(mapKey(settings, "y"), "e");
  assert.equal(mapKey(settings, "e"), "", "the old key is freed");
  assert.equal(keyLabel(settings, "interact"), "Y");
  startKeyCapture("reload");
  assert.match(captureKey(settings, "y"), /换成 R/);
  assert.equal(keymapOf(settings).interact, "r");
  assert.equal(keymapOf(settings).reload, "y");
  startKeyCapture("craft");
  assert.match(captureKey(settings, "f"), /远征路线/);
  startKeyCapture("craft");
  assert.match(captureKey(settings, "1"), /字母键/);
  startKeyCapture("craft");
  assert.match(captureKey(settings, ";"), /字母键/);
  startKeyCapture("craft");
  assert.match(captureKey(settings, "escape"), /取消/);
  assert.equal(keymapOf(settings).craft, "c");
  assert.match(helpRows(settings).map((r) => r[0]).join(" "), /R/);
  settings.keymap = { interact: "r", reload: "r" };
  assert.equal(keymapOf(settings).interact, "e", "clashing data falls back to defaults");
  // 旧档里把交互改成了 X：推开换到空着的键，玩家改过的交互键不动
  assert.equal(keymapOf({ keymap: { interact: "x" } }).interact, "x");
  assert.notEqual(keymapOf({ keymap: { interact: "x" } }).shove, "x");
  assert.equal(new Set(Object.values(keymapOf({ keymap: { interact: "x" } }))).size, Object.keys(keymapOf({})).length);
  const { e } = make();
  let persisted = 0;
  e.s.settings.keymap = { interact: "x" };
  handleCampaignAction("xKeyReset", btn("xKeyReset"), ctx(e, { persist: () => persisted++ }));
  assert.deepEqual(e.s.settings.keymap, {});
  assert.equal(persisted, 1);
});

test("accessibility toggles persist, apply classes and survive preference round trips", () => {
  const { e } = make();
  let persisted = 0;
  const c = ctx(e, { persist: () => persisted++ });
  assert.ok(handleCampaignAction("xAccess", btn("xAccess", "text"), c));
  assert.ok(handleCampaignAction("xAccess", btn("xAccess", "calm"), c));
  assert.deepEqual(e.s.settings.access, { text: true, color: false, calm: true });
  assert.equal(persisted, 2);
  const classes = new Set(),
    props = {};
  const doc = { body: { classList: { toggle: (k, on) => (on ? classes.add(k) : classes.delete(k)) } }, documentElement: { style: { setProperty: (k, v) => (props[k] = v) } } };
  applyAccess(e.s.settings, doc);
  assert.ok(classes.has("a11y-text") && classes.has("a11y-calm") && !classes.has("a11y-color"));
  assert.equal(props["--ui-font"], "16px", "large text uses zoom, not a second font multiplier");
  const html = settingsExtras(e.s.settings);
  assert.match(html, /大号文字/);
  assert.match(html, /键位/);
  assert.match(html, /手柄/);
  assert.doesNotMatch(html, FORBIDDEN);
  const store = { map: new Map(), getItem(k) { return this.map.get(k) ?? null; }, setItem(k, v) { this.map.set(k, String(v)); } };
  writePreferences(store, e.s.settings);
  assert.deepEqual(readPreferences(store).access, { text: true, color: false, calm: true });
});

test("gamepad buttons report presses once and sticks have a dead zone", () => {
  const pad = { id: "Test Pad", connected: true, axes: [0.1, -0.9, 0, 0], buttons: Array.from({ length: 16 }, () => ({ pressed: false, value: 0 })) };
  const nav = { getGamepads: () => [null, pad] };
  pad.buttons[0].pressed = true;
  let p = readPad(nav);
  assert.equal(p.x, 0);
  assert.equal(p.y, -0.9);
  assert.ok(p.edge(0));
  p = readPad(nav);
  assert.ok(p.held(0) && !p.edge(0), "held, not pressed again");
  assert.equal(readPad({ getGamepads: () => [] }), null);
});

test("finishing a night choice, a hazard or 彭姐's request takes down its golden marker", () => {
  const { e } = make();
  toAct(e, 4);
  const n = nightOn(e, 3);
  go(e, "farm");
  handleCampaignAction("xMark", btn("xMark", "night"), ctx(e));
  assert.equal(e.guidance.target.region, n.region);
  at(e, NIGHT_SPOTS[n.region]);
  assert.ok(e.chooseNight("leave"));
  assert.equal(e.guidance.target, null);
  hour(e, 8);
  assert.equal(e.fr.peng.phase, "asking");
  go(e, "farm");
  handleCampaignAction("xMark", btn("xMark", "peng"), ctx(e));
  assert.ok(e.guidance.target);
  at(e, { region: "farm", ...FSPOTS.peng });
  assert.ok(e.pengDecide("refuse"));
  assert.equal(e.guidance.target, null);
});

test("new scene spots never sit on top of another object, so E goes straight to them", () => {
  const { e } = make();
  toAct(e, 9);
  e.d.unlocked.courtyard = true;
  const spots = [...Object.values(NIGHT_SPOTS), ...Object.values(HAZARD_SPOTS), FSPOTS.pengCamp, { region: "farm", ...FSPOTS.peng }, { region: "farm", ...FSPOTS.hemc }];
  for (const sp of spots) {
    go(e, sp.region);
    const near = e.objects.filter((o) => !o.type.startsWith("far") && Math.hypot(o.x - sp.x, o.y - sp.y) < 100);
    assert.deepEqual(near.map((o) => o.type), [], sp.region + " " + sp.x + "," + sp.y);
    assert.equal(e.blocked(sp.x, sp.y, false, 14), false, "walkable");
  }
  assert.match(e.advanceReason("field"), /没有/);
});

// ---------- 复审发现的问题 ----------
test("彭姐's people finishing horde infected still leave a save that loads", () => {
  const { e } = make();
  toAct(e, 6);
  go(e, "farm");
  e.fr.peng.phase = "allied";
  e.fr.peng.week = e.s.day;
  e.s.horde.phase = "active";
  for (let i = 0; i < 3; i++) e.enemies.push(e.enemy("slow", 1300, 400 + i * 40, true));
  e.update(0.016, {});
  assert.equal(e.enemies.filter((z) => z.horde && z.dead).length, 2);
  assert.ok(e.enemies.every((z) => z.hp >= -1000));
  assert.doesNotThrow(() => Engine.parse(e.serialize()));
});

test("every scripted spawn stands where infected can walk and be shot", () => {
  const { e } = make();
  toAct(e, 9);
  e.d.unlocked.courtyard = true;
  for (const region of RUINS) {
    go(e, region);
    e.enemies.length = 0;
    e.fr.hazard = { day: e.s.day, region, kind: "migration", spawned: false, opened: false };
    e.hazardEnter();
    e.fr.hazard = { day: e.s.day, region, kind: "fog", spawned: false, opened: false };
    at(e, HAZARD_SPOTS[region]);
    const before = new Set(e.enemies);
    e.openHazard();
    const ambush = e.enemies.filter((z) => !before.has(z) && z.state === "chase");
    assert.equal(e.enemies.filter((z) => z.hazard).length, 4, region);
    assert.equal(ambush.length, 2, region);
    for (const z of [...e.enemies.filter((z) => z.hazard), ...ambush]) assert.equal(e.blocked(z.x, z.y, true, 13), false, region + " " + z.x + "," + z.y);
  }
  go(e, "courtyard");
  e.enemies.length = 0;
  e.fr.peng.phase = "attacked";
  e.fr.peng.spawned = 0;
  e.pengCampEnter();
  assert.equal(e.enemies.length, 5);
  for (const z of e.enemies) assert.equal(e.blocked(z.x, z.y, true, 13), false, "courtyard " + z.x + "," + z.y);
});

test("hazards and night events move between ruins instead of being tied to one", () => {
  const { e } = make();
  toAct(e, 9);
  const hz = {},
    nt = {};
  for (let d = 1; d <= 120; d++) {
    const h = e.hazardFor(d),
      n = e.nightFor(d);
    (hz[h.kind] ||= new Set()).add(h.region);
    (nt[n.kind] ||= new Set()).add(n.region);
  }
  for (const k of Object.keys(HAZARDS)) assert.ok(hz[k]?.size >= 2, "hazard " + k);
  for (const k of Object.keys(NIGHT)) assert.ok(nt[k]?.size >= 2, "night " + k);
});

test("opening the night view by E clears its 新 mark and shows the intro once", () => {
  const { e } = make();
  toAct(e, 3);
  const n = nightOf(e, "ruin");
  assert.ok(e.newFeatures().includes("night"));
  at(e, NIGHT_SPOTS[n.region]);
  e.events.length = 0;
  e.interact();
  const ev = e.events.find((x) => x.type === "menu");
  assert.equal(ev.view, "night");
  assert.equal(ev.intro, "night");
  assert.ok(!e.newFeatures().includes("night"));
  e.events.length = 0;
  e.interact();
  assert.equal(e.events.find((x) => x.type === "menu").intro, null);
});

test("an advance still respects the facility's own rules, such as the harvest trophy", () => {
  const { e } = make();
  toAct(e, 9);
  e.fr.hemc.phase = "open";
  go(e, "farm");
  e.f.trophies = 0;
  clear(e, Object.keys(BUILDINGS.harvestTrophy.cost));
  assert.equal(buildCardExtras(e, "harvestTrophy"), "", "no advance button either");
  assert.equal(e.startAdvance("harvestTrophy"), false);
  assert.equal(e.buildMode, null);
  assert.equal(e.fr.hemc.debt, null);
});

test("the wounded hunter joins only once; later rescues send thanks instead", () => {
  const { e } = make();
  toAct(e, 3);
  let n = nightOf(e, "stranger");
  at(e, NIGHT_SPOTS[n.region]);
  stock(e, { bandage: 3 });
  assert.ok(e.chooseNight("bandage"));
  assert.equal(e.ss.pendingGuest, "腿伤的猎户阿川");
  e.ss.pendingGuest = null;
  n = nightOf(e, "stranger", e.s.day + 1);
  at(e, NIGHT_SPOTS[n.region]);
  assert.match(renderCampaignView(e, { view: "night" }), /送来谢礼/);
  assert.ok(e.chooseNight("bandage"));
  assert.equal(e.ss.pendingGuest, null);
  assert.ok(e.fr.later.some((l) => /thanks/.test(l.id)));
});

test("彭姐 only deals with you face to face, and the next market day skips a closed one", () => {
  const { e } = make();
  toAct(e, 4);
  hour(e, 8);
  go(e, "market");
  stock(e, { bread: 10 });
  assert.equal(e.pengDecide("lend"), false);
  assert.equal(e.fr.peng.phase, "asking");
  e.fr.peng.phase = "trader";
  while (!e.tradeDay()) e.s.day++;
  e.s.minute = 19 * 60;
  go(e, "farm");
  assert.match(renderCampaignView(e, { view: "dialog", id: "peng" }), new RegExp("下次第 " + (e.s.day + 7) + " 天"));
});
