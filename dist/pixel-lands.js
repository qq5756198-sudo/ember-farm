// 五个地区和五张边境地图的新底图。碰撞范围、路网、交互点和原来一样，只换画法。
// 地区：溪谷试验田、旧站商街、雨巷住区、检疫科研园、北线货运站；
// 边境：雾松林场、沉湾船坞、地底避难城、白霜气象站、余晖档案岛。
import { PAL, OUTLINE, hash2, dither, rng, mix, fbm, vnoise, bayer } from "./pixel-kit.js";
import { Scene, S, AR, RAMP, dr, ground, house, yard, picket, brickWall, hedge, chainFence, railing, fenceV, scatter, paintWater, streetLamp, fireBarrel, tent, stall, container, pine, MAP_W, MAP_H, clamp } from "./pixel-build.js";
import * as T from "./pixel-things.js";
import { place, tree, rock, bush, car, hay, woodpile, fenceWood, fenceScrap } from "./pixel-farm.js";

// ---------- 共用：交互点、路网、边框 ----------
const DPOINTS = [[370, 360], [650, 360], [960, 360], [1260, 360], [370, 730], [650, 730], [960, 730], [1260, 730]];
const DKEEP = [...DPOINTS, [95, 510], [160, 510], [205, 600], [1450, 910], [410, 650], [705, 644]];
const BPOINTS = [[370, 310], [700, 300], [1080, 300], [1370, 350], [410, 650], [745, 620], [1080, 680], [1360, 820]];
const BKEEP = [...BPOINTS, [110, 510], [145, 510], [220, 570], [1450, 910], [820, 650], [550, 770], [815, 770], [1080, 770]];
// 地区的路：上下两条横路、左边一条竖路、出口、三条连接的竖路、右边的横路
const DNET = {
  upper: { x: 95, y: 158, w: 596, h: 42 },
  lower: { x: 95, y: 343, w: 596, h: 44 },
  spine: { x: 64, y: 125, w: 43, h: 312 },
  exit: { x: 16, y: 236, w: 92, h: 40 },
  midL: { x: 107, y: 236, w: 24, h: 40 },
  midR: { x: 592, y: 232, w: 141, h: 48 },
  cols: [
    { x: 304, y: 200, w: 42, h: 143 },
    { x: 459, y: 200, w: 42, h: 143 },
    { x: 609, y: 200, w: 42, h: 143 },
  ],
};
const DROUTES = [DNET.upper, DNET.lower, DNET.spine, DNET.exit, DNET.midL, DNET.midR, ...DNET.cols];
// 边境的路
const BNET = [
  { x: 71, y: 135, w: 36, h: 305 },
  { x: 91, y: 148, w: 612, h: 37 },
  { x: 37, y: 235, w: 696, h: 47 },
  { x: 92, y: 309, w: 615, h: 38 },
  { x: 99, y: 408, w: 600, h: 31 },
  { x: 333, y: 167, w: 36, h: 255 },
  { x: 518, y: 167, w: 38, h: 276 },
  { x: 662, y: 180, w: 35, h: 251 },
  { x: 185, y: 325, w: 35, h: 103 },
  { x: 14, y: 238, w: 60, h: 42 },
];
const inRect = (x, y, r, pad = 0) => x >= r.x - pad && x < r.x + r.w + pad && y >= r.y - pad && y < r.y + r.h + pad;

// 在路网上铺路面；ragged 让土路边缘毛糙
function paths(sc, rects, paint, code, ragged = 0, seed = 7) {
  for (const r of rects) sc.area(r, paint, code, ragged, seed);
}
// 路边：和别的地面交界处描一圈（土路边是一道暗色和草，铺装路是一道亮边加一道影子）
function edges(sc, code, style = "dirt") {
  const P = sc.P,
    m = sc.map;
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++) {
      const i = y * MAP_W + x;
      if (m[i] !== code) continue;
      const up = m[i - MAP_W] !== code,
        dn = m[i + MAP_W] !== code,
        lf = m[i - 1] !== code,
        rt = m[i + 1] !== code;
      if (!(up || dn || lf || rt)) continue;
      if (style === "dirt") {
        P.set(x, y, mix(P.get(x, y) || PAL.soil[2], PAL.soil[0], 0.35));
        if (up && hash2(x, y, 3) > 0.6) P.set(x, y - 1, PAL.leaf[4]);
      } else if (style === "paved") {
        P.set(x, y, up || lf ? PAL.stone[4] : PAL.stone[2]);
        if (dn) P.shade(x, y + 1, 0.65, "#18130f");
      } else if (style === "plank") {
        P.set(x, y, PAL.soil[0]);
        if (dn) P.shade(x, y + 1, 0.6, "#18130f");
      } else if (style === "snow") {
        P.set(x, y, PAL.snow[3]);
      } else if (style === "line") {
        P.set(x, y, mix(PAL.straw[3], PAL.stone[2], 0.3));
      }
    }
}
// 地图四周的树林或绿篱（大部分在走不到的边上）
function border(sc, kind = "mixed", seed = 1, depth = 26) {
  const R = rng(seed),
    spots = [];
  for (let x = -6; x < MAP_W + 6; x += 9 + Math.floor(R() * 6)) {
    spots.push([x, 6 + R() * 14]);
    spots.push([x + 4, MAP_H - 2 - R() * 8]);
  }
  for (let y = 10; y < MAP_H; y += 10 + Math.floor(R() * 6)) {
    spots.push([2 + R() * (depth - 8), y]);
    spots.push([MAP_W - 2 - R() * (depth - 8), y + 4]);
  }
  for (const [x, y] of spots) {
    if (sc.near(x, y, 16)) continue;
    const k = kind === "pine" || kind === "snowpine" ? kind : kind === "mixed" ? (R() > 0.35 ? "live" : R() > 0.5 ? "autumn" : "pine") : kind;
    const s = 0.75 + R() * 0.55;
    if (k === "pine" || k === "snowpine") sc.add(y, () => place(sc.P, pine(Math.floor(R() * 9999), s * 1.2, k === "snowpine"), x, y, { shadowW: 7, shadowH: 2 }));
    else if (k === "hedge") sc.add(y, () => T.bush2(sc.P, x, y, Math.floor(R() * 9999), 7 + Math.floor(R() * 3)));
    else sc.add(y, () => T.treeAt(sc.P, x, y, Math.floor(R() * 9999), k, s));
  }
}
const H = (sc, o) => sc.add(o.y + o.h - 1, () => house(sc, o));
const at = (sc, y, fn) => sc.add(y, fn);
const treeIn = (sc, x, y, seed, kind = "live", size = 0.8) => sc.add(y, () => T.treeAt(sc.P, x, y, seed, kind, size));
const pineIn = (sc, x, y, seed, size = 1, snow = false) => sc.add(y, () => place(sc.P, pine(seed, size, snow), x, y, { shadowW: 6 + size * 3, shadowH: 2 }));
const bushIn = (sc, x, y, seed, r = 5, flowers = null) => sc.add(y, () => T.bush2(sc.P, x, y, seed, r, flowers));
// 在“空地”（不是路、不是碰撞块）上随机摆东西
function sprinkle(sc, n, seed, fn, ok = () => true) {
  const R = rng(seed);
  let k = 0;
  for (let i = 0; i < n * 8 && k < n; i++) {
    const x = Math.round(30 + R() * (MAP_W - 60)),
      y = Math.round(30 + R() * (MAP_H - 60));
    if (sc.near(x, y, 16) || sc.inBlock(x, y, 4) || !ok(x, y, sc.code(x, y))) continue;
    k++;
    fn(x, y, R, i);
  }
}
// 田：一垄一垄的土，可选长着庄稼
function field(sc, r, crop = null, seed = 1) {
  const P = sc.P,
    R = rng(seed);
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      const row = (y - r.y) % 5;
      P.set(x, y, row === 4 ? PAL.soil[0] : row === 0 ? dither("soil", 0.55, x, y) : dither("soil", 0.32 + hash2(x, y, seed) * 0.12, x, y));
      sc.setCode(x, y, S.dirt);
    }
  P.rect(r.x - 1, r.y - 1, r.w + 2, 1, PAL.soil[3]);
  P.rect(r.x - 1, r.y + r.h, r.w + 2, 1, PAL.soil[0]);
  if (!crop) return;
  for (let y = r.y + 2; y < r.y + r.h - 1; y += 5)
    for (let x = r.x + 2; x < r.x + r.w - 2; x += 4) {
      if (R() < 0.12) continue;
      if (crop === "wheat") {
        const h = 4 + Math.floor(R() * 3);
        for (let k = 0; k < h; k++) P.set(x, y - k, k === h - 1 ? PAL.straw[4] : k > h - 3 ? PAL.straw[3] : PAL.straw[1]);
        P.set(x + 1, y - h + 1, PAL.straw[3]);
      } else if (crop === "green") {
        P.set(x, y, PAL.leaf[3]);
        P.set(x - 1, y - 1, PAL.leaf[4]);
        P.set(x + 1, y - 1, PAL.leaf[4]);
        P.set(x, y - 2, PAL.leaf[5]);
      } else if (crop === "corn") {
        for (let k = 0; k < 8; k++) P.set(x, y - k, k > 5 ? PAL.straw[3] : PAL.leaf[3]);
        P.set(x - 1, y - 4, PAL.leaf[4]);
        P.set(x + 1, y - 3, PAL.leaf[4]);
      } else if (crop === "dead") {
        P.set(x, y, PAL.straw[0]);
        P.set(x + 1, y - 1, PAL.soil[3]);
      }
    }
}
function scarecrow(P, x, y) {
  P.shadowEllipse(x + 2, y, 5, 1.5);
  P.vline(x, y - 20, y, PAL.soil[2]);
  P.hline(x - 7, x + 7, y - 15, PAL.soil[2]);
  P.rect(x - 4, y - 16, 9, 9, PAL.cloth[3]);
  P.rect(x - 2, y - 22, 5, 5, PAL.straw[3]);
  P.rect(x - 4, y - 24, 9, 2, PAL.soil[1]);
  P.rect(x - 3, y - 26, 7, 2, PAL.soil[1]);
  P.set(x - 7, y - 14, PAL.straw[3]);
  P.set(x + 7, y - 14, PAL.straw[3]);
}
function beehive(P, x, y) {
  P.shadowEllipse(x + 2, y, 5, 1.5);
  P.rect(x - 4, y - 10, 9, 10, PAL.straw[3]);
  for (let k = y - 8; k < y; k += 3) P.hline(x - 4, x + 4, k, PAL.straw[1]);
  P.rect(x - 5, y - 12, 11, 2, PAL.soil[2]);
  P.set(x, y - 2, PAL.ash[0]);
}
function trough(P, x, y) {
  P.shadowEllipse(x + 3, y, 9, 1.5);
  P.rect(x - 8, y - 5, 17, 5, PAL.soil[2]);
  P.rect(x - 7, y - 5, 15, 2, PAL.water[3]);
  P.hline(x - 8, x + 8, y - 6, PAL.soil[3]);
}
function wellAt(P, x, y) {
  P.shadowEllipse(x + 3, y, 9, 2);
  P.ellipse(x, y - 4, 8, 4, PAL.stone[2]);
  P.ellipse(x, y - 5, 6, 2.6, PAL.water[1]);
  P.rect(x - 8, y - 5, 17, 5, PAL.stone[3]);
  for (let k = x - 8; k <= x + 8; k += 4) P.vline(k, y - 5, y - 1, PAL.stone[2]);
  for (const dx of [-7, 7]) P.vline(x + dx, y - 18, y - 5, PAL.soil[2]);
  P.poly([[x - 10, y - 16], [x, y - 23], [x + 10, y - 16]], PAL.cloth[1]);
  P.hline(x - 10, x + 10, y - 16, OUTLINE, 0.6);
}
function bridge(sc, x, y, w, h, vertical = false) {
  // 小木桥：横着搭在水渠上
  const P = sc.P;
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = vertical ? j : i;
      P.set(x + i, y + j, k % 4 === 3 ? PAL.soil[0] : hash2(Math.floor(k / 4), 1, x) > 0.5 ? PAL.soil[3] : PAL.soil[2]);
      sc.setCode(x + i, y + j, S.wood);
    }
  if (!vertical) {
    P.hline(x, x + w - 1, y - 1, PAL.soil[1]);
    P.hline(x, x + w - 1, y + h, PAL.soil[1]);
    for (const yy of [y - 1, y + h]) for (let i = 0; i < w; i += 6) P.vline(x + i, yy - 3, yy, PAL.soil[1]);
  }
}
// 水渠：一道窄水，两边石头
function canal(sc, r) {
  sc.area(r, () => PAL.water[2], S.water);
  paintWater(sc, (x, y) => inRect(x, y, r) && sc.code(x, y) === S.water);
  for (let y = r.y; y < r.y + r.h; y++) {
    sc.P.set(r.x - 1, y, (y >> 1) % 2 ? PAL.stone[3] : PAL.stone[2]);
    sc.P.set(r.x + r.w, y, (y >> 1) % 2 ? PAL.stone[2] : PAL.stone[1]);
  }
}
function lampPair(sc, list, color, broken = 0.2) {
  const R = rng(list.length * 13);
  for (const [x, y] of list) if (!sc.near(x, y, 10)) sc.add(y, () => T.lampPost(sc, x, y, color, R() < broken));
}

