// v0.45.0「顺手」的场景这一层（盖在 v0.44 四季那一层上面）：
// · 场景里的字不互相挡：字本来就等光照画完一起写；写之前先排一下——面前那一样的名字、感染者头上的“扑！”这些不动，
//   金色路标的步数、飘字其次，田里、地上的小字最后；叠上了的往上挪一两行（再不行往下挪一行），还叠着的小字就不写；
//   离得近、写的一样的字只写一个；字不出画面的上下边（“+35 金”不再被顶栏切掉半截）；
//   字都写完以后才画的几样（金色路标“目标：…”那一块、建造时跟着鼠标那一行）也躲开前面写好的字，一个躲一个；
//   目标在画面外时边上那个箭头不再另写一遍步数（“目标：… · N步”那一块已经写了）。
// · 没开垦的地：一块干硬的浅色地皮，边上一圈虚线、几簇草，和翻过的黑土分得开。
// 只改怎么画，不碰引擎、存档和随机数。
import { Renderer as FourRenderer } from "./four-renderer.js";
import { GHOST_HINT, LABEL_SAFE, LABEL_OVER } from "./handy-data.js";

// 字有多宽（像素字：中文一个字一个字号宽，英文数字半个多）
const wordsW = (label, px) => {
  let w = 0;
  for (const ch of String(label)) w += ch.charCodeAt(0) < 256 ? px * 0.55 : px;
  return w;
};
const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

