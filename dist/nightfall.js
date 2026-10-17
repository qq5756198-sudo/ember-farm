// v0.35.0「长夜」：《爽点与耐玩体检方案》第四版（第 7 条：长夜千篇一律，输了白输）。
// 1. 夜相：每个长夜一种（雾夜、春雷夜、满月夜、闷热夜、迁徙夜、大风夜、冰夜、雪夜），按时节轮换；
//    前一天的早间广播、手记、顶上的提醒都说，当天 08:00 一张卡片。改的是哪种布置吃香：瞭望塔看多远、打多狠，
//    陷阱哑不哑，来什么感染者、从哪边来、走多快多扛打，你的体力回得多快，头目什么时候来。
//    难度线不动：守夜台上一个人守、备好防守的，八个夜相平均下来和原来差不多。
// 2. 没守住也留东西：第二天早上一张卡片（营地里的一段话），守夜笔记里记一页；这个夜相第一次没守住，另外一件纪念物；
//    下一回同样的夜相，预告里多一句弱点提示。不给钱、不给打仗的东西，故意输刷不出什么。
// 3. 废墟、隧道里倒下也记一笔：倒下的地方 7 天里留个记号，再进这张图提一句是谁打的、下回怎么防。
// 新进度放在 s.nightfall，原来的字段一个不加。
import {
  Engine as GrowEngine,
  freshState as growFresh,
  migrateState as growMigrate,
  newGameState as growNewGame,
  newGamePlusState as growNewGamePlus,
  needsUpgrade as growNeedsUpgrade,
  legacyGear,
} from "./grow.js";
import { hashOf, rngOf } from "./undertow.js";
import { ITEMS, REGIONS, ZOMBIES } from "./data.js";
import { WAVE_MIX } from "./longnight-data.js";
import { HORDE_DIRECTIONS } from "./expansion-data.js";
import { seasonOf, yearOf, decorItem } from "./almanac-data.js";
import { NIGHTFALL_SCHEMA, PHASES, PHASE_IDS, PHASE_LOOK, SEASON_PHASES, NF_KEEPSAKE, NOTES_MAX, MORNING_LINES, SELF_LINE, FALL_MARK, FALL_HINTS, INTRO_LINES } from "./nightfall-data.js";

