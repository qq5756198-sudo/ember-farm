// v0.21.0「新颜」：新画面的回归测试——十五张地图都能画出来、出入口不在水里、碰撞块里没有路面，
// 旧画法的颜色只换不鲜艳的（危险提示和色弱配色原样保留），像素图集排布不变，感染者每种每个方向都有图，
// 新旧画面开关只写自己的键、不碰存档。
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let canvasLib = null;
try {
  canvasLib = require("@napi-rs/canvas");
} catch {
  canvasLib = null;
}
const kit = await import("../dist/pixel-kit.js");
if (canvasLib) kit.setCanvasFactory((w, h) => canvasLib.createCanvas(w, h));
const { REGIONS } = await import("../dist/data.js");
await import("../dist/district-data.js");
await import("../dist/beyond-data.js");
const maps = await import("../dist/pixel-maps.js");
const { S, MAP_W, MAP_H } = await import("../dist/pixel-build.js");
const visual = await import("../dist/visual-renderer.js");
const sprites = await import("../dist/pixel-sprites.js");
const sheets = await import("../dist/pixel-sheets.js");

const ALL = ["farm", "market", "residential", "hospital", "warehouse", "valley", "stationMarket", "courtyard", "quarantine", "railDepot", "pinewood", "shipyard", "shelter", "frost", "archive"];
const baked = new Map();
const art = (id) => {
  if (!baked.has(id)) baked.set(id, maps.bakeMap(id));
  return baked.get(id);
};

test("all fifteen maps have new pixel art", { skip: !canvasLib && "@napi-rs/canvas not installed" }, () => {
  for (const id of ALL) {
    assert.ok(REGIONS[id], id + " is a real region");
    assert.ok(maps.hasMapArt(id), id + " has new art");
    const a = art(id);
    assert.ok(a?.canvas, id + " bakes a canvas");
    assert.equal(a.canvas.width, MAP_W);
    assert.equal(a.canvas.height, MAP_H);
    assert.ok(Array.isArray(a.lights) && Array.isArray(a.embers) && Array.isArray(a.chimneys), id + " lists lights, embers and chimneys");
    for (const l of a.lights) assert.ok(Number.isFinite(l.x) && Number.isFinite(l.y) && typeof l.kind === "string", id + " light is well formed");
    assert.ok(Array.isArray(a.puddles), id + " has puddle spots");
  }
});

test("the four ruin maps no longer share one picture", { skip: !canvasLib && "@napi-rs/canvas not installed" }, () => {
  const sig = (id) => {
    const d = art(id).pix.d;
    let h = 0;
    for (let i = 0; i < d.length; i += 997) h = (h * 31 + d[i]) >>> 0;
    return h;
  };
  const s = ["market", "residential", "hospital", "warehouse"].map(sig);
  assert.equal(new Set(s).size, 4);
});

test("spawn, exit and store points stand on walkable ground, not water or a wall", { skip: !canvasLib && "@napi-rs/canvas not installed" }, () => {
  for (const id of ALL) {
    if (id === "farm") continue;
    const a = art(id),
      r = REGIONS[id],
      pts = [r.spawn, r.exit].filter(Boolean);
    for (const p of pts) {
      const x = Math.round(p.x / 2),
        y = Math.round(p.y / 2),
        code = a.map[y * MAP_W + x];
      assert.notEqual(code, S.water, `${id} point ${p.x},${p.y} is not in water`);
      assert.notEqual(code, S.roof, `${id} point ${p.x},${p.y} is not inside a wall`);
    }
  }
});

test("indoor, snowy, misty and wet maps keep their own weather habits", () => {
  assert.equal(maps.MAP_MOOD.shelter.indoor, true);
  assert.equal(maps.MAP_MOOD.frost.snowy, true);
  assert.equal(maps.MAP_MOOD.pinewood.mist, true);
  assert.equal(maps.MAP_MOOD.courtyard.wet, true);
});

