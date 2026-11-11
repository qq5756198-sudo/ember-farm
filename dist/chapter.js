// v0.50「落脚」：章节这一层，压在最上面。
// 它管四件事：
// 1. 一条主线分五章：现在在第几章、这一段要做什么、差多少（界面左下角和手记都读它）。
// 2. 哪一章开哪样东西：没到的地方去不了，没到的话不说，没到的页面不开。
// 3. 每章末尾一个把关的考验：第一章是第一场尸潮（前一天有前兆，没守住第二天夜里再来）。
// 4. 新存档：只认带 format="ember-r1" 的档，旧档不读。
// 下面各层的玩法（种菜、打僵尸、建造、做饭）一样不动。
import { Engine as Base, newGameState as baseNewGame } from "./ahead.js";
import { ITEMS, CROPS, REGIONS, BUILDINGS } from "./data.js";
import { MEAL_ITEMS } from "./outpost-data.js";
import { SAVE_FORMAT, CHAPTERS, CN_NUM, CH1_REGIONS, CH1_STAGES, PREP, GATE1, BARKS, CH1_QUIET, CH1_REWORD, TRIP_BOONS, CH_BUILD, CH1_GROW, SCOUT, CH1_STOCK } from "./chapter-data.js";

const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
const MATERIALS = ["wood", "stone", "scrap", "parts", "cloth"];
const HEAL_ITEMS = ["bandage", "medkit"];
// 第一章里界面认得的页面；别的页面是后面几章的，先不开
const CH1_MENUS = new Set(["home", "quests", "journey", "rebuild", "trade", "map", "storage", "building", "station", "build", "death", "craft", "inventory", "ch"]);
const CH1_VIEWS = new Set(["daily", "gPick", "gPlot", "summary", "people", "crew", "pick", "shipping"]);

export function chapterDefaults() {
  return {
    v: 1,
    n: 1,
    done: [],
    seen: {},
    barks: {},
    gate: { day: GATE1.day, state: "far", tries: 0, count: 0, live: false, wonDay: 0, pulled: false },
    trip: null,
    day0: { day: 1, money: 0, food: 0, mat: 0 },
    scene: "intro",
    endDay: 0,
    rewarded: false,
  };
}
function normalize(raw) {
  const d = chapterDefaults(),
    x = raw && typeof raw === "object" ? raw : {};
  const num = (v, f) => (Number.isFinite(v) ? v : f);
  const g = x.gate && typeof x.gate === "object" ? x.gate : {};
  const t = x.trip && typeof x.trip === "object" ? x.trip : null;
  return {
    v: 1,
    n: clamp(Math.floor(num(x.n, 1)), 1, 5),
    done: Array.isArray(x.done) ? x.done.filter((n) => Number.isInteger(n) && n >= 1 && n <= 5) : [],
    seen: Object.fromEntries(Object.entries(x.seen && typeof x.seen === "object" ? x.seen : {}).map(([k, v]) => [String(k).slice(0, 40), !!v])),
    barks: Object.fromEntries(Object.entries(x.barks && typeof x.barks === "object" ? x.barks : {}).map(([k, v]) => [String(k).slice(0, 40), num(v, 1)])),
    gate: {
      day: Math.max(1, Math.floor(num(g.day, d.gate.day))),
      state: ["far", "omen", "tonight", "active", "won"].includes(g.state) ? g.state : "far",
      tries: Math.max(0, Math.floor(num(g.tries, 0))),
      count: Math.max(0, Math.floor(num(g.count, 0))),
      live: !!g.live,
      wonDay: Math.max(0, Math.floor(num(g.wonDay, 0))),
      pulled: !!g.pulled,
    },
    trip: t
      ? {
          region: typeof t.region === "string" ? t.region : "",
          offered: !!t.offered,
          offer: Array.isArray(t.offer) ? t.offer.filter((id) => TRIP_BOONS.some((b) => b.id === id)).slice(0, 3) : [],
          pick: typeof t.pick === "string" ? t.pick : "",
          buff: typeof t.buff === "string" ? t.buff : "",
        }
      : null,
    day0: {
      day: Math.max(1, Math.floor(num(x.day0?.day, 1))),
      money: num(x.day0?.money, 0),
      food: num(x.day0?.food, 0),
      mat: num(x.day0?.mat, 0),
    },
    scene: typeof x.scene === "string" ? x.scene.slice(0, 20) : "",
    endDay: Math.max(0, Math.floor(num(x.endDay, 0))),
    rewarded: !!x.rewarded,
  };
}

export function newGameState(origin = "farmer") {
  const s = baseNewGame(origin);
  s.format = SAVE_FORMAT;
  s.ch = chapterDefaults();
  s.ch.day0.money = s.money || 0;
  s.ch.day0.mat = MATERIALS.reduce((n, id) => n + (s.inventory[id] || 0) + (s.storage?.[id] || 0), 0);
  s.ch.day0.food = MEAL_ITEMS.reduce((n, id) => n + (s.inventory[id] || 0) + (s.storage?.[id] || 0), 0);
  return s;
}
export const freshState = () => newGameState("farmer");

