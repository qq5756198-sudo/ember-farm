// v0.30.0「人情」：送礼要猜、营火夜谈、心里话（八个人各三段、托的东西、教的本事）、门缝里的纸条、节庆聚在火边（路灯、换种子、念名字）、
// 搭伙过日子和长夜里守在身边的人、收留孩子、麦穗叼物、收线钓鱼（四处水、24 种、验水样、研究变异鱼）、商队稀罕货、柜子里的稀罕物、
// 各有各的一天、界面和存档。
import test from "node:test";
import assert from "node:assert/strict";
import { Engine, freshState, newGameState, needsStoryMigration } from "../dist/campaign.js";
import * as Almanac from "../dist/almanac.js";
import { ITEMS, RECIPES } from "../dist/data.js";
import { TASKS } from "../dist/rebuild-data.js";
import { BIRTHDAYS } from "../dist/seasons-data.js";
import { PROWL } from "../dist/undertow-data.js";
import {
  HEART_IDS,
  HEART_AT,
  PARTNER_IDS,
  GIFT,
  TALK_RULES,
  KEEPSAKES,
  KEEP_IDS,
  prefsOf,
  REQUESTS,
  SKILLS,
  SKILL_OF,
  NOTE,
  LAMPS,
  PARTNER,
  BREAKFAST,
  KIDS,
  KID_CRAFTS,
  DOG_FETCH,
  WATERS,
  TIERS,
  FISH,
  FISH_IDS,
  NEW_FISH,
  SAMPLES,
  PLAZA,
  PREFS,
} from "../dist/kin-data.js";
import { HEARTS } from "../dist/kin-story.js";
import * as UI from "../dist/campaign-ui.js";
import { residentExtras } from "../dist/people-hooks.js";
import { MISSING_ICONS } from "../dist/item-sprites.js";

const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|\[object Object\]/;
const make = (state = freshState(), seed = 20301) => {
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
// 主线打完、人都齐了：三个居民（有床）、铁锹、尤可、胡二，何大勺入伙，秦奶奶住下，江伯的事做完，老琴认识了
function camp(e) {
  toAct(e, 8);
  for (const r of ["farmer", "medic", "mechanic"]) e.recruit(r);
  e.addHelper("tieqiao");
  e.addCrew({ id: "youke", name: "尤可", trait: "nightowl", role: "build", look: "youke" });
  e.addCrew({ id: "huer", name: "胡二", trait: "chatty", role: "guard", look: "huer" });
  Object.assign(e.ss.he, { stage: 4 });
  Object.assign(e.ss.qin, { phase: "staying", since: e.s.day });
  Object.assign(e.ss.jiang, { phase: "done", rod: 2 });
  Object.assign(e.ss.laoqin, { met: true, quest: true });
  for (let i = 0; i < 3; i++) e.s.buildings.push({ id: "kb" + i, type: "bed", x: 420 + i * 40, y: 400, rotation: 0, hp: 90, open: false });
  e.s.storage.bread = (e.s.storage.bread || 0) + 60;
  e.s.weather = "晴朗";
  e.assignRegion();
}
const stock = (e, items) => {
  for (const [id, n] of Object.entries(items)) e.s.storage[id] = (e.s.storage[id] || 0) + n;
};
const qty = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);
const hour = (e, h) => {
  e.s.minute = h * 60 - 0.5;
  e.c.workClock = 59.5;
  e.advanceMinutes(1);
};
const go = (e, region, x = 768, y = 512) => {
  e.s.visited = { ...(e.s.visited || {}), [region]: true };
  e.s.region = region;
  e.enemies = e.s.enemies[region] ||= [];
  e.assignRegion();
  Object.assign(e.s.player, { x, y });
};
const near = (e, id) => {
  const w = e.whereNow(id);
  assert.ok(!w.away, id + " is around");
  if (e.s.region !== w.region) go(e, w.region);
  Object.assign(e.s.player, { x: w.x, y: w.y });
};
const view = (e, v, id = "") => UI.renderCampaignView(e, { view: v, id });
const ctx = (e, extra = {}) => ({ engine: e, ui: {}, rebuildUI: {}, showMenu() {}, closeMenu() {}, renderMenu() {}, save() {}, toast() {}, ...extra });
const btn = (action, id = "") => ({ dataset: { action, id: String(id) } });
const old29 = (setup = () => {}) => {
  const old = new Almanac.Engine(Almanac.newGameState("farmer"), () => {});
  setup(old);
  return old.serialize();
};
const evening = (e) => {
  e.s.minute = 19 * 60 + 30;
  e.s.weather = "晴朗";
};

// ================= 数据 =================
test("data: 24 fish in four waters, every new item drawn, eight people with three heart talks each, preferences of two loves / four likes / two dislikes", () => {
  assert.equal(FISH_IDS.length, 24);
  assert.deepEqual([...new Set(FISH_IDS.map((id) => FISH[id].water))].sort(), ["canal", "pond", "river", "sea"]);
  for (const w of Object.keys(WATERS)) assert.ok(FISH_IDS.filter((id) => FISH[id].water === w).length >= 6, w + " has six kinds");
  for (const id of FISH_IDS) {
    assert.ok(ITEMS[id], id);
    assert.ok(TIERS[FISH[id].tier], id);
    assert.ok(FISH[id].hint && !DEV.test(FISH[id].hint), id);
  }
  for (const id of [...NEW_FISH, ...KEEP_IDS, ...Object.values(SAMPLES), "kinRing", "kinRadio", BREAKFAST]) {
    assert.ok(ITEMS[id], id);
    assert.ok(!MISSING_ICONS().includes(id), id + " has its own icon");
  }
  assert.ok(RECIPES.some((r) => r.id === "kinRing" && r.station === "workbench"));
  assert.ok(RECIPES.some((r) => r.id === "kinRadio" && r.station === "workbench"));
  assert.equal(HEART_IDS.length, 8);
  for (const id of HEART_IDS) {
    assert.equal(HEARTS[id].length, 3, id);
    for (const [i, seg] of HEARTS[id].entries()) {
      assert.ok(seg.title && seg.lines.length >= 2, id + i);
      if (i < 2) assert.equal(seg.choices.length, 2, id + i);
      const text = JSON.stringify(seg);
      assert.ok(!DEV.test(text), id + i);
    }
    assert.ok(KEEPSAKES[REQUESTS[id].item], id + " asks for a keepsake");
    assert.ok(SKILLS[SKILL_OF[id]], id + " teaches something");
  }
  assert.ok(PARTNER_IDS.every((id) => HEART_IDS.includes(id)) && PARTNER_IDS.length === 6);
  assert.deepEqual(HEART_AT, [3, 6, 9]);
  for (const id of [...HEART_IDS, "tieqiao", "tangjiu", "huer", "ge", "alan", "suyan", "adou", "ali", "v7", "achun"]) {
    const P = prefsOf(id);
    assert.equal(P.fav.length, 2, id);
    assert.equal(P.like.length, 4, id);
    assert.equal(P.hate.length, 2, id);
    assert.equal(new Set([...P.fav, ...P.like, ...P.hate]).size, 8, id + " no item twice");
  }
});