export class Renderer extends FourRenderer {
  draw(engine, mouse, dt = 0.016) {
    this._hyQ = [];
    this._hyLaid = false;
    this._hyPlaced = [];
    this._hyPost = [];
    this._hyNear = false;
    try {
      return super.draw(engine, mouse, dt);
    } finally {
      this._hyQ = null;
      this._hyLaid = false;
    }
  }
  // 面前那一样的名字（最要紧，不挪）
  drawSimpleLabel(engine) {
    const was = this._hyNear;
    this._hyNear = true;
    try {
      return super.drawSimpleLabel(engine);
    } finally {
      this._hyNear = was;
    }
  }
  // 目标在画面外：边上那个箭头（步数不再另写）
  drawEdgeArrow(e, goal) {
    const was = this._hyEdge;
    this._hyEdge = true;
    try {
      return super.drawEdgeArrow(e, goal);
    } finally {
      this._hyEdge = was;
    }
  }
  // 几样字的先后：3 不动（面前那一样、感染者头上的大字），2 金色路标，1 飘字和别的，0 地上的小字（挡着就不写）
  hyPriority(kind, label, size) {
    if (this._hyNear || size > 15) return 3;
    if (kind === "badge" && /步$|^目标/.test(String(label))) return 2;
    if (this.labelScope === "scenery") return 0;
    return 1;
  }
  hyDefer(kind, label, x, y, color, size, center) {
    const c = this.ctx,
      m = c.getTransform(),
      a = c.globalAlpha;
    const ent = { kind, label: String(label), x, y, color, size, center, m, pri: this.hyPriority(kind, label, size), i: this._hyQ.length, dx: 0, dy: 0, drop: false };
    this._hyQ.push(ent);
    this._textQueue.push(() => {
      if (!this._hyLaid) this.hyLayout();
      if (ent.drop) return;
      c.save();
      c.setTransform(m);
      c.globalAlpha = a;
      this._hyDrawing = true;
      try {
        if (kind === "badge") super._pixelBadge(label, x + ent.dx, y + ent.dy, color);
        else super._pixelText(label, x + ent.dx, y + ent.dy, color, size, center);
      } finally {
        this._hyDrawing = false;
        c.restore();
      }
    });
  }
  // 一行字在屏幕上占哪一块（画布像素）
  hyRect(ent) {
    const m = ent.m;
    if (!m) return null;
    const k = Math.abs(m.a) || 1,
      sx = m.a * ent.x + m.c * ent.y + m.e,
      sy = m.b * ent.x + m.d * ent.y + m.f;
    if (ent.kind === "badge") {
      const w = (wordsW(ent.label, 12) + 16) * k,
        h = 24 * k;
      return { x: sx - w / 2, y: sy - 12 * k, w, h };
    }
    const px = ent.size > 15 ? 24 : 12,
      w = wordsW(ent.label, px) * k,
      h = px * k;
    return { x: ent.center === false ? sx : sx - w / 2, y: sy - h / 2, w, h };
  }
  // 画面上下各留多少（画布像素）：顶栏、底栏压在画布上的那一截再加一点边；每秒量一回
  hySafe() {
    const now = this.time || 0;
    if (this._hySafe && Math.abs(now - this._hySafeAt) < 1) return this._hySafe;
    const dpr = this.dpr || 1,
      doc = globalThis.document;
    let top = LABEL_SAFE.top,
      bottom = LABEL_SAFE.bottom;
    try {
      const c = this.canvas?.getBoundingClientRect?.(),
        t = doc?.querySelector?.(".hud-top")?.getBoundingClientRect?.(),
        b = doc?.querySelector?.(".hud-dock")?.getBoundingClientRect?.();
      if (c?.height && t?.height) top = Math.max(0, t.bottom - c.top) + LABEL_SAFE.top;
      if (c?.height && b?.height) bottom = Math.max(0, c.bottom - b.top) + LABEL_SAFE.bottom;
    } catch {}
    this._hySafe = { top: top * dpr, bottom: bottom * dpr };
    this._hySafeAt = now;
    return this._hySafe;
  }
  // 压在画面上的几块（开局提示条、角上的小卡、顶上的提醒……）占的地方（画布像素）：每 0.25 秒量一回
  hyOverlays() {
    const now = this.time || 0;
    if (this._hyOver && Math.abs(now - this._hyOverAt) < 0.25) return this._hyOver;
    const out = [],
      doc = globalThis.document,
      dpr = this.dpr || 1;
    try {
      const c = this.canvas?.getBoundingClientRect?.();
      if (c?.height)
        for (const sel of LABEL_OVER)
          for (const el of doc?.querySelectorAll?.(sel) || []) {
            if (!el || el.hidden) continue;
            const r = el.getBoundingClientRect?.();
            if (!r?.width || !r?.height) continue;
            out.push({ x: (r.left - c.left) * dpr, y: (r.top - c.top) * dpr, w: r.width * dpr, h: r.height * dpr });
          }
    } catch {}
    this._hyOver = out;
    this._hyOverAt = now;
    return out;
  }
  // 排字：先放要紧的，后放的叠上了就挪，挪不开的小字不写
  hyLayout() {
    this._hyLaid = true;
    const q = this._hyQ || [],
      H = this.canvas?.height || (this.h || 768) * (this.dpr || 1),
      safe = this.hySafe(),
      over = this.hyOverlays(),
      placed = [];
    const order = [...q].sort((a, b) => b.pri - a.pri || a.i - b.i);
    const free = (rr, all = true) => !over.some((o) => overlap(o, rr)) && (!all || !placed.some((p) => overlap(p.r, rr)));
    for (const ent of order) {
      const r = this.hyRect(ent);
      if (!r) continue;
      const k = Math.abs(ent.m.d) || 1;
      // 感染者头上的大字：一点不动
      if (ent.size > 15) {
        placed.push({ r, ent });
        continue;
      }
      // 不写进顶栏、底栏底下
      let dy = 0;
      if (r.y < safe.top) dy = safe.top - r.y;
      else if (r.y + r.h > H - safe.bottom) dy = H - safe.bottom - (r.y + r.h);
      // 面前那一样的名字：只躲开压在画面上的那几块
      if (ent.pri >= 3) {
        let rr = { ...r, y: r.y + dy };
        for (const step of [0, -1, -2, 1]) {
          const t = { ...r, y: r.y + dy + step * (r.h + 2) };
          if (t.y < safe.top || t.y + t.h > H - safe.bottom) continue;
          if (free(t, false)) {
            rr = t;
            break;
          }
        }
        ent.dy = (rr.y - r.y) / k;
        placed.push({ r: rr, ent });
        continue;
      }
      // 离得近、写的一样的（或者是面前那一样名字的头半截）：只写一个
      const cx = r.x + r.w / 2;
      if (placed.some((p) => (p.ent.label === ent.label || p.ent.label.startsWith(ent.label + " · ")) && Math.abs(p.r.x + p.r.w / 2 - cx) < 120 && Math.abs(p.r.y - r.y) < 60)) {
        ent.drop = true;
        continue;
      }
      // 地上的小字最多往上挪一行（挪远了就认不出是谁的字了），挪不开就不写
      let best = null;
      for (const step of ent.pri <= 0 ? [0, -1] : [0, -1, -2, 1]) {
        const rr = { ...r, y: r.y + dy + step * (r.h + 2) };
        if (rr.y < safe.top || rr.y + rr.h > H - safe.bottom) continue;
        if (free(rr)) {
          best = rr;
          break;
        }
      }
      if (!best) {
        if (ent.pri <= 0) {
          ent.drop = true;
          continue;
        }
        best = { ...r, y: r.y + dy };
      }
      ent.dy = (best.y - r.y) / k;
      placed.push({ r: best, ent });
    }
    this._hyPlaced = placed.map((p) => p.r);
    this._hyLast = { words: q.length, shown: placed.length, dropped: q.filter((x) => x.drop).length };
  }
  _pixelText(label, x, y, color = "#e6e5c7", size = 12, center = true) {
    if (this._deferText && this._hyQ) return this.hyDefer("text", label, x, y, color, size, center);
    return super._pixelText(label, x, y, color, size, center);
  }
  _pixelBadge(label, x, y, color = "#d8cb92") {
    if (this._deferText && this._hyQ) return this.hyDefer("badge", label, x, y, color, 12, true);
    if (label === GHOST_HINT[0]) label = GHOST_HINT[1];
    // 字都写完以后才画的（金色路标那一块、建造时跟着鼠标那一行）：不出画面，躲开前面写好的字
    if (!this._hyDrawing && this._hyQ && !this._deferText) {
      if (this._hyEdge && /^\d+步$/.test(String(label))) return;
      const ent = { kind: "badge", label: String(label), x, y, size: 12, center: true, m: this.ctx.getTransform() },
        r = this.hyRect(ent),
        k = Math.abs(ent.m.d) || 1;
      if (r) {
        const H = this.canvas?.height || (this.h || 768) * (this.dpr || 1),
          safe = this.hySafe(),
          taken = [...(this._hyPlaced || []), ...this._hyPost, ...this.hyOverlays()];
        let dy = 0;
        if (r.y < safe.top) dy = safe.top - r.y;
        else if (r.y + r.h > H - safe.bottom) dy = H - safe.bottom - (r.y + r.h);
        let best = { ...r, y: r.y + dy };
        for (const step of [0, 1, -1, 2]) {
          const rr = { ...r, y: r.y + dy + step * (r.h + 2) };
          if (rr.y < safe.top || rr.y + rr.h > H - safe.bottom) continue;
          if (!taken.some((p) => overlap(p, rr))) {
            best = rr;
            break;
          }
        }
        y += (best.y - r.y) / k;
        this._hyPost.push(best);
      }
    }
    return super._pixelBadge(label, x, y, color);
  }
  // 没开垦的地：一块干硬的浅色地皮，边上一圈虚线、几簇草（翻过的黑土照旧）
  drawPlot(p, engine) {
    if (!this.v || p.tilled) return super.drawPlot(p, engine);
    const c = this.ctx,
      X = Math.round((p.x - 18) / 2) * 2,
      Y = Math.round((p.y - 18) / 2) * 2;
    c.fillStyle = "rgba(170,140,92,.38)";
    c.fillRect(X, Y, 36, 36);
    c.fillStyle = "rgba(38,26,16,.6)";
    for (let k = 0; k < 36; k += 8) {
      c.fillRect(X + k, Y, 4, 2);
      c.fillRect(X + k, Y + 34, 4, 2);
      c.fillRect(X, Y + k, 2, 4);
      c.fillRect(X + 34, Y + k, 2, 4);
    }
    c.fillStyle = "#7f9145";
    for (const [dx, dy] of [
      [8, 9],
      [23, 6],
      [13, 23],
      [26, 21],
    ]) {
      c.fillRect(X + dx, Y + dy, 2, 4);
      c.fillRect(X + dx + 2, Y + dy + 1, 2, 3);
    }
  }
}
