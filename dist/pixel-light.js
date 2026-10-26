// 新画面的光影与天气：一天四段的环境色、火光灯光（一圈圈像素色阶）、雨丝水花水洼、酸雨的小烟、高温的泛白与热浪、
// 闪电、篝火的火星和烟、夜里的萤火虫和余烬。
// v0.41「看得清」：夜里留月光（显示用的天色深夜不低于 #6472A2，暗处再“滤色”一层 #0C111D 的底）；灯光 12 圈细台阶。
// “天黑没有”（灯亮不亮、萤火虫、感染者的眼睛）照旧按原来的天色算，别处的规矩不跟着变。
// 只对电脑（LOOK41.on）；手机、小窗口照旧是原来的天色、6 圈灯光、原来的雨。
// 电脑上为了不掉帧：每盏灯的 12 圈先画成一张小图存起来，再贴到光照图上；没被灯照到的块用环境色整块乘（multiplyLight）；
// 月光底不用“滤色”整屏叠，改成光照图每个通道乘一点、再整屏“加”一层（同样的结果，省一些，见 moonFloor）。
import { makeCanvas, hash2, PAL, rgb, LOOK41 } from "./pixel-kit.js";

// 环境色：乘到整个画面上（白 = 原色，越暗越像夜里）
const SKY = [
  [0, [84, 96, 150]],
  [300, [86, 98, 152]],
  [345, [128, 110, 158]],
  [390, [214, 168, 160]],
  [450, [250, 222, 196]],
  [540, [255, 244, 226]],
  [720, [255, 250, 240]],
  [930, [255, 240, 214]],
  [1020, [255, 214, 168]],
  [1080, [244, 176, 136]],
  [1125, [178, 112, 128]],
  [1170, [96, 84, 136]],
  [1215, [88, 98, 150]],
  [1440, [84, 96, 150]],
];
export function skyColor(minute) {
  const m = ((minute % 1440) + 1440) % 1440;
  for (let i = 0; i + 1 < SKY.length; i++) {
    const [a, ca] = SKY[i],
      [b, cb] = SKY[i + 1];
    if (m >= a && m <= b) {
      const t = (m - a) / (b - a);
      return ca.map((v, k) => Math.round(v + (cb[k] - v) * t));
    }
  }
  return SKY[0][1];
}
// 月光：深夜显示用的天色（原来 #546096）、暗处留的底色（加在整个画面上）
export const MOON = [100, 114, 162],
  MOON_FLOOR = [12, 17, 29];
// 原来深夜的“夜深程度”（天色 #546096 时）：拿它当 1，黄昏、黎明按比例掺月光
export const NIGHT_MAX = (235 - (84 + 96 + 150) / 3) / 165;
// 0（白天）到 1（深夜）：月光掺多少
export function moonness(minute) {
  return Math.max(0, Math.min(1, nightness(minute) / NIGHT_MAX));
}
export function liftedSky(minute) {
  const c = skyColor(minute),
    t = moonness(minute);
  return c.map((v, k) => Math.round(v + Math.max(0, MOON[k] - v) * t));
}
const blend = (c, to, t) => c.map((v, k) => Math.round(v + (to[k] - v) * t));
// v0.41：夜里的雾、风雪跟着天色走——雾的颜色乘上这一刻的环境色（白天环境色接近白，几乎不变；夜里是蓝灰，不再发白）。
// 浓淡（透明度）和看得见的那一圈不变。moon 是月光掺了几成（0 白天，1 深夜）
export function fogColor(col, amb, moon) {
  const t = Math.max(0, Math.min(1, moon || 0));
  return col.map((v, i) => Math.max(0, Math.min(255, Math.round(v * (1 - t + (t * (amb?.[i] ?? 255)) / 255)))));
}
// lifted：显示用（有月光）；false 是 v0.40 的算法（光外的感染者还按它画；手机、小窗口照旧用它）
export function ambientFor(minute, weather, lifted = LOOK41.on) {
  let c = lifted ? liftedSky(minute) : skyColor(minute);
  const day = minute >= 420 && minute <= 1080;
  if (weather === "小雨") c = blend(c, [158, 174, 200], day ? 0.45 : 0.2);
  else if (weather === "暴雨") c = blend(c, [104, 120, 156], day ? 0.62 : 0.3);
  else if (weather === "酸雨") c = blend(c, [178, 200, 104], day ? 0.62 : 0.28);
  else if (weather === "高温") c = blend(c, [255, 246, 222], day ? 0.5 : 0.1);
  else if (weather === "小雪") c = blend(c, [214, 224, 238], day ? 0.35 : 0.15);
  else if (weather === "大雪") c = blend(c, [176, 190, 214], day ? 0.55 : 0.25);
  return c;
}
// 夜深程度 0（白天）到 1（深夜），用来决定灯亮不亮、萤火虫出不出来
export function nightness(minute) {
  const [r, g, b] = skyColor(minute);
  return Math.max(0, Math.min(1, (235 - (r + g + b) / 3) / 165));
}

