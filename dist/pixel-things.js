// 地图上的小道具：长椅、垃圾桶、消防栓、车、帐篷、沙袋、货摊……（美术像素，x,y 是脚底位置）
import { PAL, OUTLINE, Pix, hash2, dither, rng, mix, fbm } from "./pixel-kit.js";
import { RAMP, dr } from "./pixel-build.js";
import { place, sprite, tree, bush, car } from "./pixel-farm.js";

const pick = (R, list) => list[Math.floor(R() * list.length) % list.length];

export function bench(P, x, y, flip = false) {
  P.shadowEllipse(x + 2, y, 8, 1.5);
  P.rect(x - 7, y - 5, 15, 2, PAL.soil[3]);
  P.hline(x - 7, x + 7, y - 5, PAL.soil[4]);
  P.rect(x - 7, y - 9, 15, 2, PAL.soil[2]);
  P.hline(x - 7, x + 7, y - 9, PAL.soil[3]);
  for (const dx of [-6, 6]) P.vline(x + dx, y - 9, y, PAL.ash[2]);
  P.hline(x - 7, x + 7, y - 3, OUTLINE, 0.5);
}
export function bin(P, x, y, tipped = false) {
  P.shadowEllipse(x + 2, y, 4, 1.2);
  if (tipped) {
    P.rect(x - 5, y - 5, 9, 5, PAL.stone[2]);
    P.ellipse(x + 4, y - 3, 1.5, 2.5, PAL.ash[0]);
    for (let k = 0; k < 4; k++) P.set(x + 6 + k, y - 1 + (k % 2), pick(rng(x + k), [PAL.cloth[5], PAL.straw[3], PAL.stone[4]]));
    return;
  }
  P.rect(x - 3, y - 8, 7, 8, PAL.stone[2]);
  P.vline(x - 3, y - 8, y - 1, PAL.stone[3]);
  P.vline(x + 3, y - 8, y - 1, PAL.stone[1]);
  P.hline(x - 4, x + 4, y - 9, PAL.stone[3]);
  P.hline(x - 3, x + 3, y - 10, PAL.stone[4]);
}
export function dumpster(P, x, y, col = RAMP.teal) {
  P.shadowEllipse(x + 3, y, 12, 2);
  P.rect(x - 11, y - 11, 22, 11, col[2]);
  P.rect(x - 11, y - 11, 22, 2, col[3]);
  for (let i = x - 9; i < x + 10; i += 4) P.vline(i, y - 8, y - 2, col[1]);
  P.rect(x - 12, y - 13, 24, 2, col[1]);
  P.hline(x - 12, x + 11, y - 13, col[3]);
  P.vline(x - 11, y - 11, y - 1, OUTLINE);
  P.vline(x + 10, y - 11, y - 1, OUTLINE);
  P.hline(x - 11, x + 10, y - 1, OUTLINE);
  for (let k = 0; k < 5; k++) P.set(x - 8 + k * 4, y - 14, pick(rng(x * 7 + k), [PAL.cloth[5], PAL.straw[3], PAL.ash[3]]));
}
export function hydrant(P, x, y) {
  P.shadowEllipse(x + 1, y, 3, 1);
  P.rect(x - 2, y - 6, 4, 6, PAL.cloth[1]);
  P.rect(x - 3, y - 4, 6, 2, PAL.cloth[1]);
  P.hline(x - 2, x + 1, y - 7, PAL.cloth[2]);
  P.vline(x - 2, y - 6, y - 1, PAL.cloth[2]);
  P.hline(x - 2, x + 1, y, OUTLINE, 0.6);
}
export function mailbox(P, x, y) {
  P.vline(x, y - 7, y, PAL.soil[1]);
  P.rect(x - 3, y - 11, 7, 4, PAL.night[2]);
  P.hline(x - 3, x + 3, y - 11, PAL.night[3]);
  P.set(x + 4, y - 10, PAL.cloth[2]);
}
export function cone(P, x, y) {
  P.rect(x - 2, y - 1, 5, 1, PAL.ember[1]);
  P.vline(x, y - 6, y - 1, PAL.ember[3]);
  P.vline(x - 1, y - 4, y - 1, PAL.ember[3]);
  P.vline(x + 1, y - 4, y - 1, PAL.ember[2]);
  P.set(x, y - 3, PAL.stone[5]);
}
export function trafficLight(sc, x, y, broken = true) {
  const P = sc.P;
  P.shadowEllipse(x + 3, y, 3, 1);
  P.vline(x, y - 26, y, PAL.ash[2]);
  P.vline(x + 1, y - 26, y, PAL.ash[1]);
  P.rect(x - 2, y - 34, 6, 12, PAL.ash[1]);
  P.rect(x - 1, y - 33, 4, 10, PAL.ash[0]);
  P.set(x, y - 31, broken ? PAL.ash[2] : PAL.cloth[1]);
  P.set(x, y - 28, broken ? PAL.ash[2] : PAL.ember[4]);
  P.set(x, y - 25, broken ? PAL.ash[2] : PAL.leaf[4]);
  if (!broken) sc.lights.push({ x, y: y - 31, kind: "beacon", color: [255, 80, 60] });
}
export function signPost(P, x, y, col = PAL.night[2]) {
  P.vline(x, y - 14, y, PAL.stone[2]);
  P.rect(x - 4, y - 18, 9, 5, col);
  P.hline(x - 4, x + 4, y - 18, mix(col, PAL.snow[4], 0.3));
  P.hline(x - 2, x + 2, y - 16, PAL.stone[5]);
}
export function planter(P, x, y, R = rng(x * 31 + y)) {
  P.shadowEllipse(x + 2, y, 6, 1.5);
  P.rect(x - 5, y - 5, 11, 5, PAL.stone[3]);
  P.hline(x - 5, x + 5, y - 5, PAL.stone[4]);
  for (let k = 0; k < 6; k++) {
    const px = x - 4 + k * 2;
    P.set(px, y - 6, PAL.leaf[3]);
    P.set(px, y - 7 - (k % 2), PAL.leaf[4]);
    if (R() < 0.4) P.set(px, y - 8, pick(R, [PAL.cloth[2], PAL.ember[4], PAL.cloth[5]]));
  }
}
// 人行道上的树坑和树
export function treePit(sc, x, y, seed, kind = "live", size = 0.6) {
  const P = sc.P;
  P.rect(x - 4, y - 2, 9, 5, PAL.soil[1]);
  P.rect(x - 3, y - 1, 7, 3, PAL.soil[2]);
  for (let k = 0; k < 4; k++) P.set(x - 3 + k * 2, y - 1, PAL.leaf[3]);
  place(P, tree(seed, kind, size), x, y + 1, { shadowW: 8, shadowH: 2.5, shadowDx: 4 });
}
export function umbrellaTable(P, x, y, col = [PAL.cloth[1], PAL.cloth[5]]) {
  P.shadowEllipse(x + 3, y, 10, 2);
  P.rect(x - 4, y - 5, 9, 2, PAL.soil[3]);
  P.vline(x - 3, y - 3, y, PAL.soil[1]);
  P.vline(x + 3, y - 3, y, PAL.soil[1]);
  P.vline(x, y - 16, y - 5, PAL.stone[2]);
  for (let i = -9; i <= 9; i++) {
    const h = Math.round(3 - Math.abs(i) * 0.3);
    for (let j = 0; j < h + 1; j++) P.set(x + i, y - 17 + j + Math.round(Math.abs(i) * 0.25), Math.floor((i + 9) / 3) % 2 ? col[0] : col[1]);
  }
  for (const dx of [-7, 7]) {
    P.rect(x + dx - 1, y - 4, 3, 2, PAL.soil[2]);
    P.vline(x + dx, y - 2, y, PAL.soil[1]);
  }
}
export function sandbags(P, x, y, w = 20) {
  P.shadowEllipse(x + w / 2 + 2, y, w / 2 + 2, 2);
  for (let row = 0; row < 3; row++)
    for (let i = 0; i + 5 <= w - row * 2; i += 5) {
      const bx = x + row * 2 + i + (row % 2 ? 2 : 0),
        by = y - 3 - row * 3;
      if (bx + 5 > x + w) continue;
      P.ellipse(bx + 2, by + 1, 2.6, 1.6, PAL.straw[1]);
      P.hline(bx, bx + 4, by, PAL.straw[2]);
      P.set(bx + 4, by + 2, PAL.straw[0]);
    }
}
export function barricade(P, x, y, w = 18) {
  // 木头叉子路障
  P.shadowEllipse(x + w / 2 + 2, y, w / 2 + 1, 1.5);
  for (let k = 0; k < w; k += 9) {
    P.line(x + k, y, x + k + 7, y - 8, PAL.soil[2]);
    P.line(x + k + 7, y, x + k, y - 8, PAL.soil[3]);
  }
  P.hline(x, x + w, y - 5, PAL.soil[1]);
  P.hline(x, x + w, y - 4, PAL.soil[3]);
}
export function tires(P, x, y) {
  P.shadowEllipse(x + 2, y, 6, 1.5);
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3]]) {
    P.ellipse(x + dx, y - 2 + dy, 3.5, 2.2, PAL.ash[1]);
    P.ellipse(x + dx, y - 2 + dy, 1.5, 0.8, PAL.ash[0]);
    P.set(x + dx - 1, y - 4 + dy, PAL.ash[3]);
  }
}
export function sacks(P, x, y, n = 3, col = PAL.straw) {
  P.shadowEllipse(x + 3, y, n * 3 + 2, 1.5);
  for (let k = 0; k < n; k++) {
    const sx = x - n * 2 + k * 4,
      sy = y - (k % 2) * 2;
    P.ellipse(sx + 2, sy - 3, 2.5, 3, col[1]);
    P.set(sx + 1, sy - 5, col[2]);
    P.hline(sx + 1, sx + 3, sy - 6, col[0]);
  }
}
export function cart(P, x, y, goods = [PAL.leaf[4], PAL.cloth[2], PAL.ember[3]]) {
  P.shadowEllipse(x + 3, y, 10, 2);
  P.rect(x - 9, y - 9, 16, 6, PAL.soil[2]);
  P.hline(x - 9, x + 6, y - 9, PAL.soil[3]);
  for (let k = 0; k < 6; k++) P.disc(x - 7 + k * 2.5, y - 10, 1.4, goods[k % goods.length]);
  P.disc(x - 4, y - 2, 2.2, PAL.ash[1]);
  P.set(x - 4, y - 2, PAL.stone[3]);
  P.line(x + 7, y - 7, x + 12, y - 4, PAL.soil[1]);
}
export function crate(P, x, y, w = 9, h = 7, col = RAMP.wood) {
  P.rect(x, y - h, w, h, col[2]);
  P.hline(x, x + w - 1, y - h, col[3]);
  P.line(x, y - h + 1, x + w - 1, y - 1, col[1]);
  P.vline(x + w - 1, y - h, y - 1, col[1]);
  P.hline(x, x + w - 1, y - 1, OUTLINE, 0.5);
}
export function crates(P, x, y, n = 3, R = rng(x + y * 7)) {
  P.shadowEllipse(x + 4, y, 9, 2);
  const spots = [[-8, 0], [1, 0], [-4, -7], [5, -7], [-8, -7]];
  for (let k = 0; k < n && k < spots.length; k++) crate(P, x + spots[k][0], y + spots[k][1], 9, 7, R() > 0.7 ? RAMP.grey : RAMP.wood);
}
export function pallets(P, x, y, n = 3) {
  P.shadowEllipse(x + 8, y, 9, 1.5);
  for (let k = 0; k < n; k++) {
    P.rect(x, y - 2 - k * 2, 16, 2, k % 2 ? PAL.straw[1] : PAL.straw[0]);
    for (let i = 0; i < 16; i += 5) P.set(x + i, y - 1 - k * 2, PAL.soil[1]);
  }
}
export function drum(P, x, y, col = RAMP.rust) {
  P.rect(x - 3, y - 9, 7, 9, col[1]);
  P.vline(x - 3, y - 9, y - 1, col[2]);
  P.vline(x + 3, y - 9, y - 1, col[0]);
  P.hline(x - 3, x + 3, y - 5, col[0]);
  P.ellipse(x, y - 9, 3.4, 1.4, col[2]);
  P.ellipse(x, y - 9, 2, 0.6, col[0]);
  P.hline(x - 3, x + 3, y, OUTLINE, 0.5);
}
export function drumsAt(P, x, y, n = 3, R = rng(x * 3 + y)) {
  P.shadowEllipse(x + n * 3, y, n * 4 + 1, 1.5);
  for (let k = 0; k < n; k++) drum(P, x + k * 7 + (k % 2), y - (k % 2), R() > 0.4 ? RAMP.rust : R() > 0.5 ? RAMP.teal : RAMP.ember);
}
// 车：生锈的轿车（pixel-farm 的）、救护车、货车、叉车、公交
export function vehicle(kind, seed = 1) {
  const r = rng(seed);
  if (kind === "car") return car(seed);
  if (kind === "forklift")
    return sprite(20, 20, (P) => {
      P.rect(4, 6, 10, 9, PAL.ember[4]);
      P.rect(5, 2, 7, 5, PAL.ash[1]);
      P.rect(6, 3, 5, 3, PAL.water[1]);
      P.vline(15, 0, 16, PAL.stone[2]);
      P.vline(17, 0, 16, PAL.stone[2]);
      P.hline(15, 19, 16, PAL.stone[3]);
      for (const x of [5, 11]) P.rect(x, 15, 3, 3, PAL.ash[0]);
      P.rect(4, 9, 10, 1, PAL.ember[2]);
      P.outline(OUTLINE);
    });
  if (kind === "bus")
    return sprite(70, 26, (P) => {
      P.rect(2, 4, 66, 18, PAL.ember[3]);
      P.rect(2, 4, 66, 2, PAL.ember[4]);
      for (let x = 6; x < 60; x += 9) {
        P.rect(x, 8, 7, 6, PAL.water[0]);
        P.set(x + 1, 9, PAL.water[3]);
      }
      P.rect(60, 8, 7, 10, PAL.water[1]);
      P.rect(2, 15, 66, 2, PAL.cloth[3]);
      for (let i = 0; i < 30; i++) P.set(3 + Math.floor(r() * 64), 5 + Math.floor(r() * 16), PAL.rust[2]);
      for (const x of [10, 52]) {
        P.rect(x, 21, 7, 4, PAL.ash[0]);
        P.rect(x + 1, 21, 5, 1, PAL.ash[3]);
      }
      P.outline(OUTLINE);
    });
  if (kind === "truck")
    return sprite(56, 28, (P) => {
      P.rect(2, 2, 38, 20, PAL.stone[3]);
      P.rect(2, 2, 38, 2, PAL.stone[4]);
      for (let x = 4; x < 40; x += 4) P.vline(x, 4, 21, PAL.stone[2]);
      P.rect(41, 8, 13, 14, PAL.cloth[1]);
      P.rect(44, 10, 9, 5, PAL.water[1]);
      P.set(45, 11, PAL.water[4]);
      for (let i = 0; i < 16; i++) P.set(2 + Math.floor(r() * 50), 3 + Math.floor(r() * 18), PAL.rust[2]);
      for (const x of [6, 26, 44]) {
        P.rect(x, 21, 6, 5, PAL.ash[0]);
        P.rect(x + 1, 21, 4, 1, PAL.ash[3]);
      }
      P.outline(OUTLINE);
    });
  return sprite(42, 22, (P) => {
    const body = kind === "ambulance" ? [PAL.stone[3], PAL.stone[4], PAL.stone[5]] : kind === "police" ? [PAL.night[1], PAL.night[2], PAL.stone[5]] : [PAL.cloth[3], PAL.cloth[4], PAL.stone[3]];
    P.rect(2, 4, 38, 14, body[1]);
    P.rect(2, 4, 38, 2, body[2]);
    P.rect(28, 7, 11, 6, PAL.water[1]);
    P.rect(29, 8, 3, 2, PAL.water[4]);
    if (kind === "ambulance") {
      P.rect(2, 11, 26, 2, PAL.cloth[1]);
      P.rect(12, 6, 2, 5, PAL.cloth[1]);
      P.rect(10, 8, 6, 2, PAL.cloth[1]);
      P.rect(30, 3, 4, 2, PAL.water[4]);
      P.rect(34, 3, 3, 2, PAL.cloth[2]);
    } else {
      for (let i = 0; i < 10; i++) P.set(3 + Math.floor(r() * 24), 6 + Math.floor(r() * 10), PAL.rust[2]);
    }
    for (const x of [7, 31]) {
      P.rect(x, 17, 6, 3, PAL.ash[0]);
      P.rect(x + 1, 17, 4, 1, PAL.ash[3]);
    }
    P.hline(2, 39, 18, body[0]);
    P.outline(OUTLINE);
  });
}
export function placeVehicle(P, kind, x, y, seed = 1, flip = false) {
  const S = vehicle(kind, seed);
  place(P, S, x, y, { shadowW: S.w / 2, shadowH: 3, flip });
}
// 担架、输液架
export function stretcher(P, x, y) {
  P.shadowEllipse(x + 2, y, 9, 1.5);
  P.rect(x - 9, y - 6, 18, 4, PAL.stone[5]);
  P.hline(x - 9, x + 8, y - 6, PAL.stone[4]);
  P.rect(x - 9, y - 6, 4, 3, PAL.cloth[5]);
  for (const dx of [-8, 7]) P.vline(x + dx, y - 2, y, PAL.stone[2]);
}
export function ivStand(P, x, y) {
  P.vline(x, y - 16, y, PAL.stone[3]);
  P.hline(x - 3, x + 3, y, PAL.stone[2]);
  P.rect(x - 3, y - 16, 3, 5, mix(PAL.water[5], PAL.stone[5], 0.5));
  P.hline(x - 3, x + 3, y - 16, PAL.stone[3]);
}
export function barrier(P, x, y, w = 18, cols = [PAL.ember[4], PAL.stone[5]]) {
  P.shadowEllipse(x + w / 2 + 2, y, w / 2, 1.5);
  for (let i = 0; i < w; i++) {
    P.set(x + i, y - 6, Math.floor(i / 3) % 2 ? cols[0] : cols[1]);
    P.set(x + i, y - 5, Math.floor(i / 3) % 2 ? cols[0] : cols[1]);
  }
  for (const dx of [1, w - 2]) {
    P.vline(x + dx, y - 6, y, PAL.stone[2]);
    P.hline(x + dx - 1, x + dx + 1, y, PAL.stone[1]);
  }
}
export function laundry(P, x0, x1, y) {
  for (const x of [x0, x1]) {
    P.vline(x, y - 14, y, PAL.soil[2]);
    P.set(x, y + 1, OUTLINE);
  }
  for (let x = x0; x <= x1; x++) P.set(x, y - 13 + Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 2), PAL.ash[3]);
  const cols = [PAL.cloth[1], PAL.cloth[5], PAL.cloth[4], PAL.straw[3], PAL.leaf[4]];
  for (let x = x0 + 3, k = 0; x < x1 - 4; x += 7, k++) {
    const sag = Math.round(Math.sin(((x - x0) / (x1 - x0)) * Math.PI) * 2);
    P.rect(x, y - 12 + sag, 5, 6 + (k % 2), cols[k % cols.length]);
    P.hline(x, x + 4, y - 7 + sag + (k % 2), OUTLINE, 0.4);
  }
}
export function stringLights(sc, x0, y0, x1, y1, color = [255, 196, 120], every = 5) {
  const P = sc.P,
    n = Math.max(8, Math.round(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i++) {
    const t = i / n,
      x = Math.round(x0 + (x1 - x0) * t),
      y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * 5);
    P.set(x, y, OUTLINE, 0.6);
    if (i % every === 2) {
      P.set(x, y + 1, PAL.ember[4]);
      if (i % (every * 2) === 2) sc.lights.push({ x, y: y + 1, kind: "bulb", color });
    }
  }
}
export function pole(P, x, y, h = 26) {
  P.shadowEllipse(x + 2, y, 2, 1);
  P.vline(x, y - h, y, PAL.soil[1]);
  P.vline(x + 1, y - h, y, PAL.soil[2]);
  P.hline(x - 3, x + 4, y - h + 3, PAL.soil[1]);
}
export function rubble(P, x, y, seed, w = 16) {
  const R = rng(seed);
  P.shadowEllipse(x + 2, y, w / 2 + 1, 2);
  for (let k = 0; k < w / 2 + 2; k++) {
    const bx = x - w / 2 + R() * w,
      by = y - 1 - R() * 5,
      col = R() > 0.5 ? PAL.stone : PAL.rust;
    P.rect(bx, by, 3 + Math.floor(R() * 3), 2 + Math.floor(R() * 2), col[2]);
    P.set(bx, by, col[3] || col[2]);
  }
  P.line(x - 6, y - 4, x + 5, y - 7, PAL.rust[1]);
}
export function gardenBed(P, x, y, w, h, R = rng(x * 17 + y), dead = false) {
  P.rect(x - 1, y - 1, w + 2, h + 2, PAL.soil[2]);
  P.hline(x - 1, x + w, y - 1, PAL.soil[3]);
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const row = j % 4;
      let c = row === 3 ? PAL.soil[0] : PAL.soil[1];
      if (row === 1 && i % 3 !== 2 && R() > (dead ? 0.7 : 0.25)) c = dead ? pick(R, [PAL.straw[0], PAL.soil[3], PAL.straw[1]]) : pick(R, [PAL.leaf[3], PAL.leaf[4], PAL.leaf[2]]);
      if (row === 0 && i % 3 === 1 && R() > 0.6) c = dead ? PAL.straw[1] : PAL.leaf[5];
      P.set(x + i, y + j, c);
    }
}
export function shed(P, x, y, w = 18, h = 16, R = rng(x)) {
  // 小棚子（院子里）
  P.shadowEllipse(x + w / 2 + 3, y, w / 2 + 2, 2);
  P.rect(x, y - h + 6, w, h - 6, PAL.soil[2]);
  for (let i = x; i < x + w; i += 3) P.vline(i, y - h + 6, y - 1, PAL.soil[1]);
  P.poly([[x - 2, y - h + 7], [x + 1, y - h], [x + w - 1, y - h], [x + w + 2, y - h + 7]], R() > 0.5 ? PAL.rust[2] : PAL.stone[2]);
  P.hline(x - 2, x + w + 1, y - h + 7, OUTLINE, 0.7);
  P.rect(x + Math.floor(w / 2) - 2, y - 7, 5, 7, PAL.soil[0]);
  P.vline(x, y - h + 6, y - 1, OUTLINE, 0.7);
  P.vline(x + w - 1, y - h + 6, y - 1, OUTLINE, 0.7);
}
export function swing(P, x, y) {
  P.line(x - 10, y, x - 7, y - 16, PAL.cloth[1]);
  P.line(x - 4, y, x - 7, y - 16, PAL.cloth[1]);
  P.line(x + 10, y, x + 7, y - 16, PAL.cloth[1]);
  P.line(x + 4, y, x + 7, y - 16, PAL.cloth[1]);
  P.hline(x - 7, x + 7, y - 16, PAL.cloth[2]);
  for (const sx of [-3, 3]) {
    P.vline(x + sx - 1, y - 15, y - 5, PAL.stone[3]);
    P.vline(x + sx + 1, y - 15, y - 5, PAL.stone[3]);
    P.hline(x + sx - 1, x + sx + 1, y - 4, PAL.soil[2]);
  }
}
export function slide(P, x, y) {
  P.rect(x - 8, y - 16, 2, 16, PAL.cloth[4]);
  P.rect(x - 3, y - 16, 2, 16, PAL.cloth[4]);
  for (let k = y - 14; k < y; k += 3) P.hline(x - 8, x - 1, k, PAL.cloth[3]);
  P.rect(x - 9, y - 18, 10, 2, PAL.cloth[1]);
  for (let k = 0; k < 14; k++) {
    P.set(x + k, y - 17 + k, PAL.ember[4]);
    P.set(x + k, y - 16 + k, PAL.ember[3]);
  }
}
export function doghouse(P, x, y) {
  P.shadowEllipse(x + 3, y, 7, 1.5);
  P.rect(x - 5, y - 7, 11, 7, PAL.soil[2]);
  P.poly([[x - 7, y - 6], [x, y - 12], [x + 7, y - 6]], PAL.cloth[1]);
  P.ellipse(x, y - 3, 2, 3, PAL.ash[0]);
}
export function wheelbarrow(P, x, y) {
  P.shadowEllipse(x + 2, y, 7, 1.5);
  P.poly([[x - 6, y - 6], [x + 5, y - 6], [x + 3, y - 2], [x - 4, y - 2]], PAL.leaf[2]);
  P.disc(x - 5, y - 1, 1.6, PAL.ash[1]);
  P.line(x + 5, y - 5, x + 10, y - 3, PAL.soil[2]);
}
export function hoseReel(P, x, y) {
  P.disc(x, y - 3, 3, PAL.leaf[3]);
  P.disc(x, y - 3, 1.4, PAL.leaf[1]);
  P.line(x + 3, y - 2, x + 9, y, PAL.leaf[3]);
}
export function bicycle(P, x, y) {
  P.ellipse(x - 5, y - 3, 3, 3, PAL.ash[1]);
  P.ellipse(x + 5, y - 3, 3, 3, PAL.ash[1]);
  P.ellipse(x - 5, y - 3, 1.6, 1.6, PAL.ash[0]);
  P.ellipse(x + 5, y - 3, 1.6, 1.6, PAL.ash[0]);
  P.line(x - 5, y - 3, x, y - 7, PAL.cloth[1]);
  P.line(x, y - 7, x + 5, y - 3, PAL.cloth[1]);
  P.line(x - 2, y - 7, x + 3, y - 7, PAL.cloth[1]);
  P.set(x - 2, y - 8, PAL.ash[1]);
  P.set(x + 4, y - 9, PAL.stone[3]);
}
export function waterTower(P, x, y, R = rng(x)) {
  P.shadowEllipse(x + 6, y, 10, 2.5, 0.6);
  for (const lx of [x - 7, x + 7]) {
    P.vline(lx, y - 30, y, PAL.rust[1]);
    P.vline(lx + 1, y - 30, y, PAL.rust[2]);
  }
  P.line(x - 7, y - 26, x + 8, y - 6, PAL.rust[1]);
  P.line(x + 8, y - 26, x - 7, y - 6, PAL.rust[1]);
  P.rect(x - 10, y - 48, 21, 18, PAL.stone[3]);
  for (let i = x - 10; i <= x + 10; i += 3) P.vline(i, y - 48, y - 31, PAL.stone[2]);
  P.ellipse(x, y - 48, 10.5, 3, PAL.stone[4]);
  P.ellipse(x, y - 48, 7, 1.5, PAL.stone[2]);
  P.vline(x + 11, y - 46, y - 31, OUTLINE);
  for (let k = 0; k < 8; k++) P.set(x - 9 + Math.floor(R() * 19), y - 46 + Math.floor(R() * 14), PAL.rust[2]);
}
export function tank(P, x, y, r = 12, h = 26, col = RAMP.light) {
  // 大储罐（工厂）
  P.shadowEllipse(x + r / 2 + 3, y, r + 3, 3, 0.58);
  for (let j = 0; j < h; j++)
    for (let i = -r; i <= r; i++) {
      const t = 0.75 - ((i + r) / (2 * r)) * 0.55 + (Math.abs(i) > r - 2 ? -0.12 : 0);
      P.set(x + i, y - j - 2, dr(col, t, x + i, y - j));
    }
  for (let j = 4; j < h; j += 7) P.hline(x - r, x + r, y - j - 2, dr(col, 0.2, x, j));
  P.ellipse(x, y - h - 2, r, r * 0.3, col[col.length - 1]);
  P.ellipse(x, y - h - 2, r - 3, r * 0.2, col[2]);
  for (let k = 0; k < h; k += 2) P.set(x + r - 3, y - h + k, PAL.stone[2]);
  P.vline(x - r - 1, y - h - 2, y - 2, OUTLINE, 0.8);
  P.vline(x + r + 1, y - h - 2, y - 2, OUTLINE, 0.8);
  P.ellipse(x, y - 2, r, r * 0.25, mix(col[0], OUTLINE, 0.3), 0.6);
}
export function smokestack(sc, x, y, h = 70) {
  const P = sc.P;
  for (let j = 0; j < h; j++) {
    const w = 5 + Math.round((j / h) * 3);
    for (let i = -w; i <= w; i++) P.set(x + i, y - j, i < -w + 2 ? PAL.rust[2] : i > w - 2 ? PAL.rust[0] : (j % 6 === 0 ? PAL.rust[0] : PAL.rust[1]));
    if (j % 12 < 3 && j > h - 18) for (let i = -w; i <= w; i++) P.set(x + i, y - j, (i + j) % 4 < 2 ? PAL.stone[5] : PAL.cloth[1]);
  }
  P.rect(x - 7, y - h - 2, 15, 3, PAL.ash[1]);
  P.vline(x + 9, y - h, y, OUTLINE, 0.6);
  sc.chimneys.push({ x, y: y - h - 3, big: true });
  sc.lights.push({ x, y: y - h - 4, kind: "beacon", color: [255, 70, 60] });
}
export function antennaMast(sc, x, y, h = 60) {
  const P = sc.P;
  P.shadowEllipse(x + 4, y, 6, 1.5);
  for (let j = 0; j < h; j++) {
    const w = Math.max(1, Math.round(5 * (1 - j / h)));
    P.set(x - w, y - j, PAL.stone[2]);
    P.set(x + w, y - j, PAL.stone[1]);
    if (j % 6 === 0) P.hline(x - w, x + w, y - j, PAL.stone[2]);
    if (j % 6 === 3) P.line(x - w, y - j, x + w, y - j - 3, PAL.stone[1]);
  }
  P.set(x, y - h - 1, PAL.cloth[2]);
  sc.lights.push({ x, y: y - h - 1, kind: "beacon", color: [255, 80, 70] });
}
export function crane(P, x, y, h = 70, reach = 60, col = RAMP.ember) {
  // 龙门/塔吊：竖杆 + 横臂 + 吊钩
  for (let j = 0; j < h; j++) {
    P.set(x - 2, y - j, col[3]);
    P.set(x + 2, y - j, col[2]);
    if (j % 6 === 0) P.hline(x - 2, x + 2, y - j, col[3]);
    if (j % 6 === 3) P.line(x - 2, y - j, x + 2, y - j - 3, col[1]);
  }
  for (let i = -12; i <= reach; i++) {
    P.set(x + i, y - h, col[3]);
    P.set(x + i, y - h + 3, col[2]);
    if (i % 5 === 0) P.line(x + i, y - h, x + i + 3, y - h + 3, col[1]);
  }
  P.rect(x - 14, y - h - 2, 7, 7, PAL.stone[2]);
  P.vline(x + reach - 6, y - h + 3, y - h + 26, PAL.stone[1]);
  P.rect(x + reach - 8, y - h + 26, 5, 3, PAL.stone[3]);
  P.rect(x - 5, y - h - 4, 7, 4, col[2]);
}
export function boat(P, x, y, w = 40, col = RAMP.light, wreck = false) {
  P.shadowEllipse(x + 3, y + 1, w / 2 + 2, 2.5, 0.55);
  P.poly([[x - w / 2, y - 8], [x + w / 2, y - 8], [x + w / 2 - 6, y], [x - w / 2 + 4, y]], col[2]);
  P.hline(x - w / 2, x + w / 2, y - 8, col[4] || col[3]);
  P.hline(x - w / 2 + 4, x + w / 2 - 6, y - 1, mix(col[0], OUTLINE, 0.3));
  P.hline(x - w / 2 + 2, x + w / 2 - 2, y - 5, PAL.cloth[1]);
  if (!wreck) {
    P.rect(x - 6, y - 15, 14, 7, PAL.stone[4]);
    P.rect(x - 4, y - 13, 4, 3, PAL.water[1]);
    P.rect(x + 2, y - 13, 4, 3, PAL.water[1]);
  } else {
    for (let k = 0; k < 10; k++) P.set(x - w / 2 + 3 + Math.floor(hash2(k, x, 3) * (w - 6)), y - 7 + Math.floor(hash2(k, y, 4) * 6), PAL.rust[2]);
    P.poly([[x + 4, y - 8], [x + 12, y - 8], [x + 9, y - 3]], PAL.ash[0]);
  }
}
export function lifebuoy(P, x, y) {
  P.disc(x, y, 3, PAL.cloth[2]);
  P.disc(x, y, 1.2, PAL.ash[1]);
  P.set(x - 3, y, PAL.stone[5]);
  P.set(x + 3, y, PAL.stone[5]);
}
export function bollard(P, x, y) {
  P.rect(x - 1, y - 4, 3, 4, PAL.ash[2]);
  P.hline(x - 2, x + 2, y - 4, PAL.ash[3]);
}
export function pipeRun(P, x0, x1, y, col = RAMP.grey) {
  for (let x = x0; x <= x1; x++) {
    P.set(x, y - 3, col[3]);
    P.set(x, y - 2, col[2]);
    P.set(x, y - 1, col[1]);
    if ((x - x0) % 14 === 0) {
      P.rect(x, y - 4, 2, 5, col[1]);
      P.vline(x, y, y + 3, col[0]);
    }
  }
  for (let x = x0; x <= x1; x++) P.shade(x, y + 1, 0.7, "#18130f");
}
export function lampPost(sc, x, y, color = [255, 214, 140], broken = false, tall = 26) {
  const P = sc.P;
  P.shadowEllipse(x + 2, y, 3, 1);
  P.vline(x, y - tall, y, PAL.ash[2]);
  P.vline(x + 1, y - tall, y, PAL.ash[1]);
  P.rect(x - 2, y - tall - 3, 6, 3, PAL.ash[1]);
  P.rect(x - 1, y - tall, 4, 1, broken ? PAL.ash[0] : PAL.straw[4]);
  P.rect(x - 1, y, 4, 1, PAL.ash[1]);
  if (!broken) sc.lamp(x + 1, y - tall + 1, color);
}
export function bush2(P, x, y, seed, r = 5, flowers = null) {
  place(P, bush(seed, r, flowers), x, y, { shadowW: r, shadowH: 1.5 });
}
export function treeAt(P, x, y, seed, kind = "live", size = 0.8) {
  place(P, tree(seed, kind, size), x, y, { shadowW: 8 + size * 4, shadowH: 3, shadowDx: 4 });
}
export function grassPatch(sc, r, seed, dry = 0.3) {
  // 疯长的草丛（隐蔽用的地方）：底色加高草
  const R = rng(seed),
    P = sc.P;
  for (let y = Math.floor(r.y - 3); y < r.y + r.h + 3; y++)
    for (let x = Math.floor(r.x - 3); x < r.x + r.w + 3; x++) {
      const n = (fbm(x * 0.2, y * 0.2, seed, 2) - 0.5) * 6;
      if (x < r.x + n || x >= r.x + r.w - n || y < r.y + n || y >= r.y + r.h - n) continue;
      P.set(x, y, dither("leaf", 0.22 + hash2(x, y, seed) * 0.32, x, y));
    }
  for (let i = 0; i < (r.w * r.h) / 9; i++) {
    const x = r.x + R() * r.w,
      y = r.y + R() * r.h,
      h = 3 + Math.floor(R() * 5),
      isDry = R() < dry;
    for (let k = 0; k < h; k++) P.set(x + (k > h / 2 ? (R() > 0.5 ? 1 : 0) : 0), y - k, k === h - 1 ? (isDry ? PAL.straw[3] : PAL.leaf[5]) : isDry ? PAL.straw[1] : PAL.leaf[3]);
  }
}