// ================= 地区 =================
// 溪谷试验田：两块试验田（种植位在上面）、中间的泵房和水塔、一道水渠，下面两块麦田
function valley() {
  const sc = new Scene(5101, DKEEP);
  sc.fill((x, y) => ground.wild(x, y, 31, 0.08), S.ground);
  const roadPaint = (x, y) => (hash2(x, y, 5) > 0.97 ? PAL.stone[3] : dither("soil", 0.52 + fbm(x * 0.09, y * 0.09, 9, 2) * 0.28, x, y));
  paths(sc, [DNET.upper, DNET.lower, DNET.spine, DNET.exit, DNET.midL, DNET.midR, ...DNET.cols], roadPaint, S.dirt, 2, 31);
  edges(sc, S.dirt, "dirt");
  // 车辙
  for (const r of [DNET.upper, DNET.lower]) for (let x = r.x + 4; x < r.x + r.w - 4; x++) for (const yy of [r.y + 12, r.y + r.h - 12]) if (hash2(x, yy, 3) > 0.25) sc.P.set(x, yy, PAL.soil[1]);
  // 试验田（种植位就在里面）和下面的麦田
  field(sc, { x: 128, y: 212, w: 158, h: 85 }, null, 3);
  field(sc, { x: 470, y: 212, w: 122, h: 85 }, null, 4);
  field(sc, { x: 135, y: 410, w: 218, h: 60 }, "wheat", 5);
  field(sc, { x: 493, y: 410, w: 155, h: 60 }, "corn", 6);
  // 水渠：从上往下，过路的地方搭桥
  canal(sc, { x: 429, y: 0, w: 17, h: 490 });
  for (const r of [DNET.upper, DNET.lower]) bridge(sc, 425, r.y + 4, 25, r.h - 8);
  bridge(sc, 425, 238, 25, 36);
  // 灌溉小渠：从大渠分到两块田
  for (let x = 286; x < 429; x++) sc.P.set(x, 300, x % 3 ? PAL.water[3] : PAL.water[2]);
  for (let x = 446; x < 470; x++) sc.P.set(x, 300, x % 3 ? PAL.water[3] : PAL.water[2]);
  // 篱笆
  at(sc, 144, () => fenceWood(sc.P, 134, 690, 144, 3));
  at(sc, 314, () => fenceWood(sc.P, 134, 420, 314, 4));
  at(sc, 314, () => fenceWood(sc.P, 455, 690, 314, 5));
  at(sc, 402, () => fenceWood(sc.P, 132, 356, 402, 6));
  at(sc, 402, () => fenceWood(sc.P, 490, 650, 402, 7));
  // 农舍 + 温室；谷仓 + 粮仓；泵房 + 水塔
  H(sc, { x: 92, y: 48, w: 106, h: 82, roof: "tile", roofRamp: RAMP.clay, wall: "plank", wallH: 32, floors: 1, doors: [{ at: 0.62, w: 10 }], doorLamp: true, flowerBox: true, shutters: PAL.leaf[2], roofDeco: [{ type: "chimney", at: 0.18 }, { type: "solar", at: 0.45, w: 22, h: 10 }, { type: "dormer", n: 1, at: 0.8 }], lit: 0.6, broken: 0.05, seed: 501 });
  H(sc, { x: 204, y: 64, w: 61, h: 66, roof: "glass", wall: "white", wallH: 18, style: "shop", doors: [{ at: 0.5, kind: "glass", w: 8 }], windows: false, pipe: false, seed: 502 });
  at(sc, 128, () => {
    // 温室里的绿
    for (let x = 208; x < 262; x += 3) for (let y = 116; y < 126; y++) if (hash2(x, y, 7) > 0.35) sc.P.set(x, y, dither("leaf", 0.4 + hash2(x, y, 8) * 0.5, x, y));
  });
  at(sc, 30, () => T.waterTower(sc.P, 382, 250));
  H(sc, { x: 354, y: 252, w: 54, h: 42, roof: "metal", roofRamp: RAMP.grey, wall: "brick", wallH: 20, doors: [{ at: 0.35 }], roofDeco: [{ type: "pipe", at: 0.75 }], lit: 0.4, seed: 503 });
  at(sc, 296, () => T.pipeRun(sc.P, 408, 428, 292));
  H(sc, { x: 522, y: 42, w: 100, h: 78, roof: "metal", roofRamp: RAMP.grey, wall: "plank", wallRamp: RAMP.red, wallH: 30, style: "barn", door: "barn", doors: [{ at: 0.5, w: 22, h: 24 }], windows: false, holes: 1, roofDeco: [{ type: "vents", n: 2 }], seed: 504 });
  at(sc, 119, () => T.tank(sc.P, 648, 119, 14, 44, RAMP.light));
  // 田边的东西：稻草人、蜂箱、干草捆、水槽、果树
  at(sc, 286, () => scarecrow(sc.P, 140, 286));
  at(sc, 470, () => scarecrow(sc.P, 600, 452));
  for (const [x, y] of [[300, 134], [316, 136], [700, 120]]) at(sc, y, () => place(sc.P, hay(x), x, y));
  for (const [x, y] of [[680, 300], [692, 304], [704, 300]]) at(sc, y, () => beehive(sc.P, x, y));
  at(sc, 136, () => trough(sc.P, 640, 136));
  at(sc, 128, () => place(sc.P, woodpile(), 92 + 8, 136));
  at(sc, 404, () => T.wheelbarrow(sc.P, 370, 404));
  for (const [x, y, s] of [[34, 70, 1], [36, 120, 2], [30, 330, 3], [40, 400, 4], [720, 60, 5], [740, 210, 6], [728, 360, 7], [300, 40, 8], [690, 470, 9]]) treeIn(sc, x, y, 5150 + s, s % 3 ? "live" : "autumn", 0.9);
  border(sc, "mixed", 5160);
  sprinkle(sc, 14, 5170, (x, y, R, i) => bushIn(sc, x, y, 5180 + i, 4 + Math.floor(R() * 3), R() > 0.6 ? PAL.cloth[5] : null), (x, y, c) => c === S.ground);
  scatter(sc, 600, ["tuft", "flower", "flower", "weed", "tuft"], (x, y, c) => c === S.ground);
  scatter(sc, 160, ["pebble", "tuft"], (x, y, c) => c === S.dirt);
  sc.flushProps();
  return sc.done({ variant: "valley" });
}