// ================= 存档 =================
test("save: a new game knows nothing yet and says nothing; a v0.29 save keeps a checkpoint, learns the old two likes, says 人情 once, and reads back the same; broken records are refused", () => {
  const { e: fresh, toasts: t0 } = make(newGameState("farmer"));
  assert.ok(fresh.kin && !fresh.kin.intro);
  assert.deepEqual(fresh.kin.know, {});
  fresh.update(0.016, {});
  assert.ok(!said(t0, /^人情/));
  const text = old29();
  assert.equal(needsStoryMigration(text), true, "v0.29 saves are kept as a checkpoint first");
  const { e, toasts } = make(Engine.parse(text));
  assert.equal(e.kin.know.farmer.jam, "like", "the likes the old page showed are known");
  assert.equal(e.kin.know.he.salt, "fav");
  e.update(0.016, {});
  e.update(0.016, {});
  assert.equal(toasts.filter((t) => /^人情/.test(t.text)).length, 1);
  assert.equal(needsStoryMigration(e.serialize()), false);
  const back = Engine.parse(e.serialize());
  assert.deepEqual(back.kin, JSON.parse(e.serialize()).kin);
  const bad = (fn) => {
    const s = JSON.parse(e.serialize());
    fn(s.kin);
    assert.throws(() => Engine.parse(JSON.stringify(s)), /人情记录损坏/);
  };
  bad((k) => (k.know.farmer = { jam: "adore" }));
  bad((k) => (k.gifts.farmer = [1, 2, 3]));
  bad((k) => (k.heart.farmer = { seg: 4, pick: [], req: 0, got: false }));
  bad((k) => (k.heart.nobody = { seg: 1, pick: [0], req: 0, got: false }));
  bad((k) => (k.kids = [1, 2, 3].map((i) => ({ id: "k" + i, name: "小苗", look: 0, from: "梅姐", day: 1, master: "", start: 0, learned: false, fed: 0, hungry: 0 }))));
  bad((k) => (k.fish.goldfishOfDoom = 1));
  bad((k) => (k.partner = { id: "tangjiu", stage: "home", day: 1, hurt: 0 }));
  bad((k) => (k.half.farmer = 3));
});

// ================= 送礼 =================
test("gifts: likes are guessed — loves +2, likes +1, plain 0, dislikes −1, each told by the reaction; two a week, in person; birthdays double; above 5 a step takes two, above 8 three", () => {
  const { e, toasts } = make();
  camp(e);
  const P = prefsOf("medic");
  stock(e, { [P.like[0]]: 4, [P.fav[1]]: 2, [P.hate[0]]: 2, potato: 2 });
  go(e, "farm", 200, 900);
  assert.match(e.giftReason("medic", P.like[0]), /跟前/, "not from across the farm");
  near(e, "medic");
  assert.equal(e.prefKnown("medic")[P.like[0]], undefined, "nobody tells you at first");
  assert.ok(e.giveGift("medic", P.fav[1]));
  assert.equal(e.ss.trust.medic, 2);
  assert.equal(e.prefKnown("medic")[P.fav[1]], "fav");
  assert.ok(said(toasts, /最爱/));
  assert.ok(e.giveGift("medic", "potato"));
  assert.equal(e.ss.trust.medic, 2, "a plain gift does nothing");
  assert.equal(e.prefKnown("medic").potato, "meh");
  assert.match(e.giftReason("medic", P.like[0]), /7 天送过 2 次/);
  e.s.day += GIFT.window;
  near(e, "medic");
  assert.ok(e.giveGift("medic", P.hate[0]));
  assert.equal(e.ss.trust.medic, 1, "a dislike costs one");
  assert.equal(e.prefKnown("medic")[P.hate[0]], "hate");
  // 生日翻倍
  e.s.day = BIRTHDAYS.medic + 28 * 3;
  near(e, "medic");
  assert.ok(e.birthday("medic"));
  assert.ok(e.giveGift("medic", P.like[0]));
  assert.equal(e.ss.trust.medic, 3);
  // 5 以上每格两份心意，8 以上三份
  e.ss.trust.farmer = 5;
  assert.equal(e.kinTrust("farmer", 1), 0);
  assert.deepEqual(e.trustPart("farmer"), { have: 1, need: 2 });
  assert.equal(e.kinTrust("farmer", 1), 1);
  assert.equal(e.ss.trust.farmer, 6);
  e.ss.trust.farmer = 8;
  e.kinTrust("farmer", 2);
  assert.equal(e.ss.trust.farmer, 8);
  e.kinTrust("farmer", 1);
  assert.equal(e.ss.trust.farmer, 9);
  // 故事里的奖励照旧一份一格
  e.ss.trust.jiang = 7;
  e.addTrust("jiang", 2);
  assert.equal(e.ss.trust.jiang, 9);
});

test("campfire talk: talking about the old days tells one taste of each person; trust grows once per person in ten days; 老琴's song lifts everyone", () => {
  const { e, toasts } = make();
  camp(e);
  evening(e);
  const f = e.fireSpot();
  Object.assign(e.s.player, { x: f.x, y: f.y + 10 });
  const people = e.talkPeople().map((p) => p.id);
  const before = Object.fromEntries(people.map((id) => [id, Object.keys(e.prefKnown(id)).length]));
  assert.ok(e.talk("past"));
  for (const id of people) {
    assert.equal(Object.keys(e.prefKnown(id)).length, before[id] + 1, id + " told one thing");
    assert.equal(e.ss.trust[id] || 0, 1, id);
  }
  assert.ok(said(toasts, /说起以前/));
  // 第二天还是这几个人围着火（营火边坐的是信任最低的三个，把别人的信任抬上去）
  for (const p of e.people()) if (!people.includes(p.id)) e.ss.trust[p.id] = 6;
  e.s.day++;
  evening(e);
  assert.deepEqual(e.talkPeople().map((p) => p.id).sort(), [...people].sort());
  e.talk("past");
  for (const id of people) assert.equal(e.ss.trust[id], 1, id + " not again within ten days");
  assert.ok(said(toasts, /刚聊过/));
  // 十天以后又能长
  e.s.day += TALK_RULES.cd;
  evening(e);
  e.talk("past");
  for (const id of people) assert.equal(e.ss.trust[id], 2, id + " after ten days");
  // 老琴教的「起个头」：聊什么都 +3
  e.kin.skills.push("song");
  e.s.day++;
  evening(e);
  const r = e.resident("farmer");
  r.morale = 50;
  e.talk("future");
  assert.equal(r.morale, 57, "future +4 and the song +3");
});

