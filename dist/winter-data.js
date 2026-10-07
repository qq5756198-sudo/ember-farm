// v0.15.0「寒潮之后」：联盟前哨第七、八段，法令簿、生活水准、档案馆、电台节目、暖区，以及六位新人物的数据。
// 判定写在 winter.js；这里只放文案、数值与位置。
import { ITEMS, BUILDINGS, RECIPES } from "./data.js";
import { MEAL_ITEMS } from "./outpost-data.js";

export const WINTER_SCHEMA = 1;

// ---------- 新物品与配方 ----------
ITEMS.wool ??= { name: "羊毛", icon: 31, type: "resource", sell: 18, buy: 36, desc: "阿兰的羊剪下的毛，做保温衣。" };
ITEMS.warmCoat ??= {
  name: "保温衣",
  icon: 31,
  type: "equipment",
  protected: true,
  sell: 0,
  desc: "带在身上，寒潮里在暖区外也不会冻得更饿。",
};
ITEMS.moonHerb ??= {
  name: "月影草",
  icon: 30,
  type: "crop",
  food: 0,
  sell: 30,
  buy: 0,
  desc: "地底避难城才长的灰绿草叶，阿默只在夜里卖。做特效药的原料。",
};
ITEMS.remedy ??= {
  name: "特效药",
  icon: 39,
  type: "medicine",
  heal: 80,
  sell: 60,
  desc: "恢复 80 生命；在营地使用时顺便治好所有病号。",
};
ITEMS.warmSoup ??= {
  name: "暖身汤",
  icon: 53,
  type: "food",
  food: 60,
  heal: 10,
  sell: 50,
  desc: "霜降的流星夜配方：恢复 60 饥饿；寒潮里比干粮更顶饿。",
};
ITEMS.amoSample ??= {
  name: "阿默的血样",
  icon: 30,
  type: "quest",
  protected: true,
  desc: "康复者的血样。送到检疫科研园，补上污染证据链的最后一环。",
};
// 暖身汤也算一顿正餐（晚饭轮换、口粮天数都会算上）。
if (!MEAL_ITEMS.includes("warmSoup")) MEAL_ITEMS.push("warmSoup");
const recipe = (r) => {
  if (!RECIPES.some((x) => x.id === r.id)) RECIPES.push(r);
};
recipe({ id: "warmCoatWool", out: { warmCoat: 1 }, cost: { wool: 2, cloth: 1 }, station: "workbench", minutes: 30, desc: "羊毛絮进布料里，缝一件保温衣。" });
recipe({ id: "warmCoatCloth", out: { warmCoat: 1 }, cost: { cloth: 4 }, station: "workbench", minutes: 40, desc: "没有羊毛时，用四层布料缝一件保温衣。" });
recipe({ id: "remedy", out: { remedy: 1 }, cost: { moonHerb: 1, herb: 2 }, station: "workbench", minutes: 30, desc: "月影草配药草，熬成特效药。" });
recipe({ id: "warmSoup", out: { warmSoup: 2 }, cost: { rye: 2, potato: 1 }, station: "cook", minutes: 30, desc: "霜降在流星夜念给你的配方：黑麦和土豆熬一锅暖身汤。" });

// 火炉：寒潮里的主要热源。平时不烧柴。
BUILDINGS.stove ??= {
  name: "火炉",
  icon: 41,
  cost: { wood: 10, stone: 6, scrap: 4 },
  w: 40,
  h: 40,
  hp: 120,
  desc: "寒潮准备期和寒潮期间提供半径 220 的暖区；那几天每天清晨烧 2 份木材。",
};

// ---------- 故事：第七、八段 ----------
export const WINTER_ACTS = {
  7: { label: "第七段", name: "让所有人过冬", reward: { money: 120, reputation: 10 } },
  8: { label: "第八段", name: "余烬之地，成为家园", reward: { money: 200, reputation: 15 } },
};

