// v0.22.0「披挂」的小图：装备和图纸的物品小图（16×16，拼成一张图集给物品格子用）、
// 穿在身上的样子、拿在手里的武器（挥动 3 帧）、陷阱、燃烧瓶的火、装着装备的柜子、行囊里的小人。
// 全部从调色板取色，画一次存起来。
import { PAL, OUTLINE, Pix, cached, makeCanvas, mix } from "./pixel-kit.js";
import { personSprite, PLAYER_LOOK } from "./pixel-sprites.js";
import { ARMOR, MELEE, GEAR_ICON_IDS, slotOf } from "./gear-data.js";

const S = 16;
const P16 = () => new Pix(S, S);

// ---------- 画小图用的几样东西 ----------
// 一根斜着的棍子（从左下到右上），w 粗细
function stick(P, x0, y0, x1, y1, c, light, w = 2) {
  for (let k = 0; k < w; k++) P.line(x0 + k, y0, x1 + k, y1, k === 0 && light ? light : c);
}
// 挖掉一块椭圆（变回透明）
function erase(P, cx, cy, rx, ry) {
  for (let y = Math.floor(-ry); y <= Math.ceil(ry); y++)
    for (let x = Math.floor(-rx); x <= Math.ceil(rx); x++) {
      if ((x * x) / (rx * rx + 0.3) + (y * y) / (ry * ry + 0.3) > 1) continue;
      const X = Math.round(cx + x),
        Y = Math.round(cy + y);
      if (X >= 0 && Y >= 0 && X < P.w && Y < P.h) P.d[(Y * P.w + X) * 4 + 3] = 0;
    }
}
// 一只侧面的鞋：后跟高、鞋头圆，底下一条鞋底；tall 是靴子
function shoe(P, x, y, c, dark, sole, tall = 0) {
  P.rect(x, y + 1 - tall, 4, 4 + tall, c);
  P.rect(x + 4, y + 2, 4, 3, c);
  P.set(x + 8, y + 3, c);
  P.set(x + 8, y + 4, c);
  P.hline(x + 1, x + 3, y + 1 - tall, dark);
  P.hline(x, x + 8, y + 5, sole);
  P.line(x + 4, y + 2, x + 6, y + 2, dark);
}
function rivets(P, pts, c) {
  for (const [x, y] of pts) P.set(x, y, c);
}
// 图纸：蓝色的纸，上面一个白色的小轮廓
function blueprint(P, draw) {
  P.rect(1, 2, 14, 12, PAL.night[2]);
  P.hline(1, 14, 2, PAL.night[3]);
  P.vline(14, 3, 13, PAL.night[1]);
  for (let x = 3; x < 14; x += 3) P.vline(x, 3, 13, PAL.night[1]);
  for (let y = 5; y < 14; y += 3) P.hline(2, 13, y, PAL.night[1]);
  P.rect(0, 1, 2, 14, PAL.straw[3]);
  P.vline(0, 1, 14, PAL.straw[2]);
  draw(PAL.snow[3]);
}

