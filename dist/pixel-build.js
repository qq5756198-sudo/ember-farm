// 新画面的通用画法：一张地图（768×512 美术像素）的地面、道路、房子、院子、灯光记录。
// 每张地图的配方在 pixel-city.js（四个废墟区）和 pixel-regions.js（地区和边境）里。
import { PAL, OUTLINE, Pix, fbm, vnoise, hash2, dither, rng, mix, bayer, ART_SEASON } from "./pixel-kit.js";

export const MAP_W = 768,
  MAP_H = 512;
// 地面种类：下雨时只在路面积水，水面不能走
export const S = { ground: 0, road: 1, paving: 2, dirt: 3, water: 4, wood: 5, snow: 6, floor: 7, rail: 8, sand: 9, lot: 10, roof: 11 };
export const A = (v) => Math.round(v / 2);
export const AR = (r) => ({ x: A(r.x), y: A(r.y), w: A(r.w), h: A(r.h) });
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 一组从暗到亮的颜色（都取自调色板），房顶、墙面、地面共用
export const RAMP = {
  clay: [PAL.rust[0], PAL.cloth[0], PAL.cloth[1], PAL.cloth[2], PAL.ember[3]],
  slate: [PAL.night[0], PAL.night[1], PAL.night[2], PAL.cloth[3], PAL.night[3], PAL.cloth[4]],
  green: [PAL.leaf[0], PAL.leaf[1], PAL.leaf[2], PAL.leaf[3], PAL.leaf[4]],
  brown: [PAL.soil[0], PAL.soil[1], PAL.soil[2], PAL.soil[3], PAL.soil[4]],
  tar: [PAL.ash[0], PAL.ash[1], PAL.ash[2], PAL.ash[3], PAL.ash[4]],
  rust: [PAL.rust[0], PAL.rust[1], PAL.rust[2], PAL.rust[3], PAL.ember[3]],
  grey: [PAL.stone[0], PAL.stone[1], PAL.stone[2], PAL.stone[3], PAL.stone[4]],
  light: [PAL.stone[2], PAL.stone[3], PAL.stone[4], PAL.stone[5], PAL.snow[4]],
  teal: [PAL.water[0], PAL.water[1], PAL.water[2], PAL.water[3], PAL.water[4]],
  cream: [PAL.straw[0], PAL.straw[1], PAL.straw[2], PAL.straw[3], PAL.straw[4]],
  red: [PAL.rust[0], PAL.cloth[0], PAL.cloth[1], PAL.cloth[2]],
  blue: [PAL.night[1], PAL.cloth[3], PAL.cloth[4], PAL.night[3], PAL.stone[4]],
  snow: [PAL.snow[0], PAL.snow[1], PAL.snow[2], PAL.snow[3], PAL.snow[4]],
  ember: [PAL.ember[0], PAL.ember[1], PAL.ember[2], PAL.ember[3], PAL.ember[4]],
  wood: [PAL.soil[1], PAL.soil[2], PAL.soil[3], PAL.soil[4], PAL.straw[3]],
};
// 按 0–1 在一组颜色里取色，两档之间按棋盘格抖动
export function dr(ramp, t, x, y) {
  const n = ramp.length,
    f = Math.max(0, Math.min(n - 1.001, t * (n - 1))),
    i = Math.floor(f);
  return ramp[f - i > bayer(x, y) ? i + 1 : i];
}
const pick = (R, list) => list[Math.floor(R() * list.length) % list.length];

export class Scene {
  constructor(seed, keep = []) {
    this.P = new Pix(MAP_W, MAP_H);
    this.map = new Uint8Array(MAP_W * MAP_H);
    this.lights = [];
    this.embers = [];
    this.chimneys = [];
    this.props = [];
    this.blocks = [];
    this.r = rng(seed);
    this.seed = seed;
    // 交互点（美术像素），大件装饰要躲开
    this.keep = keep.map(([x, y]) => [A(x), A(y)]);
  }
  rand(a = 0, b = 1) {
    return a + this.r() * (b - a);
  }
  near(x, y, r = 14) {
    return this.keep.some(([kx, ky]) => Math.hypot(kx - x, ky - y) < r);
  }
  inBlock(x, y, pad = 0) {
    return this.blocks.some((b) => x >= b.x - pad && x < b.x + b.w + pad && y >= b.y - pad && y < b.y + b.h + pad);
  }
  code(x, y) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return S.ground;
    return this.map[Math.floor(y) * MAP_W + Math.floor(x)];
  }
  setCode(x, y, c) {
    if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) return;
    this.map[Math.floor(y) * MAP_W + Math.floor(x)] = c;
  }
  // 整张地图铺一层：fn(x,y) 返回颜色
  fill(fn, code = S.ground) {
    for (let y = 0; y < MAP_H; y++)
      for (let x = 0; x < MAP_W; x++) {
        this.P.set(x, y, fn(x, y));
        this.map[y * MAP_W + x] = code;
      }
  }
  // 在一个区域里铺地面；ragged 让边缘不整齐（土路、雪地）
  area(r, fn, code, ragged = 0, seed = 5) {
    for (let y = Math.floor(r.y - ragged); y < r.y + r.h + ragged; y++)
      for (let x = Math.floor(r.x - ragged); x < r.x + r.w + ragged; x++) {
        if (x < 0 || y < 0 || x >= MAP_W || y >= MAP_H) continue;
        if (ragged) {
          const n = (vnoise(x * 0.25, y * 0.25, seed) - 0.5) * ragged * 2;
          if (x < r.x + n || x >= r.x + r.w - n || y < r.y + n || y >= r.y + r.h - n) continue;
        }
        this.P.set(x, y, fn(x, y));
        if (code != null) this.map[y * MAP_W + x] = code;
      }
  }
  // 按条件逐点铺：test(x,y) 为真的点用 fn 上色
  paint(test, fn, code = null, r = { x: 0, y: 0, w: MAP_W, h: MAP_H }) {
    for (let y = Math.max(0, r.y); y < Math.min(MAP_H, r.y + r.h); y++)
      for (let x = Math.max(0, r.x); x < Math.min(MAP_W, r.x + r.w); x++) {
        if (!test(x, y)) continue;
        this.P.set(x, y, fn(x, y));
        if (code != null) this.map[y * MAP_W + x] = code;
      }
  }
  // 按地面种类在某个范围内逐点改色
  each(r, fn) {
    for (let y = Math.max(0, Math.floor(r.y)); y < Math.min(MAP_H, r.y + r.h); y++) for (let x = Math.max(0, Math.floor(r.x)); x < Math.min(MAP_W, r.x + r.w); x++) fn(x, y, this.map[y * MAP_W + x]);
  }
  add(y, draw) {
    this.props.push({ y, draw });
  }
  flushProps() {
    this.props.sort((a, b) => a.y - b.y).forEach((p) => p.draw());
    this.props = [];
  }
  window(x, y, w, h, opts = {}) {
    this.lights.push({ x, y, w, h, kind: "window", dim: !!opts.dim, color: opts.color });
  }
  lamp(x, y, color) {
    this.lights.push({ x, y, kind: "lamp", color });
  }
  done(extra = {}) {
    return { pix: this.P, canvas: this.P.toCanvas(), map: this.map, lights: this.lights, embers: this.embers, chimneys: this.chimneys, ...extra };
  }
}

