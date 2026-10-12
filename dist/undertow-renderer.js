// v0.24.0「暗涌」的画面：新感染者和头目的样子、各自出手前的预兆（膨胀者闪光和要炸的圈、吐酸者的落点圈、
// 夜行者的绿眼睛、大块头的红圈和车门的线、护士长吸气和绿色的一圈、仓库守卫冲撞的线）、毒雾和酸液、
// 地上躺着的尸体（装死者混在里面，手指会抽一下）、各种柜子、撬锁的进度、空投、被困的人、背包客、对讲机、
// 麦穗冲装死的叫、稀有和珍贵的柜子闪一下；宵禁时农场夜里灯灭。
// 预兆和提示都在光照之后画，夜里也看得清；“减少闪烁与震屏”下不闪、不晃。
import { Renderer as FeelRenderer } from "./feel-renderer.js";
import { dirFromAngle, personSprite } from "./pixel-sprites.js";
import { LAMP, WARM, nightness } from "./pixel-light.js";
import { RULES } from "./gear-data.js";
import { uZombieSprite, bruteBossSprite, doorSprite, crateSprite, ironDoorSprite, talkieSprite, merchantLook, survivorLook } from "./undertow-sprites.js";
import { NEW_RULES, BOSSES, EVENT_RULES } from "./undertow-data.js";

const NEWZ = { bloater: 1, faker: 1, spitter: 1, stalker: 1, nurse: 1 };
const BODY_NEW = { bloater: 1, faker: 1, spitter: 1, stalker: 1, brute: 1, nurse: 1 };
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
const GAS = "#b5d97a",
  ACID = "#c6e37a",
  PULSE = "#9fe08a",
  EYE = "#c8f58a";
// “色弱友好”打开时：毒雾换成淡紫、酸液换成亮黄、回血换成浅蓝，草地上也分得开
const SAFE_HUE = { gas: "#c9a0ff", acid: "#ffe066", pulse: "#8fd0ff" };

export class Renderer extends FeelRenderer {
  hue(kind) {
    if (this._uE?.s?.settings?.access?.color) return SAFE_HUE[kind];
    return kind === "gas" ? GAS : kind === "acid" ? ACID : PULSE;
  }
  draw(engine, mouse, dt = 0.016) {
    this._uE = engine;
    super.draw(engine, mouse, dt);
  }
  // ---------- 地上：躺着的尸体（装死者也画成一样） ----------
  drawRuins(e) {
    const out = super.drawRuins(e);
    this.drawLying(e);
    return out;
  }
  drawLying(e) {
    if (!this.v || !e.ut || !e.decorCorpses) return;
    const list = e.decorCorpses(),
      calm = this.calm;
    for (const k of list) this.drawCorpse(k, 1, 1);
    for (const z of e.enemies) {
      if (!z.lying || z.dead) continue;
      this.drawCorpse({ type: "slow", x: z.x, y: z.y, facing: z.facing ?? 0 }, 1, 1);
      // 手指抽了一下：旁边一只手动一动
      if (z.twitch > 0) {
        const c = this.ctx,
          side = Math.cos(z.facing ?? 0) >= 0 ? 1 : -1,
          k = calm ? 0 : Math.round(Math.sin(this.time * 30)) * 2;
        c.fillStyle = "#869843";
        c.fillRect(Math.round((z.x + side * 22) / 2) * 2, Math.round((z.y - 6 + k) / 2) * 2, 4, 2);
        c.fillStyle = "#1c140f";
        c.fillRect(Math.round((z.x + side * 22) / 2) * 2, Math.round((z.y - 4 + k) / 2) * 2, 4, 2);
      }
    }
  }
  // 新种类的尸体：同一张小图倒下、压暗
  uCorpse(type, dir) {
    this._uCorpses ??= new Map();
    const key = type + ":" + dir;
    if (this._uCorpses.has(key)) return this._uCorpses.get(key);
    const base = type === "brute" ? bruteBossSprite(dir, 0) : uZombieSprite(type, dir, 0);
    let out = base;
    const cv = base ? makeCanvas(base.width, base.height) : null;
    if (cv) {
      const g = cv.getContext("2d");
      g.drawImage(base, 0, 0);
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = type === "bloater" ? "rgba(60,80,20,0.45)" : "rgba(24,18,14,0.38)";
      g.fillRect(0, 0, cv.width, cv.height);
      out = cv;
    }
    this._uCorpses.set(key, out);
    return out;
  }
  drawCorpse(k, fall, alpha) {
    if (!BODY_NEW[k.type]) return super.drawCorpse(k, fall, alpha);
    const { dir, flip } = dirFromAngle(k.facing ?? Math.PI / 2),
      spr = this.uCorpse(k.type, dir === "up" ? "down" : dir);
    if (!spr) return;
    const c = this.ctx,
      side = flip ? -1 : 1,
      rot = side * (Math.PI / 2) * fall,
      big = k.type === "brute",
      s = big ? 1 : k.type === "nurse" ? 1.25 : 1,
      w = spr.width * 2 * s,
      h = spr.height * 2 * s * (k.burst ? 0.6 : 1);
    if (fall >= 1) this.pxShadow(k.x, k.y, big ? 56 : 28);
    c.save();
    c.imageSmoothingEnabled = false;
    c.globalAlpha = alpha;
    c.translate(Math.round(k.x / 2) * 2, Math.round((k.y - 4) / 2) * 2);
    c.rotate(rot);
    if (flip) c.scale(-1, 1);
    c.drawImage(spr, -w / 2, -h + 4, w, h);
    c.restore();
    if (k.burst && !this.calm && alpha > 0.3) {
      c.fillStyle = "rgba(181,217,122,0.5)";
      for (let i = 0; i < 4; i++) c.fillRect(Math.round((k.x - 18 + i * 12) / 2) * 2, Math.round((k.y - 2 - (i % 2) * 4) / 2) * 2, 4, 2);
    }
  }

