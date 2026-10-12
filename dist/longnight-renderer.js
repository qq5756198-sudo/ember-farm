// v0.25.0「长夜」的画面：长夜那天 18:00 起天边发红（长夜里一直红着），打雷时闪一下（“减少闪烁与震屏”下不闪）；
// 灰隼团反扑：头领“隼头”的金色臂章和名字、探子、摸进来埋东西的人（头上一条进度）、烟雾弹飞过去和炸开的一团烟。
// 动物重画：鸡窝边的鸡（会走、会低头啄）和山羊、阿兰的羊、麦穗（跑起来 4 帧，停下一会儿就坐下）。
// 尸潮、新感染者和头目都按原来的画法；预兆和这些标记都画在光照之后，夜里也看得清。
import { Renderer as UndertowRenderer } from "./undertow-renderer.js";
import { LEADER, COUNTER } from "./longnight-data.js";
import { chickenSprite, goatSprite, sheepSprite, dogSprite } from "./animal-sprites.js";

// 红色的天：把环境色往这个颜色拉
const RED_SKY = [214, 70, 52];
const RED_MAX = 0.38;
const SMOKE = "#b9b4a8";

export class Renderer extends UndertowRenderer {
  draw(engine, mouse, dt = 0.016) {
    this._lnE = engine;
    const bolt = engine?._lx?.bolt;
    if (bolt !== undefined && bolt !== this._lnBolt) {
      if (this._lnBolt !== undefined && !engine.s?.settings?.access?.calm && this.wx) this.wx.flash = Math.max(this.wx.flash || 0, 0.9);
      this._lnBolt = bolt;
    }
    super.draw(engine, mouse, dt);
  }
  // ---------- 动物 ----------
  // 鸡窝边：鸡（index 0）和山羊（index 1）原来是一张不动的图
  atlas(index, x, y, w, h, alpha) {
    if (this.v && (index === 0 || index === 1) && this._lnE?.s?.region === "farm") return index === 0 ? this.drawChickens(x, y) : this.drawGoat(x, y);
    return super.atlas(index, x, y, w, h, alpha);
  }
  // 走一会儿、停下啄一会儿：位置只在走的时候往前挪
  wander(t, i, period = 4, walk = 2.5) {
    const ph = t + i * 1.7,
      n = Math.floor(ph / period),
      r = ph - n * period,
      s = n * walk + Math.min(r, walk);
    return { s, walking: r < walk };
  }
  drawChickens(x, y) {
    const t = this.time * 0.45;
    for (let i = 0; i < 3; i++) {
      const { s, walking } = this.wander(t, i),
        dx = Math.sin(s * 0.9 + i * 2) * 16,
        dy = Math.cos(s * 0.7 + i) * 6,
        left = Math.cos(s * 0.9 + i * 2) < 0,
        frame = this.calm ? 0 : walking ? [0, 1, 0, 3][Math.floor(this.time * 7 + i) % 4] : Math.floor(this.time * 2.5 + i) % 2 ? 2 : 0,
        X = x - 12 + i * 12 + dx,
        Y = y + dy - 4;
      this.pxShadow(X, Y, 10);
      this.px(chickenSprite(frame, i === 1 ? 1 : 0), X, Y, { flip: left });
    }
  }
  drawGoat(x, y) {
    const { s, walking } = this.wander(this.time * 0.25, 5, 6, 2.5),
      dx = Math.sin(s * 0.7) * 12,
      left = Math.cos(s * 0.7) < 0,
      frame = this.calm || !walking ? 0 : Math.floor(this.time * 5) % 4,
      X = x + dx,
      Y = y - 6;
    this.pxShadow(X, Y, 16);
    this.px(goatSprite(frame), X, Y, { flip: left });
  }
  // 阿兰的羊：站着吃草，隔一会儿挪两步
  drawSheep(x, y, t) {
    if (!this.v) return super.drawSheep(x, y, t);
    const k = Math.floor(t * 3),
      frame = this.calm ? 0 : k % 12 < 4 ? [1, 0, 3, 0][k % 4] : 0;
    this.pxShadow(x, y + 2, 14);
    this.px(sheepSprite(frame), x, y + 2, { flip: Math.floor(t / 7) % 2 === 1 });
  }
  // 麦穗：跟着你跑，停下来一会儿就坐下
  frontierSprite(index, x, y, w, h, ...rest) {
    if (!(this.v && index === 0)) return super.frontierSprite(index, x, y, w, h, ...rest);
    const d = (this._dog ??= { x, y, left: false, still: 0, at: this.time });
    const moved = Math.hypot(x - d.x, y - d.y),
      dt = Math.max(0, this.time - d.at);
    if (moved > 0.4) {
      if (Math.abs(x - d.x) > 0.3) d.left = x < d.x;
      d.still = 0;
    } else d.still += dt;
    d.x = x;
    d.y = y;
    d.at = this.time;
    const sit = d.still > 1.5,
      frame = this.calm || moved <= 0.4 ? 0 : Math.floor(this.time * 10) % 4;
    this.pxShadow(x, y, 16);
    this.px(dogSprite(frame, sit), x, y, { flip: d.left });
  }
  tintAmbient(amb) {
    const k = this._lnE?.lnSky?.() || 0;
    if (!(k > 0)) return amb;
    const f = RED_MAX * k;
    return amb.map((v, i) => Math.round(v + (RED_SKY[i] - v) * f));
  }
  drawNight(e) {
    super.drawNight(e);
    if (this.v && e?.ln) this.drawLnMarks(e);
  }
  drawLnMarks(e) {
    const c = this.ctx,
      t = this.time,
      calm = this.calm,
      lx = e._lx,
      px = (x, y, w, h) => c.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h);
    c.save();
    // 烟雾弹：一团灰烟，慢慢散；中间浓、边上淡，一块块方的烟团慢慢飘
    for (const s of lx?.smoke || []) {
      const fade = Math.min(1, s.t / 1.5, (s.max - s.t) / 0.4 + 0.2),
        r = s.r * Math.min(1, 0.55 + s.t / s.max),
        seed = Math.round(s.x * 7 + s.y * 13);
      for (let i = 0; i < 90; i++) {
        const h1 = ((seed + i * 9301 + 49297) % 233280) / 233280,
          h2 = ((seed * 3 + i * 4969 + 7) % 233280) / 233280,
          a = h1 * Math.PI * 2 + (calm ? 0 : t * 0.18 * (i % 2 ? 1 : -1)),
          d = r * Math.sqrt(h2),
          size = 12 + ((i * 7) % 4) * 4;
        c.fillStyle = i % 3 ? SMOKE : "#cfc9bc";
        c.globalAlpha = (0.32 + 0.25 * (1 - d / r)) * fade;
        px(s.x + Math.cos(a) * d - size / 2, s.y + Math.sin(a) * d * 0.62 - size / 2 - 12, size, size);
      }
    }
    c.globalAlpha = 1;
    // 飞着的烟雾弹
    for (const g of lx?.grenades || []) {
      const k = Math.min(1, g.t / g.fly),
        x = g.x0 + (g.x - g.x0) * k,
        y = g.y0 + (g.y - g.y0) * k - Math.sin(k * Math.PI) * 60;
      c.fillStyle = "#140f0b";
      px(x - 4, y - 4, 8, 8);
      c.fillStyle = "#7f8a6a";
      px(x - 2, y - 2, 4, 4);
      // 落点：一圈虚线点
      c.fillStyle = "#cfc6a8";
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2;
        c.globalAlpha = 0.5 + 0.5 * k;
        px(g.x + Math.cos(a) * 40 - 2, g.y + Math.sin(a) * 24 - 2, 4, 4);
      }
      c.globalAlpha = 1;
    }
    // 头领、探子、埋东西的人：名字和进度
    for (const z of e.enemies || []) {
      if (z.dead || z.type !== "raider" || !(z.leader || z.scout || z.saboteur)) continue;
      if (z.leader) {
        c.fillStyle = "#140f0b";
        px(z.x - 13, z.y - 58, 26, 5);
        c.fillStyle = "#e9c05a";
        px(z.x - 12, z.y - 57, 24, 3);
        this._pixelText("“" + LEADER.name + "”", z.x, z.y - 104, "#ffdb8c", 13);
      } else if (z.scout) this._pixelText("探子", z.x, z.y - 100, "#e6c48a", 11);
      else if (z.saboteur) {
        this._pixelText(z.flee ? "跑了" : "摸进来的人", z.x, z.y - 100, "#f1a28a", 11);
        if (z.plant > 0 && !z.flee) {
          const w = 46,
            f = Math.min(1, z.plant / COUNTER.sabotage.plant);
          c.fillStyle = "#140f0b";
          px(z.x - w / 2 - 2, z.y - 92, w + 4, 8);
          c.fillStyle = "#3a2a1f";
          px(z.x - w / 2, z.y - 90, w, 4);
          c.fillStyle = f > 0.7 && !calm && Math.sin(t * 14) > 0 ? "#ffdb8c" : "#bf5a28";
          px(z.x - w / 2, z.y - 90, Math.round(w * f), 4);
          this._pixelText("埋东西 " + Math.round(f * 100) + "%", z.x, z.y - 114, "#ffdb8c", 11);
        }
      }
    }
    c.restore();
  }
}
