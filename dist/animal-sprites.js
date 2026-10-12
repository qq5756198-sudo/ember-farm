// v0.25.0「长夜」：动物重画——鸡、山羊、阿兰的羊、麦穗（狗），按人物的像素画法（同一套调色板、深色描边），走路 4 帧。
// 都朝右画，朝左时翻过来；画一次存起来。
import { PAL, OUTLINE, Pix, cached } from "./pixel-kit.js";

const A = PAL.ash,
  So = PAL.soil,
  E = PAL.ember,
  St = PAL.straw,
  Sn = PAL.snow,
  Cl = PAL.cloth;

// 四只脚：前后各一对，挨着画（远的那只颜色深一点）；f 是第几帧（0、2 站，1、3 迈步：近的和远的一前一后）
function legs(P, back, front, y, h, near, far, f, step = 1) {
  const sw = f === 1 ? step : f === 3 ? -step : 0;
  for (const x of [back, front]) {
    P.vline(x - sw, y, y + h - 1 - (sw < 0 ? 1 : 0), far);
    P.vline(x + 1 + sw, y, y + h - 1 - (sw > 0 ? 1 : 0), near);
  }
}

// ---------- 鸡：0 站、1 走、2 低头啄、3 走 ----------
export function chickenSprite(frame = 0, hen = 0) {
  return cached("chicken:" + frame + ":" + hen, () => {
    const P = new Pix(13, 12),
      body = hen ? So[4] : Sn[4],
      shade = hen ? So[3] : Sn[2],
      peck = frame === 2;
    // 身子、尾巴
    P.ellipse(5, 6, 4, 3, body);
    P.poly([[1, 3], [3, 5], [1, 7]], shade);
    P.hline(2, 8, 8, shade);
    P.set(4, 5, shade);
    P.set(5, 5, shade);
    // 头
    const hx = peck ? 9 : 8,
      hy = peck ? 7 : 3;
    P.disc(hx, hy, 1.6, body);
    P.set(hx + 2, hy, E[4]);
    P.set(hx + 2, hy + 1, E[3]);
    P.set(hx, hy - 2, Cl[1]);
    P.set(hx + 1, hy - 2, Cl[1]);
    P.set(hx + 1, hy + 1, Cl[2]);
    P.set(hx + 1, hy - 1, A[0]);
    if (!peck) P.vline(7, 4, 5, body);
    // 脚
    const step = frame === 1 ? 1 : frame === 3 ? -1 : 0;
    P.vline(4 - step, 9, 11, E[3]);
    P.vline(6 + step, 9, 11, E[3]);
    P.outline(OUTLINE);
    return P.toCanvas();
  });
}

// ---------- 山羊：灰白，弯角，胡子 ----------
export function goatSprite(frame = 0) {
  return cached("goat:" + frame, () => {
    const P = new Pix(19, 15),
      bob = frame % 2 ? 1 : 0;
    P.ellipse(8, 7 + bob, 6, 3.5, Sn[3]);
    P.hline(3, 12, 10 + bob, Sn[1]);
    P.ellipse(7, 6 + bob, 4, 1.5, Sn[4]);
    P.poly([[1, 5 + bob], [3, 6 + bob], [2, 8 + bob]], Sn[2]);
    // 头、角、胡子
    P.rect(13, 3 + bob, 3, 4, Sn[3]);
    P.rect(15, 4 + bob, 2, 3, Sn[3]);
    P.set(16, 5 + bob, A[1]);
    P.set(14, 4 + bob, A[0]);
    P.line(13, 3 + bob, 11, 0 + bob, So[2]);
    P.set(12, 2 + bob, So[3]);
    P.vline(15, 7 + bob, 8 + bob, Sn[1]);
    legs(P, 4, 11, 10 + bob, 4, A[3], A[1], frame);
    P.outline(OUTLINE);
    return P.toCanvas();
  });
}

// ---------- 羊：一团米白的毛，黑脸黑脚 ----------
export function sheepSprite(frame = 0) {
  return cached("sheep:" + frame, () => {
    const P = new Pix(18, 14),
      bob = frame % 2 ? 1 : 0;
    P.ellipse(8, 6 + bob, 6.5, 4, Sn[4]);
    for (const [x, y] of [[4, 4], [7, 3], [10, 4], [5, 7], [9, 7], [12, 6], [3, 6]]) P.set(x, y + bob, Sn[2]);
    P.hline(3, 13, 10 + bob, Sn[2]);
    // 脸
    P.rect(13, 4 + bob, 3, 4, A[2]);
    P.set(16, 6 + bob, A[2]);
    P.set(15, 5 + bob, Sn[4]);
    P.set(13, 3 + bob, A[3]);
    legs(P, 4, 11, 10 + bob, 3, A[2], A[0], frame);
    P.outline(OUTLINE);
    return P.toCanvas();
  });
}

// ---------- 麦穗：麦黄色的小土狗，耳朵颜色深一点，尾巴翘着；4 帧跑、坐着 ----------
export function dogSprite(frame = 0, sit = false) {
  return cached("dog:" + frame + ":" + (sit ? 1 : 0), () => {
    const P = new Pix(18, 14),
      body = St[2],
      dark = So[3],
      light = St[3];
    if (sit) {
      P.ellipse(8, 8, 4, 4, body);
      P.ellipse(7, 7, 2.5, 2.5, light);
      P.poly([[3, 9], [1, 6], [2, 5], [4, 8]], body);
      P.disc(11, 4, 2.6, body);
      P.rect(13, 4, 2, 2, body);
      P.set(15, 5, A[0]);
      P.set(12, 3, A[0]);
      P.poly([[9, 1], [10, 3], [8, 3]], dark);
      P.vline(10, 10, 13, body);
      P.vline(7, 11, 13, dark);
      P.hline(5, 11, 13, dark);
      P.set(11, 7, Cl[1]);
      P.outline(OUTLINE);
      return P.toCanvas();
    }
    const bob = frame === 1 || frame === 3 ? -1 : 0;
    P.ellipse(8, 7 + bob, 5.5, 2.6, body);
    P.ellipse(7, 6 + bob, 3.5, 1.3, light);
    // 头
    P.disc(13, 5 + bob, 2.4, body);
    P.rect(15, 5 + bob, 2, 2, body);
    P.set(17, 6 + bob, A[0]);
    P.set(14, 4 + bob, A[0]);
    P.poly([[11, 2 + bob], [12, 1 + bob], [13, 3 + bob]], dark);
    P.set(13, 8 + bob, Cl[1]);
    // 尾巴：跑起来往后甩
    const tail = frame % 2 ? [[3, 6], [1, 4]] : [[3, 6], [1, 3]];
    P.line(tail[0][0], tail[0][1] + bob, tail[1][0], tail[1][1] + bob, body);
    P.set(tail[1][0], tail[1][1] + bob, light);
    legs(P, 4, 10, 9 + bob, 4, So[3], So[2], frame, 1);
    P.outline(OUTLINE);
    return P.toCanvas();
  });
}
