// v0.27.0「丰年」的画面：2×2 的巨型作物、放进田里的鸡、夜光豆夜里发光、喷灌头开着时的水花；
// 田上的痕迹：夜里被偷的脚印、田鼠洞、施过的肥、被踩倒的苗；田角的怪南瓜；
// 堆肥桶、出货箱旁边的订单板（贴着几张单子就画几张）、集市南边林姨的菜园；夜袭的感染者头上一个红三角。
import { Renderer as TidyRenderer } from "./tidy-renderer.js";
import { PAL, OUTLINE, Pix, cached } from "./pixel-kit.js";
import { registerArt, artDone } from "./pixel-props.js";
import { leafBlob } from "./pixel-sprites.js";
import { CROPS } from "./data.js";
import { CHICKENS, FERTS } from "./bounty-data.js";

const L = PAL.leaf,
  E = PAL.ember,
  So = PAL.soil,
  St = PAL.straw,
  Cl = PAL.cloth,
  Sn = PAL.snow;

// ---------- 巨型作物：一棵占 2×2 四块田 ----------
const GIANT_DRAW = {
  radish(P) {
    for (let i = 0; i < 7; i++) {
      const a = -Math.PI / 2 + (i - 3) * 0.32,
        h = 15 + (i % 2) * 3;
      P.line(20, 24, 20 + Math.cos(a) * h, 24 + Math.sin(a) * h, L[2]);
      leafBlob(P, 20 + Math.cos(a) * h, 24 + Math.sin(a) * h, 3.2, 4.2, i % 2);
    }
    P.ellipse(20, 33, 14, 9, Cl[1]);
    P.ellipse(19, 32, 12, 7, Cl[2]);
    P.ellipse(15, 30, 4, 2.5, Cl[5]);
    P.line(20, 41, 22, 43, Cl[1]);
    for (const [x, y] of [[26, 35], [11, 34], [23, 38]]) P.set(x, y, Cl[0]);
  },
  potato(P) {
    for (const [dx, dy, r] of [[-9, -18, 4], [6, -20, 4], [-2, -24, 3.6], [11, -15, 3.4], [-13, -13, 3.2]]) leafBlob(P, 20 + dx, 30 + dy, r, r * 0.8, dy < -18 ? 1 : 0);
    for (const [x, y] of [[13, 13], [25, 11]]) {
      P.set(x, y, Cl[5]);
      P.set(x + 1, y, St[4]);
    }
    P.ellipse(20, 33, 15, 9, So[2]);
    P.ellipse(13, 31, 8, 7, So[3]);
    P.ellipse(26, 32, 8, 6.5, So[3]);
    P.ellipse(19, 34, 9, 6, So[3]);
    P.ellipse(14, 29, 3.5, 2, So[4]);
    P.ellipse(25, 30, 3, 1.6, So[4]);
    for (const [x, y] of [[10, 33], [17, 36], [24, 34], [29, 31], [21, 30]]) P.set(x, y, So[1]);
  },
  pumpkin(P) {
    P.line(20, 16, 22, 10, So[2]);
    P.rect(21, 9, 2, 3, So[1]);
    leafBlob(P, 28, 14, 5, 3.4, 1);
    leafBlob(P, 11, 16, 4.4, 3, 0);
    P.line(24, 12, 31, 8, L[3]);
    P.ellipse(20, 31, 17, 12, E[2]);
    P.ellipse(20, 30, 15, 10, E[3]);
    for (const x of [9, 15, 20, 25, 31]) P.vline(x, 21 + Math.abs(20 - x) / 4, 41 - Math.abs(20 - x) / 4, E[2]);
    P.ellipse(14, 25, 4, 2.4, E[4]);
    P.set(13, 24, E[5]);
  },
  corn(P) {
    for (const [x, h] of [[12, 34], [20, 40], [28, 33]]) {
      P.vline(x, 43 - h, 43, L[2]);
      P.vline(x + 1, 45 - h, 43, L[1]);
      for (let k = 1; k < h / 5; k++) {
        const y = 43 - k * 5;
        P.line(x, y, x - 6, y - 4 + (k % 2), L[3]);
        P.line(x + 1, y - 2, x + 7, y - 5, L[4]);
      }
      P.rect(x + 2, 43 - h + 12, 4, 10, St[3]);
      P.vline(x + 2, 43 - h + 12, 43 - h + 21, E[4]);
      P.set(x + 4, 43 - h + 13, St[4]);
      P.vline(x, 43 - h - 3, 43 - h, St[2]);
    }
  },
};
function giantSprite(crop) {
  return cached("btgiant:" + crop, () => {
    const P = new Pix(40, 46);
    (GIANT_DRAW[crop] || GIANT_DRAW.radish)(P);
    P.outline(OUTLINE);
    return P.toCanvas();
  });
}
// ---------- 鸡：两帧（抬头、低头啄） ----------
function chickenSprite(peck) {
  return cached("btchick:" + peck, () => {
    const P = new Pix(10, 9),
      hy = peck ? 4 : 1;
    P.ellipse(4, 5, 3.4, 2.4, Sn[4]);
    P.ellipse(3, 5, 2, 1.4, Sn[2]);
    P.rect(1, 3, 2, 2, Sn[4]);
    P.rect(6, hy, 2, 3, Sn[4]);
    P.set(7, hy - 1, Cl[2]);
    P.set(6, hy - 1, Cl[2]);
    P.set(8, hy + 1, E[4]);
    P.set(7, hy, OUTLINE);
    P.vline(3, 7, 8, E[3]);
    P.vline(5, 7, 8, E[3]);
    P.outline(OUTLINE);
    return P.toCanvas();
  });
}
// ---------- 订单板：贴着几张单子就画几张 ----------
function boardSprite(n) {
  return cached("btboard:" + n, () => {
    const P = new Pix(24, 30);
    P.rect(3, 8, 2, 22, So[2]);
    P.rect(19, 8, 2, 22, So[2]);
    P.vline(3, 8, 29, So[3]);
    P.rect(1, 4, 22, 15, So[1]);
    P.rect(2, 5, 20, 13, St[1]);
    for (let k = 0; k < 6; k++) P.set(3 + ((k * 7) % 18), 6 + ((k * 5) % 11), St[0]);
    P.rect(0, 2, 24, 3, So[3]);
    P.hline(0, 23, 2, So[4]);
    const spots = [
      [3, 7],
      [9, 9],
      [15, 7],
    ];
    for (let i = 0; i < Math.min(3, n); i++) {
      const [x, y] = spots[i];
      P.rect(x, y, 5, 6, Sn[4]);
      P.hline(x + 1, x + 3, y + 2, PAL.stone[2]);
      P.hline(x + 1, x + 3, y + 4, PAL.stone[2]);
      P.set(x + 2, y, Cl[2]);
    }
    P.outline(OUTLINE);
    return P.toCanvas();
  });
}
// ---------- 林姨的菜园：一圈矮篱笆，两垄菜 ----------
registerArt("obj", "btGarden", () => {
  const P = new Pix(40, 24);
  P.rect(2, 8, 36, 14, So[2]);
  for (let y = 10; y < 21; y += 5) P.hline(3, 36, y, So[1]);
  for (let x = 6; x < 36; x += 6) {
    leafBlob(P, x, 11, 2, 1.6, x % 12 ? 1 : 0);
    P.ellipse(x, 13, 1.6, 1, Cl[2]);
    leafBlob(P, x + 2, 17, 2.2, 1.8, x % 12 ? 0 : 1);
  }
  for (let x = 0; x < 40; x += 4) P.rect(x, 5, 1, 18, So[3]);
  P.hline(0, 39, 7, So[4]);
  P.hline(0, 39, 21, So[3]);
  P.rect(30, 0, 8, 6, St[2]);
  P.hline(31, 36, 2, So[1]);
  P.hline(31, 35, 4, So[1]);
  return artDone(P.outline());
});
// ---------- 堆肥桶：木条钉的桶，上面盖着草 ----------
registerArt("build", "compost", () => {
  const P = new Pix(18, 18);
  P.rect(2, 6, 14, 11, So[2]);
  for (let x = 3; x < 16; x += 3) P.vline(x, 6, 16, So[3]);
  P.hline(2, 15, 9, So[1]);
  P.hline(2, 15, 14, So[1]);
  P.ellipse(9, 5, 7, 2.6, L[2]);
  P.ellipse(8, 4, 5, 1.6, L[3]);
  for (const [x, y] of [[4, 4], [12, 3], [9, 2]]) P.set(x, y, St[3]);
  P.set(13, 5, So[4]);
  return artDone(P.outline());
});

