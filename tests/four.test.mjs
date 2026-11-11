// v0.44.0「四季」：画面二期——树随时节换叶、走路 8 帧和站着的小动作、旧图集转的小图重画、每张图主色调、标题页动起来。
// 只动画面：引擎、存档、随机数一样不碰（台子和浸泡和 v0.43 一字不差，另外量）。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
const read = (f) => readFileSync(new URL("../" + f, import.meta.url), "utf8");
const { GAME_VERSION, GAME_EDITION, GAME_RELEASE } = await import("../dist/version.js");
const D = await import("../dist/data.js");
await import("../dist/district-data.js");
await import("../dist/beyond-data.js");
const C = await import("../dist/ahead.js");
const maps = await import("../dist/pixel-maps.js");
const farm = await import("../dist/pixel-farm.js");
const build = await import("../dist/pixel-build.js");
const spr = await import("../dist/pixel-sprites.js");
const FD = await import("../dist/four-data.js");
const art = await import("../dist/four-art.js");
const gs = await import("../dist/gear-sprites.js");
const { GEAR_ICON_IDS } = await import("../dist/gear-data.js");
const { Renderer: FourRenderer } = await import("../dist/four-renderer.js");
const { Renderer: TrimRenderer } = await import("../dist/trim-renderer.js");
const { Renderer: CampaignRenderer } = await import("../dist/campaign-renderer.js");
const { seasonOf } = await import("../dist/almanac-data.js");

const sameData = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
const opaqueMask = (P) => Array.from({ length: P.w * P.h }, (_, i) => (P.d[i * 4 + 3] > 0 ? 1 : 0));
const withSeason = (id, fn) => {
  const was = kit.ART_SEASON.id;
  kit.ART_SEASON.id = id;
  try {
    return fn();
  } finally {
    kit.ART_SEASON.id = was;
  }
};

// ================= 版本、接线 =================
test("the four layer added no engine layer (art only): v0.43's engine sits right under whatever is on top now", async () => {
  const ease = await import("../dist/ease.js"),
    trim = await import("../dist/trim.js");
  assert.ok(C.Engine === ease.Engine || C.Engine.prototype instanceof ease.Engine);
  assert.equal(Object.getPrototypeOf(ease.Engine), trim.Engine);
});

// ================= 树随时节换叶 =================
test("trees: summer and no season are the original tree to the pixel; spring and autumn keep the crown's shape and change its colours; winter strips most trees bare and caps them with snow", () => {
  const snow = new Set(kit.PAL.snow.map((c) => kit.rgb(c).join(",")));
  const colours = (P) => {
    const out = new Set();
    for (let i = 0; i < P.w * P.h; i++) if (P.d[i * 4 + 3]) out.add([P.d[i * 4], P.d[i * 4 + 1], P.d[i * 4 + 2]].join(","));
    return out;
  };
  let bare = 0,
    blossoms = 0,
    n = 0;
  for (const kind of ["live", "autumn", "dead"])
    for (let seed = 900; seed < 960; seed += 3) {
      const size = 0.6 + (seed % 7) * 0.12,
        base = farm.tree(seed, kind, size),
        heat = withSeason("heat", () => farm.tree(seed, kind, size)),
        spring = withSeason("thaw", () => farm.tree(seed, kind, size)),
        fall = withSeason("harvest", () => farm.tree(seed, kind, size)),
        cold = withSeason("cold", () => farm.tree(seed, kind, size));
      n++;
      assert.ok(sameData(base.d, heat.d), "summer is the original tree");
      assert.deepEqual([spring.w, spring.h, fall.w, fall.h, cold.w, cold.h], [base.w, base.h, base.w, base.h, base.w, base.h], "same size every season");
      assert.ok(sameData(withSeason("cold", () => farm.tree(seed, kind, size)).d, cold.d), "the same tree every time");
      if (kind === "dead") {
        assert.ok(sameData(spring.d, base.d) && sameData(fall.d, base.d), "dead trees only change in winter");
        assert.ok([...colours(cold)].some((c) => snow.has(c)), "snow on dead branches");
        continue;
      }
      assert.ok(!sameData(spring.d, base.d) && !sameData(fall.d, base.d), "spring and autumn change the leaves");
      const mb = opaqueMask(base),
        mf = opaqueMask(fall),
        changedShape = mb.reduce((k, v, i) => k + (v !== mf[i] ? 1 : 0), 0);
      // 秋天树下落几片叶子（几个像素），树冠形状不变
      assert.ok(changedShape <= 7, kind + " " + seed + " autumn keeps the crown: " + changedShape);
      assert.ok([...colours(cold)].some((c) => snow.has(c)), "snow in winter");
      if (opaqueMask(cold).reduce((a, b) => a + b, 0) < mb.reduce((a, b) => a + b, 0) * 0.6) bare++;
      const blossom = kit.rgb(kit.PAL.ember[5]).join(",");
      if (kind === "live" && colours(spring).has(blossom) && !colours(base).has(blossom)) blossoms++;
    }
  assert.ok(bare >= 20, "most living trees are bare in winter: " + bare);
  assert.ok(blossoms >= 4, "some living trees blossom in spring: " + blossoms);
  // 松树：寒潮时节压雪（几片雪落在枝外），大小不变
  const p0 = build.pine(6400, 1.1),
    p1 = withSeason("cold", () => build.pine(6400, 1.1)),
    n0 = opaqueMask(p0).reduce((a, b) => a + b, 0),
    n1 = opaqueMask(p1).reduce((a, b) => a + b, 0);
  assert.deepEqual([p0.w, p0.h], [p1.w, p1.h]);
  assert.ok(Math.abs(n1 - n0) <= 30, "same tree: " + n0 + " → " + n1);
  assert.ok(!sameData(p0.d, p1.d), "pines get snow");
});

