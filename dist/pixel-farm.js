// 新画面的农场底图：烧过的土地上重新长出来的农场。只画一次，存成 768×512 的像素画（每个像素占地图 2×2）。
// 布局沿用原来的：农舍、谷仓、池塘的碰撞范围不变，十字路口、农田、水渠、生态区都在原位。
import { PAL, OUTLINE, Pix, fbm, vnoise, hash2, dither, rng, mix } from "./pixel-kit.js";

export const FARM_W = 768,
  FARM_H = 512;

// 以美术像素为单位的布局（地图坐标 ÷ 2）
export const LAYOUT = {
  road: { y0: 150, y1: 181, x1: 702 },
  track: { cx: 453, half: 14 },
  house: { x0: 62, y0: 30, x1: 236, y1: 146 },
  barn: { x0: 326, y0: 36, x1: 446, y1: 124 },
  field: { x0: 133, y0: 198, x1: 352, y1: 343 },
  pond: { cx: 624, cy: 366, rx: 74, ry: 44 },
  canal: { x0: 356, y0: 323, x1: 420, y1: 387 },
  eco: { x0: 551, y0: 423, x1: 615, y1: 487 },
  stream: [
    [742, -4],
    [747, 50],
    [740, 110],
    [745, 165],
    [751, 225],
    [762, 275],
    [790, 320],
  ],
};
// 不要在这些交互点附近放大件装饰（美术像素）
const KEEP = [
  [440, 150], [377, 172], [234, 171], [367, 285], [381, 348], [280, 367], [520, 410], [495, 437],
  [540, 450], [164, 157], [720, 196], [505, 240], [478, 185],
];
const ASH = [
  [48, 320, 30],
  [586, 214, 24],
  [660, 100, 26],
  [700, 478, 22],
  [100, 470, 22],
  [298, 116, 14],
  [216, 410, 16],
];

const T = { grass: 0, road: 1, track: 2, field: 3, water: 4, shore: 5, sand: 6, ash: 7, scorch: 8, bridge: 9, path: 10, deck: 11 };

export function distSeg(px, py, ax, ay, bx, by) {
  const dx = bx - ax,
    dy = by - ay,
    t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)));
  return Math.hypot(px - ax - t * dx, py - ay - t * dy);
}
function streamDist(x, y) {
  let d = Infinity;
  const s = LAYOUT.stream;
  for (let i = 0; i + 1 < s.length; i++) d = Math.min(d, distSeg(x, y, ...s[i], ...s[i + 1]));
  return d;
}
const near = (x, y, r) => KEEP.some(([kx, ky]) => Math.hypot(kx - x, ky - y) < r);
const inRect = (x, y, r, pad = 0) => x >= r.x0 - pad && x < r.x1 + pad && y >= r.y0 - pad && y < r.y1 + pad;

// ---------- 地形 ----------
function terrainType(x, y) {
  const L = LAYOUT,
    n = vnoise(x * 0.21, y * 0.21, 3);
  // 溪流与桥
  const sd = streamDist(x, y) + (vnoise(x * 0.1, y * 0.1, 9) - 0.5) * 4;
  const onBridge = x >= 700 && y >= L.road.y0 - 2 && y <= L.road.y1 + 2;
  if (onBridge && sd < 16) return T.bridge;
  if (sd < 9) return T.water;
  if (sd < 12) return T.shore;
  // 池塘
  const p = L.pond,
    pd = ((x - p.cx) / p.rx) ** 2 + ((y - p.cy) / p.ry) ** 2 + (fbm(x * 0.05, y * 0.05, 21, 3) - 0.5) * 0.42;
  if (pd < 1) return T.water;
  if (pd < 1.14) return T.shore;
  if (pd < 1.3) return T.sand;
  // 码头（钓鱼点旁）
  if (x >= 534 && x <= 562 && y >= 382 && y <= 393) return T.deck;
  // 旧公路
  const r = L.road,
    top = r.y0 + (n - 0.5) * 3,
    bot = r.y1 + (vnoise(x * 0.23, 7, 4) - 0.5) * 3;
  if (y >= top && y <= bot && x <= r.x1 + (n - 0.5) * 4) return T.road;
  // 南北土路（压过公路以外的地方）
  const cx = L.track.cx + Math.sin(y * 0.021) * 3,
    half = L.track.half + (vnoise(3, y * 0.15, 5) - 0.5) * 3;
  if (Math.abs(x - cx) < half) return T.track;
  // 小路：农舍门前、谷仓门前、通往溪谷入口和池塘边
  if (x >= 154 && x <= 174 && y >= 140 && y <= 152) return T.path;
  if (x >= 376 && x <= 396 && y >= 120 && y <= 152) return T.path;
  const worn = (d, w) => d < w + n || (d < w + 3 + n * 2 && hash2(x, y, 51) > 0.5);
  if (worn(distSeg(x, y, 466, 436, 500, 438), 4)) return T.path;
  if (worn(distSeg(x, y, 466, 300, 490, 352) + 0, 1.6) || worn(distSeg(x, y, 490, 352, 516, 400), 1.6)) return T.path;
  if (worn(distSeg(x, y, 354, 290, 400, 284), 1.4) || worn(distSeg(x, y, 400, 284, 438, 286), 1.4)) return T.path;
  // 农田（休耕的土）
  const f = L.field,
    edge = (vnoise(x * 0.3, y * 0.3, 8) - 0.5) * 3;
  if (x > f.x0 + edge && x < f.x1 + edge && y > f.y0 + edge && y < f.y1 + edge) return T.field;
  // 烧过的地
  for (const [ax, ay, ar] of ASH) {
    const d = Math.hypot(x - ax, (y - ay) * 1.3) + (fbm(x * 0.09, y * 0.09, 31, 3) - 0.5) * 14;
    if (d < ar * 0.62) return T.ash;
    if (d < ar) return T.scorch;
  }
  return T.grass;
}

