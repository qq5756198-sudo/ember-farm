// v0.34.0「成长」的数据：技能 6–10 级（老手）、每样近战各有擅长的场合、打法挑战、第二年的清单。
// 依据：《爽点与耐玩体检方案》第 4、6 条和第 2 条的第二年清单（体检时 12 次升级在第 4 天前全部升完，之后 116 天一次也没有；
// 同一身后期防具打旧医院，大锤、铁头矛倒下一两成，消防斧、撬棍四五成以上；第 120 天前清单、旧物、残页、隧道、余烬核全部做完）。
// 老手的小本事只给方便和花样，不加伤害、不加血，夜里不会因为它们变容易。
import { ITEMS, WEAPONS } from "./data.js";
import { MELEE, KIND_NAMES } from "./gear-data.js";
import { PAL } from "./pixel-kit.js";
import { DRAW as ICON_DRAW } from "./item-sprites.js";
import { DECOR_BY_ID, DECOR_DRAW, decorItem } from "./almanac-data.js";
import { MOMENT_KINDS } from "./zest-data.js";
import { MOMENT_SOUND, STINGERS } from "./audio-data.js";

export const GROW_SCHEMA = 1;

// ================= 1. 老手：技能 6–10 级 =================
// 1–5 级照旧（每级 40 经验，妙手每级 60），各项本事、天赋的门槛、技能点都按 1–5 级算；
// 6–10 级要的累计经验：一级比一级慢（每一级要的经验都比上一级多）。照重光台的勤快玩家（6 个种子各 120 天）定：
// 农业、探索、战斗三项轮着升，大约第 10 天到第 116 天之间 15 次，相邻两次最多隔 11 天；制造、妙手机器人不练，按做东西、偷东西的玩家估。
export const MASTER_XP = {
  agriculture: [1600, 3700, 5950, 8650, 12000],
  manufacturing: [750, 1600, 2500, 3500, 4600],
  exploration: [1800, 3800, 5950, 8150, 10400],
  combat: [1500, 6400, 12050, 18150, 26150],
  thief: [600, 1000, 1500, 2100, 2800],
};
export const MASTER_TOP = 10;
// 每级一样小本事（10 级是一件纪念物）
export const PERKS = {
  agriculture: [
    { lv: 6, id: "agNeighbor", name: "顺手", text: "浇水、照看一块田，旁边一块也顺手做了（浇水照样用壶里的水）" },
    { lv: 7, id: "agExtra", name: "手熟", text: "亲手收获，一成机会多收一份" },
    { lv: 8, id: "agSeed", name: "惜种", text: "亲手播种，一成机会不费种子" },
    { lv: 9, id: "agGrace", name: "护苗", text: "浇过水的菜，第二天忘了浇也照样长" },
    { lv: 10, id: "agKeep", name: "老农", text: "纪念物「老农的草帽」", decor: "grHat" },
  ],
  manufacturing: [
    { lv: 6, id: "mfQuick", name: "快手", text: "加工台、灶台上排队的东西做得快一成" },
    { lv: 7, id: "mfThrift", name: "省料", text: "武器台修装备，每样材料少花一份（最少一份）" },
    { lv: 8, id: "mfStrip", name: "拆得细", text: "拆装备、回收设施多得一份材料" },
    { lv: 9, id: "mfCook", name: "巧手", text: "灶台、制作台做吃的，一成机会多做一份" },
    { lv: 10, id: "mfKeep", name: "老师傅", text: "纪念物「老师傅的工具挂板」", decor: "grBoard" },
  ],
  exploration: [
    { lv: 6, id: "exDraw", name: "多翻一下", text: "废墟里的柜子，多翻出一样的机会多一成五" },
    { lv: 7, id: "exReel", name: "稳手收线", text: "钓鱼收线时，线绷紧得慢一成五" },
    { lv: 8, id: "exRoad", name: "认路", text: "出远门的路上再少 5 分钟" },
    { lv: 9, id: "exEye", name: "眼尖", text: "走近就看得出哪个柜子今天有好东西（稀有以上，柜子上一颗星）" },
    { lv: 10, id: "exKeep", name: "老探路人", text: "纪念物「老探路人的指南针」", decor: "grCompass" },
  ],
  combat: [
    { lv: 6, id: "cbRoll", name: "省劲", text: "翻滚少费 3 体力" },
    { lv: 7, id: "cbCare", name: "爱惜家伙", text: "武器、防具掉耐久慢两成" },
    { lv: 8, id: "cbLoot", name: "摸尸", text: "打倒的感染者身上，翻到东西的机会多一半" },
    { lv: 9, id: "cbClear", name: "清场", text: "把一片废墟的感染者打干净，那片废墟今天多亮一个柜子" },
    { lv: 10, id: "cbKeep", name: "老兵", text: "纪念物「老兵的旧水壶」", decor: "grFlask" },
  ],
  thief: [
    { lv: 6, id: "thCalm", name: "沉得住气", text: "被认出来以后，人家消气快：怀疑每 5 天消一格（原来 7 天）" },
    { lv: 7, id: "thLook", name: "眼明", text: "下手前多看清一个口袋" },
    { lv: 8, id: "thFence", name: "销赃", text: "赃物多卖一成" },
    { lv: 9, id: "thQuick", name: "手快", text: "下手时的安全区宽一成" },
    { lv: 10, id: "thKeep", name: "妙手空空", text: "纪念物「妙手的旧手套」", decor: "grGlove" },
  ],
};
export const PERK_BY_ID = Object.fromEntries(Object.entries(PERKS).flatMap(([skill, list]) => list.map((p) => [p.id, { ...p, skill }])));
// 小本事用到的数
export const PERK_FX = { neighbor: 70, extra: 0.1, seed: 0.1, quick: 1.1, cook: 0.1, draw: 0.15, reel: 0.85, road: 5, eye: 220, roll: 3, care: 0.2, loot: 0.5 };
export const SKILL_TITLES = { agriculture: "农业", manufacturing: "制造", exploration: "探索", combat: "战斗", thief: "妙手" };

