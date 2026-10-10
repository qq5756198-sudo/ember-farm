// 新画面：把原来的三张小图集（物品与人物、扩建、边境）换成同样排布的像素版——
// 每 N×N 一块取平均色、换成调色板里最近的颜色、边缘只有“有”和“没有”。排布不变，所有用到它们的地方都不用改。
import { makeCanvas, nearestPal, OUTLINE, rgb } from "./pixel-kit.js";

const done = new Map();
export function pixelizeSheet(img, block = 5, key = "") {
  if (!img || !img.width) return null;
  const id = key || img.src || img;
  if (done.has(id)) return done.get(id);
  let out = null;
  try {
    const W = img.width,
      H = img.height,
      src = makeCanvas(W, H),
      dst = makeCanvas(W, H);
    if (!src || !dst) return null;
    const sc = src.getContext("2d");
    sc.drawImage(img, 0, 0);
    const data = sc.getImageData(0, 0, W, H).data,
      dc = dst.getContext("2d"),
      outImg = dc.createImageData(W, H),
      o = outImg.data,
      bw = Math.ceil(W / block),
      bh = Math.ceil(H / block),
      solid = new Uint8Array(bw * bh),
      cols = new Array(bw * bh);
    for (let by = 0; by < bh; by++)
      for (let bx = 0; bx < bw; bx++) {
        let r = 0,
          g = 0,
          b = 0,
          a = 0,
          n = 0;
        for (let y = by * block; y < Math.min(H, (by + 1) * block); y++)
          for (let x = bx * block; x < Math.min(W, (bx + 1) * block); x++) {
            const i = (y * W + x) * 4,
              al = data[i + 3] / 255;
            r += data[i] * al;
            g += data[i + 1] * al;
            b += data[i + 2] * al;
            a += al;
            n++;
          }
        if (!n || a / n < 0.45) continue;
        solid[by * bw + bx] = 1;
        cols[by * bw + bx] = nearestPal(r / a, g / a, b / a);
      }
    // 外圈描一道深色边，和新画的小图一样
    const line = rgb(OUTLINE);
    for (let by = 0; by < bh; by++)
      for (let bx = 0; bx < bw; bx++) {
        const k = by * bw + bx;
        let c = cols[k];
        if (!solid[k]) {
          const near = (bx > 0 && solid[k - 1]) || (bx < bw - 1 && solid[k + 1]) || (by > 0 && solid[k - bw]) || (by < bh - 1 && solid[k + bw]);
          if (!near) continue;
          c = line;
        }
        for (let y = by * block; y < Math.min(H, (by + 1) * block); y++)
          for (let x = bx * block; x < Math.min(W, (bx + 1) * block); x++) {
            const i = (y * W + x) * 4;
            o[i] = c[0];
            o[i + 1] = c[1];
            o[i + 2] = c[2];
            o[i + 3] = 255;
          }
      }
    dc.putImageData(outImg, 0, 0);
    out = dst;
  } catch (err) {
    if (globalThis.console) console.warn("pixel sheet failed", err);
    out = null;
  }
  done.set(id, out);
  return out;
}
// 三张图集的像素版；物品格子用的那张也给一个可以放进样式表的地址
export function pixelSheets(assets) {
  const sprites = pixelizeSheet(assets?.sprites, 5, "sprites"),
    expansion = pixelizeSheet(assets?.expansion, 5, "expansion"),
    frontier = pixelizeSheet(assets?.frontier, 5, "frontier");
  let spritesUrl = null;
  try {
    spritesUrl = sprites?.toDataURL ? sprites.toDataURL("image/png") : null;
  } catch {
    spritesUrl = null;
  }
  return { sprites, expansion, frontier, spritesUrl };
}