function paintTerrain(P, map) {
  const W = FARM_W;
  for (let y = 0; y < FARM_H; y++)
    for (let x = 0; x < W; x++) {
      const t = map[y * W + x],
        h = hash2(x, y, 1);
      let c;
      if (t === T.grass) {
        const dry = fbm(x * 0.012, y * 0.012, 11, 3),
          tone = 0.3 + fbm(x * 0.07, y * 0.07, 12, 3) * 0.5 + (h - 0.5) * 0.12;
        if (dry > 0.62 || (dry > 0.55 && h > 0.45 + (0.62 - dry) * 6)) c = dither("straw", tone * 0.9, x, y);
        else c = dither("leaf", tone * 0.95 + 0.05, x, y);
        if (h > 0.985) c = PAL.leaf[1];
      } else if (t === T.scorch) {
        const tone = fbm(x * 0.1, y * 0.1, 13, 2);
        c = h > 0.62 ? dither("ash", 0.55 + tone * 0.35, x, y) : h > 0.3 ? dither("straw", 0.05 + tone * 0.3, x, y) : dither("leaf", 0.2 + tone * 0.3, x, y);
      } else if (t === T.ash) {
        c = dither("ash", 0.42 + fbm(x * 0.12, y * 0.12, 14, 2) * 0.5, x, y);
      } else if (t === T.road) {
        const tone = 0.22 + fbm(x * 0.06, y * 0.09, 15, 3) * 0.32 + (h - 0.5) * 0.06;
        c = dither("stone", tone, x, y);
      } else if (t === T.track || t === T.path) {
        const tone = 0.5 + fbm(x * 0.08, y * 0.08, 16, 3) * 0.35 + (h - 0.5) * 0.1;
        c = dither("soil", tone, x, y);
      } else if (t === T.field) {
        const row = (y - LAYOUT.field.y0) % 5,
          tone = 0.18 + fbm(x * 0.09, y * 0.09, 17, 2) * 0.3 + (row === 0 ? -0.12 : row === 1 ? 0.1 : 0);
        c = dither("soil", tone, x, y);
      } else if (t === T.water) c = PAL.water[2];
      else if (t === T.shore) c = dither("soil", 0.12 + h * 0.18, x, y);
      else if (t === T.sand) c = dither("straw", 0.35 + fbm(x * 0.1, y * 0.1, 18, 2) * 0.3, x, y);
      else if (t === T.bridge) c = PAL.soil[3];
      else if (t === T.deck) c = PAL.straw[1];
      P.set(x, y, c);
    }
}

// 水：越深越暗，近岸一圈浅色
function paintWater(P, map) {
  const W = FARM_W,
    at = (x, y) => (x < 0 || y < 0 || x >= W || y >= FARM_H ? T.grass : map[y * W + x]);
  for (let y = 0; y < FARM_H; y++)
    for (let x = 0; x < W; x++) {
      if (map[y * W + x] !== T.water) continue;
      let d = 0;
      for (let r = 1; r <= 7 && !d; r++) if (at(x - r, y) !== T.water || at(x + r, y) !== T.water || at(x, y - r) !== T.water || at(x, y + r) !== T.water) d = r;
      d ||= 8;
      const t = 0.75 - d * 0.08 + (fbm(x * 0.08, y * 0.08, 22, 2) - 0.5) * 0.18;
      P.set(x, y, dither("water", Math.max(0.05, t), x, y));
      if (d === 1 && at(x, y - 1) !== T.water) P.set(x, y, PAL.water[4]);
    }
  // 水面的亮纹
  const r = rng(77);
  for (let i = 0; i < 160; i++) {
    const x = Math.floor(r() * W),
      y = Math.floor(r() * FARM_H),
      len = 2 + Math.floor(r() * 5);
    let ok = true;
    for (let k = 0; k < len; k++) if (at(x + k, y) !== T.water || at(x + k, y - 2) !== T.water) ok = false;
    if (ok) P.hline(x, x + len - 1, y, r() > 0.6 ? PAL.water[5] : PAL.water[4], 0.85);
  }
}

// 公路的裂缝、褪色的中线、井盖、坑洼
function paintRoad(P, map) {
  const W = FARM_W,
    r = rng(5),
    L = LAYOUT.road,
    mid = Math.round((L.y0 + L.y1) / 2);
  for (let x = 6; x < L.x1 - 6; x += 20) {
    if (Math.abs(x - LAYOUT.track.cx) < 22) continue;
    if (hash2(x, 3, 2) < 0.18) continue;
    for (let k = 0; k < 10; k++) if (hash2(x + k, mid, 4) > 0.15) P.set(x + k, mid, mix(PAL.straw[3], PAL.stone[2], hash2(x, k, 6) * 0.45));
  }
  // 路肩：上下缘一排浅色碎石
  for (let x = 0; x < L.x1; x++)
    for (const y of [L.y0 - 1, L.y1 + 1]) {
      const yy = y + Math.round((vnoise(x * 0.21, y * 0.21, 3) - 0.5) * 3);
      if (map[yy * W + x] === T.road && hash2(x, yy, 9) > 0.5) P.set(x, yy, PAL.stone[3]);
    }
  // 裂缝里长草
  for (let i = 0; i < 46; i++) {
    let x = 4 + r() * (L.x1 - 8),
      y = L.y0 + 4 + r() * (L.y1 - L.y0 - 8);
    if (Math.abs(x - LAYOUT.track.cx) < 18) continue;
    const len = 6 + r() * 16;
    for (let k = 0; k < len; k++) {
      if (map[Math.round(y) * W + Math.round(x)] !== T.road) break;
      P.set(x, y, PAL.stone[0]);
      if (r() < 0.22) P.set(x, y - 1, r() < 0.5 ? PAL.leaf[3] : PAL.leaf[4]);
      x += r() < 0.5 ? 1 : 0.6;
      y += (r() - 0.5) * 1.6;
    }
  }
  // 坑洼
  for (const [x, y, w] of [[96, 172, 7], [262, 158, 5], [590, 175, 8], [646, 159, 5]]) {
    P.ellipse(x, y, w, 2.5, PAL.stone[0]);
    P.ellipse(x - 1, y - 0.5, w - 2, 1.4, PAL.stone[1]);
  }
  // 井盖
  P.disc(560, 165, 4, PAL.stone[1]);
  P.disc(560, 165, 3, PAL.stone[2]);
  P.hline(557, 563, 165, PAL.stone[1]);
  P.vline(560, 162, 168, PAL.stone[1]);
}

// 土路的车辙和石子
function paintTrack(P, map) {
  const W = FARM_W;
  for (let y = 0; y < FARM_H; y++) {
    const cx = LAYOUT.track.cx + Math.sin(y * 0.021) * 3;
    for (const dx of [-6, 6])
      for (const w of [0, 1]) {
        const x = Math.round(cx + dx + w);
        if (map[y * W + x] === T.track && hash2(x, y, 41) > 0.15) P.set(x, y, w ? PAL.soil[2] : PAL.soil[1]);
      }
  }
  const r = rng(13);
  for (let i = 0; i < 260; i++) {
    const x = Math.floor(r() * W),
      y = Math.floor(r() * FARM_H),
      t = map[y * W + x];
    if (t === T.track || t === T.path) {
      P.set(x, y, r() > 0.5 ? PAL.stone[3] : PAL.stone[4]);
      if (r() > 0.6) P.set(x + 1, y, PAL.stone[2]);
    }
  }
}

