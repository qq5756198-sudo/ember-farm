// v0.38.0「修缮」：卡位逃脱，和一轮找出来的毛病。不加存档字段（读档以前先把死了的感染者拿掉）。
// 1. 卡住了：人站进建筑、地形里（建东西、修好倒了的设施、回家的落脚点被盖住……），过一小会儿自己挪到最近能站的地方；
//    被围死、走不出去：设置、手机的快捷菜单里“挪到能走的地方”，挪到最近一处走得到出口的地方（被抓着、倒在地上、收线时不行，挪一次等几秒）。
// 2. 建东西：外框不能罩住自己、不能盖住农场的落脚点；最多 300 座设施、600 块田。
// 3. 死了的感染者：换图、过一天、倒下回家时从各张图的名单里拿掉；读档时也先拿掉（一张图过了 200 条以前读不回来）。
// 4. 隧道里掉在地上的东西：换一层、离开隧道、在隧道里倒下，都送到升降井口（以前留在原来的坐标，下一层多半在墙里）。
// 5. 瞭望塔打一发先用仓库的子弹，仓库没有了才用身上带的。
// 6. 过了半夜才睡：睡到当天早上 8 点（以前睡到第二天的 8 点，整个白天没了）。
// 7. 麦穗跟在身边：按交互先给旁边的东西，不再老是弹“选一个”；只有它一个在身边才是摸它。
import { Engine as TitanEngine, freshState as tFresh, migrateState as tMigrate, newGameState as tNewGame, newGamePlusState as tNewGamePlus, needsUpgrade as tNeedsUpgrade, legacyGear } from "./titan.js";
import { REGIONS, WORLD } from "./data.js";
import { SHAFT } from "./relight.js";
import { MEND, MEND_TEXT } from "./mend-data.js";

export { legacyGear };
export const needsUpgrade = tNeedsUpgrade;
export function migrateState(s) {
  return tMigrate(s);
}
export function freshState() {
  return tFresh();
}
export function newGameState(origin = "farmer") {
  return tNewGame(origin);
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  return tNewGamePlus(old, origin, keep, book);
}

// 跟 engine.js 里的一样（含边）
const inRect = (x, y, r, m = 0) => x >= r.x - m && x <= r.x + r.w + m && y >= r.y - m && y <= r.y + r.h + m;
// 人站上去不挡路的设施
const SOFT = ["trap", "gate", "floor"];
const dead = (z) => !!(z && z.dead);
// 读档以前：各张图名单里死了的感染者拿掉（只改要改的那几张）
export function pruneDeadText(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return text;
  }
  const en = raw?.enemies;
  if (!en || typeof en !== "object") return text;
  let n = 0;
  for (const [id, list] of Object.entries(en))
    if (Array.isArray(list) && list.some(dead)) {
      en[id] = list.filter((z) => !dead(z));
      n++;
    }
  return n ? JSON.stringify(raw) : text;
}

