// 新画面的小图：人物（四个方向、走路 4 帧、干活）、作物（四个阶段）、耕地、杂物堆、影子、状态小图标。
// 每张小图都按美术像素画（1 像素 = 地图 2×2），画一次存起来。
import { PAL, OUTLINE, Pix, cached, rng, seedOf, mix, hash2, dither } from "./pixel-kit.js";

const canvasOf = (P) => P.toCanvas();

// ---------- 影子 ----------
export function shadowSprite(rx, ry = Math.max(2, Math.round(rx * 0.32))) {
  return cached(`shadow:${rx}:${ry}`, () => {
    const P = new Pix(rx * 2 + 2, ry * 2 + 2);
    P.ellipse(rx + 1, ry + 1, rx, ry, "#140f0b", 0.38);
    P.ellipse(rx + 1, ry + 1, rx - 1.2, ry - 0.8, "#140f0b", 0.18);
    return canvasOf(P);
  });
}

// ---------- 人物 ----------
const HAIR = [PAL.ash[1], PAL.soil[1], PAL.soil[2], PAL.straw[2], PAL.stone[4], PAL.ember[1], PAL.ash[3]];
const TOPS = [
  [PAL.leaf[2], PAL.leaf[1], PAL.leaf[3]],
  [PAL.cloth[3], PAL.night[1], PAL.cloth[4]],
  [PAL.cloth[1], PAL.cloth[0], PAL.cloth[2]],
  [PAL.straw[1], PAL.straw[0], PAL.straw[2]],
  [PAL.water[2], PAL.water[1], PAL.water[3]],
  [PAL.rust[2], PAL.rust[1], PAL.rust[3]],
  [PAL.stone[3], PAL.stone[2], PAL.stone[4]],
];
const PANTS = [[PAL.night[2], PAL.night[1]], [PAL.soil[1], PAL.soil[0]], [PAL.stone[2], PAL.stone[1]], [PAL.leaf[1], PAL.leaf[0]]];

// 主角：乱蓬蓬的棕发、红围巾、橄榄色夹克、背包
export const PLAYER_LOOK = {
  skin: PAL.skin[2],
  skinDark: PAL.skin[1],
  hair: PAL.soil[1],
  hairLight: PAL.soil[2],
  style: "messy",
  top: TOPS[0],
  pants: PANTS[0],
  boots: [PAL.soil[0], PAL.ash[1]],
  scarf: [PAL.cloth[1], PAL.cloth[0]],
  bag: [PAL.soil[2], PAL.soil[1]],
};
// 按名字或身份给每个人一套固定的长相
export function lookFor(key, role = null) {
  const r = rng(seedOf(key)),
    pick = (a) => a[Math.floor(r() * a.length)];
  const skin = Math.floor(r() * 3);
  const look = {
    skin: PAL.skin[skin + 1],
    skinDark: PAL.skin[skin],
    hair: pick(HAIR),
    style: pick(["short", "long", "bun", "short", "bald"]),
    top: pick(TOPS),
    pants: pick(PANTS),
    boots: [PAL.ash[1], PAL.ash[0]],
    scarf: r() > 0.7 ? [pick([PAL.ember[3], PAL.cloth[2], PAL.water[3]]), PAL.ash[2]] : null,
    bag: null,
    hat: r() > 0.75 ? pick(["cap", "straw", "beanie"]) : null,
  };
  look.hairLight = mix(look.hair, "#ffffff", 0.18);
  if (role === "farmer") Object.assign(look, { hat: "straw", top: TOPS[3] });
  if (role === "mechanic") Object.assign(look, { hat: "cap", top: TOPS[1], pants: PANTS[0] });
  if (role === "medic") Object.assign(look, { top: [PAL.cloth[5], PAL.stone[4], "#f6f0de"], hat: null });
  if (role === "guard") Object.assign(look, { hat: "helmet", top: TOPS[0], pants: PANTS[3] });
  if (role === "trader") Object.assign(look, { bag: [PAL.straw[1], PAL.straw[0]], hat: "straw" });
  if (role === "helper") Object.assign(look, { hat: "hardhat", vest: [PAL.ember[3], PAL.straw[4]], top: TOPS[1] });
  if (role === "raider") Object.assign(look, { hat: "hood", top: [PAL.ash[2], PAL.ash[1], PAL.ash[3]], mask: PAL.ash[0], pants: PANTS[2], scarf: null });
  if (role === "elder") Object.assign(look, { hair: PAL.stone[4], hairLight: PAL.stone[5], style: "short", hat: "straw" });
  // 同一个人换了活计（种地→站岗）长相要跟着换，画好的小图按这个区分
  look.sig = role || "";
  return look;
}

// dir: down / up / side（朝右，朝左时翻转）；frame 0–3；pose: walk / work / idle
// 画布 22×34，脚底在第 32 行；头顶约在地图上方 60 个单位处，和原来的人物一样高。
export const PERSON_W = 22,
  PERSON_H = 34;
