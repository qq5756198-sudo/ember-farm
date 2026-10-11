// v0.22.0「披挂」：前期感染者加强 + 装备与防具。
// 感染者：三段数值、成群守着能搜的地方、被围时抓人、奔跑者扑人、尖叫叫来新的、重甲冲撞、闻声而来、夜里更凶、残血爬行。
// 人：推开、重击打断、挥击耗体力、挨打后不受伤的时间变短、慢慢回血、抓伤流血、被咬加感染条。
// 装备：头身手腿脚五个防具栏 + 近战、远程、投掷三个武器栏；耐久、修理、改装、图纸。
// 新进度都放在 s.gear，原来的字段不动；装备本身还是背包里的普通物品，穿着的不占背包格子。
import { Engine as GardenEngine, freshState as gardenFresh, migrateState as gardenMigrate } from "./garden.js";
import { ITEMS, WEAPONS, ZOMBIES, REGIONS, WORLD, RECIPES } from "./data.js";
import { keyLabel } from "./farlands-data.js";
import { PRESSURE } from "./echoes-data.js";
import { DISTRICTS } from "./district-data.js";
import { BMAPS } from "./beyond-data.js";
import {
  GEAR_SCHEMA,
  phaseOf,
  PHASE_NAMES,
  ZSTATS,
  SUMMON,
  RULES,
  INFECTION,
  WARMTH,
  WEIGHT_TIERS,
  ARMOR_CAP,
  REPAIR,
  ARMOR_SLOTS,
  GEAR_SLOTS,
  SLOT_NAMES,
  SCRATCH_PARTS,
  GRAB_BITE_PARTS,
  CRAWL_BITE_PARTS,
  ARMOR,
  MELEE,
  RANGED,
  JAM,
  THROWN,
  TRAPS,
  TRAP_IDS,
  MODS,
  MOD_IDS,
  modFits,
  BLUEPRINTS,
  BP_IDS,
  CARAVAN_BPS,
  slotOf,
  gearDef,
  RUIN_PACKS,
  DISTRICT_EXTRA,
  BEYOND_EXTRA,
  GEAR_SPOTS,
  OLD_SAVE_GIFT,
  GRACE_DAYS,
  WEAPON_WHERE,
} from "./gear-data.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " ×" + n)
    .join("、");
const SAFE = ["farm", "market"];
const GRABBERS = ["slow", "runner", "armor", "elite"];
const STAT_KEYS = ["grabs", "escapes", "bites", "shoves", "counters", "interrupts", "crawlers", "stomps", "repairs", "mods", "broken", "trapHits", "lunges", "charges", "summons", "dismantled"];

const gearDefaults = () => ({
  schema: GEAR_SCHEMA,
  slots: Object.fromEntries(GEAR_SLOTS.map((k) => [k, null])),
  trap: "spikeBoard",
  cond: {},
  bp: {},
  found: {},
  traps: [],
  inf: 0,
  fever: false,
  cure: false,
  grace: 0,
  gift: false,
  intro: true,
  old: false,
  raid: 0,
  caravanBp: 0,
  night: {},
  warned: {},
  guards: {},
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
});
const newCond = (id) => {
  const m = gearDef(id)?.dur || 0;
  return { d: m, m, r: 0, mods: {} };
};
// 旧档第一次读进来：武器装进栏位，保温衣穿上，补一副破布护手和布鞋
function equipStart(s, g) {
  const inv = s.inventory;
  for (const id of ["ragGloves", "clothShoes"]) if (!(inv[id] > 0) && !(s.storage?.[id] > 0)) inv[id] = 1;
  const own = (id) => inv[id] > 0;
  g.slots.hands = own("ragGloves") ? "ragGloves" : g.slots.hands;
  g.slots.feet = own("clothShoes") ? "clothShoes" : g.slots.feet;
  if (own("club")) g.slots.melee = "club";
  g.slots.ranged = ["rifle", "shotgun", "pistol"].find(own) || null;
  if (own("warmCoat")) g.slots.body = "warmCoat";
  if (own("stone")) g.slots.throw = "stone";
}

export function migrateState(s) {
  gardenMigrate(s);
  const d = gearDefaults();
  if (!s.gear) {
    // 第一次读进 v0.22.0 的旧档
    s.gear = d;
    s.gear.old = true;
    s.gear.intro = false;
    equipStart(s, s.gear);
    // 原来 5、6、7 格是三把枪，现在 5 是远程栏
    if ([4, 5, 6].includes(s.slot)) s.slot = 4;
    if (s.day > 3) {
      s.gear.grace = s.day + GRACE_DAYS - 1;
      s.gear.gift = true;
      for (const [id, n] of Object.entries(OLD_SAVE_GIFT)) s.storage[id] = (s.storage[id] || 0) + n;
    }
    // 已经偷到（或拿到）的宝贝也补上这一版多出来的东西
    const th = s.theft;
    if (th?.treasures && ["taken", "given"].includes(th.treasures.gunPlans)) for (const bp of ["bp_crossbow", "bp_suppressor"]) s.gear.bp[bp] = s.day;
    const stash = th?.stashes?.find?.((x) => x.id === "ge");
    if (stash?.items && !stash.items.riotHelmet) stash.items.riotHelmet = 1;
    else if (!stash && th?.treasures && ["taken", "given"].includes(th.treasures.armyList)) s.storage.riotHelmet = (s.storage.riotHelmet || 0) + 1;
  } else {
    const x = s.gear;
    s.gear = { ...d, ...x, slots: { ...d.slots, ...x.slots }, stats: { ...d.stats, ...x.stats }, cond: { ...x.cond }, bp: { ...x.bp }, found: { ...x.found }, night: { ...x.night }, warned: { ...x.warned }, guards: { ...x.guards }, traps: [...(x.traps || [])] };
  }
  const g = s.gear;
  // 穿着的东西不在了就卸下；没有了的东西不留耐久记录
  // 穿着的东西不在了就卸下（投掷栏用完了也留着选择，下次捡到接着用）
  for (const k of GEAR_SLOTS) {
    const id = g.slots[k];
    if (id && (slotOf(id) !== k || (k !== "throw" && !(s.inventory[id] > 0)))) g.slots[k] = null;
  }
  // 耐久记录跟着物品种类走；东西可能放在边境储物点之类的地方，读档时不删
  for (const id of Object.keys(g.cond)) if (!gearDef(id)) delete g.cond[id];
  if (!TRAPS[g.trap]) g.trap = "spikeBoard";
  return s;
}
export function freshState() {
  const s = gardenFresh();
  s.gear = gearDefaults();
  equipStart(s, s.gear);
  return migrateState(s);
}

const transient = () => ({ grab: null, down: 0, shoveCd: 0, heal: null, bleed: 0, swing: null, stepClock: 0, fires: [], trapCd: 0, learnClock: 0, crawlWarn: 0 });

