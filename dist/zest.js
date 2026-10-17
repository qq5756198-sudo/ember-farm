// v0.32.0「手感」：《爽点与耐玩体检方案》第一版。
// 1. 提示分三档：日常小事只在头顶飘一下、一遍田记一行；中事照常进提示栏；大事（交满一面墙、余烬核、升级、头目、珍贵、
//    第一次钓到的鱼、第一份收成）在画面上方停一张卡片，日常提示挤不掉它。
// 2. 后来加的玩法补反馈：送礼头上冒一下、有声音；交清单一格一声章；第一次钓到某种鱼单独登场。
// 3. 按住交互连做：沿着田走，收、拔草、捉虫、开垦、浇水、照看、种上次的种子。
// 4. 教过三次的操作说明不再出；同一句话 45 秒里第二遍只飘字；重建站交一格不进提示栏；早间广播进任务手记；
//    手机上的说法（这一层只管引擎，界面在 zest-ui.js）。
// 新进度放在 s.zest，原来的字段不动。
import {
  Engine as RelightEngine,
  freshState as relightFresh,
  migrateState as relightMigrate,
  newGameState as relightNewGame,
  newGamePlusState as relightNewGamePlus,
  needsUpgrade as relightNeedsUpgrade,
  legacyGear,
} from "./relight.js";
import { ITEMS, CROPS, SKILLS } from "./data.js";
import { TRAITS } from "./expansion-data.js";
import { FISH, FISH_IDS } from "./kin-data.js";
import { WALLS, CORES, CORE_IDS, CORE_BONUS } from "./relight-data.js";
import { CORE_LINES, TUNNEL_TEXT } from "./relight-story.js";
import { ZEST_SCHEMA, TEACH_TIMES, HOLD, TALLY, FLOAT, MOMENT, MOMENT_KINDS, GIFT_EMOTE, TEACH, TAUGHT_FLOAT, ROUTINE, PLAIN, REPEAT, SKILL_NAMES, INTRO_LINES } from "./zest-data.js";

