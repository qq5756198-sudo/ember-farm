// v0.31.0「重光」：星露谷 30 个好玩点移植方案第三版（看得见的重光）。
// 1. 重建清单（重建站、6 面墙、28 份清单、信号烟花）；2. 旧世界陈列（48 件旧物、锁着的铁盒）；3. 地铁隧道（30 层）；
// 4. 残页（24 张、藏货点）；5. 年终评定和收复度；6. 鼎丰物资；7. 余烬核（体力、生命上限）。
// 新进度放在 s.relight，原来的字段不动。
import {
  Engine as KinEngine,
  freshState as kinFresh,
  migrateState as kinMigrate,
  newGameState as kinNewGame,
  newGamePlusState as kinNewGamePlus,
  needsUpgrade as kinNeedsUpgrade,
  legacyGear,
} from "./kin.js";
import { hashOf, rngOf } from "./undertow.js";
import { ITEMS, CROPS, BUILDINGS, REGIONS, WORLD } from "./data.js";
import { PROWL, TIERS, ATTACHMENTS, BOSSES } from "./undertow-data.js";
import { NOISE, NOISE_SRC, ALLY } from "./bustle-data.js";
import { ENDING } from "./longnight-data.js";
import { DECOR, decorItem, DECOR_RULES } from "./almanac-data.js";
import { prefsOf, HEART_IDS, FISH_IDS, KEEPSAKES, KEEP_IDS, KEEP_RULES } from "./kin-data.js";
import {
  RL_SCHEMA,
  STATION,
  WALLS,
  WALL_IDS,
  WALL_FX,
  GROUPS,
  LISTS,
  LIST_IDS,
  WALL_LISTS,
  FIREWORKS,
  COMPANY,
  OLD,
  OLD_IDS,
  OLD_GROUPS,
  OLD_GROUP_IDS,
  OLD_RULES,
  BOX,
  PAGE_RULES,
  DIGS,
  DIG_IDS,
  PAGES,
  PAGE_IDS,
  TUNNEL,
  CORES,
  CORE_IDS,
  CORE_BONUS,
  REVIEW,
  COMPLETION,
} from "./relight-data.js";
import { OLD_STORY, OLD_GROUP_LINES, DIARY, RIDDLE, LORE, CORE_LINES, WALL_LINES, WALL_BOUGHT, FIREWORKS_TEXT, REVIEW_LETTER, FINALE, COMPANY_ENDING, CO_TEXT, TUNNEL_TEXT, INTRO, INTRO_LINES } from "./relight-story.js";
import { tunnelLayout, tunnelArtKey, SPAWN as T_SPAWN, UP as T_UP, LAST_FLOOR, STORE_FLOORS, LIFT_FLOORS } from "./tunnel-gen.js";

export { legacyGear };
// 读进来之前原样留一份：v0.30 及更早的存档（没有重光的记录）也算
export const needsUpgrade = (text) => {
  if (kinNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !raw.relight;
  } catch {
    return false;
  }
};

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + (n > 1 ? " ×" + n : ""))
    .join("、");
const pickW = (list, x) => {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let acc = 0;
  for (const [v, w] of list) {
    acc += w / total;
    if (x < acc) return v;
  }
  return list[list.length - 1][0];
};
// 地底避难城里，医院升降井旁边的检修平台
export const SHAFT = { region: "shelter", x: 1240, y: 880 };
const STAT_KEYS = ["delivered", "lists", "walls", "fireworks", "donated", "groups", "boxes", "pages", "digs", "trips", "lifts", "stores", "tunnelDowns", "reviews", "coBought", "coCut", "cores", "found", "deaths"];
const CRATE_NAME = { toolbox: "检修工具柜", cargo: "货运箱", garage: "电工柜", wardrobe: "失物招领柜", kitchen: "值班室橱柜", medicine: "急救箱" };

const rlDefaults = () => ({
  schema: RL_SCHEMA,
  // 重建清单：每份交了多少（清单 → 一格 → 数）；交满的清单；通了的墙（by: list 交清单 / co 鼎丰修的）
  lists: {},
  done: [],
  walls: {},
  // 放信号烟花的那天
  fire: 0,
  // 捐进档案馆的旧物、给过回礼的组
  old: [],
  groups: [],
  // 读过的残页（按捡到的先后）、挖过的藏货点
  pages: [],
  dug: [],
  // 地铁隧道：现在在第几层（0 = 不在）、进这一层时定下的样子、下到过最深、修好的电梯、物资库上次搬空的日子、第 30 层的光拿了没有
  tunnel: { floor: 0, key: null, deepest: 0, lifts: [], store: {}, core: false },
  // 年终评定：{ y, day, s: 八项分数, v: 八项的数, lamps }
  reviews: [],
  // 老怀表：0 没有、1 有了还没摆、2 摆出来了
  watch: 0,
  // 余烬核
  cores: [],
  coreDay: {},
  // 鼎丰物资：state "" 没签 / signed 签着 / torn 撕了
  co: { state: "", day: 0, paid: 0, bought: {}, pending: {}, leave: null, asked: 0, cut: 0, acc: 0, cutDay: 0, cutToday: 0 },
  // 这一年开头的数（年终评定算这一年的收成、守夜用）
  mark: { day: 1, harvested: 0, hordes: 0, held: 0 },
  // 收复度到 100% 的那天
  finale: 0,
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
});

export function migrateState(s) {
  kinMigrate(s);
  if (!s.relight) {
    s.relight = rlDefaults();
    s.relight.mark = { day: s.day || 1, harvested: s.stats?.harvested || 0, hordes: s.stats?.hordes || 0, held: s.longnight?.held || 0 };
    // 旧档：进游戏时说一声这一版的变化（新开的档在下面删掉）
    s.relight.intro = { day: s.day || 1, told: false };
  } else {
    const d = rlDefaults(),
      x = s.relight;
    s.relight = {
      ...d,
      ...x,
      lists: Object.fromEntries(Object.entries(x.lists || {}).map(([k, v]) => [k, { ...v }])),
      done: [...(x.done || [])],
      walls: Object.fromEntries(Object.entries(x.walls || {}).map(([k, v]) => [k, { ...v }])),
      old: [...(x.old || [])],
      groups: [...(x.groups || [])],
      pages: [...(x.pages || [])],
      dug: [...(x.dug || [])],
      tunnel: { ...d.tunnel, ...x.tunnel, key: x.tunnel?.key ? { ...x.tunnel.key } : null, lifts: [...(x.tunnel?.lifts || [])], store: { ...x.tunnel?.store } },
      reviews: (x.reviews || []).map((r) => ({ ...r, s: [...(r.s || [])], v: [...(r.v || [])] })),
      cores: [...(x.cores || [])],
      coreDay: { ...x.coreDay },
      co: { ...d.co, ...x.co, bought: { ...x.co?.bought }, pending: { ...x.co?.pending }, leave: x.co?.leave ? { ...x.co.leave } : null },
      mark: { ...d.mark, ...x.mark },
      stats: { ...d.stats, ...x.stats },
    };
    if (x.intro) s.relight.intro = { ...x.intro };
  }
  return s;
}
const fresh = (s) => {
  delete s.relight;
  migrateState(s);
  delete s.relight.intro;
  return s;
};
export function freshState() {
  return fresh(kinFresh());
}
export function newGameState(origin = "farmer") {
  return fresh(kinNewGame(origin));
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  return fresh(kinNewGamePlus(old, origin, keep, book));
}

