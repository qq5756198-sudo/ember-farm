// v0.26.0「整顿」：营地体检以后的第一版改造。
// 1. 去掉与合并：罐装机、鱼篓、摊位不再建造（旧档第一次读进来时拆掉、退全部材料，摊位上的货挪到出货箱的挂牌格）；
//    农舍的加班生产、伤员优先并进法令簿；机床的弹药换成修理包；运输骡装车只捎一车货回来。
// 2. 心情三档：居民的士气每天往“该有的心情”走（伙食、床、房间、生活水准、法令、节庆……一条条写清楚），
//    低落的人常歇着、偶尔闹情绪不干，高昂的人多干一点，还会“来劲”一整天。
// 3. 防线：长夜三波按时来、头目 03:00 来，打完的空档用来修补，敲警钟可以提前叫；陷阱所有感染者都踩得响；
//    信标要你拉响；维修点只在打仗时修；防线图只算真能上岗的守卫。
// 4. 买卖和入口：出货箱看得到明天的行情、能挂牌；贺满仓分期有期限；机床能加急；每样建筑按 E 打开自己的一页。
// 新进度放在 s.tidy，原来的字段不动（转换只做一次）。
import {
  Engine as LongNightEngine,
  freshState as lnFresh,
  migrateState as lnMigrate,
  newGameState as lnNewGame,
  newGamePlusState as lnNewGamePlus,
  legacyGear,
} from "./longnight.js";
import { hashOf, rngOf } from "./undertow.js";
import { ITEMS, BUILDINGS, ZOMBIES } from "./data.js";
import { DECREES, DECREE_SLOTS } from "./winter-data.js";
import { LATHE_MODES, CARGO, HELPER_ROLES } from "./outpost-data.js";
import { BOSSES } from "./undertow-data.js";
import { LN } from "./longnight-data.js";
import { gearDef } from "./gear-data.js";
import {
  TIDY_SCHEMA,
  RETIRED,
  LISTING,
  MOOD,
  MOOD_FACTORS,
  TIER_NAMES,
  INSPIRE,
  INSPIRE_TRUST,
  LN_PACE,
  TRAP_ALL,
  TOWER,
  LURE,
  HEMC,
  LATHE_RUSH,
  KIT_TYPES,
  KIT,
  CARD_TYPES,
  DECREE_MOOD,
  CARGO_RETURN,
  RETRAIN,
  ROLE_MASTER,
} from "./tidy-data.js";

export { legacyGear };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " " + n)
    .join("、");
const RES_NAMES = { farmer: "阿禾", medic: "许医生", mechanic: "陈工" };
// 自己写了每帧怎么动、从不经过原来那段踩陷阱代码的几种（装死者站起来、看门的头目走路时会经过，不算）
const OWN_AI = ["spitter", "stalker", "brute", "nurse"];
const BOSS_TYPES = ["brute", "nurse"];

const tidyDefaults = () => ({
  schema: TIDY_SCHEMA,
  // 旧档转换：哪天、做了什么（第二天早上的总结里列一张清单）
  converted: null,
  // 出货箱的挂牌
  listing: [],
  listClock: 0,
  listLog: [],
  listedDay: 0,
  // 心情：每人来劲、闹情绪的记录
  mood: {},
  lucky: { day: 0, plots: [] },
  // 长夜的警钟：哪天提前叫了几次
  bell: { day: 0, early: 0 },
  // 拉响的信标
  lure: { id: "", until: 0 },
  // 贺满仓：这一笔还了几期、逾期过没有、哪天以前不再垫付
  hemc: { since: 0, lateEver: false, refuseUntil: 0 },
  // 机床加急：哪天加的急、哪天以前卡着料
  lathe: { rush: 0, jam: 0 },
  // 运输骡：v0.26 以后装的车只捎一车货回来
  cargoNew: false,
  cargoPaid: false,
  // 学徒并进队员卡：改学职能
  retrain: null,
  // 修理包修了几次（成就册）
  kits: 0,
  // 公共厨房哪天晚饭没柴（那天不算“吃得好”）
  coldKitchen: 0,
  // 这个长夜陷阱、瞭望塔各打倒几只（战报）
  night: { day: 0, trap: 0, tower: 0 },
  // 维修点：这一场（或上一场）修了多少、用了几块木头
  repair: { on: false, day: 0, hp: 0, wood: 0 },
});

function convertOld(s) {
  const notes = [],
    st = (s.storage ??= {});
  const give = (bundle) => {
    for (const [id, n] of Object.entries(bundle)) if (n > 0 && ITEMS[id]) st[id] = (st[id] || 0) + n;
  };
  // 拆掉不再建造的三样，退全部材料
  const keep = [];
  for (const b of s.buildings || []) {
    if (!RETIRED.includes(b.type)) {
      keep.push(b);
      continue;
    }
    const d = BUILDINGS[b.type];
    give(d.cost);
    let extra = "";
    if (b.type === "fishTrap" && (b.fishDay || 0) < (s.day || 1)) {
      give({ fish: 1 });
      extra = "，今天的一条银鳞鱼也收进了仓库";
    }
    notes.push(d.name + "拆了：退回" + itemsText(d.cost) + extra);
  }
  if (keep.length !== (s.buildings || []).length) s.buildings = keep;
  const c = s.colony;
  if (c) {
    // 摊位上的货挪到出货箱的挂牌格（最多三格），多的退回仓库
    const slots = (c.stall || []).filter((x) => x && ITEMS[x.item] && x.qty > 0);
    if (slots.length) {
      const moved = [];
      for (const x of slots) {
        if (s.tidy.listing.length < LISTING.slots) {
          const qty = Math.min(LISTING.max, x.qty);
          s.tidy.listing.push({ id: "list-" + (s.idCounter = (s.idCounter || 1) + 1), item: x.item, qty });
          if (x.qty > qty) give({ [x.item]: x.qty - qty });
          moved.push(ITEMS[x.item].name + " " + x.qty);
        } else give({ [x.item]: x.qty });
      }
      notes.push("摊位上的货（" + moved.join("、") + "）挪到了出货箱的挂牌格");
    }
    c.stall = [];
    c.stallLog = [];
    // 罐装机上的配送箱：做好的收进仓库，没做完的退回原料
    let done = 0,
      undone = 0;
    const back = {};
    for (const j of c.production || []) {
      if (j.station !== "canner") continue;
      if (j.ready) {
        give(j.out || {});
        done++;
      } else {
        give(j.cost || {});
        for (const [id, n] of Object.entries(j.cost || {})) back[id] = (back[id] || 0) + n;
        undone++;
      }
    }
    if (done + undone) {
      c.production = (c.production || []).filter((j) => j.station !== "canner");
      if (done) notes.push("罐装机上做好的 " + done + " 批配送箱收进了仓库");
      if (undone) notes.push("罐装机上没做完的 " + undone + " 批配送箱退回原料：" + itemsText(back));
    }
  }
  // 农舍的两条政策并进法令簿
  const f = s.frontier,
    w = s.winter;
  if (f?.policy && w) {
    const act = s.storyCampaign?.act || 1,
      slots = DECREE_SLOTS(act);
    for (const [kind, value, id] of [
      ["work", "overtime", "overtime"],
      ["food", "injured", "injured"],
    ]) {
      if (f.policy[kind] !== value) continue;
      if (w.decrees.includes(id)) notes.push("农舍的「" + DECREES[id].name + "」已经是法令了");
      else if (w.decrees.length < slots) {
        w.decrees = [...w.decrees, id];
        notes.push("农舍的「" + DECREES[id].name + "」并进了法令簿，照样生效");
      } else notes.push("农舍的「" + DECREES[id].name + "」没签进法令簿（法令位满了），要的话自己去签");
    }
    f.policy.work = w.decrees.includes("overtime") ? "overtime" : "standard";
    f.policy.food = w.decrees.includes("injured") ? "injured" : "equal";
  }
  // 补给计划盯着“设施 · 罐装机”的：改回跟随主线
  if (s.supply?.pin === "building:canner") {
    s.supply.pin = "auto";
    notes.push("补给计划原来盯着罐装机，改回跟随主线");
  }
  // 贺满仓的旧账：期限从今天算，不追溯
  if (s.far?.hemc?.debt) {
    s.tidy.hemc.since = s.day || 1;
    notes.push("欠贺满仓的那笔：以后每期 3 天到期，从今天算");
  }
  // 机床的弹药交给制作台
  const lathe = s.outpost?.lathe;
  if (lathe?.mode === "ammo") {
    lathe.mode = "parts";
    notes.push("机床不再做弹药（制作台能做），改成优先零件；还能选修理包");
  }
  if (notes.length) s.tidy.converted = { day: s.day || 1, notes, shown: false };
}

