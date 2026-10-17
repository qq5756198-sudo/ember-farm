// v0.34.0「成长」：《爽点与耐玩体检方案》第三版。
// 1. 老手：技能上限 5 → 10 级。1–5 级照旧（本事、天赋门槛、技能点都按 1–5 级算）；6–10 级一级比一级慢，每级一样小本事，
//    只给方便和花样，不加伤害、不加血。升级是大事卡片；旧档的经验照算，第一帧一张卡片说补升到了几级。
// 2. 每样近战一个擅长的场合：消防斧劈重甲、劈储藏室的门；撬棍拿在手上撬锁着的柜子多翻一样、打中正要出手的就别开；
//    砍刀砍腿让奔跑者摔倒；钉子球棒打出血、流血的走不动；大锤砸松仓库守卫的甲；长矛在旧医院走廊里伸不开。
//    九样打法挑战，做成给一件纪念物，算进收复度。
// 3. 第二年的清单：六面墙各多两份更难的清单，第一批交满、到了第二年才开；一面墙的两份交满，那一处升二级（升过的换纪念物）。
// 新进度放在 s.grow，原来的字段不动。
import {
  Engine as HopeEngine,
  freshState as hopeFresh,
  migrateState as hopeMigrate,
  newGameState as hopeNewGame,
  newGamePlusState as hopeNewGamePlus,
  needsUpgrade as hopeNeedsUpgrade,
  legacyGear,
} from "./hope.js";
import { hashOf, rngOf } from "./undertow.js";
import { ITEMS, REGIONS, BUILDINGS } from "./data.js";
import { TRAITS } from "./expansion-data.js";
import { CARE } from "./garden-data.js";
import { MELEE, ARMOR, RULES } from "./gear-data.js";
import { CANDIDATES, KILL_DROPS, TIERS, TIER_ODDS, LOCKED_ODDS, PILE_ODDS, RARE_ODDS, ATTACHMENTS, EVENT_RULES, PRY } from "./undertow-data.js";
import { LISTS, LIST_IDS, WALL_LISTS, WALL_IDS, WALLS, GROUPS } from "./relight-data.js";
import { WALL2 } from "./hope-data.js";
import { decorItem, DECOR_BY_ID } from "./almanac-data.js";
import {
  GROW_SCHEMA,
  MASTER_XP,
  MASTER_TOP,
  PERKS,
  PERK_BY_ID,
  PERK_FX,
  SKILL_TITLES,
  WEAPON_FX,
  WEAPON_USE,
  CRAMPED_NOTE,
  CHALLENGES,
  CHALLENGE_IDS,
  RUIN_TRIPS,
  TRIP_BOXES,
  LISTS2,
  LIST2_IDS,
  LISTS2_START,
  WALL_KEEPSAKE,
  GROW_COMPLETION,
  INTRO_LINES,
} from "./grow-data.js";

export { legacyGear };
export const needsUpgrade = (text) => {
  if (hopeNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !raw.grow;
  } catch {
    return false;
  }
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + (n > 1 ? " ×" + n : ""))
    .join("、");
const SKILLS5 = Object.keys(MASTER_XP);
const STAT_KEYS = ["ups", "trips", "splits", "plates", "slows", "interrupts", "pried", "doors", "challenges", "lists2", "gifts", "perkWater", "perkTend", "perkExtra", "perkSeed", "perkDraw", "perkLoot", "perkClear", "perkCook", "perkWear"];
// 长矛、利器：说明后面加一句擅长的场合
for (const [id, text] of Object.entries(WEAPON_USE)) if (ITEMS[id] && !String(ITEMS[id].desc || "").includes("擅长：")) ITEMS[id].desc = (ITEMS[id].desc || "") + text;
if (REGIONS.hospital && !String(REGIONS.hospital.risk || "").includes(CRAMPED_NOTE)) REGIONS.hospital.risk = (REGIONS.hospital.risk || "") + " · " + CRAMPED_NOTE;

const grDefaults = () => ({
  schema: GROW_SCHEMA,
  // 已经说过的技能等级（null：还没对过，第一帧按现在的经验对一遍，不弹卡片）
  lv: null,
  // 打法挑战：做到几了、哪天做成
  ch: {},
  chDone: {},
  // 这一夜（长夜）亲手打倒的：砍刀几只、别的几只
  night: null,
  // 这一趟废墟：惊动过没有、身体栏空着没有、翻了几个柜子
  trip: null,
  // 第二年的清单：每格交了多少、哪天交满；哪面墙的两份都交满了（→ 哪天）
  l2: {},
  l2done: {},
  w2: {},
  // 撬棍拿在手上撬开的柜子（→ 哪天）；清场多亮的柜子（废墟 → 哪天）；说过一次的话
  pried: {},
  clear: {},
  told: {},
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
});

export function migrateState(s) {
  hopeMigrate(s);
  if (!s.grow) {
    s.grow = grDefaults();
    // 旧档：第一帧说一声这一版的变化（新开的档在下面删掉）
    s.grow.intro = { day: s.day || 1, told: false };
  } else {
    const d = grDefaults(),
      x = s.grow;
    s.grow = { ...d, ...x, stats: { ...d.stats, ...x.stats } };
  }
  return s;
}
const fresh = (s) => {
  delete s.grow;
  migrateState(s);
  delete s.grow.intro;
  return s;
};
export function freshState() {
  return fresh(hopeFresh());
}
export function newGameState(origin = "farmer") {
  return fresh(hopeNewGame(origin));
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  return fresh(hopeNewGamePlus(old, origin, keep, book));
}