function drawPerson(L, dir, frame, pose) {
  const P = new Pix(PERSON_W, PERSON_H),
    cx = 11,
    feet = 32,
    walk = pose === "walk" || pose === "reach",
    bob = walk && (frame === 1 || frame === 3) ? 1 : 0,
    top = 3 + bob + (L.hunch ? 1 : 0);
  const [tc, td, tl] = L.top,
    [pc, pd] = L.pants,
    skin = L.skin;
  const bodyTop = top + 11,
    legTop = feet - 7;
  // ---- 腿 ----
  if (dir === "side") {
    const fwd = walk ? [0, 2, 0, -2][frame] : 0;
    P.rect(cx - 2 - fwd, legTop, 3, 6, pd);
    P.rect(cx - 2 - fwd, feet - 1, 4, 2, L.boots[1]);
    P.rect(cx - 1 + fwd, legTop, 3, 6, pc);
    P.rect(cx - 1 + fwd, feet - 1, 4, 2, L.boots[0]);
  } else {
    const lift = walk ? [0, 1, 0, -1][frame] : 0,
      l = Math.max(0, lift),
      r = Math.max(0, -lift);
    P.rect(cx - 4, legTop, 4, 6 - l, pc);
    P.rect(cx + 1, legTop, 4, 6 - r, pc);
    P.vline(cx - 1, legTop, feet - 2 - l, pd);
    P.vline(cx + 4, legTop, feet - 2 - r, pd);
    P.rect(cx - 4, feet - 1 - l, 4, 2, L.boots[0]);
    P.rect(cx + 1, feet - 1 - r, 4, 2, L.boots[0]);
    P.hline(cx - 4, cx - 1, feet - l, L.boots[1]);
    P.hline(cx + 1, cx + 4, feet - r, L.boots[1]);
  }
  // ---- 身体 ----
  const bw = dir === "side" ? 8 : 12,
    bx = cx - Math.floor(bw / 2) + (dir === "side" ? 0 : 0);
  P.rect(bx, bodyTop, bw, legTop - bodyTop + 1, tc);
  P.vline(bx, bodyTop + 1, legTop, tl);
  P.vline(bx + bw - 1, bodyTop + 1, legTop, td);
  P.hline(bx + 1, bx + bw - 2, bodyTop, tl);
  P.hline(bx, bx + bw - 1, legTop, td);
  if (dir === "down") {
    P.vline(cx, bodyTop + 2, legTop - 1, td);
    P.set(cx - 2, bodyTop + 5, td);
    P.set(cx + 2, bodyTop + 5, td);
  }
  if (L.vest) {
    const v = L.vest;
    if (dir === "down") {
      P.rect(bx + 1, bodyTop + 1, 3, legTop - bodyTop - 1, v[0]);
      P.rect(bx + bw - 4, bodyTop + 1, 3, legTop - bodyTop - 1, v[0]);
      P.hline(bx + 1, bx + bw - 2, bodyTop + 6, v[1]);
    } else if (dir === "up") {
      P.rect(bx + 1, bodyTop + 1, bw - 2, legTop - bodyTop - 1, v[0]);
      P.hline(bx + 1, bx + bw - 2, bodyTop + 6, v[1]);
    } else {
      P.rect(bx + 1, bodyTop + 1, bw - 2, legTop - bodyTop - 1, v[0]);
      P.hline(bx + 1, bx + bw - 2, bodyTop + 6, v[1]);
    }
  }
  P.hline(bx, bx + bw - 1, legTop - 1, L.belt || PAL.soil[0]);
  // ---- 背包 ----
  if (L.bag) {
    if (dir === "up") {
      P.rect(cx - 4, bodyTop + 1, 9, 8, L.bag[0]);
      P.hline(cx - 4, cx + 4, bodyTop + 1, mix(L.bag[0], "#ffffff", 0.2));
      P.hline(cx - 4, cx + 4, bodyTop + 8, L.bag[1]);
      P.rect(cx - 2, bodyTop + 4, 5, 2, L.bag[1]);
    } else if (dir === "side") {
      P.rect(cx - 7, bodyTop + 1, 3, 8, L.bag[0]);
      P.vline(cx - 7, bodyTop + 1, bodyTop + 8, L.bag[1]);
    } else {
      P.vline(cx - 4, bodyTop, bodyTop + 6, L.bag[1]);
      P.vline(cx + 4, bodyTop, bodyTop + 6, L.bag[1]);
    }
  }
  // ---- 手臂 ----
  const swing = walk ? [0, 1, 0, -1][frame] : 0;
  if (pose === "work") {
    if (dir === "side") {
      P.rect(cx, bodyTop + 2, 6, 3, td);
      P.rect(cx + 6, bodyTop + 2, 2, 3, skin);
    } else if (dir === "down") {
      P.rect(bx - 1, bodyTop + 1, 3, 5, td);
      P.rect(bx + bw - 2, bodyTop + 1, 3, 5, td);
      P.rect(cx - 2, bodyTop + 5, 5, 2, skin);
    } else {
      P.rect(bx - 1, bodyTop + 1, 3, 5, td);
      P.rect(bx + bw - 2, bodyTop + 1, 3, 5, td);
    }
  } else if (pose === "reach" && dir !== "up") {
    // 感染者：两只手往前伸着
    if (dir === "side") {
      P.rect(cx + 1, bodyTop + 2, 7, 2, td);
      P.rect(cx + 8, bodyTop + 2 + (swing > 0 ? 1 : 0), 2, 2, skin);
      P.rect(cx, bodyTop + 5, 6, 2, tc);
      P.rect(cx + 6, bodyTop + 5 + (swing < 0 ? 1 : 0), 2, 2, L.skinDark);
    } else {
      P.rect(bx - 1, bodyTop + 1, 3, 4, td);
      P.rect(bx + bw - 2, bodyTop + 1, 3, 4, td);
      P.rect(bx, bodyTop + 4 + Math.max(0, swing), 3, 4, tl);
      P.rect(bx + bw - 3, bodyTop + 4 + Math.max(0, -swing), 3, 4, td);
      P.rect(bx, bodyTop + 8 + Math.max(0, swing), 3, 2, skin);
      P.rect(bx + bw - 3, bodyTop + 8 + Math.max(0, -swing), 3, 2, L.skinDark);
    }
  } else if (dir === "side") {
    P.rect(cx - 1 + swing, bodyTop + 1, 3, 7, td);
    P.rect(cx - 1 + swing * 2, bodyTop + 8, 3, 2, skin);
  } else {
    P.rect(bx - 2, bodyTop + 1 + Math.max(0, swing), 2, 7, dir === "down" ? tl : td);
    P.rect(bx + bw, bodyTop + 1 + Math.max(0, -swing), 2, 7, td);
    P.rect(bx - 2, bodyTop + 8 + Math.max(0, swing), 2, 2, skin);
    P.rect(bx + bw, bodyTop + 8 + Math.max(0, -swing), 2, 2, L.skinDark);
  }
  // ---- 头 ----
  const hx = cx - 5,
    hy = top;
  P.rect(hx, hy + 1, 10, 9, skin);
  P.rect(hx + 1, hy, 8, 1, skin);
  P.hline(hx + 1, hx + 8, hy + 10, L.skinDark);
  P.vline(hx + 9, hy + 2, hy + 9, L.skinDark);
  const hair = L.hair,
    hl = L.hairLight || hair;
  if (L.style !== "bald" || dir === "up") {
    P.rect(hx, hy - 1, 10, 3, hair);
    P.rect(hx + 1, hy - 2, 8, 1, hair);
    P.hline(hx + 2, hx + 6, hy - 1, hl);
    P.set(hx + 3, hy, hl);
    if (dir === "up") {
      P.rect(hx, hy, 10, 9, hair);
      P.hline(hx + 2, hx + 7, hy + 2, hl);
    } else if (dir === "side") {
      P.rect(hx, hy, 5, 8, hair);
      P.set(hx + 5, hy + 2, hair);
      P.set(hx + 2, hy + 1, hl);
    } else {
      P.vline(hx, hy, hy + 6, hair);
      P.vline(hx + 9, hy, hy + 6, hair);
      P.set(hx + 1, hy + 2, hair);
      P.set(hx + 8, hy + 2, hair);
      P.set(hx + 4, hy + 2, hair);
    }
    if (L.style === "messy") {
      P.set(hx - 1, hy, hair);
      P.set(hx + 10, hy + 1, hair);
      P.set(hx + 3, hy - 3, hair);
      P.set(hx + 7, hy - 3, hair);
      P.set(hx - 1, hy + 3, hair);
    }
    if (L.style === "long") {
      if (dir === "side") P.rect(hx - 1, hy + 2, 3, 10, hair);
      else {
        P.vline(hx - 1, hy + 2, hy + 12, hair);
        P.vline(hx + 10, hy + 2, hy + 12, hair);
        if (dir === "up") P.rect(hx, hy + 9, 10, 3, hair);
      }
    }
    if (L.style === "bun") {
      P.rect(hx + 3, hy - 5, 4, 3, hair);
      P.set(hx + 4, hy - 5, hl);
    }
  }
  // ---- 脸 ----
  if (L.eyes && dir === "down") {
    P.rect(hx + 2, hy + 5, 2, 1, L.eyes);
    P.rect(hx + 6, hy + 5, 2, 1, L.eyes);
    P.set(hx + 2, hy + 4, L.skinDark);
    P.set(hx + 7, hy + 4, L.skinDark);
    if (L.mouth) {
      P.rect(hx + 3, hy + 7, 4, 3, PAL.ash[0]);
      P.set(hx + 4, hy + 9, PAL.cloth[1]);
    } else P.hline(hx + 3, hx + 6, hy + 8, PAL.ash[1]);
  } else if (L.eyes && dir === "side") {
    P.rect(hx + 7, hy + 5, 2, 1, L.eyes);
    if (L.mouth) P.rect(hx + 8, hy + 7, 2, 3, PAL.ash[0]);
    else P.set(hx + 8, hy + 8, PAL.ash[1]);
  } else if (dir === "down") {
    P.rect(hx + 2, hy + 5, 1, 2, OUTLINE);
    P.rect(hx + 7, hy + 5, 1, 2, OUTLINE);
    P.set(hx + 2, hy + 4, mix(hair, skin, 0.3));
    P.set(hx + 7, hy + 4, mix(hair, skin, 0.3));
    P.set(hx + 1, hy + 7, mix(skin, PAL.cloth[2], 0.35));
    P.set(hx + 8, hy + 7, mix(skin, PAL.cloth[2], 0.35));
    P.hline(hx + 4, hx + 5, hy + 8, L.skinDark);
  } else if (dir === "side") {
    P.rect(hx + 7, hy + 5, 1, 2, OUTLINE);
    P.set(hx + 10, hy + 6, skin);
    P.set(hx + 8, hy + 8, L.skinDark);
  }
  // ---- 帽子 ----
  if (L.hat === "straw") {
    P.rect(hx - 2, hy + 1, 14, 1, PAL.straw[1]);
    P.rect(hx, hy - 2, 10, 3, PAL.straw[3]);
    P.hline(hx + 1, hx + 8, hy - 2, PAL.straw[4]);
    P.hline(hx, hx + 9, hy, PAL.cloth[1]);
  } else if (L.hat === "cap") {
    P.rect(hx, hy - 2, 10, 3, L.top[1]);
    P.hline(hx + 1, hx + 8, hy - 2, L.top[0]);
    if (dir === "down") P.rect(hx + 1, hy + 1, 8, 1, L.top[1]);
    if (dir === "side") P.rect(hx + 7, hy + 1, 4, 1, L.top[1]);
  } else if (L.hat === "beanie") {
    P.rect(hx, hy - 2, 10, 3, PAL.ember[2]);
    P.hline(hx, hx + 9, hy, PAL.ember[1]);
    P.set(hx + 5, hy - 3, PAL.ember[3]);
  } else if (L.hat === "helmet") {
    P.rect(hx - 1, hy - 2, 12, 4, PAL.leaf[1]);
    P.hline(hx - 1, hx + 10, hy - 2, PAL.leaf[3]);
  } else if (L.hat === "hardhat") {
    P.rect(hx - 1, hy - 3, 12, 4, PAL.ember[4]);
    P.hline(hx, hx + 9, hy - 3, PAL.ember[5]);
    P.hline(hx - 2, hx + 11, hy + 1, PAL.ember[3]);
  } else if (L.hat === "hood") {
    P.rect(hx - 1, hy - 2, 12, 6, L.top[1]);
    if (dir !== "up") P.rect(hx + 1, hy + 3, 8, 2, L.top[1]);
    if (dir === "up") P.rect(hx - 1, hy + 2, 12, 8, L.top[1]);
  }
  if (L.hat === "riot") {
    P.rect(hx - 1, hy - 2, 12, 8, PAL.night[1]);
    P.hline(hx, hx + 9, hy - 2, PAL.night[3]);
    if (dir === "down") {
      P.rect(hx + 1, hy + 2, 8, 3, PAL.water[1]);
      P.hline(hx + 1, hx + 4, hy + 2, PAL.water[3]);
    } else if (dir === "side") {
      P.rect(hx + 5, hy + 2, 5, 3, PAL.water[1]);
      P.set(hx + 6, hy + 2, PAL.water[3]);
    }
  }
  if (L.mask && dir !== "up") P.rect(hx + (dir === "side" ? 5 : 1), hy + 7, dir === "side" ? 5 : 8, 3, L.mask);
  // ---- 围巾 ----
  if (L.scarf) {
    P.rect(cx - 5, bodyTop - 1, 11, 2, L.scarf[0]);
    P.hline(cx - 5, cx + 5, bodyTop, L.scarf[1]);
    if (dir === "down") P.rect(cx + 1, bodyTop + 1, 2, 4, L.scarf[0]);
    if (dir === "up") P.rect(cx - 1, bodyTop + 1, 2, 5, L.scarf[0]);
    if (dir === "side") P.rect(cx - 6, bodyTop, 2, 4 + (walk ? frame % 2 : 0), L.scarf[0]);
  }
  if (L.blood) {
    const r = rng(seedOf(L.bloodSeed || "z") + frame);
    for (let i = 0; i < L.blood; i++) {
      const x = cx - 5 + Math.floor(r() * 11),
        y = bodyTop + Math.floor(r() * (legTop - bodyTop + 3));
      if (P.opaque(x, y)) P.set(x, y, r() > 0.5 ? PAL.cloth[0] : PAL.rust[0]);
      if (r() > 0.6 && P.opaque(x, y + 1)) P.set(x, y + 1, PAL.cloth[0]);
    }
  }
  P.outline(OUTLINE);
  return P;
}
export function personSprite(look, key, dir, frame, pose) {
  return cached(`person:${key}:${look.sig || ""}:${dir}:${frame}:${pose}`, () => canvasOf(drawPerson(look, dir, frame, pose)));
}
export const dirFromAngle = (a) => {
  if (a >= Math.PI / 4 && a < (Math.PI * 3) / 4) return { dir: "down", flip: false };
  if (a < -Math.PI / 4 && a > (-Math.PI * 3) / 4) return { dir: "up", flip: false };
  if (a >= -Math.PI / 4 && a <= Math.PI / 4) return { dir: "side", flip: false };
  return { dir: "side", flip: true };
};

