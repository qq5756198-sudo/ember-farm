// v0.25.0「长夜」：其余约 150 种物品的小图，按装备小图的画法重画（16×16、同一套调色板、外面一圈深色描边）。
// 一系列的东西用同一张底图加角标：优质（金星）、耐旱（太阳）、早熟（绿箭头）、丰产（加号）；种子是纸包上画着那样作物。
// 画好的图接在装备小图后面，拼进同一张图集；物品格子、地上掉的东西都用它。
import { PAL } from "./pixel-kit.js";
import { ITEMS } from "./data.js";
import { GEAR_ICON_IDS } from "./gear-data.js";
import { registerIcons } from "./gear-sprites.js";

const A = PAL.ash,
  So = PAL.soil,
  E = PAL.ember,
  St = PAL.straw,
  L = PAL.leaf,
  W = PAL.water,
  Sn = PAL.snow,
  Ro = PAL.stone,
  R = PAL.rust,
  N = PAL.night,
  Cl = PAL.cloth;

// ================= 作物（整张图） =================
const CROP = {
  radish(P, x = 0, y = 0) {
    P.poly([[x + 5, y + 6], [x + 3, y + 1], [x + 7, y + 4]], L[3]);
    P.poly([[x + 8, y + 6], [x + 8, y + 0], [x + 10, y + 5]], L[4]);
    P.poly([[x + 10, y + 7], [x + 13, y + 2], [x + 12, y + 7]], L[3]);
    P.ellipse(x + 8, y + 10, 4, 4, Cl[1]);
    P.ellipse(x + 7, y + 9, 2, 2, Cl[2]);
    P.set(x + 6, y + 8, E[4]);
    P.line(x + 8, y + 14, x + 9, y + 15, St[4]);
    P.set(x + 8, y + 13, St[4]);
  },
  potato(P, x = 0, y = 0) {
    P.ellipse(x + 8, y + 9, 6, 4.5, So[3]);
    P.ellipse(x + 7, y + 8, 4, 2.5, So[4]);
    P.hline(x + 4, x + 12, y + 13, So[2]);
    for (const [a, b] of [[5, 9], [9, 7], [11, 10], [7, 11]]) P.set(x + a, y + b, So[1]);
    P.set(x + 6, y + 6, St[4]);
  },
  tomato(P, x = 0, y = 0) {
    P.disc(x + 8, y + 9, 5.5, Cl[1]);
    P.ellipse(x + 7, y + 8, 3.5, 3, E[2]);
    P.set(x + 5, y + 7, E[4]);
    P.set(x + 6, y + 6, E[3]);
    P.poly([[x + 5, y + 4], [x + 8, y + 5], [x + 11, y + 4], [x + 9, y + 6], [x + 7, y + 6]], L[3]);
    P.vline(x + 8, y + 2, y + 4, L[2]);
    P.hline(x + 4, x + 12, y + 14, Cl[0]);
  },
  bean(P, x = 0, y = 0) {
    P.poly([[x + 2, y + 12], [x + 5, y + 6], [x + 10, y + 3], [x + 14, y + 2], [x + 12, y + 6], [x + 7, y + 10], [x + 3, y + 14]], L[4]);
    P.line(x + 3, y + 12, x + 12, y + 3, L[3]);
    for (const [a, b] of [[5, 9], [8, 6], [11, 4]]) {
      P.disc(x + a, y + b, 1.3, L[5]);
      P.set(x + a - 1, y + b - 1, St[4]);
    }
    P.line(x + 13, y + 2, x + 15, y + 1, L[2]);
  },
  corn(P, x = 0, y = 0) {
    P.ellipse(x + 8, y + 7, 3.2, 6, St[3]);
    for (let yy = 2; yy <= 12; yy += 2) for (let xx = 6; xx <= 10; xx += 2) P.set(x + xx + (yy % 4 ? 1 : 0), y + yy, E[4]);
    P.vline(x + 7, y + 2, y + 11, St[4]);
    P.poly([[x + 3, y + 15], [x + 5, y + 8], [x + 8, y + 13]], L[3]);
    P.poly([[x + 13, y + 15], [x + 11, y + 8], [x + 8, y + 13]], L[4]);
    P.line(x + 8, y + 0, x + 9, y + 1, St[2]);
  },
  pumpkin(P, x = 0, y = 0) {
    P.ellipse(x + 8, y + 10, 6.5, 4.5, E[3]);
    P.ellipse(x + 7, y + 9, 4, 3, E[4]);
    for (const xx of [5, 8, 11]) P.vline(x + xx, y + 7, y + 13, E[2]);
    P.hline(x + 3, x + 13, y + 14, E[1]);
    P.rect(x + 7, y + 3, 2, 3, So[2]);
    P.set(x + 9, y + 3, So[3]);
    P.poly([[x + 9, y + 5], [x + 13, y + 3], [x + 12, y + 6]], L[3]);
  },
  herb(P, x = 0, y = 0) {
    P.line(x + 8, y + 15, x + 8, y + 3, L[2]);
    for (const [a, b, s] of [[5, 5, -1], [11, 6, 1], [5, 10, -1], [11, 11, 1]]) {
      P.ellipse(x + a, y + b, 2.5, 1.5, L[4]);
      P.set(x + a + s, y + b, L[5]);
    }
    P.ellipse(x + 8, y + 2, 1.5, 2, L[5]);
  },
  cotton(P, x = 0, y = 0) {
    P.line(x + 8, y + 15, x + 8, y + 7, So[2]);
    P.line(x + 8, y + 10, x + 4, y + 7, So[2]);
    P.line(x + 8, y + 9, x + 12, y + 6, So[2]);
    for (const [a, b] of [[4, 5], [12, 4], [8, 4]]) {
      P.disc(x + a, y + b, 2.6, Sn[4]);
      P.set(x + a + 1, y + b + 1, Sn[1]);
      P.set(x + a, y + b + 2, So[1]);
    }
  },
  rye(P, x = 0, y = 0) {
    P.line(x + 5, y + 15, x + 9, y + 6, St[1]);
    for (let k = 0; k < 4; k++) {
      P.ellipse(x + 9 + k * 0.5, y + 8 - k * 2, 1.6, 1.2, St[3]);
      P.set(x + 8 + k * 0.5, y + 7 - k * 2, St[4]);
      P.line(x + 11 + k * 0.5, y + 7 - k * 2, x + 14, y + 5 - k * 2, St[2]);
    }
    P.line(x + 7, y + 11, x + 3, y + 9, L[3]);
  },
};
// 种子包上画的小图（6×6 左右）
const MINI = {
  radish: (P, x, y) => {
    P.ellipse(x + 3, y + 4, 2, 2, Cl[1]);
    P.vline(x + 3, y + 0, y + 2, L[4]);
    P.set(x + 2, y + 1, L[3]);
    P.set(x + 4, y + 1, L[3]);
  },
  potato: (P, x, y) => {
    P.ellipse(x + 3, y + 3, 3, 2, So[3]);
    P.set(x + 2, y + 3, So[1]);
  },
  tomato: (P, x, y) => {
    P.disc(x + 3, y + 4, 2.4, Cl[1]);
    P.hline(x + 2, x + 4, y + 1, L[3]);
    P.set(x + 2, y + 3, E[4]);
  },
  bean: (P, x, y) => {
    P.line(x + 0, y + 5, x + 6, y + 0, L[4]);
    P.line(x + 1, y + 5, x + 6, y + 1, L[4]);
    P.set(x + 2, y + 3, L[5]);
    P.set(x + 4, y + 2, L[5]);
  },
  corn: (P, x, y) => {
    P.ellipse(x + 3, y + 3, 1.6, 3, E[4]);
    P.set(x + 1, y + 5, L[3]);
    P.set(x + 5, y + 5, L[3]);
  },
  pumpkin: (P, x, y) => {
    P.ellipse(x + 3, y + 4, 3, 2, E[3]);
    P.vline(x + 3, y + 3, y + 5, E[2]);
    P.set(x + 3, y + 1, So[2]);
  },
  herb: (P, x, y) => {
    P.vline(x + 3, y + 0, y + 6, L[2]);
    P.set(x + 2, y + 2, L[4]);
    P.set(x + 4, y + 3, L[4]);
    P.set(x + 2, y + 4, L[5]);
  },
  cotton: (P, x, y) => {
    P.disc(x + 2, y + 2, 1.5, Sn[4]);
    P.disc(x + 4, y + 3, 1.5, Sn[3]);
    P.vline(x + 3, y + 4, y + 6, So[2]);
  },
  rye: (P, x, y) => {
    P.line(x + 1, y + 6, x + 4, y + 0, St[2]);
    P.set(x + 4, y + 1, St[4]);
    P.set(x + 3, y + 2, St[4]);
    P.set(x + 5, y + 2, St[3]);
  },
};
// ================= 角标 =================
const BADGE = {
  // 优质：金色的星
  fine(P) {
    P.hline(11, 15, 12, E[5]);
    P.vline(13, 10, 14, E[5]);
    P.set(13, 12, "#fff6d0");
    P.set(12, 14, E[4]);
    P.set(14, 14, E[4]);
  },
  // 耐旱：太阳
  hardy(P) {
    P.disc(13, 12, 1.6, E[4]);
    P.set(13, 12, E[5]);
    for (const [a, b] of [[13, 9], [13, 15], [10, 12], [15, 12]]) P.set(a, b, E[3]);
  },
  // 早熟：向上的绿箭头
  early(P) {
    P.vline(13, 10, 15, L[5]);
    P.hline(11, 15, 12, L[5]);
    P.set(12, 11, L[5]);
    P.set(14, 11, L[5]);
    P.set(13, 9, L[4]);
  },
  // 丰产：加号
  abundant(P) {
    P.rect(12, 9, 2, 6, St[4]);
    P.rect(10, 11, 6, 2, St[4]);
    P.set(12, 11, L[5]);
    P.set(13, 12, L[5]);
  },
};
// 种子包：纸袋、折起来的口、中间一张小图、口上一道作物的颜色
const SEED_BAND = { radish: Cl[1], potato: So[3], tomato: Cl[2], bean: L[4], corn: E[4], pumpkin: E[3], herb: L[3], cotton: Sn[3], rye: St[2] };
function packet(P, crop) {
  P.rect(3, 3, 10, 12, St[3]);
  P.rect(3, 3, 10, 2, St[2]);
  P.hline(3, 12, 5, SEED_BAND[crop] || St[1]);
  P.vline(12, 6, 14, St[1]);
  P.hline(3, 12, 14, St[1]);
  P.set(4, 6, St[4]);
  P.set(4, 7, St[4]);
  MINI[crop]?.(P, 5, 7);
}