// 旧站商街：车站大楼（钟楼）、两边的铺面、中间两个小市场，下面是广场
function stationMarket() {
  const sc = new Scene(5102, DKEEP);
  sc.fill((x, y) => ground.paving(x, y, 9, 6, "straw", 0.42), S.paving);
  // 广场砖之外的空地是土和草
  for (const r of [{ x: 0, y: 0, w: MAP_W, h: 40 }, { x: 0, y: 480, w: MAP_W, h: 32 }, { x: 0, y: 0, w: 24, h: MAP_H }, { x: 744, y: 0, w: 24, h: MAP_H }]) sc.area(r, (x, y) => ground.wild(x, y, 33, 0.4), S.ground, 3, 33);
  // 主要的路：深一点的方石
  paths(sc, DROUTES, (x, y) => ground.paving(x, y, 6, 4, "stone", 0.46), S.road);
  edges(sc, S.road, "paved");
  // 车站后面的铁路和站台
  for (const y of [8, 24]) for (let x = 0; x < MAP_W; x++) {
    if ((x % 5) === 0) for (let k = -1; k <= 6; k++) sc.P.set(x, y + k, PAL.soil[1]);
    sc.P.set(x, y, PAL.stone[4]);
    sc.P.set(x, y + 5, PAL.stone[4]);
  }
  sc.area({ x: 0, y: 34, w: MAP_W, h: 10 }, (x, y) => ground.concrete(x, y, 14), S.paving);
  for (let x = 0; x < MAP_W; x++) sc.P.set(x, 35, (x >> 2) % 2 ? PAL.ember[4] : PAL.straw[3]);
  // 下面的大广场：一块块花砖，中间一个干了的喷泉
  sc.area({ x: 122, y: 398, w: 558, h: 72 }, (x, y) => ground.tiles(x, y, 10, RAMP.cream, 0.45), S.paving);
  at(sc, 440, () => {
    const P = sc.P;
    P.ellipse(400, 436, 22, 9, PAL.stone[2]);
    P.ellipse(400, 435, 19, 7, PAL.stone[3]);
    P.ellipse(400, 435, 16, 5.5, PAL.water[1]);
    P.rect(398, 420, 5, 14, PAL.stone[4]);
    P.ellipse(400, 420, 6, 2.2, PAL.stone[5]);
  });
  // 三栋：左边骑楼铺面，中间车站大楼带钟楼，右边旅馆
  H(sc, { x: 115, y: 50, w: 155, h: 75, roof: "tile", roofRamp: RAMP.clay, wall: "plaster", wallRamp: RAMP.cream, wallH: 34, floors: 2, style: "shop", doors: [{ at: 0.25, kind: "glass", w: 10 }, { at: 0.75, kind: "glass", w: 10 }], wallDeco: [{ type: "awning", colors: [PAL.cloth[1], PAL.cloth[5]], dy: 19, x1: 70 }, { type: "awning", colors: [PAL.water[3], PAL.cloth[5]], dy: 19, x0: 80 }, { type: "sign", w: 40, dy: 3, color: PAL.cloth[0], ink: PAL.straw[4], neon: [255, 140, 90] }], roofDeco: [{ type: "chimney", at: 0.1 }, { type: "ac", n: 2 }], lit: 0.7, broken: 0.05, seed: 511 });
  H(sc, { x: 315, y: 56, w: 150, h: 69, roof: "tile", roofRamp: RAMP.slate, wall: "brick", wallH: 32, floors: 1, style: "office", winW: 8, winH: 14, winGap: 14, doors: [{ at: 0.5, kind: "glass", w: 18, h: 18 }], wallDeco: [{ type: "sign", w: 50, dy: 1, h: 5, color: PAL.night[1], ink: PAL.straw[4], neon: [255, 210, 140] }], lit: 0.6, broken: 0.1, seed: 512 });
  at(sc, 125, () => clockTower(sc, 390, 28));
  at(sc, 34, () => train(sc.P, 470, 32));
  H(sc, { x: 520, y: 50, w: 135, h: 75, roof: "flat", roofRamp: RAMP.tar, wall: "siding", wallRamp: RAMP.teal, trim: PAL.stone[4], wallH: 36, floors: 2, style: "office", doors: [{ at: 0.3, kind: "glass", w: 10 }], wallDeco: [{ type: "awning", colors: [PAL.leaf[3], PAL.straw[4]], dy: 21, x0: 6, x1: 70 }, { type: "sign", w: 44, dy: 3, color: PAL.ember[1], ink: PAL.straw[4], neon: [255, 160, 100] }], roofDeco: [{ type: "tank", at: 0.8 }, { type: "rooftopSign", w: 44, h: 9, color: PAL.night[1], ink: PAL.ember[4], neon: [255, 120, 80] }], lit: 0.7, broken: 0.1, seed: 513 });
  // 两个小市场：卷帘、雨棚
  H(sc, { x: 240, y: 240, w: 100, h: 50, roof: "flat", roofRamp: RAMP.rust, wall: "metal", wallH: 20, style: "shop", door: "roller", rollerOpen: true, doors: [{ at: 0.28, w: 22, h: 14 }, { at: 0.75, w: 18, h: 14 }], windows: false, wallDeco: [{ type: "awning", colors: [PAL.ember[3], PAL.straw[4]], dy: 1, h: 4 }, { type: "lanterns", gap: 8 }], seed: 514 });
  H(sc, { x: 500, y: 240, w: 115, h: 50, roof: "flat", roofRamp: RAMP.teal, wall: "metal", wallH: 20, style: "shop", door: "roller", rollerOpen: true, doors: [{ at: 0.3, w: 24, h: 14 }, { at: 0.75, w: 20, h: 14 }], windows: false, wallDeco: [{ type: "awning", colors: [PAL.cloth[1], PAL.cloth[5]], dy: 1, h: 4 }, { type: "lanterns", gap: 8 }], seed: 515 });
  // 路灯、长椅、花坛、摊位、公交站
  lampPair(sc, [[62, 206], [142, 206], [286, 206], [458, 206], [664, 206], [62, 396], [142, 396], [286, 396], [458, 396], [664, 396]], [255, 214, 150], 0.25);
  for (const [x, y] of [[180, 470], [260, 470], [540, 470], [620, 470]]) at(sc, y, () => T.bench(sc.P, x, y));
  for (const [x, y] of [[140, 404], [660, 404], [140, 466], [660, 466]]) at(sc, y, () => T.planter(sc.P, x, y));
  for (const [x, y, k] of [[200, 432, 0], [580, 432, 1], [700, 300, 2], [116, 214, 3]]) if (!sc.near(x, y, 14)) at(sc, y, () => stall(sc, x, y, [[PAL.cloth[1], PAL.cloth[5]], [PAL.water[3], PAL.cloth[5]], [PAL.ember[3], PAL.straw[4]], [PAL.leaf[3], PAL.straw[4]]][k]));
  for (const [x, y] of [[300, 300], [440, 300], [690, 214], [120, 310]]) if (!sc.near(x, y, 12)) at(sc, y, () => T.crates(sc.P, x, y, 3));
  at(sc, 140, () => busStop(sc.P, 700, 140));
  // 路之间的空地：花坛里的树、长椅、一排排货摊、手推车
  for (const [x, y, s2] of [[150, 226, 1], [270, 226, 2], [400, 226, 3], [560, 226, 4], [690, 226, 5], [150, 336, 6], [270, 336, 7], [400, 336, 8], [560, 336, 9], [690, 336, 10]]) if (!sc.near(x, y, 16)) at(sc, y, () => T.treePit(sc, x, y, 5300 + s2, "live", 0.5));
  for (const [x, y] of [[214, 226], [520, 226], [214, 336], [430, 336], [600, 336]]) if (!sc.near(x, y, 12)) at(sc, y, () => T.bench(sc.P, x, y));
  for (const [x, y] of [[372, 300], [400, 300], [250, 214], [640, 300]]) if (!sc.near(x, y, 12)) at(sc, y, () => T.cart(sc.P, x, y));
  for (const [x, y, k] of [[240, 466, 0], [300, 460, 1], [500, 460, 2], [560, 466, 3]]) if (!sc.near(x, y, 14)) at(sc, y, () => T.umbrellaTable(sc.P, x, y, [[PAL.cloth[1], PAL.cloth[5]], [PAL.water[3], PAL.cloth[5]], [PAL.ember[3], PAL.straw[4]], [PAL.leaf[3], PAL.straw[4]]][k]));
  for (const [x, y, s] of [[200, 140, 1], [480, 140, 2], [720, 380, 3], [40, 160, 4], [40, 460, 5]]) if (!sc.near(x, y, 14)) treeIn(sc, x, y, 5200 + s, "live", 0.6);
  border(sc, "mixed", 5210);
  scatter(sc, 260, ["paper", "trash", "leaf", "crack", "pebble"], (x, y, c) => c === S.paving || c === S.road);
  scatter(sc, 200, ["tuft", "flower"], (x, y, c) => c === S.ground);
  sc.flushProps();
  return sc.done({ variant: "stationMarket" });
}
function clockTower(sc, cx, top) {
  const P = sc.P;
  // 钟楼：砖塔、钟面、尖顶
  for (let i = 0; i < 9; i++) P.shade(cx + 16 + Math.floor(i / 3), top + 6 + i * 4, 0.7, "#18130f");
  P.rect(cx - 15, top, 31, 46, PAL.rust[1]);
  for (let y = top; y < top + 46; y += 3) {
    P.hline(cx - 15, cx + 15, y, PAL.rust[0]);
    for (let x = cx - 15 + ((y / 3) % 2 ? 0 : 3); x < cx + 15; x += 6) P.set(x, y + 1, PAL.rust[0]);
  }
  P.vline(cx - 15, top, top + 46, PAL.rust[3]);
  P.vline(cx + 15, top, top + 46, OUTLINE);
  P.rect(cx - 17, top + 30, 35, 3, PAL.stone[3]);
  P.disc(cx, top + 15, 10, PAL.stone[5]);
  P.disc(cx, top + 15, 9, PAL.straw[4]);
  for (let a = 0; a < 12; a++) P.set(Math.round(cx + Math.cos((a / 12) * Math.PI * 2) * 7), Math.round(top + 15 + Math.sin((a / 12) * Math.PI * 2) * 7), PAL.soil[1]);
  P.line(cx, top + 15, cx, top + 9, OUTLINE);
  P.line(cx, top + 15, cx + 5, top + 16, OUTLINE);
  for (const dx of [-8, 0, 8]) {
    P.rect(cx + dx - 2, top + 35, 4, 8, PAL.water[0]);
    P.set(cx + dx - 1, top + 36, PAL.water[3]);
  }
  P.poly([[cx - 19, top + 1], [cx, top - 22], [cx + 19, top + 1]], PAL.night[2]);
  P.poly([[cx, top - 22], [cx + 19, top + 1], [cx, top + 1]], PAL.night[1]);
  P.line(cx - 19, top + 1, cx, top - 22, OUTLINE);
  P.line(cx, top - 22, cx + 19, top + 1, OUTLINE);
  P.hline(cx - 19, cx + 19, top + 1, OUTLINE);
  P.vline(cx, top - 30, top - 22, PAL.stone[3]);
  P.hline(cx - 3, cx + 3, top - 27, PAL.stone[3]);
  sc.lights.push({ x: cx, y: top + 14, w: 14, h: 14, kind: "window", dim: false });
}
function train(P, x0, y) {
  // 停在站后的一列旧客车：车头加两节车厢（侧面）
  const car = (x, w, body, roof) => {
    P.rect(x, y - 20, w, 17, body[2]);
    P.rect(x, y - 22, w, 3, roof);
    P.hline(x, x + w - 1, y - 22, PAL.stone[4]);
    for (let k = x + 4; k < x + w - 8; k += 9) {
      P.rect(k, y - 17, 6, 6, PAL.water[0]);
      P.set(k + 1, y - 16, PAL.water[3]);
    }
    P.hline(x, x + w - 1, y - 9, body[0]);
    P.rect(x, y - 4, w, 2, PAL.ash[1]);
    for (const dx of [6, 14, w - 15, w - 7]) {
      P.disc(x + dx, y - 1, 2.6, PAL.ash[0]);
      P.set(x + dx, y - 1, PAL.stone[3]);
    }
    P.vline(x, y - 22, y - 4, OUTLINE);
    P.vline(x + w - 1, y - 22, y - 4, OUTLINE);
  };
  car(x0, 70, RAMP.teal, PAL.stone[2]);
  car(x0 + 73, 70, RAMP.teal, PAL.stone[2]);
  // 车头
  const x = x0 + 146;
  P.rect(x, y - 18, 40, 15, PAL.cloth[0]);
  P.rect(x + 22, y - 26, 18, 9, PAL.cloth[1]);
  P.rect(x + 25, y - 24, 6, 5, PAL.water[1]);
  P.rect(x + 4, y - 26, 6, 9, PAL.ash[1]);
  P.rect(x, y - 4, 40, 2, PAL.ash[1]);
  for (const dx of [6, 16, 28]) P.disc(x + dx, y - 1, 3, PAL.ash[0]);
  P.vline(x + 40, y - 26, y - 4, OUTLINE);
}
function busStop(P, x, y) {
  P.shadowEllipse(x + 4, y, 14, 2);
  P.rect(x - 12, y - 18, 26, 3, PAL.stone[2]);
  P.hline(x - 12, x + 13, y - 18, PAL.stone[4]);
  for (const dx of [-11, 12]) P.vline(x + dx, y - 15, y, PAL.stone[1]);
  P.rect(x - 10, y - 15, 21, 10, PAL.water[1]);
  P.set(x - 8, y - 13, PAL.water[4]);
  P.rect(x - 8, y - 4, 17, 2, PAL.soil[3]);
}

// 雨巷住区：挤在一起的老楼、楼之间的晾衣绳和木走道、石板巷子，到处是水洼
function courtyard() {
  const sc = new Scene(5103, DKEEP);
  sc.fill((x, y) => ground.paving(x, y, 6, 3, "soil", 0.34), S.paving);
  for (const r of [{ x: 0, y: 0, w: MAP_W, h: 34 }, { x: 0, y: 482, w: MAP_W, h: 30 }, { x: 0, y: 0, w: 26, h: MAP_H }, { x: 742, y: 0, w: 26, h: MAP_H }]) sc.area(r, (x, y) => ground.lush(x, y, 41), S.ground, 3, 41);
  paths(sc, DROUTES, (x, y) => cobble(x, y, 0.3), S.road);
  edges(sc, S.road, "paved");
  // 两个小院子（铺着方砖），中间一口井
  sc.area({ x: 266, y: 228, w: 132, h: 90 }, (x, y) => ground.paving(x, y, 10, 10, "stone", 0.55), S.paving);
  sc.area({ x: 512, y: 228, w: 72, h: 90 }, (x, y) => ground.paving(x, y, 8, 8, "stone", 0.5), S.paving);
  at(sc, 276, () => wellAt(sc.P, 330, 276));
  // 菜园
  for (const [r, s] of [[{ x: 140, y: 412, w: 136, h: 56 }, 1], [{ x: 328, y: 412, w: 104, h: 56 }, 2], [{ x: 540, y: 412, w: 122, h: 56 }, 3]]) {
    field(sc, r, s === 2 ? "corn" : "green", 600 + s);
    at(sc, r.y + r.h + 2, () => fenceWood(sc.P, r.x - 2, r.x + r.w + 1, r.y + r.h + 2, s));
  }
  // 六栋老楼
  const tenement = (x, y, w, h, s, extra = {}) => H(sc, { x, y, w, h, roof: "tile", roofRamp: [RAMP.clay, RAMP.slate, RAMP.brown, RAMP.clay][s % 4], wall: ["brick", "plaster", "redbrick", "siding"][s % 4], wallRamp: s % 4 === 3 ? RAMP.light : undefined, wallH: 30, floors: 2, shutters: s % 2 ? PAL.leaf[2] : null, flowerBox: true, roofDeco: [{ type: "chimney", at: 0.2 + (s % 3) * 0.25 }, s % 2 ? { type: "antenna", at: 0.75 } : { type: "dormer", n: 1 }], wallDeco: [{ type: "ac", n: 2 }, s % 3 === 0 ? { type: "vines", amount: 0.3 } : { type: "poster", n: 2 }], moss: 0.25, lit: 0.55, broken: 0.1, boarded: 0.1, seed: 520 + s, ...extra });
  tenement(125, 50, 120, 75, 1);
  tenement(310, 50, 120, 75, 2);
  tenement(500, 50, 145, 75, 3);
  tenement(130, 225, 135, 75, 4);
  tenement(400, 225, 110, 75, 5);
  tenement(585, 225, 90, 75, 6);
  // 楼与楼之间的木走道、晾衣绳
  for (const [x0, x1, y] of [[245, 310, 90], [430, 500, 92]]) at(sc, y + 6, () => {
    const P = sc.P;
    for (let x = x0; x <= x1; x++) for (let j = 0; j < 5; j++) P.set(x, y + j, j === 4 ? PAL.soil[0] : (x >> 2) % 2 ? PAL.soil[3] : PAL.soil[2]);
    P.hline(x0, x1, y - 3, PAL.soil[1]);
    for (let x = x0; x <= x1; x += 6) P.vline(x, y - 3, y, PAL.soil[1]);
  });
  for (const [x0, x1, y] of [[250, 305, 70], [436, 494, 72], [270, 395, 222], [515, 580, 222]]) at(sc, y + 14, () => T.laundry(sc.P, x0, x1, y + 14));
  // 巷子里的自行车、盆栽、垃圾桶、灯
  for (const [x, y] of [[150, 136], [470, 136], [700, 140], [120, 216], [300, 330], [700, 330]]) if (!sc.near(x, y, 12)) at(sc, y, () => (x % 3 ? T.bicycle(sc.P, x, y) : T.bin(sc.P, x, y)));
  for (const [x, y] of [[250, 128], [440, 130], [660, 128], [270, 306], [520, 306], [140, 306]]) if (!sc.near(x, y, 10)) at(sc, y, () => T.planter(sc.P, x, y));
  lampPair(sc, [[118, 206], [296, 206], [452, 206], [602, 206], [118, 392], [296, 392], [452, 392], [602, 392]], [255, 200, 130], 0.35);
  border(sc, "live", 5220);
  // 雨巷：地上一块块的水洼和青苔
  for (let i = 0; i < 46; i++) {
    const x = Math.floor(sc.rand() * MAP_W),
      y = Math.floor(sc.rand() * MAP_H),
      c = sc.code(x, y);
    if ((c !== S.paving && c !== S.road) || sc.inBlock(x, y, 2)) continue;
    const w = 4 + sc.rand() * 8;
    sc.P.ellipse(x, y, w, w * 0.35, PAL.water[1], 0.85);
    sc.P.hline(Math.round(x - w / 2), Math.round(x), Math.round(y - 1), PAL.water[3]);
  }
  scatter(sc, 400, ["weed", "weed", "leaf", "paper", "crack"], (x, y, c) => c === S.paving || c === S.road);
  sc.flushProps();
  return sc.done({ variant: "courtyard", wet: true });
}
function cobble(x, y, base) {
  // 圆石块：错开的小方块，块与块之间是暗缝
  const row = Math.floor(y / 4),
    off = (row % 2) * 2,
    col = Math.floor((x + off) / 5),
    edge = y % 4 === 3 || (x + off) % 5 === 4;
  if (edge) return hash2(x, y, 6) > 0.85 ? PAL.leaf[2] : PAL.stone[1];
  const t = base + (hash2(col, row, 9) - 0.5) * 0.22 + (y % 4 === 0 ? 0.08 : 0);
  return dither("stone", t, x, y);
}

