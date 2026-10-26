// v0.35.0「长夜」的画面：长夜那天 18:00 起（天边发红的时候）慢慢换上这一夜的样子，长夜里一直是——
// 天色往这一夜的颜色拉（盖过一部分长夜的红）：雾夜灰、春雷夜青黑、满月夜发蓝、闷热夜橙、迁徙夜土黄、大风夜铁灰、冰夜冷蓝、雪夜灰白；
// 再画上这一夜的东西：雾夜一层雾（人身边一圈看得清）、春雷夜下大雨打闪、闷热夜一点点往上飘的热气、迁徙夜从尸群来的方向刮土、
// 大风夜一道道风、冰夜飘小雪、雪夜下大雪。这些画在光照之后（夜里也看得见）；
// 废墟里 7 天内倒下过的地方插一根小旗（隧道每天的样子不一样，不画）。
// 只是画出来，不挡路；“减少闪烁与震屏”下不打闪、雨雪少、雾和风不动。
import { Renderer as GrowRenderer } from "./grow-renderer.js";
import { PHASES, PHASE_LOOK } from "./nightfall-data.js";
import { HORDE_DIRECTIONS } from "./expansion-data.js";

const FOG = [92, 100, 104];
const hash = (i, k) => {
  const v = Math.sin(i * 127.1 + k * 311.7) * 43758.5453;
  return v - Math.floor(v);
};
const snap = (v) => Math.round(v / 2) * 2;

