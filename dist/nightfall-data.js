// v0.35.0「长夜」的数据：《爽点与耐玩体检方案》第四版，第 7 条（长夜千篇一律，输了白输）。
// 1. 夜相：每个长夜一种，按时节轮换（一年 28 天，长夜落在每个时节的第 3 天：回暖、酷暑、秋收、寒潮各一个），
//    每个时节两样，单数年一样、双数年另一样；前一天的早间广播、手记、顶上的提醒，当天 08:00 一张卡片都说，逼人改布置。
//    难度线不动：一个人守、备好防守的平均倒下率都和原来差不多，同一套布置在不同夜相里有高有低。
// 2. 没守住也留东西：第二天早上营地里一段话、守夜笔记里记一页（这个夜相第一次没守住还留一件纪念物），
//    下一次同样的夜相，预告里多一句弱点提示；不给钱、不给打仗的东西，故意输刷不出什么。
// 3. 废墟、隧道里倒下也记一笔：倒下的地方 7 天里留个记号，再进这张图提一句是谁打的、下回怎么防。
import { ITEMS } from "./data.js";
import { PAL } from "./pixel-kit.js";
import { DRAW as ICON_DRAW } from "./item-sprites.js";
import { DECOR_BY_ID, DECOR_DRAW, decorItem } from "./almanac-data.js";
import { MOMENT_KINDS } from "./zest-data.js";
import { MOMENT_SOUND, STINGERS } from "./audio-data.js";

export const NIGHTFALL_SCHEMA = 1;

