// v0.36.0「巨影」：《余烬农场：十凶方案》第一版——十凶共用的规矩和前五凶（河伯、收破烂的、〇号、黑瞎子、白毛风）。
// v0.37.0「扑火」：后五凶——有几只的（雕爷和看门的、风机和四个肺、车头和四节车厢、心和四盏光）、地上的油和着了的油、
// 通了电的铁轨、往里吸的风、转着的风刃；最后一凶在农场打一整夜（提前三天说、22:00 来、没打赢 7 天后再来），结局卡。
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
import { TRULES, TITANS, TITAN_IDS, TITAN_TYPES, TITAN_ORDER, TITAN_SLOTS, POD_TYPE, TITAN_TROPHY_IDS, TITAN_CASE, TITAN_ARMOR, TITAN_MELEE, PERK_DROPS, SCRAP_GIFT, ZERO_BITE, FROST_COLD, TITAN_INTRO, TITAN_INTRO2, TITAN_SCHEMA, FINAL, FINAL_TEXT, FINAL_END, VENT_BEDS, SMOKE_CUT, partKeys, mainPart, tPoss } from "./titan-data.js";
import { AI, PHASE_HOOK, HURT_HOOK, SPAWN_HOOK, WAKE_HOOK } from "./titan-ai.js";
// v0.37：后五凶怎么打人（接在同一套 AI / 钩子上）
import "./titan-ai2.js";