// 检疫科研园：白色的实验楼、消毒区、帐篷、发电机和铁丝网，下面一排试验温室
function quarantine() {
  const sc = new Scene(5104, DKEEP);
  sc.fill((x, y) => ground.lush(x, y, 51), S.ground);
  // 中间的大院：水泥地、地上画着线
  sc.area({ x: 122, y: 206, w: 558, h: 110 }, (x, y) => ground.concrete(x, y, 16), S.paving);
  sc.area({ x: 135, y: 400, w: 535, h: 72 }, (x, y) => ground.concrete(x, y, 12), S.paving);
  paths(sc, DROUTES, (x, y) => ground.slabs(x, y, 10, 0.68), S.road);
  edges(sc, S.road, "paved");
  for (let x = 130; x < 676; x++) if ((x >> 2) % 2) sc.P.set(x, 211, PAL.ember[4]);
  for (let x = 130; x < 676; x++) if ((x >> 2) % 2) sc.P.set(x, 311, PAL.ember[4]);
  // 两个消毒池
  for (const [x, y] of [[172, 238], [528, 238]]) {
    const P = sc.P;
    P.rect(x - 2, y - 2, 80, 40, PAL.stone[4]);
    P.rect(x, y, 76, 36, PAL.stone[2]);
    sc.area({ x: x + 3, y: y + 3, w: 70, h: 30 }, (xx, yy) => (xx % 8 === 0 || yy % 8 === 0 ? PAL.water[3] : dither("water", 0.62, xx, yy)), S.water);
    for (let k = x + 6; k < x + 70; k += 9) P.hline(k, k + 4, y + 10, PAL.water[5]);
  }
  const lab = (o) => H(sc, { roof: "flat", roofRamp: RAMP.light, wall: "white", wallH: 30, floors: 2, stripe: PAL.water[3], style: "office", lit: 0.6, broken: 0.05, ...o });
  lab({ x: 110, y: 50, w: 160, h: 75, doors: [{ at: 0.2, kind: "glass", w: 12 }], wallDeco: [{ type: "cross", at: 0.85, dy: 4 }], roofDeco: [{ type: "solar", at: 0.1, w: 34, h: 12 }, { type: "solar", at: 0.45, w: 34, h: 12 }, { type: "ac", n: 2 }], seed: 531 });
  lab({ x: 310, y: 50, w: 140, h: 75, doors: [{ at: 0.5, kind: "glass", w: 16 }], wallDeco: [{ type: "sign", w: 40, dy: 3, color: PAL.water[1], ink: PAL.stone[5], neon: [150, 230, 220] }], roofDeco: [{ type: "dish", at: 0.2 }, { type: "antenna", at: 0.8, beacon: true }, { type: "vents", n: 4 }], seed: 532 });
  lab({ x: 520, y: 50, w: 150, h: 75, stripe: PAL.leaf[3], doors: [{ at: 0.7, kind: "glass", w: 12 }], wallDeco: [{ type: "cross", at: 0.2, dy: 4 }], roofDeco: [{ type: "ac", n: 3 }, { type: "tank", at: 0.85 }], seed: 533 });
  lab({ x: 305, y: 235, w: 155, h: 50, wallH: 22, floors: 1, doors: [{ at: 0.5, kind: "glass", w: 14 }], wallDeco: [{ type: "hazard" }], roofDeco: [{ type: "vents", n: 5 }, { type: "solar", at: 0.1, w: 28, h: 8 }], seed: 534 });
  // 试验温室：一排玻璃顶的小房子
  for (const [x, w] of [[142, 136], [332, 96], [502, 140]]) H(sc, { x, y: 414, w, h: 46, roof: "glass", wall: "white", wallH: 14, windows: false, doors: [{ at: 0.5, kind: "glass", w: 8, h: 10 }], pipe: false, seed: x });
  at(sc, 462, () => {
    for (const [x, w] of [[142, 136], [332, 96], [502, 140]]) for (let i = x + 3; i < x + w - 3; i += 2) for (let y = 449; y < 458; y++) if (hash2(i, y, 3) > 0.4) sc.P.set(i, y, dither("leaf", 0.5 + hash2(i, y, 4) * 0.4, i, y));
  });
  // 帐篷、消毒淋浴、发电机、样本箱、铁丝网
  for (const [x, y] of [[150, 150], [700, 150], [700, 330], [120, 330]]) if (!sc.near(x, y, 14)) at(sc, y, () => tent(sc, x, y, 24, [PAL.stone[5], PAL.stone[4]], "cross"));
  for (const [x, y] of [[268, 300], [520, 300]]) if (!sc.near(x, y, 12)) at(sc, y, () => decon(sc.P, x, y));
  for (const [x, y] of [[480, 300], [96, 140]]) if (!sc.near(x, y, 12)) at(sc, y, () => generator(sc, x, y));
  for (const [x, y] of [[700, 214], [124, 214], [690, 396]]) if (!sc.near(x, y, 10)) at(sc, y, () => T.drumsAt(sc.P, x, y, 2));
  at(sc, 142, () => chainFence(sc, 110, 690, 142, [[164, 206], [304, 346], [459, 501], [609, 651]]));
  at(sc, 396, () => chainFence(sc, 130, 676, 396, [[164, 206], [304, 346], [459, 501], [609, 651]]));
  lampPair(sc, [[62, 206], [142, 206], [286, 206], [458, 206], [664, 206], [62, 396], [142, 396], [286, 396], [458, 396], [664, 396]], [210, 235, 255], 0.1);
  border(sc, "live", 5230);
  scatter(sc, 220, ["tuft", "flower", "weed"], (x, y, c) => c === S.ground);
  scatter(sc, 120, ["stain", "paper", "crack"], (x, y, c) => c === S.paving);
  sc.flushProps();
  return sc.done({ variant: "quarantine" });
}
function decon(P, x, y) {
  // 消毒淋浴：铁架子挂着塑料帘
  P.shadowEllipse(x + 3, y, 10, 2);
  for (const dx of [-9, 9]) P.vline(x + dx, y - 22, y, PAL.stone[2]);
  P.hline(x - 9, x + 9, y - 22, PAL.stone[3]);
  for (let k = -8; k <= 8; k++) for (let j = -20; j < -3; j++) if ((k + 20) % 3 !== 0) P.set(x + k, y + j, mix(PAL.water[5], PAL.stone[5], 0.4), 0.55);
  P.rect(x - 2, y - 24, 5, 2, PAL.ember[4]);
}
function generator(sc, x, y) {
  const P = sc.P;
  P.shadowEllipse(x + 4, y, 11, 2);
  P.rect(x - 10, y - 11, 21, 11, PAL.leaf[2]);
  P.hline(x - 10, x + 10, y - 11, PAL.leaf[4]);
  for (let k = x - 7; k < x + 4; k += 2) P.vline(k, y - 9, y - 3, PAL.leaf[1]);
  P.rect(x + 5, y - 8, 4, 4, PAL.ash[1]);
  P.set(x + 6, y - 7, PAL.ember[4]);
  P.vline(x + 9, y - 17, y - 11, PAL.ash[2]);
  sc.lights.push({ x: x + 6, y: y - 7, kind: "bulb", color: [255, 180, 90] });
  sc.chimneys.push({ x: x + 9, y: y - 18, small: true });
}