export class Renderer extends TidyRenderer {
  // ---------- 巨型作物：画在四块田的正中；其余三块不画 ----------
  drawLivingCrop(plot, e) {
    const gid = e?.bt?.plots[plot?.id]?.gi,
      g = gid ? e.bt.giants[gid] : null;
    if (!g) return super.drawLivingCrop(plot, e);
    if (g.ids[0] !== plot.id) return;
    const sway = this.calm ? 0 : Math.round(Math.sin(this.time * 1.6 + plot.id) * 0.6);
    this.pxShadow?.(plot.x + 20, plot.y + 34, 64);
    this.px(giantSprite(g.crop), plot.x + 20, plot.y + 44, { dx: sway });
  }
  drawFarm(e) {
    super.drawFarm(e);
    if (e?.bt && e.s.region === "farm") this.drawBountyField(e);
  }
  drawBountyField(e) {
    const c = this.ctx,
      bt = e.bt,
      day = e.s.day,
      t = this.time,
      calm = this.calm,
      rect = (x, y, w, h, col, a = 1) => {
        c.globalAlpha = a;
        c.fillStyle = col;
        c.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, w, h);
        c.globalAlpha = 1;
      };
    for (const p of e.s.plots) {
      const r = bt.plots[p.id];
      if (!r || !e.isFarmPlot(p)) continue;
      // 施过的肥：田边一排小点（快长绿、提质金、保水蓝）
      if (r.fz) {
        const col = r.fz === "grow" ? "#9cc46a" : r.fz === "care" ? "#ffd76a" : "#7fb7c9";
        for (let k = 0; k < 5; k++) rect(p.x - 14 + k * 7, p.y + 12, 2, 2, col, 0.9);
      }
      // 田鼠洞：两个黑窟窿
      if (r.mh)
        for (const [dx, dy] of [
          [-13, -12],
          [12, 9],
        ]) {
          rect(p.x + dx - 3, p.y + dy - 2, 6, 4, "#1a120c");
          rect(p.x + dx - 4, p.y + dy - 3, 8, 1, "#6b4a30");
        }
      // 夜里被偷：一串脚印穿过这块田
      if (r.pr && r.pr >= day - 1)
        for (let k = 0; k < 4; k++) {
          const x = p.x - 16 + k * 10,
            y = p.y - 8 + (k % 2) * 8;
          rect(x, y, 4, 6, "#2a1d14", 0.75);
          rect(x + 1, y - 2, 2, 2, "#2a1d14", 0.75);
        }
      // 被踩倒的苗：几道压痕
      if (r.tr === day)
        for (let k = 0; k < 3; k++) {
          rect(p.x - 12 + k * 9, p.y - 4 + k * 3, 10, 2, "#4a3322", 0.8);
          rect(p.x - 10 + k * 9, p.y - 2 + k * 3, 6, 1, "#7a5a3a", 0.8);
        }
    }
    // 田角的怪南瓜（每日抉择“怪南瓜”那天）
    if (bt.pumpkin === day && this.px) {
      this.pxShadow?.(300, 612, 40);
      this.px(giantSprite("pumpkin"), 300, 620);
    }
    // 喷灌头：开着、水网有水的白天，一圈水花
    const m = e.s.minute;
    if (m >= 360 && m < 1200 && bt.net.pool > 0 && !e.rainy?.())
      for (const b of e.s.buildings) {
        if (b.type !== "irrigation" || b.hp <= 0 || bt.net.off.includes(b.id)) continue;
        for (let k = 0; k < 8; k++) {
          const a = (k / 8) * Math.PI * 2 + (calm ? 0 : t * 1.5),
            ph = calm ? 0.5 : (t * 1.2 + k / 8) % 1,
            R = 10 + ph * 26;
          rect(b.x + Math.cos(a) * R, b.y - 24 + Math.sin(a) * R * 0.5 - Math.sin(ph * Math.PI) * 10, 2, 2, "#a9cfbd", 0.7 * (1 - ph));
        }
      }
    // 放进田里的鸡
    const m0 = e.s.minute;
    if (bt.chickens.out && e.absNow() < bt.chickens.until && m0 >= CHICKENS.from && m0 < CHICKENS.to) {
      const coop = e.coop?.();
      const near = coop ? e.s.plots.filter((p) => e.isFarmPlot(p) && Math.hypot(p.x - coop.x, p.y - coop.y) < CHICKENS.r).sort((a, b) => a.id - b.id) : [];
      const n = Math.min(4, near.length);
      for (let k = 0; k < n; k++) {
        const slot = calm ? k : Math.floor(t / 6 + k * 1.7),
          p = near[(slot * 5 + k * 7) % near.length],
          x = p.x + (calm ? 0 : Math.cos(t * 0.8 + k * 2) * 12),
          y = p.y + 4 + (calm ? 0 : Math.sin(t * 1.1 + k) * 6),
          peck = !calm && Math.sin(t * 5 + k * 3) > 0.4;
        this.px(chickenSprite(peck), x, y + 4, { flip: Math.cos(t * 0.8 + k * 2) < 0 });
      }
    }
  }
  // ---------- 订单板、林姨的菜园 ----------
  drawObject(o, e) {
    if (o?.type === "btOrders" && e?.bt) {
      this.pxShadow?.(o.x, o.y, 30);
      this.px(boardSprite(e.bt.orders.list.length), o.x, o.y + 4);
      this.muted?.(() => super.drawObject(o, e));
      return;
    }
    super.drawObject(o, e);
  }
  // ---------- 夜里：夜光豆发光 ----------
  collectLights(e, night) {
    const lights = super.collectLights(e, night);
    if (!e?.bt || e.s.region !== "farm" || night <= 0.05) return lights;
    let n = 0;
    for (const p of e.s.plots) {
      if (p.crop !== "glowBean" || !CROPS.glowBean || p.growth < CROPS.glowBean.grow * 0.5 || n >= 24) continue;
      n++;
      lights.push({ x: p.x, y: p.y - 6, r: p.growth >= CROPS.glowBean.grow ? 56 : 34, color: [150, 235, 200], power: 0.5 });
    }
    return lights;
  }
  // ---------- 光照之后：夜袭的感染者、堆肥桶好了 ----------
  drawNight(e) {
    super.drawNight(e);
    if (!e?.bt || e.s.region !== "farm") return;
    const c = this.ctx;
    c.save();
    for (const z of e.enemies || []) {
      if (!z.btRaid || z.dead) continue;
      const bob = this.calm ? 0 : Math.round(Math.sin(this.time * 4 + z.id) * 1.5) * 2;
      c.fillStyle = "#140f0b";
      c.beginPath();
      c.moveTo(z.x - 7, z.y - 74 + bob);
      c.lineTo(z.x + 7, z.y - 74 + bob);
      c.lineTo(z.x, z.y - 62 + bob);
      c.fill();
      c.fillStyle = "#d2654c";
      c.beginPath();
      c.moveTo(z.x - 5, z.y - 73 + bob);
      c.lineTo(z.x + 5, z.y - 73 + bob);
      c.lineTo(z.x, z.y - 65 + bob);
      c.fill();
    }
    for (const b of e.s.buildings) {
      if (b.type !== "compost" || b.hp <= 0 || !e.bt.compost[b.id]?.out) continue;
      const k = e.bt.compost[b.id];
      const label = (this.v ? this._pixelText : this.text).bind(this);
      label(FERTS[k.kind].name + " ×" + k.out, b.x, b.y - 46, "#cfe7a6", 11);
    }
    c.restore();
  }
}
