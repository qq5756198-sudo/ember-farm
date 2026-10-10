// 新画面的像素工具：一套调色板、噪声、在像素缓冲上作画，再转成画布。
// 所有新画面都只从 PAL 里取色；每个“美术像素”在地图上占 2×2。
export const ART = 2; // 一个美术像素 = 地图上的 2 个单位

export const PAL = {
  ash: ["#18130f", "#251d17", "#352a21", "#4a3c30", "#625244"],
  soil: ["#3a2519", "#553522", "#704a2f", "#8d6340", "#ad8258"],
  ember: ["#5e2418", "#8e3a20", "#bf5a28", "#e5823a", "#f6b05a", "#ffdb8c"],
  straw: ["#7d6a3a", "#a28a4e", "#c4ab68", "#ddc98c", "#efe2b4"],
  leaf: ["#26331d", "#364a24", "#4c632d", "#667d36", "#869843", "#aab258"],
  water: ["#14282c", "#1f3f43", "#2e5e5e", "#46807a", "#6fa69a", "#a9cfbd"],
  stone: ["#2e3030", "#454847", "#62645d", "#85857a", "#aaa797", "#cdc8b6"],
  rust: ["#3d2016", "#6a3420", "#94502c", "#b9703c"],
  night: ["#141a2e", "#1f2a46", "#33446a", "#566a96"],
  cloth: ["#7a2e2a", "#a8433a", "#d2654c", "#3e4a5c", "#5a6b80", "#e9dcc0"],
  skin: ["#7a4a36", "#b0765a", "#dba27c", "#f2c9a0"],
  snow: ["#8b9ea4", "#aebfc2", "#cdd9d8", "#e6ede9", "#f6f8f2"],
};
export const OUTLINE = "#1c140f";