export class Engine extends Base {
  constructor(s = freshState(), notify = () => {}) {
    if (!s.ch) s.ch = chapterDefaults();
    s.ch = normalize(s.ch);
    s.format = SAVE_FORMAT;
    // 下面有一层在摆好场景时会顺手记一遍“谁在哪儿、见过谁”。读档时这会把存下来的数改掉
    // （存出来再读回去就不是一字不差了）：读进来是什么样，摆完场景还是什么样。
    const th = s.theft,
      keep = th ? JSON.stringify([th.where ?? null, th.seen ?? null]) : null;
    super(s, notify);
    if (keep && this.s.theft) {
      const [where, seen] = JSON.parse(keep);
      if (where) this.s.theft.where = where;
      if (seen) this.s.theft.seen = seen;
    }
    this._chClock = 0;
    this._chOuting = 0;
  }
  get ch() {
    return this.s.ch;
  }

  // ================= 现在在第几章 =================
  chNow() {
    return this.ch.n;
  }
  chDef(n = this.ch.n) {
    return CHAPTERS[n];
  }
  chLabel(n = this.ch.n) {
    return "第" + CN_NUM[n] + "章 · " + CHAPTERS[n].name;
  }
  chDone(n = this.ch.n) {
    return this.ch.done.includes(n);
  }
  // 这一章开没开这样东西
  chOpen(key) {
    const n = this.ch.n;
    if (key === "team") return (this.sc?.helpers || []).length + (this.c?.residents || []).length > 0;
    if (key === "trade") return true;
    if (["jobs", "squad", "talent", "steal", "codex"].includes(key)) return n >= 2;
    if (["power", "tech"].includes(key)) return n >= 3;
    return true;
  }
  // 这样设施是第几章开的（0：哪一章都不开）
  chBuildChapter(id) {
    for (const n of [1, 2, 3, 4, 5]) if ((CH_BUILD[n] || []).includes(id)) return n;
    return 0;
  }
  chBuildOpen(id) {
    const n = this.chBuildChapter(id);
    return n > 0 && n <= this.ch.n;
  }
  startBuild(id) {
    if (this.ch && !this.chBuildOpen(id)) {
      const n = this.chBuildChapter(id);
      super.toast(n ? "这样设施第" + CN_NUM[n] + "章才能建。" : "这样设施现在建不了。", "warn");
      return false;
    }
    return super.startBuild(id);
  }
  chRegionOpen(id) {
    if (!REGIONS[id]) return false;
    if (this.ch.n === 1) return CH1_REGIONS.includes(id);
    return true;
  }
  chRegionNote(id) {
    return this.chRegionOpen(id) ? "" : "这条路第二章再走";
  }

  // ================= 第一章的段 =================
  chStage() {
    if (this.chDone(1)) return "done";
    const sc = this.sc;
    if (!sc || sc.act <= 1) return "settle";
    if (sc.act === 2) {
      const g = this.storyGoal?.();
      // 回了信先挑补给、守路口（“守住东边的路口”），路口堵上了才是“把阿禾接回来”
      const id = g?.step?.id;
      return id === "choice" || id === "opening" || (this.feel?.open && this.feel.open.phase !== "done" && sc.choice) ? "road" : "people";
    }
    const gs = this.ch.gate.state;
    if (gs === "tonight" || gs === "active") return "gate";
    if (gs === "won") return "done";
    return "prep";
  }
  chFences() {
    return this.s.buildings.filter((b) => (b.type === "fence" || b.type === "gate") && b.hp > 0).length;
  }
  chHeal() {
    return HEAL_ITEMS.reduce((n, id) => n + this.qty(id, true), 0);
  }
  chCount(type) {
    return this.s.buildings.filter((b) => b.type === type && b.hp > 0).length;
  }
  chPrepLines() {
    const days = this.foodDays?.() ?? 0,
      f = this.chFences(),
      t = this.chCount("trap"),
      h = this.chHeal(),
      b = this.chCount("breeder");
    return [
      { id: "food", text: "口粮够全营吃 " + PREP.foodDays + " 天", have: days, need: PREP.foodDays, done: days >= PREP.foodDays, note: "现在够 " + days + " 天" },
      { id: "fence", text: "围栏和大门立起 " + PREP.fences + " 段", have: f, need: PREP.fences, done: f >= PREP.fences, note: f + "/" + PREP.fences },
      { id: "trap", text: "路障陷阱摆 " + PREP.traps + " 个", have: t, need: PREP.traps, done: t >= PREP.traps, note: t + "/" + PREP.traps },
      { id: "heal", text: "绷带或药包备 " + PREP.heal + " 份", have: h, need: PREP.heal, done: h >= PREP.heal, note: h + "/" + PREP.heal },
      { id: "breeder", text: "建一个育种箱", have: b, need: PREP.breeder, done: b >= PREP.breeder, note: b ? "有了" : "还没有" },
    ];
  }
  chPrepReady() {
    return this.chPrepLines().every((l) => l.done);
  }
  // 左下角和手记读的：这一章、这一段、眼下这一步、几件事各差多少
  chGoal() {
    const n = this.ch.n,
      stage = this.chStage(),
      S = CH1_STAGES[stage],
      out = { n, label: this.chLabel(n), stage, title: S.title, why: S.why, step: null, lines: [], gate: this.chGateInfo() };
    if (stage === "settle" || stage === "road" || stage === "people") {
      const g = this.storyGoal?.();
      if (g?.step) {
        out.step = { id: g.step.id, title: g.step.title, text: g.step.text, gain: g.step.gain || "", target: g.step.target || null, kind: g.step.kind || "mark", doLabel: g.step.doLabel || "", cost: g.step.cost || null };
        out.lines = (g.steps || []).map((s) => ({ id: s.id, text: s.label, done: !!s.done, note: "" }));
        // 阿禾接回来以后，这一段说的是让她留下
        if (stage === "people" && (g.step.id === "farmerMeal" || g.step.id === "table")) {
          out.title = "让阿禾住下来";
          out.why = "她说，有一张大家坐得下的饭桌，才算是个营地。";
        }
        // 公共餐桌那一步：三样各要什么、料从哪来，写全
        if (g.step.id === "table" && this.taskRequirements?.("table").some((x) => !x.pass))
          out.step.text = "公共餐桌要三样：交料（木材 12、萝卜 9）、一张制作台（木材 8、石头 4）、再添一张床位（木材 8、布 2）。料不够：废弃居民区的柜子里翻得到，集市的老周也卖；多出来的萝卜、土豆卖给林姨换钱。";
      }
    } else if (stage === "prep") {
      out.lines = this.chPrepLines();
      const miss = out.lines.find((l) => !l.done);
      const tip = {
        food: "多种几块萝卜、土豆，做成干粮和炖汤；来不及就去集市找林姨买。",
        fence: "打开建造，围栏排在东边的路口，留一扇大门自己走；它们啃围栏的时候，隔着围栏打它们够不着你。木头不够：居民区的柜子里有，集市的老周也卖。",
        trap: "路障陷阱摆在东边路口它们进来的路上（放的时候地上有红圈标着来路）：踩一下挨 45，一个陷阱管 8 下，用完要修。",
        heal: "一块布在制作台能做两条绷带；集市上也买得到。",
        breeder: "育种箱：一份菜换两颗种子，以后不用总跑集市买种子。",
      };
      out.step = miss
        ? { id: "prep:" + miss.id, title: miss.text, text: tip[miss.id], gain: "", target: null, kind: "mark", doLabel: "", cost: null }
        : { id: "prep:ready", title: "都备好了，等它们来", text: this.chCanCallGate() ? "不想等的话，可以在手记里提前迎战：今晚就来。" : "第 " + this.ch.gate.day + " 天夜里 " + GATE1.hour + ":00，它们从东边的路口进来。", gain: "", target: null, kind: "mark", doLabel: "", cost: null };
    } else if (stage === "gate") {
      const h = this.s.horde,
        left = h.phase === "active" ? h.remaining + this.enemies.filter((z) => z.horde && !z.dead).length : this.ch.gate.count;
      out.lines = [{ id: "hold", text: h.phase === "active" ? "还剩 " + left + " 只" : h.phase === "warning" ? "还有 " + Math.ceil(h.timer) + " 秒进场" : "今晚 " + GATE1.hour + ":00 来 " + this.chGateCount() + " 只上下", done: false, note: "" }];
      out.step = { id: "gate", title: h.phase === "active" ? "守住路口，把它们都打倒" : "天黑前回到农场", text: "它们从东边的路口进来。围栏能挡一阵；被围住了按推开，往旁边滚。", gain: "", target: { region: "farm", x: 1330, y: 400, label: "东边路口" }, kind: "mark", doLabel: "", cost: null };
    } else if (stage === "done") {
      out.step = { id: "done", title: "第二章〈营地〉下一版开放", text: "现在可以留在农场接着经营：地照种，人照吃饭，尸潮过几天还会再来。", gain: "", target: null, kind: "mark", doLabel: "", cost: null };
    }
    return out;
  }

