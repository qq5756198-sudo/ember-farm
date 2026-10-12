// v0.24.0「暗涌」的小图：膨胀者、装死者、吐酸者、夜行者、护士长用人的骨架再添东西；大块头单独画；
// 各种柜子（衣柜、工具箱、药柜、橱柜、车库架子、货箱、锁着的铁柜、空投箱、对讲机说的箱子）、储藏室的铁门、对讲机、飞出去的车门。
// 都只用调色板里的颜色，一个美术像素在地图上占 2×2，画一次存起来。
import { PAL, OUTLINE, Pix, cached, dither, rng, mix } from "./pixel-kit.js";
import { ZOMBIE_LOOKS, zombiePix, lookFor } from "./pixel-sprites.js";

const canvasOf = (P) => P.toCanvas();
const SLOW = ZOMBIE_LOOKS.slow;

// ---------- 新感染者的样子 ----------
export const U_LOOKS = {
  bloater: { ...SLOW, skin: PAL.leaf[4], skinDark: PAL.leaf[3], hair: PAL.ash[1], style: "bald", top: [PAL.straw[1], PAL.straw[0], PAL.straw[2]], pants: [PAL.night[1], PAL.night[0]], eyes: PAL.straw[4], blood: 2, bloodSeed: "bloater" },
  faker: { ...SLOW, top: [PAL.rust[1], PAL.rust[0], PAL.rust[2]], bloodSeed: "faker", blood: 6 },
  spitter: { ...SLOW, skin: PAL.stone[4], skinDark: PAL.stone[3], hair: PAL.ash[0], style: "long", top: [PAL.cloth[3], PAL.night[0], PAL.cloth[4]], pants: [PAL.ash[2], PAL.ash[1]], eyes: PAL.leaf[5], mouth: true, blood: 3, bloodSeed: "spitter", hunch: false },
  stalker: { ...SLOW, skin: PAL.night[3], skinDark: PAL.night[2], hair: PAL.ash[0], style: "bald", top: [PAL.ash[1], PAL.ash[0], PAL.ash[2]], pants: [PAL.ash[0], OUTLINE], boots: [PAL.ash[0], OUTLINE], eyes: PAL.leaf[5], blood: 1, bloodSeed: "stalker", hunch: true },
  nurse: { ...SLOW, skin: PAL.stone[4], skinDark: PAL.stone[3], hair: PAL.ash[1], style: "bun", top: [PAL.snow[3], PAL.snow[1], PAL.snow[4]], pants: [PAL.snow[2], PAL.snow[1]], boots: [PAL.ash[1], PAL.ash[0]], eyes: PAL.cloth[2], mouth: true, blood: 9, bloodSeed: "nurse", hunch: false },
};

// 鼓起来的肚子：发绿、几道发黑的血管、几个脓包
function belly(P, dir, frame) {
  const side = dir === "side",
    cx = side ? 14 : 11,
    cy = 21 + (frame % 2),
    rx = side ? 6 : 7,
    ry = 6;
  if (dir === "up") {
    P.ellipse(11, cy, 7, 5, PAL.leaf[3]);
    P.hline(6, 16, cy + 4, PAL.leaf[2]);
    return;
  }
  for (let y = -ry; y <= ry; y++)
    for (let x = -rx; x <= rx; x++) {
      const k = (x * x) / (rx * rx) + (y * y) / (ry * ry);
      if (k > 1) continue;
      const t = 0.85 - (x + rx) / (rx * 2) * 0.35 - (y + ry) / (ry * 2) * 0.3;
      P.set(cx + x, cy + y, dither("leaf", Math.max(0.35, Math.min(0.98, t)), cx + x, cy + y));
    }
  P.line(cx - 3, cy - 3, cx - 1, cy + 2, PAL.leaf[1]);
  P.line(cx + 2, cy - 4, cx + 3, cy + 1, PAL.leaf[1]);
  P.line(cx - 1, cy + 2, cx + 2, cy + 4, PAL.leaf[1]);
  for (const [x, y] of [[-4, 1], [3, -2], [1, 3]]) {
    P.set(cx + x, cy + y, PAL.straw[4]);
    P.set(cx + x + 1, cy + y, PAL.straw[3]);
  }
  P.set(cx - 3, cy - 4, "#e8f0b0");
}