export { legacyGear };
// 读进来之前原样留一份：v0.31 及更早的存档（没有手感的记录）也算
export const needsUpgrade = (text) => {
  if (relightNeedsUpgrade(text)) return true;
  try {
    const raw = JSON.parse(text);
    return !!raw && typeof raw === "object" && !raw.zest;
  } catch {
    return false;
  }
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const TEACH_IDS = Object.keys(TEACH);
const STAT_KEYS = ["moments", "floats", "tallies", "holds", "holdActs", "gifts", "stamps", "fish", "pumps"];
const WALL_BY_NAME = Object.fromEntries(Object.entries(WALLS).map(([id, w]) => [w.name, id]));
const SKILL_KEY = { 农业: "agriculture", 制造: "manufacturing", 探索: "exploration", 战斗: "combat" };
const fishByName = () => Object.fromEntries(FISH_IDS.filter((id) => ITEMS[id]?.name).map((id) => [ITEMS[id].name, id]));
// 一样作物的各种品相（普通、优质、耐旱、上品、巨型）
const cropForms = (crop) => [crop, "fine_" + crop, "hardy_" + crop, "prime_" + crop].filter((id) => ITEMS[id]);

const zDefaults = () => ({
  schema: ZEST_SCHEMA,
  // 操作说明教过几次
  taught: Object.fromEntries([...TEACH_IDS, "hold"].map((k) => [k, 0])),
  // 今天的早间广播（任务手记“今天”下面那一行）
  radio: null,
  // 每种大事登过几次场
  moments: {},
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
});

export function migrateState(s) {
  relightMigrate(s);
  if (!s.zest) {
    s.zest = zDefaults();
    // 旧档：第一帧说一声这一版的变化（新开的档在下面删掉）
    s.zest.intro = { day: s.day || 1, told: false };
  } else {
    const d = zDefaults(),
      x = s.zest;
    s.zest = {
      ...d,
      ...x,
      taught: { ...d.taught, ...x.taught },
      radio: x.radio ? { ...x.radio } : null,
      moments: { ...x.moments },
      stats: { ...d.stats, ...x.stats },
    };
    if (x.intro) s.zest.intro = { ...x.intro };
  }
  return s;
}
const fresh = (s) => {
  delete s.zest;
  migrateState(s);
  delete s.zest.intro;
  return s;
};
export function freshState() {
  return fresh(relightFresh());
}
export function newGameState(origin = "farmer") {
  return fresh(relightNewGame(origin));
}
export function newGamePlusState(old, origin = "farmer", keep = "", book = []) {
  const s = fresh(relightNewGamePlus(old, origin, keep, book));
  // 二周目：教过的就不用再教了
  if (old?.zest?.taught) for (const k of Object.keys(s.zest.taught)) s.zest.taught[k] = Math.min(TEACH_TIMES, old.zest.taught[k] || 0);
  return s;
}

export class Engine extends RelightEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    // 所有提示都从这里过一遍：日常的只飘字，大事登场，其余照常送去提示栏
    this.zSink = this.notify;
    this.notify = (text, tone) => this.zRoute(text, tone);
    this._zCap = null;
    this._zTally = null;
    this._zHold = { t: 0, cd: 0, acts: 0 };
    this._zFloat = { at: -9, n: 0 };
    this._zAct = 0;
    this._zSaid = new Map();
  }
  get zx() {
    return this.s.zest;
  }
  zStat(k, n = 1) {
    if (this.zx) this.zx.stats[k] = (this.zx.stats[k] || 0) + n;
  }

  // ================= 提示分三档 =================
  zRoute(text, tone = "normal") {
    text = String(text ?? "");
    tone = tone || "normal";
    // 正在登场的大事：它自己的那几行先收着
    if (this._zCap && tone !== "warn") {
      this._zCap.push([text, tone]);
      return;
    }
    let r = this.zClassify(text, tone);
    if (r.tier === "pass") r = this.zRepeat(text, tone, r);
    if (r.tier === "drop") return;
    if (r.tier === "routine") {
      if (r.float) this.zFloat(r.float, r.color, r.long);
      return;
    }
    if (r.tier === "big") {
      this.moment(r.kind, r.title, r.lines, r.extra);
      return;
    }
    this.zSink(r.text ?? text, r.tone ?? tone);
  }
  zClassify(text, tone) {
    const z = this.zx;
    if (!z) return { tier: "pass" };
    // 柜子里翻到的：普通、少见只是一行字，稀有照旧金色，珍贵登场
    const L = this._uLoot;
    if (L && tone === "gold" && text.startsWith(L.name + "：")) {
      if (L.tier === "precious") return { tier: "big", kind: "precious", title: "珍贵！" + L.name, lines: [text.slice(L.name.length + 1).replace(/（珍贵）$/, "")] };
      // 普通、少见的：柜子上飘一下拿到了什么（东西已经进了背包）
      if (L.tier !== "rare") return { tier: "routine", float: text.slice(L.name.length + 1), long: true };
      return { tier: "pass" };
    }
    // 早间广播：全文进任务手记；有要紧事才在提示栏说一句
    if (/^电台早间播报/.test(text) || /^早间广播/.test(text)) {
      z.radio = { day: this.s.day, text: text.slice(0, 400) };
      if (tone === "normal") return { tier: "drop" };
      const body = text.replace(/^电台早间播报[：。]?/, "");
      const first = body.split(/[；。]/).find((x) => x && !x.includes("今天废墟里没听到")) || body;
      return { tier: "pass", text: "电台：" + first.slice(0, 40) + "（全文在任务手记）", tone: tone === "warn" ? "warn" : "normal" };
    }
    // 升级
    let m = text.match(/^(农业|制造|探索|战斗|妙手)升至 Lv\.(\d+)(.*)$/);
    if (m && tone === "gold") {
      const key = SKILL_KEY[m[1]],
        lines = [];
      if (m[3]) lines.push(m[3].replace(/^[ ·，,]+/, ""));
      if (key && SKILLS[key]?.desc) lines.push(SKILLS[key].desc);
      return { tier: "big", kind: "level", title: m[1] + " Lv." + m[2], lines, extra: { skill: key || m[1], lv: Number(m[2]) } };
    }
    // 交满一面墙（不是鼎丰买的）
    m = text.match(/^「(.+?)」通了：(.+?)。?$/);
    if (m && tone === "gold" && WALL_BY_NAME[m[1]]) {
      const id = WALL_BY_NAME[m[1]];
      return { tier: "big", kind: "wall", title: "「" + m[1] + "」通了", lines: [WALLS[id].text], extra: { wall: id } };
    }
    // 打赢头目
    m = text.match(/^打赢了(.+?)(（第一次，奖励翻倍）)?：(.+?)(。战利品可以捐给档案馆)?$/);
    if (m && tone === "gold") return { tier: "big", kind: "boss", title: "打赢了" + m[1], lines: [(m[2] ? "第一次，奖励翻倍：" : "") + m[3] + (m[4] ? "（战利品可以捐给档案馆）" : "")] };
    // 钓到鱼：常见的只飘一下，稀有的照旧金色
    m = text.match(/^钓到([^！（。\s]+)(?:！)?(.*)$/);
    if (m && ITEMS && fishByName()[m[1]]) {
      // 天天钓得到的不算稀罕（第一次钓到某种鱼是大事，在 reelLand 里登场）；稀有的飘金色的字
      const sp = fishByName()[m[1]],
        rare = FISH[sp]?.tier === "rare";
      return { tier: "routine", float: "钓到" + m[1] + (rare ? "！" : "") + (m[2] && /验|研究/.test(m[2]) ? "（先别吃）" : ""), color: rare ? "#ffd76a" : undefined };
    }
    // 教学提示：前三次照常，之后只留声音和头顶一个字
    for (const k of TEACH_IDS) {
      if (!TEACH[k].test(text)) continue;
      if ((z.taught[k] || 0) < TEACH_TIMES) {
        z.taught[k] = (z.taught[k] || 0) + 1;
        return { tier: "pass", teach: true };
      }
      return { tier: "routine", float: TAUGHT_FLOAT[k] || "" };
    }
    // 第 30 层的泵房：头一回到底是金色，以后再下来只是一行字
    if (TUNNEL_TEXT.pump && text.includes(TUNNEL_TEXT.pump)) {
      const seen = (z.stats.pumps || 0) > 0;
      this.zStat("pumps");
      if (seen && tone === "gold") return { tier: "pass", tone: "normal" };
    }
    // 照常进提示栏，但不是金色
    if (tone === "gold" && PLAIN.some((re) => re.test(text))) return { tier: "pass", tone: "normal" };
    // 日常小事
    for (const R of ROUTINE) {
      const mm = text.match(R.re);
      if (!mm) continue;
      if (tone === "warn") return { tier: "pass" };
      if (R.drop) return { tier: "drop" };
      // 页面开着（从这块田的页面里点“照看”之类）：头顶的字看不见，照常进提示栏，只是不用金色；
      // 页面上自己看得见的（重建站交一格）连提示栏也不进
      if (this.paused) return R.page === "drop" ? { tier: "drop" } : { tier: "pass", tone: "normal" };
      const mine = this._zAct > 0;
      if (R.tally) {
        if (!mine) return { tier: "drop" };
        if (R.tally !== "harvestText") this.zTally(R.tally, mm);
      }
      if (!R.float || (!mine && R.tally)) return { tier: "routine" };
      return { tier: "routine", float: R.float.replace(/\$(\d)/g, (_, i) => mm[Number(i)] || "") };
    }
    return { tier: "pass" };
  }
  // 同一句话（数字不算）45 秒里又来一遍：头顶飘一下就够了（金色的、页面开着时照常进提示栏）
  zRepeat(text, tone0, r) {
    const tone = r.tone ?? tone0 ?? "normal",
      shown = r.text ?? text;
    if (tone === "gold" || this.paused || r.teach) return r;
    const key = shown.replace(/\d+/g, "#"),
      now = this.s.playSeconds || 0,
      last = this._zSaid.get(key);
    this._zSaid.set(key, now);
    if (this._zSaid.size > 80) this._zSaid.delete(this._zSaid.keys().next().value);
    if (last == null || now - last > REPEAT.sec) return r;
    return { tier: "routine", float: shown.replace(/[。！]$/, "").slice(0, REPEAT.keep), color: tone === "warn" ? "#f1a28a" : undefined };
  }
  // 头顶的飘字：挨着来的往上挪一行
  zFloat(text, color, long = false) {
    if (!text) return;
    const p = this.s.player,
      now = this.s.playSeconds || 0,
      f = this._zFloat;
    f.n = now - f.at < FLOAT.gap ? (f.n + 1) % FLOAT.rows : 0;
    f.at = now;
    this.effects?.push({ x: p.x, y: p.y - FLOAT.y - f.n * FLOAT.rise, text: String(text).slice(0, long ? 34 : 24), t: long ? FLOAT.t + 0.6 : FLOAT.t, color: color || FLOAT.color });
    this.zStat("floats");
  }
  // 把一件事里的几行先收着（大事登场用），返回 [结果, 收着的几行]
  zCapture(fn) {
    const prev = this._zCap;
    this._zCap = [];
    let out, cap;
    try {
      out = fn();
    } finally {
      cap = this._zCap;
      this._zCap = prev;
    }
    return [out, cap];
  }
  zRelease(cap) {
    for (const [text, tone] of cap || []) this.zRoute(text, tone);
  }
  // 大事登场：场景上方一张卡片（界面在 zest-ui.js），存档里记一笔
  moment(kind, title, lines = [], extra = {}) {
    const z = this.zx;
    if (!z) return false;
    z.moments[kind] = (z.moments[kind] || 0) + 1;
    this.zStat("moments");
    this.events.push({ type: "moment", kind, title: String(title).slice(0, 40), lines: (lines || []).filter(Boolean).map((l) => String(l).slice(0, 120)).slice(0, 4), day: this.s.day, ...extra });
    return true;
  }

  // ================= 一遍田的账 =================
  zTally(kind, m, n = 1) {
    const t = (this._zTally ||= { harvest: {}, fine: 0, tend: 0, plant: 0, weed: 0, bugs: 0, hoe: 0, n: 0, last: 0, lastMin: 0 });
    if (kind === "bugs") t.bugs += Number(m?.[1]) || n;
    else if (kind === "harvest") {
      const [crop, got, fine] = m;
      t.harvest[crop] = (t.harvest[crop] || 0) + got;
      t.fine += fine;
    } else t[kind] = (t[kind] || 0) + n;
    t.n++;
    t.last = this.s.playSeconds || 0;
    t.lastMin = this.zAbs();
  }
  zAbs() {
    return (this.s.day || 0) * 1440 + (this.s.minute || 0);
  }
  zTallyText(t) {
    const bits = [];
    const crops = Object.entries(t.harvest).filter(([, n]) => n > 0);
    if (crops.length) bits.push("收了 " + crops.map(([c, n]) => (CROPS[c]?.name || ITEMS[c]?.name || c) + " ×" + n).join("、") + (t.fine ? "（优质 " + t.fine + "）" : ""));
    if (t.tend) bits.push("照看 " + t.tend + " 块");
    if (t.plant) bits.push("种下 " + t.plant + " 块");
    if (t.hoe) bits.push("清理开垦 " + t.hoe + " 块");
    if (t.weed) bits.push("拔草 " + t.weed + " 处");
    if (t.bugs) bits.push("捉虫 " + t.bugs + " 只");
    return bits.length ? "这一遍田：" + bits.join("；") + "。" : "";
  }
  zFlush() {
    const t = this._zTally;
    this._zTally = null;
    if (!t || t.n < TALLY.min) return false;
    const text = this.zTallyText(t);
    if (!text) return false;
    this.zStat("tallies");
    this.zSink(text, "normal");
    return true;
  }
  advanceMinutes(n) {
    const out = super.advanceMinutes(n);
    if (this._zTally && this.zAbs() - this._zTally.lastMin >= TALLY.idleMin) this.zFlush();
    return out;
  }
  travel(...args) {
    if (this._zTally) this.zFlush();
    return super.travel(...args);
  }
  sleep(...args) {
    if (this._zTally) this.zFlush();
    return super.sleep(...args);
  }

  // ================= 玩家自己动手（按 E、按住连做、从田的页面里点） =================
  zMine(fn) {
    this._zAct++;
    try {
      return fn();
    } finally {
      this._zAct--;
    }
  }
  interact(...args) {
    return this.zMine(() => super.interact(...args));
  }
  plantSeed(...args) {
    return this.zMine(() => super.plantSeed(...args));
  }
  use(...args) {
    return this.zMine(() => super.use(...args));
  }
  handHarvest(p) {
    if (!super.handHarvest) return false;
    const crop = p?.crop,
      forms = crop ? cropForms(crop) : [],
      before = forms.map((id) => this.qty(id, true)),
      fineBefore = crop ? this.qty("fine_" + crop, true) + this.qty("prime_" + crop, true) : 0,
      first = this.s.milestones?.harvest == null;
    const ok = this.zMine(() => super.handHarvest(p));
    if (ok && crop) {
      const got = forms.reduce((a, id, i) => a + Math.max(0, this.qty(id, true) - before[i]), 0),
        fine = Math.max(0, this.qty("fine_" + crop, true) + this.qty("prime_" + crop, true) - fineBefore);
      this.zTally("harvest", [crop, got, fine]);
      if (first && this.s.milestones?.harvest != null) this.moment("harvest", "第一份收成", [(CROPS[crop]?.name || crop) + " +" + Math.max(1, got) + "：这片地又长出能吃的东西了。"]);
    }
    return ok;
  }

  // ================= 按住交互连做 =================
  // 这块田现在按 E 会做哪件不用开页面的事（没有就是 null）
  zAutoAct(p) {
    if (!p || !this.isFarmPlot?.(p) || !this.g) return null;
    if (this.giantOf?.(p)) return () => this.giantHit(p);
    if (p.crop && CROPS[p.crop] && p.growth >= CROPS[p.crop].grow) return p.crop === "hybrid" && this.hybridHarvest ? () => this.hybridHarvest(p) : () => this.handHarvest(p);
    const rec = this.g.plots[p.id];
    if (rec?.w) return () => this.pullWeed(p);
    if (rec?.b) return () => this.catchBugs(p);
    if (this.plotDebris(p) || !p.tilled) return () => this.toolPlot(p, "hoe");
    if (p.crop) {
      const need = TRAITS[p.trait]?.water || 1;
      if (!this.plotWatered(p) && (this.c?.water ?? need) >= need) return () => this.toolPlot(p, "water");
      if (rec?.t !== this.s.day) return () => this.tend(p);
      return null;
    }
    const seed = this.s.seed;
    if (seed && ITEMS[seed]?.type === "seed" && this.qty(seed, this.s.region === "farm") > 0 && !this.pickReason?.(p)) return () => this.plantSeed(p.id, seed);
    return null;
  }
  zFarmStep() {
    if (this.paused || this.s.region !== "farm" || !this.g || this.c?.fishing || this.reeling?.() || this.buildMode) return false;
    const me = this.s.player;
    const near = this.s.plots
      .filter((p) => dist(p, me) <= HOLD.reach)
      .sort((a, b) => dist(a, me) - dist(b, me));
    for (const p of near) {
      const act = this.zAutoAct(p);
      if (!act) continue;
      const ok = this.zMine(act);
      if (ok) return true;
    }
    return false;
  }
  zHoldTick(dt, input) {
    const h = this._zHold;
    const can = !!input?.hold && !this.paused && this.s.region === "farm" && !this.c?.fishing && !this.reeling?.();
    if (!can) {
      if (h.acts >= 2) {
        this.zStat("holds");
        if (this.zx.taught.hold < TEACH_TIMES) this.zx.taught.hold++;
      }
      h.t = 0;
      h.cd = 0;
      h.acts = 0;
      return;
    }
    h.t += dt;
    h.cd = Math.max(0, h.cd - dt);
    if (h.t < HOLD.after || h.cd > 0) return;
    if (this.zFarmStep()) {
      h.acts++;
      this.zStat("holdActs");
      h.cd = HOLD.every;
    } else h.cd = HOLD.idle;
  }
  // 头一回知道能按住：田边的提示多说半句
  plotContext(p) {
    const base = super.plotContext(p);
    if (this.zx && this.zx.taught.hold < TEACH_TIMES && this.zAutoAct(p)) return base + " · 按住 E 一路做下去";
    return base;
  }

  // ================= 送礼、交清单、钓鱼：补反馈 =================
  giveGift(id, item) {
    const p = this.s.player,
      t0 = this.ss?.trust ? this.ss.trust[id] || 0 : null;
    const [ok, cap] = this.zCapture(() => super.giveGift(id, item));
    this.zRelease(cap);
    if (!ok || !this.kin) return ok;
    let cat = "meh";
    try {
      cat = this.giftValue(id, item)?.cat || "meh";
    } catch {}
    // 信任变了多少：直接比前后（送错了的那一行是警告色，不经过上面收着的几行）
    const t1 = this.ss?.trust ? this.ss.trust[id] || 0 : null,
      d = Number.isFinite(t0) && Number.isFinite(t1) ? t1 - t0 : 0,
      emote = GIFT_EMOTE[cat] || GIFT_EMOTE.meh;
    this.effects?.push({ x: p.x + 26, y: p.y - 78, text: emote.text + (d ? " 信任 " + (d > 0 ? "+" : "") + d : ""), t: 1.6, color: emote.color });
    this.events.push({ type: "gift", cat, x: p.x, y: p.y });
    this.zStat("gifts");
    return ok;
  }
  rlDeliver(id, key) {
    const ok = super.rlDeliver(id, key);
    if (ok) {
      this.events.push({ type: "stamp", list: id, key });
      // 重建站那一页上刚交的那一格闪一下（只在这一会儿，不进存档）
      this._zStamp = { list: id, key, at: Date.now() };
      this.zStat("stamps");
    }
    return ok;
  }
  // 交一格的那一行不要金色（交满一份、一面墙才是）
  // （文字在 relight.js：“交了…×n（「…」a/b）。”）
  // 下隧道：顺着检修梯下一层，一声梯子响（原来到了新的一层没有声音；坐电梯下去的有电梯自己的声音）
  tunnelDown(...args) {
    const ok = super.tunnelDown(...args);
    if (ok) this.events.push({ type: "floor", floor: this.rl?.tunnel?.floor || 0 });
    return ok;
  }
  reelLand(...args) {
    const before = { ...(this.kin?.fish || {}) };
    const [ok, cap] = this.zCapture(() => super.reelLand(...args));
    const fresh = Object.keys(this.kin?.fish || {}).filter((id) => !before[id] && this.kin.fish[id] > 0 && FISH[id]);
    if (!fresh.length) {
      this.zRelease(cap);
      return ok;
    }
    // 第一次钓到这种鱼：单独登场，带上原来那句话里的提醒
    const known = FISH_IDS.filter((x) => (this.kin.fish[x] || 0) > 0).length;
    for (const sp of fresh) {
      const said = (cap || []).map(([t]) => t).find((t) => t.includes(ITEMS[sp]?.name || "")) || "";
      const tail = (said.match(/！(.+)$/) || [])[1] || "";
      this.moment("fish", "新鱼：" + (ITEMS[sp]?.name || sp), ["鱼类图鉴 " + known + "/" + FISH_IDS.length + (FISH[sp]?.tier === "rare" ? " · 稀有" : ""), tail], { item: sp });
      this.zStat("fish");
    }
    this.zRelease((cap || []).filter(([t]) => !fresh.some((sp) => t.includes(ITEMS[sp]?.name || "\u0000"))));
    return ok;
  }
  // 余烬核：一张卡片念独白（原来的提示和小卡片合成这一张）
  grantCore(id) {
    const n = this.events.length;
    const [ok, cap] = this.zCapture(() => super.grantCore(id));
    if (!ok) {
      this.zRelease(cap);
      return ok;
    }
    // 原来那张念独白的小卡片并进大事卡片（原地删，别换掉 events 这个数组）
    for (let i = this.events.length - 1; i >= n; i--) if (this.events[i]?.type === "ledger" && String(this.events[i].title || "").startsWith("余烬核")) this.events.splice(i, 1);
    const lines = [...(CORE_LINES[id] || []).slice(0, 2), "体力上限 +" + CORE_BONUS.sta + "、生命上限 +" + CORE_BONUS.hp + "；长夜每波多来 " + Math.round(CORE_BONUS.night * 100) + "%（" + this.rl.cores.length + "/" + CORE_IDS.length + "）"];
    this.moment("core", "余烬核 · " + (CORES[id]?.name || id), lines, { core: id });
    this.zRelease((cap || []).filter(([t]) => !/^拿到一颗余烬核/.test(t)));
    return ok;
  }

  // ================= 每一帧 =================
  update(dt, input = {}) {
    const intro = !this.paused && this.zx?.intro;
    if (intro && !intro.told) {
      intro.told = true;
      this.moment("intro", "手感", INTRO_LINES);
    }
    const out = super.update(dt, input);
    if (Number.isFinite(dt) && dt > 0) {
      this.zHoldTick(Math.min(dt, 0.1), input);
      const t = this._zTally;
      if (t && (this.s.playSeconds || 0) - t.last >= TALLY.idleSec) this.zFlush();
    }
    return out;
  }
  // 任务手记“今天”下面那一行：今天的早间广播
  radioToday() {
    const r = this.zx?.radio;
    return r && r.day === this.s.day ? r.text : "";
  }

  // ================= 存档 =================
  static parse(text) {
    const s = RelightEngine.parse(text);
    migrateState(s);
    validateZest(s);
    return s;
  }
}

void MOMENT;
void MOMENT_KINDS;
void SKILL_NAMES;

function validateZest(s) {
  const z = s.zest,
    bad = (why) => {
      throw new Error("存档里的手感记录损坏（" + why + "），请从设置恢复有效备份；原存档会保留。");
    };
  if (!z || typeof z !== "object") bad("缺少");
  const int = (v, lo = 0, hi = 1e9) => Number.isInteger(v) && v >= lo && v <= hi,
    obj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
  if (!int(z.schema, 1, 99)) bad("版本");
  if (!obj(z.taught) || Object.entries(z.taught).some(([k, v]) => !(TEACH_IDS.includes(k) || k === "hold") || !int(v, 0, 999))) bad("教学");
  if (z.radio !== null && (!obj(z.radio) || !int(z.radio.day) || typeof z.radio.text !== "string" || z.radio.text.length > 400)) bad("广播");
  if (!obj(z.moments) || Object.entries(z.moments).some(([k, v]) => k.length > 16 || !int(v))) bad("大事");
  if (!obj(z.stats) || Object.values(z.stats).some((v) => !int(v))) bad("记录");
  if (z.intro !== undefined && (!obj(z.intro) || !int(z.intro.day) || typeof z.intro.told !== "boolean")) bad("记录");
}