  // ================= 把关的考验：第一场尸潮 =================
  chGateCount() {
    const food = this.foodPortions?.() ?? 0;
    return clamp(GATE1.base + Math.floor(food / GATE1.perFood) + Math.floor(this.chFences() / GATE1.perFence), GATE1.base, GATE1.max);
  }
  chGateInfo() {
    const g = this.ch.gate,
      day = this.s.day,
      left = g.day - day;
    return {
      state: g.state,
      day: g.day,
      hour: GATE1.hour,
      tries: g.tries,
      when: g.state === "won" ? "" : left <= 0 ? "今晚" : left === 1 ? "明晚" : left + " 天后的夜里",
      count: g.state === "active" ? g.count : this.chGateCount(),
      canCall: this.chCanCallGate(),
    };
  }
  chCanCallGate() {
    const g = this.ch.gate,
      s = this.s;
    return this.ch.n === 1 && !this.chDone(1) && ["far", "omen"].includes(g.state) && s.day >= GATE1.earlyFrom && s.day < g.day && s.minute < GATE1.warnHour * 60 && (this.sc?.act || 1) >= 3 && this.chPrepReady();
  }
  // 提前迎战：今晚就来
  chCallGate() {
    if (!this.chCanCallGate()) {
      this.toast("还不能提前迎战：先把该备的备好。", "warn");
      return false;
    }
    this.ch.gate.day = this.s.day;
    this.ch.gate.state = "omen";
    this.toast("你点着了路口的火堆。今晚 " + GATE1.hour + ":00，它们会来。", "warn");
    this.olog?.("提前迎战：今晚 " + GATE1.hour + ":00 第一场尸潮。", "warn");
    this.emit("alarm");
    return true;
  }
  chGateTick() {
    const g = this.ch.gate,
      s = this.s,
      day = s.day,
      m = s.minute;
    if (this.ch.n !== 1 || g.state === "won") return;
    const busy = ["warning", "active"].includes(s.horde.phase);
    if (g.state === "far" && (day > g.day - 1 || (day === g.day - 1 && m >= GATE1.omenHour * 60))) {
      g.state = "omen";
      this.chBark("omen");
      const text = (day >= g.day ? "今晚" : "明晚") + " " + GATE1.hour + ":00，第一场尸潮会从东边的路口来。";
      this.toast(text, "warn");
      this.olog?.(text, "warn");
    }
    if (g.state === "omen" && day >= g.day && m >= GATE1.warnHour * 60) {
      g.state = "tonight";
      this.chBark("gateDay");
      this.toast("天黑了。" + GATE1.hour + ":00 它们就到，别出门，把围栏和绷带再看一遍。", "warn");
    }
    if (g.state === "tonight" && !busy && (day > g.day || m >= GATE1.hour * 60)) {
      if (s.region !== "farm") {
        this._chForce = true;
        this.travel("farm");
        this._chForce = false;
        this.toast("你赶回了农场。", "warn");
      }
      g.count = this.chGateCount();
      g.live = true;
      g.pulled = false;
      g.state = "active";
      s.horde = { phase: "warning", timer: GATE1.prepSeconds, remaining: g.count, spawnTimer: 0, direction: 0 };
      const text = "第一场尸潮来了：" + g.count + " 只上下，从东边的路口进来。还有 " + GATE1.prepSeconds + " 秒。";
      this.toast(text, "warn");
      this.olog?.(text, "warn");
      this.emit("alarm");
    }
    if (g.state === "active" && g.live) {
      if (s.horde.phase === "won") {
        g.live = false;
        g.state = "won";
        g.wonDay = day;
        const text = "守住了。" + g.count + " 只，都倒在了路口。";
        this.toast(text, "gold");
        this.olog?.(text, "gold");
        this.emit("victory");
      } else if (s.horde.phase === "locked") this.chGateLost();
    }
  }
  // 第 6 天傍晚：几只探路的摸到东边路口（尸潮的前兆）
  chScoutTick() {
    const c = this.ch,
      s = this.s;
    if (c.n !== 1 || c.seen.scout || this.chDone(1) || s.region !== "farm") return;
    if (s.day < SCOUT.day || (s.day === SCOUT.day && s.minute < SCOUT.from) || s.minute < SCOUT.from || s.minute > SCOUT.to) return;
    if (["warning", "active"].includes(s.horde.phase) || ["tonight", "active", "won"].includes(c.gate.state) || s.day >= c.gate.day || (this.sc?.act || 1) < 2) return;
    c.seen.scout = true;
    SCOUT.kinds.forEach((kind, i) => this.enemies.push(this.enemy(kind, 1435 - (i % 2) * 25, 380 + i * 45, true)));
    const text = "东边路口有动静：几只探路的摸过来了。大的还在后头。";
    this.toast(text, "warn");
    this.olog?.(text, "warn");
    this.emit("alarm");
  }
  cropGrowthRate(p) {
    const k = this.ch && this.ch.n === 1 && (this.r?.claimed || []).includes("harvest") ? CH1_GROW : 1;
    return super.cropGrowthRate(p) * k;
  }
  // 考验那一夜来的，和废弃居民区里碰到的是一样的家伙（血、脚程、手劲按 GATE1.phase 那一段）。
  // 下面几层的农场尸潮用的是最早那套数（游荡者 65 血、奔跑者比你走路还慢），一个人绕着圈打就一下也挨不着，备不备战都一样。
  enemy(type, x, y, horde = false) {
    const z = super.enemy(type, x, y, horde);
    if (horde && this.gr && this.ch?.n === 1 && this.ch.gate?.live) {
      const st = this.zstat(type, GATE1.phase);
      if (st) {
        z.hp = z.maxHp = st.hp;
        z.ph = GATE1.phase;
      }
    }
    return z;
  }
  // 考验的那一夜：都从东边路口这一处进来（手记、提醒里都这么说，陷阱摆在路上才踩得着），隔得稍开一点
  updateHorde(dt) {
    const h = this.s.horde,
      g = this.ch?.gate,
      before = h.remaining,
      n = this.enemies.length;
    const out = super.updateHorde(dt);
    if (this.ch?.n === 1 && g?.live && h.phase === "active" && h.remaining < before && this.enemies.length > n) {
      const z = this.enemies[this.enemies.length - 1],
        L = GATE1.lane;
      if (z?.horde) {
        // 一只一个位置，按进场的次序排开（不用随机数，读档重来还是这个次序）
        const k = ((before * 7) % 5) - 2;
        z.x = z.homeX = z.targetX = L.x + (before % 2) * 14;
        z.y = z.homeY = z.targetY = L.y + (k * L.spread) / 2;
      }
      h.spawnTimer = GATE1.gap;
    }
    return out;
  }
  beginHorde() {
    const ok = super.beginHorde();
    if (ok && this.ch?.gate?.live) this.s.horde.remaining = this.ch.gate.count;
    return ok;
  }
  // 第一章集市上多卖两份药包（一份货只补一次）
  traderStock(id) {
    const stock = super.traderStock(id);
    if (this.ch?.n === 1) for (const [item, n] of Object.entries(CH1_STOCK[id] || {})) if (!(stock[item] >= 0)) stock[item] = n;
    return stock;
  }
  // 考验的那一夜倒下了：头一回铁锹把你拖回农舍，尸潮不停；同一夜第二回倒下才算没守住，尸潮散掉，下一个夜里再来
  die() {
    const g = this.ch?.gate,
      night = this.ch?.n === 1 && !!g?.live && g.state === "active" && ["warning", "active"].includes(this.s.horde.phase),
      saved = night && !g.pulled && (this.sc?.helpers || []).some((h) => h.id === "tieqiao"),
      lost = night && !saved;
    if (saved) {
      g.pulled = true;
      this._chPulledAt = this.s.playSeconds || 0;
    }
    if (lost) {
      for (const z of this.s.enemies?.farm || []) if (z.horde) z.dead = true;
      this.s.horde = { phase: "locked", timer: 0, remaining: 0, spawnTimer: 0, direction: 0 };
    }
    // 下面几层的老规矩是“尸潮里倒下，尸潮就算散了”；被拖回来的这一回尸潮照旧，原样放回去
    const keep = saved ? { ...this.s.horde } : null;
    const out = super.die();
    if (keep) this.s.horde = keep;
    if (lost) this.chGateLost();
    return out;
  }
  // 记一回没守住：过了半夜倒下的，今晚（同一天的夜里）再来；半夜以前倒下的，明晚再来
  chGateLost() {
    const g = this.ch.gate,
      s = this.s;
    if (!g.live) return;
    g.live = false;
    g.state = "omen";
    g.day = s.day + (s.minute < 6 * 60 ? 0 : GATE1.retryDays);
    g.tries++;
    this._chLostAt = s.playSeconds || 0;
    // 铁锹连夜把围栏、大门、陷阱扶起来：坏了的修到六成（本来更好的不动），免得一回没守住就越守越难
    let fixed = 0;
    if ((this.sc?.helpers || []).some((h) => h.id === "tieqiao"))
      for (const b of s.buildings) {
        if (!["fence", "gate", "trap"].includes(b.type) || !BUILDINGS[b.type]) continue;
        const want = Math.ceil(BUILDINGS[b.type].hp * 0.6);
        if (b.hp < want) {
          b.hp = want;
          fixed++;
        }
      }
    if (fixed) this.navRevision = (this.navRevision || 0) + 1;
    this._chFixed = fixed;
    this.chBark("gateLost");
    this.olog?.("第一场尸潮没守住。它们" + (g.day === s.day ? "今晚" : "明晚") + "还来。" + (fixed ? "铁锹连夜扶起了 " + fixed + " 处围栏和陷阱。" : ""), "warn");
  }
  // 没守住那一夜铁锹扶起了几处（醒来的卡上说）
  chGateFixed() {
    return this._chFixed || 0;
  }
  // 刚才这一回倒下，是不是被铁锹拖回来的那一回（醒来的那张卡上要说：尸潮还在）
  chGatePulledNow() {
    return this._chPulledAt != null && (this.s.playSeconds || 0) - this._chPulledAt < 5 && this.ch.gate.state === "active";
  }
  // 刚才这一回倒下，是不是倒在考验的那一夜（醒来的那张卡上要说）
  chGateLostNow() {
    return this._chLostAt != null && (this.s.playSeconds || 0) - this._chLostAt < 5 && this.ch.gate.state !== "won";
  }
  // 考验那一夜都进场了、只剩三只以内：最近的一只在哪儿（画面上给个圈和方向，夜里不用满农场找）
  chGateStragglers() {
    const h = this.s.horde,
      g = this.ch.gate;
    if (this.ch.n !== 1 || !g.live || h.phase !== "active" || h.remaining > 0 || this.s.region !== "farm") return null;
    const p = this.s.player,
      left = this.enemies.filter((z) => z.horde && !z.dead);
    if (!left.length || left.length > 3) return null;
    const z = left.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    return { region: "farm", x: Math.round(z.x), y: Math.round(z.y - 20), label: "还剩 " + left.length + " 只" };
  }
  // 今晚有考验：不能睡过去
  chGateTonight() {
    const g = this.ch.gate;
    return this.ch.n === 1 && !this.chDone(1) && ["omen", "tonight"].includes(g.state) && this.s.day >= g.day && this.s.minute >= 12 * 60;
  }
  sleep() {
    if (this.chGateTonight()) {
      this.toast("今晚有尸潮，守完再睡。", "warn");
      return false;
    }
    return super.sleep();
  }