// ================= 2. 每样近战一个擅长的场合 =================
// 方案第 6 条：消防斧劈门和重甲、撬棍开锁着的柜子多翻一样、砍刀砍腿让奔跑者摔倒、大锤破甲但慢；医院走廊窄，长矛不好使。
// 数在这里，规则在 grow.js；铁头矛、大锤原来的数不动（长夜、隧道照原样）。
export const WEAPON_FX = {
  // 长矛：开阔地方最好用；旧医院楼里走廊窄、病床推车多，伸不开（够得近一截）
  spear: { cramped: ["hospital"], cut: 25 },
  ironspear: { cramped: ["hospital"], cut: 25 },
  // 消防斧：劈重甲正面也不减；劈中一下甲就开了（之后谁打都不减），开了甲的冲不起来；储藏室的铁门劈得开；抡起来要一小会儿
  axe: { armorPierce: 1, split: true, door: 4, windup: 0.12 },
  // 砍刀：砍腿——砍中奔跑者六成摔倒（爬不起来、扑不了人），扑过来时迎面一刀准摔；游荡者六成五、重甲两成五也会被砍倒；
  // 游荡者血不到一半就可能摔成爬行者
  machete: { trip: 0.6, tripSlow: 0.65, tripArmor: 0.25, tripT: 0.9, leap: true, crawlBelow: 0.5 },
  // 钉子球棒：放血——打出血的机会更高，流血的走得慢一半
  bat: { bleed: 0.5, slowBleed: true },
  // 回收撬棍：一别——打中正要出手的就把它别开；拿在手上撬锁着的柜子多翻一样
  crowbar: { interrupt: true, pryExtra: true },
  // 大锤：抡起来要一会儿（点下去 0.2 秒才砸到）；正面砸仓库守卫，甲片会被砸松（几下就掉）
  sledge: { windup: 0.2, guardPlate: 0.6 },
};
// 调过的数（装备台打旧医院、居民区、仓库各 150 趟定的；原来的数写在后面）
export const MELEE_TUNE = {
  // 原来：击退 18（打不断出手）、一下最多砍两只、间隔 0.75 秒、11 体力
  axe: { knock: 30, maxHits: 0, cd: 0.7, stamina: 9 },
  // 原来：伤害 34
  machete: { dmg: 38 },
  // 原来：伤害 24（每升一级照旧 +3）
  crowbar: { dmg: 26 },
};
for (const [id, t] of Object.entries(MELEE_TUNE)) if (MELEE[id]) Object.assign(MELEE[id], t);
const meleeDesc = (w) => KIND_NAMES[w.kind] + " · 伤害 " + w.dmg + " · 间隔 " + w.cd + " 秒 · 击退 " + w.knock + " · 破甲 " + Math.round(w.pierce * 100) + "% · 声音 " + w.noise + (w.dur ? " · 耐久 " + w.dur : " · 不会坏");
for (const id of Object.keys(MELEE_TUNE)) {
  const w = MELEE[id];
  if (!w) continue;
  WEAPONS[id] = { ...(WEAPONS[id] || {}), damage: w.dmg, range: w.range, cooldown: w.cd, noise: w.noise, melee: true };
  if (ITEMS[id]) ITEMS[id].desc = id === "crowbar" ? "开箱子的工具，也能当钝器打。" + meleeDesc(w) + "，每升一级 +3。" : meleeDesc(w) + "。";
}
// 武器说明后面加的一句、武器台那一页的“擅长”
export const WEAPON_USE = {
  spear: "擅长：开阔的地方。扑过来的奔跑者正面顶住伤害翻倍。旧医院走廊窄，伸不开（范围 −25）。",
  ironspear: "擅长：开阔的地方。扑过来的奔跑者正面顶住伤害翻倍。旧医院走廊窄，伸不开（范围 −25）。",
  axe: "擅长：重甲（旧医院）。劈重甲正面也不减，劈中一下甲就开了、冲不起来；一下砍中身前够得着的每一只；抡起来要一小会儿；储藏室的铁门 4 秒劈开。",
  machete: "擅长：奔跑者，居民区的街上最好用。砍中六成摔倒，扑过来时迎面一刀准摔；游荡者也常被砍倒，血不到一半就可能摔成爬行者。破甲差，打重甲绕到背后。",
  bat: "擅长：边退边打。打中五成流血，流血的走得慢一半。",
  crowbar: "擅长：搜东西。拿在手上撬锁着的柜子多翻一样；打中正要出手的就把它别开。",
  sledge: "擅长：仓库守卫和重甲（工业仓库）。一锤砸晕、重甲也挡不住；正面砸守卫，甲片几下就松。抡起来要 0.2 秒，费体力。",
};
// 旧医院的危险说明后面加一句
export const CRAMPED_NOTE = "走廊窄，长矛伸不开";