// ---------- 地面画法 ----------
export const ground = {
  grass(x, y, dryness = 0.5, seed = 11) {
    const h = hash2(x, y, 1),
      dry = fbm(x * 0.013, y * 0.013, seed, 3),
      tone = 0.3 + fbm(x * 0.07, y * 0.07, seed + 1, 3) * 0.5 + (h - 0.5) * 0.12;
    if (dry > 1.05 - dryness * 0.5 || (dry > 1 - dryness * 0.5 && h > 0.5)) return dither("straw", tone * 0.9, x, y);
    return dither("leaf", tone * 0.95 + 0.05, x, y);
  },
  lush(x, y, seed = 13) {
    const tone = 0.35 + fbm(x * 0.06, y * 0.06, seed, 3) * 0.45 + (hash2(x, y, 2) - 0.5) * 0.14;
    return dither("leaf", tone, x, y);
  },
  asphalt(x, y) {
    const h = hash2(x, y, 2);
    return dither("stone", 0.16 + fbm(x * 0.06, y * 0.09, 15, 3) * 0.3 + (h - 0.5) * 0.06, x, y);
  },
  concrete(x, y, size = 16) {
    const seam = x % size === 0 || y % size === 0,
      tone = 0.48 + fbm(x * 0.05, y * 0.05, 21, 2) * 0.22 + (hash2(Math.floor(x / size), Math.floor(y / size), 3) - 0.5) * 0.08;
    return seam ? PAL.stone[2] : dither("stone", tone, x, y);
  },
  paving(x, y, tw = 8, th = 5, rampName = "stone", base = 0.55) {
    const row = Math.floor(y / th),
      off = row % 2 ? tw / 2 : 0,
      col = Math.floor((x + off) / tw);
    if (y % th === 0 || (x + off) % tw === 0) return PAL[rampName][Math.max(0, Math.floor(base * PAL[rampName].length) - 2)];
    const t = base + (hash2(col, row, 7) - 0.5) * 0.18;
    return dither(rampName, t, x, y);
  },
  dirt(x, y, base = 0.5) {
    return dither("soil", base + fbm(x * 0.08, y * 0.08, 16, 3) * 0.3 + (hash2(x, y, 4) - 0.5) * 0.08, x, y);
  },
  mud(x, y) {
    const t = 0.18 + fbm(x * 0.09, y * 0.09, 17, 3) * 0.35;
    return hash2(x, y, 5) > 0.97 ? PAL.water[1] : dither("soil", t, x, y);
  },
  gravel(x, y) {
    const h = hash2(x, y, 9),
      t = 0.34 + fbm(x * 0.08, y * 0.08, 22, 2) * 0.22;
    if (h > 0.93) return dither("stone", t + 0.2, x, y);
    if (h < 0.07) return dither("stone", t - 0.14, x, y);
    return hash2(x, y, 10) > 0.8 ? dither("soil", 0.45 + t * 0.4, x, y) : dither("stone", t, x, y);
  },
  // 人行道的水泥方砖：缝不太显眼，每块颜色略有不同，偶尔一块裂开
  slabs(x, y, s = 10, base = 0.56) {
    const cx = Math.floor(x / s),
      cy = Math.floor(y / s),
      k = hash2(cx, cy, 13);
    if (x % s === 0 || y % s === 0) return hash2(x, y, 14) > 0.9 ? PAL.leaf[2] : dither("stone", base - 0.2, x, y);
    let t = base + (k - 0.5) * 0.1 + (fbm(x * 0.08, y * 0.08, 15, 2) - 0.5) * 0.12;
    if (k > 0.93 && (x - cx * s) === (y - cy * s)) t -= 0.25;
    return dither("stone", t, x, y);
  },
  // 野地：大片草，几块干草和裸土，过渡是抖动的
  wild(x, y, seed = 17, dirt = 0.3) {
    const n = fbm(x * 0.016, y * 0.016, seed, 3),
      d = fbm(x * 0.05, y * 0.05, seed + 5, 3),
      h = hash2(x, y, seed),
      dryT = (n - 0.54) * 5;
    if (d > 0.77 - dirt * 0.1 + (h - 0.5) * 0.05) return dither("soil", 0.42 + fbm(x * 0.1, y * 0.1, seed + 2, 2) * 0.3, x, y);
    if (dryT > 0 && (dryT >= 1 || bayer(x, y) < dryT)) return dither("straw", 0.18 + fbm(x * 0.07, y * 0.07, seed + 3, 2) * 0.45 + (h - 0.5) * 0.08, x, y);
    return dither("leaf", 0.3 + fbm(x * 0.07, y * 0.07, seed + 4, 3) * 0.45 + (h - 0.5) * 0.1, x, y);
  },
  // 夯实的土地（集市）：踩出来的土，夹着草屑
  packed(x, y, seed = 19) {
    const h = hash2(x, y, seed),
      t = 0.55 + fbm(x * 0.05, y * 0.05, seed, 3) * 0.28;
    if (h > 0.965) return PAL.straw[2];
    if (h < 0.025) return PAL.leaf[3];
    return dither("soil", t + (h - 0.5) * 0.06, x, y);
  },
  snow(x, y) {
    const t = 0.55 + fbm(x * 0.03, y * 0.03, 31, 3) * 0.4 + (hash2(x, y, 3) - 0.5) * 0.06;
    return dither("snow", t, x, y);
  },
  sand(x, y) {
    return dither("straw", 0.45 + fbm(x * 0.06, y * 0.06, 41, 2) * 0.35, x, y);
  },
  needles(x, y) {
    // 松林地面：褐色松针、苔藓
    const n = fbm(x * 0.05, y * 0.05, 61, 3);
    if (n > 0.58) return dither("leaf", 0.2 + (n - 0.58) * 1.4 + (hash2(x, y, 6) - 0.5) * 0.15, x, y);
    return dither("soil", 0.3 + n * 0.45 + (hash2(x, y, 7) - 0.5) * 0.18, x, y);
  },
  planks(x, y, vertical = false, ramp = RAMP.wood) {
    const k = vertical ? x : y,
      board = Math.floor(k / 4),
      along = vertical ? y : x,
      seg = Math.floor((along + board * 13) / 22);
    if (k % 4 === 3) return ramp[0];
    if ((along + board * 13) % 22 === 0) return ramp[0];
    const t = 0.45 + (hash2(board, seg, 6) - 0.5) * 0.35 + (k % 4 === 0 ? 0.15 : 0);
    return dr(ramp, t, x, y);
  },
  floor(x, y) {
    // 地下避难城的水泥地砖
    const s = 12,
      seam = x % s === 0 || y % s === 0;
    if (seam) return dither("stone", 0.24, x, y);
    return dither("stone", 0.3 + (hash2(Math.floor(x / s), Math.floor(y / s), 8) - 0.5) * 0.05 + fbm(x * 0.04, y * 0.04, 51, 2) * 0.08, x, y);
  },
  tiles(x, y, s = 8, ramp = RAMP.light, base = 0.5) {
    // 大理石或瓷砖地面
    if (x % s === 0 || y % s === 0) return ramp[Math.max(0, Math.floor(base * (ramp.length - 1)) - 1)];
    const t = base + (hash2(Math.floor(x / s), Math.floor(y / s), 12) - 0.5) * 0.16 + (x % s === 1 || y % s === 1 ? 0.1 : 0);
    return dr(ramp, t, x, y);
  },
  ash(x, y) {
    return dither("ash", 0.42 + fbm(x * 0.12, y * 0.12, 14, 2) * 0.5, x, y);
  },
};

// 水面：越深越暗、近岸一圈浅色，再加几道亮纹
export function paintWater(sc, test = (x, y) => sc.code(x, y) === S.water, ramp = "water") {
  const P = sc.P;
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      if (!test(x, y)) continue;
      let d = 0;
      for (let r = 1; r <= 7 && !d; r++) if (!test(x - r, y) || !test(x + r, y) || !test(x, y - r) || !test(x, y + r)) d = r;
      d ||= 8;
      const t = 0.75 - d * 0.08 + (fbm(x * 0.08, y * 0.08, 22, 2) - 0.5) * 0.18;
      P.set(x, y, dither(ramp, Math.max(0.05, t), x, y));
      if (d === 1 && !test(x, y - 1)) P.set(x, y, PAL[ramp][4] || PAL.water[4]);
    }
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(sc.rand() * MAP_W),
      y = Math.floor(sc.rand() * MAP_H),
      len = 2 + Math.floor(sc.rand() * 6);
    let ok = true;
    for (let k = 0; k < len; k++) if (!test(x + k, y) || !test(x + k, y - 2)) ok = false;
    if (ok) P.hline(x, x + len - 1, y, sc.rand() > 0.6 ? PAL.water[5] : PAL.water[4], 0.8);
  }
}

// 下雨时积水的地方：在给定的几种地面上挑一些点（美术像素）
export function puddlesOn(map, codes, n = 34, seed = 808, tries = 3200) {
  const out = [],
    r = rng(seed);
  // v0.41：水洼多一倍，多试几回才找得到地方（原来试 1600 回）
  for (let i = 0; i < tries && out.length < n; i++) {
    const x = 6 + Math.floor(r() * (MAP_W - 12)),
      y = 30 + Math.floor(r() * (MAP_H - 60)),
      t = map[y * MAP_W + x];
    if (!codes.includes(t)) continue;
    // 水洼整块都要在同一种地面上
    if (!codes.includes(map[y * MAP_W + x - 6]) || !codes.includes(map[y * MAP_W + x + 6]) || !codes.includes(map[(y - 2) * MAP_W + x]) || !codes.includes(map[(y + 2) * MAP_W + x])) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.y - y) < 22)) continue;
    out.push({ x, y, rx: 4 + Math.floor(r() * 6), ry: 2 + Math.floor(r() * 2), seed: i });
  }
  return out;
}

// 地上的小东西：草丛、花、碎石、碎铁、落叶、垃圾
export function scatter(sc, n, kinds, where = (x, y, c) => c === S.ground) {
  const P = sc.P;
  for (let i = 0; i < n; i++) {
    const x = Math.floor(sc.rand() * MAP_W),
      y = Math.floor(sc.rand() * MAP_H),
      c = sc.code(x, y);
    if (!where(x, y, c) || sc.inBlock(x, y, 1)) continue;
    const k = kinds[Math.floor(sc.rand() * kinds.length)];
    if (k === "tuft") {
      const dry = sc.rand() > 0.6,
        a = dry ? PAL.straw : PAL.leaf;
      P.set(x, y, a[0]);
      P.set(x - 1, y - 1, a[2]);
      P.set(x + 1, y - 1, a[2]);
      P.set(x, y - 2, a[3] || a[2]);
    } else if (k === "weed") {
      P.set(x, y, PAL.leaf[2]);
      P.set(x, y - 1, PAL.leaf[4]);
      P.set(x + 1, y - 2, PAL.leaf[3]);
      P.set(x - 1, y - 1, PAL.leaf[3]);
    } else if (k === "flower") {
      const col = [PAL.ember[2], PAL.ember[3], PAL.cloth[5], PAL.ember[4], PAL.cloth[2]][Math.floor(sc.rand() * 5)];
      P.set(x, y + 1, PAL.leaf[2]);
      P.set(x, y, col);
    } else if (k === "pebble") {
      P.set(x, y, PAL.stone[3]);
      P.set(x + 1, y, PAL.stone[2]);
      P.set(x, y - 1, PAL.stone[4]);
    } else if (k === "scrap") {
      P.set(x, y, PAL.rust[2]);
      P.set(x + 1, y, PAL.rust[1]);
      if (sc.rand() > 0.5) P.set(x, y - 1, PAL.water[5]);
    } else if (k === "leaf") {
      P.set(x, y, sc.rand() > 0.5 ? PAL.ember[2] : PAL.straw[2]);
    } else if (k === "trash") {
      P.rect(x, y, 2, 2, [PAL.cloth[5], PAL.cloth[4], PAL.stone[4], PAL.straw[3]][Math.floor(sc.rand() * 4)]);
      P.set(x + 2, y + 1, OUTLINE, 0.5);
    } else if (k === "paper") {
      P.rect(x, y, 3, 2, PAL.straw[4]);
      P.set(x + 1, y, PAL.stone[4]);
    } else if (k === "crack") {
      let cx = x,
        cy = y;
      for (let j = 0; j < 8 + sc.rand() * 14; j++) {
        P.set(cx, cy, PAL.stone[0]);
        if (sc.rand() < 0.22) P.set(cx, cy - 1, PAL.leaf[3]);
        cx += sc.rand() < 0.5 ? 1 : 0;
        cy += sc.rand() < 0.5 ? 1 : -1;
      }
    } else if (k === "pothole") {
      P.ellipse(x, y, 3 + sc.rand() * 3, 1.5 + sc.rand(), PAL.ash[1]);
      P.hline(x - 2, x + 2, y - 1, PAL.ash[0]);
    } else if (k === "stain") {
      P.ellipse(x, y, 3 + sc.rand() * 4, 1.5 + sc.rand() * 2, PAL.ash[1], 0.35);
    } else if (k === "snowtuft") {
      P.set(x, y, PAL.snow[1]);
      P.set(x + 1, y, PAL.snow[0]);
      P.set(x, y - 1, PAL.leaf[1]);
    } else if (k === "shell") {
      P.set(x, y, PAL.cloth[5]);
      P.set(x + 1, y, PAL.straw[3]);
    } else if (k === "needle") {
      P.set(x, y, PAL.soil[3]);
      P.set(x + 1, y + 1, PAL.soil[2]);
    } else if (k === "cone") {
      P.set(x, y, PAL.soil[1]);
      P.set(x + 1, y, PAL.soil[2]);
      P.set(x, y - 1, PAL.soil[3]);
    } else if (k === "mushroom") {
      P.set(x, y, PAL.straw[3]);
      P.set(x - 1, y - 1, PAL.cloth[1]);
      P.set(x, y - 1, PAL.cloth[2]);
      P.set(x + 1, y - 1, PAL.cloth[1]);
    }
  }
}

