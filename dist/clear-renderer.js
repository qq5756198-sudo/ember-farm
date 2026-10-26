// v0.41.0「看得清」画面这一层（盖在镜头那一层上面）：
// · 夜里有了月光（pixel-light.js、visual-renderer.js），路看得清了；光外的感染者要是跟着地面一起变亮，夜里就比原来好打——
//   所以它们画得淡一些、透出身后的地面，和身后地面的明暗差回到原来那么大；走进灯光、火光、手电里照常画，正在出手、挨打的照常画。
//   只管光照之前画的那一步（身子、影子、血条）；出手的预兆、夜里发光的眼睛、头上的字都在光照之后画，照旧。
// · 灯芯外一圈光晕；感染者前倾、走路一顿一顿；面前那样东西的四角框，鼠标停在能按的东西上光标变小图；
// · 预兆：地上一块红底斜线纹从边上往里填，最后 0.2 秒边上闪白，大招加“！”；
// · 收、捡、建、打、升级的那一下（引擎那一层 clear.js 记的）；下雪时东西顶上积白；隧道里墙和轨道一道极暗的轮廓；
// · 场景里的字在屏幕上不小于 14 像素。
// 都只是画法：玩法、数值、存档一样没动。“减少闪烁”打开时不闪白、不抖、不一顿一顿。
import { Renderer as LookRenderer } from "./look-renderer.js";
import { RINGS, RINGS_SMALL, MOON_FLOOR, LAMP, FIRE } from "./pixel-light.js";
import { makeCanvas } from "./pixel-kit.js";
import { buildingArt, objectArt } from "./pixel-props.js";
import { gearIcon } from "./gear-sprites.js";
import { BUILDINGS } from "./data.js";

// ---------- 规范里有意思的颜色 ----------
export const C41 = { interact: "#fff1c8", ink: "#140f0b", good: "#8fd07a", danger: "#e04a3a", dangerDeep: "#8e2a20", ember: "#e5823a", emberHi: "#ffb45e", warn: "#e9c05a" };
// 特效多长（秒）
export const FX_T = { flash: 0.06, pop: 0.18, fly: 0.35, arc: 0.35, drop: 0.3, level: 0.8, edge: 0.2 };

// ================= 光外的感染者 =================
// 再淡也不低于这么多（怕哪种天色算出来太淡，看着像没有）；HIDE_GAMMA：亮一点的地方同样的颜色差看着小一点，
// 不用淡那么多（量出来的）；LIGHT_FULL：灯光加了这么多就照常画
// 灯光加了这么多才有亮边（灯心附近才有，远处不画）
export const RIM_MIN = 30;
export const HIDE_MIN = 0.45,
  HIDE_GAMMA = 0.45,
  LIGHT_FULL = 60;
const Y = (c) => 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
export const FLOOR_Y = Y(MOON_FLOOR);

// 这一点吃到多少灯光（0–255，和环境色一样的单位）：灯一圈圈的浓淡和 pixel-light.js 画的一样
export function lightAt(lights, x, y) {
  let sum = 0;
  for (const l of lights || []) {
    const r = Math.max(1, l.r || 0),
      dx = x - l.x,
      dy = (y - l.y) / (l.flat ?? 0.82);
    if (Math.abs(dx) >= r || Math.abs(dy) >= r) continue;
    const q = Math.hypot(dx, dy) / r;
    if (q >= 1) continue;
    let a = 0;
    for (const [k, v] of l.small ? RINGS_SMALL : RINGS) if (q <= k) a += v;
    sum += a * (l.power ?? 1) * Y(l.color || [255, 255, 255]);
  }
  return sum;
}

// 画几成（1 = 照常）：光外按“原来的天色 ÷ 现在的天色”淡下去（月光底滤色叠上去，差还会再小一点）；
// 灯光越足越接近照常。amb 现在的环境色、old 原来的（v0.40），light 这一点的灯光，floor 月光底有多亮
export function hideAlpha(amb, old, light = 0, floor = 0) {
  const now = Y(amb),
    was = Y(old);
  if (!(now > was + 0.5)) return 1;
  const dark = Math.pow((was / now) * (1 - floor / 255), HIDE_GAMMA),
    lit = Math.max(0, Math.min(1, light / LIGHT_FULL));
  return Math.max(HIDE_MIN, Math.min(1, dark + (1 - dark) * lit));
}

// 正在出手、挨打：照常画（预兆要看得清）
export function attacking(z) {
  return !!(z.windup > 0 || z.flash || z.reach > 0 || z.lunge?.phase || z.charge?.phase);
}

