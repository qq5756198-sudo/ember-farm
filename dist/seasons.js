// v0.16.0「前哨四季」：节庆、布局相邻加成、食堂营业夜、营火夜谈、学徒、过路人借宿，
// 何大勺、秦奶奶、阿豆、阿砾、老琴、江伯，以及人物关系与同处多对象选择。只新增 seasons 字段。
import { Engine as WinterEngine, freshState as winterFresh, migrateState as winterMigrate } from "./winter.js";
import { ITEMS, BUILDINGS } from "./data.js";
import { missingCost, bundleText } from "./alliance-data.js";
import { VISITOR_CLUES, VISITOR_LOOKS } from "./outpost-data.js";
import {
  SEASONS_SCHEMA,
  SSPOTS,
  SHEET_SPOTS,
  FEST_EVERY,
  FEST_KINDS,
  FESTIVALS,
  FEST_COST,
  DECOR,
  FEST_HOURS,
  ADJ,
  CANTEEN_DAYS,
  CANTEEN_HOURS,
  CANTEEN_GUESTS,
  CANTEEN_GAP,
  CANTEEN_PATIENCE,
  TASTES,
  GUEST_NAMES,
  TALK_HOURS,
  TOPICS,
  APPRENTICE_DAYS,
  CRAFTS,
  SKILL_NAMES,
  LODGER_HOURS,
  LODGER_NAMES,
  LODGER_GIFTS,
  SNPCS,
  HE_DISHES,
  HE_BONUS,
  JIANG_TASKS,
  BIRTHDAYS,
  LIKES,
  FEATURES,
} from "./seasons-data.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const SEASON_OBJECTS = ["seasonPlaza", "seasonJiang", "seasonAli", "seasonAdou", "seasonLodger", "seasonHe", "seasonSheet"];
const SEEDS = ["seedRadish", "seedPotato", "seedTomato", "seedBean", "seedCorn", "seedPumpkin", "seedHerb", "seedCotton"].filter((id) => ITEMS[id]);
const CROPS = ["radish", "potato", "tomato", "bean", "corn", "pumpkin", "rye", "herb", "cotton"].filter((id) => ITEMS[id]);
const GUEST_STATES = ["waiting", "served", "left"];
const QIN_PHASES = ["none", "asking", "staying", "left"];
const ADOU_PHASES = ["none", "stealing", "note", "sister", "runner"];
const ALI_PHASES = ["none", "here", "scolded", "painting"];
const JIANG_PHASES = ["none", "c1", "c2", "mutant", "release", "done"];
const QUIET_TYPES = ["fence", "gate", "trap", "field", "floor", "chair", "lamp", "harvestTrophy"];
const NO_PICK = ["exit", "plot", "drop", "grave", "sign", "allianceHelper", "resident", "survivor"];

const defaults = () => ({
  schema: SEASONS_SCHEMA,
  fest: { lastDay: 0, held: [], missed: 0, noticeDay: 0 },
  decor: [],
  canteen: { rep: 30, nights: 0, lastDay: 0, night: null },
  talk: { day: 0, count: 0 },
  trust: {},
  gifts: {},
  apprentice: null,
  skills: {},
  lodger: null,
  lodgerNext: 0,
  lodgers: 0,
  pendingGuest: null,
  he: { stage: 0 },
  qin: { phase: "none", wishes: [], since: 0 },
  adou: { phase: "none", thefts: 0, lastTheft: 0 },
  ali: { phase: "none", murals: 0, lastPaint: 0 },
  laoqin: { met: false, quest: false, sheets: [], requestDay: 0 },
  jiang: { phase: "none", rod: 0 },
  seen: [],
  claimed: [],
});

export function migrateState(s) {
  winterMigrate(s);
  const d = defaults();
  if (!s.seasons) s.seasons = d;
  else {
    const x = s.seasons;
    s.seasons = {
      ...d,
      ...x,
      fest: { ...d.fest, ...x.fest },
      canteen: { ...d.canteen, ...x.canteen },
      talk: { ...d.talk, ...x.talk },
      he: { ...d.he, ...x.he },
      qin: { ...d.qin, ...x.qin },
      adou: { ...d.adou, ...x.adou },
      ali: { ...d.ali, ...x.ali },
      laoqin: { ...d.laoqin, ...x.laoqin },
      jiang: { ...d.jiang, ...x.jiang },
    };
  }
  return s;
}
export const freshState = () => migrateState(winterFresh());

