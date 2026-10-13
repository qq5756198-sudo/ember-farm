// v0.27.0「丰年」：种菜第二轮。
// 1. 水网：水井、雨水桶、水塔、水渠、蓄水池每天出水、存水；水槽、水渠、喷灌头、雨水桶、水塔按你排的顺序取水浇它管的田。
// 2. 自动化只接无聊的活：照看机（原无人机）照看、浇水、捉虫，不收菜；居民你在农场时只浇水照看，熟了 4 小时没人收才替你收。
// 3. 菜地：堆肥桶和三种肥、番茄豆子多次收获、2×2 巨型作物、田里杂交、神秘种子包、菜地图鉴。
// 4. 菜地的危机：熟菜招来的夜袭、熟了一天不收被偷、天灾前一天的抢收；每日卡里的虫害、早霜、怪南瓜、田鼠真的出现在田里。
// 5. 放鸡下地、生态的三种动物帮菜地、寒潮每 28 天按时来（只有温室里的田能长）、出货箱边的订单板、集市后面林姨的菜园。
// 新进度放在 s.bounty，原来的字段不动。
import {
  Engine as TidyEngine,
  freshState as tidyFresh,
  migrateState as tidyMigrate,
  newGameState as tidyNewGame,
  newGamePlusState as tidyNewGamePlus,
  needsUpgrade as tidyNeedsUpgrade,
  legacyGear,
} from "./tidy.js";
import { hashOf, rngOf } from "./undertow.js";
import { ITEMS, BUILDINGS, CROPS, WORLD } from "./data.js";
import { TRAITS, HORDE_DIRECTIONS } from "./expansion-data.js";
import { CANAL } from "./frontier-data.js";
import { TROUGH_PLOTS } from "./alliance-data.js";
import { CARE, COMBO, CROWS, cropInfo } from "./garden-data.js";
import { KILL_DROPS } from "./undertow-data.js";
import { TARGETS } from "./thief-data.js";
import {
  BOUNTY_SCHEMA,
  WATER,
  CANAL_LEVEL_WATER,
  DRONE,
  RIPE_WAIT,
  CHICKENS,
  ECO_HELP,
  COLD,
  GREENHOUSE_R,
  COLD_FOOD,
  COMPOST,
  FERTS,
  FERT_IDS,
  COMPOST_STUFF,
  REGROW,
  GIANT,
  HYBRID,
  VARIETY_FROM,
  MYSTERY,
  DEX_CROPS,
  DEX,
  RAID,
  THEFT,
  STORM,
  ORDERS,
  ORDER_PEOPLE,
  ORDER_PAY,
  MARKET_GARDEN,
  NEW_CROP_IDS,
} from "./bounty-data.js";

