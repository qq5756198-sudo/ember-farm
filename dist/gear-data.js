// v0.22.0「披挂」：前期感染者加强 + 装备与防具。
// 这里只放数：感染者三段数值和每张图怎么摆、新行为的参数、五个防具栏和三个武器栏、19 件防具、20 种武器、
// 配方、改装、图纸、找得到装备的地方、6 张每日抉择卡。规则写在 gear.js。
// 感染者的血量、速度、伤害都是“实际值”：已经算上统一高难度（血量 ×1.25、速度 ×1.1、伤害 ×1.5）。
import { ITEMS, WEAPONS, RECIPES, REGIONS } from "./data.js";
import { EVENTS, EVENT_IDS } from "./daily-data.js";
import { TREASURES, THIEF_SPOTS } from "./thief-data.js";
import { KIT } from "./frontier-data.js";
import "./winter-data.js";
import "./beyond-data.js";

export const GEAR_SCHEMA = 1;

// ---------- 感染者：三段 ----------
// 第 1–3 天、第 4–7 天、第 8 天以后
export const PHASE_NAMES = ["第 1–3 天", "第 4–7 天", "第 8 天以后"];
export const phaseOf = (day) => (day <= 3 ? 0 : day <= 7 ? 1 : 2);
export const ZSTATS = [
  {
    slow: { hp: 110, speed: 58, damage: 14 },
    runner: { hp: 65, speed: 175, damage: 12 },
    screamer: { hp: 100, speed: 50, damage: 0 },
    armor: { hp: 220, speed: 45, damage: 20 },
    elite: { hp: 813, speed: 46, damage: 36 },
  },
  {
    slow: { hp: 125, speed: 58, damage: 15 },
    runner: { hp: 75, speed: 175, damage: 13 },
    screamer: { hp: 115, speed: 50, damage: 0 },
    armor: { hp: 250, speed: 45, damage: 22 },
    elite: { hp: 813, speed: 46, damage: 36 },
  },
  {
    slow: { hp: 145, speed: 60, damage: 16 },
    runner: { hp: 85, speed: 180, damage: 14 },
    screamer: { hp: 130, speed: 52, damage: 0 },
    armor: { hp: 285, speed: 48, damage: 23 },
    elite: { hp: 900, speed: 48, damage: 36 },
  },
];
// 尖叫一次叫来几只新的
export const SUMMON = [2, 3, 4];

// 新行为的参数（与方案的数值表一致）
export const RULES = {
  grab: { chance: 0.4, around: 90, behind: 2.0, time: 1.2, others: 1.3, mash: 0.35, bite: 6, toughBone: 0.7 },
  lunge: { min: 95, max: 165, crouch: 0.5, dist: 150, time: 0.3, damage: 12, down: 0.8, stumble: 1.2, cd: 4, brace: 2 },
  charge: { min: 120, max: 260, stomp: 0.9, speed: 260, len: 260, damage: 20, down: 1.0, stun: 2, cd: 6 },
  shove: { cost: 10, cd: 0.9, range: 60, arc: 1.05, push: 45, stagger: 0.7 },
  tired: { below: 20, mul: 1.6 },
  iframe: 0.45,
  bleed: { chance: 0.35, dps: 1.2, time: 10 },
  heal: { bandage: { hp: 35, time: 5 }, medkit: { hp: 75, time: 8 } },
  knockInterrupt: 30,
  weakHit: 1.5, // 扑空摔倒、撞墙晕住时挨打的倍数
  backArmor: 1.3, // 从背后打重甲
  crawl: { below: 0.3, chance: 0.3, blade: 0.4, speed: 22, reach: 30, warn: 0.5, bite: 6 },
  night: { chase: 0.25, more: 0.4, sight: 170, light: 260, hear: 1.5 },
  pack: { turn: 0.5, radius: 320 },
  noise: { run: 90, step: 30 },
};
// 感染与发烧
export const INFECTION = { bite: 34, sleep: 20, feverHp: 70, feverRegen: 0.5 };
// 寒潮保暖：全身保暖值 → 暖区外饿得快多少
export const WARMTH = [
  { min: 4, extra: 0, text: "不多饿" },
  { min: 3, extra: 0.1, text: "饿得快 10%" },
  { min: 1, extra: 0.25, text: "饿得快 25%" },
  { min: 0, extra: 0.4, text: "饿得快 40%" },
];
// 全身重量三档
export const WEIGHT_TIERS = [
  { id: "light", name: "轻", max: 7, speed: 1, regen: 1, step: 1 },
  { id: "medium", name: "中", max: 15, speed: 0.95, regen: 0.85, step: 1.3 },
  { id: "heavy", name: "重", max: Infinity, speed: 0.88, regen: 0.7, step: 1.6 },
];
export const ARMOR_CAP = 0.5;
export const REPAIR = { share: 1 / 3, drop: 0.1, maxRepairs: 5, deathWear: 0.25 };

// ---------- 栏位 ----------
export const ARMOR_SLOTS = ["head", "body", "hands", "legs", "feet"];
export const WEAPON_SLOTS = ["melee", "ranged", "throw"];
export const GEAR_SLOTS = [...ARMOR_SLOTS, ...WEAPON_SLOTS];
export const SLOT_NAMES = { head: "头", body: "身", hands: "手", legs: "腿", feet: "脚", melee: "近战", ranged: "远程", throw: "投掷" };
// 伤口落在哪：普通挨打的抓伤一半在身、一半在手；被抓住咬在头、身、手；爬行者咬在腿、脚
export const SCRATCH_PARTS = ["body", "hands"];
export const GRAB_BITE_PARTS = ["head", "body", "hands"];
export const CRAWL_BITE_PARTS = ["legs", "feet"];