// ================= 心里话 =================
test("heart talks: at trust 3 on a peaceful evening 阿禾 waits at the field; E opens the talk; the second one sends you to a cupboard in the residential ruin; the third takes the tin and teaches seed saving", () => {
  const { e } = make();
  camp(e);
  e.ss.trust.farmer = 2;
  evening(e);
  assert.match(e.heartReason("farmer"), /信任到 3/);
  e.ss.trust.farmer = 3;
  e.s.minute = 12 * 60;
  assert.match(e.heartReason("farmer"), /19:00/);
  evening(e);
  assert.equal(e.heartReason("farmer"), "");
  assert.deepEqual(e.heartWaiting(), ["farmer"]);
  // 长夜、营地太吵的晚上不说
  e.hn.noise.v = 6;
  assert.match(e.heartReason("farmer"), /太吵/);
  e.hn.noise.v = 0;
  // 傍晚她走到田边等
  hour(e, 19);
  assert.deepEqual(e.resident("farmer").target, { x: 726, y: 470 });
  // 按 E 打开心里话
  near(e, "farmer");
  const r = e.resident("farmer");
  const o = e.objects.find((x) => x.type === "resident" && x.resident === "farmer");
  Object.assign(o, { x: r.x, y: r.y });
  let menu = null;
  const emit = e.emit.bind(e);
  e.emit = (t, d) => (t === "menu" ? (menu = d) : emit(t, d));
  e.nearestObject = () => o;
  e.interact();
  delete e.nearestObject;
  assert.equal(menu?.view, "kinHeart");
  assert.match(view(e, "kinHeart", "farmer"), /种子袋/);
  const out = e.heartPick("farmer", 0);
  assert.ok(out.lines.some((l) => /替我记着/.test(l)));
  assert.equal(e.heart("farmer").seg, 1);
  assert.equal(e.ss.trust.farmer, 4, "the talk itself +1");
  assert.equal(e.prefKnown("farmer").kinSeedTin, "fav", "you learn what she loves");
  // 第二段：托你去废弃居民区
  e.ss.trust.farmer = 6;
  near(e, "farmer");
  const out2 = e.heartPick("farmer", 1);
  assert.ok(out2.lines.some((l) => /废弃居民区/.test(l)));
  assert.equal(e.heart("farmer").req, 1);
  assert.match(e.heartReason("farmer"), /带回来/);
  go(e, "residential");
  const cache = e.objects.find((x) => x.type === "kinCache" && x.who === "farmer");
  assert.ok(cache, "the cupboard is marked");
  Object.assign(e.s.player, { x: cache.x, y: cache.y });
  e.nearestObject = () => cache;
  e.interact();
  delete e.nearestObject;
  assert.equal(qty(e, "kinSeedTin"), 1);
  go(e, "residential");
  assert.ok(!e.objects.some((x) => x.type === "kinCache"), "taken once");
  // 第三段：交出罐子，学会留种
  go(e, "farm");
  e.ss.trust.farmer = 9;
  evening(e);
  near(e, "farmer");
  const out3 = e.heartPick("farmer", 0);
  assert.ok(out3.lines.some((l) => /留种/.test(l)));
  assert.equal(qty(e, "kinSeedTin"), 0);
  assert.ok(e.hasSkill("seedSave"));
  assert.equal(e.heart("farmer").seg, 3);
  assert.match(e.heartReason("farmer"), /都说完了/);
});

test("heart talks: a long night or a horde on the way keeps people quiet; on the vigil night after the names are read they talk at the plaza", () => {
  const { e } = make();
  camp(e);
  e.ss.trust.jiang = 3;
  e.s.day = 31; // 长夜
  evening(e);
  if (e.isLongNight(e.s.day)) assert.match(e.heartReason("jiang"), /长夜/);
  e.s.day = 33;
  e.s.horde.phase = "warning";
  assert.match(e.heartReason("jiang"), /尸潮/);
  e.s.horde.phase = "won";
  // 守夜纪念日：念过名字，广场上也说得出口（还没到傍晚也行）
  e.s.day = 28 * 2;
  assert.equal(e.festivalKind(e.s.day), "vigil");
  e.s.minute = 17 * 60;
  go(e, "farm", PLAZA.x, PLAZA.y + 30);
  assert.match(e.heartReason("jiang"), /19:00/);
  assert.ok(e.vigilRead());
  assert.equal(e.heartReason("jiang"), "");
});

// ================= 本事 =================
test("skills: seed saving, better bandaging, a repair kit kept half the time, half the cloth for armour, a faster cook fire, one part saved, and reading the water while reeling", () => {
  const { e } = make();
  camp(e);
  e.kin.skills = Object.keys(SKILLS);
  // 包扎
  assert.equal(e.medBonus("bandage") - Almanac.Engine.prototype.medBonus.call(e, "bandage"), 18);
  // 补衣服
  const jacket = "leatherJacket";
  const base = Almanac.Engine.prototype.repairCost.call(e, jacket);
  if (base?.cloth) assert.equal(e.repairCost(jacket).cloth, Math.max(1, Math.ceil(base.cloth / 2)));
  // 火候
  assert.deepEqual(e.stationLanes({ type: "cook" }, 10), [12.5]);
  assert.deepEqual(e.stationLanes({ type: "workbench" }, 10), [10]);
  // 省一个零件
  assert.equal(e.effectiveCost({ parts: 3, scrap: 2 }).parts, 2);
  assert.equal(e.effectiveCost({ parts: 1 }).parts, 1);
  // 量准了再修：一半的机会修理包回到仓库
  let kept = 0;
  for (let i = 0; i < 40; i++) {
    const b = { id: "f" + i, type: "fence", x: 1200, y: 400, rotation: 0, hp: 20 };
    e.s.buildings.push(b);
    e.s.storage.repairKit = 1;
    e.s.minute = 600 + i;
    assert.ok(e.kitRepair(b));
    kept += qty(e, "repairKit");
  }
  assert.ok(kept > 10 && kept < 30, "about half: " + kept);
  // 留种：当季的菜收下来两成机会多一颗种子
  e.s.day = 3; // 回暖：土豆当季
  let seeds = 0;
  for (let i = 0; i < 60; i++) {
    const p = e.s.plots[i % e.s.plots.length];
    Object.assign(p, { crop: "potato", growth: 999, trait: null, quality: 0 });
    e.s.minute = 300 + i * 7;
    const s0 = e.s.storage.seedPotato || 0;
    e.harvest(p, true);
    seeds += (e.s.storage.seedPotato || 0) - s0;
  }
  assert.ok(seeds >= 5 && seeds <= 24, "about a fifth: " + seeds);
  // 看水：鱼要挣之前有记号
  e._reel = null;
  go(e, "valley", WATERS.river.x, WATERS.river.y);
  assert.ok(e.kinCast("river"));
  e.c.fishing.phase = "bite";
  e.interact();
  assert.ok(e.reeling());
  let warned = false;
  for (let i = 0; i < 400 && e.reeling(); i++) {
    e.reelTick(1 / 60, false);
    if (e.reelHud()?.warn) warned = true;
    if (e._reel) e._reel.prog = 0.5;
  }
  assert.ok(warned);
});