export { legacyGear };
export const needsUpgrade = (text) => {
  if (growNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !raw.nightfall;
  } catch {
    return false;
  }
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const STAT_KEYS = ["nights", "held", "lost", "muted", "keepsakes", "mornings", "notes", "falls", "reminded", "cards"];
const nfDefaults = () => ({
  schema: NIGHTFALL_SCHEMA,
  // 从第几天起长夜有夜相（旧档：读进来那天之后的长夜才有，保证都提前一天说过）
  since: 0,
  // 每个夜相：哪天第一次碰上、守住几个、没守住几个、纪念物哪天给的、弱点提示哪天记下的
  seen: {},
  held: {},
  lost: {},
  keep: {},
  hint: {},
  // 没守住，第二天早上要说的（{ day, n, phase, wave, kills }）
  morning: null,
  // 守夜笔记：没守住的那几夜，最近 12 页
  notes: [],
  // 说过一次的话（当天 08:00 的夜相卡片……）
  told: {},
  // 废墟、隧道里倒下的地方（最近 30 次）
  falls: [],
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
});

export function migrateState(s) {
  growMigrate(s);
  if (!s.nightfall) {
    s.nightfall = nfDefaults();
    // 旧档：读进来以后的长夜才有夜相；第一帧说一声这一版的变化（新开的档在下面删掉）
    s.nightfall.since = s.day || 0;
    s.nightfall.intro = { day: s.day || 1, told: false };
  } else {
    const d = nfDefaults(),
      x = s.nightfall;
    s.nightfall = { ...d, ...x, stats: { ...d.stats, ...x.stats } };
  }
  return s;
}
const fresh = (s) => {
  delete s.nightfall;
  migrateState(s);
  delete s.nightfall.intro;
  s.nightfall.since = 0;
  return s;
};
export function freshState() {
  return fresh(growFresh());
}
export function newGameState(origin = "farmer") {
  return fresh(growNewGame(origin));
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  return fresh(growNewGamePlus(old, origin, keep, book));
}

export class Engine extends GrowEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    // 这一夜已经响过第一下的陷阱（雪夜），不进存档：读档后每个陷阱第一下再哑一次，只会更难，不会更容易
    this._nfFirst = new Set();
    this._nfPlace = null;
    this._nfMuted = null;
    // 守夜台：_nfForce 指定夜相（"none" 是没有夜相，和 v0.34 一样）
    this._nfForce = null;
  }
  get nf() {
    return this.s.nightfall;
  }
  nfStat(k, n = 1) {
    if (this.nf) this.nf.stats[k] = (this.nf.stats[k] || 0) + n;
  }
  nfRoll(...parts) {
    return rngOf(hashOf(this.ut?.seed ?? 1, "nf", ...parts))();
  }

  // ================= 1. 夜相 =================
  // 这一天的长夜是哪个夜相（不是长夜就是 null）：时节定两样，单数年第一样、双数年第二样
  nfPhase(day = this.s.day) {
    const g = this.nf;
    if (!g || !this.isLongNight?.(day)) return null;
    if (this._nfForce) return this._nfForce === "none" || !PHASES[this._nfForce] ? null : this._nfForce;
    if (day <= (g.since || 0)) return null;
    const list = SEASON_PHASES[seasonOf(day).id];
    return list ? list[(yearOf(day) - 1) % list.length] : null;
  }
  // 现在起作用的夜相：长夜打着的时候（在农场上）
  nfNow() {
    const N = this.ln?.night;
    return N ? this.nfPhase(N.day) : null;
  }
  nfFx() {
    const ph = this.nfNow();
    return ph ? PHASES[ph].fx : null;
  }
  // 今晚的夜相：打着的那一晚，或者今天是长夜、还没开始
  nfTonight() {
    const N = this.ln?.night;
    if (N) return this.nfPhase(N.day);
    return this.lnPending?.() ? this.nfPhase(this.s.day) : null;
  }
  // 长夜里农场的环境声跟着夜相（天边红过一半起）：春雷夜大雨、隔一阵打雷，大风夜呼呼的风，冰夜、雪夜风雪声
  soundWeather() {
    if (this.s.region !== "farm") return null;
    const ph = this.nfTonight?.();
    if (!ph || !(this.ln?.night || (this.lnSky?.() || 0) >= 0.5)) return null;
    return PHASE_LOOK[ph]?.sound || null;
  }
  // 大风夜从哪边来
  nfWindFrom(day) {
    const d = super.lnDirs(day)[0];
    return HORDE_DIRECTIONS[d]?.name || "";
  }
  // 一句话说这个夜相（预告、卡片用）
  nfRule(ph, day) {
    const P = PHASES[ph];
    if (!P) return "";
    return P.fx.oneDir ? P.rule.replace("（前一天说是哪边）", "（从" + this.nfWindFrom(day) + "来）") : P.rule;
  }
  nfHintLine(ph) {
    return this.nf?.hint[ph] ? "上回" + PHASES[ph].name + "没守住，记下了：" + PHASES[ph].hint : "";
  }

  // ---------- 只数、种类、方向、头目 ----------
  // 每波多少只：打着的那一夜按那一夜的夜相；白天算“下一个长夜约多少只”按下一个长夜的夜相
  waveCount(k, mult) {
    const n = super.waveCount(k, mult),
      ph = this.ln?.night ? this.nfPhase(this.ln.night.day) : this.ln?.storyDay ? this.nfPhase(this.nextLongNight?.() || 0) : null,
      c = ph ? PHASES[ph].fx.count : null;
    return c ? Math.max(1, Math.round(n * c)) : n;
  }
  // 大风夜：三波都从第一波那一边来
  lnDirs(day) {
    const d = super.lnDirs(day),
      ph = this.nfPhase(day);
    return ph && PHASES[ph].fx.oneDir ? [d[0]] : d;
  }
  lnSpawn() {
    const N = this.ln?.night,
      fx = this.nfFx();
    if (!N || !fx || (!fx.mix && !fx.hp)) return super.lnSpawn();
    const k = Math.min(3, Math.max(1, N.wave)),
      orig = WAVE_MIX[k - 1];
    let z;
    if (fx.mix) {
      const mix = { ...orig };
      for (const [t, m] of Object.entries(fx.mix)) if (mix[t]) mix[t] *= m;
      WAVE_MIX[k - 1] = mix;
    }
    try {
      z = super.lnSpawn();
    } finally {
      WAVE_MIX[k - 1] = orig;
    }
    if (z && fx.hp) {
      z.maxHp = Math.round(z.maxHp * fx.hp);
      z.hp = Math.round(z.hp * fx.hp);
    }
    return z;
  }
  // 雪夜：头目早来
  lnNext() {
    const n = super.lnNext?.(),
      fx = this.nfFx();
    return n && n.what === "boss" && fx?.bossEarly ? { ...n, at: n.at - fx.bossEarly } : n;
  }
  lnBossNote(N) {
    const ph = N ? this.nfPhase(N.day) : null,
      early = ph ? PHASES[ph].fx.bossEarly : 0;
    if (!early) return super.lnBossNote(N);
    return super.lnBossNote(N).replace("03:00", this.nfClock(300 - early));
  }
  // 22:00 起第几分钟 → 几点几分
  nfClock(m) {
    const t = (22 * 60 + m) % 1440;
    return String(Math.floor(t / 60)).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
  }

  // ---------- 瞭望塔：雾里看不远 ----------
  towerLineClear(tower, e) {
    const fx = this.nfFx();
    if (fx?.towerRange && e && tower && dist(tower, e) > fx.towerRange) return false;
    return super.towerLineClear(tower, e);
  }
  // ---------- 打中：瞭望塔准不准、陷阱哑不哑 ----------
  hurtEnemy(e, n, a, meta = {}) {
    const fx = this.nfFx();
    if (!fx || !e || e.dead || this.s.region !== "farm") return super.hurtEnemy(e, n, a, meta);
    const src = this._damageSource;
    if (src === "tower" && fx.towerDmg) n *= fx.towerDmg;
    if (src === "tower" && fx.towerBoss && e.lnBoss) n *= fx.towerBoss;
    if (src === "trap" && (fx.trapMute || fx.trapFirst)) {
      const trap = this.s.buildings.find((b) => b.type === "trap" && b.hp > 0 && dist(b, e) < 40);
      if (trap && this.nfMute(trap, e, fx)) {
        this.nfStat("muted");
        this._nfMuted = { trap, hp: trap.hp };
        this.effects.push({ x: trap.x, y: trap.y - 28, text: "哑了", t: 0.8, color: "#a9b4c2" });
        return;
      }
    }
    return super.hurtEnemy(e, n, a, meta);
  }
  nfMute(trap, e, fx) {
    const day = this.ln.night.day;
    if (fx.trapFirst) {
      const key = day + ":" + trap.id;
      if (!this._nfFirst.has(key)) {
        this._nfFirst.add(key);
        return true;
      }
    }
    if (!fx.trapMute) return false;
    e._nfTrap = (e._nfTrap || 0) + 1;
    return this.nfRoll("mute", day, trap.id, e.id || 0, e._nfTrap) < fx.trapMute;
  }
  // 哑了的陷阱不掉耐久（原来的代码打完照样扣，这里补回去）
  updateEnemy(e, dt) {
    this._nfMuted = null;
    const out = super.updateEnemy(e, dt),
      m = this._nfMuted;
    if (m) {
      m.trap.hp = Math.max(m.trap.hp, m.hp);
      this._nfMuted = null;
    }
    return out;
  }
  // ---------- 感染者走多快 ----------
  enemySpeed(e) {
    const base = super.enemySpeed(e),
      fx = this.nfFx();
    return fx?.speed && e?.horde && this.s.region === "farm" ? base * fx.speed : base;
  }

  // ---------- 开始、守住、没守住 ----------
  lnBegin() {
    const day = this.s.day,
      ph = this.nfPhase(day),
      early = ph ? PHASES[ph].fx.bossEarly : 0;
    let ok;
    if (early) {
      // 雪夜：开始时那句“03:00 头目来”说成早来的那个钟点
      const toast = this.toast,
        at = this.nfClock(300 - early);
      this.toast = (text, tone) => toast.call(this, String(text).replace("，03:00 ", "，" + at + " "), tone);
      try {
        ok = super.lnBegin();
      } finally {
        this.toast = toast;
      }
    } else ok = super.lnBegin();
    if (ok && ph && this.nf) {
      this.nf.seen[ph] ??= day;
      this.nfStat("nights");
      this._nfFirst = new Set();
      this.toast("今晚是" + PHASES[ph].name + "：" + PHASES[ph].short + "。", "warn");
      this.events.push({ type: "nfPhase", phase: ph });
    }
    return ok;
  }
  lnHold(how) {
    const N = this.ln?.night,
      ph = N ? this.nfPhase(N.day) : null;
    const ok = super.lnHold(how);
    if (ok && ph && this.nf) {
      this.nf.held[ph] = (this.nf.held[ph] || 0) + 1;
      this.nfStat("held");
    }
    return ok;
  }
  lnFail() {
    const N = this.ln?.night,
      snap = N ? { day: N.day, n: N.n, wave: N.wave, kills: N.kills } : null;
    const ok = super.lnFail();
    if (ok && snap && this.nf) this.nfLost(snap);
    return ok;
  }
  // 没守住：记下这个夜相和弱点提示，守夜笔记记一页；第二天早上一张卡片（纪念物那时候给）
  nfLost(N) {
    const g = this.nf,
      ph = this.nfPhase(N.day) || "";
    this.nfStat("lost");
    if (ph) {
      g.lost[ph] = (g.lost[ph] || 0) + 1;
      g.hint[ph] ??= N.day;
    }
    const page = { day: N.day, n: N.n, phase: ph, wave: N.wave, kills: Math.min(N.kills, 99999) };
    g.notes.push(page);
    if (g.notes.length > NOTES_MAX) g.notes.splice(0, g.notes.length - NOTES_MAX);
    this.nfStat("notes");
    g.morning = { ...page, day: N.day + 1 };
  }
  // 第二天早上（06:00 以后、不在打仗）：一张卡片；这个夜相第一次没守住，纪念物这时候放进背包
  nfMorningTick() {
    const g = this.nf,
      M = g?.morning;
    if (!M || this.ln?.night || this.s.day < M.day || (this.s.day === M.day && this.s.minute < 360)) return;
    g.morning = null;
    const P = PHASES[M.phase];
    let keep = "";
    if (P && !g.keep[M.phase]) {
      const item = decorItem(NF_KEEPSAKE[M.phase]);
      if (ITEMS[item]) {
        this.receive({ [item]: 1 });
        g.keep[M.phase] = this.s.day;
        keep = item;
        this.nfStat("keepsakes");
      }
    }
    const lines = [this.nfCampLine(M), "守夜笔记记下了：" + (P ? P.hint : "打到第 " + M.wave + " 波，打倒 " + M.kills + " 只。"), keep ? "留下一件纪念物「" + ITEMS[keep].name + "」：在建设里选「旧物摆件」摆出来。" : ""];
    this.moment("nfLost", "第 " + M.n + " 个长夜没守住" + (P ? " · " + P.name : ""), lines);
    if (this.o) this.olog("长夜没守住的第二天：" + lines.filter(Boolean).join(""), "");
    this.nfStat("mornings");
  }
  // 营地里谁在，谁说一段（按日子挑）；都不在就是自己写日记
  nfCampLine(M) {
    const here = (this.c?.residents || []).map((r) => r.id).filter((id) => MORNING_LINES[id]);
    if (!here.length) return M.day % 2 ? SELF_LINE : MORNING_LINES.any[Math.floor(this.nfRoll("line", M.day) * MORNING_LINES.any.length)];
    const who = here[Math.floor(this.nfRoll("who", M.day) * here.length)],
      list = MORNING_LINES[who];
    return list[Math.floor(this.nfRoll("line", M.day) * list.length)];
  }

  // ---------- 预告 ----------
  // 前一天的早间广播：明晚是什么夜相（没守住过的，多一句提醒）
  morningParts(day = this.s.day) {
    const parts = super.morningParts(day),
      ph = this.nf && this.ln?.storyDay ? this.nfPhase(day + 1) : null;
    if (!ph) return parts;
    const add = ["明晚是长夜，" + PHASES[ph].name + "：" + this.nfRule(ph, day + 1).replace(/。$/, "")],
      h = this.nfHintLine(ph);
    if (h) add.push(h.replace(/。$/, ""));
    return [...add, ...parts];
  }
  // 当天 08:00 日期变红的时候：一张夜相卡片
  nfRedTick() {
    const g = this.nf,
      day = this.s.day;
    if (!g || !this.lnPending?.() || this.s.minute < 480 || g.told["card:" + day]) return;
    const ph = this.nfPhase(day);
    if (!ph) return;
    for (const k of Object.keys(g.told)) if (g.told[k] < day - 60) delete g.told[k];
    g.told["card:" + day] = day;
    const P = PHASES[ph];
    this.moment("nfPhase", "今晚是" + P.name, [this.nfRule(ph, day), "吃香的：" + P.good + "；吃亏的：" + P.bad + "。", this.nfHintLine(ph)]);
    this.nfStat("cards");
  }
  // 手记“今天”：长夜那几行带上夜相
  todayItems() {
    const out = super.todayItems();
    if (!this.nf || !this.ln?.storyDay) return out;
    const tonight = this.nfTonight(),
      tomorrow = this.nfPhase(this.s.day + 1);
    return out.map((x) => {
      if (tonight && /^(今晚 22:00 长夜|长夜 · 第)/.test(x.text || "")) return { ...x, text: x.text + " · " + PHASES[tonight].name };
      if (tomorrow && x.text === "明天是长夜") return { ...x, text: "明天是长夜 · " + PHASES[tomorrow].name };
      return x;
    });
  }

  // ---------- 体力：闷热夜回得慢，冰夜在火边回得快 ----------
  update(dt, input = {}) {
    const p = this.s.player,
      st0 = p?.stamina ?? 0,
      fx = !this.paused ? this.nfFx() : null;
    const out = super.update(dt, input);
    const g = this.nf;
    if (!g || this.paused) return out;
    if (fx && (fx.regen || fx.warmRegen) && this.s.region === "farm") {
      const d = p.stamina - st0;
      if (d > 0 && d < 20) {
        let k = fx.regen || 1;
        if (fx.warmRegen && this.warmAt?.(p)) k *= fx.warmRegen;
        if (k !== 1) p.stamina = Math.max(0, Math.min(this.maxSta?.() ?? 100, st0 + d * k));
      }
    }
    // 旧档：第一帧一张“长夜”卡片
    if (g.intro && !g.intro.told) {
      g.intro.told = true;
      this.moment("intro", "长夜", INTRO_LINES);
    }
    this.nfRedTick();
    this.nfMorningTick();
    this.nfFallTick();
    return out;
  }

  // ================= 3. 废墟、隧道里倒下也记一笔 =================
  die() {
    const g = this.nf,
      region = this.s.region;
    if (g && !this.ln?.night && region !== "farm" && Object.hasOwn(REGIONS, region)) {
      const p = this.s.player,
        by = this._starve ? "hunger" : this.fx?.lastHitBy || "";
      g.falls.push({ region, x: Math.round(p.x), y: Math.round(p.y), day: this.s.day, by: Object.hasOwn(FALL_HINTS, by) && by !== "any" ? by : "", floor: region === "tunnel" ? this.tunnelFloor?.() || 0 : 0, told: false });
      if (g.falls.length > FALL_MARK.keep) g.falls.splice(0, g.falls.length - FALL_MARK.keep);
      this.nfStat("falls");
    }
    return super.die();
  }
  // 换了图（也包括倒下被送回农场）：下一帧重新看一遍这张图上有没有倒下过的地方
  assignRegion() {
    const out = super.assignRegion();
    this._nfPlace = null;
    return out;
  }
  // 进一张图（隧道是进一层）：7 天里在这里倒下过，提一句（每次倒下只提一次）
  nfFallTick() {
    const g = this.nf,
      region = this.s.region,
      floor = region === "tunnel" ? this.tunnelFloor?.() || 0 : 0,
      place = region + ":" + floor;
    if (place === this._nfPlace) return;
    this._nfPlace = place;
    if (!g?.falls.length || region === "farm") return;
    const day = this.s.day,
      f = [...g.falls].reverse().find((x) => x.region === region && !x.told && day - x.day <= FALL_MARK.days && (region !== "tunnel" || x.floor === floor));
    if (!f) return;
    f.told = true;
    this.nfStat("reminded");
    const who = f.by === "hunger" ? "，饿晕了" : f.by && ZOMBIES[f.by] ? "，被" + ZOMBIES[f.by].name + "打倒" : "";
    this.toast("上回你在这里倒下（第 " + f.day + " 天" + who + "）：" + (FALL_HINTS[f.by] || FALL_HINTS.any), "warn");
  }
  // 画面上：这张图上 7 天里倒下过的地方（隧道每天的样子不一样，不画）
  nfFallMarks(region = this.s.region) {
    const g = this.nf,
      day = this.s.day;
    if (!g || region === "tunnel") return [];
    return g.falls.filter((f) => f.region === region && day - f.day <= FALL_MARK.days);
  }

  // ================= 页面用的 =================
  nfInfo() {
    const g = this.nf;
    if (!g) return null;
    const on = !!this.ln?.storyDay,
      tonight = on ? this.nfTonight() : null,
      next = on ? this.nextLongNight?.() || 0 : 0,
      nextPh = next ? this.nfPhase(next) : null;
    return {
      on,
      tonight,
      next,
      nextPh,
      nextRule: nextPh ? this.nfRule(nextPh, next) : "",
      seen: PHASE_IDS.filter((p) => g.seen[p]).length,
      heldKinds: PHASE_IDS.filter((p) => g.held[p]).length,
      // 按时节、按年份排（和日历上轮到的顺序一样）
      rows: Object.values(SEASON_PHASES).flat().map((p) => ({ id: p, name: PHASES[p].name, season: PHASES[p].season, short: PHASES[p].short, seen: g.seen[p] || 0, held: g.held[p] || 0, lost: g.lost[p] || 0, keep: g.keep[p] ? decorItem(NF_KEEPSAKE[p]) : "", hint: g.hint[p] ? PHASES[p].hint : "" })),
      notes: [...g.notes].reverse(),
    };
  }

  // ================= 存档 =================
  static parse(text) {
    const s = GrowEngine.parse(text);
    migrateState(s);
    validateNightfall(s);
    return s;
  }
}

