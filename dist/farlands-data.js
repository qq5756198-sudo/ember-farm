// v0.17.0「远方来客」：夜里的抉择、今日险地、麦穗的本事、彭姐与贺满仓、出货行情，以及无障碍与键位的数据。
// 判定写在 farlands.js；这里只放文案、数值与位置。
import { NPCS } from "./outpost-data.js";
import { FEATURES } from "./seasons-data.js";

export const FAR_SCHEMA = 1;
export const RUINS = ["residential", "hospital", "warehouse"];

// ---------- 位置 ----------
export const NIGHT_SPOTS = {
  residential: { region: "residential", x: 400, y: 800 },
  hospital: { region: "hospital", x: 880, y: 720 },
  warehouse: { region: "warehouse", x: 600, y: 450 },
};
export const HAZARD_SPOTS = {
  residential: { region: "residential", x: 1000, y: 420 },
  hospital: { region: "hospital", x: 560, y: 480 },
  warehouse: { region: "warehouse", x: 920, y: 600 },
};
export const FSPOTS = {
  peng: { x: 1120, y: 260 }, // 彭姐来农场时站的地方
  pengCamp: { region: "courtyard", x: 700, y: 500 }, // 彭姐的营地（雨巷住区）
  hemc: { x: 620, y: 300 }, // 贺满仓的账桌
};

// ---------- 夜里的抉择 ----------
export const NIGHT_HOURS = [19 * 60, 5 * 60];
export const NIGHT_KINDS = ["ruin", "stranger", "stash"];
export const NIGHT = {
  ruin: {
    name: "有人住的废墟",
    scene: "一间屋子还亮着油灯，桌上摆着一家人的口粮和布料。主人不在。",
    choices: {
      take: { name: "全拿走", cost: "不花", gain: "干粮 3、布料 2、零件 1", effect: "营地声望 −3，居民士气 −2；可以之后还回去补救", items: { bread: 3, cloth: 2, parts: 1 }, rep: -3, mood: -2 },
      leave: { name: "什么也不动", cost: "不花", gain: "营地声望 +1", effect: "两天后这家人托人送来药草种子", rep: 1, later: { days: 2, items: { seedHerb: 2 }, text: "废墟里那家人托人送来两颗药草种子，说谢谢你没动他们的东西。" } },
      share: { name: "留下两份干粮", cost: "干粮 2", gain: "营地声望 +2，居民士气 +3", effect: "三天后这家人送来一个药包", pay: { bread: 2 }, rep: 2, mood: 3, later: { days: 3, items: { medkit: 1 }, text: "废墟里那家人送来一个药包：“那天的干粮救了急。”" } },
    },
    amends: { text: "把拿走的东西还给那家人", cost: { bread: 3, cloth: 2 }, rep: 4, mood: 2 },
  },
  stranger: {
    name: "受伤的陌生人",
    scene: "墙角靠着一个人，腿上缠着发黑的布条，喘得厉害。",
    choices: {
      bandage: { name: "给他包扎", cost: "绷带 1", gain: "营地声望 +2", effect: "明早他会到营门，想留下", pay: { bandage: 1 }, rep: 2, guest: true },
      carry: { name: "背回营地", cost: "药包 1", gain: "营地声望 +3，居民士气 +2", effect: "明早他到营门，想留下；伤处理得好，大家也安心", pay: { medkit: 1 }, rep: 3, mood: 2, guest: true },
      leave: { name: "走开", cost: "不花", gain: "不花东西", effect: "居民士气 −2；明晚他可能还在原地，还能回去找他", rep: 0, mood: -2 },
    },
    amends: { text: "明晚回去找那个受伤的人", cost: {}, rep: 0, mood: 0, revisit: true },
  },
  stash: {
    name: "别营地的储藏",
    scene: "一个上了锁的木箱，侧面刻着“雨巷”两个字。锁已经锈烂了。",
    choices: {
      takeAll: { name: "全拿走", cost: "不花", gain: "弹药 12、零件 2、干粮 4", effect: "营地声望 −4；彭姐的营地会记着；可以之后赔礼", items: { ammo: 12, parts: 2, bread: 4 }, rep: -4, peng: -2 },
      takeHalf: { name: "拿一半，留欠条", cost: "不花", gain: "弹药 6、零件 1、干粮 2", effect: "营地声望 −1；欠条之后能还", items: { ammo: 6, parts: 1, bread: 2 }, rep: -1, peng: 0 },
      leave: { name: "把锁绑好，原样留下", cost: "不花", gain: "营地声望 +2", effect: "彭姐的营地记你一份情（关系 +2）", rep: 2, peng: 2 },
    },
    amends: { text: "给彭姐的营地赔礼", cost: { ammo: 12, parts: 2 }, rep: 3, peng: 3 },
    iou: { text: "还上欠条", cost: { ammo: 6, parts: 1 }, rep: 2, peng: 1 },
  },
};

