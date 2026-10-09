// 新画面的建筑和农场里的固定物件：每样一张像素小图，脚底中心对齐。
// 返回 { canvas, light? }：light 是相对脚底的发光点（美术像素），夜里会亮。
import { PAL, OUTLINE, Pix, cached, mix, hash2, rng } from "./pixel-kit.js";

const done = (P, extra = {}) => ({ canvas: P.toCanvas(), w: P.w, h: P.h, ...extra });
// 木板面：横纹，带一点随机深浅
function planks(P, x, y, w, h, ramp = [PAL.soil[1], PAL.soil[2], PAL.soil[3]], vertical = false, seed = 1) {
  for (let j = 0; j < h; j++)
    for (let i = 0; i < w; i++) {
      const k = vertical ? i : j,
        board = Math.floor(k / 3),
        line = k % 3 === 2;
      let c = hash2(board, seed, 4) > 0.5 ? ramp[1] : ramp[2];
      if (line) c = ramp[0];
      if (hash2(x + i, y + j, seed) > 0.95) c = ramp[0];
      P.set(x + i, y + j, c);
    }
}
function metal(P, x, y, w, h, ramp = [PAL.stone[1], PAL.stone[2], PAL.stone[3], PAL.stone[4]]) {
  P.rect(x, y, w, h, ramp[2]);
  P.hline(x, x + w - 1, y, ramp[3]);
  P.vline(x, y, y + h - 1, ramp[3]);
  P.hline(x, x + w - 1, y + h - 1, ramp[0]);
  P.vline(x + w - 1, y, y + h - 1, ramp[1]);
}
function box(P, x, y, w, h, top, front, side) {
  // 顶面 + 正面，简单的立体箱子
  const th = Math.max(2, Math.round(h * 0.35));
  P.rect(x, y, w, th, top);
  P.rect(x, y + th, w, h - th, front);
  P.vline(x + w - 1, y + th, y + h - 1, side);
  P.hline(x, x + w - 1, y + th, mix(front, "#000000", 0.25));
}
const RUST = PAL.rust;

