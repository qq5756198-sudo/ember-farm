// v0.19.0「妙手」：技能点与天赋、偷盗用到的人物、口袋、宝贝、职业与小物件。
// 数值都在这里；thief.js 只按这些表结算，界面上的文字也从这里来。
import { ITEMS } from "./data.js";
import { EVENTS, EVENT_IDS, CATS, RARE_SEEDS, MODS } from "./daily-data.js";

export const SKILL_SCHEMA = 1;
export const THEFT_SCHEMA = 1;
export const THIEF_XP_PER_LEVEL = 60;
export const PRACTICE_MAX_LEVEL = 2; // 稻草人只能练到 2 级
export const RESPEC_COST = 100;
export const RESPEC_DAYS = 7;

export const SKILL_NAMES = { agriculture: "农业", manufacturing: "制造", exploration: "探索", combat: "战斗", thief: "妙手" };
export const SKILL_ORDER = ["agriculture", "manufacturing", "exploration", "combat", "thief"];

// 天赋：gate = 该技能要到几级；cost = 花几个技能点
export const TALENTS = {
  // 农业
  oldHand: { skill: "agriculture", gate: 1, cost: 1, name: "老把式", text: "锄地、播种、浇水、收获的体力消耗 −30%" },
  irrigate: { skill: "agriculture", gate: 2, cost: 1, name: "引水", text: "每天 07:00 自动给 3 块缺水的田浇透" },
  keepSeed: { skill: "agriculture", gate: 3, cost: 2, name: "留种", text: "亲手收获时，每三株里有一株多给 1 颗这种作物的种子" },
  bumper: { skill: "agriculture", gate: 5, cost: 3, name: "好收成", text: "亲手收获每株多 1 份" },
  // 制造
  steadyHand: { skill: "manufacturing", gate: 1, cost: 1, name: "手稳", text: "抢工出事故的机会减半" },
  quickHand: { skill: "manufacturing", gate: 2, cost: 1, name: "快手", text: "加工速度 +15%" },
  scrapper: { skill: "manufacturing", gate: 3, cost: 2, name: "废料回收", text: "用撬棍拆货架、报废车时多拿 1 份废金属" },
  upkeep: { skill: "manufacturing", gate: 5, cost: 3, name: "勤保养", text: "每天清晨所有受损设施自己恢复 10% 耐久" },
  // 探索
  pathfinder: { skill: "exploration", gate: 1, cost: 1, name: "识途", text: "出远门路上少花 5 分钟（最少 1 分钟）" },
  packer: { skill: "exploration", gate: 2, cost: 1, name: "整理背包", text: "背包 +4 格" },
  nose: { skill: "exploration", gate: 3, cost: 2, name: "嗅觉", text: "打开废墟里的补给箱多拿 1 个机械零件" },
  survivor: { skill: "exploration", gate: 5, cost: 3, name: "留得青山", text: "倒在外面时，丢掉的东西减半" },
  // 战斗
  steadyAim: { skill: "combat", gate: 1, cost: 1, name: "稳手", text: "枪械伤害 +10%" },
  toughBone: { skill: "combat", gate: 2, cost: 1, name: "硬骨头", text: "受到的伤害 −10%" },
  finisher: { skill: "combat", gate: 3, cost: 2, name: "补刀", text: "近战伤害 +25%" },
  suppress: { skill: "combat", gate: 5, cost: 3, name: "压制", text: "打中灰隼团枪手后，他 2 秒内开不了枪" },
  // 妙手（不点“顺手牵羊”就完全不能偷）
  pickpocket: { skill: "thief", gate: 1, cost: 1, name: "顺手牵羊", text: "解锁偷盗：蹲着（V / 蹲行键）靠近一个人按交互键（E）下手；下手前能看到对方口袋里的一格" },
  seeThrough: { skill: "thief", gate: 1, cost: 1, name: "看穿", text: "看到对方全部口袋；“没被察觉”的机会从“低 / 中 / 高”变成确切的数", need: "pickpocket" },
  lightHand: { skill: "thief", gate: 1, cost: 1, name: "轻手", text: "小游戏的安全区宽 20%；第一次手抖只涨一半注意力", need: "pickpocket" },
  nightOwl: { skill: "thief", gate: 3, cost: 2, name: "夜行", text: "22:00–05:00 或对方睡着时，没被察觉的机会 +15", need: "pickpocket" },
  distract: { skill: "thief", gate: 3, cost: 2, name: "声东击西", text: "下手前扔一块石头（或叫麦穗去捣乱）引开他，这一次 +20", need: "pickpocket" },
  lockpick: { skill: "thief", gate: 3, cost: 2, name: "开锁", text: "能撬唐九、林姨、老周的钱箱；里面是重要的东西", need: "pickpocket" },
  fence: { skill: "thief", gate: 3, cost: 2, name: "销赃门路", text: "赃物能卖到原价的 70%（不点只有 35%）；晚上 18:00–23:00 黑市的人收货", need: "pickpocket" },
  planHand: { skill: "thief", gate: 5, cost: 3, name: "图纸行家", text: "偷宝贝时没被察觉的机会 +15、上限升到 70%，安全区宽 5%", need: "pickpocket" },
  slipAway: { skill: "thief", gate: 5, cost: 3, name: "金蝉脱壳", text: "每天一次，把一次失手变成“差点被发现”：东西掉了，但没人知道是你", need: "pickpocket" },
  plant: { skill: "thief", gate: 5, cost: 3, name: "反手塞物", text: "不偷，反过来往别人口袋里塞东西：塞干粮给人、把偷来的宝贝还回去", need: "pickpocket" },
};
export const TALENT_IDS = Object.keys(TALENTS);

