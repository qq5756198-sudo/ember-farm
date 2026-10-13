// v0.28.0「热闹」的画面：改良过的设施换个样子（探照灯、双人哨的小旗、捕网、尖刺、铁皮、倒刺、远喷的长嘴、省水的表、
// 双灶的第二口锅、慢火的锅盖、大桶的铜箍、滤网的白布）；药柜、往事陈列柜；空投箱和降落伞；江伯留在池塘边；
// 红薯出门跑商时空着的骡棚；求援来的两位邻居（头上一条血）；手里端着的菜；受伤的人头上一条白绷带；
// 夜里探照灯的光和照出来的装死的。
import { Renderer as BountyRenderer } from "./bounty-renderer.js";
import { PAL, OUTLINE, Pix, cached } from "./pixel-kit.js";
import { registerArt, artDone, buildingArt } from "./pixel-props.js";
import { ITEMS } from "./data.js";
import { ALLY, MULE } from "./bustle-data.js";

const So = PAL.soil,
  St = PAL.straw,
  N = PAL.stone,
  R = PAL.rust,
  W = PAL.water,
  Sn = PAL.snow,
  Cl = PAL.cloth,
  E = PAL.ember;

// ---------- 药柜：白漆木柜，门上一个红十字 ----------
registerArt("build", "medCabinet", () => {
  const P = new Pix(16, 18);
  P.rect(1, 2, 14, 15, Sn[3]);
  P.hline(1, 14, 2, Sn[4]);
  P.vline(8, 3, 16, N[2]);
  P.rect(5, 6, 6, 2, Cl[2]);
  P.rect(7, 4, 2, 6, Cl[2]);
  P.set(6, 12, N[1]);
  P.set(10, 12, N[1]);
  P.rect(2, 17, 2, 1, So[1]);
  P.rect(12, 17, 2, 1, So[1]);
  return artDone(P.outline(OUTLINE));
});
// ---------- 往事陈列柜：木框玻璃柜，里面两张照片、一本日志 ----------
registerArt("build", "hnKeepsake", () => {
  const P = new Pix(16, 20);
  P.rect(1, 1, 14, 18, So[2]);
  P.rect(2, 2, 12, 15, W[1]);
  P.hline(2, 13, 9, So[3]);
  P.rect(3, 4, 4, 4, Sn[3]);
  P.rect(4, 5, 2, 2, N[2]);
  P.rect(9, 3, 4, 5, Sn[4]);
  P.rect(10, 4, 2, 2, E[3]);
  P.rect(4, 11, 7, 4, R[2]);
  P.vline(7, 11, 14, St[3]);
  P.set(12, 12, St[4]);
  P.hline(1, 14, 18, So[1]);
  return artDone(P.outline(OUTLINE));
});