export class Engine extends HopeEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this._grWear = 0;
    this._grPeek = new Map();
    this._grClearT = 0;
  }
  get gw() {
    return this.s.grow;
  }
  grStat(k, n = 1) {
    if (this.gw) this.gw.stats[k] = (this.gw.stats[k] || 0) + n;
  }
  grRoll(...parts) {
    return rngOf(hashOf(this.ut?.seed ?? 1, "grow", ...parts))();
  }
  grFloat(text, color = "#ffd76a") {
    if (this.zFloat) this.zFloat(text, color);
    else this.effects.push({ x: this.s.player.x, y: this.s.player.y - 60, text, t: 1, color });
  }

  // ================= 1. 老手 =================
  masterXp(skill) {
    return skill === "thief" ? this.sk?.thiefXp || 0 : this.s.xp?.[skill] || 0;
  }
  // 1–10 级（level() 照旧最多 5 级，原来的本事都按它算）
  masterLv(skill) {
    const base = this.level(skill);
    if (base < 5 || !MASTER_XP[skill]) return base;
    const x = this.masterXp(skill);
    let L = 5;
    for (const t of MASTER_XP[skill]) if (x >= t) L++;
    return Math.min(MASTER_TOP, L);
  }
  // 下一级还差多少（满级 0）；这一级从多少起
  masterNext(skill) {
    const L = this.masterLv(skill),
      x = this.masterXp(skill);
    if (L >= MASTER_TOP) return { lv: L, from: MASTER_XP[skill][4], to: MASTER_XP[skill][4], left: 0 };
    if (L < 5) {
      const per = skill === "thief" ? 60 : 40;
      return { lv: L, from: (L - 1) * per, to: L * per, left: L * per - x };
    }
    const from = L === 5 ? (skill === "thief" ? 240 : 160) : MASTER_XP[skill][L - 6],
      to = MASTER_XP[skill][L - 5];
    return { lv: L, from, to, left: Math.max(0, Math.ceil(to - x)) };
  }
  perk(id) {
    const P = PERK_BY_ID[id];
    return !!P && !!this.gw && this.masterLv(P.skill) >= P.lv;
  }
  masterUps() {
    return SKILLS5.reduce((a, k) => a + Math.max(0, this.masterLv(k) - 5), 0);
  }
  // 经验涨到了 6–10 级：一张卡片（一下涨了好几级就一张卡片写全）
  masterSweep() {
    const g = this.gw;
    if (!g || !g.lv) return;
    for (const k of SKILLS5) {
      const L = this.masterLv(k),
        was = g.lv[k] || 1;
      if (L <= was) continue;
      g.lv[k] = L;
      if (L <= 5) continue;
      const got = PERKS[k].filter((p) => p.lv > Math.max(5, was) && p.lv <= L);
      if (!got.length) continue;
      this.grStat("ups", got.length);
      const lines = got.map((p) => "「" + p.name + "」" + p.text);
      for (const p of got) if (p.decor) lines.push(this.grKeepsake(p.decor));
      this.moment("master", SKILL_TITLES[k] + " Lv." + L, lines.slice(0, 4), { icon: "master", skill: k, lv: L });
      this.emit("level");
      if (this.o) this.olog(SKILL_TITLES[k] + "升到 " + L + " 级：" + got.map((p) => p.name).join("、") + "。", "gold");
    }
  }
  // 第一帧：按现在的经验对一遍（旧档补升的几级写进“成长”卡片，不一级一级地弹）
  masterInit() {
    const g = this.gw;
    if (!g || g.lv) return [];
    g.lv = {};
    const ups = [];
    for (const k of SKILLS5) {
      const L = this.masterLv(k);
      g.lv[k] = L;
      if (L > 5) {
        ups.push(SKILL_TITLES[k] + "直接到了 Lv." + L);
        for (const p of PERKS[k]) if (p.decor && p.lv <= L) this.grKeepsake(p.decor);
      }
    }
    // 一句话写全：补升到了几级（每级的小本事在技能页）
    return ups.length ? ["攒下的经验照算：" + ups.join("、") + "（每级的小本事见技能页）"] : [];
  }
  xp(skill, n) {
    const out = super.xp(skill, n);
    if (skill !== "thief") this.masterSweep();
    return out;
  }
  thiefXp(n, cap) {
    const out = super.thiefXp(n, cap);
    this.masterSweep();
    return out;
  }
  // 纪念物：进背包，放不下进仓库
  grKeepsake(id) {
    const item = decorItem(id);
    if (!ITEMS[item]) return "";
    this.receive({ [item]: 1 });
    this.grStat("gifts");
    return "纪念物「" + ITEMS[item].name + "」：在建设里选「旧物摆件」摆出来";
  }

  // ---------- 农业 ----------
  toolPlot(p, id) {
    const g = this.gw,
      farm = g && p && !p.region && this.s.region === "farm",
      seed = ITEMS[id]?.type === "seed" && !p?.crop,
      had = seed ? this.qty(id) : 0;
    const ok = super.toolPlot(p, id);
    if (!ok || !farm || this.paused) return ok;
    // 顺手：浇水时旁边一块缺水的田也浇上（照样用壶里的水，不另外费体力）
    if (id === "water" && this.perk("agNeighbor")) {
      const q = this.s.plots
        .filter((x) => x !== p && x.crop && dist(x, p) <= PERK_FX.neighbor && !this.plotWatered(x) && !this.plotDebris?.(x))
        .sort((a, b) => dist(a, p) - dist(b, p))[0];
      const need = q ? this.waterNeed(q) : 0;
      if (q && this.c.water >= need) {
        this.c.water -= need;
        this.waterPlot(q);
        this.particlesAt(q.x, q.y, "#89c6d0", 10);
        this.grStat("perkWater");
      }
    }
    // 惜种：一成机会不费种子
    if (seed && p.crop && this.perk("agSeed") && this.grRoll("seed", this.s.day, p.id ?? p.x, this.s.stats.planted) < PERK_FX.seed && this.qty(id) < had) {
      this.s.inventory[id] = (this.s.inventory[id] || 0) + 1;
      this.grStat("perkSeed");
      this.effects.push({ x: p.x, y: p.y - 30, text: "种子没费", t: 0.9, color: "#cfe7a6" });
    }
    return ok;
  }
  waterNeed(p) {
    return TRAITS[p.trait]?.water || 1;
  }
  // 顺手：亲手照看一块，旁边一块今天还没照看的也一起照看（不另外费体力，不另说一行）
  tend(p) {
    const ok = super.tend(p);
    if (!ok || !this.gw || p?.region || this.s.region !== "farm" || !this.perk("agNeighbor")) return ok;
    const day = this.s.day,
      q = this.s.plots
        .filter((x) => x !== p && x.crop && !x.region && dist(x, p) <= PERK_FX.neighbor && this.isFarmPlot?.(x) && this.g?.plots?.[x.id]?.t !== day)
        .sort((a, b) => dist(a, p) - dist(b, p))[0];
    if (!q) return ok;
    const rec = this.gRec(q);
    rec.t = day;
    rec.c = Math.max(0, Math.min(CARE.cap, rec.c + CARE.tend));
    this.g.stats.tended++;
    this.particlesAt(q.x, q.y - 8, "#f2a7b5", 6);
    this.effects.push({ x: q.x, y: q.y - 30, text: "顺手照看", t: 0.9, color: "#f6c1cb" });
    this.grStat("perkTend");
    return ok;
  }
  harvest(p, worker = false) {
    const crop = p?.crop,
      count = this.s.stats.harvested;
    const ok = super.harvest(p, worker);
    // 手熟：亲手收获一成机会多收一份
    if (ok && !worker && crop && this.gw && this.perk("agExtra") && this.grRoll("harv", this.s.day, p.id ?? p.x, count) < PERK_FX.extra && ITEMS[crop]) {
      this.receive({ [crop]: 1 });
      this.grStat("perkExtra");
      this.effects.push({ x: p.x, y: p.y - 48, text: "多收一份", t: 1, color: "#ffd76a" });
    }
    return ok;
  }
  // 护苗：浇过水的菜，第二天忘了浇也照样长（和保水肥一样）
  plotWatered(p) {
    if (super.plotWatered(p)) return true;
    return !!(this.gw && p?.crop && !p.region && p.wateredDay > 0 && p.wateredDay >= this.s.day - 1 && this.perk("agGrace"));
  }
  wateredOn(p, d) {
    if (super.wateredOn(p, d)) return true;
    return !!(this.gw && p?.crop && !p.region && p.wateredDay > 0 && p.wateredDay >= d - 1 && this.perk("agGrace"));
  }

  // ---------- 制造 ----------
  processProduction(n) {
    if (!this.gw) return super.processProduction(n);
    const cook = this.perk("mfCook"),
      before = cook ? new Set(this.c.production.filter((j) => !j.ready).map((j) => j.id)) : null;
    super.processProduction(this.perk("mfQuick") ? n * PERK_FX.quick : n);
    if (!cook) return;
    // 巧手：吃的做好那一下，一成机会多一份
    for (const j of this.c.production) {
      if (!j.ready || !before.has(j.id)) continue;
      const main = Object.keys(j.out || {}).find((k) => ITEMS[k]?.type === "food");
      if (main && this.grRoll("cook", j.id) < PERK_FX.cook) {
        j.out[main] += 1;
        this.grStat("perkCook");
      }
    }
  }
  repairCost(id) {
    const c = super.repairCost(id);
    if (!c || !this.gw || !this.perk("mfThrift")) return c;
    return Object.fromEntries(Object.entries(c).map(([k, n]) => [k, Math.max(1, n - 1)]));
  }
  dismantleGear(id) {
    const def = MELEE[id] || ARMOR[id] || null,
      ok = super.dismantleGear(id);
    if (ok && this.gw && this.perk("mfStrip") && def?.scrap) {
      const top = Object.entries(def.scrap).sort((a, b) => b[1] - a[1])[0];
      if (top) {
        this.receive({ [top[0]]: 1 });
        this.effects.push({ x: this.s.player.x, y: this.s.player.y - 60, text: "拆得细：" + (ITEMS[top[0]]?.name || top[0]) + " +1", t: 1, color: "#cfe7a6" });
      }
    }
    return ok;
  }
  dismantle(id) {
    const b = this.s.buildings.find((x) => x.id === id),
      cost = b ? BUILDINGS[b.type]?.cost : null,
      ok = super.dismantle(id);
    if (ok && b && this.gw && this.perk("mfStrip")) {
      const top = Object.entries(cost || {}).filter(([k]) => ITEMS[k]).sort((a, c) => c[1] - a[1])[0];
      if (top) this.receive({ [top[0]]: 1 });
    }
    return ok;
  }
  // ---------- 探索 ----------
  grOdds(o) {
    if (o.ukind === "locked" || o.odds === "locked") return LOCKED_ODDS;
    if (o.odds === "pile") return PILE_ODDS;
    if (o.odds === "rare") return RARE_ODDS;
    return TIER_ODDS[Math.min(2, this.phase())];
  }
  rollContainer(o, day = this.s.day) {
    const res = super.rollContainer(o, day);
    if (!res || !this.gw || !o?.ukind || o.hpTier || o.rlDepth) return res;
    const r = rngOf(hashOf(this.ut?.seed ?? 1, "grBox", o.id, day)),
      hand = this.gw.pried[o.id] === day ? 1 : 0,
      more = this.perk("exDraw") && r() < PERK_FX.draw ? 1 : 0;
    if (!hand && !more) return res;
    if (more && this._grOpening) this.grStat("perkDraw");
    const odds = this.grOdds(o),
      bundle = { ...res.bundle };
    let tier = Math.max(0, TIERS.indexOf(res.tier));
    for (let i = 0; i < hand + more; i++) {
      const d = this.drawFrom(res.kind || "toolbox", odds, r);
      for (const [k, n] of Object.entries(d.bundle)) bundle[k] = (bundle[k] || 0) + n;
      tier = Math.max(tier, d.tier);
    }
    for (const k of Object.keys(bundle)) if (k.startsWith("bp_") || k === "flashlight" || ATTACHMENTS.includes(k)) bundle[k] = 1;
    return { ...res, bundle, tier: TIERS[tier], grMore: hand + more };
  }
  openContainer(o) {
    const day = this.s.day,
      was = this.s.opened[o?.id]?.day === day;
    let res;
    this._grOpening = true;
    try {
      res = super.openContainer(o);
    } finally {
      this._grOpening = false;
    }
    const now = this.s.opened[o?.id]?.day === day;
    if (!was && now && this.gw?.trip && this.gw.trip.region === this.s.region) this.gw.trip.boxes++;
    return res;
  }
  // 眼尖：走近看得出柜子今天有没有好东西（稀有以上）
  grPeek(o) {
    if (!o || o.type !== "crate" || !o.ukind || o.hpTier || o.rlDepth || !this.ut) return null;
    const day = this.s.day;
    if (this.s.opened[o.id]?.day === day) return null;
    if (!this.s.opened[o.id] && o.orig) return null;
    const key = o.id + ":" + day + ":" + (this.gw?.pried[o.id] === day ? 1 : 0);
    if (!this._grPeek.has(key)) {
      if (this._grPeek.size > 200) this._grPeek.clear();
      let tier = null;
      try {
        tier = this.rollContainer(o, day)?.tier || null;
      } catch {
        tier = null;
      }
      this._grPeek.set(key, tier);
    }
    return this._grPeek.get(key);
  }
  grStars() {
    if (!this.gw || !this.perk("exEye") || !this.ut || ["farm", "market"].includes(this.s.region)) return [];
    const p = this.s.player;
    return this.objects.filter((o) => o.type === "crate" && o.ukind && dist(o, p) <= PERK_FX.eye && ["rare", "precious"].includes(this.grPeek(o))).map((o) => ({ x: o.x, y: o.y, tier: this.grPeek(o) }));
  }
  reelTick(dt, held) {
    const R = this._reel,
      t0 = R ? R.tense : 0;
    super.reelTick(dt, held);
    // 稳手收线：线绷紧得慢一成五
    if (R && this._reel === R && held && R.tense > t0 && this.gw && this.perk("exReel")) R.tense = t0 + (R.tense - t0) * PERK_FX.reel;
  }
  travelBonus(n, to) {
    n = super.travelBonus(n, to);
    return this.gw && this.perk("exRoad") ? Math.max(1, n - PERK_FX.road) : n;
  }

  // ---------- 战斗 ----------
  dodgeCost() {
    const c = super.dodgeCost();
    return this.gw && this.perk("cbRoll") ? Math.max(1, c - PERK_FX.roll) : c;
  }
  wear(id, n = 1) {
    // 爱惜家伙：五下里有一下不掉耐久
    if (n > 0 && this.gw && (MELEE[id] || ARMOR[id]) && this.perk("cbCare")) {
      this._grWear = (this._grWear + 1) % 5;
      if (this._grWear === 0) {
        this.grStat("perkWear");
        return;
      }
    }
    return super.wear(id, n);
  }
  afterKill(e) {
    super.afterKill(e);
    // 摸尸：感染者身上翻到东西的机会多一半（单独再掷一次）
    const region = this.s.region;
    if (!this.gw || region === "farm" || e?.horde || !KILL_DROPS[e?.type] || !this.perk("cbLoot")) return;
    const got = {};
    KILL_DROPS[e.type].forEach(([chance, id, a, b], i) => {
      const r = this.grRoll("loot", e.id, i);
      if (r < chance * PERK_FX.loot) got[id] = (got[id] || 0) + a + Math.floor(this.grRoll("lootN", e.id, i) * (b - a + 1));
    });
    if (!Object.keys(got).length) return;
    this.grStat("perkLoot");
    if (!this.add(got, true)) {
      this.s.drops ??= [];
      this.s.drops.push({ region, x: Math.round(e.x), y: Math.round(e.y), items: got });
    }
  }
  // 清场：一片废墟的感染者打干净了，今天多亮一个柜子
  grClearTick() {
    const g = this.gw,
      region = this.s.region,
      day = this.s.day;
    if (!g || !CANDIDATES[region] || g.clear[region] === day || !this.perk("cbClear") || !this.ut) return;
    const all = this.enemies.filter((z) => !z.nest);
    if (!all.length || all.some((z) => !z.dead && !z.lying)) return;
    const lit = this.ut.lit?.[region];
    if (!lit || lit.day !== day) return;
    const more = CANDIDATES[region].find((c) => !c.orig && !lit.ids.includes(c.id) && this.s.opened[region + "-" + c.id]?.day !== day);
    g.clear[region] = day;
    if (!more) return;
    lit.ids.push(more.id);
    // 和进图时摆柜子一样摆这一个（不重摆别的）
    const q = this.freePoint(more.x, more.y),
      o = { type: "crate", id: region + "-" + more.id, x: q.x, y: q.y, loot: {}, name: more.name, icon: 40, elite: false, ukind: more.kind, cand: more.id, locked: more.kind === "locked" };
    if (!this.objects.some((x) => x.id === o.id)) this.objects.push(o);
    this.grStat("perkClear");
    this.effects.push({ x: o.x, y: o.y - 60, text: "清场：这个柜子也能翻", t: 2, color: "#ffd76a" });
    this.toast("这片打干净了：" + (more.name || "那边的柜子") + "也能翻了。", "gold");
  }

  // ---------- 妙手 ----------
  fenceRate() {
    return super.fenceRate() + (this.gw && this.perk("thFence") ? 0.1 : 0);
  }
  pocketsSeen() {
    return this.gw && this.perk("thLook") ? 2 : 1;
  }
  stealPick(i) {
    const ok = super.stealPick(i),
      st = this.steal;
    if (ok && st?.phase === "swing" && this.gw && this.perk("thQuick") && st.grWide !== st.picks) {
      st.grWide = st.picks;
      const w = Math.min(0.6, st.zone.w * 1.1),
        a = Math.max(0, Math.min(1 - w, st.zone.a - (w - st.zone.w) / 2));
      st.zone = { ...st.zone, w, a, a0: a };
    }
    return ok;
  }
  onNewDay() {
    super.onNewDay();
    // 沉得住气：怀疑每 5 天消一格（原来 7 天）
    const th = this.th;
    if (!th || !this.gw || !this.perk("thCalm")) return;
    const day = this.s.day;
    for (const [id, d] of Object.entries(th.susDay || {}))
      if ((th.sus[id] || 0) > 0 && day - d >= 5) {
        th.sus[id] -= 1;
        th.susDay[id] = day;
        if (!th.sus[id]) delete th.sus[id];
      }
  }

  // ================= 2. 武器的场合 =================
  // 大锤抡起来要一会儿：点下去过一小会儿才砸到（这一下里被抓住、摔倒、翻滚就砸空了）
  meleeSwing(target, id) {
    const F = WEAPON_FX[id];
    if (!F?.windup || !this.gw || !this.gr) return super.meleeSwing(target, id);
    if (!this.qty(id) || this.cooldown > 0 || this._grSwing) return false;
    const r = this.f?.route;
    if (r && !r.supplies?.[id]) {
      this.toast("本次远征只能使用装入行囊的武器。", "warn");
      return false;
    }
    const w = this.meleeStats(id),
      p = this.s.player,
      a = Math.atan2(target.y - (p.y - 20), target.x - p.x);
    p.facing = a;
    const tired = p.stamina < RULES.tired.below;
    this.cooldown = w.cd * (tired ? RULES.tired.mul : 1);
    this.actionAnim = 0.2 + F.windup;
    this.gx.swing = { t: 0.24 + F.windup, id, a };
    p.stamina = Math.max(0, p.stamina - w.stamina);
    this._grSwing = { t: F.windup, id, a };
    if (this.f) this.f.crouch = false;
    this.emit("swing");
    return true;
  }
  grSwingTick(dt) {
    const S = this._grSwing;
    if (!S) return;
    if (this.gx.grab || this.gx.down > 0 || this.fx?.roll || !this.qty(S.id)) {
      this._grSwing = null;
      return;
    }
    if (this.fx?.hitstop > 0) return;
    S.t -= dt;
    if (S.t > 0) return;
    this._grSwing = null;
    const w = this.meleeStats(S.id),
      p = this.s.player;
    this.noise.push({ x: p.x, y: p.y, r: w.noise, t: 1.8 });
    const targets = this.enemies
      .filter((z) => !z.dead && dist(z, p) < w.range + (z.nest ? 30 : 0) && (angDiff(Math.atan2(z.y - p.y, z.x - p.x), S.a) < w.arc || dist(z, p) < 26))
      .sort((x, y) => dist(x, p) - dist(y, p));
    let hits = 0,
      wearN = 0;
    for (const z of targets) {
      if (w.maxHits && hits >= w.maxHits) break;
      this.meleeHit(z, w, S.id, S.a);
      hits++;
      wearN = Math.max(wearN, z.type === "armor" && w.kind === "blade" ? 2 : 1);
    }
    if (hits) this.wear(S.id, wearN);
  }
  meleeStats(id) {
    const w = super.meleeStats(id);
    if (!w || !this.gr) return w;
    const F = WEAPON_FX[id];
    if (F?.cramped?.includes(this.s.region)) {
      w.range = Math.max(40, w.range - F.cut);
      w.cramped = true;
    }
    if (F?.bleed) w.bleed = Math.max(w.bleed || 0, F.bleed);
    return w;
  }
  hurtEnemy(e, damage, angle, meta = {}) {
    if (!this.gw || !this.gr || !e || e.dead || e.nest || e.type === "raider") return super.hurtEnemy(e, damage, angle, meta);
    const h0 = this._hit,
      id = h0?.id || null,
      F = id ? WEAPON_FX[id] : null;
    let h = h0;
    // 消防斧劈甲：打重甲正面也不减；劈开过甲的谁打都不减
    if (e.type === "armor" && h && h.kind !== "dot" && (e.split || (id === "axe" && F?.armorPierce))) h = { ...h, pierce: Math.max(h.pierce ?? 0.65, F?.armorPierce || 1) };
    // 撬棍一别：打中正要出手的就打断
    if (id === "crowbar" && F?.interrupt && h) h = { ...h, interrupt: true };
    const alive = !e.dead,
      wind = e.windup > 0,
      lunge = e.lunge?.phase || "",
      front = angDiff(angle + Math.PI, e.facing ?? 0) < 1.1;
    if (h !== h0) this._hit = h;
    let out;
    try {
      out = super.hurtEnemy(e, damage, angle, meta);
    } finally {
      this._hit = h0;
    }
    if (id === "crowbar" && wind && !(e.windup > 0)) this.grStat("interrupts");
    if (alive && !e.dead && h0 && h0.kind !== "dot") this.grAfterHit(e, id, F, damage, { lunge, front });
    if (alive && e.dead) this.grKill(e, h0, meta);
    return out;
  }
  grAfterHit(e, id, F, damage, at) {
    // 砍刀砍腿：奔跑者几成摔倒（扑过来时迎面一刀准摔）；游荡者血不到一半就可能摔成爬行者
    if (id === "machete" && F) {
      const chance = ["runner", "stalker"].includes(e.type) ? F.trip : ["slow", "faker"].includes(e.type) ? F.tripSlow || 0 : e.type === "armor" ? F.tripArmor || 0 : 0;
      if (chance > 0 && !e.crawl && (at.lunge === "leap" || at.lunge === "crouch" || Math.random() < chance)) {
        e.stunT = Math.max(e.stunT || 0, F.tripT);
        e.windup = 0;
        if (e.lunge && e.lunge.phase !== "stumble") e.lunge = { phase: "stumble", t: F.tripT };
        this.grStat("trips");
        this.effects.push({ x: e.x, y: e.y - 48, text: at.lunge === "leap" ? "迎面砍腿！" : "砍倒了", t: 0.8, color: "#e6c48a" });
      }
      if (!e.crawl && ["slow", "runner"].includes(e.type) && e.hp < e.maxHp * F.crawlBelow && e.hp >= e.maxHp * RULES.crawl.below && Math.random() < RULES.crawl.blade) this.grCrawl(e);
    }
    // 消防斧劈开重甲：之后谁打都不减，冲不起来
    if (id === "axe" && F?.split && e.type === "armor" && !e.split) {
      e.split = true;
      if (e.charge && e.charge.phase !== "stun") {
        e.charge = null;
        e.ccd = 2;
      }
      this.grStat("splits");
      this.grChallenge("axeSplit");
      this.effects.push({ x: e.x, y: e.y - 74, text: "甲劈开了！", t: 1, color: "#ffdb8c" });
      this.grTell("split", "重甲的甲劈开了：之后谁打它都不减，它也冲不起来了。");
    }
    // 钉子球棒放血：流血的走得慢一半
    if (id === "bat" && F?.slowBleed && e.bleedT > 0) {
      e.slowT = Math.max(e.slowT || 0, e.bleedT);
      e.grBat = true;
      this.grStat("slows");
    }
    // 大锤正面砸仓库守卫：甲片砸松
    if (id === "sledge" && F?.guardPlate && this.isGuard?.(e) && !e.g2 && at.front) {
      e.parts ??= { armor: 150, legs: 110, pack: 90 };
      if (e.parts.armor > 0) {
        e.parts.armor = Math.max(0, e.parts.armor - damage * F.guardPlate);
        this.grStat("plates");
        this.effects.push({ x: e.x, y: e.y - 100, text: e.parts.armor > 0 ? "甲片松了" : "甲片砸掉了！", t: 0.8, color: "#ffdb8c" });
        if (!e.parts.armor) this.grChallenge("sledgeGuard");
      }
    }
  }
  grCrawl(e) {
    e.crawl = true;
    e.windup = 0;
    e.lunge = null;
    e.reach = 0;
    e.cooldown = 1;
    if (this.gr) this.gr.stats.crawlers++;
    this.effects.push({ x: e.x, y: e.y - 40, text: "砍断了腿", t: 0.8, color: "#e6c48a" });
  }
  // 开了甲的重甲冲不起来
  updateCharge(e, dt) {
    if (e?.split && !e.charge) return false;
    return super.updateCharge(e, dt);
  }
  // 谁打倒的：打法挑战、长夜里亲手打倒的
  grKill(e, h0, meta) {
    const g = this.gw,
      hand = h0?.id || (!this._damageSource && meta?.id) || null;
    if (h0?.kind === "dot" && e.grBat) this.grChallenge("batBleed");
    if (meta?.id === "crossbow" && e.type === "screamer") this.grChallenge("bolt");
    if (g.night && this.ln?.night && hand && hand !== "stomp") {
      if (hand === "machete") g.night.blade++;
      else g.night.other++;
    }
  }
  // 撬棍拿在手上就用撬棍撬（多翻一样）
  pryTool() {
    if (this.gr?.slots.melee === "crowbar" && this.qty("crowbar") > 0) return "crowbar";
    return super.pryTool();
  }
  startPry(o) {
    // 消防斧劈储藏室的铁门
    if (o?.type === "uDoor" && this.gw && this.gr?.slots.melee === "axe" && this.qty("axe") > 0) {
      if (this.enemies.some((z) => !z.dead && !z.lying && z.state === "chase" && dist(z, this.s.player) < 160)) {
        this.toast("感染者就在旁边，先解决它们。", "warn");
        return false;
      }
      const R = EVENT_RULES.storeroom;
      this.ux.pry = { o, t: 0, max: WEAPON_FX.axe.door, silent: false, every: R.every || 1, noise: R.noise, tick: 0, x: this.s.player.x, y: this.s.player.y, door: true, grTool: "axe" };
      this.toast("抡起消防斧劈门（" + WEAPON_FX.axe.door + " 秒，半张图都听得见）。走开就停。", "warn");
      this.emit("pryStart");
      return true;
    }
    const ok = super.startPry(o);
    if (ok && this.ux.pry && !this.ux.pry.grTool) this.ux.pry.grTool = this.ux.pry.silent ? "pick" : this.gr?.slots.melee === "crowbar" ? "hand" : "crowbar";
    return ok;
  }
  tickPry(dt) {
    const P = this.ux?.pry;
    if (P && P.grTool === "hand" && !P.door && P.t + dt >= P.max && this.gw) this.gw.pried[P.o.id] = this.s.day;
    this._grDoor = P?.grTool || null;
    try {
      super.tickPry(dt);
    } finally {
      this._grDoor = null;
    }
    if (!P || this.ux.pry === P || !this.gw) return;
    const done = P.t >= P.max;
    if (!done) {
      if (this.gw.pried[P.o.id] === this.s.day && this.ut.pried[P.o.id] !== this.s.day) delete this.gw.pried[P.o.id];
      return;
    }
    if (P.grTool === "hand" && !P.door) {
      this.grStat("pried");
      this.grChallenge("crowbarPry");
    }
    if (P.grTool === "axe") this.grStat("doors");
  }
  // 消防斧劈开的门：提示里说“劈开了”
  openStoreroom(o) {
    if (this.ux?.pry?.grTool !== "axe" && this._grDoor !== "axe") return super.openStoreroom(o);
    const toast = this.toast,
      own = Object.prototype.hasOwnProperty.call(this, "toast");
    this.toast = (text, tone) => toast.call(this, String(text).replace("铁门撬开了", "铁门劈开了"), tone);
    try {
      return super.openStoreroom(o);
    } finally {
      if (own) this.toast = toast;
      else delete this.toast;
    }
  }
  context(o) {
    if (this.gw && !this.ux?.pry && o && !this.c?.fishing && !(this.pickCandidates?.().length >= 2 && !this._picked)) {
      if (o.type === "uDoor" && this.gr?.slots.melee === "axe" && this.qty("axe") > 0) return "劈开 · 储藏室的铁门（" + WEAPON_FX.axe.door + " 秒，半张图都听得见）";
      if (o.type === "crate" && o.ukind && o.locked && this.ut?.pried[o.id] !== this.s.day && this.s.opened[o.id]?.day !== this.s.day && this.pryTool() === "crowbar" && this.gr?.slots.melee === "crowbar") return "撬开 · " + o.name + "（" + PRY.time + " 秒，声音很响；撬棍在手上，多翻一样）";
      if (o.type === "crate" && o.ukind && this.perk("exEye") && ["rare", "precious"].includes(this.grPeek(o))) {
        const base = super.context(o);
        return base && !base.includes("今天搜过") ? base + " · 看着像有好东西" : base;
      }
    }
    return super.context(o);
  }
  // 拿起一样近战的第一次：说一句它擅长什么（记在成长的记录里，不占装备那边的提示格）
  grWeaponTip() {
    const g = this.gw,
      id = this.gr?.slots.melee;
    if (!id || !this.qty(id)) return;
    // 拿着长矛进了旧医院：当场说一次伸不开（说明里写着，到了地方再提一句）
    if (WEAPON_FX[id]?.cramped?.includes(this.s.region) && !g.told.cramped) this.grTell("cramped", "旧医院走廊窄、病床推车多，" + (ITEMS[id]?.name || "长矛") + "伸不开：够得近一截。换把短的更顺手。");
    if (!WEAPON_USE[id] || g.told[id]) return;
    g.told[id] = this.s.day;
    this.toast((ITEMS[id]?.name || id) + "——" + WEAPON_USE[id], "normal");
  }
  grTell(key, text) {
    const g = this.gw;
    if (!g || g.told[key]) return;
    g.told[key] = this.s.day;
    this.toast(text, "normal");
  }

  // ================= 打法挑战 =================
  chHave(id) {
    return Math.min(CHALLENGES[id]?.need || 0, this.gw?.ch[id] || 0);
  }
  chDone(id) {
    return !!this.gw?.chDone[id];
  }
  grChallenge(id, n = 1) {
    const g = this.gw,
      C = CHALLENGES[id];
    if (!g || !C || g.chDone[id]) return false;
    g.ch[id] = Math.min(C.need, (g.ch[id] || 0) + n);
    if (g.ch[id] < C.need) return false;
    g.chDone[id] = this.s.day;
    this.grStat("challenges");
    const keep = this.grKeepsake(C.decor);
    this.moment("challenge", "打法挑战 · " + C.name, [C.text, keep, "收复度 " + this.rlCompletion().pct + "%"], { icon: "challenge" });
    if (this.o) this.olog("打法挑战「" + C.name + "」做成了：" + C.text + "。", "gold");
    this.emit("quest");
    return true;
  }
  // 长夜：这一夜亲手打倒的；天亮时守住了、全是砍刀砍的、够 15 只，就算做成
  grNightTick() {
    const g = this.gw,
      N = this.ln?.night;
    if (N && !g.night) g.night = { day: this.s.day, blade: 0, other: 0 };
    if (!N && g.night) {
      const R = g.night;
      g.night = null;
      if (this.ln?.last?.held && R.other === 0 && R.blade >= CHALLENGES.nightBlade.min) this.grChallenge("nightBlade");
    }
  }
  // 一趟废墟：进去时记下，出来时（不是倒下被抬回来）看惊动过没有、身体栏空着没有
  grTripTick() {
    const g = this.gw,
      region = this.s.region,
      T = g.trip;
    if (T && T.region !== region) {
      g.trip = null;
      if (T.boxes >= TRIP_BOXES && !T.down) {
        if (T.quiet) this.grChallenge("quiet");
        if (T.light) this.grChallenge("light");
      }
      this.grStat("trips");
    }
    if (!g.trip && RUIN_TRIPS.includes(region) && this.gr) g.trip = { region, quiet: true, light: !this.gr.slots.body, boxes: 0, down: false };
    const t = g.trip;
    if (!t) return;
    if (t.light && this.gr?.slots.body) t.light = false;
    if (t.quiet && this.enemies.some((z) => !z.dead && !z.nest && z.state === "chase" && !z.horde)) t.quiet = false;
  }
  die() {
    if (this.gw?.trip) this.gw.trip.down = true;
    return super.die();
  }
  // 长矛顶住扑来的奔跑者：原来的规则里记了一次，就记到挑战上
  grCounterTick() {
    const g = this.gw,
      n = this.gr?.stats.counters || 0;
    if (g._counters == null) g._counters = n;
    if (n > g._counters) {
      const id = this.gr.slots.melee;
      if (["spear", "ironspear"].includes(id)) this.grChallenge("spearBrace", n - g._counters);
      g._counters = n;
    } else if (n < g._counters) g._counters = n;
  }

  // ================= 3. 第二年的清单 =================
  list2Open(id) {
    const L = LISTS2[id];
    return !!L && !!this.rl && this.s.day >= LISTS2_START && WALL_LISTS[L.wall].every((x) => this.listDone(x));
  }
  list2Done(id) {
    return !!this.gw?.l2done[id];
  }
  list2Got(id, key) {
    return this.gw?.l2[id]?.[key] || 0;
  }
  list2Progress(id) {
    const L = LISTS2[id];
    let have = 0,
      need = 0;
    for (const [key, n] of L.need) {
      need += n;
      have += Math.min(n, this.list2Got(id, key));
    }
    return { have, need };
  }
  list2Reason(id, key) {
    const L = LISTS2[id];
    if (!L || !L.need.some(([k]) => k === key)) return "没有这一格";
    if (!this.list2Open(id)) return this.s.day < LISTS2_START ? "第二年（第 " + LISTS2_START + " 天）起才开" : "先把「" + WALLS[L.wall].name + "」的第一批清单交满";
    if (!this.rlStationB()) return "先在农场建一座重建站";
    if (!this.rlStationHere()) return "到重建站跟前交";
    if (this.list2Done(id)) return "这份清单交满了";
    const n = L.need.find(([k]) => k === key)[1];
    if (this.list2Got(id, key) >= n) return "这一格交满了";
    if (this.listHave(key) < 1) return "手上和仓库里都没有";
    return "";
  }
  list2Deliver(id, key) {
    const why = this.list2Reason(id, key);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const L = LISTS2[id],
      n = L.need.find(([k]) => k === key)[1];
    let want = n - this.list2Got(id, key),
      gave = 0;
    for (const item of this.listAccepts(key)) {
      if (want <= 0) break;
      const t = this.rlTake(item, want);
      want -= t;
      gave += t;
    }
    if (!gave) return false;
    const rec = (this.gw.l2[id] ||= {});
    rec[key] = (rec[key] || 0) + gave;
    // 和第一批一样：一格一声章，重建站那一页上那一格闪一下（不进存档）
    this.events.push({ type: "stamp", list: id, key });
    this._zStamp = { list: id, key, at: Date.now() };
    const name = key.startsWith("@") ? GROUPS[key.slice(1)].name : ITEMS[key]?.name || key;
    const p = this.list2Progress(id);
    if (p.have >= p.need) this.list2Finish(id);
    // 这一行照手感的分档：只在头顶飘、页面开着就不进提示栏（交满一份才是大事卡片）
    else this.toast("交了" + name + " ×" + gave + "（「" + L.name + "」" + p.have + "/" + p.need + "）。", "gold");
    return true;
  }
  list2Finish(id) {
    const g = this.gw,
      L = LISTS2[id];
    if (!g || g.l2done[id]) return;
    g.l2done[id] = this.s.day;
    this.grStat("lists2");
    const got = this.rlGive(L.reward),
      w = L.wall,
      lines = [(got ? "回礼：" + got : "") || "交满了"];
    const both = LIST2_IDS.filter((x) => LISTS2[x].wall === w).every((x) => g.l2done[x]);
    if (both && !g.w2[w]) {
      g.w2[w] = this.s.day;
      if (this.hp && !this.wall2On(w)) {
        this.hp.wall2[w] = this.s.day;
        this.hpStat("wall2");
        lines.push("「" + WALLS[w].name + "」升到二级 · " + WALL2[w].name + "：" + WALL2[w].text);
      } else lines.push(this.grKeepsake(WALL_KEEPSAKE[w]));
    }
    lines.push("收复度 " + this.rlCompletion().pct + "%");
    this.moment("list2", "第二年的清单 · 「" + L.name + "」", lines.filter(Boolean).slice(0, 4), { icon: w });
    if (this.o) this.olog("第二年的清单「" + L.name + "」交满了" + (got ? "：" + got : "") + "。", "gold");
    this.emit("victory");
  }

  // 一面墙的第二年清单开了：说一声（每面墙一次）
  list2Tick() {
    const g = this.gw;
    if (!g || !this.rl || this.s.day < LISTS2_START) return;
    for (const w of WALL_IDS) {
      if (g.told["l2:" + w]) continue;
      const ids = LIST2_IDS.filter((id) => LISTS2[id].wall === w);
      if (!ids.some((id) => this.list2Open(id))) continue;
      g.told["l2:" + w] = this.s.day;
      this.toast("「" + WALLS[w].name + "」多了两份第二年的清单（重建站）：" + ids.map((id) => "「" + LISTS2[id].name + "」").join("、") + "。两份都交满，那一处升二级。", "gold");
    }
  }

  // ================= 收复度：多两项（重光的结尾只看原来那八项） =================
  rlCompletion() {
    const base = super.rlCompletion();
    if (this._grCore || !this.gw) return base;
    const have = { challenges: Object.keys(this.gw.chDone).length, lists2: Object.keys(this.gw.l2done).length };
    const parts = [...base.parts, ...GROW_COMPLETION.map((c) => ({ ...c, have: Math.min(c.max, have[c.id] || 0) }))];
    const got = parts.reduce((a, p) => a + p.have, 0),
      max = parts.reduce((a, p) => a + p.max, 0);
    return { parts, pct: Math.floor((got / max) * 1000) / 10, core: base.pct };
  }
  checkFinale() {
    const keep = this._grCore;
    this._grCore = true;
    try {
      return super.checkFinale();
    } finally {
      this._grCore = keep;
    }
  }

  // ================= 时间 =================
  update(dt, input = {}) {
    const out = super.update(dt, input);
    const g = this.gw;
    if (!g || this.paused) return out;
    // 旧档：第一帧一张“成长”卡片（补升的几级写在里面）
    if (!g.lv) {
      const lines = this.masterInit();
      if (g.intro && !g.intro.told) {
        g.intro.told = true;
        this.moment("intro", "成长", [...lines, ...INTRO_LINES].slice(0, 4));
      }
    } else if (g.intro && !g.intro.told) {
      g.intro.told = true;
      this.moment("intro", "成长", INTRO_LINES);
    }
    this.masterSweep();
    if (Number.isFinite(dt) && dt > 0) {
      this.grSwingTick(Math.min(dt, 0.05));
      this.grNightTick();
      this.grTripTick();
      this.grCounterTick();
      this.grWeaponTip();
      this._grClearT -= dt;
      if (this._grClearT <= 0) {
        this._grClearT = 0.5;
        this.grClearTick();
        this.list2Tick();
      }
    }
    return out;
  }
  advanceMinutes(n) {
    const out = super.advanceMinutes(n);
    if (this.gw?.lv) this.masterSweep();
    if (this.gw) {
      this.grNightTick();
      this.list2Tick();
    }
    return out;
  }

  // ================= 存档 =================
  static parse(text) {
    const s = HopeEngine.parse(text);
    migrateState(s);
    validateGrow(s);
    return s;
  }
}