export class Engine extends GardenEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this.assignRegion();
  }
  get gr() {
    return this.s.gear;
  }
  get gx() {
    return (this._gx ??= transient());
  }

  // ================= 三段 =================
  // 过了第 3 天的旧档读进来，头 3 天按低一段
  phase() {
    const base = phaseOf(this.s.day);
    return this.gr && this.gr.grace >= this.s.day && base > 0 ? base - 1 : base;
  }
  phaseName() {
    return PHASE_NAMES[this.phase()];
  }
  zstat(type, ph = this.phase()) {
    return ZSTATS[ph]?.[type] || null;
  }
  // 出门在外的感染者按三段的数；农场尸潮和防守战照原来的数（只多了新本事）
  enemy(type, x, y, horde = false) {
    const e = super.enemy(type, x, y, horde),
      st = this.gr && !horde && this.s.region !== "farm" ? this.zstat(type) : null;
    if (st) {
      e.hp = e.maxHp = st.hp;
      e.ph = this.phase();
    }
    return e;
  }
  freePoint(x, y) {
    if (!this.blocked(x, y, true, 18)) return { x, y };
    for (let r = 20; r < 300; r += 20)
      for (let k = 0; k < 16; k++) {
        const a = (k / 16) * Math.PI * 2,
          q = { x: clamp(Math.round(x + Math.cos(a) * r), 80, WORLD.w - 80), y: clamp(Math.round(y + Math.sin(a) * r), 90, WORLD.h - 90) };
        if (!this.blocked(q.x, q.y, true, 18)) return q;
      }
    return { x, y };
  }
  generateEnemies(id) {
    if (!this.gr) return super.generateEnemies(id);
    const ph = this.phase();
    if (RUIN_PACKS[id])
      return RUIN_PACKS[id][ph].map(([type, x, y, pack]) => {
        const q = this.freePoint(x, y),
          z = this.enemy(type, q.x, q.y);
        if (pack) z.pack = id + ":" + pack;
        return z;
      });
    const list = super.generateEnemies(id);
    const extra = DISTRICTS[id] && list.length ? DISTRICT_EXTRA[ph] : BMAPS[id] && list.length ? BEYOND_EXTRA[ph] : null;
    if (!extra) return list;
    extra.forEach(([type, x, y], i) => {
      const q = this.freePoint(x, y),
        z = this.enemy(type, q.x, q.y),
        near = list.filter((o) => !o.pack).sort((a, b) => dist(a, q) - dist(b, q))[0],
        pack = id + ":x" + i;
      z.pack = pack;
      if (near) near.pack = pack;
      list.push(z);
    });
    return list;
  }

  // ================= 栏位与装备 =================
  equipped(slot) {
    return this.gr?.slots[slot] || null;
  }
  wornIds() {
    return [...new Set(GEAR_SLOTS.map((k) => this.gr?.slots[k]).filter(Boolean))];
  }
  isWorn(id) {
    return !!id && GEAR_SLOTS.some((k) => this.gr?.slots[k] === id);
  }
  // 穿着的东西不占背包格子
  capacity() {
    const base = super.capacity();
    if (!this.gr) return base;
    return base + this.wornIds().filter((id) => this.s.inventory[id] === 1).length;
  }
  cond(id) {
    if (!gearDef(id)) return null;
    return (this.gr.cond[id] ??= newCond(id));
  }
  baseMax(id) {
    const c = this.gr.cond[id],
      dur = gearDef(id)?.dur || 0;
    return Math.round(dur * (c?.mods?.wrap ? 1.4 : 1));
  }
  broken(id) {
    const def = gearDef(id);
    if (!def?.dur) return false;
    return this.cond(id).d <= 0;
  }
  condRatio(id) {
    const def = gearDef(id);
    if (!def?.dur) return 1;
    const c = this.cond(id);
    return c.m > 0 ? c.d / c.m : 0;
  }
  equipReason(id) {
    const slot = slotOf(id);
    if (!slot && !TRAPS[id]) return "这件不能穿戴";
    if (!(this.qty(id) > 0)) return "要先放在背包里";
    if (TRAPS[id]) return this.gr.trap === id ? "已经选中了" : "";
    if (this.gr.slots[slot] === id) return "已经穿着了";
    return "";
  }
  equip(id) {
    const reason = this.equipReason(id);
    if (reason) {
      this.toast(reason, "warn");
      return false;
    }
    if (TRAPS[id]) {
      this.gr.trap = id;
      this.toast("快捷栏 7 换成" + ITEMS[id].name + "：选中后点地面摆下");
      return true;
    }
    const slot = slotOf(id),
      old = this.gr.slots[slot];
    this.gr.slots[slot] = id;
    if (gearDef(id)?.dur) this.cond(id);
    this.toast((ARMOR[id] ? "穿上 " : "拿上 ") + ITEMS[id].name + (old ? "（换下" + ITEMS[old].name + "）" : "") + (this.broken(id) ? " · 它是坏的，回农场修" : ""));
    if (slot === "melee") this.s.slot = 3;
    else if (slot === "ranged") this.s.slot = 4;
    this.emit("craft");
    return true;
  }
  unequipReason(slot) {
    const id = this.gr.slots[slot];
    if (!id) return "这一栏是空的";
    if ((this.s.inventory[id] || 0) > 1 || ITEMS[id]?.protected) return "";
    // 卸下来要占一格：背包满了就放仓库，在外面就卸不了
    const present = new Set(Object.keys(this.s.inventory).filter((k) => this.s.inventory[k] > 0));
    const after = super.capacity() + this.wornIds().filter((x) => x !== id && this.s.inventory[x] === 1).length;
    if (present.size <= after) return "";
    return this.s.region === "farm" ? "" : "背包满了，回农场再换（会放进仓库）";
  }
  unequip(slot) {
    const id = this.gr.slots[slot],
      reason = this.unequipReason(slot);
    if (reason) {
      this.toast(reason, "warn");
      return false;
    }
    this.gr.slots[slot] = null;
    if (!ITEMS[id]?.protected && (this.s.inventory[id] || 0) <= 1 && !this.canAdd({}) && this.s.region === "farm") {
      this.s.inventory[id]--;
      if (!this.s.inventory[id]) delete this.s.inventory[id];
      this.putStorage({ [id]: 1 });
      this.toast("卸下" + ITEMS[id].name + "：背包满了，放进了仓库");
    } else this.toast("卸下" + ITEMS[id].name);
    return true;
  }
  // 新拿到的装备：那一栏空着就直接穿上、拿上
  add(bundle, ...rest) {
    const ok = super.add(bundle, ...rest);
    if (ok && this.gr) for (const id of Object.keys(bundle || {})) this.autoWear(id);
    return ok;
  }
  autoWear(id) {
    const slot = slotOf(id),
      cur = slot ? this.gr.slots[slot] : null;
    if (!slot || (cur && cur !== id && this.s.inventory[cur] > 0) || cur === id || !(this.s.inventory[id] > 0)) return false;
    this.gr.slots[slot] = id;
    if (gearDef(id)?.dur) this.cond(id);
    if (slot !== "throw") this.toast((ARMOR[id] ? "穿上了" : "拿上了") + ITEMS[id].name + "（" + SLOT_NAMES[slot] + "栏原来是空的）");
    return true;
  }
  // 穿在身上的那一件不会被存进仓库、卖掉（多出来的可以）
  transfer(id, toStorage = true, all = false) {
    if (!this.gr || !toStorage || !this.isWorn(id)) return super.transfer(id, toStorage, all);
    const have = this.s.inventory[id] || 0;
    if (have <= 1) {
      if (!this._bulk) this.toast(ITEMS[id].name + "穿在身上，先在行囊里卸下再存。", "warn");
      return false;
    }
    const n = all ? have - 1 : 1;
    this.s.inventory[id] -= n;
    this.s.storage[id] = (this.s.storage[id] || 0) + n;
    if (!this._bulk) this.toast("存入 " + ITEMS[id].name + " ×" + n + "（身上那件留着）");
    return true;
  }
  depositAll() {
    this._bulk = true;
    try {
      return super.depositAll();
    } finally {
      this._bulk = false;
    }
  }
  trade(trader, id, n, direction) {
    if (this.gr && direction === "sell" && this.isWorn(id) && Number.isInteger(n) && (this.s.inventory[id] || 0) - n < 1) {
      this.toast(ITEMS[id].name + "穿在身上，先卸下再卖。", "warn");
      return false;
    }
    const ok = super.trade(trader, id, n, direction);
    if (ok && direction === "sell") this.forgetIfGone(id);
    return ok;
  }
  // 边境储物点：穿着的那一件留在身上
  btransfer(id, toStore, n = 99) {
    if (!this.gr || !toStore || !this.isWorn(id)) return super.btransfer(id, toStore, n);
    const spare = (this.s.inventory[id] || 0) - 1;
    if (spare < 1) {
      this.toast(ITEMS[id].name + "穿在身上，先在行囊里卸下再存。", "warn");
      return false;
    }
    return super.btransfer(id, toStore, Math.min(n, spare));
  }
  // 做东西用掉了最后一件装备（比如铁管 + 菜刀做铁头矛）：它的耐久记录也清掉，下一件是新的
  craft(id, ...rest) {
    const r = RECIPES.find((x) => x.id === id),
      used = r ? Object.keys(r.cost).filter((k) => gearDef(k)) : [];
    const ok = super.craft(id, ...rest);
    if (ok) for (const k of used) this.forgetIfGone(k);
    return ok;
  }
  forgetIfGone(id) {
    if (!this.gr || (this.s.inventory[id] || 0) + (this.s.storage[id] || 0) > 0) return;
    delete this.gr.cond[id];
    for (const k of GEAR_SLOTS) if (k !== "throw" && this.gr.slots[k] === id) this.gr.slots[k] = null;
  }
  // 物品详情的“来源”
  sourceFor(id) {
    if (this.gr) {
      const where = ARMOR[id]?.where || WEAPON_WHERE[id] || BLUEPRINTS[id]?.where;
      if (where) return { text: where, where: RECIPES.some((r) => r.out[id]) ? "craft:" : "map:" };
    }
    return super.sourceFor(id);
  }
  // 身上一共多少护甲、多重、多吵、多暖；伤口落在哪一处时防抓、防咬各多少
  armorTotals() {
    const t = { armor: 0, weight: 0, noise: 0, warmth: 0, scratch: { body: 0, hands: 0 }, bite: { head: 0, body: 0, hands: 0, legs: 0, feet: 0 }, light: false, down: 1, runCost: 1, stomp: 1, pieces: [] };
    if (!this.gr) return { ...t, tier: WEIGHT_TIERS[0] };
    for (const slot of ARMOR_SLOTS) {
      const id = this.gr.slots[slot],
        a = ARMOR[id];
      if (!a) continue;
      const c = this.cond(id),
        mods = c.mods || {},
        broke = a.dur > 0 && c.d <= 0;
      t.weight += a.weight + (mods.plate ? 1 : 0);
      t.noise += (a.noise || 0) - (mods.quiet ? 1 : 0);
      t.warmth += a.warmth || 0;
      if (a.light) t.light = true;
      t.pieces.push(id);
      if (broke) continue;
      t.armor += (a.armor || 0) + (mods.plate ? 0.06 : 0);
      if (SCRATCH_PARTS.includes(slot)) t.scratch[slot] = Math.min(95, (a.scratch || 0) + (mods.padding ? 15 : 0));
      t.bite[slot] = a.bite || 0;
      if (a.down) t.down *= a.down;
      if (a.runCost) t.runCost *= a.runCost;
      if (a.stomp) t.stomp *= a.stomp;
    }
    t.armor = Math.min(ARMOR_CAP, t.armor);
    t.weight = Math.round(t.weight * 10) / 10;
    t.tier = WEIGHT_TIERS.find((x) => t.weight < x.max) || WEIGHT_TIERS[2];
    return t;
  }
  warmth() {
    return this.armorTotals().warmth;
  }
  warmthTier(w = this.warmth()) {
    return WARMTH.find((x) => w >= x.min) || WARMTH[WARMTH.length - 1];
  }
  // 戴着头灯，或带着手电又没蹲下（蹲下时把手电藏起来）
  playerLit() {
    return this.armorTotals().light || (!!this.qty("flashlight") && !this.f?.crouch);
  }
  maxHp() {
    return this.gr?.fever ? INFECTION.feverHp : 100;
  }

  // ================= 快捷栏 =================
  // 1 锄头 2 水壶 3 种子 4 近战栏 5 远程栏 6 投掷栏 7 陷阱 8 干粮 9 绷带 0 建造
  hotbarSlots() {
    if (!this.gr) return ["hoe", "water", this.s.seed, "club", "pistol", "shotgun", "rifle", "bread", "bandage", "build"];
    const g = this.gr.slots,
      trap = this.qty(this.gr.trap) ? this.gr.trap : TRAP_IDS.find((id) => this.qty(id)) || "";
    return ["hoe", "water", this.s.seed, g.melee || "", g.ranged || "", g.throw || "", trap, "bread", "bandage", "build"];
  }
  currentItem() {
    return this.hotbarSlots()[this.s.slot] ?? "";
  }
  // 远程栏：再按一次 5 换背包里的下一把（弹弓、弩、手枪、霰弹枪、步枪）
  cycleRanged() {
    if (!this.gr) return false;
    const order = ["slingshot", "crossbow", "pistol", "shotgun", "rifle"].filter((id) => this.qty(id) > 0);
    if (!order.length) {
      this.toast(this.slotEmptyText(4), "warn");
      return false;
    }
    const cur = this.gr.slots.ranged,
      next = order[(order.indexOf(cur) + 1) % order.length];
    if (next === cur) {
      this.toast("背包里只有这一把远程武器");
      return false;
    }
    this.gr.slots.ranged = next;
    this.cond(next);
    this.reload = null;
    this.toast("远程栏换成" + ITEMS[next].name);
    return true;
  }
  slotEmptyText(slot) {
    return ["", "", "", "近战栏是空的：在背包（Tab）里拿上一件近战武器", "远程栏是空的：在背包里拿上弹弓、弩或枪", "投掷栏是空的：在背包里选诱敌石、鞭炮或燃烧瓶", "没有陷阱：在武器台做捕兽夹，或随身做钉板", "", "", ""][slot] || "这一格是空的";
  }
  use(target) {
    if (this.paused) return false;
    if (this.buildMode || !this.gr) return super.use(target);
    const slot = this.s.slot;
    if (slot >= 3 && slot <= 6) {
      const id = this.currentItem();
      if (!id) {
        if (!this.gx.emptyNote || this.gx.emptyNote < (this.s.playSeconds || 0)) {
          this.gx.emptyNote = (this.s.playSeconds || 0) + 1.5;
          this.toast(this.slotEmptyText(slot), "warn");
        }
        return false;
      }
      if (slot === 5) return this.throwItem(target);
      if (slot === 6) return this.placeTrap(target);
      return this.attack(target);
    }
    return super.use(target);
  }

  // ================= 武器的数 =================
  meleeStats(id) {
    const def = MELEE[id];
    if (!def) return null;
    const c = this.cond(id),
      mods = c.mods || {},
      w = { ...def };
    if (id === "crowbar") w.dmg += def.perLevel * Math.max(0, (this.c?.toolLevel || 1) - 1);
    if (mods.nails) {
      w.dmg += 8;
      w.bleed = Math.max(w.bleed || 0, 0.3);
    }
    if (mods.handle) {
      w.range += 15;
      w.cd *= 1.1;
    }
    if (mods.weight) {
      w.knock *= 1.5;
      w.stamina += 2;
    }
    if (mods.edge > 0) w.dmg *= 1.15;
    if (this.spec?.("combat", "melee")) {
      w.dmg *= 1.35;
      w.stamina = Math.max(1, w.stamina - 2);
    }
    if (this.hasTalent?.("finisher")) w.dmg *= 1.25;
    w.dmg *= 1 + 0.05 * (this.level("combat") - 1);
    if (def.dur && c.d <= 0) w.dmg *= 0.5;
    return w;
  }
  weaponStats(id) {
    const w = super.weaponStats(id);
    if (!w || !this.gr) return w;
    const r = RANGED[id];
    if (r?.gun) {
      const c = this.cond(id);
      let out = w;
      if (c.mods?.diySuppressor > 0) out = { ...out, noise: out.noise * 0.45, damage: out.damage * 0.9 };
      if (c.d <= 0) out = { ...out, damage: out.damage * 0.5 };
      return out;
    }
    return w;
  }
  // 子弹、箭打中时用：这把枪的破甲、击退
  shotInfo(meta) {
    const r = RANGED[meta?.id];
    if (!r) return null;
    return { id: meta.id, kind: "ranged", pierce: r.pierce, knock: r.knock, stiff: r.stiff || 0, interrupt: meta.id === "slingshot" };
  }

  // ================= 攻击 =================
  attack(target) {
    if (this.paused) return false;
    const id = this.currentItem();
    if (!this.gr) return super.attack(target);
    if (this.gx.grab || this.gx.down > 0) return false;
    if (MELEE[id]) return this.meleeSwing(target, id);
    if (id === "slingshot" || id === "crossbow") return this.bowShot(target, id);
    if (RANGED[id]?.gun) {
      const w = this.weaponStats(id);
      if (this.qty(id) && this.cooldown <= 0 && !this.reload && w && this.s.magazines[id] > 0 && this.condRatio(id) < JAM.below && Math.random() < JAM.chance) {
        this.cooldown = Math.max(this.cooldown, JAM.time);
        this.toast(ITEMS[id].name + "卡壳了，多花 1 秒排障。耐久太低，回农场修。", "warn");
        return false;
      }
      const ok = super.attack(target);
      if (ok) {
        this.wear(id, 1);
        const c = this.cond(id);
        if (c.mods?.diySuppressor > 0) {
          c.mods.diySuppressor--;
          if (!c.mods.diySuppressor) {
            delete c.mods.diySuppressor;
            this.toast("自制消音器用完了", "warn");
          }
        }
      }
      return ok;
    }
    return super.attack(target);
  }
  meleeSwing(target, id) {
    if (!this.qty(id) || this.cooldown > 0) return false;
    const r = this.f?.route;
    if (r && !r.supplies?.[id]) {
      this.toast("本次远征只能使用装入行囊的武器。", "warn");
      return false;
    }
    const w = this.meleeStats(id),
      p = this.s.player,
      a = Math.atan2(target.y - (p.y - 20), target.x - p.x);
    p.facing = a;
    const tired = p.stamina < RULES.tired.below;
    this.cooldown = w.cd * (tired ? RULES.tired.mul : 1);
    this.actionAnim = 0.2;
    this.gx.swing = { t: 0.24, id, a };
    p.stamina = Math.max(0, p.stamina - w.stamina);
    this.noise.push({ x: p.x, y: p.y, r: w.noise, t: 1.8 });
    const targets = this.enemies
      .filter((z) => !z.dead && dist(z, p) < w.range + (z.nest ? 30 : 0) && (angDiff(Math.atan2(z.y - p.y, z.x - p.x), a) < w.arc || dist(z, p) < 26))
      .sort((x, y) => dist(x, p) - dist(y, p));
    let hits = 0,
      wearN = 0;
    for (const z of targets) {
      if (w.maxHits && hits >= w.maxHits) break;
      this.meleeHit(z, w, id, a);
      hits++;
      // 利器砍重甲掉 2
      wearN = Math.max(wearN, z.type === "armor" && w.kind === "blade" ? 2 : 1);
    }
    if (hits) {
      this.wear(id, wearN);
      const c = this.cond(id);
      if (c.mods?.edge > 0) {
        c.mods.edge--;
        if (!c.mods.edge) {
          delete c.mods.edge;
          this.toast("刃口钝了：回武器台再磨", "warn");
        }
      }
    }
    if (this.f) this.f.crouch = false;
    this.emit("swing");
    return true;
  }
  meleeHit(z, w, id, a) {
    let dmg = w.dmg;
    // 菜刀：没被发现时从背后下手
    if (w.sneak && z.state !== "chase" && angDiff(a, z.facing ?? 0) < 1.0) dmg *= w.sneak;
    // 摔成爬行者：钝器 30%，砍刀 40%（砍腿），别的不会
    this._hit = { id, kind: w.kind, pierce: w.pierce, knock: w.knock, bleed: w.bleed || 0, down: w.down || 0, crawl: id === "machete" ? RULES.crawl.blade : w.kind === "blunt" ? RULES.crawl.chance : 0 };
    try {
      this.hurtEnemy(z, dmg, a);
    } finally {
      this._hit = null;
    }
    if (!z.dead && !z.nest) {
      const push = Math.max(0, w.knock - 9) * (z.type === "elite" ? 0.3 : z.type === "armor" ? 0.6 : 1);
      if (push) this.moveEntity(z, Math.cos(a) * push, Math.sin(a) * push, true);
    }
  }
  bowShot(target, id) {
    const def = RANGED[id];
    if (!this.qty(id) || this.cooldown > 0) return false;
    const r = this.f?.route;
    if (r && !r.supplies?.[id]) {
      this.toast("本次远征只能使用装入行囊的武器。", "warn");
      return false;
    }
    if (!this.qty(def.ammo)) {
      this.toast(id === "crossbow" ? "没有箭了：木材 1 能削 4 支（随身制作）" : "没有石材当弹子了", "warn");
      return false;
    }
    const p = this.s.player,
      oy = p.y - 26,
      a = Math.atan2(target.y - oy, target.x - p.x);
    p.facing = a;
    const tired = p.stamina < RULES.tired.below;
    this.cooldown = def.cd * (tired ? RULES.tired.mul : 1);
    this.actionAnim = 0.2;
    p.stamina = Math.max(0, p.stamina - def.stamina);
    // 箭七成能捡回：只扣三成
    if (!def.keep || Math.random() > def.keep) {
      this.s.inventory[def.ammo]--;
      if (!this.s.inventory[def.ammo]) delete this.s.inventory[def.ammo];
    }
    let dmg = def.dmg * (1 + 0.05 * (this.level("combat") - 1));
    if (this.broken(id)) dmg *= 0.5;
    this.bullets.push({ x: p.x + Math.cos(a) * 18, y: oy + Math.sin(a) * 18, originX: p.x, originY: oy, vx: Math.cos(a) * def.speed, vy: Math.sin(a) * def.speed, life: def.range / def.speed, damage: dmg, angle: a, id, bow: true });
    this.noise.push({ x: p.x, y: p.y, r: def.noise, t: 1 });
    this.wear(id, 1);
    if (this.f) this.f.crouch = false;
    this.emit("swing");
    return true;
  }

  // ================= 打中感染者 =================
  hurtEnemy(e, damage, angle, meta = {}) {
    if (!this.gr || e.dead || e.nest || e.type === "raider") {
      if (e.type === "raider" && !e.dead && this.gr) {
        // 灰隼团穿防弹背心：子弹 ×0.7（步枪不减），正面近战 ×0.7，背后近战不减
        const shot = meta?.id && WEAPONS[meta.id]?.mag;
        if (shot && meta.id !== "rifle") damage *= 0.7;
        else if (!shot && this._hit && angDiff(angle + Math.PI, e.facing ?? 0) < 1.3) damage *= 0.7;
      }
      return super.hurtEnemy(e, damage, angle, meta);
    }
    const h = this._hit || (meta?.id ? this.shotInfo(meta) : null);
    let n = damage;
    if (e.lunge?.phase === "stumble" || e.stunned || e.stunT > 0) n *= RULES.weakHit;
    if (e.type === "armor") {
      const front = angDiff(angle + Math.PI, e.facing ?? 0) < 1.1,
        pierce = h?.pierce ?? 0.65;
      // 原来的规则会在正面再乘 0.65，这里先换算成这把武器的破甲；背后多 30%
      n *= front ? pierce / 0.65 : RULES.backArmor;
    }
    // 预兆时打中就打断：尖叫者叫不出来；重击（击退 30 以上）、弹弓、石头打断出手
    let cut = false;
    if (e.type === "screamer" && e.windup > 0) {
      e.windup = 0;
      e.cooldown = 2.5;
      cut = true;
    } else if (e.windup > 0 && ((h?.knock || 0) >= RULES.knockInterrupt || h?.interrupt)) {
      e.windup = 0;
      e.cooldown = Math.max(e.cooldown, 0.6);
      cut = true;
    }
    if (h?.interrupt) {
      if (e.lunge?.phase === "crouch") e.lunge = { phase: "stumble", t: 0.6 };
      if (e.charge?.phase === "stomp") {
        e.charge = null;
        e.ccd = 2;
      }
    }
    if (cut) {
      this.gr.stats.interrupts++;
      this.xp("combat", 1);
      this.effects.push({ x: e.x, y: e.y - 70, text: "打断！", t: 0.7, color: "#ffdb8c" });
    }
    if (h?.stiff && e.type === "runner") e.stagger = Math.max(e.stagger || 0, h.stiff);
    const alive = !e.dead;
    super.hurtEnemy(e, n, angle, meta);
    if (!alive || e.dead) return;
    if (h?.down) e.stunT = Math.max(e.stunT || 0, h.down);
    if (h?.bleed && Math.random() < h.bleed) e.bleedT = 3;
    // 残血爬行：游荡者、奔跑者血不到三成时，被钝器（砍刀更容易）打中有机会摔成爬行者
    if (!e.crawl && ["slow", "runner"].includes(e.type) && e.hp < e.maxHp * RULES.crawl.below && h?.crawl && Math.random() < h.crawl) {
      e.crawl = true;
      e.windup = 0;
      e.lunge = null;
      e.reach = 0;
      e.cooldown = 1;
      this.gr.stats.crawlers++;
      this.effects.push({ x: e.x, y: e.y - 40, text: "摔成爬行者", t: 0.8, color: "#e6c48a" });
      this.tip("crawl", "它摔成了爬行者，会咬脚：走过去按 " + this.keyName("interact", "E") + " 踩它。");
    }
  }

  // 流血、火烧：只掉血，不推开、不冒字、不惊动它；最后一下按正常的打死（掉落、计数照旧）
  dotHurt(e, n) {
    if (e.dead || !(n > 0)) return;
    if (e.hp > n) {
      e.hp -= n;
      return;
    }
    this._hit = { kind: "dot", pierce: 1, knock: 0 };
    try {
      this.hurtEnemy(e, e.hp + 1, e.facing ?? 0);
    } finally {
      this._hit = null;
    }
  }

  // ================= 挨打 =================
  damagePlayer(n, opts = {}) {
    if (!this.gr) return super.damagePlayer(n);
    if (this.invulnerable > 0) return;
    const z = opts.from || this._zAtk || null,
      st = z && !opts.eff && GRABBERS.includes(z.type) && z.ph != null ? this.zstat(z.type, z.ph) : null;
    let eff = opts.eff != null ? opts.eff : st ? st.damage : n * PRESSURE.damage;
    const T = this.armorTotals();
    eff *= 1 - T.armor;
    const g = this.gx.grab;
    if (g && z && z !== g.z) eff *= RULES.grab.others;
    const p = this.s.player,
      before = p.hp;
    super.damagePlayer(eff / PRESSURE.damage);
    if (p.hp >= before || this.paused) return;
    this.invulnerable = Math.min(this.invulnerable, RULES.iframe);
    // 防具挨一下掉 1
    for (const id of T.pieces) this.wear(id, 1);
    // 抓伤：普通挨打 35% 流血，伤口一半在身上、一半在手上
    if (!opts.noBleed) {
      const part = SCRATCH_PARTS[Math.random() < 0.5 ? 0 : 1];
      if (Math.random() < RULES.bleed.chance * (1 - T.scratch[part] / 100)) {
        if (!(this.gx.bleed > 0)) this.toast("被抓破了，在流血：用绷带止住（9 号快捷栏）", "warn");
        this.gx.bleed = RULES.bleed.time;
      }
    }
    if (opts.down) this.gx.down = Math.max(this.gx.down, opts.down * T.down);
    // 被围时、或从背后打中：有四成机会变成抓住
    if (z && !opts.eff && !g && GRABBERS.includes(z.type) && !z.dead) {
      const around = this.enemies.some((o) => o !== z && !o.dead && !o.nest && !o.crawl && dist(o, p) < RULES.grab.around),
        behind = angDiff(Math.atan2(z.y - p.y, z.x - p.x), p.facing ?? 0) > RULES.grab.behind;
      if ((around || behind) && Math.random() < RULES.grab.chance) this.startGrab(z);
    }
  }
  // 第一次碰到某样新东西时提示一句（每样只说一次，记在存档里）
  tip(key, text) {
    if (!this.gr || this.gr.warned[key]) return;
    this.gr.warned[key] = this.s.day;
    this.toast(text, "warn");
  }
  startGrab(z) {
    const time = RULES.grab.time * (this.hasTalent?.("toughBone") ? RULES.grab.toughBone : 1);
    this.gx.grab = { z, t: time, max: time, escape: 0 };
    z.holding = true;
    z.windup = 0;
    z.cooldown = time + 0.3;
    this.gr.stats.grabs++;
    this.reload = null;
    this.emit("hit");
    this.tip("grab", "被抓住了！按 " + this.keyName("shove", "X") + " 推开，或连按 " + this.keyName("interact", "E") + " 挣开，不然会被咬一口。");
  }
  releaseGrab(escaped) {
    const g = this.gx.grab;
    if (!g) return;
    if (g.z) {
      g.z.holding = false;
      g.z.cooldown = Math.max(g.z.cooldown || 0, 1);
    }
    this.gx.grab = null;
    if (escaped) {
      this.gr.stats.escapes++;
      this.xp("combat", 1);
    }
  }
  keyName(action, fallback) {
    return keyLabel(this.s.settings, action) || fallback;
  }
  // 被抓住时按交互键挣：按满 3 下挣开
  mash() {
    const g = this.gx.grab;
    if (!g) return false;
    g.escape += RULES.grab.mash;
    if (g.escape >= 1 - 1e-9) {
      this.releaseGrab(true);
      this.toast("挣开了！");
    }
    return true;
  }
  biteFrom(z, parts, extra = {}) {
    const T = this.armorTotals(),
      part = parts[Math.floor(Math.random() * parts.length)],
      block = (T.bite[part] || 0) / 100;
    const name = SLOT_NAMES[part];
    if (Math.random() < block) {
      const id = this.gr.slots[part];
      if (id) this.wear(id, 2);
      this.effects.push({ x: this.s.player.x, y: this.s.player.y - 80, text: "咬在" + (ITEMS[id]?.name || name) + "上", t: 0.9, color: "#cfe2c4" });
      return false;
    }
    this.invulnerable = 0;
    this.damagePlayer(0, { eff: extra.damage ?? RULES.grab.bite, from: z, noBleed: true });
    this.infect(INFECTION.bite, name);
    this.gr.stats.bites++;
    this.emit("bite");
    return true;
  }
  infect(n, where = "") {
    const g = this.gr,
      was = g.inf;
    g.inf = clamp(g.inf + n, 0, 100);
    if (g.inf >= 100 && !g.fever) {
      g.fever = true;
      g.cure = false;
      this.toast("伤口感染发烧了：生命上限 −30、体力恢复减半。吃一份药包，再睡一晚就退烧。", "warn");
    } else if (g.inf > was) this.toast((where ? where + "被咬了" : "被咬了") + "：感染 " + Math.round(g.inf) + "%（每睡一晚降 20%）", "warn");
  }
  shove() {
    if (this.paused || !this.gr || this.gx.down > 0 || this.gx.shoveCd > 0) return false;
    const p = this.s.player,
      R = RULES.shove;
    if (p.stamina < R.cost) {
      this.toast("体力不够，推不动", "warn");
      return false;
    }
    this.gx.shoveCd = R.cd;
    p.stamina -= R.cost;
    this.actionAnim = 0.2;
    this.gx.swing = { t: 0.2, id: "shove", a: p.facing };
    const g = this.gx.grab;
    let hit = 0;
    for (const z of this.enemies) {
      if (z.dead || z.nest || z.type === "raider") continue;
      const d = dist(z, p);
      if (d < R.range && (g?.z === z || angDiff(Math.atan2(z.y - p.y, z.x - p.x), p.facing ?? 0) < R.arc || d < 40)) {
        const a = Math.atan2(z.y - p.y, z.x - p.x),
          push = R.push * (z.type === "elite" ? 0.35 : z.type === "armor" ? 0.6 : 1);
        this.moveEntity(z, Math.cos(a) * push, Math.sin(a) * push, true);
        if (z.windup > 0) this.gr.stats.interrupts++;
        z.windup = 0;
        z.stagger = R.stagger;
        z.cooldown = Math.max(z.cooldown || 0, 0.5);
        if (z.lunge && z.lunge.phase !== "stumble") z.lunge = null;
        if (z.charge?.phase === "stomp") {
          z.charge = null;
          z.ccd = 2;
        }
        hit++;
      }
    }
    if (g) {
      this.releaseGrab(true);
      this.toast("推开了！");
    }
    if (hit) {
      this.gr.stats.shoves++;
      this.xp("combat", 1);
    }
    this.noise.push({ x: p.x, y: p.y, r: 60, t: 1 });
    this.emit("shove");
    return true;
  }

  // ================= 感染者每帧 =================
  updateEnemy(e, dt) {
    if (!this.gr || e.dead || e.nest || e.type === "raider") return super.updateEnemy(e, dt);
    const p = this.s.player;
    e.stagger = Math.max(0, (e.stagger || 0) - dt);
    e.stunT = Math.max(0, (e.stunT || 0) - dt);
    e.trapHeld = Math.max(0, (e.trapHeld || 0) - dt);
    e.slowT = Math.max(0, (e.slowT || 0) - dt);
    if (e.bleedT > 0) {
      // 钉子打出的血：每秒 3，3 秒
      e.bleedT -= dt;
      this.dotHurt(e, 3 * dt);
      if (e.dead) return;
    }
    if (e.stagger > 0 || e.stunT > 0 || e.trapHeld > 0) {
      e.flash = Math.max(0, (e.flash || 0) - dt);
      e.cooldown = Math.max(e.cooldown || 0, 0.2);
      if (e.trapHeld > 0 && e.windup > 0) e.windup = 0;
      return;
    }
    const g = this.gx.grab;
    if (g?.z === e) {
      e.facing = Math.atan2(p.y - e.y, p.x - e.x);
      e.flash = Math.max(0, (e.flash || 0) - dt);
      return;
    }
    if (e.crawl) return this.updateCrawler(e, dt);
    if (e.type === "runner" && this.updateLunge(e, dt)) return;
    if (e.type === "armor" && this.updateCharge(e, dt)) return;
    if (e.turnT > 0) {
      e.turnT -= dt;
      e.facing = Math.atan2(p.y - e.y, p.x - e.x);
      if (e.turnT <= 0) {
        e.state = "chase";
        e.alert = 8;
        e.targetX = p.x;
        e.targetY = p.y;
      }
      return;
    }
    const wasWind = e.windup > 0,
      wasChase = e.state === "chase";
    this._zAtk = e;
    try {
      super.updateEnemy(e, dt);
    } finally {
      this._zAtk = null;
    }
    if (e.dead) return;
    if (e.type === "screamer" && wasWind && !(e.windup > 0)) this.summonFor(e);
    if (!wasChase && e.state === "chase" && e.pack) this.alertPack(e);
    // 听见声音过来看：头上冒“？”，到声音那里找 6 秒；看见人了就不算
    if (e.state === "chase") {
      const byNoise = dist({ x: e.targetX, y: e.targetY }, p) > 40;
      e.heard = byNoise ? 1 : 0;
      if (byNoise) e.alert = Math.min(e.alert, 6);
    } else e.heard = 0;
    // 夜里在外面追人：快 25%（原来的规则已经快了 15%）
    if (e.state === "chase" && this.isNight?.() && !SAFE.includes(this.s.region) && !this.spec?.("exploration", "scout")) {
      const extra = this.enemySpeed(e) * RULES.night.chase - ZOMBIES[e.type].speed * 0.15,
        a = e.facing ?? 0;
      if (extra > 0) this.moveEntity(e, Math.cos(a) * extra * dt, Math.sin(a) * extra * dt, true);
    }
  }
  enemySpeed(e) {
    const base = super.enemySpeed(e);
    if (!this.gr || e.type === "raider") return base;
    if (e.crawl) return RULES.crawl.speed;
    if (e.trapHeld > 0) return 0;
    const st = e.ph != null ? this.zstat(e.type, e.ph) : null,
      k = st && ZOMBIES[e.type] ? st.speed / (ZOMBIES[e.type].speed * PRESSURE.enemySpeed) : 1;
    return base * k * (e.slowT > 0 ? 0.5 : 1);
  }
  // 夜里看得没那么远，但听得更远；开着手电或头灯时从远处就看得见你
  enemySenses(e, dt) {
    const r = super.enemySenses(e, dt);
    if (!this.gr || !this.isNight?.() || SAFE.includes(this.s.region)) return r;
    const p = this.s.player,
      d = dist(e, p),
      lit = this.playerLit();
    if (r) {
      // 听见的照常过去；只是看见的，夜里看不远（没开灯时 170）
      if (this.noise.some((n) => dist(e, n) < n.r)) return r;
      if (!lit && d > RULES.night.sight && !(e.alert > 0)) return null;
      return r;
    }
    // 开着灯：260 以内、中间没挡着就看得见你
    if (lit && d < RULES.night.light && this.lineClear(e, p)) return { x: p.x, y: p.y };
    // 夜里听得更远（×1.5）
    const n = this.noise.find((n) => dist(e, n) < n.r * RULES.night.hear);
    return n ? { x: n.x, y: n.y } : null;
  }
  alertPack(e) {
    const p = this.s.player;
    for (const o of this.enemies)
      if (o !== e && !o.dead && o.pack === e.pack && o.state !== "chase" && !(o.turnT > 0) && dist(o, e) < RULES.pack.radius) {
        o.turnT = RULES.pack.turn;
        o.facing = Math.atan2(p.y - o.y, p.x - o.x);
      }
  }
  updateLunge(e, dt) {
    const R = RULES.lunge,
      p = this.s.player,
      L = e.lunge;
    e.lcd = Math.max(0, (e.lcd || 0) - dt);
    e.flash = Math.max(0, (e.flash || 0) - dt);
    if (L) {
      L.t -= dt;
      if (L.phase === "crouch") {
        if (L.t <= 0) Object.assign(L, { phase: "leap", t: R.time });
        return true;
      }
      if (L.phase === "leap") {
        const step = (R.dist / R.time) * dt;
        this.moveEntity(e, Math.cos(L.a) * step, Math.sin(L.a) * step, true);
        e.facing = L.a;
        // 拿矛正面顶住：扑到矛尖上受双倍伤害，摔在地上
        const w = MELEE[this.gr.slots.melee] ? this.meleeStats(this.gr.slots.melee) : null;
        if (!L.hit && w?.brace && this.qty(this.gr.slots.melee) && this.s.slot === 3 && !this.gx.grab && !(this.gx.down > 0) && this.cooldown <= 0.05 && dist(e, p) < w.range + 10 && angDiff(Math.atan2(e.y - p.y, e.x - p.x), p.facing ?? 0) < 0.7) {
          const a = Math.atan2(e.y - p.y, e.x - p.x);
          this._hit = { id: this.gr.slots.melee, kind: "pole", pierce: w.pierce, knock: w.knock, crawl: 0 };
          try {
            this.hurtEnemy(e, w.dmg * w.brace, a);
          } finally {
            this._hit = null;
          }
          this.wear(this.gr.slots.melee, 1);
          if (!e.dead) e.lunge = { phase: "stumble", t: R.stumble };
          else e.lunge = null;
          this.gr.stats.counters++;
          this.xp("combat", 2);
          this.effects.push({ x: p.x, y: p.y - 80, text: "顶住了！", t: 0.9, color: "#ffdb8c" });
          return true;
        }
        if (!L.hit && dist(e, p) < 40 && this.invulnerable <= 0 && !(this.gx.down > 0)) {
          L.hit = true;
          this.damagePlayer(0, { eff: R.damage, from: e, down: R.down });
        }
        if (L.t <= 0) {
          if (L.hit) {
            e.lunge = null;
            e.lcd = R.cd;
            e.cooldown = 0.8;
          } else e.lunge = { phase: "stumble", t: R.stumble };
        }
        return true;
      }
      if (L.phase === "stumble") {
        if (L.t <= 0) {
          e.lunge = null;
          e.lcd = R.cd;
        }
        return true;
      }
      e.lunge = null;
      return false;
    }
    const d = dist(e, p);
    if (e.state === "chase" && e.lcd <= 0 && !(e.windup > 0) && !(this.gx.down > 0) && d > R.min && d < R.max && this.lineClear(e, p)) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.lunge = { phase: "crouch", t: R.crouch, a };
      e.facing = a;
      this.gr.stats.lunges++;
      this.emit("hiss");
      this.tip("lunge", "奔跑者蹲下了，马上要扑：往旁边躲，或拿矛对准它顶住。");
      return true;
    }
    return false;
  }
  updateCharge(e, dt) {
    const R = RULES.charge,
      p = this.s.player,
      C = e.charge;
    e.ccd = Math.max(0, (e.ccd || 0) - dt);
    e.flash = Math.max(0, (e.flash || 0) - dt);
    if (C) {
      C.t -= dt;
      if (C.phase === "stomp") {
        // 跺脚：地面震动（“减少闪烁”打开时不震）
        if (dist(e, p) < 360 && !this.s.settings?.access?.calm) this.shake = Math.max(this.shake || 0, 2);
        if (C.t <= 0) Object.assign(C, { phase: "run", left: R.len });
        return true;
      }
      if (C.phase === "run") {
        const step = R.speed * dt,
          ox = e.x,
          oy = e.y;
        this.moveEntity(e, Math.cos(C.a) * step, Math.sin(C.a) * step, true);
        e.facing = C.a;
        C.left -= step;
        if (!C.hit && dist(e, p) < 45 && this.invulnerable <= 0) {
          C.hit = true;
          this.damagePlayer(0, { eff: R.damage, from: e, down: R.down });
        }
        if (Math.hypot(e.x - ox, e.y - oy) < step * 0.3) {
          e.charge = { phase: "stun", t: R.stun };
          e.stunned = true;
          this.shake = Math.max(this.shake || 0, 4);
          this.effects.push({ x: e.x, y: e.y - 70, text: "撞晕了！", t: 0.9, color: "#ffdb8c" });
          return true;
        }
        if (C.left <= 0) {
          e.charge = null;
          e.ccd = R.cd;
        }
        return true;
      }
      if (C.phase === "stun") {
        if (C.t <= 0) {
          e.charge = null;
          e.stunned = false;
          e.ccd = R.cd;
        }
        return true;
      }
      e.charge = null;
      return false;
    }
    const d = dist(e, p);
    if (e.state === "chase" && e.ccd <= 0 && !(e.windup > 0) && d > R.min && d < R.max && this.lineClear(e, p)) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.charge = { phase: "stomp", t: R.stomp, a };
      e.facing = a;
      this.gr.stats.charges++;
      this.emit("stomp");
      this.tip("charge", "重甲在跺脚，要冲过来了：躲开那条线，让它撞墙晕住。");
      return true;
    }
    return false;
  }
  updateCrawler(e, dt) {
    const p = this.s.player,
      R = RULES.crawl,
      d = dist(e, p);
    e.flash = Math.max(0, (e.flash || 0) - dt);
    e.cooldown = Math.max(0, (e.cooldown || 0) - dt);
    if (e.reach > 0) {
      e.reach -= dt;
      if (e.reach <= 0) {
        e.reach = 0;
        e.cooldown = 2;
        if (d < R.reach + 8 && this.invulnerable <= 0) this.biteFrom(e, CRAWL_BITE_PARTS, { damage: R.bite });
      }
      return;
    }
    if (d < R.reach && e.cooldown <= 0) {
      e.reach = R.warn;
      e.facing = Math.atan2(p.y - e.y, p.x - e.x);
      return;
    }
    if (d < 260) {
      const a = Math.atan2(p.y - e.y, p.x - e.x);
      e.facing = a;
      this.moveEntity(e, Math.cos(a) * R.speed * dt, Math.sin(a) * R.speed * dt, true);
    }
  }
  summonFor(e) {
    const n = SUMMON[this.phase()],
      alive = this.enemies.filter((z) => z.summoned && !z.dead).length;
    let made = 0;
    for (let k = 0; k < n && alive + made < 8; k++) {
      const a = Math.random() * Math.PI * 2,
        q = this.freePoint(clamp(e.x + Math.cos(a) * 520, 80, WORLD.w - 80), clamp(e.y + Math.sin(a) * 380, 90, WORLD.h - 90));
      if (this.blocked(q.x, q.y, true, 16)) continue;
      const z = this.enemy("slow", q.x, q.y);
      Object.assign(z, { state: "chase", alert: 8, targetX: e.x, targetY: e.y, summoned: true, pack: e.pack || null, reclaimed: !!this.f?.territory?.[this.s.region] });
      this.enemies.push(z);
      made++;
    }
    if (made) {
      this.gr.stats.summons += made;
      this.toast("尖叫声从远处又引来了 " + made + " 只感染者", "warn");
    }
  }

  // ================= 投掷与陷阱 =================
  throwStone(target) {
    if (!this.gr) return super.throwStone(target);
    return this.throwItem(target, this.gr.slots.throw && this.qty(this.gr.slots.throw) ? this.gr.slots.throw : "stone");
  }
  throwItem(target, id = this.gr.slots.throw) {
    if (this.paused || !id || !THROWN[id]) return false;
    const def = THROWN[id],
      p = this.s.player;
    if (this.gx.grab || this.gx.down > 0 || this.cooldown > 0) return false;
    if (this.s.region === "market") {
      this.toast("集市里不扔东西。");
      return false;
    }
    if (dist(p, target) > def.range || !this.lineClear(p, target)) {
      this.toast("扔不到那么远，或者中间挡着。", "warn");
      return false;
    }
    if (!this.pay({ [id]: 1 }, false)) {
      this.toast("没有" + ITEMS[id].name + "了", "warn");
      return false;
    }
    this.cooldown = def.cd * (p.stamina < RULES.tired.below ? RULES.tired.mul : 1);
    p.stamina = Math.max(0, p.stamina - (def.stamina || 0));
    this.actionAnim = 0.2;
    p.facing = Math.atan2(target.y - p.y, target.x - p.x);
    this.noise.push({ x: target.x, y: target.y, r: def.noise, t: def.ring, distraction: true });
    this.particlesAt(target.x, target.y, id === "molotov" ? "#f6b05a" : "#c9c4b5", id === "molotov" ? 14 : 6);
    if (def.fire) this.gx.fires.push({ region: this.s.region, x: target.x, y: target.y, r: def.fire.r, t: def.fire.time, max: def.fire.time });
    if (def.dmg && !def.fire) {
      const z = this.enemies.filter((z) => !z.dead && !z.nest && Math.hypot(z.x - target.x, z.y - 20 - target.y) < 30).sort((a, b) => dist(a, target) - dist(b, target))[0];
      if (z) {
        this._hit = { id, kind: "throw", pierce: 1, knock: 0, interrupt: !!def.interrupt };
        try {
          this.hurtEnemy(z, def.dmg, Math.atan2(z.y - p.y, z.x - p.x));
        } finally {
          this._hit = null;
        }
      }
    }
    this.toast(id === "stone" ? "石子落地 · 感染者会去声音那里看" : id === "firecracker" ? "鞭炮响了 3 秒 · 远处的感染者都会过去" : "燃烧瓶炸开了，地上烧 3 秒");
    if (this.f) this.f.crouch = false;
    this.emit("swing");
    return true;
  }
  placeTrap(target) {
    if (this.paused || !this.gr) return false;
    const id = this.currentItem();
    if (!TRAPS[id] || !this.qty(id)) {
      this.toast(this.slotEmptyText(6), "warn");
      return false;
    }
    if (this.gx.trapCd > 0 || this.gx.grab || this.gx.down > 0) return false;
    const p = this.s.player;
    if (this.s.region === "market") {
      this.toast("集市里不能摆陷阱。");
      return false;
    }
    const a = Math.atan2(target.y - p.y, target.x - p.x),
      d = Math.min(70, dist(p, target)),
      q = { x: Math.round(p.x + Math.cos(a) * Math.max(30, d)), y: Math.round(p.y + Math.sin(a) * Math.max(30, d)) };
    if (this.blocked(q.x, q.y, true, 12)) {
      this.toast("这里摆不下，换个空地。", "warn");
      return false;
    }
    if (this.gr.traps.filter((t) => t.region === this.s.region).length >= 8) {
      this.toast("这张图上已经摆了 8 个陷阱。", "warn");
      return false;
    }
    if (!this.pay({ [id]: 1 }, false)) return false;
    // 摆一个要 1 秒：这段时间不能出手
    this.gx.trapCd = TRAPS[id].place || 1;
    this.cooldown = Math.max(this.cooldown, TRAPS[id].place || 1);
    this.actionAnim = 0.25;
    this.gr.traps.push({ id: this.s.idCounter++, kind: id, region: this.s.region, x: q.x, y: q.y, uses: TRAPS[id].uses });
    this.toast("摆下" + ITEMS[id].name + "（能用 " + TRAPS[id].uses + " 次）");
    this.emit("craft");
    return true;
  }
  updateTraps(dt) {
    const here = this.gr.traps.filter((t) => t.region === this.s.region);
    if (!here.length) return;
    for (const t of here) {
      const def = TRAPS[t.kind];
      for (const z of this.enemies) {
        if (z.dead || z.nest || z.type === "raider" || t.uses <= 0) continue;
        if (Math.hypot(z.x - t.x, z.y - t.y) > 22) continue;
        z.trapClock = Math.max(0, (z.trapClock || 0) - dt);
        if (z.trapClock > 0) continue;
        z.trapClock = def.hold ? def.hold + 0.6 : 1;
        this._hit = { id: t.kind, kind: "trap", pierce: 1, knock: 0 };
        try {
          this.hurtEnemy(z, def.dmg, z.facing ?? 0);
        } finally {
          this._hit = null;
        }
        if (def.hold) z.trapHeld = def.hold;
        if (def.slow) z.slowT = def.slowTime;
        t.uses--;
        this.gr.stats.trapHits++;
        this.noise.push({ x: t.x, y: t.y, r: def.noise, t: 0.8 });
        this.particlesAt(t.x, t.y, "#c9b48a", 6);
      }
    }
    const before = this.gr.traps.length;
    this.gr.traps = this.gr.traps.filter((t) => t.uses > 0);
    if (this.gr.traps.length < before && this.s.region !== "farm") this.toast("一个陷阱用坏了");
  }
  updateFires(dt) {
    const fires = this.gx.fires;
    if (!fires.length) return;
    for (const f of fires) {
      f.t -= dt;
      if (f.region !== this.s.region) continue;
      for (const z of this.enemies) {
        if (z.dead || z.nest || dist(z, f) > f.r) continue;
        this.dotHurt(z, THROWN.molotov.dmg * dt);
      }
      const p = this.s.player;
      if (dist(p, f) < f.r * 0.8 && this.invulnerable <= 0 && !this.gx.fireHurt) {
        this.gx.fireHurt = 0.5;
        this.damagePlayer(0, { eff: THROWN.molotov.dmg * 0.5, noBleed: true });
      }
    }
    this.gx.fireHurt = Math.max(0, (this.gx.fireHurt || 0) - dt);
    this.gx.fires = fires.filter((f) => f.t > 0);
  }

  // ================= 每帧 =================
  update(dt, input = { x: 0, y: 0, run: false }) {
    if (this.paused || !this.gr) return super.update(dt, input);
    const gx = this.gx,
      step = Math.min(0.05, Math.max(0, dt)),
      p = this.s.player,
      locked = !!gx.grab || gx.down > 0,
      inp = locked ? { x: 0, y: 0, run: false } : input,
      before = { x: p.x, y: p.y, st: p.stamina, hunger: p.hunger, region: this.s.region };
    const T0 = this.armorTotals();
    super.update(dt, inp);
    if (this.paused) return;
    if (this.s.region !== before.region) {
      gx.grab = null;
      gx.down = 0;
      return;
    }
    const T = T0;
    // 越重走得越慢、体力回得越慢；发烧时体力恢复减半；软底鞋跑步少耗体力
    const moving = (inp.x || inp.y) && Math.hypot(p.x - before.x, p.y - before.y) > 0.01;
    if (T.tier.speed < 1 && moving) this.moveEntity(p, (p.x - before.x) * (T.tier.speed - 1), (p.y - before.y) * (T.tier.speed - 1));
    const dSt = p.stamina - before.st;
    if (dSt > 0) p.stamina = before.st + dSt * T.tier.regen * (this.gr.fever ? INFECTION.feverRegen : 1);
    else if (dSt < 0 && inp.run && T.runCost < 1) p.stamina = Math.min(100, before.st + dSt * T.runCost);
    // 寒潮：按全身保暖值算多饿多少（原来的规则按“多饿 40%”算过一次，这里退回多算的部分）
    if (this.s.winter && this.playerCold?.()) {
      const drop = before.hunger - p.hunger,
        tier = this.warmthTier(T.warmth);
      if (drop > 0 && drop < 5 && tier.extra < 0.4) p.hunger = Math.min(100, p.hunger + (drop / 1.4) * (0.4 - tier.extra));
    }
    gx.down = Math.max(0, gx.down - step);
    gx.shoveCd = Math.max(0, gx.shoveCd - step);
    gx.trapCd = Math.max(0, gx.trapCd - step);
    if (gx.swing) {
      gx.swing.t -= step;
      if (gx.swing.t <= 0) gx.swing = null;
    }
    // 流血、慢慢回血
    if (gx.bleed > 0) {
      gx.bleed -= step;
      p.hp -= RULES.bleed.dps * step;
      if (p.hp <= 0) {
        p.hp = 0.01;
        this.invulnerable = 0;
        gx.bleed = 0;
        super.damagePlayer(1);
        if (this.paused) return;
      }
    }
    if (gx.heal) {
      const k = Math.min(step, gx.heal.t),
        add = gx.heal.rate * k;
      gx.heal.t -= k;
      gx.heal.left -= add;
      p.hp = Math.min(this.maxHp(), p.hp + add);
      if (gx.heal.t <= 0 || gx.heal.left <= 0) gx.heal = null;
    }
    if (p.hp > this.maxHp()) p.hp = this.maxHp();
    // 被抓住：到时间没挣开就被咬一口
    const g = gx.grab;
    if (g) {
      g.t -= step;
      if (!g.z || g.z.dead || dist(g.z, p) > 90) this.releaseGrab(false);
      else if (g.t <= 0) {
        const z = g.z;
        this.releaseGrab(false);
        z.cooldown = 1.2;
        this.biteFrom(z, GRAB_BITE_PARTS);
        if (this.paused) return;
      }
    }
    // 脚步声：跑步 90，护甲噪音每档 30；越重越响；蹲着走没有声音
    if (moving && !this.f?.crouch) {
      gx.stepClock -= step;
      if (gx.stepClock <= 0) {
        gx.stepClock = 0.4;
        const r = ((inp.run ? RULES.noise.run : 0) + Math.max(0, T.noise) * RULES.noise.step) * T.tier.step;
        if (r > 10) this.noise.push({ x: p.x, y: p.y, r, t: 0.5, step: true });
      }
    }
    if (!SAFE.includes(this.s.region) || this.s.region === "farm") {
      this.updateTraps(step);
      this.updateFires(step);
    }
    // 拿到的图纸当场学会
    gx.learnClock -= step;
    if (gx.learnClock <= 0) {
      gx.learnClock = 0.5;
      this.learnBlueprints();
      this.checkSlots();
      this.nightWanderers(this.s.region, false);
    }
  }
  checkSlots() {
    for (const k of GEAR_SLOTS) {
      const id = this.gr.slots[k];
      if (id && k !== "throw" && !(this.s.inventory[id] > 0)) this.gr.slots[k] = null;
    }
  }
  // 寒潮：全身保暖不到 4 点，在暖区外就会多饿（保温衣一件就是 4 点）
  playerCold() {
    if (!this.gr) return super.playerCold?.();
    if (!this.coldActive?.()) return false;
    if (this.s.region === "market") return false;
    if (this.s.region === "farm" && this.warmAt?.(this.s.player)) return false;
    return this.warmth() < 4;
  }

  // ================= 用药 =================
  consume(id) {
    if (!this.gr || !["bandage", "medkit"].includes(id)) return super.consume(id);
    if (!this.qty(id)) {
      this.toast(ITEMS[id].name + "已经用完了。", "warn");
      return false;
    }
    // 远征：只能用装进行囊的，限药挑战只能用一份（和原来一样）
    const route = this.f?.route;
    if (route) {
      if (!(this.carriedAmount(id) > 0)) {
        this.toast("这次远征未携带更多" + ITEMS[id].name, "warn");
        return false;
      }
      if (route.mods?.includes("oneHeal") && route.heals >= 1) {
        this.toast("限药挑战：只能使用一份药品。", "warn");
        return false;
      }
    }
    const R = RULES.heal[id],
      p = this.s.player,
      need = p.hp < this.maxHp() || (id === "bandage" && this.gx.bleed > 0) || (id === "medkit" && this.gr.fever && !this.gr.cure);
    if (!need) {
      this.toast("当前状态良好，暂时不需要。");
      return false;
    }
    this.s.inventory[id]--;
    if (!this.s.inventory[id]) delete this.s.inventory[id];
    if (route) {
      this.spendCarried(id, 1);
      route.heals = (route.heals || 0) + 1;
    }
    const amount = R.hp + (this.medBonus?.(id) || 0),
      h = this.gx.heal,
      left = (h?.left || 0) + amount,
      t = (h?.t || 0) + R.time;
    this.gx.heal = { left, t, rate: left / t };
    const lines = [ITEMS[id].name + " · " + R.time + " 秒内回 " + amount + " 生命"];
    if (id === "bandage" && this.gx.bleed > 0) {
      this.gx.bleed = 0;
      lines.push("止住了血");
    }
    if (id === "medkit" && this.gr.fever && !this.gr.cure) {
      this.gr.cure = true;
      lines.push("今晚睡一觉就退烧");
    }
    this.toast(lines.join(" · "));
    this.emit("eat");
    return true;
  }
  sleep() {
    const ok = super.sleep();
    if (!ok || !this.gr) return ok;
    const g = this.gr;
    this.gx.bleed = 0;
    this.releaseGrab(false);
    if (g.fever) {
      if (g.cure) {
        g.fever = false;
        g.cure = false;
        g.inf = 0;
        this.toast("退烧了，感染清干净了。", "gold");
      } else this.toast("还在发烧：吃一份药包，再睡一晚才会好。", "warn");
    } else if (g.inf > 0) g.inf = Math.max(0, g.inf - INFECTION.sleep);
    if (this.s.player.hp > this.maxHp()) this.s.player.hp = this.maxHp();
    return ok;
  }
  die() {
    if (!this.gr) return super.die();
    // 死在外面：身上每件装备的耐久掉四分之一
    const worn = [];
    for (const id of this.wornIds()) {
      const def = gearDef(id);
      if (!def?.dur) continue;
      const c = this.cond(id),
        cut = Math.round(c.m * REPAIR.deathWear);
      if (cut > 0 && c.d > 0) {
        c.d = Math.max(0, c.d - cut);
        worn.push(ITEMS[id].name);
      }
    }
    const gx = this.gx;
    gx.grab = null;
    gx.down = 0;
    gx.bleed = 0;
    gx.heal = null;
    gx.fires = [];
    const out = super.die();
    if (worn.length) this.toast("身上的装备都磨损了四分之一：" + worn.join("、"), "warn");
    return out;
  }

  // ================= 耐久、修理、改装、拆解 =================
  wear(id, n = 1) {
    const def = gearDef(id);
    if (!def?.dur || !n) return;
    const c = this.cond(id);
    if (c.d <= 0) return;
    const was = c.d;
    c.d = Math.max(0, c.d - n);
    if (c.d === 0) {
      this.gr.stats.broken++;
      this.toast(ITEMS[id].name + "坏了：" + (ARMOR[id] ? "没有保护了" : "伤害减半") + "，回农场修", "warn");
    } else if (was > c.m * 0.25 && c.d <= c.m * 0.25) this.toast(ITEMS[id].name + "快坏了", "warn");
  }
  benchReady() {
    return this.s.region === "farm" && this.s.buildings.some((b) => b.type === "weaponbench" && b.hp > 0);
  }
  repairCost(id) {
    const def = gearDef(id);
    if (!def?.fix) return null;
    const half = this.level("manufacturing") >= 3;
    return Object.fromEntries(Object.entries(def.fix).map(([k, n]) => [k, half ? Math.max(1, Math.ceil(n / 2)) : n]));
  }
  // 再修一次以后的耐久上限（每修一次少一成）
  repairNextMax(id) {
    const c = this.cond(id);
    return c ? Math.max(1, Math.round(this.baseMax(id) * (1 - REPAIR.drop * (c.r + 1)))) : 0;
  }
  repairReason(id) {
    const def = gearDef(id);
    if (!def) return "这件不能修";
    if (!def.dur) return "这件不会坏";
    if (!((this.s.inventory[id] || 0) + (this.s.storage[id] || 0))) return "手上没有这件";
    const c = this.cond(id);
    if (c.r >= REPAIR.maxRepairs) return "修过 5 次了，只能拆";
    if (c.d >= c.m) return "耐久是满的";
    if (!this.benchReady()) return "回农场的武器台修";
    const cost = this.repairCost(id);
    if (!this.afford(cost)) return "还缺：" + itemsText(Object.fromEntries(Object.entries(cost).filter(([k, n]) => this.qty(k, true) < n)));
    return "";
  }
  repairGear(id) {
    const reason = this.repairReason(id);
    if (reason) {
      this.toast(reason, "warn");
      return false;
    }
    if (!this.spend(this.repairCost(id))) return false;
    const c = this.cond(id);
    c.m = this.repairNextMax(id);
    c.r++;
    c.d = c.m;
    this.gr.stats.repairs++;
    this.toast("修好了" + ITEMS[id].name + "：耐久上限 " + c.m + (c.r >= REPAIR.maxRepairs ? "（最后一次能修）" : "（第 " + c.r + " 次）"), "gold");
    this.emit("craft");
    return true;
  }
  // 不花材料修满（每日抉择）：选身上最旧的一件
  fixWorst() {
    const ids = this.wornIds().filter((id) => gearDef(id)?.dur && this.cond(id).d < this.cond(id).m);
    if (!ids.length) return null;
    const id = ids.sort((a, b) => this.condRatio(a) - this.condRatio(b))[0],
      c = this.cond(id);
    c.d = c.m;
    return id;
  }
  modSlots(id) {
    return gearDef(id)?.mods || 0;
  }
  modReason(id, mod) {
    const m = MODS[mod];
    if (!m || !gearDef(id)) return "装不上";
    if (!modFits(mod, id)) return "这件装不了" + m.name;
    if (!((this.s.inventory[id] || 0) + (this.s.storage[id] || 0))) return "手上没有这件";
    const c = this.cond(id);
    if (c.mods?.[mod]) return "已经装了";
    if (mod === "diySuppressor") {
      if (this.f?.weaponMods?.[id]?.accessory === "suppressor") return "已经装了消音附件";
    } else {
      const used = Object.keys(c.mods || {}).filter((m) => m !== "diySuppressor").length;
      if (used >= this.modSlots(id)) return this.modSlots(id) ? "改装位满了（先拆一个）" : "这件没有改装位";
    }
    if (gearDef(id).dur && c.d <= 0) return "坏了，先修好";
    if (!this.benchReady()) return "回农场的武器台改";
    if (!this.afford(m.cost)) return "还缺：" + itemsText(Object.fromEntries(Object.entries(m.cost).filter(([k, n]) => this.qty(k, true) < n)));
    return "";
  }
  applyMod(id, mod) {
    const reason = this.modReason(id, mod);
    if (reason) {
      this.toast(reason, "warn");
      return false;
    }
    if (!this.spend(MODS[mod].cost)) return false;
    const c = this.cond(id);
    c.mods = { ...c.mods, [mod]: MODS[mod].n || 1 };
    // 缠布只加上限，不补现在的耐久
    if (mod === "wrap" && gearDef(id).dur) c.m = Math.max(1, Math.round(this.baseMax(id) * (1 - REPAIR.drop * c.r)));
    this.gr.stats.mods++;
    this.toast(ITEMS[id].name + " 装上了" + MODS[mod].name + "：" + MODS[mod].text, "gold");
    this.emit("craft");
    return true;
  }
  removeMod(id, mod) {
    const c = this.gr.cond[id];
    if (!c?.mods?.[mod]) return false;
    if (!this.benchReady()) {
      this.toast("回农场的武器台拆", "warn");
      return false;
    }
    const next = { ...c.mods };
    delete next[mod];
    c.mods = next;
    if (mod === "wrap" && gearDef(id)?.dur) {
      c.m = Math.max(1, Math.round(this.baseMax(id) * (1 - REPAIR.drop * c.r)));
      c.d = Math.min(c.d, c.m);
    }
    this.toast("拆下了" + MODS[mod].name + "（材料不退）");
    return true;
  }
  dismantleReason(id) {
    const def = gearDef(id);
    if (!def) return "这件不能拆";
    if (!((this.s.inventory[id] || 0) + (this.s.storage[id] || 0))) return "手上没有这件";
    if (!Object.keys(def.scrap || {}).length) return "拆不出东西";
    if (!this.benchReady()) return "回农场的武器台拆";
    return "";
  }
  dismantleGear(id) {
    const reason = this.dismantleReason(id);
    if (reason) {
      this.toast(reason, "warn");
      return false;
    }
    const def = gearDef(id),
      worn = this.isWorn(id),
      from = (this.s.inventory[id] || 0) > 0 ? this.s.inventory : this.s.storage;
    from[id]--;
    if (!from[id]) delete from[id];
    // 拆的是用旧的那件；身上穿着、背包里没有了、仓库还有备用的，就把备用的拿出来穿上
    if (worn && !(this.s.inventory[id] > 0) && this.s.storage[id] > 0) {
      this.s.storage[id]--;
      if (!this.s.storage[id]) delete this.s.storage[id];
      this.s.inventory[id] = 1;
    }
    const left = (this.s.inventory[id] || 0) + (this.s.storage[id] || 0);
    if (!left) {
      delete this.gr.cond[id];
      for (const k of GEAR_SLOTS) if (this.gr.slots[k] === id) this.gr.slots[k] = null;
    } else this.gr.cond[id] = newCond(id);
    this.receive(def.scrap);
    this.gr.stats.dismantled++;
    this.toast("拆了" + ITEMS[id].name + "：" + itemsText(def.scrap), "gold");
    this.emit("craft");
    return true;
  }
  // 有备用的一件时：把旧的拆了，换上新的
  freshReason(id) {
    if (!gearDef(id)?.dur) return "这件不会坏";
    if ((this.s.inventory[id] || 0) + (this.s.storage[id] || 0) < 2) return "没有备用的";
    if (this.cond(id).d >= this.cond(id).m && this.cond(id).r === 0) return "现在这件是新的";
    if (!this.benchReady()) return "回农场的武器台换";
    return "";
  }
  freshCopy(id) {
    const reason = this.freshReason(id);
    if (reason) {
      this.toast(reason, "warn");
      return false;
    }
    const mods = this.gr.cond[id]?.mods || {};
    this.dismantleGear(id);
    const c = this.cond(id);
    c.mods = {};
    if (Object.keys(mods).length) this.toast("旧的那件上的改装一起拆掉了");
    return true;
  }

  // ================= 图纸 =================
  knows(bp) {
    return !!this.gr?.bp[bp];
  }
  learn(bp, quiet = false) {
    if (!BLUEPRINTS[bp] || this.gr.bp[bp]) return false;
    this.gr.bp[bp] = this.s.day;
    if (!quiet) this.toast("学会了" + BLUEPRINTS[bp].name + "：武器台能做" + BLUEPRINTS[bp].makes.map((m) => ITEMS[m]?.name || m).join("、"), "gold");
    return true;
  }
  learnBlueprints() {
    for (const bp of BP_IDS) {
      const n = (this.s.inventory[bp] || 0) + (this.s.storage[bp] || 0);
      if (!n) continue;
      delete this.s.inventory[bp];
      delete this.s.storage[bp];
      if (!this.learn(bp)) this.receive({ scrap: 4 });
    }
  }
  recipeReason(r) {
    if (this.gr && typeof r?.unlock === "string" && r.unlock.startsWith("bp:")) {
      const bp = r.unlock.slice(3);
      if (!this.knows(bp)) return "需要" + BLUEPRINTS[bp].name + "（" + BLUEPRINTS[bp].where + "）";
      return super.recipeReason({ ...r, unlock: null });
    }
    return super.recipeReason(r);
  }
  traderStock(id) {
    const stock = super.traderStock(id);
    if (this.gr && id === "mechanic" && !this.knows("bp_bracer") && !(stock.bp_bracer >= 0)) stock.bp_bracer = 1;
    if (this.gr && id === "mechanic" && this.knows("bp_bracer")) delete stock.bp_bracer;
    return stock;
  }
  // 唐九每次来卖一张图纸（轮着来），身上没有皮夹克时也带一件
  arriveCaravan() {
    const ok = super.arriveCaravan();
    if (!ok || !this.gr) return ok;
    const c = this.o?.caravan;
    if (!c?.offers) return ok;
    const todo = CARAVAN_BPS.filter((bp) => !this.knows(bp));
    if (todo.length) {
      const bp = todo[this.gr.caravanBp % todo.length];
      this.gr.caravanBp++;
      c.offers.push({ key: c.offers.length, item: bp, tech: null, qty: 1, price: 140, fake: null, inspected: "real", sold: false });
    }
    if (!(this.qty("leatherJacket", true) > 0)) c.offers.push({ key: c.offers.length, item: "leatherJacket", tech: null, qty: 1, price: 70, fake: null, inspected: null, sold: false });
    return ok;
  }
  // 打退灰隼团：掉一件防暴头盔或防暴服（轮着来）
  finishRaid(won, auto = false, note = "") {
    const out = super.finishRaid(won, auto, note);
    if (won && this.gr) {
      const id = this.gr.raid % 2 === 0 ? "riotHelmet" : "riotSuit";
      this.gr.raid++;
      this.putStorage({ [id]: 1 });
      this.toast("灰隼团丢下了一件" + ITEMS[id].name + "（已入仓）", "gold");
    }
    return out;
  }
  applyTreasure(id, lines = []) {
    const out = super.applyTreasure(id, lines);
    if (id === "gunPlans" && this.gr) {
      for (const bp of ["bp_crossbow", "bp_suppressor"]) if (this.learn(bp, true)) lines.push("学会了" + BLUEPRINTS[bp].name + "。");
    }
    return out;
  }
  // 每日抉择的新动作
  applyOp(op, ctx, tier, roll = 0.5) {
    const [kind, a] = op;
    if (kind === "bp" && this.gr) {
      if (this.learn(a, true)) return "学会了" + BLUEPRINTS[a].name;
      this.receive({ scrap: 4 });
      return "这张图纸已经会了，换成废金属 4";
    }
    if (kind === "gear" && this.gr) {
      this.receive(a);
      return "得到：" + itemsText(a);
    }
    if (kind === "fixGear" && this.gr) {
      const id = this.fixWorst();
      return id ? "修满了" + ITEMS[id].name : "身上的装备都是好的，他帮你上了点油";
    }
    return super.applyOp(op, ctx, tier, roll);
  }

  // 偷东西：穿软底鞋、轻装，注意力涨得慢一点；穿得重就快一点
  beginSteal(opts) {
    const st = super.beginSteal(opts);
    if (!st || !this.gr || st !== this.steal || st.phase !== "pick") return st;
    const T = this.armorTotals();
    let k = 1;
    if (this.gr.slots.feet === "softShoes" && !this.broken("softShoes")) k *= 1.15;
    if (T.tier.id === "light") k *= 1.05;
    else if (T.tier.id === "heavy") k *= 0.85;
    st.fill *= k;
    if (k > 1.06) st.lines?.push("软底鞋、轻装：注意力涨得慢一点。");
    else if (k < 1) st.lines?.push("身上太重太响：注意力涨得快一点。");
    return st;
  }

  // ================= 场景里的东西 =================
  assignRegion() {
    super.assignRegion();
    if (!this.gr) return;
    const id = this.s.region;
    // 换了地图：被抓住、倒地都不带过去（别的系统在同一张图里刷新人物时也会走到这里，那时不动）
    if (this._gx && this._gxRegion !== undefined && this._gxRegion !== id) {
      if (this._gx.grab?.z) this._gx.grab.z.holding = false;
      this._gx.grab = null;
      this._gx.down = 0;
    }
    this._gxRegion = id;
    this.nightWanderers(id);
    for (const spot of GEAR_SPOTS[id] || []) {
      const key = "gear:" + id + ":" + spot.id;
      if (this.gr.found[key]) continue;
      const q = this.freePoint(spot.x, spot.y);
      this.objects.push({ type: "gearCrate", id: key, x: q.x, y: q.y, name: spot.name, items: spot.items, guard: !!spot.guard, icon: 40 });
    }
  }
  // 第几夜（傍晚算当天，凌晨算前一天）；白天是 0
  nightKey() {
    if (!this.isNight?.()) return 0;
    return (this.s.minute >= 360 ? this.s.day : this.s.day - 1) + 1;
  }
  // 夜里在外面：多四成游荡的感染者，两三只一群；天亮就散了
  // 进图时（或在图里待到天黑）各算一次；天亮后没在追你的就散了
  nightWanderers(id, entering = true) {
    if (SAFE.includes(id) || !this.enemies) return;
    const key = this.nightKey(),
      p = this.s.player;
    if (!key) {
      // 天亮：离你远的散了；正追着你、就在身边的打完再说
      const gone = (z) => z.nightWander && !z.dead && (dist(z, p) > 420 || (entering && z.state !== "chase") || (!entering && z.state !== "chase" && dist(z, p) > 260));
      if (this.enemies.some(gone)) this.enemies = this.s.enemies[id] = this.enemies.filter((z) => !gone(z));
      return;
    }
    if (this.gr.night[id] === key) return;
    this.gr.night[id] = key;
    const alive = this.enemies.filter((z) => !z.dead && !z.nest && !z.nightWander && z.type !== "elite").length,
      n = Math.round(alive * RULES.night.more),
      spawn = REGIONS[id]?.spawn || { x: 170, y: 520 };
    for (let i = 0; i < n; i++) {
      const pack = Math.floor(i / 3),
        cx = 360 + ((pack * 397 + key * 131) % 900),
        cy = 300 + ((pack * 271 + key * 97) % 520),
        q = this.freePoint(cx + (i % 3) * 30, cy + (i % 3) * 18);
      if (dist(q, spawn) < 260 || dist(q, p) < 320) continue;
      const z = this.enemy(i % 3 === 2 ? "runner" : "slow", q.x, q.y);
      Object.assign(z, { nightWander: true, pack: id + ":n" + key + ":" + pack, reclaimed: !!this.f?.territory?.[id] });
      this.enemies.push(z);
    }
  }
  context(o) {
    if (this.gr && this.gx.grab) return "连按 " + this.keyName("interact", "E") + " 挣开（或按 " + this.keyName("shove", "X") + " 推开）";
    if (o?.type === "gearCrate") return (o.guard && this.enemies.some((z) => z.type === "elite" && !z.dead) ? "守卫看着 · " : "打开 · ") + o.name;
    return super.context(o);
  }
  nearestCrawler(max = 46) {
    const p = this.s.player;
    return this.enemies.filter((z) => z.crawl && !z.dead && dist(z, p) < max).sort((a, b) => dist(a, p) - dist(b, p))[0] || null;
  }
  interact() {
    if (this.paused || !this.gr) return super.interact();
    if (this.gx.grab) return this.mash();
    const crawler = this.nearestCrawler();
    if (crawler) {
      const T = this.armorTotals();
      this._hit = { id: "stomp", kind: "stomp", pierce: 1, knock: 0 };
      try {
        this.hurtEnemy(crawler, 45 * T.stomp, this.s.player.facing ?? 0);
      } finally {
        this._hit = null;
      }
      this.gr.stats.stomps++;
      this.actionAnim = 0.2;
      this.emit("swing");
      return;
    }
    const o = this.nearestObject();
    if (o?.type === "gearCrate") return this.openGearCrate(o);
    return super.interact();
  }
  openGearCrate(o) {
    if (o.guard && this.enemies.some((z) => z.type === "elite" && !z.dead)) {
      this.toast("守卫就站在旁边，先解决它。", "warn");
      return false;
    }
    if (this.gr.found[o.id]) return false;
    const items = { ...o.items };
    for (const bp of BP_IDS)
      if (items[bp] && this.knows(bp)) {
        delete items[bp];
        items.scrap = (items.scrap || 0) + 4;
      }
    this.receive(items);
    this.gr.found[o.id] = this.s.day;
    this.objects = this.objects.filter((x) => x !== o);
    this.learnBlueprints();
    this.xp("exploration", 10);
    this.particlesAt(o.x, o.y, "#efcf7e", 18);
    this.toast(o.name + "：" + itemsText(items), "gold");
    this.emit("loot");
    return true;
  }
  // 守卫居民：给一件身体防具，被流弹擦伤时少受一半
  guardReason(rid, id) {
    const r = this.c?.residents?.find((x) => x.id === rid);
    if (!r) return "没有这个人";
    if (!ARMOR[id] || ARMOR[id].slot !== "body") return "只能给身体防具";
    if (!(this.qty(id, this.s.region === "farm") > 0)) return "手上没有" + (ITEMS[id]?.name || "这件");
    if (this.isWorn(id) && (this.s.inventory[id] || 0) + (this.s.storage[id] || 0) <= 1) return "你身上就这一件";
    if (this.gr.guards[rid] === id) return "已经穿着了";
    return "";
  }
  armGuard(rid, id) {
    const reason = this.guardReason(rid, id);
    if (reason) {
      this.toast(reason, "warn");
      return false;
    }
    // 身上穿着、背包里只有这一件时，先从仓库拿
    const fromStore = this.isWorn(id) && (this.s.inventory[id] || 0) <= 1 && this.s.region === "farm" && this.s.storage[id] > 0;
    if (fromStore) {
      this.s.storage[id]--;
      if (!this.s.storage[id]) delete this.s.storage[id];
    } else if (!this.pay({ [id]: 1 }, this.s.region === "farm")) return false;
    const old = this.gr.guards[rid];
    if (old) this.receive({ [old]: 1 });
    this.gr.guards[rid] = id;
    this.toast(this.residentName?.(rid) + "穿上了" + ITEMS[id].name + "：灰隼团的流弹伤他少一半", "gold");
    return true;
  }
  woundNote(name) {
    if (this.gr) {
      const r = this.c?.residents?.find((x) => this.residentName?.(x.id) === name);
      if (r && this.gr.guards[r.id]) {
        r.fatigue = clamp((r.fatigue || 0) - 7, 0, 100);
        r.morale = clamp((r.morale ?? 60) + 2, 0, 100);
      }
    }
    return super.woundNote(name);
  }

  // ================= 说明卡、顶栏 =================
  gearIntroDue() {
    return !!this.gr && !this.gr.intro;
  }
  markGearIntro() {
    if (this.gr) this.gr.intro = true;
  }
  gearHud() {
    if (!this.gr) return [];
    const out = [],
      g = this.gr,
      gx = this.gx;
    if (gx.grab) out.push({ id: "grab", text: "被抓住了", tone: "warn", title: "推开（" + this.keyName("shove", "X") + "）立刻挣开，或连按 " + this.keyName("interact", "E") + " 三下" });
    if (gx.bleed > 0) out.push({ id: "bleed", text: "流血", tone: "warn", title: "每秒掉 1.2 生命，用绷带止住" });
    if (g.fever) out.push({ id: "fever", text: g.cure ? "发烧 · 今晚退烧" : "发烧", tone: "warn", title: g.cure ? "吃过药包了，睡一晚就好" : "生命上限 −30、体力恢复减半：吃一份药包，再睡一晚" });
    else if (g.inf > 0) out.push({ id: "inf", text: "感染 " + Math.round(g.inf) + "%", tone: g.inf >= 60 ? "warn" : "", title: "被咬会涨，每睡一晚降 20%，满了就发烧" });
    if (gx.heal) out.push({ id: "heal", text: "回血中", tone: "good", title: "还有 " + Math.ceil(gx.heal.t) + " 秒" });
    return out;
  }
  // 存档
  static parse(text) {
    const raw = JSON.parse(text),
      s = GardenEngine.parse(text);
    if (raw.gear !== undefined) validateGear(raw.gear);
    return migrateState(s);
  }
}