// ---------- 建筑 ----------
const BUILD = {
  chest() {
    const P = new Pix(26, 20);
    planks(P, 2, 6, 22, 12, [PAL.soil[1], PAL.soil[2], PAL.soil[3]], true, 3);
    P.rect(2, 3, 22, 4, PAL.soil[3]);
    P.hline(2, 23, 3, PAL.straw[1]);
    for (const x of [5, 20]) {
      P.vline(x, 3, 17, PAL.stone[3]);
      P.vline(x + 1, 3, 17, PAL.stone[1]);
    }
    P.hline(2, 23, 7, PAL.stone[2]);
    P.rect(12, 7, 3, 3, PAL.ember[4]);
    P.set(13, 9, PAL.soil[0]);
    P.hline(2, 23, 18, PAL.soil[0]);
    return done(P.outline());
  },
  cook() {
    // 石圈篝火 + 旁边的小铁炉和锅
    const P = new Pix(34, 24);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2,
        x = 11 + Math.cos(a) * 8,
        y = 17 + Math.sin(a) * 4;
      P.ellipse(x, y, 2, 1.6, i % 3 ? PAL.stone[3] : PAL.stone[2]);
      P.set(x - 1, y - 1, PAL.stone[4]);
    }
    P.ellipse(11, 17, 5, 2.4, PAL.ash[1]);
    P.line(6, 18, 15, 15, PAL.soil[1]);
    P.line(7, 15, 16, 18, PAL.soil[2]);
    // 三脚架和锅
    P.line(5, 19, 11, 4, PAL.soil[0]);
    P.line(17, 19, 11, 4, PAL.soil[0]);
    P.line(11, 4, 11, 9, PAL.ash[2]);
    P.ellipse(11, 11, 3.5, 2.5, PAL.ash[2]);
    P.hline(8, 14, 9, PAL.stone[3]);
    // 铁炉
    metal(P, 22, 8, 10, 12, [PAL.ash[1], PAL.ash[2], PAL.ash[3], PAL.stone[2]]);
    P.rect(24, 13, 6, 4, PAL.ash[0]);
    P.vline(26, 1, 8, PAL.ash[2]);
    P.vline(27, 1, 8, PAL.ash[1]);
    P.rect(21, 19, 12, 2, PAL.ash[0]);
    return done(P.outline(), { fire: { x: 11, y: 16 }, stove: { x: 27, y: 15 } });
  },
  rain() {
    const P = new Pix(18, 26);
    P.rect(3, 8, 12, 16, PAL.water[3]);
    P.vline(3, 8, 23, PAL.water[4]);
    P.vline(14, 8, 23, PAL.water[1]);
    for (const y of [11, 18]) P.hline(3, 14, y, PAL.water[1]);
    P.ellipse(9, 8, 6, 2, PAL.water[4]);
    P.ellipse(9, 8, 4.5, 1.2, PAL.water[1]);
    // 漏斗和水管
    P.poly([[4, 2], [14, 2], [11, 7], [7, 7]], PAL.stone[3]);
    P.hline(4, 14, 2, PAL.stone[4]);
    P.vline(16, 0, 14, PAL.stone[2]);
    P.hline(14, 16, 14, PAL.stone[2]);
    P.hline(3, 14, 24, PAL.water[0]);
    return done(P.outline());
  },
  workbench() {
    const P = new Pix(36, 24);
    // 桌面
    P.rect(2, 8, 32, 5, PAL.soil[3]);
    P.hline(2, 33, 8, PAL.straw[2]);
    P.hline(2, 33, 12, PAL.soil[1]);
    for (const x of [3, 31]) P.rect(x, 13, 3, 9, PAL.soil[1]);
    P.rect(3, 18, 31, 2, PAL.soil[2]);
    // 工具：锯、锤子、台钳、木板
    P.line(6, 7, 14, 5, PAL.stone[4]);
    P.line(6, 8, 14, 6, PAL.stone[3]);
    P.rect(16, 5, 2, 3, PAL.soil[1]);
    P.rect(15, 4, 5, 2, PAL.stone[2]);
    metal(P, 24, 4, 7, 5);
    P.rect(26, 2, 3, 2, PAL.stone[2]);
    P.rect(20, 6, 4, 2, PAL.straw[2]);
    // 墙上的工具板
    P.rect(5, 0, 20, 4, PAL.soil[2]);
    for (const x of [8, 13, 18, 22]) P.vline(x, 0, 3, PAL.stone[3]);
    return done(P.outline());
  },
  weaponbench() {
    const P = new Pix(36, 26);
    metal(P, 2, 10, 32, 5, [PAL.ash[2], PAL.stone[1], PAL.stone[2], PAL.stone[3]]);
    for (const x of [3, 31]) P.rect(x, 15, 3, 9, PAL.ash[2]);
    P.rect(3, 20, 31, 2, PAL.ash[1]);
    // 枪架
    P.rect(4, 0, 28, 10, PAL.soil[1]);
    P.rect(5, 1, 26, 8, PAL.soil[0]);
    for (const [x, len] of [[8, 7], [14, 8], [20, 6], [26, 7]]) {
      P.vline(x, 9 - len, 8, PAL.ash[3]);
      P.vline(x + 1, 9 - len, 8, PAL.soil[2]);
    }
    P.rect(6, 11, 6, 2, PAL.ember[2]);
    P.rect(22, 11, 5, 3, PAL.leaf[1]);
    for (let i = 0; i < 4; i++) P.set(14 + i * 2, 12, PAL.straw[3]);
    return done(P.outline());
  },
  breeder() {
    const P = new Pix(26, 20);
    planks(P, 2, 9, 22, 9, [PAL.soil[1], PAL.soil[2], PAL.soil[3]], false, 5);
    // 玻璃顶，里面是小苗
    P.rect(3, 3, 20, 7, PAL.water[1]);
    for (let x = 5; x < 22; x += 3) {
      P.set(x, 8, PAL.leaf[4]);
      P.set(x, 7, PAL.leaf[5]);
    }
    P.rect(3, 3, 20, 1, PAL.water[5]);
    P.line(4, 4, 9, 4, PAL.water[4]);
    P.rect(2, 2, 22, 1, PAL.stone[3]);
    P.rect(18, 12, 3, 2, PAL.ember[4]);
    return done(P.outline(), { glow: { x: 19, y: 13, color: "#f6b05a" } });
  },
  fence() {
    const P = new Pix(38, 14);
    for (const y of [4, 8]) {
      P.hline(1, 36, y, PAL.soil[3]);
      P.hline(1, 36, y + 1, PAL.soil[1]);
    }
    for (const x of [2, 18, 34]) {
      P.rect(x, 1, 3, 12, PAL.soil[2]);
      P.vline(x, 1, 12, PAL.soil[3]);
      P.set(x + 1, 0, PAL.soil[2]);
    }
    // 一块锈铁皮补丁
    P.rect(22, 3, 8, 7, RUST[2]);
    for (let x = 22; x < 30; x += 2) P.vline(x, 3, 9, RUST[1]);
    return done(P.outline());
  },
  fenceV() {
    const P = new Pix(10, 40);
    for (const x of [3, 6]) P.vline(x, 2, 37, PAL.soil[2]);
    for (const y of [2, 18, 34]) {
      P.rect(2, y, 6, 4, PAL.soil[3]);
      P.hline(2, 7, y + 3, PAL.soil[1]);
    }
    return done(P.outline());
  },
  gate() {
    const P = new Pix(38, 18);
    for (const x of [1, 34]) {
      P.rect(x, 0, 3, 17, PAL.soil[1]);
      P.vline(x, 0, 16, PAL.soil[2]);
    }
    planks(P, 5, 4, 28, 10, [PAL.soil[1], PAL.soil[2], PAL.soil[3]], true, 9);
    P.line(5, 13, 32, 4, PAL.soil[1]);
    P.hline(5, 32, 4, PAL.straw[1]);
    return done(P.outline());
  },
  trap() {
    // 拒马：交叉的尖木桩
    const P = new Pix(28, 20);
    P.line(2, 16, 26, 16, PAL.soil[1]);
    P.line(2, 17, 26, 17, PAL.soil[2]);
    for (const x of [5, 13, 21]) {
      P.line(x - 4, 18, x + 4, 2, PAL.soil[2]);
      P.line(x + 4, 18, x - 4, 2, PAL.soil[3]);
      P.set(x + 4, 1, PAL.stone[4]);
      P.set(x - 4, 1, PAL.stone[4]);
    }
    for (let i = 0; i < 6; i++) P.set(3 + i * 4, 9 + (i % 2), PAL.stone[3]);
    return done(P.outline());
  },
  bed() {
    const P = new Pix(30, 18);
    P.rect(2, 6, 26, 9, PAL.soil[2]);
    P.rect(3, 4, 24, 8, PAL.cloth[3]);
    for (let x = 6; x < 27; x += 4) P.vline(x, 4, 11, PAL.cloth[4]);
    P.rect(3, 4, 7, 6, PAL.cloth[5]);
    P.rect(3, 9, 7, 1, PAL.stone[4]);
    for (const x of [3, 25]) P.rect(x, 15, 2, 2, PAL.soil[1]);
    return done(P.outline());
  },
  stall() {
    const P = new Pix(40, 32);
    // 条纹雨棚
    for (let x = 1; x < 39; x++) for (let y = 2; y < 9; y++) P.set(x, y, Math.floor((x - 1) / 5) % 2 ? PAL.cloth[5] : PAL.cloth[1]);
    for (let x = 1; x < 39; x += 5) P.set(x + 2, 9, Math.floor((x - 1) / 5) % 2 ? PAL.cloth[5] : PAL.cloth[1]);
    P.hline(1, 38, 1, PAL.cloth[0]);
    for (const x of [3, 35]) P.rect(x, 9, 2, 21, PAL.soil[1]);
    // 摊台和菜筐
    planks(P, 2, 20, 36, 8, [PAL.soil[1], PAL.soil[2], PAL.soil[3]], true, 4);
    for (const [x, col] of [[7, PAL.cloth[2]], [16, PAL.ember[3]], [25, PAL.leaf[4]]]) {
      P.rect(x, 16, 8, 5, PAL.straw[1]);
      for (let i = 0; i < 5; i++) P.disc(x + 1 + i * 1.5, 15 + (i % 2), 1.4, col);
    }
    return done(P.outline());
  },
  canner() {
    const P = new Pix(32, 28);
    // 锅炉和罐头
    metal(P, 4, 6, 14, 18, [PAL.stone[1], PAL.stone[2], PAL.stone[3], PAL.stone[4]]);
    P.ellipse(11, 6, 7, 2.4, PAL.stone[4]);
    P.rect(8, 15, 6, 4, PAL.ash[0]);
    P.vline(14, 0, 6, PAL.stone[2]);
    P.rect(13, 0, 3, 2, PAL.stone[3]);
    P.rect(18, 14, 12, 10, PAL.soil[2]);
    P.hline(18, 29, 14, PAL.soil[3]);
    for (let i = 0; i < 3; i++) {
      P.rect(19 + i * 4, 10, 3, 4, PAL.stone[4]);
      P.hline(19 + i * 4, 21 + i * 4, 10, PAL.cloth[2]);
    }
    P.rect(4, 24, 26, 2, PAL.ash[1]);
    return done(P.outline(), { glow: { x: 11, y: 17, color: "#e5823a" } });
  },
  tower() {
    const P = new Pix(32, 60);
    for (const [x0, x1] of [[5, 9], [26, 22]]) {
      P.line(x0, 58, x1, 16, PAL.soil[1]);
      P.line(x0 + 1, 58, x1 + 1, 16, PAL.soil[2]);
    }
    for (const y of [26, 40]) P.line(7, y + 14, 25, y, PAL.soil[1]);
    // 平台与围栏
    planks(P, 3, 12, 26, 5, [PAL.soil[1], PAL.soil[2], PAL.soil[3]], true, 6);
    P.rect(3, 4, 26, 2, PAL.soil[2]);
    for (const x of [3, 15, 27]) P.vline(x, 4, 12, PAL.soil[1]);
    // 顶棚
    P.poly([[1, 4], [16, -2], [31, 4]], RUST[2]);
    P.hline(1, 30, 4, RUST[0]);
    // 梯子
    for (let y = 18; y < 58; y += 4) P.hline(14, 18, y, PAL.straw[1]);
    P.vline(14, 17, 58, PAL.soil[2]);
    P.vline(18, 17, 58, PAL.soil[2]);
    return done(P.outline(), { lamp: { x: 16, y: 8 } });
  },
  lure() {
    const P = new Pix(16, 30);
    P.vline(7, 6, 28, PAL.stone[2]);
    P.vline(8, 6, 28, PAL.stone[1]);
    metal(P, 2, 2, 12, 9, [PAL.ash[1], PAL.ash[2], PAL.ash[3], PAL.stone[3]]);
    P.disc(8, 6, 3, PAL.ash[0]);
    P.disc(8, 6, 1.4, PAL.stone[3]);
    P.rect(5, 26, 6, 3, PAL.stone[1]);
    return done(P.outline(), { glow: { x: 12, y: 3, color: "#d2654c" } });
  },
  repairpost() {
    const P = new Pix(30, 26);
    metal(P, 3, 6, 16, 18, [PAL.water[0], PAL.water[1], PAL.water[2], PAL.water[3]]);
    P.vline(11, 7, 22, PAL.water[0]);
    P.rect(13, 13, 2, 3, PAL.straw[3]);
    // 扳手招牌
    P.vline(24, 2, 24, PAL.soil[1]);
    P.rect(20, 2, 9, 7, PAL.straw[3]);
    P.line(21, 7, 27, 3, PAL.stone[1]);
    P.set(21, 7, PAL.stone[1]);
    return done(P.outline());
  },
  irrigation() {
    const P = new Pix(22, 24);
    metal(P, 5, 10, 12, 10, [PAL.water[0], PAL.water[1], PAL.water[2], PAL.water[3]]);
    P.disc(11, 15, 3, PAL.stone[3]);
    P.disc(11, 15, 1.5, PAL.stone[1]);
    P.vline(11, 1, 10, PAL.stone[3]);
    P.hline(6, 16, 2, PAL.stone[3]);
    P.set(5, 3, PAL.water[5]);
    P.set(17, 3, PAL.water[5]);
    P.hline(1, 5, 18, PAL.stone[2]);
    P.hline(17, 21, 18, PAL.stone[2]);
    P.rect(4, 20, 14, 2, PAL.ash[1]);
    return done(P.outline());
  },
  solar() {
    const P = new Pix(36, 26);
    for (const x of [6, 29]) P.rect(x, 14, 2, 10, PAL.stone[2]);
    P.poly([[2, 4], [34, 4], [32, 17], [4, 17]], PAL.stone[4]);
    for (let y = 5; y < 17; y++)
      for (let x = 4; x < 33; x++) {
        if (!P.opaque(x, y)) continue;
        const cell = (x - 4) % 6 === 5 || (y - 5) % 4 === 3;
        P.set(x, y, cell ? PAL.night[1] : (x + y * 2) % 11 === 0 ? PAL.night[3] : PAL.night[2]);
      }
    P.line(5, 5, 12, 5, PAL.water[5]);
    P.rect(14, 20, 8, 4, PAL.ash[2]);
    P.set(20, 21, PAL.leaf[5]);
    return done(P.outline(), { glow: { x: 20, y: 21, color: "#aab258" } });
  },
  drone() {
    const P = new Pix(32, 22);
    // 起降台
    P.ellipse(16, 17, 14, 4, PAL.stone[2]);
    P.ellipse(16, 16, 13, 3, PAL.stone[3]);
    P.ellipse(16, 16, 6, 1.6, PAL.ember[4]);
    P.ellipse(16, 16, 4.4, 0.8, PAL.stone[3]);
    // 小四旋翼
    P.rect(12, 6, 8, 4, PAL.ash[2]);
    P.hline(12, 19, 6, PAL.ash[3]);
    for (const [x, y] of [[8, 4], [24, 4], [8, 10], [24, 10]]) {
      P.line(16, 8, x, y, PAL.ash[1]);
      P.hline(x - 3, x + 3, y, PAL.stone[4]);
    }
    P.set(16, 8, PAL.leaf[5]);
    return done(P.outline(), { glow: { x: 16, y: 8, color: "#aab258" } });
  },
  greenhouse() {
    const P = new Pix(44, 36);
    // 拱形塑料棚：骨架 + 半透明膜 + 里面的绿
    for (let y = 4; y < 32; y++)
      for (let x = 2; x < 42; x++) {
        const t = (x - 22) / 20,
          roof = 4 + Math.round(t * t * 14);
        if (y < roof) continue;
        let c = y > 22 ? (hash2(x, y, 3) > 0.5 ? PAL.leaf[3] : PAL.leaf[4]) : mix(PAL.water[4], PAL.stone[5], 0.4);
        if ((x - 2) % 8 === 0) c = PAL.stone[2];
        if (y === roof) c = PAL.stone[5];
        P.set(x, y, c);
      }
    P.rect(18, 20, 8, 12, PAL.water[2]);
    P.vline(22, 20, 31, PAL.stone[3]);
    P.hline(2, 41, 32, PAL.soil[1]);
    for (let i = 0; i < 12; i++) P.set(4 + Math.floor(hash2(i, 1, 2) * 36), 23 + Math.floor(hash2(i, 2, 2) * 8), hash2(i, 3, 2) > 0.5 ? PAL.cloth[2] : PAL.leaf[5]);
    return done(P.outline());
  },
  coop() {
    const P = new Pix(36, 30);
    planks(P, 5, 12, 26, 14, [RUST[0], PAL.cloth[0], RUST[1]], true, 8);
    P.poly([[2, 13], [18, 2], [34, 13]], PAL.stone[2]);
    for (let x = 4; x < 33; x += 3) P.line(x, 13, 18, 3, PAL.stone[1]);
    P.hline(2, 33, 13, PAL.stone[4]);
    P.rect(14, 17, 7, 9, PAL.ash[0]);
    P.line(21, 26, 30, 29, PAL.soil[3]);
    P.line(21, 25, 30, 28, PAL.soil[2]);
    P.rect(7, 16, 4, 4, PAL.straw[3]);
    P.set(8, 17, PAL.straw[4]);
    return done(P.outline(), { glow: { x: 9, y: 18, color: "#ddc98c" } });
  },
  fishTrap() {
    const P = new Pix(20, 16);
    P.ellipse(10, 9, 8, 5, PAL.straw[1]);
    for (let x = 3; x < 18; x += 2) P.vline(x, 5, 13, PAL.straw[0]);
    P.ellipse(4, 9, 2, 3, PAL.straw[2]);
    P.ellipse(4, 9, 1, 2, PAL.ash[1]);
    return done(P.outline());
  },
  lamp() {
    // 木杆上挂一盏油灯
    const P = new Pix(14, 32);
    P.vline(5, 4, 30, PAL.soil[1]);
    P.vline(6, 4, 30, PAL.soil[2]);
    P.hline(5, 11, 4, PAL.soil[1]);
    P.vline(10, 5, 7, PAL.ash[2]);
    P.rect(8, 8, 5, 6, PAL.ash[2]);
    P.rect(9, 9, 3, 4, PAL.ember[4]);
    P.hline(8, 12, 14, PAL.ash[1]);
    P.rect(3, 29, 6, 2, PAL.soil[1]);
    return done(P.outline(), { lamp: { x: 10, y: 11 } });
  },
  chair() {
    const P = new Pix(14, 16);
    P.rect(3, 2, 8, 6, PAL.soil[2]);
    P.rect(3, 8, 8, 3, PAL.soil[3]);
    for (const x of [3, 10]) P.vline(x, 11, 14, PAL.soil[1]);
    return done(P.outline());
  },
  bookshelf() {
    const P = new Pix(20, 22);
    P.rect(2, 2, 16, 18, PAL.soil[1]);
    for (const y of [3, 9, 15]) {
      P.rect(3, y, 14, 5, PAL.soil[0]);
      for (let x = 3; x < 17; x += 2) P.vline(x, y + (x % 3 === 0 ? 1 : 0), y + 4, [PAL.cloth[1], PAL.cloth[4], PAL.straw[2], PAL.leaf[3]][(x + y) % 4]);
    }
    return done(P.outline());
  },
  table() {
    const P = new Pix(26, 18);
    P.rect(2, 4, 22, 6, PAL.soil[3]);
    P.hline(2, 23, 4, PAL.straw[2]);
    P.hline(2, 23, 9, PAL.soil[1]);
    for (const x of [3, 21]) P.rect(x, 10, 2, 7, PAL.soil[1]);
    P.ellipse(9, 5, 2.5, 1.2, PAL.cloth[5]);
    P.ellipse(17, 5, 2.5, 1.2, PAL.cloth[5]);
    P.set(9, 5, PAL.ember[3]);
    return done(P.outline());
  },
  harvestTrophy() {
    const P = new Pix(14, 18);
    P.rect(3, 14, 8, 3, PAL.soil[2]);
    P.rect(5, 11, 4, 3, PAL.ember[4]);
    P.ellipse(7, 6, 5, 4, PAL.ember[4]);
    P.ellipse(6, 5, 3, 2, PAL.ember[5]);
    P.ellipse(7, 4, 3, 1.2, PAL.ember[2]);
    return done(P.outline());
  },
  scarecrow() {
    const P = new Pix(26, 36);
    P.vline(12, 6, 34, PAL.soil[1]);
    P.vline(13, 6, 34, PAL.soil[2]);
    P.hline(2, 23, 12, PAL.soil[2]);
    // 旧衣服
    P.rect(7, 11, 12, 12, PAL.cloth[3]);
    P.vline(7, 11, 22, PAL.cloth[4]);
    P.rect(2, 11, 5, 4, PAL.cloth[3]);
    P.rect(19, 11, 5, 4, PAL.cloth[3]);
    P.rect(10, 15, 4, 4, PAL.cloth[1]);
    for (const x of [1, 24]) for (let y = 12; y < 16; y++) P.set(x, y, PAL.straw[3]);
    // 麻袋头和草帽
    P.rect(9, 4, 8, 7, PAL.straw[3]);
    P.set(11, 7, OUTLINE);
    P.set(15, 7, OUTLINE);
    P.hline(11, 15, 9, PAL.soil[1]);
    P.rect(6, 3, 14, 2, PAL.straw[2]);
    P.rect(9, 0, 8, 3, PAL.straw[2]);
    P.hline(9, 16, 2, PAL.cloth[0]);
    return done(P.outline());
  },
};