export function uZombieSprite(type, dir, frame) {
  return cached(`uz:${type}:${dir}:${frame}`, () => {
    const L = U_LOOKS[type] || U_LOOKS.faker,
      P = zombiePix(L, dir, frame, type === "stalker" ? "walk" : "reach");
    if (type === "bloater") {
      belly(P, dir, frame);
      P.outline(OUTLINE);
    } else if (type === "spitter" && dir !== "up") {
      // 喉咙下面鼓着一个酸液囊，嘴边挂着绿的
      const side = dir === "side",
        x = side ? 17 : 11,
        y = side ? 13 : 14;
      P.ellipse(x, y, side ? 2 : 3, 2, PAL.leaf[4]);
      P.set(x - 1, y - 1, PAL.leaf[5]);
      P.set(side ? 18 : 10, y + 2, PAL.leaf[5]);
      P.set(side ? 18 : 12, y + 3, PAL.leaf[4]);
      P.outline(OUTLINE);
    } else if (type === "stalker" && dir !== "up") {
      // 长指甲
      const side = dir === "side";
      for (const [x, y] of side ? [[20, 17], [21, 18]] : [[4, 25], [5, 26], [17, 25], [16, 26]]) P.set(x, y, PAL.stone[5]);
      P.outline(OUTLINE);
    } else if (type === "nurse") {
      // 护士帽：白底红十字
      const hx = 6,
        hy = 3 + (frame === 1 || frame === 3 ? 1 : 0);
      P.rect(hx + 1, hy - 3, 8, 3, PAL.snow[4]);
      P.hline(hx + 1, hx + 8, hy - 1, PAL.snow[2]);
      if (dir !== "up") {
        P.vline(hx + 5, hy - 3, hy - 1, PAL.cloth[1]);
        P.hline(hx + 4, hx + 6, hy - 2, PAL.cloth[1]);
      }
      // 胸前的血手印
      if (dir === "down") {
        P.rect(8, 17, 2, 2, PAL.cloth[0]);
        P.set(10, 18, PAL.cloth[0]);
        P.rect(13, 20, 2, 3, PAL.rust[0]);
      }
      P.outline(OUTLINE);
    }
    return canvasOf(P);
  });
}
export const U_ZW = 22,
  U_ZH = 34;