const ICONS = {
  // ---- 头 ----
  ragHood(P) {
    P.poly([[2, 9], [8, 3], [14, 9], [12, 11], [4, 11]], PAL.cloth[1]);
    P.hline(4, 12, 9, PAL.cloth[0]);
    P.line(6, 5, 10, 5, PAL.cloth[2]);
    P.rect(12, 10, 2, 4, PAL.cloth[0]);
    P.rect(13, 12, 2, 3, PAL.cloth[1]);
  },
  motoHelmet(P) {
    P.ellipse(8, 8, 6.5, 6, PAL.ember[1]);
    P.ellipse(7, 6, 4, 3, PAL.ember[2]);
    P.set(5, 4, PAL.ember[4]);
    P.set(6, 4, PAL.ember[3]);
    P.rect(3, 8, 11, 3, PAL.ash[1]);
    P.hline(4, 12, 8, PAL.stone[3]);
    P.rect(3, 12, 11, 2, PAL.ember[0]);
  },
  riotHelmet(P) {
    P.ellipse(8, 7, 6.5, 5.5, PAL.night[1]);
    P.ellipse(7, 5, 4, 2.5, PAL.night[2]);
    P.rect(2, 8, 13, 5, PAL.water[1]);
    P.hline(3, 13, 8, PAL.water[3]);
    P.set(4, 9, PAL.water[4]);
    P.set(5, 9, PAL.water[3]);
    P.hline(2, 14, 13, PAL.night[0]);
  },
  headlamp(P) {
    P.ellipse(8, 9, 6, 3, PAL.ash[2]);
    erase(P, 8, 9, 4.5, 1.6);
    P.rect(4, 8, 9, 2, PAL.ash[1]);
    P.rect(6, 4, 5, 5, PAL.ash[1]);
    P.rect(7, 5, 3, 3, PAL.straw[4]);
    P.set(7, 5, "#fff6d0");
    P.line(11, 3, 14, 1, PAL.straw[3]);
    P.line(11, 6, 15, 6, PAL.straw[3]);
  },
  // ---- 身 ----
  leatherJacket(P) {
    P.poly([[3, 3], [6, 2], [10, 2], [13, 3], [15, 9], [13, 10], [12, 7], [12, 14], [4, 14], [4, 7], [3, 10], [1, 9]], PAL.soil[2]);
    P.line(6, 2, 8, 6, PAL.soil[3]);
    P.line(10, 2, 8, 6, PAL.soil[3]);
    P.vline(8, 6, 13, PAL.stone[4]);
    P.hline(4, 12, 14, PAL.soil[1]);
    P.vline(12, 7, 13, PAL.soil[1]);
    P.set(10, 9, PAL.soil[1]);
    P.set(6, 9, PAL.soil[1]);
  },
  tireArmor(P) {
    P.rect(3, 3, 10, 11, PAL.ash[1]);
    P.rect(2, 3, 3, 3, PAL.ash[1]);
    P.rect(11, 3, 3, 3, PAL.ash[1]);
    for (let y = 4; y < 14; y += 2) for (let x = 3 + (y % 4 === 0 ? 1 : 0); x < 13; x += 3) P.set(x, y, PAL.ash[3]);
    P.hline(3, 12, 8, PAL.soil[2]);
    P.hline(3, 12, 9, PAL.soil[1]);
    P.vline(5, 1, 3, PAL.soil[2]);
    P.vline(10, 1, 3, PAL.soil[2]);
  },
  steelVest(P) {
    P.rect(3, 3, 10, 11, PAL.stone[3]);
    P.hline(3, 12, 3, PAL.stone[5]);
    P.vline(12, 4, 13, PAL.stone[2]);
    P.hline(3, 12, 8, PAL.stone[2]);
    P.hline(3, 12, 13, PAL.stone[1]);
    rivets(P, [[4, 4], [11, 4], [4, 7], [11, 7], [4, 10], [11, 10]], PAL.stone[5]);
    P.vline(5, 1, 3, PAL.soil[1]);
    P.vline(10, 1, 3, PAL.soil[1]);
    P.rect(1, 3, 2, 3, PAL.stone[4]);
    P.rect(13, 3, 2, 3, PAL.stone[2]);
  },
  riotSuit(P) {
    P.poly([[3, 3], [13, 3], [15, 10], [13, 11], [12, 7], [12, 14], [4, 14], [4, 7], [3, 11], [1, 10]], PAL.night[1]);
    P.rect(5, 5, 6, 5, PAL.night[2]);
    P.hline(5, 10, 5, PAL.night[3]);
    P.rect(1, 3, 4, 3, PAL.night[3]);
    P.rect(11, 3, 4, 3, PAL.night[2]);
    P.hline(4, 12, 14, PAL.night[0]);
    P.hline(4, 12, 11, PAL.ash[2]);
  },
  // ---- 手 ----
  ragGloves(P) {
    P.rect(4, 5, 7, 8, PAL.straw[2]);
    P.rect(4, 2, 2, 4, PAL.straw[2]);
    P.rect(6, 1, 2, 5, PAL.straw[3]);
    P.rect(8, 2, 2, 4, PAL.straw[2]);
    P.rect(10, 6, 3, 2, PAL.straw[2]);
    for (let y = 6; y < 13; y += 2) P.hline(4, 10, y, PAL.straw[1]);
    P.rect(4, 13, 7, 2, PAL.cloth[1]);
  },
  workGloves(P) {
    P.rect(4, 5, 7, 7, PAL.straw[1]);
    P.rect(4, 2, 2, 4, PAL.straw[1]);
    P.rect(6, 1, 2, 5, PAL.straw[2]);
    P.rect(8, 1, 2, 5, PAL.straw[1]);
    P.rect(10, 3, 2, 3, PAL.straw[1]);
    P.rect(11, 7, 3, 2, PAL.straw[1]);
    P.rect(3, 11, 9, 4, PAL.soil[2]);
    P.hline(3, 11, 11, PAL.soil[3]);
  },
  leatherBracers(P) {
    P.rect(4, 2, 8, 12, PAL.soil[2]);
    P.vline(4, 2, 13, PAL.soil[3]);
    P.vline(11, 2, 13, PAL.soil[1]);
    for (const y of [4, 8, 12]) {
      P.hline(3, 12, y, PAL.soil[0]);
      P.set(12, y, PAL.stone[4]);
    }
  },
  steelBracers(P) {
    P.rect(4, 2, 8, 12, PAL.stone[3]);
    P.vline(4, 2, 13, PAL.stone[5]);
    P.vline(11, 2, 13, PAL.stone[2]);
    P.hline(4, 11, 7, PAL.stone[2]);
    rivets(P, [[6, 4], [9, 4], [6, 10], [9, 10]], PAL.stone[5]);
    P.hline(3, 12, 13, PAL.soil[1]);
  },
  // ---- 腿 ----
  jeans(P) {
    P.rect(4, 1, 8, 4, PAL.night[3]);
    P.rect(4, 5, 3, 10, PAL.night[3]);
    P.rect(9, 5, 3, 10, PAL.night[2]);
    P.hline(4, 11, 1, PAL.soil[1]);
    P.set(8, 2, PAL.straw[3]);
    P.vline(8, 3, 5, PAL.night[1]);
    P.hline(4, 6, 10, PAL.night[2]);
  },
  kneePads(P) {
    P.rect(2, 3, 5, 11, PAL.night[2]);
    P.rect(9, 3, 5, 11, PAL.night[1]);
    P.rect(2, 6, 5, 4, PAL.ash[2]);
    P.rect(9, 6, 5, 4, PAL.ash[2]);
    P.hline(2, 6, 6, PAL.stone[3]);
    P.hline(9, 13, 6, PAL.stone[3]);
  },
  motoGreaves(P) {
    P.rect(2, 2, 5, 12, PAL.ember[1]);
    P.rect(9, 2, 5, 12, PAL.ember[0]);
    P.hline(2, 6, 2, PAL.ember[3]);
    P.hline(9, 13, 2, PAL.ember[2]);
    P.rect(3, 6, 3, 3, PAL.ash[1]);
    P.rect(10, 6, 3, 3, PAL.ash[1]);
    P.hline(2, 6, 13, PAL.ash[1]);
    P.hline(9, 13, 13, PAL.ash[1]);
  },
  // ---- 脚 ----
  clothShoes(P) {
    shoe(P, 1, 4, PAL.straw[1], PAL.straw[0], PAL.soil[1]);
    shoe(P, 6, 9, PAL.straw[2], PAL.straw[0], PAL.soil[1]);
  },
  softShoes(P) {
    shoe(P, 1, 4, PAL.stone[3], PAL.stone[2], PAL.ash[2]);
    shoe(P, 6, 9, PAL.stone[4], PAL.stone[2], PAL.ash[2]);
    P.set(9, 12, PAL.cloth[2]);
  },
  workBoots(P) {
    shoe(P, 1, 5, PAL.soil[1], PAL.soil[0], PAL.ash[1], 3);
    shoe(P, 6, 9, PAL.soil[2], PAL.soil[1], PAL.ash[1], 3);
    P.hline(7, 9, 8, PAL.straw[2]);
    P.hline(7, 9, 10, PAL.straw[2]);
  },
  // ---- 近战 ----
  bat(P) {
    stick(P, 3, 13, 12, 3, PAL.soil[3], PAL.soil[4], 3);
    P.line(2, 14, 4, 12, PAL.soil[1]);
    rivets(P, [[10, 3], [13, 4], [12, 7], [9, 6], [14, 2]], PAL.stone[5]);
  },
  pipe(P) {
    stick(P, 3, 13, 13, 3, PAL.stone[3], PAL.stone[5], 3);
    P.rect(11, 2, 4, 3, PAL.stone[2]);
    P.rect(2, 12, 3, 3, PAL.stone[2]);
  },
  sledge(P) {
    stick(P, 3, 14, 9, 6, PAL.soil[3], PAL.soil[4], 2);
    P.rect(6, 1, 9, 6, PAL.stone[2]);
    P.hline(6, 14, 1, PAL.stone[4]);
    P.vline(14, 2, 6, PAL.stone[1]);
    P.set(7, 2, PAL.stone[5]);
  },
  knife(P) {
    P.poly([[4, 12], [12, 3], [14, 3], [8, 11]], PAL.stone[4]);
    P.line(12, 3, 6, 10, PAL.stone[5]);
    P.rect(2, 11, 4, 4, PAL.soil[1]);
    P.set(3, 12, PAL.soil[3]);
  },
  machete(P) {
    P.poly([[5, 11], [13, 1], [15, 2], [15, 5], [8, 12]], PAL.stone[4]);
    P.line(13, 1, 6, 10, PAL.stone[5]);
    P.line(15, 4, 9, 11, PAL.stone[2]);
    P.rect(2, 11, 4, 4, PAL.ash[1]);
    P.set(3, 12, PAL.ash[3]);
  },
  axe(P) {
    stick(P, 3, 14, 11, 3, PAL.soil[3], PAL.soil[4], 2);
    P.poly([[8, 1], [14, 1], [15, 6], [11, 6], [9, 4]], PAL.cloth[1]);
    P.line(14, 1, 15, 6, PAL.stone[5]);
    P.set(9, 2, PAL.cloth[2]);
  },
  spear(P) {
    stick(P, 1, 15, 12, 4, PAL.soil[3], PAL.soil[4], 2);
    P.poly([[11, 4], [15, 0], [13, 5]], PAL.straw[3]);
    P.line(10, 6, 12, 4, PAL.straw[2]);
  },
  ironspear(P) {
    stick(P, 1, 15, 11, 5, PAL.soil[3], PAL.soil[4], 2);
    P.poly([[10, 4], [15, 0], [13, 6], [11, 6]], PAL.stone[4]);
    P.line(15, 0, 11, 5, PAL.stone[5]);
    P.rect(9, 6, 2, 2, PAL.cloth[0]);
  },
  // ---- 远程 ----
  slingshot(P) {
    P.vline(7, 8, 14, PAL.soil[2]);
    P.vline(8, 8, 14, PAL.soil[3]);
    P.line(7, 8, 3, 2, PAL.soil[2]);
    P.line(8, 8, 12, 2, PAL.soil[3]);
    P.line(3, 2, 7, 6, PAL.cloth[1]);
    P.line(12, 2, 8, 6, PAL.cloth[1]);
    P.rect(7, 6, 2, 2, PAL.soil[1]);
  },
  crossbow(P) {
    P.rect(2, 7, 11, 3, PAL.soil[2]);
    P.hline(2, 12, 7, PAL.soil[3]);
    P.line(10, 1, 13, 8, PAL.stone[3]);
    P.line(13, 9, 10, 15, PAL.stone[3]);
    P.line(10, 1, 4, 8, PAL.straw[4]);
    P.line(4, 8, 10, 15, PAL.straw[4]);
    P.hline(4, 15, 6, PAL.stone[4]);
    P.rect(1, 9, 3, 4, PAL.soil[1]);
  },
  bolt(P) {
    for (const [o, c] of [[0, PAL.soil[3]], [4, PAL.soil[2]]]) {
      P.line(2, 12 - o, 12, 2 - o + 4, c);
      P.set(13, 6 - o, PAL.stone[4]);
      P.set(12, 5 - o, PAL.stone[4]);
      P.set(2, 11 - o, PAL.cloth[2]);
      P.set(3, 13 - o, PAL.cloth[2]);
    }
  },
  // ---- 投掷 ----
  firecracker(P) {
    for (const x of [3, 7, 11]) {
      P.rect(x, 5, 3, 9, PAL.cloth[1]);
      P.vline(x, 5, 13, PAL.cloth[2]);
      P.hline(x, x + 2, 9, PAL.straw[3]);
    }
    P.line(8, 5, 10, 1, PAL.straw[2]);
    P.set(11, 0, PAL.ember[5]);
    P.set(10, 1, PAL.ember[4]);
  },
  molotov(P) {
    P.rect(5, 6, 6, 9, PAL.leaf[2]);
    P.rect(6, 3, 4, 3, PAL.leaf[2]);
    P.vline(6, 7, 13, PAL.leaf[4]);
    P.rect(5, 10, 6, 5, PAL.ember[2]);
    P.rect(6, 1, 4, 3, PAL.straw[3]);
    P.set(8, 0, PAL.ember[4]);
    P.set(9, 0, PAL.ember[5]);
    P.set(7, 0, PAL.ember[3]);
  },
  // ---- 陷阱 ----
  bearTrap(P) {
    P.ellipse(8, 9, 6.5, 4, PAL.stone[2]);
    erase(P, 8, 9, 4.5, 2.3);
    for (let x = 3; x <= 13; x += 2) {
      P.set(x, 5, PAL.stone[5]);
      P.set(x, 13, PAL.stone[4]);
    }
    P.rect(7, 8, 3, 2, PAL.rust[2]);
    P.hline(1, 15, 9, PAL.stone[3]);
  },
  spikeBoard(P) {
    P.rect(1, 8, 14, 5, PAL.soil[3]);
    P.hline(1, 14, 8, PAL.soil[4]);
    P.hline(1, 14, 12, PAL.soil[1]);
    for (let x = 2; x < 15; x += 3) {
      P.vline(x, 4, 8, PAL.stone[4]);
      P.set(x, 3, PAL.stone[5]);
    }
  },
  diySuppressor(P) {
    P.rect(3, 5, 11, 6, PAL.stone[2]);
    P.hline(3, 13, 5, PAL.stone[4]);
    P.hline(3, 13, 10, PAL.stone[1]);
    for (const x of [6, 9, 12]) P.vline(x, 6, 9, PAL.stone[1]);
    P.rect(1, 6, 2, 4, PAL.ash[2]);
    P.rect(14, 7, 2, 2, PAL.ash[0]);
  },
};
// 图纸：画它能做的东西的轮廓
const BP_DRAW = {
  bp_machete: (P, c) => P.line(4, 11, 12, 4, c) || P.line(5, 11, 13, 4, c),
  bp_steelVest: (P, c) => {
    P.hline(5, 11, 5, c);
    P.hline(5, 11, 11, c);
    P.vline(5, 5, 11, c);
    P.vline(11, 5, 11, c);
  },
  bp_sledge: (P, c) => {
    P.line(5, 12, 9, 7, c);
    P.hline(7, 12, 5, c);
    P.hline(7, 12, 7, c);
  },
  bp_molotov: (P, c) => {
    P.vline(7, 6, 12, c);
    P.vline(10, 6, 12, c);
    P.hline(7, 10, 12, c);
    P.set(8, 4, c);
  },
  bp_bracer: (P, c) => {
    P.vline(6, 4, 12, c);
    P.vline(10, 4, 12, c);
    P.hline(6, 10, 8, c);
  },
  bp_crossbow: (P, c) => {
    P.hline(4, 12, 8, c);
    P.line(10, 4, 12, 8, c);
    P.line(12, 8, 10, 12, c);
  },
  bp_suppressor: (P, c) => {
    P.hline(4, 12, 6, c);
    P.hline(4, 12, 10, c);
    P.vline(4, 6, 10, c);
    P.vline(12, 6, 10, c);
  },
};
// v0.25：别的物品的小图也挂进来（item-sprites.js），和装备小图拼在同一张图集里
export function registerIcons(map) {
  for (const [id, draw] of Object.entries(map || {})) ICONS[id] ??= draw;
  sheet = null;
}
export function gearIcon(id) {
  return cached("gicon:" + id, () => {
    const P = P16(),
      draw = ICONS[id];
    if (draw) draw(P);
    else if (BP_DRAW[id]) blueprint(P, (c) => BP_DRAW[id](P, c));
    else {
      P.rect(3, 3, 10, 10, PAL.stone[3]);
      P.hline(3, 12, 3, PAL.stone[5]);
    }
    P.outline(OUTLINE);
    return P;
  });
}
// 物品格子用的图集：8 列，每格 16 像素
export const SHEET_COLS = 8;
let sheet = null;
export function gearIconSheet() {
  if (sheet) return sheet;
  const rows = Math.ceil(GEAR_ICON_IDS.length / SHEET_COLS),
    P = new Pix(SHEET_COLS * S, rows * S);
  GEAR_ICON_IDS.forEach((id, i) => P.stamp(gearIcon(id), (i % SHEET_COLS) * S, Math.floor(i / SHEET_COLS) * S));
  const canvas = P.toCanvas();
  let url = null;
  try {
    url = canvas?.toDataURL ? canvas.toDataURL("image/png") : null;
  } catch {
    url = null;
  }
  sheet = { canvas, url, cols: SHEET_COLS, rows, cell: S };
  return sheet;
}
// "g12" → 图集里的第几格
export const gearIconIndex = (icon) => (typeof icon === "string" && icon[0] === "g" ? Number(icon.slice(1)) : -1);

