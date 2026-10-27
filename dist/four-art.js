// v0.44.0「四季」：旧图集转出来的小图重画。
// 原来三张旧图集（物品与人物、扩建、边境）在新画面里是“每 5×5 取平均色”转出来的，糊、颜色发闷，和别的画不搭。
// 按方案的图标规矩重画：16×16 美术像素（格子里显示 2–4 倍）、1 像素深色外框（gearIcon 统一描）、光从左上来、每样 3–4 种颜色加一点高光。
// · 建造页、快捷栏“建造”那一格：每样设施一个图标（原来好几样共用一个箱子图）；
// · 场景里：补给箱、地区里的各个点、病毒样本、日记、供电控制盒、封闭检修间的门、通信站，换成新画的（能用设施、物品的新画就用它们）。
import { PAL, Pix, cached, OUTLINE } from "./pixel-kit.js";
import { registerIcons, gearIcon } from "./gear-sprites.js";
import { GEAR_ICON_IDS } from "./gear-data.js";
import { BUILDINGS } from "./data.js";
import { buildingArt } from "./pixel-props.js";

const A = PAL.ash,
  So = PAL.soil,
  E = PAL.ember,
  St = PAL.straw,
  L = PAL.leaf,
  W = PAL.water,
  Ro = PAL.stone,
  R = PAL.rust,
  N = PAL.night,
  Cl = PAL.cloth,
  Sn = PAL.snow;

