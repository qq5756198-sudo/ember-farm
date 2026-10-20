// v0.30.0「人情」：星露谷 30 个好玩点移植方案第二版（人和人之间）。
// 1. 门缝里的纸条；2. 送礼要猜；3. 心里话（八个人各三段）；4. 节庆聚在火边（灯火夜点路灯、换种集换种子、守夜纪念日念名字）；
// 5. 搭伙过日子、收留孩子；6. 各有各的一天（人物关系页写这会儿在哪）；7. 麦穗叼物；8. 收线钓鱼（四处水、24 种鱼）；9. 商队稀罕货。
// 新进度放在 s.kin，原来的字段不动。
import {
  Engine as AlmanacEngine,
  freshState as almanacFresh,
  migrateState as almanacMigrate,
  newGameState as almanacNewGame,
  newGamePlusState as almanacNewGamePlus,
  needsUpgrade as almanacNeedsUpgrade,
  legacyGear,
} from "./almanac.js";
import { hashOf, rngOf } from "./undertow.js";
import { ITEMS, CROPS, ZOMBIES, WORLD, BUILDINGS } from "./data.js";
import { SNPCS, SSPOTS } from "./seasons-data.js";
import { WSPOTS } from "./winter-data.js";
import { SPOTS, NPCS } from "./outpost-data.js";
import { PROWL } from "./undertow-data.js";
import { DECOR, decorItem, seasonOf, RAINY, CROP_SEASON, DISHES, DISH_IDS } from "./almanac-data.js";
import {
  KIN_SCHEMA,
  ta,
  HEART_IDS,
  HEART_AT,
  PARTNER_IDS,
  HEART_SPOTS,
  HOURS,
  GIFT,
  TALK_RULES,
  GIFT_TYPES,
  giftBase,
  KEEPSAKES,
  KEEP_IDS,
  KEEP_RULES,
  prefsOf,
  legacyLikes,
  REQUESTS,
  SKILLS,
  SKILL_OF,
  SKILL_RULES,
  NOTE,
  NOTE_ITEMS,
  LAMPS,
  FEST2,
  PLAZA,
  GATE,
  PARTNER,
  BREAKFAST,
  KIDS,
  KID_LODGERS,
  KID_NAMES,
  KID_CRAFTS,
  DOG_FETCH,
  WATERS,
  WATER_IDS,
  TIERS,
  REEL,
  FISH,
  FISH_IDS,
  BAG,
  SAMPLES,
  RARE_SLOT,
} from "./kin-data.js";
import { HEARTS, PARTNER_LINES, BREAKFAST_LINES, FEST_LINES, VIGIL_NAMES, REACTIONS, NOTE_OPEN, KID_LINES } from "./kin-story.js";

