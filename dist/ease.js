// v0.43.0「上手」：引擎最上面一层（盖在 v0.42 删繁那一层上面）。一物一用方案的第三版：
// 1. 用得上的时候才出现：新开的档，菜单里用不上的那几格、菜单最上面一行的士气，先不出现；用得上了才出现，第一次出现时角上停一张小卡。
// 2. 第一次见到的小卡：第一次走近一样没见过的东西、第一次能建一样设施，屏幕角上停一张它的说明卡（不挡路、不停游戏，几秒后收起；设置里能关）。
// 3. 新档前三天的引导：第 2、3 天早上角上一张小卡说今天先做什么（主线这一步，和任务手记最上面的主线卡同一件事）。
// 旧档（这一版以前的档、带着记忆重新开始的档）用过的都算见过：菜单和数照旧都在，不弹小卡，没有前三天的引导。
// 这一层不改任何玩法的数，不碰随机数，不让下面几层多过一遍；存档加一块 ease（见过什么、出现过什么、小卡开没开），不加存档键。
import {
  Engine as TrimEngine,
  freshState as tFresh,
  migrateState as tMigrate,
  newGameState as tNewGame,
  newGamePlusState as tNewGamePlus,
  needsUpgrade as tNeedsUpgrade,
  legacyGear,
} from "./trim.js";
import { BUILDINGS, RECIPES } from "./data.js";
import { BCARD, MENUS } from "./simple-data.js";
import { DECOR_LOOKS, DECOR_SPECIAL } from "./trim-data.js";
import { EASE_SCHEMA, CARD_QUEUE, GUIDE_DAYS, MENU_ALWAYS, MENU_IDS, CARD_TAG, CARD_NOW, MENU_FRESH, OBJ_CARD, PERSON_CARD, PERSON_TYPES, MORALE_CARD, GUIDE, EASE_SAY, JOB_TEXT, MANUAL_DESC, DAILY_QUIET, DAILY_TEXT, ITEM_TEXT } from "./ease-data.js";
import { PERKS, BUFFS } from "./daily-data.js";
import { GOODS, goodItem } from "./hope-data.js";
import { ITEMS } from "./data.js";
import { JOBS, MANUALS, MANUAL_IDS } from "./thief-data.js";
import { EVENTS as CAMP_EVENTS } from "./expansion-data.js";

export { legacyGear };

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const strList = (v, max) => (Array.isArray(v) ? v.filter((x) => typeof x === "string" && x.length <= 60).slice(0, max) : []);
const CAP = { seen: 600, shown: 60, built: 160, mornings: 10 };
const DECOR = [...DECOR_LOOKS, ...DECOR_SPECIAL];
// 几样东西的说明照现在的说（所有的档；只改字）。第一次有这一层的引擎时改（删繁那一层这时已经改好了它的那些字）
let textsDone = false;
function easeTexts() {
  if (textsDone) return;
  textsDone = true;
  // 两本职业手册
  for (const [id, text] of Object.entries(JOB_TEXT)) if (JOBS[id]) JOBS[id].text = text;
  for (const id of MANUAL_IDS) if (ITEMS[id] && JOBS[MANUALS[id]?.job]) ITEMS[id].desc = MANUAL_DESC(JOBS[MANUALS[id].job]);
  // 小满和老唱片：电台节目去掉了
  if (PERKS.radioOp) PERKS.radioOp.text = DAILY_TEXT.radioOp;
  if (BUFFS.radio) BUFFS.radio = () => DAILY_TEXT.radio;
  // 稀罕货：删繁改了货的那一句，东西的说明还是原来的
  for (const [id, g] of Object.entries(GOODS)) if (ITEMS[goodItem(id)] && g?.text) ITEMS[goodItem(id)].desc = "稀罕货：" + g.text;
  // 优质收成、草料
  for (const [id, it] of Object.entries(ITEMS)) {
    if (id.startsWith("fine_") && it.desc === ITEM_TEXT.fineOld) it.desc = ITEM_TEXT.fine;
    if (id.startsWith("prime_") && it.desc === ITEM_TEXT.primeOld) it.desc = ITEM_TEXT.prime;
  }
  if (ITEMS.fodder) ITEMS.fodder.desc = ITEM_TEXT.fodder;
}
export function easeSay(text) {
  if (typeof text !== "string") return text;
  for (const [re, to] of EASE_SAY) text = text.replace(re, to);
  return text;
}

