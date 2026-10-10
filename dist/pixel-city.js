// 四个废墟区的新底图：碰撞范围一样（四个街区、十字路口），各画各的样子。
// 街区本身走不进去，所以里面可以是房子加院子、树、篱笆；路、人行道、空地都能走。
// 幸存者集市：铺面、市场大棚、摊位、串灯；废弃居民区：小房子、院子、晾衣绳、疯长的草；
// 旧医院：白楼、红十字、救护帐篷和救护车；工业仓库：铁皮库房、工厂烟囱、储罐、集装箱。
import { PAL, OUTLINE, hash2, dither, rng, mix, fbm, vnoise } from "./pixel-kit.js";
import { Scene, S, AR, RAMP, dr, ground, house, yard, picket, brickWall, hedge, chainFence, railing, fenceV, scatter, streetLamp, fireBarrel, tent, stall, crateStack, container, MAP_W, MAP_H, clamp } from "./pixel-build.js";
import * as T from "./pixel-things.js";
import { place, tree, rock, bush, car } from "./pixel-farm.js";

const BLOCKS = [
  { x: 128, y: 72, w: 470, h: 190 },
  { x: 875, y: 35, w: 447, h: 300 },
  { x: 125, y: 543, w: 495, h: 196 },
  { x: 974, y: 516, w: 356, h: 275 },
].map(AR);
// 各区会用到的交互点（地图坐标），大件装饰要躲开
const KEEP = [
  [95, 523], [105, 523], [170, 520], [800, 570], [680, 425], [970, 550], [1375, 820], [1095, 905], [408, 454], [435, 454], [680, 760], [725, 770], [1180, 480], [1260, 460], [825, 332],
  [500, 750], [730, 450], [690, 790], [835, 410], [1360, 830], [770, 520], [720, 720], [1340, 550], [845, 770], [550, 465], [595, 483], [515, 525], [485, 525], [735, 830], [710, 455],
  [720, 745], [850, 455], [895, 473], [815, 515], [785, 515], [1370, 475], [1390, 560], [1390, 605], [765, 840], [810, 858], [730, 900], [700, 900], [1420, 807], [780, 470],
  [1430, 835], [840, 460], [1280, 870], [1390, 425], [815, 805], [615, 442], [645, 445], [714, 440], [1025, 565], [1004, 565], [775, 363],
];
const COVER = [
  { x: 350, y: 775, w: 145, h: 70 },
  { x: 710, y: 365, w: 135, h: 80 },
  { x: 735, y: 755, w: 150, h: 60 },
].map(AR);
// 十字路口（美术像素）
const ROAD = { y0: 176, y1: 238, x0: 338, x1: 400 };
const onRoad = (x, y) => (y >= ROAD.y0 && y <= ROAD.y1) || (x >= ROAD.x0 && x <= ROAD.x1);
function blockDist(x, y) {
  let best = 1e9;
  for (const b of BLOCKS) {
    const dx = Math.max(b.x - x, 0, x - (b.x + b.w - 1)),
      dy = Math.max(b.y - y, 0, y - (b.y + b.h - 1));
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

// 路、人行道、空地
function streetBase(sc, t) {
  const P = sc.P,
    walk = t.walk ?? 18;
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const i = y * MAP_W + x;
      if (onRoad(x, y)) {
        P.set(x, y, ground.asphalt(x, y));
        sc.map[i] = S.road;
        continue;
      }
      const d = blockDist(x, y),
        n = (vnoise(x * 0.18, y * 0.18, 7) - 0.5) * 5;
      if (d <= walk) {
        P.set(x, y, t.paving ? t.paving(x, y) : ground.slabs(x, y, 10, 0.56));
        sc.map[i] = S.paving;
      } else if (t.verge && d <= (t.vergeTo ?? 999) + n) {
        P.set(x, y, t.verge(x, y));
        sc.map[i] = t.vergeCode ?? S.lot;
      } else {
        P.set(x, y, t.lot(x, y));
        sc.map[i] = S.lot;
      }
    }
  sc.blocks = BLOCKS;
  // 马路牙子：人行道边上一道亮线，路面一侧一道影子
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++) {
      const c = sc.map[y * MAP_W + x];
      if (c === S.paving) {
        const nb = [sc.map[y * MAP_W + x - 1], sc.map[y * MAP_W + x + 1], sc.map[(y - 1) * MAP_W + x], sc.map[(y + 1) * MAP_W + x]];
        if (nb.includes(S.road)) P.set(x, y, PAL.stone[4]);
        else if (nb.includes(S.lot)) P.set(x, y, PAL.stone[3]);
      } else if (c === S.road && sc.map[(y - 1) * MAP_W + x] === S.paving) {
        P.shade(x, y, 0.55, "#18130f");
        P.shade(x, y + 1, 0.8, "#18130f");
      } else if (c === S.road && (sc.map[y * MAP_W + x - 1] === S.paving || sc.map[y * MAP_W + x + 1] === S.paving)) P.shade(x, y, 0.7, "#18130f");
    }
  markings(sc);
  // 井盖、下水口
  for (const [x, y] of [[200, 207], [520, 207], [369, 120], [369, 300], [700, 207], [369, 470], [60, 207]]) manhole(P, x, y);
  for (let x = 20; x < MAP_W - 20; x += 66) {
    if (x > ROAD.x0 - 20 && x < ROAD.x1 + 20) continue;
    grate(P, x, ROAD.y0 + 1);
    grate(P, x + 30, ROAD.y1 - 2);
  }
  for (let y = 20; y < MAP_H - 20; y += 70) {
    if (y > ROAD.y0 - 20 && y < ROAD.y1 + 20) continue;
    grate(P, ROAD.x0 + 1, y, true);
    grate(P, ROAD.x1 - 2, y + 34, true);
  }
}
function markings(sc) {
  const P = sc.P,
    cy = Math.round((ROAD.y0 + ROAD.y1) / 2),
    cx = Math.round((ROAD.x0 + ROAD.x1) / 2),
    paint = (x, y, c, a = 0.85) => {
      if (sc.code(x, y) === S.road && hash2(x, y, 91) > 0.12) P.set(x, y, c, a);
    },
    yellow = mix(PAL.straw[3], PAL.stone[3], 0.25),
    white = PAL.stone[4];
  // 中线（虚线）和路边线
  for (let x = 0; x < MAP_W; x++) {
    if (x > ROAD.x0 - 18 && x < ROAD.x1 + 18) continue;
    if (x % 14 < 8) paint(x, cy, yellow);
    if (x % 3 !== 0 || hash2(x, 3, 5) > 0.2) {
      paint(x, ROAD.y0 + 4, white, 0.55);
      paint(x, ROAD.y1 - 4, white, 0.55);
    }
  }
  for (let y = 0; y < MAP_H; y++) {
    if (y > ROAD.y0 - 18 && y < ROAD.y1 + 18) continue;
    if (y % 14 < 8) paint(cx, y, yellow);
    if (y % 3 !== 0 || hash2(3, y, 5) > 0.2) {
      paint(ROAD.x0 + 4, y, white, 0.55);
      paint(ROAD.x1 - 4, y, white, 0.55);
    }
  }
  // 斑马线
  for (let y = ROAD.y0 + 6; y < ROAD.y1 - 5; y += 4)
    for (const x0 of [ROAD.x0 - 15, ROAD.x1 + 4])
      for (let k = 0; k < 11; k++) {
        paint(x0 + k, y, white, 0.8);
        paint(x0 + k, y + 1, white, 0.8);
      }
  for (let x = ROAD.x0 + 6; x < ROAD.x1 - 5; x += 4)
    for (const y0 of [ROAD.y0 - 15, ROAD.y1 + 4])
      for (let k = 0; k < 11; k++) {
        paint(x, y0 + k, white, 0.8);
        paint(x + 1, y0 + k, white, 0.8);
      }
}
function manhole(P, x, y) {
  P.disc(x, y, 4, PAL.stone[1]);
  P.disc(x, y, 3, PAL.stone[2]);
  P.hline(x - 2, x + 2, y - 1, PAL.stone[1]);
  P.hline(x - 2, x + 2, y + 1, PAL.stone[1]);
  P.set(x - 1, y - 3, PAL.stone[3]);
}
function grate(P, x, y, vertical = false) {
  const w = vertical ? 3 : 8,
    h = vertical ? 8 : 3;
  P.rect(x, y, w, h, PAL.ash[0]);
  if (vertical) for (let k = y + 1; k < y + h; k += 2) P.hline(x, x + w - 1, k, PAL.stone[1]);
  else for (let k = x + 1; k < x + w; k += 2) P.vline(k, y, y + h - 1, PAL.stone[1]);
}
// 路上的裂缝、补丁、油渍、垃圾
function roadWear(sc, n, extra = []) {
  const P = sc.P;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(sc.rand() * MAP_W),
      y = Math.floor(sc.rand() * MAP_H);
    if (sc.code(x, y) !== S.road) continue;
    if (sc.rand() < 0.08) {
      // 一块补过的沥青
      const w = 8 + Math.floor(sc.rand() * 18),
        h = 5 + Math.floor(sc.rand() * 8);
      for (let yy = y; yy < y + h; yy++) for (let xx = x; xx < x + w; xx++) if (sc.code(xx, yy) === S.road) P.set(xx, yy, dither("stone", 0.1 + hash2(xx, yy, 5) * 0.15, xx, yy));
    }
  }
  scatter(sc, n, ["crack", "crack", "crack", "pothole", "stain", "stain", "pebble", ...extra], (x, y, c) => c === S.road);
}
// 一个街区：铺一层地，再把房子、树、篱笆按前后顺序画
function blockYard(sc, b, kind, seed) {
  yard(sc, b, kind, seed);
  // 街区边缘一圈暗一点，像院墙脚
  for (let x = b.x; x < b.x + b.w; x++) {
    sc.P.shade(x, b.y, 0.7, "#18130f");
    sc.P.shade(x, b.y + b.h - 1, 0.8, "#18130f");
  }
}
const H = (sc, o) => sc.add(o.y + o.h - 1, () => house(sc, o));
const at = (sc, y, fn) => sc.add(y, fn);
function treeIn(sc, x, y, seed, kind = "live", size = 0.8) {
  sc.add(y, () => T.treeAt(sc.P, x, y, seed, kind, size));
}
function bushIn(sc, x, y, seed, r = 5, flowers = null) {
  sc.add(y, () => T.bush2(sc.P, x, y, seed, r, flowers));
}
// 院子里的一条石板小路
function path(sc, x, y0, y1, w = 6) {
  const P = sc.P;
  for (let y = y0; y <= y1; y++)
    for (let x2 = x - Math.floor(w / 2); x2 < x - Math.floor(w / 2) + w; x2++) {
      const tile = (Math.floor(y / 4) + Math.floor(x2 / 3)) % 2;
      P.set(x2, y, y % 4 === 3 ? PAL.stone[1] : tile ? PAL.stone[3] : PAL.stone[2]);
    }
}
// 空地上的树、石头、灌木（躲开交互点和路）
function lotLife(sc, kinds, n, seedBase) {
  const R = rng(seedBase);
  let placed = 0;
  for (let i = 0; i < n * 6 && placed < n; i++) {
    const x = Math.round(R() * MAP_W),
      y = Math.round(R() * MAP_H);
    if (sc.code(x, y) !== S.lot || sc.near(x, y, 18) || sc.inBlock(x, y, 6) || onRoad(x, y)) continue;
    const k = kinds[Math.floor(R() * kinds.length)];
    placed++;
    if (k === "tree") treeIn(sc, x, y, seedBase + i, R() > 0.8 ? "dead" : R() > 0.75 ? "autumn" : "live", 0.6 + R() * 0.7);
    else if (k === "dead") treeIn(sc, x, y, seedBase + i, "dead", 0.5 + R() * 0.5);
    else if (k === "rock") sc.add(y, () => place(sc.P, rock(seedBase + i, 8 + Math.floor(R() * 8), 5 + Math.floor(R() * 4)), x, y, { shadowW: 5, shadowH: 1.5 }));
    else if (k === "bush") bushIn(sc, x, y, seedBase + i, 4 + Math.floor(R() * 4), R() > 0.7 ? PAL.cloth[5] : null);
    else if (k === "rubble") sc.add(y, () => T.rubble(sc.P, x, y, seedBase + i));
    else if (k === "tires") sc.add(y, () => T.tires(sc.P, x, y));
    else if (k === "drums") sc.add(y, () => T.drumsAt(sc.P, x, y, 2 + Math.floor(R() * 2)));
    else if (k === "car") sc.add(y, () => place(sc.P, car(seedBase + i, R() > 0.5), x, y, { shadowW: 18, shadowH: 3, flip: R() > 0.5 }));
    else if (k === "crates") sc.add(y, () => T.crates(sc.P, x, y, 2 + Math.floor(R() * 3)));
  }
}
// 人行道上的路灯、树坑、长椅、垃圾桶（沿着街区四周）
function sidewalkLife(sc, opt) {
  const R = rng(opt.seed || 77),
    spots = [];
  for (const b of BLOCKS) {
    const below = b.y + b.h + 6,
      above = b.y - 7,
      left = b.x - 7,
      right = b.x + b.w + 6;
    for (let x = b.x + 10; x < b.x + b.w - 8; x += opt.step || 34) {
      spots.push([x, below, "h"]);
      spots.push([x + 14, above, "h"]);
    }
    for (let y = b.y + 14; y < b.y + b.h - 4; y += (opt.step || 34) + 6) {
      spots.push([left, y, "v"]);
      spots.push([right, y + 12, "v"]);
    }
  }
  let k = 0;
  for (const [x, y, dir] of spots) {
    if (sc.code(x, y) !== S.paving || sc.near(x, y, 13) || sc.inBlock(x, y, 2)) continue;
    const front = BLOCKS.some((b) => dir === "h" && y > b.y + b.h && y < b.y + b.h + 12 && x >= b.x && x < b.x + b.w);
    const list = front && opt.front ? opt.front : opt.kinds,
      kind = list[k++ % list.length];
    if (kind === "lamp") sc.add(y, () => T.lampPost(sc, x, y, opt.lampColor, R() < (opt.broken ?? 0.3)));
    else if (kind === "tree") sc.add(y, () => T.treePit(sc, x, y, 900 + k, R() < (opt.dead ?? 0.25) ? "dead" : "live", 0.45 + R() * 0.25));
    else if (kind === "bench") sc.add(y, () => T.bench(sc.P, x, y));
    else if (kind === "bin") sc.add(y, () => T.bin(sc.P, x, y, R() < 0.4));
    else if (kind === "hydrant") sc.add(y, () => T.hydrant(sc.P, x, y));
    else if (kind === "planter") sc.add(y, () => T.planter(sc.P, x, y));
    else if (kind === "sign") sc.add(y, () => T.signPost(sc.P, x, y));
    else if (kind === "cone") sc.add(y, () => T.cone(sc.P, x, y));
    else if (kind === "crates") sc.add(y, () => T.crates(sc.P, x, y, 2));
    else if (kind === "sacks") sc.add(y, () => T.sacks(sc.P, x, y, 3));
    else if (kind === "barrel") sc.add(y, () => fireBarrel(sc, x, y));
    else if (kind === "drums") sc.add(y, () => T.drumsAt(sc.P, x - 6, y, 2));
    else if (kind === "pallets") sc.add(y, () => T.pallets(sc.P, x - 8, y, 2));
  }
}
// 停在路边的车（躲开交互点）
function parked(sc, list) {
  for (const [kind, x, y, flip, seed] of list) {
    if (sc.near(x, y - 6, 20)) continue;
    sc.add(y, () => T.placeVehicle(sc.P, kind, x, y, seed ?? x * 7 + y, !!flip));
  }
}