export class Engine extends WinterEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this.assignRegion();
  }
  get ss() {
    return this.s.seasons;
  }
  sonce(id) {
    if (this.ss.claimed.includes(id)) return false;
    this.ss.claimed.push(id);
    if (this.ss.claimed.length > 300) this.ss.claimed = this.ss.claimed.slice(-300);
    return true;
  }
  hour() {
    return Math.floor(this.s.minute / 60);
  }
  atSpot(spot, r = 130) {
    return this.s.region === (spot.region || "farm") && dist(this.s.player, spot) <= r;
  }
  residentsMood(n) {
    for (const r of this.c.residents) r.morale = clamp((r.morale ?? 60) + n, 0, 100);
  }

  // ---------- 节庆 ----------
  festivalsOpen() {
    return (this.sc?.act || 1) >= 3;
  }
  isFestivalDay(day = this.s.day) {
    return day >= FEST_EVERY && day % FEST_EVERY === 0;
  }
  festivalKind(day = this.s.day) {
    const n = Math.max(1, Math.round(day / FEST_EVERY));
    return FEST_KINDS[(n - 1) % FEST_KINDS.length];
  }
  nextFestivalDay(from = this.s.day) {
    return Math.max(FEST_EVERY, Math.ceil(from / FEST_EVERY) * FEST_EVERY);
  }
  festivalHosted(day = this.s.day) {
    return this.ss.fest.held.includes(day);
  }
  festivalRecent() {
    const last = this.ss?.fest.lastDay || 0;
    return last > 0 && this.s.day - last < 7;
  }
  festivalWindow() {
    return this.festivalsOpen() && this.isFestivalDay() && this.s.minute >= FEST_HOURS[0] && this.s.minute < FEST_HOURS[1];
  }
  // 交给节庆的东西。换种集与丰收评比按仓库里最多的几样自动挑。
  festivalPay(kind = this.festivalKind()) {
    if (FEST_COST[kind]) return FEST_COST[kind];
    const pool = kind === "seeds" ? SEEDS : CROPS;
    const picks = pool
      .map((id) => [id, this.quantityForCost(id, true)])
      .filter(([, n]) => n >= 2)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);
    if (picks.length < 3) return null;
    return Object.fromEntries(picks.map(([id]) => [id, 2]));
  }
  festivalStars(kind = this.festivalKind()) {
    const b = (t) => this.s.buildings.filter((x) => x.type === t && x.hp > 0).length;
    const special =
      kind === "seeds"
        ? b("stall") > 0
        : kind === "lanterns"
          ? b("lamp") >= 2
          : kind === "harvest"
            ? (this.f?.exhibition?.entries?.length || 0) > 0
            : b("tower") > 0;
    return [special, (this.w?.ladder || 0) >= 2, this.ss.ali.murals >= 2 || this.ss.laoqin.requestDay === this.s.day];
  }
  festivalReason() {
    if (!this.festivalsOpen()) return "第三段之后才有节庆";
    if (!this.isFestivalDay()) return "今天不是节庆日（下一次：第" + this.nextFestivalDay() + "天）";
    if (this.festivalHosted()) return "今天的节庆已经办过了";
    if (this.s.minute < FEST_HOURS[0]) return "节庆 16:00 开始";
    if (this.s.minute >= FEST_HOURS[1]) return "节庆 22:00 就散了";
    if (["warning", "active"].includes(this.raidState().phase) || ["warning", "active"].includes(this.s.horde.phase)) return "外面在打仗，先守住农场";
    const pay = this.festivalPay();
    if (!pay) return this.festivalKind() === "seeds" ? "需要 3 种种子各 2 份" : "需要 3 种作物各 2 份";
    const lack = missingCost(this, pay);
    if (lack.length) return "还缺：" + lack.join("、");
    return "";
  }
  hostFestival() {
    const reason = this.festivalReason();
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    if (!this.atSpot(SSPOTS.plaza, 150)) {
      this.toast("到前哨广场主持节庆。", "warn");
      return false;
    }
    const kind = this.festivalKind(),
      f = FESTIVALS[kind],
      pay = this.festivalPay(kind);
    if (!this.takeFarm(pay)) return false;
    const day = this.s.day,
      stars = this.festivalStars(kind).filter(Boolean).length,
      fe = this.ss.fest;
    fe.held = [...fe.held, day].slice(-60);
    fe.lastDay = day;
    let extra = "";
    if (this.sonce("fest:" + day)) {
      this.addReputation(kind === "vigil" ? 5 : 3);
      if (kind === "seeds") {
        const gain = { seedRye: 2 };
        SEEDS.filter((id) => !pay[id])
          .sort((a, b) => this.quantityForCost(a, true) - this.quantityForCost(b, true))
          .slice(0, 3)
          .forEach((id) => (gain[id] = 3 + stars));
        this.putStorage(gain);
        extra = "换回" + bundleText(gain);
      } else if (kind === "lanterns") {
        this.residentsMood(6 + stars * 2);
        extra = "居民士气 +" + (6 + stars * 2);
      } else if (kind === "harvest") {
        const money = 60 + stars * 20 + (this.f?.exhibition?.result?.win ? 40 : 0);
        this.s.money += money;
        extra = money + " 金币";
      } else {
        for (const p of this.people()) this.addTrust(p.id, 1);
        extra = "所有认识的人信任 +1";
      }
      if (!this.ss.decor.includes(f.decor)) {
        this.ss.decor = [...this.ss.decor, f.decor];
        extra += "；广场多了" + DECOR[f.decor].name;
      }
    }
    const text = "第" + day + "天「" + f.name + "」办成了（" + "★".repeat(stars) + "☆".repeat(3 - stars) + "）：" + extra + "。";
    this.toast(text, "gold");
    this.olog(text, "gold");
    this.emit("victory");
    if (this.ss.ali.phase === "none") this.aliArrive();
    else if (this.ss.ali.phase === "scolded") {
      this.ss.ali.phase = "here";
      this.toast("阿砾又溜回来了，蹲在南边围栏边。", "normal");
    }
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  festivalMorning() {
    const fe = this.ss.fest,
      day = this.s.day;
    if (!this.festivalsOpen()) return;
    if (this.isFestivalDay(day + 1) && fe.noticeDay !== day) {
      fe.noticeDay = day;
      const f = FESTIVALS[this.festivalKind(day + 1)];
      this.toast("明天是「" + f.name + "」：" + f.pay + "，16:00 后到前哨广场主持。", "gold");
    }
  }
  festivalOverdue() {
    // 午夜：昨天的节庆没办就记一笔，不罚。
    const y = this.s.day - 1;
    if (this.festivalsOpen() && this.isFestivalDay(y) && !this.festivalHosted(y) && this.sonce("miss:" + y)) {
      this.ss.fest.missed++;
      this.olog("错过了第" + y + "天的「" + FESTIVALS[this.festivalKind(y)].name + "」。");
    }
  }
  // 节庆当天不排尸潮：顺延一天。
  guardFestival() {
    const c = this.c;
    if (this.festivalsOpen() && c.nextHordeDay && this.isFestivalDay(c.nextHordeDay) && c.nextHordeDay >= this.s.day) c.nextHordeDay++;
  }

  // ---------- 布局相邻加成 ----------
  adjRuleMet(rule, x, y, skip = null) {
    if (rule.plots) return this.s.plots.filter((p) => (p.region || "farm") === "farm" && dist(p, { x, y }) <= rule.r).length >= rule.plots;
    return this.s.buildings.some((b) => b !== skip && b.hp > 0 && rule.b.includes(b.type) && dist(b, { x, y }) <= rule.r);
  }
  adjActive(b) {
    if (!b || b.hp <= 0) return [];
    return ADJ.filter((rule) => rule.a === b.type && this.adjRuleMet(rule, b.x, b.y, b));
  }
  adjacencyPreview(type, x, y) {
    const out = [];
    for (const rule of ADJ.filter((r) => r.a === type)) out.push((this.adjRuleMet(rule, x, y) ? "＋ " + rule.text : "提示：" + rule.hint));
    for (const rule of ADJ.filter((r) => r.b?.includes(type)))
      for (const b of this.s.buildings)
        if (b.type === rule.a && b.hp > 0 && dist(b, { x, y }) <= rule.r && !this.adjRuleMet(rule, b.x, b.y, b)) {
          out.push("＋ 让旁边的" + BUILDINGS[b.type].name + "：" + rule.text.split("：")[1]);
          break;
        }
    return out.slice(0, 3);
  }
  stationBoost(station) {
    const list = this.s.buildings.filter((b) => b.type === station && b.hp > 0);
    if (!list.length) return 0;
    let total = 0;
    for (const b of list) total += this.adjActive(b).reduce((n, r) => n + (r.speed || 0), 0);
    return total / list.length;
  }
  processProduction(n) {
    const boosts = new Map();
    for (const j of this.c.production) {
      if (j.ready || !(j.remaining > 0)) continue;
      if (!boosts.has(j.station)) boosts.set(j.station, this.stationBoost(j.station));
      const m = 1 + boosts.get(j.station);
      if (m > 1) {
        j.remaining /= m;
        j._boost = m;
      }
    }
    try {
      return super.processProduction(n);
    } finally {
      for (const j of this.c.production)
        if (j._boost) {
          if (!j.ready) j.remaining = Math.round(j.remaining * j._boost * 1000) / 1000;
          delete j._boost;
        }
    }
  }
  // 给作物加成的设施（鸡舍、雨水桶）；每个游戏分钟只算一次。
  cropBoosters() {
    const key = this.s.day * 1440 + Math.floor(this.s.minute) + ":" + this.s.buildings.length + ":" + this.s.plots.length;
    if (this._cropKey !== key) {
      this._cropKey = key;
      this._cropList = [];
      for (const b of this.s.buildings)
        if (b.hp > 0) for (const rule of ADJ) if (rule.crop && rule.a === b.type && this.adjRuleMet(rule, b.x, b.y, b)) this._cropList.push({ x: b.x, y: b.y, r: rule.r, crop: rule.crop });
    }
    return this._cropList;
  }
  cropGrowthRate(p) {
    let bonus = 0;
    if ((p.region || "farm") === "farm") for (const b of this.cropBoosters()) if (dist(b, p) <= b.r) bonus += b.crop;
    return super.cropGrowthRate(p) * (1 + Math.min(0.3, bonus));
  }
  stallPrice(slot) {
    const p = super.stallPrice(slot);
    const boosted = this.s.buildings.some((b) => b.type === "stall" && this.adjActive(b).some((r) => r.stall));
    return boosted ? Math.round(p * 1.1) : p;
  }
  efficiency() {
    return super.efficiency() * (this.ss?.apprentice ? 0.9 : 1);
  }

  // ---------- 食堂营业夜 ----------
  canteenOpen() {
    return this.ss.he.stage >= 4;
  }
  isCanteenDay(day = this.s.day) {
    return CANTEEN_DAYS.includes(day % 7);
  }
  canteenReason() {
    const n = this.ss.canteen;
    if (!this.canteenOpen()) return "何大勺入伙后才开食堂";
    if (n.night) return "";
    if (!this.isCanteenDay()) return "食堂每周两晚营业（每 7 天里的第 2、5 天）";
    if (n.lastDay === this.s.day) return "今晚已经营业过了";
    if (this.s.minute < CANTEEN_HOURS[0] || this.s.minute >= CANTEEN_HOURS[1] - 30) return "19:00–21:00 开张，21:30 打烊";
    if (["warning", "active"].includes(this.raidState().phase) || ["warning", "active"].includes(this.s.horde.phase)) return "外面在打仗，今晚不开张";
    if (!this.dishesInStock().length) return "一道做好的菜都没有：先在篝火灶做菜";
    return "";
  }
  dishesInStock() {
    const menu = [...new Set(Object.values(TASTES).flatMap((t) => t.dishes))];
    return menu.filter((id) => this.quantityForCost(id, true) > 0);
  }
  startCanteen() {
    const reason = this.canteenReason();
    if (reason || this.ss.canteen.night) {
      if (reason) this.toast(reason + "。", "warn");
      return false;
    }
    if (!this.atSpot(SSPOTS.plaza, 150)) {
      this.toast("到前哨广场开张。", "warn");
      return false;
    }
    this.ss.canteen.night = { day: this.s.day, customers: [], spawned: 0, nextIn: 0, income: 0, score: 0, served: 0, wrong: 0, missed: 0 };
    this.spawnGuest();
    this.toast("前哨食堂开张了！何大勺在灶边吆喝。客人会说想吃什么口味，在广场按 E 上菜。", "gold");
    this.olog("食堂营业夜开张。");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  spawnGuest() {
    const n = this.ss.canteen.night;
    if (!n || n.spawned >= CANTEEN_GUESTS) return;
    const tastes = Object.keys(TASTES).filter((t) => TASTES[t].dishes.length),
      i = n.spawned,
      seed = this.s.day * 7 + i;
    // 第一位客人的口味总能用库存满足，免得一开张就卡住。
    const stock = this.dishesInStock();
    let taste = tastes[(seed * 5 + Math.floor(this.roll() * tastes.length)) % tastes.length];
    if (i === 0) taste = tastes.find((t) => TASTES[t].dishes.some((d) => stock.includes(d))) || taste;
    n.customers.push({
      id: "g" + i,
      name: GUEST_NAMES[(seed + i) % GUEST_NAMES.length],
      look: seed % VISITOR_LOOKS.length,
      taste,
      patience: CANTEEN_PATIENCE,
      waited: 0,
      state: "waiting",
    });
    n.spawned++;
    n.nextIn = CANTEEN_GAP;
  }
  canteenTick(minutes) {
    const n = this.ss.canteen.night;
    if (!n || minutes <= 0) return;
    for (const g of n.customers)
      if (g.state === "waiting") {
        g.waited = Math.min(g.patience, g.waited + minutes);
        if (g.waited >= g.patience) {
          g.state = "left";
          n.missed++;
          this.toast(g.name + "等不及，走了。", "warn");
        }
      }
    if (n.spawned < CANTEEN_GUESTS) {
      n.nextIn -= minutes;
      if (n.nextIn <= 0) this.spawnGuest();
    }
    if ((n.spawned >= CANTEEN_GUESTS && n.customers.every((g) => g.state !== "waiting")) || this.s.minute >= CANTEEN_HOURS[1] || n.day !== this.s.day) this.endCanteen();
  }
  serveGuest(gid, dishId) {
    const n = this.ss.canteen.night,
      g = n?.customers.find((x) => x.id === gid);
    if (!n || !g || g.state !== "waiting") return false;
    if (!this.atSpot(SSPOTS.plaza, 150)) {
      this.toast("回到前哨广场上菜。", "warn");
      return false;
    }
    if (!ITEMS[dishId]?.food || !this.takeFarm({ [dishId]: 1 })) {
      this.toast("没有这道菜了。", "warn");
      return false;
    }
    const match = TASTES[g.taste].dishes.includes(dishId),
      quick = 1 - g.waited / g.patience,
      table = this.s.buildings.some((b) => b.type === "table" && this.adjActive(b).some((r) => r.canteen)) ? 0.1 : 0,
      price = Math.round((ITEMS[dishId].sell || 10) * (match ? 1.5 : 1) * (1 + table + 0.2));
    g.state = "served";
    n.served++;
    if (!match) n.wrong++;
    n.score += (match ? 10 + Math.round(quick * 5) : 3) * (1 + table);
    n.income += price;
    this.s.money += price;
    this.toast(g.name + (match ? "吃得心满意足" : "说不太对口，还是吃完了") + "：+" + price + " 金币。", match ? "gold" : "normal");
    this.canteenTick(0.001);
    return true;
  }
  endCanteen() {
    const c = this.ss.canteen,
      n = c.night;
    if (!n) return false;
    for (const g of n.customers) if (g.state === "waiting") (g.state = "left"), n.missed++;
    const delta = (n.served - n.wrong) * 4 + n.wrong - n.missed * 4;
    c.rep = clamp(c.rep + delta, 0, 100);
    c.nights++;
    c.lastDay = n.day;
    c.night = null;
    const text =
      "食堂打烊：招待 " + n.served + " 位（" + (n.served - n.wrong) + " 位对口），走掉 " + n.missed + " 位；收入 " + n.income + " 金币，口碑 " + (delta >= 0 ? "+" : "") + delta + "（现在 " + c.rep + "）。";
    this.toast(text, delta >= 0 ? "gold" : "warn");
    this.olog(text, delta >= 0 ? "gold" : "warn");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  sleep() {
    if (this.ss?.canteen.night) {
      this.toast("食堂还开着：先打烊再去睡。", "warn");
      this.endCanteen();
    }
    return super.sleep();
  }
  price(trader, id, direction) {
    const p = super.price(trader, id, direction);
    if (direction === "sell" && (this.ss?.canteen.rep || 0) >= 50 && ITEMS[id]?.food) return Math.round(p * 1.1);
    return p;
  }
  leaveCaravan() {
    const ok = super.leaveCaravan();
    const c = this.o.caravan;
    if (ok && (this.ss?.canteen.rep || 0) >= 70 && c.next > this.s.day + 2) {
      c.next--;
      this.olog("食堂口碑好，唐九说第" + c.next + "天就来。");
    }
    return ok;
  }

  // ---------- 营火夜谈 ----------
  fireSpot() {
    const camp = this.sc?.camp;
    return camp ? { x: camp.x + 46, y: camp.y - 8 } : null;
  }
  talkPeople() {
    const out = [];
    for (const r of this.c.residents) out.push({ id: r.id, name: this.residentName(r.id), kind: "r", sad: (r.morale ?? 60) <= 40 });
    for (const h of this.sc?.helpers || []) out.push({ id: h.id, name: this.helperName(h.id), kind: "h", sad: h.fedDay !== this.s.day });
    for (const c of this.o?.crew || []) if (c.task !== "scout") out.push({ id: c.id, name: c.name, kind: "c", sad: /冻|没吃/.test(c.status || "") });
    for (const id of this.joinedNpcs()) out.push({ id, name: SNPCS[id].name, kind: "n", sad: false });
    return out.sort((a, b) => (this.ss.trust[a.id] || 0) - (this.ss.trust[b.id] || 0) || a.id.localeCompare(b.id)).slice(0, 3);
  }
  talkReason() {
    if (!this.festivalsOpen() || !this.fireSpot()) return "援建营地搭起来、第三段之后才有营火夜谈";
    if (this.ss.talk.day === this.s.day) return "今晚已经聊过了";
    if (this.s.minute < TALK_HOURS[0] || this.s.minute >= TALK_HOURS[1]) return "晚饭后 19:00–23:00 才围着营火聊";
    if (this.talkPeople().length < 2) return "营火边至少要有两个人";
    return "";
  }
  talkReady(id) {
    return !this.talkReason() && this.talkPeople().some((p) => p.id === id);
  }
  talk(topic) {
    const reason = this.talkReason();
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    if (this.s.region !== "farm" || dist(this.s.player, this.fireSpot()) > 150) {
      this.toast("到援建营地的营火边坐下。", "warn");
      return false;
    }
    const people = this.talkPeople(),
      [kind, who] = String(topic).split(":");
    let text;
    if (kind === "comfort") {
      const p = people.find((x) => x.id === who);
      if (!p) return false;
      const r = this.resident(p.id);
      if (r) r.morale = clamp((r.morale ?? 60) + 12, 0, 100);
      this.addTrust(p.id, 2);
      text = "你陪" + p.name + "坐了很久。" + (r ? "士气 +12，" : "") + "信任 +2。";
    } else if (kind === "past") {
      for (const p of people) this.addTrust(p.id, 1);
      text = "大家说起末日以前的日子：" + people.map((p) => p.name).join("、") + "信任 +1。";
    } else if (kind === "future") {
      this.residentsMood(4);
      text = "大家聊起开春要种什么、要盖什么。居民士气 +4。";
    } else if (kind === "today") {
      this.xp("agriculture", 4);
      this.xp("combat", 4);
      text = "大家说了说今天的事。你的农业与战斗经验各 +4。";
    } else return false;
    const t = this.ss.talk;
    t.day = this.s.day;
    t.count++;
    // 每三次夜谈，总有人透露点消息。
    if (t.count % 3 === 0) text += " " + this.talkTip();
    this.toast(text, "gold");
    this.olog("营火夜谈：" + (TOPICS[kind]?.name || "安慰"));
    return true;
  }
  talkTip() {
    const c = this.c;
    const lq = this.ss.laoqin;
    const missing = lq.quest ? Object.keys(SHEET_SPOTS).filter((k) => !lq.sheets.includes(k)) : [];
    if (missing.length) return "有人说在" + { market: "集市", residential: "住宅区", hospital: "旧医院", warehouse: "工业仓库" }[missing[0]] + "见过一张散落的歌谱。";
    if (c.nextHordeDay) return "守夜的人说：尸潮大概第" + c.nextHordeDay + "天来。";
    this.putStorage({ seedHerb: 2 });
    return "铁锹塞给你两颗药草种子（已入仓）。";
  }

  // ---------- 信任、喜好、生日 ----------
  addTrust(id, n) {
    this.ss.trust[id] = clamp((this.ss.trust[id] || 0) + n, 0, 10);
  }
  likes(id) {
    return (SNPCS[id]?.likes || LIKES[id] || []).filter((x) => ITEMS[x]);
  }
  birthday(id, day = this.s.day) {
    return BIRTHDAYS[id] === ((day - 1) % 28) + 1;
  }
  joinedNpcs() {
    const s = this.ss,
      out = [];
    if (s.he.stage >= 4) out.push("he");
    if (s.adou.phase === "runner") out.push("adou");
    if (s.ali.phase === "painting") out.push("ali");
    if (s.qin.phase === "staying") out.push("qin");
    return out;
  }
  // 认识的人：营地成员与各路人物。
  people() {
    const out = [],
      o = this.o,
      w = this.w,
      s = this.ss,
      add = (id, kind, name, title) => out.push({ id, kind, name, title });
    for (const r of this.c.residents) add(r.id, "居民", this.residentName(r.id), "居民");
    for (const h of this.sc?.helpers || []) add(h.id, "援建队员", this.helperName(h.id), "援建队员");
    for (const c of o?.crew || []) add(c.id, "援建队员", c.name, "援建队员");
    if (o?.caravan.visits > 0) add("tangjiu", "人物", "唐九", "流动商队");
    if (w) {
      if (["stayed", "arrived", "warned"].includes(w.ge.phase)) add("ge", "人物", "葛队长", "想回城的人");
      if (["here", "fed", "left"].includes(w.alan.phase)) add("alan", "人物", "阿兰", "牧羊人");
      if (w.amo.met) add("amo", "人物", "阿默", "地底的灰皮人");
      if (["hosting", "exposed", "apologized"].includes(w.yeying.phase)) add("yeying", "人物", "夜莺", "电台主持");
      if (w.museum.built) add("suyan", "人物", "苏砚", "档案员");
    }
    if (s.he.stage > 0) add("he", "人物", "何大勺", SNPCS.he.title);
    if (s.qin.phase !== "none") add("qin", "人物", "秦奶奶", SNPCS.qin.title);
    if (["sister", "runner", "note"].includes(s.adou.phase)) add("adou", "人物", "阿豆", SNPCS.adou.title);
    if (s.ali.phase !== "none") add("ali", "人物", "阿砾", SNPCS.ali.title);
    if (s.laoqin.met) add("laoqin", "人物", "老琴", SNPCS.laoqin.title);
    if (s.jiang.phase !== "none") add("jiang", "人物", "江伯", SNPCS.jiang.title);
    return out.filter((p, i) => out.findIndex((x) => x.id === p.id) === i);
  }
  giftReason(id, item) {
    if (!this.people().some((p) => p.id === id)) return "还不认识";
    if (this.ss.gifts[id] === this.s.day) return "今天已经送过了";
    if (!this.likes(id).includes(item)) return "不是他喜欢的东西";
    if (this.quantityForCost(item, true) < 1) return "没有" + (ITEMS[item]?.name || item);
    return "";
  }
  giveGift(id, item) {
    const reason = this.giftReason(id, item);
    if (reason || !this.takeFarm({ [item]: 1 })) {
      this.toast((reason || "送不出去") + "。", "warn");
      return false;
    }
    const bday = this.birthday(id),
      n = bday ? 2 : 1;
    this.ss.gifts[id] = this.s.day;
    this.addTrust(id, n);
    const r = this.resident(id);
    if (r) r.morale = clamp((r.morale ?? 60) + 3, 0, 100);
    const name = this.people().find((p) => p.id === id)?.name || id;
    this.toast("送给" + name + "一份" + ITEMS[item].name + (bday ? "——今天是他的生日！" : "。") + "信任 +" + n + "。", "gold");
    return true;
  }
  slowed(key) {
    const id = key.split(":")[1];
    if ((this.ss?.trust[id] || 0) >= 6 && /^[ch]:/.test(key)) return false;
    return super.slowed(key);
  }

  // ---------- 学徒 ----------
  pupils() {
    return [...(this.sc?.helpers || []).map((h) => ({ id: h.id, name: this.helperName(h.id) })), ...(this.o?.crew || []).map((c) => ({ id: c.id, name: c.name }))];
  }
  apprenticeReason(master, pupil) {
    if (this.ss.apprentice) return "已经有人在带徒弟了";
    if (!CRAFTS[master] || !this.resident(master)) return "师父得是在营地的阿禾、陈工或许医生";
    const p = this.pupils().find((x) => x.id === pupil);
    if (!p) return "徒弟得是援建队员";
    if (this.ss.skills[pupil]) return p.name + "已经学会" + SKILL_NAMES[this.ss.skills[pupil]] + "了";
    return "";
  }
  startApprentice(master, pupil) {
    const reason = this.apprenticeReason(master, pupil);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const skill = CRAFTS[master].skill;
    this.ss.apprentice = { master, pupil, skill, start: this.s.day };
    const name = this.pupils().find((x) => x.id === pupil).name;
    this.toast(this.residentName(master) + "开始带" + name + "学" + SKILL_NAMES[skill] + "：" + APPRENTICE_DAYS + " 天后出师；这几天加工慢一成。", "gold");
    this.olog(this.residentName(master) + "带" + name + "学" + SKILL_NAMES[skill] + "。");
    return true;
  }
  stopApprentice() {
    if (!this.ss.apprentice) return false;
    this.ss.apprentice = null;
    this.toast("带徒中断了。");
    return true;
  }
  apprenticeMorning() {
    const a = this.ss.apprentice;
    if (!a) return;
    const pupil = this.pupils().find((x) => x.id === a.pupil);
    if (!pupil || !this.resident(a.master)) {
      this.ss.apprentice = null;
      this.olog("师父或徒弟不在了，带徒中断。", "warn");
      return;
    }
    if (this.s.day - a.start >= APPRENTICE_DAYS) {
      this.ss.skills[a.pupil] = a.skill;
      this.ss.apprentice = null;
      this.addTrust(a.pupil, 1);
      this.addTrust(a.master, 1);
      const text = pupil.name + "出师了：学会" + SKILL_NAMES[a.skill] + "（" + Object.values(CRAFTS).find((c) => c.skill === a.skill).desc + "）。";
      this.toast(text, "gold");
      this.olog(text, "gold");
    }
  }
  skilled(skill) {
    const ids = new Set(this.pupils().map((p) => p.id));
    return Object.entries(this.ss.skills).filter(([id, s]) => s === skill && ids.has(id)).map(([id]) => id);
  }
  skillHour(hour) {
    if (hour === 7 && this.skilled("water").length) {
      let n = 0;
      for (const p of this.s.plots)
        if ((p.region || "farm") === "farm" && p.crop && !this.plotWatered(p) && n < 6 * this.skilled("water").length) {
          this.waterPlot(p);
          n++;
        }
      if (n) this.olog("学徒浇了 " + n + " 块田。");
    }
    if ((hour === 10 || hour === 15) && this.skilled("repair").length) {
      const b = this.s.buildings
        .filter((x) => x.hp > 0 && x.hp < (BUILDINGS[x.type]?.hp || 0))
        .sort((a, c) => a.hp / BUILDINGS[a.type].hp - c.hp / BUILDINGS[c.type].hp)[0];
      if (b) {
        b.hp = Math.min(BUILDINGS[b.type].hp, b.hp + 15);
        this.navRevision++;
      }
    }
    if (hour === 18 && this.skilled("bandage").length) {
      if (this.o.sick >= this.s.day && this.takeFarm({ bandage: 1 })) {
        this.o.sick = 0;
        this.toast("学会包扎的队员用 1 条绷带治好了营地病号。", "gold");
      }
      if (this.s.region === "farm" && this.s.player.hp < 70) this.s.player.hp = Math.min(100, this.s.player.hp + 15);
    }
  }

  // ---------- 过路人借宿 ----------
  freeBeds() {
    return Math.max(0, this.residentsCapacity() - this.c.residents.length);
  }
  lodgerArrive() {
    const s = this.ss;
    if (s.lodger || !this.festivalsOpen() || s.qin.phase === "staying") return false;
    if (["warning", "active"].includes(this.raidState().phase) || ["warning", "active"].includes(this.s.horde.phase)) return false;
    if (s.qin.phase === "none") {
      s.lodger = { name: "秦奶奶", look: "qin", gift: "qin", stay: false, phase: "asking", day: this.s.day, qin: true };
      s.qin.phase = "asking";
    } else {
      const i = Math.floor(this.roll() * LODGER_NAMES.length) % LODGER_NAMES.length;
      s.lodger = {
        name: LODGER_NAMES[i],
        look: (i + s.lodgers) % VISITOR_LOOKS.length,
        gift: LODGER_GIFTS[Math.floor(this.roll() * LODGER_GIFTS.length) % LODGER_GIFTS.length],
        stay: this.roll() < 0.25,
        phase: "asking",
        day: this.s.day,
        qin: false,
      };
    }
    s.lodgers++;
    s.lodgerNext = this.s.day + 3 + (s.lodgers % 2);
    this.toast(s.lodger.name + "在营门口敲门，想借宿一晚（23:00 前答复）。", "gold");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  lodgerReason() {
    const l = this.ss.lodger;
    if (!l || l.phase !== "asking") return "没有人在等";
    if (!this.freeBeds() && !this.rooms().some((r) => r.active)) return "没有空床，也没有布置好的房间（床位 " + this.residentsCapacity() + "，住了 " + this.c.residents.length + " 人）";
    if (this.foodPortions() < 1) return "仓库里没有一份口粮招待";
    return "";
  }
  decideLodger(choice) {
    const s = this.ss,
      l = s.lodger;
    if (!l || l.phase !== "asking") return false;
    if (choice === "decline") {
      s.lodger = null;
      if (l.qin) s.qin.phase = "none";
      this.toast(l.name + "点点头，摸黑走了。");
      if (this.s.region === "farm") this.assignRegion();
      return true;
    }
    if (choice !== "host") return false;
    const reason = this.lodgerReason();
    if (reason || !this.takeMeal()) {
      this.toast((reason || "没有口粮招待") + "。", "warn");
      return false;
    }
    l.phase = "staying";
    if (l.qin) {
      s.qin.phase = "staying";
      s.qin.since = this.s.day;
      s.lodger = null;
      this.toast("秦奶奶：" + SNPCS.qin.lines.wish, "gold");
      this.olog("秦奶奶住了下来，有三个心愿。");
    } else this.toast(l.name + "吃了顿热饭，在农舍西边铺开铺盖。", "gold");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  lodgerMorning() {
    const s = this.ss,
      l = s.lodger;
    if (!l || l.phase !== "staying") return;
    let gain = null,
      text = l.name + "一早上路了";
    if (l.gift === "seeds") {
      gain = {};
      SEEDS.slice()
        .sort((a, b) => this.quantityForCost(a, true) - this.quantityForCost(b, true))
        .slice(0, 3)
        .forEach((id) => (gain[id] = 2));
      text += "，留下" + bundleText(gain);
    } else if (l.gift === "item") {
      gain = { parts: 2, cloth: 1 };
      text += "，留下" + bundleText(gain);
    } else if (l.gift === "recipe") {
      const want = HE_DISHES[s.he.stage - 1];
      gain = s.he.stage >= 1 && s.he.stage <= 3 && want ? { [want]: 1 } : { bread: 4 };
      text += "，留下一份家乡菜：" + bundleText(gain);
    } else {
      const c = this.c;
      text += c.nextHordeDay ? "，说路上看见尸群往这边挪，大概第" + c.nextHordeDay + "天到" : "，说南边的路这几天太平";
      if (this.o.caravan.next) text += "；唐九的车第" + this.o.caravan.next + "天到";
    }
    if (gain) this.putStorage(gain);
    if (l.stay) {
      s.pendingGuest = l.name;
      this.o.visitors.next = this.s.day;
      text += "。走到营门又折回来：想留下，等你审查";
    }
    s.lodger = null;
    this.toast(text + "。", "gold");
    this.olog(text + "。");
    if (this.s.region === "farm") this.assignRegion();
  }
  arriveVisitor() {
    const name = this.ss?.pendingGuest;
    if (!name) return super.arriveVisitor();
    // 借宿后想留下的人：先截住这次来访的提示，换成他自己的名字再发出。
    const buf = [],
      own = { toast: Object.hasOwn(this, "toast"), olog: Object.hasOwn(this, "olog") },
      orig = { toast: this.toast, olog: this.olog };
    this.toast = (...a) => buf.push(["toast", a]);
    this.olog = (...a) => buf.push(["olog", a]);
    let ok;
    try {
      ok = super.arriveVisitor();
    } finally {
      for (const k of ["toast", "olog"]) {
        if (own[k]) this[k] = orig[k];
        else delete this[k];
      }
    }
    const v = this.o.visitors.current,
      old = v?.name;
    if (ok && v && v.huer === null) {
      v.name = name;
      v.kind = "honest";
      if (typeof v.story === "string" && old) v.story = v.story.split(old).join(name);
      const list = VISITOR_CLUES.honest;
      v.clues = { papers: list.papers[0], body: list.body[0], bag: list.bag[0] };
      this.ss.pendingGuest = null;
    }
    for (const [k, a] of buf) {
      const text = ok && old && v?.name === name ? String(a[0]).split(old).join(name) : a[0];
      this[k](text, ...a.slice(1));
    }
    return ok;
  }

  // ---------- 秦奶奶 ----------
  qinWish(id, why) {
    const q = this.ss.qin;
    if (q.phase !== "staying" || q.wishes.includes(id)) return false;
    q.wishes = [...q.wishes, id];
    this.addTrust("qin", 2);
    this.toast("秦奶奶的心愿了了一个：" + why + "（" + q.wishes.length + "/3）", "gold");
    this.olog("秦奶奶：" + why);
    return true;
  }
  qinCake() {
    if (this.ss.qin.phase !== "staying" || this.ss.qin.wishes.includes("cake")) return false;
    if (!this.takeFarm({ radishCake: 1 })) {
      this.toast("还没有萝卜糕（何大勺的第二道菜）。", "warn");
      return false;
    }
    return this.qinWish("cake", "吃上了萝卜糕，跟她小时候的味道一样");
  }
  qinPhoto() {
    if (this.ss.qin.phase !== "staying" || this.ss.qin.wishes.includes("sea")) return false;
    if (!this.f.photos.some((p) => p.subjects?.includes("towerPond"))) {
      this.toast("还没有拍到大片水面的照片（瞭望塔和池塘同框）。也可以等去沉湾船坞时替她看海。", "warn");
      return false;
    }
    return this.qinWish("sea", "看着照片里的水面，说这就是她记得的海");
  }
  travel(id) {
    const ok = super.travel(id);
    if (ok && id === "shipyard") this.qinWish("sea", "你在船坞替她看了海，回来讲给她听");
    return ok;
  }
  qinMorning() {
    const q = this.ss.qin;
    if (q.phase !== "staying" || q.wishes.length < 3) return;
    q.phase = "left";
    if (this.sonce("qin")) {
      this.putStorage({ oldPhoto: 1 });
      this.addReputation(3);
    }
    this.toast("秦奶奶：" + SNPCS.qin.lines.done + "（老照片已入仓：居民士气以后每天 +1）", "gold");
    this.olog("秦奶奶坐最后一班渡船走了，留下一张老照片。", "gold");
    if (this.s.region === "farm") this.assignRegion();
  }

  // ---------- 何大勺 ----------
  heHere() {
    return this.s.region === SSPOTS.he.region && this.ss.he.stage < 4 && this.festivalsOpen();
  }
  heWant() {
    const st = this.ss.he.stage;
    return st >= 1 && st <= 3 ? HE_DISHES[st - 1] : null;
  }
  heTalk() {
    const h = this.ss.he;
    if (!this.heHere() || dist(this.s.player, SSPOTS.he) > 130) return false;
    if (h.stage === 0) {
      h.stage = 1;
      this.toast("何大勺：" + SNPCS.he.lines.hello + "（第一道：行军炖菜——土豆 2、豆子 1、萝卜 1，篝火灶）", "gold");
      this.olog("何大勺口述了第一道菜：行军炖菜。");
      return true;
    }
    return false;
  }
  heDeliver() {
    const h = this.ss.he,
      want = this.heWant();
    if (!want || !this.heHere() || dist(this.s.player, SSPOTS.he) > 130) return false;
    if (this.quantityForCost(want, true) < 1 || !this.takeFarm({ [want]: 1 })) {
      this.toast("带一份" + ITEMS[want].name + "来给何大勺尝。", "warn");
      return false;
    }
    h.stage++;
    this.addTrust("he", 2);
    if (h.stage >= 4) {
      this.toast("何大勺：" + SNPCS.he.lines.joined + "（又教了你豆渣饼、炊事班大饼；前哨广场每周两晚开食堂）", "gold");
      this.olog("何大勺入伙：食堂营业夜开张。", "gold");
      this.assignRegion();
    } else {
      const next = HE_DISHES[h.stage - 1];
      this.toast("何大勺：" + SNPCS.he.lines.dish + "（第" + h.stage + "道：" + ITEMS[next].name + "）", "gold");
    }
    return true;
  }
  recipeReason(r) {
    const i = HE_DISHES.indexOf(r.id);
    if (i >= 0 && this.ss.he.stage < i + 1) return "要何大勺口述这道菜";
    if (HE_BONUS.includes(r.id) && this.ss.he.stage < 4) return "何大勺入伙后才教";
    return super.recipeReason(r);
  }

  // ---------- 阿豆 ----------
  adouNight() {
    const a = this.ss.adou;
    if (!this.festivalsOpen() || (this.sc?.act || 1) < 4) return;
    if (a.phase === "none" && this.ss.fest.held.length >= 1 && (this.s.storage.bread || 0) >= 3) a.phase = "stealing";
    if (a.phase !== "stealing" || a.lastTheft === this.s.day) return;
    if ((this.s.storage.bread || 0) < 1) return;
    this.s.storage.bread--;
    if (!this.s.storage.bread) delete this.s.storage.bread;
    a.thefts++;
    a.lastTheft = this.s.day;
    this.olog("仓库夜里少了 1 份干粮。", "warn");
    this.toast(a.thefts >= 2 ? "仓库又少了 1 份干粮——连着两晚了。今晚 22 点后去仓库箱边蹲守。" : "清点仓库：夜里少了 1 份干粮。", "warn");
  }
  adouVisible() {
    const a = this.ss.adou;
    if (a.phase === "stealing") return a.thefts >= 2 && (this.s.minute >= 22 * 60 || this.s.minute < 5 * 60);
    return a.phase === "sister" || (a.phase === "runner" && (this.s.minute >= 19 * 60 || this.s.minute < 6 * 60));
  }
  adouDecide(choice) {
    const a = this.ss.adou;
    if (a.phase !== "stealing" || !this.adouVisible()) return false;
    if (choice === "catch") {
      a.phase = "sister";
      this.addTrust("adou", 1);
      this.toast("阿豆：" + SNPCS.adou.lines.caught, "gold");
    } else if (choice === "ignore") {
      a.phase = "note";
      this.toast("你假装没看见。那孩子抱着一份干粮溜进了夜色。");
    } else return false;
    this.olog("抓到偷粮的孩子阿豆。");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  adouMedicine() {
    const a = this.ss.adou;
    if (a.phase !== "sister") return false;
    const med = ["bandage", "herbTea", "medkit"].find((id) => this.quantityForCost(id, true) > 0);
    if (!med || !this.takeFarm({ [med]: 1 })) {
      this.toast("给他妹妹带点药：绷带、草药茶或药包都行。", "warn");
      return false;
    }
    a.phase = "runner";
    this.addTrust("adou", 2);
    this.toast("阿豆：" + SNPCS.adou.lines.thanks + "（送货快四分之一；夜里守着仓库，小偷偷不走东西）", "gold");
    this.olog("阿豆成了前哨的跑腿。", "gold");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  stealFromStorage(name, stacks) {
    if (this.ss?.adou.phase === "runner") {
      const text = name + "夜里想撬仓库，被守夜的阿豆喊破，空着手跑了。";
      this.olog(text, "gold");
      this.toast(text, "gold");
      return {};
    }
    return super.stealFromStorage(name, stacks);
  }
  advanceMinutes(n) {
    const before = this.s.day * 1440 + this.s.minute;
    super.advanceMinutes(n);
    const elapsed = this.s.day * 1440 + this.s.minute - before;
    if (!this.ss || !(elapsed > 0)) return;
    this.canteenTick(elapsed);
    if (this.ss.adou.phase === "runner") {
      for (const sh of this.d?.freight || []) if (sh.remaining > 0) sh.remaining = Math.max(0, Math.round((sh.remaining - elapsed * 0.25) * 100) / 100);
      for (const sh of this.b?.shipments || []) if (sh.remaining > 0) sh.remaining = Math.max(0, Math.round((sh.remaining - elapsed * 0.25) * 100) / 100);
    }
  }

  // ---------- 阿砾 ----------
  aliArrive() {
    const a = this.ss.ali;
    if (a.phase !== "none") return false;
    a.phase = "here";
    this.toast("南边围栏上多了一片乱涂乱画——一个少年正拎着炭条。", "normal");
    return true;
  }
  aliDecide(choice) {
    const a = this.ss.ali;
    if (a.phase !== "here") return false;
    if (choice === "scold") {
      a.phase = "scolded";
      this.toast("阿砾：" + SNPCS.ali.lines.scolded);
    } else if (choice === "paint") {
      a.phase = "painting";
      this.addTrust("ali", 2);
      this.toast("阿砾：" + SNPCS.ali.lines.paint + "（每完成一段故事，围栏上就多一幅壁画）", "gold");
      this.olog("阿砾开始在南边围栏上画前哨的大事。");
    } else return false;
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  actsDone() {
    return (this.sc?.claimed || []).filter((x) => /^act\d$/.test(x)).length;
  }
  aliMorning() {
    const a = this.ss.ali;
    if (a.phase !== "painting" || a.lastPaint === this.s.day || a.murals >= Math.min(8, this.actsDone())) return;
    a.murals++;
    a.lastPaint = this.s.day;
    this.olog("阿砾画好了第 " + a.murals + " 幅壁画。");
    if (a.murals === 3) this.toast("围栏上已经有三幅壁画了，路过的居民总会停下来看一会儿（士气每天 +1）。", "gold");
  }

  // ---------- 老琴 ----------
  laoqinHere() {
    return this.festivalWindow() && this.s.region === "farm";
  }
  laoqinSong() {
    const l = this.ss.laoqin;
    if (!this.laoqinHere() || !this.atSpot(SSPOTS.plaza, 160)) return false;
    if (l.requestDay === this.s.day) {
      this.toast("老琴：今晚嗓子唱哑啦，明年再来。");
      return false;
    }
    l.met = true;
    l.requestDay = this.s.day;
    this.residentsMood(3);
    this.addTrust("laoqin", 1);
    let text = "老琴：" + SNPCS.laoqin.lines.song + "（居民士气 +3）";
    if (!l.quest) {
      l.quest = true;
      text += " " + SNPCS.laoqin.lines.hello;
    }
    this.toast(text, "gold");
    this.qinWish("song", "听老琴唱了一首她年轻时的歌");
    for (const reg of Object.keys(SHEET_SPOTS)) if (!l.sheets.includes(reg) && this.s.region === reg) this.assignRegion();
    return true;
  }
  pickSheet(reg) {
    const l = this.ss.laoqin,
      sp = SHEET_SPOTS[reg];
    if (!l.quest || !sp || l.sheets.includes(reg) || this.s.region !== sp.region || dist(this.s.player, sp) > 130) return false;
    l.sheets = [...l.sheets, reg];
    this.addTrust("laoqin", 1);
    this.toast("找到一张老琴的歌谱（" + l.sheets.length + "/4）。" + SNPCS.laoqin.lines.sheet + "（电台多了《老歌》节目）", "gold");
    this.olog("找回老琴的歌谱 " + l.sheets.length + "/4。");
    this.assignRegion();
    return true;
  }
  programReason(id) {
    if (id === "oldsongs" && !this.ss?.laoqin.sheets.length) return "还没有找回老琴的歌谱";
    return super.programReason(id);
  }
  airProgram() {
    const r = this.w.radio,
      id = r.program;
    const ok = super.airProgram();
    if (ok && id === "oldsongs") {
      const n = Math.round(2 * this.ss.laoqin.sheets.length * this.radioHost() * (this.decree("silence") ? 0.5 : 1));
      this.residentsMood(n);
      this.toast("电台放起老琴的歌谱。居民士气 +" + n + "。", "gold");
    }
    if (ok && ["songs", "oldsongs"].includes(id)) this.qinWish("song", "在电台里听到了一首老歌");
    return ok;
  }

  // ---------- 江伯 ----------
  jiangHere() {
    return this.festivalsOpen() && this.s.region === "farm" && this.ss.jiang.phase !== "done";
  }
  jiangTalk() {
    const j = this.ss.jiang;
    if (!this.jiangHere() || !this.atSpot(SSPOTS.jiang)) return false;
    if (j.phase === "none") {
      j.phase = "c1";
      this.toast("江伯：" + SNPCS.jiang.lines.hello + "（" + JIANG_TASKS.c1.name + "）", "gold");
      return true;
    }
    const task = JIANG_TASKS[j.phase];
    if (!task) return false;
    const lack = missingCost(this, task.need);
    if (lack.length || !this.takeFarm(task.need)) {
      this.toast("江伯：" + task.name + "。还差：" + lack.join("、"), "warn");
      return false;
    }
    this.addTrust("jiang", 1);
    if (j.phase === "c1") {
      j.rod = 1;
      j.phase = "c2";
      this.toast("江伯给你的鱼竿换了根新线：咬钩快 0.4 秒。下一件：" + JIANG_TASKS.c2.name + "。", "gold");
    } else if (j.phase === "c2") {
      j.rod = 2;
      j.phase = "mutant";
      this.putStorage({ ammo: 6 });
      this.toast("江伯：" + SNPCS.jiang.lines.mutant + "（鱼竿再升级；弹药 6 入仓）", "gold");
    } else if (j.phase === "mutant") {
      j.phase = "release";
      this.grantResearch(1);
      this.toast("江伯把变异鱼托车队送去给许医生（研究点 +1）。" + SNPCS.jiang.lines.release, "gold");
    } else if (j.phase === "release") {
      j.phase = "done";
      this.toast("江伯：" + SNPCS.jiang.lines.done + "（池塘咬钩再快 0.3 秒）", "gold");
      this.olog("和江伯一起放流了鱼苗。", "gold");
    }
    this.assignRegion();
    return true;
  }
  startFishing(bait = false) {
    const ok = super.startFishing(bait);
    const j = this.ss?.jiang;
    if (ok && j && this.c.fishing) this.c.fishing.biteAt = Math.max(0.6, this.c.fishing.biteAt - 0.4 * j.rod - (j.phase === "done" ? 0.3 : 0));
    return ok;
  }
  hookFish() {
    const before = { ...this.s.inventory };
    const ok = super.hookFish();
    if (ok && this.ss?.jiang.phase === "mutant" && this.s.region === "farm" && !this.quantityForCost("mutantFish", true)) {
      const got = ["fish", "riverFish", "nightFish"].find((id) => (this.s.inventory[id] || 0) > (before[id] || 0));
      if (got && this.roll() < 0.35) {
        this.s.inventory[got]--;
        if (!this.s.inventory[got]) delete this.s.inventory[got];
        this.s.inventory.mutantFish = 1;
        this.toast("钓上来一条鳞片发灰、多一对鳍的鱼——变异鱼！拿去给江伯看。", "warn");
      }
    }
    return ok;
  }

  // ---------- 渐进解锁与“新”标记 ----------
  featureAvailable(key) {
    if (!FEATURES[key]) return false;
    if (["calendar", "people", "plaza"].includes(key)) return this.festivalsOpen();
    if (key === "radio") return !!this.r.radio;
    if (key === "museum") return !!this.w?.museum.built;
    if (key === "winter") return !!this.w?.forecast;
    return true;
  }
  featureNew(key) {
    return this.featureAvailable(key) && !this.ss.seen.includes(key);
  }
  markSeen(key) {
    if (!FEATURES[key] || this.ss.seen.includes(key)) return false;
    this.ss.seen = [...this.ss.seen, key];
    return true;
  }
  newFeatures() {
    return Object.keys(FEATURES).filter((k) => this.featureNew(k));
  }

  // ---------- 同处多对象选择 ----------
  // 只在两个不会走动的对象几乎一样近、并且老规则本来要选的就是其中之一时才弹出选择。
  pickCandidates() {
    const p = this.s.player,
      base = super.nearestObject();
    if (!base || NO_PICK.includes(base.type) || (base.type === "building" && QUIET_TYPES.includes(base.building?.type))) return [];
    let list = this.objects.filter((o) => !NO_PICK.includes(o.type));
    if (this.s.region === "farm") list = list.concat(this.s.buildings.filter((b) => b.hp > 0 && !QUIET_TYPES.includes(b.type)).map((b) => ({ ...b, type: "building", building: b, name: BUILDINGS[b.type].name })));
    list = list
      .map((o) => ({ o, d: dist(o, p) }))
      .filter((x) => x.d < 82)
      .sort((a, b) => a.d - b.d);
    if (list.length < 2 || list[1].d - list[0].d >= 28) return [];
    const same = (a, b) => a === b || (a.type === "building" && b.type === "building" && a.building === b.building) || (a.type === b.type && a.x === b.x && a.y === b.y);
    const out = list.filter((x) => x.d - list[0].d < 28).slice(0, 4).map((x) => x.o);
    return out.some((o) => same(o, base)) ? out : [];
  }
  nearestObject() {
    return this._picked || super.nearestObject();
  }
  pick(i) {
    const ob = this._pickList?.[i];
    this._pickList = null;
    if (!ob) return false;
    this._picked = ob;
    try {
      this.interact();
    } finally {
      this._picked = null;
    }
    return true;
  }
  context(ob) {
    if (this.c?.fishing) return super.context(ob);
    if (!this._picked && ob && !this.paused) {
      const list = this.pickCandidates();
      if (list.length >= 2) return "选择：" + list.map((x) => x.name).join(" / ");
    }
    const s = this.ss;
    if (ob && s) {
      if (ob.type === "seasonPlaza") {
        if (s.canteen.night) return "前哨食堂 · 上菜";
        if (this.festivalWindow() && !this.festivalHosted()) return "前哨广场 · 主持「" + FESTIVALS[this.festivalKind()].name + "」";
        return "前哨广场 · 节庆与食堂";
      }
      if (ob.type === "allianceCamp" && !this.talkReason()) return "营火 · 夜谈";
      if (ob.type === "seasonJiang") return "江伯 · " + (JIANG_TASKS[s.jiang.phase]?.name || "聊聊鱼");
      if (ob.type === "seasonAli") return s.ali.phase === "painting" ? "阿砾的壁画 · " + s.ali.murals + " 幅" : "画墙的少年";
      if (ob.type === "seasonAdou") return s.adou.phase === "runner" ? "阿豆 · 看仓库" : "仓库箱边的孩子";
      if (ob.type === "seasonLodger") return s.qin.phase === "staying" ? "秦奶奶 · 三个心愿" : "借宿的人 · " + (s.lodger?.name || "");
      if (ob.type === "seasonHe") return "何大勺 · " + (this.heWant() ? "尝尝" + ITEMS[this.heWant()].name : "老部队的菜谱");
      if (ob.type === "seasonSheet") return "散落的歌谱 · 捡起";
    }
    return super.context(ob);
  }
  interact() {
    if (this.paused) return;
    if (this.c?.fishing) return super.interact();
    if (!this._picked) {
      const list = this.pickCandidates();
      if (list.length >= 2) {
        this._pickList = list;
        this.emit("menu", { menu: "outpost", view: "pick" });
        return;
      }
    }
    const ob = this.nearestObject(),
      menu = (view, id = "") => this.emit("menu", { menu: "outpost", view, id });
    if (ob?.type === "allianceCamp" && this.ss && !this.talkReason()) return menu("talk");
    if (SEASON_OBJECTS.includes(ob?.type)) {
      if (ob.type === "seasonPlaza") return menu("plaza");
      if (ob.type === "seasonJiang") {
        if (this.ss.jiang.phase === "none") this.jiangTalk();
        return menu("dialog", "jiang");
      }
      if (ob.type === "seasonAli") return menu("dialog", "ali");
      if (ob.type === "seasonAdou") return menu("dialog", "adou");
      if (ob.type === "seasonLodger") return menu("dialog", this.ss.qin.phase === "staying" && !this.ss.lodger ? "qin" : "lodger");
      if (ob.type === "seasonHe") {
        if (this.ss.he.stage === 0) this.heTalk();
        return menu("dialog", "he");
      }
      if (ob.type === "seasonSheet") return this.pickSheet(ob.sheet);
    }
    return super.interact();
  }

  // ---------- 时间钩子 ----------
  workHour() {
    const fatigue = new Map(this.c.residents.map((r) => [r.id, r.fatigue || 0]));
    if (this.ss) this.guardFestival();
    super.workHour();
    if (!this.ss) return;
    const hour = this.hour();
    // 床边有暖光灯：休息的居民多恢复 2。
    if (this.s.buildings.some((b) => b.type === "bed" && this.adjActive(b).some((r) => r.rest)))
      for (const r of this.c.residents) if (fatigue.has(r.id) && (r.fatigue || 0) < fatigue.get(r.id)) r.fatigue = clamp((r.fatigue || 0) - 2, 0, 100);
    if (hour === 3) this.adouNight();
    if (hour === 6) {
      this.apprenticeMorning();
      this.aliMorning();
    }
    if (hour === 7) {
      this.lodgerMorning();
      this.qinMorning();
    }
    if (hour === 8) this.festivalMorning();
    if (hour === 20 && this.s.day >= this.ss.lodgerNext && this.ss.lodgerNext >= 0) this.lodgerArrive();
    if (hour === 23 && this.ss.lodger?.phase === "asking") {
      const l = this.ss.lodger;
      this.ss.lodger = null;
      if (l.qin) this.ss.qin.phase = "none";
      this.olog(l.name + "在营门等到深夜，走了。");
      if (this.s.region === "farm") this.assignRegion();
    }
    if (this.ss.adou.phase === "note" && hour === 7) {
      this.ss.adou.phase = "sister";
      this.toast("阿豆：" + SNPCS.adou.lines.note, "gold");
      if (this.s.region === "farm") this.assignRegion();
    }
    this.skillHour(hour);
    if ([5, 6, 19, 22].includes(hour) && ["stealing", "runner"].includes(this.ss.adou.phase) && this.s.region === "farm") this.assignRegion();
  }
  onNewDay() {
    if (this.ss) this.guardFestival();
    super.onNewDay();
    const s = this.ss;
    if (!s) return;
    this.festivalOverdue();
    for (const id of Object.keys(s.gifts)) if (s.gifts[id] < this.s.day - 1) delete s.gifts[id];
    if (Object.keys(s.trust).length > 120) {
      const keep = new Set([...this.people().map((p) => p.id), ...Object.keys(SNPCS), ...Object.keys(LIKES), ...Object.keys(BIRTHDAYS)]);
      for (const id of Object.keys(s.trust)) if (!keep.has(id)) delete s.trust[id];
    }
    if (s.qin.phase === "staying" && s.qin.since && this.s.day - s.qin.since >= 7 && s.qin.wishes.length < 3) {
      s.qin.phase = "left";
      this.toast("秦奶奶：最后一班渡船不等人，我得走了。谢谢你们收留我这些天。", "normal");
      this.olog("秦奶奶等不到三个心愿都了，先去坐渡船了。");
      if (this.s.region === "farm") this.assignRegion();
    }
    let mood = 0;
    if (s.decor.length >= 2) mood += s.decor.length >= 4 ? 2 : 1;
    if (s.ali.murals >= 3) mood++;
    if (s.qin.phase === "left") mood++;
    if (this.dailyMood?.() !== false) for (const r of this.c.residents) r.morale = clamp((r.morale ?? 60) + mood + ((s.trust[r.id] || 0) >= 6 ? 1 : 0), 0, 100);
    if (s.apprentice) {
      const m = this.resident(s.apprentice.master);
      if (m) m.fatigue = clamp((m.fatigue || 0) + 6, 0, 100);
    }
  }
  serveDinner() {
    const ok = super.serveDinner();
    if (ok && this.s.buildings.some((b) => b.type === "table" && this.adjActive(b).some((r) => r.canteen)))
      for (const r of this.c.residents) if (!this.o.missed.includes("r:" + r.id)) r.morale = clamp((r.morale ?? 60) + 1, 0, 100);
    return ok;
  }
  update(dt, input = {}) {
    const running = !this.paused;
    super.update(dt, input);
    if (!running || this.paused || this.s.region !== "farm" || !this.ss) return;
    for (const t of this.s.buildings)
      if (t.type === "tower" && t.hp > 0 && t.shotTimer > 0 && this.adjActive(t).some((r) => r.tower)) t.shotTimer = Math.max(0, t.shotTimer - dt * 0.25);
  }

  // ---------- 场景对象 ----------
  assignRegion() {
    super.assignRegion();
    const s = this.s.seasons;
    if (!s || !this.s.storyCampaign) return;
    const push = (type, name, spot, extra = {}) => this.objects.push({ type, name, x: spot.x, y: spot.y, icon: 40, ...extra });
    const open = (this.s.storyCampaign.act || 1) >= 3;
    if (this.s.region === "farm" && open) {
      push("seasonPlaza", s.canteen.night ? "前哨食堂" : "前哨广场", SSPOTS.plaza);
      if (s.jiang.phase !== "done") push("seasonJiang", "江伯 · 老渔夫", SSPOTS.jiang);
      if (["here", "painting"].includes(s.ali.phase)) push("seasonAli", s.ali.phase === "painting" ? "阿砾 · 壁画" : "画墙的少年", SSPOTS.ali);
      if (this.adouVisible()) push("seasonAdou", s.adou.phase === "stealing" ? "仓库箱边的影子" : "阿豆", SSPOTS.adou);
      if (s.lodger) push("seasonLodger", s.lodger.name, s.lodger.phase === "asking" ? SSPOTS.gate : SSPOTS.lodger, { lodger: true });
      else if (s.qin.phase === "staying") push("seasonLodger", "秦奶奶", SSPOTS.lodger, { lodger: true });
    }
    if (open && this.s.region === SSPOTS.he.region && s.he.stage < 4) push("seasonHe", "何大勺 · 退伍炊事员", SSPOTS.he);
    if (s.laoqin.quest)
      for (const [reg, sp] of Object.entries(SHEET_SPOTS)) if (this.s.region === sp.region && !s.laoqin.sheets.includes(reg)) push("seasonSheet", "散落的歌谱", sp, { sheet: reg });
  }
  static parse(text) {
    const raw = JSON.parse(text),
      s = WinterEngine.parse(text);
    if (raw.seasons !== undefined) validateSeasons(raw.seasons);
    return migrateState(s);
  }
}

function validateSeasons(x) {
  const object = (v) => v && typeof v === "object" && !Array.isArray(v),
    int = (v, max = 1e9) => Number.isInteger(v) && v >= 0 && v <= max,
    num = (v, a = -1e6, b = 1e9) => Number.isFinite(v) && v >= a && v <= b,
    str = (v, n = 40) => typeof v === "string" && v.length <= n,
    strs = (a, n = 40) => Array.isArray(a) && a.length <= n && a.every((v) => str(v)),
    unique = (a) => new Set(a).size === a.length,
    bad = () => {
      throw Error("四季存档异常，请从设置恢复有效备份；原存档会保留。");
    },
    d = defaults();
  if (!object(x) || x.schema !== SEASONS_SCHEMA || Object.keys(x).some((k) => !Object.hasOwn(d, k))) bad();
  const fe = x.fest;
  if (fe !== undefined && (!object(fe) || !int(fe.lastDay ?? 0) || !int(fe.missed ?? 0) || !int(fe.noticeDay ?? 0) || !Array.isArray(fe.held ?? []) || (fe.held ?? []).length > 60 || !(fe.held ?? []).every((v) => int(v)) || !unique(fe.held ?? []))) bad();
  if (x.decor !== undefined && (!strs(x.decor, 8) || !unique(x.decor) || !x.decor.every((k) => DECOR[k]))) bad();
  const c = x.canteen;
  if (c !== undefined) {
    if (!object(c) || !num(c.rep ?? 0, 0, 100) || !int(c.nights ?? 0) || !int(c.lastDay ?? 0)) bad();
    const n = c.night;
    if (n !== undefined && n !== null) {
      if (!object(n) || !int(n.day) || !int(n.spawned, CANTEEN_GUESTS) || !num(n.nextIn) || !int(n.income) || !num(n.score, 0) || ["served", "wrong", "missed"].some((k) => !int(n[k], 20))) bad();
      if (!Array.isArray(n.customers) || n.customers.length > CANTEEN_GUESTS) bad();
      for (const g of n.customers)
        if (!object(g) || !str(g.id, 8) || !str(g.name, 20) || !TASTES[g.taste] || !GUEST_STATES.includes(g.state) || !num(g.patience, 1, 1000) || !num(g.waited, 0, 1000) || !(int(g.look, 99) || str(g.look, 20))) bad();
    }
  }
  if (x.talk !== undefined && (!object(x.talk) || !int(x.talk.day ?? 0) || !int(x.talk.count ?? 0))) bad();
  for (const k of ["trust", "gifts"]) {
    const m = x[k];
    if (m !== undefined && (!object(m) || Object.keys(m).length > 400 || Object.entries(m).some(([id, v]) => !str(id, 24) || !int(v, k === "trust" ? 10 : 1e9)))) bad();
  }
  const a = x.apprentice;
  if (a !== undefined && a !== null && (!object(a) || !CRAFTS[a.master] || !str(a.pupil, 24) || !SKILL_NAMES[a.skill] || !int(a.start))) bad();
  if (x.skills !== undefined && (!object(x.skills) || Object.keys(x.skills).length > 200 || Object.entries(x.skills).some(([id, v]) => !str(id, 24) || !SKILL_NAMES[v]))) bad();
  const l = x.lodger;
  if (l !== undefined && l !== null && (!object(l) || !str(l.name, 20) || !(int(l.look, 99) || str(l.look, 20)) || !(LODGER_GIFTS.includes(l.gift) || l.gift === "qin") || typeof l.stay !== "boolean" || !["asking", "staying"].includes(l.phase) || !int(l.day) || typeof l.qin !== "boolean")) bad();
  for (const k of ["lodgerNext", "lodgers"]) if (x[k] !== undefined && !int(x[k])) bad();
  if (x.pendingGuest !== undefined && x.pendingGuest !== null && !str(x.pendingGuest, 20)) bad();
  if (x.he !== undefined && (!object(x.he) || !int(x.he.stage ?? 0, 4))) bad();
  if (x.qin !== undefined && (!object(x.qin) || !QIN_PHASES.includes(x.qin.phase ?? "none") || !int(x.qin.since ?? 0) || !strs(x.qin.wishes ?? [], 3) || !unique(x.qin.wishes ?? []) || !(x.qin.wishes ?? []).every((w) => ["sea", "cake", "song"].includes(w)))) bad();
  if (x.adou !== undefined && (!object(x.adou) || !ADOU_PHASES.includes(x.adou.phase ?? "none") || !int(x.adou.thefts ?? 0) || !int(x.adou.lastTheft ?? 0))) bad();
  if (x.ali !== undefined && (!object(x.ali) || !ALI_PHASES.includes(x.ali.phase ?? "none") || !int(x.ali.murals ?? 0, 8) || !int(x.ali.lastPaint ?? 0))) bad();
  const lq = x.laoqin;
  if (lq !== undefined && (!object(lq) || typeof (lq.met ?? false) !== "boolean" || typeof (lq.quest ?? false) !== "boolean" || !strs(lq.sheets ?? [], 4) || !unique(lq.sheets ?? []) || !(lq.sheets ?? []).every((k) => SHEET_SPOTS[k]) || !int(lq.requestDay ?? 0))) bad();
  if (x.jiang !== undefined && (!object(x.jiang) || !JIANG_PHASES.includes(x.jiang.phase ?? "none") || !int(x.jiang.rod ?? 0, 2))) bad();
  if (x.seen !== undefined && (!strs(x.seen, 20) || !unique(x.seen) || !x.seen.every((k) => FEATURES[k]))) bad();
  if (x.claimed !== undefined && (!strs(x.claimed, 300) || !unique(x.claimed))) bad();
  // 彼此一致：食堂要何大勺入伙；秦奶奶借宿时要有对应的借宿记录。
  if (c?.night && (x.he?.stage ?? 0) < 4) bad();
  if (l?.qin && !["asking"].includes(x.qin?.phase)) bad();
}
