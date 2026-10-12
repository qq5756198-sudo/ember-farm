// 新画面：十五张地图都换成真像素底图，人物、感染者、作物、建筑和物件都是新画的，
// 一天四段的光影、看得见的天气（雨、雪、雾、热浪），界面换成像素字体和木头锈铁的样子。
// v0.22.0 起只有这一套画面（原来的“新/旧画面”开关去掉了；以前存下的“旧画面”偏好不再生效，存档不受影响）。
import { Renderer as GardenRenderer } from "./garden-renderer.js";
import { CROPS, BUILDINGS, ITEMS, WORLD, REGIONS } from "./data.js";
import { PAL, makeCanvas, nearestPal, Pix, cached } from "./pixel-kit.js";
import { RAMP, pine } from "./pixel-build.js";
import { boat } from "./pixel-things.js";
import { bakeMap, hasMapArt } from "./pixel-maps.js";
import { farmQueries } from "./pixel-farm.js";
import { pixelSheets } from "./pixel-sheets.js";
import { personSprite, lookFor, PLAYER_LOOK, dirFromAngle, cropSprite, soilSprite, iconSprite, debrisSprite, shadowSprite, gardenSprite, zombieSprite } from "./pixel-sprites.js";
import { buildingArt, objectArt, flameArt, carryArt } from "./pixel-props.js";
import { LightMap, Particles, Weather, ambientFor, nightness, FIRE, LAMP, WARM, SCREEN, EMBER, FIREFLY } from "./pixel-light.js";

export const VIS = Object.freeze({ on: true });
const FONT = '"Fusion Pixel", "Microsoft YaHei", sans-serif';
const RAIN = ["小雨", "暴雨", "酸雨"];
const SNOW = ["小雪", "大雪"];
const ZOMBIE_ICONS = new Set([16, 17, 18, 19, 20, 21, 22, 23, 58, 59]);
// 田的编号：农场是数字，溪谷是字符串（valley-0-3），动画和变化要用数字
const plotSeed = (p) => (typeof p.id === "number" ? p.id : Math.round((p.x || 0) * 0.13 + (p.y || 0) * 0.07));
// 这几种颜色有含义（色弱配色、偷盗时的“背后/侧面/正面”眼睛、瞄准线），不换成调色板
const KEEP_COLORS = new Set(["#4aa3ff", "#f0a040", "#8fd07a", "#e9c05a", "#e9806e", "#ff4a3a", "#ff8a7a"]);
// 边境的点：读它的状态（和边境画法里的写法一样）
const pointState = (e, id) => e.bpoint?.(id) || e.b?.points?.[id] || {};
// 修好的地方夜里会亮（条件和原来一样）
function beyondLit(o, e) {
  const st = pointState(e, o.pointId),
    flags = st.flags || {},
    energy = (e.c?.energy || 0) > 0;
  if (o.pointId === "shipyard_fog") return st.choice === "lamp" && energy;
  if (o.pointId === "shelter_signals") return !!flags.repair;
  if (o.pointId === "shelter_housing") return !!flags.repair && !!pointState(e, "shelter_air").flags?.service;
  if (o.pointId === "frost_weather") return !!flags.repair && energy;
  if (o.pointId === "frost_bearing") return !!flags.survey && energy;
  if (o.pointId === "pinewood_lodge" || o.pointId === "frost_inn") return !!e.b?.modules?.includes(o.pointId + ":warm");
  return false;
}
// 林场林地上的树桩和松树（画一次存起来）
const stumpSprite = () =>
  cached("forest-stump", () => {
    const P = new Pix(15, 9);
    P.rect(3, 3, 9, 5, PAL.soil[1]);
    P.ellipse(7, 3, 4.5, 2, PAL.straw[2]);
    P.ellipse(7, 3, 2.5, 1, PAL.soil[3]);
    P.set(2, 7, PAL.soil[0]);
    P.set(12, 7, PAL.soil[0]);
    return P.toCanvas();
  });
const pineSprite = (seed, s) => cached("forest-pine:" + seed + ":" + s, () => pine(seed, s).toCanvas());
const GREEN = new Set(["farm", "residential", "valley", "pinewood", "archive", "quarantine", "hospital", "courtyard", "stationMarket"]);
// 颜色的明暗，0 黑 1 白；认不出的颜色当亮色
function lightness(color) {
  const m = /^#([0-9a-f]{6})/i.exec(String(color));
  if (!m) return 1;
  const n = parseInt(m[1], 16);
  return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}
try {
  globalThis.document?.body?.classList?.toggle("vis-on", VIS.on);
} catch {
  /* 测试环境里没有页面 */
}

// ---------- 旧画法的颜色换成调色板里的颜色 ----------
// 只换不太鲜艳的颜色（原来的绿灰、土黄这些）；鲜艳的颜色——危险提示、色弱模式的蓝和橙——原样保留。
const palCache = new Map();
function parseColor(v) {
  let m = /^#([0-9a-f]{3,8})$/i.exec(v);
  if (m) {
    let h = m[1];
    if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
    if (h.length !== 6 && h.length !== 8) return null;
    return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length === 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
  }
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(v);
  if (m) return [+m[1], +m[2], +m[3], m[4] == null ? 1 : +m[4]];
  return null;
}
export function palColor(v) {
  if (typeof v !== "string") return v;
  let out = palCache.get(v);
  if (out !== undefined) return out;
  out = v;
  const c = KEEP_COLORS.has(v.slice(0, 7).toLowerCase()) ? null : parseColor(v);
  if (c) {
    const [r, g, b, a] = c,
      max = Math.max(r, g, b) / 255,
      min = Math.min(r, g, b) / 255,
      l = (max + min) / 2,
      sat = max === min ? 0 : (max - min) / (1 - Math.abs(2 * l - 1));
    if (sat < 0.55) {
      const p = nearestPal(r, g, b);
      out = a >= 1 ? `rgb(${p[0]},${p[1]},${p[2]})` : `rgba(${p[0]},${p[1]},${p[2]},${a})`;
    }
  }
  if (palCache.size < 4000) palCache.set(v, out);
  return out;
}
function installPalette(r) {
  const ctx = r.ctx;
  if (!ctx) return;
  for (const prop of ["fillStyle", "strokeStyle"]) {
    let proto = Object.getPrototypeOf(ctx),
      d = null;
    while (proto && !(d = Object.getOwnPropertyDescriptor(proto, prop))) proto = Object.getPrototypeOf(proto);
    if (!d?.set || !d?.get) continue;
    try {
      Object.defineProperty(ctx, prop, {
        configurable: true,
        get() {
          return d.get.call(this);
        },
        set(v) {
          d.set.call(this, r.vMap ? palColor(v) : v);
        },
      });
    } catch {
      /* 换不了颜色就照原样画 */
    }
  }
}

const SHEET_KEYS = ["sprites", "expansion", "frontier"];

// ---------- 后台画底图（v0.25）：全局一个 Worker，载入页一开就能先画当前这张，进游戏后再一张张画去得了的 ----------
// 浏览器不支持（没有 Worker 或 OffscreenCanvas）就返回 null，由调用的地方在主线程画。
// 页面一开（index.html 里那一小段）就已经让后台开始画当前那张了：接过来接着用。
let bakeW; // undefined：还没试过；null：用不了
const bakeWaiting = new Map(),
  bakeReady = new Map(); // 已经画好、还没人来拿的
function bakeWorker() {
  if (bakeW !== undefined) return bakeW;
  bakeW = null;
  const early = globalThis.__emberEarlyBake;
  if (early) globalThis.__emberEarlyBake = undefined;
  try {
    if (typeof Worker === "undefined" || typeof OffscreenCanvas === "undefined" || typeof document === "undefined" || early?.failed) {
      early?.worker?.terminate?.();
      return null;
    }
    const w = early?.worker || new Worker(new URL("./bake-worker.js", import.meta.url), { type: "module" });
    // 页面一开就交给它的那张已经在画了，不用再发一次
    if (early?.worker && early.region) bakeWaiting.set(early.region, []);
    w.onmessage = (ev) => bakeFinish(ev.data?.region, ev.data);
    w.onerror = () => {
      // 这台浏览器跑不了：以后都在主线程画
      w.terminate?.();
      bakeW = null;
      for (const region of [...bakeWaiting.keys()]) bakeFinish(region, null);
    };
    bakeW = w;
    for (const msg of early?.msgs || []) bakeFinish(msg?.region, msg);
  } catch {
    early?.worker?.terminate?.();
    bakeW = null;
  }
  return bakeW;
}
function bakeFinish(region, msg) {
  const list = bakeWaiting.get(region);
  bakeWaiting.delete(region);
  if (list?.length) for (const done of list) done(msg);
  else if (msg?.ok && region) bakeReady.set(region, msg);
  else msg?.bitmap?.close?.();
}
// 这台浏览器能不能在后台画
export function canBakeAway() {
  return !!(VIS.on && bakeWorker());
}
// 让后台画一张；返回 Promise（画好的消息，失败是 null），用不了 Worker 时返回 null
export function bakeAway(region) {
  if (!VIS.on || !hasMapArt(region)) return null;
  const w = bakeWorker();
  if (!w) return null;
  if (bakeReady.has(region)) {
    const msg = bakeReady.get(region);
    bakeReady.delete(region);
    return Promise.resolve(msg);
  }
  return new Promise((done) => {
    const list = bakeWaiting.get(region);
    if (list) return list.push(done);
    bakeWaiting.set(region, [done]);
    try {
      w.postMessage({ region });
    } catch {
      bakeFinish(region, null);
    }
  });
}
// 后台一直不回话（浏览器卡住了 Worker）时不能一直等：过了这么久就当画不了，在主线程画
const patience = (job, ms) => Promise.race([job, new Promise((done) => setTimeout(() => done(null), ms))]);
// 后台画好的消息变回底图：图片画进一张画布，农场的“是不是水面”“地面种类”按地面种类表重新接上
function artFromMsg(region, msg) {
  const bitmap = msg?.bitmap;
  if (!msg?.ok || !bitmap) {
    bitmap?.close?.();
    return null;
  }
  let art = null;
  try {
    const cv = makeCanvas(bitmap.width, bitmap.height),
      c = cv?.getContext("2d");
    if (c) {
      c.drawImage(bitmap, 0, 0);
      art = { ...msg.art, canvas: cv };
      if (region === "farm") Object.assign(art, farmQueries(art.map));
    }
  } catch {
    art = null;
  }
  bitmap.close?.();
  return art;
}