// ---------- 农场里的固定物件 ----------
const OBJ = {
  well() {
    const P = new Pix(28, 34);
    // 石井圈
    P.ellipse(14, 26, 11, 6, PAL.stone[2]);
    P.ellipse(14, 24, 11, 5, PAL.stone[3]);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      P.set(14 + Math.cos(a) * 10, 24 + Math.sin(a) * 4.5, PAL.stone[4]);
    }
    P.ellipse(14, 24, 7.5, 3, PAL.water[0]);
    P.ellipse(13, 24, 4, 1.4, PAL.water[2]);
    // 木架与小屋顶
    for (const x of [4, 23]) {
      P.rect(x, 8, 2, 18, PAL.soil[1]);
      P.vline(x, 8, 25, PAL.soil[2]);
    }
    P.poly([[0, 9], [14, 1], [28, 9]], RUST[2]);
    for (let x = 2; x < 27; x += 3) P.line(x, 9, 14, 2, RUST[1]);
    P.hline(0, 27, 9, RUST[0]);
    P.hline(5, 23, 13, PAL.soil[2]);
    P.vline(14, 13, 18, PAL.straw[1]);
    P.rect(12, 18, 5, 4, PAL.soil[2]);
    P.hline(12, 16, 18, PAL.stone[3]);
    return done(P.outline());
  },
  sign() {
    // 联盟终端：一根杆子上的小屏幕，旁边钉着留言
    const P = new Pix(22, 32);
    P.vline(10, 12, 30, PAL.stone[2]);
    P.vline(11, 12, 30, PAL.stone[1]);
    metal(P, 3, 2, 16, 12, [PAL.ash[1], PAL.ash[2], PAL.ash[3], PAL.stone[3]]);
    P.rect(5, 4, 12, 7, "#24412f");
    for (let y = 5; y < 10; y += 2) P.hline(6, 6 + Math.floor(hash2(y, 2, 3) * 9), y, "#8fd6a0");
    P.rect(2, 16, 8, 8, PAL.straw[4]);
    P.rect(12, 18, 7, 7, PAL.straw[3]);
    P.hline(3, 8, 18, PAL.stone[3]);
    P.hline(3, 7, 20, PAL.stone[3]);
    P.set(5, 16, PAL.cloth[1]);
    P.set(15, 18, PAL.cloth[1]);
    P.rect(7, 29, 8, 2, PAL.stone[1]);
    return done(P.outline(), { screen: { x: 11, y: 7, w: 12, h: 7 } });
  },
  frontierBoard() {
    // 菜地告示牌：两根木桩、一块板、贴着几张纸、挂着一个小草帽
    const P = new Pix(28, 30);
    for (const x of [4, 22]) {
      P.rect(x, 6, 2, 22, PAL.soil[1]);
      P.vline(x, 6, 27, PAL.soil[2]);
    }
    planks(P, 2, 6, 24, 14, [PAL.soil[1], PAL.soil[2], PAL.soil[3]], false, 12);
    P.hline(1, 26, 5, PAL.soil[3]);
    P.hline(1, 26, 4, OUTLINE);
    for (const [x, y, w, h] of [[4, 8, 7, 8], [13, 9, 6, 6], [20, 8, 4, 9]]) {
      P.rect(x, y, w, h, PAL.straw[4]);
      for (let k = y + 2; k < y + h - 1; k += 2) P.hline(x + 1, x + w - 2, k, PAL.stone[3]);
      P.set(x + Math.floor(w / 2), y, PAL.cloth[1]);
    }
    P.disc(16, 17, 2, PAL.leaf[4]);
    P.set(16, 16, PAL.leaf[5]);
    return done(P.outline());
  },
  waterGate() {
    const P = new Pix(26, 24);
    for (const x of [3, 20]) {
      P.rect(x, 4, 3, 18, PAL.stone[2]);
      P.vline(x, 4, 21, PAL.stone[3]);
    }
    planks(P, 6, 10, 14, 10, [PAL.soil[1], PAL.soil[2], PAL.soil[3]], true, 13);
    P.hline(2, 23, 4, PAL.stone[3]);
    P.rect(2, 2, 22, 2, PAL.stone[2]);
    // 摇轮
    P.disc(13, 4, 3.5, RUST[1]);
    P.disc(13, 4, 2, RUST[3]);
    P.line(10, 4, 16, 4, RUST[0]);
    P.line(13, 1, 13, 7, RUST[0]);
    P.rect(6, 20, 14, 2, PAL.water[2]);
    return done(P.outline());
  },
  ecoBoard() {
    const P = new Pix(18, 26);
    P.vline(8, 10, 24, PAL.soil[1]);
    P.vline(9, 10, 24, PAL.soil[2]);
    P.rect(2, 2, 14, 10, PAL.soil[3]);
    P.hline(2, 15, 2, PAL.straw[2]);
    P.disc(9, 7, 3, PAL.leaf[3]);
    P.line(7, 9, 11, 5, PAL.leaf[1]);
    P.set(8, 5, PAL.leaf[5]);
    for (let i = 0; i < 5; i++) P.set(4 + i * 2, 24, PAL.leaf[4]);
    return done(P.outline());
  },
  districtGate() {
    // 去溪谷试验田的木拱门
    const P = new Pix(44, 40);
    for (const x of [3, 37]) {
      P.rect(x, 8, 4, 30, PAL.soil[1]);
      P.vline(x, 8, 37, PAL.soil[2]);
    }
    P.rect(1, 6, 42, 4, PAL.soil[2]);
    P.hline(1, 42, 6, PAL.soil[3]);
    P.rect(10, 0, 24, 8, PAL.soil[3]);
    P.rect(11, 1, 22, 6, PAL.straw[3]);
    for (let x = 13; x < 31; x += 4) P.vline(x, 3, 5, PAL.leaf[2]);
    // 藤蔓
    for (let y = 10; y < 36; y += 3) {
      P.set(2 + (y % 2), y, PAL.leaf[3]);
      P.set(40 - (y % 2), y + 1, PAL.leaf[4]);
    }
    return done(P.outline());
  },
  allianceSite() {
    // 援建营地空地：木桩、拉线、一面旗
    const P = new Pix(40, 30);
    const posts = [[3, 26], [36, 26], [3, 14], [36, 14]];
    for (const [x, y] of posts) {
      P.rect(x, y - 5, 2, 6, PAL.soil[2]);
      P.set(x, y - 6, PAL.ember[3]);
    }
    P.line(4, 21, 37, 21, PAL.ember[3], 0.8);
    P.line(4, 9, 37, 9, PAL.ember[3], 0.8);
    P.line(4, 9, 4, 21, PAL.ember[3], 0.8);
    P.line(37, 9, 37, 21, PAL.ember[3], 0.8);
    P.vline(20, 0, 22, PAL.stone[2]);
    P.rect(21, 1, 9, 6, PAL.water[3]);
    P.rect(22, 3, 5, 2, PAL.straw[4]);
    for (let i = 0; i < 3; i++) P.rect(8 + i * 8, 22, 6, 4, PAL.soil[3]);
    return done(P.outline());
  },
  outpostShipping() {
    const P = new Pix(26, 22);
    planks(P, 2, 8, 22, 12, [PAL.soil[1], PAL.soil[2], PAL.soil[3]], true, 21);
    P.poly([[1, 8], [25, 8], [23, 3], [3, 3]], PAL.soil[3]);
    P.hline(3, 22, 3, PAL.straw[2]);
    P.hline(1, 24, 8, PAL.soil[0]);
    P.rect(10, 12, 6, 4, PAL.straw[4]);
    P.hline(11, 14, 14, PAL.stone[2]);
    P.vline(23, 0, 8, PAL.stone[2]);
    P.rect(19, 0, 4, 3, PAL.cloth[1]);
    return done(P.outline());
  },
  pond() {
    // 钓鱼点：插着一根鱼竿，放着一只桶
    const P = new Pix(22, 26);
    P.line(4, 24, 18, 2, PAL.soil[2]);
    P.line(18, 2, 20, 12, PAL.stone[4], 0.6);
    P.ellipse(8, 21, 4, 3, PAL.stone[2]);
    P.ellipse(8, 19, 4, 1.4, PAL.stone[3]);
    P.ellipse(8, 19, 2.8, 0.8, PAL.water[1]);
    return done(P.outline());
  },
};