// ---------- 改良：叠在原来那座上面的小件 ----------
const UP_DRAW = {
  light(P) {
    P.rect(1, 2, 7, 5, N[1]);
    P.rect(2, 3, 5, 3, "#fff2b0");
    P.vline(4, 7, 9, N[1]);
  },
  twin(P) {
    P.vline(1, 0, 9, So[1]);
    P.rect(2, 0, 5, 3, W[3]);
    P.set(3, 1, Sn[4]);
  },
  net(P) {
    for (let x = 0; x < 16; x += 3) P.line(x, 0, x + 4, 7, St[4]);
    for (let x = 4; x < 20; x += 3) P.line(x, 0, x - 4, 7, St[3]);
  },
  spike(P) {
    for (const x of [1, 5, 9, 13]) {
      P.vline(x + 1, 1, 6, N[3]);
      P.set(x + 1, 0, Sn[4]);
      P.set(x, 5, N[2]);
      P.set(x + 2, 5, N[2]);
    }
  },
  iron(P) {
    P.rect(0, 0, 12, 8, N[2]);
    P.hline(0, 11, 0, N[3]);
    for (const [x, y] of [[1, 1], [10, 1], [1, 6], [10, 6]]) P.set(x, y, Sn[3]);
  },
  barb(P) {
    for (let x = 0; x < 16; x += 4) {
      P.line(x, 1, x + 3, 4, N[1]);
      P.line(x + 3, 1, x, 4, N[1]);
    }
    P.hline(0, 15, 2, N[2]);
  },
  far(P) {
    P.rect(0, 2, 9, 2, W[2]);
    P.rect(8, 1, 2, 4, W[3]);
    P.set(10, 2, W[4]);
  },
  saver(P) {
    P.disc(3, 3, 3, Sn[3]);
    P.line(3, 3, 5, 1, Cl[2]);
    P.set(3, 3, N[1]);
  },
  twinCook(P) {
    P.rect(0, 2, 8, 5, N[1]);
    P.hline(1, 6, 1, N[2]);
    P.set(2, 0, Sn[3]);
    P.set(5, 0, Sn[3]);
  },
  slow(P) {
    P.rect(0, 1, 10, 2, N[2]);
    P.rect(4, 0, 2, 1, So[2]);
  },
  big(P) {
    P.rect(0, 0, 14, 2, E[3]);
    P.rect(0, 4, 14, 2, E[3]);
  },
  filter(P) {
    P.rect(0, 0, 14, 3, Sn[4]);
    for (const x of [2, 6, 10]) P.set(x, 1, Sn[2]);
  },
};
// 篝火灶的两条路线和瞭望塔的双人哨都叫 twin：画的时候按设施分开
const upKey = (b) => (b.type === "cook" && b.hnUp === "twin" ? "twinCook" : b.hnUp);
function upSprite(key) {
  return cached("hnup:" + key, () => {
    const P = new Pix(20, 10);
    (UP_DRAW[key] || (() => {}))(P);
    P.outline(OUTLINE);
    return P.toCanvas();
  });
}
// 空投箱：一口木箱，上面一顶塌下来的伞
function dropSprite(open) {
  return cached("hndrop:" + open, () => {
    const P = new Pix(22, 22);
    if (!open) {
      P.ellipse(11, 4, 10, 4, Cl[3]);
      P.hline(2, 20, 4, Cl[2]);
      for (const x of [3, 11, 19]) P.line(x, 5, 11, 12, Sn[3]);
    }
    P.rect(5, 12, 12, 9, So[2]);
    P.hline(5, 16, 12, So[3]);
    P.hline(5, 16, 16, So[1]);
    P.vline(11, 12, 20, So[1]);
    P.rect(9, 14, 4, 2, E[4]);
    return P.outline(OUTLINE).toCanvas();
  });
}
// 端着的菜：一只碗
function bowlSprite() {
  return cached("hnbowl", () => {
    const P = new Pix(10, 7);
    P.ellipse(5, 3, 4, 1.5, E[4]);
    P.ellipse(5, 4, 4, 2.4, Sn[3]);
    P.hline(2, 8, 6, Sn[2]);
    return P.outline(OUTLINE).toCanvas();
  });
}