// ---------- 防具（19 件） ----------
// armor 护甲（少掉的血）、scratch 防抓（只有身、手管）、bite 防咬、weight 重量、noise 噪音档、warmth 保暖、dur 耐久（0 = 不会坏）
// mods 改装位；fix 修一次要的材料（大约做它时的三分之一）；scrap 拆了还多少
export const ARMOR = {
  ragHood: { name: "破布头巾", slot: "head", armor: 0, bite: 5, weight: 0.3, noise: 0, warmth: 1, dur: 15, mods: 1, fix: { cloth: 1 }, scrap: { cloth: 1 }, look: { hat: "bandana" }, where: "自己做：布 1" },
  motoHelmet: { name: "摩托头盔", slot: "head", armor: 0.04, bite: 40, weight: 2, noise: 0, warmth: 0, dur: 40, mods: 1, fix: { scrap: 1, cloth: 1 }, scrap: { scrap: 2 }, look: { hat: "moto" }, where: "废弃居民区的车库" },
  riotHelmet: { name: "防暴头盔", slot: "head", armor: 0.06, bite: 65, weight: 3, noise: 0, warmth: 0, dur: 60, mods: 2, fix: { scrap: 2, parts: 1 }, scrap: { scrap: 3, parts: 1 }, look: { hat: "riot" }, where: "打退灰隼团袭击后掉落；旧部队的军需藏货" },
  headlamp: { name: "头灯", slot: "head", armor: 0, bite: 0, weight: 0.5, noise: 0, warmth: 0, dur: 0, mods: 0, scrap: { scrap: 1 }, light: true, look: { hat: "lamp" }, where: "自己做：零件 1、废金属 2" },
  warmCoat: { name: "保温衣", slot: "body", armor: 0.05, scratch: 25, bite: 10, weight: 2, noise: 0, warmth: 4, dur: 0, mods: 1, scrap: { cloth: 2 }, look: { armor: "coat" }, where: "工作台：羊毛 2、布 1，或布 4" },
  leatherJacket: { name: "皮夹克", slot: "body", armor: 0.1, scratch: 45, bite: 25, weight: 3, noise: 0, warmth: 1, dur: 50, mods: 1, fix: { cloth: 1 }, scrap: { cloth: 1 }, look: { armor: "leather" }, where: "废弃居民区的旧衣柜；唐九的商队" },
  tireArmor: { name: "废胎护甲", slot: "body", armor: 0.18, scratch: 50, bite: 40, weight: 6, noise: 1, warmth: 0, dur: 60, mods: 2, fix: { scrap: 2, cloth: 1 }, scrap: { scrap: 2, cloth: 1 }, look: { armor: "tire" }, where: "自己做：废金属 4、布 2" },
  steelVest: { name: "钢板背心", slot: "body", armor: 0.35, scratch: 60, bite: 50, weight: 12, noise: 2, warmth: 0, dur: 120, mods: 2, fix: { scrap: 4, parts: 1 }, scrap: { scrap: 5, parts: 1 }, look: { armor: "steel" }, where: "图纸在工业仓库（守卫看着）：废金属 10、零件 3" },
  riotSuit: { name: "防暴服", slot: "body", armor: 0.25, scratch: 80, bite: 70, weight: 7, noise: 1, warmth: 0, dur: 90, mods: 2, fix: { cloth: 2, scrap: 2 }, scrap: { cloth: 2, scrap: 2 }, look: { armor: "riot" }, where: "打退灰隼团袭击后掉落；每日抉择" },
  ragGloves: { name: "破布护手", slot: "hands", armor: 0, scratch: 15, bite: 5, weight: 0.2, noise: 0, warmth: 0, dur: 15, mods: 1, fix: { cloth: 1 }, scrap: { cloth: 1 }, look: { gloves: "rag" }, where: "开局就有，布 1 能再做" },
  workGloves: { name: "工作手套", slot: "hands", armor: 0, scratch: 30, bite: 10, weight: 0.3, noise: 0, warmth: 1, dur: 30, mods: 1, fix: { cloth: 1 }, scrap: { cloth: 1 }, look: { gloves: "work" }, where: "废弃居民区的旧衣柜；工业仓库的工具架" },
  leatherBracers: { name: "皮护臂", slot: "hands", armor: 0.03, scratch: 45, bite: 35, weight: 1, noise: 0, warmth: 0, dur: 40, mods: 1, fix: { cloth: 1 }, scrap: { cloth: 1 }, look: { gloves: "leather" }, where: "自己做：布 2、废金属 1" },
  steelBracers: { name: "钢片护臂", slot: "hands", armor: 0.05, scratch: 60, bite: 60, weight: 2, noise: 1, warmth: 0, dur: 60, mods: 2, fix: { scrap: 2 }, scrap: { scrap: 2 }, look: { gloves: "steel" }, where: "图纸找老周买：废金属 5、布 1" },
  jeans: { name: "牛仔裤", slot: "legs", armor: 0, bite: 10, weight: 1, noise: 0, warmth: 1, dur: 30, mods: 1, fix: { cloth: 1 }, scrap: { cloth: 1 }, look: { legs: "jeans" }, where: "废弃居民区的旧衣柜" },
  kneePads: { name: "护膝护腿", slot: "legs", armor: 0.04, bite: 30, weight: 2, noise: 0, warmth: 0, dur: 50, mods: 1, fix: { scrap: 1 }, scrap: { scrap: 1 }, down: 0.7, look: { legs: "knee" }, where: "自己做：布 1、废金属 2" },
  motoGreaves: { name: "摩托护腿", slot: "legs", armor: 0.06, bite: 45, weight: 3, noise: 0, warmth: 0, dur: 60, mods: 2, fix: { scrap: 2 }, scrap: { scrap: 2 }, look: { legs: "moto" }, where: "废弃居民区的车库；旧站商街的鞋摊" },
  clothShoes: { name: "布鞋", slot: "feet", armor: 0, bite: 0, weight: 0.5, noise: 0, warmth: 0, dur: 0, mods: 0, look: { boots: "cloth" }, where: "开局就有", scrap: { cloth: 1 } },
  softShoes: { name: "软底鞋", slot: "feet", armor: 0, bite: 0, weight: 0.3, noise: -1, warmth: 0, dur: 30, mods: 1, fix: { cloth: 1 }, scrap: { cloth: 1 }, runCost: 0.85, look: { boots: "soft" }, where: "旧站商街的鞋摊" },
  workBoots: { name: "工装靴", slot: "feet", armor: 0.02, bite: 40, weight: 1.5, noise: 1, warmth: 1, dur: 60, mods: 2, fix: { scrap: 1, cloth: 1 }, scrap: { scrap: 1, cloth: 1 }, stomp: 2, look: { boots: "work" }, where: "工业仓库的工装柜" },
};
export const ARMOR_IDS = Object.keys(ARMOR);

