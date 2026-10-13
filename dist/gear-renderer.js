// v0.22.0「披挂」的画面：身上穿的装备、手里的新武器（挥动 3 段）、推开、倒地、被抓住；
// 感染者出手前的预兆（奔跑者蹲身 + 地上的箭头、重甲跺脚 + 冲撞线、尖叫者喉咙一圈圈、爬行者伸手的红圈、“？”“！”），
// 地上的陷阱和燃烧瓶的火、装着装备的柜子。预兆和提示都在光照之后画，夜里也看得清。
import { Renderer as VisualRenderer } from "./visual-renderer.js";
import { Renderer as GardenRenderer } from "./garden-renderer.js";
import { personSprite, dirFromAngle, crawlerSprite, zombieSprite, lookFor } from "./pixel-sprites.js";
import { gearLook, heldSprite, swingPose, meleeKind, trapSprite, fireSprite, gearCrateSprite, gearIconSheet, gearIconIndex } from "./gear-sprites.js";
import { RULES, RANGED, MELEE, ARMOR } from "./gear-data.js";
import { FIRE, nightness } from "./pixel-light.js";
import { keyLabel } from "./farlands-ui.js";

const SWING_TIME = 0.24;
const lunge = RULES.lunge,
  charge = RULES.charge,
  crawl = RULES.crawl;

export class Renderer extends VisualRenderer {
  draw(engine, mouse, dt = 0.016) {
    this._gE = engine;
    this._gMouse = mouse;
    super.draw(engine, mouse, dt);
  }
  // 物品小图里 "g" 开头的编号画在装备图集里
  sprite(index, x, y, w = 48, h = w, anchor = true, alpha = 1, flip = false) {
    const i = gearIconIndex(index);
    if (i < 0) return super.sprite(index, x, y, w, h, anchor, alpha, flip);
    if (this._mute) return;
    const sh = gearIconSheet();
    if (!sh?.canvas) return;
    const c = this.ctx;
    c.save();
    c.globalAlpha = alpha ?? 1;
    c.imageSmoothingEnabled = false;
    c.drawImage(sh.canvas, (i % sh.cols) * sh.cell, Math.floor(i / sh.cols) * sh.cell, sh.cell, sh.cell, x - w / 2, anchor ? y - h : y - h / 2, w, h);
    c.restore();
  }
  get dangerColor() {
    return this._gE?.s.settings?.access?.color ? "#f0a040" : "#ff4a3a";
  }
  get safeColor() {
    return this._gE?.s.settings?.access?.color ? "#4aa3ff" : "#8fd07a";
  }

  // ---------- 地上：陷阱、火 ----------
  drawFarm(e) {
    super.drawFarm(e);
    this.drawGearGround(e);
  }
  drawRuins(e) {
    const out = super.drawRuins(e);
    this.drawGearGround(e);
    return out;
  }
  drawGearGround(e) {
    if (!this.v || !e.gr) return;
    const region = e.s.region;
    for (const t of e.gr.traps) if (t.region === region) this.px(trapSprite(t.kind), t.x, t.y + 6);
    const frame = this.calm ? 0 : Math.floor(this.time * 8) % 3;
    for (const f of e.gx.fires) if (f.region === region && f.t > 0) this.px(fireSprite(frame), f.x, f.y + 12, { alpha: Math.min(1, f.t / 0.5) });
  }
  collectLights(e, night) {
    const lights = super.collectLights(e, night);
    if (!e.gr) return lights;
    for (const f of e.gx.fires) if (f.region === e.s.region && f.t > 0) lights.push({ x: f.x, y: f.y, r: 130, color: FIRE, power: 0.9 });
    // 头灯：自己身边更亮一圈，往前多照一截
    if (e.armorTotals?.().light && !["farm", "market"].includes(e.s.region)) {
      const p = e.s.player,
        a = p.facing ?? Math.PI / 2;
      lights.push({ x: p.x, y: p.y - 18, r: 230, color: [190, 176, 140], power: 0.6 });
      lights.push({ x: p.x + Math.cos(a) * 120, y: p.y - 18 + Math.sin(a) * 90, r: 150, color: [205, 190, 150], power: 0.55 });
    }
    return lights;
  }

