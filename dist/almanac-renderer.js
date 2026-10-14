// v0.29.0「四时」的画面：四个时节的天色（淡淡的一层）；野地里冒出来的野物和蘑菇；废弃居民区里的老果树；
// 腌缸、土酒坛（在腌、能取、陈了各有记号）；嫁接的果树（树苗、长成、挂果）；旧物摆件（二十四样，各画各的）；
// 夜里的好事：卫星残骸、门口的包裹。
import { Renderer as BustleRenderer } from "./bustle-renderer.js";
import { PAL, OUTLINE, Pix, cached } from "./pixel-kit.js";
import { registerArt, artDone } from "./pixel-props.js";
import { ITEMS } from "./data.js";
import { SEASONS, seasonOf, JARS, TREES, TREE_IDS, treeType, DECOR_BY_ID, DECOR_DRAW, MUSHROOM } from "./almanac-data.js";

const So = PAL.soil,
  St = PAL.straw,
  L = PAL.leaf,
  N = PAL.stone,
  R = PAL.rust,
  W = PAL.water,
  Sn = PAL.snow,
  Cl = PAL.cloth,
  E = PAL.ember,
  A = PAL.ash;
const TREE_BY_TYPE = Object.fromEntries(TREE_IDS.map((id) => [treeType(id), id]));
const FRUIT_COLOR = { mulberry: "#3c2348", peach: "#f0a070", apple: "#c8443a", persimmon: "#e8822e" };

// ---------- 腌缸：矮胖的陶缸，盖着木盖压着石头 ----------
registerArt("build", "alPickleJar", () => {
  const P = new Pix(14, 14);
  P.ellipse(7, 9, 6, 4.5, So[2]);
  P.ellipse(6, 8, 4, 3, So[3]);
  P.rect(2, 3, 10, 2, So[1]);
  P.ellipse(7, 3, 5, 1.5, St[1]);
  P.disc(7, 2, 1.6, N[3]);
  P.hline(2, 11, 9, R[1]);
  return artDone(P.outline(OUTLINE));
});
// ---------- 土酒坛：高一点的坛子，红布封口 ----------
registerArt("build", "alWineJar", () => {
  const P = new Pix(14, 16);
  P.ellipse(7, 10, 5.5, 5, So[2]);
  P.ellipse(6, 9, 3.5, 3.5, So[3]);
  P.rect(5, 3, 5, 3, So[2]);
  P.rect(4, 1, 7, 3, Cl[1]);
  P.set(7, 0, Cl[2]);
  P.rect(5, 9, 5, 3, St[3]);
  P.set(7, 10, Cl[0]);
  return artDone(P.outline(OUTLINE));
});
// 嫁接果树放进建设页时用的样子（长成的树）
for (const id of TREE_IDS) registerArt("build", treeType(id), () => treeArt(id, 2, 0));

