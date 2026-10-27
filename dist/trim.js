// v0.42.0「删繁」：一物一用方案第二版——把一样东西身上挂着的、说不清有什么用的那些去掉或者并到一起。
// 引擎最上面一层（盖在 v0.41 看得清的 clear.js 上面），下面那些层的东西一样不删，只是这一层不再让它们起作用：
// 1. 设施 36 样变 26 样：雨水桶、太阳能板、照看机、药柜拆掉、材料全退；土酒坛原地换成腌缸；地板、椅子、灯、书架、餐桌并成“摆件”。
// 2. 种地只留种、浇、收和一种肥：照看和照料分、肥力、搭配、轮作、盖布、杂草、菜青虫、水网、偷菜、上品、特性去掉；
//    天天浇上水的才有机会出优质；喷灌头每天浇旁边的田，水渠挖通了渠边的田自己有水；三种肥并成一种（这一茬长快一半）。
// 3. 营地一个士气：每个人的心情、来劲、疲劳、舒适和房间、生活水准、伤员和医务室、法令、食堂口碑都去掉。
// 4. 动静、电台节目和指令、机床加急、设施改良（改好的照样算）、手气签、夜里的抉择、鸽子来信、门缝纸条、商队的假货、贺满仓垫付、鼎丰物资去掉；
//    旧站商街的稀罕货跟着唐九的商队来；食堂到日子自己开张，节庆的供品自己挑。
// 5. 天赋按固定顺序自己学；妙手（偷东西）去掉，经验折给探索；原来要偷的宝贝，主人信任到了自己交给你。
// 6. 地区仓库并进农场仓库：地区里出的东西直接进农场仓库，货运和班次停了；远征路线页去掉；残页的藏货点去掉（东西直接进仓库）。
// 7. 人的喜好明着写；麦穗只要摸，饭自己吃，一直跟着你。
// 旧档第一次读进来：先原样留一份（升级前那一格），拆掉的退料、并掉的折算只做一次，消息里一条“这次简化退回了什么”。
// 长夜、十凶、尸潮、灰隼团、最后一夜的数一个不动；这一层不碰随机数（台子的种子和上一版对得上）。
import { Engine as ClearEngine } from "./clear.js";
import { freshState as sFresh, migrateState as sMigrate, newGameState as sNewGame, newGamePlusState as sNewGamePlus, needsUpgrade as sNeedsUpgrade, legacyGear } from "./simple.js";
import { ITEMS, BUILDINGS, CROPS } from "./data.js";
import { UPGRADES, upClassOf, FEST_PICK } from "./bustle-data.js";
import { FERTS } from "./bounty-data.js";
import { GOODS, goodItem, EXPAND_FX, GOOD_FX } from "./hope-data.js";
import { DIGS, PAGES, PAGE_IDS } from "./relight-data.js";
import { prefsOf } from "./kin-data.js";
import { TREASURES, TREASURE_IDS, TALENTS } from "./thief-data.js";
import { LUCK_BY_ID, MUSHROOM } from "./almanac-data.js";
import { NPCS } from "./outpost-data.js";
import { SSPOTS } from "./seasons-data.js";
import {
  TRIM_SCHEMA,
  REFUND_TYPES,
  WINE_JAR,
  PICKLE_JAR,
  DECOR_LOOKS,
  DECOR_TYPES,
  FINE,
  SOIL_FLAT,
  FERT,
  TRAIT_SEED,
  TRAIT_SWAP,
  SPRINKLE,
  CANAL_R,
  AUTO_WATER,
  MORALE,
  MORALE_FACTORS,
  TALENT_ORDER,
  TALENT_SAFE_R,
  GIFT_TREASURE,
  JAR_ANY,
  jarRecipe,
  CONVERT_TITLE,
  CONVERT_INTRO,
  renameListKeys,
  REST,
  CLINIC,
  ECO_ORDER,
  applyTrimData,
} from "./trim-data.js";

export { legacyGear };

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const add = (bag, id, n) => {
  if (!ITEMS[id] || !(n > 0)) return;
  bag[id] = (bag[id] || 0) + n;
};
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " ×" + n)
    .join("、");
const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
// 下面几层说的话里，提到去掉了的东西的那几句换个说法
const TRIM_SAY = [
  [/——生活水准还没到“住得暖”。/, "——吃住还没过得去（每个人吃上晚饭、最近三顿有三样菜、床够、寒潮里屋里暖）。"],
  [/有像样的屋子吗？/, "饭吃得好吗？"],
  [/生活水准不到第三级/, "吃住还不行"],
  [/生活水准没到“住得暖”/, "吃住没过得去"],
  [/暖区只剩灶台和房间/, "暖区只剩灶台、温室和农舍"],
];
const TRIM_QUIET = [/^生活水准：/];
const TRIM_GONE = new Set(["farNight", "farHemc", "thiefDummy", "thiefBox", "thiefStash", "btGarden", "rlDig", "waterGate", "ecoBoard"]);

// ================= 存档：新的一块 s.trim =================
// 新开的档：水渠的闸门一直开着
function openGate(s) {
  if (s?.frontier?.canals) s.frontier.canals.open = true;
  return s;
}
export function trimDefaults() {
  return {
    schema: TRIM_SCHEMA,
    // 全营士气
    morale: MORALE.start,
    // 天天浇上了水没有：漏过一天的田（这一茬不出优质）
    dry: {},
    // 长夜没守住的那天、守夜受伤的那几天
    lost: 0,
    hurt: { day: 0, n: 0 },
    // 旧档转换：哪天、拆了什么、退了什么（消息里那一条）；新开的档是 null
    conv: null,
    // 天赋自己学的记录、宝贝自己交来的记录
    learned: [],
    given: [],
    // 每天替你浇的那几块记到哪天
    autoDay: 0,
  };
}
function mergeDefaults(x) {
  const d = trimDefaults();
  const out = { ...d, ...x };
  out.dry = isObj(x.dry) ? { ...x.dry } : {};
  out.hurt = { ...d.hurt, ...(isObj(x.hurt) ? x.hurt : {}) };
  out.learned = Array.isArray(x.learned) ? [...x.learned] : [];
  out.given = Array.isArray(x.given) ? [...x.given] : [];
  out.conv = isObj(x.conv) ? { ...x.conv, notes: [...(x.conv.notes || [])], items: { ...(x.conv.items || {}) } } : null;
  return out;
}