// ---------- 武器（20 种） ----------
// kind：blunt 钝器 / blade 利器 / pole 长柄 / ranged 远程 / throw 投掷 / trap 陷阱
// 近战：dmg 伤害、cd 间隔、range 范围、arc 扇形半角、knock 击退、pierce 打重甲正面剩几成、stamina 每下体力、noise 声音、dur 耐久
export const MELEE = {
  club: { name: "木棍", kind: "blunt", dmg: 20, cd: 0.5, range: 65, arc: 1.2, knock: 20, pierce: 0.75, stamina: 7, noise: 90, dur: 60, mods: 1, fix: { wood: 2 }, scrap: { wood: 2 } },
  bat: { name: "钉子球棒", kind: "blunt", dmg: 30, cd: 0.55, range: 68, arc: 1.2, knock: 22, pierce: 0.75, stamina: 8, noise: 100, dur: 80, mods: 1, bleed: 0.3, fix: { wood: 1, scrap: 1 }, scrap: { wood: 2, scrap: 1 } },
  pipe: { name: "铁管", kind: "blunt", dmg: 26, cd: 0.55, range: 70, arc: 1.15, knock: 28, pierce: 0.85, stamina: 8, noise: 120, dur: 120, mods: 2, fix: { scrap: 2 }, scrap: { scrap: 2 } },
  crowbar: { name: "回收撬棍", kind: "blunt", dmg: 24, cd: 0.6, range: 68, arc: 1.0, knock: 18, pierce: 0.9, stamina: 8, noise: 110, dur: 0, mods: 1, perLevel: 3, scrap: {} },
  sledge: { name: "大锤", kind: "blunt", heavy: true, dmg: 70, cd: 1.1, range: 75, arc: 1.2, knock: 60, pierce: 1, stamina: 16, noise: 160, dur: 150, mods: 2, down: 1.2, fix: { scrap: 3, wood: 1 }, scrap: { scrap: 4, wood: 1 } },
  knife: { name: "菜刀", kind: "blade", dmg: 20, cd: 0.3, range: 50, arc: 0.6, knock: 4, pierce: 0.3, stamina: 4, noise: 30, dur: 50, mods: 1, sneak: 2.5, fix: { scrap: 1 }, scrap: { scrap: 1 } },
  machete: { name: "砍刀", kind: "blade", dmg: 34, cd: 0.45, range: 62, arc: 0.9, knock: 8, pierce: 0.35, stamina: 7, noise: 50, dur: 90, mods: 2, fix: { scrap: 2 }, scrap: { scrap: 3 } },
  axe: { name: "消防斧", kind: "blade", heavy: true, dmg: 45, cd: 0.75, range: 70, arc: 1.0, knock: 18, pierce: 0.6, stamina: 11, noise: 140, dur: 110, mods: 2, maxHits: 2, fix: { scrap: 2, wood: 1 }, scrap: { scrap: 3 } },
  spear: { name: "削尖木矛", kind: "pole", dmg: 28, cd: 0.6, range: 95, arc: 0.5, knock: 34, pierce: 0.5, stamina: 7, noise: 50, dur: 30, mods: 1, brace: 2, fix: { wood: 1 }, scrap: { wood: 1 } },
  ironspear: { name: "铁头矛", kind: "pole", dmg: 36, cd: 0.6, range: 105, arc: 0.5, knock: 36, pierce: 0.7, stamina: 8, noise: 60, dur: 90, mods: 2, brace: 2, fix: { scrap: 2 }, scrap: { scrap: 2 } },
};
// 远程：弹弓、弩是新的；三把枪沿用原来的数，只加破甲、击退和耐久
export const RANGED = {
  slingshot: { name: "弹弓", kind: "ranged", dmg: 8, cd: 0.6, range: 300, knock: 6, pierce: 0.2, stamina: 3, noise: 20, dur: 60, ammo: "stone", speed: 620, stiff: 0.3, mods: 0, fix: { wood: 1 }, scrap: { wood: 1 } },
  crossbow: { name: "自制弩", kind: "ranged", dmg: 55, cd: 1.4, range: 450, knock: 20, pierce: 0.8, stamina: 0, noise: 40, dur: 120, ammo: "bolt", speed: 760, keep: 0.7, mods: 0, fix: { wood: 2, scrap: 1 }, scrap: { wood: 3, scrap: 2, parts: 1 } },
  pistol: { name: "手枪", kind: "ranged", gun: true, knock: 12, pierce: 0.6, dur: 300, mods: 0, fix: { scrap: 3, parts: 1 }, scrap: { scrap: 4, parts: 1 } },
  shotgun: { name: "霰弹枪", kind: "ranged", gun: true, knock: 60, pierce: 0.5, dur: 200, mods: 0, fix: { scrap: 4, parts: 1 }, scrap: { scrap: 6, parts: 2 } },
  rifle: { name: "栓动步枪", kind: "ranged", gun: true, knock: 40, pierce: 1, dur: 150, mods: 0, fix: { scrap: 5, parts: 2 }, scrap: { scrap: 8, parts: 2 } },
};
export const JAM = { below: 0.2, chance: 0.08, time: 1 };
// 投掷：G 键或投掷栏
export const THROWN = {
  stone: { name: "诱敌石", kind: "throw", dmg: 6, cd: 0.5, range: 260, noise: 200, ring: 2.8, stamina: 2, interrupt: true },
  firecracker: { name: "鞭炮", kind: "throw", dmg: 0, cd: 1, range: 300, noise: 400, ring: 3, stamina: 2 },
  molotov: { name: "燃烧瓶", kind: "throw", dmg: 15, cd: 1, range: 260, noise: 250, ring: 1.5, stamina: 3, fire: { r: 60, time: 3 } },
};
// 陷阱：快捷键 7，摆在脚前
export const TRAPS = {
  bearTrap: { name: "捕兽夹", kind: "trap", dmg: 30, hold: 4, uses: 3, noise: 80, place: 1 },
  spikeBoard: { name: "钉板", kind: "trap", dmg: 20, slow: 0.5, slowTime: 2, uses: 6, noise: 30, place: 1 },
};
export const TRAP_IDS = Object.keys(TRAPS);
export const MELEE_IDS = Object.keys(MELEE);
export const RANGED_IDS = Object.keys(RANGED);
export const THROW_IDS = Object.keys(THROWN);
export const KIND_NAMES = { blunt: "钝器", blade: "利器", pole: "长柄", ranged: "远程", throw: "投掷", trap: "陷阱" };
// 哪一栏放哪种
export const slotOf = (id) => ARMOR[id]?.slot || (MELEE[id] ? "melee" : RANGED[id] ? "ranged" : THROWN[id] ? "throw" : null);
export const gearDef = (id) => ARMOR[id] || MELEE[id] || RANGED[id] || null;
// 有耐久的东西（坏了能修）
export const durOf = (id) => gearDef(id)?.dur || 0;

