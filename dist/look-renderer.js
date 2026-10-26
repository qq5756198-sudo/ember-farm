// v0.40.0「一套」：画场景这一层只改一件事——镜头。
// 原来镜头最多放大 1.5 倍：2560×1440 的屏幕上看到的地方比 1920×1080 多 78%，人物只占屏幕高度的 5.8%。
// 现在最多 2 倍：2560 宽时是 2 倍，看到的地方和 1920 一样大（1280 宽）。2050 宽以下和原来一模一样。
// 像素按整数倍或半整数倍放大（不会一格大一格小），差得太多或会露出地图外面时用原来的算法，这一条照旧。
import { Renderer as SimpleRenderer } from "./simple-renderer.js";
import { WORLD } from "./data.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const CAMERA_MAX = 2;

export class Renderer extends SimpleRenderer {
  cameraScale(s) {
    const zoom = s?.settings?.zoom || 1,
      raw = this.w / 1366;
    // 1.5 倍以内交给原来那一套（结果一模一样）
    if (raw <= 1.5 || !this.v) return super.cameraScale(s);
    const base = clamp(raw, 0.68, CAMERA_MAX) * zoom,
      dpr = this.dpr || 1,
      snapped = Math.max(1, Math.round(base * 2 * dpr)) / (2 * dpr);
    if (Math.abs(snapped - base) / base > 0.08) return base;
    if (this.w / snapped > WORLD.w + 1 || this.h / snapped > WORLD.h + 1) return base;
    return snapped;
  }
}
