// v0.25.0「长夜」：主线打完以后的终局。
// 长夜：主线第 8 段打完后每 7 天一个（第 7n+3 天，和节庆错开 3 天），08:00 日期变红，18:00 天边发红、打雷，
// 22:00 一声尖叫，三波尸潮来农场，第三波有头目；守到 04:00 天亮或三波打完就算守住；倒下就是没守住（照章节防守失守的规矩）。
// 守住一个，下一个多两成，最多一倍；守住了给稀有和珍贵掉落、档案馆的纪念品；守满 10 个有结局卡。
// 灰隼团反扑：主线打完后第 5 天废墟里两个探子，第 7 天 23:00 两个人摸进农场破坏一座设施，第 10 天 19:00 头领“隼头”带人来
// （用原来灰隼团袭击的规矩：枪手找掩体、瞄准 1 秒；头领有枪、扔烟雾弹、不撤退，他倒下剩下的就跑）。
// 出身：新开一局时选（种地的、卫生员、猎人、机修工、退伍兵），只改开局带的东西和一两条规则；
// 二周目：主线打完后“带着记忆重新开始”，带学会的图纸、成就册、生涯记录和一件自选装备（耐久满的）。
// 新进度放在 s.longnight，原来的字段不动；刷怪的计时、雷声、烟雾这些只在内存里。
import { Engine as UndertowEngine, freshState as utFresh, migrateState as utMigrate, newGameState as utNewGame, hashOf, rngOf } from "./undertow.js";
import { ITEMS, WORLD, BUILDINGS, REGIONS } from "./data.js";
import { HORDE_DIRECTIONS } from "./expansion-data.js";
import { BOSSES, KINDS, KIND_IDS, RUINS, EVENT_SPOTS } from "./undertow-data.js";
import { RULES, TRAPS, slotOf, gearDef } from "./gear-data.js";
import { CAREER } from "./feel-data.js";
import { LN_SCHEMA, LN, WAVE_MIX, LN_BOSSES, LN_REWARD, MEMENTO_AT, MEMENTO_IDS, LN_CASE, ENDING, COUNTER, LEADER, SAB_TARGETS, SCOUT_MAP, COUNTER_REWARD, ORIGINS, ORIGIN_IDS, LEGACY } from "./longnight-data.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// 超过游戏里几天没导出存档，睡觉时提醒一次
const EXPORT_REMIND = 7;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// 自己写了感染者每帧怎么动的几种：尸潮里也要直奔你来
const CUSTOM_AI = ["spitter", "stalker", "brute", "nurse"];
const HOW = ["dawn", "cleared", "down"];
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " ×" + n)
    .join("、");

const RAID_PHASES = ["none", "scheduled", "warning", "active", "won"];
const SAB_RESULTS = ["", "foiled", "blown", "guards", "blownAway", "none"];
const raidRec = () => ({ phase: "none", day: 0, timer: 0, total: 0, spawned: 0, killed: 0, retreated: 0, spawnTimer: 0, clock: 0, tries: 0, report: null });
// 灰隼团反扑：step 0 还没开始，1 探子，2 夜里的破坏，3 头领带人来，4 打完了
const counterDefaults = () => ({ step: 0, day: 0, region: "", spot: 0, scouts: 0, fled: 0, intel: false, target: "", sab: "", sabOn: false, sabDown: 0, warned: 0, leader: 0, raid: raidRec(), done: false });
const lnDefaults = () => ({
  schema: LN_SCHEMA,
  // 主线打完的那天（0 = 还没打完）；旧档读进来时已经打完的，按读进来那天算
  storyDay: 0,
  held: 0,
  tried: 0,
  failed: 0,
  kills: 0,
  // 最近一个已经开始（或错过）的长夜是哪天
  lastDay: 0,
  night: null,
  last: null,
  ended: false,
  endDay: 0,
  mementos: [],
  caseDone: false,
  marks: { red: 0, dusk: 0, warn: 0, nap: 0 },
  counter: counterDefaults(),
  // 出身（旧档都是“种地的”）、二周目带过来的东西
  origin: "farmer",
  legacy: null,
  // 上次导出存档是第几天（0 = 还没导出过）、哪天提醒过
  exportDay: 0,
  remindDay: 0,
  seen: {},
});

export function migrateState(s) {
  utMigrate(s);
  const d = lnDefaults();
  if (!s.longnight) s.longnight = d;
  else {
    const x = s.longnight;
    s.longnight = {
      ...d,
      ...x,
      night: x.night ? { ...x.night } : null,
      last: x.last ? { ...x.last, items: { ...x.last.items } } : null,
      mementos: [...(x.mementos || [])],
      marks: { ...d.marks, ...x.marks },
      counter: { ...d.counter, ...x.counter, raid: { ...d.counter.raid, ...x.counter?.raid } },
      legacy: x.legacy ? { ...x.legacy, book: [...(x.legacy.book || [])] } : null,
      seen: { ...x.seen },
    };
  }
  return s;
}
export function freshState() {
  const s = utFresh();
  s.longnight = lnDefaults();
  return migrateState(s);
}
export function newGameState(origin = "farmer") {
  const s = utNewGame();
  s.longnight = lnDefaults();
  applyOrigin(s, origin);
  return migrateState(s);
}
// 出身：开局多带的、少带的、穿上的
function applyOrigin(s, id) {
  const key = ORIGINS[id] ? id : "farmer",
    def = ORIGINS[key];
  s.longnight.origin = key;
  for (const [k, n] of Object.entries(def.take || {})) {
    s.inventory[k] = Math.max(0, (s.inventory[k] || 0) - n);
    if (!s.inventory[k]) delete s.inventory[k];
  }
  for (const [k, n] of Object.entries(def.give || {})) s.inventory[k] = (s.inventory[k] || 0) + n;
  if (s.gear)
    for (const k of def.wear || []) {
      const slot = slotOf(k);
      if (slot) s.gear.slots[slot] = k;
    }
}
// 二周目：新的一局（照选的出身），带上学会的图纸、生涯记录、成就册的快照，再加一件自选的装备
export function legacyGear(old) {
  const have = new Set([...Object.keys(old?.inventory || {}), ...Object.keys(old?.storage || {})].filter((id) => (old.inventory?.[id] || 0) + (old.storage?.[id] || 0) > 0));
  return [...have].filter((id) => gearDef(id) && slotOf(id) && !ITEMS[id]?.protected).sort();
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  const s = newGameState(origin),
    L = s.longnight,
    prev = old?.longnight || {};
  for (const bp of Object.keys(old?.gear?.bp || {})) if (ITEMS[bp]) s.gear.bp[bp] = 1;
  const trips = old?.feel?.career?.trips;
  if (Array.isArray(trips) && s.feel) s.feel.career.trips = trips.slice(-CAREER.max).map((x) => ({ ...x }));
  const kept = keep && legacyGear(old).includes(keep) ? keep : "";
  if (kept) {
    s.inventory[kept] = (s.inventory[kept] || 0) + 1;
    if (s.gear) {
      delete s.gear.cond[kept];
      const slot = slotOf(kept);
      if (slot && slot !== "throw") s.gear.slots[slot] = kept;
    }
  }
  L.legacy = {
    ng: Math.min(99, (prev.legacy?.ng || 0) + 1),
    fromDay: Math.max(1, Math.min(1e6, old?.day || 1)),
    held: Math.max(0, Math.min(1e6, prev.held || 0)),
    book: [...new Set((book || []).filter((x) => typeof x === "string" && x))].slice(0, LEGACY.book).map((x) => x.slice(0, LEGACY.name)),
    keep: kept,
  };
  return migrateState(s);
}

const lxDefaults = () => ({
  spawnT: 0,
  gap: null,
  thunderT: 6,
  bolt: 0,
  // 头领的烟雾弹：飞着的、炸开的（只在农场）
  grenades: [],
  smoke: [],
  smokeRegion: null,
});

