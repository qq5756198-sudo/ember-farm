// v0.44.0「四季」的场景这一层（盖在 v0.42 删繁那一层上面），画面二期：
// · 树随时节换叶：底图按这一天的时节画（回暖开小白花、酷暑浓绿、秋收黄红落叶、寒潮落光积雪、松树压雪），
//   换了时节后台重画，画好之前照用原来那张（不黑一下）；去过的别的地图也跟着在后台重画。
// · 每张图一个主色调：乘在环境色上（白天夜里都乘），亮度不变；只对电脑（手机、小窗口照旧）。
// · 走路 8 帧（每两帧之间补一帧，一步的快慢不变）；站着不动时呼吸、眨眼、往旁边看一眼，各人的节奏错开；
//   感染者也是 8 帧（剪影一顿一顿那一层照旧）。“减少晃动”开着时站着不动。
// · 旧图集转出来的小图换成新画的（补给箱、地区里的各个点、样本、日记、供电控制盒、检修间的门、通信站；见 four-art.js）。
// · 标题页动起来：后面的农场镜头慢慢来回挪，飘着这个时节的东西（花瓣、浮尘、落叶、雪），底下往上飘几颗余烬；
//   离开标题页时半秒内挪回原位。只对电脑；“减少晃动”开着或系统要少动画时不动。
import { Renderer as TrimRenderer } from "./trim-renderer.js";
import { CROPS, WORLD } from "./data.js";
import { oldArtCanvas } from "./four-art.js";
import { seasonOf } from "./almanac-data.js";
import { mapSeason } from "./pixel-maps.js";
import { LOOK41, seedOf, rng, PAL } from "./pixel-kit.js";
import { personSprite, dirFromAngle } from "./pixel-sprites.js";
import { hueOf, IDLE, WALK_FPS, TITLE, TITLE_MOTES } from "./four-data.js";

const clamp255 = (v) => Math.max(0, Math.min(255, Math.round(v)));
// 下面几层在农场、溪谷里会把作物的旧小图藏起来（活的作物另画）：这几格照它们的意思不画
const CROP_ICONS = new Set([60, ...Object.values(CROPS).map((c) => c.icon)]);
// 每个人的节奏错开：按名字算一个 0–1 的数
const phases = new Map();
function phaseOf(key) {
  let v = phases.get(key);
  if (v === undefined) {
    v = ((seedOf(String(key)) >>> 0) % 997) / 997;
    if (phases.size < 500) phases.set(key, v);
  }
  return v;
}

const clampN = (v, a, b) => Math.max(a, Math.min(b, v));