const cache = new Map();
export function rgb(c) {
  if (Array.isArray(c)) return c;
  let v = cache.get(c);
  if (!v) {
    v = [parseInt(c.slice(1, 3), 16), parseInt(c.slice(3, 5), 16), parseInt(c.slice(5, 7), 16)];
    cache.set(c, v);
  }
  return v;
}
export const mix = (a, b, t) => {
  const x = rgb(a),
    y = rgb(b);
  return [x[0] + (y[0] - x[0]) * t, x[1] + (y[1] - x[1]) * t, x[2] + (y[2] - x[2]) * t].map(Math.round);
};
export const css = (c, a = 1) => {
  const [r, g, b] = rgb(c);
  return a >= 1 ? `rgb(${r},${g},${b})` : `rgba(${r},${g},${b},${a})`;
};
// 调色板里离某个颜色最近的一格（按人眼对绿最敏感加权）
let flat = null;
export function nearestPal(r, g, b) {
  if (!flat) flat = [...Object.values(PAL).flat(), OUTLINE].map((c) => rgb(c));
  let best = flat[0],
    bd = Infinity;
  for (const c of flat) {
    const dr = c[0] - r,
      dg = c[1] - g,
      db = c[2] - b,
      d = dr * dr * 2 + dg * dg * 4 + db * db * 3;
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  return best;
}
// 从一组颜色里按 0–1 取一档
export const ramp = (name, t) => {
  const r = PAL[name];
  return r[Math.max(0, Math.min(r.length - 1, Math.floor(t * r.length)))];
};

// ---------- 画布 ----------
let factory = null;
export function setCanvasFactory(f) {
  factory = f;
}
export function makeCanvas(w, h) {
  let c = null;
  try {
    if (factory) c = factory(w, h);
    else if (globalThis.document?.createElement) c = globalThis.document.createElement("canvas");
    else if (typeof OffscreenCanvas !== "undefined") c = new OffscreenCanvas(w, h);
  } catch {
    c = null;
  }
  if (c) {
    c.width = w;
    c.height = h;
  }
  return c;
}

// ---------- 噪声 ----------
export function hash2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 982451653)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
export function vnoise(x, y, s = 0) {
  const xi = Math.floor(x),
    yi = Math.floor(y),
    xf = x - xi,
    yf = y - yi,
    u = xf * xf * (3 - 2 * xf),
    v = yf * yf * (3 - 2 * yf),
    a = hash2(xi, yi, s),
    b = hash2(xi + 1, yi, s),
    c = hash2(xi, yi + 1, s),
    d = hash2(xi + 1, yi + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
export function fbm(x, y, s = 0, oct = 4) {
  let t = 0,
    amp = 0.5,
    f = 1,
    n = 0;
  for (let i = 0; i < oct; i++) {
    t += amp * vnoise(x * f, y * f, s + i * 17);
    n += amp;
    amp *= 0.5;
    f *= 2;
  }
  return t / n;
}
const BAYER4 = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
export const bayer = (x, y) => BAYER4[(y & 3) * 4 + (x & 3)];
// 抖动取色：t 落在两档之间时按棋盘格交错，像素画的渐变
export const dither = (name, t, x, y) => {
  const r = PAL[name],
    f = Math.max(0, Math.min(r.length - 1.001, t * (r.length - 1))),
    i = Math.floor(f);
  return r[f - i > bayer(x, y) ? i + 1 : i];
};
// 可复现的随机数
export function rng(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const seedOf = (str) => {
  let h = 2166136261;
  for (const ch of String(str)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};

// ---------- 像素缓冲 ----------
export class Pix {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x, y, c, a = 1) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
    const i = (y * this.w + x) * 4,
      [r, g, b] = rgb(c),
      d = this.d;
    if (a >= 1 || d[i + 3] === 0) {
      d[i] = r;
      d[i + 1] = g;
      d[i + 2] = b;
      d[i + 3] = a >= 1 ? 255 : Math.round(a * 255);
      return;
    }
    d[i] += (r - d[i]) * a;
    d[i + 1] += (g - d[i + 1]) * a;
    d[i + 2] += (b - d[i + 2]) * a;
    d[i + 3] = Math.max(d[i + 3], Math.round(a * 255));
  }
  get(x, y) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return null;
    const i = (y * this.w + x) * 4;
    return [this.d[i], this.d[i + 1], this.d[i + 2], this.d[i + 3]];
  }
  opaque(x, y) {
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return false;
    return this.d[(y * this.w + x) * 4 + 3] > 0;
  }
  // 把已有颜色压暗或提亮（f<1 暗，f>1 亮），用于影子和高光
  shade(x, y, f, tint = null) {
    x = Math.round(x);
    y = Math.round(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4,
      d = this.d;
    if (!d[i + 3]) return;
    if (tint) {
      const t = rgb(tint);
      d[i] = d[i] * f + t[0] * (1 - f);
      d[i + 1] = d[i + 1] * f + t[1] * (1 - f);
      d[i + 2] = d[i + 2] * f + t[2] * (1 - f);
    } else {
      d[i] *= f;
      d[i + 1] *= f;
      d[i + 2] *= f;
    }
  }
  rect(x, y, w, h, c, a = 1) {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
  }
  hline(x0, x1, y, c, a = 1) {
    for (let x = Math.min(x0, x1); x <= Math.max(x0, x1); x++) this.set(x, y, c, a);
  }
  vline(x, y0, y1, c, a = 1) {
    for (let y = Math.min(y0, y1); y <= Math.max(y0, y1); y++) this.set(x, y, c, a);
  }
  line(x0, y0, x1, y1, c, a = 1) {
    x0 = Math.round(x0);
    y0 = Math.round(y0);
    x1 = Math.round(x1);
    y1 = Math.round(y1);
    const dx = Math.abs(x1 - x0),
      dy = -Math.abs(y1 - y0),
      sx = x0 < x1 ? 1 : -1,
      sy = y0 < y1 ? 1 : -1;
    let e = dx + dy;
    for (let n = 0; n < 4000; n++) {
      this.set(x0, y0, c, a);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * e;
      if (e2 >= dy) {
        e += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        e += dx;
        y0 += sy;
      }
    }
  }
  ellipse(cx, cy, rx, ry, c, a = 1) {
    for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++)
      for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++)
        if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) this.set(cx + x, cy + y, c, a);
  }
  disc(cx, cy, r, c, a = 1) {
    this.ellipse(cx, cy, r, r, c, a);
  }
  // 椭圆影子：压暗已有像素，不改透明处
  shadowEllipse(cx, cy, rx, ry, f = 0.62) {
    for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++)
      for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++)
        if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) <= 1) this.shade(cx + x, cy + y, f, "#18130f");
  }
  poly(pts, c, a = 1) {
    let y0 = Infinity,
      y1 = -Infinity;
    for (const [, y] of pts) {
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [ax, ay] = pts[i],
          [bx, by] = pts[(i + 1) % pts.length];
        if (ay <= y + 0.5 !== by <= y + 0.5) xs.push(ax + ((y + 0.5 - ay) * (bx - ax)) / (by - ay));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) for (let x = Math.round(xs[i]); x < Math.round(xs[i + 1]); x++) this.set(x, y, c, a);
    }
  }
  // 给不透明区域描一圈外轮廓（只画在透明处）
  outline(c = OUTLINE, a = 1) {
    const add = [];
    for (let y = 0; y < this.h; y++)
      for (let x = 0; x < this.w; x++)
        if (!this.opaque(x, y) && (this.opaque(x - 1, y) || this.opaque(x + 1, y) || this.opaque(x, y - 1) || this.opaque(x, y + 1))) add.push(x, y);
    for (let i = 0; i < add.length; i += 2) this.set(add[i], add[i + 1], c, a);
    return this;
  }
  stamp(src, ox, oy, flip = false) {
    for (let y = 0; y < src.h; y++)
      for (let x = 0; x < src.w; x++) {
        const i = (y * src.w + x) * 4;
        if (!src.d[i + 3]) continue;
        this.set(ox + (flip ? src.w - 1 - x : x), oy + y, [src.d[i], src.d[i + 1], src.d[i + 2]], src.d[i + 3] / 255);
      }
  }
  toCanvas() {
    const cv = makeCanvas(this.w, this.h);
    if (!cv) return null;
    const ctx = cv.getContext("2d"),
      img = ctx.createImageData(this.w, this.h);
    img.data.set(this.d);
    ctx.putImageData(img, 0, 0);
    return cv;
  }
}

// 画好的小图按名字存起来，只画一次
const sprites = new Map();
export function cached(key, build) {
  if (sprites.has(key)) return sprites.get(key);
  let v = null;
  try {
    v = build();
  } catch (err) {
    v = null;
    if (globalThis.console) console.warn("pixel sprite failed", key, err);
  }
  sprites.set(key, v);
  return v;
}
export function clearCache() {
  sprites.clear();
}