// ---------- 房子 ----------
// 斜俯视：上面是屋顶（前坡），下面是正面墙。o.x/o.y/o.w/o.h 是整栋房子的范围（美术像素），房子不出这个范围。
// o.roof: tile 瓦 / shingle 沥青瓦 / metal 铁皮 / flat 平顶 / glass 玻璃；o.roofRamp、o.wall、o.wallRamp 决定颜色
const WALL_RAMP = {
  plank: RAMP.wood,
  siding: RAMP.cream,
  brick: RAMP.rust,
  redbrick: RAMP.red,
  plaster: RAMP.cream,
  concrete: RAMP.grey,
  white: RAMP.light,
  metal: RAMP.grey,
  rustmetal: RAMP.rust,
  log: RAMP.brown,
  stone: RAMP.grey,
};
export function house(sc, o) {
  const P = sc.P,
    R = rng(o.seed ?? ((o.x * 7349 + o.y * 131) >>> 0)),
    kind = o.roof || "metal",
    flat = kind === "flat",
    ov = o.overhang ?? (flat ? 0 : 2),
    x0 = o.x,
    x1 = o.x + o.w - 1,
    top = o.y,
    bot = o.y + o.h - 1,
    wallH = Math.min(o.h - 6, o.wallH ?? clamp(Math.round(o.h * 0.42), 12, 44)),
    eave = bot - wallH + 1,
    wx0 = x0 + ov,
    wx1 = x1 - ov,
    roofRamp = o.roofRamp || (kind === "tile" ? RAMP.clay : kind === "shingle" ? RAMP.tar : kind === "flat" ? RAMP.grey : kind === "glass" ? RAMP.teal : RAMP.rust),
    wallKind = o.wall || "plank",
    wallRamp = o.wallRamp || WALL_RAMP[wallKind] || RAMP.wood,
    trim = o.trim || (wallKind === "white" || wallKind === "concrete" ? PAL.stone[2] : PAL.straw[1]);
  // 影子：落在右边和下边的地上
  if (o.shadow !== false) {
    const sw = o.tall ? 8 : wallH > 26 ? 6 : 4;
    for (let y = top + 3; y <= bot + 1; y++) for (let i = 1; i <= sw; i++) P.shade(x1 + i, y + Math.floor(i / 2), 0.66 + i * 0.03, "#18130f");
    for (let x = wx0 + 3; x <= x1 + sw; x++) for (let j = 1; j <= 2; j++) P.shade(x, bot + j, 0.68 + j * 0.08, "#18130f");
  }
  // ---- 正面墙 ----
  for (let y = eave; y <= bot; y++)
    for (let x = wx0; x <= wx1; x++) {
      const i = x - wx0,
        j = y - eave;
      P.set(x, y, wallPix(wallKind, wallRamp, i, j, x, y, wallH, o));
    }
  // 地基、墙角、檐下的阴影
  if (o.foundation !== false) for (let x = wx0; x <= wx1; x++) {
    P.set(x, bot, hash2(x, bot, 3) > 0.5 ? PAL.stone[1] : PAL.stone[2]);
    P.set(x, bot - 1, mix(P.get(x, bot - 1) || PAL.stone[2], PAL.stone[1], 0.5));
  }
  for (let y = eave; y <= bot; y++) {
    P.set(wx0, y, OUTLINE);
    P.set(wx1, y, OUTLINE);
    if (o.corners !== false && wallKind !== "metal" && wallKind !== "rustmetal") {
      P.set(wx0 + 1, y, mix(trim, PAL.ash[4], 0.2));
      P.set(wx1 - 1, y, mix(trim, OUTLINE, 0.35));
    }
  }
  P.hline(wx0, wx1, bot, OUTLINE, 0.55);
  for (let x = wx0 + 1; x < wx1; x++) {
    P.shade(x, eave, 0.5, "#18130f");
    P.shade(x, eave + 1, 0.72, "#18130f");
  }
  // 多层楼：楼层之间一道线
  const floors = o.floors ?? (wallH >= 30 && o.style !== "barn" && o.style !== "shed" ? 2 : 1);
  if (floors > 1) for (let f = 1; f < floors; f++) {
    const fy = eave + Math.round((wallH * f) / floors);
    P.hline(wx0 + 1, wx1 - 1, fy, mix(wallRamp[0], OUTLINE, 0.3));
    P.hline(wx0 + 1, wx1 - 1, fy - 1, wallRamp[Math.min(wallRamp.length - 1, 3)]);
  }
  // ---- 门 ----
  const doorList = o.doors ?? [{ at: o.doorAt ?? (o.style === "shop" ? 0.32 : 0.5) }];
  const doorRects = [];
  for (const d of doorList) {
    const dw = d.w ?? o.doorW ?? (d.kind === "roller" || o.door === "roller" ? 16 : o.door === "double" || d.kind === "double" ? 12 : 8),
      dh = Math.min(wallH - 3, d.h ?? o.doorH ?? Math.min(16, Math.round(wallH / floors) - 2)),
      cx = wx0 + (d.at <= 1 ? Math.round((wx1 - wx0) * d.at) : d.at),
      dx = cx - Math.floor(dw / 2),
      dy = bot - dh;
    doorRects.push({ x: dx, y: dy, w: dw, h: dh });
    door(sc, dx, dy, dw, dh, d.kind || o.door || "wood", o, R);
  }
  // ---- 窗 ----
  const style = o.style || "house",
    floorH = Math.round(wallH / floors);
  if (o.windows !== false) {
    const ww = o.winW ?? (style === "shop" ? 16 : style === "factory" ? 6 : style === "office" ? 7 : 8),
      wh0 = o.winH ?? (style === "shop" ? Math.min(11, floorH - 6) : style === "factory" ? 4 : Math.min(9, floorH - 6)),
      gap = o.winGap ?? (style === "shop" ? 22 : style === "factory" ? 12 : style === "office" ? 11 : 15);
    if (wh0 >= 3)
      for (let f = 0; f < floors; f++) {
        const fy0 = eave + f * floorH,
          wy = style === "factory" ? fy0 + 3 : fy0 + Math.max(3, Math.round((floorH - wh0) * 0.4));
        const span = wx1 - wx0 - 8,
          n = Math.max(1, Math.floor((span + gap - ww) / gap)),
          start = wx0 + 4 + Math.round((span - (n - 1) * gap - ww) / 2);
        for (let k = 0; k < n; k++) {
          const wx = start + k * gap;
          if (f === floors - 1 && doorRects.some((r) => wx + ww + 2 > r.x && wx - 2 < r.x + r.w)) continue;
          windowAt(sc, wx, wy, ww, wh0, o, R, style);
        }
      }
  }
  // ---- 墙上的东西：雨棚、招牌、灯串、涂鸦、藤蔓、水管 ----
  for (const d of o.wallDeco || []) wallDeco(sc, d, { x0: wx0, x1: wx1, eave, bot, wallH, doorRects, R, o });
  if (o.pipe !== false && wallH > 14 && !flat) {
    const px = R() > 0.5 ? wx0 + 2 : wx1 - 2;
    P.vline(px, eave + 1, bot - 1, PAL.stone[2]);
    P.set(px, bot - 1, PAL.stone[1]);
    P.set(px + 1, bot - 1, PAL.stone[1]);
  }
  if (o.grime !== false)
    for (let k = 0; k < Math.floor((wx1 - wx0) / 6); k++) {
      const gx = wx0 + 2 + Math.floor(R() * (wx1 - wx0 - 4)),
        gy = eave + 2 + Math.floor(R() * (wallH - 4)),
        len = 2 + Math.floor(R() * 5);
      for (let q = 0; q < len; q++) P.shade(gx, gy + q, 0.85, "#18130f");
    }
  // ---- 屋顶 ----
  const roofH = eave - top,
    taper = o.taper ?? (kind === "tile" || kind === "shingle" ? 0.12 : kind === "metal" ? 0.05 : 0),
    inset = (j) => Math.round((roofH - 1 - j) * taper);
  for (let j = 0; j < roofH; j++) {
    const y = top + j,
      l = x0 + inset(j),
      r = x1 - inset(j);
    for (let x = l; x <= r; x++) P.set(x, y, roofPix(kind, roofRamp, x - x0, j, x, y, roofH, o.w, o, R));
    P.set(l, y, OUTLINE);
    P.set(r, y, OUTLINE);
  }
  // 屋脊和屋檐
  if (flat) {
    // 女儿墙：外圈亮、内侧一道阴影
    const lip = PAL.stone[4];
    P.hline(x0, x1, top, OUTLINE);
    P.hline(x0 + 1, x1 - 1, top + 1, o.parapet || lip);
    for (let y = top + 1; y < eave; y++) {
      P.set(x0 + 1, y, o.parapet || lip);
      P.set(x1 - 1, y, mix(o.parapet || lip, OUTLINE, 0.3));
    }
    P.hline(x0 + 2, x1 - 2, top + 2, mix(roofRamp[0], OUTLINE, 0.3));
    for (let y = top + 2; y < eave - 1; y++) P.set(x0 + 2, y, mix(roofRamp[0], OUTLINE, 0.2));
    P.hline(x0, x1, eave - 1, mix(o.parapet || lip, OUTLINE, 0.45));
  } else {
    const l0 = x0 + inset(0),
      r0 = x1 - inset(0);
    P.hline(l0, r0, top, kind === "glass" ? PAL.stone[4] : roofRamp[roofRamp.length - 1]);
    P.hline(l0 - 1, r0 + 1, top - 1, OUTLINE);
    P.hline(x0, x1, eave - 1, kind === "metal" ? roofRamp[0] : mix(roofRamp[0], OUTLINE, 0.4));
    if (o.fascia !== false && kind !== "metal") P.hline(x0 + 1, x1 - 1, eave - 2, mix(roofRamp[0], trim, 0.35));
  }
  P.hline(x0, x1, eave, OUTLINE, 0.9);
  // 屋顶上的东西
  const roofCtx = { x0, x1, top, eave, roofH, inset, R, o, flat };
  for (const d of o.roofDeco || []) roofDeco(sc, d, roofCtx);
  // 破损：屋顶的洞、苔藓、补丁
  for (let k = 0; k < (o.holes || 0); k++) {
    const hw = 5 + Math.floor(R() * Math.min(12, o.w / 6)),
      hh = 3 + Math.floor(R() * Math.min(6, roofH / 5)),
      hx = x0 + 4 + Math.floor(R() * Math.max(1, o.w - hw - 8)),
      hy = top + 3 + Math.floor(R() * Math.max(1, roofH - hh - 6));
    roofHole(P, hx, hy, hw, hh, roofRamp, R, flat);
  }
  if (o.moss) {
    for (let j = 1; j < roofH - 1; j++)
      for (let x = x0 + inset(j) + 1; x < x1 - inset(j); x++) {
        const n = fbm(x * 0.09, (top + j) * 0.09, (o.seed ?? 3) + 40, 2);
        if (n > 0.8 - o.moss * 0.14) P.set(x, top + j, dither("leaf", 0.25 + (n - 0.6) * 1.6 + (hash2(x, j, 5) - 0.5) * 0.2, x, top + j));
      }
  }
  if (o.tarp) {
    const tw = Math.min(28, Math.round(o.w * 0.3)),
      tx = x0 + 6 + Math.floor(R() * Math.max(1, o.w - tw - 12)),
      ty = top + 4,
      th = Math.min(roofH - 8, 16);
    const cols = pick(R, [[PAL.cloth[3], PAL.cloth[4]], [PAL.water[2], PAL.water[3]], [PAL.leaf[2], PAL.leaf[3]]]);
    P.poly([[tx, ty + 2], [tx + tw, ty], [tx + tw + 2, ty + th], [tx - 1, ty + th + 2]], cols[0]);
    P.poly([[tx + 2, ty + 3], [tx + tw - 2, ty + 2], [tx + tw, ty + th - 1], [tx + 1, ty + th]], cols[1]);
    P.line(tx, ty + 2, tx - 3, eave - 2, PAL.straw[1]);
    P.line(tx + tw, ty, tx + tw + 3, eave - 2, PAL.straw[1]);
  }
  if (o.snow) snowRoof(P, x0, x1, top, eave, inset, o);
  if (o.vines)
    for (let k = 0; k < o.vines; k++) {
      let vx = wx0 + 2 + Math.floor(R() * (wx1 - wx0 - 4)),
        vy = bot - 1;
      const len = 5 + Math.floor(R() * Math.min(24, wallH + 6));
      for (let q = 0; q < len; q++) {
        P.set(vx, vy, q % 3 ? PAL.leaf[3] : PAL.leaf[4]);
        if (q % 2) P.set(vx + (R() > 0.5 ? 1 : -1), vy, PAL.leaf[2]);
        vy -= 1;
        if (R() < 0.3) vx += R() > 0.5 ? 1 : -1;
      }
    }
  return { x0, x1, wx0, wx1, top, eave, bot, roofH, doors: doorRects };
}

