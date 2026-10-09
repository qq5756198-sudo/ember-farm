// v0.20.0「一亩田」的数据：作物的搭配加成、吃地养地、喜欢和怕的天气，草料、菜虫、稻草人。
import { ITEMS, BUILDINGS, CROPS } from "./data.js";

export const GARDEN_SCHEMA = 1;

// 每种作物给上下左右“不同种”的作物一种加成（只算相邻，不算斜对角，也不算同种）
export const BUFFS = {
  water: { name: "保水", short: "保", text: "浇一次管两天" },
  yield: { name: "增产", short: "增", text: "收获多 1 份" },
  quality: { name: "提质", short: "质", text: "照料分 +15" },
  weed: { name: "防草", short: "防", text: "不长杂草" },
};
export const BUFF_IDS = Object.keys(BUFFS);

// soil：light 一般（肥力 −7）、heavy 吃地（−14）、feed 养地（不耗肥，收完还肥力）
export const CROP_INFO = {
  radish: { buff: "weed", soil: "light", likes: "晴朗", hates: "高温" },
  potato: { buff: "water", soil: "light", likes: "小雨", hates: "暴雨" },
  tomato: { buff: "water", soil: "light", likes: "高温", hates: "酸雨" },
  bean: { buff: "yield", soil: "feed", likes: "小雨", hates: "高温" },
  corn: { buff: "yield", soil: "heavy", likes: "高温", hates: "暴雨" },
  pumpkin: { buff: "quality", soil: "heavy", likes: "晴朗", hates: "酸雨" },
  herb: { buff: "weed", soil: "feed", likes: "小雨", hates: "高温" },
  cotton: { buff: "quality", soil: "heavy", likes: "晴朗", hates: "暴雨" },
  rye: { buff: "water", soil: "light", likes: "暴雨", hates: "高温" },
};
export const SOIL = {
  light: { name: "一般", cost: 7 },
  heavy: { name: "吃地", cost: 14 },
  feed: { name: "养地", cost: 0 },
};
export const FEED_BACK = { bean: 22, herb: 10 }; // 收完这些作物，地里的肥力回升多少
export const cropInfo = (crop) => CROP_INFO[crop] || { buff: null, soil: "light", likes: null, hates: null };

// 数值
export const CARE = {
  base: 40, // 刚种下
  cap: 65, // 天天浇水、照看最多攒到 65；再往上要靠搭配、换茬、肥地
  rotation: 10, // 这一茬和上一茬不一样
  water: 10, // 当天浇过水（自己浇、下雨、阿禾、灌溉都算）
  tend: 10, // 当天照看过
  rich: 10, // 肥力 85 以上
  poor: -10, // 肥力 30 以下
  quality: 15, // 邻居给“提质”
  spec: 10, // 农业专精“品质”
  dry: -10, // 前一天没喝到水
  idle: -5, // 前一天没人照看
  weed: -10, // 地里有草过了一夜
  bug: -5, // 每只虫过了一夜
  hated: -10, // 遇上它怕的天气、又没盖布
  fine: 80, // 80 分以上必出优质
  maybe: 50, // 50–79 按比例
};
export const WEEDS = { empty: 0.15, crop: 0.08, spreadAfter: 2, fertility: 2, startDay: 3 };
export const BUGS = { startDay: 2, perTen: 1, max: 3, slow: 0.6 };
export const CROWS = { crops: 15, chance: 0.25, maxPeck: 2, radius: 160 };
export const COVER = { cloth: 1, days: 2 }; // 盖一次管今天和明天
export const FODDER_SOIL = { fodder: 3, fertility: 8 };
export const FODDER_FEED = 3; // 3 份草料顶 1 份玉米喂鸡
export const COMBO = { window: 3, max: 3 }; // 3 秒内连着收，下一块多给 1 份，最多 +3
export const EARLY = { days: 3, boost: 1.5 }; // 前 3 天抵掉“生长 ×2/3”
export const LIKED = 1.25;
export const HELPER = { startDay: 5, perHour: 4, from: 8, to: 17 }; // 阿禾第 5 天起每小时替你照看 4 块

// 新物品
const NEW_ITEMS = {
  fodder: { name: "草料", frontierIcon: 12, sell: 1, desc: "从地里拔下来的杂草。3 份能代替玉米喂一次鸡；3 份埋进田里，肥力 +8（在田边按 E 打开这块田）。" },
  grub: { name: "菜青虫", frontierIcon: 1, sell: 0, desc: "从菜叶上捉下来的虫子。钓鱼时可以当鱼饵（代替 1 份豆类）。" },
};
for (const [id, it] of Object.entries(NEW_ITEMS)) if (!ITEMS[id]) ITEMS[id] = it;
export const GARDEN_ITEMS = Object.keys(NEW_ITEMS);

// 稻草人：吓走乌鸦
if (!BUILDINGS.scarecrow)
  BUILDINGS.scarecrow = { name: "稻草人", icon: 56, cost: { wood: 4, cloth: 1 }, w: 24, h: 24, hp: 40, desc: "吓走乌鸦：周围 160 像素（大约 4 块田）以内的熟菜不会被啄。" };

export const WEATHER_WORD = { 晴朗: "晴", 小雨: "小雨", 高温: "高温", 酸雨: "酸雨", 暴雨: "暴雨" };
export const BAD = { 酸雨: 0.3, 高温: 0.5, 暴雨: 0.65 };
export const cropName = (crop) => CROPS[crop]?.name || crop;
