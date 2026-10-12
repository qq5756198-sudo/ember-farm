// v0.23.0「回响」：手感和节奏。
// 翻滚（前 0.25 秒不受伤）、打中顿一下、挨打往后仰、打死倒在地上留尸体和血迹、重击震屏；
// 引擎发出的事件带上位置，多了“发现你”“要出手”“吸气”“伸手”等给声音用的事件；
// 新档开局那一拨感染者（打不死人，一步一步教）；生涯记录（每趟出门记一行）；
// 每日抉择可以“稍后再选”（12:00 前），平安的早上不弹日终总结，手记最上面的“今天”。
// 新进度都放在 s.feel，原来的字段不动；尸体、血迹、停顿这些只在内存里，不进存档。
import { Engine as GearEngine, freshState as gearFresh, migrateState as gearMigrate } from "./gear.js";
import { ITEMS, REGIONS } from "./data.js";
import { MELEE, RANGED, RULES, THROWN, TRAPS } from "./gear-data.js";
import { EVENTS } from "./daily-data.js";
import { ROLL, HITSTOP, HEAVY_WEAPONS, REACT, REMAINS, SHAKE, OPENING, COACH, CAREER, CAREER_RESULTS, LATER, TODAY_MAX } from "./feel-data.js";

export const FEEL_SCHEMA = 1;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const SAFE = ["farm", "market"];
const GRABBERS = ["slow", "runner", "armor", "elite"];
const BODY_TYPES = ["slow", "runner", "screamer", "armor", "elite"];
const OPEN_PHASES = ["wait", "fight", "fence", "done"];
const SEEN_KEYS = ["arm", "hit", "shove", "roll", "stomp", "fence"];
const TRIP_KEYS = ["d", "r", "ph", "g", "res", "t", "hp", "gr", "bi", "ro", "k", "f", "by"];
const CUR_KEYS = ["d", "r", "ph", "g", "t0", "hp", "gr0", "bi0", "ro", "k0", "f"];
// 这些事件挂上发出声音的位置（感染者自己的事件挂它的位置，其余挂人的位置）；任务、升级、胜利这些是全屏的，不挂
const NO_POS = new Set(["menu", "closeMenu", "clearTarget", "quest", "level", "victory", "alarm", "travel", "sleep", "trade"]);

const feelDefaults = () => ({
  schema: FEEL_SCHEMA,
  open: { phase: "done", seen: {}, fence0: 0, rewarded: false, fled: false, crawled: false, rollTip: false },
  career: { trips: [], cur: null },
  later: 0,
  spaceTip: false,
  old: false,
  stats: { rolls: 0 },
});

export function migrateState(s) {
  gearMigrate(s);
  const d = feelDefaults();
  if (!s.feel) {
    // 旧档第一次读进来：开局那一拨不补（已经过了开局）
    s.feel = d;
    s.feel.old = true;
  } else {
    const x = s.feel;
    s.feel = {
      ...d,
      ...x,
      open: { ...d.open, ...x.open, seen: { ...x.open?.seen } },
      career: { trips: [...(x.career?.trips || [])].slice(-CAREER.max), cur: x.career?.cur || null },
      stats: { ...d.stats, ...x.stats },
    };
  }
  return s;
}
export function freshState() {
  const s = gearFresh();
  s.feel = feelDefaults();
  return migrateState(s);
}
// 开始新游戏用这一份：只有新开的家园才有开局那一拨
export function newGameState() {
  const s = freshState();
  s.feel.open.phase = "wait";
  return s;
}

const fxDefaults = () => ({
  clock: 0,
  hitstop: 0,
  lastStop: -9,
  roll: null,
  rollCd: 0,
  rollNote: 0,
  corpses: [],
  blood: [],
  react: new WeakMap(),
  region: null,
  chasing: false,
  fight: null,
  lastHp: null,
  lastHitBy: null,
});