// 旧档第一次读进来：拆掉的退料、并掉的折算，只做一次（做完 s.trim 就有了，再读不会再退）
export function convertOld(s) {
  const notes = [],
    back = {},
    store = (s.storage ??= {});
  let money = 0;
  const give = (bundle) => {
    for (const [id, n] of Object.entries(bundle || {})) {
      if (!ITEMS[id] || !(n > 0)) continue;
      store[id] = (store[id] || 0) + n;
      back[id] = (back[id] || 0) + n;
    }
  };
  // ---------- 设施 ----------
  const gone = {};
  let wine = 0;
  s.buildings = (s.buildings || []).filter((b) => {
    if (REFUND_TYPES.includes(b.type)) {
      give(BUILDINGS[b.type]?.cost);
      const cls = b.hnUp ? upClassOf(b.type) : null;
      if (cls) give(UPGRADES[cls]?.cost);
      gone[b.type] = (gone[b.type] || 0) + 1;
      return false;
    }
    if (b.type === WINE_JAR) {
      b.type = PICKLE_JAR;
      wine++;
    }
    return true;
  });
  for (const [type, n] of Object.entries(gone)) notes.push("拆掉了 " + (BUILDINGS[type]?.name || type) + " ×" + n + "，材料全退");
  if (wine) notes.push("土酒坛 ×" + wine + " 换成了腌缸，坛里正在酿的照样出");
  // ---------- 田 ----------
  let traitPlots = 0,
    weeds = 0;
  const farm = (s.plots || []).filter((p) => p.region !== "valley");
  for (const p of farm) {
    p.fertility = SOIL_FLAT;
    if (p.trait) {
      p.trait = null;
      traitPlots++;
    }
  }
  for (const rec of Object.values(s.garden?.plots || {})) {
    if (rec.w || rec.b) weeds++;
    Object.assign(rec, { w: 0, b: 0, cv: 0, rot: 0 });
  }
  if (weeds) notes.push("田里的草和虫拿掉了（" + weeds + " 块）");
  if (traitPlots) notes.push("地里 " + traitPlots + " 块特性作物照普通的长");
  for (const r of Object.values(s.bounty?.plots || {})) {
    if (r.fz && r.fz !== "grow") r.fz = "grow";
    if (r.st) r.st = 0;
    delete r.pr;
  }
  for (const r of Object.values(s.bounty?.compost || {})) r.kind = "grow";
  // ---------- 手上、仓库里的东西 ----------
  let ferts = 0,
    seeds = 0;
  for (const bag of [s.inventory || {}, store]) {
    for (const id of Object.keys(bag)) {
      const n = bag[id] || 0;
      if (!(n > 0)) continue;
      if (FERT.old.includes(id)) {
        delete bag[id];
        bag[FERT.id] = (bag[FERT.id] || 0) + n;
        ferts += n;
        continue;
      }
      const m = id.match(TRAIT_SEED);
      if (m && CROPS[m[1]]?.seed && ITEMS[CROPS[m[1]].seed]) {
        delete bag[id];
        const plain = CROPS[m[1]].seed;
        bag[plain] = (bag[plain] || 0) + n * TRAIT_SWAP;
        seeds += n;
      }
    }
  }
  if (ferts) notes.push("提质肥、保水肥 ×" + ferts + " 并成了肥料");
  if (seeds) notes.push("特性种子 ×" + seeds + " 换成了普通种子（一颗换两颗）");
  // ---------- 营地的人：一个士气 ----------
  const rs = s.colony?.residents || [];
  if (rs.length) {
    const avg = Math.round(rs.reduce((a, r) => a + (Number.isFinite(r.morale) ? r.morale : MORALE.start), 0) / rs.length);
    s.trim.morale = clamp(avg, 0, 100);
    for (const r of rs) {
      r.morale = s.trim.morale;
      r.fatigue = 0;
      if (r.status === "受伤了" || r.status === "挂彩了，守到这一仗打完" || /在.+休息|疲劳|伤员|政策|分餐/.test(r.status || "")) r.status = "";
    }
    notes.push("每个人的心情并成全营士气 " + s.trim.morale);
  }
  const hurt = Object.keys(s.bustle?.hurt || {}).length;
  if (hurt) {
    s.bustle.hurt = {};
    notes.push("伤员 " + hurt + " 个今天就好了");
  }
  if (s.winter?.decrees?.length) {
    notes.push("法令取消了（" + s.winter.decrees.length + " 条）");
    s.winter.decrees = [];
    if (s.frontier?.policy) Object.assign(s.frontier.policy, { work: "standard", food: "equal" });
  }
  if (s.seasons?.canteen && Number.isFinite(s.seasons.canteen.rep)) s.seasons.canteen.rep = 30;
  // ---------- 动静、电台、机床加急 ----------
  if (s.bustle?.noise) s.bustle.noise.v = 0;
  if (s.bustle?.help?.armed && !s.bustle.help.live) Object.assign(s.bustle.help, { armed: false, allies: [] });
  if (s.tidy?.lathe) Object.assign(s.tidy.lathe, { rush: 0, jam: 0 });
  // 出货箱的挂牌并进出货箱：挂着没卖的退回仓库
  const listing = s.tidy?.listing || [];
  if (listing.length) {
    for (const l of listing) give({ [l.item]: l.qty });
    s.tidy.listing = [];
    notes.push("出货箱挂着牌的 " + listing.length + " 格取下来了，东西回了仓库（以后放进出货箱当晚卖掉）");
  }
  // 夜里的抉择：今晚等着的那一件不再等
  if (s.far?.night && !s.far.night.done) s.far.night.done = true;
  // 田的肥力标记不再有；水渠的闸门一直开着（挖通了就有水）
  if (s.frontier?.soilView) s.frontier.soilView = false;
  if (s.frontier?.canals && !s.frontier.canals.open) s.frontier.canals.open = true;
  // ---------- 买卖 ----------
  const hemc = s.far?.hemc;
  if (hemc?.debt) {
    const d = hemc.debt,
      owe = {};
    for (const [id, n] of Object.entries(d.total || {})) {
      const left = Math.max(0, n - (d.paid?.[id] || 0));
      if (left > 0) owe[id] = left;
    }
    hemc.debt = null;
    notes.push("欠贺满仓的那笔一笔结清了" + (Object.keys(owe).length ? "（剩下的 " + itemsText(owe) + " 不用还了）" : ""));
  }
  for (const o of s.outpost?.caravan?.offers || []) if (o.fake) o.fake = false;
  const hp = s.hope;
  if (hp?.goods?.dove) {
    delete hp.goods.dove;
    money += GOODS.dove?.price || 0;
    notes.push("鸽舍拆了，" + (GOODS.dove?.price || 0) + " 金币退回来了");
  }
  // ---------- 偷东西：经验折给探索；赃物、怀疑、赔礼这些都清掉 ----------
  const sk = s.skills,
    th = s.theft;
  if (sk && sk.thiefXp > 0) {
    s.xp = s.xp || {};
    s.xp.exploration = (s.xp.exploration || 0) + sk.thiefXp;
    notes.push("妙手的经验 " + sk.thiefXp + " 折给了探索");
    sk.thiefXp = 0;
  }
  if (th) {
    for (const st of th.stashes || []) give(st.items);
    if ((th.stashes || []).length) notes.push("藏货点里的东西搬进了仓库");
    th.stashes = [];
    th.sus = {};
    th.hot = [];
    th.strike = {};
    th.leaving = {};
    th.pending = null;
    th.discovery = null;
    if (th.market) Object.assign(th.market, { banned: false, priceUntil: 0 });
    if (th.flags) delete th.flags.hemcAngry;
  }
  // ---------- 地区仓库并进农场仓库 ----------
  const d = s.districts,
    bz = s.beyond;
  let moved = 0;
  if (d?.stores)
    for (const k of Object.keys(d.stores)) {
      const st = d.stores[k] || {};
      if (Object.keys(st).length) moved++;
      give(st);
      d.stores[k] = {};
    }
  if (d?.reserves) for (const k of Object.keys(d.reserves)) d.reserves[k] = {};
  if (Array.isArray(d?.freight) && d.freight.length) {
    for (const f of d.freight) give(f.items);
    d.freight = [];
  }
  if (Array.isArray(d?.routes)) d.routes = [];
  if (bz?.stores)
    for (const k of Object.keys(bz.stores)) {
      const st = bz.stores[k] || {};
      if (Object.keys(st).length) moved++;
      give(st);
      bz.stores[k] = {};
    }
  if (Array.isArray(bz?.shipments) && bz.shipments.length) {
    for (const sh of bz.shipments) give(isObj(sh.payload?.items) ? sh.payload.items : isObj(sh.payload) ? sh.payload : null);
    bz.shipments = [];
  }
  if (bz?.dog && bz.dog.mode !== "follow") bz.dog.mode = "follow";
  if (moved) notes.push(moved + " 处地区仓库里的东西搬进了农场仓库");
  const caches = s.echoes?.caches || [];
  if (caches.length) {
    for (const c of caches) give(c.items);
    s.echoes.caches = [];
    notes.push("路上存下的 " + caches.length + " 处物资搬进了仓库");
  }
  if (money) s.money = (s.money || 0) + money;
  s.trim.conv = { day: s.day || 1, notes, items: back, money, told: false, after: true };
}

// 读档前：清单进度里“上品”那几格改叫“优质”（下面几层读档时按清单查，不改读不进来）
export function trimPreText(text) {
  let raw;
  try {
    raw = JSON.parse(text);
  } catch {
    return text;
  }
  return raw && typeof raw === "object" && renameListKeys(raw) ? JSON.stringify(raw) : text;
}
export function migrateState(s) {
  applyTrimData();
  renameListKeys(s);
  sMigrate(s);
  if (!s.trim) {
    s.trim = trimDefaults();
    convertOld(s);
  } else s.trim = mergeDefaults(s.trim);
  return s;
}
export function freshState() {
  applyTrimData();
  const s = sFresh();
  s.trim = trimDefaults();
  return openGate(migrateState(s));
}
export function newGameState(origin = "farmer") {
  applyTrimData();
  const s = sNewGame(origin);
  s.trim = trimDefaults();
  return openGate(migrateState(s));
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  applyTrimData();
  const s = sNewGamePlus(old, origin, keep, book);
  s.trim = trimDefaults();
  return openGate(migrateState(s));
}
// 读档以前：没有删繁这一块的旧档，原样留一份在升级检查点里（那一格空着的话）
export const needsUpgrade = (text) => {
  if (sNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !Array.isArray(raw) && !raw.trim;
  } catch {
    return false;
  }
};