// 四档物品：zone = 小游戏安全区（妙手 1 级）；speed = 标记每秒走多少条宽；attn = 拿到后注意力涨多少；cap = “没被察觉”的上限
export const TIERS = {
  junk: { name: "垃圾", zone: 0.4, speed: 0.6, attn: 0.1, cap: 90, level: 1, xp: 2 },
  normal: { name: "普通", zone: 0.28, speed: 0.8, attn: 0.2, cap: 90, level: 1, xp: 4 },
  important: { name: "重要", zone: 0.16, speed: 1.05, attn: 0.3, cap: 75, level: 3, xp: 10 },
  treasure: { name: "宝贝", zone: 0.08, speed: 1.15, attn: 0.4, cap: 55, level: 4, xp: 25 },
};
export const TIER_ORDER = ["junk", "normal", "important", "treasure"];
export const VALUE_CAP = [0, 20, 40, 90, 200, Infinity]; // 按妙手等级，单件价值上限（金币）
export const ATTENTION_FULL = { awake: 6, asleep: 12 }; // 秒
export const MISS_ATTN = 0.4;

// 小物件：垃圾与职业手册
const JUNK = {
  junkButton: { name: "纽扣", icon: 49, sell: 1, desc: "从别人口袋里摸来的纽扣。凑够 10 件垃圾能找陈工换 1 个零件；凑满一套旧物能捐给档案馆。" },
  junkButt: { name: "烟头", icon: 50, sell: 0, desc: "别人口袋里的半截烟。没什么用，只能凑数换零件。" },
  junkCan: { name: "空罐头", icon: 50, sell: 1, desc: "压扁的空罐头。凑够 10 件垃圾能找陈工换 1 个零件。" },
  junkPencil: { name: "半截铅笔", icon: 48, sell: 1, desc: "削得很短的铅笔。凑够 10 件垃圾能找陈工换 1 个零件。" },
  junkTicket: { name: "旧票根", icon: 55, sell: 1, desc: "灾变前的电影票根。凑满一套旧物能捐给档案馆。" },
  junkPhoto: { name: "旧照片", icon: 55, sell: 2, desc: "一张陌生人的旧照片。凑满一套旧物能捐给档案馆。" },
};
export const JUNK_IDS = Object.keys(JUNK);
export const JUNK_SET = { junkButton: 5, junkTicket: 5, junkPhoto: 5 }; // 捐给档案馆的一套
export const JUNK_TRADE = 10; // 10 件垃圾换 1 个零件