function validateNightfall(s) {
  const g = s.nightfall,
    bad = (why) => {
      throw new Error("存档里的夜相记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
    };
  if (!g || typeof g !== "object" || Array.isArray(g)) bad("缺少");
  const int = (v, lo = 0, hi = 1e9) => Number.isInteger(v) && v >= lo && v <= hi,
    obj = (v) => !!v && typeof v === "object" && !Array.isArray(v),
    byPhase = (o) => obj(o) && Object.entries(o).every(([k, v]) => Object.hasOwn(PHASES, k) && int(v, 0, 1e6)),
    phaseOk = (p) => p === "" || Object.hasOwn(PHASES, p),
    note = (n) => obj(n) && int(n.day, 1, 1e6) && int(n.n, 1, 1e5) && typeof n.phase === "string" && phaseOk(n.phase) && int(n.wave, 0, 3) && int(n.kills, 0, 99999);
  if (!int(g.schema, 1, 99)) bad("版本");
  if (!int(g.since, 0, 1e6)) bad("版本");
  for (const k of ["seen", "held", "lost", "keep", "hint"]) if (!byPhase(g[k])) bad("夜相");
  if (g.morning !== null && !note(g.morning)) bad("第二天早上");
  if (!Array.isArray(g.notes) || g.notes.length > NOTES_MAX || !g.notes.every(note)) bad("守夜笔记");
  if (!obj(g.told) || Object.keys(g.told).length > 400 || Object.entries(g.told).some(([k, v]) => k.length > 40 || !int(v))) bad("记录");
  if (!Array.isArray(g.falls) || g.falls.length > FALL_MARK.keep) bad("倒下的地方");
  for (const f of g.falls)
    if (!obj(f) || !Object.hasOwn(REGIONS, f.region) || f.region === "farm" || !int(f.day, 1, 1e6) || !Number.isFinite(f.x) || !Number.isFinite(f.y) || Math.abs(f.x) > 1e5 || Math.abs(f.y) > 1e5 || typeof f.by !== "string" || (f.by && !Object.hasOwn(FALL_HINTS, f.by)) || !int(f.floor, 0, 999) || typeof f.told !== "boolean") bad("倒下的地方");
  if (!obj(g.stats) || Object.values(g.stats).some((v) => !int(v))) bad("记录");
  if (g.intro !== undefined && (!obj(g.intro) || !int(g.intro.day, 0, 1e6) || typeof g.intro.told !== "boolean")) bad("记录");
}