// 武器从哪里来（物品详情的“来源”）
export const WEAPON_WHERE = {
  club: "开局就有；木材 4 随身做",
  bat: "武器台：木材 4、废金属 2",
  pipe: "工业仓库装卸区；或武器台：废金属 4",
  crowbar: "原来开箱子用的工具",
  sledge: "图纸（北线货运站、唐九的商队）：废金属 8、木材 2",
  knife: "废弃居民区的厨房",
  machete: "图纸（旧医院救护车旁）：废金属 6、零件 1",
  axe: "旧医院的消防柜、北线货运站的工具箱",
  spear: "开局就能做：木材 3",
  ironspear: "武器台：铁管 + 菜刀",
  slingshot: "随身做：木材 2、废金属 1；打石材",
  crossbow: "图纸（蔡眼镜的改枪图纸）：木材 6、废金属 4、零件 2；也可能从受伤的猎人那里得到",
  bolt: "随身做：木材 1 削 4 支；射出去的七成能捡回",
  firecracker: "制作台：废金属 1、布 1",
  molotov: "图纸（检疫科研园）：布 1、松脂 2",
  bearTrap: "武器台：废金属 4、零件 1",
  spikeBoard: "随身做：木材 3、废金属 2",
  diySuppressor: "图纸（蔡眼镜的改枪图纸）：废金属 2、布 1",
};

// ---------- 改装 ----------
// for：能装在什么上（武器的 kind，或防具的栏位）；cost 材料；n 用次数（磨刃、消音器会用完）
export const MODS = {
  nails: { name: "钉子", for: ["club", "pipe", "crowbar", "sledge"], cost: { scrap: 2 }, text: "伤害 +8，打中三成会让感染者流血（每秒 3，3 秒）" },
  wrap: { name: "缠布加固", for: ["blunt", "blade", "pole"], cost: { cloth: 1 }, text: "耐久上限 +40%" },
  handle: { name: "加长柄", for: ["blunt", "pole"], cost: { wood: 2 }, text: "范围 +15，间隔 +10%" },
  weight: { name: "配重", for: ["blunt"], cost: { scrap: 3 }, text: "击退 +50%（木棍装上到 30，能打断出手），每下多花 2 体力" },
  edge: { name: "磨刃", for: ["blade"], cost: { stone: 1 }, n: 30, text: "伤害 +15%，管 30 下，用完再磨" },
  diySuppressor: { name: "自制消音器", for: ["pistol", "rifle"], cost: { diySuppressor: 1 }, n: 25, text: "噪音 −55%，伤害 −10%，只能用 25 发" },
  padding: { name: "加衬垫", for: ["body", "hands"], cost: { cloth: 2 }, text: "防抓 +15%" },
  plate: { name: "钢片", for: ["body", "hands", "legs"], cost: { scrap: 3 }, text: "护甲 +6%，重量 +1" },
  quiet: { name: "消音布条", for: ["head", "body", "hands", "legs", "feet"], cost: { cloth: 1 }, text: "噪音 −1 档" },
};
export const MOD_IDS = Object.keys(MODS);
export function modFits(mod, id) {
  const m = MODS[mod];
  if (!m) return false;
  if (m.for.includes(id)) return true;
  const def = gearDef(id);
  if (!def) return false;
  if (MELEE[id] && m.for.includes(MELEE[id].kind)) return mod !== "nails";
  if (ARMOR[id] && m.for.includes(ARMOR[id].slot)) return true;
  return false;
}

// ---------- 图纸 ----------
// 拿到就学会，每张只给一次
export const BLUEPRINTS = {
  bp_machete: { name: "砍刀图纸", makes: ["machete"], where: "旧医院救护车旁的急救箱；唐九的商队" },
  bp_steelVest: { name: "钢板背心图纸", makes: ["steelVest"], where: "工业仓库守卫身后的图纸筒；唐九的商队" },
  bp_sledge: { name: "大锤图纸", makes: ["sledge"], where: "北线货运站的工具箱；唐九的商队；每日抉择" },
  bp_molotov: { name: "燃烧瓶图纸", makes: ["molotov"], where: "检疫科研园的储物柜；唐九的商队" },
  bp_bracer: { name: "钢片护臂图纸", makes: ["steelBracers"], where: "集市的老周有卖" },
  bp_crossbow: { name: "自制弩图纸", makes: ["crossbow"], where: "蔡眼镜的“改枪图纸”（偷盗宝贝）" },
  bp_suppressor: { name: "自制消音器图纸", makes: ["diySuppressor"], where: "蔡眼镜的“改枪图纸”（偷盗宝贝）" },
};
export const BP_IDS = Object.keys(BLUEPRINTS);
// 唐九每次来卖一张，轮着来
export const CARAVAN_BPS = ["bp_machete", "bp_sledge", "bp_steelVest", "bp_molotov"];