// ---------- 废弃居民区 ----------
function residential() {
  const sc = new Scene(3102, KEEP);
  streetBase(sc, {
    walk: 15,
    verge: (x, y) => ground.wild(x, y, 12, 0.12),
    lot: (x, y) => ground.wild(x, y, 13, 0.3),
  });
  roadWear(sc, 520, ["weed", "weed", "leaf", "trash"]);
  const [B0, B1, B2, B3] = BLOCKS;
  for (const [i, b] of BLOCKS.entries()) blockYard(sc, b, "lush", 20 + i);
  // 上排：三栋小房子，前院、白栅栏、后面一排树
  for (const [x, s, k] of [[78, 1, "live"], [128, 2, "autumn"], [196, 3, "live"], [262, 4, "live"], [290, 5, "dead"]]) treeIn(sc, x, B0.y + 18, 3100 + s, k, 0.75);
  H(sc, { x: 68, y: 52, w: 72, h: 60, roof: "tile", roofRamp: RAMP.clay, wall: "siding", wallRamp: RAMP.cream, shutters: PAL.leaf[2], flowerBox: true, doors: [{ at: 0.66 }], roofDeco: [{ type: "chimney", at: 0.2 }, { type: "antenna", at: 0.55 }], lit: 0.3, broken: 0.2, vines: 3, seed: 11 });
  H(sc, { x: 148, y: 42, w: 68, h: 70, roof: "tile", roofRamp: RAMP.slate, wall: "brick", wallH: 32, floors: 2, roofDeco: [{ type: "dormer", n: 2 }, { type: "chimney", at: 0.82, dy: 0.15 }], holes: 1, moss: 1, lit: 0.25, broken: 0.3, boarded: 0.2, vines: 5, seed: 12 });
  H(sc, { x: 224, y: 56, w: 70, h: 56, roof: "metal", wall: "plank", tarp: true, doors: [{ at: 0.38 }], doorLamp: true, roofDeco: [{ type: "solar", at: 0.55, w: 16, h: 8 }], lit: 0.35, broken: 0.1, seed: 13 });
  at(sc, B0.y + B0.h - 2, () => picket(sc, B0.x + 2, B0.x + B0.w - 3, B0.y + B0.h - 2, PAL.stone[5], [[112, 120], [180, 188], [246, 254]]));
  at(sc, 120, () => {
    path(sc, 116, 112, 128);
    path(sc, 184, 112, 128);
    path(sc, 250, 112, 128);
  });
  for (const [x, y, s, f] of [[80, 122, 1, PAL.cloth[2]], [96, 124, 2, null], [142, 123, 3, PAL.ember[4]], [160, 125, 4, null], [210, 122, 5, PAL.cloth[5]], [232, 124, 6, null], [280, 123, 7, PAL.cloth[2]]]) bushIn(sc, x, y, 3200 + s, 4, f);
  at(sc, 126, () => T.mailbox(sc.P, 124, 126));
  at(sc, 127, () => T.mailbox(sc.P, 258, 127));
  at(sc, 122, () => T.bicycle(sc.P, 202, 122));
  at(sc, 113, () => T.bin(sc.P, 144, 113));
  at(sc, 113, () => T.bin(sc.P, 220, 113, true));
  // 右上：两层砖房、平房、小屋、车库，院子里有秋千和晾衣绳
  for (const [x, s, k] of [[540, 1, "live"], [552, 2, "autumn"], [655, 3, "live"]]) treeIn(sc, x, B1.y + 34, 3300 + s, k, 0.9);
  H(sc, { x: 444, y: 22, w: 92, h: 76, roof: "tile", roofRamp: RAMP.slate, wall: "redbrick", wallH: 34, floors: 2, roofDeco: [{ type: "chimney", at: 0.12 }, { type: "chimney", at: 0.85 }, { type: "dormer", n: 2 }], flowerBox: true, lit: 0.3, broken: 0.25, boarded: 0.15, vines: 4, moss: 1, seed: 21 });
  H(sc, { x: 562, y: 30, w: 94, h: 62, roof: "shingle", roofRamp: RAMP.tar, wall: "siding", wallRamp: RAMP.teal, trim: PAL.stone[4], doors: [{ at: 0.3 }], roofDeco: [{ type: "solar", at: 0.55, w: 22, h: 10 }, { type: "dish", at: 0.2 }], lit: 0.4, broken: 0.15, seed: 22 });
  H(sc, { x: 466, y: 106, w: 72, h: 52, roof: "tile", roofRamp: RAMP.green, wall: "log", holes: 2, moss: 2, boardDoor: true, lit: 0.1, broken: 0.4, boarded: 0.3, vines: 6, seed: 23 });
  H(sc, { x: 558, y: 110, w: 46, h: 40, roof: "metal", roofRamp: RAMP.grey, wall: "metal", door: "roller", doors: [{ at: 0.5, w: 22 }], windows: false, foundation: false, pipe: false, seed: 24 });
  sc.add(165, () => place(sc.P, car(3401), 584, 165, { shadowW: 18, shadowH: 3 }));
  at(sc, 140, () => T.swing(sc.P, 630, 140));
  at(sc, 160, () => T.laundry(sc.P, 612, 656, 160));
  at(sc, 126, () => T.doghouse(sc.P, 450, 126));
  at(sc, 165, () => picket(sc, B1.x + 2, B1.x + B1.w - 3, B1.y + B1.h - 2, PAL.stone[5], [[496, 506], [572, 598]]));
  at(sc, 161, () => T.gardenBed(sc.P, 444, 140, 18, 12, rng(7), true));
  for (const [x, y, s] of [[446, 160, 1], [544, 154, 2], [660, 120, 3], [608, 100, 4]]) bushIn(sc, x, y, 3450 + s, 5, s % 2 ? PAL.cloth[5] : null);
  at(sc, 99, () => fenceV(sc, B1.x + 1, B1.y + 70, B1.y + B1.h - 4));
  // 下排：三栋房子背对马路，后院一排绿篱
  at(sc, B2.y + 6, () => hedge(sc, B2.x + 2, B2.x + B2.w - 3, B2.y + 6, 31));
  for (const [x, s] of [[100, 1], [190, 2], [282, 3]]) treeIn(sc, x, B2.y + 14, 3500 + s, s === 2 ? "autumn" : "live", 0.7);
  H(sc, { x: 68, y: 290, w: 70, h: 64, roof: "tile", roofRamp: RAMP.clay, wall: "siding", wallRamp: RAMP.light, shutters: PAL.cloth[3], doors: [{ at: 0.3 }], roofDeco: [{ type: "chimney", at: 0.75 }], flowerBox: true, lit: 0.3, broken: 0.2, seed: 31 });
  H(sc, { x: 148, y: 280, w: 82, h: 74, roof: "shingle", roofRamp: RAMP.brown, wall: "plaster", wallRamp: RAMP.cream, wallH: 32, floors: 2, holes: 2, roofDeco: [{ type: "dormer", n: 1 }, { type: "antenna", at: 0.8 }], lit: 0.2, broken: 0.35, boarded: 0.25, vines: 4, dirty: true, seed: 32 });
  H(sc, { x: 240, y: 294, w: 66, h: 60, roof: "metal", roofRamp: RAMP.rust, wall: "brick", doors: [{ at: 0.6 }], doorLamp: true, roofDeco: [{ type: "pipe", at: 0.3 }], lit: 0.35, seed: 33 });
  at(sc, 367, () => picket(sc, B2.x + 2, B2.x + B2.w - 3, B2.y + B2.h - 2, PAL.soil[3], [[84, 92], [222, 230], [276, 284]]));
  for (const [x, y, s, f] of [[74, 362, 1, PAL.ember[4]], [140, 363, 2, null], [180, 361, 3, PAL.cloth[2]], [236, 363, 4, null], [300, 362, 5, PAL.cloth[5]]]) bushIn(sc, x, y, 3600 + s, 4, f);
  at(sc, 364, () => T.wheelbarrow(sc.P, 160, 364));
  // 右下：塌了一半的两层楼、小平房、荒掉的菜园和烧过的车
  at(sc, B3.y + 6, () => hedge(sc, B3.x + 2, B3.x + B3.w - 3, B3.y + 6, 41));
  for (const [x, y, s, k] of [[600, 278, 1, "live"], [628, 284, 2, "autumn"], [656, 276, 3, "live"], [500, 268, 4, "dead"]]) treeIn(sc, x, y, 3700 + s, k, 0.8);
  H(sc, { x: 494, y: 268, w: 88, h: 80, roof: "shingle", roofRamp: RAMP.slate, wall: "white", wallRamp: RAMP.light, wallH: 34, floors: 2, holes: 3, debris: true, roofDeco: [{ type: "debris", n: 10 }, { type: "chimney", at: 0.7 }], lit: 0.1, broken: 0.5, boarded: 0.3, vines: 7, dirty: true, seed: 41 });
  H(sc, { x: 594, y: 300, w: 66, h: 58, roof: "tile", roofRamp: RAMP.clay, wall: "siding", wallRamp: RAMP.blue, trim: PAL.stone[4], doors: [{ at: 0.45 }], flowerBox: true, lit: 0.35, broken: 0.15, seed: 42 });
  at(sc, 380, () => T.gardenBed(sc.P, 500, 360, 26, 14, rng(9), true));
  at(sc, 386, () => T.gardenBed(sc.P, 534, 368, 20, 12, rng(10), true));
  sc.add(390, () => place(sc.P, car(3711, true), 612, 388, { shadowW: 18, shadowH: 3, flip: true }));
  at(sc, 374, () => T.slide(sc.P, 646, 374));
  at(sc, 393, () => picket(sc, B3.x + 2, B3.x + B3.w - 3, B3.y + B3.h - 2, PAL.stone[5], [[530, 540], [620, 628]]));
  for (const [x, y, s] of [[572, 360, 1], [660, 392, 2], [490, 392, 3]]) bushIn(sc, x, y, 3750 + s, 5);
  // 街上：停着的锈车、垃圾桶、消防栓、路灯
  parked(sc, [["car", 120, 192, false], ["car", 260, 234, true], ["van", 470, 192, false], ["car", 620, 234, true], ["car", 30, 234, false], ["car", 740, 192, true]]);
  sidewalkLife(sc, { seed: 31, kinds: ["lamp", "tree", "bin", "tree", "hydrant", "lamp", "tree", "sign"], front: ["lamp", "bin", "hydrant", "lamp", "sign", "bin"], step: 30, broken: 0.5, dead: 0.3 });
  for (const [i, r] of COVER.entries()) T.grassPatch(sc, r, 3800 + i, 0.25);
  for (const [i, r] of COVER.entries())
    for (let k = 0; k < 3; k++) bushIn(sc, r.x + 8 + k * Math.floor((r.w - 16) / 2), r.y + r.h - 4 - (k % 2) * 10, 3810 + i * 5 + k, 6);
  // 空地上：树、灌木、晾衣绳、破轮胎
  lotLife(sc, ["tree", "tree", "tree", "bush", "bush", "rock", "rubble", "tires", "dead"], 46, 3850);
  at(sc, 470, () => T.laundry(sc.P, 18, 52, 470));
  at(sc, 30, () => T.laundry(sc.P, 690, 736, 30));
  scatter(sc, 700, ["tuft", "tuft", "flower", "weed", "leaf", "flower"], (x, y, c) => c === S.lot);
  scatter(sc, 260, ["weed", "leaf", "crack", "paper"], (x, y, c) => c === S.paving);
  sc.flushProps();
  return sc.done({ variant: "residential" });
}

