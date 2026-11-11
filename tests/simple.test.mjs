// v0.39.0「一物一用」：一样东西只做一件事，按下去做的就是头上写着的那件事；说明卡、菜单十项、顶栏数字的卡。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Engine, freshState } from "../dist/ahead.js";
import { BUILDINGS, REGIONS, RECIPES, ITEMS } from "../dist/data.js";
import { VERB, BVERB, BCARD, BUILD_GROUPS, MENUS, HUD_CARD, PAGE_CARD, WORDING } from "../dist/simple-data.js";
import { shortName, cleanCtx, fromOld, toolVerb } from "../dist/simple.js";
import { Renderer } from "../dist/simple-renderer.js";
import { DISTRICTS } from "../dist/district-data.js";

const DT = 0.05;
const DEV = /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN/;
const make = (state = freshState(), seed = 39001) => {
  state.undertow.seed = seed;
  const toasts = [];
  const e = new Engine(state, (text, tone) => toasts.push({ text, tone }));
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  return { e, toasts };
};
const run = (e, secs, input = { x: 0, y: 0 }) => {
  for (let t = 0; t < secs; t += DT) e.update(DT, input);
};
const goRegion = (e, id) => {
  e.s.region = id;
  e.enemies = e.s.enemies[id] ||= [];
  e.assignRegion();
};
const menus = (e) => e.events.filter((x) => x.type === "menu");
// 站到一样东西跟前（别的东西挪开），按一下交互
function pressAt(e, o) {
  for (const x of e.objects) if (x !== o && Math.hypot(x.x - o.x, x.y - o.y) < 140) x.x += 600;
  Object.assign(e.s.player, { x: o.x, y: o.y + 22 });
  e.events.length = 0;
  e.paused = false;
  e.interact();
  return menus(e);
}

// ================= 不再弹“选一个” =================
test("two things side by side: no 'pick one' page; E acts on the nearer one, the one whose name is on the prompt", () => {
  const { e } = make();
  goRegion(e, "residential");
  for (const z of e.enemies) z.dead = true;
  const at = { x: 700, y: 640 };
  const a = { type: "crate", id: "t-a", name: "路边补给箱", x: at.x + 30, y: at.y, loot: { wood: 2 }, icon: 40 };
  const b = { type: "crate", id: "t-b", name: "废弃货架", x: at.x + 46, y: at.y + 4, loot: { scrap: 2 }, icon: 40 };
  e.objects.push(a, b);
  Object.assign(e.s.player, at);
  assert.equal(e.pickCandidates().length, 0, "never a chooser");
  assert.equal(e.nearestObject(), a);
  assert.match(e.context(a), /^路边补给箱 · 翻一翻$/);
  e.events.length = 0;
  e.interact();
  assert.ok(!menus(e).some((m) => m.view === "pick"), "no pick page");
  assert.equal(e.s.opened[a.id]?.day, e.s.day, "the nearer box was searched");
  assert.equal(e.s.opened[b.id], undefined, "the other one was not");
});

// ================= 头上那一行：名字 · 做什么 =================
test("every interactable thing on every map reads 名字 · 做什么, with no key names and no developer words", () => {
  const { e } = make();
  e.s.day = 40;
  const bad = [];
  let n = 0;
  for (const id of Object.keys(REGIONS)) {
    goRegion(e, id);
    const things = [...e.objects];
    if (id === "farm") for (const b of e.s.buildings) if (b.hp > 0) things.push({ ...b, type: "building", building: b, name: BUILDINGS[b.type].name });
    for (const o of things) {
      if (o.type === "hpDeco") continue;
      const s = e.simpleLabel(o);
      n++;
      if (!s || !/ · /.test(s) || /按\s?E|按交互|（E）|^E\s|undefined|NaN/.test(s) || DEV.test(s)) bad.push(id + ":" + o.type + " → " + s);
    }
  }
  assert.ok(n > 30, "checked " + n);
  assert.deepEqual(bad, []);
});