// ---------- 物品 ----------
const ITEM_PRICE = {
  ragHood: [3, 8], motoHelmet: [24, 60], riotHelmet: [40, 0], headlamp: [18, 45], leatherJacket: [30, 80], tireArmor: [26, 0], steelVest: [70, 0], riotSuit: [60, 0],
  ragGloves: [2, 6], workGloves: [8, 20], leatherBracers: [12, 0], steelBracers: [26, 0], jeans: [8, 20], kneePads: [10, 0], motoGreaves: [22, 55], clothShoes: [0, 0], softShoes: [12, 30], workBoots: [18, 45],
  bat: [14, 0], pipe: [10, 30], sledge: [40, 0], knife: [8, 22], machete: [28, 0], axe: [30, 0], spear: [4, 0], ironspear: [24, 0], slingshot: [6, 0], crossbow: [50, 0],
  bolt: [1, 3], firecracker: [5, 14], molotov: [10, 0], bearTrap: [16, 0], spikeBoard: [6, 0], diySuppressor: [10, 0],
};
const gearItem = (id, name, extra) => {
  const [sell, buy] = ITEM_PRICE[id] || [0, 0];
  ITEMS[id] ??= { name, gear: id, type: "gear", ...(sell ? { sell } : {}), ...(buy ? { buy } : {}), ...extra };
};
const armorDesc = (a) =>
  [
    SLOT_NAMES[a.slot] + "栏",
    a.armor ? "护甲 " + Math.round(a.armor * 100) + "%" : "",
    a.scratch ? "防抓 " + a.scratch + "%" : "",
    a.bite ? "防咬 " + a.bite + "%" : "",
    "重量 " + a.weight,
    a.noise ? "噪音 " + (a.noise > 0 ? "+" : "") + a.noise : "",
    a.warmth ? "保暖 " + a.warmth : "",
    a.dur ? "耐久 " + a.dur : "不会坏",
    a.runCost ? "跑步少耗 " + Math.round((1 - a.runCost) * 100) + "% 体力" : "",
    a.stomp ? "踩爬行者伤害 ×" + a.stomp : "",
    a.down ? "被扑倒、撞倒的时间 −" + Math.round((1 - a.down) * 100) + "%" : "",
    a.light ? "照亮前方，不占手；夜里感染者从远处就看得见你" : "",
  ]
    .filter(Boolean)
    .join(" · ");
for (const [id, a] of Object.entries(ARMOR)) {
  if (id === "warmCoat") {
    Object.assign(ITEMS.warmCoat, { gear: id, desc: "身体栏的防具。" + armorDesc(a) + "。穿在身上，寒潮里在暖区外不会冻得更饿。" });
    continue;
  }
  gearItem(id, a.name, { desc: armorDesc(a) + "。" });
}
const meleeDesc = (w) => KIND_NAMES[w.kind] + " · 伤害 " + w.dmg + " · 间隔 " + w.cd + " 秒 · 击退 " + w.knock + " · 破甲 " + Math.round(w.pierce * 100) + "% · 声音 " + w.noise + (w.dur ? " · 耐久 " + w.dur : " · 不会坏");
for (const [id, w] of Object.entries(MELEE)) {
  if (ITEMS[id]) {
    Object.assign(ITEMS[id], { gear: id, desc: id === "crowbar" ? "开箱子的工具，也能当钝器打。" + meleeDesc(w) + "，每升一级 +3。" : meleeDesc(w) + "。" });
    continue;
  }
  gearItem(id, w.name, { type: "weapon", desc: meleeDesc(w) + "。" });
}
gearItem("slingshot", "弹弓", { type: "weapon", desc: "打石材。伤害 8，打中就打断预兆，让奔跑者僵 0.3 秒。声音很小。" });
gearItem("crossbow", "自制弩", { type: "weapon", desc: "伤害 55 · 间隔 1.4 秒 · 声音 40 · 用箭，七成能捡回。安静地解决尖叫者。" });
gearItem("bolt", "箭", { type: "resource", desc: "自制弩用的箭。木材 1 做 4 支。" });
gearItem("firecracker", "鞭炮", { type: "gear", desc: "投掷栏。扔出去响 3 秒，400 以内的感染者都会过去看。" });
gearItem("molotov", "燃烧瓶", { type: "gear", desc: "投掷栏。落地烧 3 秒，每秒 15 伤害，重甲也挡不住。" });
gearItem("bearTrap", "捕兽夹", { type: "gear", desc: "陷阱。按 7 选中，摆在脚前：夹住 4 秒、伤害 30，能用 3 次。" });
gearItem("spikeBoard", "钉板", { type: "gear", desc: "陷阱。按 7 选中，摆在脚前：每次伤害 20、减速一半 2 秒，能用 6 次。" });
gearItem("diySuppressor", "自制消音器", { type: "gear", desc: "在武器台装到手枪或步枪上：噪音 −55%、伤害 −10%，只能用 25 发。" });
for (const [id, w] of Object.entries(RANGED)) if (ITEMS[id] && w.gun) ITEMS[id].gear = id;
ITEMS.stone.desc = (ITEMS.stone.desc || "") + "也是诱敌石：G 键或投掷栏扔出去，落地响 2.8 秒，砸中感染者能打断它出手。";
for (const [id, b] of Object.entries(BLUEPRINTS)) ITEMS[id] ??= { name: b.name, type: "blueprint", blueprint: id, protected: true, sell: 0, buy: id === "bp_bracer" ? 110 : 0, desc: "拿到就学会：能在武器台做" + b.makes.map((m) => ITEMS[m]?.name || m).join("、") + "。" };
ITEMS.bp_bracer.buy = 110;
// 新物品的小图：画在 gear-sprites.js 的图集里，编号写成 "g0"、"g1"……
export const GEAR_ICON_IDS = [
  "ragHood", "motoHelmet", "riotHelmet", "headlamp", "leatherJacket", "tireArmor", "steelVest", "riotSuit",
  "ragGloves", "workGloves", "leatherBracers", "steelBracers", "jeans", "kneePads", "motoGreaves", "clothShoes",
  "softShoes", "workBoots", "bat", "pipe", "sledge", "knife", "machete", "axe",
  "spear", "ironspear", "slingshot", "crossbow", "bolt", "firecracker", "molotov", "bearTrap",
  "spikeBoard", "diySuppressor", "bp_machete", "bp_steelVest", "bp_sledge", "bp_molotov", "bp_bracer", "bp_crossbow",
  "bp_suppressor",
];
GEAR_ICON_IDS.forEach((id, i) => {
  if (ITEMS[id] && ITEMS[id].icon == null) ITEMS[id].icon = "g" + i;
});
// 原来的说明跟着新数改
ITEMS.club.desc = meleeDesc(MELEE.club) + "。";
ITEMS.bandage.desc = "5 秒内慢慢回 35 生命，顺便止血。打到一半吃药救不了急。";
ITEMS.medkit.desc = "8 秒内慢慢回 75 生命；发烧时吃一份，再睡一晚就退烧。";

