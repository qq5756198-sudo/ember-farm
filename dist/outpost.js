// v0.14.0「商路与火光」：联盟前哨第三至第六段、生存消耗与六项经营玩法。
// 只新增 outpost 字段；扣除、奖励、搬运都走已有的仓库、加工、居民与战斗路径。
import {
  Engine as AllianceEngine,
  freshState as allianceFresh,
  migrateState as allianceMigrate,
} from "./alliance.js";
import { ITEMS, WORLD, BUILDINGS, ZOMBIES, WEAPONS } from "./data.js";
import { TECH, HORDE_DIRECTIONS } from "./expansion-data.js";
import { NEIGHBOR_GIFT, bundleText, missingCost } from "./alliance-data.js";
import {
  OUTPOST_SCHEMA,
  UPKEEP,
  MEAL_ITEMS,
  PEOPLE_TRAITS,
  HELPER_ROLES,
  SPOTS,
  ACTS,
  HOSPITAL_CHOICE,
  LATHE_MODES,
  LATHE_COST,
  CARGO,
  CONVOY_MINUTES,
  TOLL_COST,
  RAID_PREP,
  BUNDLES,
  CARAVAN_POOL,
  VISITOR_NAMES,
  VISITOR_FROM,
  VISITOR_SKILL,
  VISITOR_CLUES,
  HUER_VISITS,
  NPCS,
  VISITOR_LOOKS,
  OUTPOST_OBJECTS,
} from "./outpost-data.js";
import { outpostGoal, outpostSteps } from "./outpost-story.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
const CREW_CAP = 3;
const CREW_TASKS = ["rest", "meal", "carry", "build", "scout", "guard", "idle", "hungry"];
const RAID_PHASES = ["none", "scheduled", "warning", "active", "won"];
const CLUE_KEYS = ["papers", "body", "bag"];
const GATE_POST = { x: 1300, y: 420 };

const raidDefaults = () => ({
  phase: "none",
  day: 0,
  timer: 0,
  total: 0,
  spawned: 0,
  killed: 0,
  retreated: 0,
  spawnTimer: 0,
  clock: 0,
  tries: 0,
  report: null,
});
const defaults = () => ({
  schema: OUTPOST_SCHEMA,
  dinnerDay: 0,
  missed: [],
  warnDay: 0,
  hungerNote: 0,
  hospital: null,
  patients: null,
  herbDay: 0,
  youke: false,
  youkeUpset: 0,
  gadgets: [],
  lathe: null,
  cargo: null,
  convoy: null,
  toll: null,
  prep: null,
  cache: false,
  raid: raidDefaults(),
  prisoner: null,
  alarmKey: 0,
  shipBox: {},
  ledger: [],
  dayStart: null,
  report: null,
  rushed: [],
  incidents: [],
  bundles: [],
  medicDay: 0,
  caravan: { next: 0, until: 0, offers: [], trust: 0, exposed: 0, cheated: [], visits: 0, debt: false },
  visitors: { next: 0, current: null, quarantine: null, count: 0, huer: 0, joined: 0, infected: null, thief: null },
  crew: [],
  sick: 0,
  cai: { gunKills: 0, crouchKills: 0, raiders: 0 },
  claimed: [],
  log: [],
});

export function migrateState(s) {
  allianceMigrate(s);
  const d = defaults();
  if (!s.outpost) s.outpost = d;
  else {
    const o = s.outpost;
    s.outpost = {
      ...d,
      ...o,
      raid: { ...d.raid, ...o.raid },
      caravan: { ...d.caravan, ...o.caravan },
      visitors: { ...d.visitors, ...o.visitors },
      cai: { ...d.cai, ...o.cai },
    };
  }
  return s;
}
export const freshState = () => migrateState(allianceFresh());