// ================= 吃的 =================
// 一只碗：碗身、碗口、汤面、汤里的东西、冒热气
function bowl(P, soup, bits = [], steam = true, body = Ro[3]) {
  P.poly([[2, 9], [14, 9], [12, 13], [4, 13]], body);
  P.hline(4, 12, 13, Ro[1]);
  P.hline(5, 11, 14, Ro[2]);
  P.ellipse(8, 9, 6, 1.6, soup);
  P.hline(3, 13, 10, Ro[4]);
  for (const [x, y, c] of bits) P.set(x, y, c);
  if (steam) {
    P.set(6, 5, Sn[3], 0.7);
    P.set(7, 4, Sn[3], 0.6);
    P.set(9, 6, Sn[3], 0.7);
    P.set(10, 5, Sn[3], 0.6);
  }
}
// 一只盘子
function plate(P, food) {
  P.ellipse(8, 11, 7, 3, Sn[3]);
  P.ellipse(8, 11, 5, 2, Sn[4]);
  P.hline(2, 14, 13, Sn[1]);
  food(P);
}
// 便当盒
function lunchbox(P, bits) {
  P.rect(2, 6, 12, 8, So[2]);
  P.rect(3, 7, 10, 6, St[4]);
  P.vline(8, 7, 12, So[2]);
  P.hline(2, 13, 13, So[1]);
  P.poly([[2, 5], [12, 1], [14, 3], [4, 6]], So[3]);
  for (const [x, y, c] of bits) P.set(x, y, c);
}
function fishBody(P, body, belly, tail, fin = null, eye = A[0]) {
  P.ellipse(7, 9, 5.5, 3, body);
  P.ellipse(7, 10, 4, 1.4, belly);
  P.poly([[12, 9], [15, 6], [15, 12]], tail);
  P.poly([[6, 6], [9, 4], [10, 7]], fin || tail);
  P.set(4, 8, eye);
  P.set(3, 8, Sn[4]);
  P.hline(2, 3, 10, A[2]);
}