// ================= 画布上的两道小机关 =================
// 1. “透明度”加一道乘法：fade = 1 时和原来一样；淡画一个感染者时设成几成，里面怎么设透明度都再乘上它。
//    读出来的是没乘之前的数（留到光照后再写的字照原来的透明度写）。
// 2. 挨打白一下：white > 0 时每画一张小图，紧跟着在同一个地方画一张白剪影（影子不算）。
const whiteCache = new WeakMap();
// 一张小图的剪影染成一种颜色（人物靠灯一侧的亮边用）
const tintCache = new WeakMap();
export function tintOf(img, color) {
  if (!img || !(img.width > 0)) return null;
  let m = tintCache.get(img);
  if (!m) tintCache.set(img, (m = new Map()));
  if (m.has(color)) return m.get(color);
  let t = makeCanvas(img.width, img.height);
  const g = t?.getContext?.("2d");
  if (g) {
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = color;
    g.fillRect(0, 0, img.width, img.height);
  } else t = null;
  m.set(color, t);
  return t;
}
export function whiteOf(img) {
  if (!img || !(img.width > 0)) return null;
  if (whiteCache.has(img)) return whiteCache.get(img);
  let w = makeCanvas(img.width, img.height);
  const g = w?.getContext?.("2d");
  if (g) {
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#ffffff";
    g.fillRect(0, 0, img.width, img.height);
  } else w = null;
  whiteCache.set(img, w);
  return w;
}
const protoOwn = (obj, key) => {
  let proto = Object.getPrototypeOf(obj),
    d = null;
  while (proto && !(d = Object.getOwnPropertyDescriptor(proto, key))) proto = Object.getPrototypeOf(proto);
  return d;
};
export function installCtx(ctx) {
  if (!ctx || ctx.__c41) return !!ctx?.__c41;
  const d = protoOwn(ctx, "globalAlpha"),
    draw = protoOwn(ctx, "drawImage")?.value;
  if (!d?.get || !d?.set || typeof draw !== "function") return false;
  try {
    Object.defineProperty(ctx, "globalAlpha", {
      configurable: true,
      get() {
        return d.get.call(this) / (this.__fade || 1);
      },
      set(v) {
        d.set.call(this, v >= 0 && v <= 1 ? v * (this.__fade || 1) : v);
      },
    });
    // 用原型上那个画图的方法（不经过实例上的这一个，不会自己调自己）
    ctx.drawImage = function (img, ...a) {
      // 靠灯的一侧一道亮边：同一张剪影染成灯的颜色，往灯那边挪 1 个美术像素，垫在下面
      const rim = this.__rim;
      // 只给人物、感染者的身子（小图标、心情脸、血条不画亮边）
      if (rim && !this.__noWhite && img && (a.length >= 8 ? a[3] : img.height) >= 24) {
        const t = tintOf(img, rim.color);
        if (t) {
          const m = this.getTransform();
          this.save();
          this.setTransform(m.a, m.b, m.c, m.d, m.e + rim.dx * Math.abs(m.a), m.f + rim.dy * Math.abs(m.d));
          draw.call(this, t.native || t, ...a);
          this.restore();
        }
      }
      draw.call(this, img, ...a);
      if (this.__white > 0 && !this.__noWhite) {
        const w = whiteOf(img);
        if (w) draw.call(this, w.native || w, ...a);
      }
    };
    ctx.__fade = 1;
    ctx.__white = 0;
    ctx.__rim = null;
    ctx.__c41 = true;
  } catch {
    return false;
  }
  return true;
}

// ================= 灯芯外的一圈光晕 =================
// 有了月光，灯下和暗处差得没原来大；灯芯外加一圈像素光晕（三层台阶，叠加“变亮”），夜里一眼看得出灯在哪。
const haloCache = new Map();
export function haloSprite(r, color) {
  const key = r + ":" + color.join(",");
  if (haloCache.has(key)) return haloCache.get(key);
  const n = r * 2 + 1;
  let cv = makeCanvas(n, n);
  const g = cv?.getContext?.("2d");
  if (g) {
    for (let y = 0; y < n; y++)
      for (let x = 0; x < n; x++) {
        const d = Math.hypot(x - r, y - r) / r;
        if (d > 1) continue;
        g.fillStyle = `rgba(${color[0]},${color[1]},${color[2]},${d < 0.34 ? 0.3 : d < 0.67 ? 0.16 : 0.07})`;
        g.fillRect(x, y, 1, 1);
      }
  } else cv = null;
  haloCache.set(key, cv);
  return cv;
}
// 地图上哪种灯给多大的光晕（半径按像素画的格子算，一格 = 2 个地图单位）
export const HALO = { lamp: [7, LAMP], lantern: [6, LAMP], fire: [9, FIRE], fluoro: [8, null], bulb: [3, null], beacon: [4, null] };

// ================= 预兆的斜线纹 =================
// 16×16 的一块：45 度的斜线，一道 4 像素宽（2 个美术像素），对齐地图，拼起来是连着的斜纹
const stripeCache = new Map();
export function stripeTile(color) {
  if (stripeCache.has(color)) return stripeCache.get(color);
  let cv = makeCanvas(16, 16);
  const g = cv?.getContext?.("2d");
  if (g) {
    g.fillStyle = color;
    for (let y = 0; y < 16; y += 2)
      for (let x = 0; x < 16; x += 2) if ((((x - y) % 16) + 16) % 16 < 4) g.fillRect(x, y, 2, 2);
  } else cv = null;
  stripeCache.set(color, cv);
  return cv;
}

// ================= 下雪：东西顶上积一层白 =================
// 每一列最上面那个不透明的像素描白，一半的列再往下多一格
const capCache = new WeakMap();
export function snowCap(img) {
  if (!img || !(img.width > 0)) return null;
  if (capCache.has(img)) return capCache.get(img);
  let cap = null;
  try {
    const W = img.width,
      H = img.height,
      src = makeCanvas(W, H),
      g = src?.getContext?.("2d");
    if (g) {
      g.drawImage(img, 0, 0);
      const px = g.getImageData(0, 0, W, H).data;
      cap = makeCanvas(W, H);
      const o = cap.getContext("2d");
      for (let x = 0; x < W; x++)
        for (let y = 0; y < H; y++) {
          if (px[(y * W + x) * 4 + 3] < 128) continue;
          o.fillStyle = "#f4f7f8";
          o.fillRect(x, y, 1, 1);
          if ((x * 7 + 3) % 5 < 3 && y + 1 < H && px[((y + 1) * W + x) * 4 + 3] >= 128) {
            o.fillStyle = "#dfe8ee";
            o.fillRect(x, y + 1, 1, 1);
          }
          break;
        }
    }
  } catch {
    cap = null;
  }
  capCache.set(img, cap);
  return cap;
}

// ================= 物品小图（飞到身上的那一样） =================
const itemCache = new Map();
export function itemCanvas(id) {
  if (!id) return null;
  if (itemCache.has(id)) return itemCache.get(id);
  let cv = null;
  try {
    const P = gearIcon(id);
    cv = P?.toCanvas ? P.toCanvas() : P?.width ? P : null;
  } catch {
    cv = null;
  }
  itemCache.set(id, cv);
  return cv;
}