function validateGrow(s) {
  const g = s.grow,
    bad = (why) => {
      throw new Error("存档里的成长记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
    };
  if (!g || typeof g !== "object") bad("缺少");
  const int = (v, lo = 0, hi = 1e9) => Number.isInteger(v) && v >= lo && v <= hi,
    obj = (v) => !!v && typeof v === "object" && !Array.isArray(v),
    days = (o, ok) => obj(o) && Object.keys(o).length <= 400 && Object.entries(o).every(([k, v]) => k.length <= 40 && (!ok || ok(k)) && int(v));
  if (!int(g.schema, 1, 99)) bad("版本");
  if (g.lv !== null && (!obj(g.lv) || Object.entries(g.lv).some(([k, v]) => !MASTER_XP[k] || !int(v, 1, MASTER_TOP)))) bad("等级");
  if (!obj(g.ch) || Object.entries(g.ch).some(([k, v]) => !CHALLENGES[k] || !int(v, 0, 9999))) bad("挑战");
  if (!days(g.chDone, (k) => !!CHALLENGES[k])) bad("挑战");
  if (g.night !== null && (!obj(g.night) || !int(g.night.day) || !int(g.night.blade, 0, 9999) || !int(g.night.other, 0, 9999))) bad("长夜");
  if (g.trip !== null && (!obj(g.trip) || !REGIONS[g.trip.region] || !int(g.trip.boxes, 0, 99) || ["quiet", "light", "down"].some((k) => typeof g.trip[k] !== "boolean"))) bad("这一趟");
  if (!obj(g.l2) || Object.entries(g.l2).some(([id, rec]) => !LISTS2[id] || !obj(rec) || Object.entries(rec).some(([k, v]) => !LISTS2[id].need.some(([x]) => x === k) || !int(v, 0, 999)))) bad("清单");
  if (!days(g.l2done, (k) => !!LISTS2[k])) bad("清单");
  if (!days(g.w2, (k) => WALL_IDS.includes(k))) bad("清单");
  if (!days(g.pried) || !days(g.clear, (k) => !!REGIONS[k]) || !days(g.told)) bad("记录");
  if (!obj(g.stats) || Object.values(g.stats).some((v) => !int(v))) bad("记录");
  if (g._counters !== undefined && !int(g._counters)) bad("记录");
  if (g.intro !== undefined && (!obj(g.intro) || !int(g.intro.day) || typeof g.intro.told !== "boolean")) bad("记录");
}
