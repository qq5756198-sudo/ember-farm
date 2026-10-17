// v0.35.0「长夜」的画面：长夜那天 18:00 起（天边发红的时候）慢慢换上这一夜的样子，长夜里一直是——
// 雾夜一层雾（人身边一圈看得清）、春雷夜下大雨、满月夜亮一些、闷热夜发黄、迁徙夜发褐、大风夜一阵阵风、冰夜飘小雪发蓝、雪夜下大雪；
// 废墟里 7 天内倒下过的地方插一根小旗（隧道每天的样子不一样，不画）。
// 只是画出来，不挡路；“减少闪烁与震屏”下雾和风不动。
import { Renderer as GrowRenderer } from "./grow-renderer.js";
import { PHASES, PHASE_LOOK } from "./nightfall-data.js";
import { HORDE_DIRECTIONS } from "./expansion-data.js";

const FOG = [196, 204, 204];

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
    let out = base.map((v, i) => Math.round(v + (L.look.tint[i] - v) * f));
    if (L.look.bright) out = out.map((v) => Math.round(v + (255 - v) * L.look.bright * L.k));
    return out;
  }
  drawNight(e) {
    const L = this.v && !this.indoor ? this.nfLook(e) : null,
      w0 = this.vWeather;
    // 春雷夜、冰夜、雪夜：借用原来的雨雪
    if (L?.look.weather) this.vWeather = L.look.weather;
    try {
      super.drawNight(e);
    } finally {
      this.vWeather = w0;
    }
    if (!this.v || !this.ctx) return;
    if (L?.look.fog) this.nfFog(e, L);
    if (L?.look.wind) this.nfWind(e, L);
    if (!this.indoor) this.nfFallFlags(e);
  }
  // 雾：人身边一圈看得清，往外越来越白
  nfFog(e, L) {
    const c = this.ctx,
      p = e.s.player,
      sc = this.camera.scale,
      view = { x: this.camera.x, y: this.camera.y, w: this.w / sc, h: this.h / sc },
      clear = PHASES.fog.fx.clear,
      a = 0.62 * L.k;
    c.save();
    const g = c.createRadialGradient(p.x, p.y - 20, clear * 0.7, p.x, p.y - 20, clear + 260);
    g.addColorStop(0, `rgba(${FOG.join(",")},0)`);
    g.addColorStop(0.35, `rgba(${FOG.join(",")},${(a * 0.45).toFixed(3)})`);
    g.addColorStop(1, `rgba(${FOG.join(",")},${a.toFixed(3)})`);
    c.fillStyle = g;
    c.fillRect(view.x - 40, view.y - 40, view.w + 80, view.h + 80);
    if (this.wx?.drawFog) this.wx.drawFog(c, view, this.time || 0, this.calm, "#dfe6e2", 3 * L.k);
    c.restore();
  }
  // 大风：一道道白线从风来的那一边扫过来
  nfWind(e, L) {
    if (this.calm) return;
    const N = e.ln?.night,
      day = N ? N.day : e.s.day,
      d = e.lnDirs?.(day)?.[0],
      from = HORDE_DIRECTIONS[d] || HORDE_DIRECTIONS[0],
      ang = Math.atan2(480 - from.y, 830 - from.x),
      ux = Math.cos(ang),
      uy = Math.sin(ang),
      c = this.ctx,
      sc = this.camera.scale,
      vw = this.w / sc,
      vh = this.h / sc,
      t = this.time || 0;
    c.save();
    c.fillStyle = "#e6ede9";
    for (let i = 0; i < 36; i++) {
      const h1 = ((i * 9301 + 49297) % 233280) / 233280,
        h2 = ((i * 4969 + 7) % 233280) / 233280,
        run = (t * (420 + h1 * 200) + h1 * 2000) % (vw + vh + 400),
        // 沿着风向走，垂直方向按 h2 铺开
        bx = this.camera.x + vw / 2 + ux * (run - (vw + vh) / 2) - uy * (h2 - 0.5) * (vw + vh),
        by = this.camera.y + vh / 2 + uy * (run - (vw + vh) / 2) + ux * (h2 - 0.5) * (vw + vh);
      c.globalAlpha = (0.18 + 0.2 * h2) * L.k;
      for (let k = 0; k < 7; k++) c.fillRect(Math.round((bx - ux * k * 6) / 2) * 2, Math.round((by - uy * k * 6) / 2) * 2, 2, 2);
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
      const x = Math.round(f.x / 2) * 2,
        y = Math.round(f.y / 2) * 2,
        wave = this.calm ? 0 : Math.round(Math.sin(t * 3 + f.day) * 1);
      c.globalAlpha = 0.85;
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