test("maps: baked by season; summer is the old map to the pixel, the other seasons only repaint trees; indoor maps and the frost station do not follow the seasons", () => {
  assert.deepEqual(maps.ART_SEASONS, ["thaw", "heat", "harvest", "cold"]);
  assert.equal(maps.mapSeason("farm", "cold"), "cold");
  assert.equal(maps.mapSeason("farm", "spring"), null, "unknown season: the old look");
  assert.equal(maps.mapSeason("shelter", "thaw"), null);
  assert.equal(maps.mapSeason("frost", "harvest"), null);
  assert.equal(maps.mapSeason("tunnel:9:3:12:0", "harvest"), null);
  const none = maps.bakeMap("farm", { keepPix: true }),
    heat = maps.bakeMap("farm", { keepPix: true, season: "heat" }),
    cold = maps.bakeMap("farm", { keepPix: true, season: "cold" });
  assert.equal(none.season, null);
  assert.equal(heat.season, "heat");
  assert.equal(cold.season, "cold");
  assert.ok(sameData(none.pix.d, heat.pix.d), "summer = the old farm");
  let diff = 0;
  for (let i = 0; i < none.pix.w * none.pix.h; i++) if (none.pix.d[i * 4] !== cold.pix.d[i * 4] || none.pix.d[i * 4 + 1] !== cold.pix.d[i * 4 + 1] || none.pix.d[i * 4 + 2] !== cold.pix.d[i * 4 + 2]) diff++;
  const share = diff / (none.pix.w * none.pix.h);
  assert.ok(share > 0.02 && share < 0.15, "only the trees change: " + share);
  // 地面、碰撞、灯、水洼一样（玩法和布局不动）
  assert.ok(sameData(Array.from(none.map), Array.from(cold.map)), "ground kinds unchanged");
  assert.deepEqual(none.lights, cold.lights);
  assert.deepEqual(none.puddles, cold.puddles);
  assert.equal(kit.ART_SEASON.id, null, "the season flag is put back after baking");
  // 屋里不分时节
  const shelter = maps.bakeMap("shelter", { season: "cold" });
  assert.equal(shelter.season, null);
});


test("the scene asks for the season of the day, re-bakes in the background when it changes and keeps the old picture until the new one is ready", () => {
  const r = Object.create(FourRenderer.prototype);
  r.arts = new Map();
  r._fDay = 200;
  assert.equal(r.artSeason("farm"), seasonOf(200).id);
  assert.equal(r.artSeason("shelter"), null);
  const calls = [];
  r.rebake = (region, season) => calls.push(region + "|" + season);
  const old = { canvas: {}, season: "thaw" };
  r.arts.set("farm", old);
  r.arts.set("valley", { canvas: {}, season: "thaw" });
  r.arts.set("shelter", { canvas: {}, season: null });
  r.arts.set("courtyard", false);
  r._fDay = 211;
  // 当前这张：先给原来那张，后台重画
  assert.equal(r.artFor("farm"), old);
  assert.deepEqual(calls, ["farm|harvest"]);
  calls.length = 0;
  r.fourRebakeAll();
  assert.deepEqual(calls.sort(), ["farm|harvest", "valley|harvest"], "only maps that were drawn and follow the seasons");
});