// ---------- 武器的引擎数（WEAPONS 里的 damage/range/cooldown/noise） ----------
for (const [id, w] of Object.entries(MELEE)) WEAPONS[id] = { ...(WEAPONS[id] || {}), damage: w.dmg, range: w.range, cooldown: w.cd, noise: w.noise, melee: true };
for (const id of ["slingshot", "crossbow"]) {
  const w = RANGED[id];
  WEAPONS[id] = { damage: w.dmg, range: w.range, cooldown: w.cd, noise: w.noise, speed: w.speed, bow: true };
}

// ---------- 配方 ----------
// station：null = 随身做；workbench 制作台；weaponbench 武器工作台。unlock 'bp:xx' = 要先学会那张图纸
const NEW_RECIPES = [
  { id: "spear", out: { spear: 1 }, cost: { wood: 3 }, station: null, desc: "削尖一根木杆。范围远，正面顶住扑来的奔跑者伤害翻倍。" },
  { id: "slingshot", out: { slingshot: 1 }, cost: { wood: 2, scrap: 1 }, station: null, desc: "打石材的弹弓：打断尖叫、让奔跑者僵一下。" },
  { id: "spikeBoard", out: { spikeBoard: 1 }, cost: { wood: 3, scrap: 2 }, station: null, desc: "钉板：摆在路上，踩中的感染者受伤、走得慢。" },
  { id: "ragHood", out: { ragHood: 1 }, cost: { cloth: 1 }, station: null, desc: "一块布包住头，挡一点咬。" },
  { id: "ragGloves", out: { ragGloves: 1 }, cost: { cloth: 1 }, station: null, desc: "缠在手上的破布，挡一点抓伤。" },
  { id: "bolt", out: { bolt: 4 }, cost: { wood: 1 }, station: null, desc: "削 4 支箭。" },
  { id: "bat", out: { bat: 1 }, cost: { wood: 4, scrap: 2 }, station: "weaponbench", desc: "钉满钉子的球棒，打出血。" },
  { id: "pipe", out: { pipe: 1 }, cost: { scrap: 4 }, station: "weaponbench", desc: "一截铁管：击退强，破甲好。" },
  { id: "ironspear", out: { ironspear: 1 }, cost: { pipe: 1, knife: 1 }, station: "weaponbench", desc: "把菜刀绑在铁管头上。" },
  { id: "tireArmor", out: { tireArmor: 1 }, cost: { scrap: 4, cloth: 2 }, station: "weaponbench", desc: "旧轮胎切片缝在布上，挡咬、挡抓。" },
  { id: "bearTrap", out: { bearTrap: 1 }, cost: { scrap: 4, parts: 1 }, station: "weaponbench", desc: "夹住感染者 4 秒。" },
  { id: "leatherBracers", out: { leatherBracers: 1 }, cost: { cloth: 2, scrap: 1 }, station: "workbench", desc: "皮护臂：被抓住时手不容易被咬。" },
  { id: "kneePads", out: { kneePads: 1 }, cost: { cloth: 1, scrap: 2 }, station: "workbench", desc: "护膝护腿：被扑倒、撞倒后站起来快三成。" },
  { id: "headlamp", out: { headlamp: 1 }, cost: { parts: 1, scrap: 2 }, station: "workbench", desc: "照亮前方，不占手；夜里感染者也更早看到你。" },
  { id: "firecracker", out: { firecracker: 1 }, cost: { scrap: 1, cloth: 1 }, station: "workbench", desc: "一串鞭炮：把感染者引开。" },
  { id: "machete", out: { machete: 1 }, cost: { scrap: 6, parts: 1 }, station: "weaponbench", unlock: "bp:bp_machete", desc: "砍刀：快，砍腿让感染者摔成爬行者。" },
  { id: "sledge", out: { sledge: 1 }, cost: { scrap: 8, wood: 2 }, station: "weaponbench", unlock: "bp:bp_sledge", desc: "大锤：慢，一下打倒，重甲也挡不住。" },
  { id: "steelVest", out: { steelVest: 1 }, cost: { scrap: 10, parts: 3 }, station: "weaponbench", unlock: "bp:bp_steelVest", desc: "护甲最高，但又重又吵。" },
  { id: "steelBracers", out: { steelBracers: 1 }, cost: { scrap: 5, cloth: 1 }, station: "weaponbench", unlock: "bp:bp_bracer", desc: "钢片护臂：手上防咬六成。" },
  { id: "crossbow", out: { crossbow: 1, bolt: 6 }, cost: { wood: 6, scrap: 4, parts: 2 }, station: "weaponbench", unlock: "bp:bp_crossbow", desc: "安静的远程武器，附 6 支箭。" },
  { id: "diySuppressor", out: { diySuppressor: 1 }, cost: { scrap: 2, cloth: 1 }, station: "weaponbench", unlock: "bp:bp_suppressor", desc: "装在手枪或步枪上，用 25 发。" },
  { id: "molotov", out: { molotov: 1 }, cost: { cloth: 1, resin: 2 }, station: "workbench", unlock: "bp:bp_molotov", desc: "一瓶松脂，点着了扔。" },
];
for (const r of NEW_RECIPES) if (!RECIPES.some((x) => x.id === r.id)) RECIPES.push(r);
// 弹药变贵：2 废金属做 8 发（原来 12 发）
const ammo = RECIPES.find((r) => r.id === "ammo");
if (ammo) Object.assign(ammo, { out: { ammo: 8 }, desc: "制作 8 发弹药。" });