export class Renderer extends GardenRenderer {
  constructor(canvas, assets) {
    super(canvas, assets);
    // 照原样记下（旧画法的地区底图是用到时才画的，这里不能把它们都叫出来）
    this.orig = assets ? Object.defineProperties({}, Object.getOwnPropertyDescriptors(assets)) : {};
    this.swapped = null;
    this.arts = new Map();
    this.sheets = null;
    this.lightMap = new LightMap();
    this.fx = new Particles();
    this.wx = new Weather();
    this.v = false;
    this.art = null;
    this.mood = {};
    this.spawn = {};
    this.late = [];
    installPalette(this);
    // 一开始就把小图集换好，界面上的物品格子第一次画出来就是像素版
    if (VIS.on) this.applyAssets(true, null);
  }
  // 某张地图的新底图（第一次进去时才画）
  artFor(region) {
    if (!hasMapArt(region)) return null;
    if (!this.arts.has(region)) {
      let art = null;
      try {
        art = bakeMap(region);
        if (!art?.canvas) art = null;
      } catch (err) {
        art = null;
        if (globalThis.console) console.warn("new map art unavailable", region, err);
      }
      this.arts.set(region, art || false);
    }
    return this.arts.get(region) || null;
  }
  // 载入页还没关的时候先把当前地图画好，进游戏时不再卡一下。
  // 给了 job（载入一开始就交给后台画的那张）就等它画好；后台画不了再在这里画。
  prepare(region, job = null) {
    if (!VIS.on || !region) return;
    if (!job) return void this.artFor(region);
    return patience(job, 6000).then((msg) => {
      if (this.arts.has(region)) return;
      const art = artFromMsg(region, msg);
      if (art) this.arts.set(region, art);
      else this.artFor(region);
    });
  }
  // v0.25：别的地图在后台先画好（Worker + OffscreenCanvas），进图时不再卡；浏览器不支持就在空闲时一张张画
  prebake(regions = []) {
    if (!VIS.on) return;
    const want = regions.filter((r) => hasMapArt(r) && !this.arts.has(r));
    this.bakeQueue = [...new Set([...(this.bakeQueue || []), ...want])].filter((r) => !this.arts.has(r));
    this.pumpBake();
  }
  pumpBake() {
    if (this.baking || !this.bakeQueue?.length) return;
    const region = this.bakeQueue.shift();
    if (this.arts.has(region)) return this.pumpBake();
    this.baking = region;
    const job = bakeAway(region);
    if (job) {
      patience(job, 15000).then((msg) => {
        if (!this.arts.has(region)) {
          const art = artFromMsg(region, msg);
          // 后台画不了这张：留给空闲时在主线程画
          if (!art) return this.idleBake(region);
          this.arts.set(region, art);
        } else msg?.bitmap?.close?.();
        this.baking = null;
        this.pumpBake();
      });
      return;
    }
    this.idleBake(region);
  }
  waitBake(region) {
    if (!hasMapArt(region) || this.arts.has(region) || !canBakeAway()) {
      this._wait = null;
      return false;
    }
    const now = globalThis.performance?.now?.() ?? Date.now();
    if (this._wait?.region !== region) {
      this._wait = { region, since: now };
      // 插到最前面
      this.bakeQueue = [region, ...(this.bakeQueue || []).filter((r) => r !== region)];
      this.pumpBake();
    }
    return now - this._wait.since < 1500;
  }
  drawVeil(dt) {
    this.time += dt;
    const c = this.ctx,
      dpr = this.dpr || 1;
    c.setTransform(dpr, 0, 0, dpr, 0, 0);
    c.fillStyle = "#0e0c0a";
    c.fillRect(0, 0, this.w, this.h);
  }
  idleBake(region) {
    const idle = globalThis.requestIdleCallback ? (fn) => globalThis.requestIdleCallback(fn, { timeout: 4000 }) : (fn) => setTimeout(fn, 300);
    idle(() => {
      try {
        this.artFor(region);
      } finally {
        this.baking = null;
        this.pumpBake();
      }
    });
  }
  // 感染者用新画法时，旧画法加在身上的护甲片、腿的线条就不画了
  get newEnemyArt() {
    return this.v;
  }
  // 兼容旧的调用：农场底图
  ensureFarm() {
    return !!this.artFor("farm");
  }
  get farmArt() {
    return this.arts.get("farm") || null;
  }
  // 新画面时把底图和三张小图集换成像素版，切回原画面时换回来
  applyAssets(on, region) {
    const a = this.assets;
    if (!a) return;
    if (on && !this.sheets) {
      this.sheets = pixelSheets(this.orig);
      if (this.sheets?.spritesUrl) {
        try {
          globalThis.document?.body?.style?.setProperty("--vis-sprites", `url("${this.sheets.spritesUrl}")`);
        } catch {
          /* 没有页面时不用管 */
        }
      }
    }
    for (const k of SHEET_KEYS) {
      if (!(k in this.orig)) continue;
      const sheet = on && this.sheets ? this.sheets[k] : null;
      a[k] = sheet || this.orig[k];
    }
    // 当前地图的底图换成新画的；离开时把上一张换回原来的（原来的是按需画的就还是按需画）
    const key = REGIONS[region]?.asset,
      want = on && this.art && key ? key : null;
    if (this.swapped && this.swapped !== want) {
      const d = Object.getOwnPropertyDescriptor(this.orig, this.swapped);
      if (d) Object.defineProperty(a, this.swapped, d);
      this.swapped = null;
    }
    if (want) {
      Object.defineProperty(a, want, { value: this.mapCanvas(), writable: true, enumerable: true, configurable: true });
      this.swapped = want;
    }
  }
  // ---------- 每帧 ----------
  draw(engine, mouse, dt = 0.016) {
    const s = engine.s,
      region = s.region;
    // 刚走进一张后台还没画好的地图：先暗一下等它（最多 1.5 秒），不在这一帧里整张画、卡住
    if (VIS.on && this.waitBake(region)) return this.drawVeil(dt);
    const art = VIS.on ? this.artFor(region) : null;
    this.lastRegion = region;
    this.v = !!art;
    this.art = art;
    this.mood = art?.mood || {};
    this.indoor = !!this.mood.indoor;
    this.vMap = this.v;
    this.applyAssets(VIS.on, region);
    this.calm = !!s.settings?.access?.calm;
    const raw = s.weather;
    this.vMinute = s.minute;
    this.vWeather = this.indoor ? "晴朗" : this.mood.snowy ? (raw === "暴雨" || raw === "酸雨" ? "大雪" : "小雪") : raw;
    this.late = [];
    this._textQueue = [];
    this._ghost = null;
    // 场景里的字（名字、提示、飘字）等光照画完再写，夜里也看得清
    this._deferText = this.v;
    if (this.v) this.stepFx(engine, Math.min(0.1, dt));
    try {
      super.draw(engine, mouse, dt);
    } finally {
      this._deferText = false;
      this.vMap = false;
    }
  }
  mapCanvas() {
    const base = this.art.canvas;
    if (this.vWeather !== "高温" || this.calm || this.indoor) return base;
    // 热浪：底图一条条横向轻轻扭动
    if (!this.heat || this.heat.width !== base.width) {
      this.heat = makeCanvas(base.width, base.height);
      this.heatAt = -1;
      this.heatOf = null;
    }
    if (!this.heat) return base;
    const t = Math.floor(this.time * 10);
    if (t !== this.heatAt || this.heatOf !== base) {
      this.heatAt = t;
      this.heatOf = base;
      const c = this.heat.getContext("2d");
      c.clearRect(0, 0, base.width, base.height);
      for (let y = 0; y < base.height; y += 2) {
        const dx = Math.round(Math.sin(y * 0.09 + this.time * 3.2) * 0.8);
        c.drawImage(base, 0, y, base.width, 2, dx, y, base.width, 2);
      }
    }
    return this.heat;
  }
  // 像素按整数倍放大才不会一格大一格小；差得太多（或者会露出地图外面）时就用原来的缩放，保证“场景缩放”设置有效
  cameraScale(s) {
    const base = super.cameraScale(s);
    if (!this.v) return base;
    const dpr = this.dpr || 1,
      snapped = Math.max(1, Math.round(base * 2 * dpr)) / (2 * dpr);
    if (Math.abs(snapped - base) / base > 0.08) return base;
    if (this.w / snapped > WORLD.w + 1 || this.h / snapped > WORLD.h + 1) return base;
    return snapped;
  }
  snapCamera() {
    if (!this.v) return;
    const k = this.camera.scale * (this.dpr || 1);
    this.camera.x = Math.round(this.camera.x * k) / k;
    this.camera.y = Math.round(this.camera.y * k) / k;
  }
  // ---------- 文字 ----------
  get pixelText() {
    return VIS.on ? this._pixelText : null;
  }
  get pixelBadge() {
    return VIS.on ? this._pixelBadge : null;
  }
  _pixelText(label, x, y, color = "#e6e5c7", size = 12, center = true) {
    const c = this.ctx;
    if (this._deferText) {
      const m = c.getTransform(),
        a = c.globalAlpha;
      this._textQueue.push(() => {
        c.save();
        c.setTransform(m);
        c.globalAlpha = a;
        this._pixelText(label, x, y, color, size, center);
        c.restore();
      });
      return;
    }
    const px = size > 15 ? 24 : 12;
    c.font = `${px}px ${FONT}`;
    c.textAlign = center ? "center" : "left";
    c.textBaseline = "middle";
    c.shadowBlur = 0;
    const X = Math.round(x),
      Y = Math.round(y);
    // 深色字（写在浅色气泡上的）不描黑边，不然糊成一团
    if (lightness(color) > 0.42) {
      c.fillStyle = "#140f0b";
      c.fillText(label, X + 1, Y);
      c.fillText(label, X - 1, Y);
      c.fillText(label, X, Y + 1);
      c.fillText(label, X, Y - 1);
      c.fillText(label, X + 1, Y + 1);
    }
    c.fillStyle = color;
    c.fillText(label, X, Y);
  }
  _pixelBadge(label, x, y, color = "#d8cb92") {
    const c = this.ctx;
    if (this._deferText) {
      const m = c.getTransform(),
        a = c.globalAlpha;
      this._textQueue.push(() => {
        c.save();
        c.setTransform(m);
        c.globalAlpha = a;
        const was = this._deferText;
        this._deferText = false;
        this._pixelBadge(label, x, y, color);
        this._deferText = was;
        c.restore();
      });
      return;
    }
    c.font = `12px ${FONT}`;
    const w = Math.round(c.measureText(label).width + 16),
      X = Math.round(x - w / 2),
      Y = Math.round(y - 11);
    c.fillStyle = "#140f0bcc";
    c.fillRect(X - 1, Y - 1, w + 2, 24);
    c.fillStyle = "#2a1f17ee";
    c.fillRect(X, Y, w, 22);
    c.fillStyle = "#94502c";
    c.fillRect(X, Y, w, 2);
    c.fillStyle = "#4a3c30";
    c.fillRect(X, Y + 20, w, 2);
    this._pixelText(label, x, y + 1, color, 12);
  }
  // ---------- 像素小图 ----------
  px(canvas, x, y, { flip = false, alpha = 1, foot = 0, dx = 0 } = {}) {
    if (!canvas) return;
    const c = this.ctx,
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
      c.drawImage(canvas, 0, 0, w, h);
    } else c.drawImage(canvas, X, Y, w, h);
    c.restore();
  }
  pxShadow(x, y, w = 20) {
    const rx = Math.max(4, Math.round(w / 2.2)),
      s = shadowSprite(rx);
    if (!s) return;
    const dusk = this.duskShadow || 0,
      c = this.ctx,
      W = s.width * 2,
      H = s.height * 2;
    c.save();
    c.imageSmoothingEnabled = false;
    c.drawImage(s, Math.round((x - W / 2 + 2 + dusk * 6) / 2) * 2, Math.round((y - H / 2 + 1) / 2) * 2, W + Math.round(dusk * 12) * 2, H);
    c.restore();
  }
  sprite(index, x, y, w, h, anchor, alpha, flip) {
    if (this._mute) return;
    if (this.v && this._enemy && ZOMBIE_ICONS.has(index)) return this.drawZombie(this._enemy, x, y, alpha ?? 1);
    if (this.v && (index === 56 || index === 57) && anchor !== false) return this.drawVillager(this._obj, x, y, alpha ?? 1, index);
    return super.sprite(index, x, y, w, h, anchor, alpha, flip);
  }
  atlas(...args) {
    if (this._mute) return;
    return super.atlas(...args);
  }
  frontierSprite(...args) {
    if (this._mute) return;
    return super.frontierSprite(...args);
  }
  shadow(x, y, w = 24) {
    if (this._mute) return;
    if (this.v) return this.pxShadow(x, y, w);
    return super.shadow(x, y, w);
  }
  muted(fn) {
    const was = this._mute;
    this._mute = true;
    try {
      return fn();
    } finally {
      this._mute = was;
    }
  }
  // ---------- 人 ----------
  personFrame(look, key, facing, moving, working = false) {
    const { dir, flip } = dirFromAngle(facing ?? Math.PI / 2),
      frame = moving ? Math.floor(this.time * 8) % 4 : 0;
    return { canvas: personSprite(look, key, dir, frame, working ? "work" : "walk"), flip };
  }
  drawVillager(o, x, y, alpha = 1, index = 56) {
    const e = this.sceneEngine || this.labelEngine,
      r = o?.resident ? (e?.s.colony?.residents || []).find((a) => a.id === o.resident) : null,
      role = r?.workRole || r?.role || (o?.type === "trader" ? "trader" : null),
      key = o?.resident || o?.id || o?.name || "npc" + index,
      moving = !!(r?.target && Math.hypot(r.x - r.target.x, r.y - r.target.y) > 8),
      look = lookFor(key, role);
    const f = this.personFrame(look, key, r?.facing ?? Math.PI / 2, moving);
    this.pxShadow(x, y, 18);
    this.px(f.canvas, x, y, { flip: f.flip, alpha, foot: 1 });
  }
  person(sheet, x, y, facing = Math.PI / 2, moving = false, alpha = 1) {
    if (!this.v) return super.person(sheet, x, y, facing, moving, alpha);
    const role = sheet && sheet === this.helperSheet?.() ? "helper" : sheet && sheet === this.raiderSheet?.() ? "raider" : null,
      key = this._obj?.id || this._obj?.name || (this._enemy?.id != null ? "foe" + this._enemy.id : role || "npc"),
      look = lookFor(key, role),
      f = this.personFrame(look, key, facing, moving);
    this.pxShadow(x, y, 18);
    this.px(f.canvas, x, y, { flip: f.flip, alpha, foot: 1 });
  }
  // 感染者：按种类、朝向画，走路 4 帧；被打中时半透明（和原来一样）
  drawEnemy(z, e) {
    if (!this.v) return super.drawEnemy(z, e);
    const prev = this._enemy;
    this._enemy = z;
    try {
      return super.drawEnemy(z, e);
    } finally {
      this._enemy = prev;
    }
  }
  drawZombie(z, x, y, alpha = 1) {
    const type = z.type in { slow: 1, runner: 1, screamer: 1, armor: 1, elite: 1 } ? z.type : "slow",
      { dir, flip } = dirFromAngle(z.facing ?? Math.PI / 2),
      speed = type === "runner" ? 10 : type === "elite" ? 4 : 6,
      frame = Math.floor(this.time * speed + (z.x + z.y) * 0.01) % 4;
    this.pxShadow(x, y, type === "elite" ? 34 : 20);
    this.px(zombieSprite(type, dir, frame), x, y, { flip, alpha, foot: 1 });
  }
  drawHelper(o, e) {
    if (!this.v) return super.drawHelper(o, e);
    const h = (e.sc?.helpers || []).find((x) => x.id === o.helper);
    if (!h) return;
    const moving = !!(h.target && Math.hypot(h.x - h.target.x, h.y - h.target.y) > 8),
      look = lookFor(o.helper, "helper"),
      f = this.personFrame(look, "helper:" + o.helper, h.facing || 0, moving);
    this.pxShadow(o.x, o.y, 18);
    this.px(f.canvas, o.x, o.y, { flip: f.flip, foot: 1 });
    if (h.task === "carry" && moving) this.px(carryArt("box"), o.x, o.y - 28 + (Math.floor(this.time * 8) % 2) * 2);
    if (h.task === "meal" && !moving) this.px(carryArt("bowl"), o.x + 14, o.y - 22);
    this.text(o.name, o.x, o.y - 76, "#9fc6e8", 12);
    if (Math.hypot(e.s.player.x - o.x, e.s.player.y - o.y) < 220) this.text(h.status, o.x, o.y - 92, "#b8d4b1", 10);
  }
  drawPlayer(e) {
    if (!this.v) return super.drawPlayer(e);
    const p = e.s.player,
      walking = !!e.walking && !e.paused,
      { dir, flip } = dirFromAngle(p.facing),
      frame = walking ? Math.floor((e.moveTime || this.time) * 9) % 4 : 0,
      pose = e.actionAnim > 0 ? "work" : "walk",
      alpha = e.invulnerable > 0 && Math.floor(e.invulnerable * 12) % 2 === 0 ? 0.45 : 1;
    this.pxShadow(p.x, p.y, 20);
    // 背对镜头时手里的工具在身后，先画工具再画人
    if (dir === "up") this.muted(() => super.drawPlayer(e));
    this.px(personSprite(PLAYER_LOOK, "player", dir, frame, pose), p.x, p.y, { flip, alpha, foot: 1 });
    if (dir !== "up") this.muted(() => super.drawPlayer(e));
  }
  drawObject(o, e) {
    if (!this.v) return super.drawObject(o, e);
    const art = objectArt(o.type);
    if (art) {
      // 人走到门、牌子、储物点后面时，这些东西变淡，看得见人（和原来一样）
      const p = e.s.player,
        behind = art.h > 14 && p.y < o.y && p.y > o.y - art.h * 2 - 10 && Math.abs(p.x - o.x) < art.w + 6;
      this.pxShadow(o.x, o.y, Math.min(34, art.w * 1.4));
      this.px(art.canvas, o.x, o.y + 4, { alpha: behind ? 0.42 : 1 });
      if (art.screen) this.late.push({ kind: "screen", x: o.x, y: o.y + 4, art });
      if (art.lamp) this.late.push({ kind: "objLamp", x: o.x, y: o.y + 4, art });
      this.muted(() => super.drawObject(o, e));
      return;
    }
    const prev = this._obj;
    this._obj = o;
    try {
      return super.drawObject(o, e);
    } finally {
      this._obj = prev;
    }
  }
  // 边境的储物点、出口、去下一张图的门
  drawWayPoint(o, e) {
    if (!this.v) return super.drawWayPoint(o, e);
    if (this._mute) return;
    const art = objectArt(o.type);
    if (art) this.px(art.canvas, o.x, o.y + 4);
  }
  labelsAllowed(x, y) {
    if (this.labelScope === "building") return this.buildingLabels;
    return super.labelsAllowed(x, y);
  }
  drawBuilding(b, e) {
    if (!this.v) return super.drawBuilding(b, e);
    const d = BUILDINGS[b.type],
      art = d ? buildingArt(b.type, b.rotation % 2 === 1, !!b.open) : null;
    if (!art) return super.drawBuilding(b, e);
    // 稻草人和火炉原来是另画的，新画法下只保留它们的字
    if (b.type === "scarecrow" || b.type === "stove") return this.drawOwnBuilding(b, e, d, art);
    const broken = b.hp <= 0,
      p = e.s.player,
      near = Math.hypot(p.x - b.x, p.y - b.y) < 110;
    if (b.type !== "floor") {
      this.pxShadow(b.x, b.y, Math.min(60, art.w * 1.5));
      this.px(art.canvas, b.x, b.y + 4, { alpha: broken ? 0.45 : 1 });
    }
    // 会发光的部件留到光照之后再画，夜里才显得亮
    if (!broken) this.late.push({ kind: "build", b, art });
    const scope = this.labelScope;
    this.labelScope = "building";
    this.buildingLabels = near;
    try {
      this.muted(() => super.drawBuilding(b, e));
    } finally {
      this.labelScope = scope;
    }
    if (d && b.hp < d.hp && !broken) {
      const c = this.ctx,
        w = 40,
        X = Math.round((b.x - w / 2) / 2) * 2,
        Y = Math.round((b.y - art.h * 2 - 8) / 2) * 2;
      c.fillStyle = "#140f0b";
      c.fillRect(X - 2, Y - 2, w + 4, 8);
      c.fillStyle = "#4a3c30";
      c.fillRect(X, Y, w, 4);
      c.fillStyle = b.hp / d.hp < 0.35 ? "#d2654c" : "#aab258";
      c.fillRect(X, Y, Math.round((w * b.hp) / d.hp / 2) * 2, 4);
    }
  }
  drawOwnBuilding(b, e, d, art) {
    const broken = b.hp <= 0,
      p = e.s.player;
    this.pxShadow(b.x, b.y, Math.min(60, art.w * 1.5));
    this.px(art.canvas, b.x, b.y + 4, { alpha: broken ? 0.45 : 1 });
    if (!broken) this.late.push({ kind: "build", b, art });
    if (b.type === "scarecrow" && b.hp < 20) this.text("要修", b.x, b.y - 72, "#f3b4a5", 11);
    if (b.type === "stove" && Math.hypot(p.x - b.x, p.y - b.y) < 200) this.text(d.name + (this.stoveLit(b, e) ? "" : " · 熄火"), b.x, b.y - 74, this.stoveLit(b, e) ? "#f3d27a" : "#c9c2a8", 12);
    if (d.hp && b.hp < d.hp && !broken) {
      const c = this.ctx,
        w = 40,
        X = Math.round((b.x - w / 2) / 2) * 2,
        Y = Math.round((b.y - art.h * 2 - 8) / 2) * 2;
      c.fillStyle = "#140f0b";
      c.fillRect(X - 2, Y - 2, w + 4, 8);
      c.fillStyle = "#4a3c30";
      c.fillRect(X, Y, w, 4);
      c.fillStyle = b.hp / d.hp < 0.35 ? "#d2654c" : "#aab258";
      c.fillRect(X, Y, Math.round((w * b.hp) / d.hp / 2) * 2, 4);
    }
  }
  // 寒潮里火炉要点着才有火（和原来的条件一样）
  stoveLit(b, e) {
    const wi = e.w?.winter;
    return b.hp > 0 && (!wi || !["prep", "cold"].includes(wi.phase) || !!wi.lit);
  }
  // 联盟终端：新画的牌子本身就是终端，只留来信的提示灯和字
  drawTerminal(o, e) {
    if (!this.v) return super.drawTerminal(o, e);
    const alert = e.sc?.unread || e.canReply?.();
    if (!alert) return;
    if (this.calm || Math.floor(this.time * 3) % 2 === 0) {
      const c = this.ctx;
      c.fillStyle = "#1c140f";
      c.fillRect(o.x + 12, o.y - 70, 8, 8);
      c.fillStyle = "#f2c35e";
      c.fillRect(o.x + 14, o.y - 68, 4, 4);
    }
    if (Math.hypot(o.x - e.s.player.x, o.y - e.s.player.y) < 190) this.badge(e.canReply?.() ? "可以回信" : "新来信", o.x, o.y - 82, "#f2d48b");
  }
  // 援建营地空地：木桩和小旗已经画在新图里，只留名字
  drawCampSite(o, e) {
    if (!this.v) return super.drawCampSite(o, e);
    if (Math.hypot(o.x - e.s.player.x, o.y - e.s.player.y) < 160) this.badge("援建营地空地", o.x, o.y - 64, "#e6d6a3");
  }
  // 雾松林场的三片林地：长着松树，或者砍过只剩树桩
  drawForestPlot(i, x, y, cut, selected) {
    if (!this.v) return super.drawForestPlot(i, x, y, cut, selected);
    if (cut) {
      for (const [dx, dy] of [[-10, 2], [8, -2], [22, 8], [2, 12]]) {
        this.pxShadow(x + dx + 2, y + dy, 12);
        this.px(stumpSprite(), x + dx, y + dy);
      }
    } else {
      for (const [dx, dy, s] of [[0, 0, 1], [30, 12, 0.8], [-22, 14, 0.85]]) {
        const tree = pineSprite(i * 7 + Math.round(s * 10), s);
        this.pxShadow(x + dx, y + dy, 18);
        this.px(tree, x + dx, y + dy);
      }
    }
    if (selected) {
      const c = this.ctx;
      c.fillStyle = "#aab258";
      c.fillRect(Math.round((x - 26) / 2) * 2, y + 20, 64, 4);
    }
  }
  // 远程武器的准星：等光照画完再画，夜里也看得清
  drawCrosshair(engine, mouse) {
    if (!this.v) return super.drawCrosshair(engine, mouse);
    this._cross = mouse;
  }
  drawCrossNow() {
    const m0 = this._cross;
    this._cross = null;
    if (!m0) return;
    const c = this.ctx,
      m = this.worldPoint(m0.x, m0.y),
      X = Math.round(m.x / 2) * 2,
      Y = Math.round(m.y / 2) * 2;
    c.fillStyle = "#140f0b";
    for (const [dx, dy, w, h] of [[-15, -1, 8, 4], [8, -1, 8, 4], [-1, -15, 4, 8], [-1, 8, 4, 8]]) c.fillRect(X + dx, Y + dy, w, h);
    c.fillStyle = "#f1e3c2";
    for (const [dx, dy, w, h] of [[-14, 0, 6, 2], [9, 0, 6, 2], [0, -14, 2, 6], [0, 9, 2, 6]]) c.fillRect(X + dx, Y + dy, w, h);
    c.fillStyle = "#f6b05a";
    c.fillRect(X, Y, 2, 2);
  }
  // 原来的交互椭圆圈换成新的虚线圈（光照之后画）
  drawNearEllipse(engine) {
    if (!this.v) return super.drawNearEllipse(engine);
  }
  // 建造时跟着鼠标的虚影：用新画法、跟着旋转，等光照画完再画，夜里也看得清
  drawBuildGhost(engine, mouse) {
    if (!this.v) return super.drawBuildGhost(engine, mouse);
    this._ghost = { engine, mouse };
  }
  drawGhostNow() {
    const g = this._ghost;
    if (!g) return;
    const { engine, mouse } = g,
      c = this.ctx,
      type = engine.buildMode,
      target = this.worldPoint(mouse.x, mouse.y),
      x = Math.round(target.x / 8) * 8,
      y = Math.round(target.y / 8) * 8,
      rect = engine.buildingRect(type, x, y),
      reason = engine.buildReason(type, x, y),
      art = buildingArt(type, (engine.rotation || 0) % 2 === 1);
    c.fillStyle = reason ? "rgba(210,101,76,.28)" : "rgba(170,178,88,.28)";
    c.fillRect(Math.round(rect.x / 2) * 2, Math.round(rect.y / 2) * 2, Math.round(rect.w / 2) * 2, Math.round(rect.h / 2) * 2);
    c.strokeStyle = reason ? "#d2654c" : "#aab258";
    c.lineWidth = 2;
    c.strokeRect(Math.round(rect.x / 2) * 2, Math.round(rect.y / 2) * 2, Math.round(rect.w / 2) * 2, Math.round(rect.h / 2) * 2);
    if (art) this.px(art.canvas, x, y + 4, { alpha: 0.72 });
    else super.sprite(BUILDINGS[type].icon, x, y, 60, 60, true, 0.6);
    this._pixelBadge(reason || "左键放置 · Q 旋转 · 右键取消", x, y + 25, reason ? "#f1b4a2" : "#e2e8b8");
  }
  // 交互圈：光照之后再描一遍
  drawNearRing(e) {
    const near = e.nearestObject?.();
    if (!near || e.paused) return;
    const c = this.ctx,
      rx = near.type === "plot" ? 22 : 28;
    c.save();
    c.globalAlpha = 0.75 + 0.25 * Math.sin(this.time * 4);
    c.fillStyle = "#f6b05a";
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 14) c.fillRect(Math.round((near.x + Math.cos(a) * rx) / 2) * 2, Math.round((near.y + 3 + Math.sin(a) * 10) / 2) * 2, 2, 2);
    c.restore();
  }
  // 水渠与生态区的格子：画成真的沟渠、水、草地、树苗、湿地
  drawCanalCell(x, y, state, i = 0) {
    if (!this.v) return super.drawCanalCell(x, y, state, i);
    const c = this.ctx,
      X = Math.round(x / 2) * 2,
      Y = Math.round(y / 2) * 2;
    if (state === "none") {
      c.fillStyle = "rgba(42,28,18,.35)";
      c.fillRect(X, Y, 4, 2);
      c.fillRect(X + 22, Y + 24, 4, 2);
      return;
    }
    c.fillStyle = "#3a2519";
    c.fillRect(X - 2, Y - 2, 30, 30);
    c.fillStyle = state === "flow" ? "#2e5e5e" : "#553522";
    c.fillRect(X, Y, 26, 26);
    c.fillStyle = state === "flow" ? "#46807a" : "#704a2f";
    c.fillRect(X, Y, 26, 4);
    if (state === "flow") {
      c.fillStyle = "#a9cfbd";
      const k = this.calm ? 0 : Math.floor(this.time * 4 + i) % 3;
      c.fillRect(X + 4 + k * 6, Y + 10, 6, 2);
      c.fillRect(X + 12 - k * 2, Y + 18, 8, 2);
    }
  }
  drawEcoCell(x, y, t, i = 0) {
    if (!this.v) return super.drawEcoCell(x, y, t, i);
    const c = this.ctx,
      X = Math.round(x / 2) * 2,
      Y = Math.round(y / 2) * 2,
      fill = !t.clean ? ["#4a3c30", "#625244"] : { grass: ["#4c632d", "#667d36"], forest: ["#364a24", "#4c632d"], wetland: ["#2e5e5e", "#46807a"], field: ["#704a2f", "#8d6340"], empty: ["#7d6a3a", "#a28a4e"] }[t.type] || ["#4c632d", "#667d36"];
    c.fillStyle = fill[0];
    c.fillRect(X, Y, 26, 26);
    c.fillStyle = fill[1];
    for (let k = 0; k < 5; k++) c.fillRect(X + ((k * 11 + i * 5) % 22), Y + ((k * 7 + i * 3) % 22), 4, 2);
    if (!t.clean) {
      c.fillStyle = "#8e3a20";
      c.fillRect(X + 8, Y + 10, 4, 2);
      c.fillRect(X + 16, Y + 16, 2, 2);
    }
    if (t.type === "forest") {
      c.fillStyle = "#26331d";
      c.fillRect(X + 11, Y + 14, 4, 10);
      c.fillStyle = "#667d36";
      c.fillRect(X + 5, Y + 2, 16, 12);
      c.fillStyle = "#869843";
      c.fillRect(X + 7, Y + 2, 8, 4);
    }
    if (t.type === "wetland") {
      c.fillStyle = "#869843";
      for (const dx of [4, 10, 18]) c.fillRect(X + dx, Y + 8, 2, 10);
      c.fillStyle = "#553522";
      c.fillRect(X + 10, Y + 6, 2, 4);
    }
  }
  // ---------- 田 ----------
  drawPlot(p, engine) {
    if (!this.v) return super.drawPlot(p, engine);
    if (p.tilled) {
      const s = soilSprite(engine.plotWatered(p), p.id % 3);
      if (s) this.ctx.drawImage(s, Math.round((p.x - 20) / 2) * 2, Math.round((p.y - 20) / 2) * 2, 40, 40);
    } else {
      // 没开垦的格子：四个角上一点点记号
      const c = this.ctx,
        X = Math.round((p.x - 18) / 2) * 2,
        Y = Math.round((p.y - 18) / 2) * 2;
      c.fillStyle = "rgba(42,28,18,.55)";
      for (const [dx, dy] of [[0, 0], [32, 0], [0, 32], [32, 32]]) {
        c.fillRect(X + dx, Y + dy, 4, 2);
        c.fillRect(X + dx + (dx ? 2 : 0), Y + dy, 2, 4);
      }
    }
    if (p.crop && p.trait) this.text(({ early: "早", abundant: "丰", hardy: "旱" })[p.trait] || "", p.x - 13, p.y - 17, "#eed786", 12);
  }
  // 溪谷试验田的种植位：和农场一样的耕地；净化带是一格长着青草的土
  drawValleyPlot(p, e) {
    if (!this.v) return super.drawValleyPlot(p, e);
    const c = this.ctx;
    if (p.buffer) {
      const X = Math.round((p.x - 18) / 2) * 2,
        Y = Math.round((p.y - 18) / 2) * 2;
      c.fillStyle = "#3a2519";
      c.fillRect(X - 2, Y - 2, 40, 40);
      c.fillStyle = "#4c632d";
      c.fillRect(X, Y, 36, 36);
      c.fillStyle = "#869843";
      for (let k = 0; k < 8; k++) c.fillRect(X + ((k * 13) % 32), Y + ((k * 7) % 30) + 2, 2, 4);
    } else {
      const s = soilSprite(e.valleyWatered(p), plotSeed(p) % 3);
      if (s) c.drawImage(s, Math.round((p.x - 20) / 2) * 2, Math.round((p.y - 20) / 2) * 2, 40, 40);
    }
    this.valleyPlotLabel(p, e);
  }
  drawLivingCrop(plot, e) {
    if (!this.v) return super.drawLivingCrop(plot, e);
    if (!plot.crop || !CROPS[plot.crop]) return;
    const ratio = plot.growth / CROPS[plot.crop].grow,
      stage = Math.min(3, Math.floor(ratio * 4)),
      ripe = ratio >= 1,
      seed = plotSeed(plot),
      sway = ripe && !this.calm ? Math.round(Math.sin(this.time * 2.2 + seed * 1.7) * 0.6) : 0;
    this.px(cropSprite(plot.crop, stage), plot.x, plot.y + 8, { dx: sway });
    const watered = e.s.region === "valley" ? e.valleyWatered?.(plot) : e.plotWatered(plot);
    if (ripe) this.late.push({ kind: "ripe", x: plot.x, y: plot.y, id: seed });
    else if (!watered) this.late.push({ kind: "thirsty", x: plot.x, y: plot.y, id: seed });
  }
  drawFarm(e) {
    if (this.v) this.drawPuddles();
    super.drawFarm(e);
  }
  drawRuins(e) {
    if (this.v) {
      this.drawPuddles();
      if (e.s.region === "market") this.marketTables();
      if (e.s.region === "shipyard" || e.s.region === "archive") this.drawWaterLife(e);
    }
    return super.drawRuins(e);
  }
  // 船坞和档案岛四周的水：一道道亮纹；河水清理过后更清；渡船开通后有船来回
  drawWaterLife(e) {
    const c = this.ctx,
      t = this.calm ? 0 : this.time,
      clean = !!e.b?.benefits?.cleanRiver;
    c.fillStyle = clean ? "#a9cfbd" : "#6fa69a";
    for (let i = 0; i < 42; i++) {
      const x = i % 2 ? 1479 + (i % 3) * 8 : 29 + (i % 4) * 11,
        y = Math.round(((i * 67 + t * 9) % 960) / 2) * 2 + 20;
      c.fillRect(x, y, 12 + (i % 4) * 4, 2);
    }
    for (let k = 0; k < 15; k++) c.fillRect(100 + k * 93, Math.round((967 + Math.sin(k + t * 0.7) * 4) / 2) * 2, 22, 2);
    if (e.s.region === "shipyard" && pointState(e, "shipyard_ferry").flags?.service) {
      const ferry = cached("ferry", () => {
        const P = new Pix(52, 20);
        boat(P, 26, 18, 42, RAMP.light, false);
        return P.toCanvas();
      });
      this.px(ferry, 240 + ((this.time * 16) % 1000), 984);
    }
  }
  // 集市路口两张摆货的木桌（原来的货就摆在这两处）
  marketTables() {
    const c = this.ctx;
    for (const [x0, x1, y] of [[592, 738, 444], [984, 1046, 566]]) {
      c.fillStyle = "rgba(20,15,11,.4)";
      c.fillRect(x0 + 6, y + 8, x1 - x0, 6);
      c.fillStyle = "#3a2519";
      c.fillRect(x0 + 4, y, 4, 12);
      c.fillRect(x1 - 8, y, 4, 12);
      c.fillStyle = "#1c140f";
      c.fillRect(x0 - 2, y - 14, x1 - x0 + 4, 16);
      c.fillStyle = "#8d6340";
      c.fillRect(x0, y - 12, x1 - x0, 12);
      c.fillStyle = "#ad8258";
      c.fillRect(x0, y - 12, x1 - x0, 2);
      c.fillStyle = "#a8433a";
      for (let x = x0; x < x1; x += 16) c.fillRect(x, y - 2, 8, 4);
    }
  }
  drawPuddles() {
    if (this.indoor || !this.art?.puddles?.length) return;
    const w = this.wx,
      saved = w.wet;
    if (this.mood.wet) w.wet = Math.max(w.wet, 0.85);
    w.drawPuddles(this.ctx, this.art.puddles, this.time, ambientFor(this.vMinute, this.vWeather), RAIN.includes(this.vWeather));
    w.wet = saved;
  }
  // 菜地的状态：肥力边、盖布、杂草、菜青虫、乌鸦爪印（和原来的一样，只是画成像素）。
  // 这些是状态标记，等光照画完再画，夜里也看得清。
  drawGarden(e) {
    if (!this.v) return super.drawGarden(e);
    this.late.push({ kind: "garden" });
  }
  drawGardenMarks(e) {
    const c = this.ctx,
      day = e.s.day,
      color = !!e.s.settings?.access?.color;
    for (const p of e.s.plots) {
      if (!p.tilled) continue;
      const rec = e.g?.plots?.[p.id],
        f = p.fertility ?? 65,
        X = Math.round((p.x - 16) / 2) * 2,
        Y = Math.round((p.y + 16) / 2) * 2;
      if (f >= 85 || f < 30) {
        c.fillStyle = "#140f0b";
        c.fillRect(X - 2, Y - 2, 36, 6);
        c.fillStyle = f >= 85 ? (color ? "#4aa3ff" : "#aab258") : color ? "#f0a040" : "#d2654c";
        c.fillRect(X, Y, 32, 2);
      }
      if (rec?.cv >= day) this.px(gardenSprite("cloth"), p.x, p.y + 22);
      if (rec?.w) {
        this.px(gardenSprite("weed", 0), p.x - 10, p.y + 18);
        this.px(gardenSprite("weed", 1), p.x + 9, p.y + 16);
        this.px(gardenSprite("weed", 1), p.x, p.y - 8);
      }
      if (!p.crop) continue;
      for (let i = 0; i < (rec?.b || 0); i++) this.px(gardenSprite("bug", this.calm ? 0 : Math.floor(this.time * 3 + i) % 2), p.x - 8 + i * 8, p.y - 2 + (i % 2) * 8);
      for (let i = 0; i < (rec?.pk || 0); i++) this.px(gardenSprite("prints"), p.x + 8 - i * 10, p.y + 16);
    }
  }
  drawDebris(d, engine) {
    if (!this.v) return super.drawDebris(d, engine);
    this.pxShadow(d.x, d.y + 12, 16);
    this.px(debrisSprite(ITEMS[d.type] ? d.type : "scrap", Number(d.id) % 3 || 0), d.x, d.y + 14);
  }
  // ---------- 各地图上会变化的东西 ----------
  // 废墟里的封锁路障、封锁门：一排木板和铁皮
  drawBlockade(rect) {
    if (!this.v) return super.drawBlockade(rect);
    this.barricade(rect, rect.door ? "door" : "wood");
    this.text(rect.door ? "封锁门" : "封锁路障", rect.x + rect.w / 2, rect.y + rect.h / 2, "#e1c28a", 12);
  }
  // 雨巷的路障、货运站吊来的货箱
  drawDistrictBlock(r) {
    if (!this.v) return super.drawDistrictBlock(r);
    this.barricade(r, r.districtCrate ? "crate" : "wood");
  }
  barricade(r, kind) {
    const c = this.ctx,
      X = Math.round(r.x / 2) * 2,
      Y = Math.round(r.y / 2) * 2,
      W = Math.round(r.w / 2) * 2,
      H = Math.round(r.h / 2) * 2;
    c.fillStyle = "rgba(20,15,11,.45)";
    c.fillRect(X + 4, Y + H, W, 6);
    if (kind === "door") {
      c.fillStyle = "#1c140f";
      c.fillRect(X - 2, Y - 2, W + 4, H + 4);
      c.fillStyle = "#454847";
      c.fillRect(X, Y, W, H);
      c.fillStyle = "#62645d";
      for (let y = Y + 2; y < Y + H; y += 6) c.fillRect(X, y, W, 2);
      c.fillStyle = "#b9703c";
      c.fillRect(X + W / 2 - 2, Y + H / 2 - 4, 4, 8);
      return;
    }
    if (kind === "crate") {
      for (let y = Y; y < Y + H; y += 20)
        for (let x = X; x < X + W; x += 24) {
          c.fillStyle = "#1c140f";
          c.fillRect(x, y, 24, 20);
          c.fillStyle = "#8d6340";
          c.fillRect(x + 2, y + 2, 20, 16);
          c.fillStyle = "#ad8258";
          c.fillRect(x + 2, y + 2, 20, 2);
          c.fillStyle = "#704a2f";
          for (let k = 0; k < 8; k++) c.fillRect(x + 4 + k * 2, y + 4 + k * 2 - (k > 5 ? 2 : 0), 2, 2);
        }
      return;
    }
    // 木板路障：竖的木桩，横钉几块板子，中间插着几根削尖的木头
    const vertical = H > W;
    c.fillStyle = "#1c140f";
    c.fillRect(X - 2, Y - 2, W + 4, H + 4);
    c.fillStyle = "#553522";
    c.fillRect(X, Y, W, H);
    c.fillStyle = "#8d6340";
    if (vertical) for (let y = Y + 4; y < Y + H - 4; y += 14) c.fillRect(X - 2, y, W + 4, 6);
    else for (let x = X + 4; x < X + W - 4; x += 14) c.fillRect(x, Y - 2, 6, H + 4);
    c.fillStyle = "#ad8258";
    if (vertical) for (let y = Y + 4; y < Y + H - 4; y += 14) c.fillRect(X - 2, y, W + 4, 2);
    else for (let x = X + 4; x < X + W - 4; x += 14) c.fillRect(x, Y - 2, 2, H + 4);
    c.fillStyle = "#94502c";
    if (vertical) c.fillRect(X + W / 2 - 2, Y, 4, H);
    else c.fillRect(X, Y + H / 2 - 2, W, 4);
  }
  // 检修间：关着时门口一道卷帘、里面暗着；开了就只剩门框
  drawAnnex(e) {
    if (!this.v) return super.drawAnnex(e);
    const c = this.ctx,
      open = !!e.r?.annexOpen;
    if (!open) {
      c.fillStyle = "rgba(20,15,11,.42)";
      c.fillRect(1310, 820, 170, 110);
      c.fillStyle = "#1c140f";
      c.fillRect(1380, 802, 80, 20);
      c.fillStyle = "#62645d";
      c.fillRect(1382, 804, 76, 16);
      c.fillStyle = "#454847";
      for (let y = 806; y < 820; y += 4) c.fillRect(1382, y, 76, 2);
      c.fillStyle = "#f6b05a";
      for (let x = 1382; x < 1458; x += 8) c.fillRect(x, 818, 4, 2);
    } else {
      c.fillStyle = "#454847";
      c.fillRect(1378, 800, 4, 22);
      c.fillRect(1458, 800, 4, 22);
    }
    this.text(open ? "检修间 · 通信核心" : "封闭检修间", 1395, 952, "#e2d5a7", 14);
  }
  // 沉湾船坞中间的干船坞：没抽水时是一池浑水，抽干了是湿泥底、几根枕木
  drawDrainPool(e, drained) {
    if (!this.v) return super.drawDrainPool(e, drained);
    const c = this.ctx,
      X = 820,
      Y = 350,
      W = 154,
      H = 164;
    if (!drained) {
      c.fillStyle = "#1f3f43";
      c.fillRect(X, Y, W, H);
      c.fillStyle = "#2e5e5e";
      for (let y = Y + 6; y < Y + H; y += 18) c.fillRect(X + 8 + ((y / 18) % 3) * 10, y, W - 40, 2);
      c.fillStyle = "#6fa69a";
      const t = this.calm ? 0 : this.time;
      for (let k = 0; k < 6; k++) c.fillRect(Math.round((X + 10 + ((k * 37 + t * 12) % (W - 30))) / 2) * 2, Y + 14 + k * 24, 10, 2);
    } else {
      c.fillStyle = "#3a2519";
      c.fillRect(X, Y, W, H);
      c.fillStyle = "#553522";
      for (let y = Y + 4; y < Y + H; y += 8) c.fillRect(X + 2, y, W - 4, 4);
      c.fillStyle = "#1f3f43";
      c.fillRect(X + 30, Y + 60, 40, 8);
      c.fillRect(X + 90, Y + 110, 30, 6);
      c.fillStyle = "#704a2f";
      for (let x = X + 12; x < X + W - 8; x += 26) c.fillRect(x, Y + 20, 6, H - 40);
    }
  }
  // 疯长的草丛已经画在底图里了
  drawCover(r) {
    if (!this.v) return super.drawCover(r);
  }
  drawOldLandmark(e) {
    if (this.v) return;
    return super.drawOldLandmark(e);
  }
  drawDistrictDepth(e) {
    if (this.v) return;
    return super.drawDistrictDepth(e);
  }
  drawWeather(e) {
    if (this.v) return;
    return super.drawWeather(e);
  }
  // ---------- 光影 ----------
  collectLights(e, night) {
    const s = e.s,
      lights = [],
      art = this.art,
      sc = this.camera.scale,
      vx0 = this.camera.x - 160,
      vy0 = this.camera.y - 160,
      vx1 = this.camera.x + this.w / sc + 160,
      vy1 = this.camera.y + this.h / sc + 160,
      inView = (x, y) => x > vx0 && x < vx1 && y > vy0 && y < vy1,
      flick = (seed) => (this.calm ? 1 : 0.88 + 0.12 * Math.sin(this.time * 9 + seed) * Math.sin(this.time * 5.3 + seed * 2));
    if (night <= 0.05 && !this.indoor) return lights;
    if (s.region === "farm")
      for (const b of s.buildings || []) {
        if (b.hp <= 0) continue;
        if (b.type === "cook") lights.push({ x: b.x - 10, y: b.y - 8, r: 170 * flick(b.x), color: FIRE, power: 0.9 });
        else if (b.type === "stove") lights.push({ x: b.x, y: b.y - 12, r: 120 * flick(b.y), color: FIRE, power: 0.75 });
        else if (b.type === "lamp" && (e.c?.energy || 0) > 0) lights.push({ x: b.x + 8, y: b.y - 20, r: 130, color: LAMP, power: 0.95 });
        else if (b.type === "tower") lights.push({ x: b.x, y: b.y - 90, r: 90, color: LAMP, power: 0.6 });
        else if (["canner", "breeder", "solar", "drone", "coop", "lure"].includes(b.type)) lights.push({ x: b.x, y: b.y - 10, r: 36, color: WARM, power: 0.45 });
      }
    for (const l of art.lights) {
      const x = l.x * 2,
        y = l.y * 2;
      if (!inView(x, y)) continue;
      const col = l.color || LAMP;
      if (l.kind === "window") lights.push({ x, y: y + 26, r: l.dim ? 40 : 66, color: col === LAMP ? WARM : col, power: l.dim ? 0.5 : 0.85, flat: 0.55 });
      else if (l.kind === "lantern") lights.push({ x, y: y + 10, r: 86 * flick(x), color: LAMP, power: 0.9 });
      else if (l.kind === "lamp") lights.push({ x, y: y + 30, r: 112, color: col, power: 0.85, flat: 0.62 });
      else if (l.kind === "bulb") lights.push({ x, y: y + 6, r: 28, color: col, power: 0.6, small: true });
      else if (l.kind === "neon") lights.push({ x, y: y + 10, r: 54, color: col, power: 0.7, flat: 0.7 });
      else if (l.kind === "beacon") lights.push({ x, y, r: 20, color: col, power: Math.sin(this.time * 3 + x) > 0 || this.calm ? 0.8 : 0.25, small: true });
      else if (l.kind === "fire") lights.push({ x, y, r: 140 * flick(x), color: FIRE, power: 0.9 });
      else if (l.kind === "fluoro") lights.push({ x, y, r: 150, color: col, power: 0.8, flat: 0.7 });
      else if (l.kind === "grow") lights.push({ x, y, r: 60, color: col, power: 0.55 });
    }
    for (const o of e.objects || []) {
      if (o.type === "sign") lights.push({ x: o.x, y: o.y - 30, r: 34, color: SCREEN, power: 0.55 });
      else if (o.type === "beyondPoint" && beyondLit(o, e)) lights.push({ x: o.x, y: o.y - 35, r: 120, color: o.pointId === "shelter_signals" ? [190, 225, 150] : [255, 210, 150], power: 0.85 });
    }
    for (const m of art.embers) if (!m.flame && inView(m.x * 2, m.y * 2)) lights.push({ x: m.x * 2, y: m.y * 2, r: 14 * flick(m.x), color: EMBER, power: 0.5, small: true });
    for (const f of this.fx.list) if (f.kind === "firefly") lights.push({ x: f.x, y: f.y, r: 16, color: FIREFLY, power: 0.4, small: true });
    // 自己身边总留一小圈光，夜里也看得清人物；在外面探索时手电筒更要紧
    const p = s.player,
      explore = !this.indoor && !["farm", "market"].includes(s.region),
      torch = e.qty?.("flashlight") ? (explore ? 280 : 170) : explore ? 140 : 96;
    lights.push({ x: p.x, y: p.y - 18, r: torch, color: [176, 160, 132], power: explore ? 0.62 : 0.5 });
    return lights;
  }
  drawNight(e) {
    if (!this.v) return super.drawNight(e);
    const c = this.ctx,
      s = e.s,
      sc = this.camera.scale,
      view = { x: this.camera.x, y: this.camera.y, w: this.w / sc, h: this.h / sc },
      night = this.indoor ? 0.85 : nightness(this.vMinute),
      weather = this.vWeather,
      raining = RAIN.includes(weather);
    // 受光照的一层：烟、叶子、尘土，然后是雨或雪
    this.fx.draw(c, "world", this.time);
    if (!this.indoor) {
      // 雨丝不落在人和感染者身上，攻击前的提示看得清（和原来一样）
      const actors = [s.player, ...(e.enemies || []).filter((z) => !z.dead && z.x > view.x - 100 && z.x < view.x + view.w + 100 && z.y > view.y - 100 && z.y < view.y + view.h + 140)],
        clear = (x, y) => actors.some((a) => Math.abs(x - a.x) < (a.windup > 0 ? 80 : 29) && Math.abs(y - a.y + 26) < (a.windup > 0 ? 85 : 52));
      this.wx.drawSplashes(c, view, weather, this.time, this.calm);
      this.wx.drawRain(c, view, weather, this.time, this.calm, clear);
      this.wx.drawMist(c, view, weather, this.time, this.calm);
      if (SNOW.includes(weather)) this.wx.drawSnow(c, view, weather === "大雪", this.time, this.calm);
      if (this.mood.mist) this.wx.drawFog(c, view, this.time, this.calm, "#cfd8cc", night > 0.4 ? 0.6 : 1.2);
    }
    // 环境色 + 灯光，用“正片叠底”压到整个画面上
    let amb = this.indoor ? [146, 152, 168] : ambientFor(this.vMinute, weather);
    // 夜里在外面探索：四周更黑，手电筒照到的地方才看得清
    if (!this.indoor && night > 0.3 && !["farm", "market"].includes(s.region)) amb = amb.map((v) => Math.round(v * (1 - 0.25 * night)));
    // 后面的层可以给天色上一层颜色（v0.25 长夜那天天边发红）
    if (!this.indoor && this.tintAmbient) amb = this.tintAmbient(amb, e) || amb;
    if (this.wx.flash > 0 && !this.indoor) amb = amb.map((v) => Math.round(v + (255 - v) * this.wx.flash * 0.45));
    const lit = this.lightMap.render(view, amb, this.collectLights(e, night));
    if (lit) {
      c.save();
      c.imageSmoothingEnabled = false;
      c.globalCompositeOperation = "multiply";
      c.drawImage(lit.canvas, lit.x, lit.y, lit.w, lit.h);
      c.restore();
    }
    if (weather === "高温" && night < 0.3 && !this.indoor) {
      c.save();
      c.globalCompositeOperation = "screen";
      c.fillStyle = "rgba(255,236,190,0.16)";
      c.fillRect(view.x, view.y, view.w, view.h);
      c.restore();
    }
    // 自己发光的东西：窗户、火苗、灯泡、招牌、终端屏幕、余烬、火星和萤火虫
    this.drawEmissive(e, night, view);
    this.fx.draw(c, "glow", this.time);
    if (this.wx.flash > 0.6 && !this.indoor) {
      c.fillStyle = `rgba(235,240,255,${(this.wx.flash - 0.6) * 0.3})`;
      c.fillRect(view.x, view.y, view.w, view.h);
    }
    // 作物的状态小图标：放在最上面，夜里也看得清
    if (this.late.some((m) => m.kind === "garden")) this.drawGardenMarks(e);
    for (const m of this.late) {
      if (m.kind === "ripe") {
        const tw = this.calm ? 1 : 0.65 + 0.35 * Math.sin(this.time * 4 + m.id);
        this.px(iconSprite("ripe"), m.x + 13, m.y - 22, { alpha: tw });
      } else if (m.kind === "thirsty") {
        const bob = this.calm ? 0 : Math.round(Math.sin(this.time * 3 + m.id) * 1);
        this.px(iconSprite("thirsty"), m.x + 13, m.y - 14 + bob * 2, { alpha: 0.95 });
      }
    }
    if (raining) this.duskShadow = 0;
    // 场景里的字、交互圈、建造虚影放在最后
    this._deferText = false;
    for (const fn of this._textQueue) fn();
    this._textQueue = [];
    this.drawNearRing(e);
    this.drawGhostNow();
    this.drawCrossNow();
  }
  drawEmissive(e, night, view) {
    const c = this.ctx,
      t = this.time,
      art = this.art,
      vis = (x, y) => x > view.x - 40 && x < view.x + view.w + 40 && y > view.y - 40 && y < view.y + view.h + 40;
    // 窗户、门灯、路灯头、串灯、霓虹招牌、信号灯
    if (night > 0.3)
      for (const l of art.lights) {
        const x = l.x * 2,
          y = l.y * 2;
        if (!vis(x, y)) continue;
        if (l.kind === "window") {
          const w = l.w * 2,
            h = l.h * 2,
            X = Math.round((x - w / 2) / 2) * 2,
            Y = Math.round((y - h / 2) / 2) * 2;
          c.fillStyle = `rgba(255,206,120,${(l.dim ? 0.35 : 0.55) + 0.35 * night})`;
          c.fillRect(X, Y, w, h);
          c.fillStyle = "rgba(122,74,40,.9)";
          if (w >= 10) c.fillRect(X + Math.round(w / 4) * 2 - 1, Y, 2, h);
          if (h >= 10) c.fillRect(X, Y + Math.round(h / 4) * 2 - 1, w, 2);
        } else if (l.kind === "lantern" || l.kind === "lamp") {
          c.fillStyle = "#ffe2a0";
          c.fillRect(Math.round(x / 2) * 2 - 2, Math.round(y / 2) * 2 - 2, l.kind === "lamp" ? 6 : 6, 4);
        } else if (l.kind === "bulb") {
          c.fillStyle = "#ffdb8c";
          c.fillRect(Math.round(x / 2) * 2, Math.round(y / 2) * 2, 2, 2);
        } else if (l.kind === "neon") {
          const w = (l.w || 10) * 2,
            h = (l.h || 6) * 2,
            X = Math.round((x - w / 2) / 2) * 2,
            Y = Math.round((y - h / 2) / 2) * 2,
            [r, g, b] = l.color || [255, 140, 90],
            pulse = this.calm ? 1 : 0.8 + 0.2 * Math.sin(t * 2.4 + x);
          c.fillStyle = `rgba(${r},${g},${b},${0.7 * pulse})`;
          c.fillRect(X, Y, w, 2);
          c.fillRect(X, Y + h - 2, w, 2);
          c.fillRect(X, Y, 2, h);
          c.fillRect(X + w - 2, Y, 2, h);
          c.fillStyle = `rgba(${r},${g},${b},${0.35 * pulse})`;
          c.fillRect(X + 2, Y + 2, w - 4, h - 4);
        } else if (l.kind === "beacon") {
          if (!this.calm && Math.sin(t * 3 + x) < 0) continue;
          const [r, g, b] = l.color || [255, 80, 60];
          c.fillStyle = `rgb(${r},${g},${b})`;
          c.fillRect(Math.round(x / 2) * 2 - 1, Math.round(y / 2) * 2 - 1, 4, 4);
        } else if (l.kind === "grow") {
          c.fillStyle = "rgba(220,140,255,.55)";
          c.fillRect(Math.round(x / 2) * 2 - 24, Math.round(y / 2) * 2 - 8, 48, 2);
          c.fillRect(Math.round(x / 2) * 2 - 24, Math.round(y / 2) * 2 + 6, 48, 2);
        }
      }
    // 火桶里的火苗（白天也看得见）
    for (const [i, m] of art.embers.entries()) {
      if (!m.flame || !vis(m.x * 2, m.y * 2)) continue;
      this.px(flameArt(this.calm ? 0 : (Math.floor(t * 9) + i) % 3, false), m.x * 2, m.y * 2 + 2, { alpha: 0.95 });
    }
    for (const m of this.late) {
      if (m.kind === "screen") {
        const sc = m.art.screen,
          X = Math.round((m.x - m.art.w) / 2) * 2 + (sc.x - sc.w / 2) * 2,
          Y = Math.round((m.y - m.art.h * 2) / 2) * 2 + (sc.y - sc.h / 2) * 2;
        c.fillStyle = `rgba(110,210,140,${0.35 + 0.4 * night})`;
        c.fillRect(X, Y + 2, sc.w * 2, sc.h * 2 - 2);
        c.fillStyle = "#c9f5d2";
        const lines = this.calm ? 2 : Math.floor(t * 2) % 3;
        for (let k = 0; k <= lines; k++) c.fillRect(X + 2, Y + 4 + k * 4, 6 + ((k * 7) % 12), 2);
      }
      if (m.kind === "objLamp" && night > 0.3) {
        const X = Math.round((m.x - m.art.w) / 2) * 2 + m.art.lamp.x * 2,
          Y = Math.round((m.y - m.art.h * 2) / 2) * 2 + m.art.lamp.y * 2;
        c.fillStyle = "#ffe2a0";
        c.fillRect(X - 2, Y - 2, 6, 6);
      }
      if (m.kind !== "build") continue;
      const { b, art: bart } = m,
        top = b.y + 4 - bart.h * 2,
        left = b.x - bart.w;
      if (bart.fire) this.px(flameArt(this.calm ? 0 : Math.floor(t * 9) % 3, true), left + bart.fire.x * 2, top + bart.fire.y * 2 + 2);
      if (bart.stove) this.px(flameArt(this.calm ? 1 : (Math.floor(t * 7) + 1) % 3, false), left + bart.stove.x * 2, top + bart.stove.y * 2 + 6, { alpha: 0.9 });
      if (bart.lamp && (b.type !== "lamp" || (e.c?.energy || 0) > 0) && night > 0.2) {
        c.fillStyle = "#ffe7a8";
        c.fillRect(left + bart.lamp.x * 2 - 2, top + bart.lamp.y * 2 - 4, 6, 8);
      }
      if (bart.glow && night > 0.2) {
        c.fillStyle = bart.glow.color;
        c.globalAlpha = this.calm ? 0.9 : 0.6 + 0.4 * Math.sin(t * 2 + b.x);
        c.fillRect(left + bart.glow.x * 2, top + bart.glow.y * 2, 2, 2);
        c.globalAlpha = 1;
      }
    }
    // 烧过的地里的余烬
    if (night > 0.25)
      for (const [i, m] of art.embers.entries()) {
        if (m.flame) continue;
        const a = this.calm ? 0.7 : 0.35 + 0.65 * Math.max(0, Math.sin(t * (1.3 + (i % 5) * 0.3) + i));
        c.globalAlpha = a * night;
        c.fillStyle = i % 3 ? "#e5823a" : "#f6b05a";
        c.fillRect(m.x * 2, m.y * 2, 2, 2);
      }
    c.globalAlpha = 1;
  }
  // ---------- 粒子 ----------
  every(key, interval, dt) {
    this.spawn[key] = (this.spawn[key] || 0) + dt;
    let n = 0;
    while (this.spawn[key] >= interval) {
      this.spawn[key] -= interval;
      n++;
    }
    return Math.min(n, 4);
  }
  stepFx(e, dt) {
    const s = e.s,
      fx = this.fx,
      art = this.art,
      R = () => fx.rand(),
      minute = this.vMinute,
      weather = this.vWeather,
      night = this.indoor ? 0.85 : nightness(minute),
      raining = RAIN.includes(weather),
      wind = weather === "暴雨" || weather === "大雪" ? 50 : raining ? 18 : 8,
      sc = this.camera.scale || 1,
      view = { x: this.camera.x, y: this.camera.y, w: this.w / sc, h: this.h / sc },
      near = (x, y, pad = 200) => x > view.x - pad && x < view.x + view.w + pad && y > view.y - pad && y < view.y + view.h + pad;
    this.wx.update(dt, weather, this.calm);
    this.duskShadow = !this.indoor && minute > 960 && minute < 1140 && !raining ? Math.min(1, (minute - 960) / 120) : 0;
    // 换了地图就把上一张图的烟和叶子清掉
    if (this.fxRegion !== s.region) {
      this.fxRegion = s.region;
      fx.list = [];
    }
    if (e.paused) return;
    fx.update(dt, wind);
    // 篝火：火星和烟
    if (s.region === "farm")
      for (const b of s.buildings || []) {
        if (b.type !== "cook" || b.hp <= 0) continue;
        const fireX = b.x - 34 + 22 + 2,
          fireY = b.y + 4 - 48 + 32;
        for (let i = this.every("spark" + b.id, this.calm ? 0.6 : 0.16, dt); i > 0; i--)
          fx.add({ x: fireX + (R() - 0.5) * 10, y: fireY - 6, vx: (R() - 0.5) * 18, vy: -36 - R() * 34, t: 0, life: 0.7 + R() * 0.6, color: R() > 0.5 ? "#f6b05a" : "#ffdb8c", layer: "glow", wind: 0.4, kind: "spark" });
        for (let i = this.every("smoke" + b.id, raining ? 0.8 : 0.45, dt); i > 0; i--)
          fx.add({ x: fireX + (R() - 0.5) * 6, y: fireY - 14, vx: 4, vy: -16 - R() * 8, t: 0, life: 2.6 + R(), color: "#8a8478", alpha: 0.32, size: 2, grow: 1.2, wind: 1, kind: "smoke" });
      }
    // 火桶：火星和烟
    for (const [i, m] of art.embers.entries()) {
      if (!m.flame || !near(m.x * 2, m.y * 2)) continue;
      for (let k = this.every("barrel" + i, this.calm ? 0.8 : 0.25, dt); k > 0; k--)
        fx.add({ x: m.x * 2 + (R() - 0.5) * 6, y: m.y * 2 - 4, vx: (R() - 0.5) * 14, vy: -30 - R() * 26, t: 0, life: 0.6 + R() * 0.5, color: R() > 0.5 ? "#f6b05a" : "#ffdb8c", layer: "glow", wind: 0.4, kind: "spark" });
      for (let k = this.every("bsmoke" + i, 0.7, dt); k > 0; k--) fx.add({ x: m.x * 2 + (R() - 0.5) * 4, y: m.y * 2 - 10, vx: 3, vy: -14 - R() * 6, t: 0, life: 2.4, color: "#8a8478", alpha: 0.26, size: 2, grow: 1.2, wind: 1, kind: "smoke" });
    }
    // 烟囱（工厂的大烟囱冒得多）
    if (!this.indoor)
      for (const [i, ch] of art.chimneys.entries()) {
        if (!near(ch.x * 2, ch.y * 2, 400)) continue;
        const big = !!ch.big;
        for (let k = this.every("chimney" + i, big ? 0.25 : ch.small ? 1.2 : 0.6, dt); k > 0; k--)
          fx.add({ x: ch.x * 2 + (R() - 0.5) * (big ? 12 : 6), y: ch.y * 2, vx: 3, vy: -14 - R() * 6, t: 0, life: big ? 4.5 : 3.2, color: big ? "#7d7a72" : "#9a948a", alpha: big ? 0.34 : 0.28, size: big ? 3 : 2, grow: 1.5, wind: 1, kind: "smoke" });
      }
    // 地下城：灯下飘着的灰
    if (this.indoor && this.every("mote", 0.3, dt)) fx.add({ x: view.x + R() * view.w, y: view.y + R() * view.h, vx: (R() - 0.5) * 6, vy: -3 - R() * 3, t: 0, life: 5, color: "#cdd9d8", alpha: 0.35, kind: "dust", wind: 0 });
    const green = GREEN.has(s.region) && !this.indoor && !this.mood.snowy;
    // 萤火虫：夜里、不下雨时，在草地上
    const flies = fx.list.filter((p) => p.kind === "firefly").length;
    if (green && night > 0.55 && !raining && flies < 22 && this.every("fly", 0.35, dt)) {
      let x, y;
      if (s.region === "farm") {
        const spots = [[1240, 700, 220, 110], [180, 760, 260, 120], [1250, 230, 220, 110], [640, 840, 260, 90]],
          [cx, cy, rx, ry] = spots[Math.floor(R() * spots.length)];
        x = cx + (R() - 0.5) * rx * 2;
        y = cy + (R() - 0.5) * ry * 2;
      } else {
        x = view.x + R() * view.w;
        y = view.y + R() * view.h;
        const code = art.map[Math.floor(y / 2) * 768 + Math.floor(x / 2)];
        if (code !== 0 && code !== 10) x = null;
      }
      if (x != null) fx.add({ x, y, vx: (R() - 0.5) * 14, vy: (R() - 0.5) * 10, t: 0, life: 6 + R() * 6, color: "#dcfa8c", layer: "glow", blink: this.calm ? 0 : 2.2 + R() * 2, phase: R() * 6, kind: "firefly", wind: 0.1 });
    }
    // 白天偶尔飘下来的树叶
    if (green && night < 0.4 && !raining && this.every("leaf", 1.4, dt)) fx.add({ x: view.x + R() * view.w, y: view.y - 10, vx: 10 + R() * 10, vy: 16 + R() * 10, t: 0, life: 6, color: R() > 0.5 ? "#e5823a" : "#c4ab68", alpha: 0.85, kind: "leaf", wind: 0.6 });
    // 高温时的浮尘
    if (weather === "高温" && this.every("dust", 0.12, dt)) fx.add({ x: view.x + R() * view.w, y: view.y + R() * view.h, vx: 14 + R() * 8, vy: -4, t: 0, life: 3, color: "#efe2b4", alpha: 0.45, kind: "dust", wind: 0.3 });
    // 走路扬起的土（雪地里是雪沫）
    const p = s.player;
    if (e.walking && this.every("step", 0.2, dt))
      for (let k = 0; k < 2; k++) fx.add({ x: p.x + (R() - 0.5) * 12, y: p.y - 2, vx: (R() - 0.5) * 16, vy: -8 - R() * 6, t: 0, life: 0.45, color: this.mood.snowy ? "#f6f8f2" : raining || this.mood.wet ? "#3a2a20" : this.indoor ? "#85857a" : "#c4ab68", alpha: 0.55, kind: "dust" });
    // 浇水的水花
    if (e.actionAnim > 0 && e.currentItem?.() === "water" && this.every("splash", 0.05, dt)) {
      const a = p.facing || 0;
      fx.add({ x: p.x + Math.cos(a) * 34 + (R() - 0.5) * 10, y: p.y - 16 + Math.sin(a) * 20, vx: (R() - 0.5) * 30, vy: 30 + R() * 30, t: 0, life: 0.35, color: "#a9cfbd", grav: 200, kind: "water" });
    }
  }
}
