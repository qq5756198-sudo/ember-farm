// v0.31.0「重光」：地铁隧道一层的底图（新画面）。布局来自 tunnel-gen.js，和引擎里的墙一格一格对得上；
// 在后台线程里画（bakeMap("tunnel:种子:层:日子:大吉")），画好的样子和别的地图一样：画布、地面种类、灯。
import { PAL, dither, fbm, hash2, mix } from "./pixel-kit.js";
import { Scene, S, ground, RAMP, dr, MAP_W, MAP_H } from "./pixel-build.js";
import * as T from "./pixel-things.js";
import { tunnelLayout, parseTunnelKey, G, COLS, ROWS } from "./tunnel-gen.js";

const CELL = 32; // 一格在美术像素里的大小（地图上是 64）

function bunk(P, x, y) {
  P.rect(x - 7, y - 12, 15, 12, PAL.ash[2]);
  P.rect(x - 6, y - 11, 13, 3, PAL.cloth[4]);
  P.rect(x - 6, y - 5, 13, 3, PAL.cloth[3]);
  P.vline(x - 7, y - 14, y, PAL.stone[2]);
  P.vline(x + 7, y - 14, y, PAL.stone[2]);
  P.hline(x - 7, x + 7, y, PAL.ash[0], 0.6);
}
function locker(P, x, y) {
  P.rect(x, y - 16, 9, 16, PAL.stone[2]);
  P.vline(x + 4, y - 16, y - 1, PAL.stone[1]);
  P.rect(x + 1, y - 14, 2, 1, PAL.stone[4]);
  P.rect(x + 6, y - 14, 2, 1, PAL.stone[4]);
  P.hline(x, x + 8, y, PAL.ash[0], 0.6);
}
function hazard(P, x0, y0, w, h) {
  for (let y = y0; y < y0 + h; y++) for (let x = x0; x < x0 + w; x++) P.set(x, y, ((x + y) >> 2) % 2 ? PAL.ember[4] : PAL.ash[1]);
}
function signBoard(P, x, y, w, col) {
  P.rect(x, y, w, 7, col);
  P.hline(x, x + w - 1, y, mix(col, "#ffffff", 0.25));
  for (let k = 3; k < w - 3; k += 4) P.rect(x + k, y + 3, 2, 2, PAL.snow[4]);
}