// ================= 光标小图：手（捡、开、做）、扳手（修）、气泡（说话）、门（进出） =================
// '#' 深色描边、'o' 能按的浅米色；16×16，放大一倍
const CURSOR_ART = {
  hand: { hot: [5, 0], rows: [".....##.........", "....#oo#........", "....#oo#........", "....#oo#........", "....#oo###......", "....#oo#oo##....", "....#oo#oo#o#...", ".##.#oooooooo#..", "#oo##oooooooo#..", "#ooo#oooooooo#..", ".#oooooooooooo#.", "..#ooooooooooo#.", "...#oooooooooo#.", "....#oooooooo#..", ".....#oooooo#...", "......######...."] },
  wrench: { hot: [13, 1], rows: ["...........#.##.", "..........#o#oo#", "..........#oooo#", ".........#oooo#.", "........#ooo##..", ".......#ooo#....", "......#ooo#.....", ".....#ooo#......", "....#ooo#.......", "...#ooo#........", "..#ooo#.........", ".#ooo#..........", "#ooo#...........", "#oo#............", ".##.............", "................"] },
  talk: { hot: [1, 1], rows: ["................", "..##########....", ".#oooooooooo#...", "#oooooooooooo#..", "#oo#oo#oo#ooo#..", "#oo#oo#oo#ooo#..", "#oooooooooooo#..", ".#oooooooooo#...", "..###oo######...", "....#oo#........", "....#o#.........", "....##..........", "................", "................", "................", "................"] },
  door: { hot: [2, 0], rows: ["..##########....", "..#oooooooo#....", "..#o######o#....", "..#o#....#o#....", "..#o#....#o#....", "..#o#....#o#....", "..#o#..##.o#....", "..#o#..##.o#....", "..#o#....#o#....", "..#o#....#o#....", "..#o#....#o#....", "..#o######o#....", "..#oooooooo#....", "..##########....", "................", "................"] },
};
const cursorCache = new Map();
export function cursorCss(kind) {
  if (!kind) return "";
  if (cursorCache.has(kind)) return cursorCache.get(kind);
  const art = CURSOR_ART[kind];
  let css = "pointer";
  try {
    const cv = art ? makeCanvas(32, 32) : null,
      g = cv?.getContext?.("2d");
    if (g && cv.toDataURL) {
      art.rows.forEach((row, y) =>
        [...row].forEach((ch, x) => {
          if (ch === ".") return;
          g.fillStyle = ch === "#" ? C41.ink : C41.interact;
          g.fillRect(x * 2, y * 2, 2, 2);
        }),
      );
      css = `url(${cv.toDataURL("image/png")}) ${art.hot[0] * 2 + 1} ${art.hot[1] * 2 + 1}, pointer`;
    }
  } catch {
    css = "pointer";
  }
  cursorCache.set(kind, css);
  return css;
}
// “名字 · 做什么”里的那个动作 → 哪种光标
export function cursorKind(label) {
  const verb = String(label || "").split("·").pop();
  if (!verb.trim()) return "";
  if (/修/.test(verb)) return "wrench";
  if (/说话|买卖|聊|问|派活|送|交|摸摸/.test(verb)) return "talk";
  if (/出门|进去|回去|下去|上去|回家|进|离开|去/.test(verb)) return "door";
  return "hand";
}

// 十凶预兆的外形（和 titan-renderer.js 的 tShapePath 一样），加进一条 Path2D，k 是从中心缩放几成
export function shapeInto(P, sh, k = 1) {
  const TAU = Math.PI * 2;
  switch (sh.k) {
    case "circle": {
      const r = Math.max(0.5, sh.r * k);
      P.moveTo(sh.x + r, sh.y);
      P.arc(sh.x, sh.y, r, 0, TAU);
      break;
    }
    case "cone":
      P.moveTo(sh.x, sh.y);
      P.arc(sh.x, sh.y, Math.max(0.5, sh.r * k), sh.a - sh.arc, sh.a + sh.arc);
      P.closePath();
      break;
    case "line": {
      const ux = Math.cos(sh.a),
        uy = Math.sin(sh.a),
        hw = sh.w / 2,
        L = Math.max(0.5, sh.len * k);
      P.moveTo(sh.x - uy * hw, sh.y + ux * hw);
      P.lineTo(sh.x + ux * L - uy * hw, sh.y + uy * L + ux * hw);
      P.lineTo(sh.x + ux * L + uy * hw, sh.y + uy * L - ux * hw);
      P.lineTo(sh.x + uy * hw, sh.y - ux * hw);
      P.closePath();
      break;
    }
    case "rect": {
      const w = sh.w * k,
        h = sh.h * k;
      P.rect(sh.x + (sh.w - w) / 2, sh.y + (sh.h - h) / 2, Math.max(0.5, w), Math.max(0.5, h));
      break;
    }
  }
  return P;
}

const NO_TELL = new Set(["screamer", "raider", "brute", "nurse", "spitter"]);
const BODY_FONT = '"PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", "Source Han Sans SC", system-ui, sans-serif';
const lightness = (color) => {
  const m = /^#([0-9a-f]{6})/i.exec(color || "");
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
};
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (u) => 1 - (1 - u) * (1 - u);

export class Renderer extends LookRenderer {
  constructor(...args) {
    super(...args);
    this._cFx = [];
    this._cFlash = new Map();
    this._cDrop = new Map();
    this._cWind = new WeakMap();
    this._cCursor = "";
    this._cHoverAt = -1;
  }
  // ---------- 每一帧 ----------
  draw(engine, mouse, dt) {
    this._cE = engine;
    if (engine?.takeVfx) this.cTake(engine.takeVfx());
    const out = super.draw(engine, mouse, dt);
    this.cCursorUpdate(engine, mouse);
    return out;
  }
  // 引擎那一层记的“这一下”：变成画面上的动作
  cTake(list) {
    if (!list?.length) return;
    const t = this.time || 0,
      calm = !!this.calm,
      fx = this.v ? this.fx : null,
      R = () => (fx ? fx.rand() : Math.random());
    for (const v of list) {
      if (v.kind === "hit") {
        if (!calm && v.id != null) this._cFlash.set(v.id, t + FX_T.flash);
        // 3–6 粒碎片：血肉是暗红，铁甲是火星
        const n = (v.heavy || v.kill ? 6 : 3) - (calm ? 2 : 0);
        if (fx)
          for (let i = 0; i < n; i++)
            fx.add({ x: v.x + (R() - 0.5) * 10, y: v.y - 30 + (R() - 0.5) * 12, vx: (R() - 0.5) * 160, vy: -60 - R() * 110, grav: 520, t: 0, life: 0.3 + R() * 0.2, color: v.metal ? (i % 2 ? "#fff1c8" : "#e8c27a") : i % 2 ? "#8a2d22" : "#5a1d18", layer: v.metal ? "glow" : "world", fade: true, size: 1, kind: "chip" });
      } else if (v.kind === "harvest" || v.kind === "pickup") {
        this._cFx.push({ ...v, t0: t });
        if (fx && v.kind === "harvest")
          for (let i = 0; i < (calm ? 2 : 5); i++) fx.add({ x: v.x + (R() - 0.5) * 24, y: v.y - 4, vx: (R() - 0.5) * 70, vy: -50 - R() * 50, grav: 300, t: 0, life: 0.35 + R() * 0.2, color: i % 2 ? "#8fd07a" : "#5f9e4c", layer: "world", size: 1, kind: "leaf" });
      } else if (v.kind === "build") {
        this._cDrop.set(v.id, { t0: t, x: v.x, y: v.y, type: v.type, landed: false });
      } else if (v.kind === "level") {
        this._cFx.push({ kind: "level", t0: t });
        if (fx) {
          const p = this._cE?.s?.player;
          if (p)
            for (let i = 0; i < (calm ? 6 : 16); i++) {
              const a = (i / 16) * Math.PI * 2;
              fx.add({ x: p.x + Math.cos(a) * 18, y: p.y - 10 + Math.sin(a) * 6, vx: Math.cos(a) * 18, vy: -50 - R() * 60, t: 0, life: 0.6 + R() * 0.4, color: i % 3 ? "#ffb45e" : "#e5823a", layer: "glow", size: 1, kind: "ember" });
            }
        }
      }
    }
    if (this._cFx.length > 40) this._cFx.splice(0, this._cFx.length - 40);
  }

