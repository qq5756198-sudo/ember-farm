// 新画面的光影与天气：一天四段的环境色、火光灯光（一圈圈像素色阶）、雨丝水花水洼、酸雨的小烟、高温的泛白与热浪、
// 闪电、篝火的火星和烟、夜里的萤火虫和余烬。
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
const blend = (c, to, t) => c.map((v, k) => Math.round(v + (to[k] - v) * t));
export function ambientFor(minute, weather) {
  let c = skyColor(minute);
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
const RINGS = [[1, 0.1], [0.84, 0.11], [0.68, 0.13], [0.52, 0.15], [0.36, 0.18], [0.22, 0.22]],
  RINGS_SMALL = [[1, 0.16], [0.6, 0.22], [0.3, 0.3]];
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
      // 四圈色阶：外圈淡、内圈亮
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
  // 雨丝：只画在镜头范围内，对齐像素
  drawRain(ctx, view, weather, time, calm) {
    if (!["小雨", "暴雨", "酸雨"].includes(weather)) return;
    const storm = weather === "暴雨",
      acid = weather === "酸雨",
      n = calm ? 60 : storm ? 380 : 200,
      fall = storm ? 680 : 460,
      slant = storm ? 0.34 : 0.16,
      len = storm ? 14 : 10;
    ctx.fillStyle = acid ? "#d4e08e" : "#dfeaf2";
    ctx.globalAlpha = storm ? 0.62 : 0.55;
    for (let i = 0; i < n; i++) {
      const sx = hash2(i, 1, 9) * (view.w + 200),
        sy = hash2(i, 2, 9) * (view.h + 200),
        speed = 0.8 + hash2(i, 3, 9) * 0.4,
        y = ((sy + time * fall * speed) % (view.h + 200)) - 100,
        x = ((sx - y * slant + time * fall * slant * speed) % (view.w + 200) + view.w + 200) % (view.w + 200) - 100,
        wx = Math.round((view.x + x) / 2) * 2,
        wy = Math.round((view.y + y) / 2) * 2;
      for (let k = 0; k < len; k += 2) ctx.fillRect(wx - Math.round(k * slant / 2) * 2, wy + k, 2, 2);
    }
    ctx.globalAlpha = 1;
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
