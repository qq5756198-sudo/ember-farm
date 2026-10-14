// v0.29.0「四时」：星露谷 30 个好玩点移植方案第一版（节奏、季节与土地）。
// 1. 四个时节：28 天一年、7 天一个时节；当季作物长势 +15%、每收一次多 1 份，反季长势 −15%（温室里不吃反季的亏）；寒潮固定落在寒潮时节；
//    秋收时节一半的险地是尸群迁徙；天气按时节排（数据里换掉了原来的 8 天一轮）。
// 2. 早间广播：手气签（大吉 / 吉 / 平 / 凶，按存档种子定）和明天的天气；每个时节第一天学一道当季菜。
// 3. 雨天：废墟里感染者听觉降两成、撬锁的声音只传一半远；下了一天雨，当晚动静到了线也有三成半机会被雨声盖住；雨鳅；居民雨天做手工快一成。
// 4. 上品；5. 腌缸和土酒坛；6. 牲口亲近；7. 老果园嫁接；8. 旧物摆件；9. 野物和蘑菇；10. 夜里的好事；11. 油灯下念账。
// 新进度放在 s.almanac，原来的字段不动。
import {
  Engine as BustleEngine,
  freshState as bustleFresh,
  migrateState as bustleMigrate,
  newGameState as bustleNewGame,
  newGamePlusState as bustleNewGamePlus,
  needsUpgrade as bustleNeedsUpgrade,
  legacyGear,
} from "./bustle.js";
import { hashOf, rngOf } from "./undertow.js";
import { ITEMS, BUILDINGS, CROPS, WORLD } from "./data.js";
import { TIER_ODDS, LOCKED_ODDS, PILE_ODDS, RARE_ODDS, ATTACHMENTS, RUINS, TIERS } from "./undertow-data.js";
import { CARAVAN_POOL } from "./outpost-data.js";
import { COLD } from "./bounty-data.js";
import { WEATHER } from "./expansion-data.js";
import { FEST_PICK, NOISE } from "./bustle-data.js";
import {
  ALMANAC_SCHEMA,
  YEAR,
  SEASONS,
  SEASON_BY_ID,
  seasonOf,
  seasonDay,
  yearOf,
  nextSeasonDay,
  coldStartFrom,
  CROP_SEASON,
  SEASON_RATE,
  SEASON_EXTRA,
  RAINY,
  LUCK,
  LUCK_BY_ID,
  BASE_EXTRA,
  RAIN,
  PRY_NOISE,
  PRIME,
  PRIME_CROPS,
  JARS,
  JAR_TYPES,
  HERD,
  HERD_NAMES,
  TREES,
  TREE_IDS,
  TREE_RULES,
  treeType,
  cuttingId,
  DECOR,
  DECOR_BY_ID,
  decorItem,
  DECOR_RULES,
  FORAGE,
  MUSHROOM,
  FORAGE_RULES,
  FORAGE_SPOTS,
  NIGHT_GOOD,
  LEDGER,
  DISHES,
  DISH_IDS,
} from "./almanac-data.js";

export { legacyGear };
// 读进来之前原样留一份：v0.28 及更早的存档（没有四时的记录）也算
export const needsUpgrade = (text) => {
  if (bustleNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !raw.almanac;
  } catch {
    return false;
  }
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " " + n)
    .join("、");
// 天气是按表排的（almanac-data 换掉了原来的 8 天一轮）：任何一天的天气都能直接查
const weatherTable = (day) => WEATHER[(((day - 1) % WEATHER.length) + WEATHER.length) % WEATHER.length];
const TREE_BY_TYPE = Object.fromEntries(TREE_IDS.map((id) => [treeType(id), id]));
const STAT_KEYS = ["luckDays", "rainNights", "prime", "seasonExtra", "herdExtra", "pickled", "brewed", "pets", "fruit", "cuttings", "decor", "forage", "mushrooms", "poisoned", "goodNights", "ledgers", "dishes"];

const almanacDefaults = () => ({
  schema: ALMANAC_SCHEMA,
  // 学会的当季菜
  dishes: [],
  // 腌缸、土酒坛：建筑 id → { item, n, start }（start 是装缸那天）
  jars: {},
  // 牲口亲近：0–100 分；petDay 哪天摸过
  herd: { flock: { pts: 0, petDay: 0 }, goat: { pts: 0, petDay: 0 }, spookDay: 0 },
  // 嫁接的果树：建筑 id → { planted, fruit, stop, winters }
  trees: {},
  // 居民区的老果树：哪天剪过枝条
  cut: {},
  // 旧物摆件：建设里挑的那一件
  decorPick: "",
  // 今天的野物：{ day, spots: [{ id, region, i, item, n, taken, x, y }] }
  forage: { day: 0, spots: [] },
  // 夜里的好事：{ day, kind, x, y, taken, items }
  good: null,
  // 0 点记一下各种坏事的数，06:00 对一对，看这一夜平不平安
  mark: { day: 0, attacks: 0, raids: 0, stolen: 0, ln: false },
  // 吃坏肚子到什么时候（绝对分钟）
  sick: 0,
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
});

export function migrateState(s) {
  bustleMigrate(s);
  if (!s.almanac) {
    s.almanac = almanacDefaults();
    // 旧档：学会这个时节的菜要等下一个时节第一天的广播；进游戏时说一声这一版的变化（新开的档在下面删掉）
    s.almanac.intro = { day: s.day || 1, told: false };
  } else {
    const d = almanacDefaults(),
      x = s.almanac;
    s.almanac = {
      ...d,
      ...x,
      dishes: [...(x.dishes || [])],
      jars: Object.fromEntries(Object.entries(x.jars || {}).map(([k, v]) => [k, { ...v }])),
      herd: { ...d.herd, ...x.herd, flock: { ...d.herd.flock, ...x.herd?.flock }, goat: { ...d.herd.goat, ...x.herd?.goat } },
      trees: Object.fromEntries(Object.entries(x.trees || {}).map(([k, v]) => [k, { ...v }])),
      cut: { ...x.cut },
      forage: { ...d.forage, ...x.forage, spots: (x.forage?.spots || []).map((p) => ({ ...p })) },
      good: x.good ? { ...x.good, items: x.good.items ? { ...x.good.items } : undefined } : null,
      mark: { ...d.mark, ...x.mark },
      stats: { ...d.stats, ...x.stats },
    };
    if (x.intro) s.almanac.intro = { ...x.intro };
  }
  return s;
}
const fresh = (s) => {
  delete s.almanac;
  migrateState(s);
  delete s.almanac.intro;
  return s;
};
export function freshState() {
  return fresh(bustleFresh());
}
export function newGameState(origin = "farmer") {
  return fresh(bustleNewGame(origin));
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  return fresh(bustleNewGamePlus(old, origin, keep, book));
}