  // 这一章做完没有：考验过了，这一章的人也接回来了
  chCheckDone() {
    const c = this.ch;
    if (c.n !== 1 || c.done.includes(1)) return false;
    if (c.gate.state !== "won" || !(this.sc?.claimed || []).includes("act2")) return false;
    c.done.push(1);
    c.endDay = this.s.day;
    if (!c.rewarded) {
      c.rewarded = true;
      this.s.money += GATE1.reward.money;
      if (this.putStorage) this.putStorage(GATE1.reward.items);
      else this.add(GATE1.reward.items);
    }
    c.scene = "ch1end";
    this.olog?.("第一章 落脚 做完了。联盟把余烬农场记入名册：" + GATE1.reward.money + " 金，还有一箱补给进了仓库。", "gold");
    this.emit("quest");
    return true;
  }
  // 过场：该放哪一段（界面放完了叫 chSceneDone）
  chScene() {
    return this.ch.scene || "";
  }
  chSceneDone() {
    const id = this.ch.scene;
    if (!id) return false;
    this.ch.seen[id] = true;
    this.ch.scene = "";
    return true;
  }
  chEndStats() {
    return { days: this.ch.endDay || this.s.day, harvest: this.s.stats.harvested || 0, kills: this.s.stats.kills || 0 };
  }

