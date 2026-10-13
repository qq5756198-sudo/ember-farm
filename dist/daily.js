// v0.18.0「每日抉择」：每天清晨一张三选一的事件卡，选完才开始新的一天。
// 新增 daily 字段：当天的卡（连同三个选项的运气一起定下，读档不重抽）、连贯事件的进度、限时增益、长期加成、
// 延后送达、今天的补给点与标记点。
import { Engine as FarEngine, freshState as farFresh, migrateState as farMigrate } from "./farlands.js";
import { ITEMS, BUILDINGS, CROPS, REGIONS } from "./data.js";
import { missingCost } from "./alliance-data.js";
import { regionOpen } from "./wayfinding.js";
import { DAILY_SCHEMA, NEWBIE_DAYS, COOLDOWN, MAX_CHAINS, EVENTS, EVENT_IDS, CHAINS, PERKS, BUFFS, BASIC_SEEDS, RARE_SEEDS, MODS, CATS } from "./daily-data.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (n, salt) => {
  let h = (Math.imul(n | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const itemName = (id) => ITEMS[id]?.name || id;
const signed = (n) => (n >= 0 ? "+" : "−") + Math.abs(n);
export const itemsText = (b, sign = "+") =>
  Object.entries(b || {})
    .filter(([, n]) => n)
    .map(([id, n]) => itemName(id) + " " + sign + n)
    .join("、");
const CHENG = ["", "一成", "两成", "三成", "四成", "五成", "六成", "七成", "八成", "九成", "十成"];
export const cheng = (p) => CHENG[clamp(Math.round(p * 10), 0, 10)];
const DAY_WORDS = ["今天", "明天", "两天后", "三天后", "四天后", "五天后", "六天后", "七天后"];
const after = (n) => DAY_WORDS[n] || n + " 天后";
const FENCES = ["fence", "gate", "tower"];
const RUINS = ["residential", "hospital", "warehouse"];
const CROP_IDS = ["radish", "potato", "tomato", "bean", "corn", "pumpkin", "herb", "cotton", "rye"].filter((id) => ITEMS[id]);
const SEED_IDS = () => Object.keys(ITEMS).filter((id) => /^seed/.test(id));
// 今天的补给点与连贯事件的标记点
export const CACHE_SPOTS = {
  residential: { x: 720, y: 280 },
  hospital: { x: 480, y: 320 },
  warehouse: { x: 640, y: 200 },
  market: { x: 480, y: 400 },
};
export const DAILY_OBJECTS = ["dailyCache", "dailyMark"];
const TRUST_NAMES = { farmer: "阿禾", mechanic: "陈工", medic: "许医生", laoqin: "老琴" };

const defaults = () => ({
  schema: DAILY_SCHEMA,
  seed: 0,
  pending: null,
  history: [],
  chains: {},
  done: {},
  seen: {},
  buffs: [],
  perks: [],
  later: [],
  flags: {},
  streak: 0,
  caches: [],
  ambush: 0,
  spawn: null,
  bounty: null,
  warnKey: 0,
  warned: { raid: -1, horde: -1 },
  clear: null,
  claimed: [],
  stats: { cards: 0, gambles: 0, wins: 0 },
});

export function migrateState(s) {
  farMigrate(s);
  const d = defaults();
  if (!s.daily) {
    s.daily = d;
    s.daily.seed = (Math.floor(Math.random() * 0x7fffffff) ^ (s.idCounter || 0)) >>> 0 || 1;
  } else {
    const x = s.daily;
    s.daily = { ...d, ...x, flags: { ...d.flags, ...x.flags }, warned: { ...d.warned, ...x.warned }, stats: { ...d.stats, ...x.stats } };
  }
  return s;
}
export const freshState = () => migrateState(farFresh());

export class Engine extends FarEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this.assignRegion();
  }
  get dy() {
    return this.s.daily;
  }
  dOnce(id) {
    const c = this.dy.claimed;
    if (c.includes(id)) return false;
    c.push(id);
    if (c.length > 300) this.dy.claimed = c.slice(-300);
    return true;
  }

  // ---------- 小工具 ----------
  actNo() {
    return this.sc?.act || 1;
  }
  tier(act = this.actNo()) {
    return act >= 6 ? 2 : act >= 3 ? 1.5 : 1;
  }
  scaleN(n, tier = this.dy.pending?.tier || this.tier()) {
    return n > 0 ? Math.max(1, Math.round(n * tier)) : n < 0 ? -Math.max(1, Math.round(-n * tier)) : 0;
  }
  scaleB(b, tier) {
    return Object.fromEntries(Object.entries(b || {}).map(([k, v]) => [k, this.scaleN(v, tier)]));
  }
  hasBuilding(type) {
    return this.s.buildings.some((b) => b.type === type && b.hp > 0);
  }
  helperCount() {
    return (this.sc?.helpers?.length || 0) + (this.o?.crew?.length || 0);
  }
  hasPerk(id) {
    return this.dy.perks.includes(id);
  }
  chainFlag(chain, key) {
    return !!this.dy.chains[chain]?.flags?.includes(key);
  }
  // 种子库那一步撬锁失手，弄坏了一半种子
  seedsAllN(a, tier, chain = null) {
    const n = this.scaleN(a, tier);
    return chain && this.chainFlag(chain, "damaged") ? Math.max(1, Math.ceil(n / 2)) : n;
  }
  clearRuinNow(id) {
    for (const z of this.s.enemies[id] || []) if (!z.boss && !z.nest) z.dead = true;
    if (!this.s.enemies[id]) this.s.enemies[id] = [];
    if (this.s.region === id) this.enemies = this.s.enemies[id];
  }
  regionReady(id) {
    let open = false;
    try {
      open = regionOpen(this, id);
    } catch {
      open = false;
    }
    return open ? "" : "那边的路还没开通";
  }
  stockOf(id) {
    return this.quantityForCost(id, true);
  }
  topItem(min = 1, pred = (id) => !ITEMS[id].protected) {
    const seen = new Set([...Object.keys(this.s.storage || {}), ...Object.keys(this.s.inventory || {})]);
    let best = null;
    for (const id of seen) {
      if (!ITEMS[id] || !pred(id)) continue;
      const n = this.stockOf(id);
      if (n >= min && (!best || n > best.n)) best = { id, n };
    }
    return best;
  }
  topSeed() {
    return this.topItem(4, (id) => /^seed/.test(id) && (this.s.storage?.[id] || 0) > 0);
  }
  goodsValue() {
    let v = 0;
    for (const [id, n] of Object.entries(this.s.inventory || {})) if (n > 0 && ITEMS[id] && !ITEMS[id].protected) v += (this.shipPrice(id) || 0) * n;
    return v;
  }
  runningJob() {
    return this.c.production.find((j) => !j.ready && j.remaining > 0 && this.hasBuilding(j.station));
  }
  hordeSoon() {
    const next = this.c.nextHordeDay;
    return !!next && next - this.s.day >= 1 && next - this.s.day <= 3 && !["warning", "active"].includes(this.s.horde.phase);
  }
  buffValue(kind, day = this.s.day) {
    return this.dy.buffs.filter((b) => b.kind === kind && b.from <= day && b.until >= day).reduce((n, b) => n + b.value, 0);
  }
  buffActive(kind, day = this.s.day) {
    return this.dy.buffs.some((b) => b.kind === kind && b.from <= day && b.until >= day);
  }

  // ---------- 抽卡 ----------
  eventOk(id) {
    const ev = EVENTS[id];
    if (!ev) return false;
    try {
      return !ev.when || !!ev.when(this);
    } catch {
      return false;
    }
  }
  candidates(day) {
    const d = this.dy,
      active = Object.keys(d.chains).length,
      newbie = day <= NEWBIE_DAYS,
      recent = d.history.slice(0, 5);
    const lastCat = recent[0] ? EVENTS[recent[0].id]?.cat : null,
      crisisRecent = recent.some((h) => EVENTS[h.id]?.cat === "crisis");
    const out = [];
    for (const id of EVENT_IDS) {
      const ev = EVENTS[id];
      if (ev.chain && ev.step !== 1) continue;
      if (newbie && !ev.newbie) continue;
      if (ev.chain) {
        if (d.done[ev.chain] || d.chains[ev.chain] || active >= MAX_CHAINS) continue;
      } else if (d.seen[id] && day - d.seen[id] < COOLDOWN) continue;
      if (!this.eventOk(id)) continue;
      if (ev.cat === "crisis" && crisisRecent && !ev.rescue) continue;
      let w = d.seen[id] ? 1 : 3;
      if (ev.chain) w = 2;
      if (ev.rescue) w = 12;
      if (ev.cat === lastCat) w *= 0.4;
      out.push({ id, w });
    }
    return out;
  }
  pickEvent(day) {
    const d = this.dy;
    // 到期的连贯事件优先
    const due = Object.entries(d.chains)
      .filter(([, c]) => !c.mark && c.due !== null && c.due <= day && EVENTS[c.step])
      .sort((a, b) => a[1].due - b[1].due);
    if (due.length) return { id: due[0][1].step, chain: due[0][0] };
    const r = rng(mix(d.seed, day * 31 + 7));
    let list = this.candidates(day);
    if (!list.length) list = EVENT_IDS.filter((id) => !EVENTS[id].chain && this.eventOk(id) && (day > NEWBIE_DAYS || EVENTS[id].newbie)).map((id) => ({ id, w: 1 }));
    if (!list.length) return null;
    const total = list.reduce((n, x) => n + x.w, 0);
    let roll = r() * total;
    for (const x of list) if ((roll -= x.w) <= 0) return { id: x.id, chain: EVENTS[x.id].chain || null };
    return { id: list.at(-1).id, chain: EVENTS[list.at(-1).id].chain || null };
  }
  dailyGenerate(day = this.s.day) {
    const d = this.dy;
    if (day < 2) return null;
    if (d.pending && d.pending.day === day) return d.pending;
    if (d.pending && d.pending.choice === null) d.history = [{ day: d.pending.day, id: d.pending.id, choice: -1, win: null }, ...d.history].slice(0, 60);
    const pick = this.pickEvent(day);
    if (!pick) {
      d.pending = null;
      return null;
    }
    const r = rng(mix(d.seed ^ 0x5bd1e995, day * 131 + 17));
    // 连贯事件整条线用开头那天的奖励倍率，借多少还多少才对得上
    const tier = (pick.chain && d.chains[pick.chain]?.tier) || this.tier();
    d.pending = { day, id: pick.id, rolls: [r(), r(), r()], tier, luck: d.streak >= 2, choice: null, win: null, lines: [] };
    return d.pending;
  }
  dailyCard() {
    const p = this.dy?.pending;
    return p && p.day === this.s.day && p.choice === null && EVENTS[p.id] ? p : null;
  }
  dailySafe() {
    if (this.buildMode || this.c?.fishing || this.d?.battle) return false;
    if (["warning", "active"].includes(this.s.horde.phase)) return false;
    if (this.o && ["warning", "active"].includes(this.raidState().phase)) return false;
    const p = this.s.player;
    return !this.enemies.some((z) => !z.dead && (z.state === "chase" || z.state === "attack") && dist(z, p) < 340);
  }
  dailyShouldShow() {
    return !!this.dailyCard() && this.s.minute >= 360 && this.dailySafe();
  }

  // ---------- 选项 ----------
  optionCost(o, tier) {
    return o.cost ? this.scaleB(o.cost, tier) : null;
  }
  optionPay(o, tier) {
    return o.pay ? this.scaleN(o.pay, tier) : 0;
  }
  optionReason(i, p = this.dailyCard()) {
    if (!p) return "今天没有要决定的事";
    const o = EVENTS[p.id].opts[i];
    if (!o) return "没有这个选项";
    const owned = !o.p && (o.fx || []).find((op) => op[0] === "perk" && this.hasPerk(op[1]));
    if (owned && (o.fx || []).every((op) => op[0] === "perk" || op[0] === "next" || op[0] === "flag")) return "已经有「" + PERKS[owned[1]].name + "」了";
    if (o.req) {
      const why = o.req(this);
      if (why) return why;
    }
    const cost = this.optionCost(o, p.tier);
    if (cost) {
      const lack = missingCost(this, cost);
      if (lack.length) return "还缺：" + lack.join("、");
    }
    const pay = this.optionPay(o, p.tier);
    if (pay && this.s.money < pay) return "要 " + pay + " 金币";
    return "";
  }
  optionChance(i, p = this.dailyCard()) {
    const o = EVENTS[p.id].opts[i];
    if (!o?.p) return null;
    return clamp(o.p + (p.luck ? 0.2 : 0), 0, 1);
  }
  chooseDaily(i) {
    const p = this.dailyCard();
    const reason = this.optionReason(i, p);
    if (reason) {
      this.toast(reason + "。", "warn");
      return null;
    }
    if (!this.dOnce("card:" + p.day)) return null;
    const ev = EVENTS[p.id],
      o = ev.opts[i],
      d = this.dy;
    const cost = this.optionCost(o, p.tier),
      pay = this.optionPay(o, p.tier);
    if (cost && !this.takeFarm(cost)) {
      d.claimed = d.claimed.filter((x) => x !== "card:" + p.day);
      this.toast("东西不够。", "warn");
      return null;
    }
    if (pay) this.s.money -= pay;
    let fx = o.fx || [],
      win = null;
    if (o.p) {
      win = p.rolls[i] < this.optionChance(i, p);
      fx = win ? o.win || [] : o.lose || [];
      d.stats.gambles++;
      if (win) {
        d.stats.wins++;
        d.streak = 0;
      } else d.streak++;
    }
    const lines = [];
    if (cost) lines.push("花掉：" + itemsText(cost, "−"));
    if (pay) lines.push("花掉：金币 −" + pay);
    if (o.p) lines.push(win ? "运气不错，成了！" : "没成：" + (o.loseNote || "运气不好") + "。");
    const ctx = { p, ev, chain: ev.chain, next: null, mark: null, flags: [], time: 0 };
    for (const op of fx) {
      const line = this.applyOp(op, ctx, p.tier, p.rolls[i]);
      if (line) lines.push(line);
    }
    if (o.note && (!o.p || win)) lines.push(o.note + "。");
    if (ev.chain) this.advanceChain(ev, o, ctx, lines);
    if (!lines.length) lines.push(o.p ? "平安无事。" : "什么也没发生，日子照常过。");
    p.choice = i;
    p.win = win;
    p.lines = lines.slice(0, 12).map((x) => String(x).slice(0, 160));
    d.seen[p.id] = p.day;
    d.stats.cards++;
    d.history = [{ day: p.day, id: p.id, choice: i, win }, ...d.history].slice(0, 60);
    this.olog("今日抉择 · " + ev.name + "：" + o.label + "。", "normal");
    // 花掉的时间放到最后再走，且不跨过午夜：今天的账先记完
    if (ctx.time > 0) this.advanceMinutes(ctx.time);
    this.emit("craft");
    return { lines: p.lines, win, event: p.id, choice: i };
  }
  advanceChain(ev, o, ctx, lines) {
    const d = this.dy,
      c = ev.chain,
      cur = d.chains[c] || { step: ev.id, due: null, flags: [], mark: null, start: this.s.day, tier: ctx.p?.tier || this.tier() };
    cur.flags = [...new Set([...(cur.flags || []), ...ctx.flags])].slice(0, 8);
    if (!cur.tier) cur.tier = ctx.p?.tier || this.tier();
    if (ctx.mark && cur.flags.includes("clue")) {
      // 之前已经摸清了线索，不用再专门跑一趟
      d.chains[c] = { ...cur, step: ctx.mark.step, due: this.s.day + 1, mark: null };
      lines.push("你之前已经摸清了方向，不用再跑一趟：明天早上会有下文（" + CHAINS[c].name + "）。");
    } else if (ctx.mark) {
      d.chains[c] = { ...cur, step: ctx.mark.step, due: null, mark: { region: ctx.mark.region, x: ctx.mark.x, y: ctx.mark.y, label: ctx.mark.label } };
      lines.push("后续：去" + this.regionLabel(ctx.mark.region) + "的标记点（" + ctx.mark.label + "），去过的第二天早上有下文。");
      if (ctx.mark.region === this.s.region) this.assignRegion();
    } else if (ctx.next) {
      d.chains[c] = { ...cur, step: ctx.next.step, due: this.s.day + ctx.next.days, mark: null };
      lines.push("后续：" + after(ctx.next.days) + "早上会有下文（" + CHAINS[c].name + "）。");
    } else {
      delete d.chains[c];
      const ending = EVENTS[ev.id].step === CHAINS[c].steps;
      d.done[c] = { day: this.s.day, ending: ending ? o.label : null };
      lines.push(ending ? "「" + CHAINS[c].name + "」走到了结局。" : "「" + CHAINS[c].name + "」到此为止。");
    }
  }
  regionLabel(id) {
    return { residential: "废弃居民区", hospital: "旧医院", warehouse: "工业仓库", market: "幸存者集市", railDepot: "北线货运站", courtyard: "雨巷住区" }[id] || REGIONS[id]?.name || "远处";
  }

  // ---------- 效果 ----------
  give(b) {
    const items = Object.fromEntries(Object.entries(b || {}).filter(([id, n]) => Object.hasOwn(ITEMS, id) && Number.isInteger(n) && n > 0));
    if (!Object.keys(items).length) return;
    this.receive(items);
  }
  takeSome(b) {
    const got = {};
    for (const [id, n] of Object.entries(b)) {
      const have = this.stockOf(id),
        k = Math.min(have, n);
      if (k > 0 && this.takeFarm({ [id]: k })) got[id] = k;
    }
    return got;
  }
  applyOp(op, ctx, tier, roll = 0.5) {
    const [kind, a, b, c, e4] = op,
      d = this.dy,
      day = this.s.day;
    switch (kind) {
      case "give": {
        const items = this.scaleB(a, tier);
        this.give(items);
        return "得到：" + itemsText(items);
      }
      case "money": {
        const n = this.scaleN(a, tier);
        this.s.money = Math.max(0, this.s.money + n);
        return "金币 " + signed(n);
      }
      case "rep":
        this.addReputation(a);
        return "营地声望 " + signed(a);
      case "mood":
        this.residentsMood(a);
        return "居民士气 " + signed(a);
      case "fatigue":
        for (const r of this.c.residents) r.fatigue = clamp((r.fatigue || 0) + a, 0, 100);
        return a <= -100 ? "居民疲劳清零" : "居民疲劳 " + signed(a);
      case "hp":
        if (a < 0) this.s.player.hp = Math.max(10, this.s.player.hp + a);
        else this.s.player.hp = Math.min(100, this.s.player.hp + a);
        return "生命 " + signed(a);
      case "stamina":
        this.s.player.stamina = clamp(this.s.player.stamina + a, 0, 100);
        return a >= 100 ? "体力恢复满" : "体力 " + signed(a);
      case "research":
        this.grantResearch?.(a);
        return "研究点 +" + a;
      case "xp":
        this.xp(a, b);
        return ({ combat: "战斗", exploration: "探索", agriculture: "农业" }[a] || "") + "经验 +" + b;
      case "trust": {
        const ids = this.trustTargets(a);
        for (const id of ids) this.addTrust?.(id, b);
        return ids.length ? ids.map((id) => this.personName(id)).join("、") + "的信任 " + signed(b) : "";
      }
      case "cheer": {
        const r = [...this.c.residents].sort((x, y) => (x.morale ?? 60) - (y.morale ?? 60))[0];
        if (!r) return "";
        r.morale = clamp((r.morale ?? 60) + 10, 0, 100);
        this.addTrust?.(r.id, 2);
        return this.personName(r.id) + "：士气 +10，信任 +2";
      }
      case "buff": {
        const days = b,
          until = day + Math.max(0, days - 1);
        d.buffs = [...d.buffs.filter((x) => x.until >= day), { kind: a, from: day, until, value: c }].slice(-16);
        if (a === "rain") for (const p of this.s.plots) if ((p.region || "farm") === "farm" && p.crop && !this.plotWatered(p)) this.waterPlot(p);
        return (days <= 1 ? "今天：" : "接下来 " + days + " 天：") + BUFFS[a](c);
      }
      case "later": {
        const items = a !== null && b ? this.scaleB(b, tier) : null,
          money = c ? this.scaleN(c, tier) : 0;
        d.later = [...d.later, { id: "dl:" + day + ":" + d.later.length + ":" + (ctx.p?.id || ""), day: day + a, hour: a === 0 ? 18 : 8, items: items || {}, money, text: e4 || "", kind: "gift" }].slice(-20);
        return after(a) + (a === 0 ? "傍晚" : "早上") + "：" + [items ? itemsText(items) : "", money ? "金币 +" + money : ""].filter(Boolean).join("、");
      }
      case "debt": {
        const items = this.scaleB(b, tier);
        d.later = [...d.later, { id: "dd:" + day + ":" + d.later.length, day: day + a, hour: 8, items, money: 0, text: c || "", kind: "debt" }].slice(-20);
        return after(a) + "要交出：" + itemsText(items, "");
      }
      case "night": {
        const items = this.scaleB(a, tier);
        d.later = [...d.later, { id: "dn:" + day + ":" + d.later.length, day, hour: 23, items, money: 0, text: "夜里有人摸进来偷东西", kind: "night" }].slice(-20);
        return "今晚可能丢：" + itemsText(items, "");
      }
      case "drain": {
        for (let k = 1; k <= a; k++) d.later = [...d.later, { id: "dr:" + day + ":" + k, day: day + k, hour: 8, items: {}, money: 0, text: "田鼠又啃了一份收成", kind: "drain" }].slice(-20);
        return "接下来 " + a + " 天，每天少一份收成";
      }
      case "spawn": {
        const bounty = b ? this.scaleB(b, tier) : null;
        if (this.s.region === "farm") this.spawnFarm(a, bounty);
        else d.spawn = { n: clamp((d.spawn?.n || 0) + a, 0, 12), bounty: bounty || d.spawn?.bounty || null };
        return "农场边多了 " + a + " 只感染者" + (bounty ? "，打完得到：" + itemsText(bounty) : "");
      }
      case "ambush":
        d.ambush = clamp(d.ambush + a, 0, 6);
        return "下次进废墟会撞见 " + a + " 只感染者";
      case "cache": {
        const items = this.scaleB(a, tier),
          cache = this.placeCache(items, b, roll);
        return cache ? "今天" + this.regionLabel(cache.region) + "多了一个补给点（" + itemsText(items, "") + "），地图上已标出" : "得到：" + itemsText(items);
      }
      case "crew": {
        const fallback = this.scaleB(Object.fromEntries(Object.entries(b || {}).filter(([id]) => Object.hasOwn(ITEMS, id))), tier);
        const already = !!this.o?.crew.some((x) => x.id === a.id);
        if (this.o && !already && !this.crewFull?.() && this.addCrew(a)) return a.name + "加入了援建队";
        this.give(fallback);
        return (already ? a.name + "已经在援建队里了，这次带来：" : "援建队住满了，" + a.name + "留下谢礼走了：") + itemsText(fallback);
      }
      case "perk":
        if (!d.perks.includes(a)) d.perks = [...d.perks, a];
        return "长期加成「" + PERKS[a].name + "」：" + PERKS[a].text;
      case "peng":
        if (this.fr) this.fr.peng.relation = clamp(this.fr.peng.relation + a, -10, 10);
        return "彭姐的关系 " + signed(a);
      case "dog":
        if (this.fr) this.addBond(a);
        return "麦穗默契 " + signed(a);
      case "lose": {
        const target = a === "topItem" ? this.topItem(1) : a === "topSeed" ? this.topSeed() : { id: a, n: this.stockOf(a) };
        if (!target || !target.n) return "";
        const k = Math.max(1, Math.floor(target.n * b)),
          got = this.takeSome({ [target.id]: k });
        return "失去：" + itemsText(got, "−");
      }
      case "water": {
        let n = 0;
        for (const p of this.s.plots) if ((p.region || "farm") === "farm" && p.crop && !this.plotWatered(p)) {
          this.waterPlot(p);
          n++;
        }
        return "今天的田都算浇过了" + (n ? "（" + n + " 块）" : "");
      }
      case "fertility":
        for (const p of this.s.plots) if ((p.region || "farm") === "farm") p.fertility = clamp((p.fertility ?? 65) + a, 0, 100);
        return "农田肥力 +" + a;
      case "growthBack": {
        let n = 0;
        for (const p of this.s.plots)
          if (p.crop && (p.region || "farm") === "farm" && p.growth > 0) {
            p.growth = Math.max(0, p.growth * (1 - a));
            n++;
          }
        return n ? "作物生长退回 " + Math.round(a * 100) + "%" : "";
      }
      case "harvestRipe": {
        let n = 0;
        for (const p of this.s.plots) if (p.crop && (p.region || "farm") === "farm" && p.growth >= (CROPS[p.crop]?.grow || 1e9) && this.harvest(p)) n++;
        return n ? "收下了 " + n + " 块熟了的田" : "没有熟了的作物，只是白忙一场";
      }
      case "sick":
        if (this.o) this.o.sick = Math.max(this.o.sick || 0, day + a - 1);
        return "营地有病号，" + a + " 天里干活慢";
      case "heal":
        if (this.o) this.o.sick = 0;
        for (const r of this.c.residents) if (/病|伤/.test(r.status || "")) r.status = "";
        return "病号都好了";
      case "visitor":
        if (this.o && !this.o.visitors.current && !this.ss?.pendingGuest && !((d.flags.visitBlock || 0) > day)) {
          if (this.ss) this.ss.pendingGuest = a;
          this.o.visitors.next = day + 1;
          return "明天上午营门会有一位访客";
        }
        this.give(this.scaleB({ bread: 1 }, tier));
        return "营门正忙，他留下点东西先走了";
      case "clearRuin": {
        const ruins = (this.openRuins?.() || []).filter((r) => RUINS.includes(r));
        // 还没刷出来的废墟（列表为空）按满员算：那边马上就会有一群
        const id = ruins.map((r) => ({ r, n: this.s.enemies[r] ? this.s.enemies[r].filter((z) => !z.dead).length : 8 })).sort((x, y) => y.n - x.n)[0]?.r;
        if (!id) return "";
        this.clearRuinNow(id);
        d.clear = { region: id, until: day + 1 };
        return this.regionLabel(id) + "的感染者被清掉了，今明两天那边很安静";
      }
      case "repair": {
        let n = 0;
        for (const bd of this.s.buildings) {
          const max = BUILDINGS[bd.type]?.hp;
          if (!max || bd.hp >= max) continue;
          if (a === "fences" && !FENCES.includes(bd.type)) continue;
          bd.hp = max;
          n++;
        }
        this.navRevision++;
        return n ? "修好了 " + n + " 处设施" : "设施都完好";
      }
      case "rush": {
        const j = this.c.production.find((x) => !x.ready && x.remaining > 0);
        if (!j) return "手头没有在做的加工";
        j.remaining = 0.001;
        return "一批加工马上就好";
      }
      case "killJob": {
        const j = this.runningJob();
        if (!j) return "";
        this.c.production = this.c.production.filter((x) => x !== j);
        return "那批没做完的东西烧掉了";
      }
      case "stationHit": {
        const j = this.runningJob(),
          bd = j && this.s.buildings.find((x) => x.type === j.station && x.hp > 0);
        if (!bd) return "";
        bd.hp = Math.max(1, Math.floor(bd.hp / 2));
        return (BUILDINGS[bd.type]?.name || "设施") + "耐久掉了一半";
      }
      case "visitBlock":
        d.flags.visitBlock = Math.max(d.flags.visitBlock || 0, day + a);
        if (this.o) this.o.visitors.next = Math.max(this.o.visitors.next || 0, day + a);
        return a + " 天内营门不放人进来";
      case "hordeShift":
        if (this.c.nextHordeDay) this.c.nextHordeDay += a;
        return "尸潮推迟 " + a + " 天";
      case "hordeTomorrow":
        if (this.c.nextHordeDay) this.c.nextHordeDay = Math.max(day + 1, Math.min(this.c.nextHordeDay, day + 1));
        return "尸潮明天就到";
      case "raidDelay": {
        const r = this.raidState?.();
        if (r?.phase === "scheduled") r.day += a;
        return "灰隼团推迟 " + a + " 天";
      }
      case "raidLess":
        d.flags.raidLess = a;
        return "下次袭击少 " + a + " 人";
      case "raidWarn":
        d.flags.raidWarn = a;
        return "下次袭击预警多 " + a + " 秒";
      case "seeds": {
        const n = this.scaleN(a, tier),
          out = {};
        for (let k = 0; k < n; k++) {
          const id = BASIC_SEEDS[mix(day * 7 + k, 99) % BASIC_SEEDS.length];
          out[id] = (out[id] || 0) + 1;
        }
        this.give(out);
        return "得到：" + itemsText(out);
      }
      case "seedsAll": {
        const n = this.seedsAllN(a, tier, ctx.chain),
          out = Object.fromEntries(BASIC_SEEDS.map((id) => [id, n]));
        this.give(out);
        return "八种种子各 +" + n;
      }
      case "seedsOwned": {
        const n = this.scaleN(a, tier),
          out = Object.fromEntries(SEED_IDS().filter((id) => this.stockOf(id) > 0).map((id) => [id, n]));
        if (!Object.keys(out).length) out.seedRadish = n;
        this.give(out);
        return "已有的种子各 +" + n;
      }
      case "rareSeeds": {
        const n = this.scaleN(a, tier),
          id = RARE_SEEDS[mix(day, 5) % RARE_SEEDS.length];
        this.give({ [id]: n });
        return "得到：" + itemName(id) + " +" + n;
      }
      case "mod": {
        const id = MODS.find((m) => !this.stockOf(m)) || MODS[mix(day, 3) % MODS.length];
        this.give({ [id]: 1 });
        return "得到：" + itemName(id);
      }
      case "random": {
        const list = a,
          pick = this.scaleB(list[Math.floor(roll * 1000) % list.length], tier);
        this.give(pick);
        return "得到：" + itemsText(pick);
      }
      case "time": {
        const n = Math.max(0, Math.min(a, 1439 - Math.ceil(this.s.minute) - ctx.time));
        ctx.time += n;
        return n < a ? "一直忙到深夜" : "花掉 " + Math.round(a / 60) + " 小时";
      }
      case "caravanDisc":
        d.flags.caravanDisc = Math.min(d.flags.caravanDisc || 1, a);
        return "下次唐九的商队打" + Math.round(a * 10) + "折";
      case "caravanOrder":
        d.flags.caravanOrder = true;
        return "下次唐九会带来一件枪械配件";
      case "festNext":
        d.flags.festNext = true;
        return "下一次节庆多一颗星";
      case "talkUsed":
        if (this.ss?.talk) this.ss.talk.day = day;
        return "今晚的营火夜谈用掉了";
      case "sellTop": {
        const t = this.topItem(1);
        if (!t) return "没什么可卖的";
        const k = Math.min(a, t.n),
          got = this.takeSome({ [t.id]: k }),
          money = Math.max(1, Math.round((this.scaleN(b, tier) * (got[t.id] || 0)) / a));
        this.s.money += money;
        return "卖掉 " + itemsText(got, "") + "：金币 +" + money;
      }
      case "payGoods": {
        let need = this.scaleN(a, tier);
        const sold = {};
        const goods = Object.entries(this.s.inventory).filter(([id, n]) => n > 0 && ITEMS[id] && !ITEMS[id].protected && this.shipPrice(id) > 0).sort((x, y) => this.shipPrice(y[0]) - this.shipPrice(x[0]));
        for (const [id, n] of goods) {
          if (need <= 0) break;
          const price = this.shipPrice(id),
            k = Math.min(n, Math.ceil(need / price));
          this.s.inventory[id] -= k;
          if (!this.s.inventory[id]) delete this.s.inventory[id];
          sold[id] = k;
          need -= k * price;
        }
        return "抵掉：" + itemsText(sold, "−");
      }
      case "tell": {
        const w = this.forecast?.()?.[1]?.weather;
        return w ? "她说明天是" + w + "。" : "她说明天天气不坏。";
      }
      case "flag":
        ctx.flags.push(b);
        return "";
      case "next":
        ctx.next = { step: a, days: b };
        return "";
      case "mark":
        ctx.mark = { step: a, region: b, x: c, y: e4, label: op[5] };
        return "";
    }
    return "";
  }
  trustTargets(who) {
    if (who === "crew") {
      const id = this.o?.crew[0]?.id || this.sc?.helpers?.[0]?.id;
      return id ? [id] : [];
    }
    if (who === "helper") return this.sc?.helpers?.length ? [this.sc.helpers[0].id] : this.o?.crew[0] ? [this.o.crew[0].id] : [];
    if (who === "two") return this.c.residents.slice(0, 2).map((r) => r.id);
    if (who === "laoqin") return ["laoqin"];
    return this.resident(who) ? [who] : [];
  }
  personName(id) {
    return TRUST_NAMES[id] || this.residentName?.(id) || this.o?.crew.find((c) => c.id === id)?.name || (id === "tieqiao" ? "铁锹" : "他");
  }
  placeCache(items, where, roll) {
    let region = where;
    if (where === "ruin") {
      const ruins = (this.openRuins?.() || []).filter((r) => CACHE_SPOTS[r]);
      region = ruins.length ? ruins[Math.floor(roll * 997) % ruins.length] : "market";
    }
    if (!CACHE_SPOTS[region]) region = "market";
    const spot = CACHE_SPOTS[region],
      d = this.dy,
      cache = { id: "dc:" + this.s.day + ":" + d.caches.length, day: this.s.day, region, x: spot.x + (d.caches.filter((c) => c.region === region).length % 3) * 36, y: spot.y, items };
    d.caches = [...d.caches, cache].slice(-6);
    if (this.s.region === region) this.assignRegion();
    return cache;
  }
  spawnFarm(n, bounty) {
    for (let i = 0; i < n; i++) {
      const p = this.freeSpot(1320 - (i % 2) * 60, 340 + i * 60),
        z = this.enemy(i % 2 ? "runner" : "slow", p.x, p.y);
      Object.assign(z, { daily: true, state: "chase", alert: 6 });
      this.enemies.push(z);
    }
    if (bounty) this.dy.bounty = { items: bounty, day: this.s.day };
  }

  // ---------- 每天的钩子 ----------
  deliver(hour) {
    const d = this.dy,
      due = d.later.filter((x) => x.day < this.s.day || (x.day === this.s.day && x.hour <= hour));
    if (!due.length) return;
    d.later = d.later.filter((x) => !due.includes(x));
    for (const x of due) {
      if (!this.dOnce(x.id)) continue;
      if (x.kind === "gift") {
        if (Object.keys(x.items).length) this.putStorage(x.items);
        if (x.money) this.s.money += x.money;
        const text = (x.text ? x.text + "：" : "") + [itemsText(x.items), x.money ? "金币 +" + x.money : ""].filter(Boolean).join("、") + "（已入仓）";
        this.toast(text, "gold");
        this.olog(text, "gold");
      } else if (x.kind === "debt") {
        const got = this.takeSome(x.items),
          short = Object.entries(x.items).some(([id, n]) => (got[id] || 0) < n);
        if (short) this.addReputation(-2);
        const text = (x.text || "该还的东西") + "：交出 " + (itemsText(got, "") || "什么也没有") + (short ? "，不够的部分记了一笔（声望 −2）" : "");
        this.toast(text, short ? "warn" : "normal");
        this.olog(text, short ? "warn" : "normal");
      } else if (x.kind === "night") {
        if (this.hasPerk("sentry") || this.hasPerk("fieldDogs") || this.buffActive("nightSafe", x.day) || this.buffActive("cats", x.day)) {
          this.toast("夜里有人想摸进来，被守夜的人赶跑了。", "gold");
          continue;
        }
        const got = this.takeSome(x.items);
        const text = x.text + "：丢了 " + (itemsText(got, "") || "一点零碎") + "。";
        this.toast(text, "warn");
        this.olog(text, "warn");
      } else if (x.kind === "drain") {
        if (this.hasPerk("fieldDogs") || this.buffActive("cats")) continue;
        const t = this.topItem(1, (id) => CROP_IDS.includes(id));
        if (t) this.takeSome({ [t.id]: 1 });
        if (t) this.olog(x.text + "（" + itemName(t.id) + " −1）", "warn");
      }
    }
  }
  morningPerks() {
    const d = this.dy,
      day = this.s.day;
    if (this.buffActive("rain")) for (const p of this.s.plots) if ((p.region || "farm") === "farm" && p.crop && !this.plotWatered(p)) this.waterPlot(p);
    // v0.27：蓄水池并进水网（每天出 6 份水、能存 30 份），这里不再另外浇
    if (this.hasPerk("cistern") && !this.waterNetOn?.()) {
      let n = 0;
      for (const p of this.s.plots)
        if ((p.region || "farm") === "farm" && p.crop && !this.plotWatered(p) && n < 6) {
          this.waterPlot(p);
          n++;
        }
    }
    const m = this.buffValue("morale");
    if (m) this.residentsMood(m);
    const every = (perk, n, fn) => {
      if (this.hasPerk(perk) && day % n === 0 && this.dOnce(perk + ":" + day)) fn();
    };
    every("huntDogs", 2, () => {
      this.putStorage({ bread: 1 });
      this.olog("猎犬叼回一份野味（干粮 +1）。");
    });
    every("seedNet", 7, () => {
      const out = {};
      for (let k = 0; k < 2; k++) {
        const id = BASIC_SEEDS[mix(day, 40 + k) % BASIC_SEEDS.length];
        out[id] = (out[id] || 0) + 1;
      }
      this.putStorage(out);
      this.toast("种子网寄来了种子：" + itemsText(out) + "（已入仓）", "gold");
    });
    every("seedVault", 5, () => {
      const out = {};
      for (let k = 0; k < 3; k++) {
        const id = BASIC_SEEDS[mix(day, 60 + k) % BASIC_SEEDS.length];
        out[id] = (out[id] || 0) + 1;
      }
      this.putStorage(out);
      this.toast("种子分库送来：" + itemsText(out) + "（已入仓）", "gold");
    });
    every("blackMarket", 7, () => {
      if (this.s.money < 40) return this.olog("黑市的货这次没进：金币不够 40。");
      this.s.money -= 40;
      this.putStorage({ ammo: 10, parts: 2 });
      this.toast("黑市的货到了：弹药 +10、零件 +2（付 40 金币，已入仓）", "gold");
    });
  }
  // 午夜到清晨之间睡觉：今天的卡已经抽好了，先定下来再睡，不然一觉醒来它就过去了
  sleep() {
    if (this.dy && this.dailyCard() && this.s.minute < 360 && this.s.region === "farm") {
      this.toast("睡前先把今天的事定了。", "gold");
      this.emit("menu", { menu: "outpost", view: "daily", id: "" });
      return false;
    }
    return super.sleep();
  }
  workHour() {
    super.workHour();
    if (!this.dy) return;
    const hour = this.hour();
    if (hour === 7) this.morningPerks();
    if (hour === 8 || hour === 18 || hour === 23) this.deliver(hour);
  }
  onNewDay() {
    super.onNewDay();
    const d = this.dy;
    if (!d) return;
    const day = this.s.day;
    d.buffs = d.buffs.filter((b) => b.until >= day);
    d.caches = d.caches.filter((c) => c.day >= day);
    if (d.bounty && d.bounty.day < day - 1) d.bounty = null;
    if (d.clear && d.clear.until < day) d.clear = null;
    if (d.clear && this.s.enemies[d.clear.region] == null) this.s.enemies[d.clear.region] = [];
    if (d.flags.visitBlock && d.flags.visitBlock <= day) delete d.flags.visitBlock;
    this.deliver(0);
    this.dailyGenerate(day);
    if (this.s.region !== "farm") this.assignRegion();
  }

  // ---------- 各处的加成 ----------
  cropGrowthRate(p) {
    const base = super.cropGrowthRate(p);
    if (!this.dy || (p.region || "farm") !== "farm") return base;
    return base * Math.max(0.1, 1 + this.buffValue("growth"));
  }
  processProduction(n) {
    if (!this.dy) return super.processProduction(n);
    return super.processProduction(n * Math.max(0, 1 + this.buffValue("work")));
  }
  damagePlayer(n) {
    const g = this.dy ? this.buffValue("guard") : 0;
    return super.damagePlayer(n * (1 - clamp(g, 0, 0.8)));
  }
  shipPrice(id) {
    const base = super.shipPrice(id);
    if (!base || !this.dy) return base;
    const day = this._settling ? this.s.day - 1 : this.s.day;
    const m = 1 + this.buffValue("ship", day) + (id === "parts" ? this.buffValue("partsShip", day) : 0) + (this.hasPerk("smuggle") ? 0.1 : 0);
    return Math.max(1, Math.round(base * m));
  }
  raidPower() {
    return super.raidPower() + (this.dy ? (this.hasPerk("armored") ? 2 : 0) + this.buffValue("defense") : 0);
  }
  raidSize() {
    const n = super.raidSize();
    return this.dy?.flags.raidLess ? Math.max(3, n - this.dy.flags.raidLess) : n;
  }
  finishRaid(won, auto = false, note = "") {
    const ok = super.finishRaid(won, auto, note);
    if (this.dy) delete this.dy.flags.raidLess;
    return ok;
  }
  radioHost() {
    const m = super.radioHost();
    if (!this.dy) return m;
    return m * (this.hasPerk("radioOp") ? 1.5 : 1) * (this.buffActive("radio") ? 2 : 1);
  }
  festivalStars(kind) {
    const stars = super.festivalStars(kind);
    if (this.dy) {
      let extra = (this.hasPerk("festStar") ? 1 : 0) + (this.dy.flags.festNext ? 1 : 0);
      for (let i = 0; i < stars.length && extra > 0; i++)
        if (stars[i] === false) {
          stars[i] = true;
          extra--;
        }
    }
    return stars;
  }
  hostFestival() {
    const ok = super.hostFestival();
    if (ok && this.dy) delete this.dy.flags.festNext;
    return ok;
  }
  arriveCaravan() {
    const ok = super.arriveCaravan();
    if (!ok || !this.dy) return ok;
    const f = this.dy.flags,
      c = this.o.caravan;
    if (f.caravanDisc) {
      for (const offer of c.offers) offer.price = Math.max(1, Math.round(offer.price * f.caravanDisc));
      this.toast("唐九记得你的订金：这次的货打" + Math.round(f.caravanDisc * 10) + "折。", "gold");
      delete f.caravanDisc;
    }
    if (f.caravanOrder) {
      const id = MODS.find((m) => !this.stockOf(m)) || MODS[0];
      this.putStorage({ [id]: 1 });
      this.toast("唐九把预订的" + itemName(id) + "带来了（已入仓）。", "gold");
      delete f.caravanOrder;
    }
    if (this.hasPerk("caravanGift") && this.dOnce("cgift:" + this.s.day)) {
      this.putStorage({ cloth: 2, salt: 1 });
      this.olog("商队捎来剧团的问候：布料 +2、食盐 +1。");
    }
    return ok;
  }
  // 地下避难所：灰隼团来时，居民不在枪口下。
  withShelter(fn) {
    if (!this.dy || !this.hasPerk("shelter")) return fn();
    const saved = this.c.residents.map((r) => [r, r.x]);
    for (const [r] of saved) r.x = null;
    try {
      return fn();
    } finally {
      for (const [r, x] of saved) r.x = x;
    }
  }
  raidAltTarget(z) {
    return this.withShelter(() => super.raidAltTarget(z));
  }
  updateRaidShots(dt) {
    return this.withShelter(() => super.updateRaidShots(dt));
  }

  // ---------- 出门 ----------
  travel(id) {
    if (!this.dy) return super.travel(id);
    const from = this.s.region;
    this._travelTo = id;
    let ok;
    try {
      ok = super.travel(id);
    } finally {
      this._travelTo = null;
    }
    if (!ok || id === from) return ok;
    const d = this.dy;
    if (id === "farm" && d.spawn?.n) {
      this.spawnFarm(d.spawn.n, d.spawn.bounty);
      this.toast("农场边来了 " + d.spawn.n + " 只感染者！", "warn");
      d.spawn = null;
    }
    if (RUINS.includes(id) && d.ambush) {
      const p = this.s.player;
      for (let i = 0; i < d.ambush; i++) {
        const q = this.freeSpot(p.x + 220 + i * 30, p.y - 60 + i * 40),
          z = this.enemy("runner", q.x, q.y);
        Object.assign(z, { state: "chase", alert: 6 });
        this.enemies.push(z);
      }
      this.toast("刚进" + this.regionLabel(id) + "就撞见 " + d.ambush + " 只感染者！", "warn");
      d.ambush = 0;
    }
    return ok;
  }
  advanceMinutes(n) {
    if (this.dy && this._travelTo && Number.isFinite(n) && n > 0 && n < 120) {
      const to = this._travelTo;
      this._travelTo = null;
      // 侦察专精、桥修好、己方领地：先按它们的 10 分钟算，再叠这里的加成
      if (this.travelMinuteOverride) {
        n = Math.min(10, n);
        this.travelMinuteOverride = false;
      }
      if (this.buffActive("travel")) n = 1;
      else {
        if (this.hasPerk("truck")) n = Math.ceil(n / 2);
        if (to === "hospital") {
          if (this.hasPerk("road")) n = Math.max(Math.min(n, 5), n - 10);
          n = Math.max(1, n + this.buffValue("detour"));
        }
        n = this.travelBonus(n, to);
      }
    }
    return super.advanceMinutes(n);
  }
  // 后面的层（v0.19 妙手）在这里再减路上的时间
  travelBonus(n) {
    return n;
  }

  // ---------- 场景 ----------
  assignRegion() {
    super.assignRegion();
    const d = this.s.daily;
    if (!d) return;
    for (const c of d.caches) if (c.region === this.s.region && c.day === this.s.day) this.objects.push({ type: "dailyCache", name: "今天的补给点", cacheId: c.id, x: c.x, y: c.y, icon: 40 });
    for (const [chain, c] of Object.entries(d.chains)) if (c.mark && c.mark.region === this.s.region) this.objects.push({ type: "dailyMark", name: CHAINS[chain].name + " · " + c.mark.label, chain, x: c.mark.x, y: c.mark.y, icon: 40 });
  }
  context(ob) {
    if (ob && this.dy && DAILY_OBJECTS.includes(ob.type) && (this._picked || this.pickCandidates().length < 2)) return ob.type === "dailyCache" ? "今天的补给点 · 打开" : ob.name + " · 查看";
    return super.context(ob);
  }
  interact() {
    if (this.paused) return;
    const ob = this._picked || (this.c?.fishing ? null : this.nearestObject());
    if (this.dy && ob && DAILY_OBJECTS.includes(ob.type) && (this._picked || !this.pickCandidates().length)) {
      if (ob.type === "dailyCache") return this.openCache(ob.cacheId);
      return this.visitMark(ob.chain);
    }
    // 补给箱多拿：今天有“拾荒”增益时
    if (this.dy && ob?.type === "crate" && !(this.s.opened[ob.id]?.day === this.s.day) && this.buffValue("loot") > 0) {
      const before = this.s.opened[ob.id]?.day,
        had = {};
      for (const id of Object.keys(ITEMS)) had[id] = this.stockOf(id);
      const r = super.interact();
      if (this.s.opened[ob.id]?.day === this.s.day && before !== this.s.day) {
        // 按这次真正拿到的东西多给三成；钥匙、蓝图这类独一份的东西不翻倍
        const bonus = {};
        for (const id of Object.keys(ITEMS)) {
          const got = this.stockOf(id) - had[id];
          if (got > 0 && !ITEMS[id].protected) bonus[id] = Math.max(1, Math.round(got * this.buffValue("loot")));
        }
        if (Object.keys(bonus).length) {
          this.receive(bonus);
          this.toast("今天运气好，多拿到：" + itemsText(bonus), "gold");
        }
      }
      return r;
    }
    return super.interact();
  }
  openCache(id) {
    const d = this.dy,
      c = d.caches.find((x) => x.id === id);
    if (!c) return false;
    d.caches = d.caches.filter((x) => x !== c);
    if (this.dOnce(c.id)) {
      this.receive(c.items);
      this.toast("今天的补给点：" + itemsText(c.items), "gold");
    }
    this.assignRegion();
    return true;
  }
  visitMark(chain) {
    const c = this.dy.chains[chain];
    if (!c?.mark) return false;
    const label = c.mark.label;
    c.mark = null;
    c.due = this.s.day + 1;
    this.toast("找到了「" + label + "」。明天早上会有下文（" + CHAINS[chain].name + "）。", "gold");
    this.olog(CHAINS[chain].name + "：找到了" + label + "。");
    this.assignRegion();
    return true;
  }
  update(dt, input = {}) {
    const running = !this.paused;
    super.update(dt, input);
    const d = this.dy;
    if (!d || !running || this.paused) return;
    // 赏金：打完今天招来的感染者
    if (d.bounty && this.s.region === "farm" && !this.enemies.some((z) => z.daily && !z.dead)) {
      const b = d.bounty;
      d.bounty = null;
      if (this.dOnce("bounty:" + b.day)) {
        this.receive(b.items);
        this.toast("打退了来犯的感染者：" + itemsText(b.items), "gold");
      }
    }
    // 守夜犬与探子的情报：预警多几秒，每次预警只加一次
    const r = this.o ? this.raidState() : null,
      h = this.s.horde;
    const warn = r?.phase === "warning" || h.phase === "warning";
    if (warn) {
      // 每一次袭击、每一波尸潮只加一次：按袭击日期和已经打过的尸潮数认
      if (r?.phase === "warning" && d.warned.raid !== r.day) {
        d.warned.raid = r.day;
        let add = this.hasPerk("watchDogs") ? 30 : 0;
        const intel = d.flags.raidWarn || 0;
        delete d.flags.raidWarn;
        add += intel;
        if (add) {
          r.timer += add;
          this.toast("提前 " + add + " 秒知道了灰隼团要来：" + (intel ? "探子招的路线对上了。" : "狗群在林边狂吠。"), "warn");
        }
      }
      const wave = this.s.stats.hordes || 0;
      if (h.phase === "warning" && d.warned.horde !== wave) {
        d.warned.horde = wave;
        if (this.hasPerk("watchDogs")) {
          h.timer += 30;
          this.toast("提前 30 秒知道了尸潮要来：狗群在林边狂吠。", "warn");
        }
      }
    }
  }
  static parse(text) {
    const raw = JSON.parse(text),
      s = FarEngine.parse(text);
    if (raw.daily !== undefined) validateDaily(raw.daily);
    return migrateState(s);
  }
}

