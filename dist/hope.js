// v0.33.0「盼头」：《爽点与耐玩体检方案》第二版。
// 1. 钱的去处：重建站交满的墙花钱加材料升二级；农舍、仓库、鸡舍扩建（看得见的样子）；旧站商街每周一样 3,000–18,000 的稀罕货，
//    唐九的商队那一周多两样。买到的只给方便和花样，不给战力，夜里不会因为它们变容易。
// 2. 这周的事：第二年起每周一件，四样轮着来——过路人（营门口待四天，带来他要的东西他留下一件摆件）、这周的清单（重建站最上面）、
//    唐九的商队（带两样稀罕货、两倍价收一样菜）、季节头目（一张野外的图上，打赢给战利品）。周一早上说。
// 3. 下午的事：第 8 天起每天 14:00 一件：空投、货郎、限时收购、鱼汛、被困的人、翻倒的物资车（长夜那天只放农场里的三样）。早上说。
// 新进度放在 s.hope，原来的字段不动。
import {
  Engine as ZestEngine,
  freshState as zestFresh,
  migrateState as zestMigrate,
  newGameState as zestNewGame,
  newGamePlusState as zestNewGamePlus,
  needsUpgrade as zestNeedsUpgrade,
  legacyGear,
} from "./zest.js";
import { hashOf, rngOf } from "./undertow.js";
import { ITEMS, CROPS, REGIONS } from "./data.js";
import { RUINS, KINDS, CANDIDATES, BOSSES } from "./undertow-data.js";
import { WALLS, OLD, OLD_IDS, PAGE_IDS } from "./relight-data.js";
import { FISH, FISH_IDS, DOG_FETCH, KEEP_IDS } from "./kin-data.js";
import { seasonOf, decorItem, DECOR, DECOR_BY_ID } from "./almanac-data.js";
import { COMFORT } from "./bustle-data.js";
import { FERTS } from "./bounty-data.js";
import {
  HOPE_SCHEMA,
  START,
  WALL2,
  WALL2_FX,
  EXPAND,
  EXPAND_NAMES,
  EXPAND_FX,
  GOODS,
  GOOD_IDS,
  goodItem,
  MARKET_ORDER,
  CARAVAN_ORDER,
  GOOD_FX,
  GOLD_SEED,
  WEEK_KINDS,
  WEEK_NAMES,
  weekKind,
  weekIndex,
  TRAVEL,
  TRAVELERS,
  TRAVELER_IDS,
  WEEK_LISTS,
  WEEK_LIST_IDS,
  WEEK_LIST_TIME,
  CARAVAN_WEEK,
  SEASON_BOSSES,
  BOSS_FALLBACK,
  BOSS_DAYS,
  NOON,
  NOON_KINDS,
  NOON_NAMES,
  NOON_REGIONS,
  DROP_GOODS,
  DROP,
  PEDDLER_SPOT,
  PEDDLERS,
  PEDDLER_IDS,
  BUYER,
  BUYERS,
  BUYER_IDS,
  SHOAL,
  SURVIVORS,
  SURVIVOR,
  TRUCK,
  INTRO_LINES,
  HOPE_DECOR,
  LETTERS,
  LETTER_IDS,
  DOVE,
} from "./hope-data.js";

export { legacyGear };
export const needsUpgrade = (text) => {
  if (zestNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !raw.hope;
  } catch {
    return false;
  }
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + (n > 1 ? " ×" + n : ""))
    .join("、");
const pickW = (list, x) => {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let acc = 0;
  for (const [v, w] of list) {
    acc += w / total;
    if (x < acc) return v;
  }
  return list[list.length - 1][0];
};
const STAT_KEYS = ["spent", "wall2", "expand", "goods", "travelers", "lists", "bosses", "noons", "rescued", "drops", "trucks", "peddled", "sold", "shoals", "honey", "letters", "tractor", "clues", "bonus"];
export const HOPE_OBJECTS = ["hpTraveler", "hpPeddler", "hpBuyer", "hpSurvivor", "hpTruck", "hpDeco"];
// 农场上比人高的两样（按前后遮挡排，只是画出来）
const HOPE_DECO = { mill: { x: 1080, y: 150 }, tractor: { x: 1000, y: 268 } };
// 清单、过路人、收购的人说“什么鱼都行”：能吃能卖的鱼（变异的不算）
const isFish = (id) => !!FISH[id] && !FISH[id].mutant && (ITEMS[id]?.sell || 0) > 0;
// 仓库扩建多一成的：菜、鱼、蛋奶、做好的吃的
const FARM_TYPES = ["food", "crop"];
const BOX_KINDS = ["toolbox", "medicine", "garage", "cargo", "kitchen"];

const hpDefaults = () => ({
  schema: HOPE_SCHEMA,
  // 升了二级的墙（墙 → 哪天）；扩建到几级；装上的稀罕货（→ 哪天）；每样买过几回；账本记下的旧物；备用水箱里还有几格
  wall2: {},
  expand: { home: 0, store: 0, coop: 0 },
  goods: {},
  bought: {},
  clues: [],
  tank: 0,
  // 旧站商街这周的稀罕货 { k 第几周, good, sold }；下一周从 MARKET_ORDER 的第几样往后找
  market: null,
  marketIdx: 0,
  // 这周的事、用过的内容
  week: null,
  log: { traveler: [], list: [], caravan: 0, boss: [] },
  // 今天下午的事、轮到第几个
  noon: null,
  noonLog: { last: "", peddler: 0, buyer: 0, survivor: 0, regions: [] },
  // 见过的人（过路人、救过的人、打过交道的货郎和收购的人）；鸽子捎回的信
  met: [],
  letters: [],
  dove: 0,
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
});

export function migrateState(s) {
  zestMigrate(s);
  if (!s.hope) {
    s.hope = hpDefaults();
    // 旧档：第一帧说一声这一版的变化（新开的档在下面删掉）
    s.hope.intro = { day: s.day || 1, told: false };
  } else {
    const d = hpDefaults(),
      x = s.hope;
    s.hope = {
      ...d,
      ...x,
      expand: { ...d.expand, ...x.expand },
      log: { ...d.log, ...x.log },
      noonLog: { ...d.noonLog, ...x.noonLog },
      stats: { ...d.stats, ...x.stats },
    };
  }
  return s;
}
const fresh = (s) => {
  delete s.hope;
  migrateState(s);
  delete s.hope.intro;
  return s;
};
export function freshState() {
  return fresh(zestFresh());
}
export function newGameState(origin = "farmer") {
  return fresh(zestNewGame(origin));
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  return fresh(zestNewGamePlus(old, origin, keep, book));
}

