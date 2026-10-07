// v0.17.0「远方来客」：夜里的抉择、今日险地、麦穗的本事、彭姐（邻营同盟）、贺满仓（建设垫付），
// 灰隼团会打居民与围栏、出货行情每天浮动、减少震屏。只新增 far 字段。
import { Engine as SeasonsEngine, freshState as seasonsFresh, migrateState as seasonsMigrate } from "./seasons.js";
import { ITEMS, BUILDINGS, ZOMBIES } from "./data.js";
import { missingCost, bundleText } from "./alliance-data.js";
import { regionOpen } from "./wayfinding.js";
import {
  FAR_SCHEMA,
  RUINS,
  NIGHT_SPOTS,
  HAZARD_SPOTS,
  FSPOTS,
  NIGHT_KINDS,
  NIGHT,
  HAZARDS,
  HAZARD_KINDS,
  DOG_MAX,
  DOG_SKILLS,
  PENG_LEND,
  PENG_BARGAIN,
  PENG_AID,
  PENG_SUPPLY,
  PENG_TRADES,
  FNPCS,
} from "./farlands-data.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const inRect = (x, y, r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
export const FAR_OBJECTS = ["farNight", "farHazard", "farPeng", "farPengCamp", "farHemc"];
const PENG_PHASES = ["none", "asking", "waiting", "attacked", "offer", "allied", "fallen", "trader"];
const HEMC_PHASES = ["none", "met", "open"];
const SEEDS = ["seedRadish", "seedPotato", "seedTomato", "seedBean", "seedCorn", "seedPumpkin", "seedHerb", "seedCotton"].filter((id) => ITEMS[id]);
const RAID_BUILDINGS = ["fence", "gate", "tower"];
// 稳定的整数散列：同一天总是同一个结果，但地点和种类互不牵连。
const mix = (n, salt) => {
  let h = (Math.imul(n | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};

const defaults = () => ({
  schema: FAR_SCHEMA,
  night: null,
  nightLog: [],
  later: [],
  amends: [],
  hazard: null,
  nextHazard: null,
  dog: { bond: 0, fedDay: 0, petDay: 0, outDay: 0, digDay: 0, barkKey: 0 },
  peng: { phase: "none", relation: 0, day: 0, week: 0, misses: 0, turn: 0, tradeDay: 0, bought: [], hordeKey: 0 },
  hemc: { phase: "none", debt: null, advances: 0 },
  wounded: 0,
  claimed: [],
});

// 设置里的无障碍与键位：只留认得的字段。
function cleanSettings(st) {
  if (!st || typeof st !== "object") return;
  if (st.access !== undefined) {
    const a = st.access && typeof st.access === "object" ? st.access : {};
    st.access = { text: a.text === true, color: a.color === true, calm: a.calm === true };
  }
  if (st.keymap !== undefined) {
    const k = st.keymap;
    const ok = k && typeof k === "object" && !Array.isArray(k) && Object.keys(k).length <= 30 && Object.entries(k).every(([id, v]) => /^[a-z]{1,12}$/.test(id) && typeof v === "string" && v.length === 1);
    if (!ok) st.keymap = {};
  }
}
export function migrateState(s) {
  seasonsMigrate(s);
  cleanSettings(s.settings);
  const d = defaults();
  if (!s.far) s.far = d;
  else {
    const x = s.far;
    s.far = { ...d, ...x, dog: { ...d.dog, ...x.dog }, peng: { ...d.peng, ...x.peng }, hemc: { ...d.hemc, ...x.hemc } };
  }
  return s;
}
export const freshState = () => migrateState(seasonsFresh());

export class Engine extends SeasonsEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this.assignRegion();
  }
  get fr() {
    return this.s.far;
  }
  // 设置里打开“减少闪烁与震屏”后，开枪和受击都不再晃镜头。
  get shake() {
    return this._shake || 0;
  }
  set shake(v) {
    this._shake = this.s?.settings?.access?.calm ? 0 : v;
  }
  featureAvailable(key) {
    if (key === "night") return this.farOpen() && this.openRuins().length > 0;
    if (key === "dog") return this.dogReady();
    return super.featureAvailable(key);
  }
  fonce(id) {
    if (this.fr.claimed.includes(id)) return false;
    this.fr.claimed.push(id);
    if (this.fr.claimed.length > 300) this.fr.claimed = this.fr.claimed.slice(-300);
    return true;
  }
  farOpen() {
    return (this.sc?.act || 1) >= 3;
  }
  openRuins() {
    return RUINS.filter((id) => {
      try {
        return regionOpen(this, id);
      } catch {
        return false;
      }
    });
  }
  // 声望可以掉，但存档要求不小于 0。
  addReputation(n) {
    if (!(n < 0)) return super.addReputation(n);
    this.c.reputation = Math.max(0, this.c.reputation + n);
  }
  // 拿到的东西：背包放得下就进背包，否则进仓库。
  receive(items) {
    if (this.canAdd(items)) this.add(items, true);
    else this.putStorage(items);
  }

  // ---------- 夜里的抉择 ----------
  nightWindow(n = this.fr.night) {
    if (!n) return false;
    return (this.s.day === n.day && this.s.minute >= 19 * 60) || (this.s.day === n.day + 1 && this.s.minute < 5 * 60);
  }
  planNight() {
    const f = this.fr;
    if (!this.farOpen() || (f.night && f.night.day === this.s.day)) return;
    const open = this.openRuins();
    if (!open.length) return;
    const revisit = f.amends.find((a) => a.revisit && open.includes(a.region));
    let region, kind;
    if (revisit) {
      region = revisit.region;
      kind = "stranger";
      f.amends = f.amends.filter((a) => a !== revisit);
    } else ({ region, kind } = this.nightFor(this.s.day));
    f.night = { day: this.s.day, region, kind, done: false, choice: null, revisit: !!revisit };
    if (RUINS.includes(this.s.region)) this.assignRegion();
  }
  nightFor(day) {
    const open = this.openRuins();
    if (!open.length) return null;
    return { region: open[mix(day, 11) % open.length], kind: NIGHT_KINDS[mix(day, 23) % NIGHT_KINDS.length] };
  }
  // 受伤的猎户只会来一次；营门已经有人在等借宿名额时也先不来。
  strangerCanJoin() {
    return !this.fr.claimed.includes("guest:achuan") && !this.ss?.pendingGuest;
  }
  nightHere() {
    const n = this.fr.night;
    return !!n && !n.done && this.nightWindow(n) && this.s.region === n.region;
  }
  nightReason(choice) {
    const n = this.fr.night;
    if (!n || n.done || !this.nightWindow(n)) return "今晚没有这样的事";
    if (this.s.region !== n.region || dist(this.s.player, NIGHT_SPOTS[n.region]) > 130) return "走到那里再决定";
    const c = NIGHT[n.kind].choices[choice];
    if (!c) return "没有这个选项";
    if (c.pay) {
      const lack = missingCost(this, c.pay);
      if (lack.length) return "还缺：" + lack.join("、");
    }
    return "";
  }
  chooseNight(choice) {
    const reason = this.nightReason(choice);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const f = this.fr,
      n = f.night,
      def = NIGHT[n.kind],
      c = def.choices[choice];
    if (c.pay && !this.takeFarm(c.pay)) return false;
    if (c.items) this.receive(c.items);
    if (c.rep) this.addReputation(c.rep);
    if (c.mood) this.residentsMood(c.mood);
    if (c.peng) this.fr.peng.relation = clamp(this.fr.peng.relation + c.peng, -10, 10);
    if (c.later) f.later = [...f.later, { id: "later:" + n.day + ":" + n.kind, day: this.s.day + c.later.days, items: c.later.items, text: c.later.text }].slice(-10);
    if (c.guest) {
      if (this.strangerCanJoin()) {
        this.fonce("guest:achuan");
        this.ss.pendingGuest = "腿伤的猎户阿川";
        this.o.visitors.next = this.s.day + (this.s.minute >= 19 * 60 ? 1 : 0);
      } else f.later = [...f.later, { id: "later:" + n.day + ":thanks", day: this.s.day + 1, items: { herb: 2 }, text: "那个受伤的人托人送来两把药草，说腿好多了。" }].slice(-10);
    }
    // 补救路线
    const amend = (kind, data, extra = {}) =>
      (f.amends = [...f.amends.filter((a) => a.id !== kind + ":" + n.day), { id: kind + ":" + n.day, kind, text: data.text, cost: data.cost, rep: data.rep || 0, mood: data.mood || 0, peng: data.peng || 0, revisit: !!data.revisit, region: n.region, ...extra }].slice(-10));
    if (n.kind === "ruin" && choice === "take") amend("ruin", def.amends);
    if (n.kind === "stranger" && choice === "leave" && !n.revisit) amend("stranger", def.amends);
    if (n.kind === "stash" && choice === "takeAll") amend("stash", def.amends);
    if (n.kind === "stash" && choice === "takeHalf") amend("iou", def.iou);
    n.done = true;
    n.choice = choice;
    f.nightLog = [{ day: n.day, kind: n.kind, choice }, ...f.nightLog].slice(0, 12);
    this.clearMark(NIGHT_SPOTS[n.region]);
    const text = def.name + "：" + c.name + "。" + (c.items ? "得到" + bundleText(c.items) + "。" : "") + c.effect + "。";
    this.toast(text, c.rep < 0 ? "warn" : "gold");
    this.olog(text, c.rep < 0 ? "warn" : "normal");
    this.assignRegion();
    return true;
  }
  amendsReason(id) {
    const a = this.fr.amends.find((x) => x.id === id);
    if (!a) return "没有这件事";
    if (a.revisit) return "明晚回到原地才能找他";
    const lack = missingCost(this, a.cost);
    if (lack.length) return "还缺：" + lack.join("、");
    return "";
  }
  makeAmends(id) {
    const reason = this.amendsReason(id),
      a = this.fr.amends.find((x) => x.id === id);
    if (reason || !this.takeFarm(a.cost)) {
      this.toast((reason || "东西不够") + "。", "warn");
      return false;
    }
    this.fr.amends = this.fr.amends.filter((x) => x !== a);
    if (a.rep) this.addReputation(a.rep);
    if (a.mood) this.residentsMood(a.mood);
    if (a.peng) this.fr.peng.relation = clamp(this.fr.peng.relation + a.peng, -10, 10);
    const text = "补救：" + a.text + "（" + bundleText(a.cost) + "）。营地声望 +" + a.rep + "。";
    this.toast(text, "gold");
    this.olog(text, "gold");
    return true;
  }
  deliverLater() {
    const f = this.fr,
      due = f.later.filter((x) => x.day <= this.s.day);
    if (!due.length) return;
    f.later = f.later.filter((x) => x.day > this.s.day);
    for (const x of due)
      if (this.fonce(x.id)) {
        this.putStorage(x.items);
        this.toast(x.text + "（" + bundleText(x.items) + " 已入仓）", "gold");
        this.olog(x.text);
      }
  }

  // ---------- 今日险地 ----------
  hazardFor(day) {
    const open = this.openRuins();
    if (!open.length) return null;
    return { day, region: open[mix(day, 37) % open.length], kind: HAZARD_KINDS[mix(day, 53) % HAZARD_KINDS.length] };
  }
  hazardMorning() {
    const f = this.fr;
    if (!this.farOpen()) return;
    const h = f.nextHazard?.day === this.s.day ? f.nextHazard : this.hazardFor(this.s.day);
    f.nextHazard = null;
    f.hazard = h ? { ...h, spawned: false, opened: false } : null;
    if (h && RUINS.includes(this.s.region)) {
      this.assignRegion();
      this.hazardEnter();
    }
  }
  hazardForecast() {
    if (!this.farOpen()) return;
    const h = this.hazardFor(this.s.day + 1);
    this.fr.nextHazard = h;
    if (h) {
      const z = HAZARDS[h.kind];
      this.toast("明天的险地：" + this.regionName(h.region) + " · " + z.name + "。风险：" + z.risk + "；能拿到：" + z.drop + "。", "normal");
    }
  }
  regionName(id) {
    return { residential: "废弃居民区", hospital: "旧医院", warehouse: "工业仓库" }[id] || id;
  }
  hazardToday() {
    const h = this.fr.hazard;
    return h && h.day === this.s.day ? h : null;
  }
  // 找一个感染者站得住、走得动的点：从给定位置向外绕圈找。
  freeSpot(x, y) {
    for (let r = 0; r <= 360; r += 24)
      for (let k = 0; k < Math.max(1, Math.round(r / 12)); k++) {
        const a = (k / Math.max(1, Math.round(r / 12))) * Math.PI * 2,
          px = clamp(Math.round(x + Math.cos(a) * r), 80, 1456),
          py = clamp(Math.round(y + Math.sin(a) * r), 90, 934);
        if (!this.blocked(px, py, true, 16)) return { x: px, y: py };
      }
    return { x: clamp(x, 80, 1456), y: clamp(y, 90, 934) };
  }
  spawnAt(type, x, y, extra = {}) {
    const p = this.freeSpot(x, y),
      z = this.enemy(type, p.x, p.y);
    Object.assign(z, extra);
    this.enemies.push(z);
    return z;
  }
  hazardEnter() {
    const h = this.hazardToday();
    if (!h || h.spawned || this.s.region !== h.region || h.kind !== "migration") return;
    h.spawned = true;
    const sp = HAZARD_SPOTS[h.region];
    for (let i = 0; i < HAZARDS.migration.extra; i++) this.spawnAt(i % 2 ? "runner" : "slow", sp.x + Math.cos(i * 1.6) * 150, sp.y + Math.sin(i * 1.6) * 110, { hazard: true });
    this.toast("尸群正从" + this.regionName(h.region) + "穿过：多了 4 只感染者。打完才能开补给。", "warn");
  }
  hazardFoes() {
    return this.enemies.filter((z) => z.hazard && !z.dead).length;
  }
  hazardReason() {
    const h = this.hazardToday();
    if (!h) return "今天这里没有险地";
    if (h.opened) return "今天的补给已经拿过了";
    if (this.s.region !== h.region || dist(this.s.player, HAZARD_SPOTS[h.region]) > 130) return "走到补给旁边";
    if (h.kind === "migration" && this.hazardFoes()) return "还有 " + this.hazardFoes() + " 只迁徙的感染者";
    if (h.kind === "ashore" && this.s.minute >= HAZARDS.ashore.until) return "漂来的东西已经被冲走了";
    return "";
  }
  openHazard() {
    const reason = this.hazardReason();
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const h = this.hazardToday(),
      z = HAZARDS[h.kind];
    h.opened = true;
    if (this.fonce("haz:" + h.day)) this.receive(z.items);
    this.clearMark(HAZARD_SPOTS[h.region]);
    if (h.kind === "fog") {
      const sp = HAZARD_SPOTS[h.region];
      for (let i = 0; i < z.ambush; i++) this.spawnAt("runner", sp.x + 120 - i * 240, sp.y + 90, { state: "chase", alert: 6 });
    }
    const text = "今日险地 · " + z.name + "：拿到" + z.drop + "。" + (h.kind === "fog" ? "雾里传来脚步声——惊动了两只感染者！" : "");
    this.toast(text, h.kind === "fog" ? "warn" : "gold");
    this.olog(text);
    this.assignRegion();
    return true;
  }

  // ---------- 麦穗 ----------
  dogReady() {
    return !!this.f?.dog?.rescued;
  }
  dogSkill(id) {
    const skill = DOG_SKILLS.find((s) => s.id === id);
    return this.dogReady() && !!skill && this.fr.dog.bond >= skill.bond;
  }
  addBond(n, why) {
    const d = this.fr.dog,
      before = d.bond;
    d.bond = clamp(d.bond + n, 0, DOG_MAX);
    const learned = DOG_SKILLS.find((s) => before < s.bond && d.bond >= s.bond);
    if (learned) {
      const text = "麦穗学会了“" + learned.name + "”：" + learned.desc + "。";
      this.toast(text, "gold");
      this.olog(text, "gold");
    } else if (why) this.toast(why + "（默契 " + d.bond + "/" + DOG_MAX + "）");
  }
  feedDog() {
    const d = this.fr.dog;
    if (!this.dogReady()) return false;
    if (d.fedDay === this.s.day) {
      this.toast("麦穗今天吃过了。");
      return false;
    }
    if (!this.takeFarm({ bread: 1 })) {
      this.toast("喂麦穗要 1 份干粮。", "warn");
      return false;
    }
    d.fedDay = this.s.day;
    this.addBond(1, "麦穗吃得尾巴直摇");
    return true;
  }
  petDog() {
    const ok = super.petDog();
    if (ok && this.fr.dog.petDay !== this.s.day) {
      this.fr.dog.petDay = this.s.day;
      this.addBond(1, "麦穗蹭了蹭你的手");
    }
    return ok;
  }
  dogNear() {
    const d = this.f?.dog;
    return this.dogReady() && this.s.region !== "market" && dist(this.s.player, d) < 160;
  }
  petReason() {
    if (!this.dogReady()) return "还没有狗";
    if (this.f.dog.petDay === this.s.day) return "今天摸过了";
    if (!this.dogNear()) return "走到麦穗身边";
    return "";
  }
  feedReason() {
    if (!this.dogReady()) return "还没有狗";
    if (this.fr.dog.fedDay === this.s.day) return "今天喂过了";
    const lack = missingCost(this, { bread: 1 });
    return lack.length ? "还缺：" + lack.join("、") : "";
  }
  dogFollowing() {
    return this.dogReady() && (!this.b?.dog || this.b.dog.mode === "follow");
  }
  travel(id) {
    const ok = super.travel(id);
    if (!ok || !this.fr) return ok;
    const d = this.fr.dog;
    if (!["farm", "market"].includes(id) && this.dogFollowing() && d.outDay !== this.s.day) {
      d.outDay = this.s.day;
      this.addBond(1, "麦穗跟你出了趟远门");
    }
    if (RUINS.includes(id)) this.hazardEnter();
    if (id === FSPOTS.pengCamp.region) this.pengCampEnter();
    return ok;
  }
  dogMorning() {
    const d = this.fr.dog;
    if (!this.dogReady()) return;
    if (this.dogSkill("dig") && this.s.day % 2 === 0 && d.digDay !== this.s.day && (!this.dogFollowing() || this.s.region === "farm")) {
      d.digDay = this.s.day;
      const seed = SEEDS[(this.s.day * 3) % SEEDS.length];
      this.putStorage({ [seed]: 2 });
      this.olog("麦穗在田边刨出 2 颗" + ITEMS[seed].name + "。");
    }
    if (this.dogSkill("fetch") && this.s.grave && this.s.grave.region !== "farm") {
      const items = this.s.grave.items || {};
      this.putStorage(items);
      this.s.grave = null;
      const text = "麦穗一早叼回了你遗落的背包：" + (Object.keys(items).length ? bundleText(items) : "里面空空的") + "，已放进仓库。";
      this.toast(text, "gold");
      this.olog(text, "gold");
    }
  }
  dogCoop() {
    if (this.dogSkill("coop") && this.s.buildings.some((b) => b.type === "coop" && b.hp > 0)) this.putStorage({ egg: 1 });
  }

  // ---------- 彭姐 ----------
  pengHere() {
    const p = this.fr.peng;
    if (this.s.region !== "farm") return false;
    if (["asking", "attacked", "offer"].includes(p.phase)) return true;
    return p.phase === "trader" && this.tradeDay() && this.s.minute >= 8 * 60 && this.s.minute < 18 * 60;
  }
  tradeDay(day = this.s.day) {
    return day % 7 === 3;
  }
  pengCheck() {
    const p = this.fr.peng;
    if (p.phase === "none" && (this.sc?.act || 1) >= 4) {
      p.phase = "asking";
      p.day = this.s.day;
      this.toast("雨巷营地的彭姐带着两个人来到前哨，想借粮。", "gold");
      if (this.s.region === "farm") this.assignRegion();
    } else if (p.phase === "waiting" && this.s.day >= p.day) {
      p.phase = "attacked";
      p.day = this.s.day;
      const text = "雨巷营地被尸群围了，彭姐派孩子来求援（第 " + (p.day + 2) + " 天 08:00 前）。";
      this.toast(text, "warn");
      this.olog(text, "warn");
      this.emit("alarm");
      if (this.s.region === "farm") this.assignRegion();
      if (this.s.region === FSPOTS.pengCamp.region) {
        this.assignRegion();
        this.pengCampEnter();
      }
    } else if (p.phase === "attacked" && this.s.day >= p.day + 2) {
      p.phase = "fallen";
      p.day = this.s.day;
      p.relation = clamp(p.relation - 2, -10, 10);
      this.toast("雨巷营地没撑住，彭姐带着人散到了别处。", "warn");
      this.olog("没赶上救雨巷营地。", "warn");
    } else if (p.phase === "fallen" && this.s.day >= p.day + 3) {
      p.phase = "trader";
      this.olog("彭姐在雨巷重新搭起了营地，每周会来前哨做一次买卖。");
    }
    if (p.phase === "allied" && this.s.day >= p.week + 7) this.pengSupply();
  }
  pengNear() {
    return this.pengHere() && dist(this.s.player, FSPOTS.peng) < 170;
  }
  pengDecide(choice) {
    const p = this.fr.peng;
    if (["asking", "attacked", "offer"].includes(p.phase) && !this.pengNear()) {
      this.toast("回农场东边找" + (p.phase === "attacked" ? "雨巷来的孩子" : "彭姐") + "再说。", "warn");
      return false;
    }
    if (p.phase === "asking") {
      if (choice === "lend" || choice === "bargain") {
        const cost = choice === "lend" ? PENG_LEND : PENG_BARGAIN,
          lack = missingCost(this, cost);
        if (lack.length || !this.takeFarm(cost)) {
          this.toast("还缺：" + lack.join("、") + "。", "warn");
          return false;
        }
        p.relation = clamp(p.relation + (choice === "lend" ? 2 : 1), -10, 10);
        this.toast("彭姐：" + FNPCS.peng.lines.lent, "gold");
      } else if (choice === "refuse") {
        p.relation = clamp(p.relation - 1, -10, 10);
        this.toast("彭姐：" + FNPCS.peng.lines.refused, "warn");
      } else return false;
      p.phase = "waiting";
      p.day = this.s.day + 3;
      this.clearMark({ region: "farm", ...FSPOTS.peng });
      if (this.s.region === "farm") this.assignRegion();
      return true;
    }
    if (p.phase === "attacked" && choice === "aid") {
      const lack = missingCost(this, PENG_AID);
      if (lack.length || !this.takeFarm(PENG_AID)) {
        this.toast("还缺：" + lack.join("、") + "。", "warn");
        return false;
      }
      return this.pengHelped(2, "你托孩子带回弹药和绷带，雨巷守住了。");
    }
    if (p.phase === "offer") {
      if (choice === "ally") {
        p.phase = "allied";
        p.week = this.s.day;
        p.turn = 0;
        this.toast("和雨巷营地签了互助合同：每 7 天轮流供 6 份干粮；灰隼团来时彭姐的人一起守线（防守力 +2），尸潮时帮忙打掉 2 只。", "gold");
        this.olog("与雨巷营地结为互助同盟。", "gold");
      } else if (choice === "decline") {
        p.phase = "trader";
        this.toast("彭姐：" + FNPCS.peng.lines.trader);
      } else return false;
      if (this.s.region === "farm") this.assignRegion();
      return true;
    }
    return false;
  }
  pengHelped(rel, text) {
    const p = this.fr.peng;
    p.phase = "offer";
    p.relation = clamp(p.relation + rel, -10, 10);
    this.clearMark(this.s.region === "farm" ? { region: "farm", ...FSPOTS.peng } : FSPOTS.pengCamp);
    if (this.fonce("peng:help")) this.addReputation(5);
    this.toast(text + "（营地声望 +5）彭姐：" + FNPCS.peng.lines.helped, "gold");
    this.olog(text, "gold");
    if (this.s.region === "farm") this.assignRegion();
    return true;
  }
  pengRescueReason() {
    const p = this.fr.peng;
    if (p.phase !== "attacked") return "雨巷没有在求援";
    if (!this.d?.unlocked?.courtyard) return "雨巷住区的入口还没修通，只能托孩子带东西回去";
    return "";
  }
  pengCampEnter() {
    const p = this.fr.peng;
    if (p.phase !== "attacked" || p.spawned === this.s.day) return;
    p.spawned = this.s.day;
    const sp = FSPOTS.pengCamp;
    for (let i = 0; i < 5; i++) this.spawnAt(i % 2 ? "runner" : "slow", sp.x + Math.cos(i * 1.25) * 170, sp.y + Math.sin(i * 1.25) * 120, { peng: true, state: "chase", alert: 6 });
    this.toast("雨巷营地外围着 5 只感染者——打退它们！", "warn");
  }
  pengSupply() {
    const p = this.fr.peng;
    p.week = this.s.day;
    if (p.turn % 2 === 0) {
      this.putStorage(PENG_SUPPLY);
      this.toast("雨巷营地按合同送来 6 份干粮（已入仓）。", "gold");
    } else if (this.takeFarm(PENG_SUPPLY)) {
      this.toast("这周轮到前哨供粮：6 份干粮送去了雨巷。", "normal");
    } else {
      p.misses++;
      p.relation = clamp(p.relation - 1, -10, 10);
      this.toast("这周轮到前哨供粮，可仓库里不够 6 份干粮。彭姐说先记着，下回再补。", "warn");
    }
    p.turn++;
  }
  pengTradeReason(id) {
    const p = this.fr.peng,
      t = PENG_TRADES.find((x) => x.id === id);
    if (!t) return "没有这样的买卖";
    if (!this.pengHere() || p.phase !== "trader") return "彭姐不在";
    if (!this.pengNear()) return "走到彭姐身边";
    if (p.tradeDay === this.s.day && p.bought.includes(id)) return "这周已经买过了";
    if (this.s.money < t.price) return "要 " + t.price + " 金币";
    if (!this.canAdd(t.give)) return "背包满了";
    return "";
  }
  pengTrade(id) {
    const reason = this.pengTradeReason(id);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    const p = this.fr.peng,
      t = PENG_TRADES.find((x) => x.id === id);
    if (p.tradeDay !== this.s.day) {
      p.tradeDay = this.s.day;
      p.bought = [];
    }
    p.bought = [...p.bought, id];
    this.s.money -= t.price;
    this.add(t.give, true);
    this.toast("从彭姐那儿买了" + t.name + "（−" + t.price + " 金币）。");
    return true;
  }
  raidPower() {
    return super.raidPower() + (this.fr?.peng.phase === "allied" ? 2 : 0);
  }

  // ---------- 贺满仓 ----------
  hemcHere() {
    return this.s.region === "farm" && (this.sc?.claimed || []).includes("act8");
  }
  hemcAudit() {
    return { ledger: this.o.ledger.length, bundles: this.o.bundles.length, ok: this.o.ledger.length >= 3 && this.o.bundles.length >= 2 };
  }
  hemcTalk() {
    const h = this.fr.hemc;
    if (!this.hemcHere() || dist(this.s.player, FSPOTS.hemc) > 130) return false;
    if (h.phase === "open") return false;
    h.phase = this.hemcAudit().ok ? "open" : "met";
    this.toast("贺满仓：" + (h.phase === "open" ? FNPCS.hemc.lines.audit + FNPCS.hemc.lines.open : FNPCS.hemc.lines.hello), h.phase === "open" ? "gold" : "normal");
    if (h.phase === "open") this.olog("贺满仓愿意给前哨垫付建设材料。", "gold");
    return true;
  }
  advanceReason(type) {
    const h = this.fr.hemc,
      d = BUILDINGS[type];
    if (!d || type === "field") return "没有这样的设施";
    if (h.phase !== "open") return "贺满仓还没答应垫付";
    if (h.debt) return "上一笔垫付还没还清";
    if (this.s.region !== "farm") return "回到农场再建";
    if (d.tech && !this.c.technologies[d.tech]) return "蓝图未解锁";
    if (type === "harvestTrophy" && !this.f?.trophies) return "先在收获展获得奖杯";
    if (this.afford(d.cost)) return "材料够，用不着垫付";
    return "";
  }
  startAdvance(type) {
    const reason = this.advanceReason(type);
    if (reason) {
      this.toast(reason + "。", "warn");
      return false;
    }
    this._advCheck = true;
    let ok = false;
    try {
      ok = this.startBuild(type);
    } finally {
      this._advCheck = false;
    }
    if (!ok) return false;
    this._advanceType = type;
    this.buildMode = type;
    this.toast("贺满仓垫付" + BUILDINGS[type].name + "的材料：选好位置放下，之后分三期还，不收利息。", "gold");
    return true;
  }
  afford(cost) {
    if (this._advCheck) return true;
    return super.afford(cost);
  }
  spend(cost) {
    if (this._advancing) return true;
    return super.spend(cost);
  }
  placeBuilding(x, y) {
    const type = this.buildMode;
    if (!type || this._advanceType !== type || this.afford(BUILDINGS[type].cost) || this.advanceReason(type)) return super.placeBuilding(x, y);
    this._advancing = true;
    let ok = false;
    try {
      ok = super.placeBuilding(x, y);
    } finally {
      this._advancing = false;
    }
    if (ok) {
      this._advanceType = null;
      this.buildMode = null;
      this.fr.hemc.debt = { type, total: { ...BUILDINGS[type].cost }, paid: {}, day: this.s.day };
      const text = "贺满仓垫付了" + BUILDINGS[type].name + "（" + bundleText(BUILDINGS[type].cost) + "），分三期还。";
      this.toast(text, "gold");
      this.olog(text);
    }
    return ok;
  }
  installment() {
    const debt = this.fr.hemc.debt;
    if (!debt) return null;
    const out = {};
    for (const [id, n] of Object.entries(debt.total)) {
      const left = n - (debt.paid[id] || 0);
      if (left > 0) out[id] = Math.min(left, Math.ceil(n / 3));
    }
    return out;
  }
  repayReason() {
    const pay = this.installment();
    if (!pay) return "没有欠账";
    const lack = missingCost(this, pay);
    if (lack.length) return "这一期还缺：" + lack.join("、");
    return "";
  }
  repay() {
    const reason = this.repayReason(),
      pay = this.installment();
    if (reason || !this.takeFarm(pay)) {
      this.toast((reason || "东西不够") + "。", "warn");
      return false;
    }
    const h = this.fr.hemc;
    for (const [id, n] of Object.entries(pay)) h.debt.paid[id] = (h.debt.paid[id] || 0) + n;
    const done = Object.entries(h.debt.total).every(([id, n]) => (h.debt.paid[id] || 0) >= n);
    if (done) {
      h.debt = null;
      h.advances++;
      this.toast("贺满仓：" + FNPCS.hemc.lines.paid, "gold");
      this.olog("还清了贺满仓的垫付。", "gold");
    } else this.toast("还了一期：" + bundleText(pay) + "。");
    return true;
  }

  // ---------- 出货行情 ----------
  shipTrend(id, day = this._settling ? this.s.day - 1 : this.s.day) {
    let h = day * 97;
    for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 100003;
    const pct = Math.round(((h % 1000) / 1000 - 0.5) * 36);
    return pct;
  }
  shipPrice(id) {
    const base = super.shipPrice(id);
    if (!base) return 0;
    return Math.max(1, Math.round(base * (1 + this.shipTrend(id) / 100)));
  }
  settleShipping() {
    this._settling = true;
    try {
      return super.settleShipping();
    } finally {
      this._settling = false;
    }
  }

  // ---------- 灰隼团：也会打居民、队员和围栏 ----------
  raidAltTarget(z) {
    let best = null;
    const consider = (x, y, key) => {
      const d = Math.hypot(z.x - x, z.y - y);
      if (d < 340 && (!best || d < best.d)) best = { x, y, key, d };
    };
    for (const r of this.c.residents) if (r.x != null && this.lineClear(z, r)) consider(r.x, r.y, "r:" + r.id);
    for (const c of this.o.crew) if (c.x != null && c.task !== "scout" && this.lineClear(z, c)) consider(c.x, c.y, "c:" + c.id);
    for (const b of this.s.buildings) if (b.hp > 0 && RAID_BUILDINGS.includes(b.type)) consider(b.x, b.y, "b:" + b.id);
    return best;
  }
  updateRaider(z, dt) {
    if (!z.dead && !z.retreat && !(z.aim > 0) && z.cooldown <= 0 && this.s.region === "farm") {
      const p = this.s.player,
        seesPlayer = dist(z, p) < 360 && this.lineClear(z, p),
        alt = this.raidAltTarget(z);
      if (alt && (!seesPlayer || this.roll() < 0.3)) {
        z.cooldown = Math.max(0, z.cooldown - dt);
        z.aim = 1;
        z.aimX = alt.x;
        z.aimY = alt.y - 24;
        return;
      }
    }
    return super.updateRaider(z, dt);
  }
  updateRaidShots(dt) {
    if (!this.raidShots.length) return;
    const p = this.s.player,
      walls = this.colliders(true),
      blds = this.s.buildings.filter((b) => b.hp > 0 && RAID_BUILDINGS.includes(b.type)).map((b) => ({ b, r: this.buildingRect(b.type, b.x, b.y, b.rotation) }));
    for (const s of this.raidShots) {
      const ox = s.x,
        oy = s.y;
      s.x += s.vx * dt;
      s.y += s.vy * dt;
      s.life -= dt;
      const steps = Math.max(1, Math.ceil(Math.hypot(s.x - ox, s.y - oy) / 8));
      for (let k = 1; k <= steps; k++) {
        const x = ox + ((s.x - ox) * k) / steps,
          y = oy + ((s.y - oy) * k) / steps;
        const hitB = blds.find((h) => inRect(x, y + 24, h.r));
        if (hitB) {
          s.life = 0;
          hitB.b.hp = Math.max(0, hitB.b.hp - 6);
          if (!hitB.b.hp) this.navRevision++;
          this.particlesAt(x, y, "#c9b48a", 4);
          break;
        }
        if (walls.some((r) => inRect(x, y + 24, r))) {
          s.life = 0;
          this.particlesAt(x, y, "#c9b48a", 3);
          break;
        }
        if (Math.hypot(x - p.x, y - (p.y - 26)) < 16) {
          s.life = 0;
          this.damagePlayer(s.damage);
          break;
        }
        const r = this.c.residents.find((q) => q.x != null && Math.hypot(x - q.x, y - (q.y - 26)) < 14);
        if (r) {
          s.life = 0;
          r.fatigue = clamp((r.fatigue || 0) + 15, 0, 100);
          r.morale = clamp((r.morale ?? 60) - 4, 0, 100);
          r.status = "被流弹擦伤";
          this.woundNote(this.residentName(r.id));
          break;
        }
        const c = this.o.crew.find((q) => q.x != null && Math.hypot(x - q.x, y - (q.y - 26)) < 14);
        if (c) {
          s.life = 0;
          c.status = "挂彩了，歇一会儿";
          c.task = "rest";
          c.target = this.crewHome(c);
          this.woundNote(c.name);
          break;
        }
      }
    }
    this.raidShots = this.raidShots.filter((s) => s.life > 0);
  }
  woundNote(name) {
    this.fr.wounded++;
    this.effects.push({ x: this.s.player.x, y: this.s.player.y - 90, text: name + "中弹了！", t: 1, color: "#ffb3a6" });
    if (this.fr.wounded % 3 === 1) this.toast(name + "被流弹擦伤——灰隼团在打营地的人，快压住他们！", "warn");
  }
  finishRaid(won, auto = false, note = "") {
    const n = this.fr?.wounded || 0;
    const ok = super.finishRaid(won, auto, note);
    if (this.fr) {
      const rep = this.lastRaidReport();
      if (rep && n) rep.wounded = n;
      this.fr.wounded = 0;
    }
    return ok;
  }

  // ---------- 时间钩子 ----------
  workHour() {
    super.workHour();
    if (!this.fr) return;
    const hour = this.hour();
    if (hour === 5 && RUINS.includes(this.s.region)) this.assignRegion();
    if (hour === 6) {
      this.dogMorning();
      if (!this.hazardToday()) this.hazardMorning();
    }
    if (hour === 7) this.dogCoop();
    if (hour === 8) {
      this.deliverLater();
      this.pengCheck();
      if (this.fr.peng.phase === "trader" && this.tradeDay() && this.s.region === "farm") this.assignRegion();
    }
    if (hour === 18 && this.fr.peng.phase === "trader" && this.s.region === "farm") this.assignRegion();
    if (hour === 19) this.planNight();
    if (hour === 20) this.hazardForecast();
  }
  onNewDay() {
    super.onNewDay();
    if (!this.fr) return;
    if (!this.hazardToday() && this.farOpen()) this.hazardMorning();
  }
  update(dt, input = {}) {
    const running = !this.paused;
    super.update(dt, input);
    if (!this.fr) return;
    if (this.s.settings?.access?.calm) this.shake = 0;
    if (!running || this.paused) return;
    // 麦穗提前吠叫
    if (this.dogSkill("bark")) {
      const r = this.raidState(),
        h = this.s.horde,
        key = (r.phase === "warning" ? 1 : 0) * 100000 + this.s.day * 10 + (h.phase === "warning" ? 1 : 0);
      if ((r.phase === "warning" || h.phase === "warning") && this.fr.dog.barkKey !== key) {
        this.fr.dog.barkKey = key;
        if (r.phase === "warning") r.timer += 20;
        if (h.phase === "warning") h.timer += 20;
        this.toast("麦穗冲着林子狂吠——你早 20 秒知道了。", "warn");
      }
    }
    // 彭姐的人帮着打尸潮
    const p = this.fr.peng;
    if (p.phase === "allied" && this.s.horde.phase === "active" && this.s.region === "farm") {
      const key = this.s.day * 100 + (this.s.stats.hordes % 100);
      if (p.hordeKey !== key) {
        p.hordeKey = key;
        const foes = this.enemies.filter((z) => z.horde && !z.dead).slice(0, 2);
        for (const z of foes) {
          this.hurtEnemy(z, Math.max(1, z.hp), 0, { guard: true });
          if (z.hp < 0) z.hp = 0;
        }
        if (foes.length) this.toast("彭姐的人从侧面杀进来，打掉了 " + foes.length + " 只。", "gold");
      }
    }
    // 救援雨巷：打完围着的感染者
    if (p.phase === "attacked" && this.s.region === FSPOTS.pengCamp.region && p.spawned === this.s.day && !this.enemies.some((z) => z.peng && !z.dead))
      this.pengHelped(4, "你赶到雨巷，打退了围营的尸群。");
  }

  // ---------- 场景对象 ----------
  assignRegion() {
    super.assignRegion();
    const f = this.s.far;
    if (!f || !this.s.storyCampaign) return;
    const push = (type, name, spot, extra = {}) => this.objects.push({ type, name, x: spot.x, y: spot.y, icon: 40, ...extra });
    if (this.nightHere()) push("farNight", NIGHT[f.night.kind].name, NIGHT_SPOTS[f.night.region]);
    const h = this.hazardToday();
    if (h && !h.opened && this.s.region === h.region && !(h.kind === "ashore" && this.s.minute >= HAZARDS.ashore.until)) push("farHazard", "险地补给 · " + HAZARDS[h.kind].name, HAZARD_SPOTS[h.region]);
    if (this.pengHere()) push("farPeng", f.peng.phase === "attacked" ? "雨巷来的孩子" : "彭姐 · 雨巷营地", FSPOTS.peng);
    if (this.s.region === FSPOTS.pengCamp.region && ["attacked", "offer", "allied", "trader"].includes(f.peng.phase)) push("farPengCamp", "雨巷营地", FSPOTS.pengCamp);
    if (this.hemcHere()) push("farHemc", "贺满仓 · 联盟账房", FSPOTS.hemc);
  }
  context(ob) {
    const f = this.fr;
    if (ob && f && !this.c?.fishing && FAR_OBJECTS.includes(ob.type) && (this._picked || this.pickCandidates().length < 2)) {
      if (ob.type === "farNight") return NIGHT[f.night.kind].name + " · 做个决定";
      if (ob.type === "farHazard") return ob.name + (this.hazardReason() ? " · " + this.hazardReason() : " · 打开");
      if (ob.type === "farPeng") return f.peng.phase === "attacked" ? "雨巷来求援的孩子" : f.peng.phase === "trader" ? "彭姐 · 买卖" : "彭姐 · 来借粮";
      if (ob.type === "farPengCamp") return f.peng.phase === "attacked" ? "雨巷营地 · 打退围营的尸群" : "雨巷营地";
      if (ob.type === "farHemc") return f.hemc.debt ? "贺满仓 · 还垫付" : "贺满仓 · " + (f.hemc.phase === "open" ? "建设垫付" : "看账本");
    }
    return super.context(ob);
  }
  interact() {
    if (this.paused) return;
    const ob = this._picked || (this.c?.fishing ? null : this.nearestObject()),
      menu = (view, id = "") => this.emit("menu", { menu: "outpost", view, id });
    if (!this.c?.fishing && FAR_OBJECTS.includes(ob?.type) && (this._picked || !this.pickCandidates().length)) {
      if (ob.type === "farNight") {
        const intro = this.featureNew("night");
        this.markSeen("night");
        return this.emit("menu", { menu: "outpost", view: "night", id: "", intro: intro ? "night" : null });
      }
      if (ob.type === "farHazard") return this.openHazard();
      if (ob.type === "farPeng" || ob.type === "farPengCamp") return menu("dialog", "peng");
      if (ob.type === "farHemc") {
        this.hemcTalk();
        return menu("dialog", "hemc");
      }
    }
    return super.interact();
  }
  static parse(text) {
    const raw = JSON.parse(text),
      s = SeasonsEngine.parse(text);
    if (raw.far !== undefined) validateFar(raw.far);
    return migrateState(s);
  }
}