function wallPix(kind, ramp, i, j, x, y, wallH, o) {
  const top = ramp.length - 1;
  let c;
  if (kind === "brick" || kind === "redbrick") {
    const row = Math.floor(j / 3),
      off = row % 2 ? 3 : 0,
      b = hash2(Math.floor((i + off) / 6), row, 4);
    c = j % 3 === 2 || (i + off) % 6 === 0 ? ramp[0] : b > 0.82 ? ramp[Math.min(top, 3)] : b > 0.35 ? ramp[2] : ramp[1];
  } else if (kind === "concrete" || kind === "white" || kind === "plaster") {
    const panel = kind === "plaster" ? 0 : i % 18 === 0;
    const t = 0.58 + (fbm(x * 0.12, y * 0.12, 33, 2) - 0.5) * 0.3 + (j > wallH - 5 ? -0.15 : 0);
    c = panel ? ramp[1] : dr(ramp, t, x, y);
    if (o.stripe && j === Math.floor(wallH * 0.3)) c = o.stripe;
    if (o.stripe && j === Math.floor(wallH * 0.3) + 1) c = mix(o.stripe, OUTLINE, 0.3);
  } else if (kind === "metal" || kind === "rustmetal") {
    const k = i % 4;
    c = k === 0 ? ramp[3] : k === 3 ? ramp[0] : ramp[k === 1 ? 2 : 1];
    if (hash2(Math.floor(i / 4), Math.floor(j / 3), 19) > 0.93) c = PAL.rust[1];
  } else if (kind === "log") {
    const jj = j % 4;
    c = jj === 0 ? ramp[3] : jj === 3 ? ramp[0] : ramp[jj === 1 ? 2 : 1];
  } else if (kind === "stone") {
    const row = Math.floor(j / 4),
      off = row % 2 ? 4 : 0;
    c = j % 4 === 3 || (i + off) % 8 === 0 ? ramp[0] : hash2(Math.floor((i + off) / 8), row, 7) > 0.4 ? ramp[2] : ramp[3];
  } else if (kind === "siding") {
    const jj = j % 3;
    c = jj === 2 ? mix(ramp[1], OUTLINE, 0.2) : jj === 0 ? ramp[Math.min(top, 3)] : ramp[2];
    if (hash2(x, y, 41) > 0.95) c = PAL.soil[2];
  } else {
    // 木板：一条条横板，几块补上的铁皮
    const board = Math.floor(j / 4),
      seg = Math.floor((i + board * 7) / 23),
      k = hash2(seg, board, 3);
    const base = o.patchy !== false && k > 0.86 ? PAL.stone[3] : o.patchy !== false && k > 0.78 ? PAL.rust[2] : board % 2 ? ramp[3] : ramp[2];
    c = j % 4 === 3 ? mix(base, OUTLINE, 0.45) : (i + board * 7) % 23 === 0 ? mix(base, OUTLINE, 0.35) : base;
  }
  if (o.dirty && hash2(x, y, 77) > 0.93) c = mix(c, PAL.ash[1], 0.4);
  return c;
}

function roofPix(kind, ramp, i, j, x, y, roofH, w, o, R) {
  const fall = j / Math.max(1, roofH);
  if (kind === "tile") {
    const row = Math.floor(j / 4),
      jj = j % 4,
      off = row % 2 ? 3 : 0,
      col = Math.floor((i + off) / 6),
      ii = (i + off) % 6,
      t = 0.68 - fall * 0.3 + (hash2(col, row, 31) - 0.5) * 0.16;
    if (jj === 3) return dr(ramp, t - 0.42, x, y);
    if (ii === 0 && jj >= 1) return dr(ramp, t - 0.3, x, y);
    if (jj === 0) return dr(ramp, t + 0.16, x, y);
    return dr(ramp, t, x, y);
  }
  if (kind === "shingle") {
    const row = Math.floor(j / 3),
      jj = j % 3,
      off = row % 2 ? 2 : 0,
      col = Math.floor((i + off) / 4),
      t = 0.62 - fall * 0.28 + (hash2(col, row, 37) - 0.5) * 0.3;
    if (jj === 2) return dr(ramp, t - 0.35, x, y);
    if ((i + off) % 4 === 0 && jj === 1) return dr(ramp, t - 0.25, x, y);
    return dr(ramp, t, x, y);
  }
  if (kind === "flat") {
    const t = 0.5 + (fbm(x * 0.1, y * 0.1, 43, 2) - 0.5) * 0.35 + (hash2(x, y, 44) - 0.5) * 0.12;
    if (o.seams !== false && (i % 24 === 12 || j % 20 === 10)) return dr(ramp, t - 0.18, x, y);
    return dr(ramp, t, x, y);
  }
  if (kind === "glass") {
    const pane = i % 8 === 0 || j % 6 === 0;
    if (pane) return PAL.stone[2];
    const glint = (i + j) % 11 === 0 || (i + j) % 11 === 1;
    return glint ? PAL.water[5] : dr(RAMP.teal, 0.65 - fall * 0.35, x, y);
  }
  // 波纹铁皮：几块不同的旧铁皮，锈迹往下流
  const patch = hash2(Math.floor(i / 22), Math.floor(j / 16), o.seed ?? 12),
    rr = o.patches === false ? ramp : patch > 0.82 ? RAMP.grey : patch > 0.72 ? RAMP.rust : patch > 0.66 ? RAMP.teal : ramp,
    k = i % 4,
    t0 = 0.62 - fall * 0.28;
  let c = k === 0 ? dr(rr, t0 + 0.25, x, y) : k === 3 ? dr(rr, t0 - 0.3, x, y) : dr(rr, t0, x, y);
  if (j % 16 === 15) c = dr(rr, t0 - 0.38, x, y);
  if (hash2(i, 0, 51) > 0.9 && hash2(i, Math.floor(j / 6), 52) > 0.45) c = mix(c, PAL.rust[1], 0.55);
  return c;
}

function roofHole(P, hx, hy, hw, hh, ramp, R, flat) {
  P.ellipse(hx + hw / 2, hy + hh / 2, hw / 2, hh / 2, PAL.ash[0]);
  if (!flat) for (let q = 1; q < hw; q += 3) P.vline(hx + q, hy, hy + hh, PAL.soil[1]);
  P.hline(hx + 1, hx + hw - 2, hy + hh + 1, mix(ramp[ramp.length - 1], PAL.ash[4], 0.4));
  for (let k = 0; k < 4; k++) P.set(hx + Math.floor(R() * hw), hy - 1 + Math.floor(R() * 2), ramp[1]);
}

function snowRoof(P, x0, x1, top, eave, inset, o) {
  const roofH = eave - top;
  for (let j = 0; j < roofH; j++) {
    const y = top + j;
    for (let x = x0 + inset(j) + 1; x < x1 - inset(j); x++) {
      const depth = (o.snow || 1) * (1 - j / roofH) + (fbm(x * 0.1, y * 0.1, 71, 2) - 0.5) * 0.7;
      if (depth > 0.15) P.set(x, y, dither("snow", 0.55 + depth * 0.35 - (j / roofH) * 0.3, x, y));
    }
  }
  // 屋檐的积雪和冰柱
  for (let x = x0; x <= x1; x++) {
    P.set(x, eave - 1, PAL.snow[4]);
    P.set(x, eave - 2, PAL.snow[3]);
    if (hash2(x, eave, 72) > 0.82) {
      const len = 1 + Math.floor(hash2(x, 1, 73) * 3);
      for (let k = 0; k < len; k++) P.set(x, eave + k, k === len - 1 ? PAL.snow[2] : PAL.snow[4]);
    }
  }
}