  // ---------- 装着装备的柜子 ----------
  drawObject(o, e) {
    if (o.type !== "gearCrate" || !this.v) return super.drawObject(o, e);
    const p = e.s.player,
      near = Math.hypot(p.x - o.x, p.y - o.y) < 170;
    this.pxShadow(o.x, o.y, 26);
    this.px(gearCrateSprite(), o.x, o.y + 4);
    if (near) this.badge(o.name, o.x, o.y - 58, o.guard && e.enemies.some((z) => z.type === "elite" && !z.dead) ? "#f1b4a2" : "#efd89a");
  }

  // ---------- 穿着防具的居民 ----------
  drawVillager(o, x, y, alpha = 1, index = 56) {
    const e = this.sceneEngine || this.labelEngine || this._gE,
      armour = o?.resident ? e?.gr?.guards?.[o.resident] : null,
      kind = ARMOR[armour]?.look?.armor;
    if (!kind) return super.drawVillager(o, x, y, alpha, index);
    const r = (e?.s.colony?.residents || []).find((a) => a.id === o.resident),
      role = r?.workRole || r?.role || null,
      moving = !!(r?.target && Math.hypot(r.x - r.target.x, r.y - r.target.y) > 8),
      look = { ...lookFor(o.resident, role), armor: kind, sig: (role || "") + ":" + armour },
      f = this.personFrame(look, o.resident, r?.facing ?? Math.PI / 2, moving);
    this.pxShadow(x, y, 18);
    this.px(f.canvas, x, y, { flip: f.flip, alpha, foot: 1 });
  }

