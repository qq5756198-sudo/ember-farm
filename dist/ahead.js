// v0.46.0「有奔头」：引擎最上面一层（盖在 v0.45 顺手那一层上面）。中后期：
// 1. 钱的去处——复兴工程：第二年起每个时节头一天开一处（3,000–10,000 金加材料），出钱请人把余烬地区的老地方修起来；
//    第二天早上完工，来一封信、留一样摆件，三天后送来头一批那里的特产、以后每个时节头一天再送；修好的地方给一样方便（多浇几块田、士气、
//    「休息好」、路近、送材料、咬钩快、三天的天气、旧物线索……），不给战力。收复余烬地区以后开第二期（13,000–21,500 金）：
//    北线通车、地面上的学校、灯塔、戏台、老公路、纪念碑。
// 2. 主线打完以后手记最上面那张是“眼下”最值得做的一件（今晚的长夜、这个时节的复兴工程、这周的事……），老的家园计划折在下面；
//    左下角“当前目标”跟着它。
// 3. 奖励随进度：主线打完以后每守住一个长夜，每日抉择的回报多 0.2 倍（最多 4 倍）；这周的清单、季节头目、被困的人给的金币多两成（最多 3 倍）。
// 4. 少弹几条提示：天天一样的、别处已经说了的，照旧进消息记录，不在头顶弹。
// 新进度放在 s.ahead，原来的字段不动。
import { Engine as HandyEngine, freshState as hFresh, newGameState as hNewGame, newGamePlusState as hNewGamePlus, needsUpgrade as hNeedsUpgrade, migrateState as hMigrate } from "./handy.js";
import { ITEMS, CROPS } from "./data.js";
import { CROP_SEASON, seasonOf, seasonDay, decorItem } from "./almanac-data.js";
import { OLD } from "./relight-data.js";
import { WEEK_NAMES, SURVIVOR, WEEK_LISTS, SEASON_BOSSES } from "./hope-data.js";
import { AHEAD_SCHEMA, START, isWeekStart, PROJECTS, PROJECT_BY_ID, BATCH1, BATCH2, BUILD, STAGE_DAYS, FIRST_SEND, CRATE, OUTSIDE, KID_LETTERS, NOW, REWARD, QUIET, QUIET_IDS, SAY, INTRO_LINES, KEEP_IDS } from "./ahead-data.js";

export { legacyGear } from "./ease.js";

const isObj = (x) => !!x && typeof x === "object" && !Array.isArray(x);
const dayMap = (x) => (isObj(x) ? Object.fromEntries(Object.entries(x).filter(([k, v]) => PROJECT_BY_ID[k] && Number.isInteger(v) && v >= 1)) : {});
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " " + n)
    .join("、");