// 北线货运站：三条铁轨、龙门吊、货运仓库和调度楼，几节停着的车皮
function railDepot() {
  const sc = new Scene(5105, DKEEP);
  sc.fill((x, y) => (fbm(x * 0.06, y * 0.06, 61, 3) > 0.64 ? ground.dirt(x, y, 0.35) : ground.gravel(x, y)), S.ground);
  for (const r of [{ x: 0, y: 0, w: MAP_W, h: 30 }, { x: 0, y: 484, w: MAP_W, h: 28 }]) sc.area(r, (x, y) => ground.wild(x, y, 63, 0.4), S.ground, 3, 63);
  paths(sc, DROUTES, (x, y) => ground.concrete(x, y, 12), S.road);
  edges(sc, S.road, "paved");
  // 铁轨：碎石道床 + 枕木 + 两条钢轨
  for (const y of [214, 318, 438]) rails(sc, 100, 724, y);
  // 道岔：斜着连到下一条轨
  diagonalRail(sc, 330, 222, 390, 326);
  diagonalRail(sc, 540, 326, 600, 446);
  // 车挡
  for (const [x, y] of [[100, 214], [100, 318], [100, 438]]) at(sc, y + 8, () => bufferStop(sc.P, x, y));
  // 站台
  sc.area({ x: 120, y: 196, w: 180, h: 12 }, (x, y) => ground.concrete(x, y, 10), S.paving);
  for (let x = 120; x < 300; x++) sc.P.set(x, 207, (x >> 2) % 2 ? PAL.ember[4] : PAL.ash[1]);
  H(sc, { x: 120, y: 40, w: 190, h: 85, roof: "metal", roofRamp: RAMP.rust, wall: "brick", wallH: 32, floors: 1, style: "factory", door: "roller", doors: [{ at: 0.2, w: 24, h: 20 }, { at: 0.5, w: 24, h: 20 }, { at: 0.8, w: 24, h: 20 }], winGap: 10, wallDeco: [{ type: "dock" }, { type: "sign", w: 60, dy: 2, color: PAL.night[1], ink: PAL.straw[4] }], roofDeco: [{ type: "skylight", n: 4 }, { type: "vents", n: 3 }], holes: 1, lit: 0.3, broken: 0.3, seed: 541 });
  H(sc, { x: 485, y: 35, w: 195, h: 90, roof: "metal", roofRamp: RAMP.grey, wall: "concrete", wallH: 36, floors: 2, style: "office", doors: [{ at: 0.3, kind: "glass", w: 12 }, { at: 0.75, kind: "roller", w: 26, h: 20 }], wallDeco: [{ type: "sign", w: 50, dy: 3, color: PAL.ember[1], ink: PAL.straw[4], neon: [255, 170, 100] }, { type: "number", x: 6 }], roofDeco: [{ type: "antenna", at: 0.2, beacon: true }, { type: "ac", n: 3 }, { type: "tank", at: 0.85 }], lit: 0.4, broken: 0.2, seed: 542 });
  H(sc, { x: 125, y: 240, w: 135, h: 50, roof: "flat", roofRamp: RAMP.tar, wall: "brick", wallH: 22, floors: 1, style: "office", winW: 10, winGap: 14, doors: [{ at: 0.8, w: 8 }], roofDeco: [{ type: "antenna", at: 0.3 }], lit: 0.6, seed: 543 });
  // 龙门吊（横跨中间的铁轨）
  at(sc, 300, () => gantry(sc.P, 336, 652, 236, 300));
  // 停着的车皮、集装箱、水鹤、信号灯
  for (const [x, y, k] of [[620, 222, 0], [672, 222, 1], [120, 446, 2], [172, 446, 3]]) at(sc, y + 8, () => wagon(sc.P, x, y + 8, [RAMP.rust, RAMP.teal, RAMP.brown, RAMP.green][k]));
  for (const [x, y, k] of [[696, 140, 0], [696, 156, 1], [40, 120, 2], [700, 476, 3]]) if (!sc.near(x + 15, y, 16)) at(sc, y, () => container(sc, x, y, 34, [RAMP.rust, RAMP.teal, RAMP.green, RAMP.blue][k]));
  for (const [x, y] of [[300, 206], [560, 310], [712, 430], [320, 430]]) if (!sc.near(x, y, 10)) at(sc, y, () => signal(sc, x, y));
  at(sc, 150, () => T.waterTower(sc.P, 46, 196));
  for (const [x, y] of [[420, 140], [580, 140], [260, 396], [700, 396]]) if (!sc.near(x, y, 12)) at(sc, y, () => T.pallets(sc.P, x - 8, y, 3));
  for (const [x, y] of [[350, 140], [640, 396], [110, 396]]) if (!sc.near(x, y, 12)) at(sc, y, () => T.drumsAt(sc.P, x, y, 3));
  lampPair(sc, [[110, 150], [300, 150], [470, 150], [700, 200], [110, 400], [400, 400], [690, 400]], [255, 196, 120], 0.3);
  // 煤堆、枕木堆、轨道车
  for (const [x, y] of [[240, 300], [580, 214]]) if (!sc.near(x, y, 16)) at(sc, y, () => coalPile(sc.P, x, y));
  for (const [x, y] of [[420, 214], [660, 300], [240, 404]]) if (!sc.near(x, y, 14)) at(sc, y, () => sleepers(sc.P, x, y));
  border(sc, "mixed", 5240);
  scatter(sc, 260, ["stain", "scrap", "pebble", "tuft"], (x, y, c) => c === S.ground);
  scatter(sc, 100, ["stain", "crack"], (x, y, c) => c === S.road);
  sc.flushProps();
  return sc.done({ variant: "railDepot" });
}
function rails(sc, x0, x1, y) {
  const P = sc.P;
  for (let x = x0; x <= x1; x++) {
    for (let k = -3; k <= 10; k++) if (sc.code(x, y + k) !== S.road) P.set(x, y + k, ground.gravel(x, y + k));
    if ((x - x0) % 5 === 0) for (let k = -1; k <= 8; k++) P.set(x, y + k, PAL.soil[1]);
    if ((x - x0) % 5 === 1) for (let k = -1; k <= 8; k++) P.set(x, y + k, PAL.soil[0]);
    for (const ry of [y + 1, y + 6]) {
      P.set(x, ry, PAL.stone[4]);
      P.set(x, ry + 1, PAL.stone[1]);
    }
    sc.setCode(x, y + 3, S.rail);
  }
}
function diagonalRail(sc, x0, y0, x1, y1) {
  const P = sc.P,
    n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let i = 0; i <= n; i++) {
    const x = Math.round(x0 + ((x1 - x0) * i) / n),
      y = Math.round(y0 + ((y1 - y0) * i) / n);
    if (i % 4 === 0) P.line(x - 4, y + 2, x + 4, y - 2, PAL.soil[1]);
    P.set(x - 2, y, PAL.stone[4]);
    P.set(x + 3, y, PAL.stone[4]);
    P.set(x - 2, y + 1, PAL.stone[1]);
    P.set(x + 3, y + 1, PAL.stone[1]);
  }
}
function coalPile(P, x, y) {
  P.shadowEllipse(x + 3, y, 14, 2.5);
  for (let j = 0; j < 9; j++) for (let i = -13 + j; i <= 13 - j; i++) P.set(x + i, y - j, hash2(x + i, y - j, 4) > 0.8 ? PAL.stone[2] : hash2(x + i, y - j, 5) > 0.5 ? PAL.ash[1] : PAL.ash[0]);
}
function sleepers(P, x, y) {
  P.shadowEllipse(x + 3, y, 12, 2);
  for (let k = 0; k < 4; k++) {
    P.rect(x - 11 + (k % 2) * 2, y - 3 - k * 3, 24, 3, k % 2 ? PAL.soil[1] : PAL.soil[2]);
    P.hline(x - 11 + (k % 2) * 2, x + 12 + (k % 2) * 2, y - 3 - k * 3, PAL.soil[3]);
  }
}
function bufferStop(P, x, y) {
  P.rect(x - 3, y - 4, 4, 12, PAL.ember[2]);
  P.rect(x - 4, y - 5, 6, 2, PAL.ember[3]);
  for (let k = y - 4; k < y + 8; k += 3) P.hline(x - 3, x, k, PAL.ash[1]);
}
function wagon(P, x, y, col) {
  // 车皮：从侧面看的长箱子，轮子在下面
  P.shadowEllipse(x + 22, y, 24, 2.5);
  P.rect(x, y - 18, 46, 15, col[2]);
  for (let i = x + 2; i < x + 46; i += 4) P.vline(i, y - 16, y - 5, col[1]);
  P.rect(x, y - 18, 46, 2, col[3]);
  P.rect(x + 18, y - 15, 10, 10, col[1]);
  P.vline(x + 23, y - 15, y - 6, OUTLINE, 0.5);
  P.rect(x - 1, y - 3, 48, 2, PAL.ash[1]);
  for (const dx of [5, 13, 33, 41]) {
    P.disc(x + dx, y - 1, 2.4, PAL.ash[0]);
    P.set(x + dx, y - 1, PAL.stone[3]);
  }
  P.vline(x, y - 18, y - 4, OUTLINE);
  P.vline(x + 45, y - 18, y - 4, OUTLINE);
  P.hline(x, x + 45, y - 19, OUTLINE);
}
function signal(sc, x, y) {
  const P = sc.P;
  P.shadowEllipse(x + 2, y, 3, 1);
  P.vline(x, y - 22, y, PAL.ash[2]);
  P.rect(x - 2, y - 28, 5, 8, PAL.ash[1]);
  P.set(x, y - 26, PAL.cloth[2]);
  P.set(x, y - 23, PAL.leaf[5]);
  sc.lights.push({ x, y: y - 26, kind: "beacon", color: [255, 70, 60] });
}
function gantry(P, x0, x1, y0, y1) {
  for (const x of [x0, x1]) {
    P.rect(x, y0, 5, y1 - y0, PAL.ember[3]);
    P.vline(x + 4, y0, y1, PAL.ember[1]);
    for (let y = y0 + 4; y < y1; y += 8) P.line(x, y, x + 4, y + 5, PAL.ember[2]);
    P.rect(x - 3, y1 - 2, 11, 3, PAL.ash[2]);
  }
  P.rect(x0 - 2, y0 - 6, x1 - x0 + 9, 7, PAL.ember[3]);
  P.hline(x0 - 2, x1 + 6, y0 - 6, PAL.ember[4]);
  for (let x = x0; x < x1; x += 8) P.line(x, y0 - 5, x + 5, y0, PAL.ember[1]);
  P.hline(x0 - 2, x1 + 6, y0 + 1, OUTLINE, 0.6);
  const hx = Math.round((x0 + x1) / 2);
  P.rect(hx - 7, y0 - 2, 15, 7, PAL.ash[2]);
  P.vline(hx, y0 + 5, y0 + 26, PAL.stone[1]);
  P.rect(hx - 3, y0 + 26, 7, 3, PAL.ember[2]);
  for (let x = x0 + 2; x < x1 + 4; x++) P.shade(x, y1 + 3, 0.8, "#18130f");
}

// ================= 边境 =================
// 雾松林场：林间土路、木屋、锯木场、一垛垛原木，四周是密密的松林
function pinewood() {
  const sc = new Scene(6101, BKEEP);
  sc.fill((x, y) => forestFloor(x, y), S.ground);
  paths(sc, BNET, (x, y) => (hash2(x, y, 7) > 0.975 ? PAL.soil[1] : dither("soil", 0.58 + fbm(x * 0.08, y * 0.08, 71, 2) * 0.32 + (hash2(x, y, 8) - 0.5) * 0.06, x, y)), S.dirt, 3, 71);
  edges(sc, S.dirt, "dirt");
  // 右边的小溪
  sc.paint((x, y) => Math.abs(x - (728 + Math.sin(y * 0.05) * 5)) < 5 && y > 120 && y < 470, () => PAL.water[2], S.water);
  paintWater(sc, (x, y) => sc.code(x, y) === S.water);
  for (const y of [258, 166]) bridge(sc, 718, y - 6, 22, 14);
  // 木屋、锯木场
  H(sc, { x: 112, y: 36, w: 149, h: 67, roof: "shingle", roofRamp: RAMP.brown, wall: "log", wallH: 28, doors: [{ at: 0.5, w: 10 }], doorLamp: true, roofDeco: [{ type: "chimney", at: 0.15 }, { type: "chimney", at: 0.85, smoke: false }], moss: 0.5, lit: 0.7, broken: 0.02, seed: 611 });
  H(sc, { x: 465, y: 39, w: 187, h: 62, roof: "metal", roofRamp: RAMP.rust, wall: "plank", wallH: 26, style: "barn", door: "open", doors: [{ at: 0.3, w: 40, h: 22 }, { at: 0.75, w: 30, h: 22 }], windows: false, roofDeco: [{ type: "pipe", at: 0.5, smoke: true }, { type: "vents", n: 2 }], seed: 612 });
  at(sc, 101, () => {
    // 锯木场门里的锯台和原木
    const P = sc.P;
    P.rect(508, 92, 36, 4, PAL.stone[2]);
    P.disc(526, 90, 5, PAL.stone[4]);
    P.disc(526, 90, 2, PAL.stone[2]);
    for (let k = 0; k < 3; k++) P.rect(580 + k * 2, 88 - k * 3, 30, 3, PAL.soil[2 + (k % 2)]);
  });
  // 一垛垛原木、树桩、斧头
  for (const [x, y] of [[300, 134], [430, 132], [700, 128], [280, 222], [460, 296], [620, 396], [140, 396]]) if (!sc.near(x, y, 16)) at(sc, y, () => logPile(sc.P, x, y));
  for (const [x, y] of [[250, 210], [420, 296], [600, 214], [130, 300], [700, 300], [400, 460]]) if (!sc.near(x, y, 12)) at(sc, y, () => stump(sc.P, x, y));
  // 林子：路之间的空地上种松树（交互点和三片林地留空）
  const R = rng(6120),
    clear = (x, y) => sc.code(x, y) === S.ground && sc.code(x, y + 4) === S.ground && sc.code(x - 7, y) === S.ground && sc.code(x + 7, y) === S.ground && sc.code(x, y - 6) === S.ground;
  for (let gy = 112; gy < 490; gy += 13)
    for (let gx = 18; gx < 750; gx += 15) {
      const x = gx + Math.round((R() - 0.5) * 10),
        y = gy + Math.round((R() - 0.5) * 8);
      if (!clear(x, y) || sc.near(x, y, 30) || sc.inBlock(x, y, 8)) continue;
      const roll = R();
      if (roll < 0.34) pineIn(sc, x, y, 6200 + gx * 7 + gy, 0.85 + R() * 0.6);
      else if (roll < 0.44) bushIn(sc, x, y, 6300 + gx + gy, 4 + Math.floor(R() * 3));
      else if (roll < 0.5) at(sc, y, () => fern(sc.P, x, y));
    }
  for (const [x, y] of [[300, 30], [360, 22], [410, 34], [700, 30], [40, 60], [60, 100]]) pineIn(sc, x, y, 6400 + x, 1.2);
  border(sc, "pine", 6130, 30);
  scatter(sc, 500, ["needle", "cone", "mushroom", "tuft", "weed"], (x, y, c) => c === S.ground);
  scatter(sc, 160, ["needle", "pebble", "cone"], (x, y, c) => c === S.dirt);
  sc.flushProps();
  return sc.done({ variant: "pinewood", mist: true });
}
function forestFloor(x, y) {
  const n = fbm(x * 0.04, y * 0.04, 61, 3),
    h = hash2(x, y, 62);
  if (n < 0.43) return dither("soil", 0.22 + n * 0.55 + (h - 0.5) * 0.1, x, y);
  return dither("leaf", 0.1 + (n - 0.43) * 1.15 + (h - 0.5) * 0.12, x, y);
}
function fern(P, x, y) {
  for (const [dx, dy] of [[-4, -2], [-2, -4], [0, -5], [2, -4], [4, -2]]) {
    P.line(x, y, x + dx, y + dy, PAL.leaf[3]);
    P.set(x + dx, y + dy, PAL.leaf[5]);
  }
}
function logPile(P, x, y) {
  P.shadowEllipse(x + 4, y, 14, 2.5);
  for (let row = 0; row < 3; row++)
    for (let i = 0; i < 4 - row; i++) {
      const lx = x - 10 + i * 6 + row * 3,
        ly = y - 3 - row * 5;
      P.rect(lx - 2, ly - 2, 22, 5, PAL.soil[1]);
      P.hline(lx - 2, lx + 19, ly - 2, PAL.soil[2]);
      P.disc(lx - 2, ly, 2.6, PAL.straw[2]);
      P.set(lx - 2, ly, PAL.soil[3]);
    }
}
function stump(P, x, y) {
  P.shadowEllipse(x + 2, y, 5, 1.5);
  P.rect(x - 4, y - 5, 9, 5, PAL.soil[1]);
  P.ellipse(x, y - 5, 4.5, 2, PAL.straw[2]);
  P.ellipse(x, y - 5, 2.5, 1, PAL.soil[3]);
  P.set(x - 5, y - 1, PAL.soil[0]);
  P.set(x + 5, y - 1, PAL.soil[0]);
}