// ================= 门缝里的纸条 =================
test("notes: people at trust 4 slip a note under the door at dawn — at most one each a week and two a day, into the log and the morning ledger, never a page; hints are true", () => {
  const { e } = make();
  camp(e);
  for (const id of e.people().map((p) => p.id)) e.ss.trust[id] = 5;
  e.c.nextHordeDay = e.s.day + 5;
  let menus = 0;
  const emit = e.emit.bind(e);
  e.emit = (t, d) => (t === "menu" ? menus++ : emit(t, d));
  let notes = 0,
    days = 0;
  for (let d = 0; d < 21; d++) {
    const before = e.kin.noteLog.length;
    e.kinNotes(e.s.day);
    const n = e.kin.noteLog.length - before;
    assert.ok(n <= NOTE.perDay, "two a day at most");
    notes += n;
    days++;
    e.s.day++;
  }
  assert.ok(notes >= 4, "notes come: " + notes);
  assert.equal(menus, 0, "no page pops up");
  const by = {};
  for (const n of e.kin.noteLog) (by[n.from] ||= []).push(n.day);
  for (const list of Object.values(by)) for (let i = 1; i < list.length; i++) assert.ok(Math.abs(list[i - 1] - list[i]) >= NOTE.every, "a week apart");
  for (const n of e.kin.noteLog) assert.ok(!DEV.test(n.text), n.text);
  // 写尸潮的那种提醒说的是真的
  const horde = e.kin.noteLog.find((n) => /尸潮大概第/.test(n.text));
  if (horde) assert.match(horde.text, new RegExp("第 " + e.c.nextHordeDay + " 天"));
  // 醒来的账本里有一句
  e.kin.morning = { day: e.s.day, notes: ["阿禾"], dog: "", breakfast: "" };
  const L = e.ledger(e.s.day - 1, e.s.money);
  assert.match(L.lines.join("|"), /门缝里有 1 张纸条（阿禾）/);
});

// ================= 节庆 =================
test("festivals: from 16:00 people walk to the plaza; a word with each lifts their mood and tells a taste; the lantern night's six lamps keep the night walkers away; seeds are swapped; names are read at the stone", () => {
  const { e, toasts } = make();
  camp(e);
  e.s.day = 14; // 灯火夜
  assert.equal(e.festivalKind(14), "lanterns");
  hour(e, 16);
  const r = e.resident("farmer");
  assert.ok(Math.hypot(r.target.x - PLAZA.x, r.target.y - PLAZA.y) < PLAZA.r + 30, "residents head for the plaza");
  assert.ok(e.whereNow("he").label.includes("广场"));
  go(e, "farm", PLAZA.x, PLAZA.y + 40);
  r.morale = 50;
  assert.ok(e.festChat("farmer"));
  assert.equal(r.morale, 53);
  assert.equal(e.festChat("farmer"), false, "once each");
  // 路灯
  e.s.minute = 16 * 60 + 30;
  e.assignRegion();
  const lamps = e.objects.filter((o) => o.type === "kinLamp");
  assert.equal(lamps.length, LAMPS.length);
  for (const [i, p] of LAMPS.entries()) {
    Object.assign(e.s.player, { x: p.x, y: p.y + 10 });
    assert.ok(e.lightLamp(i));
  }
  assert.ok(e.lampsFull());
  assert.ok(said(toasts, /六盏路灯全亮了/));
  e.s.minute = PROWL.from + 5;
  e.ut.prowl = 0;
  e.tickProwl();
  assert.equal(e.ut.prowlOn, false, "no night walkers tonight");
  // 不点灯的灯火夜照常掷
  const { e: dark } = make();
  camp(dark);
  dark.s.day = 14;
  dark.s.minute = 20 * 60 + 10;
  go(dark, "farm", LAMPS[0].x, LAMPS[0].y);
  assert.equal(dark.lightLamp(0), false, "too late after 20:00");
  // 换种集
  const { e: s2 } = make();
  camp(s2);
  s2.s.day = 7;
  s2.s.minute = 17 * 60;
  go(s2, "farm", PLAZA.x, PLAZA.y + 40);
  stock(s2, { seedPotato: 30 });
  const plan = s2.swapPlan();
  assert.equal(plan.give, "seedPotato", "the seed you have most of");
  assert.notEqual(plan.get, "seedPotato");
  const give0 = qty(s2, plan.give),
    got0 = qty(s2, plan.get);
  assert.ok(s2.seedSwap());
  assert.equal(qty(s2, plan.give), give0 - 2);
  assert.equal(qty(s2, plan.get), got0 + 2);
  assert.equal(s2.seedSwap(), false, "once");
  // 守夜纪念日念名字
  const { e: v } = make();
  camp(v);
  v.s.day = 28;
  v.s.minute = 18 * 60;
  go(v, "farm", PLAZA.x, PLAZA.y + 40);
  const m0 = v.resident("medic").morale;
  assert.ok(v.vigilRead());
  assert.equal(v.resident("medic").morale, Math.min(100, m0 + 4));
});

