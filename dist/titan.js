// v0.36.0「巨影」：《余烬农场：十凶方案》第一版——十凶共用的规矩和前五凶（河伯、收破烂的、〇号、黑瞎子、白毛风）。
// 1. 地盘：每一凶在一张图上有自己的窝，走近了它才醒，追出地盘它回窝；窝以外的柜子、感染者、收成照旧。
// 2. 预兆：每一下伤人的招都先在地上画出来（strikes），到点了你还在里面才挨；毒雾、泥、水、冰、火是地上的一片（zones）；
//    扔过来的木头是一条往前飞的（shots）。
// 3. 打晃、换段、越打越疯、回窝回四分之一血、第二天回满、打赢以后 28 天卷土重来。
// 4. 第一次打赢：战利品（捐进档案馆十凶柜）、凶器、那片地方的变化；再打赢给金币和稀有货。
// 5. 传闻：它第一次能碰上时早上说一句，世界地图标出窝；每日抉择里的传闻卡、在它手里倒下一次，都能学到打法。
// 新进度放在 s.titan，原来的字段一个不加。十凶本身每次进图重新生出来，不存进存档的感染者名单。
import { Engine as NfEngine, freshState as nfFresh, migrateState as nfMigrate, newGameState as nfNewGame, newGamePlusState as nfNewGamePlus, needsUpgrade as nfNeedsUpgrade, legacyGear } from "./nightfall.js";
import { hashOf, rngOf } from "./undertow.js";
import { ITEMS, REGIONS, WORLD } from "./data.js";
import { INFECTION } from "./gear-data.js";
import { TRULES, TITANS, TITAN_IDS, TITAN_TYPES, TITAN_ORDER, TITAN_SLOTS, POD_TYPE, TITAN_TROPHY_IDS, TITAN_CASE, TITAN_ARMOR, TITAN_MELEE, PERK_DROPS, SCRAP_GIFT, ZERO_BITE, FROST_COLD, TITAN_INTRO, TITAN_SCHEMA, tPoss } from "./titan-data.js";
import { AI, PHASE_HOOK, HURT_HOOK, SPAWN_HOOK, WAKE_HOOK } from "./titan-ai.js";

export { legacyGear };
export const needsUpgrade = (text) => {
  if (nfNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !raw.titan;
  } catch {
    return false;
  }
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const inRect = (p, r, pad = 0) => p.x >= r.x - pad && p.x <= r.x + r.w + pad && p.y >= r.y - pad && p.y <= r.y + r.h + pad;
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " ×" + n)
    .join("、");
const STAT_KEYS = ["fights", "wins", "falls", "staggers", "phases", "strikes", "hits", "gifts", "donated", "told"];
const tDefaults = () => ({
  schema: TITAN_SCHEMA,
  // 第一次撞见、第一次听说（传闻）、学到打法的那天
  seen: {},
  rumor: {},
  intel: {},
  // 打了几回、打赢几回、第一次打赢那天、最快一场（秒）、在它手里倒下几回
  tries: {},
  wins: {},
  first: {},
  best: {},
  falls: {},
  // 当天打掉的血（{ hp, day }）：第二天 06:00 回满
  hp: {},
  // 打赢那天（28 天后回来）、回来过几次
  gone: {},
  back: {},
  // 战利品、凶器、地方的变化：给的那天
  trophy: {},
  gear: {},
  perks: {},
  // 捐进十凶柜的战利品、拿过的那几档
  donated: [],
  caseDone: [],
  // 每天、每周的东西拿过的那天
  gifts: {},
  // 说过一次的话
  told: {},
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
});
// 十凶和孢囊不进存档：读档时从各张图的感染者名单里拿掉，进图时重新生出来（打掉的血记在 s.titan.hp 里）
const isTitanThing = (z) => !!z && (z.titan || z.type === POD_TYPE || Object.hasOwn(TITAN_TYPES, z.type));
function stripTitans(s) {
  for (const [id, list] of Object.entries(s.enemies || {})) if (Array.isArray(list) && list.some(isTitanThing)) s.enemies[id] = list.filter((z) => !isTitanThing(z));
}
// 只补十凶这一块：下面几层由它们自己的构造、读档迁移（多迁一遍会多抽一次随机数，各台的同一个种子就对不上上一版了）
function tMigrate(s) {
  if (!s.titan) {
    s.titan = tDefaults();
    // 旧档：第一帧一张“巨影”卡片（新开的档在下面删掉）
    s.titan.intro = { day: s.day || 1, told: false };
  } else {
    const d = tDefaults(),
      x = s.titan;
    s.titan = { ...d, ...x, stats: { ...d.stats, ...x.stats } };
  }
  stripTitans(s);
  return s;
}
export function migrateState(s) {
  nfMigrate(s);
  return tMigrate(s);
}
const fresh = (s) => {
  delete s.titan;
  tMigrate(s);
  delete s.titan.intro;
  return s;
};
export function freshState() {
  return fresh(nfFresh());
}
export function newGameState(origin = "farmer") {
  return fresh(nfNewGame(origin));
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  return fresh(nfNewGamePlus(old, origin, keep, book));
}

// 不存进存档、每次进图清空的东西
const transient = () => ({ strikes: [], shots: [], zones: [], fx: [], rings: [], hold: null, slowT: 0, slowK: 1, noRun: 0, vel: null, cold: 0, fogFor: null, white: 0, place: null, serial: 1 });

