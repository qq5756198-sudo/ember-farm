// v0.36.0「巨影」的画面：前五凶（河伯、收破烂的和三轮、〇号和它的两半、黑瞎子、白毛风）按它在干什么换姿势；
// 地上的泥、漫进来的水、冰面（画在地上，跟着光照走）；
// 光照之后、字之前画：黑瞎子的雾、白毛风的风雪、毒雾、每一下要打过来的地方（预兆：一块颜色从里往外涨满就打下来）、
// 敲锅荡开的声波、扔过来的木头、吼一声震开的一圈、被抓住时那只手。夜里也看得清，雾里也看得清。
// 只是画出来，挨不挨、挡不挡路都在引擎里算。
import { Renderer as NfRenderer } from "./nightfall-renderer.js";
import { TITANS, TITAN_IDS, POD_TYPE } from "./titan-data.js";
import { makeCanvas } from "./pixel-kit.js";
import { WORLD } from "./data.js";
import { heboSprite, scrapSprite, cartSprite, zeroSprite, podSprite, bearSprite, frostSprite, barrelSprite, giftSprite } from "./titan-sprites.js";

const snap = (v) => Math.round(v / 2) * 2;
const WORLD_H = WORLD.h;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const TAU = Math.PI * 2;
const rgba = (c, a) => `rgba(${c[0]},${c[1]},${c[2]},${clamp(a, 0, 1).toFixed(3)})`;
// 预兆的颜色：红是要伤人的，橙是冲过来的路，蓝是寒气和冰，黄是吼、敲锅
const TONE = {
  red: { fill: [214, 70, 52], core: [255, 112, 84], line: "#ffa38a" },
  orange: { fill: [226, 132, 44], core: [255, 176, 86], line: "#ffd08a" },
  blue: { fill: [96, 168, 228], core: [160, 214, 255], line: "#d8f0ff" },
  yellow: { fill: [222, 190, 70], core: [255, 226, 120], line: "#fff0b0" },
};
const ZONE = { mud: [86, 58, 36], water: [52, 104, 112], ice: [196, 226, 240], gas: [150, 196, 84] };
const GLOW = { hebo: [150, 200, 170], scrap: [230, 200, 150], zero: [180, 230, 140], bear: [170, 170, 150], frost: [190, 220, 245], tide: [246, 176, 90] };

// 窝边上的血印、爪痕和一块红漆警示牌：在空地上找地方（河伯的不落在河里），每一凶算一次
const lairSpots = new Map();
export function lairSpot(e, id) {
  if (lairSpots.has(id)) return lairSpots.get(id);
  const T = TITANS[id],
    L = T.lair,
    W = WORLD.w || 1536,
    H = WORLD.h || 1024;
  const wet = (x) => !!T.river && x >= T.river.x - 24 && x <= T.river.x + T.river.w + 24;
  const free = (x, y, pad) => x > 70 && y > 90 && x < W - 70 && y < H - 60 && !wet(x) && !e.blocked?.(x, y, true, pad);
  const marks = [];
  for (let i = 0; i < 18 && marks.length < 6; i++) {
    const a = i * 2.39996 + id.length,
      r = 50 + ((i * 53) % 90),
      x = L.x + Math.cos(a) * r,
      y = L.y + Math.sin(a) * r * 0.8;
    if (free(x, y, 6)) marks.push({ x, y, k: i % 3, a: a * 0.7 });
  }
  // 警示牌：离窝两百八左右（比它醒的那一圈远），朝地图中间那一边
  let sign = null;
  const toward = Math.atan2(H / 2 - L.y, W / 2 - L.x);
  for (let i = 0; i < 26 && !sign; i++) {
    const a = toward + (i % 2 ? 1 : -1) * Math.ceil(i / 2) * 0.25;
    for (const r of [280, 255, 310]) {
      const x = L.x + Math.cos(a) * r,
        y = L.y + Math.sin(a) * r;
      if (free(x, y, 18) && free(x, y - 30, 12)) {
        sign = { x: snap(x), y: snap(y) };
        break;
      }
    }
  }
  const out = { marks, sign };
  lairSpots.set(id, out);
  return out;
}

// 被打中那一下的白影（每张图做一次）
const whites = new WeakMap();
function whiteOf(cv) {
  if (!cv) return null;
  let w = whites.get(cv);
  if (w !== undefined) return w;
  w = makeCanvas(cv.width, cv.height);
  if (w) {
    const g = w.getContext("2d");
    g.drawImage(cv, 0, 0);
    g.globalCompositeOperation = "source-in";
    g.fillStyle = "#fff6e0";
    g.fillRect(0, 0, cv.width, cv.height);
  }
  whites.set(cv, w || null);
  return w || null;
}

