// v0.24.0「暗涌」的数：废墟里每天亮几个柜子、按柜子种类和四档稀有度抽东西、感染者身上掉什么、
// 每天三成五的机会出一件废墟小事件、感染者每两天换一套摆法、第 4 天和第 8 天各多两种感染者、三个头目、
// 电台早间播报、档案馆的战利品展柜、宵禁、几张和新内容挂钩的每日抉择。
// 表里的数是到手的数（统一高难度的三分之二折已经算进去）。
import { ITEMS, ZOMBIES, REGIONS } from "./data.js";
import { ZSTATS, RUIN_PACKS } from "./gear-data.js";
import { EVENTS, EVENT_IDS } from "./daily-data.js";
import { DECREES } from "./winter-data.js";
import { CUES } from "./feel-data.js";

export const U_SCHEMA = 1;
export const RUINS = ["residential", "hospital", "warehouse"];

// ================= 柜子 =================
export const TIERS = ["common", "uncommon", "rare", "precious"];
export const TIER_NAMES = { common: "普通", uncommon: "少见", rare: "稀有", precious: "珍贵" };
// 第 1–3 天 / 第 4–7 天 / 第 8 天以后：每段从普通挪 5%（少见 +4%、稀有 +1%）
export const TIER_ODDS = [
  [0.7, 0.24, 0.05, 0.01],
  [0.65, 0.28, 0.06, 0.01],
  [0.6, 0.32, 0.07, 0.01],
];
// 锁着的柜子、地下储藏室里的柜子：从少见起抽，稀有 50%、珍贵 10%
export const LOCKED_ODDS = [0, 0.4, 0.5, 0.1];
// 尸堆底下的箱子：从少见起抽
export const PILE_ODDS = [0, 0.75, 0.22, 0.03];
// 空投、对讲机说的箱子：必出稀有（百分之十是珍贵）
export const RARE_ODDS = [0, 0, 0.9, 0.1];
// 每个柜子先抽一样，再有这么多机会多抽一样
export const SECOND_DRAW = 0.3;

// 每一档里随机挑一种。[物品, 最少, 最多]；
// { seed: [...] } 一包某种作物的早熟、丰产或耐旱种子；{ attach: true } 一件还没有的枪的附件；
// { bp, else } 没学会时给图纸，学会了给 else；{ once, else } 还没有时给一件，有了给 else
export const KINDS = {
  toolbox: {
    name: "工具箱",
    common: [["scrap", 1, 3]],
    uncommon: [["parts", 1, 1]],
    rare: [["ammo", 6, 12], ["circuit", 1, 1]],
    precious: [{ attach: true, else: ["circuit", 2, 2] }],
  },
  wardrobe: {
    name: "衣柜",
    common: [["cloth", 1, 1], ["ragGloves", 1, 1], ["ragHood", 1, 1]],
    uncommon: [["jeans", 1, 1], ["workGloves", 1, 1]],
    rare: [["leatherJacket", 1, 1], ["softShoes", 1, 1]],
    precious: [["riotSuit", 1, 1]],
  },
  kitchen: {
    name: "厨房柜",
    common: [["bread", 1, 1], ["seedRadish", 2, 3]],
    uncommon: [["salt", 1, 2], ["seedTomato", 2, 2]],
    rare: [["jam", 1, 1], ["knife", 1, 1], { seed: ["early", "abundant"] }],
    precious: [{ seed: ["hardy"] }],
  },
  medicine: {
    name: "药柜",
    common: [["bandage", 1, 1]],
    uncommon: [["herb", 1, 1], ["bandage", 1, 2]],
    rare: [["medkit", 1, 1]],
    precious: [["remedy", 1, 1]],
  },
  garage: {
    name: "车库架子",
    common: [["scrap", 2, 2], ["parts", 1, 1]],
    uncommon: [["scrap", 4, 4], { once: "flashlight", else: ["scrap", 4, 4] }],
    rare: [["motoHelmet", 1, 1], ["motoGreaves", 1, 1]],
    precious: [{ bp: "bp_sledge", else: ["parts", 3, 3] }],
  },
  cargo: {
    name: "货箱",
    common: [["wood", 3, 5], ["stone", 2, 2]],
    uncommon: [["resin", 1, 2], ["firecracker", 1, 1]],
    rare: [["bearTrap", 1, 1], ["molotov", 1, 1]],
    precious: [{ bp: "bp_molotov", else: ["molotov", 2, 2] }],
  },
};
export const KIND_IDS = Object.keys(KINDS);
// 种子：这些作物的早熟、丰产、耐旱种子都有
export const SEED_CROPS = ["radish", "potato", "tomato", "bean", "corn", "pumpkin", "herb", "cotton"];
export const ATTACHMENTS = ["shortBarrel", "longBarrel", "extendedMag"];
// 锁着的柜子要慢慢撬：回收撬棍 8 秒，声音和拆货架一样响；学了妙手的「开锁」4 秒、没声音
export const PRY = { time: 8, fast: 4, noise: 420, every: 1, range: 72 };

