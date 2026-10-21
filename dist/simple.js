// v0.39.0「一物一用」：每样东西只做一件事，按下去做的就是头上写着的那件事。
// 1. 不再弹“选一个”：交互圈套着谁、头上写着谁，按交互就是谁（挪一步就换成旁边那一样）。
// 2. 头上那一行（也是底栏的提示）一律写成“名字 · 做什么”。
// 3. 一样东西身上原来挂着的别的功能，挪到真正管这件事的那样东西或那一页菜单上（见 simple-ui.js）。
// 不加存档字段、不改任何数：长夜、十凶、尸潮、种地、拾荒的数和 v0.38 一样。
import { Engine as MendEngine, freshState as mFresh, migrateState as mMigrate, newGameState as mNewGame, newGamePlusState as mNewGamePlus, needsUpgrade as mNeedsUpgrade, legacyGear } from "./mend.js";
import { BUILDINGS, ITEMS } from "./data.js";
import { VERB, BVERB, BROKEN_VERB, NAME_CUT } from "./simple-data.js";

export { legacyGear };
export const needsUpgrade = mNeedsUpgrade;
export function migrateState(s) {
  return mMigrate(s);
}
export function freshState() {
  return mFresh();
}
export function newGameState(origin = "farmer") {
  return mNewGame(origin);
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  return mNewGamePlus(old, origin, keep, book);
}

// 名字：带着“ · 说明”的只留前一截（“林姨 · 粮食商”→“林姨”）
export function shortName(name) {
  const s = String(name || "").trim();
  if (!s) return "";
  const head = s.split(/\s*·\s*/)[0];
  return head.length > NAME_CUT ? head.slice(0, NAME_CUT) : head;
}

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
// 背包放不下、掉在农场地上的东西：直接进仓库（原来那句“物资留在地面”换成这句）
const DROP_TOAST = "物资留在地面，整理背包后可按 E 领取。";
const DROP_HOME = "背包满了，掉的东西直接送进了仓库。";