// ================= 1. 夜相 =================
// 数都是对“原来的长夜”乘的；没写的就是不变。
//   towerRange：瞭望塔够得着多远（原来 320）；clear：雾里人身边看得清的一圈（画面上的雾、机器人看预兆都按它）；
//   towerDmg：瞭望塔一发的伤害；trapMute：陷阱每次踩到几成哑火；trapFirst：每个陷阱第一下不响；
//   count：每波多少只；mix：这一种感染者的份数乘多少；speed：感染者走多快；hp：感染者多少血（头目不算）；
//   regen：你的体力回得多快；warmRegen：在火炉、篝火边上体力回得多快；bossEarly：头目早来几个游戏分钟；oneDir：三波都从同一个方向来
export const PHASES = {
  fog: {
    name: "雾夜",
    season: "thaw",
    short: "雾大，瞭望塔看不远",
    rule: "雾大，瞭望塔只够得着原来的六成，你身边一圈以外的东西看不清。",
    hint: "雾夜瞭望塔看不远：陷阱和塔都往里收，人站在灯底下，等它们撞上来。",
    good: "陷阱、围栏、守在灯下",
    bad: "离得远的瞭望塔",
    fx: { towerRange: 200, clear: 230 },
  },
  thunder: {
    name: "春雷夜",
    season: "thaw",
    short: "打雷下雨，陷阱会哑",
    rule: "雨水灌进陷阱，每次踩到两成五哑火；雷声盖住了动静，每波少来一成。",
    hint: "春雷夜陷阱会哑：多摆两个，或者靠瞭望塔和守卫。",
    good: "瞭望塔、守卫、自己动手",
    bad: "只靠陷阱",
    fx: { trapMute: 0.25, count: 0.9 },
  },
  moon: {
    name: "满月夜",
    season: "heat",
    short: "月亮亮，夜行者多",
    rule: "月亮亮，瞭望塔打得准，一发多五成；夜行者多三成，专绕到背后扑。",
    hint: "满月夜夜行者多：背靠墙站，手电照着它会退开；瞭望塔今晚最准。",
    good: "瞭望塔、背靠墙",
    bad: "四面空着的空地",
    fx: { towerDmg: 1.5, mix: { stalker: 1.3 } },
  },
  swelter: {
    name: "闷热夜",
    season: "heat",
    short: "闷热，体力回得慢",
    rule: "闷得喘不上气，你的体力回得慢四成；热得它们也发软，血少一成五、走得慢一成。",
    hint: "闷热夜体力回得慢：少跑少滚，让陷阱和瞭望塔先打。",
    good: "陷阱、瞭望塔、守卫",
    bad: "一个人追着打",
    fx: { regen: 0.6, hp: 0.85, speed: 0.9 },
  },
  migrate: {
    name: "迁徙夜",
    season: "harvest",
    short: "尸群迁徙，奔跑者多",
    rule: "尸群在迁徙，奔跑者多四成、重甲少三成；一路赶过来累了，血少一成。",
    hint: "迁徙夜奔跑者多：长矛、砍刀顶住扑来的，陷阱摆在它们来的路上。",
    good: "长矛、砍刀、路上的陷阱",
    bad: "慢的重武器",
    fx: { mix: { runner: 1.4, armor: 0.7 }, hp: 0.9 },
  },
  gale: {
    name: "大风夜",
    season: "harvest",
    short: "大风，三波都从一边来",
    rule: "风从一边吹，三波都从同一个方向来（前一天说是哪边）；风大，叫声传不远，每波少来一成；瞭望塔的箭被吹偏，一发少两成。",
    hint: "大风夜三波都从一边来：陷阱和围栏都挪到那一边。",
    good: "挪到那一边的陷阱和围栏",
    bad: "摆在别处的瞭望塔",
    fx: { oneDir: true, count: 0.9, towerDmg: 0.8 },
  },
  frost: {
    name: "冰夜",
    season: "cold",
    short: "冰冻，感染者慢，头目早来",
    rule: "冻僵了，感染者走得慢两成、血多一成；天寒地冻，头目饿得早，早半个钟点来（02:30）；火炉、篝火边上你的体力回得快五成。",
    hint: "冰夜头目 02:30 就来：第三波别拖，打完马上包扎；守在火炉、篝火边上回体力。",
    good: "火炉边、速战速决",
    bad: "拖到后半夜",
    fx: { speed: 0.8, hp: 1.1, warmRegen: 1.5, bossEarly: 30 },
  },
  snow: {
    name: "雪夜",
    season: "cold",
    short: "大雪，陷阱第一下不响",
    rule: "雪埋住了陷阱，每个陷阱第一下不响；雪地上的脚印让头目早半个钟点来（02:30）。",
    hint: "雪夜陷阱第一下不响、头目早来：多摆一道陷阱，02:30 前包扎好。",
    good: "瞭望塔、守卫、多一道陷阱",
    bad: "只摆一道陷阱",
    fx: { trapFirst: true, bossEarly: 30 },
  },
};
export const PHASE_IDS = Object.keys(PHASES);
// 每个时节两样：单数年用第一样，双数年用第二样（连着四个长夜是四个时节，不会重样）
export const SEASON_PHASES = { thaw: ["fog", "thunder"], heat: ["moon", "swelter"], harvest: ["migrate", "gale"], cold: ["frost", "snow"] };
export const SEASON_NAMES = { thaw: "回暖", heat: "酷暑", harvest: "秋收", cold: "寒潮" };
// 画面：tint/k 是天色往这个颜色拉多少（盖过一部分长夜的红）；其余是这一夜画上去的东西；sound：农场的环境声换成哪一段
export const PHASE_LOOK = {
  fog: { tint: [112, 120, 122], k: 0.42, fog: true },
  thunder: { tint: [78, 94, 140], k: 0.45, rain: true, flash: true, sound: "rainHeavy" },
  moon: { tint: [128, 150, 214], k: 0.55 },
  swelter: { tint: [196, 112, 54], k: 0.4, motes: true },
  migrate: { tint: [150, 122, 80], k: 0.42, dust: true },
  gale: { tint: [112, 124, 140], k: 0.4, wind: true, sound: "windStrong" },
  frost: { tint: [124, 164, 218], k: 0.5, snow: 1, sound: "snow" },
  snow: { tint: [150, 164, 196], k: 0.5, snow: 2, sound: "snow" },
};

