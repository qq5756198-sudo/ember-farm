// v0.15.0「寒潮之后」的场景表现：火炉、暖区、雪与霜、流星、阿兰与羊、葛队长一行、档案馆、阿默、证据台，
// 建造时的作用范围圈，以及人物头顶的需求气泡。
import { Renderer as OutpostRenderer } from "./outpost-renderer.js";
import { pixelPainter } from "./beyond-art.js";
import { BUILDINGS } from "./data.js";
import { HEAT } from "./winter-data.js";
import { WINTER_OBJECTS } from "./winter.js";

const near = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r;
// 建造预览里显示的作用范围。
export const BUILD_RANGES = {
  rain: { r: 220, label: "浇灌 220", color: "#89c6d0" },
  irrigation: { r: 300, label: "灌溉 300", color: "#89c6d0" },
  tower: { r: 320, label: "射程 320", color: "#9fd38a" },
  greenhouse: { r: 200, label: "保护作物 220 · 暖区 200", color: "#cfe0a8" },
  stove: { r: HEAT.stove, label: "暖区 220", color: "#f3a24a" },
  repairpost: { r: 200, label: "维修 200", color: "#d6c79a" },
  drone: { r: 300, label: "收获 300", color: "#cfe0a8" },
};

export class Renderer extends OutpostRenderer {
  drawObject(o, e) {
    if (WINTER_OBJECTS.includes(o.type)) return this.drawWinterObject(o, e);
    return super.drawObject(o, e);
  }
  drawBuilding(b, e) {
    if (b.type !== "stove") return super.drawBuilding(b, e);
    const { rect } = pixelPainter(this.ctx),
      x = b.x,
      y = b.y,
      wi = e.w?.winter,
      lit = !wi || !["prep", "cold"].includes(wi.phase) || wi.lit,
      t = this.time;
    this.shadow(x, y, 24);
    rect(x - 20, y - 34, 40, 34, b.hp > 0 ? "#6a4b3a" : "#4a3a30");
    rect(x - 20, y - 34, 40, 4, "#8f6a52");
    rect(x - 12, y - 20, 24, 16, "#2a1f1a");
    if (lit && b.hp > 0)
      for (let k = 0; k < 4; k++) rect(x - 9 + k * 5, y - 9 - Math.abs(Math.sin(t * 6 + k)) * 8, 4, 8, k % 2 ? "#f3a24a" : "#f3d27a");
    rect(x + 6, y - 58, 8, 24, "#5a4a3a");
    if (lit && b.hp > 0) for (let k = 0; k < 3; k++) rect(x + 8 + Math.sin(t + k) * 4, y - 66 - ((t * 18 + k * 12) % 34), 5, 5, "#cfd2c8aa");
    if (near(b, e.s.player, 200)) this.text(BUILDINGS.stove.name + (lit ? "" : " · 熄火"), x, y - 74, lit ? "#f3d27a" : "#c9c2a8", 12);
    if (b.hp < BUILDINGS.stove.hp && b.hp > 0) this.text(Math.ceil(b.hp) + "/" + BUILDINGS.stove.hp, x, y + 12, "#e6b483", 11);
  }
  personSimple(x, y, look, facing = Math.PI / 2) {
    this.person(this.helperSheet?.() || null, x, y, facing);
    this.headwear(x, y, look);
  }
  drawWinterObject(o, e) {
    const p = pixelPainter(this.ctx),
      { rect, crate } = p,
      x = o.x,
      y = o.y,
      t = this.time,
      w = e.w;
    if (o.type === "winterAlan") {
      this.personSimple(x, y, "alan", Math.PI);
      for (let i = 0; i < 3; i++) this.drawSheep(x + 40 + i * 26, y + 18 + (i % 2) * 14, t + i);
      this.label(o, e, "#e8d9a6", w.alan.phase === "here");
      return;
    }
    if (o.type === "winterSheep") {
      rect(x - 40, y - 4, 80, 3, "#7a5a36");
      rect(x - 40, y - 22, 3, 22, "#7a5a36");
      rect(x + 37, y - 22, 3, 22, "#7a5a36");
      for (let i = 0; i < (w.alan.sheep || 0); i++) this.drawSheep(x - 16 + i * 30, y - 6, t + i);
      this.label(o, e);
      return;
    }
    if (o.type === "winterGe") {
      rect(x - 8, y - 6, 16, 6, "#5b4a33");
      for (let k = 0; k < 3; k++) rect(x - 5 + k * 4, y - 12 - Math.abs(Math.sin(t * 5 + k)) * 6, 3, 6, "#f3a24a");
      const pos = [
        [-40, -6],
        [36, -10],
        [0, 30],
      ];
      pos.forEach(([dx, dy], i) => this.personSimple(x + dx, y + dy, i ? 1 + i : "ge", Math.atan2(-dy, -dx)));
      this.label(o, e, w.ge.phase === "warned" ? "#ffb3a6" : "#e8d9a6", w.ge.phase === "warned");
      return;
    }
    if (o.type === "winterMuseum") {
      if (!w.museum.built) {
        rect(x - 46, y - 6, 92, 4, "#c9b48a");
        for (const dx of [-46, 42]) rect(x + dx, y - 30, 4, 28, "#8a6a42");
        crate(x, y, 30, 22);
        this.label(o, e, "#f1d98a", true);
        return;
      }
      this.shadow(x, y + 4, 60);
      rect(x - 56, y - 64, 112, 64, "#7a6a4f");
      rect(x - 60, y - 74, 120, 12, "#5b4a33");
      rect(x - 56, y - 64, 112, 4, "#a8936a");
      for (const dx of [-40, -14, 12, 38]) rect(x + dx - 4, y - 56, 8, 52, "#d6bf87");
      rect(x - 12, y - 30, 24, 30, "#3d2f22");
      rect(x - 30, y - 86, 60, 12, "#2f3a33");
      this.text("档案馆", x, y - 80, "#f1d98a", 11);
      this.label(o, e, "#f1d98a");
      return;
    }
    if (o.type === "winterAmo") {
      const night = e.amoOpen();
      rect(x - 30, y - 50, 60, 50, "#3a3e3a");
      rect(x - 22, y - 42, 44, 36, night ? "#5f7a6a" : "#2a2e2a");
      if (night) {
        this.person(null, x, y + 20, Math.PI);
        this.headwear(x, y + 20, "amo");
        rect(x + 22, y - 20, 10, 14, "#9fd3b0");
      }
      this.label(o, e, night ? "#cfe0a8" : "#9aa38a", night);
      return;
    }
    if (o.type === "winterEvidence" || o.type === "winterHall") {
      rect(x - 40, y - 26, 80, 22, "#5b4a33");
      rect(x - 40, y - 26, 80, 4, "#8d754e");
      for (let k = 0; k < 3; k++) rect(x - 32 + k * 24, y - 40, 16, 12, ["#d6c79a", "#9fd3e0", "#e6b09a"][k]);
      this.label(o, e, "#f1d98a", true);
    }
  }
  drawSheep(x, y, t) {
    const { rect } = pixelPainter(this.ctx),
      bob = Math.sin(t * 2) * 1;
    this.shadow(x, y + 2, 12);
    rect(x - 11, y - 14 + bob, 22, 13, "#ece6d6");
    rect(x - 9, y - 16 + bob, 18, 4, "#f6f2e8");
    rect(x + 9, y - 13 + bob, 7, 7, "#3a3530");
    for (const dx of [-8, -2, 4, 8]) rect(x + dx, y - 2, 2, 5, "#3a3530");
  }
  draw(e, mouse, dt = 0.016) {
    super.draw(e, mouse, dt);
    if (!e.w) return;
    const c = this.ctx,
      wi = e.w.winter;
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.scale(this.camera.scale, this.camera.scale);
    c.translate(-this.camera.x, -this.camera.y);
    if (e.s.region === "farm") {
      if (wi.phase === "cold" || (this.defense && wi.phase !== "none")) this.drawWarmZones(e);
      if (e.buildMode) this.drawBuildRange(e, mouse);
      this.drawNeeds(e);
    }
    c.restore();
    const cold = wi.phase === "cold";
    if (cold || e.meteorTonight?.()) {
      c.save();
      c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      if (cold) {
        // 冷色调 + 四角结霜 + 飘雪
        c.fillStyle = "rgba(196,222,240,0.2)";
        c.fillRect(0, 0, this.w, this.h);
        const g = c.createRadialGradient(this.w / 2, this.h / 2, Math.min(this.w, this.h) * 0.35, this.w / 2, this.h / 2, Math.max(this.w, this.h) * 0.75);
        g.addColorStop(0, "rgba(230,242,250,0)");
        g.addColorStop(1, "rgba(230,242,250,0.42)");
        c.fillStyle = g;
        c.fillRect(0, 0, this.w, this.h);
        c.fillStyle = "#f6fafc";
        const flakes = Math.round(Math.min(220, (this.w * this.h) / 6000));
        for (let i = 0; i < flakes; i++) {
          const sx = (i * 137 + Math.sin(this.time + i) * 14 + this.time * (14 + (i % 5) * 6)) % this.w,
            sy = (i * 71 + this.time * (36 + (i % 7) * 9)) % this.h,
            size = 2 + (i % 3);
          c.fillRect(sx, sy, size, size);
        }
      }
      if (e.meteorTonight?.()) {
        c.strokeStyle = "#fff6d0";
        c.lineWidth = 2;
        for (let i = 0; i < 3; i++) {
          const k = (this.time * 0.6 + i * 0.33) % 1,
            sx = this.w * (0.2 + 0.3 * i) + k * 160,
            sy = 40 + k * 90;
          c.globalAlpha = 1 - k;
          c.beginPath();
          c.moveTo(sx, sy);
          c.lineTo(sx - 40, sy - 22);
          c.stroke();
        }
        c.globalAlpha = 1;
      }
      c.restore();
    }
  }
  drawWarmZones(e) {
    const c = this.ctx,
      names = { stove: "火炉暖区", cook: "灶台暖区", greenhouse: "温室暖区", home: "农舍", camp: "营地火盆", room: "房间暖区" };
    for (const h of e.heatSources()) {
      const strong = !["home", "camp"].includes(h.kind);
      c.save();
      c.fillStyle = strong ? "#f3a24a26" : "#f3a24a14";
      c.strokeStyle = strong ? "#f6b45ad9" : "#f6b45a80";
      c.lineWidth = strong ? 3 : 2;
      c.setLineDash([12, 9]);
      c.lineDashOffset = -this.time * 12;
      c.beginPath();
      c.arc(h.x, h.y, h.r, 0, Math.PI * 2);
      c.fill();
      c.stroke();
      c.restore();
      if (strong) this.text(names[h.kind], h.x, h.y - h.r + 16, "#ffd9a0", 12);
    }
  }
  drawBuildRange(e, mouse) {
    const r = BUILD_RANGES[e.buildMode];
    if (!mouse) return;
    const c = this.ctx,
      pt = this.worldPoint(mouse.x, mouse.y),
      x = Math.round(pt.x / 8) * 8,
      y = Math.round(pt.y / 8) * 8;
    const bonus = e.adjacencyPreview?.(e.buildMode, x, y);
    if (bonus?.length) bonus.forEach((b, i) => this.badge(b, x, y + 52 + i * 24, b.startsWith("＋") ? "#f3d27a" : "#c8c2a6"));
    if (!r) return;
    c.save();
    c.strokeStyle = r.color;
    c.fillStyle = r.color + "18";
    c.lineWidth = 2;
    c.setLineDash([8, 6]);
    c.beginPath();
    c.arc(x, y, r.r, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    c.restore();
    this.badge(r.label, x, y - 74, r.color);
  }
  drawNeeds(e) {
    const people = [];
    for (const r of e.c.residents)
      if (r.x != null) {
        const need = !r.fed && e.s.minute >= 360 ? "饿" : (r.fatigue || 0) >= 70 ? "困" : (r.morale ?? 60) >= 80 ? "♪" : (r.morale ?? 60) <= 30 ? "愁" : null;
        people.push({ x: r.x, y: r.y, need, seed: r.id.length });
      }
    for (const h of e.sc?.helpers || []) people.push({ x: h.x, y: h.y, need: h.fedDay !== e.s.day && e.s.minute >= 360 ? "饿" : h.task === "hungry" ? "累" : null, seed: 3 });
    for (const c of e.o?.crew || [])
      people.push({
        x: c.x,
        y: c.y,
        need: c.fedDay !== e.s.day && e.s.minute >= 360 && c.task !== "rest" ? "饿" : /冻/.test(c.status) ? "冷" : c.task === "hungry" ? "累" : e.talkReady?.(c.id) ? "…" : null,
        seed: c.id.length + 5,
      });
    for (const p of people) {
      if (!p.need) continue;
      const phase = (this.time + p.seed * 1.7) % 7;
      if (phase > 2.6) continue;
      const { rect } = pixelPainter(this.ctx),
        bx = p.x + 16,
        by = p.y - 98;
      rect(bx - 11, by - 11, 22, 20, "#f6f2e8");
      rect(bx - 4, by + 9, 6, 4, "#f6f2e8");
      this.text(p.need, bx, by, p.need === "♪" ? "#4f7a3a" : "#7a2f26", 12);
    }
  }
}