// ================= 每张图一个主色调 =================
test("each map has one main hue on the ambient light: all fifteen maps and the tunnel, brightness kept, a slight lean only", () => {
  const ids = ["farm", "market", "residential", "hospital", "warehouse", "valley", "stationMarket", "courtyard", "quarantine", "railDepot", "pinewood", "shipyard", "shelter", "frost", "archive"];
  for (const id of ids) assert.ok(D.REGIONS[id], id);
  for (const id of [...ids, "tunnel:3:1:5:0"]) {
    const h = FD.hueOf(id);
    assert.ok(h, id);
    assert.ok(Math.abs(FD.lumOf(h) - 1) < 1e-9, id + " keeps brightness");
    for (const v of h) assert.ok(v > 0.88 && v < 1.12, id + " leans only a little");
  }
  assert.equal(FD.hueOf("nowhere"), null);
  // 名字照方案
  assert.equal(FD.MAP_HUE.farm.name, "暖绿");
  assert.equal(FD.MAP_HUE.market.name, "土黄");
  assert.equal(FD.MAP_HUE.courtyard.name, "雨巷的冷蓝");
  assert.equal(FD.MAP_HUE.shipyard.name, "锈绿");
  assert.equal(FD.MAP_HUE.frost.name, "冷白");
  // 乘在环境色上：电脑上乘，手机、小窗口不乘；夜里亮度不变
  const r = Object.create(FourRenderer.prototype),
    e = { s: { region: "courtyard", day: 30 }, al: null },
    night = [100, 114, 162],
    was = kit.LOOK41.on;
  try {
    kit.LOOK41.on = true;
    const t = r.tintAmbient(night, e);
    assert.notDeepEqual(t, night);
    assert.ok(Math.abs(FD.lumOf(t) - FD.lumOf(night)) / FD.lumOf(night) < 0.01, "night brightness kept");
    assert.ok(t[2] / t[0] > night[2] / night[0], "the alley leans blue");
    const indoor = r.indoorAmbient({ s: { region: "shelter" } });
    assert.ok(indoor[0] > 146 && indoor[2] < 168, "sodium lamps in the shelter");
    kit.LOOK41.on = false;
    assert.deepEqual(r.tintAmbient(night, e), night);
  } finally {
    kit.LOOK41.on = was;
  }
});

// ================= 走路 8 帧、站着的小动作 =================
test("people walk in eight frames: the four old frames are untouched and an in-between frame sits between each pair; standing still breathes, blinks and glances", { skip: !canvasLib }, () => {
  const data = (cv) => cv.getContext("2d").getImageData(0, 0, cv.width, cv.height).data;
  for (const dir of ["down", "up", "side"])
    for (const [look, key] of [[spr.PLAYER_LOOK, "player"], [spr.lookFor("t-farmer", "farmer"), "t-farmer"]]) {
      const frames = [];
      for (let k = 0; k < 8; k++) frames.push(data(spr.personSprite(look, key, dir, k >> 1, "walk", k & 1)));
      for (let k = 0; k < 8; k += 2) assert.ok(sameData(Array.from(frames[k]), Array.from(data(spr.personSprite(look, key, dir, k >> 1, "walk")))), "old frame " + (k >> 1));
      for (let k = 1; k < 8; k += 2) {
        assert.ok(!sameData(Array.from(frames[k]), Array.from(frames[k - 1])) || dir === "up", dir + " in-between " + k + " differs from before");
        assert.ok(!sameData(Array.from(frames[k]), Array.from(frames[(k + 1) % 8])), dir + " in-between " + k + " differs from after");
      }
    }
  // 站着：吸气抬头一个像素，眨眼只动眼睛，往旁边看只动眼睛
  const L = spr.PLAYER_LOOK,
    still = data(spr.personSprite(L, "player", "down", 0, "walk")),
    blink = data(spr.personSprite(L, "player", "down", 0, "walk", 0, 2)),
    glance = data(spr.personSprite(L, "player", "down", 0, "walk", 0, 4)),
    breath = data(spr.personSprite(L, "player", "down", 0, "walk", 0, 1));
  const changed = (a, b) => {
    const out = [];
    for (let i = 0; i < a.length; i += 4) if (a[i] !== b[i] || a[i + 1] !== b[i + 1] || a[i + 2] !== b[i + 2] || a[i + 3] !== b[i + 3]) out.push(i / 4);
    return out;
  };
  const W = spr.PERSON_W,
    cb = changed(still, blink),
    cg = changed(still, glance);
  assert.ok(cb.length > 0 && cb.length <= 6 && cb.every((i) => Math.floor(i / W) >= 7 && Math.floor(i / W) <= 10), "blink: only the eyes");
  assert.ok(cg.length > 0 && cg.length <= 8 && cg.every((i) => Math.floor(i / W) >= 7 && Math.floor(i / W) <= 10), "glance: only the eyes");
  assert.ok(changed(still, breath).length > 10, "breathing moves the head and shoulders");
  // 背对着时看不见眼睛：眨眼、张望不另存图
  assert.ok(sameData(Array.from(data(spr.personSprite(L, "player", "up", 0, "walk", 0, 6))), Array.from(data(spr.personSprite(L, "player", "up", 0, "walk")))));
  // 感染者也是 8 帧，大块头也是
  for (const type of ["slow", "runner", "screamer", "armor", "elite"])
    for (let f = 0; f < 4; f++) {
      const a = data(spr.zombieSprite(type, "side", f)),
        m = data(spr.zombieSprite(type, "side", f, 1)),
        b = data(spr.zombieSprite(type, "side", (f + 1) % 4));
      assert.ok(!sameData(Array.from(m), Array.from(a)) && !sameData(Array.from(m), Array.from(b)), type + " in-between " + f);
    }
});