// ================= 搭伙过日子 =================
test("partner: trust 8 and two heart talks, a handmade ring; trust 10 and all three talks, say it by the fire; the next day a feast for the camp; then breakfast every morning and watering or mending on alternate days", () => {
  const { e, toasts } = make();
  camp(e);
  stock(e, { kinRing: 1 });
  near(e, "medic");
  assert.match(e.partnerGiftReason("medic", "kinRing"), /信任到 8/);
  e.ss.trust.medic = 8;
  assert.match(e.partnerGiftReason("medic", "kinRing"), /心里话/);
  e.kin.heart.medic = { seg: 2, pick: [0, 0], req: 1, got: true };
  assert.equal(e.partnerGiftReason("tangjiu", "kinRing").length > 0, true);
  assert.ok(e.giveGift("medic", "kinRing"));
  assert.equal(e.kin.partner.stage, "near");
  assert.equal(qty(e, "kinRing"), 0);
  // 说开：信任 10、三段心里话、傍晚、营火边
  evening(e);
  const f = e.fireSpot();
  Object.assign(e.s.player, { x: f.x, y: f.y });
  assert.match(e.confessReason("medic"), /信任到 10/);
  e.ss.trust.medic = 10;
  assert.match(e.confessReason("medic"), /三段/);
  e.kin.heart.medic.seg = 3;
  assert.equal(e.confessReason("medic"), "");
  assert.ok(e.confess("medic", true));
  assert.equal(e.kin.partner.stage, "set");
  // 请客：第二天在广场
  go(e, "farm", PLAZA.x, PLAZA.y + 20);
  assert.match(e.feastReason(), /第二天/);
  e.s.day++;
  assert.match(e.feastReason(), /炖汤/);
  stock(e, PARTNER.feast);
  assert.ok(e.feast());
  assert.equal(e.kin.partner.stage, "home");
  assert.ok(said(toasts, /全营在纪念石前吃了一顿/));
  // 早饭和帮忙
  const b0 = qty(e, BREAKFAST);
  for (const p of e.s.plots.slice(0, 8)) Object.assign(p, { crop: "radish", growth: 0, wateredDay: 0 });
  const fence = { id: "pf", type: "fence", x: 1200, y: 400, rotation: 0, hp: 50 };
  e.s.buildings.push(fence);
  e.s.day = 2 * Math.ceil(e.s.day / 2); // 双数天浇田
  e.partnerMorning(e.s.day);
  assert.equal(qty(e, BREAKFAST), b0 + 1);
  assert.ok(e.s.plots.slice(0, 8).filter((p) => e.plotWatered(p)).length >= PARTNER.water);
  e.s.day++;
  e.partnerMorning(e.s.day);
  assert.ok(fence.hp > 50, "mended on the other day");
  // 账本
  e.kin.morning.day = e.s.day;
  assert.match(e.ledger(e.s.day - 1, e.s.money).lines[2], /早饭/);
});

test("partner: on a long night they stand beside you and fight, may be hurt and then rest two days; they are off their usual post meanwhile", () => {
  const { e, toasts } = make();
  camp(e);
  e.kin.partner = { id: "medic", stage: "home", day: 1, hurt: 0 };
  go(e, "farm", 830, 480);
  const ln = e.s.longnight;
  ln.night = { day: e.s.day, wave: 0 };
  e.allyUpdate(0.05);
  assert.ok(e._kinAlly, "beside you");
  assert.ok(Math.hypot(e._kinAlly.x - 830, e._kinAlly.y - 480) < 90);
  assert.equal(e.residentActive(e.resident("medic")), false, "not on her post");
  // 一只贴身的感染者
  const z = e.enemy("slow", e._kinAlly.x + 10, e._kinAlly.y);
  e.enemies.push(z);
  for (let i = 0; i < 400 && !e._kinAlly.down && !z.dead; i++) {
    z.x = e._kinAlly.x + 10;
    z.y = e._kinAlly.y;
    e.allyUpdate(0.1);
  }
  assert.ok(z.dead || e._kinAlly.down);
  if (e._kinAlly.down) {
    assert.ok(e.partnerHurt());
    assert.ok(said(toasts, /挂了彩/));
  }
  ln.night = null;
  e.allyUpdate(0.05);
  assert.equal(e._kinAlly, null, "gone after the night");
  // 血掉到三成：往农舍撤，撤回屋里不算挂彩
  const { e: e2, toasts: t2 } = make();
  camp(e2);
  e2.kin.partner = { id: "medic", stage: "home", day: 1, hurt: 0 };
  go(e2, "farm", 830, 480);
  e2.s.longnight.night = { day: e2.s.day, wave: 0 };
  e2.allyUpdate(0.05);
  e2._kinAlly.hp = Math.floor(PARTNER.ally.hp * PARTNER.ally.retreat);
  e2.allyUpdate(0.05);
  assert.ok(e2._kinAlly.back);
  assert.ok(said(t2, /撑不住了，往农舍撤/));
  for (let i = 0; i < 600 && !e2._kinAlly.away; i++) e2.allyUpdate(0.1);
  assert.ok(e2._kinAlly.away, "made it home");
  assert.equal(e2.partnerHurt(), false, "not hurt");
  assert.equal(e2.residentActive(e2.resident("medic")), Almanac.Engine.prototype.residentActive.call(e2, e2.resident("medic")), "back to her own business");
  // 只挨贴在他身上、离他比离你近的那些的打
  e2._kinAlly = null;
  e2.allyUpdate(0.05);
  const a = e2._kinAlly,
    hp0 = a.hp;
  const near = e2.enemy("slow", e2.s.player.x + 6, e2.s.player.y);
  e2.enemies.push(near);
  for (let i = 0; i < 20; i++) {
    near.x = e2.s.player.x + 6;
    near.y = e2.s.player.y;
    e2.allyUpdate(0.1);
  }
  assert.equal(a.hp, hp0, "the one on you is yours");
});

// ================= 收留孩子 =================
test("kids: a passing mother with a child may leave the child with the camp; with a bed the child stays, learns a craft from a master in seven days, helps every day and eats a meal each evening", () => {
  const { e, toasts } = make();
  camp(e);
  e.ss.lodger = { name: "带孩子的梅姐", look: 1, gift: "seeds", stay: false, phase: "staying", day: e.s.day, qin: false };
  let asked = false;
  for (let i = 0; i < 30 && !asked; i++) {
    e.kin.ask = null;
    e.ss.lodger = { name: "带孩子的梅姐", look: 1, gift: "seeds", stay: false, phase: "staying", day: e.s.day, qin: false };
    e.s.day++;
    e.lodgerMorning();
    asked = !!e.kin.ask;
  }
  assert.ok(asked, "she asks at some point");
  assert.equal(e.kin.ask.name, "小苗");
  assert.ok(said(toasts, /20:00 前/));
  go(e, "farm");
  assert.ok(e.objects.some((o) => o.type === "kinKidAsk"));
  assert.match(view(e, "kinKid"), /留下他/);
  assert.ok(e.kidDecide(true));
  assert.equal(e.kin.kids.length, 1);
  const kid = e.kin.kids[0];
  assert.ok(e.kidLearn(kid.id, "farmer"));
  e.s.day += KIDS.learn;
  hour(e, 6);
  assert.ok(kid.learned);
  for (const p of e.s.plots.slice(0, 4)) Object.assign(p, { crop: "radish", growth: 0, wateredDay: 0 });
  e.kidHour(7);
  assert.ok(e.s.plots.slice(0, 4).filter((p) => e.plotWatered(p)).length >= 2);
  // 晚饭：没口粮就饿着
  e.s.storage = {};
  e.s.inventory = {};
  e.kidHour(18);
  assert.equal(kid.hungry, 1);
  // 天黑没答复：她带着孩子走
  e.kin.ask = { name: "石榴", from: "刘婶", day: e.s.day, look: 0 };
  hour(e, 20);
  assert.equal(e.kin.ask, null);
});