// ================= 其他的小件 =================
function book(P, cover, mark) {
  P.rect(3, 2, 10, 12, cover);
  P.rect(3, 2, 2, 12, A[1]);
  P.hline(5, 12, 2, Sn[2]);
  P.rect(5, 13, 8, 2, Sn[4]);
  P.hline(5, 12, 14, Sn[2]);
  mark(P);
}
function paper(P, base = St[4]) {
  P.poly([[3, 2], [11, 2], [13, 4], [13, 14], [3, 14]], base);
  P.poly([[11, 2], [13, 4], [11, 4]], St[2]);
  P.vline(13, 4, 14, St[2]);
  P.hline(3, 13, 14, St[2]);
}
function vial(P, liquid, glow = null) {
  P.rect(6, 3, 4, 2, So[3]);
  P.rect(5, 5, 6, 9, Sn[2]);
  P.rect(6, 8, 4, 5, liquid);
  P.hline(6, 9, 8, glow || liquid);
  P.vline(6, 6, 12, Sn[4]);
  P.hline(5, 10, 14, Sn[1]);
}
function sack(P, body, top) {
  P.ellipse(8, 10, 5.5, 4.5, body);
  P.rect(6, 3, 4, 3, body);
  P.hline(5, 10, 5, top);
  P.set(7, 2, top);
  P.set(9, 2, top);
  P.ellipse(7, 9, 2.5, 2, St[4], 0.35);
}
function crate(P, wood = So[3]) {
  P.rect(2, 6, 12, 8, wood);
  P.hline(2, 13, 6, So[4]);
  P.hline(2, 13, 10, So[2]);
  P.hline(2, 13, 13, So[1]);
  P.vline(2, 6, 13, So[2]);
  P.vline(13, 6, 13, So[1]);
}