// 草地上的小东西：草丛、花、石子、碎铁片；烧过的地里有新芽和火星
function paintScatter(P, map) {
  const W = FARM_W,
    r = rng(99);
  for (let i = 0; i < 2600; i++) {
    const x = Math.floor(r() * W),
      y = Math.floor(r() * FARM_H),
      t = map[y * W + x];
    if (t === T.grass) {
      const k = r();
      if (k < 0.62) {
        // 草丛
        const dry = fbm(x * 0.012, y * 0.012, 11, 3) > 0.56,
          dark = dry ? PAL.straw[0] : PAL.leaf[1],
          mid = dry ? PAL.straw[2] : PAL.leaf[3],
          lite = dry ? PAL.straw[3] : PAL.leaf[5];
        P.set(x, y, dark);
        P.set(x - 1, y, dark);
        P.set(x - 1, y - 1, mid);
        P.set(x + 1, y - 1, mid);
        P.set(x, y - 2, lite);
        if (r() > 0.5) P.set(x + 2, y - 2, mid);
      } else if (k < 0.74 && !near(x, y, 10)) {
        // 野花：橙红的罂粟、白色的蓍草、黄色的蒲公英
        const col = [PAL.ember[2], PAL.ember[3], PAL.cloth[5], PAL.ember[4], PAL.cloth[1]][Math.floor(r() * 5)];
        const n = 1 + Math.floor(r() * 4);
        for (let j = 0; j < n; j++) {
          const fx = x + Math.round((r() - 0.5) * 6),
            fy = y + Math.round((r() - 0.5) * 4);
          P.set(fx, fy + 1, PAL.leaf[2]);
          P.set(fx, fy, col);
        }
      } else if (k < 0.86) {
        P.set(x, y, PAL.stone[3]);
        P.set(x + 1, y, PAL.stone[2]);
        P.set(x, y - 1, PAL.stone[4]);
      } else if (k < 0.9) {
        // 锈铁片、碎玻璃
        P.set(x, y, PAL.rust[2]);
        P.set(x + 1, y, PAL.rust[1]);
        if (r() > 0.5) P.set(x, y - 1, PAL.water[5]);
      }
    } else if (t === T.ash) {
      if (r() < 0.45) {
        // 新芽
        P.set(x, y, PAL.leaf[3]);
        P.set(x - 1, y - 1, PAL.leaf[4]);
        P.set(x + 1, y - 1, PAL.leaf[5]);
      } else if (r() < 0.5) {
        P.set(x, y, PAL.ember[1]);
        if (r() > 0.6) P.set(x + 1, y, PAL.ember[2]);
      } else P.set(x, y, PAL.ash[0]);
    } else if (t === T.field) {
      if (r() < 0.08) P.set(x, y, PAL.stone[3]);
    }
  }
}

// ---------- 道具 ----------
// 先在小缓冲里画，再描边、投影、盖上去
export function sprite(w, h, draw) {
  const S = new Pix(w, h);
  draw(S);
  return S;
}
export function place(P, S, x, y, opt = {}) {
  // x,y 是脚底中心
  const ox = Math.round(x - S.w / 2),
    oy = Math.round(y - S.h);
  if (opt.shadow !== false) {
    const sw = opt.shadowW ?? S.w * 0.42,
      sh = opt.shadowH ?? Math.max(2, S.w * 0.13);
    P.shadowEllipse(x + (opt.shadowDx ?? 3), y - 1 + (opt.shadowDy ?? 0), sw, sh, opt.shadowF ?? 0.6);
  }
  P.stamp(S, ox, oy, !!opt.flip);
}

