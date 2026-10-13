// v0.26.0「整顿」的画面：长夜里菜地北边的警钟（头上写下一波还有几秒，能敲时一闪一闪）、
// 居民头上的心情（高昂一张笑脸、低落一朵灰云、来劲时身边冒金星、闹情绪一朵带闪电的云）、
// 有人守的瞭望塔塔顶亮灯（没人守的夜里是黑的）、拉响的信标一圈圈往外响和头顶倒计时、机床加急冒烟和卡料的红牌。
// 这些标记都画在光照之后，夜里也看得清。
import { Renderer as LongNightRenderer } from "./longnight-renderer.js";
import { PAL, OUTLINE, Pix, cached } from "./pixel-kit.js";
import { SPOTS } from "./outpost-data.js";
import { LN_PACE } from "./tidy-data.js";

// ---------- 小图 ----------
// 警钟：两根木柱一根横梁，下面挂一口铜钟；swing 是摇到哪边
function bellSprite(swing = 0) {
  return cached("tdbell:" + swing, () => {
    const P = new Pix(22, 32),
      W = PAL.soil,
      B = [PAL.rust[1], PAL.rust[2], PAL.rust[3], PAL.ember[4]];
    P.rect(2, 4, 2, 27, W[2]);
    P.vline(2, 4, 30, W[3]);
    P.rect(18, 4, 2, 27, W[2]);
    P.vline(18, 4, 30, W[3]);
    P.rect(1, 2, 20, 3, W[3]);
    P.hline(1, 20, 2, W[4]);
    P.rect(1, 29, 4, 2, W[1]);
    P.rect(17, 29, 4, 2, W[1]);
    const x = 11 + swing;
    P.vline(x, 5, 7, PAL.straw[1]);
    // 钟身：上窄下宽
    P.rect(x - 2, 8, 4, 2, B[1]);
    P.rect(x - 3, 10, 6, 6, B[2]);
    P.rect(x - 4, 16, 8, 3, B[2]);
    P.hline(x - 5, x + 4, 19, B[0]);
    P.vline(x - 2, 10, 17, B[3]);
    P.set(x - 1, 9, B[3]);
    P.rect(x - 1, 20, 2, 2, PAL.ash[1]);
    P.outline(OUTLINE);
    return P.toCanvas();
  });
}
// 头上的心情：7×7
function moodSprite(kind) {
  return cached("tdmood:" + kind, () => {
    const P = new Pix(9, 9);
    if (kind === "high") {
      P.disc(4, 4, 3.6, PAL.straw[3]);
      P.set(3, 3, PAL.ash[1]);
      P.set(5, 3, PAL.ash[1]);
      P.hline(3, 5, 6, PAL.ash[1]);
      P.set(2, 5, PAL.ash[1]);
      P.set(6, 5, PAL.ash[1]);
    } else if (kind === "low") {
      P.rect(1, 2, 7, 3, PAL.stone[3]);
      P.rect(2, 1, 4, 1, PAL.stone[3]);
      P.hline(1, 7, 4, PAL.stone[2]);
      P.set(3, 6, PAL.water[4]);
      P.set(5, 7, PAL.water[4]);
    } else {
      // 闹情绪：一朵深色的云带一道闪电
      P.rect(1, 1, 7, 3, PAL.ash[3]);
      P.hline(1, 7, 3, PAL.ash[2]);
      P.set(4, 4, PAL.ember[4]);
      P.set(3, 5, PAL.ember[4]);
      P.set(4, 6, PAL.ember[4]);
    }
    P.outline(OUTLINE);
    return P.toCanvas();
  });
}

