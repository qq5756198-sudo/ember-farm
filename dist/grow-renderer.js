// v0.34.0「成长」的画面：眼尖（探索 9 级）走近了，今天有好东西的柜子上一颗星；消防斧劈开过甲的重甲身上一道裂口。
// 只是画出来，不挡路；“减少闪烁与震屏”下星星不闪。
import { Renderer as HopeRenderer } from "./hope-renderer.js";

export class Renderer extends HopeRenderer {
  grCalm(e) {
    return !!this.calm || !!e?.s?.settings?.access?.calm;
  }
  drawObject(o, e) {
    super.drawObject(o, e);
    if (!e?.gw || o?.type !== "crate" || !o.ukind || !e.perk?.("exEye")) return;
    const p = e.s.player;
    if (Math.hypot(p.x - o.x, p.y - o.y) > 220) return;
    const tier = e.grPeek?.(o);
    if (tier !== "rare" && tier !== "precious") return;
    const t = this.time || 0,
      k = this.grCalm(e) ? 1 : 0.75 + 0.25 * Math.sin(t * 4),
      color = tier === "precious" ? "#ffcf6a" : "#8fd0ff";
    this.grStar(o.x, o.y - 46 - (this.grCalm(e) ? 0 : Math.sin(t * 2) * 2), 6 * k + 2, color);
  }
  grStar(x, y, r, color) {
    const c = this.ctx;
    if (!c) return;
    c.save();
    c.fillStyle = color;
    c.strokeStyle = "rgba(28,20,15,0.9)";
    c.lineWidth = 2;
    c.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + (i * Math.PI) / 5,
        rr = i % 2 ? r * 0.45 : r;
      const px = x + Math.cos(a) * rr,
        py = y + Math.sin(a) * rr;
      if (i) c.lineTo(px, py);
      else c.moveTo(px, py);
    }
    c.closePath();
    c.stroke();
    c.fill();
    c.restore();
  }
  drawEnemy(z, e) {
    super.drawEnemy(z, e);
    if (!z?.split || z.dead || !this.ctx) return;
    // 劈开的甲：胸口一道斜着的裂口
    const c = this.ctx,
      x = z.x,
      y = z.y - 34;
    c.save();
    c.strokeStyle = "#ffdb8c";
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x - 7, y - 8);
    c.lineTo(x - 2, y - 2);
    c.lineTo(x - 4, y + 2);
    c.lineTo(x + 6, y + 9);
    c.stroke();
    c.restore();
  }
}