// ---------- 今日险地 ----------
export const HAZARDS = {
  fog: { name: "浓雾", risk: "雾里看不清，开箱会惊动附近 2 只感染者", drop: "废金属 4、布料 2", items: { scrap: 4, cloth: 2 }, ambush: 2 },
  migration: { name: "尸群迁徙", risk: "一进去就多 4 只感染者；打完才能开补给", drop: "弹药 10、零件 2", items: { ammo: 10, parts: 2 }, extra: 4 },
  ashore: { name: "物资漂来", risk: "18:00 前不去，东西就被冲走", drop: "干粮 4、食盐 2、松脂 2", items: { bread: 4, salt: 2, resin: 2 }, until: 18 * 60 },
};
export const HAZARD_KINDS = Object.keys(HAZARDS);

// ---------- 麦穗 ----------
export const DOG_MAX = 15;
export const DOG_SKILLS = [
  { id: "dig", bond: 3, name: "刨种子", desc: "隔天清晨在农场刨出 2 颗种子" },
  { id: "coop", bond: 6, name: "看护鸡舍", desc: "有鸡舍时，每天多 1 个鸡蛋" },
  { id: "bark", bond: 9, name: "提前吠叫", desc: "尸潮和袭击的预警多 20 秒" },
  { id: "fetch", bond: 12, name: "叼回背包", desc: "你倒在外面时，第二天清晨它把遗落的背包叼回仓库" },
];

// ---------- 彭姐 ----------
export const PENG_LEND = { bread: 6 };
export const PENG_BARGAIN = { bread: 3 };
export const PENG_AID = { ammo: 12, bandage: 2 };
export const PENG_SUPPLY = { bread: 6 };
export const PENG_TRADES = [
  { id: "ammo", give: { ammo: 10 }, price: 40, name: "弹药 10" },
  { id: "parts", give: { parts: 3 }, price: 45, name: "零件 3" },
];

// ---------- 人物 ----------
export const FNPCS = {
  peng: {
    name: "彭姐",
    title: "雨巷营地的首领",
    look: { skin: "#d9a77c", hair: "#2a2420", coat: "#7a3a3a", accent: "#e9c05a", extra: "scar" },
    lines: {
      hello: "我是雨巷营地的彭姐。地里遭了虫，借六份干粮，开春还你。别磨蹭，我那边还有二十张嘴。",
      lent: "行，你够爽快。这份情我记着。",
      refused: "哼，前哨的人也就这样。走着瞧。",
      attacked: "（雨巷来的孩子气都喘不匀）彭姐让我来求援——营地被尸群围了！",
      helped: "这次要不是你们……以后雨巷和前哨，一家人不说两家话。签个互助合同？",
      allied: "轮流供粮，一起守线。说好的事，雨巷不赖账。",
      trader: "咱们没那个交情，买卖还是能做的。",
    },
  },
  hemc: {
    name: "贺满仓",
    title: "联盟账房",
    look: { skin: "#f0d2b8", hair: "#5a5a5a", coat: "#3a4a5a", accent: "#d6bf87", extra: "glasses" },
    lines: {
      hello: "我是联盟派来的账房。别跟我讲情分，我只看账本。",
      audit: "出货、交清单，一笔一笔都对得上……你们从不赖账。",
      open: "我自己攒了点家底。前哨要扩建，缺料先建，用我垫的，分三期还，不收利息。",
      paid: "账清了。下回还找我。",
    },
  },
  maisui: {
    name: "麦穗",
    title: "前哨的狗",
    look: { skin: "#d6b47a", hair: "#a8803a", coat: "#c9a55a", accent: "#7a5a36", extra: "dog" },
  },
};
for (const [id, n] of Object.entries(FNPCS)) NPCS[id] ??= n;