// ---------- 耕地 ----------
export function soilSprite(wet, variant = 0) {
  return cached(`soil:${wet ? 1 : 0}:${variant}`, () => {
    const P = new Pix(20, 20),
      ramp = wet ? [PAL.soil[0], "#2e1d14", PAL.soil[1]] : [PAL.soil[1], PAL.soil[0], PAL.soil[2]];
    for (let y = 0; y < 20; y++)
      for (let x = 0; x < 20; x++) {
        // 圆角、边缘不整齐
        const edge = (x === 0 || x === 19 || y === 0 || y === 19) && hash2(x, y, variant + 3) > 0.45;
        const corner = (x < 1 || x > 18) && (y < 1 || y > 18);
        if (edge || corner) continue;
        const row = y % 5;
        let c = row === 4 ? ramp[1] : row === 0 ? ramp[2] : ramp[0];
        if (hash2(x, y, variant) > 0.9) c = ramp[row === 4 ? 0 : 1];
        P.set(x, y, c);
      }
    if (wet) for (let i = 0; i < 6; i++) P.set(2 + Math.floor(hash2(i, variant, 4) * 16), 1 + Math.floor(hash2(i, variant, 5) * 4) * 5, PAL.water[2], 0.8);
    else for (let i = 0; i < 5; i++) P.set(2 + Math.floor(hash2(i, variant, 6) * 16), 2 + Math.floor(hash2(i, variant, 7) * 16), PAL.soil[3]);
    return canvasOf(P);
  });
}

