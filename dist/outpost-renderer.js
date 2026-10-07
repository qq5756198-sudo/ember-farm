// v0.14.0「商路与火光」的场景表现：出货箱、商队、营门来访者、机床、运输骡、伤员、俘虏、援建队员、
// 灰隼团枪手（瞄准红线、掩体、撤退）、加工站气泡与防线视图。
import { Renderer as AllianceRenderer } from "./alliance-renderer.js";
import { pixelPainter } from "./beyond-art.js";
import { BUILDINGS, RECIPES } from "./data.js";
import { HORDE_DIRECTIONS } from "./expansion-data.js";
import { NPCS, VISITOR_LOOKS, OUTPOST_OBJECTS } from "./outpost-data.js";

const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r;
const lookOf = (look) => (typeof look === "string" ? NPCS[look]?.look : VISITOR_LOOKS[look]) || VISITOR_LOOKS[0];

export class Renderer extends AllianceRenderer {
  // 把玩家精灵重新上色，得到灰隼团枪手的外观。
  raiderSheet() {
    if (this._raiderSheet !== undefined) return this._raiderSheet;
    this._raiderSheet = null;
    try {
      const img = this.assets.sprites;
      if (typeof document === "undefined" || !img?.width) return null;
      const cv = document.createElement("canvas"),
        sx = img.width / 8,
        sy = img.height / 8;
      cv.width = Math.round(sx * 8);
      cv.height = Math.round(sy * 2);
      const c = cv.getContext("2d");
      c.drawImage(img, 0, 0, sx * 8, sy * 2, 0, 0, cv.width, cv.height);
      const data = c.getImageData(0, 0, cv.width, cv.height),
        px = data.data;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3] < 10) continue;
        const r = px[i],
          g = px[i + 1],
          b = px[i + 2],
          l = 0.3 * r + 0.59 * g + 0.11 * b;
        if (r >= 110 && g < r * 0.45 && b < r * 0.4) {
          px[i] = Math.min(255, l * 1.6 + 30);
          px[i + 1] = l * 0.35;
          px[i + 2] = l * 0.3;
        } else if (r > 30 && Math.abs(r - g) <= 22 && g > b + 14) {
          px[i] = l * 0.62;
          px[i + 1] = l * 0.64;
          px[i + 2] = l * 0.7;
        }
      }
      c.putImageData(data, 0, 0);
      this._raiderSheet = { canvas: cv, sx: cv.width / 8, sy: cv.height / 2 };
    } catch {
      this._raiderSheet = null;
    }
    return this._raiderSheet;
  }
  person(sheet, x, y, facing = Math.PI / 2, moving = false, alpha = 1) {
    let index =
      facing >= Math.PI / 4 && facing < Math.PI * 0.75
        ? 0
        : facing < -Math.PI / 4 && facing > -Math.PI * 0.75
          ? 4
          : facing >= -Math.PI / 4 && facing <= Math.PI / 4
            ? 8
            : 12;
    if (moving) index += Math.floor(this.time * 8) % 4;
    this.shadow(x, y, 19);
    if (sheet) {
      const c = this.ctx;
      c.save();
      c.globalAlpha = alpha;
      c.drawImage(sheet.canvas, (index % 8) * sheet.sx, Math.floor(index / 8) * sheet.sy, sheet.sx, sheet.sy, x - 27, y - 65, 54, 65);
      c.restore();
    } else this.sprite(index, x, y, 54, 65, true, alpha);
  }
  headwear(x, y, look) {
    const { rect } = pixelPainter(this.ctx),
      k = lookOf(look);
    if (k.extra === "hat") {
      rect(x - 14, y - 60, 28, 4, k.accent);
      rect(x - 9, y - 67, 18, 8, "#6d5a2c");
    } else if (k.extra === "goggles") {
      rect(x - 11, y - 58, 22, 4, "#5a4a3a");
      rect(x - 9, y - 58, 6, 4, k.accent);
      rect(x + 3, y - 58, 6, 4, k.accent);
    } else if (k.extra === "glasses") {
      rect(x - 8, y - 50, 6, 3, k.accent);
      rect(x + 2, y - 50, 6, 3, k.accent);
    } else if (k.extra === "scarf") rect(x - 12, y - 41, 24, 5, k.accent);
    else if (k.extra === "scar") rect(x + 4, y - 54, 2, 7, k.accent);
    else {
      rect(x - 11, y - 61, 22, 6, k.hair);
      rect(x - 11, y - 56, 22, 2, k.accent);
    }
  }
  drawObject(o, e) {
    if (o.type === "allianceHelper" && o.crew) return this.drawCrew(o, e);
    if (OUTPOST_OBJECTS.includes(o.type)) return this.drawOutpostObject(o, e);
    return super.drawObject(o, e);
  }
  label(o, e, color = "#e8d9a6", always = false) {
    const goal = this.rebuildTarget,
      isGoal = goal && goal.region === e.s.region && near(goal, o, 40);
    if (always || isGoal || near(o, e.s.player, 200)) this.text(o.name, o.x, o.y - 78, color, 12);
  }
  drawCrew(o, e) {
    const c = (e.o?.crew || []).find((x) => x.id === o.helper);
    if (!c) return;
    const moving = c.target && Math.hypot(c.x - c.target.x, c.y - c.target.y) > 8;
    if (c.role === "scout" && c.task === "scout" && !moving && c.x > 1400) return;
    const { rect } = pixelPainter(this.ctx);
    this.person(this.helperSheet(), o.x, o.y, c.facing || 0, moving);
    this.headwear(o.x, o.y, c.look);
    if (c.role === "guard") rect(o.x + 10, o.y - 38, 16, 3, "#3e3a34");
    if (c.task === "carry" && moving) {
      const bob = Math.sin(this.time * 8) * 1.5;
      rect(o.x - 10, o.y - 31 + bob, 20, 12, "#8d754e");
      rect(o.x - 10, o.y - 31 + bob, 20, 3, "#c3a574");
    }
    if (c.task === "build" && !moving && Math.floor(this.time * 3) % 2) rect(o.x + 14, o.y - 44, 4, 12, "#b8b2a0");
    if (near(o, e.s.player, 260) || this.defense) this.text(o.name, o.x, o.y - 80, "#9fc6e8", 12);
    if (near(o, e.s.player, 110)) this.text(c.status, o.x, o.y - 95, "#b8d4b1", 10);
  }
  drawOutpostObject(o, e) {
    const p = pixelPainter(this.ctx),
      { rect, line, crate } = p,
      x = o.x,
      y = o.y,
      t = this.time,
      op = e.o;
    switch (o.type) {
      case "outpostShipping": {
        this.shadow(x, y, 26);
        rect(x - 22, y - 30, 44, 30, "#6b5435");
        rect(x - 22, y - 30, 44, 4, "#b39463");
        rect(x - 20, y - 24, 40, 2, "#4f3d26");
        rect(x - 20, y - 14, 40, 2, "#4f3d26");
        rect(x - 24, y - 36, 48, 7, "#8a6c43");
        rect(x - 6, y - 46, 12, 10, "#d8c58f");
        rect(x - 4, y - 43, 8, 2, "#6b5435");
        const v = e.shipValue?.() || 0;
        if (v) for (let i = 0; i < 3; i++) rect(x - 12 + i * 9, y - 40 - Math.abs(Math.sin(t * 3 + i)) * 4, 6, 6, "#f1cf6a");
        this.label(o, e, v ? "#f1d98a" : "#e8d9a6");
        if (v && near(o, e.s.player, 260)) this.text("明早 +" + v + " 金币", x, y - 62, "#f1d98a", 11);
        return;
      }
      case "outpostCaravan": {
        this.shadow(x, y + 4, 56);
        rect(x - 48, y - 30, 96, 26, "#7a5a36");
        rect(x - 48, y - 30, 96, 4, "#a8865a");
        for (const wx of [-30, 30]) {
          rect(x + wx - 11, y - 8, 22, 22, "#2f2a22");
          rect(x + wx - 7, y - 4, 14, 14, "#8b7350");
          rect(x + wx - 2, y + 1, 4, 4, "#2f2a22");
        }
        for (let i = 0; i < 5; i++) rect(x - 44 + i * 18, y - 62 + Math.abs(2 - i) * 3, 18, 34 - Math.abs(2 - i) * 3, i % 2 ? "#d8cfb0" : "#c9bf9c");
        rect(x - 44, y - 30, 88, 3, "#9a8f6f");
        rect(x + 40, y - 70, 3, 40, "#5b4a33");
        rect(x + 43, y - 70, 18, 11, "#c94b3d");
        this.text("全城最低价", x - 2, y - 46, "#5b3a22", 10);
        crate(x - 70, y + 2, 22, 18);
        crate(x - 62, y - 14, 18, 14);
        this.person(null, x + 72, y + 12, Math.PI);
        this.headwear(x + 72, y + 12, "tangjiu");
        this.label(o, e, "#f1d98a", true);
        return;
      }
      case "outpostVisitor": {
        const v = op.visitors.current;
        this.person(null, x, y, Math.PI);
        if (v) this.headwear(x, y, v.look);
        rect(x + 8, y - 44, 12, 18, "#6f5a3a");
        const bob = Math.sin(t * 3) * 2;
        rect(x - 7, y - 104 + bob, 14, 16, "#f1e3b0");
        this.text("?", x, y - 96 + bob, "#3a2f20", 13);
        this.label(o, e, "#f1d98a", true);
        return;
      }
      case "outpostQuarantine": {
        this.shadow(x, y, 30);
        rect(x - 28, y - 34, 56, 34, "#8e9a8a");
        rect(x - 24, y - 44, 48, 12, "#a9b5a3");
        rect(x - 4, y - 28, 8, 20, "#c94b3d");
        rect(x - 10, y - 22, 20, 8, "#c94b3d");
        this.label(o, e);
        return;
      }
      case "outpostLathe": {
        const ok = !!op.lathe;
        this.shadow(x, y, 40);
        rect(x - 40, y - 36, 80, 36, ok ? "#5d6a66" : "#5f5249");
        rect(x - 40, y - 36, 80, 5, ok ? "#93a29b" : "#7d6658");
        rect(x - 34, y - 54, 28, 18, ok ? "#4b5754" : "#58463c");
        rect(x + 6, y - 50, 30, 12, ok ? "#7f8d86" : "#6c5547");
        if (ok) {
          const a = t * (op.lathe.mode ? 6 : 1);
          line(x - 20, y - 45, x - 20 + Math.cos(a) * 9, y - 45 + Math.sin(a) * 9, "#e2c97a", 3);
          rect(x + 26, y - 64, 6, 10, "#3d4a40");
          rect(x + 27, y - 63, 4, 4, Math.floor(t * 2) % 2 ? "#f3d27a" : "#a6b26a");
        } else {
          for (let i = 0; i < 9; i++) rect(x - 36 + ((i * 23) % 70), y - 32 + ((i * 13) % 26), 5, 4, "#9a5a35");
        }
        this.label(o, e, ok ? "#cfe0a8" : "#d9b49a");
        return;
      }
      case "outpostMule": {
        if (op.convoy && !op.convoy.done) {
          if (near(o, e.s.player, 200)) this.text("红薯拉车上路了", x, y - 40, "#d8cfb0", 11);
          return;
        }
        this.shadow(x, y, 30);
        const bob = Math.sin(t * 2) * 1;
        rect(x - 24, y - 34, 44, 20, "#9b7653");
        rect(x - 24, y - 34, 44, 4, "#b58d66");
        for (const lx of [-20, -10, 8, 16]) rect(x + lx, y - 16, 5, 16, "#6e5238");
        rect(x + 16, y - 48 + bob, 16, 18, "#9b7653");
        rect(x + 28, y - 40 + bob, 8, 10, "#b58d66");
        rect(x + 18, y - 56 + bob, 4, 9, "#5a3e28");
        rect(x + 25, y - 56 + bob, 4, 9, "#5a3e28");
        rect(x + 20, y - 44 + bob, 2, 2, "#1f1b18");
        rect(x + 14, y - 30, 7, 7, "#d9b35a");
        rect(x - 30, y - 30, 7, 3, "#6e5238");
        this.label(o, e, "#e8d9a6");
        return;
      }
      case "outpostPrisoner": {
        this.person(this.raiderSheet(), x, y, Math.PI / 2);
        this.headwear(x, y, "yaozi");
        line(x - 14, y - 30, x + 14, y - 22, "#c9b48a", 2);
        line(x - 14, y - 22, x + 14, y - 30, "#c9b48a", 2);
        this.label(o, e, "#e6b09a", true);
        return;
      }
      case "outpostPatients": {
        for (const dx of [-30, 30]) {
          this.shadow(x + dx, y, 22);
          rect(x + dx - 20, y - 18, 40, 14, "#7d6a4e");
          rect(x + dx - 18, y - 22, 36, 8, "#c9c2a8");
          rect(x + dx - 18, y - 26, 10, 8, "#e0b48a");
          rect(x + dx - 8, y - 24, 26, 10, "#7d8fa0");
        }
        const p = op.patients;
        this.label(o, e, "#cfe0a8");
        if (p && near(o, e.s.player, 220)) this.text("吃饱 " + p.fedDays + "/2 天", x, y - 62, "#b8d4b1", 10);
        return;
      }
      case "outpostYouke": {
        this.person(null, x, y, Math.PI);
        this.headwear(x, y, "youke");
        const swing = Math.sin(t * 8) > 0 ? -6 : 2;
        rect(x - 24, y - 38 + swing, 4, 14, "#8a7a5a");
        rect(x - 28, y - 40 + swing, 12, 5, "#b8b2a0");
        crate(x - 52, y + 2, 26, 20);
        this.label(o, e, "#f1d98a", true);
        return;
      }
      case "outpostCache": {
        crate(x - 16, y, 34, 26);
        crate(x + 18, y, 30, 22);
        crate(x, y - 24, 28, 20);
        rect(x + 34, y - 64, 3, 50, "#4b4f55");
        rect(x + 37, y - 64, 20, 12, "#6e7177");
        rect(x + 42, y - 61, 10, 6, "#b8433a");
        this.label(o, e, "#e6b09a", true);
        return;
      }
      case "outpostCai": {
        rect(x - 46, y - 30, 40, 24, "#5b4a33");
        rect(x - 46, y - 30, 40, 4, "#8d754e");
        for (let i = 0; i < 3; i++) rect(x - 44 + i * 12, y - 46, 4, 16, "#3e3a34");
        this.person(null, x, y, Math.PI);
        this.headwear(x, y, "cai");
        this.label(o, e, "#cfe0a8", true);
        return;
      }
      case "outpostEscort": {
        this.shadow(x, y, 40);
        rect(x - 36, y - 26, 72, 20, "#7a5a36");
        for (const wx of [-22, 22]) rect(x + wx - 8, y - 8, 16, 16, "#2f2a22");
        crate(x - 12, y - 26, 24, 16);
        crate(x + 14, y - 26, 20, 14);
        this.label(o, e, op.convoy?.escorted ? "#cfe0a8" : "#f1b4a2", true);
        return;
      }
    }
  }
  drawEnemy(z, e) {
    if (z.type !== "raider") return super.drawEnemy(z, e);
    const c = this.ctx,
      { rect } = pixelPainter(c);
    if (z.aim > 0) {
      c.save();
      c.strokeStyle = "#ff4a3a";
      c.globalAlpha = 0.55 + 0.45 * (1 - z.aim);
      c.lineWidth = 3;
      c.setLineDash([12, 5]);
      c.beginPath();
      c.moveTo(z.x, z.y - 30);
      c.lineTo(z.aimX, z.aimY);
      c.stroke();
      c.setLineDash([]);
      c.beginPath();
      c.arc(z.aimX, z.aimY, 10 + 10 * z.aim, 0, Math.PI * 2);
      c.stroke();
      c.restore();
      this.text("瞄准", z.x, z.y - 96, "#ff8a7a", 12);
    }
    this.person(this.raiderSheet(), z.x, z.y, z.facing || Math.PI, !z.aim, z.flash ? 0.55 : 1);
    rect(z.x - 12, z.y - 61, 24, 6, "#3a3d42");
    rect(z.x - 13, z.y - 56, 26, 3, "#b8433a");
    const a = z.facing || Math.PI;
    rect(z.x + Math.cos(a) * 16 - 3, z.y - 30 + Math.sin(a) * 8, 14, 4, "#26272a");
    if (z.cover) this.text("掩体", z.x, z.y - 82, "#cfc6a8", 10);
    if (z.retreat) this.text("撤退", z.x, z.y - 82, "#e6c48a", 11);
    const w = 42;
    rect(z.x - w / 2, z.y - 70, w, 4, "#122b23");
    rect(z.x - w / 2, z.y - 70, (w * Math.max(0, z.hp)) / z.maxHp, 4, z.hp < z.maxHp * 0.35 ? "#e6c48a" : "#d9826f");
  }
  draw(e, mouse, dt = 0.016) {
    super.draw(e, mouse, dt);
    if (!e.o) return;
    const c = this.ctx;
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.scale(this.camera.scale, this.camera.scale);
    c.translate(-this.camera.x, -this.camera.y);
    for (const b of e.raidShots || []) {
      c.strokeStyle = "#ffb38a";
      c.lineWidth = 3;
      c.beginPath();
      c.moveTo(b.x, b.y);
      c.lineTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      c.stroke();
    }
    if (e.s.region === "farm") {
      this.drawStationBubbles(e);
      if (this.defense) this.drawDefense(e);
    }
    c.restore();
    if (this.defense && e.s.region === "farm") {
      c.save();
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.badge("防线视图 · 绿圈=有人驻守的射程 · 红框=薄弱围栏 · Z 关闭", this.w / 2, 70, "#f2d48a");
      if (!e.s.buildings.some((b) => b.type === "tower" && b.hp > 0))
        this.badge("还没有瞭望塔：建造（B）一座，再让居民守塔", this.w / 2, 98, "#f1b4a2");
      c.restore();
    }
  }
  drawStationBubbles(e) {
    const { rect } = pixelPainter(this.ctx),
      seen = new Set();
    for (const b of e.s.buildings) {
      if (b.hp <= 0 || seen.has(b.type)) continue;
      const jobs = e.c.production.filter((j) => j.station === b.type);
      if (!jobs.length) continue;
      seen.add(b.type);
      const inc = e.o.incidents.find((i) => jobs.some((j) => j.id === i.job)),
        ready = jobs.filter((j) => j.ready).length,
        running = jobs.find((j) => !j.ready),
        x = b.x,
        y = b.y - 84 + Math.sin(this.time * 2.5) * 2;
      if (inc) {
        const left = Math.max(0, Math.ceil(inc.deadline - e.abs()));
        rect(x - 34, y - 13, 68, 24, Math.floor(this.time * 4) % 2 ? "#b8433a" : "#8f2f28");
        this.text((inc.type === "fire" ? "起火 " : "卡料 ") + left + "分", x, y - 1, "#fff0d8", 12);
        if (inc.type === "fire") for (let k = 0; k < 4; k++) rect(x - 20 + k * 12, b.y - 50 - ((this.time * 40 + k * 9) % 18), 6, 8, k % 2 ? "#f3a24a" : "#f3d27a");
      } else if (ready) {
        rect(x - 30, y - 12, 60, 22, "#2f5a3a");
        this.text("✓ 成品" + ready, x, y - 1, "#d9f0b0", 12);
      } else if (running) {
        rect(x - 30, y - 12, 60, 22, "#1f3029cc");
        const total = Math.max(1, RECIPES.find((r) => r.id === running.recipe)?.minutes || 60);
        rect(x - 24, y + 4, 48, 3, "#3a4a40");
        rect(x - 24, y + 4, 48 * Math.max(0.08, Math.min(1, 1 - running.remaining / total)), 3, "#e2c97a");
        this.text(Math.ceil(running.remaining) + "分", x, y - 3, "#e8d9a6", 11);
      }
    }
  }
  drawDefense(e) {
    const c = this.ctx;
    const guards = e.c.residents.filter((r) => r.priorities?.guard > 0 || r.role === "guard").length;
    e.s.buildings
      .filter((b) => b.type === "tower" && b.hp > 0)
      .forEach((b, i) => {
        c.save();
        c.strokeStyle = i < guards ? "#9fd38a" : "#9a9a8a";
        c.fillStyle = i < guards ? "#9fd38a14" : "#9a9a8a0c";
        c.setLineDash(i < guards ? [] : [6, 6]);
        c.lineWidth = 2;
        c.beginPath();
        c.arc(b.x, b.y, 320, 0, Math.PI * 2);
        c.fill();
        c.stroke();
        c.restore();
        this.text(i < guards ? "有人驻守" : "无人驻守", b.x, b.y - 92, i < guards ? "#cfe8b0" : "#c9c2a8", 11);
      });
    for (const g of e.o.crew.filter((x) => x.role === "guard")) {
      c.save();
      c.strokeStyle = "#8ac0e0";
      c.lineWidth = 1.5;
      c.beginPath();
      c.arc(g.x, g.y, 280, 0, Math.PI * 2);
      c.stroke();
      c.restore();
    }
    for (const b of e.s.buildings.filter((b) => ["fence", "gate"].includes(b.type))) {
      const max = BUILDINGS[b.type].hp;
      if (b.hp >= max * 0.5) continue;
      const d = BUILDINGS[b.type],
        w = b.rotation % 2 ? d.h : d.w,
        h = b.rotation % 2 ? d.w : d.h;
      c.save();
      c.strokeStyle = "#ff6a5a";
      c.lineWidth = 2;
      c.strokeRect(b.x - w / 2 - 3, b.y - h / 2 - 3, w + 6, h + 6);
      c.restore();
      this.text(b.hp <= 0 ? "缺口" : "薄弱", b.x, b.y - h / 2 - 12, "#ff9a8a", 11);
    }
    const raid = ["scheduled", "warning", "active"].includes(e.o.raid.phase);
    const horde = ["warning", "active"].includes(e.s.horde.phase) || (e.s.stats.hordes > 0 && e.c.nextHordeDay);
    const arrow = (dir, color, label) => {
      const [sx, sy] = dir.spawns[0];
      const tx = 830,
        ty = 480,
        a = Math.atan2(ty - sy, tx - sx),
        ex = sx + Math.cos(a) * 180,
        ey = sy + Math.sin(a) * 180;
      c.save();
      c.strokeStyle = color;
      c.fillStyle = color;
      c.lineWidth = 5;
      c.globalAlpha = 0.6 + 0.3 * Math.sin(this.time * 4);
      c.beginPath();
      c.moveTo(sx, sy);
      c.lineTo(ex, ey);
      c.stroke();
      c.beginPath();
      c.moveTo(ex + Math.cos(a) * 16, ey + Math.sin(a) * 16);
      c.lineTo(ex + Math.cos(a + 2.5) * 16, ey + Math.sin(a + 2.5) * 16);
      c.lineTo(ex + Math.cos(a - 2.5) * 16, ey + Math.sin(a - 2.5) * 16);
      c.fill();
      c.restore();
      this.badge(label, sx - 70, sy - 26, color);
    };
    if (raid) arrow(HORDE_DIRECTIONS[0], "#ff8a6a", "灰隼团 · 东侧");
    if (horde) {
      const intel = e.hordeIntel?.();
      if (intel?.direction?.spawns) arrow(intel.direction, "#e6d27a", "尸潮 · " + intel.direction.name);
    }
  }
}
