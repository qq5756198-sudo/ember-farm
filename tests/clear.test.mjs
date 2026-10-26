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
import { skyColor, liftedSky, moonness, nightness, ambientFor, fogColor, moonFloor, MOON, MOON_FLOOR, NIGHT_MAX, RINGS, RINGS_SMALL, RINGS_40, RINGS_SMALL_40 } from "../dist/pixel-light.js";
import { lookFor, PLAYER_LOOK, zombiePix, ZOMBIE_LOOKS } from "../dist/pixel-sprites.js";
import { puddlesOn } from "../dist/pixel-build.js";
import { PAL, LOOK41, deskLook, cached } from "../dist/pixel-kit.js";
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
  // 雾：跟着天色走——白天不变，夜里乘上月光的天色，是蓝灰、不再发白
  const night = ambientFor(1380, "晴朗");
  for (const fog of [[52, 64, 62], [200, 205, 198], [92, 100, 104]]) {
    const t = fogColor(fog, night, 1);
    for (let k = 0; k < 3; k++) assert.ok(t[k] < fog[k], "darker at night " + fog);
    assert.ok(t[2] / Math.max(1, t[0]) > fog[2] / fog[0], "bluer " + fog);
    assert.deepEqual(fogColor(fog, night, 0), fog, "unchanged by day");
  }
  assert.ok(fogColor([200, 205, 198], night, 1).every((v) => v < 140), "the hazard fog is no longer white at night");
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
  // 月光底：结果和整屏“滤色”一层 #0C111D 一样（暗处抬起来、亮处几乎不变），只是画法省一些：
  // 光照图每个通道乘 1−F，再整屏“加”一层 F
  for (const moon of [1, 0.6, 0.2]) {
    const f = moonFloor(moon);
    for (const x of [0, 0.05, 0.2, 0.5, 0.9]) {
      for (let i = 0; i < 3; i++) {
        const F = (MOON_FLOOR[i] / 255) * moon,
          screen = x + F - x * F,
          cheap = x * f.scale[i] + f.add[i] / 255;
        assert.ok(Math.abs(screen - cheap) < 0.003, moon + " " + x + " " + i + ": " + screen + " vs " + cheap);
      }
    }
    assert.ok(f.add.every((v) => v >= 0 && v <= 29) && f.scale.every((v) => v <= 1 && v > 0.88));
  }
  assert.equal(moonFloor(0), null, "no floor by day");
  const vr = read("visual-renderer.js");
  assert.match(vr, /floor = moonFloor\(moon \* MOON_FLOOR_K\)/);
  assert.match(vr, /this\.lightMap\.render\(view, amb, lights, floor\?\.scale \|\| null\)/);
  assert.match(vr, /c\.globalCompositeOperation = "lighter";\s*\/\/[^\n]*\n\s*const vm = this\.vMap;\s*this\.vMap = false;\s*c\.fillStyle = `rgb\(\$\{floor\.add\[0\]\}/, "the floor colour is not snapped to the palette");
  // 12 圈画成一张小图（同样的圈、同样的中心）再贴上去
  const pl = read("pixel-light.js");
  assert.match(pl, /if \(LOOK41\.on\) return this\.render41\(/);
  assert.match(pl, /export function ringSprite\(r, flat, small, col\)/);
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
  assert.ok(dark < 0.9 && dark >= HIDE_MIN, String(dark));
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
  assert.match(src, /drawEnemy\(z, e\) \{\s*if \(this\.v && LOOK41\.on && this\.cTellable\(z\)\)/);
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
  assert.match(read("pixel-sprites.js"), /if \(LOOK41\.on\) P\.ellipse\(rx \+ 1, ry \+ 1, rx, ry, "#140f0b", 0\.35\);/);
});

// ---------- 雨雪、隧道 ----------
test("weather: rain twice as dense, a wet sheen and far greying in storms, twice the puddles; snow caps on things", () => {
  const pl = read("pixel-light.js");
  assert.match(pl, /n = \(calm \? 60 : storm \? 260 : 150\) \* \(LOOK41\.on \? 2 : 1\)/);
  assert.match(pl, /drawSheen\(ctx, view, weather, time, calm\)/);
  assert.match(read("visual-renderer.js"), /this\.wx\.drawSheen\(c, view, weather, this\.time, this\.calm\)/);
  assert.match(read("pixel-maps.js"), /region === "courtyard" \? 92 : 68/);
  assert.match(read("pixel-farm.js"), /export function puddleSpots\(map, n = 68, tries = 1800\)/);
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

test("tunnel and fog: the tunnel shows walls and rails as a very dark outline; titan, hazard and long-night fogs follow the night sky (blue-grey, not white)", () => {
  const src = read("clear-renderer.js");
  assert.match(src, /cTunnel\(e\) \{\s*if \(!e\.inTunnel\?\.\(\) \|\| !this\.mood\?\.tunnel\) return;/);
  assert.match(src, /c\.globalAlpha = 0\.26;/);
  assert.match(read("titan-renderer.js"), /this\.fogTint \? this\.fogTint\(F\.white/);
  assert.match(read("farlands-renderer.js"), /this\.fogTint\?\.\(\[200, 205, 198\]\)/);
  assert.match(read("nightfall-renderer.js"), /this\.fogTint\?\.\(FOG\)/);
});

test("words: no developer words in the v0.41 layers, and the version is 0.41.0 看得清 in the title and settings", () => {
  for (const f of ["clear.js", "clear-renderer.js"]) {
    const t = read(f).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(t, /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN|Joja|祝尼魔|星之果实/, f);
  }
  const v = read("version.js");
  assert.match(v, /GAME_VERSION='v0\.41\.0'/);
  assert.match(v, /GAME_EDITION='看得清'/);
  assert.match(read("index.html"), /<title>余烬农场 v0\.41\.0 · 看得清<\/title>/);
  assert.match(read("index.html"), /data-release>v0\.41\.0 · 看得清</);
});

test("rim light: at night a person or infected next to a warm lamp or fire gets a thin edge on that side; not by day, not from cold or own lights, not with reduce-flashing", () => {
  const lamp = { x: 100, y: 100, r: 120, color: [255, 214, 140], power: 0.95 },
    fire = { x: 100, y: 100, r: 140, color: [255, 168, 88], power: 0.9 },
    cold = { x: 100, y: 100, r: 150, color: [215, 235, 255], power: 0.8 },
    own = { x: 160, y: 104, r: 140, color: [176, 160, 132], power: 0.62 };
  const me = (lights, moon = 1, calm = false) => ({ v: true, calm, indoor: false, lit: { moon, lights } });
  const rim = (m, x = 160, y = 128) => ClearRenderer.prototype.cRim.call(m, x, y);
  const r = rim(me([lamp]));
  assert.ok(r, "next to a lamp");
  assert.equal(r.dx, -2, "towards the lamp (it is to the left)");
  assert.equal(r.color, "#ffd68c");
  assert.equal(rim(me([fire])).color, "#ffa858", "fire light is orange");
  assert.equal(rim(me([cold])), null, "cold lights give no rim");
  assert.equal(rim(me([own])), null, "your own torch gives no rim");
  assert.equal(rim(me([lamp], 0)), null, "not by day");
  assert.equal(rim(me([lamp], 1, true)), null, "not with reduce-flashing");
  assert.equal(rim(me([lamp]), 600, 128), null, "far from the lamp");
});

// ---------- 只对电脑 ----------
test("only on computers: phones, tablets and small windows keep the v0.40 picture (light, sprites, puddles, rain, effects, text)", () => {
  // 哪里算电脑：和 v0.40 的界面同一条线（鼠标、窗口宽 ≥ 1280、高 ≥ 680）；没有页面（测试、台子、后台线程）当是电脑
  const win = (w, h, coarse = false) => ({ document: {}, innerWidth: w, innerHeight: h, matchMedia: () => ({ matches: coarse }) });
  assert.equal(deskLook(win(1366, 768)), true);
  assert.equal(deskLook(win(1920, 1080)), true);
  assert.equal(deskLook(win(1180, 660)), false, "small window");
  assert.equal(deskLook(win(1366, 650)), false, "too short");
  assert.equal(deskLook(win(1024, 768, true)), false, "tablet");
  assert.equal(deskLook(win(1366, 1024, true)), false, "big tablet");
  assert.equal(deskLook({}), true, "no page");
  assert.equal(LOOK41.on, true);
  const was = LOOK41.on;
  try {
    LOOK41.on = false;
    // 天色、灯光的台阶、雨、湿光：照原来的
    for (const m of [0, 300, 1140, 1260, 1380]) assert.deepEqual(ambientFor(m, "晴朗"), ambientFor(m, "晴朗", false));
    assert.deepEqual(RINGS_40, [[1, 0.1], [0.84, 0.11], [0.68, 0.13], [0.52, 0.15], [0.36, 0.18], [0.22, 0.22]]);
    assert.deepEqual(RINGS_SMALL_40, [[1, 0.16], [0.6, 0.22], [0.3, 0.3]]);
    const pl = read("pixel-light.js");
    assert.match(pl, /if \(LOOK41\.on\) return this\.render41\(/);
    assert.match(pl, /for \(const \[k, a\] of l\.small \? RINGS_SMALL_40 : RINGS_40\)/);
    assert.match(pl, /drawSheen\(ctx, view, weather, time, calm\) \{\s*if \(!LOOK41\.on\) return;/);
    const vr = read("visual-renderer.js");
    assert.match(vr, /const moon = this\.indoor \|\| !LOOK41\.on \? 0 : moonness\(this\.vMinute\),/);
    assert.match(vr, /LOOK41\.on \? EXPLORE_DIM : 0\.25/);
    assert.match(vr, /LOOK41\.on \? this\.art\?\.puddles : this\.art\?\.puddles40 \|\| this\.art\?\.puddles/);
    // 水洼：原来那些（数、试几回都照原来）
    assert.match(read("pixel-maps.js"), /puddles40: codes\.length \? puddlesOn\(art\.map, codes, region === "courtyard" \? 46 : 34, seed, 1600\)/);
    assert.match(read("pixel-maps.js"), /puddles40: puddleSpots\(f\.map, 34, 900\)/);
    // 小图：红围巾、绿衣服照旧、守卫原来的制服、感染者没有破衣摆、影子两层；两种小图各存各的
    assert.deepEqual(PLAYER_LOOK.scarf, [PAL.cloth[1], PAL.cloth[0]]);
    assert.deepEqual({ ...PLAYER_LOOK }.scarf, [PAL.cloth[1], PAL.cloth[0]]);
    const green = new Set(PAL.leaf);
    let greens = 0;
    for (let i = 0; i < 200; i++) if (green.has(lookFor("person" + i).top[0])) greens++;
    assert.ok(greens > 0, "some people still wear green on phones");
    assert.equal(lookFor("guard1", "guard").pants[0], lookFor("x", "guard").pants[0]);
    assert.ok(green.has(lookFor("guard1", "guard").top[0]), "guard keeps the old uniform");
    const look = ZOMBIE_LOOKS.slow,
      torn = zombiePix(look, "down", 0),
      whole = zombiePix({ ...look, blood: 0 }, "down", 0);
    let diff = 0;
    for (let x = 0; x < torn.w; x++) if (String(torn.get(x, 26)) !== String(whole.get(x, 26))) diff++;
    assert.equal(diff, 0, "no torn hem on phones");
    const a = cached("probe-mode", () => ({ mode: 40 }));
    LOOK41.on = true;
    const b = cached("probe-mode", () => ({ mode: 41 }));
    assert.equal(a.mode, 40);
    assert.equal(b.mode, 41);
    LOOK41.on = false;
    // 最上面那一层：光外的感染者照常画、没有亮边、场景里的字照原来的像素体
    const R = ClearRenderer.prototype;
    assert.equal(R.foeAlpha.call({ v: true, indoor: false, lit: { lifted: true, amb: [100, 114, 162], old: [84, 96, 150], lights: [], moon: 1 } }, { x: 0, y: 0 }), 1);
    assert.equal(R.cRim.call({ v: true, calm: false, indoor: false, lit: { moon: 1, lights: [{ x: 100, y: 100, r: 120, color: [255, 214, 140], power: 0.95 }] } }, 160, 128), null);
    let base = 0;
    const me = { _deferText: false, cTextScale: () => 1, ctx: {} };
    const parent = Object.getPrototypeOf(R);
    const keep = parent._pixelText;
    parent._pixelText = function () {
      base++;
    };
    try {
      R._pixelText.call(me, "旧医院 · 进去", 0, 0, "#e6e5c7", 12);
    } finally {
      parent._pixelText = keep;
    }
    assert.equal(base, 1, "pixel font as before");
    const src = read("clear-renderer.js");
    for (const re of [/if \(!this\.v \|\| !LOOK41\.on \|\| night <= 0\.3 \|\| !this\.art\) return;/, /super\.drawNight\(e\);\s*if \(!this\.v \|\| !LOOK41\.on \|\| !e\) return;/, /if \(!this\.v \|\| !LOOK41\.on \|\| this\.calm \|\| z\.crawl/, /const d = this\.v && LOOK41\.on \? this\._cDrop\.get\(b\.id\) : null;/, /if \(on\) this\.cTake\(list\);/]) assert.match(src, re);
  } finally {
    LOOK41.on = was;
  }
});

test("boxed words: the word inside a resident's bubble (饿, 困, ♪…), a station's sign (起火, 成品, minutes left), a visitor's ? and the caravan's sign are written; the one-line rule used to cut them and leave empty boxes", () => {
  const R = ClearRenderer.prototype;
  const g = { things: [{ x: 100, y: 200, type: "resident" }], foes: [], big: new Set(), target: null, tgt: null };
  // 气泡在居民头上（x + 16，y − 98）：只写一行的规矩把它算成这个居民的字，拦下了
  assert.equal(R.slAllow.call({ _sl: g, _slOwn: null, v: true }, "饿", 116, 102, 12), false);
  assert.equal(R.slAllow.call({ _sl: g, _slOwn: null, v: true, _cBubble: true }, "饿", 116, 102, 12), true);
  // 访客头上的“？”、货郎车顶的招牌：画那样东西时写的，照写；别的字照旧拦
  const visitor = { x: 100, y: 200, type: "outpostVisitor" },
    g2 = { ...g, things: [visitor] };
  assert.equal(R.slAllow.call({ _sl: g2, _slOwn: visitor, v: true }, "?", 100, 104, 13), true);
  assert.equal(R.slAllow.call({ _sl: g2, _slOwn: visitor, v: true }, "访客", 100, 122, 12), false);
  const was = LOOK41.on;
  try {
    LOOK41.on = false;
    assert.equal(R.slAllow.call({ _sl: g2, _slOwn: visitor, v: true }, "?", 100, 104, 13), false, "phones as before");
  } finally {
    LOOK41.on = was;
  }
  const src = read("clear-renderer.js");
  assert.match(src, /drawNeeds\(e\) \{\s*return this\.cBubbles\(\(\) => super\.drawNeeds\(e\)\);/);
  assert.match(src, /drawStationBubbles\(e\) \{\s*return this\.cBubbles\(\(\) => super\.drawStationBubbles\(e\)\);/);
  assert.match(src, /cBubbles\(fn\) \{\s*if \(!this\.v \|\| !LOOK41\.on\) return fn\(\);/);
});
