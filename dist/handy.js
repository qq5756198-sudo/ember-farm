// v0.45.0「顺手」：引擎最上面一层（盖在 v0.43 上手那一层上面）。新开局的第一个小时：
// 1. 开局先教打架再派出门：第一段回信以后过 20 游戏分钟开局那一拨就来（13:00 照旧，哪个先到算哪个）；那一拨没打完、路口没堵上以前，
//    任务手记第二段多一步“守住东边路口”，金色路标标在东边路口，不说“求援信号已标在地图上”；路口堵上了才标废弃居民区。
// 2. 角上的小卡排着队轮到它时，过时了的不弹：换了地方、过了一夜、等太久、人走远了、它说的那样东西已经不在了或者已经建了。
// 3. 一样东西一个叫法（废弃居民区、全营士气）；去掉了的东西不再露字（走近田时的肥力、老档那一句里的版本名字）。
// 4. 早上一页：睡醒以后昨天的总结并进今日抉择那一页（页面写在 handy-ui.js），前三天“今天先做”也写在这一页里，角上那张早上的小卡不再单弹。
// 5. 废墟里的出口：按了打开地图时余烬农场已经选好。
// 这一层不改别的玩法的数，存档不加东西（回信是哪一刻只记在内存里；读档回来从读档那一刻算）。
import { Engine as EaseEngine, freshState } from "./ease.js";
import { OPENING } from "./feel-data.js";
import { ORIGINS } from "./longnight-data.js";
import { MENUS, BCARD } from "./simple-data.js";
import { MENU_FRESH } from "./ease-data.js";
import { BUILDINGS } from "./data.js";
import { EARLY_WAVE_MIN, ROAD, OPEN_STEP, SAY_WAVE, SAY_GO, SAY_DROP, HANDY_SAY, CONTEXT_GONE, MENU_MSG, FARMER_ORIGIN, FENCE_CARD, EXIT_LABEL, CARD_STALE, FIRST_DAYS, PURPOSE_EARLY, LESSON_GONE } from "./handy-data.js";
import { LESSONS } from "./guidance-data.js";

export { freshState, newGameState, newGamePlusState, needsUpgrade, migrateState, legacyGear } from "./ease.js";

// 说的话过一遍：一样东西一个叫法，去掉了的东西不再露字
export function handySay(text) {
  if (typeof text !== "string" || !text) return text;
  for (const [re, to] of HANDY_SAY) text = text.replace(re, to);
  return text;
}
// 几样表里的字照现在的说（所有的档；只改字）：第一次有这一层的引擎时改
let textsDone = false;
function handyTexts() {
  if (textsDone) return;
  textsDone = true;
  if (ORIGINS.farmer) Object.assign(ORIGINS.farmer, FARMER_ORIGIN);
  for (const m of MENUS) if (m[0] === "消息") m[1] = MENU_MSG[0];
  if (Array.isArray(MENU_FRESH.messages)) MENU_FRESH.messages.splice(0, 2, MENU_MSG[0], MENU_MSG[1]);
  if (Array.isArray(BCARD.fence)) BCARD.fence.splice(0, 2, ...FENCE_CARD);
  // 委托列表：做不成了的那几件不再列出来
  for (const l of LESSONS) if (LESSON_GONE.includes(l.id)) l.unlock = () => false;
}
const clock = () => globalThis.performance?.now?.() ?? Date.now();
// 那样东西已经用不着了（营地空地上已经搭起了营地）：小卡不弹
const CARD_GONE = { allianceSite: (e) => !!e.sc?.flags?.camp };