// 每张废墟 9 个候选：原来的 3 个补给箱（第一次打开前一直亮着，第一次照旧给原来那一包）+ 6 个新柜子
// 每天亮 4–5 个（包括还没打开过的原来那几个）
export const LIT = [4, 5];
export const CANDIDATES = {
  residential: [
    { id: "road", kind: "cargo", orig: true },
    { id: "garden", kind: "kitchen", orig: true },
    { id: "garage", kind: "garage", orig: true },
    { id: "u1", kind: "wardrobe", name: "客厅衣柜", x: 880, y: 530 },
    { id: "u2", kind: "wardrobe", name: "卧室衣柜", x: 1380, y: 810 },
    { id: "u3", kind: "kitchen", name: "邻居家橱柜", x: 660, y: 590 },
    { id: "u4", kind: "medicine", name: "浴室药箱", x: 640, y: 190 },
    { id: "u5", kind: "toolbox", name: "修车工具箱", x: 1360, y: 640 },
    { id: "u6", kind: "locked", name: "锁着的铁柜", x: 1040, y: 840 },
  ],
  hospital: [
    { id: "garden", kind: "kitchen", orig: true },
    { id: "medicine", kind: "medicine", orig: true },
    { id: "ambulance", kind: "medicine", orig: true },
    { id: "u1", kind: "kitchen", name: "护士站储物柜", x: 1080, y: 360 },
    { id: "u2", kind: "cargo", name: "杂物间货箱", x: 1360, y: 730 },
    { id: "u3", kind: "wardrobe", name: "更衣室衣柜", x: 660, y: 550 },
    { id: "u4", kind: "kitchen", name: "食堂橱柜", x: 1080, y: 840 },
    { id: "u5", kind: "toolbox", name: "维修间工具箱", x: 640, y: 160 },
    { id: "u6", kind: "locked", name: "锁着的药品柜", x: 380, y: 790 },
  ],
  warehouse: [
    { id: "entry", kind: "cargo", orig: true },
    { id: "seeds", kind: "cargo", orig: true },
    { id: "blueprint", kind: "toolbox", orig: true },
    { id: "u1", kind: "toolbox", name: "工具箱", x: 1040, y: 480 },
    { id: "u2", kind: "toolbox", name: "维修工具箱", x: 1240, y: 360 },
    { id: "u3", kind: "cargo", name: "散货箱", x: 580, y: 310 },
    { id: "u4", kind: "garage", name: "叉车架子", x: 1160, y: 840 },
    { id: "u5", kind: "wardrobe", name: "工人衣柜", x: 920, y: 370 },
    { id: "u6", kind: "locked", name: "锁着的保险柜", x: 1440, y: 760 },
  ],
};

