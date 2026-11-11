// v0.50「落脚」：章节这一层的数据。五章的名字和天数、第一章的目标、把关的考验、过场、队友说的话。
// 文案和判定分开：判定都在 chapter.js 里读引擎的真实状态。

export const SAVE_FORMAT = "ember-r1";
export const SAVE_KEY = "ember-farm-r1";
export const PREFS_KEY = "ember-farm-r1-prefs";

// 五章：名字、哪几天、这一章的大目标、把关的考验。open=false 的还没做，不能进。
export const CHAPTERS = {
  1: { n: 1, name: "落脚", days: [1, 9], goal: "把破农场变成能过夜的营地", gate: "第一场尸潮", open: true },
  2: { n: 2, name: "营地", days: [10, 20], goal: "养活六个人，车队到站，集市开张", gate: "灰隼团来袭", open: false },
  3: { n: 3, name: "前哨", days: [21, 32], goal: "通电开工，收回五片地区，熬过寒潮", gate: "寒潮里的第一个长夜", open: false },
  4: { n: 4, name: "据点", days: [33, 45], goal: "管一片地区：五张边境图、地铁隧道", gate: "两个长夜，打赢三凶", open: false },
  5: { n: 5, name: "重光", days: [46, 56], goal: "把余烬地区接回外面，守住最后一夜", gate: "最后一夜", open: false },
};
export const CN_NUM = ["零", "一", "二", "三", "四", "五"];

// 第一章去得了的地方；别的路第二章再走
export const CH1_REGIONS = ["farm", "market", "residential"];

// 第一章的五段：每段一句话的题目。段里要做的几件事在 chapter.js 里按真实状态列出来。
export const CH1_STAGES = {
  settle: { title: "先让这片地长出口粮", why: "旧终端上的联络站说：地要是还能长出粮食，就回个信。" },
  road: { title: "守住东边的路口", why: "林子里的东西闻着炊烟来了。" },
  people: { title: "把阿禾接回来", why: "废弃居民区有人用旧电台求援，她守着一箱种子。" },
  prep: { title: "天黑以前备好", why: "铁锹说，林子里的鸟这几天都不叫了。" },
  gate: { title: "守住第一场尸潮", why: "它们今晚会从东边的路口进来。" },
  done: { title: "第一章做完了", why: "余烬农场记入了联盟的名册。" },
};

// 备战要备好的五样（接回阿禾以后）
export const PREP = {
  foodDays: 3, // 口粮够全营吃三天
  fences: 8, // 围栏和大门一共八段
  traps: 2, // 路障陷阱两个
  heal: 4, // 绷带或药包四份
  breeder: 1, // 一个育种箱：以后不用总跑集市买种子
};
// 第一章里菜长得慢（头两株口粮不算）：萝卜早上种下、傍晚收，一天一茬；土豆要两天
export const CH1_GROW = 0.2;
// 第 6 天傍晚来几只探路的：尸潮的前兆
export const SCOUT = { day: 6, from: 18 * 60, to: 21 * 60, kinds: ["slow", "slow", "runner", "slow"] };

// 把关的考验：第一场尸潮
export const GATE1 = {
  day: 9, // 最晚第 9 天夜里来
  earlyFrom: 8, // 第 8 天起备好了可以提前迎战
  omenHour: 18, // 前一天 18:00 有前兆
  warnHour: 19, // 当天 19:00 提醒回农场
  hour: 21, // 21:00 来
  prepSeconds: 75, // 预警到进场
  base: 10, // 来多少只：10 只起
  perFood: 12, // 仓库里每多 12 份口粮多 1 只
  perFence: 3, // 每 3 段围栏多 1 只（守得住的才招得来）
  max: 16,
  phase: 0, // 来的是哪一段的感染者：和头三天在废弃居民区碰到的一样（游荡者 110 血，奔跑者比你走路快）
  gap: 3.2, // 两只之间隔几秒进场
  lane: { x: 1432, y: 396, spread: 22 }, // 都从东边路口这一处进来（上下散开一点）
  retryDays: 1, // 没守住：第二天夜里再来
  reward: { money: 300, items: { ammo: 12, bandage: 2, seedTomato: 4 } },
};