function validateDaily(x) {
  const object = (v) => v && typeof v === "object" && !Array.isArray(v),
    int = (v, max = 1e9) => Number.isInteger(v) && v >= 0 && v <= max,
    num = (v, a = -1e6, b = 1e9) => Number.isFinite(v) && v >= a && v <= b,
    str = (v, n = 80) => typeof v === "string" && v.length <= n,
    has = (o, k) => typeof k === "string" && Object.hasOwn(o, k),
    bundle = (b) => object(b) && Object.entries(b).every(([k, v]) => has(ITEMS, k) && int(v, 99999)),
    bad = () => {
      throw Error("每日抉择存档异常，请从设置恢复有效备份；原存档会保留。");
    },
    d = defaults();
  if (!object(x) || x.schema !== DAILY_SCHEMA || Object.keys(x).some((k) => !Object.hasOwn(d, k))) bad();
  if (x.seed !== undefined && !int(x.seed, 0xffffffff)) bad();
  const p = x.pending;
  if (p !== undefined && p !== null) {
    if (!object(p) || !int(p.day) || !has(EVENTS, p.id) || !Array.isArray(p.rolls) || p.rolls.length !== 3 || p.rolls.some((r) => !num(r, 0, 1)) || ![1, 1.5, 2].includes(p.tier) || typeof p.luck !== "boolean") bad();
    if (p.choice !== null && !int(p.choice, 2)) bad();
    if (p.win !== null && typeof p.win !== "boolean") bad();
    if (!Array.isArray(p.lines) || p.lines.length > 12 || !p.lines.every((l) => str(l, 160))) bad();
  }
  if (x.history !== undefined && (!Array.isArray(x.history) || x.history.length > 60 || x.history.some((h) => !object(h) || !int(h.day) || !has(EVENTS, h.id) || !Number.isInteger(h.choice) || h.choice < -1 || h.choice > 2 || (h.win !== null && typeof h.win !== "boolean")))) bad();
  if (x.chains !== undefined) {
    if (!object(x.chains) || Object.keys(x.chains).length > MAX_CHAINS + 1) bad();
    for (const [c, v] of Object.entries(x.chains))
      if (!has(CHAINS, c) || !object(v) || !has(EVENTS, v.step) || EVENTS[v.step].chain !== c || (v.tier !== undefined && ![1, 1.5, 2].includes(v.tier)) || (v.due !== null && !int(v.due)) || !Array.isArray(v.flags) || v.flags.length > 8 || !v.flags.every((f) => str(f, 20)) || (v.mark !== null && v.mark !== undefined && (!object(v.mark) || !str(v.mark.region, 20) || !num(v.mark.x, 0, 1536) || !num(v.mark.y, 0, 1024) || !str(v.mark.label, 30))) || (v.mark && v.due !== null)) bad();
  }
  if (x.done !== undefined && (!object(x.done) || Object.entries(x.done).some(([c, v]) => !has(CHAINS, c) || !object(v) || !int(v.day) || (v.ending !== null && !str(v.ending, 40))))) bad();
  if (x.chains && x.done && Object.keys(x.chains).some((c) => x.done[c])) bad();
  if (x.seen !== undefined && (!object(x.seen) || Object.entries(x.seen).some(([id, v]) => !has(EVENTS, id) || !int(v)))) bad();
  if (x.buffs !== undefined && (!Array.isArray(x.buffs) || x.buffs.length > 16 || x.buffs.some((b) => !object(b) || !has(BUFFS, b.kind) || !int(b.from) || !int(b.until) || b.until < b.from || !num(b.value, -1, 100)))) bad();
  if (x.perks !== undefined && (!Array.isArray(x.perks) || x.perks.length > Object.keys(PERKS).length || !x.perks.every((k) => has(PERKS, k)) || new Set(x.perks).size !== x.perks.length)) bad();
  if (x.later !== undefined && (!Array.isArray(x.later) || x.later.length > 20 || x.later.some((l) => !object(l) || !str(l.id) || !int(l.day) || ![0, 8, 18, 23].includes(l.hour) || !bundle(l.items) || !int(l.money, 1e6) || !str(l.text, 120) || !["gift", "debt", "night", "drain"].includes(l.kind)))) bad();
  const f = x.flags;
  if (f !== undefined && (!object(f) || Object.entries(f).some(([k, v]) => (k === "visitBlock" ? !int(v) : !["raidLess", "raidWarn", "caravanDisc", "caravanOrder", "festNext"].includes(k) || !(typeof v === "boolean" || num(v, 0, 100)))))) bad();
  if (x.streak !== undefined && !int(x.streak, 1000)) bad();
  if (x.caches !== undefined && (!Array.isArray(x.caches) || x.caches.length > 6 || x.caches.some((c) => !object(c) || !str(c.id) || !int(c.day) || !has(CACHE_SPOTS, c.region) || !num(c.x, 0, 1536) || !num(c.y, 0, 1024) || !bundle(c.items)))) bad();
  if (x.ambush !== undefined && !int(x.ambush, 6)) bad();
  if (x.spawn !== undefined && x.spawn !== null && (!object(x.spawn) || !int(x.spawn.n, 12) || (x.spawn.bounty !== null && !bundle(x.spawn.bounty)))) bad();
  if (x.bounty !== undefined && x.bounty !== null && (!object(x.bounty) || !bundle(x.bounty.items) || !int(x.bounty.day))) bad();
  if (x.warnKey !== undefined && !int(x.warnKey, 1e12)) bad();
  if (x.warned !== undefined && (!object(x.warned) || Object.keys(x.warned).some((k) => !["raid", "horde"].includes(k)) || Object.values(x.warned).some((v) => !Number.isInteger(v) || v < -1 || v > 1e9))) bad();
  if (x.clear !== undefined && x.clear !== null && (!object(x.clear) || !RUINS.includes(x.clear.region) || !int(x.clear.until))) bad();
  if (x.claimed !== undefined && (!Array.isArray(x.claimed) || x.claimed.length > 300 || !x.claimed.every((c) => str(c)) || new Set(x.claimed).size !== x.claimed.length)) bad();
  if (x.stats !== undefined && (!object(x.stats) || ["cards", "gambles", "wins"].some((k) => x.stats[k] !== undefined && !int(x.stats[k])))) bad();
}

export { CATS, EVENTS, CHAINS, PERKS };