// ---------- 寒潮 ----------
export const WINTER = {
  prepDays: 2, // 准备期两天
  coldDays: 3, // 寒潮三天
  stoveFuel: 2, // 每座火炉每天清晨烧的木材
  coldHunger: 1.4, // 暖区外、没有保温衣时的饥饿倍率
  cropCold: 0.35, // 暖区外作物生长倍率
  cropColdFood: 0.6, // 选“粮食保障”时暖区外作物生长倍率
};
export const HEAT = {
  stove: 220,
  cook: 140,
  greenhouse: 200,
  home: 150,
  camp: 110,
  room: 120,
};
export const PRIORITIES = {
  food: {
    pick: "粮食保障",
    name: "先保田和饭",
    desc: "暖区外的作物照样长六成；寒潮里谁没吃上晚饭，第二天一早邻居送来 2 份干粮。",
  },
  medicine: {
    pick: "药品保障",
    name: "先保人不生病",
    desc: "寒潮里没人冻病；受伤包扎多回 10 生命。",
  },
  engineering: {
    pick: "工程保障",
    name: "先保炉火和机器",
    desc: "火炉每天只烧 1 份木材；机床照常开工。",
  },
};
export const GE_COST = { bread: 4 }; // 护送葛队长一行回城的路上口粮
export const ALAN_FEED = { bean: 4, radish: 4 };
export const SUYAN_COST = { wood: 12, cloth: 4, parts: 2 };

// ---------- 法令簿 ----------
export const DECREE_COOLDOWN = 2;
export const DECREES = {
  rotation: { name: "轮休制", good: "队员与居民疲劳增长少四成", cost: "每四个钟点歇一个钟点" },
  injured: { name: "伤员优先", good: "晚饭时你若生命低于 80，回 8 生命", cost: "其他居民士气每天 −1" },
  curfew: { name: "夜间宵禁", good: "尸潮和袭击的预警多 30 秒", cost: "19 点后不干活，士气每天 −1" },
  ration: { name: "配给卡", good: "晚饭两人分一份口粮", cost: "士气每天 −4；做不到“吃得饱”" },
  overtime: { name: "加班周", good: "加工速度 +25%", cost: "疲劳增长加五成，士气每天 −3" },
  kitchen: { name: "公共厨房", good: "两种餐食就算“吃得好”", cost: "每天晚饭多烧 1 份木材" },
  patrol: { name: "双岗巡逻", good: "守卫开枪更快，防守力 +2", cost: "守卫一天吃三份" },
  salvage: { name: "拾荒队", good: "每天 06:00 带回废金属 2、木材 1", cost: "搬运队员上午十点前不搬东西" },
  silence: { name: "广播静默", good: "电台的动静减半，不容易引来尸群", cost: "节目效果也减半" },
  neighbors: { name: "邻里换工", good: "邻里互助回礼翻倍", cost: "每次多交 1 份干粮" },
  openGate: { name: "敞开营门", good: "每天都有人来营门", cost: "来的人里小偷更多" },
  winterStore: { name: "冬储令", good: "火炉每天少烧 1 份木材", cost: "寒潮期间士气每天 −2" },
};
export const DECREE_SLOTS = (act) => (act >= 7 ? 4 : act >= 5 ? 3 : act >= 3 ? 2 : 1);

// ---------- 生活水准 ----------
export const LADDER = [
  { name: "吃得饱", need: "昨晚每个人都吃上晚饭，没有实行配给卡" },
  { name: "吃得好", need: "最近三顿晚饭吃过三种以上餐食（公共厨房：两种）" },
  { name: "住得暖", need: "床位够、至少一间布置好的房间；寒潮期间农舍和营地在暖区里" },
  { name: "有盼头", need: "两天内电台播过节目" },
];

// ---------- 电台节目 ----------
export const PROGRAMS = {
  news: { name: "新闻", desc: "唐九的商队提前一天来；预报明天天气。", noise: 1 },
  songs: { name: "点歌", desc: "居民士气 +5；队员明天不因缺餐变慢。", noise: 2 },
  lesson: { name: "生存课", desc: "你的农业和战斗经验各 +6。", noise: 1 },
  missing: { name: "寻人启事", desc: "明天就有老实人来营门。", noise: 2 },
};
export const NOISE_LIMIT = 4;

// ---------- 档案馆 ----------
export const SHOWCASES = {
  fish: {
    name: "鱼类",
    items: ["fish", "riverFish", "nightFish"],
    reward: "钓鱼咬钩快 0.6 秒",
  },
  herbs: { name: "药草标本", reward: "绷带和药包多回 10 生命" },
  logs: { name: "三地日志", reward: "研究点 +1" },
  photos: { name: "照片墙", reward: "居民士气 +10，此后每天 +1" },
  relics: {
    name: "遗物",
    items: ["seedArchive", "pumpModule", "driveModule", "relayCore"],
    reward: "营地声望 +10",
  },
};