export class Renderer extends NfRenderer {
  draw(engine, mouse, dt = 0.016) {
    this._tE = engine;
    this._tDt = dt;
    return super.draw(engine, mouse, dt);
  }
  // 打十凶时镜头往它那边让一点：它在你北边时，头不顶出屏幕上边
  snapCamera() {
    const e = this._tE;
    let want = 0;
    if (e?.tg && e.s?.player) {
      const z = e.titanAwake?.(),
        p = e.s.player;
      if (z && !z.hidden && Math.abs(z.x - p.x) < 800) {
        const dy = p.y - z.y;
        if (dy > -60 && dy < 700) want = clamp(40 + dy * 0.3, 0, 120);
      }
    }
    const b = this._tBias || 0;
    this._tBias = b + (want - b) * Math.min(1, (this._tDt || 0.016) * 3);
    if (this._tBias > 0.5) {
      const vh = this.h / this.camera.scale;
      this.camera.y = clamp(this.camera.y - this._tBias, 0, Math.max(0, WORLD_H - vh));
    }
    return super.snapCamera();
  }
  // ---------- 画一张大图：脚在 (x, y)；sink 往地里沉了几成（只露上面），lift 离地多高 ----------
  tpx(cv, x, y, { flip = false, alpha = 1, scale = 1, sink = 0, lift = 0, white = 0 } = {}) {
    if (!cv || alpha <= 0) return;
    const c = this.ctx,
      k = 2 * scale,
      rows = Math.max(0, Math.round(cv.height * (1 - clamp(sink, 0, 1))));
    if (!rows) return;
    const w = cv.width * k,
      h = rows * k,
      X = snap(x - w / 2),
      Y = snap(y - h - lift);
    const put = (img) => {
      if (flip) {
        c.save();
        c.translate(X + w, Y);
        c.scale(-1, 1);
        c.drawImage(img, 0, 0, cv.width, rows, 0, 0, w, h);
        c.restore();
      } else c.drawImage(img, 0, 0, cv.width, rows, X, Y, w, h);
    };
    c.save();
    c.imageSmoothingEnabled = false;
    c.globalAlpha = alpha;
    put(cv);
    if (white > 0) {
      const wv = whiteOf(cv);
      if (wv) {
        c.globalAlpha = alpha * clamp(white, 0, 1);
        put(wv);
      }
    }
    c.restore();
  }
  // 它在不在走（画走路的帧）
  tMoving(z) {
    const m = (this._tPos ||= new Map()),
      last = m.get(z.id),
      moved = last ? Math.hypot(z.x - last.x, z.y - last.y) : 0;
    const moving = moved > 0.2 || (last?.moving && this.time - last.at < 0.12);
    m.set(z.id, { x: z.x, y: z.y, at: moved > 0.2 ? this.time : last?.at ?? this.time, moving });
    if (m.size > 64) m.clear();
    return moving;
  }
  // 刚从看不见变成看得见（河伯冒出来）：几帧从地里升上来
  tEmerge(z) {
    const m = (this._tSeen ||= new Map()),
      was = m.get(z.id);
    if (z.hidden) {
      m.set(z.id, { hidden: true, at: 0 });
      return 1;
    }
    if (!was || was.hidden) m.set(z.id, { hidden: false, at: this.time });
    const at = m.get(z.id).at;
    return clamp((this.time - at) / 0.28, 0, 1);
  }
  tMine(e, z) {
    return (e.tx?.strikes || []).filter((S) => S.src === z.id);
  }

