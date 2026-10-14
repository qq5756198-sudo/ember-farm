// v0.31.0「重光」的画面：地铁隧道（每层临时拼出来的底图在后台画；越往下越黑；检修梯在灯照得到的地方才看得见）；
// 检修梯、检修电梯、泵房里的光、升降井的检修平台；重建站（六盏小灯，通了哪面墙亮哪盏）和老怀表；
// 通电以后农场和集市一路的路灯；纪念石上的灯和刻痕；信号烟花。
import { Renderer as KinRenderer } from "./kin-renderer.js";
import { bakeMap } from "./pixel-maps.js";
import { LAMPS } from "./kin-data.js";
import { SSPOTS } from "./seasons-data.js";
import { WALL_IDS } from "./relight-data.js";
import { parseTunnelKey, tunnelArtKey } from "./tunnel-gen.js";

const SHAFT = { x: 1240, y: 880 };
// 通电以后集市一路的路灯（地图上的位置，只是画出来、夜里有光，不挡路）
const MARKET_LAMPS = [
  { x: 240, y: 470 },
  { x: 520, y: 470 },
  { x: 820, y: 470 },
  { x: 1120, y: 470 },
  { x: 1380, y: 470 },
];
const WALL_COLOR = { water: "#6fa6c8", clinic: "#e8e2d0", school: "#e6c66a", radio: "#9fd3b0", power: "#ffd76a", rail: "#d2654c" };