export class Engine extends AllianceEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this.raidShots = [];
    const o = this.s.outpost;
    // 袭击中的枪手不写进存档；读档后按剩余人数重新出现。
    if (o.raid.phase === "active") o.raid.spawned = o.raid.killed + o.raid.retreated;
    o.dayStart ??= this.snapshot();
    this.assignRegion();
  }
  get o() {
    return this.s.outpost;
  }
  abs() {
    return this.s.day * 1440 + this.s.minute;
  }
  roll() {
    return this.random();
  }
  olog(text, tone = "normal") {
    const o = this.o;
    o.log.unshift({ day: this.s.day, minute: Math.floor(this.s.minute), text: String(text).slice(0, 160), tone });
    o.log = o.log.slice(0, 30);
    if (this._night) this._night.push(text);
  }
  once(id) {
    if (this.o.claimed.includes(id)) return false;
    this.o.claimed.push(id);
    return true;
  }
  storyGoal() {
    const sc = this.sc;
    if (sc && sc.act >= 3) return outpostGoal(this);
    return super.storyGoal();
  }

  // ---------- 口粮与生存消耗 ----------
  foodPortions() {
    return MEAL_ITEMS.reduce((n, id) => n + (this.s.storage[id] || 0) + (this.s.inventory[id] || 0), 0);
  }
  eaters() {
    const list = [];
    this.c.residents.forEach((r, i) => {
      if (i < this.residentsCapacity()) list.push({ key: "r:" + r.id, name: this.residentName(r.id), meals: 2 });
    });
    for (const h of this.sc?.helpers || []) list.push({ key: "h:" + h.id, name: this.helperName(h.id), meals: 2 });
    for (const c of this.o.crew)
      list.push({ key: "c:" + c.id, name: c.name, meals: c.trait === "glutton" ? 3 : 2 });
    if (this.patientsHere()) list.push({ key: "p:zou", name: "两名伤员", meals: 2 });
    return list;
  }
  residentName(id) {
    return { farmer: "阿禾", medic: "许医生", mechanic: "陈工", cartographer: "绘图员" }[id] || "居民";
  }
  foodNeed() {
    return this.eaters().reduce((n, x) => n + x.meals, 0) + UPKEEP.playerDaily;
  }
  foodDays() {
    return Math.floor((this.foodPortions() / Math.max(1, this.foodNeed())) * 10) / 10;
  }
  takeMeal() {
    for (const id of MEAL_ITEMS)
      if ((this.s.storage[id] || 0) > 0) {
        this.s.storage[id]--;
        if (!this.s.storage[id]) delete this.s.storage[id];
        return id;
      }
    if (this.s.region === "farm")
      for (const id of MEAL_ITEMS)
        if ((this.s.inventory[id] || 0) > 0) {
          this.s.inventory[id]--;
          if (!this.s.inventory[id]) delete this.s.inventory[id];
          return id;
        }
    return null;
  }
  serveDinner() {
    const o = this.o;
    if (o.dinnerDay === this.s.day) return false;
    o.dinnerDay = this.s.day;
    o.missed = [];
    let served = 0;
    const missed = [];
    let chatty = false;
    this.c.residents.forEach((r, i) => {
      if (i >= this.residentsCapacity()) return;
      if (this.takeMeal()) {
        served++;
        if (r.id === "cartographer") chatty = true;
      } else {
        o.missed.push("r:" + r.id);
        missed.push(this.residentName(r.id));
        r.morale = clamp((r.morale ?? 60) - 8, 0, 100);
        r.status = "没吃上晚饭，心情变差";
      }
    });
    for (const h of this.sc?.helpers || []) {
      if (this.takeMeal()) served++;
      else {
        o.missed.push("h:" + h.id);
        missed.push(this.helperName(h.id));
      }
    }
    for (const c of o.crew) {
      const need = c.trait === "glutton" ? 2 : 1;
      let got = 0;
      for (let i = 0; i < need; i++) if (this.takeMeal()) got++;
      if (got) served++;
      if (got < need) {
        o.missed.push("c:" + c.id);
        missed.push(c.name);
        if (c.id === "youke") o.youkeUpset = this.s.day + 1;
      } else if (c.trait === "chatty") chatty = true;
    }
    if (this.patientsHere()) {
      const p = o.patients;
      if (this.takeMeal() && this.takeMeal()) {
        p.fedDays++;
        p.lastFed = this.s.day;
        if (p.fedDays >= 2) this.patientsRecovered();
      } else {
        p.gone = true;
        missed.push("两名伤员");
        this.olog("伤员没吃上晚饭，许医生把他们接回了医院。", "warn");
        if (this.s.region === "farm") this.assignRegion();
      }
    }
    if (chatty && served)
      for (const r of this.c.residents) if (!o.missed.includes("r:" + r.id)) r.morale = clamp((r.morale ?? 60) + 3, 0, 100);
    const left = this.foodPortions();
    if (missed.length) {
      const text = "晚饭不够：" + missed.join("、") + "没吃上（剩 " + left + " 份口粮）。没吃上的人明天干活慢一半。";
      this.toast(text, "warn");
      this.olog(text, "warn");
    } else if (served) {
      this.toast("晚饭开饭：" + served + "人吃上了，仓库与背包还剩 " + left + " 份口粮。");
      if (this._night) this._night.push("晚饭：" + served + "人吃上了。");
    }
    return true;
  }
  morningCheck() {
    const o = this.o;
    if (o.warnDay === this.s.day) return;
    const days = this.foodDays(),
      eaters = this.eaters().length + 1;
    if (days < 1.5) {
      o.warnDay = this.s.day;
      const text =
        "小柒：口粮只够 " +
        days +
        " 天（" +
        eaters +
        " 人吃饭，每天约 " +
        this.foodNeed() +
        " 份）。多种萝卜做干粮，或把东西放进出货箱换钱买粮。";
      this.toast(text, "warn");
      this.olog(text, "warn");
    }
  }
  hungerTick(dt, before) {
    const p = this.s.player,
      o = this.o,
      drop = before - p.hunger;
    if (drop > 0 && drop < 5) p.hunger = Math.max(0, p.hunger - drop * (UPKEEP.playerHunger - 1));
    if (p.hunger > 40) o.hungerNote = 0;
    else if (p.hunger <= 10 && o.hungerNote < 2) {
      o.hungerNote = 2;
      this.toast("饿得眼前发黑：饥饿归零后会一直掉血，直到饿晕。马上吃点东西（快捷栏 8）。", "warn");
    } else if (p.hunger <= 25 && o.hungerNote < 1) {
      o.hungerNote = 1;
      this.toast("肚子在叫：饥饿低于 20 会走不动路。吃一份干粮或料理。", "warn");
    }
    if (p.hunger <= 0) {
      // 旧规则会把饿肚子的生命托在 1；这里低于 1 就饿晕。
      p.hp -= dt * UPKEEP.starveDamage;
      if (p.hp < 1) {
        p.hp = 0;
        this._starve = true;
        this.olog("你饿晕在了路上，被人抬回农舍。", "warn");
        this.die();
        this.toast("你饿晕了。醒来时已在农舍，金币少了一些——先把肚子填饱。", "warn");
      }
    }
  }
  sleep() {
    const r = this.raidState();
    if (["warning", "active"].includes(r.phase)) {
      this.toast("灰隼团就在围栏外，现在不能睡。", "warn");
      return false;
    }
    if (r.phase === "scheduled" && r.day * 1440 + 1140 <= (this.s.day + 1) * 1440 + 480) {
      this.toast("灰隼团今晚 19:00 会来，现在不能一觉睡过去。备好战，或在农舍点“等到天黑（19:00）”。", "warn");
      return false;
    }
    const start = this.o.dayStart || this.snapshot(),
      before = this.snapshot();
    this._night = [];
    let ok = false;
    try {
      ok = super.sleep();
    } finally {
      this._nightLines = this._night;
      this._night = null;
    }
    if (!ok) return false;
    const p = this.s.player;
    p.hunger = Math.max(6, p.hunger - UPKEEP.sleepHunger);
    this.o.report = {
      day: start.day,
      money: before.money - start.money,
      kills: before.kills - start.kills,
      harvested: before.harvested - start.harvested,
      foodStart: start.food,
      foodEnd: this.foodPortions(),
      night: (this._nightLines || []).slice(0, 8).map((x) => String(x).slice(0, 120)),
      days: this.foodDays(),
      threats: this.threats(),
    };
    this.emit("menu", { menu: "outpost", view: "summary" });
    if (p.hunger < 25) this.toast("饿醒了：先吃点东西再干活。", "warn");
    return true;
  }
  snapshot() {
    return {
      day: this.s.day,
      money: this.s.money,
      kills: this.s.stats.kills || 0,
      harvested: this.s.stats.harvested || 0,
      food: this.foodPortions(),
    };
  }
  threats() {
    const o = this.o,
      out = [];
    const days = this.foodDays();
    out.push("口粮还能撑 " + days + " 天" + (days < 1.5 ? "——要断粮了" : days < 3 ? "，不算宽裕" : ""));
    const rs = this.raidState();
    if (rs.phase === "scheduled") out.push((rs === o.raid ? "灰隼团" : "灰隼团残部") + "：第" + rs.day + "天 19:00 从东侧来袭");
    if (this.c.nextHordeDay && this.s.stats.hordes > 0) out.push("尸潮：预计第" + this.c.nextHordeDay + "天");
    if (o.convoy && !o.convoy.done) out.push("车队：约 " + Math.max(0, Math.ceil(o.convoy.arrives - this.abs())) + " 分钟后到站");
    if (o.caravan.next && !this.caravanHere()) out.push("唐九的商队：第" + o.caravan.next + "天上午到");
    if (this.sc?.act >= 3 && o.visitors.next && !o.visitors.current) out.push("营门来访者：第" + o.visitors.next + "天上午");
    if (o.sick >= this.s.day) out.push("营地有人生病：给 1 个药包或 2 条绷带就能好");
    return out.slice(0, 6);
  }

  // ---------- 出货箱 ----------
  shipPrice(id) {
    // 走现有收购价：两位商人里出价高的那位（含需求加成）。
    if (!ITEMS[id]?.sell) return 0;
    let best = ITEMS[id].sell;
    for (const t of ["food", "mechanic"])
      try {
        best = Math.max(best, this.price(t, id, "sell") || 0);
      } catch {}
    return Math.floor(best);
  }
  shipItem(id, n = 1) {
    if (this.s.region !== "farm") {
      this.toast("回到农场才能往出货箱里放东西。", "warn");
      return false;
    }
    if (!ITEMS[id] || ITEMS[id].protected || !this.shipPrice(id)) {
      this.toast("这件东西不能出货。", "warn");
      return false;
    }
    n = Math.min(Math.floor(n), this.qty(id));
    if (n < 1) return false;
    this.s.inventory[id] -= n;
    if (!this.s.inventory[id]) delete this.s.inventory[id];
    this.o.shipBox[id] = (this.o.shipBox[id] || 0) + n;
    this.toast("放进出货箱：" + ITEMS[id].name + "×" + n + "（明早结算 " + this.shipPrice(id) * n + " 金币）");
    return true;
  }
  unshipItem(id) {
    const n = this.o.shipBox[id] || 0;
    if (!n || this.s.region !== "farm") return false;
    if (!this.canAdd({ [id]: n })) {
      this.toast("背包满了，先腾出一格再取回。", "warn");
      return false;
    }
    delete this.o.shipBox[id];
    this.s.inventory[id] = (this.s.inventory[id] || 0) + n;
    this.toast("从出货箱取回：" + ITEMS[id].name + "×" + n);
    return true;
  }
  shipValue() {
    return Object.entries(this.o.shipBox).reduce((n, [id, q]) => n + this.shipPrice(id) * q, 0);
  }
  settleShipping() {
    const o = this.o,
      items = { ...o.shipBox };
    if (!Object.keys(items).length) return 0;
    const income = this.shipValue(),
      count = Object.values(items).reduce((a, b) => a + b, 0);
    o.shipBox = {};
    this.s.money += income;
    this.s.stats.sold = (this.s.stats.sold || 0) + count;
    o.ledger.unshift({ day: this.s.day - 1, income, items });
    o.ledger = o.ledger.slice(0, 10);
    const text = "出货箱结算：" + bundleText(items) + "，+" + income + " 金币。";
    this.olog(text, "gold");
    this.toast(text, "gold");
    return income;
  }

  // ---------- 抢工与故障 ----------
  rushReason(job) {
    if (!job) return "找不到这批加工";
    if (this.s.region !== "farm") return "回到农场才能抢工";
    if (job.ready) return "已经做好了";
    if (!job.station || !this.s.buildings.some((b) => b.type === job.station && b.hp > 0)) return "设施损坏，先维修";
    if (this.o.rushed.includes(job.id)) return "这一批已经抢过工";
    if (this.o.incidents.some((i) => i.job === job.id)) return "先排除故障";
    if (job.remaining < 4) return "马上就好，不必抢工";
    return "";
  }
  rushJob(id) {
    const job = this.c.production.find((j) => j.id === id),
      reason = this.rushReason(job);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const o = this.o;
    job.remaining = Math.max(1, Math.ceil(job.remaining / 2));
    o.rushed.push(job.id);
    o.rushed = o.rushed.filter((x) => this.c.production.some((j) => j.id === x)).slice(-30);
    const handy = o.crew.some((c) => c.trait === "handy") || this.resident("mechanic");
    if (this.roll() < (handy ? 0.15 : 0.3)) {
      const type = ["cook", "canner"].includes(job.station) ? "fire" : "jam";
      o.incidents.push({ job: job.id, station: job.station, type, deadline: Math.ceil(this.abs() + 60) });
      const name = BUILDINGS[job.station]?.name || "设施";
      const text =
        type === "fire"
          ? name + "抢工起火了！60 分钟内用水壶的 2 格水扑灭，不然这批料烧光、设施受损。"
          : name + "抢工卡住了！60 分钟内用 1 个机械零件排除，不然这批料报废、设施受损。";
      this.toast(text, "warn");
      this.olog(text, "warn");
      this.emit("alarm");
    } else this.toast("抢工成功：剩余时间减半，还要约 " + job.remaining + " 分钟。");
    return true;
  }
  incidentCost(inc) {
    const handy = this.o.crew.some((c) => c.trait === "handy" || c.role === "build");
    return inc.type === "fire" ? { water: handy ? 1 : 2 } : handy ? {} : { parts: 1 };
  }
  fixIncident(jobId) {
    const o = this.o,
      inc = o.incidents.find((i) => i.job === jobId);
    if (!inc) return false;
    if (this.s.region !== "farm") {
      this.toast("回到农场才能排除故障。", "warn");
      return false;
    }
    const cost = this.incidentCost(inc);
    if (cost.water) {
      if (this.c.water < cost.water) {
        this.toast("水壶里的水不够（要 " + cost.water + " 格）。先到水井补水。", "warn");
        return false;
      }
      this.c.water -= cost.water;
    } else if (cost.parts && !this.takeFarm(cost)) {
      this.toast("排除卡料要 1 个机械零件。", "warn");
      return false;
    }
    o.incidents = o.incidents.filter((i) => i !== inc);
    this.toast(inc.type === "fire" ? "火扑灭了，这批料保住了。" : "卡住的零件取出来了，继续加工。", "gold");
    this.particlesAt(...this.stationPoint(inc.station), inc.type === "fire" ? "#89c6d0" : "#d6c79a", 12);
    return true;
  }
  stationPoint(type) {
    const b = this.s.buildings.find((x) => x.type === type && x.hp > 0) || { x: 1010, y: 480 };
    return [b.x, b.y - 30];
  }
  checkIncidents() {
    const o = this.o,
      now = this.abs();
    for (const inc of [...o.incidents]) {
      if (!this.c.production.some((j) => j.id === inc.job)) {
        o.incidents = o.incidents.filter((i) => i !== inc);
        continue;
      }
      if (now < inc.deadline) continue;
      o.incidents = o.incidents.filter((i) => i !== inc);
      this.c.production = this.c.production.filter((j) => j.id !== inc.job);
      // 供给计划的自动批次也一起移除，否则存档里会留下找不到的批次。
      if (this.u?.autoJobs) this.u.autoJobs = this.u.autoJobs.filter((k) => k !== inc.job);
      const b = this.s.buildings.find((x) => x.type === inc.station && x.hp > 0);
      if (b) {
        // 只损失这一批和两成耐久，不会把设施烧毁。
        b.hp = Math.max(1, b.hp - Math.ceil(BUILDINGS[b.type].hp * 0.2));
        this.navRevision++;
      }
      const text =
        (BUILDINGS[inc.station]?.name || "设施") +
        (inc.type === "fire" ? "的火没扑灭：这批料烧光了，设施受损。" : "卡料没排除：这批料报废，设施受损。");
      this.toast(text, "warn");
      this.olog(text, "warn");
    }
  }
  processProduction(n) {
    // 起火或卡料的批次暂停：临时挂到不存在的设施上，原有加工与供给计划都不会推进或入仓它。
    const frozen = this.o.incidents.map((i) => this.c.production.find((j) => j.id === i.job)).filter(Boolean);
    const stations = frozen.map((j) => j.station);
    for (const j of frozen) j.station = "__incident";
    try {
      super.processProduction(n);
    } finally {
      frozen.forEach((j, k) => (j.station = stations[k]));
    }
  }


  // ---------- 援建清单与长期服务 ----------
  hasBundle(id) {
    return this.o.bundles.includes(id);
  }
  bundleReason(id) {
    if (!BUNDLES[id]) return "没有这份清单";
    if (this.hasBundle(id)) return "已经送达";
    if ((this.sc?.act || 1) < 3) return "第三段开始后联盟才会发清单";
    if (this.s.region !== "farm") return "回到农场，在联盟终端交付";
    const lack = missingCost(this, BUNDLES[id].items);
    return lack.length ? "还缺：" + lack.join("、") : "";
  }
  deliverBundle(id) {
    const reason = this.bundleReason(id);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    if (!this.takeFarm(BUNDLES[id].items)) return false;
    this.o.bundles.push(id);
    this.once("bundle:" + id);
    this.addReputation(2);
    const text = BUNDLES[id].name + "送达联盟。" + BUNDLES[id].effect;
    this.toast(text, "gold");
    this.olog(text, "gold");
    this.storyLog(BUNDLES[id].name + "送达。");
    this.emit("quest");
    return true;
  }
  repair(id) {
    if (this.s.region === "farm" && (this.hasBundle("workshop") || this.o.cargo === "repair")) {
      const b = this.s.buildings.find((x) => x.id === id);
      if (b && b.hp < BUILDINGS[b.type].hp) {
        if (!this.takeFarm({ wood: 1 })) {
          this.toast("维修需要 1 份木材。", "warn");
          return false;
        }
        b.hp = BUILDINGS[b.type].hp;
        this.navRevision++;
        this.toast("维修完成 · 木材-1（机修工具包）");
        return true;
      }
    }
    return super.repair(id);
  }
  patrolHeal() {
    const o = this.o,
      p = this.s.player;
    if (this.s.region === "farm" || p.hp >= 35 || o.medicDay === this.s.day) return;
    if (!this.hasBundle("clinic") && o.cargo !== "medicine") return;
    o.medicDay = this.s.day;
    p.hp = Math.min(this.maxHp(), p.hp + 30);
    this.toast("医院巡回队赶到，给你包扎了伤口：生命 +30（每天一次）。", "gold");
  }
  takeFarm(cost) {
    // 守路弹药包：瞭望塔射击不再耗弹。
    if (this._freeAmmo && Object.keys(cost).length === 1 && cost.ammo === 1) return true;
    return super.takeFarm(cost);
  }
  price(trader, id, direction) {
    const p = super.price(trader, id, direction);
    if (direction !== "buy" || !p) return p;
    if (this.tollActive()) return Math.ceil(p * 1.1);
    if (this.o?.raid.phase === "won") return Math.max(1, Math.floor(p * 0.9));
    return p;
  }
  tollActive() {
    return !!this.o && (this.sc?.act || 1) >= 6 && this.o.raid.phase !== "won";
  }
  neighborAid() {
    const ok = super.neighborAid();
    if (ok && this.o.cargo === "food") {
      this.putStorage(NEIGHBOR_GIFT);
      this.toast("口粮车的情分：邻居多给了一份回礼（" + bundleText(NEIGHBOR_GIFT) + "，已入仓）。", "gold");
    }
    return ok;
  }

  // ---------- 流动商队 ----------
  caravanHere() {
    const c = this.o.caravan;
    return c.until > this.abs() && c.offers.length > 0;
  }
  caravanTrusted() {
    const c = this.o.caravan;
    return c.exposed > 0 && (this.o.raid.phase === "won" || c.visits >= 4);
  }
  arriveCaravan() {
    const o = this.o,
      c = o.caravan;
    if (!c.next || this.s.day < c.next || this.caravanHere()) return false;
    const pool = this.shuffle(CARAVAN_POOL.filter((x) => !x.tech || (TECH[x.tech] && !this.c.technologies[x.tech])));
    const trusted = this.caravanTrusted();
    c.offers = pool.slice(0, 4).map((x, i) => ({
      key: i,
      item: x.item || null,
      tech: x.tech || null,
      qty: x.qty || 1,
      price: x.price,
      fake: !trusted && !!x.fake && this.roll() < 0.25 ? x.fake : null,
      inspected: null,
      sold: false,
    }));
    c.until = this.s.day * 1440 + 20 * 60;
    c.visits++;
    c.next = 0;
    const text = "唐九的商队到了农场北边（今天 20:00 前离开）。";
    this.toast(text, "gold");
    this.olog(text, "gold");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  leaveCaravan() {
    const c = this.o.caravan;
    if (!c.offers.length) return false;
    c.offers = [];
    c.until = 0;
    c.next = this.s.day + (this.hasBundle("caravan") ? 3 : 4);
    if (this.s.region === "farm") {
      this.toast("唐九的商队收摊走了，第" + c.next + "天再来。");
      this.assignRegion();
    }
    return true;
  }
  offerPrice(offer) {
    let p = offer.price;
    if (this.hasBundle("caravan")) p *= 0.9;
    if (this.tollActive()) p *= 1.1;
    else if (this.o.raid.phase === "won") p *= 0.9;
    return Math.max(1, Math.round(p));
  }
  offerName(offer) {
    return offer.tech ? (TECH[offer.tech]?.name || offer.tech) + "蓝图" : ITEMS[offer.item].name + "×" + offer.qty;
  }
  inspectOffer(key) {
    const c = this.o.caravan,
      offer = c.offers.find((x) => x.key === key);
    if (!offer || !this.caravanHere()) return false;
    if (offer.inspected) {
      this.toast("这件货已经细看过了。");
      return false;
    }
    if (offer.tech) {
      offer.inspected = "real";
      this.toast("蓝图上有联盟的钢印，是真的。");
      return true;
    }
    const chance = 0.55 + 0.08 * this.level("exploration");
    if (this.roll() < chance) {
      offer.inspected = offer.fake ? "fake" : "real";
      this.toast(
        offer.fake
          ? "看出来了：这包" + ITEMS[offer.item].name + "是拿" + ITEMS[offer.fake].name + "冒充的。"
          : "仔细看过，" + ITEMS[offer.item].name + "是真货。",
        offer.fake ? "warn" : "normal",
      );
    } else {
      offer.inspected = "unclear";
      this.toast("唐九把货往身后一收：“看两眼就够了啊。”——没看出名堂。");
    }
    return true;
  }
  buyOffer(key) {
    const c = this.o.caravan,
      offer = c.offers.find((x) => x.key === key);
    if (!offer || offer.sold || !this.caravanHere()) return false;
    if (this.s.region !== "farm") return false;
    if (offer.inspected === "fake") {
      this.toast("唐九讪讪地把那包货收了回去：“看穿了就不卖了，不卖了。”");
      return false;
    }
    const price = this.offerPrice(offer);
    if (this.s.money < price) {
      this.toast("金币不够（要 " + price + "）。", "warn");
      return false;
    }
    if (offer.tech) {
      if (this.c.technologies[offer.tech]) {
        this.toast("这张蓝图你已经有了。");
        return false;
      }
      this.s.money -= price;
      this.c.technologies[offer.tech] = true;
      this.ensureResearchOffers?.();
      offer.sold = true;
      this.toast("买下" + this.offerName(offer) + "：已解锁。", "gold");
      this.emit("trade");
      return true;
    }
    const got = { [offer.fake || offer.item]: offer.qty };
    if (!this.canAdd(got)) {
      this.toast("背包满了，先腾出一格。", "warn");
      return false;
    }
    this.s.money -= price;
    this.add(got);
    offer.sold = true;
    if (offer.fake) {
      c.cheated.push({ item: offer.item, fake: offer.fake, price, day: this.s.day });
      c.cheated = c.cheated.slice(-6);
      this.toast(
        "到手一拆：是" + ITEMS[offer.fake].name + "×" + offer.qty + "，不是" + ITEMS[offer.item].name + "！趁唐九还在，可以当面拆穿他。",
        "warn",
      );
      this.olog("在唐九那买到假货：" + ITEMS[offer.fake].name + "冒充" + ITEMS[offer.item].name + "。", "warn");
    } else this.toast("买下" + this.offerName(offer) + "，花了 " + price + " 金币。");
    this.emit("trade");
    return true;
  }
  exposeCheat() {
    const c = this.o.caravan;
    if (!this.caravanHere() || !c.cheated.length) return false;
    const refund = c.cheated.reduce((n, x) => n + x.price, 0);
    this.s.money += refund;
    c.cheated = [];
    c.exposed++;
    c.trust++;
    const line = c.exposed >= 2 ? NPCS.tangjiu.lines.debt : NPCS.tangjiu.lines.exposed;
    if (c.exposed >= 2 && !c.debt) {
      c.debt = true;
      this.putStorage({ ammo: 12 });
      this.olog("唐九说出了他欠灰隼团的债，塞给你 12 发弹药。");
    }
    this.toast("唐九：" + line + "（退回 " + refund + " 金币）", "gold");
    this.olog("拆穿唐九的假货，退回 " + refund + " 金币。");
    return true;
  }

  // ---------- 入营审查 ----------
  crewCount() {
    return this.o.crew.filter((c) => c.id !== "youke").length;
  }
  crewFull() {
    return this.crewCount() >= CREW_CAP;
  }
  addCrew(info) {
    const o = this.o;
    if (o.crew.some((c) => c.id === info.id)) return false;
    if (info.id !== "youke" && this.crewFull()) return false;
    const spot = info.id === "youke" ? { x: SPOTS.lathe.x - 56, y: SPOTS.lathe.y + 36 } : this.crewHome({ id: info.id });
    o.crew.push({
      id: info.id,
      name: info.name,
      trait: info.trait,
      role: info.role,
      look: info.look,
      x: spot.x,
      y: spot.y,
      facing: 0,
      target: { ...spot },
      fedDay: 0,
      status: "刚到营地，正在放行李",
      task: "idle",
      moved: 0,
      outDay: 0,
      backDay: 0,
    });
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  dismissCrew(id) {
    const o = this.o,
      c = o.crew.find((x) => x.id === id);
    if (!c || ["youke"].includes(id)) return false;
    o.crew = o.crew.filter((x) => x !== c);
    this.toast(c.name + "收拾行李离开了营地。");
    this.olog(c.name + "离开了营地。");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  arriveVisitor() {
    const o = this.o,
      v = o.visitors;
    if ((this.sc?.act || 1) < 3 || v.current || v.quarantine) return false;
    if (!v.next) v.next = this.s.day + 1;
    if (this.s.day < v.next) return false;
    const n = v.count++;
    let visitor;
    if (v.huer < HUER_VISITS.length && !o.crew.some((c) => c.id === "huer") && n % 3 === 1) {
      const stage = v.huer;
      visitor = {
        id: "huer",
        name: "胡二",
        kind: HUER_VISITS[stage].genuine ? "honest" : "liar",
        huer: stage,
        from: "各个营门口",
        role: "guard",
        trait: "chatty",
        look: "huer",
        clues: {
          papers: HUER_VISITS[stage].papers,
          body: "精神头很足，一点不像饿了很久",
          bag: stage === 2 ? "一根磨得发亮的警棍，和一张排队的号码条" : "一个空碗，碗底刻着“胡”",
        },
        story: HUER_VISITS[stage].story,
        checked: ["papers"],
        day: this.s.day,
      };
    } else {
      const r = this.roll(),
        kind = r < 0.6 ? "honest" : r < 0.8 ? "infected" : "thief",
        roles = Object.keys(VISITOR_SKILL),
        role = roles[Math.floor(this.roll() * roles.length) % roles.length],
        traits = Object.keys(PEOPLE_TRAITS),
        pickClue = (cat) => {
          const list = VISITOR_CLUES[kind][cat];
          return list[Math.floor(this.roll() * list.length) % list.length];
        };
      visitor = {
        id: "v" + (n + 1),
        name: VISITOR_NAMES[n % VISITOR_NAMES.length],
        kind,
        huer: null,
        from: VISITOR_FROM[n % VISITOR_FROM.length],
        role,
        trait: traits[Math.floor(this.roll() * traits.length) % traits.length],
        look: n % VISITOR_LOOKS.length,
        clues: { papers: pickClue("papers"), body: pickClue("body"), bag: pickClue("bag") },
        story: "“我叫" + VISITOR_NAMES[n % VISITOR_NAMES.length] + "，" + VISITOR_SKILL[role] + "。能让我留下吗？”",
        checked: ["papers"],
        day: this.s.day,
      };
    }
    v.current = visitor;
    const text = visitor.name + "站在营门口等着入营审查（东侧大门，今天 21:00 前）。";
    this.toast(text, "gold");
    this.olog(text);
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  checkVisitor(cat) {
    const v = this.o.visitors.current;
    if (!v || !CLUE_KEYS.includes(cat) || v.checked.includes(cat)) return false;
    v.checked.push(cat);
    return true;
  }
  decideVisitor(choice) {
    const o = this.o,
      vs = o.visitors,
      v = vs.current;
    if (!v || !["accept", "quarantine", "reject"].includes(choice)) return false;
    if (this.s.region !== "farm") {
      this.toast("回到农场营门再做决定。", "warn");
      return false;
    }
    const isHuer = v.huer !== null && v.huer !== undefined;
    if (choice === "quarantine") {
      if (isHuer) {
        this.toast("胡二：“隔离？我就站门口，哪也不去。”——他不吃这一套。");
        return false;
      }
      if (!this.takeMeal()) {
        this.toast("隔离观察要先给他 1 份口粮。", "warn");
        return false;
      }
      vs.quarantine = { ...v, day: this.s.day };
      vs.current = null;
      vs.next = this.s.day + 2;
      this.toast(v.name + "住进了隔离棚，明早见分晓（花了 1 份口粮）。");
      this.olog("隔离观察：" + v.name + "。");
      if (this.s.region === "farm") this.assignRegion();
      return true;
    }
    const harmless = isHuer && v.kind !== "honest";
    if (choice === "accept" && !harmless && this.crewFull()) {
      this.toast("援建营地满员（" + CREW_CAP + "/" + CREW_CAP + "），先请一位队员离开。", "warn");
      return false;
    }
    vs.current = null;
    vs.next = this.s.day + 2 + (vs.count % 2);
    if (isHuer) vs.huer = Math.min(HUER_VISITS.length, vs.huer + 1);
    if (choice === "reject") {
      this.toast(v.name + "叹了口气，转身走了。");
      this.olog("拒绝了" + v.name + "。");
    } else if (harmless) {
      this.takeMeal();
      this.toast("胡二蹭了一顿饭，趁你不注意溜了。证件是假的——下次细看。");
      this.olog("胡二混进来吃了一顿饭就跑了。", "warn");
    } else if (isHuer) {
      this.addCrew({ id: "huer", name: "胡二", trait: "chatty", role: "guard", look: "huer" });
      this.once("huer");
      this.toast("胡二：" + NPCS.huer.lines.guard, "gold");
      this.olog("胡二入营，当上了守卫。", "gold");
    } else {
      this.addCrew({ id: v.id, name: v.name, trait: v.trait, role: v.role, look: v.look });
      vs.joined++;
      if (v.kind === "infected") vs.infected = v.id;
      if (v.kind === "thief") vs.thief = v.id;
      this.toast(v.name + "入营了：" + HELPER_ROLES[v.role] + " · " + PEOPLE_TRAITS[v.trait].name + "。", "gold");
      this.olog(v.name + "入营（" + HELPER_ROLES[v.role] + "）。");
    }
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  visitorNight() {
    // 每天清晨：隔离结果、混进来的病人与小偷。
    const o = this.o,
      vs = o.visitors;
    if (vs.quarantine) {
      const q = vs.quarantine;
      vs.quarantine = null;
      if (q.kind === "infected") this.olog("隔离棚里的" + q.name + "夜里发病了，被送去了医院。幸好没让他进营地。", "warn");
      else if (q.kind === "thief") {
        this.stealFromStorage(q.name, 1);
      } else if (!this.crewFull()) {
        this.addCrew({ id: q.id, name: q.name, trait: q.trait, role: q.role, look: q.look });
        vs.joined++;
        this.olog(q.name + "通过了隔离观察，正式入营（" + HELPER_ROLES[q.role] + "）。", "gold");
      } else this.olog(q.name + "通过了隔离观察，但营地满员，他道谢后去了别的前哨。");
    }
    if (vs.infected) {
      const c = o.crew.find((x) => x.id === vs.infected);
      vs.infected = null;
      if (c) {
        o.crew = o.crew.filter((x) => x !== c);
        o.sick = this.s.day + 1;
        for (const r of this.c.residents) r.morale = clamp((r.morale ?? 60) - 10, 0, 100);
        // 发病的人留在农场营地边，玩家回来时才会遇到。
        if (!Array.isArray(this.s.enemies.farm)) this.s.enemies.farm = [];
        const camp = this.sc?.camp || { x: 600, y: 700 };
        this.s.enemies.farm.push(this.enemy("runner", clamp(camp.x + 40, 80, WORLD.w - 80), clamp(camp.y + 40, 80, WORLD.h - 80)));
        if (this.s.region === "farm") this.enemies = this.s.enemies.farm;
        this.olog(c.name + "夜里发病变异，营地有人被传染。给 1 个药包或 2 条绷带治疗。", "warn");
        this.toast(c.name + "夜里发病了！营地有人被传染：今明两天援建队干活慢一半。", "warn");
      }
    }
    if (vs.thief) {
      const c = o.crew.find((x) => x.id === vs.thief);
      vs.thief = null;
      if (c) {
        o.crew = o.crew.filter((x) => x !== c);
        this.stealFromStorage(c.name, 2);
      }
    }
    if (this.s.region === "farm") this.assignRegion();
  }
  stealFromStorage(name, stacks) {
    const taken = {};
    for (const id of ["bread", "ammo", "parts", "cloth", "scrap", ...MEAL_ITEMS]) {
      if (Object.keys(taken).length >= stacks) break;
      const n = this.s.storage[id] || 0;
      if (n <= 0 || taken[id]) continue;
      const k = Math.max(1, Math.ceil(n * 0.25));
      this.s.storage[id] -= k;
      if (!this.s.storage[id]) delete this.s.storage[id];
      taken[id] = k;
    }
    const text = Object.keys(taken).length
      ? name + "夜里溜了，顺走了仓库里的" + bundleText(taken) + "。"
      : name + "夜里溜了，仓库空空，什么也没偷到。";
    this.olog(text, "warn");
    this.toast(text, "warn");
    return taken;
  }
  curePlague() {
    const o = this.o;
    if (o.sick < this.s.day) return false;
    if (this.s.region !== "farm") {
      this.toast("回到农场才能给病号治疗。", "warn");
      return false;
    }
    const cost = this.quantityForCost("medkit", true) >= 1 ? { medkit: 1 } : { bandage: 2 };
    if (!this.takeFarm(cost)) {
      this.toast("治疗要 1 个药包或 2 条绷带。", "warn");
      return false;
    }
    o.sick = 0;
    this.toast("营地的病号退烧了（" + bundleText(cost) + "）。", "gold");
    this.olog("治好了营地的病号。");
    return true;
  }

  // ---------- 援建队员（入营者与人物） ----------
  helperName(id) {
    const c = this.o?.crew.find((x) => x.id === id);
    return c ? c.name : super.helperName(id);
  }
  crewHours(c) {
    const start = c.trait === "diligent" ? 5 : c.trait === "nightowl" ? 10 : 6,
      end = c.trait === "nightowl" ? 22 : 20;
    return [start, end];
  }
  raidLive() {
    return ["warning", "active"].includes(this.raidState().phase) || ["warning", "active"].includes(this.s.horde.phase);
  }
  slowed(key) {
    const o = this.o;
    return (o.dinnerDay === this.s.day - 1 && o.missed.includes(key)) || o.sick >= this.s.day;
  }
  helperHour(h) {
    const hour = Math.floor(this.s.minute / 60);
    if (hour >= 6 && hour < 20 && this.slowed("h:" + h.id) && hour % 2) {
      const camp = this.sc.camp || this.campSite() || { x: 830, y: 480 };
      Object.assign(h, {
        status: this.o.sick >= this.s.day ? "营地有人生病，干活慢了一半" : "昨晚没吃上晚饭，干活慢了一半",
        task: "hungry",
        target: { x: camp.x + 64, y: camp.y + 20 },
      });
      return;
    }
    super.helperHour(h);
  }
  crewHome(c) {
    if (c.id === "youke") return { x: SPOTS.lathe.x - 56, y: SPOTS.lathe.y + 36 };
    const camp = this.sc?.camp || this.campSite() || { x: 830, y: 480 },
      list = this.o.crew.filter((x) => x.id !== "youke"),
      found = list.findIndex((x) => x.id === c.id),
      i = found < 0 ? list.length : found,
      offsets = [
        [-86, 8],
        [104, -14],
        [-44, -52],
        [70, -60],
      ],
      [dx, dy] = offsets[Math.max(0, i) % offsets.length],
      p = { x: clamp(camp.x + dx, 60, WORLD.w - 60), y: clamp(camp.y + dy, 60, WORLD.h - 60) };
    return this.s.region === "farm" && this.blocked(p.x, p.y, false, 12) ? { x: camp.x + 64, y: camp.y + 20 } : p;
  }
  crewHour(c) {
    const o = this.o,
      hour = Math.floor(this.s.minute / 60),
      home = this.crewHome(c),
      [start, end] = this.crewHours(c);
    const set = (status, task, target = home) => Object.assign(c, { status, task, target });
    if (c.role === "scout" && c.outDay === this.s.day && c.backDay !== this.s.day && hour >= 16) {
      c.backDay = this.s.day;
      const gain = { scrap: 2 + Math.floor(this.roll() * 3), wood: 2 };
      if (this.roll() < 0.35) gain.seedRadish = 2;
      this.putStorage(gain);
      c.moved++;
      const text = c.name + "侦察回来，带回" + bundleText(gain) + (o.raid.phase === "scheduled" ? "；还摸清了灰隼团的来路。" : "。");
      this.olog(text);
      if (this.s.region === "farm") this.toast(text);
    }
    if (hour < start || hour >= end) return set(hour >= 20 ? "收工休息" : "在帐篷里睡觉", "rest");
    if (c.trait === "scared" && (hour >= 19 || this.raidLive())) return set("天黑了，躲在帐篷里不敢出来", "rest");
    if (c.fedDay !== this.s.day && this.takeMeal()) c.fedDay = this.s.day;
    const fed = c.fedDay === this.s.day,
      upset = c.id === "youke" && o.youkeUpset === this.s.day;
    if (upset) return set(NPCS.youke.lines.upset, "hungry");
    if (fed && this.mealHour()) {
      const seat = this.diningSeat(this.c.residents.length + 1 + o.crew.indexOf(c)) || home;
      return set(hour === 12 ? "午饭时间" : "晚饭时间", "meal", seat);
    }
    if ((!fed || this.slowed("c:" + c.id)) && hour % 2)
      return set(!fed ? "没吃上早饭，干活慢一半 · 仓库放口粮" : "身体不舒服，干活慢一半", "hungry");
    if (c.role === "guard") return set(this.raidLive() ? "在东侧围栏迎敌" : "在东侧围栏站岗", "guard", { x: GATE_POST.x, y: GATE_POST.y + o.crew.indexOf(c) * 26 });
    if (c.role === "scout") {
      if (c.outDay !== this.s.day && hour >= 8 && hour < 15) {
        c.outDay = this.s.day;
        return set("出门侦察，傍晚回来", "scout", { x: 1420, y: 400 });
      }
      if (c.outDay === this.s.day && c.backDay !== this.s.day) return set("在外侦察", "scout", { x: 1420, y: 400 });
    }
    if (c.role === "build") {
      const damaged = this.s.buildings.find((b) => b.hp < BUILDINGS[b.type].hp && b.type !== "trap");
      if (damaged && this.takeFarm({ wood: 1 })) {
        const amount = (c.trait === "handy" ? 60 : 30) * (this.hasBundle("workshop") ? 2 : 1);
        damaged.hp = Math.min(BUILDINGS[damaged.type].hp, damaged.hp + amount);
        this.navRevision++;
        c.moved++;
        return set("维修" + BUILDINGS[damaged.type].name, "build", { x: damaged.x, y: damaged.y + 50 });
      }
      const inc = o.incidents.find((i) => i.type === "jam");
      if (inc) {
        o.incidents = o.incidents.filter((i) => i !== inc);
        c.moved++;
        const [x, y] = this.stationPoint(inc.station);
        this.toast(c.name + "排除了" + (BUILDINGS[inc.station]?.name || "设施") + "的卡料。");
        return set("排除卡料", "build", { x, y: y + 60 });
      }
    }
    const job = this.helperJob(c.name);
    if (job && job.run()) {
      c.moved++;
      return set(job.status, "carry", job.at);
    }
    return set(c.role === "build" ? "没有要修的，整理工具" : "暂时没活，在营地待命", "idle");
  }
  updateCrew(dt) {
    if (this.s.region !== "farm") return;
    this._crewPaths ??= new Map();
    for (const h of this.o.crew) {
      if (this.raidLive() && h.role === "guard") h.target = { x: GATE_POST.x, y: GATE_POST.y + this.o.crew.indexOf(h) * 26 };
      const target = h.target;
      if (target && dist(h, target) > 8) {
        let path = this._crewPaths.get(h.id);
        const goal = target.x + "," + target.y;
        if (!path || path.goal !== goal || path.revision !== this.navRevision || path.until < this.s.playSeconds) {
          path = { goal, revision: this.navRevision, until: this.s.playSeconds + 2, points: this.pathTo(h, target) };
          this._crewPaths.set(h.id, path);
        }
        if (path.points[0] && dist(h, path.points[0]) < 18) path.points.shift();
        const next = this.lineClear(h, target) ? target : path.points[0];
        if (next) {
          const a = Math.atan2(next.y - h.y, next.x - h.x);
          h.facing = a;
          this.moveEntity(h, Math.cos(a) * 55 * dt, Math.sin(a) * 55 * dt);
          h.x = clamp(h.x, 0, WORLD.w);
          h.y = clamp(h.y, 0, WORLD.h);
        }
      }
      const obj = this.objects.find((x) => x.type === "allianceHelper" && x.crew && x.helper === h.id);
      if (obj) {
        obj.x = h.x;
        obj.y = h.y;
      }
    }
  }
  guardFire(dt) {
    if (this.s.region !== "farm") return;
    const guards = this.o.crew.filter(
      (c) => c.role === "guard" && !(c.trait === "scared" && (this.isNight() || this.raidLive())),
    );
    if (!guards.length) return;
    this._guardClock ??= new Map();
    for (const g of guards) {
      const t = Math.max(0, (this._guardClock.get(g.id) || 0) - dt);
      this._guardClock.set(g.id, t);
      if (t > 0) continue;
      const e = this.enemies
        .filter((z) => !z.dead && !z.fled && dist(z, g) < 280)
        .sort((a, b) => dist(a, g) - dist(b, g))[0];
      if (!e) continue;
      const free = this.hasBundle("defense");
      if (!free && !this.takeFarm({ ammo: 1 })) {
        if (!this._guardNoAmmo) {
          this._guardNoAmmo = true;
          this.toast(g.name + "：没子弹了！仓库放点弹药。", "warn");
        }
        continue;
      }
      this._guardNoAmmo = false;
      const shots = free && this.raidState().phase === "active" ? 2 : 1,
        boost = this.o.prep === "towers" && this.firstRaid() && this.o.raid.phase === "active" ? 1.4 : 1;
      for (let i = 0; i < shots && !e.dead; i++)
        this.hurtEnemy(e, 16 * boost, Math.atan2(e.y - g.y, e.x - g.x), { guard: true });
      this._guardClock.set(g.id, this.guardCooldown());
      this.particlesAt(g.x + Math.cos(g.facing || 0) * 18, g.y - 30, "#f3d488", 3);
    }
  }
  guardCooldown() {
    return 1.6;
  }
  talkHelper(id) {
    const c = this.o.crew.find((x) => x.id === id);
    if (!c) return super.talkHelper(id);
    this.emit("menu", { menu: "outpost", view: "crew", id });
    return true;
  }

  // ---------- 第三至第六段的故事动作 ----------
  chooseStory(step, choice) {
    const sc = this.sc,
      o = this.o;
    if (!sc) return false;
    let ok = false;
    if (step === "hospitalChoice") ok = this.chooseHospital(choice);
    else if (step === "latheMode") ok = this.setLatheMode(choice);
    else if (step === "cargo") ok = this.startConvoy(choice);
    else if (step === "toll") ok = this.answerToll(choice);
    else if (step === "prep") ok = this.choosePrep(choice);
    else if (step === "yaozi") ok = this.decidePrisoner(choice);
    if (ok) {
      this.checkStory();
      this.emit("quest");
    }
    return ok;
  }
  doStory(step) {
    const ok =
      step === "youke"
        ? this.rescueYouke()
        : step === "lathe"
          ? this.restoreLathe()
          : step === "cache"
            ? this.destroyCache()
            : false;
    if (ok) this.checkStory();
    return ok;
  }
  chooseHospital(id) {
    const o = this.o,
      c = HOSPITAL_CHOICE[id];
    if (!c || (this.sc.act || 1) < 3) return false;
    if (o.hospital) {
      this.toast("医院那边已经安排过了。");
      return false;
    }
    if (Object.keys(c.cost).length) {
      const lack = missingCost(this, c.cost);
      if (lack.length || !this.takeFarm(c.cost)) {
        this.toast("修水泵还缺：" + lack.join("、") + "。", "warn");
        return false;
      }
    }
    o.hospital = id;
    this.once("hospital");
    if (id === "patients") {
      o.patients = { day: this.s.day, fedDays: 0, lastFed: 0, gone: false, done: false };
      this.toast("两名伤员被抬进了营地。接下来两天的晚饭，每人每天要 1 份口粮。", "gold");
      this.olog("接回两名伤员，在营地养伤。");
    } else {
      o.herbDay = this.s.day;
      this.toast("医院的水泵转起来了。从明天起，每天清晨送 1 份药草进仓库。", "gold");
      this.olog("修好医院水泵：每天送 1 份药草。");
    }
    this.storyLog(c.name + "。");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  patientsHere() {
    const p = this.o?.patients;
    return !!p && !p.gone && !p.done;
  }
  patientsRecovered() {
    const o = this.o;
    o.patients.done = true;
    if (this.addCrew({ id: "zou", name: "邹叔", trait: "glutton", role: "carry", look: 2 })) {
      this.once("zou");
      this.olog("伤员养好了。邹叔留下来当搬运队员——他饭量大，一天吃三份。", "gold");
      this.toast("伤员养好了！邹叔留下当搬运队员（大胃王：一天三份口粮）。", "gold");
    } else {
      this.putStorage({ herb: 2 });
      this.olog("伤员养好了。营地满员，邹叔回医院帮忙，托人送来 2 份药草。", "gold");
    }
    if (this.s.region === "farm") this.assignRegion();
  }
  rescueYouke() {
    const o = this.o,
      spot = SPOTS.youke;
    if (o.youke) return false;
    if ((this.sc.act || 1) < 4) {
      this.toast("先把医院的事办完。", "warn");
      return false;
    }
    if (this.s.region !== spot.region || dist(this.s.player, spot) > 120) {
      this.toast("尤可在工业仓库设备区的工具架后面。", "warn");
      return false;
    }
    o.youke = true;
    this.once("youke");
    this.addCrew({ id: "youke", name: "尤可", trait: "nightowl", role: "build", look: "youke" });
    this.toast("尤可：" + NPCS.youke.lines.rescued, "gold");
    this.olog("接回尤可。她住在机床边。", "gold");
    this.storyLog("尤可来到农场，说旧机床还能修。");
    this.assignRegion();
    this.emit("rescue");
    return true;
  }
  restoreLathe() {
    const o = this.o;
    if (o.lathe) return false;
    if (!o.youke) {
      this.toast("这台机床锈死了，得找懂行的人。陈工说仓库里的尤可会修。", "warn");
      return false;
    }
    if (this.s.region !== "farm" || dist(this.s.player, SPOTS.lathe) > 120) {
      this.toast("走到农场东边的旧机床旁再修。", "warn");
      return false;
    }
    const lack = missingCost(this, LATHE_COST);
    if (lack.length || !this.takeFarm(LATHE_COST)) {
      this.toast("修机床还缺：" + lack.join("、") + "。", "warn");
      return false;
    }
    o.lathe = { mode: null, day: 0 };
    this.once("lathe");
    this.clearMark(SPOTS.lathe);
    this.particlesAt(SPOTS.lathe.x, SPOTS.lathe.y - 30, "#e7c27a", 18);
    this.toast("机床重新转起来了！先定下它每天优先做什么。", "gold");
    this.olog("修好旧机床。", "gold");
    this.storyLog("旧机床重新转动。");
    this.assignRegion();
    this.emit("craft");
    return true;
  }
  setLatheMode(mode) {
    const o = this.o;
    if (!o.lathe || !LATHE_MODES[mode]) return false;
    if (o.lathe.mode === mode) return false;
    o.lathe.mode = mode;
    this.once("latheMode");
    this.toast("机床改为优先" + LATHE_MODES[mode].name + "：" + LATHE_MODES[mode].desc + "，每天 18:00 开工。", "gold");
    return true;
  }
  latheSlots() {
    return 1 + (this.s.buildings.some((b) => b.type === "solar" && b.hp > 0) ? 1 : 0);
  }
  latheRun() {
    const o = this.o;
    if (!o.lathe?.mode || o.lathe.day === this.s.day) return 0;
    o.lathe.day = this.s.day;
    const m = LATHE_MODES[o.lathe.mode];
    let slots = this.latheSlots(),
      made = 0;
    if (o.youkeUpset === this.s.day) slots = Math.max(0, slots - 1);
    for (let i = 0; i < slots; i++)
      if (this.takeFarm(m.input)) {
        this.putStorage(m.output);
        this.recordProduced?.(m.output);
        made++;
      }
    const text = made
      ? "机床今天做了" + made + "批" + m.name + "：" + bundleText(Object.fromEntries(Object.entries(m.output).map(([k, v]) => [k, v * made]))) + "，已入仓。"
      : "机床缺料停工：每批要" + bundleText(m.input) + "。";
    this.olog(text, made ? "normal" : "warn");
    if (this.s.region === "farm") this.toast(text, made ? "normal" : "warn");
    return made;
  }
  buildGadget(id) {
    const o = this.o,
      g = NPCS.youke.gadgets[id];
    if (!g || !o.youke) return false;
    if (o.gadgets.includes(id)) {
      this.toast(g.name + "已经做好了。");
      return false;
    }
    if (o.youkeUpset === this.s.day) {
      this.toast("尤可：" + NPCS.youke.lines.upset, "warn");
      return false;
    }
    if (this.s.region !== "farm") return false;
    const lack = missingCost(this, g.cost);
    if (lack.length || !this.takeFarm(g.cost)) {
      this.toast("做" + g.name + "还缺：" + lack.join("、") + "。", "warn");
      return false;
    }
    o.gadgets.push(id);
    this.once("gadget:" + id);
    this.toast("尤可做好了" + g.name + "：" + g.effect + "。", "gold");
    this.olog("尤可的小发明：" + g.name + "。", "gold");
    return true;
  }
  startConvoy(id) {
    const o = this.o,
      c = CARGO[id];
    if (!c || (this.sc.act || 1) < 5) return false;
    if (o.cargo) {
      this.toast("车队已经出发过了。");
      return false;
    }
    if (this.s.region !== "farm") {
      this.toast("回到农场装车。", "warn");
      return false;
    }
    if (this.quantityForCost("radish", true) < 1) {
      this.toast("红薯：" + NPCS.hongshu.lines.strike + "（要 1 个萝卜当工钱）", "warn");
      return false;
    }
    const total = { ...c.cost, radish: (c.cost.radish || 0) + 1 },
      lack = missingCost(this, c.cost);
    if (lack.length || !this.takeFarm(total)) {
      this.toast("装车还缺：" + lack.join("、") + "。", "warn");
      return false;
    }
    o.cargo = id;
    this.once("cargo");
    o.convoy = { departs: Math.floor(this.abs()), arrives: Math.floor(this.abs()) + CONVOY_MINUTES, escorted: false, spawned: false, foes: [], done: false, lost: false };
    this.toast(NPCS.hongshu.lines.paid + " " + c.name + "上路了，约 4 小时后到。想护送就去集市旧街口。", "gold");
    this.olog(c.name + "出发。");
    this.storyLog("第一支车队出发：" + c.name + "。");
    return true;
  }
  spawnConvoyFoes() {
    const o = this.o,
      c = o.convoy;
    if (!c || c.done || c.escorted || c.spawned || this.s.region !== SPOTS.escort.region) return false;
    c.spawned = true;
    const pts = [
      [SPOTS.escort.x - 60, SPOTS.escort.y + 40],
      [SPOTS.escort.x + 70, SPOTS.escort.y + 30],
      [SPOTS.escort.x + 10, SPOTS.escort.y + 110],
      [SPOTS.escort.x + 120, SPOTS.escort.y + 100],
    ];
    c.foes = pts.map(([x, y], i) => {
      const e = this.enemy(i === 3 ? "runner" : "slow", x, y);
      e.convoy = true;
      this.enemies.push(e);
      return e.id;
    });
    this.toast("旧街口有 4 名感染者挡着车队的路，清掉它们！", "warn");
    return true;
  }
  checkEscort() {
    const c = this.o.convoy;
    if (!c || c.done || c.escorted || !c.spawned || this.s.region !== SPOTS.escort.region) return;
    const alive = this.enemies.filter((e) => c.foes.includes(e.id) && !e.dead);
    if (alive.length) return;
    c.escorted = true;
    this.toast("旧街口清干净了，车队可以安全通过。", "gold");
    this.olog("护送车队穿过旧街口。", "gold");
    this.xp("combat", 10);
  }
  arriveConvoy() {
    const o = this.o,
      c = o.convoy;
    if (!c || c.done || this.abs() < c.arrives) return false;
    c.done = true;
    c.lost = !c.escorted;
    const money = c.lost ? 40 : 60;
    this.s.money += money;
    if (this.s.enemies.market) this.s.enemies.market = this.s.enemies.market.filter((e) => !c.foes.includes(e.id) || e.dead);
    if (this.s.region === "market") this.enemies = this.s.enemies.market;
    o.caravan.next = this.s.day + (o.cargo === "food" ? 1 : 2);
    this.once("convoy");
    const text =
      CARGO[o.cargo].name +
      "到站了" +
      (c.lost ? "，可旧街口被劫走三分之一的货：" : "，一件没少：") +
      money +
      " 金币。" +
      CARGO[o.cargo].desc;
    this.toast(text, "gold");
    this.olog(text, "gold");
    this.storyLog(CARGO[o.cargo].name + "到站。唐九的商队第" + o.caravan.next + "天来。");
    this.checkStory();
    this.emit("quest");
    return true;
  }
  answerToll(choice) {
    const o = this.o;
    if ((this.sc.act || 1) < 6 || o.toll || !["pay", "refuse"].includes(choice)) return false;
    if (choice === "pay") {
      const lack = missingCost(this, TOLL_COST);
      if (lack.length || !this.takeFarm(TOLL_COST)) {
        this.toast("过路费还缺：" + lack.join("、") + "。", "warn");
        return false;
      }
      o.toll = "pay";
      this.scheduleRaid(3);
      this.toast("灰隼团收下了，却撂下一句：“三天后，来收下一笔。”第" + o.raid.day + "天 19:00 他们会带人来。", "warn");
    } else {
      o.toll = "refuse";
      this.scheduleRaid(1);
      this.toast("你把信撕了。灰隼团明天（第" + o.raid.day + "天）19:00 来袭，抓紧备战。", "warn");
    }
    this.once("toll");
    this.olog("灰隼团来袭时间：第" + o.raid.day + "天 19:00。", "warn");
    return true;
  }
  choosePrep(id) {
    const o = this.o,
      c = RAID_PREP[id];
    if (!c || !o.toll || o.prep || o.raid.phase === "won") return false;
    if (Object.keys(c.cost).length) {
      const lack = missingCost(this, c.cost);
      if (lack.length || !this.takeFarm(c.cost)) {
        this.toast(c.name + "还缺：" + lack.join("、") + "。", "warn");
        return false;
      }
    }
    o.prep = id;
    this.once("prep");
    this.toast("备战：" + c.name + "。" + c.desc, "gold");
    this.olog("备战：" + c.name + "。");
    if (id === "supply") this.toast("补给点已标在工业仓库南边的货堆，按 E 拆掉。");
    return true;
  }
  destroyCache() {
    const o = this.o,
      spot = SPOTS.cache;
    if (o.prep !== "supply" || o.cache) return false;
    if (this.s.region !== spot.region || dist(this.s.player, spot) > 120) {
      this.toast("灰隼团的补给点在工业仓库南边的货堆。", "warn");
      return false;
    }
    o.cache = true;
    this.once("cache");
    if (!this.add({ ammo: 12 }, true)) this.putStorage({ ammo: 12 });
    this.particlesAt(spot.x, spot.y - 20, "#e0a36b", 20);
    this.toast("补给点拆了！缴获弹药×12。这次来袭的枪手会少 4 个。", "gold");
    this.olog("拆掉灰隼团补给点。", "gold");
    this.assignRegion();
    return true;
  }
  decidePrisoner(choice) {
    const o = this.o;
    if (o.prisoner !== "held") return false;
    if (choice === "interrogate") {
      o.prisoner = "interrogated";
      this.putStorage({ ammo: 12, scrap: 6 });
      this.toast("鹞子：" + NPCS.yaozi.lines.talk + "（缴获弹药×12、废金属×6 已入仓）", "gold");
      this.olog("审问鹞子，挖出灰隼团藏的弹药。");
    } else if (choice === "release") {
      o.prisoner = "released";
      this.addReputation(3);
      this.toast("鹞子愣了一下，朝你点点头，走进了林子。营地声望 +3。", "gold");
      this.olog("放走鹞子。");
    } else if (choice === "stay") {
      if (this.crewFull()) {
        this.toast("援建营地满员（3/3），先请一位队员离开。", "warn");
        return false;
      }
      o.prisoner = "stayed";
      this.addCrew({ id: "yaozi", name: "鹞子", trait: "diligent", role: "scout", look: "yaozi" });
      this.toast("鹞子：" + NPCS.yaozi.lines.stay, "gold");
      this.olog("鹞子留下当侦察队员。", "gold");
    } else return false;
    this.once("yaozi");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  claimCai(id) {
    const ch = NPCS.cai.challenges.find((x) => x.id === id),
      o = this.o;
    if (!ch || o.claimed.includes("cai:" + id)) return false;
    if ((o.cai[id] || 0) < ch.need) {
      this.toast("蔡眼镜：还差一点——" + ch.text + "（" + (o.cai[id] || 0) + "/" + ch.need + "）。");
      return false;
    }
    if (!this.add(ch.reward)) this.putStorage(ch.reward);
    this.once("cai:" + id);
    this.toast("蔡眼镜：" + NPCS.cai.lines.done + "（" + bundleText(ch.reward) + "）", "gold");
    this.olog("完成蔡眼镜的考验：" + ch.text + "。", "gold");
    return true;
  }
  finishAct(n) {
    const sc = this.sc,
      act = ACTS[n];
    if (!act || sc.claimed.includes("act" + n)) return false;
    sc.claimed.push("act" + n);
    sc.act = n + 1;
    this.s.money += act.reward.money;
    this.addReputation(act.reward.reputation);
    const letter = "act" + (n + 1);
    if (!sc.letters.includes(letter)) sc.letters.push(letter);
    sc.unread = true;
    this.storyLog(act.label + "「" + act.name + "」完成：" + act.reward.money + " 金币、声望 +" + act.reward.reputation + "。");
    this.toast(act.label + "「" + act.name + "」完成：" + act.reward.money + " 金币、营地声望 +" + act.reward.reputation + "。", "gold");
    this.toast("小柒：终端收到新来信，打开任务手记（J）查看。", "gold");
    this.olog(act.label + "「" + act.name + "」完成。", "gold");
    if (n + 1 >= 3 && !this.o.visitors.next) this.o.visitors.next = this.s.day + 1;
    this.emit("quest");
    return true;
  }
  checkStory() {
    super.checkStory();
    const sc = this.sc;
    if (!sc || !this.o || this._outpostBusy) return;
    this._outpostBusy = true;
    try {
      if (sc.act >= 3 && !this.o.visitors.next) this.o.visitors.next = this.s.day + 1;
      for (let guard = 0; guard < 4 && sc.act >= 3 && sc.act <= 6; guard++) {
        const steps = outpostSteps(this);
        if (!steps.length || steps.some((s) => !s.done)) break;
        this.finishAct(sc.act);
      }
    } finally {
      this._outpostBusy = false;
    }
  }

  // ---------- 灰隼团袭击 ----------
  // 当前生效的袭击记录：第六段的灰隼团；之后的层可以换成别的有组织袭击（共用同一套枪手规则）。
  raidState() {
    return this.o.raid;
  }
  firstRaid() {
    return this.raidState() === this.o.raid;
  }
  scheduleRaid(days) {
    const r = this.o.raid;
    Object.assign(r, { ...raidDefaults(), tries: r.tries, report: r.report, phase: "scheduled", day: this.s.day + days });
  }
  raidDue() {
    const r = this.raidState();
    return r.phase === "scheduled" && this.abs() >= r.day * 1440 + 1140;
  }
  raidCountdownText() {
    const r = this.raidState();
    if (r.phase !== "scheduled") return ["warning", "active"].includes(r.phase) ? "现在" : "未定";
    const m = r.day * 1440 + 1140 - this.abs();
    if (m <= 0) return "现在";
    const h = Math.floor(m / 60);
    return (h ? h + " 小时 " : "") + Math.floor(m % 60) + " 分钟";
  }
  raidSize() {
    const o = this.o;
    let n = 8 + Math.min(1, o.raid.tries);
    if (o.prep === "towers") n -= 2;
    if (o.prep === "supply" && o.cache) n -= 4;
    return Math.max(3, n);
  }
  startRaidWarning() {
    const r = this.raidState();
    r.phase = "warning";
    r.timer = 45 + (this.o.gadgets.includes("alarm") ? 45 : 0) + (this.o.crew.some((c) => c.role === "scout") ? 20 : 0);
    this.toast("灰隼团的车灯出现在东边林子里！" + Math.ceil(r.timer) + " 秒后进攻——Z 键查看防线。", "warn");
    this.olog("灰隼团来袭预警。", "warn");
    this.emit("alarm");
  }
  beginRaid() {
    const r = this.raidState();
    r.phase = "active";
    r.total = this.raidSize();
    r.spawned = 0;
    r.killed = 0;
    r.retreated = 0;
    r.spawnTimer = 0;
    r.clock = 0;
    for (const res of this.c.residents) if (res.priorities?.guard) res.workRole = "guard";
    this.toast("灰隼团进攻了：" + r.total + " 名枪手。看到红线就挪位置！", "warn");
    this.emit("alarm");
  }
  coverSpot(i) {
    const list = this.s.buildings
      .filter((b) => b.hp > 0 && b.x > 950 && BUILDINGS[b.type])
      .sort((a, b) => b.x - a.x);
    for (let k = 0; k < list.length; k++) {
      const b = list[(i + k) % list.length],
        d = BUILDINGS[b.type],
        w = b.rotation % 2 ? d.h : d.w,
        p = { x: Math.min(1400, b.x + w / 2 + 26), y: b.y + (i % 2 ? 22 : -22) };
      if (!this.blocked(p.x, p.y, true, 13)) return p;
    }
    for (let k = 0; k < 12; k++) {
      const p = { x: 1180 + ((i * 53 + k * 37) % 200), y: 330 + ((i * 97 + k * 71) % 300) };
      if (!this.blocked(p.x, p.y, true, 13)) return p;
    }
    return null;
  }
  spawnRaider() {
    const r = this.raidState(),
      i = r.spawned,
      pt = HORDE_DIRECTIONS[0].spawns[i % 2],
      e = this.enemy("raider", pt[0], clamp(pt[1] + (this.roll() - 0.5) * 50, 80, WORLD.h - 80), false);
    Object.assign(e, { raid: true, aim: 0, aimX: 0, aimY: 0, cooldown: 1.5 + this.roll(), state: "chase", post: this.coverSpot(i), blind: 0 });
    this.enemies.push(e);
    r.spawned++;
    return e;
  }
  updateRaid(dt) {
    const o = this.o,
      r = this.raidState();
    if (r.phase === "scheduled" && this.raidDue()) {
      if (["warning", "active"].includes(this.s.horde.phase)) return;
      if (this.s.region !== "farm") return this.autoResolveRaid("away");
      this.startRaidWarning();
    }
    if (r.phase === "warning") {
      r.timer = Math.max(0, r.timer - dt);
      if (!r.timer) {
        if (this.s.region !== "farm") return this.autoResolveRaid("away");
        this.beginRaid();
      }
    }
    if (r.phase !== "active") return;
    if (this.s.region !== "farm") return this.autoResolveRaid("left");
    r.clock += dt;
    r.spawnTimer = Math.max(-1, r.spawnTimer - dt);
    const lureHold = this.firstRaid() && o.prep === "lure" && r.spawned >= Math.ceil(r.total / 2) && r.clock < 60;
    if (r.spawned < r.total && r.spawnTimer <= 0 && !lureHold) {
      this.spawnRaider();
      r.spawnTimer = 3.2;
    }
    if (r.spawned >= r.total && !this.enemies.some((e) => e.type === "raider" && !e.dead)) this.finishRaid(true, false);
  }
  raidPower() {
    const o = this.o,
      guards = this.c.residents.filter((r) => r.priorities?.guard > 0 || r.role === "guard").length,
      crewGuards = o.crew.filter((c) => c.role === "guard" && c.trait !== "scared").length,
      towers = this.s.buildings.filter((b) => b.type === "tower" && b.hp > 0).length,
      fences = this.s.buildings.filter((b) => ["fence", "gate"].includes(b.type) && b.hp > 0).length;
    let p =
      1 +
      (guards + crewGuards) * 2 +
      Math.min(towers, guards + crewGuards) * 1.5 +
      Math.min(4, fences * 0.25) +
      ((this.s.storage.ammo || 0) >= 12 ? 1 : 0) +
      (this.hasBundle("defense") ? 2 : 0) +
      // 每输一次，联盟多派一队支援，避免越输越难。
      this.raidState().tries * 1.5;
    if (o.prep === "towers" && this.firstRaid()) p *= 1.4;
    return Math.round(p * 10) / 10;
  }
  autoResolveRaid(reason) {
    const r = this.raidState();
    if (!["scheduled", "warning", "active"].includes(r.phase)) return false;
    const remaining = r.phase === "active" ? Math.max(0, r.total - r.killed - r.retreated) : this.raidSize();
    if (r.phase !== "active") r.total = remaining;
    const power = this.raidPower(),
      won = power >= remaining * 0.9;
    if (won) r.retreated += Math.max(0, remaining - Math.floor(remaining / 2));
    if (won) r.killed += Math.floor(remaining / 2);
    this.finishRaid(won, true, reason === "left" ? "你离开了农场，守卫替你迎战" : "你不在农场，守卫替你迎战");
    return true;
  }
  raidLoot() {
    const lost = {},
      take = (id, n) => {
        const k = Math.min(this.s.storage[id] || 0, n);
        if (k > 0) {
          this.s.storage[id] -= k;
          if (!this.s.storage[id]) delete this.s.storage[id];
          lost[id] = (lost[id] || 0) + k;
        }
      };
    let food = Math.min(8, Math.ceil(MEAL_ITEMS.reduce((n, id) => n + (this.s.storage[id] || 0), 0) * 0.3));
    for (const id of MEAL_ITEMS) {
      if (food <= 0) break;
      const before = lost[id] || 0;
      take(id, food);
      food -= (lost[id] || 0) - before;
    }
    take("ammo", Math.min(24, Math.ceil((this.s.storage.ammo || 0) * 0.3)));
    take("scrap", Math.min(10, Math.ceil((this.s.storage.scrap || 0) * 0.2)));
    return lost;
  }
  finishRaid(won, auto = false, note = "") {
    const o = this.o,
      r = this.raidState(),
      first = r === o.raid;
    if (this.s.enemies.farm) this.s.enemies.farm = this.s.enemies.farm.filter((e) => e.type !== "raider");
    if (this.s.region === "farm") this.enemies = this.s.enemies.farm;
    this.raidShots = [];
    const report = {
      day: this.s.day,
      won,
      auto,
      note,
      total: r.total,
      killed: r.killed,
      retreated: r.retreated,
      prep: first ? o.prep : null,
      kind: first ? "first" : "later",
      power: this.raidPower(),
      lost: {},
      gain: {},
    };
    if (!first) this.raidOutcome(r, won, report);
    else if (won) {
      r.phase = "won";
      o.prisoner ??= "held";
      o.cai.raiders++;
      this.s.money += 80;
      report.gain = { ammo: 12, parts: 2 };
      this.putStorage(report.gain);
      this.once("raid");
      const text = "灰隼团被打退了！缴获" + bundleText(report.gain) + "与 80 金币；围栏边抓到一个人，叫鹞子。商路不再交钱，买东西便宜一成。";
      this.toast(text, "gold");
      this.olog(text, "gold");
      this.storyLog("击退灰隼团，商路不再交买路钱。");
      this.emit("victory");
    } else {
      report.lost = this.raidLoot();
      r.tries++;
      r.phase = "scheduled";
      r.day = this.s.day + 2;
      const text =
        "没守住：灰隼团抢走了" +
        (Object.keys(report.lost).length ? bundleText(report.lost) : "一些零碎") +
        "。他们第" +
        r.day +
        "天 19:00 还会再来——这次补足弹药、守卫和围栏。联盟会多派一队人来支援。";
      this.toast(text, "warn");
      this.olog(text, "warn");
    }
    this.lastRaid = r;
    r.total = 0;
    r.spawned = 0;
    r.killed = 0;
    r.retreated = 0;
    r.timer = 0;
    r.clock = 0;
    r.spawnTimer = 0;
    r.report = report;
    if (this.s.region === "farm") this.assignRegion();
    this.emit("menu", { menu: "outpost", view: "raid" });
    this.checkStory();
    return true;
  }
  raidOutcome(r, won, report) {
    // 其它有组织袭击的胜负由后续的层处理。
    r.phase = won ? "won" : "scheduled";
  }
  // 上次战报对应的那条袭击记录（后续的层可以换成更新的一条）。
  lastRaidRecord() {
    return this.lastRaid || this.o.raid;
  }
  lastRaidReport() {
    return this.lastRaidRecord().report || this.o.raid.report;
  }
  updateRaider(e, dt) {
    if (e.dead) return;
    e.cooldown = Math.max(0, e.cooldown - dt);
    e.flash = Math.max(0, (e.flash || 0) - dt);
    e.pathTimer -= dt;
    const p = this.s.player,
      d = dist(e, p);
    if (!e.retreat && e.hp < e.maxHp * 0.35) {
      e.retreat = true;
      e.aim = 0;
      this.effects.push({ x: e.x, y: e.y - 70, text: "撤退！", t: 0.9, color: "#e6c48a" });
    }
    if (e.retreat) {
      this.moveRaider(e, { x: 1462, y: clamp(e.y, 360, 600) }, dt, 1.15);
      if (e.x >= 1416) {
        e.dead = true;
        e.fled = true;
        this.raidState().retreated++;
      }
      return;
    }
    if (e.aim > 0) {
      e.aim -= dt;
      e.facing = Math.atan2(e.aimY - (e.y - 30), e.aimX - e.x);
      if (e.aim <= 0) this.fireRaidShot(e);
      return;
    }
    const sees = d < 360 && this.lineClear(e, p);
    e.blind = sees ? 0 : (e.blind || 0) + dt;
    e.cover = !!e.post && dist(e, e.post) < 26 && p.x < e.x - 30;
    let goal = null;
    if (d < 140) goal = { x: e.x + ((e.x - p.x) / Math.max(1, d)) * 90, y: e.y + ((e.y - p.y) / Math.max(1, d)) * 90 };
    else if (e.blind > 2.5) goal = p;
    else if (e.post && dist(e, e.post) > 20 && d > 180) goal = e.post;
    else if (d > 340) goal = p;
    if (goal) {
      goal = { x: clamp(goal.x, 60, WORLD.w - 40), y: clamp(goal.y, 70, WORLD.h - 70) };
      this.moveRaider(e, goal, dt, 1);
    }
    if (sees && e.cooldown <= 0) {
      e.aim = 1;
      e.aimX = p.x;
      e.aimY = p.y - 24;
    }
  }
  moveRaider(e, goal, dt, mult) {
    const key = Math.round(goal.x / 20) + "," + Math.round(goal.y / 20);
    if (e.pathTimer <= 0 || !e.path.length || e.goalKey !== key) {
      e.path = this.pathTo(e, goal);
      e.pathTimer = 0.8;
      e.goalKey = key;
    }
    if (e.path[0] && dist(e, e.path[0]) < 18) e.path.shift();
    const next = this.lineClear(e, goal) ? goal : e.path[0];
    if (!next) return;
    const a = Math.atan2(next.y - e.y, next.x - e.x),
      speed = ZOMBIES.raider.speed * mult;
    e.facing = a;
    this.moveEntity(e, Math.cos(a) * speed * dt, Math.sin(a) * speed * dt, true);
    if (e.retreat && this.blocked(e.x + Math.cos(a) * 4, e.y, true, 13)) e.x = Math.min(WORLD.w - 46, e.x + speed * dt);
  }
  fireRaidShot(e) {
    const a = Math.atan2(e.aimY - (e.y - 30), e.aimX - e.x),
      sp = 520;
    this.raidShots.push({
      x: e.x + Math.cos(a) * 18,
      y: e.y - 30 + Math.sin(a) * 18,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp,
      life: 0.85,
      damage: ZOMBIES.raider.damage,
    });
    e.cooldown = 2.2 + this.roll() * 0.8;
    this.noise.push({ x: e.x, y: e.y, r: 260, t: 1 });
    this.particlesAt(e.x + Math.cos(a) * 22, e.y - 30 + Math.sin(a) * 22, "#f2d68c", 4);
    this.emit("shot", { weapon: "raider" });
  }
  updateRaidShots(dt) {
    if (!this.raidShots.length) return;
    const p = this.s.player,
      walls = this.colliders(true);
    for (const b of this.raidShots) {
      const ox = b.x,
        oy = b.y;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(b.x - ox, b.y - oy) / 8));
      for (let k = 1; k <= steps; k++) {
        const x = ox + ((b.x - ox) * k) / steps,
          y = oy + ((b.y - oy) * k) / steps;
        if (walls.some((r) => inRect(x, y + 24, r))) {
          b.life = 0;
          this.particlesAt(x, y, "#c9b48a", 3);
          break;
        }
        if (Math.hypot(x - p.x, y - (p.y - 26)) < 16) {
          b.life = 0;
          this.damagePlayer(b.damage);
          break;
        }
      }
    }
    this.raidShots = this.raidShots.filter((b) => b.life > 0);
  }
  updateEnemy(e, dt) {
    if (e.type === "raider") return this.updateRaider(e, dt);
    return super.updateEnemy(e, dt);
  }
  hurtEnemy(e, damage, angle, meta = {}) {
    const alive = !e.dead;
    if (e.type === "raider") {
      if (e.cover && !meta?.guard) {
        damage *= 0.6;
        this.effects.push({ x: e.x, y: e.y - 80, text: "掩体", t: 0.5, color: "#cfc6a8" });
      }
      if (this._towerBoost) damage *= 1.4;
    }
    const out = super.hurtEnemy(e, damage, angle, meta);
    if (alive && e.dead && !e.fled) {
      const o = this.o;
      const rs = this.raidState();
      if (e.type === "raider" && rs.phase === "active") rs.killed++;
      if (meta && WEAPONS[meta.id]?.mag) o.cai.gunKills++;
      if (this.f?.crouch) o.cai.crouchKills++;
    }
    return out;
  }
  updateDefense(dt) {
    const free = this.hasBundle("defense");
    this._freeAmmo = free;
    this._towerBoost = this.o.prep === "towers" && this.firstRaid() && this.o.raid.phase === "active";
    try {
      super.updateDefense(dt);
    } finally {
      this._freeAmmo = false;
      this._towerBoost = false;
    }
    this.guardFire(dt);
  }
  die() {
    this.lastDeath = this._starve ? "hunger" : "hurt";
    this._starve = false;
    const r = this.o ? this.raidState() : null,
      lost = r?.phase === "active";
    super.die();
    // 先结算倒下，再出战报，让玩家醒来时看到被抢走了什么、下次什么时候来。
    if (lost) this.finishRaid(false, false, "你倒下了");
  }
  serialize() {
    const farm = this.s.enemies.farm;
    if (!farm?.some((e) => e.type === "raider")) return super.serialize();
    this.s.enemies.farm = farm.filter((e) => e.type !== "raider");
    try {
      return super.serialize();
    } finally {
      this.s.enemies.farm = farm;
    }
  }

  // ---------- 场景对象与 E 交互 ----------
  assignRegion() {
    super.assignRegion();
    const o = this.s.outpost,
      sc = this.s.storyCampaign;
    if (!o || !sc) return;
    const reg = this.s.region,
      push = (type, name, spot, extra = {}) => this.objects.push({ type, name, x: spot.x, y: spot.y, icon: 40, ...extra });
    if (reg === "farm") {
      push("outpostShipping", "出货箱", SPOTS.shipping);
      if (this.caravanHere()) push("outpostCaravan", "唐九的商队", SPOTS.caravan);
      if (o.visitors.current) push("outpostVisitor", o.visitors.current.name + " · 入营审查", SPOTS.gate);
      if (o.visitors.quarantine) push("outpostQuarantine", o.visitors.quarantine.name + " · 隔离观察", SPOTS.quarantine);
      if (sc.act >= 4 || o.lathe) push("outpostLathe", o.lathe ? "机床 · 尤可" : "锈住的旧机床", SPOTS.lathe);
      if (sc.act >= 5) push("outpostMule", "红薯 · 运输骡", SPOTS.mule);
      if (o.prisoner === "held") push("outpostPrisoner", "鹞子 · 俘虏", SPOTS.prisoner);
      if (this.patientsHere()) push("outpostPatients", "伤员 · 邹家", SPOTS.patients);
      for (const c of o.crew)
        this.objects.push({
          type: "allianceHelper",
          crew: true,
          helper: c.id,
          name: c.name + " · " + HELPER_ROLES[c.role],
          x: c.x,
          y: c.y,
          icon: 40,
        });
    }
    if (reg === SPOTS.youke.region) {
      if (sc.act >= 4 && !o.youke) push("outpostYouke", "尤可 · 敲机器的姑娘", SPOTS.youke);
      if (o.prep === "supply" && !o.cache && o.raid.phase !== "won") push("outpostCache", "灰隼团补给点", SPOTS.cache);
    }
    if (reg === SPOTS.cai.region) {
      if (sc.act >= 4) push("outpostCai", "蔡眼镜 · 兵器宅", SPOTS.cai);
      if (o.convoy && !o.convoy.done) {
        push("outpostEscort", o.convoy.escorted ? "车队 · 安全通过" : "旧街口 · 护送车队", SPOTS.escort);
        this.spawnConvoyFoes();
      }
    }
  }
  context(ob) {
    const o = this.o;
    if (ob && o) {
      if (ob.type === "outpostShipping") {
        const v = this.shipValue();
        return "出货箱 · " + (v ? "明早结算 " + v + " 金币" : "放进去的东西明早按收购价卖出");
      }
      if (ob.type === "outpostCaravan") return "唐九的商队 · 看货（20:00 收摊）";
      if (ob.type === "outpostVisitor") return "入营审查 · " + o.visitors.current?.name;
      if (ob.type === "outpostQuarantine") return o.visitors.quarantine?.name + " · 隔离观察中，明早见分晓";
      if (ob.type === "outpostLathe")
        return o.lathe
          ? "机床 · " + (o.lathe.mode ? "优先" + LATHE_MODES[o.lathe.mode].name : "还没排产") + " · 尤可的小发明"
          : o.youke
            ? "修复旧机床 · " + bundleText(LATHE_COST)
            : "锈住的旧机床 · 需要懂行的人";
      if (ob.type === "outpostMule") return "红薯 · 运输骡（工钱：萝卜）";
      if (ob.type === "outpostPrisoner") return "鹞子 · 决定怎么处置";
      if (ob.type === "outpostPatients")
        return "伤员养伤 · 已吃饱 " + (o.patients?.fedDays || 0) + "/2 天（每晚 2 份口粮）";
      if (ob.type === "outpostYouke") return "和尤可说话 · 带她回农场";
      if (ob.type === "outpostCache") return "拆掉灰隼团补给点";
      if (ob.type === "outpostCai") return "蔡眼镜 · 枪械考验";
      if (ob.type === "outpostEscort")
        return o.convoy?.escorted ? "车队 · 旧街口已清理" : "旧街口 · 击退感染者护送车队";
      if (ob.type === "allianceHelper" && ob.crew) {
        const c = o.crew.find((x) => x.id === ob.helper);
        return "和" + (c?.name || "队员") + "说话 · " + (c?.status || "待命");
      }
    }
    return super.context(ob);
  }
  interact() {
    if (this.paused) return;
    const ob = this.nearestObject();
    if (OUTPOST_OBJECTS.includes(ob?.type)) return this.outpostInteract(ob);
    return super.interact();
  }
  outpostInteract(ob) {
    const o = this.o,
      menu = (view, id = "") => this.emit("menu", { menu: "outpost", view, id });
    switch (ob.type) {
      case "outpostShipping":
        return menu("shipping");
      case "outpostCaravan":
        return menu("caravan");
      case "outpostVisitor":
        return menu("review");
      case "outpostQuarantine":
        return this.toast(o.visitors.quarantine?.name + "在隔离棚里，明早就知道他有没有问题。");
      case "outpostLathe":
        if (!o.lathe) {
          if (o.youke) {
            this.restoreLathe();
            this.checkStory();
          } else this.toast("机床锈死了。陈工说，仓库里有个叫尤可的姑娘会修。", "warn");
          return;
        }
        return menu("lathe");
      case "outpostMule":
        return menu("dialog", "hongshu");
      case "outpostPrisoner":
        return menu("dialog", "yaozi");
      case "outpostPatients":
        return this.toast("伤员：“谢谢你们……晚饭能有一口热的就好。”（已吃饱 " + (o.patients?.fedDays || 0) + "/2 天）");
      case "outpostYouke":
        if (this.rescueYouke()) this.checkStory();
        return;
      case "outpostCache":
        if (this.destroyCache()) this.checkStory();
        return;
      case "outpostCai":
        return menu("dialog", "cai");
      case "outpostEscort":
        return this.toast(o.convoy?.escorted ? "车夫：“多亏你，货一件没少。”" : "车夫：“前面的感染者不清掉，我们不敢过去！”");
    }
  }
  travel(id) {
    const ok = super.travel(id);
    if (ok && this.raidState().phase === "active" && this.s.region !== "farm") this.autoResolveRaid("left");
    return ok;
  }

  // ---------- 时间推进 ----------
  workHour() {
    super.workHour();
    const o = this.s.outpost;
    if (!o) return;
    const hour = Math.floor(this.s.minute / 60);
    if (hour === 7) this.morningCheck();
    if (hour === 8) this.arriveCaravan();
    if (hour === 9) this.arriveVisitor();
    for (const c of [...o.crew]) this.crewHour(c);
    if (hour === UPKEEP.dinnerHour) {
      this.latheRun();
      this.serveDinner();
    }
    if (o.caravan.offers.length && !this.caravanHere()) this.leaveCaravan();
    if (hour === 21 && o.visitors.current) {
      const v = o.visitors.current;
      o.visitors.current = null;
      o.visitors.next = this.s.day + 2;
      if (v.huer !== null && v.huer !== undefined) o.visitors.huer = Math.min(HUER_VISITS.length, o.visitors.huer + 1);
      this.olog(v.name + "在营门口等到天黑，离开了。");
      if (this.s.region === "farm") {
        this.toast(v.name + "在营门口等到天黑，离开了。");
        this.assignRegion();
      }
    }
    if (o.gadgets.includes("collector") && o.youkeUpset !== this.s.day)
      for (const j of this.c.production.filter((x) => x.ready)) this.storeProduction(j.id, true);
    this.checkIncidents();
    this.arriveConvoy();
  }
  onNewDay() {
    super.onNewDay();
    const o = this.s.outpost;
    if (!o) return;
    this.settleShipping();
    if (o.hospital === "water" && o.herbDay !== this.s.day) {
      o.herbDay = this.s.day;
      this.putStorage({ herb: 1 });
      if (this._night) this._night.push("医院的水泵送来 1 份药草。");
    }
    this.visitorNight();
    o.dayStart = this.snapshot();
  }
  update(dt, input = {}) {
    const running = !this.paused,
      before = this.s.player.hunger;
    if (running && this.s.player.hunger < 20 && (input.x || input.y))
      input = { ...input, x: (input.x || 0) * UPKEEP.weakSpeed, y: (input.y || 0) * UPKEEP.weakSpeed };
    super.update(dt, input);
    if (!running || this.paused || !this.s.outpost) return;
    dt = Math.min(0.05, Math.max(0, dt));
    this.hungerTick(dt, before);
    if (this.paused) return;
    this.updateRaid(dt);
    this.updateRaidShots(dt);
    this.updateCrew(dt);
    this.patrolHeal();
    this.alarmBoost();
    this._outpostClock = (this._outpostClock || 0) + dt;
    if (this._outpostClock >= 0.5) {
      this._outpostClock = 0;
      this.checkIncidents();
      this.checkEscort();
      this.arriveConvoy();
    }
  }
  alarmBoost() {
    const h = this.s.horde,
      o = this.o;
    if (h.phase !== "warning" || !o.gadgets.includes("alarm")) return;
    const key = this.s.day * 100 + (this.s.stats.hordes % 100);
    if (o.alarmKey === key) return;
    o.alarmKey = key;
    h.timer += 45;
    this.toast("尤可的警报铃响了：尸潮预警多出 45 秒。", "gold");
  }
  static parse(text) {
    const raw = JSON.parse(text),
      s = AllianceEngine.parse(text);
    if (raw.outpost !== undefined) validateOutpost(raw.outpost);
    return migrateState(s);
  }
}

function validateOutpost(o) {
  const object = (x) => x && typeof x === "object" && !Array.isArray(x),
    int = (x, max = 1e9) => Number.isInteger(x) && x >= 0 && x <= max,
    num = (x, a = 0, b = 1e9) => Number.isFinite(x) && x >= a && x <= b,
    str = (x, n = 200) => typeof x === "string" && x.length <= n,
    pos = (p) => object(p) && num(p.x, 0, WORLD.w) && num(p.y, 0, WORLD.h),
    oneOf = (x, list) => x === null || x === undefined || list.includes(x),
    bundle = (b) => object(b) && Object.entries(b).every(([id, n]) => ITEMS[id] && int(n, 99999)),
    unique = (a) => new Set(a).size === a.length,
    bad = () => {
      throw Error("前哨存档异常，请从设置恢复有效备份；原存档会保留。");
    },
    d = defaults();
  if (!object(o) || o.schema !== OUTPOST_SCHEMA || Object.keys(o).some((k) => !Object.hasOwn(d, k))) bad();
  for (const k of ["dinnerDay", "warnDay", "hungerNote", "herbDay", "youkeUpset", "alarmKey", "medicDay", "sick"])
    if (o[k] !== undefined && !int(o[k])) bad();
  for (const k of ["youke", "cache"]) if (o[k] !== undefined && typeof o[k] !== "boolean") bad();
  if (o.missed !== undefined && (!Array.isArray(o.missed) || o.missed.length > 40 || !o.missed.every((x) => str(x, 24)))) bad();
  if (!oneOf(o.hospital, Object.keys(HOSPITAL_CHOICE))) bad();
  if (!oneOf(o.cargo, Object.keys(CARGO))) bad();
  if (!oneOf(o.toll, ["pay", "refuse"])) bad();
  if (!oneOf(o.prep, Object.keys(RAID_PREP))) bad();
  if (!oneOf(o.prisoner, ["held", "interrogated", "released", "stayed"])) bad();
  if (o.gadgets !== undefined && (!Array.isArray(o.gadgets) || !unique(o.gadgets) || !o.gadgets.every((g) => NPCS.youke.gadgets[g]))) bad();
  if (o.bundles !== undefined && (!Array.isArray(o.bundles) || !unique(o.bundles) || !o.bundles.every((b) => BUNDLES[b]))) bad();
  if (o.claimed !== undefined && (!Array.isArray(o.claimed) || o.claimed.length > 80 || !unique(o.claimed) || !o.claimed.every((x) => str(x, 40)))) bad();
  if (o.patients !== undefined && o.patients !== null) {
    const p = o.patients;
    if (!object(p) || !int(p.day) || !int(p.fedDays, 2) || !int(p.lastFed) || typeof p.gone !== "boolean" || typeof p.done !== "boolean") bad();
  }
  if (o.lathe !== undefined && o.lathe !== null && (!object(o.lathe) || !oneOf(o.lathe.mode, Object.keys(LATHE_MODES)) || !int(o.lathe.day))) bad();
  if (o.convoy !== undefined && o.convoy !== null) {
    const c = o.convoy;
    if (
      !object(c) ||
      !int(c.departs) ||
      !int(c.arrives) ||
      !Array.isArray(c.foes) ||
      c.foes.length > 8 ||
      ["escorted", "spawned", "done", "lost"].some((k) => typeof c[k] !== "boolean")
    )
      bad();
  }
  if (o.raid !== undefined) {
    const r = o.raid;
    if (!object(r) || !RAID_PHASES.includes(r.phase ?? "none")) bad();
    for (const k of ["day", "total", "spawned", "killed", "retreated", "tries"]) if (r[k] !== undefined && !int(r[k], 1e6)) bad();
    for (const k of ["timer", "spawnTimer", "clock"]) if (r[k] !== undefined && !num(r[k], -1e6, 1e6)) bad();
    if (r.report !== undefined && r.report !== null && (!object(r.report) || typeof r.report.won !== "boolean")) bad();
  }
  if (o.shipBox !== undefined && !bundle(o.shipBox)) bad();
  if (o.ledger !== undefined && (!Array.isArray(o.ledger) || o.ledger.length > 10 || o.ledger.some((l) => !object(l) || !int(l.day) || !int(l.income) || !bundle(l.items)))) bad();
  if (o.rushed !== undefined && (!Array.isArray(o.rushed) || o.rushed.length > 40 || !o.rushed.every((x) => str(x, 40)))) bad();
  if (
    o.incidents !== undefined &&
    (!Array.isArray(o.incidents) ||
      o.incidents.length > 12 ||
      o.incidents.some((i) => !object(i) || !str(i.job, 40) || !BUILDINGS[i.station] || !["fire", "jam"].includes(i.type) || !int(i.deadline)))
  )
    bad();
  if (o.caravan !== undefined) {
    const c = o.caravan;
    if (!object(c) || !Array.isArray(c.offers) || c.offers.length > 6 || !Array.isArray(c.cheated) || c.cheated.length > 6) bad();
    for (const k of ["next", "until", "trust", "exposed", "visits"]) if (c[k] !== undefined && !int(c[k])) bad();
    for (const f of c.offers)
      if (
        !object(f) ||
        !int(f.key, 10) ||
        !(f.tech ? TECH[f.tech] : ITEMS[f.item]) ||
        !int(f.qty, 999) ||
        !int(f.price, 99999) ||
        (f.fake !== null && f.fake !== undefined && !ITEMS[f.fake]) ||
        !oneOf(f.inspected, ["real", "fake", "unclear"]) ||
        typeof f.sold !== "boolean"
      )
        bad();
    for (const f of c.cheated) if (!object(f) || !ITEMS[f.item] || !ITEMS[f.fake] || !int(f.price, 99999)) bad();
  }
  const visitorOk = (v) =>
    object(v) &&
    str(v.id, 12) &&
    str(v.name, 12) &&
    ["honest", "infected", "thief", "liar"].includes(v.kind) &&
    HELPER_ROLES[v.role] &&
    PEOPLE_TRAITS[v.trait] &&
    object(v.clues) &&
    CLUE_KEYS.every((k) => str(v.clues[k], 120)) &&
    Array.isArray(v.checked) &&
    v.checked.every((k) => CLUE_KEYS.includes(k));
  if (o.visitors !== undefined) {
    const v = o.visitors;
    if (!object(v)) bad();
    for (const k of ["next", "count", "huer", "joined"]) if (v[k] !== undefined && !int(v[k])) bad();
    if (v.current !== null && v.current !== undefined && !visitorOk(v.current)) bad();
    if (v.quarantine !== null && v.quarantine !== undefined && !visitorOk(v.quarantine)) bad();
    for (const k of ["infected", "thief"]) if (v[k] !== null && v[k] !== undefined && !str(v[k], 12)) bad();
  }
  if (o.crew !== undefined) {
    if (!Array.isArray(o.crew) || o.crew.length > CREW_CAP + 1 || !unique(o.crew.map((c) => c?.id))) bad();
    for (const c of o.crew)
      if (
        !object(c) ||
        !str(c.id, 12) ||
        !str(c.name, 12) ||
        !PEOPLE_TRAITS[c.trait] ||
        !HELPER_ROLES[c.role] ||
        !(typeof c.look === "string" ? NPCS[c.look] : int(c.look, VISITOR_LOOKS.length - 1)) ||
        !pos(c) ||
        (c.target !== null && c.target !== undefined && !pos(c.target)) ||
        !int(c.fedDay) ||
        !int(c.moved) ||
        !int(c.outDay ?? 0) ||
        !int(c.backDay ?? 0) ||
        !str(c.status, 80) ||
        !CREW_TASKS.includes(c.task)
      )
        bad();
  }
  if (o.cai !== undefined && (!object(o.cai) || Object.values(o.cai).some((n) => !int(n)))) bad();
  if (o.log !== undefined && (!Array.isArray(o.log) || o.log.length > 30 || o.log.some((l) => !object(l) || !int(l.day) || !str(l.text, 200)))) bad();
  if (o.report !== undefined && o.report !== null && !object(o.report)) bad();
  if (o.dayStart !== undefined && o.dayStart !== null && (!object(o.dayStart) || !int(o.dayStart.day))) bad();
  // 彼此一致：选了车货才有车队，交了答复才有袭击日程，打赢才有俘虏。
  if (!!o.cargo !== !!o.convoy) bad();
  if (o.raid && o.raid.phase !== "none" && !o.toll) bad();
  if (o.prisoner && o.raid?.phase !== "won") bad();
  if (o.lathe && !o.youke) bad();
}

export { CREW_CAP, GATE_POST };