// 职业手册：交给一名居民或援建队员，他从此每天多干一样活
export const JOBS = {
  medicJob: { name: "卫生员", manual: "manualMedic", text: "每天 07:00 给大家看病：居民疲劳 −15，你的生命 +10" },
  cookJob: { name: "炊事员", manual: "manualCook", text: "每天 07:00 把 1 份萝卜或土豆做成 2 份干粮（入仓）" },
  herdJob: { name: "饲养员", manual: "manualHerd", text: "有鸡舍时每天 07:00 多 1 个鸡蛋；没有鸡舍时每天 1 份豆类" },
  weatherJob: { name: "气象员", manual: "manualWeather", text: "酸雨、高温、暴雨天提前给田盖布搭棚：作物至少按七成速度长" },
};
const MANUALS = {
  manualMedic: { name: "战地外科笔记", job: "medicJob" },
  manualCook: { name: "炊事班菜谱", job: "cookJob" },
  manualHerd: { name: "放牧手册", job: "herdJob" },
  manualWeather: { name: "气象站校准手册", job: "weatherJob" },
};
export const MANUAL_IDS = Object.keys(MANUALS);
Object.assign(
  ITEMS,
  Object.fromEntries(JUNK_IDS.map((id) => [id, { ...JUNK[id], type: "resource" }])),
  Object.fromEntries(MANUAL_IDS.map((id) => [id, { name: MANUALS[id].name, type: "quest", icon: 55, sell: 0, protected: true, desc: "职业手册：在任务手记的“妙手”里交给一名居民或援建队员，他就成了" + JOBS[MANUALS[id].job].name + "。" + JOBS[MANUALS[id].job].text + "。" }])),
);
export { MANUALS };

// 口袋里东西的价值（金币）；种子和配件本身卖不了钱，这里按偷的难度定
export function itemValue(id, n = 1) {
  if (id === "coins") return n;
  if (id === "letter") return 50;
  if (MODS.includes(id)) return 120 * n;
  if (RARE_SEEDS.includes(id)) return 60 * n;
  return Math.max(1, ITEMS[id]?.sell || 1) * n;
}
export function itemLabel(id, n = 1) {
  if (id === "coins") return n + " 金币";
  if (id === "letter") return "一封信";
  return (ITEMS[id]?.name || id) + (n > 1 ? " ×" + n : "");
}

