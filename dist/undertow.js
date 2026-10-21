// v0.24.0「暗涌」：搜东西有惊喜，废墟里多了新感染者和头目。
// 柜子：每张废墟 9 个候选每天亮 4–5 个，按柜子种类和四档稀有度抽；锁着的要撬；感染者身上按种类掉东西。
// 感染者每两天换一套摆法；第 4 天起膨胀者、装死者，第 8 天起吐酸者、夜行者；大块头、护士长每 7 天来一天，仓库守卫加强。
// 每天三成五的机会，一片废墟里出一件小事（被困的人、空投、尸堆、储藏室、灰隼团的搜索队、背包客、对讲机）。
// 电台早上播今天哪里有动静，档案馆收头目的战利品，宵禁让夜行者摸不到农场，麦穗对着装死者叫。
// 新进度都放在 s.undertow，原来的字段不动；毒雾、酸液、飞出去的车门这些只在内存里。
import { Engine as FeelEngine, freshState as feelFresh, migrateState as feelMigrate, newGameState as feelNewGame } from "./feel.js";
import { ITEMS, REGIONS, WORLD, ZOMBIES } from "./data.js";
import { RULES, RUIN_PACKS, GRAB_BITE_PARTS, CRAWL_BITE_PARTS, phaseOf } from "./gear-data.js";
import {
  U_SCHEMA,
  RUINS,
  TIERS,
  TIER_NAMES,
  TIER_ODDS,
  LOCKED_ODDS,
  PILE_ODDS,
  RARE_ODDS,
  SECOND_DRAW,
  KINDS,
  SEED_CROPS,
  ATTACHMENTS,
  PRY,
  LIT,
  CANDIDATES,
  KILL_DROPS,
  EVENT_CHANCE,
  RUIN_EVENTS,
  EVENT_IDS_U,
  EVENT_RULES,
  EVENT_SPOTS,
  DECOR_SPOTS,
  ODD_KINDS,
  SURVIVORS,
  LAYOUTS,
  NEW_TYPES,
  NEW_RULES,
  PLACE,
  DECOR_CORPSES,
  PROWL,
  BOSSES,
  BOSS_IDS,
  TROPHY_IDS,
  TROPHY_CASE,
  RADIO_HOUR,
} from "./undertow-data.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const SAFE = ["farm", "market"];
const CUSTOM = ["spitter", "stalker", "brute", "nurse"];
const NEW_ALL = [...NEW_TYPES, "brute", "nurse"];
const BODY_NEW = ["bloater", "faker", "spitter", "stalker", "brute", "nurse"];
export const U_OBJECTS = ["uSurvivor", "uJoin", "uSend", "uMerchant", "uGood", "uTalkie", "uDoor"];
const EV_STATES = ["wait", "follow", "safe", "done", "dead", "fall", "landed", "open", "gone"];
const STAT_KEYS = ["opened", "rare", "precious", "pried", "events", "gas", "spits", "fakerGrabs", "rescued", "bossWins"];
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " ×" + n)
    .join("、");
const regionName = (id) => REGIONS[id]?.name || id;

// ---------- 随机：存档种子 + 地图 + 日期，读档不会重抽 ----------
export function hashOf(...parts) {
  let h = 2166136261;
  for (const part of parts) {
    const s = String(part);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 0x9e3779b9;
    h = Math.imul(h ^ (h >>> 15), 2246822507);
  }
  return h >>> 0;
}
export function rngOf(seed) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pickOf = (list, r) => list[Math.floor(r() * list.length) % list.length];

const bossRec = () => ({ wins: 0, first: 0, last: 0 });
const utDefaults = () => ({
  schema: U_SCHEMA,
  seed: 0,
  evDay: 0,
  ev: null,
  cache: null,
  lit: {},
  gen: {},
  pried: {},
  boss: Object.fromEntries(BOSS_IDS.map((id) => [id, bossRec()])),
  intel: {},
  mask: 0,
  prowl: 0,
  prowlOn: false,
  prowlSpawned: 0,
  radioDay: 0,
  trophies: [],
  trophyDone: false,
  seen: {},
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
  old: false,
});

export function migrateState(s) {
  feelMigrate(s);
  const d = utDefaults();
  if (!s.undertow) {
    s.undertow = d;
    s.undertow.old = s.day > 1 || (s.stats?.kills || 0) > 0;
  } else {
    const x = s.undertow;
    s.undertow = {
      ...d,
      ...x,
      lit: { ...x.lit },
      gen: { ...x.gen },
      pried: { ...x.pried },
      boss: Object.fromEntries(BOSS_IDS.map((id) => [id, { ...bossRec(), ...x.boss?.[id] }])),
      intel: { ...x.intel },
      trophies: [...(x.trophies || [])],
      seen: { ...x.seen },
      stats: { ...d.stats, ...x.stats },
    };
  }
  const u = s.undertow;
  if (!u.seed) u.seed = (Math.floor(Math.random() * 0x7fffffff) ^ hashOf("ember", s.day, s.money, s.idCounter)) >>> 0 || 1;
  return s;
}
export function freshState() {
  const s = feelFresh();
  s.undertow = utDefaults();
  return migrateState(s);
}
export function newGameState() {
  const s = feelNewGame();
  s.undertow = utDefaults();
  return migrateState(s);
}

const uxDefaults = () => ({
  region: null,
  clock: 0,
  fuses: [],
  clouds: [],
  acid: [],
  puddles: [],
  doors: [],
  flashes: [],
  pry: null,
  surv: null,
  survNear: false,
  drop: null,
  bark: null,
  barked: new Set(),
  spotted: new Set(),
  intro: new Set(),
  breathT: 0,
  gasNote: 0,
  acidWear: 0,
  hurtT: 0,
  decorKey: "",
  decor: [],
});

