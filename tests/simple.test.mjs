// v0.39.0「一物一用」：一样东西只做一件事，按下去做的就是头上写着的那件事；说明卡、菜单十项、顶栏数字的卡。
import test from "node:test";
import { styleOrder } from "./style-order.mjs";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Engine, freshState } from "../dist/campaign.js";
import { BUILDINGS, REGIONS, RECIPES, ITEMS } from "../dist/data.js";
import { VERB, BVERB, BCARD, BUILD_GROUPS, MENUS, HUD_CARD, PAGE_CARD, WORDING } from "../dist/simple-data.js";
import { cardHtml, buildingCardHtml, buildGroups, menusHtml, hudCardHtml, pickBlocks, lettersHtml, gateHtml, stripKey, sxAfterRender, sxWords, sxViewExtra } from "../dist/simple-ui.js";
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

test("a district gate goes straight in once the road is open, and shows the repair card before; the exit goes straight back", () => {
  const { e } = make();
  goRegion(e, "farm");
  const gate = e.objects.find((o) => o.type === "districtGate");
  assert.ok(gate, "the valley gate is on the farm");
  e.d.unlocked[gate.district] = false;
  let m = pressAt(e, gate);
  assert.equal(m[0]?.menu, "sx");
  assert.equal(m[0]?.view, "gate");
  assert.equal(m[0]?.id, gate.district);
  assert.match(e.simpleLabel(gate), /· 修通路$/);
  const html = gateHtml(e, { id: gate.district, kind: "district" });
  assert.match(html, /data-action="dUnlock"/);
  assert.match(html, new RegExp(DISTRICTS[gate.district].name + "入口"));
  assert.doesNotMatch(html, DEV);
  e.d.unlocked[gate.district] = true;
  assert.match(e.simpleLabel(gate), /· 进去$/);
  goRegion(e, "farm");
  const g2 = e.objects.find((o) => o.type === "districtGate");
  pressAt(e, g2);
  assert.equal(e.s.region, gate.district, "went in");
  const exit = e.objects.find((o) => o.type === "districtExit");
  assert.ok(exit);
  pressAt(e, exit);
  assert.equal(e.s.region, DISTRICTS[gate.district].parent, "came back out");
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

test("麦穗: E gives her a pat (feeding and orders are on the people page)", () => {
  const { e } = make();
  e.s.day = 30;
  e.f.dog.rescued = true;
  goRegion(e, "farm");
  const d = e.objects.find((o) => o.type === "partnerDog");
  if (!d || !e.dogReady?.()) return; // 没有麦穗的开局
  pressAt(e, d);
  assert.equal(e.fr.dog.petDay, e.s.day);
  const extra = sxViewExtra(e, { view: "people" });
  assert.match(extra.before, /data-action="xView" data-id="dog"/);
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

test("finished processing goes into storage by itself, counts for the story (a meal made) and says so", () => {
  const { e, toasts } = make();
  goRegion(e, "farm");
  const r = RECIPES.find((x) => x.id === "trailBread"),
    out = Object.keys(r.out)[0],
    n = r.out[out];
  assert.ok(ITEMS[out]?.food, "a meal");
  e.c.production.push({ id: "job-t1", recipe: r.id, out: { ...r.out }, cost: {}, station: r.station || "cook", remaining: 0, ready: true });
  const had = e.s.storage[out] || 0,
    food = e.r.metrics.food;
  run(e, 0.1);
  assert.equal(e.c.production.length, 0);
  assert.equal(e.s.storage[out], had + n);
  assert.equal(e.r.metrics.food, food + n, "counted as food made");
  assert.ok(toasts.some((t) => /做好了，放进了仓库/.test(t.text)));
  assert.equal(sxWords("领取一次加工好的干粮或料理"), "做好一份干粮或料理");
  assert.ok(WORDING.length >= 5);
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
test("one card everywhere: name, what it does, the benefit, how it is now, one button (none for things that work by themselves)", () => {
  const html = cardHtml({ key: "x", name: "出货箱", does: "把东西放进去，第二天卖掉", good: "钱直接入账", now: "箱里 3 样", button: { action: "oShip", id: "a", label: "放进去" } });
  assert.match(html, /<h3>出货箱<\/h3>/);
  assert.match(html, /sx-does/);
  assert.match(html, /<b>好处<\/b>/);
  assert.match(html, /<b>现在<\/b>/);
  assert.equal((html.match(/<button/g) || []).length, 1);
  assert.equal((cardHtml({ name: "喷灌头", does: "每天早上浇旁边的田" }).match(/<button/g) || []).length, 0);
  // 设施：每一种都有一句做什么；坏了的卡上是“修好它”，要拆的时候是“拆掉它”
  const { e } = make();
  for (const [id, d] of Object.entries(BUILDINGS)) {
    if (d.retired) continue;
    assert.ok(BCARD[id]?.[0], "card text for " + id);
    assert.ok(BVERB[id], "verb for " + id);
  }
  const b = { id: "t-b", type: "tower", x: 0, y: 0, hp: 20 };
  assert.match(buildingCardHtml(e, b), /data-action="repair"[^>]*>修好它/);
  assert.match(buildingCardHtml(e, b, { confirm: true }), /data-action="dismantle"[^>]*>拆掉它/);
  b.hp = BUILDINGS.tower.hp;
  assert.doesNotMatch(buildingCardHtml(e, b), /<button/);
});

test("the build page has four groups that hold every building exactly once", () => {
  const ids = Object.entries(BUILDINGS)
    .filter(([, b]) => !b.retired)
    .map(([id]) => id);
  const groups = buildGroups(ids);
  assert.deepEqual(groups.map((g) => g.title).slice(0, 4), ["种地", "吃住", "防守", "摆件"]);
  const all = groups.flatMap((g) => g.ids);
  assert.equal(all.length, ids.length);
  assert.equal(new Set(all).size, ids.length);
  assert.ok(!groups.some((g) => g.key === "other"), "nothing left over: " + groups.find((g) => g.key === "other")?.ids);
  for (const [, , list] of BUILD_GROUPS) for (const id of list) assert.ok(BUILDINGS[id], id + " exists");
});

test("the menu page lists ten menus with one line each (and the stuck button)", () => {
  const { e } = make();
  assert.equal(MENUS.length, 10);
  const html = menusHtml(e);
  for (const [name, line] of MENUS) {
    assert.ok(html.includes("<b>" + name + "</b>"), name);
    assert.ok(html.includes(line), line);
  }
  assert.match(html, /data-action="mendUnstuck"/);
  assert.match(html, /data-action="fPhoto"/);
  assert.doesNotMatch(html, DEV);
});

test("every clickable number in the top bar has a card", () => {
  const index = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const game = readFileSync(new URL("../dist/game.js", import.meta.url), "utf8");
  const keys = [...index.matchAll(/data-sx="([a-z]+)"/g)].map((m) => m[1]);
  assert.ok(keys.length >= 7, keys.join(","));
  for (const k of [...keys, "hp", "stamina", "hunger"]) {
    assert.ok(HUD_CARD[k], "card for " + k);
    const { e } = make();
    const html = hudCardHtml(e, k, "现在的数");
    assert.match(html, /<h3>/);
    assert.match(html, /现在：现在的数/);
  }
  assert.match(game, /data-sx="\$\{id\}"/, "the three bars carry their key");
  assert.match(game, /showSxPop\(sxEl\)/);
});

// ================= 各页只留一件事 =================
test("the farmhouse only rests; the craft menu lists only what you make by hand; a station lists only its own", () => {
  const game = readFileSync(new URL("../dist/game.js", import.meta.url), "utf8");
  const home = game.slice(game.indexOf("else if(menu==='home')"), game.indexOf("else if(menu==='pause')"));
  assert.match(home, /data-action=\\?"sleep\\?"/);
  assert.match(home, /data-action=\\?"waitUntilNight\\?"/);
  assert.doesNotMatch(home, /data-action=\\?"save\\?"|frontier:rooms|frontier:life|data-action=\\?"quests\\?"/);
  assert.match(game, /else list=list\.filter\(r=>!r\.station\);/, "craft menu: by hand only");
  assert.match(game, /else list=list\.filter\(r=>r\.station==='workbench'\);/, "workbench: its own recipes");
  assert.doesNotMatch(game, /data-action="pin"/, "no pin button");
  assert.ok(RECIPES.some((r) => !r.station), "there are hand recipes");
});

test("pages lose the links bolted onto them: the journal keeps only tasks, the shipping box only selling", () => {
  // 一个很小的 DOM 替身：只够 querySelectorAll / remove / 父子关系
  const node = (cls, attrs = {}, kids = [], text = "") => {
    const n = { className: cls, dataset: attrs, children: [], textContent: text, parentElement: null, parentNode: null };
    n.remove = () => {
      const p = n.parentElement;
      if (!p) return;
      p.children = p.children.filter((c) => c !== n);
      n.parentElement = n.parentNode = null;
    };
    for (const k of kids) {
      k.parentElement = k.parentNode = n;
      n.children.push(k);
    }
    return n;
  };
  const all = (root) => root.children.flatMap((c) => [c, ...all(c)]);
  const match = (el, sel) =>
    sel.split(/\s+/).every((part) => {
      const cls = part.match(/^[a-z]*\.([\w-]+)/)?.[1] || (part.startsWith(".") ? part.slice(1) : null);
      const act = part.match(/\[data-action="([^"]+)"\]/)?.[1];
      const id = part.match(/\[data-id="([^"]+)"\]/)?.[1];
      if (cls && !String(el.className).split(" ").includes(cls.split("[")[0])) return false;
      if (act && el.dataset.action !== act) return false;
      if (id && el.dataset.id !== id) return false;
      return !!(cls || act);
    });
  const root = node("modal");
  root.querySelectorAll = (sel) => all(root).filter((el) => !sel.includes(" ") && match(el, sel));
  const links = node("outpost-links", {}, [node("", { action: "oView", id: "ledger" }, [], "出货账本")]);
  const strip = node("outpost-strip", {}, [links]);
  const main = node("journal-main", {}, [], "主线这一步");
  root.children.push(strip, main);
  strip.parentElement = main.parentElement = root;
  const n = sxAfterRender(root, stripKey("journey"));
  assert.ok(n >= 1);
  assert.deepEqual(
    root.children.map((c) => c.className),
    ["journal-main"],
    "the strip of links is gone, the task stays"
  );
  assert.equal(stripKey("outpost", { view: "shipping" }), "outpost:shipping");
  assert.equal(stripKey("rebuild", { tab: "residents" }), "rebuild:residents");
});

test("the letters page keeps the story card and the letters, nothing else", () => {
  const journal =
    '<div class="journal-page"><section class="journal-today">今天</section><article class="journal-main story-card task-card"><h2>把收成做成出发餐</h2><article class="inner">信</article></article><section class="outpost-strip">链接</section><details class="journal-extra hp-letters"><summary>鸽子捎回的信</summary><article>一封</article></details><details class="journal-extra"><summary>收到的消息</summary></details></div>';
  const blocks = pickBlocks(journal, /<article class="journal-main[^"]*story-card/, "article");
  assert.equal(blocks.length, 1);
  assert.match(blocks[0], /<article class="inner">信<\/article><\/article>$/, "nested article kept whole");
  const { e } = make();
  const html = lettersHtml(e, journal);
  assert.match(html, /把收成做成出发餐/);
  assert.match(html, /鸽子捎回的信/);
  assert.doesNotMatch(html, /今天|链接|收到的消息/);
});

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
test("saves: nothing new is written (old saves load as they were); version 0.39.0 一物一用 in the title and settings", () => {
  const { e } = make();
  const text = e.serialize();
  const back = new Engine(Engine.parse(text), () => {});
  assert.deepEqual(Object.keys(JSON.parse(back.serialize())).sort(), Object.keys(JSON.parse(text)).sort());
  const v = readFileSync(new URL("../dist/version.js", import.meta.url), "utf8");
  assert.match(v, /GAME_VERSION='v0\.\d+\.\d+'/);
  assert.match(v, /GAME_EDITION='[^']+'/);
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  assert.match(html, /<title>余烬农场 v0\.\d+\.\d+ · [^<]+<\/title>/);
  assert.ok(styleOrder().includes("simple.css"));
  for (const key of ["shipping", "gBoard", "radio", "museum", "plaza", "bOrders"]) assert.ok(PAGE_CARD[key]?.[1], key);
  for (const [k, v2] of Object.entries(VERB)) assert.ok(typeof v2 === "string" ? v2.length <= 12 : true, k);
  assert.ok(ITEMS.bread);
});