// 口袋配置：每档一组 [物品, 最少, 最多]
const P = {
  farmer: { junk: [["junkButton", 1, 2], ["junkPencil", 1, 1], ["junkPhoto", 1, 1]], normal: [["seedRadish", 2, 3], ["seedPotato", 2, 2], ["bread", 1, 1], ["coins", 8, 15]], important: [["seed_tomato_abundant", 1, 1], ["seed_bean_abundant", 1, 1], ["coins", 30, 50]] },
  mechanic: { junk: [["junkCan", 1, 2], ["junkButt", 1, 2]], normal: [["scrap", 2, 3], ["parts", 1, 1], ["coins", 10, 18]], important: [["parts", 3, 4], ["circuit", 1, 1]] },
  medic: { junk: [["junkTicket", 1, 1], ["junkPencil", 1, 1]], normal: [["bandage", 1, 1], ["coins", 8, 16]], important: [["medkit", 1, 1], ["herb", 2, 2]] },
  crew: { junk: [["junkButt", 1, 2], ["junkButton", 1, 2], ["junkCan", 1, 1]], normal: [["bread", 1, 2], ["ammo", 3, 5], ["coins", 5, 15]] },
  trader: { junk: [["junkTicket", 1, 2], ["junkButt", 1, 1]], normal: [["coins", 15, 25], ["ammo", 4, 6]], important: [["coins", 40, 80], ["jam", 1, 1], ["mod", 1, 1]] },
  grocer: { junk: [["junkButton", 1, 2], ["junkTicket", 1, 1]], normal: [["bread", 2, 2], ["coins", 10, 20], ["egg", 1, 1]], important: [["coins", 30, 60], ["jam", 1, 1]] },
  dealer: { junk: [["junkCan", 1, 2], ["junkButt", 1, 1]], normal: [["scrap", 3, 4], ["parts", 1, 1], ["coins", 10, 20]], important: [["parts", 3, 4], ["circuit", 1, 1], ["coins", 30, 50]] },
  inventor: { junk: [["junkPencil", 1, 2], ["junkCan", 1, 1]], normal: [["parts", 1, 1], ["scrap", 3, 3]], important: [["circuit", 1, 1], ["parts", 3, 3]] },
  gunnut: { junk: [["junkCan", 1, 2]], normal: [["ammo", 5, 8]], important: [["mod", 1, 1], ["ammo", 15, 20]] },
  raider: { junk: [["junkButt", 1, 2]], normal: [["ammo", 3, 5], ["coins", 5, 12]], important: [["letter", 1, 1], ["ammo", 12, 15]] },
  shepherd: { junk: [["junkButton", 1, 1]], normal: [["bread", 1, 1], ["coins", 6, 12]], important: [["cloth", 2, 2], ["milk", 2, 2]] },
  soldier: { junk: [["junkButt", 1, 2], ["junkTicket", 1, 1]], normal: [["ammo", 4, 6], ["coins", 10, 20]], important: [["medkit", 1, 1], ["ammo", 12, 15]] },
  archivist: { junk: [["junkTicket", 1, 2], ["junkPhoto", 1, 1]], normal: [["coins", 5, 15], ["bandage", 1, 1]], important: [["letter", 1, 1], ["coins", 30, 50]] },
  underground: { junk: [["junkCan", 1, 1]], normal: [["scrap", 3, 3], ["coins", 10, 20]], important: [["nightHerb", 1, 1], ["circuit", 1, 1]] },
  fisher: { junk: [["junkButton", 1, 1], ["junkCan", 1, 1]], normal: [["fish", 1, 1], ["bread", 1, 1]], important: [["fish", 3, 3]] },
  kid: { junk: [["junkPencil", 1, 2], ["junkButton", 1, 2]], normal: [["coins", 3, 8], ["bread", 1, 1]] },
  granny: { junk: [["junkPhoto", 1, 1], ["junkTicket", 1, 1], ["junkButton", 1, 1]], normal: [["coins", 5, 10], ["bread", 1, 1]] },
  traveler: { junk: [["junkTicket", 1, 1], ["junkButt", 1, 1], ["junkCan", 1, 1]], normal: [["bread", 1, 1], ["coins", 8, 18], ["ammo", 3, 3]], important: [["letter", 1, 1], ["coins", 30, 40]] },
  cook: { junk: [["junkCan", 1, 2]], normal: [["egg", 1, 1], ["bread", 2, 2], ["salt", 1, 1]], important: [["stew", 1, 1], ["jam", 1, 1]] },
  leader: { junk: [["junkButton", 1, 1]], normal: [["ammo", 4, 6], ["coins", 10, 20]], important: [["medkit", 1, 1], ["ammo", 12, 15]] },
  clerk: { junk: [["junkPencil", 1, 2], ["junkTicket", 1, 1]], normal: [["coins", 15, 25]], important: [["coins", 50, 85]] },
  dummy: { junk: [["junkButton", 1, 1]], normal: [["junkCan", 1, 1]] },
};
export const POCKETS = P;