// 树：活树、秋树、枯树
export function tree(seed, kind = "live", size = 1) {
  const r = rng(seed),
    R = Math.round(11 + 6 * size + r() * 3),
    W = R * 2 + 8,
    H = R * 2 + 18;
  return sprite(W, H, (S) => {
    const cx = W / 2,
      base = H - 1,
      trunkH = 8 + Math.round(r() * 4);
    // 树干
    const bark = kind === "dead" ? ["#251d17", "#352a21", "#4a3c30"] : [PAL.soil[0], PAL.soil[1], PAL.soil[2]];
    S.rect(cx - 2, base - trunkH - R * 0.6, 4, trunkH + R * 0.6, bark[1]);
    S.vline(cx - 2, base - trunkH - R * 0.6, base, bark[2]);
    S.vline(cx + 1, base - trunkH - R * 0.6, base, bark[0]);
    S.set(cx - 3, base, bark[0]);
    S.set(cx + 2, base, bark[0]);
    if (kind === "dead") {
      // 枯枝
      const branch = (x, y, a, len, w) => {
        if (len < 2) return;
        const x2 = x + Math.cos(a) * len,
          y2 = y + Math.sin(a) * len;
        for (let k = 0; k < w; k++) S.line(x + k, y, x2 + k, y2, k ? bark[0] : bark[2]);
        branch(x2, y2, a - 0.45 - r() * 0.3, len * 0.66, Math.max(1, w - 1));
        branch(x2, y2, a + 0.4 + r() * 0.3, len * 0.62, Math.max(1, w - 1));
      };
      branch(cx - 1, base - trunkH - R * 0.5, -Math.PI / 2, R * 0.75, 2);
      S.outline(OUTLINE, 0.9);
      return;
    }
    const ramp = kind === "autumn" ? [PAL.ember[0], PAL.ember[1], PAL.ember[2], PAL.ember[3], PAL.ember[4], PAL.straw[3]] : PAL.leaf,
      cy = base - trunkH - R + 2,
      blobs = [];
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2,
        d = r() * R * 0.45;
      blobs.push([cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.8, R * (0.5 + r() * 0.25)]);
    }
    blobs.push([cx, cy, R * 0.72]);
    for (let y = 0; y < H; y++)
      for (let x = 0; x < W; x++) {
        let inside = false;
        for (const [bx, by, br] of blobs) if ((x - bx) ** 2 + (y - by) ** 2 < br * br) inside = true;
        if (!inside) continue;
        // 光从左上来
        const lx = (x - cx) / R,
          ly = (y - cy) / R,
          light = 0.62 - lx * 0.32 - ly * 0.42 + (fbm(x * 0.35, y * 0.35, seed, 2) - 0.5) * 0.5;
        S.set(x, y, dither(kind === "autumn" ? "ember" : "leaf", Math.max(0.05, Math.min(0.98, light)), x, y));
        if (kind === "autumn" && hash2(x, y, seed) > 0.93) S.set(x, y, PAL.straw[3]);
      }
    // 树叶的小簇
    for (let i = 0; i < R * 2; i++) {
      const x = Math.round(cx + (r() - 0.5) * R * 1.6),
        y = Math.round(cy + (r() - 0.5) * R * 1.4);
      if (S.opaque(x, y) && S.opaque(x, y + 2)) {
        S.set(x, y, ramp[5]);
        S.set(x + 1, y, ramp[4]);
        S.set(x, y + 1, ramp[2]);
      }
    }
    S.outline(OUTLINE, 0.85);
  });
}
export function rock(seed, w = 12, h = 8) {
  const r = rng(seed);
  return sprite(w + 2, h + 2, (S) => {
    const cx = (w + 2) / 2,
      cy = (h + 2) / 2 + 0.5;
    for (let y = 0; y < h + 2; y++)
      for (let x = 0; x < w + 2; x++) {
        const d = ((x - cx) / (w / 2)) ** 2 + ((y - cy) / (h / 2)) ** 2 + (hash2(x, y, seed) - 0.5) * 0.25;
        if (d > 1) continue;
        const light = 0.7 - ((x - cx) / w) * 0.8 - ((y - cy) / h) * 1.1;
        S.set(x, y, dither("stone", Math.max(0.1, Math.min(0.95, light)), x, y));
      }
    if (r() > 0.4) S.set(Math.round(cx - 2), Math.round(cy - 2), PAL.leaf[3]);
    S.outline(OUTLINE, 0.85);
  });
}
export function bush(seed, R = 6, flowers = null) {
  const r = rng(seed);
  return sprite(R * 2 + 4, R * 2 + 3, (S) => {
    const cx = R + 2,
      cy = R + 1;
    for (let y = 0; y < S.h; y++)
      for (let x = 0; x < S.w; x++) {
        const d = ((x - cx) / R) ** 2 + ((y - cy) / (R * 0.85)) ** 2 + (fbm(x * 0.5, y * 0.5, seed, 2) - 0.5) * 0.6;
        if (d > 1) continue;
        S.set(x, y, dither("leaf", Math.max(0.05, 0.6 - ((x - cx) / R) * 0.3 - ((y - cy) / R) * 0.45), x, y));
      }
    if (flowers) for (let i = 0; i < R; i++) S.opaque(Math.round(cx + (r() - 0.5) * R * 1.4), Math.round(cy + (r() - 0.6) * R)) && S.set(Math.round(cx + (r() - 0.5) * R * 1.4), Math.round(cy + (r() - 0.6) * R), flowers);
    S.outline(OUTLINE, 0.8);
  });
}
// 生锈的汽车（俯视略带正面）
export function car(seed, sunk = false) {
  const r = rng(seed);
  return sprite(40, 22, (S) => {
    const body = [PAL.rust[1], PAL.rust[2], PAL.rust[3]],
      paint = r() > 0.5 ? PAL.cloth[4] : PAL.straw[1];
    // 车身
    S.rect(2, 6, 36, 13, body[1]);
    S.rect(3, 5, 34, 1, body[2]);
    S.rect(1, 8, 1, 9, body[0]);
    S.rect(38, 8, 1, 9, body[0]);
    // 残漆
    for (let y = 6; y < 18; y++) for (let x = 3; x < 37; x++) if (fbm(x * 0.25, y * 0.25, seed, 2) > 0.55) S.set(x, y, mix(paint, body[1], 0.25));
    // 车顶与碎窗
    S.rect(11, 3, 18, 10, body[0]);
    S.rect(12, 4, 16, 8, PAL.water[0]);
    for (let i = 0; i < 7; i++) S.set(12 + Math.floor(r() * 16), 4 + Math.floor(r() * 8), PAL.water[4]);
    S.rect(11, 3, 18, 1, body[2]);
    // 锈斑、车灯、轮子
    for (let i = 0; i < 18; i++) S.set(3 + Math.floor(r() * 34), 7 + Math.floor(r() * 11), r() > 0.5 ? PAL.rust[0] : PAL.ember[1]);
    S.rect(2, 10, 2, 3, PAL.straw[3]);
    S.rect(36, 10, 2, 3, PAL.ember[1]);
    if (!sunk)
      for (const x of [6, 30]) {
        S.rect(x, 17, 5, 3, PAL.ash[0]);
        S.rect(x + 1, 17, 3, 1, PAL.ash[3]);
      }
    S.hline(3, 37, 18, body[0]);
    S.outline(OUTLINE);
  });
}
export function drums(seed, n = 3) {
  const r = rng(seed);
  return sprite(8 * n + 4, 14, (S) => {
    for (let i = 0; i < n; i++) {
      const x = 2 + i * 8 + (i % 2),
        col = r() > 0.4 ? PAL.rust : [PAL.water[0], PAL.water[1], PAL.water[2], PAL.water[3]],
        top = 2 + ((i * 3) % 2);
      S.rect(x, top + 2, 7, 10, col[1]);
      S.vline(x, top + 2, top + 11, col[2]);
      S.vline(x + 6, top + 2, top + 11, col[0]);
      S.hline(x, x + 6, top + 6, col[0]);
      S.ellipse(x + 3, top + 2, 3.2, 1.5, col[2]);
      S.ellipse(x + 3, top + 2, 2, 0.8, col[0]);
      for (let k = 0; k < 4; k++) S.set(x + 1 + Math.floor(r() * 5), top + 3 + Math.floor(r() * 8), PAL.rust[3]);
    }
    S.outline(OUTLINE);
  });
}
export function tires(seed) {
  return sprite(18, 12, (S) => {
    for (const [x, y] of [[3, 7], [10, 7], [6, 3]]) {
      S.ellipse(x + 2, y + 1, 4, 2.5, PAL.ash[1]);
      S.ellipse(x + 2, y + 1, 1.8, 1, PAL.ash[0]);
      S.set(x, y - 1, PAL.ash[3]);
      S.set(x + 1, y - 1, PAL.ash[3]);
    }
    S.outline(OUTLINE);
  });
}
export function hay(seed) {
  return sprite(16, 13, (S) => {
    S.ellipse(8, 7, 7, 5.5, PAL.straw[2]);
    for (let y = 2; y < 13; y++) for (let x = 1; x < 15; x++) if (S.opaque(x, y)) S.set(x, y, dither("straw", 0.75 - ((x - 8) / 14) * 0.6 - ((y - 7) / 11) * 0.5, x, y));
    for (let k = 0; k < 3; k++) S.ellipse(8, 7, 5 - k * 2, 4 - k * 1.5, PAL.straw[1], 0.25);
    S.vline(5, 3, 11, PAL.rust[1]);
    S.vline(11, 3, 11, PAL.rust[1]);
    S.outline(OUTLINE);
  });
}
export function woodpile() {
  return sprite(22, 14, (S) => {
    for (let row = 0; row < 3; row++)
      for (let i = 0; i < 4 - row; i++) {
        const x = 3 + i * 5 + row * 2.5,
          y = 10 - row * 4;
        S.disc(x, y, 2.4, PAL.soil[2]);
        S.disc(x, y, 1.4, PAL.straw[2]);
        S.set(x, y, PAL.soil[3]);
      }
    S.outline(OUTLINE);
  });
}
// 电线杆：返回小图和杆顶（相对脚底）
export function pole() {
  return sprite(14, 48, (S) => {
    S.rect(6, 4, 2, 44, PAL.soil[1]);
    S.vline(6, 4, 47, PAL.soil[2]);
    S.rect(1, 6, 12, 2, PAL.soil[1]);
    S.hline(1, 12, 6, PAL.soil[2]);
    for (const x of [2, 11]) S.set(x, 5, PAL.stone[4]);
    S.outline(OUTLINE);
  });
}
export function billboard() {
  return sprite(46, 34, (S) => {
    for (const x of [8, 36]) {
      S.rect(x, 18, 2, 16, PAL.rust[1]);
      S.vline(x, 18, 33, PAL.rust[2]);
    }
    // 斜着倒了一半的板子
    S.poly([[2, 4], [44, 0], [44, 20], [2, 22]], PAL.rust[1]);
    S.poly([[4, 6], [42, 2], [42, 18], [4, 20]], PAL.straw[3]);
    // 褪色的画面：大色块，没有字
    S.poly([[4, 13], [42, 9], [42, 18], [4, 20]], PAL.cloth[2]);
    S.poly([[4, 6], [20, 5], [16, 14], [4, 15]], PAL.water[4]);
    S.disc(31, 7, 3, PAL.ember[4]);
    for (let i = 0; i < 40; i++) {
      const x = 4 + Math.floor(hash2(i, 1, 5) * 38),
        y = 3 + Math.floor(hash2(i, 2, 5) * 16);
      if (S.opaque(x, y)) S.set(x, y, hash2(i, 3, 5) > 0.5 ? PAL.straw[4] : PAL.rust[2]);
    }
    S.line(2, 22, 44, 20, PAL.rust[0]);
    S.outline(OUTLINE);
  });
}
// 木栅栏与铁皮围挡
export function fenceWood(P, x0, x1, y, seed = 1) {
  const r = rng(seed);
  for (let x = x0; x <= x1; x++) {
    P.set(x, y - 5, PAL.soil[2]);
    P.set(x, y - 4, PAL.soil[3]);
    P.set(x, y - 2, PAL.soil[2]);
  }
  for (let x = x0; x <= x1; x += 9) {
    if (r() < 0.12) continue;
    P.shadowEllipse(x + 2, y + 1, 2, 1, 0.65);
    P.rect(x, y - 9, 2, 10, PAL.soil[2]);
    P.vline(x, y - 9, y, PAL.soil[3]);
    P.set(x, y - 10, OUTLINE);
    P.set(x + 1, y - 10, OUTLINE);
  }
}
export function fenceScrap(P, x0, x1, y, seed = 2) {
  const r = rng(seed);
  for (let x = x0; x <= x1; x += 8) {
    const col = r() > 0.35 ? PAL.rust : [PAL.stone[1], PAL.stone[2], PAL.stone[3], PAL.stone[4]],
      h = 9 + Math.floor(r() * 4),
      lean = Math.round((r() - 0.5) * 2);
    P.shadowEllipse(x + 5, y + 1, 5, 1.5, 0.62);
    for (let i = 0; i < 8; i++) {
      const c = i % 2 ? col[1] : col[2];
      P.vline(x + i + (i > 4 ? lean : 0), y - h, y, c);
    }
    P.hline(x, x + 7, y - h, col[3] || col[2]);
    for (let k = 0; k < 3; k++) P.set(x + Math.floor(r() * 8), y - Math.floor(r() * h), PAL.rust[0]);
    P.vline(x - 1, y - h, y, OUTLINE, 0.6);
  }
}