  // ---------- 感染者 ----------
  drawEnemy(z, e) {
    if (z?.titan && TITANS[z.titan]) return this.drawTitan(z, e);
    if (z?.type === POD_TYPE) return this.drawPod(z, e);
    return super.drawEnemy(z, e);
  }
  drawTitan(z, e) {
    const T = TITANS[z.titan],
      flip = Math.cos(z.facing ?? 0) < 0,
      white = z.flash > 0 ? clamp(z.flash / 0.12, 0, 1) * 0.75 : z.inv > 0 && z.roar ? 0.25 + 0.25 * Math.sin(this.time * 30) : 0,
      out = this["t_" + z.titan]?.(z, e, { T, flip, white });
    if (!out) return;
    if (z.stag > 0) this.tStars(z.x, z.y - out.top - 10);
    // 〇号的两半：头上各一条小血条
    if (z.half) {
      const c = this.ctx,
        w = 56,
        X = snap(z.x - w / 2),
        Y = snap(z.y - out.top - 14);
      c.fillStyle = "#140f0b";
      c.fillRect(X - 2, Y - 2, w + 4, 8);
      c.fillStyle = "#4a3c30";
      c.fillRect(X, Y, w, 4);
      c.fillStyle = "#d2654c";
      c.fillRect(X, Y, snap((w * Math.max(0, z.hp)) / Math.max(1, z.maxHp)), 4);
    }
  }
  // 晃了：头上转三颗星
  tStars(x, y) {
    const c = this.ctx,
      t = this.calm ? 0 : this.time * 5;
    for (let i = 0; i < 3; i++) {
      const a = t + (i * TAU) / 3,
        X = snap(x + Math.cos(a) * 26),
        Y = snap(y + Math.sin(a) * 8);
      c.fillStyle = "#1c140f";
      c.fillRect(X - 2, Y - 2, 8, 8);
      c.fillStyle = "#ffdb8c";
      c.fillRect(X, Y, 4, 4);
      c.fillStyle = "#fff6d0";
      c.fillRect(X + 2, Y, 2, 2);
    }
  }
  // 一凶一个画法：返回头顶在脚上面多高（画星星、小血条用）
  t_hebo(z, e, o) {
    const H = TITANS.hebo;
    if (z.hidden) {
      // 在泥里走：地上鼓起一道、冒泡（泡在地上那一层画）
      if (z.mode === "under") this.tMound(z.x, z.y);
      this.tEmerge(z);
      return null;
    }
    const up = this.tEmerge(z),
      mine = this.tMine(e, z);
    let pose = "up",
      sink = 1 - up;
    if (z.mode === "dive" && z.act?.k === "dive") sink = clamp(1 - z.act.t / H.dive.sink, 0, 1);
    if (z.mode === "beached") pose = "beached";
    else if (up < 1) pose = "rise";
    else if (mine.some((S) => S.shape.k === "cone" || S.shape.k === "line")) pose = "sweep";
    const frame = Math.floor(this.time * 3 + z.id) % 4,
      cv = heboSprite(pose, frame);
    this.pxShadow(z.x, z.y, 64);
    this.tpx(cv, z.x, z.y + 6, { flip: o.flip, sink, white: o.white });
    return { top: pose === "beached" ? 60 : (cv?.height || 86) * 2 * (1 - sink) - 6 };
  }
  t_scrap(z, e, o) {
    const A = z.act,
      mine = this.tMine(e, z),
      rush = A?.k === "rushWind" || A?.k === "rush",
      pose = rush ? "rush" : A?.k === "stun" ? "stun" : A?.k === "gong" ? "gong" : "walk",
      moving = this.tMoving(z),
      frame = rush && A?.k === "rush" ? Math.floor(this.time * 12) % 4 : moving ? Math.floor(this.time * 5 + z.id) % 4 : 0,
      cv = scrapSprite(pose, frame);
    // 三轮：平时拖在身后；抡起来时绕着他转
    const swing = mine.some((S) => S.shape.k === "circle" && S.hit?.dmg),
      ang = swing ? (this.calm ? 0 : this.time * 9) : (z.facing ?? 0) + Math.PI,
      cx = z.x + Math.cos(ang) * (swing ? 72 : 56),
      cy = z.y + Math.sin(ang) * (swing ? 40 : 22),
      cart = cartSprite(moving || swing ? Math.floor(this.time * 8) % 2 : 0),
      drawCart = () => {
        this.pxShadow(cx, cy, 30);
        this.tpx(cart, cx, cy + 4, { flip: swing ? Math.sin(ang) > 0 : o.flip });
      };
    if (cy < z.y) drawCart();
    this.pxShadow(z.x, z.y, 40);
    this.tpx(cv, z.x, z.y + 4, { flip: o.flip, white: o.white });
    if (cy >= z.y) drawCart();
    // 被它“看见”了：蒙眼的布条底下透出红光
    if (z.lock > 0 && !this.calm && Math.floor(this.time * 6) % 2 === 0) {
      const c = this.ctx;
      c.fillStyle = "#ff6a4a";
      c.fillRect(snap(z.x + (o.flip ? -10 : 6)), snap(z.y - 172), 6, 4);
    }
    return { top: 188 };
  }
  t_zero(z, e, o) {
    const A = z.act,
      scale = z.half ? 0.74 : 1,
      mine = this.tMine(e, z);
    let pose = "walk",
      lift = 0;
    if (A?.k === "pounce") {
      if (A.up) {
        const k = clamp(1 - A.t / Math.max(0.01, A.fly), 0, 1);
        lift = Math.sin(k * Math.PI) * 90;
        pose = "fly";
      } else pose = "crouch";
    } else if (mine.some((S) => S.shape.k === "line")) pose = "lash";
    const moving = this.tMoving(z),
      frame = moving ? Math.floor(this.time * 6 + z.id) % 4 : Math.floor(this.time * 2) % 2,
      shells = (z.adapt || []).slice(0, 3).join(","),
      cv = zeroSprite(pose, frame, shells);
    this.pxShadow(z.x, z.y, (lift > 0 ? 26 : 34) * scale);
    this.tpx(cv, z.x, z.y + 4, { flip: o.flip, scale, lift, white: o.white });
    // 另一半倒下了：在倒下的地方往回爬
    if (z.merge > 0 && z.mergeAt) {
      const wob = this.calm ? 0 : Math.sin(this.time * 7) * 3,
        ghost = zeroSprite("crouch", Math.floor(this.time * 4) % 2, shells);
      this.tpx(ghost, z.mergeAt.x + wob, z.mergeAt.y + 6, { scale: 0.74, alpha: 0.55, sink: 0.35 });
      this.text(Math.ceil(z.merge) + " 秒", z.mergeAt.x, z.mergeAt.y - 100, "#ff9a7a", 13);
    }
    return { top: (cv?.height || 88) * 2 * scale + lift - 4 };
  }
  t_bear(z, e, o) {
    const A = z.act,
      k = A?.k,
      moving = this.tMoving(z);
    let pose = "walk",
      fps = moving ? 5 : 0;
    if (k === "chargeWind") {
      pose = "charge";
      fps = 6;
    } else if (k === "charge") {
      pose = "charge";
      fps = 12;
    } else if (k === "stun" || k === "afraid" || k === "trapped" || k === "panic") pose = "stun";
    else if (z.stand > 0) pose = "stand";
    else if (k === "swipes") pose = this.tMine(e, z).length ? "swipe" : "walk";
    const frame = fps ? Math.floor(this.time * fps + z.id) % 4 : 0,
      cv = bearSprite(pose, frame);
    this.pxShadow(z.x, z.y, 62);
    this.tpx(cv, z.x, z.y + 6, { flip: o.flip, white: o.white });
    // 被夹住：腿上的夹子一闪一闪
    if (k === "trapped" && Math.floor(this.time * 6) % 2 === 0) {
      const c = this.ctx;
      c.fillStyle = "#ffdb8c";
      c.fillRect(snap(z.x + (o.flip ? 40 : -60)), snap(z.y - 30), 20, 4);
    }
    return { top: pose === "stand" ? 206 : 140 };
  }
  t_frost(z, e, o) {
    if (z.hidden) return null;
    const mine = this.tMine(e, z),
      cone = mine.find((S) => S.shape.k === "cone"),
      pose = z.lift > 0 ? "raise" : cone ? (cone.hit?.slow ? "breath" : "sweep") : "walk",
      moving = this.tMoving(z),
      frame = moving ? Math.floor(this.time * 4 + z.id) % 4 : 0,
      armor = z.armor > 0,
      cv = frostSprite(pose, frame, armor);
    this.pxShadow(z.x, z.y, 44);
    this.tpx(cv, z.x, z.y + 4, { flip: o.flip, white: o.white });
    return { top: 200 };
  }
  // 河伯在泥里走：地上鼓起一道
  tMound(x, y) {
    const c = this.ctx,
      t = this.calm ? 0 : this.time;
    c.save();
    c.fillStyle = "rgba(58,37,25,0.75)";
    c.beginPath();
    c.ellipse(snap(x), snap(y), 34, 12, 0, 0, TAU);
    c.fill();
    c.fillStyle = "rgba(112,74,47,0.9)";
    for (let i = 0; i < 5; i++) {
      const a = t * 2 + i * 1.3;
      c.fillRect(snap(x + Math.cos(a) * 22), snap(y - 4 + Math.sin(a) * 6), 4, 4);
    }
    c.restore();
  }
  // 孢囊：越鼓越亮，快炸时一闪一闪
  drawPod(z, e) {
    const k = 1 - clamp((z.fuse ?? 6) / (z.fuseMax || 6), 0, 1),
      blink = (z.fuse ?? 6) < 2 && Math.floor(this.time * 8) % 2 === 0;
    this.pxShadow(z.x, z.y, 18);
    this.tpx(podSprite(k), z.x, z.y + 2, { white: z.flash > 0 ? 0.7 : blink ? 0.45 : 0 });
  }