  // ---------- 主角 ----------
  playerLook(e) {
    const g = e.gr?.slots || {},
      key = ["head", "body", "hands", "legs", "feet"].map((k) => g[k] || "").join("|");
    if (this._lookKey !== key) {
      this._lookKey = key;
      this._look = gearLook(g);
    }
    return this._look;
  }
  drawPlayer(e) {
    if (!this.v || !e.gr) return super.drawPlayer(e);
    const p = e.s.player,
      gx = e.gx,
      c = this.ctx,
      walking = !!e.walking && !e.paused && !gx.grab && !(gx.down > 0),
      { dir, flip } = dirFromAngle(p.facing),
      frame = walking ? Math.floor((e.moveTime || this.time) * 9) % 4 : 0,
      pose = e.actionAnim > 0 || gx.swing ? "work" : "walk",
      alpha = e.invulnerable > 0 && Math.floor(e.invulnerable * 12) % 2 === 0 ? 0.45 : 1,
      look = this.playerLook(e),
      id = e.currentItem(),
      held = heldSprite(id),
      spr = personSprite(look, "player", dir, frame, pose);
    this.pxShadow(p.x, p.y, 20);
    // 倒地：人横躺着，手里的东西掉在旁边
    if (gx.down > 0) {
      c.save();
      c.imageSmoothingEnabled = false;
      c.globalAlpha = alpha;
      c.translate(Math.round(p.x / 2) * 2, Math.round((p.y - 10) / 2) * 2);
      c.rotate(flip ? -Math.PI / 2 : Math.PI / 2);
      c.drawImage(spr, -spr.width, -spr.height, spr.width * 2, spr.height * 2);
      c.restore();
      return;
    }
    // 被抓住：左右晃
    const shake = gx.grab && !this.calm ? Math.round(Math.sin(this.time * 40)) * 2 : 0,
      x = p.x + shake;
    if (!held) {
      // 锄头、水壶、种子、枪：照原来的画法画在手上
      if (dir === "up") this.muted(() => GardenRenderer.prototype.drawPlayer.call(this, e));
      this.px(spr, x, p.y, { flip, alpha, foot: 1 });
      if (dir !== "up") this.muted(() => GardenRenderer.prototype.drawPlayer.call(this, e));
    } else {
      if (dir === "up") this.drawHeld(e, id, held, alpha);
      this.px(spr, x, p.y, { flip, alpha, foot: 1 });
      if (dir !== "up") this.drawHeld(e, id, held, alpha);
      if (e.f?.crouch) this.badge(e.inCover?.() ? "草丛隐蔽" : "蹲行", p.x, p.y + 20, "#cbdda5");
    }
    if (gx.swing?.id === "shove") this.drawShove(e);
  }
  // 手里的武器：平时斜着拿，挥动时按 抬起 → 劈下 → 收势 转过去；长柄往前捅
  drawHeld(e, id, held, alpha) {
    const p = e.s.player,
      c = this.ctx,
      sw = e.gx.swing,
      kind = meleeKind(id),
      face = p.facing ?? Math.PI / 2,
      side = Math.cos(face) >= 0 ? 1 : -1;
    let a = face + (kind === "ranged" ? 0 : side * -0.55),
      push = 0,
      t = -1;
    if (sw && sw.id === id) {
      t = 1 - Math.max(0, sw.t) / SWING_TIME;
      const ps = swingPose(kind, t);
      a = sw.a + ps.rot * (Math.cos(sw.a) >= 0 ? 1 : -1);
      push = ps.push;
    }
    const hx = p.x + Math.cos(face) * 9,
      hy = p.y - 26 + Math.sin(face) * 6;
    c.save();
    c.imageSmoothingEnabled = false;
    c.globalAlpha = alpha;
    c.translate(Math.round(hx), Math.round(hy));
    c.rotate(a);
    if (Math.cos(a) < 0) c.scale(1, -1);
    c.drawImage(held.canvas, push - held.ox * 2, -held.oy * 2, held.canvas.width * 2, held.canvas.height * 2);
    c.restore();
    // 挥过去的那一下留一道弧
    if (t > 0.25 && t < 0.75 && kind !== "pole" && kind !== "ranged" && !this.calm) {
      const r = held.canvas.width * 2 - 4,
        from = sw.a - 1.1 * (Math.cos(sw.a) >= 0 ? 1 : -1),
        to = a;
      c.save();
      c.fillStyle = "rgba(241,227,194,0.55)";
      const n = 7;
      for (let k = 0; k <= n; k++) {
        const aa = from + ((to - from) * k) / n;
        c.fillRect(Math.round((hx + Math.cos(aa) * r) / 2) * 2, Math.round((hy + Math.sin(aa) * r) / 2) * 2, 4, 2);
      }
      c.restore();
    }
  }
  drawShove(e) {
    const p = e.s.player,
      c = this.ctx,
      a = e.gx.swing.a ?? p.facing ?? 0,
      t = 1 - e.gx.swing.t / 0.2;
    c.save();
    c.fillStyle = "rgba(241,227,194,0.7)";
    for (let k = -2; k <= 2; k++) {
      const aa = a + k * 0.3,
        r = 26 + t * 18;
      c.fillRect(Math.round((p.x + Math.cos(aa) * r) / 2) * 2, Math.round((p.y - 26 + Math.sin(aa) * r * 0.7) / 2) * 2, 4, 2);
    }
    c.restore();
  }