function validateTrim(s) {
  const t = s.trim,
    bad = (why) => {
      throw new Error("存档里的删繁记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
    };
  if (!isObj(t)) bad("缺少");
  if (!Number.isInteger(t.schema) || t.schema < 1 || t.schema > 99) bad("版本");
  if (!Number.isFinite(t.morale) || t.morale < 0 || t.morale > 100) bad("士气");
  if (!isObj(t.dry) || Object.keys(t.dry).length > 2000) bad("田");
  if (!isObj(t.hurt) || !Number.isFinite(t.hurt.day) || !Number.isFinite(t.hurt.n)) bad("伤");
  if (!Array.isArray(t.learned) || t.learned.length > 40 || !Array.isArray(t.given) || t.given.length > 40) bad("记录");
  if (t.conv !== null && (!isObj(t.conv) || !Array.isArray(t.conv.notes) || t.conv.notes.length > 60 || !isObj(t.conv.items))) bad("转换");
}

export class Engine extends ClearEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    // 旧档转换里要用到引擎的几步（天赋、宝贝、藏货点、鼎丰的车队）
    if (this.tr?.conv?.after) this.trAfterConvert();
  }
  get tr() {
    return this.s.trim;
  }

  // ================= 旧档转换 =================
  trAfterConvert() {
    const cv = this.tr.conv;
    cv.after = false;
    const notes = cv.notes,
      back = cv.items;
    // 残页里没挖的藏货：东西直接进仓库
    const rl = this.rl;
    if (rl) {
      let dug = 0;
      for (const pid of PAGE_IDS) {
        const p = PAGES[pid];
        if (p.kind !== "riddle" || !rl.pages.includes(pid) || rl.dug.includes(p.dig)) continue;
        const got = this.trDigGot(p.dig);
        if (!got) continue;
        for (const [id, n] of Object.entries(got.items)) back[id] = (back[id] || 0) + n;
        cv.money += got.gold;
        dug++;
      }
      if (dug) notes.push("残页上还没挖的 " + dug + " 处藏货，东西直接进了仓库");
      // 鼎丰：付了钱的墙今天修好；合同不再有
      const co = rl.co;
      if (co?.state === "signed") {
        if (Object.keys(co.pending || {}).length) this.coMorning?.(this.s.day + 1);
        co.state = "torn";
        co.leave = null;
        notes.push("鼎丰的合同不再有，买下的墙都还在");
      }
    }
    // 没认过的蘑菇：捡到就认得了
    const mush = this.trSortMushrooms(false);
    if (mush) notes.push("没认过的蘑菇 " + mush.n + " 朵认过了：" + (mush.n - mush.bad) + " 朵能吃，" + mush.bad + " 朵有毒的扔了");
    // 天赋：学过的照样算，剩下的点按顺序学
    const got = this.trLearn(true, true);
    if (got.length) notes.push("天赋自己学了：" + got.map((id) => this.trTalentName(id)).join("、"));
  }
  // 一处藏货给的东西（钱和东西都直接收进来）
  trDigGot(id) {
    const d = DIGS[id];
    if (!d || this.rl.dug.includes(id)) return null;
    this.rl.dug.push(id);
    const items = { ...(d.reward?.items || {}) };
    if (d.old) {
      const oid = this.oldPick?.(this.oldPool?.("*") || [], this.rlRoll?.("dig", id) || 0);
      if (oid) items[oid] = 1;
    }
    this.putStorage(items);
    this.s.money += d.reward?.gold || 0;
    return { items, gold: d.reward?.gold || 0 };
  }
  // 进了游戏（第一帧）说一句；消息里有整张清单
  update(dt, input = {}) {
    // 营业的晚上走到广场：食堂自己开张（先看是不是在广场边、是不是那几个钟点，便宜）
    if (this.tr && !this.paused && this.s.region === "farm" && this.s.minute >= 19 * 60 && this.s.minute < 21 * 60 && dist(this.s.player, SSPOTS.plaza) <= 150) this.trCanteenAuto();
    const cv = !this.paused && this.tr?.conv;
    if (cv && !cv.told) {
      cv.told = true;
      const text = CONVERT_INTRO + (cv.notes.length ? "（" + cv.notes.length + " 样，消息里「" + CONVERT_TITLE + "」有清单）" : "");
      this.toast(text, "gold");
      if (this.o) this.olog((CONVERT_INTRO + cv.notes.join("；")).slice(0, 160), "gold");
    }
    return super.update(dt, input);
  }
  trConvLines() {
    const cv = this.tr?.conv;
    if (!cv) return [];
    const lines = [...cv.notes];
    if (Object.keys(cv.items).length) lines.push("退进仓库的：" + itemsText(cv.items));
    if (cv.money) lines.push("退回的金币：" + cv.money);
    return lines;
  }

  // ================= 设施 =================
  startBuild(type) {
    if (REFUND_TYPES.includes(type) || type === WINE_JAR) {
      this.toast((BUILDINGS[type]?.name || "这样设施") + "不再建造了。", "warn");
      return false;
    }
    if (DECOR_LOOKS.includes(type)) return this.trDecorDo(() => super.startBuild(type));
    return super.startBuild(type);
  }
  placeBuilding(x, y, ...rest) {
    const type = this.buildMode;
    if (typeof type === "string" && DECOR_LOOKS.includes(type)) return this.trDecorDo(() => super.placeBuilding(x, y, ...rest));
    return super.placeBuilding(x, y, ...rest);
  }
  // 地板、椅子这些在建造页上不单列（并成“摆件”一格），从那一格的卡上挑了照样能建
  trDecorDo(fn) {
    const keep = DECOR_LOOKS.map((id) => [id, BUILDINGS[id]?.retired]);
    for (const [id] of keep) if (BUILDINGS[id]) BUILDINGS[id].retired = false;
    try {
      return fn();
    } finally {
      for (const [id, r] of keep) if (BUILDINGS[id]) BUILDINGS[id].retired = r;
    }
  }
  // 摆出来的摆件有几种（全营士气按种数算）
  trDecorKinds() {
    const kinds = new Set();
    for (const b of this.s.buildings || []) if (DECOR_TYPES.includes(b.type) && b.hp > 0) kinds.add(b.type === "alDecor" ? "alDecor:" + (b.decor || b.item || "") : b.type);
    return kinds.size;
  }

  // ================= 水：喷灌头、水渠、每天替你浇的 =================
  netProduce() {
    if (!this.bt) return super.netProduce();
    const n = this.bt.net;
    Object.assign(n, { day: this.s.day, made: 0, kept: 0, pool: 0, used: 0, missed: 0, dry: [] });
  }
  // only = ["sprinkler"]：白天每个钟点喷灌头再看一眼；不带参数：半夜过了，喷灌头、水渠、每天替你浇的那几块
  netDistribute(only = null) {
    if (!this.bt) return super.netDistribute(only);
    let n = this.trSprinkle();
    if (only) return n;
    n += this.trCanal();
    n += this.trAutoWater();
    return n;
  }
  trWaterable(p) {
    return !!p?.crop && CROPS[p.crop] && p.growth < CROPS[p.crop].grow && !this.plotWatered(p);
  }
  trWater(p) {
    this._netWater = true;
    try {
      this.waterPlot(p);
    } finally {
      this._netWater = false;
    }
  }
  trSprinkle() {
    let n = 0;
    const farm = this.farmPlots();
    for (const b of this.s.buildings.filter((x) => x.type === "irrigation" && x.hp > 0)) {
      const r = this.sprinklerR?.(b) || SPRINKLE.r;
      for (const p of farm)
        if (dist(p, b) < r && this.trWaterable(p)) {
          this.trWater(p);
          n++;
        }
    }
    return n;
  }
  trCanal() {
    if (!this.canalReady?.()) return 0;
    const at = { x: 770, y: 695 };
    let n = 0;
    for (const p of this.farmPlots())
      if (dist(p, at) < CANAL_R && this.trWaterable(p)) {
        this.trWater(p);
        n++;
      }
    return n;
  }
  // 蓄水池、通水的墙、二级、风车：原来往水网里加水，现在每天替你浇这么多块（先浇长得慢的）
  trAutoCount() {
    let n = 0;
    try {
      for (const x of super.netSources?.() || []) if (!["well", "barrel", "tower", "canal"].includes(x.kind)) n += x.made || 0;
    } catch {
      n = 0;
    }
    return Math.max(0, Math.round(n));
  }
  trAutoWater() {
    const n = this.trAutoCount();
    if (!n) return 0;
    const list = this.farmPlots()
      .filter((p) => this.trWaterable(p))
      .sort((a, b) => a.growth / CROPS[a.crop].grow - b.growth / CROPS[b.crop].grow || a.id - b.id)
      .slice(0, n);
    for (const p of list) this.trWater(p);
    return list.length;
  }
  // 水渠的闸门去掉了：挖通了就算通
  canalReady() {
    return !!this.f?.canals && super.canalReady();
  }
  waterControl(kind) {
    if (this.tr && kind === "gate") {
      this.toast("闸门一直开着：水渠挖通了，渠边的田每天自己有水。");
      return false;
    }
    return super.waterControl(kind);
  }
  toggleSprinkler() {
    this.toast("喷灌头一直开着：每天浇旁边的田。");
    return false;
  }
  irrigationConnected(b) {
    return true;
  }
  automationStatus(b) {
    if (b?.type === "irrigation" && b.hp > 0) return "开着 · 每天浇 " + (this.sprinklerR?.(b) || SPRINKLE.r) + " 以内的田";
    return super.automationStatus(b);
  }
  netMove() {
    return false;
  }
  droneHour() {}
  droneHarvests() {
    return false;
  }

  // ================= 田：只留种、浇、收 =================
  // 优质：天天浇上水的才有机会（漏过一天的，这一茬不出）
  careScore(p) {
    if (!p?.crop) return 0;
    return this.tr?.dry[p.id] ? FINE.dryScore : FINE.wetScore;
  }
  fineChance(score) {
    if (score < 80) return 0;
    const base = this.spec?.("agriculture", "quality") ? FINE.spec : FINE.chance;
    return Math.min(1, base + (this.f?.species?.includes("butterfly") ? 0.1 : 0));
  }
  careParts() {
    return [];
  }
  primeChance() {
    return 0;
  }
  buffsFor() {
    return { water: false, yield: false, quality: false, weed: false, from: {} };
  }
  soilForecast(p) {
    return { repeat: false, cost: 0, after: p?.fertility ?? SOIL_FLAT, rotation: false };
  }
  chargeSoil() {}
  // 半夜：只记下哪块田昨天没喝上水（不再有照料分、杂草、肥力）
  gNight() {
    const g = this.g,
      day = this.s.day,
      y = day - 1,
      dry = this.tr.dry;
    for (const p of this.s.plots) {
      if (!this.isFarmPlot(p)) continue;
      p.fertility = SOIL_FLAT;
      const rec = g.plots[p.id];
      if (p.crop && rec?.pd && rec.pd <= y && !this.wateredOn(p, y)) dry[p.id] = 1;
      if (!p.crop) delete dry[p.id];
    }
    for (const [k, rec] of Object.entries(g.plots)) {
      const p = this.plotById(k);
      if (!p || (!p.crop && !rec.w && !(rec.cv >= day))) delete g.plots[k];
    }
    for (const k of Object.keys(dry)) if (!this.plotById(k)?.crop) delete dry[k];
  }
  gWeeds() {}
  gHelper() {}
  // 清晨：只剩乌鸦（熟了不收的菜会被啄；稻草人护着）
  gMorning() {
    const bugs = this.trNoBugs;
    this.trNoBugs = true;
    try {
      const g = this.g,
        day = this.s.day;
      g.bugDay = day;
      const crops = this.s.plots.filter((p) => p.crop && CROPS[p.crop]);
      if (crops.length < 15) return;
      const scare = this.s.buildings.filter((b) => b.type === "scarecrow" && b.hp > 0);
      let pecked = 0;
      crops.forEach((p, i) => {
        if (p.growth < CROPS[p.crop].grow) return;
        const rec = this.gRec(p);
        if (rec.pk >= 2 || scare.some((b) => dist(b, p) <= 160)) return;
        if (this.btRoll?.("crow", day, p.id, i) < 0.25) {
          rec.pk++;
          pecked++;
        }
      });
      if (pecked) {
        g.stats.pecked += pecked;
        this.toast("乌鸦啄了 " + pecked + " 块熟了的菜（每块少收 1 份）。熟了早点收，或者立个稻草人。", "warn");
      }
    } finally {
      this.trNoBugs = bugs;
    }
  }
  tend() {
    return false;
  }
  coverReason() {
    return "盖布去掉了";
  }
  cover() {
    this.toast("盖布去掉了：坏天气前一天傍晚说一声，长得差不多的能抢收。", "warn");
    return false;
  }
  fodderReason() {
    return "肥力不再算了";
  }
  fodderSoil() {
    this.toast("肥力不再算了：草料可以沤肥，也能喂鸡。", "warn");
    return false;
  }
  theftNight() {}
  // 种下：不再有换茬、特性；漏水的记号清掉
  toolPlot(p, id) {
    const seed = ITEMS[id]?.type === "seed";
    const planting = seed && p && !p.crop;
    const ok = super.toolPlot(p, id);
    if (ok && planting && p.crop && this.isFarmPlot?.(p)) {
      p.trait = null;
      p.fertility = SOIL_FLAT;
      const rec = this.g?.plots[p.id];
      if (rec) rec.rot = 0;
      delete this.tr.dry[p.id];
    }
    return ok;
  }
  plantLine(p, crop) {
    return "种下" + (CROPS[crop]?.name || crop) + " · 天天浇上水，收的时候有机会出优质";
  }
  workerReplant(p, crop, trait) {
    const ok = super.workerReplant(p, crop, null);
    if (ok) {
      p.trait = null;
      p.fertility = SOIL_FLAT;
      delete this.tr.dry[p.id];
    }
    return ok;
  }
  harvest(p, worker = false) {
    const id = p?.id;
    const ok = super.harvest(p, worker);
    if (ok && id != null) {
      delete this.tr.dry[id];
      if (p.crop) p.trait = null;
      if (this.isFarmPlot?.(p)) p.fertility = SOIL_FLAT;
    }
    return ok;
  }
  // 按 E：熟了收、没水浇、没开垦开垦；种着的不用照看了，打开这块田看看
  plotAction(p) {
    if (p?.crop && CROPS[p.crop] && p.growth < CROPS[p.crop].grow && p.tilled && !this.plotDebris(p) && !this.giantOf?.(p)) {
      this.hpTopUp?.();
      const need = 1;
      if (!this.plotWatered(p) && (this.c?.water ?? need) >= need) return super.plotAction(p);
      this.emit("menu", { menu: "outpost", view: "gPlot", id: String(p.id) });
      return true;
    }
    return super.plotAction(p);
  }
  zAutoAct(p) {
    if (!p || !this.isFarmPlot?.(p) || !this.g) return null;
    if (this.giantOf?.(p)) return () => this.giantHit(p);
    if (p.crop && CROPS[p.crop] && p.growth >= CROPS[p.crop].grow) return p.crop === "hybrid" && this.hybridHarvest ? () => this.hybridHarvest(p) : () => this.handHarvest(p);
    if (this.plotDebris(p) || !p.tilled) return () => this.toolPlot(p, "hoe");
    if (p.crop) {
      if (!this.plotWatered(p) && (this.c?.water ?? 1) >= 1) return () => this.toolPlot(p, "water");
      return null;
    }
    const seed = this.s.seed;
    if (seed && ITEMS[seed]?.type === "seed" && this.qty(seed, this.s.region === "farm") > 0 && !this.pickReason?.(p)) return () => this.plantSeed(p.id, seed);
    return null;
  }
  plotContext(p) {
    let t = super.plotContext(p);
    if (typeof t !== "string") return t;
    const name = p?.crop ? CROPS[p.crop]?.name || "" : "";
    if (/^照看/.test(t)) t = /没水了/.test(t) ? "浇水壶没水了 · 去水井补满" : "查看" + name + " · 还要约 " + this.hoursLeft(p) + " 游戏小时";
    return t.replace(/\s*·\s*照料分\s*\d+/g, "").replace(/^拔草.*|^捉虫.*/, "查看" + name);
  }
  // 三种肥并成一种
  fertReason(p, kind = "grow") {
    return super.fertReason(p, "grow");
  }
  applyFert(p, kind = "grow") {
    return super.applyFert(p, "grow");
  }
  compostKind(id) {
    const r = this.compostRec?.(id);
    if (r) r.kind = "grow";
    return true;
  }
  compostRec(id) {
    const r = super.compostRec(id);
    if (r.kind !== "grow") r.kind = "grow";
    return r;
  }
  breedTrait() {
    this.toast("特性种子不再有了：育种箱一份菜换两颗普通种子。", "warn");
    return false;
  }
  // 特性种子：到了手上一颗换两颗普通的（每天早上和读档时看一眼）
  trTraitSweep() {
    let n = 0;
    for (const bag of [this.s.inventory, this.s.storage]) {
      for (const id of Object.keys(bag || {})) {
        const m = id.match(TRAIT_SEED),
          k = bag[id] || 0;
        if (!m || !(k > 0) || !CROPS[m[1]]?.seed || !ITEMS[CROPS[m[1]].seed]) continue;
        delete bag[id];
        bag[CROPS[m[1]].seed] = (bag[CROPS[m[1]].seed] || 0) + k * TRAIT_SWAP;
        n += k;
      }
      for (const id of FERT.old) {
        const k = bag?.[id] || 0;
        if (!(k > 0)) continue;
        delete bag[id];
        bag[FERT.id] = (bag[FERT.id] || 0) + k;
      }
    }
    if (this.s.seed && TRAIT_SEED.test(this.s.seed)) this.s.seed = CROPS[this.s.seed.match(TRAIT_SEED)[1]]?.seed || this.s.seed;
    return n;
  }
  // 腌缸：装进去的是哪一样，就照那一样的规矩出（土酒坛并进来了）
  jarOf(id) {
    const b = this.s.buildings.find((x) => x.id === id && (x.type === PICKLE_JAR || x.type === WINE_JAR));
    if (!b) return super.jarOf(id);
    const rec = this.al?.jars[b.id] || null;
    return { b, J: rec ? jarRecipe(rec.item) : JAR_ANY, rec };
  }
  jarFill(id, item) {
    const why = this.jarFillReason(id, item);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const J = jarRecipe(item);
    if (!this.takeFarm({ [item]: J.take })) return false;
    this.al.jars[id] = { item, n: J.take, start: this.s.day };
    this.alStat?.(J.verb === "酿" ? "brewed" : "pickled");
    this.toast("腌缸里" + J.verb + "上了 " + J.take + " 份" + ITEMS[item].name + "：" + J.ready + " 天后能取，放到 " + J.agedDays + " 天更值钱。");
    return true;
  }

  // 清单要“优质X”的那一格：上品的也收（手上还有的话）
  listAccepts(key) {
    const out = super.listAccepts(key);
    const m = typeof key === "string" && key.match(/^fine_(.+)$/);
    if (m && ITEMS["prime_" + m[1]] && !out.includes("prime_" + m[1])) return [...out, "prime_" + m[1]];
    return out;
  }

  // ================= 鸡舍：喂、领蛋、摸自己来 =================
  trCoop() {
    const a = this.c?.animals,
      coop = this.s.buildings.find((b) => b.type === "coop" && b.hp > 0);
    if (!a || !coop || !a.chicken) return;
    const day = this.s.day;
    // 06:00 喂：仓库里的玉米（有山羊 3 份），没有玉米用草料（3 份顶 1 份玉米）
    if (this.hour() >= 6 && a.feedDay !== day) {
      const corn = a.goat ? 3 : 1;
      let fed = false;
      if (this.qty("corn", true) >= corn) fed = this.takeFarm({ corn });
      else if (this.qty("fodder", true) >= corn * 3) fed = this.takeFarm({ fodder: corn * 3 });
      if (fed) {
        a.feedDay = day;
        a.remaining = 240;
      }
      // 摸一摸：天天有人摸
      for (const kind of ["flock", "goat"]) {
        const h = this.al?.herd?.[kind];
        if (!h || h.petDay === day || !this.herdHas?.(kind)) continue;
        h.pts = clamp(h.pts + 6, 0, 100);
        h.petDay = day;
      }
    }
    // 下了蛋、出了奶：自己进仓库（连鸡粪）
    if (Object.keys(a.ready || {}).length) {
      this.putStorage(a.ready);
      if (this.bt) this.putStorage({ manure: 1 });
      a.ready = {};
      a.claimedDay = day;
    }
  }
  feedAnimals() {
    this.toast("鸡舍自己会喂：每天早上用仓库里的玉米（没有就用草料）。", "warn");
    return false;
  }
  collectAnimals() {
    this.trCoop();
    return false;
  }
  herdPet() {
    this.toast("鸡和山羊天天有人摸，不用你去。", "warn");
    return false;
  }
  chickenReason() {
    return "放鸡下地去掉了";
  }
  releaseChickens() {
    this.toast("放鸡下地去掉了：鸡舍每天自己下蛋。", "warn");
    return false;
  }

  // ================= 营地一个士气 =================
  trMorale() {
    return this.tr?.morale ?? MORALE.start;
  }
  moodFactors() {
    const out = [],
      o = this.o,
      day = this.s.day,
      t = this.tr,
      F = MORALE_FACTORS,
      add = (key, v = F[key].v, text = F[key].text) => out.push({ key, v, text });
    if (o && o.dinnerDay >= day - 1 && (o.missed || []).some((k) => String(k).startsWith("r:"))) add("missed");
    else if (this.w && this.ladderChecks()[1]) add("fine");
    if (this.c.residents.length > this.residentsCapacity()) add("noBed");
    const last = this.ss?.fest?.lastDay || 0;
    if (last > 0 && day - last < 3) add("festival");
    const decor = Math.min(F.decor.max, this.trDecorKinds());
    if (decor) add("decor", decor, F.decor.text + " " + decor + " 种");
    if (t && t.lost && day - t.lost < F.lost.days) add("lost");
    const per = this.trHurtPer();
    if (t && t.hurt.n > 0 && per < 0 && day - t.hurt.day < F.hurt.days) add("hurt", Math.max(per * 3, per * t.hurt.n), F.hurt.text + " " + t.hurt.n + " 回");
    // 以前挣下来的那几样，照旧一直算
    if (o && o.dinnerDay >= day - 1 && (o.crew || []).some((c) => c.trait === "chatty" && !(o.missed || []).includes("c:" + c.id))) add("chatty");
    const ss = this.ss;
    if (ss) {
      const pd = ss.decor?.length || 0;
      if (pd >= 2) add("plaza", pd >= 4 ? F.plaza.big : F.plaza.v);
      if ((ss.ali?.murals || 0) >= 3) add("murals");
      if (ss.qin?.phase === "left") add("photo");
      const rs = this.c.residents || [];
      if (rs.length && rs.filter((r) => (ss.trust?.[r.id] || 0) >= 6).length * 2 >= rs.length) add("trust");
    }
    if (this.showcaseDone?.("photos")) add("photos");
    if (this.rl && this.s.buildings.some((b) => b.type === "rlWatch" && b.hp > 0)) add("watch");
    if (this.tg?.caseDone?.includes(10)) add("titans");
    return out;
  }
  moodTarget() {
    return clamp(MORALE.home + this.moodFactors().reduce((a, f) => a + f.v, 0), MORALE.min, MORALE.max);
  }
  // 守夜受伤一回掉多少士气：门诊、二级诊所各少掉 1 点
  trHurtPer() {
    return MORALE_FACTORS.hurt.v + (this.wallOn?.("clinic") ? CLINIC.wall : 0) + (this.wall2On?.("clinic") ? CLINIC.wall2 : 0);
  }
  moodTier() {
    const m = this.trMorale();
    return m < MORALE.low ? "low" : m >= MORALE.high ? "high" : "normal";
  }
  // 半夜往“该有的士气”走四成
  moodDrift() {
    if (!this.tr) return super.moodDrift();
    this.trMoraleSync();
    const m = this.tr.morale;
    this.tr.morale = clamp(Math.round(m + (this.moodTarget() - m) * MORALE.drift), 0, 100);
    this.trMoraleSync(true);
  }
  // 原来给某一个人加减心情的那几处（送礼、营火、节目……）：按营地的人数折进全营士气；每个人都照全营的数
  trMoraleSync(push = false) {
    const t = this.tr,
      rs = this.c?.residents || [];
    if (!t) return;
    if (!push && rs.length) {
      const d = rs.reduce((a, r) => a + ((Number.isFinite(r.morale) ? r.morale : t.morale) - t.morale), 0) / rs.length;
      if (Math.abs(d) >= 0.01) t.morale = clamp(Math.round((t.morale + d) * 10) / 10, 0, 100);
    }
    for (const r of rs) {
      r.morale = Math.round(t.morale);
      if (r.fatigue) r.fatigue = 0;
    }
  }
  residentsMood(n) {
    if (!this.tr) return super.residentsMood?.(n);
    this.trMoraleSync();
    this.tr.morale = clamp(this.tr.morale + (Number(n) || 0), 0, 100);
    this.trMoraleSync(true);
    return true;
  }
  striking() {
    return false;
  }
  inspired() {
    return false;
  }
  inspireMorning() {}
  // 高了大家干活快、低了慢（原来的“生活水准”那几成并进来）
  efficiency() {
    const m = this.trMorale(),
      base = super.efficiency(),
      ladder = 0.05 * (this.w?.ladder || 0);
    return Math.max(0.5, base - ladder + (m >= MORALE.high ? 0.1 : m < MORALE.low ? -0.1 : 0));
  }
  // 守夜受伤：不再躺两天，全营士气掉一截
  injure(key, name, why = "") {
    const t = this.tr;
    if (!t) return super.injure(key, name, why);
    const night = this.hurtNightKey?.() ?? this.s.day;
    this._trHurt ??= new Set();
    const k = key + ":" + night;
    if (this._trHurt.has(k)) return false;
    this._trHurt.add(k);
    if (t.hurt.day !== this.s.day) Object.assign(t.hurt, { day: this.s.day, n: 0 });
    t.hurt.n = Math.min(9, t.hurt.n + 1);
    const per = this.trHurtPer();
    const text = (name || "有人") + "被抓伤了" + (why ? "（" + why + "）" : "") + "：包扎一下接着守" + (per < 0 ? "，全营士气 " + per + "。" : "。");
    this.toast(text, "warn");
    if (this.o) this.olog(text, "warn");
    return false;
  }
  lnFail() {
    const ok = super.lnFail();
    if (ok && this.tr) this.tr.lost = this.s.day;
    return ok;
  }
  // 生活水准去掉了：下面几层还看它的地方（葛队长、来借宿的人老不老实、节庆的星）按吃住算——
  // 吃得饱（每个人吃上晚饭）、吃得好（最近三顿三样菜）、住得暖（床够，寒潮里屋里暖）、有盼头（两天内过了节，或全营士气高）
  ladderChecks() {
    if (!this.tr) return super.ladderChecks();
    const w = this.w,
      o = this.o;
    if (!w || !o) return [false, false, false, false];
    const types = new Set((w.mealLog || []).slice(0, 3).flatMap((m) => m.types || []));
    const cold = w.winter?.phase === "cold",
      home = { x: 328, y: 315 },
      camp = this.sc?.camp;
    return [
      o.dinnerDay >= this.s.day - 1 && o.dinnerDay > 0 && !(o.missed || []).length,
      types.size >= 3,
      this.residentsCapacity() >= this.c.residents.length && (!cold || (this.shelterWarm(home) && (!camp || this.shelterWarm(camp)))),
      !!this.festivalRecent?.() || this.trMorale() >= MORALE.high,
    ];
  }
  // 房间去掉了（地板、椅子这些还在，只算摆件）
  rooms() {
    return this.tr ? [] : super.rooms();
  }
  toast(text, tone) {
    if (this.tr && typeof text === "string") for (const [re, to] of TRIM_SAY) text = text.replace(re, to);
    return super.toast(text, tone);
  }
  olog(text, tone) {
    if (this.tr && typeof text === "string") {
      if (TRIM_QUIET.some((re) => re.test(text))) return;
      for (const [re, to] of TRIM_SAY) text = text.replace(re, to);
    }
    return super.olog(text, tone);
  }
  // 法令去掉了
  decree() {
    return false;
  }
  decreeReason() {
    return "法令去掉了";
  }
  toggleDecree() {
    this.toast("法令去掉了。", "warn");
    return false;
  }
  setPolicy() {
    return false;
  }
  treatReason() {
    return "伤员去掉了";
  }
  treat() {
    return false;
  }
  laidUp() {
    return false;
  }
  isHurt() {
    return false;
  }
  restedNow() {
    return false;
  }
  // 食堂：口碑不再算；到了营业的晚上，你走到前哨广场它就自己开张（不用再按“开张”）
  trCanteen() {
    const c = this.ss?.canteen;
    if (c && Number.isFinite(c.rep) && c.rep !== 30) c.rep = 30;
  }
  trCanteenAuto() {
    const c = this.ss?.canteen;
    if (!c || c.night || c.lastDay === this.s.day || this.s.region !== "farm" || this.paused || this.ln?.night) return false;
    if (!this.canteenOpen?.() || !this.isCanteenDay?.() || this.canteenReason?.() || !this.atSpot?.(SSPOTS.plaza, 150)) return false;
    return !!this.startCanteen?.();
  }
  // 节庆的供品自己挑：挑最值钱的那几样（选项那种挑交得起里最好的）
  festivalPay(kind = this.festivalKind?.()) {
    if (this.hn && FEST_PICK[kind] && this.isFestivalDay?.() && kind === this.festivalKind?.() && !(this.festPicked?.(kind) || []).length) this.trAutoPick(kind);
    return super.festivalPay(kind);
  }
  trAutoPick(kind) {
    const f = this.hn?.fest;
    if (!f) return;
    if (f.day !== this.s.day) Object.assign(f, { day: this.s.day, pick: [] });
    if (f.pick.length) return;
    if (kind === "harvest" || kind === "seeds") f.pick = this.festPickable(kind).slice(0, FEST_PICK[kind].n);
    else {
      const best = [...(FEST_PICK[kind] || [])].filter((o) => this.afford?.(o.cost)).sort((a, b) => b.tier - a.tier)[0];
      if (best) f.pick = [best.id];
    }
  }

  // ================= 动静、电台、机床加急、改良、信标 =================
  noiseAdd() {}
  noiseSettle() {
    if (this.hn?.noise) this.hn.noise.v = 0;
  }
  noiseTier() {
    return null;
  }
  cmdReason() {
    return "电台指令去掉了";
  }
  radioCmd() {
    this.toast("电台只播早上的广播了。", "warn");
    return false;
  }
  programReason() {
    return "节目单去掉了";
  }
  chooseProgram() {
    return false;
  }
  airProgram() {}
  latheRushReason() {
    return "加急去掉了";
  }
  latheRush() {
    this.toast("机床加急去掉了：每天做的那一样自己进仓库。", "warn");
    return false;
  }
  unlockReason() {
    return "改良去掉了（改好的照样算）";
  }
  unlockPath() {
    this.toast("设施改良去掉了：已经改好的照样算。", "warn");
    return false;
  }
  upgradeReason() {
    return "改良去掉了（改好的照样算）";
  }
  upgradeBuilding() {
    this.toast("设施改良去掉了：已经改好的照样算。", "warn");
    return false;
  }
  upgradeFences() {
    return false;
  }
  // 信标：拉一次用 1 个零件（不再用电）
  pullLureReason(id) {
    const why = super.pullLureReason(id);
    if (why && !/电|零件/.test(why)) return why;
    if (this.qty("parts", true) < 1) return "要 1 个零件";
    return "";
  }
  pullLure(id) {
    const why = this.pullLureReason(id);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    const keep = this.c.energy;
    this.c.energy = 0;
    try {
      return super.pullLure(id);
    } finally {
      this.c.energy = keep;
    }
  }

  // ================= 手气签、夜里的抉择、来信、纸条 =================
  // 手气签去掉了：每天都是“平”，早上的广播不再念签
  luckOf() {
    return LUCK_BY_ID.plain;
  }
  morningParts(day = this.s.day) {
    const line = LUCK_BY_ID.plain.line;
    return super.morningParts(day).filter((x) => !!x && x !== line);
  }
  planNight() {}
  nightReason() {
    return "夜里的抉择去掉了";
  }
  doveMorning() {}
  kinNotes() {}

  // ================= 买卖 =================
  inspectOffer() {
    this.toast("唐九的货都是真的，不用验。");
    return false;
  }
  exposeCheat() {
    return false;
  }
  arriveCaravan() {
    const out = super.arriveCaravan();
    const c = this.o?.caravan;
    if (c?.offers) {
      for (const o of c.offers) if (o.fake) o.fake = false;
      // 旧站商街这周的稀罕货：跟着唐九的商队来
      const m = this.marketGood?.();
      if (m && !m.sold && GOODS[m.good] && !c.offers.some((o) => o.hpGood === m.good) && !this.goodReason?.(m.good, 0)) {
        const key = Math.max(0, ...c.offers.map((o) => Number(o.key) || 0)) + 1;
        c.offers.push({ key, item: goodItem(m.good), tech: null, qty: 1, price: GOODS[m.good].price, fake: null, inspected: "real", sold: false, hpGood: m.good, trWeek: true });
      }
    }
    return out;
  }
  buyOffer(key) {
    const c = this.o?.caravan,
      o = c?.offers.find((x) => x.key === Number(key) || x.key === key);
    const ok = super.buyOffer(key);
    if (ok && o?.trWeek) {
      const m = this.marketGood?.();
      if (m && m.good === o.hpGood) m.sold = true;
    }
    return ok;
  }
  districtOptions(id) {
    const out = super.districtOptions(id);
    return id === "shops" ? out.filter((o) => o.effect !== "hpGood" && o.id !== "hpGood") : out;
  }
  advanceReason() {
    return "贺满仓不再垫付";
  }
  startAdvance() {
    this.toast("贺满仓不再垫付了。", "warn");
    return false;
  }
  coReason() {
    return "鼎丰物资不再有";
  }
  coSign() {
    this.toast("鼎丰物资不再有了。", "warn");
    return false;
  }
  coBuyReason() {
    return "鼎丰物资不再有";
  }

  // 下面几层要说的话先收着（这一层自己说一句短的）
  trQuiet(fn) {
    const said = [],
      own = Object.prototype.hasOwnProperty.call(this, "toast"),
      keep = this.toast;
    this.toast = (t, tone) => said.push([t, tone]);
    let out;
    try {
      out = fn();
    } finally {
      if (own) this.toast = keep;
      else delete this.toast;
    }
    return [out, said];
  }

  // ================= 出货箱的挂牌并进出货箱 =================
  listReason() {
    return "挂牌并进出货箱了：放进出货箱，当晚卖掉";
  }
  listItem() {
    this.toast("挂牌并进出货箱了：放进出货箱，当晚卖掉。", "warn");
    return false;
  }
  // 换种集的第一颗星：这周用出货箱卖过东西（原来是“出货箱挂着牌”）
  festivalStars(kind = this.festivalKind()) {
    const stars = super.festivalStars(kind);
    if (this.tr && kind === "seeds" && Array.isArray(stars)) stars[0] = (this.o?.ledger || []).some((l) => this.s.day - l.day <= 7);
    return stars;
  }

  // ================= 蘑菇：捡到就认得 =================
  mushroomReason() {
    if (!this.tr) return super.mushroomReason();
    return this.qty(MUSHROOM.raw, true) < 1 ? "蘑菇捡到就认得了" : super.mushroomReason();
  }
  forageTake(sid) {
    const p = this.al?.forage?.spots?.find((x) => x.id === sid);
    if (!this.tr || !p || p.item !== MUSHROOM.raw) return super.forageTake(sid);
    const [ok] = this.trQuiet(() => super.forageTake(sid));
    if (ok) {
      const r = this.trSortMushrooms(true);
      if (!r) this.toast("捡到蘑菇。", "gold");
    }
    return ok;
  }
  // 身上和仓库里没认过的蘑菇：认一认，能吃的留下，有毒的扔掉（和许医生认的是同一个骰子）
  trSortMushrooms(say) {
    if (!this.al) return null;
    const raw = MUSHROOM.raw,
      inv = this.s.inventory,
      st = this.s.storage,
      n = (inv[raw] || 0) + (st[raw] || 0);
    if (!(n > 0)) return null;
    let bad = 0;
    for (let i = 0; i < n; i++) if (this.alRoll("mush", this.s.day, this.al.stats.mushrooms, i) < MUSHROOM.poison) bad++;
    const good = n - bad,
      inBag = inv[raw] || 0;
    delete inv[raw];
    delete st[raw];
    if (good > 0) {
      // 包里的照样在包里，仓库里的照样在仓库里
      const toBag = Math.min(good, inBag);
      if (toBag) inv[MUSHROOM.good] = (inv[MUSHROOM.good] || 0) + toBag;
      if (good - toBag) st[MUSHROOM.good] = (st[MUSHROOM.good] || 0) + good - toBag;
    }
    if (say) this.toast("捡到 " + n + " 朵蘑菇：认出 " + bad + " 朵有毒的扔了" + (good ? "，" + good + " 朵能吃。" : "，这回一朵能吃的都没有。"), good ? "gold" : "warn");
    return { n, bad };
  }

  // ================= 睡一觉「休息好」 =================
  // 房间、舒适度去掉了：睡在农舍就「休息好」，东厢房、二楼、热水器各加一点
  homeRoom() {
    return this.tr ? null : super.homeRoom();
  }
  bestComfort() {
    return this.tr ? 0 : super.bestComfort();
  }
  roomComfort(room) {
    return this.tr ? 0 : super.roomComfort(room);
  }
  trRestMinutes() {
    const lv = this.hpLv?.("home") || 0;
    return (REST.base + (lv >= 1 ? REST.wing : 0)) * 60 + (lv >= 2 ? EXPAND_FX.rest : 0) + (this.hpOwn?.("boiler") ? GOOD_FX.boiler : 0);
  }

  // ================= 天赋：按固定顺序自己学 =================
  trTalentName(id) {
    return TALENTS[id]?.name || id;
  }
  trSafe() {
    if (this.ln?.night || this.tg?.final?.on === this.s.day) return false;
    if (["warning", "active"].includes(this.s.horde?.phase)) return false;
    if (this.raidState?.()?.phase === "active") return false;
    if (this.titanAwake?.()) return false;
    const p = this.s.player;
    return !(this.enemies || []).some((z) => !z.dead && dist(z, p) < TALENT_SAFE_R);
  }
  trLearn(force = false, quiet = false) {
    if (!this.sk || (!force && !this.trSafe())) return [];
    const got = [];
    for (let guard = 0; guard < 20; guard++) {
      const id = TALENT_ORDER.find((t) => !this.hasTalent(t) && !super.talentReason(t));
      if (!id) break;
      this.sk.talents = [...this.sk.talents, id];
      got.push(id);
    }
    if (got.length) {
      this.tr.learned = [...this.tr.learned, ...got].slice(-40);
      if (!quiet) {
        const text = "学会了天赋：" + got.map((id) => this.trTalentName(id)).join("、") + "（天赋按顺序自己学）。";
        this.toast(text, "gold");
        if (this.o) this.olog(text, "gold");
      }
    }
    return got;
  }
  talentReason(id) {
    const why = super.talentReason(id);
    return why || "天赋会按顺序自己学";
  }
  learnTalent() {
    this.toast("天赋不用自己挑：每天早上有点数就按顺序学下一个。", "warn");
    return false;
  }
  respecReason() {
    return "天赋不能重新分配了";
  }
  respec() {
    return false;
  }
  sleep(...args) {
    if (!this.tr) return super.sleep(...args);
    const out = super.sleep(...args);
    if (out && this.hn) {
      const add = this.trRestMinutes();
      this.hn.rested = { until: this.absNow() + add, comfort: 0 };
      this.toast("睡得好：「休息好」" + Math.round(add / 60) + " 个钟点——体力恢复快五成，经验多一成。", "gold");
    }
    if (out) this.trLearn();
    return out;
  }

  // ================= 妙手去掉了 =================
  stealReason() {
    return "偷东西去掉了";
  }
  targetNear() {
    return null;
  }
  startPractice() {
    return false;
  }
  boxReason() {
    return "偷东西去掉了";
  }
  gardenStealReason() {
    return "偷东西去掉了";
  }
  plantOptions() {
    return [];
  }
  plant() {
    return false;
  }
  hotCount() {
    return 0;
  }
  thiefXp(n) {
    if (n > 0) this.xp?.("exploration", n);
    return false;
  }
  // 原来要偷的宝贝：主人信任到 8（或者跟他的事办完了），第二天早上自己交给你
  trGiver(id) {
    const T = TREASURES[id],
      own = T?.owner;
    if (!own || GIFT_TREASURE.skip.includes(id)) return false;
    const trust = this.ss?.trust || {};
    const key = own === "tang" ? "tangjiu" : own;
    if (Number.isFinite(trust[key])) return trust[key] >= GIFT_TREASURE.trust;
    if (own === "linyi") return (this.c?.relationships?.food?.trust || 0) >= 40;
    if (own === "laozhou") return (this.c?.relationships?.mechanic?.trust || 0) >= 40;
    if (own === "cai") return (NPCS?.cai?.challenges || []).every((ch) => this.o?.claimed?.includes("cai:" + ch.id));
    return false;
  }
  trTreasures() {
    const th = this.th;
    if (!th?.treasures) return;
    for (const id of TREASURE_IDS) {
      if (["taken", "given", "lost", "returned"].includes(th.treasures[id]) || !this.trGiver(id)) continue;
      th.treasures[id] = "given";
      const T = TREASURES[id];
      const lines = [];
      if (T.effect?.tech === "solar" || T.effect?.tech === "drone") this.receive(T.effect.fallback);
      else this.applyTreasure?.(id, lines);
      if (T.effect?.tech === "solar" || T.effect?.tech === "drone") lines.push("得到：" + itemsText(T.effect.fallback));
      this.tr.given = [...this.tr.given, id].slice(-40);
      const who = this.targetName?.(T.owner) || this.kinName?.(T.owner) || "";
      const text = (who ? who + "把" : "有人把") + "压箱底的「" + T.name + "」交给了你：" + T.text + "。";
      this.moment?.("upgrade", T.name, [text], { icon: "good" });
      if (this.o) this.olog(text, "gold");
    }
    // 职业手册：交给还没职业的人（按名册顺序）
    for (const manual of ["manualMedic", "manualCook", "manualHerd", "manualWeather"]) {
      if (!(this.stockOf?.(manual) > 0)) continue;
      const who = this.jobCandidates?.()[0];
      if (who) this.assignJob?.(manual, who.id);
    }
  }
  claimCai(id) {
    const ok = super.claimCai(id);
    if (ok) this.trTreasures();
    return ok;
  }

  // ================= 地区仓库并进农场仓库 =================
  districtStore(region = this.s.region) {
    if (!this.tr) return super.districtStore(region);
    return region === "farm" || this.d?.stores?.[region] ? this.s.storage : super.districtStore(region);
  }
  bstore(region = this.s.region) {
    const st = super.bstore(region);
    return this.tr && st ? this.s.storage : st;
  }
  setDistrictReserve() {
    return false;
  }
  sendDistrictFreight() {
    this.toast("地区的东西直接进农场仓库，不用运了。", "warn");
    return false;
  }
  setDistrictRoute() {
    return false;
  }
  btransfer() {
    return false;
  }
  districtTransfer() {
    return false;
  }
  startRoute() {
    this.toast("远征路线去掉了：出门都从地图走。", "warn");
    return false;
  }
  // 河道船班：货运停了，只投信
  bship(item, qty, mail = false) {
    if (this.tr && !mail) {
      this.toast("货运停了：各处的东西直接进农场仓库。", "warn");
      return false;
    }
    return super.bship(item, qty, mail);
  }
  // 残页：藏货谜题读了，东西直接进仓库（不用再去挖）
  readPage(id) {
    const out = super.readPage(id);
    const p = out ? PAGES[id] : null;
    if (p?.kind === "riddle" && this.tr) {
      const got = this.trDigGot(p.dig);
      if (got) {
        const text = "残页上画的地方，联盟的人替你挖出来了：" + (got.gold ? got.gold + " 金币、" : "") + itemsText(got.items) + "（已入仓）。";
        this.toast(text, "gold");
        if (this.o) this.olog(text, "gold");
      }
    }
    return out;
  }
  rlDigOpen() {
    return false;
  }

  // ================= 人 =================
  // 喜好明着写：认识的人喜欢什么、讨厌什么都知道
  prefKnown(id) {
    const k = super.prefKnown(id);
    if (!this.kin || !id) return k;
    let P;
    try {
      P = prefsOf(id);
    } catch {
      return k;
    }
    if (!P) return k;
    const out = { ...k };
    for (const x of P.fav || []) out[x] = "fav";
    for (const x of P.like || []) out[x] = "like";
    for (const x of P.hate || []) out[x] = "hate";
    return out;
  }
  // 麦穗：一直跟着你；饭自己吃（每天早上一份干粮，仓库里有的话）
  bdog(mode) {
    if (mode === "follow") return super.bdog(mode);
    return false;
  }
  trDog() {
    const d = this.fr?.dog;
    if (!d || !this.dogReady?.() || d.fedDay === this.s.day) return;
    if (this.qty("bread", true) < 1) return;
    const [, said] = this.trQuiet(() => this.feedDog?.());
    for (const [t, tone] of said) if (tone === "gold") this.toast(t, tone);
    if (this.b?.dog && this.b.dog.mode !== "follow") this.b.dog.mode = "follow";
  }

  // ================= 生态：照收复度自己长（修复区的牌子去掉了） =================
  // 每 6.25% 收复度多修好一格；你自己改过的格子（开成田的、已经种了什么的）不动
  trEcology() {
    const f = this.f,
      pct = this.rl ? this.rlCompletion?.()?.pct || 0 : 0;
    if (!f?.ecology || !(pct > 0)) return 0;
    const n = Math.min(ECO_ORDER.length, Math.floor((pct / 100) * ECO_ORDER.length));
    let changed = 0;
    for (const [i, type] of ECO_ORDER.slice(0, n)) {
      const t = f.ecology[i];
      if (!t || t.type === "field") continue;
      if (!t.clean || t.type === "empty") {
        t.clean = true;
        if (t.type === "empty") t.type = type;
        changed++;
      }
    }
    if (changed) this.restoreSpecies?.();
    return changed;
  }

  // ================= 场景里去掉的那几样 =================
  // 夜里的抉择、贺满仓的账桌（只管垫付）、偷东西的稻草人和钱箱和藏货点、林姨的菜园（偷菜）、残页的松土、水渠闸门、生态修复区的牌子
  assignRegion() {
    super.assignRegion();
    if (!this.tr || !Array.isArray(this.objects)) return;
    if (this.objects.some((o) => TRIM_GONE.has(o.type))) this.objects = this.objects.filter((o) => !TRIM_GONE.has(o.type));
  }

  // ================= 每个钟点、每天 =================
  workHour() {
    super.workHour();
    if (!this.tr) return;
    const h = this.hour();
    this.trMoraleSync();
    this.trCoop();
    this.trCanteen();
    if (h === 6) {
      this.trTraitSweep();
      this.trLearn();
      this.trEcology();
    }
    if (h === 7) {
      this.trTreasures();
      this.trDog();
    }
  }
  onNewDay() {
    super.onNewDay();
    if (!this.tr) return;
    if (this.hn?.noise) this.hn.noise.v = 0;
    for (const p of this.s.plots) if (this.isFarmPlot?.(p)) p.fertility = SOIL_FLAT;
  }

  // ================= 存档 =================
  static parse(text) {
    applyTrimData();
    const s = ClearEngine.parse(trimPreText(text));
    migrateState(s);
    validateTrim(s);
    return s;
  }
}