export class Engine extends FeelEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
  }
  get ut() {
    return this.s.undertow;
  }
  get ux() {
    return (this._ux ??= uxDefaults());
  }

  // ================= 每天：今天的事 =================
  phaseAt(day) {
    const base = phaseOf(day);
    return this.gr && this.gr.grace >= day && base > 0 ? base - 1 : base;
  }
  ensureDay() {
    const u = this.ut;
    if (!u || u.evDay === this.s.day) return;
    this.rollDay();
  }
  rollDay() {
    const u = this.ut,
      day = this.s.day;
    u.evDay = day;
    u.ev = null;
    if (u.cache && u.cache.day < day) u.cache = null;
    for (const [k, v] of Object.entries(u.pried)) if (v !== day) delete u.pried[k];
    for (const id of Object.keys(u.lit)) if (u.lit[id]?.day !== day) delete u.lit[id];
    if (day < 2) return;
    const r = rngOf(hashOf(u.seed, "ev", day));
    if (r() >= EVENT_CHANCE) return;
    const haz = this.hazardToday?.()?.region;
    const regions = RUINS.filter((id) => id !== haz && !(u.cache && u.cache.day === day && u.cache.region === id));
    if (!regions.length) return;
    const region = pickOf(regions, r);
    const ids = EVENT_IDS_U.filter((id) => !RUIN_EVENTS[id].raid || this.raidAhead());
    const id = pickOf(ids, r);
    u.ev = { day, id, region, spot: Math.floor(r() * 3) % 3, st: "wait", bits: 0, spawned: false };
    u.stats.events++;
  }
  // 灰隼团的袭击已经定了日子、还没到
  raidAhead() {
    if (!this.o || !this.raidState) return false;
    const r = this.raidState();
    return r?.phase === "scheduled" && r.day > this.s.day;
  }
  eventToday(region = null) {
    this.ensureDay();
    const ev = this.ut?.ev;
    if (!ev || ev.day !== this.s.day) return null;
    return region && ev.region !== region ? null : ev;
  }
  // 头目哪天来
  bossOn(id, day = this.s.day) {
    const B = BOSSES[id];
    if (!B?.first) return false;
    return day >= B.first && (day - B.first) % B.every === 0 && this.phaseAt(day) >= B.phase;
  }
  bossFor(region, day = this.s.day) {
    return ["brute", "nurse"].find((id) => BOSSES[id].region === region && this.bossOn(id, day)) || null;
  }
  // 地图上、手记里要说的：今天、明天哪里有什么
  ruinNews() {
    if (!this.ut) return [];
    const out = [],
      day = this.s.day,
      radio = !!this.r?.radio;
    const ev = this.eventToday();
    if (ev && !["done", "dead", "gone"].includes(ev.st))
      out.push({ region: ev.region, kind: "event", when: "today", text: radio ? "今天这里有动静：" + RUIN_EVENTS[ev.id].hint : "好像有动静", name: radio ? RUIN_EVENTS[ev.id].name : "动静" });
    for (const id of ["brute", "nurse"]) {
      const B = BOSSES[id];
      if (this.bossOn(id, day) && this.ut.boss[id].last !== day) out.push({ region: B.region, kind: "boss", boss: id, when: "today", text: "今天 · " + B.name, name: B.name });
      if (this.bossOn(id, day + 1)) out.push({ region: B.region, kind: "boss", boss: id, when: "tomorrow", text: "明天 · " + B.name, name: B.name });
    }
    const c = this.ut.cache;
    if (c && c.day === day && !c.opened) out.push({ region: c.region, kind: "cache", when: "today", text: "对讲机说的箱子", name: "对讲机说的箱子" });
    return out;
  }

  // ================= 进图：柜子、事件、头目 =================
  assignRegion() {
    super.assignRegion();
    if (!this.ut || !this.gr) return;
    const id = this.s.region;
    if (this.ux.region !== id) this.leftRegion(this.ux.region, id);
    if (this._uNewDay) return;
    this.uPlace();
  }
  uPlace() {
    const id = this.s.region;
    this.ensureDay();
    if (!RUINS.includes(id)) return;
    this.placeContainers(id);
    this.placeEvent(id);
    this.placeRadioCache(id);
    this.dropStaleBosses(id);
    this.spawnBoss(id);
    this.ux.decorKey = "";
  }
  leftRegion(from, to) {
    const ux = this.ux,
      ev = this.ut?.ev;
    if (ev && ev.day === this.s.day && ev.region === from) {
      if (ev.id === "trapped" && ev.st === "follow") {
        if (ux.survNear) this.survivorSafe(true);
        else {
          ev.st = "wait";
          this.toast("被困的人没跟上，又躲回去了。", "warn");
        }
      }
      if (ev.id === "airdrop" && ev.st === "fall") ev.st = "landed";
    }
    ux.region = to;
    ux.fuses = [];
    ux.clouds = [];
    ux.acid = [];
    ux.puddles = [];
    ux.doors = [];
    ux.flashes = [];
    ux.pry = null;
    ux.surv = null;
    ux.survNear = false;
    ux.drop = null;
    ux.bark = null;
    ux.decorKey = "";
  }

  // ---------- 柜子 ----------
  litToday(id) {
    const u = this.ut,
      day = this.s.day,
      have = u.lit[id];
    if (have && have.day === day) return have.ids;
    const cands = CANDIDATES[id],
      r = rngOf(hashOf(u.seed, "lit", id, day)),
      n = LIT[0] + (r() < 0.5 ? 0 : 1),
      must = cands.filter((c) => c.orig && !this.s.opened[id + "-" + c.id]),
      pool = cands.filter((c) => !must.includes(c));
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const ids = [...must, ...pool.slice(0, Math.max(0, n - must.length))].map((c) => c.id);
    u.lit[id] = { day, ids };
    return ids;
  }
  placeContainers(id) {
    const lit = new Set(this.litToday(id)),
      cands = CANDIDATES[id],
      day = this.s.day;
    const origIds = new Set(cands.filter((c) => c.orig).map((c) => id + "-" + c.id));
    // 今天打开过的一直留着（显示“已搜索”）
    const keep = (cid) => lit.has(cid) || this.s.opened[id + "-" + cid]?.day === day;
    this.objects = this.objects.filter((o) => !(o.type === "crate" && origIds.has(o.id) && !keep(o.id.slice(id.length + 1))));
    for (const c of cands) {
      if (!keep(c.id)) continue;
      const oid = id + "-" + c.id;
      if (c.orig) {
        const o = this.objects.find((x) => x.type === "crate" && x.id === oid);
        if (o) Object.assign(o, { ukind: c.kind, cand: c.id, orig: true, origLoot: o.origLoot || o.loot });
        continue;
      }
      const q = this.freePoint(c.x, c.y);
      this.objects.push({ type: "crate", id: oid, x: q.x, y: q.y, loot: {}, name: c.name, icon: 40, elite: false, ukind: c.kind, cand: c.id, locked: c.kind === "locked" });
    }
  }
  oddKind(region, r) {
    return pickOf(ODD_KINDS[region] || ["toolbox"], r);
  }
  // 抽一个柜子：{ bundle, tier, kind }
  rollContainer(o, day = this.s.day) {
    const region = this.s.region,
      r = rngOf(hashOf(this.ut.seed, "box", o.id, day)),
      ph = Math.min(2, this.phase());
    let odds = TIER_ODDS[ph],
      kind = o.ukind;
    if (o.ukind === "locked" || o.odds === "locked") {
      odds = LOCKED_ODDS;
      kind = this.oddKind(region, r);
    } else if (o.odds === "pile") {
      odds = PILE_ODDS;
      kind = this.oddKind(region, r);
    } else if (o.odds === "rare") {
      odds = RARE_ODDS;
      kind = this.oddKind(region, r);
    }
    if (!KINDS[kind]) kind = "toolbox";
    const first = this.drawFrom(kind, odds, r),
      second = r() < SECOND_DRAW ? this.drawFrom(kind, odds, r) : null,
      bundle = { ...first.bundle };
    if (second) for (const [k, n] of Object.entries(second.bundle)) bundle[k] = (bundle[k] || 0) + n;
    // 一次性的东西（图纸、手电）抽到两份只给一份
    for (const k of Object.keys(bundle)) if (k.startsWith("bp_") || k === "flashlight" || ATTACHMENTS.includes(k)) bundle[k] = 1;
    const tier = Math.max(first.tier, second?.tier ?? 0);
    return { bundle, tier: TIERS[tier], kind };
  }
  drawFrom(kind, odds, r) {
    const x = r();
    let acc = 0,
      t = 0;
    for (; t < 3; t++) {
      acc += odds[t];
      if (x < acc) break;
    }
    const list = KINDS[kind][TIERS[t]],
      entry = list[Math.floor(r() * list.length) % list.length];
    return { tier: t, bundle: this.resolveEntry(entry, r) };
  }
  ownsAttachment(id) {
    if (this.qty(id, true) > 0) return true;
    return Object.values(this.f?.weaponMods || {}).some((m) => m?.barrel === id || m?.accessory === id);
  }
  resolveEntry(entry, r) {
    const pick = r(),
      pick2 = r();
    if (Array.isArray(entry)) {
      const [id, a, b] = entry;
      return { [id]: a + Math.floor(pick * (b - a + 1)) };
    }
    if (entry.seed) {
      const crop = SEED_CROPS[Math.floor(pick * SEED_CROPS.length) % SEED_CROPS.length],
        trait = entry.seed[Math.floor(pick2 * entry.seed.length) % entry.seed.length];
      return { ["seed_" + crop + "_" + trait]: 2 };
    }
    if (entry.attach) {
      const missing = ATTACHMENTS.filter((a) => !this.ownsAttachment(a));
      return missing.length ? { [missing[Math.floor(pick * missing.length) % missing.length]]: 1 } : this.resolveEntry(entry.else, r);
    }
    if (entry.bp) return this.knows?.(entry.bp) ? this.resolveEntry(entry.else, r) : { [entry.bp]: 1 };
    if (entry.once) return this.qty(entry.once, true) > 0 || this.isWorn?.(entry.once) ? this.resolveEntry(entry.else, r) : { [entry.once]: 1 };
    return { scrap: 2 };
  }
  // 打开一个柜子：交给原来的补给箱规则（背包满、守卫、嗅觉、涂鸦、每日加成都照旧），里面换成今天抽到的
  openContainer(o) {
    const day = this.s.day;
    if (o.elite && this.enemies.some((z) => z.type === "elite" && !z.dead)) return super.interact();
    const old = this.s.opened[o.id];
    if (old?.day === day) {
      this.toast("这里今天已经搜索过了。");
      return;
    }
    if (o.locked && this.ut.pried[o.id] !== day) return this.startPry(o);
    const fresh = !old && o.orig;
    const roll = fresh ? null : this.rollContainer(o, day),
      before = o.loot;
    if (roll) o.loot = roll.bundle;
    delete this.s.opened[o.id];
    let opened = false;
    // 表里是到手的数：不再打统一高难度的三分之二折；提示里写柜子的名字
    if (roll) this._uLoot = { name: o.name, bundle: roll.bundle, tier: roll.tier };
    // 柜子比躺着的尸体离你近：按 E 是开柜子，不是踩尸体
    this._uNoLying = true;
    try {
      super.interact();
    } finally {
      this._uLoot = null;
      this._uNoLying = false;
      opened = this.s.opened[o.id]?.day === day;
      if (!opened && old) this.s.opened[o.id] = old;
      if (roll) o.loot = before;
    }
    if (!opened) return;
    const u = this.ut;
    u.stats.opened++;
    if (o.evBit != null) {
      const ev = this.ut.ev;
      if (ev) ev.bits |= 1 << o.evBit;
      if (ev && ["pile", "airdrop"].includes(ev.id)) ev.st = "done";
      if (ev && ev.id === "storeroom" && (ev.bits & 3) === 3) ev.st = "done";
    }
    if (o.cache && u.cache) u.cache.opened = true;
    if (roll && (roll.tier === "rare" || roll.tier === "precious")) {
      const precious = roll.tier === "precious";
      u.stats[roll.tier]++;
      this.effects.push({ x: o.x, y: o.y - 70, text: TIER_NAMES[roll.tier] + "！", t: 1.6, color: precious ? "#ffcf6a" : "#8fd0ff" });
      this.ux.flashes.push({ x: o.x, y: o.y, t: 0.9, max: 0.9, tier: roll.tier });
      this.particlesAt(o.x, o.y, precious ? "#ffcf6a" : "#8fd0ff", 16);
      this.events.push({ type: precious ? "preciousLoot" : "rareLoot", x: o.x, y: o.y });
    }
  }

  // ---------- 撬锁 ----------
  pryTool() {
    if (this.hasTalent?.("lockpick")) return "pick";
    if (this.qty("crowbar") > 0) return "crowbar";
    return null;
  }
  pryReason(o) {
    if (!this.pryTool()) return "要回收撬棍（随身就能做：废金属 4、木材 2），学了「开锁」就不用";
    if (this.enemies.some((z) => !z.dead && !z.lying && z.state === "chase" && dist(z, this.s.player) < 160)) return "感染者就在旁边，先解决它们";
    return "";
  }
  startPry(o) {
    const why = this.pryReason(o);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const door = o.type === "uDoor",
      tool = this.pryTool(),
      R = door ? EVENT_RULES.storeroom : PRY,
      silent = tool === "pick";
    this.ux.pry = { o, t: 0, max: silent ? R.fast : R.time, silent, every: R.every || 1, noise: R.noise, tick: 0, x: this.s.player.x, y: this.s.player.y, door };
    this.toast(silent ? "用开锁的手艺慢慢拨（" + (silent ? R.fast : R.time) + " 秒，没声音）。走开就停。" : "用撬棍撬（" + R.time + " 秒，声音很响）。走开就停。", silent ? "normal" : "warn");
    this.emit("pryStart");
    return true;
  }
  cancelPry(text) {
    if (!this.ux.pry) return;
    this.ux.pry = null;
    if (text) this.toast(text, "warn");
  }
  tickPry(dt) {
    const P = this.ux.pry;
    if (!P) return;
    const p = this.s.player;
    if (!this.objects.includes(P.o) || dist(p, P.o) > (P.door ? 110 : PRY.range + 20) || dist(p, P) > 40 || this.gx.grab || this.gx.down > 0 || this.fx.roll) return this.cancelPry("撬到一半停了。");
    P.t += dt;
    P.tick -= dt;
    if (P.tick <= 0) {
      P.tick = P.every;
      if (!P.silent) this.noise.push({ x: P.o.x, y: P.o.y, r: P.noise, t: 1 });
      this.events.push({ type: "pryTick", x: P.o.x, y: P.o.y, silent: P.silent });
    }
    if (P.t < P.max) return;
    this.ux.pry = null;
    this.ut.stats.pried++;
    this.events.push({ type: "pryDone", x: P.o.x, y: P.o.y });
    if (P.door) return this.openStoreroom(P.o);
    this.ut.pried[P.o.id] = this.s.day;
    this.openContainer(P.o);
  }

  // ---------- 废墟里的小事 ----------
  eventSpot(ev) {
    const s = EVENT_SPOTS[ev.region][ev.spot] || EVENT_SPOTS[ev.region][0];
    return this.freePoint(s.x, s.y);
  }
  placeEvent(id) {
    const ev = this.eventToday(id);
    if (!ev) return;
    const at = this.eventSpot(ev),
      day = this.s.day,
      first = !this.ut.seen["ev:" + day];
    if (first && !["done", "dead", "gone"].includes(ev.st)) {
      this.ut.seen["ev:" + day] = day;
      this.pruneSeen();
      this.toast(this.r?.radio ? "今天这里有动静：" + RUIN_EVENTS[ev.id].hint + "。" : "这片废墟里好像有动静。", "gold");
    }
    if (ev.id === "trapped") {
      if (ev.st === "follow" && this.ux.surv) this.objects.push(this.ux.surv.o);
      else if (ev.st === "wait" || ev.st === "follow") {
        // 读档、换图回来：他又躲回原处了
        ev.st = "wait";
        const o = { type: "uSurvivor", name: "被困的人", x: at.x, y: at.y, icon: 56, id: "usurv:" + day };
        this.objects.push(o);
        this.ux.surv = { o, hp: EVENT_RULES.trapped.hp, held: 0, hitCd: 0, noiseT: 0 };
      } else if (ev.st === "safe") this.placeSurvivorChoice();
    }
    if (ev.id === "airdrop") {
      if (ev.st === "wait") {
        ev.st = "fall";
        this.ux.drop = { t: EVENT_RULES.airdrop.fall, max: EVENT_RULES.airdrop.fall, x: at.x, y: at.y };
        this.toast("天上有飞机的声音——一个箱子挂着伞往下落，大约 60 秒后落地。", "gold");
        this.events.push({ type: "plane", x: at.x, y: at.y });
      } else if (ev.st === "fall" && !this.ux.drop) this.ux.drop = { t: EVENT_RULES.airdrop.fall, max: EVENT_RULES.airdrop.fall, x: at.x, y: at.y };
      if (ev.st === "landed") this.objects.push({ type: "crate", id: id + "-uair", x: at.x, y: at.y, loot: {}, name: "空投箱", icon: 40, elite: false, ukind: "airdrop", odds: "rare", evBit: 0 });
    }
    if (ev.id === "pile") {
      if (!ev.spawned) {
        ev.spawned = true;
        // v0.39：清晨抉择“清掉了”的那片废墟今天、明天都安静——尸堆里装死的也算清掉了（箱子照样在）
        const cl = this.dy?.clear,
          quiet = !!cl && cl.region === this.s.region && cl.until >= day;
        if (this.phase() >= 1 && !quiet) {
          const r = rngOf(hashOf(this.ut.seed, "pile", day)),
            n = EVENT_RULES.pile.fakers[0] + Math.floor(r() * (EVENT_RULES.pile.fakers[1] - EVENT_RULES.pile.fakers[0] + 1));
          for (let i = 0; i < n; i++) {
            const a = (i / n) * Math.PI * 2 + 0.7,
              q = this.freePoint(at.x + Math.cos(a) * 58, at.y + Math.sin(a) * 34);
            this.enemies.push(this.makeFaker(q.x, q.y, { pile: true }));
          }
        }
      }
      if (ev.st !== "done") this.objects.push({ type: "crate", id: id + "-upile", x: at.x, y: at.y, loot: {}, name: "尸堆底下的箱子", icon: 40, elite: false, ukind: "pile", odds: "pile", evBit: 0 });
    }
    if (ev.id === "storeroom") {
      if (ev.st === "wait") this.objects.push({ type: "uDoor", name: "锁着的储藏室", x: at.x, y: at.y, icon: 40, id: id + "-udoor" });
      else
        for (let i = 0; i < 2; i++)
          if (!(ev.bits & (1 << i)) || this.s.opened[id + "-uroom" + (i + 1)]?.day === day)
            this.objects.push({ type: "crate", id: id + "-uroom" + (i + 1), x: at.x - 30 + i * 60, y: at.y + 10, loot: {}, name: "储藏室里的铁柜", icon: 40, elite: false, ukind: "locked", odds: "locked", evBit: i });
    }
    if (ev.id === "raiders") {
      if (!ev.spawned && this.raidAhead()) {
        ev.spawned = true;
        for (let i = 0; i < EVENT_RULES.raiders.n; i++) {
          const q = this.freePoint(at.x + (i ? 40 : -40), at.y + (i ? 20 : -10)),
            z = this.enemy("raider", q.x, q.y, false);
          Object.assign(z, { uParty: true, aim: 0, aimX: 0, aimY: 0, cooldown: 1 + i, state: "patrol", homeX: q.x, homeY: q.y, blind: 0, post: null });
          this.enemies.push(z);
        }
      }
    }
    if (ev.id === "merchant" && ev.st !== "done") {
      this.objects.push({ type: "uMerchant", name: "背包客", x: at.x, y: at.y - 36, icon: 56, id: "umerchant:" + day });
      const goods = this.merchantGoods();
      goods.forEach((g, i) => {
        if (ev.bits & (1 << i)) return;
        this.objects.push({ type: "uGood", i, name: "换" + itemsText(g.bundle) + "（" + itemsText(g.price) + "）", x: at.x - 34 + i * 68, y: at.y + 26, icon: 40, tier: g.tier, bundle: g.bundle, price: g.price });
      });
    }
    if (ev.id === "radio" && ev.st === "wait") this.objects.push({ type: "uTalkie", name: "还在响的对讲机", x: at.x, y: at.y, icon: 40 });
  }
  placeRadioCache(id) {
    const c = this.ut.cache;
    if (!c || c.day !== this.s.day || c.region !== id || c.opened) return;
    const s = EVENT_SPOTS[id][c.spot] || EVENT_SPOTS[id][0],
      q = this.freePoint(s.x + 50, s.y + 30);
    this.objects.push({ type: "crate", id: id + "-ucache", x: q.x, y: q.y, loot: {}, name: "对讲机说的箱子", icon: 40, elite: false, ukind: "cache", odds: "rare", cache: true });
  }
  merchantGoods() {
    const ev = this.ut.ev,
      r = rngOf(hashOf(this.ut.seed, "mer", ev?.day || this.s.day)),
      region = ev?.region || this.s.region;
    return ["uncommon", "rare"].map((tier) => {
      const kind = this.oddKind(region, r),
        list = KINDS[kind][tier],
        entry = list[Math.floor(r() * list.length) % list.length];
      return { tier, kind, bundle: this.resolveEntry(entry, r), price: { ...EVENT_RULES.merchant.price[tier] } };
    });
  }
  buyGood(o) {
    const ev = this.eventToday(this.s.region);
    if (!ev || ev.id !== "merchant" || ev.bits & (1 << o.i)) return false;
    const g = o.bundle ? { bundle: o.bundle, price: o.price } : this.merchantGoods()[o.i];
    if (!this.afford(g.price)) {
      this.toast("背包客：「" + itemsText(g.price) + "，少一样都不换。」", "warn");
      return false;
    }
    if (!this.canAdd(g.bundle)) {
      this.toast("背包已满，先腾点地方。", "warn");
      return false;
    }
    this.spend(g.price);
    this.add(g.bundle, true);
    ev.bits |= 1 << o.i;
    this.objects = this.objects.filter((x) => x !== o);
    if ((ev.bits & 3) === 3) ev.st = "done";
    this.toast("跟背包客换到：" + itemsText(g.bundle), "gold");
    this.emit("trade");
    return true;
  }
  pickTalkie(o) {
    const ev = this.eventToday(this.s.region);
    if (!ev || ev.id !== "radio") return false;
    const r = rngOf(hashOf(this.ut.seed, "talk", ev.day)),
      others = RUINS.filter((id) => id !== ev.region),
      region = pickOf(others, r);
    this.ut.cache = { day: this.s.day + 1, region, spot: Math.floor(r() * 3) % 3, opened: false };
    ev.st = "done";
    this.objects = this.objects.filter((x) => x !== o);
    this.noise.push({ x: o.x, y: o.y, r: EVENT_RULES.radio.noise, t: 1.5 });
    this.events.push({ type: "talkie", x: o.x, y: o.y });
    this.toast("对讲机“嘀”地叫了一声，里面有人报了个位置：明天" + regionName(region) + "有一个箱子（地图上会标出来）。", "gold");
    return true;
  }
  openStoreroom(o) {
    const ev = this.eventToday(this.s.region);
    if (!ev || ev.id !== "storeroom") return;
    ev.st = "open";
    this.objects = this.objects.filter((x) => x !== o);
    this.toast("储藏室的铁门撬开了：里面有两个锁着的铁柜（已经撬开，直接搜）。", "gold");
    for (let i = 0; i < 2; i++) this.ut.pried[this.s.region + "-uroom" + (i + 1)] = this.s.day;
    this.placeEvent(this.s.region);
  }
  // 被困的人
  survivorGo(o) {
    const ev = this.eventToday(this.s.region);
    if (!ev || ev.id !== "trapped" || ev.st !== "wait") return false;
    ev.st = "follow";
    this.toast("他点点头跟上来了：护送他到西边的出口。他走得慢，别让感染者抓住他。", "gold");
    this.tipOnce("escort", "护送的时候他会跟着你走；离你太远他会停下等。被感染者抓住会掉血，血掉光就救不回来了。");
    return true;
  }
  survivorSafe(left = false) {
    const ev = this.ut.ev;
    if (!ev || ev.id !== "trapped" || !["follow", "wait"].includes(ev.st)) return;
    ev.st = "safe";
    this.ut.stats.rescued++;
    const r = rngOf(hashOf(this.ut.seed, "surv", ev.day)),
      kind = this.oddKind(ev.region, r),
      list = KINDS[kind].uncommon,
      bundle = this.resolveEntry(list[Math.floor(r() * list.length) % list.length], r);
    this.addReputation?.(5);
    this.receive(bundle);
    const text = "被困的人安全了：营地声望 +5，他把身上的" + itemsText(bundle) + "塞给你。";
    this.toast(text, "gold");
    if (this.o) this.olog(text, "gold");
    this.events.push({ type: "quest" });
    if (this.ux.surv?.o) this.objects = this.objects.filter((x) => x !== this.ux.surv.o);
    this.ux.surv = null;
    if (left || !this.joinable()) {
      if (this.joinable()) this.survivorJoin();
      else ev.st = "done";
      return;
    }
    this.placeSurvivorChoice();
  }
  joinable() {
    return !!this.o && !!this.addCrew && !this.crewFull?.() && !!this.nextSurvivor();
  }
  nextSurvivor() {
    return SURVIVORS.find((v) => !this.o?.crew?.some((c) => c.id === v.id)) || null;
  }
  placeSurvivorChoice() {
    const ev = this.ut.ev;
    if (!ev || ev.st !== "safe" || this.s.region !== ev.region) return;
    const x = REGIONS[ev.region].exit?.x ?? 95,
      y = REGIONS[ev.region].exit?.y ?? 523,
      q = this.freePoint(x + 90, y - 40);
    this.objects = this.objects.filter((o) => !["uJoin", "uSend"].includes(o.type));
    if (this.joinable()) this.objects.push({ type: "uJoin", name: "请他加入援建队", x: q.x, y: q.y, icon: 56, id: "usurvj:" + ev.day });
    this.objects.push({ type: "uSend", name: "给他指路回集市", x: q.x, y: q.y, icon: 56, id: "usurvs:" + ev.day });
  }
  survivorJoin() {
    const ev = this.ut.ev,
      v = this.nextSurvivor();
    if (!ev || !v || !this.joinable()) return this.survivorSend();
    ev.st = "done";
    this.objects = this.objects.filter((o) => !["uJoin", "uSend"].includes(o.type));
    const ok = this.addCrew({ id: v.id, name: v.name, trait: v.trait, role: v.role, look: v.look });
    const text = ok ? v.name + "加入了援建队，自己去农场的援建营地报到。" : "他想了想，还是回集市去了。";
    this.toast(text, "gold");
    if (this.o) this.olog(text, "gold");
    return ok;
  }
  survivorSend() {
    const ev = this.ut.ev;
    if (ev && ev.id === "trapped") ev.st = "done";
    this.objects = this.objects.filter((o) => !["uJoin", "uSend"].includes(o.type));
    this.toast("他谢过你，往集市的方向去了。");
    return true;
  }
  tickSurvivor(dt) {
    const ev = this.eventToday(this.s.region),
      S = this.ux.surv;
    this.ux.survNear = false;
    if (!ev || ev.id !== "trapped" || !S || ev.st !== "follow") return;
    const R = EVENT_RULES.trapped,
      p = this.s.player,
      o = S.o;
    S.held = Math.max(0, S.held - dt);
    S.hitCd = Math.max(0, S.hitCd - dt);
    const d = dist(o, p);
    if (S.held <= 0 && d > R.follow && d < R.keep * 2) {
      const a = Math.atan2(p.y - o.y, p.x - o.x),
        step = Math.min(R.speed * dt, d - R.follow);
      const e = { x: o.x, y: o.y };
      this.moveEntity(e, Math.cos(a) * step, Math.sin(a) * step, true);
      o.x = e.x;
      o.y = e.y;
      o.facing = a;
      o.moving = true;
    } else o.moving = false;
    // 他走路有声音，附近的感染者会过来
    S.noiseT -= dt;
    if (S.noiseT <= 0 && o.moving) {
      S.noiseT = 1;
      this.noise.push({ x: o.x, y: o.y, r: 120, t: 0.6 });
    }
    // 被抓住：掉血、停一下
    if (S.hitCd <= 0) {
      const z = this.enemies.find((z) => !z.dead && !z.lying && !z.nest && z.type !== "raider" && dist(z, o) < 40);
      if (z) {
        S.hitCd = R.hitCd;
        S.held = R.held;
        S.hp -= R.hit;
        this.effects.push({ x: o.x, y: o.y - 60, text: "被抓住了！", t: 0.8, color: "#f1a28a" });
        this.events.push({ type: "survivorHurt", x: o.x, y: o.y });
        if (S.hp <= 0) {
          ev.st = "dead";
          this.objects = this.objects.filter((x) => x !== o);
          this.ux.surv = null;
          this.toast("被困的人没能撑到出口……", "warn");
          if (this.o) this.olog("被困的人没能撑到出口。", "warn");
          return;
        }
        this.toast("被困的人被抓住了，还剩 " + Math.max(0, Math.round(S.hp)) + " 血！", "warn");
      }
    }
    const exit = REGIONS[this.s.region].exit || { x: 95, y: 523 };
    this.ux.survNear = d < 220 && dist(p, exit) < 220;
    if (dist(o, exit) < 120) this.survivorSafe(false);
  }
  // 空投
  tickDrop(dt) {
    const D = this.ux.drop,
      ev = this.eventToday(this.s.region);
    if (!D || !ev || ev.id !== "airdrop" || ev.st !== "fall") return;
    D.t -= dt;
    if (D.t > 0) return;
    this.ux.drop = null;
    ev.st = "landed";
    const R = EVENT_RULES.airdrop;
    this.noise.push({ x: D.x, y: D.y, r: R.noise, t: 3, distraction: true });
    for (const z of this.enemies)
      if (!z.dead && !z.lying && !z.nest && z.type !== "raider" && dist(z, D) < R.noise && z.state !== "chase") Object.assign(z, { state: "chase", alert: 6, targetX: D.x, targetY: D.y });
    this.particlesAt(D.x, D.y, "#d8c79a", 22);
    this.shake = Math.max(this.shake || 0, this.s.settings?.access?.calm ? 0 : 3);
    this.events.push({ type: "airdropLand", x: D.x, y: D.y });
    this.toast("空投箱落地了！附近的感染者都朝那边去了。", "warn");
    this.placeEvent(this.s.region);
  }
  // 搜索队
  updateParty(e, dt) {
    const p = this.s.player,
      d = dist(e, p);
    if (!e.uAlert) {
      e.cooldown = Math.max(0, (e.cooldown || 0) - dt);
      e.flash = Math.max(0, (e.flash || 0) - dt);
      if ((d < 300 && this.lineClear(e, p)) || e.hp < e.maxHp) {
        e.uAlert = true;
        e.state = "chase";
        this.effects.push({ x: e.x, y: e.y - 80, text: "发现你了！", t: 0.9, color: "#f1a28a" });
        this.tipOnce("party", "灰隼团的搜索队：打倒两个人能拿到弹药，还有他们袭击的计划。他们开枪会把感染者引过来。");
        return;
      }
      // 在原地附近翻找
      e.timer = (e.timer || 0) - dt;
      if (e.timer <= 0) {
        e.timer = 2 + Math.random() * 3;
        e.targetX = clamp(e.homeX + (Math.random() - 0.5) * 140, 80, WORLD.w - 80);
        e.targetY = clamp(e.homeY + (Math.random() - 0.5) * 100, 90, WORLD.h - 90);
      }
      const t = { x: e.targetX ?? e.x, y: e.targetY ?? e.y };
      if (dist(e, t) > 8) this.aiMove(e, t, ZOMBIES.raider.speed * 0.5, dt);
      return;
    }
    if (e.hp < e.maxHp * 0.35 || e.uFlee) {
      // 跑了：不算进灰隼团的袭击
      if (!e.uFlee) {
        e.uFlee = 6;
        this.effects.push({ x: e.x, y: e.y - 70, text: "撤退！", t: 0.9, color: "#e6c48a" });
      }
      e.uFlee -= dt;
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      this.aiMove(e, { x: clamp(e.x + Math.cos(a) * 200, 60, WORLD.w - 60), y: clamp(e.y + Math.sin(a) * 200, 70, WORLD.h - 70) }, ZOMBIES.raider.speed * 1.15, dt);
      if (e.uFlee <= 0) {
        e.dead = true;
        e.fled = true;
        this.partyCheck();
      }
      return;
    }
    return super.updateEnemy(e, dt);
  }
  partyCheck() {
    const ev = this.eventToday(this.s.region);
    if (!ev || ev.id !== "raiders" || ev.st === "done") return;
    const party = this.enemies.filter((z) => z.uParty);
    if (!party.length || party.some((z) => !z.dead)) return;
    ev.st = "done";
    const killed = party.filter((z) => !z.fled).length,
      R = EVENT_RULES.raiders;
    const ammo = Math.round((R.loot.ammo * killed) / party.length);
    if (ammo) this.receive({ ammo });
    if (killed === party.length && this.dy) {
      this.dy.flags.raidLess = Math.min(100, (this.dy.flags.raidLess || 0) + R.less);
      const text = "从搜索队身上翻出弹药 " + ammo + "，还有灰隼团的袭击计划：那一次少来 " + R.less + " 个人。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    } else this.toast(ammo ? "搜索队跑了一个，身上只翻出弹药 " + ammo + "。" : "搜索队跑了。", ammo ? "gold" : "warn");
  }

  // ================= 感染者：摆法和新种类 =================
  generateEnemies(id) {
    if (!this.ut || !this.gr || !RUINS.includes(id)) return super.generateEnemies(id);
    const ph = this.phase(),
      day = this.s.day,
      u = this.ut,
      r = rngOf(hashOf(u.seed, "lay", id, day)),
      k = Math.floor(r() * 3) % 3;
    u.gen[id] = { day, k };
    const packs = RUIN_PACKS[id],
      saved = packs[ph];
    packs[ph] = LAYOUTS[id][ph][k];
    let list;
    try {
      list = super.generateEnemies(id);
    } finally {
      packs[ph] = saved;
    }
    // 换掉同样只数的游荡者
    const slows = () => list.filter((z) => z.type === "slow" && !z.nightWander);
    const swap = (type, n) => {
      for (let i = 0; i < n; i++) {
        const pool = slows();
        if (!pool.length) return;
        const old = pickOf(pool, r),
          idx = list.indexOf(old);
        if (type === "faker") {
          const spot = this.decorSpots(id, day)[i % DECOR_CORPSES] || { x: old.x, y: old.y },
            q = this.freePoint(spot.x + 44, spot.y + 18);
          list[idx] = this.makeFaker(q.x, q.y);
        } else {
          const z = this.enemy(type, old.x, old.y);
          z.pack = old.pack;
          list[idx] = z;
        }
      }
    };
    for (const type of ["bloater", "faker", "spitter"]) {
      const P = PLACE[type];
      if (ph >= P.phase) swap(type, P[id] || 0);
    }
    return list;
  }
  makeFaker(x, y, extra = {}) {
    const z = this.enemy("faker", x, y);
    return Object.assign(z, { lying: true, state: "patrol", facing: Math.random() < 0.5 ? 0 : Math.PI, twitchT: 1 + Math.random() * 3, ...extra });
  }
  // 地上躺着的尸体：第 4 天起每张废墟 3 具（按这一批感染者刷出来的日子定，刷新前不变）
  decorSpots(id, day = this.ut?.gen?.[id]?.day ?? this.s.day) {
    const r = rngOf(hashOf(this.ut?.seed || 1, "decor", id, day)),
      spots = (DECOR_SPOTS[id] || []).slice();
    for (let i = spots.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [spots[i], spots[j]] = [spots[j], spots[i]];
    }
    return spots.slice(0, DECOR_CORPSES).map(([x, y], i) => ({ x, y, facing: r() < 0.5 ? 0 : Math.PI, type: i === 1 ? "runner" : "slow" }));
  }
  // 画面用：今天这张图上躺着的普通尸体（不会动、不会淡）
  decorCorpses() {
    const id = this.s.region;
    if (!this.ut || !RUINS.includes(id)) return [];
    const gen = this.ut.gen[id],
      ev = this.eventToday(id),
      key = id + ":" + (gen?.day ?? 0) + ":" + (ev?.id === "pile" ? ev.spot : "-") + ":" + this.phase();
    if (this.ux.decorKey === key) return this.ux.decor;
    const out = [];
    if (gen && this.phaseAt(gen.day) >= 1) for (const s of this.decorSpots(id, gen.day)) out.push({ ...this.freePoint(s.x, s.y), facing: s.facing, type: s.type, decor: true });
    if (ev?.id === "pile") {
      const at = this.eventSpot(ev),
        n = EVENT_RULES.pile.corpses;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        out.push({ x: Math.round(at.x + Math.cos(a) * 30), y: Math.round(at.y + 6 + Math.sin(a) * 16), facing: i % 2 ? 0 : Math.PI, type: i % 3 === 2 ? "runner" : "slow", decor: true, pile: true });
      }
    }
    this.ux.decorKey = key;
    this.ux.decor = out;
    return out;
  }
  // 夜里在外面游荡的：第 8 天起三成是夜行者
  nightWanderers(id, entering = true) {
    const before = this.enemies?.length || 0;
    super.nightWanderers(id, entering);
    if (!this.ut || !this.enemies || this.phase() < 2 || SAFE.includes(id)) return;
    const added = this.enemies.slice(before).filter((z) => z.nightWander && !z.dead),
      key = this.nightKey?.() || this.s.day,
      r = rngOf(hashOf(this.ut.seed, "stalk", id, key));
    for (let i = 0; i < added.length; i++) {
      if (r() >= NEW_RULES.stalker.share) continue;
      const old = added[i],
        z = this.enemy("stalker", old.x, old.y);
      Object.assign(z, { nightWander: true, reclaimed: old.reclaimed, pack: null });
      this.enemies[this.enemies.indexOf(old)] = z;
    }
  }

  // ================= 头目 =================
  spawnBoss(id) {
    const bid = this.bossFor(id),
      day = this.s.day;
    if (!bid || this.ut.boss[bid].last === day) return;
    if (this.enemies.some((z) => z.boss === bid && !z.dead)) return;
    const B = BOSSES[bid],
      q = this.freePoint(B.lair.x, B.lair.y),
      z = this.enemy(B.type, q.x, q.y);
    Object.assign(z, { boss: bid, bossDay: day, state: "patrol", homeX: q.x, homeY: q.y, sct: 6, pct: B.pulse?.every || 0, scd: 0, dcd: 2 });
    this.enemies.push(z);
    if (bid === "nurse")
      for (let i = 0; i < B.escorts; i++) {
        const a = (i / B.escorts) * Math.PI * 2,
          p = this.freePoint(q.x + Math.cos(a) * 70, q.y + Math.sin(a) * 46),
          e = this.enemy("slow", p.x, p.y);
        e.pack = id + ":nurse";
        e.escort = true;
        this.enemies.push(e);
      }
  }
  dropStaleBosses(id) {
    const day = this.s.day,
      p = this.s.player,
      stale = (z) => z.boss && z.bossDay !== day && !z.dead && !(z.state === "chase" && dist(z, p) < 700);
    if (this.enemies.some(stale)) this.enemies = this.s.enemies[id] = this.enemies.filter((z) => !stale(z));
  }
  // 仓库守卫第 4 天起才加强（和头目同一天开始）；前三天和以前一样
  isGuard(e) {
    return e?.type === "elite" && this.s.region === "warehouse" && !e.annexGuardian && !e.horde && !e.districtBattle && !e.nest && (this.phase?.() ?? 1) >= 1;
  }
  bossKind(e) {
    if (!e) return null;
    if (e.boss) return e.boss;
    return this.isGuard(e) ? "guard" : null;
  }
  // 头目血条：在打的那一个
  bossBar() {
    if (!this.ut || !RUINS.includes(this.s.region)) return null;
    const p = this.s.player;
    const z = this.enemies.find((z) => !z.dead && this.bossKind(z) && (dist(z, p) < 560 || (z.state === "chase" && dist(z, p) < 900)));
    if (!z) return null;
    const kind = this.bossKind(z),
      B = BOSSES[kind];
    let tag = "",
      note = "";
    if (kind === "brute" && z.rage) tag = "发狂";
    if (kind === "guard") tag = z.g2 ? "甲掉了 · 会连续冲撞" : "正面有甲 · 绕到背后";
    if (kind === "nurse" && this.ut.intel.nurse) note = z.act?.kind === "scream" ? "她在吸气——打她一下" : "下一声尖叫 " + Math.max(0, Math.ceil(z.sct || 0)) + " 秒";
    if (kind === "brute" && this.ut.intel.brute && z.act?.kind === "door") note = "要扔车门了";
    return { kind, name: B.name, hp: Math.max(0, z.hp), max: z.maxHp, tag, note };
  }
  bossDown(kind, e) {
    const B = BOSSES[kind],
      rec = this.ut.boss[kind],
      first = !rec.wins,
      day = this.s.day;
    rec.wins++;
    rec.last = day;
    if (first) rec.first = day;
    this.ut.stats.bossWins++;
    const bundle = {};
    for (const [id, n] of Object.entries(B.reward)) bundle[id] = n * (first ? 2 : 1);
    if (B.bonus) {
      if (!this.knows?.(B.bonus.bp)) bundle[B.bonus.bp] = 1;
      if (first || this.knows?.(B.bonus.bp)) bundle[B.bonus.else] = (bundle[B.bonus.else] || 0) + 1;
    }
    if (first && B.trophy) bundle[B.trophy] = 1;
    this.receive(bundle);
    const text = "打赢了" + B.name + (first ? "（第一次，奖励翻倍）" : "") + "：" + itemsText(bundle) + (first && B.trophy ? "。战利品可以捐给档案馆" : "");
    this.toast(text, "gold");
    if (this.o) this.olog(text, "gold");
    this.events.push({ type: "bossDown", x: e.x, y: e.y, boss: kind });
    this.xp?.("combat", first ? 20 : 8);
  }
  bossIntro(z) {
    const kind = this.bossKind(z);
    if (!kind || this.ux.intro.has(z.id)) return;
    this.ux.intro.add(z.id);
    this.events.push({ type: "bossIntro", x: z.x, y: z.y, boss: kind });
    const tips = {
      brute: "大块头：地上一圈红是要砸地，跑出圈或者滚出去；地上一条线是要扔车门；绕到背后打（背后伤害 ×1.5）。",
      nurse: "护士长：她吸气要尖叫时打她一下就能打断；绿色的一圈会给身边的感染者回血，先把它们引开。",
      guard: "仓库守卫：正面有甲，绕到背后打（按 T 用枪打装甲照旧）。血过半或装甲掉了以后它会连续冲撞——引它撞货架。它守着自己的箱子，你走远了它就回去。",
    };
    this.tipOnce("boss:" + kind, tips[kind]);
  }

  // ================= 感染者每帧 =================
  updateEnemy(e, dt) {
    if (!this.ut || !this.gr || !e || e.dead) return super.updateEnemy(e, dt);
    if (e.uParty) return this.updateParty(e, dt);
    if (e.nest || e.type === "raider") return super.updateEnemy(e, dt);
    const kind = this.bossKind(e);
    if (kind && !this.ux.intro.has(e.id) && (dist(e, this.s.player) < 520 || e.state === "chase")) this.bossIntro(e);
    if (e.type === "faker") return this.updateFaker(e, dt);
    if (e.type === "spitter") return this.updateSpitter(e, dt);
    if (e.type === "stalker") return this.updateStalker(e, dt);
    if (e.type === "brute") return this.updateBrute(e, dt);
    if (e.type === "nurse") return this.updateNurse(e, dt);
    if (kind === "guard") return this.updateGuard(e, dt);
    return super.updateEnemy(e, dt);
  }
  // 自己写的几种：先走一遍原来的“挨打、流血、夹住、晕住”
  aiPre(e, dt, boss = false) {
    e.cooldown = Math.max(0, (e.cooldown || 0) - dt);
    e.flash = Math.max(0, (e.flash || 0) - dt);
    e.alert = Math.max(0, (e.alert || 0) - dt);
    e.slowT = Math.max(0, (e.slowT || 0) - dt);
    e.trapHeld = Math.max(0, (e.trapHeld || 0) - dt);
    if (e.bleedT > 0) {
      e.bleedT -= dt;
      this.dotHurt(e, 3 * dt);
      if (e.dead) return true;
    }
    if (boss) {
      e.stagger = 0;
      e.stunT = 0;
      return false;
    }
    e.stagger = Math.max(0, (e.stagger || 0) - dt);
    e.stunT = Math.max(0, (e.stunT || 0) - dt);
    if (this.gx.grab?.z === e) {
      e.facing = Math.atan2(this.s.player.y - e.y, this.s.player.x - e.x);
      return true;
    }
    if (e.stagger > 0 || e.stunT > 0 || e.trapHeld > 0) {
      e.windup = 0;
      if (e.spit) e.spit = null;
      if (e.dash?.phase === "wind") e.dash = null;
      return true;
    }
    return false;
  }
  aiSense(e, dt) {
    const sensed = this.enemySenses(e, dt);
    if (sensed) {
      e.state = "chase";
      e.alert = 8;
      e.targetX = sensed.x;
      e.targetY = sensed.y;
    }
    if (e.state === "chase" && e.alert <= 0) e.state = "patrol";
    return sensed;
  }
  aiMove(e, target, speed, dt) {
    e.pathTimer = (e.pathTimer || 0) - dt;
    const key = Math.round(target.x / 20) + "," + Math.round(target.y / 20);
    if (e.pathTimer <= 0 || !e.path?.length || e.goalKey !== key) {
      e.path = this.pathTo(e, target);
      e.pathTimer = 0.7;
      e.goalKey = key;
    }
    if (e.path[0] && dist(e, e.path[0]) < 18) e.path.shift();
    const next = this.lineClear(e, target) ? target : e.path[0];
    if (!next || dist(e, next) < 2) return false;
    const a = Math.atan2(next.y - e.y, next.x - e.x);
    e.facing = a;
    this.moveEntity(e, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt, true);
    return true;
  }
  aiWander(e, dt) {
    e.timer = (e.timer || 0) - dt;
    if (e.timer <= 0) {
      e.facing = Math.random() * 6.28;
      e.targetX = clamp((e.homeX ?? e.x) + Math.cos(e.facing) * 110, 75, WORLD.w - 75);
      e.targetY = clamp((e.homeY ?? e.y) + Math.sin(e.facing) * 100, 75, WORLD.h - 75);
      e.timer = 3 + Math.random() * 4;
    }
    this.aiMove(e, { x: e.targetX ?? e.x, y: e.targetY ?? e.y }, this.enemySpeed(e) * 0.5, dt);
  }
  // 近身一下：预兆 → 出手
  aiMelee(e, dt, M) {
    const p = this.s.player,
      d = dist(e, p);
    if (e.windup > 0) {
      e.windup -= dt;
      if (e.windup <= 0) {
        if (d < M.range + 12 && this.invulnerable <= 0) this.damagePlayer(0, { eff: this.zDamage(e, M.damage), from: e });
        e.cooldown = M.cd;
      }
      return true;
    }
    if (e.state === "chase" && d < M.range && e.cooldown <= 0) {
      e.windup = M.warn;
      e.facing = Math.atan2(p.y - e.y, p.x - e.x);
      this.emitAt("windup", e);
      return true;
    }
    return false;
  }
  // 头目慢慢转过来对着你（绕到背后要趁它转身之前）
  aiTurn(e, dt, rate) {
    const p = this.s.player,
      want = Math.atan2(p.y - e.y, p.x - e.x),
      cur = e.facing ?? want,
      diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)),
      step = rate * dt;
    e.facing = Math.abs(diff) <= step ? want : cur + Math.sign(diff) * step;
  }
  zDamage(e, fallback) {
    const st = this.zstat(e.type, e.ph ?? this.phase());
    return st?.damage ?? fallback;
  }

  // ---------- 装死者 ----------
  updateFaker(e, dt) {
    if (!e.lying) {
      if (e.rise > 0) {
        e.rise -= dt;
        e.flash = Math.max(0, (e.flash || 0) - dt);
        return;
      }
      return super.updateEnemy(e, dt);
    }
    const R = NEW_RULES.faker,
      p = this.s.player,
      d = dist(e, p);
    e.flash = Math.max(0, (e.flash || 0) - dt);
    e.twitchT = (e.twitchT ?? 2) - dt;
    if (e.twitchT <= 0) {
      e.twitchT = 2.5 + Math.random() * 2;
      e.twitch = 0.5;
      if (d < 260) this.emitAt("breath", e);
    }
    if (e.twitch > 0) e.twitch = Math.max(0, e.twitch - dt);
    // 走到 50 以内：抓脚踝
    if (d < R.reach && this.invulnerable <= 0 && !this.gx.grab && !(this.gx.down > 0) && !this.fx.roll && !this.paused) {
      e.lying = false;
      e.state = "chase";
      e.alert = 8;
      e.targetX = p.x;
      e.targetY = p.y;
      e.facing = Math.atan2(p.y - e.y, p.x - e.x);
      this.ut.stats.fakerGrabs++;
      this.emitAt("fakerGrab", e);
      this.startGrab(e);
      const g = this.gx.grab;
      if (g) g.t = g.max = R.grab * (this.hasTalent?.("toughBone") ? RULES.grab.toughBone : 1);
      this.tipOnce("faker", "装死者！地上的尸体有的会抓脚：路过前先打一下，或走近按 " + this.keyName("interact", "E") + " 踩一脚；带着麦穗它会冲装死的叫。");
    }
  }
  // 被抓住以后：装死者咬腿或脚
  biteFrom(z, parts, extra = {}) {
    if (z?.type === "faker" && parts === GRAB_BITE_PARTS) parts = CRAWL_BITE_PARTS;
    return super.biteFrom(z, parts, extra);
  }
  releaseGrab(escaped) {
    const z = this.gx.grab?.z;
    const out = super.releaseGrab(escaped);
    if (z?.type === "faker" && !z.dead) {
      z.rise = 0.6;
      z.lying = false;
    }
    return out;
  }
  nearestCrawler(max = 46) {
    const c = super.nearestCrawler(max);
    if (c || !this.ut || this._uNoLying) return c;
    const p = this.s.player;
    return (
      this.enemies
        .filter((z) => z.lying && !z.dead && dist(z, p) < Math.max(max, 72))
        .sort((a, b) => dist(a, p) - dist(b, p))[0] || null
    );
  }

  // ---------- 吐酸者 ----------
  updateSpitter(e, dt) {
    if (this.aiPre(e, dt)) return;
    const R = NEW_RULES.spitter,
      p = this.s.player;
    e.scd = Math.max(0, (e.scd ?? 1.5) - dt);
    if (e.spit) {
      e.spit.t -= dt;
      e.facing = Math.atan2(e.spit.y - e.y, e.spit.x - e.x);
      if (e.spit.t <= 0) {
        this.ux.acid.push({ x0: e.x, y0: e.y - 34, x: e.spit.x, y: e.spit.y, t: 0, fly: R.fly });
        this.emitAt("spit", e);
        this.ut.stats.spits++;
        e.spit = null;
        e.scd = R.cd;
      }
      return;
    }
    this.aiSense(e, dt);
    if (this.aiMelee(e, dt, { range: 43, warn: 0.65, damage: ZOMBIES.spitter.damage, cd: 1.2 })) return;
    if (e.state !== "chase") return this.aiWander(e, dt);
    const d = dist(e, p),
      sees = d < R.sight && this.lineClear(e, p);
    if (sees && e.scd <= 0 && d > 70) {
      e.spit = { t: R.warn, x: p.x, y: p.y };
      e.facing = Math.atan2(p.y - e.y, p.x - e.x);
      this.emitAt("spitCue", e);
      this.tipOnce("spitter", "吐酸者仰头时，地上那一圈就是酸液要落的地方：翻滚躲开，贴上去打（它血少）。");
      return;
    }
    const sp = this.enemySpeed(e);
    if (sees && d < R.near && d > 60) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      this.aiMove(e, { x: clamp(e.x + Math.cos(a) * 90, 70, WORLD.w - 70), y: clamp(e.y + Math.sin(a) * 90, 80, WORLD.h - 80) }, sp, dt);
      e.facing = Math.atan2(p.y - e.y, p.x - e.x);
    } else if (sees && d <= R.far) {
      const a = Math.atan2(e.y - p.y, e.x - p.x) + (e.id % 2 ? 1.2 : -1.2) * 0.4;
      this.aiMove(e, { x: p.x + Math.cos(a) * d, y: p.y + Math.sin(a) * d }, sp * 0.5, dt);
      e.facing = Math.atan2(p.y - e.y, p.x - e.x);
    } else this.aiMove(e, { x: e.targetX ?? p.x, y: e.targetY ?? p.y }, sp, dt);
  }
  tickAcid(dt) {
    const ux = this.ux,
      R = NEW_RULES.spitter.puddle;
    for (const a of ux.acid) {
      a.t += dt;
      if (a.t >= a.fly) {
        ux.puddles.push({ x: a.x, y: a.y, r: R.r, t: R.time, max: R.time });
        this.events.push({ type: "acid", x: a.x, y: a.y });
        this.particlesAt(a.x, a.y, "#9fd36a", 8);
      }
    }
    ux.acid = ux.acid.filter((a) => a.t < a.fly);
    for (const q of ux.puddles) q.t -= dt;
    ux.puddles = ux.puddles.filter((q) => q.t > 0);
  }

  // ---------- 夜行者 ----------
  stalkerLit(e) {
    const p = this.s.player;
    if (!this.playerLit?.()) return false;
    const d = dist(e, p);
    if (d > NEW_RULES.stalker.light) return false;
    return angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.facing ?? 0) < NEW_RULES.stalker.lightArc;
  }
  nearFire(e) {
    return (this.gx.fires || []).some((f) => f.region === this.s.region && dist(f, e) < f.r + 70);
  }
  updateStalker(e, dt) {
    if (this.aiPre(e, dt)) return;
    const R = NEW_RULES.stalker,
      p = this.s.player,
      d = dist(e, p),
      sp = this.enemySpeed(e);
    e.dcd = Math.max(0, (e.dcd || 0) - dt);
    e.clickT = (e.clickT ?? 1) - dt;
    // 冲过来那一下
    if (e.dash) {
      const D = e.dash;
      D.t -= dt;
      if (D.phase === "wind") {
        e.facing = Math.atan2(p.y - e.y, p.x - e.x);
        // 你转过身对着它：缩回去
        if (angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.facing ?? 0) < 1.0 || this.stalkerLit(e)) {
          e.dash = null;
          e.flee = 1;
          e.dcd = 1;
          return;
        }
        if (D.t <= 0) Object.assign(D, { phase: "run", t: Math.min(0.8, (d + 40) / R.dash), a: Math.atan2(p.y - e.y, p.x - e.x) });
        return;
      }
      const step = R.dash * dt;
      this.moveEntity(e, Math.cos(D.a) * step, Math.sin(D.a) * step, true);
      e.facing = D.a;
      if (!D.hit && dist(e, p) < 38 && this.invulnerable <= 0) {
        D.hit = true;
        this.damagePlayer(0, { eff: this.zDamage(e, R.damage), from: e });
      }
      if (D.t <= 0 || D.hit) {
        e.dash = null;
        e.dcd = R.cd;
        e.flee = 0.8;
      }
      return;
    }
    // 被灯照着、靠近火：退开
    if (this.stalkerLit(e) || this.nearFire(e)) {
      if (!(e.flee > 0)) this.effects.push({ x: e.x, y: e.y - 60, text: "退开了", t: 0.6, color: "#bfe6a8" });
      e.flee = R.flee;
    }
    if (e.flee > 0) {
      e.flee -= dt;
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      this.aiMove(e, { x: clamp(e.x + Math.cos(a) * 160, 70, WORLD.w - 70), y: clamp(e.y + Math.sin(a) * 160, 80, WORLD.h - 80) }, sp, dt);
      return;
    }
    // 看见你：比别的感染者看得远（320），听得见
    if (d < 320 && this.lineClear(e, p)) {
      e.state = "chase";
      e.alert = 8;
      e.targetX = p.x;
      e.targetY = p.y;
    } else this.aiSense(e, dt);
    if (e.state !== "chase") return this.aiWander(e, dt);
    if (e.prowl && d > 600) return this.aiWander(e, dt);
    if (e.clickT <= 0 && d < 300) {
      e.clickT = 1.6 + Math.random();
      this.emitAt("click", e);
      this.tipOnce("stalker", "夜行者只从背后下手：用手电或头灯对着它，它会退；背靠墙站、靠着火都行。");
    }
    const behind = angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.facing ?? 0) > R.behind;
    if (behind && d < R.ring[1] && e.dcd <= 0 && this.lineClear(e, p) && !this.gx.grab) {
      e.dash = { phase: "wind", t: R.warn };
      this.emitAt("stalkerCue", e);
      return;
    }
    // 绕到你背后：落在离你 160–230 的一圈上
    const back = (p.facing ?? 0) + Math.PI,
      side = Math.atan2(e.y - p.y, e.x - p.x),
      diff = Math.atan2(Math.sin(back - side), Math.cos(back - side)),
      a = side + clamp(diff, -0.7, 0.7),
      ring = (R.ring[0] + R.ring[1]) / 2;
    const goal = { x: clamp(p.x + Math.cos(a) * ring, 70, WORLD.w - 70), y: clamp(p.y + Math.sin(a) * ring, 80, WORLD.h - 80) };
    this.aiMove(e, goal, sp, dt);
  }

  // ---------- 大块头 ----------
  updateBrute(e, dt) {
    if (this.aiPre(e, dt, true)) return;
    const B = BOSSES.brute,
      p = this.s.player,
      d = dist(e, p),
      intel = !!this.ut.intel.brute;
    e.scd = Math.max(0, (e.scd || 0) - dt);
    e.dcd = Math.max(0, (e.dcd || 0) - dt);
    if (!e.rage && e.hp < e.maxHp * B.rage) {
      e.rage = true;
      this.effects.push({ x: e.x, y: e.y - 110, text: "发狂了！", t: 1.2, color: "#ff8a6a" });
      this.toast("大块头发狂了：更快，砸得更勤。", "warn");
      this.events.push({ type: "bossRage", x: e.x, y: e.y, boss: "brute" });
    }
    if (e.act) {
      const A = e.act;
      A.t -= dt;
      if (A.kind === "slam" && A.t <= 0) {
        e.act = { kind: "recover", t: 0.6 };
        e.scd = e.rage ? B.slam.cdRage : B.slam.cd;
        this.noise.push({ x: e.x, y: e.y, r: 320, t: 1 });
        this.particlesAt(e.x, e.y, "#a99a7a", 20);
        if (!this.s.settings?.access?.calm) this.shake = Math.max(this.shake || 0, 6);
        this.events.push({ type: "slam", x: e.x, y: e.y });
        if (dist(e, p) < B.slam.r && this.invulnerable <= 0) this.damagePlayer(0, { eff: B.slam.damage, from: e, down: B.slam.down, noBleed: true });
      } else if (A.kind === "door" && A.t <= 0) {
        e.act = { kind: "recover", t: 0.5 };
        e.dcd = e.rage ? B.door.cdRage : B.door.cd;
        this.ux.doors.push({ x: e.x + Math.cos(A.a) * 30, y: e.y - 10 + Math.sin(A.a) * 30, a: A.a, left: B.door.len, from: e, spin: 0 });
        this.events.push({ type: "doorThrow", x: e.x, y: e.y });
      } else if (A.kind === "melee" && A.t <= 0) {
        e.act = { kind: "recover", t: 0.3 };
        e.cooldown = B.melee.cd;
        if (dist(e, p) < B.melee.range + 14 && this.invulnerable <= 0) this.damagePlayer(0, { eff: B.melee.damage, from: e });
      } else if (A.kind === "recover" && A.t <= 0) e.act = null;
      return;
    }
    if (d < 560 && (this.lineClear(e, p) || d < 300)) {
      e.state = "chase";
      e.alert = 8;
    } else if (e.state === "chase" && d > 900) e.state = "patrol";
    if (e.state !== "chase") {
      e.facing = e.facing ?? Math.PI / 2;
      if (dist(e, { x: e.homeX, y: e.homeY }) > 40) this.aiMove(e, { x: e.homeX, y: e.homeY }, this.enemySpeed(e) * 0.6, dt);
      return;
    }
    if (d < B.slam.near && e.scd <= 0) {
      e.act = { kind: "slam", t: B.slam.warn, max: B.slam.warn };
      e.facing = Math.atan2(p.y - e.y, p.x - e.x);
      this.events.push({ type: "slamCue", x: e.x, y: e.y, z: "brute", id: e.id });
      return;
    }
    if (d > B.door.min && d < B.door.max && e.dcd <= 0 && this.lineClear(e, p)) {
      const warn = B.door.warn + (intel ? 0.4 : 0);
      e.act = { kind: "door", t: warn, max: warn, a: Math.atan2(p.y - e.y, p.x - e.x) };
      e.facing = e.act.a;
      this.events.push({ type: "doorCue", x: e.x, y: e.y, z: "brute", id: e.id });
      return;
    }
    if (d < B.melee.range && e.cooldown <= 0) {
      e.act = { kind: "melee", t: B.melee.warn, max: B.melee.warn };
      e.facing = Math.atan2(p.y - e.y, p.x - e.x);
      this.emitAt("windup", e);
      return;
    }
    if (e.trapHeld > 0) return this.aiTurn(e, dt, B.turn);
    const moved = d > 50 && this.aiMove(e, p, this.enemySpeed(e) * (e.rage ? B.rageSpeed : 1), dt);
    if (!moved) this.aiTurn(e, dt, B.turn * (e.rage ? 1.3 : 1));
    if (moved) {
      e.stepT = (e.stepT || 0) - dt;
      if (e.stepT <= 0) {
        e.stepT = e.rage ? 0.42 : 0.56;
        this.events.push({ type: "bruteStep", x: e.x, y: e.y, z: "brute", id: e.id });
        if (!this.s.settings?.access?.calm && d < 260) this.shake = Math.max(this.shake || 0, 1);
      }
    }
  }
  tickDoors(dt) {
    const ux = this.ux,
      B = BOSSES.brute.door,
      p = this.s.player;
    for (const D of ux.doors) {
      if (D.left <= 0) {
        D.rest = (D.rest ?? 2.5) - dt;
        continue;
      }
      const step = Math.min(D.left, B.speed * dt),
        n = Math.max(1, Math.ceil(step / 10));
      D.spin += dt * 14;
      for (let i = 0; i < n; i++) {
        const nx = D.x + Math.cos(D.a) * (step / n),
          ny = D.y + Math.sin(D.a) * (step / n);
        if (this.blocked(nx, ny + 10, true, 6)) {
          D.left = 0;
          this.particlesAt(D.x, D.y, "#a7a198", 10);
          this.events.push({ type: "doorHit", x: D.x, y: D.y });
          break;
        }
        D.x = nx;
        D.y = ny;
        if (!D.hit && Math.hypot(p.x - D.x, p.y - 18 - D.y) < B.width / 2 + 14 && this.invulnerable <= 0) {
          D.hit = true;
          this.damagePlayer(0, { eff: B.damage, from: D.from, down: B.down, noBleed: true });
          D.left = 0;
          this.events.push({ type: "doorHit", x: D.x, y: D.y });
          break;
        }
      }
      if (D.left > 0) D.left -= step;
    }
    ux.doors = ux.doors.filter((D) => D.left > 0 || D.rest > 0);
  }

  // ---------- 护士长 ----------
  updateNurse(e, dt) {
    if (this.aiPre(e, dt, true)) return;
    const B = BOSSES.nurse,
      p = this.s.player,
      d = dist(e, p);
    if (d < 520 && (this.lineClear(e, p) || d < 260)) {
      e.state = "chase";
      e.alert = 8;
    } else if (e.state === "chase" && d > 900) e.state = "patrol";
    if (e.state === "chase") {
      e.sct = (e.sct ?? 6) - dt;
      e.pct = (e.pct ?? B.pulse.every) - dt;
    }
    if (e.act) {
      const A = e.act;
      A.t -= dt;
      if (A.kind === "scream" && A.t <= 0) {
        e.act = { kind: "recover", t: 0.6 };
        e.sct = B.scream.every;
        this.nurseSummon(e);
      } else if (A.kind === "pulse" && A.t <= 0) {
        e.act = { kind: "recover", t: 0.4 };
        e.pct = B.pulse.every;
        let healed = 0;
        if (e.hp < e.maxHp) {
          e.hp = Math.min(e.maxHp, e.hp + B.pulse.self);
          this.effects.push({ x: e.x, y: e.y - 80, text: "+" + B.pulse.self, t: 0.7, color: "#9fe08a" });
        }
        for (const z of this.enemies)
          if (z !== e && !z.dead && !z.nest && !z.lying && z.type !== "raider" && dist(z, e) < B.pulse.r && z.hp < z.maxHp) {
            z.hp = Math.min(z.maxHp, z.hp + B.pulse.heal);
            healed++;
            this.effects.push({ x: z.x, y: z.y - 50, text: "+" + B.pulse.heal, t: 0.7, color: "#9fe08a" });
          }
        this.ux.flashes.push({ x: e.x, y: e.y, t: 0.7, max: 0.7, tier: "pulse", r: B.pulse.r });
        this.events.push({ type: "pulse", x: e.x, y: e.y, healed });
      } else if (A.kind === "melee" && A.t <= 0) {
        e.act = { kind: "recover", t: 0.3 };
        e.cooldown = B.melee.cd;
        if (dist(e, p) < B.melee.range + 14 && this.invulnerable <= 0) this.damagePlayer(0, { eff: B.melee.damage, from: e });
      } else if (A.kind === "recover" && A.t <= 0) e.act = null;
      return;
    }
    if (e.state !== "chase") {
      if (dist(e, { x: e.homeX, y: e.homeY }) > 40) this.aiMove(e, { x: e.homeX, y: e.homeY }, this.enemySpeed(e) * 0.6, dt);
      return;
    }
    if (e.sct <= 0) {
      const warn = B.scream.warn;
      e.act = { kind: "scream", t: warn, max: warn };
      this.events.push({ type: "nurseCue", x: e.x, y: e.y, z: "nurse", id: e.id });
      return;
    }
    if (e.pct <= 0 && (e.hp < e.maxHp || this.enemies.some((z) => z !== e && !z.dead && !z.lying && z.type !== "raider" && dist(z, e) < B.pulse.r && z.hp < z.maxHp))) {
      e.act = { kind: "pulse", t: B.pulse.warn, max: B.pulse.warn };
      this.events.push({ type: "pulseCue", x: e.x, y: e.y, z: "nurse", id: e.id });
      return;
    }
    if (d < B.melee.range && e.cooldown <= 0) {
      e.act = { kind: "melee", t: B.melee.warn, max: B.melee.warn };
      e.facing = Math.atan2(p.y - e.y, p.x - e.x);
      this.emitAt("windup", e);
      return;
    }
    if (e.trapHeld > 0) return;
    // 身边还有自己人：躲在它们后面
    const guards = this.enemies.some((z) => z !== e && !z.dead && !z.lying && (z.escort || z.summoned) && dist(z, e) < 260);
    if (guards && d < B.keep) {
      const a = Math.atan2(e.y - p.y, e.x - p.x);
      this.aiMove(e, { x: clamp(e.x + Math.cos(a) * 80, 70, WORLD.w - 70), y: clamp(e.y + Math.sin(a) * 80, 80, WORLD.h - 80) }, this.enemySpeed(e), dt);
      e.facing = Math.atan2(p.y - e.y, p.x - e.x);
    } else if (!guards && d > 40) this.aiMove(e, p, this.enemySpeed(e), dt);
    else if (guards && d > B.keep + 60) this.aiMove(e, p, this.enemySpeed(e) * 0.6, dt);
  }
  nurseSummon(e) {
    const n = BOSSES.nurse.scream.summon,
      alive = this.enemies.filter((z) => z.summoned && !z.dead).length;
    let made = 0;
    for (let k = 0; k < n && alive + made < 8; k++) {
      const a = Math.random() * Math.PI * 2,
        q = this.freePoint(clamp(e.x + Math.cos(a) * 460, 80, WORLD.w - 80), clamp(e.y + Math.sin(a) * 320, 90, WORLD.h - 90));
      if (this.blocked(q.x, q.y, true, 16)) continue;
      const z = this.enemy("slow", q.x, q.y);
      Object.assign(z, { state: "chase", alert: 8, targetX: e.x, targetY: e.y, summoned: true, pack: e.pack || null });
      this.enemies.push(z);
      made++;
    }
    this.noise.push({ x: e.x, y: e.y, r: 700, t: 3 });
    this.events.push({ type: "nurseScream", x: e.x, y: e.y, made });
    if (made) {
      this.gr.stats.summons += made;
      this.toast("护士长一声尖叫，又引来了 " + made + " 只感染者", "warn");
    }
  }

  // ---------- 仓库守卫（加强） ----------
  updateGuard(e, dt) {
    const G = BOSSES.guard;
    if (!e.g2 && (e.hp <= e.maxHp * G.rage || e.parts?.armor === 0)) {
      e.g2 = true;
      if (e.parts) e.parts.armor = 0;
      this.effects.push({ x: e.x, y: e.y - 120, text: "甲掉了！", t: 1.2, color: "#ffdb8c" });
      this.particlesAt(e.x, e.y - 30, "#b9b4a2", 16);
      this.toast("守卫身上的甲掉了——它要开始横冲直撞了：引它去撞货架。", "warn");
      this.events.push({ type: "armorOff", x: e.x, y: e.y });
    }
    // 守着自己的箱子：追出去太远、你也走远了，就回去守着（不跟着你去别的地方打群架）
    const L = G.leash,
      home = { x: e.homeX ?? e.x, y: e.homeY ?? e.y },
      pd = dist(this.s.player, home);
    if (L && !e.charge && !(e.windup > 0)) {
      if (!e.homing && e.state === "chase" && dist(e, home) > L.max && pd > L.max) {
        e.homing = true;
        this.effects.push({ x: e.x, y: e.y - 110, text: "回去守着了", t: 1.2, color: "#cfc6a8" });
      }
      if (e.homing) {
        if (pd < L.back || dist(e, home) < 60) {
          e.homing = false;
          if (dist(e, home) < 60) Object.assign(e, { state: "patrol", alert: 0, timer: 0 });
        } else {
          Object.assign(e, { state: "patrol", alert: 0, targetX: home.x, targetY: home.y });
          e.cooldown = Math.max(0, (e.cooldown || 0) - dt);
          e.flash = Math.max(0, (e.flash || 0) - dt);
          this.aiMove(e, home, this.enemySpeed(e), dt);
          return;
        }
      }
    }
    if (e.g2 && this.gr && !this.gx.grab) {
      const keep = RULES.charge;
      RULES.charge = G.charge;
      let busy = false;
      try {
        busy = !(e.stagger > 0) && !(e.stunT > 0) && !(e.trapHeld > 0) && this.updateCharge(e, dt);
      } finally {
        RULES.charge = keep;
      }
      if (busy) return;
    }
    const out = super.updateEnemy(e, dt);
    if (!e.dead && e.state === "chase" && !e.charge && !(e.windup > 0) && !(e.stagger > 0) && !(e.stunT > 0) && dist(e, this.s.player) < 220) this.aiTurn(e, dt, G.turn);
    return out;
  }

  // ================= 打中、打死 =================
  hurtEnemy(e, damage, angle, meta = {}) {
    if (!this.ut || !this.gr || !e || e.dead || e.nest) return super.hurtEnemy(e, damage, angle, meta);
    const h = this._hit || (meta?.id ? this.shotInfo?.(meta) : null),
      front = angDiff(angle + Math.PI, e.facing ?? 0) < 1.1;
    let n = damage;
    const wasLying = !!e.lying;
    if (wasLying) n *= 1.5;
    if (e.type === "brute") n *= front ? BOSSES.brute.front : BOSSES.brute.back;
    if (this.isGuard(e)) {
      const aimed = meta?.aimPart && meta.aimPart !== "core" && e.parts?.[meta.aimPart] > 0,
        G = BOSSES.guard;
      // 原来的规则正面背面都按 0.45 算；这里改成正面只剩两成、背后打得动；甲掉了以后原来按 1.35，这里收一点
      if (!aimed && !e.g2 && (e.parts?.armor ?? 1) > 0) n *= (front ? G.front : G.back) / 0.45;
      else if (!aimed && (e.g2 || e.parts?.armor === 0)) n *= G.bare;
    }
    if (e.spit && h && h.kind !== "dot" && ((h.knock || 0) >= RULES.knockInterrupt || h.interrupt)) {
      e.spit = null;
      e.scd = 1.5;
      this.gr.stats.interrupts++;
      this.effects.push({ x: e.x, y: e.y - 70, text: "打断！", t: 0.7, color: "#ffdb8c" });
    }
    if (e.type === "nurse" && e.act?.kind === "scream" && h?.kind !== "dot") {
      e.act = { kind: "recover", t: 0.5 };
      e.sct = 10;
      this.gr.stats.interrupts++;
      this.effects.push({ x: e.x, y: e.y - 90, text: "打断！", t: 0.8, color: "#ffdb8c" });
      this.events.push({ type: "interrupt", x: e.x, y: e.y });
    }
    const alive = !e.dead,
      pos = this.bossKind(e) && e.type !== "elite" ? { x: e.x, y: e.y } : null,
      guard = this.isGuard(e),
      wind = guard ? e.windup : 0;
    // 仓库守卫出手打不断（只有弹弓、石头能打断它跺脚）
    if (guard && wind > 0) e.windup = 0;
    this._uKill = true;
    try {
      super.hurtEnemy(e, n, angle, meta);
    } finally {
      this._uKill = false;
      if (guard && wind > 0 && !e.dead) e.windup = wind;
    }
    if (pos && !e.dead) {
      // 头目不会被一下打退
      e.x = pos.x;
      e.y = pos.y;
    }
    if (wasLying && !e.dead && e.lying) {
      e.lying = false;
      e.state = "chase";
      e.alert = 8;
      e.stagger = Math.max(e.stagger || 0, 0.6);
      this.effects.push({ x: e.x, y: e.y - 50, text: "是装死的！", t: 0.9, color: "#e6c48a" });
    }
    if (e.uParty && !e.uAlert) e.uAlert = true;
    if (alive && e.dead) this.afterKill(e);
  }
  meleeHit(z, w, id, a) {
    if (!this.bossKind(z) || z.type === "elite") return super.meleeHit(z, w, id, a);
    const x = z.x,
      y = z.y;
    super.meleeHit(z, w, id, a);
    if (!z.dead) {
      z.x = x;
      z.y = y;
    }
  }
  shove() {
    const bosses = this.enemies.filter((z) => !z.dead && (z.boss || z.type === "brute" || z.type === "nurse" || this.isGuard(z))).map((z) => [z, z.x, z.y, z.windup]);
    const ok = super.shove();
    for (const [z, x, y, w] of bosses) {
      z.x = x;
      z.y = y;
      z.stagger = 0;
      if (w > 0) z.windup = w;
    }
    return ok;
  }
  scarceBundle(bundle) {
    if (this._uLoot && this.v) return { out: { ...bundle }, next: { ...this.v.remainder } };
    return super.scarceBundle(bundle);
  }
  toast(text, tone = "normal") {
    const L = this._uLoot;
    if (L && tone === "gold" && /\+\d/.test(String(text))) text = L.name + "：" + itemsText(L.bundle) + (L.tier === "rare" || L.tier === "precious" ? "（" + TIER_NAMES[L.tier] + "）" : "");
    return super.toast(text, tone);
  }
  // “每杀 3 只给废金属 2”改成按种类掉；农场的尸潮照旧
  add(bundle, ...rest) {
    if (this._uKill && this.s.region !== "farm" && bundle && Object.keys(bundle).length === 1 && bundle.scrap === 2) return true;
    return super.add(bundle, ...rest);
  }
  afterKill(e) {
    const region = this.s.region;
    if (e.type === "bloater") {
      const R = NEW_RULES.bloater;
      this.ux.fuses.push({ x: e.x, y: e.y, t: R.fuse, max: R.fuse, facing: e.facing ?? 0 });
      this.emitAt("fuse", e);
      this.tipOnce("bloater", "膨胀者打死以后会闪 1 秒再炸出一团绿雾：赶紧走开或者翻滚出去。下次远处用石头、弹弓打，或者推开再打。");
    }
    if (e.uParty) this.partyCheck();
    const kind = e.boss || (this.isGuard(e) ? "guard" : null);
    if (kind) this.bossDown(kind, e);
    if (region !== "farm" && !e.horde && KILL_DROPS[e.type]) {
      const got = {};
      for (const [chance, id, a, b] of KILL_DROPS[e.type]) if (Math.random() < chance) got[id] = (got[id] || 0) + a + Math.floor(Math.random() * (b - a + 1));
      if (Object.keys(got).length && !super.add(got, true)) {
        this.s.drops ??= [];
        this.s.drops.push({ region, x: Math.round(e.x), y: Math.round(e.y), items: got });
      }
    }
  }
  addCorpse(e) {
    if (e?.type === "bloater") return;
    if (!BODY_NEW.includes(e?.type)) return super.addCorpse(e);
    const fx = this.fx;
    fx.corpses.push({ type: e.type, x: e.x, y: e.y, facing: e.facing ?? 0, crawl: false, born: fx.clock, id: e.id });
    if (fx.corpses.length > 40) fx.corpses.splice(0, fx.corpses.length - 40);
  }
  // 新种类的伤害按它自己的数（统一高难度已经算进去）
  damagePlayer(n, opts = {}) {
    let hit = 0;
    if (this.ut && this.gr && opts.eff == null) {
      const z = opts.from || this._zAtk || this._emitSrc || null;
      if (z && NEW_ALL.includes(z.type)) opts = { ...opts, eff: this.zDamage(z, n), from: z };
      // 仓库守卫出手打不断，所以挨一下没有原来那么疼（被抓照旧）
      else if (z && this.isGuard(z)) hit = BOSSES.guard.hit || 0;
    }
    if (this.ux.pry) this.cancelPry("挨了一下，撬到一半停了。");
    if (!hit) return super.damagePlayer(n, opts);
    this._uHit = hit;
    try {
      return super.damagePlayer(n, opts);
    } finally {
      this._uHit = 0;
    }
  }
  zstat(type, ph) {
    const st = super.zstat(type, ph);
    return st && this._uHit && type === "elite" ? { ...st, damage: st.damage * this._uHit } : st;
  }

  // ================= 毒雾、酸液 =================
  tickFuses(dt) {
    const ux = this.ux,
      R = NEW_RULES.bloater;
    for (const f of ux.fuses) {
      f.t -= dt;
      if (f.t <= 0) {
        ux.clouds.push({ x: f.x, y: f.y, r: R.gas.r, t: R.gas.time, max: R.gas.time });
        this.ut.stats.gas++;
        this.events.push({ type: "gas", x: f.x, y: f.y });
        this.particlesAt(f.x, f.y - 10, "#9fbf5a", 24);
        const fx = this.fx;
        fx.corpses.push({ type: "bloater", x: f.x, y: f.y, facing: f.facing, crawl: false, born: fx.clock, burst: true });
        if (fx.corpses.length > 40) fx.corpses.splice(0, fx.corpses.length - 40);
      }
    }
    ux.fuses = ux.fuses.filter((f) => f.t > 0);
    for (const c of ux.clouds) c.t -= dt;
    ux.clouds = ux.clouds.filter((c) => c.t > 0);
  }
  inGas(p = this.s.player) {
    return this.ux.clouds.some((c) => dist(c, p) < c.r * Math.min(1, 0.6 + c.t / c.max));
  }
  inAcid(p = this.s.player) {
    return this.ux.puddles.some((q) => dist(q, p) < q.r);
  }
  // 环境伤害（毒雾、酸液）：不推人、不打断，最后一下按正常的倒下算
  envHurt(n, by) {
    const p = this.s.player;
    if (!(n > 0) || this.paused) return;
    if (p.hp - n > 0.5) {
      p.hp -= n;
      return;
    }
    p.hp = 0.01;
    this.invulnerable = 0;
    this.fx.lastHitBy = by;
    this.damagePlayer(0, { eff: 1, noBleed: true });
  }
  tickHazards(dt, st0) {
    const ux = this.ux,
      p = this.s.player;
    if (this.inGas()) {
      const mask = this.ut.mask === this.s.day ? 0.5 : 1;
      this.envHurt(NEW_RULES.bloater.gas.dps * mask * dt, "gas");
      if (p.stamina > st0) p.stamina = st0;
      ux.gasNote -= dt;
      if (ux.gasNote <= 0) {
        ux.gasNote = 1;
        this.effects.push({ x: p.x, y: p.y - 70, text: mask < 1 ? "毒雾（口罩）" : "毒雾", t: 0.7, color: "#b5d97a" });
      }
    }
    if (this.paused) return;
    if (this.inAcid()) {
      this.envHurt(NEW_RULES.spitter.puddle.dps * dt, "acid");
      ux.acidWear += dt * NEW_RULES.spitter.puddle.wear;
      if (ux.acidWear >= 1) {
        ux.acidWear -= 1;
        for (const slot of ["feet", "legs"]) {
          const id = this.gr.slots[slot];
          if (id) this.wear(id, 1);
        }
        this.effects.push({ x: p.x, y: p.y - 60, text: "酸液", t: 0.6, color: "#c6e37a" });
      }
    }
  }

  // ================= 麦穗、装死者喘气 =================
  tickDog(dt) {
    const ux = this.ux;
    if (ux.bark) {
      ux.bark.t -= dt;
      if (ux.bark.t <= 0) ux.bark = null;
    }
    if (!RUINS.includes(this.s.region) || !this.dogFollowing?.() || !this.f?.dog) return;
    const d = this.f.dog;
    for (const z of this.enemies) {
      if (!z.lying || z.dead || ux.barked.has(z.id) || dist(z, d) > 170) continue;
      ux.barked.add(z.id);
      ux.spotted.add(z.id);
      ux.bark = { t: 2.4, x: d.x, y: d.y, zx: z.x, zy: z.y };
      this.events.push({ type: "dogGrowl", x: d.x, y: d.y });
      this.toast("麦穗冲着地上一具尸体低吼——那具是装死的！", "warn");
      break;
    }
  }

  // ================= 夜行者摸到农场边上 =================
  tickProwl() {
    const u = this.ut,
      m = this.s.minute,
      day = this.s.day,
      night = m >= PROWL.from || m < PROWL.to,
      key = m >= PROWL.from ? day : day - 1;
    const prowlers = () => (this.s.enemies.farm || []).filter((z) => z.prowl && !z.dead);
    if (!night) {
      if (prowlers().length) {
        this.s.enemies.farm = (this.s.enemies.farm || []).filter((z) => !z.prowl);
        if (this.s.region === "farm") this.enemies = this.s.enemies.farm;
      }
      return;
    }
    if (u.prowl !== key) {
      u.prowl = key;
      const r = rngOf(hashOf(u.seed, "prowl", key));
      u.prowlOn = this.phaseAt(key) >= PROWL.phase && !this.decree?.("curfew") && r() < PROWL.chance;
    }
    if (!u.prowlOn || u.prowlSpawned === key || this.s.region !== "farm") return;
    if (["warning", "active"].includes(this.s.horde?.phase) || (this.o && ["warning", "active"].includes(this.raidState?.().phase))) return;
    u.prowlSpawned = key;
    for (let i = 0; i < PROWL.n; i++) {
      const q = this.freePoint(1430, 380 + i * 90),
        z = this.enemy("stalker", q.x, q.y);
      Object.assign(z, { prowl: true, homeX: q.x - 60, homeY: q.y });
      this.enemies.push(z);
    }
    this.toast("农场东边的林子里亮着两点绿光——夜行者摸到农场边上来了。（宵禁时农场灯灭，它们找不到这里）", "warn");
    this.events.push({ type: "prowl", x: 1430, y: 420 });
  }

  // ================= 每帧 =================
  update(dt, input = { x: 0, y: 0, run: false }) {
    if (this.paused || !this.ut || !this.gr) return super.update(dt, input);
    const step = clamp(dt, 0, 0.05),
      frozen = (this.fx?.hitstop || 0) > 0,
      p = this.s.player,
      st0 = p.stamina;
    if (this.ux.pry && Math.hypot(input?.x || 0, input?.y || 0) > 0.2) this.cancelPry("走开了，撬到一半停了。");
    super.update(dt, input);
    if (this.paused || frozen || !this.ut) return;
    const ux = this.ux;
    if (ux.region !== this.s.region) this.leftRegion(ux.region, this.s.region);
    ux.clock += step;
    this.tickFuses(step);
    this.tickAcid(step);
    this.tickDoors(step);
    for (const f of ux.flashes) f.t -= step;
    ux.flashes = ux.flashes.filter((f) => f.t > 0);
    this.tickHazards(step, st0);
    if (this.paused) return;
    this.tickPry(step);
    this.tickSurvivor(step);
    this.tickDrop(step);
    this.tickDog(step);
    this.tickProwl();
  }
  // 新的一天：先让下面各层把今天的事定下来（今日险地也在里面），再定今天废墟里的事
  onNewDay() {
    if (!this.ut) return super.onNewDay();
    this._uNewDay = true;
    try {
      super.onNewDay();
    } finally {
      this._uNewDay = false;
    }
    this.ensureDay();
    const day = this.s.day;
    for (const id of RUINS) {
      if (id === this.s.region) continue;
      const list = this.s.enemies[id];
      if (list?.some((z) => z.boss && z.bossDay !== day)) this.s.enemies[id] = list.filter((z) => !(z.boss && z.bossDay !== day));
    }
    this.uPlace();
  }
  workHour() {
    super.workHour();
    if (!this.ut) return;
    if (this.hour?.() === RADIO_HOUR) this.radioMorning();
  }
  // 电台早间播报（电台修好以后）
  radioMorning() {
    const u = this.ut,
      day = this.s.day;
    if (!this.r?.radio || u.radioDay === day) return false;
    u.radioDay = day;
    const parts = [];
    const ev = this.eventToday();
    if (ev) parts.push("今天" + regionName(ev.region) + "有动静：" + RUIN_EVENTS[ev.id].hint);
    for (const id of ["brute", "nurse"]) {
      const B = BOSSES[id];
      if (this.bossOn(id, day)) parts.push("有人看见" + B.name + "在" + regionName(B.region) + "转悠");
      else if (this.bossOn(id, day + 1)) parts.push("明天" + regionName(B.region) + "可能有" + B.name);
    }
    const c = u.cache;
    if (c && c.day === day && !c.opened) parts.push("昨天那台对讲机说的箱子在" + regionName(c.region));
    const text = "电台早间播报：" + (parts.length ? parts.join("；") : "今天废墟里没听到什么动静") + "。";
    this.toast(text, parts.length ? "gold" : "normal");
    if (this.o) this.olog(text);
    this.events.push({ type: "radio" });
    return true;
  }

  // ================= 交互 =================
  interact() {
    if (this.paused || !this.ut || !this.gr) return super.interact();
    if (this.fx?.roll || this.gx.grab) return super.interact();
    if (this.ux.pry) {
      this.cancelPry("不撬了。");
      return;
    }
    if (!this._picked && this.pickCandidates?.().length >= 2) return super.interact();
    const o = this.nearestObject(),
      p = this.s.player;
    // 爬行者照旧先踩；躺着的尸体比旁边的东西离你近时才踩它
    this._uNoLying = true;
    let crawler;
    try {
      crawler = this.nearestCrawler();
    } finally {
      this._uNoLying = false;
    }
    if (crawler) return super.interact();
    const lying = this.nearestCrawler();
    if (lying && !this._picked && (!o || dist(lying, p) < dist(o, p))) return super.interact();
    if (o?.type === "crate" && o.ukind) return this.openContainer(o);
    if (o && U_OBJECTS.includes(o.type)) return this.useObject(o);
    if (!o && this.kickCorpse()) return;
    return super.interact();
  }
  useObject(o) {
    if (o.type === "uSurvivor") return this.survivorGo(o);
    if (o.type === "uJoin") return this.survivorJoin();
    if (o.type === "uSend") return this.survivorSend();
    if (o.type === "uMerchant") {
      this.toast("背包客：「要什么自己挑，我只收干粮和绷带。」");
      return true;
    }
    if (o.type === "uGood") return this.buyGood(o);
    if (o.type === "uTalkie") return this.pickTalkie(o);
    if (o.type === "uDoor") return this.startPry(o);
    return false;
  }
  // 踢一脚地上的尸体：真死了
  kickCorpse() {
    const p = this.s.player,
      k = this.decorCorpses().find((c) => dist(c, p) < 60);
    if (!k) return false;
    this.actionAnim = 0.2;
    this.effects.push({ x: k.x, y: k.y - 40, text: "真死了", t: 0.8, color: "#cfc6a8" });
    this.emit("swing", { kind: "stomp" });
    return true;
  }
  context(o) {
    if (!this.ut || this.c?.fishing) return super.context(o);
    if (this.ux.pry) return (this.ux.pry.silent ? "开锁中" : "撬锁中") + " · " + Math.round((this.ux.pry.t / this.ux.pry.max) * 100) + "%（再按一下停）";
    if (o && !this._picked && !this.gx?.grab && this.pickCandidates?.().length >= 2) return super.context(o);
    if (o?.type === "crate" && o.ukind) {
      if (this.s.opened[o.id]?.day === this.s.day) return o.name + " · 今天搜过了";
      if (o.locked && this.ut.pried[o.id] !== this.s.day) {
        const tool = this.pryTool();
        return tool === "pick" ? "开锁 · " + o.name + "（" + PRY.fast + " 秒，没声音）" : tool ? "撬开 · " + o.name + "（" + PRY.time + " 秒，声音很响）" : o.name + " · 要回收撬棍";
      }
      return "搜索 " + o.name;
    }
    if (o?.type === "uDoor") {
      const tool = this.pryTool(),
        R = EVENT_RULES.storeroom;
      return tool === "pick" ? "开锁 · 储藏室的铁门（" + R.fast + " 秒，没声音）" : tool ? "撬开 · 储藏室的铁门（" + R.time + " 秒，半张图都听得见）" : "锁着的储藏室 · 要回收撬棍";
    }
    if (o?.type === "uSurvivor") return this.ut.ev?.st === "follow" ? "被困的人跟着你 · 带他到西边出口" : "被困的人 · 带他出去";
    if (o?.type === "uJoin") return "请他加入援建队";
    if (o?.type === "uSend") return "给他指路回集市";
    if (o?.type === "uMerchant") return "背包客 · 只收干粮和绷带";
    if (o?.type === "uGood") return o.name;
    if (o?.type === "uTalkie") return "捡起对讲机";
    return super.context(o);
  }

  // ================= 每日抉择、档案馆、手记 =================
  applyOp(op, ctx, tier, roll = 0.5) {
    const [kind, a] = op;
    if (kind === "uIntel" && this.ut) {
      this.ut.intel[a] = this.s.day;
      return a === "nurse" ? "记下了护士长的习惯：每隔一阵要吸一口气才叫得出来（打她时血条上会数着下一声）" : "记下了大块头的习惯：扔车门前先把门抡一圈（车门那条线会早一点亮）";
    }
    if (kind === "uMask" && this.ut) {
      this.ut.mask = this.s.day;
      return "缝了一副口罩：今天在绿雾里少掉一半血";
    }
    return super.applyOp(op, ctx, tier, roll);
  }
  trophyCase() {
    const u = this.ut;
    if (!u) return null;
    const have = TROPHY_IDS.filter((id) => !u.trophies.includes(id) && this.qty(id, true) > 0);
    return { name: TROPHY_CASE.name, need: TROPHY_CASE.need, reward: TROPHY_CASE.reward, donated: [...u.trophies], can: have, done: u.trophyDone };
  }
  donateTrophy(id) {
    const u = this.ut;
    if (!u || !TROPHY_IDS.includes(id) || u.trophies.includes(id)) return false;
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
    u.trophies.push(id);
    this.toast("捐给档案馆：" + ITEMS[id].name + "。");
    if (u.trophies.length >= TROPHY_CASE.need && !u.trophyDone) {
      u.trophyDone = true;
      this.addReputation?.(10);
      for (const r of this.c?.residents || []) r.morale = clamp((r.morale ?? 60) + 5, 0, 100);
      const text = "展柜「" + TROPHY_CASE.name + "」填满了！" + TROPHY_CASE.reward + "。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    }
    return true;
  }
  bossRecord() {
    if (!this.ut) return [];
    return BOSS_IDS.map((id) => ({ id, name: BOSSES[id].name, ...this.ut.boss[id] }));
  }
  todayItems() {
    const out = super.todayItems();
    if (!this.ut) return out;
    const extra = [];
    for (const n of this.ruinNews()) {
      if (n.kind !== "boss") continue;
      extra.push({ pri: n.when === "today" ? 1 : 2, text: (n.when === "today" ? "今天" : "明天") + regionName(n.region) + "有" + n.name, action: "", id: "" });
    }
    return [...out, ...extra].sort((a, b) => a.pri - b.pri).slice(0, 3);
  }
  tipOnce(key, text) {
    const u = this.ut;
    if (!u || u.seen[key]) return false;
    u.seen[key] = this.s.day;
    this.pruneSeen();
    this.toast(text, "warn");
    return true;
  }
  pruneSeen() {
    const u = this.ut,
      keys = Object.keys(u.seen);
    if (keys.length <= 50) return;
    // 只清掉“某天进图时说过动静”的那种，提示说过一次就不再说
    for (const k of keys) if (k.startsWith("ev:") && u.seen[k] < this.s.day) delete u.seen[k];
  }
  // 存档
  static parse(text) {
    const raw = JSON.parse(text),
      s = FeelEngine.parse(text);
    if (raw.undertow !== undefined) validateUndertow(raw.undertow);
    return migrateState(s);
  }
}