// ---------- 旧医院 ----------
function hospital() {
  const sc = new Scene(3103, KEEP);
  streetBase(sc, {
    walk: 16,
    paving: (x, y) => ground.slabs(x, y, 12, 0.6),
    verge: (x, y) => ground.lush(x, y, 14),
    vergeTo: 54,
    lot: (x, y) => ground.wild(x, y, 14, 0.35),
  });
  roadWear(sc, 420, ["trash", "paper", "stain"]);
  const [B0, B1, B2, B3] = BLOCKS;
  // 右上：主楼（中间三层、两翼两层），门口雨棚，前面的广场和救护车位
  blockYard(sc, B1, "lush", 50);
  sc.area({ x: 518, y: 120, w: 84, h: 47 }, (x, y) => ground.slabs(x, y, 8, 0.62), null);
  sc.area({ x: 440, y: 140, w: 78, h: 26 }, (x, y) => ground.asphalt(x, y), null);
  at(sc, 141, () => {
    for (let x = 444; x < 516; x += 24) sc.P.vline(x, 142, 165, PAL.straw[3], 0.7);
    sc.P.hline(440, 517, 140, PAL.stone[4]);
  });
  H(sc, { x: 442, y: 42, w: 74, h: 76, roof: "flat", roofRamp: RAMP.grey, wall: "white", wallH: 34, floors: 2, stripe: PAL.water[3], style: "office", windows: true, doors: [{ at: 0.5, kind: "glass", w: 10 }], roofDeco: [{ type: "ac", n: 2 }, { type: "vents", n: 3 }, { type: "puddle", n: 1 }], lit: 0.35, broken: 0.25, seed: 51 });
  H(sc, { x: 584, y: 42, w: 74, h: 76, roof: "flat", roofRamp: RAMP.grey, wall: "white", wallH: 34, floors: 2, stripe: PAL.water[3], style: "office", doors: [{ at: 0.5, kind: "glass", w: 10 }], roofDeco: [{ type: "ac", n: 2 }, { type: "tank", at: 0.7 }], holes: 1, lit: 0.35, broken: 0.25, seed: 52 });
  H(sc, { x: 500, y: 22, w: 100, h: 102, roof: "flat", roofRamp: RAMP.light, wall: "white", wallH: 48, floors: 3, stripe: PAL.cloth[1], style: "office", doors: [{ at: 0.5, kind: "glass", w: 16 }], wallDeco: [{ type: "cross", at: 0.5, dy: 6 }, { type: "sign", w: 34, dy: 18, color: PAL.stone[5], ink: PAL.cloth[1], neon: [255, 90, 80] }], roofDeco: [{ type: "helipad", at: 0.5 }, { type: "ac", n: 2 }, { type: "antenna", at: 0.9, beacon: true }], lit: 0.4, broken: 0.2, seed: 53 });
  at(sc, 134, () => {
    const P = sc.P;
    // 雨棚：白顶，两根柱子
    P.rect(526, 124, 48, 5, PAL.stone[5]);
    P.hline(526, 573, 124, PAL.snow[4]);
    P.hline(526, 573, 129, OUTLINE, 0.6);
    for (const x of [529, 569]) {
      P.rect(x, 129, 3, 6, PAL.stone[4]);
      P.vline(x + 2, 129, 134, PAL.stone[2]);
    }
    for (let x = 527; x < 574; x++) P.shade(x, 130, 0.7, "#18130f");
  });
  sc.add(160, () => T.placeVehicle(sc.P, "ambulance", 476, 160, 5));
  for (const [x, y] of [[452, 138], [624, 138], [452, 152], [646, 152]]) at(sc, y, () => T.planter(sc.P, x, y));
  at(sc, 150, () => T.bench(sc.P, 610, 150));
  at(sc, 150, () => T.bench(sc.P, 640, 150));
  at(sc, 158, () => {
    const P = sc.P;
    P.vline(596, 126, 158, PAL.stone[3]);
    P.rect(597, 126, 10, 6, PAL.cloth[5]);
    P.rect(599, 128, 3, 2, PAL.cloth[1]);
  });
  at(sc, 166, () => T.sandbags(sc.P, 540, 164, 22));
  at(sc, 166, () => chainFence(sc, B1.x + 2, B1.x + B1.w - 3, B1.y + B1.h - 1, [[524, 576], [444, 514]]));
  // 左上：诊所和药房，门前停车场
  blockYard(sc, B0, "concrete", 51);
  H(sc, { x: 68, y: 40, w: 132, h: 72, roof: "flat", roofRamp: RAMP.grey, wall: "concrete", wallH: 34, floors: 2, stripe: PAL.water[2], style: "office", doors: [{ at: 0.3, kind: "glass", w: 12 }], wallDeco: [{ type: "sign", w: 30, x: 70, dy: 18, color: PAL.water[1], ink: PAL.stone[5], neon: [150, 220, 230] }], roofDeco: [{ type: "ac", n: 3 }, { type: "vents", n: 4 }, { type: "puddle", n: 2 }, { type: "hatch", at: 0.8 }], lit: 0.3, broken: 0.3, seed: 54 });
  H(sc, { x: 206, y: 58, w: 88, h: 54, roof: "flat", roofRamp: RAMP.light, wall: "white", style: "shop", doors: [{ at: 0.7, kind: "glass", w: 12 }], wallDeco: [{ type: "awning", colors: [PAL.leaf[3], PAL.stone[5]], x1: 50 }, { type: "cross", at: 0.85, dy: 4 }], roofDeco: [{ type: "ac", n: 1 }], lit: 0.5, broken: 0.2, seed: 55 });
  at(sc, 128, () => {
    const P = sc.P;
    for (let x = 70; x < 296; x += 22) for (let y = 114; y < 129; y++) P.set(x, y, PAL.straw[3], 0.7);
  });
  parked(sc, [["car", 96, 126, false, 61], ["ambulance", 172, 127, true, 62], ["car", 258, 126, true, 63]]);
  at(sc, 130, () => hedge(sc, B0.x + 2, B0.x + B0.w - 3, B0.y + B0.h - 1, 52));
  // 左下：病房楼和小花园
  blockYard(sc, B2, "lush", 52);
  at(sc, B2.y + 8, () => brickWall(sc, B2.x + 1, B2.x + B2.w - 2, B2.y + 8, 6, RAMP.rust));
  H(sc, { x: 68, y: 282, w: 166, h: 74, roof: "flat", roofRamp: RAMP.grey, wall: "white", wallH: 32, floors: 2, stripe: PAL.water[3], style: "office", doors: [{ at: 0.2, kind: "glass", w: 12 }, { at: 0.72, kind: "glass", w: 10 }], roofDeco: [{ type: "greenery", at: 0.15, w: 34, h: 12 }, { type: "solar", at: 0.6, w: 30, h: 10 }, { type: "ac", n: 2 }], wallDeco: [{ type: "cross", at: 0.45, dy: 4 }], lit: 0.35, broken: 0.25, seed: 56 });
  for (const [x, y, s, k] of [[252, 300, 1, "live"], [292, 296, 2, "autumn"], [272, 330, 3, "live"], [300, 352, 4, "live"]]) treeIn(sc, x, y, 3900 + s, k, 0.7);
  at(sc, 350, () => T.bench(sc.P, 262, 350));
  at(sc, 362, () => {
    for (const x of [90, 130, 180, 214]) T.planter(sc.P, x, 364);
  });
  at(sc, 368, () => picket(sc, B2.x + 2, B2.x + B2.w - 3, B2.y + B2.h - 2, PAL.stone[4], [[86, 100], [180, 194]]));
  // 右下：停车楼（顶层车位）、门口的栏杆
  blockYard(sc, B3, "concrete", 53);
  H(sc, { x: 490, y: 262, w: 172, h: 112, roof: "flat", roofRamp: RAMP.grey, wall: "concrete", wallH: 38, floors: 2, windows: false, doors: [{ at: 0.15, kind: "open", w: 22, h: 14 }], roofDeco: [{ type: "puddle", n: 3 }], seams: false, seed: 57 });
  at(sc, 375, () => {
    const P = sc.P;
    // 车位线、楼层的通风开口
    for (let x = 498; x < 656; x += 16) for (let y = 270; y < 330; y++) if ((y - 270) % 34 < 22) P.set(x, y, PAL.straw[3], 0.75);
    for (const fy of [341, 357]) {
      for (let x = 494; x < 660; x++) for (let j = 0; j < 6; j++) P.set(x, fy + j, j === 0 ? PAL.ash[0] : dither("ash", 0.15 + j * 0.05, x, fy + j));
      for (let x = 500; x < 660; x += 20) P.rect(x, fy, 3, 6, PAL.stone[2]);
    }
    P.hline(560, 600, 368, PAL.ember[4]);
    P.hline(560, 600, 369, PAL.cloth[1]);
  });
  sc.add(300, () => place(sc.P, car(3951), 520, 300, { shadowW: 18, shadowH: 3 }));
  sc.add(328, () => place(sc.P, car(3952, true), 600, 328, { shadowW: 18, shadowH: 3, flip: true }));
  sc.add(296, () => T.placeVehicle(sc.P, "police", 632, 296, 3953, true));
  for (const x of [524, 534, 544]) at(sc, 388, () => T.cone(sc.P, x, 388));
  at(sc, 394, () => chainFence(sc, B3.x + 2, B3.x + B3.w - 3, B3.y + B3.h - 1, [[508, 560]]));
  // 街上：救护帐篷、担架、输液架、隔离栏、沙袋
  for (const [x, y] of [[150, 160], [236, 160], [290, 262], [472, 252], [620, 252], [700, 150]]) if (!sc.near(x, y, 16)) sc.add(y, () => tent(sc, x, y, 24, [PAL.stone[5], PAL.stone[4]], "cross"));
  for (const [x, y] of [[180, 152], [196, 158], [304, 270], [652, 262]]) if (!sc.near(x, y, 10)) sc.add(y, () => T.stretcher(sc.P, x, y));
  for (const [x, y] of [[170, 148], [262, 156], [640, 258]]) if (!sc.near(x, y, 8)) sc.add(y, () => T.ivStand(sc.P, x, y));
  for (const [x, y] of [[318, 168], [300, 246], [410, 168], [690, 246], [40, 246]]) if (!sc.near(x, y, 12)) sc.add(y, () => T.barrier(sc.P, x, y, 20, [PAL.cloth[1], PAL.stone[5]]));
  for (const [x, y] of [[96, 166], [420, 250]]) if (!sc.near(x, y, 14)) sc.add(y, () => T.sandbags(sc.P, x, y, 24));
  parked(sc, [["ambulance", 220, 196, false, 71], ["car", 600, 234, true, 72], ["van", 60, 234, true, 73], ["ambulance", 720, 196, true, 74]]);
  sidewalkLife(sc, { seed: 32, kinds: ["lamp", "planter", "bin", "lamp", "sign", "bench", "tree"], step: 36, lampColor: [200, 225, 255], broken: 0.3, dead: 0.2 });
  for (const [i, r] of COVER.entries()) T.grassPatch(sc, r, 3960 + i, 0.4);
  for (const [i, r] of COVER.entries())
    for (let k = 0; k < 3; k++) bushIn(sc, r.x + 8 + k * Math.floor((r.w - 16) / 2), r.y + r.h - 4 - (k % 2) * 10, 3970 + i * 5 + k, 5);
  lotLife(sc, ["tree", "bush", "bush", "rock", "rubble", "dead", "drums"], 34, 3980);
  scatter(sc, 420, ["tuft", "trash", "pebble", "paper"], (x, y, c) => c === S.lot);
  scatter(sc, 220, ["trash", "paper", "stain", "crack"], (x, y, c) => c === S.paving);
  sc.flushProps();
  return sc.done({ variant: "hospital" });
}