export class Engine extends ZestEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this._hpSurv = null;
  }
  get hp() {
    return this.s.hope;
  }
  hpStat(k, n = 1) {
    if (this.hp) this.hp.stats[k] = (this.hp.stats[k] || 0) + n;
  }
  hpRoll(...parts) {
    return rngOf(hashOf(this.ut?.seed ?? 1, "hope", ...parts))();
  }
  hpOwn(id) {
    return !!this.hp?.goods[id];
  }
  hpLv(k) {
    return this.hp?.expand[k] || 0;
  }
  wall2On(w) {
    return !!this.hp?.wall2[w];
  }
  hpMeet(id) {
    if (this.hp && id && !this.hp.met.includes(id)) this.hp.met.push(id);
  }
  hpPay(cost) {
    const items = Object.fromEntries(Object.entries(cost || {}).filter(([k]) => k !== "gold"));
    if (Object.keys(items).length && !this.takeFarm(items)) return false;
    if (cost?.gold) this.hpSpend(cost.gold);
    return true;
  }
  hpSpend(n) {
    this.s.money -= n;
    this.hpStat("spent", n);
  }
  costText(cost) {
    return Object.entries(cost || {})
      .map(([k, n]) => (k === "gold" ? n + " 金币" : (ITEMS[k]?.name || k) + " " + n))
      .join("、");
  }
  hpLack(cost) {
    if (cost?.gold && this.s.money < cost.gold) return "金币不够（要 " + cost.gold + "）";
    const miss = Object.entries(cost || {}).filter(([k, n]) => k !== "gold" && this.qty(k, true) < n);
    if (miss.length) return "还缺" + miss.map(([k, n]) => (ITEMS[k]?.name || k) + " " + (n - this.qty(k, true))).join("、");
    return "";
  }

  // ================= 墙升二级 =================
  wall2Reason(w) {
    if (!WALL2[w]) return "没有这面墙";
    if (!this.rl) return "先建重建站";
    if (!this.wallOn(w)) return "这面墙还没通";
    if (this.wall2On(w)) return "已经是二级了";
    if (!this.rlStationHere?.()) return "要站在重建站跟前";
    return this.hpLack(WALL2[w].cost);
  }
  wall2Up(w) {
    const why = this.wall2Reason(w);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    if (!this.hpPay(WALL2[w].cost)) return false;
    this.hp.wall2[w] = this.s.day;
    this.hpStat("wall2");
    this.moment("upgrade", "「" + WALLS[w].name + "」升到二级 · " + WALL2[w].name, [WALL2[w].text], { icon: w });
    if (this.o) this.olog("「" + WALLS[w].name + "」升到二级：" + WALL2[w].text, "gold");
    this.emit("craft");
    return true;
  }
  netSources() {
    const out = super.netSources();
    if (this.wall2On("water")) out.push({ kind: "hpPipe", name: "旧水厂主管（二级水网）", made: WALL2_FX.water, store: 0 });
    if (this.hpOwn("mill")) out.push({ kind: "hpMill", name: "风车抽的地下水", made: GOOD_FX.mill, store: 0 });
    return out;
  }
  // 二级诊所：再少躺一天（最少半天）
  injure(key, name, why = "") {
    const ok = super.injure(key, name, why);
    if (!ok || !this.wall2On("clinic")) return ok;
    const h = this.hn?.hurt[key];
    if (h) h.until = Math.max(h.at + WALL2_FX.injuryMin, h.until - WALL2_FX.injury);
    return ok;
  }
  rlInjureText(text) {
    let t = super.rlInjureText(text);
    if (typeof t !== "string") return t;
    if (this._rlInjure && this.wall2On("clinic")) t = t.replace("1 天干不了活（门诊少躺一天）", "半天干不了活（二级诊所）");
    if (this._rlSchool && this.wall2On("school")) t = t.replace(/：\d 天后(出师|改行)（营地的小课堂快一倍）/, (m, w) => "：明天早上" + w + "（二级学堂的夜课）");
    return t;
  }
  travelBonus(n, to) {
    n = super.travelBonus(n, to);
    if (this.wall2On("rail") && this._travelFrom !== "tunnel" && to !== "tunnel") n = Math.max(1, Math.ceil(n * WALL2_FX.rail));
    return n;
  }
  // 二级电网：夜里田里的菜长得快（时间是按一个钟点一段推的，判的是这一段的末尾）
  cropGrowthRate(p) {
    let r = super.cropGrowthRate(p);
    if (this.wall2On("power") && this.isFarmPlot?.(p)) {
      const m = this.s.minute;
      if (m > WALL2_FX.powerFrom || m <= WALL2_FX.powerTo) r *= WALL2_FX.power;
    }
    return r;
  }
  cropSeasonRate(p) {
    const r = super.cropSeasonRate(p);
    return this.hpOwn("hotbed") && r < 1 && this.isFarmPlot?.(p) ? 1 : r;
  }
  // 二级电台：今天哪片废墟的哪种柜子里有好东西（照今天亮着的柜子真抽一遍；没开过的原始补给箱不算）
  radioTip(day = this.s.day) {
    if (!this.wall2On("radio") || !this.ut) return "";
    const region0 = this.s.region;
    for (const id of RUINS) {
      if (!this.s.visited?.[id]) continue;
      const lit = this.litToday(id),
        cands = CANDIDATES[id] || [];
      for (const c of cands) {
        if (!lit.includes(c.id) || c.kind === "locked") continue;
        const oid = id + "-" + c.id;
        if ((c.orig && !this.s.opened[oid]) || this.s.opened[oid]?.day === day) continue;
        let roll = null;
        try {
          this.s.region = id;
          roll = this.rollContainer({ id: oid, ukind: c.kind, cand: c.id, name: c.name || KINDS[c.kind]?.name || "柜子", x: c.x || 0, y: c.y || 0 }, day);
        } catch {
          roll = null;
        } finally {
          this.s.region = region0;
        }
        if (roll && (roll.tier === "rare" || roll.tier === "precious")) return this.regionName(id) + "的" + (c.name || KINDS[c.kind]?.name || "柜子") + "里有好东西";
      }
    }
    return "";
  }

  // ================= 营地扩建 =================
  expandReason(k) {
    const list = EXPAND[k];
    if (!list) return "没有这一样";
    const lv = this.hpLv(k);
    if (lv >= list.length) return "已经扩建完了";
    if (this.s.region !== "farm") return "回到农场再扩建";
    if (k === "coop" && !this.s.buildings.some((b) => b.type === "coop" && b.hp > 0)) return "先建一座鸡舍";
    if (k === "coop" && lv === 1 && !this.c.animals?.goat) return "先养一只山羊";
    return this.hpLack(list[lv].cost);
  }
  expand(k) {
    const why = this.expandReason(k);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const X = EXPAND[k][this.hpLv(k)];
    if (!this.hpPay(X.cost)) return false;
    this.hp.expand[k]++;
    this.hpStat("expand");
    this.moment("upgrade", EXPAND_NAMES[k] + "扩建 · " + X.name, [X.text], { icon: "build" });
    if (this.o) this.olog(EXPAND_NAMES[k] + "扩建：" + X.name + "。", "gold");
    this.emit("craft");
    return true;
  }
  residentsCapacity() {
    return super.residentsCapacity() + (this.hpLv("home") >= 1 ? EXPAND_FX.bed : 0);
  }
  roomComfort(room) {
    const c = super.roomComfort(room);
    if (!room?.active || !this.hpLv("home") || dist(room.floor, COMFORT.home) > COMFORT.homeR) return c;
    return Math.min(COMFORT.max, c + EXPAND_FX.comfort * this.hpLv("home"));
  }
  sleep() {
    const until0 = this.hn?.rested?.until || 0;
    const ok = super.sleep();
    if (!ok || !this.hn || !this.hp) return ok;
    let add = 0;
    if (this.hpLv("home") >= 2) add += EXPAND_FX.rest;
    if (this.hpOwn("boiler")) add += GOOD_FX.boiler;
    if (!add) return ok;
    const now = this.absNow(),
      r = this.hn.rested;
    if (r && r.until > until0 && r.until > now) r.until += add;
    else this.hn.rested = { until: now + add, comfort: r?.comfort || 0 };
    this.zFloat?.("「休息好」多 " + Math.round(add / 60) + " 个钟点");
    return ok;
  }
  shipPrice(id) {
    const p = super.shipPrice(id);
    const lv = this.hpLv("store");
    if (!p || !lv || !FARM_TYPES.includes(ITEMS[id]?.type)) return p;
    return Math.round(p * (1 + EXPAND_FX.sell * lv));
  }
  // 鸡舍扩建、孵蛋箱：一回产出时多下几个蛋、多一份奶（受了惊的那天照样没有）
  grow(n) {
    const a = this.c?.animals,
      pending = !!this.hp && !!a && a.remaining > 0;
    const out = super.grow(n);
    if (pending && a.remaining === 0 && this.al?.herd?.spookDay !== this.s.day) {
      const egg = (this.hpLv("coop") >= 1 ? EXPAND_FX.egg : 0) + (this.hpOwn("incubator") ? GOOD_FX.incubator : 0);
      if (egg) a.ready.egg = (a.ready.egg || 0) + egg;
      if (a.goat && this.hpLv("coop") >= 2) a.ready.milk = (a.ready.milk || 0) + EXPAND_FX.milk;
    }
    return out;
  }

  // ================= 稀罕货 =================
  goodNeed(id) {
    const G = GOODS[id];
    if (G?.need === "dog" && !this.f?.dog?.rescued) return "先把麦穗接回来";
    if (G?.need === "coop" && !this.s.buildings.some((b) => b.type === "coop" && b.hp > 0)) return "先建一座鸡舍";
    return "";
  }
  goodReason(id, price = GOODS[id]?.price) {
    const G = GOODS[id];
    if (!G) return "没有这样东西";
    if (!G.repeat && this.hpOwn(id)) return "已经有了";
    const need = this.goodNeed(id);
    if (need) return need;
    if (id === "ledger" && !this.ledgerPool().length) return "旧物都找到了";
    if (this.s.money < price) return "金币不够（要 " + price + "）";
    return "";
  }
  // 买到手：工具换上、家当摆好、账本记下、种子包进背包
  installGood(id, how = "") {
    const G = GOODS[id];
    if (!G) return false;
    this.hp.bought[id] = (this.hp.bought[id] || 0) + 1;
    this.hpStat("goods");
    let extra = "";
    if (!G.repeat) this.hp.goods[id] = this.s.day;
    if (id === "can") this.hp.tank = GOOD_FX.can;
    if (HOPE_DECO[id] && this.s.region === "farm") this.hpPlace();
    if (id === "ledger") {
      const got = this.ledgerPool().slice(0, GOOD_FX.ledger);
      this.hp.clues.push(...got);
      this.hpStat("clues", got.length);
      extra = got.length ? "账本里记着：" + got.map((o) => "「" + OLD[o].name + "」在" + this.ledgerText(o)).join("；") + "（档案馆那一页也写着）" : "";
    }
    if (id === "goldSeeds") {
      const seed = GOLD_SEED[seasonOf(this.s.day).id] || "seedGoldRadish";
      this.receive({ [seed]: GOOD_FX.goldSeeds });
      extra = ITEMS[seed].name + " ×" + GOOD_FX.goldSeeds + " 放进背包了";
    }
    const where = how ? "（" + how + "）" : "";
    if (!G.repeat) this.moment("upgrade", "买下" + G.name + where, [G.text], { icon: "good", good: id });
    else this.toast("买下" + G.name + where + "：" + (extra || G.text), "gold");
    if (this.o) this.olog("买下" + G.name + where + "：" + (extra || G.text), "gold");
    return true;
  }
  ledgerPool() {
    const clued = new Set(this.hp?.clues || []);
    return OLD_IDS.filter((id) => !clued.has(id) && !this.oldDonated?.(id) && !(this.qty(id, true) > 0) && OLD[id].home?.region);
  }
  ledgerText(id) {
    const H = OLD[id]?.home;
    if (!H) return "";
    const where = H.region === "tunnel" ? "地铁隧道的柜子里" : this.regionName?.(H.region) || H.region;
    const kinds = (H.kinds || []).map((k) => KINDS[k]?.name || k).join("、");
    return where + (kinds ? "的" + kinds + "里" : "");
  }
  clueFound(id) {
    return !!this.oldDonated?.(id) || this.qty(id, true) > 0;
  }
  // 旧站商街这周的那一样：第 32 天起每个时节的第 4 天换；买过的独一份不再出
  marketGood(day = this.s.day) {
    if (!this.hp || day < START.good) return null;
    const k = Math.floor((day - START.good) / 7);
    const m = this.hp.market;
    if (m && m.k === k) return m;
    let idx = this.hp.marketIdx || 0,
      good = null;
    for (let i = 0; i < MARKET_ORDER.length; i++) {
      const id = MARKET_ORDER[(idx + i) % MARKET_ORDER.length];
      if ((!GOODS[id].repeat && this.hpOwn(id)) || (id === "ledger" && !this.ledgerPool().length)) continue;
      good = id;
      idx = (idx + i + 1) % MARKET_ORDER.length;
      break;
    }
    if (!good) return null;
    this.hp.marketIdx = idx;
    this.hp.market = { k, good, sold: false };
    return this.hp.market;
  }
  marketReason() {
    const m = this.marketGood();
    if (!m) return "这周没有稀罕货";
    if (m.sold) return "这周的已经卖掉了";
    return this.goodReason(m.good);
  }
  // 旧站商街「两间铺位经营」那一处多一样：这周的稀罕货
  districtOptions(id) {
    const out = super.districtOptions(id);
    if (id !== "shops" || !this.hp) return out;
    const m = this.marketGood();
    if (!m) return out;
    const G = GOODS[m.good];
    out.push(this.option("hpGood", "这周的稀罕货 · " + G.name + "（" + G.price + " 金币）", {}, { fee: G.price, effect: "hpGood", done: m.sold, need: m.sold ? "" : this.goodReason(m.good, 0), desc: G.text }));
    return out;
  }
  completeDistrictAction(q) {
    if (q?.effect !== "hpGood") return super.completeDistrictAction(q);
    const m = this.marketGood();
    if (m && !m.sold) {
      m.sold = true;
      this.hpStat("spent", q.fee || 0);
      this.installGood(m.good, "旧站商街");
      this.emit("trade");
    }
    this.ensurePoint(q.point).count++;
  }
  // 唐九的商队：那一周带两样稀罕货，多待一天
  arriveCaravan() {
    const out = super.arriveCaravan();
    const c = this.o?.caravan,
      W = this.hp?.week;
    if (!c?.offers?.length || !W || W.kind !== "caravan" || W.st === "gone" || c.offers.some((o) => o.hpGood)) return out;
    W.st = "here";
    c.until = Math.max(c.until || 0, (W.start + CARAVAN_WEEK.leaveSd - 1) * 1440 + 20 * 60);
    let key = Math.max(...c.offers.map((o) => o.key)) + 1;
    for (const g of W.goods) if (GOODS[g].repeat || !this.hpOwn(g)) c.offers.push({ key: key++, item: goodItem(g), tech: null, qty: 1, price: GOODS[g].price, fake: null, inspected: "real", sold: false, hpGood: g });
    this.toast("唐九这回带了两样稀罕货（" + W.goods.map((g) => GOODS[g].name).join("、") + "），还两倍价收" + this.hpKeyName(W.buy) + "，待到第 " + (W.start + CARAVAN_WEEK.leaveSd - 1) + " 天 20:00。", "normal");
    return out;
  }
  offerPrice(offer) {
    if (offer?.hpGood) return GOODS[offer.hpGood].price;
    return super.offerPrice(offer);
  }
  buyOffer(key) {
    const c = this.o?.caravan,
      o = c?.offers.find((x) => x.key === Number(key) || x.key === key);
    if (!o?.hpGood) return super.buyOffer(key);
    if (o.sold || !this.caravanHere() || this.s.region !== "farm") return false;
    if (this.th?.market?.banned) {
      this.toast("唐九摆摆手：集市的人都说你手脚不干净，先去交赔礼钱。", "warn");
      return false;
    }
    const why = this.goodReason(o.hpGood);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    this.hpSpend(GOODS[o.hpGood].price);
    o.sold = true;
    this.installGood(o.hpGood, "唐九的商队");
    this.emit("trade");
    return true;
  }
  offerName(offer) {
    if (offer?.hpGood) return "稀罕货 · " + GOODS[offer.hpGood].name;
    return super.offerName(offer);
  }
  caravanOpen() {
    const c = this.o?.caravan;
    return !!c && (!!this.o.convoy?.done || c.visits > 0 || c.next > 0 || this.caravanHere());
  }
  // 那一周唐九还收一样菜：两倍价，最多 20 份
  caravanBuyLeft() {
    const W = this.hp?.week;
    if (!W || W.kind !== "caravan" || W.st !== "here" || !this.caravanHere()) return 0;
    return Math.max(0, CARAVAN_WEEK.max - (W.sold || 0));
  }
  caravanSellReason() {
    const W = this.hp?.week;
    if (!W || W.kind !== "caravan" || W.st !== "here" || !this.caravanHere()) return "唐九这回不收菜";
    if (this.caravanBuyLeft() <= 0) return "这回收满了";
    if (this.s.region !== "farm") return "回到农场再卖";
    if (!this.hpAcceptsHave(W.buy)) return "手上没有" + this.hpKeyName(W.buy);
    return "";
  }
  caravanSell() {
    const why = this.caravanSellReason();
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const W = this.hp.week;
    let money = 0,
      n = 0;
    for (const id of this.hpAccepts(W.buy)) {
      const left = this.caravanBuyLeft() - n;
      if (left <= 0) break;
      const k = this.rlTake(id, left);
      n += k;
      money += k * Math.round((ITEMS[id]?.sell || 1) * CARAVAN_WEEK.mult);
    }
    if (!n) return false;
    this.s.money += money;
    W.sold = (W.sold || 0) + n;
    this.hpStat("sold", n);
    this.toast("卖给唐九 " + this.hpKeyName(W.buy) + " ×" + n + "：" + money + " 金币（两倍价，还收 " + this.caravanBuyLeft() + " 份）。", "normal");
    this.emit("trade");
    return true;
  }

  // ================= 稀罕货的用处 =================
  // 大号浇水壶：壶里的水少了就从备用水箱续上
  hpTopUp() {
    const c = this.c;
    if (!this.hp?.tank || !c || !(c.water < c.waterCapacity)) return;
    const k = Math.min(this.hp.tank, c.waterCapacity - c.water);
    c.water += k;
    this.hp.tank -= k;
  }
  hpRefillTank() {
    if (this.hpOwn("can")) this.hp.tank = GOOD_FX.can;
  }
  waterTotal() {
    return (this.c?.water || 0) + (this.hp?.tank || 0);
  }
  waterMax() {
    return (this.c?.waterCapacity || 0) + (this.hpOwn("can") ? GOOD_FX.can : 0);
  }
  refillWater() {
    const ok = super.refillWater();
    if (ok) this.hpRefillTank();
    return ok;
  }
  districtRest() {
    const ok = super.districtRest();
    if (ok) this.hpRefillTank();
    return ok;
  }
  brest() {
    const ok = super.brest();
    if (ok) this.hpRefillTank();
    return ok;
  }
  toolPlot(p, id) {
    if (id === "water") this.hpTopUp();
    if (id !== "hoe" || !this.hpOwn("hoe")) return super.toolPlot(p, id);
    const st0 = this.s.player.stamina,
      d = this.plotDebris?.(p),
      ok = super.toolPlot(p, id);
    if (ok) {
      this.s.player.stamina = Math.max(this.s.player.stamina, st0);
      if (d?.type && ITEMS[d.type]) this.receive({ [d.type]: 1 });
    }
    return ok;
  }
  plotAction(p) {
    this.hpTopUp();
    return super.plotAction(p);
  }
  startFishing(bait = false) {
    const free = this.hpOwn("bait");
    const ok = super.startFishing(free ? false : bait);
    if (ok && this.c.fishing) {
      if (free) this.c.fishing.bait = true;
      this.hpBite("pond");
    }
    return ok;
  }
  kinCast(water) {
    const ok = super.kinCast(water);
    if (ok && this.c.fishing) {
      if (this.hpOwn("bait")) this.c.fishing.bait = true;
      this.hpBite(water);
    }
    return ok;
  }
  hpBite(water) {
    const f = this.c.fishing;
    if (!f) return;
    let k = 1;
    if (this.hpOwn("rod")) k *= GOOD_FX.rodBite;
    if (this.shoalOn(water)) k *= SHOAL.bite;
    if (k < 1) f.biteAt = Math.max(0.6, Math.round(f.biteAt * k * 10) / 10);
  }
  reelTick(dt, held) {
    const R = this._reel,
      t0 = R?.tense;
    const out = super.reelTick(dt, held);
    if (R && this._reel === R && this.hpOwn("rod") && R.tense > t0) R.tense = t0 + (R.tense - t0) * GOOD_FX.rodRamp;
    return out;
  }
  handHarvest(p) {
    const crop = p?.crop;
    const ok = super.handHarvest(p);
    if (ok && crop && this.hpOwn("seedbox") && CROPS[crop]?.seed && ITEMS[CROPS[crop].seed] && this.hpRoll("seedbox", p.id, this.s.day, this.s.minute) < GOOD_FX.seedbox) {
      this.receive({ [CROPS[crop].seed]: 1 });
      this.zFloat?.(ITEMS[CROPS[crop].seed].name + " +1", "#cfe7a6");
    }
    return ok;
  }
  // 堆肥机：沤好一袋时多一袋（直接进仓库，堆肥桶里的数照旧）
  compostTick() {
    const before = this.hpOwn("composter") && this.bt ? Object.fromEntries(Object.entries(this.bt.compost).map(([k, r]) => [k, r.out])) : null;
    const out = super.compostTick();
    if (before)
      for (const [k, r] of Object.entries(this.bt.compost))
        if (before[k] != null && r.out > before[k] && FERTS[r.kind]) {
          this.putStorage({ [FERTS[r.kind].id]: GOOD_FX.compost - 1 });
          if (this.o) this.olog("堆肥机多沤出 1 袋" + FERTS[r.kind].name + "（已入仓）。");
        }
    return out;
  }
  jarState(id) {
    if (!this.hpOwn("cellar")) return super.jarState(id);
    const j = this.jarOf(id);
    if (!j?.rec) return { state: "empty" };
    const age = this.s.day - j.rec.start + GOOD_FX.cellar;
    if (age >= j.J.agedDays) return { state: "aged", age };
    if (age >= j.J.ready) return { state: "ready", age, left: j.J.agedDays - age };
    return { state: "brewing", age, left: j.J.ready - age };
  }
  festTier(kind, pay) {
    const t = super.festTier(kind, pay);
    return this.hpOwn("gramophone") ? Math.min(3, t + 1) : t;
  }
  dogFetch(day) {
    if (!this.hpOwn("kennel")) return super.dogFetch(day);
    const c0 = DOG_FETCH.chance;
    DOG_FETCH.chance = c0 + GOOD_FX.kennel;
    try {
      return super.dogFetch(day);
    } finally {
      DOG_FETCH.chance = c0;
    }
  }
  decorOwned() {
    const base = super.decorOwned();
    if (!this.hp) return base;
    return [...base, ...HOPE_DECOR.filter((id) => this.qty(decorItem(id), true) > 0)];
  }
  // 06:00 养蜂箱、拖拉机
  hpMorning() {
    if (this.hpOwn("hive")) {
      const sid = seasonOf(this.s.day).id,
        n = sid === "thaw" || sid === "heat" ? GOOD_FX.hiveWarm : GOOD_FX.hive;
      this.putStorage({ hpHoney: n });
      this.hpStat("honey", n);
    }
    if (this.hpOwn("tractor")) this.tractorPass();
  }
  tractorPass() {
    let weeds = 0,
      rocks = 0,
      tilled = 0;
    const got = {};
    for (const p of this.s.plots) {
      if (!this.isFarmPlot?.(p)) continue;
      const rec = this.g?.plots[p.id];
      if (rec?.w) {
        rec.w = 0;
        weeds++;
        got.fodder = (got.fodder || 0) + 1;
        if (this.g.stats) this.g.stats.weeds++;
      }
      const d = this.plotDebris?.(p);
      if (d) {
        this.s.debris = this.s.debris.filter((x) => x !== d);
        if (ITEMS[d.type]) got[d.type] = (got[d.type] || 0) + 4;
        this.s.stats.cleared++;
        rocks++;
        p.tilled = true;
      }
      if (!p.crop && !p.tilled) {
        p.tilled = true;
        tilled++;
      }
    }
    if (Object.keys(got).length) this.putStorage(got);
    if (weeds || rocks || tilled) {
      this.hpStat("tractor");
      if (this.o) this.olog("拖拉机清早过了一遍田：拔了 " + weeds + " 处草、清了 " + rocks + " 堆杂物、翻好 " + tilled + " 块空田（草料、木石入仓）。");
    }
    return weeds + rocks + tilled;
  }
  // 08:00 鸽子捎信：写信的人得是见过的
  letterOk(L) {
    return !this.hp.letters.includes(L.id) && (!L.need || this.hp.met.includes(L.need));
  }
  doveMorning() {
    if (!this.hpOwn("dove")) return false;
    const day = this.s.day,
      since = day - (this.hp.dove || this.hp.goods.dove || day);
    if (since < DOVE.every) return false;
    const next = LETTERS.find((L) => this.letterOk(L));
    if (!next) return false;
    this.hp.dove = day;
    this.hp.letters.push(next.id);
    this.hpStat("letters");
    this.putStorage(next.gift);
    const text = "鸽子捎回一封信——" + next.from + "：" + next.text + "（信里夹着" + itemsText(next.gift) + "，已入仓）";
    this.toast(text, "normal");
    if (this.o) this.olog(text);
    return true;
  }
  // 账本记下的旧物：在它那片废墟、那种柜子里多一点机会
  rollContainer(o, day = this.s.day) {
    if (o?.hpTier) return this.hopeBox(o, day);
    const res = super.rollContainer(o, day);
    if (!res || !this.hp?.clues.length || o?.rlDepth) return res;
    const region = this.s.region,
      locked = o.ukind === "locked" || o.odds === "locked";
    const want = this.hp.clues.filter((id) => !this.clueFound(id) && OLD[id]?.home?.region === region && (locked || OLD[id].home.kinds.includes(res.kind)) && !res.bundle[id]);
    if (want.length && this.hpRoll("clue", o.id, day) < GOOD_FX.clue) return { ...res, bundle: { ...res.bundle, [want[0]]: 1 } };
    return res;
  }

  // ================= 这周的事 =================
  weekEnsure() {
    const h = this.hp,
      day = this.s.day;
    if (!h || day < START.weekly) return null;
    const w = weekIndex(day);
    if (h.week && h.week.w === w) return h.week;
    const start = w * 7 + 1;
    let kind = weekKind(day);
    // 唐九的商队还没开始来（第一支车队还没到站）：这一周换成清单
    if (kind === "caravan" && !this.caravanOpen()) kind = "list";
    const W = { w, kind, start, st: "soon" };
    if (kind === "traveler") {
      const used = h.log.traveler;
      W.id = TRAVELER_IDS.find((id) => !used.includes(id)) || TRAVELER_IDS[used.length % TRAVELER_IDS.length];
      used.push(W.id);
    } else if (kind === "list") {
      const used = h.log.list;
      W.id = WEEK_LIST_IDS.find((id) => !used.includes(id)) || WEEK_LIST_IDS[used.length % WEEK_LIST_IDS.length];
      used.push(W.id);
      W.got = {};
    } else if (kind === "caravan") {
      const k = h.log.caravan++;
      const pair = CARAVAN_ORDER[k % CARAVAN_ORDER.length],
        goods = [];
      const can = (x) => !goods.includes(x) && (GOODS[x].repeat || !this.hpOwn(x)) && !this.goodNeed(x);
      for (const g of pair) goods.push(can(g) ? g : GOOD_IDS.find((x) => can(x) && !GOODS[x].repeat) || "goldSeeds");
      W.id = "c" + k;
      W.goods = [...new Set(goods)];
      W.buy = CARAVAN_WEEK.buy[k % CARAVAN_WEEK.buy.length];
      W.sold = 0;
    } else {
      const sid = seasonOf(start).id;
      const B = SEASON_BOSSES[sid];
      W.id = sid;
      const there = this.s.visited?.[B.region] || this.d?.unlocked?.[B.region] || this.b?.unlocked?.[B.region];
      W.region = there ? B.region : BOSS_FALLBACK.region;
      W.lair = there ? { ...B.lair } : { ...BOSS_FALLBACK.lair };
      h.log.boss.push(sid);
    }
    h.week = W;
    this.weekTick();
    return W;
  }
  // 这周的事走到哪一步了（按时间）
  weekTick() {
    const W = this.hp?.week;
    if (!W) return;
    const day = this.s.day,
      m = this.s.minute,
      sd = day - W.start + 1;
    if (W.kind === "traveler" && !["done", "gone"].includes(W.st)) {
      if (sd > TRAVEL.stay || (sd === TRAVEL.stay && m >= TRAVEL.leave)) {
        W.st = "gone";
        const T = TRAVELERS[W.id];
        this.toast(T.bye, "normal");
        if (this.o) this.olog(T.bye);
        this.hpPlace();
      } else if ((sd > 1 || m >= TRAVEL.arrive) && W.st !== "here") {
        W.st = "here";
        this.hpMeet(W.id);
        this.toast(TRAVELERS[W.id].name + "到了营门口（东头河边）：" + TRAVELERS[W.id].story[0], "normal");
        this.hpPlace();
      }
    }
    if (W.kind === "list" && !["done", "closed"].includes(W.st)) {
      if (sd > WEEK_LIST_TIME.closeDay || (sd === WEEK_LIST_TIME.closeDay && m >= WEEK_LIST_TIME.close)) {
        const was = W.st;
        W.st = "closed";
        if (was === "open") this.toast("这周的清单「" + WEEK_LISTS[W.id].name + "」收走了，没交满。", "normal");
      } else if (sd > 1 || m >= WEEK_LIST_TIME.open) W.st = "open";
    }
    if (W.kind === "boss" && !["done", "gone"].includes(W.st)) {
      if (sd > BOSS_DAYS[1]) {
        W.st = "gone";
        this.dropSeasonBoss(W);
      } else if (sd >= BOSS_DAYS[0] && W.st !== "on") {
        W.st = "on";
        if (this.s.region === W.region) this.spawnSeasonBoss();
      }
    }
    if (W.kind === "caravan" && W.st !== "gone" && sd > CARAVAN_WEEK.leaveSd) W.st = "gone";
  }
  weekText(W = this.hp?.week) {
    if (!W) return "";
    if (W.kind === "traveler") return TRAVELERS[W.id].name + "要到营门口（第 " + W.start + " 天 09:00 到，待到第 " + (W.start + TRAVEL.stay - 1) + " 天 20:00）";
    if (W.kind === "list") return "重建站上贴了「" + WEEK_LISTS[W.id].name + "」（交满给 " + WEEK_LISTS[W.id].reward.gold + " 金币和一件摆件，到第 " + (W.start + WEEK_LIST_TIME.closeDay - 1) + " 天 22:00）";
    if (W.kind === "caravan") return "唐九第 " + (W.start + CARAVAN_WEEK.arriveSd - 1) + " 天来，带两样稀罕货（" + W.goods.map((g) => GOODS[g].name).join("、") + "），两倍价收" + this.hpKeyName(W.buy);
    const B = SEASON_BOSSES[W.id];
    return B.name + "在" + this.regionName(W.region) + "（第 " + (W.start + BOSS_DAYS[0] - 1) + "–" + (W.start + BOSS_DAYS[1] - 1) + " 天）";
  }
  // 过路人
  travelerReason() {
    const W = this.hp?.week;
    if (!W || W.kind !== "traveler" || W.st !== "here") return "他不在";
    if (this.s.region !== "farm" || dist(this.s.player, TRAVEL.spot) > 150) return "走到他跟前";
    const miss = TRAVELERS[W.id].ask.filter(([k, n]) => this.hpAcceptsHave(k) < n);
    if (miss.length) return "还缺" + miss.map(([k, n]) => this.hpKeyName(k) + " " + (n - this.hpAcceptsHave(k))).join("、");
    return "";
  }
  travelerGive() {
    const why = this.travelerReason();
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const W = this.hp.week,
      T = TRAVELERS[W.id];
    for (const [k, n] of T.ask) this.hpTakeAccepts(k, n);
    W.st = "done";
    this.receive({ [decorItem(T.gift)]: 1 });
    this.hpStat("travelers");
    this.moment("traveler", "过路人 · " + T.name, [T.done, "留下：" + DECOR_BY_ID[T.gift].name + "（摆件，在建设里摆出来）"], { icon: "traveler", who: W.id });
    if (this.o) this.olog(T.name + "：" + T.done, "gold");
    this.emit("quest");
    this.hpPlace();
    return true;
  }
  // 这周的清单（在重建站）
  weekListOpen() {
    const W = this.hp?.week;
    return !!W && W.kind === "list" && W.st === "open";
  }
  weekListReason(key) {
    const W = this.hp?.week;
    if (!this.weekListOpen()) return "这周没有清单";
    const L = WEEK_LISTS[W.id],
      need = L.need.find(([k]) => k === key);
    if (!need) return "清单上没有这一格";
    if ((W.got[key] || 0) >= need[1]) return "这一格交满了";
    if (!this.rlStationHere?.()) return "要站在重建站跟前";
    if (!this.hpAcceptsHave(key)) return "手上没有" + this.hpKeyName(key);
    return "";
  }
  weekListGive(key) {
    const why = this.weekListReason(key);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const W = this.hp.week,
      L = WEEK_LISTS[W.id],
      n = L.need.find(([k]) => k === key)[1];
    const gave = this.hpTakeAccepts(key, n - (W.got[key] || 0));
    if (!gave) return false;
    W.got[key] = (W.got[key] || 0) + gave;
    this.events.push({ type: "stamp", list: W.id, key });
    this._zStamp = { list: W.id, key, at: Date.now() };
    this.toast("交了" + this.hpKeyName(key) + " ×" + gave + "（「" + L.name + "」" + W.got[key] + "/" + n + "）。", "normal");
    if (L.need.every(([k, m]) => (W.got[k] || 0) >= m)) {
      W.st = "done";
      this.s.money += L.reward.gold || 0;
      this.receive({ [decorItem(L.decor)]: 1 });
      this.hpStat("lists");
      this.moment("week", "这周的清单 · " + L.name, ["交满了：" + (L.reward.gold || 0) + " 金币，还有一件「" + DECOR_BY_ID[L.decor].name + "」（摆件）"], { icon: "week" });
      if (this.o) this.olog("这周的清单「" + L.name + "」交满了。", "gold");
      this.emit("quest");
    }
    return true;
  }
  // 季节头目
  seasonBossOn() {
    const W = this.hp?.week;
    return !!W && W.kind === "boss" && W.st === "on";
  }
  spawnSeasonBoss() {
    const W = this.hp?.week;
    if (!this.seasonBossOn() || this.s.region !== W.region || !this.enemies || this.enemies.some((z) => z.hpBoss && !z.dead)) return;
    const B = SEASON_BOSSES[W.id],
      q = this.freePoint?.(W.lair.x, W.lair.y) || W.lair,
      z = this.enemy(B.type, q.x, q.y);
    z.maxHp = Math.round(z.maxHp * B.hp);
    z.hp = z.maxHp;
    Object.assign(z, { hpBoss: W.id, state: "patrol", homeX: q.x, homeY: q.y, sct: 6, pct: BOSSES[B.type]?.pulse?.every || 0, scd: 0, dcd: 2 });
    this.enemies.push(z);
    if (B.type === "nurse")
      for (let i = 0; i < 2; i++) {
        const a = (i / 2) * Math.PI * 2,
          p = this.freePoint?.(q.x + Math.cos(a) * 70, q.y + Math.sin(a) * 46) || q,
          e = this.enemy("slow", p.x, p.y);
        e.pack = "hp:nurse";
        e.escort = true;
        this.enemies.push(e);
      }
    if (W.told !== this.s.day) {
      W.told = this.s.day;
      this.toast("季节头目 · " + B.name + "：" + B.line, "warn");
    }
  }
  dropSeasonBoss(W) {
    const list = this.s.enemies?.[W.region];
    if (Array.isArray(list) && list.some((z) => z.hpBoss)) {
      const keep = list.filter((z) => !z.hpBoss);
      this.s.enemies[W.region] = keep;
      if (this.s.region === W.region) this.enemies = keep;
    }
  }
  afterKill(e) {
    super.afterKill(e);
    if (e?.hpBoss) this.seasonBossDown(e);
  }
  seasonBossDown(e) {
    const W = this.hp?.week;
    if (!W || W.kind !== "boss" || W.st === "done" || W.id !== e.hpBoss) return;
    const B = SEASON_BOSSES[e.hpBoss];
    W.st = "done";
    const first = !(this.hp.bought["trophy:" + e.hpBoss] > 0);
    const bundle = this.rareBundle("boss", e.hpBoss, this.s.day);
    if (first) {
      bundle[B.trophy] = 1;
      this.hp.bought["trophy:" + e.hpBoss] = 1;
    }
    this.s.money += B.gold;
    this.receive(bundle);
    this.hpStat("bosses");
    this.events.push({ type: "bossDown", x: e.x, y: e.y, boss: "season" });
    this.toast("打赢了" + B.name + "：" + B.gold + " 金币、" + itemsText(bundle), "gold");
    if (this.o) this.olog("打赢了季节头目" + B.name + "。", "gold");
  }
  bossBar() {
    const p = this.s.player;
    const z = this.enemies?.find((x) => x.hpBoss && !x.dead && (dist(x, p) < 560 || (x.state === "chase" && dist(x, p) < 900)));
    if (!z) return super.bossBar();
    const B = SEASON_BOSSES[z.hpBoss];
    let note = "";
    if (B.type === "nurse" && this.ut?.intel?.nurse) note = z.act?.kind === "scream" ? "她在吸气——打她一下" : "下一声尖叫 " + Math.max(0, Math.ceil(z.sct || 0)) + " 秒";
    return { kind: B.type, name: B.name, hp: Math.max(0, z.hp), max: z.maxHp, tag: "季节头目" + (z.rage ? " · 发狂" : ""), note };
  }
  // 一包稀有档的好东西（照柜子的稀有那一档抽）
  rareBundle(...key) {
    const r = rngOf(hashOf(this.ut?.seed ?? 1, "hopeRare", ...key));
    const kinds = BOX_KINDS.filter((k) => KINDS[k]);
    const kind = kinds[Math.floor(r() * kinds.length) % kinds.length];
    try {
      const b = { ...this.drawFrom(kind, [0, 0, 1, 0], r).bundle };
      for (const k of Object.keys(b)) if (k.startsWith("bp_") || k === "flashlight") b[k] = 1;
      return b;
    } catch {
      return { parts: 2 };
    }
  }

  // ================= 下午的事 =================
  noonEnsure() {
    const h = this.hp,
      day = this.s.day;
    if (!h || day < START.noon) return null;
    if (h.noon && h.noon.day === day) return h.noon;
    // 长夜那天：只放在农场里的（货郎、营门口的收购、水渠的鱼汛），不用出远门，天黑前都收
    const night = !!this.isLongNight?.(day);
    // 今天废墟里已经有动静的那片、今天的险地：不再放
    const busy = [this.eventToday?.()?.region, this.hazardToday?.()?.region].filter(Boolean);
    const can = (r) => (r === "farm" || !!this.s.visited?.[r]) && !busy.includes(r);
    // 鱼汛只放在这个时节有好鱼的水里（回暖时节溪谷的河里没有，就放水渠）
    const sid = seasonOf(day).id,
      shoalOk = (w) => this.waterOpen?.(w) && this.shoalFish(w, sid).length > 0;
    const ok = night
      ? { shoal: ["canal"].filter(shoalOk) }
      : {
          drop: NOON_REGIONS.drop.filter(can),
          survivor: NOON_REGIONS.survivor.filter(can),
          truck: NOON_REGIONS.truck.filter(can),
          shoal: ["river", "canal"].filter(shoalOk),
        };
    const list = NOON_KINDS.filter(([k]) => k !== h.noonLog.last && (k === "peddler" || k === "buyer" || ok[k]?.length));
    const kind = pickW(list.length ? list : [["peddler", 1]], this.hpRoll("noon", day));
    const N = { day, kind, st: "soon" };
    if (kind === "drop" || kind === "truck" || kind === "survivor") {
      const pool = ok[kind],
        fresh = pool.filter((r) => !h.noonLog.regions.slice(-3).includes(r)),
        use = fresh.length ? fresh : pool;
      N.region = use[Math.floor(this.hpRoll("noonR", day) * use.length) % use.length];
      h.noonLog.regions = [...h.noonLog.regions, N.region].slice(-6);
    }
    if (kind === "drop") {
      N.tier = this.hpRoll("dropT", day) < DROP.precious ? "precious" : "rare";
      N.good = DROP_GOODS[Math.floor(this.hpRoll("dropG", day) * DROP_GOODS.length) % DROP_GOODS.length];
    }
    if (kind === "peddler") N.id = PEDDLER_IDS[h.noonLog.peddler++ % PEDDLER_IDS.length];
    if (kind === "buyer") {
      N.id = BUYER_IDS[h.noonLog.buyer++ % BUYER_IDS.length];
      const B = BUYERS[N.id];
      // 他听说你这儿有：手上（背包加仓库）够收一半的，先挑那几样
      const held = B.want.filter((k) => this.hpStock(k) >= Math.ceil(B.n / 2)),
        wants = held.length ? held : B.want;
      N.item = wants[Math.floor(this.hpRoll("buyW", day) * wants.length) % wants.length];
      N.n = B.n;
      N.got = 0;
      N.region = !night && this.d?.unlocked?.stationMarket ? "stationMarket" : "farm";
    }
    if (kind === "shoal") N.water = ok.shoal[Math.floor(this.hpRoll("shoalW", day) * ok.shoal.length) % ok.shoal.length];
    if (night) N.night = true;
    if (kind === "survivor") N.id = h.noonLog.survivor++ % SURVIVORS.length;
    h.noonLog.last = kind;
    h.noon = N;
    this.noonTick();
    return N;
  }
  noonOn(kind) {
    const N = this.hp?.noon;
    return !!N && N.day === this.s.day && N.st === "on" && (!kind || N.kind === kind);
  }
  noonEnd(N = this.hp?.noon) {
    return N?.kind === "peddler" ? NOON.peddlerEnd : N?.kind === "shoal" ? SHOAL.until : NOON.end;
  }
  noonTick() {
    const N = this.hp?.noon;
    if (!N || N.day !== this.s.day || !N.kind) return;
    const m = this.s.minute,
      end = this.noonEnd(N);
    if (N.st === "soon" && m >= NOON.start) {
      if (m >= end) N.st = "gone";
      else {
        N.st = "on";
        const text = "下午的事 · " + NOON_NAMES[N.kind] + "：" + this.noonText(N) + "。";
        this.toast(text, "normal");
        if (this.o) this.olog(text);
        if (N.kind === "drop" && this.s.region === N.region) this.events.push({ type: "plane" });
        this.hpPlace();
      }
    }
    if ((N.st === "on" || N.st === "done") && m >= end && !N.left) {
      N.left = true;
      if (N.st === "on") {
        N.st = "gone";
        if (N.kind === "survivor" && N.follow) this.toast(SURVIVORS[N.id].name + "等不到天黑，自己摸着走了。", "normal");
      }
      N.follow = false;
      this.hpPlace();
    }
    if (N.kind === "drop" && N.st === "on" && m >= NOON.lateGuards && !N.guarded && this.s.region === N.region && N.x != null) this.dropGuards(N);
  }
  noonText(N = this.hp?.noon) {
    if (!N?.kind) return "";
    const R = N.region ? this.regionName(N.region) : "";
    if (N.kind === "drop") return "一架飞机会从" + R + "上空过，投下一只空投箱（14:00–18:00；16:00 以后会围上来几只感染者）";
    if (N.kind === "peddler") return PEDDLERS[N.id].name + "在营门口路南摆摊（河边的空地上，14:00–19:00）";
    if (N.kind === "buyer") return BUYERS[N.id].name + "在" + (N.region === "farm" ? "营门口" : R) + "收" + this.hpKeyName(N.item) + " " + N.n + " 份，按卖价的两倍半（14:00–18:00）";
    if (N.kind === "shoal") return (N.water === "river" ? "溪谷的河" : "农场的水渠") + "来了鱼汛：14:00–17:00 咬钩快一倍，第一条是好鱼";
    if (N.kind === "survivor") return R + "有人在喊救命：" + SURVIVORS[N.id].name + "（14:00–18:00，带他到这张图的出口）";
    if (N.kind === "truck") return R + "翻了一辆物资车，车上两只柜子（14:00–18:00）";
    return "";
  }
  // 早间广播里那一句（短一点）
  noonRadio(N) {
    if (!N?.kind) return "";
    const R = N.region ? this.regionName(N.region) : "";
    if (N.kind === "drop") return "下午两点" + R + "有空投";
    if (N.kind === "peddler") return "下午两点" + PEDDLERS[N.id].name + "来营门口摆摊";
    if (N.kind === "buyer") return "下午两点有人高价收" + this.hpKeyName(N.item);
    if (N.kind === "shoal") return "下午两点" + (N.water === "river" ? "溪谷的河" : "水渠") + "有鱼汛";
    if (N.kind === "survivor") return "下午两点" + R + "有人困住了";
    if (N.kind === "truck") return "下午两点" + R + "翻了一辆物资车";
    return "";
  }
  weekRadio(W) {
    if (!W) return "";
    if (W.kind === "traveler") return "这周" + TRAVELERS[W.id].name + "要来营门口";
    if (W.kind === "list") return "这周重建站上贴了「" + WEEK_LISTS[W.id].name + "」";
    if (W.kind === "caravan") return "这周唐九带稀罕货来";
    return "这周" + SEASON_BOSSES[W.id].name + "在" + this.regionName(W.region);
  }
  // 空投、物资车、被困的人在这张图的哪儿：离出口远一点，离这张图上已有的东西（柜子、地区的点、事件）都隔开
  noonSpot(N) {
    if (N.x == null) {
      const ex = REGIONS[N.region]?.exit || { x: 120, y: 520 };
      const others = (this.objects || []).filter((o) => !HOPE_OBJECTS.includes(o.type) && !(o.type === "crate" && o.noon));
      let best = null,
        bestGap = -1;
      for (let k = 0; k < 24; k++) {
        const x = Math.round(ex.x + 700 + this.hpRoll("noonX", N.day, k) * 520),
          y = Math.round(260 + this.hpRoll("noonY", N.day, k) * 460),
          q = this.freePoint?.(x, y) || { x, y };
        const gap = Math.min(999, ...others.map((o) => dist(o, q)));
        if (gap > bestGap) {
          best = q;
          bestGap = gap;
        }
        if (gap >= 190) break;
      }
      N.x = Math.round(best?.x ?? 900);
      N.y = Math.round(best?.y ?? 520);
    }
    return { x: N.x, y: N.y };
  }
  dropGuards(N) {
    N.guarded = true;
    for (let i = 0; i < DROP.guards; i++) {
      const a = (i / DROP.guards) * Math.PI * 2,
        p = this.freePoint?.(N.x + Math.cos(a) * 120, N.y + Math.sin(a) * 80) || { x: N.x, y: N.y },
        z = this.enemy(i === 0 ? "runner" : "slow", p.x, p.y);
      z.hpGuard = N.day;
      this.enemies.push(z);
    }
    this.toast("空投箱边上围过来几只感染者。", "warn");
  }
  hopeBox(o, day) {
    const r = rngOf(hashOf(this.ut?.seed ?? 1, "hopeBox", o.id, day)),
      kinds = BOX_KINDS.filter((k) => KINDS[k]),
      kind = KINDS[o.ukind] ? o.ukind : kinds[Math.floor(r() * kinds.length) % kinds.length];
    const odds = o.hpTier === "precious" ? [0, 0, 0, 1] : [0, 0, 1, 0];
    const first = this.drawFrom(kind, odds, r),
      bundle = { ...first.bundle };
    if (r() < 0.5) for (const [k, n] of Object.entries(this.drawFrom(kind, [0, 1, 0, 0], r).bundle)) bundle[k] = (bundle[k] || 0) + n;
    for (const k of Object.keys(bundle)) if (k.startsWith("bp_") || k === "flashlight") bundle[k] = 1;
    if (o.hpGood && ITEMS[o.hpGood]) bundle[o.hpGood] = (bundle[o.hpGood] || 0) + 1;
    return { bundle, tier: o.hpTier, kind };
  }
  openContainer(o) {
    const out = super.openContainer(o);
    const N = this.hp?.noon;
    if (o?.noon && N && N.day === o.noon && N.st === "on" && this.s.opened[o.id]?.day === this.s.day) {
      if (N.kind === "drop") {
        N.st = "done";
        this.hpStat("drops");
        this.hpStat("noons");
      }
      if (N.kind === "truck") {
        N.opened = (N.opened || 0) + 1;
        if (N.opened >= TRUCK.tiers.length) {
          N.st = "done";
          this.hpStat("trucks");
          this.hpStat("noons");
          this.toast("物资车上的两只柜子都翻完了。", "normal");
        }
      }
    }
    return out;
  }
  // 货郎
  peddlerHere() {
    return this.noonOn("peddler") && this.s.region === "farm";
  }
  peddlerOffer(N = this.hp?.noon) {
    const P = PEDDLERS[N?.id];
    if (!P) return null;
    const S = P.sell;
    let item = S.item || null;
    if (S.decor) {
      const pool = DECOR.filter((d) => !(this.qty(decorItem(d.id), true) > 0));
      const list = pool.length ? pool : DECOR;
      item = decorItem(list[Math.floor(this.hpRoll("pedD", N.day) * list.length) % list.length].id);
    }
    if (S.clue) item = "clue";
    return { item, n: S.n || 1, price: S.price };
  }
  peddlerReason(which) {
    const N = this.hp?.noon;
    if (!this.peddlerHere()) return "货郎不在";
    if (dist(this.s.player, PEDDLER_SPOT) > 150) return "走到货摊跟前";
    const P = PEDDLERS[N.id];
    if (which === "sell") {
      if (N.sold) return "已经买过了";
      const o = this.peddlerOffer(N);
      if (o.item === "clue" && !this.ledgerPool().length) return "旧物都找到了";
      if (this.s.money < o.price) return "金币不够（要 " + o.price + "）";
      return "";
    }
    if (N.swapped) return "已经换过了";
    const miss = P.swap.give.filter(([k, n]) => this.hpAcceptsHave(k) < n);
    if (miss.length) return "还缺" + miss.map(([k, n]) => this.hpKeyName(k) + " " + (n - this.hpAcceptsHave(k))).join("、");
    return "";
  }
  peddlerTrade(which) {
    const why = this.peddlerReason(which);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const N = this.hp.noon,
      P = PEDDLERS[N.id];
    if (which === "sell") {
      const o = this.peddlerOffer(N);
      this.hpSpend(o.price);
      N.sold = true;
      if (o.item === "clue") {
        const c = this.ledgerPool()[0];
        if (c) {
          this.hp.clues.push(c);
          this.hpStat("clues");
          this.toast(P.name + "翻出一本旧账：「" + OLD[c].name + "」在" + this.ledgerText(c) + "（档案馆那一页也记上了）。", "normal");
        }
      } else {
        const got = { [o.item]: o.n };
        this.receive(got);
        this.toast("从" + P.name + "那里买了" + itemsText(got) + "，花了 " + o.price + " 金币。", "normal");
      }
    } else {
      for (const [k, n] of P.swap.give) this.hpTakeAccepts(k, n);
      N.swapped = true;
      const got = { ...P.swap.get };
      if (got.keepsake) {
        delete got.keepsake;
        const pool = KEEP_IDS.filter((id) => !(this.qty(id, true) > 0));
        const list = pool.length ? pool : KEEP_IDS;
        got[list[Math.floor(this.hpRoll("pedK", N.day) * list.length) % list.length]] = 1;
      }
      this.receive(got);
      this.toast(P.name + "跟你换了：" + itemsText(got) + "。", "normal");
    }
    this.hpMeet(N.id);
    this.hpStat("peddled");
    if (!N.counted) {
      N.counted = true;
      this.hpStat("noons");
    }
    if (N.sold && N.swapped) N.st = "done";
    // 买了也换了（他那本旧账翻不出东西的时候，换了就算）：从箱底摸一样添头
    if (this.peddlerBoth(N) && !N.bonus) {
      N.bonus = true;
      const b = this.peddlerBonus(N);
      this.receive(b);
      this.hpStat("bonus");
      this.events.push({ type: "rareLoot", x: PEDDLER_SPOT.x, y: PEDDLER_SPOT.y });
      const text = P.name + "看你爽快，从箱底摸出" + itemsText(b) + "塞给你：“添头，拿着。”";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    }
    this.emit("trade");
    return true;
  }
  // 添头只给过日子的东西，不给打仗用的（长夜那天货郎也来）：还没有的旧物摆件、谁的心头好、神秘种子、这个时节的杂交种子
  peddlerBonus(N = this.hp?.noon) {
    const r = (k) => this.hpRoll("pedB", N?.day ?? this.s.day, k),
      pick = (list, k) => list[Math.floor(r(k) * list.length) % list.length];
    const decor = DECOR.filter((d) => !(this.qty(decorItem(d.id), true) > 0)),
      keep = KEEP_IDS.filter((id) => ITEMS[id] && !(this.qty(id, true) > 0)),
      hybrid = GOLD_SEED[seasonOf(N?.day ?? this.s.day).id];
    const opts = [];
    if (decor.length) opts.push({ [decorItem(pick(decor, "d").id)]: 1 });
    if (keep.length) opts.push({ [pick(keep, "k")]: 1 });
    if (ITEMS.seedMystery) opts.push({ seedMystery: 2 });
    if (ITEMS[hybrid]) opts.push({ [hybrid]: 3 });
    return opts.length ? pick(opts, "o") : { kinCandy: 3 };
  }
  peddlerBoth(N = this.hp?.noon) {
    if (!N || N.kind !== "peddler" || !N.swapped) return false;
    if (N.sold) return true;
    const o = this.peddlerOffer(N);
    return o?.item === "clue" && !this.ledgerPool().length;
  }
  // 限时收购
  buyerHere() {
    const N = this.hp?.noon;
    return this.noonOn("buyer") && this.s.region === N.region;
  }
  buyerSpot(N = this.hp?.noon) {
    return N?.region === "farm" ? BUYER.farmSpot : BUYER.spot;
  }
  buyerReason() {
    const N = this.hp?.noon;
    if (!this.buyerHere()) return "收购的人不在";
    if (dist(this.s.player, this.buyerSpot(N)) > 150) return "走到他跟前";
    if (N.got >= N.n) return "收满了";
    if (!this.hpAcceptsHave(N.item)) return "手上没有" + this.hpKeyName(N.item);
    return "";
  }
  buyerSell() {
    const why = this.buyerReason();
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const N = this.hp.noon,
      B = BUYERS[N.id];
    let money = 0,
      n = 0;
    for (const id of this.hpAccepts(N.item)) {
      if (N.got + n >= N.n) break;
      const k = this.rlTake(id, N.n - N.got - n);
      n += k;
      money += k * Math.round((ITEMS[id]?.sell || 1) * BUYER.mult);
    }
    if (!n) return false;
    N.got += n;
    this.s.money += money;
    this.hpStat("sold", n);
    this.hpMeet(N.id);
    if (N.got >= N.n) {
      N.st = "done";
      this.receive(B.bonus);
      this.hpStat("noons");
      this.events.push({ type: "victory" });
      this.toast(B.name + "收满了：这回 " + money + " 金币，又多塞给你" + itemsText(B.bonus) + "。", "gold");
      if (this.o) this.olog(B.name + "的收购收满了。", "gold");
      this.hpPlace();
    } else this.toast("卖给" + B.name + " " + this.hpKeyName(N.item) + " ×" + n + "：" + money + " 金币（还收 " + (N.n - N.got) + " 份）。", "normal");
    this.emit("trade");
    return true;
  }
  // 鱼汛
  shoalOn(water) {
    const N = this.hp?.noon;
    return this.noonOn("shoal") && N.water === water && this.s.minute < SHOAL.until;
  }
  pickFish(water, salt = 0) {
    const base = super.pickFish(water, salt);
    if (!this.shoalOn(water)) return base;
    const N = this.hp.noon,
      sid = seasonOf(this.s.day).id;
    const want = !N.caught || this.hpRoll("shoal", this.s.day, this.s.minute, N.caught) < SHOAL.rare;
    if (!want) return base;
    const list = this.shoalFish(water, sid);
    if (!list.length) return base;
    return list[Math.floor(this.hpRoll("shoalP", this.s.day, N.caught || 0) * list.length) % list.length];
  }
  // 这处水这个时节最好的那一档（有稀有的就是稀有的，没有就少见的；变异的不算）
  shoalFish(water, sid) {
    const pool = FISH_IDS.filter((id) => FISH[id].water === water && FISH[id].name && !FISH[id].mutant && (!FISH[id].seasons || FISH[id].seasons.includes(sid)));
    const rare = pool.filter((id) => FISH[id].tier === "rare");
    return rare.length ? rare : pool.filter((id) => FISH[id].tier === "uncommon");
  }
  reelLand(...args) {
    const R = this._reel;
    const out = super.reelLand(...args);
    const N = this.hp?.noon;
    if (out && R && N && this.noonOn("shoal") && N.water === R.water) {
      N.caught = (N.caught || 0) + 1;
      if (["rare", "uncommon"].includes(FISH[R.sp]?.tier)) this.events.push({ type: "rareLoot", x: this.s.player.x, y: this.s.player.y });
      if (N.caught === 1) {
        this.hpStat("shoals");
        this.hpStat("noons");
      }
    }
    return out;
  }
  // 被困的人
  hpSurvivorGo() {
    const N = this.hp?.noon;
    if (!this.noonOn("survivor") || this.s.region !== N.region || N.follow || !this._hpSurv) return false;
    N.follow = true;
    this._hpSurv.hp = SURVIVOR.hp;
    this.toast(SURVIVORS[N.id].name + "：" + SURVIVORS[N.id].line + " ——带他到这张图的出口（西边）。", "normal");
    return true;
  }
  tickSurvivorHope(dt) {
    const N = this.hp?.noon,
      S = this._hpSurv;
    if (!S || !N || N.kind !== "survivor" || N.st !== "on" || !N.follow || this.s.region !== N.region) return;
    const p = this.s.player,
      o = S.o,
      R = SURVIVOR;
    S.held = Math.max(0, (S.held || 0) - dt);
    S.hitCd = Math.max(0, (S.hitCd || 0) - dt);
    // 踩着你走过的路跟（不会卡在墙角）：你每走出 24 步记一个点
    const trail = (S.trail ||= []);
    const last = trail[trail.length - 1];
    if (!last || dist(last, p) > 24) trail.push({ x: p.x, y: p.y });
    if (trail.length > 80) trail.splice(0, trail.length - 80);
    while (trail.length > 1 && dist(trail[0], o) < 14) trail.shift();
    const d = dist(o, p),
      to = trail.length > 1 && dist(trail[0], o) < d ? trail[0] : p;
    if (S.held <= 0 && d > R.follow) {
      const k = dist(o, to),
        a = Math.atan2(to.y - o.y, to.x - o.x),
        step = Math.min(R.speed * dt, to === p ? d - R.follow : k),
        e = { x: o.x, y: o.y };
      this.moveEntity(e, Math.cos(a) * step, Math.sin(a) * step, true);
      // 真卡住了（墙角挡着）：直接挪到那个点上
      if (Math.hypot(e.x - o.x, e.y - o.y) < step * 0.2 && to !== p) {
        e.x = to.x;
        e.y = to.y;
      }
      o.x = e.x;
      o.y = e.y;
      o.facing = a;
      o.moving = true;
    } else o.moving = false;
    if (S.hitCd <= 0) {
      const z = this.enemies.find((z) => !z.dead && !z.lying && !z.nest && z.type !== "raider" && dist(z, o) < 40);
      if (z) {
        S.hitCd = R.hitCd;
        S.held = R.held;
        S.hp -= R.hit;
        this.effects.push({ x: o.x, y: o.y - 60, text: "被抓住了！", t: 0.8, color: "#f1a28a" });
        this.events.push({ type: "survivorHurt", x: o.x, y: o.y });
        if (S.hp <= 0) {
          N.st = "gone";
          N.follow = false;
          this._hpSurv = null;
          this.objects = this.objects.filter((x) => x !== o);
          this.toast(SURVIVORS[N.id].name + "没能撑到出口……", "warn");
          return;
        }
      }
    }
    const exit = REGIONS[this.s.region]?.exit || { x: 95, y: 523 };
    if (dist(o, exit) < 130) this.survivorSafeHope();
  }
  survivorSafeHope() {
    const N = this.hp.noon,
      V = SURVIVORS[N.id];
    N.st = "done";
    N.follow = false;
    if (this._hpSurv?.o) this.objects = this.objects.filter((x) => x !== this._hpSurv.o);
    this._hpSurv = null;
    const bundle = this.rareBundle("surv", N.day);
    this.addReputation?.(SURVIVOR.rep);
    this.s.money += SURVIVOR.gold;
    this.receive(bundle);
    this.hpMeet(V.id);
    this.hpStat("rescued");
    this.hpStat("noons");
    this.events.push({ type: "rescue" });
    const text = V.name + "安全了：营地声望 +" + SURVIVOR.rep + "，" + SURVIVOR.gold + " 金币，他把身上的" + itemsText(bundle) + "塞给你。";
    this.toast(text, "gold");
    if (this.o) this.olog(text, "gold");
  }
  // 带着人走出这张图：跟得上的算救出来了，没跟上的又躲回去
  travel(id) {
    const N = this.hp?.noon,
      S = this._hpSurv;
    if (N && S && N.kind === "survivor" && N.st === "on" && N.follow && this.s.region === N.region && id !== this.s.region) {
      if (dist(S.o, this.s.player) < 170) this.survivorSafeHope();
      else {
        N.follow = false;
        this.toast(SURVIVORS[N.id].name + "没跟上，又躲回去了。", "warn");
      }
    }
    return super.travel(id);
  }

  // ================= 场景里的东西 =================
  assignRegion() {
    super.assignRegion();
    this.hpPlace();
  }
  hpPlace() {
    const h = this.hp;
    if (!h || !this.objects) return;
    const region = this.s.region,
      N = h.noon,
      W = h.week;
    const keepSurv = this._hpSurv && N?.kind === "survivor" && N.st === "on" && this._hpSurv.day === N.day && this._hpSurv.region === region ? this._hpSurv : null;
    this.objects = this.objects.filter((o) => !HOPE_OBJECTS.includes(o.type) && !(o.type === "crate" && o.noon));
    // 风车、拖拉机：比人高，按前后遮挡排（只是画出来，按 E 选不到）
    if (region === "farm") for (const [id, q] of Object.entries(HOPE_DECO)) if (this.hpOwn(id)) this.objects.push({ type: "hpDeco", kind: id, x: q.x, y: q.y, icon: 0, name: "" });
    if (region === "farm" && W?.kind === "traveler" && W.st === "here") this.objects.push({ type: "hpTraveler", name: TRAVELERS[W.id].name, x: TRAVEL.spot.x, y: TRAVEL.spot.y, icon: 56, who: W.id });
    this._hpSurv = null;
    if (N && N.day === this.s.day && N.st === "on") {
      if (N.kind === "peddler" && region === "farm") this.objects.push(this.peddlerObj(N));
      if (N.kind === "buyer" && region === N.region) {
        const q = this.buyerSpot(N);
        this.objects.push({ type: "hpBuyer", name: BUYERS[N.id].name + " · 收" + this.hpKeyName(N.item), x: q.x, y: q.y, icon: 56, who: N.id, look: BUYERS[N.id].look });
      }
      if (region === N.region && ["drop", "truck", "survivor"].includes(N.kind)) {
        const q = this.noonSpot(N);
        if (N.kind === "drop") {
          this.objects.push({ type: "crate", id: "hpdrop", x: q.x, y: q.y, loot: {}, name: "空投箱", icon: 40, elite: false, ukind: "airdrop", odds: "rare", hpTier: N.tier, hpGood: N.good, noon: N.day });
          if (this.s.minute >= NOON.lateGuards && !N.guarded) this.dropGuards(N);
        }
        if (N.kind === "truck") {
          this.objects.push({ type: "hpTruck", name: "翻倒的物资车", x: q.x, y: q.y, icon: 40 });
          TRUCK.tiers.forEach((tier, i) => this.objects.push({ type: "crate", id: "hptruck-" + i, x: q.x - 50 + i * 100, y: q.y + 50, loot: {}, name: tier === "precious" ? "车厢里的保险柜" : "车斗里的货箱", icon: 40, elite: false, ukind: TRUCK.kinds[i], odds: "rare", hpTier: tier, noon: N.day }));
        }
        if (N.kind === "survivor") {
          const S = keepSurv || { o: { type: "hpSurvivor", name: SURVIVORS[N.id].name, x: q.x, y: q.y, icon: 56, id: "hpsurv" }, hp: SURVIVOR.hp, held: 0, hitCd: 0, day: N.day, region };
          if (!keepSurv) N.follow = false;
          this._hpSurv = S;
          this.objects.push(S.o);
        }
      }
    }
    // 两样都做完的货郎：摊子摆到 19:00 再收
    if (N && N.day === this.s.day && N.st === "done" && N.kind === "peddler" && region === "farm" && !N.left) this.objects.push(this.peddlerObj(N));
    this.spawnSeasonBoss();
  }
  peddlerObj(N) {
    return { type: "hpPeddler", name: PEDDLERS[N.id].name + " · 货摊", x: PEDDLER_SPOT.x, y: PEDDLER_SPOT.y, icon: 56, who: N.id, look: PEDDLERS[N.id].look };
  }
  // 画出来的风车、拖拉机不算“跟前的东西”
  hpNoDeco(fn) {
    const all = this.objects;
    if (!Array.isArray(all) || !all.some((o) => o.type === "hpDeco")) return fn();
    const some = all.filter((o) => o.type !== "hpDeco");
    this.objects = some;
    try {
      return fn();
    } finally {
      // 中间没人动过：原样放回；动过（换了图、加了东西）：照新的来，画出来的那两样补回去
      if (this.objects === some) this.objects = all;
      else if (this.s.region === "farm" && !this.objects.some((o) => o.type === "hpDeco")) this.objects = [...this.objects, ...all.filter((o) => o.type === "hpDeco")];
    }
  }
  nearestObject() {
    return this.hpNoDeco(() => super.nearestObject());
  }
  pickCandidates() {
    return this.hpNoDeco(() => super.pickCandidates());
  }
  context(ob) {
    if (ob && HOPE_OBJECTS.includes(ob.type) && !this.c?.fishing && (this._picked || this.pickCandidates().length < 2)) {
      if (ob.type === "hpTraveler") return ob.name + " · 聊几句";
      if (ob.type === "hpPeddler") return ob.name + " · 看看货";
      if (ob.type === "hpBuyer") return ob.name;
      if (ob.type === "hpSurvivor") return this.hp?.noon?.follow ? ob.name + " · 跟着你走" : ob.name + " · 带他走";
      if (ob.type === "hpTruck") return "翻倒的物资车 · 柜子在车边上";
    }
    if (ob?.type === "partnerDog" && !this.c?.fishing && this.dogReady?.() && (this._picked || this.pickCandidates().length < 2)) return (ob.name || "麦穗") + " · 看看它";
    return super.context(ob);
  }
  interact() {
    if (this.paused) return super.interact();
    const ob = this._picked || (this.c?.fishing ? null : this.nearestObject());
    if (ob && HOPE_OBJECTS.includes(ob.type) && !this.c?.fishing && (this._picked || !this.pickCandidates().length)) {
      const menu = (view) => {
        this.emit("menu", { menu: "outpost", view, id: "" });
        return true;
      };
      if (ob.type === "hpTraveler") return menu("hpTraveler");
      if (ob.type === "hpPeddler") return menu("hpPeddler");
      if (ob.type === "hpBuyer") return menu("hpBuyer");
      if (ob.type === "hpSurvivor") return this.hpSurvivorGo();
      if (ob.type === "hpTruck") {
        this.toast("车翻在路边，车斗和车厢里各有一只柜子：走到柜子跟前按 E。");
        return true;
      }
    }
    // 麦穗跟前按交互：打开它那一页（摸摸、喂、叫它做事）。原来没人接，落到最底下打开了一个空页面
    if (ob?.type === "partnerDog" && !this.c?.fishing && (this._picked || !this.pickCandidates().length) && this.dogReady?.()) {
      this.emit("menu", { menu: "outpost", view: "dog", id: "" });
      return true;
    }
    // 雨水桶边上补水：备用水箱也补满
    const rain = ob?.type === "building" && ob.building?.type === "rain" && ob.building.hp > 0;
    const out = super.interact();
    if (rain && this.c.water >= this.c.waterCapacity) this.hpRefillTank();
    return out;
  }

  // ================= 时间 =================
  workHour() {
    const h = Math.floor(this.s.minute / 60);
    // 二级学堂：带徒、改学每天早上再多算一天（重光那一层之后会把起点拉回 0 以上）
    if (this.hp && h === 6 && this.wall2On("school")) {
      if (this.ss?.apprentice) this.ss.apprentice.start -= WALL2_FX.school;
      if (this.td?.retrain) this.td.retrain.start -= WALL2_FX.school;
    }
    super.workHour();
    if (!this.hp) return;
    this.weekEnsure();
    this.noonEnsure();
    this.weekTick();
    this.noonTick();
    if (h === 6) this.hpMorning();
    // 唐九的商队那一周：第 2 天让他今天来（08:00 到）
    const W = this.hp.week;
    if (h === 7 && W?.kind === "caravan" && this.s.day === W.start + CARAVAN_WEEK.arriveSd - 1 && this.o?.caravan && !this.caravanHere()) this.o.caravan.next = this.s.day;
    if (h === 7) {
      // 早间广播之后：这周的事（周一）、今天下午的事（广播开没开都说一声；全文在任务手记）
      if (W && this.s.day === W.start) this.toast("这周的事 · " + WEEK_NAMES[W.kind] + "：" + this.weekText(W) + "。", "normal");
      const N = this.hp.noon;
      if (N?.kind && N.day === this.s.day && N.st === "soon") this.toast("今天下午的事 · " + NOON_NAMES[N.kind] + "：" + this.noonText(N) + "。", "normal");
    }
    if (h === 8) this.doveMorning();
  }
  morningParts(day = this.s.day) {
    const parts = super.morningParts(day);
    if (!this.hp || day !== this.s.day) return parts;
    const W = this.weekEnsure(),
      N = this.noonEnsure(),
      m = this.marketGood(day),
      tip = this.radioTip(day),
      add = [];
    if (W && day === W.start) add.push(this.weekRadio(W));
    if (N?.kind && N.day === day) add.push(this.noonRadio(N));
    if (m && !m.sold && (day - START.good) % 7 === 0) add.push("旧站商街这周的稀罕货是" + GOODS[m.good].name);
    if (tip) add.push(tip);
    // 要紧的排在前面（广播全文最多 400 字）
    return [...add.filter(Boolean), ...parts];
  }
  update(dt, input = {}) {
    const out = super.update(dt, input);
    // 旧档：第一帧一张“盼头”卡片（更早几版的卡片先放，这一张排在后面）
    const intro = !this.paused && this.hp?.intro;
    if (intro && !intro.told) {
      intro.told = true;
      this.moment("intro", "盼头", INTRO_LINES);
    }
    if (this.hp && Number.isFinite(dt) && dt > 0 && !this.paused) {
      this.hpTopUp();
      this.tickSurvivorHope(Math.min(dt, 0.1));
      // 下午的事、这周的事按钟点准时开始和收（营地的工时钟每 60 分钟才走一下，不一定落在整点上）
      this.weekTick();
      this.noonTick();
    }
    return out;
  }
  // 跳过一段时间（睡觉、赶路、等）以后也照钟点对一遍
  advanceMinutes(n) {
    const out = super.advanceMinutes(n);
    if (this.hp) {
      this.weekTick();
      this.noonTick();
    }
    return out;
  }

  // 收集的三样里程碑登场成卡片：捐给档案馆的旧物（念它的故事）、捡到的残页、修好的检修电梯
  zClassify(text, tone) {
    if (this.hp && this.zx && this.rl && tone === "gold") {
      let m = text.match(/^捐出「(.+?)」：(.+)$/);
      if (m) return { tier: "big", kind: "old", title: "档案馆 · 「" + m[1] + "」", lines: [m[2], "旧物 " + this.rl.old.length + "/" + OLD_IDS.length] };
      m = text.match(/^捡到一张残页「(.+?)」(?:（(.+?)）)?：任务手记里能看。?$/);
      if (m) return { tier: "big", kind: "page", title: "残页「" + m[1] + "」", lines: [(m[2] ? m[2] + "，" : "") + "任务手记里能看", "残页 " + this.rl.pages.length + "/" + PAGE_IDS.length] };
      m = text.match(/^修好了检修电梯：(.+?)。?$/);
      if (m) return { tier: "big", kind: "lift", title: "检修电梯修好了", lines: [m[1] + "。"] };
    }
    return super.zClassify(text, tone);
  }

  // 任务手记最上面“今天”：下午的事、这周的事
  todayItems() {
    const out = super.todayItems();
    if (!this.hp) return out;
    const extra = [],
      N = this.hp.noon,
      W = this.hp.week;
    if (N?.kind && N.day === this.s.day && ["soon", "on"].includes(N.st)) extra.push({ pri: 1, text: (N.st === "on" ? "下午的事 · " : "14:00 · ") + NOON_NAMES[N.kind] + (N.region && N.region !== "farm" ? "（" + this.regionName(N.region) + "）" : N.kind === "peddler" || N.region === "farm" ? "（营门口）" : ""), action: "oView", id: "hpWeek" });
    if (W && ["here", "open", "on"].includes(W.st)) extra.push({ pri: 2, text: "这周 · " + WEEK_NAMES[W.kind] + (W.kind === "traveler" ? " · " + TRAVELERS[W.id].name : W.kind === "list" ? "「" + WEEK_LISTS[W.id].name + "」" : W.kind === "boss" ? " · " + SEASON_BOSSES[W.id].name : ""), action: "oView", id: "hpWeek" });
    return [...out, ...extra].sort((a, b) => a.pri - b.pri).slice(0, 3);
  }

  // ================= 小工具 =================
  hpKeyName(k) {
    if (k === "@fish") return "鱼（什么鱼都行）";
    return ITEMS[k]?.name || k;
  }
  hpAccepts(key) {
    if (key === "@fish") {
      const ids = new Set([...Object.keys(this.s.inventory), ...(this.s.region === "farm" ? Object.keys(this.s.storage) : [])]);
      return [...ids].filter(isFish).sort((a, b) => (ITEMS[a].sell || 0) - (ITEMS[b].sell || 0));
    }
    if (CROPS[key]) return [key, "hardy_" + key, "fine_" + key, "prime_" + key].filter((id) => ITEMS[id]);
    return [key];
  }
  hpStock(key) {
    const ids = key === "@fish" ? [...new Set([...Object.keys(this.s.inventory), ...Object.keys(this.s.storage)])].filter(isFish) : this.hpAccepts(key);
    return ids.reduce((a, id) => a + (this.s.inventory[id] || 0) + (this.s.storage[id] || 0), 0);
  }
  hpAcceptsHave(key) {
    return this.hpAccepts(key).reduce((a, id) => a + (this.s.inventory[id] || 0) + (this.s.region === "farm" ? this.s.storage[id] || 0 : 0), 0);
  }
  hpTakeAccepts(key, n) {
    let left = n;
    for (const id of this.hpAccepts(key)) {
      if (left <= 0) break;
      left -= this.rlTake(id, left);
    }
    return n - left;
  }

  // ================= 存档 =================
  static parse(text) {
    const s = ZestEngine.parse(text);
    migrateState(s);
    validateHope(s);
    return s;
  }
}