// ---------- 设置：无障碍与键位 ----------
export const KEY_ACTIONS = [
  ["up", "w", "向上走"],
  ["left", "a", "向左走"],
  ["down", "s", "向下走"],
  ["right", "d", "向右走"],
  ["interact", "e", "交互"],
  ["reload", "r", "装填"],
  ["rotate", "q", "旋转建造预览"],
  ["crouch", "v", "蹲行"],
  ["stone", "g", "投石"],
  ["photo", "h", "拍照"],
  ["aim", "t", "精英部位"],
  ["defense", "z", "防线视图"],
  ["log", "l", "消息记录"],
  ["craft", "c", "制作"],
  ["build", "b", "建造"],
  ["map", "m", "地图"],
  ["journal", "j", "任务手记"],
  ["shove", "x", "推开"],
];
export const RESERVED_KEYS = ["escape", "tab", "shift", " ", "enter", "1", "2", "3", "4", "5", "6", "7", "8", "9", "0", "arrowup", "arrowdown", "arrowleft", "arrowright"];
export const DEFAULT_KEY = Object.fromEntries(KEY_ACTIONS.map(([a, k]) => [a, k]));
// 固定占用、不能改给别的动作的键
export const FIXED_KEYS = { k: "技能", f: "远征路线" };
export const validKey = (k) => typeof k === "string" && /^[a-z]$/.test(k) && !RESERVED_KEYS.includes(k) && !FIXED_KEYS[k];
// 当前键位：玩家改过的盖在默认上
export function keymapOf(settings) {
  const raw = settings?.keymap && typeof settings.keymap === "object" && !Array.isArray(settings.keymap) ? settings.keymap : {},
    map = { ...DEFAULT_KEY };
  for (const [a, k] of Object.entries(raw)) if (Object.hasOwn(DEFAULT_KEY, a) && validKey(k)) map[a] = k;
  // 后来新加的动作（比如 v0.22 的“推开”）默认键被玩家改给了别的动作：新动作换一个空着的键，玩家改过的不动。
  for (const a of Object.keys(DEFAULT_KEY)) {
    if (Object.hasOwn(raw, a) || !Object.entries(map).some(([b, k]) => b !== a && k === map[a])) continue;
    const used = new Set(Object.values(map));
    const free = "xyuiopnhjklbcmzrtgvfq".split("").find((k) => validKey(k) && !used.has(k));
    if (free) map[a] = free;
  }
  // 坏数据里两个动作抢同一个键：全部退回默认。
  if (new Set(Object.values(map)).size !== Object.keys(map).length) return { ...DEFAULT_KEY };
  return map;
}
export function keyLabel(settings, action) {
  const k = keymapOf(settings)[action] || "";
  return k.toUpperCase();
}

// 第一次打开时的说明卡（和 v0.16 的“新”标记共用一套记录）。
Object.assign(FEATURES, {
  night: { name: "夜里的抉择", intro: "每晚 19:00 起，三处废墟里会有一件事等你决定，凌晨 5 点前有效。拿走的东西，之后可以在任务手记里补救。" },
  dog: { name: "麦穗", intro: "每天喂它一份干粮、摸摸它、带它出远门，默契够了它会学会新本事。" },
});