export class Renderer extends TrimRenderer {
  draw(engine, mouse, dt = 0.016) {
    this._fE = engine;
    // 标题页：开着时幅度两秒内升到 1，离开后半秒内落回 0（镜头不跳）
    const on = this.fourTitleOn();
    this._fTitleT = on ? (this._fTitleT || 0) + dt : 0;
    this._fTitleK = clampN((this._fTitleK || 0) + (on ? dt / 2 : -dt * 2), 0, 1);
    if (!on && !this._fTitleK) this._fPan = 0;
    const day = engine?.s?.day;
    if (day) {
      this._fDay = day;
      const season = seasonOf(day).id;
      if (this._fSeason !== season) {
        const first = this._fSeason === undefined;
        this._fSeason = season;
        if (!first) this.fourRebakeAll();
      }
    }
    const out = super.draw(engine, mouse, dt);
    if ((this._fTitleK > 0 || this._fFxDirty) && this.v) {
      this.fourTitleFx(dt);
      this._fFxDirty = this._fTitleK > 0;
    }
    return out;
  }
  // ---------- 标题页 ----------
  fourTitleOn() {
    if (!LOOK41.on || this.calm) return false;
    const cls = globalThis.document?.body?.className;
    if (typeof cls !== "string" || !/(^|\s)title-screen(\s|$)/.test(cls)) return false;
    if (this._fRM === undefined) {
      try {
        this._fRM = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)") || null;
      } catch {
        this._fRM = null;
      }
    }
    return !this._fRM?.matches;
  }
  // 镜头：一圈 TITLE.pan 秒，左右最多 TITLE.dx、上下最多 TITLE.dy；地图边上挪不开时按挪得开的那么多来回，
  // 来回的中心挪到挪得满的地方（不在边上卡住）。离开标题页时跟着幅度 k 落回原来的地方。
  snapCamera() {
    const k = this._fTitleK || 0;
    if (k > 0) {
      if (this._fTitleT > 0) this._fPan = (this._fTitleT / TITLE.pan) * Math.PI * 2;
      const a = this._fPan || 0,
        swing = (pos, room, max, s) => {
          const amp = Math.min(max, room / 2),
            mid = clampN(pos, amp, room - amp);
          return clampN(pos + (mid - pos) * k + s * amp * k, 0, room);
        };
      this.camera.x = swing(this.camera.x, Math.max(0, WORLD.w - this.w / this.camera.scale), TITLE.dx, Math.sin(a));
      this.camera.y = swing(this.camera.y, Math.max(0, WORLD.h - this.h / this.camera.scale), TITLE.dy, Math.sin(a * 2));
    }
    return super.snapCamera();
  }
  // 飘着的东西和余烬：画在标题页那层暗色上面的一张透明画布上（#four-fx，挂在 #modal-backdrop 里、标题字的下面），
  // 不跟镜头走，一个美术像素那么大；离开标题页时跟着幅度淡掉，然后清空
  fourFxCanvas() {
    const d = globalThis.document;
    if (!d?.getElementById) return null;
    let cv = this._fFx;
    if (!cv || !cv.isConnected) {
      cv = d.getElementById("four-fx");
      if (!cv) {
        const host = d.getElementById("modal-backdrop");
        if (!host) return null;
        cv = d.createElement("canvas");
        cv.id = "four-fx";
        cv.setAttribute("aria-hidden", "true");
        host.insertBefore(cv, host.firstChild);
      }
      this._fFx = cv;
    }
    const dpr = this.dpr || 1,
      W = Math.round(this.w * dpr),
      H = Math.round(this.h * dpr);
    if (cv.width !== W || cv.height !== H) {
      cv.width = W;
      cv.height = H;
    }
    return cv;
  }
  fourTitleFx(dt) {
    const cv = this.fourFxCanvas(),
      c = cv?.getContext?.("2d");
    if (!c) return;
    const W = this.w,
      H = this.h,
      dpr = this.dpr || 1,
      px = Math.max(2, Math.round((this.camera.scale || 1) * 2)),
      M = TITLE_MOTES[this._fSeason] || TITLE_MOTES.thaw,
      t = this._fTitleT || 0,
      k = this._fTitleK || 0;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.clearRect(0, 0, W, H);
    if (k <= 0.01) return;
    this._fRng ??= rng(4401);
    const R = this._fRng;
    if (this._fMoteSeason !== this._fSeason || !this._fMotes) {
      this._fMoteSeason = this._fSeason;
      this._fMotes = Array.from({ length: TITLE.motes }, () => ({ x: R() * W, y: R() * H, v: 0.6 + R() * 0.8, ph: R() * 6.28, c: M.colors[Math.floor(R() * M.colors.length)], s: R() < 0.35 ? 2 : 1 }));
    }
    this._fEmbers ??= Array.from({ length: TITLE.embers }, () => ({ x: R() * W * 0.7, y: H * (0.4 + R() * 0.7), v: 18 + R() * 30, ph: R() * 6.28 }));
    const step = Math.min(0.05, dt || 0.016);
    for (const m of this._fMotes) {
      m.y += M.fall * m.v * step;
      m.x += Math.sin(t * 0.9 + m.ph) * M.sway * m.v * step;
      if (m.y > H + 8) m.y = -8;
      if (m.y < -8) m.y = H + 8;
      if (m.x < -8) m.x = W + 8;
      if (m.x > W + 8) m.x = -8;
      const a = M.glow ? 0.35 + 0.4 * Math.sin(t * 2.3 + m.ph) : 0.7;
      c.globalAlpha = k * Math.max(0, a);
      c.fillStyle = m.c;
      // 一片：大的是 2×1（花瓣、雪）或 2×2（落叶）个美术像素
      c.fillRect(Math.round(m.x / px) * px, Math.round(m.y / px) * px, px * m.s, M.size > 2 && m.s > 1 ? px * 2 : px);
    }
    for (const b of this._fEmbers) {
      b.y -= b.v * step;
      b.x += Math.sin(t * 1.7 + b.ph) * 12 * step;
      if (b.y < H * 0.3) {
        b.y = H + 6;
        b.x = R() * W * 0.75;
        b.v = 18 + R() * 30;
      }
      const life = clampN((H - b.y) / (H * 0.7), 0, 1),
        a = (1 - life) * (0.55 + 0.45 * Math.sin(t * 6 + b.ph * 3));
      c.globalAlpha = k * Math.max(0, a);
      c.fillStyle = a > 0.6 ? PAL.ember[5] : PAL.ember[4];
      c.fillRect(Math.round(b.x / px) * px, Math.round(b.y / px) * px, px, px);
    }
    c.globalAlpha = 1;
  }
  // ---------- 树随时节换叶 ----------
  artSeason(region) {
    const day = this._fDay ?? this._fE?.s?.day;
    if (!day) return null;
    return mapSeason(region, seasonOf(day).id);
  }
  // ---------- 每张图一个主色调 ----------
  tintAmbient(amb, e) {
    const base = super.tintAmbient(amb, e) || amb,
      h = LOOK41.on ? hueOf(e?.s?.region) : null;
    return h ? base.map((v, i) => clamp255(v * h[i])) : base;
  }
  indoorAmbient(e) {
    const base = super.indoorAmbient(e) || [146, 152, 168],
      h = LOOK41.on ? hueOf(e?.s?.region) : null;
    return h ? base.map((v, i) => clamp255(v * h[i])) : base;
  }
  // ---------- 走路 8 帧、站着的小动作 ----------
  // 站着时的小动作（按位：1 吸气、2 眨眼、4 往旁边看）；t 是站了多久（或者这一刻），ph 是这个人的节奏
  idleBits(ph, t = this.time) {
    if (this.calm) return 0;
    const u = t + ph * 7.3;
    return (u % IDLE.breath < IDLE.breath / 2 ? 1 : 0) | ((u + ph * 2.1) % IDLE.blink < IDLE.blinkFor ? 2 : 0) | ((u + ph * 5.7) % IDLE.glance < IDLE.glanceFor ? 4 : 0);
  }
  // 别人（居民、帮工、商人……）：走着 8 帧，站着有小动作
  personFrame(look, key, facing, moving, working = false) {
    const { dir, flip } = dirFromAngle(facing ?? Math.PI / 2),
      ph = phaseOf(key),
      pose = working ? "work" : "walk";
    if (moving) {
      const k = Math.floor(this.time * WALK_FPS * (8 / 9) + ph * 8) % 8;
      return { canvas: personSprite(look, key, dir, k >> 1, pose, k & 1), flip };
    }
    return { canvas: personSprite(look, key, dir, 0, pose, 0, working ? 0 : this.idleBits(ph)), flip };
  }
  // 自己：走着 8 帧（每秒 18 帧，和原来每秒 9 帧走 4 帧一样快）；站定 0.6 秒以后有小动作
  playerStep(e, walking, pose) {
    const now = this.time || 0;
    if (walking) {
      this._fStill = null;
      const k = Math.floor((e.moveTime || now) * WALK_FPS) % 8;
      return { frame: k >> 1, sub: k & 1, idle: 0 };
    }
    if (this._fStill == null || now < this._fStill) this._fStill = now;
    const still = now - this._fStill,
      idle = pose === "walk" && !e.paused && still > IDLE.still ? this.idleBits(0.37, still - IDLE.still) : 0;
    return { frame: 0, sub: 0, idle };
  }
  // 感染者：8 帧，快慢和原来一样
  zombieStep(z, speed) {
    const k = Math.floor((this.time || 0) * speed * 2 + (z.x + z.y) * 0.02) % 8;
    return { frame: k >> 1, sub: k & 1 };
  }
  // ---------- 旧图集里的小图换成新画的 ----------
  sprite(index, x, y, w = 48, h = w, anchor = true, alpha = 1, flip = false) {
    if (this.v && !this._mute && !(this.hideCropIcons && CROP_ICONS.has(index))) {
      const cv = oldArtCanvas("sprite", index);
      if (cv) return this.fourProp(cv, x, y, anchor, alpha, flip);
    }
    return super.sprite(index, x, y, w, h, anchor, alpha, flip);
  }
  atlas(index, x, y, w, h, alpha = 1) {
    if (this.v && !this._mute) {
      const cv = oldArtCanvas("atlas", index);
      if (cv) return this.fourProp(cv, x, y, true, alpha);
    }
    return super.atlas(index, x, y, w, h, alpha);
  }
  frontierSprite(index, x, y, w, h, ...rest) {
    if (this.v && !this._mute) {
      const cv = oldArtCanvas("frontier", index);
      if (cv) return this.fourProp(cv, x, y, true, rest[0] ?? 1);
    }
    return super.frontierSprite(index, x, y, w, h, ...rest);
  }
  // 旧画法的位置：anchor 时 (x, y) 是脚底中心，不然是正中；新画的按美术像素放大两倍画
  fourProp(cv, x, y, anchor = true, alpha = 1, flip = false) {
    this.px(cv, x, anchor === false ? y + cv.height : y, { alpha: alpha ?? 1, flip: !!flip });
  }
  // 换了时节：画好了的别的地图也在后台按新时节重画（当前这张 artFor 自己会重画）
  fourRebakeAll() {
    for (const [region, art] of this.arts || []) {
      if (!art) continue;
      const want = this.artSeason(region);
      if ((art.season ?? null) !== want) this.rebake(region, want);
    }
  }
}