export class Engine extends TitanEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(s, notify);
    this._mendT = 0;
    this._mendSaid = 0;
    this._mendAt = 0;
  }

  // ================= 卡位逃脱 =================
  // 一张能站的格子网（按人物走路的半径，多留一点）；每一格属于哪一块连通的地方
  mendGrid() {
    const S = MEND.step,
      R = MEND.r + MEND.pad,
      x0 = 45 + 1,
      y0 = 50 + 1,
      nx = Math.floor((WORLD.w - 90 - 2) / S) + 1,
      ny = Math.floor((WORLD.h - 100 - 2) / S) + 1;
    const free = new Uint8Array(nx * ny).fill(1);
    for (const c of this.colliders(false)) {
      const i0 = Math.max(0, Math.floor((c.x - R - x0) / S)),
        i1 = Math.min(nx - 1, Math.ceil((c.x + c.w + R - x0) / S)),
        j0 = Math.max(0, Math.floor((c.y - R - y0) / S)),
        j1 = Math.min(ny - 1, Math.ceil((c.y + c.h + R - y0) / S));
      for (let j = j0; j <= j1; j++)
        for (let i = i0; i <= i1; i++) if (inRect(x0 + i * S, y0 + j * S, c, R)) free[j * nx + i] = 0;
    }
    // 连通的块（四邻）
    const comp = new Int32Array(nx * ny).fill(-1),
      sizes = [];
    for (let k = 0; k < free.length; k++) {
      if (!free[k] || comp[k] >= 0) continue;
      const id = sizes.length,
        q = [k];
      comp[k] = id;
      let n = 0;
      while (q.length) {
        const c = q.pop(),
          i = c % nx,
          j = (c / nx) | 0;
        n++;
        if (i > 0 && free[c - 1] && comp[c - 1] < 0) (comp[c - 1] = id), q.push(c - 1);
        if (i < nx - 1 && free[c + 1] && comp[c + 1] < 0) (comp[c + 1] = id), q.push(c + 1);
        if (j > 0 && free[c - nx] && comp[c - nx] < 0) (comp[c - nx] = id), q.push(c - nx);
        if (j < ny - 1 && free[c + nx] && comp[c + nx] < 0) (comp[c + nx] = id), q.push(c + nx);
      }
      sizes.push(n);
    }
    const at = (x, y) => {
      const i = Math.round((x - x0) / S),
        j = Math.round((y - y0) / S);
      return i < 0 || j < 0 || i >= nx || j >= ny ? -1 : j * nx + i;
    };
    const xy = (k) => ({ x: x0 + (k % nx) * S, y: y0 + ((k / nx) | 0) * S });
    return { S, nx, ny, free, comp, sizes, at, xy };
  }
  // 走得到出口的那一块：出口附近能站的格子在哪一块（出口边上一格都站不了，才看进图的点）
  mendMain(G) {
    const R = REGIONS[this.s.region] || {},
      main = new Set();
    for (const p of [R.exit, R.spawn].filter(Boolean)) {
      let best = -1,
        bd = 1e9;
      const k0 = G.at(p.x, p.y),
        i0 = k0 % G.nx,
        j0 = (k0 / G.nx) | 0,
        span = Math.ceil(70 / G.S);
      if (k0 < 0) continue;
      for (let j = Math.max(0, j0 - span); j <= Math.min(G.ny - 1, j0 + span); j++)
        for (let i = Math.max(0, i0 - span); i <= Math.min(G.nx - 1, i0 + span); i++) {
          const k = j * G.nx + i;
          if (!G.free[k]) continue;
          const q = G.xy(k),
            d = Math.hypot(q.x - p.x, q.y - p.y);
          if (d < bd) (bd = d), (best = k);
        }
      if (best >= 0) {
        main.add(G.comp[best]);
        break;
      }
    }
    return main;
  }
  // 离人最近、能站的一格；main 时只要走得到出口的那一块，不然只要不是一小块死角
  mendSpot(main = false) {
    const p = this.s.player,
      G = this.mendGrid(),
      keep = main ? this.mendMain(G) : null,
      tiny = 40;
    let best = null,
      bd = 1e12;
    for (let k = 0; k < G.free.length; k++) {
      if (!G.free[k]) continue;
      const c = G.comp[k];
      if (keep ? !keep.has(c) : G.sizes[c] < tiny) continue;
      const q = G.xy(k),
        d = (q.x - p.x) ** 2 + (q.y - p.y) ** 2;
      if (d < bd) (bd = d), (best = q);
    }
    if (!best) return null;
    return { x: best.x, y: best.y, d: Math.sqrt(bd), G, keep };
  }
  // 人现在走不走得到出口
  mendEnclosed() {
    const p = this.s.player;
    if (this.blocked(p.x, p.y, false, MEND.r)) return true;
    const q = this.mendSpot(true);
    // 最近那一格离人不到两格：人就在那一块里
    return !q || q.d > q.G.S * 1.5;
  }
  mendStuckNow() {
    const p = this.s.player;
    return !!p && this.blocked(p.x, p.y, false, MEND.r);
  }
  mendMove(q) {
    const p = this.s.player;
    p.x = q.x;
    p.y = q.y;
    this.navCache = null;
    if (this.gx) this.gx.down = 0;
  }
  // 一个跟着走的（麦穗、农场上的居民）站在障碍里：挪到它旁边最近一处能站的地方（找不到就挪到你身边）
  mendFree(q, near = q) {
    const R = MEND.r + MEND.pad;
    for (let r = 0; r <= 160; r += 6)
      for (let k = 0, n = Math.max(1, Math.round((r * Math.PI * 2) / 8)); k < n; k++) {
        const a = (k / n) * Math.PI * 2,
          x = near.x + Math.cos(a) * r,
          y = near.y + Math.sin(a) * r;
        if (!this.blocked(x, y, false, R)) return { x, y };
      }
    return null;
  }
  mendFollowers() {
    let n = 0;
    const d = this.f?.dog,
      p = this.s.player;
    // 只管跟着你、就在这张图上的它（留在原地等、回农场看家的不动）
    const here = d?.rescued && this.s.region !== "market" && !["wait", "home"].includes(this.b?.dog?.mode) && (this.objects || []).some((o) => o.type === "partnerDog");
    if (here && this.blocked(d.x, d.y, false, MEND.r)) {
      const q = this.mendFree(d) || this.mendFree(d, p);
      if (q) {
        Object.assign(d, q);
        const o = this.objects?.find((x) => x.type === "partnerDog");
        if (o) Object.assign(o, q);
        n++;
      }
    }
    // 农场上走来走去的人：居民、援建队员、营地的帮手、长夜里守在你身边的那个人
    if (this.s.region === "farm") {
      const groups = [
        [this.c?.residents, this.residentPaths],
        [this.o?.crew, this._crewPaths],
        [this.sc?.helpers, this._helperPaths],
        [this._kinAlly ? [this._kinAlly] : null, null],
      ];
      for (const [list, paths] of groups)
        for (const r of list || []) {
          if (!r || !Number.isFinite(r.x) || !Number.isFinite(r.y) || !this.blocked(r.x, r.y, false, MEND.r)) continue;
          const q = this.mendFree(r);
          if (!q) continue;
          Object.assign(r, q);
          if (r.id != null) paths?.delete?.(r.id);
          n++;
        }
    }
    return n;
  }
  // 自己挪：站在障碍里过了一小会儿
  mendTick(dt) {
    this._mendF = (this._mendF || 0) + dt;
    if (this._mendF >= 0.5) {
      this._mendF = 0;
      this.mendFollowers();
    }
    const p = this.s.player;
    if (!p || p.hp <= 0 || !this.mendStuckNow()) {
      this._mendT = 0;
      return false;
    }
    this._mendT += dt;
    if (this._mendT < MEND.wait) return false;
    this._mendT = 0;
    const q = this.mendSpot(false) || this.mendSpot(true);
    if (!q) return false;
    this.mendMove(q);
    const now = Date.now();
    if (now - this._mendSaid > MEND.sayEvery * 1000) {
      this._mendSaid = now;
      this.toast(MEND_TEXT.pushed);
    }
    return true;
  }
  // 设置、快捷菜单里那个按钮：为什么现在不能挪（空字符串就是能挪）
  unstuckReason() {
    const p = this.s.player,
      W = MEND_TEXT.why;
    if (!p) return W.none;
    if (this.gx?.grab || this.tx?.hold) return W.grabbed;
    if (this.gx?.down > 0) return W.down;
    if (this.reeling?.()) return W.reel;
    if (Date.now() - this._mendAt < MEND.cool * 1000) return W.cool;
    // 算一遍格子网要几毫秒：同一个地方、同样的设施，短时间里不重算（设置页拖音量条时会一直重画）
    const key = [this.s.region, Math.round(p.x), Math.round(p.y), this.s.buildings.length, this.navRevision || 0].join(":"),
      now = Date.now();
    if (this._mendWhy && this._mendWhy.key === key && now - this._mendWhy.t < 1500) return this._mendWhy.v;
    const v = !this.mendEnclosed() ? W.free : !this.mendSpot(true) ? W.none : "";
    this._mendWhy = { key, t: now, v };
    return v;
  }
  unstuck() {
    const why = this.unstuckReason();
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const q = this.mendSpot(true);
    if (!q) {
      this.toast(MEND_TEXT.why.none + "。", "warn");
      return false;
    }
    this.mendMove(q);
    this._mendAt = Date.now();
    this._mendWhy = null;
    this.toast(MEND_TEXT.moved, "gold");
    this.emit("closeMenu");
    return true;
  }
  update(dt, input = {}) {
    const out = super.update(dt, input);
    if (!this.paused) this.mendTick(Math.min(0.1, Math.max(0, dt || 0)));
    return out;
  }
  travel(id) {
    const from = this.s.region,
      tunnel = from === "tunnel";
    const ok = super.travel(id);
    if (ok && this.s.region !== from) {
      this.mendPrune();
      if (tunnel && this.s.region !== "tunnel") this.mendTunnelDrops();
      // 进图就落在障碍里（落脚点被盖住）：马上挪
      if (this.mendStuckNow()) {
        const q = this.mendSpot(false) || this.mendSpot(true);
        if (q) this.mendMove(q);
      }
      // 麦穗跟着进图：落在你左下方（废弃居民区、旧医院、工业仓库那里是一排房子），挪到旁边能走的地方
      this.mendFollowers();
    }
    return ok;
  }

  // ================= 建东西 =================
  buildReason(type, x, y) {
    const why = super.buildReason(type, x, y);
    if (why || this.s.region !== "farm") return why;
    const T = MEND_TEXT;
    if (type === "field") {
      if (this.s.plots.length >= MEND.maxPlots) return T.tooManyPlots;
      return "";
    }
    if (this.s.buildings.length >= MEND.maxBuildings) return T.tooManyBuildings;
    if (SOFT.includes(type)) return "";
    const rect = this.buildingRect(type, x, y),
      p = this.s.player,
      m = MEND.r + 2;
    if (inRect(p.x, p.y, rect, m)) return T.coverSelf;
    if (inRect(MEND.home.x, MEND.home.y, rect, m)) return T.coverHome;
    return "";
  }

  // ================= 死了的感染者 =================
  mendPrune() {
    const here = this.s.region;
    let n = 0;
    for (const [id, list] of Object.entries(this.s.enemies || {})) {
      if (!Array.isArray(list) || !list.some(dead)) continue;
      // 人在的这张图：别的系统这一帧可能还拿着这份名单，攒多了（一直待在农场睡觉过日子）才换
      if (id === here && list.filter(dead).length < MEND.deadKeep) continue;
      const keep = list.filter((z) => !dead(z));
      this.s.enemies[id] = keep;
      if (id === here) this.enemies = keep;
      n++;
    }
    return n;
  }
  onNewDay() {
    super.onNewDay();
    this.mendPrune();
  }
  die() {
    const tunnel = this.s.region === "tunnel";
    const out = super.die();
    this.mendPrune();
    if (tunnel) this.mendTunnelDrops();
    return out;
  }

  // ================= 隧道里掉在地上的东西 =================
  mendTunnelDrops() {
    const list = (this.s.drops || []).filter((d) => d.region === "tunnel");
    if (!list.length) return 0;
    list.forEach((d, i) => Object.assign(d, { region: SHAFT.region, x: SHAFT.x + 30 + (i % 4) * 16, y: SHAFT.y - 64 - Math.floor(i / 4) * 16 }));
    this.toast(MEND_TEXT.tunnelDrops, "gold");
    return list.length;
  }
  tunnelDown() {
    const ok = super.tunnelDown();
    if (ok) this.mendTunnelDrops();
    return ok;
  }

  // ================= 瞭望塔先用仓库的子弹 =================
  takeFarm(cost) {
    if (this._tDef && !this._freeAmmo && cost && cost.ammo === 1 && Object.keys(cost).length === 1 && (this.s.storage?.ammo || 0) > 0) {
      this.s.storage.ammo--;
      if (!this.s.storage.ammo) delete this.s.storage.ammo;
      return true;
    }
    return super.takeFarm(cost);
  }

  // ================= 半夜以后睡觉 =================
  mendNapOk() {
    if (this.s.region !== "farm" || this.s.minute >= MEND.napUntil) return false;
    // 长夜、最后一夜过后那一觉有它们自己的说法
    if (this.lnNapOk?.() || this.finalNapOk?.()) return false;
    // 打着仗、要打仗：照原来的规矩（不让睡的会说为什么）
    if (this.ln?.night || this.tg?.final?.on) return false;
    // 今晚是长夜、最后一夜：那一天照原来的规矩不让睡
    const F = this.tg?.final;
    if (this.lnPending?.() || (F && !F.won && F.day === this.s.day)) return false;
    // 今天的事还没定：照原来的规矩先弹出来
    if ((this.dy && this.dailyCard?.()) || this.dailyDeferred?.()) return false;
    if (["warning", "active"].includes(this.s.horde?.phase)) return false;
    const r = this.raidState?.();
    if (r && ["warning", "active"].includes(r.phase)) return false;
    if (this.activeEvents?.().some((d) => this.v?.records?.[d.id]?.spawned && this.echoStep?.(d.id)?.loc?.region === "farm")) return false;
    return true;
  }
  mendNap() {
    const p = this.s.player;
    if (this.ss?.canteen?.night) this.endCanteen?.();
    this.advanceMinutes(MEND.napUntil - this.s.minute);
    p.hp = Math.min(this.maxHp?.() ?? 100, p.hp + 35);
    p.stamina = this.maxSta();
    p.hunger = Math.max(30, p.hunger - 6);
    if (this.gx) this.gx.bleed = 0;
    this.releaseGrab?.(false);
    this.toast(MEND_TEXT.nap, "gold");
    this.emit("sleep");
    return true;
  }
  sleep() {
    if (this.mendNapOk()) return this.mendNap();
    return super.sleep();
  }

  // ================= 麦穗不挡着按交互 =================
  mendNoDog(fn) {
    const objs = this.objects;
    if (!Array.isArray(objs) || !objs.some((o) => o.type === "partnerDog")) return fn();
    this.objects = objs.filter((o) => o.type !== "partnerDog");
    try {
      return fn();
    } finally {
      this.objects = objs;
    }
  }
  nearestObject() {
    const ob = super.nearestObject();
    if (this._picked || ob?.type !== "partnerDog") return ob;
    return this.mendNoDog(() => super.nearestObject()) || ob;
  }
  pickCandidates() {
    return this.mendNoDog(() => super.pickCandidates());
  }

  static parse(text) {
    return TitanEngine.parse(pruneDeadText(text));
  }
}