// ---------- 幸存者集市 ----------
function market() {
  const sc = new Scene(3101, KEEP);
  streetBase(sc, {
    walk: 13,
    verge: (x, y) => ground.packed(x, y, 21),
    vergeTo: 62,
    vergeCode: S.dirt,
    lot: (x, y) => ground.wild(x, y, 15, 0.4),
  });
  roadWear(sc, 360, ["trash", "leaf", "paper"]);
  const [B0, B1, B2, B3] = BLOCKS;
  const awn = [
    [PAL.cloth[1], PAL.cloth[5]],
    [PAL.water[3], PAL.cloth[5]],
    [PAL.ember[3], PAL.straw[4]],
    [PAL.leaf[3], PAL.straw[4]],
  ];
  // 左上：三间铺面，屋顶上晾着衣服、放着水箱
  blockYard(sc, B0, "packed", 60);
  H(sc, { x: 66, y: 40, w: 76, h: 72, roof: "flat", roofRamp: RAMP.tar, wall: "plaster", wallRamp: RAMP.cream, wallH: 34, floors: 2, style: "shop", doors: [{ at: 0.3, kind: "glass", w: 10 }], wallDeco: [{ type: "awning", colors: awn[0], dy: 19 }, { type: "sign", w: 36, dy: 3, color: PAL.cloth[0], ink: PAL.straw[4], neon: [255, 120, 90] }], roofDeco: [{ type: "tank", at: 0.75 }, { type: "greenery", at: 0.1, w: 24, h: 10 }], lit: 0.75, broken: 0.05, seed: 61 });
  H(sc, { x: 146, y: 50, w: 70, h: 62, roof: "tile", roofRamp: RAMP.clay, wall: "brick", style: "shop", doors: [{ at: 0.7, kind: "glass", w: 10 }], wallDeco: [{ type: "awning", colors: awn[1] }, { type: "lanterns", gap: 7 }], roofDeco: [{ type: "chimney", at: 0.2 }], lit: 0.8, broken: 0.05, seed: 62 });
  H(sc, { x: 220, y: 36, w: 76, h: 76, roof: "metal", roofRamp: RAMP.teal, wall: "concrete", wallH: 34, floors: 2, style: "shop", doors: [{ at: 0.25, kind: "glass", w: 10 }], wallDeco: [{ type: "awning", colors: awn[2], dy: 19 }, { type: "sign", w: 30, dy: 3, color: PAL.night[1], ink: PAL.ember[4], neon: [120, 220, 200] }], roofDeco: [{ type: "solar", at: 0.15, w: 20, h: 9 }, { type: "dish", at: 0.8 }], lit: 0.75, broken: 0.05, seed: 63 });
  for (const [x, y, n] of [[90, 126, 3], [196, 127, 2], [270, 126, 3]]) at(sc, y, () => T.crates(sc.P, x, y, n));
  at(sc, 128, () => T.sacks(sc.P, 126, 128, 4));
  at(sc, 128, () => T.sacks(sc.P, 238, 128, 3, PAL.soil));
  at(sc, 124, () => T.planter(sc.P, 156, 124));
  at(sc, 124, () => T.planter(sc.P, 214, 124));
  // 右上：市场大棚（卷帘门开着），门前三个摊位
  blockYard(sc, B1, "packed", 61);
  H(sc, { x: 442, y: 24, w: 216, h: 108, roof: "metal", roofRamp: RAMP.rust, wall: "metal", wallRamp: RAMP.grey, wallH: 30, floors: 1, taper: 0.04, door: "roller", rollerOpen: true, doors: [{ at: 0.18, w: 28, h: 20 }, { at: 0.5, w: 30, h: 20 }, { at: 0.82, w: 28, h: 20 }], windows: false, wallDeco: [{ type: "sign", w: 60, dy: 1, h: 7, color: PAL.ember[1], ink: PAL.straw[4], neon: [255, 170, 90] }, { type: "lanterns", gap: 8 }], roofDeco: [{ type: "skylight", n: 5 }, { type: "vents", n: 4 }], seed: 64 });
  at(sc, 131, () => {
    // 大棚门里看得见的货架和灯
    const P = sc.P;
    for (const cx of [481, 550, 619]) {
      for (let k = -10; k <= 10; k += 5) {
        P.rect(cx + k - 1, 122, 3, 8, PAL.soil[2]);
        P.set(cx + k, 121, pick2(cx + k, [PAL.cloth[2], PAL.leaf[4], PAL.ember[3], PAL.straw[3]]));
      }
      sc.lights.push({ x: cx, y: 118, kind: "lamp", color: [255, 200, 130] });
    }
  });
  for (const [x, y, k] of [[470, 156, 0], [530, 160, 1], [596, 156, 2], [646, 160, 3]]) if (!sc.near(x, y, 12)) sc.add(y, () => stall(sc, x, y, awn[k], [PAL.cloth[2], PAL.leaf[4], PAL.ember[3], PAL.straw[3]]));
  at(sc, 146, () => fireBarrel(sc, 506, 146));
  // 左下：食堂、裁缝铺、修理铺；门口摆桌子
  blockYard(sc, B2, "packed", 62);
  at(sc, B2.y + 7, () => {
    T.laundry(sc.P, 70, 120, B2.y + 7);
    T.crates(sc.P, 150, B2.y + 7, 2);
    T.bin(sc.P, 176, B2.y + 7);
    T.laundry(sc.P, 240, 300, B2.y + 7);
  });
  H(sc, { x: 66, y: 282, w: 82, h: 70, roof: "tile", roofRamp: RAMP.clay, wall: "plank", style: "shop", doors: [{ at: 0.65, w: 10 }], wallDeco: [{ type: "awning", colors: awn[2] }, { type: "lanterns", gap: 6, color: [255, 160, 90] }, { type: "sign", w: 26, dy: 9, x: 4, color: PAL.soil[1], ink: PAL.ember[4] }], roofDeco: [{ type: "chimney", at: 0.7 }, { type: "pipe", at: 0.3, smoke: true }], lit: 0.85, broken: 0.0, seed: 65 });
  H(sc, { x: 152, y: 288, w: 72, h: 64, roof: "shingle", roofRamp: RAMP.slate, wall: "siding", wallRamp: RAMP.teal, trim: PAL.stone[4], style: "shop", doors: [{ at: 0.3, kind: "glass", w: 10 }], wallDeco: [{ type: "awning", colors: awn[0] }, { type: "sign", w: 22, dy: 9, x: 40, color: PAL.cloth[5], ink: PAL.cloth[1] }], lit: 0.8, broken: 0.05, seed: 66 });
  H(sc, { x: 228, y: 280, w: 78, h: 72, roof: "metal", roofRamp: RAMP.grey, wall: "rustmetal", style: "shop", door: "roller", rollerOpen: true, doors: [{ at: 0.4, w: 26, h: 18 }], windows: false, wallDeco: [{ type: "sign", w: 34, dy: 2, color: PAL.ember[2], ink: PAL.ash[0], neon: [255, 150, 80] }], roofDeco: [{ type: "antenna", at: 0.8 }], seed: 67 });
  for (const [x, y, k] of [[90, 365, 0], [124, 366, 3], [190, 365, 1]]) at(sc, y, () => T.umbrellaTable(sc.P, x, y, awn[k]));
  at(sc, 364, () => T.cart(sc.P, 250, 364));
  at(sc, 366, () => T.crates(sc.P, 290, 366, 3));
  // 右下：交易站（大仓库 + 改成铺子的集装箱）
  blockYard(sc, B3, "concrete", 63);
  H(sc, { x: 492, y: 262, w: 118, h: 86, roof: "metal", roofRamp: RAMP.rust, wall: "rustmetal", wallH: 28, door: "roller", rollerOpen: true, doors: [{ at: 0.28, w: 26, h: 18 }, { at: 0.72, w: 26, h: 18 }], windows: false, wallDeco: [{ type: "sign", w: 50, dy: 1, color: PAL.night[1], ink: PAL.leaf[5], neon: [140, 230, 140] }, { type: "lanterns", gap: 9 }], roofDeco: [{ type: "skylight", n: 3 }], holes: 1, seed: 68 });
  for (const [x, y, k, w] of [[618, 300, 0, 40], [618, 286, 1, 40], [618, 332, 2, 40], [618, 362, 3, 40]]) {
    const cols = [RAMP.rust, RAMP.teal, RAMP.green, RAMP.blue][k];
    at(sc, y, () => container(sc, x, y, w, cols));
  }
  at(sc, 340, () => {
    const P = sc.P;
    // 集装箱铺子：开着门，挂着布帘
    for (const y of [332, 362]) {
      P.rect(622, y - 11, 12, 10, PAL.ash[0]);
      for (let k = 0; k < 12; k += 3) P.vline(622 + k, y - 11, y - 6, PAL.cloth[k % 2 ? 1 : 5]);
      sc.lights.push({ x: 628, y: y - 6, kind: "lamp", color: [255, 190, 110] });
    }
  });
  for (const [x, y, k] of [[506, 382, 1], [566, 386, 2]]) if (!sc.near(x, y, 12)) sc.add(y, () => stall(sc, x, y, awn[k], [PAL.straw[3], PAL.cloth[2], PAL.leaf[4]]));
  at(sc, 370, () => fireBarrel(sc, 536, 370));
  at(sc, 390, () => T.crates(sc.P, 600, 390, 4));
  // 街区边上的木栏杆：铺面后面的院子不让进
  at(sc, B0.y + B0.h - 1, () => railing(sc, B0.x + 1, B0.x + B0.w - 2, B0.y + B0.h - 1));
  at(sc, B1.y + B1.h - 1, () => railing(sc, B1.x + 1, B1.x + B1.w - 2, B1.y + B1.h - 1));
  at(sc, B2.y + B2.h - 1, () => railing(sc, B2.x + 1, B2.x + B2.w - 2, B2.y + B2.h - 1));
  at(sc, B3.y + B3.h - 1, () => railing(sc, B3.x + 1, B3.x + B3.w - 2, B3.y + B3.h - 1));
  at(sc, B3.y + 5, () => railing(sc, B3.x + 1, B3.x + B3.w - 2, B3.y + 5));
  for (const b of BLOCKS) at(sc, b.y + b.h - 2, () => {
    fenceV(sc, b.x, b.y + 6, b.y + b.h - 2, PAL.soil[2]);
    fenceV(sc, b.x + b.w - 2, b.y + 6, b.y + b.h - 2, PAL.soil[2]);
  });
  // 街上：摊位、串灯、火桶、手推车
  const stalls = [[150, 160, 0], [212, 162, 1], [272, 160, 2], [150, 262, 3], [214, 262, 0], [470, 262, 1], [640, 252, 2], [310, 120, 3], [430, 98, 0], [430, 300, 1]];
  for (const [x, y, k] of stalls) if (!sc.near(x, y, 16)) sc.add(y, () => stall(sc, x, y, awn[k], [PAL.cloth[2], PAL.leaf[4], PAL.ember[3], PAL.straw[3]]));
  for (const [x, y] of [[300, 248], [452, 166], [120, 248], [600, 248], [40, 170]]) if (!sc.near(x, y, 12)) sc.add(y, () => fireBarrel(sc, x, y));
  for (const [x, y] of [[120, 150], [250, 150], [470, 150], [620, 168]]) at(sc, y, () => T.pole(sc.P, x, y));
  for (const [x, y] of [[126, 252], [256, 252], [480, 250], [630, 250]]) at(sc, y, () => T.pole(sc.P, x, y));
  at(sc, 400, () => {
    stringLights(sc, 120, 124, 250, 124);
    stringLights(sc, 470, 124, 620, 142);
    stringLights(sc, 126, 226, 256, 226);
    stringLights(sc, 480, 224, 630, 224);
    stringLights(sc, 250, 124, 480, 224, [255, 150, 110]);
  });
  for (const [x, y] of [[316, 150], [420, 270], [60, 150], [690, 270]]) if (!sc.near(x, y, 12)) at(sc, y, () => T.cart(sc.P, x, y));
  for (const [x, y] of [[180, 254], [560, 244], [96, 130]]) if (!sc.near(x, y, 12)) at(sc, y, () => T.crates(sc.P, x, y, 3));
  sidewalkLife(sc, { seed: 33, kinds: ["lamp", "crates", "planter", "sacks", "bench", "barrel"], step: 40, broken: 0.1 });
  lotLife(sc, ["tree", "bush", "rock", "rubble", "crates", "tree"], 28, 4050);
  scatter(sc, 380, ["tuft", "flower", "pebble", "trash"], (x, y, c) => c === S.lot);
  scatter(sc, 160, ["trash", "leaf", "paper"], (x, y, c) => c === S.paving);
  sc.flushProps();
  return sc.done({ variant: "market" });
}
function stringLights(sc, x0, y0, x1, y1, color) {
  T.stringLights(sc, x0, y0, x1, y1, color || [255, 196, 120], 5);
}
const pick2 = (seed, list) => list[Math.floor(hash2(seed, 3, 9) * list.length)];