  // ================= 人物靠灯的一侧一道亮边（夜里，篝火、路灯旁） =================
  // 找这一点最亮的那盏暖色灯（灯光够亮才有）：亮边往灯那边挪 1 个美术像素
  cRim(x, y) {
    const L = this.lit;
    if (!this.v || this.calm || this.indoor || !L || (L.moon || 0) < 0.3) return null;
    let best = null,
      bv = RIM_MIN;
    for (const l of L.lights || []) {
      const col = l.color || LAMP;
      if (col[0] < col[2] + 60) continue; // 只要暖色的灯和火
      const v = lightAt([l], x, y - 24);
      if (v > bv) {
        bv = v;
        best = l;
      }
    }
    if (!best) return null;
    const dx = best.x - x,
      dy = best.y - (y - 24),
      d = Math.hypot(dx, dy);
    if (d < 6) return null;
    const fire = (best.color || LAMP)[1] < 190;
    return { dx: Math.round(dx / d) * 2, dy: Math.round(dy / d) * 2, color: fire ? "#ffa858" : "#ffd68c" };
  }
  cWithRim(x, y, fn) {
    const rim = this.cRim(x, y);
    if (!rim || !installCtx(this.ctx)) return fn();
    const c = this.ctx,
      was = c.__rim;
    c.__rim = rim;
    try {
      return fn();
    } finally {
      c.__rim = was;
    }
  }
  drawPlayer(e) {
    const p = e?.s?.player;
    return p ? this.cWithRim(p.x, p.y, () => super.drawPlayer(e)) : super.drawPlayer(e);
  }
  drawVillager(o, x, y, alpha = 1, index = 56) {
    return this.cWithRim(x, y, () => super.drawVillager(o, x, y, alpha, index));
  }
  person(sheet, x, y, facing, moving, alpha) {
    return this.cWithRim(x, y, () => super.person(sheet, x, y, facing, moving, alpha));
  }
  drawHelper(o, e) {
    return this.cWithRim(o.x, o.y, () => super.drawHelper(o, e));
  }

  // ================= 感染者 =================
  // 这个感染者画几成
  foeAlpha(z) {
    const L = this.lit;
    if (!this.v || this.indoor || !L?.lifted || attacking(z)) return 1;
    return hideAlpha(L.amb, L.old, lightAt(L.lights, z.x, z.y - 24), (L.moon || 0) * FLOOR_Y);
  }
  drawEnemy(z, e) {
    if (this.v && this.cTellable(z)) {
      const vm = this.vMap;
      this.vMap = false;
      try {
        this.cTellFill(z);
      } finally {
        this.vMap = vm;
      }
    }
    const k = this.foeAlpha(z),
      until = this._cFlash.get(z.id),
      white = until != null && (this.time || 0) < until && !this.calm && this.v;
    if (until != null && !white) this._cFlash.delete(z.id);
    const rim = this.cRim(z.x, z.y);
    if ((k >= 0.995 && !white && !rim) || !installCtx(this.ctx)) return super.drawEnemy(z, e);
    const c = this.ctx,
      a = c.globalAlpha,
      wasRim = c.__rim;
    c.save();
    c.__fade = k;
    c.globalAlpha = a;
    c.__white = white ? 1 : 0;
    c.__rim = rim;
    try {
      return super.drawEnemy(z, e);
    } finally {
      c.restore();
      c.__fade = 1;
      c.__white = 0;
      c.__rim = wasRim;
    }
  }
  // 影子不跟着白
  pxShadow(x, y, w) {
    const c = this.ctx,
      was = c.__noWhite;
    c.__noWhite = true;
    try {
      return super.pxShadow(x, y, w);
    } finally {
      c.__noWhite = was;
    }
  }
  // 感染者的剪影：侧面前倾（奔跑者更多），走路一顿一顿，隔一会儿抽一下
  drawZombie(z, x, y, alpha = 1) {
    const e = this._cE;
    if (!this.v || this.calm || z.crawl || z.lying || z.titan || z.stunT > 0 || z.stagger > 0 || attacking(z) || (e?.reactOf && e.reactOf(z))) return super.drawZombie(z, x, y, alpha);
    const f = z.facing ?? Math.PI / 2,
      side = Math.abs(Math.cos(f)) > 0.7071,
      lean = side ? (z.type === "runner" || z.type === "stalker" ? 0.27 : z.type === "elite" || z.type === "brute" ? 0.14 : 0.2) * (Math.cos(f) >= 0 ? 1 : -1) : 0,
      T = this.time || 0,
      off = ((z.id || 0) % 97) * 0.37,
      P = 0.6,
      u = (T + off) / P,
      fr = u - Math.floor(u),
      jerk = (Math.floor(u) + (fr < 0.5 ? fr * 0.4 : 0.2 + (fr - 0.5) * 1.6)) * P - off,
      tw = ((z.id || 0) * 13 + Math.floor((T + off) / 1.7)) % 5 === 0 && (T + off) % 1.7 < 0.08 ? (((z.id || 0) % 2) * 2 - 1) * 2 : 0,
      c = this.ctx;
    c.save();
    c.translate(x + tw, y);
    if (lean) c.transform(1, 0, -lean, 1, 0, 0);
    c.translate(-x, -y);
    this.time = jerk;
    try {
      return super.drawZombie(z, x, y, alpha);
    } finally {
      this.time = T;
      c.restore();
    }
  }