function door(sc, x, y, w, h, kind, o, R) {
  const P = sc.P;
  if (kind === "roller") {
    P.rect(x, y, w, h, PAL.stone[2]);
    for (let k = y + 1; k < y + h; k += 2) P.hline(x, x + w - 1, k, PAL.stone[1]);
    P.hline(x, x + w - 1, y, OUTLINE);
    P.rect(x - 1, y - 2, w + 2, 2, PAL.stone[3]);
    if (o.rollerOpen) P.rect(x, y + Math.round(h * 0.55), w, h - Math.round(h * 0.55), PAL.ash[0]);
    if (R() > 0.5) for (let k = 0; k < 3; k++) P.set(x + Math.floor(R() * w), y + 2 + Math.floor(R() * (h - 3)), PAL.rust[2]);
  } else if (kind === "glass" || kind === "double") {
    const glass = kind === "glass";
    P.rect(x - 1, y - 1, w + 2, h + 1, glass ? PAL.stone[3] : PAL.soil[1]);
    P.rect(x, y, w, h, glass ? PAL.water[1] : PAL.soil[2]);
    P.vline(x + Math.floor(w / 2), y, y + h - 1, glass ? PAL.stone[3] : PAL.soil[0]);
    if (glass) {
      P.set(x + 1, y + 1, PAL.water[4]);
      P.set(x + 2, y + 2, PAL.water[3]);
      P.set(x + Math.floor(w / 2) + 1, y + 1, PAL.water[4]);
      if (o.lit !== 0) sc.window(x + w / 2, y + h / 2, w, h, { dim: true });
    } else for (let k = y + 2; k < y + h - 1; k += 4) P.hline(x + 1, x + w - 2, k, PAL.soil[1]);
  } else if (kind === "open" || kind === "dark") {
    P.rect(x, y, w, h, PAL.ash[0]);
    P.rect(x - 1, y - 1, w + 2, 1, o.trim || PAL.soil[1]);
  } else if (kind === "barn") {
    P.rect(x, y, w, h, PAL.cloth[0]);
    P.line(x + 1, y + 1, x + w - 2, y + h - 2, PAL.straw[1]);
    P.line(x + w - 2, y + 1, x + 1, y + h - 2, PAL.straw[1]);
    P.rect(x - 1, y - 1, w + 2, 1, PAL.straw[1]);
  } else {
    // 木门：门框、门板、把手、台阶
    P.rect(x - 1, y - 1, w + 2, h + 1, o.trim || PAL.straw[0]);
    P.rect(x, y, w, h, PAL.soil[1]);
    P.rect(x + 1, y + 1, w - 2, h - 1, o.doorCol || PAL.soil[2]);
    for (let k = y + 3; k < y + h - 1; k += 4) P.hline(x + 1, x + w - 2, k, PAL.soil[1]);
    P.set(x + w - 2, y + Math.floor(h / 2), PAL.ember[4]);
    if (o.boardDoor) {
      P.line(x - 1, y + 2, x + w, y + h - 4, PAL.soil[3]);
      P.line(x - 1, y + h - 4, x + w, y + 2, PAL.soil[2]);
    }
  }
  if (o.steps !== false) {
    P.rect(x - 1, y + h, w + 2, 1, PAL.stone[3]);
  }
  if (o.doorLamp) {
    P.rect(x + w + 1, y - 1, 2, 3, PAL.ember[4]);
    sc.lights.push({ x: x + w + 2, y, kind: "lantern" });
  }
}

function windowAt(sc, x, y, w, h, o, R, style) {
  const P = sc.P,
    roll = R(),
    broken = roll < (o.broken ?? 0.15),
    boarded = !broken && roll < (o.broken ?? 0.15) + (o.boarded ?? 0.1),
    frame = o.frame || (style === "factory" ? PAL.stone[1] : style === "office" ? PAL.stone[3] : PAL.straw[0]);
  P.rect(x - 1, y - 1, w + 2, h + 2, frame);
  P.rect(x, y, w, h, PAL.water[0]);
  if (broken) {
    P.rect(x, y, w, h, PAL.ash[0]);
    for (let k = 0; k < 3; k++) P.set(x + Math.floor(R() * w), y + Math.floor(R() * h), PAL.water[3]);
    P.set(x, y, PAL.water[2]);
    P.set(x + w - 1, y + h - 1, PAL.water[2]);
  } else {
    // 玻璃反光、窗棂、窗帘
    P.set(x + 1, y + 1, PAL.water[3]);
    if (w > 4 && h > 3) {
      P.set(x + 2, y + 1, PAL.water[2]);
      P.set(x + 1, y + 2, PAL.water[2]);
    }
    if (style === "shop") {
      for (let k = 0; k < Math.floor(w / 4); k++) P.rect(x + 1 + k * 4, y + h - 3, 2, 2, pick(R, [PAL.cloth[2], PAL.straw[3], PAL.leaf[4], PAL.ember[3], PAL.cloth[5]]));
      P.vline(x + Math.floor(w / 2), y, y + h - 1, frame);
    } else if (style !== "factory" && w >= 6) {
      P.vline(x + Math.floor(w / 2), y, y + h - 1, frame);
      if (h >= 6) P.hline(x, x + w - 1, y + Math.floor(h / 2), frame);
      if (R() < 0.35) {
        const cc = pick(R, [PAL.cloth[1], PAL.cloth[5], PAL.cloth[4], PAL.straw[3]]);
        P.vline(x, y, y + h - 1, cc);
        P.vline(x + w - 1, y, y + h - 1, cc);
      }
    }
    if (!boarded && R() < (o.lit ?? 0.5)) sc.window(x + w / 2, y + h / 2, w, h, { dim: R() < 0.4 });
  }
  if (boarded) {
    P.line(x - 1, y + 1, x + w, y + h - 2, PAL.soil[3]);
    P.line(x - 1, y + h - 2, x + w, y + 1, PAL.soil[2]);
    P.hline(x - 1, x + w, y + Math.floor(h / 2), PAL.soil[3]);
  }
  if (o.sill !== false && style !== "factory") P.hline(x - 1, x + w, y + h + 1, mix(frame, OUTLINE, 0.25));
  if (o.flowerBox && !broken && R() < 0.5 && style === "house") {
    P.rect(x, y + h + 1, w, 2, PAL.soil[2]);
    for (let k = 0; k < w; k += 2) P.set(x + k, y + h, pick(R, [PAL.leaf[4], PAL.cloth[2], PAL.ember[4]]));
  }
  if (o.shutters && style === "house" && !boarded) {
    P.rect(x - 3, y - 1, 2, h + 2, o.shutters);
    P.rect(x + w + 1, y - 1, 2, h + 2, o.shutters);
  }
}