export class Engine extends BustleEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    if (this.al) this.alignCold();
    this.syncDecor();
  }
  get al() {
    return this.s.almanac;
  }
  alRoll(...key) {
    return rngOf(hashOf(this.ut?.seed ?? 1, "al", ...key))();
  }
  alStat(k, n = 1) {
    if (this.al) this.al.stats[k] = (this.al.stats[k] || 0) + n;
  }

  // ================= 四个时节 =================
  season(day = this.s.day) {
    return seasonOf(day);
  }
  // 这种作物在这个时节：good / bad / ""
  seasonKind(crop, day = this.s.day) {
    const pref = CROP_SEASON[crop];
    if (!pref) return "";
    const id = seasonOf(day).id;
    return id === pref[0] ? "good" : id === pref[1] ? "bad" : "";
  }
  underGlass(p) {
    return this.s.buildings.some((b) => b.type === "greenhouse" && b.hp > 0 && dist(b, p) < 220);
  }
  cropSeasonRate(p) {
    if (!this.al || !p?.crop) return 1;
    const k = this.seasonKind(p.crop);
    if (k === "good") return SEASON_RATE.good;
    if (k === "bad" && !this.underGlass(p)) return SEASON_RATE.bad;
    return 1;
  }
  cropGrowthRate(p) {
    return super.cropGrowthRate(p) * this.cropSeasonRate(p);
  }
  // 寒潮固定落在寒潮时节第 1 天（一年的第 22 天）；旧档读进来对齐一次
  alignCold() {
    const c = this.bt?.cold,
      wi = this.w?.winter;
    if (!c || !c.next || wi?.phase === "prep" || wi?.phase === "cold") return;
    const d = coldStartFrom(c.next);
    if (d !== c.next) c.next = d;
  }
  coldSchedule() {
    const c = this.bt?.cold,
      wi = this.w?.winter;
    if (this.al && c && wi && wi.phase === "done" && (this.sc?.act || 1) >= 8) {
      if (!c.next) c.next = Math.max(this.s.day + COLD.every / 4, (wi.coldDay || this.s.day) + COLD.every);
      c.next = coldStartFrom(c.next);
    }
    const out = super.coldSchedule();
    if (this.al && c?.next) c.next = coldStartFrom(c.next);
    return out;
  }
  // 农场白天的音乐：回暖用原来那段，其余三个时节各一段（audio-data 里的 farmDay_heat / _harvest / _cold）
  seasonPiece(base = "farmDay") {
    const id = this.al ? seasonOf(this.s.day).id : "thaw";
    return id === "thaw" ? base : base + "_" + id;
  }
  // 秋收时节：一半的险地换成尸群迁徙
  hazardFor(day) {
    const h = super.hazardFor(day);
    if (h && this.al && seasonOf(day).id === "harvest" && this.alRoll("mig", day) < 0.5) return { ...h, kind: "migration" };
    return h;
  }

  // ================= 早间广播：手气签和当季菜 =================
  luckOf(day = this.s.day) {
    const x = this.alRoll("luck", day);
    let acc = 0;
    for (const l of LUCK) {
      acc += l.p;
      if (x < acc) return l;
    }
    return LUCK[LUCK.length - 1];
  }
  luckToday() {
    return this.al ? this.luckOf(this.s.day) : LUCK_BY_ID.plain;
  }
  radioOn() {
    return !!this.r?.radio;
  }
  morningParts(day = this.s.day) {
    const parts = [],
      fc = this.forecast?.() || [],
      tom = fc.find((d) => d.day === day + 1)?.weather || "";
    if (tom) parts.push("明天" + tom + (RAINY.includes(tom) ? "（下雨天废墟里的感染者耳朵不灵）" : tom === "高温" ? "（雨水桶不出水，多备点水）" : ""));
    const L = this.luckOf(day);
    parts.push(L.line);
    if (seasonDay(day) === 1) {
      const s = seasonOf(day);
      parts.push("今天起是" + s.name + "时节：" + s.hint);
      const dish = DISHES[s.id];
      if (!this.al.dishes.includes(dish)) parts.push("何大勺在广播里讲了一道当季菜「" + ITEMS[dish].name + "」——学会了（篝火灶）");
    }
    return parts;
  }
  learnDish(day = this.s.day) {
    if (seasonDay(day) !== 1) return false;
    const dish = DISHES[seasonOf(day).id];
    if (this.al.dishes.includes(dish)) return false;
    this.al.dishes.push(dish);
    this.alStat("dishes");
    return true;
  }
  radioMorning() {
    if (!this.al) return super.radioMorning();
    const toast = this.toast;
    let said = null;
    this.toast = (text, tone) => {
      said = { text, tone };
    };
    let ok = false;
    try {
      ok = super.radioMorning();
    } finally {
      this.toast = toast;
    }
    if (!ok) {
      if (said) this.toast(said.text, said.tone);
      return ok;
    }
    const day = this.s.day,
      parts = this.morningParts(day).map((p) => p.replace(/[。；]+$/, "")),
      L = this.luckOf(day);
    this.learnDish(day);
    this.alStat("luckDays");
    const text = (said?.text || "电台早间播报。") + parts.join("；") + "。";
    this.toast(text, L.tone === "warn" ? "warn" : said?.tone === "gold" || L.tone === "gold" ? "gold" : "normal");
    if (this.o) this.olog("早间广播：" + parts.join("；") + "。", L.tone === "warn" ? "warn" : "");
    return ok;
  }
  recipeReason(r) {
    if (this.al && DISH_IDS.includes(r?.id) && !this.al.dishes.includes(r.id)) {
      const s = SEASONS.find((x) => DISHES[x.id] === r.id);
      return "要在" + (s?.name || "") + "时节第一天的早间广播里听何大勺讲（先修好电台）";
    }
    return super.recipeReason(r);
  }

  // ================= 手气签的影响 =================
  // 柜子：大吉、吉多一次“再抽一样”的机会；另外单独掷一次旧物摆件
  rollContainer(o, day = this.s.day) {
    const res = super.rollContainer(o, day);
    if (!this.al || !res) return res;
    const L = this.luckOf(day),
      r = rngOf(hashOf(this.ut.seed, "alx", o.id, day)),
      bundle = { ...res.bundle };
    let tier = TIERS.indexOf(res.tier);
    if (L.extra > BASE_EXTRA && r() < L.extra - BASE_EXTRA) {
      const odds = o.ukind === "locked" || o.odds === "locked" ? LOCKED_ODDS : o.odds === "pile" ? PILE_ODDS : o.odds === "rare" ? RARE_ODDS : TIER_ODDS[Math.min(2, this.phase())];
      const more = this.drawFrom(res.kind, odds, r);
      for (const [k, n] of Object.entries(more.bundle)) bundle[k] = (bundle[k] || 0) + n;
      for (const k of Object.keys(bundle)) if (k.startsWith("bp_") || k === "flashlight" || ATTACHMENTS.includes(k)) bundle[k] = 1;
      tier = Math.max(tier, more.tier);
    }
    const chance = o.ukind === "locked" || o.odds === "locked" ? DECOR_RULES.locked : DECOR_RULES.chance;
    if (r() < chance) {
      const pool = DECOR.filter((d) => d.where.includes(res.kind));
      const list = pool.length ? pool : DECOR;
      const d = list[Math.floor(r() * list.length) % list.length];
      bundle[decorItem(d.id)] = (bundle[decorItem(d.id)] || 0) + 1;
    }
    return { ...res, bundle, tier: TIERS[Math.max(0, tier)] || res.tier };
  }
  // 撬锁：凶的那天慢两成；下雨天撬锁的声音只传一半远
  startPry(o) {
    const ok = super.startPry(o);
    const P = this.ux?.pry;
    if (ok && P && this.al) {
      const L = this.luckToday(),
        notes = [];
      if (L.pry > 1) {
        P.max = Math.round(P.max * L.pry * 10) / 10;
        notes.push("今天抽了下签，手生：要 " + P.max + " 秒");
      }
      if (RAINY.includes(this.s.weather) && this.s.region !== "farm" && !P.silent) {
        P.noise = Math.round(P.noise * RAIN.pry);
        notes.push("下着雨，撬的声音只传一半远");
      }
      if (notes.length) this.toast(notes.join("；") + "。", L.pry > 1 ? "warn" : "normal");
    }
    return ok;
  }
  // 商队：凶的那天多混进一成假货
  arriveCaravan() {
    const ok = super.arriveCaravan();
    if (ok && this.al && this.o?.caravan?.offers) {
      const L = this.luckToday();
      if (L.fake > 0 && !this.caravanTrusted?.())
        for (const off of this.o.caravan.offers) {
          const src = CARAVAN_POOL.find((x) => x.item && x.item === off.item);
          if (!off.fake && src?.fake && this.alRoll("fake", this.s.day, off.key) < L.fake) off.fake = src.fake;
        }
    }
    return ok;
  }

  // ================= 雨天 =================
  rainingOut() {
    return !!this.al && RAINY.includes(this.s.weather) && this.s.region !== "farm";
  }
  // 废墟里下雨：感染者听到的距离降两成（撬锁的声音再减一半，见 startPry）
  enemySenses(e, dt) {
    if (!this.rainingOut() || !this.noise?.length) return super.enemySenses(e, dt);
    const keep = this.noise;
    this.noise = keep.map((n) => ({ ...n, r: n.r * RAIN.hear }));
    try {
      return super.enemySenses(e, dt);
    } finally {
      this.noise = keep;
    }
  }
  processProduction(n) {
    return super.processProduction(this.al && RAINY.includes(this.s.weather) ? n * RAIN.craft : n);
  }
  // 池塘：雨天有雨鳅；大吉那天普通的鱼有两成五变成稀有的夜鱼
  hookFish() {
    const before = { ...this.s.inventory };
    const ok = super.hookFish();
    if (!ok || !this.al || this.s.region !== "farm") return ok;
    const got = Object.keys(this.s.inventory).find((id) => (this.s.inventory[id] || 0) > (before[id] || 0) && ["fish", "riverFish", "nightFish"].includes(id));
    // 鱼汛那天两条一起上来的不换（要的那种鱼照样两条）
    if (!got || this.s.inventory[got] - (before[got] || 0) > 1) return ok;
    const n = this.c?.metrics?.fish || 0;
    const swap = (to, text) => {
      this.s.inventory[got]--;
      if (!this.s.inventory[got]) delete this.s.inventory[got];
      this.s.inventory[to] = (this.s.inventory[to] || 0) + 1;
      this.toast(text, "gold");
    };
    if (RAINY.includes(this.s.weather) && this.alRoll("loach", this.s.day, n) < RAIN.loach) swap("alLoach", "是一条雨鳅！只在下雨天从泥里钻出来。");
    else if (got === "fish" && this.luckToday().fish > 1 && this.alRoll("lfish", this.s.day, n) < 0.25) swap("nightFish", "手气旺：咬钩的是一条金尾夜鱼！");
    return ok;
  }

  // ================= 上品 =================
  // 当季、照料分够：收成是优质的时候，那一份优质有机会换成上品（施过提质肥机会大）
  primeChance(p) {
    if (!this.al || !p?.crop || !CROPS[p.crop] || p.crop === "hybrid" || p.trait === "hardy" || !ITEMS["prime_" + p.crop]) return 0;
    if (this.seasonKind(p.crop) !== "good" || !this.g || !this.careScore || this.careScore(p) < PRIME.care) return 0;
    return this.bt?.plots?.[p.id]?.fz === "care" ? PRIME.fert : PRIME.chance;
  }
  harvest(p, worker = false) {
    if (!this.al || !p?.crop || !CROPS[p.crop] || p.growth < CROPS[p.crop].grow) return super.harvest(p, worker);
    const crop = p.crop,
      chance = this.primeChance(p),
      inSeason = this.seasonKind(crop) === "good" && p.trait !== "hardy" && crop !== "hybrid",
      prime = chance > 0 && this.alRoll("prime", p.id, this.s.day, crop) < chance,
      fine = "fine_" + crop,
      before = this.qty(fine, true);
    const ok = super.harvest(p, worker);
    if (!ok) return ok;
    // 当季：多收 1 份
    if (inSeason && SEASON_EXTRA > 0) {
      const extra = { [crop]: SEASON_EXTRA };
      if (worker) this.putStorage(extra);
      else this.receive(extra);
      this.alStat("seasonExtra", SEASON_EXTRA);
      this.effects?.push({ x: p.x + 20, y: p.y - 46, text: "当季 +" + SEASON_EXTRA, t: 1.1, color: "#cfe7a6" });
    }
    if (!prime) return ok;
    const got = this.qty(fine, true) - before;
    if (got > 0 && this.takeFarm({ [fine]: got })) {
      if (worker) this.putStorage({ ["prime_" + crop]: got });
      else this.receive({ ["prime_" + crop]: got });
      this.alStat("prime", got);
      this.effects?.push({ x: p.x, y: p.y - 60, text: "上品！" + ITEMS["prime_" + crop].name + " ×" + got, t: 1.4, color: "#ffb35a" });
      this.particlesAt?.(p.x, p.y - 10, "#ff9a4a", 22);
    }
    return ok;
  }
  quantityForCost(id, farm = this.s.region === "farm") {
    return super.quantityForCost(id, farm) + (this.al && CROPS[id] && ITEMS["prime_" + id] ? this.qty("prime_" + id, farm) : 0);
  }
  costPlan(cost, farm = this.s.region === "farm", variants = true) {
    const plan = super.costPlan(cost, farm, variants);
    if (plan || !variants || !this.al) return plan;
    const out = {};
    for (const [id, n] of Object.entries(cost)) {
      let left = n;
      const ids = CROPS[id] ? [id, "hardy_" + id, "fine_" + id, "prime_" + id] : [id];
      for (const key of ids) {
        const used = Math.min(left, Math.max(0, this.qty(key, farm) - (out[key] || 0)));
        if (used) {
          out[key] = (out[key] || 0) + used;
          left -= used;
        }
      }
      if (left) return null;
    }
    return out;
  }
  festPickable(kind = this.festivalKind()) {
    const list = super.festPickable(kind);
    if (!this.al || kind !== "harvest") return list;
    const more = PRIME_CROPS.map((id) => "prime_" + id).filter((id) => ITEMS[id] && this.qty(id, true) >= FEST_PICK.harvest.each);
    return [...list, ...more].sort((a, b) => (ITEMS[b].sell || 0) - (ITEMS[a].sell || 0));
  }

  // ================= 腌缸和土酒坛 =================
  jarOf(id) {
    const b = this.s.buildings.find((x) => x.id === id && JARS[x.type]);
    return b ? { b, J: JARS[b.type], rec: this.al.jars[b.id] || null } : null;
  }
  jarState(id) {
    const j = this.jarOf(id);
    if (!j?.rec) return { state: "empty" };
    const age = this.s.day - j.rec.start;
    if (age >= j.J.agedDays) return { state: "aged", age };
    if (age >= j.J.ready) return { state: "ready", age, left: j.J.agedDays - age };
    return { state: "brewing", age, left: j.J.ready - age };
  }
  jarFillReason(id, item) {
    const j = this.jarOf(id);
    if (!j) return "没有这口缸";
    if (j.b.hp <= 0) return "坏了，先修好";
    if (j.rec) return "里面还装着东西";
    if (!j.J.inputs.includes(item)) return "这口缸不装这个";
    if (this.s.region !== "farm") return "回到农场再装";
    if (this.quantityForCost(item, true) < j.J.take) return ITEMS[item].name + "不够 " + j.J.take + " 份";
    return "";
  }
  jarFill(id, item) {
    const why = this.jarFillReason(id, item);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const j = this.jarOf(id);
    if (!this.takeFarm({ [item]: j.J.take })) return false;
    this.al.jars[id] = { item, n: j.J.take, start: this.s.day };
    this.alStat(j.b.type === "alPickleJar" ? "pickled" : "brewed");
    this.toast(j.J.name + "里" + j.J.verb + "上了 " + j.J.take + " 份" + ITEMS[item].name + "：" + j.J.ready + " 天后能取，放到 " + j.J.agedDays + " 天更值钱。");
    return true;
  }
  jarTake(id) {
    const j = this.jarOf(id),
      st = this.jarState(id);
    if (!j?.rec || st.state === "brewing" || st.state === "empty") {
      this.toast(st.state === "brewing" ? "还没好，再等 " + st.left + " 天。" : "缸里是空的。", "warn");
      return false;
    }
    const out = st.state === "aged" ? j.J.aged : j.J.out,
      bundle = { [out]: j.J.n };
    this.receive(bundle);
    delete this.al.jars[id];
    this.toast("从" + j.J.name + "里取出 " + itemsText(bundle) + "。", "gold");
    this.emit("loot");
    return true;
  }

  // ================= 牲口亲近 =================
  herdHas(kind) {
    const a = this.c?.animals;
    return !!this.coop?.() && !!(kind === "goat" ? a?.goat : a?.chicken);
  }
  herdLevel(kind) {
    return Math.floor(clamp(this.al?.herd[kind]?.pts || 0, 0, HERD.max) / HERD.per);
  }
  herdPetReason(kind) {
    if (!HERD_NAMES[kind]) return "没有这种牲口";
    if (!this.herdHas(kind)) return kind === "goat" ? "还没有山羊" : "还没有鸡（或没建鸡舍）";
    if (this.s.region !== "farm") return "回到农场再去";
    if (this.al.herd[kind].petDay === this.s.day) return "今天已经" + (kind === "goat" ? "梳过毛" : "摸过") + "了";
    return "";
  }
  herdPet(kind) {
    const why = this.herdPetReason(kind);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const h = this.al.herd[kind],
      lv = this.herdLevel(kind);
    h.pts = clamp(h.pts + HERD.pet, 0, HERD.max);
    h.petDay = this.s.day;
    this.alStat("pets");
    const up = this.herdLevel(kind) > lv;
    this.toast((kind === "goat" ? "给山羊梳了梳毛，它拿脑袋拱你。" : "摸了摸鸡群，它们咕咕地围过来。") + (up ? HERD_NAMES[kind] + "的亲近升到 " + this.herdLevel(kind) + " 级。" : ""), up ? "gold" : "normal");
    return true;
  }
  // 一天过去：喂过、放过、摸过的加分，没人摸的掉分
  herdDay(day) {
    const a = this.c?.animals,
      h = this.al.herd,
      ch = this.bt?.chickens;
    for (const kind of ["flock", "goat"]) {
      if (!this.herdHas(kind)) continue;
      const x = h[kind];
      let v = 0;
      if (a.feedDay === day) v += HERD.fed;
      if (kind === "flock" && ch && ch.day === day && ch.used > 0) v += HERD.out;
      if (x.petDay !== day) v -= HERD.decay;
      x.pts = clamp(x.pts + v, 0, HERD.max);
    }
  }
  grow(n) {
    const a = this.c?.animals,
      pending = !!this.al && !!a && a.remaining > 0;
    const out = super.grow(n);
    if (pending && a.remaining === 0) this.herdProduce();
    return out;
  }
  herdProduce() {
    const a = this.c.animals,
      h = this.al.herd;
    if (h.spookDay === this.s.day) {
      a.ready.egg = Math.max(0, (a.ready.egg || 0) - 2);
      if (!a.ready.egg) delete a.ready.egg;
      if (a.goat) {
        a.ready.milk = Math.max(0, (a.ready.milk || 0) - 1);
        if (!a.ready.milk) delete a.ready.milk;
      }
      const text = "昨晚动静太大，鸡和羊受了惊，这一回没下蛋、没出奶。";
      this.toast(text, "warn");
      if (this.o) this.olog(text, "warn");
      return;
    }
    // 亲近越高，这一回多下一枚蛋、多出一份奶的机会越大（一天一回，按天掷）
    const f = this.herdHas("flock") ? this.herdLevel("flock") : 0,
      g = this.herdHas("goat") ? this.herdLevel("goat") : 0,
      day = this.s.day;
    if (f > 0 && this.alRoll("egg", day) < f * HERD.eggPer) {
      a.ready.egg = (a.ready.egg || 0) + 1;
      this.alStat("herdExtra");
    }
    if (a.goat && g >= HERD.milkFrom && this.alRoll("milk", day) < (g - HERD.milkFrom + 1) * HERD.milkPer) {
      a.ready.milk = (a.ready.milk || 0) + 1;
      this.alStat("herdExtra");
    }
  }
  herdSpook(day) {
    const h = this.al.herd;
    if (!this.herdHas("flock") && !this.herdHas("goat")) return;
    h.spookDay = day;
    for (const kind of ["flock", "goat"]) if (this.herdHas(kind)) h[kind].pts = clamp(h[kind].pts - HERD.spook, 0, HERD.max);
  }

  // ================= 老果园嫁接 =================
  oldTreeLeft(id) {
    const d = this.al.cut[id];
    return d ? Math.max(0, d + TREE_RULES.cut - this.s.day) : 0;
  }
  cutTree(id) {
    if (!TREES[id]) return false;
    const left = this.oldTreeLeft(id);
    if (left > 0) {
      this.toast("这棵老" + TREES[id].name + "刚剪过枝条，过 " + left + " 天再来。", "warn");
      return false;
    }
    this.receive({ [cuttingId(id)]: 1 });
    this.al.cut[id] = this.s.day;
    this.alStat("cuttings");
    this.toast("从老" + TREES[id].name + "上剪下一根枝条：回农场在建设里选「嫁接" + TREES[id].name + "」（还要 2 份木材、1 份鸡粪）。", "gold");
    return true;
  }
  treeRec(b) {
    if (!this.al.trees[b.id]) this.al.trees[b.id] = { planted: this.s.day, fruit: 0, stop: 0, winters: 0 };
    return this.al.trees[b.id];
  }
  treeKind(b) {
    return TREE_BY_TYPE[b?.type] || "";
  }
  treeMature(b, day = this.s.day) {
    return day - this.treeRec(b).planted >= TREE_RULES.grow;
  }
  treeFruitId(b) {
    const k = this.treeKind(b),
      base = TREES[k]?.fruit,
      w = this.treeRec(b).winters;
    return w >= 2 ? "prime_" + base : w >= 1 ? "fine_" + base : base;
  }
  treePick(id) {
    const b = this.s.buildings.find((x) => x.id === id && TREE_BY_TYPE[x.type]);
    if (!b) return false;
    const rec = this.treeRec(b);
    if (!rec.fruit) {
      this.toast(this.treeMature(b) ? "树上还没有熟的果子。" : "还没长成（还要 " + (TREE_RULES.grow - (this.s.day - rec.planted)) + " 天）。", "warn");
      return false;
    }
    const bundle = { [this.treeFruitId(b)]: rec.fruit };
    this.receive(bundle);
    this.alStat("fruit", rec.fruit);
    rec.fruit = 0;
    this.toast("摘下 " + itemsText(bundle) + "。", "gold");
    this.emit("loot");
    return true;
  }
  treeDay(day) {
    const startYear = (day - 1) % YEAR === 0;
    for (const b of this.s.buildings) {
      const k = TREE_BY_TYPE[b.type];
      if (!k || b.hp <= 0) continue;
      const rec = this.treeRec(b);
      if (startYear && rec.planted < day) rec.winters = Math.min(9, rec.winters + 1);
      if (this.treeMature(b, day) && seasonOf(day).id === TREES[k].season && day >= rec.stop) rec.fruit = Math.min(TREE_RULES.hold, rec.fruit + 1);
    }
    for (const id of Object.keys(this.al.trees)) if (!this.s.buildings.some((b) => b.id === id && TREE_BY_TYPE[b.type])) delete this.al.trees[id];
  }
  treeHurt(day) {
    const hit = [];
    for (const b of this.s.buildings) {
      const k = TREE_BY_TYPE[b.type];
      if (!k || b.hp <= 0 || !this.treeMature(b, day)) continue;
      if (this.alRoll("thurt", b.id, day) < TREE_RULES.hurt) {
        this.treeRec(b).stop = day + TREE_RULES.stop;
        hit.push(TREES[k].name);
      }
    }
    if (hit.length) {
      const text = "夜里摸进来的感染者折断了" + hit.join("、") + "的枝条，停 " + TREE_RULES.stop + " 天不结果。";
      this.toast(text, "warn");
      if (this.o) this.olog(text, "warn");
    }
  }

  // ================= 旧物摆件 =================
  decorOwned() {
    return DECOR.filter((d) => this.qty(decorItem(d.id), true) > 0).map((d) => d.id);
  }
  decorChoose(id) {
    if (!DECOR_BY_ID[id] || this.qty(decorItem(id), true) < 1) {
      this.toast("没有这件摆件。", "warn");
      return false;
    }
    this.al.decorPick = id;
    return this.startBuild("alDecor");
  }
  // 建设页里「旧物摆件」那一格：手上有摆件才露出来（和往事陈列柜一样）
  syncDecor() {
    if (BUILDINGS.alDecor) BUILDINGS.alDecor.retired = !(this.al && this.decorOwned().length > 0);
  }
  startBuild(type) {
    if (this.al && type === "alDecor") {
      let id = this.al.decorPick;
      if (!id || this.qty(decorItem(id), true) < 1) id = this.al.decorPick = this.decorOwned()[0] || "";
      this.syncDecor();
      if (!id) {
        this.toast("还没有旧物摆件：废墟里的柜子偶尔翻得到，锁着的铁柜更容易。", "warn");
        return false;
      }
    }
    return super.startBuild(type);
  }
  placeBuilding(x, y) {
    const type = this.buildMode;
    if (!this.al || !type) return super.placeBuilding(x, y);
    if (type === "alDecor") {
      const id = this.al.decorPick,
        item = id ? decorItem(id) : "";
      if (!item || this.qty(item, true) < 1) {
        this.toast("这件摆件已经没有了。", "warn");
        this.buildMode = null;
        return false;
      }
      const n0 = this.s.buildings.length,
        ok = super.placeBuilding(x, y);
      if (!ok) return ok;
      const b = this.s.buildings.length > n0 ? this.s.buildings[this.s.buildings.length - 1] : null;
      if (b?.type === "alDecor") b.decor = id;
      this.takeFarm({ [item]: 1 });
      this.alStat("decor");
      if (this.qty(item, true) < 1) {
        this.buildMode = null;
        this.al.decorPick = "";
      }
      this.syncDecor();
      return ok;
    }
    const n0 = this.s.buildings.length,
      ok = super.placeBuilding(x, y);
    if (ok && this.s.buildings.length > n0) {
      const b = this.s.buildings[this.s.buildings.length - 1];
      if (TREE_BY_TYPE[b?.type]) this.al.trees[b.id] = { planted: this.s.day, fruit: 0, stop: 0, winters: 0 };
    }
    return ok;
  }
  dismantle(id) {
    const b = this.s.buildings.find((x) => x.id === id);
    const decor = b?.type === "alDecor" && DECOR_BY_ID[b.decor] ? decorItem(b.decor) : "",
      jar = b && JARS[b.type] ? this.al?.jars[b.id] : null;
    const ok = super.dismantle(id);
    if (ok && this.al) {
      if (decor) {
        this.receive({ [decor]: 1 });
        this.syncDecor();
      }
      if (jar) {
        this.putStorage({ [jar.item]: jar.n });
        delete this.al.jars[id];
      }
      delete this.al.trees[id];
    }
    return ok;
  }
  // 屋外的摆件（不在哪间房地板 75 步内的），每种一分
  decorOutside() {
    const floors = this.s.buildings.filter((b) => b.type === "floor" && b.hp > 0);
    const kinds = new Set();
    for (const b of this.s.buildings) if (b.type === "alDecor" && b.hp > 0 && DECOR_BY_ID[b.decor] && !floors.some((f) => dist(f, b) < 75)) kinds.add(b.decor);
    return kinds.size;
  }
  moodFactors(r) {
    const out = super.moodFactors(r);
    if (!this.al) return out;
    const n = Math.min(DECOR_RULES.moodMax, this.decorOutside() * DECOR_RULES.mood);
    if (n > 0) out.push({ key: "decor", v: n, text: "营地里摆着 " + this.decorOutside() + " 样旧物摆件" });
    return out;
  }

  // ================= 野物和蘑菇 =================
  forageRegions() {
    return ["farm", ...RUINS.filter((id) => this.s.visited?.[id])];
  }
  forageSpawn(day) {
    const regions = this.forageRegions(),
      cands = [];
    for (const region of regions) (FORAGE_SPOTS[region] || []).forEach((p, i) => cands.push({ region, i }));
    for (let i = cands.length - 1; i > 0; i--) {
      const j = Math.floor(this.alRoll("fsh", day, i) * (i + 1));
      [cands[i], cands[j]] = [cands[j], cands[i]];
    }
    const n = clamp(FORAGE_RULES.min + Math.floor(this.alRoll("fn", day) * (FORAGE_RULES.max - FORAGE_RULES.min + 1)), FORAGE_RULES.min, Math.min(FORAGE_RULES.max, cands.length));
    const list = FORAGE[seasonOf(day).id] || FORAGE.thaw,
      rained = RAINY.includes(this.weatherOn?.(day - 1) || "");
    this.al.forage = {
      day,
      spots: cands.slice(0, n).map((c, k) => ({
        id: "f" + day + "-" + k,
        region: c.region,
        i: c.i,
        item: rained && k < MUSHROOM.spots ? MUSHROOM.raw : list[Math.floor(this.alRoll("fi", day, k) * list.length) % list.length],
        n: 1 + (this.alRoll("fq", day, k) < 0.35 ? 1 : 0),
        taken: false,
      })),
    };
  }
  weatherOn(day) {
    return day === this.s.day ? this.s.weather : weatherTable(day);
  }
  forageHere() {
    const f = this.al?.forage;
    if (!f || f.day !== this.s.day) return [];
    return f.spots.filter((p) => !p.taken && p.region === this.s.region);
  }
  forageObjects() {
    if (!Array.isArray(this.objects)) return;
    this.objects = this.objects.filter((o) => o.type !== "alForage");
    for (const p of this.forageHere()) {
      if (p.x === undefined) {
        const s = FORAGE_SPOTS[p.region]?.[p.i];
        if (!s) continue;
        const q = this.freePoint?.(s.x, s.y) || s;
        p.x = q.x;
        p.y = q.y;
      }
      this.objects.push({ type: "alForage", sid: p.id, item: p.item, name: ITEMS[p.item]?.name || "野物", x: p.x, y: p.y, icon: 40 });
    }
  }
  forageTake(sid) {
    const p = this.al.forage.spots.find((x) => x.id === sid);
    if (!p || p.taken || p.region !== this.s.region) return false;
    p.taken = true;
    const bundle = { [p.item]: p.n };
    this.receive(bundle);
    this.xp?.("exploration", FORAGE_RULES.xp);
    this.alStat(p.item === MUSHROOM.raw ? "mushrooms" : "forage", p.n);
    this.objects = this.objects.filter((o) => !(o.type === "alForage" && o.sid === sid));
    this.toast("捡到 " + itemsText(bundle) + (p.item === MUSHROOM.raw ? "——有两种是毒蘑菇，拿给许医生认一认再吃。" : "。"), p.item === MUSHROOM.raw ? "warn" : "gold");
    this.emit("loot");
    return true;
  }
  mushroomReason() {
    if (this.qty(MUSHROOM.raw, true) < 1) return "没有没认过的蘑菇";
    if (!this.resident?.("medic")) return "许医生不在营地";
    if (this.s.region !== "farm") return "回到农场再请许医生认";
    return "";
  }
  identifyMushrooms() {
    const why = this.mushroomReason();
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const n = this.qty(MUSHROOM.raw, true);
    let bad = 0;
    for (let i = 0; i < n; i++) if (this.alRoll("mush", this.s.day, this.al.stats.mushrooms, i) < MUSHROOM.poison) bad++;
    if (!this.takeFarm({ [MUSHROOM.raw]: n })) return false;
    if (n - bad > 0) this.receive({ [MUSHROOM.good]: n - bad });
    this.toast("许医生挑出 " + bad + " 朵有毒的（灰盖、白伞）" + (n - bad > 0 ? "，剩下 " + (n - bad) + " 朵能吃（平菇、鸡枞）。" : "，这一回一朵能吃的都没有。"), n - bad > 0 ? "gold" : "warn");
    return true;
  }
  consume(id) {
    const ok = super.consume(id);
    if (ok && this.al && id === MUSHROOM.raw && this.alRoll("eat", this.s.day, this.s.minute, this.al.stats.poisoned) < MUSHROOM.poison) {
      this.al.sick = (this.absNow?.() || 0) + MUSHROOM.sickMin;
      this.alStat("poisoned");
      this.toast("吃坏肚子了：一整天体力最多只有 60。下回先让许医生认一认。", "warn");
    }
    return ok;
  }
  sickNow() {
    return !!this.al && (this.absNow?.() || 0) < this.al.sick;
  }

  // ================= 夜里的好事 =================
  nightMark(day) {
    const hs = this.hn?.stats || {},
      bs = this.bt?.stats || {};
    this.al.mark = { day, attacks: (hs.attacks || 0) + (hs.autoAttacks || 0), raids: bs.raids || 0, stolen: bs.stolen || 0, ln: !!this.isLongNight?.(day - 1) };
  }
  nightBad() {
    const m = this.al.mark,
      hs = this.hn?.stats || {},
      bs = this.bt?.stats || {};
    if (m.day !== this.s.day) return true;
    if ((hs.attacks || 0) + (hs.autoAttacks || 0) > m.attacks || (bs.raids || 0) > m.raids || (bs.stolen || 0) > m.stolen || m.ln) return true;
    if (["warning", "active"].includes(this.s.horde?.phase)) return true;
    const r = this.raidState?.();
    if (r && ["warning", "active"].includes(r.phase)) return true;
    return this.hn?.attack.state === "live";
  }
  nightGood(day) {
    const r = this.alRoll("good", day);
    if (r >= NIGHT_GOOD.chance) return null;
    let kind = NIGHT_GOOD.kinds[Math.floor(this.alRoll("goodk", day) * NIGHT_GOOD.kinds.length) % NIGHT_GOOD.kinds.length];
    if (kind === "signal" && (this.ut?.cache || !RUINS.some((id) => this.s.visited?.[id]))) kind = "parcel";
    const g = { day, kind, taken: false };
    const plots = this.farmPlots?.() || [];
    if (kind === "debris") {
      // 落在农场边的空地上（野物刷的那几处），不砸田
      const spots = FORAGE_SPOTS.farm,
        at = spots[Math.floor(this.alRoll("deb", day) * spots.length) % spots.length];
      // 挪开一点，免得和当天的野物叠在一起
      g.x = clamp(at.x + 70, 40, WORLD.w - 40);
      g.y = clamp(at.y + 36, 40, WORLD.h - 40);
      g.note = "一块卫星残骸夜里落在农场边的空地上，拆开有电路和零件";
    } else if (kind === "birds") {
      for (const p of plots) {
        if (this.g?.plots[p.id]) this.g.plots[p.id].b = 0;
        p.fertility = clamp((p.fertility ?? 65) + NIGHT_GOOD.birds.fert, 0, 100);
      }
      this.putStorage({ manure: NIGHT_GOOD.birds.manure });
      g.taken = true;
      g.note = "一群候鸟在田里歇了一夜：虫被吃光了，地也肥了一点（鸡粪 +" + NIGHT_GOOD.birds.manure + " 入仓）";
    } else if (kind === "parcel") {
      const list = NIGHT_GOOD.parcels.filter((b) => Object.keys(b).every((id) => ITEMS[id]));
      g.items = { ...list[Math.floor(this.alRoll("par", day) * list.length) % list.length] };
      g.x = NIGHT_GOOD.door.x;
      g.y = NIGHT_GOOD.door.y;
      g.note = "门口多了个包裹，不知道是谁夜里放下的";
    } else {
      const open = RUINS.filter((id) => this.s.visited?.[id]),
        region = open[Math.floor(this.alRoll("sig", day) * open.length) % open.length];
      this.ut.cache = { day, region, spot: Math.floor(this.alRoll("sigs", day) * 3) % 3, opened: false };
      g.taken = true;
      g.region = region;
      g.note = "半夜对讲机里有人报了个坐标：今天" + (this.regionName?.(region) || region) + "有一个箱子（地图上标出来了）";
    }
    this.al.good = g;
    this.alStat("goodNights");
    return g;
  }
  goodHere() {
    const g = this.al?.good;
    return g && !g.taken && g.day === this.s.day && this.s.region === "farm" && g.x !== undefined ? g : null;
  }
  goodObjects() {
    if (!Array.isArray(this.objects)) return;
    this.objects = this.objects.filter((o) => o.type !== "alDebris" && o.type !== "alParcel");
    const g = this.goodHere();
    if (!g) return;
    if (!g.fixed) {
      const q = this.freePoint?.(g.x, g.y) || g;
      g.x = q.x;
      g.y = q.y;
      g.fixed = true;
    }
    this.objects.push({ type: g.kind === "debris" ? "alDebris" : "alParcel", name: g.kind === "debris" ? "卫星残骸" : "门口的包裹", x: g.x, y: g.y, icon: 40 });
  }
  goodTake() {
    const g = this.goodHere();
    if (!g) return false;
    let bundle = {};
    if (g.kind === "debris") {
      const D = NIGHT_GOOD.debris,
        pick = (k, [a, b]) => a + Math.floor(this.alRoll("debx", g.day, k) * (b - a + 1));
      bundle = { circuit: pick("c", D.circuit), parts: pick("p", D.parts), scrap: pick("s", D.scrap) };
    } else bundle = { ...(g.items || {}) };
    this.receive(bundle);
    g.taken = true;
    this.objects = this.objects.filter((o) => o.type !== "alDebris" && o.type !== "alParcel");
    this.toast((g.kind === "debris" ? "拆开卫星残骸：" : "打开包裹：") + itemsText(bundle) + "。", "gold");
    this.emit("loot");
    return true;
  }

  // ================= 油灯下念账 =================
  sleep() {
    if (!this.al) return super.sleep();
    const day0 = this.s.day,
      money0 = this.s.money,
      n0 = this.events.length,
      toast = this.toast,
      said = [];
    this.toast = (text, tone) => said.push([text, tone]);
    let ok = false;
    try {
      ok = super.sleep();
    } finally {
      this.toast = toast;
    }
    const summary = this.events.slice(n0).some((ev) => ev.type === "menu" && ev.view === "summary");
    // 平安的早上：那一行“平安过去”由账本说（消息记录里照样有）
    for (const [text, tone] of said) if (summary || !/平安过去/.test(text)) this.toast(text, tone);
    if (!ok) return ok;
    const L = this.ledger(day0, money0);
    this.alStat("ledgers");
    if (this.o) this.olog(L.title + "：" + L.lines.join(" / "));
    if (!summary) this.emit("ledger", { ...L, day: this.s.day, ms: LEDGER.ms });
    return ok;
  }
  ledger(day0, money0) {
    const lines = [],
      o = this.o,
      led = (o?.ledger || []).find((x) => x.day === day0);
    // 出货
    if (led) lines.push("出货箱：" + itemsText(led.items) + "，进账 +" + led.income + " 金");
    else lines.push("出货箱空着" + (this.s.money !== money0 ? "；金币 " + (this.s.money - money0 > 0 ? "+" : "") + (this.s.money - money0) : ""));
    // 夜里
    const night = [];
    const a = this.hn?.attack,
      hit = !!(a?.report && a.day === this.s.day);
    if (hit) night.push(a.report);
    if (this._alRainCut === this.s.day) night.push("下了一天雨，营地的动静被雨声盖住，感染者没听见");
    const g = this.al.good;
    if (g && g.day === this.s.day) night.push(g.note);
    lines.push("夜里：" + (night.length ? night.join("；") : "平安"));
    // 今天
    const s = seasonOf(this.s.day),
      today = [s.name + "第 " + seasonDay(this.s.day) + " 天", this.s.weather];
    if (this.radioOn()) today.push("手气" + this.luckToday().name);
    if (this.isFestivalDay?.() && this.festivalsOpen?.()) today.push("节庆");
    if (this.caravanHere?.()) today.push("唐九的商队在");
    if (this.jiangStays?.() && this.fishRunDay?.()) today.push("鱼汛");
    if (this.isLongNight?.()) today.push("今晚长夜");
    const f = this.al.forage;
    if (f.day === this.s.day && f.spots.length) today.push("野地里冒了 " + f.spots.length + " 处野物");
    lines.push("今天：" + today.join(" · "));
    return { title: "第 " + day0 + " 天的账", lines, tone: hit ? "warn" : "gold" };
  }

  // ================= 场景里的东西 =================
  assignRegion() {
    super.assignRegion();
    if (!this.al || !Array.isArray(this.objects)) return;
    if (this.s.region === TREE_RULES.region)
      for (const id of TREE_IDS) {
        const s = TREES[id].spot,
          q = this.freePoint?.(s.x, s.y) || s;
        this.objects.push({ type: "alOldTree", tree: id, name: "老" + TREES[id].name, x: q.x, y: q.y, icon: 40 });
      }
    this.forageObjects();
    this.goodObjects();
  }
  context(o) {
    if (this.al && !this.c?.fishing) {
      if (o?.type === "alForage") return ITEMS[o.item]?.name + " · 按 E 捡起来";
      if (o?.type === "alOldTree") {
        const left = this.oldTreeLeft(o.tree);
        return "老" + TREES[o.tree].name + (left ? " · 刚剪过（" + left + " 天后再来）" : " · 按 E 剪一根枝条");
      }
      if (o?.type === "alDebris") return "卫星残骸 · 按 E 拆";
      if (o?.type === "alParcel") return "门口的包裹 · 按 E 打开";
    }
    return super.context(o);
  }
  buildingContext(b) {
    if (this.al && b) {
      if (JARS[b.type]) {
        const st = this.jarState(b.id),
          J = JARS[b.type];
        return J.name + " · " + (st.state === "empty" ? "空着" : st.state === "brewing" ? "还要 " + st.left + " 天" : st.state === "ready" ? "能取了（再放 " + st.left + " 天更值钱）" : "陈了，能取");
      }
      const k = TREE_BY_TYPE[b.type];
      if (k) {
        const rec = this.treeRec(b);
        return "嫁接" + TREES[k].name + " · " + (!this.treeMature(b) ? "还要 " + (TREE_RULES.grow - (this.s.day - rec.planted)) + " 天长成" : rec.fruit ? "挂着 " + rec.fruit + " 个果子" : SEASON_BY_ID[TREES[k].season].name + "时节结果");
      }
      if (b.type === "alDecor" && DECOR_BY_ID[b.decor]) return DECOR_BY_ID[b.decor].name + " · 看看";
    }
    return super.buildingContext(b);
  }
  interact() {
    if (this.paused) return;
    if (!this.al || this.c?.fishing) return super.interact();
    const o = this.nearestObject?.();
    if (o?.type === "alForage") return void this.forageTake(o.sid);
    if (o?.type === "alOldTree") return void this.cutTree(o.tree);
    if (o?.type === "alDebris" || o?.type === "alParcel") return void this.goodTake();
    return super.interact();
  }

  // ================= 每帧、每个钟点、每天 =================
  update(dt, input = {}) {
    const intro = !this.paused && this.al?.intro;
    if (intro && !intro.told) {
      intro.told = true;
      const s = seasonOf(this.s.day);
      const text = "四时：一年 28 天、四个时节（现在是" + s.name + "），当季的菜长得快、多收一份；早上电台报明天的天气和手气签；腌缸、土酒坛、果树在建设里。点顶上的日期看四个时节。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    }
    const out = super.update(dt, input);
    this.syncDecor();
    // 吃坏肚子：体力最多 60
    if (this.sickNow() && this.s.player.stamina > 60) this.s.player.stamina = 60;
    return out;
  }
  workHour() {
    super.workHour();
    if (!this.al) return;
    const h = Math.floor(this.s.minute / 60);
    if (h === 6) {
      const day = this.s.day;
      if (this.al.mark.day === day && !this.al.mark.checked) {
        this.al.mark.checked = true;
        if (this.nightBad()) {
          if ((this.hn?.stats.attacks || 0) + (this.hn?.stats.autoAttacks || 0) > this.al.mark.attacks || (this.bt?.stats.raids || 0) > this.al.mark.raids) {
            this.treeHurt(day);
            this.herdSpook(day);
          }
        } else {
          const g = this.nightGood(day);
          if (g) {
            if (this.o) this.olog("夜里的好事：" + g.note + "。", "gold");
            if (this.s.region === "farm") this.goodObjects();
          }
        }
      }
    }
  }
  // 下了一天雨：营地的动静到了线，也有三成半机会被雨声盖住（热闹那一层 0 点结算时问这里）
  noiseSettle(guards = []) {
    const z = this.hn?.noise;
    if (this.al && z && this._alRainy && this.noiseTier(z.v) && !this.noiseBlocked() && this.alRoll("rainmask", this.s.day) < RAIN.mask) {
      const v = z.v;
      z.day = this.s.day;
      z.last = { day: this.s.day, v, n: 0 };
      z.v = Math.floor((v / 2) * 10) / 10;
      z.log = [];
      this.alStat("rainNights");
      this._alRainCut = this.s.day;
      const text = "下了一整天雨，营地的动静（" + v + "）被雨声盖住了，林子里的感染者没听见。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
      return;
    }
    return super.noiseSettle(guards);
  }
  onNewDay() {
    // 记下刚过完的这一天下没下雨（0 点结算动静时用；新的一天的天气在下面才换）
    this._alRainy = !!this.al && RAINY.includes(this.s.weather);
    const yesterday = this.s.day - 1;
    super.onNewDay();
    this._alRainy = false;
    if (!this.al) return;
    const day = this.s.day;
    this.herdDay(yesterday);
    this.treeDay(day);
    // 缸没了（被拆、被毁）：里面的东西退回仓库
    for (const [id, rec] of Object.entries(this.al.jars))
      if (!this.s.buildings.some((b) => b.id === id && JARS[b.type])) {
        this.putStorage({ [rec.item]: rec.n });
        delete this.al.jars[id];
      }
    if (this.al.good && this.al.good.day < day) this.al.good = null;
    this.forageSpawn(day);
    this.nightMark(day);
    if (this.s.region === "farm" || this.forageHere().length) this.forageObjects();
    this.goodObjects();
  }

  // ================= 存档 =================
  static parse(text) {
    const s = BustleEngine.parse(text);
    migrateState(s);
    validateAlmanac(s);
    return s;
  }
}

