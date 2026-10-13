// v0.15.0「寒潮之后」：联盟前哨第七、八段；法令簿、生活水准、电台节目、暖区、档案馆；
// 霜降、夜莺、苏砚、葛队长、阿兰、阿默。只新增 winter 字段，扣除与奖励都走已有路径。
import {
  Engine as OutpostEngine,
  freshState as outpostFresh,
  migrateState as outpostMigrate,
} from "./outpost.js";
import { ITEMS, WORLD, BUILDINGS, ZOMBIES, CROPS } from "./data.js";
import { HERBS } from "./frontier-data.js";
import { TERMINAL_SPOT, bundleText, missingCost } from "./alliance-data.js";
import { MEAL_ITEMS, VISITOR_CLUES, NPCS } from "./outpost-data.js";
import {
  WINTER_SCHEMA,
  WINTER_ACTS,
  WINTER,
  HEAT,
  PRIORITIES,
  GE_COST,
  ALAN_FEED,
  SUYAN_COST,
  DECREES,
  DECREE_COOLDOWN,
  DECREE_SLOTS,
  LADDER,
  PROGRAMS,
  NOISE_LIMIT,
  SHOWCASES,
  WSPOTS,
  WNPCS,
} from "./winter-data.js";
import { winterGoal, winterSteps } from "./winter-story.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const PHASES = ["none", "prep", "cold", "done"];
const GE_PHASES = ["none", "arrived", "warned", "stayed", "escorted", "left"];
const ALAN_PHASES = ["none", "here", "fed", "declined", "left"];
const YEYING_PHASES = ["none", "hosting", "exposed", "apologized", "left"];
const ASSAULT_PHASES = ["none", "scheduled", "warning", "active", "won"];
export const WINTER_OBJECTS = ["winterAlan", "winterGe", "winterMuseum", "winterAmo", "winterEvidence", "winterHall", "winterSheep"];

const assaultDefaults = () => ({
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
  schema: WINTER_SCHEMA,
  decrees: [],
  decreeDay: 0,
  ladder: 0,
  ladderDay: 0,
  mealLog: [],
  radio: { pickDay: 0, program: null, day: 0, aired: 0, noise: 0, songsDay: 0, forceHonest: false, last: null },
  forecast: false,
  forecastDay: 0,
  meteor: { day: 0, claimed: false },
  winter: { phase: "none", prepDay: 0, coldDay: 0, endDay: 0, priority: null, fuelDay: 0, lit: false, frozen: 0, sick: 0, report: null },
  ge: { phase: "none", day: 0, unhappy: 0, warnDay: 0 },
  alan: { phase: "none", sheep: 0, woolDay: 0, feedDay: 0 },
  amo: { met: false, trades: 0, tradeDay: 0, sample: false },
  yeying: { phase: "none", aired: 0 },
  museum: { built: false, fish: [], herbs: [], logs: [], photos: [], relics: [], claimed: [] },
  caught: [],
  evidence: false,
  assault: assaultDefaults(),
  claimed: [],
  coldNote: 0,
  hordeKey: 0,
});

export function migrateState(s) {
  outpostMigrate(s);
  const d = defaults();
  if (!s.winter) s.winter = d;
  else {
    const w = s.winter;
    s.winter = {
      ...d,
      ...w,
      radio: { ...d.radio, ...w.radio },
      meteor: { ...d.meteor, ...w.meteor },
      winter: { ...d.winter, ...w.winter },
      ge: { ...d.ge, ...w.ge },
      alan: { ...d.alan, ...w.alan },
      amo: { ...d.amo, ...w.amo },
      yeying: { ...d.yeying, ...w.yeying },
      museum: { ...d.museum, ...w.museum },
      assault: { ...d.assault, ...w.assault },
    };
  }
  return s;
}
export const freshState = () => migrateState(outpostFresh());