// 原来的提示去掉键名（“按 E”“按住 E 一路做下去”“（E）”）
export function cleanCtx(s) {
  return String(s || "")
    .replace(/[（(]\s*按\s?(E|交互)\s*[)）]/g, "")
    .replace(/按住\s?E\s?一路做下去/g, "")
    .replace(/[（(]E[)）]/g, "")
    .replace(/按\s?E\s?/g, "")
    .replace(/按交互/g, "")
    .replace(/(^|\s)E\s/g, "$1")
    .replace(/[（(]\s*[)）]/g, "")
    .replace(/\s*·\s*$/, "")
    .replace(/^\s*·\s*/, "")
    .trim();
}
// 原来的提示里“做什么”那一截：“彭姐 · 来借粮”→“来借粮”；“下手 · 阿禾”→“下手”
export function fromOld(old, name) {
  const c = cleanCtx(old);
  if (!c) return "";
  const parts = c.split(/\s*·\s*/).filter(Boolean);
  if (parts.length < 2) return c === name ? "" : c;
  const nm = String(name || "");
  if (nm && (parts[0] === nm || parts[0].startsWith(nm) || nm.startsWith(parts[0]))) return parts.slice(1).join(" · ");
  if (nm && parts[parts.length - 1] === nm) return parts.slice(0, -1).join(" · ");
  return parts.slice(1).join(" · ");
}
// “劈开 · 储藏室的铁门（4 秒，半张图都听得见）”→“劈开（4 秒，半张图都听得见）”
export function toolVerb(old) {
  const c = cleanCtx(old);
  const m = c.match(/^([\u4e00-\u9fa5]{1,3})\s*·\s*[^（(]*([（(].*[)）])?$/);
  return m ? m[1] + (m[2] || "") : "";
}
const STATEFUL = new Set(["alPickleJar", "alWineJar", "alTree_mulberry", "alTree_peach", "alTree_apple", "alTree_persimmon", "coop", "compost", "rlStation"]);
const CONTAINERS = new Set(["crate", "gearCrate", "salvage", "encounter", "annexDoor", "poi", "uDoor"]);
// 人（按交互是和他说话）
const PEOPLE = new Set(["resident", "kinPerson", "allianceHelper", "outpostCai", "winterAmo", "seasonAli", "seasonAdou", "seasonLodger", "seasonHe", "seasonJiang", "farPeng", "farHemc", "hpTraveler", "hpPeddler", "hpBuyer", "hpSurvivor", "rescue"]);

export class Engine extends MendEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(s, notify);
    this._sxDropSaid = -1e9;
    // 旧档：农场地上还堆着的物资，读进来就收进仓库
    this.sxHomeDrops(true);
  }
  // ---------- 交互目标：不再弹“选一个” ----------
  pickCandidates() {
    return [];
  }
  // ---------- 按交互：一样东西一件事 ----------
  interact(...args) {
    // 被抓着、撬锁、翻滚、钓鱼时照原来的来
    if (this.paused || this.c?.fishing || this.gx?.grab || this.ux?.pry || this.fx?.roll) return super.interact(...args);
    // 脚边的爬行者照旧先踩；躺着的比面前的东西近时才踩它
    const p = this.s.player;
    let crawler = null,
      lying = null;
    this._uNoLying = true;
    try {
      crawler = this.nearestCrawler?.() || null;
    } catch {
      crawler = null;
    } finally {
      this._uNoLying = false;
    }
    if (crawler) return super.interact(...args);
    const o = this.nearestObject();
    try {
      lying = this.nearestCrawler?.() || null;
    } catch {
      lying = null;
    }
    if (lying && (!o || dist(lying, p) < dist(o, p))) return super.interact(...args);
    if (o) {
      const r = this.simpleAct(o);
      if (r !== undefined) return r;
    }
    return super.interact(...args);
  }
  // 返回 undefined：交给原来的那一套
  simpleAct(o) {
    const t = o.type;
    // 联盟终端：只读来信（回信、领流星这些原来的事照做，打开的那一页换成来信）
    if (t === "sign") {
      this.sxRemap(() => super.interact(), { journey: { menu: "sx", view: "letters" } });
      return true;
    }
    // 援建营地：给营地里的人派活
    if (t === "allianceCamp") {
      this.emit("menu", { menu: "camp", tab: "residents" });
      return true;
    }
    // 居民：和他说话（人那一页，翻到他）
    // 原来按下去是“安排他的工作”那一页的，换成他那一页（等你说心里话、蹲着下手这些照原来的来）
    if (t === "resident" && o.resident && (this.people?.() || []).some((x) => x.id === o.resident)) {
      this.sxRemap(() => super.interact(), { camp: { menu: "outpost", view: "people", id: o.resident } });
      return true;
    }
    if (t === "districtGate" || t === "beyondGate") return this.sxGate(o, t === "beyondGate" ? "beyond" : "district");
    // 地区出口：直接回去；正打着地区里的仗时还是先看那一页（直接走会算没守住）
    if (t === "districtExit") {
      if (this.d?.battle) return undefined;
      const ok = this.retreatDistrict?.();
      return ok === undefined ? undefined : true;
    }
    // 麦穗：摸摸它（喂、叫它做事在“人”那一页的麦穗那一格）
    if (t === "partnerDog" && this.dogReady?.() && typeof this.petDog === "function") {
      const why = this.petReason?.();
      if (why) this.toast(why + "。");
      else this.petDog();
      return true;
    }
    return undefined;
  }
  // 入口：修通了就进去，没修通打开“修通路”那张卡
  sxGate(o, kind) {
    const id = o.district;
    if (!id) return undefined;
    const open = kind === "beyond" ? !!this.b?.unlocked?.[id] : !!this.d?.unlocked?.[id];
    if (!open) {
      this.emit("menu", { menu: "sx", view: "gate", id, kind });
      return true;
    }
    this.travel(id);
    return true;
  }
  // 跑一遍原来的交互，把它要打开的那一页换成这一层的那一页
  sxRemap(fn, map) {
    const ev = this.events || (this.events = []);
    const before = ev.length;
    const r = fn();
    for (let i = before; i < ev.length; i++) {
      const e = ev[i];
      if (e && e.type === "menu" && map[e.menu]) ev[i] = { type: "menu", ...map[e.menu] };
    }
    return r;
  }
  // ---------- 农场地上的物资进仓库 ----------
  sxHomeDrops(quiet = false) {
    const list = this.s?.drops;
    if (!Array.isArray(list) || !list.length) return 0;
    let n = 0;
    const keep = [];
    for (const d of list) {
      if (d && d.region === "farm" && d.items && typeof d.items === "object") {
        const bundle = {};
        for (const [id, k] of Object.entries(d.items)) if (Number.isFinite(k) && k > 0) bundle[id] = Math.floor(k);
        if (typeof this.putStorage === "function") this.putStorage(bundle);
        else for (const [id, k] of Object.entries(bundle)) this.s.storage[id] = (this.s.storage[id] || 0) + k;
        n++;
      } else keep.push(d);
    }
    if (n) {
      this.s.drops = keep;
      const now = (this.s.day || 0) * 1440 + (this.s.minute || 0);
      if (!quiet && now - this._sxDropSaid > 90) {
        this._sxDropSaid = now;
        super.toast?.(DROP_HOME);
      }
    }
    return n;
  }
  update(dt, input) {
    const r = super.update(dt, input);
    if (this.s.region === "farm" && this.s.drops?.length) this.sxHomeDrops(false);
    if (this.c?.production?.some?.((j) => j && j.ready)) this.sxCollectDone();
    return r;
  }
  // ---------- 设施里做好的东西自己进仓库（原来要回营地点“领取”）----------
  sxCollectDone() {
    const list = this.c?.production;
    if (!Array.isArray(list)) return 0;
    const done = list.filter((j) => j && j.ready && j.out && typeof j.out === "object");
    if (!done.length || typeof this.storeProduction !== "function") return 0;
    const names = [];
    for (const j of done) {
      const first = Object.keys(j.out)[0],
        n = j.out[first];
      // 走“入仓”那一条：记账（主线的“做好一份干粮”也算）、加经验、清出队列
      if (this.storeProduction(j.id, true) && first) names.push((ITEMS[first]?.name || first) + " ×" + n);
    }
    if (names.length) {
      this.checkStory?.();
      super.toast?.(names.slice(0, 3).join("、") + (names.length > 3 ? " 等" : "") + " 做好了，放进了仓库。", "gold");
    }
    return names.length;
  }
  toast(text, tone) {
    // 在农场上，“物资留在地面”不说了：下一帧就进了仓库
    if (text === DROP_TOAST && this.s?.region === "farm") return;
    return super.toast(text, tone);
  }
  simpleLabelsOn() {
    return true;
  }
  // 头上那一行：名字 · 做什么
  simpleLabel(o) {
    if (!o) return "";
    // 正在钓鱼、撬锁、被抓着：照那一套提示（按交互是收线、不撬了、挣脱）
    if (this.c?.fishing || this.ux?.pry || this.gx?.grab) return super.context(o) || "";
    let old = "";
    try {
      old = String(super.context(o) || "");
    } catch {
      old = "";
    }
    // 蹲着走到人背后：按交互是“下手”，对象是那个人（不是离你最近的那样东西）
    const steal = /^下手\s*·\s*(.+)$/.exec(cleanCtx(old));
    if (steal) return steal[1] + " · 下手";
    const name = this.simpleName(o),
      verb = this.simpleVerb(o, old, name);
    if (!verb) return name || cleanCtx(old);
    return name ? name + " · " + verb : verb;
  }
  simpleName(o) {
    if (o.type === "building") return shortName(BUILDINGS[o.building?.type]?.name || o.name);
    if (o.type === "plot") return o.plot && o.name && o.name !== "农田" ? shortName(o.name) : "农田";
    if (o.type === "drop") return "掉在地上的物资";
    if (o.type === "grave") return "遗落的背包";
    if (o.type === "clue") return String(o.name || "").replace(/\s*·\s*/g, " ").slice(0, 16);
    return shortName(o.name || o.label || o.title || "");
  }
  simpleVerb(o, old, name) {
    // 要什么才能做：原来的提示里写着“需要 / 需”的，跟在后面
    const need = (old.match(/需要?\s?([^·，。]{1,16})/) || [])[1];
    const tail = need ? "（要" + need.trim() + "）" : "";
    if (o.type === "plot") return this.plotVerb(old);
    if (o.type === "building") {
      const b = o.building,
        d = BUILDINGS[b?.type];
      if (!b || !d) return fromOld(old, name);
      if (b.hp <= 0 || b.hp < d.hp * 0.7) return BROKEN_VERB;
      if (b.type === "gate") return b.open ? "关门" : "开门";
      // 缸、果树、鸡舍、堆肥桶：原来的提示写着现在怎样（空着、能摘了、腌着几天），照那个写
      if (STATEFUL.has(b.type)) {
        const act = fromOld(old, name);
        if (act && !/看看情况|查看/.test(act) && act.length <= 18) return act;
      }
      const v = BVERB[b.type];
      return v ? v + tail : fromOld(old, name);
    }
    if (o.type === "sign") {
      const act = fromOld(old, name);
      // 流星夜、呼叫白霜站这些时候，终端做的是那件事
      if (act && !/来信|回信|任务/.test(act)) return act;
      if (this.canReply?.()) return "回信";
      if (this.s.storyCampaign?.unread) return "读新来信";
      return "读来信";
    }
    if (o.type === "well" && /修好|辘轳/.test(old)) return "修好辘轳";
    if (o.type === "districtGate") return this.d?.unlocked?.[o.district] ? "进去" : "修通路";
    if (o.type === "beyondGate") return this.b?.unlocked?.[o.district] ? "进去" : "修通路";
    if (o.type === "allianceSite") return VERB.allianceSite;
    // 前哨广场：节庆那天写办哪一个节，食堂开张时写上菜
    if (o.type === "seasonPlaza") {
      const act = fromOld(old, name);
      if (act && !/节庆与食堂/.test(act)) return act;
      // 食堂今晚能开张的时候（每周两晚 19:00–21:00）
      let can = "x";
      try {
        can = typeof this.canteenReason === "function" ? this.canteenReason() : "x";
      } catch {
        can = "x";
      }
      if (!can) return "开张食堂";
      return VERB.seasonPlaza;
    }
    // 机床：每天自己做一样东西进仓库，写着现在做什么
    if (o.type === "outpostLathe") {
      const mode = (cleanCtx(old).match(/优先([^·\s]+)/) || [])[1];
      return mode ? "每天做" + mode : "排产";
    }
    if (o.type === "btOrders") {
      const n = (old.match(/(\d+)\s?张/) || [])[1];
      return "交订单" + (n ? "（" + n + " 张）" : "");
    }
    // 今天做过了、还得等几天：照原来的说
    if (/已搜索|已拆解|已经互助|已经用过|今天已|明天再来|刚.过|天后再来/.test(old)) return fromOld(old, name) || "今天做过了";
    // 柜子、门：手里拿着撬棍、斧头时是“撬开 · ……（几秒）”“劈开 · ……”：照那个动作写
    if (CONTAINERS.has(o.type)) {
      const tv = toolVerb(old);
      if (tv) return tv;
    }
    // 人：和他说话；他现在有话要说（借粮、考验、心愿、劝一劝、下手……）就写那件事
    if (PEOPLE.has(o.type)) {
      const act = fromOld(old, name);
      if (act && act !== name && !/^(看看|查看|说话|聊几句)$/.test(act) && !act.includes("/") && act.length <= 16 && !/^安排/.test(act)) return act;
      return VERB[o.type] || "说话";
    }
    const v = VERB[o.type];
    if (typeof v === "function") return v(this, o) + tail;
    if (typeof v === "string") return v + tail;
    return fromOld(old, name);
  }
  plotVerb(old) {
    let s = cleanCtx(old).split(/\s*\/\s*/)[0];
    s = s.replace(/^空地\s*·\s*/, "").replace(/还需\s?/, "还要 ").replace(/游戏小时/, "小时");
    return s || "种菜";
  }
  context(o) {
    if (!o) return super.context(o);
    return this.simpleLabel(o);
  }
}