// 能下手的人。group 决定被抓的后果；alert：0 迟钝 / 1 一般 / 2 机警；sleeps：夜里 23:00–05:00 睡着；
// poor：偷了第二天自己心里也过不去；trust：信任用的编号
export const TARGETS = {
  farmer: { name: "阿禾", title: "营地居民 · 种地", group: "camp", alert: 1, sleeps: true, profile: "farmer", treasure: "heirloomSeeds", poor: true, trust: "farmer" },
  mechanic: { name: "陈工", title: "营地居民 · 维修", group: "camp", alert: 1, sleeps: true, profile: "mechanic", treasure: "genBlueprint", poor: true, trust: "mechanic" },
  medic: { name: "许医生", title: "营地居民 · 医务", group: "camp", alert: 1, sleeps: true, profile: "medic", treasure: "surgeryNotes", poor: true, trust: "medic" },
  tang: { name: "唐九", title: "流动商队的倒爷", group: "market", alert: 2, sleeps: false, profile: "trader", treasure: "routeLedger", boxOnly: true },
  linyi: { name: "林姨", title: "集市 · 粮食商", group: "market", alert: 1, sleeps: false, profile: "grocer", treasure: "purchaseList" },
  laozhou: { name: "老周", title: "集市 · 机械商", group: "market", alert: 2, sleeps: false, profile: "dealer", treasure: "supplyMap" },
  youke: { name: "尤可", title: "情绪化的发明家", group: "npc", alert: 0, sleeps: true, profile: "inventor", treasure: "droneBlueprint", trust: "youke" },
  cai: { name: "蔡眼镜", title: "兵器宅", group: "npc", alert: 1, sleeps: true, profile: "gunnut", treasure: "gunPlans", trust: "cai" },
  yaozi: { name: "鹞子", title: "灰隼团的叛逃者", group: "npc", alert: 2, sleeps: true, profile: "raider", treasure: "raidCodes" },
  alan: { name: "阿兰", title: "牧羊人", group: "npc", alert: 1, sleeps: true, profile: "shepherd", treasure: "herdManual", trust: "alan" },
  ge: { name: "葛队长", title: "想回城的人", group: "npc", alert: 2, sleeps: true, profile: "soldier", treasure: "armyList", trust: "ge" },
  suyan: { name: "苏砚", title: "档案员", group: "npc", alert: 1, sleeps: true, profile: "archivist", treasure: "weatherManual", trust: "suyan" },
  amo: { name: "阿默", title: "地底的灰皮人", group: "npc", alert: 2, sleeps: false, profile: "underground", treasure: "tunnelMap" },
  jiang: { name: "江伯", title: "老渔夫", group: "npc", alert: 0, sleeps: true, profile: "fisher", treasure: "fishDiary", poor: true, trust: "jiang" },
  ali: { name: "阿砾", title: "画墙的少年", group: "npc", alert: 1, sleeps: true, profile: "kid", treasure: "graffitiBook", poor: true, trust: "ali" },
  adou: { name: "阿豆", title: "偷粮的孩子", group: "npc", alert: 2, sleeps: true, profile: "kid", treasure: "stashMap", poor: true, trust: "adou" },
  qin: { name: "秦奶奶", title: "等最后一班渡船的旅客", group: "npc", alert: 0, sleeps: true, profile: "granny", treasure: "familyPhoto", poor: true, trust: "qin" },
  he: { name: "何大勺", title: "退伍炊事员", group: "npc", alert: 1, sleeps: true, profile: "cook", treasure: "cookManual", trust: "he" },
  peng: { name: "彭姐", title: "雨巷营地的首领", group: "peng", alert: 2, sleeps: false, profile: "leader", treasure: "alleyKey" },
  hemc: { name: "贺满仓", title: "联盟账房", group: "hemc", alert: 2, sleeps: false, profile: "clerk", treasure: "grantSlip" },
  lodger: { name: "借宿的过路人", title: "过路人", group: "drifter", alert: 1, sleeps: true, profile: "traveler", poor: true },
  visitor: { name: "营门的访客", title: "等着入营审查", group: "drifter", alert: 1, sleeps: false, profile: "traveler" },
  crew: { name: "援建队员", title: "援建队", group: "crew", alert: 1, sleeps: true, profile: "crew", poor: true },
};