// 沉湾船坞：四周是水，码头是水泥和木板，船台上一条旧船，中间的干船坞，右下角的渡口
function shipyard() {
  const sc = new Scene(6102, BKEEP);
  sc.fill(() => PAL.water[1], S.water);
  // 陆地：一大块码头，水泥方砖
  const land = { x: 37, y: 112, w: 698, h: 358 };
  sc.area(land, (x, y) => ground.asphalt(x, y), S.paving);
  // 路网：浅色的水泥路，边上刷黄线
  paths(sc, BNET.filter((r) => r.x > 20), (x, y) => ground.concrete(x, y, 18), S.road);
  edges(sc, S.road, "line");
  // 出口的栈桥、右下角渡口
  sc.area({ x: 0, y: 238, w: 40, h: 42 }, (x, y) => ground.planks(x, y, false), S.wood);
  sc.area({ x: 700, y: 440, w: 34, h: 72 }, (x, y) => ground.planks(x, y, true), S.wood);
  // 两座楼前、船台上的空地（上面一圈水泥）
  sc.area({ x: 100, y: 20, w: 600, h: 92 }, (x, y) => ground.slabs(x, y, 14, 0.5), S.paving);
  sc.area({ x: 310, y: 36, w: 138, h: 76 }, () => PAL.water[2], S.water);
  paintWater(sc, (x, y) => sc.code(x, y) === S.water);
  // 码头边：一圈岸墙和挂着的旧轮胎
  quay(sc);
  // 空地上刷的黄色货位框
  for (const r of [{ x: 112, y: 192, w: 60, h: 36 }, { x: 390, y: 290, w: 60, h: 14 }, { x: 570, y: 192, w: 80, h: 36 }, { x: 112, y: 356, w: 60, h: 46 }, { x: 236, y: 356, w: 84, h: 46 }, { x: 570, y: 356, w: 84, h: 46 }])
    for (let y = r.y; y < r.y + r.h; y++)
      for (let x = r.x; x < r.x + r.w; x++) if ((x === r.x || x === r.x + r.w - 1 || y === r.y || y === r.y + r.h - 1) && sc.code(x, y) === S.paving && hash2(x, y, 4) > 0.15) sc.P.set(x, y, mix(PAL.ember[4], PAL.stone[2], 0.3));
  for (const [x0, x1, y] of [[0, 39, 237], [0, 39, 280]]) for (let x = x0; x <= x1; x += 6) sc.P.rect(x, y, 2, 3, PAL.soil[0]);
  // 两座楼：船库（木头，屋顶铁皮）、修船车间
  H(sc, { x: 120, y: 35, w: 157, h: 72, roof: "metal", roofRamp: RAMP.teal, wall: "plank", wallRamp: RAMP.wood, wallH: 28, style: "barn", door: "roller", doors: [{ at: 0.3, w: 30, h: 22 }, { at: 0.75, w: 26, h: 22 }], windows: false, roofDeco: [{ type: "vents", n: 2 }], holes: 1, seed: 621 });
  H(sc, { x: 497, y: 30, w: 150, h: 76, roof: "metal", roofRamp: RAMP.rust, wall: "brick", wallH: 30, floors: 1, style: "factory", door: "roller", doors: [{ at: 0.65, w: 28, h: 22 }], winGap: 10, wallDeco: [{ type: "sign", w: 40, x: 10, dy: 2, color: PAL.water[1], ink: PAL.stone[5] }], roofDeco: [{ type: "skylight", n: 3 }, { type: "pipe", at: 0.2, smoke: true }], lit: 0.3, broken: 0.25, seed: 622 });
  // 船台上的旧船
  at(sc, 100, () => T.boat(sc.P, 380, 92, 96, RAMP.light, true));
  at(sc, 104, () => {
    const P = sc.P;
    for (const x of [318, 440]) P.rect(x, 40, 3, 64, PAL.soil[1]);
  });
  // 干船坞：一圈水泥边（里面的水由画面按抽没抽来画）
  const dock = AR({ x: 820, y: 350, w: 155, h: 165 });
  at(sc, dock.y + dock.h + 2, () => {
    const P = sc.P;
    P.rect(dock.x - 3, dock.y - 3, dock.w + 6, dock.h + 6, PAL.stone[3]);
    P.rect(dock.x - 1, dock.y - 1, dock.w + 2, dock.h + 2, PAL.stone[1]);
    P.hline(dock.x - 3, dock.x + dock.w + 2, dock.y - 3, PAL.stone[4]);
    for (let y = dock.y; y < dock.y + dock.h; y++) for (let x = dock.x; x < dock.x + dock.w; x++) P.set(x, y, dither("water", 0.35 + ((y - dock.y) / dock.h) * 0.1, x, y));
  });
  // 大吊车、缆桩、绳子、货箱、集装箱、渔网、救生圈
  at(sc, 300, () => T.crane(sc.P, 700, 300, 92, 46, RAMP.ember));
  for (let x = 50; x < 730; x += 38) if (!sc.near(x, 466, 8)) at(sc, 466, () => T.bollard(sc.P, x, 466));
  for (let x = 60; x < 700; x += 52) if (!sc.near(x, 116, 8)) at(sc, 118, () => T.bollard(sc.P, x, 118));
  for (const [x, y] of [[150, 210], [300, 296], [470, 214], [620, 290], [260, 390], [600, 390]]) if (!sc.near(x, y, 14)) at(sc, y, () => T.crates(sc.P, x, y, 3));
  for (const [x, y, k] of [[400, 214, 0], [400, 228, 1], [120, 300, 2], [600, 300, 3], [440, 390, 1]]) if (!sc.near(x + 16, y, 16)) at(sc, y, () => container(sc, x, y, 34, [RAMP.rust, RAMP.teal, RAMP.green, RAMP.blue][k]));
  for (const [x, y] of [[250, 214], [630, 214], [300, 392]]) if (!sc.near(x, y, 12)) at(sc, y, () => net(sc.P, x, y));
  for (const [x, y] of [[150, 300], [560, 214], [690, 392]]) if (!sc.near(x, y, 12)) at(sc, y, () => ropeCoil(sc.P, x, y));
  for (const [x, y] of [[60, 140], [720, 200], [60, 440]]) at(sc, y, () => T.lifebuoy(sc.P, x, y - 6));
  // 水上：漂着的船、浮标
  for (const [x, y, w, wr] of [[120, 500, 50, false], [330, 498, 40, true], [560, 502, 56, false], [20, 180, 30, true], [752, 300, 30, false]]) at(sc, y, () => T.boat(sc.P, x, y, w, wr ? RAMP.rust : RAMP.light, wr));
  for (const [x, y] of [[250, 490], [460, 486], [748, 400], [16, 420]]) at(sc, y, () => buoy(sc, x, y));
  lampPair(sc, [[90, 200], [330, 200], [516, 200], [700, 230], [90, 400], [330, 400], [516, 400]], [255, 214, 150], 0.2);
  scatter(sc, 220, ["stain", "crack", "scrap", "stain"], (x, y, c) => c === S.paving);
  scatter(sc, 80, ["stain", "crack"], (x, y, c) => c === S.road);
  sc.flushProps();
  return sc.done({ variant: "shipyard", waterEdge: true });
}
function ropeCoil(P, x, y) {
  P.shadowEllipse(x + 2, y, 6, 1.5);
  P.ellipse(x, y - 2, 5, 2.5, PAL.straw[1]);
  P.ellipse(x, y - 2, 3, 1.4, PAL.straw[2]);
  P.ellipse(x, y - 2, 1.4, 0.6, PAL.straw[0]);
}
function quay(sc) {
  const P = sc.P;
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++) {
      const c = sc.code(x, y);
      if (c === S.water) continue;
      if (sc.code(x, y + 1) === S.water) {
        // 岸边：水泥边沿 + 下面的阴影
        P.set(x, y, PAL.stone[4]);
        P.set(x, y + 1, PAL.stone[1]);
        P.set(x, y + 2, mix(PAL.stone[1], PAL.water[1], 0.5));
        if (x % 24 === 0) P.disc(x, y + 3, 2, PAL.ash[1]);
      } else if (sc.code(x - 1, y) === S.water || sc.code(x + 1, y) === S.water) P.set(x, y, PAL.stone[3]);
      else if (sc.code(x, y - 1) === S.water) P.set(x, y, PAL.stone[2]);
    }
}
function net(P, x, y) {
  P.shadowEllipse(x + 2, y, 9, 2);
  for (let j = 0; j < 6; j++) for (let i = -8; i <= 8; i++) if ((i + j) % 2 === 0 && Math.abs(i) < 9 - j) P.set(x + i, y - j, PAL.straw[1]);
  P.disc(x + 6, y - 2, 1.5, PAL.ember[3]);
}
function buoy(sc, x, y) {
  const P = sc.P;
  P.ellipse(x, y, 4, 1.5, PAL.water[3]);
  P.rect(x - 2, y - 6, 5, 6, PAL.cloth[2]);
  P.hline(x - 2, x + 2, y - 4, PAL.stone[5]);
  P.vline(x, y - 10, y - 6, PAL.ash[2]);
  sc.lights.push({ x, y: y - 10, kind: "beacon", color: [255, 120, 80] });
}