function validateFar(x) {
  const object = (v) => v && typeof v === "object" && !Array.isArray(v),
    int = (v, max = 1e9) => Number.isInteger(v) && v >= 0 && v <= max,
    num = (v, a = -1e6, b = 1e9) => Number.isFinite(v) && v >= a && v <= b,
    str = (v, n = 60) => typeof v === "string" && v.length <= n,
    bundle = (b) => object(b) && Object.entries(b).every(([k, v]) => ITEMS[k] && int(v, 9999)),
    bad = () => {
      throw Error("远方存档异常，请从设置恢复有效备份；原存档会保留。");
    },
    d = defaults();
  if (!object(x) || x.schema !== FAR_SCHEMA || Object.keys(x).some((k) => !Object.hasOwn(d, k))) bad();
  const n = x.night;
  if (n !== undefined && n !== null && (!object(n) || !int(n.day) || !NIGHT_SPOTS[n.region] || !NIGHT[n.kind] || typeof n.done !== "boolean" || (n.choice !== null && !NIGHT[n.kind].choices[n.choice]) || typeof (n.revisit ?? false) !== "boolean")) bad();
  if (x.nightLog !== undefined && (!Array.isArray(x.nightLog) || x.nightLog.length > 12 || x.nightLog.some((l) => !object(l) || !int(l.day) || !NIGHT[l.kind] || !NIGHT[l.kind].choices[l.choice]))) bad();
  if (x.later !== undefined && (!Array.isArray(x.later) || x.later.length > 10 || x.later.some((l) => !object(l) || !str(l.id) || !int(l.day) || !bundle(l.items) || !str(l.text, 200)))) bad();
  if (x.amends !== undefined && (!Array.isArray(x.amends) || x.amends.length > 10 || x.amends.some((a) => !object(a) || !str(a.id) || !str(a.kind, 20) || !str(a.text, 80) || !object(a.cost) || !Object.entries(a.cost).every(([k, v]) => ITEMS[k] && int(v, 999)) || !num(a.rep, -20, 20) || !num(a.mood ?? 0, -20, 20) || !num(a.peng ?? 0, -20, 20) || typeof (a.revisit ?? false) !== "boolean"))) bad();
  for (const k of ["hazard", "nextHazard"]) {
    const h = x[k];
    if (h !== undefined && h !== null && (!object(h) || !int(h.day) || !HAZARD_SPOTS[h.region] || !HAZARDS[h.kind] || typeof (h.spawned ?? false) !== "boolean" || typeof (h.opened ?? false) !== "boolean")) bad();
  }
  const dg = x.dog;
  if (dg !== undefined && (!object(dg) || !int(dg.bond ?? 0, DOG_MAX) || ["fedDay", "petDay", "outDay", "digDay", "barkKey"].some((k) => dg[k] !== undefined && !int(dg[k], 1e12)))) bad();
  const p = x.peng;
  if (p !== undefined && (!object(p) || !PENG_PHASES.includes(p.phase ?? "none") || !num(p.relation ?? 0, -10, 10) || ["day", "week", "misses", "turn", "tradeDay", "hordeKey", "spawned"].some((k) => p[k] !== undefined && !int(p[k], 1e12)) || !Array.isArray(p.bought ?? []) || (p.bought ?? []).some((b) => !PENG_TRADES.some((t) => t.id === b)))) bad();
  const h = x.hemc;
  if (h !== undefined) {
    if (!object(h) || !HEMC_PHASES.includes(h.phase ?? "none") || !int(h.advances ?? 0)) bad();
    const debt = h.debt;
    if (debt !== undefined && debt !== null && (!object(debt) || !BUILDINGS[debt.type] || !bundle(debt.total) || !bundle(debt.paid) || !int(debt.day) || Object.entries(debt.paid).some(([k, v]) => v > (debt.total[k] || 0)))) bad();
    if (debt && h.phase !== "open") bad();
  }
  if (x.wounded !== undefined && !int(x.wounded, 1e6)) bad();
  if (x.claimed !== undefined && (!Array.isArray(x.claimed) || x.claimed.length > 300 || !x.claimed.every((c) => str(c)) || new Set(x.claimed).size !== x.claimed.length)) bad();
}