// ---------- 光照图 ----------
// v0.41：12 圈细台阶（原来 6 圈硬边），加起来和原来一样亮；RINGS_40 是原来的（手机、小窗口照旧用它）
export const RINGS = [[1, 0.082], [0.91, 0.055], [0.82, 0.062], [0.73, 0.071], [0.64, 0.074], [0.55, 0.084], [0.46, 0.085], [0.38, 0.096], [0.3, 0.091], [0.23, 0.086], [0.16, 0.079], [0.1, 0.024]],
  RINGS_SMALL = [[1, 0.13], [0.8, 0.093], [0.6, 0.119], [0.42, 0.148], [0.26, 0.14], [0.14, 0.05]],
  RINGS_40 = [[1, 0.1], [0.84, 0.11], [0.68, 0.13], [0.52, 0.15], [0.36, 0.18], [0.22, 0.22]],
  RINGS_SMALL_40 = [[1, 0.16], [0.6, 0.22], [0.3, 0.3]];
// 光照图按美术像素画（地图 2 个单位一格），放大后自然是一块块的像素光
export class LightMap {
  constructor() {
    this.canvas = null;
    this.ctx = null;
  }
  ensure(w, h) {
    if (!this.canvas || this.canvas.width !== w || this.canvas.height !== h) {
      this.canvas = makeCanvas(w, h);
      this.ctx = this.canvas?.getContext("2d") || null;
    }
    return !!this.ctx;
  }
  // lights: [{x,y,r,color:[r,g,b],power}] 地图坐标；scale：月光底那一步要光照图每个通道乘多少（见 moonFloor），没有就是 null
  render(view, ambient, lights, scale = null) {
    const ART = 2,
      w = Math.ceil(view.w / ART) + 2,
      h = Math.ceil(view.h / ART) + 2;
    if (!this.ensure(w, h)) return null;
    const c = this.ctx,
      ox = Math.floor(view.x / ART),
      oy = Math.floor(view.y / ART);
    if (LOOK41.on) return this.render41(c, w, h, ox, oy, ambient, lights, scale);
    c.globalCompositeOperation = "source-over";
    c.fillStyle = `rgb(${ambient[0]},${ambient[1]},${ambient[2]})`;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = "lighter";
    for (const l of lights) {
      const lx = l.x / ART - ox,
        ly = l.y / ART - oy,
        r = l.r / ART;
      if (lx < -r || ly < -r || lx > w + r || ly > h + r) continue;
      // 一圈圈色阶：外圈淡、内圈亮
      const [cr, cg, cb] = l.color,
        p = l.power ?? 1;
      for (const [k, a] of l.small ? RINGS_SMALL_40 : RINGS_40) {
        c.fillStyle = `rgba(${cr},${cg},${cb},${a * p})`;
        c.beginPath();
        c.ellipse(Math.round(lx), Math.round(ly), Math.max(1, Math.round(r * k)), Math.max(1, Math.round(r * k * (l.flat ?? 0.82))), 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalCompositeOperation = "source-over";
    return { canvas: this.canvas, x: ox * ART, y: oy * ART, w: w * ART, h: h * ART };
  }
  // v0.41：12 圈画成一张小图（同样的圈、同样的位置），按灯的强弱贴上去；scale 每个通道乘一点（都不大于 1）
  render41(c, w, h, ox, oy, ambient, lights, scale) {
    const ART = 2,
      amb = (scale ? ambient.map((v, i) => v * scale[i]) : ambient).map((v) => Math.max(0, Math.min(255, Math.round(v)))),
      // 哪几块被灯照到（一块 TILE×TILE 个光照图像素）：没照到的地方光照图就是环境色，乘的时候用一种颜色整块乘，快得多
      nx = Math.ceil(w / TILE),
      ny = Math.ceil(h / TILE),
      lit = new Uint8Array(nx * ny);
    c.globalCompositeOperation = "source-over";
    c.globalAlpha = 1;
    c.fillStyle = `rgb(${amb[0]},${amb[1]},${amb[2]})`;
    c.fillRect(0, 0, w, h);
    c.globalCompositeOperation = "lighter";
    c.imageSmoothingEnabled = false;
    for (const l of lights) {
      const lx = l.x / ART - ox,
        ly = l.y / ART - oy,
        r = l.r / ART;
      if (lx < -r || ly < -r || lx > w + r || ly > h + r) continue;
      const col = scale ? l.color.map((v, i) => Math.min(255, Math.round(v * scale[i]))) : l.color,
        spr = ringSprite(r, l.flat ?? 0.82, !!l.small, col);
      if (!spr) continue;
      // “变亮”是加上去的：强过 1 的分两次贴
      let p = l.power ?? 1;
      const X = Math.round(lx) - spr.cx,
        Y = Math.round(ly) - spr.cy;
      while (p > 0.001) {
        c.globalAlpha = Math.min(1, p);
        c.drawImage(spr.canvas, X, Y);
        p -= 1;
      }
      // 这张小图盖到的块（多算一圈，边上那一列一定还是环境色）
      const x0 = Math.max(0, Math.floor((X - 1) / TILE)),
        x1 = Math.min(nx - 1, Math.floor((X + spr.canvas.width) / TILE)),
        y0 = Math.max(0, Math.floor((Y - 1) / TILE)),
        y1 = Math.min(ny - 1, Math.floor((Y + spr.canvas.height) / TILE));
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) lit[ty * nx + tx] = 1;
    }
    c.globalAlpha = 1;
    c.globalCompositeOperation = "source-over";
    return { canvas: this.canvas, x: ox * ART, y: oy * ART, w: w * ART, h: h * ART, tiles: { T: TILE, nx, ny, lit, pw: w, ph: h }, amb };
  }
}
// 光照图分块（光照图像素）
const TILE = 16;
// 光照图乘到画面上（“正片叠底”）：被灯照到的块照常贴光照图；没照到的块光照图就是环境色，用一种颜色整块乘（一样的结果，快得多）。
// 块的边按屏幕像素取整：照到的块最外一圈一定是环境色，取整差一个屏幕像素也一样。c 的变换是地图坐标（只放大、平移）
export function multiplyLight(c, lit) {
  const t = lit.tiles;
  let m = null;
  try {
    m = c.getTransform();
  } catch {
    m = null;
  }
  if (!t || !m || m.b || m.c || typeof Path2D !== "function") {
    c.drawImage(lit.canvas, lit.x, lit.y, lit.w, lit.h);
    return false;
  }
  const ART = lit.w / t.pw,
    X = (i) => Math.round(m.a * (lit.x + Math.min(t.pw, i * t.T) * ART) + m.e),
    Y = (j) => Math.round(m.d * (lit.y + Math.min(t.ph, j * t.T) * ART) + m.f),
    lit2 = new Path2D();
  let any = false;
  c.save();
  c.setTransform(1, 0, 0, 1, 0, 0);
  c.fillStyle = `rgb(${lit.amb[0]},${lit.amb[1]},${lit.amb[2]})`;
  for (let ty = 0; ty < t.ny; ty++) {
    const y0 = Y(ty),
      y1 = Y(ty + 1);
    if (y1 <= y0) continue;
    for (let tx = 0; tx < t.nx; ) {
      const on = t.lit[ty * t.nx + tx];
      let end = tx + 1;
      while (end < t.nx && t.lit[ty * t.nx + end] === on) end++;
      const x0 = X(tx),
        x1 = X(end);
      if (x1 > x0) {
        if (on) {
          lit2.rect(x0, y0, x1 - x0, y1 - y0);
          any = true;
        } else c.fillRect(x0, y0, x1 - x0, y1 - y0);
      }
      tx = end;
    }
  }
  if (any) {
    c.clip(lit2);
    c.setTransform(m);
    c.drawImage(lit.canvas, lit.x, lit.y, lit.w, lit.h);
  }
  c.restore();
  return true;
}
// 一盏灯的 12 圈（或小灯 6 圈）画成一张小图：圈的大小按原来那样取整，中心落在整像素上，贴上去和直接画一样
const ringCache = new Map();
export function ringSprite(r, flat, small, col) {
  const rings = small ? RINGS_SMALL : RINGS,
    radii = rings.map(([k]) => [Math.max(1, Math.round(r * k)), Math.max(1, Math.round(r * k * flat))]),
    key = (small ? "s" : "") + radii.map(([a, b]) => a + "x" + b).join(",") + "|" + col.join(",");
  let spr = ringCache.get(key);
  if (spr !== undefined) {
    ringCache.delete(key);
    ringCache.set(key, spr);
    return spr;
  }
  const R = Math.max(...radii.map(([a]) => a)),
    Ry = Math.max(...radii.map(([, b]) => b)),
    cv = makeCanvas(R * 2 + 3, Ry * 2 + 3),
    g = cv?.getContext?.("2d");
  spr = null;
  if (g) {
    g.globalCompositeOperation = "lighter";
    rings.forEach(([, a], i) => {
      g.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${a})`;
      g.beginPath();
      g.ellipse(R + 1, Ry + 1, radii[i][0], radii[i][1], 0, 0, Math.PI * 2);
      g.fill();
    });
    spr = { canvas: cv, cx: R + 1, cy: Ry + 1 };
  }
  ringCache.set(key, spr);
  if (ringCache.size > 320) ringCache.delete(ringCache.keys().next().value);
  return spr;
}
// v0.41 月光底：本来是光照乘上去以后整屏“滤色”一层 F（out = x + F − x·F = x·(1−F) + F）。整屏滤色很费，换成一样的结果：
// 光照图每个通道先乘 1−F（scale），乘完再整屏“加”一层 F（add，0–255）：x·(1−F) + F。
// moon 是月光掺了几成（0 白天，1 深夜）；没有月光时返回 null
export function moonFloor(moon, floor = MOON_FLOOR) {
  if (!(moon > 0.01)) return null;
  const F = floor.map((v) => (v / 255) * Math.min(1, moon));
  if (!F.some((f) => f > 0.5 / 255)) return null;
  return { scale: F.map((f) => 1 - f), add: F.map((f) => Math.round(f * 255)) };
}

// ---------- 粒子 ----------
export class Particles {
  constructor() {
    this.list = [];
    this.seed = 1;
  }
  rand() {
    this.seed = (this.seed * 16807) % 2147483647;
    return this.seed / 2147483647;
  }
  add(p) {
    if (this.list.length < 700) this.list.push(p);
  }
  update(dt, wind = 0) {
    for (const p of this.list) {
      p.t += dt;
      p.x += (p.vx + wind * (p.wind || 0)) * dt;
      p.y += p.vy * dt;
      if (p.grav) p.vy += p.grav * dt;
      if (p.drag) {
        p.vx *= 1 - p.drag * dt;
        p.vy *= 1 - p.drag * dt;
      }
    }
    this.list = this.list.filter((p) => p.t < p.life);
  }
  // layer: "world"（受光照影响）或 "glow"（自己发光，画在光照之后）
  draw(ctx, layer, time) {
    for (const p of this.list) {
      if ((p.layer || "world") !== layer) continue;
      const k = p.t / p.life;
      let a = p.alpha ?? 1;
      if (p.fade !== false) a *= k < 0.15 ? k / 0.15 : 1 - Math.max(0, (k - 0.55) / 0.45);
      if (p.blink) a *= 0.35 + 0.65 * Math.max(0, Math.sin(time * p.blink + p.phase));
      if (a <= 0.02) continue;
      ctx.globalAlpha = Math.min(1, a);
      ctx.fillStyle = p.color;
      const s = (p.size || 1) * 2 * (p.grow ? 1 + k * p.grow : 1);
      ctx.fillRect(Math.round(p.x / 2) * 2, Math.round(p.y / 2) * 2, s, s);
    }
    ctx.globalAlpha = 1;
  }
}

// ---------- 天气 ----------
export class Weather {
  constructor() {
    this.wet = 0; // 地面湿到什么程度，0–1
    this.flash = 0;
    this.nextFlash = 6;
    this.splashes = [];
  }
  update(dt, weather, calm) {
    const raining = ["小雨", "暴雨", "酸雨"].includes(weather);
    // 一进农场就按当天的天气：下雨天地上已经有水洼；看着天变了才慢慢积水、慢慢变干
    if (this.lastWeather === undefined) this.wet = raining ? 1 : 0;
    this.lastWeather = weather;
    this.wet = Math.max(0, Math.min(1, this.wet + (raining ? dt / (weather === "暴雨" ? 8 : 16) : -dt / 45)));
    this.flash = Math.max(0, this.flash - dt * 3.5);
    if (weather === "暴雨" && !calm) {
      this.nextFlash -= dt;
      if (this.nextFlash <= 0) {
        this.flash = 1;
        this.nextFlash = 7 + Math.random() * 9;
      }
    } else this.nextFlash = 4;
  }
  // 雨丝：只画在镜头范围内，对齐像素；一段四个像素高，画得快。
  // skip(x, y) 返回 true 的地方不画（人和感染者身上不挡雨丝，看得清动作）
  drawRain(ctx, view, weather, time, calm, skip = null) {
    if (!["小雨", "暴雨", "酸雨"].includes(weather)) return;
    const storm = weather === "暴雨",
      acid = weather === "酸雨",
      // v0.41：加密一倍（雨丝本来就是 1 个美术像素宽；手机、小窗口照旧）
      n = (calm ? 60 : storm ? 260 : 150) * (LOOK41.on ? 2 : 1),
      fall = storm ? 680 : 460,
      slant = storm ? 0.34 : 0.16,
      len = storm ? 16 : 12,
      W = view.w + 200,
      Hh = view.h + 200;
    ctx.fillStyle = acid ? "#d4e08e" : "#dfeaf2";
    ctx.globalAlpha = storm ? 0.62 : 0.55;
    for (let i = 0; i < n; i++) {
      const speed = 0.8 + hash2(i, 3, 9) * 0.4,
        y = ((hash2(i, 2, 9) * Hh + time * fall * speed) % Hh) - 100,
        x = ((((hash2(i, 1, 9) * W - y * slant + time * fall * slant * speed) % W) + W) % W) - 100,
        wx = Math.round((view.x + x) / 2) * 2,
        wy = Math.round((view.y + y) / 2) * 2;
      if (skip && skip(wx, wy + len / 2)) continue;
      for (let k = 0; k < len; k += 4) ctx.fillRect(wx - Math.round((k * slant) / 2) * 2, wy + k, 2, 4);
    }
    ctx.globalAlpha = 1;
  }
  // v0.41：地上湿了起一层湿光——一点点蓝白的反光一闪一闪（不整片提亮，湿地面本来该暗一点）；
  // 暴雨时远处（画面上边）发灰。画在光照之前，夜里跟着暗
  drawSheen(ctx, view, weather, time, calm) {
    if (!LOOK41.on) return;
    const wet = this.wet;
    if (wet > 0.05 && !calm) {
      const slot = Math.floor(time * 2),
        n = Math.round(48 * wet);
      ctx.fillStyle = "#eef6ff";
      for (let i = 0; i < n; i++) {
        const k = ((time * 2) % 1) + hash2(i, slot, 5) * 0.6;
        if (k > 1) continue;
        ctx.globalAlpha = 0.6 * Math.sin(Math.PI * k);
        const x = Math.round((view.x + hash2(i, slot, 6) * view.w) / 2) * 2,
          y = Math.round((view.y + hash2(i, slot, 7) * view.h) / 2) * 2;
        ctx.fillRect(x, y, 2, 2);
        if (hash2(i, slot, 8) > 0.6) ctx.fillRect(x + 2, y, 2, 2);
      }
      ctx.globalAlpha = 1;
    }
    if (weather === "暴雨") {
      // 一条条横带，越往上越灰（像素画的台阶，也比渐变省得多）
      const N = 8,
        top = Math.floor(view.y / 2) * 2,
        step = Math.max(2, Math.round(view.h / 2 / N / 2) * 2);
      ctx.fillStyle = "rgb(150,164,178)";
      for (let i = 0; i < N; i++) {
        ctx.globalAlpha = 0.26 * (1 - (i + 0.5) / N);
        ctx.fillRect(view.x - 2, top + i * step, view.w + 4, step);
      }
      ctx.globalAlpha = 1;
    }
  }
  // 暴雨和酸雨时一层层飘过的雾
  drawMist(ctx, view, weather, time, calm) {
    if (!["暴雨", "酸雨"].includes(weather) || calm) return;
    ctx.fillStyle = weather === "酸雨" ? "#c8d29a" : "#c8d4dc";
    for (let i = 0; i < 6; i++) {
      const y = Math.round((view.y + ((i * 173 + time * 6) % (view.h + 120)) - 60) / 2) * 2,
        x = Math.round((view.x + ((i * 311 + time * 22) % (view.w + 400)) - 300) / 2) * 2;
      ctx.globalAlpha = 0.07;
      ctx.fillRect(x, y, 360, 14);
      ctx.fillRect(x + 40, y - 8, 260, 8);
      ctx.fillRect(x - 30, y + 14, 420, 6);
    }
    ctx.globalAlpha = 1;
  }
  // 下雪：慢慢飘、左右晃，近处的雪片大一点
  drawSnow(ctx, view, heavy, time, calm) {
    const n = calm ? 50 : heavy ? 280 : 140,
      fall = heavy ? 70 : 42;
    ctx.fillStyle = "#f6f8f2";
    for (let i = 0; i < n; i++) {
      const near = hash2(i, 4, 9) > 0.8,
        speed = (0.6 + hash2(i, 3, 9) * 0.6) * (near ? 1.6 : 1),
        sy = hash2(i, 2, 9) * (view.h + 100),
        y = ((sy + time * fall * speed) % (view.h + 100)) - 50,
        sway = calm ? 0 : Math.sin(time * (0.8 + hash2(i, 5, 9)) + i) * 10,
        x = ((hash2(i, 1, 9) * (view.w + 100) + sway + time * (heavy ? 26 : 8)) % (view.w + 100)) - 50,
        wx = Math.round((view.x + x) / 2) * 2,
        wy = Math.round((view.y + y) / 2) * 2;
      ctx.globalAlpha = near ? 0.6 : 0.4;
      ctx.fillStyle = "#8b9ea4";
      ctx.fillRect(wx, wy + 2, near ? 4 : 2, 2);
      ctx.globalAlpha = near ? 0.95 : 0.75;
      ctx.fillStyle = "#f6f8f2";
      ctx.fillRect(wx, wy, near ? 4 : 2, 2);
    }
    ctx.globalAlpha = 1;
  }
  // 常年的薄雾（松林）：几条很淡的雾带慢慢飘过
  drawFog(ctx, view, time, calm, color = "#cfd8cc", strength = 1) {
    ctx.fillStyle = color;
    for (let i = 0; i < 7; i++) {
      const y = Math.round((view.y + ((i * 151 + (calm ? 0 : time * 4)) % (view.h + 160)) - 80) / 2) * 2,
        x = Math.round((view.x + ((i * 283 + (calm ? 0 : time * 9)) % (view.w + 500)) - 400) / 2) * 2;
      ctx.globalAlpha = 0.05 * strength;
      ctx.fillRect(x, y, 420, 18);
      ctx.fillRect(x + 50, y - 10, 300, 10);
      ctx.fillRect(x - 40, y + 18, 480, 8);
    }
    ctx.globalAlpha = 1;
  }
  // 落地的水花（酸雨是一缕小烟）
  drawSplashes(ctx, view, weather, time, calm) {
    if (!["小雨", "暴雨", "酸雨"].includes(weather) || calm) return;
    const n = weather === "暴雨" ? 46 : 26,
      acid = weather === "酸雨";
    for (let i = 0; i < n; i++) {
      const period = 0.45 + hash2(i, 5, 3) * 0.4,
        cycle = Math.floor((time + hash2(i, 6, 3) * period) / period),
        k = ((time + hash2(i, 6, 3) * period) % period) / period;
      if (k > 0.5) continue;
      const x = Math.round((view.x + hash2(i, cycle, 7) * view.w) / 2) * 2,
        y = Math.round((view.y + hash2(i, cycle, 8) * view.h) / 2) * 2;
      ctx.globalAlpha = 0.55 * (1 - k * 2);
      if (acid) {
        ctx.fillStyle = "#b9c48a";
        ctx.fillRect(x, y - Math.round(k * 8) * 2, 2, 2);
        ctx.fillRect(x + 2, y - Math.round(k * 8) * 2 - 4, 2, 2);
      } else {
        ctx.fillStyle = "#e2eef0";
        const s = k < 0.25 ? 2 : 4;
        ctx.fillRect(x - s, y - 2, 2, 2);
        ctx.fillRect(x + s, y - 2, 2, 2);
        ctx.fillRect(x, y, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
  // 水洼：路面积水，倒映天光，下雨时有涟漪
  drawPuddles(ctx, spots, time, sky, raining) {
    if (this.wet <= 0.03) return;
    const [r, g, b] = sky,
      refl = `rgb(${Math.round(70 + r * 0.45)},${Math.round(84 + g * 0.45)},${Math.round(100 + b * 0.5)})`;
    for (const p of spots) {
      const grow = Math.min(1, this.wet * 1.4 - (p.seed % 5) * 0.08);
      if (grow <= 0) continue;
      const rx = Math.max(1, Math.round(p.rx * grow)),
        ry = Math.max(1, Math.round(p.ry * grow));
      ctx.globalAlpha = 0.62;
      ctx.fillStyle = "#2c3a40";
      for (let dy = -ry; dy <= ry; dy++) {
        const half = Math.round(rx * Math.sqrt(1 - (dy * dy) / (ry * ry + 0.4)));
        ctx.fillRect((p.x - half) * 2, (p.y + dy) * 2, half * 4 + 2, 2);
      }
      ctx.globalAlpha = 0.7;
      ctx.fillStyle = refl;
      for (let dy = -ry + 1; dy < ry; dy++) {
        const half = Math.round((rx - 1) * Math.sqrt(1 - (dy * dy) / (ry * ry + 0.4)));
        if (half > 0) ctx.fillRect((p.x - half) * 2, (p.y + dy) * 2, half * 4, 2);
      }
      ctx.globalAlpha = 0.8;
      ctx.fillStyle = "#e8f0ee";
      ctx.fillRect((p.x - Math.max(1, rx - 2)) * 2, (p.y - Math.max(0, ry - 1)) * 2, 4, 2);
      if (raining) {
        const k = (time * 1.3 + p.seed * 0.37) % 1,
          rr = Math.round(1 + k * (rx - 1));
        ctx.globalAlpha = 0.5 * (1 - k);
        ctx.fillRect((p.x - rr) * 2, p.y * 2, 2, 2);
        ctx.fillRect((p.x + rr) * 2, p.y * 2, 2, 2);
      }
    }
    ctx.globalAlpha = 1;
  }
}

export const WARM = [255, 180, 104],
  FIRE = [255, 168, 88],
  LAMP = [255, 214, 140],
  SCREEN = [150, 230, 170],
  EMBER = [255, 110, 50],
  FIREFLY = [214, 250, 140];
export const toCss = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
export const palRgb = (name, i) => rgb(PAL[name][i]);