// ================= 2. 没守住留下的 =================
// 每个没守住的晚上：第二天早上一段话、守夜笔记里一页（最近 12 页）；这个夜相第一次没守住，另外一件纪念物（摆件，只给一次）
export const NOTES_MAX = 12;
const KEEPSAKES = {
  fog: { id: "nfFog", name: "雾里的哨子", desc: "雾夜里吹到嘶哑的哨子，第二天在围栏边捡回来的。" },
  thunder: { id: "nfThunder", name: "泡烂的陷阱夹", desc: "春雷夜泡在泥水里哑了火的夹子，锈住了，留着提醒自己。" },
  moon: { id: "nfMoon", name: "月下的布条", desc: "满月夜被夜行者扯下来的一截袖子，月光下看得清清楚楚。" },
  swelter: { id: "nfSwelter", name: "汗透的头巾", desc: "闷热夜里拧得出水的头巾，晒干了还是一股咸味。" },
  migrate: { id: "nfMigrate", name: "踩烂的路标", desc: "迁徙夜被尸群踩倒的路标，上面还有一串脚印。" },
  gale: { id: "nfGale", name: "吹断的旗杆", desc: "大风夜拦腰吹断的旗杆，那一边的围栏后来加了一道。" },
  frost: { id: "nfFrost", name: "冻裂的水壶", desc: "冰夜里冻裂的铁水壶，裂口像一道闪电。" },
  snow: { id: "nfSnow", name: "雪里挖出的铃铛", desc: "雪夜埋在陷阱边上的铃铛，第二天才从雪里挖出来。" },
};
export const NF_KEEPSAKE = Object.fromEntries(Object.entries(KEEPSAKES).map(([ph, k]) => [ph, k.id]));
// 只进 DECOR_BY_ID（摆得出来、认得出来），不进 DECOR 那张表：柜子、商队里不会冒出它们；卖不了钱
for (const k of Object.values(KEEPSAKES)) {
  DECOR_BY_ID[k.id] ??= { id: k.id, name: k.name, where: [], desc: k.desc, nightfall: true };
  const item = decorItem(k.id);
  if (!ITEMS[item]) ITEMS[item] = { name: k.name, type: "resource", sell: 0, decor: k.id, desc: k.desc + "（纪念物，摆件：在建设里选「旧物摆件」摆出来）" };
}
export const NF_DECOR = Object.values(KEEPSAKES).map((k) => k.id);
// 第二天早上营地里的一段话（谁在营地里就谁说；都不在，就是你自己在日记里写）
export const MORNING_LINES = {
  farmer: ["阿禾把你扶回屋里，说：“田没事，人没事就好。下回我守东边。”", "阿禾一早就去补围栏：“它们是从哪边进来的？我记下了。”"],
  medic: ["许医生给你换了药：“伤不重，就是累。下一个长夜之前好好睡一觉。”", "许医生把绷带卷好放在你枕边：“下回多带两卷。”"],
  mechanic: ["陈工蹲在陷阱边上看了半天：“这玩意儿得换个地方摆。”", "陈工把歪了的瞭望塔扶正：“木头没断，还能用。”"],
  cartographer: ["柏岚在地图上画了几个箭头：“它们是从这几条沟里出来的。”", "柏岚把昨晚的风向记在本子上：“下回我早点看天。”"],
  any: ["天亮了，营地里的人一个也没少。大家都没提昨晚的事，饭桌上多了一碗汤。", "营火边有人说：“长夜还会来，下一回我们一起守。”"],
};
export const SELF_LINE = "你在日记里写下昨晚的事：哪边先破的、哪一波最难。";

// ================= 3. 废墟、隧道倒下也记一笔 =================
// 倒下的地方留 7 天记号（隧道每天的样子不一样，只记第几层），再进这张图提一句（每次倒下只提一次）
export const FALL_MARK = { days: 7, keep: 30 };
// 谁打倒的 → 下回怎么防（和游戏里的预兆说法一样）
export const FALL_HINTS = {
  slow: "游荡者慢，怕的是被围：边退边打，贴上来就推开。",
  runner: "奔跑者蹲下就要扑：往旁边一滚躲开，或者带砍刀迎面砍腿。",
  screamer: "尖叫者吸气时会把别的叫来：先打它，打断那一口气。",
  armor: "重甲跺脚就要冲：闪开再打背后，或者带消防斧把甲劈开。",
  elite: "仓库守卫甲还在时绕到背后打，它出手就退开；大锤能正面砸松甲片。",
  raider: "灰隼团的枪手隔着远打：贴着墙和柜子走，近了再打。",
  bloater: "膨胀者死前闪一下就要炸毒雾：打倒它马上走开。",
  faker: "装死者躺在地上，走近会抓脚踝：路过躺着的先补一下，被抓就挣开。",
  spitter: "吐酸者仰头就要吐：扔块石头打断它，别站在酸液里。",
  stalker: "夜行者绕到背后扑：背靠墙走，手电照着它会退开。",
  brute: "大块头地上一圈红是要砸地，一条线是要扔车门：绕到背后打。",
  nurse: "护士长吸气时打她一下就能打断尖叫；绿圈会给身边的感染者回血。",
  hunger: "饿晕了：出门前吃饱，背包里带两样吃的。",
  any: "血少了先退出去包扎，下回多带两卷绷带。",
};

// ================= 旧档的说明 =================
export const INTRO_LINES = [
  "长夜各有夜相了：" + Object.values(SEASON_PHASES).flat().map((p) => PHASES[p].name).join("、") + "，按时节轮换；前一天的早间广播、手记都会说。",
  "没守住也会留下点什么：第二天早上的一段话、守夜笔记里的一页，第一次输给某个夜相还有一件纪念物；下回同样的夜相会提醒你。",
  "在废墟、隧道里倒下，那里会留个记号；再进去时提一句是谁打的、下回怎么防。",
];