  // ================= 设施落下来 =================
  drawBuilding(b, e) {
    const d = this.v ? this._cDrop.get(b.id) : null;
    if (!d) return this.cSnowy(() => super.drawBuilding(b, e));
    const u = ((this.time || 0) - d.t0) / FX_T.drop;
    if (u >= 1) return this.cSnowy(() => super.drawBuilding(b, e));
    const lift = Math.round((16 * (1 - u * u)) / 2) * 2,
      c = this.ctx;
    c.save();
    c.translate(0, -lift);
    try {
      return this.cSnowy(() => super.drawBuilding(b, e));
    } finally {
      c.restore();
    }
  }
  drawObject(o, e) {
    return this.cSnowy(() => super.drawObject(o, e));
  }
  // 下雪天画设施、物件时，每张小图顶上积一层白
  cSnowy(fn) {
    const snow = this.v && !this.indoor && (this.vWeather === "小雪" || this.vWeather === "大雪");
    if (!snow) return fn();
    const was = this._cCap;
    this._cCap = true;
    try {
      return fn();
    } finally {
      this._cCap = was;
    }
  }
  px(canvas, x, y, opts = {}) {
    const out = super.px(canvas, x, y, opts);
    if (this._cCap && canvas && !this._mute) {
      const cap = snowCap(canvas);
      if (cap) {
        const { flip = false, alpha = 1, foot = 0, dx = 0 } = opts || {},
          c = this.ctx,
          w = canvas.width * 2,
          h = canvas.height * 2,
          X = Math.round((x - w / 2) / 2) * 2 + dx * 2,
          Y = Math.round((y - h + foot * 2) / 2) * 2;
        c.save();
        c.imageSmoothingEnabled = false;
        if (alpha < 1) c.globalAlpha = alpha;
        if (flip) {
          c.translate(X + w, Y);
          c.scale(-1, 1);
          c.drawImage(cap, 0, 0, w, h);
        } else c.drawImage(cap, X, Y, w, h);
        c.restore();
      }
    }
    return out;
  }