// 感染者身上（废墟和外面；农场的尸潮照原来的规矩）：[几率, 物品, 最少, 最多]
export const KILL_DROPS = {
  slow: [[0.15, "scrap", 1, 2]],
  faker: [[0.15, "scrap", 1, 2]],
  runner: [[0.1, "cloth", 1, 1]],
  stalker: [[0.1, "cloth", 1, 1]],
  armor: [
    [0.4, "scrap", 3, 3],
    [0.1, "parts", 1, 1],
  ],
};

// ================= 废墟小事件 =================
// 每天 35% 的机会在一片废墟出一件（和“今日险地”不在同一张图）
export const EVENT_CHANCE = 0.35;
export const RUIN_EVENTS = {
  trapped: { name: "被困的人", hint: "有人在喊救命", min: 1 },
  airdrop: { name: "空投", hint: "天上有飞机的声音", min: 1 },
  pile: { name: "尸堆", hint: "一大堆尸体", min: 1 },
  storeroom: { name: "锁着的储藏室", hint: "一扇铁门", min: 1 },
  raiders: { name: "灰隼团的搜索队", hint: "有枪声", min: 1, raid: true },
  merchant: { name: "游荡的商人", hint: "有个背包客", min: 1 },
  radio: { name: "无线电信号", hint: "对讲机在响", min: 1 },
};
export const EVENT_IDS_U = Object.keys(RUIN_EVENTS);
export const EVENT_RULES = {
  trapped: { hp: 60, speed: 120, follow: 46, hit: 8, hitCd: 1.2, held: 1.2, keep: 260 },
  airdrop: { fall: 60, noise: 700 },
  pile: { fakers: [2, 3], corpses: 5 },
  storeroom: { time: 15, fast: 7.5, noise: 900, every: 1.5 },
  raiders: { n: 2, less: 2, loot: { ammo: 12 } },
  merchant: { price: { uncommon: { bread: 2 }, rare: { bread: 2, bandage: 1 } } },
  radio: { noise: 400 },
};
// 事件放在哪（每张废墟几处空地，进图时挑一个）
export const EVENT_SPOTS = {
  residential: [
    { x: 880, y: 410 },
    { x: 1440, y: 440 },
    { x: 600, y: 880 },
  ],
  hospital: [
    { x: 760, y: 150 },
    { x: 1460, y: 530 },
    { x: 900, y: 850 },
  ],
  warehouse: [
    { x: 800, y: 350 },
    { x: 1160, y: 450 },
    { x: 320, y: 880 },
  ],
};
// 地上躺着的尸体放在这些空地里挑（第 4 天起每张图 3 具，装死者混在旁边）
export const DECOR_SPOTS = {
  residential: [[820, 720], [1440, 300], [440, 310], [1060, 370], [460, 850], [1420, 710], [660, 440], [960, 870]],
  hospital: [[720, 470], [1440, 300], [300, 880], [720, 880], [1400, 650], [700, 230], [1160, 390], [500, 430]],
  warehouse: [[780, 710], [1440, 220], [440, 310], [1380, 690], [1120, 370], [500, 880], [680, 400], [1040, 880]],
};
// 锁着的柜子、储藏室里、尸堆底下、空投和对讲机说的箱子：按这张图挑一种柜子
export const ODD_KINDS = {
  residential: ["wardrobe", "kitchen", "garage", "toolbox", "medicine"],
  hospital: ["medicine", "wardrobe", "toolbox", "kitchen", "cargo"],
  warehouse: ["toolbox", "cargo", "garage", "toolbox", "wardrobe"],
};
// 被困的人：加入援建队时用的名字和样子（id 不超过 12 个字）
export const SURVIVORS = [
  { id: "usurv1", name: "修车的老范", role: "build", trait: "handy", look: 0 },
  { id: "usurv2", name: "护工小乔", role: "carry", trait: "diligent", look: 1 },
  { id: "usurv3", name: "快递员阿森", role: "scout", trait: "nightowl", look: 2 },
  { id: "usurv4", name: "退休保安老许", role: "guard", trait: "chatty", look: 3 },
];

