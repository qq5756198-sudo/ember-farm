// v0.16.0「前哨四季」的场景表现：前哨广场（长桌、节庆装饰、食堂客人）、营火夜谈、江伯、阿砾与壁画、
// 阿豆、借宿的人与秦奶奶、何大勺、老琴、散落的歌谱，以及建造时的相邻加成连线。
import { Renderer as WinterRenderer } from "./winter-renderer.js";
import { pixelPainter } from "./beyond-art.js";
import { SEASON_OBJECTS } from "./seasons.js";
import { SSPOTS, TASTES } from "./seasons-data.js";

const MURAL_COLORS = [
  ["#9fd38a", "#5a7a3a", "#f3d27a"],
  ["#e6b09a", "#7a4a3a", "#f6f2e8"],
  ["#9fd3e0", "#3a5a6a", "#e9c05a"],
  ["#c9a55a", "#5b4a33", "#9fd38a"],
  ["#d6c79a", "#7a2f26", "#f3a24a"],
  ["#b4d2db", "#4f6a7a", "#f6f2e8"],
  ["#e9c05a", "#6b4f7a", "#9fd3b0"],
  ["#f3d27a", "#2f3a33", "#e6b09a"],
];

export class Renderer extends WinterRenderer {
  drawObject(o, e) {
    if (SEASON_OBJECTS.includes(o.type)) return this.drawSeasonObject(o, e);
    return super.drawObject(o, e);
  }
  child(x, y, look, facing = Math.PI / 2) {
    const c = this.ctx;
    c.save();
    c.translate(x, y);
    c.scale(0.74, 0.74);
    c.translate(-x, -y);
    this.personSimple(x, y, look, facing);
    c.restore();
  }
  drawSeasonObject(o, e) {
    const p = pixelPainter(this.ctx),
      { rect, crate } = p,
      x = o.x,
      y = o.y,
      t = this.time,
      s = e.ss;
    if (o.type === "seasonPlaza") return this.drawPlaza(o, e);
    if (o.type === "seasonJiang") {
      this.personSimple(x, y, "jiang", 0);
      rect(x + 14, y - 40, 3, 34, "#7a5a36");
      this.ctx.strokeStyle = "#e8e4dc88";
      this.ctx.beginPath();
      this.ctx.moveTo(x + 16, y - 40);
      this.ctx.lineTo(x + 60, y + 30 + Math.sin(t * 2) * 3);
      this.ctx.stroke();
      crate(x - 30, y + 6, 22, 14);
      this.label(o, e, "#cfe0a8", s.jiang.phase === "none");
      return;
    }
    if (o.type === "seasonAli") {
      this.child(x, y, "ali", Math.PI);
      rect(x - 14, y - 34, 3, 10, "#2a2420");
      this.label(o, e, "#e9c05a", s.ali.phase === "here");
      return;
    }
    if (o.type === "seasonAdou") {
      if (!e.adouVisible()) return;
      this.child(x, y, "adou", Math.PI);
      if (s.adou.phase === "stealing") rect(x + 8, y - 26, 10, 7, "#c9a55a");
      this.label(o, e, s.adou.phase === "stealing" ? "#e6b09a" : "#cfe0a8", s.adou.phase !== "runner");
      return;
    }
    if (o.type === "seasonLodger") {
      const asking = s.lodger?.phase === "asking";
      if (!asking) {
        rect(x - 30, y + 2, 60, 14, "#7a5a6a");
        rect(x - 30, y + 2, 16, 14, "#e8e4dc");
      }
      const look = s.lodger ? s.lodger.look : "qin";
      this.personSimple(x + (asking ? 0 : 12), y, look, Math.PI / 2);
      if (asking) {
        rect(x + 14, y - 30, 12, 16, "#8a6a4a");
        if (Math.floor(t * 2) % 2) this.text("?", x, y - 92, "#f1d98a", 16);
      }
      this.label(o, e, "#f1d98a", asking || (s.qin.phase === "staying" && s.qin.wishes.length < 3));
      return;
    }
    if (o.type === "seasonHe") {
      rect(x + 26, y - 18, 30, 18, "#3a3530");
      rect(x + 28, y - 26, 26, 8, "#7a7a7a");
      for (let k = 0; k < 3; k++) rect(x + 32 + k * 7, y - 34 - ((t * 14 + k * 8) % 18), 4, 4, "#cfd2c8aa");
      this.personSimple(x, y, "he", 0);
      this.label(o, e, "#f1d98a", true);
      return;
    }
    if (o.type === "seasonSheet") {
      const bob = Math.sin(t * 3) * 2;
      rect(x - 10, y - 18 + bob, 20, 24, "#f6f2e8");
      for (let k = 0; k < 4; k++) rect(x - 7, y - 14 + k * 5 + bob, 14, 1, "#5b4a33");
      rect(x + 2, y - 10 + bob, 3, 3, "#2a2420");
      this.label(o, e, "#f1d98a", true);
    }
  }
  drawPlaza(o, e) {
    const { rect } = pixelPainter(this.ctx),
      x = o.x,
      y = o.y,
      t = this.time,
      s = e.ss,
      night = e.isNight(),
      fest = e.festivalWindow?.() || (e.isFestivalDay?.() && e.festivalHosted?.());
    // 石板地与长桌
    rect(x - 110, y - 30, 220, 80, "#9b8a6a33");
    rect(x - 80, y - 6, 160, 16, "#7a5a36");
    rect(x - 80, y - 6, 160, 3, "#a8936a");
    for (const dx of [-74, 70]) rect(x + dx, y + 10, 4, 14, "#5b4a33");
    for (let k = 0; k < 5; k++) rect(x - 70 + k * 34, y + 22, 18, 6, "#6a4b3a");
    // 节庆装饰
    if (s.decor.includes("banner") || fest) {
      this.ctx.strokeStyle = "#5b4a33";
      this.ctx.beginPath();
      this.ctx.moveTo(x - 110, y - 70);
      this.ctx.quadraticCurveTo(x, y - 46, x + 110, y - 70);
      this.ctx.stroke();
      for (let k = 0; k < 9; k++) {
        const fx = x - 100 + k * 25,
          fy = y - 66 + Math.sin((k / 8) * Math.PI) * 18;
        rect(fx, fy, 10, 10, ["#d06a58", "#e9c05a", "#9fd38a", "#89c6d0"][k % 4]);
      }
      for (const dx of [-112, 108]) rect(x + dx, y - 74, 4, 70, "#5b4a33");
    }
    if (s.decor.includes("lanterns")) {
      for (let k = 0; k < 5; k++) {
        const lx = x - 80 + k * 40,
          ly = y - 40 + (k % 2) * 6;
        if (night) {
          this.ctx.fillStyle = "#f3a24a33";
          this.ctx.beginPath();
          this.ctx.arc(lx + 4, ly + 6, 16, 0, Math.PI * 2);
          this.ctx.fill();
        }
        rect(lx, ly, 9, 12, night ? "#f3a24a" : "#c94b3d");
        rect(lx + 2, ly - 3, 5, 3, "#3a3530");
      }
    }
    if (s.decor.includes("arch")) {
      rect(x + 120, y - 60, 6, 70, "#7a5a36");
      rect(x + 170, y - 60, 6, 70, "#7a5a36");
      rect(x + 116, y - 66, 64, 8, "#a8936a");
      for (let k = 0; k < 6; k++) rect(x + 122 + k * 9, y - 74, 7, 7, ["#e9c05a", "#d06a58", "#9fd38a"][k % 3]);
    }
    if (s.decor.includes("stone")) {
      rect(x - 170, y - 24, 30, 34, "#7a7a72");
      rect(x - 166, y - 30, 22, 8, "#8a8a82");
      rect(x - 158, y - 14, 6, 2, "#3a3530");
      if (night || fest) rect(x - 157, y - 40 - Math.abs(Math.sin(t * 6)) * 3, 3, 6, "#f3d27a");
    }
    // 节庆之夜：老琴和围坐的人
    if (e.laoqinHere?.()) {
      this.personSimple(x + 96, y + 8, "laoqin", Math.PI);
      rect(x + 80, y - 24, 12, 18, "#a86a3a");
      rect(x + 84, y - 40, 3, 18, "#5b4a33");
      if (Math.floor(t * 2) % 2) this.text("♪", x + 108, y - 80, "#f3d27a", 14);
    }
    if (e.canteenOpen?.() && (s.canteen.night || fest)) this.personSimple(x - 96, y + 4, "he", 0);
    const n = s.canteen.night;
    if (n)
      n.customers.forEach((g, i) => {
        if (g.state === "left") return;
        const gx = x - 60 + i * 40,
          gy = y + 36;
        this.personSimple(gx, gy, g.look, -Math.PI / 2);
        if (g.state === "waiting") {
          const left = Math.max(0, 1 - g.waited / g.patience);
          rect(gx - 22, gy - 100, 44, 18, "#f6f2e8");
          this.text(TASTES[g.taste].name.slice(0, 2), gx, gy - 91, "#5b4a33", 11);
          rect(gx - 18, gy - 78, 36, 4, "#3a3530");
          rect(gx - 18, gy - 78, 36 * left, 4, left > 0.4 ? "#9fd38a" : "#d06a58");
        } else rect(gx - 6, y - 12, 12, 6, "#f3d27a");
      });
    const label = n ? "前哨食堂 · 营业中" : fest ? "前哨广场 · " + (e.festivalHosted?.() ? "节庆过后" : "节庆") : o.name;
    this.text(label, x, y - 90, fest || n ? "#f3d27a" : "#e8d9a6", 12);
  }
  draw(e, mouse, dt = 0.016) {
    super.draw(e, mouse, dt);
    if (!e.ss || e.s.region !== "farm") return;
    const c = this.ctx;
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.scale(this.camera.scale, this.camera.scale);
    c.translate(-this.camera.x, -this.camera.y);
    this.drawMurals(e);
    const fire = e.fireSpot?.();
    if (fire && !e.talkReason()) {
      const { rect } = pixelPainter(this.ctx);
      for (let k = 0; k < 4; k++) rect(fire.x - 8 + k * 5, fire.y - 28 - ((this.time * 20 + k * 9) % 24), 3, 3, k % 2 ? "#f3a24a" : "#f3d27a");
      this.badge("营火 · 夜谈（E）", fire.x - 40, fire.y - 64, "#f3d27a");
    }
    if (e.buildMode) this.drawAdjLinks(e);
    c.restore();
  }
  drawMurals(e) {
    const n = e.ss.ali.murals;
    if (!n) return;
    const { rect } = pixelPainter(this.ctx),
      sx = SSPOTS.murals.x,
      sy = SSPOTS.murals.y;
    for (let i = 0; i < n; i++) {
      const x = sx + i * 46,
        y = sy - 34,
        [a, b, k] = MURAL_COLORS[i % MURAL_COLORS.length];
      rect(x - 2, y - 2, 42, 30, "#3a3530");
      rect(x, y, 38, 26, b);
      rect(x + 4, y + 14, 30, 8, a);
      rect(x + 8 + (i % 3) * 6, y + 4, 8, 8, k);
      rect(x + 24 - (i % 2) * 10, y + 8, 6, 6, a);
    }
  }
  drawAdjLinks(e) {
    const c = this.ctx;
    c.save();
    for (const b of e.s.buildings)
      for (const rule of e.adjActive(b)) {
        if (!rule.b) continue;
        const o = e.s.buildings.find((x) => x !== b && x.hp > 0 && rule.b.includes(x.type) && Math.hypot(x.x - b.x, x.y - b.y) <= rule.r);
        if (!o) continue;
        for (const [color, width, dash] of [["#1a1408aa", 6, []], ["#f3d27a", 3, [8, 6]]]) {
          c.strokeStyle = color;
          c.lineWidth = width;
          c.setLineDash(dash);
          c.beginPath();
          c.moveTo(b.x, b.y - 10);
          c.lineTo(o.x, o.y - 10);
          c.stroke();
        }
        this.badge("＋" + rule.text.split("：")[1], (b.x + o.x) / 2, (b.y + o.y) / 2 - 14, "#f3d27a");
      }
    c.restore();
  }
}