export class Engine extends UndertowEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    // 枪手不写进存档（原来的规矩）：读档后按剩下的人数重新来，头领没倒下就再来一次
    const c = this.s.longnight?.counter;
    if (c?.raid.phase === "active") {
      c.raid.spawned = c.raid.killed + c.raid.retreated;
      if (c.leader === 1) c.leader = 0;
    }
  }
  get ln() {
    return this.s.longnight;
  }
  get lx() {
    return (this._lx ??= lxDefaults());
  }
  absNow() {
    return this.s.day * 1440 + this.s.minute;
  }

  // ================= 主线打完了吗、哪天是长夜 =================
  storyDone() {
    return (this.sc?.claimed || []).includes("act8");
  }
  lnSync() {
    const L = this.ln;
    if (!L || L.storyDay || !this.storyDone()) return;
    L.storyDay = this.s.day;
    this.counterBegin();
    const next = this.nextLongNight();
    const text = "余烬前哨守住了。可林子里的感染者没散：往后每 7 天会有一个“长夜”，第一个在第 " + next + " 天。";
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
  }
  isLongNight(day = this.s.day) {
    const L = this.ln;
    return !!L?.storyDay && day >= L.storyDay + LN.lead && day % LN.every === LN.mod;
  }
  nextLongNight(from = this.s.day) {
    const L = this.ln;
    if (!L?.storyDay) return 0;
    let d = Math.max(from, L.storyDay + LN.lead);
    while (d % LN.every !== LN.mod || (d === this.s.day && L.lastDay === d)) d++;
    return d;
  }
  // 今天是长夜、还没开始
  lnPending(day = this.s.day) {
    return this.isLongNight(day) && this.ln.lastDay !== day && !this.ln.night;
  }
  lnMult(held = this.ln?.held || 0) {
    return Math.min(LN.cap, Math.pow(LN.grow, held));
  }
  waveCount(k, mult) {
    return Math.max(1, Math.round(LN.base[k] * mult));
  }
  nightTotal(mult = this.lnMult()) {
    return LN.base.reduce((a, _, k) => a + this.waveCount(k, mult), 0);
  }
  // 三波从哪边来：按存档种子和日子定，读档不变
  lnDirs(day) {
    const r = rngOf(hashOf(this.ut?.seed || 1, "lnDir", day)),
      list = [0, 1, 2, 3];
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }
  lnBossId(n) {
    return LN_BOSSES[(n - 1) % LN_BOSSES.length];
  }
  // 08:00 起日期变红；长夜打着的时候也红着
  lnRed() {
    if (!this.ln) return false;
    return !!this.ln.night || (this.lnPending() && this.s.minute >= LN.red);
  }
  // 天边发红：18:00 起慢慢红起来，长夜里一直红着（0–1）
  lnSky() {
    if (!this.ln) return 0;
    if (this.ln.night) return 1;
    if (!this.lnPending() || this.s.minute < LN.dusk) return 0;
    return clamp((this.s.minute - LN.dusk) / 120, 0, 1);
  }

  // ================= 每帧 =================
  update(dt, input = { x: 0, y: 0, run: false }) {
    const R = this.ln ? this.originRules() : {},
      p = this.s.player,
      h0 = p.hunger;
    // 猎人：蹲着走快一成
    if (R.crouch && this.f?.crouch && input && !this.paused) input = { ...input, x: (input.x || 0) * R.crouch, y: (input.y || 0) * R.crouch };
    super.update(dt, input);
    // 退伍兵：饿得快一成（只算一点一点掉的，吃东西、出门不算）
    if (R.hunger) {
      const drop = h0 - p.hunger;
      if (drop > 0 && drop < 5) p.hunger = Math.max(0, p.hunger - drop * (R.hunger - 1));
    }
    // 机修工：体力上限少 10
    if (R.stamina && p.stamina > R.stamina) p.stamina = R.stamina;
    if (this.paused || !this.ln) return;
    this.lnTick(clamp(dt, 0, 0.05));
  }
  lnTick(dt) {
    const L = this.ln;
    this.lnSync();
    this.counterTick(dt);
    if (L.night) return this.lnRun(dt);
    const day = this.s.day,
      m = this.s.minute;
    if (!this.lnPending(day)) return;
    if (m >= LN.red && L.marks.red !== day) {
      L.marks.red = day;
      const n = L.tried + 1,
        boss = BOSSES[this.lnBossId(n)].name;
      const text = "今天是长夜（第 " + n + " 个）：今晚 22:00 尸潮会来，分三波，第三波有" + boss + "，一共约 " + this.nightTotal() + " 只。白天把围栏修好、弹药备足；守到 04:00 天亮就算守住。";
      this.toast(text, "warn");
      if (this.o) this.olog(text, "warn");
      this.events.push({ type: "lnRed" });
    }
    if (m >= LN.dusk) {
      if (L.marks.dusk !== day) {
        L.marks.dusk = day;
        this.toast("天边发红了，远处在打雷。离长夜还有四个小时。", "warn");
        this.lnThunder();
      }
      this.lx.thunderT -= dt;
      if (this.lx.thunderT <= 0) this.lnThunder();
    }
    if (m >= LN.warn && L.marks.warn !== day && this.s.region !== "farm") {
      L.marks.warn = day;
      this.toast("长夜一小时后开始：22:00 前回农场，到时候不在也会被叫回去。", "warn");
    }
    if (m >= LN.start) this.lnBegin();
  }
  lnThunder() {
    this.lx.bolt++;
    this.lx.thunderT = this.ln.night ? 26 + Math.random() * 16 : 14 + Math.random() * 12;
    this.events.push({ type: "lnThunder" });
  }

  // ================= 开始 =================
  lnBegin() {
    const L = this.ln,
      day = this.s.day;
    if (L.night || !this.lnPending(day)) return false;
    // 别的仗（普通尸潮、灰隼团、章节防守）还没打完：打完再来
    if (["warning", "active"].includes(this.s.horde.phase)) return false;
    if (this.o && ["warning", "active"].includes(this.raidState?.().phase)) return false;
    if (this.s.region !== "farm") {
      if (!this.travel("farm") || this.s.region !== "farm") return false;
      this.toast("长夜开始了：你赶回了农场。", "warn");
    }
    L.lastDay = day;
    const n = L.tried + 1,
      dirs = this.lnDirs(day);
    L.night = { day, n, mult: Math.round(this.lnMult() * 100), wave: 0, left: 0, made: 0, boss: 0, kills: 0, start: day * 1440 + LN.start, prev: this.s.horde.phase === "locked" ? "locked" : "won" };
    this.s.horde = { phase: "active", timer: 0, remaining: 0, spawnTimer: 0, direction: dirs[0] };
    // 夜里在农场边上转的夜行者回林子里去；这一晚不另外摸过来
    if (this.ut) {
      this.ut.prowl = day;
      this.ut.prowlOn = false;
    }
    this.enemies = this.s.enemies.farm = (this.s.enemies.farm || []).filter((z) => !z.prowl && !z.dead);
    for (const r of this.c?.residents || []) if (r.priorities?.guard) r.workRole = "guard";
    this.lx.spawnT = 0;
    this.lx.gap = null;
    this.lx.thunderT = 20;
    const text = "一声长长的尖叫——长夜开始了！第 " + n + " 个长夜，三波，第三波有" + BOSSES[this.lnBossId(n)].name + "。守到 04:00 天亮。";
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
    this.events.push({ type: "lnScream" });
    this.emit("alarm");
    this.lnWave(1);
    return true;
  }
  lnWave(k) {
    const N = this.ln.night;
    if (!N || k > 3 || k <= N.wave) return;
    N.wave = k;
    N.left += this.waveCount(k - 1, N.mult / 100);
    this.s.horde.remaining = Math.min(100, N.left);
    this.lx.gap = null;
    this.lx.spawnT = Math.min(this.lx.spawnT, 0.4);
    const dirs = this.lnDirs(N.day).slice(0, k),
      from = dirs.map((d) => HORDE_DIRECTIONS[d].name).join("、");
    this.s.horde.direction = dirs[0];
    if (k === 3) this.lx.bossT = LN.bossAfter;
    if (k > 1) {
      this.toast("第 " + k + " 波来了（共 3 波）：从" + from + "过来。" + (k === 3 ? "这一波快打完时，" + BOSSES[this.lnBossId(N.n)].name + "会来。" : ""), "warn");
      this.events.push({ type: "lnWave", wave: k });
    } else this.toast("第 1 波：从" + from + "过来。", "warn");
  }
  lnSpawnBoss() {
    const N = this.ln.night,
      id = this.lnBossId(N.n),
      B = BOSSES[id],
      dir = this.lnDirs(N.day)[0],
      pt = HORDE_DIRECTIONS[dir].spawns[0],
      q = this.freePoint(pt[0], pt[1]),
      z = this.enemy(B.type, q.x, q.y, true);
    Object.assign(z, { boss: id, lnBoss: true, bossDay: this.s.day, state: "chase", alert: 8, homeX: q.x, homeY: q.y, targetX: this.s.player.x, targetY: this.s.player.y, sct: 6, pct: B.pulse?.every || 0, scd: 0, dcd: 2 });
    z.hp = z.maxHp = Math.round(z.maxHp * LN.bossHp);
    this.enemies.push(z);
    N.boss = 1;
    // 第一次碰上这个头目时会弹出怎么打的说明；碰上过的，这里再提一句
    const seen = this.ut?.seen?.["boss:" + id];
    this.toast(B.name + "来了！" + (seen ? (id === "brute" ? "地上一圈红是要砸地，一条线是要扔车门；绕到背后打。" : "她吸气时打她一下就能打断尖叫；绿圈会给身边的感染者回血。") : ""), "warn");
    this.events.push({ type: "lnBoss", x: z.x, y: z.y, boss: id });
  }
  // 出一只：种类按这一波的份数抽，从这一波的几个方向轮着来
  lnSpawn() {
    const N = this.ln.night,
      k = clamp(N.wave, 1, 3),
      r = rngOf(hashOf(this.ut?.seed || 1, "lnz", N.day, N.made)),
      mix = Object.entries(WAVE_MIX[k - 1]),
      total = mix.reduce((a, [, w]) => a + w, 0);
    let x = r() * total,
      type = mix[0][0];
    for (const [t, w] of mix) {
      if (x < w) {
        type = t;
        break;
      }
      x -= w;
    }
    const dirs = this.lnDirs(N.day).slice(0, k),
      dir = dirs[N.made % dirs.length],
      pt = HORDE_DIRECTIONS[dir].spawns[Math.floor(N.made / dirs.length) % 2],
      q = this.freePoint(clamp(pt[0] + (r() - 0.5) * 60, 80, WORLD.w - 80), clamp(pt[1] + (r() - 0.5) * 60, 90, WORLD.h - 90)),
      z = this.enemy(type, q.x, q.y, true);
    z.lnWave = k;
    this.enemies.push(z);
    N.left--;
    N.made++;
    return z;
  }
  hordeAlive() {
    return (this.s.enemies.farm || []).filter((z) => z.horde && !z.dead);
  }

  // ================= 打着的时候 =================
  lnRun(dt) {
    const N = this.ln.night,
      lx = this.lx;
    if (this.s.region !== "farm") return;
    if (this.absNow() >= N.start + LN.length) return this.lnHold("dawn");
    const alive = this.hordeAlive().length;
    if (N.left > 0 && alive < LN.maxAlive) {
      lx.spawnT -= dt;
      if (lx.spawnT <= 0) {
        this.lnSpawn();
        lx.spawnT = LN.interval;
      }
    }
    if (N.wave < 3) {
      const due = this.absNow() >= N.start + LN.waveAt[N.wave];
      if (due) this.lnWave(N.wave + 1);
      else if (N.left === 0 && !alive) {
        if (lx.gap == null) {
          lx.gap = LN.gap;
          this.toast("这一波打完了。下一波 " + LN.gap + " 秒后到，抓紧补给、修围栏。", "gold");
        }
        lx.gap -= dt;
        if (lx.gap <= 0) this.lnWave(N.wave + 1);
      }
    } else if (!N.boss) {
      // 头目等第三波快打完（场上剩 4 只以下）再来，最多等 75 秒
      lx.bossT = (lx.bossT ?? LN.bossAfter) - dt;
      if (N.left === 0 && (alive <= LN.bossWhen || lx.bossT <= 0)) this.lnSpawnBoss();
    } else if (N.left === 0 && !alive) return this.lnHold("cleared");
    this.s.horde.remaining = Math.min(100, N.left);
    lx.thunderT -= dt;
    if (lx.thunderT <= 0) this.lnThunder();
  }
  // 自己写了怎么动的几种（吐酸者、夜行者、大块头、护士长）：尸潮里一直盯着你
  updateEnemy(e, dt) {
    if (e?.type === "raider" && !e.dead) {
      if (e.scout) return this.updateScout(e, dt);
      if (e.saboteur) return this.updateSaboteur(e, dt);
      if (e.leader) return this.updateLeader(e, dt);
    }
    if (e && !e.dead && e.horde && this.ln?.night && CUSTOM_AI.includes(e.type)) {
      const p = this.s.player;
      e.state = "chase";
      e.alert = Math.max(e.alert || 0, 8);
      e.targetX = p.x;
      e.targetY = p.y;
      e.homeX = p.x;
      e.homeY = p.y;
    }
    return super.updateEnemy(e, dt);
  }
  // 护士长叫来的也算这一波
  nurseSummon(e) {
    const before = new Set(this.enemies);
    super.nurseSummon(e);
    if (!e?.horde || !this.ln?.night) return;
    for (const z of this.enemies) if (!before.has(z)) z.horde = true;
  }
  hurtEnemy(e, damage, angle, meta = {}) {
    const live = e && !e.dead;
    if (live && e.type === "raider") {
      // 烟里的人：你只打得掉一半血
      if (!meta?.guard && this.inSmoke(e)) {
        damage *= LEADER.smoke.cut;
        this.effects.push({ x: e.x, y: e.y - 80, text: "烟雾", t: 0.5, color: "#cfc6a8" });
      }
      // 埋东西的人挨一下：往回退几秒
      if (e.saboteur && e.plant > 0) e.plant = Math.max(0, e.plant - COUNTER.sabotage.setback);
    }
    const out = super.hurtEnemy(e, damage, angle, meta);
    const N = this.ln?.night;
    if (N && live && e.dead && e.horde) N.kills++;
    if (live && e.dead && !e.fled && e.type === "raider") {
      if (e.scout) this.scoutDown(e);
      if (e.saboteur && this.ct) this.ct.sabDown++;
      if (e.leader) this.leaderDown();
    }
    return out;
  }
  assignRegion() {
    super.assignRegion();
    if (this.ln) this.placeScouts();
  }
  bossDown(kind, e) {
    const rec = this.ut?.boss?.[kind],
      last = rec?.last;
    super.bossDown(kind, e);
    if (e?.lnBoss) {
      // 长夜里的头目不算“今天废墟里那只已经打过了”
      if (rec) rec.last = last;
      const N = this.ln?.night;
      if (N) N.boss = 2;
    }
  }
  // 屏幕上方的血条：长夜里农场上的头目
  bossBar() {
    if (this.ln?.night && this.s.region === "farm") {
      const z = this.enemies.find((q) => q.lnBoss && !q.dead);
      if (!z) return null;
      const B = BOSSES[z.boss];
      let tag = "长夜",
        note = "";
      if (z.boss === "brute" && z.rage) tag = "长夜 · 发狂";
      if (z.boss === "nurse" && this.ut?.intel?.nurse) note = z.act?.kind === "scream" ? "她在吸气——打她一下" : "下一声尖叫 " + Math.max(0, Math.ceil(z.sct || 0)) + " 秒";
      if (z.boss === "brute" && this.ut?.intel?.brute && z.act?.kind === "door") note = "要扔车门了";
      return { kind: z.boss, name: B.name, hp: Math.max(0, z.hp), max: z.maxHp, tag, note };
    }
    return super.bossBar();
  }
  hordeIntel() {
    const info = super.hordeIntel(),
      N = this.ln?.night;
    if (!N) return info;
    const dirs = this.lnDirs(N.day).slice(0, Math.max(1, N.wave));
    return {
      ...info,
      direction: { ...HORDE_DIRECTIONS[dirs[0]], name: dirs.map((d) => HORDE_DIRECTIONS[d].name).join("、") },
      theme: "长夜 · 第 " + N.wave + "/3 波",
      count: N.left + this.hordeAlive().length,
      reward: "守到 04:00：金币 " + (LN_REWARD.money + LN_REWARD.per * (this.ln.held + 1)) + "、稀有掉落",
    };
  }
  hordeName() {
    return this.ln?.night ? "长夜" : super.hordeName();
  }
  // 长夜里的普通尸潮计时不走：updateHorde 交给长夜
  updateHorde(dt) {
    if (this.ln?.night) return;
    return super.updateHorde(dt);
  }

  // ================= 结束 =================
  lnClear() {
    // 没倒下的尸潮感染者退回林子；倒下的也从名单里拿掉（地上的尸体另外画），不然一晚一晚攒下去，存档会超过上限存不进去
    const keep = (z) => !z.horde && !z.dead;
    if (this.s.enemies.farm) this.s.enemies.farm = this.s.enemies.farm.filter(keep);
    if (this.s.region === "farm") this.enemies = this.s.enemies.farm || [];
  }
  lnEnd(N) {
    this.lnClear();
    this.ln.night = null;
    this.s.horde = { phase: N.prev, timer: 0, remaining: 0, spawnTimer: 0, direction: this.s.horde.direction ?? 0 };
    this.lx.gap = null;
    // 过了午夜才打完：守了一夜的居民去休息，早上照常吃早饭
    if (this.s.day > N.day)
      for (const r of this.c?.residents || [])
        if (r.workRole === "guard") {
          r.workRole = "rest";
          r.fed = false;
        }
    this.lnShiftThreats();
  }
  lnHold(how) {
    const L = this.ln,
      N = L.night;
    if (!N) return false;
    const left = this.hordeAlive().length + N.left,
      bossId = this.lnBossId(N.n);
    this.lnEnd(N);
    L.held++;
    L.tried++;
    L.kills += N.kills;
    const h = L.held,
      money = LN_REWARD.money + LN_REWARD.per * h,
      bundle = this.lnDraws(N, h),
      memento = MEMENTO_AT[h] && !L.mementos.includes(MEMENTO_AT[h]) && !(this.qty(MEMENTO_AT[h], true) > 0) ? MEMENTO_AT[h] : null;
    if (memento) bundle[memento] = 1;
    this.s.money += money;
    this.receive(bundle);
    L.last = { day: N.day, n: N.n, held: true, how, waves: N.wave, kills: N.kills, boss: N.boss === 2, bossId, money, items: bundle, left: Math.min(999, left), end: Math.floor(this.absNow()), memento };
    const text =
      "第 " + N.n + " 个长夜守住了！" + (how === "dawn" ? "天亮了，剩下的感染者退回了林子。" : "三波都打完了。") + "缴获：金币 " + money + "、" + itemsText(bundle) + "。" + (memento ? "这件" + ITEMS[memento].name + "可以捐给档案馆。" : "");
    this.toast(text, "gold");
    if (this.o) this.olog(text, "gold");
    this.emit("victory");
    this.events.push({ type: "lnDawn" });
    if (h >= LN.goal && !L.ended) {
      L.ended = true;
      L.endDay = this.s.day;
      if (this.o) this.olog(ENDING.broadcast, "gold");
      this.storyLog?.("守满十个长夜：余烬地区收复。");
      this.emit("menu", { menu: "outpost", view: "lnEnd" });
    } else this.emit("menu", { menu: "outpost", view: "lnight" });
    return true;
  }
  lnFail() {
    const L = this.ln,
      N = L.night;
    if (!N) return false;
    this.lnEnd(N);
    L.tried++;
    L.failed++;
    L.kills += N.kills;
    L.last = { day: N.day, n: N.n, held: false, how: "down", waves: N.wave, kills: N.kills, boss: N.boss === 2, bossId: this.lnBossId(N.n), money: 0, items: {}, left: 0, end: Math.floor(this.absNow()), memento: null };
    const text = "长夜没守住：你倒下以后，感染者在农场里转了一圈，天亮前散了。家园的东西都在；下一个长夜（第 " + this.nextLongNight(this.s.day + 1) + " 天）还是这么大。";
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
    return true;
  }
  // 稀有掉落：按存档种子和这是第几个长夜抽，读档不重抽
  lnDraws(N, h) {
    return this.rareDraws(["lnLoot", N.day, h], LN_REWARD.draws + Math.floor(h / LN_REWARD.every));
  }
  rareDraws(key, n) {
    const r = rngOf(hashOf(this.ut?.seed || 1, ...key)),
      bundle = {};
    for (let i = 0; i < n; i++) {
      const kind = KIND_IDS[Math.floor(r() * KIND_IDS.length) % KIND_IDS.length],
        got = KINDS[kind] ? this.drawFrom(kind, LN_REWARD.odds, r).bundle : { scrap: 2 };
      for (const [id, k] of Object.entries(got)) bundle[id] = (bundle[id] || 0) + k;
    }
    for (const k of Object.keys(bundle)) if (k.startsWith("bp_") || k === "flashlight") bundle[k] = 1;
    return bundle;
  }
  die() {
    if (this.ln?.night) this.lnFail();
    return super.die();
  }

  // ================= 睡觉：长夜那天不能一觉睡过去；长夜后睡到早上 8 点 =================
  sleep() {
    if (!this.ln) return super.sleep();
    if (this.s.region === "farm" && this.lnPending() && this.s.minute < LN.start) {
      this.toast("今晚 22:00 是长夜，现在不能一觉睡过去。先备战；想快点到晚上，在农舍点“等到天黑（19:00）”。", "warn");
      return false;
    }
    if (this.lnNapOk()) return this.lnNap();
    const n0 = this.events.length,
      ok = super.sleep();
    if (ok) {
      this.originAfterSleep();
      // 早上要弹日终总结：提醒写在总结页里；要弹别的页（每日抉择）就改天再提醒，不盖住它
      const menus = this.events.slice(n0).filter((ev) => ev.type === "menu");
      if (!menus.length) this.exportRemind();
      else if (menus.every((ev) => ev.view === "summary") && this.exportDue()) this.ln.remindDay = this.s.day;
    }
    return ok;
  }
  originAfterSleep() {
    const R = this.originRules(),
      g = this.gr;
    // 卫生员：感染每晚多降 10
    if (R.infection && g && !g.fever && g.inf > 0) g.inf = Math.max(0, g.inf - R.infection);
    if (R.stamina && this.s.player.stamina > R.stamina) this.s.player.stamina = R.stamina;
  }
  lnNapOk() {
    const L = this.ln,
      last = L?.last;
    if (!last || L.night || this.s.region !== "farm") return false;
    const endDay = Math.floor(last.end / 1440);
    return endDay === this.s.day && this.s.minute < LN.red && L.marks.nap !== this.s.day;
  }
  lnNap() {
    const p = this.s.player;
    this.ln.marks.nap = this.s.day;
    this.advanceMinutes(LN.red - this.s.minute);
    p.hp = Math.min(this.maxHp?.() ?? 100, p.hp + 35);
    p.stamina = this.originRules().stamina || 100;
    p.hunger = Math.max(30, p.hunger - 6);
    if (this.gx) this.gx.bleed = 0;
    this.releaseGrab?.(false);
    this.toast("长夜过去了，睡到早上 8 点：生命 +35，体力回满。", "gold");
    this.emit("sleep");
    return true;
  }

  // ================= 别的仗让开长夜 =================
  onNewDay() {
    // 长夜跨过午夜：守塔的居民接着守到天亮（原来零点就都去休息、要等早饭）
    const N = this.ln?.night,
      keep = N ? (this.c?.residents || []).filter((r) => r.workRole === "guard" || (r.role === "guard" && r.fed)).map((r) => [r, r.fed, r.workRole]) : [];
    super.onNewDay();
    if (!this.ln) return;
    for (const [r, fed, role] of keep) {
      r.fed = fed;
      r.workRole = role;
    }
    this.lnSync();
    this.lnShiftThreats();
  }
  lnShiftThreats() {
    if (!this.ln?.storyDay) return;
    const day = this.s.day,
      c = this.c;
    // 普通尸潮不落在长夜当天和第二天
    if (c?.nextHordeDay && (this.s.stats.hordes || 0) > 0) {
      let d = c.nextHordeDay;
      while (this.isLongNight(d) || this.isLongNight(d - 1)) d++;
      c.nextHordeDay = d;
    }
    // 灰隼团的袭击不落在长夜当天
    const r = this.o && this.raidState?.();
    if (r?.phase === "scheduled" && r.day >= day && this.isLongNight(r.day) && this.ln.lastDay !== r.day) {
      r.day++;
      const text = "灰隼团改了日子：长夜那天他们也不敢出来，改到第 " + r.day + " 天 19:00。";
      this.toast(text, "warn");
      this.olog(text, "warn");
    }
  }
  scheduleRaid(days) {
    super.scheduleRaid(days);
    if (!this.ln?.storyDay) return;
    const r = this.o.raid;
    while (this.isLongNight(r.day)) r.day++;
  }

  // ================= 灰隼团反扑 =================
  get ct() {
    return this.s.longnight?.counter;
  }
  // 主线打完后第 after 天（不落在长夜那天、最早明天）
  counterDay(after) {
    let d = Math.max(this.ln.storyDay + after, this.s.day + 1);
    while (this.isLongNight(d)) d++;
    return d;
  }
  counterBegin() {
    const c = this.ct;
    if (!c || c.step || !this.ln.storyDay) return;
    const r = rngOf(hashOf(this.ut?.seed || 1, "counter", this.ln.storyDay));
    c.step = 1;
    c.day = this.counterDay(COUNTER.scouts.after);
    c.region = RUINS[Math.floor(r() * RUINS.length) % RUINS.length];
    c.spot = Math.floor(r() * 3) % 3;
  }
  counterTick(dt) {
    const c = this.ct;
    if (!c || !this.ln.storyDay) return;
    if (!c.step) this.counterBegin();
    const day = this.s.day,
      m = this.s.minute;
    if (c.step === 1) {
      if (day > c.day || c.scouts + c.fled >= COUNTER.scouts.n) this.scoutsDone();
      else if (day === c.day && m >= 420 && c.warned !== day) {
        c.warned = day;
        const text = "有人看见两个灰隼团的人在" + (REGIONS[c.region]?.name || "废墟") + "转悠——像是探子，只待今天。打倒他们，也许能知道他们想干什么。";
        this.toast(text, "warn");
        if (this.o) this.olog(text, "warn");
      }
    } else if (c.step === 2) {
      if (c.sabOn) this.tickSabotage();
      else if (day > c.day || (day === c.day && m >= COUNTER.sabotage.at)) this.sabotageBegin();
      else if (day === c.day && m >= COUNTER.sabotage.warn && c.intel && c.warned !== day) {
        c.warned = day;
        const b = this.sabTarget();
        this.toast("探子的地图上画着：今晚 23:00 有人摸进来，冲着" + (b ? BUILDINGS[b.type]?.name || "设施" : "农场") + "去。守在边上，他们埋东西时打断。", "warn");
      }
    }
    this.tickSmoke(dt);
  }

  // ---------- 第一步：废墟里的探子 ----------
  placeScouts() {
    const c = this.ct;
    if (!c || c.step !== 1 || this.s.day !== c.day || this.s.region !== c.region) return;
    const want = COUNTER.scouts.n - c.scouts - c.fled,
      have = this.enemies.filter((z) => z.scout && !z.dead).length,
      s = EVENT_SPOTS[c.region][c.spot] || EVENT_SPOTS[c.region][0];
    for (let i = have; i < want; i++) {
      const q = this.freePoint(s.x + (i ? 70 : -50), s.y + (i ? 40 : -30)),
        z = this.enemy("raider", q.x, q.y, false);
      Object.assign(z, { scout: true, homeX: q.x, homeY: q.y, state: "patrol", alert: 0, aim: 0, aimX: 0, aimY: 0, cooldown: 1 + Math.random(), blind: 0, timer: 0 });
      this.enemies.push(z);
    }
  }
  updateScout(e, dt) {
    if (e.dead) return;
    const C = COUNTER.scouts,
      p = this.s.player,
      d = dist(e, p);
    e.cooldown = Math.max(0, (e.cooldown || 0) - dt);
    e.flash = Math.max(0, (e.flash || 0) - dt);
    e.pathTimer = (e.pathTimer || 0) - dt;
    if (!e.flee && e.hp < e.maxHp * C.flee) {
      e.flee = true;
      e.aim = 0;
      this.effects.push({ x: e.x, y: e.y - 70, text: "要跑！", t: 0.9, color: "#e6c48a" });
    }
    if (e.flee) {
      this.moveRaider(e, { x: WORLD.w - 40, y: clamp(e.y, 160, WORLD.h - 160) }, dt, 1.2);
      if (e.x >= WORLD.w - 90) {
        e.dead = true;
        e.fled = true;
        this.ct.fled++;
        this.toast("一个探子跑了。", "warn");
      }
      return;
    }
    if (e.aim > 0) {
      e.aim -= dt;
      e.facing = Math.atan2(e.aimY - (e.y - 30), e.aimX - e.x);
      if (e.aim <= 0) this.fireRaidShot(e);
      return;
    }
    const sees = d < C.sight && this.lineClear(e, p);
    if (sees || (e.state === "chase" && d < 200)) {
      e.state = "chase";
      e.alert = 6;
    } else e.alert = Math.max(0, (e.alert || 0) - dt);
    if (e.state === "chase" && e.alert <= 0) e.state = "patrol";
    if (e.state !== "chase") {
      e.timer = (e.timer || 0) - dt;
      if (e.timer <= 0) {
        const a = Math.random() * 6.28;
        e.targetX = clamp(e.homeX + Math.cos(a) * 90, 80, WORLD.w - 80);
        e.targetY = clamp(e.homeY + Math.sin(a) * 70, 90, WORLD.h - 90);
        e.timer = 3 + Math.random() * 3;
      }
      this.moveRaider(e, { x: e.targetX ?? e.x, y: e.targetY ?? e.y }, dt, 0.45);
      return;
    }
    let goal = null;
    if (d < 140) goal = { x: e.x + ((e.x - p.x) / Math.max(1, d)) * 90, y: e.y + ((e.y - p.y) / Math.max(1, d)) * 90 };
    else if (!sees || d > 300) goal = p;
    if (goal) this.moveRaider(e, { x: clamp(goal.x, 60, WORLD.w - 40), y: clamp(goal.y, 70, WORLD.h - 70) }, dt, 1);
    if (sees && e.cooldown <= 0) {
      e.aim = 1;
      e.aimX = p.x;
      e.aimY = p.y - 24;
    }
  }
  scoutDown(e) {
    const c = this.ct,
      C = COUNTER.scouts;
    c.scouts++;
    const ammo = C.ammo[0] + Math.floor(Math.random() * (C.ammo[1] - C.ammo[0] + 1));
    this.receive({ ammo });
    if (c.scouts >= C.n) {
      c.intel = true;
      this.receive({ [SCOUT_MAP]: 1 });
      const b = this.sabTarget(),
        day = this.counterDay(COUNTER.sabotage.after);
      const text = "从探子身上搜出一张地图：第 " + day + " 天夜里 23:00，灰隼团要摸进农场，冲着" + (b ? BUILDINGS[b.type]?.name || "设施" : "农场") + "去。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    } else this.toast("打倒一个灰隼团的探子（弹药 +" + ammo + "）。还有一个。", "gold");
  }
  scoutsDone() {
    const c = this.ct;
    c.step = 2;
    c.day = this.counterDay(COUNTER.sabotage.after);
    c.warned = 0;
    if (c.intel) c.target = this.sabTarget()?.id || "";
    const text = c.intel
      ? "灰隼团的两个探子都倒下了。地图上画着：第 " + c.day + " 天 23:00 有人摸进农场。"
      : c.scouts
        ? "打倒了一个探子，另一个跑了。灰隼团要摸进农场了——哪天夜里、冲着什么去，不知道。"
        : "灰隼团的探子在" + (REGIONS[c.region]?.name || "废墟") + "转了一天，走了。他们要摸进农场了——哪天夜里、冲着什么去，不知道。";
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
  }

  // ---------- 第二步：夜里的破坏 ----------
  sabTarget() {
    const c = this.ct,
      live = (this.s.buildings || []).filter((b) => b.hp > 0);
    const keep = c?.target && live.find((b) => b.id === c.target);
    if (keep) return keep;
    for (const type of SAB_TARGETS) {
      const b = live.find((x) => x.type === type);
      if (b) return b;
    }
    return null;
  }
  sabotageBegin() {
    const c = this.ct;
    if (c.sabOn || c.step !== 2) return;
    // 尸潮、袭击打着的时候先等着
    if (this.s.day === c.day && (["warning", "active"].includes(this.s.horde.phase) || (this.o && ["warning", "active"].includes(this.raidState?.().phase)))) return;
    const b = this.sabTarget();
    if (!b) {
      c.sab = "none";
      return this.finalSchedule();
    }
    c.target = b.id;
    if (this.s.region !== "farm" || this.s.day > c.day) return this.sabotageAuto(b);
    c.sabOn = true;
    c.sabDown = 0;
    this.spawnSaboteurs(COUNTER.sabotage.n);
    const name = BUILDINGS[b.type]?.name || "设施";
    this.toast(c.intel ? "来了：两个人从东边摸进农场，冲着" + name + "去。他们埋东西时打他们一下就能打断。" : "东边围栏外有动静——有人摸进农场了！", "warn");
    this.emit("alarm");
  }
  spawnSaboteurs(n) {
    for (let i = 0; i < n; i++) {
      const q = this.freePoint(1430, 400 + i * 110),
        z = this.enemy("raider", q.x, q.y, false);
      Object.assign(z, { saboteur: true, aim: 0, aimX: 0, aimY: 0, cooldown: 2, plant: 0, state: "chase" });
      this.enemies.push(z);
    }
  }
  tickSabotage() {
    const c = this.ct;
    if (this.s.region !== "farm") return;
    const left = (this.s.enemies.farm || []).filter((z) => z.saboteur && !z.dead);
    // 读档后（枪手不写进存档）：剩下的人重新摸进来
    if (!left.length && c.sabDown < COUNTER.sabotage.n && c.sab !== "blown" && !this.lx.sabSpawned) {
      this.lx.sabSpawned = true;
      this.spawnSaboteurs(COUNTER.sabotage.n - c.sabDown);
      return;
    }
    if (!left.length) this.sabotageEnd();
  }
  updateSaboteur(e, dt) {
    if (e.dead) return;
    const c = this.ct,
      S = COUNTER.sabotage,
      p = this.s.player,
      d = dist(e, p),
      b = (this.s.buildings || []).find((x) => x.id === c.target && x.hp > 0);
    e.cooldown = Math.max(0, (e.cooldown || 0) - dt);
    e.flash = Math.max(0, (e.flash || 0) - dt);
    e.pathTimer = (e.pathTimer || 0) - dt;
    if (e.flee || !b) {
      e.plant = 0;
      this.moveRaider(e, { x: 1462, y: clamp(e.y, 360, 600) }, dt, 1.15);
      if (e.x >= 1416) {
        e.dead = true;
        e.fled = true;
        c.sabDown++;
      }
      return;
    }
    if (e.aim > 0) {
      e.aim -= dt;
      e.facing = Math.atan2(e.aimY - (e.y - 30), e.aimX - e.x);
      if (e.aim <= 0) this.fireRaidShot(e);
      return;
    }
    // 你贴得太近：先回头打你
    if (d < 170 && e.cooldown <= 0 && this.lineClear(e, p)) {
      e.aim = 1;
      e.aimX = p.x;
      e.aimY = p.y - 24;
      return;
    }
    if (dist(e, b) > 46) {
      this.moveRaider(e, { x: b.x, y: b.y + 26 }, dt, 0.9);
      return;
    }
    if (!(e.plant > 0)) {
      this.events.push({ type: "sabPlant", x: e.x, y: e.y });
      this.toast("有人在" + (BUILDINGS[b.type]?.name || "设施") + "边上埋东西！打他一下就能打断。", "warn");
    }
    e.facing = Math.atan2(b.y - e.y, b.x - e.x);
    e.plant = (e.plant || 0) + dt;
    if (e.plant >= S.plant) this.sabBlow(b);
  }
  sabBlow(b) {
    const c = this.ct;
    b.hp = 0;
    this.navRevision = (this.navRevision || 0) + 1;
    c.sab = "blown";
    this.particlesAt(b.x, b.y - 10, "#f08a4a", 26);
    this.noise.push({ x: b.x, y: b.y, r: 600, t: 2 });
    if (!this.s.settings?.access?.calm) this.shake = Math.max(this.shake || 0, 8);
    this.events.push({ type: "sabBoom", x: b.x, y: b.y });
    for (const z of this.s.enemies.farm || []) if (z.saboteur && !z.dead) z.flee = true;
    const text = "轰——" + (BUILDINGS[b.type]?.name || "设施") + "被炸坏了。可以修好（对着它按 E）。";
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
  }
  sabotageEnd() {
    const c = this.ct;
    c.sabOn = false;
    this.lx.sabSpawned = false;
    if (c.sab !== "blown") {
      c.sab = "foiled";
      this.receive({ ...COUNTER_REWARD.foiled });
      const text = "摸进来的人没得逞。从他们身上搜出" + itemsText(COUNTER_REWARD.foiled) + "。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    }
    this.finalSchedule();
  }
  // 你不在农场、或者睡着了：守夜的人替你挡（看防守力）
  sabotageAuto(b) {
    const c = this.ct,
      power = this.raidPower?.() ?? 0,
      name = BUILDINGS[b.type]?.name || "设施";
    let text;
    if (power >= COUNTER.sabotage.power) {
      c.sab = "guards";
      text = "夜里有两个人摸进农场，守夜的人发现了，开枪赶跑了（防守力 " + power + "）。";
    } else {
      c.sab = "blownAway";
      b.hp = 0;
      this.navRevision = (this.navRevision || 0) + 1;
      text = "夜里有人摸进农场，把" + name + "炸坏了——守夜的人太少（防守力 " + power + "，要 " + COUNTER.sabotage.power + "）。可以修好。";
    }
    this.toast(text, c.sab === "guards" ? "gold" : "warn");
    if (this.o) this.olog(text, c.sab === "guards" ? "gold" : "warn");
    this.finalSchedule();
  }

  // ---------- 第三步：头领带人来 ----------
  finalSchedule() {
    const c = this.ct;
    c.step = 3;
    c.leader = 0;
    const day = this.counterDay(COUNTER.final.after);
    Object.assign(c.raid, raidRec(), { phase: "scheduled", day, tries: c.raid.tries || 0 });
    const text = "灰隼团放出话来：第 " + day + " 天 19:00，头领“" + LEADER.name + "”亲自带人来。他会扔烟雾弹，烟里的人不好打。";
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
  }
  isCounterRaid(r = this.raidState?.()) {
    return !!r && r === this.ct?.raid;
  }
  raidState() {
    const r = this.s.longnight?.counter?.raid;
    return r && ["scheduled", "warning", "active"].includes(r.phase) ? r : super.raidState();
  }
  raidSize() {
    if (this.isCounterRaid()) return COUNTER.final.size + Math.min(1, this.ct.raid.tries) + 1;
    return super.raidSize();
  }
  startRaidWarning() {
    super.startRaidWarning();
    if (this.isCounterRaid()) this.toast("车灯里有一面灰隼旗——“" + LEADER.name + "”亲自来了。他扔烟雾弹：烟里的人只打得掉一半血，瞭望塔和守卫也看不见。他倒下，剩下的人就会跑。", "warn");
  }
  spawnRaider() {
    const r = this.raidState();
    if (this.isCounterRaid(r) && !this.ct.leader && r.spawned >= COUNTER.final.leaderAt) return this.spawnLeader();
    return super.spawnRaider();
  }
  spawnLeader() {
    const r = this.raidState(),
      pt = HORDE_DIRECTIONS[0].spawns[r.spawned % 2],
      e = this.enemy("raider", pt[0], clamp(pt[1], 80, WORLD.h - 80), false);
    Object.assign(e, { raid: true, leader: true, hp: LEADER.hp, maxHp: LEADER.hp, aim: 0, aimX: 0, aimY: 0, cooldown: 1.5, state: "chase", post: this.coverSpot(r.spawned), blind: 0, smokeT: LEADER.smoke.first });
    this.enemies.push(e);
    r.spawned++;
    this.ct.leader = 1;
    this.toast("“" + LEADER.name + "”来了！", "warn");
    this.events.push({ type: "lnLeader", x: e.x, y: e.y });
    return e;
  }
  updateLeader(e, dt) {
    if (e.dead) return;
    const p = this.s.player,
      d = dist(e, p),
      S = LEADER.smoke;
    e.cooldown = Math.max(0, (e.cooldown || 0) - dt);
    e.flash = Math.max(0, (e.flash || 0) - dt);
    e.pathTimer = (e.pathTimer || 0) - dt;
    e.smokeT = (e.smokeT ?? S.first) - dt;
    if (e.aim > 0) {
      e.aim -= dt;
      e.facing = Math.atan2(e.aimY - (e.y - 30), e.aimX - e.x);
      if (e.aim <= 0) {
        this.fireRaidShot(e);
        const shot = this.raidShots[this.raidShots.length - 1];
        if (shot) shot.damage = LEADER.damage;
        e.cooldown = LEADER.cd[0] + this.roll() * (LEADER.cd[1] - LEADER.cd[0]);
      }
      return;
    }
    const sees = d < 380 && this.lineClear(e, p);
    if (sees && e.smokeT <= 0 && d < S.range) {
      this.throwSmoke(e);
      e.smokeT = S.every;
      return;
    }
    e.blind = sees ? 0 : (e.blind || 0) + dt;
    e.cover = !!e.post && dist(e, e.post) < 26 && p.x < e.x - 30;
    let goal = null;
    if (d < 140) goal = { x: e.x + ((e.x - p.x) / Math.max(1, d)) * 90, y: e.y + ((e.y - p.y) / Math.max(1, d)) * 90 };
    else if (e.blind > 2.5) goal = p;
    else if (e.post && dist(e, e.post) > 20 && d > 180) goal = e.post;
    else if (d > 340) goal = p;
    if (goal) this.moveRaider(e, { x: clamp(goal.x, 60, WORLD.w - 40), y: clamp(goal.y, 70, WORLD.h - 70) }, dt, 1);
    if (sees && e.cooldown <= 0) {
      e.aim = LEADER.aim;
      e.aimX = p.x;
      e.aimY = p.y - 24;
    }
  }
  throwSmoke(e) {
    const p = this.s.player,
      k = 0.45;
    this.lx.grenades.push({ x0: e.x, y0: e.y - 30, x: e.x + (p.x - e.x) * k, y: e.y + (p.y - e.y) * k, t: 0, fly: LEADER.smoke.fly });
    this.lx.smokeRegion = this.s.region;
    this.effects.push({ x: e.x, y: e.y - 84, text: "烟雾弹！", t: 0.9, color: "#cfc6a8" });
    this.events.push({ type: "smokeCue", x: e.x, y: e.y });
  }
  tickSmoke(dt) {
    const lx = this.lx,
      S = LEADER.smoke;
    if (lx.smokeRegion && lx.smokeRegion !== this.s.region) {
      lx.grenades = [];
      lx.smoke = [];
      lx.smokeRegion = null;
      return;
    }
    if (!lx.grenades.length && !lx.smoke.length) return;
    for (const g of lx.grenades) {
      g.t += dt;
      if (g.t >= g.fly) {
        lx.smoke.push({ x: g.x, y: g.y, r: S.r, t: S.time, max: S.time });
        this.events.push({ type: "smoke", x: g.x, y: g.y });
      }
    }
    lx.grenades = lx.grenades.filter((g) => g.t < g.fly);
    for (const s of lx.smoke) s.t -= dt;
    lx.smoke = lx.smoke.filter((s) => s.t > 0);
  }
  inSmoke(z) {
    const sm = this._lx?.smoke;
    return !!sm?.length && sm.some((s) => dist(s, z) < s.r * Math.min(1, 0.55 + s.t / s.max));
  }
  // 瞭望塔和守卫看不见烟里的人
  updateDefense(dt) {
    const hide = this.s.region === "farm" && this._lx?.smoke?.length ? this.enemies.filter((z) => z.type === "raider" && !z.dead && !z.fled && this.inSmoke(z)) : [];
    for (const z of hide) z.fled = true;
    try {
      return super.updateDefense(dt);
    } finally {
      for (const z of hide) z.fled = false;
    }
  }
  towerLineClear(tower, e) {
    if (e?.fled) return false;
    return super.towerLineClear(tower, e);
  }
  leaderDown() {
    const r = this.raidState();
    this.ct.leader = 2;
    if (this.isCounterRaid(r)) r.total = r.spawned;
    for (const z of this.s.enemies.farm || []) if (z.type === "raider" && !z.dead && !z.leader) z.retreat = true;
    this.toast("“" + LEADER.name + "”倒下了！剩下的人扔下枪就跑。", "gold");
    this.events.push({ type: "bossDown", x: this.s.player.x, y: this.s.player.y, boss: "leader" });
  }
  autoResolveRaid(reason) {
    if (!this.isCounterRaid()) return super.autoResolveRaid(reason);
    const r = this.raidState();
    if (!["scheduled", "warning", "active"].includes(r.phase)) return false;
    const remaining = r.phase === "active" ? Math.max(0, r.total - r.killed - r.retreated) : this.raidSize();
    if (r.phase !== "active") r.total = remaining;
    const won = this.raidPower() >= remaining * COUNTER.final.autoMul;
    if (won) {
      r.killed += Math.ceil(remaining / 2);
      r.retreated += remaining - Math.ceil(remaining / 2);
    }
    this.finishRaid(won, true, reason === "left" ? "你离开了农场，守卫替你迎战" : "你不在农场，守卫替你迎战");
    return true;
  }
  raidOutcome(r, won, report) {
    if (!this.isCounterRaid(r)) return super.raidOutcome(r, won, report);
    const c = this.ct,
      R = COUNTER_REWARD.final;
    if (won) {
      r.phase = "won";
      c.step = 4;
      c.done = true;
      c.leader = 2;
      const draws = this.rareDraws(["counter", this.s.day, r.tries], R.draws);
      report.gain = { ...R.gain };
      for (const [id, n] of Object.entries(draws)) report.gain[id] = (report.gain[id] || 0) + n;
      report.money = R.money;
      report.wonText = "“" + LEADER.name + "”倒下了，灰隼团散了。这一带再没有人敢收买路钱。";
      this.s.money += R.money;
      this.putStorage(report.gain);
      this.addReputation?.(R.rep);
      const text = "灰隼团散了！缴获" + itemsText(report.gain) + "与 " + R.money + " 金币，营地声望 +" + R.rep + "。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
      this.storyLog?.("打退灰隼团的反扑，头领“" + LEADER.name + "”倒下了。");
      this.emit("victory");
    } else {
      report.lost = this.raidLoot();
      r.tries++;
      r.phase = "scheduled";
      c.leader = 0;
      let day = this.s.day + COUNTER.final.retry;
      while (this.isLongNight(day)) day++;
      r.day = day;
      const text = "没守住：灰隼团抢走了" + (Object.keys(report.lost).length ? itemsText(report.lost) : "一些零碎") + "。“" + LEADER.name + "”放话第 " + r.day + " 天 19:00 再来。";
      this.toast(text, "warn");
      if (this.o) this.olog(text, "warn");
    }
  }
  lastRaidRecord() {
    const other = super.lastRaidRecord();
    if (this.lastRaid) return other;
    const mine = this.ct?.raid;
    return mine?.report && (!other?.report || mine.report.day >= other.report.day) ? mine : other;
  }
  ruinNews() {
    const out = super.ruinNews(),
      c = this.ct;
    if (c?.step === 1 && c.day === this.s.day && c.scouts + c.fled < COUNTER.scouts.n) out.push({ region: c.region, kind: "scouts", when: "today", text: "灰隼团的探子", name: "灰隼团的探子" });
    return out;
  }
  counterInfo() {
    const c = this.ct;
    if (!c || !this.ln?.storyDay || !c.step) return null;
    const B = this.s.buildings?.find((b) => b.id === c.target),
      r = c.raid;
    return { step: c.step, day: c.step === 3 ? r.day : c.day, region: c.region, scouts: c.scouts, fled: c.fled, intel: c.intel, target: B ? BUILDINGS[B.type]?.name || "设施" : "", sab: c.sab, sabOn: c.sabOn, raid: r.phase, tries: r.tries, done: c.done, leader: c.leader };
  }

  // ================= 出身的规则 =================
  originRules() {
    return ORIGINS[this.s.longnight?.origin]?.rules || {};
  }
  originInfo() {
    const id = this.s.longnight?.origin || "farmer";
    return { id, ...ORIGINS[id] };
  }
  // 卫生员：绷带多回三成血
  medBonus(id) {
    const b = super.medBonus?.(id) || 0,
      R = this.originRules();
    return id === "bandage" && R.bandage ? b + Math.round(RULES.heal.bandage.hp * (R.bandage - 1)) : b;
  }
  // 卫生员：近战伤害少一成
  meleeStats(id) {
    const w = super.meleeStats(id),
      R = this.originRules();
    if (w && R.melee) w.dmg *= R.melee;
    return w;
  }
  // 机修工：修东西少花四分之一的材料（两份的少一份，一份的不变）
  repairCost(id) {
    const c = super.repairCost(id),
      R = this.originRules();
    if (!c || !R.repair) return c;
    return Object.fromEntries(Object.entries(c).map(([k, n]) => [k, n >= 2 ? n - Math.max(1, Math.round(n * (1 - R.repair))) : n]));
  }
  // 退伍兵：推开少花 3 体力
  shove() {
    const R = this.originRules();
    if (!R.shove) return super.shove();
    const base = RULES.shove.cost;
    RULES.shove.cost = Math.max(0, base - R.shove);
    try {
      return super.shove();
    } finally {
      RULES.shove.cost = base;
    }
  }
  // 退伍兵：被抓住的时间短两成
  startGrab(z) {
    super.startGrab(z);
    const R = this.originRules(),
      g = this.gx?.grab;
    if (R.grab && g) {
      g.t *= R.grab;
      g.max *= R.grab;
      if (z) z.cooldown = g.t + 0.3;
    }
  }
  // 猎人：陷阱多用一次
  placeTrap(target) {
    const R = this.originRules(),
      id = this.currentItem?.();
    if (!R.trapUses || !TRAPS[id]) return super.placeTrap(target);
    const T = TRAPS[id],
      base = T.uses;
    T.uses = base + R.trapUses;
    try {
      return super.placeTrap(target);
    } finally {
      T.uses = base;
    }
  }
  // 开局提示“拿起木棍”：没有木棍的猎人拿弹弓，退伍兵拿铁管
  coach() {
    const c = super.coach();
    if (!c || c.id !== "arm" || !this.ln) return c;
    const melee = this.gr?.slots?.melee,
      sling = this.gr?.slots?.ranged;
    if (!melee && sling) {
      if (this.s.slot === 4) {
        if (this.feel?.open?.seen) this.feel.open.seen.arm = true;
        return super.coach();
      }
      return { id: "armSling", text: "路那头来了感染者！按 5 拿起" + ITEMS[sling].name + "（打石材）", touch: "路那头来了感染者！点快捷栏 5 拿起" + ITEMS[sling].name + "（打石材）" };
    }
    if (melee && melee !== "club") return { id: "armMelee", text: "路那头来了感染者！按 4 拿起" + ITEMS[melee].name, touch: "路那头来了感染者！点快捷栏 4 拿起" + ITEMS[melee].name };
    return c;
  }

  // ================= 存档不容易丢：记下上次导出是哪天，太久没导出睡觉时提醒一次 =================
  markExported() {
    if (!this.ln) return;
    this.ln.exportDay = this.s.day;
    this.ln.remindDay = 0;
  }
  exportInfo() {
    const L = this.ln;
    if (!L) return null;
    const since = L.exportDay ? this.s.day - L.exportDay : null;
    return { day: L.exportDay, since, due: this.exportDue() };
  }
  // 超过游戏里 7 天没导出（没导出过的从第 1 天算），一周最多提醒一次
  exportDue() {
    const L = this.ln;
    if (!L) return false;
    const since = this.s.day - Math.max(1, L.exportDay || 1);
    return since > EXPORT_REMIND && (!L.remindDay || this.s.day - L.remindDay >= EXPORT_REMIND);
  }
  exportRemind() {
    if (!this.exportDue()) return false;
    this.ln.remindDay = this.s.day;
    this.emit("menu", { menu: "outpost", view: "lnExport" });
    return true;
  }

  // ================= 档案馆第七个展柜：长夜纪念 =================
  lnCase() {
    const L = this.ln;
    if (!L) return null;
    const can = MEMENTO_IDS.filter((id) => !L.mementos.includes(id) && this.qty(id, true) > 0);
    return { name: LN_CASE.name, need: LN_CASE.need, reward: LN_CASE.reward, donated: [...L.mementos], can, done: L.caseDone };
  }
  donateMemento(id) {
    const L = this.ln;
    if (!L || !MEMENTO_IDS.includes(id) || L.mementos.includes(id)) return false;
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
    L.mementos.push(id);
    this.toast("捐给档案馆：" + ITEMS[id].name + "。");
    if (L.mementos.length >= LN_CASE.need && !L.caseDone) {
      L.caseDone = true;
      this.addReputation?.(10);
      for (const r of this.c?.residents || []) r.morale = clamp((r.morale ?? 60) + 5, 0, 100);
      const text = "展柜「" + LN_CASE.name + "」填满了！" + LN_CASE.reward + "。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    }
    return true;
  }

  // ================= 给界面的 =================
  lnInfo() {
    const L = this.ln;
    if (!L) return null;
    const N = L.night,
      on = !!L.storyDay,
      day = this.s.day,
      next = on ? this.nextLongNight() : 0;
    const out = { on, held: L.held, tried: L.tried, failed: L.failed, goal: LN.goal, ended: L.ended, endDay: L.endDay, kills: L.kills, next, today: on && this.lnPending(day), mult: this.lnMult(), total: this.nightTotal(), boss: next ? BOSSES[this.lnBossId(L.tried + 1)].name : "", last: L.last, storyDay: L.storyDay, night: null };
    if (N) {
      const left = Math.max(0, N.start + LN.length - this.absNow()),
        z = this.enemies.find((q) => q.lnBoss && !q.dead);
      out.night = { n: N.n, wave: N.wave, left: N.left + this.hordeAlive().length, kills: N.kills, dawn: Math.ceil(left), boss: N.boss, bossName: BOSSES[this.lnBossId(N.n)].name, bossHp: z ? Math.max(0, Math.round((z.hp / z.maxHp) * 100)) : 0, gap: this.lx.gap != null ? Math.max(0, Math.ceil(this.lx.gap)) : null };
    }
    return out;
  }
  todayItems() {
    const out = super.todayItems();
    if (!this.ln?.storyDay) return out;
    const extra = [],
      c = this.ct;
    if (c?.step === 1 && c.day === this.s.day && c.scouts + c.fled < COUNTER.scouts.n) extra.push({ pri: 1, text: "灰隼团的探子在" + (REGIONS[c.region]?.name || "废墟"), action: "", id: "" });
    if (c?.step === 2 && c.day === this.s.day && c.intel && !c.sabOn) extra.push({ pri: 1, text: "今晚 23:00 有人摸进来破坏", action: "", id: "" });
    if (c?.sabOn) extra.push({ pri: 0, text: "有人摸进农场了", action: "", id: "" });
    if (this.ln.night) extra.push({ pri: 0, text: "长夜 · 第 " + this.ln.night.wave + "/3 波：守到 04:00", action: "", id: "" });
    else if (this.lnPending()) extra.push({ pri: 0, text: "今晚 22:00 长夜（第 " + (this.ln.tried + 1) + " 个）", action: "", id: "" });
    else if (this.nextLongNight() === this.s.day + 1) extra.push({ pri: 1, text: "明天是长夜", action: "", id: "" });
    return [...extra, ...out].sort((a, b) => a.pri - b.pri).slice(0, 3);
  }

  // ================= 存档 =================
  static parse(text) {
    const raw = JSON.parse(text),
      s = UndertowEngine.parse(text);
    if (raw.longnight !== undefined) validateLongnight(raw.longnight);
    return migrateState(s);
  }
}

function validateLongnight(x) {
  const object = (v) => v && typeof v === "object" && !Array.isArray(v),
    int = (v, min = 0, max = 1e7) => Number.isInteger(v) && v >= min && v <= max,
    bool = (v) => typeof v === "boolean",
    bad = () => {
      throw Error("存档里的长夜记录损坏，请从设置恢复有效备份；原存档会保留。");
    },
    d = lnDefaults();
  if (!object(x) || x.schema !== LN_SCHEMA || Object.keys(x).some((k) => !Object.hasOwn(d, k))) bad();
  for (const k of ["storyDay", "held", "tried", "failed", "kills", "lastDay", "endDay"]) if (x[k] !== undefined && !int(x[k], 0, 1e7)) bad();
  for (const k of ["ended", "caseDone"]) if (x[k] !== undefined && !bool(x[k])) bad();
  if (x.night !== undefined && x.night !== null) {
    const n = x.night,
      keys = ["day", "n", "mult", "wave", "left", "made", "boss", "kills", "start", "prev"];
    if (!object(n) || Object.keys(n).some((k) => !keys.includes(k))) bad();
    if (!int(n.day, 1, 1e6) || !int(n.n, 1, 1e5) || !int(n.mult, 100, 100 * LN.cap) || !int(n.wave, 0, 3) || !int(n.left, 0, 400) || !int(n.made, 0, 1000) || !int(n.boss, 0, 2) || !int(n.kills, 0, 1e5) || !int(n.start, 0, 1e9) || !["won", "locked"].includes(n.prev)) bad();
  }
  if (x.last !== undefined && x.last !== null) {
    const l = x.last,
      keys = ["day", "n", "held", "how", "waves", "kills", "boss", "bossId", "money", "items", "left", "end", "memento"];
    if (!object(l) || Object.keys(l).some((k) => !keys.includes(k))) bad();
    if (!int(l.day, 1, 1e6) || !int(l.n, 1, 1e5) || !bool(l.held) || !HOW.includes(l.how) || !int(l.waves, 0, 3) || !int(l.kills, 0, 1e5) || !bool(l.boss) || !LN_BOSSES.includes(l.bossId) || !int(l.money, 0, 1e6) || !int(l.left, 0, 999) || !int(l.end, 0, 1e9)) bad();
    if (!object(l.items) || Object.entries(l.items).some(([id, n]) => !ITEMS[id] || !int(n, 1, 999))) bad();
    if (l.memento !== null && l.memento !== undefined && !MEMENTO_IDS.includes(l.memento)) bad();
  }
  if (x.mementos !== undefined && (!Array.isArray(x.mementos) || x.mementos.length > MEMENTO_IDS.length || new Set(x.mementos).size !== x.mementos.length || x.mementos.some((id) => !MEMENTO_IDS.includes(id)))) bad();
  if (x.marks !== undefined && (!object(x.marks) || Object.entries(x.marks).some(([k, v]) => !Object.hasOwn(d.marks, k) || !int(v, 0, 1e6)))) bad();
  if (x.seen !== undefined && (!object(x.seen) || Object.keys(x.seen).length > 60 || Object.entries(x.seen).some(([k, v]) => k.length > 30 || !int(v, 0, 1e6)))) bad();
  if (x.origin !== undefined && !ORIGIN_IDS.includes(x.origin)) bad();
  for (const k of ["exportDay", "remindDay"]) if (x[k] !== undefined && !int(x[k], 0, 1e6)) bad();
  if (x.legacy !== undefined && x.legacy !== null) {
    const l = x.legacy;
    if (!object(l) || Object.keys(l).some((k) => !["ng", "fromDay", "held", "book", "keep"].includes(k))) bad();
    if (!int(l.ng, 1, 99) || !int(l.fromDay, 1, 1e6) || !int(l.held, 0, 1e6)) bad();
    if (!Array.isArray(l.book) || l.book.length > LEGACY.book || l.book.some((v) => typeof v !== "string" || !v || v.length > LEGACY.name)) bad();
    if (typeof l.keep !== "string" || (l.keep && !(gearDef(l.keep) && slotOf(l.keep)))) bad();
  }
  if (x.counter !== undefined) {
    const c = x.counter,
      keys = Object.keys(d.counter),
      num = (v) => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 1e6;
    if (!object(c) || Object.keys(c).some((k) => !keys.includes(k))) bad();
    if (c.step !== undefined && !int(c.step, 0, 4)) bad();
    for (const k of ["day", "warned"]) if (c[k] !== undefined && !int(c[k], 0, 1e6)) bad();
    if (c.spot !== undefined && !int(c.spot, 0, 2)) bad();
    for (const k of ["scouts", "fled"]) if (c[k] !== undefined && !int(c[k], 0, COUNTER.scouts.n)) bad();
    if (c.sabDown !== undefined && !int(c.sabDown, 0, COUNTER.sabotage.n)) bad();
    if (c.leader !== undefined && !int(c.leader, 0, 2)) bad();
    if (c.region !== undefined && c.region !== "" && !RUINS.includes(c.region)) bad();
    if (c.target !== undefined && (typeof c.target !== "string" || c.target.length > 60)) bad();
    if (c.sab !== undefined && !SAB_RESULTS.includes(c.sab)) bad();
    for (const k of ["intel", "sabOn", "done"]) if (c[k] !== undefined && !bool(c[k])) bad();
    if (c.raid !== undefined) {
      const r = c.raid;
      if (!object(r) || Object.keys(r).some((k) => !Object.hasOwn(d.counter.raid, k)) || !RAID_PHASES.includes(r.phase ?? "none")) bad();
      for (const k of ["day", "total", "spawned", "killed", "retreated", "tries"]) if (r[k] !== undefined && !int(r[k], 0, 1e6)) bad();
      for (const k of ["timer", "spawnTimer", "clock"]) if (r[k] !== undefined && !num(r[k])) bad();
      if (r.report !== undefined && r.report !== null && (!object(r.report) || typeof r.report.won !== "boolean")) bad();
    }
    if (c.step >= 2 && c.region === "") bad();
  }
}