// ================= 感染者每两天换一套摆法 =================
// 每张废墟、每一段 3 套：只数和种类不变，各群换地方（第 3 套还把最大的一群拆成两群）；仓库守卫的位置不变
const ANCHORS = {
  residential: [
    [560, 520],
    [880, 520],
    [1000, 760],
    [1320, 640],
    [640, 300],
    [1250, 380],
  ],
  hospital: [
    [1080, 360],
    [600, 520],
    [1080, 820],
    [1360, 720],
    [700, 260],
    [900, 620],
  ],
  warehouse: [
    [1040, 480],
    [640, 260],
    [1160, 820],
    [880, 360],
    [560, 600],
    [1240, 320],
  ],
};
function center(list) {
  const x = list.reduce((a, m) => a + m[1], 0) / list.length,
    y = list.reduce((a, m) => a + m[2], 0) / list.length;
  return [x, y];
}
function variant(base, anchors, shift, split) {
  const groups = new Map();
  for (const m of base) {
    if (m[0] === "elite") continue;
    const key = m[3] || "_" + groups.size;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(m);
  }
  const out = [];
  let i = 0;
  const keys = [...groups.keys()];
  // 最大的一群拆开
  const biggest = split ? keys.reduce((a, k) => (groups.get(k).length > groups.get(a).length ? k : a), keys[0]) : null;
  for (const key of keys) {
    const list = groups.get(key),
      [cx, cy] = center(list);
    const place = (members, anchor, pack) => {
      const [mx, my] = center(members);
      for (const m of members) out.push([m[0], Math.round(anchor[0] + (m[1] - mx)), Math.round(anchor[1] + (m[2] - my)), pack]);
    };
    if (key === biggest && list.length >= 4) {
      const a = list.filter((_, k) => k % 2 === 0),
        b = list.filter((_, k) => k % 2 === 1);
      place(a, anchors[(i + shift) % anchors.length], key.startsWith("_") ? "" : key);
      i++;
      place(b, anchors[(i + shift) % anchors.length], key.startsWith("_") ? "" : key + "2");
    } else place(list, anchors[(i + shift) % anchors.length], key.startsWith("_") ? "" : key);
    i++;
    // 单个的（没有群）留在原地附近
    if (key.startsWith("_")) {
      out.pop();
      out.push([list[0][0], Math.round(cx), Math.round(cy), ""]);
    }
  }
  for (const m of base) if (m[0] === "elite") out.push([...m]);
  return out;
}
// LAYOUTS[地图][段] = [第 1 套（原来的）, 第 2 套, 第 3 套]
export const LAYOUTS = {};
for (const id of RUINS) {
  LAYOUTS[id] = RUIN_PACKS[id].map((base) => [base, variant(base, ANCHORS[id], 1, false), variant(base, ANCHORS[id], 3, true)]);
}