// 开场：我是谁、为什么留下。每张一段话；origin 那一张按出身换。
export const INTRO = [
  { art: "city", text: "城市是三年前沉寂的。先是停电，然后是广播，最后连逃难的车队也不再从公路上经过。" },
  { art: "road", text: "你一路往北，走到鞋底磨穿。林子尽头有一间农舍：屋顶还在，井里还有水，门前的地翻开来是黑的。" },
  { art: "origin", text: "" },
  { art: "terminal", text: "农舍的旧终端还亮着，屏幕上只有一行字：“这里是联盟联络站。那片地要是还能长出口粮，回个信，我们派人来。”" },
  { art: "farm", text: "你把背包放在了门边。先让这片地长出两株作物，再说别的。" },
];
export const INTRO_ORIGIN = {
  farmer: "你种过地。你知道黑土是什么意思：只要有人肯弯腰，它就还肯长东西。",
  medic: "你在旧医院帮过忙。你见过的人里，死于咬伤的不多，死于饿的多。",
  hunter: "你在林子里下过套。你知道一个地方有没有活路，看水，看土，看鸟还来不来。",
  mechanic: "你修过车，也修过发电机。能修的东西你舍不得丢下，这间农舍也算一样。",
  veteran: "你守过哨卡，守到最后只剩你一个。这一回，你想守一样自己选的东西。",
};

// 第一章结尾的过场。who 是说话的人（空着是旁白）。{days} {harvest} {kills} 换成真数。
export const CH1_END = [
  { who: "", text: "天亮了。围栏倒了两段，田里踩坏了一垄，可农舍的灯一夜没灭。" },
  { who: "farmer", text: "阿禾：我在居民区守了四十天，没睡过一个整觉。昨晚守完，我靠着墙就睡着了。" },
  { who: "tieqiao", text: "铁锹：报告，一只都没放进来。那个……早饭谁做？" },
  { who: "", text: "终端响了一声。联络站来信：“余烬农场，记入名册。从今天起，你们是一处营地了。”" },
  { who: "", text: "第一章 落脚 · 完\n用了 {days} 天，收了 {harvest} 株菜，打退 {kills} 只感染者。" },
];
export const CH1_AFTER = "第二章〈营地〉在下一版开放。现在可以留在农场接着经营：地照种，人照吃饭，尸潮过几天还会再来。";

// 队友对你做过的事说的话。每条只说一次；when 在 chapter.js 里按 id 判定。
export const BARKS = {
  firstFence: { who: "tieqiao", text: "铁锹：围栏立起来了？行，今晚我能把鞋脱了睡。" },
  firstTrip: { who: "tieqiao", text: "铁锹：你一个人去居民区？下回带上我，我背东西不比你差。" },
  farmerHome: { who: "farmer", text: "阿禾：这片地比我想的好。头一排交给我，你去忙别的。" },
  farmerFed: { who: "farmer", text: "阿禾：热的。我都忘了饭是热的了。" },
  hungry: { who: "tieqiao", text: "铁锹：仓库见底了。我少吃一顿没事，阿禾不行。" },
  tenHarvest: { who: "farmer", text: "阿禾：十株了。留两株最好的别吃，我来留种。" },
  bigLoot: { who: "tieqiao", text: "铁锹：这一趟背回来不少。我都给你码好了，木头一堆，铁皮一堆。" },
  hurtBack: { who: "farmer", text: "阿禾：你流血了。坐下，别动，绷带在哪儿？" },
  omen: { who: "tieqiao", text: "铁锹：东边林子里的鸟全飞了。明天夜里，大的要来。" },
  gateDay: { who: "farmer", text: "阿禾：我不会打，可我能把灶火看住，谁伤了回来有口热的。" },
  gateLost: { who: "tieqiao", text: "铁锹：没守住，人还在就行。围栏和陷阱我连夜扶起来了，剩下的天亮再补。它们还会再来。" },
};