function validateAlmanac(s) {
  const t = s.almanac,
    bad = (why) => {
      throw new Error("存档里的四时记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
    };
  if (!t || typeof t !== "object") bad("缺少");
  const int = (v, lo = 0, hi = 1e9) => Number.isInteger(v) && v >= lo && v <= hi,
    num = (v, lo = 0, hi = 1e12) => Number.isFinite(v) && v >= lo && v <= hi,
    obj = (v) => !!v && typeof v === "object" && !Array.isArray(v),
    str = (v, n = 40) => typeof v === "string" && v.length <= n,
    bundle = (b, max = 99) => obj(b) && Object.entries(b).every(([id, n]) => ITEMS[id] && int(n, 1, max));
  if (!int(t.schema, 1, 99)) bad("版本");
  if (!Array.isArray(t.dishes) || t.dishes.length > DISH_IDS.length || t.dishes.some((d) => !DISH_IDS.includes(d))) bad("菜谱");
  if (!obj(t.jars) || Object.keys(t.jars).length > 40) bad("缸");
  for (const [k, v] of Object.entries(t.jars)) if (!str(k, 24) || !obj(v) || !ITEMS[v.item] || !int(v.n, 1, 20) || !int(v.start)) bad("缸");
  const h = t.herd;
  if (!obj(h) || !int(h.spookDay)) bad("牲口");
  for (const kind of ["flock", "goat"]) if (!obj(h[kind]) || !num(h[kind].pts, 0, HERD.max) || !int(h[kind].petDay)) bad("牲口");
  if (!obj(t.trees) || Object.keys(t.trees).length > 60) bad("果树");
  for (const [k, v] of Object.entries(t.trees)) if (!str(k, 24) || !obj(v) || !int(v.planted) || !int(v.fruit, 0, TREE_RULES.hold) || !int(v.stop) || !int(v.winters, 0, 9)) bad("果树");
  if (!obj(t.cut) || Object.entries(t.cut).some(([k, v]) => !TREES[k] || !int(v))) bad("果树");
  if (!str(t.decorPick, 20) || (t.decorPick && !DECOR_BY_ID[t.decorPick])) bad("摆件");
  for (const b of s.buildings || []) if (b.type === "alDecor" && b.decor !== undefined && !DECOR_BY_ID[b.decor]) bad("摆件");
  const f = t.forage;
  if (!obj(f) || !int(f.day) || !Array.isArray(f.spots) || f.spots.length > 12) bad("野物");
  for (const p of f.spots)
    if (!obj(p) || !str(p.id, 24) || !FORAGE_SPOTS[p.region] || !int(p.i, 0, 20) || !ITEMS[p.item] || !int(p.n, 1, 5) || typeof p.taken !== "boolean" || (p.x !== undefined && (!num(p.x, 0, WORLD.w) || !num(p.y, 0, WORLD.h)))) bad("野物");
  const g = t.good;
  if (g !== null && g !== undefined) {
    if (!obj(g) || !int(g.day) || !["debris", "birds", "parcel", "signal"].includes(g.kind) || typeof g.taken !== "boolean" || !str(g.note ?? "", 200)) bad("夜里的好事");
    if (g.x !== undefined && (!num(g.x, 0, WORLD.w) || !num(g.y, 0, WORLD.h))) bad("夜里的好事");
    if (g.items !== undefined && !bundle(g.items)) bad("夜里的好事");
  }
  const m = t.mark;
  if (!obj(m) || !int(m.day) || !int(m.attacks) || !int(m.raids) || !int(m.stolen) || typeof m.ln !== "boolean") bad("记录");
  if (!num(t.sick)) bad("记录");
  if (t.intro !== undefined && (!obj(t.intro) || !int(t.intro.day) || typeof t.intro.told !== "boolean")) bad("记录");
  if (!obj(t.stats) || Object.values(t.stats).some((v) => !int(v))) bad("记录");
}