// ---------- 远征行囊：新武器也要装进去才能用 ----------
const kit = (id, n, shape, name) => (KIT[id] ??= { name: name || ITEMS[id]?.name || id, item: id, n, shape });
for (const id of ["knife", "machete"]) kit(id, 1, [[0, 0]]);
for (const id of ["bat", "pipe", "crowbar"]) kit(id, 1, [[0, 0], [0, 1]]);
for (const id of ["spear", "ironspear", "axe", "sledge"]) kit(id, 1, [[0, 0], [0, 1], [0, 2]]);
kit("slingshot", 1, [[0, 0]]);
kit("crossbow", 1, [[0, 0], [1, 0], [0, 1]]);
kit("bolt", 8, [[0, 0]], "8 支箭");
kit("firecracker", 2, [[0, 0]], "2 串鞭炮");
kit("molotov", 1, [[0, 0]]);
kit("bearTrap", 1, [[0, 0]]);
kit("spikeBoard", 1, [[0, 0]]);

// ---------- 每张图怎么摆（第 1–3 天 / 第 4–7 天 / 第 8 天以后） ----------
// 每格 [种类, x, y, 群]；“群”相同的发现你时一起转头。坐标进地图时会自己挪到能站的地方。
const P = (type, x, y, pack) => [type, x, y, pack];
const RES_1 = [P("slow", 450, 500, "a"), P("slow", 470, 430, "a"), P("slow", 520, 470, "a"), P("slow", 720, 700, "b"), P("slow", 650, 690, "b"), P("screamer", 760, 740, "b"), P("runner", 1120, 540, "c"), P("runner", 1170, 560, "c"), P("slow", 1100, 470, "c"), P("slow", 900, 600, "")];
const RES_2 = [P("slow", 450, 500, "a"), P("slow", 470, 430, "a"), P("slow", 520, 470, "a"), P("slow", 400, 520, "a"), P("slow", 720, 700, "b"), P("slow", 650, 690, "b"), P("slow", 600, 720, "b"), P("screamer", 760, 740, "b"), P("runner", 1150, 470, "c"), P("runner", 1210, 465, "c"), P("slow", 1100, 455, "c"), P("slow", 1250, 480, "c")];
const RES_3 = [...RES_2, P("slow", 900, 600, "d"), P("screamer", 940, 560, "d")];
const HOS_1 = [P("slow", 860, 380, "a"), P("slow", 790, 390, "a"), P("screamer", 880, 330, "a"), P("armor", 1200, 520, "b"), P("slow", 1220, 470, "b"), P("slow", 1160, 470, "b"), P("runner", 560, 700, "c"), P("runner", 520, 690, "c"), P("slow", 470, 700, "c"), P("screamer", 900, 620, "d"), P("slow", 700, 520, "d"), P("slow", 1000, 560, "d")];
const HOS_2 = [P("slow", 860, 380, "a"), P("slow", 790, 390, "a"), P("slow", 760, 340, "a"), P("screamer", 880, 330, "a"), P("armor", 1200, 470, "b"), P("slow", 1240, 430, "b"), P("slow", 1160, 440, "b"), P("slow", 1290, 480, "b"), P("runner", 560, 760, "c"), P("runner", 520, 770, "c"), P("slow", 470, 760, "c"), P("slow", 610, 780, "c"), P("screamer", 900, 620, "d"), P("armor", 700, 480, "d")];
const WAR_1 = [P("slow", 480, 500, "a"), P("slow", 500, 430, "a"), P("runner", 540, 470, "a"), P("slow", 760, 710, "b"), P("slow", 690, 700, "b"), P("screamer", 780, 740, "b"), P("armor", 1180, 470, "c"), P("slow", 1220, 430, "c"), P("slow", 1150, 440, "c"), P("runner", 900, 620, "d"), P("slow", 650, 520, "d"), P("slow", 1000, 560, "d"), P("elite", 1380, 500, "")];
const WAR_2 = [...WAR_1.slice(0, 12), P("slow", 440, 520, "a"), P("armor", 950, 640, "d"), WAR_1[12]];
// 第 8 天以后医院、仓库不再加只数（方案原来各再加两只），只是每只更强：
// 验收模拟里带后期装备去这两处，按方案的只数一成五会死，回到第 4–7 天的只数是一成和三成以下
export const RUIN_PACKS = { residential: [RES_1, RES_2, RES_3], hospital: [HOS_1, HOS_2, HOS_2], warehouse: [WAR_1, WAR_2, WAR_2] };
// 地图上写的危险说明跟着改：白天有几只（夜里外面另多四成游荡的）
if (REGIONS.residential) REGIONS.residential.risk = "低危险 · 白天 " + RES_1.length + "–" + RES_3.length + " 只，三四只一群";
if (REGIONS.hospital) REGIONS.hospital.risk = "中危险 · 白天 " + HOS_1.length + "–" + HOS_2.length + " 只，有重甲和尖叫者";
if (REGIONS.warehouse) REGIONS.warehouse.risk = "高危险 · 精英守卫 · 白天 " + WAR_1.length + "–" + WAR_2.length + " 只";
// 地区（雨巷住区、检疫科研园、北线货运站）：原来 6 只，再加 1 / 2 / 3 只，两三只一群
export const DISTRICT_EXTRA = [
  [P("slow", 580, 410, "")],
  [P("slow", 580, 410, ""), P("runner", 840, 690, "")],
  [P("slow", 580, 410, ""), P("runner", 840, 690, ""), P("screamer", 1140, 850, "")],
];
// 边境（沉湾船坞、地底避难城、余晖档案岛）：原来 3 只，再加 1 / 2 / 3 只，两只一群
export const BEYOND_EXTRA = [
  [P("slow", 910, 480, "")],
  [P("slow", 910, 480, ""), P("slow", 1230, 590, "")],
  [P("slow", 910, 480, ""), P("slow", 1230, 590, ""), P("runner", 640, 840, "")],
];
export const COUNTS = {
  residential: [10, 12, 14],
  hospital: [12, 14, 16],
  warehouse: [13, 15, 17],
};

