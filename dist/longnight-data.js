// v0.25.0「长夜」的数据：主线打完以后的长夜、灰隼团反扑、出身、二周目和存档提醒。
// 数都写在这里；没有真人数据的先按机器人模拟定（见 docs/releases/v0.25.0.md）。
import { ITEMS } from "./data.js";
import { CUES } from "./feel-data.js";

export const LN_SCHEMA = 1;

// ================= 长夜 =================
// 主线第 8 段打完以后，每 7 天一个长夜（和节庆错开 3 天：第 7n+3 天），最早在主线结束两天后。
// 当天 08:00 日期变红，18:00 天边发红、打雷，22:00 一声尖叫，尸潮开始；04:00 天亮。
export const LN = {
  every: 7,
  mod: 3,
  lead: 2,
  red: 480,
  dusk: 1080,
  warn: 1260,
  start: 1320,
  // 三波：22:00、00:00、02:00（离 22:00 多少分钟）；上一波打完 20 秒后下一波提前来
  waveAt: [0, 120, 240],
  base: [10, 12, 14],
  gap: 20,
  // 守住一个，下一个多两成，最多一倍
  grow: 1.2,
  cap: 2,
  // 场上最多同时 22 只，1.6 秒出一只
  maxAlive: 22,
  interval: 1.6,
  // 第三波的头目：这一波的都出来了、场上剩 4 只以下时来，最多等 75 秒
  bossWhen: 4,
  bossAfter: 75,
  // 长夜里的头目血量：尸潮里的感染者都多两成五的血（统一高难度），头目按 0.8 算回来，和废墟里的差不多
  bossHp: 0.8,
  // 从 22:00 到 04:00
  length: 360,
  // 守满 10 个有结局
  goal: 10,
};
// 每一波里各种感染者的份数（第 8 天以后的数值）；第三波另有一个头目
export const WAVE_MIX = [
  { slow: 5, runner: 3, armor: 1, bloater: 1 },
  { slow: 4, runner: 3, armor: 1, bloater: 1, spitter: 1, stalker: 1 },
  { slow: 3, runner: 3, armor: 1, bloater: 1, spitter: 1, stalker: 1, screamer: 1 },
];
// 第三波的头目：大块头、护士长轮流
export const LN_BOSSES = ["brute", "nurse"];
// 守住了给什么：金币 120 + 20 × 守住的个数；稀有掉落 1 + 守住的个数 / 3 次（九成稀有、一成珍贵）
export const LN_REWARD = { money: 120, per: 20, draws: 1, every: 3, odds: [0, 0, 0.9, 0.1] };
// 第 1、5、10 个长夜守住时给一件纪念品，捐给档案馆的第七个展柜
export const MEMENTO_AT = { 1: "lnWhistle", 5: "lnFlag", 10: "lnLantern" };
const MEMENTOS = {
  lnWhistle: { name: "长夜的铁哨", desc: "第一个长夜里吹了一整夜的铁哨子。可以捐给档案馆。" },
  lnFlag: { name: "抓破的布旗", desc: "第五个长夜插在围栏上的布旗，被抓得稀烂。可以捐给档案馆。" },
  lnLantern: { name: "没灭的马灯", desc: "守满十个长夜，那盏一直没灭的马灯。可以捐给档案馆。" },
};
for (const [id, t] of Object.entries(MEMENTOS)) ITEMS[id] ??= { name: t.name, icon: 55, type: "quest", protected: true, desc: t.desc };
export const MEMENTO_IDS = Object.keys(MEMENTOS);
// 档案馆的第七个展柜
export const LN_CASE = { name: "长夜纪念", need: 3, reward: "营地声望 +10，居民士气 +5" };
// 第十个长夜守住以后：档案岛最后一段广播 + 结局卡
export const ENDING = {
  title: "余烬地区收复",
  broadcast: "档案岛广播：“这里是档案岛。余烬前哨守住了第十个长夜。东边的林子、南边的池塘、北边的旧水井，今天早上都没有感染者的动静——余烬地区，收复了。”",
  lines: [
    "天亮的时候，档案岛的广播又响了。这一次不是求救。",
    "“这里是档案岛。余烬前哨守住了第十个长夜。东边的林子、南边的池塘、北边的旧水井，今天早上都没有感染者的动静。”",
    "“余烬地区，收复了。”",
    "长夜还会来，只是不会再变大了。地里的菜照样要种，围栏照样要修——日子接着过。",
  ],
};