  // ================= 光照之后 =================
  // 发光的那一层之后：灯芯外的光晕（夜里才有）
  drawEmissive(e, night, view) {
    super.drawEmissive(e, night, view);
    if (!this.v || night <= 0.3 || !this.art) return;
    const k = Math.min(1, (night - 0.3) / 0.3),
      c = this.ctx,
      t = this.time || 0,
      vis = (x, y) => x > view.x - 40 && x < view.x + view.w + 40 && y > view.y - 40 && y < view.y + view.h + 40,
      put = (x, y, r, color, a = 1) => {
        const cv = haloSprite(r, color);
        if (!cv) return;
        c.globalAlpha = a * k;
        c.drawImage(cv, Math.round(x / 2) * 2 - r * 2, Math.round(y / 2) * 2 - r * 2, cv.width * 2, cv.height * 2);
      };
    c.save();
    c.imageSmoothingEnabled = false;
    c.globalCompositeOperation = "lighter";
    for (const l of this.art.lights || []) {
      const h = HALO[l.kind],
        x = l.x * 2,
        y = l.y * 2;
      if (!h || !vis(x, y)) continue;
      if (l.kind === "beacon" && !this.calm && Math.sin(t * 3 + x) < 0) continue;
      const flick = l.kind === "fire" && !this.calm ? 0.85 + 0.15 * Math.sin(t * 9 + x) : 1;
      put(x, y, h[0], h[1] || l.color || LAMP, flick);
    }
    for (const m of this.late || []) {
      if (m.kind === "objLamp") {
        const X = Math.round((m.x - m.art.w) / 2) * 2 + m.art.lamp.x * 2,
          Y = Math.round((m.y - m.art.h * 2) / 2) * 2 + m.art.lamp.y * 2;
        if (vis(X, Y)) put(X + 1, Y + 1, 6, LAMP);
      } else if (m.kind === "build") {
        const { b, art: bart } = m,
          top = b.y + 4 - bart.h * 2,
          left = b.x - bart.w;
        if (bart.lamp && (b.type !== "lamp" || (e.c?.energy || 0) > 0) && (b.type !== "tower" || (this.towerLit?.(b, e) ?? true))) put(left + bart.lamp.x * 2 + 1, top + bart.lamp.y * 2, 7, LAMP);
        if (bart.fire) put(left + bart.fire.x * 2, top + bart.fire.y * 2 - 6, 9, FIRE, this.calm ? 1 : 0.85 + 0.15 * Math.sin(t * 9 + b.x));
      }
    }
    c.restore();
  }
  // 光照、预兆都画完以后：隧道的轮廓、预兆的斜纹、四角框、收捡建升级的动作
  drawNight(e) {
    super.drawNight(e);
    if (!this.v || !e) return;
    const vm = this.vMap;
    // 这一层的颜色都是规范里有意思的颜色，不换成调色板里最近的
    this.vMap = false;
    try {
      this.cTunnel(e);
      this.cTelegraphs(e);
      this.cBrackets(e);
      this.cEffects(e);
    } finally {
      this.vMap = vm;
    }
  }
  // 隧道：能走的地方和岩壁交界处、两条钢轨，一道极暗的轮廓（知道路往哪走；感染者照旧看不见）
  cTunnel(e) {
    if (!e.inTunnel?.() || !this.mood?.tunnel) return;
    let L = null;
    try {
      L = e.tunnelLayoutNow?.();
    } catch {
      L = null;
    }
    if (!L?.grid || typeof Path2D !== "function") return;
    if (this._cTunKey !== L.key) {
      const T = 64,
        COLS = 24,
        ROWS = 16,
        at = (cc, rr) => (cc < 0 || rr < 0 || cc >= COLS || rr >= ROWS ? 0 : L.grid[rr * COLS + cc]),
        path = new Path2D();
      for (let r = 0; r < ROWS; r++)
        for (let cc = 0; cc < COLS; cc++) {
          if (!at(cc, r)) continue;
          const x = cc * T,
            y = r * T;
          if (!at(cc, r - 1)) (path.moveTo(x, y + 1), path.lineTo(x + T, y + 1));
          if (!at(cc, r + 1)) (path.moveTo(x, y + T - 1), path.lineTo(x + T, y + T - 1));
          if (!at(cc - 1, r)) (path.moveTo(x + 1, y), path.lineTo(x + 1, y + T));
          if (!at(cc + 1, r)) (path.moveTo(x + T - 1, y), path.lineTo(x + T - 1, y + T));
        }
      // 钢轨（tunnel-art.js 里画在轨道那两行的第 20、43 个美术像素）
      let c0 = -1,
        c1 = -1;
      for (let cc = 0; cc < COLS; cc++)
        if (at(cc, 7) === 2) {
          if (c0 < 0) c0 = cc;
          c1 = cc;
        }
      if (c0 >= 0)
        for (const yy of [20.5, 43.5]) {
          path.moveTo(c0 * T, (7 * 32 + yy) * 2);
          path.lineTo((c1 + 1) * T, (7 * 32 + yy) * 2);
        }
      this._cTunKey = L.key;
      this._cTunPath = path;
    }
    const c = this.ctx;
    c.save();
    c.globalAlpha = 0.26;
    c.strokeStyle = "#9fb3c8";
    c.lineWidth = 2;
    c.stroke(this._cTunPath);
    c.restore();
  }
  // 普通感染者出手前：脚下一块红底斜线纹，从边上往里填，填满就打（画在它身子下面，和地上的东西一起受光照）；
  // 光照之后再描一道边，最后 0.2 秒闪白；守卫这种大招加“！”
  cTellable(z) {
    return !!(z && !z.dead && !z.titan && !NO_TELL.has(z.type) && z.windup > 0);
  }
  cTellState(z) {
    let w = this._cWind.get(z);
    if (!w || z.windup > w.last + 0.001) w = { max: z.windup };
    w.last = z.windup;
    this._cWind.set(z, w);
    const big = z.type === "elite";
    return { R: big ? 85 : 52, big, k: clamp(1 - z.windup / Math.max(0.05, w.max), 0, 1), last: z.windup < FX_T.edge };
  }
  cTellFill(z) {
    const { R, k } = this.cTellState(z),
      c = this.ctx;
    c.save();
    c.globalAlpha = 0.18;
    c.fillStyle = C41.danger;
    c.beginPath();
    c.arc(z.x, z.y, R, 0, Math.PI * 2);
    c.fill();
    if (k > 0) {
      const tile = stripeTile(C41.danger),
        pat = tile && c.createPattern ? c.createPattern(tile.native || tile, "repeat") : null;
      if (pat) {
        c.globalAlpha = 0.85;
        c.fillStyle = pat;
        c.beginPath();
        c.arc(z.x, z.y, R, 0, Math.PI * 2);
        c.arc(z.x, z.y, Math.max(0, R * (1 - k)), 0, Math.PI * 2, true);
        c.fill("evenodd");
      }
    }
    c.restore();
  }
  cTelegraphs(e) {
    const c = this.ctx,
      t = this.time || 0,
      calm = !!this.calm,
      sc = this.camera.scale,
      vx = this.camera.x - 120,
      vy = this.camera.y - 120,
      vw = this.w / sc + 240,
      vh = this.h / sc + 240;
    for (const z of e.enemies || []) {
      if (!this.cTellable(z)) {
        this._cWind.delete(z);
        continue;
      }
      if (z.x < vx || z.x > vx + vw || z.y < vy || z.y > vy + vh) continue;
      const { R, big, last } = this.cTellState(z);
      c.save();
      c.globalAlpha = 0.85;
      c.lineWidth = last ? 6 : 4;
      c.strokeStyle = C41.ink;
      c.beginPath();
      c.arc(z.x, z.y, R, 0, Math.PI * 2);
      c.stroke();
      c.globalAlpha = 1;
      c.lineWidth = last ? 3 : 2;
      c.strokeStyle = last && (calm || Math.floor(t * 30) % 2 === 0) ? "#ffffff" : C41.danger;
      c.stroke();
      c.restore();
      if (big) this._pixelText("！", z.x, z.y - 128, last ? "#ffffff" : C41.danger, 24);
    }
  }
  // 面前那样东西（按交互就是它）：四角框
  cBrackets(e) {
    const o = this._sl?.target;
    if (!o || e.paused || e.buildMode) return;
    const box = this.cBox(o, e);
    if (!box) return;
    const c = this.ctx,
      t = this.time || 0,
      pad = this.calm ? 2 : 2 + (Math.floor(t * 2.5) % 2) * 2,
      x0 = Math.round((box.x0 - pad) / 2) * 2,
      y0 = Math.round((box.y0 - pad) / 2) * 2,
      x1 = Math.round((box.x1 + pad) / 2) * 2,
      y1 = Math.round((box.y1 + pad) / 2) * 2,
      L = Math.max(6, Math.min(12, Math.round(Math.min(x1 - x0, y1 - y0) / 6 / 2) * 2));
    // 一个角：从 (x, y) 往 sx、sy 的方向各伸出一条，粗 2；先描一圈深色（每边多 1 像素）
    const arms = (x, y, sx, sy) => [
      [sx > 0 ? x : x - L, sy > 0 ? y : y - 2, L, 2],
      [sx > 0 ? x : x - 2, sy > 0 ? y : y - L, 2, L],
    ];
    const rects = [...arms(x0, y0, 1, 1), ...arms(x1, y0, -1, 1), ...arms(x0, y1, 1, -1), ...arms(x1, y1, -1, -1)];
    c.save();
    c.globalAlpha = 1;
    c.fillStyle = C41.ink;
    for (const [x, y, w, h] of rects) c.fillRect(x - 1, y - 1, w + 2, h + 2);
    c.fillStyle = C41.interact;
    for (const [x, y, w, h] of rects) c.fillRect(x, y, w, h);
    c.restore();
  }
  // 一样东西在画面上占的框（地图坐标）
  cBox(o, e) {
    try {
      if (o.type === "building" && o.building) {
        const b = o.building,
          art = buildingArt(b.type, b.rotation % 2 === 1, !!b.open);
        if (art?.canvas) {
          const w = art.canvas.width * 2,
            h = art.canvas.height * 2;
          return { x0: b.x - w / 2, y0: b.y + 4 - h, x1: b.x + w / 2, y1: b.y + 4 };
        }
        const d = BUILDINGS[b.type];
        return { x0: b.x - (d?.w || 48) / 2, y0: b.y - (d?.h || 48) - 20, x1: b.x + (d?.w || 48) / 2, y1: b.y + 6 };
      }
      if (o.type === "plot") {
        const p = o.plot || o;
        return { x0: p.x - 20, y0: p.y - 20, x1: p.x + 20, y1: p.y + 20 };
      }
      if (o.type === "drop") return { x0: o.x - 14, y0: o.y - 26, x1: o.x + 14, y1: o.y + 2 };
      const label = e?.simpleLabel ? e.simpleLabel(o) : "";
      if (/说话|买卖|派活|摸摸/.test(label) || o.resident || o.type === "resident" || o.type === "trader") return { x0: o.x - 20, y0: o.y - 66, x1: o.x + 20, y1: o.y + 4 };
      const art = objectArt(o.type);
      if (art?.canvas) {
        const w = art.canvas.width * 2,
          h = art.canvas.height * 2;
        return { x0: o.x - w / 2, y0: o.y + 4 - h, x1: o.x + w / 2, y1: o.y + 4 };
      }
      if (Number.isFinite(o.x) && Number.isFinite(o.y)) return { x0: o.x - 22, y0: o.y - 50, x1: o.x + 22, y1: o.y + 4 };
    } catch {
      /* 算不出来就不画框 */
    }
    return null;
  }
  // 收菜、捡到、升级
  cEffects(e) {
    const c = this.ctx,
      t = this.time || 0,
      p = e.s?.player;
    if (!p) return;
    // 设施落地：一圈灰；大件轻轻一震
    for (const [id, d] of this._cDrop) {
      if (t - d.t0 < FX_T.drop) continue;
      if (!d.landed) {
        d.landed = true;
        const fx = this.fx;
        if (fx)
          for (let i = 0; i < (this.calm ? 6 : 14); i++) {
            const a = (i / 14) * Math.PI * 2;
            fx.add({ x: d.x + Math.cos(a) * 20, y: d.y + 2 + Math.sin(a) * 8, vx: Math.cos(a) * 70, vy: Math.sin(a) * 24 - 10, drag: 3, t: 0, life: 0.5 + fx.rand() * 0.2, color: "#b49a74", alpha: 0.7, layer: "world", size: 2, grow: 0.6, kind: "dust" });
          }
        const bd = BUILDINGS[d.type];
        if (bd && ((bd.w || 0) >= 80 || (bd.h || 0) >= 80) && !this.calm && this._cE) this._cE.shake = Math.max(this._cE.shake || 0, 2);
      }
      if (t - d.t0 > 2) this._cDrop.delete(id);
    }
    const keep = [];
    for (const f of this._cFx) {
      const u = t - f.t0;
      if (f.kind === "harvest") {
        // 往上弹一下、压扁又弹回（0.18 秒），然后飞到身上（0.35 秒）
        const cv = itemCanvas(f.item);
        if (u < FX_T.pop + FX_T.fly) keep.push(f);
        if (!cv) continue;
        if (u < FX_T.pop) {
          const k = u / FX_T.pop,
            hop = Math.sin(Math.PI * k) * 14,
            sy = k < 0.5 ? 1 - 0.3 * Math.sin(Math.PI * k * 2) : 1 + 0.15 * Math.sin(Math.PI * (k - 0.5) * 2);
          this.cIcon(cv, f.x, f.y - 10 - hop, 1 / Math.max(0.7, sy), sy, 1);
        } else if (u < FX_T.pop + FX_T.fly) {
          const k = ease((u - FX_T.pop) / FX_T.fly),
            x0 = f.x,
            y0 = f.y - 10,
            x1 = p.x,
            y1 = p.y - 40,
            x = x0 + (x1 - x0) * k,
            y = y0 + (y1 - y0) * k - Math.sin(Math.PI * k) * 40;
          this.cIcon(cv, x, y, 1 - 0.4 * k, 1 - 0.4 * k, 1);
        }
      } else if (f.kind === "pickup") {
        // 弧线飞到身上（0.35 秒）
        if (u < FX_T.arc) keep.push(f);
        else continue;
        const k = ease(u / FX_T.arc),
          x0 = f.x,
          y0 = f.y - 16,
          x1 = p.x,
          y1 = p.y - 40,
          x = x0 + (x1 - x0) * k,
          y = y0 + (y1 - y0) * k - Math.sin(Math.PI * k) * 46;
        (f.items || []).forEach(([id], i) => {
          const cv = itemCanvas(id);
          if (cv) this.cIcon(cv, x + i * 10 - ((f.items.length - 1) * 10) / 2, y + i * 4, 1 - 0.35 * k, 1 - 0.35 * k, 1);
        });
      } else if (f.kind === "level") {
        // 一圈金光往外扩（0.8 秒）
        if (u < FX_T.level) keep.push(f);
        else continue;
        const k = u / FX_T.level,
          r = 12 + 60 * ease(k);
        c.save();
        c.globalAlpha = (1 - k) * 0.9;
        c.strokeStyle = C41.ink;
        c.lineWidth = 6;
        c.beginPath();
        c.ellipse(p.x, p.y - 8, r, r * 0.45, 0, 0, Math.PI * 2);
        c.stroke();
        c.strokeStyle = C41.emberHi;
        c.lineWidth = 3;
        c.stroke();
        c.restore();
      }
    }
    this._cFx = keep;
  }
  // 画一张物品小图（中心在 x, y；按美术像素放大一倍）
  cIcon(cv, x, y, sx = 1, sy = 1, alpha = 1) {
    const c = this.ctx,
      w = cv.width * 2 * sx,
      h = cv.height * 2 * sy;
    c.save();
    c.imageSmoothingEnabled = false;
    c.globalAlpha = alpha;
    c.drawImage(cv, Math.round(x - w / 2), Math.round(y - h / 2), Math.round(w), Math.round(h));
    c.restore();
  }

