// 新画面（样张）：农场换成真像素底图、新的人物和作物、建筑和物件，一天四段的光影，看得见的天气。
// 其他地图暂时还是原来的画法；设置里可以切回原来的画面。
import { Renderer as GardenRenderer } from "./garden-renderer.js";
import { CROPS, BUILDINGS, ITEMS } from "./data.js";
import { PAL, makeCanvas } from "./pixel-kit.js";
import { bakeFarm, puddleSpots } from "./pixel-farm.js";
import { personSprite, lookFor, PLAYER_LOOK, dirFromAngle, cropSprite, soilSprite, iconSprite, debrisSprite, shadowSprite, gardenSprite } from "./pixel-sprites.js";
import { buildingArt, objectArt, flameArt, carryArt } from "./pixel-props.js";
import { LightMap, Particles, Weather, ambientFor, nightness, FIRE, LAMP, WARM, SCREEN, EMBER, FIREFLY } from "./pixel-light.js";

const KEY = "ember-farm-visual-v1";
export const VIS = { on: true, preview: { minute: null, weather: null } };
try {
  if (globalThis.localStorage?.getItem(KEY) === "off") VIS.on = false;
} catch {
  /* 读不到就用默认的新画面 */
}
export function setVisual(on) {
  VIS.on = !!on;
  try {
    globalThis.localStorage?.setItem(KEY, on ? "on" : "off");
  } catch {
    /* 存不了也照常切换 */
  }
  globalThis.document?.body?.classList?.toggle("vis-on", VIS.on);
}
const FONT = '"Fusion Pixel", "Microsoft YaHei", sans-serif';
try {
  globalThis.document?.body?.classList?.toggle("vis-on", VIS.on);
} catch {
  /* 测试环境里没有页面 */
}