// ================= 设施图标（16×16） =================
const tree = (fruit, lit) => (P) => {
  P.rect(7, 10, 2, 5, So[2]);
  P.vline(8, 10, 14, So[1]);
  P.hline(6, 9, 12, St[2]);
  P.ellipse(8, 6, 6, 4.6, L[3]);
  P.ellipse(7, 5, 3.6, 2.6, L[4]);
  P.set(5, 4, L[5]);
  P.set(6, 3, L[5]);
  P.hline(6, 11, 10, L[2]);
  P.set(12, 8, L[2]);
  for (const [x, y] of [[4, 7], [10, 4], [12, 6], [8, 8]]) {
    P.set(x, y, fruit);
    P.set(x - 1, y, fruit);
    P.set(x - 1, y - 1, lit);
  }
};
export const BUILD_ICONS = {
  // 扩建农田：一块翻好的地、两棵苗、角上一个加号
  field(P) {
    P.rect(1, 8, 13, 6, So[2]);
    P.hline(1, 13, 8, So[3]);
    for (const y of [10, 12]) {
      P.hline(1, 13, y, So[1]);
      P.hline(2, 12, y - 1, So[3]);
    }
    P.vline(13, 9, 13, So[1]);
    for (const x of [4, 9]) {
      P.vline(x, 5, 8, L[2]);
      P.set(x - 1, 5, L[4]);
      P.set(x + 1, 4, L[5]);
      P.set(x + 1, 6, L[3]);
    }
    P.rect(12, 1, 1, 5, E[4]);
    P.rect(10, 3, 5, 1, E[4]);
    P.set(12, 3, E[5]);
  },
  // 稻草人：十字木架、草帽、补丁衣服
  scarecrow(P) {
    P.vline(7, 4, 15, So[2]);
    P.vline(8, 4, 15, So[1]);
    P.hline(1, 14, 7, So[3]);
    P.hline(1, 14, 8, So[1]);
    P.rect(5, 7, 6, 5, Cl[1]);
    P.hline(5, 10, 7, Cl[2]);
    P.rect(6, 9, 2, 2, St[2]);
    P.vline(10, 8, 11, Cl[0]);
    P.set(1, 7, St[3]);
    P.set(14, 7, St[3]);
    P.set(1, 9, St[2]);
    P.set(14, 9, St[2]);
    P.disc(7.5, 3.5, 2, St[3]);
    P.set(6, 3, A[1]);
    P.set(9, 3, A[1]);
    P.hline(3, 12, 2, St[1]);
    P.rect(5, 1, 6, 1, St[2]);
  },
  // 堆肥桶：木板条的桶，上面露着菜叶和果皮
  compost(P) {
    P.rect(3, 6, 10, 8, So[2]);
    for (const x of [5, 8, 11]) P.vline(x, 7, 13, So[0]);
    P.vline(3, 6, 13, So[3]);
    P.hline(3, 12, 6, So[4]);
    P.hline(3, 12, 13, So[1]);
    P.hline(4, 11, 5, So[0]);
    for (const [x, y, c] of [[4, 4, L[4]], [5, 3, L[5]], [7, 4, E[3]], [9, 3, L[3]], [10, 4, St[3]], [11, 3, L[4]], [6, 4, So[1]]]) P.set(x, y, c);
  },
  // 育种箱：木盘里三棵苗
  breeder(P) {
    P.rect(1, 9, 14, 5, So[2]);
    P.hline(1, 14, 9, So[4]);
    P.hline(1, 14, 13, So[1]);
    P.vline(5, 10, 12, So[1]);
    P.vline(10, 10, 12, So[1]);
    P.hline(2, 13, 10, So[0]);
    for (const [x, h] of [[3, 3], [8, 5], [12, 4]]) {
      P.vline(x, 9 - h, 9, L[2]);
      P.set(x - 1, 9 - h, L[4]);
      P.set(x + 1, 9 - h + 1, L[3]);
      P.set(x - 1, 9 - h - 1, L[5]);
    }
  },
  // 鸡舍：红屋顶的小木屋、门口一个蛋
  coop(P) {
    P.poly([[1, 8], [8, 2], [15, 8]], Cl[1]);
    P.line(1, 8, 8, 2, Cl[2]);
    P.line(8, 2, 14, 7, Cl[0]);
    P.rect(3, 8, 10, 6, So[2]);
    P.vline(3, 8, 13, So[3]);
    P.hline(3, 12, 13, So[1]);
    P.rect(6, 10, 3, 4, So[0]);
    P.set(6, 10, A[1]);
    P.ellipse(11.5, 12, 1.5, 1.8, Sn[4]);
    P.set(11, 11, "#fffdf2");
    P.hline(2, 14, 14, St[1]);
  },
  alTree_mulberry: tree(N[2], N[3]),
  alTree_peach: tree(Cl[2], E[5]),
  alTree_apple: tree(Cl[1], Cl[2]),
  alTree_persimmon: tree(E[3], E[4]),
  // 喷灌头：地上的水管、竖管、喷头两边甩出水
  irrigation(P) {
    P.hline(1, 14, 13, Ro[2]);
    P.hline(1, 14, 12, Ro[3]);
    P.vline(7, 6, 12, Ro[3]);
    P.vline(8, 6, 12, Ro[1]);
    P.rect(6, 4, 4, 2, Ro[4]);
    P.hline(6, 9, 4, Ro[5]);
    for (const [x, y, c] of [[5, 3, W[4]], [3, 3, W[5]], [2, 5, W[4]], [1, 7, W[3]], [10, 3, W[4]], [12, 3, W[5]], [13, 5, W[4]], [14, 7, W[3]], [4, 6, W[5]], [11, 6, W[5]]]) P.set(x, y, c);
  },
  // 温室：玻璃房子、里面的绿苗
  greenhouse(P) {
    P.poly([[1, 7], [8, 2], [15, 7]], W[5]);
    P.line(1, 7, 8, 2, Sn[4]);
    P.rect(2, 7, 12, 7, W[4]);
    P.rect(3, 10, 10, 3, L[3]);
    P.hline(3, 12, 10, L[4]);
    for (const x of [2, 6, 10, 13]) P.vline(x, 7, 13, Ro[3]);
    P.hline(2, 13, 7, Ro[4]);
    P.hline(2, 13, 13, Ro[2]);
    P.line(8, 2, 8, 7, Ro[3]);
    P.set(4, 8, Sn[4]);
    P.set(4, 9, Sn[3]);
  },
  // 仓库箱：木箱、铁箍、铜搭扣
  chest(P) {
    P.rect(2, 6, 12, 8, So[2]);
    P.rect(2, 4, 12, 3, So[3]);
    P.hline(2, 13, 4, So[4]);
    P.hline(2, 13, 7, So[1]);
    P.hline(2, 13, 13, So[1]);
    for (const x of [4, 11]) {
      P.vline(x, 4, 13, Ro[2]);
      P.set(x, 4, Ro[4]);
    }
    P.rect(7, 7, 2, 2, St[3]);
    P.set(7, 7, St[4]);
    P.set(8, 9, So[0]);
  },
  // 篝火灶：石头圈、火、上面一口锅
  cook(P) {
    P.rect(4, 3, 8, 4, A[3]);
    P.hline(4, 11, 3, Ro[4]);
    P.hline(3, 12, 4, Ro[3]);
    P.vline(11, 4, 6, A[2]);
    P.set(3, 4, Ro[2]);
    P.set(12, 4, Ro[2]);
    for (const [x, y, c] of [[6, 8, E[3]], [7, 9, E[4]], [8, 8, E[5]], [9, 9, E[3]], [7, 10, E[5]], [8, 10, E[4]], [10, 10, E[2]], [5, 10, E[2]], [6, 11, E[3]], [9, 11, E[3]]]) P.set(x, y, c);
    for (const [x, c] of [[3, Ro[3]], [6, Ro[4]], [9, Ro[3]], [12, Ro[2]]]) {
      P.rect(x - 1, 12, 3, 2, c);
      P.set(x - 1, 12, Ro[5]);
    }
  },
  // 制作台：木桌、锤子、钳子
  workbench(P) {
    P.rect(1, 7, 14, 2, So[3]);
    P.hline(1, 14, 7, So[4]);
    P.hline(1, 14, 8, So[1]);
    P.vline(2, 9, 14, So[2]);
    P.vline(13, 9, 14, So[2]);
    P.hline(2, 13, 11, So[1]);
    P.hline(3, 9, 5, So[3]);
    P.rect(9, 4, 3, 2, Ro[3]);
    P.set(9, 4, Ro[5]);
    P.line(12, 5, 14, 3, Ro[2]);
    P.set(14, 2, Ro[4]);
  },
  // 武器工作台：桌上一把枪、右边一个台钳
  weaponbench(P) {
    P.rect(1, 8, 14, 2, So[3]);
    P.hline(1, 14, 8, So[4]);
    P.hline(1, 14, 9, So[1]);
    P.vline(2, 10, 14, So[2]);
    P.vline(13, 10, 14, So[2]);
    P.rect(2, 5, 7, 2, A[3]);
    P.hline(2, 8, 5, Ro[3]);
    P.rect(3, 7, 2, 1, So[2]);
    P.rect(10, 4, 3, 4, Ro[2]);
    P.hline(10, 12, 4, Ro[4]);
    P.hline(9, 13, 6, Ro[3]);
  },
  // 居民床位：床头、枕头、绿被子
  bed(P) {
    P.rect(1, 5, 2, 9, So[2]);
    P.set(1, 5, So[4]);
    P.rect(3, 9, 12, 3, Sn[3]);
    P.rect(3, 8, 3, 2, Sn[4]);
    P.rect(6, 8, 9, 4, L[2]);
    P.hline(6, 14, 8, L[3]);
    P.vline(6, 8, 11, L[1]);
    P.hline(3, 14, 12, So[1]);
    P.vline(14, 12, 14, So[2]);
    P.vline(3, 12, 14, So[2]);
  },
  // 火炉：铁炉子、炉门里有火、烟囱
  stove(P) {
    P.rect(3, 6, 10, 7, A[3]);
    P.hline(3, 12, 6, A[4]);
    P.vline(3, 6, 12, A[4]);
    P.hline(2, 13, 5, Ro[2]);
    P.rect(5, 8, 6, 3, E[2]);
    P.rect(6, 9, 4, 1, E[4]);
    P.set(7, 9, E[5]);
    P.rect(10, 1, 2, 4, Ro[2]);
    P.set(10, 1, Ro[4]);
    P.set(4, 13, A[2]);
    P.set(11, 13, A[2]);
  },
  // 腌缸：陶缸、口上蒙着布、扎着绳
  alPickleJar(P) {
    P.ellipse(8, 10, 5.5, 4.2, So[3]);
    P.ellipse(6.5, 9, 2.2, 2.2, So[4]);
    P.hline(4, 12, 13, So[1]);
    P.rect(5, 5, 6, 2, So[2]);
    P.rect(4, 3, 8, 2, Cl[5]);
    P.hline(4, 11, 3, Sn[4]);
    P.hline(4, 11, 5, St[1]);
    P.set(12, 5, St[1]);
    P.set(13, 6, St[1]);
    P.hline(3, 13, 10, So[2]);
  },
  // 重建站：两根柱子撑着一块板，板上贴着清单和一张房子的图
  rlStation(P) {
    P.vline(3, 10, 14, So[2]);
    P.vline(12, 10, 14, So[2]);
    P.rect(1, 2, 14, 9, So[3]);
    P.hline(1, 14, 2, So[4]);
    P.hline(1, 14, 10, So[1]);
    P.rect(3, 4, 5, 6, Sn[4]);
    for (const y of [5, 7]) P.hline(4, 6, y, Ro[3]);
    P.set(4, 9, L[3]);
    P.poly([[9, 6], [11, 4], [13, 6]], E[3]);
    P.rect(10, 6, 3, 3, St[3]);
    P.set(11, 7, So[1]);
  },
  // 围栏：两根尖头桩、两道横木
  fence(P) {
    for (const x of [2, 12]) {
      P.rect(x, 4, 2, 10, So[2]);
      P.set(x, 3, So[3]);
      P.vline(x, 4, 13, So[3]);
    }
    for (const y of [6, 10]) {
      P.rect(1, y, 14, 2, So[3]);
      P.hline(1, 14, y, So[4]);
      P.hline(1, 14, y + 1, So[1]);
    }
  },
  // 营地大门：两根粗柱子、木板门、一道斜撑
  gate(P) {
    P.rect(1, 2, 2, 12, So[1]);
    P.rect(13, 2, 2, 12, So[1]);
    P.vline(1, 2, 13, So[2]);
    P.vline(13, 2, 13, So[2]);
    P.hline(1, 14, 3, So[2]);
    P.rect(3, 5, 10, 9, So[3]);
    for (const x of [5, 8, 11]) P.vline(x, 5, 13, So[2]);
    P.line(3, 13, 12, 6, So[1]);
    P.hline(3, 12, 5, So[4]);
    P.set(10, 9, Ro[4]);
  },
  // 路障陷阱：交叉的削尖木桩
  trap(P) {
    P.hline(1, 14, 13, So[1]);
    P.hline(1, 14, 12, So[2]);
    for (const [x0, x1] of [[2, 10], [6, 13]]) {
      P.line(x0, 12, x1, 3, So[3]);
      P.line(x0 + 1, 12, x1 + 1, 3, So[1]);
    }
    for (const [x0, x1] of [[13, 5], [9, 2]]) {
      P.line(x0, 12, x1, 3, So[2]);
      P.line(x0 - 1, 12, x1 - 1, 3, So[3]);
    }
    for (const [x, y] of [[10, 3], [13, 3], [5, 3], [2, 3]]) P.set(x, y, St[3]);
  },
  // 瞭望塔：四条腿、平台、小屋顶
  tower(P) {
    P.line(4, 14, 6, 7, So[2]);
    P.line(11, 14, 9, 7, So[2]);
    P.line(5, 13, 10, 9, So[1]);
    P.line(10, 13, 5, 9, So[1]);
    P.rect(3, 6, 10, 2, So[3]);
    P.hline(3, 12, 6, So[4]);
    P.vline(4, 3, 5, So[2]);
    P.vline(11, 3, 5, So[2]);
    P.poly([[2, 3], [8, 0.5], [14, 3]], Cl[1]);
    P.hline(2, 13, 3, Cl[0]);
    P.set(8, 4, E[4]);
  },
  // 噪声信标：杆子上一个喇叭、顶上一盏橙灯
  lure(P) {
    P.vline(5, 6, 14, Ro[2]);
    P.vline(6, 6, 14, Ro[1]);
    P.hline(3, 8, 14, Ro[2]);
    P.poly([[7, 5], [13, 2], [14, 10], [7, 7]], Ro[4]);
    P.line(7, 5, 13, 2, Ro[5]);
    P.rect(11, 4, 2, 4, A[2]);
    P.disc(5.5, 3.5, 1.6, E[4]);
    P.set(5, 3, E[5]);
  },
  // 支援维修点：红工具箱、一把扳手
  repairpost(P) {
    P.rect(2, 8, 12, 6, Cl[1]);
    P.hline(2, 13, 8, Cl[2]);
    P.hline(2, 13, 13, Cl[0]);
    P.rect(6, 6, 4, 2, A[3]);
    P.rect(7, 7, 2, 1, Cl[0]);
    P.rect(7, 10, 2, 2, St[3]);
    P.line(9, 5, 13, 1, Ro[4]);
    P.line(10, 5, 14, 1, Ro[3]);
    P.set(14, 0, Ro[4]);
    P.set(12, 1, Ro[4]);
    P.set(8, 6, Ro[3]);
  },
  // 摆件：桌上一盏暖光台灯
  trDecor(P) {
    P.poly([[5, 2], [11, 2], [13, 7], [3, 7]], St[3]);
    P.line(5, 2, 3, 7, St[4]);
    P.hline(4, 12, 7, St[1]);
    P.rect(6, 8, 4, 1, E[5]);
    P.vline(8, 8, 11, So[2]);
    P.rect(5, 12, 7, 2, So[3]);
    P.hline(5, 11, 12, So[4]);
    P.hline(5, 11, 13, So[1]);
  },
};
// 快捷栏“建造”那一格：锤子和一块木板
export const TOOL_ICONS = {
  buildTool(P) {
    P.rect(1, 11, 12, 3, So[3]);
    P.hline(1, 12, 11, So[4]);
    P.hline(1, 12, 13, So[1]);
    P.set(4, 12, So[1]);
    P.set(9, 12, So[1]);
    P.line(3, 10, 9, 4, So[2]);
    P.line(4, 10, 10, 4, So[1]);
    P.line(8, 2, 13, 7, Ro[3]);
    P.line(8, 1, 13, 6, Ro[4]);
    P.line(9, 1, 14, 6, Ro[3]);
    P.line(8, 3, 12, 7, Ro[2]);
    P.set(8, 1, Ro[5]);
    P.set(14, 7, Ro[1]);
  },
};