  // ================= 十凶的预兆：加斜纹（从边上往里填） =================
  tStrike(S) {
    super.tStrike(S);
    const sh = S?.shape;
    if (!this.v || !sh || !this.tShapePath || sh.k === "ring") return;
    const c = this.ctx,
      k = clamp(1 - S.t / Math.max(0.01, S.max), 0, 1);
    if (k <= 0) return;
    const tile = stripeTile(S.col === "blue" ? "#bfe3ff" : S.col === "yellow" ? C41.warn : S.col === "green" ? "#9fe08a" : S.col === "orange" ? C41.emberHi : C41.danger),
      pat = tile && c.createPattern ? c.createPattern(tile.native || tile, "repeat") : null;
    if (!pat) return;
    if (typeof Path2D !== "function") return;
    const P = new Path2D();
    // 冲过来的路：沿着路往前填；别的：从边上往里填（外形减去缩小的外形）
    if (sh.k === "line") shapeInto(P, sh, k);
    else {
      shapeInto(P, sh, 1);
      if (k < 1) shapeInto(P, sh, 1 - k);
    }
    const vm = this.vMap;
    this.vMap = false;
    c.save();
    c.globalAlpha = 0.55;
    c.fillStyle = pat;
    c.fill(P, "evenodd");
    c.restore();
    this.vMap = vm;
  }