export class Engine extends EaseEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(s, notify);
    handyTexts();
    // 第一段回信的那一刻（游戏分钟，不进存档）、回信时先不说的那一句
    this._hyReplyAt = null;
    this._hyDrop = false;
    // 早上一页：哪一天、昨天的总结并进来了没有
    this._hyMorning = null;
    // 接着做的委托是做不成了的那一件：放下（回到跟着主线）
    if (this.guidance && LESSON_GONE.includes(this.guidance.focus)) this.guidance.focus = null;
  }

  // ================= 说的话 =================
  toast(text, tone) {
    if (this._hyDrop && typeof text === "string" && SAY_DROP.test(text)) return;
    return super.toast(handySay(text), tone);
  }
  olog(text, tone) {
    return super.olog(handySay(text), tone);
  }
  // 走近一样东西时最下面那一行：田的肥力、邻接不再写
  context(o) {
    const t = super.context(o);
    if (typeof t !== "string") return t;
    let out = t;
    for (const re of CONTEXT_GONE) out = out.replace(re, "");
    return handySay(out);
  }
  // 东西的用处：新开的档前几天只说眼下的（以后才有的先不提）
  itemPurpose(id) {
    const base = String(id || "").replace(/^(fine_|hardy_)/, "");
    if (this.easeFresh?.() && this.s.day <= FIRST_DAYS && PURPOSE_EARLY[base]) return PURPOSE_EARLY[base];
    return handySay(super.itemPurpose(id));
  }
  simpleLabel(o) {
    // 废墟里的出口：按了打开地图（余烬农场已经选好）
    if (o?.type === "exit" && this.s.region !== "farm") return EXIT_LABEL;
    return handySay(super.simpleLabel(o));
  }
  emit(type, data = {}) {
    if (type === "menu" && data?.menu === "map" && !data.selected && this.s.region !== "farm" && this.nearestObject?.()?.type === "exit") data = { ...data, selected: "farm" };
    return super.emit(type, data);
  }

  // ================= 开局先教打架再派出门 =================
  hyNow() {
    return (this.s.day - 1) * 1440 + this.s.minute;
  }
  // 开局那一拨还没打完（没来、在打、路口还没堵）
  hyHolding() {
    const o = this.feel?.open;
    return !!o && o.phase !== "done";
  }
  replyAlliance() {
    const before = !!this.sc?.claimed?.includes("act1"),
      holding = this.hyHolding();
    this._hyDrop = holding;
    let ok = false;
    try {
      ok = super.replyAlliance();
    } finally {
      this._hyDrop = false;
    }
    if (ok && !before) {
      this._hyReplyAt = this.hyNow();
      if (holding) {
        this.guidance.focus = null;
        this.guidance.target = { ...ROAD };
        this.toast(SAY_WAVE, "warn");
      }
    }
    return ok;
  }
  // 回信过了 20 游戏分钟：开局那一拨不等 13:00
  hyEarlyWave() {
    if (!this.sc?.claimed?.includes("act1")) return false;
    if (this._hyReplyAt == null) this._hyReplyAt = this.hyNow();
    return this.hyNow() - this._hyReplyAt >= EARLY_WAVE_MIN;
  }
  openingTick() {
    const o = this.feel?.open;
    if (o?.phase === "wait" && this.s.region === "farm" && this.s.day === 1 && this.s.minute < OPENING.at && this.hyEarlyWave()) {
      const raid = this.raidState?.()?.phase;
      if (!["warning", "active"].includes(this.s.horde?.phase) && !["warning", "active"].includes(raid)) {
        this.startOpening();
        return;
      }
    }
    return super.openingTick();
  }
  // 路口堵上了：这时候才把废弃居民区标上
  finishOpening() {
    const was = this.feel?.open?.phase;
    const out = super.finishOpening();
    if (was && was !== "done" && this.sc?.claimed?.includes("act1") && !this.r?.claimed?.includes("farmer")) {
      const t = this.taskDestination?.("farmer");
      if (t) {
        this.guidance.focus = null;
        this.guidance.target = { region: t.region, x: t.x, y: t.y, label: handySay(t.label || "废弃居民区求援") };
        if (this.d) this.d.track = null;
        if (this.b) this.b.track = null;
      }
      this.toast(SAY_GO, "gold");
    }
    return out;
  }
  // 任务手记：第二段“接回阿禾”前面多一步“守住东边路口”（开局那一拨没打完时）
  storyGoal() {
    const g = super.storyGoal();
    if (!g?.step) return g;
    const step = { ...g.step, title: handySay(g.step.title), text: handySay(g.step.text), gain: handySay(g.step.gain) };
    if (step.target) step.target = { ...step.target, label: handySay(step.target.label) };
    return this.hyOpeningGoal({ ...g, step, happened: handySay(g.happened) });
  }
  hyOpeningGoal(g) {
    const o = this.feel?.open;
    if (g.act !== 2 || !o || !g.steps.some((s) => s.id === "farmer")) return g;
    const done = o.phase === "done";
    // 旧档：开局那一拨早就打完了，这一段照原来的四步；新开的档一直列着这一步（打完了打勾），前后几步数不变
    if (done && !this.easeFresh?.()) return g;
    const ph = OPEN_STEP[o.phase] ? o.phase : "wait";
    const key = (a, f) => String(this.keyName?.(a, f) || f).toUpperCase();
    const fill = (t) => t.replace("{shove}", key("shove", "X")).replace("{build}", key("build", "B"));
    // 这一段的几步里先列上“守住路口”（还在挑援建物资时也列着）；轮到“接回阿禾”时换成这一步
    const steps = [...g.steps],
      at = steps.findIndex((s) => s.id === "farmer");
    steps.splice(at, 0, { id: OPEN_STEP.id, label: OPEN_STEP.label, done });
    const index = Math.min(steps.length, steps.filter((s) => s.done).length + 1);
    if (done || g.step.id !== "farmer") return { ...g, steps, index, total: steps.length };
    const step = { id: OPEN_STEP.id, label: OPEN_STEP.label, done: false, title: OPEN_STEP[ph].title, text: fill(OPEN_STEP[ph].text), gain: OPEN_STEP.gain, target: { ...ROAD }, kind: "mark", phase: ph };
    return { ...g, steps, step, index, total: steps.length };
  }
  // 手记要你建的、做的（建造页、设施页把它排第一）
  hyWant() {
    const out = { build: null, recipe: null };
    if (!this.s) return out;
    if (this.feel?.open?.phase === "fence") out.build = "fence";
    let g = null;
    try {
      g = this.storyGoal?.();
    } catch {
      g = null;
    }
    const id = g?.step?.id;
    if (id === "meal" || id === "farmerMeal") out.recipe = "trailBread";
    if (!out.build && id === "table") {
      if (!this.hasBuilding?.("workbench")) out.build = "workbench";
      else if ((this.residentsCapacity?.() ?? 9) < 2) out.build = "bed";
    }
    if (!out.build || !out.recipe) {
      let k = "";
      try {
        k = this.mainGoalKey?.() || "";
      } catch {
        k = "";
      }
      const [type, what] = String(k).split(":");
      if (!out.build && type === "building" && BUILDINGS[what] && !BUILDINGS[what].retired) out.build = what;
      if (!out.recipe && type === "recipe") out.recipe = what;
    }
    return out;
  }

  // ================= 建造：放下一样就退出（按住 Shift 连着放） =================
  placeBuilding(x, y, ...rest) {
    const ok = super.placeBuilding(x, y, ...rest);
    if (ok && this.buildMode && !this.hyKeepBuild) this.buildMode = null;
    return ok;
  }

  // ================= 角上的小卡：过时的不弹 =================
  easeCardFor(o, key) {
    const c = super.easeCardFor(o, key);
    if (c && o) c._hy = { type: o.type };
    return c;
  }
  easePush(card) {
    const ok = super.easePush(card);
    if (ok && card) card._hy = { ...(card._hy || {}), t: clock(), day: this.s.day, minute: this.s.minute, region: this.s.region, px: this.s.player.x, py: this.s.player.y };
    return ok;
  }
  // 正在打（开局那一拨、尸潮、身边有感染者）：角上的小卡先等着，打完再弹
  hyBusy() {
    if (this.feel?.open?.phase === "fight") return true;
    if (["warning", "active"].includes(this.s.horde?.phase)) return true;
    const p = this.s.player;
    return (this.enemies || []).some((z) => !z.dead && !z.flee && Math.hypot(z.x - p.x, z.y - p.y) < CARD_STALE.foe);
  }
  easeNextCard() {
    if (this.hyBusy()) return null;
    for (let i = 0; i < 12; i++) {
      const c = super.easeNextCard();
      if (!c) return null;
      if (!this.hyStale(c)) return c;
    }
    return null;
  }
  // 这一张还说得着吗：说不着了的不弹；只是人走开了、等太久了的，记成没见过（下回走近再说）
  hyStale(c) {
    const m = c?._hy;
    if (!m) return false;
    let stale = false,
      again = false;
    // 过了一夜：昨天的事不说了
    if (m.day !== this.s.day) stale = true;
    // 能建了的那一样已经建了；营地空地上已经搭起了营地
    if (c.key?.startsWith("build:") && this.s.buildings.some((b) => b.type === c.key.slice(6) && b.hp > 0)) stale = true;
    if (m.type && CARD_GONE[m.type]?.(this)) stale = true;
    // 走近一样东西时排的：人走远了、换了地方、等太久了
    if (!stale && m.type && (m.region !== this.s.region || clock() - m.t > CARD_STALE.ms || this.s.minute - m.minute > CARD_STALE.minutes || Math.hypot(this.s.player.x - m.px, this.s.player.y - m.py) > CARD_STALE.far)) {
      stale = true;
      again = true;
    }
    if (stale && again && this.ez?.seen) {
      const i = this.ez.seen.indexOf(c.key);
      if (i >= 0) this.ez.seen.splice(i, 1);
    }
    return stale;
  }

  // ================= 早上一页 =================
  sleep() {
    const n0 = this.events.length;
    const ok = super.sleep();
    if (ok) {
      const k = this.events.findIndex((ev, i) => i >= n0 && ev.type === "menu" && ev.view === "summary");
      // 今日抉择这就会弹（有卡、过了 6 点、眼前没危险）
      const card = !!this.dailyShouldShow?.();
      this._hyMorning = { day: this.s.day, report: false };
      // 有今日抉择的早上：昨天的总结并进抉择那一页（不再先弹一页总结）
      if (k >= 0 && card) {
        this.events.splice(k, 1);
        this._hyMorning.report = true;
      }
    }
    return ok;
  }
  // 早上那一页要不要写昨天的总结
  hyMorningReport() {
    const m = this._hyMorning;
    return !!m && m.report && m.day === this.s.day && !!this.o?.report;
  }
  // 前三天：早上那一页写“今天先做”，角上那张早上的小卡就不再弹
  hyMorningPlan() {
    let g = null;
    try {
      g = this.easeGuide?.();
    } catch {
      g = null;
    }
    if (!g) return null;
    const z = this.ez,
      d = this.s.day;
    if (z && d >= 2 && !z.mornings.includes(d) && z.mornings.length < 10) z.mornings.push(d);
    return { ...g, title: handySay(g.title), text: handySay(g.text) };
  }
}