// ================= 3. 打法挑战 =================
// 做成给一件纪念物（摆件），算进收复度；做没做都不影响别的
export const CHALLENGES = {
  nightBlade: { name: "砍刀守夜", text: "守住一个长夜，这一夜亲手打倒的全用砍刀（至少 15 只）", need: 1, min: 15, decor: "grNick" },
  axeSplit: { name: "劈甲", text: "用消防斧劈开 12 只重甲感染者的甲", need: 12, decor: "grVisor" },
  sledgeGuard: { name: "砸甲", text: "用大锤把仓库守卫的甲砸掉", need: 1, decor: "grPlate" },
  spearBrace: { name: "顶住", text: "用长矛顶住 30 次扑过来的奔跑者", need: 30, decor: "grTip" },
  batBleed: { name: "放血", text: "用钉子球棒打出血，让 30 只感染者流血倒下", need: 30, decor: "grNails" },
  crowbarPry: { name: "撬", text: "拿着撬棍撬开 12 个锁着的柜子", need: 12, decor: "grLock" },
  quiet: { name: "不出声", text: "一趟废墟一只感染者也没惊动，翻了三个柜子回到出口", need: 1, decor: "grShoe" },
  light: { name: "轻装", text: "身体栏空着进一片废墟，翻了三个柜子活着出来", need: 1, decor: "grBag" },
  bolt: { name: "弩手", text: "用弩打倒 10 只尖叫者", need: 10, decor: "grBolt" },
};
export const CHALLENGE_IDS = Object.keys(CHALLENGES);
// 哪些算“一趟废墟”（不出声、轻装）
export const RUIN_TRIPS = ["residential", "hospital", "warehouse"];
export const TRIP_BOXES = 3;

