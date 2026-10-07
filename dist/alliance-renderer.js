// 联盟前哨的场景表现：联盟终端、修好的水井与水槽、援建营地、援建队员和饭桌上的人。
import { Renderer as BeyondRenderer } from "./beyond-renderer.js";
import { pixelPainter } from "./beyond-art.js";
import { WELL_SPOT, TABLE_SEATS } from "./alliance-data.js";

const NEAR = (a, b, r) => Math.hypot(a.x - b.x, a.y - b.y) < r;

export class Renderer extends BeyondRenderer {
  drawFarm(e) {
    super.drawFarm(e);
    if (e.sc) this.drawAllianceGround(e);
  }
  drawAllianceGround(e) {
    const sc = e.sc,
      p = pixelPainter(this.ctx),
      { rect, line } = p,
      t = this.time;
    if (sc.flags.well) {
      // 木水槽：从水井沿路边接到第一排田。
      const path = [
        [902, 316],
        [902, 414],
        [700, 414],
        [700, 426],
        [322, 426],
      ];
      for (let i = 0; i < path.length - 1; i++) {
        const [x1, y1] = path[i],
          [x2, y2] = path[i + 1];
        line(x1, y1, x2, y2, "#5e4930", 9);
        line(x1, y1, x2, y2, "#9a7a4c", 6);
        line(x1, y1, x2, y2, sc.wellDay === e.s.day ? "#7fb9c9" : "#6f8c86", 2);
      }
      if (sc.wellDay === e.s.day)
        for (let k = 0; k < 6; k++) rect(330 + ((t * 40 + k * 61) % 360), 425, 4, 2, "#c9e6e6");
    }
    if (e.projectStage?.("market") >= 1) {
      const lit = e.r?.claimed.includes("table");
      rect(790, 352, 88, 6, "#5c4630");
      rect(788, 344, 92, 9, "#a8875a");
      rect(788, 344, 92, 2, "#d0b17c");
      for (const x of [794, 870]) rect(x, 353, 5, 12, "#5c4630");
      rect(786, 370, 96, 4, "#7d6040");
      if (lit) {
        rect(878, 306, 3, 40, "#5f5541");
        rect(872, 302, 15, 11, "#3d4a40");
        rect(874, 304, 11, 7, 0.5 + 0.5 * Math.sin(t * 3) > 0.15 ? "#f3d27a" : "#e2b45c");
        this.ctx.save();
        this.ctx.globalAlpha = 0.16 + 0.04 * Math.sin(t * 3);
        this.ctx.fillStyle = "#f6d98a";
        this.ctx.beginPath();
        this.ctx.ellipse(834, 350, 70, 26, 0, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.restore();
      }
    }
    if (e.mealHour?.()) this.drawBowls(e);
  }
  drawBowls(e) {
    const p = pixelPainter(this.ctx),
      { rect } = p,
      people = [
        ...(e.s.colony?.residents || []).filter((r) => r.fed),
        ...(e.sc.helpers || []).filter((h) => h.fedDay === e.s.day),
      ];
    const seats = [];
    for (let i = 0; i < 4; i++) {
      const s = e.diningSeat?.(i);
      if (s) seats.push(s);
    }
    for (const s of seats)
      if (people.some((q) => NEAR(q, s, 16))) {
        const y = e.projectStage("market") >= 1 && TABLE_SEATS.includes(s) ? 348 : s.y - 6;
        rect(s.x - 6, y, 12, 4, "#e2dcc2");
        rect(s.x - 4, y - 2, 8, 2, "#c99a5a");
        for (let k = 0; k < 2; k++) rect(s.x - 2 + k * 3, y - 8 - ((this.time * 9 + k * 4) % 7), 2, 3, "#e9e3cf88");
      }
  }
  helperSheet() {
    if (this._helperSheet !== undefined) return this._helperSheet;
    this._helperSheet = null;
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
          // 红围巾换成联盟蓝。
          px[i] = l * 0.5;
          px[i + 1] = Math.min(255, l * 0.95 + 25);
          px[i + 2] = Math.min(255, l * 1.7 + 40);
        } else if (r > 30 && Math.abs(r - g) <= 22 && g > b + 14) {
          // 橄榄外套换成援建队工装橙。
          px[i] = Math.min(255, l * 2.1 + 20);
          px[i + 1] = Math.min(255, l * 1.15 + 10);
          px[i + 2] = l * 0.35;
        }
      }
      c.putImageData(data, 0, 0);
      this._helperSheet = { canvas: cv, sx: cv.width / 8, sy: cv.height / 2 };
    } catch {
      this._helperSheet = null;
    }
    return this._helperSheet;
  }
  drawObject(o, e) {
    if (o.type === "allianceHelper") return this.drawHelper(o, e);
    if (o.type === "allianceCamp") return this.drawCamp(o, e);
    if (o.type === "allianceSite") return this.drawCampSite(o, e);
    super.drawObject(o, e);
    if (o.type === "sign" && e.sc) this.drawTerminal(o, e);
    if (o.type === "well" && e.sc?.flags.well) this.drawPulley(o);
  }
  drawTerminal(o, e) {
    const { rect, line } = pixelPainter(this.ctx),
      x = o.x + 34,
      y = o.y,
      alert = e.sc.unread || e.canReply?.(),
      blink = Math.floor(this.time * 3) % 2 === 0;
    this.shadow(x, y, 13);
    rect(x - 10, y - 32, 21, 32, "#4f5c55");
    rect(x - 10, y - 32, 21, 3, "#7d8d81");
    rect(x - 7, y - 27, 15, 10, "#1d2b25");
    rect(x - 6, y - 26, 13, 8, alert ? "#9fd8b4" : "#5f9479");
    for (let k = 0; k < 3; k++) rect(x - 4, y - 24 + k * 2, 5 + ((k * 3 + Math.floor(this.time * 2)) % 5), 1, "#2b4a3b");
    rect(x - 7, y - 13, 6, 3, "#9aa48c");
    rect(x + 2, y - 13, 6, 3, "#9aa48c");
    line(x + 6, y - 32, x + 10, y - 48, "#9aa48c", 2);
    rect(x + 8, y - 51, 5, 5, alert && blink ? "#f2c35e" : "#6b5a3a");
    if (alert && NEAR(o, e.s.player, 190)) this.badge(e.canReply?.() ? "可以回信" : "新来信", x, y - 64, "#f2d48b");
  }
  drawPulley(o) {
    const { rect, line } = pixelPainter(this.ctx),
      x = o.x,
      y = o.y;
    rect(x - 26, y - 62, 5, 58, "#6e5638");
    rect(x + 21, y - 62, 5, 58, "#6e5638");
    rect(x - 28, y - 66, 56, 6, "#9b7b4d");
    rect(x - 6, y - 64, 12, 8, "#c3a46d");
    line(x, y - 58, x, y - 34 + Math.sin(this.time * 2) * 2, "#d8c9a0", 1);
    rect(x - 4, y - 36 + Math.sin(this.time * 2) * 2, 8, 6, "#7e9a94");
  }
  drawCampSite(o, e) {
    const { rect, line } = pixelPainter(this.ctx),
      x = o.x,
      y = o.y;
    const stakes = [
      [x - 34, y - 18],
      [x + 34, y - 18],
      [x + 34, y + 14],
      [x - 34, y + 14],
    ];
    for (let i = 0; i < 4; i++) {
      const [a, b] = stakes[i],
        [c, d] = stakes[(i + 1) % 4];
      line(a, b, c, d, "#d8c9a088", 1);
    }
    for (const [a, b] of stakes) rect(a - 2, b - 10, 4, 12, "#8a6b43");
    rect(x - 2, y - 40, 4, 30, "#7a5d3b");
    rect(x - 16, y - 48, 32, 14, "#b9a679");
    rect(x - 12, y - 44, 24, 2, "#6c6248");
    rect(x - 9, y - 40, 18, 2, "#6c6248");
    if (NEAR(o, e.s.player, 160)) this.badge("援建营地空地", x, y - 64, "#e6d6a3");
  }
  drawCamp(o, e) {
    const c = this.ctx,
      { rect, line, circle } = pixelPainter(c),
      x = o.x,
      y = o.y,
      t = this.time,
      night = e.s.minute < 360 || e.s.minute >= 1140;
    // 帐篷：联盟蓝帆布，门帘半开。
    this.shadow(x - 22, y + 4, 48);
    for (let k = 0; k < 13; k++)
      rect(x - 70 + k * 4, y - 8 - k * 5, 96 - k * 8, 5, k % 4 === 3 ? "#4b6f82" : "#5d8396");
    rect(x - 72, y - 8, 100, 8, "#3e5d6c");
    rect(x - 32, y - 38, 16, 38, "#1f2f2c");
    rect(x - 16, y - 34, 6, 34, "#6f97a9");
    line(x - 24, y - 72, x - 24, y - 8, "#d7c38a", 2);
    rect(x - 70, y - 4, 4, 6, "#7a5d3b");
    rect(x + 22, y - 4, 4, 6, "#7a5d3b");
    // 旗杆：联盟前哨的识别旗
    rect(x + 40, y - 86, 3, 86, "#7a5d3b");
    rect(x + 43, y - 86 + Math.sin(t * 2), 22, 13, "#3f78b5");
    rect(x + 43, y - 81 + Math.sin(t * 2), 22, 3, "#e3c467");
    // 火盆与木墩
    circle(x + 10, y + 26, 11, "#5b5148");
    circle(x + 10, y + 26, 7, "#3a2f27");
    const flick = Math.sin(t * 9) * 2;
    rect(x + 6, y + 14 + flick, 8, 10, "#e69a3c");
    rect(x + 8, y + 10 - flick, 4, 8, "#f6d27a");
    for (const [dx, dy] of [
      [-28, 26],
      [46, 28],
      [10, 46],
    ]) {
      rect(x + dx - 8, y + dy - 4, 16, 8, "#7a5b3a");
      rect(x + dx - 8, y + dy - 4, 16, 2, "#a8875a");
    }
    if (night) {
      c.save();
      c.globalAlpha = 0.18 + 0.05 * Math.sin(t * 7);
      c.fillStyle = "#f3b45a";
      c.beginPath();
      c.ellipse(x + 10, y + 26, 90, 40, 0, 0, Math.PI * 2);
      c.fill();
      c.restore();
    }
    if (NEAR(o, e.s.player, 120)) this.badge(o.name, x - 20, y - 104, "#e6d6a3");
  }
  drawHelper(o, e) {
    const h = (e.sc?.helpers || []).find((x) => x.id === o.helper);
    if (!h) return;
    const { rect } = pixelPainter(this.ctx),
      x = o.x,
      y = o.y,
      a = h.facing || 0,
      moving = h.target && Math.hypot(h.x - h.target.x, h.y - h.target.y) > 8;
    this.shadow(x, y, 19);
    let index =
      a >= Math.PI / 4 && a < Math.PI * 0.75
        ? 0
        : a < -Math.PI / 4 && a > -Math.PI * 0.75
          ? 4
          : a >= -Math.PI / 4 && a <= Math.PI / 4
            ? 8
            : 12;
    if (moving) index += Math.floor(this.time * 8) % 4;
    const sheet = this.helperSheet();
    if (sheet) {
      this.ctx.drawImage(
        sheet.canvas,
        (index % 8) * sheet.sx,
        Math.floor(index / 8) * sheet.sy,
        sheet.sx,
        sheet.sy,
        x - 27,
        y - 65,
        54,
        65,
      );
    } else this.sprite(index, x, y, 54, 65);
    // 安全帽与反光条
    rect(x - 11, y - 61, 22, 7, "#e2b947");
    rect(x - 11, y - 61, 22, 2, "#f4d97a");
    rect(x - 14, y - 55, 28, 3, "#b38a2d");
    if (h.task === "carry" && moving) {
      const bob = Math.sin(this.time * 8) * 1.5;
      rect(x - 10, y - 31 + bob, 20, 12, "#8d754e");
      rect(x - 10, y - 31 + bob, 20, 3, "#c3a574");
      rect(x - 2, y - 28 + bob, 3, 9, "#5d553e");
    }
    if (h.task === "meal" && !moving) {
      rect(x + 10, y - 26, 10, 4, "#e2dcc2");
      rect(x + 12, y - 28, 6, 2, "#c99a5a");
    }
    this.text(o.name, x, y - 80, "#9fc6e8", 12);
    if (NEAR(o, e.s.player, 220)) this.text(h.status, x, y - 95, "#b8d4b1", 10);
  }
}