  // ================= 队友说的话 =================
  chBark(id) {
    const b = BARKS[id];
    if (!b || this.ch.barks[id]) return false;
    if (!this.chPerson(b.who)) return false;
    this.ch.barks[id] = this.s.day;
    this.olog?.(b.text);
    this.emit("bark", { who: b.who, text: b.text });
    return true;
  }
  chPerson(who) {
    if (who === "tieqiao") return (this.sc?.helpers || []).find((h) => h.id === "tieqiao") || null;
    return this.resident?.(who) || null;
  }
  chBarkTick() {
    const s = this.s,
      atFarm = s.region === "farm";
    if (!atFarm || this.paused) return;
    if (this.chFences() > 0) this.chBark("firstFence");
    if (s.visited?.residential && !this.resident?.("farmer")) this.chBark("firstTrip");
    if (this.resident?.("farmer")) this.chBark("farmerHome");
    if (this.sc?.flags?.farmerFed) this.chBark("farmerFed");
    if (s.day >= 3 && (this.eaters?.() || []).length > 0 && (this.foodDays?.() ?? 9) < 1) this.chBark("hungry");
    if ((s.stats.harvested || 0) >= 10) this.chBark("tenHarvest");
    if (s.player.hp < 40) this.chBark("hurtBack");
  }

