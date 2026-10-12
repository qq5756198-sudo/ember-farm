// v0.23.0「回响」的画面：打中往后仰（重击踉跄）、打死倒在地上留尸体（60 秒后 3 秒淡掉）、
// 地上的血迹（打中一小点、打死一滩，重甲是铁片），翻滚（身子团起来转一圈，身后扬土），开局那一拨之后路口的“围栏放这里”。
// 尸体和血迹画在地面和人之间；路口的标记在光照之后画，夜里也看得清。
import { Renderer as GearRenderer } from "./gear-renderer.js";
import { zombieSprite, personSprite, dirFromAngle } from "./pixel-sprites.js";
import { REMAINS, OPENING } from "./feel-data.js";

const BODY = { slow: 1, runner: 1, screamer: 1, armor: 1, elite: 1 };
const makeCanvas = (w, h) => {
  if (typeof OffscreenCanvas !== "undefined") return new OffscreenCanvas(w, h);
  if (typeof document !== "undefined" && document.createElement) {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c;
  }
  return null;
};

export class Renderer extends GearRenderer {
  draw(engine, mouse, dt = 0.016) {
    this._fE = engine;
    super.draw(engine, mouse, dt);
  }
  // ---------- 地上：血迹、尸体 ----------
  drawFarm(e) {
    super.drawFarm(e);
    this.drawRemains(e);
  }
  drawRuins(e) {
    const out = super.drawRuins(e);
    this.drawRemains(e);
    return out;
  }
  drawRemains(e) {
    if (!this.v || !e.remains) return;
    const { corpses, blood, clock } = e.remains();
    if (!corpses.length && !blood.length) return;
    const c = this.ctx,
      sc = this.camera.scale,
      x0 = this.camera.x - 80,
      y0 = this.camera.y - 80,
      x1 = this.camera.x + this.w / sc + 80,
      y1 = this.camera.y + this.h / sc + 80;
    c.save();
    for (const b of blood) {
      if (b.x < x0 || b.x > x1 || b.y < y0 || b.y > y1) continue;
      const age = clock - b.born,
        a = Math.max(0, Math.min(1, (REMAINS.bloodLife - age) / 20));
      this.drawBlood(b, a);
    }
    for (const k of corpses) {
      if (k.x < x0 || k.x > x1 || k.y < y0 || k.y > y1) continue;
      const age = clock - k.born,
        fall = Math.min(1, age / REMAINS.fall),
        alpha = age > REMAINS.corpseLife ? Math.max(0, 1 - (age - REMAINS.corpseLife) / REMAINS.corpseFade) : 1;
      if (alpha > 0) this.drawCorpse(k, fall, alpha);
    }
    c.restore();
  }
  // 血迹：几个 2×2 的点，打死的是一滩；重甲掉的是灰色铁片
  // 每一摊只在第一次画进一张小图（48×24），之后每帧贴图，不再一格一格地画
  drawBlood(b, alpha) {
    const c = this.ctx;
    this._bloodSpr ??= new WeakMap();
    let spr = this._bloodSpr.get(b);
    if (spr === undefined) {
      const cv = makeCanvas(48, 24),
        g = cv?.getContext?.("2d");
      spr = g && g.fillRect ? cv : null;
      if (spr) this.paintBlood(g, b, 24, 12);
      this._bloodSpr.set(b, spr);
    }
    c.globalAlpha = alpha * (b.spark ? 0.9 : 0.85);
    if (spr) {
      c.imageSmoothingEnabled = false;
      c.drawImage(spr, Math.round(b.x / 2) * 2 - 24, Math.round(b.y / 2) * 2 - 12);
    } else this.paintBlood(c, b, b.x, b.y);
    c.globalAlpha = 1;
  }
  paintBlood(c, b, x, y) {
    let s = b.seed || 1;
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    if (b.spark) {
      for (let i = 0; i < 5; i++) {
        c.fillStyle = i % 2 ? "#8d8a80" : "#b9b4a2";
        c.fillRect(Math.round((x + (r() - 0.5) * 22) / 2) * 2, Math.round((y + (r() - 0.5) * 10) / 2) * 2, 2 + (i % 2) * 2, 2);
      }
    } else if (b.big) {
      const w = 22 + Math.floor(r() * 10),
        h = 10 + Math.floor(r() * 4);
      for (let yy = -h / 2; yy < h / 2; yy += 2)
        for (let xx = -w / 2; xx < w / 2; xx += 2) {
          const k = (xx * xx) / ((w / 2) * (w / 2)) + (yy * yy) / ((h / 2) * (h / 2));
          if (k > 1 || (k > 0.7 && r() < 0.5)) continue;
          c.fillStyle = k < 0.35 ? "#4a1512" : "#6b1d1a";
          c.fillRect(Math.round((x + xx) / 2) * 2, Math.round((y + yy) / 2) * 2, 2, 2);
        }
    } else {
      for (let i = 0; i < 4; i++) {
        c.fillStyle = i ? "#7a221d" : "#5a1714";
        c.fillRect(Math.round((x + (r() - 0.5) * 14) / 2) * 2, Math.round((y + (r() - 0.5) * 6) / 2) * 2, 2, 2);
      }
    }
  }
  // 尸体：同一种感染者的样子，倒下去、颜色暗一些
  corpseSprite(type, dir) {
    this._corpses ??= new Map();
    const key = type + ":" + dir;
    if (this._corpses.has(key)) return this._corpses.get(key);
    const base = zombieSprite(BODY[type] ? type : "slow", dir, 0);
    let out = base;
    const cv = base ? makeCanvas(base.width, base.height) : null;
    if (cv) {
      const g = cv.getContext("2d");
      g.drawImage(base, 0, 0);
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "rgba(24,18,14,0.38)";
      g.fillRect(0, 0, cv.width, cv.height);
      out = cv;
    }
    this._corpses.set(key, out);
    return out;
  }
  drawCorpse(k, fall, alpha) {
    const { dir, flip } = dirFromAngle(k.facing ?? Math.PI / 2),
      spr = this.corpseSprite(k.type, dir === "up" ? "down" : dir);
    if (!spr) return;
    const c = this.ctx,
      side = flip ? -1 : 1,
      rot = side * (Math.PI / 2) * (k.crawl ? 1 : fall),
      w = spr.width * 2,
      h = spr.height * 2;
    if (fall >= 1) this.pxShadow(k.x, k.y, k.type === "elite" ? 40 : 28);
    c.save();
    c.imageSmoothingEnabled = false;
    c.globalAlpha = alpha;
    c.translate(Math.round(k.x / 2) * 2, Math.round((k.y - 4) / 2) * 2);
    c.rotate(rot);
    if (flip) c.scale(-1, 1);
    c.drawImage(spr, -w / 2, -h + 4, w, h);
    c.restore();
  }
  // ---------- 挨打：往后仰，重击踉跄 ----------
  drawZombie(z, x, y, alpha = 1) {
    const e = this._fE,
      r = this.v && e?.reactOf ? e.reactOf(z) : null;
    if (!r || this.calm) return super.drawZombie(z, x, y, alpha);
    const k = 1 - r.t / r.max,
      push = (r.heavy ? 7 : 4) * Math.sin(Math.PI * Math.min(1, k * 1.6)),
      wobble = r.heavy ? Math.sin(k * Math.PI * 3) * 0.12 * (1 - k) : 0,
      lean = Math.cos(r.a) >= 0 ? 1 : -1,
      ox = Math.round((Math.cos(r.a) * push) / 2) * 2,
      oy = Math.round((Math.sin(r.a) * push * 0.5) / 2) * 2,
      ang = lean * (0.16 * Math.sin(Math.PI * Math.min(1, k * 1.4))) + wobble;
    const c = this.ctx;
    c.save();
    c.translate(x + ox, y + oy);
    c.rotate(ang);
    c.translate(-x, -y);
    try {
      super.drawZombie(z, x, y, alpha);
    } finally {
      c.restore();
    }
  }
  // ---------- 翻滚：团成一团转一圈 ----------
  drawPlayer(e) {
    const R = this.v && e.gr ? e.dodging?.() : null;
    if (!R) return super.drawPlayer(e);
    const p = e.s.player,
      c = this.ctx,
      k = 1 - Math.max(0, R.t) / 0.35,
      { dir, flip } = dirFromAngle(R.a),
      spr = personSprite(this.playerLook(e), "player", dir === "up" ? "side" : dir, 1, "walk");
    this.pxShadow(p.x, p.y, 18);
    if (!this.calm) {
      // 身后扬起的土
      c.fillStyle = "rgba(196,170,120,0.55)";
      for (let i = 0; i < 4; i++) {
        const back = 10 + i * 7,
          jx = ((i * 37) % 9) - 4;
        c.fillRect(Math.round((p.x - Math.cos(R.a) * back + jx) / 2) * 2, Math.round((p.y - 2 - Math.sin(R.a) * back * 0.5 - ((i * 13) % 5)) / 2) * 2, 2, 2);
      }
    }
    if (!spr) return;
    const w = spr.width * 2,
      h = spr.height * 2,
      side = Math.cos(R.a) >= 0 ? 1 : -1;
    c.save();
    c.imageSmoothingEnabled = false;
    c.translate(Math.round(p.x / 2) * 2, Math.round((p.y - h * 0.38) / 2) * 2);
    c.rotate(side * k * Math.PI * 2);
    c.scale(flip ? -0.9 : 0.9, 0.8);
    c.drawImage(spr, -w / 2, -h / 2, w, h);
    c.restore();
  }
  // ---------- 光照之后：开局那一拨后，东边路口“围栏放这里” ----------
  drawNight(e) {
    super.drawNight(e);
    if (!this.v || e.s.region !== "farm" || e.feel?.open?.phase !== "fence" || e.paused) return;
    const c = this.ctx,
      f = OPENING.fence,
      t = this.time,
      on = this.calm ? true : Math.floor(t * 3) % 2 === 0;
    c.save();
    c.fillStyle = "#140f0b";
    c.globalAlpha = 0.9;
    const w = 76,
      h = 22;
    for (let i = 0; i < w; i += 8) {
      c.fillRect(f.x - w / 2 + i - 1, f.y - h / 2 - 1, 6, 4);
      c.fillRect(f.x - w / 2 + i - 1, f.y + h / 2 - 3, 6, 4);
    }
    c.fillStyle = on ? "#ffdb8c" : "#d8b866";
    for (let i = 0; i < w; i += 8) {
      c.fillRect(f.x - w / 2 + i, f.y - h / 2, 4, 2);
      c.fillRect(f.x - w / 2 + i, f.y + h / 2 - 2, 4, 2);
    }
    c.restore();
    // 字放在框下面、带深色底，不和出口的“林间小路”挤在一起
    if (this._pixelBadge) this._pixelBadge("围栏放这里", f.x, f.y + h / 2 + 18, "#ffdb8c");
    else this._pixelText?.("围栏放这里", f.x, f.y + h / 2 + 18, "#ffdb8c", 12);
  }
}