function wallDeco(sc, d, g) {
  const P = sc.P,
    type = typeof d === "string" ? d : d.type,
    { x0, x1, eave, bot, wallH, R, o } = g;
  if (type === "awning") {
    const cols = d.colors || [PAL.cloth[1], PAL.cloth[5]],
      ay = eave + (d.dy ?? 2),
      ax0 = d.x0 != null ? x0 + d.x0 : x0 + 2,
      ax1 = d.x1 != null ? x0 + d.x1 : x1 - 2,
      ah = d.h || 5;
    for (let x = ax0; x <= ax1; x++)
      for (let j = 0; j < ah; j++) {
        const stripe = Math.floor((x - ax0) / 3) % 2 ? cols[0] : cols[1];
        P.set(x, ay + j, j === 0 ? mix(stripe, PAL.snow[4], 0.25) : j === ah - 1 ? mix(stripe, OUTLINE, 0.2) : stripe);
      }
    for (let x = ax0; x <= ax1; x += 3) P.set(x + 1, ay + ah, Math.floor((x - ax0) / 3) % 2 ? cols[0] : cols[1]);
    for (let x = ax0; x <= ax1; x++) P.shade(x, ay + ah + 1, 0.6, "#18130f");
    if (d.torn) for (let k = 0; k < 4; k++) P.set(ax0 + Math.floor(R() * (ax1 - ax0)), ay + ah - 1, PAL.ash[0]);
  } else if (type === "sign") {
    const sw = d.w || Math.min(30, x1 - x0 - 10),
      sx = d.x != null ? x0 + d.x : x0 + Math.round((x1 - x0 - sw) / 2),
      sy = eave + (d.dy ?? 2),
      sh = d.h || 6;
    P.rect(sx - 1, sy - 1, sw + 2, sh + 2, OUTLINE);
    P.rect(sx, sy, sw, sh, d.color || PAL.soil[2]);
    P.hline(sx, sx + sw - 1, sy, mix(d.color || PAL.soil[2], PAL.snow[4], 0.25));
    // 招牌上的“字”：几块亮色方块，不写真字
    for (let i = sx + 3; i < sx + sw - 3; i += 4) if (hash2(i, sy, 5) > 0.15) P.rect(i, sy + Math.floor(sh / 2) - 1, 2 + (i % 3 ? 1 : 0), 2, d.ink || PAL.straw[4]);
    if (d.neon) sc.lights.push({ x: sx + sw / 2, y: sy + sh / 2, w: sw, h: sh, kind: "neon", color: d.neon });
  } else if (type === "cross") {
    const cx = x0 + Math.round((x1 - x0) * (d.at ?? 0.5)),
      cy = eave + (d.dy ?? 6);
    P.rect(cx - 5, cy - 5, 11, 11, PAL.stone[5]);
    P.rect(cx - 1, cy - 4, 3, 9, PAL.cloth[1]);
    P.rect(cx - 4, cy - 1, 9, 3, PAL.cloth[1]);
    if (d.neon !== false) sc.lights.push({ x: cx, y: cy, w: 10, h: 10, kind: "neon", color: [255, 90, 80] });
  } else if (type === "lanterns") {
    const ly = eave + 2;
    for (let x = x0 + 3; x < x1 - 2; x += d.gap || 6) {
      P.set(x, ly, OUTLINE);
      P.set(x, ly + 1, PAL.ember[4]);
      sc.lights.push({ x, y: ly + 1, kind: "bulb", color: d.color || [255, 190, 110] });
    }
  } else if (type === "graffiti") {
    const gx = x0 + 4 + Math.floor(R() * Math.max(1, x1 - x0 - 24)),
      gy = bot - 9;
    const col = pick(R, [PAL.cloth[2], PAL.water[4], PAL.ember[4], PAL.cloth[4], PAL.leaf[5]]);
    for (let k = 0; k < 16; k++) P.set(gx + k, gy + Math.round(Math.sin(k * 0.9) * 2), col);
    for (let k = 0; k < 9; k++) P.set(gx + 3 + k, gy + 4 + (k % 2), col);
  } else if (type === "poster") {
    for (let k = 0; k < (d.n || 2); k++) {
      const px = x0 + 4 + Math.floor(R() * Math.max(1, x1 - x0 - 12)),
        py = eave + 4 + Math.floor(R() * Math.max(1, wallH - 12));
      P.rect(px, py, 5, 6, pick(R, [PAL.straw[4], PAL.cloth[5], PAL.stone[5]]));
      P.rect(px + 1, py + 1, 3, 2, pick(R, [PAL.cloth[1], PAL.night[2], PAL.leaf[3]]));
    }
  } else if (type === "ac") {
    for (let k = 0; k < (d.n || 2); k++) {
      const ax = x0 + 4 + Math.floor(R() * Math.max(1, x1 - x0 - 12)),
        ay = eave + 3 + Math.floor(R() * Math.max(1, wallH - 14));
      P.rect(ax, ay, 7, 5, PAL.stone[4]);
      P.rect(ax + 1, ay + 1, 3, 3, PAL.stone[2]);
      P.hline(ax, ax + 6, ay + 5, OUTLINE, 0.6);
    }
  } else if (type === "vines") {
    // 爬满一面墙的藤
    for (let x = x0 + 1; x < x1; x++)
      for (let y = eave + 1; y < bot; y++) {
        const n = fbm(x * 0.15, y * 0.15, 81, 2) + (y - eave) / wallH * 0.3;
        if (n > 0.78 - (d.amount ?? 0.5) * 0.3) P.set(x, y, dither("leaf", 0.25 + (n - 0.6) * 1.5, x, y));
      }
  } else if (type === "number") {
    P.rect(x0 + (d.x ?? 4), eave + (d.dy ?? 3), 6, 7, PAL.stone[5]);
    P.rect(x0 + (d.x ?? 4) + 2, eave + (d.dy ?? 3) + 1, 2, 5, PAL.ash[1]);
  } else if (type === "hazard") {
    for (let x = x0 + 1; x < x1; x++) {
      P.set(x, bot - 2, Math.floor(x / 3) % 2 ? PAL.ember[4] : PAL.ash[1]);
      P.set(x, bot - 3, Math.floor((x + 1) / 3) % 2 ? PAL.ember[4] : PAL.ash[1]);
    }
  } else if (type === "dock") {
    // 装卸平台：画在墙脚
    P.rect(x0 + 2, bot - 3, x1 - x0 - 4, 3, PAL.stone[3]);
    P.hline(x0 + 2, x1 - 2, bot - 3, PAL.stone[4]);
    for (let x = x0 + 4; x < x1 - 4; x += 10) P.rect(x, bot - 2, 3, 2, PAL.ember[3]);
  } else if (type === "lamp") {
    const lx = x0 + Math.round((x1 - x0) * (d.at ?? 0.5)),
      ly = eave + (d.dy ?? 4);
    P.rect(lx - 1, ly, 3, 2, PAL.ash[2]);
    P.set(lx, ly + 2, PAL.straw[4]);
    sc.lights.push({ x: lx, y: ly + 2, kind: "lamp", color: d.color || [255, 210, 140] });
  }
}

function roofDeco(sc, d, g) {
  const P = sc.P,
    type = typeof d === "string" ? d : d.type,
    { x0, x1, top, eave, roofH, R, flat } = g,
    W = x1 - x0;
  const ax = (def) => x0 + Math.round(W * (d.at ?? def));
  if (type === "chimney") {
    const cx = ax(0.75),
      cy = top + Math.round(roofH * (d.dy ?? 0.25)),
      ch = d.h ?? 12;
    P.rect(cx, cy - ch, 7, ch + 4, PAL.ember[0]);
    for (let y = cy - ch; y < cy + 4; y += 3) {
      P.hline(cx, cx + 6, y, (y / 3) % 2 ? PAL.rust[1] : PAL.ember[1]);
      P.set(cx + ((y / 3) % 2 ? 2 : 5), y + 1, PAL.rust[0]);
    }
    P.rect(cx - 1, cy - ch - 2, 9, 2, PAL.stone[1]);
    P.hline(cx - 1, cx + 7, cy - ch - 2, PAL.stone[3]);
    P.vline(cx + 7, cy - ch, cy + 3, OUTLINE);
    P.vline(cx - 1, cy - ch, cy + 3, OUTLINE, 0.6);
    for (let i = 0; i < 9; i++) P.shade(cx + 8 + Math.floor(i / 3), cy - ch + 3 + i, 0.75, "#18130f");
    if (d.smoke !== false) sc.chimneys.push({ x: cx + 3, y: cy - ch - 3 });
  } else if (type === "pipe") {
    const cx = ax(0.6),
      cy = top + Math.round(roofH * 0.3);
    P.rect(cx, cy - 6, 3, 8, PAL.stone[2]);
    P.rect(cx - 1, cy - 7, 5, 2, PAL.stone[1]);
    P.vline(cx + 2, cy - 6, cy + 1, PAL.stone[1]);
    if (d.smoke) sc.chimneys.push({ x: cx + 1, y: cy - 8 });
  } else if (type === "antenna") {
    const cx = ax(0.3),
      by = top + Math.round(roofH * 0.35);
    P.vline(cx, by - 18, by, PAL.stone[2]);
    P.vline(cx + 1, by - 18, by, PAL.stone[1]);
    P.hline(cx - 4, cx + 5, by - 13, PAL.stone[2]);
    P.hline(cx - 3, cx + 4, by - 9, PAL.stone[2]);
    P.set(cx, by - 19, PAL.cloth[2]);
    if (d.beacon) sc.lights.push({ x: cx, y: by - 19, kind: "beacon", color: [255, 90, 70] });
  } else if (type === "dish") {
    const cx = ax(0.7),
      cy = top + Math.round(roofH * 0.4);
    P.ellipse(cx, cy, 5, 4, PAL.stone[4]);
    P.ellipse(cx + 1, cy + 1, 3, 2, PAL.stone[2]);
    P.line(cx, cy, cx + 4, cy - 4, PAL.stone[1]);
    P.set(cx + 4, cy - 4, PAL.stone[5]);
  } else if (type === "solar") {
    const sx = ax(0.2),
      sy = top + Math.round(roofH * (d.dy ?? 0.25)),
      sw = d.w ?? 18,
      shh = d.h ?? 10;
    P.rect(sx - 1, sy - 1, sw + 2, shh + 2, PAL.stone[4]);
    for (let j = 0; j < shh; j++) for (let i = 0; i < sw; i++) P.set(sx + i, sy + j, i % 5 === 4 || j % 4 === 3 ? PAL.night[1] : (i + j) % 7 === 0 ? PAL.night[3] : PAL.night[2]);
    P.hline(sx - 1, sx + sw, sy + shh + 1, OUTLINE, 0.6);
  } else if (type === "ac") {
    for (let k = 0; k < (d.n || 3); k++) {
      const axx = x0 + 6 + Math.floor(R() * Math.max(1, W - 18)),
        ay = top + 5 + Math.floor(R() * Math.max(1, roofH - 16));
      P.rect(axx + 1, ay + 1, 10, 8, OUTLINE, 0.35);
      P.rect(axx, ay, 10, 7, PAL.stone[3]);
      P.hline(axx, axx + 9, ay, PAL.stone[5]);
      P.disc(axx + 5, ay + 3, 2.4, PAL.stone[1]);
      P.line(axx + 3, ay + 3, axx + 7, ay + 3, PAL.stone[2]);
      P.hline(axx, axx + 9, ay + 7, OUTLINE, 0.6);
    }
  } else if (type === "vents") {
    for (let k = 0; k < (d.n || 4); k++) {
      const vx = x0 + 6 + Math.floor(R() * Math.max(1, W - 14)),
        vy = top + 4 + Math.floor(R() * Math.max(1, roofH - 12));
      P.disc(vx, vy, 2, PAL.stone[1]);
      P.disc(vx, vy - 1, 2, PAL.stone[3]);
      P.set(vx, vy - 1, PAL.ash[1]);
    }
  } else if (type === "skylight") {
    // 一列列采光板：分成几块，框是铁的，玻璃发灰
    const n = d.n || 3,
      ph = 9,
      gap = 5;
    for (let k = 0; k < n; k++) {
      const vx = x0 + 6 + Math.round(((W - 18) * (k + 0.5)) / n);
      for (let vy = top + 4; vy + ph < eave - 4; vy += ph + gap) {
        if (R() < 0.12) continue;
        P.rect(vx - 1, vy - 1, 9, ph + 2, PAL.stone[1]);
        for (let j = 0; j < ph; j++) for (let i = 0; i < 7; i++) P.set(vx + i, vy + j, (i + j) % 8 < 1 ? PAL.stone[5] : dr(RAMP.light, 0.3 + (j / ph) * 0.15, vx + i, vy + j));
        P.set(vx, vy, PAL.stone[5]);
        if (R() < 0.15) P.rect(vx + 2, vy + 3, 3, 3, PAL.ash[0]);
      }
    }
  } else if (type === "dormer") {
    const n = d.n || 2;
    for (let k = 0; k < n; k++) {
      const cx = x0 + Math.round(W * ((k + 0.5) / n)),
        cy = top + Math.round(roofH * 0.35);
      P.poly([[cx - 7, cy + 2], [cx, cy - 5], [cx + 7, cy + 2]], g.o.roofRamp ? g.o.roofRamp[2] : PAL.cloth[1]);
      P.line(cx - 7, cy + 2, cx, cy - 5, OUTLINE);
      P.line(cx, cy - 5, cx + 7, cy + 2, OUTLINE);
      P.rect(cx - 5, cy + 2, 11, 8, PAL.straw[1]);
      P.rect(cx - 3, cy + 3, 7, 6, PAL.water[0]);
      P.set(cx - 2, cy + 4, PAL.water[3]);
      P.vline(cx, cy + 3, cy + 8, PAL.straw[1]);
      P.hline(cx - 6, cx + 6, cy + 10, OUTLINE, 0.7);
      if (R() < 0.5) sc.window(cx, cy + 6, 7, 6, { dim: true });
    }
  } else if (type === "tank") {
    const tx = ax(0.8),
      ty = top + Math.round(roofH * 0.15);
    P.rect(tx - 6, ty + 6, 2, 8, PAL.soil[1]);
    P.rect(tx + 5, ty + 6, 2, 8, PAL.soil[1]);
    P.rect(tx - 7, ty - 4, 15, 11, PAL.stone[3]);
    for (let x = tx - 7; x <= tx + 7; x += 3) P.vline(x, ty - 4, ty + 6, PAL.stone[2]);
    P.ellipse(tx, ty - 4, 7.5, 2.5, PAL.stone[4]);
    P.ellipse(tx, ty - 4, 5, 1.2, PAL.stone[2]);
    P.vline(tx + 8, ty - 4, ty + 6, OUTLINE);
  } else if (type === "hatch") {
    const hx = ax(0.5),
      hy = top + Math.round(roofH * 0.5);
    P.rect(hx, hy, 8, 6, PAL.stone[1]);
    P.rect(hx + 1, hy + 1, 6, 4, PAL.stone[3]);
    P.hline(hx, hx + 7, hy + 6, OUTLINE, 0.6);
  } else if (type === "cross") {
    const cx = ax(0.5),
      cy = top + Math.round(roofH * 0.5);
    P.disc(cx, cy, 9, PAL.stone[5]);
    P.rect(cx - 2, cy - 7, 5, 15, PAL.cloth[1]);
    P.rect(cx - 7, cy - 2, 15, 5, PAL.cloth[1]);
  } else if (type === "helipad") {
    const cx = ax(0.3),
      cy = top + Math.round(roofH * 0.5);
    P.disc(cx, cy, 13, PAL.stone[1]);
    P.disc(cx, cy, 11, PAL.stone[2]);
    P.rect(cx - 5, cy - 6, 2, 13, PAL.straw[4]);
    P.rect(cx + 4, cy - 6, 2, 13, PAL.straw[4]);
    P.rect(cx - 4, cy - 1, 9, 2, PAL.straw[4]);
    for (let a = 0; a < 8; a++) {
      const lx = Math.round(cx + Math.cos((a / 8) * Math.PI * 2) * 12),
        ly = Math.round(cy + Math.sin((a / 8) * Math.PI * 2) * 12);
      P.set(lx, ly, PAL.ember[4]);
    }
  } else if (type === "rooftopSign") {
    const sw = d.w || 40,
      sx = ax(0.5) - Math.floor(sw / 2),
      sy = top - (d.h || 10) + 2;
    for (const px of [sx + 3, sx + sw - 4]) P.vline(px, sy + (d.h || 10), top + 4, PAL.stone[1]);
    P.rect(sx - 1, sy - 1, sw + 2, (d.h || 10) + 2, OUTLINE);
    P.rect(sx, sy, sw, d.h || 10, d.color || PAL.night[1]);
    for (let i = sx + 3; i < sx + sw - 3; i += 5) P.rect(i, sy + 3, 3, (d.h || 10) - 6, d.ink || PAL.ember[4]);
    if (d.neon) sc.lights.push({ x: sx + sw / 2, y: sy + 5, w: sw, h: d.h || 10, kind: "neon", color: d.neon });
  } else if (type === "debris") {
    for (let k = 0; k < (d.n || 6); k++) {
      const bx = x0 + 4 + Math.floor(R() * (W - 8)),
        by = top + 3 + Math.floor(R() * (roofH - 6));
      P.rect(bx, by, 2 + Math.floor(R() * 3), 1 + Math.floor(R() * 2), pick(R, [PAL.stone[2], PAL.rust[1], PAL.soil[2], PAL.ash[2]]));
    }
  } else if (type === "puddle" && flat) {
    for (let k = 0; k < (d.n || 2); k++) {
      const px = x0 + 8 + Math.floor(R() * (W - 20)),
        py = top + 6 + Math.floor(R() * (roofH - 12));
      P.ellipse(px, py, 4 + R() * 4, 1.5 + R(), PAL.water[1]);
      P.hline(px - 2, px + 1, py - 1, PAL.water[3]);
    }
  } else if (type === "greenery" && flat) {
    // 屋顶上的小菜园
    const gx = ax(0.25),
      gy = top + 5,
      gw = d.w ?? 30,
      gh = Math.min(roofH - 10, d.h ?? 14);
    P.rect(gx - 1, gy - 1, gw + 2, gh + 2, PAL.soil[2]);
    for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) P.set(gx + i, gy + j, j % 4 === 3 ? PAL.soil[1] : hash2(gx + i, gy + j, 9) > 0.45 ? dither("leaf", 0.4 + hash2(i, j, 2) * 0.5, gx + i, gy + j) : PAL.soil[0]);
  }
}