// 地底避难城：上面是岩壁和管道，地面是水泥砖和刷黄线的走道，两组居住舱、控制舱
function shelter() {
  const sc = new Scene(6103, BKEEP);
  sc.fill((x, y) => ground.floor(x, y), S.floor);
  // 四周的墙：上边是带管道的混凝土墙，左右下是墙柱
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const top = y < 28,
        side = x < 14 || x > 753 || y > 494;
      if (!top && !side) continue;
      let c;
      if (top) {
        const seam = x % 32 === 0 || y === 13;
        c = seam ? PAL.stone[1] : dither("stone", 0.32 + (hash2(Math.floor(x / 32), y > 13 ? 1 : 0, 81) - 0.5) * 0.1 + fbm(x * 0.06, y * 0.06, 82, 2) * 0.15 - (y > 22 ? 0.1 : 0), x, y);
      } else c = dither("stone", 0.16 + fbm(x * 0.07, y * 0.07, 83, 2) * 0.2, x, y);
      sc.P.set(x, y, c);
      sc.setCode(x, y, S.roof);
    }
  for (let x = 14; x < 754; x++) {
    sc.P.set(x, 28, PAL.ash[0]);
    sc.P.shade(x, 29, 0.55, "#18130f");
    sc.P.shade(x, 30, 0.75, "#18130f");
    sc.P.shade(x, 31, 0.88, "#18130f");
  }
  // 走道：深色的平整水泥，两边刷黄线
  paths(sc, BNET, (x, y) => dither("stone", 0.2 + fbm(x * 0.05, y * 0.05, 84, 2) * 0.12 + (hash2(x, y, 85) - 0.5) * 0.04, x, y), S.road);
  edges(sc, S.road, "line");
  for (const r of BNET) {
    // 走道中间的箭头
    if (r.w > r.h) for (let x = r.x + 20; x < r.x + r.w - 20; x += 60) arrow(sc.P, x, r.y + Math.floor(r.h / 2), true);
    else for (let y = r.y + 20; y < r.y + r.h - 20; y += 60) arrow(sc.P, r.x + Math.floor(r.w / 2), y, false);
  }
  // 墙上的管道、壁灯、编号
  for (const [y, col] of [[8, RAMP.rust], [15, RAMP.grey], [21, RAMP.teal]]) at(sc, 2, () => T.pipeRun(sc.P, 14, 753, y + 3, col));
  for (let x = 40; x < 740; x += 88) {
    at(sc, 3, () => {
      sc.P.rect(x - 3, 23, 7, 3, PAL.ash[1]);
      sc.P.hline(x - 2, x + 2, 25, PAL.snow[4]);
    });
    sc.lights.push({ x, y: 27, kind: "fluoro", color: [215, 235, 255] });
  }
  // 居住舱：一排排像集装箱的舱室；控制舱：玻璃窗、屏幕
  H(sc, { x: 115, y: 37, w: 155, h: 71, roof: "flat", roofRamp: RAMP.grey, wall: "metal", wallH: 36, floors: 2, style: "office", winW: 9, winH: 6, winGap: 16, doors: [{ at: 0.18, kind: "dark", w: 8, h: 12 }, { at: 0.5, kind: "dark", w: 8, h: 12 }, { at: 0.82, kind: "dark", w: 8, h: 12 }], wallDeco: [{ type: "number", x: 4 }, { type: "hazard" }], roofDeco: [{ type: "vents", n: 4 }, { type: "ac", n: 2 }], lit: 0.85, broken: 0.05, seed: 631 });
  H(sc, { x: 475, y: 36, w: 177, h: 71, roof: "flat", roofRamp: RAMP.grey, wall: "white", wallH: 34, floors: 2, stripe: PAL.water[3], style: "office", winW: 14, winH: 7, winGap: 20, doors: [{ at: 0.5, kind: "glass", w: 16 }], wallDeco: [{ type: "cross", at: 0.15, dy: 4 }, { type: "sign", w: 40, x: 120, dy: 3, color: PAL.night[1], ink: PAL.leaf[5], neon: [120, 255, 170] }], roofDeco: [{ type: "dish", at: 0.8 }, { type: "vents", n: 3 }], lit: 0.9, broken: 0.05, seed: 632 });
  // 地上的通风口（画面会在这里画气流）、排水格栅、气闸门
  for (const [x, y] of [[95, 232], [325, 235], [505, 282], [690, 282]]) vent(sc.P, x, y);
  for (let x = 120; x < 700; x += 80) grateFloor(sc.P, x, 296);
  // 顶灯照在地上的位置（夜里也一样亮）
  for (const [x, y] of [[180, 166], [350, 166], [540, 166], [690, 200], [190, 258], [430, 258], [620, 258], [200, 328], [372, 328], [540, 328], [680, 328], [300, 424], [500, 424]]) sc.lights.push({ x, y, kind: "fluoro", color: [215, 235, 255] });
  // 区域：空地上刷着斜线的停放区、上下铺、食堂桌、储物柜、水箱、发电机、水培架、货箱
  for (const r of [{ x: 120, y: 196, w: 60, h: 30 }, { x: 600, y: 196, w: 50, h: 30 }, { x: 240, y: 360, w: 70, h: 40 }]) hatch(sc.P, r);
  for (const [x, y] of [[40, 120], [40, 400], [730, 120]]) at(sc, y, () => T.tank(sc.P, x, y, 11, 30, RAMP.grey));
  for (const [x, y] of [[300, 222], [600, 222], [130, 400], [700, 470]]) if (!sc.near(x, y, 14)) at(sc, y, () => generator(sc, x, y));
  for (const [x, y] of [[250, 400], [420, 400], [600, 470]]) if (!sc.near(x, y, 16)) at(sc, y, () => hydroRack(sc, x, y));
  for (const [x, y] of [[150, 214], [440, 300], [640, 400], [270, 470]]) if (!sc.near(x, y, 12)) at(sc, y, () => T.crates(sc.P, x, y, 3));
  for (const [x, y] of [[440, 214], [470, 214], [130, 300], [160, 300]]) if (!sc.near(x, y, 10)) at(sc, y, () => bunk(sc.P, x, y));
  for (const [x, y] of [[600, 300], [640, 300]]) if (!sc.near(x, y, 10)) at(sc, y, () => messTable(sc.P, x, y));
  for (let x = 300; x < 460; x += 12) at(sc, 36, () => locker(sc.P, x, 36));
  at(sc, 140, () => airlock(sc.P, 330, 140));
  scatter(sc, 200, ["stain", "crack", "paper"], (x, y, c) => c === S.floor || c === S.road);
  sc.flushProps();
  return sc.done({ variant: "shelter", indoor: true });
}
function arrow(P, x, y, horiz) {
  const c = mix(PAL.straw[3], PAL.stone[2], 0.4);
  if (horiz) {
    P.hline(x - 5, x + 3, y, c);
    P.line(x + 3, y, x, y - 3, c);
    P.line(x + 3, y, x, y + 3, c);
  } else {
    P.vline(x, y - 5, y + 3, c);
    P.line(x, y + 3, x - 3, y, c);
    P.line(x, y + 3, x + 3, y, c);
  }
}
function hatch(P, r) {
  for (let y = r.y; y < r.y + r.h; y++)
    for (let x = r.x; x < r.x + r.w; x++) {
      const edge = x === r.x || y === r.y || x === r.x + r.w - 1 || y === r.y + r.h - 1;
      if (edge || (x + y) % 8 === 0) P.set(x, y, mix(PAL.ember[4], PAL.stone[2], 0.45));
    }
}
function bunk(P, x, y) {
  P.shadowEllipse(x + 3, y, 9, 2);
  for (const dx of [-8, 8]) P.vline(x + dx, y - 16, y, PAL.stone[2]);
  for (const ty of [y - 15, y - 6]) {
    P.rect(x - 8, ty, 17, 3, PAL.stone[3]);
    P.rect(x - 7, ty - 2, 15, 2, PAL.cloth[4]);
    P.rect(x - 7, ty - 2, 4, 2, PAL.cloth[5]);
  }
}
function messTable(P, x, y) {
  P.shadowEllipse(x + 3, y, 11, 2);
  P.rect(x - 10, y - 7, 21, 3, PAL.stone[4]);
  P.vline(x - 8, y - 4, y, PAL.stone[2]);
  P.vline(x + 9, y - 4, y, PAL.stone[2]);
  for (const dx of [-6, 0, 6]) P.rect(x + dx - 1, y - 9, 3, 2, PAL.stone[5]);
  P.rect(x - 11, y - 2, 23, 1, PAL.soil[2]);
}
function locker(P, x, y) {
  P.rect(x, y - 16, 10, 16, PAL.water[2]);
  P.vline(x, y - 16, y - 1, PAL.water[3]);
  P.vline(x + 9, y - 16, y - 1, OUTLINE);
  for (let k = y - 14; k < y - 10; k += 2) P.hline(x + 2, x + 7, k, PAL.water[1]);
  P.set(x + 7, y - 7, PAL.stone[4]);
}
function vent(P, x, y) {
  P.rect(x - 7, y - 4, 15, 9, PAL.stone[1]);
  P.rect(x - 6, y - 3, 13, 7, PAL.ash[0]);
  for (let k = y - 3; k < y + 4; k += 2) P.hline(x - 6, x + 6, k, PAL.stone[2]);
  P.hline(x - 7, x + 7, y - 4, PAL.stone[3]);
}
function grateFloor(P, x, y) {
  P.rect(x, y, 12, 6, PAL.ash[0]);
  for (let k = x + 1; k < x + 12; k += 2) P.vline(k, y, y + 5, PAL.stone[2]);
}
function hydroRack(sc, x, y) {
  const P = sc.P;
  P.shadowEllipse(x + 3, y, 14, 2);
  for (const dx of [-13, 13]) P.vline(x + dx, y - 20, y, PAL.stone[2]);
  for (const ty of [y - 18, y - 11, y - 4]) {
    P.rect(x - 13, ty, 27, 2, PAL.stone[3]);
    for (let k = -12; k <= 12; k += 2) {
      P.set(x + k, ty - 1, PAL.leaf[4]);
      if (hash2(x + k, ty, 3) > 0.5) P.set(x + k, ty - 2, PAL.leaf[5]);
    }
  }
  sc.lights.push({ x, y: y - 12, kind: "grow", color: [220, 140, 255] });
}
function airlock(P, x, y) {
  P.rect(x - 14, y - 22, 29, 22, PAL.stone[2]);
  P.rect(x - 11, y - 19, 23, 19, PAL.stone[1]);
  P.vline(x, y - 19, y - 1, OUTLINE);
  for (let k = x - 11; k <= x + 11; k++) if ((k >> 1) % 2) P.set(k, y - 20, PAL.ember[4]);
  P.disc(x - 4, y - 10, 2, PAL.stone[3]);
  P.disc(x + 4, y - 10, 2, PAL.stone[3]);
}