export class Renderer extends BountyRenderer {
  label2(text, x, y, color, size = 11) {
    (this.v ? this._pixelText : this.text).call(this, text, x, y, color, size);
  }
  // ---------- 改良过的设施 ----------
  drawBuilding(b, e) {
    super.drawBuilding(b, e);
    if (!b?.hnUp || b.hp <= 0 || !e?.hn || !this.px) return;
    const art = buildingArt(b.type, b.rotation % 2 === 1, !!b.open),
      h = art ? art.h * 2 : 40,
      top = b.y + 4 - h,
      key = upKey(b),
      spr = upSprite(key);
    let x = b.x,
      y = top + 12;
    if (b.type === "tower") y = top + (key === "light" ? 14 : 18);
    if (b.type === "tower" && key === "twin") x = b.x + 14;
    if (b.type === "trap") y = b.y + 6;
    if (b.type === "fence" || b.type === "gate") y = b.y + 4 - h / 2 + 8;
    if (b.type === "irrigation") y = top + 18;
    if (b.type === "cook") (x = b.x + 18), (y = b.y + 2);
    if (b.type === "rain") y = top + (key === "filter" ? 8 : h * 0.6);
    this.px(spr, x, y, { alpha: key === "net" ? 0.85 : 1 });
  }
  // ---------- 场景里的东西 ----------
  drawObject(o, e) {
    if (o?.type === "hnStove" || o?.type === "hnGuest") return;
    if (o?.type === "hnDrop" && e?.hn) {
      this.pxShadow?.(o.x, o.y, 34);
      if (this.px) this.px(dropSprite(false), o.x, o.y + 4);
      if (Math.hypot(e.s.player.x - o.x, e.s.player.y - o.y) < 260) this.label2("空投箱", o.x, o.y - 52, "#ffd76a", 11);
      return;
    }
    if (o?.type === "hnJiang" && e?.hn) return super.drawObject({ ...o, type: "seasonJiang" }, e);
    if (o?.type === "outpostMule" && e?.hn?.mule.trip) {
      const t = e.hn.mule.trip;
      if (Math.hypot(e.s.player.x - o.x, e.s.player.y - o.y) < 200) this.label2("红薯拉车去" + MULE.dest[t.dest].short + "了（第 " + Math.floor(t.returns / 1440) + " 天回来）", o.x, o.y - 40, "#d8cfb0", 11);
      return;
    }
    return super.drawObject(o, e);
  }
  // ---------- 田间那一层：求援来的邻居 ----------
  drawFarm(e) {
    super.drawFarm(e);
    const h = e?.hn?.help;
    if (!h?.live || e.s.region !== "farm" || !this.personSimple) return;
    for (const a of h.allies) this.personSimple(a.x, a.y, a.look, a.facing ?? Math.PI / 2);
  }
  // ---------- 夜里的光：探照灯 ----------
  collectLights(e, night) {
    const lights = super.collectLights(e, night);
    if (!e?.hn || e.s.region !== "farm" || night <= 0.05) return lights;
    for (const b of e.s.buildings) {
      if (b.type !== "tower" || b.hnUp !== "light" || b.hp <= 0 || !e.mannedTowers?.().has(b.id)) continue;
      lights.push({ x: b.x, y: b.y - 60, r: 110, color: [255, 240, 190], power: 0.55 });
    }
    return lights;
  }
  // ---------- 光照之后：名字、血条、绷带、端着的菜、照出来的装死的 ----------
  drawNight(e) {
    super.drawNight(e);
    if (!e?.hn) return;
    const c = this.ctx;
    c.save();
    if (e.s.region === "farm") {
      // 探照灯照出来的装死的：红圈
      if (e.isNight?.()) {
        const lit = e.s.buildings.filter((b) => b.type === "tower" && b.hnUp === "light" && b.hp > 0 && e.mannedTowers?.().has(b.id));
        if (lit.length)
          for (const z of e.enemies || []) {
            if (!z.lying || z.dead || !lit.some((b) => Math.hypot(b.x - z.x, b.y - z.y) < 320)) continue;
            c.strokeStyle = "#ff6a4a";
            c.lineWidth = 2;
            c.setLineDash?.([4, 3]);
            c.beginPath();
            c.ellipse(z.x, z.y - 4, 22, 9, 0, 0, Math.PI * 2);
            c.stroke();
            c.setLineDash?.([]);
          }
      }
      // 邻居：名字和血条
      const h = e.hn.help;
      if (h.live)
        for (const a of h.allies) {
          const w = 34,
            left = Math.max(0, a.hp / ALLY.hp);
          c.fillStyle = "#1a1410";
          c.fillRect(a.x - w / 2 - 1, a.y - 76, w + 2, 6);
          c.fillStyle = a.down ? "#85857a" : left > 0.4 ? "#9fd38a" : "#d06a58";
          c.fillRect(a.x - w / 2, a.y - 75, w * left, 4);
          this.label2(a.name + (a.down ? "（挂彩）" : ""), a.x, a.y - 84, a.down ? "#c9c3b0" : "#cfe7a6", 11);
        }
      // 受伤的人：头上一条白绷带
      for (const r of e.c.residents) {
        if (!e.isHurt("r:" + r.id) || r.x == null) continue;
        c.fillStyle = "#f6f2e8";
        c.fillRect(r.x - 9, r.y - 70, 18, 5);
        c.fillStyle = "#d06a58";
        c.fillRect(r.x - 2, r.y - 71, 4, 7);
      }
      for (const m of e.o?.crew || []) {
        if (!e.isHurt("c:" + m.id) || m.x == null) continue;
        c.fillStyle = "#f6f2e8";
        c.fillRect(m.x - 9, m.y - 70, 18, 5);
        c.fillStyle = "#d06a58";
        c.fillRect(m.x - 2, m.y - 71, 4, 7);
      }
    }
    // 手里端着的菜
    const carry = e.hn.carry;
    if (carry && this.px) {
      const p = e.s.player;
      this.px(bowlSprite(), p.x, p.y - 78);
      this.label2(ITEMS[carry.dish]?.name || "", p.x, p.y - 96, "#ffe6a0", 11);
    }
    c.restore();
  }
}