  // ================= 出门一趟 =================
  travel(id) {
    if (!this._chForce && !this.chRegionOpen(id)) {
      this.toast(this.chRegionNote(id) + "。先把农场守住。", "warn");
      return false;
    }
    const from = this.s.region,
      carried = from !== "farm" ? Object.values(this.s.outing || {}).reduce((a, n) => a + n, 0) : 0;
    const ok = super.travel(id);
    if (!ok || this.s.region === from) return ok;
    const c = this.ch;
    if (this.s.region === "farm") {
      if (c.trip?.buff) this.c.buffs = this.c.buffs.filter((b) => b.id !== c.trip.buff);
      c.trip = null;
      if (carried >= 20) this.chBark("bigLoot");
    } else if (this.s.region !== "market" && from === "farm") {
      c.trip = { region: this.s.region, offered: false, offer: [], pick: "", buff: "" };
    }
    return ok;
  }
  // 这一趟头一回翻到东西：三样里挑一样
  chTripTick() {
    const t = this.ch.trip;
    if (!t || t.offered || this.s.region !== t.region) return;
    const got = Object.values(this.s.outing || {}).reduce((a, n) => a + n, 0);
    if (got <= 0) return;
    if (this.enemies.some((z) => !z.dead && !z.lying && Math.hypot(z.x - this.s.player.x, z.y - this.s.player.y) < 220)) return;
    t.offered = true;
    const pool = TRIP_BOONS.map((b) => b.id);
    const pick = [];
    while (pick.length < 3 && pool.length) pick.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
    t.offer = pick;
    this.emit("menu", { menu: "ch", view: "boon" });
  }
  chTripOffer() {
    const t = this.ch.trip;
    return t && t.offer.length && !t.pick ? t.offer.map((id) => TRIP_BOONS.find((b) => b.id === id)) : [];
  }
  chPickBoon(id) {
    const t = this.ch.trip,
      b = TRIP_BOONS.find((x) => x.id === id);
    if (!t || t.pick || !b || !t.offer.includes(id)) return false;
    t.pick = id;
    const p = this.s.player;
    if (b.buff) {
      t.buff = b.buff;
      this.c.buffs = this.c.buffs.filter((x) => x.id !== b.buff);
      this.c.buffs.push({ id: b.buff, remaining: 900 });
    }
    if (b.heal) {
      p.hp = Math.min(this.maxHp(), p.hp + b.heal);
      p.stamina = this.maxSta();
    }
    if (b.lucky) this.add({ wood: 4, scrap: 4 }, true);
    this.toast("这一趟：" + b.name + "（" + b.text + "）。", "gold");
    this.emit("loot");
    return true;
  }
  chTripBoon() {
    const t = this.ch.trip;
    return t?.pick ? TRIP_BOONS.find((b) => b.id === t.pick) : null;
  }