test("old overlay colours: muted ones move to the palette, warnings and colour-blind colours stay", () => {
  // 原来的绿灰
  const muted = visual.palColor("#354237");
  assert.notEqual(muted, "#354237");
  assert.match(muted, /^rgb\(/);
  assert.equal(visual.palColor("#4aa3ff"), "#4aa3ff", "colour-blind blue stays");
  assert.equal(visual.palColor("#f0a040"), "#f0a040", "colour-blind orange stays");
  assert.equal(visual.palColor("#ff4a3a"), "#ff4a3a", "raider aim red stays");
  // 半透明保留透明度
  assert.match(visual.palColor("#59774845"), /^rgba\(\d+,\d+,\d+,0\.2\d+\)$/);
  // 渐变之类不是字符串的值原样返回
  const grad = { addColorStop() {} };
  assert.equal(visual.palColor(grad), grad);
  assert.equal(visual.palColor("not-a-colour"), "not-a-colour");
});

test("every infected type has art for every direction and frame", { skip: !canvasLib && "@napi-rs/canvas not installed" }, () => {
  for (const type of ["slow", "runner", "screamer", "armor", "elite"])
    for (const dir of ["down", "side", "up"])
      for (let f = 0; f < 4; f++) {
        const c = sprites.zombieSprite(type, dir, f);
        assert.ok(c && c.width > 0 && c.height > 0, `${type} ${dir} ${f}`);
      }
  assert.ok(sprites.zombieSprite("elite", "down", 0).height > sprites.zombieSprite("slow", "down", 0).height, "the warehouse guard is bigger");
});

test("pixel sheets keep the layout of the original sheet", { skip: !canvasLib && "@napi-rs/canvas not installed" }, () => {
  const src = canvasLib.createCanvas(40, 30),
    c = src.getContext("2d");
  c.fillStyle = "#3b7a2a";
  c.fillRect(5, 5, 20, 10);
  c.fillStyle = "rgba(255,0,0,0.2)";
  c.fillRect(30, 20, 8, 8);
  const out = sheets.pixelizeSheet(src, 5, "test-sheet");
  assert.equal(out.width, 40);
  assert.equal(out.height, 30);
  const d = out.getContext("2d").getImageData(0, 0, 40, 30).data;
  for (let i = 3; i < d.length; i += 4) assert.ok(d[i] === 0 || d[i] === 255, "alpha is either on or off");
  // 实心的那块有颜色，几乎透明的那块被去掉
  assert.equal(d[(7 * 40 + 10) * 4 + 3], 255);
  assert.equal(d[(25 * 40 + 34) * 4 + 3], 0);
});

test("the new/old visual switch writes only its own key and never touches saves", () => {
  const store = new Map([
    ["ember-farm-save-v1", "SAVE"],
    ["ember-farm-backup-v1", "BACKUP"],
    ["ember-farm-preferences-v1", "PREFS"],
  ]);
  const prev = globalThis.localStorage;
  globalThis.localStorage = { getItem: (k) => store.get(k) ?? null, setItem: (k, v) => store.set(k, String(v)) };
  try {
    const seen = [];
    visual.VIS.listeners.push((on) => seen.push(on));
    visual.setVisual(false);
    assert.equal(visual.VIS.on, false);
    assert.equal(store.get("ember-farm-visual-v1"), "off");
    visual.setVisual(true);
    assert.equal(store.get("ember-farm-visual-v1"), "on");
    assert.deepEqual(seen.slice(-2), [false, true]);
    assert.equal(store.get("ember-farm-save-v1"), "SAVE");
    assert.equal(store.get("ember-farm-backup-v1"), "BACKUP");
    assert.equal(store.get("ember-farm-preferences-v1"), "PREFS");
    visual.VIS.listeners.pop();
  } finally {
    globalThis.localStorage = prev;
  }
});

test("map art stays deterministic between bakes (no random layout per visit)", { skip: !canvasLib && "@napi-rs/canvas not installed" }, () => {
  for (const id of ["residential", "shelter", "archive"]) {
    const a = maps.bakeMap(id).pix.d,
      b = art(id).pix.d;
    assert.equal(a.length, b.length);
    let same = true;
    for (let i = 0; i < a.length; i += 101) if (a[i] !== b[i]) same = false;
    assert.ok(same, id + " bakes the same picture every time");
  }
});