// 白霜气象站：雪地、被踩出来的灰色小路、暖和的驿舍（屋顶积雪）、带雷达球的气象站
function frost() {
  const sc = new Scene(6104, BKEEP);
  sc.fill((x, y) => snowField(x, y), S.snow);
  paths(sc, BNET, (x, y) => dither("snow", 0.16 + fbm(x * 0.09, y * 0.09, 91, 2) * 0.3 + (hash2(x, y, 3) - 0.5) * 0.08, x, y), S.dirt, 2, 91);
  edges(sc, S.dirt, "snow");
  // 路上的脚印
  for (const r of BNET) {
    const horiz = r.w > r.h;
    for (let k = 6; k < (horiz ? r.w : r.h) - 6; k += 5) {
      const x = horiz ? r.x + k : r.x + Math.floor(r.w / 2) + ((k / 5) % 2 ? 2 : -2),
        y = horiz ? r.y + Math.floor(r.h / 2) + ((k / 5) % 2 ? 2 : -2) : r.y + k;
      sc.P.set(x, y, PAL.snow[0]);
      sc.P.set(x + (horiz ? 1 : 0), y + (horiz ? 0 : 1), PAL.snow[0]);
    }
  }
  // 结冰的小池塘
  sc.paint((x, y) => ((x - 610) / 26) ** 2 + ((y - 470) / 12) ** 2 < 1, (x, y) => (hash2(x, y, 5) > 0.93 ? PAL.snow[4] : dither("water", 0.72 + (hash2(x, y, 6) - 0.5) * 0.1, x, y)), S.snow);
  H(sc, { x: 120, y: 37, w: 151, h: 69, roof: "shingle", roofRamp: RAMP.brown, wall: "log", wallH: 28, snow: 1, doors: [{ at: 0.5, w: 10 }], doorLamp: true, roofDeco: [{ type: "chimney", at: 0.2 }, { type: "chimney", at: 0.8 }], lit: 0.9, broken: 0.02, seed: 641 });
  H(sc, { x: 497, y: 37, w: 155, h: 66, roof: "flat", roofRamp: RAMP.light, wall: "concrete", wallH: 28, style: "office", snow: 0.8, doors: [{ at: 0.3, kind: "glass", w: 12 }], wallDeco: [{ type: "sign", w: 40, x: 70, dy: 3, color: PAL.night[1], ink: PAL.water[5], neon: [150, 220, 255] }], lit: 0.6, seed: 642 });
  at(sc, 104, () => radome(sc.P, 612, 52));
  at(sc, 105, () => T.antennaMast(sc, 520, 104, 70));
  // 气象仪器：百叶箱、风速计、风向袋
  at(sc, 300, () => stevenson(sc.P, 450, 296));
  at(sc, 140, () => anemometer(sc.P, 700, 140));
  at(sc, 220, () => windsock(sc.P, 140, 216));
  // 雪松、雪堆、带雪的石头、半埋的篱笆、雪地车
  const R = rng(6150),
    clear = (x, y) => sc.code(x, y) === S.snow && sc.code(x, y + 4) === S.snow && sc.code(x - 7, y) === S.snow && sc.code(x + 7, y) === S.snow;
  for (let gy = 112; gy < 490; gy += 15)
    for (let gx = 18; gx < 750; gx += 17) {
      const x = gx + Math.round((R() - 0.5) * 10),
        y = gy + Math.round((R() - 0.5) * 8);
      if (!clear(x, y) || sc.near(x, y, 30) || sc.inBlock(x, y, 8)) continue;
      const roll = R();
      if (roll < 0.22) pineIn(sc, x, y, 6500 + gx * 3 + gy, 0.75 + R() * 0.55, true);
      else if (roll < 0.34) at(sc, y, () => snowDrift(sc.P, x, y, R));
      else if (roll < 0.4) at(sc, y, () => snowRock(sc.P, x, y, R));
    }
  for (const [x0, x1, y] of [[120, 300, 136], [470, 690, 136]]) at(sc, y, () => fenceWood(sc.P, x0, x1, y, x0));
  at(sc, 470, () => snowcat(sc.P, 140, 470));
  for (const [x, y] of [[300, 214], [600, 214], [250, 390]]) if (!sc.near(x, y, 12)) at(sc, y, () => place(sc.P, woodpile(), x, y));
  for (const [x, y] of [[420, 140], [700, 300]]) if (!sc.near(x, y, 12)) at(sc, y, () => T.drumsAt(sc.P, x, y, 2));
  at(sc, 470, () => sled(sc.P, 300, 470));
  lampPair(sc, [[100, 200], [330, 200], [520, 200], [690, 240], [330, 400], [520, 400]], [255, 214, 160], 0.1);
  border(sc, "snowpine", 6160, 30);
  scatter(sc, 260, ["snowtuft", "pebble", "snowtuft"], (x, y, c) => c === S.snow);
  sc.flushProps();
  return sc.done({ variant: "frost", snowy: true });
}
function snowField(x, y) {
  // 雪地：大的起伏，加上被风吹出来的一道道细纹
  const n = fbm(x * 0.03, y * 0.03, 31, 3),
    rip = (x * 0.45 + y + Math.sin(x * 0.07) * 6 + fbm(x * 0.05, y * 0.05, 33, 2) * 10) % 9;
  let t = 0.55 + n * 0.38 + (hash2(x, y, 3) - 0.5) * 0.06;
  if (rip < 1) t -= 0.18;
  else if (rip < 2) t += 0.08;
  return dither("snow", t, x, y);
}
function snowRock(P, x, y, R) {
  P.shadowEllipse(x + 2, y, 6, 1.5);
  P.ellipse(x, y - 3, 6, 3.5, PAL.stone[2]);
  P.ellipse(x - 1, y - 4, 4, 2, PAL.stone[3]);
  P.ellipse(x - 1, y - 6, 5, 1.8, PAL.snow[4]);
}
function sled(P, x, y) {
  P.shadowEllipse(x + 2, y, 9, 1.5);
  P.rect(x - 8, y - 5, 17, 3, PAL.cloth[1]);
  P.hline(x - 9, x + 9, y - 1, PAL.stone[3]);
  P.set(x + 10, y - 2, PAL.stone[3]);
  P.rect(x - 6, y - 8, 10, 3, PAL.soil[2]);
}
function radome(P, x, y) {
  // 雷达罩：一个白色的大球，下面是方形的塔座
  P.rect(x - 9, y + 12, 19, 18, PAL.stone[3]);
  P.vline(x - 9, y + 12, y + 29, PAL.stone[4]);
  P.vline(x + 9, y + 12, y + 29, PAL.stone[1]);
  for (let k = y + 15; k < y + 29; k += 4) P.hline(x - 8, x + 8, k, PAL.stone[2]);
  for (let j = -17; j <= 17; j++)
    for (let i = -17; i <= 17; i++) {
      const d = i * i + j * j;
      if (d > 289) continue;
      if (d > 256) {
        P.set(x + i, y + j, OUTLINE);
        continue;
      }
      const t = 0.92 - (i + 17) / 70 - (j + 17) / 90;
      P.set(x + i, y + j, dither("stone", Math.max(0.35, t), x + i, y + j));
      if (((i + 40) % 7 === 0 || (j + 40) % 7 === 0) && d < 240) P.set(x + i, y + j, PAL.stone[3]);
    }
  for (let i = -12; i <= 4; i++) P.set(x + i, y - 14 + Math.round((i * i) / 40), PAL.snow[4]);
  P.ellipse(x - 4, y - 8, 3, 2, PAL.snow[4]);
}
function stevenson(P, x, y) {
  P.shadowEllipse(x + 2, y, 6, 1.5);
  for (const dx of [-4, 4]) P.vline(x + dx, y - 8, y, PAL.stone[3]);
  P.rect(x - 6, y - 18, 13, 10, PAL.stone[5]);
  for (let k = y - 16; k < y - 8; k += 2) P.hline(x - 5, x + 5, k, PAL.stone[3]);
  P.rect(x - 7, y - 20, 15, 2, PAL.snow[4]);
}
function anemometer(P, x, y) {
  P.vline(x, y - 30, y, PAL.stone[2]);
  P.hline(x - 6, x + 6, y - 30, PAL.stone[2]);
  for (const dx of [-6, 6]) P.disc(x + dx, y - 31, 1.5, PAL.ember[3]);
  P.vline(x, y - 34, y - 30, PAL.stone[2]);
  P.disc(x, y - 35, 1.5, PAL.ember[3]);
}
function windsock(P, x, y) {
  P.vline(x, y - 24, y, PAL.stone[2]);
  for (let k = 0; k < 12; k++) P.vline(x + 1 + k, y - 24 + Math.round(k * 0.2), y - 20 + Math.round(k * 0.1), Math.floor(k / 3) % 2 ? PAL.stone[5] : PAL.ember[3]);
}
function snowDrift(P, x, y, R) {
  P.ellipse(x, y - 2, 8 + R() * 6, 3, PAL.snow[4]);
  P.ellipse(x + 2, y - 1, 6, 1.5, PAL.snow[2]);
}
function snowcat(P, x, y) {
  P.shadowEllipse(x + 6, y, 20, 3);
  P.rect(x - 18, y - 6, 38, 6, PAL.ash[1]);
  for (let k = x - 17; k < x + 20; k += 3) P.set(k, y - 4, PAL.stone[2]);
  P.rect(x - 14, y - 18, 28, 12, PAL.ember[3]);
  P.rect(x - 4, y - 24, 16, 7, PAL.ember[2]);
  P.rect(x - 2, y - 22, 6, 4, PAL.water[1]);
  P.rect(x - 14, y - 18, 28, 2, PAL.snow[4]);
  P.hline(x - 18, x + 19, y - 6, OUTLINE, 0.6);
}

// 余晖档案岛：四周是水和沙滩，岛上铺着石板，图书馆的柱廊、档案馆、雕像和读书的小花园
function archive() {
  const sc = new Scene(6105, BKEEP);
  sc.fill(() => PAL.water[1], S.water);
  // 岛：不规则的边，外圈沙滩
  const island = (x, y) => {
    const n = (vnoise(x * 0.04, y * 0.04, 95) - 0.5) * 22;
    return x > 34 + n && x < 736 - n && y > 22 + n * 0.5 && y < 474 - n;
  };
  sc.paint(island, (x, y) => ground.lush(x, y, 97), S.ground);
  sc.paint((x, y) => island(x, y) && (!island(x - 7, y) || !island(x + 7, y) || !island(x, y + 7) || !island(x, y - 5)), (x, y) => ground.sand(x, y), S.sand);
  paintWater(sc, (x, y) => sc.code(x, y) === S.water);
  // 路网：浅色的大石板（缝不太显眼）
  paths(sc, BNET, (x, y) => ground.tiles(x, y, 12, RAMP.cream, 0.58), S.paving);
  edges(sc, S.paving, "paved");
  // 出口的栈桥
  sc.area({ x: 0, y: 238, w: 40, h: 42 }, (x, y) => ground.planks(x, y, false), S.wood);
  // 草地上的花坛和矮篱
  for (const [x, y, w, h] of [[120, 200, 60, 20], [400, 196, 60, 22], [580, 200, 60, 20], [250, 360, 54, 30], [420, 364, 60, 26], [580, 364, 50, 26]]) at(sc, y + h, () => flowerBed(sc.P, x, y, w, h));
  // 图书馆（柱廊）、档案馆（铜绿色屋顶）
  H(sc, { x: 119, y: 37, w: 157, h: 67, roof: "flat", roofRamp: RAMP.light, wall: "stone", wallRamp: RAMP.light, wallH: 30, style: "office", winW: 7, winH: 14, winGap: 13, doors: [{ at: 0.5, kind: "double", w: 14, h: 16 }], wallDeco: [{ type: "lamp", at: 0.4 }, { type: "lamp", at: 0.6 }], roofDeco: [{ type: "greenery", at: 0.1, w: 40, h: 12 }], lit: 0.7, broken: 0.05, seed: 651 });
  at(sc, 104, () => {
    const P = sc.P;
    // 门前的柱廊
    for (let x = 126; x < 272; x += 13) {
      P.rect(x, 76, 5, 27, PAL.stone[5]);
      P.vline(x + 4, 76, 102, PAL.stone[3]);
      P.rect(x - 1, 75, 7, 2, PAL.snow[4]);
    }
    P.rect(119, 72, 157, 4, PAL.stone[4]);
    P.hline(119, 275, 72, PAL.snow[4]);
  });
  H(sc, { x: 471, y: 35, w: 186, h: 70, roof: "tile", roofRamp: RAMP.teal, wall: "stone", wallRamp: RAMP.cream, wallH: 30, style: "office", winW: 8, winH: 13, winGap: 15, doors: [{ at: 0.5, kind: "double", w: 14, h: 16 }], roofDeco: [{ type: "dormer", n: 3 }], lit: 0.7, broken: 0.05, seed: 652 });
  // 雕像、灯、长椅、书车、小花园
  for (const [x, y] of [[300, 210], [470, 214], [300, 380], [470, 380]]) if (!sc.near(x, y, 14)) at(sc, y, () => statue(sc.P, x, y));
  for (const [x, y] of [[250, 300], [620, 390], [140, 200]]) if (!sc.near(x, y, 12)) at(sc, y, () => T.bench(sc.P, x, y));
  for (const [x, y] of [[420, 140], [600, 214]]) if (!sc.near(x, y, 12)) at(sc, y, () => bookCart(sc.P, x, y));
  for (const [x, y, s] of [[250, 208, 1], [600, 300, 2], [140, 390, 3], [420, 470, 4], [700, 120, 5], [60, 140, 6], [700, 460, 7], [380, 40, 8], [430, 30, 9], [60, 330, 10]]) if (!sc.near(x, y, 16)) treeIn(sc, x, y, 6600 + s, s % 2 ? "live" : "autumn", 0.8);
  for (const [x, y] of [[230, 140], [440, 200], [600, 140], [280, 470]]) if (!sc.near(x, y, 10)) bushIn(sc, x, y, 6650 + x, 5, PAL.cloth[2]);
  at(sc, 300, () => lighthouse(sc, 744, 300));
  lampPair(sc, [[90, 200], [330, 200], [516, 200], [700, 230], [90, 400], [330, 400], [516, 400], [690, 440]], [255, 220, 160], 0.05);
  for (const [x, y, w] of [[60, 500, 40], [520, 500, 50]]) at(sc, y, () => T.boat(sc.P, x, y, w, RAMP.light));
  scatter(sc, 420, ["tuft", "flower", "flower", "weed"], (x, y, c) => c === S.ground);
  scatter(sc, 120, ["shell", "pebble"], (x, y, c) => c === S.sand);
  sc.flushProps();
  return sc.done({ variant: "archive", waterEdge: true });
}
function flowerBed(P, x, y, w, h) {
  P.rect(x - 1, y - 1, w + 2, h + 2, PAL.stone[3]);
  P.hline(x - 1, x + w, y - 1, PAL.stone[4]);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = hash2(x + i, y + j, 21);
      P.set(x + i, y + j, k > 0.82 ? [PAL.cloth[2], PAL.ember[4], PAL.cloth[5], PAL.straw[4]][Math.floor(k * 100) % 4] : dither("leaf", 0.3 + hash2(i, j, 22) * 0.45, x + i, y + j));
    }
}
function statue(P, x, y) {
  P.shadowEllipse(x + 3, y, 7, 2);
  P.rect(x - 5, y - 6, 11, 6, PAL.stone[3]);
  P.hline(x - 5, x + 5, y - 6, PAL.stone[4]);
  P.rect(x - 2, y - 18, 5, 12, PAL.water[3]);
  P.disc(x, y - 20, 2.5, PAL.water[3]);
  P.vline(x - 3, y - 16, y - 10, PAL.water[2]);
  P.vline(x + 3, y - 18, y - 12, PAL.water[4]);
}
function bookCart(P, x, y) {
  P.shadowEllipse(x + 2, y, 8, 1.5);
  P.rect(x - 7, y - 10, 15, 8, PAL.soil[2]);
  for (let k = x - 6; k < x + 7; k += 2) P.vline(k, y - 13, y - 10, [PAL.cloth[1], PAL.water[3], PAL.straw[3], PAL.leaf[3]][(k + 20) % 4]);
  P.disc(x - 5, y - 1, 1.5, PAL.ash[1]);
  P.disc(x + 5, y - 1, 1.5, PAL.ash[1]);
}
function lighthouse(sc, x, y) {
  const P = sc.P;
  P.shadowEllipse(x + 6, y, 10, 2.5);
  for (let j = 0; j < 60; j++) {
    const w = 6 - Math.round(j / 20);
    for (let i = -w; i <= w; i++) P.set(x + i, y - j, Math.floor(j / 10) % 2 ? PAL.cloth[1] : PAL.stone[5]);
  }
  P.rect(x - 5, y - 68, 11, 8, PAL.ash[1]);
  P.rect(x - 3, y - 66, 7, 5, PAL.straw[4]);
  P.poly([[x - 6, y - 68], [x, y - 75], [x + 6, y - 68]], PAL.cloth[0]);
  sc.lights.push({ x, y: y - 64, kind: "lamp", color: [255, 230, 170] });
}

export const DISTRICT_ART = { valley, stationMarket, courtyard, quarantine, railDepot };
export const FRONTIER_ART = { pinewood, shipyard, shelter, frost, archive };