// ================= 新感染者 =================
// 换掉同样只数的游荡者，每张图的总数不变
export const NEW_TYPES = ["bloater", "faker", "spitter", "stalker"];
export const BOSS_TYPES = ["brute", "nurse"];
const NEW_Z = {
  bloater: { name: "膨胀者", icon: 16, hp: 90, speed: 40, damage: 10, xp: 8 },
  faker: { name: "装死者", icon: 16, hp: 120, speed: 65, damage: 12, xp: 8 },
  spitter: { name: "吐酸者", icon: 16, hp: 100, speed: 50, damage: 8, xp: 9 },
  stalker: { name: "夜行者", icon: 18, hp: 80, speed: 210, damage: 14, xp: 10 },
  brute: { name: "大块头", icon: 58, hp: 1700, speed: 55, damage: 24, xp: 80 },
  nurse: { name: "护士长", icon: 20, hp: 1400, speed: 46, damage: 18, xp: 70 },
};
for (const [id, z] of Object.entries(NEW_Z)) ZOMBIES[id] ??= z;
// 第 1–3 天不出现，三段都写上（旧档有缓冲时按低一段算）
const NEW_STATS = {
  bloater: [{ hp: 90, speed: 40, damage: 10 }, { hp: 90, speed: 40, damage: 10 }, { hp: 110, speed: 40, damage: 11 }],
  faker: [{ hp: 120, speed: 65, damage: 12 }, { hp: 120, speed: 65, damage: 12 }, { hp: 140, speed: 65, damage: 13 }],
  spitter: [{ hp: 100, speed: 50, damage: 8 }, { hp: 100, speed: 50, damage: 8 }, { hp: 100, speed: 50, damage: 8 }],
  stalker: [{ hp: 80, speed: 210, damage: 14 }, { hp: 80, speed: 210, damage: 14 }, { hp: 80, speed: 210, damage: 14 }],
  brute: [{ hp: 1700, speed: 55, damage: 24 }, { hp: 1700, speed: 55, damage: 24 }, { hp: 1800, speed: 58, damage: 24 }],
  nurse: [{ hp: 1400, speed: 46, damage: 18 }, { hp: 1400, speed: 46, damage: 18 }, { hp: 1400, speed: 46, damage: 18 }],
};
for (const [id, list] of Object.entries(NEW_STATS)) list.forEach((st, ph) => (ZSTATS[ph][id] ??= st));

export const NEW_RULES = {
  // 膨胀者：死的时候先闪 1 秒，再炸开一团毒雾（半径 90、留 6 秒，每秒 4，在里面体力不回）；平时和游荡者一样走、一样抓
  bloater: { fuse: 1, gas: { r: 90, time: 6, dps: 4 } },
  // 装死者：躺着；你走到 50 以内就抓脚踝 1.2 秒，没挣开咬腿或脚；之后爬起来追人（和游荡者一样打）
  faker: { reach: 50, grab: 1.2 },
  // 吐酸者：和你保持 200–300；仰头 0.7 秒，酸液落地一滩（半径 50、留 5 秒，每秒 6，防具耐久掉两倍）
  spitter: { near: 200, far: 300, sight: 420, warn: 0.7, cd: 4, fly: 0.5, puddle: { r: 50, time: 5, dps: 6, wear: 2 } },
  // 夜行者：夜里在外面游荡的里面三成（第 8 天起）；只从背后下手；被灯照着就退
  stalker: { share: 0.3, ring: [160, 230], behind: 2.0, dash: 300, warn: 0.3, damage: 14, cd: 2.2, light: 260, lightArc: 0.6, flee: 1.5 },
};
// 新感染者从第几段开始、每张图几只
export const PLACE = {
  bloater: { phase: 1, residential: 1, hospital: 1, warehouse: 1 },
  faker: { phase: 1, residential: 1, hospital: 1, warehouse: 1 },
  spitter: { phase: 2, residential: 0, hospital: 1, warehouse: 1 },
};
// 地上躺着的普通尸体（装死者混在里面）：第 4 天起每张废墟几具
export const DECOR_CORPSES = 3;
// 夜行者也会摸到农场边上转（第 8 天起，夜里 22:00–04:00，三成的夜里）；宵禁时农场灯灭，找不到
export const PROWL = { phase: 2, chance: 0.3, n: 2, from: 1320, to: 240 };