  // ---------- 地上的东西 ----------
  drawObject(o, e) {
    if (o?.type === "tBarrel") {
      const b = (e.tx?.barrels || []).find((x) => x.i === o.i),
        lit = !!b?.lit;
      this.pxShadow(o.x, o.y, 16);
      this.tpx(barrelSprite(lit, Math.floor(this.time * 8) % 3), o.x, o.y + 4);
      return;
    }
    if (o?.type === "tGift") {
      this.pxShadow(o.x, o.y, 18);
      this.tpx(giftSprite(o.of), o.x, o.y + 4);
      if (!this.calm && Math.floor(this.time * 3) % 3 === 0) {
        const c = this.ctx;
        c.fillStyle = "#fff6d0";
        c.fillRect(snap(o.x + 10), snap(o.y - 26), 2, 6);
        c.fillRect(snap(o.x + 8), snap(o.y - 24), 6, 2);
      }
      return;
    }
    return super.drawObject(o, e);
  }
  // 烧着的铁桶是一盏灯；醒着的十凶身上一层淡淡的光（夜里也看得出个头）
  collectLights(e, night) {
    const L = super.collectLights(e, night);
    for (const b of e?.tx?.barrels || []) if (b.lit) L.push({ x: b.x, y: b.y - 24, r: 170, color: [255, 166, 86], power: 0.95 });
    if (night > 0.2)
      for (const z of e?.enemies || []) {
        // 有几只的那几凶（titan-renderer2.js）自己打光
        if (!z.titan || z.dead || z.hidden || !z.awake || TITANS[z.titan]?.parts) continue;
        L.push({ x: z.x, y: z.y - 80, r: 170, color: GLOW[z.titan] || [200, 190, 170], power: 0.42 });
      }
    return L;
  }
  // 地上那一层：泥、漫进来的水、冰面，冒泡、溅起来的水、倒下的那一凶
  drawRuins(e) {
    const out = super.drawRuins(e);
    if (e?.tg && e.tx) this.tGround(e);
    return out;
  }
  // 窝边上的血印、爪痕、红漆警示牌（这一凶在这张图上开了才有；打赢以后淡一半）
  tLairMarks(e) {
    const c = this.ctx;
    for (const id of TITAN_IDS) {
      const T = TITANS[id];
      // 最后一凶没有窝（它从林子里找上门来）
      if (T.region !== e.s.region || T.final || !e.titanOpen?.(id)) continue;
      const S = lairSpot(e, id),
        fade = e.titanGone?.(id) ? 0.45 : 1;
      for (const m of S.marks) {
        if (m.k === 0) {
          // 一摊干了的血
          c.fillStyle = rgba([92, 26, 22], 0.55 * fade);
          c.fillRect(snap(m.x - 8), snap(m.y - 2), 16, 6);
          c.fillRect(snap(m.x - 4), snap(m.y - 6), 10, 12);
          c.fillStyle = rgba([120, 34, 28], 0.5 * fade);
          c.fillRect(snap(m.x + 10), snap(m.y + 2), 4, 4);
          c.fillRect(snap(m.x - 14), snap(m.y - 6), 2, 2);
        } else {
          // 三道爪痕
          c.fillStyle = rgba(m.k === 1 ? [40, 28, 22] : [88, 30, 24], 0.5 * fade);
          const dx = Math.cos(m.a),
            dy = Math.sin(m.a);
          for (let j = -1; j <= 1; j++) for (let s = 0; s < 11; s++) c.fillRect(snap(m.x + dx * s * 2 - dy * j * 6), snap(m.y + dy * s * 2 + dx * j * 6), 2, 2);
        }
      }
      const g = S.sign;
      if (!g) continue;
      c.globalAlpha = fade;
      c.fillStyle = "rgba(20,14,10,0.35)";
      c.fillRect(g.x - 10, g.y - 2, 20, 4);
      c.fillStyle = "#3b2a1c";
      c.fillRect(g.x - 2, g.y - 26, 4, 26);
      c.fillStyle = "#2d1e14";
      c.fillRect(g.x - 16, g.y - 40, 32, 20);
      c.fillStyle = "#6b4a2e";
      c.fillRect(g.x - 14, g.y - 38, 28, 16);
      // 红漆打个叉，往下淌
      c.fillStyle = "#b8322a";
      for (let s = 0; s < 6; s++) {
        c.fillRect(g.x - 12 + s * 4, g.y - 36 + s * 2, 4, 2);
        c.fillRect(g.x + 8 - s * 4, g.y - 36 + s * 2, 4, 2);
      }
      c.fillRect(g.x - 8, g.y - 22, 2, 4);
      c.fillRect(g.x + 6, g.y - 22, 2, 6);
      c.globalAlpha = 1;
    }
  }
  tGround(e) {
    const c = this.ctx,
      t = this.calm ? 0 : this.time,
      tx = e.tx;
    c.save();
    this.tLairMarks(e);
    for (const Z of tx.zones) {
      const fade = Z.t === Infinity ? 1 : clamp(Z.t / 0.8, 0, 1) * clamp((Z.max - Z.t) / 0.4, 0, 1);
      if (Z.kind === "water" && Z.w != null) {
        // 河本来就画在底图上；漫进来的两条水道要画
        if (Z.data?.river) continue;
        c.fillStyle = rgba(ZONE.water, 0.62 * fade);
        c.fillRect(Z.x, Z.y, Z.w, Z.h);
        c.fillStyle = rgba([150, 200, 196], 0.45 * fade);
        for (let i = 0; i < Math.floor(Z.h / 26); i++) {
          const y = Z.y + ((i * 26 + t * 30) % Z.h),
            x = Z.x + 10 + ((i * 37) % Math.max(10, Z.w - 40));
          c.fillRect(snap(x), snap(y), 22, 2);
        }
      } else if (Z.kind === "mud") {
        c.fillStyle = rgba(ZONE.mud, 0.78 * fade);
        c.beginPath();
        c.arc(Z.x, Z.y, Z.r, 0, TAU);
        c.fill();
        c.fillStyle = rgba([58, 37, 25], 0.7 * fade);
        c.beginPath();
        c.arc(Z.x + 6, Z.y + 4, Z.r * 0.62, 0, TAU);
        c.fill();
        c.fillStyle = rgba([141, 99, 64], 0.8 * fade);
        for (let i = 0; i < 6; i++) {
          const a = i * 1.7 + Z.x * 0.01,
            r = Z.r * (0.3 + ((i * 37) % 60) / 100);
          c.fillRect(snap(Z.x + Math.cos(a) * r), snap(Z.y + Math.sin(a) * r), 4, 2);
        }
      } else if (Z.kind === "ice") {
        c.fillStyle = rgba(ZONE.ice, 0.62 * fade);
        c.beginPath();
        c.arc(Z.x, Z.y, Z.r, 0, TAU);
        c.fill();
        c.strokeStyle = rgba([246, 250, 255], 0.75 * fade);
        c.lineWidth = 2;
        c.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = i * 1.26 + Z.x * 0.02;
          c.moveTo(snap(Z.x + Math.cos(a) * Z.r * 0.15), snap(Z.y + Math.sin(a) * Z.r * 0.15));
          c.lineTo(snap(Z.x + Math.cos(a + 0.3) * Z.r * 0.8), snap(Z.y + Math.sin(a + 0.3) * Z.r * 0.8));
        }
        c.stroke();
      }
    }
    for (const f of tx.fx) {
      const k = clamp(1 - f.t / f.max, 0, 1);
      if (f.kind === "bubbles") {
        c.fillStyle = rgba([169, 207, 189], 0.85 * (1 - k));
        for (let i = 0; i < 4; i++) {
          const a = i * 1.9 + f.x * 0.1,
            r = 6 + i * 5 + k * 6;
          c.fillRect(snap(f.x + Math.cos(a) * r), snap(f.y + Math.sin(a) * r * 0.5 - k * 6), i % 2 ? 4 : 2, i % 2 ? 4 : 2);
        }
      } else if (f.kind === "splash") {
        c.fillStyle = rgba([169, 207, 189], 0.9 * (1 - k));
        for (let i = 0; i < 14; i++) {
          const a = (i / 14) * TAU,
            r = 30 + k * 70,
            h = Math.sin(k * Math.PI) * 30 * (0.6 + (i % 3) * 0.2);
          c.fillRect(snap(f.x + Math.cos(a) * r), snap(f.y + Math.sin(a) * r * 0.45 - h), 4, 4);
        }
      } else if (f.kind === "fall") this.tFall(f, k);
    }
    c.restore();
  }
  // 倒下：慢慢沉下去、淡掉
  tFall(f, k) {
    const flip = Math.cos(f.facing ?? 0) < 0,
      alpha = 1 - k * k,
      sink = k * 0.7;
    let cv = null;
    if (f.titan === "hebo") cv = heboSprite("beached", 0);
    else if (f.titan === "scrap") cv = scrapSprite("stun", 0);
    else if (f.titan === "zero") cv = zeroSprite("crouch", 0, "");
    else if (f.titan === "bear") cv = bearSprite("stun", 0);
    else if (f.titan === "frost") cv = frostSprite("walk", 0, false);
    this.tpx(cv, f.x, f.y + 4, { flip, alpha, sink, scale: f.half ? 0.74 : 1 });
  }

  // ---------- 光照之后、字之前 ----------
  drawEmissive(e, night, view) {
    super.drawEmissive(e, night, view);
    if (e?.tg) this.tOverlay(e, view);
  }
  drawNight(e) {
    super.drawNight(e);
    // 旧画法没有“发光”那一层：画在最上面
    if (!this.v && e?.tg && this.ctx) {
      const sc = this.camera.scale;
      this.tOverlay(e, { x: this.camera.x, y: this.camera.y, w: this.w / sc, h: this.h / sc });
    }
  }
  tOverlay(e, view) {
    const tx = e.tx;
    if (!tx || e.s?.region == null) return;
    const F = e.titanFog?.();
    if (F) this.tFog(e, F, view);
    if (F?.white) this.tBlizzard(view);
    this.tZoneMarks(e);
    this.tPodRings(e);
    this.tWarmRings(e);
    for (const S of tx.strikes) this.tStrike(S);
    this.tRings(tx.rings);
    this.tShots(tx.shots);
    this.tFx(tx.fx, e);
    this.tHold(e);
  }
  // 雾（黑瞎子）/ 白毛风：身边一圈看得清，头灯、手电照着的方向看得远；火和烧着的铁桶把雾推开
  tFog(e, F, view) {
    const p = e.s.player,
      k = 0.25,
      W = Math.ceil(view.w * k) + 2,
      H = Math.ceil(view.h * k) + 2;
    let cv = this._tFogCv;
    if (!cv || cv.width !== W || cv.height !== H) cv = this._tFogCv = makeCanvas(W, H);
    if (!cv) return;
    const g = cv.getContext("2d"),
      col = this.fogTint ? this.fogTint(F.white ? [226, 232, 236] : [52, 64, 62]) : F.white ? [226, 232, 236] : [52, 64, 62],
      a = F.white ? 0.9 : 0.86;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalCompositeOperation = "source-over";
    g.clearRect(0, 0, W, H);
    g.fillStyle = rgba(col, a);
    g.fillRect(0, 0, W, H);
    g.setTransform(k, 0, 0, k, -view.x * k, -view.y * k);
    g.globalCompositeOperation = "destination-out";
    const hole = (x, y, r0, r1, power = 1) => {
      const gr = g.createRadialGradient(x, y, Math.max(0, r0), x, y, r1);
      gr.addColorStop(0, `rgba(0,0,0,${power})`);
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.arc(x, y, r1, 0, TAU);
      g.fill();
    };
    hole(p.x, p.y - 20, F.clear * 0.45, F.clear);
    if (e.playerLit?.()) {
      const a0 = p.facing ?? 0,
        gr = g.createRadialGradient(p.x, p.y - 20, F.clear * 0.4, p.x, p.y - 20, F.lamp);
      gr.addColorStop(0, "rgba(0,0,0,0.95)");
      gr.addColorStop(1, "rgba(0,0,0,0)");
      g.fillStyle = gr;
      g.beginPath();
      g.moveTo(p.x, p.y - 20);
      g.arc(p.x, p.y - 20, F.lamp, a0 - 0.5, a0 + 0.5);
      g.closePath();
      g.fill();
    }
    for (const f of e.gx?.fires || []) if (f.region === e.s.region) hole(f.x, f.y - 10, 10, (f.r || 60) + 100, 0.9);
    for (const b of e.tx?.barrels || []) if (b.lit) hole(b.x, b.y - 16, 20, 160, 0.9);
    const c = this.ctx;
    c.save();
    c.imageSmoothingEnabled = true;
    c.drawImage(cv, view.x, view.y, W / k, H / k);
    c.restore();
    // 几条慢慢飘的雾带
    if (this.wx?.drawFog && !F.white) {
      c.save();
      // v0.41：夜里跟着天色（没变的时候照旧用原来那个颜色）
      const band = this.fogTint ? this.fogTint([142, 154, 150]) : null;
      this.wx.drawFog(c, view, this.time || 0, this.calm, band && (band[0] !== 142 || band[1] !== 154 || band[2] !== 150) ? rgba(band, 1) : "#8e9a96", 1.1);
      c.restore();
    }
  }
  // 白毛风：横着刮的雪
  tBlizzard(view) {
    const c = this.ctx,
      t = this.calm ? 0 : this.time,
      n = this.calm ? 50 : 170,
      W = view.w + 200,
      H = view.h + 60;
    c.save();
    c.fillStyle = "#f6f8f2";
    for (let i = 0; i < n; i++) {
      const h1 = Math.sin(i * 127.1) * 43758.5453,
        h2 = Math.sin(i * 311.7) * 43758.5453,
        r1 = h1 - Math.floor(h1),
        r2 = h2 - Math.floor(h2),
        sp = 420 + r1 * 380,
        x = view.x - 100 + ((((r2 * W + t * sp) % W) + W) % W),
        y = view.y - 30 + ((r1 * H + Math.sin(t * 2 + i) * 14 + t * 60 * r2) % H),
        len = 6 + Math.floor(r1 * 4) * 4;
      c.globalAlpha = 0.35 + r2 * 0.45;
      c.fillRect(snap(x), snap(y), len, 2);
    }
    c.restore();
  }
  // 泥、冰、漫进来的水：夜里描一圈虚线，看得出边；毒雾一团团绿
  tZoneMarks(e) {
    const c = this.ctx,
      t = this.calm ? 0 : this.time;
    c.save();
    c.lineWidth = 2;
    c.setLineDash([6, 6]);
    for (const Z of e.tx.zones) {
      const fade = Z.t === Infinity ? 1 : clamp(Z.t / 0.8, 0, 1) * clamp((Z.max - Z.t) / 0.4, 0, 1);
      if (Z.kind === "gas") {
        c.setLineDash([]);
        for (let i = 0; i < 7; i++) {
          const a = i * 0.9 + t * 0.4 * (i % 2 ? 1 : -1),
            r = Z.r * (i ? 0.55 : 0.25),
            x = Z.x + Math.cos(a) * r,
            y = Z.y + Math.sin(a) * r * 0.7;
          c.fillStyle = rgba(ZONE.gas, 0.2 * fade);
          c.beginPath();
          c.arc(x, y, Z.r * 0.45, 0, TAU);
          c.fill();
        }
        c.strokeStyle = rgba([196, 230, 120], 0.55 * fade);
        c.setLineDash([4, 6]);
        c.beginPath();
        c.arc(Z.x, Z.y, Z.r, 0, TAU);
        c.stroke();
        c.setLineDash([6, 6]);
        continue;
      }
      // 油、火、烟、通电的铁轨另外画（titan-renderer2.js）
      if (Z.data?.river || !["mud", "ice", "water"].includes(Z.kind)) continue;
      c.strokeStyle = Z.kind === "mud" ? rgba([196, 150, 100], 0.55 * fade) : Z.kind === "ice" ? rgba([230, 244, 255], 0.65 * fade) : rgba([150, 210, 220], 0.5 * fade);
      c.beginPath();
      if (Z.w != null) c.rect(Z.x, Z.y, Z.w, Z.h);
      else c.arc(Z.x, Z.y, Z.r, 0, TAU);
      c.stroke();
    }
    c.restore();
  }
  // 孢囊快炸了：地上一圈绿虚线是毒雾会有多大
  tPodRings(e) {
    const P = TITANS.zero?.pods;
    if (!P) return;
    const c = this.ctx;
    c.save();
    c.lineWidth = 2;
    c.setLineDash([4, 6]);
    for (const z of e.enemies || []) {
      if (z.type !== POD_TYPE || z.dead || !(z.fuse < 3)) continue;
      c.strokeStyle = rgba([196, 230, 120], 0.25 + 0.5 * (1 - z.fuse / 3));
      c.beginPath();
      c.arc(z.x, z.y, P.gas.r, 0, TAU);
      c.stroke();
    }
    c.restore();
  }
  // 白毛风醒着：烧着的铁桶身边一圈暖和的地方
  tWarmRings(e) {
    const F = TITANS.frost;
    if (!F || !(e.tx.barrels || []).length || !e.titansHere?.("frost").some((z) => z.awake)) return;
    const c = this.ctx;
    c.save();
    c.lineWidth = 2;
    c.setLineDash([8, 8]);
    c.strokeStyle = "rgba(255,190,110,0.55)";
    for (const b of e.tx.barrels) {
      if (!b.lit) continue;
      c.beginPath();
      c.arc(b.x, b.y, F.warm, 0, TAU);
      c.stroke();
    }
    c.restore();
  }
  // 一下要打过来的地方：整块淡淡一层，里面一块从中间往外涨，涨满就打下来；最后一下边上一闪
  tShapePath(sh, k = 1) {
    const c = this.ctx;
    c.beginPath();
    switch (sh.k) {
      case "circle":
        c.arc(sh.x, sh.y, Math.max(0.5, sh.r * k), 0, TAU);
        break;
      case "cone":
        c.moveTo(sh.x, sh.y);
        c.arc(sh.x, sh.y, Math.max(0.5, sh.r * k), sh.a - sh.arc, sh.a + sh.arc);
        c.closePath();
        break;
      case "line": {
        const ux = Math.cos(sh.a),
          uy = Math.sin(sh.a),
          hw = sh.w / 2,
          L = Math.max(0.5, sh.len * k);
        c.moveTo(sh.x - uy * hw, sh.y + ux * hw);
        c.lineTo(sh.x + ux * L - uy * hw, sh.y + uy * L + ux * hw);
        c.lineTo(sh.x + ux * L + uy * hw, sh.y + uy * L - ux * hw);
        c.lineTo(sh.x + uy * hw, sh.y - ux * hw);
        c.closePath();
        break;
      }
      case "rect": {
        const w = sh.w * k,
          h = sh.h * k;
        c.rect(sh.x + (sh.w - w) / 2, sh.y + (sh.h - h) / 2, Math.max(0.5, w), Math.max(0.5, h));
        break;
      }
      case "ring":
        c.arc(sh.x, sh.y, sh.r1, 0, TAU);
        c.moveTo(sh.x + sh.r0, sh.y);
        c.arc(sh.x, sh.y, sh.r0, 0, TAU, true);
        break;
    }
  }
  tStrike(S) {
    const c = this.ctx,
      C = TONE[S.col] || TONE.red,
      k = clamp(1 - S.t / Math.max(0.01, S.max), 0, 1),
      sh = S.shape,
      last = S.t < 0.22;
    c.save();
    c.fillStyle = rgba(C.fill, 0.16 + 0.12 * k);
    this.tShapePath(sh, 1);
    c.fill("evenodd");
    if (sh.k !== "ring") {
      c.fillStyle = rgba(C.core, 0.26 + 0.2 * k);
      this.tShapePath(sh, k);
      c.fill();
    }
    // 边：先一道深色再一道亮色，雪地、草地、夜里都看得出
    this.tShapePath(sh, 1);
    c.globalAlpha = 0.75;
    c.lineWidth = last ? 7 : 5;
    c.strokeStyle = "#1c140f";
    c.stroke();
    c.globalAlpha = 0.95;
    c.lineWidth = last ? 4 : 2;
    c.strokeStyle = last && Math.floor(this.time * 20) % 2 === 0 && !this.calm ? "#ffffff" : C.line;
    c.stroke();
    // 冲过来的路：一串箭头往前走
    if (sh.k === "line" && S.col === "orange") {
      const ux = Math.cos(sh.a),
        uy = Math.sin(sh.a),
        step = 70,
        off = this.calm ? 0 : (this.time * 160) % step,
        hw = sh.w * 0.28;
      c.strokeStyle = C.line;
      c.lineWidth = 4;
      c.globalAlpha = 0.85;
      c.beginPath();
      for (let d = 30 + off; d < sh.len - 20; d += step) {
        const x = sh.x + ux * d,
          y = sh.y + uy * d;
        c.moveTo(x - ux * 16 - uy * hw, y - uy * 16 + ux * hw);
        c.lineTo(x, y);
        c.lineTo(x - ux * 16 + uy * hw, y - uy * 16 - ux * hw);
      }
      c.stroke();
    }
    c.restore();
  }
  // 敲锅荡开的声波
  tRings(list) {
    if (!list.length) return;
    const c = this.ctx;
    c.save();
    for (const R of list) {
      const f = 1 - R.r / Math.max(1, R.max);
      c.strokeStyle = rgba([255, 226, 120], 0.85 * f);
      c.lineWidth = 4;
      c.beginPath();
      c.arc(R.x, R.y, Math.max(1, R.r), 0, TAU);
      c.stroke();
      c.strokeStyle = rgba([255, 240, 190], 0.4 * f);
      c.lineWidth = 2;
      c.beginPath();
      c.arc(R.x, R.y, Math.max(1, R.r - 14), 0, TAU);
      c.stroke();
    }
    c.restore();
  }
  // 扔过来的木头：横着滚过来
  tShots(list) {
    if (!list.length) return;
    const c = this.ctx;
    for (const s of list) {
      const len = Math.max(40, s.w * 1.4),
        bob = Math.abs(Math.sin(s.spin)) * 10;
      c.save();
      c.fillStyle = "rgba(24,19,15,0.45)";
      c.beginPath();
      c.ellipse(s.x, s.y + 22, len / 2, 8, 0, 0, TAU);
      c.fill();
      c.translate(snap(s.x), snap(s.y - bob));
      c.rotate(s.a + Math.PI / 2);
      c.fillStyle = "#1c140f";
      c.fillRect(-len / 2 - 2, -11, len + 4, 22);
      c.fillStyle = "#704a2f";
      c.fillRect(-len / 2, -9, len, 18);
      c.fillStyle = "#8d6340";
      c.fillRect(-len / 2, -9, len, 6);
      c.fillStyle = "#ad8258";
      c.fillRect(-len / 2, -9, 6, 18);
      c.fillRect(len / 2 - 6, -9, 6, 18);
      c.fillStyle = "#553522";
      c.fillRect(-len / 2 + 2, -3, 2, 6);
      c.fillRect(len / 2 - 4, -3, 2, 6);
      c.restore();
    }
  }
  // 吼一声震开的一圈、扔过来的破烂、裂开、一团雪、涨水
  tFx(list, e) {
    const c = this.ctx;
    for (const f of list) {
      const k = clamp(1 - f.t / f.max, 0, 1);
      c.save();
      if (f.kind === "roar") {
        c.strokeStyle = rgba([255, 138, 106], 0.9 * (1 - k));
        c.lineWidth = 6;
        c.beginPath();
        c.arc(f.x, f.y, Math.max(1, f.r * k), 0, TAU);
        c.stroke();
      } else if (f.kind === "junk") {
        // 一包破烂划一道弧落下来
        const x = f.x0 + (f.x - f.x0) * k,
          y = f.y0 + (f.y - f.y0) * k - Math.sin(k * Math.PI) * 160;
        c.fillStyle = "rgba(24,19,15,0.4)";
        c.beginPath();
        c.ellipse(f.x0 + (f.x - f.x0) * k, f.y0 + 120 + (f.y - f.y0 - 120) * k, 18, 6, 0, 0, TAU);
        c.fill();
        const spin = this.calm ? 0 : k * 8;
        c.translate(snap(x), snap(y));
        c.rotate(spin);
        c.fillStyle = "#1c140f";
        c.fillRect(-14, -12, 28, 24);
        c.fillStyle = "#94502c";
        c.fillRect(-12, -10, 12, 10);
        c.fillStyle = "#85857a";
        c.fillRect(0, -10, 12, 8);
        c.fillStyle = "#c4ab68";
        c.fillRect(-12, 0, 10, 10);
        c.fillStyle = "#46807a";
        c.fillRect(-2, -2, 14, 12);
      } else if (f.kind === "split") {
        c.fillStyle = rgba([255, 246, 224], 0.8 * (1 - k));
        c.beginPath();
        c.arc(f.x, f.y - 80, 40 + k * 120, 0, TAU);
        c.fill();
      } else if (f.kind === "swirl") {
        // 风雪里一团雪越转越紧：它要从这里出来
        c.fillStyle = "#f6f8f2";
        for (let i = 0; i < 26; i++) {
          const a = i * 0.7 + (this.calm ? 0 : this.time * 6),
            r = (1 - k) * 70 + 14 + (i % 5) * 4,
            h = (i * 13) % 150;
          c.globalAlpha = 0.5 + 0.4 * k;
          c.fillRect(snap(f.x + Math.cos(a) * r), snap(f.y - h + Math.sin(a) * r * 0.3), 4, 4);
        }
      } else if (f.kind === "flood") {
        c.fillStyle = rgba([110, 166, 154], 0.35 * (1 - k));
        for (const L of TITANS.hebo?.lanes || []) c.fillRect(L.x - 20, L.y, L.w + 40, L.h * k);
      }
      c.restore();
    }
  }
  // 被抓住：一只长手拽着你；头上一条挣开的进度
  tHold(e) {
    const H = e.tx.hold;
    if (!H) return;
    const z = (e.enemies || []).find((x) => x.id === H.src);
    if (!z) return;
    const p = e.s.player,
      c = this.ctx,
      sx = z.x + Math.cos(z.facing ?? 0) * 34,
      sy = z.y - 90,
      ex = p.x,
      ey = p.y - 30,
      wig = this.calm ? 0 : Math.sin(this.time * 14) * 3;
    c.save();
    c.lineCap = "round";
    c.strokeStyle = "#1c140f";
    c.lineWidth = 14;
    c.beginPath();
    c.moveTo(sx, sy);
    c.quadraticCurveTo((sx + ex) / 2, (sy + ey) / 2 - 30 + wig, ex, ey);
    c.stroke();
    c.strokeStyle = "#62645d";
    c.lineWidth = 9;
    c.stroke();
    c.strokeStyle = "#85857a";
    c.lineWidth = 3;
    c.stroke();
    c.fillStyle = "#454847";
    c.fillRect(snap(ex - 10), snap(ey - 6), 20, 12);
    const w = 60,
      X = snap(p.x - w / 2),
      Y = snap(p.y - 104);
    c.fillStyle = "#140f0b";
    c.fillRect(X - 2, Y - 2, w + 4, 10);
    c.fillStyle = "#4a3c30";
    c.fillRect(X, Y, w, 6);
    c.fillStyle = "#ffdb8c";
    c.fillRect(X, Y, snap(w * clamp(H.escape || 0, 0, 1)), 6);
    c.restore();
    this.text("被抓住了 · 推开 或 连按交互", p.x, p.y - 118, "#ffb3a0", 12);
  }
}