// ---------- 穿在身上 ----------
// 主角的样子：在原来的长相上叠上身上穿的
export function gearLook(slots = {}) {
  const look = { ...PLAYER_LOOK },
    sig = [];
  for (const k of ["head", "body", "hands", "legs", "feet"]) {
    const id = slots[k],
      L = ARMOR[id]?.look;
    if (!L) continue;
    sig.push(id);
    if (L.hat) look.hat = L.hat;
    if (L.armor) look.armor = L.armor;
    if (L.gloves) look.glove = L.gloves;
    if (L.legs) look.legs = L.legs;
    if (L.boots) look.feet = L.boots;
  }
  // 戴头盔时把乱发收进去
  if (["moto", "riot"].includes(look.hat)) look.style = "short";
  if (look.armor === "coat" || look.armor === "riot") look.scarf = null;
  look.sig = "gear:" + sig.join(",");
  return look;
}

// ---------- 拿在手里的武器 ----------
// 横着画（握把在左边原点，朝右），画的时候按朝向转
const HELD = {
  club: { len: 15, draw: (P) => (P.rect(0, 1, 12, 2, PAL.soil[3]), P.rect(10, 0, 5, 4, PAL.soil[3]), P.hline(0, 14, 1, PAL.soil[4])) },
  bat: { len: 16, draw: (P) => (P.rect(0, 1, 12, 2, PAL.soil[3]), P.rect(9, 0, 7, 4, PAL.soil[3]), P.hline(0, 15, 1, PAL.soil[4]), rivets(P, [[11, -1], [14, -1], [12, 4], [15, 4]].map(([x, y]) => [x, y + 1]), PAL.stone[5])) },
  pipe: { len: 16, draw: (P) => (P.rect(0, 1, 16, 2, PAL.stone[3]), P.hline(0, 15, 1, PAL.stone[5]), P.rect(14, 0, 2, 4, PAL.stone[2])) },
  crowbar: { len: 15, draw: (P) => (P.rect(0, 1, 13, 2, PAL.cloth[1]), P.hline(0, 12, 1, PAL.cloth[2]), P.rect(13, 0, 2, 2, PAL.cloth[1]), P.set(14, 3, PAL.cloth[1])) },
  sledge: { len: 17, draw: (P) => (P.rect(0, 2, 12, 2, PAL.soil[3]), P.rect(11, 0, 6, 6, PAL.stone[2]), P.hline(11, 16, 0, PAL.stone[4])) },
  knife: { len: 10, draw: (P) => (P.rect(0, 1, 3, 2, PAL.soil[1]), P.rect(3, 1, 7, 2, PAL.stone[4]), P.hline(3, 9, 1, PAL.stone[5])) },
  machete: { len: 14, draw: (P) => (P.rect(0, 1, 3, 2, PAL.ash[1]), P.rect(3, 0, 11, 3, PAL.stone[4]), P.hline(3, 13, 0, PAL.stone[5])) },
  axe: { len: 15, draw: (P) => (P.rect(0, 2, 13, 2, PAL.soil[3]), P.rect(10, 0, 4, 2, PAL.cloth[1]), P.rect(12, 0, 3, 6, PAL.cloth[1]), P.vline(14, 0, 5, PAL.stone[5])) },
  spear: { len: 22, draw: (P) => (P.rect(0, 1, 19, 2, PAL.soil[3]), P.hline(0, 18, 1, PAL.soil[4]), P.poly([[19, 0], [23, 2], [19, 4]], PAL.straw[3])) },
  ironspear: { len: 23, draw: (P) => (P.rect(0, 1, 19, 2, PAL.soil[3]), P.hline(0, 18, 1, PAL.soil[4]), P.poly([[18, -1], [24, 2], [18, 5]], PAL.stone[4]), P.rect(17, 1, 2, 2, PAL.cloth[0])) },
  slingshot: { len: 8, draw: (P) => (P.rect(0, 1, 4, 2, PAL.soil[2]), P.line(4, 1, 7, -1, PAL.soil[3]), P.line(4, 2, 7, 4, PAL.soil[3]), P.vline(7, -1, 4, PAL.cloth[1])) },
  crossbow: { len: 14, draw: (P) => (P.rect(0, 1, 12, 3, PAL.soil[2]), P.hline(0, 11, 1, PAL.soil[3]), P.line(10, -4, 12, 2, PAL.stone[3]), P.line(12, 3, 10, 8, PAL.stone[3]), P.line(10, -4, 6, 2, PAL.straw[4]), P.line(6, 3, 10, 8, PAL.straw[4])) },
};
export const HELD_IDS = Object.keys(HELD);
export function heldSprite(id) {
  const h = HELD[id];
  if (!h) return null;
  return cached("held:" + id, () => {
    const P = new Pix(h.len + 4, 14);
    const inner = new Pix(h.len + 4, 14);
    h.draw({
      rect: (x, y, w, hh, c) => inner.rect(x + 1, y + 5, w, hh, c),
      hline: (x0, x1, y, c) => inner.hline(x0 + 1, x1 + 1, y + 5, c),
      vline: (x, y0, y1, c) => inner.vline(x + 1, y0 + 5, y1 + 5, c),
      line: (x0, y0, x1, y1, c) => inner.line(x0 + 1, y0 + 5, x1 + 1, y1 + 5, c),
      poly: (pts, c) => inner.poly(pts.map(([x, y]) => [x + 1, y + 5]), c),
      set: (x, y, c) => inner.set(x + 1, y + 5, c),
    });
    P.stamp(inner, 0, 0);
    P.outline(OUTLINE);
    return { canvas: P.toCanvas(), ox: 1, oy: 7 };
  });
}
// rivets() 也给 HELD 里用（它的参数是 Pix 或者上面那个包装）
// 挥动：0–1 的进度 → 相对朝向的角度偏移（钝器、利器挥一圈；长柄往前捅）
export function swingPose(kind, t) {
  if (kind === "pole") return { rot: 0, push: Math.sin(Math.min(1, t) * Math.PI) * 12 };
  if (kind === "shove") return { rot: 0, push: Math.sin(Math.min(1, t) * Math.PI) * 6 };
  const k = Math.min(1, Math.max(0, t));
  // 三段：抬起 → 劈下 → 收势
  const rot = k < 0.25 ? -1.1 * (k / 0.25) : k < 0.7 ? -1.1 + 2.2 * ((k - 0.25) / 0.45) : 1.1 - 0.5 * ((k - 0.7) / 0.3);
  return { rot, push: 0 };
}
export const meleeKind = (id) => MELEE[id]?.kind || (id === "slingshot" || id === "crossbow" ? "ranged" : null);