test("labels keep what matters right now: a damaged building says 修好它, a gate says 开门 or 关门, a full order board counts its sheets", () => {
  const { e } = make();
  const b = { id: "t-fence", type: "fence", x: 900, y: 700, rotation: 0, hp: BUILDINGS.fence.hp, open: false };
  e.s.buildings.push(b);
  const ob = { ...b, type: "building", building: b, name: "围栏" };
  assert.equal(e.simpleLabel(ob), "围栏 · 挡感染者");
  b.hp = 10;
  assert.equal(e.simpleLabel(ob), "围栏 · 修好它");
  const g = { id: "t-gate", type: "gate", x: 940, y: 700, rotation: 0, hp: BUILDINGS.gate.hp, open: false };
  e.s.buildings.push(g);
  assert.equal(e.simpleLabel({ ...g, type: "building", building: g }), "营地大门 · 开门");
  g.open = true;
  assert.equal(e.simpleLabel({ ...g, type: "building", building: g }), "营地大门 · 关门");
  // 原来的提示有用的部分留着
  assert.equal(fromOld("彭姐 · 来借粮", "彭姐"), "来借粮");
  assert.equal(fromOld("下手 · 阿禾", "阿禾"), "下手");
  assert.equal(toolVerb("劈开 · 储藏室的铁门（4 秒，半张图都听得见）"), "劈开（4 秒，半张图都听得见）");
  assert.equal(cleanCtx("阿禾 · 像是有话想说（按 E）"), "阿禾 · 像是有话想说");
  assert.equal(cleanCtx("农田 · 拔草 · 按住 E 一路做下去"), "农田 · 拔草");
  assert.equal(shortName("林姨 · 粮食商"), "林姨");
});

// ================= 一样东西一件事 =================
test("the terminal opens only the letters; the camp opens the work roster; a resident opens their own page", () => {
  const { e } = make();
  goRegion(e, "farm");
  const sign = e.objects.find((o) => o.type === "sign");
  assert.ok(sign);
  let m = pressAt(e, sign);
  assert.deepEqual(m.map((x) => x.menu + "/" + (x.view || "")), ["sx/letters"], "letters, not the journal");
  // 援建营地、居民
  e.s.storyCampaign && (e.s.storyCampaign.campBuilt = true);
  const camp = { type: "allianceCamp", name: "援建营地", x: 1200, y: 760 };
  e.objects.push(camp);
  m = pressAt(e, camp);
  assert.equal(m[0]?.menu, "camp");
  assert.equal(m[0]?.tab, "residents");
  e.objects = e.objects.filter((o) => o !== camp);
  e.recruit("farmer");
  e.assignRegion();
  const res = e.objects.find((o) => o.type === "resident" && o.resident === "farmer");
  assert.ok(res, "阿禾 is on the farm");
  assert.equal(e.simpleLabel(res), "阿禾 · 说话");
  m = pressAt(e, res);
  assert.deepEqual(m, [{ type: "menu", menu: "outpost", view: "people", id: "farmer" }], "her own page, not the work roster");
});


test("held by a titan beside an open gate, E struggles free instead of walking through (the line says so too)", () => {
  const { e } = make();
  goRegion(e, "farm");
  const gate = e.objects.find((o) => o.type === "districtGate");
  e.d.unlocked[gate.district] = true;
  e.nearestObject = () => gate;
  e.tx.hold = { escape: 0 };
  e.events.length = 0;
  e.interact();
  assert.equal(e.s.region, "farm", "did not go through the gate");
  assert.ok(e.tx.hold && e.tx.hold.escape > 0, "struggled");
  assert.doesNotMatch(e.simpleLabel(gate), /进去$/, "the line is not the gate's while held");
  e.interact();
  e.interact();
  assert.equal(e.tx.hold, null, "free");
  assert.equal(e.s.region, "farm");
  assert.deepEqual(menus(e), []);
  delete e.nearestObject;
  assert.match(e.simpleLabel(gate), /· 进去$/);
});


