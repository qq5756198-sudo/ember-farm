// v0.28.0「热闹」：营地设施体检与改造方案第三版。
// 1. 动静表：电台节目、电台指令、机床加急、食堂、节庆、拉响信标都攒动静；0 点结算，4 以上当夜来一小股感染者。
// 2. 电台指令：侦察、空投、呼叫商队、求援，花电和动静，各有冷却。
// 3. 红薯跑商：装最多 20 件货去集市、地区或边境卖，带回零件、布、电路；路上可能被截，跟车就不会。
// 4. 设施改良二选一：瞭望塔、陷阱、围栏和大门、喷灌头、篝火灶、雨水桶，每类一条路线。
// 5. 伤员和医务室；舒适度和「休息好」；生活水准第 3 级要一间舒适的房间；阅览室当学习室。
// 6. 食堂在广场上走着端菜上菜；节庆自己挑供品；档案馆「往事」一柜；江伯的鱼汛；麦穗巡夜；商队卖改良图纸。
// 新进度放在 s.bustle，原来的字段不动（电台原来的动静并进动静表）。
import {
  Engine as BountyEngine,
  freshState as bountyFresh,
  migrateState as bountyMigrate,
  newGameState as bountyNewGame,
  newGamePlusState as bountyNewGamePlus,
  needsUpgrade as bountyNeedsUpgrade,
  legacyGear,
} from "./bounty.js";
import { hashOf, rngOf } from "./undertow.js";
import { ITEMS, BUILDINGS, ZOMBIES, WORLD, REGIONS, CROPS } from "./data.js";
import { HORDE_DIRECTIONS, TECH } from "./expansion-data.js";
import { DISTRICTS } from "./district-data.js";
import { BMAPS } from "./beyond-data.js";
import { TASTES, GUEST_NAMES, CANTEEN_PATIENCE, CANTEEN_GAP, CANTEEN_HOURS, SSPOTS, FEST_COST } from "./seasons-data.js";
import { VISITOR_LOOKS } from "./outpost-data.js";
import { CACHE_SPOTS } from "./daily.js";
import { PROWL, BOSSES } from "./undertow-data.js";
import { TRAP_ALL, CARD_TYPES } from "./tidy-data.js";
import { missingCost } from "./alliance-data.js";
import {
  BUSTLE_SCHEMA,
  NOISE,
  NOISE_SRC,
  RADIO_CMDS,
  RADIO_CMD_IDS,
  DROP,
  DROP_TABLE,
  ALLY,
  MULE,
  MULE_DESTS,
  UPGRADES,
  UP_CLASSES,
  upClassOf,
  UP_PAPER,
  INJURY,
  COMFORT,
  COMFORT_CATS,
  STUDY_ROOM,
  DINING_ROOM,
  CANTEEN2,
  FEST_PICK,
  PAST,
  FISH_RUN,
  DOG_PATROL,
  PATROL_PATH,
} from "./bustle-data.js";

export { legacyGear };
// 读进来之前原样留一份：v0.27 及更早的存档（没有热闹的记录）也算
export const needsUpgrade = (text) => {
  if (bountyNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !raw.bustle;
  } catch {
    return false;
  }
};
// 设施卡：药柜、往事陈列柜按 E 也打开自己的一页
for (const t of ["medCabinet", "hnKeepsake"]) if (!CARD_TYPES.includes(t)) CARD_TYPES.push(t);

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const round1 = (v) => Math.round(v * 10) / 10;
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " " + n)
    .join("、");
const STAT_KEYS = ["attacks", "autoAttacks", "cmds", "trips", "robbed", "escorted", "injuries", "healed", "served", "upgrades", "barks", "patrols", "fishRuns"];
const FIGHT_KEYS = ["r:", "c:"];
const PLAZA = SSPOTS.plaza;

const bustleDefaults = () => ({
  schema: BUSTLE_SCHEMA,
  // 动静：v 现在多少；log 今天哪些事攒的（0 点结算后清掉）；last 上一次结算
  noise: { v: 0, day: 0, log: [], last: null },
  // 动静招来的夜袭：state "" | live | done
  // guards：0 点前排了守卫岗、吃过晚饭的人（0 点会把“吃过饭”清掉，他们照样守到这一仗打完）
  attack: { day: 0, n: 0, dir: 0, state: "", report: "", guards: [] },
  // 电台指令：哪天能再发；侦察到的消息
  cmd: { scout: 0, drop: 0, caravan: 0, help: 0 },
  scout: { day: 0, text: "" },
  drop: null,
  help: { armed: false, day: 0, live: false, allies: [] },
  // 红薯跑商：在路上的这一趟、下一趟哪天能走、装车单、前几趟的账
  mule: { trip: null, next: 0, plan: { dest: "market", back: "money", load: {} }, log: [] },
  // 设施改良：每类选了哪条路线（每座的改良记在建筑上：b.hnUp）
  up: {},
  // 伤员：key "r:居民" / "c:队员" → {at, until, care, name}；hurtNight 一晚每人最多伤一次
  hurt: {},
  hurtNight: {},
  rested: { until: 0, comfort: 0 },
  fest: { day: 0, pick: [] },
  past: { pick: "" },
  fish: { since: 0 },
  carry: null,
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
});

export function migrateState(s) {
  bountyMigrate(s);
  if (!s.bustle) {
    s.bustle = bustleDefaults();
    // 旧档：电台原来自己攒的动静并进动静表；进游戏时说一声这一版的变化（新开的档在下面删掉）
    const radio = s.winter?.radio;
    if (radio && radio.noise > 0) {
      s.bustle.noise.v = round1(Math.min(NOISE.max, radio.noise));
      s.bustle.noise.log = [{ src: "radio", n: s.bustle.noise.v, t: 0 }];
      radio.noise = 0;
    }
    if (s.seasons?.jiang?.phase === "done") s.bustle.fish.since = s.day || 1;
    s.bustle.intro = { day: s.day || 1, told: false };
  } else {
    const d = bustleDefaults(),
      x = s.bustle;
    s.bustle = {
      ...d,
      ...x,
      noise: { ...d.noise, ...x.noise, log: (x.noise?.log || []).map((r) => ({ ...r })), last: x.noise?.last ? { ...x.noise.last } : null },
      attack: { ...d.attack, ...x.attack, guards: [...(x.attack?.guards || [])] },
      cmd: { ...d.cmd, ...x.cmd },
      scout: { ...d.scout, ...x.scout },
      drop: x.drop ? { ...x.drop, items: { ...x.drop.items } } : null,
      help: { ...d.help, ...x.help, allies: (x.help?.allies || []).map((a) => ({ ...a })) },
      mule: {
        ...d.mule,
        ...x.mule,
        trip: x.mule?.trip ? { ...x.mule.trip, load: { ...x.mule.trip.load }, foes: [...(x.mule.trip.foes || [])] } : null,
        plan: { ...d.mule.plan, ...x.mule?.plan, load: { ...(x.mule?.plan?.load || {}) } },
        log: (x.mule?.log || []).map((r) => ({ ...r, got: { ...(r.got || {}) } })),
      },
      up: { ...x.up },
      hurt: Object.fromEntries(Object.entries(x.hurt || {}).map(([k, v]) => [k, { ...v }])),
      hurtNight: { ...x.hurtNight },
      rested: { ...d.rested, ...x.rested },
      fest: { ...d.fest, ...x.fest, pick: [...(x.fest?.pick || [])] },
      past: { ...d.past, ...x.past },
      fish: { ...d.fish, ...x.fish },
      carry: x.carry ? { ...x.carry } : null,
      stats: { ...d.stats, ...x.stats },
    };
    if (x.intro) s.bustle.intro = { ...x.intro };
  }
  return s;
}
const fresh = (s) => {
  delete s.bustle;
  migrateState(s);
  delete s.bustle.intro;
  return s;
};
export function freshState() {
  return fresh(bountyFresh());
}
export function newGameState(origin = "farmer") {
  return fresh(bountyNewGame(origin));
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  return fresh(bountyNewGamePlus(old, origin, keep, book));
}