export function migrateState(s) {
  lnMigrate(s);
  if (!s.tidy) {
    s.tidy = tidyDefaults();
    convertOld(s);
  } else {
    const d = tidyDefaults(),
      x = s.tidy;
    s.tidy = {
      ...d,
      ...x,
      converted: x.converted ? { ...x.converted, notes: [...(x.converted.notes || [])] } : null,
      listing: (x.listing || []).map((l) => ({ ...l })),
      listLog: [...(x.listLog || [])],
      mood: Object.fromEntries(Object.entries(x.mood || {}).map(([k, v]) => [k, { ...v, insp: v.insp ? { ...v.insp } : null }])),
      lucky: { ...d.lucky, ...x.lucky, plots: [...(x.lucky?.plots || [])] },
      bell: { ...d.bell, ...x.bell },
      lure: { ...d.lure, ...x.lure },
      hemc: { ...d.hemc, ...x.hemc },
      lathe: { ...d.lathe, ...x.lathe },
      night: { ...d.night, ...x.night },
      repair: { ...d.repair, ...x.repair },
      retrain: x.retrain ? { ...x.retrain } : null,
    };
  }
  return s;
}
export function freshState() {
  const s = lnFresh();
  delete s.tidy;
  return migrateState(s);
}
export function newGameState(origin = "farmer") {
  const s = lnNewGame(origin);
  delete s.tidy;
  return migrateState(s);
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  const s = lnNewGamePlus(old, origin, keep, book);
  delete s.tidy;
  return migrateState(s);
}

// 读档前：v0.25 及更早的存档（没有整顿字段）第一次读进来之前，原样留一份在升级检查点里（那一格空着的话）。
// 第一次自动存档时，上一份（也就是转换前的那份）照例进备份位。
export const needsUpgrade = (text) => {
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && (!raw.storyCampaign || !raw.tidy);
  } catch {
    return false;
  }
};