// ---------- 院子与围墙 ----------
// 一个街区里的空地：草、土、水泥
export function yard(sc, r, kind = "grass", seed = 5) {
  const fn =
    kind === "dirt"
      ? (x, y) => ground.dirt(x, y, 0.45)
      : kind === "concrete"
        ? (x, y) => ground.concrete(x, y, 12)
        : kind === "gravel"
          ? (x, y) => ground.gravel(x, y)
          : kind === "lush"
            ? (x, y) => ground.lush(x, y, seed)
            : kind === "snow"
              ? (x, y) => ground.snow(x, y)
              : kind === "paving"
                ? (x, y) => ground.paving(x, y, 8, 5, "stone", 0.5)
                : kind === "packed"
                  ? (x, y) => ground.packed(x, y, seed)
                  : kind === "slabs"
                    ? (x, y) => ground.slabs(x, y, 10, 0.55)
                    : kind === "wild"
                      ? (x, y) => ground.wild(x, y, seed, 0.3)
                      : (x, y) => ground.grass(x, y, 0.45, seed);
  sc.area(r, fn, null);
}
// 尖头木栅栏（白色或木色）；gates 处画一扇关着的小门
export function picket(sc, x0, x1, y, col = PAL.stone[5], gates = []) {
  const P = sc.P,
    dark = mix(col, OUTLINE, 0.45);
  for (let x = x0; x <= x1; x++) {
    const g = gates.find(([a, b]) => x >= a && x <= b);
    P.shade(x + 1, y + 1, 0.7, "#18130f");
    if (g) {
      // 小门：上下两道横档、一道斜撑，两头是粗门柱
      P.set(x, y - 5, col);
      P.set(x, y - 1, col);
      if ((x - g[0]) % 2 === 0) P.vline(x, y - 5, y, mix(col, OUTLINE, 0.15));
      const t = (x - g[0]) / Math.max(1, g[1] - g[0]);
      P.set(x, Math.round(y - 1 - t * 4), dark);
      if (x === g[0] || x === g[1]) {
        P.vline(x, y - 8, y, col);
        P.set(x, y - 9, dark);
      }
      continue;
    }
    P.set(x, y - 4, dark);
    P.set(x, y - 2, dark);
    if ((x - x0) % 3 === 0) {
      P.vline(x, y - 6, y, col);
      P.set(x, y - 7, dark);
      P.set(x + 1, y - 6, dark);
    }
  }
}
// 砖墙：一道带压顶的矮墙，隔一段一根柱子
export function brickWall(sc, x0, x1, y, h = 7, ramp = RAMP.rust) {
  const P = sc.P;
  for (let x = x0; x <= x1; x++) {
    for (let j = 0; j < h; j++) {
      const row = Math.floor(j / 2),
        off = row % 2 ? 2 : 0;
      P.set(x, y - j, j % 2 === 1 || (x + off) % 4 === 0 ? ramp[0] : hash2(Math.floor((x + off) / 4), row, 9) > 0.5 ? ramp[2] : ramp[1]);
    }
    P.set(x, y - h, PAL.stone[4]);
    P.set(x, y - h - 1, PAL.stone[3]);
    P.shade(x + 1, y + 1, 0.65, "#18130f");
  }
  for (let x = x0; x <= x1; x += 24) {
    P.rect(x, y - h - 3, 4, h + 4, ramp[2]);
    P.hline(x, x + 3, y - h - 3, PAL.stone[4]);
    P.vline(x + 3, y - h - 2, y, ramp[0]);
  }
}
// 一排灌木做的绿篱
export function hedge(sc, x0, x1, y, seed = 3) {
  const P = sc.P;
  for (let x = x0; x <= x1; x++)
    for (let j = 0; j < 7; j++) {
      const edge = 6 - Math.round(vnoise(x * 0.4, 0, seed) * 2);
      if (j > edge) continue;
      P.set(x, y - j, dither("leaf", 0.25 + (j / 7) * 0.5 + (hash2(x, j, seed) - 0.5) * 0.25, x, y - j));
    }
  for (let x = x0; x <= x1; x++) P.set(x, y + 1, OUTLINE, 0.5);
}
// 铁丝网（带柱子）；gates 处是一扇关着、挂着锁链的铁门
export function chainFence(sc, x0, x1, y, gates = []) {
  const P = sc.P;
  for (let x = x0; x <= x1; x++) {
    const g = gates.find(([a, b]) => x >= a && x <= b);
    if (g) {
      const edge = x === g[0] || x === g[1] || x === Math.round((g[0] + g[1]) / 2);
      P.set(x, y - 10, PAL.stone[4]);
      P.set(x, y - 1, PAL.stone[3]);
      for (let k = 0; k < 9; k++) if ((x + k) % 3 === 0 || (x - k + 30) % 3 === 0) P.set(x, y - 9 + k, PAL.stone[2], 0.75);
      if (edge) P.vline(x, y - 10, y, PAL.stone[3]);
      if (x === Math.round((g[0] + g[1]) / 2)) {
        P.rect(x - 1, y - 6, 3, 3, PAL.ember[3]);
        P.set(x, y - 5, PAL.ash[0]);
      }
      continue;
    }
    P.set(x, y - 10, PAL.stone[3]);
    for (let k = 0; k < 9; k++) if ((x + k) % 3 === 0 || (x - k + 30) % 3 === 0) P.set(x, y - 9 + k, PAL.stone[2], 0.7);
    P.set(x, y, PAL.stone[1], 0.6);
  }
  for (let x = x0; x <= x1; x += 12) {
    if (gates.some(([a, b]) => x > a && x < b)) continue;
    P.vline(x, y - 11, y, PAL.stone[1]);
    P.vline(x + 1, y - 11, y, PAL.stone[3]);
    P.shade(x + 2, y + 1, 0.6, "#18130f");
  }
}
// 木头栏杆（集市铺面前）
export function railing(sc, x0, x1, y, col = RAMP.wood) {
  const P = sc.P;
  for (let x = x0; x <= x1; x++) {
    P.set(x, y - 6, col[3]);
    P.set(x, y - 5, col[1]);
    P.set(x, y - 2, col[2]);
    P.shade(x + 1, y + 1, 0.72, "#18130f");
  }
  for (let x = x0; x <= x1; x += 8) {
    P.vline(x, y - 7, y, col[2]);
    P.vline(x + 1, y - 7, y, col[0]);
  }
}
// 竖着的围栏（街区左右两边）：只画柱子和一条线
export function fenceV(sc, x, y0, y1, col = PAL.soil[2]) {
  const P = sc.P;
  for (let y = y0; y <= y1; y++) {
    P.set(x, y, col);
    P.set(x + 1, y, mix(col, OUTLINE, 0.5));
  }
  for (let y = y0; y <= y1; y += 7) {
    P.rect(x, y - 3, 2, 4, mix(col, PAL.snow[4], 0.2));
    P.set(x, y - 4, OUTLINE);
  }
}