// ================= 4. 第二年的清单 =================
// 同样六面墙，每面两份，要的东西更难凑；第一批交满了、到了第二年（第 29 天起）才开。
// 一面墙的两份都交满：那一处升二级（花钱升过的，换一件那一处的纪念物）。
export const LISTS2 = {
  w2_deep: { wall: "water", name: "深水里的鱼", need: [["riverFish", 4], ["nightFish", 2], ["kinEel", 2], ["kinKoi", 1]], reward: { gold: 400, fertWater: 6 }, hint: "池塘里的蓝背鱼、夜里的金尾夜鱼，农场水渠里的黄鳝和难得一见的锦鲤。" },
  w2_rain: { wall: "water", name: "雨季的田", need: [["prime_potato", 2], ["prime_tomato", 2], ["fine_herb", 3], ["cotton", 10]], reward: { gold: 400, fertCare: 6 }, hint: "当季照顾得好才收得到上品；优质药草要好种子或提质肥。" },
  c2_ward: { wall: "clinic", name: "药房", need: [["medkit", 4], ["remedy", 2], ["herbTea", 4], ["bandage", 10]], reward: { gold: 450, medkit: 2 }, hint: "医院的药柜、制作台、灶台。" },
  c2_nurse: { wall: "clinic", name: "两块胸牌", need: [["trophyNurse", 2], ["filterFabric", 2], ["wool", 4]], reward: { gold: 500, remedy: 1 }, hint: "护士长打赢一回掉一块胸牌；滤材在地底避难城，羊毛找阿兰。" },
  s2_books: { wall: "school", name: "图书角", need: [["@decor", 6], ["rlBulb", 2], ["wood", 30]], reward: { gold: 450, seedMystery: 3 }, hint: "柜子里翻到的旧物摆件哪样都行；信号灯泡在地铁隧道第 6 层往下。" },
  s2_feast: { wall: "school", name: "开学的饭", need: [["radishCake", 4], ["beanCake", 4], ["alDumpling", 3], ["alChestnutStew", 2]], reward: { gold: 450, kinCandy: 6 }, hint: "何大勺教的点心；栗子焖南瓜要秋收的栗子。" },
  r2_sea: { wall: "radio", name: "远海的鱼", need: [["kinGrouper", 1], ["kinCroaker", 2], ["kinHairtail", 2], ["kinMandarin", 1]], reward: { gold: 600, circuit: 2 }, hint: "沉湾的海里的石斑、黄鱼、夜里的带鱼；鳜鱼只在秋收时节的河里。" },
  r2_mast: { wall: "radio", name: "第二根天线杆", need: [["rlRelay", 4], ["rlCopper", 10], ["circuit", 3], ["resin", 4]], reward: { gold: 500, parts: 6 }, hint: "继电器在地铁隧道第 21 层往下，松脂在雾松林场。" },
  p2_glow: { wall: "power", name: "夜里的光", need: [["glowBean", 12], ["nightFish", 4], ["moonHerb", 2]], reward: { gold: 500, parts: 4 }, hint: "田里杂交出来的夜光豆、池塘夜里的金尾夜鱼、阿默晚上卖的月影草。" },
  p2_guard: { wall: "power", name: "守卫的甲", need: [["trophyGuard", 2], ["parts", 10], ["ammo", 60]], reward: { gold: 600, circuit: 2 }, hint: "仓库守卫打赢一回掉一块护甲片。" },
  t2_branch: { wall: "rail", name: "支线", need: [["rlSpike", 24], ["rlRelay", 4], ["scrap", 40], ["wood", 30]], reward: { gold: 600, parts: 6 }, hint: "道钉在地铁隧道第 11 层往下，继电器在第 21 层往下。" },
  t2_trip: { wall: "rail", name: "远行的干粮", need: [["trailRye", 6], ["armyStew", 4], ["alPickleOld", 4], ["alWineAged", 2], ["hpHoney", 2]], reward: { gold: 600, hpRation: 3 }, hint: "老坛腌菜放 7 天、陈酿放 10 天；蜂蜜要自己养蜂。" },
};
export const LIST2_IDS = Object.keys(LISTS2);
export const LISTS2_START = 29;
// 第二年的两份交满、那一处已经花钱升过二级：换一件那一处的纪念物
export const WALL_KEEPSAKE = { water: "grTap", clinic: "grSteth", school: "grBell", radio: "grMic", power: "grShade", rail: "grPlaque" };