// 把这些图标挂进物品格子用的图集；设施的 icon 换成 "g…"（建造页、拆掉一样设施、说明卡都用它）
const ICON_INDEX = {};
export function iconRef(key) {
  return ICON_INDEX[key] || null;
}
export function registerFourIcons() {
  const all = { ...Object.fromEntries(Object.entries(BUILD_ICONS).map(([id, f]) => ["b:" + id, f])), ...Object.fromEntries(Object.entries(TOOL_ICONS).map(([id, f]) => ["t:" + id, f])) },
    add = Object.keys(all).filter((k) => !GEAR_ICON_IDS.includes(k));
  if (add.length) registerIcons(Object.fromEntries(add.map((k) => [k, all[k]])));
  for (const k of add) GEAR_ICON_IDS.push(k);
  for (const k of Object.keys(all)) ICON_INDEX[k] = "g" + GEAR_ICON_IDS.indexOf(k);
  for (const id of Object.keys(BUILD_ICONS)) if (BUILDINGS[id]) BUILDINGS[id].icon = ICON_INDEX["b:" + id];
  return add.length;
}

// ================= 场景里的东西（替换旧图集里的那几格） =================
// 旧图集“物品与人物”第几格 → 新画法：设施的图（build）、物品的新图标放大两倍（item）、或者下面新画的（prop）
export const OLD_SPRITE = {
  24: { item: "radish" },
  25: { item: "potato" },
  27: { item: "bean" },
  30: { item: "herb" },
  32: { item: "hoe" },
  39: { item: "medkit" },
  40: { build: "chest" },
  42: { build: "rain" },
  43: { build: "workbench" },
  45: { build: "breeder" },
  46: { build: "fence" },
  47: { build: "trap" },
  50: { item: "scrap" },
  51: { item: "parts" },
  52: { item: "ammo" },
  53: { item: "bread" },
  55: { item: "blueprint" },
  63: { prop: "annexDoor" },
};
// “扩建”图集第 7 格（农场上的通信站，原来是一块太阳能板）、“边境”图集第 9 格（供电控制盒）和第 14 格（日记）
export const OLD_ATLAS = { 7: { prop: "radio" } };
export const OLD_FRONTIER = { 9: { prop: "circuit" }, 14: { prop: "clue" } };