// ---------- 作物 ----------
// stage 0 刚冒芽、1 小苗、2 长大、3 成熟
function leafBlob(P, x, y, w, h, light = 0) {
  const lt = [PAL.leaf[3], PAL.leaf[4], PAL.leaf[5]];
  P.ellipse(x, y, w, h, PAL.leaf[2]);
  P.ellipse(x - 0.5, y - 0.6, Math.max(0.5, w - 1), Math.max(0.5, h - 1), lt[Math.min(2, 1 + light)]);
  P.set(x - Math.round(w / 2), y - Math.round(h / 2), lt[2]);
}
function sprout(P, cx, base) {
  P.vline(cx, base - 4, base, PAL.leaf[2]);
  P.set(cx - 1, base - 4, PAL.leaf[4]);
  P.set(cx - 2, base - 5, PAL.leaf[4]);
  P.set(cx + 1, base - 5, PAL.leaf[5]);
  P.set(cx + 2, base - 5, PAL.leaf[4]);
  P.set(cx - 1, base, PAL.soil[2]);
  P.set(cx + 1, base, PAL.soil[2]);
}
const CROP_DRAW = {
  radish(P, cx, b, s) {
    const n = s === 1 ? 3 : 5,
      h = s === 1 ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.55;
      P.line(cx, b - 1, cx + Math.cos(a) * h * 0.8, b - 1 + Math.sin(a) * h, PAL.leaf[2]);
      leafBlob(P, cx + Math.cos(a) * h * 0.9, b - 1 + Math.sin(a) * h, 1.6, 2.2, i % 2);
    }
    if (s >= 2) {
      const red = s === 3 ? PAL.cloth[2] : mix(PAL.cloth[2], PAL.cloth[5], 0.5);
      P.ellipse(cx, b, 3, 2, red);
      P.set(cx - 1, b - 1, PAL.cloth[5]);
      if (s === 3) P.set(cx + 1, b + 1, PAL.cloth[1]);
    }
  },
  potato(P, cx, b, s) {
    const r = s === 1 ? 3 : 5;
    for (const [dx, dy] of [[-r * 0.7, -2], [r * 0.7, -2], [0, -r], [-r * 0.4, -r * 0.6], [r * 0.5, -r * 0.9]]) leafBlob(P, cx + dx, b + dy - 1, 2.4, 2, dy < -3 ? 1 : 0);
    if (s >= 2) for (const [dx, dy] of [[-2, -r - 2], [3, -r - 1]]) {
      P.set(cx + dx, b + dy, PAL.cloth[5]);
      P.set(cx + dx + 1, b + dy, PAL.straw[4]);
    }
    if (s === 3) for (const dx of [-4, 3]) {
      P.ellipse(cx + dx, b + 1, 2, 1.2, PAL.soil[3]);
      P.set(cx + dx - 1, b, PAL.soil[4]);
    }
  },
  tomato(P, cx, b, s) {
    const h = s === 1 ? 7 : 13;
    if (s >= 2) {
      P.vline(cx + 3, b - h - 1, b, PAL.soil[2]);
      P.set(cx + 3, b - h - 2, PAL.soil[3]);
    }
    P.line(cx, b, cx - 1, b - h, PAL.leaf[1]);
    for (let k = 1; k <= (s === 1 ? 2 : 4); k++) {
      leafBlob(P, cx - 3, b - k * 3, 2.2, 1.6, k % 2);
      leafBlob(P, cx + 2, b - k * 3 - 1, 2.2, 1.6, (k + 1) % 2);
    }
    if (s >= 2)
      for (const [dx, dy] of [[-3, -5], [2, -8], [-2, -11]]) {
        const col = s === 3 ? PAL.cloth[1] : PAL.leaf[4];
        P.disc(cx + dx, b + dy, 1.6, col);
        P.set(cx + dx - 1, b + dy - 1, s === 3 ? PAL.cloth[2] : PAL.leaf[5]);
      }
  },
  bean(P, cx, b, s) {
    const h = s === 1 ? 8 : 16;
    if (s >= 2) {
      P.line(cx - 4, b, cx, b - h - 2, PAL.soil[2]);
      P.line(cx + 4, b, cx, b - h - 2, PAL.soil[2]);
    }
    for (let k = 0; k < (s === 1 ? 2 : 5); k++) {
      const y = b - 2 - k * 3,
        side = k % 2 ? 1 : -1;
      P.set(cx + side, y, PAL.leaf[2]);
      leafBlob(P, cx + side * 3, y, 2, 1.5, k % 2);
    }
    if (s >= 2)
      for (const [dx, dy] of [[-3, -6], [3, -9], [-2, -12]]) {
        P.vline(cx + dx, b + dy, b + dy + (s === 3 ? 4 : 2), s === 3 ? PAL.leaf[4] : PAL.leaf[3]);
        P.set(cx + dx, b + dy, PAL.leaf[5]);
      }
  },
  corn(P, cx, b, s) {
    const h = s === 1 ? 8 : s === 2 ? 16 : 20;
    P.vline(cx, b - h, b, PAL.leaf[2]);
    P.vline(cx + 1, b - h + 2, b, PAL.leaf[1]);
    for (let k = 1; k < h / 4; k++) {
      const y = b - k * 4;
      P.line(cx, y, cx - 5, y - 3 + (k % 2), PAL.leaf[3]);
      P.line(cx + 1, y - 2, cx + 6, y - 4, PAL.leaf[4]);
    }
    if (s === 3) {
      P.rect(cx + 2, b - 12, 3, 6, PAL.straw[3]);
      P.vline(cx + 2, b - 12, b - 7, PAL.ember[4]);
      P.set(cx + 3, b - 13, PAL.leaf[3]);
      for (let k = 0; k < 4; k++) P.set(cx - 1 + k, b - h - 1 - (k % 2), PAL.straw[2]);
    } else if (s === 2) P.rect(cx + 2, b - 11, 2, 4, PAL.leaf[4]);
  },
  pumpkin(P, cx, b, s) {
    for (const [dx, dy, r] of [[-5, -2, 3], [4, -3, 3], [0, -5, 2.6], [-2, 0, 2.2]].slice(0, s === 1 ? 2 : 4)) leafBlob(P, cx + dx, b + dy, r, r * 0.75, dy < -3 ? 1 : 0);
    P.line(cx - 8, b, cx + 8, b - 1, PAL.leaf[2]);
    if (s >= 2) {
      const big = s === 3,
        col = big ? PAL.ember[3] : PAL.straw[3],
        dark = big ? PAL.ember[2] : PAL.straw[2];
      P.ellipse(cx + 1, b - 1, big ? 5 : 3, big ? 3.6 : 2.4, dark);
      P.ellipse(cx + 0.5, b - 1.5, big ? 4 : 2.2, big ? 2.6 : 1.6, col);
      if (big) {
        P.vline(cx - 1, b - 4, b + 1, dark);
        P.vline(cx + 3, b - 4, b + 1, dark);
        P.set(cx - 2, b - 3, PAL.ember[4]);
      }
      P.rect(cx + 1, b - (big ? 6 : 4), 1, 2, PAL.soil[1]);
    }
  },
  herb(P, cx, b, s) {
    const n = s === 1 ? 3 : 6;
    for (let i = 0; i < n; i++) {
      const dx = (i - (n - 1) / 2) * 2,
        h = 4 + (i % 3) * 2 + (s >= 2 ? 3 : 0);
      P.line(cx + dx * 0.4, b, cx + dx, b - h, PAL.leaf[2]);
      leafBlob(P, cx + dx, b - h, 1.4, 1.4, i % 2);
      if (s >= 2) P.set(cx + dx, b - h - 2, s === 3 ? PAL.night[3] : PAL.leaf[5]);
      if (s === 3 && i % 2) P.set(cx + dx + 1, b - h - 1, PAL.cloth[5]);
    }
  },
  cotton(P, cx, b, s) {
    const h = s === 1 ? 6 : 12;
    P.line(cx, b, cx, b - h, PAL.soil[1]);
    P.line(cx, b - h / 2, cx - 4, b - h + 2, PAL.soil[1]);
    P.line(cx, b - h / 2, cx + 4, b - h, PAL.soil[1]);
    for (const [dx, dy] of [[-4, -h + 3], [4, -h + 1], [0, -h - 1], [-2, -h / 2], [3, -h / 2 - 1]]) leafBlob(P, cx + dx, b + dy + 2, 1.8, 1.3, 0);
    if (s >= 2)
      for (const [dx, dy] of [[-4, -h + 1], [4, -h - 1], [0, -h - 2]]) {
        P.disc(cx + dx, b + dy, s === 3 ? 2 : 1.2, s === 3 ? "#f4efe0" : PAL.leaf[4]);
        if (s === 3) P.set(cx + dx + 1, b + dy + 1, PAL.stone[4]);
      }
  },
  rye(P, cx, b, s) {
    const h = s === 1 ? 7 : 14;
    for (let i = -2; i <= 2; i++) {
      const x = cx + i * 3,
        hh = h - Math.abs(i);
      P.line(x, b, x + (i > 0 ? 1 : i < 0 ? -1 : 0), b - hh, s === 3 ? PAL.straw[2] : PAL.leaf[3]);
      if (s >= 2) {
        P.vline(x + (i > 0 ? 1 : i < 0 ? -1 : 0), b - hh - 3, b - hh, s === 3 ? PAL.straw[3] : PAL.leaf[4]);
        P.set(x + (i > 0 ? 1 : i < 0 ? -1 : 0), b - hh - 4, s === 3 ? PAL.straw[4] : PAL.leaf[5]);
      }
    }
  },
};
export function cropSprite(crop, stage) {
  return cached(`crop:${crop}:${stage}`, () => {
    const P = new Pix(22, 26),
      cx = 11,
      base = 22;
    if (stage === 0 || !CROP_DRAW[crop]) sprout(P, cx, base);
    else CROP_DRAW[crop](P, cx, base, stage);
    P.outline(OUTLINE, ["rye", "bean", "corn"].includes(crop) ? 0.45 : 0.9);
    return canvasOf(P);
  });
}