// ================= 5. 收复度里多两项 =================
export const GROW_COMPLETION = [
  { id: "challenges", name: "打法挑战", max: CHALLENGE_IDS.length },
  { id: "lists2", name: "第二年的清单", max: LIST2_IDS.length },
];

// ================= 旧档的说明 =================
export const INTRO_LINES = ["技能能升到 10 级了：6–10 级一级比一级慢，每级一样小本事（不加伤害、不加血）；你攒下的经验照算。", "每样近战有了擅长的场合（看武器的说明）；成就册里多了九样打法挑战。", "第二年起，重建站的六面墙各多两份更难的清单，交满了那一处升二级。"];

// ================= 纪念物（摆件） =================
const NEW_DECOR = [
  // 老手 10 级
  { id: "grHat", name: "老农的草帽", desc: "帽檐磨毛了，汗渍一圈一圈的，戴上就想下地。" },
  { id: "grBoard", name: "老师傅的工具挂板", desc: "一块木板钉满了钉子，每样工具都有自己的位置，用完放回去。" },
  { id: "grCompass", name: "老探路人的指南针", desc: "黄铜的壳，玻璃裂了一道，指针还是稳稳地指着北。" },
  { id: "grFlask", name: "老兵的旧水壶", desc: "军绿色的铝壶，凹了好几处，壶带上缝着一个名字。" },
  { id: "grGlove", name: "妙手的旧手套", desc: "一只薄薄的皮手套，指尖磨得发亮。" },
  // 打法挑战
  { id: "grNick", name: "豁口的砍刀", desc: "守了一整夜，刀刃上崩出好几个豁口，挂在墙上当个念想。" },
  { id: "grVisor", name: "劈开的面罩", desc: "重甲感染者的面罩，从当中劈成了两半。" },
  { id: "grPlate", name: "砸凹的甲片", desc: "仓库守卫身上砸下来的钢板，中间一个锤子印。" },
  { id: "grTip", name: "磨亮的矛尖", desc: "顶过三十回扑来的奔跑者，矛尖磨得锃亮。" },
  { id: "grNails", name: "一把旧钉子", desc: "从钉子球棒上换下来的旧钉子，弯的弯、秃的秃。" },
  { id: "grLock", name: "撬弯的挂锁", desc: "一串撬开的挂锁，锁梁都弯了，叮当作响。" },
  { id: "grShoe", name: "软底布鞋", desc: "一双布鞋，走在碎玻璃上也没有声音。" },
  { id: "grBag", name: "旧帆布包", desc: "什么也没穿，就背着这个包进去、出来。" },
  { id: "grBolt", name: "没捡回的箭", desc: "射穿了尖叫者的那支箭，箭杆裂了，留着不用。" },
  // 第二年的清单：已经花钱升过二级的那一处
  { id: "grTap", name: "水厂的铜龙头", desc: "旧水厂主管上拆下来的铜龙头，拧开还滴水。" },
  { id: "grSteth", name: "诊所的听诊器", desc: "许医生换下来的旧听诊器，胶管补过两回。" },
  { id: "grBell", name: "学堂的铜铃", desc: "上课摇的铜铃，孩子们抢着摇。" },
  { id: "grMic", name: "电台的旧话筒", desc: "早间广播用坏的那只话筒，网罩瘪了一块。" },
  { id: "grShade", name: "路灯的灯罩", desc: "一只搪瓷灯罩，里面还是白的，外面锈成了红的。" },
  { id: "grPlaque", name: "轨道车的铭牌", desc: "“余烬支线 01”，铆钉还在。" },
];
const put = (id, def) => {
  if (!ITEMS[id]) ITEMS[id] = def;
};
// 只进 DECOR_BY_ID（摆得出来、认得出来），不进 DECOR 那张表：柜子、商队、麦穗随手翻到的摆件里不会冒出它们
for (const d of NEW_DECOR) {
  DECOR_BY_ID[d.id] ??= { id: d.id, name: d.name, where: [], desc: d.desc, grow: true };
  put(decorItem(d.id), { name: d.name, type: "resource", sell: 6, decor: d.id, desc: d.desc + "（纪念物，摆件：在建设里选「旧物摆件」摆出来）" });
}
export const GROW_DECOR = NEW_DECOR.map((d) => d.id);