  // ---------- 感染者 ----------
  drawEnemy(z, e) {
    if (!this.v || !e?.ut) return super.drawEnemy(z, e);
    if (z.lying) return;
    if (z.type === "brute") return this.drawBrute(z, e);
    if (z.type === "nurse") return this.drawNurse(z, e);
    return super.drawEnemy(z, e);
  }
  drawZombie(z, x, y, alpha = 1) {
    if (!NEWZ[z.type] || z.crawl) {
      super.drawZombie(z, x, y, alpha);
      if (z.type === "elite" && this._uE?.isGuard?.(z) && !z.g2 && !z.dead) this.drawGuardPlate(z, x, y, alpha);
      return;
    }
    const { dir, flip } = dirFromAngle(z.facing ?? Math.PI / 2),
      speed = z.type === "stalker" ? 9 : 5,
      frame = Math.floor(this.time * speed + (z.x + z.y) * 0.01) % 4,
      spr = uZombieSprite(z.type, dir, frame);
    if (!spr) return super.drawZombie(z, x, y, alpha);
    let sx = 1,
      sy = 1,
      rot = 0,
      lift = 0;
    if (z.type === "bloater" && !this.calm) {
      const k = Math.sin(this.time * 4 + z.id);
      sx = 1 + 0.04 * k;
      sy = 1 - 0.02 * k;
    }
    if (z.type === "stalker") {
      sy = z.dash ? (z.dash.phase === "wind" ? 0.8 : 0.9) : 0.9;
      sx = 1.04;
    }
    if (z.type === "spitter" && z.spit) rot = (flip ? 1 : -1) * 0.28;
    if (z.type === "faker" && z.rise > 0) rot = (flip ? -1 : 1) * (Math.PI / 2) * Math.min(1, z.rise / 0.6);
    if (z.stagger > 0 || z.stunT > 0) rot += (flip ? -1 : 1) * 0.3;
    this.pxShadow(x, y, 20);
    const c = this.ctx;
    c.save();
    c.imageSmoothingEnabled = false;
    c.globalAlpha = alpha * (z.type === "stalker" ? 0.92 : 1);
    c.translate(Math.round(x), Math.round(y - lift));
    if (rot) c.rotate(rot);
    c.scale(flip ? -sx : sx, sy);
    c.drawImage(spr, -spr.width, -spr.height * 2 + 2, spr.width * 2, spr.height * 2);
    c.restore();
  }
  // 仓库守卫第一段：正面一块钢板
  drawGuardPlate(z, x, y, alpha) {
    const { dir, flip } = dirFromAngle(z.facing ?? Math.PI / 2);
    if (dir === "up") return;
    const c = this.ctx,
      X = Math.round((dir === "side" ? x + (flip ? -26 : 14) : x - 18) / 2) * 2,
      Y = Math.round((y - 64) / 2) * 2,
      w = dir === "side" ? 12 : 36,
      h = 30;
    c.save();
    c.globalAlpha = alpha;
    c.fillStyle = "#1c140f";
    c.fillRect(X - 2, Y - 2, w + 4, h + 4);
    c.fillStyle = "#85857a";
    c.fillRect(X, Y, w, h);
    c.fillStyle = "#aaa797";
    c.fillRect(X, Y, w, 2);
    c.fillStyle = "#62645d";
    c.fillRect(X + w - 2, Y + 2, 2, h - 2);
    c.fillStyle = "#cdc8b6";
    for (const [dx, dy] of [[2, 4], [w - 4, 4], [2, h - 6], [w - 4, h - 6]]) c.fillRect(X + dx, Y + dy, 2, 2);
    c.restore();
  }
  drawBrute(z, e) {
    const { dir, flip } = dirFromAngle(z.facing ?? Math.PI / 2),
      moving = !z.act,
      frame = moving ? Math.floor(this.time * (z.rage ? 6 : 4) + z.id) % 4 : 0,
      lift = z.act?.kind === "slam" || z.act?.kind === "door",
      spr = bruteBossSprite(dir, frame, lift);
    this.pxShadow(z.x, z.y, 58);
    const shake = z.act?.kind === "slam" && !this.calm ? Math.round(Math.sin(this.time * 40)) * 2 : 0;
    this.px(spr, z.x, z.y, { flip, alpha: z.flash ? 0.6 : 1, foot: 1, dx: shake / 2 });
    // 抡起车门：一圈一圈转
    if (z.act?.kind === "door") {
      const k = 1 - Math.max(0, z.act.t) / (z.act.max || 1),
        a = this.calm ? -Math.PI / 2 : -Math.PI / 2 + k * Math.PI * 2,
        d = doorSprite(),
        c = this.ctx;
      c.save();
      c.imageSmoothingEnabled = false;
      c.translate(Math.round(z.x + Math.cos(a) * 34), Math.round(z.y - 96 + Math.sin(a) * 18));
      c.rotate(a);
      c.drawImage(d, -d.width, -d.height, d.width * 2, d.height * 2);
      c.restore();
    }
    if (z.rage && !this.calm && Math.floor(this.time * 3) % 2) this._pixelText("怒", z.x, z.y - 128, "#ff8a6a", 12);
  }
  drawNurse(z, e) {
    const { dir, flip } = dirFromAngle(z.facing ?? Math.PI / 2),
      moving = !z.act,
      frame = moving ? Math.floor(this.time * 4 + z.id) % 4 : 0,
      spr = uZombieSprite("nurse", dir, frame);
    if (!spr) return;
    const s = 1.3,
      c = this.ctx,
      w = spr.width * 2 * s,
      h = spr.height * 2 * s,
      inhale = z.act?.kind === "scream",
      rot = inhale ? (flip ? 1 : -1) * 0.18 : 0;
    this.pxShadow(z.x, z.y, 30);
    c.save();
    c.imageSmoothingEnabled = false;
    c.globalAlpha = z.flash ? 0.6 : 1;
    c.translate(Math.round(z.x), Math.round(z.y));
    if (rot) c.rotate(rot);
    c.scale(flip ? -1 : 1, inhale && !this.calm ? 1 + 0.04 * Math.sin(this.time * 18) : 1);
    c.drawImage(spr, -w / 2, -h + 4, w, h);
    c.restore();
  }