// ================= 大事卡片 =================
Object.assign(MOMENT_KINDS, {
  nfPhase: { label: "夜相", color: "#a9c4e6" },
  nfLost: { label: "守夜笔记", color: "#c9b8a0" },
});
// 两句短乐句：夜相（一声低鼓、一层垫音、一声长笛往上走）、守夜笔记（三声往下走的钟）
Object.assign(STINGERS, {
  nfPhase: [[0, "tom", 38, 0.7], [0.18, "pad", 50, 0.4], [0.42, "flute", 62, 0.35], [0.7, "flute", 65, 0.3]],
  nfLost: [[0, "bell", 72, 0.4], [0.22, "bell", 67, 0.4], [0.44, "bell", 64, 0.45], [0.44, "pad", 52, 0.3]],
});
Object.assign(MOMENT_SOUND, {
  nfPhase: { stinger: "nfPhase", ui: true },
  nfLost: { stinger: "nfLost", ui: true },
});

// ================= 小图（16×16） =================
const A = PAL.ash,
  So = PAL.soil,
  E = PAL.ember,
  St = PAL.straw,
  W = PAL.water,
  Ro = PAL.stone,
  Ru = PAL.rust,
  Cl = PAL.cloth,
  Sn = PAL.snow;
const D = {
  // 雾里的哨子：铜哨，挂着一截绳子
  nfFog: (P) => {
    P.rect(4, 7, 8, 4, St[2]);
    P.disc(11, 9, 2.4, St[2]);
    P.set(10, 8, A[1]);
    P.hline(4, 8, 7, St[3]);
    P.line(4, 9, 1, 3, Cl[5]);
    P.set(13, 9, St[1]);
  },
  // 泡烂的陷阱夹：两片锈齿，中间一根簧
  nfThunder: (P) => {
    P.hline(2, 13, 11, Ru[2]);
    P.hline(2, 13, 12, Ru[1]);
    for (let x = 3; x <= 12; x += 3) {
      P.set(x, 10, Ru[3]);
      P.set(x + 1, 9, Ru[3]);
    }
    P.disc(8, 8, 1.6, Ro[3]);
    P.set(5, 13, W[3]);
    P.set(11, 13, W[3]);
  },
  // 月下的布条：一截撕破的布，月光白
  nfMoon: (P) => {
    P.rect(3, 4, 9, 4, Cl[4]);
    P.rect(5, 8, 7, 3, Cl[4]);
    P.line(11, 11, 13, 14, Cl[3]);
    P.hline(3, 11, 4, Sn[2]);
    P.set(4, 8, Cl[3]);
    P.set(7, 11, Cl[3]);
  },
  // 汗透的头巾：叠起来的红头巾，深一块浅一块
  nfSwelter: (P) => {
    P.rect(2, 6, 12, 5, Cl[1]);
    P.rect(3, 7, 4, 2, Cl[0]);
    P.rect(9, 8, 3, 2, Cl[0]);
    P.hline(2, 13, 6, Cl[2]);
    P.line(12, 11, 14, 14, Cl[1]);
  },
  // 踩烂的路标：歪倒的木牌，一串脚印
  nfMigrate: (P) => {
    P.line(3, 13, 9, 5, So[2]);
    P.rect(7, 2, 7, 4, So[3]);
    P.hline(8, 12, 3, So[1]);
    P.set(4, 9, A[2]);
    P.set(6, 11, A[2]);
    P.set(11, 10, A[2]);
    P.set(13, 12, A[2]);
  },
  // 吹断的旗杆：断成两截的杆子，一角旗
  nfGale: (P) => {
    P.vline(4, 6, 14, So[2]);
    P.line(5, 5, 12, 2, So[2]);
    P.rect(9, 3, 4, 3, Cl[2]);
    P.set(13, 4, Cl[1]);
    P.set(4, 5, St[3]);
    P.set(5, 6, St[3]);
  },
  // 冻裂的水壶：铁壶，一道白裂口
  nfFrost: (P) => {
    P.disc(8, 9, 4.6, Ro[2]);
    P.rect(6, 3, 4, 2, Ro[3]);
    P.line(12, 7, 14, 5, Ro[3]);
    P.line(7, 6, 9, 9, Sn[4]);
    P.line(9, 9, 7, 12, Sn[4]);
    P.set(5, 8, Ro[4]);
  },
  // 雪里挖出的铃铛：铜铃，上面一点雪
  nfSnow: (P) => {
    P.rect(5, 6, 6, 5, St[1]);
    P.rect(4, 10, 8, 2, St[1]);
    P.vline(8, 3, 5, A[3]);
    P.set(8, 13, E[2]);
    P.hline(5, 10, 6, Sn[4]);
    P.set(6, 7, St[3]);
  },
};
for (const id of NF_DECOR) {
  DECOR_DRAW[id] ??= D[id];
  ICON_DRAW[decorItem(id)] ??= D[id];
}