function validateUndertow(x) {
  const object = (v) => v && typeof v === "object" && !Array.isArray(v),
    int = (v, min = 0, max = 1e7) => Number.isInteger(v) && v >= min && v <= max,
    bool = (v) => typeof v === "boolean",
    bad = () => {
      throw Error("存档里的废墟记录损坏，请从设置恢复有效备份；原存档会保留。");
    },
    d = utDefaults();
  if (!object(x) || x.schema !== U_SCHEMA || Object.keys(x).some((k) => !Object.hasOwn(d, k))) bad();
  if (x.seed !== undefined && !int(x.seed, 0, 4294967295)) bad();
  for (const k of ["evDay", "mask", "prowl", "prowlSpawned", "radioDay"]) if (x[k] !== undefined && !int(x[k], -1, 1e6)) bad();
  for (const k of ["prowlOn", "trophyDone", "old"]) if (x[k] !== undefined && !bool(x[k])) bad();
  if (x.ev !== undefined && x.ev !== null) {
    const v = x.ev;
    if (!object(v) || !int(v.day, 1, 1e6) || !Object.hasOwn(RUIN_EVENTS, v.id) || !RUINS.includes(v.region) || !int(v.spot, 0, 2) || !EV_STATES.includes(v.st) || !int(v.bits, 0, 255) || !bool(v.spawned)) bad();
    if (Object.keys(v).some((k) => !["day", "id", "region", "spot", "st", "bits", "spawned"].includes(k))) bad();
  }
  if (x.cache !== undefined && x.cache !== null) {
    const c = x.cache;
    if (!object(c) || !int(c.day, 1, 1e6) || !RUINS.includes(c.region) || !int(c.spot, 0, 2) || !bool(c.opened) || Object.keys(c).some((k) => !["day", "region", "spot", "opened"].includes(k))) bad();
  }
  if (x.lit !== undefined) {
    if (!object(x.lit)) bad();
    for (const [id, v] of Object.entries(x.lit)) {
      const ok = CANDIDATES[id]?.map((c) => c.id) || [];
      if (!RUINS.includes(id) || !object(v) || !int(v.day, 1, 1e6) || !Array.isArray(v.ids) || v.ids.length > 9 || v.ids.some((c) => !ok.includes(c))) bad();
    }
  }
  if (x.gen !== undefined) {
    if (!object(x.gen)) bad();
    for (const [id, v] of Object.entries(x.gen)) if (!RUINS.includes(id) || !object(v) || !int(v.day, 1, 1e6) || !int(v.k, 0, 2)) bad();
  }
  if (x.pried !== undefined && (!object(x.pried) || Object.keys(x.pried).length > 40 || Object.entries(x.pried).some(([k, v]) => k.length > 40 || !int(v, 1, 1e6)))) bad();
  if (x.boss !== undefined) {
    if (!object(x.boss)) bad();
    for (const [id, v] of Object.entries(x.boss)) if (!BOSS_IDS.includes(id) || !object(v) || !int(v.wins ?? 0, 0, 1e6) || !int(v.first ?? 0, 0, 1e6) || !int(v.last ?? 0, 0, 1e6)) bad();
  }
  if (x.intel !== undefined && (!object(x.intel) || Object.entries(x.intel).some(([k, v]) => !["brute", "nurse"].includes(k) || !int(v, 0, 1e6)))) bad();
  if (x.trophies !== undefined && (!Array.isArray(x.trophies) || x.trophies.length > TROPHY_IDS.length || new Set(x.trophies).size !== x.trophies.length || x.trophies.some((t) => !TROPHY_IDS.includes(t)))) bad();
  if (x.seen !== undefined && (!object(x.seen) || Object.keys(x.seen).length > 80 || Object.entries(x.seen).some(([k, v]) => k.length > 30 || !int(v, 0, 1e6)))) bad();
  if (x.stats !== undefined && (!object(x.stats) || Object.entries(x.stats).some(([k, v]) => !STAT_KEYS.includes(k) || !int(v, 0, 1e9)))) bad();
}