  // ================= 顶上一条资源：数、涨跌、从哪来到哪去 =================
  chRipe(p) {
    return !!p.crop && !!CROPS[p.crop] && p.growth >= CROPS[p.crop].grow;
  }
  chMatCount() {
    return MATERIALS.reduce((n, id) => n + this.qty(id, true), 0);
  }
  chPeople() {
    const helpers = this.sc?.helpers || [],
      residents = this.c?.residents || [];
    return { n: 1 + helpers.length + residents.length, beds: 1 + this.residentsCapacity() + (this.sc?.flags?.camp ? helpers.length : 0), helpers: helpers.length, residents: residents.length };
  }
  chResources() {
    const s = this.s,
      d0 = this.ch.day0,
      food = this.foodPortions?.() ?? 0,
      need = this.foodNeed?.() ?? 1,
      days = this.foodDays?.() ?? 0,
      mat = this.chMatCount(),
      people = this.chPeople(),
      eaters = this.eaters?.() || [];
    const ripe = s.plots.filter((p) => p.crop && this.chRipe(p)).length,
      growing = s.plots.filter((p) => p.crop).length - ripe;
    const out = [];
    out.push({
      id: "food",
      name: "粮",
      value: food,
      text: String(food),
      delta: "够 " + days + " 天",
      tone: days < 1 ? "bad" : days < 2 ? "warn" : "good",
      rows: [
        ...MEAL_ITEMS.filter((id) => this.qty(id, true) > 0).map((id) => ({ k: ITEMS[id]?.name || id, v: "身上 " + this.qty(id) + " · 仓库 " + (s.storage[id] || 0) })),
        { k: "每天吃掉", v: need + " 份（你 " + (need - eaters.reduce((a, x) => a + x.meals, 0)) + (eaters.length ? "，" + eaters.map((x) => x.name + " " + x.meals).join("，") : "") + "）" },
        { k: "田里", v: ripe + " 块熟了，" + growing + " 块在长" },
        { k: "怎么来", v: "萝卜、土豆在灶上做成干粮和炖汤才算口粮" },
      ],
    });
    out.push({
      id: "mat",
      name: "材料",
      value: mat,
      text: String(mat),
      delta: (mat - d0.mat >= 0 ? "+" : "−") + Math.abs(mat - d0.mat) + " 今天",
      tone: mat - d0.mat < 0 ? "warn" : "good",
      rows: [...MATERIALS.map((id) => ({ k: ITEMS[id]?.name || id, v: "身上 " + this.qty(id) + " · 仓库 " + (s.storage[id] || 0) })), { k: "怎么来", v: "清田里的杂物、出门翻柜子、拆掉不用的设施" }],
    });
    if (this.chOpen("power")) out.push({ id: "power", name: "电", value: 0, text: "0", delta: "", tone: "good", rows: [] });
    out.push({
      id: "gold",
      name: "金",
      value: s.money,
      text: Math.floor(s.money).toLocaleString("zh-CN"),
      delta: (s.money - d0.money >= 0 ? "+" : "−") + Math.abs(Math.round(s.money - d0.money)) + " 今天",
      tone: s.money - d0.money < 0 ? "warn" : "good",
      rows: [
        { k: "今天早上", v: Math.floor(d0.money) + " 金" },
        { k: "怎么来", v: "集市上卖菜和做好的东西；做成主线的事有赏" },
        { k: "花在哪", v: "集市上买种子、工具和子弹" },
      ],
    });
    out.push({
      id: "people",
      name: "人",
      value: people.n,
      text: people.n + "/" + people.beds,
      delta: people.n > people.beds ? "床不够" : people.n === 1 ? "只有你" : "都有床",
      tone: people.n > people.beds ? "bad" : "good",
      rows: [
        { k: "你", v: "农舍" },
        ...(this.sc?.helpers || []).map((h) => ({ k: this.helperName?.(h.id) || h.id, v: "援建队 · " + (h.status || "") })),
        ...(this.c?.residents || []).map((r) => ({ k: this.residentName?.(r.id) || r.id, v: "居民 · " + (r.fed ? "吃过了" : "还没吃上") })),
        { k: "床", v: "农舍 1 张，居民床位 " + (this.residentsCapacity() - 1) + " 张" + (this.sc?.flags?.camp ? "，援建营地住援建队" : "") },
        { k: "怎么来", v: "回了信，联盟会派人；出门时救下的人会住进来" },
      ],
    });
    if (people.n > 1) {
      const m = Math.round(this.trMorale?.() ?? 50),
        target = this.moodTarget?.() ?? m,
        factors = this.moodFactors?.() || [];
      out.push({
        id: "morale",
        name: "士气",
        value: m,
        text: String(m),
        delta: target > m + 1 ? "在涨" : target < m - 1 ? "在跌" : "稳着",
        tone: m < 35 ? "bad" : target < m - 1 ? "warn" : "good",
        rows: [...factors.map((f) => ({ k: f.text, v: (f.v > 0 ? "+" : "") + f.v })), { k: "往哪走", v: "每天半夜往 " + Math.round(target) + " 靠四成" }, { k: "有什么用", v: "低了干活慢，高了干活快" }],
      });
    }
    return out;
  }

  // ================= 右边的警报：最多三条，点了带你过去 =================
  chAlerts() {
    const out = [],
      s = this.s,
      g = this.ch.gate,
      h = s.horde;
    const add = (pri, tone, title, sub, go) => out.push({ pri, tone, title, sub, go });
    if (h.phase === "active") add(0, "bad", "尸潮在进攻", "还剩 " + (h.remaining + this.enemies.filter((z) => z.horde && !z.dead).length) + " 只 · 守住东边路口", { kind: "point", region: "farm", x: 1330, y: 400 });
    else if (h.phase === "warning") add(0, "bad", "尸潮 " + Math.ceil(h.timer) + " 秒后到", "从东边的路口来 · 去路口", { kind: "point", region: "farm", x: 1330, y: 400 });
    else if (this.ch.n === 1 && !this.chDone(1) && ["omen", "tonight"].includes(g.state)) add(1, "bad", (s.day >= g.day ? "今晚 " : "明晚 ") + GATE1.hour + ":00 尸潮", "来 " + this.chGateCount() + " 只上下 · 看看备得怎么样", { kind: "page", page: "journal" });
    for (const t of this.todayItems?.() || []) {
      if (/今日抉择/.test(t.text)) add(2, "warn", "今天的事还没选", "中午以前选一项", { kind: "page", page: "event" });
      else if (/围栏/.test(t.text)) add(1, "warn", "东边路口没东西挡着", "建一段围栏堵上", { kind: "page", page: "build" });
      else if (/感染者还没打退/.test(t.text)) add(0, "bad", "感染者进了东边的路口", "把它们打退", { kind: "point", region: "farm", x: 1330, y: 400 });
      else if (/口粮只够/.test(t.text)) add(2, "warn", t.text, "做干粮，或者去集市换", { kind: "res", id: "food" });
      else if (/发烧/.test(t.text)) add(2, "warn", t.text, "", { kind: "page", page: "store" });
      else if (/坏了/.test(t.text)) {
        // 用坏了的武器、防具：有武器工作台就去那一页修，没有就先去建一座
        const bench = s.buildings.some((b) => b.type === "weaponbench" && b.hp > 0);
        add(3, "warn", t.text.replace(/，回武器台修$/, ""), bench ? "回农场，在武器工作台修" : "先建一座武器工作台（建造 · 吃住）", bench ? { kind: "page", page: "store", ui: { tab: "make", station: "weaponbench" } } : { kind: "page", page: "build", ui: { tab: "live", sel: "weaponbench" } });
      }
    }
    if (s.region === "farm") {
      const ripe = s.plots.filter((p) => p.crop && this.chRipe(p)),
        dry = s.plots.filter((p) => p.crop && !this.chRipe(p) && !this.plotWatered?.(p));
      if (ripe.length) add(4, "info", "菜熟了 " + ripe.length + " 块", "去田里收", { kind: "point", region: "farm", x: ripe[0].x, y: ripe[0].y });
      else if (dry.length && s.minute < 17 * 60) add(5, "info", dry.length + " 块田还没浇水", "浇一次管到明早", { kind: "point", region: "farm", x: dry[0].x, y: dry[0].y });
      const broken = s.buildings.filter((b) => BUILDINGS[b.type] && b.hp <= 0 && !["fence", "gate", "trap"].includes(b.type));
      if (broken.length) add(2, "warn", BUILDINGS[broken[0].type].name + "坏了", "走过去按 E 修好", { kind: "point", region: "farm", x: broken[0].x, y: broken[0].y });
      const ready = (this.c?.production || []).filter((j) => j.ready).length;
      if (ready) add(4, "info", ready + " 份东西做好了", "到设施跟前收起来", { kind: "page", page: "store" });
    }
    return out.sort((a, b) => a.pri - b.pri).slice(0, 3);
  }