test("frame timing: walking steps through eight frames as fast as the old four; idle starts after standing still and stops with reduced motion", () => {
  const r = Object.create(FourRenderer.prototype);
  r.time = 10;
  r.calm = false;
  // 自己：每秒 18 帧（原来 4 帧每秒 9 帧，一步一样长）
  const steps = [];
  for (let i = 0; i < 8; i++) {
    const s = r.playerStep({ moveTime: i / 18 + 0.001 }, true, "walk");
    steps.push(s.frame * 2 + s.sub);
  }
  assert.deepEqual(steps, [0, 1, 2, 3, 4, 5, 6, 7]);
  // 刚站住没有小动作，站一会儿才有，而且会变
  assert.equal(r.playerStep({ paused: false }, false, "walk").idle, 0);
  const seen = new Set();
  for (let t = 0; t < 12; t += 0.1) {
    r.time = 10 + FD.IDLE.still + 0.01 + t;
    seen.add(r.playerStep({ paused: false }, false, "walk").idle);
  }
  assert.ok(seen.has(1) && [...seen].some((b) => b & 2) && [...seen].some((b) => b & 4), "breathes, blinks and glances: " + [...seen]);
  // 干活、暂停时不加小动作；减少晃动时不动
  assert.equal(r.playerStep({ paused: false }, false, "work").idle, 0);
  assert.equal(r.playerStep({ paused: true }, false, "walk").idle, 0);
  r.calm = true;
  assert.equal(r.idleBits(0.3, 5), 0);
  r.calm = false;
  // 感染者：原来 speed 帧每秒走 4 帧，现在 2×speed 帧每秒走 8 帧
  r.time = 0;
  const z = [];
  for (let i = 0; i < 8; i++) {
    r.time = i / 20 + 0.001;
    const s = r.zombieStep({ x: 0, y: 0 }, 10);
    z.push(s.frame * 2 + s.sub);
  }
  assert.deepEqual(z, [0, 1, 2, 3, 4, 5, 6, 7]);
  // 别人：走着按名字错开、站着有小动作
  const look = spr.lookFor("a", null);
  r.v = true;
  r.time = 3;
  const a = r.personFrame(look, "a", Math.PI / 2, true),
    b = r.personFrame(look, "b", Math.PI / 2, false);
  assert.ok(a.canvas !== undefined && b.canvas !== undefined);
});

// ================= 旧图集转的小图重画 =================
test("old-atlas sprites: every one still used in the new look has a new picture, and the scene draws it instead of the old sheet", { skip: !canvasLib }, () => {
  for (const [kind, map] of [["sprite", art.OLD_SPRITE], ["atlas", art.OLD_ATLAS], ["frontier", art.OLD_FRONTIER]])
    for (const k of Object.keys(map)) {
      const cv = art.oldArtCanvas(kind, Number(k));
      assert.ok(cv && cv.width >= 12 && cv.width <= 40 && cv.height >= 10 && cv.height <= 40, kind + " " + k + " " + (cv && cv.width + "x" + cv.height));
    }
  assert.equal(art.oldArtCanvas("sprite", 33), null, "others are left to the lower layers");
  // 场景：补给箱（第 40 格）画新的，不碰旧图集；作物的格子在下面几层要藏的时候照样不画
  const drawn = [],
    ctx = { save() {}, restore() {}, translate() {}, scale() {}, drawImage: (img, ...a) => drawn.push(img), set imageSmoothingEnabled(v) {}, set globalAlpha(v) {} };
  const r = Object.create(FourRenderer.prototype);
  Object.assign(r, { v: true, _mute: false, ctx, assets: { sprites: "OLD", expansion: "OLD", frontier: "OLD" } });
  r.sprite(40, 500, 400, 50, 45, true, 1);
  r.atlas(7, 1220, 370, 66, 46);
  r.frontierSprite(9, 700, 500, 42, 55);
  r.frontierSprite(14, 700, 500, 42, 55);
  assert.equal(drawn.length, 4);
  assert.ok(drawn.every((img) => img !== "OLD"));
  drawn.length = 0;
  r.hideCropIcons = true;
  r.sprite(24, 500, 400);
  assert.equal(drawn.length, 0, "hidden crop icon stays hidden");
  r._mute = true;
  r.hideCropIcons = false;
  r.sprite(40, 500, 400);
  assert.equal(drawn.length, 0, "muted: nothing");
});


// ================= 标题页 =================

// ================= 字 =================