// 第一章里先不出现的话（别的章的东西）：整句不弹，也不进消息记录
export const CH1_QUIET = [
  /学会了天赋/,
  /医院方向/,
  /下午的事/,
  /夜行者|宵禁/,
  /营地有新消息|新消息：/,
  /出货箱换钱买粮/,
  /重建站|清单|复兴工程|长夜|十凶|巨怪/,
  /技能成长|天赋/,
];
// 换个说法的（第一章里叫法不一样）
export const CH1_REWORD = [
  [/任务手记里“收到的消息”/g, "手记里的“消息”"],
  [/任务手记/g, "手记"],
  [/点右上角“☰ 菜单”打开/g, "在右下角的按钮里"],
  [/（触屏上是“翻滚”按钮）/g, ""],
  [/，触屏上是“翻滚”按钮/g, ""],
  [/多种萝卜做干粮，或把东西放进出货箱换钱买粮。/g, "多种萝卜做干粮，或者去集市换。"],
  [/吃一份药包，再睡一晚就退烧。/g, "吃一份药包，再睡一晚就退烧（集市的林姨那儿有药包）。"],
  [/巨型的那一个能拿去收获展（一棵顶一组）。/g, "巨型的那一个能卖个好价钱。"],
  // “第一次见到”一个人的那张小卡：新界面里没有送礼、没有“人”那一页
  [/和他说话：他是谁、在干什么、喜欢什么/g, "和他说话：他是谁、在干什么"],
  [/送对了礼物信任涨得快；喜欢什么写在“人”那一页/g, ""],
];
// 第一章里先不摆出来的人和东西（后面几章的：过节的广场、来串门的几位、订单板、菜地告示牌、入营审查）。
// 摆着的话走到跟前按 E，只有一句“第二章再用”，有两位还先把要托你办的事说一遍。
export const CH1_HIDDEN = ["seasonPlaza", "seasonJiang", "seasonAli", "seasonAdou", "seasonLodger", "seasonHe", "btOrders", "frontierBoard", "outpostVisitor"];
// 第一章集市上多卖的：发了烧要用的药包（旧医院第二章才去得了）
export const CH1_STOCK = { food: { medkit: 2 } };

// 出门一趟：打开这一趟的头一个柜子以后，三样里挑一样，只管这一趟
export const TRIP_BOONS = [
  { id: "fleet", name: "轻装", text: "这一趟走得快两成", buff: "speed" },
  { id: "thick", name: "裹紧", text: "这一趟受的伤少两成", buff: "defense" },
  { id: "second", name: "喘口气", text: "当场回 25 生命、回满体力", heal: 25 },
  { id: "lucky", name: "手气", text: "这一趟下一个柜子多翻出一份", lucky: true },
  { id: "wind", name: "不喘", text: "这一趟跑步少费一半体力", buff: "stamina" },
];

// 每一章能建的东西（前面几章的也都能建）。界面上下一章的那几样画成锁着的。
export const CH_BUILD = {
  1: ["field", "rain", "scarecrow", "compost", "breeder", "chest", "cook", "workbench", "weaponbench", "bed", "fence", "gate", "trap"],
  2: ["coop", "alTree_mulberry", "alTree_peach", "alTree_apple", "alTree_persimmon", "medCabinet", "alPickleJar", "alWineJar", "tower", "lure", "repairpost", "floor", "chair", "lamp", "bookshelf", "table", "harvestTrophy"],
  3: ["irrigation", "greenhouse", "drone", "solar", "stove", "rlStation"],
};
export const BUILD_TABS = [
  { id: "farm", name: "种地" },
  { id: "live", name: "吃住" },
  { id: "guard", name: "防守" },
  { id: "tech", name: "黑科技", chapter: 3 },
];
