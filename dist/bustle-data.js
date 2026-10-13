// v0.28.0「热闹」的数：《余烬农场 · 营地设施体检与改造方案》第三版。
// 动静表、电台指令、红薯跑商、设施二选一改良、伤员和医务室、舒适度和「休息好」；
// 食堂在场景里端菜上菜、节庆自己挑供品、档案馆「往事」一柜、江伯的鱼汛、麦穗巡夜、商队卖改良图纸。
import { ITEMS, BUILDINGS } from "./data.js";
import { DOG_SKILLS } from "./farlands-data.js";
import { LADDER, SHOWCASES } from "./winter-data.js";
import { PAL } from "./pixel-kit.js";
import { DRAW as ICON_DRAW, assignItemIcons } from "./item-sprites.js";

export const BUSTLE_SCHEMA = 1;

// ================= 动静表 =================
// 营地里吵的事都攒动静；每天 0 点结算：4 以上当夜来一小股感染者（4 → 3 只，6 → 6 只，8 → 10 只带 1 只吐酸者）。
// 来过一场，动静清零（“动静把它们引来了，也被它们带走了”）；没来就减半。长夜、尸潮、灰隼团的那一晚不另来。
export const NOISE = {
  tiers: [
    { at: 8, n: 10, spit: 1 },
    { at: 6, n: 6, spit: 0 },
    { at: 4, n: 3, spit: 0 },
  ],
  rush: 1, // 机床加急（方案写 2：天天播节目又天天加急就夜夜来袭，热闹营地每周 2–4 场的线过不了，调成 1）
  canteen: 1, // 食堂营业
  festival: 2, // 节庆
  lure: 3, // 拉响信标
  max: 30,
  log: 12,
  flee: 360, // 06:00 还没打完的退回林子
};
export const NOISE_SRC = {
  radio: "电台节目",
  scout: "电台指令 · 侦察",
  drop: "电台指令 · 空投",
  caravan: "电台指令 · 呼叫商队",
  help: "电台指令 · 求援",
  rush: "机床加急",
  canteen: "食堂营业",
  festival: "节庆",
  lure: "拉响信标",
};

// ================= 电台指令 =================
// 通信站按 E：节目单下面就是指令。花电和动静，各有冷却（天）。
export const RADIO_CMDS = {
  scout: { name: "侦察", power: 3, noise: 1, cd: 1, desc: "问问四周的人：今晚有什么要来、从哪来、头目是谁" },
  drop: { name: "空投", power: 5, noise: 2, cd: 3, desc: "请北边的人扔一箱物资：落在一张废墟图上，4 个钟点内去拿；去晚了箱子边会围上感染者" },
  caravan: { name: "呼叫商队", power: 6, noise: 2, cd: 7, desc: "叫唐九明天 08:00 就来" },
  help: { name: "求援", power: 10, noise: 3, cd: 4, desc: "下一场长夜或尸潮，雨巷来两位邻居帮你守（各 120 血，每下 14）" },
};
export const RADIO_CMD_IDS = Object.keys(RADIO_CMDS);
export const DROP = { items: [3, 5], late: 240, guards: 4, keep: 2, offset: { x: 96, y: 70 } };
export const DROP_TABLE = [
  ["parts", 2, 3],
  ["circuit", 1, 1],
  ["medkit", 1, 2],
  ["ammo", 10, 16],
  ["cloth", 2, 3],
  ["bandage", 2, 3],
  ["seedMystery", 1, 1],
  ["repairKit", 1, 1],
];
export const ALLY = { hp: 120, dmg: 14, rate: 1.1, reach: 42, r: 380, speed: 82, hurtCd: 1.2, names: ["阿川", "石头"], looks: [5, 6], post: { x: 1250, y: 470 } };

