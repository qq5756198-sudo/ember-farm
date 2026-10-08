// v0.19.0「妙手」：技能点与天赋树，以及偷盗。
// 新增 skills 字段（学会的天赋、上次重新分配的日子、妙手经验、职业）与 theft 字段（口袋、怀疑、冷却、宝贝、赃物、补救……）。
// 技能点不存：每次按“各技能升过的级数 + 完成的主线段落”现算，所以旧档读进来自动补齐。
import { Engine as DailyEngine, freshState as dailyFresh, migrateState as dailyMigrate, itemsText } from "./daily.js";
import { ITEMS, BUILDINGS, CROPS, REGIONS } from "./data.js";
import { MODS, RARE_SEEDS } from "./daily-data.js";
import {
  SKILL_SCHEMA,
  THEFT_SCHEMA,
  THIEF_XP_PER_LEVEL,
  PRACTICE_MAX_LEVEL,
  RESPEC_COST,
  RESPEC_DAYS,
  SKILL_NAMES,
  TALENTS,
  TIERS,
  VALUE_CAP,
  ATTENTION_FULL,
  MISS_ATTN,
  JUNK_IDS,
  JUNK_SET,
  JUNK_TRADE,
  JOBS,
  MANUALS,
  MANUAL_IDS,
  POCKETS,
  TARGETS,
  TREASURES,
  TREASURE_IDS,
  TREASURE_VALUE,
  THIEF_SPOTS,
  BOXES,
  itemValue,
  itemLabel,
} from "./thief-data.js";
import { SPOTS } from "./outpost-data.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (n, salt) => {
  let h = (Math.imul(n | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const RUINS = ["residential", "hospital", "warehouse"];
const BAD_WEATHER = { 酸雨: 0.3, 高温: 0.5, 暴雨: 0.65 };
export const THIEF_OBJECTS = ["thiefDummy", "thiefBox", "thiefStash"];
export const STEAL_RANGE = 90;

const skillDefaults = () => ({ schema: SKILL_SCHEMA, talents: [], respecDay: -99, thiefXp: 0, jobs: {} });
const theftDefaults = () => ({
  schema: THEFT_SCHEMA,
  seed: 0,
  taken: {},
  tried: {},
  cool: {},
  sus: {},
  susDay: {},
  caught: {},
  treasures: {},
  seen: {},
  where: {},
  hot: [],
  market: { caught: 0, banned: false, priceUntil: 0 },
  strike: {},
  leaving: {},
  stashes: [],
  boxes: {},
  discovery: null,
  pending: null,
  flags: {},
  guilt: 0,
  practiced: 0,
  slipDay: 0,
  planted: {},
  seedCount: 0,
  donated: false,
  claimed: [],
  stats: { tries: 0, wins: 0, caught: 0, items: 0 },
});

export function migrateState(s) {
  dailyMigrate(s);
  const k = skillDefaults();
  s.skills = s.skills ? { ...k, ...s.skills, jobs: { ...k.jobs, ...s.skills.jobs } } : k;
  const d = theftDefaults();
  if (!s.theft) {
    s.theft = d;
    s.theft.seed = (Math.floor(Math.random() * 0x7fffffff) ^ ((s.idCounter || 0) * 2654435761)) >>> 0 || 7;
  } else {
    const x = s.theft;
    s.theft = { ...d, ...x, market: { ...d.market, ...x.market }, flags: { ...d.flags, ...x.flags }, stats: { ...d.stats, ...x.stats } };
  }
  return s;
}
export const freshState = () => migrateState(dailyFresh());

export class Engine extends DailyEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this.steal = null;
    this.assignRegion();
  }
  get sk() {
    return this.s.skills;
  }
  get th() {
    return this.s.theft;
  }
  tOnce(id) {
    const c = this.th.claimed;
    if (c.includes(id)) return false;
    c.push(id);
    if (c.length > 400) this.th.claimed = c.slice(-400);
    return true;
  }

  // ================= 技能点与天赋 =================
  level(skill) {
    if (skill === "thief") return this.sk ? Math.min(5, 1 + Math.floor(this.sk.thiefXp / THIEF_XP_PER_LEVEL)) : 1;
    return super.level(skill);
  }
  xp(skill, n) {
    if (skill === "thief") return this.thiefXp(n);
    return super.xp(skill, n);
  }
  thiefXp(n, cap = Infinity) {
    if (!this.sk || !(n > 0)) return 0;
    const before = this.level("thief"),
      was = this.sk.thiefXp;
    this.sk.thiefXp = Math.min(Math.max(was, cap), was + Math.round(n));
    const after = this.level("thief");
    if (after > before) {
      this.toast("妙手升至 Lv." + after + (after === 3 ? " · 能碰重要的东西了" : after === 4 ? " · 能碰宝贝了" : "") + "，多了 1 个技能点", "gold");
      this.emit("level");
      if (after === 4) this.revealRumor();
    }
    return this.sk.thiefXp - was;
  }
  actsDone() {
    return clamp((this.sc?.act || 1) - 1, 0, 8);
  }
  skillPoints() {
    let earned = this.actsDone();
    for (const k of Object.keys(SKILL_NAMES)) earned += this.level(k) - 1;
    const spent = (this.sk?.talents || []).reduce((n, id) => n + (TALENTS[id]?.cost || 0), 0);
    return { earned, spent, free: earned - spent };
  }
  hasTalent(id) {
    return !!this.sk?.talents.includes(id);
  }
  talentReason(id) {
    const t = TALENTS[id];
    if (!t) return "没有这个天赋";
    if (this.hasTalent(id)) return "已经学会了";
    if (t.need && !this.hasTalent(t.need)) return "先学会「" + TALENTS[t.need].name + "」";
    if (this.level(t.skill) < t.gate) return SKILL_NAMES[t.skill] + "要到 " + t.gate + " 级";
    const free = this.skillPoints().free;
    if (free < t.cost) return "技能点不够（要 " + t.cost + "，有 " + Math.max(0, free) + "）";
    return "";
  }
  learnTalent(id) {
    const why = this.talentReason(id);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    this.sk.talents = [...this.sk.talents, id];
    this.toast("学会了「" + TALENTS[id].name + "」：" + TALENTS[id].text + "。", "gold");
    if (id === "pickpocket") this.olog("学会了顺手牵羊：蹲着（V / 蹲行键）靠近一个人按交互键（E）下手。陈工在农舍边立了个练习口袋的稻草人。");
    this.assignRegion();
    return true;
  }
  respecReason() {
    if (!this.sk.talents.length) return "还没有学会任何天赋";
    if (this.s.day - this.sk.respecDay < RESPEC_DAYS) return "每 " + RESPEC_DAYS + " 天只能重新分配一次（第 " + (this.sk.respecDay + RESPEC_DAYS) + " 天起）";
    if (this.s.money < RESPEC_COST) return "要 " + RESPEC_COST + " 金币";
    return "";
  }
  respec() {
    const why = this.respecReason();
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    this.s.money -= RESPEC_COST;
    const n = this.skillPoints().spent;
    this.sk.talents = [];
    this.sk.respecDay = this.s.day;
    this.toast("天赋全部退回：拿回 " + n + " 个技能点（花了 " + RESPEC_COST + " 金币）。", "gold");
    this.assignRegion();
    return true;
  }

  // ---------- 四项旧技能的天赋 ----------
  toolPlot(p, id) {
    const before = this.s.player.stamina,
      ok = super.toolPlot(p, id);
    if (ok && this.hasTalent("oldHand") && this.s.player.stamina < before) this.s.player.stamina = Math.min(100, this.s.player.stamina + (before - this.s.player.stamina) * 0.3);
    return ok;
  }
  harvest(p, worker = false) {
    const crop = p?.crop,
      before = this.s.player.stamina,
      ok = super.harvest(p, worker);
    if (!ok || worker || !crop || !this.sk) return ok;
    if (this.hasTalent("oldHand") && this.s.player.stamina < before) this.s.player.stamina = Math.min(100, this.s.player.stamina + (before - this.s.player.stamina) * 0.3);
    const extra = {};
    if (this.hasTalent("bumper")) extra[crop] = 1;
    if (this.hasTalent("keepSeed")) {
      this.th.seedCount = (this.th.seedCount + 1) % 3;
      const seed = CROPS[crop]?.seed;
      if (this.th.seedCount === 0 && seed && ITEMS[seed]) extra[seed] = (extra[seed] || 0) + 1;
    }
    if (Object.keys(extra).length) this.receive(extra);
    return ok;
  }
  rushJob(id) {
    if (!this.hasTalent("steadyHand")) return super.rushJob(id);
    const own = Object.hasOwn(this, "roll"),
      orig = this.roll;
    this.roll = () => Math.min(0.999, orig.call(this) * 2);
    try {
      return super.rushJob(id);
    } finally {
      if (own) this.roll = orig;
      else delete this.roll;
    }
  }
  processProduction(n) {
    return super.processProduction(this.hasTalent("quickHand") ? n * 1.15 : n);
  }
  salvageObject(o) {
    const ok = super.salvageObject(o);
    if (ok && this.hasTalent("scrapper")) this.receive({ scrap: 1 });
    return ok;
  }
  capacity() {
    return super.capacity() + (this.hasTalent("packer") ? 4 : 0);
  }
  travel(id) {
    this._travelFrom = this.s.region;
    try {
      return super.travel(id);
    } finally {
      this._travelFrom = null;
    }
  }
  travelBonus(n, to) {
    n = super.travelBonus(n, to);
    const from = this._travelFrom;
    if (this.th?.flags.tunnel && ((from === "farm" && ["hospital", "warehouse"].includes(to)) || (to === "farm" && ["hospital", "warehouse"].includes(from)))) return 1;
    if (this.hasTalent("pathfinder")) n = Math.max(1, n - 5);
    return n;
  }
  die() {
    if (this.hasTalent("survivor") && this.s.outing) for (const [k, v] of Object.entries(this.s.outing)) this.s.outing[k] = Math.floor(v / 2);
    return super.die();
  }
  weaponStats(id) {
    const w = super.weaponStats(id);
    if (!w || !this.sk) return w;
    if (w.mag && this.hasTalent("steadyAim")) return { ...w, damage: w.damage * 1.1 };
    if (!w.mag && this.hasTalent("finisher") && w.damage) return { ...w, damage: w.damage * 1.25 };
    return w;
  }
  damagePlayer(n) {
    return super.damagePlayer(this.hasTalent("toughBone") ? n * 0.9 : n);
  }
  hurtEnemy(e, damage, angle, meta = {}) {
    const out = super.hurtEnemy(e, damage, angle, meta);
    if (e?.type === "raider" && !e.dead && this.hasTalent("suppress")) {
      e.aim = 0;
      e.cooldown = Math.max(e.cooldown || 0, 2);
    }
    return out;
  }
  cropGrowthRate(p) {
    let r = super.cropGrowthRate(p);
    const bad = BAD_WEATHER[this.s.weather];
    if (bad && this.th && this.jobHolder("weatherJob") && (p.region || "farm") === "farm" && p.trait !== "hardy") r *= Math.max(1, 0.7 / bad);
    return r;
  }

  // ================= 偷盗：谁能偷 =================
  targetOf(ob) {
    if (!ob) return null;
    const T = (id, extra = {}) => (TARGETS[id] ? { id, def: { ...TARGETS[id], ...extra }, trust: TARGETS[id].trust || null } : null);
    switch (ob.type) {
      case "resident":
        if (TARGETS[ob.resident]) return T(ob.resident);
        return { id: "res:" + ob.resident, def: { ...TARGETS.crew, name: ob.name || "居民", group: "camp", title: "营地居民" }, trust: ob.resident };
      case "allianceHelper": {
        // 尤可、鹞子入队后仍是同一个人：同一份口袋、同一份怀疑
        if (ob.crew && TARGETS[ob.helper]) return T(ob.helper);
        const name = String(ob.name || "援建队员").split(" · ")[0];
        return { id: "crew:" + ob.helper, def: { ...TARGETS.crew, name }, trust: ob.helper };
      }
      case "outpostCaravan":
        return T("tang");
      case "outpostVisitor":
        return T("visitor", { name: String(ob.name || "访客").split(" · ")[0] });
      case "outpostLathe":
        return this.o?.lathe ? T("youke") : null;
      case "outpostYouke":
        return T("youke");
      case "outpostCai":
        return T("cai");
      case "outpostPrisoner":
        return T("yaozi");
      case "winterAlan":
        return T("alan");
      case "winterGe":
        return T("ge");
      case "winterMuseum":
        return this.w?.museum?.built ? T("suyan") : null;
      case "winterAmo":
        return this.amoOpen?.() ? T("amo") : null;
      case "seasonJiang":
        return T("jiang");
      case "seasonAli":
        return T("ali");
      case "seasonAdou":
        return this.ss?.adou?.phase === "stealing" ? null : T("adou");
      case "seasonLodger":
        return ob.name === "秦奶奶" ? T("qin") : T("lodger", { name: ob.name || "过路人" });
      case "seasonHe":
        return T("he");
      case "farPeng":
        return this.fr?.peng?.phase === "attacked" ? null : T("peng");
      case "farHemc":
        return T("hemc");
      case "trader":
        return ob.trader === "food" ? T("linyi") : ob.trader === "mechanic" ? T("laozhou") : null;
    }
    return null;
  }
  // 给玩家看的名字：不露出内部编号
  targetName(tid) {
    if (TARGETS[tid]) return TARGETS[tid].name;
    const [kind, id] = String(tid).split(":");
    if (kind === "res") return this.residentName?.(id) || "居民";
    if (kind === "crew") return this.o?.crew.find((c) => c.id === id)?.name || (this.sc?.helpers?.some((h) => h.id === id) ? this.helperName?.(id) : "") || "援建队员";
    return this.personName(tid);
  }
  personName(id) {
    if (TARGETS[id]) return TARGETS[id].name;
    if (this.c?.residents.some((r) => r.id === id)) return this.residentName?.(id) || "居民";
    return this.o?.crew.find((c) => c.id === id)?.name || (this.sc?.helpers?.some((h) => h.id === id) ? this.helperName?.(id) : "") || "援建队员";
  }
  targetDef(tid) {
    if (TARGETS[tid]) return TARGETS[tid];
    const ob = this.findTarget(tid);
    return ob ? this.targetOf(ob)?.def : tid.startsWith("crew:") ? TARGETS.crew : null;
  }
  findTarget(tid) {
    let best = null;
    for (const ob of this.objects) {
      const t = this.targetOf(ob);
      if (t?.id === tid && (!best || dist(ob, this.s.player) < dist(best, this.s.player))) best = ob;
    }
    return best;
  }
  targetNear(range = STEAL_RANGE) {
    let best = null,
      bd = Infinity;
    for (const ob of this.objects) {
      const t = this.targetOf(ob);
      if (!t) continue;
      const d = dist(ob, this.s.player);
      if (d <= range && d < bd) {
        bd = d;
        best = { ...t, ob };
      }
    }
    return best;
  }
  asleep(def) {
    const m = this.s.minute;
    return !!def?.sleeps && (m >= 23 * 60 || m < 5 * 60);
  }
  isNightTime() {
    const m = this.s.minute;
    return m >= 22 * 60 || m < 5 * 60;
  }
  busy(def) {
    const m = this.s.minute;
    if (this.asleep(def)) return false;
    if (def.group === "market") return m >= 8 * 60 && m < 20 * 60;
    return m >= 7 * 60 && m < 18 * 60;
  }
  facing(ob) {
    const p = this.s.player,
      dx = p.x - ob.x,
      dy = p.y - ob.y;
    if (dy < 0 && Math.abs(dx) <= -dy) return "behind";
    if (dy > 0 && Math.abs(dx) <= dy) return "front";
    return "side";
  }
  // 旁观者：200 步内醒着、手上又没活的人（干活的人顾不上看你）
  watchers(tid) {
    let n = 0;
    for (const ob of this.objects) {
      const t = this.targetOf(ob);
      if (!t || t.id === tid) continue;
      if (dist(ob, this.s.player) <= 200 && !this.asleep(t.def) && !this.busy(t.def)) n++;
    }
    return n;
  }
  week() {
    return Math.floor((this.s.day - 1) / 7);
  }

  // ---------- 口袋 ----------
  pockets(tid, def = this.targetDef(tid), box = false) {
    if (!def) return [];
    const week = this.week(),
      prof = POCKETS[def.profile] || POCKETS.crew,
      r = rng(mix(this.th.seed ^ hashStr(tid), week * 7919 + (box ? 31 : 0))),
      out = [];
    const pick = (list) => list[Math.floor(r() * list.length) % list.length];
    const n = box ? 2 : 3 + (r() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const u = r();
      let tier = box ? "important" : u < 0.5 ? "junk" : u < 0.85 ? "normal" : "important";
      if (!prof[tier]?.length) tier = prof.normal?.length ? "normal" : "junk";
      const [item, a, b] = pick(prof[tier]),
        k = a + Math.floor(r() * (b - a + 1));
      const id = item === "mod" ? MODS[Math.floor(r() * MODS.length) % MODS.length] : item;
      out.push({ id: (box ? "box:" : "") + tid + ":" + week + ":" + i, tier, item: id, n: k });
    }
    const taken = this.th.taken[(box ? "box:" : "") + tid];
    const left = taken && taken.w === week ? out.filter((x) => !taken.ids.includes(x.id)) : out;
    const tr = def.treasure;
    if (tr && !!def.boxOnly === box && this.th.treasures[tr] === "known") left.push({ id: "T:" + tr, tier: "treasure", item: tr, n: 1 });
    return left;
  }
  slotValue(slot) {
    return slot.tier === "treasure" ? TREASURE_VALUE : itemValue(slot.item, slot.n);
  }
  slotLabel(slot) {
    return slot.tier === "treasure" ? "★ " + TREASURES[slot.item].name : itemLabel(slot.item, slot.n);
  }
  slotReason(slot) {
    const L = this.level("thief"),
      t = TIERS[slot.tier];
    if (L < t.level) return "妙手要到 " + t.level + " 级才能碰" + t.name + "的东西";
    if (this.slotValue(slot) > VALUE_CAP[L]) return "手还不够稳：这件值 " + this.slotValue(slot) + " 金币，妙手 " + L + " 级只能碰 " + VALUE_CAP[L] + " 以内的";
    return "";
  }

  // ---------- 第一关：没被察觉的机会 ----------
  stealOdds(tid, ob = this.findTarget(tid), opts = {}) {
    const def = opts.def || this.targetDef(tid) || TARGETS.crew,
      L = this.level("thief"),
      parts = [["起点", 30]];
    if (L > 1) parts.push(["妙手 " + L + " 级", 5 * (L - 1)]);
    if (opts.box) parts.push(["撬箱子不用看他的脸", 0]);
    else if (ob) {
      const f = this.facing(ob);
      parts.push([{ behind: "从背后", side: "从侧面", front: "从正面" }[f], { behind: 20, side: 0, front: -30 }[f]]);
    }
    if (this.f?.crouch) parts.push(["蹲着", 10]);
    const sleeping = this.asleep(def);
    if (sleeping) parts.push(["他睡着了", 35]);
    else if (this.busy(def)) parts.push(["他在忙", 10]);
    if (this.isNightTime()) parts.push(["深夜", 5]);
    if (this.hasTalent("nightOwl") && (sleeping || this.isNightTime())) parts.push(["夜行", 15]);
    if (opts.distract) parts.push(["声东击西", 20]);
    const w = this.watchers(opts.box ? def.owner || tid : tid);
    if (w) parts.push(["旁边有 " + w + " 个闲着的人看得见", -15 * w]);
    if (def.alert) parts.push([def.alert === 2 ? "他很机警" : "他留着心", def.alert === 2 ? -20 : -10]);
    const owner = opts.box ? def.owner || tid : tid,
      s = this.th.sus[owner] || 0;
    if (s) parts.push(["他对你起疑 " + s, -10 * s]);
    if (s >= 3) parts.push(["他护着口袋", -30]);
    const P = parts.reduce((n, [, v]) => n + v, 0),
      plan = this.hasTalent("planHand");
    const byTier = {
      junk: clamp(P, 5, TIERS.junk.cap),
      normal: clamp(P, 5, TIERS.normal.cap),
      important: clamp(P, 5, TIERS.important.cap),
      treasure: clamp(P - 25 + (plan ? 15 : 0), 5, plan ? 70 : TIERS.treasure.cap),
    };
    return { P, parts, byTier, sleeping };
  }
  oddsWord(p) {
    return p >= 60 ? "高" : p >= 30 ? "中" : "低";
  }
  stealReason(tid) {
    const th = this.th;
    if (!this.hasTalent("pickpocket")) return "先在技能页（K）学会「顺手牵羊」";
    if (th.pending) return "先把上一次被抓的事了结";
    if (th.tried[tid] === this.s.day) return "今天已经对他下过手了";
    if ((th.cool[tid] || 0) > this.s.day) return "刚失过手，他还警惕着（第 " + th.cool[tid] + " 天再说）";
    if (this.raidState && ["warning", "active"].includes(this.raidState().phase)) return "灰隼团就在外面，顾不上";
    if (["warning", "active"].includes(this.s.horde?.phase)) return "尸潮正在逼近，顾不上";
    return "";
  }
  distractReason() {
    if (!this.hasTalent("distract")) return "要「声东击西」天赋";
    if (this.fr?.dog?.rescued && (this.fr.dog.bond || 0) >= 6) return "";
    if (this.stockOf("stone") >= 1) return "";
    return "要一块石材（或默契 6 以上的麦穗）";
  }
  useDistract() {
    if (this.fr?.dog?.rescued && (this.fr.dog.bond || 0) >= 6) return "麦穗跑过去扑他的裤腿";
    this.takeFarm({ stone: 1 });
    return "你朝远处扔了一块石头";
  }

  // ---------- 下手 ----------
  stealRoll(key) {
    return rng(mix(this.th.seed ^ hashStr(key), this.s.day * 131 + 17))();
  }
  startSteal(tid, opts = {}) {
    const why = this.stealReason(tid);
    if (why) {
      this.toast(why + "。", "warn");
      return null;
    }
    const ob = this.findTarget(tid);
    if (!ob || dist(ob, this.s.player) > STEAL_RANGE + 40) {
      this.toast("离他太远了。", "warn");
      return null;
    }
    if (opts.distract && this.distractReason()) {
      this.toast(this.distractReason() + "。", "warn");
      return null;
    }
    const t = this.targetOf(ob),
      def = t.def,
      lines = [];
    if (opts.distract) lines.push(this.useDistract() + "，他转过头去。");
    const odds = this.stealOdds(tid, ob, { distract: !!opts.distract, def });
    return this.beginSteal({ tid, def, trust: t.trust, odds, slots: this.pockets(tid, def), key: tid, lines, sleeping: odds.sleeping });
  }
  beginSteal({ tid, def, trust, odds, slots, key, lines = [], sleeping = false, box = null, practice = false }) {
    const th = this.th;
    th.tried[key] = this.s.day;
    if (!practice) th.stats.tries++;
    const roll = practice ? 0 : this.stealRoll(key);
    const rain = ["小雨", "暴雨", "酸雨"].includes(this.s.weather);
    this.steal = {
      tid,
      key,
      name: def.name,
      group: def.group,
      def,
      trust,
      box,
      practice,
      odds,
      roll,
      slots: slots.map((x) => ({ ...x })),
      taken: [],
      attention: 0,
      fill: (practice ? 8 : sleeping ? ATTENTION_FULL.asleep : ATTENTION_FULL.awake) * (rain ? 1.1 : 1),
      phase: "pick",
      cur: -1,
      marker: 0,
      dir: 1,
      speed: 0,
      zone: { a: 0, w: 0, a0: 0 },
      t: 0,
      picks: 0,
      misses: 0,
      lines,
      result: null,
    };
    if (!practice && roll * 100 >= odds.byTier.junk) this.stealCaught("你的手刚伸过去，" + def.name + "就察觉了");
    this.emit("craft");
    return this.steal;
  }
  stealPick(i) {
    const st = this.steal;
    if (!st || st.phase !== "pick") return false;
    const slot = st.slots[i];
    if (!slot || slot.done || slot.lost) return false;
    if (!st.practice) {
      const why = this.slotReason(slot);
      if (why) {
        this.toast(why + "。", "warn");
        return false;
      }
      if (st.roll * 100 >= st.odds.byTier[slot.tier]) {
        this.stealCaught(slot.tier === "treasure" ? "你的手刚碰到贴身的内袋，" + st.name + "一把按住了" : "你的手往里探得太深，" + st.name + "察觉了");
        if (slot.tier === "treasure" && this.th.treasures[slot.item] === "known") this.th.treasures[slot.item] = "lost";
        return true;
      }
    }
    const L = this.level("thief"),
      t = TIERS[slot.tier];
    let w = t.zone + 0.04 * (L - 1);
    if (this.hasTalent("lightHand")) w *= 1.2;
    if (slot.tier === "treasure" && this.hasTalent("planHand")) w += 0.05;
    w = clamp(w, 0.04, 0.6);
    const r = rng(mix(st.roll * 1e9 + 13, ++st.picks * 977 + hashStr(slot.id)));
    const a = 0.15 + r() * (0.85 - w - 0.15 > 0 ? 0.85 - w - 0.15 : 0);
    Object.assign(st, { phase: "swing", cur: i, marker: 0, dir: 1, speed: t.speed * Math.pow(1.15, st.taken.length), zone: { a, w, a0: a } });
    return true;
  }
  stealTick(dt) {
    const st = this.steal;
    if (!st || !["pick", "swing"].includes(st.phase)) return false;
    dt = clamp(Number(dt) || 0, 0, 0.1);
    st.t += dt;
    st.attention = Math.min(1, st.attention + dt / st.fill);
    if (st.phase === "swing") {
      st.marker += st.dir * st.speed * dt;
      if (st.marker > 1) {
        st.marker = 2 - st.marker;
        st.dir = -1;
      } else if (st.marker < 0) {
        st.marker = -st.marker;
        st.dir = 1;
      }
      if (st.slots[st.cur]?.tier === "treasure") st.zone.a = clamp(st.zone.a0 + 0.12 * Math.sin(st.t * 2.2), 0, 1 - st.zone.w);
    }
    if (st.attention >= 1) {
      this.stealCaught(st.practice ? "铃铛响了" : "注意力满了，" + st.name + "回头看见了你的手");
      return true;
    }
    return false;
  }
  stealPress() {
    const st = this.steal;
    if (!st || st.phase !== "swing") return false;
    const slot = st.slots[st.cur],
      hit = st.marker >= st.zone.a && st.marker <= st.zone.a + st.zone.w;
    if (hit) {
      slot.done = true;
      st.taken.push(slot);
      st.attention = Math.min(1, st.attention + TIERS[slot.tier].attn);
      st.lines.push("摸到了：" + this.slotLabel(slot) + "。");
    } else {
      const add = this.hasTalent("lightHand") && st.misses === 0 ? MISS_ATTN / 2 : MISS_ATTN;
      st.misses++;
      st.attention = Math.min(1, st.attention + add);
      if (slot.tier === "treasure" && !st.practice) {
        slot.lost = true;
        if (this.th.treasures[slot.item] === "known") this.th.treasures[slot.item] = "lost";
        st.lines.push("手一抖，" + st.name + "下意识按住了内袋：「" + TREASURES[slot.item].name + "」再也没机会了。");
      } else st.lines.push("手一抖，没摸出来（注意力 +" + Math.round(add * 100) + "%）。");
    }
    st.phase = "pick";
    st.cur = -1;
    if (st.attention >= 1) this.stealCaught(st.practice ? "铃铛响了" : "注意力满了，" + st.name + "回头看见了你的手");
    return hit;
  }
  stealStop() {
    const st = this.steal;
    if (!st || !["pick", "swing"].includes(st.phase)) return null;
    st.phase = "done";
    const lines = [...st.lines];
    if (st.practice) {
      const n = st.taken.length * 2,
        got = this.th.practiced === this.s.day ? 0 : this.thiefXp(n, (PRACTICE_MAX_LEVEL - 1) * THIEF_XP_PER_LEVEL);
      this.th.practiced = this.s.day;
      lines.push(n ? (got ? "练了一回手：妙手经验 +" + got + "。" : this.level("thief") >= PRACTICE_MAX_LEVEL ? "稻草人已经教不了你什么了：去找真人练。" : "今天已经练过了。") : "空手收回。");
      st.result = { win: true, lines };
      return st.result;
    }
    if (!st.taken.length) {
      lines.push("你空着手收了回来，没人察觉。");
      st.result = { win: true, lines };
      return st.result;
    }
    const th = this.th,
      key = st.box ? "box:" + st.box : st.tid,
      week = this.week();
    let xp = 0,
      worth = false;
    const got = {};
    for (const slot of st.taken) {
      if (!this.tOnce("steal:" + slot.id + ":" + week)) continue;
      xp += TIERS[slot.tier].xp;
      if (slot.tier !== "treasure") {
        const rec = th.taken[key] && th.taken[key].w === week ? th.taken[key] : { w: week, ids: [] };
        rec.ids = [...rec.ids, slot.id].slice(-8);
        th.taken[key] = rec;
      }
      if (slot.tier === "important") worth = true;
      if (slot.tier === "treasure") {
        worth = true;
        lines.push(...this.takeTreasure(slot.item));
        continue;
      }
      if (slot.item === "coins") {
        this.s.money += slot.n;
        got.coins = (got.coins || 0) + slot.n;
        continue;
      }
      if (slot.item === "letter") {
        const r = this.revealRumor();
        lines.push(r ? "信里提到：" + r : "一封没头没尾的信，看完就烧了。");
        continue;
      }
      this.receive({ [slot.item]: slot.n });
      got[slot.item] = (got[slot.item] || 0) + slot.n;
      th.stats.items += slot.n;
      if (slot.tier !== "junk" && !ITEMS[slot.item]?.protected) th.hot = [...th.hot, { item: slot.item, n: slot.n, until: this.s.day + (slot.tier === "important" ? 14 : 7) }].slice(-40);
    }
    th.stats.wins++;
    const gained = this.thiefXp(xp);
    const coins = got.coins;
    delete got.coins;
    if (Object.keys(got).length) lines.push("带走：" + itemsText(got) + (coins ? "、金币 +" + coins : ""));
    else if (coins) lines.push("带走：金币 +" + coins);
    if (gained) lines.push("妙手经验 +" + gained + "。");
    const g = st.group;
    if (worth && ["camp", "crew"].includes(g)) th.discovery = { target: st.tid, name: st.name, day: this.s.day + 1 };
    if (st.def.poor || ["camp", "crew"].includes(g)) {
      th.guilt = this.s.day + 1;
      lines.push("你心里有点不是滋味。");
    }
    if (st.tid === "peng" && st.taken.some((x) => x.tier === "treasure")) th.flags.pengNotice = this.s.day + 1;
    this.olog("妙手 · " + st.name + "：" + lines.filter((l) => l.startsWith("带走") || l.startsWith("偷到")).join(" "), "normal");
    st.result = { win: true, lines };
    return st.result;
  }
  stealCaught(reason) {
    const st = this.steal;
    if (!st) return;
    const lines = [reason + "。"];
    if (st.taken.length) lines.push("这次摸到的东西全掉在了地上。");
    if (st.practice) {
      st.phase = "done";
      lines.push("稻草人的铃铛叮铃铃响了。再来一次吧（明天）。");
      this.th.practiced = this.s.day;
      st.result = { win: false, lines };
      return;
    }
    const th = this.th;
    if (this.hasTalent("slipAway") && th.slipDay !== this.s.day) {
      th.slipDay = this.s.day;
      st.phase = "done";
      lines.push("金蝉脱壳：你装作弯腰系鞋带，顺势走开了。没人知道是你。");
      st.result = { win: false, lines };
      return;
    }
    st.phase = "caught";
    this.applyCaught(st);
    th.pending = { target: st.box ? BOXES[st.box].owner : st.tid, name: st.name, group: st.group, day: this.s.day, reason: reason.slice(0, 60), trust: st.trust ? String(st.trust).slice(0, 24) : null };
    st.result = { win: false, lines };
    this.thiefXp(1);
  }
  applyCaught(st) {
    const th = this.th,
      tid = st.box ? BOXES[st.box].owner : st.tid,
      day = this.s.day;
    th.sus[tid] = Math.min(3, (th.sus[tid] || 0) + 1);
    th.susDay[tid] = day;
    th.cool[tid] = day + 2;
    th.caught[tid] = Math.min(99, (th.caught[tid] || 0) + 1);
    th.stats.caught++;
    this.addReputation(-1);
    const g = st.group,
      n = th.caught[tid];
    if (g === "camp" || g === "crew") {
      this.residentsMood?.(-6);
      if (st.trust) this.addTrust?.(st.trust, -2);
      if (n >= 3) {
        if (g === "camp") {
          th.strike[tid] = true;
          this.toast(st.name + "不干了：被你偷了三回，他罢工到你赔礼为止。", "warn");
        } else {
          const id = tid.replace(/^crew:/, "");
          if (this.o?.crew.some((c) => c.id === id) && id !== "youke") {
            th.leaving[id] = day + 2;
            this.toast(st.name + "说两天后就走：被你偷了三回。在任务手记里赔礼还能留住他。", "warn");
          } else {
            th.strike[tid] = true;
            this.toast(st.name + "撂挑子了：被你偷了三回，赔礼之前不再干活。", "warn");
          }
        }
      }
    } else if (g === "npc") {
      if (st.trust) this.addTrust?.(st.trust, -2);
    } else if (g === "market") {
      th.market.priceUntil = day + 7;
      th.market.caught = Math.min(99, th.market.caught + 1);
      if (th.market.caught >= 3 && !th.market.banned) {
        th.market.banned = true;
        this.toast("集市的人都认得你了：林姨、老周和唐九不再跟你做买卖，直到你交 100 金币赔礼钱。", "warn");
      }
    } else if (g === "peng") {
      if (this.fr?.peng) this.fr.peng.relation = clamp((this.fr.peng.relation || 0) - 3, -10, 10);
    } else if (g === "hemc") th.flags.hemcAngry = true;
    this.olog("妙手 · 被" + st.name + "抓住了。", "warn");
  }
  pendingChoiceReason(i) {
    const p = this.th.pending;
    if (!p) return "没有要了结的事";
    if (i === 0 && this.s.money < 20) return "要 20 金币";
    if (i === 2 && this.s.region === "farm") return "在农场里跑不掉";
    if (![0, 1, 2].includes(i)) return "没有这个选项";
    return "";
  }
  resolveCaught(i) {
    const p = this.th.pending,
      why = this.pendingChoiceReason(i);
    if (why) {
      this.toast(why + "。", "warn");
      return null;
    }
    // 跑不回去（比如正在守街区）就不算跑
    if (i === 2 && !this.travel("farm")) return null;
    const th = this.th,
      lines = [];
    th.pending = null;
    if (i === 0) {
      this.s.money -= 20;
      this.addReputation(1);
      if (p.trust) this.addTrust?.(p.trust, 1);
      lines.push("你赔着笑脸把东西还了回去，又塞给" + p.name + " 20 金币。他哼了一声，算是揭过了。");
    } else if (i === 1) {
      const ok = this.stealRoll("bluff:" + p.target) < this.level("thief") * 0.1;
      if (ok) {
        th.sus[p.target] = Math.max(0, (th.sus[p.target] || 0) - 1);
        this.addReputation(1);
        lines.push("“我看你兜里有只虫子。”" + p.name + "半信半疑地走开了。");
      } else {
        th.sus[p.target] = Math.min(3, (th.sus[p.target] || 0) + 1);
        this.addReputation(-2);
        lines.push("装傻没装像，" + p.name + "当着大家的面数落了你一顿（怀疑 +1、声望 −2）。");
      }
    } else {
      th.sus[p.target] = Math.min(3, (th.sus[p.target] || 0) + 1);
      this.addReputation(-2);
      lines.push("你拔腿就跑，一路跑回了农场。" + p.name + "会把这事告诉别人的（怀疑 +1、声望 −2）。");
    }
    this.olog(lines[0], "warn");
    return { lines };
  }

  // ---------- 反手塞物 ----------
  plantOptions(tid) {
    const out = [];
    if (this.stockOf("bread") >= 1) out.push({ id: "bread", label: "塞一份干粮", text: "他的信任 +1，对你的怀疑 −1" });
    if (tid === "qin" && this.th.treasures.familyPhoto === "taken") out.push({ id: "photo", label: "把全家福放回去", text: "营地士气 +8、声望 +2" });
    return out;
  }
  plant(tid, what) {
    if (!this.hasTalent("plant")) return null;
    const why = this.stealReason(tid);
    if (why) {
      this.toast(why + "。", "warn");
      return null;
    }
    const opt = this.plantOptions(tid).find((o) => o.id === what);
    if (!opt) return null;
    const ob = this.findTarget(tid),
      t = this.targetOf(ob);
    if (!t) return null;
    const odds = this.stealOdds(tid, ob, { def: t.def }),
      chance = clamp(odds.byTier.junk + 20, 5, 95),
      th = this.th;
    th.tried[tid] = this.s.day;
    const ok = this.stealRoll("plant:" + tid) * 100 < chance;
    if (!ok) {
      th.sus[tid] = Math.min(3, (th.sus[tid] || 0) + 1);
      th.susDay[tid] = this.s.day;
      return { win: false, lines: [t.def.name + "猛地回头：“你在我兜里干什么？”东西没塞进去，他对你起了疑（怀疑 +1）。"] };
    }
    const lines = [];
    if (what === "bread") {
      this.takeFarm({ bread: 1 });
      if (t.trust) this.addTrust?.(t.trust, 1);
      th.sus[tid] = Math.max(0, (th.sus[tid] || 0) - 1);
      lines.push("你悄悄往" + t.def.name + "兜里塞了一份干粮。明天他会发现的。");
    } else if (what === "photo") {
      th.treasures.familyPhoto = "returned";
      this.residentsMood?.(8);
      this.addReputation(2);
      lines.push("全家福回到了秦奶奶的口袋里。第二天她逢人就说照片“自己回来了”。");
    }
    this.olog("妙手 · " + lines[0]);
    return { win: true, lines };
  }

  // ---------- 钱箱、稻草人、藏货点 ----------
  boxHere(id) {
    const b = BOXES[id];
    if (!b || this.s.region !== b.region) return false;
    if (id === "tang") return !!this.caravanHere?.();
    return true;
  }
  boxSpot(id) {
    const b = BOXES[id];
    if (id === "tang") return { x: SPOTS.caravan.x + b.dx, y: SPOTS.caravan.y + b.dy };
    const tr = this.objects.find((o) => o.type === "trader" && (id === "linyi" ? o.trader === "food" : o.trader === "mechanic"));
    return tr ? { x: tr.x + b.dx, y: tr.y + b.dy } : null;
  }
  boxReason(id) {
    if (!this.hasTalent("lockpick")) return "要「开锁」天赋";
    if (!this.boxHere(id)) return "钱箱不在这里";
    if (this.th.pending) return "先把上一次被抓的事了结";
    if (this.th.boxes[id] === this.week()) return "这周已经撬过了（下周再来）";
    if (this.th.tried["box:" + id] === this.s.day) return "今天已经撬过了";
    return "";
  }
  startBox(id) {
    const why = this.boxReason(id);
    if (why) {
      this.toast(why + "。", "warn");
      return null;
    }
    const b = BOXES[id],
      owner = TARGETS[b.owner];
    this.th.boxes[id] = this.week();
    const odds = this.stealOdds(b.owner, null, { box: true, def: { ...owner, owner: b.owner } });
    return this.beginSteal({ tid: b.owner, def: { ...owner, name: owner.name }, trust: owner.trust || null, odds, slots: this.pockets(b.owner, owner, true), key: "box:" + id, box: id, lines: ["你蹲在" + b.name + "边上，掏出了铁丝。"] });
  }
  startPractice() {
    if (!this.hasTalent("pickpocket")) {
      this.toast("先在技能页学会「顺手牵羊」。", "warn");
      return null;
    }
    if (this.th.practiced === this.s.day) {
      this.toast("今天已经练过了，明天再来。", "warn");
      return null;
    }
    return this.beginSteal({ tid: "dummy", def: { name: "稻草人", group: "dummy", alert: 0 }, odds: { byTier: { junk: 100, normal: 100, important: 100, treasure: 100 }, parts: [] }, slots: [{ id: "dummy:0", tier: "junk", item: "junkButton", n: 1 }, { id: "dummy:1", tier: "normal", item: "junkCan", n: 1 }, { id: "dummy:2", tier: "normal", item: "junkPencil", n: 1 }], key: "dummy", practice: true });
  }
  openStash(id) {
    const th = this.th,
      st = th.stashes.find((x) => x.id === id);
    if (!st) return false;
    th.stashes = th.stashes.filter((x) => x !== st);
    if (this.tOnce("stash:" + st.id)) {
      this.receive(st.items);
      this.toast(st.label + "：" + itemsText(st.items), "gold");
      this.olog("找到了" + st.label + "：" + itemsText(st.items) + "。", "gold");
    }
    this.assignRegion();
    return true;
  }

  // ---------- 宝贝 ----------
  takeTreasure(id) {
    const tr = TREASURES[id],
      th = this.th,
      lines = ["偷到了宝贝「" + tr.name + "」！"];
    if (!tr || ["taken", "given"].includes(th.treasures[id])) return [];
    th.treasures[id] = "taken";
    this.applyTreasure(id, lines);
    this.toast("偷到了宝贝「" + tr.name + "」：" + tr.text + "。", "gold");
    return lines;
  }
  applyTreasure(id, lines = []) {
    const tr = TREASURES[id],
      e = tr.effect,
      th = this.th;
    if (e.items) {
      this.receive(e.items);
      lines.push("得到：" + itemsText(e.items));
    }
    if (e.tech) {
      if (this.c.technologies[e.tech]) {
        this.receive(e.fallback);
        lines.push("这项科技已经有了，图纸换成：" + itemsText(e.fallback));
      } else {
        this.c.technologies[e.tech] = true;
        this.ensureResearchOffers?.();
        lines.push("照着图纸，直接解锁了科技：" + tr.text.split("，")[0].replace("直接解锁", ""));
      }
    }
    if (e.flag) {
      th.flags[e.flag] = true;
      lines.push(tr.text + "。");
    }
    if (e.stash) {
      const sp = THIEF_SPOTS.stash[e.stash];
      if (!th.stashes.some((x) => x.id === e.stash)) th.stashes = [...th.stashes, { id: e.stash, region: sp.region, x: sp.x, y: sp.y, label: sp.label, items: { ...sp.items } }];
      lines.push((REGIONS[sp.region]?.name || "那边") + "多了一处藏货点（" + sp.label + "），地图上已标出。");
    }
    if (e.mood) {
      this.residentsMood?.(e.mood);
      lines.push("营地士气 " + e.mood + "。");
    }
    if (e.items && Object.keys(e.items).some((k) => MANUAL_IDS.includes(k))) lines.push("职业手册在背包里：去任务手记的“妙手”交给一个人。");
    this.assignRegion();
    return lines;
  }
  revealRumor(prefer = null) {
    const th = this.th;
    const owners = (id) => TREASURES[id].owner,
      open = (id) => !th.treasures[id] && !this.ownerGone(owners(id));
    let list = TREASURE_IDS.filter((id) => open(id) && th.seen[owners(id)]);
    if (prefer) {
      const want = TARGETS[prefer]?.treasure;
      if (want && open(want)) list = [want];
    }
    if (!list.length) list = TREASURE_IDS.filter(open);
    if (!list.length) return "";
    const id = list[mix(th.seed, this.s.day * 7 + Object.keys(th.treasures).length) % list.length];
    th.treasures[id] = "known";
    const who = TARGETS[TREASURES[id].owner];
    const text = who.name + "身上揣着「" + TREASURES[id].name + "」" + (who.boxOnly ? "（锁在他的钱箱里）" : "");
    this.toast("听说" + text + "。", "gold");
    this.olog("传闻：" + text + "。", "gold");
    return text;
  }

  // 再也见不到的人（鹞子被放走或送走了）：不再传他的宝贝
  ownerGone(tid) {
    if (tid === "yaozi") return !!this.o && (["interrogated", "released"].includes(this.o.prisoner) || (this.o.prisoner === "stayed" && !this.o.crew.some((c) => c.id === "yaozi")));
    return false;
  }

  // ---------- 职业 ----------
  jobHolder(job) {
    const id = this.sk?.jobs[job];
    if (!id) return null;
    if (this.c.residents.some((r) => r.id === id) || this.o?.crew.some((c) => c.id === id) || this.sc?.helpers?.some((h) => h.id === id)) return id;
    return null;
  }
  jobCandidates() {
    const out = this.c.residents.map((r) => ({ id: r.id, name: this.residentName?.(r.id) || TARGETS[r.id]?.name || r.id }));
    for (const c of this.o?.crew || []) out.push({ id: c.id, name: c.name });
    return out.filter((x) => !Object.values(this.sk.jobs).includes(x.id));
  }
  assignJob(manual, person) {
    const m = MANUALS[manual];
    if (!m || this.stockOf(manual) < 1) {
      this.toast("背包和仓库里没有这本手册。", "warn");
      return false;
    }
    if (!this.jobCandidates().some((x) => x.id === person)) {
      this.toast("这个人已经有职业了，或者不在营地。", "warn");
      return false;
    }
    const name = this.jobCandidates().find((x) => x.id === person).name;
    this.takeFarm({ [manual]: 1 });
    this.sk.jobs = { ...this.sk.jobs, [m.job]: person };
    this.toast(name + "成了" + JOBS[m.job].name + "：" + JOBS[m.job].text + "。", "gold");
    return true;
  }

  // ---------- 赃物、销赃、垃圾 ----------
  hotCount(id) {
    const n = this.th.hot.filter((h) => h.item === id && h.until >= this.s.day).reduce((a, h) => a + h.n, 0);
    return Math.min(n, this.stockOf(id));
  }
  hotItems() {
    const ids = [...new Set(this.th.hot.filter((h) => h.until >= this.s.day).map((h) => h.item))];
    return ids.map((id) => ({ id, n: this.hotCount(id), until: Math.max(...this.th.hot.filter((h) => h.item === id).map((h) => h.until)) })).filter((x) => x.n > 0);
  }
  cleanSell(id, n) {
    const hot = this.hotCount(id);
    if (!hot) return n;
    const free = Math.max(0, this.stockOf(id) - hot);
    if (free < 1) {
      this.toast("这是赃物，正经渠道不收：" + (ITEMS[id]?.name || id) + "的标记还要几天才消，或者找销赃的人。", "warn");
      return 0;
    }
    return Math.min(n, free);
  }
  shipItem(id, n = 1) {
    const want = Math.min(Math.floor(n), this.qty(id)),
      k = this.cleanSell(id, want);
    if (k < 1) return false;
    if (k < want) this.hotPartToast(id, k);
    return super.shipItem(id, k);
  }
  // 每日卡“拿最多的东西去卖”：赃物不算在里面
  topItem(min = 1, pred) {
    if (!this._sellingTop || !this.th) return super.topItem(min, pred);
    const best = super.topItem(1, (id) => !ITEMS[id].protected && this.stockOf(id) - this.hotCount(id) >= min);
    return best ? { id: best.id, n: best.n - this.hotCount(best.id) } : null;
  }
  trade(trader, id, n, direction) {
    if (this.th?.market.banned && ["food", "mechanic"].includes(trader)) {
      this.toast("集市的人不跟你做买卖了：先在任务手记里交赔礼钱。", "warn");
      return false;
    }
    if (direction === "sell") {
      const k = this.cleanSell(id, n);
      if (k < n) {
        if (k > 0) this.hotPartToast(id, k);
        return false;
      }
    }
    return super.trade(trader, id, n, direction);
  }
  listStall(item, n, band) {
    const k = this.cleanSell(item, n);
    if (k < n) {
      if (k > 0) this.hotPartToast(item, k);
      return false;
    }
    return super.listStall(item, n, band);
  }
  hotPartToast(id, k) {
    this.toast("这里面有 " + this.hotCount(id) + " 份" + (ITEMS[id]?.name || "东西") + "是赃物：正经渠道最多只收 " + k + " 份。", "warn");
  }
  price(trader, id, direction) {
    let p = super.price(trader, id, direction);
    if (!p || direction !== "buy" || !this.th) return p;
    if (trader === "food" && this.th.flags.purchaseList) p = Math.max(1, Math.round(p * 0.85));
    if (this.th.market.priceUntil > this.s.day && ["food", "mechanic"].includes(trader)) p = Math.round(p * 1.3);
    return p;
  }
  buyOffer(key) {
    if (this.th?.market.banned) {
      this.toast("唐九摆摆手：集市的人都说你手脚不干净，先去交赔礼钱。", "warn");
      return false;
    }
    return super.buyOffer(key);
  }
  arriveCaravan() {
    const ok = super.arriveCaravan();
    if (ok && this.th?.flags.routeLedger && this.o?.caravan?.offers) {
      for (const offer of this.o.caravan.offers) offer.price = Math.max(1, Math.round(offer.price * 0.8));
      this.toast("你翻过唐九的账本：这次的货按八折拿。", "gold");
    }
    return ok;
  }
  fences() {
    const m = this.s.minute;
    return [
      { id: "tang", name: "唐九（商队在的时候）", open: !!this.caravanHere?.() && this.s.region === "farm" },
      { id: "rat", name: "黑市“老鼠”的跑腿（18:00–23:00）", open: this.hasTalent("fence") && m >= 18 * 60 && m < 23 * 60 },
    ];
  }
  fenceRate() {
    return this.hasTalent("fence") ? 0.7 : 0.35;
  }
  fencePrice(id, n) {
    return Math.max(1, Math.round((ITEMS[id]?.sell || 1) * n * this.fenceRate()));
  }
  sellHot(id, fence) {
    const f = this.fences().find((x) => x.id === fence);
    if (!f?.open) {
      this.toast("现在找不到收赃的人。", "warn");
      return false;
    }
    if (this.th.market.banned && fence === "tang") {
      this.toast("唐九不收你的东西：集市的人都在传你。", "warn");
      return false;
    }
    const n = this.hotCount(id);
    if (n < 1 || !this.takeFarm({ [id]: n })) return false;
    let left = n;
    for (const h of this.th.hot)
      if (h.item === id && left > 0) {
        const k = Math.min(h.n, left);
        h.n -= k;
        left -= k;
      }
    this.th.hot = this.th.hot.filter((h) => h.n > 0);
    const money = this.fencePrice(id, n);
    this.s.money += money;
    this.toast("销赃：" + (ITEMS[id]?.name || id) + "×" + n + "，金币 +" + money + "。", "gold");
    return true;
  }
  junkCount() {
    return JUNK_IDS.reduce((n, id) => n + this.stockOf(id), 0);
  }
  junkTradeReason() {
    if (!this.resident?.("mechanic")) return "陈工还没来营地";
    if (this.junkCount() < JUNK_TRADE) return "要 " + JUNK_TRADE + " 件垃圾（有 " + this.junkCount() + "）";
    return "";
  }
  tradeJunk() {
    const why = this.junkTradeReason();
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    let left = JUNK_TRADE;
    const take = {};
    for (const id of [...JUNK_IDS].sort((a, b) => (ITEMS[a].sell || 0) - (ITEMS[b].sell || 0))) {
      const k = Math.min(left, this.stockOf(id));
      if (k > 0) take[id] = k;
      left -= k;
      if (!left) break;
    }
    if (!this.takeFarm(take)) return false;
    this.receive({ parts: 1 });
    this.toast("陈工把一堆零碎熔了，敲出 1 个机械零件。", "gold");
    return true;
  }
  donateReason() {
    if (this.th.donated) return "已经捐过一套了";
    if (!this.w?.museum?.built) return "档案馆分馆还没建";
    const lack = Object.entries(JUNK_SET).filter(([id, n]) => this.stockOf(id) < n);
    return lack.length ? "还缺：" + lack.map(([id, n]) => ITEMS[id].name + " " + (n - this.stockOf(id))).join("、") : "";
  }
  donateJunk() {
    const why = this.donateReason();
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    if (!this.takeFarm({ ...JUNK_SET })) return false;
    this.th.donated = true;
    this.addReputation(5);
    this.toast("苏砚把纽扣、票根和旧照片摆成了一个“旧日生活”展柜。营地声望 +5。", "gold");
    return true;
  }

  // ---------- 补救 ----------
  amends() {
    const th = this.th,
      out = [];
    for (const id of Object.keys(th.strike)) if (th.strike[id]) out.push({ id: "strike:" + id, text: this.targetName(id) + "在罢工", cost: { bread: 2 }, money: 0, label: "送 2 份干粮赔礼" });
    for (const [id, day] of Object.entries(th.leaving)) out.push({ id: "leave:" + id, text: this.personName(id) + "第 " + day + " 天要走", cost: null, money: 30, label: "塞 30 金币留住他" });
    if (th.market.banned) out.push({ id: "market", text: "集市不跟你做买卖", cost: null, money: 100, label: "交 100 金币赔礼钱" });
    if (th.flags.hemcAngry) out.push({ id: "hemc", text: "贺满仓不再垫付", cost: null, money: 50, label: "交 50 金币赔礼" });
    return out;
  }
  payAmends(id) {
    const a = this.amends().find((x) => x.id === id);
    if (!a) return false;
    if (a.money && this.s.money < a.money) {
      this.toast("要 " + a.money + " 金币。", "warn");
      return false;
    }
    if (a.cost && !this.takeFarm(a.cost)) {
      this.toast("东西不够。", "warn");
      return false;
    }
    if (a.money) this.s.money -= a.money;
    const th = this.th;
    if (id.startsWith("strike:")) {
      const k = id.slice(7);
      delete th.strike[k];
      th.caught[k] = 1;
    } else if (id.startsWith("leave:")) {
      const k = id.slice(6);
      delete th.leaving[k];
      th.caught["crew:" + k] = 1;
    } else if (id === "market") {
      th.market.banned = false;
      th.market.caught = 0;
    } else if (id === "hemc") delete th.flags.hemcAngry;
    this.toast("赔了礼：" + a.text.replace(/在罢工|不跟你做买卖|不再垫付|第 \d+ 天要走/, "") + "这事算过去了。", "gold");
    return true;
  }
  residentActive(r) {
    if (this.th && (this.th.strike[r.id] || this.th.strike["res:" + r.id])) return false;
    return super.residentActive(r);
  }
  // 罢工的援建队员不搬东西
  helperHour(h) {
    if (this.th?.strike["crew:" + h.id]) return;
    return super.helperHour(h);
  }
  advanceReason(type) {
    if (this.th?.flags.hemcAngry) return "贺满仓不再给你垫付：先在任务手记里赔礼";
    return super.advanceReason(type);
  }
  raidSize() {
    const n = super.raidSize();
    return this.th?.flags.raidCodes ? Math.max(2, Math.floor(n / 2)) : n;
  }
  finishRaid(won, auto = false, note = "") {
    const used = !!this.th?.flags.raidCodes;
    const ok = super.finishRaid(won, auto, note);
    if (used && this.th) {
      delete this.th.flags.raidCodes;
      this.olog("灰隼团的暗号用掉了：这一回一半人被你假传的命令叫走了。", "gold");
    }
    return ok;
  }
  hookFish() {
    const before = Object.fromEntries(["fish", "riverFish", "nightFish"].map((k) => [k, this.qty(k)]));
    const ok = super.hookFish();
    if (ok && this.th?.flags.fishDiary) {
      const id = Object.keys(before).find((k) => this.qty(k) > before[k]);
      if (id && this.canAdd({ [id]: 1 })) {
        this.add({ [id]: 1 });
        this.toast("照着江伯的鱼汛日记，又钓上来一条。", "gold");
      }
    }
    return ok;
  }

  // ---------- 每日抉择里的新动作 ----------
  applyOp(op, ctx, tier, roll = 0.5) {
    const [kind, a] = op,
      th = this.th;
    switch (kind) {
      case "sellTop":
        this._sellingTop = true;
        try {
          return super.applyOp(op, ctx, tier, roll);
        } finally {
          this._sellingTop = false;
        }
      case "rumor":
        return this.revealRumor() ? "听到一个传闻（写进了任务手记的“妙手”）" : "没打听到什么新鲜事";
      case "thiefXp":
        return "妙手经验 +" + this.thiefXp(a);
      case "confess": {
        const d = th.discovery;
        th.discovery = null;
        if (d) {
          th.sus[d.target] = Math.min(3, (th.sus[d.target] || 0) + 1);
          this.residentsMood?.(2);
        }
        return "你认了。大家看你的眼神变了，但心里的疙瘩解开了";
      }
      case "clearCase":
        th.discovery = null;
        return "谁也没找到，这事不了了之";
      case "blame":
        th.discovery = null;
        this.residentsMood?.(-8);
        return "一个队员替你背了锅，营地士气 −8";
      case "giveTreasure": {
        if (["taken", "given"].includes(th.treasures[a])) return "";
        th.treasures[a] = "given";
        const lines = [];
        this.applyTreasure(a, lines);
        return "阿豆输得心服口服，把「" + TREASURES[a].name + "」送给了你：" + lines.join(" ");
      }
    }
    return super.applyOp(op, ctx, tier, roll);
  }

  // 失窃案第二天一早就来，排在到期的连贯事件之后
  pickEvent(day) {
    const d = this.th?.discovery;
    if (d && d.day <= day && this.eventOk("T04") && !Object.values(this.dy.chains).some((c) => !c.mark && c.due !== null && c.due <= day)) return { id: "T04", chain: null };
    return super.pickEvent(day);
  }
  // 罢工的尤可不开机床
  latheRun() {
    if (this.th?.strike.youke) return 0;
    return super.latheRun();
  }

  // ---------- 每天 ----------
  workHour() {
    super.workHour();
    if (!this.th) return;
    const h = this.hour();
    if (h === 7) this.thiefMorning();
  }
  thiefMorning() {
    const th = this.th,
      day = this.s.day;
    if (!this.tOnce("morning:" + day)) return;
    if (this.hasTalent("irrigate")) {
      let n = 0;
      for (const p of this.s.plots)
        if ((p.region || "farm") === "farm" && p.crop && !this.plotWatered(p) && n < 3) {
          this.waterPlot(p);
          n++;
        }
    }
    if (this.hasTalent("upkeep"))
      for (const b of this.s.buildings) {
        const max = BUILDINGS[b.type]?.hp;
        if (max && b.hp > 0 && b.hp < max) b.hp = Math.min(max, b.hp + Math.ceil(max * 0.1));
      }
    if (this.jobHolder("medicJob")) {
      for (const r of this.c.residents) r.fatigue = clamp((r.fatigue || 0) - 15, 0, 100);
      this.s.player.hp = Math.min(100, this.s.player.hp + 10);
    }
    if (this.jobHolder("cookJob")) {
      const raw = ["potato", "radish"].find((id) => this.stockOf(id) >= 1);
      if (raw && this.takeFarm({ [raw]: 1 })) {
        this.putStorage({ bread: 2 });
        this.olog("炊事员把 1 份" + ITEMS[raw].name + "做成了 2 份干粮（已入仓）。");
      }
    }
    if (this.jobHolder("herdJob")) {
      if (this.c.animals?.chicken) this.c.animals.ready.egg = (this.c.animals.ready.egg || 0) + 1;
      else this.putStorage({ bean: 1 });
    }
    if (th.flags.grant && day % 7 === 0) {
      this.s.money += 60;
      this.toast("联盟按你偷看过的拨款单多拨了 60 金币。", "gold");
    }
    if (th.guilt && th.guilt <= day) {
      th.guilt = 0;
      this.s.player.stamina = Math.max(0, this.s.player.stamina - 20);
      this.toast("昨晚的事让你一夜没睡好：体力 −20。", "warn");
    }
    if (th.flags.pengNotice && th.flags.pengNotice <= day) {
      delete th.flags.pengNotice;
      if (this.fr?.peng) this.fr.peng.relation = clamp((this.fr.peng.relation || 0) - 2, -10, 10);
      this.toast("彭姐发现雨巷的仓库少了东西，看你的眼神冷了下来（关系 −2）。", "warn");
    }
  }
  onNewDay() {
    super.onNewDay();
    const th = this.th;
    if (!th) return;
    const day = this.s.day;
    for (const [id, d] of Object.entries(th.susDay)) if ((th.sus[id] || 0) > 0 && day - d >= 7) {
      th.sus[id] -= 1;
      th.susDay[id] = day;
      if (!th.sus[id]) delete th.sus[id];
    }
    for (const id of Object.keys(th.cool)) if (th.cool[id] <= day) delete th.cool[id];
    for (const id of Object.keys(th.tried)) if (th.tried[id] < day - 1) delete th.tried[id];
    th.hot = th.hot.filter((h) => h.until >= day && h.n > 0);
    if (th.discovery && th.discovery.day < day - 3) th.discovery = null;
    for (const [id, d] of Object.entries(th.leaving))
      if (d <= day) {
        delete th.leaving[id];
        const c = this.o?.crew.find((x) => x.id === id);
        if (c && this.dismissCrew?.(id)) {
          this.toast(c.name + "收拾东西走了：他受不了总被你偷。", "warn");
          this.olog(c.name + "离开了援建队。", "warn");
        }
      }
    if (this.th.pending && this.th.pending.day < day - 1) {
      // 拖了一天以上没了结：按装傻失败结算
      const p = th.pending;
      th.pending = null;
      th.sus[p.target] = Math.min(3, (th.sus[p.target] || 0) + 1);
      this.addReputation(-2);
    }
  }

  // ---------- 场景 ----------
  assignRegion() {
    super.assignRegion();
    const th = this.s.theft;
    if (!th || !this.s.skills) return;
    for (const ob of this.objects) {
      const t = this.targetOf(ob);
      if (t && /^[a-z]+$/.test(t.id) && TARGETS[t.id]) {
        th.seen[t.id] = 1;
        th.where[t.id] = { region: this.s.region, x: Math.round(ob.x), y: Math.round(ob.y) };
      }
    }
    if (this.hasTalent("pickpocket") && this.s.region === THIEF_SPOTS.dummy.region) this.objects.push({ type: "thiefDummy", name: "练习口袋的稻草人", x: THIEF_SPOTS.dummy.x, y: THIEF_SPOTS.dummy.y, icon: 40 });
    if (this.hasTalent("lockpick"))
      for (const id of Object.keys(BOXES))
        if (this.boxHere(id)) {
          const sp = this.boxSpot(id);
          if (sp) this.objects.push({ type: "thiefBox", box: id, name: BOXES[id].name, x: sp.x, y: sp.y, icon: 40 });
        }
    for (const st of th.stashes) if (st.region === this.s.region) this.objects.push({ type: "thiefStash", stash: st.id, name: st.label, x: st.x, y: st.y, icon: 40 });
  }
  context(ob) {
    if (this.th && !this.paused) {
      if (this.f?.crouch && this.hasTalent("pickpocket")) {
        const t = this.targetNear();
        if (t) return "下手 · " + t.def.name;
      }
      if (ob && THIEF_OBJECTS.includes(ob.type)) {
        if (ob.type === "thiefDummy") return "练习口袋的稻草人 · 练手";
        if (ob.type === "thiefBox") return ob.name + " · " + (this.boxReason(ob.box) || "撬锁");
        if (ob.type === "thiefStash") return ob.name + " · 打开";
      }
    }
    return super.context(ob);
  }
  interact() {
    if (this.paused) return;
    if (this.th) {
      if (this.f?.crouch && this.hasTalent("pickpocket")) {
        const t = this.targetNear();
        if (t) return this.emit("menu", { menu: "outpost", view: "stealPrep", id: t.id });
      }
      const ob = this._picked || this.nearestObject();
      if (ob && THIEF_OBJECTS.includes(ob.type) && dist(ob, this.s.player) < 100) {
        if (ob.type === "thiefDummy") {
          if (this.startPractice()) this.emit("menu", { menu: "outpost", view: "steal", id: "" });
          return;
        }
        if (ob.type === "thiefBox") {
          if (this.startBox(ob.box)) this.emit("menu", { menu: "outpost", view: "steal", id: "" });
          return;
        }
        if (ob.type === "thiefStash") return this.openStash(ob.stash);
      }
      // 废墟补给箱：嗅觉多 1 个零件，涂鸦暗号本多三成
      if (ob?.type === "crate" && RUINS.includes(this.s.region) && (this.hasTalent("nose") || this.th.flags.graffiti)) {
        const before = this.s.opened[ob.id]?.day,
          had = {};
        for (const id of Object.keys(ITEMS)) had[id] = this.stockOf(id);
        const r = super.interact();
        if (this.s.opened[ob.id]?.day === this.s.day && before !== this.s.day) {
          const bonus = {};
          if (this.th.flags.graffiti)
            for (const id of Object.keys(ITEMS)) {
              const got = this.stockOf(id) - had[id];
              if (got > 0 && !ITEMS[id].protected) bonus[id] = Math.max(1, Math.round(got * 0.3));
            }
          if (this.hasTalent("nose")) bonus.parts = (bonus.parts || 0) + 1;
          if (Object.keys(bonus).length) {
            this.receive(bonus);
            this.toast((this.th.flags.graffiti ? "照着墙上的记号" : "顺着气味") + "多翻出：" + itemsText(bonus), "gold");
          }
        }
        return r;
      }
    }
    return super.interact();
  }
  pickCandidates() {
    if (this.th && this.f?.crouch && this.hasTalent("pickpocket") && this.targetNear()) return [];
    return super.pickCandidates();
  }
  thiefPendingShow() {
    return !!this.th?.pending && !(this.steal && ["pick", "swing"].includes(this.steal.phase));
  }
  static parse(text) {
    const raw = JSON.parse(text),
      s = DailyEngine.parse(text);
    if (raw.skills !== undefined) validateSkills(raw.skills);
    if (raw.theft !== undefined) validateTheft(raw.theft);
    return migrateState(s);
  }
}