// ---------- 农舍 ----------
function house(P, lights) {
  const H = LAYOUT.house;
  // 水塔（左侧）
  const tx = 70;
  P.shadowEllipse(tx + 8, 132, 12, 3, 0.6);
  for (const lx of [tx - 6, tx + 6]) {
    P.vline(lx, 60, 132, PAL.soil[1]);
    P.vline(lx + 1, 60, 132, PAL.soil[2]);
  }
  P.line(tx - 6, 80, tx + 7, 104, PAL.soil[1]);
  P.line(tx + 7, 80, tx - 6, 104, PAL.soil[1]);
  P.rect(tx - 10, 34, 21, 28, PAL.rust[2]);
  for (let x = tx - 10; x <= tx + 10; x += 3) P.vline(x, 34, 61, PAL.rust[1]);
  P.ellipse(tx, 34, 10.5, 3, PAL.rust[3]);
  P.ellipse(tx, 34, 8, 1.8, PAL.rust[1]);
  P.hline(tx - 10, tx + 10, 61, PAL.rust[0]);
  for (let k = 0; k < 10; k++) P.set(tx - 9 + Math.floor(hash2(k, 4, 8) * 19), 38 + Math.floor(hash2(k, 5, 8) * 22), PAL.ember[1]);
  P.vline(tx + 11, 40, 61, OUTLINE);
  // 主屋墙与屋顶
  const x0 = 84,
    x1 = 206,
    roofTop = 34,
    eave = 96,
    wallBot = 134;
  P.shadowEllipse((x0 + x1) / 2 + 8, wallBot + 2, (x1 - x0) / 2 + 6, 5, 0.55);
  // 正面墙：拼凑的木板、铁皮
  for (let y = eave; y < wallBot; y++)
    for (let x = x0; x <= x1; x++) {
      const board = Math.floor((y - eave) / 4),
        seg = Math.floor((x + board * 7) / 23),
        kind = hash2(seg, board, 3),
        base = kind > 0.82 ? PAL.stone[3] : kind > 0.7 ? PAL.rust[2] : (board % 2 ? PAL.soil[3] : PAL.soil[2]);
      let c = base;
      if ((y - eave) % 4 === 3) c = mix(base, OUTLINE, 0.45);
      if ((x + board * 7) % 23 === 0) c = mix(base, OUTLINE, 0.35);
      P.set(x, y, c);
    }
  P.hline(x0, x1, eave, OUTLINE);
  P.rect(x0, eave + 1, x1 - x0 + 1, 2, OUTLINE, 0.35);
  P.vline(x0 - 1, eave, wallBot, OUTLINE);
  P.vline(x1 + 1, eave, wallBot, OUTLINE);
  // 窗户（夜里会亮）
  const win = (wx, wy, boarded = false) => {
    P.rect(wx - 1, wy - 1, 14, 12, PAL.straw[0]);
    P.rect(wx, wy, 12, 10, PAL.water[0]);
    P.rect(wx + 1, wy + 1, 4, 3, PAL.water[2]);
    P.vline(wx + 6, wy, wy + 9, PAL.straw[1]);
    P.hline(wx, wx + 11, wy + 5, PAL.straw[1]);
    P.hline(wx - 2, wx + 13, wy + 11, PAL.soil[1]);
    if (boarded) {
      P.line(wx - 1, wy + 1, wx + 12, wy + 7, PAL.soil[3]);
      P.line(wx - 1, wy + 2, wx + 12, wy + 8, PAL.soil[2]);
      P.line(wx - 1, wy + 8, wx + 12, wy + 2, PAL.straw[1]);
    } else lights.push({ x: wx + 6, y: wy + 5, kind: "window", w: 12, h: 10 });
  };
  win(98, 104);
  win(126, 104);
  win(184, 104, true);
  // 门
  P.rect(156, 108, 14, 26, PAL.soil[0]);
  P.rect(157, 109, 12, 25, PAL.soil[1]);
  for (let y = 112; y < 133; y += 5) P.hline(158, 167, y, PAL.soil[0]);
  P.set(166, 121, PAL.ember[4]);
  P.rect(155, 106, 16, 2, PAL.straw[0]);
  // 门边的油灯（夜里亮）
  P.rect(176, 106, 3, 4, PAL.ember[4]);
  P.set(177, 105, OUTLINE);
  P.hline(175, 179, 110, PAL.ash[2]);
  lights.push({ x: 177, y: 108, kind: "lantern" });
  // 屋顶：波纹铁皮，几块不同的补丁，一块防水布
  for (let y = roofTop; y < eave; y++) {
    const inset = Math.round((eave - y) * 0.08);
    for (let x = x0 - 6 + inset; x <= x1 + 6 - inset; x++) {
      const patch = hash2(Math.floor((x - x0) / 26), Math.floor((y - roofTop) / 21), 12),
        ramp = patch > 0.78 ? [PAL.stone[2], PAL.stone[3], PAL.stone[4]] : patch > 0.66 ? [PAL.water[1], PAL.water[2], PAL.water[3]] : [PAL.rust[1], PAL.rust[2], PAL.rust[3]],
        ridge = (x - x0) % 4,
        shadeY = (y - roofTop) / (eave - roofTop);
      let c = ridge === 0 ? ramp[2] : ridge === 3 ? ramp[0] : ramp[1];
      if (shadeY > 0.86) c = mix(c, OUTLINE, 0.25);
      if (hash2(x, y, 14) > 0.985) c = PAL.ember[1];
      P.set(x, y, c);
    }
  }
  // 防水布与绳子
  P.poly([[120, 64], [150, 60], [154, 84], [118, 88]], PAL.cloth[3]);
  P.poly([[122, 66], [148, 62], [151, 82], [121, 85]], PAL.cloth[4]);
  P.line(120, 64, 112, 92, PAL.straw[1]);
  P.line(150, 60, 158, 92, PAL.straw[1]);
  // 屋脊、檐口
  P.hline(x0 - 3, x1 + 3, roofTop, PAL.rust[3]);
  P.hline(x0 - 3, x1 + 3, roofTop - 1, OUTLINE);
  P.hline(x0 - 6, x1 + 6, eave - 1, PAL.rust[0]);
  // 太阳能板与天线
  P.rect(92, 44, 22, 14, PAL.stone[4]);
  for (let y = 45; y < 57; y++) for (let x = 93; x < 113; x++) P.set(x, y, (x - 93) % 5 === 4 || (y - 45) % 4 === 3 ? PAL.night[1] : (x + y) % 7 === 0 ? PAL.night[3] : PAL.night[2]);
  P.hline(92, 113, 58, OUTLINE);
  P.vline(140, 12, 44, PAL.stone[2]);
  P.hline(136, 144, 18, PAL.stone[2]);
  P.hline(137, 143, 24, PAL.stone[2]);
  P.set(140, 11, PAL.ember[3]);
  // 烟囱
  P.rect(184, 18, 10, 24, PAL.ember[0]);
  for (let y = 18; y < 42; y += 3) P.hline(184, 193, y, (y / 3) % 2 ? PAL.rust[1] : PAL.ember[1]);
  P.rect(183, 16, 12, 3, PAL.stone[1]);
  P.vline(194, 18, 41, OUTLINE);
  // 门廊：木地台、柱子、台阶、盆栽、椅子
  P.rect(118, 134, 84, 9, PAL.soil[3]);
  for (let x = 118; x < 202; x += 6) P.vline(x, 134, 142, PAL.soil[2]);
  P.hline(118, 201, 143, OUTLINE);
  P.rect(154, 143, 18, 4, PAL.soil[2]);
  P.hline(154, 171, 145, PAL.soil[1]);
  for (const x of [120, 199]) {
    P.rect(x, 98, 3, 36, PAL.soil[2]);
    P.vline(x, 98, 133, PAL.soil[3]);
  }
  for (const [x, col] of [[126, PAL.ember[2]], [134, PAL.cloth[5]], [190, PAL.ember[3]]]) {
    P.rect(x, 136, 5, 5, PAL.ember[1]);
    P.rect(x, 136, 5, 1, PAL.rust[3]);
    P.disc(x + 2, 133, 3, PAL.leaf[3]);
    P.set(x + 1, 132, PAL.leaf[5]);
    P.set(x + 3, 131, col);
  }
  P.rect(176, 128, 8, 6, PAL.soil[1]);
  P.rect(176, 122, 2, 6, PAL.soil[1]);
  // 右侧披屋：柴火
  P.rect(208, 96, 26, 38, PAL.soil[1]);
  for (let y = 100; y < 132; y += 4)
    for (let x = 210; x < 232; x += 4) {
      P.disc(x + 1, y + 1, 1.6, PAL.soil[2]);
      P.set(x + 1, y + 1, PAL.straw[2]);
    }
  P.poly([[204, 80], [238, 86], [238, 98], [204, 96]], PAL.rust[2]);
  for (let x = 205; x < 238; x += 3) P.line(x, 81 + (x - 204) * 0.17, x, 97, PAL.rust[1]);
  P.hline(204, 238, 98, OUTLINE);
  // 晾衣绳
  P.vline(240, 104, 140, PAL.soil[2]);
  P.line(206, 102, 240, 105, PAL.ash[3]);
  for (const [x, col] of [[214, PAL.cloth[1]], [222, PAL.cloth[5]], [230, PAL.cloth[4]]]) {
    P.rect(x, 104, 6, 8, col);
    P.hline(x, x + 5, 111, mix(col, OUTLINE, 0.3));
  }
  return { chimney: { x: 189, y: 15 } };
}

