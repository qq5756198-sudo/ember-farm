// v0.42.0「删繁」的场景这一层（盖在 v0.41 看得清那一层上面）：
// · 走近一块田，头上的小圈旁边不再写“照料 N”：写“该浇水”“浇过了”“漏浇过”（漏浇过的这一茬不出优质）；
// · 喷灌头一直开着：白天不下雨就转一圈水花（原来要水网里有水才转）。
// · 居民头上的“♪”“愁”跟着全营士气：只在名册第一个人头上冒。
// · 肥力不再算：田边那条肥力色条不画（肥力一直是 85，下面几层看到 85 会画一条“肥”的绿条）。
// 盖布、草和虫这些下面几层照旧会画——只是这一版田里不会再有它们（草、虫、布都拿掉了）。
import { Renderer as ClearRenderer } from "./clear-renderer.js";
import { CROPS } from "./data.js";
import { pixelPainter } from "./beyond-art.js";
import { MORALE } from "./trim-data.js";

export class Renderer extends ClearRenderer {
  drawFarm(e) {
    super.drawFarm(e);
    if (e?.tr && e.bt && e.s.region === "farm") this.trSpray(e);
  }
  trSpray(e) {
    const m = e.s.minute;
    if (m < 360 || m >= 1200 || e.rainy?.()) return;
    const { rect } = pixelPainter(this.ctx),
      calm = !!e.s.settings?.access?.calm,
      t = this.time || 0;
    for (const b of e.s.buildings) {
      if (b.type !== "irrigation" || b.hp <= 0) continue;
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2 + (calm ? 0 : t * 1.5),
          ph = calm ? 0.5 : (t * 1.2 + k / 8) % 1,
          R = 10 + ph * 26;
        rect(b.x + Math.cos(a) * R, b.y - 24 + Math.sin(a) * R * 0.5 - Math.sin(ph * Math.PI) * 10, 2, 2, "#a9cfbd", 0.7 * (1 - ph));
      }
    }
  }
  // 田边的肥力色条：肥力不再算，画的时候当作 65（不肥不贫，不画条），画完放回去
  trNoSoil(e, fn) {
    if (!e?.tr) return fn();
    const plots = e.s.plots,
      keep = plots.map((p) => p.fertility);
    for (const p of plots) p.fertility = 65;
    try {
      return fn();
    } finally {
      plots.forEach((p, i) => (p.fertility = keep[i]));
    }
  }
  drawGarden(e) {
    return this.trNoSoil(e, () => super.drawGarden(e));
  }
  drawGardenMarks(e) {
    return this.trNoSoil(e, () => super.drawGardenMarks(e));
  }
  // 居民头上的小气泡：心情并成全营士气以后，“♪”“愁”只在名册第一个人头上冒（士气 70 以上 / 35 以下），别人只说饿不饿
  drawNeeds(e) {
    const rs = e?.tr ? e.c?.residents : null;
    if (!rs?.length) return super.drawNeeds(e);
    const keep = rs.map((r) => r.morale),
      m = e.tr.morale,
      mood = m >= MORALE.high ? 80 : m < MORALE.low ? 30 : 60;
    rs.forEach((r, i) => (r.morale = i === 0 ? mood : 60));
    try {
      return super.drawNeeds(e);
    } finally {
      rs.forEach((r, i) => (r.morale = keep[i]));
    }
  }
  // 画在人物头顶：按 E 会动到的那块田的长势圈，旁边写今天浇没浇
  drawPlotHint(e) {
    if (!e?.tr) return super.drawPlotHint(e);
    const o = e.nearestObject?.(),
      p = o?.type === "plot" ? o.plot : null;
    if (!p?.crop || !CROPS[p.crop] || !this.camera) return;
    const c = this.ctx,
      frac = Math.min(1, p.growth / CROPS[p.crop].grow),
      ripe = frac >= 1,
      dry = !!e.tr.dry?.[p.id],
      wet = e.plotWatered?.(p),
      pl = e.s.player,
      x = pl.x - 26,
      y = pl.y - 84,
      label = ripe ? "熟了" : !wet ? "该浇水" : dry ? "漏浇过" : "浇过了",
      color = ripe ? "#ffd76a" : !wet ? "#f3b4a5" : dry ? "#f1e8c8" : "#b8e0a0";
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
    c.strokeStyle = ripe ? "#ffd76a" : "#b8e0a0";
    c.beginPath();
    c.arc(x, y, 7, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * frac);
    c.stroke();
    c.restore();
    c.save();
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    c.scale(this.camera.scale, this.camera.scale);
    c.translate(-this.camera.x, -this.camera.y);
    this.text(label, x + 12, y + 4, color, 11, false);
    c.restore();
  }
}