// 树：stage 0 树苗（插着枝条、缠着布条）、1 长成；fruit 挂几个（每个画两颗）
function treeArt(id, stage, fruit) {
  if (!stage) {
    const P = new Pix(16, 24);
    P.vline(8, 9, 23, So[1]);
    P.rect(6, 20, 5, 4, So[2]);
    P.line(8, 13, 4, 9, So[1]);
    P.line(8, 11, 12, 7, So[1]);
    P.set(4, 8, L[4]);
    P.set(3, 9, L[5]);
    P.set(12, 6, L[4]);
    P.set(13, 7, L[5]);
    P.set(8, 8, L[5]);
    P.rect(7, 16, 3, 2, Sn[3]);
    return artDone(P.outline(OUTLINE));
  }
  const P = new Pix(32, 38),
    crown = id === "persimmon" ? L[2] : id === "peach" ? L[4] : L[3];
  P.rect(14, 22, 4, 16, So[1]);
  P.vline(15, 22, 37, So[2]);
  P.set(13, 37, So[1]);
  P.set(18, 37, So[1]);
  P.line(16, 26, 22, 20, So[1]);
  P.disc(16, 13, 11, crown);
  P.disc(9, 16, 7, L[2]);
  P.disc(23, 16, 7, L[2]);
  P.disc(12, 8, 6, L[4]);
  P.disc(21, 9, 5, L[5]);
  P.disc(16, 19, 6, L[3]);
  const spots = [[8, 14], [23, 12], [16, 19], [12, 6], [25, 18], [7, 20]];
  for (let i = 0; i < Math.min(fruit, 3) * 2; i++) {
    const [x, y] = spots[i];
    P.disc(x, y, 1.6, FRUIT_COLOR[id]);
    P.set(x - 1, y - 1, "#fff2d8");
  }
  return artDone(P.outline(OUTLINE));
}
function treeSprite(id, stage, fruit) {
  return cached("altree:" + id + ":" + stage + ":" + fruit, () => treeArt(id, stage, fruit).canvas);
}
// 居民区里的老果树：比嫁接的大一圈、歪着长，树干裂开，枝上挂果，地上落着几个
function oldTreeSprite(id) {
  return cached("aloldtree:" + id, () => {
    const P = new Pix(44, 50);
    P.rect(19, 28, 7, 21, So[1]);
    P.vline(21, 28, 48, So[2]);
    P.line(22, 34, 31, 24, So[1]);
    P.line(21, 32, 12, 25, So[1]);
    P.set(20, 36, A[1]);
    P.set(21, 39, A[1]);
    P.set(23, 42, A[1]);
    P.set(17, 48, So[1]);
    P.set(27, 48, So[1]);
    P.disc(22, 16, 14, L[2]);
    P.disc(12, 20, 9, L[1]);
    P.disc(33, 19, 9, L[2]);
    P.disc(17, 9, 7, L[3]);
    P.disc(29, 10, 6, L[3]);
    P.disc(22, 22, 7, L[2]);
    for (const [x, y] of [[11, 17], [30, 15], [22, 22], [17, 8], [34, 22], [26, 6]]) {
      P.disc(x, y, 1.6, FRUIT_COLOR[id]);
      P.set(x - 1, y - 1, "#fff2d8");
    }
    for (const [x, y] of [[10, 47], [33, 46], [29, 48]]) P.disc(x, y, 1.2, FRUIT_COLOR[id]);
    return P.outline(OUTLINE).toCanvas();
  });
}
// 野物：长在地上的一小丛（野菜、野莓、栗子、柿子、蘑菇）
const FORAGE_LOOK = {
  alShepherd: (P) => {
    for (const [x, y] of [[3, 7], [6, 6], [9, 7], [5, 8], [8, 8]]) P.ellipse(x, y, 2, 1, L[4]);
    P.set(6, 4, Sn[4]);
    P.set(7, 3, Sn[4]);
  },
  alPurslane: (P) => {
    P.line(2, 9, 10, 5, R[2]);
    for (const [x, y] of [[3, 8], [5, 7], [7, 6], [9, 5], [6, 8]]) P.disc(x, y, 1, L[4]);
  },
  alBerry: (P) => {
    P.disc(6, 6, 4, L[2]);
    for (const [x, y] of [[4, 5], [7, 4], [8, 7], [5, 8]]) P.disc(x, y, 1, Cl[1]);
  },
  alChestnut: (P) => {
    for (const [x, y] of [[3, 8], [7, 7], [10, 8]]) {
      P.ellipse(x, y, 2, 1.5, So[2]);
      P.set(x, y - 1, So[3]);
    }
    P.set(5, 6, L[2]);
  },
  alJujube: (P) => {
    for (const [x, y] of [[3, 8], [6, 7], [9, 8], [7, 9]]) P.ellipse(x, y, 1.5, 1.2, Cl[0]);
    P.set(5, 6, L[3]);
  },
  alFrostPersimmon: (P) => {
    P.vline(6, 1, 6, So[1]);
    P.ellipse(4, 7, 2.5, 2, E[3]);
    P.ellipse(9, 6, 2.5, 2, E[3]);
    P.set(4, 6, Sn[4]);
    P.set(9, 5, Sn[4]);
  },
  alMushroomRaw: (P) => {
    P.ellipse(4, 5, 3, 2, N[3]);
    P.rect(3, 6, 2, 3, Sn[2]);
    P.ellipse(9, 6, 2.5, 1.6, Sn[3]);
    P.rect(8, 7, 2, 2, Sn[2]);
    P.set(2, 4, E[4]);
  },
};
function forageSprite(item) {
  return cached("alforage:" + item, () => {
    const P = new Pix(12, 10);
    (FORAGE_LOOK[item] || FORAGE_LOOK.alShepherd)(P);
    return P.outline(OUTLINE).toCanvas();
  });
}
// 卫星残骸：烧黑的金属板，冒着一点烟色
registerArt("obj", "alDebris", () => {
  const P = new Pix(22, 14);
  P.ellipse(11, 10, 10, 3.5, A[1]);
  P.poly([[4, 9], [12, 3], [19, 6], [16, 11], [6, 12]], N[2]);
  P.poly([[8, 8], [12, 5], [15, 7], [11, 10]], N[3]);
  P.rect(13, 4, 6, 2, W[3]);
  P.set(17, 4, Sn[4]);
  P.line(5, 10, 3, 7, E[3]);
  return artDone(P.outline(OUTLINE));
});
// 门口的包裹：麻绳捆着的纸箱
registerArt("obj", "alParcel", () => {
  const P = new Pix(12, 11);
  P.rect(1, 3, 10, 7, St[2]);
  P.rect(1, 3, 10, 2, St[3]);
  P.vline(6, 3, 9, So[1]);
  P.hline(1, 10, 6, So[1]);
  P.set(6, 2, So[1]);
  P.set(5, 1, So[1]);
  P.set(7, 1, So[1]);
  return artDone(P.outline(OUTLINE));
});
function decorSprite(id) {
  return cached("aldecor:" + id, () => {
    const P = new Pix(16, 16);
    (DECOR_DRAW[id] || DECOR_DRAW.potted)(P);
    return P.outline(OUTLINE).toCanvas();
  });
}
// 缸上的记号：在腌（小泡泡）、能取（金点）、陈了（红点）
function jarMark(state) {
  return cached("aljarmark:" + state, () => {
    const P = new Pix(6, 6);
    if (state === "brewing") {
      P.disc(2, 3, 1, W[5]);
      P.disc(4, 1, 0.8, W[5]);
    } else {
      P.disc(3, 3, 2, state === "aged" ? Cl[1] : E[5]);
      P.set(2, 2, "#fff6d0");
    }
    return P.outline(OUTLINE).toCanvas();
  });
}