// ---------- 谷仓（塌了一角）----------
function barn(P, lights) {
  const x0 = 334,
    x1 = 438,
    roofTop = 38,
    eave = 82,
    wallBot = 120;
  P.shadowEllipse((x0 + x1) / 2 + 8, wallBot + 2, (x1 - x0) / 2 + 6, 5, 0.55);
  // 墙：褪色的红木板
  for (let y = eave; y < wallBot; y++)
    for (let x = x0; x <= x1; x++) {
      let c = (x - x0) % 5 === 0 ? PAL.rust[0] : hash2(Math.floor(x / 5), Math.floor(y / 9), 6) > 0.5 ? PAL.cloth[0] : PAL.rust[1];
      if (hash2(x, y, 15) > 0.96) c = PAL.straw[1];
      P.set(x, y, c);
    }
  P.hline(x0, x1, eave, OUTLINE);
  P.vline(x0 - 1, eave, wallBot, OUTLINE);
  P.vline(x1 + 1, eave, wallBot, OUTLINE);
  // 大门：半开，里面黑，能看到干草
  P.rect(368, 88, 36, 32, PAL.ash[0]);
  for (let y = 104; y < 120; y++) for (let x = 370; x < 386; x++) if (hash2(x, y, 16) > 0.35) P.set(x, y, hash2(x, y, 17) > 0.5 ? PAL.straw[1] : PAL.straw[0]);
  P.rect(386, 88, 18, 32, PAL.cloth[0]);
  P.line(387, 89, 403, 119, PAL.straw[1]);
  P.line(403, 89, 387, 119, PAL.straw[1]);
  P.rect(386, 88, 18, 1, PAL.straw[2]);
  P.rect(366, 86, 40, 2, PAL.straw[1]);
  // 阁楼窗
  P.rect(380, 70, 12, 10, PAL.straw[0]);
  P.rect(381, 71, 10, 8, PAL.ash[0]);
  lights.push({ x: 386, y: 75, kind: "window", w: 10, h: 8, dim: true });
  // 屋顶：深灰铁皮，一角塌了露出椽子
  for (let y = roofTop; y < eave; y++) {
    const inset = Math.round((eave - y) * 0.12);
    for (let x = x0 - 5 + inset; x <= x1 + 5 - inset; x++) {
      const ridge = (x - x0) % 4;
      let c = ridge === 0 ? PAL.stone[3] : ridge === 3 ? PAL.stone[1] : PAL.stone[2];
      if (hash2(Math.floor(x / 12), Math.floor(y / 10), 18) > 0.8) c = ridge === 0 ? PAL.rust[3] : PAL.rust[2];
      P.set(x, y, c);
    }
  }
  // 塌掉的一角
  P.poly([[412, 44], [444, 50], [442, 80], [418, 78]], PAL.ash[0]);
  for (let x = 416; x < 442; x += 5) P.line(x, 46 + (x - 412) * 0.18, x - 2, 79, PAL.soil[2]);
  P.line(412, 44, 418, 78, PAL.rust[0]);
  P.hline(x0 - 2, x1 + 2, roofTop, PAL.stone[4]);
  P.hline(x0 - 2, x1 + 2, roofTop - 1, OUTLINE);
  P.hline(x0 - 5, x1 + 5, eave - 1, PAL.ash[1]);
  // 屋顶上的小风车
  P.vline(350, 18, 48, PAL.stone[1]);
  P.vline(351, 18, 48, PAL.stone[2]);
  for (const [dx, dy] of [[0, -9], [8, 5], [-8, 5]]) P.line(350, 18, 350 + dx, 18 + dy, PAL.straw[4]);
  P.disc(350, 18, 1.4, PAL.ember[2]);
  return { windmill: { x: 350, y: 18 } };
}