// ---------- 大块头：比仓库守卫还大一圈，绿灰色的皮、背心、铁指虎 ----------
export function bruteBossSprite(dir, frame, lift = false) {
  return cached(`ubrute:${dir}:${frame}:${lift ? 1 : 0}`, () => {
    const P = new Pix(44, 56),
      cx = 22,
      feet = 54,
      bob = frame % 2,
      sway = [0, 1, 0, -1][frame],
      step = [0, 1, 0, -1][frame],
      top = 13 + bob,
      side = dir === "side",
      flesh = (x, y, t) => P.set(x, y, dither("leaf", Math.max(0.2, Math.min(0.9, t)), x, y)),
      grey = (x, y, t) => P.set(x, y, dither("stone", Math.max(0.15, Math.min(0.95, t)), x, y));
    // 腿：撕破的工装裤
    for (const [lx, l] of side ? [[cx - 6, Math.max(0, step)], [cx, Math.max(0, -step)]] : [[cx - 10, Math.max(0, step)], [cx + 3, Math.max(0, -step)]]) {
      P.rect(lx, feet - 15, 8, 15 - l, PAL.night[1]);
      P.vline(lx + 7, feet - 15, feet - 1 - l, PAL.night[0]);
      P.rect(lx - 1, feet - 2 - l, 10, 3, PAL.ash[0]);
      P.set(lx + 2, feet - 8, PAL.night[2]);
      P.set(lx + 4, feet - 11, PAL.leaf[2]);
    }
    // 身子：一座肉山
    const bodyH = 27;
    for (let j = 0; j < bodyH; j++) {
      const y = top + j,
        half = Math.round((side ? 11 : 16) - j * (side ? 0.12 : 0.2) + (j > 12 && j < 23 ? 2 : 0));
      for (let i = -half; i <= half; i++) flesh(cx + i + (side ? 1 : 0), y, 0.8 - ((i + half) / (half * 2)) * 0.45 - (j / bodyH) * 0.3);
    }
    // 破背心
    if (dir !== "up") {
      const w = side ? 9 : 12;
      P.rect(cx - w + (side ? 2 : 0), top + 6, w * 2 - (side ? 3 : 0), 16, PAL.rust[1]);
      P.hline(cx - w + (side ? 2 : 0), cx + w - 1, top + 6, PAL.rust[2]);
      for (let k = 0; k < 7; k++) P.set(cx - w + 2 + ((k * 5) % (w * 2 - 3)), top + 21 - (k % 3), PAL.rust[0]);
      for (let k = 0; k < 4; k++) P.set(cx - 6 + k * 4, top + 22, OUTLINE);
    } else {
      P.rect(cx - 12, top + 6, 24, 16, PAL.rust[1]);
      P.hline(cx - 12, cx + 11, top + 6, PAL.rust[2]);
    }
    // 胳膊：比腿还粗，拳头上套着铁指虎
    const arm = (x, y, len, light) => {
      for (let j = 0; j < len; j++) for (let i = 0; i < 8; i++) flesh(x + i, y + j, (light ? 0.72 : 0.48) - i * 0.05 - j * 0.008);
      for (let j = 0; j < 7; j++) for (let i = 0; i < 10; i++) grey(x - 1 + i, y + len + j, 0.75 - i * 0.04 - j * 0.05);
      P.hline(x - 1, x + 8, y + len, PAL.stone[5]);
      for (let i = 0; i < 4; i++) P.set(x + i * 2, y + len + 1, PAL.stone[1]);
    };
    if (lift) {
      // 举起手（抡车门、砸地之前）
      if (side) arm(cx + 4, top - 10, 14, true);
      else {
        arm(cx - 24, top - 10 + Math.max(0, sway), 14, true);
        arm(cx + 16, top - 10 + Math.max(0, -sway), 14, false);
      }
    } else if (side) arm(cx + 4, top + 5 + sway, 17, true);
    else {
      arm(cx - 24, top + 3 + Math.max(0, sway), 19, true);
      arm(cx + 16, top + 3 + Math.max(0, -sway), 19, false);
    }
    // 缩在肩膀里的小脑袋
    const hx = side ? cx + 3 : cx - 5,
      hy = top - 6;
    for (let j = 0; j < 9; j++) for (let i = 0; i < 10; i++) flesh(hx + i, hy + j, 0.82 - i * 0.04 - j * 0.03);
    P.hline(hx, hx + 9, hy + 8, PAL.leaf[1]);
    if (dir === "down") {
      P.rect(hx + 2, hy + 3, 2, 1, PAL.ember[4]);
      P.rect(hx + 6, hy + 3, 2, 1, PAL.ember[4]);
      P.rect(hx + 3, hy + 5, 4, 2, OUTLINE);
      P.set(hx + 4, hy + 5, PAL.stone[5]);
    } else if (side) {
      P.rect(hx + 7, hy + 3, 2, 1, PAL.ember[4]);
      P.rect(hx + 8, hy + 5, 2, 2, OUTLINE);
    } else P.hline(hx + 1, hx + 8, hy + 1, PAL.leaf[2]);
    const r = rng(311 + frame + (side ? 9 : dir === "up" ? 5 : 0));
    for (let i = 0; i < 18; i++) {
      const x = cx - 14 + Math.floor(r() * 29),
        y = top + Math.floor(r() * 28);
      if (P.opaque(x, y)) P.set(x, y, r() > 0.5 ? PAL.cloth[0] : PAL.rust[0]);
    }
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
export const BRUTE_W = 44,
  BRUTE_H = 56;

// 飞出去的车门：灰蓝的门板、一扇破窗、门把手
export function doorSprite() {
  return cached("udoor:car", () => {
    const P = new Pix(26, 14);
    for (let y = 1; y < 13; y++) for (let x = 1; x < 25; x++) P.set(x, y, dither("night", 0.55 + (13 - y) / 40 - x / 120, x, y));
    P.rect(3, 2, 11, 5, PAL.water[1]);
    P.line(4, 3, 9, 6, PAL.water[3]);
    P.set(11, 3, PAL.water[4]);
    P.hline(1, 24, 8, PAL.night[0]);
    P.rect(17, 9, 4, 1, PAL.stone[4]);
    P.set(24, 4, PAL.rust[2]);
    P.set(23, 11, PAL.rust[1]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}

// ---------- 柜子 ----------
function woodBox(P, x, y, w, h, light = 0.6) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.set(x + i, y + j, dither("soil", light - i / (w * 4) - j / (h * 5) + ((i + j * 3) % 7 === 0 ? -0.08 : 0), x + i, y + j));
  P.hline(x, x + w - 1, y, PAL.soil[4]);
  P.vline(x + w - 1, y + 1, y + h - 1, PAL.soil[1]);
  P.hline(x, x + w - 1, y + h - 1, PAL.soil[0]);
}
function metalBox(P, x, y, w, h, ramp = "stone", light = 0.6) {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) P.set(x + i, y + j, dither(ramp, light - i / (w * 3) - j / (h * 4), x + i, y + j));
  P.hline(x, x + w - 1, y, PAL[ramp][PAL[ramp].length - 1]);
  P.vline(x + w - 1, y + 1, y + h - 1, PAL[ramp][1]);
  P.hline(x, x + w - 1, y + h - 1, PAL[ramp][0]);
}
const CRATE_ART = {
  wardrobe(P) {
    woodBox(P, 3, 1, 18, 25, 0.62);
    P.vline(11, 3, 24, PAL.soil[0]);
    P.vline(12, 3, 24, PAL.soil[3]);
    P.set(9, 13, PAL.straw[3]);
    P.set(14, 13, PAL.straw[3]);
    // 门缝里露出一角布
    P.rect(12, 20, 2, 4, PAL.cloth[1]);
    P.set(12, 21, PAL.cloth[2]);
  },
  toolbox(P) {
    metalBox(P, 2, 13, 20, 11, "cloth", 0.28);
    for (let x = 2; x < 22; x++) for (let y = 13; y < 24; y++) P.set(x, y, dither("ember", 0.35 - (y - 13) / 40 - x / 120, x, y));
    P.hline(2, 21, 13, PAL.ember[3]);
    P.hline(2, 21, 17, PAL.ember[0]);
    P.rect(9, 9, 6, 2, PAL.stone[3]);
    P.vline(8, 10, 13, PAL.stone[2]);
    P.vline(15, 10, 13, PAL.stone[2]);
    P.rect(11, 18, 2, 2, PAL.stone[5]);
    // 露出一把扳手
    P.line(17, 11, 21, 8, PAL.stone[4]);
    P.set(21, 7, PAL.stone[3]);
  },
  medicine(P) {
    metalBox(P, 4, 3, 16, 17, "snow", 0.85);
    P.vline(12, 4, 18, PAL.snow[1]);
    P.rect(8, 7, 2, 6, PAL.cloth[1]);
    P.rect(6, 9, 6, 2, PAL.cloth[1]);
    P.set(14, 11, PAL.stone[2]);
    P.vline(5, 20, 25, PAL.stone[2]);
    P.vline(18, 20, 25, PAL.stone[2]);
  },
  kitchen(P) {
    woodBox(P, 2, 6, 20, 19, 0.7);
    P.hline(2, 21, 12, PAL.soil[1]);
    P.hline(2, 21, 18, PAL.soil[1]);
    for (const y of [9, 15, 21]) P.rect(10, y, 4, 1, PAL.stone[4]);
    P.rect(2, 4, 20, 2, PAL.stone[3]);
    P.hline(2, 21, 4, PAL.stone[4]);
    // 台面上一个罐头
    P.rect(16, 1, 3, 3, PAL.cloth[2]);
    P.hline(16, 18, 1, PAL.stone[5]);
  },
  garage(P) {
    metalBox(P, 2, 2, 20, 2, "stone", 0.5);
    metalBox(P, 2, 12, 20, 2, "stone", 0.5);
    P.vline(2, 2, 25, PAL.stone[2]);
    P.vline(21, 2, 25, PAL.stone[1]);
    // 架子上的轮胎、机油桶
    P.ellipse(8, 8, 4, 3, PAL.ash[1]);
    P.ellipse(8, 8, 2, 1, PAL.ash[3]);
    P.rect(14, 5, 5, 7, PAL.ember[1]);
    P.hline(14, 18, 5, PAL.ember[3]);
    P.rect(5, 17, 6, 8, PAL.water[1]);
    P.hline(5, 10, 17, PAL.water[3]);
    P.rect(13, 19, 7, 6, PAL.soil[2]);
  },
  cargo(P) {
    woodBox(P, 2, 8, 20, 16, 0.6);
    P.line(3, 9, 20, 22, PAL.soil[1]);
    P.line(20, 9, 3, 22, PAL.soil[1]);
    P.hline(2, 21, 15, PAL.soil[3]);
    for (const [x, y] of [[3, 9], [20, 9], [3, 22], [20, 22]]) P.set(x, y, PAL.stone[3]);
  },
  locked(P) {
    metalBox(P, 3, 1, 18, 25, "stone", 0.62);
    for (let y = 4; y < 10; y += 2) P.hline(6, 17, y, PAL.stone[1]);
    P.vline(12, 2, 24, PAL.stone[1]);
    // 挂锁
    P.rect(10, 13, 5, 4, PAL.ember[3]);
    P.hline(10, 14, 13, PAL.ember[5]);
    P.vline(11, 11, 12, PAL.stone[4]);
    P.vline(13, 11, 12, PAL.stone[4]);
    P.set(12, 15, OUTLINE);
  },
  airdrop(P) {
    metalBox(P, 2, 10, 20, 14, "leaf", 0.32);
    P.hline(2, 21, 16, PAL.leaf[0]);
    P.rect(9, 12, 6, 3, PAL.straw[2]);
    // 摊在箱子上的降落伞
    for (let x = 0; x < 24; x++) {
      const y = 8 + Math.round(Math.sin(x * 0.7) * 1.2);
      P.vline(x, y, y + 2 + (x % 3 === 0 ? 1 : 0), x % 4 < 2 ? PAL.cloth[5] : PAL.straw[3]);
    }
    P.line(4, 10, 8, 14, PAL.straw[2]);
    P.line(19, 10, 15, 14, PAL.straw[2]);
  },
  pile(P) {
    woodBox(P, 4, 12, 16, 11, 0.45);
    P.line(5, 13, 18, 21, PAL.soil[0]);
  },
  cache(P) {
    metalBox(P, 3, 12, 18, 11, "leaf", 0.3);
    P.hline(3, 20, 15, PAL.leaf[0]);
    P.rect(6, 17, 6, 2, PAL.straw[2]);
    P.rect(15, 10, 3, 2, PAL.stone[3]);
    P.set(18, 9, PAL.cloth[2]);
  },
};
export function crateSprite(kind) {
  return cached(`ucrate:${kind}`, () => {
    const P = new Pix(24, 27);
    (CRATE_ART[kind] || CRATE_ART.cargo)(P);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}

// 储藏室的铁门：门框、铆钉、挂着铁链和锁；打开以后是一道黑口子
export function ironDoorSprite(open = false) {
  return cached(`uirondoor:${open ? 1 : 0}`, () => {
    const P = new Pix(30, 38);
    for (let y = 0; y < 38; y++) for (let x = 0; x < 30; x++) if (x < 3 || x > 26 || y < 3) P.set(x, y, dither("ash", 0.55 - y / 120, x, y));
    if (open) P.rect(3, 3, 24, 35, OUTLINE);
    else {
      for (let y = 3; y < 38; y++) for (let x = 3; x < 27; x++) P.set(x, y, dither("rust", 0.55 - x / 90 - y / 140, x, y));
      for (const y of [8, 20, 32]) {
        P.hline(4, 25, y, PAL.rust[0]);
        for (let x = 5; x < 26; x += 5) P.set(x, y - 1, PAL.stone[4]);
      }
      P.line(6, 15, 24, 25, PAL.stone[3]);
      P.line(6, 25, 24, 15, PAL.stone[3]);
      P.rect(13, 19, 5, 5, PAL.ember[3]);
      P.hline(13, 17, 19, PAL.ember[5]);
    }
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
// 还在响的对讲机
export function talkieSprite(on = true) {
  return cached(`utalkie:${on ? 1 : 0}`, () => {
    const P = new Pix(10, 16);
    P.rect(2, 5, 6, 10, PAL.ash[1]);
    P.hline(2, 7, 5, PAL.ash[3]);
    P.vline(3, 0, 4, PAL.ash[2]);
    P.rect(3, 7, 4, 3, PAL.water[1]);
    for (let y = 11; y < 14; y++) P.hline(3, 6, y, y % 2 ? PAL.ash[0] : PAL.ash[2]);
    P.set(6, 5, on ? PAL.cloth[2] : PAL.cloth[0]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
// 背包客和被困的人：用人的骨架，背包客背一个大包
export function merchantLook() {
  return { ...lookFor("umerchant", "trader"), bag: [PAL.soil[2], PAL.soil[1]], sig: "umerchant" };
}
export function survivorLook() {
  return { ...lookFor("usurvivor", null), sig: "usurvivor" };
}

// 战利品的小图（物品格子里用）
export function trophySprite(id) {
  return cached(`utrophy:${id}`, () => {
    const P = new Pix(16, 16);
    if (id === "trophyBrute") {
      for (let i = 0; i < 4; i++) P.ellipse(3 + i * 3, 7, 1.6, 2, PAL.stone[3 + (i % 2)]);
      P.rect(2, 9, 12, 3, PAL.stone[2]);
      P.hline(2, 13, 9, PAL.stone[4]);
      P.set(4, 6, PAL.stone[5]);
    } else if (id === "trophyNurse") {
      P.rect(3, 4, 10, 8, PAL.snow[3]);
      P.hline(3, 12, 4, PAL.snow[4]);
      P.rect(5, 6, 2, 4, PAL.cloth[1]);
      P.rect(4, 7, 4, 2, PAL.cloth[1]);
      P.hline(9, 11, 7, PAL.ash[2]);
      P.hline(9, 11, 9, PAL.ash[2]);
      P.set(12, 11, PAL.rust[1]);
    } else {
      P.poly([[2, 3], [13, 2], [14, 12], [3, 13]], PAL.stone[3]);
      P.line(2, 3, 13, 2, PAL.stone[5]);
      for (const [x, y] of [[4, 5], [11, 4], [12, 10], [5, 11]]) P.set(x, y, PAL.stone[1]);
      P.line(5, 8, 10, 6, PAL.rust[1]);
    }
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
export { mix };