// ================= 麦穗 =================
test("Maisui: with a bond of 10 she brings something home some mornings; below that nothing", () => {
  const { e } = make();
  camp(e);
  e.f.dog.rescued = true;
  e.fr.dog.bond = 9;
  for (let d = 1; d < 30; d++) e.dogFetch(d);
  assert.equal(e.kin.stats.dogFetch, 0);
  e.fr.dog.bond = DOG_FETCH.bond;
  for (let d = 30; d < 60; d++) e.dogFetch(d);
  assert.ok(e.kin.stats.dogFetch >= 4 && e.kin.stats.dogFetch <= 18, "some mornings: " + e.kin.stats.dogFetch);
});

// ================= 收线钓鱼 =================
test("fishing: E on a bite starts the reel; hold to reel in, let go when the fish pulls; too tight snaps the line; the river's fish need 许医生 to test the water; mutants go to research", () => {
  const { e, toasts } = make();
  camp(e);
  go(e, "valley", WATERS.river.x, WATERS.river.y);
  assert.ok(e.objects.some((o) => o.type === "kinWater" && o.water === "river"));
  assert.ok(e.kinCast("river"));
  assert.equal(e.kin.cast.water, "river");
  e.c.fishing.phase = "bite";
  e.interact();
  assert.ok(e.reeling());
  assert.equal(e.c.fishing, null);
  // 收线时不能走、不能翻滚、不能用工具
  const p0 = { ...e.s.player };
  e.update(0.05, { x: 1, y: 0, reel: true });
  assert.equal(Math.round(e.s.player.x), Math.round(p0.x));
  assert.match(e.dodgeReason(), /收线/);
  assert.equal(e.use({ x: 0, y: 0 }), false);
  // 一直按着，线断
  for (let i = 0; i < 2000 && e.reeling(); i++) e.reelTick(1 / 60, true);
  assert.ok(!e.reeling());
  assert.ok(said(toasts, /线绷得太紧/) || said(toasts, /钓到/));
  // 收上来一条：河里的鱼
  assert.ok(e.kinCast("river"));
  e.c.fishing.phase = "bite";
  e.interact();
  const sp = e._reel.sp;
  assert.equal(FISH[sp].water, "river");
  e._reel.prog = 0.999;
  e.reelTick(0.05, true);
  assert.equal(qty(e, sp), 1);
  assert.equal(e.kin.fish[sp], 1);
  assert.equal(qty(e, SAMPLES.river), 1, "a water sample comes with the first river fish");
  if (ITEMS[sp].type === "food") {
    e.s.inventory[sp] = 1;
    e.s.player.hunger = 20;
    assert.equal(e.consume(sp), false, "not before the water is tested");
  }
  // 许医生验水样
  assert.match(residentExtras(e, e.resident("medic")), /验溪谷的河的水样/);
  assert.ok(e.verifyWater("river"));
  assert.equal(e.kin.waters.river, true);
  assert.equal(e.edibleReason("kinMinnow"), "");
  // 变异鱼研究：第一条研究点 +1
  stock(e, { kinTwinCat: 2 });
  const c0 = e.c.researchCredits || 0;
  assert.ok(e.researchFish("kinTwinCat"));
  assert.equal(e.c.researchCredits, c0 + 1);
  assert.ok(e.researchFish("kinTwinCat"));
  assert.equal(e.c.researchCredits, c0 + 1, "only the first one counts");
  // 图鉴
  assert.match(view(e, "collection"), /鱼类图鉴 \d+\/24/);
});

test("fishing: the farm pond keeps its old catches (the loach, Jiang's runs) after the reel; the canal opens once it is dug; the sea needs its own test; leaving the map loses the fish", () => {
  const { e } = make();
  camp(e);
  go(e, "farm", 1040, 830);
  assert.ok(e.kinCast("pond"));
  e.c.fishing.phase = "bite";
  e.interact();
  assert.ok(e.reeling());
  const before = FISH_IDS.reduce((a, id) => a + qty(e, id), 0);
  e._reel.prog = 0.999;
  e.reelTick(0.05, true);
  assert.equal(FISH_IDS.reduce((a, id) => a + qty(e, id), 0), before + 1);
  // 水渠没挖通没有钓鱼点
  e.f.canals.dug = [0];
  e.assignRegion();
  assert.ok(!e.objects.some((o) => o.type === "kinWater" && o.water === "canal"));
  e.f.canals.dug = [0, 1, 2, 3, 7, 11, 15];
  e.assignRegion();
  assert.ok(e.waterOpen("canal") === !!(e.canalReady?.() || e.f.canals.dug.includes(15)));
  // 海边
  go(e, "shipyard", WATERS.sea.x, WATERS.sea.y);
  assert.ok(e.kinCast("sea"));
  e.c.fishing.phase = "bite";
  e.interact();
  assert.equal(FISH[e._reel.sp].water, "sea");
  e.travel("farm");
  assert.ok(!e.reeling(), "walking off loses the fish");
});

test("reel tuning: with a person's reaction time common fish come in about two times in three, rare ones about one in three; reading the water helps", () => {
  const { e } = make();
  let seed = 99;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed / 2147483648);
  const once = (tier, skill) => {
    e.kin.skills = skill ? ["readWater"] : [];
    const T = TIERS[tier];
    e._reel = { water: "river", sp: "kinMinnow", tier, bait: false, biteAt: 2, prog: T.start, tense: 0.15, t: 0, pull: 0, pullT: 0, next: T.every[0] + rng() * (T.every[1] - T.every[0]) * 0.6, warn: false, held: false, r: rng };
    const tau = 0.22 + rng() * 0.16;
    let hold = true,
      t = 0,
      pullOn = -1,
      pullOff = -99,
      warnOn = -1,
      high = -1,
      low = -1,
      lapse = 0,
      lapseW = 0,
      res = null;
    e.reelLose = (why) => ((res = why), (e._reel = null));
    e.reelLand = () => ((res = "land"), (e._reel = null));
    while (e._reel && t < 40) {
      const R = e._reel;
      if (R.pull > 0 && pullOn < 0) {
        pullOn = t;
        lapse = rng() < 0.2 ? 0.3 : 0;
      }
      if (R.pull <= 0 && pullOn >= 0) {
        pullOn = -1;
        pullOff = t;
      }
      if (R.warn && warnOn < 0) {
        warnOn = t;
        lapseW = rng() < 0.2 ? 0.3 : 0;
      }
      if (!R.warn) warnOn = -1;
      if (R.tense >= 0.8 && high < 0) high = t;
      if (R.tense < 0.8) high = -1;
      if (R.tense < 0.45 && low < 0) low = t;
      if (R.tense >= 0.45) low = -1;
      const seePull = pullOn >= 0 && t - pullOn >= tau + lapse,
        seeWarn = warnOn >= 0 && t - warnOn >= tau + lapseW,
        seeHigh = high >= 0 && t - high >= tau,
        calm = pullOn < 0 && t - pullOff >= tau && low >= 0 && t - low >= tau * 0.5;
      if (hold && (seePull || seeWarn || seeHigh)) hold = false;
      else if (!hold && calm && !seeWarn) hold = true;
      e.reelTick(1 / 60, hold);
      t += 1 / 60;
    }
    delete e.reelLose;
    delete e.reelLand;
    return res === "land";
  };
  const rate = (tier, skill, n = 600) => {
    let ok = 0;
    for (let i = 0; i < n; i++) if (once(tier, skill)) ok++;
    return ok / n;
  };
  const common = rate("common", false),
    rare = rate("rare", false);
  assert.ok(common >= 0.58 && common <= 0.77, "common " + common);
  assert.ok(rare >= 0.23 && rare <= 0.42, "rare " + rare);
  assert.ok(rate("common", true) > common + 0.03, "reading the water helps");
});