export class Renderer extends GardenRenderer {
  constructor(canvas, assets) {
    super(canvas, assets);
    this.farmOrig = assets?.farm || null;
    this.lightMap = new LightMap();
    this.fx = new Particles();
    this.wx = new Weather();
    this.v = false;
    this.farmArt = null;
    this.spawn = {};
    this.late = [];
  }
  ensureFarm() {
    if (this.farmArt === false) return false;
    if (!this.farmArt) {
      try {
        const f = bakeFarm();
        if (!f.canvas) throw new Error("no canvas");
        this.farmArt = f;
        this.puddles = puddleSpots(f.map);
      } catch (err) {
        this.farmArt = false;
        if (globalThis.console) console.warn("new farm art unavailable", err);
        return false;
      }
    }
    return true;
  }
  // ---------- 每帧 ----------
  draw(engine, mouse, dt = 0.016) {
    const s = engine.s;
    this.v = VIS.on && s.region === "farm" && this.ensureFarm();
    this.calm = !!s.settings?.access?.calm;
    // 样张里的“画面预览”只改画面上的时间和天气，不动存档
    this.vMinute = VIS.preview.minute ?? s.minute;
    this.vWeather = VIS.preview.weather ?? s.weather;
    if (this.assets) {
      if (!this.farmOrig) this.farmOrig = this.assets.farm;
      this.assets.farm = this.v ? this.farmCanvas(s) : this.farmOrig;
    }
    this.late = [];
    if (this.v) this.stepFx(engine, Math.min(0.1, dt));
    super.draw(engine, mouse, dt);
  }
  farmCanvas(s) {
    const base = this.farmArt.canvas;
    if (this.vWeather !== "高温" || this.calm) return base;
    // 热浪：底图一条条横向轻轻扭动
    if (!this.heat) {
      this.heat = makeCanvas(base.width, base.height);
      this.heatAt = -1;
    }
    if (!this.heat) return base;
    const t = Math.floor(this.time * 10);
    if (t !== this.heatAt) {
      this.heatAt = t;
      const c = this.heat.getContext("2d");
      c.clearRect(0, 0, base.width, base.height);
      for (let y = 0; y < base.height; y += 2) {
        const dx = Math.round(Math.sin(y * 0.09 + this.time * 3.2) * 0.8);
        c.drawImage(base, 0, y, base.width, 2, dx, y, base.width, 2);
      }
    }
    return this.heat;
  }
  cameraScale(s) {
    const base = super.cameraScale(s);
    if (!this.v) return base;
    const dpr = this.dpr || 1,
      px = Math.max(1, Math.round(base * 2 * dpr));
    return px / (2 * dpr);
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
    const c = this.ctx,
      px = size > 15 ? 24 : 12;
    c.font = `${px}px ${FONT}`;
    c.textAlign = center ? "center" : "left";
    c.textBaseline = "middle";
    c.shadowBlur = 0;
    const X = Math.round(x),
      Y = Math.round(y);
    c.fillStyle = "#140f0b";
    c.fillText(label, X + 1, Y);
    c.fillText(label, X - 1, Y);
    c.fillText(label, X, Y + 1);
    c.fillText(label, X, Y - 1);
    c.fillText(label, X + 1, Y + 1);
    c.fillStyle = color;
    c.fillText(label, X, Y);
  }
  _pixelBadge(label, x, y, color = "#d8cb92") {
    const c = this.ctx;
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
      key = this._obj?.id || this._obj?.name || (role || "npc") + Math.round(x / 50),
      look = lookFor(key, role),
      f = this.personFrame(look, key, facing, moving);
    this.pxShadow(x, y, 18);
    this.px(f.canvas, x, y, { flip: f.flip, alpha, foot: 1 });
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
    this.px(personSprite(PLAYER_LOOK, "player", dir, frame, pose), p.x, p.y, { flip, alpha, foot: 1 });
    this.muted(() => super.drawPlayer(e));
  }
  drawObject(o, e) {
    if (!this.v) return super.drawObject(o, e);
    const art = objectArt(o.type);
    if (art) {
      this.pxShadow(o.x, o.y, Math.min(34, art.w * 1.4));
      this.px(art.canvas, o.x, o.y + 4);
      if (art.screen) this.late.push({ kind: "screen", x: o.x, y: o.y + 4, art });
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
  labelsAllowed(x, y) {
    if (this.labelScope === "building") return this.buildingLabels;
    return super.labelsAllowed(x, y);
  }
  drawBuilding(b, e) {
    if (!this.v) return super.drawBuilding(b, e);
    const d = BUILDINGS[b.type],
      art = d ? buildingArt(b.type, b.rotation % 2 === 1) : null;
    if (!art) return super.drawBuilding(b, e);
    const broken = b.hp <= 0,
      p = e.s.player,
      near = Math.hypot(p.x - b.x, p.y - b.y) < 110;
    if (b.type !== "floor") {
      this.pxShadow(b.x, b.y, Math.min(60, art.w * 1.5));
      this.px(art.canvas, b.x, b.y + 4, { alpha: broken ? 0.45 : b.open ? 0.6 : 1 });
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
  drawLivingCrop(plot, e) {
    if (!this.v) return super.drawLivingCrop(plot, e);
    if (!plot.crop || !CROPS[plot.crop]) return;
    const ratio = plot.growth / CROPS[plot.crop].grow,
      stage = Math.min(3, Math.floor(ratio * 4)),
      ripe = ratio >= 1,
      sway = ripe && !this.calm ? Math.round(Math.sin(this.time * 2.2 + plot.id * 1.7) * 0.6) : 0;
    this.px(cropSprite(plot.crop, stage), plot.x, plot.y + 8, { dx: sway });
    if (ripe) this.late.push({ kind: "ripe", x: plot.x, y: plot.y, id: plot.id });
    else if (!e.plotWatered(plot)) this.late.push({ kind: "thirsty", x: plot.x, y: plot.y, id: plot.id });
  }
  drawFarm(e) {
    if (this.v) this.wx.drawPuddles(this.ctx, this.puddles || [], this.time, ambientFor(this.vMinute, this.vWeather), ["小雨", "暴雨", "酸雨"].includes(this.vWeather));
    super.drawFarm(e);
  }
  // 菜地的状态：肥力边、盖布、杂草、菜青虫、乌鸦爪印（和原来的一样，只是画成像素）
  drawGarden(e) {
    if (!this.v) return super.drawGarden(e);
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
  drawOldLandmark(e) {
    if (this.v) return;
    return super.drawOldLandmark(e);
  }
  drawWeather(e) {
    if (this.v) return;
    return super.drawWeather(e);
  }
  // ---------- 光影 ----------
  collectLights(e, night) {
    const s = e.s,
      lights = [],
      flick = (seed) => (this.calm ? 1 : 0.88 + 0.12 * Math.sin(this.time * 9 + seed) * Math.sin(this.time * 5.3 + seed * 2));
    if (night > 0.05) {
      for (const b of s.buildings || []) {
        if (b.hp <= 0) continue;
        if (b.type === "cook") lights.push({ x: b.x - 10, y: b.y - 8, r: 170 * flick(b.x), color: FIRE, power: 0.9 });
        else if (b.type === "stove") lights.push({ x: b.x, y: b.y - 12, r: 120 * flick(b.y), color: FIRE, power: 0.75 });
        else if (b.type === "lamp" && (e.c?.energy || 0) > 0) lights.push({ x: b.x + 8, y: b.y - 20, r: 130, color: LAMP, power: 0.95 });
        else if (b.type === "tower") lights.push({ x: b.x, y: b.y - 90, r: 90, color: LAMP, power: 0.6 });
        else if (["canner", "breeder", "solar", "drone", "coop", "lure"].includes(b.type)) lights.push({ x: b.x, y: b.y - 10, r: 36, color: WARM, power: 0.45 });
      }
      for (const l of this.farmArt.lights) {
        if (l.kind === "window") lights.push({ x: l.x * 2, y: l.y * 2 + 26, r: l.dim ? 40 : 66, color: WARM, power: l.dim ? 0.5 : 0.85, flat: 0.55 });
        if (l.kind === "lantern") lights.push({ x: l.x * 2, y: l.y * 2 + 10, r: 86 * flick(3), color: LAMP, power: 0.9 });
      }
      for (const o of e.objects || []) if (o.type === "sign") lights.push({ x: o.x, y: o.y - 30, r: 34, color: SCREEN, power: 0.55 });
      for (const m of this.farmArt.embers) lights.push({ x: m.x * 2, y: m.y * 2, r: 14 * flick(m.x), color: EMBER, power: 0.5 });
      for (const f of this.fx.list) if (f.kind === "firefly") lights.push({ x: f.x, y: f.y, r: 16, color: FIREFLY, power: 0.4 });
      // 自己身边总留一小圈光，夜里也看得清人物
      const p = s.player,
        torch = e.qty?.("flashlight") ? 170 : 96;
      lights.push({ x: p.x, y: p.y - 18, r: torch, color: [176, 160, 132], power: 0.5 });
    }
    return lights;
  }
  drawNight(e) {
    if (!this.v) return super.drawNight(e);
    const c = this.ctx,
      s = e.s,
      sc = this.camera.scale,
      view = { x: this.camera.x, y: this.camera.y, w: this.w / sc, h: this.h / sc },
      night = nightness(this.vMinute),
      weather = this.vWeather,
      raining = ["小雨", "暴雨", "酸雨"].includes(weather);
    // 受光照的一层：烟、叶子、尘土，然后是雨
    this.fx.draw(c, "world", this.time);
    this.wx.drawSplashes(c, view, weather, this.time, this.calm);
    this.wx.drawRain(c, view, weather, this.time, this.calm);
    this.wx.drawMist(c, view, weather, this.time, this.calm);
    // 环境色 + 灯光，用“正片叠底”压到整个画面上
    let amb = ambientFor(this.vMinute, weather);
    if (this.wx.flash > 0) amb = amb.map((v) => Math.round(v + (255 - v) * this.wx.flash * 0.85));
    const lit = this.lightMap.render(view, amb, this.collectLights(e, night));
    if (lit) {
      c.save();
      c.imageSmoothingEnabled = false;
      c.globalCompositeOperation = "multiply";
      c.drawImage(lit.canvas, lit.x, lit.y, lit.w, lit.h);
      c.restore();
    }
    if (weather === "高温" && night < 0.3) {
      c.save();
      c.globalCompositeOperation = "screen";
      c.fillStyle = "rgba(255,236,190,0.16)";
      c.fillRect(view.x, view.y, view.w, view.h);
      c.restore();
    }
    // 自己发光的东西：窗户、火苗、灯泡、终端屏幕、余烬、火星和萤火虫
    this.drawEmissive(e, night);
    this.fx.draw(c, "glow", this.time);
    if (this.wx.flash > 0.4) {
      c.fillStyle = `rgba(235,240,255,${(this.wx.flash - 0.4) * 0.5})`;
      c.fillRect(view.x, view.y, view.w, view.h);
    }
    // 作物的状态小图标：放在最上面，夜里也看得清
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
  }
  drawEmissive(e, night) {
    const c = this.ctx,
      t = this.time;
    // 窗户和门灯
    if (night > 0.3)
      for (const l of this.farmArt.lights) {
        c.fillStyle = l.kind === "lantern" ? "#ffe2a0" : `rgba(255,206,120,${0.55 + 0.35 * night})`;
        if (l.kind === "window") {
          const w = l.w * 2,
            h = l.h * 2,
            X = l.x * 2 - w / 2,
            Y = l.y * 2 - h / 2;
          c.fillRect(X, Y, w, h);
          c.fillStyle = "rgba(122,74,40,.9)";
          c.fillRect(X + w / 2 - 1, Y, 2, h);
          c.fillRect(X, Y + h / 2 - 1, w, 2);
        } else c.fillRect(l.x * 2 - 2, l.y * 2 - 4, 6, 8);
      }
    for (const m of this.late) {
      if (m.kind === "screen") {
        const sc = m.art.screen,
          X = Math.round((m.x - m.art.w) / 2) * 2 + (sc.x - sc.w / 2) * 2,
          Y = Math.round((m.y - m.art.h * 2) / 2) * 2 + (sc.y - sc.h / 2) * 2;
        c.fillStyle = `rgba(110,210,140,${0.35 + 0.4 * night})`;
        c.fillRect(X, Y + 2, sc.w * 2, sc.h * 2 - 2);
        c.fillStyle = "#c9f5d2";
        const lines = Math.floor(t * 2) % 3;
        for (let k = 0; k <= lines; k++) c.fillRect(X + 2, Y + 4 + k * 4, 6 + ((k * 7) % 12), 2);
      }
      if (m.kind !== "build") continue;
      const { b, art } = m,
        top = b.y + 4 - art.h * 2,
        left = b.x - art.w;
      if (art.fire) this.px(flameArt(this.calm ? 0 : Math.floor(t * 9) % 3, true), left + art.fire.x * 2, top + art.fire.y * 2 + 2);
      if (art.stove) this.px(flameArt(this.calm ? 1 : (Math.floor(t * 7) + 1) % 3, false), left + art.stove.x * 2, top + art.stove.y * 2 + 6, { alpha: 0.9 });
      if (art.lamp && (b.type !== "lamp" || (e.c?.energy || 0) > 0) && night > 0.2) {
        c.fillStyle = "#ffe7a8";
        c.fillRect(left + art.lamp.x * 2 - 2, top + art.lamp.y * 2 - 4, 6, 8);
      }
      if (art.glow && night > 0.2) {
        c.fillStyle = art.glow.color;
        c.globalAlpha = this.calm ? 0.9 : 0.6 + 0.4 * Math.sin(t * 2 + b.x);
        c.fillRect(left + art.glow.x * 2, top + art.glow.y * 2, 2, 2);
        c.globalAlpha = 1;
      }
    }
    // 烧过的地里的余烬
    if (night > 0.25)
      for (const [i, m] of this.farmArt.embers.entries()) {
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
      R = () => fx.rand(),
      minute = this.vMinute,
      weather = this.vWeather,
      night = nightness(minute),
      raining = ["小雨", "暴雨", "酸雨"].includes(weather),
      wind = weather === "暴雨" ? 50 : raining ? 18 : 8;
    this.wx.update(dt, weather, this.calm);
    this.duskShadow = minute > 960 && minute < 1140 && !raining ? Math.min(1, (minute - 960) / 120) : 0;
    if (e.paused) return;
    fx.update(dt, wind);
    // 篝火：火星和烟
    for (const b of s.buildings || []) {
      if (b.type !== "cook" || b.hp <= 0) continue;
      const fireX = b.x - 34 + 22 + 2,
        fireY = b.y + 4 - 48 + 32;
      for (let i = this.every("spark" + b.id, this.calm ? 0.6 : 0.16, dt); i > 0; i--)
        fx.add({ x: fireX + (R() - 0.5) * 10, y: fireY - 6, vx: (R() - 0.5) * 18, vy: -36 - R() * 34, t: 0, life: 0.7 + R() * 0.6, color: R() > 0.5 ? "#f6b05a" : "#ffdb8c", layer: "glow", wind: 0.4, kind: "spark" });
      for (let i = this.every("smoke" + b.id, raining ? 0.8 : 0.45, dt); i > 0; i--)
        fx.add({ x: fireX + (R() - 0.5) * 6, y: fireY - 14, vx: 4, vy: -16 - R() * 8, t: 0, life: 2.6 + R(), color: "#8a8478", alpha: 0.32, size: 2, grow: 1.2, wind: 1, kind: "smoke" });
    }
    // 烟囱
    const ch = this.farmArt.chimney;
    for (let i = this.every("chimney", 0.6, dt); i > 0; i--) fx.add({ x: ch.x * 2 + (R() - 0.5) * 6, y: ch.y * 2, vx: 3, vy: -14 - R() * 6, t: 0, life: 3.2, color: "#9a948a", alpha: 0.28, size: 2, grow: 1.5, wind: 1, kind: "smoke" });
    // 萤火虫：夜里、不下雨时，在池塘和草边
    const flies = fx.list.filter((p) => p.kind === "firefly").length;
    if (night > 0.55 && !raining && flies < 22 && this.every("fly", 0.35, dt)) {
      const spots = [[1240, 700, 220, 110], [180, 760, 260, 120], [1250, 230, 220, 110], [640, 840, 260, 90]],
        [cx, cy, rx, ry] = spots[Math.floor(R() * spots.length)];
      fx.add({ x: cx + (R() - 0.5) * rx * 2, y: cy + (R() - 0.5) * ry * 2, vx: (R() - 0.5) * 14, vy: (R() - 0.5) * 10, t: 0, life: 6 + R() * 6, color: "#dcfa8c", layer: "glow", blink: this.calm ? 0 : 2.2 + R() * 2, phase: R() * 6, kind: "firefly", wind: 0.1 });
    }
    // 白天偶尔飘下来的树叶
    if (night < 0.4 && !raining && this.every("leaf", 1.4, dt)) {
      const view = { x: this.camera.x, y: this.camera.y, w: this.w / this.camera.scale };
      fx.add({ x: view.x + R() * view.w, y: view.y - 10, vx: 10 + R() * 10, vy: 16 + R() * 10, t: 0, life: 6, color: R() > 0.5 ? "#e5823a" : "#c4ab68", alpha: 0.85, kind: "leaf", wind: 0.6 });
    }
    // 高温时的浮尘
    if (weather === "高温" && this.every("dust", 0.12, dt)) {
      const view = { x: this.camera.x, y: this.camera.y, w: this.w / this.camera.scale, h: this.h / this.camera.scale };
      fx.add({ x: view.x + R() * view.w, y: view.y + R() * view.h, vx: 14 + R() * 8, vy: -4, t: 0, life: 3, color: "#efe2b4", alpha: 0.45, kind: "dust", wind: 0.3 });
    }
    // 走路扬起的土
    const p = s.player;
    if (e.walking && this.every("step", 0.2, dt)) for (let k = 0; k < 2; k++) fx.add({ x: p.x + (R() - 0.5) * 12, y: p.y - 2, vx: (R() - 0.5) * 16, vy: -8 - R() * 6, t: 0, life: 0.45, color: raining ? "#3a2a20" : "#c4ab68", alpha: 0.55, kind: "dust" });
    // 浇水的水花
    if (e.actionAnim > 0 && e.currentItem?.() === "water" && this.every("splash", 0.05, dt)) {
      const a = p.facing || 0;
      fx.add({ x: p.x + Math.cos(a) * 34 + (R() - 0.5) * 10, y: p.y - 16 + Math.sin(a) * 20, vx: (R() - 0.5) * 30, vy: 30 + R() * 30, t: 0, life: 0.35, color: "#a9cfbd", grav: 200, kind: "water" });
    }
  }
}