export { legacyGear };
// 读档前要不要先留一份：没有十凶这一块的旧档、十凶记录还是上一版（v0.36 是第 1 版）的档
export const needsUpgrade = (text) => {
  if (nfNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object") return false;
    return !raw.titan || (Number.isInteger(raw.titan.schema) && raw.titan.schema < TITAN_SCHEMA);
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
const STAT_KEYS = ["fights", "wins", "falls", "staggers", "phases", "strikes", "hits", "gifts", "donated", "told", "finals"];
// 最后一夜：定在哪天（0 = 还没定）、打过几夜、没打赢几夜、上回身上的伤留下几成（打掉的血占几成）、打赢那天
// on：打起来的那一夜是第几天（打完、天亮、倒下以后回到 0）
const finalDefaults = () => ({ day: 0, on: 0, tries: 0, lost: 0, keep: 0, won: 0 });
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
  // v0.37：最后一夜
  final: finalDefaults(),
});
// 十凶和孢囊不进存档：读档时从各张图的感染者名单里拿掉，进图时重新生出来（打掉的血记在 s.titan.hp 里）
// 雕爷叫来的灰隼团手下（tMan）也不进存档：读档以后没有他们（不然会按灰隼团袭击的规矩往农场边上撤）
const isTitanThing = (z) => !!z && (z.titan || z.tMan || z.type === POD_TYPE || Object.hasOwn(TITAN_TYPES, z.type));
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
    // v0.36 的档（第 1 版）：多一张卡片说后五凶；版本号不对的照旧留给读档检查（不替它改好）
    const old = x.schema == null || x.schema === 1;
    s.titan = { ...d, ...x, stats: { ...d.stats, ...x.stats }, final: { ...d.final, ...(x.final || {}) }, schema: old ? TITAN_SCHEMA : x.schema };
    if (old && !s.titan.intro2) s.titan.intro2 = { day: s.day || 1, told: false };
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
  delete s.titan.intro2;
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
// v0.37：waves 是扑火塌下来的浪（从一边卷到另一边，只留一个口子）
const transient = () => ({ strikes: [], shots: [], zones: [], fx: [], rings: [], waves: [], hold: null, slowT: 0, slowK: 1, noRun: 0, vel: null, cold: 0, fogFor: null, white: 0, place: null, serial: 1 });

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
    // 最后一凶：打赢了就不再来
    if (TITANS[id]?.final) return !!this.tg?.first?.[id];
    const g = this.tg?.gone?.[id];
    return g != null && this.s.day < g + TRULES.back;
  }
  // 它这会儿在不在窝里（天黑以后才出来的、打赢以后没回来的、今天有长夜的都不在）
  titanHome(id, minute = this.s.minute) {
    const T = TITANS[id];
    if (!this.titanOpen(id) || this.titanGone(id)) return false;
    if (this._tForce === id) return true;
    // 最后一凶只在打起来的那一夜在农场
    if (T.final) return this.finalLive();
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
  // 醒着的那一凶（有几只的先给本体：雕爷和看门的给看门的、风口给风机……）
  titanAwake() {
    const L = (this.enemies || []).filter((z) => z.titan && !z.dead && z.awake);
    return L.find((z) => z.type === TITANS[z.titan]?.type) || L[0] || null;
  }

  // ================= 生出来、回窝 =================
  titanSync() {
    const g = this.tg;
    if (!g) return;
    const region = this.s.region;
    for (const id of TITAN_IDS) {
      const T = TITANS[id];
      // 第一次能碰上：早上 7 点以后说一句（传闻），地图上标出窝；同一天只说一凶，旧档一下开了好几凶的，一天一凶慢慢说
      // 最后一凶的传闻是电台提前三天的那一句（finalTick）
      if (!T.final && !g.rumor[id] && this.s.minute >= 7 * 60 && g.told.rumorDay !== this.s.day && this.titanOpen(id) && !this.titanGone(id) && !this._tForce) {
        g.rumor[id] = this.s.day;
        g.told.rumorDay = this.s.day;
        this.toast(T.rumor, "warn");
        if (this.o) this.olog?.(T.rumor, "warn");
      }
      // 打赢以后 28 天：回来了
      if (g.gone[id] != null && !T.final && this.s.day >= g.gone[id] + TRULES.back) {
        delete g.gone[id];
        g.back[id] = Math.min(TRULES.backMax, (g.back[id] || 0) + 1);
        delete g.hp[id];
        const text = T.name + "又回来了（" + REGIONS[T.region].name + "）：比上回更难打。";
        this.toast(text, "warn");
        if (this.o) this.olog?.(text, "warn");
      }
      if (T.region !== region) continue;
      const here = this.titansHere(id);
      // 末班车只在隧道第 25 层
      if (T.floor && this.tunnelFloor?.() !== T.floor) {
        if (here.length) this.dropTitan(id);
        continue;
      }
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
      // 有几只的：本体只有自己那一份血，别的几只由 SPAWN_HOOK 生（tPart），当天打掉的按只补回去
      mp = mainPart(id),
      P = mp ? T.parts[mp] : null,
      mine = P ? Math.round((P.hp * max) / T.hp) : max,
      hp = P ? mine : today ? clamp(rec.hp, 1, max) : max,
      q = { x: T.lair.x, y: T.lair.y },
      e = this.enemy(T.type, q.x, q.y);
    Object.assign(e, {
      titan: id,
      hp,
      maxHp: mine,
      r: P?.r ?? T.r,
      tp: 0,
      act: null,
      cd: {},
      poise: 0,
      poiseMax: P?.poise ?? T.poise,
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
    if (P) Object.assign(e, { part: mp, pkey: mp });
    this.enemies.push(e);
    SPAWN_HOOK[id]?.(this, e);
    if (P && today) this.tRestoreParts(id, rec);
    const alive = this.titansHere(id),
      tp = alive.length ? this.titanPhaseOf(alive[0]) : 0;
    for (const z of alive) z.tp = tp;
    return e;
  }
  // 有几只的那几凶：生一只（雕爷、肺、车厢、光）；血按这一凶现在的总血（卷土重来以后多的那几成）放大
  tPart(main, part, i, x, y, extra = {}) {
    const id = main.titan,
      T = TITANS[id],
      P = T.parts[part],
      n = P.n || 1,
      max = Math.round((P.hp * this.titanMaxHp(id)) / T.hp),
      z = this.enemy(P.type, x, y);
    Object.assign(z, {
      titan: id,
      part,
      pkey: n > 1 ? part + i : part,
      idx: i,
      hp: max,
      maxHp: max,
      r: P.r ?? T.r,
      tp: main.tp || 0,
      act: null,
      cd: {},
      poise: 0,
      poiseMax: P.poise ?? 99999,
      poiseT: 0,
      stag: 0,
      inv: 0,
      awake: !!main.awake,
      homing: false,
      fightT: main.fightT || 0,
      homeX: x,
      homeY: y,
      state: "patrol",
      facing: main.facing ?? Math.PI / 2,
      mode: "lair",
      dealt: {},
      regenUsed: !!main.regenUsed,
      ...extra,
    });
    this.enemies.push(z);
    return z;
  }
  // 当天打掉的按只补回去：打没了的那几只（肺、车厢、光、先倒下的那一个）今天不再出来
  tRestoreParts(id, rec) {
    const parts = rec?.parts;
    if (!parts) return;
    const gone = new Set();
    for (const z of this.titansHere(id)) {
      const v = parts[z.pkey];
      if (v == null) continue;
      if (v <= 0) gone.add(z);
      else z.hp = clamp(v, 1, z.maxHp);
    }
    if (gone.size) this.enemies = this.s.enemies[this.s.region] = this.enemies.filter((z) => !gone.has(z));
  }
  dropTitan(id) {
    const keep = (this.enemies || []).filter((z) => !(z.titan === id || (z.type === POD_TYPE && z.of === id) || (z.tMan && z.tOf === id)));
    if (keep.length !== this.enemies.length) this.enemies = this.s.enemies[this.s.region] = keep;
    this.tx.zones = this.tx.zones.filter((Z) => Z.data?.of !== id);
  }
  // 当天打掉的血记一笔（第二天 06:00 回满）
  titanSave(e) {
    if (!e?.titan || !this.tg) return;
    this.tRecord(e.titan, this.enemies || [], e.regenUsed);
  }
  // 记一笔：总血、当天回没回过四分之一；有几只的那几凶按只记（打没了的记 0）
  tRecord(id, list, used) {
    const all = list.filter((z) => z.titan === id && !z.dead),
      hp = all.reduce((a, z) => a + Math.max(0, z.hp), 0);
    if (!all.length) return;
    if (hp >= this.titanMaxHp(id) - 0.5) {
      delete this.tg.hp[id];
      return;
    }
    const rec = { hp: Math.max(1, Math.round(hp)), day: this.s.day, used: !!used },
      keys = partKeys(id);
    if (keys.length) {
      rec.parts = {};
      for (const k of keys) {
        const z = all.find((x) => x.pkey === k);
        rec.parts[k] = z ? Math.max(1, Math.round(z.hp)) : 0;
      }
    }
    this.tg.hp[id] = rec;
  }
  // 06:00：昨天打掉的血回满
  titanHeal() {
    const g = this.tg;
    if (!g || this.s.minute < TRULES.healHour) return;
    for (const [id, rec] of Object.entries(g.hp)) {
      if (rec.day >= this.s.day) continue;
      delete g.hp[id];
      // 有几只的：睡着的那一凶收掉重新生（打没了的那几只也回来）
      if (TITANS[id]?.parts) {
        if (TITANS[id].region === this.s.region && !this.titansHere(id).some((z) => z.awake || z.homing)) this.dropTitan(id);
        continue;
      }
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
    // 有几只的：一只醒了，别的一起醒
    for (const z of this.titansHere(e.titan)) if (z !== e && !z.awake) Object.assign(z, { awake: true, homing: false, fightT: 0, state: "chase", mode: z.mode === "lair" ? "up" : z.mode });
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
  // 隧道换一层也算离开（list 是那一层原来的感染者名单）
  titanLeftRegion(from, list = this.s.enemies?.[from]) {
    if (!Array.isArray(list)) return;
    // 先每一只都回窝、回血（有几只的那几凶每一只回自己的四分之一），再按凶记一笔
    const ids = new Set();
    for (const z of list) {
      if (!z.titan || z.dead) continue;
      ids.add(z.titan);
      if (z.awake || z.homing) {
        const add = z.regenUsed ? 0 : z.maxHp * TRULES.regen;
        z.hp = Math.min(z.maxHp, z.hp + add);
        z.regenUsed = true;
      }
      Object.assign(z, { awake: false, homing: false, act: null, x: z.homeX, y: z.homeY, mode: "lair", stag: 0 });
    }
    for (const id of ids) {
      const all = list.filter((x) => x.titan === id && !x.dead),
        hp = all.reduce((a, x) => a + Math.max(0, x.hp), 0);
      // 回满了的：tRecord 把旧的那一笔删掉
      if (all.length) this.tRecord(id, list, all.some((x) => x.regenUsed));
    }
    // 〇号的两半回到一只、孢囊收掉：下回进图重新生
    if (this.s.enemies[from] === list) this.s.enemies[from] = list.filter((z) => !isTitanThing(z));
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
    // 最后一夜打起来以后：钟走得慢一半（只管每帧走的那一点）
    this._tFrame = true;
    let out;
    try {
      out = super.update(dt, inp);
    } finally {
      this._tFrame = false;
    }
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
    // 上一版的档：再一张“后五凶”卡片（巨影那张先放出来、这一帧没有别的卡片时再排）
    else if (g.intro2 && !g.intro2.told && !this.events.some((ev) => ev.type === "moment")) {
      g.intro2.told = true;
      this.moment?.("intro", "后五凶", TITAN_INTRO2, { icon: "titan" });
    }
    if (this._tRegion !== this.s.region) {
      this._tRegion = this.s.region;
      this.tx = transient();
    }
    this.titanHeal();
    this.finalTick();
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
    // 雕爷叫来的灰隼团手下
    if (e.tMan && AI.diao?.man) return AI.diao.man(this, e, dt);
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
    // 抡锚、甩尾、抡车钩：画面用
    e.swing = Math.max(0, (e.swing || 0) - dt);
    for (const k of Object.keys(e.cd)) e.cd[k] = Math.max(0, e.cd[k] - dt);
    if (e.bleedT > 0) {
      e.bleedT -= dt;
      this.dotHurt(e, 3 * dt);
      if (e.dead) return;
    }
    // 只有黑瞎子吃捕兽夹（扑火的那颗心踩上去会被拖慢，它自己的 AI 去看）；别的凶踩上去照样挨一下，但不被夹住
    if (e.titan !== "bear" && e.titan !== "moth") e.trapHeld = 0;
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
    // 有几只的那几凶按打没了哪几只换段（见 titan-ai2.js）
    const hook = AI[e.titan]?.phaseOf;
    if (hook) return hook(this, e);
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
      // 雕爷的手下躲在烟里：远程打不准
      if (e.tMan && this.titanDamageKind(meta) === "ranged" && this.tInSmoke(e)) {
        damage *= SMOKE_CUT;
        this.tSmokeNote(e);
      }
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
    // 烟里打不准
    if (kind === "ranged" && this.tInSmoke(e)) {
      n *= SMOKE_CUT;
      this.tSmokeNote(e);
    }
    if (e.stag > 0) n *= TRULES.stagger.mul;
    // 攒晃：重家伙、推开攒得多
    const h = this._hit,
      knock = h?.knock ?? (kind === "ranged" ? 12 : 8);
    if (kind !== "dot" && kind !== "fire" && e.stag <= 0) this.titanPoise(e, Math.max(6, knock) * (TRULES.poiseKind[kind] ?? 0.6) * (h?.id === "sledge" || h?.id === "spikeHammer" ? 1.3 : TITAN_MELEE[h?.id]?.poiseK || 1));
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
    // 嵌在身上的（扑火身上的光、风口墙上的肺）在身子前面：先算打没打中它们
    const big = (this.enemies || []).filter((z) => z.titan && !z.dead && !z.hidden).sort((a, b) => (b.front ? 1 : 0) - (a.front ? 1 : 0));
    if (!big.length || !this.bullets?.length) return;
    const keep = [];
    for (const b of this.bullets) {
      let hit = null;
      const nx = b.x + b.vx * dt,
        ny = b.y + b.vy * dt;
      for (const z of big) {
        const T = TITANS[z.titan],
          cy = z.y - (z.hy ?? Math.min(90, (T.h || 60) * 0.9)),
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
      // 打在身子上、可是这一发是冲着嵌在身上的那一块（光、肺）去的：算打中那一块（它们在身子前面）
      if (hit && !hit.front) {
        const life = Math.max(0, b.life ?? 1),
          vx = b.vx * life,
          vy = b.vy * life,
          L = vx * vx + vy * vy || 1;
        let best = null,
          bt = 2;
        for (const z of big) {
          if (!z.front || z.titan !== hit.titan) continue;
          const cy = z.y - (z.hy ?? 0),
            t = clamp(((z.x - b.x) * vx + (cy - b.y) * vy) / L, 0, 1);
          if (Math.hypot(b.x + vx * t - z.x, b.y + vy * t - cy) < (z.r || 30) * 1.05 && t < bt) {
            bt = t;
            best = z;
          }
        }
        if (best) hit = best;
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
      if (ok && dist(z, p) < 60 + (z.r || 0) && angDiff(Math.atan2(z.y - p.y, z.x - p.x), p.facing ?? 0) < 1.2) {
        this.titanPoise(z, TRULES.stagger.shove);
        // 扑火的那颗心往篝火爬的时候：推一下拖慢它
        AI[z.titan]?.shoved?.(this, z);
      }
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
      if (e.titan) this.tx.fx.push({ kind: "fall", titan: e.titan, part: e.part || null, idx: e.idx ?? 0, x: e.x, y: e.y, facing: e.facing ?? 0, t: 3, max: 3, half: !!e.half });
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
      if (T.gear && !g.gear[id]) {
        bundle[T.gear] = 1;
        g.gear[id] = day;
      }
      g.perks[id] = day;
      if (id === "hebo" && this.kin?.waters) this.kin.waters.river = true;
      // 黑潮：漏油堵上了，沉湾的鱼不用再验水
      if (id === "tide" && this.kin?.waters) this.kin.waters.sea = true;
    } else {
      gold = TRULES.repeatGold;
      Object.assign(bundle, this.rareBundle?.("titan", id, day) || { parts: 3 });
    }
    if (gold) this.s.money += gold;
    this.receive(bundle);
    // 剩下的手下、孢囊、地上的预兆都收掉（后五凶叫来的也散了）；还没倒的那几只（肺、车厢、光）跟着倒下，不再算一回
    for (const z of this.enemies) if (z.titan === id) z.dead = true;
    this.enemies = this.s.enemies[this.s.region] = this.enemies.filter((z) => !(z.type === POD_TYPE && z.of === id) && !(z.titan === id) && !(z.tOf === id));
    this.tClearFrom(null, true);
    this.tx.hold = null;
    const lines = first ? [...T.down, "得到：" + itemsText(bundle), "地方变了：" + T.perk] : [...T.down.slice(0, 1), "得到：" + (gold ? gold + " 金币、" : "") + itemsText(bundle)];
    // 最后一凶：结局卡（打赢的那一下就是结局）
    if (T.final) {
      this.finalWon();
      this.moment?.("titanEnd", FINAL_END.title, [...FINAL_END.lines, "得到：" + itemsText(bundle)], { titan: id, icon: "titanEnd" });
    } else this.moment?.("titanDown", T.name + (first ? " 倒下了" : " 又倒下了"), lines, { titan: id });
    const text = "打赢了" + T.name + (first ? "（第一次）" : "") + "：" + (gold ? gold + " 金币、" : "") + itemsText(bundle) + (first ? "。战利品可以捐给档案馆的十凶柜。" : "");
    // 卡片上已经说了：这句只记进营地消息，不再让提示分档把它又弹成一张“打赢了”的卡片
    if (this.zCapture) this.zCapture(() => this.toast(text, "gold"));
    else this.toast(text, "gold");
    if (this.o) this.olog?.(text, "gold");
    this.events.push({ type: "bossDown", x: e.x, y: e.y, boss: "titan" });
    this.events.push({ type: "tSfx", sfx: "tRoar", x: e.x, y: e.y, range: 1600, stinger: T.final ? "titanEnd" : "titanDown", ui: true });
    this.xp?.("combat", first ? 40 : 12);
  }

  // ================= 倒下 =================
  die() {
    const fell = !!this.tg && this.finalLive() && this.titansHere("moth").length > 0;
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
    // 隧道第 25 层倒下：末班车记一笔（隧道这一层下回重新拼）；最后一夜倒下：扑火的退回林子，7 天后再来
    if (this.tg && this.s.region === "tunnel" && this.titansHere("train").length) this.titanLeftRegion("tunnel");
    if (fell) this.finalEnd("fell");
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
    // 最后一凶本来就打一整夜：越打越疯来得晚、疯得轻
    for (const R of TITANS[e?.titan]?.enrage || TRULES.enrage)
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
      // los：隔着墙、柜子打不着（雕爷的点射）
      if (S.hit && (S.hit.dmg || S.hit.hold || S.hit.slow || S.hit.sta) && this.tInShape(S.shape, p) && !(S.hit.los && src && !this.lineClear(src, p))) this.tLand(S.hit, src, S.shape);
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
    if (hit.dmg) {
      // 霰弹枪：离得越远打得越轻（far 是打到边上剩几成）
      let eff = hit.dmg;
      if (hit.far != null && shape?.r) eff *= 1 - (1 - hit.far) * clamp(Math.hypot(p.x - shape.x, p.y - shape.y) / shape.r, 0, 1);
      this.damagePlayer(0, { eff, from: src || undefined, down: hit.down || 0, noBleed: !hit.bleed });
    }
    if (this.fx && src) this.fx.lastHitBy = src.type;
    if (hit.push && !this.paused) {
      const o = shape && (shape.k === "line" || shape.k === "cone") ? { x: shape.x, y: shape.y } : shape || src || p,
        a = hit.pushA ?? Math.atan2(p.y - o.y, p.x - o.x);
      this.tPush(a, hit.push);
    }
    if (hit.slow) {
      this.tx.slowT = Math.max(this.tx.slowT, hit.slowT || 2);
      this.tx.slowK = hit.slow;
    }
    if (hit.sta) p.stamina = Math.max(0, p.stamina - hit.sta);
    if (hit.noRun) this.tx.noRun = Math.max(this.tx.noRun, hit.noRun);
    // 雕爷的大氅：被抓住的时间短一半
    if (hit.hold && src && !this.paused) this.tx.hold = { src: src.id, t: hit.hold * (TITAN_ARMOR[this.gr?.slots?.body]?.grabK ?? 1), dps: hit.dps || 0, pull: hit.pull || 0, escape: 0, then: hit.then || null };
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
  // 地上一片：泥（慢、体力回得慢）、水（慢）、毒雾（掉血、体力不回）、冰（滑）；
  // v0.37：油（慢一点、沾一身油）、烧着的油（烫，身上沾着油的更烫）、烟（烟里打不准）、通了电的铁轨（烫）
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
      else if (Z.kind === "gas") regen = this.tGasRegen() ? regen : 0;
      else if (Z.kind === "oil") k = Math.min(k, Z.data.slow || 0.8);
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
      gas = 0,
      fire = null,
      volt = null,
      oil = null;
    // 燃烧瓶落在油上、烧着的油挨着别的油：一片片接着着
    this.tIgniteOil();
    for (const Z of tx.zones) {
      Z.t -= dt;
      if (!this.tZoneHas(Z, p)) continue;
      if (Z.kind === "gas") {
        gas = Math.max(gas, Z.data.dps || 5);
        if (!this.tGasRegen()) regen = 0;
      } else if (Z.kind === "mud") regen = Math.min(regen, 0.5);
      else if (Z.kind === "oil") oil = Z;
      else if (Z.kind === "fire") fire = !fire || (Z.data.dps || 10) > (fire.data.dps || 10) ? Z : fire;
      else if (Z.kind === "volt") volt = Z;
    }
    tx.zones = tx.zones.filter((Z) => Z.t > 0);
    // 沾上油：走出油以后身上还沾着几秒（着火时更烫）
    if (oil) tx.oiled = Math.max(tx.oiled || 0, oil.data.coat || 5);
    else tx.oiled = Math.max(0, (tx.oiled || 0) - dt);
    if (gas && !this.paused) {
      const k = this.tGasK();
      if (k > 0) this.envHurt?.(gas * k * dt, "gas");
      tx.gasNote = (tx.gasNote || 0) - dt;
      if (tx.gasNote <= 0) {
        tx.gasNote = 1;
        this.effects.push({ x: p.x, y: p.y - 70, text: k > 0 ? "毒雾" : "毒雾（面具）", t: 0.7, color: "#b5d97a" });
      }
    }
    if (fire && !this.paused && this.invulnerable <= 0) {
      const n = tx.oiled > 0 ? fire.data.oiled || fire.data.dps || 10 : fire.data.dps || 10;
      this.envHurt?.(n * dt, fire.data.by || "t_tide");
      tx.fireNote = (tx.fireNote || 0) - dt;
      if (tx.fireNote <= 0) {
        tx.fireNote = 0.8;
        this.effects.push({ x: p.x, y: p.y - 70, text: tx.oiled > 0 ? "身上的油着了！" : "烫！", t: 0.6, color: "#ff9a5a" });
      }
    }
    if (volt && !this.paused) {
      this.envHurt?.((volt.data.dps || 14) * dt, volt.data.by || "t_train");
      tx.voltNote = (tx.voltNote || 0) - dt;
      if (tx.voltNote <= 0) {
        tx.voltNote = 0.8;
        this.effects.push({ x: p.x, y: p.y - 70, text: "铁轨通电了！", t: 0.6, color: "#bfe3ff" });
      }
    }
    // 体力：泥里回一半，毒雾里不回；白毛风的冷也在这儿
    const cold = AI.frost?.coldRegen?.(this) ?? 1,
      k = regen * cold;
    if (k < 1 && p.stamina > st0) p.stamina = Math.max(st0, st0 + (p.stamina - st0) * k);
  }
  // 毒雾掉几成：身栏（隔离服）、头栏（潜水头盔、防毒面具）里最好的那件；都没有就看今天戴没戴口罩
  tGasK() {
    const sl = this.gr?.slots || {},
      ks = [TITAN_ARMOR[sl.body]?.gas, TITAN_ARMOR[sl.head]?.gas].filter((v) => v != null);
    return ks.length ? Math.min(...ks) : this.ut?.mask === this.s.day ? 0.5 : 1;
  }
  // 防毒面具：毒雾里照样回体力
  tGasRegen() {
    return !!TITAN_ARMOR[this.gr?.slots?.head]?.gasRegen;
  }
  // 站在烟里（雕爷扔的烟雾弹）
  tInSmoke(q) {
    return this.tx.zones.some((Z) => Z.kind === "smoke" && Math.hypot(q.x - Z.x, q.y - Z.y) <= Z.r * Math.min(1, 0.55 + Z.t / Z.max));
  }
  tSmokeNote(e) {
    if ((e.tSmokeT || 0) > (this.s.playSeconds || 0)) return;
    e.tSmokeT = (this.s.playSeconds || 0) + 0.6;
    this.effects.push({ x: e.x, y: e.y - 90, text: "烟里打不准", t: 0.5, color: "#cfc6a8" });
  }
  // 油着火：燃烧瓶烧着的地方、已经着了的油挨着的油
  tIgniteOil() {
    const tx = this.tx,
      oils = tx.zones.filter((Z) => Z.kind === "oil");
    if (!oils.length) return;
    const fires = (this.gx?.fires || []).filter((f) => f.region === this.s.region);
    let lit = tx.zones.filter((Z) => Z.kind === "fire");
    for (const Z of oils) if (fires.some((f) => Math.hypot(f.x - Z.x, f.y - Z.y) < (f.r || 60) + Z.r * 0.6)) this.tLight(Z);
    // 一片着了，挨着的接着着（一次最多传几层）
    for (let i = 0; i < 4; i++) {
      lit = tx.zones.filter((Z) => Z.kind === "fire");
      const next = tx.zones.filter((Z) => Z.kind === "oil" && lit.some((F) => Math.hypot(F.x - Z.x, F.y - Z.y) < (F.r + Z.r) * 0.85));
      if (!next.length) break;
      for (const Z of next) this.tLight(Z);
    }
  }
  tLight(Z) {
    const O = TITANS.tide.oil;
    Z.kind = "fire";
    Z.t = Z.max = O.burn;
    Z.data = { ...Z.data, dps: O.dps, oiled: O.oiledDps, by: "t_tide" };
    this.particlesAt?.(Z.x, Z.y - 10, "#f6b05a", 8);
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
      // 抓满了没挣开：接着那一下（看门的把人往地上摔）
      if (H.then && src && !src.dead && H.t <= 0 && !(src.stag > 0)) H.then(this, src);
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
    // 防毒面具：膨胀者的毒雾也不掉血
    if (by === "gas" && this._tNoGas) return;
    return super.envHurt?.(n, by);
  }
  tickHazards(dt, st0) {
    // 原来的毒雾（膨胀者）：穿隔离服、戴潜水头盔掉一半；戴防毒面具不掉血、照样回体力
    const sl = this.gr?.slots || {},
      k = TITAN_ARMOR[sl.body]?.gas ?? TITAN_ARMOR[sl.head]?.gas,
      none = this.tGasK() === 0;
    if ((k != null || none) && this.ut && this.inGas?.()) {
      const keep = this.ut.mask,
        p = this.s.player,
        sta = p.stamina;
      this.ut.mask = this.s.day;
      this._tNoGas = none;
      try {
        return super.tickHazards(dt, st0);
      } finally {
        this.ut.mask = keep;
        this._tNoGas = false;
        if (this.tGasRegen() && p.stamina < sta) p.stamina = sta;
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
      // 只有一回的（雕爷的库存）：拿过就没了
      if (D.once && g.gifts[id]) continue;
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
      if (!D || this.tg.gifts[o.of] === this.s.day || (D.once && this.tg.gifts[o.of])) return false;
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

  // ================= 最后一夜（扑火） =================
  // 主线打完、打赢七凶、身上三颗余烬核：早间广播提前三天说，那天 22:00 它从农场东边的林子里来；
  // 打起来以后守卫上塔、钟走得慢一半、走不开也睡不着；心扑到篝火、你倒下、天快亮了，它就退回去，7 天后再来（身上的伤留一半）。
  finalLive() {
    const F = this.tg?.final;
    return !!F && F.on > 0 && !F.won;
  }
  // 这一天（d）另有一场仗：长夜、灰隼团
  finalClash(d) {
    if (this.isLongNight?.(d)) return true;
    const r = this.raidState?.();
    return !!r && r.phase === "scheduled" && r.day === d;
  }
  finalPick(d) {
    for (let i = 0; i < 14 && this.finalClash(d); i++) d++;
    return d;
  }
  finalSay(text, tone = "warn") {
    this.toast(text, tone);
    if (this.o) this.olog?.(text, tone);
  }
  finalTick() {
    const g = this.tg,
      F = g?.final;
    if (!F || F.won) return;
    if (F.on) return this.finalLiveTick();
    if (!this.titanOpen("moth") || this.titanGone("moth") || this._tForce) return;
    const day = this.s.day,
      min = this.s.minute;
    // 早间广播：提前三天说
    if (!F.day) {
      if (min < 7 * 60) return;
      F.day = this.finalPick(day + FINAL.notice);
      g.rumor.moth ??= day;
      g.told.fNote = day;
      this.finalSay(FINAL_TEXT.notice.replace("{d}", F.day));
      return;
    }
    // 那一天的尸潮往后挪一天
    if (this.c && this.c.nextHordeDay === F.day && this.s.horde?.phase === "won") this.c.nextHordeDay = F.day + 1;
    const now = day * 1440 + min,
      start = F.day * 1440 + FINAL.hour,
      end = (F.day + 1) * 1440 + FINAL.dawn;
    // 错过了（远征、一下子过了好几个钟点）：它到了农场边上，没找到人，又缩回去了
    if (now >= end) return this.finalEnd("away");
    if (day !== F.day && now < start) return;
    // 那天另有一场仗（尸潮、灰隼团、长夜）：往后挪一天
    if (now < start && this.titanBusyDay()) {
      F.day = this.finalPick(F.day + 1);
      this.finalSay(FINAL_TEXT.busy.replace("{d}", F.day));
      return;
    }
    if (day === F.day && min >= 7 * 60 && g.told.fMorning !== day) {
      g.told.fMorning = day;
      this.finalSay(FINAL_TEXT.morning);
    }
    if (day === F.day && min >= FINAL.warn && min < FINAL.hour && g.told.fWarn !== day) {
      g.told.fWarn = day;
      this.finalSay(FINAL_TEXT.warn);
      this.emit?.("alarm");
    }
    if (now >= start) this.finalStart();
  }
  finalStart() {
    const F = this.tg.final;
    if (this.s.region !== "farm") {
      // 到时候不在农场：叫回去
      let ok = false;
      this._tFinalGo = true;
      try {
        ok = this.travel("farm");
      } finally {
        this._tFinalGo = false;
      }
      if (!ok || this.s.region !== "farm") return this.finalEnd("away");
      this.finalSay(FINAL_TEXT.home);
    }
    F.on = F.day;
    F.tries++;
    this.tStat("finals");
    // 已经摸到农场边上的夜行者这一夜不在
    if (this.s.enemies.farm?.some((z) => z.prowl)) {
      this.s.enemies.farm = this.s.enemies.farm.filter((z) => !z.prowl);
      if (this.s.region === "farm") this.enemies = this.s.enemies.farm;
    }
    this.finalGuards();
    this.finalSay(FINAL_TEXT.start);
    this.emit?.("alarm");
  }
  // 守卫：会上塔的那几个（吃过饭、有床、没受伤、不太累）跟尸潮夜一样守着
  finalGuards() {
    const cap = this.residentsCapacity?.() ?? 0;
    this._fGuards = (this.c?.residents || [])
      .filter((r, i) => i < cap && r.role !== "rest" && (r.priorities?.guard > 0 || r.workRole === "guard" || r.role === "guard") && (r.fatigue || 0) < 85 && !this.striking?.(r) && !this.laidUp?.("r:" + r.id))
      .map((r) => r.id)
      .slice(0, 8);
  }
  finalLiveTick() {
    const F = this.tg.final;
    if (this._fGuards == null) this.finalGuards();
    for (const r of this.c?.residents || [])
      if (this._fGuards.includes(r.id)) {
        r.workRole = "guard";
        r.status = "守最后一夜";
      }
    const now = this.s.day * 1440 + this.s.minute;
    if (now >= (F.on + 1) * 1440 + FINAL.dawn) return this.finalEnd("dawn");
    if (this.s.region !== "farm" && !this._tFinalGo) return this.finalEnd("away");
  }
  // 没打赢：退回林子，7 天后再来；身上的伤留一半（打掉的那几成的一半）
  finalEnd(why) {
    const g = this.tg,
      F = g.final,
      base = F.on || F.day || this.s.day;
    if (why !== "away") {
      const all = this.titansHere("moth"),
        max = this.titanMaxHp("moth"),
        hp = all.length ? all.reduce((a, z) => a + Math.max(0, z.hp), 0) : max * (1 - F.keep),
        dealt = clamp(1 - hp / Math.max(1, max), 0, 1);
      F.keep = Math.round(clamp(dealt * FINAL.keep, 0, 0.9) * 1000) / 1000;
      F.lost++;
    }
    F.on = 0;
    F.day = this.finalPick(base + FINAL.retry);
    delete g.hp.moth;
    if (this.s.region === "farm") {
      this.enemies = this.s.enemies.farm = (this.enemies || []).filter((z) => z.titan !== "moth" && z.tOf !== "moth");
      this.tClearFrom(null, true);
      this.tx.zones = [];
      this.tx.hold = null;
    }
    this.finalStandDown();
    this.finalSay(FINAL_TEXT[why].replace("{n}", FINAL.retry).replace("{d}", F.day));
  }
  finalWon() {
    const F = this.tg.final;
    F.won = this.s.day;
    F.on = 0;
    F.day = 0;
    F.keep = 0;
    delete this.tg.hp.moth;
    this.finalStandDown();
  }
  finalStandDown() {
    const night = this.s.minute < 360 || this.s.minute >= 1320;
    for (const r of this.c?.residents || []) if ((this._fGuards || []).includes(r.id) && night) r.workRole = "rest";
    this._fGuards = null;
  }
  // 守卫：最后一夜跟尸潮夜一样上塔（只在瞭望塔、守卫打感染者那一下算）
  residentActive(r) {
    const out = super.residentActive(r);
    if (out || !this._tDef || !this._fGuards?.length || !this.finalLive()) return out;
    return this._fGuards.includes(r.id);
  }
  updateDefense(dt) {
    this._tDef = true;
    try {
      return super.updateDefense(dt);
    } finally {
      this._tDef = false;
    }
  }
  advanceMinutes(n) {
    if (this._tFrame && n > 0 && n < 0.2 && this.tg && this.finalLive()) n *= FINAL.clock;
    return super.advanceMinutes(n);
  }
  travel(id) {
    if (this.tg && !this._tFinalGo && this.finalLive() && this.s.region === "farm" && id !== "farm" && this.titansHere("moth").length) {
      this.toast(FINAL_TEXT.travel, "warn");
      return false;
    }
    return super.travel(id);
  }
  sleep() {
    const F = this.tg?.final;
    if (F && !F.won && (F.on || (F.day === this.s.day && this.s.minute < FINAL.hour && this.titanOpen("moth")))) {
      this.toast(FINAL_TEXT.sleep, "warn");
      return false;
    }
    return super.sleep();
  }
  // 动静招来的夜袭：最后一夜不另来
  noiseBlocked() {
    return super.noiseBlocked() || !!this.tg?.final?.on;
  }
  // 夜行者摸到农场边上：最后一夜那天晚上不来（21:00 以后、打起来以后）
  tickProwl() {
    const F = this.tg?.final;
    if (F && !F.won && (F.on || (F.day === this.s.day && this.s.minute >= FINAL.warn && this.titanOpen("moth")))) return;
    return super.tickProwl();
  }
  // 风口：避难城的居住舱多两张床
  residentsCapacity() {
    return super.residentsCapacity() + (this.tg?.perks?.vent ? VENT_BEDS : 0);
  }
  // 隧道第 25 层：末班车在的时候这一层没有别的感染者
  generateEnemies(id) {
    if (id === "tunnel" && this.tg && this.tunnelFloor?.() === TITANS.train.floor && this.titanHome("train")) return [];
    return super.generateEnemies(id);
  }
  // 隧道换一层：末班车回窝（跟换图一样）
  tunnelDown() {
    const before = this.tunnelFloor?.(),
      list = this.s.enemies?.tunnel;
    const ok = super.tunnelDown();
    if (ok && this.tg && Array.isArray(list) && this.tunnelFloor?.() !== before && list.some((z) => z.titan)) {
      this.titanLeftRegion("tunnel", list);
      this.tx = transient();
    }
    return ok;
  }

  // ================= 页面用的 =================
  // 头目血条：醒着、离得近的那一凶
  bossBar() {
    const near = (this.enemies || []).filter((z) => z.titan && !z.dead && (z.awake || z.homing) && dist(z, this.s.player) < (TITANS[z.titan].leash > 2000 ? 99999 : 1100)),
      e = near.find((z) => z.type === TITANS[z.titan].type) || near[0];
    if (!e) return super.bossBar();
    const T = TITANS[e.titan],
      all = this.titansHere(e.titan),
      hp = all.reduce((a, z) => a + Math.max(0, z.hp), 0),
      max = this.titanMaxHp(e.titan),
      intel = !!this.tg.intel[e.titan];
    const tag = e.homing ? "回窝了" : e.stag > 0 ? "晃了" : e.inv > 0 && e.roar ? "变了" : AI[e.titan]?.tag?.(this, e) || "";
    const note = AI[e.titan]?.note?.(this, e, intel) || (intel ? T.intel : "");
    // 有几只的：每一只一小条（打没了的是空的）
    const keys = partKeys(e.titan),
      k = max / T.hp,
      parts = keys.length
        ? keys.map((key) => {
            const z = all.find((x) => x.pkey === key),
              P = T.parts[key.replace(/\d+$/, "")];
            return { key, name: P.name, hp: z ? Math.max(0, z.hp) : 0, max: z ? z.maxHp : Math.round(P.hp * k) };
          })
        : null;
    return {
      kind: "titan",
      titan: e.titan,
      name: T.name,
      title: T.title,
      hp: Math.max(0, hp),
      max,
      tag,
      note,
      phases: parts ? [] : T.phases,
      poise: e.stag > 0 ? 1 : clamp(e.poise / Math.max(1, e.poiseMax), 0, 1),
      armor: AI[e.titan]?.armorBar?.(this, e) || null,
      halves: !parts && all.length > 1 ? all.map((z) => ({ hp: Math.max(0, z.hp), max: z.maxHp })) : null,
      parts,
    };
  }
  // 世界地图上的窝、顶上的提醒
  ruinNews() {
    const out = super.ruinNews?.() || [];
    if (!this.tg) return out;
    for (const id of TITAN_IDS) {
      const T = TITANS[id];
      if (T.final || !this.titanKnown(id) || !this.titanOpen(id) || this.titanGone(id)) continue;
      out.push({ kind: "titan", titan: id, region: T.region, when: "lair", text: tPoss(T.name) + "窝" + (T.floor ? "（第 " + T.floor + " 层）" : "") });
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
      if (T.final || !heard || this.s.day - heard > 2 || !this.titanOpen(id) || this.titanGone(id) || this.tg.first[id]) continue;
      extra.push({ pri: 4, text: T.name + " · " + REGIONS[T.region].name + (T.hours ? "（天黑以后）" : "") + (T.floor ? "（第 " + T.floor + " 层）" : ""), action: "wView", id: "collection" });
    }
    // 最后一夜：定下来以后一直挂着（哪天、几点、从哪边来）
    const F = this.tg.final;
    if (F?.on) extra.push({ pri: 1, text: "最后一夜 · 守住篝火", action: "wView", id: "collection" });
    else if (F?.day && !F.won && F.day - this.s.day <= FINAL.notice + 1) extra.push({ pri: F.day === this.s.day ? 1 : 3, text: "最后一夜 · 第 " + F.day + " 天 22:00 · 农场东边", action: "wView", id: "collection" });
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
        final: !!T.final,
        nextFinal: T.final && g.final?.day && !g.final.won ? g.final.day : 0,
        name: T.name,
        title: T.title,
        where: REGIONS[T.region].name + (T.floor ? " · 第 " + T.floor + " 层" : ""),
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
  // 有几只的那几凶：按只记的血
  for (const [k, v] of Object.entries(g.hp)) {
    if (v.parts === undefined) continue;
    const keys = partKeys(k);
    if (!obj(v.parts) || !keys.length || Object.entries(v.parts).some(([pk, n]) => !keys.includes(pk) || !int(n, 0, 1e7))) bad("血");
  }
  if (!Array.isArray(g.donated) || g.donated.length > TITAN_ORDER.length || g.donated.some((id) => !Object.hasOwn(ITEMS, id) || !String(id).startsWith("tTrophy")) || new Set(g.donated).size !== g.donated.length) bad("十凶柜");
  if (!Array.isArray(g.caseDone) || g.caseDone.some((n) => !TITAN_CASE.steps.some((st) => st.n === n))) bad("十凶柜");
  if (!obj(g.gifts) || Object.entries(g.gifts).some(([k, v]) => !known(k) || !int(v, 0, 1e6))) bad("记录");
  if (!obj(g.told) || Object.keys(g.told).length > 400 || Object.entries(g.told).some(([k, v]) => k.length > 40 || !int(v, 0, 1e6))) bad("记录");
  if (!obj(g.stats) || Object.values(g.stats).some((v) => !int(v))) bad("记录");
  if (g.intro !== undefined && (!obj(g.intro) || !int(g.intro.day, 0, 1e6) || typeof g.intro.told !== "boolean")) bad("记录");
  if (g.intro2 !== undefined && (!obj(g.intro2) || !int(g.intro2.day, 0, 1e6) || typeof g.intro2.told !== "boolean")) bad("记录");
  const F = g.final;
  if (!obj(F) || !int(F.day, 0, 1e6) || !int(F.on, 0, 1e6) || !int(F.tries, 0, 1e5) || !int(F.lost, 0, 1e5) || !Number.isFinite(F.keep) || F.keep < 0 || F.keep > 1 || !int(F.won, 0, 1e6) || Object.keys(F).length > 8) bad("最后一夜");
}