// ---------- 工业仓库 ----------
function warehouse() {
  const sc = new Scene(3104, KEEP);
  streetBase(sc, {
    walk: 14,
    paving: (x, y) => ground.concrete(x, y, 10),
    verge: (x, y) => (hash2(x, y, 8) > 0.4 ? ground.gravel(x, y) : ground.dirt(x, y, 0.4)),
    lot: (x, y) => (fbm(x * 0.03, y * 0.03, 9, 2) > 0.52 ? ground.dirt(x, y, 0.35) : ground.gravel(x, y)),
  });
  roadWear(sc, 520, ["stain", "stain", "scrap"]);
  const [B0, B1, B2, B3] = BLOCKS;
  // 左上：锯齿顶的库房、旁边的办公室
  blockYard(sc, B0, "concrete", 70);
  H(sc, { x: 68, y: 40, w: 150, h: 76, roof: "metal", roofRamp: RAMP.grey, wall: "metal", wallH: 28, floors: 1, door: "roller", doors: [{ at: 0.22, w: 22, h: 18 }, { at: 0.62, w: 22, h: 18 }], style: "factory", winGap: 10, wallDeco: [{ type: "dock" }, { type: "hazard" }, { type: "number", x: 6 }], roofDeco: [{ type: "skylight", n: 4 }, { type: "vents", n: 3 }], holes: 1, lit: 0.2, broken: 0.35, seed: 71 });
  sawtooth(sc, 70, 216, 42, 86);
  H(sc, { x: 222, y: 60, w: 72, h: 56, roof: "flat", roofRamp: RAMP.tar, wall: "brick", style: "office", doors: [{ at: 0.3, w: 8 }], roofDeco: [{ type: "ac", n: 2 }, { type: "hatch", at: 0.75 }], lit: 0.3, broken: 0.4, seed: 72 });
  sc.add(126, () => T.placeVehicle(sc.P, "forklift", 120, 126, 1));
  at(sc, 128, () => T.pallets(sc.P, 150, 128, 3));
  at(sc, 127, () => T.drumsAt(sc.P, 240, 127, 3));
  at(sc, 130, () => chainFence(sc, B0.x + 1, B0.x + B0.w - 2, B0.y + B0.h - 1, [[96, 130], [168, 196]]));
  // 右上：工厂、大烟囱、储罐，前面是装卸场
  blockYard(sc, B1, "concrete", 71);
  at(sc, 30, () => T.tank(sc.P, 630, 72, 16, 36, RAMP.light));
  H(sc, { x: 444, y: 34, w: 150, h: 100, roof: "metal", roofRamp: RAMP.rust, wall: "brick", wallH: 36, floors: 2, style: "factory", door: "roller", doors: [{ at: 0.3, w: 24, h: 20 }, { at: 0.75, w: 20, h: 18 }], winGap: 9, wallDeco: [{ type: "sign", w: 40, x: 50, dy: 2, color: PAL.ash[1], ink: PAL.stone[4] }], roofDeco: [{ type: "skylight", n: 4 }, { type: "pipe", at: 0.9, smoke: true }, { type: "vents", n: 3 }], holes: 2, lit: 0.15, broken: 0.4, seed: 73 });
  at(sc, 100, () => T.smokestack(sc, 614, 100, 92));
  at(sc, 140, () => T.tank(sc.P, 640, 140, 13, 28, RAMP.rust));
  at(sc, 120, () => T.pipeRun(sc.P, 596, 626, 112));
  sc.add(162, () => T.placeVehicle(sc.P, "truck", 478, 162, 2));
  for (const [x, y, k] of [[536, 150, 0], [536, 164, 1], [580, 160, 2]]) at(sc, y, () => container(sc, x, y, 32, [RAMP.rust, RAMP.teal, RAMP.green][k]));
  at(sc, 166, () => chainFence(sc, B1.x + 2, B1.x + B1.w - 3, B1.y + B1.h - 1, [[446, 470], [610, 640]]));
  // 左下：两间库房和集装箱堆场
  blockYard(sc, B2, "gravel", 72);
  at(sc, B2.y + 6, () => chainFence(sc, B2.x + 1, B2.x + B2.w - 2, B2.y + 6, [[110, 140]]));
  H(sc, { x: 68, y: 282, w: 110, h: 70, roof: "metal", roofRamp: RAMP.rust, wall: "rustmetal", wallH: 26, door: "roller", doors: [{ at: 0.3, w: 22, h: 16 }, { at: 0.75, w: 18, h: 16 }], style: "factory", winGap: 12, wallDeco: [{ type: "dock" }, { type: "graffiti" }], roofDeco: [{ type: "skylight", n: 3 }], holes: 2, broken: 0.5, lit: 0.1, seed: 74 });
  H(sc, { x: 184, y: 292, w: 80, h: 60, roof: "flat", roofRamp: RAMP.grey, wall: "concrete", style: "factory", door: "roller", doors: [{ at: 0.5, w: 20, h: 16 }], wallDeco: [{ type: "hazard" }, { type: "number", x: 4 }], roofDeco: [{ type: "vents", n: 3 }, { type: "puddle", n: 1 }], seed: 75 });
  for (const [x, y, k] of [[268, 316, 0], [268, 302, 1], [268, 342, 2], [268, 366, 3], [268, 352, 1]]) at(sc, y, () => container(sc, x, y, 38, [RAMP.rust, RAMP.teal, RAMP.green, RAMP.blue][k]));
  at(sc, 364, () => T.drumsAt(sc.P, 196, 364, 3));
  at(sc, 366, () => T.pallets(sc.P, 140, 366, 3));
  // 右下：大库房（屋顶破洞）、两个储罐
  blockYard(sc, B3, "concrete", 73);
  H(sc, { x: 492, y: 264, w: 122, h: 96, roof: "metal", roofRamp: RAMP.teal, wall: "metal", wallH: 30, door: "roller", doors: [{ at: 0.3, w: 26, h: 20 }, { at: 0.75, w: 22, h: 18 }], style: "factory", winGap: 11, wallDeco: [{ type: "dock" }, { type: "sign", w: 34, x: 44, dy: 2, color: PAL.water[1], ink: PAL.stone[5] }], roofDeco: [{ type: "skylight", n: 3 }, { type: "vents", n: 2 }], holes: 3, broken: 0.4, lit: 0.15, seed: 76 });
  at(sc, 306, () => T.tank(sc.P, 640, 306, 16, 38, RAMP.light));
  at(sc, 380, () => T.tank(sc.P, 640, 380, 13, 26, RAMP.rust));
  at(sc, 330, () => T.pipeRun(sc.P, 614, 626, 330));
  sc.add(384, () => T.placeVehicle(sc.P, "forklift", 520, 384, 3));
  at(sc, B3.y + 5, () => chainFence(sc, B3.x + 2, B3.x + B3.w - 3, B3.y + 5, [[500, 540]]));
  at(sc, B3.y + B3.h - 1, () => chainFence(sc, B3.x + 2, B3.x + B3.w - 3, B3.y + B3.h - 1, [[586, 610]]));
  at(sc, 388, () => T.pallets(sc.P, 560, 388, 3));
  // 检修间：一圈砖墙（和碰撞一样），里面是水泥地；门的那一截由画面按开没开来画
  const annex = AR({ x: 1300, y: 810, w: 190, h: 130 });
  sc.area({ x: annex.x + 5, y: annex.y + 5, w: annex.w - 10, h: annex.h - 10 }, (x, y) => ground.concrete(x, y, 10), S.floor);
  at(sc, annex.y + annex.h, () => annexWalls(sc, annex));
  // 街上：叉车、托盘、油桶、路障，路边的旧铁轨
  parked(sc, [["truck", 140, 196, false, 81], ["van", 560, 234, true, 82], ["car", 690, 196, false, 83], ["forklift", 30, 234, false, 84]]);
  sidewalkLife(sc, { seed: 34, kinds: ["lamp", "drums", "pallets", "cone", "lamp", "bin"], step: 34, lampColor: [255, 200, 120], broken: 0.4 });
  for (let x = 0; x < 330; x++) for (const y of [478]) if (!sc.near(x, y, 4)) sc.P.set(x, y, PAL.stone[3]);
  railTrack(sc, 0, 330, 474);
  for (const [i, r] of COVER.entries()) T.grassPatch(sc, r, 4100 + i, 0.55);
  for (const [i, r] of COVER.entries())
    for (let k = 0; k < 3; k++) bushIn(sc, r.x + 8 + k * Math.floor((r.w - 16) / 2), r.y + r.h - 4 - (k % 2) * 10, 4110 + i * 5 + k, 5);
  lotLife(sc, ["rubble", "drums", "tires", "rock", "bush", "crates", "dead"], 34, 4150);
  for (const [x, y, k] of [[20, 70, 1], [700, 90, 0], [706, 106, 2], [690, 330, 3], [20, 360, 0]]) if (!sc.near(x + 15, y, 16)) at(sc, y, () => container(sc, x, y, 32, [RAMP.rust, RAMP.teal, RAMP.green, RAMP.blue][k]));
  scatter(sc, 300, ["stain", "stain", "scrap", "pebble", "tuft"], (x, y, c) => c === S.lot);
  scatter(sc, 160, ["stain", "scrap", "crack"], (x, y, c) => c === S.paving);
  sc.flushProps();
  return sc.done({ variant: "warehouse" });
}
// 锯齿形的厂房屋顶：一排朝北的玻璃天窗
function sawtooth(sc, x0, x1, y0, y1) {
  sc.add(y1, () => {
    const P = sc.P;
    for (let x = x0; x <= x1; x += 18) {
      for (let y = y0 + 2; y < y1 - 10; y++) {
        P.set(x, y, PAL.stone[4]);
        P.set(x + 1, y, PAL.water[3]);
        P.set(x + 2, y, PAL.water[2]);
        P.set(x + 3, y, OUTLINE, 0.5);
      }
    }
  });
}
function railTrack(sc, x0, x1, y) {
  const P = sc.P;
  for (let x = x0; x <= x1; x++) {
    if (sc.near(x, y + 3, 6)) continue;
    if ((x - x0) % 5 === 0) for (let k = -1; k <= 8; k++) P.set(x, y + k, PAL.soil[1]);
    P.set(x, y + 1, PAL.stone[4]);
    P.set(x, y + 2, PAL.stone[1]);
    P.set(x, y + 6, PAL.stone[4]);
    P.set(x, y + 7, PAL.stone[1]);
  }
}
function annexWalls(sc, a) {
  const P = sc.P,
    seg = (x, y, w, h) => {
      for (let yy = y - 5; yy < y + h; yy++)
        for (let xx = x; xx < x + w; xx++) {
          const top = yy < y;
          P.set(xx, yy, top ? (yy === y - 5 ? PAL.stone[4] : PAL.stone[3]) : (Math.floor(xx / 3) + Math.floor(yy / 2)) % 2 ? PAL.rust[1] : PAL.rust[2]);
        }
      P.hline(x, x + w - 1, y - 6, OUTLINE);
      P.hline(x, x + w - 1, y + h, OUTLINE, 0.6);
    };
  // 上墙两段（中间是门）、左右墙、下墙
  seg(a.x, a.y, 40, 5);
  seg(a.x + 80, a.y, 15, 5);
  for (let y = a.y; y < a.y + a.h; y++) {
    for (const x of [a.x, a.x + a.w - 5]) for (let k = 0; k < 5; k++) P.set(x + k, y, k === 0 || k === 4 ? PAL.rust[0] : PAL.rust[2]);
  }
  seg(a.x, a.y + a.h - 5, a.w, 5);
}

export const CITY = { market, residential, hospital, warehouse };
export const CITY_ROAD = ROAD;