export class Engine extends OutpostEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    const a = this.s.winter.assault;
    if (a.phase === "active") a.spawned = a.killed + a.retreated;
    this.assignRegion();
  }
  get w() {
    return this.s.winter;
  }
  wonce(id) {
    if (this.w.claimed.includes(id)) return false;
    this.w.claimed.push(id);
    return true;
  }
  storyGoal() {
    const sc = this.sc;
    if (sc && sc.act >= 7) return winterGoal(this);
    return super.storyGoal();
  }

  // ---------- 法令簿 ----------
  decree(id) {
    return !!this.w?.decrees.includes(id);
  }
  decreeSlots() {
    return DECREE_SLOTS(this.sc?.act || 1);
  }
  decreeReason(id) {
    const w = this.w;
    if (!DECREES[id]) return "没有这条法令";
    if (w.decreeDay && this.s.day - w.decreeDay < DECREE_COOLDOWN)
      return "法令刚改过，第" + (w.decreeDay + DECREE_COOLDOWN) + "天才能再改";
    if (!w.decrees.includes(id) && w.decrees.length >= this.decreeSlots())
      return "法令位已满（" + this.decreeSlots() + "条），先废除一条";
    return "";
  }
  toggleDecree(id) {
    const reason = this.decreeReason(id),
      w = this.w;
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const on = !w.decrees.includes(id);
    w.decrees = on ? [...w.decrees, id] : w.decrees.filter((x) => x !== id);
    w.decreeDay = this.s.day;
    const text = (on ? "颁布法令：" : "废除法令：") + DECREES[id].name + (on ? "。" + DECREES[id].good + "；代价：" + DECREES[id].cost + "。" : "。");
    this.toast(text, on ? "gold" : "normal");
    this.olog(text);
    return true;
  }

  // ---------- 生活水准 ----------
  ladderChecks() {
    const w = this.w,
      o = this.o,
      types = new Set(w.mealLog.slice(0, 3).flatMap((m) => m.types));
    const cold = w.winter.phase === "cold";
    const home = { x: 328, y: 315 },
      camp = this.sc?.camp;
    return [
      o.dinnerDay >= this.s.day - 1 && o.dinnerDay > 0 && !o.missed.length && !this.decree("ration"),
      types.size >= (this.decree("kitchen") ? 2 : 3),
      this.residentsCapacity() >= this.c.residents.length &&
        this.rooms().some((r) => r.active) &&
        (!cold || (this.shelterWarm(home) && (!camp || this.shelterWarm(camp)))),
      (w.radio.day > 0 && w.radio.day >= this.s.day - 1) || !!this.festivalRecent?.(),
    ];
  }
  ladderLevel() {
    const checks = this.ladderChecks();
    let n = 0;
    while (n < checks.length && checks[n]) n++;
    return n;
  }
  efficiency() {
    return 1 + 0.05 * (this.w?.ladder || 0) + (this.decree("overtime") ? 0.25 : 0) + (this.geHere() ? 0.1 : 0);
  }
  processProduction(n) {
    return super.processProduction(n * this.efficiency());
  }

  // ---------- 晚饭：配给卡、公共厨房、葛队长、生活水准 ----------
  takeMeal() {
    if (this._ration) {
      this._rationTurn = !this._rationTurn;
      if (!this._rationTurn && this._rationLast) {
        this._rationLast = false;
        return "bread";
      }
    }
    const id = (this._mealTypes && this.takeVariedMeal()) || super.takeMeal();
    if (this._ration) this._rationLast = !!id;
    if (id && this._mealTypes) this._mealTypes.add(id);
    return id;
  }
  // 晚饭轮换：仓库里有别的餐食时，不连着吃同一样。
  takeVariedMeal() {
    const st = this.s.storage,
      tonight = this._mealTypes,
      recent = new Set([...tonight, ...this.w.mealLog.slice(0, 2).flatMap((m) => m.types)]);
    const id = MEAL_ITEMS.find((m) => (st[m] || 0) > 0 && !recent.has(m)) || MEAL_ITEMS.find((m) => (st[m] || 0) > 0 && !tonight.has(m));
    if (!id) return null;
    st[id]--;
    if (!st[id]) delete st[id];
    return id;
  }
  geHere() {
    return ["arrived", "warned", "stayed"].includes(this.w?.ge.phase);
  }
  eaters() {
    const list = super.eaters();
    if (this.geHere()) list.push({ key: "g:ge", name: "葛队长一行（3人）", meals: 6 });
    if (this.decree("patrol"))
      for (const c of this.o.crew) if (c.role === "guard") {
        const x = list.find((e) => e.key === "c:" + c.id);
        if (x) x.meals++;
      }
    return list;
  }
  serveDinner() {
    const o = this.o,
      w = this.w;
    if (o.dinnerDay === this.s.day) return false;
    this._mealTypes = new Set();
    this._ration = this.decree("ration");
    this._rationTurn = false;
    this._rationLast = false;
    let ok = false;
    try {
      ok = super.serveDinner();
      if (this.geHere()) {
        let got = 0;
        for (let i = 0; i < 3; i++) if (this.takeMeal()) got++;
        if (got < 3) {
          o.missed.push("g:ge");
          this.toast("葛队长一行只吃上 " + got + "/3 份晚饭。", "warn");
        }
      }
      if (this.decree("patrol"))
        for (const c of o.crew) if (c.role === "guard") this.takeMeal();
    } finally {
      const types = [...(this._mealTypes || [])];
      this._mealTypes = null;
      this._ration = false;
      w.mealLog.unshift({ day: this.s.day, types });
      w.mealLog = w.mealLog.slice(0, 3);
    }
    if (this.decree("kitchen") && !this.takeFarm({ wood: 1 })) this.toast("公共厨房缺柴：今晚没开火。", "warn");
    if (this.decree("injured") && this.s.region === "farm" && this.s.player.hp < 80) {
      this.s.player.hp = Math.min(100, this.s.player.hp + 8);
    }
    const before = w.ladder;
    w.ladder = this.ladderLevel();
    w.ladderDay = this.s.day;
    if (w.ladder !== before)
      this.olog("生活水准：" + (w.ladder ? LADDER[w.ladder - 1].name : "勉强度日") + "（第 " + w.ladder + " 级）。", w.ladder > before ? "gold" : "warn");
    this.geDinner();
    return ok;
  }

  // ---------- 葛队长一行 ----------
  geArrive() {
    const g = this.w.ge;
    if (g.phase !== "none") return false;
    g.phase = "arrived";
    g.day = this.s.day;
    this.toast("葛队长带着两个人来投奔前哨过冬：" + WNPCS.ge.lines.hello, "gold");
    this.olog("葛队长一行三人来过冬。");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  geDinner() {
    const g = this.w.ge;
    if (!["arrived", "warned"].includes(g.phase)) return;
    const level = this.w.ladder;
    if (level >= 3) {
      if (g.phase === "warned") this.toast("葛队长：……行，这里的日子还过得去。再看看。", "gold");
      g.phase = "arrived";
      g.unhappy = 0;
      return;
    }
    if (g.phase === "warned" && this.s.day >= g.warnDay + 2) {
      g.phase = "left";
      this.toast("葛队长：" + WNPCS.ge.lines.left, "warn");
      this.olog("葛队长带着两个人走了：生活水准没到“住得暖”。", "warn");
      if (this.s.region === "farm") this.assignRegion();
      this.checkStory();
      return;
    }
    g.unhappy++;
    if (g.phase === "arrived" && g.unhappy >= 2) {
      g.phase = "warned";
      g.warnDay = this.s.day;
      const text = "葛队长：" + WNPCS.ge.lines.unhappy + "（第" + (g.warnDay + 2) + "天晚饭前生活水准不到第三级，他们就走）";
      this.toast(text, "warn");
      this.olog(text, "warn");
    }
  }
  decideGe(choice) {
    const g = this.w.ge;
    if (!["arrived", "warned"].includes(g.phase)) return false;
    if (choice === "persuade") {
      if (this.ladderLevel() < 3) {
        this.toast("葛队长摇头：“床够吗？有像样的屋子吗？冷不冷？”——生活水准还没到“住得暖”。", "warn");
        return false;
      }
      g.phase = "stayed";
      this.toast("葛队长：" + WNPCS.ge.lines.stayed, "gold");
      this.olog("说服葛队长一行留下。", "gold");
    } else if (choice === "escort") {
      const lack = missingCost(this, GE_COST);
      if (lack.length || !this.takeFarm(GE_COST)) {
        this.toast("护送还缺：" + lack.join("、") + "。", "warn");
        return false;
      }
      g.phase = "escorted";
      this.addReputation(5);
      this.toast("葛队长：" + WNPCS.ge.lines.escorted + "（营地声望 +5）", "gold");
      this.olog("护送葛队长一行回城。");
    } else return false;
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }

  // ---------- 暖区与寒潮 ----------
  heatSources(forCrops = false) {
    const w = this.w,
      active = ["prep", "cold"].includes(w.winter.phase),
      out = [];
    for (const b of this.s.buildings) {
      if (b.hp <= 0) continue;
      if (b.type === "stove" && (!active || w.winter.lit)) out.push({ x: b.x, y: b.y, r: HEAT.stove, kind: "stove" });
      if (b.type === "cook") out.push({ x: b.x, y: b.y, r: HEAT.cook, kind: "cook" });
      if (b.type === "greenhouse") out.push({ x: b.x, y: b.y, r: HEAT.greenhouse, kind: "greenhouse" });
    }
    if (!forCrops) {
      out.push({ x: 328, y: 315, r: HEAT.home, kind: "home" });
      if (this.sc?.camp) out.push({ x: this.sc.camp.x, y: this.sc.camp.y, r: HEAT.camp, kind: "camp" });
      for (const room of this.rooms()) if (room.active) out.push({ x: room.floor.x, y: room.floor.y, r: HEAT.room, kind: "room" });
    }
    return out;
  }
  warmAt(p, forCrops = false) {
    return this.heatSources(forCrops).some((h) => dist(h, p) <= h.r);
  }
  // 农舍的壁炉和营地火盆够人烤手，却暖不了一整夜：住处要靠火炉、灶台、温室或布置好的房间。
  shelterWarm(p) {
    return this.heatSources().some((h) => !["home", "camp"].includes(h.kind) && dist(h, p) <= h.r);
  }
  hasHeatSource() {
    return (
      this.s.buildings.some((b) => b.hp > 0 && ["stove", "greenhouse"].includes(b.type)) ||
      this.rooms().some((r) => r.active)
    );
  }
  coldActive() {
    return this.w?.winter.phase === "cold";
  }
  winterCheck() {
    const w = this.w,
      wi = w.winter;
    if (wi.phase === "none" && w.forecast && (this.sc?.act || 1) >= 7 && this.hasHeatSource()) {
      wi.phase = "prep";
      wi.prepDay = this.s.day;
      wi.coldDay = this.s.day + WINTER.prepDays;
      wi.endDay = wi.coldDay + WINTER.coldDays;
      const text = "霜降：寒潮第" + wi.coldDay + "天清晨到，持续三天。火炉从明早开始烧柴，口粮和木材都要囤够。";
      this.toast(text, "warn");
      this.olog(text, "warn");
      this.geArrive();
      this.alanArrive();
      this.emit("quest");
      this.checkStory();
    }
  }
  winterMorning() {
    const w = this.w,
      wi = w.winter;
    if (!["prep", "cold"].includes(wi.phase)) return;
    if (wi.phase === "prep" && this.s.day >= wi.coldDay) {
      wi.phase = "cold";
      this.toast("寒潮来了！暖区外的人饿得更快、作物几乎不长、队员冻得干活慢。", "warn");
      this.olog("寒潮第一天。", "warn");
      this.emit("alarm");
    }
    if (wi.phase === "cold" && this.s.day >= wi.endDay) return this.winterEnd();
    if (wi.fuelDay !== this.s.day) {
      wi.fuelDay = this.s.day;
      const stoves = this.s.buildings.filter((b) => b.type === "stove" && b.hp > 0).length;
      const per = Math.max(
        1,
        WINTER.stoveFuel - (this.decree("winterStore") ? 1 : 0) - (wi.priority === "engineering" ? 1 : 0),
      );
      if (!stoves) wi.lit = false;
      else if (this.takeFarm({ wood: stoves * per })) {
        wi.lit = true;
        this.olog("火炉烧掉 " + stoves * per + " 份木材。");
      } else {
        wi.lit = false;
        this.toast("木材不够，火炉今天没点着！暖区只剩灶台和房间。", "warn");
        this.olog("火炉缺柴熄火。", "warn");
      }
    }
    if (wi.phase === "cold" && wi.priority === "food" && this.o.missed.length && this.o.dinnerDay === this.s.day - 1) {
      this.putStorage({ bread: 2 });
      this.toast("粮食保障：昨晚有人没吃上，邻居一早送来干粮×2（已入仓）。", "gold");
      this.olog("粮食保障：邻居送来干粮×2。");
    }
    if (wi.phase === "cold") {
      const camp = this.sc?.camp;
      const people = (this.sc?.helpers.length || 0) + this.o.crew.length + this.c.residents.length;
      if (people && wi.priority !== "medicine" && ((camp && !this.shelterWarm(camp)) || !this.shelterWarm({ x: 328, y: 315 }))) {
        this.o.sick = Math.max(this.o.sick, this.s.day);
        wi.sick++;
        this.toast("夜里太冷，营地有人冻病了：援建队今天干活慢一半，1 个药包或 2 条绷带能治好。", "warn");
        this.olog("寒潮：营地有人冻病。", "warn");
      }
    }
  }
  winterEnd() {
    const w = this.w,
      wi = w.winter;
    if (wi.phase !== "cold") return false;
    wi.phase = "done";
    wi.lit = false;
    wi.report = { day: this.s.day, frozen: wi.frozen, sick: wi.sick, ge: w.ge.phase, priority: wi.priority };
    this.toast("寒潮过去了。霜降：" + WNPCS.shuangjiang.lines.saved, "gold");
    this.olog("熬过寒潮：冻病 " + wi.sick + " 次。", "gold");
    if (w.alan.phase === "fed") {
      w.alan.phase = "left";
      w.alan.sheep = 2;
      w.alan.woolDay = this.s.day;
      this.toast("阿兰：" + WNPCS.alan.lines.left, "gold");
      this.olog("阿兰留下两只羊。");
    } else if (w.alan.phase === "here") w.alan.phase = "declined";
    if (this.s.region === "farm") this.assignRegion();
    this.checkStory();
    this.emit("quest");
    return true;
  }
  choosePriority(id) {
    const wi = this.w.winter;
    if (!PRIORITIES[id] || wi.priority || !this.w.forecast) return false;
    wi.priority = id;
    this.toast("寒潮优先：" + PRIORITIES[id].pick + "。" + PRIORITIES[id].desc, "gold");
    this.olog("寒潮优先：" + PRIORITIES[id].pick + "。");
    return true;
  }
  cropGrowthRate(p) {
    const base = super.cropGrowthRate(p);
    if (!this.coldActive() || this.warmAt(p, true)) return base;
    return base * (this.w.winter.priority === "food" ? WINTER.cropColdFood : WINTER.cropCold);
  }
  latheSlots() {
    return Math.max(0, super.latheSlots() - (this.coldActive() && this.w.winter.priority !== "engineering" ? 1 : 0));
  }
  playerCold() {
    return (
      this.coldActive() &&
      !this.qty("warmCoat") &&
      !["market"].includes(this.s.region) &&
      !(this.s.region === "farm" && this.warmAt(this.s.player))
    );
  }

  // ---------- 霜降：预报与流星夜 ----------
  contactFrost() {
    const w = this.w;
    if (w.forecast) return false;
    if ((this.sc?.act || 1) < 7 || !this.r.radio) {
      this.toast("先把电台修好，才能联系白霜站。", "warn");
      return false;
    }
    if (this.s.region !== "farm" || dist(this.s.player, TERMINAL_SPOT) > 130) {
      this.toast("到联盟终端再呼叫白霜站。", "warn");
      return false;
    }
    w.forecast = true;
    w.forecastDay = this.s.day;
    if (this.wonce("rye")) this.putStorage({ seedRye: 6 });
    this.toast("霜降：" + WNPCS.shuangjiang.lines.forecast, "gold");
    this.olog("联系上白霜站：拿到三天预报，黑麦种子×6 入仓。", "gold");
    this.storyLog("白霜站的霜降发来寒潮预报。");
    this.winterCheck();
    this.emit("quest");
    return true;
  }
  meteorTonight() {
    const m = this.w.meteor;
    return !m.claimed && m.day === this.s.day && this.s.minute >= 1260;
  }
  claimMeteor() {
    const m = this.w.meteor;
    if (!this.meteorTonight()) return false;
    m.claimed = true;
    this.wonce("meteor");
    this.putStorage({ warmSoup: 2 });
    this.toast("一道流星划过白霜站的方向。霜降念给你一张配方：暖身汤（黑麦 2、土豆 1，在篝火灶做）。先送你两碗。", "gold");
    this.olog("流星夜：学会暖身汤。", "gold");
    return true;
  }
  recipeReason(r) {
    if (r.id === "warmSoup" && !this.w?.meteor.claimed) return "需要霜降在流星夜念给你的配方";
    if (r.id === "remedy" && !this.w?.amo.met) return "需要阿默卖的月影草配方";
    return super.recipeReason(r);
  }

  // ---------- 阿兰与羊 ----------
  alanArrive() {
    const a = this.w.alan;
    if (a.phase !== "none") return false;
    a.phase = "here";
    this.toast("一个叫阿兰的牧羊人赶着羊在农场东北边停下，想讨点饲料过冬。", "gold");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  feedAlan(choice) {
    const a = this.w.alan;
    if (a.phase !== "here") return false;
    if (choice === "decline") {
      a.phase = "declined";
      this.toast("阿兰：" + WNPCS.alan.lines.declined);
      if (this.s.region === "farm") this.assignRegion();
      return true;
    }
    const lack = missingCost(this, ALAN_FEED);
    if (lack.length || !this.takeFarm(ALAN_FEED)) {
      this.toast("饲料还缺：" + lack.join("、") + "。", "warn");
      return false;
    }
    a.phase = "fed";
    this.toast("阿兰：" + WNPCS.alan.lines.fed, "gold");
    this.olog("给阿兰的羊分了饲料。");
    return true;
  }
  sheepMorning() {
    const a = this.w.alan;
    if (!a.sheep) return;
    if (a.feedDay !== this.s.day && this.takeFarm({ bean: 1 })) a.feedDay = this.s.day;
    if (a.feedDay === this.s.day && this.s.day - a.woolDay >= 2) {
      a.woolDay = this.s.day;
      this.putStorage({ wool: a.sheep });
      this.olog("剪了羊毛：羊毛×" + a.sheep + " 入仓。");
    }
  }

  // ---------- 阿默 ----------
  amoOpen() {
    return this.isNight();
  }
  buyMoonHerb() {
    const a = this.w.amo;
    if (this.s.region !== WSPOTS.amo.region || dist(this.s.player, WSPOTS.amo) > 130) return false;
    if (!this.amoOpen()) {
      this.toast(WNPCS.amo.lines.day);
      return false;
    }
    if (a.tradeDay === this.s.day) {
      this.toast("阿默：今晚的月影草卖完了。");
      return false;
    }
    if (this.s.money < 25) {
      this.toast("月影草 25 金币一株。", "warn");
      return false;
    }
    if (!this.canAdd({ moonHerb: 1 })) {
      this.toast("背包满了。", "warn");
      return false;
    }
    this.s.money -= 25;
    this.add({ moonHerb: 1 }, true);
    a.tradeDay = this.s.day;
    a.trades++;
    a.met = true;
    this.toast("阿默把一株月影草包好递给你（−25 金币）。配方：月影草 1、药草 2 → 特效药。");
    return true;
  }
  amoSample() {
    const a = this.w.amo;
    if (a.sample) return false;
    if ((this.sc?.act || 1) < 8) {
      this.toast("阿默：" + WNPCS.amo.lines.hello);
      a.met = true;
      return false;
    }
    if (this.s.region !== WSPOTS.amo.region || dist(this.s.player, WSPOTS.amo) > 130) {
      this.toast("阿默在地底避难城的回声走廊旁。", "warn");
      return false;
    }
    if (!this.amoOpen()) {
      this.toast(WNPCS.amo.lines.day, "warn");
      return false;
    }
    if (!this.canAdd({ amoSample: 1 })) this.putStorage({ amoSample: 1 });
    else this.add({ amoSample: 1 });
    a.sample = true;
    a.met = true;
    this.wonce("amo");
    this.toast("阿默：" + WNPCS.amo.lines.sample, "gold");
    this.olog("取得阿默的血样。", "gold");
    return true;
  }

  // ---------- 夜莺与电台节目 ----------
  radioHost() {
    const y = this.w.yeying.phase;
    return y === "hosting" || y === "exposed" ? 1.5 : y === "apologized" ? 2 : 1;
  }
  hireYeying() {
    const y = this.w.yeying;
    if (y.phase !== "none" || !this.r.claimed.includes("broadcast")) return false;
    if (this.s.region !== "farm" || dist(this.s.player, TERMINAL_SPOT) > 130) {
      this.toast("到联盟终端和夜莺谈。", "warn");
      return false;
    }
    y.phase = "hosting";
    this.toast("夜莺：" + WNPCS.yeying.lines.hello, "gold");
    this.olog("夜莺成为电台主持。", "gold");
    return true;
  }
  decideYeying(choice) {
    const y = this.w.yeying;
    if (y.phase !== "exposed") return false;
    if (choice === "apologize") {
      y.phase = "apologized";
      this.toast("夜莺：" + WNPCS.yeying.lines.apology, "gold");
      this.olog("夜莺在电台公开道歉，听众更多了。");
    } else if (choice === "dismiss") {
      y.phase = "left";
      this.toast("夜莺：" + WNPCS.yeying.lines.left);
      this.olog("夜莺离开了电台。");
    } else return false;
    return true;
  }
  programReason(id) {
    const r = this.w.radio;
    if (!PROGRAMS[id]) return "没有这档节目";
    if (!this.r.radio) return "电台还没修好";
    if (r.pickDay === this.s.day && r.program) return "今晚已经排了《" + PROGRAMS[r.program].name + "》";
    if (r.day === this.s.day) return "今晚的节目已经播完了";
    if (this.s.minute >= 1260) return "今晚的节目时间（21:00）已过";
    return "";
  }
  chooseProgram(id) {
    const reason = this.programReason(id);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const r = this.w.radio;
    r.program = id;
    r.pickDay = this.s.day;
    this.toast("今晚 21:00 播《" + PROGRAMS[id].name + "》：" + PROGRAMS[id].desc);
    return true;
  }
  airProgram() {
    const w = this.w,
      r = w.radio;
    if (!r.program || r.pickDay !== this.s.day || r.day === this.s.day) return false;
    const id = r.program,
      mult = this.radioHost() * (this.decree("silence") ? 0.5 : 1);
    r.day = this.s.day;
    r.aired++;
    r.last = id;
    r.program = null;
    if (id === "news") {
      const c = this.o.caravan;
      if (c.next > this.s.day + 1) c.next = Math.max(this.s.day + 1, c.next - Math.max(1, Math.round(mult)));
      const tomorrow = this.forecast?.()[1]?.weather;
      this.toast("今晚的新闻播完了。" + (tomorrow ? "明天：" + tomorrow + "。" : "") + (c.next ? "唐九第" + c.next + "天到。" : ""));
    } else if (id === "songs") {
      for (const res of this.c.residents) res.morale = clamp((res.morale ?? 60) + Math.round(5 * mult), 0, 100);
      r.songsDay = this.s.day + 1;
      this.toast("点歌节目里有人唱起老歌，营地里跟着哼。居民士气上升。");
    } else if (id === "lesson") {
      this.xp("agriculture", Math.round(6 * mult));
      this.xp("combat", Math.round(6 * mult));
      this.toast("生存课讲完了：怎么守夜、怎么省水。");
    } else if (id === "missing") {
      this.o.visitors.next = this.s.day + 1;
      r.forceHonest = true;
      this.toast("寻人启事播出去了。明天会有人循着广播来营门。");
    }
    r.noise += PROGRAMS[id].noise * (this.decree("silence") ? 0.5 : 1);
    if (this.w.yeying.phase === "hosting") {
      this.w.yeying.aired++;
      if (this.w.yeying.aired >= 2) {
        this.w.yeying.phase = "exposed";
        this.toast("听众来信：夜莺给灰隼团念过宣传稿！要不要让她留下？（任务手记 · 电台节目单）", "warn");
        this.olog("夜莺的往事被人认了出来。", "warn");
      }
    }
    if (r.noise >= NOISE_LIMIT) {
      r.noise -= NOISE_LIMIT;
      this.radioHorde();
    }
    this.olog("电台播出《" + PROGRAMS[id].name + "》。");
    return true;
  }
  radioHorde() {
    const text = "广播声太大，一群感染者循着信号摸到了农场东边！";
    this.olog(text, "warn");
    if (this.s.region === "farm" && !["warning", "active"].includes(this.s.horde.phase)) {
      for (let i = 0; i < 5; i++) {
        const z = this.enemy(i % 2 ? "runner" : "slow", 1420, 380 + i * 40);
        z.state = "chase";
        z.alert = 8;
        this.enemies.push(z);
      }
      this.toast(text, "warn");
      this.emit("alarm");
    } else {
      const fence = this.s.buildings.find((b) => ["fence", "gate"].includes(b.type) && b.hp > 0);
      if (fence) {
        fence.hp = Math.max(1, Math.floor(fence.hp * 0.7));
        this.navRevision++;
      }
      this.toast("夜里一群感染者循着广播撞坏了围栏。", "warn");
    }
  }
  slowed(key) {
    if (this.w?.radio.songsDay === this.s.day && key.startsWith("c:") && this.o.sick < this.s.day) return false;
    if ((this.w?.ladder || 0) >= 2 && this.o.sick < this.s.day) return false;
    return super.slowed(key);
  }

  // ---------- 档案馆 ----------
  museumHere() {
    const sp = this.s.region === "farm" ? WSPOTS.museum : this.s.region === WSPOTS.archiveHall.region ? WSPOTS.archiveHall : null;
    return !!sp && dist(this.s.player, sp) <= 130 && (this.s.region !== "farm" || this.w.museum.built);
  }
  buildMuseum() {
    const w = this.w;
    if (w.museum.built || (this.sc?.act || 1) < 8) return false;
    if (!this.bflag("shipyard_ferry", "service")) {
      this.toast("档案员苏砚要等去档案岛的固定航线开通才能过来。", "warn");
      return false;
    }
    if (this.s.region !== "farm" || dist(this.s.player, WSPOTS.museum) > 130) {
      this.toast("走到农场东北角的空地再建分馆。", "warn");
      return false;
    }
    const lack = missingCost(this, SUYAN_COST);
    if (lack.length || !this.takeFarm(SUYAN_COST)) {
      this.toast("建分馆还缺：" + lack.join("、") + "。", "warn");
      return false;
    }
    w.museum.built = true;
    this.wonce("museum");
    this.toast("苏砚：" + WNPCS.suyan.lines.built, "gold");
    this.olog("档案馆分馆开馆。", "gold");
    this.storyLog("苏砚的档案馆分馆在农场开馆。");
    this.assignRegion();
    return true;
  }
  donatable(cat) {
    const m = this.w.museum,
      f = this.f;
    if (!m[cat] || m[cat].length >= this.showcaseNeed(cat)) return [];
    if (cat === "fish") return SHOWCASES.fish.items.filter((id) => !m.fish.includes(id) && this.quantityForCost(id, true) > 0);
    if (cat === "herbs") return f.identified.map((i) => HERBS[i]?.id).filter((id) => id && !m.herbs.includes(id));
    if (cat === "logs") return f.clues.filter((id) => !m.logs.includes(id));
    if (cat === "photos") return f.photos.filter((p) => p.subjects?.length && !m.photos.includes(p.id)).map((p) => p.id);
    if (cat === "relics") return SHOWCASES.relics.items.filter((id) => !m.relics.includes(id) && this.r.finds.includes(id));
    return [];
  }
  showcaseNeed(cat) {
    return { fish: 3, herbs: 4, logs: 3, photos: 3, relics: 4 }[cat];
  }
  donate(cat, id) {
    const m = this.w.museum;
    if (!SHOWCASES[cat] || !this.museumHere()) {
      this.toast("到档案馆（农场分馆或档案岛展厅）再捐赠。", "warn");
      return false;
    }
    if (!this.donatable(cat).some((x) => String(x) === String(id))) return false;
    if (cat === "fish" && !this.takeFarm({ [id]: 1 })) return false;
    if (cat === "herbs" && !this.takeFarm({ herb: 1 })) {
      this.toast("做标本要 1 份药草。", "warn");
      return false;
    }
    const key = cat === "photos" ? Number(id) : id;
    m[cat].push(key);
    this.toast("捐给档案馆：" + this.exhibitName(cat, key) + "。");
    if (m[cat].length >= this.showcaseNeed(cat) && !m.claimed.includes(cat)) this.completeShowcase(cat);
    return true;
  }
  exhibitName(cat, id) {
    if (cat === "fish" || cat === "relics") return ITEMS[id]?.name || id;
    if (cat === "herbs") return (HERBS.find((h) => h.id === id)?.name || id) + "标本";
    if (cat === "logs") return { residential: "住宅区日志", hospital: "医院日志", warehouse: "仓库日志" }[id] || id;
    return "照片";
  }
  completeShowcase(cat) {
    const m = this.w.museum;
    m.claimed.push(cat);
    if (cat === "logs") this.grantResearch?.(1);
    if (cat === "photos") for (const r of this.c.residents) r.morale = clamp((r.morale ?? 60) + 10, 0, 100);
    if (cat === "relics") this.addReputation(10);
    const text = "展柜「" + SHOWCASES[cat].name + "」填满了！" + SHOWCASES[cat].reward + "。";
    this.toast(text, "gold");
    this.olog(text, "gold");
  }
  showcaseDone(cat) {
    return !!this.w?.museum.claimed.includes(cat);
  }
  hookFish() {
    const before = { ...this.s.inventory };
    const ok = super.hookFish();
    if (ok) for (const id of ["fish", "riverFish", "nightFish", "mutantFish"]) if ((this.s.inventory[id] || 0) > (before[id] || 0) && !this.w.caught.includes(id)) this.w.caught.push(id);
    return ok;
  }
  startFishing(bait = false) {
    const ok = super.startFishing(bait);
    if (ok && this.showcaseDone("fish") && this.c.fishing) this.c.fishing.biteAt = Math.max(0.8, this.c.fishing.biteAt - 0.6);
    return ok;
  }
  // 药品额外回的生命（草药展柜、寒潮优先药品、许医生的证据）；v0.22 的慢慢回血也从这里取
  medBonus(id) {
    if (ITEMS[id]?.type !== "medicine") return 0;
    let bonus = 0;
    if (this.showcaseDone("herbs")) bonus += 10;
    if (this.coldActive() && this.w.winter.priority === "medicine") bonus += 10;
    if (this.w.evidence && id === "medkit") bonus += 20;
    return bonus;
  }
  consume(id) {
    const it = ITEMS[id],
      ok = super.consume(id);
    if (ok && it?.type === "medicine") {
      const bonus = this.medBonus(id);
      if (bonus) this.s.player.hp = Math.min(100, this.s.player.hp + bonus);
      if (id === "remedy" && this.s.region === "farm" && this.o.sick >= this.s.day) {
        this.o.sick = 0;
        this.toast("特效药分给了病号，营地的人都好了。", "gold");
      }
    }
    return ok;
  }
  curePlague() {
    if (!this.w?.evidence || this.o.sick < this.s.day || this.s.region !== "farm") return super.curePlague();
    if (!this.takeFarm({ bandage: 1 })) return super.curePlague();
    this.o.sick = 0;
    this.toast("许医生的新疗法：1 条绷带就让病号退烧了。", "gold");
    return true;
  }

  // ---------- 证据链与地区广播 ----------
  deliverEvidence() {
    const w = this.w;
    if (w.evidence || (this.sc?.act || 1) < 8) return false;
    if (this.s.region !== WSPOTS.evidence.region || dist(this.s.player, WSPOTS.evidence) > 130) {
      this.toast("证据拼合台在检疫科研园。", "warn");
      return false;
    }
    if (this.f.clues.length < 3) {
      this.toast("还缺三地日志（" + this.f.clues.length + "/3）。", "warn");
      return false;
    }
    const pool = (this.s.inventory.amoSample || 0) > 0 ? this.s.inventory : (this.s.storage.amoSample || 0) > 0 ? this.s.storage : null;
    if (!pool) {
      this.toast("还缺阿默的血样。", "warn");
      return false;
    }
    pool.amoSample--;
    if (!pool.amoSample) delete pool.amoSample;
    w.evidence = true;
    this.wonce("evidence");
    this.toast("证据链拼上了：污染来自旧供水设备，康复者的血清能救人。许医生的研究突破了！", "gold");
    this.olog("证据链完成：药包多回 20 生命，病号 1 条绷带就能治好。", "gold");
    this.storyLog("检疫科研园的证据链补齐。");
    return true;
  }
  finaleReady() {
    return winterSteps(this).filter((s) => s.id !== "finale").every((s) => s.done);
  }
  startFinale() {
    const a = this.w.assault;
    if ((this.sc?.act || 1) !== 8 || a.phase !== "none") return false;
    if (!this.finaleReady()) {
      this.toast("还有准备没做完，先看看任务手记里的进度。", "warn");
      return false;
    }
    if (this.s.region !== "farm" || dist(this.s.player, TERMINAL_SPOT) > 130) {
      this.toast("到联盟终端开始广播。", "warn");
      return false;
    }
    Object.assign(a, assaultDefaults(), { tries: a.tries, phase: "scheduled", day: this.s.day });
    a.phase = "warning";
    a.timer = 60 + (this.o.gadgets.includes("alarm") ? 45 : 0) + (this.decree("curfew") ? 30 : 0);
    this.toast("广播开始了：“这里是余烬前哨……” 东边林子里亮起一片车灯——灰隼团残部来了！" + Math.ceil(a.timer) + " 秒后进攻。", "warn");
    this.olog("地区广播开始，灰隼团残部来袭。", "warn");
    this.emit("alarm");
    return true;
  }
  lastRaidRecord() {
    if (this.lastRaid) return this.lastRaid;
    const a = this.w?.assault,
      o = this.o.raid;
    return a?.report && (!o.report || a.report.day >= o.report.day) ? a : o;
  }
  raidState() {
    const a = this.s.winter?.assault;
    return a && ["scheduled", "warning", "active"].includes(a.phase) ? a : super.raidState();
  }
  raidSize() {
    if (!this.firstRaid()) return 12 + Math.min(1, this.raidState().tries);
    return super.raidSize();
  }
  raidPower() {
    return super.raidPower() + (this.decree("patrol") ? 2 : 0);
  }
  startRaidWarning() {
    super.startRaidWarning();
    if (this.decree("curfew")) this.raidState().timer += 30;
  }
  guardCooldown() {
    return this.decree("patrol") ? 1.1 : super.guardCooldown();
  }
  raidOutcome(r, won, report) {
    if (r !== this.w.assault) return super.raidOutcome(r, won, report);
    if (won) {
      r.phase = "won";
      this.s.money += 150;
      report.gain = { ammo: 24, parts: 4 };
      report.money = 150;
      report.wonText = "广播传遍了整个地区：“余烬前哨，一切安好。”";
      this.putStorage(report.gain);
      this.wonce("finale");
      const text = "灰隼团残部溃散了。广播传遍了整个地区：“余烬前哨，一切安好。”缴获" + bundleText(report.gain) + "与 150 金币。";
      this.toast(text, "gold");
      this.olog(text, "gold");
      this.storyLog("地区广播成功，守住了最后一次有组织袭击。");
      this.emit("victory");
    } else {
      report.lost = this.raidLoot();
      r.tries++;
      r.phase = "scheduled";
      r.day = this.s.day + 1;
      const text = "广播被打断了：残部抢走了" + (Object.keys(report.lost).length ? bundleText(report.lost) : "一些零碎") + "。他们第" + r.day + "天 19:00 还会再来。";
      this.toast(text, "warn");
      this.olog(text, "warn");
    }
  }

  // ---------- 第七、八段 ----------
  chooseStory(step, choice) {
    let ok = false;
    if (step === "priority") ok = this.choosePriority(choice);
    else if (step === "ge") ok = this.decideGe(choice);
    else return super.chooseStory(step, choice);
    if (ok) {
      this.checkStory();
      this.emit("quest");
    }
    return ok;
  }
  doStory(step) {
    let ok;
    if (step === "forecast") ok = this.contactFrost();
    else if (step === "yeying") ok = this.hireYeying();
    else if (step === "amo") ok = this.amoSample();
    else if (step === "suyan") ok = this.buildMuseum();
    else if (step === "evidence") ok = this.deliverEvidence();
    else if (step === "finale") ok = this.startFinale();
    else return super.doStory(step);
    if (ok) this.checkStory();
    return ok;
  }
  finishWinterAct(n) {
    const sc = this.sc,
      act = WINTER_ACTS[n];
    if (!act || sc.claimed.includes("act" + n)) return false;
    sc.claimed.push("act" + n);
    sc.act = n + 1;
    this.s.money += act.reward.money;
    this.addReputation(act.reward.reputation);
    const letter = "act" + (n + 1);
    if (!sc.letters.includes(letter)) sc.letters.push(letter);
    sc.unread = true;
    this.storyLog(act.label + "「" + act.name + "」完成。");
    this.toast(act.label + "「" + act.name + "」完成：" + act.reward.money + " 金币、营地声望 +" + act.reward.reputation + "。", "gold");
    this.toast("小柒：终端收到新来信，打开任务手记（J）查看。", "gold");
    this.olog(act.label + "「" + act.name + "」完成。", "gold");
    this.emit("quest");
    return true;
  }
  checkStory() {
    super.checkStory();
    const sc = this.sc;
    if (!sc || !this.w || this._winterBusy) return;
    this._winterBusy = true;
    try {
      for (let guard = 0; guard < 3 && sc.act >= 7 && sc.act <= 8; guard++) {
        const steps = winterSteps(this);
        if (!steps.length || steps.some((s) => !s.done)) break;
        this.finishWinterAct(sc.act);
      }
    } finally {
      this._winterBusy = false;
    }
  }

  // ---------- 法令与人物的时间钩子 ----------
  arriveVisitor() {
    const vs = this.o.visitors,
      w = this.w;
    if (this.decree("openGate") && !vs.current && vs.next > this.s.day) vs.next = this.s.day;
    const ok = super.arriveVisitor();
    const v = vs.current;
    if (ok && v && v.huer === null) {
      let kind = v.kind;
      if (w.radio.forceHonest || (w.ladder >= 4 && kind !== "honest" && this.roll() < 0.5)) kind = "honest";
      else if (this.decree("openGate") && kind === "honest" && this.roll() < 0.2) kind = "thief";
      if (kind !== v.kind) {
        v.kind = kind;
        const pickClue = (cat) => {
          const list = VISITOR_CLUES[kind][cat];
          return list[Math.floor(this.roll() * list.length) % list.length];
        };
        v.clues = { papers: pickClue("papers"), body: pickClue("body"), bag: pickClue("bag") };
      }
      w.radio.forceHonest = false;
    }
    return ok;
  }
  neighborAid() {
    if (!this.decree("neighbors")) return super.neighborAid();
    if ((this.s.inventory.bread || 0) < 2) {
      this.toast("邻里换工：要带 2 份干粮。", "warn");
      return false;
    }
    const ok = super.neighborAid();
    if (ok) {
      this.s.inventory.bread--;
      if (!this.s.inventory.bread) delete this.s.inventory.bread;
      this.putStorage({ wood: 3, seedRadish: 2 });
      this.toast("邻里换工：多换来一份回礼（已入仓）。", "gold");
    }
    return ok;
  }
  crewHour(c) {
    const hour = Math.floor(this.s.minute / 60),
      [start, end] = this.crewHours(c),
      rest = (status, task = "rest") => Object.assign(c, { status, task, target: this.crewHome(c) });
    if (hour >= start && hour < end && !this.mealHour()) {
      if (this.decree("curfew") && hour >= 19) return rest("宵禁，回帐篷");
      if (this.decree("rotation") && hour % 4 === 0) return rest("轮休");
      if (this.decree("salvage") && c.role === "carry" && hour >= 6 && hour < 10) return rest("跟拾荒队出去了", "idle");
      if (this.coldActive() && hour % 2 && !this.warmAt(c)) return rest("冻得手脚发僵，干活慢一半", "hungry");
    }
    return super.crewHour(c);
  }
  workHour() {
    const fatigue = new Map(this.c.residents.map((r) => [r.id, r.fatigue || 0]));
    super.workHour();
    const w = this.s.winter;
    if (!w) return;
    const mult = (this.decree("rotation") ? 0.6 : 1) * (this.decree("overtime") ? (this.overtimeFatigue?.() ?? 1.5) : 1);
    if (mult !== 1)
      for (const r of this.c.residents) {
        if (!fatigue.has(r.id)) continue;
        const was = fatigue.get(r.id),
          d = (r.fatigue || 0) - was;
        if (d > 0) r.fatigue = clamp(was + d * mult, 0, 100);
      }
    const hour = Math.floor(this.s.minute / 60);
    if (hour === 6) {
      this.winterMorning();
      this.sheepMorning();
      if (this.decree("salvage") && (this.sc?.helpers.length || this.o.crew.some((c) => c.role === "carry"))) this.putStorage({ scrap: 2, wood: 1 });
    }
    if (hour === 7 && this.geHere()) {
      let got = 0;
      for (let i = 0; i < 3; i++) if (this.takeMeal()) got++;
      if (got === 3) this.putStorage({ wood: 2 });
      else w.ge.unhappy++;
    }
    if (hour === 21) {
      this.airProgram();
      if (w.forecast && !w.meteor.claimed && w.meteor.day !== this.s.day && this.s.day > w.forecastDay && this.s.weather === "晴朗") {
        w.meteor.day = this.s.day;
        this.toast("霜降：" + WNPCS.shuangjiang.lines.meteor + "（今晚到联盟终端按 E）", "gold");
        this.olog("霜降说今晚有流星雨。");
      }
    }
    this.winterCheck();
  }
  onNewDay() {
    super.onNewDay();
    const w = this.s.winter;
    if (!w) return;
    w.radio.noise = Math.max(0, w.radio.noise - 1);
    const morale =
      (this.decree("curfew") ? -1 : 0) +
      (this.decree("ration") ? -4 : 0) +
      (this.decree("overtime") ? -3 : 0) +
      (this.decree("winterStore") && this.coldActive() ? -2 : 0) +
      ((w.ladder || 0) >= 3 ? 2 : 0) +
      (this.showcaseDone("photos") ? 1 : 0);
    const injured = this.decree("injured") ? -1 : 0;
    if (this.dailyMood?.() !== false) for (const r of this.c.residents) r.morale = clamp((r.morale ?? 60) + morale + (r.id === "medic" ? 0 : injured), 0, 100);
    if (w.meteor.day && w.meteor.day < this.s.day && !w.meteor.claimed) w.meteor.day = 0;
  }
  update(dt, input = {}) {
    const running = !this.paused,
      before = this.s.player.hunger;
    super.update(dt, input);
    if (!running || this.paused || !this.s.winter) return;
    const w = this.w,
      p = this.s.player;
    if (this.playerCold()) {
      const drop = before - p.hunger;
      if (drop > 0 && drop < 5) p.hunger = Math.max(0, p.hunger - drop * (WINTER.coldHunger - 1));
      if (w.coldNote !== this.s.day) {
        w.coldNote = this.s.day;
        this.toast("冷得发抖：暖区外饿得更快。待在火炉边，或做件保温衣（工作台）。", "warn");
      }
    }
    const h = this.s.horde;
    if (h.phase === "warning" && this.decree("curfew")) {
      const key = this.s.day * 100 + (this.s.stats.hordes % 100);
      if (w.hordeKey !== key) {
        w.hordeKey = key;
        h.timer += 30;
      }
    }
  }

  // ---------- 场景对象 ----------
  assignRegion() {
    super.assignRegion();
    const w = this.s.winter,
      sc = this.s.storyCampaign;
    if (!w || !sc) return;
    const push = (type, name, spot, extra = {}) => this.objects.push({ type, name, x: spot.x, y: spot.y, icon: 40, ...extra });
    if (this.s.region === "farm") {
      if (w.alan.phase === "here" || w.alan.phase === "fed") push("winterAlan", "阿兰 · 牧羊人", WSPOTS.alan);
      if (w.alan.sheep) push("winterSheep", "羊圈 · " + w.alan.sheep + "只羊", { x: WSPOTS.alan.x + 50, y: WSPOTS.alan.y + 40 });
      if (["arrived", "warned", "stayed"].includes(w.ge.phase)) push("winterGe", "葛队长一行", WSPOTS.ge);
      if (sc.act >= 8 || w.museum.built) if (w.museum.built || this.bflag("shipyard_ferry", "service")) push("winterMuseum", w.museum.built ? "档案馆分馆 · 苏砚" : "档案馆分馆空地", WSPOTS.museum);
    }
    if (this.s.region === WSPOTS.amo.region && sc.act >= 7) push("winterAmo", "阿默 · 灰皮人", WSPOTS.amo);
    if (this.s.region === WSPOTS.evidence.region && sc.act >= 8 && !w.evidence) push("winterEvidence", "证据拼合台", WSPOTS.evidence);
    if (this.s.region === WSPOTS.archiveHall.region) push("winterHall", "档案岛生活史展厅", WSPOTS.archiveHall);
  }
  context(ob) {
    const w = this.w;
    if (ob && w) {
      if (ob.type === "sign" && this.meteorTonight()) return "联盟终端 · 看流星（霜降的配方）";
      if (ob.type === "sign" && this.sc?.act === 7 && !w.forecast && this.r.radio) return "联盟终端 · 呼叫白霜站";
      if (ob.type === "winterAlan") return w.alan.phase === "here" ? "和阿兰说话 · 分点饲料？" : "阿兰的羊在吃草";
      if (ob.type === "winterSheep") return "羊圈 · 每天吃 1 份豆子，隔两天剪毛";
      if (ob.type === "winterGe") return "葛队长 · " + (w.ge.phase === "warned" ? "两天后要走" : w.ge.phase === "stayed" ? "留下过冬" : "嫌伙食和住处");
      if (ob.type === "winterMuseum") return w.museum.built ? "档案馆 · 捐赠展品" : "建档案馆分馆 · " + bundleText(SUYAN_COST);
      if (ob.type === "winterAmo") return this.amoOpen() ? "阿默 · 月影草 25 金币" : "阿默的舱门关着（只在夜里开）";
      if (ob.type === "winterEvidence") return "证据拼合台 · 交阿默的血样与三地日志";
      if (ob.type === "winterHall") return "档案岛展厅 · 捐赠展品";
    }
    return super.context(ob);
  }
  interact() {
    if (this.paused) return;
    const ob = this.nearestObject(),
      menu = (view, id = "") => this.emit("menu", { menu: "outpost", view, id });
    if (ob?.type === "sign" && this.meteorTonight()) return this.claimMeteor();
    if (ob?.type === "sign" && this.sc?.act === 7 && !this.w.forecast && this.r.radio) {
      if (this.contactFrost()) this.checkStory();
      return;
    }
    if (WINTER_OBJECTS.includes(ob?.type)) {
      if (ob.type === "winterAlan") return menu("dialog", "alan");
      if (ob.type === "winterSheep") return this.toast("两只羊在嚼豆子。羊毛隔两天剪一次，自动入仓。");
      if (ob.type === "winterGe") return menu("dialog", "ge");
      if (ob.type === "winterMuseum") {
        if (!this.w.museum.built) {
          if (this.buildMuseum()) this.checkStory();
          return;
        }
        return menu("museum");
      }
      if (ob.type === "winterAmo") return menu("dialog", "amo");
      if (ob.type === "winterEvidence") {
        if (this.deliverEvidence()) this.checkStory();
        return;
      }
      if (ob.type === "winterHall") return menu("museum");
    }
    return super.interact();
  }
  static parse(text) {
    const raw = JSON.parse(text),
      s = OutpostEngine.parse(text);
    if (raw.winter !== undefined) validateWinter(raw.winter);
    return migrateState(s);
  }
}

function validateWinter(w) {
  const object = (x) => x && typeof x === "object" && !Array.isArray(x),
    int = (x, max = 1e9) => Number.isInteger(x) && x >= 0 && x <= max,
    num = (x, a = -1e6, b = 1e9) => Number.isFinite(x) && x >= a && x <= b,
    oneOf = (x, list) => x === null || x === undefined || list.includes(x),
    unique = (a) => new Set(a).size === a.length,
    strs = (a, n = 40) => Array.isArray(a) && a.length <= n && a.every((x) => typeof x === "string" && x.length <= 40),
    bad = () => {
      throw Error("寒潮存档异常，请从设置恢复有效备份；原存档会保留。");
    },
    d = defaults();
  if (!object(w) || w.schema !== WINTER_SCHEMA || Object.keys(w).some((k) => !Object.hasOwn(d, k))) bad();
  if (w.decrees !== undefined && (!strs(w.decrees, 4) || !unique(w.decrees) || !w.decrees.every((x) => DECREES[x]))) bad();
  for (const k of ["decreeDay", "ladder", "ladderDay", "forecastDay", "coldNote", "hordeKey"]) if (w[k] !== undefined && !int(w[k])) bad();
  if (w.ladder !== undefined && w.ladder > 4) bad();
  for (const k of ["forecast", "evidence"]) if (w[k] !== undefined && typeof w[k] !== "boolean") bad();
  if (w.mealLog !== undefined && (!Array.isArray(w.mealLog) || w.mealLog.length > 3 || w.mealLog.some((m) => !object(m) || !int(m.day) || !strs(m.types, 40) || !m.types.every((t) => ITEMS[t])))) bad();
  const r = w.radio;
  if (r !== undefined && (!object(r) || !oneOf(r.program, Object.keys(PROGRAMS)) || !oneOf(r.last, Object.keys(PROGRAMS)) || ["pickDay", "day", "aired", "songsDay"].some((k) => r[k] !== undefined && !int(r[k])) || (r.noise !== undefined && !num(r.noise, 0, 100)) || typeof (r.forceHonest ?? false) !== "boolean")) bad();
  if (w.meteor !== undefined && (!object(w.meteor) || !int(w.meteor.day ?? 0) || typeof (w.meteor.claimed ?? false) !== "boolean")) bad();
  const wi = w.winter;
  if (wi !== undefined && (!object(wi) || !PHASES.includes(wi.phase ?? "none") || !oneOf(wi.priority, Object.keys(PRIORITIES)) || ["prepDay", "coldDay", "endDay", "fuelDay", "frozen", "sick"].some((k) => wi[k] !== undefined && !int(wi[k])) || typeof (wi.lit ?? false) !== "boolean" || (wi.report !== undefined && wi.report !== null && !object(wi.report)))) bad();
  if (w.ge !== undefined && (!object(w.ge) || !GE_PHASES.includes(w.ge.phase ?? "none") || ["day", "unhappy", "warnDay"].some((k) => w.ge[k] !== undefined && !int(w.ge[k])))) bad();
  if (w.alan !== undefined && (!object(w.alan) || !ALAN_PHASES.includes(w.alan.phase ?? "none") || (w.alan.sheep !== undefined && !int(w.alan.sheep, 99)) || ["woolDay", "feedDay"].some((k) => w.alan[k] !== undefined && !int(w.alan[k])))) bad();
  if (w.amo !== undefined && (!object(w.amo) || ["trades", "tradeDay"].some((k) => w.amo[k] !== undefined && !int(w.amo[k])) || ["met", "sample"].some((k) => typeof (w.amo[k] ?? false) !== "boolean"))) bad();
  if (w.yeying !== undefined && (!object(w.yeying) || !YEYING_PHASES.includes(w.yeying.phase ?? "none") || !int(w.yeying.aired ?? 0))) bad();
  const m = w.museum;
  if (m !== undefined) {
    if (!object(m) || typeof (m.built ?? false) !== "boolean" || !strs(m.claimed ?? [], 5) || !(m.claimed ?? []).every((c) => SHOWCASES[c])) bad();
    for (const c of ["fish", "herbs", "logs", "relics"]) if (m[c] !== undefined && (!strs(m[c], 12) || !unique(m[c]))) bad();
    if (m.photos !== undefined && (!Array.isArray(m.photos) || m.photos.length > 12 || !m.photos.every((x) => int(x)))) bad();
  }
  if (w.caught !== undefined && (!strs(w.caught, 8) || !w.caught.every((x) => ITEMS[x]))) bad();
  const a = w.assault;
  if (a !== undefined) {
    if (!object(a) || !ASSAULT_PHASES.includes(a.phase ?? "none")) bad();
    for (const k of ["day", "total", "spawned", "killed", "retreated", "tries"]) if (a[k] !== undefined && !int(a[k], 1e6)) bad();
    for (const k of ["timer", "spawnTimer", "clock"]) if (a[k] !== undefined && !num(a[k])) bad();
    if (a.report !== undefined && a.report !== null && (!object(a.report) || typeof a.report.won !== "boolean")) bad();
  }
  if (w.claimed !== undefined && (!strs(w.claimed, 40) || !unique(w.claimed))) bad();
  // 彼此一致：有预报才有寒潮，寒潮开始后葛队长才可能来，开了馆才有展品。
  if (w.winter && w.winter.phase !== "none" && !w.forecast) bad();
  if (w.ge && w.ge.phase !== "none" && (!w.winter || w.winter.phase === "none")) bad();
}