// ================= 商队、柜子 =================
test("the caravan brings one rare thing each visit (a love of someone you know, an ornament or in-season seeds) and still shows six at most; cabinets in the right ruin may hold a keepsake for someone you know", () => {
  const { e } = make();
  camp(e);
  e.o.caravan.next = e.s.day;
  e.arriveCaravan();
  const rare = e.o.caravan.offers.filter((o) => o.kinRare);
  assert.equal(rare.length, 1);
  assert.ok(e.o.caravan.offers.length <= 6);
  assert.match(e.offerName(rare[0]), /^稀罕货 · /);
  assert.ok(Engine.parse(e.serialize()), "saves fine");
  // 柜子：在对的废墟里翻对的柜子，会翻到某个认识的人最爱的稀罕物
  go(e, "residential");
  let found = 0;
  for (let i = 0; i < 400; i++) {
    const res = e.rollContainer({ id: "kc" + i, ukind: "wardrobe" }, 40 + i);
    if (res.bundle.kinGlasses || res.bundle.kinStrings || res.bundle.kinSeedTin) found++;
  }
  assert.ok(found > 4 && found < 60, "now and then: " + found);
  e.s.storage.kinGlasses = 1;
  e.s.storage.kinStrings = 1;
  e.s.storage.kinSeedTin = 1;
  let again = 0;
  for (let i = 0; i < 200; i++) if (Object.keys(e.rollContainer({ id: "kd" + i, ukind: "wardrobe" }, 40 + i).bundle).some((k) => KEEPSAKES[k] && ["residential"].includes(KEEPSAKES[k].home.region) && KEEPSAKES[k].home.kinds.includes("wardrobe"))) again++;
  assert.equal(again, 0, "not while you already hold one");
});

// ================= 各有各的一天 =================
test("a day of their own: the people page says where everyone is and marks them; idle people sit by the fire in the evening; rain sends 秦奶奶 under the eaves; the day before a horde everyone stacks sandbags at the gate", () => {
  const { e } = make();
  camp(e);
  e.s.minute = 10 * 60;
  assert.equal(e.whereNow("laoqin").label.startsWith("通信站"), true);
  assert.equal(e.whereNow("jiang").label, "池塘边");
  assert.equal(e.whereNow("he").label, "灶台旁");
  e.s.minute = 12 * 60;
  assert.equal(e.whereNow("he").label, "饭桌边");
  e.s.minute = 3 * 60;
  assert.ok(e.whereNow("laoqin").away);
  e.s.minute = 10 * 60;
  e.s.weather = "小雨";
  assert.equal(e.whereNow("qin").label, "农舍檐下");
  e.s.weather = "晴朗";
  go(e, "farm", 200, 900);
  const html = view(e, "people");
  assert.match(html, /这会儿：/);
  assert.match(html, /data-action="kinMark" data-id="he"/);
  assert.ok(!DEV.test(html));
  const c = ctx(e);
  UI.handleCampaignAction("kinMark", btn("kinMark", "he"), c);
  assert.equal(e.guidance.target.label, "何大勺");
  // 傍晚坐到营火边
  e.s.minute = 19 * 60 - 0.5;
  e.c.workClock = 59.5;
  e.advanceMinutes(1);
  const f = e.fireSpot();
  const idle = e.c.residents.filter((r) => r.workRole === "rest" && e.residentActive(r));
  for (const r of idle) assert.ok(Math.hypot(r.target.x - f.x, r.target.y - f.y) < 90, r.id + " by the fire");
  // 尸潮前一天：营门
  e.c.nextHordeDay = e.s.day + 1;
  hour(e, 15);
  const r = e.c.residents.find((x) => e.residentActive(x) && x.workRole !== "guard");
  if (r) assert.ok(Math.hypot(r.target.x - 1300, r.target.y - 410) < 90, "at the gate");
});

