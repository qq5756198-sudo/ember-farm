// v0.19.0「妙手」的场景表现：稻草人、钱箱、藏货点；蹲着靠近能下手的人时，他头顶出现一只眼睛
// （绿：你在他背后；黄：侧面；红：正面；Zz：睡着了），对你起疑的人头顶有 1–3 个红点。
import { Renderer as DailyRenderer } from "./daily-renderer.js";
import { pixelPainter } from "./beyond-art.js";
import { THIEF_OBJECTS } from "./thief.js";

export class Renderer extends DailyRenderer {
  drawObject(o, e) {
    if (THIEF_OBJECTS.includes(o.type)) return this.drawThiefObject(o, e);
    const out = super.drawObject(o, e);
    if (e.th && e.targetOf) this.drawTheftMark(o, e);
    return out;
  }
  drawTheftMark(o, e) {
    const t = e.targetOf(o);
    if (!t) return;
    const sus = e.th.sus[t.id] || 0,
      p = e.s.player,
      near = !!e.f?.crouch && e.hasTalent("pickpocket") && Math.hypot(o.x - p.x, o.y - p.y) < 240;
    if (!sus && !near) return;
    const { rect } = pixelPainter(this.ctx),
      x = o.x,
      y = o.y - 108,
      color = !!e.s.settings?.access?.color;
    if (near) {
      const mine = e.targetNear()?.id === t.id;
      if (e.asleep(t.def)) this.text("Zz", x, y + 4, "#c9d6e6", 13);
      else {
        const f = e.facing(o);
        const col = f === "behind" ? (color ? "#4aa3ff" : "#8fd07a") : f === "side" ? "#e9c05a" : color ? "#f0a040" : "#e9806e";
        // 一只像素眼睛：背后是闭着的（他看不见你），侧面半睁，正面睁大
        rect(x - 14, y - 8, 28, 16, "#1d2a24");
        rect(x - 12, y - 6, 24, 12, f === "behind" ? "#1d2a24" : "#f2ead2");
        if (f === "behind") rect(x - 12, y - 1, 24, 3, col);
        else {
          rect(x - 5, y - (f === "side" ? 3 : 6), 10, f === "side" ? 9 : 12, col);
          rect(x - 2, y - (f === "side" ? 1 : 3), 4, f === "side" ? 5 : 6, "#1d2a24");
          if (f === "side") rect(x - 12, y - 6, 24, 3, "#1d2a24");
        }
        if (mine) this.text({ behind: "背后", side: "侧面", front: "正面" }[f], x, y - 14, col, 12);
      }
    }
    for (let i = 0; i < sus; i++) rect(x - 10 + i * 8, y + 12, 6, 6, color ? "#f0a040" : "#e9806e");
  }
  drawThiefObject(o, e) {
    const { rect, crate } = pixelPainter(this.ctx),
      x = o.x,
      y = o.y,
      calm = !!e.s.settings?.access?.calm;
    if (o.type === "thiefDummy") {
      const sway = calm ? 0 : Math.round(Math.sin(this.time * 1.5) * 1.5);
      rect(x - 2, y - 52, 4, 52, "#6b4f2a");
      rect(x - 18 + sway, y - 44, 36, 4, "#6b4f2a");
      rect(x - 12 + sway, y - 46, 24, 30, "#8a7a52");
      rect(x - 9 + sway, y - 64, 18, 18, "#d8c27a");
      rect(x - 9 + sway, y - 34, 6, 7, "#4f3a26");
      rect(x + 4 + sway, y - 34, 6, 7, "#4f3a26");
      rect(x + 14 + sway, y - 44, 4, 6, "#e9c05a");
      rect(x - 10, y - 2, 20, 4, "#3a3024");
      this.label(o, e, "#d8c27a");
      return;
    }
    if (o.type === "thiefBox") {
      rect(x - 14, y - 16, 28, 18, "#4a4f52");
      rect(x - 14, y - 16, 28, 4, "#7c8488");
      rect(x - 3, y - 10, 6, 7, "#e9c05a");
      rect(x - 15, y + 1, 30, 3, "#2a2d2f");
      this.label(o, e, "#cfd6da");
      return;
    }
    crate(x, y, 34, 26);
    rect(x - 12, y - 30, 24, 3, "#8fc9b8");
    rect(x - 3, y - 40, 6, 10, "#8fc9b8");
    this.label(o, e, "#8fc9b8", true);
  }
}