export function tunnelArt(key) {
  const k = parseTunnelKey(key);
  if (!k) return null;
  const L = tunnelLayout(k.seed, k.floor, k.day, k.luck),
    g = L.grid,
    f = L.floor;
  const sc = new Scene(1000 + f * 97 + (k.seed % 997), []);
  const P = sc.P;
  // 越往下越暗：整张图压一点亮度
  const dim = Math.min(0.32, 0.01 * f);
  const cell = (x, y) => {
    const c = Math.floor(x / CELL),
      r = Math.floor(y / CELL);
    return c < 0 || r < 0 || c >= COLS || r >= ROWS ? G.wall : g[r * COLS + c];
  };
  const tone = (t) => Math.max(0.02, t - dim);
  const roomFloor = L.theme === "shelter" ? (x, y) => ground.planks(x, y, false, RAMP.wood) : L.theme === "store" || L.theme === "pump" ? (x, y) => ground.concrete(x, y, 16) : (x, y) => ground.floor(x, y);
  for (let y = 0; y < MAP_H; y++)
    for (let x = 0; x < MAP_W; x++) {
      const v = cell(x, y);
      let c,
        code = S.floor;
      if (v === G.wall) {
        // 岩壁和水泥墙：下面挨着能走的地方画一道墙面（有管子），其余是暗的岩体
        const below = cell(x, y + 12) !== G.wall && cell(x, y) === G.wall && Math.floor((y + 12) / CELL) !== Math.floor(y / CELL);
        if (below) {
          const yy = y % CELL;
          c = yy > CELL - 4 ? PAL.ash[0] : dither("stone", tone(0.36 + fbm(x * 0.07, y * 0.07, 61, 2) * 0.12 - (yy > CELL - 8 ? 0.1 : 0)), x, y);
        } else c = dither("ash", tone(0.22 + fbm(x * 0.06, y * 0.06, 62, 2) * 0.32 + (hash2(Math.floor(x / 16), Math.floor(y / 16), 63) - 0.5) * 0.08), x, y);
        code = S.roof;
      } else if (v === G.track) {
        const yy = y - 7 * CELL;
        c = ground.gravel(x, y);
        // 枕木和两条钢轨
        if (yy > 14 && yy < 50 && x % 8 < 3) c = dr(RAMP.wood, tone(0.3), x, y);
        if (yy === 20 || yy === 21 || yy === 43 || yy === 44) c = yy % 2 ? PAL.stone[4] : PAL.stone[3];
        code = S.rail;
      } else if (v === G.platform) {
        c = ground.tiles(x, y, 8, RAMP.light, tone(0.45));
      } else if (v === G.hall) c = dither("stone", tone(0.3 + fbm(x * 0.05, y * 0.05, 64, 2) * 0.12 + ((x >> 3) + (y >> 3)) % 2 * 0.03), x, y);
      else c = roomFloor(x, y);
      if (v !== G.wall && dim > 0.05 && hash2(x, y, 65) < dim * 0.6) c = mix(c, PAL.ash[0], 0.35);
      P.set(x, y, c);
      sc.map[y * MAP_W + x] = code;
    }
  // 能走的地方和岩壁交界处描一道暗边（左右、上边）
  for (let y = 1; y < MAP_H - 1; y++)
    for (let x = 1; x < MAP_W - 1; x++) {
      if (cell(x, y) === G.wall) continue;
      if (cell(x - 1, y) === G.wall || cell(x + 1, y) === G.wall) P.set(x, y, PAL.ash[1]);
      else if (cell(x - 2, y) === G.wall || cell(x + 2, y) === G.wall) P.shade(x, y, 0.7, "#18130f");
      if (cell(x, y - 1) === G.wall) P.shade(x, y, 0.6, "#18130f");
    }
  // 站台边的黄线
  if (L.theme === "platform") {
    const y = L.platformUp ? 7 * CELL - 2 : 9 * CELL + 1;
    for (let x = 3 * CELL; x < 21 * CELL; x++) P.set(x, y, (x >> 2) % 2 ? PAL.ember[4] : PAL.straw[4]);
    for (let x = 4 * CELL; x < 20 * CELL; x += 5 * CELL) at(sc, L.platformUp ? 6 * CELL : 10 * CELL, () => T.bench(P, x, L.platformUp ? 6 * CELL + 8 : 10 * CELL + 20));
    signBoard(P, 9 * CELL, L.platformUp ? 5 * CELL + 4 : 10 * CELL + 20, 40, PAL.night[2]);
  }
  // 墙面上的管子
  for (let r = 1; r < ROWS - 1; r++)
    for (let c = 1; c < COLS - 1; c++) {
      if (g[r * COLS + c] !== G.wall || g[(r + 1) * COLS + c] === G.wall) continue;
      if (hash2(c, r, 66) < 0.5) T.pipeRun(P, c * CELL, c * CELL + CELL - 1, r * CELL + 20, hash2(c, r, 67) < 0.5 ? RAMP.rust : RAMP.grey);
    }
  // 通道口的黑黄斜纹
  for (const room of L.rooms) {
    const y = room.top ? (room.r0 + room.h) * CELL : room.r0 * CELL - 3;
    hazard(P, room.door * CELL, y, CELL * 2, 3);
  }
  // 房间里的摆设（不挡路，只是样子）
  for (const room of L.rooms) {
    const x0 = room.c0 * CELL,
      y0 = room.r0 * CELL,
      w = room.w * CELL,
      h = room.h * CELL;
    const R = (n) => hash2(room.c0 * 7 + n, room.r0 * 13, 70 + f);
    if (L.theme === "shelter") {
      for (let i = 0; i < Math.min(3, room.w - 1); i++) at(sc, y0 + 16, () => bunk(P, x0 + 14 + i * 26, y0 + 18));
    } else if (L.theme === "store" || L.theme === "pump") {
      at(sc, y0 + h - 6, () => T.drumsAt(P, x0 + 8, y0 + h - 6, 2 + Math.floor(R(1) * 2)));
      if (room.w >= 4) at(sc, y0 + 20, () => T.tank(P, x0 + w - 18, y0 + 28, 8, 18, RAMP.grey));
    } else {
      for (let i = 0; i < Math.min(4, room.w); i++) if (R(i) < 0.5) at(sc, y0 + 16, () => locker(P, x0 + 4 + i * 12, y0 + 18));
      if (R(9) < 0.6) at(sc, y0 + h - 4, () => T.drumsAt(P, x0 + w - 24, y0 + h - 4, 2));
    }
    // 地上的污渍和纸
    for (let i = 0; i < 6; i++) {
      const x = x0 + Math.floor(R(20 + i) * w),
        y = y0 + Math.floor(R(30 + i) * h);
      if (cell(x, y) === G.wall) continue;
      if (i % 3 === 0) P.rect(x, y, 3, 2, PAL.snow[3]);
      else P.shade(x, y, 0.75, "#18130f");
    }
  }
  // 泵房：大泵
  if (L.pump && L.rooms.length) {
    const room = L.rooms[0];
    at(sc, (room.r0 + room.h) * CELL - 4, () => T.tank(P, room.c0 * CELL + 20, (room.r0 + room.h) * CELL - 6, 12, 24, RAMP.rust));
  }
  sc.flushProps();
  for (const l of L.lights) sc.lights.push({ ...l });
  return sc.done({ variant: "tunnel", indoor: true, floor: f, theme: L.theme });
}
function at(sc, y, draw) {
  sc.add(y, draw);
}