const DRAW = {
  // ---- 工具和武器 ----
  hoe(P) {
    P.line(3, 14, 11, 4, So[3]);
    P.line(4, 14, 12, 4, So[2]);
    P.poly([[10, 2], [14, 3], [14, 7], [12, 6]], Ro[3]);
    P.line(10, 2, 14, 3, Ro[5]);
  },
  water(P) {
    P.rect(4, 6, 8, 7, W[3]);
    P.hline(4, 11, 6, W[5]);
    P.vline(11, 7, 12, W[2]);
    P.line(12, 8, 15, 4, W[3]);
    P.set(15, 3, W[5]);
    P.ellipse(8, 5, 3, 1.5, W[2]);
    P.line(3, 7, 2, 10, W[2]);
    P.hline(4, 11, 13, W[1]);
  },
  flashlight(P) {
    P.rect(2, 7, 9, 3, Ro[2]);
    P.hline(2, 10, 7, Ro[4]);
    P.rect(10, 5, 3, 7, Ro[3]);
    P.rect(13, 6, 2, 5, St[4]);
    P.set(14, 7, "#fff6d0");
    P.rect(5, 6, 2, 1, E[2]);
  },
  crowbar(P) {
    P.line(3, 14, 12, 3, Cl[1]);
    P.line(4, 14, 13, 3, Cl[0]);
    P.line(12, 3, 14, 2, Ro[4]);
    P.line(14, 2, 14, 4, Ro[4]);
    P.line(2, 14, 4, 15, Ro[4]);
  },
  club(P) {
    P.line(3, 14, 11, 4, So[2]);
    P.line(4, 14, 12, 4, So[1]);
    P.ellipse(11, 4, 3, 2.6, So[3]);
    P.set(10, 3, So[4]);
    P.set(12, 6, So[1]);
  },
  pistol(P) {
    P.rect(3, 5, 10, 3, A[3]);
    P.hline(3, 12, 5, Ro[3]);
    P.rect(4, 8, 4, 6, So[2]);
    P.vline(4, 8, 13, So[3]);
    P.set(9, 8, A[2]);
    P.set(10, 9, A[2]);
    P.set(13, 6, A[1]);
  },
  shotgun(P) {
    P.rect(1, 6, 10, 2, A[3]);
    P.hline(1, 10, 6, Ro[3]);
    P.rect(1, 8, 9, 1, A[2]);
    P.poly([[10, 6], [15, 7], [15, 11], [12, 10], [10, 8]], So[2]);
    P.set(6, 9, So[3]);
    P.set(7, 10, A[2]);
  },
  rifle(P) {
    P.hline(0, 11, 6, A[3]);
    P.hline(0, 11, 7, A[2]);
    P.rect(5, 4, 3, 2, A[1]);
    P.poly([[9, 6], [15, 7], [15, 10], [12, 9], [9, 8]], So[3]);
    P.hline(9, 14, 7, So[4]);
    P.set(8, 8, A[2]);
    P.set(8, 9, A[2]);
  },
  // ---- 药 ----
  bandage(P) {
    P.ellipse(7, 9, 4.5, 4.5, Sn[4]);
    P.ellipse(7, 9, 1.5, 1.5, Sn[1]);
    P.poly([[10, 11], [15, 12], [15, 14], [9, 13]], Sn[3]);
    P.line(3, 7, 6, 5, Sn[2]);
  },
  medkit(P) {
    P.rect(2, 5, 12, 9, Cl[1]);
    P.hline(2, 13, 5, Cl[2]);
    P.hline(2, 13, 13, Cl[0]);
    P.rect(6, 3, 4, 2, A[3]);
    P.rect(7, 7, 2, 5, Sn[4]);
    P.rect(5, 8, 6, 3, Sn[4]);
  },
  remedy(P) {
    vial(P, L[4], L[5]);
    P.set(8, 10, "#e8ffd0");
    P.set(12, 4, L[5], 0.8);
    P.set(13, 6, L[5], 0.6);
  },
  // ---- 吃的 ----
  bread(P) {
    P.rect(2, 7, 12, 6, St[2]);
    P.ellipse(8, 7, 6, 2.5, E[3]);
    P.hline(4, 12, 6, E[4]);
    for (const x of [5, 8, 11]) P.set(x, 7, E[2]);
    P.hline(2, 13, 12, St[1]);
  },
  stew(P) {
    bowl(P, E[2], [[6, 9, Cl[1]], [9, 8, L[4]], [10, 10, St[3]], [5, 10, E[4]]]);
  },
  jam(P) {
    P.rect(4, 4, 8, 10, Ro[3]);
    P.hline(4, 11, 4, Ro[5]);
    P.rect(4, 7, 8, 5, Cl[1]);
    P.disc(8, 9, 1.6, Cl[2]);
    P.vline(11, 5, 13, Ro[2]);
    P.hline(4, 11, 13, Ro[1]);
  },
  beanMeal: (P) => lunchbox(P, [[4, 9, L[5]], [5, 10, L[4]], [6, 9, L[5]], [10, 9, Sn[4]], [11, 10, Sn[4]], [10, 11, Sn[3]]]),
  riverMeal: (P) => lunchbox(P, [[4, 9, W[4]], [5, 9, W[3]], [6, 10, Sn[4]], [10, 9, Sn[4]], [11, 10, Sn[4]], [10, 11, L[4]]]),
  herbTea(P) {
    P.rect(3, 6, 8, 7, Sn[3]);
    P.hline(3, 10, 6, Sn[4]);
    P.rect(4, 7, 6, 2, L[3]);
    P.ellipse(12, 9, 2, 2.5, Sn[3]);
    P.ellipse(12, 9, 0.8, 1.2, A[1]);
    P.hline(3, 10, 13, Sn[1]);
    P.set(6, 4, Sn[3], 0.7);
    P.set(8, 3, Sn[3], 0.6);
    P.set(5, 7, L[5]);
  },
  fishStew: (P) => bowl(P, Sn[2], [[6, 9, W[4]], [9, 9, Sn[4]], [10, 8, L[4]]]),
  eggMeal: (P) =>
    plate(P, (Q) => {
      Q.ellipse(7, 10, 3.5, 2, Sn[4]);
      Q.disc(7, 10, 1.2, E[4]);
      Q.set(6, 9, E[5]);
      Q.ellipse(11, 10, 1.6, 1, So[3]);
    }),
  egg(P) {
    P.ellipse(8, 9, 4, 5, Sn[4]);
    P.ellipse(9, 10, 2.5, 3.5, Sn[3]);
    P.set(6, 6, "#ffffff");
    P.hline(6, 10, 14, Sn[1]);
  },
  milk(P) {
    P.rect(5, 5, 6, 9, Sn[4]);
    P.rect(6, 2, 4, 3, Sn[3]);
    P.hline(6, 9, 2, W[3]);
    P.rect(5, 8, 6, 3, W[3]);
    P.vline(10, 5, 13, Sn[2]);
    P.hline(5, 10, 14, Sn[1]);
  },
  milkMeal: (P) => bowl(P, Sn[4], [[6, 9, E[4]], [9, 8, E[4]], [10, 10, E[4]]]),
  nightMeal: (P) => bowl(P, So[1], [[6, 9, E[4]], [9, 8, L[3]], [10, 10, St[3]]], true, N[2]),
  fish: (P) => fishBody(P, Ro[4], Sn[3], Ro[3]),
  riverFish: (P) => fishBody(P, W[3], Sn[3], W[2], N[3]),
  nightFish: (P) => fishBody(P, N[2], N[3], E[4], E[3], E[5]),
  mutantFish(P) {
    fishBody(P, L[2], L[4], L[3]);
    P.set(6, 8, E[4]);
    P.set(7, 6, Cl[1]);
    P.set(9, 7, Cl[1]);
  },
  chefMeal: (P) =>
    plate(P, (Q) => {
      Q.ellipse(6, 10, 2.5, 1.6, Sn[4]);
      Q.ellipse(10, 10, 2, 1.5, E[3]);
      Q.set(9, 9, L[4]);
      Q.set(5, 9, St[3]);
    }),
  fineMeal(P) {
    plate(P, (Q) => {
      Q.ellipse(7, 10, 3, 1.8, E[2]);
      Q.ellipse(10, 9, 1.6, 1.2, L[4]);
      Q.set(6, 9, E[4]);
    });
    BADGE.fine(P);
  },
  trailRye(P) {
    sack(P, St[2], So[2]);
    for (const [x, y] of [[6, 10], [8, 9], [10, 11]]) P.set(x, y, Sn[4]);
  },
  warmSoup: (P) => bowl(P, E[3], [[6, 9, Cl[1]], [9, 9, L[3]], [10, 8, E[5]]]),
  armyStew: (P) => bowl(P, So[2], [[5, 9, So[4]], [7, 10, E[3]], [9, 9, L[3]], [10, 10, So[4]]], true, L[2]),
  radishCake(P) {
    P.poly([[2, 11], [8, 6], [14, 9], [8, 14]], Sn[3]);
    P.poly([[2, 11], [8, 14], [8, 15], [2, 12]], St[2]);
    P.poly([[8, 14], [14, 9], [14, 10], [8, 15]], St[1]);
    for (const [x, y] of [[6, 10], [9, 9], [10, 11]]) P.set(x, y, Cl[2]);
  },
  fishCongee: (P) => bowl(P, Sn[4], [[6, 9, W[4]], [8, 9, Sn[2]], [10, 9, L[4]]]),
  beanCake(P) {
    P.ellipse(6, 10, 4, 2.5, St[2]);
    P.ellipse(6, 9, 4, 2, St[3]);
    P.ellipse(10, 7, 4, 2.5, St[2]);
    P.ellipse(10, 6, 4, 2, St[3]);
    for (const [x, y] of [[5, 9], [9, 6], [11, 6]]) P.set(x, y, L[4]);
  },
  campBread(P) {
    P.ellipse(8, 9, 7, 4.5, St[2]);
    P.ellipse(8, 8, 6, 3.5, E[3]);
    for (const [x, y] of [[5, 7], [8, 9], [11, 8], [7, 6], [10, 6]]) P.set(x, y, E[2]);
    P.hline(3, 13, 12, St[1]);
  },
  // ---- 材料 ----
  wood(P) {
    for (const [y, x0] of [[10, 2], [6, 4]]) {
      P.rect(x0, y - 2, 10, 4, So[2]);
      P.hline(x0, x0 + 9, y - 2, So[3]);
      P.ellipse(x0 + 10, y, 2, 2, St[3]);
      P.set(x0 + 10, y, St[1]);
    }
  },
  stone(P) {
    P.ellipse(6, 10, 4, 3, Ro[3]);
    P.ellipse(5, 9, 2, 1.5, Ro[4]);
    P.ellipse(11, 11, 3, 2.5, Ro[2]);
    P.set(10, 10, Ro[4]);
    P.ellipse(10, 6, 2.5, 2, Ro[3]);
  },
  scrap(P) {
    P.poly([[2, 11], [7, 6], [10, 9], [5, 13]], Ro[3]);
    P.poly([[8, 4], [14, 6], [12, 10], [7, 8]], R[2]);
    P.line(3, 11, 7, 7, Ro[5]);
    P.set(11, 6, R[3]);
    P.rect(9, 11, 4, 2, Ro[2]);
  },
  parts(P) {
    P.disc(7, 8, 4.5, Ro[3]);
    for (const [x, y] of [[7, 2], [7, 14], [1, 8], [13, 8], [3, 4], [11, 4], [3, 12], [11, 12]]) P.set(x, y, Ro[3]);
    P.disc(7, 8, 1.6, A[1]);
    P.set(5, 6, Ro[5]);
    P.rect(12, 11, 3, 3, St[2]);
  },
  ammo(P) {
    for (const x of [3, 7, 11]) {
      P.rect(x, 7, 3, 7, St[2]);
      P.vline(x, 7, 13, St[4]);
      P.rect(x, 4, 3, 3, Ro[3]);
      P.set(x + 1, 3, Ro[4]);
      P.hline(x, x + 2, 13, E[1]);
    }
  },
  cloth(P) {
    P.rect(2, 5, 12, 8, Cl[4]);
    P.hline(2, 13, 5, Cl[3]);
    P.hline(2, 13, 8, Cl[3]);
    P.poly([[2, 10], [14, 9], [14, 13], [2, 13]], Cl[3]);
    P.hline(3, 12, 11, Cl[4]);
  },
  parcel(P) {
    crate(P);
    P.disc(5, 5, 2, Cl[1]);
    P.disc(9, 5, 2, E[3]);
    P.vline(12, 2, 5, L[4]);
    P.set(11, 3, L[3]);
  },
  circuit(P) {
    P.rect(2, 3, 12, 10, L[1]);
    P.hline(2, 13, 3, L[2]);
    P.rect(6, 6, 4, 4, A[0]);
    P.hline(3, 5, 7, St[4]);
    P.hline(10, 12, 9, St[4]);
    P.vline(8, 10, 12, St[4]);
    P.vline(4, 4, 6, St[4]);
    P.set(12, 5, Cl[2]);
  },
  nightHerb(P) {
    P.line(8, 15, 8, 4, N[2]);
    for (const [a, b] of [[5, 6], [11, 7], [5, 11], [11, 12]]) P.ellipse(a, b, 2.5, 1.5, Sn[1]);
    P.disc(12, 3, 2, Sn[4]);
    P.disc(13, 2, 1.5, A[0]);
  },
  resin(P) {
    P.poly([[8, 2], [12, 9], [11, 13], [5, 13], [4, 9]], E[3]);
    P.ellipse(8, 10, 3, 3, E[2]);
    P.set(6, 8, E[5]);
    P.set(7, 6, E[4]);
  },
  salt(P) {
    sack(P, St[4], St[1]);
    for (const [x, y] of [[6, 9], [8, 11], [10, 9], [7, 12]]) P.set(x, y, Sn[4]);
  },
  filterFabric(P) {
    P.rect(3, 3, 10, 11, Sn[2]);
    for (let y = 4; y < 14; y += 2) P.hline(3, 12, y, Sn[1]);
    for (let x = 4; x < 13; x += 2) P.vline(x, 3, 13, Sn[1]);
    P.ellipse(12, 13, 2.5, 2, Sn[3]);
  },
  wool(P) {
    P.disc(8, 9, 5, Sn[4]);
    P.line(4, 7, 11, 11, Sn[2]);
    P.line(5, 11, 12, 6, Sn[2]);
    P.line(12, 12, 15, 14, Sn[3]);
  },
  junkButton(P) {
    P.disc(8, 8, 5, E[2]);
    P.disc(8, 8, 3.5, E[3]);
    for (const [x, y] of [[7, 7], [9, 7], [7, 9], [9, 9]]) P.set(x, y, A[1]);
  },
  junkButt(P) {
    P.rect(3, 8, 8, 3, Sn[4]);
    P.rect(11, 8, 3, 3, St[2]);
    P.set(3, 9, A[2]);
    P.set(2, 9, Ro[3]);
    P.hline(3, 10, 10, Sn[2]);
  },
  junkCan(P) {
    P.rect(4, 4, 8, 10, Ro[3]);
    P.hline(4, 11, 4, Ro[4]);
    P.line(9, 4, 12, 7, Ro[1]);
    P.rect(4, 8, 8, 3, R[2]);
    P.set(6, 12, Ro[1]);
  },
  junkPencil(P) {
    P.line(3, 12, 10, 5, E[4]);
    P.line(4, 12, 11, 5, E[3]);
    P.line(10, 5, 12, 3, St[3]);
    P.set(13, 2, A[0]);
    P.line(2, 12, 3, 13, Ro[3]);
  },
  junkTicket(P) {
    P.rect(2, 5, 12, 7, St[4]);
    for (let y = 5; y < 12; y += 2) P.set(10, y, St[2]);
    P.hline(3, 8, 7, St[1]);
    P.hline(3, 6, 9, St[1]);
    P.set(12, 8, Cl[1]);
  },
  junkPhoto(P) {
    P.rect(2, 3, 12, 10, Sn[3]);
    P.rect(3, 4, 10, 7, So[3]);
    P.disc(6, 7, 1.6, St[3]);
    P.rect(9, 7, 3, 4, So[2]);
    P.hline(3, 12, 10, So[1]);
  },
  fodder(P) {
    for (let k = 0; k < 6; k++) P.line(3 + k * 2, 14, 5 + k, 2 + (k % 3), k % 2 ? L[3] : L[4]);
    P.hline(3, 13, 10, St[2]);
    P.hline(3, 13, 11, St[1]);
  },
  grub(P) {
    for (let k = 0; k < 5; k++) P.disc(3 + k * 2.4, 10 - Math.round(Math.sin(k) * 2), 1.8, k % 2 ? L[4] : L[5]);
    P.set(13, 8, A[0]);
    P.set(14, 7, L[2]);
  },
  // ---- 枪的配件、相机、衣服 ----
  shortBarrel(P) {
    P.rect(3, 7, 9, 3, A[3]);
    P.hline(3, 11, 7, Ro[3]);
    P.rect(12, 6, 2, 5, A[2]);
  },
  longBarrel(P) {
    P.rect(1, 7, 13, 2, A[3]);
    P.hline(1, 13, 7, Ro[3]);
    P.rect(13, 6, 2, 4, A[2]);
    P.set(1, 9, A[2]);
  },
  suppressor(P) {
    P.rect(3, 6, 10, 5, A[2]);
    P.hline(3, 12, 6, Ro[3]);
    for (const x of [5, 8, 11]) P.vline(x, 7, 10, A[1]);
    P.rect(13, 7, 2, 3, Ro[2]);
  },
  extendedMag(P) {
    P.poly([[5, 2], [10, 2], [11, 14], [6, 14]], A[3]);
    P.line(5, 2, 6, 14, Ro[3]);
    P.rect(6, 1, 4, 2, St[2]);
    for (const y of [5, 8, 11]) P.hline(7, 9, y, A[1]);
  },
  camera(P) {
    P.rect(2, 5, 12, 8, A[3]);
    P.hline(2, 13, 5, Ro[3]);
    P.disc(8, 9, 3, A[1]);
    P.disc(8, 9, 1.6, W[3]);
    P.set(7, 8, Sn[4]);
    P.rect(10, 3, 3, 2, A[2]);
    P.set(4, 7, E[3]);
  },
  warmCoat(P) {
    P.poly([[3, 3], [6, 2], [10, 2], [13, 3], [15, 10], [13, 11], [12, 7], [12, 14], [4, 14], [4, 7], [3, 11], [1, 10]], St[2]);
    for (const y of [5, 8, 11]) P.hline(4, 12, y, St[1]);
    P.vline(8, 3, 13, So[2]);
    P.hline(6, 10, 2, Sn[4]);
  },
  // ---- 主线和收藏 ----
  blueprint(P) {
    P.rect(1, 3, 14, 10, N[2]);
    P.hline(1, 14, 3, N[3]);
    for (let x = 4; x < 14; x += 3) P.vline(x, 4, 12, N[1]);
    for (let y = 6; y < 13; y += 3) P.hline(2, 13, y, N[1]);
    P.disc(8, 8, 2.5, Sn[3]);
    P.disc(8, 8, 1, N[2]);
    P.rect(0, 2, 2, 12, St[3]);
  },
  seedArchive(P) {
    P.rect(2, 4, 12, 10, St[2]);
    P.rect(2, 3, 6, 2, St[2]);
    P.hline(2, 13, 4, St[3]);
    P.rect(4, 6, 8, 6, St[4]);
    MINI.bean(P, 5, 6);
  },
  pumpModule(P) {
    P.rect(3, 5, 8, 8, Ro[3]);
    P.hline(3, 10, 5, Ro[4]);
    P.rect(11, 7, 4, 3, W[3]);
    P.set(14, 10, W[5]);
    P.disc(7, 9, 2, Ro[2]);
    P.rect(5, 2, 4, 3, Ro[2]);
  },
  driveModule(P) {
    P.rect(2, 5, 9, 8, A[3]);
    P.hline(2, 10, 5, Ro[3]);
    for (const y of [7, 9, 11]) P.hline(3, 9, y, A[1]);
    P.disc(13, 9, 2.5, Ro[4]);
    P.set(13, 9, A[1]);
  },
  relayCore(P) {
    P.rect(3, 7, 10, 7, Ro[2]);
    P.hline(3, 12, 7, Ro[4]);
    P.line(10, 7, 13, 1, Ro[4]);
    P.set(13, 1, Cl[2]);
    P.rect(5, 9, 3, 2, W[4]);
    P.set(10, 10, E[4]);
  },
  fieldSample: (P) => vial(P, L[3], L[4]),
  amoSample: (P) => vial(P, Cl[1], Cl[2]),
  oldPhoto(P) {
    P.rect(2, 2, 12, 12, So[2]);
    P.rect(3, 3, 10, 10, Sn[3]);
    P.rect(4, 4, 8, 7, St[1]);
    P.disc(7, 7, 1.5, So[1]);
    P.disc(10, 8, 1.2, So[1]);
    P.hline(4, 11, 10, So[1]);
  },
  songSheet(P) {
    paper(P);
    for (const y of [5, 8, 11]) P.hline(4, 11, y, A[3]);
    P.disc(6, 8, 1.1, A[0]);
    P.vline(7, 4, 8, A[0]);
    P.disc(10, 11, 1.1, A[0]);
    P.vline(11, 7, 11, A[0]);
  },
  manualMedic: (P) =>
    book(P, Cl[1], (Q) => {
      Q.rect(8, 5, 2, 6, Sn[4]);
      Q.rect(6, 7, 6, 2, Sn[4]);
    }),
  manualCook: (P) =>
    book(P, St[1], (Q) => {
      Q.ellipse(9, 6, 1.6, 2, Ro[4]);
      Q.vline(9, 8, 11, Ro[4]);
    }),
  manualHerd: (P) =>
    book(P, L[2], (Q) => {
      Q.ellipse(9, 8, 2.5, 2, Sn[4]);
      Q.set(11, 7, A[1]);
      Q.vline(7, 10, 11, A[2]);
      Q.vline(10, 10, 11, A[2]);
    }),
  manualWeather: (P) =>
    book(P, N[2], (Q) => {
      Q.ellipse(8, 7, 2.5, 1.6, Sn[3]);
      Q.ellipse(10, 6, 1.6, 1.4, Sn[4]);
      Q.line(7, 9, 6, 11, W[4]);
      Q.line(10, 9, 9, 11, W[4]);
    }),
  trophyBrute(P) {
    P.rect(2, 6, 12, 5, Ro[3]);
    P.hline(2, 13, 6, Ro[5]);
    for (const x of [4, 7, 10]) P.disc(x + 1, 8, 1.2, A[1]);
    P.rect(3, 11, 10, 2, Ro[2]);
    P.set(13, 7, R[2]);
  },
  trophyNurse(P) {
    P.rect(3, 4, 10, 8, Sn[3]);
    P.hline(3, 12, 4, Sn[4]);
    P.rect(7, 5, 2, 5, Cl[1]);
    P.rect(5, 6, 6, 2, Cl[1]);
    P.hline(4, 11, 10, R[2]);
    P.set(4, 11, R[1]);
    P.set(11, 3, Ro[4]);
  },
  trophyGuard(P) {
    P.poly([[3, 3], [13, 3], [13, 10], [8, 14], [3, 10]], Ro[3]);
    P.hline(3, 13, 3, Ro[5]);
    for (const [x, y] of [[5, 5], [11, 5], [5, 9], [11, 9]]) P.set(x, y, Ro[5]);
    P.line(6, 6, 10, 10, R[2]);
  },
  lnWhistle(P) {
    P.rect(4, 7, 8, 4, Ro[4]);
    P.hline(4, 11, 7, Ro[5]);
    P.disc(11, 9, 2.5, Ro[3]);
    P.set(5, 9, A[1]);
    P.disc(3, 5, 1.5, Ro[2]);
    P.line(2, 4, 1, 1, Cl[1]);
  },
  lnFlag(P) {
    P.vline(3, 1, 15, So[2]);
    P.poly([[4, 2], [14, 3], [12, 6], [14, 9], [4, 9]], Cl[1]);
    P.set(8, 4, Cl[0]);
    P.set(10, 7, Cl[0]);
    P.line(6, 5, 7, 7, Cl[0]);
    P.hline(4, 13, 2, Cl[2]);
  },
  lnLantern(P) {
    P.rect(4, 4, 8, 9, R[1]);
    P.rect(5, 5, 6, 7, E[4]);
    P.rect(7, 7, 2, 3, E[5]);
    P.set(7, 7, "#fff6d0");
    P.hline(4, 11, 13, R[2]);
    P.hline(5, 10, 3, R[2]);
    P.line(6, 3, 8, 0, Ro[3]);
    P.line(10, 3, 8, 0, Ro[3]);
  },
  lnScoutMap(P) {
    P.poly([[2, 3], [6, 2], [10, 4], [14, 3], [14, 13], [10, 14], [6, 12], [2, 13]], St[3]);
    P.vline(6, 2, 12, St[1]);
    P.vline(10, 4, 14, St[1]);
    P.line(3, 10, 9, 6, L[3]);
    P.line(10, 7, 13, 10, Cl[1]);
    P.line(10, 10, 13, 7, Cl[1]);
  },
};