export class Engine extends NfEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(tMigrate(s), notify);
    this.tx = transient();
    this._tRegion = this.s.region;
    // 凶台用：强行打开某一凶（不看日子、不看时辰）
    this._tForce = null;
  }
  get tg() {
    return this.s.titan;
  }
  // 不进存档的东西（地上的预兆、毒雾、飞过来的木头……）：底下几层在构造时就会换图，先备好
  get tx() {
    return (this._tx ||= transient());
  }
  set tx(v) {
    this._tx = v;
  }
  tStat(k, n = 1) {
    if (this.tg) this.tg.stats[k] = (this.tg.stats[k] || 0) + n;
  }
  tRoll(...parts) {
    return rngOf(hashOf(this.ut?.seed ?? 1, "titan", ...parts))();
  }

  // ================= 什么时候有它 =================
  // 今天打不了仗的日子：长夜、尸潮、灰隼团袭击那天十凶不出窝
  titanBusyDay() {
    if (this.isLongNight?.() || this.ln?.night) return true;
    const h = this.s.horde;
    if (h && ["warning", "active"].includes(h.phase)) return true;
    const r = this.raidState?.();
    return !!(r && ["warning", "active"].includes(r.phase));
  }
  titanOpen(id) {
    const T = TITANS[id];
    if (!T || !this.tg) return false;
    if (this._tForce === id) return true;
    try {
      return !!T.open(this);
    } catch {
      return false;
    }
  }
  // 打赢以后还没回来
  titanGone(id) {
    const g = this.tg?.gone?.[id];
    return g != null && this.s.day < g + TRULES.back;
  }
  // 它这会儿在不在窝里（天黑以后才出来的、打赢以后没回来的、今天有长夜的都不在）
  titanHome(id, minute = this.s.minute) {
    const T = TITANS[id];
    if (!this.titanOpen(id) || this.titanGone(id)) return false;
    if (this._tForce === id) return true;
    if (this.titanBusyDay()) return false;
    if (T.hours) {
      const { from, to } = T.hours;
      const on = from > to ? minute >= from || minute < to : minute >= from && minute < to;
      if (!on) return false;
    }
    return true;
  }
  // 听说过它了（地图上标出窝、传闻卡会出）
  titanKnown(id) {
    return !!(this.tg?.rumor?.[id] || this.tg?.seen?.[id]);
  }
  titanMaxHp(id) {
    const T = TITANS[id],
      n = Math.min(TRULES.backMax, this.tg?.back?.[id] || 0);
    return Math.round(T.hp * (1 + TRULES.backHp * n));
  }
  // 这一张图上的那一凶（醒着或睡着；〇号分成两半时是两只）
  titansHere(id = null) {
    return (this.enemies || []).filter((z) => z.titan && !z.dead && (!id || z.titan === id));
  }
  titanAwake() {
    return (this.enemies || []).find((z) => z.titan && !z.dead && z.awake) || null;
  }

  // ================= 生出来、回窝 =================
  titanSync() {
    const g = this.tg;
    if (!g) return;
    const region = this.s.region;
    for (const id of TITAN_IDS) {
      const T = TITANS[id];
      // 第一次能碰上：早上 7 点以后说一句（传闻），地图上标出窝；同一天只说一凶，旧档一下开了好几凶的，一天一凶慢慢说
      if (!g.rumor[id] && this.s.minute >= 7 * 60 && g.told.rumorDay !== this.s.day && this.titanOpen(id) && !this.titanGone(id) && !this._tForce) {
        g.rumor[id] = this.s.day;
        g.told.rumorDay = this.s.day;
        this.toast(T.rumor, "warn");
        if (this.o) this.olog?.(T.rumor, "warn");
      }
      // 打赢以后 28 天：回来了
      if (g.gone[id] != null && this.s.day >= g.gone[id] + TRULES.back) {
        delete g.gone[id];
        g.back[id] = Math.min(TRULES.backMax, (g.back[id] || 0) + 1);
        delete g.hp[id];
        const text = T.name + "又回来了（" + REGIONS[T.region].name + "）：比上回更难打。";
        this.toast(text, "warn");
        if (this.o) this.olog?.(text, "warn");
      }
      if (T.region !== region) continue;
      const here = this.titansHere(id);
      const home = this.titanHome(id);
      if (!here.length && home) this.spawnTitan(id);
      // 天亮了河伯回河里、长夜那天不出来：睡着的就收走（醒着的打完再说）
      else if (here.length && !home && !here.some((z) => z.awake || z.homing)) this.dropTitan(id);
    }
  }
  spawnTitan(id) {
    const T = TITANS[id],
      max = this.titanMaxHp(id),
      rec = this.tg.hp[id],
      today = !!rec && rec.day === this.s.day,
      hp = today ? clamp(rec.hp, 1, max) : max,
      q = { x: T.lair.x, y: T.lair.y },
      e = this.enemy(T.type, q.x, q.y);
    Object.assign(e, {
      titan: id,
      hp,
      maxHp: max,
      r: T.r,
      tp: 0,
      act: null,
      cd: {},
      poise: 0,
      poiseMax: T.poise,
      poiseT: 0,
      stag: 0,
      inv: 0,
      awake: false,
      homing: false,
      fightT: 0,
      homeX: q.x,
      homeY: q.y,
      state: "patrol",
      facing: Math.PI / 2,
      mode: "lair",
      dealt: {},
      // 当天回过四分之一血了没有（回窝、换图都算一次）
      regenUsed: today && !!rec.used,
    });
    e.tp = this.titanPhaseOf(e);
    SPAWN_HOOK[id]?.(this, e);
    this.enemies.push(e);
    return e;
  }
  dropTitan(id) {
    const keep = (this.enemies || []).filter((z) => !(z.titan === id || (z.type === POD_TYPE && z.of === id)));
    if (keep.length !== this.enemies.length) this.enemies = this.s.enemies[this.s.region] = keep;
    this.tx.zones = this.tx.zones.filter((Z) => Z.data?.of !== id);
  }
  // 当天打掉的血记一笔（第二天 06:00 回满）
  titanSave(e) {
    if (!e?.titan || !this.tg) return;
    const id = e.titan,
      all = this.titansHere(id),
      hp = all.reduce((a, z) => a + Math.max(0, z.hp), 0);
    if (hp >= this.titanMaxHp(id) - 0.5) delete this.tg.hp[id];
    else this.tg.hp[id] = { hp: Math.max(1, Math.round(hp)), day: this.s.day, used: !!e.regenUsed };
  }
  // 06:00：昨天打掉的血回满
  titanHeal() {
    const g = this.tg;
    if (!g || this.s.minute < TRULES.healHour) return;
    for (const [id, rec] of Object.entries(g.hp)) {
      if (rec.day >= this.s.day) continue;
      delete g.hp[id];
      for (const list of Object.values(this.s.enemies || {}))
        for (const z of Array.isArray(list) ? list : []) if (z.titan === id && !z.dead && !z.awake) Object.assign(z, { hp: z.maxHp, tp: 0 });
    }
  }
  // 醒了：第一次撞见停一张卡片；窝附近的普通感染者躲开
  titanWake(e) {
    if (e.awake) return;
    const T = TITANS[e.titan],
      g = this.tg,
      first = !g.seen[e.titan];
    e.awake = true;
    e.homing = false;
    e.fightT = 0;
    e.state = "chase";
    e.mode = e.mode === "lair" ? "up" : e.mode;
    g.tries[e.titan] = (g.tries[e.titan] || 0) + 1;
    this.tStat("fights");
    if (first) {
      g.seen[e.titan] = this.s.day;
      g.rumor[e.titan] ??= this.s.day;
      this.moment?.("titan", T.name + " · " + T.title, T.lore, { titan: e.titan });
      this.tipOnce?.("titan:" + e.titan, T.tip);
    }
    const p = this.s.player;
    this.enemies = this.s.enemies[this.s.region] = this.enemies.filter((z) => z.titan || z.of || z.tAdd || z.dead || dist(z, { x: T.lair.x, y: T.lair.y }) > TRULES.clear || dist(z, p) < 120);
    this.events.push({ type: "bossIntro", x: e.x, y: e.y, boss: "titan" });
    this.tEmit(e, "tRoar", { range: 1600, duck: true, stinger: first ? "titan" : null });
    WAKE_HOOK[e.titan]?.(this, e);
  }
  // 回窝：路上和到了窝里一共回四分之一血（这一天只回一次）
  titanHome0(e) {
    if (e.homing) return;
    e.homing = true;
    e.act = null;
    e.regenLeft = Math.min(e.maxHp - e.hp, e.maxHp * TRULES.regen * (e.regenUsed ? 0 : 1));
    e.regenUsed = true;
    this.tClearFrom(e);
    this.tSay(e, "回窝了", "#cfc6a8");
  }
  // 换图了：原来那张图上醒着的那一凶回窝、回四分之一血
  titanLeftRegion(from) {
    const list = this.s.enemies?.[from];
    if (!Array.isArray(list)) return;
    const seen = new Set();
    for (const z of list) {
      if (!z.titan || z.dead) continue;
      if (z.awake || z.homing) {
        const add = z.regenUsed ? 0 : z.maxHp * TRULES.regen;
        z.hp = Math.min(z.maxHp, z.hp + add);
        z.regenUsed = true;
      }
      Object.assign(z, { awake: false, homing: false, act: null, x: z.homeX, y: z.homeY, mode: "lair", stag: 0 });
      if (!seen.has(z.titan)) {
        seen.add(z.titan);
        const all = list.filter((x) => x.titan === z.titan && !x.dead),
          hp = all.reduce((a, x) => a + Math.max(0, x.hp), 0);
        if (hp < this.titanMaxHp(z.titan) - 0.5) this.tg.hp[z.titan] = { hp: Math.max(1, Math.round(hp)), day: this.s.day, used: !!z.regenUsed };
      }
    }
    // 〇号的两半回到一只、孢囊收掉：下回进图重新生
    this.s.enemies[from] = list.filter((z) => !isTitanThing(z));
  }

  // ================= 每帧 =================
  update(dt, input = {}) {
    const p = this.s.player,
      g = this.tg;
    if (this.paused || !g) return super.update(dt, input);
    const step = Math.min(0.05, Math.max(0, dt));
    // 地上的泥、水、冰，寒气，抓着你的手：先改脚下的速度
    const mods = this.titanPlayerMods();
    let inp = input;
    if (mods.hold) inp = { x: 0, y: 0, run: false };
    else if (mods.k !== 1 || mods.noRun || mods.crouchK !== 1) {
      let x = input.x || 0,
        y = input.y || 0;
      const n = Math.hypot(x, y);
      if (n > 1) {
        x /= n;
        y /= n;
      }
      const k = mods.k * mods.crouchK;
      inp = { ...input, x: x * k, y: y * k, run: mods.noRun ? false : input.run };
    }
    // 打在大块头身上的子弹、箭：先按它的个头算一遍（原来只认脚下一小块）
    this.titanBullets(step);
    const old = { x: p.x, y: p.y },
      st0 = p.stamina,
      hunger0 = p.hunger;
    const out = super.update(dt, inp);
    if (this.paused) return out;
    this.titanSlide(old, step, mods);
    this.titanTick(step, st0, hunger0, mods);
    return out;
  }
  titanTick(dt, st0, hunger0, mods) {
    const g = this.tg,
      p = this.s.player;
    // 旧档：一张“巨影”卡片。很老的档第一帧前几层已经排了四张，卡片最多排四张、多了挤掉最早的：
    // 这一帧有别的卡片就晚一帧再排（下一帧第一张已经放出来了，排得下）
    if (g.intro && !g.intro.told) {
      if (this._tIntroWait == null) this._tIntroWait = this.events.some((ev) => ev.type === "moment") ? 1 : 0;
      if (this._tIntroWait > 0) this._tIntroWait--;
      else {
        g.intro.told = true;
        this.moment?.("intro", "巨影", TITAN_INTRO, { icon: "titan" });
      }
    }
    if (this._tRegion !== this.s.region) {
      this._tRegion = this.s.region;
      this.tx = transient();
    }
    this.titanHeal();
    this.titanSync();
    this.titanGifts();
    this.tickStrikes(dt);
    this.tickShots(dt);
    this.tickRings(dt);
    this.tickZones(dt, st0);
    this.tickHold(dt);
    this.tx.slowT = Math.max(0, this.tx.slowT - dt);
    this.tx.noRun = Math.max(0, this.tx.noRun - dt);
    for (const f of this.tx.fx) f.t -= dt;
    this.tx.fx = this.tx.fx.filter((f) => f.t > 0);
    // 白毛风：寒潮里在暖区外多饿的那一截少一半
    if (g.perks.frost && this.playerCold?.() && hunger0 > p.hunger) {
      const drop = hunger0 - p.hunger;
      if (drop < 5) p.hunger = Math.min(100, p.hunger + drop * (0.4 / 1.4) * FROST_COLD);
    }
  }
  // 换图：原来那张图上的十凶回窝
  assignRegion() {
    const from = this._tRegion;
    if (this.tg && from && from !== this.s.region) {
      this.titanLeftRegion(from);
      this.tx = transient();
      this._tRegion = this.s.region;
    }
    const out = super.assignRegion();
    if (this.tg) {
      this.titanPerkObjects();
      // 白毛风的铁桶：地图上的东西每次重排都要补回去
      if (this.tx.barrels) AI.frost?.barrelObjects?.(this);
    }
    return out;
  }

  // ================= 感染者每帧 =================
  updateEnemy(e, dt) {
    if (!this.tg || !e || e.dead) return super.updateEnemy(e, dt);
    if (e.titan) return this.updateTitan(e, dt);
    if (e.type === POD_TYPE) return this.updatePod(e, dt);
    return super.updateEnemy(e, dt);
  }
  updateTitan(e, dt) {
    const T = TITANS[e.titan],
      p = this.s.player;
    e.flash = Math.max(0, (e.flash || 0) - dt);
    e.inv = Math.max(0, (e.inv || 0) - dt);
    e.slowT = Math.max(0, (e.slowT || 0) - dt);
    e.tNoteT = Math.max(0, (e.tNoteT || 0) - dt);
    e.lastHit = Math.max(0, (e.lastHit || 0) - dt);
    e.anim = (e.anim || 0) + dt;
    // 站起来（黑瞎子）、举风杆（白毛风）：画面用，几秒后放下
    e.stand = Math.max(0, (e.stand || 0) - dt);
    e.lift = Math.max(0, (e.lift || 0) - dt);
    for (const k of Object.keys(e.cd)) e.cd[k] = Math.max(0, e.cd[k] - dt);
    if (e.bleedT > 0) {
      e.bleedT -= dt;
      this.dotHurt(e, 3 * dt);
      if (e.dead) return;
    }
    // 只有黑瞎子吃捕兽夹；别的凶踩上去照样挨一下，但不被夹住
    if (e.titan !== "bear") e.trapHeld = 0;
    e.stunT = 0;
    e.stagger = 0;
    if (!e.awake) {
      if (e.homing) return this.titanGoHome(e, dt);
      const lair = { x: T.lair.x, y: T.lair.y },
        hurt = e.hp < e.maxHp - 0.5 && e.lastHit != null && e.lastHit > 0;
      if (dist(p, lair) < T.wake || hurt || AI[e.titan]?.wakeBy?.(this, e)) this.titanWake(e);
      else return AI[e.titan]?.idle?.(this, e, dt);
    }
    if (e.homing) return this.titanGoHome(e, dt);
    // 追出地盘：回窝
    if (dist(p, { x: T.lair.x, y: T.lair.y }) > (T.leash || TRULES.leash)) return this.titanHome0(e);
    e.fightT += dt;
    e.poiseT += dt;
    if (e.poiseT > TRULES.stagger.wait) e.poise = Math.max(0, e.poise - TRULES.stagger.decay * dt);
    // 换段
    const tp = this.titanPhaseOf(e);
    if (tp > e.tp) return this.titanPhase(e, tp);
    if (e.stag > 0) {
      e.stag -= dt;
      e.act = null;
      return;
    }
    if (e.inv > 0 && e.roar) return;
    e.roar = false;
    AI[e.titan]?.tick?.(this, e, dt);
  }
  titanGoHome(e, dt) {
    const T = TITANS[e.titan],
      home = { x: e.homeX ?? T.lair.x, y: e.homeY ?? T.lair.y };
    if (e.regenLeft > 0) {
      const add = Math.min(e.regenLeft, ((e.maxHp * TRULES.regen) / TRULES.regenTime) * dt);
      e.hp = Math.min(e.maxHp, e.hp + add);
      e.regenLeft -= add;
    }
    if (dist(e, home) > 30) {
      AI[e.titan]?.walkHome ? AI[e.titan].walkHome(this, e, dt, home) : this.tMove(e, home, this.tSpeed(e) * TRULES.homeSpeed, dt);
      return;
    }
    if (e.regenLeft > 0) return;
    Object.assign(e, { homing: false, awake: false, mode: "lair", act: null, state: "patrol" });
    this.titanSave(e);
    AI[e.titan]?.sleep?.(this, e);
  }
  // 这一凶现在是第几段（按十凶的总血算：〇号分成两半时两半加起来）
  titanPhaseOf(e) {
    const T = TITANS[e.titan],
      all = this.titansHere(e.titan),
      hp = all.length ? all.reduce((a, z) => a + Math.max(0, z.hp), 0) : e.hp,
      max = this.titanMaxHp(e.titan),
      f = hp / Math.max(1, max);
    let tp = 0;
    for (const th of T.phases) if (f <= th) tp++;
    return tp;
  }
  titanPhase(e, tp) {
    const T = TITANS[e.titan],
      p = this.s.player;
    for (const z of this.titansHere(e.titan)) {
      z.tp = tp;
      z.act = null;
      z.inv = TRULES.phaseInv;
      z.roar = true;
      z.stag = 0;
    }
    this.tStat("phases");
    this.tClearFrom(e, true);
    // 吼一声：身边的人被震开
    const d = dist(e, p);
    if (d < TRULES.phaseRing + e.r && this.invulnerable <= 0) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      this.tPush(a, TRULES.phasePush);
    }
    this.tx.fx.push({ kind: "roar", x: e.x, y: e.y, r: TRULES.phaseRing + e.r, t: 0.6, max: 0.6 });
    this.tEmit(e, "tRoar", { range: 1600, duck: true });
    if (!this.s.settings?.access?.calm) this.shake = Math.max(this.shake || 0, 5);
    PHASE_HOOK[e.titan]?.(this, e, tp);
    this.tSay(e, tp >= T.phases.length ? "拼命了！" : "变了！", "#ff8a6a");
  }

  // ================= 挨打 =================
  titanDamageKind(meta) {
    const h = this._hit;
    if (this._tFire) return "fire";
    if (h?.kind) return h.kind === "throw" ? "throw" : h.kind === "trap" ? "trap" : h.kind;
    if (meta?.id || meta?.bow || meta?.damage) return "ranged";
    return "other";
  }
  hurtEnemy(e, damage, angle, meta = {}) {
    if (!this.tg || !e || e.dead) return super.hurtEnemy(e, damage, angle, meta);
    if (e.type === POD_TYPE) {
      const x = e.x,
        y = e.y;
      const out = super.hurtEnemy(e, damage, angle, meta);
      e.x = x;
      e.y = y;
      return out;
    }
    if (!e.titan) {
      const out = super.hurtEnemy(e, damage, angle, meta);
      // 分水叉：打中的走得慢一半
      if (!e.dead && this._hit?.id === "heboFork") e.slowT = Math.max(e.slowT || 0, TITAN_MELEE.heboFork.slowHit.t);
      return out;
    }
    if (e.hidden || e.inv > 0) {
      if (e.inv > 0 && !e.hidden && (e.tNoteT || 0) <= 0) {
        e.tNoteT = 0.6;
        this.effects.push({ x: e.x, y: e.y - (TITANS[e.titan].h || 80) * 2 - 10, text: "打不动", t: 0.5, color: "#cfc6a8" });
      }
      return;
    }
    if (!e.awake) this.titanWake(e);
    const kind = this.titanDamageKind(meta);
    let n = damage;
    const front = angDiff(angle + Math.PI, e.facing ?? 0) < 1.1;
    n *= HURT_HOOK[e.titan]?.(this, e, n, { kind, front, angle, meta }) ?? 1;
    if (e.stag > 0) n *= TRULES.stagger.mul;
    // 攒晃：重家伙、推开攒得多
    const h = this._hit,
      knock = h?.knock ?? (kind === "ranged" ? 12 : 8);
    if (kind !== "dot" && kind !== "fire" && e.stag <= 0) this.titanPoise(e, Math.max(6, knock) * (TRULES.poiseKind[kind] ?? 0.6) * (h?.id === "sledge" || h?.id === "spikeHammer" ? 1.3 : 1));
    e.dealt[kind] = (e.dealt[kind] || 0) + n;
    e.lastHit = 3;
    this.tStat("hits");
    const x = e.x,
      y = e.y,
      n0 = this.events.length;
    super.hurtEnemy(e, n, angle, meta);
    // 打倒的这一下：“倒下了”那张卡片排在杀敌带出来的升级卡片前面
    if (e.dead) {
      const i = this.events.findIndex((ev, k) => k >= n0 && ev.type === "moment" && ev.kind === "titanDown");
      if (i > n0) this.events.splice(n0, 0, ...this.events.splice(i, 1));
    }
    // 不会被一下打退
    if (!e.dead) {
      e.x = x;
      e.y = y;
      e.stunT = 0;
      e.stagger = 0;
    }
  }
  titanPoise(e, n) {
    if (e.stag > 0 || e.inv > 0) return;
    e.poise += n * (e.poiseK || 1);
    e.poiseT = 0;
    if (e.poise < e.poiseMax) return;
    e.poise = 0;
    e.poiseMax *= TRULES.stagger.grow;
    e.stag = TRULES.stagger.time;
    e.act = null;
    this.tClearFrom(e);
    this.tStat("staggers");
    this.tSay(e, "晃了！", "#ffdb8c");
    this.tEmit(e, "tThud", { range: 1200 });
    AI[e.titan]?.staggered?.(this, e);
  }
  // 流血、火烧：直接掉血；火烧记一笔（〇号会对火长壳）
  dotHurt(e, n) {
    if (e?.titan && this.tg && !e.dead) {
      if (e.hidden || e.inv > 0) return;
      const k = this._tFire ? "fire" : "dot";
      let m = n * (HURT_HOOK[e.titan]?.(this, e, n, { kind: k, front: false, angle: 0, meta: {} }) ?? 1);
      e.dealt[k] = (e.dealt[k] || 0) + m;
      if (e.hp > m) {
        e.hp -= m;
        return;
      }
      n = m;
    }
    return super.dotHurt(e, n);
  }
  updateFires(dt) {
    this._tFire = true;
    try {
      return super.updateFires(dt);
    } finally {
      this._tFire = false;
    }
  }
  // 大块头：离它身子边上近就算打得着（原来只认它脚下那一点）
  meleeSwing(target, id) {
    const p = this.s.player,
      all = this.enemies;
    const hidden = all?.some((z) => z.hidden && !z.dead);
    if (hidden) this.enemies = all.filter((z) => !(z.hidden && !z.dead));
    let ok = false;
    const w = this.meleeStats?.(id),
      a0 = Math.atan2(target.y - (p.y - 20), target.x - p.x),
      extra = w
        ? this.enemies.filter((z) => {
            if (!z.titan || z.dead) return false;
            const d = dist(z, p);
            if (d < w.range) return false;
            const reach = w.range + (z.r || 0) * 0.85;
            return d < reach && angDiff(Math.atan2(z.y - p.y, z.x - p.x), a0) < w.arc + Math.atan2(z.r || 0, Math.max(1, d));
          })
        : [];
    // 蹲着从背后下手：原来那一下打完会站起来，够得着大块头身子的那几下也按蹲着算
    const crouch = !!this.f?.crouch;
    try {
      ok = super.meleeSwing(target, id);
      if (ok && w && extra.length) {
        const was = this.f?.crouch;
        if (this.f) this.f.crouch = crouch;
        try {
          for (const z of extra) if (!z.dead) this.meleeHit(z, w, id, p.facing ?? a0);
        } finally {
          if (this.f) this.f.crouch = was;
        }
      }
    } finally {
      if (hidden) this.enemies = all;
    }
    return ok;
  }
  meleeHit(z, w, id, a) {
    if (!z?.titan) return super.meleeHit(z, w, id, a);
    const x = z.x,
      y = z.y;
    super.meleeHit(z, w, id, a);
    if (!z.dead) {
      z.x = x;
      z.y = y;
    }
  }
  // 子弹、箭打在大块头身上：按它的个头算（原来是脚上面一小块）
  titanBullets(dt) {
    const big = (this.enemies || []).filter((z) => z.titan && !z.dead && !z.hidden);
    if (!big.length || !this.bullets?.length) return;
    const keep = [];
    for (const b of this.bullets) {
      let hit = null;
      const nx = b.x + b.vx * dt,
        ny = b.y + b.vy * dt;
      for (const z of big) {
        const T = TITANS[z.titan],
          cy = z.y - Math.min(90, (T.h || 60) * 0.9),
          r = (z.r || 30) * 1.05;
        // 线段到身子中间的距离
        const vx = nx - b.x,
          vy = ny - b.y,
          L = vx * vx + vy * vy || 1,
          t = clamp(((z.x - b.x) * vx + (cy - b.y) * vy) / L, 0, 1),
          qx = b.x + vx * t,
          qy = b.y + vy * t;
        if (Math.hypot(z.x - qx, cy - qy) < r) {
          hit = z;
          break;
        }
      }
      if (hit) this.hurtEnemy(hit, b.damage, b.angle, b);
      else keep.push(b);
    }
    this.bullets = keep;
  }
  shove() {
    const ts = (this.enemies || []).filter((z) => z.titan && !z.dead).map((z) => [z, z.x, z.y]);
    if (this.tx?.hold) {
      const p = this.s.player;
      if (p.stamina < 10 || (this.gx?.shoveCd || 0) > 0) return false;
      p.stamina -= 10;
      if (this.gx) this.gx.shoveCd = 0.9;
      this.tx.hold = null;
      this.toast("挣开了！");
      this.emit("shove");
      return true;
    }
    const ok = super.shove();
    const p = this.s.player;
    for (const [z, x, y] of ts) {
      z.x = x;
      z.y = y;
      z.stagger = 0;
      if (ok && dist(z, p) < 60 + (z.r || 0) && angDiff(Math.atan2(z.y - p.y, z.x - p.x), p.facing ?? 0) < 1.2) this.titanPoise(z, TRULES.stagger.shove);
    }
    return ok;
  }
  dodgeReason() {
    if (this.tx?.hold) return "被抓住了：按推开挣开，或连按交互";
    return super.dodgeReason();
  }
  interact() {
    if (this.tx?.hold && !this.paused) {
      const H = this.tx.hold;
      H.escape = (H.escape || 0) + 0.35;
      if (H.escape >= 1 - 1e-9) {
        this.tx.hold = null;
        this.toast("挣开了！");
      }
      return true;
    }
    // 铁桶、河边冲上来的东西、护林小屋门口的木材
    if (!this.paused && this.tg) {
      const o = this.nearestObject?.();
      if (o && (o.type === "tBarrel" || o.type === "tGift")) return this.useObject(o);
    }
    return super.interact();
  }
  afterKill(e) {
    super.afterKill(e);
    if (!this.tg) return;
    if (e?.titan) this.titanKilled(e);
  }
  addCorpse(e) {
    if (e?.titan || e?.type === POD_TYPE) {
      if (e.titan) this.tx.fx.push({ kind: "fall", titan: e.titan, x: e.x, y: e.y, facing: e.facing ?? 0, t: 3, max: 3, half: !!e.half });
      return;
    }
    return super.addCorpse(e);
  }

  // ================= 打赢 =================
  titanKilled(e) {
    const id = e.titan;
    // 〇号：两半要一起收（另一半还在、还没打死，交给它的 AI 数秒）
    if (AI[id]?.onKill?.(this, e)) return;
    this.titanDown(id, e);
  }
  titanDown(id, e) {
    const T = TITANS[id],
      g = this.tg,
      first = !g.first[id],
      day = this.s.day,
      secs = Math.round(e.fightT || 0);
    g.wins[id] = (g.wins[id] || 0) + 1;
    if (first) g.first[id] = day;
    if (secs > 0) g.best[id] = g.best[id] ? Math.min(g.best[id], secs) : secs;
    g.gone[id] = day;
    delete g.hp[id];
    this.tStat("wins");
    const bundle = {};
    let gold = 0;
    if (first) {
      if (!g.trophy[id]) {
        bundle[T.trophy] = 1;
        g.trophy[id] = day;
      }
      if (!g.gear[id]) {
        bundle[T.gear] = 1;
        g.gear[id] = day;
      }
      g.perks[id] = day;
      if (id === "hebo" && this.kin?.waters) this.kin.waters.river = true;
    } else {
      gold = TRULES.repeatGold;
      Object.assign(bundle, this.rareBundle?.("titan", id, day) || { parts: 3 });
    }
    if (gold) this.s.money += gold;
    this.receive(bundle);
    // 剩下的手下、孢囊、地上的预兆都收掉
    this.enemies = this.s.enemies[this.s.region] = this.enemies.filter((z) => !(z.type === POD_TYPE && z.of === id) && !(z.titan === id));
    this.tClearFrom(null, true);
    this.tx.hold = null;
    const lines = first ? [...T.down, "得到：" + itemsText(bundle), "地方变了：" + T.perk] : [...T.down.slice(0, 1), "得到：" + (gold ? gold + " 金币、" : "") + itemsText(bundle)];
    this.moment?.("titanDown", T.name + (first ? " 倒下了" : " 又倒下了"), lines, { titan: id });
    const text = "打赢了" + T.name + (first ? "（第一次）" : "") + "：" + (gold ? gold + " 金币、" : "") + itemsText(bundle) + (first ? "。战利品可以捐给档案馆的十凶柜。" : "");
    // 卡片上已经说了：这句只记进营地消息，不再让提示分档把它又弹成一张“打赢了”的卡片
    if (this.zCapture) this.zCapture(() => this.toast(text, "gold"));
    else this.toast(text, "gold");
    if (this.o) this.olog?.(text, "gold");
    this.events.push({ type: "bossDown", x: e.x, y: e.y, boss: "titan" });
    this.events.push({ type: "tSfx", sfx: "tRoar", x: e.x, y: e.y, range: 1600, stinger: "titanDown", ui: true });
    this.xp?.("combat", first ? 40 : 12);
  }

  // ================= 倒下 =================
  die() {
    const e = this.titanAwake();
    if (e && this.tg) {
      const id = e.titan,
        g = this.tg;
      g.falls[id] = (g.falls[id] || 0) + 1;
      this.tStat("falls");
      // 吃过一次亏就记住了：学到打法
      if (!g.intel[id]) {
        g.intel[id] = this.s.day;
        this._tIntelNote = TITANS[id].name + "：" + TITANS[id].intel;
      }
    }
    const out = super.die();
    if (this._tIntelNote) {
      this.toast("吃过一次亏，记住了——" + this._tIntelNote + "。", "warn");
      this._tIntelNote = null;
    }
    return out;
  }

  // ================= 预兆和挨打 =================
  // 预兆多长：听过打法的大招多 0.2 秒；最短 0.6 秒
  tWarn(e, base, big = false) {
    const intel = big && e?.titan && this.tg?.intel?.[e.titan] ? TRULES.intelWarn : 0;
    return Math.max(TRULES.minWarn, base + intel);
  }
  // 越打越疯：快多少、出招间隔乘多少
  tRage(e) {
    let speed = 1,
      cd = 1;
    for (const R of TRULES.enrage)
      if ((e?.fightT || 0) >= R.at) {
        speed = R.speed;
        cd = R.cd;
      }
    return { speed, cd };
  }
  tSpeed(e) {
    const T = TITANS[e.titan],
      base = (T?.speed || 50) * (e.speedK || 1) * this.tRage(e).speed;
    return base * (e.slowT > 0 ? 0.8 : 1);
  }
  tCool(e, key, s) {
    e.cd[key] = s * this.tRage(e).cd;
  }
  // 一下打过来：shape 是地上画的那一块（circle / cone / line / rect），warn 秒以后你还在里面就挨 hit
  tStrike(e, shape, warn, hit = {}, opt = {}) {
    const S = { id: this.tx.serial++, src: e?.id ?? null, titan: e?.titan || null, shape, t: warn, max: warn, hit, col: opt.col || (hit.dmg ? "red" : "blue"), cue: opt.cue || null, then: opt.then || null, zone: opt.zone || null };
    this.tx.strikes.push(S);
    this.tStat("strikes");
    if (opt.cue) this.events.push({ type: "tSfx", sfx: opt.cue, x: shape.x, y: shape.y, voice: true, duck: true, cueText: opt.cueText || null });
    return S;
  }
  tInShape(shape, p, pad = 12) {
    switch (shape.k) {
      case "circle":
        return Math.hypot(p.x - shape.x, p.y - shape.y) <= shape.r + pad;
      case "cone": {
        const d = Math.hypot(p.x - shape.x, p.y - shape.y);
        if (d > shape.r + pad) return false;
        if (d < 24) return true;
        return angDiff(Math.atan2(p.y - shape.y, p.x - shape.x), shape.a) <= shape.arc + Math.atan2(pad, d);
      }
      case "line": {
        const ux = Math.cos(shape.a),
          uy = Math.sin(shape.a),
          dx = p.x - shape.x,
          dy = p.y - shape.y,
          t = dx * ux + dy * uy;
        if (t < -pad || t > shape.len + pad) return false;
        return Math.abs(-dx * uy + dy * ux) <= shape.w / 2 + pad;
      }
      case "rect":
        return inRect(p, shape, pad);
      case "ring": {
        const d = Math.hypot(p.x - shape.x, p.y - shape.y);
        return d >= shape.r0 - pad && d <= shape.r1 + pad;
      }
      default:
        return false;
    }
  }
  tickStrikes(dt) {
    const L = this.tx.strikes;
    if (!L.length) return;
    const p = this.s.player,
      done = [];
    for (const S of L) {
      S.t -= dt;
      if (S.t > 0) continue;
      done.push(S);
      const src = S.src != null ? this.enemies.find((z) => z.id === S.src) : null;
      // 打它的那一凶已经倒下、或者换段了：这一下不算
      if (S.src != null && (!src || src.dead)) continue;
      if (S.hit && (S.hit.dmg || S.hit.hold || S.hit.slow || S.hit.sta) && this.tInShape(S.shape, p)) this.tLand(S.hit, src, S.shape);
      if (S.zone) this.tZone(S.zone.kind, { x: S.shape.x, y: S.shape.y, r: S.zone.r }, S.zone.t, S.zone);
      if (S.then) S.then(this, src, S);
    }
    if (done.length) this.tx.strikes = L.filter((S) => !done.includes(S));
  }
  // 挨上了：伤害、倒地、推开、慢、抓住、掉体力
  tLand(hit, src, shape) {
    const p = this.s.player;
    if (this.invulnerable > 0 || this.paused) return false;
    const T = src?.titan ? TITANS[src.titan] : null,
      before = p.hp;
    if (hit.dmg) this.damagePlayer(0, { eff: hit.dmg, from: src || undefined, down: hit.down || 0, noBleed: !hit.bleed });
    if (this.fx && src) this.fx.lastHitBy = src.type;
    if (hit.push && !this.paused) {
      const o = shape && (shape.k === "line" || shape.k === "cone") ? { x: shape.x, y: shape.y } : shape || src || p,
        a = Math.atan2(p.y - o.y, p.x - o.x);
      this.tPush(a, hit.push);
    }
    if (hit.slow) {
      this.tx.slowT = Math.max(this.tx.slowT, hit.slowT || 2);
      this.tx.slowK = hit.slow;
    }
    if (hit.sta) p.stamina = Math.max(0, p.stamina - hit.sta);
    if (hit.noRun) this.tx.noRun = Math.max(this.tx.noRun, hit.noRun);
    if (hit.hold && src && !this.paused) this.tx.hold = { src: src.id, t: hit.hold, dps: hit.dps || 0, pull: hit.pull || 0, escape: 0 };
    if (p.hp < before) {
      this.events.push({ type: "hit", x: p.x, y: p.y });
      if (T) this.titanHitNote(src);
    }
    return true;
  }
  titanHitNote(src) {
    if (this.tx.hitNote > 0) return;
    this.tx.hitNote = 1;
  }
  tPush(a, n) {
    const p = this.s.player,
      steps = Math.max(1, Math.ceil(n / 10));
    for (let i = 0; i < steps; i++) this.moveEntity(p, (Math.cos(a) * n) / steps, (Math.sin(a) * n) / steps);
  }
  // 往前飞的：木头、冰块
  tShot(e, x, y, a, speed, len, w, hit, kind = "log") {
    this.tx.shots.push({ src: e?.id ?? null, titan: e?.titan || null, x, y, a, speed, left: len, w, hit, kind, spin: 0 });
  }
  tickShots(dt) {
    const L = this.tx.shots;
    if (!L.length) return;
    const p = this.s.player;
    for (const s of L) {
      const step = Math.min(s.left, s.speed * dt),
        n = Math.max(1, Math.ceil(step / 10));
      s.spin += dt * 10;
      for (let i = 0; i < n && s.left > 0; i++) {
        const nx = s.x + (Math.cos(s.a) * step) / n,
          ny = s.y + (Math.sin(s.a) * step) / n;
        if (this.blocked(nx, ny + 8, true, 6)) {
          s.left = 0;
          this.particlesAt(s.x, s.y, "#a7a198", 10);
          this.events.push({ type: "tSfx", sfx: "tThud", x: s.x, y: s.y, range: 900 });
          break;
        }
        s.x = nx;
        s.y = ny;
        s.left -= step / n;
        if (!s.hitDone && Math.hypot(p.x - s.x, p.y - 16 - s.y) < s.w / 2 + 14) {
          s.hitDone = true;
          const src = this.enemies.find((z) => z.id === s.src) || null;
          this.tLand(s.hit, src, { k: "circle", x: s.x, y: s.y, r: s.w });
          s.left = 0;
          break;
        }
      }
    }
    this.tx.shots = L.filter((s) => s.left > 0);
  }
  // 往外荡开的一圈（收破烂的敲锅）：扫过你的那一下交给它自己的 AI
  tickRings(dt) {
    const L = this.tx.rings;
    if (!L.length) return;
    const p = this.s.player;
    for (const R of L) {
      const before = R.r;
      R.r += R.speed * dt;
      const d = dist(R, p);
      if (!R.passed && d >= before - 8 && d <= R.r + 8) {
        R.passed = true;
        AI[R.titan]?.ringPass?.(this, R);
      }
    }
    this.tx.rings = L.filter((R) => R.r < R.max);
  }
  // 地上一片：泥（慢、体力回得慢）、水（慢）、毒雾（掉血、体力不回）、冰（滑）
  tZone(kind, geo, t, data = {}) {
    const Z = { kind, t, max: t, ...geo, data };
    this.tx.zones.push(Z);
    return Z;
  }
  tZoneHas(Z, p) {
    return Z.w != null ? inRect(p, Z) : Math.hypot(p.x - Z.x, p.y - Z.y) <= Z.r;
  }
  titanPlayerMods() {
    const p = this.s.player,
      tx = this.tx;
    let k = 1,
      regen = 1,
      ice = 0;
    for (const Z of tx.zones) {
      if (!this.tZoneHas(Z, p)) continue;
      if (Z.kind === "mud") {
        k = Math.min(k, Z.data.slow || 0.55);
        regen = Math.min(regen, 0.5);
      } else if (Z.kind === "water") k = Math.min(k, Z.data.slow || 0.65);
      else if (Z.kind === "ice") ice = Math.max(ice, 1);
      else if (Z.kind === "gas") regen = 0;
    }
    if (tx.slowT > 0) k *= tx.slowK || 0.5;
    // 千层底：蹲着走快两成五
    const shoes = this.gr?.slots?.feet,
      crouchK = this.f?.crouch && TITAN_ARMOR[shoes]?.crouchSpeed ? TITAN_ARMOR[shoes].crouchSpeed : 1;
    return { k, regen, ice, hold: !!tx.hold, noRun: tx.noRun > 0, crouchK };
  }
  tickZones(dt, st0) {
    const tx = this.tx,
      p = this.s.player;
    let regen = 1,
      gas = 0;
    for (const Z of tx.zones) {
      Z.t -= dt;
      if (!this.tZoneHas(Z, p)) continue;
      if (Z.kind === "gas") {
        gas = Math.max(gas, Z.data.dps || 5);
        regen = 0;
      } else if (Z.kind === "mud") regen = Math.min(regen, 0.5);
    }
    tx.zones = tx.zones.filter((Z) => Z.t > 0);
    if (gas && !this.paused) {
      const suit = this.gr?.slots?.body,
        k = TITAN_ARMOR[suit]?.gas ?? (this.ut?.mask === this.s.day ? 0.5 : 1);
      this.envHurt?.(gas * k * dt, "gas");
      tx.gasNote = (tx.gasNote || 0) - dt;
      if (tx.gasNote <= 0) {
        tx.gasNote = 1;
        this.effects.push({ x: p.x, y: p.y - 70, text: "毒雾", t: 0.7, color: "#b5d97a" });
      }
    }
    // 体力：泥里回一半，毒雾里不回；白毛风的冷也在这儿
    const cold = AI.frost?.coldRegen?.(this) ?? 1,
      k = regen * cold;
    if (k < 1 && p.stamina > st0) p.stamina = Math.max(st0, st0 + (p.stamina - st0) * k);
  }
  // 冰上：脚下打滑，跟着原来的势头走
  titanSlide(old, dt, mods) {
    const p = this.s.player,
      tx = this.tx;
    const dx = p.x - old.x,
      dy = p.y - old.y;
    if (!mods.ice || this.fx?.roll || dt <= 0) {
      tx.vel = dt > 0 ? { x: dx / dt, y: dy / dt } : tx.vel;
      return;
    }
    const want = { x: dx / dt, y: dy / dt },
      v = tx.vel || want,
      grip = TITANS.frost?.ice?.grip ?? 0.12,
      k = 1 - Math.pow(1 - grip, dt * 60);
    v.x += (want.x - v.x) * k;
    v.y += (want.y - v.y) * k;
    tx.vel = v;
    p.x = old.x;
    p.y = old.y;
    this.moveEntity(p, v.x * dt, v.y * dt);
  }
  // 被抓住：拖向它、每秒掉血
  tickHold(dt) {
    const H = this.tx.hold;
    if (!H) return;
    const src = this.enemies.find((z) => z.id === H.src),
      p = this.s.player;
    H.t -= dt;
    if (!src || src.dead || H.t <= 0 || src.stag > 0) {
      this.tx.hold = null;
      return;
    }
    if (H.pull) {
      const d = dist(src, p);
      if (d > (src.r || 30) + 24) {
        const a = Math.atan2(src.y - p.y, src.x - p.x),
          m = Math.min(d - (src.r || 30) - 24, H.pull * dt);
        this.moveEntity(p, Math.cos(a) * m, Math.sin(a) * m);
      }
    }
    if (H.dps) this.envHurt?.(H.dps * dt, src.type);
  }
  // 收掉这一凶的预兆（换段、晃了、回窝）；all 时连地上的泥水毒雾一起
  tClearFrom(e, all = false) {
    const tx = this.tx;
    tx.strikes = e ? tx.strikes.filter((S) => S.src !== e.id) : [];
    if (all) {
      tx.shots = [];
      tx.zones = tx.zones.filter((Z) => Z.data?.keep);
    }
  }
  tEmit(e, sfx, extra = {}) {
    this.events.push({ type: "tSfx", sfx, x: e?.x ?? this.s.player.x, y: e?.y ?? this.s.player.y, ...extra });
  }
  tSay(e, text, color = "#ffdb8c") {
    const T = TITANS[e.titan];
    this.effects.push({ x: e.x, y: e.y - (T?.h || 60) * 2 - 14, text, t: 1, color });
  }
  // 往一个点走（绕开墙）：原来的寻路
  tMove(e, target, speed, dt) {
    if (this.aiMove) return this.aiMove(e, target, speed, dt);
    const a = Math.atan2(target.y - e.y, target.x - e.x);
    e.facing = a;
    this.moveEntity(e, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt, true);
    return true;
  }
  tFace(e, dt, rate = 3) {
    const p = this.s.player,
      want = Math.atan2(p.y - e.y, p.x - e.x),
      cur = e.facing ?? want,
      diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)),
      step = rate * dt;
    e.facing = Math.abs(diff) <= step ? want : cur + Math.sign(diff) * step;
  }

  // ================= 孢囊（〇号种的） =================
  updatePod(e, dt) {
    e.fuse = (e.fuse ?? 6) - dt;
    e.flash = Math.max(0, (e.flash || 0) - dt);
    if (e.fuse > 0) return;
    e.dead = true;
    e.hp = 0;
    const P = TITANS.zero.pods;
    this.tZone("gas", { x: e.x, y: e.y, r: P.gas.r }, P.gas.t, { dps: P.gas.dps });
    this.events.push({ type: "tSfx", sfx: "tPop", x: e.x, y: e.y });
    this.particlesAt(e.x, e.y - 10, "#9fbf5a", 18);
    this.enemies = this.s.enemies[this.s.region] = this.enemies.filter((z) => z !== e);
  }

  // ================= 被咬、寒潮（打赢以后地方的变化） =================
  infect(n, where = "") {
    if (this.tg?.perks?.zero && n === INFECTION.bite) n *= ZERO_BITE;
    return super.infect(n, where);
  }
  envHurt(n, by) {
    // 隔离服：酸液不掉血，毒雾掉一半（十凶的毒雾在 tickZones 里已经算过）
    const suit = this.gr?.slots?.body;
    if (TITAN_ARMOR[suit] && this._tGasFromUnder !== false) {
      if (by === "acid" && TITAN_ARMOR[suit].acid != null) n *= TITAN_ARMOR[suit].acid;
    }
    return super.envHurt?.(n, by);
  }
  tickHazards(dt, st0) {
    // 原来的毒雾（膨胀者）：穿隔离服掉一半
    const suit = this.gr?.slots?.body,
      k = TITAN_ARMOR[suit]?.gas;
    if (k != null && this.ut && this.inGas?.()) {
      const keep = this.ut.mask;
      this.ut.mask = this.s.day;
      try {
        return super.tickHazards(dt, st0);
      } finally {
        this.ut.mask = keep;
      }
    }
    return super.tickHazards(dt, st0);
  }

  // ================= 每天、每周的东西 =================
  titanPerkObjects() {
    const g = this.tg;
    if (!g || !this.objects) return;
    for (const [id, D] of Object.entries(PERK_DROPS)) {
      if (!g.perks[id] || D.region !== this.s.region || g.gifts[id] === this.s.day) continue;
      if (this.objects.some((o) => o.type === "tGift" && o.of === id)) continue;
      this.objects.push({ type: "tGift", of: id, name: D.name, icon: 55, x: D.x, y: D.y });
    }
  }
  titanGifts() {
    const g = this.tg;
    if (!g?.perks?.scrap) return;
    const since = this.s.day - g.perks.scrap;
    if (since <= 0 || since % SCRAP_GIFT.every !== 0 || g.gifts.scrap === this.s.day || this.s.minute < 7 * 60) return;
    g.gifts.scrap = this.s.day;
    this.receive({ ...SCRAP_GIFT.bundle });
    this.tStat("gifts");
    const text = "雨巷的三户人家托人送来谢礼：" + itemsText(SCRAP_GIFT.bundle) + "。";
    this.toast(text, "gold");
    if (this.o) this.olog?.(text, "gold");
  }
  useObject(o) {
    // 白毛风的铁桶：灭了添一块木材重新点着
    if (o?.type === "tBarrel" && this.tg) {
      const b = (this.tx.barrels || []).find((x) => x.i === o.i);
      if (!b) return false;
      if (b.lit) {
        this.toast("铁桶里的火烧得正旺。");
        return true;
      }
      if (!this.pay?.({ wood: 1 }, false)) {
        this.toast("要一块木材才点得着。", "warn");
        return false;
      }
      b.lit = true;
      this.toast("铁桶重新烧起来了。");
      this.emit("craft");
      return true;
    }
    if (o?.type === "tGift" && this.tg) {
      const D = PERK_DROPS[o.of];
      if (!D || this.tg.gifts[o.of] === this.s.day) return false;
      this.tg.gifts[o.of] = this.s.day;
      const pool = D.pool,
        total = pool.reduce((a, [, w]) => a + w, 0);
      let x = this.tRoll("gift", o.of, this.s.day) * total,
        bundle = pool[0][0];
      for (const [b, w] of pool) {
        if (x < w) {
          bundle = b;
          break;
        }
        x -= w;
      }
      this.receive({ ...bundle });
      this.tStat("gifts");
      this.objects = this.objects.filter((x2) => x2 !== o);
      this.toast(D.name + "：" + itemsText(bundle), "gold");
      this.emit("loot");
      return true;
    }
    return super.useObject(o);
  }
  context(o) {
    if (o?.type === "tGift") return o.name + " · 按交互捡起来";
    if (o?.type === "tBarrel") {
      const b = (this.tx.barrels || []).find((x) => x.i === o.i);
      return b?.lit ? "铁桶 · 火烧着，站在旁边暖和" : "铁桶 · 灭了：添一块木材点着";
    }
    return super.context(o);
  }

  // ================= 十凶柜（档案馆第八个展柜） =================
  titanCase() {
    const g = this.tg;
    if (!g) return null;
    const have = TITAN_TROPHY_IDS.filter((id) => !g.donated.includes(id) && this.qty(id, true) > 0);
    return { name: TITAN_CASE.name, steps: TITAN_CASE.steps, donated: [...g.donated], can: have, done: [...g.caseDone], total: TITAN_ORDER.length };
  }
  donateTitanTrophy(id) {
    const g = this.tg;
    if (!g || !TITAN_TROPHY_IDS.includes(id) || g.donated.includes(id)) return false;
    if (!this.museumHere?.()) {
      this.toast("到档案馆（农场分馆或档案岛展厅）再捐赠。", "warn");
      return false;
    }
    if (!(this.qty(id, true) > 0)) {
      this.toast("手上没有" + ITEMS[id].name + "。", "warn");
      return false;
    }
    if (this.s.inventory[id] > 0) {
      this.s.inventory[id]--;
      if (!this.s.inventory[id]) delete this.s.inventory[id];
    } else {
      this.s.storage[id]--;
      if (!this.s.storage[id]) delete this.s.storage[id];
    }
    g.donated.push(id);
    this.tStat("donated");
    this.toast("捐给档案馆的十凶柜：" + ITEMS[id].name + "。");
    for (const st of TITAN_CASE.steps) {
      if (g.donated.length < st.n || g.caseDone.includes(st.n)) continue;
      g.caseDone.push(st.n);
      if (st.n === 3) this.addReputation?.(10);
      if (st.n === 6) for (const r of this.c?.residents || []) r.morale = clamp((r.morale ?? 60) + 5, 0, 100);
      const text = "十凶柜捐满 " + st.n + " 件：" + st.text + "。";
      this.toast(text, "gold");
      if (this.o) this.olog?.(text, "gold");
    }
    return true;
  }
  // 十凶碑：心情一直 +3（心情的“该有的心情”里多一条来由）
  moodFactors(r) {
    const out = super.moodFactors(r);
    if (this.tg?.caseDone?.includes(10)) out.push({ key: "titans", v: 3, text: "纪念石旁的十凶碑" });
    return out;
  }

  // ================= 营火夜谈：营地里有人知道它的弱点 =================
  // 听说过、还没记下打法、还没打赢的那几凶，营火边聊一回说一凶（和传闻卡上打听到的一样：大招的预兆长一点，血条下面写着怎么打）
  talk(topic) {
    const people = this.tg ? this.talkPeople?.() || [] : [];
    const ok = super.talk(topic);
    if (!ok || !this.tg) return ok;
    const id = TITAN_IDS.find((k) => this.titanKnown(k) && !this.tg.intel[k] && !this.tg.first[k]);
    if (!id) return ok;
    const who = people.length ? people[this.s.day % people.length] : null;
    this.tg.intel[id] = this.s.day;
    this.tStat("told");
    const text = "营火边，" + (who?.name || "有人") + "说起" + TITANS[id].name + "：" + TITANS[id].intel + "。记下了打法。";
    this.toast(text, "gold");
    if (this.o) this.olog?.(text, "gold");
    return ok;
  }

  // ================= 每日抉择：传闻卡 =================
  applyOp(op, ctx, tier, roll = 0.5) {
    const [kind, a] = op;
    if (kind === "tIntel" && this.tg && TITANS[a]) {
      this.tg.intel[a] = this.s.day;
      return "记下了" + tPoss(TITANS[a].name) + "打法：" + TITANS[a].intel;
    }
    return super.applyOp(op, ctx, tier, roll);
  }

  // ================= 页面用的 =================
  // 头目血条：醒着、离得近的那一凶
  bossBar() {
    const e = (this.enemies || []).find((z) => z.titan && !z.dead && (z.awake || z.homing) && dist(z, this.s.player) < 1100);
    if (!e) return super.bossBar();
    const T = TITANS[e.titan],
      all = this.titansHere(e.titan),
      hp = all.reduce((a, z) => a + Math.max(0, z.hp), 0),
      max = this.titanMaxHp(e.titan),
      intel = !!this.tg.intel[e.titan];
    const tag = e.homing ? "回窝了" : e.stag > 0 ? "晃了" : e.inv > 0 && e.roar ? "变了" : AI[e.titan]?.tag?.(this, e) || "";
    const note = AI[e.titan]?.note?.(this, e, intel) || (intel ? T.intel : "");
    return {
      kind: "titan",
      titan: e.titan,
      name: T.name,
      title: T.title,
      hp: Math.max(0, hp),
      max,
      tag,
      note,
      phases: T.phases,
      poise: e.stag > 0 ? 1 : clamp(e.poise / Math.max(1, e.poiseMax), 0, 1),
      armor: AI[e.titan]?.armorBar?.(this, e) || null,
      halves: all.length > 1 ? all.map((z) => ({ hp: Math.max(0, z.hp), max: z.maxHp })) : null,
    };
  }
  // 世界地图上的窝、顶上的提醒
  ruinNews() {
    const out = super.ruinNews?.() || [];
    if (!this.tg) return out;
    for (const id of TITAN_IDS) {
      const T = TITANS[id];
      if (!this.titanKnown(id) || !this.titanOpen(id) || this.titanGone(id)) continue;
      out.push({ kind: "titan", titan: id, region: T.region, when: "lair", text: tPoss(T.name) + "窝" });
    }
    return out;
  }
  // 手记“今天”：听说过、还没打赢的那几凶
  todayItems() {
    const out = super.todayItems();
    if (!this.tg) return out;
    const extra = [];
    // 刚听说的三天里：哪一凶、在哪（点开是成就册里的十凶录）
    for (const id of TITAN_IDS) {
      const T = TITANS[id],
        heard = this.tg.rumor[id];
      if (!heard || this.s.day - heard > 2 || !this.titanOpen(id) || this.titanGone(id) || this.tg.first[id]) continue;
      extra.push({ pri: 4, text: T.name + " · " + REGIONS[T.region].name + (T.hours ? "（天黑以后）" : ""), action: "wView", id: "collection" });
    }
    return extra.length ? [...out, ...extra].sort((a, b) => a.pri - b.pri).slice(0, 3) : out;
  }
  titanInfo() {
    const g = this.tg;
    if (!g) return null;
    const rows = TITAN_ORDER.map((id) => {
      const T = TITANS[id],
        S = TITAN_SLOTS[id];
      if (!T) return { id, ready: false, name: S.name, where: S.where, seen: false, known: false };
      return {
        id,
        ready: true,
        name: T.name,
        title: T.title,
        where: REGIONS[T.region].name,
        when: T.openText,
        known: this.titanKnown(id),
        seen: !!g.seen[id],
        open: this.titanOpen(id),
        gone: this.titanGone(id),
        back: g.gone[id] != null ? g.gone[id] + TRULES.back : 0,
        tries: g.tries[id] || 0,
        wins: g.wins[id] || 0,
        falls: g.falls[id] || 0,
        best: g.best[id] || 0,
        first: g.first[id] || 0,
        intel: g.intel[id] ? T.intel : "",
        trophy: g.trophy[id] ? ITEMS[T.trophy]?.name : "",
        donated: g.donated.includes(T.trophy),
        gear: g.gear[id] ? ITEMS[T.gear]?.name : "",
        perk: g.perks[id] ? T.perk : "",
        lore: g.seen[id] ? T.lore : [],
      };
    });
    return { rows, wins: rows.filter((r) => r.wins > 0).length, seen: rows.filter((r) => r.seen).length, total: TITAN_ORDER.length, ready: TITAN_IDS.length };
  }
  // 画面用：地上的预兆、雾、白毛风
  titanFog() {
    const e = this.titanAwake();
    return e ? AI[e.titan]?.fog?.(this, e) || null : null;
  }

  // ================= 存档 =================
  // 十凶和孢囊不写进感染者名单（下回进图重新生）；当天打掉的血先记一笔
  serialize() {
    if (!this.tg) return super.serialize();
    const seen = new Set();
    for (const z of this.titansHere()) {
      if (seen.has(z.titan)) continue;
      seen.add(z.titan);
      this.titanSave(z);
    }
    const keep = {};
    for (const [id, list] of Object.entries(this.s.enemies || {}))
      if (Array.isArray(list) && list.some(isTitanThing)) {
        keep[id] = list;
        this.s.enemies[id] = list.filter((z) => !isTitanThing(z));
      }
    try {
      return super.serialize();
    } finally {
      Object.assign(this.s.enemies, keep);
    }
  }
  static parse(text) {
    const s = NfEngine.parse(text);
    tMigrate(s);
    validateTitan(s);
    return s;
  }
}

