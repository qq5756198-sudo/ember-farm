// v0.36.0「巨影」：十凶的战利品和凶器的小图（16×16，同一套调色板，外面一圈深色描边由图集统一加）。
// 接在装备小图后面，拼进同一张图集；物品格子、地上掉的东西都用它。
import { PAL } from "./pixel-kit.js";
import { ITEMS } from "./data.js";
import { GEAR_ICON_IDS } from "./gear-data.js";
import { registerIcons } from "./gear-sprites.js";
import "./titan-data.js";

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

export const TITAN_ICONS = {
  // 河伯的鳃骨：一片弯弯的骨头，几道鳃纹，湿得发亮
  tTrophyHebo(P) {
    P.poly([[3, 12], [6, 4], [11, 2], [13, 5], [10, 9], [6, 13]], Sn[2]);
    P.line(6, 11, 9, 5, Sn[0]);
    P.line(8, 11, 11, 6, Sn[0]);
    P.line(4, 11, 7, 5, Sn[1]);
    P.set(11, 3, Sn[4]);
    P.set(12, 4, W[3]);
    P.set(5, 12, L[2]);
  },
  // 老马的铃铛：车把上的铜铃
  tTrophyScrap(P) {
    P.ellipse(8, 9, 5, 4, St[2]);
    P.ellipse(7, 8, 3, 2, St[3]);
    P.hline(3, 13, 12, St[1]);
    P.rect(7, 3, 2, 3, Ro[3]);
    P.set(8, 13, R[1]);
    P.set(6, 7, St[4]);
  },
  // 〇号的标签：白塑料牌上一个圈
  tTrophyZero(P) {
    P.rect(3, 4, 10, 8, Sn[3]);
    P.hline(3, 12, 4, Sn[4]);
    P.ellipse(8, 8, 2.5, 2.5, A[1]);
    P.ellipse(8, 8, 1.2, 1.2, Sn[3]);
    P.set(4, 3, A[2]);
    P.line(2, 2, 4, 4, A[2]);
    P.set(12, 11, Cl[1]);
  },
  // 生锈的夹子：两排锯齿
  tTrophyBear(P) {
    P.ellipse(8, 8, 6, 4, R[1]);
    P.ellipse(8, 8, 4, 2, A[0]);
    for (let x = 3; x <= 13; x += 2) {
      P.set(x, 5, R[2]);
      P.set(x, 11, R[2]);
    }
    P.rect(7, 12, 2, 3, R[0]);
    P.set(5, 6, E[3]);
  },
  // 测风杆的铭牌：铜牌，两颗铆钉，上面结着霜
  tTrophyFrost(P) {
    P.rect(2, 5, 12, 7, St[2]);
    P.hline(2, 13, 5, St[3]);
    P.hline(4, 11, 8, St[0]);
    P.hline(4, 9, 10, St[0]);
    P.set(3, 6, Ro[4]);
    P.set(12, 6, Ro[4]);
    P.hline(2, 13, 4, Sn[4]);
    P.set(6, 4, Sn[3]);
  },
  // 分水叉：长柄，三股叉
  heboFork(P) {
    P.line(2, 14, 11, 5, So[3]);
    P.line(3, 14, 12, 5, So[2]);
    P.line(11, 5, 14, 1, Ro[4]);
    P.line(10, 4, 11, 1, Ro[4]);
    P.line(12, 6, 15, 4, Ro[4]);
    P.set(11, 5, Ro[2]);
    P.set(14, 1, Ro[5]);
  },
  // 冰镐：镐头上挂着冰
  frostPick(P) {
    P.line(3, 14, 10, 4, So[3]);
    P.line(4, 14, 11, 4, So[2]);
    P.line(6, 3, 14, 6, Ro[4]);
    P.line(6, 4, 13, 7, Ro[3]);
    P.set(14, 6, Ro[5]);
    P.set(6, 3, Sn[4]);
    P.set(13, 8, Sn[3]);
  },
  // 千层底：一只纳了线的布鞋
  scrapShoes(P) {
    P.rect(3, 8, 11, 4, A[1]);
    P.rect(3, 12, 11, 2, Sn[2]);
    P.hline(3, 13, 13, Sn[1]);
    for (let x = 4; x <= 12; x += 2) P.set(x, 12, A[0]);
    P.rect(3, 6, 4, 2, A[1]);
    P.set(10, 9, A[2]);
  },
  // 隔离服：黄色连体服，一块面罩
  zeroSuit(P) {
    P.rect(4, 4, 8, 9, St[3]);
    P.rect(2, 5, 2, 6, St[2]);
    P.rect(12, 5, 2, 6, St[2]);
    P.rect(5, 1, 6, 4, St[3]);
    P.rect(6, 2, 4, 2, W[3]);
    P.vline(8, 5, 12, St[1]);
    P.rect(4, 13, 3, 2, St[1]);
    P.rect(9, 13, 3, 2, St[1]);
  },
  // 熊皮袄：黑毛翻领
  bearCoat(P) {
    P.rect(4, 4, 8, 10, So[1]);
    P.rect(2, 5, 2, 7, So[1]);
    P.rect(12, 5, 2, 7, So[1]);
    P.rect(4, 3, 8, 3, A[0]);
    P.vline(8, 6, 13, A[0]);
    for (const [x, y] of [[5, 8], [10, 10], [6, 12], [11, 7]]) P.set(x, y, So[2]);
    P.set(5, 4, A[2]);
  },
  // v0.37.0：后五凶的战利品和凶器（接在后面，前五凶的图位不动）
  // 灰隼团的旗：一根旗杆，一面灰旗，上面一只隼，烧了一角
  tTrophyDiao(P) {
    P.vline(3, 1, 14, So[2]);
    P.vline(4, 1, 14, So[3]);
    P.rect(5, 2, 9, 7, Ro[2]);
    P.hline(5, 13, 2, Ro[3]);
    P.line(7, 6, 9, 4, A[1]);
    P.line(9, 4, 12, 5, A[1]);
    P.set(9, 5, A[1]);
    P.set(10, 4, E[3]);
    P.set(13, 8, A[0]);
    P.set(12, 8, E[2]);
    P.set(13, 7, E[1]);
  },
  // 三号泊位的铭牌：铜牌上一个“3”，糊着一道油
  tTrophyTide(P) {
    P.rect(2, 4, 12, 8, St[1]);
    P.hline(2, 13, 4, St[3]);
    P.hline(2, 13, 11, St[0]);
    P.hline(6, 9, 6, A[1]);
    P.hline(7, 9, 8, A[1]);
    P.hline(6, 9, 10, A[1]);
    P.vline(9, 6, 10, A[1]);
    P.set(3, 5, St[4]);
    P.set(12, 5, St[4]);
    P.line(10, 4, 13, 9, N[0]);
    P.set(12, 12, N[0]);
  },
  // 风机的扇叶：一片弯的铁叶子，边上几道刮痕
  tTrophyVent(P) {
    P.poly([[3, 13], [5, 6], [9, 2], [13, 2], [11, 6], [7, 11]], Ro[3]);
    P.line(5, 11, 10, 4, Ro[4]);
    P.line(4, 12, 6, 7, Ro[2]);
    P.set(12, 3, Ro[5]);
    P.set(7, 8, R[2]);
    P.set(9, 6, R[2]);
    P.rect(2, 13, 3, 2, A[2]);
  },
  // 末班车的车票：一张发黄的票，打了一个孔，背面一行圆珠笔字
  tTrophyTrain(P) {
    P.rect(2, 4, 12, 8, St[3]);
    P.hline(2, 13, 4, St[4]);
    P.vline(10, 4, 11, St[1]);
    P.hline(3, 8, 7, N[2]);
    P.hline(3, 6, 9, N[2]);
    P.ellipse(12, 8, 1, 1, A[1]);
    P.set(4, 5, Cl[1]);
    P.set(5, 5, Cl[1]);
  },
  // 最后一盏灯：一盏旧马灯，里面一团火
  tTrophyMoth(P) {
    P.hline(6, 9, 1, R[1]);
    P.rect(5, 2, 6, 2, R[2]);
    P.rect(4, 4, 8, 8, A[2]);
    P.rect(5, 5, 6, 6, E[1]);
    P.rect(6, 6, 4, 4, E[3]);
    P.rect(7, 7, 2, 2, E[5]);
    P.vline(4, 4, 11, R[1]);
    P.vline(11, 4, 11, R[1]);
    P.rect(4, 12, 8, 2, R[1]);
    P.set(5, 5, E[4]);
  },
  // 雕爷的大氅：长到脚面的灰大氅，毛领子
  diaoCoat(P) {
    P.rect(4, 4, 8, 10, Ro[2]);
    P.rect(3, 9, 10, 5, Ro[2]);
    P.rect(2, 5, 2, 6, Ro[1]);
    P.rect(12, 5, 2, 6, Ro[1]);
    P.rect(4, 2, 8, 3, So[3]);
    P.vline(8, 5, 13, Ro[0]);
    P.hline(3, 12, 14, Ro[1]);
    for (const [x, y] of [[5, 2], [7, 3], [10, 2]]) P.set(x, y, So[4]);
  },
  // 潜水头盔：圆铜盔，一扇圆窗
  tideHelm(P) {
    P.ellipse(8, 7, 6, 6, St[1]);
    P.ellipse(7, 6, 4, 4, St[2]);
    P.ellipse(8, 8, 3, 3, Ro[0]);
    P.ellipse(8, 8, 2, 2, W[1]);
    P.set(7, 7, W[4]);
    P.rect(3, 13, 10, 2, St[0]);
    P.set(4, 5, St[4]);
    P.set(13, 8, W[3]);
  },
  // 防毒面具：脸罩、两只眼窗、底下一个滤毒罐
  ventMask(P) {
    P.ellipse(8, 7, 5, 6, A[3]);
    P.ellipse(6, 6, 1.6, 1.6, W[3]);
    P.ellipse(10, 6, 1.6, 1.6, W[3]);
    P.rect(6, 11, 4, 4, L[2]);
    P.hline(6, 9, 12, L[1]);
    P.set(5, 5, W[5]);
    P.line(2, 7, 4, 9, A[2]);
    P.line(14, 7, 12, 9, A[2]);
  },
  // 道钉锤：长柄，锤头是一截铁轨上的道钉
  spikeMaul(P) {
    P.line(2, 14, 10, 6, So[3]);
    P.line(3, 14, 11, 6, So[2]);
    P.rect(8, 2, 7, 4, Ro[2]);
    P.hline(8, 14, 2, Ro[4]);
    P.rect(14, 3, 2, 2, Ro[3]);
    P.rect(6, 3, 2, 2, R[2]);
    P.set(9, 3, Ro[5]);
  },
};
const add = Object.keys(TITAN_ICONS).filter((id) => ITEMS[id] && !GEAR_ICON_IDS.includes(id));
registerIcons(Object.fromEntries(add.map((id) => [id, TITAN_ICONS[id]])));
for (const id of add) {
  GEAR_ICON_IDS.push(id);
  ITEMS[id].icon = "g" + (GEAR_ICON_IDS.length - 1);
}