export class Engine extends GearEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
  }
  get feel() {
    return this.s.feel;
  }
  get fx() {
    return (this._fx ??= fxDefaults());
  }

  // ================= 事件带上位置 =================
  emit(type, data = {}) {
    if (!NO_POS.has(type) && !Number.isFinite(data.x) && this.s?.player) {
      const src = this._emitSrc || this.s.player;
      data = { ...data, x: src.x, y: src.y };
      if (this._emitSrc) {
        data.z = this._emitSrc.type;
        data.id = this._emitSrc.id;
      }
    }
    if (type === "swing" && !data.kind) data = { ...data, kind: this._swingKind || this.swingKind(this.currentItem?.()) };
    return super.emit(type, data);
  }
  emitAt(type, z, extra = {}) {
    this.events.push({ type, x: z.x, y: z.y, z: z.type, id: z.id, ...extra });
  }
  swingKind(id) {
    if (MELEE[id]) return HEAVY_WEAPONS.includes(id) ? "heavy" : MELEE[id].kind;
    if (RANGED[id]) return RANGED[id].gun ? "gun" : id;
    if (THROWN[id]) return "throw";
    if (TRAPS[id]) return "trap";
    return "tool";
  }

  // ================= 翻滚（方法名用 dodge：roll 已经是前哨里掷随机数的方法） =================
  dodgeTier() {
    return this.armorTotals?.().tier?.id || "light";
  }
  dodgeCost() {
    return ROLL.cost + (ROLL.tier[this.dodgeTier()] || ROLL.tier.light).cost;
  }
  dodgeReason() {
    if (!this.gr) return "现在不能翻滚";
    if (this.paused) return "现在不能翻滚";
    const gx = this.gx;
    if (gx.grab) return "被抓住时滚不了：按 " + this.keyName("shove", "X").toUpperCase() + " 推开，或连按 " + this.keyName("interact", "E").toUpperCase();
    if (gx.down > 0) return "倒在地上，滚不了";
    if (this.fx.roll || this.fx.rollCd > 0) return "还在翻滚";
    if (this.buildMode) return "建造时不能翻滚";
    if (this.c?.fishing) return "钓鱼时不能翻滚";
    if (this.s.player.stamina < this.dodgeCost()) return "体力不够，滚不动";
    return "";
  }
  dodging() {
    return this.fx.roll;
  }
  dodge(dir = null) {
    const why = this.dodgeReason();
    if (why) {
      // 还在滚、暂停这些不出字；别的说一句（1.5 秒内不重复）
      if (why !== "还在翻滚" && !this.paused && this.fx.clock >= this.fx.rollNote) {
        this.fx.rollNote = this.fx.clock + 1.5;
        this.toast(why, "warn");
      }
      return false;
    }
    const p = this.s.player,
      tier = ROLL.tier[this.dodgeTier()] || ROLL.tier.light,
      a = dir && (dir.x || dir.y) ? Math.atan2(dir.y, dir.x) : p.facing ?? 0;
    p.stamina = Math.max(0, p.stamina - this.dodgeCost());
    this.fx.roll = { t: ROLL.time, a, dist: ROLL.dist * tier.dist, inv: ROLL.inv };
    this.fx.rollCd = ROLL.cd;
    this.invulnerable = Math.max(this.invulnerable || 0, ROLL.inv);
    this.reload = null;
    if (this.f) this.f.crouch = false;
    p.facing = a;
    this.noise.push({ x: p.x, y: p.y, r: ROLL.noise, t: 1 });
    this.feel.stats.rolls++;
    const cur = this.feel.career.cur;
    if (cur) cur.ro++;
    const o = this.feel.open;
    if (o.phase === "fight") o.seen.roll = true;
    this.emit("roll");
    return true;
  }
  // 老存档：以前按住空格是“用”（挥武器、用工具）；第一次按空格时说一句现在改成了什么
  spaceTip() {
    const f = this.feel;
    if (!f?.old || f.spaceTip) return false;
    f.spaceTip = true;
    this.toast("空格现在是翻滚（前 0.25 秒不受伤）。挥武器、用工具改成按住鼠标左键。", "gold");
    return true;
  }
  stepDodge(step) {
    const R = this.fx.roll;
    if (!R) return;
    const gx = this.gx;
    if (gx.grab || gx.down > 0) {
      this.fx.roll = null;
      return;
    }
    const p = this.s.player,
      k = Math.min(step, R.t),
      sp = R.dist / ROLL.time;
    this.moveEntity(p, Math.cos(R.a) * sp * k, Math.sin(R.a) * sp * k);
    p.facing = R.a;
    R.t -= k;
    R.inv -= k;
    if (R.inv > 0) this.invulnerable = Math.max(this.invulnerable || 0, R.inv);
    if (R.t <= 0) this.fx.roll = null;
  }
  // 滚的时候不能出手、不能用工具、不能扔东西、不能推
  use(target) {
    if (this.gr && this.fx.roll) return false;
    return super.use(target);
  }
  attack(target) {
    if (this.gr && this.fx.roll) return false;
    return super.attack(target);
  }
  throwItem(target, id) {
    if (this.gr && this.fx.roll) return false;
    this._swingKind = "throw";
    try {
      return super.throwItem(target, id);
    } finally {
      this._swingKind = null;
    }
  }
  shove() {
    if (this.gr && this.fx.roll) return false;
    const before = this.gr?.stats.shoves || 0,
      tutNear = this.feel.open.phase === "fight" && this.enemies.some((z) => z.tut && !z.dead && dist(z, this.s.player) < 70);
    const ok = super.shove();
    if (ok && tutNear && (this.gr?.stats.shoves || 0) > before) this.feel.open.seen.shove = true;
    return ok;
  }
  interact() {
    if (this.gr && this.fx.roll) return;
    const stomps = this.gr?.stats.stomps || 0,
      tutCrawl = this.feel.open.phase === "fight" && this.enemies.some((z) => z.tut && z.crawl && !z.dead);
    // 踩爬行者也会发出“挥”的事件：声音按踩的来
    this._swingKind = "stomp";
    let out;
    try {
      out = super.interact();
    } finally {
      this._swingKind = null;
    }
    if (tutCrawl && (this.gr?.stats.stomps || 0) > stomps) this.feel.open.seen.stomp = true;
    return out;
  }

  // ================= 打中：顿一下、往后仰、血、尸体 =================
  hurtEnemy(e, damage, angle, meta = {}) {
    if (!this.gr || !e || e.dead || e.nest) return super.hurtEnemy(e, damage, angle, meta);
    const h = this._hit || (meta?.id ? this.shotInfo?.(meta) : null),
      kind = h?.kind || (meta?.id ? "ranged" : "misc"),
      hp0 = e.hp,
      prev = this._emitSrc;
    this._emitSrc = e;
    try {
      super.hurtEnemy(e, damage, angle, meta);
    } finally {
      this._emitSrc = prev;
    }
    if (!(e.hp < hp0 || e.dead)) return;
    const killed = !!e.dead,
      fx = this.fx;
    if (kind !== "dot") {
      const heavy = (h?.knock || 0) >= REACT.heavyKnock || HEAVY_WEAPONS.includes(h?.id);
      if (!killed) fx.react.set(e, { t: heavy ? REACT.heavy : REACT.light, max: heavy ? REACT.heavy : REACT.light, a: angle, heavy, cut: !!(h?.knock >= RULES.knockInterrupt) });
      this.addBlood(e, killed ? "pool" : "drop");
      // 重甲：铁片和火星，不是血
      if (e.type === "armor") this.sparks(e);
      const stop = this.hitstopFor(h, killed);
      if (stop > 0 && fx.clock - fx.lastStop >= HITSTOP.gap) {
        fx.hitstop = stop;
        fx.lastStop = fx.clock;
      }
      if (heavy && ["blunt", "blade", "pole", "stomp"].includes(kind)) this.shake = Math.max(this.shake || 0, h?.id === "sledge" ? SHAKE.sledge : SHAKE.heavy);
      this.emitAt(e.type === "armor" ? "hitMetal" : "hitFlesh", e, { heavy, kill: killed });
    }
    if (killed) this.addCorpse(e);
    if (e.tut) this.tutHit(e, kind);
  }
  // 停多久：近战按武器类，打死那一下多一点；远程、投掷、陷阱、流血火烧不停
  hitstopFor(h, killed) {
    if (!h || !["blunt", "blade", "pole", "stomp"].includes(h.kind)) return 0;
    let t = HEAVY_WEAPONS.includes(h.id) ? HITSTOP.heavy : HITSTOP[h.kind] || 0;
    if (!t) return 0;
    if (killed) t += HITSTOP.kill;
    t = Math.min(HITSTOP.max, t);
    if (this.s.settings?.access?.calm) t *= 0.5;
    return t;
  }
  reactOf(z) {
    const r = this.fx.react.get(z);
    return r && r.t > 0 ? r : null;
  }
  // 画面用的小随机数：自己算，不动 Math.random（不改变战斗里的随机顺序）
  fxRand() {
    const fx = this.fx;
    fx.seed = ((fx.seed || 12345) * 16807) % 2147483647;
    return fx.seed / 2147483647;
  }
  sparks(e) {
    for (let i = 0; i < 5; i++) this.particles.push({ x: e.x, y: e.y - 22, vx: (this.fxRand() - 0.5) * 120, vy: -30 - this.fxRand() * 70, life: 0.3 + this.fxRand() * 0.25, max: 0.55, color: i % 2 ? "#ffcf6a" : "#f6b05a", size: 2 });
  }
  addBlood(e, kind) {
    const fx = this.fx,
      spark = e.type === "armor",
      big = kind === "pool";
    const jitter = () => (this.fxRand() - 0.5) * (big ? 10 : 22);
    fx.blood.push({ x: Math.round(e.x + jitter()), y: Math.round(e.y + 4 + jitter() * 0.5), big, spark, born: fx.clock, seed: Math.floor(this.fxRand() * 1000) + 1 });
    if (fx.blood.length > REMAINS.bloodMax) fx.blood.splice(0, fx.blood.length - REMAINS.bloodMax);
  }
  addCorpse(e) {
    if (!BODY_TYPES.includes(e.type)) return;
    const fx = this.fx;
    fx.corpses.push({ type: e.type, x: e.x, y: e.y, facing: e.facing ?? 0, crawl: !!e.crawl, born: fx.clock, id: e.id });
    if (fx.corpses.length > REMAINS.corpseMax) fx.corpses.splice(0, fx.corpses.length - REMAINS.corpseMax);
  }
  remains() {
    return { corpses: this.fx.corpses, blood: this.fx.blood, clock: this.fx.clock };
  }
  // 先放进去的先过期：只看最前面的
  tickRemains() {
    const fx = this.fx,
      c = fx.clock;
    while (fx.corpses.length && c - fx.corpses[0].born >= REMAINS.corpseLife + REMAINS.corpseFade) fx.corpses.shift();
    while (fx.blood.length && c - fx.blood[0].born >= REMAINS.bloodLife) fx.blood.shift();
  }

  // ================= 挨打：记下是谁打的 =================
  damagePlayer(n, opts = {}) {
    const z = opts.from || this._zAtk || this._emitSrc || null;
    if (z?.type) this.fx.lastHitBy = z.type;
    this.fx.lastHitTut = !!z?.tut;
    const out = super.damagePlayer(n, opts);
    const o = this.feel?.open;
    if (o?.phase === "fight" && this.s.region === "farm" && !this.paused) this.tutFloor();
    return out;
  }
  biteFrom(z, parts, extra = {}) {
    // 开局那一拨咬到了也不涨感染：先学会推开、挣开
    this._tutBite = !!z?.tut;
    try {
      return super.biteFrom(z, parts, extra);
    } finally {
      this._tutBite = false;
    }
  }
  infect(n, where = "") {
    if (this._tutBite) return;
    return super.infect(n, where);
  }
  die() {
    // 开局那一拨打不死人：最后一下是那一拨打的，血停在 25，剩下的转身走掉（别的伤、饿晕照旧）
    const o = this.feel?.open;
    if (o?.phase === "fight" && this.s.region === "farm" && !this._starve && this.fx.lastHitTut) {
      this.s.player.hp = OPENING.floor;
      this.tutFloor();
      return;
    }
    if (this.feel?.career.cur) this.endTrip("down", this._starve ? "hunger" : this.fx.lastHitBy);
    this.fx.roll = null;
    const out = super.die();
    this.fx.region = this.s.region;
    this.fx.corpses = [];
    this.fx.blood = [];
    return out;
  }

  // ================= 感染者每帧：给声音的事件 =================
  updateEnemy(e, dt) {
    if (e && !e.dead && e.type === "raider") {
      // 灰隼团开枪：枪声从他站的地方来
      const prev = this._emitSrc;
      this._emitSrc = e;
      try {
        return super.updateEnemy(e, dt);
      } finally {
        this._emitSrc = prev;
      }
    }
    if (!this.gr || !e || e.dead || e.nest) return super.updateEnemy(e, dt);
    if (e.tut && this.tutEnemy(e, dt)) return;
    const was = e.state,
      wind = e.windup > 0,
      reach = e.reach > 0,
      prev = this._emitSrc;
    this._emitSrc = e;
    try {
      super.updateEnemy(e, dt);
    } finally {
      this._emitSrc = prev;
    }
    if (e.dead) return;
    const p = this.s.player;
    if (was !== "chase" && e.state === "chase" && !e.horde && !e.tut && dist(e, p) < 520) this.emitAt("spot", e);
    if (!wind && e.windup > 0) {
      if (e.type === "screamer") this.emitAt("inhale", e);
      else if (GRABBERS.includes(e.type) && this.grabLikely(e)) this.emitAt("grabCue", e);
      else this.emitAt("windup", e);
    }
    if (!reach && e.reach > 0) this.emitAt("reach", e);
  }
  // 和画面上的“抓！”同一个条件：被围住，或它在你背后
  grabLikely(z) {
    const p = this.s.player,
      crowded = this.enemies.filter((o) => !o.dead && !o.nest && !o.crawl && dist(o, p) < RULES.grab.around).length >= 2,
      behind = angDiff(Math.atan2(z.y - p.y, z.x - p.x), p.facing ?? 0) > RULES.grab.behind;
    return crowded || behind;
  }

  // ================= 每帧 =================
  update(dt, input = { x: 0, y: 0, run: false }) {
    if (this.paused || !this.gr) return super.update(dt, input);
    const fx = this.fx,
      step = clamp(dt, 0, 0.05);
    fx.clock += step;
    if (fx.region !== this.s.region) this.changedRegion();
    // 命中停顿：整个世界一起停一下（你和被打的都顿住）
    if (fx.hitstop > 0) {
      fx.hitstop = Math.max(0, fx.hitstop - step);
      return;
    }
    fx.rollCd = Math.max(0, fx.rollCd - step);
    const inp = fx.roll ? { x: 0, y: 0, run: false } : input;
    super.update(dt, inp);
    if (this.paused) return;
    this.stepDodge(step);
    if (fx.region !== this.s.region) this.changedRegion();
    for (const z of this.enemies) {
      const r = fx.react.get(z);
      if (r && r.t > 0) r.t = Math.max(0, r.t - step);
    }
    this.tickRemains();
    this.careerTick();
    this.openingTick();
    this.laterTick();
  }
  changedRegion() {
    const fx = this.fx,
      from = fx.region,
      to = this.s.region,
      cur = this.feel.career.cur;
    fx.corpses = [];
    fx.blood = [];
    fx.hitstop = 0;
    // 第一次（刚读档）不打断翻滚；真的换了图才停
    if (from !== null) fx.roll = null;
    fx.region = to;
    if (cur && (from !== null || cur.r !== to)) this.endTrip(fx.chasing ? "fled" : "done");
    if (!SAFE.includes(to) && REGIONS[to] && !this.feel.career.cur) this.startTrip();
    fx.chasing = false;
    fx.fight = null;
    fx.lastHp = this.s.player.hp;
  }

  // ================= 生涯记录 =================
  startTrip() {
    const g = this.gr.slots,
      st = this.gr.stats;
    this.feel.career.cur = {
      d: this.s.day,
      r: this.s.region,
      ph: this.phase(),
      g: ["head", "body", "hands", "legs", "feet", "melee", "ranged"].map((k) => g[k] || ""),
      t0: Math.round(this.s.playSeconds || 0),
      hp: 0,
      gr0: st.grabs || 0,
      bi0: st.bites || 0,
      ro: 0,
      k0: this.s.stats.kills || 0,
      f: [],
    };
    this.fx.fight = null;
    this.fx.lastHp = this.s.player.hp;
  }
  endTrip(res, by = null) {
    const C = this.feel.career,
      cur = C.cur;
    if (!cur) return null;
    const fx = this.fx;
    if (fx.fight) this.closeFight(true);
    const st = this.gr?.stats || {},
      trip = {
        d: cur.d,
        r: cur.r,
        ph: cur.ph,
        g: cur.g,
        res: CAREER_RESULTS[res] ? res : "done",
        t: Math.max(0, Math.round((this.s.playSeconds || 0) - cur.t0)),
        hp: Math.round(cur.hp),
        gr: Math.max(0, (st.grabs || 0) - cur.gr0),
        bi: Math.max(0, (st.bites || 0) - cur.bi0),
        ro: cur.ro,
        k: Math.max(0, (this.s.stats.kills || 0) - cur.k0),
        f: cur.f.slice(0, 20),
        by: res === "down" ? (typeof by === "string" ? by.slice(0, 20) : null) : null,
      };
    C.trips.push(trip);
    if (C.trips.length > CAREER.max) C.trips.splice(0, C.trips.length - CAREER.max);
    C.cur = null;
    fx.fight = null;
    return trip;
  }
  closeFight(force = false) {
    const fx = this.fx,
      cur = this.feel.career.cur,
      f = fx.fight;
    if (!f) return;
    const len = f.last - f.t0;
    if (cur && len >= 0.5 && cur.f.length < 20) cur.f.push(Math.round(len * 10) / 10);
    fx.fight = null;
  }
  careerTick() {
    const cur = this.feel.career.cur,
      fx = this.fx,
      p = this.s.player,
      now = this.s.playSeconds || 0;
    const chasing = this.enemies.some((z) => !z.dead && !z.nest && z.type !== "raider" && (z.state === "chase" || z.windup > 0) && dist(z, p) < CAREER.chaseRange);
    fx.chasing = chasing;
    if (!cur) return;
    if (fx.lastHp != null && p.hp < fx.lastHp) cur.hp += fx.lastHp - p.hp;
    fx.lastHp = p.hp;
    if (chasing) {
      if (!fx.fight) fx.fight = { t0: now, last: now };
      else fx.fight.last = now;
    } else if (fx.fight && now - fx.fight.last > CAREER.fightGap) this.closeFight();
  }
  // 地图 × 三段：去了几趟、倒下几成、一场仗多久（中位数）
  careerTable() {
    const rows = new Map();
    for (const t of this.feel.career.trips) {
      const key = t.r + ":" + t.ph;
      if (!rows.has(key)) rows.set(key, { r: t.r, ph: t.ph, trips: 0, down: 0, fled: 0, fights: [] });
      const row = rows.get(key);
      row.trips++;
      if (t.res === "down") row.down++;
      if (t.res === "fled") row.fled++;
      row.fights.push(...(t.f || []));
    }
    const median = (a) => {
      if (!a.length) return null;
      const s = [...a].sort((x, y) => x - y),
        m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : Math.round(((s[m - 1] + s[m]) / 2) * 10) / 10;
    };
    return [...rows.values()]
      .map((r) => ({ r: r.r, ph: r.ph, trips: r.trips, down: r.down, fled: r.fled, downPct: Math.round((r.down / r.trips) * 100), fight: median(r.fights) }))
      .sort((a, b) => a.ph - b.ph || String(a.r).localeCompare(String(b.r)));
  }

  // ================= 新档开局那一拨 =================
  openingTick() {
    const o = this.feel.open;
    if (o.phase === "done") return;
    if (o.phase === "wait") {
      if (this.s.region !== "farm") return;
      if (this.s.day === 1 && this.s.minute < OPENING.at) return;
      if (["warning", "active"].includes(this.s.horde.phase)) return;
      if (this.raidState && ["warning", "active"].includes(this.raidState().phase)) return;
      this.startOpening();
      return;
    }
    if (o.phase === "fight") {
      if (!o.seen.arm && this.s.slot === 3) o.seen.arm = true;
      if (this.s.region !== "farm") return;
      this.tutFloor();
      const left = this.enemies.filter((z) => z.tut && !z.dead);
      if (!left.length) this.endOpeningFight();
      return;
    }
    if (o.phase === "fence" && this.roadFenced(o.fence0)) this.finishOpening();
  }
  startOpening() {
    const o = this.feel.open,
      p = this.s.player;
    for (const [type, x, y] of OPENING.pack) {
      const q = this.freePoint(x, y),
        z = this.enemy(type, q.x, q.y);
      Object.assign(z, { tut: true, state: "chase", alert: 8, targetX: p.x, targetY: p.y });
      this.enemies.push(z);
    }
    o.phase = "fight";
    o.fled = false;
    this.toast("东边林间小路上，几个感染者摇摇晃晃朝农场走来了！", "warn");
    this.events.push({ type: "wave", x: OPENING.road.x, y: OPENING.road.y });
  }
  // 打不死人：血掉到 30 以下，剩下的转身走掉；这一拨最多打到 25
  tutFloor() {
    const o = this.feel.open,
      p = this.s.player;
    if (o.phase !== "fight") return;
    // 只托住那一拨（和它们抓出来的流血）造成的伤
    if (p.hp < OPENING.floor && this.fx.lastHitTut) p.hp = OPENING.floor;
    if (p.hp < OPENING.flee && !o.fled) {
      o.fled = true;
      for (const z of this.enemies) if (z.tut && !z.dead) z.flee = true;
      this.gx.bleed = 0;
      this.toast("它们见你拼命，转身往林子里退了。先回农舍喘口气，吃点东西。", "warn");
    }
  }
  tutEnemy(e, dt) {
    const o = this.feel.open;
    if (e.flee || o.phase !== "fight") {
      const X = OPENING.exit,
        a = Math.atan2(X.y - e.y, X.x - e.x),
        sp = this.enemySpeed(e) * 1.1;
      e.facing = a;
      e.windup = 0;
      e.lunge = null;
      e.state = "patrol";
      e.holding = false;
      if (this.gx.grab?.z === e) this.releaseGrab(false);
      this.moveEntity(e, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, true);
      e.fleeT = (e.fleeT || 0) + dt;
      if (dist(e, X) < 60 || e.fleeT > 12) {
        e.dead = true;
        e.gone = true;
      }
      return true;
    }
    const p = this.s.player;
    e.state = "chase";
    e.alert = Math.max(e.alert || 0, 3);
    e.targetX = p.x;
    e.targetY = p.y;
    return false;
  }
  tutHit(e, kind) {
    const o = this.feel.open;
    if (o.phase !== "fight") return;
    if (["blunt", "blade", "pole", "stomp", "ranged", "throw"].includes(kind)) o.seen.hit = true;
    // 第一只被打得只剩三成血的游荡者一定摔成爬行者，好教“踩”
    if (!o.crawled && !e.dead && !e.crawl && e.type === "slow" && e.hp < e.maxHp * RULES.crawl.below && ["blunt", "blade", "pole"].includes(kind)) {
      o.crawled = true;
      e.crawl = true;
      e.windup = 0;
      e.lunge = null;
      e.reach = 0;
      e.cooldown = 1;
      this.gr.stats.crawlers++;
      this.effects.push({ x: e.x, y: e.y - 40, text: "摔成爬行者", t: 0.8, color: "#e6c48a" });
    }
  }
  endOpeningFight() {
    const o = this.feel.open;
    o.phase = "fence";
    // 之后在东边路口附近新建的围栏或大门才算；路口本来就有完好的围栏，直接算堵上了
    o.fence0 = this.s.idCounter || 0;
    if (this.roadFenced(0)) {
      this.toast("打退了！", "gold");
      this.events.push({ type: "victory" });
      this.finishOpening();
      return;
    }
    if (!o.seen.roll && !o.rollTip) {
      o.rollTip = true;
      this.toast("记住翻滚（空格，触屏上是“翻滚”按钮）：被扑、被撞时往旁边滚，前 0.25 秒不受伤。", "gold");
    }
    this.toast("打退了！东边路口没东西挡着——建一段围栏把它堵上。", "gold");
    this.events.push({ type: "victory" });
  }
  roadFenced(since = 0) {
    const f = OPENING.fence;
    return this.s.buildings.some((b) => ["fence", "gate"].includes(b.type) && b.hp > 0 && Number(String(b.id).replace(/\D/g, "")) >= since && dist(b, f) < f.r);
  }
  finishOpening() {
    const o = this.feel.open;
    o.phase = "done";
    o.seen.fence = true;
    if (o.rewarded) return;
    o.rewarded = true;
    this.receive({ ...OPENING.reward });
    const worn = this.isWorn?.("ragHood");
    this.toast("路口堵上了。这块破布头巾给你（" + (worn ? "已经戴上了" : "在背包里，头栏空出来就能戴") + "，挡一点咬）。削尖木矛：木材 3，在“制作”里随身就能做，正面能顶住扑过来的奔跑者。", "gold");
    this.events.push({ type: "quest" });
  }
  // 那一拨里奔跑者蹲身、摔成爬行者：开局提示条正在教，就不再另外弹一句（没碰到的以后照常提示）
  tip(key, text) {
    if (this.feel?.open?.phase === "fight" && this.s.region === "farm" && ["lunge", "crawl"].includes(key)) {
      if (this.gr) this.gr.warned[key] ??= this.s.day;
      return;
    }
    return super.tip(key, text);
  }
  // 开局提示：一次只说一件事
  coach() {
    const o = this.feel?.open;
    if (!o || o.phase === "done" || o.phase === "wait" || this.s.region !== "farm") return null;
    const fill = (t) => t.replace("{shove}", this.keyName("shove", "X").toUpperCase()).replace("{interact}", this.keyName("interact", "E").toUpperCase()).replace("{build}", this.keyName("build", "B").toUpperCase());
    if (o.phase === "fence") return o.seen.fence ? null : { id: "fence", text: fill(COACH.fence) };
    const tut = this.enemies.filter((z) => z.tut && !z.dead && !z.flee);
    if (!tut.length) return null;
    const p = this.s.player;
    if (!o.seen.roll && tut.some((z) => z.lunge?.phase === "crouch")) return { id: "roll", text: COACH.roll };
    if (!o.seen.stomp && tut.some((z) => z.crawl)) return { id: "stomp", text: fill(COACH.stomp) };
    if (!o.seen.shove && tut.filter((z) => !z.crawl && dist(z, p) < 100).length >= 2) return { id: "shove", text: fill(COACH.shove) };
    if (!o.seen.arm && this.s.slot !== 3) return { id: "arm", text: COACH.arm };
    if (!o.seen.hit) return { id: "hit", text: COACH.hit };
    return null;
  }

  // ================= 每日抉择：稍后再选 =================
  dailyDeferred() {
    return !!this.dailyCard?.() && this.feel?.later === this.s.day;
  }
  dailyLaterReason() {
    if (!this.dailyCard?.()) return "今天没有要决定的事";
    if (this.feel.later === this.s.day) return "已经放着了";
    if (this.s.minute >= LATER.deadline) return "已经过了中午";
    return "";
  }
  dailyLater() {
    const why = this.dailyLaterReason();
    if (why) {
      this.toast(why, "warn");
      return false;
    }
    this.feel.later = this.s.day;
    this.toast("这张卡先放着：12:00 前在任务手记或顶上的提醒里打开。" + this.dailyNoonText(), "gold");
    return true;
  }
  // 到了中午会怎样：有不吃亏的那一项就替你选它，没有就把卡片拿出来
  dailyNoonText() {
    const p = this.dailyCard?.(),
      i = p ? this.freeDailyOption(p) : -1;
    if (i >= 0) return "过了中午还没选，就按「" + EVENTS[p.id].opts[i].label + "」算。";
    return "这张卡没有不吃亏的选项，到了中午会再拿出来，要你定。";
  }
  dailyShouldShow() {
    if (this.dailyDeferred()) return false;
    return super.dailyShouldShow();
  }
  // 中午还没选：挑一项真的不吃亏的——不花东西、不花钱、不冒险，也不耗时间、不卖东西、不招来感染者、不掉血不扣钱
  freeDailyOption(p = this.dailyCard()) {
    if (!p) return -1;
    const opts = EVENTS[p.id]?.opts || [];
    for (let i = 0; i < opts.length; i++) if (safeDailyOption(opts[i]) && !this.optionReason(i, p)) return i;
    return -1;
  }
  laterTick() {
    if (!this.dailyDeferred() || this.s.minute < LATER.deadline) return;
    const p = this.dailyCard(),
      i = this.freeDailyOption(p);
    if (i < 0) {
      // 没有不吃亏又能选的：卡片照旧弹出来，要定下来
      this.feel.later = -this.s.day;
      this.toast("到中午了，这张卡没有不吃亏的选项，要你定下来。", "warn");
      return;
    }
    const label = EVENTS[p.id].opts[i].label,
      r = this.chooseDaily(i),
      lines = r?.lines || this.dy?.pending?.lines || [];
    const text = "到中午了，今日抉择按「" + label + "」算" + (lines.length ? "：" + lines.slice(0, 3).join("；") : "。");
    this.toast(text, "gold");
    this.olog?.("每日抉择：" + EVENTS[p.id].name + " · " + text);
  }

  // ================= 睡觉：平安的早上不弹日终总结 =================
  sleep() {
    if (!this.feel) return super.sleep();
    if (this.dailyDeferred() && this.s.region === "farm") {
      this.toast("睡前先把今天的事定了。", "gold");
      this.emit("menu", { menu: "outpost", view: "daily", id: "" });
      return false;
    }
    const o = this.o,
      mark = o?.log?.[0] || null,
      n0 = this.events.length;
    const ok = super.sleep();
    if (!ok || !o?.report) return ok;
    const added = [];
    for (const l of o.log) {
      if (l === mark) break;
      added.push(l);
    }
    const food = this.foodDays?.() ?? 9,
      day = this.s.day,
      r = this.raidState?.(),
      hd = this.c?.nextHordeDay,
      bad =
        food < 2 ||
        added.some((l) => l.tone === "warn") ||
        // 灰隼团今天或明天来、尸潮在预警或一天内要来、营地有病号、自己发烧：照样弹整页
        (r?.phase === "scheduled" && r.day - day <= 1) ||
        ["warning", "active"].includes(r?.phase) ||
        ["warning", "active"].includes(this.s.horde?.phase) ||
        (hd && (this.s.stats.hordes || 0) > 0 && hd - day <= 1) ||
        (this.o?.sick || 0) >= day ||
        !!this.gr?.fever;
    if (!bad) {
      const k = this.events.findIndex((ev, i) => i >= n0 && ev.type === "menu" && ev.view === "summary");
      if (k >= 0) this.events.splice(k, 1);
      const r = o.report,
        sign = (v) => (v > 0 ? "+" + v : String(v)),
        line = "第" + r.day + "天平安过去：金币 " + sign(r.money) + " · 击败 " + r.kills + " · 收获 " + r.harvested + " 株 · 口粮 " + r.foodStart + "→" + r.foodEnd + " 份（还能撑 " + r.days + " 天）";
      this.olog?.(line);
      this.toast(line + "。全文在消息记录里。");
    }
    return ok;
  }

  // ================= 手记最上面：今天 =================
  todayItems() {
    const out = [],
      add = (pri, text, action = "", id = "") => out.push({ pri, text, action, id });
    if (!this.feel) return out;
    const s = this.s;
    const card = this.dailyCard?.();
    if (card && s.minute >= 360) add(0, this.dailyDeferred() ? "今日抉择还没选（12:00 前）" : "今日抉择还没选", "dView", "daily");
    const o = this.feel.open;
    if (o.phase === "fence") add(0, "把东边路口堵上：建一段围栏", "feelBuild", "fence");
    else if (o.phase === "fight") add(0, "东边来的感染者还没打退", "", "");
    const r = this.raidState?.();
    if (r?.phase === "scheduled" && r.day - s.day <= 2 && r.day >= s.day) add(1, (r.day === s.day ? "今晚" : r.day === s.day + 1 ? "明天" : "后天") + " 19:00 灰隼团来", "", "");
    else if (r && ["warning", "active"].includes(r.phase)) add(0, "灰隼团在进攻", "", "");
    const hd = this.c?.nextHordeDay;
    if (hd && (s.stats.hordes || 0) > 0 && hd - s.day <= 2 && hd >= s.day && !["warning", "active"].includes(s.horde.phase)) add(1, (hd === s.day ? "今天" : hd === s.day + 1 ? "明天" : "后天") + "可能有尸潮", "", "");
    const food = this.foodDays?.();
    if (Number.isFinite(food) && food < 2) add(1, "口粮只够 " + food + " 天", "", "");
    if (this.gr?.fever) add(2, this.gr.cure ? "发烧：今晚睡一觉就好" : "发烧：吃一份药包，再睡一晚", "", "");
    const broken = (this.wornIds?.() || []).filter((id) => this.broken?.(id));
    if (broken.length) add(2, (ITEMS[broken[0]]?.name || "装备") + "坏了，回武器台修", "rOpen", "frontier:combat");
    return out.sort((a, b) => a.pri - b.pri).slice(0, TODAY_MAX);
  }

  // ================= 存档 =================
  static parse(text) {
    const raw = JSON.parse(text),
      s = GearEngine.parse(text);
    if (raw.feel !== undefined) validateFeel(raw.feel);
    return migrateState(s);
  }
}