export class Engine extends BountyEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this.syncKeepsake();
  }
  get hn() {
    return this.s.bustle;
  }
  hnRoll(...key) {
    return rngOf(hashOf(this.ut?.seed || 1, "hn", ...key))();
  }
  hnStat(k, n = 1) {
    this.hn.stats[k] = Math.min(1e9, (this.hn.stats[k] || 0) + n);
  }

  // ================= 动静 =================
  noiseAdd(n, src) {
    const z = this.hn?.noise;
    if (!z || !(n > 0)) return 0;
    z.v = round1(Math.min(NOISE.max, z.v + n));
    z.log = [{ src, n: round1(n), t: Math.floor(this.s.minute) }, ...z.log].slice(0, NOISE.log);
    return n;
  }
  noiseTier(v = this.hn?.noise.v || 0) {
    return NOISE.tiers.find((t) => v >= t.at) || null;
  }
  // 长夜、尸潮、灰隼团那一晚不另来
  noiseBlocked() {
    return !!this.ln?.night || !!this.lnPending?.() || ["warning", "active"].includes(this.s.horde.phase) || ["warning", "active"].includes(this.raidState?.().phase);
  }
  noiseDir(day) {
    return Math.floor(this.hnRoll("ndir", day) * HORDE_DIRECTIONS.length) % HORDE_DIRECTIONS.length;
  }
  noiseWhy() {
    const by = {};
    for (const r of this.hn.noise.log) by[r.src] = round1((by[r.src] || 0) + r.n);
    return Object.entries(by)
      .sort((a, b) => b[1] - a[1])
      .map(([k, n]) => (NOISE_SRC[k] || k) + " +" + n)
      .join("、");
  }
  // 0 点结算：4 以上当夜来；来过一场清零，没来就减半
  noiseSettle(guards = []) {
    const z = this.hn.noise,
      v = z.v,
      tier = this.noiseTier(v),
      why = this.noiseWhy();
    z.day = this.s.day;
    if (tier && !this.noiseBlocked()) {
      z.last = { day: this.s.day, v, n: tier.n };
      this.noiseAttack(tier, v, why, guards);
      z.v = 0;
    } else {
      z.last = { day: this.s.day, v, n: 0 };
      z.v = Math.floor((v / 2) * 10) / 10;
    }
    z.log = [];
  }
  noiseAttack(tier, v, why, guards = []) {
    const a = this.hn.attack,
      day = this.s.day;
    Object.assign(a, { day, n: tier.n, spit: tier.spit, dir: this.noiseDir(day), state: "", report: "", guards: guards.filter((id) => this.c.residents.some((r) => r.id === id)).slice(0, 8) });
    a.why = "营地动静 " + v + (why ? "（" + why + "）" : "");
    this.hnStat("attacks");
    if (this.s.region === "farm" && !this._btSleep) return this.noiseSpawn();
    this.noiseAuto();
  }
  noiseSpawn() {
    const a = this.hn.attack,
      day = this.s.day,
      late = (this.phaseAt?.(day) || 0) >= 2,
      dir = HORDE_DIRECTIONS[a.dir] || HORDE_DIRECTIONS[0];
    for (let i = 0; i < a.n; i++) {
      const type = a.spit && i === 0 ? (late ? "spitter" : "armor") : late && i % 4 === 3 ? "armor" : i % 2 ? "runner" : "slow";
      const pt = dir.spawns[i % 2],
        q = this.freePoint?.(clamp(pt[0] + ((i * 37) % 60) - 30, 80, WORLD.w - 80), clamp(pt[1] + ((i * 53) % 60) - 30, 90, WORLD.h - 90)) || { x: pt[0], y: pt[1] },
        z = this.enemy(type, q.x, q.y, false);
      Object.assign(z, { hnNoise: true, state: "chase", alert: 8 });
      this.enemies.push(z);
    }
    // 守卫跟尸潮时一样上岗（0 点前吃过晚饭的那几个）
    a.state = "live";
    for (const r of this.nightGuards()) r.workRole = "guard";
    this.twinStaff();
    const text = "动静把感染者引来了：" + a.n + " 只从" + dir.name + "过来（" + a.why + "）。";
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
    this.emit("alarm");
  }
  // 你睡着或不在：守卫、有人守的塔、麦穗、围栏、灯各挡一只；剩下的撞围栏，没围栏就摸进营地（两成机会伤一个人）
  noiseAuto() {
    const a = this.hn.attack;
    const guards = this.nightGuards().length,
      towers = Math.min(guards, this.s.buildings.filter((b) => b.type === "tower" && b.hp > 0).length),
      dog = this.dogHome() ? 1 : 0,
      fences = this.s.buildings.filter((b) => ["fence", "gate"].includes(b.type) && b.hp > 0).length >= 6 ? 1 : 0,
      lights = this.fieldLights().length ? 1 : 0;
    const stopped = Math.min(a.n, guards + towers + dog + fences + lights),
      left = a.n - stopped;
    let broke = 0;
    const hurt = [];
    for (let i = 0; i < left; i++) {
      const wall = this.s.buildings.filter((b) => ["fence", "gate"].includes(b.type) && b.hp > 0 && !b.open).sort((p, q) => p.hp - q.hp)[0];
      if (wall) {
        const dmg = 40 * (wall.hnUp === "iron" ? UPGRADES.fence.paths.iron.take : 1);
        wall.hp = Math.max(0, Math.round(wall.hp - dmg));
        broke++;
        continue;
      }
      const list = this.c.residents.filter((r) => !this.isHurt("r:" + r.id));
      if (!list.length) continue;
      if (this.hnRoll("nhurt", a.day, i) < INJURY.chance) {
        const r = list[Math.floor(this.hnRoll("nwho", a.day, i) * list.length) % list.length];
        if (this.injure("r:" + r.id, this.residentName(r.id), "夜里摸进营地的感染者")) hurt.push(this.residentName(r.id));
      }
    }
    if (broke) this.navRevision++;
    a.state = "done";
    a.guards = [];
    this.hnStat("autoAttacks");
    const bits = [guards ? "守卫" : "", towers ? "瞭望塔" : "", dog ? "麦穗" : "", fences ? "围栏" : "", lights ? "灯" : ""].filter(Boolean);
    a.report =
      "夜里 " +
      a.n +
      " 只感染者循着动静摸来（" +
      a.why +
      "）：" +
      (stopped ? bits.join("、") + "挡住了 " + stopped + " 只" : "没人挡") +
      (left ? "，" + (broke ? broke + " 只撞在围栏上" : "") + (hurt.length ? (broke ? "，" : "") + hurt.join("、") + "受了伤" : "") + (!broke && !hurt.length ? "剩下的转了一圈走了" : "") + "。" : "，营地没事。");
    if (this.o) this.olog(a.report, broke || hurt.length ? "warn" : "normal");
  }
  noiseAlive() {
    return (this.s.enemies.farm || []).filter((z) => z.hnNoise && !z.dead);
  }
  noiseDawn() {
    const a = this.hn.attack;
    if (a.state !== "live") return;
    for (const z of this.noiseAlive()) {
      z.dead = true;
      z.fled = true;
    }
    a.state = "done";
    this.noiseStandDown();
    a.report = "天亮了，循着动静来的感染者退回了林子。";
    if (this.o) this.olog(a.report);
  }
  // 循声来袭的这一夜能上岗的守卫：0 点前排了守卫岗、吃过晚饭（0 点会把“吃过饭”清掉）、有床、不太累、没躺下、没闹情绪
  nightGuards() {
    const a = this.hn?.attack,
      ids = a?.guards || [],
      cap = this.residentsCapacity();
    return this.c.residents.filter((r, i) => ids.includes(r.id) && i < cap && r.role !== "rest" && (r.fatigue || 0) < 85 && !this.striking?.(r) && !this.laidUp("r:" + r.id));
  }
  // 打完或天亮：守了半夜的人回去睡觉，早上照常吃早饭
  noiseStandDown() {
    const a = this.hn.attack;
    for (const r of this.c.residents) if (a.guards.includes(r.id) && r.workRole === "guard" && !(this.s.minute >= 360 && this.s.minute < 1320)) r.workRole = "rest";
    a.guards = [];
  }
  // 电台节目的动静并进动静表：原来电台自己攒满 4 引尸群的规矩不用了
  airProgram() {
    const r = this.w?.radio;
    if (!this.hn || !r) return super.airProgram();
    const kept = r.noise || 0;
    r.noise = 0;
    const ok = super.airProgram();
    const added = r.noise || 0;
    r.noise = 0;
    if (kept > 0) this.noiseAdd(kept, "radio");
    if (ok && added > 0) this.noiseAdd(added, "radio");
    return ok;
  }
  radioHorde() {
    if (this.hn) return;
    return super.radioHorde();
  }
  latheRush() {
    const ok = super.latheRush();
    if (ok && this.hn) this.noiseAdd(NOISE.rush, "rush");
    return ok;
  }
  pullLure(id) {
    const ok = super.pullLure(id);
    if (ok && this.hn) this.noiseAdd(NOISE.lure, "lure");
    return ok;
  }

  // ================= 电台指令 =================
  cmdLeft(id) {
    return Math.max(0, (this.hn?.cmd[id] || 0) - this.s.day);
  }
  cmdReason(id) {
    const c = RADIO_CMDS[id];
    if (!c || !this.hn) return "没有这条指令";
    if (!this.r?.radio) return "电台还没修好";
    if (this.s.region !== "farm") return "回到农场的通信站再发";
    if (this.cmdLeft(id) > 0) return "第 " + this.hn.cmd[id] + " 天才能再发";
    if ((this.c.energy || 0) < c.power) return "电不够（要 " + c.power + "，营地有 " + Math.floor(this.c.energy || 0) + "）";
    if (id === "drop") {
      const d = this.hn.drop;
      if (d && !d.opened && d.until >= this.s.day) return "上一箱还在" + this.regionName(d.region) + "，先去拿";
      if (!this.dropRegions().length) return "还没有能去的废墟";
    }
    if (id === "caravan") {
      const cv = this.o?.caravan;
      if (!cv) return "还没有商队";
      if (this.caravanHere?.()) return "唐九今天就在";
      if (!cv.next) return "唐九还没开始走这条路";
      if (cv.next <= this.s.day + 1) return "唐九明天本来就来";
    }
    if (id === "help" && (this.hn.help.armed || this.hn.help.live)) return "邻居已经答应来了";
    return "";
  }
  radioCmd(id) {
    const reason = this.cmdReason(id);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const c = RADIO_CMDS[id],
      day = this.s.day;
    this.c.energy = Math.max(0, (this.c.energy || 0) - c.power);
    this.noiseAdd(c.noise, id);
    this.hn.cmd[id] = day + c.cd;
    this.hnStat("cmds");
    let text = "";
    if (id === "scout") {
      text = this.scoutText();
      this.hn.scout = { day, text };
      text = "侦察回话：" + text;
    } else if (id === "drop") {
      const d = this.placeDrop();
      text = "空投：一箱物资今天落在" + this.regionName(d.region) + "（" + itemsText(d.items) + "）。4 个钟点里去拿最稳，去晚了箱子边会围上感染者；第 " + d.until + " 天以后就没了。";
    } else if (id === "caravan") {
      this.o.caravan.next = day + 1;
      text = "唐九在电台里应了一声：明天 08:00 就到。";
    } else if (id === "help") {
      Object.assign(this.hn.help, { armed: true, day, live: false, allies: [] });
      text = "雨巷的" + this.allyNames().join("、") + "答应了：下一场长夜或尸潮，他们来帮你守。";
    }
    this.toast(text + "（电 −" + c.power + "，动静 +" + c.noise + "）", "gold");
    if (this.o) this.olog(text, "gold");
    return true;
  }
  regionName(id) {
    return REGIONS[id]?.name || id;
  }
  // 侦察：今晚有什么要来（都从现在的游戏状态算出来，读档不变）
  scoutText() {
    const day = this.s.day,
      out = [];
    if (this.ln?.night || this.lnPending?.()) {
      const dirs = this.lnDirs(day).slice(0, 3).map((k) => HORDE_DIRECTIONS[k].name),
        n = this.ln.night?.n || (this.ln.tried || 0) + 1,
        boss = BOSSES[this.lnBossId(n)]?.name || "头目";
      out.push("今晚是长夜：三波先后从" + [...new Set(dirs)].join("、") + "来，03:00 " + boss + "从" + dirs[0] + "来");
    } else if (this.ln?.storyDay) {
      const next = this.nextLongNight?.(day + 1);
      if (next && next - day <= 3) out.push("第 " + next + " 天是长夜");
    }
    if (["warning", "active"].includes(this.s.horde.phase) || (this.c.nextHordeDay && this.c.nextHordeDay - day <= 1)) {
      const h = this.hordeIntel();
      out.push("尸潮" + (this.c.nextHordeDay > day ? "第 " + this.c.nextHordeDay + " 天" : "就在眼前") + "从" + h.direction.name + "来，约 " + h.count + " 只");
    }
    const t = this.noiseTier();
    if (t && !this.noiseBlocked()) out.push("营地动静 " + this.hn.noise.v + "：今夜 0 点会有 " + t.n + " 只从" + HORDE_DIRECTIONS[this.noiseDir(day + 1)].name + "摸来");
    if (this.bt?.raid.state === "warned" && this.bt.raid.day === day) out.push("01:00 有 " + this.bt.raid.n + " 只来踩菜地");
    const u = this.ut;
    if (u?.seed && (this.phaseAt?.(day) || 0) >= PROWL.phase && !this.decree?.("curfew") && rngOf(hashOf(u.seed, "prowl", day))() < PROWL.chance)
      out.push("夜行者今晚会摸到农场东边" + (this.patrolOn() ? "（麦穗巡夜，进不来）" : ""));
    const rs = this.raidState?.();
    if (rs?.phase === "scheduled") out.push("灰隼团第 " + rs.day + " 天傍晚从东边来");
    else if (["warning", "active"].includes(rs?.phase)) out.push("灰隼团就在路上，从东边来");
    return out.length ? out.join("；") + "。" : "今晚四周都安静，没有要来的。";
  }
  dropRegions() {
    return (this.openRuins?.() || ["residential"]).filter((r) => CACHE_SPOTS[r] && r !== "market");
  }
  placeDrop() {
    const regs = this.dropRegions(),
      day = this.s.day,
      region = regs[Math.floor(this.hnRoll("dropr", day) * regs.length) % regs.length] || "residential",
      sp = CACHE_SPOTS[region];
    const want = DROP.items[0] + Math.floor(this.hnRoll("dropn", day) * (DROP.items[1] - DROP.items[0] + 1));
    const pool = [...DROP_TABLE].filter(([id]) => ITEMS[id]);
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.hnRoll("drops", day, i) * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const items = {};
    for (const [id, lo, hi] of pool.slice(0, want)) items[id] = lo + Math.floor(this.hnRoll("dropq", day, id) * (hi - lo + 1));
    this.hn.drop = { day, region, x: clamp(sp.x + DROP.offset.x, 80, WORLD.w - 80), y: clamp(sp.y + DROP.offset.y, 90, WORLD.h - 90), items, at: this.absNow(), until: day + DROP.keep, fixed: false, ring: false, opened: false };
    return this.hn.drop;
  }
  dropHere() {
    const d = this.hn?.drop;
    return d && !d.opened && d.until >= this.s.day && this.s.region === d.region ? d : null;
  }
  openDrop() {
    const d = this.dropHere();
    if (!d) return false;
    d.opened = true;
    this.receive(d.items);
    const text = "打开空投箱：" + itemsText(d.items) + "。";
    this.toast(text, "gold");
    if (this.o) this.olog(text, "gold");
    this.events.push({ type: "loot" });
    this.assignRegion();
    return true;
  }
  // 求援的邻居：长夜或尸潮打起来时到营门
  fightOn() {
    return !!this.ln?.night || ["warning", "active"].includes(this.s.horde.phase);
  }
  // v0.31：通话那面墙交满以后多来一个人（后面的层改这一处）
  allyNames() {
    return [...ALLY.names];
  }
  allyLooks() {
    return [...ALLY.looks];
  }
  spawnAllies() {
    const h = this.hn.help,
      p = ALLY.post;
    h.live = true;
    h.armed = false;
    const names = this.allyNames(),
      looks = this.allyLooks();
    h.allies = names.map((name, i) => ({ id: "a" + i, name, look: looks[i] ?? ALLY.looks[0], x: p.x + i * 34, y: p.y + i * 22, hp: ALLY.hp, cd: 0, down: false, kills: 0 }));
    const text = "雨巷的" + names.join("、") + "赶到了营门：今晚他们帮你守。";
    this.toast(text, "gold");
    if (this.o) this.olog(text, "gold");
  }
  dismissAllies() {
    const h = this.hn.help,
      kills = h.allies.reduce((a, x) => a + (x.kills || 0), 0);
    const text = (h.allies.length ? h.allies.map((a) => a.name) : this.allyNames()).join("、") + "守完这一场回雨巷了" + (kills ? "（一共打倒 " + kills + " 只）" : "") + "。";
    Object.assign(h, { live: false, armed: false, allies: [] });
    this.toast(text, "gold");
    if (this.o) this.olog(text, "gold");
  }
  updateAllies(dt) {
    const h = this.hn?.help;
    if (!h) return;
    if (h.armed && !h.live && this.fightOn() && this.s.region === "farm") this.spawnAllies();
    if (!h.live) return;
    if (!this.fightOn()) return this.dismissAllies();
    if (this.s.region !== "farm") return;
    const foes = this.enemies.filter((z) => !z.dead && !z.lying && !z.fled);
    for (const a of h.allies) {
      if (a.down) continue;
      a.cd = Math.max(0, a.cd - dt);
      const t = foes.filter((z) => dist(z, a) < ALLY.r).sort((p, q) => dist(p, a) - dist(q, a))[0];
      const goal = t || ALLY.post;
      const d = dist(a, goal);
      if (d > (t ? ALLY.reach - 6 : 10)) {
        const ang = Math.atan2(goal.y - a.y, goal.x - a.x);
        a.facing = ang;
        if (this.moveEntity) this.moveEntity(a, Math.cos(ang) * ALLY.speed * dt, Math.sin(ang) * ALLY.speed * dt);
        else {
          a.x += Math.cos(ang) * ALLY.speed * dt;
          a.y += Math.sin(ang) * ALLY.speed * dt;
        }
        a.x = clamp(a.x, 20, WORLD.w - 20);
        a.y = clamp(a.y, 20, WORLD.h - 20);
      }
      if (t && d <= ALLY.reach && a.cd <= 0) {
        a.cd = ALLY.rate;
        const was = t.dead;
        this.hurtEnemy(t, ALLY.dmg, Math.atan2(t.y - a.y, t.x - a.x), { ally: true });
        if (!was && t.dead) a.kills = (a.kills || 0) + 1;
      }
      // 贴身的感染者也会伤到他们
      for (const z of foes) {
        if (z.dead || dist(z, a) > 34) continue;
        z.hnAllyCd = Math.max(0, (z.hnAllyCd || 0) - dt);
        if (z.hnAllyCd > 0) continue;
        z.hnAllyCd = ALLY.hurtCd;
        a.hp = Math.max(0, a.hp - (ZOMBIES[z.type]?.damage || 8));
        if (a.hp <= 0) {
          a.down = true;
          this.toast(a.name + "挂了彩，退到营门边歇着了。", "warn");
          break;
        }
      }
    }
  }

  // ================= 红薯跑商 =================
  muleOpen() {
    return (this.sc?.act || 1) >= 5 && !!this.o?.convoy?.done;
  }
  muleMap(dest) {
    const d = MULE.dest[dest];
    if (!d) return null;
    if (dest === "market") return "market";
    // 和世界地图一样：地区看 s.districts.unlocked，边境看 s.beyond.unlocked
    return d.maps.find((m) => (DISTRICTS[m] ? !!this.s.districts?.unlocked?.[m] : BMAPS[m] ? !!this.s.beyond?.unlocked?.[m] : false)) || null;
  }
  muleCat(id) {
    const it = ITEMS[id];
    if (!it) return null;
    if (id === "ammo" || id === "cloth" || id === "parts") return id;
    if (it.type === "medicine") return "medicine";
    if (it.type === "crop" || it.type === "food" || it.food) return "food";
    return null;
  }
  muleLoadable(id) {
    const it = ITEMS[id];
    return !!it && !it.protected && (it.sell || 0) > 0 && !/^seed/.test(id);
  }
  muleUnit(id, dest) {
    const d = MULE.dest[dest],
      base = this.shipPrice ? this.shipPrice(id) : ITEMS[id]?.sell || 0;
    return Math.floor(base * (d && d.cats.includes(this.muleCat(id)) ? d.mult : 1));
  }
  muleCount(load = this.hn.mule.plan.load) {
    return Object.values(load).reduce((a, n) => a + n, 0);
  }
  muleValue(load, dest) {
    return Object.entries(load).reduce((a, [id, n]) => a + this.muleUnit(id, dest) * n, 0);
  }
  muleShipValue(load) {
    return Object.entries(load).reduce((a, [id, n]) => a + Math.floor(this.shipPrice ? this.shipPrice(id) : ITEMS[id]?.sell || 0) * n, 0);
  }
  muleRisky() {
    return (this.hn?.noise.v || 0) >= NOISE.tiers[NOISE.tiers.length - 1].at || ["scheduled", "warning", "active"].includes(this.raidState?.().phase);
  }
  muleRobChance(escort = false) {
    return escort ? 0 : this.muleRisky() ? MULE.rob.risky : MULE.rob.base;
  }
  muleSet(kind, value) {
    const p = this.hn.mule.plan;
    if (kind === "dest" && MULE.dest[value]) p.dest = value;
    else if (kind === "back" && MULE.backs.includes(value)) p.back = value;
    else return false;
    return true;
  }
  muleAdjust(id, delta) {
    const p = this.hn.mule.plan,
      now = p.load[id] || 0;
    if (!this.muleLoadable(id)) return false;
    const room = MULE.max - this.muleCount() + now,
      have = this.stockOf(id) - (this.hotCount?.(id) || 0) - (id === "radish" ? MULE.wage.radish : 0);
    const n = clamp(now + delta, 0, Math.max(0, Math.min(room, have)));
    if (n === now) return false;
    if (n) p.load[id] = n;
    else delete p.load[id];
    return true;
  }
  muleReason() {
    const m = this.hn?.mule;
    if (!m) return "没有红薯";
    if (!this.muleOpen()) return "第五段的车队到站以后，红薯才跑商";
    if (m.trip) return "红薯在路上，第 " + Math.floor(m.trip.returns / 1440) + " 天 08:00 回来";
    if (this.s.day < m.next) return "红薯刚跑完一趟，第 " + m.next + " 天能再跑";
    if (this.s.region !== "farm") return "回到农场装车";
    if (!this.muleMap(m.plan.dest)) return "还没去过" + MULE.dest[m.plan.dest].name;
    const n = this.muleCount();
    if (!n) return "车上还没装货";
    if (n > MULE.max) return "最多装 " + MULE.max + " 件";
    if (this.stockOf("radish") < 1 + (m.plan.load.radish || 0)) return "要 1 个萝卜当红薯的工钱";
    const lack = missingCost(this, m.plan.load);
    if (lack.length) return "货不够：" + lack.join("、");
    const hot = Object.entries(m.plan.load).find(([id, n]) => n > this.stockOf(id) - (this.hotCount?.(id) || 0));
    if (hot) return ITEMS[hot[0]].name + "里有赃物，正经买卖不收";
    return "";
  }
  muleGo() {
    const reason = this.muleReason();
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const m = this.hn.mule,
      p = m.plan,
      day = this.s.day,
      load = { ...p.load };
    const value = this.muleValue(load, p.dest),
      ship = this.muleShipValue(load),
      risky = this.muleRisky();
    const cost = { ...load, radish: (load.radish || 0) + MULE.wage.radish };
    if (!this.takeFarm(cost)) {
      this.toast("装车没装上：货不够。", "warn");
      return false;
    }
    m.trip = { day, dest: p.dest, map: this.muleMap(p.dest), back: p.back, load, value, ship, risky, escort: false, spawned: false, foes: [], returns: (day + MULE.every) * 1440 + MULE.backAt };
    m.next = day + MULE.every;
    p.load = {};
    this.hnStat("trips");
    const d = MULE.dest[p.dest],
      text =
        "红薯拉着 " +
        this.muleCount(load) +
        " 件货去" +
        d.name +
        "了：那边能卖约 " +
        value +
        " 金币（直接出货约 " +
        ship +
        "），第 " +
        (day + MULE.every) +
        " 天 08:00 回来。想跟车，今天到" +
        this.regionName(m.trip.map) +
        "把拦路的打掉。";
    this.toast(text, "gold");
    if (this.o) this.olog(text, "gold");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  // 跟车：出发当天到那张图，路上打一场
  muleEscortSpawn() {
    const t = this.hn?.mule.trip;
    if (!t || t.escort || t.spawned || t.day !== this.s.day || this.s.region !== t.map) return;
    t.spawned = true;
    const p = this.s.player;
    t.foes = MULE.foes.map((type, i) => {
      const a = (i / MULE.foes.length) * Math.PI * 2 + 0.6,
        q = this.freePoint?.(clamp(Math.round(p.x + Math.cos(a) * 190), 80, WORLD.w - 80), clamp(Math.round(p.y + Math.sin(a) * 150), 90, WORLD.h - 90)) || { x: p.x + 160, y: p.y },
        z = this.enemy(type, q.x, q.y, false);
      Object.assign(z, { hnMule: true, state: "chase", alert: 6 });
      this.enemies.push(z);
      return z.id;
    });
    this.toast("红薯的车在" + this.regionName(t.map) + "路口被 " + t.foes.length + " 只感染者拦住了：打掉它们，这一趟就没人敢截。", "warn");
  }
  muleEscortCheck() {
    const t = this.hn?.mule.trip;
    if (!t || t.escort || !t.spawned || this.s.region !== t.map) return;
    if (this.enemies.some((z) => t.foes.includes(z.id) && !z.dead)) return;
    t.escort = true;
    this.hnStat("escorted");
    this.toast("路口清干净了：红薯这一趟没人敢截。", "gold");
    if (this.o) this.olog("跟车把红薯送过了" + this.regionName(t.map) + "的路口。", "gold");
    this.xp("combat", 8);
  }
  muleReturn() {
    const m = this.hn.mule,
      t = m.trip;
    if (!t || this.absNow() < t.returns) return false;
    const d = MULE.dest[t.dest],
      robbed = !t.escort && this.hnRoll("rob", t.day, t.dest) < (t.risky ? MULE.rob.risky : MULE.rob.base);
    let money = t.value;
    const got = {};
    if (t.back !== "money" && ITEMS[t.back]) {
      const unit = ITEMS[t.back].buy || 1,
        n = Math.min(d.stock[t.back] || 0, Math.floor(money / unit));
      if (n > 0) {
        got[t.back] = n;
        money -= n * unit;
      }
    }
    if (robbed) {
      money = Math.floor(money * (1 - MULE.rob.take));
      for (const k of Object.keys(got)) {
        got[k] = Math.floor(got[k] * (1 - MULE.rob.take));
        if (!got[k]) delete got[k];
      }
      this.hnStat("robbed");
    }
    this.s.money += money;
    if (Object.keys(got).length) this.putStorage(got);
    m.log = [{ day: t.day, dest: t.dest, n: this.muleCount(t.load), value: t.value, ship: t.ship, money, got, robbed, escort: t.escort }, ...m.log].slice(0, MULE.log);
    m.trip = null;
    const text =
      "红薯从" +
      d.name +
      "回来了：" +
      (robbed ? "路上被截走一半，" : t.escort ? "你跟过车，一路平安，" : "一路平安，") +
      "带回 " +
      money +
      " 金币" +
      (Object.keys(got).length ? "和" + itemsText(got) : "") +
      "。";
    this.toast(text, robbed ? "warn" : "gold");
    if (this.o) this.olog(text, robbed ? "warn" : "gold");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }

  // ================= 设施改良 =================
  upPath(cls) {
    return this.hn?.up[cls] || "";
  }
  upPaths(b) {
    const cls = upClassOf(b?.type);
    return cls ? UPGRADES[cls] : null;
  }
  // 这一类有几座改了某条路线
  upCount(type, path) {
    return this.s.buildings.filter((b) => b.type === type && b.hp > 0 && b.hnUp === path).length;
  }
  unlockReason(cls, path) {
    const U = UPGRADES[cls];
    if (!U || !U.paths[path]) return "没有这条路线";
    if (this.hn.up[cls]) return "这一类已经选了「" + U.paths[this.hn.up[cls]].name + "」，不能再换";
    if (this.s.region !== "farm") return "回到农场再选";
    if ((this.c.researchCredits || 0) < 1 && this.stockOf(UP_PAPER.item) < 1) return "要 1 张蓝图凭证（或 1 张改良图纸）";
    return "";
  }
  unlockPath(cls, path) {
    const reason = this.unlockReason(cls, path);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    let how;
    if (this.stockOf(UP_PAPER.item) > 0 && this.takeFarm({ [UP_PAPER.item]: 1 })) how = "用了 1 张改良图纸";
    else {
      this.c.researchCredits -= 1;
      how = "用了 1 张蓝图凭证";
    }
    this.hn.up[cls] = path;
    const U = UPGRADES[cls];
    const text = U.name + "选了「" + U.paths[path].name + "」路线（" + how + "）：" + U.paths[path].text + "。每座再花" + itemsText(U.cost) + "就能改。";
    this.toast(text, "gold");
    if (this.o) this.olog(text, "gold");
    return true;
  }
  upgradeReason(b) {
    const cls = upClassOf(b?.type);
    if (!cls) return "这样设施不能改良";
    const path = this.hn.up[cls];
    if (!path) return "先选一条路线（1 张蓝图凭证）";
    if (b.hnUp) return "已经改成「" + UPGRADES[cls].paths[b.hnUp].name + "」了";
    if (this.s.region !== "farm") return "回到农场再改";
    if (b.hp <= 0) return "先修好";
    const lack = missingCost(this, UPGRADES[cls].cost);
    if (lack.length) return "还缺：" + lack.join("、");
    return "";
  }
  upgradeBuilding(id) {
    const b = this.s.buildings.find((x) => x.id === id),
      reason = b ? this.upgradeReason(b) : "没有这座设施";
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const cls = upClassOf(b.type),
      U = UPGRADES[cls];
    if (!this.takeFarm(U.cost)) return false;
    b.hnUp = this.hn.up[cls];
    this.hnStat("upgrades");
    this.particlesAt?.(b.x, b.y - 20, "#f3d488", 10);
    this.toast(BUILDINGS[b.type].name + "改成「" + U.paths[b.hnUp].name + "」：" + U.paths[b.hnUp].text + "。", "gold");
    return true;
  }
  // 围栏一次改一片：这一段附近 200 步内还没改的围栏和大门
  fenceBatch(b, r = 200) {
    return this.s.buildings.filter((x) => ["fence", "gate"].includes(x.type) && x.hp > 0 && !x.hnUp && dist(x, b) <= r);
  }
  upgradeFences(id) {
    const b = this.s.buildings.find((x) => x.id === id);
    if (!b || !["fence", "gate"].includes(b.type)) return false;
    const list = this.fenceBatch(b),
      path = this.hn.up.fence;
    if (!path || !list.length) return false;
    const each = UPGRADES.fence.cost,
      afford = Math.min(list.length, ...Object.entries(each).map(([k, n]) => Math.floor(this.stockOf(k) / n)));
    if (afford < 1 || this.s.region !== "farm") {
      this.toast("材料不够：每段" + itemsText(each) + "。", "warn");
      return false;
    }
    const pick = list.sort((p, q) => dist(p, b) - dist(q, b)).slice(0, afford);
    if (!this.takeFarm(Object.fromEntries(Object.entries(each).map(([k, n]) => [k, n * pick.length])))) return false;
    for (const x of pick) x.hnUp = path;
    this.hnStat("upgrades", pick.length);
    this.toast("改了 " + pick.length + " 段围栏和大门：「" + UPGRADES.fence.paths[path].name + "」。", "gold");
    return true;
  }
  // 喷灌头、雨水桶：水网里读这几个数
  sprinklerR(b) {
    return super.sprinklerR(b) + (b?.hnUp === "far" ? UPGRADES.irrigation.paths.far.r : 0);
  }
  routeCostMult(route) {
    if (route?.kind !== "sprinkler") return super.routeCostMult(route);
    const b = this.s.buildings.find((x) => x.id === route.id);
    return super.routeCostMult(route) * (b?.hnUp === "saver" ? UPGRADES.irrigation.paths.saver.use : 1);
  }
  barrelMade(b, rain, heat) {
    const n = super.barrelMade(b, rain, heat);
    return rain && b?.hnUp === "filter" ? Math.round(n * UPGRADES.rain.paths.filter.rain) : n;
  }
  barrelStore(b) {
    return b?.hnUp === "big" ? UPGRADES.rain.paths.big.store : super.barrelStore(b);
  }
  // 篝火灶：双灶两条产线；慢火时间 ×1.5（多出的那 1 份在做好时加上）
  stationLanes(b, n) {
    if (b?.type === "cook" && b.hnUp === "twin") return [n, n];
    if (b?.type === "cook" && b.hnUp === "slow") return [n / UPGRADES.cook.paths.slow.time];
    return [n];
  }
  processProduction(n) {
    const slow = this.hn && this.s.buildings.some((b) => b.type === "cook" && b.hp > 0 && b.hnUp === "slow");
    const before = slow ? new Set(this.c.production.filter((j) => j.station === "cook" && !j.ready).map((j) => j.id)) : null;
    const out = super.processProduction(n);
    if (slow)
      for (const j of this.c.production)
        if (before.has(j.id) && j.ready && j.out) {
          const k = Object.keys(j.out)[0];
          if (k) j.out[k] += UPGRADES.cook.paths.slow.out;
        }
    return out;
  }
  // 双人哨：守卫比塔多的时候，多出来的人去双人哨；吃了晚饭的那一夜射得快一倍
  twinTowers() {
    if (this.s.region !== "farm" || !this.hn) return [];
    const guards = this.c.residents.filter((r) => (r.workRole === "guard" || (r.role === "guard" && !r.workRole)) && this.residentActive(r));
    const towers = this.s.buildings.filter((b) => b.type === "tower" && b.hp > 0);
    const manned = towers.slice(0, guards.length),
      spare = guards.slice(towers.length);
    const now = this.absNow();
    const twins = manned.filter((b) => b.hnUp === "twin" && (b.hnFed || 0) > now).slice(0, spare.length);
    return twins.map((b, i) => ({ b, g: spare[i] }));
  }
  twinMeals() {
    if (!this.hn) return;
    const towers = this.s.buildings.filter((b) => b.type === "tower" && b.hp > 0),
      guards = this.c.residents.filter((r) => ((r.priorities?.guard || 0) > 0 || r.role === "guard") && !this.laidUp("r:" + r.id)).length,
      spare = Math.max(0, guards - towers.length);
    const twins = towers.slice(0, guards).filter((b) => b.hnUp === "twin").slice(0, spare);
    let fed = 0;
    for (const b of twins) {
      if (this.takeFarm(UPGRADES.tower.paths.twin.meal)) {
        b.hnFed = this.absNow() + 1440;
        fed++;
      } else b.hnFed = 0;
    }
    if (twins.length && fed < twins.length) this.toast("双人哨缺干粮：今晚有 " + (twins.length - fed) + " 座只有一个人守。", "warn");
  }
  serveDinner() {
    const out = super.serveDinner();
    this.twinMeals();
    return out;
  }
  // 双人哨：塔都有人守了，多出来的守卫站到双人哨上（不然整点排班时没有空塔，他会被叫去歇着）
  twinStaff() {
    if (!this.hn || this.s.region !== "farm" || this.hn.up.tower !== "twin") return;
    const towers = this.s.buildings.filter((b) => b.type === "tower" && b.hp > 0),
      now = this.absNow();
    for (const r of this.c.residents) {
      const duty = this.c.residents.filter((x) => x.workRole === "guard" && this.residentActive(x)).length,
        seats = towers.slice(0, duty).filter((b) => b.hnUp === "twin" && (b.hnFed || 0) > now).length;
      if (duty - towers.length >= seats) return;
      if (r.workRole === "guard" || !((r.priorities?.guard || 0) > 0 || r.role === "guard") || (r.workRole && r.workRole !== "rest")) continue;
      const was = r.workRole;
      r.workRole = "guard";
      if (this.residentActive(r)) r.status = "双人哨";
      else r.workRole = was;
    }
  }
  updateDefense(dt) {
    if (this.hn && this.s.region === "farm")
      for (const { b, g } of this.twinTowers()) {
        b.shotTimer = Math.max(0, (b.shotTimer || 0) - dt);
        if (g) {
          g.target = { x: b.x + 24, y: b.y + 40 };
          g.status = "双人哨";
        }
      }
    return super.updateDefense(dt);
  }
  // 打哪一下是哪座塔、哪个陷阱打的
  towerOf(e, a) {
    return this.s.buildings.filter((b) => b.type === "tower" && b.hp > 0 && dist(b, e) < 330).sort((p, q) => Math.abs(Math.atan2(e.y - p.y, e.x - p.x) - a) - Math.abs(Math.atan2(e.y - q.y, e.x - q.x) - a))[0];
  }
  hurtEnemy(e, n, a, meta = {}) {
    const live = e && !e.dead,
      src = this._damageSource;
    let trap = null;
    if (this.hn && live) {
      if (src === "tower" && this.isNight()) {
        const t = this.towerOf(e, a ?? 0);
        if (t?.hnUp === "light") n *= UPGRADES.tower.paths.light.night;
      }
      if (src === "trap") {
        trap = this.s.buildings.find((b) => b.type === "trap" && b.hp > 0 && dist(b, e) < 44);
        if (trap?.hnUp === "spike") n *= UPGRADES.trap.paths.spike.dmg;
      }
    }
    const out = super.hurtEnemy(e, n, a, meta);
    if (this.hn && live) {
      if (trap?.hnUp === "spike") trap.hp = Math.max(0, trap.hp - TRAP_ALL.wear * (UPGRADES.trap.paths.spike.wear - 1));
      if (trap?.hnUp === "net" && !e.dead && !this.bossy?.(e)) {
        e.trapHeld = Math.max(e.trapHeld || 0, UPGRADES.trap.paths.net.hold);
        e.netHeld = true;
      }
      if (e.dead && e.hnNoise && !this.noiseAlive().length && this.hn.attack.state === "live") {
        const at = this.hn.attack;
        at.state = "done";
        this.noiseStandDown();
        at.report = "循着动静来的 " + at.n + " 只都打倒了。";
        this.toast(at.report, "gold");
        if (this.o) this.olog(at.report, "gold");
      }
    }
    return out;
  }
  // 铁皮挨的打减半；倒刺：啃它的感染者每口掉 5 血
  fenceSnapshot() {
    return this.s.buildings.filter((b) => ["fence", "gate"].includes(b.type) && b.hnUp && b.hp > 0).map((b) => [b, b.hp]);
  }
  fenceAfter(snap) {
    for (const [b, hp0] of snap) {
      const lost = hp0 - b.hp;
      if (lost <= 0) continue;
      if (b.hnUp === "iron") b.hp = Math.min(BUILDINGS[b.type].hp, b.hp + Math.floor(lost * (1 - UPGRADES.fence.paths.iron.take)));
      if (b.hnUp === "barb")
        for (const z of this.enemies) {
          if (z.dead || dist(z, b) > 70 || (z.cooldown || 0) < 0.8 || z.hnBarbT === this.s.playSeconds) continue;
          z.hnBarbT = this.s.playSeconds;
          this.hurtEnemy(z, UPGRADES.fence.paths.barb.bite, Math.atan2(z.y - b.y, z.x - b.x), { barb: true });
        }
    }
  }
  // 卖改良图纸：蓝图都学全以后，唐九每次多带一张
  arriveCaravan() {
    const ok = super.arriveCaravan();
    if (!ok || !this.hn) return ok;
    const c = this.o?.caravan;
    if (c?.offers && Object.keys(TECH).every((k) => this.c.technologies?.[k])) {
      const fake = !this.caravanTrusted?.() && this.hnRoll("paper", this.s.day) < 0.25 ? UP_PAPER.fake : null;
      const offer = { key: c.offers.length, item: UP_PAPER.item, tech: null, qty: 1, price: UP_PAPER.price, fake, inspected: null, sold: false };
      // 一次最多摆 6 样：摆满了就换下一样普通货
      if (c.offers.length < 6) c.offers.push(offer);
      else {
        const i = c.offers.findIndex((o) => !o.tech && !/^bp_/.test(o.item || "") && o.item !== "leatherJacket");
        if (i >= 0) c.offers[i] = { ...offer, key: c.offers[i].key };
      }
    }
    return ok;
  }

  // ================= 伤员和医务室 =================
  isHurt(key) {
    return !!this.hn?.hurt[key];
  }
  // 仗打着的时候挂彩的人咬牙守到这一仗打完，打完才躺下
  holding(key) {
    return !!this.hn?.hurt[key]?.fight && this.touchFight();
  }
  laidUp(key) {
    return this.isHurt(key) && !this.holding(key);
  }
  hurtLeft(key) {
    const h = this.hn?.hurt[key];
    return h ? Math.max(0, h.until - this.absNow()) : 0;
  }
  hurtNightKey() {
    return this.s.minute >= 720 ? this.s.day : this.s.day - 1;
  }
  injure(key, name, why = "") {
    if (!this.hn || this.hn.hurt[key]) return false;
    const night = this.hurtNightKey();
    if (this.hn.hurtNight[key] === night) return false;
    const at = this.absNow(),
      fight = this.touchFight();
    this.hn.hurt[key] = { at, until: at + INJURY.days * 1440, care: "", name: String(name || "").slice(0, 20), fight };
    this.hn.hurtNight[key] = night;
    this.hnStat("injuries");
    if (key.startsWith("r:")) {
      const r = this.resident?.(key.slice(2));
      if (r && !fight) {
        r.workRole = r.workRole === "guard" ? "" : r.workRole;
        r.status = "受伤了";
      } else if (r) r.status = "挂彩了，守到这一仗打完";
    }
    const text = fight
      ? name + "挂彩了" + (why ? "（" + why + "）" : "") + "：咬牙守到这一仗打完，之后 2 天干不了活。医务室里用 1 条绷带 1 天就好，用 1 个药包当天下午就好。"
      : name + "受伤了" + (why ? "（" + why + "）" : "") + "：2 天干不了活。医务室里用 1 条绷带 1 天就好，用 1 个药包今天下午就好。";
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
    return true;
  }
  // 被摸到一次：两成机会受伤
  touchPerson(key, name, why) {
    const now = this.s.playSeconds || 0;
    this._hnTouch ??= new Map();
    if ((this._hnTouch.get(key) || 0) > now) return false;
    this._hnTouch.set(key, now + INJURY.cd);
    this._hnTouchN = (this._hnTouchN || 0) + 1;
    if (this.hnRoll("touch", key, this.s.day, Math.floor(now * 10), this._hnTouchN) >= INJURY.chance) return false;
    return this.injure(key, name, why);
  }
  touchFight() {
    return !!this.ln?.night || this.s.horde.phase === "active" || this.raidState?.().phase === "active" || this.hn?.attack.state === "live";
  }
  // 长夜、尸潮、袭击里：感染者摸到守塔的居民、守营门的队员
  touchCheck(towerHp) {
    if (!this.hn || this.s.region !== "farm" || !this.touchFight()) return;
    const people = [];
    for (const r of this.c.residents) if (r.workRole === "guard" && r.x != null && !this.isHurt("r:" + r.id) && this.residentActive(r)) people.push({ key: "r:" + r.id, name: this.residentName(r.id), x: r.x, y: r.y });
    for (const c of this.o?.crew || []) if (c.role === "guard" && c.x != null && !this.isHurt("c:" + c.id)) people.push({ key: "c:" + c.id, name: c.name, x: c.x, y: c.y });
    if (!people.length) return;
    for (const z of this.enemies) {
      if (z.dead || z.lying || z.fled || z.type === "raider") continue;
      for (const p of people) if (dist(z, p) <= INJURY.touch) this.touchPerson(p.key, p.name, "守夜时被感染者摸到");
    }
    // 塔挨了打：塔下的人也算被摸到
    if (towerHp)
      for (const [b, hp0] of towerHp) {
        if (b.hp >= hp0) continue;
        const r = people.find((p) => p.key.startsWith("r:") && Math.abs(p.x - b.x) < 40 && Math.abs(p.y - (b.y + 40)) < 40);
        if (r) this.touchPerson(r.key, r.name, "感染者扑到了塔下");
      }
  }
  // 仗打完了：挂彩的人这才躺下
  hurtSettle() {
    for (const [k, h] of Object.entries(this.hn.hurt)) {
      if (!h.fight) continue;
      h.fight = false;
      const r = k.startsWith("r:") ? this.resident?.(k.slice(2)) : null;
      if (r) {
        if (r.workRole === "guard") r.workRole = "rest";
        r.status = "受伤了";
      }
    }
  }
  // 灰隼团的流弹：擦伤的人两成机会真伤了
  woundNote(name) {
    super.woundNote(name);
    if (!this.hn) return;
    const r = this.c.residents.find((x) => this.residentName(x.id) === name),
      c = r ? null : (this.o?.crew || []).find((x) => x.name === name);
    if (r) this.touchPerson("r:" + r.id, name, "灰隼团的流弹");
    else if (c) this.touchPerson("c:" + c.id, name, "灰隼团的流弹");
  }
  infirmary() {
    return this.rooms?.().find((r) => r.type === "医务室") || null;
  }
  treatReason(key, item) {
    const h = this.hn?.hurt[key];
    if (!h) return "没受伤";
    if (h.care) return "已经" + (h.care === "medkit" ? "用过药包" : "用过绷带") + "了";
    if (!["bandage", "medkit"].includes(item)) return "用不上";
    if (this.s.region !== "farm") return "回到农场再分药";
    if (item === "bandage" && !this.infirmary()) return "要一间医务室（地板 + 居民床 + 药柜）才能躺下用绷带";
    if (this.stockOf(item) < 1) return "没有" + ITEMS[item].name;
    return "";
  }
  treat(key, item) {
    const reason = this.treatReason(key, item);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    if (!this.takeFarm({ [item]: 1 })) return false;
    const h = this.hn.hurt[key],
      now = this.absNow();
    if (item === "bandage") h.until = Math.min(h.until, now + INJURY.bandage);
    else {
      const today = now - this.s.minute + INJURY.medkitAt;
      h.until = Math.min(h.until, now < today ? today : now + INJURY.medkitMin);
    }
    h.care = item;
    const hours = Math.ceil((h.until - now) / 60);
    this.toast(h.name + (item === "bandage" ? "躺进医务室，换上了绷带" : "用了药包") + "：再过 " + hours + " 个钟点就能干活。", "gold");
    return true;
  }
  healCheck() {
    if (!this.hn) return;
    const now = this.absNow();
    for (const [k, h] of Object.entries(this.hn.hurt)) {
      if (now < h.until) continue;
      delete this.hn.hurt[k];
      this.hnStat("healed");
      this.toast(h.name + "的伤好了，能干活了。", "gold");
      if (this.o) this.olog(h.name + "伤好了。");
    }
  }
  residentActive(r) {
    if (this.hn && this.laidUp("r:" + r.id)) return false;
    const base = super.residentActive(r);
    if (base || !this.hn || this.hn.attack.state !== "live" || this.s.region !== "farm") return base;
    // 动静招来的夜袭（0 点）：0 点前吃过晚饭、排了守卫岗的人跟尸潮时一样上岗
    return r.workRole === "guard" && this.nightGuards().includes(r);
  }
  residentWorkReason(r) {
    if (this.hn && this.laidUp("r:" + r.id)) return "受伤了，还要养 " + Math.ceil(this.hurtLeft("r:" + r.id) / 60) + " 个钟点";
    return super.residentWorkReason(r);
  }
  readyGuards() {
    const n = super.readyGuards();
    if (!this.hn) return n;
    const cap = this.residentsCapacity();
    const hurt = this.c.residents.filter((r, i) => this.laidUp("r:" + r.id) && ((r.priorities?.guard || 0) > 0 || r.role === "guard") && r.fed && i < cap && (r.fatigue || 0) < 85 && !this.striking?.(r)).length;
    return Math.max(0, n - hurt);
  }
  guardFire(dt) {
    const hurt = this.hn ? (this.o?.crew || []).filter((c) => this.laidUp("c:" + c.id)) : [];
    if (!hurt.length) return super.guardFire(dt);
    const roles = hurt.map((c) => c.role);
    for (const c of hurt) c.role = "rest";
    try {
      return super.guardFire(dt);
    } finally {
      hurt.forEach((c, i) => (c.role = roles[i]));
    }
  }
  crewHour(c) {
    if (this.hn && this.laidUp("c:" + c.id)) {
      const left = Math.ceil(this.hurtLeft("c:" + c.id) / 60),
        room = this.infirmary();
      return Object.assign(c, { status: "养伤（还要 " + left + " 个钟点）", task: "rest", target: room ? { x: room.floor.x + 30, y: room.floor.y + 30 } : this.crewHome(c) });
    }
    return super.crewHour(c);
  }
  // 医务室：地板 75 步内有居民床和药柜
  roomInfo(floor) {
    const r = super.roomInfo(floor);
    if (this.hn && r.types.includes("medCabinet") && r.types.includes("bed")) return { ...r, type: "医务室", active: true };
    return r;
  }

  // ================= 舒适度和「休息好」 =================
  roomComfort(room) {
    if (!room?.active) return 0;
    return COMFORT_CATS.filter((k) => room.types.includes(k)).length;
  }
  comfortList(room) {
    return COMFORT_CATS.filter((k) => room?.types.includes(k)).map((k) => COMFORT.cats[k]);
  }
  homeRoom() {
    return (
      (this.rooms?.() || [])
        .filter((r) => r.active && dist(r.floor, COMFORT.home) <= COMFORT.homeR)
        .sort((a, b) => this.roomComfort(b) - this.roomComfort(a))[0] || null
    );
  }
  bestComfort() {
    return Math.max(0, ...(this.rooms?.() || []).map((r) => this.roomComfort(r)));
  }
  restedNow() {
    return !!this.hn && this.absNow() < this.hn.rested.until;
  }
  restedLeft() {
    return this.hn ? Math.max(0, this.hn.rested.until - this.absNow()) : 0;
  }
  sleep() {
    const ok = super.sleep();
    if (ok && this.hn) {
      const room = this.homeRoom(),
        c = this.roomComfort(room);
      if (room && c > 0) {
        const hours = COMFORT.rested.base + c;
        this.hn.rested = { until: this.absNow() + hours * 60, comfort: c };
        this.toast("在" + room.type + "边上睡得好（舒适度 " + c + "）：「休息好」" + hours + " 个钟点——体力恢复快五成，经验多一成。", "gold");
      }
    }
    return ok;
  }
  xp(skill, n) {
    return super.xp(skill, this.restedNow() && n > 0 ? n * COMFORT.rested.xp : n);
  }
  moodFactors(r) {
    const out = super.moodFactors(r);
    if (!this.hn) return out;
    if (this.isHurt("r:" + r.id)) out.push({ key: "hurt", v: INJURY.mood, text: "受伤了" });
    if (this.bestComfort() >= COMFORT.moodAt) out.push({ key: "comfy", v: COMFORT.mood, text: "有一间舒适度 " + COMFORT.moodAt + " 以上的房间" });
    return out;
  }
  ladderChecks() {
    const checks = super.ladderChecks();
    if (!this.hn) return checks;
    checks[2] = checks[2] && this.bestComfort() >= COMFORT.ladder;
    // 食堂（有餐桌的房间）：在这里吃的晚饭多算一种菜
    if (!checks[1] && this.diningRoom()) {
      const types = new Set((this.w?.mealLog || []).slice(0, 3).flatMap((m) => m.types)),
        need = this.decree?.("kitchen") ? 2 : 3,
        cold = this.td?.coldKitchen && this.td.coldKitchen === this.o?.dinnerDay && this.decree?.("kitchen");
      if (types.size > 0 && types.size + 1 >= need && !cold) checks[1] = true;
    }
    return checks;
  }
  // 学习室、食堂按家具算：书架和餐桌摆在同一间，两样都算（原来书架会把食堂盖掉）
  studyRoom() {
    return (this.rooms?.() || []).some((r) => r.active && (r.type === STUDY_ROOM || r.types.includes("bookshelf")));
  }
  diningRoom() {
    return (this.rooms?.() || []).some((r) => r.active && (r.type === DINING_ROOM || r.types.includes("table")));
  }

  // ================= 食堂在场景里上菜 =================
  canteenMax(n = this.ss?.canteen.night) {
    return n?.max || CANTEEN2.guests;
  }
  guestSeat(i) {
    const P = PLAZA;
    if (i < 4) return { x: P.x - 60 + i * 40, y: P.y + 36 };
    return { x: P.x - 40 + (i - 4) * 80, y: P.y - 34 };
  }
  guestDish(g) {
    const stock = this.dishesInStock(),
      list = TASTES[g.taste]?.dishes || [];
    g.dish = list.find((d) => stock.includes(d)) || list[Math.floor(this.hnRoll("dish", this.s.day, g.id) * list.length) % Math.max(1, list.length)] || null;
  }
  startCanteen() {
    const ok = super.startCanteen();
    if (ok && this.hn) {
      const n = this.ss.canteen.night;
      n.max = CANTEEN2.guests + CANTEEN2.more.filter((r) => this.ss.canteen.rep >= r).length;
      this.noiseAdd(NOISE.canteen, "canteen");
      this.toast("今晚 " + n.max + " 位客人。客人头上写着要什么菜：到何大勺的灶台按 E 端菜，走到客人跟前按 E 上菜。（动静 +" + NOISE.canteen + "）");
    }
    return ok;
  }
  spawnGuest() {
    if (!this.hn) return super.spawnGuest();
    const n = this.ss.canteen.night;
    if (!n || n.spawned >= this.canteenMax(n)) return;
    const tastes = Object.keys(TASTES).filter((t) => TASTES[t].dishes.length),
      i = n.spawned,
      seed = this.s.day * 7 + i;
    const stock = this.dishesInStock();
    let taste = tastes[(seed * 5 + Math.floor(this.roll() * tastes.length)) % tastes.length];
    if (i === 0) taste = tastes.find((t) => TASTES[t].dishes.some((d) => stock.includes(d))) || taste;
    const g = { id: "g" + i, name: GUEST_NAMES[(seed + i) % GUEST_NAMES.length], look: seed % VISITOR_LOOKS.length, taste, patience: CANTEEN_PATIENCE, waited: 0, state: "waiting" };
    this.guestDish(g);
    n.customers.push(g);
    n.spawned++;
    n.nextIn = CANTEEN_GAP;
    if (this.s.region === "farm") this.assignRegion();
  }
  canteenTick(minutes) {
    if (!this.hn) return super.canteenTick(minutes);
    const n = this.ss.canteen.night;
    if (!n || minutes <= 0) return;
    let left = false;
    for (const g of n.customers)
      if (g.state === "waiting") {
        g.waited = Math.min(g.patience, g.waited + minutes);
        if (g.waited >= g.patience) {
          g.state = "left";
          n.missed++;
          left = true;
          if (this.hn.carry?.guest === g.id) this.hn.carry.guest = "";
          this.toast(g.name + "等不及，走了。", "warn");
        }
      }
    const max = this.canteenMax(n);
    if (n.spawned < max) {
      n.nextIn -= minutes;
      if (n.nextIn <= 0) this.spawnGuest();
    }
    if (left && this.s.region === "farm") this.assignRegion();
    if ((n.spawned >= max && n.customers.every((g) => g.state !== "waiting")) || this.s.minute >= CANTEEN_HOURS[1] || n.day !== this.s.day) this.endCanteen();
  }
  serveGuest(gid, dishId) {
    const ok = super.serveGuest(gid, dishId);
    if (ok && this.hn) {
      this.hnStat("served");
      if (this.ss.canteen.night && this.s.region === "farm") this.assignRegion();
    }
    return ok;
  }
  endCanteen() {
    const n = this.ss?.canteen.night,
      served = n?.served || 0;
    const ok = super.endCanteen();
    if (ok && this.hn) {
      this.hn.carry = null;
      if (served > 0) {
        for (const r of this.c.residents) r.morale = clamp((r.morale ?? 60) + CANTEEN2.mood, 0, 100);
        this.toast("营地里的人也在食堂吃了一顿：士气 +" + CANTEEN2.mood + "。", "gold");
      }
    }
    return ok;
  }
  // 灶台：端起最着急的那位要的菜；手里有菜再按一下就放回去
  stoveDish() {
    const n = this.ss?.canteen.night;
    if (!n) return false;
    if (this.hn.carry) {
      this.toast("把" + ITEMS[this.hn.carry.dish].name + "放回灶台。");
      this.hn.carry = null;
      return true;
    }
    const stock = this.dishesInStock(),
      waiting = n.customers.filter((g) => g.state === "waiting").sort((a, b) => b.waited / b.patience - a.waited / a.patience);
    if (!waiting.length) {
      this.toast("还没有客人在等。");
      return false;
    }
    for (const g of waiting) {
      const exact = g.dish && stock.includes(g.dish) ? g.dish : null,
        same = exact || TASTES[g.taste].dishes.find((d) => stock.includes(d));
      if (same) {
        this.hn.carry = { dish: same, guest: g.id };
        this.toast("端起一碗" + ITEMS[same].name + "（给" + g.name + "）。走到客人跟前按 E 上菜。");
        return true;
      }
    }
    const any = stock[0];
    if (!any) {
      this.toast("灶上没有做好的菜了：先去篝火灶做。", "warn");
      return false;
    }
    this.hn.carry = { dish: any, guest: waiting[0].id };
    this.toast("客人要的菜都没有了：先端一碗" + ITEMS[any].name + "凑合给" + waiting[0].name + "。", "warn");
    return true;
  }
  serveCarry(gid) {
    const c = this.hn?.carry;
    if (!c) {
      this.toast("手里没菜：先到何大勺的灶台按 E 端菜。");
      return false;
    }
    const ok = this.serveGuest(gid, c.dish);
    if (ok) this.hn.carry = null;
    return ok;
  }

  // ================= 节庆自己挑供品 =================
  // 丰收评比：作物、优质 / 耐候作物、巨型作物各算一样（按仓库里这一样本身的数量）；换种集：种子。
  festPickable(kind = this.festivalKind()) {
    const each = (id) => (id.startsWith("giant_") ? 1 : FEST_PICK[kind].each);
    const byPrice = (a, b) => (ITEMS[b].sell || 0) - (ITEMS[a].sell || 0);
    if (kind === "harvest")
      return Object.keys(CROPS)
        .filter((id) => !CROPS[id].hybrid && ITEMS[id])
        .flatMap((id) => [id, "fine_" + id, "hardy_" + id, "giant_" + id])
        .filter((id) => ITEMS[id] && this.qty(id, true) >= each(id))
        .sort(byPrice);
    if (kind === "seeds")
      return Object.keys(ITEMS)
        .filter((id) => ITEMS[id].type === "seed" && !ITEMS[id].mystery && ITEMS[id].crop && this.qty(id, true) >= each(id))
        .sort(byPrice);
    return (FEST_PICK[kind] || []).map((o) => o.id);
  }
  festPicked(kind = this.festivalKind()) {
    const f = this.hn?.fest;
    if (!f || f.day !== this.s.day) return [];
    const ok = this.festPickable(kind);
    return f.pick.filter((id) => ok.includes(id));
  }
  festPick(id) {
    if (!this.hn) return false;
    const kind = this.festivalKind(),
      f = this.hn.fest;
    if (f.day !== this.s.day) Object.assign(f, { day: this.s.day, pick: [] });
    if (!this.festPickable(kind).includes(id)) return false;
    if (kind === "harvest" || kind === "seeds") {
      if (f.pick.includes(id)) f.pick = f.pick.filter((x) => x !== id);
      else if (f.pick.length < FEST_PICK[kind].n) f.pick = [...f.pick, id];
      else f.pick = [...f.pick.slice(1), id];
    } else f.pick = [id];
    return true;
  }
  // 交什么：挑了就交挑的，没挑照原来的办法
  festivalPay(kind = this.festivalKind()) {
    if (!this.hn || kind !== this.festivalKind() || !this.isFestivalDay?.()) return super.festivalPay(kind);
    const pick = this.festPicked(kind);
    if (kind === "harvest" || kind === "seeds") {
      if (pick.length < FEST_PICK[kind].n) return super.festivalPay(kind);
      return Object.fromEntries(pick.map((id) => [id, id.startsWith("giant_") ? 1 : FEST_PICK[kind].each]));
    }
    const opt = (FEST_PICK[kind] || []).find((o) => o.id === pick[0]);
    return opt ? { ...opt.cost } : super.festivalPay(kind);
  }
  festScore(kind, pay) {
    if (!pay) return 0;
    if (kind === "harvest" || kind === "seeds")
      return Object.entries(pay).reduce((a, [id, n]) => {
        const it = ITEMS[id] || {};
        const mult = kind === "seeds" ? (it.trait ? 2 : 1) * (CROPS[it.crop]?.variety ? 3 : 1) : 1;
        return a + (it.sell || 0) * n * mult;
      }, 0);
    return 0;
  }
  festTier(kind = this.festivalKind(), pay = this.festivalPay(kind)) {
    if (!pay) return 1;
    if (kind === "harvest" || kind === "seeds") {
      const v = this.festScore(kind, pay),
        t = FEST_PICK[kind].tiers;
      return v < t[0] ? 0 : v < t[1] ? 1 : v < t[2] ? 2 : 3;
    }
    const opt = (FEST_PICK[kind] || []).find((o) => Object.entries(o.cost).every(([k, n]) => pay[k] === n) && Object.keys(pay).length === Object.keys(o.cost).length);
    return opt ? opt.tier : 1;
  }
  hostFestival() {
    const kind = this.festivalKind(),
      pay = this.hn ? this.festivalPay(kind) : null,
      tier = this.hn ? this.festTier(kind, pay) : 1;
    const ok = super.hostFestival();
    if (ok && this.hn) {
      const m = FEST_PICK.morale[tier];
      this.residentsMood(m);
      this.noiseAdd(NOISE.festival, "festival");
      const text = "供品评语：" + FEST_PICK.words[tier] + "——全营士气 " + (m > 0 ? "+" : "") + m + "。";
      this.toast(text, m > 0 ? "gold" : "warn");
      if (this.o) this.olog(text, m > 0 ? "gold" : "warn");
      this.hn.fest = { day: this.s.day, pick: [], tier };
    }
    return ok;
  }

  // ================= 档案馆「往事」一柜 =================
  pastDone() {
    const m = this.w?.museum;
    return !!m && PAST.cats.every((c) => m.claimed.includes(c));
  }
  pastHave() {
    const m = this.w?.museum;
    return m ? PAST.cats.reduce((a, c) => a + Math.min(m[c].length, this.showcaseNeed(c)), 0) : 0;
  }
  pastNeed() {
    return PAST.cats.reduce((a, c) => a + this.showcaseNeed(c), 0);
  }
  completeShowcase(cat) {
    if (!this.hn || !PAST.cats.includes(cat)) return super.completeShowcase(cat);
    const m = this.w.museum;
    if (!m.claimed.includes(cat)) m.claimed.push(cat);
    const text = this.pastDone()
      ? "「往事」一柜填满了：到档案馆挑一样回礼（往事陈列柜，或老地图）。"
      : "「往事」一柜的「" + { logs: "日志", photos: "照片", relics: "遗物" }[cat] + "」一层摆满了（" + this.pastHave() + "/" + this.pastNeed() + "）。";
    this.toast(text, "gold");
    this.olog(text, "gold");
  }
  pastReason(id) {
    if (!this.hn || !PAST.rewards[id]) return "没有这样回礼";
    if (!this.pastDone()) return "「往事」一柜还没填满（" + this.pastHave() + "/" + this.pastNeed() + "）";
    if (this.hn.past.pick) return "已经挑过了";
    if (!this.museumHere()) return "到档案馆再挑";
    return "";
  }
  pastChoose(id) {
    const reason = this.pastReason(id);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    this.hn.past.pick = id;
    if (id === "map") {
      this.grantResearch?.(PAST.rewards.map.credits);
      this.addReputation(PAST.rewards.map.rep);
    }
    this.syncKeepsake();
    const text = id === "keepsake" ? "苏砚把「往事陈列柜」送给了你：在建造菜单里放进一间房（免费，只有一件）。" : "苏砚把一张老地图交给你：蓝图凭证 +" + PAST.rewards.map.credits + "，声望 +" + PAST.rewards.map.rep + "。";
    this.toast(text, "gold");
    this.olog(text, "gold");
    return true;
  }
  // 往事陈列柜：挑了它、还没摆上时，建造菜单里才有
  syncKeepsake() {
    if (BUILDINGS.hnKeepsake) BUILDINGS.hnKeepsake.retired = !(this.hn?.past.pick === "keepsake" && !this.s.buildings.some((b) => b.type === "hnKeepsake"));
  }
  startBuild(type) {
    this.syncKeepsake();
    if (type === "hnKeepsake") {
      if (this.hn?.past.pick !== "keepsake") {
        this.toast("「往事」一柜填满、挑了陈列柜以后才有这件。", "warn");
        return false;
      }
      if (this.s.buildings.some((b) => b.type === "hnKeepsake")) {
        this.toast("往事陈列柜只有一件，已经摆上了。", "warn");
        return false;
      }
    }
    return super.startBuild(type);
  }

  // ================= 江伯的鱼汛 =================
  fishSince() {
    const f = this.hn?.fish;
    if (f && !f.since && this.ss?.jiang.phase === "done") f.since = this.s.day;
    return f?.since || 0;
  }
  fishRunDay(day = this.s.day) {
    const s = this.fishSince();
    return s > 0 && day > s && (day - s) % FISH_RUN.every === FISH_RUN.offset;
  }
  fishRunKind(day = this.s.day) {
    return FISH_RUN.kinds[Math.floor(this.hnRoll("fish", day) * FISH_RUN.kinds.length) % FISH_RUN.kinds.length];
  }
  nextFishRun(from = this.s.day) {
    if (!this.fishSince()) return 0;
    for (let d = from; d < from + FISH_RUN.every + 1; d++) if (this.fishRunDay(d)) return d;
    return 0;
  }
  hookFish() {
    const before = { ...this.s.inventory };
    const ok = super.hookFish();
    if (ok && this.hn && this.s.region === "farm" && this.fishRunDay()) {
      const kind = this.fishRunKind();
      if ((this.s.inventory[kind] || 0) > (before[kind] || 0)) {
        this.receive({ [kind]: FISH_RUN.extra });
        this.hnStat("fishRuns");
        this.toast("鱼汛：" + ITEMS[kind].name + "成群，多钓上一条！", "gold");
      }
    }
    return ok;
  }
  jiangStays() {
    return !!this.ss && this.ss.jiang.phase === "done" && this.festivalsOpen?.();
  }

  // ================= 麦穗巡夜 =================
  patrolOn() {
    return !!this.hn && !!this.dogSkill?.(DOG_PATROL.id) && this.dogHome();
  }
  tickProwl() {
    if (this.patrolOn()) {
      const u = this.ut,
        m = this.s.minute,
        night = m >= PROWL.from || m < PROWL.to,
        key = m >= PROWL.from ? this.s.day : this.s.day - 1;
      if (night && u && u.prowl !== key) {
        u.prowl = key;
        const r = rngOf(hashOf(u.seed, "prowl", key));
        const would = this.phaseAt(key) >= PROWL.phase && !this.decree?.("curfew") && r() < PROWL.chance;
        u.prowlOn = false;
        if (would) {
          this.hnStat("patrols");
          if (this.o) this.olog("夜里麦穗在营地里转，夜行者在林子边上绕了一圈，没敢进来。");
        }
      }
    }
    return super.tickProwl();
  }
  // 长夜里身后来了感染者：麦穗叫一声
  dogBark() {
    if (!this.ln?.night || this.s.region !== "farm" || !this.dogSkill?.(DOG_PATROL.id) || !this.f?.dog?.rescued) return;
    const now = this.s.playSeconds || 0;
    if (now < (this._hnBarkT || 0)) return;
    const night = this.ln.night.day;
    if (this._hnBarkNight !== night) {
      this._hnBarkNight = night;
      this._hnBarked = new Set();
      this._hnBarkSaid = false;
    }
    const p = this.s.player,
      face = p.facing ?? 0;
    const z = this.enemies.find((z) => {
      if (z.dead || z.lying || this._hnBarked.has(z.id)) return false;
      const r = dist(z, p);
      if (r > DOG_PATROL.r || r < DOG_PATROL.near) return false;
      let d = Math.abs(Math.atan2(z.y - p.y, z.x - p.x) - face);
      if (d > Math.PI) d = Math.PI * 2 - d;
      return d > DOG_PATROL.behind;
    });
    if (!z) return;
    this._hnBarked.add(z.id);
    this._hnBarkT = now + DOG_PATROL.cd;
    const d = this.f.dog;
    if (this.ux) this.ux.bark = { t: 1.6, x: d.x ?? p.x, y: d.y ?? p.y, zx: z.x, zy: z.y };
    this.events.push({ type: "dogGrowl", x: d.x ?? p.x, y: d.y ?? p.y });
    this.hnStat("barks");
    // 一晚只弹一次字，之后只有叫声和画面上的提示
    if (!this._hnBarkSaid) {
      this._hnBarkSaid = true;
      this.toast("麦穗冲你身后叫了一声！（长夜里身后来了感染者它就叫）", "warn");
    }
  }
  // 夜里麦穗在营地里转（它留在农场、不跟着你的时候）
  dogPatrolWalk() {
    if (!this.patrolOn() || this.s.region !== "farm" || !this.isNight() || this.b?.dog?.mode === "follow" || this.ln?.night) return;
    const d = this.f?.dog;
    if (!d) return;
    const t = (this.absNow() / 3) % PATROL_PATH.length,
      i = Math.floor(t),
      k = t - i,
      a = PATROL_PATH[i],
      b = PATROL_PATH[(i + 1) % PATROL_PATH.length];
    d.x = a.x + (b.x - a.x) * k;
    d.y = a.y + (b.y - a.y) * k;
    d.hnPatrol = true;
  }

  // ================= 场景里的东西、按 E =================
  assignRegion() {
    super.assignRegion();
    if (!this.hn || !Array.isArray(this.objects)) return;
    const n = this.ss?.canteen.night;
    if (this.s.region === "farm") {
      if (n) {
        this.objects.push({ type: "hnStove", name: "何大勺的灶台", x: PLAZA.x + CANTEEN2.stove.dx, y: PLAZA.y + CANTEEN2.stove.dy, icon: 40 });
        n.customers.forEach((g, i) => {
          if (g.state !== "waiting") return;
          const q = this.guestSeat(i);
          this.objects.push({ type: "hnGuest", name: g.name, gid: g.id, x: q.x, y: q.y, icon: 40 });
        });
      }
      if (this.jiangStays()) this.objects.push({ type: "hnJiang", name: "江伯 · 鱼汛", x: FISH_RUN.spot.x, y: FISH_RUN.spot.y, icon: 40 });
    }
    const d = this.dropHere();
    if (d) {
      if (!d.fixed) {
        const q = this.freePoint?.(d.x, d.y) || d;
        d.x = q.x;
        d.y = q.y;
        d.fixed = true;
      }
      this.objects.push({ type: "hnDrop", name: "空投箱", x: d.x, y: d.y, icon: 40 });
      // 去晚了：箱子边围上感染者
      if (!d.ring && this.absNow() - d.at > DROP.late) {
        d.ring = true;
        for (let i = 0; i < DROP.guards; i++) {
          const a = (i / DROP.guards) * Math.PI * 2,
            q = this.freePoint?.(clamp(Math.round(d.x + Math.cos(a) * 70), 80, WORLD.w - 80), clamp(Math.round(d.y + Math.sin(a) * 60), 90, WORLD.h - 90)) || { x: d.x + 60, y: d.y },
            z = this.enemy(i % 2 ? "runner" : "slow", q.x, q.y, false);
          Object.assign(z, { hnDrop: true, homeX: q.x, homeY: q.y });
          this.enemies.push(z);
        }
        this.toast("空投箱边已经围了 " + DROP.guards + " 只感染者——来晚了。", "warn");
      }
    }
    this.muleEscortSpawn();
  }
  context(o) {
    if (this.hn && !this.c?.fishing) {
      if (o?.type === "hnStove") {
        const c = this.hn.carry;
        return c ? "手里端着" + ITEMS[c.dish].name + " · 按 E 放回去" : "何大勺的灶台 · 按 E 端菜";
      }
      if (o?.type === "hnGuest") {
        const g = this.ss?.canteen.night?.customers.find((x) => x.id === o.gid);
        if (g) return g.name + "想吃" + (g.dish ? ITEMS[g.dish].name : TASTES[g.taste].name) + (this.hn.carry ? " · 按 E 上" + ITEMS[this.hn.carry.dish].name : " · 先去灶台端菜");
      }
      if (o?.type === "hnDrop") return "空投箱 · 按 E 打开";
      if (o?.type === "hnJiang") {
        const d = this.nextFishRun();
        return "江伯 · " + (d === this.s.day ? "今天鱼汛：" + ITEMS[this.fishRunKind()].name + "多一倍" : d ? "下一次鱼汛：第 " + d + " 天" : "鱼汛");
      }
      if (o?.type === "building" && o.building.type === "rain") return "雨水桶 · 按 E 补满水壶" + (o.building.hnUp ? "（" + UPGRADES.rain.paths[o.building.hnUp].name + "）" : "");
      if (o?.type === "radioStation" && this.r?.radio && this.w) return "通信站 · 电台节目和电台指令";
      if (o?.type === "outpostMule" && this.muleOpen()) {
        const t = this.hn.mule.trip;
        return t ? "红薯拉车去" + MULE.dest[t.dest].short + "了 · 按 E 看这一趟" : "红薯 · 跑商（工钱：萝卜）";
      }
    }
    return super.context(o);
  }
  buildingContext(b) {
    if (b?.type === "medCabinet") return "药柜 · 看看情况";
    if (b?.type === "hnKeepsake") return "往事陈列柜 · 看看";
    return super.buildingContext(b);
  }
  interact() {
    if (this.paused) return;
    if (!this.hn || this.c?.fishing) return super.interact();
    const o = this.nearestObject?.();
    if (o?.type === "hnStove") return void this.stoveDish();
    if (o?.type === "hnGuest") return void this.serveCarry(o.gid);
    if (o?.type === "hnDrop") return void this.openDrop();
    if (o?.type === "hnJiang") return void this.emit("menu", { menu: "outpost", view: "hnJiang", id: "" });
    return super.interact();
  }

  // ================= 每帧、每个钟点、每天 =================
  update(dt, input = {}) {
    const intro = !this.paused && this.hn?.intro;
    if (intro && !intro.told) {
      intro.told = true;
      const text =
        "热闹：营地里吵的事会攒「动静」（顶栏），0 点结算，4 以上当夜有感染者循声摸来；通信站能发电台指令，红薯能跑商，瞭望塔、陷阱、围栏、喷灌头、篝火灶、雨水桶能二选一改良；伤员要医务室，房间有了舒适度，食堂在广场上走着端菜，节庆自己挑供品。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    }
    const on = !!this.hn && !this.paused,
      st0 = this.s.player.stamina,
      snap = on && this.s.region === "farm" ? this.fenceSnapshot() : null,
      towerHp = on && this.s.region === "farm" && this.touchFight() ? this.s.buildings.filter((b) => b.type === "tower" && b.hp > 0).map((b) => [b, b.hp]) : null;
    const out = super.update(dt, input);
    if (!on) return out;
    // 休息好：体力恢复快五成
    const p = this.s.player;
    if (this.restedNow() && p.stamina > st0) {
      const cap = this.maxSta();
      p.stamina = Math.min(Math.max(cap, st0), st0 + (p.stamina - st0) * COMFORT.rested.stamina);
    }
    if (snap?.length) this.fenceAfter(snap);
    this.touchCheck(towerHp);
    if (!this.touchFight()) this.hurtSettle();
    this.updateAllies(clamp(dt, 0, 0.1));
    this.muleEscortCheck();
    this.dogBark();
    this.dogPatrolWalk();
    // 手里端的菜：食堂打烊了就没了
    if (this.hn.carry && !this.ss?.canteen.night) this.hn.carry = null;
    // 网住的：网松开了就不再写“网住了”
    for (const z of this.enemies || []) if (z.netHeld && !(z.trapHeld > 0)) z.netHeld = false;
    this.syncKeepsake();
    return out;
  }
  workHour() {
    // 循声来的感染者还在：0 点前排了守卫岗的人这个钟点只管守塔
    const night = this.hn?.attack.state === "live" ? this.nightGuards() : [],
      keep = night.map((r) => [r, r.priorities]);
    for (const r of night) r.priorities = { ...Object.fromEntries(Object.keys(r.priorities || {}).map((k) => [k, 0])), guard: 1 };
    try {
      super.workHour();
    } finally {
      for (const [r, p] of keep) r.priorities = p;
    }
    if (!this.hn) return;
    const h = Math.floor(this.s.minute / 60);
    if (!this.touchFight()) this.hurtSettle();
    this.twinStaff();
    this.healCheck();
    // 伤员：躺在医务室（没有就回屋）
    const room = this.infirmary();
    for (const r of this.c.residents) {
      if (!this.laidUp("r:" + r.id)) continue;
      r.status = "养伤（还要 " + Math.ceil(this.hurtLeft("r:" + r.id) / 60) + " 个钟点）";
      if (room) r.target = { x: room.floor.x + 20 * (this.c.residents.indexOf(r) - 1), y: room.floor.y + 30 };
    }
    // 歇着的居民：房间越舒服疲劳降得越快
    if (this.rooms) {
      const rooms = this.rooms().filter((x) => x.active);
      if (rooms.length)
        for (const r of this.c.residents) {
          if (this.residentActive(r)) continue;
          const at = rooms.find((x) => r.target && dist(r.target, { x: x.floor.x, y: x.floor.y + 35 }) < 60) || rooms.sort((a, b) => this.roomComfort(b) - this.roomComfort(a))[0];
          const extra = this.roomComfort(at) * COMFORT.restFatigue;
          if (extra > 0) r.fatigue = clamp((r.fatigue || 0) - extra, 0, 100);
        }
    }
    // 学习室：带徒、改学职能快一倍（每天早上多算一天）
    if (h === 6 && this.studyRoom()) {
      if (this.ss?.apprentice) this.ss.apprentice.start -= 1;
      if (this.td?.retrain) this.td.retrain.start -= 1;
    }
    if (h === NOISE.flee / 60) this.noiseDawn();
    // 红薯：到了 08:00 就回来（错过那个钟点也照样回来）
    if (this.hn.mule.trip) this.muleReturn();
  }
  onNewDay() {
    // 0 点前排了守卫岗、吃过晚饭的人：循声来的感染者要是今晚到，他们接着守（0 点会把“吃过饭”清掉）
    const guards = this.hn ? this.c.residents.filter((r) => ((r.priorities?.guard || 0) > 0 || r.role === "guard") && r.fed && !this.laidUp("r:" + r.id)).map((r) => r.id) : [];
    super.onNewDay();
    if (!this.hn) return;
    this.noiseSettle(guards);
    this.fishSince();
    const day = this.s.day;
    if (this.hn.drop && (this.hn.drop.opened || this.hn.drop.until < day)) {
      if (!this.hn.drop.opened && this.o) this.olog("空投箱在" + this.regionName(this.hn.drop.region) + "放了两天，被别人捡走了。");
      this.hn.drop = null;
    }
    for (const [k, v] of Object.entries(this.hn.hurtNight)) if (v < day - 3) delete this.hn.hurtNight[k];
    if (this.hn.fest.day && this.hn.fest.day < day) this.hn.fest = { day: 0, pick: [] };
    if (this.hn.scout.day && this.hn.scout.day < day) this.hn.scout = { day: 0, text: "" };
    // 不在了的人不算伤员
    for (const k of Object.keys(this.hn.hurt)) {
      const [kind, id] = [k.slice(0, 2), k.slice(2)];
      if (kind === "r:" && !this.c.residents.some((r) => r.id === id)) delete this.hn.hurt[k];
      if (kind === "c:" && !(this.o?.crew || []).some((c) => c.id === id)) delete this.hn.hurt[k];
    }
  }

  // ================= 存档 =================
  static parse(text) {
    const s = BountyEngine.parse(text);
    migrateState(s);
    validateBustle(s);
    return s;
  }
}

function validateBustle(s) {
  const t = s.bustle,
    bad = (why) => {
      throw new Error("存档里的营地记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
    };
  if (!t || typeof t !== "object") bad("缺少");
  const int = (v, lo = 0, hi = 1e9) => Number.isInteger(v) && v >= lo && v <= hi,
    num = (v, lo = 0, hi = 1e9) => Number.isFinite(v) && v >= lo && v <= hi,
    obj = (v) => !!v && typeof v === "object" && !Array.isArray(v),
    str = (v, n = 40) => typeof v === "string" && v.length <= n,
    bundle = (b, max = 99) => obj(b) && Object.entries(b).every(([id, n]) => ITEMS[id] && int(n, 1, max));
  if (!int(t.schema, 1, 99)) bad("版本");
  const z = t.noise;
  if (!obj(z) || !num(z.v, 0, NOISE.max) || !int(z.day) || !Array.isArray(z.log) || z.log.length > NOISE.log) bad("动静");
  for (const r of z.log) if (!obj(r) || !NOISE_SRC[r.src] || !num(r.n, 0, NOISE.max) || !int(r.t, 0, 1440)) bad("动静");
  if (z.last !== null && z.last !== undefined && (!obj(z.last) || !int(z.last.day) || !num(z.last.v, 0, NOISE.max) || !int(z.last.n, 0, 20))) bad("动静");
  const a = t.attack;
  if (!obj(a) || !int(a.day) || !int(a.n, 0, 20) || !int(a.dir, 0, 3) || !["", "live", "done"].includes(a.state) || !str(a.report ?? "", 300) || (a.why !== undefined && !str(a.why, 200))) bad("夜袭");
  if (!Array.isArray(a.guards) || a.guards.length > 8 || a.guards.some((id) => !str(id, 24))) bad("夜袭");
  if (!obj(t.cmd) || Object.keys(t.cmd).some((k) => !RADIO_CMD_IDS.includes(k)) || Object.values(t.cmd).some((v) => !int(v))) bad("电台指令");
  if (!obj(t.scout) || !int(t.scout.day) || !str(t.scout.text, 400)) bad("电台指令");
  const d = t.drop;
  if (d !== null && (!obj(d) || !int(d.day) || !CACHE_SPOTS[d.region] || !num(d.x, 0, WORLD.w) || !num(d.y, 0, WORLD.h) || !bundle(d.items) || !num(d.at, 0, 1e12) || !int(d.until) || typeof d.opened !== "boolean")) bad("空投");
  const h = t.help;
  if (!obj(h) || typeof h.armed !== "boolean" || typeof h.live !== "boolean" || !int(h.day) || !Array.isArray(h.allies) || h.allies.length > ALLY.names.length + 2) bad("求援");
  for (const x of h.allies) if (!obj(x) || !str(x.id, 4) || !str(x.name, 12) || !num(x.x, 0, WORLD.w) || !num(x.y, 0, WORLD.h) || !num(x.hp, 0, ALLY.hp) || typeof x.down !== "boolean") bad("求援");
  const m = t.mule;
  if (!obj(m) || !int(m.next) || !obj(m.plan) || !MULE.dest[m.plan.dest] || !MULE.backs.includes(m.plan.back) || !(obj(m.plan.load) && Object.entries(m.plan.load).every(([id, n]) => ITEMS[id] && int(n, 1, MULE.max)))) bad("跑商");
  if (!Array.isArray(m.log) || m.log.length > MULE.log || m.log.some((r) => !obj(r) || !int(r.day) || !MULE.dest[r.dest] || !int(r.money, 0, 1e7) || !(obj(r.got) && Object.entries(r.got).every(([id, n]) => ITEMS[id] && int(n, 0, 999))))) bad("跑商");
  const tr = m.trip;
  if (tr !== null && tr !== undefined && (!obj(tr) || !int(tr.day) || !MULE.dest[tr.dest] || !str(tr.map, 24) || !MULE.backs.includes(tr.back) || !bundle(tr.load, MULE.max) || !int(tr.value, 0, 1e7) || !num(tr.returns, 0, 1e12) || !Array.isArray(tr.foes) || tr.foes.length > 8)) bad("跑商");
  if (!obj(t.up) || Object.entries(t.up).some(([k, v]) => !UPGRADES[k] || !UPGRADES[k].paths[v])) bad("改良");
  for (const b of s.buildings || []) if (b.hnUp !== undefined && !UPGRADES[upClassOf(b.type)]?.paths[b.hnUp]) bad("改良");
  if (!obj(t.hurt) || Object.keys(t.hurt).length > 20) bad("伤员");
  for (const [k, v] of Object.entries(t.hurt)) if (!FIGHT_KEYS.includes(k.slice(0, 2)) || k.length > 40 || !obj(v) || !num(v.at, 0, 1e12) || !num(v.until, 0, 1e12) || !["", "bandage", "medkit"].includes(v.care) || !str(v.name, 20) || (v.fight !== undefined && typeof v.fight !== "boolean")) bad("伤员");
  if (!obj(t.hurtNight) || Object.keys(t.hurtNight).length > 40 || Object.values(t.hurtNight).some((v) => !Number.isInteger(v))) bad("伤员");
  if (!obj(t.rested) || !num(t.rested.until, 0, 1e12) || !int(t.rested.comfort, 0, COMFORT.max)) bad("休息");
  if (!obj(t.fest) || !int(t.fest.day) || !Array.isArray(t.fest.pick) || t.fest.pick.length > 3 || t.fest.pick.some((x) => !str(x, 40))) bad("节庆");
  if (!obj(t.past) || !["", ...Object.keys(PAST.rewards)].includes(t.past.pick)) bad("往事");
  if (!obj(t.fish) || !int(t.fish.since)) bad("鱼汛");
  if (t.carry !== null && t.carry !== undefined && (!obj(t.carry) || !ITEMS[t.carry.dish] || !str(t.carry.guest, 8))) bad("食堂");
  if (t.intro !== undefined && (!obj(t.intro) || !int(t.intro.day) || typeof t.intro.told !== "boolean")) bad("记录");
  if (!obj(t.stats) || Object.values(t.stats).some((v) => !int(v))) bad("记录");
}