// ---------- 合成 ----------
export function bakeFarm() {
  const P = new Pix(FARM_W, FARM_H),
    map = new Uint8Array(FARM_W * FARM_H);
  for (let y = 0; y < FARM_H; y++) for (let x = 0; x < FARM_W; x++) map[y * FARM_W + x] = terrainType(x, y);
  paintTerrain(P, map);
  paintWater(P, map);
  paintRoad(P, map);
  paintTrack(P, map);
  paintScatter(P, map);
  const lights = [],
    props = [];
  // 桥：木板加锈护栏
  for (let x = 700; x < FARM_W; x++) {
    for (let y = LAYOUT.road.y0 - 2; y <= LAYOUT.road.y1 + 2; y++) {
      if (map[y * FARM_W + x] !== T.bridge) continue;
      const plank = Math.floor((x - 700) / 4);
      P.set(x, y, (x - 700) % 4 === 3 ? PAL.soil[1] : hash2(plank, 1, 3) > 0.5 ? PAL.soil[3] : PAL.soil[2]);
    }
    if (hash2(x, 2, 4) > 0.2) {
      P.set(x, LAYOUT.road.y0 - 4, PAL.rust[3]);
      P.set(x, LAYOUT.road.y0 - 3, PAL.rust[1]);
      P.set(x, LAYOUT.road.y1 + 3, PAL.rust[2]);
      P.set(x, LAYOUT.road.y1 + 4, PAL.rust[0]);
    }
  }
  // 池塘：码头、荷叶、芦苇、半沉的车
  for (let x = 534; x <= 562; x++) for (let y = 382; y <= 393; y++) P.set(x, y, (x - 534) % 4 === 3 ? PAL.soil[1] : hash2(Math.floor((x - 534) / 4), 2, 7) > 0.5 ? PAL.straw[1] : PAL.straw[0]);
  P.hline(534, 562, 394, OUTLINE);
  P.hline(534, 562, 395, PAL.water[1]);
  for (const x of [536, 560]) P.vline(x, 393, 397, PAL.soil[0]);
  const pr = rng(31);
  for (let i = 0; i < 26; i++) {
    const a = pr() * Math.PI * 2,
      d = 0.25 + pr() * 0.55,
      x = Math.round(LAYOUT.pond.cx + Math.cos(a) * LAYOUT.pond.rx * d),
      y = Math.round(LAYOUT.pond.cy + Math.sin(a) * LAYOUT.pond.ry * d);
    if (map[y * FARM_W + x] !== T.water) continue;
    P.ellipse(x, y, 3, 2, PAL.leaf[3]);
    P.set(x + 2, y, PAL.water[2]);
    P.set(x - 1, y - 1, PAL.leaf[5]);
    if (pr() > 0.75) P.set(x, y - 1, PAL.cloth[5]);
  }
  for (let i = 0; i < 70; i++) {
    const a = pr() * Math.PI * 2,
      x = Math.round(LAYOUT.pond.cx + Math.cos(a) * LAYOUT.pond.rx * 1.02),
      y = Math.round(LAYOUT.pond.cy + Math.sin(a) * LAYOUT.pond.ry * 1.02);
    if (x > 520 && x < 556 && y > 392) continue;
    const h = 4 + Math.floor(pr() * 6);
    P.vline(x, y - h, y, pr() > 0.4 ? PAL.leaf[3] : PAL.straw[1]);
    if (pr() > 0.6) {
      P.rect(x, y - h - 2, 1, 3, PAL.soil[1]);
    }
  }
  const sunk = car(404, true);
  for (let y = 0; y < 13; y++) for (let x = 0; x < sunk.w; x++) if (sunk.opaque(x, y)) P.stamp({ w: 1, h: 1, d: sunk.d.slice((y * sunk.w + x) * 4, (y * sunk.w + x) * 4 + 4) }, 660 + x, 378 + y);
  for (let x = 658; x < 702; x++) if (hash2(x, 9, 2) > 0.3) P.set(x, 391, PAL.water[5]);
  // 溪边石头与芦苇
  for (let i = 0; i < 40; i++) {
    const y = Math.floor(pr() * 300),
      xs = LAYOUT.stream,
      x = 742 + Math.round((pr() - 0.5) * 30);
    if (map[y * FARM_W + x] === T.shore) props.push({ y, draw: () => place(P, rock(500 + i, 6, 4), x, y, { shadow: false }) });
  }
  // 农舍、谷仓
  const houseInfo = house(P, lights),
    barnInfo = barn(P, lights);
  // 围栏
  fenceWood(P, 62, 150, 150, 3);
  fenceWood(P, 178, 236, 150, 4);
  fenceWood(P, 240, 322, 28, 5);
  fenceWood(P, 476, 640, 26, 6);
  fenceScrap(P, 6, 120, 392, 7);
  fenceScrap(P, 186, 268, 392, 8);
  fenceWood(P, 300, 420, 396, 9);
  fenceScrap(P, 652, 740, 452, 10);
  // 大件装饰（按脚底 y 排序后再画）
  const add = (y, fn) => props.push({ y, draw: fn });
  // 电线杆和电线
  const poleSpr = pole(),
    poles = [[22, 189], [146, 189], [300, 189], [540, 189], [652, 189]];
  for (const [x, y] of poles) add(y, () => place(P, poleSpr, x, y, { shadowW: 4, shadowH: 1.5 }));
  // 车
  add(206, () => place(P, car(11), 54, 206, { shadowW: 18, shadowH: 3 }));
  add(126, () => place(P, car(12), 620, 126, { shadowW: 18, shadowH: 3, flip: true }));
  add(474, () => place(P, billboard(), 380, 474, { shadowW: 20, shadowH: 3 }));
  add(122, () => place(P, drums(21, 3), 314, 122));
  add(116, () => place(P, drums(22, 2), 450, 116));
  add(338, () => place(P, tires(5), 112, 338));
  add(122, () => place(P, hay(1), 418, 132));
  add(132, () => place(P, hay(2), 432, 140));
  add(122, () => place(P, woodpile(), 452, 132));
  // 树
  const treeSpots = [];
  const r = rng(2026);
  const band = (x0, x1, y0, y1, n, kinds) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + r() * (x1 - x0),
        y = y0 + r() * (y1 - y0);
      if (near(x, y, 30) || Math.abs(x - LAYOUT.track.cx) < 26) continue;
      if (x > 466 && x < 512 && y > 420 && y < 456) continue;
      const t = map[Math.floor(Math.min(511, y)) * FARM_W + Math.floor(x)];
      if (t === T.water || t === T.road || t === T.track || t === T.field || t === T.path) continue;
      if (inRect(x, y, LAYOUT.canal, 10) || inRect(x, y, LAYOUT.eco, 10)) continue;
      const pd = Math.min(((x - LAYOUT.pond.cx) / LAYOUT.pond.rx) ** 2 + ((y - LAYOUT.pond.cy) / LAYOUT.pond.ry) ** 2, ((x - LAYOUT.pond.cx) / LAYOUT.pond.rx) ** 2 + ((y - 26 - LAYOUT.pond.cy) / LAYOUT.pond.ry) ** 2);
      if (pd < 2.1 || inRect(x, y, LAYOUT.house, 14) || inRect(x, y, LAYOUT.barn, 14) || streamDist(x, y) < 14) continue;
      const k = r(),
        kind = k < kinds[0] ? "live" : k < kinds[0] + kinds[1] ? "autumn" : "dead";
      treeSpots.push([x, y, kind, 0.6 + r() * 0.8]);
    }
  };
  band(0, 760, 452, 520, 34, [0.5, 0.25]);
  band(0, 300, 400, 452, 10, [0.55, 0.2]);
  band(600, 768, 400, 452, 7, [0.5, 0.25]);
  band(0, 46, 190, 400, 9, [0.5, 0.25]);
  band(244, 324, 0, 22, 4, [0.6, 0.3]);
  band(470, 730, 0, 20, 10, [0.5, 0.3]);
  band(560, 738, 30, 120, 6, [0.45, 0.25]);
  band(752, 768, 0, 300, 4, [0.6, 0.3]);
  band(0, 60, 0, 30, 3, [0.6, 0.2]);
  band(0, 40, 40, 140, 3, [0.5, 0.2]);
  for (const [i, [x, y, kind, s]] of treeSpots.entries()) {
    const spr = tree(900 + i, kind, s);
    add(y, () => place(P, spr, x, y, { shadowW: spr.w * 0.36, shadowH: 3, shadowDx: 4 }));
  }
  // 石头与灌木
  for (let i = 0; i < 46; i++) {
    const x = r() * 768,
      y = r() * 512,
      t = map[Math.floor(y) * FARM_W + Math.floor(x)];
    if (t !== T.grass && t !== T.scorch) continue;
    if (near(x, y, 22) || inRect(x, y, LAYOUT.house, 6) || inRect(x, y, LAYOUT.barn, 6) || inRect(x, y, LAYOUT.canal, 6) || inRect(x, y, LAYOUT.eco, 6)) continue;
    if (x > 460 && x < 740 && y > 186 && y < 330 && r() < 0.7) continue;
    const k = r();
    if (k < 0.45) add(y, () => place(P, rock(200 + i, 8 + Math.floor(r() * 8), 5 + Math.floor(r() * 4)), x, y, { shadowW: 5, shadowH: 1.5 }));
    else add(y, () => place(P, bush(300 + i, 4 + Math.floor(r() * 4), r() > 0.6 ? PAL.ember[3] : r() > 0.5 ? PAL.cloth[5] : null), x, y, { shadowW: 5, shadowH: 1.5 }));
  }
  props.sort((a, b) => a.y - b.y).forEach((p) => p.draw());
  // 电线：杆顶之间垂下来
  for (let i = 0; i + 1 < poles.length; i++) {
    const [ax, ay] = poles[i],
      [bx] = poles[i + 1];
    if (i === 2) continue; // 断了一根
    for (const dy of [-42, -41]) {
      for (let x = ax + 1; x < bx; x++) {
        const t = (x - ax) / (bx - ax),
          y = ay + dy + 4 + Math.sin(t * Math.PI) * 7;
        P.set(x, Math.round(y), OUTLINE, 0.7);
      }
    }
  }
  // 断掉的电线垂到地上
  P.line(301, 149, 312, 176, OUTLINE, 0.7);
  P.line(312, 176, 318, 186, OUTLINE, 0.5);
  // 火星和余烬位置（夜里会发光）
  const embers = [];
  for (const [ax, ay, ar] of ASH) for (let i = 0; i < Math.round(ar / 4); i++) embers.push({ x: ax + (hash2(i, ax, 1) - 0.5) * ar, y: ay + (hash2(i, ay, 2) - 0.5) * ar * 0.6 });
  return {
    pix: P,
    canvas: P.toCanvas(),
    map,
    lights,
    embers,
    chimney: houseInfo.chimney,
    windmill: barnInfo.windmill,
    water: (x, y) => {
      const t = map[Math.max(0, Math.min(FARM_H - 1, Math.floor(y))) * FARM_W + Math.max(0, Math.min(FARM_W - 1, Math.floor(x)))];
      return t === T.water;
    },
    surface: (x, y) => map[Math.max(0, Math.min(FARM_H - 1, Math.floor(y))) * FARM_W + Math.max(0, Math.min(FARM_W - 1, Math.floor(x)))],
    T,
  };
}

// 下雨时路面会积水：只在公路、土路、小路上，返回水洼位置（美术像素）
export function puddleSpots(map) {
  const out = [],
    r = rng(808);
  for (let i = 0; i < 900 && out.length < 34; i++) {
    const x = Math.floor(r() * FARM_W),
      y = Math.floor(r() * FARM_H),
      t = map[y * FARM_W + x];
    if (t !== T.road && t !== T.track && t !== T.path) continue;
    if (out.some((p) => Math.hypot(p.x - x, p.y - y) < 20)) continue;
    out.push({ x, y, rx: 4 + Math.floor(r() * 6), ry: 2 + Math.floor(r() * 2), seed: i });
  }
  return out;
}
