// v0.20.0「一亩田」的场景表现：一眼看懂的田（缺水的水滴、杂草、菜青虫、乌鸦爪印、盖着的布、肥力色条），
// 走近一块田时头上的长势圈和照料分，熟了的作物轻轻摇，稻草人。
import { Renderer as ThiefRenderer } from "./thief-renderer.js";
import { CROPS } from "./data.js";
import { pixelPainter } from "./beyond-art.js";

export class Renderer extends ThiefRenderer {
  drawFarm(e) {
    super.drawFarm(e);
    if (e.g && e.s.region === "farm") this.drawGarden(e);
  }
  drawLivingCrop(plot, e) {
    const ripe = plot?.crop && CROPS[plot.crop] && plot.growth >= CROPS[plot.crop].grow;
    if (!e?.g || !ripe || e.s.settings?.access?.calm) return super.drawLivingCrop(plot, e);
    const c = this.ctx,
      a = Math.sin(this.time * 3 + plot.id * 1.7) * 0.07;
    c.save();
    c.translate(plot.x, plot.y + 16);
    c.rotate(a);
    c.translate(-plot.x, -(plot.y + 16));
    try {
      return super.drawLivingCrop(plot, e);
    } finally {
      c.restore();
    }
  }
  drawGarden(e) {
    const c = this.ctx,
      { rect } = pixelPainter(c),
      day = e.s.day,
      calm = !!e.s.settings?.access?.calm,
      color = !!e.s.settings?.access?.color;
    for (const p of e.s.plots) {
      if (!p.tilled) continue;
      const rec = e.g.plots[p.id],
        f = p.fertility ?? 65;
      // 肥力色条：肥的绿、贫的锈红
      if (f >= 85) rect(p.x - 16, p.y + 15, 32, 3, color ? "#4aa3ff" : "#86b85c");
      else if (f < 30) rect(p.x - 16, p.y + 15, 32, 3, color ? "#f0a040" : "#c9784e");
      if (rec?.cv >= day) {
        c.fillStyle = "#efe6cdb0";
        c.fillRect(p.x - 17, p.y - 17, 34, 34);
        c.strokeStyle = "#b9a978";
        c.strokeRect(p.x - 17, p.y - 17, 34, 34);
        rect(p.x - 14, p.y - 1, 28, 1, "#b9a978");
      }
      if (rec?.w) {
        // 三丛杂草
        for (const [dx, dy] of [[-12, 10], [11, 9], [-2, -12]]) {
          rect(p.x + dx, p.y + dy - 6, 2, 7, "#5f8f3a");
          rect(p.x + dx - 3, p.y + dy - 4, 2, 5, "#6fa043");
          rect(p.x + dx + 3, p.y + dy - 5, 2, 6, "#4d7a2e");
        }
      }
      if (!p.crop) continue;
      for (let i = 0; i < (rec?.b || 0); i++) {
        // 菜青虫
        const wig = calm ? 0 : Math.round(Math.sin(this.time * 6 + i * 2 + p.id) * 1.5),
          x = p.x - 9 + i * 8 + wig,
          y = p.y - 4 + (i % 2) * 6;
        rect(x - 1, y - 1, 8, 5, "#2f3a1c");
        rect(x, y, 6, 3, "#e2f07a");
        rect(x + 5, y - 1, 2, 2, "#2f3a1c");
        rect(x + 1, y + 3, 1, 1, "#2f3a1c");
        rect(x + 4, y + 3, 1, 1, "#2f3a1c");
      }
      for (let i = 0; i < (rec?.pk || 0); i++) {
        // 乌鸦的爪印
        const x = p.x + 6 - i * 8,
          y = p.y + 10;
        rect(x, y, 1, 4, "#2a2622");
        rect(x - 2, y - 2, 1, 3, "#2a2622");
        rect(x + 2, y - 2, 1, 3, "#2a2622");
      }
    }
  }
  // 画在人物头顶：按 E 会动到的那块田的长势圈和照料分
  draw(engine, mouse, dt) {
    super.draw(engine, mouse, dt);
    if (engine?.g && engine.s.region === "farm" && !engine.paused) this.drawPlotHint(engine);
  }
  drawPlotHint(e) {
    const o = e.nearestObject?.(),
      p = o?.type === "plot" ? o.plot : null;
    if (!p?.crop || !CROPS[p.crop] || !this.camera) return;
    const c = this.ctx,
      frac = Math.min(1, p.growth / CROPS[p.crop].grow),
      score = e.careScore(p),
      pl = e.s.player,
      x = pl.x - 26,
      y = pl.y - 84,
      label = "照料 " + score;
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.scale(this.camera.scale, this.camera.scale);
    c.translate(-this.camera.x, -this.camera.y);
    c.fillStyle = "#1d2a24b0";
    c.fillRect(x - 10, y - 10, 66, 20);
    c.lineWidth = 3;
    c.strokeStyle = "#3a463c";
    c.beginPath();
    c.arc(x, y, 7, 0, Math.PI * 2);
    c.stroke();
    c.strokeStyle = frac >= 1 ? "#ffd76a" : "#b8e0a0";
    c.beginPath();
    c.arc(x, y, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    c.stroke();
    c.restore();
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.scale(this.camera.scale, this.camera.scale);
    c.translate(-this.camera.x, -this.camera.y);
    this.text(label, x + 12, y + 4, score >= 80 ? "#ffd76a" : score >= 50 ? "#f1e8c8" : "#f3b4a5", 11, false);
    c.restore();
  }
  drawBuilding(b, e) {
    if (b.type !== "scarecrow") return super.drawBuilding(b, e);
    const { rect } = pixelPainter(this.ctx),
      x = b.x,
      y = b.y,
      sway = e.s.settings?.access?.calm ? 0 : Math.round(Math.sin(this.time * 1.2 + x) * 1.5);
    rect(x - 2, y - 46, 4, 50, "#6b4f2a");
    rect(x - 20 + sway, y - 38, 40, 4, "#6b4f2a");
    rect(x - 10 + sway, y - 40, 20, 24, "#b08a4a");
    rect(x - 10 + sway, y - 30, 20, 3, "#8a6a34");
    rect(x - 22 + sway, y - 39, 4, 8, "#d8c27a");
    rect(x + 18 + sway, y - 39, 4, 8, "#d8c27a");
    rect(x - 7 + sway, y - 56, 14, 14, "#e2cf8f");
    rect(x - 4 + sway, y - 52, 2, 2, "#2a2622");
    rect(x + 2 + sway, y - 52, 2, 2, "#2a2622");
    rect(x - 3 + sway, y - 47, 6, 1, "#7a4b2a");
    rect(x - 12 + sway, y - 60, 24, 4, "#7a5a2c");
    rect(x - 7 + sway, y - 66, 14, 6, "#7a5a2c");
    rect(x - 8, y + 2, 16, 3, "#3a3024");
    if (b.hp < 20) this.text("要修", x, y - 72, "#f3b4a5", 11);
  }
}