  // ================= 场景里的字：屏幕上不小于 14 像素 =================
  // 像素体只有 12、24 两档（只有整倍数才清楚）；12 像素的字按这一刻的缩放算出来在屏幕上不到 14 像素时，
  // 改用黑体、在屏幕上正好 14 像素，描一圈深色边（地图上的字和贴在屏幕上的字都按这一刻的变换算）
  cTextScale() {
    const c = this.ctx;
    try {
      const m = c.getTransform();
      return Math.max(0.01, Math.hypot(m.a, m.b) / (this.dpr || 1));
    } catch {
      return this.camera?.scale || 1;
    }
  }
  _pixelText(label, x, y, color = "#e6e5c7", size = 12, center = true) {
    if (this._deferText || size > 15) return super._pixelText(label, x, y, color, size, center);
    const k = this.cTextScale();
    if (12 * k >= 13.99) return super._pixelText(label, x, y, color, size, center);
    const c = this.ctx;
    c.font = `600 ${14 / k}px ${BODY_FONT}`;
    c.textAlign = center ? "center" : "left";
    c.textBaseline = "middle";
    c.shadowBlur = 0;
    const X = Math.round(x),
      Y = Math.round(y);
    if (lightness(color) > 0.42) {
      c.lineJoin = "round";
      c.lineWidth = 3 / k;
      c.strokeStyle = "#140f0b";
      c.strokeText(label, X, Y);
    }
    c.fillStyle = color;
    c.fillText(label, X, Y);
  }
  _pixelBadge(label, x, y, color = "#d8cb92") {
    if (this._deferText) return super._pixelBadge(label, x, y, color);
    const k = this.cTextScale();
    if (12 * k >= 13.99) return super._pixelBadge(label, x, y, color);
    const c = this.ctx;
    c.font = `600 ${14 / k}px ${BODY_FONT}`;
    const w = Math.round(c.measureText(label).width + 16 / k),
      h = Math.round(24 / k),
      X = Math.round(x - w / 2),
      Yb = Math.round(y - h / 2);
    c.fillStyle = "#140f0bcc";
    c.fillRect(X - 1, Yb - 1, w + 2, h + 2);
    c.fillStyle = "#2a1f17ee";
    c.fillRect(X, Yb, w, h);
    c.fillStyle = "#94502c";
    c.fillRect(X, Yb, w, 2 / k);
    c.fillStyle = "#4a3c30";
    c.fillRect(X, Yb + h - 2 / k, w, 2 / k);
    this._pixelText(label, x, y + 1, color, 12);
  }

  // ================= 光标小图 =================
  cCursorUpdate(engine, mouse) {
    const cv = this.ctx?.canvas;
    if (!cv?.style) return;
    let kind = "";
    const t = this.time || 0;
    if (t - this._cHoverAt < 0.08) return;
    this._cHoverAt = t;
    try {
      if (this.v && engine && !engine.paused && !engine.buildMode && mouse && Number.isFinite(mouse.x) && Number.isFinite(mouse.y) && document?.documentElement?.classList?.contains("desk")) {
        const wp = this.worldPoint(mouse.x, mouse.y),
          o = this.cHover(engine, wp);
        if (o) kind = cursorKind(engine.simpleLabel ? engine.simpleLabel(o) : "");
      }
    } catch {
      kind = "";
    }
    if (kind !== this._cCursor) {
      this._cCursor = kind;
      cv.style.cursor = kind ? cursorCss(kind) : "";
    }
  }
  // 鼠标下面那一样能按的东西（离鼠标最近的那个）
  cHover(e, wp) {
    const s = e.s,
      list = [];
    for (const o of e.objects || []) if (o && Number.isFinite(o.x)) list.push(o);
    if (s.region === "farm") for (const b of s.buildings || []) if (b && Number.isFinite(b.x)) list.push({ ...b, type: "building", building: b, name: BUILDINGS[b.type]?.name });
    for (const d of s.drops || []) if (d && d.region === s.region) list.push({ type: "drop", drop: d, x: d.x, y: d.y });
    let best = null,
      bd = Infinity;
    for (const o of list) {
      if (Math.abs(o.x - wp.x) > 140 || o.y - wp.y > 40 || wp.y - o.y > 180) continue;
      const box = this.cBox(o, e);
      if (!box || wp.x < box.x0 || wp.x > box.x1 || wp.y < box.y0 || wp.y > box.y1) continue;
      const d = Math.hypot(o.x - wp.x, o.y - 20 - wp.y);
      if (d < bd) {
        bd = d;
        best = o;
      }
    }
    return best;
  }
}