export class Engine extends LongNightEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
  }
  // 旧档转换：进了游戏（第一帧）说一声，第二天早上的日终总结里有清单
  update(dt, input = {}) {
    const cv = !this.paused && this.td?.converted;
    if (cv && !cv.told) {
      cv.told = true;
      const text = "营地整顿：" + cv.notes.join("；") + "。退的材料都在仓库里。";
      this.toast(text.length > 150 ? "营地整顿：拆掉和合并了 " + cv.notes.length + " 样东西，退的材料都在仓库里。明早的日终总结里有清单。" : text, "gold");
      if (this.o) this.olog(text.slice(0, 160), "gold");
    }
    return super.update(dt, input);
  }
  get td() {
    return this.s.tidy;
  }
  // 按存档种子和日子定的骰子：读档不重掷
  tdRoll(...key) {
    return rngOf(hashOf(this.ut?.seed || 1, "td", ...key))();
  }

  // ================= 不再建造的三样 =================
  startBuild(type) {
    if (BUILDINGS[type]?.retired) {
      this.toast(BUILDINGS[type].name + "不再建造了：" + (type === "stall" ? "到出货箱挂牌" : type === "canner" ? "配送箱改在篝火灶上做" : "钓鱼到林边池塘") + "。", "warn");
      return false;
    }
    return super.startBuild(type);
  }

  // ================= 出货箱的挂牌 =================
  listReason(item, n) {
    if (this.s.region !== "farm") return "回到农场再挂牌";
    const it = ITEMS[item];
    if (!it || !(it.sell > 0) || it.protected || !LISTING.types.includes(it.type) || this.isWorn?.(item)) return "这样东西不能挂牌";
    if (this.td.listing.length >= LISTING.slots) return "三格都挂满了";
    if (!Number.isInteger(n) || n < 1 || n > LISTING.max) return "一格最多挂 " + LISTING.max + " 份";
    if ((this.s.inventory[item] || 0) + (this.s.storage[item] || 0) < n) return "不够 " + n + " 份";
    return "";
  }
  listItem(item, n = 1) {
    n = Math.floor(Number(n));
    const reason = this.listReason(item, n);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const clean = this.cleanSell ? this.cleanSell(item, n) : n;
    if (clean < n) {
      if (clean > 0) this.hotPartToast?.(item, clean);
      else this.toast("来路不明的东西不能挂牌。", "warn");
      return false;
    }
    if (!this.pay({ [item]: n }, true, false)) {
      this.toast("不够 " + n + " 份。", "warn");
      return false;
    }
    this.td.listing.push({ id: "list-" + this.s.idCounter++, item, qty: n });
    this.td.listedDay = this.s.day;
    this.toast(ITEMS[item].name + " ×" + n + " 挂上了：白天每 " + LISTING.every / 60 + " 小时卖一件，每件 " + this.listPrice(item) + " 金币。", "gold");
    return true;
  }
  unlistItem(id) {
    const l = this.td.listing.find((x) => x.id === id);
    if (!l) return false;
    this.td.listing = this.td.listing.filter((x) => x !== l);
    this.putStorage({ [l.item]: l.qty });
    this.toast("取下了 " + ITEMS[l.item].name + " ×" + l.qty + "，放回仓库。");
    return true;
  }
  listPrice(item) {
    return Math.max(1, Math.round((ITEMS[item]?.sell || 0) * LISTING.mult));
  }
  processStall(n) {
    super.processStall(n);
    const t = this.td;
    if (!t?.listing.length) return;
    const m = this.s.minute;
    if (m < LISTING.from || m >= LISTING.to) return;
    t.listClock += n;
    while (t.listClock >= LISTING.every && t.listing.length) {
      t.listClock -= LISTING.every;
      const slot = t.listing[0],
        price = this.listPrice(slot.item);
      slot.qty--;
      this.s.money += price;
      this.s.stats.sold = (this.s.stats.sold || 0) + 1;
      t.listLog.unshift("第" + this.s.day + "天 " + String(Math.floor(this.s.minute / 60)).padStart(2, "0") + ":00 · " + ITEMS[slot.item].name + " +" + price + " 金币");
      t.listLog = t.listLog.slice(0, LISTING.log);
      // 卖完一格；没卖完的挪到最后，三格轮着卖
      t.listing = t.listing.filter((x) => x.qty > 0);
      if (slot.qty > 0 && t.listing.length > 1) t.listing = [...t.listing.slice(1), slot];
    }
  }
  // 明天的行情（今天就看得到）
  shipTrendTomorrow(id) {
    return this.shipTrend ? this.shipTrend(id, this.s.day + 1) : 0;
  }
  festivalStars(kind = this.festivalKind()) {
    const stars = super.festivalStars(kind);
    if (kind === "seeds") stars[0] = this.td.listing.length > 0 || (this.td.listedDay > 0 && this.s.day - this.td.listedDay < 7);
    return stars;
  }

  // ================= 心情三档 =================
  moodFactors(r) {
    const out = [],
      add = (key, v = MOOD_FACTORS[key].v, text = MOOD_FACTORS[key].text) => out.push({ key, v, text });
    const o = this.o,
      w = this.w,
      ss = this.ss,
      day = this.s.day;
    if (o && o.dinnerDay >= day - 1 && o.missed.includes("r:" + r.id)) add("missed", MOOD_FACTORS.missed.v, o.dinnerDay === day ? "今晚没吃上饭" : MOOD_FACTORS.missed.text);
    if (w && this.ladderChecks()[1]) add("fine");
    if (o && o.dinnerDay >= day - 1 && o.crew?.some((c) => c.trait === "chatty" && !o.missed.includes("c:" + c.id))) add("chatty");
    if (this.c.residents.indexOf(r) >= this.residentsCapacity()) add("noBed");
    if (this.rooms?.().some((x) => x.active)) add("room");
    const lv = w?.ladder || 0;
    if (lv) add("ladder", MOOD_FACTORS.ladder.v * lv, MOOD_FACTORS.ladder.text + " " + lv + " 级");
    if (w)
      for (const [id, key] of Object.entries(DECREE_MOOD)) {
        if (!this.decree(id)) continue;
        if (id === "winterStore" && !this.coldActive()) continue;
        if (id === "injured" && r.id === "medic") continue;
        add(key);
      }
    if (ss) {
      const last = ss.fest?.lastDay || 0;
      if (last > 0 && day - last < 3) add("festival");
      const decor = ss.decor?.length || 0;
      if (decor >= 2) add("decor", decor >= 4 ? 4 : 2);
      if ((ss.ali?.murals || 0) >= 3) add("murals");
      if (ss.qin?.phase === "left") add("photo");
      if ((ss.trust?.[r.id] || 0) >= 6) add("trust");
    }
    if (this.showcaseDone?.("photos")) add("photos");
    const tired = r.fatigue || 0;
    if (tired >= 85) add("worn");
    else if (tired >= 60) add("tired");
    return out;
  }
  moodTarget(r) {
    return clamp(MOOD.home + this.moodFactors(r).reduce((a, f) => a + f.v, 0), MOOD.min, 100);
  }
  moodTier(r) {
    const m = r?.morale ?? 60;
    return m < MOOD.low ? "low" : m >= MOOD.high ? "high" : "normal";
  }
  moodRec(id) {
    return (this.td.mood[id] ??= { insp: null, last: 0, strike: 0 });
  }
  striking(r) {
    return this.td?.mood[r.id]?.strike === this.s.day;
  }
  inspired(r, kind) {
    const i = this.td?.mood[r.id]?.insp;
    if (!i) return false;
    if (kind && i.kind !== kind) return false;
    // 来劲管一整天；守卫的“眼尖”管到第二天天亮
    return i.day === this.s.day || (i.kind === "guard" && i.day === this.s.day - 1 && this.s.minute < 360);
  }
  inspireKind(r) {
    const jobs = Object.entries(r.priorities || {})
      .filter(([, v]) => v > 0)
      .sort((a, b) => a[1] - b[1]);
    const top = jobs[0]?.[0] || r.role;
    return INSPIRE[top] ? top : INSPIRE[r.id] ? r.id : "farmer";
  }
  residentActive(r) {
    if (this._moodIdle?.has(r.id)) return false;
    if (this.td && this.striking(r)) {
      const attack = ["warning", "active"].includes(this.s.horde.phase);
      if (!(attack && (r.workRole === "guard" || r.role === "guard"))) return false;
    }
    return super.residentActive(r);
  }
  // 房间、工作餐、晚饭、法令、装饰这些每天都有的加减，改成“该有的心情”里的一条，不再一天天往上叠
  roomMood() {
    return 0;
  }
  dailyMood() {
    return false;
  }
  feedResidents(auto = false) {
    const keep = new Map(this.c.residents.map((r) => [r.id, r.morale]));
    try {
      return super.feedResidents(auto);
    } finally {
      for (const r of this.c.residents) if (keep.has(r.id)) r.morale = keep.get(r.id);
    }
  }
  serveDinner() {
    const keep = new Map(this.c.residents.map((r) => [r.id, r.morale]));
    this._inDinner = true;
    try {
      return super.serveDinner();
    } finally {
      this._inDinner = false;
      for (const r of this.c.residents) if (keep.has(r.id)) r.morale = keep.get(r.id);
    }
  }
  takeFarm(cost) {
    const ok = super.takeFarm(cost);
    // 公共厨房晚饭要烧的那 1 份木材没有：记下来，这顿不算“吃得好”（原来只提醒一句）
    if (!ok && this._inDinner && this.td && cost && Object.keys(cost).length === 1 && cost.wood === 1 && this.decree?.("kitchen")) this.td.coldKitchen = this.s.day;
    return ok;
  }
  ladderChecks() {
    const checks = super.ladderChecks();
    if (this.td?.coldKitchen && this.td.coldKitchen === this.o?.dinnerDay && this.decree?.("kitchen")) checks[1] = false;
    return checks;
  }
  moodDrift() {
    for (const r of this.c.residents) {
      const m = r.morale ?? 60,
        target = this.moodTarget(r);
      r.morale = clamp(Math.round(m + (target - m) * MOOD.drift), 0, 100);
    }
  }
  // 高昂的人多干的那一件
  extraWork(r) {
    const role = r.workRole;
    if (role === "farmer") {
      const dry = this.s.plots.filter((p) => (p.region || "farm") === "farm" && p.crop && !this.plotWatered(p)).slice(0, r.id === "farmer" ? 5 : 3);
      if (dry.length) {
        for (const p of dry) this.waterPlot(p);
        return "多浇了 " + dry.length + " 块田";
      }
      if (this.g) {
        const day = this.s.day,
          list = this.s.plots.filter((p) => this.isFarmPlot?.(p) && p.crop && this.gRec(p).t !== day).slice(0, 2);
        for (const p of list) {
          const rec = this.gRec(p);
          rec.t = day;
          rec.c = clamp(rec.c + 10, 0, 65);
        }
        if (list.length) return "多照看了 " + list.length + " 块田";
      }
      return "";
    }
    if (role === "mechanic") {
      const b = this.s.buildings.filter((x) => x.hp > 0 && x.hp < (BUILDINGS[x.type]?.hp || 0)).sort((a, c) => a.hp / BUILDINGS[a.type].hp - c.hp / BUILDINGS[c.type].hp)[0];
      if (b && this.takeFarm({ wood: 1 })) {
        b.hp = Math.min(BUILDINGS[b.type].hp, b.hp + (r.id === "mechanic" ? 35 : 20) + (this.hasBuilding?.("repairpost") ? 15 : 0));
        this.navRevision = (this.navRevision || 0) + 1;
        return "多修了一处" + BUILDINGS[b.type].name;
      }
      return "";
    }
    if (role === "medic" && this.s.region === "farm" && this.s.player.hp < 100) {
      this.s.player.hp = Math.min(100, this.s.player.hp + (r.id === "medic" ? 12 : 8));
      return "又给你包扎了一下";
    }
    return "";
  }
  inspireMorning() {
    const day = this.s.day;
    for (const r of this.c.residents) {
      const rec = this.moodRec(r.id);
      if (this.moodTier(r) !== "high" || (rec.last && day - rec.last < MOOD.gap)) continue;
      if (this.tdRoll("insp", day, r.id) >= MOOD.inspire) continue;
      const kind = this.inspireKind(r),
        I = INSPIRE[kind];
      rec.insp = { day, kind };
      rec.last = day;
      let extra = "";
      if (kind === "medic") {
        this.putStorage(I.give);
        extra = "（" + itemsText(I.give) + "已入仓）";
      } else if (kind === "mechanic") {
        let n = 0;
        for (const b of this.s.buildings)
          if (b.hp > 0 && b.hp < (BUILDINGS[b.type]?.hp || 0)) {
            b.hp = BUILDINGS[b.type].hp;
            n++;
          }
        if (n) this.navRevision = (this.navRevision || 0) + 1;
        extra = n ? "（修好了 " + n + " 处）" : "（营地本来就没什么要修的）";
      } else if (kind === "farmer") this.td.lucky = { day, plots: [] };
      const text = this.residentName(r.id) + "今天来劲了：" + I.name + "——" + I.text + extra + "。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
      this.events.push({ type: "tdInspire", id: r.id });
    }
  }
  residentName(id) {
    return super.residentName ? super.residentName(id) : RES_NAMES[id] || id;
  }
  // 阿禾“好手气”：她今天照看过的田记下来
  gHelper() {
    const lucky = this.td?.lucky,
      on = lucky && lucky.day === this.s.day && this.c.residents.some((r) => r.id === "farmer" && this.inspired(r, "farmer"));
    const before = on ? new Map(this.s.plots.map((p) => [p.id, this.g?.plots[p.id]?.t])) : null;
    super.gHelper();
    if (on)
      for (const p of this.s.plots) {
        const t = this.g?.plots[p.id]?.t;
        if (t === this.s.day && before.get(p.id) !== t && !lucky.plots.includes(p.id) && lucky.plots.length < 60) lucky.plots.push(p.id);
      }
  }
  handHarvest(p) {
    const lucky = this.td?.lucky,
      crop = p?.crop,
      hit = lucky && lucky.plots.includes(p?.id) && this.s.day - lucky.day <= 1;
    const ok = super.handHarvest(p);
    if (ok && hit && crop) {
      lucky.plots = lucky.plots.filter((id) => id !== p.id);
      this.receive({ [crop]: INSPIRE.farmer.bonus });
      this.effects?.push({ x: p.x, y: p.y - 52, text: "阿禾的好手气 +" + INSPIRE.farmer.bonus, t: 1.1, color: "#ffd76a" });
    }
    return ok;
  }

  // ================= 每个钟点、每天 =================
  workHour() {
    const hour = Math.floor(this.s.minute / 60),
      day = this.s.day;
    // 23:00 还没答复的借宿：按法令「敞开营门」的规矩留宿，没签就婉拒（原来是让人干等到走）
    if (hour === 23 && this.ss?.lodger?.phase === "asking" && !this.ss.lodger.qin) this.lodgerDefault();
    // 低落的人：这个钟点四成机会歇着
    const idle = new Set();
    for (const r of this.c.residents) if (this.moodTier(r) === "low" && this.tdRoll("idle", day, hour, r.id) < MOOD.idle) idle.add(r.id);
    if (hour === 6)
      for (const r of this.c.residents)
        if (this.moodTier(r) === "low" && this.tdRoll("strike", day, r.id) < MOOD.strike) {
          this.moodRec(r.id).strike = day;
          const text = this.residentName(r.id) + "心情太差，今天闹情绪不干活。看看他为什么不高兴（居民页）。";
          this.toast(text, "warn");
          if (this.o) this.olog(text, "warn");
        }
    const active0 = new Set(this.c.residents.filter((r) => !idle.has(r.id) && this.residentActive(r)).map((r) => r.id));
    this._moodIdle = idle;
    try {
      super.workHour();
    } finally {
      this._moodIdle = null;
    }
    const awake = this.s.minute >= 360 && this.s.minute < 1320;
    for (const r of this.c.residents) {
      if (!awake || r.workRole !== "rest" || !r.fed) continue;
      if (this.striking(r)) r.status = "心情太差，今天闹情绪不干活";
      else if (idle.has(r.id)) r.status = "心情低落，这个钟点歇着";
    }
    // 高昂的人：这个钟点两成五机会多干一件
    for (const r of this.c.residents) {
      if (!active0.has(r.id) || this.moodTier(r) !== "high" || r.workRole === "rest" || r.workRole === "guard") continue;
      if (this.tdRoll("extra", day, hour, r.id) >= MOOD.extra) continue;
      const did = this.extraWork(r);
      if (did) r.status = (r.status || "") + " · 心情好，" + did;
    }
    if (hour === 8) this.inspireMorning();
    if (hour === 6) this.retrainMorning();
  }
  onNewDay() {
    // 原来每天叠加的（法令、生活水准、装饰、信任……）都算进“该有的心情”里（dailyMood 关掉了那几处），这里往该有的心情走
    super.onNewDay();
    this.moodDrift();
    const t = this.td;
    if (t.lucky.day && this.s.day - t.lucky.day > 1) t.lucky = { day: 0, plots: [] };
    for (const rec of Object.values(t.mood)) if (rec.insp && this.s.day - rec.insp.day > 1) rec.insp = null;
    if (t.lure.id && this.absNow() >= t.lure.until) t.lure = { id: "", until: 0 };
    // 加班周、伤员优先：和农舍的那两条合成一套（法令说了算）
    this.syncPolicy();
  }
  syncPolicy() {
    const f = this.f;
    if (!f?.policy || !this.w) return;
    f.policy.work = this.decree("overtime") ? "overtime" : "standard";
    f.policy.food = this.decree("injured") ? "injured" : "equal";
  }
  overtimeFatigue() {
    return 1;
  }
  toggleDecree(id) {
    const ok = super.toggleDecree(id);
    if (ok) this.syncPolicy();
    return ok;
  }
  setPolicy(kind, value) {
    this.toast("工作和伙食的规矩都在法令簿里签（加班周、伤员优先）。", "warn");
    return false;
  }

  // ================= 借宿：你睡了就按法令的规矩办 =================
  lodgerDefault() {
    const l = this.ss.lodger;
    if (!l || l.phase !== "asking") return false;
    if (this.decree?.("openGate") && !this.lodgerReason() && this.decideLodger("host")) {
      if (this.o) this.olog(l.name + "等到深夜没人答复，铁锹照「敞开营门」的规矩留他住下了。");
      return true;
    }
    this.decideLodger("decline");
    if (this.o) this.olog(l.name + "等到深夜没人答复，铁锹客气地请他另找地方。");
    return true;
  }

  // ================= 法令「拾荒队」：代价对铁锹这样的援建队员也算 =================
  helperHour(h) {
    const hour = Math.floor(this.s.minute / 60);
    if (this.decree?.("salvage") && hour >= 6 && hour < 10 && !this.mealHour?.()) {
      const camp = this.sc?.camp || this.campSite?.() || { x: 830, y: 480 };
      Object.assign(h, { status: "跟拾荒队出去了", task: "idle", target: { x: camp.x + 64, y: camp.y + 20 } });
      return;
    }
    return super.helperHour(h);
  }

  // ================= 营火夜谈：心情低落的人聊完当晚回到平常 =================
  talk(topic) {
    const [kind, who] = String(topic).split(":"),
      r = kind === "comfort" ? this.resident(who) : null,
      low = r && this.moodTier(r) === "low";
    const ok = super.talk(topic);
    if (ok && r && r.morale < MOOD.low + 10) {
      r.morale = MOOD.low + 10;
      if (low) this.toast(this.residentName(r.id) + "心里好受多了：今晚回到平常。", "gold");
    }
    return ok;
  }

  // ================= 学徒并进队员卡：改学职能 =================
  retrainMasters(role) {
    const out = [];
    const res = ROLE_MASTER[role];
    if (res && this.resident(res)) out.push({ id: res, name: this.residentName(res) });
    if (role === "guard") for (const r of this.c.residents) if ((r.priorities?.guard || 0) > 0 && !out.some((x) => x.id === r.id)) out.push({ id: r.id, name: this.residentName(r.id) });
    for (const c of this.o?.crew || []) if (c.role === role) out.push({ id: c.id, name: c.name });
    return out;
  }
  retrainReason(pupil, role) {
    if (this.td.retrain || this.ss?.apprentice) return "已经有人在带徒弟了";
    const c = (this.o?.crew || []).find((x) => x.id === pupil);
    if (!c) return "只有援建队员能改学职能";
    if (!HELPER_ROLES[role]) return "没有这样的职能";
    if (c.role === role) return c.name + "本来就是" + HELPER_ROLES[role];
    if (c.task === "scout" || (c.outDay === this.s.day && c.backDay !== this.s.day)) return c.name + "出去侦察了，回来再说";
    if (!this.retrainMasters(role).filter((m) => m.id !== pupil).length) return "营地里没有会" + HELPER_ROLES[role] + "的人带他";
    return "";
  }
  startRetrain(pupil, role) {
    const reason = this.retrainReason(pupil, role);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const master = this.retrainMasters(role).find((m) => m.id !== pupil),
      c = this.o.crew.find((x) => x.id === pupil);
    this.td.retrain = { master: master.id, pupil, role, start: this.s.day };
    const text = master.name + "开始带" + c.name + "学" + HELPER_ROLES[role] + "：" + RETRAIN.days + " 天后改行；这几天加工慢一成。";
    this.toast(text, "gold");
    if (this.o) this.olog(text);
    return true;
  }
  stopRetrain() {
    if (!this.td.retrain) return false;
    this.td.retrain = null;
    this.toast("改学职能停下了。");
    return true;
  }
  apprenticeReason(master, pupil) {
    if (this.td?.retrain) return "已经有人在带徒弟了";
    return super.apprenticeReason(master, pupil);
  }
  retrainMorning() {
    const t = this.td.retrain;
    if (!t) return;
    const c = (this.o?.crew || []).find((x) => x.id === t.pupil);
    const masterHere = this.resident(t.master) || (this.o?.crew || []).some((x) => x.id === t.master);
    if (!c || !masterHere) {
      this.td.retrain = null;
      if (this.o) this.olog("师父或徒弟不在了，改学职能中断。", "warn");
      return;
    }
    const m = this.resident(t.master);
    if (m) m.fatigue = clamp((m.fatigue || 0) + RETRAIN.tired, 0, 100);
    if (this.s.day - t.start >= RETRAIN.days) {
      c.role = t.role;
      c.status = "改行做" + HELPER_ROLES[t.role];
      this.td.retrain = null;
      this.addTrust?.(c.id, 1);
      const text = c.name + "出师了：以后做" + HELPER_ROLES[t.role] + "。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    }
  }
  efficiency() {
    return super.efficiency() * (this.td?.retrain ? RETRAIN.slow : 1);
  }

  // ================= 长夜：三波按时来，头目 03:00 来；敲警钟提前叫 =================
  lnBegin() {
    const ok = super.lnBegin();
    if (ok) {
      this.td.bell = { day: this.ln.night?.day || this.s.day, early: 0 };
      this.td.night = { day: this.ln.night?.day || this.s.day, trap: 0, tower: 0 };
      this.lx.calm = false;
      if (this.s.region === "farm") this.assignRegion();
      const boss = BOSSES[this.lnBossId(this.ln.night.n)]?.name || "头目";
      this.toast("三波按时来：22:00、00:00、02:00，03:00 " + boss + "来。打完的空档修围栏、补弹药；等不及就去敲菜地北边的警钟。", "warn");
    }
    return ok;
  }
  // 守完睡到 08:00：落在整点上（原来加减分钟会多出一点零头）
  lnNap() {
    const ok = super.lnNap();
    if (Math.abs(this.s.minute - LN.red) < 1e-6) this.s.minute = LN.red;
    return ok;
  }
  lnBossNote(N) {
    return "03:00，" + (BOSSES[this.lnBossId(N.n)]?.name || "头目") + "会来。";
  }
  lnEnd(N) {
    super.lnEnd(N);
    if (this.s.region === "farm") this.assignRegion();
  }
  lnBetween() {
    const N = this.ln?.night;
    if (!N || this.s.region !== "farm") return false;
    return N.left === 0 && this.hordeAlive().length === 0 && !(N.wave >= 3 && N.boss);
  }
  lnNext() {
    const N = this.ln?.night;
    if (!N) return null;
    if (N.wave < 3) return { what: "wave", k: N.wave + 1, at: N.start + LN.waveAt[N.wave] };
    if (!N.boss) return { what: "boss", at: N.start + LN_PACE.bossAt };
    return null;
  }
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
    const next = this.lnNext(),
      now = this.absNow();
    if (next && now >= next.at) {
      lx.calm = false;
      if (next.what === "wave") this.lnWave(next.k);
      else this.lnSpawnBoss();
    } else if (next && N.left === 0 && !alive && !lx.calm) {
      lx.calm = true;
      const left = Math.max(0, Math.ceil((next.at - now) / 1.6)),
        can = LN_PACE.maxEarly - (this.td.bell.early || 0);
      this.toast(
        (next.what === "wave" ? "这一波打完了。下一波" : "第三波打完了。" + (BOSSES[this.lnBossId(N.n)]?.name || "头目")) +
          "大约 " +
          left +
          " 秒后到：抓紧修围栏、补弹药、包扎。" +
          (can > 0 ? "等不及就去敲警钟提前叫（多一次稀有掉落，还能敲 " + can + " 次）。" : ""),
        "gold",
      );
    } else if (!next && N.left === 0 && !alive) return this.lnHold("cleared");
    this.s.horde.remaining = Math.min(100, N.left);
    lx.thunderT -= dt;
    if (lx.thunderT <= 0) this.lnThunder();
  }
  lnBellReason() {
    const N = this.ln?.night;
    if (!N) return "长夜里才敲警钟";
    if (!this.lnBetween()) return "这一波还没打完";
    if (!this.lnNext()) return "今晚已经没有下一波了";
    if ((this.td.bell.early || 0) >= LN_PACE.maxEarly) return "今晚已经提前叫过 " + LN_PACE.maxEarly + " 次";
    return "";
  }
  lnBell() {
    const reason = this.lnBellReason();
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const next = this.lnNext();
    this.td.bell.early = (this.td.bell.early || 0) + 1;
    this.lx.calm = false;
    if (next.what === "wave") this.lnWave(next.k);
    else this.lnSpawnBoss();
    this.toast("当——当——！你敲响了警钟，提前把" + (next.what === "wave" ? "第 " + next.k + " 波" : "头目") + "叫来了：天亮后多一次稀有掉落。", "warn");
    this.events.push({ type: "tdBell" });
    return true;
  }
  // 顶上横幅、警钟上写的：下一波（或头目）还有几秒、还能不能敲钟
  lnInfo() {
    const out = super.lnInfo(),
      N = this.ln?.night;
    if (out?.night && N) {
      const next = this.lnNext();
      out.night.gap = null;
      out.night.next = next ? { what: next.what, k: next.k || 0, secs: Math.max(0, Math.ceil((next.at - this.absNow()) / 1.6)) } : null;
      out.night.bell = !this.lnBellReason();
      out.night.early = this.td.bell.day === N.day ? this.td.bell.early || 0 : 0;
    }
    return out;
  }
  lnDraws(N, h) {
    const extra = this.td?.bell.day === N.day ? this.td.bell.early || 0 : 0;
    return this.rareDraws(["lnLoot", N.day, h], 1 + Math.floor(h / 3) + extra);
  }

  // ================= 陷阱、信标、维修点、守卫 =================
  bossy(e) {
    return !!e && (BOSS_TYPES.includes(e.type) || this.bossKind?.(e) === "guard");
  }
  // 自己写了每帧怎么动、不经过原来踩陷阱那段的：吐酸者、潜行者、大块头、护士长、爬行的、灰隼团
  ownAI(e) {
    return !!e && !e.uParty && (!!e.crawl || e.type === "raider" || OWN_AI.includes(e.type));
  }
  lurePulling(b) {
    const t = this.td?.lure;
    return !!t && t.id === b.id && this.absNow() < t.until;
  }
  pulledLure() {
    const t = this.td?.lure;
    if (!t?.id || this.absNow() >= t.until) return null;
    return this.s.buildings.find((b) => b.id === t.id && b.type === "lure" && b.hp > 0) || null;
  }
  updateEnemy(e, dt) {
    const farm = this.s.region === "farm";
    // 拉响的信标：自己写了怎么动的几种也往信标走（头目、灰隼团不理）
    if (farm && e && !e.dead && this.ownAI(e) && e.type !== "raider" && !this.bossy(e)) {
      const lure = this.pulledLure();
      if (lure && dist(e, lure) < LURE.r && dist(e, this.s.player) > LURE.near) return this.lureMove(e, lure, dt);
    }
    const out = super.updateEnemy(e, dt);
    if (farm && e && !e.dead && this.ownAI(e)) this.trapCheck(e, dt);
    return out;
  }
  lureMove(e, lure, dt) {
    const Z = ZOMBIES[e.type] || ZOMBIES.slow;
    e.cooldown = Math.max(0, (e.cooldown || 0) - dt);
    e.flash = Math.max(0, (e.flash || 0) - dt);
    e.state = "chase";
    const near = this.s.buildings.find((b) => b.hp > 0 && ["fence", "gate", "lure"].includes(b.type) && !b.open && dist(b, e) < 65);
    if (near && e.cooldown <= 0) {
      near.hp = Math.max(0, near.hp - Z.damage * 2);
      e.cooldown = 1;
      this.navRevision = (this.navRevision || 0) + 1;
    }
    this.trapCheck(e, dt);
    if (e.dead || dist(e, lure) <= 48) return;
    e.pathTimer = (e.pathTimer || 0) - dt;
    if (e.pathTimer <= 0 || !e.path?.length) {
      e.path = this.pathTo(e, lure);
      e.pathTimer = 0.7;
    }
    if (e.path?.[0] && dist(e, e.path[0]) < 18) e.path.shift();
    const t = this.lineClear(e, lure) ? lure : e.path?.[0];
    if (t) {
      const a = Math.atan2(t.y - e.y, t.x - e.x),
        sp = Z.speed * (e.crawl ? 0.5 : 1);
      e.facing = a;
      this.moveEntity(e, Math.cos(a) * sp * dt, Math.sin(a) * sp * dt, true);
    }
  }
  // 自己写了怎么动的几种踩到陷阱（原来踩不响）；其余的照原来那段代码踩
  trapCheck(e, dt) {
    e.tdTrapCd = Math.max(0, (e.tdTrapCd || 0) - dt);
    if (e.tdTrapCd > 0 || e.dead) return;
    const trap = this.s.buildings.find((b) => b.type === "trap" && b.hp > 0 && dist(b, e) < TRAP_ALL.r);
    if (!trap) return;
    // 灰隼团：一半机会认出这个陷阱绕开（每人每个陷阱定一次）
    if (e.type === "raider" && this.tdRoll("spot", e.id || 0, trap.id) < TRAP_ALL.spot) return;
    const old = this._damageSource;
    this.trapHit = true;
    this._damageSource = "trap";
    try {
      this.hurtEnemy(e, this.level("manufacturing") >= 5 ? TRAP_ALL.hitLv5 : TRAP_ALL.hit, e.facing);
    } finally {
      this.trapHit = false;
      this._damageSource = old;
    }
    trap.hp = Math.max(0, trap.hp - TRAP_ALL.wear);
    e.tdTrapCd = TRAP_ALL.cd;
    this.emit("trap");
  }
  hurtEnemy(e, n, a, meta = {}) {
    const live = e && !e.dead,
      src = this._damageSource;
    // 头目踩陷阱只吃一半（原来那段代码踩的和上面补的都在这里减）
    if (src === "trap") n *= TRAP_ALL.mult * (this.bossy(e) ? TRAP_ALL.boss : 1);
    // 瞭望塔；守卫来劲“眼尖”时伤害 +50%
    if (src === "tower") n *= TOWER.mult * (this.c?.residents.some((r) => this.inspired(r, "guard")) ? INSPIRE.guard.mult : 1);
    const out = super.hurtEnemy(e, n, a, meta);
    // 长夜战报：陷阱、瞭望塔各打倒几只
    const N = this.ln?.night,
      t = this.td?.night;
    if (N && t && t.day === N.day && live && e.dead && e.horde && (src === "trap" || src === "tower")) t[src]++;
    return out;
  }
  pullLureReason(id) {
    if (this.s.region !== "farm") return "回到农场再拉";
    const b = this.s.buildings.find((x) => x.id === id && x.type === "lure");
    if (!b || b.hp <= 0) return "信标坏了，先修好";
    if (this.pulledLure()) return "信标正在响";
    if ((this.c.energy || 0) < LURE.power && !((this.s.inventory.parts || 0) + (this.s.storage.parts || 0) >= LURE.part)) return "没电（要 " + LURE.power + "），也没有零件当电池";
    return "";
  }
  pullLure(id) {
    const reason = this.pullLureReason(id);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    let how;
    if ((this.c.energy || 0) >= LURE.power) {
      this.c.energy -= LURE.power;
      how = "电 −" + LURE.power;
    } else {
      this.takeFarm({ parts: LURE.part });
      how = "零件 −" + LURE.part;
    }
    this.td.lure = { id, until: this.absNow() + LURE.minutes };
    this.toast("信标响起来了（" + how + "）：一分钟里，附近的感染者都往它那边走。", "gold");
    this.events.push({ type: "tdLure", id });
    return true;
  }
  // 信标还响几秒（画面上的倒计时）
  lureLeft() {
    const t = this.td?.lure;
    return t?.id ? Math.max(0, Math.ceil((t.until - this.absNow()) / 1.6)) : 0;
  }
  underAttack() {
    return (
      ["warning", "active"].includes(this.s.horde.phase) ||
      ["warning", "active"].includes(this.raidState?.().phase) ||
      !!this.ln?.night ||
      ["warning", "active"].includes(this.ct?.raid?.phase) ||
      !!this.r?.battle
    );
  }
  repairActive() {
    return this.underAttack();
  }
  // 维修点：记下这一场修了多少、用了几块木头（设施卡上写）
  updateDefense(dt) {
    if (this.s.region !== "farm" || !this.td) return super.updateDefense(dt);
    const t = this.td.repair,
      on = this.underAttack();
    if (on && !t.on) Object.assign(t, { on: true, day: this.s.day, hp: 0, wood: 0 });
    else if (!on && t.on) t.on = false;
    if (!on || !this.s.buildings.some((b) => b.type === "repairpost" && b.hp > 0)) return super.updateDefense(dt);
    const hp0 = this.s.buildings.reduce((a, b) => a + b.hp, 0),
      wood0 = (this.s.storage.wood || 0) + (this.s.inventory.wood || 0);
    const out = super.updateDefense(dt);
    const dhp = this.s.buildings.reduce((a, b) => a + b.hp, 0) - hp0,
      dw = wood0 - ((this.s.storage.wood || 0) + (this.s.inventory.wood || 0));
    if (dhp > 0 && dw > 0) {
      t.hp = Math.min(1e6, t.hp + Math.round(dhp));
      t.wood = Math.min(1e5, t.wood + dw);
    }
    return out;
  }
  // 有人守的瞭望塔（塔顶亮灯）：和开火的规矩一样，前几座塔按上岗的守卫数排
  mannedTowers() {
    if (this.s.region !== "farm") return new Set();
    const n = this.c.residents.filter((r) => (r.workRole === "guard" || (r.role === "guard" && !r.workRole)) && this.residentActive(r)).length;
    return new Set(
      this.s.buildings
        .filter((b) => b.type === "tower" && b.hp > 0)
        .slice(0, n)
        .map((b) => b.id),
    );
  }
  // 真能上岗的守卫：排了守卫岗、吃了工作餐、有床、不太累、没闹情绪
  readyGuards() {
    const cap = this.residentsCapacity();
    return this.c.residents.filter((r, i) => ((r.priorities?.guard || 0) > 0 || r.role === "guard") && r.fed && i < cap && (r.fatigue || 0) < 85 && !this.striking(r)).length;
  }

  // ================= 修理包 =================
  useItemReason(id) {
    if (id !== "repairKit") return "这样东西不能这样用";
    if (this.s.region === "farm") {
      if (!this.qty(id, true)) return "身上和仓库里都没有修理包";
      return this.kitTarget() ? "" : "身边没有要修的防御设施（走近围栏、陷阱、瞭望塔这些再用）";
    }
    if (!this.qty(id)) return "身上没有修理包";
    const w = this.gr?.slots?.melee,
      c = w && this.cond?.(w);
    if (!c) return "手上没有近战武器";
    if (c.d >= c.m) return "武器不用修";
    return "";
  }
  kitTarget() {
    const p = this.s.player;
    return this.s.buildings
      .filter((b) => KIT_TYPES.includes(b.type) && b.hp < (BUILDINGS[b.type]?.hp || 0) && dist(b, p) < KIT.farmR)
      .sort((a, b) => a.hp / BUILDINGS[a.type].hp - b.hp / BUILDINGS[b.type].hp)[0];
  }
  useItem(id) {
    const reason = this.useItemReason(id);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    if (this.s.region === "farm") return this.kitRepair(this.kitTarget());
    this.s.inventory[id]--;
    if (!this.s.inventory[id]) delete this.s.inventory[id];
    this.td.kits = Math.min(1e6, this.td.kits + 1);
    const w = this.gr.slots.melee,
      c = this.cond(w);
    c.d = Math.min(c.m, c.d + Math.round(c.m * KIT.weapon));
    this.toast("用修理包把" + (ITEMS[w]?.name || "武器") + "修回了四成。", "gold");
    this.emit("craft");
    return true;
  }
  // 设施页上：用修理包把这一座修满
  kitReason(b) {
    if (this.s.region !== "farm") return "回到农场再修";
    if (!b || !KIT_TYPES.includes(b.type)) return "修理包只修围栏、大门、陷阱、瞭望塔、信标和维修点";
    if (b.hp >= (BUILDINGS[b.type]?.hp || 0)) return "不用修";
    if (!this.qty("repairKit", true)) return "没有修理包（机床能做）";
    return "";
  }
  useKitOn(id) {
    const b = this.s.buildings.find((x) => x.id === id),
      reason = this.kitReason(b);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    return this.kitRepair(b);
  }
  kitRepair(b) {
    if (!b || !this.takeFarm({ repairKit: 1 })) return false;
    this.td.kits = Math.min(1e6, this.td.kits + 1);
    b.hp = BUILDINGS[b.type].hp;
    this.navRevision = (this.navRevision || 0) + 1;
    this.particlesAt?.(b.x, b.y - 20, "#e7c27a", 14);
    this.toast("用修理包把" + BUILDINGS[b.type].name + "修满了。", "gold");
    this.emit("craft");
    return true;
  }

  // ================= 贺满仓：分期有期限 =================
  hemcDue() {
    const debt = this.fr?.hemc?.debt;
    if (!debt) return null;
    // 还了几期：欠得最多的那样东西每期都在还，按它算
    let paid = 0;
    for (const [id, n] of Object.entries(debt.total || {})) {
      const per = Math.ceil(n / 3);
      if (per > 0) paid = Math.max(paid, Math.ceil((debt.paid?.[id] || 0) / per));
    }
    // 整顿以前就欠着的：期限从读进新版那天算
    const start = Math.max(debt.day || 0, this.td?.hemc.since || 0),
      k = Math.min(3, paid + 1),
      due = start + HEMC.every * k,
      late = Math.max(0, this.s.day - due);
    return { k, due, late, extra: Math.min(HEMC.cap, HEMC.late * late) };
  }
  installment() {
    const base = super.installment();
    if (!base) return null;
    const d = this.hemcDue();
    if (!d?.extra) return base;
    return Object.fromEntries(Object.entries(base).map(([id, n]) => [id, n + Math.ceil(n * d.extra)]));
  }
  repay() {
    const debt = this.fr?.hemc?.debt;
    if (!debt) return super.repay();
    const d = this.hemcDue(),
      base = super.installment(),
      pay = this.installment(),
      reason = this.repayReason();
    if (reason || !this.takeFarm(pay)) {
      this.toast((reason || "东西不够") + "。", "warn");
      return false;
    }
    const h = this.fr.hemc;
    for (const [id, n] of Object.entries(base)) h.debt.paid[id] = (h.debt.paid[id] || 0) + n;
    const t = this.td.hemc;
    if (d.late) t.lateEver = true;
    const done = Object.entries(h.debt.total).every(([id, n]) => (h.debt.paid[id] || 0) >= n);
    if (done) {
      h.debt = null;
      h.advances++;
      if (t.lateEver) t.refuseUntil = this.s.day + HEMC.refuse;
      t.lateEver = false;
      this.toast("贺满仓：" + (t.refuseUntil > this.s.day ? "还清了。不过拖过期，往后 " + HEMC.refuse + " 天我先不垫了。" : "两清。下回要垫，再来找我。"), "gold");
      if (this.o) this.olog("还清了贺满仓的垫付。", "gold");
    } else this.toast("还了一期：" + itemsText(pay) + (d.late ? "（逾期 " + d.late + " 天，多还了 " + Math.round(d.extra * 100) + "%）" : "") + "。");
    return true;
  }
  advanceReason(type) {
    if (this.td?.hemc.refuseUntil > this.s.day) return "上次拖过期，贺满仓第" + this.td.hemc.refuseUntil + "天以前不再垫付";
    return super.advanceReason(type);
  }

  // ================= 机床：每晚一单，可以加急 =================
  latheRushReason() {
    const o = this.o;
    if (!o?.lathe?.mode) return "机床还没修好";
    if (this.s.region !== "farm") return "回到农场再说";
    if (o.lathe.day === this.s.day || this.s.minute >= LATHE_RUSH.until) return "今晚的活已经开工了，明天再加急";
    if (this.td.lathe.rush === this.s.day) return "今晚已经加过急了";
    if (this.td.lathe.jam >= this.s.day) return "机床卡着料，明天才能开工";
    return "";
  }
  latheRush() {
    const reason = this.latheRushReason();
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    this.td.lathe.rush = this.s.day;
    this.toast("跟尤可说好了：今晚 18:00 加急多做一批。加急有两成会卡料，卡了第二天歇一天。", "gold");
    return true;
  }
  latheRun() {
    const o = this.o,
      t = this.td.lathe;
    if (!o?.lathe?.mode || o.lathe.day === this.s.day) return 0;
    if (t.jam >= this.s.day) {
      o.lathe.day = this.s.day;
      const text = "机床昨晚加急卡了料，今天歇一天。";
      if (this.o) this.olog(text, "warn");
      if (this.s.region === "farm") this.toast(text, "warn");
      return 0;
    }
    let made = super.latheRun();
    if (t.rush === this.s.day) {
      const m = LATHE_MODES[o.lathe.mode];
      if (m && this.takeFarm(m.input)) {
        this.putStorage(m.output);
        this.recordProduced?.(m.output);
        made++;
        const jam = this.tdRoll("jam", this.s.day) < LATHE_RUSH.jam;
        if (jam) t.jam = this.s.day + 1;
        const text = "加急多做了一批" + m.name + "（" + itemsText(m.output) + "）" + (jam ? "；可是机床卡了料，明天歇一天。" : "。");
        if (this.o) this.olog(text, jam ? "warn" : "normal");
        if (this.s.region === "farm") this.toast(text, jam ? "warn" : "gold");
      } else if (m) {
        const text = "加急那一批缺料，没做成：每批要" + itemsText(m.input) + "。";
        if (this.o) this.olog(text, "warn");
      }
    }
    return made;
  }
  setLatheMode(mode) {
    if (mode === "ammo") {
      this.toast("弹药改在制作台做了；机床可以做零件、布料或修理包。", "warn");
      return false;
    }
    return super.setLatheMode(mode);
  }

  // ================= 运输骡：v0.26 以后装的车只捎一车货回来 =================
  cargoOnce() {
    return !!this.td?.cargoNew;
  }
  startConvoy(id) {
    const before = this.o?.cargo;
    const ok = super.startConvoy(id);
    if (ok && !before && this.o.cargo) this.td.cargoNew = true;
    return ok;
  }
  arriveConvoy(...args) {
    const ok = super.arriveConvoy(...args);
    const t = this.td;
    if (ok && t?.cargoNew && !t.cargoPaid && this.o?.cargo && CARGO_RETURN[this.o.cargo]) {
      t.cargoPaid = true;
      const gain = CARGO_RETURN[this.o.cargo];
      this.putStorage(gain);
      const text = "红薯回程捎回一车货：" + itemsText(gain) + "（已入仓）。";
      this.toast(text, "gold");
      if (this.o) this.olog(text, "gold");
    }
    return ok;
  }
  withCargoOff(fn) {
    if (!this.cargoOnce() || !this.o) return fn();
    const c = this.o.cargo;
    this.o.cargo = "";
    try {
      return fn();
    } finally {
      this.o.cargo = c;
    }
  }
  repair(id) {
    return this.withCargoOff(() => super.repair(id));
  }
  patrolHeal() {
    return this.withCargoOff(() => super.patrolHeal());
  }
  neighborAid() {
    return this.withCargoOff(() => super.neighborAid());
  }

  // ================= 「雨后的鱼群迁徙」检验过水样的：好处从鱼篓挪到池塘 =================
  hookFish() {
    const ok = super.hookFish();
    const v = this.v;
    if (ok && v?.benefits?.migration === "sample" && ["小雨", "暴雨"].includes(this.s.weather) && (v.services.rareFishDay == null || this.s.day >= v.services.rareFishDay + 3)) {
      this.putStorage({ riverFish: 1 });
      v.services.rareFishDay = this.s.day;
      this.toast("迁徙记录：雨天的池塘多一条蓝背鱼，已入仓。", "gold");
    }
    return ok;
  }

  // ================= 场景里的东西、按 E =================
  assignRegion() {
    super.assignRegion();
    if (this.s.region === "farm" && this.ln?.night && Array.isArray(this.objects))
      this.objects.push({ type: "tdBell", name: "警钟", x: LN_PACE.bell.x, y: LN_PACE.bell.y, icon: 55 });
  }
  context(o) {
    if (!this.c?.fishing) {
      if (o?.type === "tdBell") {
        const r = this.lnBellReason(),
          next = this.lnNext(),
          left = next ? Math.max(0, Math.ceil((next.at - this.absNow()) / 1.6)) : 0;
        const when = next ? (next.what === "wave" ? "第 " + next.k + " 波" : "头目") + "还有 " + left + " 秒" : "";
        if (r) return "警钟 · " + (when && r !== "今晚已经没有下一波了" ? when + " · " : "") + r;
        return "警钟 · " + when + " · 按 E 提前叫来（还能敲 " + (LN_PACE.maxEarly - (this.td.bell.early || 0)) + " 次，多一次稀有掉落）";
      }
      if (o?.type === "pond" && this.s.region === "farm") return "林边池塘 · 按 E 抛竿";
      if (o?.type === "radioStation" && this.r?.radio && this.w) return "通信站 · 电台节目单";
    }
    return super.context(o);
  }
  buildingContext(b) {
    if (CARD_TYPES.includes(b.type)) return BUILDINGS[b.type].name + " · 看看情况";
    return super.buildingContext(b);
  }
  interact() {
    if (this.paused) return;
    if (this.c?.fishing) return super.interact();
    const o = this.nearestObject?.();
    if (o?.type === "tdBell") {
      this.lnBell();
      return;
    }
    if (o?.type === "radioStation" && this.r?.radio && this.w) {
      this.emit("menu", { menu: "outpost", view: "radio", id: "" });
      return;
    }
    if (o?.type === "pond" && this.s.region === "farm") {
      if (this.startFishing(false)) return;
      this.emit("menu", { menu: "camp", tab: "life" });
      return;
    }
    if (o?.type === "building" && CARD_TYPES.includes(o.building.type)) {
      this.emit("menu", { menu: "building", buildingId: o.building.id });
      return;
    }
    return super.interact();
  }

  // ================= 存档 =================
  static parse(text) {
    const s = LongNightEngine.parse(text);
    migrateState(s);
    validateTidy(s);
    return s;
  }
}