// ================= 头目 =================
// 大块头和护士长每 7 天在自己的废墟里出现一天，前一天世界地图上标出来
export const BOSSES = {
  brute: {
    type: "brute",
    region: "residential",
    name: "大块头",
    first: 4,
    every: 7,
    phase: 1,
    lair: { x: 800, y: 700 },
    rage: 0.5,
    rageSpeed: 1.4,
    // 站着不走时慢慢转过来对着你（弧度每秒，发狂快三成）
    turn: 2.2,
    back: 1.5,
    front: 0.85,
    slam: { r: 110, warn: 1.2, damage: 28, down: 1.0, cd: 3.6, cdRage: 2.4, near: 100 },
    door: { min: 160, max: 420, warn: 0.9, speed: 520, len: 460, width: 28, damage: 20, down: 0.6, cd: 5, cdRage: 3.5 },
    melee: { range: 62, warn: 0.8, damage: 22, cd: 1.6 },
    // 另给一件：大锤图纸（没学会时）或防暴头盔；第一次打赢两样都给、机械零件翻倍
    reward: { parts: 4 },
    bonus: { bp: "bp_sledge", else: "riotHelmet" },
    trophy: "trophyBrute",
  },
  nurse: {
    type: "nurse",
    region: "hospital",
    name: "护士长",
    first: 8,
    every: 7,
    phase: 2,
    lair: { x: 800, y: 670 },
    escorts: 3,
    scream: { every: 20, warn: 1.4, summon: 4 },
    // 绿色的一圈：身边的感染者回 30，她自己回 40
    pulse: { every: 8, warn: 0.6, r: 170, heal: 30, self: 40 },
    // 身边还有自己人时，她躲在后面，离你 150 左右
    keep: 150,
    melee: { range: 50, warn: 0.7, damage: 18, cd: 1.4 },
    reward: { medkit: 3, remedy: 1 },
    trophy: "trophyNurse",
  },
  guard: {
    type: "elite",
    region: "warehouse",
    name: "仓库守卫",
    // 第一段：正面有甲，只有背后打得动（按 T 用枪打装甲照旧）；血过半或装甲被打掉以后甲掉了，开始连续冲撞
    front: 0.2,
    // 第一段背后打得动；甲掉了以后（原来的规则会再乘 1.35）这里按 0.7 算回来
    back: 0.7,
    bare: 0.7,
    rage: 0.5,
    turn: 1.8,
    // 守着自己的箱子：离开守的地方 450 以外、你也走远了，就回去守着；你回到 400 以内再追
    leash: { max: 450, back: 400 },
    // 出手打不断，挨一下按原来的七成算
    hit: 0.7,
    charge: { min: 120, max: 320, stomp: 0.8, speed: 300, len: 320, damage: 24, down: 1, stun: 2.5, cd: 2 },
    reward: { parts: 4 },
    trophy: "trophyGuard",
  },
};
export const BOSS_IDS = Object.keys(BOSSES);
// 战利品（第一次打赢时给，能捐进档案馆）
const TROPHIES = {
  trophyBrute: { name: "大块头的铁指虎", desc: "大块头手上拆下来的铁指虎，沉得要命。可以捐给档案馆。" },
  trophyNurse: { name: "护士长的胸牌", desc: "一块锈了的胸牌，名字已经看不清。可以捐给档案馆。" },
  trophyGuard: { name: "守卫的护甲片", desc: "仓库守卫身上掉下来的钢板。可以捐给档案馆。" },
};
for (const [id, t] of Object.entries(TROPHIES)) ITEMS[id] ??= { name: t.name, icon: 55, type: "quest", protected: true, desc: t.desc };
export const TROPHY_IDS = Object.keys(TROPHIES);
// 档案馆的第六个展柜（不放进原来的展柜表，单独记在 undertow 字段里）
export const TROPHY_CASE = { name: "头目战利品", need: 3, reward: "营地声望 +10，居民士气 +5" };

// ================= 电台、法令、每日抉择 =================
// 电台修好以后，每天 07:00 播一遍今天哪里有动静、头目的传闻；修好以前，地图上只写“好像有动静”
export const RADIO_HOUR = 7;
// 宵禁（v0.15 就有）：这一版再加上夜里农场灯灭、夜行者不来农场边上
if (DECREES.curfew && !DECREES.curfew.good.includes("夜行者")) DECREES.curfew.good = "尸潮和袭击的预警多 30 秒；夜里农场灯灭，夜行者摸不到农场边上";