// ================= 红薯跑商 =================
// 第五段车队到站以后，红薯每 2 天能跑一趟：装最多 20 件货，去集市、地区或边境按当地的价卖掉，再带回你点的材料（看当地存货），剩下的钱带回来。
// 工钱 1 个萝卜。路上一成五被截走一半；动静 4 以上或灰隼团没打完时三成。你跟车（当天到那张图把拦路的打掉）就不会被截。
export const MULE = {
  every: 2,
  max: 20,
  wage: { radish: 1 },
  backAt: 480, // 第三天 08:00 回来
  dest: {
    // 方案写集市收食物 ×1.1：扣掉 1 个萝卜的工钱只比直接出货多 6%，过不了「一趟多 10%–30%」的线，调成 ×1.2
    market: { name: "幸存者集市", short: "集市", cats: ["food"], mult: 1.2, stock: { parts: 6, cloth: 6 }, maps: ["market"] },
    region: { name: "地区", short: "地区", cats: ["medicine", "ammo"], mult: 1.3, stock: { circuit: 3, parts: 6 }, maps: ["stationMarket", "valley", "courtyard", "quarantine", "railDepot"] },
    frontier: { name: "边境", short: "边境", cats: ["cloth", "parts"], mult: 1.3, stock: { circuit: 4, cloth: 8 }, maps: ["shipyard", "pinewood", "shelter", "frost", "archive"] },
  },
  catNames: { food: "粮食和菜", medicine: "药", ammo: "弹药", cloth: "布", parts: "零件" },
  backs: ["money", "parts", "cloth", "circuit"],
  backNames: { money: "全换成金币", parts: "零件", cloth: "布料", circuit: "电路" },
  rob: { base: 0.15, risky: 0.3, take: 0.5 },
  foes: ["slow", "slow", "slow", "runner"],
  log: 4,
};
export const MULE_DESTS = Object.keys(MULE.dest);

// ================= 设施改良：二选一 =================
// 1 张蓝图凭证（或商队卖的改良图纸）解锁一类设施的一条路线，选了就不能换；之后每座只花材料。想要原样的，拆了重建。
export const UPGRADES = {
  tower: {
    name: "瞭望塔",
    types: ["tower"],
    cost: { parts: 3 },
    paths: {
      light: { name: "探照灯", text: "夜里伤害 +20%；照得出地上装死的", night: 1.2 },
      twin: { name: "双人哨", text: "多一个守卫一起守：射得快一倍；每天晚饭多吃 1 份干粮", rate: 2, meal: { bread: 1 } },
    },
  },
  trap: {
    name: "路障陷阱",
    types: ["trap"],
    cost: { scrap: 4 },
    paths: {
      net: { name: "捕网", text: "踩上去被网住 3 秒", hold: 3 },
      spike: { name: "尖刺", text: "伤害 +60%，耐久掉得快一倍", dmg: 1.6, wear: 2 },
    },
  },
  fence: {
    name: "围栏和大门",
    types: ["fence", "gate"],
    cost: { scrap: 2 },
    paths: {
      iron: { name: "铁皮", text: "挨的打减半（等于耐久翻倍）", take: 0.5 },
      barb: { name: "倒刺", text: "啃它的感染者每口掉 5 血", bite: 5 },
    },
  },
  irrigation: {
    name: "喷灌头",
    types: ["irrigation"],
    cost: { parts: 2 },
    paths: {
      far: { name: "远喷", text: "范围 +60（300 → 360）", r: 60 },
      saver: { name: "省水", text: "浇一块田少用三成水", use: 0.7 },
    },
  },
  cook: {
    name: "篝火灶",
    types: ["cook"],
    cost: { stone: 4 },
    paths: {
      twin: { name: "双灶", text: "两条产线：同时做两批", lanes: 2 },
      slow: { name: "慢火", text: "每批多出 1 份，时间 ×1.5", time: 1.5, out: 1 },
    },
  },
  rain: {
    name: "雨水桶",
    types: ["rain"],
    cost: { cloth: 2 },
    paths: {
      big: { name: "大桶", text: "能存 24 份水（原来 12）", store: 24 },
      filter: { name: "滤网", text: "雨天出水 +50%（12 → 18）", rain: 1.5 },
    },
  },
};
export const UP_CLASSES = Object.keys(UPGRADES);
export const upClassOf = (type) => UP_CLASSES.find((k) => UPGRADES[k].types.includes(type)) || null;
export const UP_PAPER = { item: "upPaper", price: 120, fake: "scrap" };