// ---------- 地上的东西 ----------
export function trapSprite(kind, sprung = false) {
  return cached("trap:" + kind + ":" + (sprung ? 1 : 0), () => {
    const P = new Pix(16, 10);
    if (kind === "bearTrap") {
      P.ellipse(8, 5, 7, 3.5, PAL.stone[2]);
      erase(P, 8, 5, 5, 2);
      if (sprung) P.hline(2, 13, 5, PAL.stone[4]);
      else {
        for (let x = 2; x <= 14; x += 2) {
          P.set(x, 1, PAL.stone[5]);
          P.set(x, 8, PAL.stone[4]);
        }
        P.rect(7, 4, 3, 2, PAL.rust[2]);
      }
    } else {
      P.rect(1, 3, 14, 5, PAL.soil[3]);
      P.hline(1, 14, 3, PAL.soil[4]);
      P.hline(1, 14, 7, PAL.soil[1]);
      for (let x = 2; x < 15; x += 3) P.vline(x, 0, 3, PAL.stone[4]);
    }
    P.outline(OUTLINE);
    return P.toCanvas();
  });
}
// 燃烧瓶的火：一圈火苗，3 帧
export function fireSprite(frame) {
  return cached("gfire:" + frame, () => {
    const P = new Pix(40, 22);
    for (let i = 0; i < 9; i++) {
      const x = 4 + i * 4,
        h = 6 + ((i * 5 + frame * 3) % 7),
        base = 16 + ((i * 3) % 4) - 2;
      P.rect(x, base - h, 3, h, PAL.ember[2]);
      P.rect(x, base - h + 2, 3, h - 2, PAL.ember[3]);
      P.vline(x + 1, base - h + 3, base - 1, PAL.ember[4]);
      P.set(x + 1, base - h - 1, PAL.ember[5]);
    }
    P.ellipse(20, 18, 18, 3, PAL.ash[1], 0.7);
    P.outline(OUTLINE, 0.6);
    return P.toCanvas();
  });
}
// 装着装备的柜子：铁皮柜、工具箱、急救箱
export function gearCrateSprite(open = false) {
  return cached("gcrate:" + (open ? 1 : 0), () => {
    const P = new Pix(20, 22);
    P.rect(2, 3, 16, 18, PAL.stone[2]);
    P.hline(2, 17, 3, PAL.stone[4]);
    P.vline(17, 4, 20, PAL.stone[1]);
    P.vline(10, 4, 20, PAL.stone[1]);
    for (const y of [6, 8]) {
      P.hline(4, 8, y, PAL.stone[1]);
      P.hline(12, 16, y, PAL.stone[1]);
    }
    P.rect(8, 11, 1, 3, PAL.straw[3]);
    P.rect(11, 11, 1, 3, PAL.straw[3]);
    P.rect(3, 17, 6, 2, PAL.rust[1]);
    P.set(15, 15, PAL.rust[2]);
    if (open) P.rect(11, 4, 6, 16, PAL.ash[0]);
    P.outline(OUTLINE);
    return P.toCanvas();
  });
}