const has = (o, k) => typeof k === "string" && Object.hasOwn(o, k);
function validateSkills(x) {
  const object = (v) => v && typeof v === "object" && !Array.isArray(v),
    int = (v, max = 1e9) => Number.isInteger(v) && v >= 0 && v <= max,
    bad = () => {
      throw Error("技能存档异常，请从设置恢复有效备份；原存档会保留。");
    },
    d = skillDefaults();
  if (!object(x) || x.schema !== SKILL_SCHEMA || Object.keys(x).some((k) => !Object.hasOwn(d, k))) bad();
  if (x.talents !== undefined && (!Array.isArray(x.talents) || x.talents.length > Object.keys(TALENTS).length || !x.talents.every((t) => has(TALENTS, t)) || new Set(x.talents).size !== x.talents.length)) bad();
  if (x.talents) for (const t of x.talents) if (TALENTS[t].need && !x.talents.includes(TALENTS[t].need)) bad();
  if (x.respecDay !== undefined && !(Number.isInteger(x.respecDay) && x.respecDay >= -99 && x.respecDay <= 1e9)) bad();
  if (x.thiefXp !== undefined && !int(x.thiefXp, 1e7)) bad();
  if (x.jobs !== undefined && (!object(x.jobs) || Object.entries(x.jobs).some(([k, v]) => !has(JOBS, k) || typeof v !== "string" || v.length > 24))) bad();
}
function validateTheft(x) {
  const object = (v) => v && typeof v === "object" && !Array.isArray(v),
    int = (v, max = 1e9) => Number.isInteger(v) && v >= 0 && v <= max,
    str = (v, n = 60) => typeof v === "string" && v.length <= n,
    key = (k) => typeof k === "string" && k.length > 0 && k.length <= 32 && k !== "__proto__" && k !== "constructor" && k !== "prototype",
    intMap = (m, max = 1e9) => object(m) && Object.keys(m).length <= 200 && Object.entries(m).every(([k, v]) => key(k) && int(v, max)),
    bundle = (b) => object(b) && Object.entries(b).every(([k, v]) => has(ITEMS, k) && int(v, 99999)),
    bad = () => {
      throw Error("妙手存档异常，请从设置恢复有效备份；原存档会保留。");
    },
    d = theftDefaults();
  if (!object(x) || x.schema !== THEFT_SCHEMA || Object.keys(x).some((k) => !Object.hasOwn(d, k))) bad();
  if (x.seed !== undefined && !int(x.seed, 0xffffffff)) bad();
  if (x.taken !== undefined && (!object(x.taken) || Object.keys(x.taken).length > 200 || Object.entries(x.taken).some(([k, v]) => !key(k) || !object(v) || !int(v.w) || !Array.isArray(v.ids) || v.ids.length > 8 || !v.ids.every((i) => str(i, 60))))) bad();
  for (const m of ["tried", "cool", "susDay", "caught", "seen", "boxes", "planted", "leaving"]) if (x[m] !== undefined && !intMap(x[m])) bad();
  if (x.sus !== undefined && !intMap(x.sus, 3)) bad();
  if (x.treasures !== undefined && (!object(x.treasures) || Object.entries(x.treasures).some(([k, v]) => !has(TREASURES, k) || !["known", "taken", "lost", "given", "returned"].includes(v)))) bad();
  if (x.where !== undefined && (!object(x.where) || Object.entries(x.where).some(([k, v]) => !has(TARGETS, k) || !object(v) || !has(REGIONS, v.region) || !Number.isFinite(v.x) || !Number.isFinite(v.y)))) bad();
  if (x.hot !== undefined && (!Array.isArray(x.hot) || x.hot.length > 40 || x.hot.some((h) => !object(h) || !has(ITEMS, h.item) || !int(h.n, 99999) || !int(h.until)))) bad();
  const m = x.market;
  if (m !== undefined && (!object(m) || !int(m.caught ?? 0, 99) || typeof (m.banned ?? false) !== "boolean" || !int(m.priceUntil ?? 0))) bad();
  if (x.strike !== undefined && (!object(x.strike) || Object.entries(x.strike).some(([k, v]) => !key(k) || v !== true))) bad();
  if (x.stashes !== undefined && (!Array.isArray(x.stashes) || x.stashes.length > 4 || x.stashes.some((s) => !object(s) || !has(THIEF_SPOTS.stash, s.id) || !has(REGIONS, s.region) || !Number.isFinite(s.x) || !Number.isFinite(s.y) || !str(s.label, 30) || !bundle(s.items)))) bad();
  if (x.discovery !== undefined && x.discovery !== null && (!object(x.discovery) || !key(x.discovery.target) || !str(x.discovery.name, 30) || !int(x.discovery.day))) bad();
  const p = x.pending;
  if (p !== undefined && p !== null && (!object(p) || !key(p.target) || !str(p.name, 30) || !str(p.group, 12) || !int(p.day) || !str(p.reason, 60) || !(p.trust === null || p.trust === undefined || str(p.trust, 24)))) bad();
  if (x.flags !== undefined && (!object(x.flags) || Object.entries(x.flags).some(([k, v]) => !["routeLedger", "purchaseList", "raidCodes", "tunnel", "fishDiary", "graffiti", "grant", "hemcAngry", "pengNotice"].includes(k) || !(v === true || int(v))))) bad();
  for (const k of ["guilt", "practiced", "slipDay", "seedCount"]) if (x[k] !== undefined && !int(x[k])) bad();
  if (x.donated !== undefined && typeof x.donated !== "boolean") bad();
  if (x.claimed !== undefined && (!Array.isArray(x.claimed) || x.claimed.length > 400 || !x.claimed.every((c) => str(c, 80)) || new Set(x.claimed).size !== x.claimed.length)) bad();
  if (x.stats !== undefined && (!object(x.stats) || ["tries", "wins", "caught", "items"].some((k) => x.stats[k] !== undefined && !int(x.stats[k])))) bad();
}

export { TALENTS, TARGETS, TREASURES, TIERS, JOBS, MANUALS, BOXES };