function validateGear(x) {
  const object = (v) => v && typeof v === "object" && !Array.isArray(v),
    int = (v, min = 0, max = 1e7) => Number.isInteger(v) && v >= min && v <= max,
    num = (v, min = 0, max = 1e7) => Number.isFinite(v) && v >= min && v <= max,
    bad = () => {
      throw Error("装备存档异常，请从设置恢复有效备份；原存档会保留。");
    },
    d = gearDefaults();
  const own = (o, k) => typeof k === "string" && Object.hasOwn(o, k);
  if (!object(x) || x.schema !== GEAR_SCHEMA || Object.keys(x).some((k) => !Object.hasOwn(d, k))) bad();
  if (x.slots !== undefined && (!object(x.slots) || Object.entries(x.slots).some(([k, v]) => !GEAR_SLOTS.includes(k) || (v !== null && (!own(ITEMS, v) || slotOf(v) !== k))))) bad();
  if (x.cond !== undefined) {
    if (!object(x.cond) || Object.keys(x.cond).length > 80) bad();
    for (const [id, c] of Object.entries(x.cond)) {
      if (!(own(ARMOR, id) || own(MELEE, id) || own(RANGED, id)) || !object(c) || !num(c.d) || !num(c.m) || !int(c.r ?? 0, 0, 10) || (c.mods !== undefined && (!object(c.mods) || Object.entries(c.mods).some(([m, v]) => !MOD_IDS.includes(m) || !(v === true || int(v, 0, 999)))))) bad();
    }
  }
  if (x.bp !== undefined && (!object(x.bp) || Object.entries(x.bp).some(([k, v]) => !own(BLUEPRINTS, k) || !int(v)))) bad();
  if (x.found !== undefined && (!object(x.found) || Object.keys(x.found).length > 200 || Object.values(x.found).some((v) => !int(v)))) bad();
  if (x.traps !== undefined && (!Array.isArray(x.traps) || x.traps.length > 200 || x.traps.some((t) => !object(t) || !own(TRAPS, t.kind) || !own(REGIONS, t.region) || !num(t.x, 0, WORLD.w) || !num(t.y, 0, WORLD.h) || !int(t.uses, 0, 99)))) bad();
  if (x.trap !== undefined && !own(TRAPS, x.trap)) bad();
  if (x.inf !== undefined && !num(x.inf, 0, 100)) bad();
  for (const k of ["fever", "cure", "gift", "intro", "old"]) if (x[k] !== undefined && typeof x[k] !== "boolean") bad();
  for (const k of ["grace", "raid", "caravanBp"]) if (x[k] !== undefined && !int(x[k])) bad();
  if (x.night !== undefined && (!object(x.night) || Object.values(x.night).some((v) => !int(v)))) bad();
  if (x.warned !== undefined && !object(x.warned)) bad();
  if (x.guards !== undefined && (!object(x.guards) || Object.keys(x.guards).length > 40 || Object.values(x.guards).some((v) => !own(ARMOR, v)))) bad();
  if (x.stats !== undefined && (!object(x.stats) || Object.entries(x.stats).some(([k, v]) => !STAT_KEYS.includes(k) || !int(v, 0, 1e9)))) bad();
  if (x.warned !== undefined && Object.keys(x.warned).length > 40) bad();
  if (x.night !== undefined && Object.keys(x.night).length > 40) bad();
}