// ---------- 状态小图标 ----------
export function iconSprite(kind) {
  return cached(`icon:${kind}`, () => {
    const P = new Pix(8, 9);
    if (kind === "thirsty") {
      // 水滴
      for (const [y, x0, x1] of [[1, 3, 3], [2, 3, 4], [3, 2, 4], [4, 2, 5], [5, 2, 5], [6, 3, 4]]) P.hline(x0, x1, y, PAL.water[4]);
      P.set(3, 3, PAL.water[5]);
      P.set(2, 4, PAL.water[5]);
      P.hline(3, 4, 6, PAL.water[3]);
    } else if (kind === "ripe") {
      // 闪光
      P.vline(3, 0, 6, PAL.ember[5]);
      P.hline(0, 6, 3, PAL.ember[5]);
      P.rect(2, 2, 3, 3, PAL.ember[4]);
      P.set(3, 3, "#fff6d8");
    }
    P.outline(OUTLINE, 0.85);
    return canvasOf(P);
  });
}

// ---------- 杂物（木头、石头、废铁）----------
export function debrisSprite(type, variant = 0) {
  return cached(`debris:${type}:${variant}`, () => {
    const P = new Pix(20, 14),
      r = rng(variant + 7);
    if (type === "wood") {
      for (const [x, y] of [[4, 9], [10, 10], [7, 6]]) {
        P.rect(x - 3, y - 2, 9, 4, PAL.soil[2]);
        P.hline(x - 3, x + 5, y - 2, PAL.soil[3]);
        P.hline(x - 3, x + 5, y + 1, PAL.soil[1]);
        P.disc(x + 6, y, 2, PAL.straw[2]);
        P.set(x + 6, y, PAL.soil[3]);
      }
    } else if (type === "stone") {
      for (const [x, y, w] of [[6, 9, 4], [12, 10, 3.4], [9, 6, 3]]) {
        P.ellipse(x, y, w, w * 0.75, PAL.stone[2]);
        P.ellipse(x - 0.8, y - 0.8, w - 1.2, w * 0.55, PAL.stone[3]);
        P.set(x - 2, y - 2, PAL.stone[4]);
      }
    } else {
      // 废铁：锈板、管子、齿轮
      P.poly([[2, 8], [12, 5], [14, 11], [3, 12]], PAL.rust[2]);
      for (let i = 0; i < 8; i++) P.set(3 + Math.floor(r() * 10), 6 + Math.floor(r() * 5), PAL.rust[1]);
      P.line(8, 11, 18, 7, PAL.stone[3]);
      P.line(8, 12, 18, 8, PAL.stone[2]);
      P.disc(15, 10, 2.4, PAL.stone[2]);
      P.disc(15, 10, 1, PAL.stone[0]);
    }
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}

// ---------- 菜地的小东西：杂草、菜青虫、盖布、乌鸦爪印 ----------
export function gardenSprite(kind, frame = 0) {
  return cached(`garden:${kind}:${frame}`, () => {
    let P;
    if (kind === "weed") {
      P = new Pix(10, 9);
      const lean = frame ? 1 : -1;
      for (const [x, h, c] of [[2, 6, PAL.leaf[3]], [4, 8, PAL.leaf[4]], [6, 5, PAL.leaf[2]], [8, 7, PAL.leaf[3]]]) {
        P.line(x, 8, x + lean, 8 - h, c);
        P.set(x + lean, 8 - h, PAL.leaf[5]);
      }
      P.set(4 + lean, 1, PAL.straw[3]);
      P.outline(OUTLINE, 0.7);
    } else if (kind === "bug") {
      P = new Pix(9, 5);
      const hump = frame ? 1 : 0;
      for (let i = 0; i < 4; i++) P.rect(1 + i * 1.5, 1 + ((i + hump) % 2), 2, 2, i % 2 ? "#c9d86a" : "#e2f07a");
      P.rect(6, 1, 2, 2, PAL.leaf[1]);
      P.set(7, 1, OUTLINE);
      P.outline(OUTLINE, 0.9);
    } else if (kind === "cloth") {
      P = new Pix(22, 22);
      for (let y = 1; y < 21; y++)
        for (let x = 1; x < 21; x++) {
          const fold = (x + y) % 7 === 0 ? 0.82 : 1,
            base = mix(PAL.cloth[5], PAL.straw[2], 0.25);
          P.set(x, y, mix(base, "#000000", 1 - fold), 0.82);
        }
      P.hline(1, 20, 11, PAL.straw[1], 0.8);
      for (const [x, y] of [[1, 1], [20, 1], [1, 20], [20, 20]]) {
        P.set(x, y, PAL.soil[1]);
        P.set(x, y + 1, PAL.soil[0]);
      }
      P.outline(PAL.straw[0], 0.5);
    } else {
      // 爪印
      P = new Pix(5, 5);
      P.vline(2, 1, 4, PAL.ash[1]);
      P.line(2, 2, 0, 0, PAL.ash[1]);
      P.line(2, 2, 4, 0, PAL.ash[1]);
    }
    return P.toCanvas();
  });
}

// ---------- 感染者 ----------
// 四种普通感染者用人的骨架画（驼背、双手往前伸、眼睛发光、身上有血），仓库守卫是一个大块头
const ZLOOK = {
  slow: { skin: PAL.leaf[3], skinDark: PAL.leaf[2], hair: PAL.ash[1], style: "short", top: [PAL.soil[2], PAL.soil[1], PAL.soil[3]], pants: [PAL.night[1], PAL.night[0]], boots: [PAL.ash[1], PAL.ash[0]], eyes: PAL.ember[4], blood: 4, hunch: true, bloodSeed: "slow" },
  runner: { skin: PAL.stone[4], skinDark: PAL.stone[3], hair: PAL.ash[2], style: "bald", top: [PAL.stone[4], PAL.stone[3], PAL.stone[5]], pants: [PAL.cloth[3], PAL.night[1]], boots: [PAL.ash[1], PAL.ash[0]], eyes: PAL.cloth[2], blood: 8, hunch: true, bloodSeed: "runner" },
  screamer: { skin: PAL.stone[4], skinDark: PAL.stone[3], hair: PAL.ash[1], style: "long", top: [PAL.cloth[0], PAL.rust[0], PAL.cloth[1]], pants: [PAL.ash[2], PAL.ash[1]], boots: [PAL.ash[1], PAL.ash[0]], eyes: PAL.ember[5], mouth: true, blood: 5, bloodSeed: "screamer" },
  armor: { skin: PAL.leaf[3], skinDark: PAL.leaf[2], hair: PAL.ash[1], style: "short", hat: "riot", top: [PAL.night[1], PAL.night[0], PAL.stone[2]], vest: [PAL.ash[2], PAL.stone[3]], pants: [PAL.ash[2], PAL.ash[1]], boots: [PAL.ash[1], PAL.ash[0]], eyes: PAL.ember[4], blood: 2, bloodSeed: "armor" },
};
export const ZOMBIE_W = PERSON_W,
  ZOMBIE_H = PERSON_H;
export function zombieSprite(type, dir, frame) {
  if (type === "elite") return bruteSprite(dir, frame);
  const look = ZLOOK[type] || ZLOOK.slow;
  return cached(`zombie:${type}:${dir}:${frame}`, () => canvasOf(drawPerson(look, dir, frame, dir === "up" ? "walk" : "reach")));
}
// 仓库守卫：宽肩、粗胳膊、缩在肩膀里的小脑袋、沾血的围裙，36×48
function bruteSprite(dir, frame) {
  return cached(`brute:${dir}:${frame}`, () => {
    const P = new Pix(36, 48),
      cx = 18,
      feet = 46,
      bob = frame % 2,
      sway = [0, 1, 0, -1][frame],
      lift = [0, 1, 0, -1][frame],
      top = 11 + bob,
      side = dir === "side";
    const flesh = (x, y, t) => P.set(x, y, dither("stone", Math.max(0.15, Math.min(0.98, t)), x, y));
    // 腿：破裤子
    for (const [lx, l] of side ? [[cx - 5, Math.max(0, lift)], [cx, Math.max(0, -lift)]] : [[cx - 8, Math.max(0, lift)], [cx + 2, Math.max(0, -lift)]]) {
      P.rect(lx, feet - 13, 7, 13 - l, PAL.ash[2]);
      P.vline(lx + 6, feet - 13, feet - 1 - l, PAL.ash[1]);
      P.rect(lx - 1, feet - 1 - l, 8, 2, PAL.ash[0]);
      P.set(lx + 2, feet - 6, PAL.stone[3]);
    }
    // 身子：上宽下窄，挺着肚子，光从左上来
    const bodyH = 24;
    for (let j = 0; j < bodyH; j++) {
      const y = top + j,
        half = Math.round((side ? 9 : 13) - j * (side ? 0.1 : 0.16) + (j > 10 && j < 20 ? 1.5 : 0));
      for (let i = -half; i <= half; i++) flesh(cx + i + (side ? 1 : 0), y, 0.82 - (i + half) / (half * 2) * 0.5 - j / bodyH * 0.3);
    }
    if (!side && dir !== "up") {
      P.line(cx - 7, top + 7, cx - 1, top + 9, PAL.stone[2]);
      P.line(cx + 7, top + 7, cx + 1, top + 9, PAL.stone[2]);
      // 围裙和背带
      P.rect(cx - 7, top + 11, 15, 15, PAL.soil[2]);
      P.hline(cx - 7, cx + 7, top + 11, PAL.soil[3]);
      P.vline(cx + 7, top + 12, top + 25, PAL.soil[1]);
      P.line(cx - 6, top + 11, cx - 9, top + 1, PAL.soil[1]);
      P.line(cx + 6, top + 11, cx + 9, top + 1, PAL.soil[1]);
      for (let k = 0; k < 10; k++) P.set(cx - 6 + ((k * 5) % 13), top + 13 + ((k * 3) % 11), k % 3 ? PAL.cloth[0] : PAL.rust[0]);
    }
    if (side) {
      P.rect(cx - 6, top + 12, 13, 14, PAL.soil[2]);
      P.vline(cx + 6, top + 12, top + 25, PAL.soil[1]);
    }
    // 胳膊：从肩膀垂下来，拳头很大
    const arm = (x, y, len, light) => {
      for (let j = 0; j < len; j++) for (let i = 0; i < 6; i++) flesh(x + i, y + j, (light ? 0.75 : 0.5) - i * 0.06 - j * 0.01);
      P.rect(x - 1, y + len, 8, 6, PAL.stone[3]);
      P.hline(x - 1, x + 6, y + len, PAL.stone[4]);
      P.vline(x + 6, y + len, y + len + 5, PAL.stone[2]);
      P.set(x + 1, y + len + 2, PAL.cloth[0]);
    };
    if (side) arm(cx + 3, top + 5 + sway, 15, true);
    else {
      arm(cx - 19, top + 3 + Math.max(0, sway), 17, true);
      arm(cx + 13, top + 3 + Math.max(0, -sway), 17, false);
    }
    // 缩在肩膀里的小脑袋
    const hx = side ? cx + 2 : cx - 4,
      hy = top - 5;
    for (let j = 0; j < 8; j++) for (let i = 0; i < 8; i++) flesh(hx + i, hy + j, 0.85 - i * 0.05 - j * 0.03);
    P.hline(hx, hx + 7, hy + 7, PAL.stone[2]);
    if (dir === "down") {
      P.rect(hx + 1, hy + 3, 2, 1, PAL.ember[4]);
      P.rect(hx + 5, hy + 3, 2, 1, PAL.ember[4]);
      P.rect(hx + 2, hy + 5, 4, 2, PAL.ash[0]);
      P.set(hx + 3, hy + 5, PAL.stone[5]);
      P.set(hx + 5, hy + 5, PAL.stone[5]);
    } else if (side) {
      P.rect(hx + 5, hy + 3, 2, 1, PAL.ember[4]);
      P.rect(hx + 6, hy + 5, 2, 2, PAL.ash[0]);
    } else {
      P.hline(hx + 1, hx + 6, hy + 1, PAL.stone[3]);
    }
    // 伤口和血
    const r = rng(77 + frame + (side ? 9 : dir === "up" ? 5 : 0));
    for (let i = 0; i < 16; i++) {
      const x = cx - 12 + Math.floor(r() * 25),
        y = top + Math.floor(r() * 26);
      if (P.opaque(x, y)) P.set(x, y, r() > 0.5 ? PAL.cloth[0] : PAL.cloth[1]);
    }
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