export function aheadDefaults() {
  return {
    schema: AHEAD_SCHEMA,
    // 开了的、出了钱的、修好的（→ 哪一天）
    opened: {},
    paid: {},
    done: {},
    // 孩子们寄来的信、北线捎来过几样、上一回送东西是哪天（每天的、每个时节头一天的）、戏台上一回唱戏是哪天
    kids: [],
    outside: 0,
    lastDay: 0,
    lastWeek: 0,
    stage: 0,
    // 少弹的那几条前几回照常弹：各弹过几回
    said: {},
  };
}
const KEYS = Object.keys(aheadDefaults());
function aheadMigrate(s) {
  const d = aheadDefaults(),
    x = s.ahead;
  if (!isObj(x)) {
    s.ahead = d;
    // 已经到第二年的旧档：读进来第一帧一张卡片说复兴工程（第二年以前的旧档和新开的档一样，等头一处开了再说）
    if ((s.day || 1) >= START.day) s.ahead.intro = { day: s.day || 1, told: false };
    return s;
  }
  const int = (v) => (Number.isInteger(v) && v >= 0 ? v : 0);
  s.ahead = {
    schema: AHEAD_SCHEMA,
    opened: dayMap(x.opened),
    paid: dayMap(x.paid),
    done: dayMap(x.done),
    kids: Array.isArray(x.kids) ? x.kids.filter((k) => KID_LETTERS.some((L) => L.id === k)).slice(0, KID_LETTERS.length) : [],
    outside: int(x.outside),
    lastDay: int(x.lastDay),
    lastWeek: int(x.lastWeek),
    stage: int(x.stage),
    said: isObj(x.said) ? Object.fromEntries(Object.entries(x.said).filter(([k, v]) => QUIET_IDS.includes(k) && Number.isInteger(v) && v >= 0).map(([k, v]) => [k, Math.min(v, 99)])) : {},
    ...(isObj(x.intro) ? { intro: { day: int(x.intro.day) || 1, told: x.intro.told === true } } : {}),
  };
  return s;
}
function validateAhead(x) {
  const bad = (why) => {
    throw new Error("存档里的复兴工程记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
  };
  if (!isObj(x)) bad("缺少");
  if (!Number.isInteger(x.schema) || x.schema < 1 || x.schema > 99) bad("版本");
  for (const k of ["opened", "paid", "done", "said"]) if (!isObj(x[k])) bad(k);
  if (!Array.isArray(x.kids)) bad("kids");
  if (Object.keys(x).some((k) => k !== "intro" && !KEYS.includes(k))) bad("多了字段");
}
export function migrateState(s) {
  hMigrate(s);
  return aheadMigrate(s);
}
const fresh = (s) => {
  s.ahead = aheadDefaults();
  return s;
};
export function freshState() {
  return fresh(hFresh());
}
export function newGameState(origin = "farmer") {
  return fresh(hNewGame(origin));
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  return fresh(hNewGamePlus(old, origin, keep, book));
}
// 读档以前：没有复兴工程这一块的旧档，原样留一份在升级检查点里（那一格空着的话）
export const needsUpgrade = (text) => {
  if (hNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !Array.isArray(raw) && !raw.ahead;
  } catch {
    return false;
  }
};
// 少弹的提示：哪一条规矩管这一句（没有就是照常弹）
export function aheadQuiet(text, tone = "normal") {
  if (typeof text !== "string") return null;
  return QUIET.find((q) => q.re.test(text) && (!q.tones || q.tones.includes(tone || "normal"))) || null;
}

export class Engine extends HandyEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this.ahEnsure();
  }
  get ah() {
    return this.s.ahead;
  }

  // ================= 复兴工程 =================
  ahProject(id) {
    return PROJECT_BY_ID[id] || null;
  }
  ahDone(id) {
    return !!this.ah?.done[id];
  }
  ahBuilding(id) {
    return !!this.ah?.paid[id] && !this.ah.done[id];
  }
  ahOpen(id) {
    return !!this.ah?.opened[id];
  }
  // 修好了的那几处的好处：加起来的（浇几块田、士气、多几分钟）和乘起来的（路、咬钩）
  ahFx(key) {
    const h = this.ah;
    if (!h) return key === "travel" || key === "bite" || key === "home" ? 1 : 0;
    let sum = 0,
      mul = 1;
    for (const id of Object.keys(h.done)) {
      const v = PROJECT_BY_ID[id]?.fx?.[key];
      if (v == null || v === false) continue;
      if (typeof v === "number") {
        sum += v;
        mul *= v;
      } else sum += 1;
    }
    return key === "travel" || key === "bite" || key === "home" ? mul : sum;
  }
  // 那片地方去得了没有（第二期：收复以后都去得了）
  ahReach(p) {
    if (!p) return false;
    if (p.batch === 2) return !!this.ln?.ended;
    if (["farm", "hospital", "market"].includes(p.place)) return true;
    return !!(this.d?.unlocked?.[p.place] || this.b?.unlocked?.[p.place] || this.s.visited?.[p.place]);
  }
  // 到今天该开几处：第一期从第 29 天起每 7 天一处；第二期从收复那天起每 7 天一处
  ahSlots(batch, day = this.s.day) {
    if (batch === 1) return day < START.day ? 0 : Math.floor((day - START.day) / 7) + 1;
    const L = this.ln;
    if (!L?.ended || !L.endDay) return 0;
    return day < L.endDay ? 0 : Math.floor((day - L.endDay) / 7) + 1;
  }
  // 开到该开的数（这一处的地方还去不了就先跳过，去得了再开）
  ahEnsure() {
    const h = this.ah;
    if (!h) return [];
    const day = this.s.day,
      out = [];
    for (const [batch, ids] of [
      [1, BATCH1],
      [2, BATCH2],
    ]) {
      const slots = this.ahSlots(batch, day);
      let have = ids.filter((id) => h.opened[id]).length;
      for (const id of ids) {
        if (have >= slots) break;
        if (h.opened[id] || !this.ahReach(PROJECT_BY_ID[id])) continue;
        h.opened[id] = day;
        have++;
        out.push(id);
      }
    }
    return out;
  }
  ahCostText(cost) {
    return Object.entries(cost || {})
      .map(([k, n]) => (k === "gold" ? Number(n).toLocaleString("en-US") + " 金币" : (ITEMS[k]?.name || k) + " " + n))
      .join("、");
  }
  ahReason(id) {
    const p = this.ahProject(id),
      h = this.ah;
    if (!p || !h) return "没有这一处";
    if (!h.opened[id]) return "还没开";
    if (h.done[id]) return "已经修好了";
    if (h.paid[id]) return "工人正在修，明早完工";
    if (this.s.region !== "farm") return "回到农场再办";
    return this.hpLack(p.cost);
  }
  // 出钱：第二天早上 6 点完工
  ahFund(id) {
    const why = this.ahReason(id);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const p = this.ahProject(id);
    if (!this.hpPay(p.cost)) return false;
    this.ah.paid[id] = this.s.day;
    this.zFloat?.(SAY.paid(p), "#ffd27a");
    if (this.o) this.olog(SAY.paid(p) + "（花了 " + this.ahCostText(p.cost) + "）。", "gold");
    this.emit("craft");
    return true;
  }
  // 06:00：出了钱的修好（前一天以前出的钱）
  ahFinish() {
    const h = this.ah,
      day = this.s.day,
      out = [];
    for (const [id, d] of Object.entries(h.paid)) {
      if (h.done[id] || d >= day) continue;
      h.done[id] = day;
      out.push(id);
      const p = PROJECT_BY_ID[id];
      this.putStorage({ [decorItem(p.keep.id)]: 1 });
      const lines = [p.text, p.who + "来信：" + p.letter, "留给你一样摆件：" + p.keep.name + "（已入仓）"];
      if (p.fx?.finale) lines.push("余烬地区，复兴了。");
      this.moment("ahead", SAY.done(p), lines, { icon: "build" });
      if (this.o) this.olog(SAY.done(p) + "：" + p.text, "gold");
    }
    return out;
  }
  // 06:00：送东西（每天的；修好三天后头一批、以后每个时节头一天的特产、布、药、种子、海货、外面的东西、孩子们的信、旧物线索）
  ahSend() {
    const h = this.ah,
      day = this.s.day,
      got = {},
      notes = [];
    const add = (b) => {
      for (const [k, n] of Object.entries(b || {})) if (ITEMS[k] && n > 0) got[k] = (got[k] || 0) + n;
    };
    const season = seasonOf(day).id;
    // 一处修好的地方送一回
    const give = (p) => {
      const fx = p.fx || {};
      if (p.special) add({ [p.special.id]: p.special.n });
      add(fx.weekly);
      if (fx.seeds) for (const [crop, [good]] of Object.entries(CROP_SEASON)) if (good === season && CROPS[crop]?.seed && ITEMS[CROPS[crop].seed]) add({ [CROPS[crop].seed]: fx.seeds });
      if (fx.crate) add({ [CRATE.fish[Math.floor((day - 1) / 7) % CRATE.fish.length]]: CRATE.n, salt: CRATE.salt });
      if (fx.outside) {
        const o = OUTSIDE[h.outside % OUTSIDE.length];
        h.outside++;
        add({ [o.id]: 1 });
      }
      if (fx.kids) {
        const L = KID_LETTERS.find((k) => !h.kids.includes(k.id));
        if (L) {
          h.kids.push(L.id);
          add(L.gift);
          notes.push("孩子们的信——" + L.from + "：" + L.text);
        }
      }
      if (fx.clue && this.hp) {
        const pool = this.ledgerPool?.() || [];
        const o = pool[0];
        if (o) {
          this.hp.clues.push(o);
          notes.push(SAY.clue(OLD[o]?.name || o, this.ledgerText(o)));
        }
      }
    };
    if (h.lastDay !== day) {
      h.lastDay = day;
      for (const id of Object.keys(h.done)) add(PROJECT_BY_ID[id]?.fx?.daily);
      // 修好三天后的早上先送来头一批（正好碰上时节头一天的，下面照时节头一天的送，不送两回）
      if (!isWeekStart(day)) for (const [id, d] of Object.entries(h.done)) if (day - d === FIRST_SEND && PROJECT_BY_ID[id]) give(PROJECT_BY_ID[id]);
    }
    if (isWeekStart(day) && h.lastWeek !== day) {
      h.lastWeek = day;
      for (const id of Object.keys(h.done)) {
        // 修好的当天不送（明天起算）
        if (h.done[id] >= day || !PROJECT_BY_ID[id]) continue;
        give(PROJECT_BY_ID[id]);
      }
    }
    if (Object.keys(got).length) {
      this.putStorage(got);
      if (this.o) this.olog(SAY.sent(itemsText(got)));
    }
    if (this.o) for (const n of notes) this.olog(n);
    return got;
  }
  // 戏台：每个时节最后一天 19:00 唱一台戏
  ahStage() {
    if (!this.ahDone("stage") || seasonDay(this.s.day) !== 7 || this.ah.stage === this.s.day) return false;
    this.ah.stage = this.s.day;
    if (this.o) this.olog("集市的戏台唱了一台戏：之后三天全营士气 +" + PROJECT_BY_ID.stage.fx.stage + "。", "gold");
    this.zFloat?.("戏台开唱了", "#ffd27a");
    return true;
  }

  // ---------- 修好的地方给的方便 ----------
  trAutoCount() {
    return super.trAutoCount() + this.ahFx("water");
  }
  moodFactors() {
    const out = super.moodFactors();
    if (!this.ah) return out;
    for (const id of ["teahouse", "monument"]) if (this.ahDone(id)) out.push({ key: "ah_" + id, v: PROJECT_BY_ID[id].fx.morale, text: PROJECT_BY_ID[id].name });
    if (this.ahDone("stage") && this.ah.stage && this.s.day - this.ah.stage < STAGE_DAYS) out.push({ key: "ah_stage", v: PROJECT_BY_ID.stage.fx.stage, text: "刚唱过戏" });
    return out;
  }
  trRestMinutes() {
    return super.trRestMinutes() + this.ahFx("rest");
  }
  travelBonus(n, to) {
    n = super.travelBonus(n, to);
    if (!this.ah || this._travelFrom === "tunnel" || to === "tunnel") return n;
    const k = this.ahFx("travel") * (to === "farm" ? this.ahFx("home") : 1);
    return k < 1 ? Math.max(1, Math.ceil(n * k)) : n;
  }
  hpBite(water) {
    super.hpBite(water);
    const f = this.c?.fishing,
      k = this.ahFx("bite");
    if (f && k < 1) f.biteAt = Math.max(0.6, Math.round(f.biteAt * k * 10) / 10);
  }
  // 测风塔：天气多看一天（广播说后天、大后天）
  forecast() {
    const out = super.forecast();
    if (!this.ahFx("forecast")) return out;
    const d0 = this.s.day;
    try {
      this.s.day = d0 + 1;
      for (const x of super.forecast()) if (!out.some((y) => y.day === x.day)) out.push(x);
    } finally {
      this.s.day = d0;
    }
    return out;
  }
  morningParts(day = this.s.day) {
    const parts = super.morningParts(day);
    if (!this.ah || day !== this.s.day) return parts;
    const add = [];
    const opened = PROJECTS.filter((p) => this.ah.opened[p.id] === day);
    for (const p of opened) add.push(SAY.radio(p));
    if (this.ahFx("forecast")) {
      const fc = this.forecast?.() || [],
        w2 = fc.find((d) => d.day === day + 2)?.weather,
        w3 = fc.find((d) => d.day === day + 3)?.weather;
      if (w2 && w3) add.push("测风塔：后天" + w2 + "，大后天" + w3);
    }
    return [...add, ...parts];
  }
  decorOwned() {
    const base = super.decorOwned();
    if (!this.ah) return base;
    return [...base, ...KEEP_IDS.filter((id) => this.qty(decorItem(id), true) > 0 && !base.includes(id))];
  }

  // ================= 奖励随进度 =================
  ahHeld() {
    return Math.min(REWARD.cap, this.ln?.held || 0);
  }
  // 每日抉择：主线打完以后每守住一个长夜多 0.2 倍（第六段起的 2 倍往上加，最多 4 倍）。存档里那一档照旧记 1 / 1.5 / 2，
  // 放大的这一截在算数的时候乘上（守住的长夜多了，同一张卡的数跟着大）
  ahDailyMult() {
    if (!this.ah || !this.ln?.storyDay) return 1;
    return 1 + (REWARD.per * this.ahHeld()) / REWARD.dailyBase;
  }
  ahTier(tier = this.dy?.pending?.tier || this.tier()) {
    return tier >= REWARD.dailyBase ? Math.round(tier * this.ahDailyMult() * 10) / 10 : tier;
  }
  scaleN(n, tier = this.dy?.pending?.tier || this.tier()) {
    return super.scaleN(n, this.ahTier(tier));
  }
  ahGoldMult() {
    return this.ah ? 1 + REWARD.per * this.ahHeld() : 1;
  }
  // 这周的清单、季节头目、被困的人给的金币：照进度多给（多出来的那一份另记一行）
  ahBonusGold(base, why) {
    const extra = Math.round(base * (this.ahGoldMult() - 1));
    if (extra <= 0) return 0;
    this.s.money += extra;
    this.zFloat?.("守住了 " + this.ahHeld() + " 个长夜：多给 " + extra + " 金", "#ffd27a");
    if (this.o) this.olog(why + "：守住了 " + this.ahHeld() + " 个长夜，多给 " + extra + " 金币。", "gold");
    return extra;
  }
  weekListGive(key) {
    const W = this.hp?.week,
      was = W?.kind === "list" ? W.st : "";
    const ok = super.weekListGive(key);
    if (ok && W && was === "open" && W.st === "done") this.ahBonusGold(WEEK_LISTS[W.id]?.reward?.gold || 0, "这周的清单");
    return ok;
  }
  seasonBossDown(z) {
    const W = this.hp?.week,
      was = W?.st;
    const out = super.seasonBossDown(z);
    if (W && was === "on" && W.st !== "on") this.ahBonusGold(SEASON_BOSSES[W.id]?.gold || 0, "季节头目");
    return out;
  }
  survivorSafeHope() {
    const out = super.survivorSafeHope();
    this.ahBonusGold(SURVIVOR.gold, "被困的人");
    return out;
  }

  // ================= 少弹几条提示 =================
  toast(text, tone) {
    const q = this.ah ? aheadQuiet(text, tone) : null;
    if (q) {
      const said = this.ah.said;
      if (q.after && (said[q.id] || 0) < q.after) {
        said[q.id] = (said[q.id] || 0) + 1;
        return super.toast(text, tone);
      }
      if (q.float) this.zFloat?.(q.float === true ? String(text).replace(/[。！]$/, "").slice(0, 22) : q.float, tone === "warn" ? "#f1a28a" : tone === "gold" ? "#ffd76a" : undefined);
      if (this.o) this.olog(text, tone);
      return;
    }
    return super.toast(text, tone);
  }

  // ================= 眼下：手记最上面那一张 =================
  // 主线打完以后（联盟来信那一段段都领完了）：今晚的长夜 → 这个时节的复兴工程 → 这周的事 → 正在修的 → 等第二期 → 自己安排
  ahStoryOver() {
    return !!this.sc && !this.storyGoal?.();
  }
  ahNow() {
    if (!this.ah || !this.ahStoryOver()) return null;
    const list = this.ahNowList();
    if (!list.length) return null;
    // 也开着的（最多两样，一行字）
    return { ...list[0], also: list.slice(1, 3).map((x) => x.short || x.title) };
  }
  // 按要紧排：今晚的长夜 → 这周的事（过几天就没了）→ 这个时节的复兴工程（办得起的、攒钱的）→ 正在修的 → 等第二期 → 都办完了 → 自己安排
  ahNowList() {
    const out = [],
      info = this.lnInfo?.();
    if (info?.today && !info.night) out.push({ kind: "night", title: NOW.night.title + "（第 " + (info.tried + 1) + " 个）", short: "今晚长夜", text: NOW.night.text, gain: "守到 04:00 就算守住；守住了下一个大两成，回报也跟着大。", go: { action: "oDefense", id: "", label: NOW.night.go } });
    const W = this.hp?.week;
    const live = W && ((W.kind === "traveler" && W.st === "here") || (W.kind === "list" && W.st === "open") || (W.kind === "caravan" && W.st === "here") || (W.kind === "boss" && W.st === "on"));
    if (live) out.push({ kind: "week", title: "这周 · " + WEEK_NAMES[W.kind], short: "这周的" + WEEK_NAMES[W.kind], text: this.weekText(W), gain: this.ahHeld() ? "回报照守住的长夜多 " + Math.round((this.ahGoldMult() - 1) * 100) + "%。" : "", go: { action: "oView", id: "hpWeek", label: NOW.week.go } });
    const open = PROJECTS.filter((p) => this.ah.opened[p.id] && !this.ah.paid[p.id] && !this.ah.done[p.id]);
    const gift = (p) => "修好了来一封信、留一样摆件" + (p.special ? "，三天后送来头一批" + p.special.name + "，以后每个时节头一天再送" : "") + "。";
    for (const p of open.filter((x) => !this.hpLack(x.cost)).slice(0, 1)) out.push({ kind: "project", id: p.id, title: NOW.project.title(p), short: "复兴工程 · " + p.name, text: p.text, cost: this.ahCostText(p.cost), gain: gift(p), go: { action: "oView", id: "ahead", label: NOW.project.go } });
    if (!out.some((x) => x.kind === "project"))
      for (const p of open.slice(0, 1)) out.push({ kind: "save", id: p.id, title: NOW.save.title(p), short: "攒钱办" + p.name, text: p.text, cost: this.ahCostText(p.cost) + "（" + this.hpLack(p.cost) + "）", gain: gift(p), go: { action: "oView", id: "ahead", label: NOW.save.go } });
    for (const p of PROJECTS.filter((x) => this.ahBuilding(x.id)).slice(0, 1)) out.push({ kind: "building", id: p.id, title: NOW.building.title(p), short: p.name + "明早完工", text: NOW.building.text, gain: "", go: { action: "oView", id: "ahead", label: NOW.building.go } });
    if (out.length) return out;
    if (PROJECTS.every((p) => this.ah.done[p.id])) return [{ kind: "done", title: NOW.done.title, text: NOW.done.text, gain: "", go: { action: "oView", id: "ahead", label: NOW.project.go } }];
    const batch1 = BATCH1.every((id) => this.ah.done[id] || !this.ahReach(PROJECT_BY_ID[id]));
    if (batch1 && !this.ln?.ended && info?.on) return [{ kind: "wait2", title: NOW.wait2.title, text: NOW.wait2.text(Math.max(1, (info.goal || 10) - (info.held || 0))), gain: "", go: { action: "oView", id: "ahead", label: NOW.project.go } }];
    return [{ kind: "rest", title: NOW.rest.title, text: NOW.rest.text, gain: "", go: { action: "oView", id: "ahead", label: NOW.rest.go } }];
  }
  // 左下角“当前目标”：主线打完以后跟着“眼下”
  guidedGoal() {
    const g = super.guidedGoal();
    if (this.guidance?.focus) return g;
    const n = this.ahNow();
    return n ? { ...g, title: n.title } : g;
  }

  // ================= 时间 =================
  workHour() {
    // 正点那一下：真的一帧一帧走时，分钟是一小截一小截加上去的，到整点时常常差一丝（比如 359.9999…），
    // 直接取整会算成上一个钟点（6 点的事 7 点才办），所以多给半分钟
    const h = Math.floor((this.s.minute + 0.5) / 60);
    super.workHour();
    if (!this.ah) return;
    this.ahEnsure();
    // 头一处开了：一张卡片说复兴工程是什么（只一回）
    if (!this.ah.intro && Object.keys(this.ah.opened).length) this.ah.intro = { day: this.s.day, told: false };
    if (h === BUILD.hour) {
      this.ahFinish();
      this.ahSend();
    }
    if (h === 19) this.ahStage();
  }
  update(dt, input = {}) {
    const out = super.update(dt, input);
    const intro = !this.paused && this.ah?.intro;
    if (intro && !intro.told) {
      intro.told = true;
      this.moment("ahead", "复兴工程", INTRO_LINES, { icon: "build" });
    }
    return out;
  }

  // ================= 存档 =================
  static parse(text) {
    const s = HandyEngine.parse(text);
    aheadMigrate(s);
    validateAhead(s.ahead);
    return s;
  }
}