// 每日抉择的一项“不吃亏”：不花东西、不花钱、不冒险；效果里没有耗时间、卖东西、招感染者、丢东西、欠债、生病、扣血扣钱扣心情……
const HARMFUL_OPS = ["time", "payGoods", "sellTop", "spawn", "ambush", "lose", "debt", "night", "sick", "stationHit", "killJob", "drain", "visitBlock", "hordeShift", "hordeTomorrow", "random", "growthBack"];
const SIGNED_OPS = ["hp", "money", "mood", "rep", "stamina", "trust"];
export function safeDailyOption(o) {
  if (!o || o.cost || o.pay || o.p) return false;
  for (const op of o.fx || []) {
    const [kind, ...args] = op;
    if (HARMFUL_OPS.includes(kind)) return false;
    if (SIGNED_OPS.includes(kind) && args.some((a) => typeof a === "number" && a < 0)) return false;
    if (kind === "fatigue" && args.some((a) => typeof a === "number" && a > 0)) return false;
  }
  return true;
}

function validateFeel(x) {
  const object = (v) => v && typeof v === "object" && !Array.isArray(v),
    int = (v, min = 0, max = 1e7) => Number.isInteger(v) && v >= min && v <= max,
    num = (v, min = 0, max = 1e9) => Number.isFinite(v) && v >= min && v <= max,
    str = (v, max = 40) => typeof v === "string" && v.length <= max,
    bad = () => {
      throw Error("存档里的生涯记录损坏，请从设置恢复有效备份；原存档会保留。");
    },
    d = feelDefaults();
  if (!object(x) || x.schema !== FEEL_SCHEMA || Object.keys(x).some((k) => !Object.hasOwn(d, k))) bad();
  if (x.open !== undefined) {
    const o = x.open;
    if (!object(o) || !OPEN_PHASES.includes(o.phase ?? "done")) bad();
    if (o.seen !== undefined && (!object(o.seen) || Object.entries(o.seen).some(([k, v]) => !SEEN_KEYS.includes(k) || typeof v !== "boolean"))) bad();
    if (o.fence0 !== undefined && !int(o.fence0, 0, 1e9)) bad();
    for (const k of ["rewarded", "fled", "crawled", "rollTip"]) if (o[k] !== undefined && typeof o[k] !== "boolean") bad();
    if (Object.keys(o).some((k) => !["phase", "seen", "fence0", "rewarded", "fled", "crawled", "rollTip"].includes(k))) bad();
  }
  const gear = (g) => Array.isArray(g) && g.length <= 8 && g.every((id) => id === "" || (str(id, 30) && Object.hasOwn(ITEMS, id)));
  const trip = (t, keys) => object(t) && Object.keys(t).every((k) => keys.includes(k)) && int(t.d, 1, 99999) && Object.hasOwn(REGIONS, t.r) && int(t.ph, 0, 2) && gear(t.g || []);
  if (x.career !== undefined) {
    const c = x.career;
    if (!object(c) || !Array.isArray(c.trips) || c.trips.length > CAREER.max) bad();
    for (const t of c.trips) {
      if (!trip(t, TRIP_KEYS) || !Object.hasOwn(CAREER_RESULTS, t.res) || !num(t.t) || !num(t.hp, 0, 1e6) || !int(t.gr) || !int(t.bi) || !int(t.ro) || !int(t.k) || !Array.isArray(t.f) || t.f.length > 20 || t.f.some((v) => !num(v, 0, 1e5)) || !(t.by === null || str(t.by, 20))) bad();
    }
    if (c.cur !== null && c.cur !== undefined) {
      const t = c.cur;
      if (!trip(t, CUR_KEYS) || !num(t.t0) || !num(t.hp, 0, 1e6) || !int(t.gr0) || !int(t.bi0) || !int(t.ro) || !int(t.k0) || !Array.isArray(t.f) || t.f.length > 20 || t.f.some((v) => !num(v, 0, 1e5))) bad();
    }
  }
  if (x.later !== undefined && !int(x.later, -99999, 99999)) bad();
  for (const k of ["spaceTip", "old"]) if (x[k] !== undefined && typeof x[k] !== "boolean") bad();
  if (x.stats !== undefined && (!object(x.stats) || Object.entries(x.stats).some(([k, v]) => k !== "rolls" || !int(v, 0, 1e9)))) bad();
}