// 一圈人行道和马路牙子（圆角）
export function sidewalk(sc, r, width = 6, radius = 6) {
  const outer = { x: r.x - width, y: r.y - width, w: r.w + width * 2, h: r.h + width * 2 };
  const inside = (x, y) => {
    const cx = clamp(x, outer.x + radius, outer.x + outer.w - 1 - radius),
      cy = clamp(y, outer.y + radius, outer.y + outer.h - 1 - radius);
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius + 0.5;
  };
  sc.paint(inside, (x, y) => ground.paving(x, y, 6, 4, "stone", 0.62), S.paving, outer);
  // 马路牙子：外沿亮一道、再一道阴影
  sc.each({ x: outer.x - 1, y: outer.y - 1, w: outer.w + 2, h: outer.h + 2 }, (x, y) => {
    if (!inside(x, y)) {
      if (inside(x, y - 1) || inside(x - 1, y) || inside(x + 1, y)) sc.P.shade(x, y, 0.62, "#18130f");
      return;
    }
    if (!inside(x, y + 1) || !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1)) sc.P.set(x, y, PAL.stone[4]);
  });
}

// ---------- 小道具 ----------
// 路灯（美术像素，脚底位置），夜里会亮
export function streetLamp(sc, x, y, color = [255, 214, 140], broken = false) {
  const P = sc.P;
  P.shadowEllipse(x + 2, y, 3, 1);
  P.vline(x, y - 22, y, PAL.ash[2]);
  P.vline(x + 1, y - 22, y, PAL.ash[1]);
  P.hline(x, x + 5, y - 22, PAL.ash[2]);
  P.rect(x + 4, y - 22, 4, 3, PAL.ash[1]);
  P.rect(x + 5, y - 20, 2, 1, broken ? PAL.ash[0] : PAL.straw[4]);
  P.rect(x - 1, y, 4, 1, PAL.ash[1]);
  if (!broken) sc.lamp(x + 6, y - 19, color);
}
// 火桶：夜里的火光，白天冒烟
export function fireBarrel(sc, x, y) {
  const P = sc.P;
  P.shadowEllipse(x + 2, y, 4, 1.5);
  P.rect(x - 3, y - 8, 7, 8, PAL.rust[1]);
  P.vline(x - 3, y - 8, y - 1, PAL.rust[2]);
  P.hline(x - 3, x + 3, y - 5, PAL.rust[0]);
  P.ellipse(x, y - 8, 3.5, 1.4, PAL.ash[0]);
  P.set(x, y - 9, PAL.ember[3]);
  P.set(x - 1, y - 9, PAL.ember[4]);
  sc.lights.push({ x, y: y - 10, kind: "fire" });
  sc.embers.push({ x, y: y - 9, flame: true });
}
// 帐篷（白色的救护帐篷、彩色的市集帐篷）
export function tent(sc, x, y, w = 22, cols = [PAL.stone[5], PAL.stone[4]], mark = null) {
  const P = sc.P,
    h = Math.round(w * 0.6);
  P.shadowEllipse(x + 3, y, w / 2 + 2, 2);
  P.poly([[x - w / 2, y], [x - w / 2 + 3, y - h + 4], [x, y - h], [x + w / 2 - 3, y - h + 4], [x + w / 2, y]], cols[0]);
  P.poly([[x, y - h], [x + w / 2 - 3, y - h + 4], [x + w / 2, y], [x, y]], cols[1]);
  P.rect(x - 3, y - 7, 6, 7, PAL.ash[1]);
  P.line(x - w / 2, y, x, y - h, OUTLINE, 0.7);
  P.line(x, y - h, x + w / 2, y, OUTLINE, 0.7);
  P.hline(x - w / 2, x + w / 2, y, OUTLINE, 0.7);
  if (mark === "cross") {
    P.rect(x - 5, y - h + 5, 2, 5, PAL.cloth[1]);
    P.rect(x - 6, y - h + 6, 4, 2, PAL.cloth[1]);
  }
}
// 市集摊位：遮阳布 + 台子 + 货
export function stall(sc, x, y, cols = [PAL.cloth[1], PAL.cloth[5]], goods = [PAL.cloth[2], PAL.leaf[4], PAL.ember[3]]) {
  const P = sc.P;
  P.shadowEllipse(x + 3, y, 14, 2);
  for (const dx of [-12, 11]) P.vline(x + dx, y - 16, y, PAL.soil[1]);
  for (let i = -13; i <= 13; i++) for (let j = 0; j < 5; j++) P.set(x + i, y - 18 + j, Math.floor((i + 13) / 4) % 2 ? cols[0] : cols[1]);
  for (let i = -13; i <= 13; i += 4) P.set(x + i + 1, y - 13, Math.floor((i + 13) / 4) % 2 ? cols[0] : cols[1]);
  P.rect(x - 12, y - 7, 25, 5, PAL.soil[2]);
  P.hline(x - 12, x + 12, y - 7, PAL.straw[2]);
  for (let k = 0; k < 6; k++) P.disc(x - 9 + k * 3.6, y - 8, 1.4, goods[k % goods.length]);
  P.hline(x - 13, x + 13, y - 18, OUTLINE, 0.6);
}
export function crateStack(sc, x, y, n = 2) {
  const P = sc.P;
  P.shadowEllipse(x + 3, y, 8, 2);
  for (let k = 0; k < n; k++) {
    const cx = x - 6 + (k % 2) * 8,
      cy = y - Math.floor(k / 2) * 7;
    P.rect(cx, cy - 7, 9, 7, PAL.soil[3]);
    P.hline(cx, cx + 8, cy - 7, PAL.straw[2]);
    P.line(cx, cy - 6, cx + 8, cy - 1, PAL.soil[1]);
    P.vline(cx + 8, cy - 7, cy - 1, PAL.soil[1]);
    P.hline(cx, cx + 8, cy - 1, OUTLINE, 0.5);
  }
}
// 集装箱
export function container(sc, x, y, w = 30, col = PAL.rust) {
  const P = sc.P,
    h = 14;
  P.shadowEllipse(x + w / 2 + 3, y, w / 2 + 2, 2);
  P.rect(x, y - h, w, h, col[1]);
  for (let i = x; i < x + w; i += 3) P.vline(i, y - h + 3, y - 1, col[2]);
  P.rect(x, y - h, w, 3, col[2]);
  P.hline(x, x + w - 1, y - h, col[3] || col[2]);
  P.rect(x + w - 4, y - h + 3, 3, h - 3, col[0]);
  P.vline(x, y - h, y - 1, OUTLINE);
  P.vline(x + w - 1, y - h, y - 1, OUTLINE);
  P.hline(x, x + w - 1, y - 1, OUTLINE);
  P.hline(x, x + w - 1, y - h, OUTLINE);
}
// 松树（可带雪；v0.44 寒潮时节画的底图上松树都积雪）
export function pine(seed, s = 1, snow = false) {
  snow = snow || ART_SEASON.id === "cold";
  const r = rng(seed),
    H = Math.round(26 * s) + 8,
    W = Math.round(16 * s) + 6,
    S2 = new Pix(W, H + 4),
    cx = Math.floor(W / 2);
  S2.rect(cx - 1, H - 6, 3, 9, PAL.soil[1]);
  const tiers = 4;
  for (let t = 0; t < tiers; t++) {
    const ty = Math.round(2 + (t * (H - 10)) / tiers),
      half = Math.round(((t + 1) / tiers) * (W / 2 - 1));
    for (let j = 0; j < (H - 8) / tiers + 3; j++) {
      const hw = Math.round(half * (0.35 + 0.65 * (j / ((H - 8) / tiers + 3))));
      for (let i = -hw; i <= hw; i++) {
        const light = i < 0 ? 0.65 : 0.35;
        S2.set(cx + i, ty + j, dither("leaf", light - j * 0.02 + (r() - 0.5) * 0.1, cx + i, ty + j));
        if (snow && j < 2 && Math.abs(i) < hw - 1) S2.set(cx + i, ty + j, PAL.snow[3]);
      }
    }
  }
  if (snow) for (let k = 0; k < 6; k++) S2.set(cx - 3 + Math.floor(r() * 7), 4 + Math.floor(r() * (H - 10)), PAL.snow[4]);
  S2.outline(OUTLINE, 0.85);
  return S2;
}
// 铁轨（横向）
export function railH(sc, x0, x1, y) {
  const P = sc.P;
  for (let x = x0; x <= x1; x++) {
    if ((x - x0) % 5 === 0) for (let k = -1; k <= 7; k++) P.set(x, y + k, PAL.soil[1]);
    if ((x - x0) % 5 === 1) for (let k = -1; k <= 7; k++) P.set(x, y + k, PAL.soil[0]);
    P.set(x, y, PAL.stone[4]);
    P.set(x, y + 1, PAL.stone[2]);
    P.set(x, y + 5, PAL.stone[4]);
    P.set(x, y + 6, PAL.stone[2]);
    sc.setCode(x, y + 2, S.rail);
  }
}
