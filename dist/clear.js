// v0.41.0「看得清」：引擎这一层只记“画面上该怎么动一下”——收菜、捡到东西、建好设施、升级、打中的时候各记一笔
// （在哪、什么东西、几个），画面那一层取走去画。只给画面用：不进存档、不改任何规矩和数、不碰随机数。
import { Engine as SimpleEngine } from "./simple.js";

// 画面没来取（台子、测试里没有画面）时最多留这么多笔
export const VFX_MAX = 32;
const HIT_TYPES = new Set(["hitFlesh", "hitMetal"]);

export class Engine extends SimpleEngine {
  vfx(kind, data = {}) {
    const q = this.vfxq || (this.vfxq = []);
    q.push({ kind, ...data });
    if (q.length > VFX_MAX) q.splice(0, q.length - VFX_MAX);
  }
  // 画面每一帧取走
  takeVfx() {
    const q = this.vfxq;
    if (!q || !q.length) return [];
    this.vfxq = [];
    return q;
  }
  vfxCount(id) {
    return id ? this.s.inventory?.[id] || 0 : 0;
  }
  // 自己收的菜（居民、照看机收的不算）：从那块田弹起来，飞到身上
  harvest(p, worker = false, ...rest) {
    const crop = p?.crop,
      x = p?.x,
      y = p?.y,
      before = worker ? 0 : this.vfxCount(crop);
    const ok = super.harvest(p, worker, ...rest);
    if (ok && !worker && crop) {
      this._vfxHarvested = true;
      this.vfx("harvest", { x, y, item: crop, n: Math.max(1, this.vfxCount(crop) - before) });
    }
    return ok;
  }
  // 按交互捡到、搜到的东西：从那一样东西那里弧线飞到身上（收菜另算，上面那一笔）
  interact(...args) {
    const inv = this.s?.inventory;
    if (!inv || this.paused) return super.interact(...args);
    let src = null;
    try {
      src = this.nearestObject();
    } catch {
      src = null;
    }
    const before = { ...inv };
    this._vfxHarvested = false;
    const out = super.interact(...args);
    if (!this._vfxHarvested) this.vfxGain(before, src);
    this._vfxHarvested = false;
    return out;
  }
  vfxGain(before, src) {
    const inv = this.s?.inventory || {},
      items = [];
    for (const [id, n] of Object.entries(inv)) {
      const d = (n || 0) - (before[id] || 0);
      if (d > 0) items.push([id, d]);
    }
    if (!items.length) return;
    const p = this.s.player,
      x = Number.isFinite(src?.x) ? src.x : p.x,
      y = Number.isFinite(src?.y) ? src.y : p.y;
    this.vfx("pickup", { x, y, items: items.slice(0, 3) });
  }
  // 建好设施：从半格高处落下来
  placeBuilding(x, y, ...rest) {
    const nb = this.s.buildings?.length || 0,
      np = this.s.plots?.length || 0;
    const ok = super.placeBuilding(x, y, ...rest);
    if (ok) {
      const b = (this.s.buildings || []).length > nb ? this.s.buildings[this.s.buildings.length - 1] : null,
        q = !b && (this.s.plots || []).length > np ? this.s.plots[this.s.plots.length - 1] : null,
        o = b || q;
      if (o) this.vfx("build", { x: o.x, y: o.y, id: b ? b.id : "plot" + q.id, type: b ? b.type : "field" });
    }
    return ok;
  }
  // 升级：身边升起余烬火星、一圈金光
  emit(type, data = {}) {
    if (type === "level") this.vfx("level", {});
    return super.emit(type, data);
  }
  // 打中：白一下、几粒碎片
  emitAt(type, z, extra = {}) {
    if (HIT_TYPES.has(type) && z) this.vfx("hit", { x: z.x, y: z.y, id: z.id, metal: type === "hitMetal", heavy: !!extra.heavy, kill: !!extra.kill });
    return super.emitAt(type, z, extra);
  }
}
