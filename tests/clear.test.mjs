// v0.41.0「看得清」：夜里的月光、12 圈灯光加光晕、光外的感染者画淡（夜里不变容易）、四角框和光标小图、
// 预兆的斜纹和最后 0.2 秒闪白、收捡建打升级的那一下、剪影、影子、雨雪、十凶的雾跟天色、隧道的轮廓、场景里的字不小于 14。
// 只改画法：玩法、数值、存档一样没动。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Engine, freshState } from "../dist/campaign.js";
import { Engine as ClearEngine, VFX_MAX } from "../dist/clear.js";
import { Engine as SimpleEngine } from "../dist/simple.js";
import { Renderer as CampaignRenderer } from "../dist/campaign-renderer.js";
import { Renderer as ClearRenderer, hideAlpha, lightAt, attacking, cursorKind, shapeInto, HIDE_MIN, LIGHT_FULL, C41, FX_T, HALO } from "../dist/clear-renderer.js";
import { Renderer as LookRenderer } from "../dist/look-renderer.js";
import { skyColor, liftedSky, moonness, nightness, ambientFor, moonTint, MOON, MOON_FLOOR, NIGHT_MAX, RINGS, RINGS_SMALL } from "../dist/pixel-light.js";
import { lookFor, PLAYER_LOOK, zombiePix, ZOMBIE_LOOKS } from "../dist/pixel-sprites.js";
import { puddlesOn } from "../dist/pixel-build.js";
import { PAL } from "../dist/pixel-kit.js";
import { CROPS } from "../dist/data.js";

const read = (f) => readFileSync(new URL("../dist/" + f, import.meta.url), "utf8");
const make = (state = freshState()) => {
  const e = new Engine(state, () => {});
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  if (e.dy) e.dy.pending = null;
  return e;
};
const go = (e, region, x = 768, y = 512) => {
  e.s.visited = { ...(e.s.visited || {}), [region]: true };
  e.s.region = region;
  e.enemies = e.s.enemies[region] ||= [];
  e.assignRegion();
  Object.assign(e.s.player, { x, y });
};
function ripeRow(e, n = 6) {
  go(e, "farm");
  const row = e.s.plots
    .filter((p) => e.isFarmPlot(p))
    .sort((a, b) => a.y - b.y || a.x - b.x)
    .slice(0, n);
  for (const p of row) Object.assign(p, { tilled: true, crop: "radish", growth: CROPS.radish.grow, wateredDay: e.s.day });
  e.s.debris = [];
  return row;
}
// 一个记下调用的假画布路径
const recorder = () => {
  const calls = [];
  return new Proxy({ calls }, { get: (t, k) => (k === "calls" ? calls : (...a) => calls.push([k, ...a])) });
};

// ---------- 夜里的月光 ----------
test("night: the sky shown at deep night is the moonlit one, never darker than before; what “night” means for lamps and fireflies is unchanged", () => {
  // 深夜（0 点）原来的天色 #546096：nightness 就是 NIGHT_MAX，月光掺满
  assert.deepEqual(skyColor(0), [84, 96, 150]);
  assert.equal(moonness(0), 1);
  assert.deepEqual(liftedSky(0), MOON);
  assert.deepEqual(MOON, [100, 114, 162], "#6472A2");
  assert.deepEqual(MOON_FLOOR, [12, 17, 29], "#0C111D");
  // 白天一点不变
  assert.equal(moonness(600), 0);
  assert.deepEqual(liftedSky(600), skyColor(600));
  // 任何时候都不比原来暗；“天黑没有”照旧按原来的天色算
  for (let m = 0; m < 1440; m += 15) {
    const a = skyColor(m),
      b = liftedSky(m);
    for (let k = 0; k < 3; k++) assert.ok(b[k] >= a[k], m + ":" + k);
    assert.equal(nightness(m), Math.max(0, Math.min(1, (235 - (a[0] + a[1] + a[2]) / 3) / 165)));
  }
  assert.ok(Math.abs(NIGHT_MAX - nightness(0)) < 1e-9);
  // 原来的算法还在（光外的感染者按它算淡多少）
  assert.deepEqual(ambientFor(1380, "晴朗", false), skyColor(1380));
  assert.notDeepEqual(ambientFor(1380, "晴朗"), skyColor(1380));
  // 雾：夜里往月光的蓝偏，亮度不变（雾里看得清看不清和原来一样）
  const Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  for (const fog of [[52, 64, 62], [200, 205, 198], [92, 100, 104]]) {
    const t = moonTint(fog, 1);
    assert.ok(Math.abs(Y(t) - Y(fog)) < 3, "same brightness " + fog);
    assert.ok(t[2] - t[0] > fog[2] - fog[0], "bluer " + fog);
    assert.deepEqual(moonTint(fog, 0), fog);
  }
});