export class Renderer extends GrowRenderer {
  draw(engine, mouse, dt = 0.016) {
    this._nfE = engine;
    return super.draw(engine, mouse, dt);
  }
  // 这一夜的样子和浓淡（0–1）；不在农场、不是长夜那天就没有
  nfLook(e) {
    if (!e?.nf || e.s?.region !== "farm") return null;
    const ph = e.nfTonight?.();
    if (!ph || !PHASE_LOOK[ph]) return null;
    const k = e.ln?.night ? 1 : e.lnSky?.() || 0;
    return k > 0 ? { ph, k, look: PHASE_LOOK[ph] } : null;
  }
  tintAmbient(amb, e) {
    const base = super.tintAmbient(amb, e) || amb,
      L = this.nfLook(this._nfE || e);
    if (!L?.look.tint) return base;
    const f = L.look.k * L.k;
    return base.map((v, i) => Math.round(v + (L.look.tint[i] - v) * f));
  }
  // 春雷夜打闪：借用天气的闪光（天一下子亮、白一下），隔 6–15 秒一次
  stepFx(e, dt) {
    super.stepFx(e, dt);
    const L = this.nfLook(e);
    if (!L?.look.flash || this.calm || e.paused || L.k < 1 || !this.wx) {
      this._nfFlashAt = null;
      return;
    }
    const t = this.time || 0;
    if (this._nfFlashAt == null) this._nfFlashAt = t + 3;
    if (t >= this._nfFlashAt) {
      this._nfFlashN = (this._nfFlashN || 0) + 1;
      this.wx.flash = 1;
      this._nfFlashAt = t + 6 + hash(this._nfFlashN, 9) * 9;
    }
  }
  drawNight(e) {
    super.drawNight(e);
    if (!this.v || !this.ctx || this.indoor) return;
    const L = this.nfLook(e);
    if (L) {
      const sc = this.camera.scale,
        view = { x: this.camera.x, y: this.camera.y, w: this.w / sc, h: this.h / sc },
        look = L.look;
      if (look.fog) this.nfFog(e, L, view);
      if (look.motes) this.nfMotes(L, view);
      if (look.dust) this.nfStreaks(e, L, view, { n: 34, color: "#d9c299", len: [10, 30], speed: 170, alpha: [0.22, 0.42], wave: 0, specks: 110, speck: ["#dcc69c", "#b89a6c"], haze: [150, 118, 78] });
      if (look.wind) this.nfStreaks(e, L, view, { n: 26, color: "#eef2ee", len: [50, 130], speed: 560, alpha: [0.3, 0.52], wave: 3, specks: 36, speck: ["#9c8a4e", "#6f7d3c", "#a4683c"], leaf: true });
      if (look.rain) this.nfRain(L, view);
      if (look.snow) this.nfSnow(L, view, look.snow > 1);
    }
    this.nfFallFlags(e);
  }
  // 雾：人身边一圈看得清，往外越来越浓；几条淡淡的雾带慢慢飘
  nfFog(e, L, view) {
    const c = this.ctx,
      p = e.s.player,
      clear = PHASES.fog.fx.clear,
      a = 0.62 * L.k,
      fog = (this.fogTint?.(FOG) || FOG).join(",");
    c.save();
    const g = c.createRadialGradient(p.x, p.y - 20, clear * 0.55, p.x, p.y - 20, clear + 260);
    g.addColorStop(0, `rgba(${fog},0)`);
    g.addColorStop(0.3, `rgba(${fog},${(a * 0.45).toFixed(3)})`);
    g.addColorStop(1, `rgba(${fog},${a.toFixed(3)})`);
    c.fillStyle = g;
    c.fillRect(view.x - 40, view.y - 40, view.w + 80, view.h + 80);
    if (this.wx?.drawFog) this.wx.drawFog(c, view, this.time || 0, this.calm, "#a7b0b2", 1.4 * L.k);
    c.restore();
  }
  // 春雷夜的雨：斜着落的雨丝
  nfRain(L, view) {
    const c = this.ctx,
      t = this.calm ? 0 : this.time || 0,
      n = this.calm ? 70 : 230,
      W = view.w + 200,
      H = view.h + 200;
    c.save();
    c.fillStyle = "#cbd8e4";
    for (let i = 0; i < n; i++) {
      const sp = 0.8 + hash(i, 3) * 0.4,
        y = ((hash(i, 2) * H + t * 760 * sp) % H) - 100,
        x = ((((hash(i, 1) * W - y * 0.3 + t * 230 * sp) % W) + W) % W) - 100,
        wx = snap(view.x + x),
        wy = snap(view.y + y),
        len = hash(i, 6) > 0.6 ? 24 : 16;
      c.globalAlpha = (0.26 + 0.24 * hash(i, 4)) * L.k;
      for (let k = 0; k < len; k += 4) c.fillRect(wx - snap(k * 0.3), wy + k, 2, 4);
    }
    c.restore();
  }
  // 冰夜的小雪、雪夜的大雪（近处的大片一些、落得快一些）
  nfSnow(L, view, heavy) {
    const c = this.ctx,
      t = this.calm ? 0 : this.time || 0,
      n = this.calm ? 60 : heavy ? 280 : 120,
      fall = heavy ? 78 : 42,
      W = view.w + 100,
      H = view.h + 100;
    c.save();
    c.fillStyle = "#f2f5f2";
    for (let i = 0; i < n; i++) {
      const near = hash(i, 4) > (heavy ? 0.72 : 0.82),
        sp = (0.6 + hash(i, 3) * 0.6) * (near ? 1.7 : 1),
        y = ((hash(i, 2) * H + t * fall * sp) % H) - 50,
        sway = Math.sin(t * (0.8 + hash(i, 5)) + i) * 10,
        x = ((((hash(i, 1) * W + sway + t * (heavy ? 30 : 8)) % W) + W) % W) - 50,
        wx = snap(view.x + x),
        wy = snap(view.y + y);
      c.globalAlpha = (near ? 0.9 : 0.6) * L.k;
      c.fillRect(wx, wy, near ? 4 : 2, near ? 4 : 2);
      if (near && heavy) {
        c.globalAlpha = 0.35 * L.k;
        c.fillRect(wx - 2, wy + 2, 2, 2);
        c.fillRect(wx + 4, wy, 2, 2);
      }
    }
    c.restore();
  }
  // 闷热夜：一点点暖色的热气慢慢往上飘
  nfMotes(L, view) {
    const c = this.ctx,
      t = this.calm ? 0 : this.time || 0,
      n = this.calm ? 30 : 70,
      W = view.w + 60,
      H = view.h + 120;
    c.save();
    for (let i = 0; i < n; i++) {
      const sp = 14 + hash(i, 3) * 22,
        y = H - (((hash(i, 2) * H + t * sp) % H) + 60),
        x = hash(i, 1) * W - 30 + Math.sin(t * (0.6 + hash(i, 5)) + i * 1.7) * 14,
        life = 1 - y / H;
      c.globalAlpha = (0.18 + 0.3 * hash(i, 4)) * L.k * Math.min(1, life * 3, (1 - life) * 3 + 0.2);
      c.fillStyle = hash(i, 6) > 0.5 ? "#ffcf86" : "#f2a35c";
      c.fillRect(snap(view.x + x), snap(view.y + y), 2, 2);
    }
    c.globalAlpha = 0.07 * L.k;
    c.fillStyle = "#ff9a4a";
    c.fillRect(view.x, view.y + view.h * 0.55, view.w, view.h * 0.45);
    c.restore();
  }
  // 从尸群来的那一边刮过来的（大风夜：一道道长长的风、卷着叶子；迁徙夜：那一边起一层土、短短的土线和土粒）
  nfStreaks(e, L, view, o) {
    const N = e.ln?.night,
      day = N ? N.day : e.s.day,
      d = e.lnDirs?.(day)?.[0],
      from = HORDE_DIRECTIONS[d] || HORDE_DIRECTIONS[0],
      ang = Math.atan2(480 - from.y, 830 - from.x),
      ux = Math.cos(ang),
      uy = Math.sin(ang),
      c = this.ctx,
      t = this.calm ? 0 : this.time || 0,
      cx = view.x + view.w / 2,
      cy = view.y + view.h / 2;
    c.save();
    if (o.haze) {
      // 那一边的天地之间起一层土
      const x0 = cx - ux * view.w * 0.6,
        y0 = cy - uy * view.h * 0.6,
        g = c.createLinearGradient(x0, y0, cx + ux * view.w * 0.1, cy + uy * view.h * 0.1);
      g.addColorStop(0, `rgba(${o.haze.join(",")},${(0.42 * L.k).toFixed(3)})`);
      g.addColorStop(1, `rgba(${o.haze.join(",")},0)`);
      c.fillStyle = g;
      c.fillRect(view.x, view.y, view.w, view.h);
    }
    // 每一道都在镜头里：按风向走，出了一边从另一边回来
    const W = view.w + 260,
      H = view.h + 260,
      at = (i, k1, k2, sp) => [view.x - 130 + ((((hash(i, k1) * W + ux * t * sp) % W) + W) % W), view.y - 130 + ((((hash(i, k2) * H + uy * t * sp) % H) + H) % H)];
    c.fillStyle = o.color;
    const n = this.calm ? Math.round(o.n / 3) : o.n;
    for (let i = 0; i < n; i++) {
      const h1 = hash(i, 7),
        h2 = hash(i, 8),
        len = o.len[0] + (o.len[1] - o.len[0]) * hash(i, 10),
        sp = o.speed * (0.8 + h1 * 0.5),
        [bx, by] = at(i, 1, 2, sp);
      c.globalAlpha = (o.alpha[0] + (o.alpha[1] - o.alpha[0]) * h2) * L.k;
      for (let k = 0; k < len; k += 2) {
        const w = o.wave ? Math.sin((k + t * sp) / 14) * o.wave : 0;
        c.fillRect(snap(bx - ux * k - uy * w), snap(by - uy * k + ux * w), 2, 2);
      }
    }
    for (let i = 0; i < (this.calm ? 0 : o.specks); i++) {
      const h1 = hash(i, 11),
        h2 = hash(i, 12),
        [x0, y0] = at(i + 500, 1, 2, o.speed * 1.1 * (0.6 + h1 * 0.7)),
        bx = x0 + Math.sin(t * 3 + i) * 6,
        by = y0 + Math.cos(t * 2.4 + i) * 6;
      c.globalAlpha = (0.45 + 0.4 * h2) * L.k;
      c.fillStyle = o.speck[i % o.speck.length];
      // 叶子翻着走：一会儿横、一会儿竖
      if (o.leaf) Math.floor(t * 8 + i) % 2 ? c.fillRect(snap(bx), snap(by), 4, 2) : c.fillRect(snap(bx), snap(by), 2, 4);
      else c.fillRect(snap(bx), snap(by), 2, 2);
    }
    c.restore();
  }
  // 废墟里倒下过的地方：一根小木棍挑着一角红布
  nfFallFlags(e) {
    const marks = e.nfFallMarks?.() || [];
    if (!marks.length) return;
    const c = this.ctx,
      t = this.time || 0;
    c.save();
    for (const f of marks) {
      const x = snap(f.x),
        y = snap(f.y),
        wave = this.calm ? 0 : Math.round(Math.sin(t * 3 + f.day));
      c.globalAlpha = 0.9;
      c.fillStyle = "#1c140f";
      c.fillRect(x - 1, y - 30, 4, 32);
      c.fillStyle = "#8d6340";
      c.fillRect(x, y - 29, 2, 30);
      c.fillStyle = "#a8433a";
      c.fillRect(x + 2, y - 28 + wave, 10, 6);
      c.fillRect(x + 12, y - 26 + wave, 4, 2);
      c.fillStyle = "#d2654c";
      c.fillRect(x + 2, y - 28 + wave, 10, 2);
      c.globalAlpha = 0.35;
      c.fillStyle = "#1c140f";
      c.fillRect(x - 6, y + 2, 14, 4);
    }
    c.restore();
  }
}
