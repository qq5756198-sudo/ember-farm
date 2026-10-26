// 新画面的光影与天气：一天四段的环境色、火光灯光（一圈圈像素色阶）、雨丝水花水洼、酸雨的小烟、高温的泛白与热浪、
// 闪电、篝火的火星和烟、夜里的萤火虫和余烬。
// v0.41「看得清」：夜里留月光（显示用的天色深夜不低于 #6472A2，暗处再“滤色”一层 #0C111D 的底）；灯光 12 圈细台阶。
// “天黑没有”（灯亮不亮、萤火虫、感染者的眼睛）照旧按原来的天色算，别处的规矩不跟着变。
import { makeCanvas, hash2, PAL, rgb } from "./pixel-kit.js";

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
// 夜里的雾、风雪：颜色往月光的蓝偏一点，亮度不变（雾里看得清看不清和原来一样）
export function moonTint(col, moon, k = 0.6) {
  const Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2],
    f = Y(col) / Y(MOON),
    t = Math.max(0, Math.min(1, moon)) * k;
  return col.map((v, i) => Math.max(0, Math.min(255, Math.round(v + (MOON[i] * f - v) * t))));
}
// lifted：显示用（有月光）；false 是 v0.40 的算法（光外的感染者还按它画）
export function ambientFor(minute, weather, lifted = true) {
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
// v0.41：12 圈细台阶（原来 6 圈硬边），加起来和原来一样亮
export const RINGS = [[1, 0.082], [0.91, 0.055], [0.82, 0.062], [0.73, 0.071], [0.64, 0.074], [0.55, 0.084], [0.46, 0.085], [0.38, 0.096], [0.3, 0.091], [0.23, 0.086], [0.16, 0.079], [0.1, 0.024]],
  RINGS_SMALL = [[1, 0.13], [0.8, 0.093], [0.6, 0.119], [0.42, 0.148], [0.26, 0.14], [0.14, 0.05]];
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
  // lights: [{x,y,r,color:[r,g,b],power}] 地图坐标
  render(view, ambient, lights) {
    const ART = 2,
      w = Math.ceil(view.w / ART) + 2,
      h = Math.ceil(view.h / ART) + 2;
    if (!this.ensure(w, h)) return null;
    const c = this.ctx,
      ox = Math.floor(view.x / ART),
      oy = Math.floor(view.y / ART);
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
      for (const [k, a] of l.small ? RINGS_SMALL : RINGS) {
        c.fillStyle = `rgba(${cr},${cg},${cb},${a * p})`;
        c.beginPath();
        c.ellipse(Math.round(lx), Math.round(ly), Math.max(1, Math.round(r * k)), Math.max(1, Math.round(r * k * (l.flat ?? 0.82))), 0, 0, Math.PI * 2);
        c.fill();
      }
    }
    c.globalCompositeOperation = "source-over";
    return { canvas: this.canvas, x: ox * ART, y: oy * ART, w: w * ART, h: h * ART };
  }
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
      // v0.41：加密一倍（雨丝本来就是 1 个美术像素宽）
      n = calm ? 120 : storm ? 520 : 300,
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
  // v0.41：地上湿了起一层湿光（亮处偏蓝白，几点一闪一闪的反光）；暴雨时远处（画面上边）发灰。画在光照之前，夜里跟着暗
  drawSheen(ctx, view, weather, time, calm) {
    const wet = this.wet;
    if (wet > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = "soft-light";
      ctx.globalAlpha = 0.22 * wet;
      ctx.fillStyle = "#cfe0ff";
      ctx.fillRect(view.x, view.y, view.w, view.h);
      ctx.restore();
      if (!calm) {
        const slot = Math.floor(time * 2);
        ctx.fillStyle = "#eef6ff";
        for (let i = 0; i < 28; i++) {
          const k = ((time * 2) % 1) + hash2(i, slot, 5) * 0.6;
          if (k > 1) continue;
          ctx.globalAlpha = 0.55 * wet * Math.sin(Math.PI * k);
          ctx.fillRect(Math.round((view.x + hash2(i, slot, 6) * view.w) / 2) * 2, Math.round((view.y + hash2(i, slot, 7) * view.h) / 2) * 2, 2, 2);
        }
        ctx.globalAlpha = 1;
      }
    }
    if (weather === "暴雨") {
      const g = ctx.createLinearGradient(0, view.y, 0, view.y + view.h * 0.5);
      g.addColorStop(0, "rgba(150,164,178,0.26)");
      g.addColorStop(1, "rgba(150,164,178,0)");
      ctx.fillStyle = g;
      ctx.fillRect(view.x, view.y, view.w, view.h * 0.5);
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