test("lights: 12 fine rings give about the same light as the old 6 hard ones (indoors is not darker)", () => {
  const energy = (R) => R.reduce((a, [k, v]) => a + v * k * k, 0);
  assert.equal(RINGS.length, 12);
  assert.equal(RINGS_SMALL.length, 6);
  // v0.40：[[1,.1],[.84,.11],[.68,.13],[.52,.15],[.36,.18],[.22,.22]]，小灯 [[1,.16],[.6,.22],[.3,.3]]
  assert.ok(Math.abs(energy(RINGS) / 0.312264 - 1) < 0.02, "big lights");
  assert.ok(Math.abs(energy(RINGS_SMALL) / 0.2662 - 1) < 0.02, "small lights");
  // 由外往里一圈比一圈小
  for (let i = 1; i < RINGS.length; i++) assert.ok(RINGS[i][0] < RINGS[i - 1][0]);
  // 光晕：路灯、灯笼、火、日光灯、小灯泡、信号灯
  for (const k of ["lamp", "lantern", "fire", "fluoro", "bulb", "beacon"]) assert.ok(HALO[k][0] >= 3, k);
  const vr = read("visual-renderer.js");
  assert.match(vr, /MOON_OP = "screen"/, "the moonlight floor is screened on (lifts the darks, keeps the lights)");
  assert.match(vr, /this\.vMap = false;\s*c\.fillStyle = `rgba\(\$\{MOON_FLOOR\[0\]\}/, "the floor colour is not snapped to the palette");
});

// ---------- 光外的感染者 ----------
test("infected outside the light are drawn fainter so they stand out from the ground no more than in v0.40; in light, attacking or hit they are drawn as usual", () => {
  const old = ambientFor(1380, "晴朗", false).map((v) => Math.round(v * 0.75)),
    amb = ambientFor(1380, "晴朗").map((v) => Math.round(v * 0.88)),
    floor = 0.2126 * MOON_FLOOR[0] + 0.7152 * MOON_FLOOR[1] + 0.0722 * MOON_FLOOR[2];
  // 白天、屋里（天色没变）照常
  assert.equal(hideAlpha([255, 250, 240], [255, 250, 240], 0, 0), 1);
  // 深夜光外：淡一些，但不会淡到看不见
  const dark = hideAlpha(amb, old, 0, floor);
  assert.ok(dark < 0.85 && dark >= HIDE_MIN, String(dark));
  // 灯光越足越接近照常，足了就照常
  let prev = dark;
  for (const l of [10, 20, 40, LIGHT_FULL]) {
    const a = hideAlpha(amb, old, l, floor);
    assert.ok(a >= prev, String(l));
    prev = a;
  }
  assert.equal(hideAlpha(amb, old, LIGHT_FULL, floor), 1);
  // 灯光怎么算：灯心最亮，出了半径没有
  const L = [{ x: 0, y: 0, r: 100, color: [255, 214, 140], power: 1 }];
  assert.ok(lightAt(L, 0, 0) > lightAt(L, 50, 0));
  assert.ok(lightAt(L, 50, 0) > lightAt(L, 90, 0));
  assert.equal(lightAt(L, 120, 0), 0);
  // 正在出手、挨打、伸手、扑、冲撞：照常画
  assert.ok(attacking({ windup: 0.3 }));
  assert.ok(attacking({ flash: 0.1 }));
  assert.ok(attacking({ reach: 0.4 }));
  assert.ok(attacking({ lunge: { phase: "crouch" } }));
  assert.ok(attacking({ charge: { phase: "stomp" } }));
  assert.ok(!attacking({ windup: 0, flash: 0 }));
  // 屋里、隧道（没有月光）不淡
  const fake = { v: true, indoor: true, lit: { lifted: true, amb, old, lights: [], moon: 1 } };
  assert.equal(ClearRenderer.prototype.foeAlpha.call(fake, { x: 0, y: 0 }), 1);
  fake.indoor = false;
  assert.ok(ClearRenderer.prototype.foeAlpha.call(fake, { x: 0, y: 0 }) < 1);
  assert.equal(ClearRenderer.prototype.foeAlpha.call(fake, { x: 0, y: 0, windup: 0.2 }), 1);
});

// ---------- 引擎那一层：只记画面上的动作 ----------
test("the effects layer records harvest, pickup, build, level and hits for the scene and changes nothing in the game", () => {
  assert.equal(Engine, ClearEngine, "the campaign engine is the v0.41 layer");
  assert.ok(Engine.prototype instanceof SimpleEngine);
  const e = make();
  e.s.day = 9;
  const row = ripeRow(e, 3);
  // 自己收：记一笔“收菜”（哪块田、哪种菜、几个）
  Object.assign(e.s.player, { x: row[0].x, y: row[0].y + 20 });
  assert.ok(e.harvest(row[0]));
  let q = e.takeVfx();
  assert.equal(q.length, 1);
  assert.equal(q[0].kind, "harvest");
  assert.equal(q[0].item, "radish");
  assert.equal(q[0].x, row[0].x);
  assert.ok(q[0].n >= 1);
  assert.deepEqual(e.takeVfx(), [], "taken once");
  // 居民、照看机收的不记
  assert.ok(e.harvest(row[1], true));
  assert.deepEqual(e.takeVfx(), []);
  // 升级、打中
  e.emit("level");
  e.emitAt("hitFlesh", { x: 10, y: 20, id: 7, type: "slow" }, { heavy: true });
  e.emitAt("hitMetal", { x: 30, y: 40, id: 8, type: "armor" }, {});
  e.emitAt("spot", { x: 30, y: 40, id: 8, type: "armor" }, {});
  q = e.takeVfx();
  assert.deepEqual(
    q.map((v) => v.kind),
    ["level", "hit", "hit"],
  );
  assert.equal(q[1].id, 7);
  assert.ok(q[1].heavy && !q[1].metal);
  assert.ok(q[2].metal);
  // 事件照样进事件表（声音、提示照旧）
  assert.ok(e.events.some((x) => x.type === "level"));
  assert.ok(e.events.some((x) => x.type === "hitFlesh"));
  // 没人来取：最多留 VFX_MAX 笔
  for (let i = 0; i < VFX_MAX + 20; i++) e.emit("level");
  assert.equal(e.vfxq.length, VFX_MAX);
  // 不进存档
  assert.ok(!("vfxq" in e.s));
  assert.ok(!JSON.stringify(e.s).includes("vfx"));
});

test("the effects layer: picking up by interact flies the things you got from where they were; building drops the new building", () => {
  const e = make();
  go(e, "farm", 830, 600);
  // 按交互捡到东西：从那一样东西那里飞过来
  const before = { ...e.s.inventory };
  e.vfxGain(before, { x: 500, y: 400 });
  assert.deepEqual(e.takeVfx(), []);
  e.s.inventory.wood = (e.s.inventory.wood || 0) + 3;
  e.vfxGain(before, { x: 500, y: 400 });
  const q = e.takeVfx();
  assert.equal(q[0].kind, "pickup");
  assert.deepEqual(q[0].items, [["wood", 3]]);
  assert.equal(q[0].x, 500);
  // 建好设施：记下是哪一座
  for (const [id, n] of Object.entries({ wood: 30, stone: 20, scrap: 10 })) e.s.inventory[id] = (e.s.inventory[id] || 0) + n;
  e.buildMode = "chest";
  let placed = null;
  for (let y = 560; y <= 820 && !placed; y += 40)
    for (let x = 300; x <= 1300 && !placed; x += 40) {
      Object.assign(e.s.player, { x, y: y - 70 });
      if (!e.buildReason("chest", x, y) && e.placeBuilding(x, y)) placed = e.s.buildings.at(-1);
    }
  assert.ok(placed, "found a free spot");
  const v = e.takeVfx().find((x) => x.kind === "build");
  assert.equal(v.id, placed.id);
  assert.equal(v.type, "chest");
});

test("the effects layer changes no outcome: the same moves on the v0.39 engine and on this one end in the same save", () => {
  const run = (Eng) => {
    let seed = 7;
    const rnd = Math.random;
    Math.random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    try {
      const e = new Eng(freshState(), () => {});
      e.paused = false;
      if (e.feel?.open) e.feel.open.phase = "done";
      if (e.dy) e.dy.pending = null;
      e.s.day = 9;
      const row = ripeRow(e, 6);
      Object.assign(e.s.player, { x: row[0].x, y: row[0].y + 20 });
      e.interact();
      for (let step = 0; step < 200; step++) {
        const target = row[Math.min(row.length - 1, Math.floor(step / 30))];
        e.s.player.x += Math.sign(target.x - e.s.player.x) * Math.min(4, Math.abs(target.x - e.s.player.x));
        e.update(0.05, { hold: true });
      }
      for (let i = 0; i < 60; i++) e.update(0.05, {});
      e.emit("level");
      return JSON.stringify(e.s);
    } finally {
      Math.random = rnd;
    }
  };
  assert.equal(run(Engine), run(SimpleEngine));
});

// ---------- 画面那一层 ----------
test("scene: the v0.41 layer sits on top of the camera layer; the scene takes the effects every frame and turns them into flashes, pops, arcs, drops and rings", () => {
  assert.equal(CampaignRenderer, ClearRenderer);
  assert.ok(ClearRenderer.prototype instanceof LookRenderer);
  const fake = { time: 10, calm: false, v: false, fx: null, _cFx: [], _cFlash: new Map(), _cDrop: new Map(), _cE: null };
  ClearRenderer.prototype.cTake.call(fake, [
    { kind: "hit", id: 3, x: 0, y: 0 },
    { kind: "harvest", x: 1, y: 2, item: "radish", n: 2 },
    { kind: "pickup", x: 1, y: 2, items: [["wood", 1]] },
    { kind: "build", id: "b9", x: 5, y: 6, type: "chest" },
    { kind: "level" },
  ]);
  assert.ok(Math.abs(fake._cFlash.get(3) - (10 + FX_T.flash)) < 1e-9, "white for 0.06 s");
  assert.deepEqual(
    fake._cFx.map((f) => f.kind),
    ["harvest", "pickup", "level"],
  );
  assert.equal(fake._cDrop.get("b9").t0, 10);
  // “减少闪烁”打开时不闪白
  const calm = { ...fake, calm: true, _cFx: [], _cFlash: new Map(), _cDrop: new Map() };
  ClearRenderer.prototype.cTake.call(calm, [{ kind: "hit", id: 3, x: 0, y: 0 }]);
  assert.equal(calm._cFlash.size, 0);
  // 特效都在 0.1 秒内开始、不超过 0.8 秒
  for (const [k, v] of Object.entries(FX_T)) assert.ok(v > 0 && v <= 0.8, k);
  assert.equal(FX_T.edge, 0.2, "the last 0.2 s of a telegraph flash white");
});

test("scene: what the cursor turns into over a thing comes from its “name · what it does” line", () => {
  assert.equal(cursorKind("仓库箱 · 修好它"), "wrench");
  assert.equal(cursorKind("老琴 · 说话"), "talk");
  assert.equal(cursorKind("唐九 · 买卖"), "talk");
  assert.equal(cursorKind("出口 · 出门"), "door");
  assert.equal(cursorKind("旧医院 · 进去"), "door");
  assert.equal(cursorKind("物资 · 捡起来"), "hand");
  assert.equal(cursorKind("工具箱 · 翻一翻"), "hand");
  assert.equal(cursorKind(""), "");
  // 规范里能按的颜色和描边
  assert.equal(C41.interact, "#fff1c8");
  assert.equal(C41.ink, "#140f0b");
  assert.equal(C41.danger, "#e04a3a");
});

test("scene: titan telegraph stripes fill from the edge inward (the lanes along the lane)", () => {
  const P = recorder();
  shapeInto(P, { k: "circle", x: 10, y: 20, r: 100 }, 0.5);
  assert.deepEqual(P.calls.find((c) => c[0] === "arc").slice(1, 4), [10, 20, 50]);
  const L = recorder();
  shapeInto(L, { k: "line", x: 0, y: 0, a: 0, w: 40, len: 300 }, 0.25);
  const xs = L.calls.filter((c) => c[0] === "lineTo").map((c) => c[1]);
  assert.ok(Math.max(...xs) <= 75 + 1e-9, "a quarter of the lane");
  const src = read("clear-renderer.js");
  assert.match(src, /c\.fill\(P, "evenodd"\)/);
  // 普通感染者：斜纹在它身子下面画（drawEnemy 里先画），光照之后只描边、最后 0.2 秒闪白
  assert.match(src, /drawEnemy\(z, e\) \{\s*if \(this\.v && this\.cTellable\(z\)\)/);
  // 奔跑者扑人、重甲冲撞的预兆最后 0.2 秒也闪白
  const gear = read("gear-renderer.js");
  assert.match(gear, /z\.lunge\.t < 0\.2 &&/);
  assert.match(gear, /z\.charge\.t < 0\.2 &&/);
});

test("scene text: 12-pixel pixel text that would be under 14 screen pixels is written in the body font at 14", () => {
  const fonts = [];
  const makeCtx = (a) => ({
    getTransform: () => ({ a, b: 0 }),
    set font(v) {
      fonts.push(v);
    },
    get font() {
      return fonts.at(-1);
    },
    fillText() {},
    strokeText() {},
    measureText: (t) => ({ width: String(t).length * 14 }),
    fillRect() {},
  });
  const me = { ctx: makeCtx(1), dpr: 1, camera: { scale: 1 }, _deferText: false, cTextScale: ClearRenderer.prototype.cTextScale };
  ClearRenderer.prototype._pixelText.call(me, "旧医院 · 进去", 0, 0, "#e6e5c7", 12);
  assert.match(fonts.at(-1), /^600 14px /);
  // 放大 1.5 倍时像素体 12 已经是 18 像素：照原来写
  assert.ok(12 * 1.5 >= 14);
  // 贴在屏幕上的字（dpr 2、缩放 1）也按屏幕算
  const me2 = { ...me, dpr: 2, ctx: makeCtx(2) };
  fonts.length = 0;
  ClearRenderer.prototype._pixelText.call(me2, "浓雾", 0, 0, "#e6e5c7", 12);
  assert.match(fonts.at(-1), /^600 14px /);
});

// ---------- 小图 ----------
test("sprites: you wear one bit of ember; people never wear the infected's green; the infected have torn hems; shadows are one solid 35% shape", () => {
  assert.deepEqual(PLAYER_LOOK.scarf, [PAL.ember[3], PAL.ember[2]]);
  assert.equal(PAL.ember[3], "#e5823a");
  const green = new Set(PAL.leaf);
  for (let i = 0; i < 400; i++) {
    for (const role of [null, "guard", "farmer", "mechanic", "medic", "trader", "helper", "elder"]) {
      const L = lookFor("person" + i, role);
      assert.ok(!green.has(L.top[0]), "top " + i + " " + role);
      assert.ok(!green.has(L.pants[0]), "pants " + i + " " + role);
    }
  }
  // 感染者的衣摆：腰带下面那一行多出几缕
  const look = ZOMBIE_LOOKS.slow,
    torn = zombiePix(look, "down", 0),
    whole = zombiePix({ ...look, blood: 0 }, "down", 0),
    row = 26;
  let diff = 0;
  for (let x = 0; x < torn.w; x++) if (String(torn.get(x, row)) !== String(whole.get(x, row))) diff++;
  assert.ok(diff >= 2, "tatters under the belt: " + diff);
  assert.match(read("pixel-sprites.js"), /P\.ellipse\(rx \+ 1, ry \+ 1, rx, ry, "#140f0b", 0\.35\);\n\s*return canvasOf\(P\);/);
});

// ---------- 雨雪、隧道 ----------
test("weather: rain twice as dense, a wet sheen and far greying in storms, twice the puddles; snow caps on things", () => {
  const pl = read("pixel-light.js");
  assert.match(pl, /n = calm \? 120 : storm \? 520 : 300/);
  assert.match(pl, /drawSheen\(ctx, view, weather, time, calm\)/);
  assert.match(read("visual-renderer.js"), /this\.wx\.drawSheen\(c, view, weather, this\.time, this\.calm\)/);
  assert.match(read("pixel-maps.js"), /region === "courtyard" \? 92 : 68/);
  assert.match(read("pixel-farm.js"), /out\.length < 68/);
  // 水洼的找法：数够了就停，同一个种子前面那些不变
  const W = 768,
    H = 512,
    map = new Uint8Array(W * H).fill(3);
  const a = puddlesOn(map, [3], 34, 900),
    b = puddlesOn(map, [3], 68, 900);
  assert.equal(a.length, 34);
  assert.equal(b.length, 68);
  assert.deepEqual(b.slice(0, 34), a);
  assert.match(read("clear-renderer.js"), /snowCap\(canvas\)/);
});

test("tunnel and fog: the tunnel shows walls and rails as a very dark outline; titan, hazard and long-night fogs turn moon-blue at night at the same brightness", () => {
  const src = read("clear-renderer.js");
  assert.match(src, /cTunnel\(e\) \{\s*if \(!e\.inTunnel\?\.\(\) \|\| !this\.mood\?\.tunnel\) return;/);
  assert.match(src, /c\.globalAlpha = 0\.26;/);
  assert.match(read("titan-renderer.js"), /this\.fogTint \? this\.fogTint\(F\.white/);
  assert.match(read("farlands-renderer.js"), /this\.fogTint\?\.\(\[200, 205, 198\]\)/);
  assert.match(read("nightfall-renderer.js"), /this\.fogTint\?\.\(FOG\)/);
});
