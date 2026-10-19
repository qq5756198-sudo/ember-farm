// v0.36.0「巨影」：前五凶的样子（河伯、收破烂的和他的三轮、〇号、黑瞎子、白毛风）、孢囊、铁桶、地上冲上来的东西。
// 都用代码画，只用调色板里的颜色，一个美术像素在地图上占 2×2；光从左上来；画一次存起来。
// 每一凶朝右画，朝左时整张翻过来；姿势（pose）和帧（frame）不同的分开存。
import { PAL, OUTLINE, Pix, cached, dither, rng, mix } from "./pixel-kit.js";

const canvasOf = (P) => P.toCanvas();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- 画法 ----------
// 一团带明暗的椭圆：光从左上来，边上暗
function blob(P, cx, cy, rx, ry, ramp, base = 0.55, spread = 0.38, rim = 0.12) {
  for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++)
    for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) {
      const nx = x / (rx + 0.3),
        ny = y / (ry + 0.3),
        r2 = nx * nx + ny * ny;
      if (r2 > 1) continue;
      const t = base + (-nx * 0.6 - ny * 0.8) * spread - r2 * rim;
      P.set(cx + x, cy + y, dither(ramp, clamp(t, 0.02, 0.98), cx + x, cy + y));
    }
}
// 一根粗细渐变的肢体（胶囊），按离中线的远近上明暗
function limb(P, x0, y0, x1, y1, w0, w1, ramp, base = 0.5, spread = 0.3) {
  const minX = Math.floor(Math.min(x0, x1) - Math.max(w0, w1) - 1),
    maxX = Math.ceil(Math.max(x0, x1) + Math.max(w0, w1) + 1),
    minY = Math.floor(Math.min(y0, y1) - Math.max(w0, w1) - 1),
    maxY = Math.ceil(Math.max(y0, y1) + Math.max(w0, w1) + 1),
    vx = x1 - x0,
    vy = y1 - y0,
    L = vx * vx + vy * vy || 1,
    len = Math.sqrt(L),
    nx = -vy / len,
    ny = vx / len;
  for (let y = minY; y <= maxY; y++)
    for (let x = minX; x <= maxX; x++) {
      const t = clamp(((x - x0) * vx + (y - y0) * vy) / L, 0, 1),
        px = x0 + vx * t,
        py = y0 + vy * t,
        w = w0 + (w1 - w0) * t,
        dx = x - px,
        dy = y - py,
        d = Math.hypot(dx, dy);
      if (d > w) continue;
      // 朝左上的一面亮
      const side = (dx * nx + dy * ny) / Math.max(1, w),
        lit = -(dx * 0.6 + dy * 0.8) / Math.max(1, w);
      P.set(x, y, dither(ramp, clamp(base + lit * spread - Math.abs(side) * 0.05, 0.02, 0.98), x, y));
    }
}
function spots(P, seed, n, x0, y0, w, h, colors, onlyOpaque = true) {
  const r = rng(seed);
  for (let i = 0; i < n; i++) {
    const x = Math.round(x0 + r() * w),
      y = Math.round(y0 + r() * h);
    if (onlyOpaque && !P.opaque(x, y)) continue;
    P.set(x, y, colors[Math.floor(r() * colors.length) % colors.length]);
  }
}
const eye = (P, x, y, c = PAL.ember[5], glow = PAL.ember[3]) => {
  P.set(x, y, c);
  P.set(x + 1, y, glow);
};

// ================= 河伯：一坨泥里长出来的上半身 =================
// pose：up（站着）、sweep（抡胳膊）、beached（搁浅趴着）、rise（刚冒出来）
export const HEBO_W = 76,
  HEBO_H = 86;