export class Renderer extends LongNightRenderer {
  draw(engine, mouse, dt = 0.016) {
    this._tdE = engine;
    super.draw(engine, mouse, dt);
  }
  // ---------- 警钟 ----------
  drawObject(o, e) {
    if (o?.type === "tdBell") {
      const can = !e.lnBellReason?.();
      if (this.v) {
        const swing = can && !this.calm ? [0, 1, 0, -1][Math.floor(this.time * 3) % 4] : 0;
        this.pxShadow(o.x, o.y, 30);
        this.px(bellSprite(swing), o.x, o.y + 4);
      } else {
        this.shadow?.(o.x, o.y, 18);
        this.sprite(55, o.x, o.y, 44, 52);
      }
      return;
    }
    super.drawObject(o, e);
    if (o?.type === "outpostLathe" && e?.td) this._tdLathe = { x: o.x, y: o.y };
  }
  // ---------- 有人守的瞭望塔：塔顶亮灯 ----------
  towerLit(b, e) {
    const set = e?.mannedTowers?.();
    return !set || set.has(b.id);
  }
  collectLights(e, night) {
    const lights = super.collectLights(e, night);
    if (!e?.td || e.s.region !== "farm") return lights;
    const set = e.mannedTowers?.();
    if (set?.size) for (const b of e.s.buildings) if (b.type === "tower" && set.has(b.id)) lights.push({ x: b.x, y: b.y - 100, r: 120, color: [235, 205, 140], power: 0.55 });
    const lure = e.pulledLure?.();
    if (lure) lights.push({ x: lure.x, y: lure.y - 40, r: 110, color: [210, 101, 76], power: this.calm ? 0.6 : 0.4 + 0.3 * Math.max(0, Math.sin(this.time * 6)) });
    return lights;
  }
  // ---------- 光照之后：倒计时、心情、信标、机床 ----------
  drawNight(e) {
    super.drawNight(e);
    if (e?.td && e.s.region === "farm") this.drawTidyMarks(e);
  }
  drawTidyMarks(e) {
    const c = this.ctx,
      t = this.time,
      calm = this.calm,
      label = (text, x, y, color, size = 11) => (this.v ? this._pixelText(text, x, y, color, size) : this.text(text, x, y, color, size));
    c.save();
    // 警钟头上：下一波还有几秒
    const N = e.ln?.night && e.lnInfo?.()?.night;
    if (N) {
      const B = LN_PACE.bell,
        nx = N.next,
        can = N.bell;
      const text = nx ? (nx.what === "wave" ? "第 " + nx.k + " 波" : N.bossName) + (nx.secs > 0 ? " " + nx.secs + " 秒" : " 来了") : "最后一波";
      label(text, B.x, B.y - 76, "#ffdb8c", 11);
      if (can) {
        c.globalAlpha = calm ? 1 : 0.55 + 0.45 * Math.max(0, Math.sin(t * 5));
        label("按 E 敲钟", B.x, B.y - 92, "#f6b05a", 11);
        c.globalAlpha = 1;
      }
    }
    // 拉响的信标：一圈圈往外响，头上倒计时
    const lure = e.pulledLure?.();
    if (lure) {
      const left = e.lureLeft();
      for (let k = 0; k < 3; k++) {
        const ph = calm ? k / 3 : (t * 0.8 + k / 3) % 1;
        c.globalAlpha = 0.55 * (1 - ph);
        c.strokeStyle = "#e5823a";
        c.lineWidth = 2;
        c.beginPath();
        c.ellipse(lure.x, lure.y - 30, 20 + ph * 90, (20 + ph * 90) * 0.55, 0, 0, Math.PI * 2);
        c.stroke();
      }
      c.globalAlpha = 1;
      label("信标 " + left + " 秒", lure.x, lure.y - 78, "#f6b05a", 11);
    }
    // 居民头上的心情（平常的不画）
    for (const o of e.objects || []) {
      if (o.type !== "resident") continue;
      const r = e.c.residents.find((x) => x.id === o.resident);
      if (!r) continue;
      const strike = e.striking?.(r),
        tier = e.moodTier?.(r),
        insp = e.inspired?.(r);
      const kind = strike ? "strike" : tier === "low" ? "low" : tier === "high" ? "high" : "";
      const bob = calm ? 0 : Math.round(Math.sin(t * 2 + o.x) * 1.5) * 2;
      if (kind) this.v ? this.px(moodSprite(kind), o.x + 16, o.y - 58 + bob) : label(kind === "high" ? "☺" : kind === "low" ? "…" : "!", o.x + 16, o.y - 66 + bob, kind === "high" ? "#ffdb8c" : "#c9c2a8", 12);
      if (insp) {
        c.fillStyle = "#ffdb8c";
        for (let k = 0; k < 3; k++) {
          const a = (calm ? k * 2.1 : t * 2.4 + k * 2.1) % (Math.PI * 2),
            x = o.x + Math.cos(a) * 18,
            y = o.y - 40 + Math.sin(a) * 9;
          c.globalAlpha = calm ? 0.9 : 0.5 + 0.5 * Math.abs(Math.sin(t * 4 + k));
          c.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 2, 2);
          c.fillRect(Math.round(x / 2) * 2 - 2, Math.round(y / 2) * 2, 6, 2);
          c.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2 - 2, 2, 6);
        }
        c.globalAlpha = 1;
      }
    }
    // 机床：加急的那晚冒烟，卡料时头顶一块红牌
    const L = e.o?.lathe,
      at = this._tdLathe || SPOTS.lathe;
    if (L?.mode && e.td.lathe) {
      if (e.td.lathe.jam >= e.s.day) {
        c.fillStyle = "#140f0b";
        c.fillRect(at.x - 22, at.y - 96, 44, 18);
        c.fillStyle = "#8e3a20";
        c.fillRect(at.x - 21, at.y - 95, 42, 16);
        label("卡料", at.x, at.y - 87, "#ffdb8c", 11);
      } else if (e.td.lathe.rush === e.s.day && !calm) {
        for (let k = 0; k < 4; k++) {
          const ph = (t * 0.5 + k / 4) % 1;
          c.globalAlpha = 0.45 * (1 - ph);
          c.fillStyle = k % 2 ? "#b9b4a8" : "#cfc9bc";
          const s = 6 + ph * 10;
          c.fillRect(Math.round((at.x + 14 + Math.sin(ph * 6 + k) * 6) / 2) * 2, Math.round((at.y - 70 - ph * 50) / 2) * 2, s, s);
        }
        c.globalAlpha = 1;
      }
    }
    c.restore();
  }
}