// ---------- 位置 ----------
export const WSPOTS = {
  alan: { x: 1230, y: 250 },
  ge: { x: 1180, y: 600 },
  museum: { x: 1300, y: 170 },
  amo: { region: "shelter", x: 820, y: 650 },
  evidence: { region: "quarantine", x: 560, y: 760 },
  archiveHall: { region: "archive", x: 820, y: 650 },
};

// ---------- 人物 ----------
export const WNPCS = {
  shuangjiang: {
    name: "霜降",
    title: "白霜站的气象员",
    look: { skin: "#f0d2b8", hair: "#dfe7ea", coat: "#4f7a8e", accent: "#b4d2db", extra: "scarf" },
    lines: {
      hello: "这里是白霜站。我一个人守了三年，每天记三遍气温。听得见吗？",
      forecast: "大家都当我的预报是玩笑。可这次是真的：冷空气四天内就到。我把黑麦种子托车队捎过去了。",
      meteor: "今晚抬头！流星雨。按老站长的规矩，看到流星的人能分到一张配方——暖身汤。",
      saved: "寒潮过去了……你们真的都撑过来了。白霜站，以后就交给前哨吧。",
    },
  },
  yeying: {
    name: "夜莺",
    title: "电台主持",
    look: { skin: "#e8c2a0", hair: "#2a2430", coat: "#6b4f7a", accent: "#e9c05a", extra: "glasses" },
    lines: {
      hello: "晚上好，这里是余烬之声！今晚的节目由——呃，由一袋萝卜赞助。",
      exposed: "……是，我给灰隼团念过宣传稿。那时候不念就没饭吃。",
      apology: "我在电台里把那些稿子一句句念出来，再告诉大家那是假的。听的人反而多了。",
      left: "我明白。电台交给小柒吧。",
    },
  },
  suyan: {
    name: "苏砚",
    title: "档案员",
    look: { skin: "#efd0b0", hair: "#3b3328", coat: "#7a6a4f", accent: "#d6bf87", extra: "glasses" },
    lines: {
      hello: "我从档案岛坐船过来。老师的手稿里提到你们的水井——我想在这里开一间分馆。",
      built: "展柜都擦好了。每一样东西都有它的故事，捐过来，我讲给大家听。",
    },
  },
  ge: {
    name: "葛队长",
    title: "想回城的人",
    look: { skin: "#c99a76", hair: "#5a4a3a", coat: "#5f6a52", accent: "#c94b3d", extra: "hat" },
    lines: {
      hello: "我们三个从北线过来，听说这儿能过冬。吃的、睡的，可别让我们失望。",
      unhappy: "伙食就这样？床都不够。两天，再这样我们就回城里去。",
      stayed: "……好吧，这里比城里强。我们留下，开春帮你们砍柴。",
      escorted: "谢了，还肯送我们一程。回城后我会跟人说，余烬前哨是讲理的地方。",
      left: "我说到做到。我们走了。",
    },
  },
  alan: {
    name: "阿兰",
    title: "牧羊人",
    look: { skin: "#d9a77c", hair: "#8a5a3a", coat: "#9b8a6a", accent: "#e6e0d0", extra: "hat" },
    lines: {
      hello: "羊群找不到草了。你们要是肯分点饲料，我就在这儿把冬天熬过去。",
      fed: "它们吃得真香。等冬天过去，我留两只给你，再教你剪毛。",
      left: "开春了。两只羊留给你，记得每天喂一把豆子，隔两天就能剪毛。",
      declined: "明白，大家都难。我再往南走走。",
    },
  },
  amo: {
    name: "阿默",
    title: "地底的灰皮人",
    look: { skin: "#a9b0a6", hair: "#3a3e3a", coat: "#4b5a55", accent: "#9fd3b0", extra: "scar" },
    lines: {
      hello: "别怕，我不咬人。皮是灰的，因为我得过病——又好了。要月影草吗？只在晚上卖。",
      day: "（避难城的灯暗着。阿默只在夜里出来。）",
      sample: "抽我的血？……拿去吧。要是能证明我不是怪物，抽多少都行。",
    },
  },
};