export function heboSprite(pose = "up", frame = 0) {
  return cached(`thebo:${pose}:${frame}`, () => {
    const P = new Pix(HEBO_W, HEBO_H),
      bob = [0, 1, 0, -1][frame % 4],
      beached = pose === "beached",
      base = 80;
    // 泥堆：底下一大坨，水草挂着
    blob(P, 38, base - 6, 34, 9, "soil", 0.42, 0.3);
    blob(P, 30, base - 10, 18, 7, "soil", 0.5, 0.3);
    blob(P, 50, base - 9, 16, 6, "soil", 0.38, 0.3);
    for (let i = 0; i < 9; i++) {
      const x = 8 + i * 7 + (i % 2),
        h = 6 + ((i * 5) % 7);
      P.line(x, base - 4, x + (i % 3) - 1, base - 4 - h, PAL.leaf[2 + (i % 3)]);
    }
    if (beached) {
      // 搁浅：身子扑在泥上，胳膊摊开
      blob(P, 40, base - 18, 22, 11, "leaf", 0.32, 0.35);
      blob(P, 44, base - 22, 15, 8, "stone", 0.45, 0.35);
      limb(P, 22, base - 16, 6, base - 8, 5, 4, "stone", 0.42);
      limb(P, 58, base - 16, 72, base - 6, 5, 4, "stone", 0.36);
      blob(P, 26, base - 24, 9, 7, "stone", 0.5, 0.3);
      eye(P, 22, base - 25, PAL.straw[4], PAL.straw[3]);
      P.hline(20, 26, base - 21, OUTLINE);
      spots(P, 41, 40, 10, base - 34, 60, 26, [PAL.leaf[1], PAL.soil[1], PAL.water[2]]);
      P.outline(OUTLINE);
      return canvasOf(P);
    }
    const lift = pose === "rise" ? 4 : 0,
      top = 14 + bob - lift;
    // 身子：鼓胀的灰绿色上半身，往前探
    blob(P, 38, top + 30, 20, 22, "stone", 0.42, 0.42);
    blob(P, 36, top + 26, 16, 16, "leaf", 0.4, 0.38);
    // 肋骨和鳃：脖子两边几道红口子
    for (let i = 0; i < 3; i++) {
      P.line(26 + i * 2, top + 14 + i * 3, 30 + i * 2, top + 13 + i * 3, PAL.cloth[0]);
      P.line(44 - i, top + 14 + i * 3, 48 - i, top + 13 + i * 3, PAL.cloth[0]);
    }
    for (let i = 0; i < 4; i++) P.hline(30, 44, top + 30 + i * 4, PAL.stone[1]);
    // 胳膊：长得拖到地上
    const sweep = pose === "sweep";
    if (sweep) {
      limb(P, 22, top + 18, 4, top + 22, 5, 4, "stone", 0.5);
      limb(P, 4, top + 22, 2, top + 34, 4, 3, "stone", 0.48);
      limb(P, 54, top + 18, 72, top + 10, 5, 4, "stone", 0.4);
      for (let i = 0; i < 3; i++) P.line(72, top + 10, 75, top + 6 + i * 3, PAL.stone[4]);
    } else {
      limb(P, 22, top + 18, 12, top + 40 + bob, 5, 4, "stone", 0.48);
      limb(P, 12, top + 40 + bob, 10, base - 10, 4, 3, "stone", 0.45);
      limb(P, 54, top + 18, 64, top + 38 - bob, 5, 4, "stone", 0.38);
      limb(P, 64, top + 38 - bob, 66, base - 12, 4, 3, "stone", 0.35);
      for (let i = 0; i < 3; i++) P.line(10 + i * 2, base - 10, 8 + i * 3, base - 6, PAL.stone[4]);
    }
    // 头：垂着，头发里全是水草，嘴张着
    blob(P, 38, top + 8, 10, 9, "stone", 0.5, 0.35);
    for (let i = 0; i < 9; i++) P.line(29 + i * 2, top + 1 + (i % 2), 27 + i * 2 + (i % 3), top + 12 + ((i * 3) % 6), PAL.leaf[1 + (i % 3)]);
    eye(P, 34, top + 8, PAL.straw[4], PAL.straw[3]);
    eye(P, 41, top + 8, PAL.straw[4], PAL.straw[3]);
    P.rect(35, top + 12, 6, 3, OUTLINE);
    P.set(37, top + 13, PAL.cloth[0]);
    // 身上挂的水草、往下滴的泥水
    for (let i = 0; i < 7; i++) P.line(24 + i * 5, top + 22 + (i % 2) * 6, 23 + i * 5 + (i % 2), top + 32 + ((i * 4) % 9), PAL.leaf[2 + (i % 2)]);
    spots(P, 17 + frame, 50, 16, top + 6, 46, 50, [PAL.leaf[1], PAL.soil[1], PAL.water[3], PAL.water[2]]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}

// ================= 收破烂的：瘦高的人，裹着破大衣，蒙着眼 =================
// pose：walk、rush（往前扑）、gong（举着锅）、stun（撞晕了）、swing（抡三轮）
export const SCRAP_W = 56,
  SCRAP_H = 94;
export function scrapSprite(pose = "walk", frame = 0) {
  return cached(`tscrap:${pose}:${frame}`, () => {
    const P = new Pix(SCRAP_W, SCRAP_H),
      feet = 92,
      step = [0, 1, 0, -1][frame % 4],
      rush = pose === "rush",
      lean = rush ? 8 : pose === "stun" ? -3 : 3,
      top = 10 + (rush ? 6 : 0);
    // 腿：细长，裤腿破了
    limb(P, 24, feet - 34, 20 - step * 3, feet - 2, 4, 3, "night", 0.4);
    limb(P, 30, feet - 34, 34 + step * 3, feet - 2, 4, 3, "night", 0.32);
    P.rect(17 - step * 3, feet - 3, 8, 3, PAL.ash[1]);
    P.rect(31 + step * 3, feet - 3, 8, 3, PAL.ash[1]);
    // 破大衣：一直拖到膝盖
    P.poly(
      [
        [16 + lean, top + 18],
        [40 + lean, top + 18],
        [44, feet - 26],
        [38, feet - 20],
        [33, feet - 25],
        [27, feet - 19],
        [21, feet - 25],
        [12, feet - 22],
      ],
      PAL.soil[2],
    );
    for (let y = top + 18; y < feet - 18; y++)
      for (let x = 10; x < 46; x++) if (P.opaque(x, y)) P.set(x, y, dither("soil", 0.62 - (x - 10) / 60 - (y - top) / 180, x, y));
    P.line(28 + lean, top + 20, 29, feet - 22, PAL.soil[0]);
    spots(P, 99, 30, 12, top + 20, 32, 50, [PAL.soil[0], PAL.ash[2], PAL.rust[1]]);
    // 背上的麻袋：鼓鼓囊囊，口上露出一截棍子和一个瓶颈
    P.line(10 + lean, top + 16, 5 + lean, top + 4, PAL.soil[3]);
    P.line(11 + lean, top + 16, 6 + lean, top + 4, PAL.soil[2]);
    P.rect(15 + lean, top + 8, 2, 6, PAL.water[3]);
    blob(P, 12 + lean, top + 24, 9, 12, "straw", 0.34, 0.36);
    P.rect(8 + lean, top + 26, 5, 4, PAL.cloth[3]);
    P.hline(6 + lean, 18 + lean, top + 14, PAL.soil[1]);
    P.line(18 + lean, top + 15, 30 + lean, top + 19, PAL.soil[1]);
    spots(P, 313, 12, 4 + lean, top + 14, 16, 20, [PAL.straw[0], PAL.soil[2]]);
    // 肩膀拱起来，脖子往前伸
    blob(P, 28 + lean, top + 18, 13, 7, "soil", 0.5, 0.3);
    // 胳膊：一只往前伸着摸（又细又长，指头像钩子），一只拽着车把（gong 时两只举锅）
    const hand = (x, y, dir = 1) => {
      for (let i = 0; i < 3; i++) P.line(x, y, x + dir * 3, y + 2 + i * 2, PAL.stone[3]);
      P.set(x + dir * 3, y + 7, PAL.stone[4]);
    };
    if (pose === "gong") {
      limb(P, 18 + lean, top + 18, 12, top + 2, 3, 3, "soil", 0.55);
      limb(P, 38 + lean, top + 18, 44, top + 2, 3, 3, "soil", 0.45);
      blob(P, 28, top - 2, 14, 5, "stone", 0.4, 0.35);
      P.hline(15, 41, top - 2, PAL.stone[4]);
      P.ellipse(28, top - 1, 5, 2, PAL.ash[1]);
    } else if (rush) {
      limb(P, 36 + lean, top + 20, 52, top + 22, 3, 2, "soil", 0.5);
      hand(52, top + 21);
      limb(P, 20 + lean, top + 20, 49, top + 30, 3, 2, "soil", 0.42);
      hand(49, top + 29);
    } else {
      limb(P, 36 + lean, top + 20, 44, top + 30 + step, 3, 3, "soil", 0.5);
      limb(P, 44, top + 30 + step, 50, top + 44 + step, 2, 2, "stone", 0.4);
      hand(50, top + 44 + step);
      limb(P, 20 + lean, top + 20, 18, top + 44 - step, 3, 2, "soil", 0.42);
      hand(18, top + 44 - step, -1);
    }
    // 头：瘦长，脸发青，一圈脏布条蒙着眼，几绺灰头发往后耷拉
    const hx = 30 + lean + (rush ? 4 : 0),
      hy = top + 6 + (pose === "stun" ? 2 : 0);
    blob(P, hx, hy, 7, 8, "stone", 0.58, 0.32);
    for (let y = hy - 8; y <= hy + 8; y++) for (let x = hx - 8; x <= hx + 8; x++) P.shade(x, y, 0.8, PAL.leaf[2]);
    P.vline(hx + 3, hy + 1, hy + 4, PAL.stone[1]);
    P.rect(hx - 7, hy - 2, 15, 4, PAL.snow[1]);
    P.hline(hx - 7, hx + 7, hy - 2, PAL.snow[3]);
    P.line(hx - 7, hy + 1, hx - 9, hy + 6, PAL.snow[1]);
    spots(P, 7, 8, hx - 7, hy - 2, 14, 4, [PAL.soil[2], PAL.rust[1]]);
    P.rect(hx - 2, hy + 4, 5, 2, OUTLINE);
    P.set(hx - 1, hy + 4, PAL.snow[3]);
    P.set(hx + 1, hy + 4, PAL.snow[3]);
    P.hline(hx - 5, hx + 3, hy - 8, PAL.ash[3]);
    for (let i = 0; i < 6; i++) P.line(hx - 4 + i, hy - 8, hx - 8 + i - (i % 2), hy - 3 + (i % 3) * 3, i % 2 ? PAL.ash[4] : PAL.ash[3]);
    if (pose === "stun") {
      for (const [x, y] of [[hx - 10, hy - 12], [hx + 8, hy - 13], [hx, hy - 15]]) {
        P.set(x, y, PAL.straw[4]);
        P.set(x + 1, y, PAL.straw[3]);
      }
    }
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
// 三轮车：车斗里堆满破烂，车把上一个铃铛
export const CART_W = 44,
  CART_H = 30;
export function cartSprite(frame = 0) {
  return cached(`tcart:${frame}`, () => {
    const P = new Pix(CART_W, CART_H),
      r = rng(4711);
    // 车斗
    P.rect(4, 12, 30, 10, PAL.rust[1]);
    P.hline(4, 33, 12, PAL.rust[3]);
    P.hline(4, 33, 21, PAL.rust[0]);
    // 堆着的破烂：纸板、瓶子、罐头
    for (let i = 0; i < 26; i++) {
      const x = 5 + Math.floor(r() * 28),
        y = 4 + Math.floor(r() * 9),
        c = [PAL.straw[1], PAL.soil[3], PAL.stone[3], PAL.water[3], PAL.cloth[1], PAL.leaf[3]][i % 6];
      P.rect(x, y, 2 + (i % 3), 2 + (i % 2), c);
    }
    P.rect(8, 2, 9, 4, PAL.straw[2]);
    P.rect(22, 1, 3, 6, PAL.water[4]);
    P.set(23, 0, PAL.water[5]);
    // 车把、铃铛
    P.line(34, 14, 42, 8, PAL.ash[2]);
    P.rect(40, 5, 3, 3, PAL.straw[3]);
    P.set(41, 4, PAL.straw[4]);
    // 轮子
    const spin = frame % 2;
    for (const cx of [10, 30]) {
      P.ellipse(cx, 24, 5, 5, PAL.ash[0]);
      P.ellipse(cx, 24, 3, 3, PAL.stone[2]);
      P.set(cx + (spin ? 1 : -1), 23, PAL.stone[4]);
    }
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}

// ================= 〇号：苍白、瘦长，肩上背上鼓着半透明的囊，胳膊上挂着输液管 =================
// pose：walk、lash（举手甩管子）、crouch（要扑）、fly（扑在半空）；shell：长了硬壳的那几类（颜色）
export const ZERO_W = 60,
  ZERO_H = 88;
const SHELL = { blunt: "stone", blade: "night", pole: "snow", ranged: "rust", fire: "ash", other: "straw" };
export function zeroSprite(pose = "walk", frame = 0, shells = "") {
  return cached(`tzero:${pose}:${frame}:${shells}`, () => {
    const P = new Pix(ZERO_W, ZERO_H),
      feet = 86,
      step = [0, 1, 0, -1][frame % 4],
      crouch = pose === "crouch" ? 10 : pose === "fly" ? -6 : 0,
      top = 8 + crouch;
    // 腿：细长，膝盖往后弯
    limb(P, 26, feet - 36 + crouch, 22 - step * 2, feet - 18 + crouch / 2, 3, 3, "snow", 0.5);
    limb(P, 22 - step * 2, feet - 18 + crouch / 2, 25 - step * 3, feet - 1, 3, 2, "snow", 0.45);
    limb(P, 34, feet - 36 + crouch, 38 + step * 2, feet - 18 + crouch / 2, 3, 3, "snow", 0.38);
    limb(P, 38 + step * 2, feet - 18 + crouch / 2, 36 + step * 3, feet - 1, 3, 2, "snow", 0.34);
    // 身子：病号服的布条挂在身上
    blob(P, 30, top + 34, 11, 18, "snow", 0.5, 0.4);
    P.poly([[20, top + 26], [40, top + 26], [42, top + 46], [36, top + 44], [31, top + 50], [24, top + 45], [18, top + 48]], PAL.water[4]);
    for (let y = top + 26; y < top + 51; y++) for (let x = 17; x < 44; x++) if (P.get(x, y)?.[0] === 0x6f) P.set(x, y, dither("water", 0.75 - (x - 17) / 70, x, y));
    P.vline(30, top + 27, top + 47, PAL.water[3]);
    // 背上、肩上的囊：发绿、半透明，一鼓一鼓
    const swell = frame % 2;
    blob(P, 19, top + 20, 7 + swell, 6 + swell, "leaf", 0.75, 0.25);
    blob(P, 43, top + 18, 8 + swell, 7 + swell, "leaf", 0.72, 0.25);
    blob(P, 33, top + 14, 5, 4, "leaf", 0.8, 0.2);
    for (const [x, y] of [[17, top + 18], [41, top + 16], [32, top + 13]]) P.set(x, y, PAL.leaf[5]);
    // 胳膊：长到膝盖，手指又细又长，挂着输液管
    const lash = pose === "lash";
    const arm = (sx, sy, ex, ey, base) => {
      limb(P, sx, sy, ex, ey, 3, 2, "snow", base);
      for (let i = 0; i < 3; i++) P.line(ex, ey, ex + (ex > sx ? 3 : -3), ey + 2 + i * 2, PAL.snow[4]);
    };
    if (lash) {
      arm(20, top + 24, 6, top + 4, 0.55);
      arm(40, top + 24, 54, top + 4, 0.45);
      for (const [x0, y0, x1, y1] of [[6, top + 4, 1, top + 18], [54, top + 4, 59, top + 20], [6, top + 4, 2, top - 2]]) P.line(x0, y0, x1, y1, PAL.straw[3]);
    } else {
      arm(20, top + 24, 12, top + 50 + step, 0.55);
      arm(40, top + 24, 48, top + 50 - step, 0.45);
      P.line(12, top + 52 + step, 9, top + 66, PAL.straw[3]);
      P.line(48, top + 52 - step, 52, top + 70, PAL.straw[3]);
      P.set(9, top + 67, PAL.water[4]);
      P.set(52, top + 71, PAL.water[4]);
    }
    // 手腕上的标签
    P.rect(lash ? 4 : 11, lash ? top + 7 : top + 46, 3, 2, PAL.snow[4]);
    // 头：拉长的，没有脸，只有一道竖着的口子
    blob(P, 30, top + 6, 7, 9, "snow", 0.62, 0.3);
    P.vline(30, top + 3, top + 11, PAL.cloth[0]);
    P.vline(31, top + 4, top + 10, OUTLINE);
    P.set(27, top + 4, PAL.leaf[5]);
    P.set(34, top + 4, PAL.leaf[5]);
    // 长了硬壳：对应颜色的甲片
    const list = shells ? shells.split(",") : [];
    list.forEach((k, i) => {
      const ramp = SHELL[k] || "stone",
        cx = [24, 36, 30][i % 3],
        cy = [top + 30, top + 36, top + 44][i % 3];
      blob(P, cx, cy, 6, 4, ramp, 0.45, 0.4);
      P.hline(cx - 5, cx + 5, cy - 3, PAL[ramp][PAL[ramp].length - 1]);
    });
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
// 孢囊：地上鼓起来的一个绿泡，要炸的时候发亮
export function podSprite(swell = 0) {
  const k = Math.round(clamp(swell, 0, 1) * 3);
  return cached(`tpod:${k}`, () => {
    const P = new Pix(20, 18),
      r = 5 + k;
    blob(P, 10, 16 - r, r + 1, r, "leaf", 0.62 + k * 0.08, 0.3);
    P.set(8, 14 - r, PAL.leaf[5]);
    for (let i = 0; i < 4; i++) P.line(10 - r + i * 3, 17, 9 - r + i * 3, 13, PAL.leaf[1]);
    if (k >= 2) for (const [x, y] of [[7, 12], [12, 10], [10, 14]]) P.set(x, y, PAL.straw[4]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}

// ================= 黑瞎子：一头四条腿着地的大黑熊，秃了的地方露出骨板；左后腿上夹着生锈的夹子 =================
// pose：walk、charge（低头冲）、swipe（抬爪）、stand（立起来吼、砸）、stun（晕）
export const BEAR_W = 108,
  BEAR_H = 104;
export function bearSprite(pose = "walk", frame = 0) {
  return cached(`tbear:${pose}:${frame}`, () => {
    const P = new Pix(BEAR_W, BEAR_H),
      feet = 102;
    if (pose === "stand") return canvasOf(bearStand(P, feet, frame));
    const step = [0, 1, 0, -1][frame % 4],
      charge = pose === "charge",
      low = charge ? 4 : 0,
      top = feet - 62 + low;
    // 后腿、前腿（远的一侧先画，暗一点）
    const leg = (x, y, len, ph, base, trap = false) => {
      const dx = ph * 4;
      limb(P, x, y, x + dx, y + len, 8, 6, "ash", base);
      P.rect(x + dx - 7, y + len - 2, 14, 4, PAL.ash[0]);
      for (let i = 0; i < 3; i++) P.set(x + dx + 4 + i * 2, y + len + 1, PAL.stone[4]);
      if (trap) {
        P.rect(x + dx - 9, y + len - 12, 18, 5, PAL.rust[1]);
        for (let i = 0; i < 5; i++) P.set(x + dx - 8 + i * 4, y + len - 13, PAL.rust[3]);
        P.hline(x + dx - 9, x + dx + 8, y + len - 8, PAL.rust[0]);
      }
    };
    leg(30, top + 30, 28, -step, 0.25);
    leg(78, top + 28, 30, step, 0.22);
    // 身子：一座黑山，背上拱起一个包
    blob(P, 52, top + 28, 40, 20, "ash", 0.45, 0.42);
    blob(P, 44, top + 16, 24, 14, "ash", 0.55, 0.4);
    // 秃了的地方：骨板
    for (const [cx, cy, rx, ry] of [[40, top + 12, 7, 4], [56, top + 18, 6, 4], [70, top + 24, 5, 3], [30, top + 26, 5, 3]]) {
      blob(P, cx, cy, rx, ry, "stone", 0.62, 0.35);
      P.hline(cx - rx + 1, cx + rx - 1, cy + ry - 1, PAL.stone[1]);
    }
    // 毛：一绺一绺
    const r = rng(6060 + frame);
    for (let i = 0; i < 60; i++) {
      const x = 14 + Math.floor(r() * 76),
        y = top + 6 + Math.floor(r() * 40);
      if (P.opaque(x, y) && P.opaque(x, y + 2)) P.line(x, y, x + 1, y + 2, r() > 0.5 ? PAL.ash[3] : PAL.night[1]);
    }
    leg(24, top + 32, 26, step, 0.42, true);
    leg(74, top + 30, 28, -step, 0.4);
    // 头：大，低着；耳朵、湿鼻子、一道疤划过绿光的眼睛
    const hx = 88 + (charge ? 2 : 0),
      hy = top + 28 + (charge ? 8 : 0);
    blob(P, hx - 9, hy - 11, 4.5, 4.5, "ash", 0.5, 0.3);
    blob(P, hx + 3, hy - 12, 4.5, 4.5, "ash", 0.45, 0.3);
    P.set(hx - 9, hy - 11, PAL.soil[2]);
    P.set(hx + 3, hy - 12, PAL.soil[2]);
    blob(P, hx, hy, 15, 12, "ash", 0.52, 0.4);
    blob(P, hx + 11, hy + 5, 8, 6, "soil", 0.5, 0.35);
    P.hline(hx - 2, hx + 7, hy - 5, PAL.ash[0]);
    P.rect(hx + 4, hy - 3, 2, 2, PAL.leaf[5]);
    P.set(hx + 6, hy - 3, PAL.leaf[4]);
    P.line(hx + 1, hy - 7, hx + 8, hy + 1, PAL.cloth[0]);
    P.rect(hx + 17, hy + 2, 2, 2, OUTLINE);
    P.rect(hx + 11, hy + 8, 7, 3, OUTLINE);
    for (let i = 0; i < 4; i++) P.set(hx + 11 + i * 2, hy + 8, PAL.snow[4]);
    if (pose === "swipe") {
      // 抬起一只前爪，爪子张开
      limb(P, 78, top + 30, 96, top + 6, 7, 8, "ash", 0.5);
      blob(P, 97, top + 4, 6, 5, "ash", 0.55, 0.3);
      for (let i = 0; i < 4; i++) P.line(100, top + 1 + i * 3, 106, top - 2 + i * 4, PAL.snow[3]);
    }
    if (pose === "stun") for (const [x, y] of [[hx - 6, hy - 22], [hx + 8, hy - 24], [hx + 1, hy - 28]]) P.rect(x, y, 2, 2, PAL.straw[4]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
// 立起来：两只前爪举过头
function bearStand(P, feet, frame) {
  const sway = frame % 2;
  limb(P, 42, feet - 34, 38, feet - 2, 9, 7, "ash", 0.3);
  limb(P, 64, feet - 34, 68, feet - 2, 9, 7, "ash", 0.28);
  P.rect(30, feet - 4, 16, 4, PAL.ash[0]);
  P.rect(60, feet - 4, 16, 4, PAL.ash[0]);
  P.rect(30, feet - 16, 18, 5, PAL.rust[1]);
  for (let i = 0; i < 5; i++) P.set(31 + i * 4, feet - 17, PAL.rust[3]);
  blob(P, 53, feet - 52, 24, 30, "ash", 0.45, 0.42);
  blob(P, 53, feet - 48, 14, 20, "soil", 0.35, 0.3);
  for (const [cx, cy] of [[44, feet - 70], [62, feet - 60]]) blob(P, cx, cy, 6, 4, "stone", 0.6, 0.35);
  limb(P, 32, feet - 70, 14, feet - 96 + sway, 8, 7, "ash", 0.5);
  limb(P, 74, feet - 70, 92, feet - 96 - sway, 8, 7, "ash", 0.4);
  for (const x of [14, 92]) for (let i = 0; i < 4; i++) P.line(x, feet - 96, x - 3 + i * 2, feet - 101, PAL.snow[3]);
  blob(P, 54, feet - 84, 13, 11, "ash", 0.52, 0.4);
  blob(P, 47, feet - 94, 4, 4, "ash", 0.5, 0.3);
  blob(P, 61, feet - 94, 4, 4, "ash", 0.45, 0.3);
  eye(P, 49, feet - 86, PAL.leaf[5], PAL.leaf[4]);
  eye(P, 57, feet - 86, PAL.leaf[5], PAL.leaf[4]);
  P.rect(49, feet - 79, 10, 5, OUTLINE);
  P.rect(50, feet - 77, 8, 2, PAL.cloth[0]);
  for (let i = 0; i < 4; i++) P.set(50 + i * 2, feet - 79, PAL.snow[4]);
  P.outline(OUTLINE);
  return P;
}

// ================= 白毛风：一身军大衣结着冰，戴着护耳帽，扛着测风杆 =================
// pose：walk、sweep（抡杆）、raise（杆举过头：冰锥）、breath（喷寒气）；armor：冰甲还在不在
export const FROST_W = 80,
  FROST_H = 98;
export function frostSprite(pose = "walk", frame = 0, armor = true) {
  return cached(`tfrost:${pose}:${frame}:${armor ? 1 : 0}`, () => {
    const P = new Pix(FROST_W, FROST_H),
      feet = 96,
      step = [0, 1, 0, -1][frame % 4],
      top = 18;
    // 腿和毡靴
    limb(P, 30, feet - 30, 27 - step * 2, feet - 3, 6, 5, "night", 0.35);
    limb(P, 44, feet - 30, 47 + step * 2, feet - 3, 6, 5, "night", 0.3);
    P.rect(20 - step * 2, feet - 5, 13, 5, PAL.ash[1]);
    P.rect(42 + step * 2, feet - 5, 13, 5, PAL.ash[1]);
    // 军大衣：长到小腿，鼓鼓囊囊
    P.poly(
      [
        [22, top + 20],
        [54, top + 20],
        [60, feet - 22],
        [16, feet - 22],
      ],
      PAL.leaf[1],
    );
    for (let y = top + 20; y < feet - 21; y++) for (let x = 14; x < 62; x++) if (P.opaque(x, y) && y < feet - 21) P.set(x, y, dither("leaf", 0.42 - (x - 14) / 140 - (y - top) / 260, x, y));
    P.vline(38, top + 22, feet - 23, PAL.leaf[0]);
    for (let i = 0; i < 4; i++) P.set(36, top + 26 + i * 8, PAL.straw[2]);
    P.hline(16, 60, feet - 22, PAL.ash[2]);
    blob(P, 38, top + 20, 18, 7, "ash", 0.5, 0.3);
    // 胳膊、测风杆（杆顶三只风杯）
    const sweep = pose === "sweep",
      raise = pose === "raise";
    const pole = sweep ? [[58, top + 30], [78, top + 8]] : raise ? [[60, top + 6], [64, top - 18]] : [[58, top + 34], [64, top - 14]];
    limb(P, 24, top + 24, 14, top + 46 + step, 5, 4, "leaf", 0.4);
    limb(P, 52, top + 24, pole[0][0], pole[0][1], 5, 4, "leaf", 0.3);
    P.line(pole[0][0], pole[0][1] + 8, pole[1][0], pole[1][1], PAL.stone[3]);
    P.line(pole[0][0] + 1, pole[0][1] + 8, pole[1][0] + 1, pole[1][1], PAL.stone[2]);
    const [tx, ty] = pole[1];
    for (const [dx, dy] of [[-5, -1], [5, -2], [0, 3]]) {
      P.line(tx, ty, tx + dx, ty + dy, PAL.stone[4]);
      P.ellipse(tx + dx, ty + dy, 2, 1.5, PAL.stone[4]);
    }
    // 头：冻得发青的脸，护耳帽，眉毛胡子全白了；喷寒气时张嘴
    blob(P, 38, top + 9, 8, 8, "skin", 0.5, 0.3);
    for (let y = top + 1; y <= top + 17; y++) for (let x = 29; x <= 47; x++) P.shade(x, y, 0.82, PAL.night[3]);
    blob(P, 38, top + 1, 11, 5, "soil", 0.5, 0.35);
    P.rect(27, top + 2, 23, 3, PAL.soil[3]);
    P.rect(27, top + 4, 4, 10, PAL.soil[2]);
    P.rect(46, top + 4, 4, 10, PAL.soil[1]);
    P.hline(28, 48, top - 4, PAL.snow[3]);
    P.hline(27, 49, top + 2, PAL.snow[2]);
    P.hline(32, 36, top + 6, PAL.snow[4]);
    P.hline(40, 44, top + 6, PAL.snow[4]);
    eye(P, 34, top + 8, PAL.snow[4], PAL.water[5]);
    eye(P, 41, top + 8, PAL.snow[4], PAL.water[5]);
    blob(P, 38, top + 15, 7, 4, "snow", 0.62, 0.25);
    for (const x of [34, 37, 40, 43]) P.vline(x, top + 18, top + 19 + (x % 3), PAL.snow[3]);
    if (pose === "breath") {
      P.rect(36, top + 12, 5, 3, OUTLINE);
      P.set(38, top + 13, PAL.water[5]);
    }
    // 冰甲：整个人蒙着一层冰（颜色往冰蓝里拉），肩上、胳膊上支出一排冰碴，下摆和袖口挂着冰锥，几点亮光
    if (armor) {
      for (let y = 0; y < FROST_H; y++) for (let x = 0; x < FROST_W; x++) if (P.opaque(x, y)) P.shade(x, y, 0.5, PAL.snow[2]);
      const spike = (x, y, h, lean = 0) => {
        P.poly([[x - 2, y], [x + lean, y - h], [x + 2, y]], PAL.snow[3]);
        P.line(x - 1, y - 1, x + lean, y - h + 1, PAL.snow[4]);
        P.set(x + 1, y - 1, PAL.water[4]);
      };
      for (const [x, y, h, l] of [[22, top + 17, 7, -2], [27, top + 15, 9, -1], [32, top + 14, 6, 0], [45, top + 14, 6, 0], [50, top + 15, 9, 1], [55, top + 17, 7, 2], [14, top + 32, 6, -3], [62, top + 30, 5, 3]]) spike(x, y, h, l);
      for (const [x, y, h] of [[18, feet - 22, 6], [24, feet - 22, 4], [30, feet - 22, 7], [37, feet - 22, 5], [44, feet - 22, 6], [51, feet - 22, 4], [57, feet - 22, 6], [12, top + 47, 5], [15, top + 48, 3]]) for (let k = 0; k < h; k++) P.set(x, y + k, k < h - 1 ? PAL.snow[3] : PAL.snow[4]);
      const r = rng(2468 + frame);
      for (let i = 0; i < 26; i++) {
        const x = 14 + Math.floor(r() * 50),
          y = top - 2 + Math.floor(r() * 72);
        if (P.opaque(x, y) && P.opaque(x + 1, y)) {
          P.set(x, y, PAL.snow[4]);
          if (i % 3 === 0) P.set(x + 1, y, PAL.water[5]);
        }
      }
    }
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}

// ================= 地上的东西 =================
// 铁桶：烧着的冒火，灭了冒烟
export function barrelSprite(lit = true, frame = 0) {
  return cached(`tbarrel:${lit ? 1 : 0}:${lit ? frame % 3 : 0}`, () => {
    const P = new Pix(18, 26);
    P.rect(3, 11, 12, 14, PAL.rust[1]);
    for (let y = 11; y < 25; y++) for (let x = 3; x < 15; x++) P.set(x, y, dither("rust", 0.62 - (x - 3) / 24, x, y));
    P.hline(3, 14, 15, PAL.rust[0]);
    P.hline(3, 14, 21, PAL.rust[0]);
    P.hline(3, 14, 11, PAL.ash[2]);
    if (lit) {
      const f = frame % 3;
      P.poly([[4, 11], [6, 4 - f], [9, 7], [11, 2 + f], [14, 11]], PAL.ember[3]);
      P.poly([[6, 11], [8, 6], [10, 9], [12, 11]], PAL.ember[5]);
      P.set(9, 1 + f, PAL.ember[4]);
    } else {
      P.ellipse(9, 11, 5, 1.5, PAL.ash[0]);
      P.set(8, 7, PAL.stone[3]);
      P.set(10, 4, PAL.stone[2]);
    }
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
// 河边冲上来的东西、护林小屋门口的木材
export function giftSprite(kind = "hebo") {
  return cached(`tgift:${kind}`, () => {
    const P = new Pix(20, 14);
    if (kind === "bear") {
      for (let i = 0; i < 3; i++) {
        P.rect(2, 4 + i * 3, 16, 3, PAL.soil[2 + (i % 2)]);
        P.set(2, 5 + i * 3, PAL.straw[3]);
        P.set(17, 5 + i * 3, PAL.straw[3]);
      }
      P.vline(7, 3, 13, PAL.ash[1]);
      P.vline(13, 3, 13, PAL.ash[1]);
      P.rect(14, 1, 4, 3, PAL.straw[3]);
    } else {
      P.ellipse(10, 9, 8, 4, PAL.water[3]);
      P.rect(5, 5, 8, 5, PAL.soil[2]);
      P.hline(5, 12, 5, PAL.soil[3]);
      P.line(13, 4, 17, 7, PAL.leaf[3]);
      P.set(8, 7, PAL.straw[4]);
    }
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
export { mix };