  // ---------- 感染者 ----------
  drawZombie(z, x, y, alpha = 1) {
    const e = this._gE;
    if (!e?.gr || z.type === "elite") return super.drawZombie(z, x, y, alpha);
    const type = z.type in { slow: 1, runner: 1, screamer: 1, armor: 1 } ? z.type : "slow";
    if (z.crawl) {
      const frame = this.calm ? 0 : Math.floor(this.time * 3 + (z.id || 0)) % 2,
        flip = Math.cos(z.facing ?? 0) < 0;
      this.pxShadow(x, y, 26);
      this.px(crawlerSprite(type, frame, z.reach > 0), x, y + 2, { flip, alpha, foot: 1 });
      return;
    }
    const L = z.lunge,
      C = z.charge,
      down = (L && L.phase === "stumble") || (C && C.phase === "stun") || z.stunT > 0;
    if (!L && !C && !down) return super.drawZombie(z, x, y, alpha);
    const { dir, flip } = dirFromAngle(z.facing ?? Math.PI / 2),
      spr = zombieSprite(type, dir, 0);
    if (!spr) return super.drawZombie(z, x, y, alpha);
    let sx = 1,
      sy = 1,
      rot = 0,
      lift = 0,
      dx = 0;
    if (L?.phase === "crouch") {
      sy = 0.78;
      sx = 1.12;
    } else if (L?.phase === "leap") {
      sy = 1.05;
      lift = 8;
      rot = (flip ? -1 : 1) * 0.35;
    } else if (C?.phase === "stomp") dx = this.calm ? 0 : Math.round(Math.sin(this.time * 40)) * 2;
    if (down) rot = (flip ? -1 : 1) * 0.5;
    const c = this.ctx;
    this.pxShadow(x, y, 20);
    c.save();
    c.imageSmoothingEnabled = false;
    c.globalAlpha = alpha;
    c.translate(Math.round(x + dx), Math.round(y - lift));
    if (rot) c.rotate(rot);
    c.scale(flip ? -sx : sx, sy);
    c.drawImage(spr, -spr.width, -spr.height * 2 + 2, spr.width * 2, spr.height * 2);
    c.restore();
  }