export class Engine extends KinEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this._tunnel = null;
    this.syncRelightBuild();
    if (this.s.region === "tunnel") this.assignRegion();
  }
  get rl() {
    return this.s.relight;
  }
  rlRoll(...key) {
    return rngOf(hashOf(this.ut?.seed ?? 1, "rl", ...key))();
  }
  rlStat(k, n = 1) {
    if (this.rl) this.rl.stats[k] = (this.rl.stats[k] || 0) + n;
  }
  rlLog(text, tone = "normal") {
    if (this.o) this.olog(text, tone);
  }
  rlTell(text, tone = "gold") {
    this.toast(text, tone);
    this.rlLog(text, tone);
  }
  // 从背包拿，不够再从仓库拿（在农场时）
  rlTake(id, n) {
    let left = n;
    const bag = Math.min(this.s.inventory[id] || 0, left);
    if (bag) {
      this.s.inventory[id] -= bag;
      if (!this.s.inventory[id]) delete this.s.inventory[id];
      left -= bag;
    }
    if (left && this.s.region === "farm") {
      const st = Math.min(this.s.storage[id] || 0, left);
      if (st) {
        this.s.storage[id] -= st;
        if (!this.s.storage[id]) delete this.s.storage[id];
        left -= st;
      }
    }
    return n - left;
  }
  rlHave(id) {
    return (this.s.inventory[id] || 0) + (this.s.region === "farm" ? this.s.storage[id] || 0 : 0);
  }
  rlGive(reward) {
    if (!reward) return "";
    const bits = [];
    if (reward.gold) {
      this.s.money += reward.gold;
      bits.push(reward.gold + " 金币");
    }
    const items = Object.fromEntries(Object.entries(reward).filter(([k]) => k !== "gold" && ITEMS[k]));
    if (Object.keys(items).length) {
      this.receive(items);
      bits.push(itemsText(items));
    }
    return bits.join("、");
  }

  // ================= 重建站和清单 =================
  rlStationB() {
    return this.s.buildings.find((b) => b.type === STATION.type && b.hp > 0) || null;
  }
  rlStationHere() {
    const b = this.rlStationB();
    return !!b && this.s.region === "farm" && dist(this.s.player, b) <= 150;
  }
  wallOn(id) {
    return !!this.rl?.walls[id];
  }
  wallsOn() {
    return WALL_IDS.filter((w) => this.wallOn(w));
  }
  listDone(id) {
    return !!this.rl?.done.includes(id);
  }
  // 这一格收哪些东西：@组 是组里任意一样；作物收普通、耐旱、优质、上品（先交便宜的）
  listAccepts(key) {
    if (key.startsWith("@")) {
      const g = GROUPS[key.slice(1)];
      const ids = new Set([...Object.keys(this.s.inventory), ...(this.s.region === "farm" ? Object.keys(this.s.storage) : [])]);
      return [...ids].filter((id) => g?.match(id) && ITEMS[id]).sort();
    }
    if (CROPS[key]) return [key, "hardy_" + key, "fine_" + key, "prime_" + key].filter((id) => ITEMS[id]);
    return [key];
  }
  listGot(id, key) {
    return this.rl.lists[id]?.[key] || 0;
  }
  listHave(key) {
    return this.listAccepts(key).reduce((a, id) => a + this.rlHave(id), 0);
  }
  listProgress(id) {
    const L = LISTS[id];
    let have = 0,
      need = 0;
    for (const [key, n] of L.need) {
      need += n;
      have += Math.min(n, this.listGot(id, key));
    }
    return { have, need };
  }
  rlDeliverReason(id, key) {
    const L = LISTS[id];
    if (!L || !L.need.some(([k]) => k === key)) return "没有这一格";
    if (!this.rlStationB()) return "先在农场建一座重建站";
    if (!this.rlStationHere()) return "到重建站跟前交";
    if (this.listDone(id)) return "这份清单交满了";
    const n = L.need.find(([k]) => k === key)[1];
    if (this.listGot(id, key) >= n) return "这一格交满了";
    if (this.listHave(key) < 1) return "手上和仓库里都没有";
    return "";
  }
  rlDeliver(id, key) {
    const reason = this.rlDeliverReason(id, key);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const L = LISTS[id],
      n = L.need.find(([k]) => k === key)[1];
    let want = n - this.listGot(id, key),
      gave = 0;
    for (const item of this.listAccepts(key)) {
      if (want <= 0) break;
      const t = this.rlTake(item, want);
      want -= t;
      gave += t;
    }
    if (!gave) return false;
    const rec = (this.rl.lists[id] ||= {});
    rec[key] = (rec[key] || 0) + gave;
    this.rlStat("delivered", gave);
    const name = key.startsWith("@") ? GROUPS[key.slice(1)].name : ITEMS[key]?.name || key;
    const p = this.listProgress(id);
    if (p.have >= p.need) this.finishList(id);
    else this.toast("交了" + name + " ×" + gave + "（「" + L.name + "」" + p.have + "/" + p.need + "）。", "gold");
    return true;
  }
  finishList(id) {
    const L = LISTS[id];
    if (this.listDone(id)) return;
    this.rl.done.push(id);
    this.rlStat("lists");
    const got = this.rlGive(L.reward);
    this.rlTell("「" + L.name + "」交满了" + (got ? "：" + got : "") + "。");
    this.emit("victory");
    const wall = L.wall;
    if (!this.wallOn(wall) && WALL_LISTS[wall].every((x) => this.listDone(x))) this.finishWall(wall, "list");
    if (this.rl.done.length >= LIST_IDS.length) this.grantCore("lists");
  }
  finishWall(id, by) {
    if (this.wallOn(id)) return;
    this.rl.walls[id] = { by, day: this.s.day };
    this.rlStat("walls");
    const W = WALLS[id];
    const text = (by === "co" ? WALL_BOUGHT.replace("{wall}", W.name) : WALL_LINES[id]) + "「" + W.name + "」：" + W.text;
    this.toast("「" + W.name + "」通了：" + W.short + "。", "gold");
    this.rlLog(text, "gold");
    this.storyLog?.("重建站：「" + W.name + "」通了。");
    if (this.s.region === "farm") this.assignRegion();
  }

  // ---------- 通水：水网每天多 10 份 ----------
  netSources() {
    const out = super.netSources();
    if (this.wallOn("water")) out.push({ kind: "rlPipe", name: "旧水厂支管（通水）", made: WALL_FX.water, store: 0 });
    return out;
  }
  // ---------- 开诊：伤员少躺一天 ----------
  injure(key, name, why = "") {
    if (!this.wallOn("clinic")) return super.injure(key, name, why);
    this._rlInjure = true;
    let ok;
    try {
      ok = super.injure(key, name, why);
    } finally {
      this._rlInjure = false;
    }
    const h = ok ? this.hn?.hurt[key] : null;
    if (h) h.until = Math.max(h.at + 60, h.until - WALL_FX.injury);
    return ok;
  }
  rlInjureText(text) {
    if (typeof text !== "string") return text;
    if (this._rlInjure) return text.replace("之后 2 天干不了活", "之后 1 天干不了活（门诊少躺一天）").replace("：2 天干不了活", "：1 天干不了活（门诊少躺一天）");
    if (this._rlSchool) return text.replace(/：3 天后(出师|改行)/, (m, w) => "：" + (this.studyRoom?.() ? 1 : 2) + " 天后" + w + "（营地的小课堂快一倍）");
    return text;
  }
  startApprentice(master, pupil) {
    this._rlSchool = this.wallOn("school");
    try {
      return super.startApprentice(master, pupil);
    } finally {
      this._rlSchool = false;
    }
  }
  startRetrain(pupil, role) {
    this._rlSchool = this.wallOn("school");
    try {
      return super.startRetrain(pupil, role);
    } finally {
      this._rlSchool = false;
    }
  }
  toast(text, tone) {
    // 下隧道：到了第几层由 tunnelArrive 说，不再多一条“到达 地铁隧道”
    if (this._rlEntering && String(text).startsWith("到达 ")) return;
    return super.toast(this.rlInjureText(text), tone);
  }
  olog(text, tone) {
    let t = this.rlInjureText(text);
    if (t === ENDING.broadcast && this.rl?.co.state === "signed") t = COMPANY_ENDING.broadcast;
    return super.olog(t, tone);
  }
  // ---------- 通话：求援多来一个人 ----------
  allyNames() {
    const list = super.allyNames();
    return this.wallOn("radio") ? [...list, WALL_FX.ally.name] : list;
  }
  allyLooks() {
    const list = super.allyLooks();
    return this.wallOn("radio") ? [...list, WALL_FX.ally.look] : list;
  }
  // ---------- 通车：进出农场路上省一半 ----------
  travelBonus(n, to) {
    n = super.travelBonus(n, to);
    const from = this._travelFrom;
    if (this.wallOn("rail") && (from === "farm" || to === "farm") && from !== "tunnel") n = Math.max(1, Math.ceil(n * WALL_FX.rail));
    return n;
  }
  // ---------- 通电：一半的晚上夜行者不走亮着的路 ----------
  powerBlocks(key) {
    return this.wallOn("power") && this.rlRoll("prowl", key) < WALL_FX.prowlCut;
  }
  tickProwl() {
    const u = this.ut;
    if (this.rl && u) {
      const m = this.s.minute,
        night = m >= PROWL.from || m < PROWL.to,
        key = m >= PROWL.from ? this.s.day : this.s.day - 1;
      if (night && u.prowl !== key && this.powerBlocks(key)) {
        u.prowl = key;
        u.prowlOn = false;
      }
    }
    return super.tickProwl();
  }
  scoutText() {
    const t = super.scoutText();
    if (!this.powerBlocks(this.s.day)) return t;
    return t.replace(/夜行者今晚会摸到农场东边(（[^）]*）)?/, "夜行者今晚想摸过来，路灯亮着，它们会绕开");
  }
  // ---------- 开课：带徒、改学快一倍 ----------
  workHour() {
    const h = Math.floor(this.s.minute / 60);
    if (this.rl && h === 6 && this.wallOn("school")) {
      const step = this.studyRoom?.() ? 2 : 1;
      if (this.ss?.apprentice) this.ss.apprentice.start -= step;
      if (this.td?.retrain) this.td.retrain.start -= step;
    }
    super.workHour();
    if (!this.rl) return;
    for (const x of [this.ss?.apprentice, this.td?.retrain]) if (x && x.start < 0) x.start = 0;
    const day = this.s.day;
    if (h === 6) {
      this.coMorning(day);
      if (Object.values(this.ss?.trust || {}).some((v) => v >= 10)) this.grantCore("trust");
    }
    if (h === 9) this.coAsk(day);
    if (h === REVIEW.hour && day % 28 === 0 && !this.rl.reviews.some((r) => r.day === day)) this.yearReview();
    if (h === 7) this.checkFinale();
  }

  // ================= 信号烟花 =================
  rlFireReason() {
    if (this.rl.fire) return "信号烟花放过了";
    if (this.rl.done.length < LIST_IDS.length) return "六面墙的 28 份清单都交满以后才能放";
    if (this.rl.co.state === "signed") return "签着鼎丰的合同，邻居不会来";
    if (!this.rlStationHere()) return "到重建站跟前放";
    const m = this.s.minute;
    if (m < 18 * 60 || m >= 23 * 60) return "傍晚 18:00 到 23:00 放，夜里看得见";
    if (this.noiseBlocked?.()) return "今晚有长夜、尸潮或袭击，换一个晚上";
    return "";
  }
  rlFireworks() {
    const reason = this.rlFireReason();
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    this.rl.fire = this.s.day;
    this.rlStat("fireworks");
    this.noiseAdd?.(FIREWORKS.noise, "fireworks");
    if (this.hn && !this.hn.help.live) Object.assign(this.hn.help, { armed: true, day: this.s.day, live: false, allies: [] });
    for (const line of FIREWORKS_TEXT) this.rlLog(line, "gold");
    this.toast(FIREWORKS_TEXT[0] + "动静拉满了，今晚邻居都来帮你守。", "gold");
    this.events.push({ type: "fireworks" });
    this.emit("victory");
    return true;
  }
  // 放烟花那晚循声来的感染者也算打仗（求援的邻居会来）
  fightOn() {
    const a = this.hn?.attack;
    return super.fightOn() || (!!this.rl?.fire && a?.state === "live" && a.day === this.rl.fire + 1);
  }

  // ================= 旧世界陈列 =================
  oldDonated(id) {
    return !!this.rl?.old.includes(id);
  }
  oldOwned(id) {
    return this.qty(id, true) > 0;
  }
  // 还没拿到、也没捐过的旧物里，这里翻得到的那些
  oldPool(region, kind, locked = false) {
    return OLD_IDS.filter((id) => {
      if (this.oldDonated(id) || this.oldOwned(id)) return false;
      if (region === "*") return true;
      const h = OLD[id].home;
      if (h.region !== region) return false;
      return region === "tunnel" || locked || h.kinds.includes(kind);
    });
  }
  oldPick(pool, r) {
    return pool.length ? pool[Math.floor(r * pool.length) % pool.length] : null;
  }
  donateOldReason(id) {
    if (!OLD[id]) return "没有这件旧物";
    if (this.oldDonated(id)) return "已经捐过了";
    if (!this.museumHere?.()) return "到档案馆（农场的分馆或余晖档案岛）捐";
    if (this.rlHave(id) < 1) return "手上没有";
    return "";
  }
  donateOld(id) {
    const reason = this.donateOldReason(id);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    this.rlTake(id, 1);
    this.rl.old.push(id);
    this.rlStat("donated");
    const O = OLD[id];
    this.toast("捐出「" + O.name + "」：" + OLD_STORY[id], "gold");
    this.rlLog("档案馆收下了「" + O.name + "」：" + OLD_STORY[id], "gold");
    const g = O.group;
    if (!this.rl.groups.includes(g) && OLD_IDS.filter((x) => OLD[x].group === g).every((x) => this.oldDonated(x))) this.finishOldGroup(g);
    if (this.rl.old.length >= OLD_IDS.length) this.grantCore("museum");
    return true;
  }
  finishOldGroup(g) {
    const G = OLD_GROUPS[g],
      R = G.reward;
    this.rl.groups.push(g);
    this.rlStat("groups");
    if (R.mood) this.residentsMood?.(R.mood);
    if (R.rep) this.addReputation?.(R.rep);
    if (R.research) this.grantResearch?.(R.research);
    if (R.gold) this.s.money += R.gold;
    if (R.items) this.receive(R.items);
    this.rlTell("「" + G.name + "」凑齐了：" + G.text + "。" + OLD_GROUP_LINES[g]);
    this.emit("victory");
  }
  // ---------- 锁着的铁盒：陈工撬开 ----------
  // 陈工在营地（没派去地区、边境干活，没受伤躺着）
  chenHere() {
    const r = this.resident?.("mechanic");
    return !!r && !this.d?.workers?.mechanic && !this.b?.workers?.mechanic && !this.isHurt?.("r:mechanic");
  }
  rlBoxReason() {
    if (this.rlHave("rlIronBox") < 1) return "没有锁着的铁盒";
    if (this.s.region !== "farm") return "拿回营地让陈工撬";
    if (!this.resident?.("mechanic")) return "营地里还没有会撬锁的人（陈工）";
    if (!this.chenHere()) return "陈工这会儿不在营地（受伤躺着或派出去干活了）";
    if (this.rlHave("parts") < BOX.cost.parts) return "要 " + BOX.cost.parts + " 个机械零件";
    return "";
  }
  rlOpenBox() {
    const reason = this.rlBoxReason();
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    this.rlTake("rlIronBox", 1);
    this.rlTake("parts", BOX.cost.parts);
    const n = this.rl.stats.boxes || 0;
    const what = pickW(BOX.odds, this.rlRoll("box", this.s.day, n));
    let got = null;
    if (what === "old") {
      const id = this.oldPick(this.oldPool("*"), this.rlRoll("boxold", this.s.day, n));
      if (id) got = { [id]: 1 };
    }
    if (!got && what !== "seeds") got = { circuit: 1 + (this.rlRoll("boxc", n) < 0.3 ? 1 : 0) };
    if (!got) got = this.rlRoll("boxs", n) < 0.5 ? { seedMystery: 2 } : { seed_pumpkin_abundant: 2, seedHerb: 2 };
    this.receive(got);
    this.rlStat("boxes");
    const old = Object.keys(got).find((k) => OLD[k]);
    this.rlTell("陈工拿螺丝刀一别，铁盒开了：" + itemsText(got) + (old ? "（旧物，能捐给档案馆）" : "") + "。");
    this.emit("loot");
    return true;
  }

  // ================= 柜子、感染者、鱼钩上翻到的 =================
  rollContainer(o, day = this.s.day) {
    if (o?.rlDepth) return this.rollTunnelBox(o, day);
    const res = super.rollContainer(o, day);
    if (!this.rl || !res) return res;
    const region = this.s.region,
      locked = o.ukind === "locked" || o.odds === "locked",
      r = rngOf(hashOf(this.ut.seed, "rlbox", o.id, day));
    const pool = this.oldPool(region, res.kind, locked);
    if (pool.length && r() < (locked ? OLD_RULES.locked : OLD_RULES.chance)) res.bundle = { ...res.bundle, [this.oldPick(pool, r())]: 1 };
    if (r() < (locked ? BOX.locked : BOX.chance)) res.bundle = { ...res.bundle, rlIronBox: (res.bundle.rlIronBox || 0) + 1 };
    // 重建清单要的稀罕物（比如线材要的一节电池）：清单还要、手上没有时，它那片废墟、那种柜子里照稀罕物的几率翻得到
    const want = KEEP_IDS.filter((id) => {
      const k = KEEPSAKES[id];
      if (k.home.region !== region || (!locked && !k.home.kinds.includes(res.kind)) || res.bundle[id] || this.rlHave(id) > 0) return false;
      return LIST_IDS.some((L) => !this.listDone(L) && LISTS[L].need.some(([key, n]) => key === id && this.listGot(L, key) < n));
    });
    if (want.length && r() < (locked ? KEEP_RULES.locked : KEEP_RULES.chance)) res.bundle = { ...res.bundle, [want[0]]: 1 };
    return res;
  }
  // 隧道里的柜子：越深越好；铜线、灯泡、道钉、继电器；旧物、铁盒
  rollTunnelBox(o, day) {
    const f = o.rlDepth,
      r = rngOf(hashOf(this.ut?.seed ?? 1, "rltn", o.id, day)),
      odds = o.rlStore ? TUNNEL.storeOdds : TUNNEL.odds(f),
      kind = o.ukind || "toolbox";
    const first = this.drawFrom(kind, odds, r),
      second = r() < (o.rlStore ? 0.7 : 0.35) ? this.drawFrom(kind, odds, r) : null,
      bundle = { ...first.bundle };
    if (second) for (const [k, n] of Object.entries(second.bundle)) bundle[k] = (bundle[k] || 0) + n;
    for (const k of Object.keys(bundle)) if (k.startsWith("bp_") || k === "flashlight" || ATTACHMENTS.includes(k)) bundle[k] = 1;
    for (const [id, m] of Object.entries(TUNNEL.mats)) {
      if (f < m.from) continue;
      if (r() < m.chance * (o.rlStore ? 1.6 : 1)) bundle[id] = (bundle[id] || 0) + m.n[0] + Math.floor(r() * (m.n[1] - m.n[0] + 1));
    }
    // 手气签大吉多抽一样；旧物摆件照常
    const L = this.luckToday?.();
    if (L && L.extra > 0.3 && r() < L.extra - 0.3) {
      const x = this.drawFrom(kind, odds, r);
      for (const [k, n] of Object.entries(x.bundle)) bundle[k] = (bundle[k] || 0) + n;
    }
    if (r() < DECOR_RULES.chance) {
      const pool = DECOR.filter((d) => d.where.includes(kind));
      const d = (pool.length ? pool : DECOR)[Math.floor(r() * (pool.length || DECOR.length)) % (pool.length || DECOR.length)];
      bundle[decorItem(d.id)] = (bundle[decorItem(d.id)] || 0) + 1;
    }
    const pool = this.oldPool("tunnel");
    if (pool.length && r() < OLD_RULES.tunnel) bundle[this.oldPick(pool, r())] = 1;
    if (r() < BOX.tunnel) bundle.rlIronBox = (bundle.rlIronBox || 0) + 1;
    const tier = Math.max(first.tier, second?.tier ?? 0);
    return { bundle, tier: TIERS[tier], kind };
  }
  openContainer(o) {
    const day = this.s.day;
    if (o?.rlStore) {
      const last = this.s.opened[o.id];
      if (last && last.day !== day && day - last.day < TUNNEL.storeEvery) {
        this.toast(TUNNEL_TEXT.storeEmpty.replace("{d}", last.day + TUNNEL.storeEvery) + "", "warn");
        return;
      }
    }
    const before = this.s.opened[o.id]?.day === day;
    const out = super.openContainer(o);
    const now = this.s.opened[o.id]?.day === day;
    if (this.rl && now && !before) {
      if (o.rlStore) this.rlStat("stores");
      const locked = o.ukind === "locked" || o.odds === "locked";
      this.pageChance(o.rlDepth ? PAGE_RULES.tunnel : locked ? PAGE_RULES.locked : PAGE_RULES.chance, "box", o.id, day);
    }
    return out;
  }
  // 头目第二次起打赢也掉战利品——只在重建清单还要它、手上和仓库里都没有、那一格还没交时（第一次的捐给档案馆也不怕）
  bossDown(kind, z) {
    const B = BOSSES[kind],
      first = !this.ut?.boss?.[kind]?.wins;
    const out = super.bossDown(kind, z);
    if (!this.rl || first || !B?.trophy) return out;
    const list = LIST_IDS.find((id) => LISTS[id].need.some(([k]) => k === B.trophy));
    if (!list || this.listDone(list) || this.listGot(list, B.trophy) > 0 || this.rlHave(B.trophy) > 0) return out;
    this.receive({ [B.trophy]: 1 });
    this.rlTell("又从" + B.name + "身上拿到一件「" + ITEMS[B.trophy].name + "」：重建清单「" + LISTS[list].name + "」用得上。");
    return out;
  }
  afterKill(e) {
    super.afterKill(e);
    if (!this.rl || this.s.region === "farm" || e.horde || e.lnBoss) return;
    const key = e.id ?? Math.floor(this.s.playSeconds * 10);
    this.pageChance(PAGE_RULES.kill, "kill", key, this.s.day);
    const pool = this.oldPool("*");
    if (pool.length && this.rlRoll("killold", key, this.s.day) < OLD_RULES.kill) {
      const id = this.oldPick(pool, this.rlRoll("killoldw", key));
      const got = { [id]: 1 };
      if (!this.add(got, true)) {
        this.s.drops ??= [];
        this.s.drops.push({ region: this.s.region, x: Math.round(e.x), y: Math.round(e.y), items: got });
      }
      this.toast("从倒下的感染者身上摸出一件旧物：「" + OLD[id].name + "」。", "gold");
      this.rlStat("found");
    }
  }
  reelLand() {
    const ok = super.reelLand();
    if (ok && this.rl) this.pageChance(PAGE_RULES.fish, "fish", this.s.day, this.s.minute, this.c?.metrics?.fish || 0);
    return ok;
  }

  // ================= 残页 =================
  pageRead(id) {
    return !!this.rl?.pages.includes(id);
  }
  // 能翻到的下一张：日记、藏货谜题（那张图得去得了）、水的来历（按顺序）
  pageCandidates() {
    const out = [];
    let loreNext = null;
    for (const id of PAGE_IDS) {
      if (this.pageRead(id)) continue;
      const p = PAGES[id];
      if (p.kind === "lore") {
        if (!loreNext) loreNext = id;
        continue;
      }
      if (p.kind === "riddle") {
        const d = DIGS[p.dig];
        if (!this.s.visited?.[d.region] && d.region !== "market") continue;
      }
      out.push(id);
    }
    if (loreNext) out.push(loreNext);
    return out;
  }
  pageChance(chance, ...key) {
    if (!this.rl || this.rlRoll("page", ...key) >= chance) return null;
    const list = this.pageCandidates();
    if (!list.length) return null;
    const id = list[Math.floor(this.rlRoll("pagew", ...key) * list.length) % list.length];
    return this.readPage(id);
  }
  pageTitle(id) {
    const p = PAGES[id];
    if (p.kind === "diary") return DIARY[p.who].title;
    if (p.kind === "riddle") return RIDDLE[p.dig].title;
    return LORE[p.n - 1].title;
  }
  pageLines(id) {
    const p = PAGES[id];
    if (p.kind === "diary") {
      const fav = prefsOf(p.who).fav;
      return DIARY[p.who].lines.map((l) => l.replace("{fav1}", ITEMS[fav[0]]?.name || "").replace("{fav2}", ITEMS[fav[1]]?.name || ""));
    }
    if (p.kind === "riddle") return RIDDLE[p.dig].lines;
    return LORE[p.n - 1].lines;
  }
  readPage(id) {
    if (this.pageRead(id) || !PAGES[id]) return null;
    this.rl.pages.push(id);
    this.rlStat("pages");
    const p = PAGES[id];
    let tail = "";
    if (p.kind === "diary" && this.kin) {
      const fav = prefsOf(p.who).fav;
      const k = (this.kin.know[p.who] ||= {});
      for (const x of fav) if (ITEMS[x]) k[x] = "fav";
      tail = "（" + this.kinName(p.who) + "最爱什么，记在人物关系页上了）";
    }
    if (p.kind === "riddle") tail = "（照着找到地方，按 E 挖）";
    if (p.kind === "lore" && this.rl.pages.filter((x) => PAGES[x].kind === "lore").length >= LORE.length) tail = "（水为什么一直被污染，八张都拼上了）";
    const text = "捡到一张残页「" + this.pageTitle(id) + "」" + tail + "：任务手记里能看。";
    this.toast(text, "gold");
    this.rlLog(text + this.pageLines(id).join(""), "gold");
    if (p.kind === "riddle" && this.s.region === DIGS[p.dig].region) this.assignRegion();
    return id;
  }
  rlDigOpen(id) {
    const page = PAGE_IDS.find((x) => PAGES[x].dig === id);
    return !!page && this.pageRead(page) && !this.rl.dug.includes(id);
  }
  rlDig(id) {
    const d = DIGS[id];
    if (!d || !this.rlDigOpen(id) || this.s.region !== d.region || dist(this.s.player, d) > 90) return false;
    this.rl.dug.push(id);
    this.rlStat("digs");
    const got = { ...d.reward.items };
    if (d.old) {
      const oid = this.oldPick(this.oldPool("*"), this.rlRoll("dig", id));
      if (oid) got[oid] = 1;
    }
    this.s.money += d.reward.gold || 0;
    this.receive(got);
    this.s.player.stamina = Math.max(0, this.s.player.stamina - 4);
    this.actionAnim = 0.3;
    this.particlesAt?.(d.x, d.y, "#b9ae72", 14);
    this.emit("hoe");
    this.rlTell("挖出一个油布包：" + (d.reward.gold ? d.reward.gold + " 金币、" : "") + itemsText(got) + "。");
    this.assignRegion();
    return true;
  }

  // ================= 地铁隧道 =================
  shaftOpen() {
    return !!this.b?.unlocked?.shelter && !!this.bflag?.("shelter_lift", "repair");
  }
  shaftHere() {
    return this.s.region === SHAFT.region && dist(this.s.player, SHAFT) <= 130;
  }
  inTunnel() {
    return this.s.region === "tunnel" && !!this.rl?.tunnel.key;
  }
  tunnelFloor() {
    return this.inTunnel() ? this.rl.tunnel.key.floor : 0;
  }
  tunnelLuck() {
    return this.luckToday?.()?.id === "great";
  }
  // 这一层的样子（进这层时定下来的：读档、过了 0 点都不变）
  tunnelLayoutNow() {
    const k = this.rl?.tunnel.key;
    if (!k) return null;
    const seed = this.ut?.seed ?? 1,
      id = tunnelArtKey(seed, k.floor, k.day, k.luck);
    if (this._tunnel?.id !== id) this._tunnel = { id, L: tunnelLayout(seed, k.floor, k.day, k.luck) };
    return this._tunnel.L;
  }
  tunnelArtKey() {
    const L = this.inTunnel() ? this.tunnelLayoutNow() : null;
    return L ? L.key : null;
  }
  tunnelFloors() {
    return [1, ...this.rl.tunnel.lifts.filter((f) => LIFT_FLOORS.includes(f)).sort((a, b) => a - b)];
  }
  tunnelReason(floor = 1) {
    if (!this.rl) return "还不能下去";
    if (!this.b?.unlocked?.shelter) return "先开放地底避难城";
    if (!this.bflag?.("shelter_lift", "repair")) return "先修好医院升降井";
    // 检修平台要联盟的检修队来接通：主线打完以后才来
    if (this.storyDone && !this.storyDone()) return "主线打完以后，联盟的检修队才来接通检修平台";
    if (!this.shaftHere()) return "到医院升降井旁边的检修平台";
    if (floor !== 1 && !this.rl.tunnel.lifts.includes(floor)) return "第 " + floor + " 层的检修电梯还没修好";
    if (["warning", "active"].includes(this.s.horde.phase)) return "尸潮要来了，先回农场";
    if (["warning", "active"].includes(this.raidState?.().phase)) return "灰隼团要来了，先回农场";
    if (this.ln?.night) return "长夜里下不去";
    if (this.f?.route) return "远征路上不能下隧道";
    return "";
  }
  tunnelEnter(floor = 1) {
    const reason = this.tunnelReason(floor);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const t = this.rl.tunnel;
    t.key = { floor, day: this.s.day, luck: this.tunnelLuck() };
    t.floor = floor;
    this.s.enemies.tunnel = null;
    this._tunnel = null;
    this._rlEntering = true;
    this._rlMinutes = TUNNEL.ride;
    let ok = false;
    try {
      ok = super.travel("tunnel");
    } finally {
      this._rlEntering = false;
      this._rlMinutes = null;
    }
    if (!ok) {
      t.key = null;
      t.floor = 0;
      return false;
    }
    this.rlStat("trips");
    t.deepest = Math.max(t.deepest, floor);
    this.tunnelArrive();
    return true;
  }
  tunnelArrive() {
    const L = this.tunnelLayoutNow(),
      f = L.floor;
    Object.assign(this.s.player, { x: T_SPAWN.x, y: T_SPAWN.y });
    this.bullets = [];
    this.noise = [];
    const theme = TUNNEL_TEXT.themes[L.theme] || "";
    let text = TUNNEL_TEXT.enter.replace("{f}", f).replace("{theme}", theme);
    if (L.store && !L.pump) text += "。" + TUNNEL_TEXT.store;
    if (L.pump) text += "。" + TUNNEL_TEXT.pump;
    if (L.luck && L.ladders.length > 1) text += "。" + TUNNEL_TEXT.luck;
    if (!this.qty("flashlight") && !this.armorTotals?.().light && f >= 3) text += "。" + TUNNEL_TEXT.dark;
    this.toast(text, L.store || L.pump ? "gold" : "normal");
    this._rlCleared = null;
  }
  tunnelDown() {
    const t = this.rl.tunnel,
      f = t.key?.floor || 0;
    if (!this.inTunnel() || f >= LAST_FLOOR) return false;
    const L = this.tunnelLayoutNow();
    if (!L.ladders.some((q) => dist(this.s.player, q) <= 90)) return false;
    if (this.s.player.stamina < TUNNEL.downSta) {
      this.toast("太累了，爬不动梯子（体力不够）。", "warn");
      return false;
    }
    this.s.player.stamina = Math.max(0, this.s.player.stamina - TUNNEL.downSta);
    this.advanceMinutes(TUNNEL.down);
    if (this.s.region !== "tunnel") return false;
    t.key = { floor: f + 1, day: this.s.day, luck: this.tunnelLuck() };
    t.floor = f + 1;
    t.deepest = Math.max(t.deepest, f + 1);
    this.rlStat("tunnelDowns");
    this.s.enemies.tunnel = null;
    this._tunnel = null;
    this.reload = null;
    this.assignRegion();
    this.tunnelArrive();
    this.emit("travel");
    return true;
  }
  tunnelLeave(to = "shelter") {
    if (this.s.region !== "tunnel") return false;
    this._rlLeaving = true;
    try {
      return this.travel(to);
    } finally {
      this._rlLeaving = false;
    }
  }
  liftCost(f) {
    return TUNNEL.liftCost[f] || null;
  }
  liftReason() {
    const f = this.tunnelFloor();
    if (!LIFT_FLOORS.includes(f)) return "这一层没有检修电梯";
    if (this.rl.tunnel.lifts.includes(f)) return "已经修好了";
    const cost = this.liftCost(f);
    const lack = Object.entries(cost).filter(([id, n]) => (this.s.inventory[id] || 0) < n);
    if (lack.length) return "还缺：" + lack.map(([id, n]) => (ITEMS[id]?.name || id) + " " + (n - (this.s.inventory[id] || 0))).join("、") + "（要带在身上）";
    return "";
  }
  repairLift() {
    const reason = this.liftReason();
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const f = this.tunnelFloor();
    for (const [id, n] of Object.entries(this.liftCost(f))) this.rlTake(id, n);
    this.rl.tunnel.lifts.push(f);
    this.rlStat("lifts");
    this.advanceMinutes(20);
    this.rlTell(TUNNEL_TEXT.liftFixed.replace("{f}", f));
    this.emit("craft");
    return true;
  }
  takeCore() {
    if (!this.inTunnel() || this.tunnelFloor() !== LAST_FLOOR || this.rl.tunnel.core) return false;
    this.rl.tunnel.core = true;
    this.grantCore("tunnel");
    this.assignRegion();
    return true;
  }
  generateEnemies(id) {
    if (id !== "tunnel") return super.generateEnemies(id);
    const L = this.tunnelLayoutNow();
    if (!L) return [];
    const mult = TUNNEL.hp(L.floor);
    return L.foes.map((q) => {
      const z = q.type === "faker" && this.makeFaker ? this.makeFaker(q.x, q.y) : this.enemy(q.type, q.x, q.y);
      z.hp = z.maxHp = Math.round(z.maxHp * mult);
      z.rlTunnel = L.floor;
      return z;
    });
  }
  nightWanderers(id, entering = true) {
    if (id === "tunnel" || this.s.region === "tunnel") return;
    return super.nightWanderers(id, entering);
  }
  // 隧道里一直是黑的：感染者照夜里的规矩看、听
  isNight() {
    return this._rlDark || super.isNight();
  }
  enemySenses(e, dt) {
    if (this.s.region !== "tunnel") return super.enemySenses(e, dt);
    this._rlDark = true;
    try {
      return super.enemySenses(e, dt);
    } finally {
      this._rlDark = false;
    }
  }
  // 隧道里墙角多：看得见、走得过按身子的宽度算（三条线都不挡才算通），感染者会绕过墙角，不会贴着墙角卡住
  lineClear(a, b) {
    if (this.s.region !== "tunnel") return super.lineClear(a, b);
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1,
      nx = (-(b.y - a.y) / d) * 12,
      ny = ((b.x - a.x) / d) * 12;
    return super.lineClear(a, b) && super.lineClear({ x: a.x + nx, y: a.y + ny }, { x: b.x + nx, y: b.y + ny }) && super.lineClear({ x: a.x - nx, y: a.y - ny }, { x: b.x - nx, y: b.y - ny });
  }
  // 越往下挨一下越疼
  damagePlayer(n, opts) {
    if (this.s.region === "tunnel" && n > 0) n *= TUNNEL.hit(Math.max(1, this.tunnelFloor()));
    return super.damagePlayer(n, opts);
  }
  // 隧道里倒下：遗落的背包被拖回了升降井口
  die() {
    const inTunnel = this.s.region === "tunnel";
    if (inTunnel) {
      this.rl.tunnel.key = null;
      this.rl.tunnel.floor = 0;
      this.s.enemies.tunnel = null;
    }
    const out = super.die();
    if (inTunnel && this.s.grave?.region === "tunnel") Object.assign(this.s.grave, { region: SHAFT.region, x: SHAFT.x + 40, y: SHAFT.y - 30 });
    if (inTunnel) {
      this.rlStat("deaths");
      REGIONS.tunnel.name = "地铁隧道";
    }
    return out;
  }
  advanceMinutes(n) {
    if (this._rlMinutes != null && n > 0) {
      n = this._rlMinutes;
      this._rlMinutes = null;
    }
    return super.advanceMinutes(n);
  }
  travel(id) {
    const from = this.s.region;
    if (id === "tunnel" && !this._rlEntering) {
      this.toast("地铁隧道从地底避难城医院升降井旁边的检修平台下去。", "warn");
      return false;
    }
    if (from === "tunnel" && id !== "tunnel" && !["shelter", "farm"].includes(id) && !this._rlLeaving) {
      this.toast("先顺着检修梯回到升降井（每层左头的铁梯）。", "warn");
      return false;
    }
    let ok;
    if (from === "tunnel" && id !== "tunnel") {
      const f = this.tunnelFloor();
      this._rlMinutes = TUNNEL.up + TUNNEL.upPer * f + (id === "farm" ? 20 : 0);
      try {
        ok = super.travel(id);
      } finally {
        this._rlMinutes = null;
      }
      if (ok) {
        this.rl.tunnel.key = null;
        this.rl.tunnel.floor = 0;
        this.s.enemies.tunnel = null;
        this._tunnel = null;
        REGIONS.tunnel.name = "地铁隧道";
        if (id === "shelter") Object.assign(this.s.player, { x: SHAFT.x + 50, y: SHAFT.y - 40 });
      }
      return ok;
    }
    return super.travel(id);
  }

  // ================= 年终评定 =================
  reviewValues() {
    const m = this.rl.mark,
      foodCount = (bag) => Object.entries(bag || {}).reduce((a, [id, n]) => a + (ITEMS[id]?.type === "food" && !ITEMS[id]?.protected ? n : 0), 0);
    const res = this.c?.residents || [];
    return {
      food: foodCount(this.s.inventory) + foodCount(this.s.storage),
      harvest: Math.max(0, (this.s.stats.harvested || 0) - (m.harvested || 0)),
      morale: res.length ? Math.round(res.reduce((a, r) => a + (r.morale ?? 60), 0) / res.length) : 0,
      nights: Math.max(0, (this.s.stats.hordes || 0) - (m.hordes || 0)) + Math.max(0, (this.ln?.held || 0) - (m.held || 0)),
      lists: this.rl.done.length,
      old: this.rl.old.length,
      trust: Object.values(this.ss?.trust || {}).filter((v) => v >= 6).length,
      cores: this.rl.cores.length,
    };
  }
  reviewScore(v = this.reviewValues()) {
    const s = REVIEW.items.map((it) => it.at.filter((x) => v[it.id] >= x).length);
    const total = s.reduce((a, b) => a + b, 0);
    let lamps = 1;
    REVIEW.lamps.forEach((at, i) => {
      if (total >= at) lamps = i + 1;
    });
    return { s, total, lamps };
  }
  yearReview() {
    const day = this.s.day,
      y = Math.round(day / 28),
      v = this.reviewValues(),
      sc = this.reviewScore(v);
    const rec = { y, day, s: sc.s, v: REVIEW.items.map((it) => Math.min(99999, Math.round(v[it.id]))), lamps: sc.lamps };
    this.rl.reviews = [...this.rl.reviews, rec].slice(-20);
    this.rl.mark = { day, harvested: this.s.stats.harvested || 0, hordes: this.s.stats.hordes || 0, held: this.ln?.held || 0 };
    this.rlStat("reviews");
    if (this.sc) this.sc.unread = true;
    this.rlLog(REVIEW_LETTER.open.replace("{y}", y) + "：" + REVIEW_LETTER.lamps[sc.lamps - 1] + "（八项一共 " + sc.total + " 分，任务手记的联盟来信里能看）", "gold");
    this.toast("联盟终端来了第 " + y + " 年的评定信：纪念石上亮了 " + sc.lamps + " 盏灯。", "gold");
    if (sc.lamps >= 4) {
      if (!this.rl.watch) {
        this.rl.watch = 1;
        this.syncRelightBuild();
        this.rlLog("联盟捎来一只老怀表：摆在营地里，全营士气 +3（建设页里摆出来）。", "gold");
      }
      this.grantCore("review");
    }
    return rec;
  }
  lastReview() {
    return this.rl?.reviews[this.rl.reviews.length - 1] || null;
  }

  // ================= 收复度 =================
  rlCompletion() {
    const k = this.kin,
      fishGot = FISH_IDS.filter((id) => k?.fish[id] || (this.w?.caught || []).includes(id)).length,
      hearts = HEART_IDS.reduce((a, id) => a + Math.min(3, k?.heart[id]?.seg || 0), 0);
    const have = { lists: this.rl.done.length, old: this.rl.old.length, pages: this.rl.pages.length, cores: this.rl.cores.length, fish: fishGot, hearts, tunnel: this.rl.tunnel.deepest, nights: this.ln?.held || 0 };
    const parts = COMPLETION.map((c) => ({ ...c, have: Math.min(c.max, have[c.id] || 0) }));
    const got = parts.reduce((a, p) => a + p.have, 0),
      max = parts.reduce((a, p) => a + p.max, 0);
    return { parts, pct: Math.floor((got / max) * 1000) / 10 };
  }
  checkFinale() {
    if (!this.rl || this.rl.finale) return false;
    if (this.rlCompletion().pct < 100) return false;
    this.rl.finale = this.s.day;
    const F = this.rl.co.state === "signed" ? FINALE.company : FINALE;
    for (const l of F.lines) this.rlLog(l, "gold");
    this.emit("menu", { menu: "outpost", view: "rlFinale" });
    return true;
  }

  // ================= 鼎丰物资 =================
  coSigned() {
    return this.rl?.co.state === "signed";
  }
  coReason() {
    if (!this.rlStationB()) return "先建重建站";
    if (this.rl.co.state === "signed") return "已经签了";
    if (this.rl.co.state === "torn") return "撕了合同，鼎丰的人不会再来了";
    if (!this.rlStationHere()) return "到重建站跟前签";
    if (this.s.money < COMPANY.sign) return "要 " + COMPANY.sign + " 金币";
    return "";
  }
  coSign() {
    const reason = this.coReason();
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const c = this.rl.co;
    this.s.money -= COMPANY.sign;
    Object.assign(c, { state: "signed", day: this.s.day, paid: c.paid + COMPANY.sign, asked: this.s.day - COMPANY.leaveEvery + 1 });
    const h = this.hn?.help;
    if (h?.armed && !h.live) Object.assign(h, { armed: false, allies: [] });
    this.rlTell(CO_TEXT.sign, "warn");
    return true;
  }
  coBuyReason(w) {
    if (!WALLS[w]) return "没有这面墙";
    if (!this.coSigned()) return "先和鼎丰签约";
    if (this.wallOn(w)) return "这面墙已经通了";
    if (this.rl.co.pending[w]) return "车队明早就来";
    if (!this.rlStationHere()) return "到重建站跟前付";
    if (this.s.money < COMPANY.price[w]) return "要 " + COMPANY.price[w] + " 金币";
    return "";
  }
  coBuy(w) {
    const reason = this.coBuyReason(w);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const price = COMPANY.price[w],
      c = this.rl.co;
    this.s.money -= price;
    c.paid += price;
    c.pending[w] = this.s.day;
    this.rlStat("coBought");
    this.rlTell(CO_TEXT.buy.replace("{price}", price).replace("{wall}", WALLS[w].name), "normal");
    return true;
  }
  coTear() {
    if (!this.coSigned()) return false;
    const c = this.rl.co;
    c.state = "torn";
    c.leave = null;
    this.rlTell(CO_TEXT.torn, "gold");
    return true;
  }
  // 早上：车队修好昨天付了钱的墙；该走的人走了；昨天抽走的收成
  coMorning(day) {
    const c = this.rl.co;
    for (const [w, d] of Object.entries(c.pending)) {
      if (d >= day) continue;
      delete c.pending[w];
      c.bought[w] = day;
      this.finishWall(w, "co");
    }
    if (c.leave && day >= c.leave.day + COMPANY.leaveDays) {
      const name = this.kinName?.(c.leave.id) || c.leave.name;
      const ok = this.o?.crew.some((x) => x.id === c.leave.id) ? this.dismissCrew(c.leave.id) : false;
      if (ok) this.rlLog(CO_TEXT.left.replace("{name}", name), "warn");
      c.leave = null;
      c.asked = day;
    }
    if (c.cutDay && c.cutDay < day && c.cutToday) {
      this.rlLog("昨天鼎丰按规矩抽走了 " + c.cutToday + " 份收成。");
      c.cutToday = 0;
    }
  }
  // 签着合同：每 14 天有人提出要走（照旧提前两天说，走到他跟前按 E 能劝住）
  coAsk(day) {
    const c = this.rl.co;
    if (c.state !== "signed" || c.leave || day - c.asked < COMPANY.leaveEvery) return;
    const partner = this.kin?.partner?.id;
    const list = (this.o?.crew || []).filter((x) => x.id !== "youke" && x.id !== partner);
    c.asked = day;
    if (!list.length) return;
    const who = list[Math.floor(this.rlRoll("coleave", day) * list.length) % list.length];
    c.leave = { id: who.id, name: String(who.name).slice(0, 12), day };
    this.rlTell(CO_TEXT.leave.replace("{name}", who.name), "warn");
  }
  coPersuade(id) {
    const c = this.rl.co;
    if (!c.leave || c.leave.id !== id) return false;
    const name = c.leave.name;
    c.leave = null;
    c.asked = this.s.day;
    this.rlTell(CO_TEXT.stay.replace("{name}", name));
    return true;
  }
  decree(id) {
    if (id === "curfew" && this.coSigned()) return true;
    return super.decree(id);
  }
  cmdReason(id) {
    if (id === "help" && this.coSigned()) return CO_TEXT.noHelp;
    return super.cmdReason(id);
  }
  raidPower() {
    return super.raidPower() - (this.coSigned() && this.fr?.peng?.phase === "allied" ? 2 : 0);
  }
  // 收成抽一成（攒够一份抽一份）
  harvest(p, worker = false) {
    if (!this.coSigned() || !p?.crop) return super.harvest(p, worker);
    const crop = p.crop,
      ids = [crop, "hardy_" + crop, "fine_" + crop, "prime_" + crop, "giant_" + crop].filter((id) => ITEMS[id]),
      before = Object.fromEntries(ids.map((id) => [id, (this.s.inventory[id] || 0) + (this.s.storage[id] || 0)]));
    const out = super.harvest(p, worker);
    if (!out) return out;
    const c = this.rl.co;
    for (const id of ids) {
      const gain = (this.s.inventory[id] || 0) + (this.s.storage[id] || 0) - before[id];
      if (gain <= 0) continue;
      c.acc = Math.round((c.acc + gain * COMPANY.cut) * 100) / 100;
      while (c.acc >= 1) {
        const took = (this.s.storage[id] || 0) > 0 ? ((this.s.storage[id] -= 1), this.s.storage[id] || delete this.s.storage[id], 1) : (this.s.inventory[id] || 0) > 0 ? ((this.s.inventory[id] -= 1), this.s.inventory[id] || delete this.s.inventory[id], 1) : 0;
        if (!took) break;
        c.acc -= 1;
        c.cut += 1;
        if (c.cutDay !== this.s.day) {
          c.cutDay = this.s.day;
          c.cutToday = 0;
        }
        c.cutToday += 1;
        this.rlStat("coCut");
      }
    }
    return out;
  }
  update(dt, input = {}) {
    const p = this.fr?.peng;
    // 签着合同：彭姐的人不来帮着打尸潮
    if (this.coSigned() && p?.phase === "allied" && this.s.horde.phase === "active") p.hordeKey = this.s.day * 100 + (this.s.stats.hordes % 100);
    const intro = !this.paused && this.rl?.intro;
    if (intro && !intro.told) {
      intro.told = true;
      this.toast(INTRO, "gold");
      this.rlLog(INTRO, "gold");
      // 第一帧的提示再放一张不挡操作的小卡片：同一帧里别的提示（比如长夜的预告）不会把它挤掉
      this.events.push({ type: "ledger", day: this.s.day, title: "重光", lines: INTRO_LINES, ms: 9000, any: true, tone: "gold" });
      // 旧档里已经做到的：守住过长夜、和人信任到 10
      if ((this.ln?.held || 0) >= 1) this.grantCore("longnight");
      if (Object.values(this.ss?.trust || {}).some((v) => v >= 10)) this.grantCore("trust");
    }
    const out = super.update(dt, input);
    if (!this.paused && this.rl && this.s.region === "tunnel" && this.inTunnel()) {
      const key = this.rl.tunnel.key;
      const live = this.enemies.some((z) => !z.dead);
      const id = key.floor + ":" + key.day;
      if (!live && this.enemies.length && this._rlCleared !== id) {
        this._rlCleared = id;
        if (this.tunnelLayoutNow().ladders.length) this.toast(TUNNEL_TEXT.cleared, "gold");
      }
    }
    return out;
  }

  // ================= 余烬核 =================
  coreCount() {
    return this.rl?.cores.length || 0;
  }
  maxHp() {
    return super.maxHp() + CORE_BONUS.hp * this.coreCount();
  }
  maxSta() {
    return super.maxSta() + CORE_BONUS.sta * this.coreCount();
  }
  grantCore(id) {
    if (!this.rl || !CORES[id] || this.rl.cores.includes(id)) return false;
    this.rl.cores.push(id);
    this.rl.coreDay[id] = this.s.day;
    this.rlStat("cores");
    const p = this.s.player;
    p.hp = Math.min(this.maxHp(), p.hp + CORE_BONUS.hp);
    p.stamina = Math.min(this.maxSta(), p.stamina + CORE_BONUS.sta);
    const lines = CORE_LINES[id];
    this.rlLog("余烬核（" + CORES[id].name + "）：" + lines.join(""), "gold");
    this.toast("拿到一颗余烬核（" + this.rl.cores.length + "/" + CORE_IDS.length + "）：体力上限 +" + CORE_BONUS.sta + "、生命上限 +" + CORE_BONUS.hp + "；它的光夜里也招感染者，长夜每波多来 " + Math.round(CORE_BONUS.night * 100) + "%。纪念石上多了一道刻痕。", "gold");
    this.events.push({ type: "ledger", day: this.s.day, title: "余烬核 · " + CORES[id].name, lines: [...lines, "体力上限 +" + CORE_BONUS.sta + "、生命上限 +" + CORE_BONUS.hp + "（" + this.rl.cores.length + "/" + CORE_IDS.length + "）"], ms: 7000, any: true, tone: "gold" });
    this.events.push({ type: "rlCore" });
    return true;
  }
  // 余烬核的光招感染者：长夜每波按身上的余烬核多来一些（每颗 4%，正好抵掉体力、生命上限让长夜变容易的那一截；守住几个变大的那一截照旧）
  lnMult(held) {
    const base = super.lnMult(held);
    return this.rl ? base * (1 + CORE_BONUS.night * this.coreCount()) : base;
  }
  // 只按守住了几个算的那一截（战报写“下一个多两成 / 已经是最大”用）
  lnHeldMult(held) {
    return super.lnMult(held);
  }
  lnHold(how) {
    const ok = super.lnHold(how);
    if (ok && this.rl && (this.ln?.held || 0) >= 1) this.grantCore("longnight");
    return ok;
  }
  hostFestival() {
    const kind = this.festivalKind?.(),
      stars = kind === "harvest" ? this.festivalStars(kind).filter(Boolean).length : 0;
    const ok = super.hostFestival();
    if (ok && this.rl && kind === "harvest" && stars >= 3) this.grantCore("harvest");
    return ok;
  }

  // ================= 建设：重建站只建一座；老怀表 =================
  syncRelightBuild() {
    if (BUILDINGS.rlWatch) BUILDINGS.rlWatch.retired = !(this.rl && this.rl.watch === 1 && !this.s.buildings.some((b) => b.type === "rlWatch"));
  }
  startBuild(type) {
    if (type === STATION.type && this.s.buildings.some((b) => b.type === STATION.type)) {
      this.toast(this.rlStationB() ? "重建站已经有一座了。" : "重建站被打坏了：走到跟前修一修（交过的清单都还在）。", "warn");
      return false;
    }
    if (type === "rlWatch" && !(this.rl?.watch === 1)) {
      this.toast("还没有老怀表。", "warn");
      return false;
    }
    return super.startBuild(type);
  }
  placeBuilding(x, y) {
    const type = this.buildMode;
    const ok = super.placeBuilding(x, y);
    if (ok && type === "rlWatch") {
      this.rl.watch = 2;
      this.buildMode = null;
      this.syncRelightBuild();
    }
    if (ok && type === STATION.type) this.buildMode = null;
    return ok;
  }
  dismantle(id) {
    const b = this.s.buildings.find((x) => x.id === id);
    const ok = super.dismantle(id);
    if (ok && b?.type === "rlWatch") {
      this.rl.watch = 1;
      this.syncRelightBuild();
    }
    return ok;
  }
  moodFactors(r) {
    let out = super.moodFactors(r);
    if (!this.rl) return out;
    if (this.coSigned()) {
      // 公司规矩的宵禁不再另算一份心情（算在下面这 −5 里）
      if (!this.w?.decrees.includes("curfew")) out = out.filter((f) => !/curfew|宵禁/.test(f.key + f.text));
      out.push({ key: "company", v: COMPANY.mood, text: "鼎丰的公司规矩" });
    }
    if (this.s.buildings.some((b) => b.type === "rlWatch" && b.hp > 0)) out.push({ key: "watch", v: REVIEW.watchMood, text: "营地里摆着那只老怀表" });
    return out;
  }

  // ================= 场景里的东西 =================
  assignRegion() {
    super.assignRegion();
    if (!this.rl || !Array.isArray(this.objects)) return;
    const reg = this.s.region;
    if (reg === "tunnel") return this.assignTunnel();
    if (reg === SHAFT.region && this.shaftOpen()) this.objects.push({ type: "rlShaft", name: "检修平台 · 往下是地铁隧道", x: SHAFT.x, y: SHAFT.y, icon: null });
    for (const id of DIG_IDS) {
      const d = DIGS[id];
      if (d.region === reg && this.rlDigOpen(id)) this.objects.push({ type: "rlDig", dig: id, name: "松土", x: d.x, y: d.y, icon: null });
    }
  }
  assignTunnel() {
    const L = this.tunnelLayoutNow();
    if (!L) {
      // 记录丢了（不该发生）：回到升降井
      this.region = { ...REGIONS.tunnel, colliders: [] };
      this.objects = [{ type: "rlUp", name: TUNNEL_TEXT.ladderUp, x: T_UP.x, y: T_UP.y, icon: null }];
      return;
    }
    const f = L.floor,
      t = this.rl.tunnel;
    REGIONS.tunnel.name = "地铁隧道 · 第 " + f + " 层";
    this.region = { ...REGIONS.tunnel, colliders: L.rects };
    const objs = [{ type: "rlUp", name: TUNNEL_TEXT.ladderUp, x: T_UP.x, y: T_UP.y, icon: null }];
    for (const q of L.ladders) objs.push({ type: "rlLadder", name: TUNNEL_TEXT.ladderDown.replace("{f}", f + 1), x: q.x, y: q.y, icon: null });
    if (L.lift) objs.push({ type: "rlLift", name: TUNNEL_TEXT.lift, x: L.lift.x, y: L.lift.y, icon: null, floor: f });
    for (const c of L.crates)
      objs.push({ type: "crate", id: (L.store ? "tunnel-store-" : "tunnel-") + f + "-" + c.id, name: L.store ? "物资库的柜子" : CRATE_NAME[c.kind] || "柜子", x: c.x, y: c.y, loot: {}, ukind: c.kind, icon: 40, rlDepth: f, rlStore: L.store });
    if (L.core && !t.core) objs.push({ type: "rlCore", name: TUNNEL_TEXT.core, x: L.core.x, y: L.core.y, icon: null });
    this.objects = objs;
    this.navRevision++;
    this.navCache = null;
  }
  // 同一处多个东西时，检修梯、电梯、余烬核不进挑选（站在梯子边上直接下）
  context(o) {
    if (this.rl) {
      if (o?.type === "rlUp") return TUNNEL_TEXT.ladderUp + "（按 E）";
      if (o?.type === "rlLadder") return o.name + "（按 E）";
      if (o?.type === "rlLift") {
        const f = o.floor;
        if (this.rl.tunnel.lifts.includes(f)) return "检修电梯 · 修好了（从升降井能直达第 " + f + " 层）";
        const r = this.liftReason();
        return "检修电梯 · 按 E 修（" + Object.entries(this.liftCost(f)).map(([id, n]) => (ITEMS[id]?.name || id) + " " + n).join("、") + "）" + (r ? " · " + r : "");
      }
      if (o?.type === "rlCore") return TUNNEL_TEXT.core + " · 按 E 捧起来";
      if (o?.type === "rlShaft") return "检修平台 · 按 E 往下（地铁隧道）";
      if (o?.type === "rlDig") return "这里的土是松的 · 按 E 挖";
      if (o?.type === "building" && o.building?.type === STATION.type && o.building.hp >= BUILDINGS[STATION.type].hp * 0.7) return "重建站 · 按 E 看清单（" + this.rl.done.length + "/" + LIST_IDS.length + "）";
      if (o?.type === "building" && o.building?.type === "rlWatch") return "老怀表 · 还在走（全营士气 +" + REVIEW.watchMood + "）";
      const pid = this.personOf?.(o);
      if (pid && this.rl.co.leave?.id === pid) return this.kinName(pid) + " · 想走了，按 E 劝劝";
    }
    return super.context(o);
  }
  interact() {
    if (this.paused || !this.rl) return super.interact();
    if (this._reel || this.c?.fishing) return super.interact();
    const o = this.nearestObject?.();
    if (o?.type === "rlUp") return void this.tunnelLeave("shelter");
    if (o?.type === "rlLadder") return void this.tunnelDown();
    if (o?.type === "rlLift") {
      if (this.rl.tunnel.lifts.includes(o.floor)) return void this.toast("检修电梯修好了：从升降井的平台能直达这一层。");
      return void this.repairLift();
    }
    if (o?.type === "rlCore") return void this.takeCore();
    if (o?.type === "rlShaft") return void this.emit("menu", { menu: "outpost", view: "rlShaft", id: "" });
    if (o?.type === "rlDig") return void this.rlDig(o.dig);
    if (o?.type === "building" && o.building?.type === STATION.type && o.building.hp >= BUILDINGS[STATION.type].hp * 0.7) return void this.emit("menu", { menu: "outpost", view: "rlStation", id: "" });
    // 被尸潮、灰隼团打坏了：按 E 就地修（照普通设施的维修，交过的清单都还在）
    if (o?.type === "building" && o.building?.type === STATION.type) return void this.repair(o.building.id);
    const pid = this.personOf?.(o);
    if (pid && this.rl.co.leave?.id === pid) return void this.coPersuade(pid);
    return super.interact();
  }
  buildingContext(b) {
    if (b?.type === STATION.type) return b.hp >= BUILDINGS[STATION.type].hp * 0.7 ? "重建站 · 按 E 看清单" : "重建站 · 被打坏了，按 E 修（交过的清单都还在）";
    if (b?.type === "rlWatch") return "老怀表";
    return super.buildingContext(b);
  }
  pickCandidates() {
    const list = super.pickCandidates();
    if (!this.rl || list.length < 2) return list;
    const keep = list.filter((o) => !["rlLadder", "rlUp", "rlDig"].includes(o.type));
    return keep.length >= 2 ? keep : [];
  }

  // ================= 每天 =================
  onNewDay() {
    super.onNewDay();
    if (!this.rl) return;
    if (Object.values(this.ss?.trust || {}).some((v) => v >= 10)) this.grantCore("trust");
  }
  // 醒来的账本：车队修好的墙
  ledger(day0, money0) {
    const L = super.ledger(day0, money0);
    if (!L || !this.rl) return L;
    const fixed = Object.entries(this.rl.co.bought)
      .filter(([, d]) => d === this.s.day)
      .map(([w]) => WALLS[w].name);
    if (fixed.length) L.lines = [...L.lines.slice(0, 2), (L.lines[2] ? L.lines[2] + "；" : "今天：") + "鼎丰的车队修好了「" + fixed.join("」「") + "」"];
    return L;
  }

  // ================= 存档 =================
  static parse(text) {
    const s = KinEngine.parse(text);
    migrateState(s);
    validateRelight(s);
    return s;
  }
}