// ================= 小图（16×16） =================
const A = PAL.ash,
  So = PAL.soil,
  E = PAL.ember,
  St = PAL.straw,
  L = PAL.leaf,
  W = PAL.water,
  Ro = PAL.stone,
  Ru = PAL.rust,
  Cl = PAL.cloth,
  Sn = PAL.snow;
const D = {
  grHat: (P) => {
    P.rect(2, 9, 12, 2, St[2]);
    P.rect(4, 5, 8, 4, St[3]);
    P.hline(4, 11, 7, Cl[1]);
    P.hline(2, 13, 11, St[0]);
  },
  grBoard: (P) => {
    P.rect(2, 2, 12, 12, So[2]);
    P.rect(4, 4, 1, 7, Ro[3]);
    P.rect(7, 4, 2, 3, Ro[4]);
    P.vline(8, 7, 11, So[0]);
    P.rect(11, 4, 1, 6, Ru[2]);
    P.hline(2, 13, 13, So[0]);
  },
  grCompass: (P) => {
    P.disc(8, 8, 5.5, St[1]);
    P.disc(8, 8, 4.3, Sn[3]);
    P.vline(8, 4, 8, E[2]);
    P.vline(8, 9, 12, A[3]);
    P.set(8, 8, A[1]);
    P.set(8, 2, St[2]);
  },
  grFlask: (P) => {
    P.rect(5, 4, 6, 10, L[1]);
    P.rect(6, 3, 4, 1, L[2]);
    P.rect(7, 1, 2, 2, Ro[3]);
    P.vline(4, 5, 11, Cl[3]);
    P.rect(6, 7, 2, 2, L[3]);
  },
  grGlove: (P) => {
    P.rect(5, 6, 6, 7, So[2]);
    for (let k = 0; k < 4; k++) P.vline(5 + k * 1.5, 2 + (k === 0 || k === 3 ? 1 : 0), 6, So[3]);
    P.rect(11, 8, 2, 3, So[3]);
    P.hline(5, 10, 13, So[0]);
  },
  grNick: (P) => {
    P.rect(3, 6, 9, 3, Ro[4]);
    P.set(5, 6, A[2]);
    P.set(8, 8, A[2]);
    P.set(10, 6, A[2]);
    P.rect(12, 6, 3, 3, So[1]);
    P.hline(3, 11, 9, Ro[2]);
  },
  grVisor: (P) => {
    P.rect(2, 4, 5, 8, Ro[2]);
    P.rect(9, 4, 5, 8, Ro[2]);
    P.hline(3, 6, 6, A[1]);
    P.hline(9, 12, 6, A[1]);
    P.vline(7, 3, 13, E[3]);
  },
  grPlate: (P) => {
    P.rect(2, 3, 12, 10, Ro[3]);
    P.disc(8, 8, 2.6, Ro[1]);
    P.set(3, 4, Ro[5]);
    P.set(12, 4, Ro[5]);
    P.hline(2, 13, 12, Ro[1]);
  },
  grTip: (P) => {
    P.vline(8, 7, 15, So[2]);
    P.rect(7, 3, 3, 4, Ro[5]);
    P.set(8, 1, Sn[4]);
    P.set(8, 2, Ro[5]);
  },
  grNails: (P) => {
    for (let k = 0; k < 5; k++) {
      P.vline(3 + k * 2.5, 5 + (k % 2), 12, Ro[3]);
      P.hline(2 + k * 2.5, 4 + k * 2.5, 4 + (k % 2), Ro[4]);
    }
  },
  grLock: (P) => {
    P.rect(4, 8, 8, 6, St[1]);
    P.vline(5, 4, 8, Ro[3]);
    P.vline(11, 3, 8, Ro[3]);
    P.hline(5, 9, 4, Ro[3]);
    P.set(8, 10, A[1]);
    P.set(8, 11, A[1]);
  },
  grShoe: (P) => {
    P.rect(2, 9, 12, 4, A[3]);
    P.rect(2, 7, 6, 2, A[3]);
    P.hline(2, 13, 13, Cl[5]);
    P.hline(9, 12, 10, A[4]);
  },
  grBag: (P) => {
    P.rect(3, 5, 10, 9, So[3]);
    P.rect(3, 5, 10, 3, So[2]);
    P.vline(5, 1, 5, So[1]);
    P.vline(10, 1, 5, So[1]);
    P.hline(5, 10, 1, So[1]);
    P.set(8, 7, St[3]);
  },
  grBolt: (P) => {
    for (let k = 0; k < 10; k++) P.set(3 + k, 12 - k, So[3]);
    P.rect(12, 2, 2, 2, Ro[4]);
    P.set(3, 13, Cl[1]);
    P.set(4, 13, Cl[1]);
    P.set(7, 8, A[1]);
  },
  grTap: (P) => {
    P.rect(2, 5, 8, 3, Ru[3]);
    P.rect(8, 5, 3, 6, Ru[3]);
    P.rect(5, 2, 2, 3, St[2]);
    P.hline(3, 8, 2, St[2]);
    P.set(9, 12, W[4]);
    P.set(9, 14, W[3]);
  },
  grSteth: (P) => {
    P.vline(4, 2, 8, A[2]);
    P.vline(11, 2, 8, A[2]);
    P.hline(4, 11, 9, A[2]);
    P.vline(8, 9, 12, A[2]);
    P.disc(8, 13, 1.6, Ro[4]);
  },
  grBell: (P) => {
    P.rect(5, 5, 6, 6, St[1]);
    P.rect(4, 10, 8, 2, St[1]);
    P.vline(8, 2, 5, So[2]);
    P.set(8, 13, St[0]);
    P.set(6, 6, St[3]);
  },
  grMic: (P) => {
    P.disc(8, 5, 3.4, Ro[2]);
    P.set(7, 4, Ro[4]);
    P.vline(8, 9, 13, Ro[3]);
    P.hline(5, 11, 14, A[2]);
  },
  grShade: (P) => {
    P.rect(4, 6, 8, 3, Ru[2]);
    P.rect(3, 9, 10, 2, Ru[2]);
    P.hline(4, 11, 10, Sn[4]);
    P.vline(8, 2, 6, A[2]);
    P.set(8, 12, E[5]);
  },
  grPlaque: (P) => {
    P.rect(1, 5, 14, 6, Ro[3]);
    P.hline(3, 12, 7, A[1]);
    P.hline(3, 9, 9, A[1]);
    for (const x of [2, 13]) for (const y of [6, 9]) P.set(x, y, Ro[5]);
  },
};
for (const d of NEW_DECOR) {
  DECOR_DRAW[d.id] ??= D[d.id];
  ICON_DRAW[decorItem(d.id)] ??= D[d.id];
}

// ================= 大事卡片：老手、打法挑战、第二年的清单 =================
Object.assign(MOMENT_KINDS, {
  master: { label: "老手", color: "#ffd76a" },
  challenge: { label: "打法挑战", color: "#f1a28a" },
  list2: { label: "第二年的清单", color: "#ffcf6a" },
});
// 两句新的短乐句：老手（往上走的三声钟，后面一声低音托着）、打法挑战（两声鼓接一声号）
Object.assign(STINGERS, {
  master: [[0, "bell", 72, 0.5], [0.14, "bell", 76, 0.5], [0.28, "bell", 79, 0.55], [0.28, "pad", 60, 0.35], [0.5, "bell", 84, 0.6]],
  challenge: [[0, "tom", 43, 0.75], [0.12, "tom", 43, 0.6], [0.26, "pluck", 67, 0.55], [0.4, "flute", 74, 0.5], [0.4, "pad", 55, 0.3]],
});
Object.assign(MOMENT_SOUND, {
  master: { stinger: "master", ui: true },
  challenge: { stinger: "challenge", ui: true },
  list2: { stinger: "actDone", ui: true },
});