// ================= 界面 =================
test("UI: the people page, the heart talk, the fire-side talk, the plaza, the medic's card and the alert bar speak plainly; buttons do what they say", () => {
  const { e } = make();
  camp(e);
  e.ss.trust.jiang = 3;
  evening(e);
  for (const v of ["people", "kinHeart", "kinConfess", "kinKid", "plaza", "talk", "collection"]) {
    const html = view(e, v, v === "kinHeart" ? "jiang" : v === "kinConfess" ? "medic" : "");
    assert.ok(!DEV.test(html), v);
  }
  assert.match(view(e, "people"), /江伯像是有话想说/);
  const alerts = UI.campaignHud(e).alerts;
  assert.match(alerts, /江伯在池塘边，像是有话想说/);
  // 心里话：选一句，页面换成他的回答
  near(e, "jiang");
  const c = ctx(e);
  UI.handleCampaignAction("kinHeartPick", btn("kinHeartPick", "jiang:0"), c);
  assert.ok(c.ui.kinOut);
  assert.match(UI.renderCampaignView(e, { view: "kinHeart", id: "jiang", kinOut: c.ui.kinOut }), /下游几个村子/);
  assert.equal(e.heart("jiang").seg, 1);
  // 送礼按钮只在跟前出现
  stock(e, { bread: 2 });
  near(e, "jiang");
  assert.match(view(e, "people"), /data-action="kinGift" data-id="jiang\|/);
  go(e, "farm", 200, 900);
  assert.doesNotMatch(view(e, "people", "jiang").split("kin-jiang")[1].split("</li>")[0], /data-action="kinGift"/);
});

// ================= 小处 =================
test("small things: a bite and a lost fish make a splash; 刘婶 with her grandson is on the lodger list; the first bed in the residents' row reads as home, not the clinic", async () => {
  const { SFX, soundFor, KIN_SOUND_EVENTS } = await import("../dist/audio-data.js");
  for (const type of KIN_SOUND_EVENTS) assert.ok(SFX[soundFor({ type }).sfx], type);
  const { LODGER_NAMES } = await import("../dist/seasons-data.js");
  assert.ok(LODGER_NAMES.includes("带外孙的刘婶") && LODGER_NAMES.includes("带孩子的梅姐"));
  assert.equal(new Set(LODGER_NAMES).size, LODGER_NAMES.length);
  const { e } = make();
  camp(e);
  assert.equal(e.placeLabel({ x: 755, y: 350 }), "住处");
  assert.equal(e.placeLabel({ x: 695, y: 355 }), "诊所");
  // 咬钩的那一声在浮漂那里
  go(e, "valley", WATERS.river.x, WATERS.river.y);
  e.kinCast("river");
  e.c.fishing.phase = "bite";
  e.events.length = 0;
  e.interact();
  const ev = e.events.find((x) => x.type === "reel");
  assert.ok(ev && ev.x === WATERS.river.bob.x);
});

test("order board: an order from 阿禾, 许医生 or 陈工 counts as one portion of goodwill, once a week per person, and the board says so", () => {
  const { e } = make();
  camp(e);
  e.s.day = 10;
  e.ss.trust.farmer = 2;
  const order = (id) => ({ id, who: "farmer", name: "阿禾", item: "radish", n: 2, due: e.s.day + 2, pay: { wood: 2 } });
  e.bt.orders.list = [order("oa"), order("ob")];
  stock(e, { radish: 4 });
  let html = view(e, "bOrders");
  assert.match(html, /算一份心意（每人 7 天算一回）/);
  assert.equal((html.match(/ · 算一份心意/g) || []).length, 2);
  assert.ok(e.deliverBoardOrder("oa"));
  assert.equal(e.ss.trust.farmer, 3);
  html = view(e, "bOrders");
  assert.match(html, /阿禾这几天已经记着你的好了（7 天后再算）/);
  assert.ok(e.deliverBoardOrder("ob"));
  assert.equal(e.ss.trust.farmer, 3, "not twice in a week");
  // 一周以后再算；5 以上两份一格
  e.s.day += 7;
  e.ss.trust.farmer = 5;
  e.bt.orders.list = [order("oc")];
  stock(e, { radish: 2 });
  assert.ok(e.deliverBoardOrder("oc"));
  assert.equal(e.ss.trust.farmer, 5);
  assert.deepEqual(e.trustPart("farmer"), { have: 1, need: 2 });
  assert.ok(!DEV.test(view(e, "bOrders")));
});

test("pickpocketing: a glance into someone's pockets before reaching in tells one of their tastes (one try per person a day)", () => {
  const { e, toasts } = make();
  camp(e);
  e.s.day = 12;
  e.s.minute = 10 * 60;
  for (const k of ["agriculture", "manufacturing", "exploration", "combat"]) e.s.xp[k] = 160;
  assert.ok(e.learnTalent("pickpocket"));
  go(e, "farm");
  const ob = e.objects.find((o) => o.type === "resident" && o.resident === "farmer");
  Object.assign(e.s.player, { x: ob.x + 4, y: ob.y - 46 });
  e.f.crouch = true;
  for (let s = 1; s < 20000; s++) {
    e.th.seed = s;
    if (e.stealRoll("farmer") < 0.1) break;
  }
  const known = Object.keys(e.prefKnown("farmer")).length;
  const st = e.startSteal("farmer");
  assert.equal(st.phase, "pick");
  assert.equal(Object.keys(e.prefKnown("farmer")).length, known + 1);
  assert.ok(st.lines.some((l) => /瞄了一眼口袋：阿禾(最爱|喜欢|讨厌)/.test(l)));
  assert.ok(said(toasts, /瞄了一眼口袋/));
  e.stealStop();
});

test("kids: out with their master in the daytime, indoors after dark and while the camp is fighting", () => {
  const { e } = make();
  camp(e);
  e.kin.kids = [{ id: "k1", name: "小苗", look: 0, from: "梅姐", day: 1, master: "farmer", start: 1, learned: false, fed: 0, hungry: 0 }];
  go(e, "farm");
  e.s.minute = 10 * 60;
  e.assignRegion();
  assert.ok(e.objects.some((o) => o.type === "kinKid"));
  e.s.minute = 22 * 60;
  e.update(0.016, {});
  assert.ok(!e.objects.some((o) => o.type === "kinKid"), "indoors at night");
  e.s.minute = 10 * 60;
  e.update(0.016, {});
  assert.ok(e.objects.some((o) => o.type === "kinKid"));
  e.s.horde.phase = "warning";
  e.update(0.016, {});
  assert.ok(!e.objects.some((o) => o.type === "kinKid"), "indoors when a horde is coming");
});

test("the thing someone asked you to find is not handed over as an ordinary gift (it waits for their third talk)", () => {
  const { e } = make();
  camp(e);
  e.kin.heart.farmer = { seg: 2, pick: [0, 0], req: 1, got: true };
  e.kin.know.farmer = { kinSeedTin: "fav" };
  stock(e, { kinSeedTin: 1, jam: 1 });
  near(e, "farmer");
  assert.match(e.giftReason("farmer", "kinSeedTin"), /托你找的，傍晚去田边交给她/);
  assert.ok(!e.giftOptions("farmer").known.includes("kinSeedTin"));
  assert.equal(e.giveGift("farmer", "kinSeedTin"), false);
  assert.equal(qty(e, "kinSeedTin"), 1, "still in hand");
  // 第三段说完以后就是普通的最爱了
  e.kin.heart.farmer.seg = 3;
  assert.equal(e.giftReason("farmer", "kinSeedTin"), "");
});

test("every preference can really be given: the farmer's seed pack and herb seeds are gifts like anything else; quest things and water samples are not", () => {
  const { e } = make();
  camp(e);
  for (const id of Object.keys(PREFS)) {
    const P = prefsOf(id);
    for (const x of [...P.fav, ...P.like, ...P.hate]) assert.ok(e.giftable(x), id + " " + x);
  }
  assert.equal(e.giftable("kinSampleRiver"), false);
  assert.equal(e.giftable("blueprint"), false);
  stock(e, { seedMystery: 1 });
  e.s.inventory.seedMystery = 1;
  near(e, "farmer");
  assert.ok(e.giveGift("farmer", "seedMystery"));
  assert.equal(e.ss.trust.farmer, 2, "her favourite");
});