  // ---------- 柜子、事件里的东西 ----------
  drawObject(o, e) {
    if (!this.v || !e?.ut) return super.drawObject(o, e);
    const p = e.s.player,
      near = Math.hypot(p.x - o.x, p.y - o.y) < 170;
    if (o.type === "crate" && o.ukind && !o.orig) {
      const opened = e.s.opened[o.id]?.day === e.s.day,
        kind = o.locked || o.odds === "locked" ? "locked" : o.ukind;
      this.pxShadow(o.x, o.y, 30);
      this.px(crateSprite(kind), o.x, o.y + 4, { alpha: opened ? 0.5 : 1 });
      this.muted(() => super.drawObject(o, e));
      return;
    }
    if (o.type === "uDoor") {
      this.pxShadow(o.x, o.y, 34);
      this.px(ironDoorSprite(false), o.x, o.y + 4);
      if (near) this.badge(o.name, o.x, o.y - 86, "#efd89a");
      return;
    }
    if (o.type === "uTalkie") {
      this.pxShadow(o.x, o.y, 12);
      this.px(talkieSprite(this.calm || Math.floor(this.time * 3) % 2 === 0), o.x, o.y + 2);
      if (near) this.badge(o.name, o.x, o.y - 42, "#efd89a");
      return;
    }
    if (o.type === "uMerchant" || o.type === "uSurvivor" || o.type === "uSend" || o.type === "uJoin") {
      if (o.type === "uJoin") return;
      const look = o.type === "uMerchant" ? merchantLook() : survivorLook(),
        key = o.type === "uMerchant" ? "umerchant" : "usurvivor",
        moving = !!o.moving,
        { dir, flip } = dirFromAngle(o.facing ?? Math.PI / 2),
        frame = moving ? Math.floor(this.time * 8) % 4 : 0,
        spr = personSprite(look, key, dir, frame, "walk");
      this.pxShadow(o.x, o.y, 18);
      // 被困的人还躲着：蹲在墙角
      const crouch = o.type === "uSurvivor" && e.ut.ev?.st === "wait";
      if (crouch && spr) {
        const c = this.ctx;
        c.save();
        c.imageSmoothingEnabled = false;
        c.translate(Math.round(o.x), Math.round(o.y));
        c.scale(flip ? -1 : 1, 0.78);
        c.drawImage(spr, -spr.width, -spr.height * 2 + 2, spr.width * 2, spr.height * 2);
        c.restore();
      } else this.px(spr, o.x, o.y, { flip, foot: 1 });
      if (near || o.type === "uSurvivor") this.badge(o.type === "uMerchant" ? "背包客" : o.type === "uSurvivor" ? (crouch ? "有人在喊救命" : "被困的人") : "被困的人", o.x, o.y - 84, "#efd89a");
      return;
    }
    if (o.type === "uGood") {
      this.pxShadow(o.x, o.y, 22);
      this.px(crateSprite(o.tier === "rare" ? "cache" : "pile"), o.x, o.y + 4);
      if (near) this.badge(o.name, o.x, o.y - 60, o.tier === "rare" ? "#8fd0ff" : "#efd89a");
      return;
    }
    return super.drawObject(o, e);
  }