export class Renderer extends BustleRenderer {
  // ---------- 天色：四个时节各一层很淡的颜色 ----------
  tintAmbient(amb, e) {
    const base = (super.tintAmbient && super.tintAmbient(amb, e)) || amb;
    if (!e?.al) return base;
    const t = seasonOf(e.s.day).tint;
    return base.map((v, i) => Math.max(0, Math.min(255, Math.round(v * t[i]))));
  }
  // ---------- 场景里的东西 ----------
  drawObject(o, e) {
    if (e?.al && this.v) {
      const p = e.s.player,
        near = Math.hypot(p.x - o.x, p.y - o.y) < 150;
      if (o.type === "alForage") {
        this.pxShadow?.(o.x, o.y, 14);
        this.px(forageSprite(o.item), o.x, o.y + 3);
        if (near) this.label2(ITEMS[o.item]?.name || "", o.x, o.y - 26, o.item === MUSHROOM.raw ? "#f3b4a5" : "#e4f0a8", 11);
        return;
      }
      if (o.type === "alOldTree") {
        this.pxShadow?.(o.x, o.y, 60);
        this.px(oldTreeSprite(o.tree), o.x, o.y + 4);
        if (near) this.label2("老" + TREES[o.tree].name, o.x, o.y - 106, "#cfe7a6", 11);
        return;
      }
    }
    return super.drawObject(o, e);
  }
  drawBuilding(b, e) {
    const tree = TREE_BY_TYPE[b?.type];
    if (e?.al && this.v && (tree || b.type === "alDecor")) {
      const broken = b.hp <= 0,
        p = e.s.player,
        near = Math.hypot(p.x - b.x, p.y - b.y) < 90;
      if (tree) {
        const rec = e.al.trees[b.id],
          grown = rec && e.s.day - rec.planted >= 14,
          spr = treeSprite(tree, grown ? 1 : 0, grown ? rec.fruit || 0 : 0);
        this.pxShadow(b.x, b.y, grown ? 50 : 18);
        this.px(spr, b.x, b.y + 4, { alpha: broken ? 0.45 : 1 });
        if (near) this.label2(TREES[tree].name + (grown && rec?.fruit ? " ×" + rec.fruit : ""), b.x, b.y - (grown ? 82 : 52), "#cfe7a6", 11);
        return;
      }
      const d = DECOR_BY_ID[b.decor];
      this.pxShadow(b.x, b.y, 22);
      this.px(decorSprite(b.decor || "potted"), b.x, b.y + 4, { alpha: broken ? 0.45 : 1 });
      if (near && d) this.label2(d.name, b.x, b.y - 40, "#e9dcc0", 11);
      return;
    }
    super.drawBuilding(b, e);
    if (e?.al && this.v && JARS[b?.type] && b.hp > 0) {
      const st = e.jarState?.(b.id)?.state;
      if (st && st !== "empty") this.px(jarMark(st), b.x + 12, b.y - 22);
    }
  }
}