  // ---------- 光照之后：预兆、提示 ----------
  drawNight(e) {
    // 弹弓、弩也给一个准星
    const id = e.currentItem?.();
    if (this.v && RANGED[id] && !RANGED[id].gun && !e.paused && this._gMouse && !this._cross) this._cross = this._gMouse;
    super.drawNight(e);
    if (this.v && e.gr) this.drawGearMarks(e);
  }
  drawGearMarks(e) {
    const c = this.ctx,
      t = this.time,
      calm = this.calm,
      danger = this.dangerColor,
      sc = this.camera.scale,
      view = { x: this.camera.x - 60, y: this.camera.y - 80, w: this.w / sc + 120, h: this.h / sc + 160 },
      inView = (o) => o.x > view.x && o.x < view.x + view.w && o.y > view.y && o.y < view.y + view.h,
      pulse = (f = 6) => (calm ? 1 : 0.65 + 0.35 * Math.sin(t * f)),
      dot = (x, y, w = 4, h = 4) => c.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h),
      // 带深色描边的一小块，夜里、在浅色地面上都看得清
      mark = (x, y, w, h, col) => {
        const X = Math.round(x / 2) * 2,
          Y = Math.round(y / 2) * 2;
        c.fillStyle = "#140f0b";
        c.fillRect(X - 2, Y - 2, w + 4, h + 4);
        c.fillStyle = col;
        c.fillRect(X, Y, w, h);
      };
    c.save();
    // 夜里在外面：黑暗里两点发光的眼睛
    const dark = !this.indoor && !["farm", "market"].includes(e.s.region) ? nightness(this.vMinute) : 0,
      p0 = e.s.player,
      crowded = e.enemies.filter((o) => !o.dead && !o.nest && !o.crawl && Math.hypot(o.x - p0.x, o.y - p0.y) < RULES.grab.around).length >= 2;
    for (const z of e.enemies) {
      if (z.dead || z.nest || z.type === "raider" || !inView(z)) continue;
      if (dark > 0.35 && !z.crawl) {
        const { dir, flip } = dirFromAngle(z.facing ?? Math.PI / 2),
          big = z.type === "elite",
          ey = z.y - (big ? 74 : 48) + (z.lunge?.phase === "crouch" ? 10 : 0);
        c.globalAlpha = Math.min(1, (dark - 0.25) * 1.6);
        c.fillStyle = z.state === "chase" ? "#ff8a7a" : "#ffdb8c";
        if (dir === "down") {
          dot(z.x - 7, ey, 4, 2);
          dot(z.x + 1, ey, 4, 2);
        } else if (dir === "side") dot(z.x + (flip ? -8 : 4), ey, 4, 2);
        c.globalAlpha = 1;
      }
      // 要抓人：出手预兆时张开双臂（只在你被围住、或它在你背后时）
      if (z.windup > 0 && z.type !== "screamer" && !z.crawl) {
        const behind = Math.abs(Math.atan2(Math.sin(Math.atan2(z.y - p0.y, z.x - p0.x) - (p0.facing ?? 0)), Math.cos(Math.atan2(z.y - p0.y, z.x - p0.x) - (p0.facing ?? 0)))) > RULES.grab.behind;
        if (crowded || behind) {
          const sy = z.y - (z.type === "elite" ? 60 : 40),
            w = z.type === "elite" ? 28 : 18,
            lift = calm ? 0 : Math.round(Math.sin(t * 14)) * 2;
          c.globalAlpha = 0.95;
          for (const sgn of [-1, 1]) {
            mark(z.x + sgn * w - 3, sy - 6 - lift, 6, 4, "#f0a040");
            mark(z.x + sgn * (w + 6) - 2, sy - 12 - lift, 4, 4, "#f0a040");
          }
          c.globalAlpha = 1;
          this._pixelText("抓！", z.x, z.y - (z.type === "elite" ? 124 : 100), "#f0a040", 12);
        }
      }
      // 奔跑者蹲身：地上一支箭头指向它要扑的方向
      if (z.lunge?.phase === "crouch") {
        const a = z.lunge.a,
          len = lunge.dist,
          k0 = 1 - Math.max(0, z.lunge.t) / lunge.crouch;
        c.globalAlpha = 0.95 * pulse(10);
        // 虚线从脚下伸到它要落下的地方，越接近出手伸得越长
        for (let k = 14; k < len * Math.max(0.35, Math.min(1, k0 + 0.35)); k += 12) mark(z.x + Math.cos(a) * k - 3, z.y + Math.sin(a) * k - 2, 6, 4, danger);
        const hx = z.x + Math.cos(a) * len,
          hy = z.y + Math.sin(a) * len;
        for (const s of [-1, 1]) for (let k = 0; k < 4; k++) mark(hx - Math.cos(a + s * 0.6) * k * 7 - 2, hy - Math.sin(a + s * 0.6) * k * 7 - 2, 4, 4, danger);
        c.globalAlpha = 1;
        this._pixelText("扑！", z.x, z.y - 74, danger, 24);
      }
      // 重甲跺脚：冲撞会走的那条线
      if (z.charge?.phase === "stomp") {
        const a = z.charge.a,
          len = charge.len;
        c.globalAlpha = 0.85 * pulse(12);
        // 两条边线 + 箭头：冲撞会扫过的那条路
        for (let k = 0; k < len; k += 10) {
          const x = z.x + Math.cos(a) * k,
            y = z.y + Math.sin(a) * k;
          mark(x - Math.sin(a) * 18 - 2, y + Math.cos(a) * 18 - 2, 4, 4, danger);
          mark(x + Math.sin(a) * 18 - 2, y - Math.cos(a) * 18 - 2, 4, 4, danger);
        }
        for (let k = 40; k < len; k += 60)
          for (const s of [-1, 1]) for (let j = 0; j < 3; j++) mark(z.x + Math.cos(a) * (k - j * 6) - Math.sin(a) * s * j * 6 - 2, z.y + Math.sin(a) * (k - j * 6) + Math.cos(a) * s * j * 6 - 2, 4, 4, danger);
        c.globalAlpha = 1;
        this._pixelText("冲撞！", z.x, z.y - 82, danger, 24);
      }
      // 尖叫者：喉咙一圈圈往外扩
      if (z.type === "screamer" && z.windup > 0) {
        c.fillStyle = "#e9c05a";
        for (let r0 = 0; r0 < 3; r0++) {
          const r = 10 + ((t * 40 + r0 * 14) % 42);
          c.globalAlpha = calm ? 0.6 : Math.max(0, 1 - r / 52);
          for (let k = 0; k < 16; k++) {
            const aa = (k / 16) * Math.PI * 2;
            dot(z.x + Math.cos(aa) * r - 1, z.y - 52 + Math.sin(aa) * r * 0.6 - 1, 2, 2);
          }
        }
        c.globalAlpha = 1;
      }
      // 爬行者伸手：地上一圈红，越来越满
      if (z.crawl) {
        const k = z.reach > 0 ? 1 - z.reach / crawl.warn : 0;
        c.fillStyle = danger;
        c.globalAlpha = z.reach > 0 ? 0.9 : 0.35;
        const n = 18,
          shown = z.reach > 0 ? Math.max(3, Math.round(n * k)) : n;
        for (let i = 0; i < shown; i++) {
          const aa = (i / n) * Math.PI * 2 - Math.PI / 2;
          dot(z.x + Math.cos(aa) * (crawl.reach + 6) - 1, z.y + Math.sin(aa) * (crawl.reach + 6) * 0.5 - 1, 2, 2);
        }
        c.globalAlpha = 1;
        if (z.reach > 0) this._pixelText("咬脚！", z.x, z.y - 34, danger, 24);
      }
      // 听见声音过来看：“？”；同伴叫醒、正转过身：“！”
      if (z.heard > 0 && z.state === "chase") this._pixelText("？", z.x, z.y - 72, "#e9c05a", 24);
      else if (z.turnT > 0) this._pixelText("！", z.x, z.y - 72, "#f0a040", 24);
      // 晕住、绊倒：头上转圈的星星
      if (z.stagger > 0 || z.stunT > 0 || z.charge?.phase === "stun" || z.lunge?.phase === "stumble") {
        c.fillStyle = "#ffdb8c";
        for (let k = 0; k < 3; k++) {
          const aa = (calm ? 0 : t * 5) + (k * Math.PI * 2) / 3;
          dot(z.x + Math.cos(aa) * 12 - 1, z.y - 62 + Math.sin(aa) * 4 - 1, 2, 2);
        }
      }
      if (z.trapHeld > 0) this._pixelText(z.netHeld ? "网住了" : "夹住了", z.x, z.y - 70, "#ffdb8c", 12);
    }
    // 自己：被抓住时的挣脱圈和按键提示；流血滴血；倒地
    const p = e.s.player,
      gx = e.gx;
    if (gx.grab) {
      const g = gx.grab,
        cx = p.x,
        cy = p.y - 30,
        n = 24;
      for (let i = 0; i < n; i++) {
        const aa = (i / n) * Math.PI * 2 - Math.PI / 2,
          on = i / n < g.escape;
        c.fillStyle = on ? this.safeColor : "#4a3c30";
        dot(cx + Math.cos(aa) * 30 - 2, cy + Math.sin(aa) * 30 - 2);
      }
      // 剩下的时间：外圈红点越来越少
      c.fillStyle = danger;
      const left = Math.max(0, g.t / g.max);
      for (let i = 0; i < Math.round(n * left); i++) {
        const aa = (i / n) * Math.PI * 2 - Math.PI / 2;
        dot(cx + Math.cos(aa) * 38 - 1, cy + Math.sin(aa) * 38 - 1, 2, 2);
      }
      const s = e.s.settings;
      this._pixelBadge(`${keyLabel(s, "shove") || "X"} 推开 · 连按 ${keyLabel(s, "interact") || "E"}`, cx, cy - 52, "#ffdb8c");
    } else if (gx.down > 0) this._pixelText("倒地", p.x, p.y - 44, "#f1b4a2", 12);
    if (gx.bleed > 0 && !calm) {
      c.fillStyle = "#a8433a";
      for (let k = 0; k < 2; k++) {
        const ph = (t * 1.6 + k * 0.5) % 1;
        dot(p.x - 6 + k * 10, p.y - 20 + ph * 22, 2, 2 + (ph > 0.8 ? 0 : 2));
      }
    }
    c.restore();
  }
}
export const GEAR_RENDER_ITEMS = Object.keys(MELEE);