export class Renderer extends KinRenderer {
  constructor(canvas, assets) {
    super(canvas, assets);
    this._rlKey = null;
    this._rlDepth = 0;
    this._rlFire = { seen: 0, t: -99 };
    // 原画面（不用新画面）时：隧道的底图按这一层现画一张
    if (assets) {
      const self = this;
      const desc = {
        configurable: true,
        enumerable: true,
        get() {
          return self.tunnelCanvas();
        },
        set(v) {
          Object.defineProperty(this, "tunnel", { value: v, writable: true, configurable: true, enumerable: true });
        },
      };
      Object.defineProperty(assets, "tunnel", desc);
      if (this.orig) Object.defineProperty(this.orig, "tunnel", desc);
    }
    // 越往下越黑：压暗环境光
    const lm = this.lightMap;
    if (lm?.render) {
      const render = lm.render.bind(lm);
      lm.render = (view, amb, lights) => render(view, this._rlDepth ? amb.map((v) => Math.round(v * this.tunnelDim())) : amb, lights);
    }
  }
  tunnelDim() {
    return Math.max(0.32, 0.72 - 0.013 * this._rlDepth);
  }
  tunnelCanvas() {
    const key = this._rlKey;
    if (!key) return this._rlBlank || (this._rlBlank = this.blankCanvas());
    if (this._rlOld?.key !== key) {
      let canvas = null;
      try {
        canvas = bakeMap(key)?.canvas || null;
      } catch {
        canvas = null;
      }
      this._rlOld = { key, canvas: canvas || this.blankCanvas() };
    }
    return this._rlOld.canvas;
  }
  blankCanvas() {
    try {
      const cv = globalThis.document?.createElement?.("canvas");
      if (cv) {
        cv.width = 768;
        cv.height = 512;
        const c = cv.getContext("2d");
        c.fillStyle = "#1a1612";
        c.fillRect(0, 0, 768, 512);
        return cv;
      }
    } catch {
      /* 没有页面 */
    }
    return null;
  }
  // 地铁隧道：底图按这一层的名字取（在后台画，画好留着；只留眼前和下一层的）
  artFor(region) {
    if (region !== "tunnel") return super.artFor(region);
    const key = this._rlKey;
    if (!key) return null;
    const art = super.artFor(key);
    if (this.arts) for (const k of [...this.arts.keys()]) if (k.startsWith("tunnel:") && k !== key && k !== this._rlNext) this.arts.delete(k);
    return art;
  }
  waitBake(region) {
    return super.waitBake(region === "tunnel" && this._rlKey ? this._rlKey : region);
  }
  draw(engine, mouse, dt = 0.016) {
    const key = engine?.tunnelArtKey?.() || null;
    this._rlKey = key;
    this._rlDepth = key ? engine.tunnelFloor() : 0;
    // 下一层先在后台画着
    if (key && this.prebake) {
      const k = parseTunnelKey(key);
      if (k && k.floor < 30) {
        const next = tunnelArtKey(k.seed, k.floor + 1, engine.s.day, k.luck);
        if (next !== this._rlNext) {
          this._rlNext = next;
          this.prebake([next]);
        }
      }
    }
    return super.draw(engine, mouse, dt);
  }
  // 自己身边那一圈光：隧道里没手电只照得见脚边
  collectLights(e, night) {
    const lights = super.collectLights(e, night);
    if (!e?.rl) return lights;
    const p = e.s.player;
    if (e.s.region === "tunnel") {
      const mine = lights.find((l) => l.x === p.x && l.y === p.y - 18);
      if (mine) mine.r = e.qty?.("flashlight") ? 230 : 84;
      for (const o of e.objects || []) {
        if (o.type === "rlCore") lights.push({ x: o.x, y: o.y - 20, r: 150 + Math.sin(this.time * 3) * 12, color: [255, 150, 70], power: 0.95 });
        if (o.type === "rlLift") lights.push({ x: o.x, y: o.y - 60, r: 46, color: e.rl.tunnel.lifts.includes(o.floor) ? [140, 255, 150] : [255, 80, 60], power: 0.7, small: true });
        if (o.type === "rlUp") lights.push({ x: o.x, y: o.y - 40, r: 60, color: [200, 220, 255], power: 0.55, small: true });
      }
      return lights;
    }
    if (night > 0.05 && e.wallOn?.("power")) {
      const list = e.s.region === "farm" ? LAMPS : e.s.region === "market" ? MARKET_LAMPS : [];
      for (const q of list) lights.push({ x: q.x + 10, y: q.y - 38, r: 130, color: [255, 214, 140], power: 0.62 });
    }
    if (e.s.region === "farm") {
      const b = e.rlStationB?.();
      if (b) for (const [i, w] of WALL_IDS.entries()) if (e.wallOn(w)) lights.push({ x: b.x - 25 + i * 10, y: b.y - 34, r: 18, color: [255, 220, 150], power: 0.45, small: true });
    }
    return lights;
  }
  // 能不能看见这一处（灯照得到、或者这一层的感染者都倒了）
  seenInDark(e, o) {
    if (e.s.region !== "tunnel") return true;
    const p = e.s.player,
      r = e.qty?.("flashlight") || e.armorTotals?.().light ? 230 : 110,
      d = Math.hypot(p.x - o.x, p.y - o.y);
    if (d < r) return true;
    return !!e._rlCleared && !e.enemies?.some((z) => !z.dead);
  }
  ladder(x, y, up) {
    const c = this.ctx;
    if (!up) {
      c.fillStyle = "#0e0b09";
      c.fillRect(x - 22, y - 10, 44, 22);
      c.fillStyle = "#3b332b";
      c.fillRect(x - 24, y - 12, 48, 3);
      c.fillRect(x - 24, y + 11, 48, 3);
    }
    c.fillStyle = "#8a8070";
    const top = up ? y - 70 : y - 16,
      bot = up ? y + 4 : y + 10;
    c.fillRect(x - 12, top, 3, bot - top);
    c.fillRect(x + 9, top, 3, bot - top);
    c.fillStyle = "#a89c86";
    for (let yy = top + 6; yy < bot; yy += 9) c.fillRect(x - 12, yy, 24, 2);
    if (!up) {
      c.fillStyle = "#e5c24a";
      for (let i = -22; i < 22; i += 8) c.fillRect(x + i, y - 13, 4, 2);
    }
  }
  drawObject(o, e) {
    if (e?.rl) {
      const c = this.ctx,
        p = e.s.player,
        near = Math.hypot(p.x - o.x, p.y - o.y) < 150;
      if (o.type === "rlUp") {
        this.ladder(o.x, o.y, true);
        if (near) this.label2?.("回升降井", o.x, o.y - 84, "#cfe0f0", 11);
        return;
      }
      if (o.type === "rlLadder") {
        if (!this.seenInDark(e, o)) return;
        this.ladder(o.x, o.y, false);
        if (near) this.label2?.("往下 · 检修梯", o.x, o.y - 30, "#f1d98a", 11);
        return;
      }
      if (o.type === "rlLift") {
        const fixed = e.rl.tunnel.lifts.includes(o.floor);
        c.fillStyle = "#2c2a26";
        c.fillRect(o.x - 30, o.y - 76, 60, 76);
        c.fillStyle = fixed ? "#6f7a72" : "#4a4640";
        c.fillRect(o.x - 26, o.y - 70, 25, 70);
        c.fillRect(o.x + 1, o.y - 70, 25, 70);
        c.fillStyle = fixed ? "#7cf08a" : "#e0503a";
        c.fillRect(o.x - 3, o.y - 84, 6, 6);
        if (near) this.label2?.(fixed ? "检修电梯 · 修好了" : "检修电梯 · 坏的", o.x, o.y - 96, fixed ? "#cfe7a6" : "#f0b4a0", 11);
        return;
      }
      if (o.type === "rlCore") {
        const k = 0.5 + 0.5 * Math.sin(this.time * 3);
        c.fillStyle = "rgba(255,140,60," + (0.18 + 0.12 * k) + ")";
        c.beginPath();
        c.arc(o.x, o.y - 20, 26 + 6 * k, 0, Math.PI * 2);
        c.fill();
        c.fillStyle = "#ffb060";
        c.fillRect(o.x - 6, o.y - 26, 12, 12);
        c.fillStyle = "#fff0c0";
        c.fillRect(o.x - 3, o.y - 23, 6, 6);
        if (near) this.label2?.("泵房里的光", o.x, o.y - 56, "#ffd08a", 11);
        return;
      }
      if (o.type === "rlShaft") {
        c.fillStyle = "#26231f";
        c.fillRect(o.x - 34, o.y - 18, 68, 30);
        c.fillStyle = "#5e584e";
        c.fillRect(o.x - 36, o.y - 22, 72, 5);
        c.fillStyle = "#e5c24a";
        for (let i = -34; i < 34; i += 10) c.fillRect(o.x + i, o.y + 10, 5, 3);
        this.ladder(o.x, o.y + 2, false);
        if (near) this.label2?.("检修平台 · 往下", o.x, o.y - 40, "#f1d98a", 11);
        return;
      }
      if (o.type === "rlDig") return;
    }
    super.drawObject(o, e);
    // 纪念石：评定点的灯、余烬核的刻痕（守夜纪念日没办过、还没立石头的，第一次评定或拿到第一颗余烬核时立一块）
    if (e?.rl && o.type === "seasonPlaza" && (e.ss?.decor?.includes("stone") || e.rl.reviews.length || e.rl.cores.length)) this.drawStone(e, o);
  }
  drawStone(e, o) {
    const c = this.ctx,
      x = o.x - 170,
      y = o.y - 24,
      r = e.lastReview?.(),
      lamps = r?.lamps || 0,
      notches = e.rl.cores.length;
    if (!e.ss?.decor?.includes("stone")) {
      c.fillStyle = "#7a7a72";
      c.fillRect(x, y, 30, 34);
      c.fillStyle = "#8a8a82";
      c.fillRect(x + 4, y - 6, 22, 8);
      c.fillStyle = "#3a3530";
      c.fillRect(x + 12, y + 10, 6, 2);
    }
    for (let i = 0; i < notches; i++) {
      c.fillStyle = "#4a4a44";
      c.fillRect(x + 4 + i * 3, y + 22, 1, 8);
    }
    for (let i = 0; i < lamps; i++) {
      const fx = x + 3 + i * 7,
        fy = y - 8;
      c.fillStyle = "#3a332b";
      c.fillRect(fx, fy + 3, 4, 3);
      c.fillStyle = Math.sin(this.time * 6 + i) > 0 ? "#ffd76a" : "#f6b05a";
      c.fillRect(fx + 1, fy - 1, 2, 4);
    }
  }
  drawBuilding(b, e) {
    if (e?.rl && b?.type === "rlStation") return this.drawStation(b, e);
    if (e?.rl && b?.type === "rlWatch") return this.drawWatch(b, e);
    return super.drawBuilding(b, e);
  }
  drawStation(b, e) {
    const c = this.ctx,
      broken = b.hp <= 0;
    c.save();
    if (broken) c.globalAlpha = 0.5;
    c.fillStyle = "rgba(20,14,10,0.35)";
    c.fillRect(b.x - 30, b.y + 10, 64, 8);
    // 两根柱子、一块大板子、六块小牌子
    c.fillStyle = "#5a3f2a";
    c.fillRect(b.x - 30, b.y - 50, 6, 62);
    c.fillRect(b.x + 24, b.y - 50, 6, 62);
    c.fillStyle = "#7a5838";
    c.fillRect(b.x - 32, b.y - 54, 64, 40);
    c.fillStyle = "#a68356";
    c.fillRect(b.x - 30, b.y - 52, 60, 3);
    for (const [i, w] of WALL_IDS.entries()) {
      const px = b.x - 28 + (i % 3) * 19,
        py = b.y - 46 + Math.floor(i / 3) * 15;
      c.fillStyle = e.wallOn(w) ? WALL_COLOR[w] : "#3c3128";
      c.fillRect(px, py, 16, 11);
      c.fillStyle = "#e9dcc0";
      c.fillRect(px + 2, py + 2, 12, 1);
    }
    c.fillStyle = "#6b4e33";
    c.fillRect(b.x - 18, b.y - 12, 36, 14);
    c.fillStyle = "#8d6340";
    c.fillRect(b.x - 18, b.y - 12, 36, 3);
    c.restore();
    const p = e.s.player;
    if (Math.hypot(p.x - b.x, p.y - b.y) < 140) this.label2?.("重建站 " + e.rl.done.length + "/28", b.x, b.y - 66, "#f1d98a", 11);
    this.drawFireworks(b, e);
  }
  drawWatch(b, e) {
    const c = this.ctx;
    c.fillStyle = "#5a3f2a";
    c.fillRect(b.x - 12, b.y - 10, 24, 12);
    c.fillStyle = "#c9a24a";
    c.beginPath();
    c.arc(b.x, b.y - 16, 7, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = "#f6efd8";
    c.beginPath();
    c.arc(b.x, b.y - 16, 5, 0, Math.PI * 2);
    c.fill();
    c.strokeStyle = "#2a241d";
    c.lineWidth = 1;
    const a = this.time * 0.6;
    c.beginPath();
    c.moveTo(b.x, b.y - 16);
    c.lineTo(b.x + Math.cos(a) * 4, b.y - 16 + Math.sin(a) * 4);
    c.stroke();
    const p = e.s.player;
    if (Math.hypot(p.x - b.x, p.y - b.y) < 110) this.label2?.("老怀表", b.x, b.y - 32, "#f1d98a", 11);
  }
  // 信号烟花：放的那一刻起 9 秒，重建站上空一朵朵炸开
  drawFireworks(b, e) {
    const f = e.rl.fire;
    if (f && f !== this._rlFire.seen) {
      this._rlFire.seen = f;
      if (f === e.s.day) this._rlFire.t = this.time;
    }
    const t = this.time - this._rlFire.t;
    if (t < 0 || t > 9) return;
    const c = this.ctx,
      cols = ["#ff6a4a", "#7cf08a", "#ffd76a", "#8fd0ff", "#ff9ad0"];
    for (let k = 0; k < 6; k++) {
      const tk = t - k * 1.3;
      if (tk < 0 || tk > 2.2) continue;
      const cx = b.x + ((k * 97) % 300) - 150,
        cy = b.y - 240 - ((k * 53) % 140),
        rad = tk < 0.5 ? 0 : (tk - 0.5) * 70,
        alpha = tk < 0.5 ? 1 : Math.max(0, 1 - (tk - 0.5) / 1.7);
      if (tk < 0.5) {
        c.fillStyle = "#fff0c0";
        c.fillRect(cx - 1, cy + (0.5 - tk) * 360, 2, 8);
        continue;
      }
      c.fillStyle = cols[k % cols.length];
      c.globalAlpha = alpha;
      for (let i = 0; i < 16; i++) {
        const a = (i / 16) * Math.PI * 2;
        c.fillRect(cx + Math.cos(a) * rad - 1.5, cy + Math.sin(a) * rad + tk * 8 - 1.5, 3, 3);
      }
      c.globalAlpha = 1;
    }
  }
  // 通电以后：农场到营门、集市一路的路灯柱子
  drawFarm(e) {
    super.drawFarm(e);
    if (e?.rl && e.wallOn?.("power") && !(e.lampsOn?.() && e.kin)) this.drawPowerLamps(e, LAMPS);
  }
  drawRuins(e) {
    super.drawRuins(e);
    if (e?.rl && e.s.region === "market" && e.wallOn?.("power")) this.drawPowerLamps(e, MARKET_LAMPS);
  }
  drawPowerLamps(e, list) {
    const c = this.ctx,
      night = e.s.minute >= 1110 || e.s.minute < 360;
    for (const q of list) {
      c.fillStyle = "#2a2420";
      c.fillRect(q.x - 2, q.y - 46, 4, 46);
      c.fillRect(q.x - 2, q.y - 46, 14, 3);
      c.fillStyle = night ? "#ffd76a" : "#8a7a5a";
      c.fillRect(q.x + 6, q.y - 43, 8, 10);
      c.fillStyle = "#1a1410";
      c.fillRect(q.x + 5, q.y - 44, 10, 2);
    }
  }
  // 原画面：隧道里也是黑的，只照得见身边
  drawNight(e) {
    if (!this.v && e?.s?.region === "tunnel") {
      super.drawNight(e);
      const c = this.ctx,
        p = e.s.player,
        r = e.qty?.("flashlight") || e.armorTotals?.().light ? 240 : 110;
      c.save();
      c.fillStyle = "rgba(6,8,12," + (0.55 + 0.012 * (e.tunnelFloor?.() || 0)) + ")";
      c.beginPath();
      c.rect(0, 0, 1536, 1024);
      c.arc(p.x, p.y - 18, r, 0, Math.PI * 2);
      c.fill("evenodd");
      c.restore();
      return;
    }
    return super.drawNight(e);
  }
}
void SHAFT;
void SSPOTS;
