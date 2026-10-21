// v0.39.0「一物一用」：场景里的字只写你面前那一样。
// 1. 走近了才写：交互圈套着的那一样，头上一行“名字 · 做什么”（和底栏的提示是同一句），按交互做的就是写着字的这一样。
// 2. 别的东西身上的名字、状态（“物资”“待维修”“Lv.2”……）不写；地上的物资只画那个小包。
// 3. 照写的：感染者、十凶身上的字，你自己身上的字（装填中、倒地），飘起来的大字（收获、伤害），出口的名字（找路用），建造时的提示。
// 做法：画场景时开一道闸。各层画字都走 text() / badge()，闸开着时看这行字落在谁头上：
// 落在能交互的东西头上就不画（交互目标那一样也不画，由这里统一写一行）；落在感染者、你自己头上，或者谁的也不是，照画。
// 画夜色（drawNight）时关闸：之后是光照、天气、小地图，不归这里管。
import { Renderer as TitanRenderer2 } from "./titan-renderer2.js";

// 出口：找路用，名字照写
const KEEP_TYPES = new Set(["exit", "districtExit", "beyondExit"]);
// 这些东西画在地上但不是“一样东西”（装饰、跟着你的帮手画的字归它自己管）
const SKIP_TYPES = new Set(["hpDeco"]);
// 一行字落在谁头上：x 偏多少、y 在它脚下往上多高以内
const OWN = { dx: 64, up: 175, down: 40 };
const FOE = { dx: 60, up: 175, down: 30 };

export class Renderer extends TitanRenderer2 {
  draw(engine, mouse, dt) {
    this._sl = engine && !engine.buildMode && engine.simpleLabelsOn?.() !== false ? this.slOwners(engine) : null;
    this._slTop = null;
    try {
      return super.draw(engine, mouse, dt);
    } finally {
      this._sl = null;
    }
  }
  // 这一帧能交互的东西（农场上连设施和田）、感染者、你自己、交互目标
  slOwners(engine) {
    const s = engine.s,
      p = s.player,
      things = [];
    let target = null;
    try {
      target = engine.paused ? null : engine.nearestObject();
    } catch {
      target = null;
    }
    for (const o of engine.objects || []) if (o && Number.isFinite(o.x) && Number.isFinite(o.y) && !SKIP_TYPES.has(o.type)) things.push(o);
    if (s.region === "farm") for (const b of s.buildings || []) if (b && Number.isFinite(b.x)) things.push(b);
    for (const d of s.drops || []) if (d && d.region === s.region) things.push(d);
    const foes = [];
    for (const z of engine.enemies || []) if (z && !z.dead && Number.isFinite(z.x)) foes.push(z);
    const big = new Set();
    for (const a of engine.effects || []) if (a && typeof a.text === "string") big.add(a.text);
    // 交互目标对应的那一样：设施是 building 字段，物资是 drop 字段，田是 plot 字段
    const tgt = target ? target.building || target.drop || target.plot || target : null;
    return { things, foes, p, target, tgt, big };
  }
  // 这行字该不该画（闸关着时一律画）
  slAllow(label, x, y, size) {
    const g = this._sl;
    if (!g) return true;
    if (typeof label !== "string" || !label.trim()) return true;
    // 飘字、大字（伤害、收获、感叹号）照画
    if (size >= 14 || g.big.has(label)) return true;
    // 正在画谁：画你自己、画感染者时写的字照画；画一样东西、一座设施时写的字归它
    const own = this._slOwn;
    if (own === "self" || own === "foe") return true;
    let best = own && typeof own === "object" ? own : null;
    if (!best) {
      if (!Number.isFinite(x) || !Number.isFinite(y)) return true;
      for (const z of g.foes) if (Math.abs(x - z.x) <= FOE.dx && y >= z.y - FOE.up && y <= z.y + FOE.down) return true;
      let score = Infinity;
      for (const o of g.things) {
        const dx = Math.abs(x - o.x);
        if (dx > OWN.dx || y < o.y - OWN.up || y > o.y + OWN.down) continue;
        const sc = dx + 0.35 * Math.abs(y - (o.y - 60));
        if (sc < score) {
          score = sc;
          best = o;
        }
      }
    }
    if (!best) return true;
    if (best === g.tgt || best === g.target) {
      // 记下它头上原来那行字有多高，统一那一行写在那里
      if (Number.isFinite(y) && (this._slTop == null || y < this._slTop)) this._slTop = y;
      return false;
    }
    if (KEEP_TYPES.has(best.type)) return true;
    return false;
  }
  drawObject(o, e) {
    const was = this._slOwn;
    this._slOwn = o;
    try {
      return super.drawObject(o, e);
    } finally {
      this._slOwn = was;
    }
  }
  drawBuilding(b, e) {
    const was = this._slOwn;
    this._slOwn = b;
    try {
      return super.drawBuilding(b, e);
    } finally {
      this._slOwn = was;
    }
  }
  drawPlayer(e) {
    const was = this._slOwn;
    this._slOwn = "self";
    try {
      return super.drawPlayer(e);
    } finally {
      this._slOwn = was;
    }
  }
  drawEnemy(z, e) {
    const was = this._slOwn;
    this._slOwn = "foe";
    try {
      return super.drawEnemy(z, e);
    } finally {
      this._slOwn = was;
    }
  }
  text(label, x, y, color, size = 12, center = true) {
    if (!this.slAllow(label, x, y, size)) return;
    return super.text(label, x, y, color, size, center);
  }
  badge(label, x, y, color) {
    if (!this.slAllow(label, x, y, 12)) return;
    return super.badge(label, x, y, color);
  }
  // 人情、四时这几层画名字用的另一种写法（像素画法下直接写，不经过 text）
  label2(label, x, y, color, size = 11) {
    if (!this.slAllow(label, x, y, size)) return;
    return super.label2?.(label, x, y, color, size);
  }
  drawNight(engine) {
    // 夜色、灯光以后画的不归闸管；先把面前那一样的字写上（像素画法下这行字和别的字一起放到最后写）
    this.drawSimpleLabel(engine);
    const g = this._sl;
    this._sl = null;
    try {
      return super.drawNight(engine);
    } finally {
      this._sl = g;
    }
  }
  drawSimpleLabel(engine) {
    const g = this._sl;
    if (!g || !g.target || engine.paused || engine.c?.fishing) return;
    let text = "";
    try {
      text = engine.simpleLabel ? engine.simpleLabel(g.target) : engine.context(g.target);
    } catch {
      text = "";
    }
    if (!text) return;
    const o = g.target,
      top = this._slTop;
    const y = Number.isFinite(top) ? Math.max(top, o.y - 150) : o.y - 64;
    this._sl = null;
    try {
      super.badge(text, o.x, y, "#f3e3a6");
    } finally {
      this._sl = g;
    }
  }
}
