// v0.17.0「远方来客」的场景表现：夜里的抉择、今日险地（浓雾、尸群迁徙、物资漂来）、彭姐与雨巷营地、
// 贺满仓的账桌、麦穗吠叫、援建队员干活的动作，以及去目标的金色虚线路径和屏幕边缘箭头。
import { Renderer as SeasonsRenderer } from "./seasons-renderer.js";
import { pixelPainter } from "./beyond-art.js";
import { FAR_OBJECTS } from "./farlands.js";

const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r;

export class Renderer extends SeasonsRenderer {
  drawObject(o, e) {
    if (FAR_OBJECTS.includes(o.type)) return this.drawFarObject(o, e);
    return super.drawObject(o, e);
  }
  drawFarObject(o, e) {
    const p = pixelPainter(this.ctx),
      { rect, crate, line } = p,
      x = o.x,
      y = o.y,
      t = this.time,
      f = e.fr;
    if (o.type === "farNight") {
      const kind = f.night?.kind;
      if (kind === "ruin") {
        // 还亮着油灯的屋角：桌子、口粮和布料
        rect(x - 46, y - 6, 92, 8, "#2f2a24");
        rect(x - 40, y - 24, 80, 18, "#6d5a3e");
        rect(x - 40, y - 24, 80, 3, "#9a8058");
        rect(x - 30, y - 34, 14, 10, "#c9b48a");
        rect(x - 12, y - 32, 18, 8, "#8aa3b5");
        rect(x + 12, y - 36, 8, 12, "#5a4a3a");
        const glow = 0.5 + Math.sin(t * 3) * 0.12;
        this.ctx.fillStyle = `rgba(243,210,122,${glow * 0.35})`;
        this.ctx.beginPath();
        this.ctx.arc(x + 16, y - 40, 34, 0, Math.PI * 2);
        this.ctx.fill();
        rect(x + 13, y - 46, 6, 8, "#f3d27a");
      } else if (kind === "stranger") {
        // 靠墙坐着的伤者
        rect(x - 30, y - 64, 60, 60, "#3a3530");
        rect(x - 14, y - 30, 28, 22, "#5a6a5a");
        rect(x - 10, y - 46, 20, 18, "#d8b48a");
        rect(x - 10, y - 50, 20, 6, "#3a2a20");
        rect(x - 4, y - 38, 2, 2, "#1f1b18");
        rect(x + 3, y - 38, 2, 2, "#1f1b18");
        rect(x - 22, y - 10, 30, 8, "#4a4a3a");
        rect(x - 18, y - 11, 10, 9, "#8a3a2a");
        if (Math.floor(t * 1.5) % 2) this.text("……", x + 22, y - 54, "#c9c2a8", 11);
      } else {
        // 刻着“雨巷”的木箱
        crate(x, y, 46, 32);
        rect(x - 8, y - 22, 16, 10, "#6a4a2a");
        rect(x - 3, y - 18, 6, 6, "#9a8a6a");
        this.text("雨巷", x, y - 40, "#d6c79a", 10);
      }
      this.label(o, e, "#f3d27a", true);
      return;
    }
    if (o.type === "farHazard") {
      const kind = e.hazardToday()?.kind;
      crate(x, y, 40, 30);
      rect(x - 22, y - 34, 44, 4, kind === "migration" ? "#d06a58" : kind === "ashore" ? "#7fb0c8" : "#c9c2a8");
      if (kind === "ashore") for (let k = 0; k < 3; k++) rect(x - 40 + k * 30, y + 6 + Math.sin(t * 2 + k) * 2, 22, 3, "#9fd3e0aa");
      if (kind === "migration" && e.hazardFoes()) this.text("还剩 " + e.hazardFoes() + " 只", x, y - 58, "#ffb3a6", 11);
      this.label(o, e, "#f0a35a", true);
      return;
    }
    if (o.type === "farPeng") {
      if (f.peng.phase === "attacked") this.child(x, y, "peng");
      else {
        this.personSimple(x, y, "peng", Math.PI);
        rect(x + 16, y - 30, 12, 16, "#7a6a4a");
        this.personSimple(x + 40, y + 10, 3, Math.PI);
      }
      this.label(o, e, f.peng.phase === "attacked" ? "#ffb3a6" : "#e9c05a", true);
      return;
    }
    if (o.type === "farPengCamp") {
      // 两顶帐篷、一道拒马和营火
      for (const dx of [-60, 30]) {
        rect(x + dx - 30, y - 6, 60, 6, "#2f2a24");
        for (let k = 0; k < 6; k++) rect(x + dx - 26 + k * 4, y - 34 + k * 5, 52 - k * 8, 5, k % 2 ? "#7a6a4a" : "#8a7a5a");
      }
      for (let k = 0; k < 5; k++) line(x - 90 + k * 40, y + 40, x - 70 + k * 40, y + 20, "#6a5a3a", 4);
      const attacked = f.peng.phase === "attacked";
      for (let k = 0; k < 4; k++) rect(x - 4 + k * 3, y + 10 - ((t * 22 + k * 8) % 26), 3, 3, attacked ? "#d06a58" : "#f3a24a");
      if (attacked) for (let k = 0; k < 3; k++) rect(x - 20 + k * 14, y - 70 - ((t * 10 + k * 14) % 40), 10, 10, "#5a5a5a66");
      if (f.peng.phase !== "attacked") this.personSimple(x + 70, y + 10, "peng", Math.PI);
      this.label(o, e, attacked ? "#ffb3a6" : "#e9c05a", true);
      return;
    }
    if (o.type === "farHemc") {
      rect(x - 34, y - 6, 68, 6, "#2f2a24");
      rect(x - 30, y - 26, 60, 20, "#5a4a3a");
      rect(x - 30, y - 26, 60, 3, "#8a7350");
      rect(x - 20, y - 32, 18, 6, "#e8e4dc");
      rect(x + 2, y - 32, 14, 6, "#d6bf87");
      this.personSimple(x, y - 30, "hemc", Math.PI / 2);
      if (e.fr.hemc.debt) this.text("账：" + Object.keys(e.installment() || {}).length + " 项待还", x, y - 96, "#d6bf87", 10);
      this.label(o, e, "#d6bf87");
      return;
    }
  }
  // 援建队员干活时的动作
  drawCrew(o, e) {
    super.drawCrew(o, e);
    const c = (e.o?.crew || []).find((x) => x.id === o.helper);
    if (!c) return;
    const moving = c.target && Math.hypot(c.x - c.target.x, c.y - c.target.y) > 8;
    if (moving) return;
    const { rect, line } = pixelPainter(this.ctx),
      t = this.time,
      x = o.x,
      y = o.y;
    if (c.task === "build") {
      const a = -0.9 + Math.abs(Math.sin(t * 5)) * 1.3;
      line(x + 10, y - 34, x + 10 + Math.cos(a) * 16, y - 34 + Math.sin(a) * 16, "#7a5a36", 3);
      rect(x + 7 + Math.cos(a) * 16, y - 37 + Math.sin(a) * 16, 8, 6, "#b8b2a0");
    } else if (c.task === "guard") {
      const sway = Math.sin(t * 1.2) * 3;
      line(x - 4, y - 30, x + 22 + sway, y - 40, "#3e3a34", 3);
    } else if (c.task === "meal") {
      rect(x - 8, y - 30, 16, 6, "#e8e4dc");
      rect(x - 6, y - 32, 12, 3, "#c9a55a");
      for (let k = 0; k < 2; k++) rect(x - 3 + k * 5, y - 40 - ((t * 12 + k * 7) % 12), 2, 4, "#e8e4dc99");
    } else if (c.task === "rest") {
      const k = (t * 0.8) % 1;
      this.text("z", x + 12 + k * 8, y - 70 - k * 14, `rgba(207,224,232,${1 - k})`, 10 + k * 4);
    } else if (c.task === "hungry") {
      const dx = Math.sin(t * 30) * 1.2;
      rect(x - 12 + dx, y - 74, 24, 3, "#e6b48366");
      if (Math.floor(t * 2) % 2) this.text("…", x + 14, y - 72, "#e6b483", 12);
    } else if (c.task === "carry") {
      rect(x - 8, y - 33, 16, 10, "#8d754e");
    }
    if (e.playerCold?.() && e.s.region === "farm" && e.w?.winter.phase === "cold") rect(x - 12 + Math.sin(t * 40), y - 64, 3, 3, "#cfe8f6");
  }
  draw(e, mouse, dt = 0.016) {
    super.draw(e, mouse, dt);
    if (!e.fr) return;
    const c = this.ctx,
      calm = !!e.s.settings?.access?.calm;
    // 麦穗吠叫
    // 读档或换引擎后的第一帧只记下当前值，不叫。
    if (this._barkEngine !== e) {
      this._barkEngine = e;
      this._bark = e.fr.dog.barkKey;
    }
    if (e.fr.dog.barkKey && this._bark !== e.fr.dog.barkKey) {
      this._bark = e.fr.dog.barkKey;
      this._barkT = 2.4;
    }
    this._barkT = Math.max(0, (this._barkT || 0) - dt);
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.scale(this.camera.scale, this.camera.scale);
    c.translate(-this.camera.x, -this.camera.y);
    if (this._barkT > 0 && e.dogReady() && e.s.region !== "market") {
      const d = e.f.dog;
      this.badge("汪！汪！", d.x, d.y - 48 - (calm ? 0 : Math.sin(this.time * 12) * 3), "#ffd59a");
    }
    // 去目标的路
    const goal = this.rebuildTarget;
    if (goal && goal.region === e.s.region && !e.paused && !near(goal, e.s.player, 70)) this.drawGoalPath(e, goal, calm);
    c.restore();
    // 浓雾：只有今日险地是浓雾、并且人在那片废墟时
    const h = e.hazardToday?.();
    if (h && h.kind === "fog" && e.s.region === h.region) this.drawFog(e);
    // 目标在屏幕外：边缘箭头
    if (goal && goal.region === e.s.region && !e.paused) this.drawEdgeArrow(e, goal);
  }
  drawGoalPath(e, goal, calm) {
    const c = this.ctx,
      key = Math.round(goal.x / 24) + "," + Math.round(goal.y / 24) + "," + e.s.region + "," + Math.round(e.s.player.x / 48) + "," + Math.round(e.s.player.y / 48) + "," + e.navRevision;
    if (this._pathKey !== key) {
      this._pathKey = key;
      try {
        this._path = e.pathTo({ x: e.s.player.x, y: e.s.player.y }, { x: goal.x, y: goal.y }) || [];
      } catch {
        this._path = [];
      }
    }
    const pts = [{ x: e.s.player.x, y: e.s.player.y }, ...(this._path || [])];
    if (pts.length < 2) pts.push({ x: goal.x, y: goal.y });
    const end = pts[pts.length - 1];
    if (Math.hypot(end.x - goal.x, end.y - goal.y) > 30) pts.push({ x: goal.x, y: goal.y });
    for (const [color, width, dash] of [
      ["#1a1408aa", 6, []],
      ["#f3d27a", 3, [10, 8]],
    ]) {
      c.strokeStyle = color;
      c.lineWidth = width;
      c.setLineDash(dash);
      c.lineDashOffset = calm ? 0 : -this.time * 24;
      c.beginPath();
      c.moveTo(pts[0].x, pts[0].y - 6);
      for (const q of pts.slice(1)) c.lineTo(q.x, q.y - 6);
      c.stroke();
    }
    c.setLineDash([]);
    c.lineDashOffset = 0;
  }
  drawFog(e) {
    const c = this.ctx,
      p = this.screenPoint(e.s.player.x, e.s.player.y - 20);
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const r = Math.min(this.w, this.h) * 0.24,
      g = c.createRadialGradient(p.x, p.y, r * 0.55, p.x, p.y, r * 2.2),
      // v0.41：夜里跟着月光偏一点蓝（亮度不变）
      a = (this.fogTint?.([200, 205, 198]) || [200, 205, 198]).join(","),
      b = (this.fogTint?.([190, 196, 190]) || [190, 196, 190]).join(",");
    g.addColorStop(0, `rgba(${a},0)`);
    g.addColorStop(0.45, `rgba(${a},0.55)`);
    g.addColorStop(1, `rgba(${b},0.86)`);
    c.fillStyle = g;
    c.fillRect(0, 0, this.w, this.h);
    this.badge("浓雾 · 开箱会惊动附近的感染者", this.w / 2, 70, "#e6e5c7");
    c.restore();
  }
  drawEdgeArrow(e, goal) {
    const s = this.screenPoint(goal.x, goal.y);
    if (s.x >= 30 && s.x <= this.w - 30 && s.y >= 60 && s.y <= this.h - 30) return;
    const c = this.ctx,
      cx = this.w / 2,
      cy = this.h / 2,
      a = Math.atan2(s.y - cy, s.x - cx),
      k = Math.min(Math.abs((this.w / 2 - 34) / (Math.cos(a) || 1e-6)), Math.abs((this.h / 2 - 46) / (Math.sin(a) || 1e-6))),
      x = cx + Math.cos(a) * k,
      y = cy + Math.sin(a) * k;
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.translate(x, y);
    c.rotate(a);
    c.fillStyle = "#1a1408cc";
    c.beginPath();
    c.moveTo(16, 0);
    c.lineTo(-10, -12);
    c.lineTo(-10, 12);
    c.closePath();
    c.fill();
    c.fillStyle = "#f3d27a";
    c.beginPath();
    c.moveTo(12, 0);
    c.lineTo(-7, -9);
    c.lineTo(-7, 9);
    c.closePath();
    c.fill();
    c.restore();
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const steps = Math.round(Math.hypot(e.s.player.x - goal.x, e.s.player.y - goal.y));
    this.badge(steps + "步", x - Math.cos(a) * 34, y - Math.sin(a) * 26, "#f3d27a");
    c.restore();
  }
}
