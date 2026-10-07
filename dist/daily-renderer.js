// v0.18.0「每日抉择」的场景表现：今天的补给点（带金色绸带的木箱）和连贯事件的标记点（插着小旗的木桩）。
import { Renderer as FarRenderer } from "./farlands-renderer.js";
import { pixelPainter } from "./beyond-art.js";
import { DAILY_OBJECTS } from "./daily.js";

export class Renderer extends FarRenderer {
  drawObject(o, e) {
    if (DAILY_OBJECTS.includes(o.type)) return this.drawDailyObject(o, e);
    return super.drawObject(o, e);
  }
  drawDailyObject(o, e) {
    const { rect, crate } = pixelPainter(this.ctx),
      x = o.x,
      y = o.y,
      t = this.time,
      calm = !!e.s.settings?.access?.calm;
    if (o.type === "dailyCache") {
      crate(x, y, 36, 28);
      rect(x - 2, y - 28, 4, 28, "#e9c05a");
      rect(x - 18, y - 16, 36, 4, "#e9c05a");
      const glow = calm ? 0 : Math.sin(t * 3) * 2;
      rect(x - 6, y - 40 - glow, 12, 8, "#f3d27a");
      this.label(o, e, "#f3d27a", true);
      return;
    }
    // 标记点：木桩 + 紫色小旗
    rect(x - 2, y - 44, 4, 44, "#6b4f2a");
    const wave = calm ? 0 : Math.round(Math.sin(t * 4) * 2);
    rect(x + 2, y - 44, 18, 10 + wave, "#c9a5e6");
    rect(x + 2, y - 44, 18, 2, "#e8d6f6");
    rect(x - 8, y - 2, 16, 4, "#3a3024");
    this.label(o, e, "#d9c2f0", true);
  }
}