// 宝贝：kind 只用来显示；effect 决定偷到后怎么样
export const TREASURES = {
  heirloomSeeds: { name: "家传种子包", kind: "藏货", owner: "farmer", text: "六种丰产种子各 1 颗", effect: { items: Object.fromEntries(RARE_SEEDS.map((id) => [id, 1])) } },
  genBlueprint: { name: "太阳能改造图", kind: "设计图", owner: "mechanic", text: "直接解锁太阳能科技，不用研究点（已经有了就换成 8 个零件）", effect: { tech: "solar", fallback: { parts: 8 } } },
  surgeryNotes: { name: "战地外科笔记", kind: "职业手册", owner: "medic", text: "交给一个人，他就成了卫生员", effect: { items: { manualMedic: 1 } } },
  routeLedger: { name: "商路账本", kind: "情报", owner: "tang", text: "知道了唐九的进价：他的货永久打八折（锁在他车上的钱箱里）", effect: { flag: "routeLedger" } },
  purchaseList: { name: "进货单", kind: "情报", owner: "linyi", text: "林姨卖的东西永久便宜 15%", effect: { flag: "purchaseList" } },
  supplyMap: { name: "货源图", kind: "藏货", owner: "laozhou", text: "工业仓库多一处藏货：零件 12、废金属 30", effect: { stash: "laozhou" } },
  droneBlueprint: { name: "无人机改造图", kind: "设计图", owner: "youke", text: "直接解锁农业无人机科技，不用研究点（已经有了就换成电路 2、零件 6）", effect: { tech: "drone", fallback: { circuit: 2, parts: 6 } } },
  gunPlans: { name: "改枪图纸", kind: "设计图", owner: "cai", text: "照着图纸做出四种枪械配件", effect: { items: Object.fromEntries(MODS.map((id) => [id, 1])) } },
  raidCodes: { name: "灰隼团联络暗号", kind: "情报", owner: "yaozi", text: "下一次灰隼团来，你能假传命令让一半人撤走", effect: { flag: "raidCodes" } },
  herdManual: { name: "放牧手册", kind: "职业手册", owner: "alan", text: "交给一个人，他就成了饲养员", effect: { items: { manualHerd: 1 } } },
  armyList: { name: "旧部队军需清单", kind: "藏货", owner: "ge", text: "旧医院多一处藏货：弹药 40、药包 2", effect: { stash: "ge" } },
  weatherManual: { name: "气象站校准手册", kind: "职业手册", owner: "suyan", text: "交给一个人，他就成了气象员", effect: { items: { manualWeather: 1 } } },
  tunnelMap: { name: "地下通道图", kind: "情报", owner: "amo", text: "农场到旧医院、工业仓库有了地道：去这两处只要 1 分钟", effect: { flag: "tunnel" } },
  fishDiary: { name: "鱼汛日记", kind: "情报", owner: "jiang", text: "以后每次钓鱼多钓 1 条", effect: { flag: "fishDiary" } },
  graffitiBook: { name: "涂鸦暗号本", kind: "情报", owner: "ali", text: "看懂了墙上的记号：三片废墟的补给箱以后多拿三成", effect: { flag: "graffiti" } },
  stashMap: { name: "藏粮点地图", kind: "藏货", owner: "adou", text: "干粮 20、种子 12。可这是一个孩子全部的家当", effect: { items: { bread: 20, seedRadish: 4, seedPotato: 4, seedBean: 4 }, mood: -3 } },
  familyPhoto: { name: "全家福", kind: "旧物", owner: "qin", text: "对你没用。偷到只会让营地士气 −5，只能想办法还回去", effect: { mood: -5 } },
  cookManual: { name: "炊事班菜谱", kind: "职业手册", owner: "he", text: "交给一个人，他就成了炊事员", effect: { items: { manualCook: 1 } } },
  alleyKey: { name: "雨巷仓库钥匙", kind: "藏货", owner: "peng", text: "一次拿走弹药 30、药包 3；第二天彭姐会发现，关系 −2", effect: { items: { ammo: 30, medkit: 3 } } },
  grantSlip: { name: "联盟拨款单", kind: "情报", owner: "hemc", text: "以后每 7 天联盟多拨 60 金币", effect: { flag: "grant" } },
};
export const TREASURE_IDS = Object.keys(TREASURES);
export const TREASURE_VALUE = 180;

// 场景里的固定点
export const THIEF_SPOTS = {
  dummy: { region: "farm", x: 150, y: 340 },
  stash: {
    laozhou: { region: "warehouse", x: 700, y: 280, label: "老周的货源", items: { parts: 12, scrap: 30 } },
    ge: { region: "hospital", x: 560, y: 380, label: "旧部队的军需", items: { ammo: 40, medkit: 2 } },
  },
};
// 钱箱：owner 的口袋配置决定里面有什么
export const BOXES = {
  tang: { name: "唐九的钱箱", owner: "tang", region: "farm", dx: 70, dy: 20 },
  linyi: { name: "林姨的钱箱", owner: "linyi", region: "market", dx: -60, dy: 25 },
  laozhou: { name: "老周的钱箱", owner: "laozhou", region: "market", dx: 60, dy: 25 },
};