// ---------- 行囊里的小人 ----------
// 把穿着装备的主角放大画在一块小画布上
export function paintDoll(canvas, slots, broken = {}) {
  if (!canvas?.getContext) return false;
  const look = gearLook(slots),
    spr = personSprite(look, "doll", "down", 0, "walk");
  if (!spr) return false;
  const ctx = canvas.getContext("2d"),
    W = canvas.width || 88,
    H = canvas.height || 132,
    k = Math.max(1, Math.floor(Math.min(W / spr.width, H / spr.height)));
  ctx.clearRect(0, 0, W, H);
  ctx.imageSmoothingEnabled = false;
  const x = Math.round((W - spr.width * k) / 2),
    y = Math.round((H - spr.height * k) / 2);
  ctx.drawImage(spr, x, y, spr.width * k, spr.height * k);
  // 坏了的那件身上画裂纹
  const crack = { head: [11, 4], body: [11, 18], hands: [3, 21], legs: [9, 27], feet: [13, 31] };
  ctx.fillStyle = "#e9806e";
  for (const [slot, on] of Object.entries(broken)) {
    if (!on || !crack[slot]) continue;
    const [cx, cy] = crack[slot];
    for (const [dx, dy] of [[0, 0], [1, 1], [0, 2], [1, 3]]) ctx.fillRect(x + (cx + dx) * k, y + (cy + dy) * k, k, k);
  }
  return true;
}
// 物品格子里的图：给 styleIcons 用
export function paintGearIcon(el, icon, size = 36) {
  const sh = gearIconSheet(),
    i = gearIconIndex(icon);
  if (!sh?.url || i < 0) return false;
  el.style.backgroundImage = `url("${sh.url}")`;
  el.style.backgroundSize = `${sh.cols * size}px ${sh.rows * size}px`;
  el.style.backgroundPosition = `${-(i % sh.cols) * size}px ${-Math.floor(i / sh.cols) * size}px`;
  return true;
}
export const slotOfGear = slotOf;
export const tint = (c, t) => mix(c, "#ffffff", t);
export { makeCanvas };