// ================= 灰隼团反扑 =================
// 主线打完后第 5 天：两个探子在一片废墟里（打倒两个拿到他们的地图）；第 7 天 23:00：两个人摸进农场破坏一座设施；
// 第 10 天 19:00：头领“隼头”带人来（有枪、扔烟雾弹，不撤退；他倒下，剩下的人就跑）。都不落在长夜那天。
export const COUNTER = {
  scouts: { after: 5, n: 2, flee: 0.35, sight: 380, ammo: [3, 6] },
  sabotage: { after: 7, at: 1380, n: 2, plant: 11, setback: 3, power: 5, warn: 1200 },
  final: { after: 10, size: 8, leaderAt: 2, autoMul: 1.2, retry: 2 },
};
// 头领：比枪手耐打、枪更准更狠，隔一阵扔一颗烟雾弹（烟里的人你只打得掉一半血，瞭望塔和守卫看不见）
export const LEADER = {
  name: "隼头",
  hp: 360,
  damage: 14,
  aim: 0.8,
  cd: [1.6, 2.2],
  smoke: { every: 12, first: 5, r: 120, time: 8, fly: 0.6, range: 420, cut: 0.5 },
};
// 破坏的目标：先挑瞭望塔，没有就挑灯、太阳能板、灶台、火炉、集雨器、储物箱
export const SAB_TARGETS = ["tower", "lamp", "solar", "cook", "stove", "rain", "chest"];
const COUNTER_ITEMS = {
  lnScoutMap: { name: "探子的地图", desc: "灰隼团探子身上的地图：画着他们哪天夜里要摸进农场、冲着什么去。" },
};
for (const [id, t] of Object.entries(COUNTER_ITEMS)) ITEMS[id] ??= { name: t.name, icon: 55, type: "quest", protected: true, desc: t.desc };
export const SCOUT_MAP = "lnScoutMap";
export const COUNTER_REWARD = {
  foiled: { ammo: 10, parts: 2 },
  final: { money: 250, gain: { ammo: 30, parts: 4 }, rep: 15, draws: 2 },
};
export const COUNTER_STEPS = ["废墟里的探子", "夜里的破坏", "头领带人来"];

// ================= 出身：新开一局时选 =================
// 只改开局带的东西和一两条规则，不改感染者。数是方案里的；“种地的”就是原来的开局。
export const ORIGINS = {
  farmer: { name: "种地的", kit: "原来的开局", good: "无", cost: "无", line: "原来的开局，什么都不多、什么都不少。" },
  medic: {
    name: "卫生员",
    kit: "药包 1、皮护臂",
    good: "绷带多回三成血，感染每晚多降 10%",
    cost: "近战伤害少一成",
    line: "在旧医院帮过忙，手稳，下手轻。",
    give: { medkit: 1, leatherBracers: 1 },
    wear: ["leatherBracers"],
    rules: { bandage: 1.3, infection: 10, melee: 0.9 },
  },
  hunter: {
    name: "猎人",
    kit: "弹弓、石材 10、软底鞋",
    good: "蹲着走快一成，陷阱多用一次",
    cost: "没有木棍，开局干粮少 2",
    line: "在林子里下过套，走路没声。木棍得自己做一根矛（木材 3）。",
    give: { slingshot: 1, stone: 10, softShoes: 1 },
    take: { club: 1, bread: 2 },
    wear: ["slingshot", "softShoes"],
    rules: { crouch: 1.1, trapUses: 1 },
  },
  mechanic: {
    name: "机修工",
    kit: "机械零件 4、头灯",
    good: "修东西少花四分之一的材料",
    cost: "体力上限少 10",
    line: "修过车也修过发电机，就是腰不太好。",
    give: { parts: 4, headlamp: 1 },
    wear: ["headlamp"],
    rules: { repair: 0.75, stamina: 90 },
  },
  veteran: {
    name: "退伍兵",
    kit: "铁管、弹药 10",
    good: "推开少花 3 体力，被抓住的时间短两成",
    cost: "饿得快一成",
    line: "当过兵，力气大，饭量也大；身上还留着一把子弹。",
    give: { pipe: 1, ammo: 10 },
    wear: ["pipe"],
    rules: { shove: 3, grab: 0.8, hunger: 1.1 },
  },
};
export const ORIGIN_IDS = Object.keys(ORIGINS);
// 二周目（主线打完后在设置里“带着记忆重新开始”）：带学会的图纸、成就册、生涯记录，再自选一件装备（耐久是满的）
export const LEGACY = { book: 40, name: 24 };

// 声音提示（给听不到的玩家）
Object.assign(CUES, {
  lnThunder: "雷声",
  lnScream: "远处一声长长的尖叫",
  lnWave: "又一波感染者来了",
  lnBoss: "地面在震——头目来了",
  lnLeader: "灰隼团的头领来了",
  smokeCue: "拉开烟雾弹的咔哒声",
  smoke: "烟雾弹炸开了",
  sabPlant: "有人在埋东西",
  sabBoom: "爆炸声",
});