// ================= 伤员和医务室 =================
// 长夜、尸潮、袭击、循声来的感染者里，感染者摸到守塔的居民、守营门的队员，每被摸到一次两成机会受伤（一晚每人最多伤一次）。
// 仗打着的时候挂彩的人咬牙守到这一仗打完，打完才躺下：2 天干不了活；医务室（房间：床 + 药柜）里用 1 条绷带 1 天就好；
// 1 个药包当天下午就好（15:00，过了 15:00 就 4 个钟点后）。
export const INJURY = { chance: 0.2, days: 2, bandage: 1440, medkitAt: 900, medkitMin: 240, mood: -10, touch: 38, cd: 1.2 };

// ================= 舒适度和「休息好」 =================
// 房间里每类家具算 1 分，同类只算一件，最多 8 分。农舍边上最好的那间房决定你睡完觉的「休息好」：
// 持续（2 + 舒适度）个游戏小时，体力恢复快五成，经验多一成。居民在房间歇着，疲劳每小时多降（舒适度 ÷ 2）；
// 舒适度 4 以上的房间让大家该有的心情 +2。生活水准第 3 级改成要一间舒适度 3 以上的房间。
export const COMFORT = {
  cats: { bed: "床", chair: "椅子", lamp: "灯", table: "桌子", bookshelf: "书架", stove: "火炉", harvestTrophy: "奖杯", hnKeepsake: "陈列柜" },
  max: 8,
  homeR: 420,
  home: { x: 328, y: 315 },
  rested: { base: 2, stamina: 1.5, xp: 1.1 },
  restFatigue: 0.5,
  moodAt: 4,
  mood: 2,
  ladder: 3,
};
export const COMFORT_CATS = Object.keys(COMFORT.cats);
export const STUDY_ROOM = "阅览室"; // 阅览室当学习室用：带徒、改学职能快一倍
export const DINING_ROOM = "食堂"; // 有餐桌的房间：在这里吃的晚饭多算一种菜（「吃得好」少要一样）

// ================= 食堂在场景里上菜 =================
// 不开菜单：客人坐下头顶冒菜名，你在何大勺的灶台按 E 端菜，走到客人跟前按 E 上菜；一晚 4–6 位（口碑 40、70 各多一位）。
// 有客人吃上的那晚，营地里的人也在食堂吃，士气 +5。
export const CANTEEN2 = { guests: 4, more: [40, 70], cap: 6, mood: 5, stove: { dx: -96, dy: 4 } };

// ================= 节庆自己挑供品 =================
// 供品越好全营士气越高（+3、+6、+10），太差 −3。
export const FEST_PICK = {
  morale: [-3, 3, 6, 10],
  words: ["太寒碜了，大家脸上挂不住", "还行，热热闹闹的", "不错，大家都夸", "满堂彩，大家念叨了好几天"],
  harvest: { n: 3, each: 2, tiers: [90, 160, 260] },
  seeds: { n: 3, each: 2, tiers: [24, 40, 70] },
  lanterns: [
    { id: "rag", name: "破布条蘸油", cost: { cloth: 1, wood: 2 }, tier: 0 },
    { id: "plain", name: "木头灯笼", cost: { wood: 4, cloth: 2 }, tier: 1 },
    { id: "pumpkin", name: "南瓜灯", cost: { pumpkin: 2, wood: 2, cloth: 1 }, tier: 2 },
    { id: "herb", name: "药草香灯", cost: { herb: 3, cloth: 2, wood: 2 }, tier: 3 },
  ],
  vigil: [
    { id: "thin", name: "干粮 3", cost: { bread: 3 }, tier: 0 },
    { id: "bread", name: "干粮 6", cost: { bread: 6 }, tier: 1 },
    { id: "stew", name: "炖菜 3", cost: { stew: 3 }, tier: 2 },
    { id: "feast", name: "炖菜 2、果酱 2", cost: { stew: 2, jam: 2 }, tier: 3 },
  ],
};

// ================= 档案馆「往事」一柜 =================
// 日志、照片、遗物三个不花东西的柜并成一柜（三层：日志 3、照片 3、遗物 4）；填满由你挑一样回礼。
export const PAST = {
  cats: ["logs", "photos", "relics"],
  name: "往事",
  rewards: {
    keepsake: { name: "往事陈列柜", text: "一件独有的摆设：放进房间算一样家具（舒适度 +1）" },
    map: { name: "老地图", text: "蓝图凭证 +2、声望 +10", credits: 2, rep: 10 },
  },
};

