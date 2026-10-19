// v0.37.0「扑火」：后五凶的样子——看门的（戴铁嘴套的大个子）和雕爷（大氅、霰弹枪）、黑潮（铜头盔的破潜水服、船锚）、
// 风口（长在墙上的一大片人和风机、四个肺）、末班车（车头和车厢、翻下轨道的车头）、扑火（一座尸山和那颗心），掉在地上的库存。
// 跟 titan-sprites.js 一样：代码画、只用调色板里的颜色、一个美术像素在地图上占 2×2、光从左上来、画一次存起来、朝右画。
import { PAL, OUTLINE, Pix, cached, dither, rng } from "./pixel-kit.js";
import { blob, limb, spots, eye } from "./titan-sprites.js";

const canvasOf = (P) => P.toCanvas();
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ================= 看门的：灰绿的大个子，用拳头撑着地走，下巴扣着生锈的铁嘴套，脖子上一个铁项圈 =================
// pose：walk、slam（立起来两只拳头举过头）、charge（低头往前冲）、grab（伸出一只手）、stun（撞晕了）
// free：雕爷倒下以后链子断了、嘴套掉了（张着嘴）
export const DOG_W = 96,
  DOG_H = 88;
export function dogSprite(pose = "walk", frame = 0, free = false) {
  return cached(`tdog:${pose}:${frame}:${free ? 1 : 0}`, () => {
    const P = new Pix(DOG_W, DOG_H),
      feet = 86,
      step = [0, 1, 0, -1][frame % 4];
    if (pose === "slam") return canvasOf(dogRear(P, feet, frame, free));
    const charge = pose === "charge",
      low = charge ? 6 : 0,
      top = feet - 64 + low;
    // 远的那条腿、那只拳头先画（暗一点）
    limb(P, 34, top + 40, 30 - step * 3, feet - 2, 7, 6, "stone", 0.22);
    P.rect(22 - step * 3, feet - 4, 14, 4, PAL.stone[0]);
    limb(P, 64, top + 26, 74 + step * 3, top + 46, 8, 7, "stone", 0.25);
    limb(P, 74 + step * 3, top + 46, 76 + step * 3, feet - 4, 7, 6, "stone", 0.22);
    blob(P, 77 + step * 3, feet - 4, 7, 4, "stone", 0.3, 0.3);
    // 身子：一座驼着的背，肩膀比头高
    blob(P, 50, top + 30, 30, 20, "stone", 0.4, 0.42);
    blob(P, 58, top + 20, 24, 16, "stone", 0.56, 0.4);
    // 肚子底下暗一截
    for (let y = top + 38; y < top + 52; y++) for (let x = 22; x < 80; x++) if (P.opaque(x, y)) P.shade(x, y, 0.8);
    for (let y = top + 4; y < top + 52; y++) for (let x = 20; x < 86; x++) if (P.opaque(x, y)) P.shade(x, y, 0.84, PAL.leaf[1]);
    // 背上鼓起来的疙瘩、一道道缝过的口子
    for (const [cx, cy, rx, ry] of [[46, top + 12, 6, 4], [60, top + 8, 7, 5], [72, top + 14, 5, 4], [38, top + 22, 5, 3]]) blob(P, cx, cy, rx, ry, "stone", 0.58, 0.35);
    for (let i = 0; i < 4; i++) {
      const x = 40 + i * 9;
      P.line(x, top + 26, x + 6, top + 34, PAL.cloth[0]);
      for (let k = 0; k < 3; k++) P.set(x + 2 + k * 2, top + 28 + k * 2 + (k % 2 ? -1 : 1), PAL.straw[3]);
    }
    // 腿：近的那条，粗
    limb(P, 30, top + 40, 26 + step * 3, feet - 2, 8, 7, "stone", 0.45);
    P.rect(17 + step * 3, feet - 4, 16, 4, PAL.stone[1]);
    // 胳膊：近的那只，拳头撑着地（抓的时候往前伸）
    if (pose === "grab") {
      limb(P, 70, top + 26, 88, top + 18, 8, 7, "stone", 0.5);
      blob(P, 90, top + 17, 6, 6, "stone", 0.55, 0.3);
      for (let i = 0; i < 4; i++) P.line(92, top + 13 + i * 3, 95, top + 11 + i * 3, PAL.stone[4]);
    } else {
      limb(P, 68, top + 28, 80 - step * 3, top + 48, 9, 8, "stone", 0.5);
      limb(P, 80 - step * 3, top + 48, 82 - step * 3, feet - 5, 8, 7, "stone", 0.48);
      blob(P, 84 - step * 3, feet - 4, 8, 5, "stone", 0.55, 0.3);
      for (let i = 0; i < 3; i++) P.set(80 - step * 3 + i * 3, feet - 2, PAL.stone[4]);
    }
    // 头：低在两肩中间往前探，铁嘴套扣着下巴
    const hx = 84 + (charge ? 4 : 0),
      hy = top + 24 + (charge ? 6 : 0);
    blob(P, hx - 4, hy - 4, 11, 10, "stone", 0.52, 0.38);
    for (let y = hy - 14; y < hy + 6; y++) for (let x = hx - 15; x < hx + 8; x++) if (P.opaque(x, y)) P.shade(x, y, 0.85, PAL.leaf[1]);
    eye(P, hx - 2, hy - 7, PAL.ember[4], PAL.ember[3]);
    P.hline(hx - 6, hx + 1, hy - 9, PAL.stone[1]);
    if (free) {
      // 嘴套掉了：张着的大嘴，一圈牙
      P.rect(hx - 6, hy - 1, 12, 7, OUTLINE);
      P.rect(hx - 5, hy, 10, 5, PAL.cloth[0]);
      for (let i = 0; i < 5; i++) {
        P.set(hx - 5 + i * 2, hy, PAL.snow[4]);
        P.set(hx - 4 + i * 2, hy + 4, PAL.snow[3]);
      }
    } else {
      // 铁嘴套：一个锈笼子，几根铁条
      P.rect(hx - 7, hy - 2, 14, 9, PAL.rust[1]);
      for (let i = 0; i < 4; i++) P.vline(hx - 6 + i * 4, hy - 2, hy + 6, PAL.rust[3]);
      P.hline(hx - 7, hx + 6, hy + 2, PAL.rust[0]);
      P.hline(hx - 7, hx + 6, hy - 2, PAL.rust[2]);
      P.line(hx - 9, hy - 6, hx - 7, hy - 2, PAL.rust[1]);
    }
    // 铁项圈和链子扣
    P.rect(hx - 16, hy - 6, 6, 12, PAL.stone[1]);
    P.vline(hx - 14, hy - 6, hy + 5, PAL.stone[4]);
    P.ellipse(hx - 13, hy + 7, 2.5, 2, PAL.stone[3]);
    if (pose === "stun") for (const [x, y] of [[hx - 6, hy - 20], [hx + 4, hy - 22], [hx - 1, hy - 26]]) P.rect(x, y, 2, 2, PAL.straw[4]);
    spots(P, 7171 + frame, 40, 22, top + 6, 64, 44, [PAL.stone[1], PAL.leaf[1], PAL.soil[1]]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
// 立起来：两只拳头举过头，要砸地
function dogRear(P, feet, frame, free) {
  const sway = frame % 2;
  limb(P, 40, feet - 34, 34, feet - 2, 9, 8, "stone", 0.3);
  limb(P, 60, feet - 34, 66, feet - 2, 9, 8, "stone", 0.26);
  P.rect(24, feet - 4, 18, 4, PAL.stone[0]);
  P.rect(58, feet - 4, 18, 4, PAL.stone[0]);
  blob(P, 50, feet - 52, 22, 26, "stone", 0.45, 0.42);
  blob(P, 50, feet - 44, 14, 14, "stone", 0.3, 0.3);
  for (let y = feet - 80; y < feet - 24; y++) for (let x = 26; x < 76; x++) if (P.opaque(x, y)) P.shade(x, y, 0.84, PAL.leaf[1]);
  for (const [cx, cy] of [[40, feet - 66], [60, feet - 62]]) blob(P, cx, cy, 6, 4, "stone", 0.6, 0.35);
  limb(P, 32, feet - 66, 20, feet - 84 + sway, 9, 8, "stone", 0.5);
  limb(P, 68, feet - 66, 80, feet - 84 - sway, 9, 8, "stone", 0.42);
  blob(P, 19, feet - 86 + sway, 8, 7, "stone", 0.55, 0.3);
  blob(P, 81, feet - 86 - sway, 8, 7, "stone", 0.48, 0.3);
  blob(P, 50, feet - 76, 11, 10, "stone", 0.52, 0.4);
  eye(P, 46, feet - 79, PAL.ember[4], PAL.ember[3]);
  eye(P, 53, feet - 79, PAL.ember[4], PAL.ember[3]);
  if (free) {
    P.rect(45, feet - 73, 11, 6, OUTLINE);
    P.rect(46, feet - 72, 9, 4, PAL.cloth[0]);
    for (let i = 0; i < 5; i++) P.set(46 + i * 2, feet - 72, PAL.snow[4]);
  } else {
    P.rect(43, feet - 74, 14, 8, PAL.rust[1]);
    for (let i = 0; i < 4; i++) P.vline(44 + i * 4, feet - 74, feet - 67, PAL.rust[3]);
  }
  P.rect(42, feet - 66, 16, 4, PAL.stone[1]);
  P.ellipse(50, feet - 61, 2.5, 2, PAL.stone[3]);
  spots(P, 7272, 26, 30, feet - 76, 40, 50, [PAL.stone[1], PAL.leaf[1]]);
  P.outline(OUTLINE);
  return P;
}

// ================= 雕爷：灰隼团的大当家，花白头发、一顶旧毡帽，一件长到脚面的灰大氅（毛领子），端着一把霰弹枪 =================
// pose：walk、aim（端枪瞄你）、throw（扬手扔烟雾弹、燃烧瓶）；coat：大氅还穿着没有（拼命时脱了，里面是一件旧调度服）
export const DIAO_W = 46,
  DIAO_H = 70;
export function diaoSprite(pose = "walk", frame = 0, coat = true) {
  return cached(`tdiao:${pose}:${frame}:${coat ? 1 : 0}`, () => {
    const P = new Pix(DIAO_W, DIAO_H),
      feet = 68,
      step = [0, 1, 0, -1][frame % 4],
      top = 10;
    // 腿、皮靴
    limb(P, 20, feet - 24, 18 - step * 2, feet - 3, 3, 3, "ash", 0.4);
    limb(P, 26, feet - 24, 28 + step * 2, feet - 3, 3, 3, "ash", 0.32);
    P.rect(13 - step * 2, feet - 4, 8, 4, PAL.soil[0]);
    P.rect(25 + step * 2, feet - 4, 8, 4, PAL.soil[0]);
    if (coat) {
      // 大氅：从肩膀一直到脚面，下摆张开，毛领子
      P.poly(
        [
          [14, top + 12],
          [32, top + 12],
          [38, feet - 6],
          [8, feet - 6],
        ],
        PAL.stone[2],
      );
      for (let y = top + 12; y < feet - 5; y++) for (let x = 6; x < 40; x++) if (P.opaque(x, y) && y < feet - 5) P.set(x, y, dither("stone", 0.48 - (x - 6) / 80 - (y - top) / 220, x, y));
      P.vline(23, top + 14, feet - 7, PAL.stone[0]);
      P.line(19, top + 16, 15, feet - 8, PAL.stone[1]);
      P.hline(8, 38, feet - 6, PAL.ash[2]);
      blob(P, 23, top + 12, 11, 5, "soil", 0.62, 0.3);
      spots(P, 5150 + frame, 14, 15, top + 9, 18, 6, [PAL.soil[4], PAL.straw[1]]);
    } else {
      // 旧调度服：深蓝上衣、皮带
      blob(P, 23, top + 24, 9, 13, "night", 0.42, 0.35);
      P.hline(15, 31, top + 34, PAL.soil[0]);
      P.set(23, top + 34, PAL.straw[3]);
      P.rect(19, top + 16, 3, 2, PAL.straw[2]);
      limb(P, 18, top + 36, 18, feet - 24, 4, 3, "ash", 0.4);
      limb(P, 28, top + 36, 28, feet - 24, 4, 3, "ash", 0.32);
    }
    // 胳膊、霰弹枪
    const gun = (x0, y0, x1, y1) => {
      P.line(x0, y0, x1, y1, PAL.ash[1]);
      P.line(x0, y0 + 1, x1, y1 + 1, PAL.ash[2]);
      P.line(x0 - 3, y0 + 1, x0 + 2, y0 + 3, PAL.soil[2]);
      P.set(x1, y1, PAL.stone[3]);
    };
    if (pose === "aim") {
      limb(P, 18, top + 16, 30, top + 22, 3, 3, coat ? "stone" : "night", 0.5);
      limb(P, 28, top + 17, 36, top + 21, 3, 3, coat ? "stone" : "night", 0.45);
      gun(26, top + 21, 45, top + 20);
    } else if (pose === "throw") {
      limb(P, 28, top + 16, 34, top + 2, 3, 3, coat ? "stone" : "night", 0.5);
      blob(P, 35, top, 3, 3, "leaf", 0.5, 0.3);
      P.set(35, top - 3, PAL.ember[4]);
      limb(P, 17, top + 16, 13, top + 32, 3, 3, coat ? "stone" : "night", 0.42);
      gun(10, top + 36, 22, top + 30);
    } else {
      limb(P, 17, top + 16, 15, top + 32 + step, 3, 3, coat ? "stone" : "night", 0.45);
      limb(P, 29, top + 16, 32, top + 30 - step, 3, 3, coat ? "stone" : "night", 0.38);
      gun(30, top + 32 - step, 40, top + 20);
    }
    // 头：花白头发、胡茬、一道疤，旧毡帽
    blob(P, 23, top + 5, 6, 6, "skin", 0.45, 0.3);
    P.hline(19, 27, top + 9, PAL.snow[1]);
    for (const x of [19, 21, 25, 27]) P.set(x, top + 10, PAL.snow[0]);
    eye(P, 24, top + 4, OUTLINE, PAL.ash[2]);
    P.line(20, top + 2, 22, top + 7, PAL.cloth[0]);
    P.rect(15, top - 1, 17, 2, PAL.soil[1]);
    blob(P, 23, top - 3, 6, 3, "soil", 0.42, 0.3);
    P.hline(17, 29, top - 1, PAL.soil[0]);
    P.set(18, top + 3, PAL.snow[2]);
    P.set(28, top + 3, PAL.snow[2]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}

// ================= 黑潮：穿着破潜水服的老潜水员，铜头盔面窗裂了一道缝，肚子里灌满了油，一身往下淌的黑油，拖着一只船锚 =================
// pose：walk、spray（一只手往前喷油）、spark（举着焊枪打火）、anchor（抡锚）、hook（甩锚出去）
// stage：0 潜水服湿着、1 破了（头盔里冒烟）、2 整个烧起来（画面另加火）
export const TIDE_W = 80,
  TIDE_H = 98;
export function tideSprite(pose = "walk", frame = 0, stage = 0) {
  return cached(`ttide:${pose}:${frame}:${stage}`, () => {
    const P = new Pix(TIDE_W, TIDE_H),
      feet = 96,
      step = [0, 1, 0, -1][frame % 4],
      top = 14;
    // 铅鞋、腿（橡胶裤，鼓）
    limb(P, 30, feet - 30, 27 - step * 2, feet - 5, 7, 6, "ash", 0.35);
    limb(P, 44, feet - 30, 47 + step * 2, feet - 5, 7, 6, "ash", 0.3);
    P.rect(19 - step * 2, feet - 7, 15, 7, PAL.stone[1]);
    P.rect(40 + step * 2, feet - 7, 15, 7, PAL.stone[1]);
    P.hline(19 - step * 2, 33 - step * 2, feet - 7, PAL.stone[3]);
    P.hline(40 + step * 2, 54 + step * 2, feet - 7, PAL.stone[3]);
    // 肚子：灌满了油，鼓得像个桶（一身黑油，亮的地方泛一点蓝）
    blob(P, 37, top + 44, 22, 24, "ash", 0.34, 0.42);
    for (const [x, y] of [[27, top + 31], [28, top + 32], [30, top + 30], [26, top + 34], [29, top + 33], [25, top + 37]]) P.set(x, y, PAL.night[2]);
    for (let y = top + 18; y < top + 70; y++) for (let x = 12; x < 62; x++) if (P.opaque(x, y)) P.shade(x, y, 0.88, PAL.night[0]);
    // 潜水服上的铜扣、腰上的配重带
    P.hline(16, 58, top + 52, PAL.soil[0]);
    for (const x of [20, 30, 44, 54]) P.rect(x, top + 50, 3, 4, PAL.straw[1]);
    // 往下淌的油（亮一点的黑）
    const r = rng(9090 + frame);
    for (let i = 0; i < 9; i++) {
      const x = 16 + Math.floor(r() * 42),
        y0 = top + 26 + Math.floor(r() * 30),
        len = 6 + Math.floor(r() * 12);
      for (let k = 0; k < len; k++) if (P.opaque(x, y0 + k)) P.set(x, y0 + k, k % 4 === 0 ? PAL.night[2] : OUTLINE);
    }
    // 胳膊（粗橡胶袖、铜护腕）
    const sleeve = (x0, y0, x1, y1) => {
      limb(P, x0, y0, x1, y1, 5, 5, "ash", 0.42);
      blob(P, x1, y1, 5, 4, "straw", 0.35, 0.3);
    };
    if (pose === "spray") {
      sleeve(54, top + 26, 70, top + 30);
      P.line(72, top + 30, 79, top + 28, OUTLINE);
      P.line(72, top + 31, 79, top + 33, PAL.night[2]);
      sleeve(20, top + 26, 14, top + 46);
    } else if (pose === "spark") {
      sleeve(54, top + 26, 62, top + 8);
      P.line(62, top + 6, 66, top - 2, PAL.stone[3]);
      for (const [x, y] of [[67, top - 5], [70, top - 2], [64, top - 7], [69, top - 8]]) P.set(x, y, frame % 2 ? PAL.ember[5] : PAL.straw[4]);
      sleeve(20, top + 26, 14, top + 46);
    } else if (pose === "anchor") {
      sleeve(22, top + 24, 18, top + 2);
      sleeve(52, top + 24, 56, top + 2);
    } else if (pose === "hook") {
      sleeve(54, top + 26, 72, top + 14);
      sleeve(20, top + 26, 16, top + 44);
    } else {
      sleeve(20, top + 26, 14, top + 46 + step);
      sleeve(54, top + 26, 62, top + 46 - step);
    }
    // 铜头盔：圆的，三扇小窗，正面那扇裂了一道缝
    blob(P, 37, top + 10, 15, 14, "straw", 0.34, 0.5);
    for (let y = top - 4; y < top + 24; y++) for (let x = 22; x < 53; x++) if (P.opaque(x, y)) P.shade(x, y, 0.62, PAL.rust[2]);
    // 铜锈：几块发绿
    spots(P, 9191, 14, 24, top - 2, 28, 24, [PAL.water[3], PAL.leaf[3]]);
    P.hline(24, 50, top + 20, PAL.straw[0]);
    P.ellipse(39, top + 10, 6, 6, PAL.stone[0]);
    P.ellipse(39, top + 10, 4.5, 4.5, PAL.water[0]);
    P.line(36, top + 6, 42, top + 14, PAL.snow[3]);
    P.set(37, top + 8, PAL.snow[4]);
    for (const [x, y] of [[27, top + 8], [49, top + 9]]) {
      P.ellipse(x, y, 2.5, 3, PAL.stone[0]);
      P.set(x, y, PAL.water[1]);
    }
    for (const [x, y] of [[30, top - 1], [44, top - 1], [24, top + 15], [52, top + 15]]) P.set(x, y, PAL.straw[4]);
    // 头盔里的那双眼睛
    P.set(37, top + 10, PAL.leaf[5]);
    P.set(41, top + 10, PAL.leaf[5]);
    if (stage >= 1) {
      // 潜水服破了：头盔缝里冒烟，肚子上一道口子往外渗油
      for (const [x, y] of [[40, top - 6], [43, top - 9], [39, top - 11], [45, top - 13]]) P.rect(x, y, 2, 2, frame % 2 ? PAL.stone[2] : PAL.stone[3]);
      P.line(30, top + 40, 40, top + 46, PAL.ember[1]);
      P.line(31, top + 41, 39, top + 46, OUTLINE);
    }
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
// 船锚（拖在身后、抡起来）
export function anchorSprite() {
  return cached("tanchor", () => {
    const P = new Pix(30, 30);
    P.vline(15, 3, 24, PAL.stone[2]);
    P.vline(16, 3, 24, PAL.stone[3]);
    P.hline(10, 21, 7, PAL.stone[2]);
    P.ellipse(15.5, 2.5, 2.5, 2.5, PAL.stone[3]);
    P.ellipse(15.5, 2.5, 1, 1, OUTLINE);
    // 两只锚爪：从锚杆底下往两边弯上去
    for (let i = 0; i <= 9; i++) {
      const lift = Math.round(i * i * 0.07);
      P.rect(15 - i, 24 - lift, 2, 2, PAL.stone[3]);
      P.rect(15 + i, 24 - lift, 2, 2, PAL.stone[2]);
    }
    P.poly([[3, 20], [7, 26], [9, 21]], PAL.stone[3]);
    P.poly([[28, 20], [24, 26], [22, 21]], PAL.stone[2]);
    spots(P, 4040, 14, 4, 4, 24, 24, [PAL.rust[1], PAL.rust[2]]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}

// ================= 风口：主风道的风口长在墙上——圆铁丝网罩着风机，四周一大片长在一起的人（胳膊、脑袋、后背），一起喘气 =================
// mode：idle、suck（往里收、风机倒转）、blow（往外鼓）；frame 是扇叶转到哪
export const VENT_W = 160,
  VENT_H = 92;
export function ventSprite(mode = "idle", frame = 0, last = false) {
  return cached(`tvent:${mode}:${frame % 4}:${last ? 1 : 0}`, () => {
    const P = new Pix(VENT_W, VENT_H),
      cx = 80,
      cy = 46,
      pull = mode === "suck" ? -3 : mode === "blow" ? 3 : 0;
    // 一大片人：后背、肩膀一个挨一个，从风口往两边铺开（离风口越远越暗）
    const r = rng(8181);
    for (let i = 0; i < 54; i++) {
      const a = r() * Math.PI * 2,
        d = 24 + r() * 46,
        x = cx + Math.cos(a) * d * 1.45 + Math.cos(a) * pull,
        y = cy + Math.sin(a) * d * 0.62 + (r() - 0.5) * 6,
        k = d / 70,
        ramp = r() < 0.55 ? "skin" : r() < 0.6 ? "soil" : "ash";
      blob(P, x, y, 6 + r() * 6, 4 + r() * 4, ramp, 0.42 - k * 0.22, 0.32);
    }
    // 缝里黑
    for (let i = 0; i < 70; i++) {
      const x = Math.floor(r() * VENT_W),
        y = Math.floor(r() * VENT_H);
      if (P.opaque(x, y) && P.opaque(x + 1, y)) P.set(x, y, OUTLINE);
    }
    // 伸出来的胳膊（都朝着风口）、一个个脑袋
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2 + 0.2,
        d0 = 32 + (i % 3) * 12,
        x0 = cx + Math.cos(a) * d0 * 1.5,
        y0 = cy + Math.sin(a) * d0 * 0.6,
        x1 = cx + Math.cos(a) * (d0 - 13 + pull) * 1.5,
        y1 = cy + Math.sin(a) * (d0 - 13 + pull) * 0.6;
      limb(P, x0, y0, x1, y1, 2.5, 2, "skin", 0.5);
      for (let k = 0; k < 3; k++) P.set(x1 + (k - 1), y1 - 1 + k, PAL.skin[2]);
    }
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + 0.5,
        d = 44 + (i % 2) * 14,
        x = cx + Math.cos(a) * d * 1.45,
        y = cy + Math.sin(a) * d * 0.6;
      blob(P, x, y, 4.5, 4.5, "skin", 0.45, 0.3);
      P.set(x - 1, y, OUTLINE);
      P.set(x + 2, y, OUTLINE);
      P.hline(x - 1, x + 2, y + 2, PAL.ember[0]);
    }
    // 死人的颜色：整片压灰、压暗一点
    for (let y = 0; y < VENT_H; y++) for (let x = 0; x < VENT_W; x++) if (P.opaque(x, y)) P.shade(x, y, 0.6, PAL.stone[1]);
    spots(P, 8282, 110, 6, 6, VENT_W - 12, VENT_H - 12, [PAL.ember[0], PAL.soil[0], PAL.leaf[1], PAL.ash[1]]);
    // 风口：一圈铁框，里面是风机（宽扇叶，转着），外面罩着铁丝网
    P.ellipse(cx, cy, 25, 23, PAL.stone[1]);
    P.ellipse(cx, cy, 22, 20, PAL.ash[0]);
    const spin = (frame % 4) * (Math.PI / 10) * (mode === "suck" ? -1 : 1),
      nB = 5,
      sec = (Math.PI * 2) / nB;
    for (let y = -20; y <= 20; y++)
      for (let x = -22; x <= 22; x++) {
        const ry = y / 0.92,
          d = Math.hypot(x, ry);
        if (d > 19.5 || d < 3) continue;
        const ph = (((Math.atan2(ry, x) - spin) % sec) + sec) % sec,
          f = ph / sec;
        // 扇叶占一扇的一半多一点，越往外越宽；迎风那一边亮
        if (f < 0.42 + d / 90) P.set(cx + x, cy + y, f < 0.12 ? PAL.stone[4] : f < 0.3 ? PAL.stone[3] : PAL.stone[2]);
      }
    P.ellipse(cx, cy, 4, 4, PAL.stone[1]);
    P.ellipse(cx, cy, 2.5, 2.5, PAL.stone[4]);
    // 铁丝网
    for (let k = -18; k <= 18; k += 6) {
      const hy = Math.round(Math.sqrt(Math.max(0, 400 - k * k)) * 0.92),
        hx = Math.round(Math.sqrt(Math.max(0, 400 - k * k)));
      P.vline(cx + k, cy - hy, cy + hy, PAL.ash[4], 0.45);
      P.hline(cx - hx, cx + hx, cy + Math.round(k * 0.92), PAL.ash[4], 0.45);
    }
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * Math.PI * 2;
      P.set(cx + Math.cos(a) * 24, cy + Math.sin(a) * 22, i % 2 ? PAL.stone[3] : PAL.rust[2]);
    }
    // 最后一口气：风口一圈红光
    if (last)
      for (let i = 0; i < 40; i++) {
        const a = (i / 40) * Math.PI * 2;
        P.set(cx + Math.cos(a) * 26, cy + Math.sin(a) * 24, i % 3 ? PAL.ember[2] : PAL.ember[4]);
      }
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
// 墙上的肺：一个鼓着的肉口袋，几道青筋（只在口袋里面），一张一缩（swell 0–3）
export const LUNG_W = 30,
  LUNG_H = 28;
export function lungSprite(swell = 0, hurt = false) {
  return cached(`tlung:${swell}:${hurt ? 1 : 0}`, () => {
    const P = new Pix(LUNG_W, LUNG_H),
      k = swell;
    blob(P, 15, 15, 9 + k, 8 + k, "skin", 0.5 + k * 0.04, 0.42);
    for (let y = 0; y < LUNG_H; y++) for (let x = 0; x < LUNG_W; x++) if (P.opaque(x, y)) P.shade(x, y, 0.7, PAL.ember[0]);
    const vein = (x0, y0, x1, y1, c) => {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) | 0;
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + ((x1 - x0) * i) / n + Math.sin(i * 0.9) * 0.6),
          y = Math.round(y0 + ((y1 - y0) * i) / n);
        if (P.opaque(x, y) && P.opaque(x - 1, y) && P.opaque(x + 1, y)) P.set(x, y, c);
      }
    };
    for (let i = 0; i < 3; i++) vein(10 + i * 5, 8 - k, 9 + i * 5 + (i % 2), 22 + k, PAL.night[2]);
    vein(7 - k, 15, 23 + k, 14, PAL.night[1]);
    P.set(11, 10 - k, PAL.skin[3]);
    P.set(12, 10 - k, PAL.skin[3]);
    if (hurt) for (const [x, y] of [[18, 12], [20, 16], [16, 18]]) P.set(x, y, PAL.ember[4]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}

// ================= 末班车：车头（一盏大灯、受电弓、挡风玻璃后面挤着一张张脸）和车厢（车窗里挤满长在一起的人） =================
// 车头 light：大灯亮不亮；dir 不管（整张翻）；derail：翻下轨道（车头歪着，挡风玻璃里伸出胳膊撑着地，拖着断掉的车钩）
export const HEAD_W = 74,
  HEAD_H = 50;
export function trainHeadSprite(light = true, frame = 0, derail = false) {
  return cached(`thead:${light ? 1 : 0}:${frame % 4}:${derail ? 1 : 0}`, () => {
    const P = new Pix(HEAD_W, HEAD_H),
      base = 46;
    if (derail) return canvasOf(trainCrawl(P, base, frame));
    // 车身：铁灰绿，车顶圆，车头朝右
    P.poly([[2, base - 34], [60, base - 34], [72, base - 22], [72, base - 4], [2, base - 4]], PAL.leaf[1]);
    for (let y = base - 34; y < base - 3; y++) for (let x = 2; x < 73; x++) if (P.opaque(x, y)) P.set(x, y, dither("leaf", 0.36 - (y - base + 34) / 90 - x / 400, x, y));
    P.hline(2, 62, base - 34, PAL.leaf[3]);
    P.hline(2, 72, base - 16, PAL.straw[1]);
    P.hline(2, 72, base - 15, PAL.straw[0]);
    // 挡风玻璃：后面一张张脸贴着
    P.poly([[56, base - 31], [66, base - 23], [66, base - 18], [54, base - 18]], PAL.water[0]);
    const r = rng(6161 + frame);
    for (let i = 0; i < 4; i++) {
      const x = 56 + Math.floor(r() * 9),
        y = base - 26 + Math.floor(r() * 7);
      blob(P, x, y, 2, 2, "skin", 0.3, 0.2);
    }
    // 侧窗（挤满了人）
    for (let w = 0; w < 4; w++) {
      const x0 = 6 + w * 12;
      P.rect(x0, base - 30, 9, 10, PAL.water[0]);
      for (let k = 0; k < 3; k++) blob(P, x0 + 2 + k * 3, base - 24 + (k % 2) * 2, 2, 2, "skin", 0.28, 0.2);
      P.hline(x0, x0 + 8, base - 30, PAL.water[2]);
    }
    // 大灯
    P.ellipse(68, base - 10, 3.5, 3.5, light ? PAL.straw[4] : PAL.stone[1]);
    if (light) P.set(67, base - 11, PAL.snow[4]);
    // 受电弓
    P.line(30, base - 34, 38, base - 42, PAL.stone[3]);
    P.line(46, base - 34, 38, base - 42, PAL.stone[3]);
    P.hline(32, 46, base - 43, PAL.stone[4]);
    if (frame % 2 && light) P.set(40, base - 45, PAL.water[5]);
    // 车轮、排障器
    for (const x of [12, 26, 50]) {
      P.ellipse(x, base - 3, 4, 3, PAL.ash[0]);
      P.set(x, base - 3, PAL.stone[3]);
    }
    P.poly([[64, base - 4], [73, base - 4], [70, base], [62, base]], PAL.rust[1]);
    // 车头上的编号牌
    P.rect(58, base - 33, 8, 3, PAL.ash[1]);
    P.hline(59, 64, base - 32, PAL.ember[3]);
    spots(P, 6262, 30, 4, base - 32, 66, 26, [PAL.rust[1], PAL.leaf[0], PAL.cloth[0]]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
// 车头翻下轨道：歪在地上，挡风玻璃里伸出几只胳膊撑着地往前爬，后面拖着断了的车钩
function trainCrawl(P, base, frame) {
  const step = frame % 2;
  P.poly([[4, base - 26], [52, base - 32], [66, base - 22], [66, base - 6], [4, base - 4]], PAL.leaf[1]);
  for (let y = 0; y < HEAD_H; y++) for (let x = 0; x < HEAD_W; x++) if (P.opaque(x, y)) P.set(x, y, dither("leaf", 0.3 - y / 160, x, y));
  P.hline(4, 66, base - 14, PAL.straw[1]);
  P.poly([[52, base - 29], [62, base - 21], [62, base - 16], [50, base - 17]], PAL.water[0]);
  // 撑地的胳膊
  for (let i = 0; i < 3; i++) {
    const x0 = 54 + i * 4,
      y0 = base - 18 + i * 2,
      x1 = 66 + i * 3 + (i % 2 === step ? 2 : -1),
      y1 = base - 1;
    limb(P, x0, y0, x1, y1, 2.5, 2, "skin", 0.32);
  }
  P.ellipse(64, base - 10, 3, 3, PAL.straw[4]);
  // 断车钩
  P.line(4, base - 10, -2, base - 4, PAL.stone[2]);
  P.rect(0, base - 6, 5, 4, PAL.stone[1]);
  for (let w = 0; w < 3; w++) P.rect(10 + w * 13, base - 24, 9, 9, PAL.water[0]);
  for (let w = 0; w < 3; w++) blob(P, 14 + w * 13, base - 20, 2.5, 2.5, "skin", 0.28, 0.2);
  spots(P, 6363, 34, 4, base - 30, 62, 26, [PAL.rust[1], PAL.leaf[0], PAL.cloth[0]]);
  P.outline(OUTLINE);
  return P;
}
export const CAR_W = 62,
  CAR_H = 46;
export function trainCarSprite(idx = 0, frame = 0, open = false) {
  return cached(`tcar:${idx % 4}:${frame % 2}:${open ? 1 : 0}`, () => {
    const P = new Pix(CAR_W, CAR_H),
      base = 42;
    P.rect(1, base - 32, 60, 28, PAL.leaf[1]);
    for (let y = base - 32; y < base - 4; y++) for (let x = 1; x < 61; x++) P.set(x, y, dither("leaf", 0.34 - (y - base + 32) / 90, x, y));
    P.hline(1, 60, base - 32, PAL.leaf[3]);
    P.hline(1, 60, base - 14, PAL.straw[1]);
    // 车窗里挤满了长在一起的人
    const r = rng(7070 + idx * 13 + frame);
    for (let w = 0; w < 4; w++) {
      const x0 = 4 + w * 14;
      P.rect(x0, base - 29, 10, 11, PAL.water[0]);
      for (let k = 0; k < 4; k++) blob(P, x0 + 2 + (k % 2) * 5, base - 26 + Math.floor(k / 2) * 5, 2.2, 2.2, r() < 0.5 ? "skin" : "stone", 0.3, 0.2);
      if (r() < 0.4) P.line(x0 + 1, base - 29, x0 + 8, base - 19, PAL.snow[2]);
    }
    // 中间一扇门（开着的时候黑洞洞）
    P.rect(27, base - 30, 8, 26, open ? OUTLINE : PAL.leaf[2]);
    P.vline(31, base - 30, base - 5, open ? OUTLINE : PAL.leaf[0]);
    // 车轮、车钩
    for (const x of [10, 52]) {
      P.ellipse(x, base - 3, 4, 3, PAL.ash[0]);
      P.set(x, base - 3, PAL.stone[3]);
    }
    P.rect(0, base - 10, 2, 3, PAL.stone[2]);
    P.rect(60, base - 10, 2, 3, PAL.stone[2]);
    spots(P, 7171 + idx, 28, 2, base - 31, 58, 26, [PAL.rust[1], PAL.leaf[0], PAL.cloth[0]]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}

// ================= 扑火：被火光吸过去、又被火烧过的东西一层压一层，压成一座会走的尸山；身上嵌着四团亮着的火（画面另画） =================
// pose：walk（frame 0–3 微微晃）、collapse（塌下去）；heart：那颗烧着的心
export const MOTH_W = 210,
  MOTH_H = 160;
export function mothSprite(pose = "walk", frame = 0) {
  return cached(`tmoth:${pose}:${frame % 4}`, () => {
    const P = new Pix(MOTH_W, MOTH_H),
      base = 156,
      sway = [0, 1, 0, -1][frame % 4],
      down = pose === "collapse",
      sink = down ? 40 : 0;
    const r = rng(3131);
    // 山：一层层的身子（越往上越窄），烧得焦黑，缝里透着暗红的光
    for (let layer = 0; layer < 9; layer++) {
      const y = base - 10 - layer * 15 + sink * (layer / 9),
        w = 96 - layer * 9 + (down ? layer * 4 : 0),
        n = 7 - Math.floor(layer / 2);
      for (let i = 0; i < n; i++) {
        const x = 105 + (i - (n - 1) / 2) * ((w * 2) / Math.max(1, n)) + (r() - 0.5) * 10 + sway * (layer / 3),
          rx = 14 + r() * 10,
          ry = 8 + r() * 5;
        blob(P, x, y, rx, ry, r() < 0.8 ? "ash" : "soil", 0.34 + layer * 0.035, 0.42);
      }
    }
    // 缝：一道道暗红、橙（越往下越亮，脚底下在烧）
    for (let i = 0; i < 150; i++) {
      const x = 14 + Math.floor(r() * 182),
        y = 8 + Math.floor(r() * 148);
      if (!P.opaque(x, y) || !P.opaque(x + 2, y) || !P.opaque(x, y + 1)) continue;
      const hot = y > base - 40 ? 2 : y > base - 90 ? 1 : 0;
      P.set(x, y, [PAL.ember[0], PAL.ember[1], PAL.ember[2]][hot]);
      if (i % 3 === 0) P.set(x + 1, y, [PAL.ember[1], PAL.ember[2], PAL.ember[3]][hot]);
    }
    // 伸出来的胳膊（灰白，烧过的）都朝前上方伸：朝着火光那边
    for (let i = 0; i < 30; i++) {
      const y0 = base - 18 - r() * 112 + sink * 0.5,
        x0 = 105 + (r() - 0.5) * (176 - (base - y0) * 0.62),
        a = -Math.PI / 2 + 0.55 + (r() - 0.5) * 1.6,
        len = 9 + r() * 13,
        x1 = x0 + Math.cos(a) * len,
        y1 = y0 + Math.sin(a) * len;
      limb(P, x0, y0, x1, y1, 3, 2, "skin", 0.16, 0.3);
      // 手：张着几根指头
      for (let k = -1; k <= 1; k++) P.set(x1 + Math.cos(a + k * 0.5) * 3, y1 + Math.sin(a + k * 0.5) * 3, PAL.skin[1]);
    }
    // 一个个脑袋：低着、眼窝里一点火
    for (let i = 0; i < 18; i++) {
      const y = base - 22 - r() * 104 + sink * 0.5,
        x = 105 + (r() - 0.5) * (156 - (base - y) * 0.6);
      blob(P, x, y, 4.5, 4.5, "ash", 0.5, 0.32);
      P.set(x - 1, y, PAL.ember[3]);
      P.set(x + 2, y, PAL.ember[3]);
    }
    // 整座山压暗一点、往红里偏
    for (let y = 0; y < MOTH_H; y++) for (let x = 0; x < MOTH_W; x++) if (P.opaque(x, y)) P.shade(x, y, 0.9, PAL.ember[0]);
    // 脚下：拖着的一堆，边上一圈火星
    blob(P, 105, base - 4, 98, 7, "ash", 0.16, 0.2);
    for (let i = 0; i < 40; i++) {
      const x = 12 + Math.floor(r() * 186),
        y = base - 6 + Math.floor(r() * 5);
      if (P.opaque(x, y)) P.set(x, y, i % 3 ? PAL.ember[2] : PAL.ember[4]);
    }
    spots(P, 3232 + frame, 120, 12, 12, 186, 144, [PAL.ash[0], PAL.soil[0], PAL.ash[2], PAL.rust[0]]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
// 那颗心：一团烧着的肉（两瓣、底下一个尖），一跳一跳；crawl 往前爬（几只手扒着地）
export const HEART_W = 56,
  HEART_H = 50;
export function heartSprite(frame = 0, crawl = false) {
  return cached(`theart:${frame % 4}:${crawl ? 1 : 0}`, () => {
    const P = new Pix(HEART_W, HEART_H),
      base = 46,
      beat = [0, 2, 1, 0][frame % 4];
    if (crawl)
      for (let i = 0; i < 4; i++) {
        const x0 = 16 + i * 8,
          x1 = x0 + 8 + ((i + frame) % 2) * 3;
        limb(P, x0, base - 10, x1, base, 2.5, 2, "stone", 0.4);
      }
    // 两瓣 + 底下的尖
    blob(P, 21, base - 24, 10 + beat, 10 + beat, "ember", 0.3, 0.42);
    blob(P, 35, base - 24, 10 + beat, 10 + beat, "ember", 0.24, 0.42);
    P.poly([[12 - beat, base - 22], [44 + beat, base - 22], [28, base - 4 + beat]], PAL.ember[0]);
    for (let y = base - 22; y < base; y++) for (let x = 0; x < HEART_W; x++) if (P.opaque(x, y) && P.get(x, y)[0] === 0x5e) P.set(x, y, dither("ember", 0.18 - (y - base + 22) / 120 + (28 - x) / 160, x, y));
    // 一道道烧着的筋（只在心里面）
    for (let i = 0; i < 6; i++) {
      const x0 = 15 + i * 5,
        y0 = base - 32 + (i % 2) * 3;
      for (let t = 0; t < 22; t++) {
        const x = Math.round(x0 + (i - 2.5) * 0.18 * t + Math.sin(t * 0.7 + i) * 0.7),
          y = y0 + t;
        if (P.opaque(x, y) && P.opaque(x - 1, y) && P.opaque(x + 1, y)) P.set(x, y, i % 2 ? PAL.ember[3] : PAL.ember[2]);
      }
    }
    // 心口那团火
    const f = frame % 3;
    P.poly([[18, base - 32], [22, base - 43 - f], [27, base - 36], [31, base - 47 + f], [36, base - 34], [40, base - 40 - f], [42, base - 30]], PAL.ember[3]);
    P.poly([[22, base - 32], [27, base - 39], [31, base - 35], [36, base - 37], [39, base - 31]], PAL.ember[5]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}

// ================= 地上的东西 =================
// 雕爷的库存：一只军绿的木箱，钉着灰隼团的旗
export function stashSprite() {
  return cached("tstash", () => {
    const P = new Pix(26, 22);
    P.rect(2, 8, 22, 12, PAL.leaf[1]);
    for (let y = 8; y < 20; y++) for (let x = 2; x < 24; x++) P.set(x, y, dither("leaf", 0.5 - (x - 2) / 44, x, y));
    P.hline(2, 23, 8, PAL.leaf[3]);
    P.hline(2, 23, 13, PAL.leaf[0]);
    P.vline(8, 8, 19, PAL.leaf[0]);
    P.vline(18, 8, 19, PAL.leaf[0]);
    P.rect(11, 14, 4, 3, PAL.stone[3]);
    // 旗：一根杆，一面灰旗，上面一只隼
    P.vline(21, 0, 8, PAL.soil[2]);
    P.rect(13, 0, 8, 5, PAL.stone[2]);
    P.line(15, 3, 18, 1, PAL.ash[1]);
    P.set(17, 2, PAL.ember[3]);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
// 油桶（黑潮扔过来的）
export function drumSprite(frame = 0) {
  return cached(`tdrum:${frame % 2}`, () => {
    const P = new Pix(16, 18);
    P.rect(2, 2, 12, 15, PAL.night[1]);
    for (let y = 2; y < 17; y++) for (let x = 2; x < 14; x++) P.set(x, y, dither("night", 0.5 - (x - 2) / 20, x, y));
    P.hline(2, 13, 6, PAL.ash[2]);
    P.hline(2, 13, 12, PAL.ash[2]);
    P.ellipse(8, 2, 6, 1.5, PAL.night[2]);
    P.set(5, 9, PAL.straw[3]);
    if (frame % 2) P.set(10, 1, OUTLINE);
    P.outline(OUTLINE);
    return canvasOf(P);
  });
}
export const SPRITES2 = { DOG_W, DOG_H, DIAO_W, DIAO_H, TIDE_W, TIDE_H, VENT_W, VENT_H, HEAD_W, HEAD_H, CAR_W, CAR_H, MOTH_W, MOTH_H };
export { clamp };