  // ---------- 光照之后：预兆、毒雾、酸液、进度 ----------
  drawNight(e) {
    const all = e?.enemies;
    // 躺着的、夜行者、头目、冲撞中的守卫：自己画预兆，不用原来那一套（夜里的眼睛、冲撞线）
    if (this.v && e?.ut && all) e.enemies = all.filter((z) => !(z.lying || z.type === "stalker" || z.type === "brute" || z.type === "nurse" || (z.g2 && z.charge)));
    try {
      super.drawNight(e);
    } finally {
      if (all) e.enemies = all;
    }
    if (this.v && e?.ut) this.drawUnderMarks(e);
  }
  drawUnderMarks(e) {
    const c = this.ctx,
      t = this.time,
      calm = this.calm,
      danger = this.dangerColor,
      GAS = this.hue("gas"),
      ACID = this.hue("acid"),
      PULSE = this.hue("pulse"),
      ux = e.ux,
      p = e.s.player,
      dot = (x, y, w = 4, h = 4) => c.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h),
      mark = (x, y, w, h, col) => {
        const X = Math.round(x / 2) * 2,
          Y = Math.round(y / 2) * 2;
        c.fillStyle = "#140f0b";
        c.fillRect(X - 2, Y - 2, w + 4, h + 4);
        c.fillStyle = col;
        c.fillRect(X, Y, w, h);
      },
      // 一圈点：fill<1 时先画一整圈淡的，再把已经走过的那一段画亮（越接近出手越满）
      ring = (x, y, r, col, n = 28, a = 0.9, fill = 1) => {
        const shown = Math.max(3, Math.round(n * fill));
        for (let i = 0; i < n; i++) {
          const aa = (i / n) * Math.PI * 2 - Math.PI / 2;
          c.globalAlpha = i < shown ? a : a * 0.4;
          mark(x + Math.cos(aa) * r - 2, y + Math.sin(aa) * r * 0.55 - 2, 4, 4, col);
        }
        c.globalAlpha = 1;
      },
      pulse = (f = 6) => (calm ? 1 : 0.65 + 0.35 * Math.sin(t * f));
    c.save();
    // 毒雾：一团绿色，慢慢散
    for (const g of ux.clouds) {
      const k = Math.min(1, 0.6 + g.t / g.max),
        r = g.r * k;
      c.fillStyle = GAS;
      for (let y = -r; y <= r; y += 8)
        for (let x = -r; x <= r; x += 8) {
          const d = (x * x) / (r * r) + (y * y) / (r * r * 0.36);
          if (d > 1) continue;
          const n = Math.sin((x + g.x) * 0.13 + (calm ? 0 : t * 1.3)) + Math.cos((y + g.y) * 0.17 - (calm ? 0 : t));
          c.globalAlpha = Math.max(0, (0.55 - d * 0.32) * Math.min(1, g.t / 1.2) * (0.78 + n * 0.14));
          c.fillRect(Math.round((g.x + x) / 2) * 2, Math.round((g.y - 10 + y * 0.6) / 2) * 2, 8, 6);
        }
      c.globalAlpha = 1;
      ring(g.x, g.y, r, GAS, 32, 0.55 * Math.min(1, g.t / 1.2));
    }
    // 酸液一滩
    for (const q of ux.puddles) {
      const a = Math.min(1, q.t / 0.8);
      c.globalAlpha = 0.55 * a;
      c.fillStyle = ACID;
      for (let y = -q.r * 0.5; y <= q.r * 0.5; y += 4)
        for (let x = -q.r; x <= q.r; x += 4) if ((x * x) / (q.r * q.r) + (y * y) / (q.r * q.r * 0.25) <= 1) c.fillRect(Math.round((q.x + x) / 2) * 2, Math.round((q.y + y) / 2) * 2, 4, 4);
      c.globalAlpha = 1;
      ring(q.x, q.y, q.r, ACID, 20, 0.5 * a);
      c.globalAlpha = a;
      c.fillStyle = "#e8f0b0";
      for (let i = 0; i < 3; i++) {
        const bt = calm ? 0.5 : (t * 1.5 + i * 0.37) % 1;
        dot(q.x - 20 + i * 18, q.y - 4 - bt * 6, 2, 2);
      }
      c.globalAlpha = 1;
    }
    // 飞在空中的酸液和落点
    for (const a of ux.acid) {
      const k = Math.min(1, a.t / a.fly),
        x = a.x0 + (a.x - a.x0) * k,
        y = a.y0 + (a.y - a.y0) * k - Math.sin(Math.PI * k) * 60;
      c.fillStyle = ACID;
      dot(x - 3, y - 3, 6, 6);
      ring(a.x, a.y, NEW_RULES.spitter.puddle.r, danger, 24, 0.9);
    }
    // 打开的柜子闪一下；护士长的绿色脉冲
    for (const f of ux.flashes) {
      const k = 1 - f.t / f.max;
      if (f.tier === "pulse") ring(f.x, f.y, 30 + (f.r - 30) * k, PULSE, 36, 0.9 * (1 - k));
      else if (!calm || k < 0.5) ring(f.x, f.y - 20, 18 + k * 40, f.tier === "precious" ? "#ffcf6a" : "#8fd0ff", 20, 1 - k);
    }
    // 要炸的膨胀者：身子一闪一闪，地上一圈红
    for (const f of ux.fuses) {
      const on = calm || Math.floor(t * 10) % 2 === 0,
        spr = on ? this.flashSprite() : uZombieSprite("bloater", "down", 0);
      if (spr) {
        c.save();
        c.imageSmoothingEnabled = false;
        c.drawImage(spr, Math.round(f.x - spr.width), Math.round(f.y - spr.height * 2 + 2), spr.width * 2, spr.height * 2);
        c.restore();
      }
      ring(f.x, f.y, NEW_RULES.bloater.gas.r * (1 - f.t / f.max * 0.3), danger, 32, 0.95 * pulse(14));
      this._pixelText("要炸了！", f.x, f.y - 82, danger, 24);
    }
    // 车门在飞
    for (const D of ux.doors) {
      const d = doorSprite();
      if (!d) continue;
      c.save();
      c.imageSmoothingEnabled = false;
      c.globalAlpha = D.left > 0 ? 1 : Math.max(0, D.rest / 2.5);
      c.translate(Math.round(D.x), Math.round(D.y));
      c.rotate(D.left > 0 && !calm ? D.spin : D.a);
      c.drawImage(d, -d.width, -d.height, d.width * 2, d.height * 2);
      c.restore();
    }
    const dark = !this.indoor && !["market"].includes(e.s.region) ? nightness(this.vMinute) : 0;
    for (const z of e.enemies) {
      if (z.dead || z.nest) continue;
      // 吐酸者仰头：落点圈越来越满
      if (z.spit) {
        const k = 1 - Math.max(0, z.spit.t) / NEW_RULES.spitter.warn;
        ring(z.spit.x, z.spit.y, NEW_RULES.spitter.puddle.r, danger, 24, 0.95, k);
        c.fillStyle = ACID;
        dot(z.x + (Math.cos(z.facing ?? 0) >= 0 ? 6 : -10), z.y - 58, 4, 4);
        this._pixelText("酸！", z.x, z.y - 86, danger, 24);
      }
      // 夜行者：两点绿光；要扑之前更亮
      if (z.type === "stalker" && (dark > 0.3 || z.dash)) {
        const { dir, flip } = dirFromAngle(z.facing ?? Math.PI / 2),
          ey = z.y - 44 + (z.dash?.phase === "wind" ? 6 : 0);
        c.globalAlpha = z.dash ? 1 : Math.min(1, 0.45 + dark * 0.6) * pulse(3);
        c.fillStyle = EYE;
        if (dir === "down") {
          dot(z.x - 7, ey, 4, 2);
          dot(z.x + 1, ey, 4, 2);
        } else if (dir === "side") dot(z.x + (flip ? -8 : 4), ey, 4, 2);
        c.globalAlpha = 1;
        if (z.dash?.phase === "wind") this._pixelText("背后！", z.x, z.y - 74, danger, 24);
      }
      // 大块头：红圈（砸地）、地上一条线（车门）
      if (z.type === "brute" && z.act) {
        const A = z.act,
          k = 1 - Math.max(0, A.t) / (A.max || 1);
        if (A.kind === "slam") {
          ring(z.x, z.y, BOSSES.brute.slam.r, danger, 40, 0.95, Math.max(0.15, k));
          c.globalAlpha = 0.18 + 0.22 * k;
          c.fillStyle = danger;
          const r = BOSSES.brute.slam.r * k;
          for (let y = -r * 0.55; y <= r * 0.55; y += 8) for (let x = -r; x <= r; x += 8) if ((x * x) / (r * r) + (y * y) / (r * r * 0.3) <= 1) c.fillRect(Math.round((z.x + x) / 2) * 2, Math.round((z.y + y) / 2) * 2, 4, 4);
          c.globalAlpha = 1;
          this._pixelText("砸地！", z.x, z.y - 140, danger, 24);
        }
        if (A.kind === "door") {
          const D = BOSSES.brute.door,
            a = A.a;
          c.globalAlpha = 0.9 * pulse(10);
          for (let s = 30; s < D.len * Math.max(0.3, Math.min(1, k + 0.3)); s += 12) {
            const x = z.x + Math.cos(a) * s,
              y = z.y + Math.sin(a) * s;
            mark(x - Math.sin(a) * (D.width / 2) - 2, y + Math.cos(a) * (D.width / 2) - 2, 4, 4, danger);
            mark(x + Math.sin(a) * (D.width / 2) - 2, y - Math.cos(a) * (D.width / 2) - 2, 4, 4, danger);
          }
          c.globalAlpha = 1;
          this._pixelText("车门！", z.x, z.y - 140, danger, 24);
        }
        if (A.kind === "melee") this._pixelText("攻击！", z.x, z.y - 140, danger, 12);
      }
      // 护士长：吸气（一圈圈往外扩），绿色的一圈
      if (z.type === "nurse" && z.act) {
        const A = z.act,
          k = 1 - Math.max(0, A.t) / (A.max || 1);
        if (A.kind === "scream") {
          c.fillStyle = "#e9c05a";
          for (let r0 = 0; r0 < 3; r0++) {
            const r = 12 + ((t * 40 + r0 * 16) % 50);
            c.globalAlpha = calm ? 0.7 : Math.max(0, 1 - r / 62);
            for (let i = 0; i < 18; i++) {
              const aa = (i / 18) * Math.PI * 2;
              dot(z.x + Math.cos(aa) * r - 1, z.y - 70 + Math.sin(aa) * r * 0.6 - 1, 2, 2);
            }
          }
          c.globalAlpha = 1;
          this._pixelText("要尖叫了！打断她", z.x, z.y - 120, "#e9c05a", 24);
        }
        if (A.kind === "pulse") {
          ring(z.x, z.y, BOSSES.nurse.pulse.r, PULSE, 40, 0.9, Math.max(0.2, k));
          this._pixelText("回血", z.x, z.y - 120, PULSE, 12);
        }
        if (A.kind === "melee") this._pixelText("攻击！", z.x, z.y - 120, danger, 12);
      }
      // 守卫第二段的冲撞线（比重甲长）
      if (z.g2 && z.charge?.phase === "stomp") {
        const a = z.charge.a,
          len = BOSSES.guard.charge.len;
        c.globalAlpha = 0.85 * pulse(12);
        for (let k2 = 0; k2 < len; k2 += 10) {
          const x = z.x + Math.cos(a) * k2,
            y = z.y + Math.sin(a) * k2;
          mark(x - Math.sin(a) * 22 - 2, y + Math.cos(a) * 22 - 2, 4, 4, danger);
          mark(x + Math.sin(a) * 22 - 2, y - Math.cos(a) * 22 - 2, 4, 4, danger);
        }
        c.globalAlpha = 1;
        this._pixelText("冲撞！", z.x, z.y - 120, danger, 24);
      }
      // 麦穗找出来的装死者
      if (z.lying && ux.spotted.has(z.id)) this._pixelText("！", z.x, z.y - 40, "#f0a040", 24);
    }
    // 麦穗冲着装死的叫
    if (ux.bark && e.f?.dog) {
      const d = e.f.dog;
      this._pixelBadge("呜——汪！", d.x, d.y - 48 - (calm ? 0 : Math.sin(t * 12) * 3), "#ffd59a");
    }
    // 撬锁的进度
    if (ux.pry) {
      const P = ux.pry,
        k = Math.min(1, P.t / P.max),
        w = 44,
        X = Math.round((P.o.x - w / 2) / 2) * 2,
        Y = Math.round((P.o.y - (P.door ? 96 : 70)) / 2) * 2;
      c.fillStyle = "#140f0b";
      c.fillRect(X - 2, Y - 2, w + 4, 8);
      c.fillStyle = "#4a3c30";
      c.fillRect(X, Y, w, 4);
      c.fillStyle = P.silent ? "#8fd0ff" : "#ffdb8c";
      c.fillRect(X, Y, Math.round((w * k) / 2) * 2, 4);
      this._pixelText(P.silent ? "开锁" : "撬", P.o.x, Y - 12, P.silent ? "#8fd0ff" : "#ffdb8c", 12);
    }
    // 空投：落点的影子越来越大，伞挂着箱子晃着往下落
    if (ux.drop) {
      const D = ux.drop,
        k = 1 - Math.max(0, D.t) / D.max,
        sr = 16 + 26 * k;
      c.fillStyle = "#140f0b";
      c.globalAlpha = 0.18 + 0.3 * k;
      for (let yy = -sr * 0.35; yy <= sr * 0.35; yy += 2) {
        const hw = sr * Math.sqrt(Math.max(0, 1 - (yy * yy) / (sr * sr * 0.1225)));
        c.fillRect(Math.round((D.x - hw) / 2) * 2, Math.round((D.y + yy) / 2) * 2, Math.round(hw) * 2 || 2, 2);
      }
      c.globalAlpha = 1;
      ring(D.x, D.y, 22 + 30 * k, "#efd89a", 24, 0.85);
      const x = D.x + (calm ? 0 : Math.sin(t * 1.7) * 10 * (1 - k)),
        y = D.y - 30 - 260 * (1 - k),
        cs = crateSprite("cache"),
        cy = y - 96,
        top = y - 26;
      // 伞绳
      c.fillStyle = "#3a2c22";
      for (const [ax, bx] of [
        [-36, -16],
        [-14, -6],
        [14, 6],
        [36, 16],
      ])
        for (let s2 = 0; s2 <= 1; s2 += 0.08) dot(x + ax + (bx - ax) * s2, cy + (top - cy) * s2, 2, 2);
      if (cs) this.px(cs, x, y);
      // 伞面：半个椭圆，橙白相间，深色描边（宽 76，高 24）
      const dome = (i) => Math.round((Math.sqrt(1 - (i / 10) * (i / 10)) * 24) / 2) * 2;
      c.fillStyle = "#140f0b";
      for (let i = -9; i <= 9; i++) c.fillRect(Math.round((x + i * 4) / 2) * 2 - 2, cy - dome(i) - 2, 8, dome(i) + 4);
      for (let i = -9; i <= 9; i++) {
        const h = dome(i),
          X = Math.round((x + i * 4) / 2) * 2;
        c.fillStyle = Math.floor((i + 9) / 3) % 2 ? "#efe3c4" : "#d8742c";
        c.fillRect(X, cy - h, 4, h);
        c.fillStyle = "rgba(20,15,11,0.25)";
        c.fillRect(X, cy - 4, 4, 4);
      }
      this._pixelText("空投 " + Math.ceil(D.t) + " 秒", D.x, D.y + 26, "#efd89a", 12);
    }
    // 被困的人：血条
    if (ux.surv && e.ut.ev?.st === "follow") {
      const S = ux.surv,
        o = S.o,
        w = 40,
        X = Math.round((o.x - w / 2) / 2) * 2,
        Y = Math.round((o.y - 70) / 2) * 2;
      c.fillStyle = "#140f0b";
      c.fillRect(X - 2, Y - 2, w + 4, 8);
      c.fillStyle = "#4a3c30";
      c.fillRect(X, Y, w, 4);
      c.fillStyle = S.held > 0 ? danger : this.safeColor;
      c.fillRect(X, Y, Math.round((w * Math.max(0, S.hp / EVENT_RULES.trapped.hp)) / 2) * 2, 4);
    }
    c.restore();
  }

  // 要炸的膨胀者：亮绿的一版
  flashSprite() {
    if (this._uFlash !== undefined) return this._uFlash;
    const base = uZombieSprite("bloater", "down", 0),
      cv = base ? makeCanvas(base.width, base.height) : null;
    if (cv) {
      const g = cv.getContext("2d");
      g.drawImage(base, 0, 0);
      g.globalCompositeOperation = "source-atop";
      g.fillStyle = "rgba(232,255,170,0.62)";
      g.fillRect(0, 0, cv.width, cv.height);
    }
    this._uFlash = cv || base;
    return this._uFlash;
  }
  // 地图小图：躺着装死的不标
  drawMapPreview(canvas, e) {
    const all = e?.enemies;
    if (all && e.ut) e.enemies = all.filter((z) => !z.lying);
    try {
      return super.drawMapPreview(canvas, e);
    } finally {
      if (all) e.enemies = all;
    }
  }
  // ---------- 光：毒雾、酸液发一点绿光；宵禁时农场夜里灯灭 ----------
  collectLights(e, night) {
    let lights = super.collectLights(e, night);
    if (!e?.ut) return lights;
    if (this.curfewDark(e, night)) lights = lights.filter((l) => l.color !== LAMP && l.color !== WARM);
    if (night > 0.2 && e.ux) {
      const safe = !!e.s?.settings?.access?.color;
      for (const g of e.ux.clouds) lights.push({ x: g.x, y: g.y - 10, r: 80, color: safe ? [190, 160, 255] : [150, 210, 110], power: 0.35 });
      for (const q of e.ux.puddles) lights.push({ x: q.x, y: q.y, r: 50, color: [170, 220, 110], power: 0.3, small: true });
    }
    return lights;
  }
  drawEmissive(e, night, view) {
    return super.drawEmissive(e, this.curfewDark(e, night) ? Math.min(night, 0.2) : night, view);
  }
  curfewDark(e, night) {
    return e?.s?.region === "farm" && night > 0.3 && !!e.decree?.("curfew");
  }
}