function validateTitan(s) {
  const g = s.titan,
    bad = (why) => {
      throw new Error("存档里的十凶记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
    };
  if (!g || typeof g !== "object" || Array.isArray(g)) bad("缺少");
  const int = (v, lo = 0, hi = 1e9) => Number.isInteger(v) && v >= lo && v <= hi,
    obj = (v) => !!v && typeof v === "object" && !Array.isArray(v),
    known = (k) => TITAN_ORDER.includes(k),
    byId = (o, hi = 1e6) => obj(o) && Object.entries(o).every(([k, v]) => known(k) && int(v, 0, hi));
  if (!int(g.schema, 1, 99)) bad("版本");
  for (const k of ["seen", "rumor", "intel", "tries", "wins", "first", "best", "falls", "gone", "back", "trophy", "gear", "perks"]) if (!byId(g[k])) bad("记录");
  if (!obj(g.hp) || Object.entries(g.hp).some(([k, v]) => !known(k) || !obj(v) || !int(v.hp, 0, 1e7) || !int(v.day, 0, 1e6))) bad("血");
  if (!Array.isArray(g.donated) || g.donated.length > TITAN_ORDER.length || g.donated.some((id) => !Object.hasOwn(ITEMS, id) || !String(id).startsWith("tTrophy")) || new Set(g.donated).size !== g.donated.length) bad("十凶柜");
  if (!Array.isArray(g.caseDone) || g.caseDone.some((n) => !TITAN_CASE.steps.some((st) => st.n === n))) bad("十凶柜");
  if (!obj(g.gifts) || Object.entries(g.gifts).some(([k, v]) => !known(k) || !int(v, 0, 1e6))) bad("记录");
  if (!obj(g.told) || Object.keys(g.told).length > 400 || Object.entries(g.told).some(([k, v]) => k.length > 40 || !int(v, 0, 1e6))) bad("记录");
  if (!obj(g.stats) || Object.values(g.stats).some((v) => !int(v))) bad("记录");
  if (g.intro !== undefined && (!obj(g.intro) || !int(g.intro.day, 0, 1e6) || typeof g.intro.told !== "boolean")) bad("记录");
}