function validateTidy(s) {
  const t = s.tidy,
    bad = (why) => {
      throw new Error("存档里的营地整顿记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
    };
  if (!t || typeof t !== "object") bad("缺少");
  const int = (v, lo = 0, hi = 1e9) => Number.isInteger(v) && v >= lo && v <= hi;
  if (!int(t.schema, 1, 99)) bad("版本");
  if (!Array.isArray(t.listing) || t.listing.length > LISTING.slots) bad("挂牌");
  for (const l of t.listing) if (!l || typeof l.id !== "string" || !ITEMS[l.item] || !int(l.qty, 1, LISTING.max)) bad("挂牌");
  if (!Number.isFinite(t.listClock) || t.listClock < 0 || t.listClock > 1e6) bad("挂牌");
  if (!Array.isArray(t.listLog) || t.listLog.length > 20 || t.listLog.some((x) => typeof x !== "string" || x.length > 120)) bad("挂牌");
  if (!t.mood || typeof t.mood !== "object" || Object.keys(t.mood).length > 20) bad("心情");
  for (const [id, r] of Object.entries(t.mood)) {
    if (id.length > 40 || !r || typeof r !== "object") bad("心情");
    if (!int(r.last ?? 0) || !int(r.strike ?? 0)) bad("心情");
    if (r.insp && (!int(r.insp.day) || !INSPIRE[r.insp.kind])) bad("心情");
  }
  if (!t.lucky || !int(t.lucky.day) || !Array.isArray(t.lucky.plots) || t.lucky.plots.length > 60) bad("好手气");
  if (!t.bell || !int(t.bell.day) || !int(t.bell.early, 0, LN_PACE.maxEarly)) bad("警钟");
  if (!t.lure || typeof t.lure.id !== "string" || !Number.isFinite(t.lure.until)) bad("信标");
  if (!t.hemc || !int(t.hemc.since) || typeof t.hemc.lateEver !== "boolean" || !int(t.hemc.refuseUntil)) bad("贺满仓");
  if (!t.lathe || !int(t.lathe.rush) || !int(t.lathe.jam)) bad("机床");
  if (t.retrain && (!HELPER_ROLES[t.retrain.role] || typeof t.retrain.pupil !== "string" || typeof t.retrain.master !== "string" || !int(t.retrain.start))) bad("改学职能");
  if (t.converted && (!Array.isArray(t.converted.notes) || t.converted.notes.length > 30)) bad("转换记录");
  if (!int(t.kits)) bad("修理包");
}