// ---------- 存档里的这一块 ----------
// fresh：这一版新开的档（才有“用得上才出现”、小卡和前三天的引导）；seen：见过的东西；shown：出现过的菜单格和数；
// built：已经知道能建的设施；buildInit：开局能建的那几样已经记下（开局那几样不弹卡）；cards：小卡开着没有；mornings：哪几天早上的小卡说过了
export function easeDefaults(fresh = false) {
  return { schema: EASE_SCHEMA, fresh: !!fresh, seen: [], shown: [], built: [], buildInit: false, cards: true, mornings: [] };
}
function easeMigrate(s) {
  const d = easeDefaults(false),
    e = s.ease;
  if (!isObj(e)) s.ease = d;
  else
    s.ease = {
      ...d,
      schema: EASE_SCHEMA,
      fresh: e.fresh === true,
      seen: strList(e.seen, CAP.seen),
      shown: strList(e.shown, CAP.shown),
      built: strList(e.built, CAP.built),
      buildInit: e.buildInit === true,
      cards: e.cards !== false,
      mornings: Array.isArray(e.mornings) ? e.mornings.filter((n) => Number.isInteger(n) && n >= 1 && n <= 99).slice(0, CAP.mornings) : [],
    };
  return s;
}
export function migrateState(s) {
  tMigrate(s);
  return easeMigrate(s);
}
export function freshState() {
  const s = tFresh();
  s.ease = easeDefaults(true);
  return s;
}
export function newGameState(origin = "farmer") {
  const s = tNewGame(origin);
  s.ease = easeDefaults(true);
  return s;
}
// 带着记忆重新开始：玩过一遍的人，菜单都在，不弹小卡
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  const s = tNewGamePlus(old, origin, keep, book);
  s.ease = easeDefaults(false);
  return s;
}
// 读档以前：没有上手这一块的旧档，原样留一份在升级检查点里（那一格空着的话）
export const needsUpgrade = (text) => {
  if (tNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !Array.isArray(raw) && !raw.ease;
  } catch {
    return false;
  }
};