export { legacyGear };
// 读进来之前原样留一份：v0.26 及更早的存档（没有菜地记录）也算
export const needsUpgrade = (text) => {
  if (tidyNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !raw.bounty;
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
const cropName = (c) => CROPS[c]?.name || ITEMS[c]?.name || c;
const STAT_KEYS = ["giants", "hybrids", "regrow", "orders", "compost", "fert", "stolen", "trampled", "rush", "raids", "pecked", "eaten", "mystery", "market"];
const ripeOf = (p) => !!p?.crop && !!CROPS[p.crop] && p.growth >= CROPS[p.crop].grow;
// 第三格是什么：能长巨型的“第一次巨型”，番茄豆子“一茬收满 3 次”，其余“一次连收 5 块”
export const dexThird = (crop) => (GIANT.crops.includes(crop) ? "giant" : REGROW.crops.includes(crop) ? "thrice" : "combo");

const bountyDefaults = () => ({
  schema: BOUNTY_SCHEMA,
  // 水网：今天出了多少、用了多少、没浇上几块；排序和关掉的喷灌头
  net: { day: 0, pool: 0, made: 0, used: 0, missed: 0, order: [...WATER.order], off: [], log: [] },
  // 每块田：fz 施的肥、n 收了几茬（多次收获）、st 被偷走或打坏的份数、mh 田鼠洞、ra 熟了的时刻、pr 脚印那天、tr 被踩那天、hy 杂交苗的两种作物、gi 属于哪棵巨型
  plots: {},
  giants: {},
  compost: {},
  dex: {},
  streak: { crop: "", n: 0, t: -99 },
  chickens: { out: false, until: 0, day: 0, used: 0, pecked: 0 },
  cold: { next: 0, n: 0 },
  raid: { day: 0, n: 0, state: "", report: "" },
  storm: { day: 0, kind: "" },
  orders: { list: [], tore: 0, seq: 0, day: 0 },
  away: 0,
  market: 0,
  daily: { day: 0, id: "" },
  pumpkin: 0,
  mystery: 0,
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
});

export function migrateState(s) {
  tidyMigrate(s);
  if (!s.bounty) {
    s.bounty = bountyDefaults();
    // 旧档：水渠闸门的水位一格折 5 份蓄水；进游戏时说一声水网和照看机的变化（新开的档在下面删掉）
    const level = s.frontier?.canals?.level || 0;
    if (level > 0) s.bounty.net.pool = level * CANAL_LEVEL_WATER;
    s.bounty.intro = { day: s.day || 1, told: false };
  } else {
    const d = bountyDefaults(),
      x = s.bounty;
    s.bounty = {
      ...d,
      ...x,
      net: { ...d.net, ...x.net, order: [...(x.net?.order || d.net.order)], off: [...(x.net?.off || [])], log: (x.net?.log || []).map((r) => ({ ...r })), ...(x.net?.dry ? { dry: [...x.net.dry] } : {}) },
      plots: Object.fromEntries(Object.entries(x.plots || {}).map(([k, v]) => [k, { ...v, hy: v.hy ? [...v.hy] : undefined }])),
      giants: Object.fromEntries(Object.entries(x.giants || {}).map(([k, v]) => [k, { ...v, ids: [...v.ids] }])),
      compost: Object.fromEntries(Object.entries(x.compost || {}).map(([k, v]) => [k, { ...v }])),
      dex: Object.fromEntries(Object.entries(x.dex || {}).map(([k, v]) => [k, { ...v }])),
      streak: { ...d.streak, ...x.streak },
      chickens: { ...d.chickens, ...x.chickens },
      cold: { ...d.cold, ...x.cold },
      raid: { ...d.raid, ...x.raid },
      storm: { ...d.storm, ...x.storm },
      orders: { ...d.orders, ...x.orders, list: (x.orders?.list || []).map((o) => ({ ...o, pay: { ...o.pay } })) },
      daily: { ...d.daily, ...x.daily },
      stats: { ...d.stats, ...x.stats },
    };
    if (x.intro) s.bounty.intro = { ...x.intro };
    for (const k of Object.keys(s.bounty.plots)) if (s.bounty.plots[k].hy === undefined) delete s.bounty.plots[k].hy;
  }
  return s;
}
const fresh = (s) => {
  delete s.bounty;
  migrateState(s);
  delete s.bounty.intro;
  return s;
};
export function freshState() {
  return fresh(tidyFresh());
}
export function newGameState(origin = "farmer") {
  return fresh(tidyNewGame(origin));
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  return fresh(tidyNewGamePlus(old, origin, keep, book));
}

export class Engine extends TidyEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
  }
  get bt() {
    return this.s.bounty;
  }
  btRoll(...key) {
    return rngOf(hashOf(this.ut?.seed || 1, "bt", ...key))();
  }
  btPlot(p) {
    return (this.bt.plots[p.id] ??= {});
  }
  btClean(p) {
    delete this.bt.plots[p.id];
  }
  btStat(k, n = 1) {
    this.bt.stats[k] = Math.min(1e9, (this.bt.stats[k] || 0) + n);
  }
  farmPlots() {
    return this.s.plots.filter((p) => this.isFarmPlot(p));
  }
  dayStart(day = this.s.day) {
    return this.absNow() - this.s.minute + (day - this.s.day) * 1440;
  }

  // ================= 水网 =================
  waterNetOn() {
    return !!this.s.bounty;
  }
  heat() {
    return this.s.weather === "高温";
  }
  rainy() {
    return ["小雨", "暴雨"].includes(this.s.weather);
  }
  canalReady() {
    return !!this.f?.canals && !!this.canalFlow?.().includes(CANAL.goal);
  }
  // 今天的水源：[{kind, name, made, store}]
  netSources() {
    const out = [],
      heat = this.heat(),
      rain = this.rainy();
    if (this.sc?.flags.well) out.push({ kind: "well", name: "旧水井", made: WATER.well, store: 0 });
    const barrels = this.s.buildings.filter((b) => b.type === "rain" && b.hp > 0);
    if (barrels.length) out.push({ kind: "barrel", name: "雨水桶 ×" + barrels.length, made: barrels.length * (rain ? WATER.barrel.rain : heat ? WATER.barrel.heat : WATER.barrel.base), store: barrels.length * WATER.barrel.store });
    if (this.projectDone?.("water")) out.push({ kind: "tower", name: "水塔", made: heat ? WATER.tower.heat : WATER.tower.base, store: 0 });
    if (this.canalReady()) {
      const egret = this.f.species?.includes("egret") ? ECO_HELP.egret : 0;
      out.push({ kind: "canal", name: "水渠（池塘水）" + (egret ? " · 白鹭 +" + egret : ""), made: (heat ? WATER.canal.heat : WATER.canal.base) + egret, store: this.f.canals.mode === "hold" ? WATER.canal.store : 0 });
    }
    if (this.hasPerk?.("cistern")) out.push({ kind: "cistern", name: "蓄水池", made: WATER.cistern.base, store: WATER.cistern.store });
    return out;
  }
  netCap() {
    return this.netSources().reduce((a, x) => a + x.store, 0);
  }
  // 按排好的顺序：每一路管哪些田
  netRoutes() {
    const farm = this.farmPlots(),
      out = [];
    for (const kind of this.bt.net.order) {
      if (kind === "trough" && this.sc?.flags.well) out.push({ kind, name: WATER.names.trough, plots: farm.filter((p) => p.id < TROUGH_PLOTS && !p.rebuildNew) });
      if (kind === "canal" && this.canalReady()) {
        const at = { x: CANAL.x + 50, y: CANAL.y + 40 };
        out.push({ kind, name: WATER.names.canal, plots: farm.filter((p) => dist(p, at) < WATER.canal.r) });
      }
      if (kind === "sprinkler")
        for (const b of this.s.buildings.filter((x) => x.type === "irrigation" && x.hp > 0 && !this.bt.net.off.includes(x.id)))
          out.push({ kind, id: b.id, name: WATER.names.sprinkler, plots: farm.filter((p) => dist(p, b) < WATER.sprinkler.r) });
      if (kind === "barrel")
        for (const b of this.s.buildings.filter((x) => x.type === "rain" && x.hp > 0)) out.push({ kind, id: b.id, name: WATER.names.barrel, plots: farm.filter((p) => dist(p, b) < WATER.barrel.r) });
      if (kind === "tower" && this.projectDone?.("water")) out.push({ kind, name: WATER.names.tower, plots: farm.filter((p) => !p.rebuildNew) });
    }
    return out;
  }
  waterCost(p) {
    return TRAITS[p.trait]?.water || 1;
  }
  // 每天 00:00：出水、把昨天剩下的存起来（存不下的流走）
  netProduce() {
    const n = this.bt.net,
      made = this.netSources().reduce((a, x) => a + x.made, 0),
      keep = Math.min(n.pool || 0, this.netCap());
    // 前几天的账：出了多少、用了多少、几块没浇上
    if (n.day > 0 && n.day < this.s.day) n.log = [{ d: n.day, made: n.made, used: n.used, missed: n.missed || 0 }, ...(n.log || [])].slice(0, WATER.log);
    Object.assign(n, { day: this.s.day, made, kept: keep, pool: keep + made, used: 0, missed: 0, dry: [] });
  }
  // 取水浇田：only = 只跑这几路（每个钟点只跑喷灌头）。熟了的田不浇
  netDistribute(only = null) {
    const n = this.bt.net;
    if (n.day !== this.s.day) this.netProduce();
    let watered = 0;
    const missed = new Set(n.dry || []);
    for (const route of this.netRoutes()) {
      if (only && !only.includes(route.kind)) continue;
      for (const p of route.plots) {
        // 熟了的不再长，不浇（留着水给还在长的）
        if (!p.crop || ripeOf(p) || this.plotWatered(p)) continue;
        const cost = this.waterCost(p);
        if (n.pool >= cost) {
          n.pool -= cost;
          n.used += cost;
          this._netWater = true;
          try {
            this.waterPlot(p);
          } finally {
            this._netWater = false;
          }
          missed.delete(p.id);
          watered++;
        } else missed.add(p.id);
      }
    }
    n.dry = [...missed].slice(0, 200);
    n.missed = n.dry.length;
    return watered;
  }
  // 告示牌上那一行：今天的水够浇几块、你种了几块
  netLine() {
    const n = this.bt.net,
      planted = this.farmPlots().filter((p) => p.crop).length,
      // 种着的田里，水网管得到几块
      covered = new Set(this.netRoutes().flatMap((r) => r.plots.filter((p) => p.crop).map((p) => p.id))),
      // 今天一共有多少水：已经用掉的 + 还剩的；今天还没出水时按水源估
      can = n.day === this.s.day ? n.used + n.pool : this.netSources().reduce((a, x) => a + x.made, 0) + Math.min(n.pool || 0, this.netCap());
    return { can, planted, covered: covered.size, pool: n.pool, made: n.made, used: n.used, missed: n.missed, cap: this.netCap(), rain: this.rainy() };
  }
  netMove(kind, dir) {
    const order = this.bt.net.order,
      i = order.indexOf(kind),
      j = i + dir;
    if (i < 0 || j < 0 || j >= order.length) return false;
    [order[i], order[j]] = [order[j], order[i]];
    this.toast("水网先浇：" + order.map((k) => WATER.names[k]).join(" → ") + "。");
    return true;
  }
  toggleSprinkler(id) {
    const b = this.s.buildings.find((x) => x.id === id && x.type === "irrigation");
    if (!b) return false;
    const off = this.bt.net.off;
    if (off.includes(id)) this.bt.net.off = off.filter((x) => x !== id);
    else this.bt.net.off = [...off, id].slice(-40);
    const on = !this.bt.net.off.includes(id);
    this.toast("喷灌头" + (on ? "打开了：每个钟点从水网取水浇 300 范围内的田。" : "关上了：它管的田要靠别的水路或者你自己浇。"));
    if (on && this.s.region === "farm") this.netDistribute(["sprinkler"]);
    return true;
  }
  // 原来的“管网是否接通”：现在都接在水网上
  irrigationConnected(b) {
    if (!this.bt) return super.irrigationConnected(b);
    return !this.bt.net.off.includes(b.id);
  }
  automationStatus(b) {
    if (!this.bt || b.hp <= 0) return super.automationStatus(b);
    if (b.type === "irrigation") return this.bt.net.off.includes(b.id) ? "关着" : this.bt.net.pool > 0 ? "开着 · 水网里还有 " + this.bt.net.pool + " 份水" : "开着 · 水网今天没水了";
    if (b.type === "drone") {
      if (this.automationBlocked?.(b)) return "停机中";
      if ((b.wear || 0) >= this.droneServiceLimit() && !this.quantityForCost?.("parts", true)) return "要 1 个零件保养";
      if ((this.c.energy || 0) < DRONE.power) return "没电";
      return (this.droneHarvests() ? "你不在农场：替你收菜补种" : "照看、浇水、捉虫") + " · 保养 " + (b.wear || 0) + "/" + this.droneServiceLimit();
    }
    return super.automationStatus(b);
  }

  // ================= 自动化只接无聊的活 =================
  // 你离开农场一整天以上，照看机才替你收菜（照原来的办法收、补种）
  droneHarvests() {
    return !!this.bt?.away && this.s.region !== "farm" && this.absNow() - this.bt.away >= DRONE.away;
  }
  // 居民和加班的人：你在农场时，熟了 4 个钟点没人收才收；你不在就收
  workerMayHarvest(p) {
    if (!this.bt) return true;
    const r = this.bt.plots[p.id];
    if (r?.gi) return false;
    if (p.crop === "hybrid") return true;
    if (this.s.region !== "farm") return true;
    // 你在农场：熟了 4 个钟点没人收的才收，几个人加起来一个钟点只替你收一块
    if (this._btHarvestHour === Math.floor(this.absNow() / 60)) return false;
    return !!r?.ra && this.absNow() - r.ra >= RIPE_WAIT;
  }
  droneHour() {
    if (this.droneHarvests()) return;
    const day = this.s.day;
    for (const b of this.s.buildings.filter((x) => x.type === "drone" && x.hp > 0)) {
      if (this.automationBlocked?.(b)) continue;
      if ((b.wear || 0) >= this.droneServiceLimit() && !this.serviceAutomation(b, false)) continue;
      const list = this.farmPlots()
        .filter((p) => (p.crop || this.g?.plots[p.id]?.w) && !this.bt.plots[p.id]?.gi && dist(p, b) < DRONE.r)
        .sort((a, c) => this.careScore(a) - this.careScore(c));
      let done = 0;
      for (const p of list) {
        if (done >= DRONE.per || (this.c.energy || 0) < DRONE.power) break;
        const rec = this.gRec(p);
        let did = false;
        if (rec.b) {
          this.receive({ grub: rec.b });
          rec.b = 0;
          did = true;
        } else if (rec.w) {
          // 照看也包括拔草（草料入仓）
          rec.w = 0;
          this.putStorage({ fodder: 1 });
          did = true;
        } else if (!ripeOf(p) && !this.plotWatered(p) && this.bt.net.pool >= this.waterCost(p)) {
          this.bt.net.pool -= this.waterCost(p);
          this.bt.net.used += this.waterCost(p);
          this._netWater = true;
          try {
            this.waterPlot(p);
          } finally {
            this._netWater = false;
          }
          did = true;
        } else if (rec.t !== day && !ripeOf(p)) {
          rec.t = day;
          rec.c = clamp(rec.c + CARE.tend, 0, CARE.cap);
          this.g.stats.helped++;
          did = true;
        }
        if (did) {
          this.c.energy = Math.max(0, this.c.energy - DRONE.power);
          done++;
        }
      }
      if (done) b.wear = (b.wear || 0) + 1;
    }
  }

  // ================= 每块田的生长、浇水、照料 =================
  coldActive() {
    if (this._btNoCold) return false;
    return super.coldActive();
  }
  inGreenhouse(p) {
    return this.s.buildings.some((b) => b.type === "greenhouse" && b.hp > 0 && dist(p, b) < GREENHOUSE_R);
  }
  cropGrowthRate(p) {
    if (!this.bt || !p?.crop) return super.cropGrowthRate(p);
    let r;
    const cold = super.coldActive?.() && this.isFarmPlot(p);
    if (cold) {
      this._btNoCold = true;
      try {
        r = super.cropGrowthRate(p);
      } finally {
        this._btNoCold = false;
      }
      // 寒潮里只有温室里的田能长；冬土豆照常长；签了“粮食保障”的温室外长三成五
      if (p.crop !== "winterPotato" && !this.inGreenhouse(p)) r *= this.w?.winter?.priority === "food" ? COLD_FOOD : 0;
    } else r = super.cropGrowthRate(p);
    const fz = this.bt.plots[p.id]?.fz;
    if (fz === "grow") r *= FERTS.grow.grow;
    return r;
  }
  plotWatered(p) {
    if (super.plotWatered(p)) return true;
    return !!(this.bt && p?.crop && this.bt.plots[p.id]?.fz === "water" && p.wateredDay > 0 && p.wateredDay >= this.s.day - 1);
  }
  wateredOn(p, d) {
    return super.wateredOn(p, d) || (this.bt?.plots[p.id]?.fz === "water" && p.wateredDay > 0 && p.wateredDay >= d - 1);
  }
  careParts(p) {
    const parts = super.careParts(p);
    if (this.bt?.plots[p.id]?.fz === "care" && p.crop) parts.push(["提质肥", FERTS.care.care]);
    return parts;
  }
  // 蝴蝶：整片菜地优质几率 +10%
  fineChance(score) {
    const base = super.fineChance(score);
    return this.f?.species?.includes("butterfly") ? Math.min(1, base + ECO_HELP.butterfly) : base;
  }
  // 收成的份数：多次收获的第 2、3 茬六成；被偷、被打坏、田鼠洞的扣掉；图鉴集齐的作物多 1 份
  adjacent(p, crop = p.crop) {
    const a = super.adjacent(p, crop);
    if (!this.bt || this._gPlanting || !this.isFarmPlot?.(p) || !crop || !CROPS[crop]) return a;
    const r = this.bt.plots[p.id];
    let y = a.yield || 0;
    if (r?.n) y -= Math.round(CROPS[crop].yield * (1 - REGROW.yield));
    if (r?.st) y -= r.st;
    if (r?.mh) y -= 1;
    if (this.dexDone(crop)) y += DEX.bonus;
    return { ...a, yield: y };
  }

  // ================= 收 =================
  harvest(p, worker = false) {
    if (!this.bt || !p?.crop || !this.isFarmPlot?.(p)) return super.harvest(p, worker);
    if (p.crop === "hybrid") return this.hybridHarvest(p, worker);
    const r = this.bt.plots[p.id];
    if (r?.gi) {
      if (!worker) this.toast("这是一棵巨型" + cropName(p.crop) + "：要锄 3 下才收得动（对着它按 E）。", "warn");
      return false;
    }
    if (!ripeOf(p)) return super.harvest(p, worker);
    const crop = p.crop,
      trait = p.trait,
      n = r?.n || 0,
      wet = { wateredDay: p.wateredDay, waterUnits: p.waterUnits },
      keepRec = this.g?.plots[p.id] ? { ...this.g.plots[p.id] } : null,
      fineBefore = this.qty("fine_" + crop, true);
    const ok = super.harvest(p, worker);
    if (!ok) return ok;
    if (worker) this._btHarvestHour = Math.floor(this.absNow() / 60);
    const fine = this.qty("fine_" + crop, true) > fineBefore;
    this.dexMark(crop, "h");
    if (fine) this.dexMark(crop, "f");
    if (!worker && this._gHand) this.streakHarvest(crop);
    // 多次收获：番茄、豆子从四成长起，再收两次
    if (REGROW.crops.includes(crop) && n + 1 < REGROW.max) {
      p.crop = crop;
      p.trait = trait;
      p.growth = Math.round(CROPS[crop].grow * REGROW.back);
      p.lastCrop = crop;
      p.soilCharged = true;
      // 收了一茬，地里的水还在
      Object.assign(p, wet);
      if (this.g) this.g.plots[p.id] = { ...(keepRec || {}), c: Math.min(keepRec?.c ?? CARE.base, CARE.cap), pd: this.s.day, t: 0, wd: 0, w: keepRec?.w || 0, b: 0, cv: keepRec?.cv || 0, rot: keepRec?.rot || 0, pk: 0 };
      this.bt.plots[p.id] = { n: n + 1 };
      this.btStat("regrow");
      if (!worker) this.effects?.push({ x: p.x, y: p.y - 50, text: "还能再收 " + (REGROW.max - n - 1) + " 茬", t: 1.2, color: "#cfe7a6" });
    } else {
      if (REGROW.crops.includes(crop) && n + 1 >= REGROW.max) this.dexMark(crop, "g");
      this.btClean(p);
      // 居民、照看机替你收的：仓库里有种子就补种（会换茬）
      if (worker && !p.crop) this.workerReplant(p, crop, trait);
    }
    return ok;
  }
  // 换茬：挑仓库里有种子、和刚收的不一样的作物（地瘦了先种养地的豆子、药草）；都没有就照原样
  workerSeed(p, crop, trait) {
    const has = (id) => !!ITEMS[id] && (this.s.storage[id] || 0) > 0;
    const plain = Object.keys(CROPS).filter((c) => c !== crop && !CROPS[c].hybrid && !CROPS[c].variety && has(CROPS[c].seed));
    if (plain.length) {
      const poor = (p.fertility ?? 65) < 50,
        feed = plain.filter((c) => ["bean", "herb"].includes(c));
      const pool = poor && feed.length ? feed : plain;
      return CROPS[pool.sort((a, b) => (this.s.storage[CROPS[b].seed] || 0) - (this.s.storage[CROPS[a].seed] || 0) || a.localeCompare(b))[0]].seed;
    }
    if (trait && has("seed_" + crop + "_" + trait)) return "seed_" + crop + "_" + trait;
    return has(CROPS[crop]?.seed) ? CROPS[crop].seed : null;
  }
  workerReplant(p, crop, trait) {
    const seed = this.workerSeed(p, crop, trait);
    if (!seed || this.plotDebris(p) || !p.tilled || this.g?.plots[p.id]?.w) return false;
    crop = ITEMS[seed].crop;
    this.s.storage[seed]--;
    if (!this.s.storage[seed]) delete this.s.storage[seed];
    Object.assign(p, { crop, trait: ITEMS[seed].trait || null, growth: 0, wateredDay: 0, waterUnits: 0, soilCharged: false, care: 0, qualityRoll: this.s.stats.planted++ % 5 });
    this.chargeSoil?.(p);
    if (this.g) delete this.g.plots[p.id];
    this.gRec?.(p);
    return true;
  }
  // 一次连收 5 块同一种作物（第三格）
  streakHarvest(crop) {
    const st = this.bt.streak,
      now = this.gClock || 0;
    if (st.crop === crop && now - st.t <= COMBO.window) st.n++;
    else Object.assign(st, { crop, n: 1 });
    st.t = now;
    if (st.n >= DEX.combo && dexThird(crop) === "combo") this.dexMark(crop, "g");
  }
  // 杂交苗：收下来是一包种子
  hybridHarvest(p, worker = false) {
    if (!ripeOf(p)) return false;
    const r = this.bt.plots[p.id] || {},
      parents = (r.hy || []).filter((c) => CROPS[c]),
      roll = this.btRoll("hy", p.id, this.s.day, r.hy?.join("+") || "");
    let out;
    if (roll < HYBRID.trait) {
      const base = parents.find((c) => ITEMS["seed_" + c + "_early"]) || MYSTERY.crops[Math.floor(roll * 97) % MYSTERY.crops.length],
        tr = ["early", "abundant", "hardy"][Math.floor(this.btRoll("hyt", p.id, this.s.day) * 3)];
      out = { ["seed_" + base + "_" + tr]: HYBRID.seeds };
    } else {
      const v = parents.map((c) => VARIETY_FROM[c]).find(Boolean) || NEW_CROP_IDS[Math.floor(this.btRoll("hyv", p.id, this.s.day) * NEW_CROP_IDS.length)];
      out = { [CROPS[v].seed]: HYBRID.seeds };
    }
    if (worker) this.putStorage(out);
    else if (!this.add(out)) return false;
    Object.assign(p, { crop: null, growth: 0, wateredDay: 0, waterUnits: 0, trait: null, soilCharged: false });
    if (this.g) delete this.g.plots[p.id];
    this.btClean(p);
    this.btStat("hybrids");
    const text = "杂交苗收下来是一包种子：" + itemsText(out) + "。";
    if (!worker) {
      this.toast(text, "gold");
      this.particlesAt?.(p.x, p.y - 10, "#ffd76a", 14);
      this.emit("harvest");
    } else if (this.o) this.olog(text);
    return true;
  }
  // 天灾前抢收：长过七成就能收，按长势给份数，不出优质、不留种
  fieldRushReason(p) {
    if (this.s.region !== "farm") return "回到农场再收";
    if (!p?.crop || !CROPS[p.crop] || p.crop === "hybrid") return "这块田没有能抢收的菜";
    if (this.bt.plots[p.id]?.gi) return "巨型作物要锄 3 下";
    if (ripeOf(p)) return "已经熟了，直接收";
    if (p.growth / CROPS[p.crop].grow < STORM.rush) return "长过七成才能抢收";
    return "";
  }
  fieldRushPortions(p) {
    return Math.max(1, Math.floor(CROPS[p.crop].yield * (p.growth / CROPS[p.crop].grow)));
  }
  fieldRush(p) {
    const why = this.fieldRushReason(p);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const crop = p.crop,
      n = this.fieldRushPortions(p),
      out = { [crop]: n };
    if (!this.add(out)) {
      this.toast("背包满了。", "warn");
      return false;
    }
    Object.assign(p, { crop: null, growth: 0, wateredDay: 0, waterUnits: 0, trait: null, lastCrop: crop, soilCharged: false });
    if (this.g) delete this.g.plots[p.id];
    this.btClean(p);
    this.btStat("rush");
    this.s.stats.harvested++;
    this.xp?.("agriculture", 3);
    this.effects?.push({ x: p.x, y: p.y - 34, text: "抢收 " + cropName(crop) + " +" + n, t: 1.1, color: "#eef3c4" });
    this.toast("抢收了" + cropName(crop) + " ×" + n + "（还没全熟，少收一些）。");
    this.emit("harvest");
    return true;
  }

  // ================= 种：神秘种子包 =================
  seedOptions(p) {
    return super.seedOptions(p).filter((o) => CROPS[o.crop] && !CROPS[o.crop].hybrid);
  }
  mysteryCount() {
    return (this.s.inventory.seedMystery || 0) + (this.s.region === "farm" ? this.s.storage.seedMystery || 0 : 0);
  }
  mysteryRoll(p) {
    const r = this.btRoll("mys", p.id, this.s.day, this.bt.mystery),
      pick = (list, x) => list[Math.floor(x * list.length) % list.length];
    if (r < MYSTERY.normal) return { crop: pick(MYSTERY.crops, r / MYSTERY.normal), trait: null };
    if (r < MYSTERY.normal + MYSTERY.trait) {
      const x = (r - MYSTERY.normal) / MYSTERY.trait;
      return { crop: pick(MYSTERY.crops, x), trait: pick(["early", "abundant", "hardy"], (x * 7) % 1) };
    }
    return { crop: pick(NEW_CROP_IDS, (r - MYSTERY.normal - MYSTERY.trait) / MYSTERY.variety), trait: null };
  }
  plantMystery(plotId) {
    const p = this.plotById(plotId),
      why = this.pickReason(p);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    if (!this.mysteryCount()) {
      this.toast("没有神秘种子包了。", "warn");
      return false;
    }
    return this.fromMenu(() => this.toolPlot(p, "seedMystery"));
  }
  toolPlot(p, id) {
    if (id === "seedMystery" && this.bt && p && !this.isFarmPlot?.(p)) {
      this.toast("神秘种子包只能种在农场的田里。", "warn");
      return false;
    }
    if (id !== "seedMystery" || !this.bt || !this.isFarmPlot?.(p)) return super.toolPlot(p, id);
    if (p.crop || !p.tilled || this.plotDebris(p) || this.paused) return super.toolPlot(p, id);
    if (this.g?.plots[p.id]?.w) {
      this.toast("这块地长了草：先按 E 拔草，再播种。", "warn");
      return false;
    }
    const from = (this.s.inventory.seedMystery || 0) > 0 ? "inventory" : this.s.region === "farm" && (this.s.storage.seedMystery || 0) > 0 ? "storage" : null;
    if (!from) {
      this.toast("没有神秘种子包了。", "warn");
      return false;
    }
    const pick = this.mysteryRoll(p),
      seed = pick.trait ? "seed_" + pick.crop + "_" + pick.trait : CROPS[pick.crop].seed;
    // 把种子包换成拆出来的那种种子，照正常的办法种下
    this.s[from].seedMystery--;
    if (!this.s[from].seedMystery) delete this.s[from].seedMystery;
    this.s.inventory[seed] = (this.s.inventory[seed] || 0) + 1;
    let ok = false;
    try {
      ok = super.toolPlot(p, seed);
    } finally {
      if (!ok) {
        this.s.inventory[seed]--;
        if (!this.s.inventory[seed]) delete this.s.inventory[seed];
        this.s[from].seedMystery = (this.s[from].seedMystery || 0) + 1;
      }
    }
    if (ok) {
      this.bt.mystery++;
      this.btStat("mystery");
      const name = (pick.trait ? TRAITS[pick.trait].name : "") + cropName(pick.crop),
        rare = !!CROPS[pick.crop].variety || !!pick.trait;
      this.toast("拆开神秘种子包：是" + name + "！" + (CROPS[pick.crop].variety ? "（新品种）" : ""), rare ? "gold" : "normal");
      this.effects?.push({ x: p.x, y: p.y - 40, text: name, t: 1.4, color: rare ? "#ffd76a" : "#eef3c4" });
    }
    return ok;
  }

  // ================= 堆肥桶和肥 =================
  compostRec(id) {
    return (this.bt.compost[id] ??= { kind: "grow", n: 0, ready: 0, out: 0 });
  }
  compostStuff() {
    const crops = Object.keys(CROPS).filter((c) => ITEMS[c] && !CROPS[c].hybrid);
    return [...COMPOST_STUFF, ...crops].filter((id) => ITEMS[id] && this.qty(id, true) > 0);
  }
  compostReason(id, item) {
    const b = this.s.buildings.find((x) => x.id === id && x.type === "compost");
    if (!b || b.hp <= 0) return "堆肥桶坏了";
    if (this.s.region !== "farm") return "回到农场再弄";
    const r = this.compostRec(id);
    if (r.ready) return "正在沤，明早 06:00 出肥";
    if (r.out >= COMPOST.max) return "先把沤好的肥取出来";
    if (item && !(COMPOST_STUFF.includes(item) || (CROPS[item] && !CROPS[item].hybrid))) return "这样东西不能沤肥";
    if (item && this.qty(item, true) < 1) return "没有" + (ITEMS[item]?.name || item);
    return "";
  }
  compostAdd(id, item, n = 1) {
    const why = this.compostReason(id, item);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const r = this.compostRec(id),
      k = Math.max(1, Math.min(n, COMPOST.batch - r.n, this.qty(item, true)));
    if (!this.takeFarm({ [item]: k })) return false;
    r.n += k;
    if (r.n >= COMPOST.batch) {
      r.n = COMPOST.batch;
      r.ready = this.dayStart(this.s.day + 1) + COMPOST.ready;
      this.toast("堆肥桶满了：明早 06:00 出 1 袋" + FERTS[r.kind].name + "。", "gold");
    } else this.toast("丢进去 " + (ITEMS[item]?.name || item) + " ×" + k + "（" + r.n + "/" + COMPOST.batch + "）。");
    return true;
  }
  compostKind(id, kind) {
    if (!FERTS[kind]) return false;
    const r = this.compostRec(id);
    if (r.ready) {
      this.toast("已经在沤了，明天再换。", "warn");
      return false;
    }
    r.kind = kind;
    this.toast("这一桶沤成" + FERTS[kind].name + "：" + FERTS[kind].text + "。");
    return true;
  }
  compostTake(id) {
    const r = this.compostRec(id);
    if (!r.out || this.s.region !== "farm") return false;
    const out = { [FERTS[r.kind].id]: r.out };
    this.putStorage(out);
    this.toast("取出 " + itemsText(out) + "（已入仓）。在田边按 E 打开那块田施肥。", "gold");
    r.out = 0;
    return true;
  }
  compostTick() {
    const now = this.absNow();
    for (const [id, r] of Object.entries(this.bt.compost)) {
      if (!this.s.buildings.some((b) => b.id === id && b.type === "compost")) {
        delete this.bt.compost[id];
        continue;
      }
      if (r.ready && now >= r.ready) {
        r.ready = 0;
        r.n = 0;
        r.out = Math.min(COMPOST.max, r.out + 1);
        this.btStat("compost");
        if (this.o) this.olog("堆肥桶沤好了 1 袋" + FERTS[r.kind].name + "。");
      }
    }
  }
  fertReason(p, kind) {
    if (this.s.region !== "farm") return "回到农场再施";
    if (!p?.crop || p.crop === "hybrid") return "种上作物再施肥";
    if (!FERTS[kind]) return "没有这种肥";
    if (this.bt.plots[p.id]?.fz) return "这一茬已经施过" + FERTS[this.bt.plots[p.id].fz].name;
    if (ripeOf(p)) return "熟了，不用施了";
    if (this.qty(FERTS[kind].id, true) < 1) return "没有" + FERTS[kind].name + "（堆肥桶沤）";
    return "";
  }
  applyFert(p, kind) {
    const why = this.fertReason(p, kind);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    if (!this.takeFarm({ [FERTS[kind].id]: 1 })) return false;
    this.btPlot(p).fz = kind;
    this.btStat("fert");
    this.particlesAt?.(p.x, p.y, kind === "water" ? "#7fb7c9" : kind === "care" ? "#ffd76a" : "#9cc46a", 10);
    this.toast("给" + cropName(p.crop) + "施了" + FERTS[kind].name + "：" + FERTS[kind].text + "。");
    return true;
  }

  // ================= 巨型作物 =================
  giantBlock(p) {
    if (!GIANT.crops.includes(p.crop)) return null;
    const side = (a, dx, dy) => this.adj(a).find((q) => Math.abs(q.x - a.x - dx) < 8 && Math.abs(q.y - a.y - dy) < 8);
    const right = this.adj(p).find((q) => Math.abs(q.y - p.y) < 8 && q.x > p.x);
    const down = this.adj(p).find((q) => Math.abs(q.x - p.x) < 8 && q.y > p.y);
    if (!right || !down) return null;
    const diag = side(right, 0, down.y - p.y);
    if (!diag) return null;
    const four = [p, right, down, diag];
    if (four.some((q) => q.crop !== p.crop || !ripeOf(q) || this.bt.plots[q.id]?.gi || !this.isFarmPlot(q) || this.careScore(q) < GIANT.care)) return null;
    return four;
  }
  giantMorning() {
    const day = this.s.day;
    let made = 0;
    for (const p of this.farmPlots()) {
      const four = p.crop && !this.bt.plots[p.id]?.gi ? this.giantBlock(p) : null;
      if (!four || this.btRoll("giant", day, p.id) >= GIANT.chance) continue;
      const id = String(p.id);
      this.bt.giants[id] = { crop: p.crop, ids: four.map((q) => q.id), day, hits: 0, lost: 0 };
      for (const q of four) this.btPlot(q).gi = id;
      made++;
      const text = "清晨，四块" + cropName(p.crop) + "长成了一棵巨型" + cropName(p.crop) + "！要锄 3 下才收得动；熟着放在地里，夜里会招来感染者。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    }
    return made;
  }
  giantOf(p) {
    const id = this.bt?.plots[p?.id]?.gi;
    return id ? this.bt.giants[id] || null : null;
  }
  giantHit(p) {
    const g = this.giantOf(p);
    if (!g || this.s.region !== "farm") return false;
    const plots = g.ids.map((id) => this.plotById(id)).filter(Boolean);
    g.hits++;
    this.s.player.stamina = Math.max(0, this.s.player.stamina - 2);
    this.actionAnim = 0.3;
    this.particlesAt?.(p.x, p.y, "#c9a46a", 10);
    this.emit("hoe");
    if (g.hits < GIANT.hits) {
      this.effects?.push({ x: p.x, y: p.y - 40, text: "再锄 " + (GIANT.hits - g.hits) + " 下", t: 0.8, color: "#eef3c4" });
      return true;
    }
    const crop = g.crop,
      n = Math.max(4, GIANT.yield[0] + Math.floor(this.btRoll("gy", g.day, g.ids[0]) * (GIANT.yield[1] - GIANT.yield[0] + 1)) - (g.lost || 0)),
      out = { [crop]: n, ["giant_" + crop]: 1 };
    this.receive(out);
    for (const q of plots) {
      Object.assign(q, { crop: null, growth: 0, wateredDay: 0, waterUnits: 0, trait: null, lastCrop: crop, soilCharged: false });
      if (this.g) delete this.g.plots[q.id];
      this.btClean(q);
    }
    delete this.bt.giants[g.ids[0]];
    for (const [k, v] of Object.entries(this.bt.giants)) if (v === g) delete this.bt.giants[k];
    this.dexMark(crop, "h");
    this.dexMark(crop, "g");
    this.btStat("giants");
    this.s.stats.harvested++;
    this.xp?.("agriculture", 20);
    this.particlesAt?.(p.x + 20, p.y + 20, "#ffd76a", 30);
    this.effects?.push({ x: p.x + 20, y: p.y - 30, text: "巨型" + cropName(crop) + "！+" + n, t: 1.6, color: "#ffd76a" });
    this.toast("收下了巨型" + cropName(crop) + "：" + itemsText(out) + "。巨型的那一个能拿去收获展（一棵顶一组）。", "gold");
    this.emit("harvest");
    return true;
  }

  // ================= 田里杂交 =================
  hybridNight() {
    const day = this.s.day,
      y = day - 1,
      farm = this.farmPlots();
    let made = 0;
    const spots = (q) => this.adj(q).filter((x) => x.tilled && !x.crop && !this.plotDebris(x) && !this.g?.plots[x.id]?.w && this.isFarmPlot(x));
    for (const p of farm) {
      if (made >= HYBRID.max) break;
      if (!p.crop || p.crop === "hybrid" || !this.wateredOn(p, y)) continue;
      for (const q of this.adj(p)) {
        if (made >= HYBRID.max) break;
        if (q.id <= p.id || !q.crop || q.crop === p.crop || q.crop === "hybrid" || !this.wateredOn(q, y)) continue;
        if (this.btRoll("hyb", day, p.id, q.id) >= HYBRID.chance) continue;
        const free = [...spots(p), ...spots(q)].filter((x) => !x.crop);
        if (!free.length) continue;
        const at = free[Math.floor(this.btRoll("hybs", day, p.id, q.id) * free.length) % free.length];
        Object.assign(at, { crop: "hybrid", growth: 0, trait: null, wateredDay: 0, waterUnits: 0, soilCharged: true });
        this.bt.plots[at.id] = { hy: [p.crop, q.crop] };
        if (this.g) delete this.g.plots[at.id];
        made++;
        const text = "夜里，" + cropName(p.crop) + "和" + cropName(q.crop) + "挨着的空地上冒出一棵杂交苗：照常浇水，长大了收下来是一包种子。";
        this.toast(text, "gold");
        if (this.o) this.olog(text, "gold");
      }
    }
    return made;
  }

  // ================= 菜地图鉴 =================
  dexMark(crop, cell) {
    if (!DEX_CROPS.includes(crop)) return false;
    const d = (this.bt.dex[crop] ??= {});
    if (d[cell]) return false;
    d[cell] = this.s.day;
    if (this.dexDone(crop)) {
      const text = "菜地图鉴：" + cropName(crop) + "一行集齐了！以后每次收" + cropName(crop) + "多 1 份。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
      this.emit("quest");
    }
    return true;
  }
  dexDone(crop) {
    const d = this.bt?.dex[crop];
    return !!d && !!d.h && !!d.f && !!d.g;
  }

  // ================= 按 E =================
  plotAction(p) {
    if (this.bt) {
      if (this.giantOf(p)) return this.giantHit(p);
      if (p.crop === "hybrid" && ripeOf(p)) return this.hybridHarvest(p);
    }
    return super.plotAction(p);
  }
  plotContext(p) {
    if (this.bt) {
      const g = this.giantOf(p);
      if (g) return "巨型" + cropName(g.crop) + " · 按 E 锄（" + g.hits + "/" + GIANT.hits + "）";
      if (p.crop === "hybrid") return ripeOf(p) ? "收杂交苗（一包种子）" : "杂交苗 · " + Math.floor((p.growth / CROPS.hybrid.grow) * 100) + "%" + (this.plotWatered(p) ? "" : " · 要浇水");
    }
    return super.plotContext(p);
  }

  // ================= 放鸡下地 =================
  coop() {
    return this.s.buildings.find((b) => b.type === "coop" && b.hp > 0) || null;
  }
  chickenReason() {
    const ch = this.bt.chickens,
      m = this.s.minute;
    if (!this.coop()) return "先建鸡舍";
    if (!this.c.animals?.chicken) return "还没有鸡（去居民区把走失的鸡救回来）";
    if (this.s.region !== "farm") return "回到农场再放";
    if (ch.out) return "鸡已经在田里了";
    if (m < CHICKENS.from || m >= CHICKENS.to) return "白天 06:00–18:00 才放";
    if (ch.day === this.s.day && ch.used >= CHICKENS.hours * 60) return "今天已经放够 " + CHICKENS.hours + " 个钟点了";
    return "";
  }
  releaseChickens() {
    const why = this.chickenReason();
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const ch = this.bt.chickens;
    if (ch.day !== this.s.day) Object.assign(ch, { day: this.s.day, used: 0 });
    const left = CHICKENS.hours * 60 - ch.used,
      until = Math.min(this.absNow() + left, this.dayStart() + CHICKENS.to);
    Object.assign(ch, { out: true, until });
    this.toast("把鸡放进了田里：鸡舍 " + CHICKENS.r + " 步内，每个钟点吃掉一只虫或一处草（偶尔会啄掉一棵苗）。");
    return true;
  }
  recallChickens() {
    const ch = this.bt.chickens;
    if (!ch.out) return false;
    ch.out = false;
    this.toast("鸡赶回窝里了。");
    return true;
  }
  chickenHour() {
    const ch = this.bt.chickens,
      coop = this.coop();
    if (!ch.out) return;
    if (!coop || !this.c.animals?.chicken || this.absNow() >= ch.until || this.s.minute >= CHICKENS.to || this.s.minute < CHICKENS.from) {
      ch.out = false;
      return;
    }
    ch.used = Math.min(CHICKENS.hours * 60, ch.used + 60);
    const near = this.farmPlots().filter((p) => dist(p, coop) < CHICKENS.r);
    // 一天一成机会啄掉一棵苗
    if (ch.pecked !== this.s.day && this.btRoll("peck", this.s.day) < CHICKENS.peck) {
      ch.pecked = this.s.day;
      const young = near.filter((p) => p.crop && CROPS[p.crop] && p.crop !== "hybrid" && !this.bt.plots[p.id]?.gi && p.growth / CROPS[p.crop].grow < CHICKENS.seedling);
      if (young.length) {
        const p = young[Math.floor(this.btRoll("peckp", this.s.day) * young.length) % young.length],
          crop = p.crop;
        Object.assign(p, { crop: null, growth: 0, wateredDay: 0, waterUnits: 0, trait: null, soilCharged: false });
        if (this.g) delete this.g.plots[p.id];
        this.btClean(p);
        this.btStat("pecked");
        const text = "田里的鸡啄掉了一棵" + cropName(crop) + "苗。";
        this.toast(text, "warn");
        if (this.o) this.olog(text, "warn");
      }
    }
    const bug = near.find((p) => this.g?.plots[p.id]?.b),
      weed = near.find((p) => this.g?.plots[p.id]?.w);
    if (bug) {
      this.g.plots[bug.id].b--;
      this.btStat("eaten");
      this.effects?.push({ x: bug.x, y: bug.y - 30, text: "鸡吃掉一只菜青虫", t: 1, color: "#e4f0a8" });
    } else if (weed) {
      this.g.plots[weed.id].w = 0;
      this.btStat("eaten");
      this.effects?.push({ x: weed.x, y: weed.y - 30, text: "鸡把草啄干净了", t: 1, color: "#cfe7a6" });
    }
    if (ch.used % 120 === 0) this.putStorage({ manure: 1 });
  }
  chickensOut() {
    return !!this.bt?.chickens.out;
  }
  // 鸡舍领蛋时一起领鸡粪
  collectAnimals() {
    const had = Object.keys(this.c.animals?.ready || {}).length;
    const ok = super.collectAnimals();
    if (ok && had && this.bt) this.putStorage({ manure: 1 });
    return ok;
  }
  // 鸡蛋算伙食里的一种菜：晚饭时仓库里有蛋就端上一盘（记进今晚的菜色，生活水准当晚就算）
  serveDinner() {
    this._btEgg = !!this.bt && !!this.w && (this.s.storage.egg || 0) > 0;
    try {
      return super.serveDinner();
    } finally {
      this._btEgg = false;
    }
  }
  takeMeal() {
    if (this._btEgg && this._mealTypes) {
      this._btEgg = false;
      if ((this.s.storage.egg || 0) > 0 && !this._mealTypes.has("egg")) {
        this.s.storage.egg--;
        if (!this.s.storage.egg) delete this.s.storage.egg;
        this._mealTypes.add("egg");
      }
    }
    return super.takeMeal();
  }

  // ================= 生态：青蛙吃虫 =================
  frogMorning() {
    if (!this.f?.species?.includes("frog")) return;
    let n = 0;
    for (const p of this.farmPlots()) {
      const rec = this.g?.plots[p.id];
      while (rec?.b && n < ECO_HELP.frog) {
        rec.b--;
        n++;
      }
      if (n >= ECO_HELP.frog) break;
    }
    if (n && this.s.region === "farm") this.toast("生态修复区的青蛙吃掉了 " + n + " 只菜青虫。");
  }

  // ================= 寒潮按时来 =================
  coldSchedule() {
    const wi = this.w?.winter,
      c = this.bt.cold;
    // 主线那场寒潮所在的第七段过去以后才按时来（第七段的“熬过寒潮”不会被翻回去）
    if (!wi || wi.phase !== "done" || (this.sc?.act || 1) < 8) return;
    if (!c.next) c.next = Math.max(this.s.day + COLD.every / 4, (wi.coldDay || this.s.day) + COLD.every);
    if (this.s.day < c.next - COLD.warn) return;
    const days = Math.min(COLD.max, COLD.first + COLD.step * c.n),
      coldDay = Math.max(this.s.day + 1, c.next);
    Object.assign(wi, { phase: "prep", prepDay: this.s.day, coldDay, endDay: coldDay + days, lit: false });
    c.n++;
    c.next = coldDay + COLD.every;
    const text = "霜降：第 " + coldDay + " 天清晨寒潮又到，持续 " + days + " 天。只有温室里的田能长（冬土豆照长），火炉每天烧柴。";
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
  }
  coldNext() {
    const wi = this.w?.winter;
    if (!wi) return null;
    if (wi.phase === "prep") return { day: wi.coldDay, days: wi.endDay - wi.coldDay, now: false };
    if (wi.phase === "cold") return { day: wi.coldDay, days: wi.endDay - wi.coldDay, now: true };
    if (this.bt.cold.next) return { day: this.bt.cold.next, days: Math.min(COLD.max, COLD.first + COLD.step * this.bt.cold.n), now: false };
    return null;
  }

  // ================= 天灾：前一天说，第二天真的打坏 =================
  tomorrowWeather() {
    const fc = this.forecast?.() || [];
    return fc.find((d) => d.day === this.s.day + 1)?.weather || "";
  }
  stormWarn() {
    const w = this.tomorrowWeather(),
      wi = this.w?.winter,
      frost = wi?.phase === "prep" && wi.coldDay === this.s.day + 1;
    const kind = frost ? "frost" : w === "酸雨" ? "acid" : w === "暴雨" ? "storm" : "";
    if (!kind) return;
    this.bt.storm = { day: this.s.day + 1, kind };
    const risky = this.farmPlots().filter((p) => p.crop && CROPS[p.crop] && p.crop !== "hybrid" && p.growth / CROPS[p.crop].grow >= STORM.rush).length;
    const text =
      (kind === "frost" ? "明早寒潮到，夜里要打霜：温室外没盖布的菜长势退回一半" : kind === "acid" ? "明天酸雨：长过七成又没盖布的菜，每块少收 1 份" : "明天暴雨：熟了没盖布的菜，每块少收 1 份") +
      (risky ? "。有 " + risky + " 块长过七成，今天可以抢收（在田边按 E 打开那块田）或者盖布。" : "。");
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
  }
  stormMorning() {
    const st = this.bt.storm;
    if (st.day !== this.s.day || !st.kind) return;
    let n = 0;
    for (const p of this.farmPlots()) {
      if (!p.crop || !CROPS[p.crop] || p.crop === "hybrid") continue;
      const rec = this.g?.plots[p.id];
      if (rec?.cv >= this.s.day) continue;
      const ratio = p.growth / CROPS[p.crop].grow;
      if (st.kind === "acid" && ratio >= STORM.rush) {
        this.btPlot(p).st = (this.bt.plots[p.id].st || 0) + 1;
        n++;
      } else if (st.kind === "storm" && ratio >= 1) {
        this.btPlot(p).st = (this.bt.plots[p.id].st || 0) + 1;
        n++;
      } else if (st.kind === "frost" && !this.inGreenhouse(p) && p.crop !== "winterPotato" && p.growth > 0) {
        p.growth = Math.round(p.growth * COLD.frost);
        n++;
      }
    }
    const kind = st.kind;
    st.kind = "";
    if (n) {
      const text = { acid: "酸雨打坏了 ", storm: "暴雨打坏了 ", frost: "夜里打霜，冻坏了 " }[kind] + n + " 块菜。";
      this.toast(text, "warn");
      if (this.o) this.olog(text, "warn");
    }
  }

  // ================= 菜地夜袭 =================
  ripeLeft() {
    return this.farmPlots().filter((p) => ripeOf(p) && p.crop !== "hybrid" && !this.bt.plots[p.id]?.gi).length;
  }
  // 熟了 6 个钟点以上还没收的（夜袭只认这些：傍晚刚熟的不算）
  ripeLong() {
    const now = this.absNow();
    return this.farmPlots().filter((p) => ripeOf(p) && p.crop !== "hybrid" && !this.bt.plots[p.id]?.gi && this.bt.plots[p.id]?.ra && now - this.bt.plots[p.id].ra >= RAID.age).length;
  }
  raidBlocked() {
    return !!this.ln?.night || !!this.lnPending?.() || ["warning", "active"].includes(this.s.horde.phase) || ["warning", "active"].includes(this.raidState?.().phase);
  }
  raidTempt() {
    return Object.keys(this.bt.giants).length > 0 || this.ripeLong() > RAID.ripe;
  }
  raidWarn() {
    const r = this.bt.raid;
    if (this.s.day < RAID.fromDay || r.day === this.s.day || this.raidBlocked() || !this.raidTempt()) return;
    const giant = Object.keys(this.bt.giants).length > 0,
      n = RAID.count[0] + Math.floor(this.btRoll("raid", this.s.day) * (RAID.count[1] - RAID.count[0] + 1)) + (giant ? 1 : 0);
    Object.assign(r, { day: this.s.day, n, state: "warned", report: "" });
    const text = "熟菜的味道招来了感染者：今晚 01:00 会有 " + n + " 只来踩田（" + (giant ? "地里有巨型作物" : "熟了半天没收的有 " + this.ripeLong() + " 块") + "）。现在收菜、修围栏、点灯都来得及。";
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
  }
  raidStart() {
    const r = this.bt.raid;
    if (r.state !== "warned" || r.day !== this.s.day - 1) return;
    if (!this.raidTempt()) {
      r.state = "gone";
      r.report = "感染者在田边转了一圈，没闻到熟菜，走了。";
      if (this.o) this.olog(r.report);
      return;
    }
    if (this.s.region === "farm" && !this._btSleep && !this.raidBlocked()) return this.raidSpawn();
    this.raidAuto();
  }
  raidSpawn() {
    const r = this.bt.raid,
      day = this.s.day;
    const types = day >= 8 ? ["slow", "runner", "armor", "slow"] : ["slow", "runner", "slow", "slow"];
    for (let i = 0; i < r.n; i++) {
      const dir = HORDE_DIRECTIONS[Math.floor(this.btRoll("rdir", r.day, i) * HORDE_DIRECTIONS.length) % HORDE_DIRECTIONS.length],
        pt = dir.spawns[i % 2],
        q = this.freePoint?.(clamp(pt[0], 80, WORLD.w - 80), clamp(pt[1], 90, WORLD.h - 90)) || { x: pt[0], y: pt[1] },
        z = this.enemy(types[i % types.length], q.x, q.y, false);
      z.btRaid = true;
      z.state = "chase";
      this.enemies.push(z);
    }
    r.state = "live";
    const text = "菜地夜袭：" + r.n + " 只感染者朝熟菜过来了！打倒它们掉的东西翻倍。";
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
    this.emit("alarm");
  }
  // 你睡着或不在：守卫、有人守的塔、麦穗、围栏、灯各挡一只，剩下的每只踩一块
  raidAuto() {
    const r = this.bt.raid;
    const guards = this.readyGuards?.() || 0,
      towers = this.mannedTowers?.()?.size || 0,
      dog = this.dogHome() ? 1 : 0,
      fences = this.s.buildings.filter((b) => ["fence", "gate"].includes(b.type) && b.hp > 0).length >= 6 ? 1 : 0,
      lights = this.fieldLights().length ? 1 : 0;
    const stopped = Math.min(r.n, guards + towers + dog + fences + lights),
      left = r.n - stopped;
    const hit = this.trample(left, "auto");
    r.state = "done";
    const bits = [guards ? "守卫" : "", towers ? "瞭望塔" : "", dog ? "麦穗叫了一夜" : "", fences ? "围栏" : "", lights ? "灯" : ""].filter(Boolean);
    r.report =
      "夜里 " +
      r.n +
      " 只感染者摸进菜地：" +
      (stopped ? bits.join("、") + "挡住了 " + stopped + " 只" : "没人挡") +
      (hit ? "，踩坏了 " + hit + " 块菜（长势退回一半）。" : "，菜地没事。");
    this.btStat("raids");
    if (this.o) this.olog(r.report, hit ? "warn" : "normal");
  }
  // 踩坏几块：先挑熟了的、巨型的
  trample(k, how) {
    let hit = 0;
    const day = this.s.day;
    for (let i = 0; i < k; i++) {
      const giant = Object.values(this.bt.giants)[0];
      if (giant && !giant.trod) {
        giant.lost = (giant.lost || 0) + 4;
        giant.trod = true;
        hit++;
        continue;
      }
      const list = this.farmPlots().filter((p) => p.crop && CROPS[p.crop] && !this.bt.plots[p.id]?.gi && this.bt.plots[p.id]?.tr !== day && p.growth > 0);
      if (!list.length) break;
      list.sort((a, b) => b.growth / CROPS[b.crop].grow - a.growth / CROPS[a.crop].grow);
      const p = list[0];
      p.growth = Math.round(p.growth * RAID.trample);
      this.btPlot(p).tr = day;
      delete this.bt.plots[p.id].ra;
      hit++;
    }
    for (const g of Object.values(this.bt.giants)) delete g.trod;
    if (hit) this.btStat("trampled", hit);
    void how;
    return hit;
  }
  fieldLights() {
    const field = { x: 495, y: 528 };
    return this.s.buildings.filter((b) => b.type === "lamp" && b.hp > 0 && (this.c.energy || 0) > 0 && dist(b, field) < 260);
  }
  dogHome() {
    return !!this.dogReady?.() && (this.s.region === "farm" || !this.dogFollowing?.());
  }
  raidAlive() {
    return (this.s.enemies.farm || []).filter((z) => z.btRaid && !z.dead);
  }
  // 夜袭的感染者：你离得远就去踩田，靠近了照常冲你来
  updateEnemy(e, dt) {
    if (e?.btRaid && !e.dead && this.s.region === "farm" && dist(e, this.s.player) > 220) return this.raidMove(e, dt);
    return super.updateEnemy(e, dt);
  }
  raidMove(e, dt) {
    let target = e.btTarget != null ? this.plotById(e.btTarget) : null;
    if (!target || !target.crop || this.bt.plots[target.id]?.tr === this.s.day) {
      const list = this.farmPlots().filter((p) => p.crop && this.bt.plots[p.id]?.tr !== this.s.day);
      list.sort((a, b) => dist(a, e) - dist(b, e));
      target = list[0] || null;
      e.btTarget = target ? target.id : null;
      e.btStand = 0;
    }
    if (!target) return;
    if (dist(e, target) < 20) {
      e.btStand = (e.btStand || 0) + dt;
      if (e.btStand >= RAID.stand) {
        const g = this.giantOf(target);
        if (g) g.lost = (g.lost || 0) + 4;
        else target.growth = Math.round(target.growth * RAID.trample);
        this.btPlot(target).tr = this.s.day;
        this.btStat("trampled");
        this.effects?.push({ x: target.x, y: target.y - 30, text: "被踩了", t: 1, color: "#e88a6a" });
        e.btTarget = null;
      }
      return;
    }
    const slow = this.fieldLights().some((b) => dist(b, e) < 160) && this.isNight?.() ? 0.6 : 1;
    e.pathTimer = (e.pathTimer || 0) - dt;
    if (e.pathTimer <= 0 || !e.path?.length) {
      e.path = this.pathTo(e, target);
      e.pathTimer = 0.8;
    }
    if (e.path?.[0] && dist(e, e.path[0]) < 18) e.path.shift();
    const t = this.lineClear(e, target) ? target : e.path?.[0];
    if (t) {
      const a = Math.atan2(t.y - e.y, t.x - e.x),
        sp = (this.zSpeed?.(e) || 48) * slow;
      e.facing = a;
      e.state = "chase";
      this.moveEntity(e, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, true);
    }
  }
  zSpeed(e) {
    return { slow: 48, runner: 98, armor: 37 }[e.type] || 48;
  }
  // 夜袭的感染者打倒了：掉的东西翻倍
  hurtEnemy(e, n, a, meta = {}) {
    const live = e && !e.dead;
    const out = super.hurtEnemy(e, n, a, meta);
    if (live && e.dead && e.btRaid && this.bt) {
      const table = KILL_DROPS[e.type] || KILL_DROPS.slow || [];
      const got = {};
      for (const [p, id, lo, hi] of table) if (this.btRoll("rdrop", e.id, id) < p) got[id] = (got[id] || 0) + (lo + Math.floor(this.btRoll("rdn", e.id, id) * (hi - lo + 1))) * RAID.drops;
      if (!Object.keys(got).length) got.scrap = RAID.drops;
      this.putStorage(got);
      this.effects?.push({ x: e.x, y: e.y - 40, text: itemsText(got), t: 1.2, color: "#ffd76a" });
      if (!this.raidAlive().length && this.bt.raid.state === "live") {
        this.bt.raid.state = "done";
        this.bt.raid.report = "菜地夜袭打退了：" + this.bt.raid.n + " 只都倒下了。";
        this.toast(this.bt.raid.report, "gold");
        if (this.o) this.olog(this.bt.raid.report, "gold");
      }
    }
    return out;
  }
  // 天亮了还没打完的退回林子
  raidDawn() {
    const r = this.bt.raid;
    if (r.state !== "live") return;
    for (const z of this.raidAlive()) {
      z.dead = true;
      z.fled = true;
    }
    r.state = "done";
    r.report = "天亮了，夜袭的感染者退回了林子。";
    if (this.o) this.olog(r.report);
  }
  sleep() {
    this._btSleep = true;
    try {
      return super.sleep();
    } finally {
      this._btSleep = false;
    }
  }

  // ================= 偷菜 =================
  theftNight() {
    if (this.s.day < THEFT.fromDay) return;
    const now = this.absNow(),
      day = this.s.day,
      guard = this.s.buildings.filter((b) => (b.type === "scarecrow" || (b.type === "lamp" && (this.c.energy || 0) > 0)) && b.hp > 0),
      glow = this.farmPlots().filter((p) => p.crop === "glowBean" && ripeOf(p)),
      chance = this.dogHome() ? THEFT.dog : THEFT.chance;
    let n = 0,
      plots = 0;
    for (const p of this.farmPlots()) {
      const r = this.bt.plots[p.id];
      if (!ripeOf(p) || p.crop === "hybrid" || !r?.ra || now - r.ra < THEFT.ripe || r.gi) continue;
      if (this.g?.plots[p.id]?.cv >= day) continue;
      if (guard.some((b) => dist(b, p) <= THEFT.guard) || glow.some((q) => dist(q, p) < 80)) continue;
      if (this.btRoll("theft", day, p.id) >= chance) continue;
      const k = THEFT.take[0] + Math.floor(this.btRoll("theftn", day, p.id) * (THEFT.take[1] - THEFT.take[0] + 1));
      r.st = (r.st || 0) + k;
      r.pr = day;
      n += k;
      plots++;
    }
    if (n) {
      this.btStat("stolen", n);
      const text = "夜里有人摸进菜地，从 " + plots + " 块熟了一天没收的菜里偷走了 " + n + " 份（地上有脚印）。熟了早点收，或者立稻草人、点暖光灯。";
      this.toast(text, "warn");
      if (this.o) this.olog(text, "warn");
    }
  }

  // ================= 订单板 =================
  orderReason(o) {
    if (!o) return "这张单子不在了";
    if (this.s.region !== "farm") return "回到农场再交";
    const have = this.orderHave(o.item);
    if (have < o.n) return "还差 " + (o.n - have) + " 份" + (ITEMS[o.item]?.name || o.item);
    return "";
  }
  // 能拿来交单的：身上和仓库里的，优质、耐旱的也算
  orderHave(item) {
    return this.quantityForCost ? this.quantityForCost(item, true) : this.qty(item, true);
  }
  orderWants() {
    // 能拿得到的：种过的、手上有种子的、有鸡就有蛋
    const can = new Set();
    for (const c of Object.keys(CROPS)) if (!CROPS[c].hybrid && (this.bt.dex[c]?.h || this.qty(CROPS[c].seed, true) > 0)) can.add(c);
    if (this.c.animals?.chicken) can.add("egg");
    if (!can.size) for (const c of ["radish", "potato"]) can.add(c);
    return can;
  }
  orderMake(seq) {
    const day = this.s.day,
      r = (k) => this.btRoll("ord", day, seq, k),
      can = this.orderWants(),
      board = this.bt.orders.list,
      // 板上已经有的人、要的东西，尽量不重复
      usedItems = new Set(board.map((x) => x.item)),
      usedPeople = new Set(board.map((x) => x.who)),
      fresh = (list, used) => (list.some((x) => !used.has(x)) ? list.filter((x) => !used.has(x)) : list);
    const able = ORDER_PEOPLE.filter((x) => x.wants.some((w) => can.has(w))),
      people = able.filter((x) => !usedPeople.has(x.id) && x.wants.some((w) => can.has(w) && !usedItems.has(w)));
    const pool = people.length ? people : able;
    const who = pool.length ? pool[Math.floor(r("who") * pool.length) % pool.length] : ORDER_PEOPLE[1];
    const wants = fresh(who.wants.filter((w) => can.has(w)), usedItems),
      item = wants.length ? wants[Math.floor(r("item") * wants.length) % wants.length] : "radish",
      slow = (CROPS[item]?.grow || 300) >= 900,
      n = slow ? 2 + Math.floor(r("n") * 3) : ORDERS.qty[0] + Math.floor(r("n") * (ORDERS.qty[1] - ORDERS.qty[0] + 1)),
      due = day + ORDERS.days[0] + Math.floor(r("due") * (ORDERS.days[1] - ORDERS.days[0] + 1)),
      value = Math.round((ITEMS[item]?.sell || 10) * n * ORDERS.mult);
    // 报酬：材料按价折，两成是神秘种子包
    const pay = {};
    if (r("kind") < ORDER_PAY.seed) pay.seedMystery = clamp(Math.round(value / ORDER_PAY.seedMystery.value), 1, ORDER_PAY.seedMystery.max);
    else {
      const mats = ["wood", "scrap", "cloth", "parts"],
        a = mats[Math.floor(r("mat") * mats.length) % mats.length],
        b = mats[(mats.indexOf(a) + 1 + Math.floor(r("mat2") * 3)) % mats.length];
      let left = value;
      for (const m of [a, b]) {
        const k = clamp(Math.floor(left / 2 / ORDER_PAY[m].value) + (m === b ? Math.floor(left / 2 / ORDER_PAY[m].value) : 0), 0, ORDER_PAY[m].max);
        if (k > 0) pay[m] = (pay[m] || 0) + k;
        left -= k * ORDER_PAY[m].value;
      }
      if (!Object.keys(pay).length) pay.wood = Math.max(1, Math.round(value / ORDER_PAY.wood.value));
    }
    return { id: "o" + day + "-" + seq, who: who.id, name: who.name, item, n, due, pay };
  }
  ordersMorning() {
    const o = this.bt.orders,
      day = this.s.day;
    if (day < ORDERS.fromDay || o.day === day) return;
    o.day = day;
    const gone = o.list.filter((x) => x.due < day);
    if (gone.length) {
      const text = gone.map((x) => x.name + "要的" + (ITEMS[x.item]?.name || x.item)).join("、") + "的单子过期了。";
      if (this.o) this.olog(text);
    }
    o.list = o.list.filter((x) => x.due >= day);
    while (o.list.length < ORDERS.slots) o.list.push(this.orderMake(o.seq++));
  }
  deliverBoardOrder(id) {
    const o = this.bt.orders.list.find((x) => x.id === id),
      why = this.orderReason(o);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    if (!this.takeFarm({ [o.item]: o.n })) return false;
    this.putStorage(o.pay);
    this.bt.orders.list = this.bt.orders.list.filter((x) => x !== o);
    this.btStat("orders");
    if (["farmer", "medic", "mechanic"].includes(o.who) && this.ss?.trust) this.addTrust?.(o.who, 1);
    const text = "交了" + o.name + "的单子（" + (ITEMS[o.item]?.name || o.item) + " ×" + o.n + "）：" + itemsText(o.pay) + "（已入仓）。";
    this.toast(text, "gold");
    if (this.o) this.olog(text, "gold");
    this.emit("quest");
    return true;
  }
  tearReason(id) {
    if (!this.bt.orders.list.some((x) => x.id === id)) return "这张单子不在了";
    if (this.bt.orders.tore === this.s.day) return "今天已经撕过一张了";
    return "";
  }
  tearOrder(id) {
    const why = this.tearReason(id);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const o = this.bt.orders.list.find((x) => x.id === id);
    this.bt.orders.list = this.bt.orders.list.filter((x) => x !== o);
    this.bt.orders.tore = this.s.day;
    this.toast("撕掉了" + o.name + "的单子。明早补一张新的。");
    return true;
  }

  // 以前出货箱、工作台里的“每日订单”并进了订单板：不再出新的；已经接了还没交的，接单那天和第二天照样能交
  ensureOrders() {
    if (!this.s.bounty) return super.ensureOrders();
    if (this.c.ordersDay === this.s.day) return;
    this.c.ordersDay = this.s.day;
    this.c.orders = (this.c.orders || []).filter((o) => o.accepted && !o.done && this.s.day - (Number(String(o.id).split("-")[1]) || 0) <= 1);
  }

  // ================= 收获展：巨型作物一棵顶一组 =================
  exhibitionScore() {
    const base = super.exhibitionScore();
    return base + (this.f?.exhibition?.entries || []).filter((id) => id.startsWith("giant_")).length * (GIANT.show - 8);
  }
  enterExhibition(id) {
    if (!String(id || "").startsWith("giant_")) return super.enterExhibition(id);
    const e = this.f.exhibition;
    if (this.s.region !== "farm" || e.judged || e.entries.length >= 3 || !ITEMS[id] || !this.pay({ [id]: 1 }, true, false)) return false;
    e.entries.push(id);
    return true;
  }

  // ================= 每日卡里的农事真的出现在田里 =================
  dailyField() {
    const p = this.dy?.pending,
      day = this.s.day;
    if (!p || p.day !== day || this.bt.daily.day === day) return;
    const farm = this.farmPlots();
    let did = false;
    if (p.id === "N02") {
      // 虫害苗头：六块长着的田叶子背面爬上了虫
      const growing = farm.filter((q) => q.crop && CROPS[q.crop] && q.crop !== "hybrid" && !ripeOf(q)).slice(0, 6);
      for (const q of growing) {
        const rec = this.gRec(q);
        rec.b = Math.min(3, (rec.b || 0) + 1);
      }
      did = growing.length > 0;
    } else if (p.id === "N04") {
      this.bt.pumpkin = day;
      did = true;
    } else if (p.id === "N11") {
      // 田鼠打洞：三块田边多了洞，收的时候每块少 1 份
      const list = farm.filter((q) => q.crop && CROPS[q.crop] && q.crop !== "hybrid").slice(0, 3);
      for (const q of list) this.btPlot(q).mh = true;
      did = list.length > 0;
    }
    this.bt.daily = { day, id: did ? p.id : "" };
  }
  chooseDaily(i) {
    const p = this.dailyCard?.();
    const res = super.chooseDaily(i);
    if (!res || !p || !this.bt) return res;
    const farm = this.farmPlots(),
      extra = [];
    if (p.id === "N02") {
      const clear = i === 0 || (i === 1 && res.win) || i === 2;
      if (clear) {
        let n = 0;
        for (const q of farm) {
          const rec = this.g?.plots[q.id];
          if (rec?.b) {
            n += rec.b;
            rec.b = 0;
          }
        }
        if (n && i === 1) this.receive({ grub: n });
        if (n) extra.push("田里的 " + n + " 只虫都没了" + (i === 1 ? "（菜青虫 +" + n + "）" : "") + "。");
      }
    } else if (p.id === "N03" && i === 0) {
      let n = 0;
      for (const q of farm)
        if (q.crop) {
          this.gRec(q).cv = Math.max(this.gRec(q).cv || 0, this.s.day + 1);
          n++;
        }
      if (n) extra.push("给 " + n + " 块田盖上了布（管到明天）。");
    } else if (p.id === "N04") {
      if (this.bt.pumpkin === this.s.day) this.bt.pumpkin = -this.s.day;
    } else if (p.id === "N11" && ((i === 0 && res.win) || i === 1)) {
      let n = 0;
      for (const q of farm)
        if (this.bt.plots[q.id]?.mh) {
          delete this.bt.plots[q.id].mh;
          n++;
        }
      if (n) extra.push(n + " 个田鼠洞都填上了。");
    }
    if (extra.length) {
      res.lines = [...res.lines, ...extra];
      if (p.lines) p.lines = [...p.lines, ...extra].slice(0, 12);
    }
    return res;
  }

  // ================= 集市菜园（妙手） =================
  marketGardenHere() {
    return this.s.region === MARKET_GARDEN.region;
  }
  gardenStealReason() {
    if (!this.hasTalent?.("pickpocket")) return "要「顺手牵羊」天赋";
    if (!this.marketGardenHere()) return "菜园在集市后面";
    if (this.th?.pending) return "先把上一次被抓的事了结";
    if (this.bt.market === this.s.day) return "今天已经下过手了";
    return "";
  }
  startGardenSteal() {
    const why = this.gardenStealReason();
    if (why) {
      this.toast(why + "。", "warn");
      return null;
    }
    this.bt.market = this.s.day;
    this.btStat("market");
    const owner = TARGETS.linyi || { name: "林姨", group: "market", alert: 1 },
      day = this.s.day,
      pick = (k, list) => list[Math.floor(this.btRoll("mg", day, k) * list.length) % list.length];
    const slots = [
      { id: "mg:" + day + ":0", tier: "normal", item: pick("a", ["potato", "radish", "bean"]), n: 2 + Math.floor(this.btRoll("mgn", day, 0) * 3) },
      { id: "mg:" + day + ":1", tier: "normal", item: pick("b", ["tomato", "corn", "herb"]), n: 2 + Math.floor(this.btRoll("mgn", day, 1) * 2) },
      { id: "mg:" + day + ":2", tier: "important", item: pick("c", ["seedMystery", "seed_tomato_abundant", "seed_bean_early"]), n: 1 },
    ];
    const odds = this.stealOdds("linyi", null, { box: true, def: { ...owner, owner: "linyi" } });
    const st = this.beginSteal({ tid: "linyi", def: { ...owner }, trust: owner.trust || null, odds, slots, key: "garden:" + day, lines: ["你蹲在林姨菜园的篱笆边，菜叶子沙沙响。"] });
    if (st) st.garden = true;
    return st;
  }
  // 菜园里摸到的不记进林姨口袋的账（不然她口袋里的东西会提前补回来）
  stealStop() {
    const st = this.steal;
    if (!st?.garden || !this.th) return super.stealStop();
    const had = this.th.taken[st.tid],
      keep = had ? { ...had, ids: [...had.ids] } : null;
    const res = super.stealStop();
    if (keep) this.th.taken[st.tid] = keep;
    else delete this.th.taken[st.tid];
    return res;
  }

  // ================= 场景里的东西、按 E =================
  assignRegion() {
    super.assignRegion();
    if (!this.bt || !Array.isArray(this.objects)) return;
    if (this.s.region === "farm") {
      if (this.s.day >= ORDERS.fromDay) this.objects.push({ type: "btOrders", name: "订单板", x: ORDERS.spot.x, y: ORDERS.spot.y, icon: 40 });
    }
    if (this.s.region === MARKET_GARDEN.region) this.objects.push({ type: "btGarden", name: MARKET_GARDEN.name, x: MARKET_GARDEN.x, y: MARKET_GARDEN.y, icon: 24 });
  }
  context(o) {
    if (this.bt && !this.c?.fishing) {
      if (o?.type === "btOrders") return "订单板 · " + this.bt.orders.list.length + " 张单子";
      if (o?.type === "btGarden") return this.f?.crouch && this.hasTalent?.("pickpocket") ? MARKET_GARDEN.name + " · 按 E 下手" : MARKET_GARDEN.name + "（别人的菜）";
      if (o?.type === "building" && o.building.type === "compost") {
        const r = this.compostRec(o.building.id);
        return "堆肥桶 · " + (r.out ? "有 " + r.out + " 袋" + FERTS[r.kind].name + "可以取" : r.ready ? "正在沤" + FERTS[r.kind].name : r.n + "/" + COMPOST.batch);
      }
    }
    return super.context(o);
  }
  buildingContext(b) {
    if (b?.type === "compost") return "堆肥桶 · 按 E 打开";
    return super.buildingContext(b);
  }
  interact() {
    if (this.paused) return;
    if (!this.bt || this.c?.fishing) return super.interact();
    const o = this.nearestObject?.();
    if (o?.type === "btOrders") {
      this.ordersMorning();
      this.emit("menu", { menu: "outpost", view: "bOrders", id: "" });
      return;
    }
    if (o?.type === "btGarden") {
      if (this.f?.crouch && this.hasTalent?.("pickpocket")) {
        if (this.startGardenSteal()) this.emit("menu", { menu: "outpost", view: "steal", id: "" });
      } else this.toast("林姨的菜园。" + (this.hasTalent?.("pickpocket") ? "蹲下（V）再按 E 下手。" : "别人的菜。"));
      return;
    }
    if (o?.type === "building" && o.building.type === "compost") {
      this.emit("menu", { menu: "outpost", view: "bCompost", id: o.building.id });
      return;
    }
    return super.interact();
  }

  // ================= 每个钟点、每天 =================
  update(dt, input = {}) {
    const intro = !this.paused && this.bt?.intro;
    if (intro && !intro.told) {
      intro.told = true;
      const text =
        "丰年：水井、雨水桶、水塔、喷灌头、水渠并成了一张水网，每天出多少水、够浇几块田，农场告示牌上写着；无人机改叫照看机，只照看、浇水、捉虫，你在农场时居民也不抢着收菜。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    }
    const out = super.update(dt, input);
    if (this.bt && !this.paused) {
      // 离开农场的时刻（照看机一整天以上才替你收）
      if (this.s.region !== "farm") {
        if (!this.bt.away) this.bt.away = this.absNow();
      } else if (this.bt.away) this.bt.away = 0;
    }
    return out;
  }
  workHour() {
    super.workHour();
    if (!this.bt) return;
    const h = Math.floor(this.s.minute / 60),
      now = this.absNow();
    // 熟了的时刻：居民等 4 个钟点、偷菜等一天
    for (const p of this.farmPlots()) {
      if (ripeOf(p)) {
        const r = this.btPlot(p);
        if (!r.ra) r.ra = now;
      } else if (this.bt.plots[p.id]?.ra) delete this.bt.plots[p.id].ra;
    }
    if (h >= 6 && h <= 20) this.netDistribute(["sprinkler"]);
    this.droneHour();
    this.chickenHour();
    this.compostTick();
    if (h === 1) this.raidStart();
    if (h === 3) this.theftNight();
    if (h === 6) {
      this.raidDawn();
      this.giantMorning();
      this.frogMorning();
      this.ordersMorning();
      this.stormMorning();
      this.dailyField();
    }
    if (h === STORM.warn / 60) this.stormWarn();
    if (h === RAID.warn / 60) this.raidWarn();
  }
  onNewDay() {
    if (this.bt) this.hybridNight();
    super.onNewDay();
    if (!this.bt) return;
    this.netProduce();
    this.netDistribute();
    this.coldSchedule();
    // 收拾：空了的田、不在了的巨型
    for (const [k, r] of Object.entries(this.bt.plots)) {
      const p = this.plotById(k);
      if (!p) delete this.bt.plots[k];
      else if (!p.crop && !r.pr) delete this.bt.plots[k];
      else if (r.pr && r.pr < this.s.day - 1) delete r.pr;
    }
    for (const [k, g] of Object.entries(this.bt.giants))
      if (g.ids.some((id) => this.plotById(id)?.crop !== g.crop)) {
        delete this.bt.giants[k];
        for (const id of g.ids) if (this.bt.plots[id]) delete this.bt.plots[id].gi;
      }
    if (this.bt.pumpkin > 0 && this.bt.pumpkin < this.s.day) this.bt.pumpkin = 0;
    if (this.bt.pumpkin < 0) this.bt.pumpkin = 0;
  }

  // ================= 存档 =================
  static parse(text) {
    const s = TidyEngine.parse(text);
    migrateState(s);
    validateBounty(s);
    return s;
  }
}

function validateBounty(s) {
  const t = s.bounty,
    bad = (why) => {
      throw new Error("存档里的菜地记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
    };
  if (!t || typeof t !== "object") bad("缺少");
  const int = (v, lo = 0, hi = 1e9) => Number.isInteger(v) && v >= lo && v <= hi,
    num = (v, lo = 0, hi = 1e9) => Number.isFinite(v) && v >= lo && v <= hi,
    obj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  if (!int(t.schema, 1, 99)) bad("版本");
  const n = t.net;
  if (!obj(n) || !int(n.day) || !num(n.pool, 0, 1e5) || !num(n.made, 0, 1e5) || !num(n.used, 0, 1e6) || !int(n.missed ?? 0, 0, 1e4)) bad("水网");
  if (!Array.isArray(n.order) || n.order.length !== WATER.order.length || WATER.order.some((k) => !n.order.includes(k))) bad("水网");
  if (!Array.isArray(n.off) || n.off.length > 40 || n.off.some((x) => typeof x !== "string")) bad("水网");
  if (n.dry !== undefined && (!Array.isArray(n.dry) || n.dry.length > 200)) bad("水网");
  if (!Array.isArray(n.log) || n.log.length > WATER.log || n.log.some((r) => !obj(r) || !int(r.d) || !num(r.made, 0, 1e5) || !num(r.used, 0, 1e6) || !int(r.missed, 0, 1e4))) bad("水网");
  if (n.kept !== undefined && !num(n.kept, 0, 1e5)) bad("水网");
  if (!obj(t.plots) || Object.keys(t.plots).length > 2000) bad("田");
  for (const [k, r] of Object.entries(t.plots)) {
    if (!/^\d{1,9}$/.test(k) || !obj(r)) bad("田");
    if (r.fz !== undefined && !FERT_IDS.includes(r.fz)) bad("田");
    for (const f of ["n", "st", "pr", "tr"]) if (r[f] !== undefined && !int(r[f], 0, 1e7)) bad("田");
    if (r.ra !== undefined && !num(r.ra, 0, 1e12)) bad("田");
    if (r.hy !== undefined && (!Array.isArray(r.hy) || r.hy.length > 2 || r.hy.some((c) => !CROPS[c]))) bad("田");
    if (r.gi !== undefined && typeof r.gi !== "string") bad("田");
  }
  if (!obj(t.giants) || Object.keys(t.giants).length > 40) bad("巨型作物");
  for (const g of Object.values(t.giants)) if (!obj(g) || !GIANT.crops.includes(g.crop) || !Array.isArray(g.ids) || g.ids.length !== 4 || !int(g.hits, 0, 99) || !int(g.day)) bad("巨型作物");
  if (!obj(t.compost) || Object.keys(t.compost).length > 60) bad("堆肥桶");
  for (const r of Object.values(t.compost)) if (!obj(r) || !FERTS[r.kind] || !int(r.n, 0, COMPOST.batch) || !int(r.out, 0, COMPOST.max) || !num(r.ready, 0, 1e12)) bad("堆肥桶");
  if (!obj(t.dex) || Object.keys(t.dex).some((c) => !DEX_CROPS.includes(c))) bad("图鉴");
  if (!obj(t.chickens) || typeof t.chickens.out !== "boolean" || !num(t.chickens.until, 0, 1e12) || !int(t.chickens.used, 0, 1440)) bad("放鸡");
  if (!obj(t.cold) || !int(t.cold.next) || !int(t.cold.n, 0, 999)) bad("寒潮");
  if (!obj(t.raid) || !int(t.raid.day) || !int(t.raid.n, 0, 12) || typeof t.raid.state !== "string" || t.raid.state.length > 12 || String(t.raid.report || "").length > 200) bad("夜袭");
  if (!obj(t.orders) || !Array.isArray(t.orders.list) || t.orders.list.length > ORDERS.slots) bad("订单");
  for (const o of t.orders.list) if (!obj(o) || typeof o.id !== "string" || !ITEMS[o.item] || !int(o.n, 1, 99) || !int(o.due) || !obj(o.pay) || Object.entries(o.pay).some(([id, k]) => !ITEMS[id] || !int(k, 1, 99))) bad("订单");
  if (!num(t.away, 0, 1e12) || !int(t.market) || !int(t.mystery, 0, 1e7)) bad("记录");
  if (t.intro !== undefined && (!obj(t.intro) || !int(t.intro.day) || typeof t.intro.told !== "boolean")) bad("记录");
  if (!obj(t.stats) || Object.values(t.stats).some((v) => !int(v))) bad("记录");
}