const NEW_CARDS = {
  U01: {
    pack: "undertow",
    cat: "crisis",
    name: "有人看见了护士长",
    when: (e) => e.s.day >= 7,
    text: "集市上有人说，旧医院里有个穿护士服的感染者，一叫就来一群，身边的还越打越精神。",
    opts: [
      { label: "打听她的脾气", cost: { bread: 1 }, fx: [["uIntel", "nurse"]], note: "知道了她每隔一阵要吸一口气" },
      { label: "多备两卷绷带", cost: { cloth: 2 }, fx: [["give", { bandage: 2 }]] },
      { label: "知道了", fx: [["xp", "exploration", 6]] },
    ],
  },
  U02: {
    pack: "undertow",
    cat: "scav",
    name: "鼓起来的尸体",
    when: (e) => e.s.day >= 4,
    text: "拾荒的人说，废墟里有种肚子鼓得发亮的感染者，打死了会喷出一团绿雾。",
    opts: [
      { label: "攒几颗弹弓石", fx: [["give", { stone: 6 }]] },
      { label: "缝一副口罩", cost: { cloth: 1 }, fx: [["uMask"]], note: "今天绿雾里少掉一半血" },
      { label: "知道了", fx: [["xp", "exploration", 6]] },
    ],
  },
  U03: {
    pack: "undertow",
    cat: "crisis",
    name: "大块头的脚印",
    when: (e) => e.s.day >= 3,
    text: "居民区路口的泥地上有一串脚印，比人的大一倍。有人看见它扛着一扇车门。",
    opts: [
      { label: "打听它怎么打", cost: { bread: 1 }, fx: [["uIntel", "brute"]], note: "它扔车门前会先把门抡一圈" },
      { label: "做两块钉板", cost: { wood: 3, scrap: 2 }, fx: [["give", { spikeBoard: 2 }]] },
      { label: "知道了", fx: [["xp", "exploration", 6]] },
    ],
  },
};
for (const [id, ev] of Object.entries(NEW_CARDS)) {
  if (EVENTS[id]) continue;
  EVENTS[id] = ev;
  EVENT_IDS.push(id);
}
export const U_CARD_IDS = Object.keys(NEW_CARDS);

// 地图上写的危险说明再加一句
if (REGIONS.residential && !REGIONS.residential.risk.includes("膨胀者")) REGIONS.residential.risk += "；第 4 天起有膨胀者、装死者，大块头每 7 天来一次";
if (REGIONS.hospital && !REGIONS.hospital.risk.includes("膨胀者")) REGIONS.hospital.risk += "；第 4 天起有膨胀者、装死者，第 8 天起有吐酸者，护士长每 7 天来一次";
if (REGIONS.warehouse && !REGIONS.warehouse.risk.includes("膨胀者")) REGIONS.warehouse.risk += "；第 4 天起有膨胀者、装死者，第 8 天起有吐酸者";

// 声音提示（给听不到的玩家）：新预兆带方向的字
Object.assign(CUES, {
  fuse: "膨胀者要炸了",
  breath: "地上的尸体在喘气",
  fakerGrab: "地上的尸体抓住了你",
  spitCue: "吐酸者在咕噜",
  click: "咔哒声",
  stalkerCue: "背后有东西扑过来",
  slamCue: "大块头要砸地",
  doorCue: "大块头抡起车门",
  bruteStep: "沉重的脚步声",
  nurseCue: "护士长在吸气",
  nurseScream: "护士长的尖叫",
  pulseCue: "护士长身边亮起一圈绿光",
  plane: "飞机的声音",
  talkie: "对讲机在响",
  dogGrowl: "麦穗在低吼",
});