// ================= 江伯的鱼汛 =================
// 委托做完他留在池塘边，每 7 天报一次鱼汛：那天某一种鱼钓上来多一条。
export const FISH_RUN = { every: 7, offset: 3, kinds: ["fish", "riverFish", "nightFish"], extra: 1, spot: { x: 960, y: 748 }, warnAt: 960 };

// ================= 麦穗巡夜 =================
// 长夜里：身后 60–170 步来了一只它还没叫过的感染者就叫一声（15 秒最多一次；一晚只在第一次弹字，之后只有叫声和画面上的提示）
export const DOG_PATROL = { id: "patrol", bond: 15, name: "巡夜", desc: "夜里在营地里转：夜行者摸不进农场；长夜里身后来了感染者它会叫一声", behind: 2.0, r: 170, near: 60, cd: 15 };
if (!DOG_SKILLS.some((s) => s.id === DOG_PATROL.id)) DOG_SKILLS.push({ id: DOG_PATROL.id, bond: DOG_PATROL.bond, name: DOG_PATROL.name, desc: DOG_PATROL.desc });
// 夜里麦穗在营地里转的路线
export const PATROL_PATH = [
  { x: 640, y: 430 },
  { x: 860, y: 470 },
  { x: 1180, y: 520 },
  { x: 1240, y: 700 },
  { x: 900, y: 760 },
  { x: 600, y: 700 },
  { x: 330, y: 600 },
  { x: 380, y: 430 },
];

// ================= 新物品、新建筑 =================
const NEW_ITEMS = {
  upPaper: { name: "改良图纸", type: "resource", protected: true, sell: 0, desc: "唐九在蓝图都学全以后卖的。选一条设施改良路线时，可以拿它顶一张蓝图凭证。" },
};
for (const [id, it] of Object.entries(NEW_ITEMS)) if (!ITEMS[id]) ITEMS[id] = { icon: 34, ...it };
if (!BUILDINGS.medCabinet)
  BUILDINGS.medCabinet = { name: "药柜", icon: 40, cost: { wood: 6, cloth: 2, parts: 1 }, w: 30, h: 30, hp: 100, desc: "放在房间地板 75 步内，旁边再有一张居民床，这间就是医务室：伤员躺进来，用 1 条绷带 1 天就好。" };
if (!BUILDINGS.hnKeepsake)
  // 建造菜单里先不出现：「往事」一柜填满、挑了陈列柜以后才出现（只有一件）
  BUILDINGS.hnKeepsake = { name: "往事陈列柜", icon: 40, cost: {}, w: 30, h: 34, hp: 100, retired: true, desc: "档案馆「往事」一柜填满后苏砚送的，只有一件。放进房间算一样家具（舒适度 +1）。" };

// ================= 说明跟着改 =================
if (LADDER[2]) Object.assign(LADDER[2], { name: "住得舒服", need: "床位够、有一间舒适度 3 以上的房间；寒潮期间农舍和营地在暖区里" });
for (const k of PAST.cats) if (SHOWCASES[k]) SHOWCASES[k].reward = "「往事」一柜的一层：三层都满了挑一样回礼（往事陈列柜，或老地图：蓝图凭证 +2、声望 +10）";

// ================= 图标 =================
const N = PAL.stone,
  W = PAL.water,
  Sn = PAL.snow;
Object.assign(ICON_DRAW, {
  upPaper(P) {
    // 卷起来的蓝图纸，系着一根红绳
    P.rect(3, 4, 10, 9, W[2]);
    P.hline(3, 12, 4, W[3]);
    for (const y of [6, 8, 10]) P.hline(5, 10, y, Sn[4]);
    P.vline(8, 6, 11, Sn[3]);
    P.rect(2, 4, 2, 9, W[1]);
    P.rect(12, 4, 2, 9, W[1]);
    P.vline(7, 3, 13, PAL.cloth[2]);
    P.set(6, 13, PAL.cloth[2]);
    P.set(8, 13, PAL.cloth[2]);
    void N;
  },
});
assignItemIcons();