  // ================= 队友名册 =================
  chTeam() {
    const out = [];
    for (const h of this.sc?.helpers || [])
      out.push({ key: "h:" + h.id, id: h.id, kind: "helper", name: this.helperName?.(h.id) || h.id, from: "联盟援建队", job: "搬运", does: "把做好的东西、散落的物资、田里的杂物搬进仓库", temper: "话多", status: h.status || "", fed: h.fedDay === this.s.day, lookKey: h.id, lookRole: "helper" });
    for (const r of this.c?.residents || []) {
      const info = { farmer: { from: "废弃居民区救回来的农艺员", job: "种植", does: "替你浇水，把熟了的菜收进仓库", temper: "细心" }, medic: { from: "旧医院救回来的医生", job: "医务", does: "照看受伤的人", temper: "沉得住气" }, mechanic: { from: "工业仓库救回来的维修员", job: "维修", does: "修坏了的设施", temper: "认死理" } }[r.id] || { from: "", job: "", does: "", temper: "" };
      out.push({ key: "r:" + r.id, id: r.id, kind: "resident", name: this.residentName?.(r.id) || r.id, ...info, status: r.fed ? "吃过了，在干活" : "还没吃上工作餐", fed: !!r.fed, lookKey: r.id, lookRole: r.workRole || r.role || "" });
    }
    return out;
  }

  // ================= 第一章里先不说的话、先不开的页面 =================
  chSay(text) {
    if (typeof text !== "string" || this.ch.n !== 1) return text;
    if (CH1_QUIET.some((re) => re.test(text))) return null;
    let out = text;
    for (const [re, to] of CH1_REWORD) out = out.replace(re, to);
    return out;
  }
  toast(text, tone = "normal") {
    const t = this.chSay(text);
    if (t === null) return;
    return super.toast(t, tone);
  }
  chMenuOk(data) {
    if (this.ch.n !== 1) return true;
    if (data.menu === "outpost") return CH1_VIEWS.has(data.view);
    if (data.menu === "camp") return data.tab === "residents";
    return CH1_MENUS.has(data.menu);
  }
  emit(type, data = {}) {
    if (type === "menu" && this.ch && !this.chMenuOk(data)) {
      this._chBlocked = data;
      super.toast("这里第二章再用。", "warn");
      return;
    }
    return super.emit(type, data);
  }
  // 天赋第二章起自己加，第一章不自动学
  trLearn(force = false, quiet = false) {
    if (this.ch && this.ch.n === 1) return [];
    return super.trLearn(force, quiet);
  }

  // ================= 每天、每帧 =================
  onNewDay() {
    super.onNewDay();
    const d = this.ch.day0;
    d.day = this.s.day;
    d.money = this.s.money;
    d.food = this.foodPortions?.() ?? 0;
    d.mat = this.chMatCount();
  }
  update(dt, input = {}) {
    super.update(dt, input);
    if (this.paused || !this.ch) return;
    this._chClock += dt;
    if (this._chClock < 0.5) return;
    this._chClock = 0;
    this.chGateTick();
    this.chScoutTick();
    this.chTripTick();
    this.chBarkTick();
    this.chCheckDone();
  }

  // ================= 存档 =================
  // 存出来的就是读进来以后的样子：跑掉的感染者这类读档时会清掉的东西，存的时候就不带了，
  // 这样存出来再读回去一字不差。
  serialize() {
    const text = super.serialize();
    try {
      return JSON.stringify(Engine.parse(text));
    } catch {
      return text;
    }
  }
  static parse(text) {
    const raw = JSON.parse(text);
    if (!raw || typeof raw !== "object" || raw.format !== SAVE_FORMAT || !raw.ch) throw Error("这份存档是旧版的，新版读不了。");
    const s = Base.parse(text);
    s.format = SAVE_FORMAT;
    s.ch = normalize(raw.ch);
    return s;
  }
}