// ================= 自己干的事 =================
test("things dropped on the farm go into storage (old saves too); in the ruins they stay where they fell", () => {
  const st = freshState();
  st.drops = [
    { region: "farm", x: 600, y: 500, items: { scrap: 3, parts: 1 } },
    { region: "residential", x: 600, y: 500, items: { wood: 2 } },
  ];
  const before = { scrap: st.storage.scrap || 0, parts: st.storage.parts || 0 };
  const { e, toasts } = make(st);
  assert.equal(e.s.drops.length, 1, "the farm one is gone");
  assert.equal(e.s.drops[0].region, "residential");
  assert.equal(e.s.storage.scrap, before.scrap + 3);
  assert.equal(e.s.storage.parts, before.parts + 1);
  // 玩的时候掉在农场上的：下一帧进仓库，说一声
  goRegion(e, "farm");
  e.s.drops.push({ region: "farm", x: 610, y: 510, items: { ammo: 6 } });
  const ammo = e.s.storage.ammo || 0;
  run(e, 0.1);
  assert.equal(e.s.storage.ammo, ammo + 6);
  assert.ok(toasts.some((t) => /送进了仓库/.test(t.text)));
});


test("a ruin cleared by the morning card stays quiet: the corpse pile's lying infected were cleared too (the crate under it stays)", () => {
  const st = freshState();
  st.day = 20;
  st.minute = 600;
  const { e } = make(st, 39002);
  const id = "residential";
  const pile = () => {
    e.ut.evDay = e.s.day;
    e.ut.ev = { day: e.s.day, id: "pile", region: id, spot: 0, st: "wait", bits: 0, spawned: false };
  };
  pile();
  e.travel(id);
  assert.ok(e.enemies.some((z) => z.pile && !z.dead), "an ordinary day: they lie in the pile");
  e.travel("farm");
  e.dy.clear = { region: id, until: e.s.day + 1 };
  e.clearRuinNow(id);
  pile();
  e.travel(id);
  assert.ok(!e.enemies.some((z) => !z.dead && !z.boss && !z.nest && !z.hazard), "cleared: nobody gets up");
  assert.ok(e.objects.some((o) => o.ukind === "pile"), "the crate under the pile is still there");
});

// ================= 说明卡、菜单、顶栏 =================




// ================= 各页只留一件事 =================



// ================= 场景里的字 =================
test("scene labels: only the thing you face gets a line; names over other things are not drawn; foes and big words still are", () => {
  const r = Object.create(Renderer.prototype);
  const target = { type: "outpostShipping", name: "出货箱", x: 500, y: 400 };
  const other = { type: "winterMuseum", name: "档案馆", x: 800, y: 400 };
  const exit = { type: "exit", name: "林间小路", x: 1300, y: 390 };
  const foe = { x: 200, y: 300, dead: false };
  r._sl = { things: [target, other, exit], foes: [foe], p: { x: 500, y: 440 }, target, tgt: target, big: new Set(["+2 萝卜"]) };
  r._slTop = null;
  assert.equal(r.slAllow("档案馆", 800, 320, 12), false, "another thing's name: not drawn");
  assert.equal(r.slAllow("明早 +40 金币", 500, 338, 11), false, "the target's own words: replaced by the one line");
  assert.equal(r._slTop, 338, "the line goes where its words were");
  assert.equal(r.slAllow("林间小路", 1300, 330, 12), true, "the way out keeps its name");
  assert.equal(r.slAllow("攻击！", 200, 220, 12), true, "words over a foe stay");
  assert.equal(r.slAllow("+2 萝卜", 520, 380, 15), true, "floating words stay");
  r._slOwn = "self";
  assert.equal(r.slAllow("装填中", 500, 353, 11), true, "your own words stay");
  r._slOwn = other;
  assert.equal(r.slAllow("Lv.2", 100, 100, 11), false, "words drawn while drawing another thing belong to it");
  r._sl = null;
  assert.equal(r.slAllow("档案馆", 800, 320, 12), true, "outside the scene pass everything draws");
});

// ================= 存档、版本 =================