// ---------- 找得到装备的地方（只给一次） ----------
// guard：守卫活着时打不开
export const GEAR_SPOTS = {
  residential: [
    { id: "garage", name: "车库储物柜", x: 1260, y: 450, items: { motoHelmet: 1, motoGreaves: 1 } },
    { id: "wardrobe", name: "旧衣柜", x: 330, y: 470, items: { leatherJacket: 1, jeans: 1, workGloves: 1 } },
    { id: "kitchen", name: "厨房抽屉", x: 760, y: 820, items: { knife: 1 } },
  ],
  hospital: [
    { id: "ambulance", name: "救护车急救箱", x: 560, y: 800, items: { bp_machete: 1, bandage: 2 } },
    { id: "fire", name: "消防栓箱", x: 900, y: 450, items: { axe: 1 } },
  ],
  warehouse: [
    { id: "rack", name: "装卸区工具架", x: 360, y: 480, items: { pipe: 1, workGloves: 1 } },
    { id: "locker", name: "工装柜", x: 800, y: 830, items: { workBoots: 1 } },
    { id: "plans", name: "图纸筒", x: 1420, y: 470, items: { bp_steelVest: 1 }, guard: true },
  ],
  railDepot: [{ id: "tools", name: "货运站工具箱", x: 840, y: 610, items: { bp_sledge: 1, axe: 1 } }],
  quarantine: [{ id: "lab", name: "科研园储物柜", x: 840, y: 610, items: { bp_molotov: 1, resin: 2 } }],
  stationMarket: [{ id: "shoes", name: "鞋摊", x: 840, y: 610, items: { softShoes: 1, motoGreaves: 1 } }],
};

// ---------- 偷盗宝贝里多出来的 ----------
if (TREASURES.gunPlans && !TREASURES.gunPlans.text.includes("自制弩")) TREASURES.gunPlans.text += "，还附带自制弩和自制消音器的图纸";
if (TREASURES.armyList && !TREASURES.armyList.text.includes("防暴头盔")) TREASURES.armyList.text = TREASURES.armyList.text.replace("药包 2", "药包 2、防暴头盔 1");
if (THIEF_SPOTS.stash?.ge?.items) THIEF_SPOTS.stash.ge.items.riotHelmet = 1;

// ---------- 6 张新的每日抉择 ----------
// ["bp", 图纸] 学会一张图纸（已经会了就换成废金属 4）；["fixGear"] 修满身上最旧的一件；
// ["gear", {件: 数}] 给装备，不跟着后面几段的“奖励 ×2”翻倍（一件就是一件）
const needsRepair = (e) => (e.wornIds?.().some((id) => gearDef(id)?.dur && e.cond(id).d < e.cond(id).m) ? "" : "身上的装备都是好的，不用修");
const NEW_CARDS = {
  G01: { pack: "gear", cat: "luck", name: "受伤的猎人", text: "一个腿上夹着兽夹的猎人坐在路边，旁边放着一把自制的弩。", opts: [
    { label: "帮他包扎", cost: { bandage: 1 }, fx: [["gear", { crossbow: 1 }], ["give", { bolt: 6 }], ["rep", 1]], note: "他把弩送给了你" },
    { label: "拿干粮换他的箭", cost: { bread: 2 }, fx: [["give", { bolt: 8 }]] },
    { label: "绕开", fx: [] },
  ] },
  G02: { pack: "gear", cat: "trade", name: "铁匠的徒弟", text: "集市来了个背着工具包的年轻人，说什么都能修。", opts: [
    { label: "请他修一件", pay: 30, req: needsRepair, fx: [["fixGear"]] },
    { label: "跟他学两手", cost: { bread: 1 }, fx: [["xp", "manufacturing", 20]] },
    { label: "不用了", fx: [] },
  ] },
  G03: { pack: "gear", cat: "scav", name: "警局地下室", when: (e) => e.s.day >= 4, text: "居民区警局地下室的铁门开了一条缝。", opts: [
    { label: "进去搜", p: 0.6, win: [["gear", { riotHelmet: 1 }], ["give", { ammo: 8 }]], lose: [["hp", -15], ["ambush", 3]], loseNote: "里面还关着几只感染者" },
    { label: "只拿门口的", fx: [["gear", { kneePads: 1 }]] },
    { label: "不进去", fx: [] },
  ] },
  G04: { pack: "gear", cat: "trade", name: "拉废铁的车", text: "一辆拉废铁的三轮车停在集市口，车上还压着几张图纸。", opts: [
    { label: "买一车废铁", pay: 40, fx: [["give", { scrap: 12 }]] },
    { label: "用零件换图纸", cost: { parts: 3 }, fx: [["bp", "bp_sledge"]] },
    { label: "不买", fx: [] },
  ] },
  G05: { pack: "gear", cat: "crisis", name: "林子里的火光", when: (e) => e.s.day >= 4, text: "北边树林里有火光，好像有人在烧东西。", opts: [
    { label: "去看看", p: 0.5, win: [["give", { molotov: 2, resin: 2 }]], lose: [["stamina", -20], ["ambush", 2]], loseNote: "撞上一群被火光引来的感染者" },
    { label: "远远看着", fx: [["xp", "exploration", 10]] },
    { label: "加固围栏", cost: { wood: 3 }, fx: [["rep", 1]] },
  ] },
  G06: { pack: "gear", cat: "scav", name: "旧军营的储物柜", when: (e) => e.s.day >= 6, text: "地图上标着一处旧军营，储物柜还锁着。", opts: [
    { label: "花时间撬开", fx: [["time", 60], ["gear", { riotSuit: 1 }]] },
    { label: "拆柜门", fx: [["give", { scrap: 6 }]] },
    { label: "不去", fx: [] },
  ] },
};
for (const [id, ev] of Object.entries(NEW_CARDS)) {
  if (EVENTS[id]) continue;
  EVENTS[id] = ev;
  EVENT_IDS.push(id);
}
export const GEAR_CARD_IDS = Object.keys(NEW_CARDS);

// ---------- 给第一次读进来的旧档 ----------
export const OLD_SAVE_GIFT = { motoHelmet: 1, leatherJacket: 1, workGloves: 1, jeans: 1 };
export const GRACE_DAYS = 3;