export const PROPS = {
  // 封闭检修间的门：水泥门框、铁门、黄黑警示条、一把挂锁
  annexDoor() {
    const P = new Pix(26, 22);
    P.rect(1, 1, 24, 21, Ro[2]);
    P.hline(1, 24, 1, Ro[4]);
    P.vline(1, 1, 21, Ro[3]);
    P.rect(5, 4, 16, 18, A[3]);
    P.rect(6, 5, 14, 16, Ro[1]);
    P.hline(6, 19, 5, Ro[3]);
    P.vline(6, 5, 20, Ro[3]);
    for (const y of [9, 15]) P.hline(7, 18, y, A[2]);
    for (let x = 6; x < 20; x++) P.set(x, 12, ((x >> 1) & 1) === 0 ? E[4] : A[1]);
    for (let x = 6; x < 20; x++) P.set(x, 13, (((x + 1) >> 1) & 1) === 0 ? E[4] : A[1]);
    P.rect(16, 10, 3, 3, St[2]);
    P.set(16, 10, St[4]);
    P.rect(17, 8, 1, 2, Ro[4]);
    P.set(3, 7, R[2]);
    P.set(22, 15, R[1]);
    return P;
  },
  // 通信站：小机柜上一根天线杆、一面小锅、杆顶一点红灯
  radio() {
    const P = new Pix(24, 34);
    P.rect(4, 22, 14, 11, Ro[2]);
    P.hline(4, 17, 22, Ro[4]);
    P.vline(4, 22, 32, Ro[3]);
    P.hline(4, 17, 32, Ro[1]);
    P.rect(6, 24, 5, 3, A[2]);
    P.set(7, 25, L[5]);
    P.set(9, 25, E[4]);
    for (const y of [28, 30]) P.hline(6, 15, y, Ro[1]);
    P.vline(12, 2, 21, Ro[3]);
    P.vline(13, 2, 21, Ro[1]);
    for (let y = 6; y < 21; y += 5) {
      P.line(10, y + 4, 12, y, Ro[2]);
      P.line(15, y + 4, 13, y, Ro[2]);
    }
    P.set(12, 1, Cl[2]);
    P.set(13, 1, Cl[1]);
    P.ellipse(18, 9, 3, 4, Sn[3]);
    P.ellipse(18.5, 9, 1.6, 2.6, Sn[1]);
    P.line(14, 10, 16, 9, Ro[3]);
    P.line(2, 33, 11, 21, A[2]);
    return P;
  },
  // 供电控制盒：杆子上一个灰铁盒、红色拉闸、黄色闪电牌
  circuit() {
    const P = new Pix(18, 26);
    P.rect(8, 15, 2, 11, Ro[1]);
    P.rect(2, 2, 14, 14, Ro[3]);
    P.hline(2, 15, 2, Ro[5]);
    P.vline(2, 2, 15, Ro[4]);
    P.hline(2, 15, 15, Ro[1]);
    P.vline(15, 3, 15, Ro[2]);
    P.rect(4, 4, 10, 10, Ro[2]);
    P.rect(7, 5, 4, 7, A[2]);
    P.rect(8, 3, 2, 5, Cl[1]);
    P.set(8, 3, Cl[2]);
    P.poly([[5, 11], [6, 9], [7, 11]], E[4]);
    P.set(13, 12, St[3]);
    P.set(3, 13, R[2]);
    return P;
  },
  // 日记：一叠发黄的纸，用绳子捆着，压着一片叶子
  clue() {
    const P = new Pix(18, 13);
    P.rect(1, 3, 15, 9, St[2]);
    P.rect(2, 2, 14, 9, St[3]);
    P.rect(3, 1, 13, 9, St[4]);
    for (const y of [3, 5, 7]) P.hline(5, 13, y, St[1]);
    P.vline(9, 1, 11, So[2]);
    P.hline(1, 16, 6, So[2]);
    P.set(10, 5, L[4]);
    P.set(11, 4, L[3]);
    P.set(16, 9, St[1]);
    return P;
  },
};
// 场景里用的图：画布（按美术像素，场景里放大两倍画）；没有就 null
export function oldArtCanvas(kind, index) {
  const map = kind === "sprite" ? OLD_SPRITE : kind === "atlas" ? OLD_ATLAS : OLD_FRONTIER,
    d = map[index];
  if (!d) return null;
  return cached(`four:${kind}:${index}`, () => {
    if (d.prop) return PROPS[d.prop]().outline(OUTLINE).toCanvas();
    if (d.build) return buildingArt(d.build)?.canvas || null;
    if (d.item) return gearIcon(d.item).toCanvas();
    return null;
  });
}