function validateEase(x) {
  const bad = (why) => {
    throw new Error("存档里的上手记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
  };
  if (!isObj(x)) bad("缺少");
  if (!Number.isInteger(x.schema) || x.schema < 1 || x.schema > 99) bad("版本");
  for (const k of ["fresh", "buildInit", "cards"]) if (typeof x[k] !== "boolean") bad(k);
  for (const [k, max] of Object.entries(CAP)) if (!Array.isArray(x[k]) || x[k].length > max) bad(k);
  if (Object.keys(x).some((k) => !Object.hasOwn(easeDefaults(), k))) bad("多了字段");
}

export class Engine extends TrimEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    easeTexts();
    // 排着队的小卡（不进存档）
    this._ezq = [];
  }
  get ez() {
    return this.s.ease;
  }
  easeFresh() {
    return !!this.ez?.fresh;
  }

  // ================= 用得上的时候才出现 =================
  // 营地里有没有人（士气只对营地里的人有用）
  easeCampPeople() {
    return (this.c?.residents?.length || 0) + (this.sc?.helpers?.length || 0);
  }
  // 菜单里这一格现在用不用得上
  easeMenuUsable(id) {
    const s = this.s;
    if (MENU_ALWAYS.includes(id)) return true;
    try {
      if (id === "craft") return RECIPES.some((r) => !r.station && !this.recipeReason?.(r));
      if (id === "build") return s.buildings.some((b) => b.hp > 0 && BUILDINGS[b.type]?.cost) || this.easeBuildable().some((t) => this.afford?.(BUILDINGS[t].cost || {}));
      if (id === "map") return Object.keys(s.visited || {}).some((r) => r !== "farm") || this.easeGuideOutside() || s.day > GUIDE_DAYS;
      if (id === "people") return (this.people?.() || []).length > 0 || !!this.dogReady?.();
      if (id === "collection") return (s.stats?.harvested || 0) > 0 || (s.stats?.fish || 0) > 0 || (this.feel?.career?.trips?.length || 0) > 0;
      // 消息：有了记录以后（收到的消息列在任务手记里，提示也指到那里）
      if (id === "messages") return (this.o?.log?.length || 0) > 0 || (this.sc?.log?.length || 0) > 0 || (this.sc?.letters?.length || 0) > 1;
      if (id === "skills") return Object.values(s.xp || {}).some((v) => v > 0);
    } catch {
      return true;
    }
    return true;
  }
  // 营地的小事（无线电求援、流浪种子商……）：还没处理的那一件
  easeCampEvent() {
    const ev = this.c?.event;
    return ev && !ev.done && CAMP_EVENTS[ev.type] ? CAMP_EVENTS[ev.type] : null;
  }
  // 现在画不画这一格：旧档都画；新档画开头就有的、出现过的、现在用得上的
  easeMenuVisible(id) {
    if (!this.easeFresh() || MENU_ALWAYS.includes(id)) return true;
    return this.ez.shown.includes("menu:" + id) || this.easeMenuUsable(id);
  }
  easeMenus() {
    return MENU_IDS.filter((id) => this.easeMenuVisible(id));
  }
  // 菜单最上面一行的士气：营地里有人以后才出现
  easeMoraleVisible() {
    if (!this.easeFresh()) return true;
    return this.ez.shown.includes("stat:morale") || this.easeCampPeople() > 0;
  }
  // 主线这一步在不在农场外面（要出门了，地图就用得上了）
  easeGuideOutside() {
    try {
      const t = this.storyGoal?.()?.step?.target;
      return !!t && !!t.region && t.region !== "farm";
    } catch {
      return false;
    }
  }
  // 建造页上的设施（没研究出来的、拆掉不再建的、并进摆件那一格的不算）
  easeBuildable() {
    return Object.entries(BUILDINGS)
      .filter(([id, b]) => !b.retired && !(b.tech && !this.c?.technologies?.[b.tech]) && !DECOR.includes(id))
      .map(([id]) => id);
  }

  // ================= 小卡 =================
  easePush(card) {
    if (!card || !this.ez?.cards || this._ezq.length >= CARD_QUEUE) return false;
    this._ezq.push(card);
    return true;
  }
  easeNextCard() {
    return this._ezq.shift() || null;
  }
  easeQueued() {
    return this._ezq.slice();
  }
  easeCards(on) {
    if (!this.ez) return false;
    this.ez.cards = !!on;
    if (!on) this._ezq.length = 0;
    return true;
  }
  // 场景里一样东西记成哪一种（同一种只说一次；人一个人一张）
  easeKey(o) {
    if (!o) return "";
    if (o.type === "building") return o.building?.type && BUILDINGS[o.building.type] ? "b:" + o.building.type : "";
    if (PERSON_TYPES.includes(o.type)) return "p:" + String(o.id ?? o.name ?? o.type).slice(0, 40);
    if (o.type === "plot") return "plot";
    return OBJ_CARD[o.type] ? o.type : "";
  }
  easeCardFor(o, key) {
    let name = "";
    try {
      name = this.simpleName?.(o) || "";
    } catch {
      name = "";
    }
    name = name || o.name || "";
    let does = "",
      good = "";
    if (o.type === "building") {
      const d = BUILDINGS[o.building.type];
      [does, good] = BCARD[o.building.type] || [d?.desc || d?.name || "", ""];
      name = name || d?.name || "";
    } else if (PERSON_TYPES.includes(o.type)) [does, good] = PERSON_CARD;
    else [does, good] = OBJ_CARD[key === "plot" ? "plot" : o.type] || ["", ""];
    let verb = "";
    try {
      verb = String(this.simpleLabel?.(o) || "").split(" · ")[1] || "";
    } catch {
      verb = "";
    }
    return { key, tag: CARD_TAG.seen, name: name || "这样东西", does, good, now: verb ? CARD_NOW.near(verb) : "" };
  }
  // 第一次走近一样东西（交互圈套着它、头上写着它的那一刻）：记下来，开着小卡就排一张
  easeLook() {
    if (!this.easeFresh() || this.paused) return null;
    let o = null;
    try {
      o = this.nearestObject?.();
    } catch {
      o = null;
    }
    const key = this.easeKey(o);
    if (!key || this.ez.seen.includes(key)) return null;
    const card = this.easeCardFor(o, key);
    if (this.ez.cards && !this.easePush(card)) return null;
    if (this.ez.seen.length >= CAP.seen) this.ez.seen.shift();
    this.ez.seen.push(key);
    return this.ez.cards ? card : null;
  }
  // 每秒看一眼：第一次建得起的设施、新出现的菜单格和士气、前三天的早上
  easeTick() {
    if (!this.easeFresh()) return [];
    const z = this.ez,
      out = [],
      add = (card) => {
        if (this.easePush(card)) out.push(card);
      };
    // 开局那一下：建得起的、用得上的都先记下，不弹
    const init = !z.buildInit;
    for (const id of this.easeBuildable()) {
      if (z.built.includes(id)) continue;
      if (z.built.length >= CAP.built) break;
      if (!this.afford?.(BUILDINGS[id].cost || {})) continue;
      if (!init) {
        const [does, good] = BCARD[id] || [BUILDINGS[id]?.desc || "", ""];
        const card = { key: "build:" + id, tag: CARD_TAG.build, name: BUILDINGS[id].name, does, good, now: CARD_NOW.build };
        if (z.cards && !this.easePush(card)) continue;
        if (z.cards) out.push(card);
      }
      z.built.push(id);
    }
    z.buildInit = true;
    MENU_IDS.forEach((id, i) => {
      if (MENU_ALWAYS.includes(id) || z.shown.includes("menu:" + id) || z.shown.length >= CAP.shown || !this.easeMenuUsable(id)) return;
      z.shown.push("menu:" + id);
      if (!init) add({ key: "menu:" + id, tag: CARD_TAG.menu, name: MENUS[i]?.[0] || id, does: MENU_FRESH[id]?.[1] || MENUS[i]?.[1] || "", good: "", now: CARD_NOW.menu });
    });
    if (!z.shown.includes("stat:morale") && this.easeCampPeople() > 0 && z.shown.length < CAP.shown) {
      z.shown.push("stat:morale");
      if (!init) add({ key: "stat:morale", tag: CARD_TAG.stat, name: MORALE_CARD[0], does: MORALE_CARD[1], good: MORALE_CARD[2], now: "" });
    }
    // 第 2、3 天早上：今天先做什么
    const day = this.s.day;
    if (day >= 2 && day <= GUIDE_DAYS && this.s.minute >= 6 * 60 && !z.mornings.includes(day) && !this.paused) {
      const g = this.easeGuide(),
        tip = GUIDE.tip[day] || "";
      const card = { key: "day:" + day, tag: CARD_TAG.day, name: GUIDE.day(day), does: g ? GUIDE.morning(g) : tip, good: g ? tip : "", now: g ? GUIDE.where(g) : "" };
      if (!z.cards || this.easePush(card)) {
        z.mornings.push(day);
        if (z.cards) out.push(card);
      }
    }
    return out;
  }

  // ================= 前三天的引导 =================
  // 主线这一步（新档前三天）：第 2、3 天早上的小卡上写着
  easeGuide() {
    if (!this.easeFresh() || this.s.day > GUIDE_DAYS) return null;
    let g = null;
    try {
      g = this.storyGoal?.();
    } catch {
      g = null;
    }
    const st = g?.step;
    if (!st?.title) return null;
    return { id: st.id, title: st.title, text: st.text || "", target: st.target || null, index: g.index, total: g.total, act: g.actName || "" };
  }
  // ================= 提示 =================
  // 说错了的几条提示（指着早就不在的“右下角营地消息”、坏天气前一天还叫你盖布）：改过来再说（所有的档）
  toast(text, tone) {
    return super.toast(easeSay(text), tone);
  }
  olog(text, tone) {
    return super.olog(easeSay(text), tone);
  }
  // 每日抉择的结果：“居民疲劳”“农田肥力”那一行不再写（照样算，这两样 v0.42 就不起作用了）
  applyOp(op, ctx, tier, roll) {
    const line = super.applyOp(op, ctx, tier, roll);
    return Array.isArray(op) && DAILY_QUIET.includes(op[0]) ? "" : line;
  }

  // ================= 存档 =================
  static parse(text) {
    // 下面几层读档时已经各自过了一遍：这里只管上手这一块
    const s = TrimEngine.parse(text);
    easeMigrate(s);
    validateEase(s.ease);
    return s;
  }
}