// 作物：原样、优质、耐旱（黑麦叫耐候，也用太阳）；种子：原样和三种特性
const CROPS = ["radish", "potato", "tomato", "bean", "corn", "pumpkin", "herb", "cotton", "rye"];
const SEED_IDS = { radish: "seedRadish", potato: "seedPotato", tomato: "seedTomato", bean: "seedBean", corn: "seedCorn", pumpkin: "seedPumpkin", herb: "seedHerb", cotton: "seedCotton", rye: "seedRye" };
for (const c of CROPS) {
  DRAW[c] = (P) => CROP[c](P);
  DRAW["fine_" + c] = (P) => {
    CROP[c](P);
    BADGE.fine(P);
  };
  DRAW["hardy_" + c] = (P) => {
    CROP[c](P);
    BADGE.hardy(P);
  };
  DRAW[SEED_IDS[c]] = (P) => packet(P, c);
  for (const tr of ["early", "abundant", "hardy"])
    DRAW["seed_" + c + "_" + tr] = (P) => {
      packet(P, c);
      BADGE[tr](P);
    };
}
DRAW.moonHerb = (P) => {
  CROP.herb(P);
  for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (P.opaque(x, y)) P.shade(x, y, 0.55, Sn[2]);
  P.disc(12, 3, 1.6, Sn[4]);
};

// 只给真有的物品画、只画没有新小图的；接在装备小图后面。
// 各层的物品是各自的数据文件登记的，所以等它们都载入以后再挂（campaign-ui 最后调一次；多调不要紧）
export const ITEM_ICON_IDS = [];
export function assignItemIcons() {
  const add = Object.keys(DRAW).filter((id) => ITEMS[id] && !GEAR_ICON_IDS.includes(id));
  if (!add.length) return 0;
  registerIcons(Object.fromEntries(add.map((id) => [id, DRAW[id]])));
  for (const id of add) {
    GEAR_ICON_IDS.push(id);
    ITEM_ICON_IDS.push(id);
    const it = ITEMS[id];
    it.icon = "g" + (GEAR_ICON_IDS.length - 1);
    // 原来从别的图集取图的（相机、草料、菜青虫、三种鱼）也换成新画的
    delete it.frontierIcon;
    delete it.atlas;
  }
  return add.length;
}
assignItemIcons();
export const MISSING_ICONS = () => Object.keys(ITEMS).filter((id) => !GEAR_ICON_IDS.includes(id));