export { legacyGear };
// 读进来之前原样留一份：v0.29 及更早的存档（没有人情的记录）也算
export const needsUpgrade = (text) => {
  if (almanacNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !raw.kin;
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
const inHours = (m, [a, b]) => (a <= b ? m >= a && m < b : m >= a || m < b);
const BASIC_SEEDS = ["seedRadish", "seedPotato", "seedTomato", "seedBean", "seedCorn", "seedPumpkin", "seedHerb", "seedCotton"];
const STAT_KEYS = ["gifts", "favs", "hates", "reveals", "hearts", "skills", "notes", "chats", "lamps", "swaps", "readings", "partnered", "breakfasts", "helps", "allyKills", "kids", "kidHelps", "dogFetch", "reels", "breaks", "escapes", "bags", "rare", "keepsakes", "samples", "research"];
// 地图上代表一个人的东西 → 这个人是谁
const OBJ_PERSON = {
  seasonJiang: "jiang",
  hnJiang: "jiang",
  outpostCaravan: "tangjiu",
  winterGe: "ge",
  winterAlan: "alan",
  winterMuseum: "suyan",
  winterAmo: "amo",
  seasonAdou: "adou",
  seasonAli: "ali",
  seasonHe: "he",
  outpostLathe: "youke",
};

const kinDefaults = () => ({
  schema: KIN_SCHEMA,
  // 知道了的喜好：人 → { 物品: fav / like / meh / hate }
  know: {},
  // 最近送礼的日子（每人最多记 2 个）
  gifts: {},
  // 信任 5 以上，攒着的半格
  half: {},
  // 营火夜谈上次因为聊天长信任的日子
  talked: {},
  // 订单板：上次因为交单子算了一份心意的日子（每人 7 天一回）
  ordered: {},
  // 心里话：人 → { seg 说到第几段, pick 每段选的哪句, req 0 没托 / 1 托了, got 东西拿到没有 }
  heart: {},
  // 学会的本事
  skills: [],
  // 门缝纸条：人 → 上次塞纸条的日子；今天塞了几张；最近的纸条
  notes: {},
  noteDay: { day: 0, n: 0 },
  noteLog: [],
  // 节庆：今天聊过的人、点亮的路灯、换过种子、念过名字
  fest: { day: 0, chat: [], lamps: [], swap: false, read: false, table: [] },
  // 搭伙的人：{ id, stage: near / set / home, day, hurt }
  partner: null,
  // 收留的孩子；在门口等你答复的
  kids: [],
  ask: null,
  // 许医生验过的水；研究过的变异鱼；钓上来过的鱼
  waters: { river: false, sea: false },
  research: [],
  fish: {},
  // 正在哪处水里抛着竿
  cast: null,
  // 麦穗上次叼东西回来的日子；早上的几件事（念账用）
  dog: 0,
  morning: { day: 0, notes: [], dog: "", breakfast: "" },
  // 秦奶奶坐渡船走了以后几天又回来
  qin: { left: 0, back: 0 },
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
});

export function migrateState(s) {
  almanacMigrate(s);
  if (!s.kin) {
    s.kin = kinDefaults();
    // 旧档：原来人物页上写着的两样“喜欢”算已经知道了；进游戏时说一声这一版的变化（新开的档在下面删掉）
    for (const id of Object.keys({ ...PREFS_KEYS() })) {
      const likes = legacyLikes(id);
      if (!likes.length) continue;
      const P = prefsOf(id);
      s.kin.know[id] = Object.fromEntries(likes.map((x) => [x, P.fav.includes(x) ? "fav" : P.like.includes(x) ? "like" : P.hate.includes(x) ? "hate" : "meh"]));
    }
    s.kin.intro = { day: s.day || 1, told: false };
  } else {
    const d = kinDefaults(),
      x = s.kin;
    s.kin = {
      ...d,
      ...x,
      know: Object.fromEntries(Object.entries(x.know || {}).map(([k, v]) => [k, { ...v }])),
      gifts: Object.fromEntries(Object.entries(x.gifts || {}).map(([k, v]) => [k, [...v]])),
      half: { ...x.half },
      talked: { ...x.talked },
      ordered: { ...x.ordered },
      heart: Object.fromEntries(Object.entries(x.heart || {}).map(([k, v]) => [k, { ...v, pick: [...(v.pick || [])] }])),
      skills: [...(x.skills || [])],
      notes: { ...x.notes },
      noteDay: { ...d.noteDay, ...x.noteDay },
      noteLog: (x.noteLog || []).map((n) => ({ ...n })),
      fest: { ...d.fest, ...x.fest, chat: [...(x.fest?.chat || [])], lamps: [...(x.fest?.lamps || [])], table: [...(x.fest?.table || [])] },
      partner: x.partner ? { ...x.partner } : null,
      kids: (x.kids || []).map((k) => ({ ...k })),
      ask: x.ask ? { ...x.ask } : null,
      waters: { ...d.waters, ...x.waters },
      research: [...(x.research || [])],
      fish: { ...x.fish },
      cast: x.cast ? { ...x.cast } : null,
      morning: { ...d.morning, ...x.morning, notes: [...(x.morning?.notes || [])] },
      qin: { ...d.qin, ...x.qin },
      stats: { ...d.stats, ...x.stats },
    };
    if (x.intro) s.kin.intro = { ...x.intro };
  }
  return s;
}
// 旧档里原来写着喜欢什么的那些人
function PREFS_KEYS() {
  return Object.fromEntries([...Object.keys(SNPCS), "farmer", "medic", "mechanic", "tieqiao", "tangjiu", "youke", "huer", "yaozi", "zou", "ge", "alan", "amo", "yeying", "suyan"].map((k) => [k, 1]));
}
const fresh = (s) => {
  delete s.kin;
  migrateState(s);
  delete s.kin.intro;
  s.kin.know = {};
  return s;
};
export function freshState() {
  return fresh(almanacFresh());
}
export function newGameState(origin = "farmer") {
  return fresh(almanacNewGame(origin));
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  return fresh(almanacNewGamePlus(old, origin, keep, book));
}

export class Engine extends AlmanacEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this._reel = null;
    this._kinAlly = null;
    this._kidPos = {};
    this._npcPos = {};
  }
  get kin() {
    return this.s.kin;
  }
  kinRoll(...key) {
    return rngOf(hashOf(this.ut?.seed ?? 1, "kin", ...key))();
  }
  kinStat(k, n = 1) {
    if (this.kin) this.kin.stats[k] = (this.kin.stats[k] || 0) + n;
  }
  kinLog(text, tone = "normal") {
    if (this.o) this.olog(text, tone);
  }
  hasSkill(id) {
    return !!this.kin?.skills.includes(id);
  }

  // ================= 人在哪 =================
  knownIds() {
    return this.people().map((p) => p.id);
  }
  knownPerson(id) {
    return this.people().some((p) => p.id === id);
  }
  kinName(id) {
    if (id === "cartographer") return "柏岚";
    return this.people().find((p) => p.id === id)?.name || SNPCS[id]?.name || NPCS[id]?.name || this.o?.crew.find((c) => c.id === id)?.name || id;
  }
  // 地图上这个东西代表谁
  personOf(o) {
    if (!o) return null;
    if (o.type === "resident") return o.resident;
    if (o.type === "allianceHelper") return o.helper || null;
    if (o.type === "kinPerson") return o.who;
    if (o.type === "seasonLodger") return this.ss?.qin.phase === "staying" && !this.ss.lodger ? "qin" : null;
    if (o.type === "seasonHe") return "he";
    return OBJ_PERSON[o.type] || null;
  }
  fireRing(i = 0) {
    const f = this.fireSpot?.();
    if (!f) return null;
    const a = -Math.PI / 2 + i * 0.95;
    return { x: Math.round(f.x + Math.cos(a) * 46), y: Math.round(f.y + 18 + Math.sin(a) * 30) };
  }
  ringAt(c, i, r = c.r || 60) {
    const a = i * 0.83 + 0.4;
    return { x: Math.round(c.x + Math.cos(a) * r), y: Math.round(c.y + Math.sin(a) * r * 0.6 + 12) };
  }
  evening() {
    return inHours(this.s.minute, HOURS.evening);
  }
  rainyNow() {
    return RAINY.includes(this.s.weather);
  }
  festNow() {
    return !!this.festivalWindow?.() && this.s.region === "farm";
  }
  sandbagDay(day = this.s.day) {
    const h = this.c?.nextHordeDay;
    return !!h && h === day + 1 && !["warning", "active"].includes(this.s.horde?.phase);
  }
  sandbagNow() {
    return this.sandbagDay() && inHours(this.s.minute, HOURS.sandbag);
  }
  // 这一晚平不平安（心里话只在平安的晚上说）
  kinCalmReason() {
    if (this.isLongNight?.(this.s.day) || this.ln?.night) return "今晚是长夜";
    if (["warning", "active"].includes(this.s.horde?.phase)) return "尸潮要来了";
    const r = this.raidState?.();
    if (r && ["warning", "active"].includes(r.phase)) return "灰隼团来了";
    if (this.underAttack?.()) return "外面在打";
    if (this.hn?.noise && this.noiseTier?.(this.hn.noise.v)) return "营地太吵，今晚怕是不太平";
    if (this.bt?.raid && this.bt.raid.day === this.s.day && ["warned", "live"].includes(this.bt.raid.state)) return "今晚有人盯着菜地";
    return "";
  }
  kinCalm() {
    return !this.kinCalmReason();
  }
  // 何大勺（入伙后）、老琴、回来的秦奶奶：一天里在哪
  npcSpot(id) {
    const m = this.s.minute,
      fire = this.fireRing(id === "laoqin" ? 3 : 4);
    if (id === "he") {
      if (!(this.ss?.he.stage >= 4)) return null;
      if (m < 6 * 60 || m >= 22 * 60) return { away: true, label: "睡下了" };
      if (this.festNow()) return { ...this.ringAt(PLAZA, 1), region: "farm", label: "前哨广场" };
      if (this.sandbagNow()) return { ...this.ringAt(GATE, 5, 54), region: "farm", label: "营门（垒沙袋）" };
      if (inHours(m, [11 * 60, 14 * 60])) return { x: 1210, y: 506, region: "farm", label: "饭桌边" };
      return { ...HEART_SPOTS.he, region: "farm" };
    }
    if (id === "laoqin") {
      if (!this.ss?.laoqin.met) return null;
      if (this.festNow()) return { x: 1336, y: 478, region: "farm", label: "前哨广场", plaza: true };
      if (inHours(m, [9 * 60, 18 * 60])) return { x: 1190, y: 424, region: "farm", label: "通信站边（帮电台录歌）" };
      if (inHours(m, [19 * 60, 23 * 60]) && fire) return { ...fire, region: "farm", label: "营火边" };
      return { away: true, label: m < 9 * 60 ? "还没过来" : "回窝棚了" };
    }
    if (id === "qin") {
      const q = this.ss?.qin;
      if (!q) return null;
      const back = q.phase === "left" && this.kin?.qin.back;
      if (q.phase === "left" && !back) return { away: true, label: "坐渡船去找女儿了" };
      if (q.phase !== "staying" && !back) return null;
      if (m < 6 * 60 || m >= 23 * 60) return { away: true, label: "在农舍里睡了" };
      if (this.festNow()) return { ...this.ringAt(PLAZA, 2), region: "farm", label: "前哨广场" };
      if (this.rainyNow()) return { x: 330, y: 330, region: "farm", label: "农舍檐下" };
      return { ...HEART_SPOTS.qin, region: "farm" };
    }
    return null;
  }
  // 这会儿大概在哪：{ region, x, y, label } 或 { away, label }
  whereNow(id) {
    const s = this.s;
    const r = this.c?.residents.find((x) => x.id === id);
    if (r) {
      if (this.d?.workers?.[id] || this.b?.workers?.[id]) return { away: true, label: "派出去干活了" };
      return { region: "farm", x: r.x, y: r.y, label: this.placeLabel(r) };
    }
    const cr = this.o?.crew.find((x) => x.id === id);
    if (cr) {
      if (cr.task === "scout" && s.minute >= 8 * 60 && s.minute < 16 * 60) return { away: true, label: "出去探路了" };
      return { region: "farm", x: cr.x, y: cr.y, label: this.placeLabel(cr) };
    }
    const h = (this.sc?.helpers || []).find((x) => x.id === id);
    if (h) return { region: "farm", x: h.x, y: h.y, label: this.placeLabel(h) };
    const npc = this.npcSpot(id);
    if (npc) return npc;
    if (id === "jiang") {
      const j = this.ss?.jiang;
      if (!j || j.phase === "none" || (j.phase === "done" && !this.jiangStays?.())) return { away: true, label: "不在" };
      if (s.minute < 6 * 60 || s.minute >= 23 * 60) return { away: true, label: "回窝棚睡了" };
      return { region: "farm", x: 960, y: 748, label: "池塘边" };
    }
    if (id === "tangjiu") return this.caravanHere?.() ? { region: "farm", x: SPOTS.caravan.x + 72, y: SPOTS.caravan.y + 12, label: "商队的车边" } : { away: true, label: this.o?.caravan.next ? "跑商路去了（第 " + this.o.caravan.next + " 天来）" : "跑商路去了" };
    if (id === "ge") return { region: "farm", ...WSPOTS.ge, label: "营地东南" };
    if (id === "alan") return this.w?.alan.phase === "left" ? { away: true, label: "赶着羊走了" } : { region: "farm", ...WSPOTS.alan, label: "营地东北的羊圈边" };
    if (id === "suyan") return { region: "farm", ...WSPOTS.museum, label: "档案馆" };
    if (id === "amo") return { region: "shelter", x: WSPOTS.amo.x, y: WSPOTS.amo.y, label: "地底避难城" };
    if (id === "yeying") return this.r?.radio ? { region: "farm", x: 1220, y: 390, label: "电台里（站到通信站边托电台捎话）" } : { away: true, label: "电台没修好，联系不上" };
    if (id === "adou") return this.adouVisible?.() ? { region: "farm", x: SSPOTS.adou.x, y: SSPOTS.adou.y, label: "仓库箱边" } : { away: true, label: "不在营地" };
    if (id === "ali") return { region: "farm", x: 300, y: 742, label: "南边围栏" };
    return { away: true, label: "不知道在哪" };
  }
  placeLabel(p) {
    const at = (q, r = 60) => q && dist(p, q) <= r;
    // 站在自己常待的那处（阿禾的田边、许医生的诊所门口……）就说那处
    const own = p?.id && HEART_SPOTS[p.id];
    if (own && !own.fire && at(own, 40)) return own.label;
    if (at(this.fireSpot?.(), 90)) return "营火边";
    if (at(PLAZA, 110)) return "前哨广场";
    if (at(GATE, 90)) return "营门";
    if (at({ x: 960, y: 748 }, 90)) return "池塘边";
    // 居民那一排住处（755、820、885…，y 350）先认，免得第一张床算成诊所
    if (p.y >= 325 && p.y <= 378 && p.x >= 735 && p.x <= 1000) return "住处";
    if (at({ x: 695, y: 345 }, 45)) return "诊所";
    if (at({ x: 1095, y: 450 }, 70)) return "机床边";
    if (p.y < 380 && p.x > 700 && p.x < 1000) return "住处";
    if (p.x > 260 && p.x < 720 && p.y > 390 && p.y < 570) return "田里";
    if (/塔/.test(p.status || "")) return "瞭望塔上";
    if (/休息|睡/.test(p.status || "")) return "屋里歇着";
    return "营地里";
  }
  // 走到他跟前（同一张图、170 步内）
  personNear(id, r = GIFT.near) {
    const w = this.whereNow(id);
    return !w.away && w.region === this.s.region && dist(this.s.player, w) <= r;
  }

  // ================= 喜好 =================
  giftable(item) {
    const it = ITEMS[item];
    // 种子都标着“随身保管”（不进仓库、不卖），但送人可以；别的受保护的东西（任务物品、水样、变异鱼）不行
    return !!it && GIFT_TYPES.includes(it.type) && (!it.protected || it.type === "seed") && !item.startsWith("bp_") && !item.startsWith("manual");
  }
  prefCat(id, item) {
    const base = giftBase(item),
      P = prefsOf(id);
    if (P.fav.includes(item) || P.fav.includes(base)) return "fav";
    if (P.like.includes(item) || P.like.includes(base)) return "like";
    if (P.hate.includes(item) || P.hate.includes(base)) return "hate";
    return "meh";
  }
  // 送出去长多少：最爱 +2、喜欢 +1（上品的喜欢也算 +2）、一般 0、讨厌 −1
  giftValue(id, item) {
    const cat = this.prefCat(id, item);
    let n = GIFT[cat];
    if (cat === "like" && String(item).startsWith("prime_")) n = GIFT.fav;
    return { cat, n };
  }
  prefKnown(id) {
    return this.kin?.know[id] || {};
  }
  // 还不知道的那几样（按最爱、喜欢、讨厌）
  unknownPrefs(id) {
    const P = prefsOf(id),
      k = this.prefKnown(id);
    return [...P.fav.map((x) => [x, "fav"]), ...P.like.map((x) => [x, "like"]), ...P.hate.map((x) => [x, "hate"])].filter(([x]) => !k[x]);
  }
  // 解开一样：item 给了就解开那一样；没给就从还不知道的里挑一样（按存档种子定）
  reveal(id, item = null, salt = "") {
    if (!this.kin || !id) return null;
    let pick = null;
    if (item) pick = [giftBase(item), this.prefCat(id, item)];
    else {
      const left = this.unknownPrefs(id);
      if (!left.length) return null;
      pick = left[Math.floor(this.kinRoll("rev", id, this.s.day, salt, left.length) * left.length) % left.length];
    }
    const [x, cat] = pick,
      k = (this.kin.know[id] ??= {});
    if (k[x] === cat) return null;
    k[x] = cat;
    this.kinStat("reveals");
    return { item: x, cat };
  }
  revealText(id, r) {
    if (!r) return "";
    return this.kinName(id) + (r.cat === "fav" ? "最爱" : r.cat === "like" ? "喜欢" : r.cat === "hate" ? "讨厌" : "不太在乎") + ITEMS[r.item]?.name;
  }
  // 妙手：手伸过去之前瞄一眼他的口袋，看得出一样他喜欢什么、讨厌什么（每人每天只能试一回，所以一天最多解开一样）
  beginSteal(opts = {}) {
    const st = super.beginSteal(opts);
    const id = opts.trust;
    if (!this.kin || !st || opts.practice || opts.box || st.phase !== "pick" || !id || !this.knownPerson(id)) return st;
    const r = this.reveal(id, null, "pocket");
    if (r) {
      const text = "瞄了一眼口袋：" + this.revealText(id, r) + "。";
      st.lines = [...(st.lines || []), text];
      this.toast(text, "gold");
    }
    return st;
  }
  // 旧代码问“他喜欢什么”：答已经知道的最爱和喜欢
  likes(id) {
    if (!this.kin) return super.likes(id);
    const k = this.prefKnown(id);
    return Object.keys(k).filter((x) => (k[x] === "fav" || k[x] === "like") && ITEMS[x]);
  }

  // ================= 信任 =================
  // 送礼、营火夜谈的信任：信任 5 以上每份心意只长半格（两份长一格）；减的照减
  kinTrust(id, n, slow = true) {
    const t = this.ss?.trust;
    if (!t || !n) return 0;
    const before = t[id] || 0;
    if (n < 0) {
      t[id] = clamp(before + n, 0, 10);
      delete this.kin.half[id];
      return t[id] - before;
    }
    for (let i = 0; i < n; i++) {
      const v = t[id] || 0;
      if (v >= 10) break;
      const need = slow ? this.trustNeed(v) : 1;
      if (need > 1) {
        const h = (this.kin.half[id] || 0) + 1;
        if (h >= need) {
          delete this.kin.half[id];
          t[id] = v + 1;
        } else this.kin.half[id] = h;
      } else t[id] = v + 1;
    }
    return (t[id] || 0) - before;
  }
  addTrust(id, n) {
    // 订单板交单子：算一份心意（5 以上两份一格、8 以上三份），每人 7 天只算一回
    if (this.kin && this._kinOrder === id && n > 0) {
      if (this.orderTrustWait(id)) return;
      this.kin.ordered[id] = this.s.day;
      return void this.kinTrust(id, n, true);
    }
    if (this.kin && this._kinTalk && n > 0) {
      // 营火夜谈：每人 10 天里只长一次
      const last = this.kin.talked[id] ?? -99;
      if (this.s.day - last < TALK_RULES.cd) return;
      this.kin.talked[id] = this.s.day;
      this._kinTalkHit?.push(id);
      return void this.kinTrust(id, n, true);
    }
    return super.addTrust(id, n);
  }
  // 订单板上这个人的单子还要几天才再算心意（0 = 这回算）
  orderTrustWait(id) {
    const last = this.kin?.ordered[id];
    return last == null ? 0 : Math.max(0, last + GIFT.window - this.s.day);
  }
  deliverBoardOrder(id) {
    const o = this.bt?.orders.list.find((x) => x.id === id);
    this._kinOrder = o?.who || null;
    try {
      return super.deliverBoardOrder(id);
    } finally {
      this._kinOrder = null;
    }
  }
  // 长一格要几份心意：5 以下 1 份，5 到 8 两份，8 以上三份
  trustNeed(v) {
    return v >= GIFT.slow3 ? 3 : v >= GIFT.slowFrom ? 2 : 1;
  }
  // 攒着的那一点：{ have, need }（没有就是 null）
  trustPart(id) {
    const h = this.kin?.half[id] || 0;
    return h ? { have: h, need: this.trustNeed(this.ss?.trust[id] || 0) } : null;
  }
  trustHalf(id) {
    return !!this.kin?.half[id];
  }

  // ================= 送礼 =================
  giftsIn(id, day = this.s.day) {
    return (this.kin?.gifts[id] || []).filter((d) => day - d < GIFT.window);
  }
  giftNextDay(id) {
    const g = this.giftsIn(id);
    return g.length < GIFT.per ? this.s.day : Math.min(...g) + GIFT.window;
  }
  giftReason(id, item) {
    if (!this.kin) return super.giftReason(id, item);
    if (!this.knownPerson(id)) return "还不认识";
    if (!this.giftable(item)) return "这样东西送不出手";
    if (this.qty(item, true) < 1) return "没有" + (ITEMS[item]?.name || item);
    // 第二段心里话托你找的那样东西：不当普通礼物送，傍晚到他常待的地方交给他（第三段）
    if (this.heart(id).seg === 2 && REQUESTS[id]?.item === giftBase(item)) return "这是" + ta(id) + "托你找的，傍晚去" + this.heartSpotLabel(id) + "交给" + ta(id);
    if (this.giftsIn(id).length >= GIFT.per) return "这 7 天送过 " + GIFT.per + " 次了（第 " + this.giftNextDay(id) + " 天能再送）";
    if (!this.personNear(id)) {
      const w = this.whereNow(id);
      return w.away ? ta(id) + "这会儿" + w.label : "走到" + ta(id) + "跟前再送（这会儿在：" + (w.region !== this.s.region ? this.regionName(w.region) + " · " : "") + w.label + "）";
    }
    return "";
  }
  giveGift(id, item) {
    if (!this.kin) return super.giveGift(id, item);
    if (PARTNER.gifts.includes(item)) return this.partnerGive(id, item);
    const reason = this.giftReason(id, item);
    if (reason || !this.takeFarm({ [item]: 1 })) {
      this.toast((reason || "送不出去") + "。", "warn");
      return false;
    }
    const { cat, n: base } = this.giftValue(id, item),
      bday = this.birthday(id) && base > 0,
      n = bday ? base * GIFT.bday : base;
    const was = this.prefKnown(id)[giftBase(item)];
    this.reveal(id, item);
    const g = (this.kin.gifts[id] = [...this.giftsIn(id), this.s.day].slice(-GIFT.per));
    this.ss.gifts[id] = this.s.day;
    const got = this.kinTrust(id, n, true);
    const r = this.resident(id);
    if (r && n > 0) r.morale = clamp((r.morale ?? 60) + GIFT.mood, 0, 100);
    this.kinStat("gifts");
    if (cat === "fav") this.kinStat("favs");
    if (cat === "hate") this.kinStat("hates");
    const name = this.kinName(id),
      lines = REACTIONS[cat],
      line = lines[Math.floor(this.kinRoll("react", id, this.s.day, g.length) * lines.length) % lines.length];
    const part = this.trustPart(id),
      trust = n > 0 ? (got > 0 ? "信任 +" + got : part ? "信任长了一点（这一格 " + part.have + "/" + part.need + "）" : "信任满了") : n < 0 ? "信任 " + n : "信任没变";
    const fresh = !was ? "（知道了：" + this.revealText(id, { item: giftBase(item), cat }) + "）" : "";
    this.toast("送给" + name + "一份" + ITEMS[item].name + "：" + name + line + (bday ? "今天是" + ta(id) + "的生日！" : "") + trust + "。" + fresh, cat === "hate" ? "warn" : "gold");
    return true;
  }
  // 人物页上：送什么（知道是最爱、喜欢的排前面，再挑几样还不知道他喜不喜欢的试试）
  giftOptions(id, max = 4) {
    const k = this.prefKnown(id),
      have = new Set([...Object.keys(this.s.inventory || {}), ...Object.keys(this.s.storage || {})].filter((x) => this.qty(x, true) > 0 && this.giftable(x)));
    const asked = this.heart(id).seg === 2 ? REQUESTS[id]?.item : null;
    if (asked) have.delete(asked);
    const known = [...have].filter((x) => ["fav", "like"].includes(k[giftBase(x)])).sort((a, b) => (k[giftBase(b)] === "fav") - (k[giftBase(a)] === "fav") || (ITEMS[b].sell || 0) - (ITEMS[a].sell || 0));
    const tries = [...have]
      .filter((x) => !k[giftBase(x)])
      .sort((a, b) => (ITEMS[b].sell || 0) - (ITEMS[a].sell || 0) || a.localeCompare(b))
      .slice(0, max);
    return { known: known.slice(0, 6), tries };
  }

  // ================= 营火夜谈 =================
  talk(topic) {
    if (!this.kin) return super.talk(topic);
    const kind = String(topic).split(":")[0];
    const people = this.talkPeople?.() || [];
    this._kinTalk = true;
    this._kinTalkHit = [];
    let ok = false;
    try {
      ok = super.talk(topic);
    } finally {
      this._kinTalk = false;
    }
    if (!ok) return ok;
    const extra = [];
    if (kind === "past") {
      const learned = people.map((p) => [p.id, this.reveal(p.id, null, "talk")]).filter(([, r]) => r);
      if (learned.length) extra.push("说起以前，" + learned.map(([pid, r]) => this.revealText(pid, r)).join("，"));
      const skip = people.filter((p) => !this._kinTalkHit.includes(p.id)).map((p) => p.name);
      if (skip.length) extra.push(skip.join("、") + "这几天刚聊过，信任这回没长");
    } else if (kind === "comfort" && !this._kinTalkHit.length) extra.push("这几天刚安慰过，信任这回没长");
    if (this.hasSkill("song")) {
      this.residentsMood(SKILL_RULES.song);
      extra.push("老琴起了个头，大家跟着哼（心情 +" + SKILL_RULES.song + "）");
    }
    if (extra.length) this.toast(extra.join("；") + "。", "gold");
    return ok;
  }

  // ================= 心里话 =================
  heart(id) {
    return this.kin?.heart[id] || { seg: 0, pick: [], req: 0, got: false };
  }
  heartNeed(id) {
    const h = this.heart(id);
    return h.seg < 3 ? HEART_AT[h.seg] : null;
  }
  // 现在能不能说下一段；不能的话为什么
  heartReason(id) {
    if (!this.kin || !HEART_IDS.includes(id)) return "没有心里话";
    if (!this.knownPerson(id)) return "还不认识";
    const h = this.heart(id),
      need = this.heartNeed(id);
    if (need === null) return "心里话都说完了";
    const t = this.ss.trust[id] || 0;
    // 托的东西还没带回来：先说这个（信任也不够的话一起说）
    if (h.seg === 2) {
      const it = REQUESTS[id].item;
      if (this.qty(it, true) < 1) return "等你把" + ITEMS[it].name + "带回来" + (t < need ? "（信任也要到 " + need + "，现在 " + t + "）" : "");
    }
    if (t < need) return "信任到 " + need + " 才会说（现在 " + t + "）";
    const vigil = this.vigilTalk();
    if (!vigil && !this.evening()) return "傍晚 19:00 以后，去" + this.heartSpotLabel(id) + "找" + ta(id);
    const calm = this.kinCalmReason();
    if (calm) return calm + "，" + ta(id) + "没心思说这些";
    const w = this.whereNow(id);
    if (w.away) return ta(id) + "这会儿" + w.label;
    return "";
  }
  heartSpotLabel(id) {
    return HEART_SPOTS[id]?.label || "营火边";
  }
  heartSpot(id) {
    const s = HEART_SPOTS[id];
    if (!s) return null;
    if (s.fire) {
      const f = this.fireRing(3);
      return f ? { ...f, label: s.label } : null;
    }
    return s;
  }
  heartReady(id) {
    return !this.heartReason(id);
  }
  // 守夜纪念日念过名字的那一晚：在广场上也说得出口
  vigilTalk() {
    const f = this.kin?.fest;
    return !!f && f.read && f.day === this.s.day && this.festNow();
  }
  heartLines(id) {
    const h = this.heart(id),
      seg = HEARTS[id]?.[h.seg];
    if (!seg) return [];
    const a = (h.pick[0] ?? 0) === 0;
    return seg.lines.map((l) => (typeof l === "string" ? l : a ? l.a : l.b));
  }
  heartPick(id, i = 0) {
    const reason = this.heartReason(id);
    if (reason) {
      this.toast(reason + "。", "warn");
      return null;
    }
    if (!this.personNear(id, 200) && !this._kinBench) {
      this.toast("走到" + ta(id) + "跟前再说。", "warn");
      return null;
    }
    const h = (this.kin.heart[id] ??= { seg: 0, pick: [], req: 0, got: false }),
      seg = HEARTS[id][h.seg],
      name = this.kinName(id),
      out = { title: seg.title, lines: [], seg: h.seg + 1 };
    if (h.seg < 2) {
      const c = seg.choices[clamp(Number(i) || 0, 0, seg.choices.length - 1)];
      h.pick = [...h.pick, Number(i) === 1 ? 1 : 0];
      out.lines.push(c.reply);
      // 说开了也算一份心意（5 以上两份一格，和送礼一样）
      const got = this.kinTrust(id, 1, true);
      out.lines.push(got ? "（信任 +1）" : "（信任长了一点）");
      if (h.seg === 0) {
        const r = this.reveal(id, prefsOf(id).fav[0]);
        if (r) out.lines.push("（知道了：" + this.revealText(id, r) + "）");
      }
      if (h.seg === 1) {
        h.req = 1;
        const q = REQUESTS[id];
        out.lines.push("（去" + this.regionName(q.region) + "找「" + q.name + "」：" + q.hint + "。那里多了一个记号。）");
      }
    } else {
      const q = REQUESTS[id];
      this.takeFarm({ [q.item]: 1 });
      h.req = 0;
      const sk = SKILL_OF[id];
      if (sk && !this.kin.skills.includes(sk)) {
        this.kin.skills.push(sk);
        this.kinStat("skills");
        out.lines.push("（你把" + ITEMS[q.item].name + "交给了" + name + "。学会了「" + SKILLS[sk].name + "」：" + SKILLS[sk].desc + "）");
      }
    }
    h.seg++;
    h.day = this.s.day;
    this.kinStat("hearts");
    this.kinLog("心里话：" + name + "「" + seg.title + "」（" + h.seg + "/3）", "gold");
    if (h.seg === 2 && this.s.region === REQUESTS[id].region) this.assignRegion();
    return out;
  }
  // 第二段托的那件东西：废墟里的那处记号
  cacheTake(id) {
    const h = this.kin?.heart[id],
      q = REQUESTS[id];
    if (!h || h.seg !== 2 || h.got || !q || this.s.region !== q.region) return false;
    h.got = true;
    this.receive({ [q.item]: 1 });
    this.kinStat("keepsakes");
    const text = "在「" + q.name + "」里找到了" + ITEMS[q.item].name + "。回去交给" + this.kinName(id) + "（傍晚去" + this.heartSpotLabel(id) + "找" + ta(id) + "）。";
    this.toast(text, "gold");
    this.kinLog(text, "gold");
    this.emit("loot");
    this.assignRegion();
    return true;
  }
  // 现在谁有话想说（警报栏、人物页用）
  heartWaiting() {
    if (!this.kin) return [];
    return HEART_IDS.filter((id) => this.knownPerson(id) && this.heartReady(id));
  }

  // ================= 门缝里的纸条（06:00） =================
  kinNotes(day) {
    const k = this.kin;
    if (!k || !this.ss) return;
    if (k.noteDay.day !== day) k.noteDay = { day, n: 0 };
    const pool = this.people()
      .map((p) => p.id)
      .filter((id) => (this.ss.trust[id] || 0) >= NOTE.trust && !this.whereNow(id).away && day - (k.notes[id] ?? -99) >= NOTE.every);
    for (const id of pool) {
      if (k.noteDay.n >= NOTE.perDay) break;
      if (this.kinRoll("note", id, day) >= NOTE.chance) continue;
      const text = this.noteText(id, day);
      if (!text) continue;
      k.notes[id] = day;
      k.noteDay.n++;
      k.noteLog = [{ day, from: id, text }, ...k.noteLog].slice(0, NOTE.log);
      k.morning.notes = [...(k.morning.day === day ? k.morning.notes : []), this.kinName(id)];
      k.morning.day = day;
      this.kinStat("notes");
      const open = NOTE_OPEN[Math.floor(this.kinRoll("open", id, day) * NOTE_OPEN.length) % NOTE_OPEN.length];
      this.kinLog(open + "：" + text + "——" + this.kinName(id), "gold");
    }
  }
  noteText(id, day) {
    const x = this.kinRoll("ntype", id, day);
    const hint = () => this.noteHint(id, day);
    if (x < 0.45) return hint() || this.noteItem(id, day);
    if (x < 0.8) return this.noteItem(id, day);
    if (x < 0.9) return this.noteRecipe(id) || hint() || this.noteItem(id, day);
    return this.noteGossip(id, day) || hint() || this.noteItem(id, day);
  }
  noteHint(id, day) {
    const list = [];
    const c = this.c;
    if (c?.nextHordeDay && c.nextHordeDay > day) list.push("尸潮大概第 " + c.nextHordeDay + " 天到，围栏得早点补上。");
    const ln = this.nextLongNight?.(day);
    if (ln && ln > day && ln - day <= 6) list.push("第 " + ln + " 天是长夜，药和弹药备够。");
    const r = this.raidState?.();
    if (r?.phase === "scheduled" && r.day > day) list.push("灰隼团的人在附近转悠，第 " + r.day + " 天前后可能来。");
    const tom = (this.forecast?.() || []).find((d) => d.day === day + 1)?.weather;
    if (tom) list.push("明天" + tom + (RAINY.includes(tom) ? "，废墟里的东西耳朵不灵，好走动。" : "。"));
    if (this.o?.caravan.next && this.o.caravan.next > day) list.push("唐九第 " + this.o.caravan.next + " 天来，有要换的东西先攒着。");
    const f = this.al?.forage;
    if (f?.day === day) {
      const far = f.spots.filter((p) => !p.taken && p.region !== "farm");
      if (far.length) list.push(this.regionName(far[0].region) + "那边今天冒了野物。");
    }
    if (!list.length) return "";
    return list[Math.floor(this.kinRoll("hint", id, day) * list.length) % list.length];
  }
  noteItem(id, day) {
    let b = { ...(NOTE_ITEMS[id] || { bread: 1 }) };
    if (b.seed) {
      const crops = Object.entries(CROP_SEASON)
        .filter(([, [g]]) => g === seasonOf(day).id)
        .map(([c]) => CROPS[c]?.seed)
        .filter((x) => x && ITEMS[x]);
      const seed = crops.length ? crops[Math.floor(this.kinRoll("nseed", id, day) * crops.length) % crops.length] : "seedRadish";
      b = { [seed]: b.seed };
    }
    this.putStorage(b);
    return "“给你留了点" + itemsText(b) + "，放仓库了。”";
  }
  noteRecipe(id) {
    if (!this.al) return "";
    const left = DISH_IDS.filter((x) => !this.al.dishes.includes(x));
    if (!left.length || !(this.ss?.he.stage >= 4)) return "";
    const d = left[0];
    this.al.dishes = [...this.al.dishes, d];
    return "“" + ITEMS[d].name + "的做法我写在背面了，照着做就行。”（学会了" + ITEMS[d].name + "）";
  }
  noteGossip(id, day) {
    const others = this.people()
      .map((p) => p.id)
      .filter((x) => x !== id && this.unknownPrefs(x).some(([, c]) => c === "fav"));
    if (!others.length) return "";
    const who = others[Math.floor(this.kinRoll("gossip", id, day) * others.length) % others.length];
    const fav = this.unknownPrefs(who).find(([, c]) => c === "fav");
    const r = this.reveal(who, fav[0]);
    return r ? "“偷偷告诉你：" + this.revealText(who, r) + "，老念叨。”" : "";
  }

  // ================= 麦穗叼物（06:00） =================
  dogFetch(day) {
    const k = this.kin,
      d = this.fr?.dog;
    if (!k || !d || (d.bond || 0) < DOG_FETCH.bond || k.dog === day || !this.f?.dog?.rescued || !(this.dogHome?.() ?? true)) return;
    if (this.kinRoll("fetch", day) >= DOG_FETCH.chance) return;
    const x = pickW(DOG_FETCH.items, this.kinRoll("fetchw", day));
    let b = null;
    if (x === "seed") {
      const s = BASIC_SEEDS[Math.floor(this.kinRoll("fseed", day) * BASIC_SEEDS.length) % BASIC_SEEDS.length];
      b = { [s]: 1 };
    } else if (x === "decor") {
      const d2 = DECOR[Math.floor(this.kinRoll("fdecor", day) * DECOR.length) % DECOR.length];
      b = { [decorItem(d2.id)]: 1 };
    } else b = { ...x };
    k.dog = day;
    this.putStorage(b);
    this.kinStat("dogFetch");
    k.morning = { ...(k.morning.day === day ? k.morning : { day, notes: [], breakfast: "" }), day, dog: itemsText(b) };
    this.kinLog("麦穗一早叼回来一样东西：" + itemsText(b) + "（放仓库了）。", "gold");
  }

  // ================= 节庆 =================
  festDay() {
    return !!this.festivalsOpen?.() && this.isFestivalDay?.(this.s.day);
  }
  festState() {
    const f = this.kin.fest;
    if (f.day !== this.s.day) Object.assign(f, { day: this.s.day, chat: [], lamps: [], swap: false, read: false, table: [] });
    return f;
  }
  festChatReason(id) {
    if (!this.festNow()) return "节庆 16:00–22:00 才聚在广场";
    if (dist(this.s.player, PLAZA) > FEST2.chatNear) return "到前哨广场再聊";
    if (this.festState().chat.includes(id)) return "今天聊过了";
    return "";
  }
  festChat(id) {
    if (!this.kin || this.festChatReason(id)) return false;
    const f = this.festState(),
      kind = this.festivalKind(this.s.day),
      lines = FEST_LINES[kind] || FEST_LINES.seeds,
      line = lines[Math.floor(this.kinRoll("fest", id, this.s.day) * lines.length) % lines.length];
    f.chat = [...f.chat, id];
    const r = this.resident(id);
    if (r) r.morale = clamp((r.morale ?? 60) + FEST2.chatMood, 0, 100);
    const rev = this.reveal(id, null, "fest");
    this.kinStat("chats");
    this.toast(this.kinName(id) + "：" + line + (r ? "（心情 +" + FEST2.chatMood + "）" : "") + (rev ? "（知道了：" + this.revealText(id, rev) + "）" : ""), "gold");
    return true;
  }
  // 丰收评比：评过的菜摆上长桌（主持完热闹那一层会清掉挑的单子，这里先记下）
  hostFestival() {
    const pick = this.hn?.fest?.day === this.s.day ? [...(this.hn.fest.pick || [])] : [];
    const ok = super.hostFestival();
    if (ok && this.kin && this.festivalKind(this.s.day) === "harvest") this.festState().table = pick.filter((id) => ITEMS[id]).slice(0, 5);
    return ok;
  }
  // 唐九的稀罕货：名字前面写一声
  offerName(f) {
    const n = super.offerName(f);
    return f?.kinRare ? "稀罕货 · " + n : n;
  }
  // 灯火夜的六盏路灯
  lampsOn() {
    return !!this.kin && this.festDay() && this.festivalKind(this.s.day) === "lanterns" && this.s.minute >= 16 * 60;
  }
  lampsFull(day = this.s.day) {
    const f = this.kin?.fest;
    return !!f && f.day === day && f.lamps.length >= LAMPS.length;
  }
  lightLamp(i) {
    if (!this.lampsOn()) return false;
    const f = this.festState();
    if (f.lamps.includes(i)) return false;
    if (this.s.minute >= FEST2.lampsBy) {
      this.toast("过了点灯的时辰（20:00 前点满才管用）。", "warn");
      return false;
    }
    f.lamps = [...f.lamps, i].sort((a, b) => a - b);
    this.kinStat("lamps");
    if (f.lamps.length >= LAMPS.length) {
      const text = "通往营门的六盏路灯全亮了：今晚夜行者不会摸过来。";
      this.toast(text, "gold");
      this.kinLog(text, "gold");
      this.emit("victory");
    } else this.toast("点亮了一盏路灯（" + f.lamps.length + "/" + LAMPS.length + "）。", "gold");
    return true;
  }
  tickProwl() {
    const u = this.ut;
    if (this.kin && u) {
      const m = this.s.minute,
        night = m >= PROWL.from || m < PROWL.to,
        key = m >= PROWL.from ? this.s.day : this.s.day - 1;
      if (night && u.prowl !== key && this.lampsFull(key)) {
        u.prowl = key;
        u.prowlOn = false;
        this.kinLog("灯火夜的路灯亮了一整夜，夜行者在林子边看了看，没敢过来。", "gold");
      }
    }
    return super.tickProwl();
  }
  // 换种集：拿你最多的那种种子 2 颗，换你最少的那种 2 颗
  swapReason() {
    if (!this.festNow() || this.festivalKind(this.s.day) !== "seeds") return "换种集那天 16:00–22:00 才能换";
    if (dist(this.s.player, PLAZA) > FEST2.chatNear) return "到前哨广场再换";
    if (this.festState().swap) return "今天换过了";
    const p = this.swapPlan();
    if (!p) return "要有一种种子攒到 " + FEST2.swapMin + " 颗";
    return "";
  }
  swapPlan() {
    const have = BASIC_SEEDS.map((id) => [id, this.qty(id, true)]).sort((a, b) => b[1] - a[1]);
    if (!have.length || have[0][1] < FEST2.swapMin) return null;
    const give = have[0][0],
      get = have.filter(([id]) => id !== give).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0]))[0][0];
    return { give, get };
  }
  seedSwap() {
    const reason = this.swapReason();
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const p = this.swapPlan();
    if (!this.takeFarm({ [p.give]: FEST2.swap })) return false;
    this.putStorage({ [p.get]: FEST2.swap });
    this.festState().swap = true;
    this.kinStat("swaps");
    this.toast("在换种集上拿 " + FEST2.swap + " 颗" + ITEMS[p.give].name + "换了 " + FEST2.swap + " 颗" + ITEMS[p.get].name + "（放仓库了）。", "gold");
    return true;
  }
  // 守夜纪念日：大家轮流念一个没走到今天的人的名字
  vigilReason() {
    if (!this.festNow() || this.festivalKind(this.s.day) !== "vigil") return "守夜纪念日那天 16:00–22:00";
    if (dist(this.s.player, PLAZA) > FEST2.chatNear) return "到前哨广场的纪念石边";
    if (this.festState().read) return "今晚念过了";
    return "";
  }
  vigilRead() {
    const reason = this.vigilReason();
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const f = this.festState();
    f.read = true;
    const names = this.people()
      .map((p) => p.id)
      .filter((id) => VIGIL_NAMES[id] && !this.whereNow(id).away)
      .slice(0, 6)
      .map((id) => this.kinName(id) + "念了「" + VIGIL_NAMES[id] + "」");
    this.residentsMood(FEST2.vigilMood);
    this.kinStat("readings");
    const text = "纪念石前，大家轮流念一个没走到今天的人：" + (names.length ? names.join("，") : "你念了你记得的那些名字") + "。（居民心情 +" + FEST2.vigilMood + "；今晚想说心里话的人，在广场上就说得出口）";
    this.toast(text, "gold");
    this.kinLog(text, "gold");
    return true;
  }

  // ================= 搭伙过日子 =================
  partnerCand(id) {
    return !!this.kin && PARTNER_IDS.includes(id) && this.knownPerson(id);
  }
  partnerOf(id) {
    const p = this.kin?.partner;
    return p && p.id === id ? p : null;
  }
  partnerHome() {
    const p = this.kin?.partner;
    return p?.stage === "home" ? p : null;
  }
  partnerGiftReason(id, item) {
    if (!this.partnerCand(id)) return "只有阿禾、许医生、陈工、尤可、何大勺、老琴能搭伙";
    const p = this.kin.partner;
    if (p && p.id !== id) return "你已经和" + this.kinName(p.id) + "走近了";
    if (p) return "已经送过了";
    if ((this.ss.trust[id] || 0) < PARTNER.near) return "信任到 " + PARTNER.near + "（现在 " + (this.ss.trust[id] || 0) + "）";
    if (this.heart(id).seg < 2) return "先听" + ta(id) + "说完两段心里话";
    if (this.qty(item, true) < 1) return "先在制作台做一个" + ITEMS[item].name;
    if (!this.personNear(id)) return "走到" + ta(id) + "跟前再送";
    return "";
  }
  partnerGive(id, item) {
    const reason = this.partnerGiftReason(id, item);
    if (reason || !this.takeFarm({ [item]: 1 })) {
      this.toast((reason || "送不出去") + "。", "warn");
      return false;
    }
    this.kin.partner = { id, stage: "near", day: this.s.day, hurt: 0 };
    const text = (PARTNER_LINES[id]?.near || this.kinName(id) + "收下了。") + "（你们走近了一步：信任到 10、三段心里话说完，傍晚在营火边说开）";
    this.toast(text, "gold");
    this.kinLog("你把亲手做的" + ITEMS[item].name + "送给了" + this.kinName(id) + "。", "gold");
    return true;
  }
  confessReason(id) {
    const p = this.partnerOf(id);
    if (!p || p.stage !== "near") return "还没走近";
    if ((this.ss.trust[id] || 0) < PARTNER.confess) return "信任到 " + PARTNER.confess;
    if (this.heart(id).seg < 3) return "三段心里话还没说完";
    if (!this.evening()) return "傍晚 19:00 以后，营火边";
    const calm = this.kinCalmReason();
    if (calm) return calm;
    const f = this.fireSpot?.();
    if (!f || this.s.region !== "farm" || dist(this.s.player, f) > 170) return "到营火边再说";
    return "";
  }
  confess(id, yes = true) {
    const reason = this.confessReason(id);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    if (!yes) {
      this.toast("你们在营火边坐了很久，谁也没再开口。", "normal");
      return true;
    }
    const p = this.kin.partner;
    p.stage = "set";
    p.day = this.s.day;
    const text = (PARTNER_LINES[id]?.confess || "") + "（明天起在前哨广场请全营吃一顿：炖汤 3、干粮 6）";
    this.toast(text, "gold");
    this.kinLog("你和" + this.kinName(id) + "在营火边说开了。", "gold");
    return true;
  }
  feastReason() {
    const p = this.kin?.partner;
    if (!p || p.stage !== "set") return "还没到请客的时候";
    if (this.s.day <= p.day) return "第二天再请";
    if (this.s.region !== "farm" || dist(this.s.player, PLAZA) > 200) return "到前哨广场请";
    const lack = Object.entries(PARTNER.feast).filter(([k, n]) => this.quantityForCost(k, true) < n);
    if (lack.length) return "要" + itemsText(PARTNER.feast) + "（缺" + lack.map(([k]) => ITEMS[k].name).join("、") + "）";
    return "";
  }
  feast() {
    const reason = this.feastReason();
    if (reason || !this.takeFarm({ ...PARTNER.feast })) {
      this.toast((reason || "东西不够") + "。", "warn");
      return false;
    }
    const p = this.kin.partner;
    p.stage = "home";
    p.day = this.s.day;
    this.residentsMood(PARTNER.feastMood);
    this.kinStat("partnered");
    const text = "全营在纪念石前吃了一顿。" + (PARTNER_LINES[p.id]?.home || "") + "（居民心情 +" + PARTNER.feastMood + "；往后每天早上有热早饭，帮你浇田或修设施，长夜里守在你身边）";
    this.toast(text, "gold");
    this.kinLog("你和" + this.kinName(p.id) + "搭伙过日子了。", "gold");
    this.emit("victory");
    return true;
  }
  partnerHurt() {
    const p = this.partnerHome();
    return !!p && (p.hurt || 0) >= this.s.day;
  }
  // 每天 07:00：早饭，再轮流浇田、修设施
  partnerMorning(day) {
    const p = this.partnerHome();
    if (!p || this.partnerHurt() || this.whereNow(p.id).away) return;
    const name = this.kinName(p.id),
      k = this.kin,
      line = BREAKFAST_LINES[day % BREAKFAST_LINES.length];
    this.putStorage({ [BREAKFAST]: 1 });
    this.kinStat("breakfasts");
    let help = "";
    if (day % 2 === 0) {
      let n = 0;
      for (const pl of this.s.plots)
        if ((pl.region || "farm") === "farm" && pl.crop && !this.plotWatered(pl) && n < PARTNER.water) {
          this.waterPlot(pl);
          n++;
        }
      if (n) help = "，还浇了 " + n + " 块田";
    } else {
      const max = (x) => BUILDINGS[x.type]?.hp || 0;
      const b = this.s.buildings.filter((x) => x.hp > 0 && x.hp < max(x)).sort((a, c) => a.hp / max(a) - c.hp / max(c))[0];
      if (b) {
        b.hp = Math.min(max(b), b.hp + PARTNER.fix);
        this.navRevision = (this.navRevision || 0) + 1;
        help = "，还把最破的那处设施修了修";
      }
    }
    if (help) this.kinStat("helps");
    k.morning = { ...(k.morning.day === day ? k.morning : { day, notes: [], dog: "" }), day, breakfast: name + line + help };
    this.kinLog(name + line + "（热早饭放仓库了）" + help + "。");
  }
  // 长夜里守在你身边的那个人（v0.37：最后一夜也来）
  allyUpdate(dt) {
    const p = this.partnerHome(),
      fin = !this.ln?.night && !!this.finalLive?.(),
      on = !!p && (!!this.ln?.night || fin) && this.s.region === "farm" && !this.partnerHurt();
    if (!on) {
      if (this._kinAlly) {
        const a = this._kinAlly;
        this._kinAlly = null;
        if (p && !a.down && !a.back && a.kills) this.kinLog(this.kinName(p.id) + "陪你守完了" + (a.final ? "最后一夜" : "长夜") + "（打倒 " + a.kills + " 只）。", "gold");
      }
      return;
    }
    const A = PARTNER.ally,
      me = this.s.player;
    if (!this._kinAlly) {
      const q = this.freePoint?.(me.x - 40, me.y + 20) || { x: me.x - 40, y: me.y + 20 };
      this._kinAlly = { id: p.id, x: q.x, y: q.y, hp: A.hp, cd: 0, down: false, kills: 0, facing: 0, final: fin };
      this.toast(this.kinName(p.id) + "拿着家伙站到了你身边。", "gold");
    }
    const a = this._kinAlly;
    if (a.down || a.away) return;
    a.cd = Math.max(0, a.cd - dt);
    const foes = (this.enemies || []).filter((z) => !z.dead && !z.lying && !z.fled);
    // 撑不住了：往农舍撤（路上还会被追着打，要护着）
    if (!a.back && a.hp <= A.hp * A.retreat) {
      a.back = true;
      const text = this.kinName(p.id) + "撑不住了，往农舍撤——护着" + ta(p.id) + "点。";
      this.toast(text, "warn");
      this.kinLog(text, "warn");
    }
    // 站在你身后：怪多的那一边的反方向（慢慢转过去，不来回晃）
    let gx = 0,
      gy = 0;
    for (const z of foes)
      if (dist(z, me) < A.r) {
        gx += z.x - me.x;
        gy += z.y - me.y;
      }
    const want = gx || gy ? Math.atan2(-gy, -gx) : (a.ang ?? Math.PI * 0.75);
    a.ang = a.ang == null ? want : a.ang + Math.atan2(Math.sin(want - a.ang), Math.cos(want - a.ang)) * Math.min(1, dt * 2.5);
    const post = { x: me.x + Math.cos(a.ang) * A.follow * 0.8, y: me.y + Math.sin(a.ang) * A.follow * 0.8 };
    // 只打冲着他来的：贴到他身边、离他比离你还近的那只（扑在你身上的是你的事，他守着你的背后）
    const t = a.back ? null : foes.filter((z) => dist(z, a) <= A.reach && dist(z, a) < dist(z, me)).sort((u, v) => dist(u, a) - dist(v, a))[0];
    const goal = a.back ? A.home : post,
      d = dist(a, goal);
    if (a.back && d < 18) {
      a.away = true;
      this.kinLog(this.kinName(p.id) + "退回了农舍，没挂彩" + (a.kills ? "（打倒 " + a.kills + " 只）" : "") + "。");
      return;
    }
    if (d > (a.back ? 0 : 6)) {
      const ang = Math.atan2(goal.y - a.y, goal.x - a.x),
        sp = A.speed * (a.back ? 1.2 : d > A.follow * 2 ? 1.4 : 1);
      a.facing = ang;
      const step = Math.min(d, sp * dt);
      if (this.moveEntity) this.moveEntity(a, Math.cos(ang) * step, Math.sin(ang) * step);
      a.x = clamp(a.x, 20, WORLD.w - 20);
      a.y = clamp(a.y, 20, WORLD.h - 20);
    }
    a.swing = Math.max(0, (a.swing || 0) - dt);
    if (t && dist(t, a) <= A.reach && a.cd <= 0) {
      a.cd = A.rate;
      a.facing = Math.atan2(t.y - a.y, t.x - a.x);
      a.swing = 0.25;
      a.hitAt = { x: t.x, y: t.y };
      const was = t.dead;
      // 只掉血：不推开、不让它踉跄、不打断它出手（那些是你手上的家伙干的）；最后一下照常打死
      if (this.dotHurt) this.dotHurt(t, A.dmg);
      else this.hurtEnemy(t, A.dmg, a.facing, { ally: true });
      if (!was && t.dead) {
        a.kills++;
        this.kinStat("allyKills");
      }
    }
    // 挨打：贴在他身上、离他比离你还近的那些
    for (const z of foes) {
      if (z.dead) continue;
      z.kinAllyCd = Math.max(0, (z.kinAllyCd || 0) - dt);
      if (z.kinAllyCd > 0 || dist(z, a) > A.hitR || dist(z, a) > dist(z, me)) continue;
      z.kinAllyCd = A.hurtCd;
      a.hp = Math.max(0, a.hp - Math.round((ZOMBIES[z.type]?.damage || 8) * A.take));
      if (a.hp <= 0) {
        a.down = true;
        p.hurt = this.s.day + PARTNER.hurtDays;
        this.residentsMood(PARTNER.hurtMood);
        const text = this.kinName(p.id) + "挂了彩，退到农舍里去了（要歇 " + PARTNER.hurtDays + " 天）。";
        this.toast(text, "warn");
        this.kinLog(text, "warn");
        break;
      }
    }
  }
  // 长夜里陪在你身边的人，就不在原来的岗位上了
  residentActive(r) {
    const a = this._kinAlly;
    if (a && !a.down && !a.away && r?.id === a.id) return false;
    return super.residentActive(r);
  }

  // ================= 收留孩子 =================
  lodgerMorning() {
    const l = this.ss?.lodger,
      k = this.kin;
    if (k && l && l.phase === "staying" && KID_LODGERS.includes(l.name) && k.kids.length < KIDS.max && !k.ask && this.kinRoll("kid", l.name, this.s.day) < KIDS.chance) {
      const from = l.name.replace(/^带(孩子|外孙)的/, "");
      k.ask = { name: KID_NAMES[l.name] || "小豆", from, day: this.s.day, look: (l.look ?? 0) % 4 };
      const text = KID_LINES.ask.replace("{from}", from) + "（今天 20:00 前到农舍门口答复）";
      this.toast(text, "gold");
      this.kinLog(from + "想把孩子托给营地，在农舍门口等你答复。", "gold");
    }
    return super.lodgerMorning();
  }
  kidReason() {
    const a = this.kin?.ask;
    if (!a) return "没有人在等";
    if (this.kin.kids.length >= KIDS.max) return "营地里已经有两个孩子了";
    if (!this.freeBeds?.() && !this.rooms?.().some((r) => r.active)) return "没有空床，也没有布置好的房间给孩子睡";
    if ((this.foodPortions?.() ?? 1) < 2) return "仓库里口粮太少，养不起";
    return "";
  }
  kidDecide(yes) {
    const a = this.kin?.ask;
    if (!a) return false;
    if (yes) {
      const reason = this.kidReason();
      if (reason) {
        this.toast(reason + "。", "warn");
        return false;
      }
      const id = "k" + (this.kin.stats.kids + 1);
      this.kin.kids = [...this.kin.kids, { id, name: a.name, look: a.look, from: a.from, day: this.s.day, master: "", start: 0, learned: false, fed: this.s.day, hungry: 0 }];
      this.kinStat("kids");
      const text = KID_LINES.yes.replace("{from}", a.from).replace("{kid}", a.name);
      this.toast(text + "（在人物关系页给" + a.name + "找个师父学手艺）", "gold");
      this.kinLog(text, "gold");
    } else {
      this.toast(KID_LINES.no.replace("{from}", a.from).replace("{kid}", a.name), "normal");
      this.kinLog(KID_LINES.no.replace("{from}", a.from).replace("{kid}", a.name));
    }
    this.kin.ask = null;
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  kidMasters() {
    return Object.keys(KID_CRAFTS).filter((m) => (m === "he" ? this.ss?.he.stage >= 4 : !!this.resident(m)));
  }
  kidLearn(kid, master) {
    const k = this.kin?.kids.find((x) => x.id === kid);
    if (!k || !KID_CRAFTS[master] || !this.kidMasters().includes(master) || k.learned) return false;
    if (k.master === master) return false;
    k.master = master;
    k.start = this.s.day;
    this.toast(k.name + "跟着" + this.kinName(master) + "学" + KID_CRAFTS[master].name + "（" + KIDS.learn + " 天出师）。", "gold");
    return true;
  }
  kidHour(h) {
    const k = this.kin;
    if (!k?.kids.length) return;
    const day = this.s.day;
    for (const kid of k.kids) {
      if (h === 6 && kid.master && !kid.learned && day - kid.start >= KIDS.learn) {
        kid.learned = true;
        const text = KID_LINES.learned.replace("{kid}", kid.name).replace("{master}", this.kinName(kid.master)).replace("{craft}", KID_CRAFTS[kid.master].name);
        this.toast(text + "（" + KID_CRAFTS[kid.master].desc + "）", "gold");
        this.kinLog(text, "gold");
      }
      if (h === 7 && kid.learned) {
        let done = "";
        if (kid.master === "farmer") {
          let n = 0;
          for (const p of this.s.plots)
            if ((p.region || "farm") === "farm" && p.crop && !this.plotWatered(p) && n < 2) {
              this.waterPlot(p);
              n++;
            }
          if (n) done = "浇了 " + n + " 块田";
        } else if (kid.master === "medic" && (day - kid.start) % 3 === 0) {
          this.putStorage({ bandage: 1 });
          done = "卷了 1 条绷带";
        } else if (kid.master === "mechanic" && (day - kid.start) % 3 === 0) {
          this.putStorage({ parts: 1 });
          done = "挑出 1 个零件";
        } else if (kid.master === "he" && (day - kid.start) % 2 === 0) {
          this.putStorage({ bread: 2 });
          done = "帮何大勺多做了 2 份干粮";
        }
        if (done) {
          this.kinStat("kidHelps");
          this.kinLog(kid.name + done + "。");
        }
      }
      if (h === 18 && kid.fed !== day) {
        kid.fed = day;
        if (this.takeMeal?.()) kid.hungry = 0;
        else {
          kid.hungry++;
          this.residentsMood(-2);
          this.kinLog(kid.name + "今晚没饭吃，饿着肚子睡了（居民心情 −2）。", "warn");
        }
      }
    }
  }
  // 孩子跟着师父走（没有师父就在农舍门口玩）
  // 孩子白天在外面跟着师父；天黑以后、长夜、尸潮和灰隼团来的时候待在屋里
  kidsOut() {
    const m = this.s.minute;
    if (m < 6 * 60 || m >= 21 * 60 || this.ln?.night || ["warning", "active"].includes(this.s.horde?.phase)) return false;
    const r = this.raidState?.();
    return !(r && ["warning", "active"].includes(r.phase));
  }
  kidPos(kid, i) {
    const m = kid.master;
    let base = { x: 300 + i * 26, y: 360 };
    if (m) {
      const w = this.whereNow(m);
      if (!w.away && w.region === "farm") base = { x: w.x + 26 + i * 8, y: w.y + 14 };
    }
    return base;
  }

  // ================= 收线钓鱼 =================
  waterOpen(id) {
    const w = WATERS[id];
    if (!w) return false;
    if (id === "canal") return !!this.f?.canals && (this.canalReady?.() || this.f.canals.dug?.includes(15));
    if (id === "river") return !!this.s.visited?.valley || this.s.region === "valley";
    if (id === "sea") return !!this.s.visited?.shipyard || this.s.region === "shipyard";
    return true;
  }
  reeling() {
    return !!this._reel;
  }
  // 抛竿：池塘照原来的；河、海、水渠自己来
  kinCast(water) {
    if (!this.kin || this.c.fishing || this._reel) return false;
    if (water === "pond") {
      const ok = super.startFishing(false);
      if (ok) this.kin.cast = { water: "pond" };
      return ok;
    }
    const W = WATERS[water];
    if (!W || this.s.region !== W.region || !this.waterOpen(water) || dist(this.s.player, W) > 100) {
      this.toast("走到水边再抛竿。", "warn");
      return false;
    }
    const n = this.c.metrics.fish || 0;
    this.c.fishing = { elapsed: 0, biteAt: Math.round((2.4 + (n % 3) * 0.6 - (this.ss?.jiang.rod || 0) * 0.3) * 10) / 10, phase: "wait", bait: false };
    this.kin.cast = { water };
    this.toast("鱼线抛进了" + W.name + " · 出现“咬钩”时按 E！");
    this.emit("closeMenu");
    this.paused = false;
    return true;
  }
  startFishing(bait = false) {
    const ok = super.startFishing(bait);
    if (ok && this.kin) this.kin.cast = { water: "pond" };
    return ok;
  }
  // 池塘：照原来的规矩先猜是哪一种（收线的难度跟着它走）
  pondGuess() {
    const f = this.c.fishing;
    if (this.isNight() && ((this.c.metrics.fish || 0) + Number(!!f?.bait)) % 2 === 0) return "nightFish";
    if (RAINY.includes(this.s.weather) || f?.bait) return "riverFish";
    return "fish";
  }
  // 河、海、水渠：按时节、钟点、天气挑一种
  pickFish(water, salt = 0) {
    const day = this.s.day,
      m = this.s.minute,
      sid = seasonOf(day).id,
      rain = RAINY.includes(this.s.weather),
      night = m >= 18 * 60 || m < 6 * 60,
      luck = this.luckToday?.()?.id;
    const list = FISH_IDS.filter((id) => {
      const f = FISH[id];
      if (f.water !== water || !f.name) return false;
      if (f.seasons && !f.seasons.includes(sid)) return false;
      if (f.hours && !inHours(m, f.hours)) return false;
      if (f.rain && !rain) return false;
      if (f.rainOrNight && !rain && !night) return false;
      return true;
    }).map((id) => [id, (FISH[id].w || 1) * (FISH[id].tier === "rare" && luck === "great" ? 1.5 : 1)]);
    if (!list.length) return null;
    return pickW(list, this.kinRoll("fish", water, day, m, this.c.metrics.fish || 0, salt));
  }
  reelStart() {
    const f = this.c.fishing,
      water = this.kin.cast?.water || "pond";
    const sp = water === "pond" ? this.pondGuess() : this.pickFish(water);
    if (!sp) {
      this.c.fishing = null;
      this.kin.cast = null;
      this.toast("鱼在水底转了一圈，没上钩。");
      return false;
    }
    const tier = FISH[sp]?.tier || "common",
      T = TIERS[tier],
      r = rngOf(hashOf(this.ut?.seed ?? 1, "reel", this.s.day, this.s.minute, this.c.metrics.fish || 0));
    this._reel = { water, sp, tier, bait: !!f?.bait, biteAt: f?.biteAt || 2, prog: T.start, tense: 0.15, t: 0, pull: 0, pullT: 0, next: T.every[0] + r() * (T.every[1] - T.every[0]) * 0.6, warn: false, held: false, r };
    this.c.fishing = null;
    this.toast("咬钩了！按住 E（手机按住「交互」）收线，鱼一挣就松手。", "gold");
    this.emit("reel", { x: WATERS[water]?.bob.x, y: WATERS[water]?.bob.y });
    return true;
  }
  reelTick(dt, held) {
    const R = this._reel;
    if (!R) return;
    const T = TIERS[R.tier],
      rand = (a) => a[0] + R.r() * (a[1] - a[0]);
    R.t += dt;
    R.held = !!held;
    if (R.pull > 0) {
      R.pull -= dt;
      R.pullT += dt;
      if (R.pull <= 0) {
        R.pull = 0;
        R.next = rand(T.every);
      }
    } else {
      R.next -= dt;
      if (R.next <= 0) {
        R.pull = rand(T.len);
        R.pullT = 0;
      }
    }
    R.warn = R.pull <= 0 && R.next <= REEL.warn && this.hasSkill("readWater");
    if (held) {
      R.prog += T.reel * dt * (R.pull > 0 ? 0.35 : 1);
      // 鱼刚一挣还有一下缓冲（REEL.ramp 秒里越拽越紧），反应快的松得开
      R.tense += (R.pull > 0 ? T.pulled * Math.min(1, R.pullT / REEL.ramp) : T.tense) * dt;
    } else {
      R.tense = Math.max(0, R.tense - T.relax * dt);
      R.prog -= (R.pull > 0 ? T.run : T.slip) * dt;
    }
    if (R.tense >= 1) return this.reelLose("break");
    if (R.prog >= 1) return this.reelLand();
    if (R.prog <= 0 || R.t > REEL.limit) return this.reelLose("escape");
  }
  reelLose(why) {
    const R = this._reel;
    this._reel = null;
    if (this.kin) this.kin.cast = null;
    this.kinStat(why === "break" ? "breaks" : "escapes");
    this.kinStat("reels");
    this.toast(why === "break" ? "线绷得太紧，啪地断了。鱼跑了。" : "鱼脱了钩，一甩尾巴游走了。", "warn");
    const w = WATERS[R?.water];
    this.emit("reelLost", w ? { x: w.bob.x, y: w.bob.y } : {});
    return false;
  }
  reelLand() {
    const R = this._reel;
    this._reel = null;
    this.kin.cast = null;
    this.kinStat("reels");
    let got = null;
    if (R.water === "pond") {
      const before = { ...this.s.inventory },
        storeBefore = { ...this.s.storage };
      this.c.fishing = { elapsed: R.biteAt, biteAt: R.biteAt, phase: "bite", bait: R.bait };
      const ok = super.hookFish();
      if (!ok) {
        this.c.fishing = null;
        return false;
      }
      got = FISH_IDS.filter((id) => (this.s.inventory[id] || 0) + (this.s.storage[id] || 0) > (before[id] || 0) + (storeBefore[id] || 0));
      // 回暖、秋收的白天：三成的银鳞鱼换成鲫鱼
      if (got.length === 1 && got[0] === "fish") {
        const F = FISH.kinCrucian,
          sid = seasonOf(this.s.day).id;
        if (F.seasons.includes(sid) && inHours(this.s.minute, F.hours) && this.kinRoll("crucian", this.s.day, this.c.metrics.fish) < 0.3) {
          if (this.s.inventory.fish > (before.fish || 0)) {
            this.s.inventory.fish--;
            if (!this.s.inventory.fish) delete this.s.inventory.fish;
            this.s.inventory.kinCrucian = (this.s.inventory.kinCrucian || 0) + 1;
          } else {
            this.s.storage.fish--;
            if (!this.s.storage.fish) delete this.s.storage.fish;
            this.s.storage.kinCrucian = (this.s.storage.kinCrucian || 0) + 1;
          }
          got = ["kinCrucian"];
          this.toast("细看是一条鲫鱼。", "gold");
        }
      }
    } else {
      const sp = R.sp;
      this.receive({ [sp]: 1 });
      this.c.metrics.fish = (this.c.metrics.fish || 0) + 1;
      this.xp("exploration", 3);
      got = [sp];
      const W = WATERS[R.water],
        sample = SAMPLES[R.water];
      let tail = "";
      if (!W.clean && !this.kin.waters[R.water] && sample && this.qty(sample, true) < 1) {
        this.receive({ [sample]: 1 });
        tail = "（顺手灌了一瓶水样：这里的鱼要许医生验过水才敢吃）";
      } else if (!W.clean && !this.kin.waters[R.water] && FISH[sp].name && ITEMS[sp].type === "food") tail = "（这片水还没验过，先别吃）";
      if (FISH[sp].mutant) tail = "（变异的：拿给许医生研究）";
      this.toast("钓到" + ITEMS[sp].name + "！" + tail, "gold");
      this.emit("loot");
    }
    for (const id of got || []) this.kin.fish[id] = (this.kin.fish[id] || 0) + 1;
    // 防水包
    if (this.kinRoll("bag", this.s.day, this.s.minute, this.c.metrics.fish || 0) < BAG.chance) {
      const x = pickW(BAG.loot, this.kinRoll("bagw", this.s.day, this.c.metrics.fish || 0));
      let b = null;
      if (x === "decor") {
        const d = DECOR[Math.floor(this.kinRoll("bagd", this.s.day) * DECOR.length) % DECOR.length];
        b = { [decorItem(d.id)]: 1 };
      } else if (x === "keepsake") {
        const k = KEEP_IDS[Math.floor(this.kinRoll("bagk", this.s.day) * KEEP_IDS.length) % KEEP_IDS.length];
        b = { [k]: 1 };
      } else b = { ...x };
      this.receive(b);
      this.kinStat("bags");
      this.toast("鱼钩上还挂着一个防水包：" + itemsText(b) + "。", "gold");
    }
    return true;
  }
  reelHud() {
    const R = this._reel;
    if (!R) return null;
    return { tense: clamp(R.tense, 0, 1), prog: clamp(R.prog, 0, 1), pull: R.pull > 0, warn: R.warn, tier: TIERS[R.tier].name, held: R.held, water: WATERS[R.water]?.name || "" };
  }
  // 河和海里钓的鱼：许医生验过水才能吃
  fishWaterOf(id) {
    return FISH[id]?.water || null;
  }
  edibleReason(id) {
    const w = this.fishWaterOf(id);
    if (!w || !FISH[id]?.name || WATERS[w].clean || this.kin?.waters[w]) return "";
    return WATERS[w].name + "的水还没验过，许医生点头之前不敢吃";
  }
  consume(id) {
    const why = this.kin ? this.edibleReason(id) : "";
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    return super.consume(id);
  }
  verifyReason(water) {
    const s = SAMPLES[water];
    if (!s) return "这里的水不用验";
    if (this.kin.waters[water]) return "验过了";
    if (!this.resident("medic")) return "要许医生在营地";
    if (this.qty(s, true) < 1) return "先在" + WATERS[water].name + "钓上一条，顺手灌一瓶水样";
    return "";
  }
  verifyWater(water) {
    const reason = this.verifyReason(water);
    if (reason || !this.takeFarm({ [SAMPLES[water]]: 1 })) {
      this.toast((reason || "没有水样") + "。", "warn");
      return false;
    }
    this.kin.waters[water] = true;
    this.kinStat("samples");
    const text = "许医生验了" + WATERS[water].name + "的水样：“煮熟了能吃，别生吃。”那里钓的鱼放心吃了。";
    this.toast(text, "gold");
    this.kinLog(text, "gold");
    return true;
  }
  fishResearchReason(id) {
    if (!FISH[id]?.mutant || !FISH[id].name) return "不是变异的";
    if (!this.resident("medic")) return "要许医生在营地";
    if (this.qty(id, true) < 1) return "没有" + ITEMS[id].name;
    return "";
  }
  researchFish(id) {
    const reason = this.fishResearchReason(id);
    if (reason || !this.takeFarm({ [id]: 1 })) {
      this.toast((reason || "没有") + "。", "warn");
      return false;
    }
    const first = !this.kin.research.includes(id);
    if (first) {
      this.kin.research = [...this.kin.research, id];
      this.c.researchCredits = (this.c.researchCredits || 0) + 1;
    } else this.addReputation?.(2);
    this.kinStat("research");
    const text = "许医生剖开" + ITEMS[id].name + "看了一下午：" + (first ? "“水里的东西我大概有数了。”（研究点 +1）" : "“和上回那条一样。”（声望 +2）");
    this.toast(text, "gold");
    this.kinLog(text, "gold");
    return true;
  }

  // ================= 商队的稀罕货 =================
  arriveCaravan() {
    const out = super.arriveCaravan();
    const c = this.o?.caravan;
    if (!this.kin || !c?.offers?.length || c.offers.some((o) => o.kinRare)) return out;
    const day = this.s.day,
      x = this.kinRoll("rare", day, c.visits || 0);
    const owned = (id) => this.qty(id, true) > 0;
    const keeps = KEEP_IDS.filter((id) => !owned(id) && this.people().some((p) => prefsOf(p.id).fav.includes(id)));
    const w = RARE_SLOT.w;
    const kind = pickW([["keepsake", keeps.length ? w.keepsake : 0], ["decor", w.decor], ["seeds", w.seeds]].filter(([, n]) => n > 0), x);
    let item = null,
      qty = 1,
      price = 0;
    if (kind === "keepsake") {
      item = keeps[Math.floor(this.kinRoll("rarek", day) * keeps.length) % keeps.length];
      price = RARE_SLOT.keepsake;
    } else if (kind === "decor") {
      const d = DECOR[Math.floor(this.kinRoll("rared", day) * DECOR.length) % DECOR.length];
      item = decorItem(d.id);
      price = RARE_SLOT.decor;
    } else {
      const crops = Object.entries(CROP_SEASON)
        .filter(([, [g]]) => g === seasonOf(day).id)
        .map(([cr]) => CROPS[cr]?.seed)
        .filter((s) => s && ITEMS[s]);
      item = crops.length ? crops[Math.floor(this.kinRoll("rares", day) * crops.length) % crops.length] : "seedPumpkin";
      qty = RARE_SLOT.seedN;
      price = RARE_SLOT.seeds;
    }
    if (!item || !ITEMS[item]) return out;
    const rare = { item, tech: null, qty, price, fake: null, inspected: "real", sold: false, kinRare: true };
    // 车上最多摆 6 样：满了就换掉一样普通的货
    if (c.offers.length >= 6) {
      const i = c.offers.map((o, k) => [o, k]).filter(([o]) => !o.tech && !o.sold && !String(o.item).startsWith("bp_") && o.item !== "upPaper").map(([, k]) => k).pop();
      if (i === undefined) return out;
      c.offers[i] = { key: c.offers[i].key, ...rare };
    } else c.offers.push({ key: Math.max(...c.offers.map((o) => o.key)) + 1, ...rare });
    return out;
  }
  buyOffer(key) {
    const o = this.o?.caravan.offers.find((x) => x.key === Number(key) || x.key === key);
    const ok = super.buyOffer(key);
    if (ok && o?.kinRare) this.kinStat("rare");
    return ok;
  }

  // ================= 柜子里的稀罕物 =================
  rollContainer(o, day = this.s.day) {
    const res = super.rollContainer(o, day);
    if (!this.kin || !res) return res;
    const region = this.s.region,
      locked = o.ukind === "locked" || o.odds === "locked",
      chance = locked ? KEEP_RULES.locked : KEEP_RULES.chance,
      r = rngOf(hashOf(this.ut.seed, "kinbox", o.id, day));
    const known = this.people().map((p) => p.id);
    // 一个柜子只掷一次：这片废墟里、这种柜子里会有的、手上还没有、又是某个认识的人最爱的那几样里挑一样
    const pool = KEEP_IDS.filter((id) => {
      const k = KEEPSAKES[id];
      if (k.home.region !== region || (!locked && !k.home.kinds.includes(res.kind))) return false;
      return this.qty(id, true) < 1 && known.some((pid) => prefsOf(pid).fav.includes(id));
    });
    if (pool.length && r() < chance) res.bundle = { ...res.bundle, [pool[Math.floor(r() * pool.length) % pool.length]]: 1 };
    return res;
  }

  // ================= 本事 =================
  harvest(p, worker = false) {
    const crop = p?.crop,
      good = this.kin && crop && this.hasSkill("seedSave") && this.seasonKind?.(crop) === "good" && p.growth >= (CROPS[crop]?.grow || 1e9);
    const out = super.harvest(p, worker);
    if (good && !p.crop && CROPS[crop]?.seed && ITEMS[CROPS[crop].seed] && this.kinRoll("seedsave", this.s.day, p.id || p.x, this.s.minute) < SKILL_RULES.seedSave) {
      this.putStorage({ [CROPS[crop].seed]: 1 });
      if (!worker) this.toast("留了一颗" + ITEMS[CROPS[crop].seed].name + "（进仓库）。", "gold");
    }
    return out;
  }
  medBonus(id) {
    const base = super.medBonus?.(id) || 0;
    return base + (id === "bandage" && this.hasSkill("bandage") ? SKILL_RULES.bandage : 0);
  }
  kitRepair(b) {
    const ok = super.kitRepair(b);
    if (ok && this.hasSkill("kitSave") && this.kinRoll("kit", this.s.day, this.s.minute, b?.id || "") < SKILL_RULES.kitSave) {
      this.putStorage({ repairKit: 1 });
      this.toast("量准了再动手：这回修理包没用完，收回仓库了。", "gold");
    }
    return ok;
  }
  repairCost(id) {
    const c = super.repairCost(id);
    if (!c || !this.hasSkill("patch") || !c.cloth) return c;
    return { ...c, cloth: Math.max(1, Math.ceil(c.cloth / 2)) };
  }
  stationLanes(b, n) {
    const lanes = super.stationLanes(b, n);
    return b?.type === "cook" && this.hasSkill("fire") ? lanes.map((x) => x * SKILL_RULES.fire) : lanes;
  }
  effectiveCost(cost) {
    const c = super.effectiveCost(cost);
    if (!this.hasSkill("parts") || !c || (c.parts || 0) < 2) return c;
    return { ...c, parts: c.parts - 1 };
  }

  // ================= 每个钟点：各有各的一天 =================
  workHour() {
    super.workHour();
    if (!this.kin) return;
    const h = Math.floor(this.s.minute / 60),
      day = this.s.day;
    if (h === 6) {
      this.kinNotes(day);
      this.dogFetch(day);
    }
    if (h === 7) this.partnerMorning(day);
    this.kidHour(h);
    if (h === 20 && this.kin.ask && this.kin.ask.day === day) {
      const a = this.kin.ask;
      this.kin.ask = null;
      this.kinLog(KID_LINES.late.replace("{from}", a.from).replace("{kid}", a.name));
      if (this.s.region === "farm") this.assignRegion();
    }
    if (h === 14 && this.sandbagDay()) this.kinLog("明天尸潮要来，大家下午都去营门帮着垒沙袋。");
    this.scheduleTargets(h);
  }
  // 傍晚坐到营火边；有话要说的走到他常待的地方；节庆去广场；尸潮前一天去营门垒沙袋
  scheduleTargets(h) {
    const fest = this.festDay?.() && h >= 16 && h < 22,
      sand = this.sandbagDay() && h >= 14 && h < 18,
      eve = h >= 19 && h < 22 && !this.rainyNow() && this.fireSpot?.() && this.kinCalm();
    let i = 0;
    const move = (p, kind) => {
      const pid = p.id;
      if (this.heartReady(pid) && HEART_SPOTS[pid] && h >= 19 && h < 23) {
        const s = this.heartSpot(pid);
        if (s) {
          p.target = { x: s.x, y: s.y };
          return;
        }
      }
      if (fest) p.target = this.ringAt(PLAZA, i++);
      else if (sand) p.target = this.ringAt(GATE, i++, 54);
      else if (eve && (kind === "c" || p.workRole === "rest")) p.target = this.fireRing(i++) || p.target;
    };
    for (const r of this.c.residents) if (this.residentActive(r) && r.workRole !== "guard") move(r, "r");
    for (const c of this.o?.crew || []) if (c.task !== "scout" && c.role !== "guard" && !/伤|躺/.test(c.status || "")) move(c, "c");
  }

  // ================= 场景里的东西 =================
  assignRegion() {
    super.assignRegion();
    if (!this.kin || !Array.isArray(this.objects)) return;
    const reg = this.s.region,
      push = (o) => this.objects.push({ icon: 40, ...o });
    if (reg === "farm") {
      for (const id of ["he", "laoqin", "qin"]) {
        if (id === "qin" && this.ss?.qin.phase === "staying") continue;
        const w = this.npcSpot(id);
        if (!w || w.away || w.plaza) continue;
        if (id === "he" && this.canteenNight?.()) continue;
        push({ type: "kinPerson", who: id, name: this.kinName(id), x: w.x, y: w.y });
      }
      if (this.lampsOn()) LAMPS.forEach((p, i) => push({ type: "kinLamp", lamp: i, name: "路灯", x: p.x, y: p.y }));
      if (this.kin.ask) push({ type: "kinKidAsk", name: this.kin.ask.from + "和孩子", x: 300, y: 336 });
      if (this.kidsOut())
        this.kin.kids.forEach((k, i) => {
          const q = this.kidPos(k, i);
          push({ type: "kinKid", kid: k.id, name: k.name, x: q.x, y: q.y });
        });
    }
    for (const w of WATER_IDS)
      if (w !== "pond" && WATERS[w].region === reg && this.waterOpen(w)) push({ type: "kinWater", water: w, name: WATERS[w].name + " · 钓鱼", x: WATERS[w].x, y: WATERS[w].y });
    for (const [id, q] of Object.entries(REQUESTS)) {
      const h = this.kin.heart[id];
      if (!h || h.seg !== 2 || h.got || q.region !== reg) continue;
      const p = this.freePoint?.(q.x, q.y) || q;
      push({ type: "kinCache", who: id, name: q.name, x: p.x, y: p.y });
    }
  }
  // 走动的人不进“同处多对象选择”（和居民、援建队员一样）
  pickCandidates() {
    const list = super.pickCandidates();
    if (!this.kin || list.length < 2) return list;
    const keep = list.filter((o) => !["kinPerson", "kinKid", "kinKidAsk"].includes(o.type));
    return keep.length >= 2 ? keep : [];
  }
  canteenNight() {
    const c = this.ss?.canteen;
    return !!c?.night;
  }
  // 农场上哪些人该出现（变了就重新摆一遍）
  kinPresenceKey() {
    if (this.s.region !== "farm" || !this.kin) return "";
    const parts = ["he", "laoqin", "qin"].map((id) => {
      if (id === "qin" && this.ss?.qin.phase === "staying") return "-";
      const w = this.npcSpot(id);
      return !w || w.away || w.plaza || (id === "he" && this.canteenNight()) ? "-" : "+";
    });
    parts.push(this.lampsOn() ? "L" : "");
    parts.push(this.kin.kids.length && this.kidsOut() ? "K" : "");
    return parts.join("");
  }
  context(o) {
    if (this.kin) {
      if (this._reel) return this._reel.pull ? "鱼在挣！松手" : "按住 E 收线 · 鱼挣就松手";
      if (!this.c?.fishing) {
        if (o?.type === "kinLamp") return this.kin.fest.lamps.includes(o.lamp) ? "路灯 · 亮着" : "路灯 · 按 E 点亮（" + this.kin.fest.lamps.length + "/" + LAMPS.length + "）";
        if (o?.type === "kinWater") return WATERS[o.water].name + " · 按 E 抛竿";
        if (o?.type === "kinCache") return o.name + " · 按 E 翻一翻";
        if (o?.type === "kinKidAsk") return o.name + " · 按 E 答复";
        if (o?.type === "kinKid") return o.name + " · 看看";
        const pid = this.personOf(o);
        if (pid) {
          if (this.heartReady(pid)) return this.kinName(pid) + " · 像是有话想说（按 E）";
          if (this.partnerOf(pid) && !this.confessReason(pid)) return this.kinName(pid) + " · 按 E 说开";
          if (!this.festChatReason(pid)) return this.kinName(pid) + " · 按 E 聊两句";
          if (o.type === "kinPerson") return this.kinName(pid) + " · 按 E 看看";
        }
      }
    }
    return super.context(o);
  }
  interact() {
    if (this.paused) return;
    if (!this.kin) return super.interact();
    if (this._reel) return;
    if (this.c?.fishing) {
      if (this.c.fishing.phase === "bite") return void this.reelStart();
      this.kin.cast = null;
      return super.interact();
    }
    const o = this.nearestObject?.();
    if (o?.type === "pond" && this.s.region === "farm") return void this.kinCast("pond");
    if (o?.type === "kinWater") return void this.kinCast(o.water);
    if (o?.type === "kinLamp") return void this.lightLamp(o.lamp);
    if (o?.type === "kinCache") return void this.cacheTake(o.who);
    if (o?.type === "kinKidAsk") return void this.emit("menu", { menu: "outpost", view: "kinKid", id: "" });
    if (o?.type === "kinKid") return void this.emit("menu", { menu: "outpost", view: "people", id: "kids" });
    const pid = this.personOf(o);
    if (pid) {
      if (this.heartReady(pid)) return void this.emit("menu", { menu: "outpost", view: "kinHeart", id: pid });
      if (this.partnerOf(pid) && !this.confessReason(pid)) return void this.emit("menu", { menu: "outpost", view: "kinConfess", id: pid });
      if (!this.festChatReason(pid)) return void this.festChat(pid);
      if (o.type === "kinPerson") return void this.emit("menu", { menu: "outpost", view: "people", id: pid });
    }
    return super.interact();
  }
  use(target) {
    if (this._reel) return false;
    return super.use(target);
  }
  dodgeReason() {
    if (this._reel) return "收线时不能翻滚";
    return super.dodgeReason?.() ?? "";
  }
  travel(id) {
    if (this._reel) {
      this._reel = null;
      this.toast("你一走，鱼就跑了。", "warn");
    }
    if (this.kin?.cast) this.kin.cast = null;
    return super.travel(id);
  }

  // ================= 每帧、每天 =================
  update(dt, input = {}) {
    const intro = !this.paused && this.kin?.intro;
    if (intro && !intro.told) {
      intro.told = true;
      const text = "人情：送礼要猜每个人的喜好（7 天最多送 2 次）；信任到 3、6、9 的晚上有人想说心里话；节庆大家都来广场；收线钓鱼按住收、鱼挣就松手。人物关系页写着每个人这会儿在哪。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    }
    if (this._reel && !this.paused) {
      this.reelTick(Math.min(0.05, Math.max(0, dt)), !!input.reel);
      input = { ...input, x: 0, y: 0, run: false };
    }
    const out = super.update(dt, input);
    if (!this.paused && this.kin) {
      this.allyUpdate(Math.min(0.1, Math.max(0, dt)));
      // 地图上的人和孩子跟着走；谁该出现、谁该走了（何大勺、老琴、秦奶奶一天里换地方，灯火夜的路灯）
      if (this.s.region === "farm" && Array.isArray(this.objects)) {
        const key = this.kinPresenceKey();
        if (key !== this._kinKey) {
          this._kinKey = key;
          this.assignRegion();
        }
        let i = 0;
        for (const o of this.objects) {
          if (o.type === "kinPerson") {
            const w = this.npcSpot(o.who);
            if (w && !w.away) {
              const d = dist(o, w);
              if (d > 3) {
                const sp = Math.min(d, (d > 400 ? 400 : 52) * dt);
                o.x += ((w.x - o.x) / d) * sp;
                o.y += ((w.y - o.y) / d) * sp;
                o.facing = Math.atan2(w.y - o.y, w.x - o.x);
                o.moving = true;
              } else o.moving = false;
            }
          }
          if (o.type === "kinKid") {
            const k = this.kin.kids.find((x) => x.id === o.kid);
            if (k) {
              const q = this.kidPos(k, i++),
                d = dist(o, q);
              if (d > 4) {
                const sp = Math.min(d, 70 * dt);
                o.x += ((q.x - o.x) / d) * sp;
                o.y += ((q.y - o.y) / d) * sp;
                o.moving = true;
              } else o.moving = false;
            }
          }
        }
      }
    }
    return out;
  }
  onNewDay() {
    super.onNewDay();
    if (!this.kin) return;
    const k = this.kin,
      day = this.s.day;
    for (const [id, list] of Object.entries(k.gifts)) {
      const keep = list.filter((d) => day - d < GIFT.window);
      if (keep.length) k.gifts[id] = keep;
      else delete k.gifts[id];
    }
    for (const [id, d] of Object.entries(k.talked)) if (day - d >= TALK_RULES.cd) delete k.talked[id];
    for (const [id, d] of Object.entries(k.ordered)) if (day - d >= GIFT.window) delete k.ordered[id];
    for (const [id, d] of Object.entries(k.notes)) if (day - d >= NOTE.every * 2) delete k.notes[id];
    if (k.ask && k.ask.day < day) k.ask = null;
    if (k.partner && k.partner.hurt && k.partner.hurt < day) k.partner.hurt = 0;
    // 秦奶奶坐渡船走了，十天后带着女儿的信回来住下
    const q = this.ss?.qin;
    if (q?.phase === "left" && !k.qin.left) k.qin.left = day;
    if (q?.phase === "left" && k.qin.left && !k.qin.back && day - k.qin.left >= 10 && this.heart("qin").seg < 3) {
      k.qin.back = day;
      const text = "秦奶奶回来了：“渡船停了。南边托人捎了信，我就在这儿等她吧。”她还住农舍西边。";
      this.toast(text, "gold");
      this.kinLog(text, "gold");
    }
    if (this.s.region === "farm") this.assignRegion();
  }
  // 醒来的账本多说两句：门缝里的纸条、麦穗叼回来的、早饭
  ledger(day0, money0) {
    const L = super.ledger(day0, money0);
    const k = this.kin,
      m = k?.morning;
    if (!L || !m || m.day !== this.s.day) return L;
    const bits = [];
    if (m.notes?.length) bits.push("门缝里有 " + m.notes.length + " 张纸条（" + m.notes.join("、") + "）");
    if (m.dog) bits.push("麦穗叼回来" + m.dog);
    if (m.breakfast) bits.push(m.breakfast);
    if (bits.length) L.lines = [...L.lines.slice(0, 2), L.lines[2] ? L.lines[2] + "；" + bits.join("；") : "今天：" + bits.join("；")];
    return L;
  }

  // ================= 存档 =================
  static parse(text) {
    const s = AlmanacEngine.parse(text);
    migrateState(s);
    validateKin(s);
    return s;
  }
}

function validateKin(s) {
  const t = s.kin,
    bad = (why) => {
      throw new Error("存档里的人情记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
    };
  if (!t || typeof t !== "object") bad("缺少");
  const int = (v, lo = 0, hi = 1e9) => Number.isInteger(v) && v >= lo && v <= hi,
    obj = (v) => !!v && typeof v === "object" && !Array.isArray(v),
    str = (v, n = 40) => typeof v === "string" && v.length <= n,
    key = (k) => typeof k === "string" && k.length > 0 && k.length <= 24,
    CATS = ["fav", "like", "meh", "hate"];
  if (!int(t.schema, 1, 99)) bad("版本");
  if (!obj(t.know) || Object.keys(t.know).length > 200) bad("喜好");
  // v0.38：一个人知道的喜好按东西记（送过什么就记一样，“不太在乎”的也记），玩久了会过 60 样；样数最多也就是东西的种数
  for (const [k, v] of Object.entries(t.know)) if (!key(k) || !obj(v) || Object.keys(v).length > Object.keys(ITEMS).length || Object.entries(v).some(([i, c]) => !ITEMS[i] || !CATS.includes(c))) bad("喜好");
  if (!obj(t.gifts) || Object.entries(t.gifts).some(([k, v]) => !key(k) || !Array.isArray(v) || v.length > GIFT.per || v.some((d) => !int(d)))) bad("送礼");
  if (!obj(t.half) || Object.entries(t.half).some(([k, v]) => !key(k) || !int(v, 1, 2))) bad("信任");
  if (!obj(t.talked) || Object.entries(t.talked).some(([k, v]) => !key(k) || !int(v))) bad("夜谈");
  if (!obj(t.ordered) || Object.entries(t.ordered).some(([k, v]) => !key(k) || !int(v))) bad("订单");
  if (!obj(t.heart) || Object.keys(t.heart).some((k) => !HEART_IDS.includes(k))) bad("心里话");
  for (const v of Object.values(t.heart)) if (!obj(v) || !int(v.seg, 0, 3) || !Array.isArray(v.pick) || v.pick.length > 2 || v.pick.some((p) => p !== 0 && p !== 1) || !int(v.req, 0, 1) || typeof v.got !== "boolean" || (v.day !== undefined && !int(v.day))) bad("心里话");
  if (!Array.isArray(t.skills) || t.skills.length > Object.keys(SKILLS).length || t.skills.some((x) => !SKILLS[x])) bad("本事");
  if (!obj(t.notes) || Object.entries(t.notes).some(([k, v]) => !key(k) || !int(v))) bad("纸条");
  if (!obj(t.noteDay) || !int(t.noteDay.day) || !int(t.noteDay.n, 0, 9)) bad("纸条");
  if (!Array.isArray(t.noteLog) || t.noteLog.length > NOTE.log || t.noteLog.some((n) => !obj(n) || !int(n.day) || !key(n.from) || !str(n.text, 200))) bad("纸条");
  const f = t.fest;
  if (!obj(f) || !int(f.day) || !Array.isArray(f.chat) || f.chat.length > 80 || f.chat.some((x) => !key(x)) || !Array.isArray(f.lamps) || f.lamps.length > LAMPS.length || f.lamps.some((i) => !int(i, 0, LAMPS.length - 1)) || typeof f.swap !== "boolean" || typeof f.read !== "boolean" || !Array.isArray(f.table) || f.table.length > 5 || f.table.some((x) => !ITEMS[x])) bad("节庆");
  const p = t.partner;
  if (p !== null && p !== undefined && (!obj(p) || !PARTNER_IDS.includes(p.id) || !["near", "set", "home"].includes(p.stage) || !int(p.day) || !int(p.hurt || 0))) bad("搭伙");
  if (!Array.isArray(t.kids) || t.kids.length > KIDS.max) bad("孩子");
  for (const k of t.kids) if (!obj(k) || !str(k.id, 8) || !str(k.name, 12) || !int(k.look, 0, 9) || !str(k.from, 12) || !int(k.day) || (k.master && !KID_CRAFTS[k.master]) || !int(k.start) || typeof k.learned !== "boolean" || !int(k.fed) || !int(k.hungry, 0, 999)) bad("孩子");
  const a = t.ask;
  if (a !== null && a !== undefined && (!obj(a) || !str(a.name, 12) || !str(a.from, 12) || !int(a.day) || !int(a.look, 0, 9))) bad("孩子");
  if (!obj(t.waters) || Object.entries(t.waters).some(([k, v]) => !SAMPLES[k] || typeof v !== "boolean")) bad("水样");
  if (!Array.isArray(t.research) || t.research.some((x) => !FISH[x]?.mutant)) bad("研究");
  if (!obj(t.fish) || Object.entries(t.fish).some(([k, v]) => !FISH[k] || !int(v, 1))) bad("图鉴");
  if (t.cast !== null && t.cast !== undefined && (!obj(t.cast) || !WATERS[t.cast.water])) bad("钓鱼");
  if (!int(t.dog)) bad("麦穗");
  const m = t.morning;
  if (!obj(m) || !int(m.day) || !Array.isArray(m.notes) || m.notes.length > 9 || m.notes.some((x) => !str(x, 16)) || !str(m.dog || "", 60) || !str(m.breakfast || "", 80)) bad("记录");
  if (!obj(t.qin) || !int(t.qin.left) || !int(t.qin.back)) bad("记录");
  if (t.intro !== undefined && (!obj(t.intro) || !int(t.intro.day) || typeof t.intro.told !== "boolean")) bad("记录");
  if (!obj(t.stats) || Object.values(t.stats).some((v) => !int(v))) bad("记录");
}