// 噪声表里多一项：信号烟花
if (!NOISE_SRC.fireworks) NOISE_SRC.fireworks = "信号烟花";
// 求援的邻居多一个时，存档里的名单最多 3 个（bustle 的校验按 ALLY.names.length + 2 放宽了）
void ALLY;
void NOISE;
void STORE_FLOORS;
void WORLD;

function validateRelight(s) {
  const t = s.relight,
    bad = (why) => {
      throw new Error("存档里的重光记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
    };
  if (!t || typeof t !== "object") bad("缺少");
  const int = (v, lo = 0, hi = 1e9) => Number.isInteger(v) && v >= lo && v <= hi,
    obj = (v) => !!v && typeof v === "object" && !Array.isArray(v),
    str = (v, n = 40) => typeof v === "string" && v.length <= n,
    uniq = (a) => new Set(a).size === a.length;
  if (!int(t.schema, 1, 99)) bad("版本");
  if (!obj(t.lists) || Object.keys(t.lists).some((k) => !LISTS[k])) bad("清单");
  for (const [k, v] of Object.entries(t.lists)) {
    if (!obj(v)) bad("清单");
    for (const [key, n] of Object.entries(v)) {
      const need = LISTS[k].need.find(([x]) => x === key);
      if (!need || !int(n, 0, need[1])) bad("清单");
    }
  }
  if (!Array.isArray(t.done) || !uniq(t.done) || t.done.some((x) => !LISTS[x])) bad("清单");
  if (!obj(t.walls) || Object.entries(t.walls).some(([k, v]) => !WALLS[k] || !obj(v) || !["list", "co"].includes(v.by) || !int(v.day))) bad("墙");
  if (!int(t.fire)) bad("烟花");
  if (!Array.isArray(t.old) || !uniq(t.old) || t.old.some((x) => !OLD[x])) bad("旧物");
  if (!Array.isArray(t.groups) || !uniq(t.groups) || t.groups.some((x) => !OLD_GROUPS[x])) bad("旧物");
  if (!Array.isArray(t.pages) || !uniq(t.pages) || t.pages.some((x) => !PAGES[x])) bad("残页");
  if (!Array.isArray(t.dug) || !uniq(t.dug) || t.dug.some((x) => !DIGS[x])) bad("残页");
  const tn = t.tunnel;
  if (!obj(tn) || !int(tn.floor, 0, LAST_FLOOR) || !int(tn.deepest, 0, LAST_FLOOR) || typeof tn.core !== "boolean") bad("隧道");
  if (tn.key !== null && tn.key !== undefined && (!obj(tn.key) || !int(tn.key.floor, 1, LAST_FLOOR) || !int(tn.key.day) || typeof tn.key.luck !== "boolean")) bad("隧道");
  if (!Array.isArray(tn.lifts) || !uniq(tn.lifts) || tn.lifts.some((f) => !LIFT_FLOORS.includes(f))) bad("隧道");
  if (!obj(tn.store) || Object.entries(tn.store).some(([k, v]) => !STORE_FLOORS.includes(Number(k)) || !int(v))) bad("隧道");
  if (s.region === "tunnel" && !tn.key) bad("隧道");
  if (!Array.isArray(t.reviews) || t.reviews.length > 20) bad("评定");
  for (const r of t.reviews) if (!obj(r) || !int(r.y, 0, 9999) || !int(r.day) || !Array.isArray(r.s) || r.s.length !== REVIEW.items.length || r.s.some((x) => !int(x, 0, 3)) || !Array.isArray(r.v) || r.v.length !== REVIEW.items.length || r.v.some((x) => !int(x, 0, 99999)) || !int(r.lamps, 1, 4)) bad("评定");
  if (!int(t.watch, 0, 2)) bad("怀表");
  if (!Array.isArray(t.cores) || !uniq(t.cores) || t.cores.some((x) => !CORES[x])) bad("余烬核");
  if (!obj(t.coreDay) || Object.entries(t.coreDay).some(([k, v]) => !CORES[k] || !int(v))) bad("余烬核");
  const c = t.co;
  if (!obj(c) || !["", "signed", "torn"].includes(c.state) || !int(c.day) || !int(c.paid) || !int(c.asked) || !int(c.cut) || !int(c.cutDay) || !int(c.cutToday) || typeof c.acc !== "number" || !(c.acc >= 0 && c.acc < 10)) bad("鼎丰");
  if (!obj(c.bought) || Object.entries(c.bought).some(([k, v]) => !WALLS[k] || !int(v))) bad("鼎丰");
  if (!obj(c.pending) || Object.entries(c.pending).some(([k, v]) => !WALLS[k] || !int(v))) bad("鼎丰");
  if (c.leave !== null && c.leave !== undefined && (!obj(c.leave) || !str(c.leave.id, 24) || !str(c.leave.name, 12) || !int(c.leave.day))) bad("鼎丰");
  if (!obj(t.mark) || !int(t.mark.day) || !int(t.mark.harvested) || !int(t.mark.hordes) || !int(t.mark.held)) bad("记录");
  if (!int(t.finale)) bad("记录");
  if (t.intro !== undefined && (!obj(t.intro) || !int(t.intro.day) || typeof t.intro.told !== "boolean")) bad("记录");
  if (!obj(t.stats) || Object.values(t.stats).some((v) => !int(v))) bad("记录");
}