// ---------- 每日抉择里的妙手卡（第 101–107 张） ----------
CATS.thief = { name: "妙手", tone: "#8fc9b8" };
const unlocked = (e) => !!e.hasTalent?.("pickpocket");
const T = {
  T01: { cat: "thief", name: "酒桌上的传闻", when: unlocked, text: "集市的酒桌上，有人压低声音说起谁身上揣着值钱的东西。", opts: [
    { label: "请他喝一杯", cost: { bread: 1 }, fx: [["rumor"]] },
    { label: "自己去盯一天", fx: [["thiefXp", 5], ["stamina", -10]] },
    { label: "不感兴趣", fx: [] },
  ] },
  T02: { cat: "thief", name: "集市来了扒手", when: unlocked, text: "一个瘦小的身影在集市的人群里钻来钻去，林姨的钱袋差点被摸走。", opts: [
    { label: "抓住他", fx: [["hp", -10], ["rep", 3], ["thiefXp", 5]] },
    { label: "跟他学两手", pay: 20, fx: [["thiefXp", 15]] },
    { label: "看好自己的钱包", fx: [] },
  ] },
  T03: { cat: "thief", name: "散落的书页", when: unlocked, text: "废墟里翻出几页残破的书，标题是《扒手的自我修养》。", opts: [
    { label: "收起来慢慢看", fx: [["thiefXp", 10]] },
    { label: "送给阿豆", req: (e) => (e.ss?.adou && e.ss.adou.phase !== "none" ? "" : "还没见过阿豆"), fx: [["trust", "adou", 1], ["thiefXp", 4]] },
    { label: "当引火纸烧了", fx: [["mood", 1]] },
  ] },
  T04: { cat: "thief", name: "失窃案", rescue: true, when: (e) => !!e.th?.discovery && e.th.discovery.day <= e.s.day, text: "营地里有人发现东西不见了，大家围在仓库前议论纷纷。", opts: [
    { label: "站出来认", fx: [["confess"], ["rep", -2]] },
    { label: "假装帮忙找", p: 0.6, win: [["clearCase"], ["thiefXp", 3]], lose: [["confess"], ["rep", -4]], loseNote: "有人看见过你" },
    { label: "让一个队员背锅", fx: [["blame"]] },
  ] },
  T05: { cat: "thief", name: "阿豆的挑战", when: (e) => unlocked(e) && e.level?.("thief") >= 4 && !!e.ss?.adou && e.ss.adou.phase !== "none" && !["taken", "lost", "given"].includes(e.th?.treasures?.stashMap), text: "阿豆叉着腰：“听说你手很快？比一场，谁先摸到对方兜里的纽扣谁赢。”", opts: [
    { label: "比一场", p: 0.5, win: [["giveTreasure", "stashMap"]], lose: [["money", -20]], loseNote: "被他抢先摸走了 20 金币" },
    { label: "教他点别的", fx: [["trust", "adou", 2]] },
    { label: "不比", fx: [] },
  ] },
  T06: { cat: "thief", name: "路过的锁匠", when: unlocked, text: "一个背着工具卷的老锁匠在营门口歇脚，说可以教人两招。", opts: [
    { label: "付钱学一下午", pay: 40, fx: [["thiefXp", 12], ["time", 180]] },
    { label: "请他修营地的锁", cost: { scrap: 2 }, fx: [["rep", 1]] },
    { label: "不必了", fx: [] },
  ] },
  T07: { cat: "thief", name: "夜里有人摸进来", when: unlocked, text: "半夜你听见脚步声在床边停下，有只手伸向你的外套口袋。", opts: [
    { label: "装睡，等他动手", p: 0.6, win: [["rep", 3], ["thiefXp", 4]], lose: [["money", -15]], loseNote: "他摸走了 15 金币，跑了" },
    { label: "大喊一声", fx: [] },
    { label: "留点东西给他", cost: { bread: 2 }, fx: [["rep", 1], ["mood", 1]] },
  ] },
};
for (const [id, ev] of Object.entries(T)) {
  ev.id = id;
  EVENTS[id] = ev;
  if (!EVENT_IDS.includes(id)) EVENT_IDS.push(id);
}
export const THIEF_EVENT_IDS = Object.keys(T);
