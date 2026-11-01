// v0.46.0「有奔头」的场景这一层（盖在 v0.45 顺手那一层上面）：复兴工程修在农场上的两样——谷仓屋脊上的钟楼、
// 前哨广场边上的纪念碑——修好了就立在那儿（只是画出来，不挡路；画在地面这一层，人走过去照样在前面）。
// 别的地区修好的地方在世界地图上挂小牌子（页面那一层）。只改怎么画，不碰引擎、存档和随机数。
import { Renderer as HandyRenderer } from "./handy-renderer.js";
import { FARM_SPOTS } from "./ahead-data.js";

export class Renderer extends HandyRenderer {
  ahRect(x, y, w, h, color) {
    const c = this.ctx;
    c.fillStyle = color;
    c.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }
  ahTri(ax, ay, bx, by, cx, cy, color) {
    const c = this.ctx;
    c.fillStyle = color;
    c.beginPath();
    c.moveTo(ax, ay);
    c.lineTo(bx, by);
    c.lineTo(cx, cy);
    c.closePath();
    c.fill();
  }
  drawFarm(e) {
    super.drawFarm(e);
    const done = e?.ah?.done;
    if (!done) return;
    if (done.monument) this.drawAhMonument(FARM_SPOTS.monument);
    if (done.bell) this.drawAhBell(FARM_SPOTS.bell, this.time || 0);
  }
  // 钟楼：谷仓屋脊上的小钟亭——四根柱子、尖顶、里面一口铜钟（“减少晃动”开着时不晃）
  drawAhBell({ x, y }, t) {
    const R = (a, b, w, h, c) => this.ahRect(x + a, y + b, w, h, c);
    R(-18, -4, 36, 6, "#4a3424");
    R(-12, -38, 24, 34, "#2b2420");
    R(-16, -38, 5, 34, "#7a5838");
    R(11, -38, 5, 34, "#7a5838");
    const swing = this.calm || this._uE?.s?.settings?.access?.calm ? 0 : Math.sin(t * 2.2) * 1.5;
    R(-6 + swing, -33, 12, 12, "#c9a23a");
    R(-7 + swing, -22, 14, 3, "#a8842c");
    R(-1 + swing, -19, 2, 3, "#6e5420");
    R(-5 + swing, -32, 3, 7, "#e6c45a");
    this.ahTri(x - 22, y - 38, x, y - 60, x + 22, y - 38, "#5a2e20");
    this.ahTri(x - 17, y - 40, x, y - 56, x + 17, y - 40, "#8d4a32");
    R(-1, -66, 2, 7, "#3a2a20");
    R(-3, -68, 6, 2, "#c9a23a");
  }
  // 纪念碑：三级石阶、高碑身、碑前一束花
  drawAhMonument({ x, y }) {
    const R = (a, b, w, h, c) => this.ahRect(x + a, y + b, w, h, c);
    R(-30, -6, 60, 8, "#62645d");
    R(-24, -12, 48, 7, "#85857a");
    R(-18, -18, 36, 7, "#aaa797");
    R(-9, -92, 18, 76, "#cdc8b6");
    R(-9, -92, 3, 76, "#aaa797");
    R(-11, -96, 22, 5, "#aaa797");
    for (let k = -84; k < -26; k += 6) R(-4, k, 8, 1, "#85857a");
    R(-2, -102, 4, 6, "#cdc8b6");
    R(-14, -10, 4, 4, "#d2654c");
    R(-11, -11, 3, 3, "#efe2b4");
    R(10, -10, 4, 4, "#d2654c");
    R(-12, -7, 2, 4, "#667d36");
    R(11, -7, 2, 4, "#667d36");
  }
}