function validateHope(s) {
  const h = s.hope,
    bad = (why) => {
      throw new Error("存档里的盼头记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
    };
  if (!h || typeof h !== "object") bad("缺少");
  const int = (v, lo = 0, hi = 1e9) => Number.isInteger(v) && v >= lo && v <= hi,
    obj = (v) => !!v && typeof v === "object" && !Array.isArray(v),
    strs = (a, max, ok) => Array.isArray(a) && a.length <= max && a.every((x) => typeof x === "string" && x.length <= 24 && (!ok || ok(x)));
  if (!int(h.schema, 1, 99)) bad("版本");
  if (!obj(h.wall2) || Object.entries(h.wall2).some(([k, v]) => !WALL2[k] || !int(v))) bad("墙");
  if (!obj(h.expand) || Object.entries(h.expand).some(([k, v]) => !EXPAND[k] || !int(v, 0, EXPAND[k].length))) bad("扩建");
  if (!obj(h.goods) || Object.entries(h.goods).some(([k, v]) => !GOODS[k] || !int(v))) bad("稀罕货");
  if (!obj(h.bought) || Object.keys(h.bought).length > 64 || Object.entries(h.bought).some(([k, v]) => k.length > 24 || !int(v, 0, 9999))) bad("买过的");
  if (!strs(h.clues, OLD_IDS.length, (id) => !!OLD[id])) bad("账本");
  if (!int(h.tank, 0, GOOD_FX.can)) bad("水箱");
  if (h.market !== null && (!obj(h.market) || !int(h.market.k) || !GOODS[h.market.good] || typeof h.market.sold !== "boolean")) bad("商街");
  if (!int(h.marketIdx, 0, MARKET_ORDER.length)) bad("商街");
  if (h.week !== null) {
    const W = h.week;
    if (!obj(W) || !int(W.w) || !WEEK_KINDS.includes(W.kind) || !int(W.start, 1) || typeof W.st !== "string" || W.st.length > 8) bad("这周的事");
    if (W.kind === "traveler" && !TRAVELERS[W.id]) bad("过路人");
    if (W.kind === "list" && (!WEEK_LISTS[W.id] || !obj(W.got) || Object.entries(W.got).some(([k, v]) => k.length > 24 || !int(v, 0, 999)))) bad("清单");
    if (W.kind === "caravan" && (!Array.isArray(W.goods) || W.goods.length > 4 || W.goods.some((g) => !GOODS[g]) || !ITEMS[W.buy] || !int(W.sold || 0, 0, 999))) bad("商队");
    if (W.kind === "boss" && (!SEASON_BOSSES[W.id] || !REGIONS[W.region] || !obj(W.lair) || !Number.isFinite(W.lair.x) || !Number.isFinite(W.lair.y))) bad("头目");
  }
  const L = h.log;
  if (!obj(L) || !strs(L.traveler, 999, (id) => !!TRAVELERS[id]) || !strs(L.list, 999, (id) => !!WEEK_LISTS[id]) || !strs(L.boss, 999, (id) => !!SEASON_BOSSES[id]) || !int(L.caravan)) bad("记录");
  if (h.noon !== null) {
    const N = h.noon;
    if (!obj(N) || !int(N.day) || typeof N.st !== "string" || N.st.length > 8 || (N.kind && !NOON_NAMES[N.kind])) bad("下午的事");
    if (N.region && !REGIONS[N.region]) bad("下午的事");
    if (N.kind === "peddler" && !PEDDLERS[N.id]) bad("货郎");
    if (N.kind === "buyer" && (!BUYERS[N.id] || (!ITEMS[N.item] && N.item !== "@fish") || !int(N.n, 1, 99) || !int(N.got, 0, 99))) bad("收购");
    if (N.kind === "survivor" && !int(N.id, 0, SURVIVORS.length - 1)) bad("被困的人");
    if (N.x != null && (!Number.isFinite(N.x) || !Number.isFinite(N.y))) bad("下午的事");
  }
  const NL = h.noonLog;
  if (!obj(NL) || !strs(NL.regions, 12, (r) => !!REGIONS[r]) || typeof NL.last !== "string" || NL.last.length > 12 || !int(NL.peddler) || !int(NL.buyer) || !int(NL.survivor)) bad("记录");
  if (!strs(h.met, 200)) bad("见过的人");
  if (!strs(h.letters, LETTER_IDS.length, (id) => LETTER_IDS.includes(id))) bad("信");
  if (!int(h.dove)) bad("信");
  if (!obj(h.stats) || Object.values(h.stats).some((v) => !int(v))) bad("记录");
  if (h.intro !== undefined && (!obj(h.intro) || !int(h.intro.day) || typeof h.intro.told !== "boolean")) bad("记录");
}