export function buildingArt(type, rotated = false) {
  const key = rotated && (type === "fence" || type === "gate") ? "fenceV" : type;
  if (!BUILD[key]) return null;
  return cached("build:" + key, () => BUILD[key]());
}
export function objectArt(type) {
  if (!OBJ[type]) return null;
  return cached("obj:" + type, () => {
    const r = OBJ[type]();
    return r.canvas ? r : done(r);
  });
}
export const hasBuildingArt = (type) => !!BUILD[type];
export const hasObjectArt = (type) => !!OBJ[type];

// 火苗：三帧
export function flameArt(frame, big = true) {
  return cached(`flame:${frame}:${big}`, () => {
    const P = new Pix(12, 14),
      r = rng(frame * 31 + 7),
      h = big ? 11 : 7;
    for (let y = 0; y < h; y++) {
      const t = y / h,
        half = Math.max(0, Math.round((1 - t) * (big ? 4.5 : 3) + (r() - 0.5) * 1.5));
      for (let x = -half; x <= half; x++) {
        const edge = Math.abs(x) / (half + 0.5);
        const c = edge > 0.7 || t > 0.75 ? PAL.ember[2] : edge > 0.35 || t > 0.5 ? PAL.ember[3] : t > 0.25 ? PAL.ember[4] : PAL.ember[5];
        P.set(6 + x + Math.round(Math.sin(t * 5 + frame) * t * 1.5), 13 - y, c);
      }
    }
    return P.toCanvas();
  });
}
// 搬运的箱子、饭碗（援建队员拿着）
export function carryArt(kind) {
  return cached("carry:" + kind, () => {
    const P = new Pix(14, 10);
    if (kind === "box") {
      P.rect(1, 2, 12, 7, PAL.soil[3]);
      P.hline(1, 12, 2, PAL.straw[2]);
      P.vline(7, 2, 8, PAL.soil[1]);
    } else {
      P.ellipse(7, 6, 5, 2.4, PAL.cloth[5]);
      P.ellipse(7, 5, 4, 1.2, PAL.ember[3]);
    }
    return P.outline().toCanvas();
  });
}
