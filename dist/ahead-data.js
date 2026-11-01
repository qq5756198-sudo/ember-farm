// v0.46.0「有奔头」的数和字：复兴工程（第二年起每个时节开一处，出钱请人把余烬地区的老地方修起来；收复以后开第二期）、
// 手记最上面那张“眼下”、奖励随进度放大、少弹几条提示。
// 依据：《余烬农场 v0.44 试玩报告》第二、三部分（机器人台第 31–120 天挣 38 万只花掉两三成、有一笔 3,000 以上花销的周 5–7/12、
// 第 9 周以后每周新东西 5.4–6.8 件，v0.37 是 9.5–9.7；第 70、200 天手记最上面还是“家园计划 · 第1章 · 2/4”；收复以后没什么可追）。
// 规矩：修好的地方只给方便和花样，不给战力，夜里不会因为它们变容易；一个统一的高难度；旧档只加不减。
import { ITEMS } from "./data.js";
import { PAL } from "./pixel-kit.js";
import { DRAW as ICON_DRAW } from "./item-sprites.js";
import { DECOR_BY_ID, DECOR_DRAW, decorItem } from "./almanac-data.js";
import { MOMENT_KINDS } from "./zest-data.js";
import { MOMENT_SOUND } from "./audio-data.js";

export const AHEAD_SCHEMA = 1;

// 第二年第一天（第 29 天）开第一处，以后每个时节头一天（一个时节 7 天）再开一处；第二期在收复以后的第一个时节头一天开第一处
export const START = { day: 29, hour: 6 };
export const isWeekStart = (day) => (Math.max(1, day) - 1) % 7 === 0;
export const weekStartOnOrAfter = (day) => day + ((7 - ((Math.max(1, day) - 1) % 7)) % 7);

// ================= 复兴工程 =================
// place：在哪片地方（地图上那一格写着）；need：那片地方得去得了（地区修通了或者去过）；cost：金币和材料；
// fx：修好以后的好处；letter：修好第二天早上的信；keep：留给你的一样摆件；special：那片地方的特产（几份；修好三天后先送一回，以后每个时节头一天送）
export const PROJECTS = [
  {
    id: "waterwheel",
    batch: 1,
    place: "valley",
    name: "水车",
    who: "溪谷修水闸的工人们",
    cost: { gold: 3000, wood: 20, stone: 10 },
    text: "溪谷的老水车修好了，水顺着渠引到农场：每天再替你浇 8 块田。",
    letter: "“水车转起来那天，下游三个村子的人都跑来看。水是你们出钱修的，往后你们的田先浇。”",
    keep: { id: "ahWheelModel", name: "小水车模型", desc: "工人们用边角料拼的小水车，手一拨就转。" },
    special: { id: "ahLotus", n: 3, name: "溪谷莲藕", type: "food", sell: 18, food: 12, desc: "溪谷塘里挖的藕，脆，还带着泥。" },
    fx: { water: 8 },
  },
  {
    id: "teahouse",
    batch: 1,
    place: "stationMarket",
    name: "老茶馆",
    who: "茶馆的杜掌柜",
    cost: { gold: 3500, wood: 20, cloth: 4 },
    text: "旧站商街的老茶馆重新开张，有人说书、有人下棋，营地里的人歇工常去坐坐：全营士气 +2。",
    letter: "“开张头一天，满堂。有人哭，有人笑，说好些年没这么坐着喝口热茶了。你们的座位一直留着。”",
    keep: { id: "ahTeaPot", name: "茶馆的铜壶", desc: "茶馆柜台上那把长嘴铜壶，杜掌柜说你们该有一把。" },
    special: { id: "ahOsmanthus", n: 3, name: "桂花糕", type: "food", sell: 16, food: 10, desc: "茶馆的点心，桂花是秋天晒干存下的。" },
    fx: { morale: 2 },
  },
  {
    id: "bath",
    batch: 1,
    place: "courtyard",
    name: "公共澡堂",
    who: "雨巷的周家",
    cost: { gold: 4000, stone: 20, scrap: 10 },
    text: "雨巷的澡堂烧上了热水：洗个热水澡再睡，睡醒「休息好」多 1 个钟点。",
    letter: "“锅炉是拿你们的钱修的，第一锅水先给老人和孩子洗了。周家老太太说，洗完这个澡，才觉得自己又是个人了。”",
    keep: { id: "ahBathSign", name: "澡堂的木牌", desc: "“雨巷浴室”四个字是周家老爷子写的，墨还是新的。" },
    special: { id: "ahSoap", n: 2, name: "皂角", type: "resource", sell: 12, desc: "澡堂熬的皂角，洗衣洗头都行，一股草香。" },
    fx: { rest: 60 },
  },
  {
    id: "lodge",
    batch: 1,
    place: "pinewood",
    name: "护林人小屋",
    who: "雾松林场的守林人",
    cost: { gold: 4500, wood: 30 },
    text: "雾松林场的护林人小屋修好了，守林人住了下来：每天早上替你送来木材 6、松脂 2。",
    letter: "“小屋的炉子生上了。早上我去林子里转一圈，倒了的树、流出来的松脂，都给你们捎过去。”",
    keep: { id: "ahPineLamp", name: "松脂灯", desc: "守林人做的松脂灯，点上满屋松香。" },
    special: { id: "ahPineNut", n: 3, name: "松子", type: "food", sell: 14, food: 6, desc: "守林人在雾松林里捡的松子，炒熟了满手香。" },
    fx: { daily: { wood: 6, resin: 2 } },
  },
  {
    id: "greenhouse",
    batch: 1,
    place: "quarantine",
    name: "育苗温室",
    who: "检疫科研园的研究员",
    cost: { gold: 5000, wood: 20, cloth: 6, parts: 2 },
    text: "检疫科研园的温室重新育苗：每个时节头一天送来这个时节当季的菜种子，每样 3 颗。",
    letter: "“温室里的灯亮了一整夜。苗都是从你们送来的种子里挑的，最壮的那几株先给你们。”",
    keep: { id: "ahSeedTray", name: "育苗盘", desc: "科研园的育苗盘，每一格都贴着手写的标签。" },
    special: { id: "ahMint", n: 3, name: "薄荷", type: "food", sell: 12, food: 2, desc: "温室角落里长疯了的薄荷，泡水喝提神。" },
    fx: { seeds: 3 },
  },
  {
    id: "sewing",
    batch: 1,
    place: "shelter",
    name: "缝纫社",
    who: "避难城缝纫社的刘婶",
    cost: { gold: 5500, wood: 16, cloth: 6 },
    text: "地底避难城的缝纫社开工了：每个时节头一天送来布料 6、绷带 3。",
    letter: "“缝纫机是从仓库里翻出来的，踩起来咔哒咔哒响。头一批做的是孩子们的衣裳，第二批给你们缝了绷带。”",
    keep: { id: "ahThimble", name: "铜顶针", desc: "刘婶用了二十年的顶针，磨得发亮。" },
    special: { id: "ahGloves", n: 2, name: "粗布手套", type: "resource", sell: 15, desc: "缝纫社拿边角布缝的手套，干活不磨手。" },
    fx: { weekly: { cloth: 6, bandage: 3 } },
  },
  {
    id: "handcar",
    batch: 1,
    place: "railDepot",
    name: "手摇轨道车",
    who: "北线货运站的老调度",
    cost: { gold: 6000, scrap: 16, parts: 4 },
    text: "北线货运站修好了几辆手摇轨道车，顺着旧轨道通到各个地区：出门的路再省一成五。",
    letter: "“轨道车跑起来那天，我在站台上吹了三声哨。哨子是我当年用的，四十年了，还响。”",
    keep: { id: "ahWhistle", name: "调度的铜哨", desc: "老调度当年用的铜哨，吹起来又尖又亮。" },
    special: { id: "ahSoda", n: 2, name: "站台汽水", type: "food", sell: 15, food: 4, desc: "货运站冰窖里存的玻璃瓶汽水，拧开“呲”的一声。" },
    fx: { travel: 0.85 },
  },
  {
    id: "boat",
    batch: 1,
    place: "shipyard",
    name: "渔船",
    who: "沉湾船坞的船老大",
    cost: { gold: 6500, wood: 30, cloth: 6 },
    text: "沉湾船坞的渔船修好出海了，船老大教了你几手：钓鱼咬钩快两成。",
    letter: "“新船下水，第一网就捞上来一条大黄鱼。钓鱼的门道我写在信背面了：看水，别看漂。”",
    keep: { id: "ahNetFloat", name: "渔网浮子", desc: "船上换下来的旧浮子，漆成红白两色。" },
    special: { id: "ahDriedFish", n: 2, name: "咸鱼干", type: "food", sell: 20, food: 14, desc: "船坞晒的咸鱼干，蒸一蒸就是一顿。" },
    fx: { bite: 0.8 },
  },
  {
    id: "pharmacy",
    batch: 1,
    place: "hospital",
    name: "药房",
    who: "旧医院药房的护工小秦",
    cost: { gold: 7000, herb: 10, cloth: 4 },
    text: "旧医院一楼的药房收拾出来了：每个时节头一天送来药包 2、草药茶 2。",
    letter: "“药柜擦干净了，一格一格贴上名字。许医生来看过，说比她当年待的医院还整齐。”",
    keep: { id: "ahMortar", name: "药碾子", desc: "铁药碾子，碾过的药草粉留了一屋子香。" },
    special: { id: "ahLicorice", n: 3, name: "甘草片", type: "food", sell: 10, food: 2, desc: "药房切的甘草片，含一片，嗓子不干。" },
    fx: { weekly: { medkit: 2, herbTea: 2 } },
  },
  {
    id: "windtower",
    batch: 1,
    place: "frost",
    name: "测风塔",
    who: "白霜气象站的老站长",
    cost: { gold: 7500, scrap: 12, parts: 4 },
    text: "白霜气象站的测风塔又转起来了：早间广播说后三天的天气，坏天气提前两天就知道。",
    letter: "“风杯转起来的声音，我听了四十年。现在每天早上报给你们的天气，都是我对着它记的。”",
    keep: { id: "ahWindCup", name: "旧风杯", desc: "测风塔上换下来的风杯，三只小碗连在一起。" },
    special: { id: "ahRockSugar", n: 3, name: "冰糖", type: "food", sell: 12, food: 4, desc: "老站长熬的冰糖，一块一块的，透亮。" },
    fx: { forecast: 3 },
  },
  {
    id: "workshop",
    batch: 1,
    place: "farm",
    name: "旧物修复工坊",
    who: "余晖档案岛的管理员",
    cost: { gold: 8500, wood: 16, parts: 4 },
    text: "农场边上开了旧物修复工坊：每个时节头一天告诉你一件还没找到的旧物在哪片废墟、哪种柜子里，在那儿找容易得多。",
    letter: "“每一件旧物后面都有一个名字。工坊开起来以后，能找回来的名字更多了。”",
    keep: { id: "ahMagnifier", name: "放大镜", desc: "修复工坊的放大镜，镜框上缠着胶布。" },
    special: { id: "ahStamp", n: 2, name: "旧邮票", type: "resource", sell: 8, desc: "工坊从旧信封上揭下来的邮票，一张一个地方。" },
    fx: { clue: 1 },
  },
  {
    id: "bell",
    batch: 1,
    place: "farm",
    name: "钟楼",
    who: "营地里的人",
    cost: { gold: 10000, stone: 30, scrap: 10, parts: 6 },
    text: "农场东头立起钟楼，早晚各敲一回：不管在哪片地方，回农场的路都省一半。",
    letter: "“钟是从旧站台拆下来的。挂上去那天，全营地的人都仰着头看；敲第一下的时候，好几个人哭了。”",
    keep: { id: "ahBellRibbon", name: "钟绳上的红布", desc: "挂钟那天系在钟绳上的红布条。" },
    fx: { home: 0.5 },
  },
  // ---------- 第二期：收复以后，把余烬地区接回外面 ----------
  {
    id: "train",
    batch: 2,
    place: "railDepot",
    name: "北线通车",
    who: "北线货运站的老调度",
    cost: { gold: 13000, scrap: 20, parts: 8 },
    text: "北线通到余烬地区外面了：每个时节头一天，火车捎来一样外面的东西。",
    letter: "“第一趟车开出去，空着去，满着回。车上下来一个人，问：‘这儿就是余烬农场吧？’”",
    keep: { id: "ahTicket", name: "第一张车票", desc: "北线通车那天印的第一张车票，盖着红戳。" },
    fx: { outside: 1 },
  },
  {
    id: "school",
    batch: 2,
    place: "shelter",
    name: "地面上的学校",
    who: "地底避难城的孩子们",
    cost: { gold: 14000, wood: 30, stone: 20 },
    text: "避难城的孩子们搬到地面上的学校念书：每个时节头一天，孩子们寄来一封信。",
    letter: "“老师说，今天第一课学写‘家’。我们每个人都写了一遍，寄给你们看。”",
    keep: { id: "ahSchoolBell", name: "上课铃", desc: "学校门口挂的小铜铃，孩子们抢着摇。" },
    fx: { kids: 1 },
  },
  {
    id: "lighthouse",
    batch: 2,
    place: "shipyard",
    name: "灯塔",
    who: "沉湾船坞的船老大",
    cost: { gold: 15500, stone: 30, parts: 6 },
    text: "沉湾的灯塔又亮了，远处的渔船循着灯回港：每个时节头一天送来一箱海货（好鱼 3 条、盐 4）。",
    letter: "“灯塔亮起来的头一夜，海上有三条船打着灯回应。我们不是这片海上唯一的人了。”",
    keep: { id: "ahLens", name: "灯塔的镜片", desc: "换下来的一块灯塔镜片，对着太阳能照出一道彩虹。" },
    fx: { crate: true },
  },
  {
    id: "stage",
    batch: 2,
    place: "market",
    name: "戏台",
    who: "集市的人们",
    cost: { gold: 17500, wood: 40, cloth: 10 },
    text: "幸存者集市搭起戏台：每个时节最后一天唱一台戏，之后三天全营士气 +5。",
    letter: "“头一出唱的是老戏，台下好些人跟着哼。散了场谁也不走，都在台子底下坐着。”",
    keep: { id: "ahMask", name: "红脸谱", desc: "唱戏的师傅画的一张红脸谱，送给出钱搭台的人。" },
    fx: { stage: 5 },
  },
  {
    id: "road",
    batch: 2,
    place: "farm",
    name: "老公路",
    who: "修路的队伍",
    cost: { gold: 19000, stone: 40, scrap: 20 },
    text: "各个地区之间的老公路补好了：出门的路再省一成。",
    letter: "“路修到哪儿，人就跟到哪儿。今天有一家子推着车，从南边一路走到了旧站商街。”",
    keep: { id: "ahMilestone", name: "小里程碑", desc: "路边挖出来的小里程碑，刻着“余烬 3 公里”。" },
    fx: { travel: 0.9 },
  },
  {
    id: "monument",
    batch: 2,
    place: "farm",
    name: "纪念碑",
    who: "余烬地区的人",
    cost: { gold: 21500, stone: 60 },
    text: "农场东头立起纪念碑，刻着守住的每一个长夜和没能回来的人：全营士气 +3。",
    letter: "“碑立起来那天，各个地区的人都来了。没人说话，每个人在碑前放了一样东西。”",
    keep: { id: "ahRubbing", name: "碑文拓片", desc: "纪念碑碑文的拓片，名字一个挨一个。" },
    fx: { morale: 3, finale: true },
  },
];
export const PROJECT_BY_ID = Object.fromEntries(PROJECTS.map((p) => [p.id, p]));
export const BATCH1 = PROJECTS.filter((p) => p.batch === 1).map((p) => p.id);
export const BATCH2 = PROJECTS.filter((p) => p.batch === 2).map((p) => p.id);
// 修好要一夜：出了钱，第二天 06:00 完工
export const BUILD = { hour: 6 };
// 修在农场上的画在哪（底边中点；只是画出来，不挡路）：钟楼在谷仓屋脊上（原来鸽舍那儿，谁也建不到屋顶上），纪念碑在前哨广场边上
export const FARM_SPOTS = { bell: { x: 776, y: 86 }, monument: { x: 1240, y: 560 } };
// 戏台：唱完以后几天
export const STAGE_DAYS = 3;
// 修好几天后的早上先送来头一批（以后每个时节头一天；正好碰上时节头一天就照时节头一天的送）
export const FIRST_SEND = 3;
// 灯塔的海货：海里的好鱼（随这个时节换一样）
export const CRATE = { fish: ["kinCroaker", "kinHairtail", "kinPomfret", "kinSeabass"], n: 3, salt: 4 };

// 北线通车：每个时节头一天捎来一样外面的东西（按顺序，带完了再从头来）
export const OUTSIDE = [
  { id: "ahCoffee", name: "咖啡豆", type: "food", sell: 30, food: 4, desc: "外面捎来的咖啡豆，磨碎了冲一杯，苦得人直皱眉。" },
  { id: "ahPeach", name: "黄桃罐头", type: "food", sell: 40, food: 18, desc: "南边工厂新封的罐头，标签上印着今年的日子。" },
  { id: "ahYarn", name: "毛线团", type: "resource", sell: 20, desc: "外面纺的毛线，颜色鲜得扎眼。" },
  { id: "ahBikeBell", name: "自行车铃", type: "resource", sell: 15, desc: "一只崭新的车铃，“叮铃”一声，营地的孩子全跑出来了。" },
  { id: "ahRecord", name: "新灌的唱片", type: "resource", sell: 25, desc: "外面的人新灌的唱片，唱的是一首没听过的歌。" },
  { id: "ahOrange", name: "南边的橘子", type: "food", sell: 18, food: 10, desc: "一路从南边运来的橘子，皮还是香的。" },
  { id: "ahPaper", name: "外面的报纸", type: "resource", sell: 5, desc: "外面印的报纸，头版写着：“北线恢复通车”。" },
  { id: "ahChalk", name: "一盒粉笔", type: "resource", sell: 6, desc: "一整盒没用过的粉笔，学校的老师高兴坏了。" },
];
// 地面上的学校：每个时节头一天孩子们寄来的信（信里夹着的东西进仓库）
export const KID_LETTERS = [
  { id: "k1", from: "一年级的小豆", text: "“我画了你们的钟楼，钟比楼还大。老师说不对，我说就是这么大。”", gift: { kinCandy: 2 } },
  { id: "k2", from: "二年级的春妮", text: "“我们在学校门口种了萝卜，是你们给的种子。长得没你们的大，可是我们自己种的。”", gift: { seedRadish: 2 } },
  { id: "k3", from: "大一点的阿川", text: "“今天学了‘余烬’两个字。老师说，余烬就是火灭了以后还热着的那一点。”", gift: { resin: 1 } },
  { id: "k4", from: "全班", text: "“我们排了一出戏，演的是守长夜。谁都不愿意演感染者，最后老师演了。”", gift: { kinCandy: 3 } },
  { id: "k5", from: "小鹿老师", text: "“孩子们问，余烬农场的人怕不怕黑。我说怕，可是他们点着灯。”", gift: { herbTea: 1 } },
  { id: "k6", from: "一年级的小豆", text: "“我会写自己的名字了！还会写你们的。”信纸上歪歪扭扭写着“余烬农场”四个字。", gift: { kinCandy: 2 } },
  { id: "k7", from: "春妮和她妈妈", text: "“萝卜收了，炖了一锅汤，全班一人一碗。妈妈说要谢谢你们。”", gift: { stew: 1 } },
  { id: "k8", from: "全校", text: "“学校要开运动会了。第一名的奖品是你们送的糖，大家跑得可快了。”", gift: { kinCandy: 4 } },
];

// ================= 手记最上面那张“眼下” =================
// 主线打完以后，原来那张“家园计划”（v0.12 的老章节）不再挡在最上面：最上面是眼下最值得做的一件；老章节折在下面。
export const NOW = {
  eyebrow: "眼下",
  night: { title: "今晚 22:00 长夜", text: "把围栏修好、陷阱摆上、弹药备足，让居民守瞭望塔；今天不能一觉睡过去。", go: "看防线" },
  final: { title: "今晚 22:00 最后一夜", short: "今晚最后一夜", text: "扑火的从东边林子里来：塔、陷阱、守卫都摆在东边，仓库里给塔留足子弹，弩和箭备足。", gain: "打赢了，这一夜从此不再来。", go: "看防线" },
  project: { title: (p) => "复兴工程 · " + p.name, text: (p, e) => p.text, go: "去看复兴工程" },
  save: { title: (p) => "攒钱办" + p.name, go: "去看复兴工程" },
  building: { title: (p) => p.name + "明早完工", text: "工人进场了，明天早上 6 点完工；修好了有信来。", go: "去看复兴工程" },
  week: { go: "这周和今天" },
  list: { title: (name) => "重建站 · " + name, go: "去重建站" },
  rest: { title: "今天自己安排", text: "长夜还远，这周的复兴工程也办了：种田、钓鱼、下地铁隧道、找旧物，挑一样。", go: "去看复兴工程" },
  wait2: { title: "收复以后还有第二期", text: (left) => "再守住 " + left + " 个长夜，余烬地区收复；之后复兴工程开第二期：把余烬地区接回外面。" },
  done: { title: "余烬地区复兴了", text: "复兴工程全办完了：长夜还会来，日子照常过。" },
  fold: "家园计划（老章节）",
};

// ================= 奖励随进度放大 =================
// 进度：守住了几个长夜（最多算 10 个）。每日抉择第三段起是 1.5 倍、第六段起 2 倍；主线打完以后每守住一个再多 0.2 倍（最多 4 倍）。
// 这周的清单、季节头目、被困的人给的金币：每守住一个多两成（最多 3 倍）。
export const REWARD = { per: 0.2, cap: 10, dailyBase: 2 };

// ================= 少弹几条提示 =================
// 天天一样的、别处已经说了的：不在提示栏弹，照旧进消息记录（L）。
// float：头顶飘一下（true 就飘原话的前面一截）；after：前几回照常弹，之后才这样；tones：只管这几种语气的。
// 依据：机器人台第 31 天起每天 24.6 条（v0.37 是 22.3），最多的是睡醒的「休息好」、鸡舍自己会喂、乌鸦啄菜、
// 仓库少了干粮（每天各一条），其次是明天的险地、一遍田、电台、今天下午的事、商队收摊。
export const QUIET = [
  { id: "rested", re: /^睡得好：「休息好」/, float: "睡得好" },
  { id: "coop", re: /^鸡舍自己会喂/, float: "鸡舍自己会喂" },
  { id: "crow", re: /^乌鸦啄了 \d+ 块/, after: 3, float: "乌鸦啄了熟菜" },
  { id: "theft", re: /^(仓库又少了|清点仓库：夜里少了)/, after: 3 },
  { id: "field", re: /^这一遍田：/, float: true },
  { id: "hazard", re: /^明天的险地：/ },
  { id: "radio", re: /^电台：/, tones: ["normal"] },
  { id: "noonAm", re: /^今天下午的事 · / },
  { id: "week", re: /^这周的事 · / },
  { id: "caravan", re: /^唐九的商队收摊走了/ },
  { id: "show", re: /^收获展 · / },
  { id: "jar", re: /^腌缸里(腌|酿)上了/, float: true },
  { id: "mush", re: /^捡到 蘑菇 ×\d+：/, float: true },
  { id: "sniff", re: /^顺着气味多翻出：/, float: true },
  { id: "gate", re: /在营门口等到天黑，离开了/ },
];
export const QUIET_IDS = QUIET.map((q) => q.id);

// ================= 页面上的字 =================
export const PAGE = {
  title: "复兴工程",
  sub: "出钱请人把余烬地区的老地方修起来",
  intro: "第二年起每个时节头一天开一处。出了钱，第二天早上 6 点完工；修好的地方来一封信、留给你一样摆件，三天后送来头一批那里的特产，以后每个时节头一天再送。只给方便和花样，不给战力。",
  batch2: "第二期 · 把余烬地区接回外面",
  wait2: "收复余烬地区（守住第 10 个长夜）以后开：每个时节头一天一处。",
  next: (day, name) => "下一处第 " + day + " 天开" + (name ? "：" + name : ""),
  far: "回到农场再办",
  go: "出钱办",
  building: "工人进场了，明早 6 点完工",
  letters: "复兴工程的来信",
  kids: "孩子们的信",
};
export const SAY = {
  open: (p) => "复兴工程开了一处：" + p.name + "（" + p.cost.gold.toLocaleString("en-US") + " 金）",
  paid: (p) => "出了钱：" + p.name + "明早 6 点完工",
  done: (p) => p.name + "修好了",
  sent: (t) => "复兴工程送来：" + t + "（已入仓）",
  clue: (name, where) => "修复工坊：「" + name + "」在" + where + "（档案馆那一页也写着）",
  radio: (p) => (p.id === "train" ? "余烬地区收复了，复兴工程开了第二期“把余烬地区接回外面”，头一处：" + p.name : "复兴工程这个时节开了一处：" + p.name),
};
export const INTRO_LINES = [
  "钱有处花了：第二年起每个时节头一天，复兴工程开一处——出钱请人把余烬地区的老地方修起来（溪谷的水车、旧站商街的老茶馆、雨巷的澡堂……）。",
  "修好的地方来一封信、留一样摆件，三天后送来头一批特产，以后每个时节头一天再送；收复余烬地区以后开第二期。",
  "主线打完以后，任务手记最上面是“眼下”最值得做的一件；每日抉择、这周的事的回报随守住的长夜变大。",
];

// ================= 物品 =================
const put = (id, def) => {
  if (!ITEMS[id]) ITEMS[id] = def;
};
for (const p of PROJECTS) {
  const s = p.special;
  if (s) put(s.id, { name: s.name, type: s.type, sell: s.sell, ...(s.food ? { food: s.food } : {}), ahead: p.id, desc: s.desc + "（" + placeName(p) + "的特产）" });
}
for (const o of OUTSIDE) put(o.id, { name: o.name, type: o.type, sell: o.sell, ...(o.food ? { food: o.food } : {}), ahead: "train", desc: o.desc + "（北线火车从外面捎来的）" });
function placeName(p) {
  return { valley: "溪谷", stationMarket: "旧站商街", courtyard: "雨巷", pinewood: "雾松林场", quarantine: "检疫科研园", shelter: "地底避难城", railDepot: "北线货运站", shipyard: "沉湾船坞", hospital: "旧医院", frost: "白霜气象站", farm: "农场", market: "集市" }[p.place] || "那边";
}
// 修好以后留下的摆件：和过路人留下的一样，摆在屋里屋外都算一种（只进 DECOR_BY_ID，柜子里翻不到）
for (const p of PROJECTS) {
  const k = p.keep;
  DECOR_BY_ID[k.id] ??= { id: k.id, name: k.name, where: [], desc: k.desc, ahead: p.id };
  put(decorItem(k.id), { name: k.name, type: "resource", sell: 6, decor: k.id, desc: k.desc + "（摆件：在建造里选“摆件”摆出来）" });
}
export const KEEP_IDS = PROJECTS.map((p) => p.keep.id);

// ================= 大事卡片：复兴 =================
Object.assign(MOMENT_KINDS, { ahead: { label: "复兴", color: "#a8d89a" } });
Object.assign(MOMENT_SOUND, { ahead: { stinger: "actDone", ui: true } });

// ================= 小图（16×16） =================
const A = PAL.ash,
  So = PAL.soil,
  E = PAL.ember,
  St = PAL.straw,
  L = PAL.leaf,
  W = PAL.water,
  Sn = PAL.snow,
  Ro = PAL.stone,
  Ru = PAL.rust,
  Cl = PAL.cloth;
const KEEP_DRAW = {
  ahWheelModel: (P) => {
    P.disc(8, 8, 5.5, So[3]);
    P.disc(8, 8, 3.5, So[1]);
    for (const [x, y] of [[8, 2], [14, 8], [8, 14], [2, 8], [12, 4], [4, 12], [12, 12], [4, 4]]) P.line(8, 8, x, y, So[4]);
    P.disc(8, 8, 1.2, Ro[4]);
    P.hline(1, 14, 15, W[3]);
  },
  ahTeaPot: (P) => {
    P.rect(4, 6, 8, 7, Ru[3]);
    P.rect(5, 5, 6, 1, Ru[2]);
    P.rect(7, 3, 2, 2, Ru[2]);
    P.line(12, 8, 15, 5, Ru[3]);
    P.line(3, 7, 2, 11, Ru[2]);
    P.hline(4, 11, 9, E[4]);
  },
  ahBathSign: (P) => {
    P.rect(2, 4, 12, 8, So[3]);
    P.rect(3, 5, 10, 6, So[4]);
    for (let x = 4; x < 12; x += 3) P.rect(x, 6, 2, 4, A[1]);
    P.line(4, 4, 8, 1, A[2]);
    P.line(12, 4, 8, 1, A[2]);
  },
  ahPineLamp: (P) => {
    P.rect(5, 6, 6, 7, St[1]);
    P.rect(6, 7, 4, 5, E[4]);
    P.rect(4, 13, 8, 2, So[2]);
    P.rect(7, 3, 2, 3, A[2]);
    P.set(8, 9, E[5]);
  },
  ahSeedTray: (P) => {
    P.rect(1, 7, 14, 7, So[2]);
    for (let x = 2; x < 14; x += 3) {
      P.rect(x, 8, 2, 5, So[1]);
      P.set(x, 6, L[4]);
      P.set(x + 1, 5, L[3]);
    }
  },
  ahThimble: (P) => {
    P.rect(5, 6, 6, 7, St[2]);
    P.rect(6, 4, 4, 2, St[2]);
    for (let y = 6; y < 13; y += 2) for (let x = 6; x < 11; x += 2) P.set(x, y, St[0]);
    P.hline(5, 10, 13, St[3]);
  },
  ahWhistle: (P) => {
    P.rect(3, 7, 9, 4, St[2]);
    P.disc(11, 9, 2.5, St[2]);
    P.rect(5, 8, 2, 1, A[1]);
    P.line(2, 9, 0, 6, Cl[1]);
    P.set(11, 9, St[4]);
  },
  ahNetFloat: (P) => {
    P.disc(8, 8, 5, Sn[4]);
    P.rect(3, 6, 11, 4, Cl[1]);
    P.vline(8, 1, 3, A[2]);
    P.vline(8, 13, 15, A[2]);
  },
  ahMortar: (P) => {
    P.poly([[2, 9], [14, 9], [12, 14], [4, 14]], Ro[2]);
    P.hline(2, 13, 9, Ro[4]);
    P.disc(8, 7, 3, Ro[3]);
    P.line(4, 7, 12, 7, Ro[1]);
    P.set(6, 11, L[3]);
  },
  ahWindCup: (P) => {
    P.vline(8, 6, 15, Ro[3]);
    P.line(8, 6, 2, 4, Ro[3]);
    P.line(8, 6, 14, 4, Ro[3]);
    P.line(8, 6, 8, 1, Ro[3]);
    P.disc(2, 4, 1.6, Sn[3]);
    P.disc(14, 4, 1.6, Sn[3]);
    P.disc(8, 1.5, 1.4, Sn[3]);
  },
  ahMagnifier: (P) => {
    P.disc(6, 6, 4.5, Ro[3]);
    P.disc(6, 6, 3, W[4]);
    P.set(5, 5, Sn[4]);
    P.line(9, 9, 14, 14, So[2]);
    P.rect(11, 11, 2, 2, Sn[3]);
  },
  ahBellRibbon: (P) => {
    P.poly([[5, 3], [11, 3], [13, 11], [3, 11]], St[1]);
    P.rect(7, 1, 2, 2, St[1]);
    P.disc(8, 12, 1.5, St[0]);
    P.line(12, 6, 15, 14, Cl[1]);
    P.line(13, 6, 14, 14, Cl[2]);
  },
  ahTicket: (P) => {
    P.rect(1, 4, 14, 8, St[4]);
    P.vline(10, 4, 11, St[1]);
    P.hline(2, 8, 6, A[2]);
    P.hline(2, 7, 8, A[2]);
    P.disc(12.5, 8, 1.6, Cl[1]);
  },
  ahSchoolBell: (P) => {
    P.poly([[5, 4], [11, 4], [13, 12], [3, 12]], St[2]);
    P.rect(7, 2, 2, 2, So[2]);
    P.disc(8, 13, 1.4, St[0]);
    P.hline(3, 12, 12, St[3]);
  },
  ahLens: (P) => {
    P.poly([[8, 1], [14, 8], [8, 15], [2, 8]], W[5]);
    P.poly([[8, 4], [11, 8], [8, 12], [5, 8]], Sn[4]);
    P.set(6, 6, E[5]);
    P.set(10, 10, L[5]);
  },
  ahMask: (P) => {
    P.disc(8, 8, 6, Cl[1]);
    P.rect(4, 6, 3, 2, A[1]);
    P.rect(9, 6, 3, 2, A[1]);
    P.rect(7, 3, 2, 8, St[4]);
    P.hline(5, 10, 12, A[1]);
  },
  ahMilestone: (P) => {
    P.rect(4, 4, 8, 11, Ro[3]);
    P.rect(5, 3, 6, 1, Ro[3]);
    P.rect(5, 6, 6, 3, Cl[1]);
    P.hline(5, 10, 11, Ro[1]);
    P.hline(3, 12, 15, So[2]);
  },
  ahRubbing: (P) => {
    P.rect(2, 2, 12, 12, Sn[4]);
    for (let y = 4; y < 13; y += 2) P.hline(4, 11, y, A[2]);
    P.rect(4, 3, 8, 1, A[1]);
  },
};
const ITEM_DRAW = {
  ahLotus: (P) => {
    P.rect(2, 6, 4, 6, St[4]);
    P.rect(6, 7, 4, 5, St[4]);
    P.rect(10, 6, 4, 6, St[4]);
    P.vline(6, 7, 11, St[2]);
    P.vline(10, 7, 11, St[2]);
    P.set(4, 9, So[3]);
    P.set(12, 8, So[3]);
  },
  ahOsmanthus: (P) => {
    P.rect(3, 6, 10, 6, St[3]);
    P.rect(3, 6, 10, 2, St[4]);
    for (const [x, y] of [[5, 9], [8, 10], [11, 9], [6, 11]]) P.set(x, y, E[4]);
  },
  ahSoap: (P) => {
    P.rect(3, 6, 10, 6, L[4]);
    P.rect(4, 7, 8, 4, L[5]);
    P.disc(13, 4, 1.4, Sn[4]);
    P.disc(11, 3, 1, Sn[4]);
  },
  ahPineNut: (P) => {
    for (const [x, y] of [[4, 7], [8, 5], [11, 8], [6, 11], [10, 12]]) {
      P.disc(x, y, 1.8, So[2]);
      P.set(x, y - 1, So[4]);
    }
  },
  ahMint: (P) => {
    P.vline(8, 4, 14, L[2]);
    for (const [x, y] of [[5, 6], [11, 6], [5, 10], [11, 10]]) P.disc(x, y, 2.2, L[4]);
    P.disc(8, 3, 1.8, L[5]);
  },
  ahGloves: (P) => {
    P.rect(2, 6, 5, 8, Cl[4]);
    P.rect(9, 6, 5, 8, Cl[4]);
    for (const x of [2, 4, 9, 11]) P.rect(x, 3, 1, 3, Cl[4]);
    P.hline(2, 6, 13, Cl[3]);
    P.hline(9, 13, 13, Cl[3]);
  },
  ahSoda: (P) => {
    P.rect(6, 5, 4, 10, W[3]);
    P.rect(7, 2, 2, 3, W[3]);
    P.rect(7, 1, 2, 1, Ru[3]);
    P.rect(6, 8, 4, 3, Cl[1]);
    P.set(7, 12, Sn[4]);
  },
  ahDriedFish: (P) => {
    P.poly([[2, 8], [10, 4], [13, 8], [10, 12]], St[1]);
    P.poly([[13, 8], [15, 5], [15, 11]], St[1]);
    P.set(9, 7, A[1]);
    for (let x = 4; x < 10; x += 2) P.set(x, 9, St[3]);
  },
  ahLicorice: (P) => {
    for (const [x, y] of [[5, 6], [10, 7], [7, 11]]) {
      P.disc(x, y, 2.6, St[2]);
      P.disc(x, y, 1.2, St[4]);
    }
  },
  ahRockSugar: (P) => {
    P.poly([[3, 9], [6, 5], [9, 8], [7, 12]], Sn[4]);
    P.poly([[8, 6], [12, 4], [14, 9], [10, 11]], Sn[3]);
    P.set(6, 7, Sn[4]);
  },
  ahStamp: (P) => {
    P.rect(3, 3, 10, 10, Sn[4]);
    for (let k = 3; k <= 12; k += 2) {
      P.set(k, 2, Sn[4]);
      P.set(k, 13, Sn[4]);
    }
    P.rect(5, 5, 6, 6, Cl[1]);
    P.set(8, 8, St[4]);
  },
  ahCoffee: (P) => {
    for (const [x, y] of [[5, 6], [10, 6], [7, 10], [11, 11], [4, 11]]) {
      P.disc(x, y, 2, So[1]);
      P.line(x - 1, y - 1, x + 1, y + 1, A[1]);
    }
  },
  ahPeach: (P) => {
    P.rect(4, 4, 8, 10, Ro[4]);
    P.rect(4, 7, 8, 4, E[4]);
    P.disc(8, 9, 1.6, E[3]);
    P.hline(4, 11, 4, Ro[3]);
  },
  ahYarn: (P) => {
    P.disc(8, 9, 5, Cl[2]);
    P.line(4, 7, 12, 11, Cl[1]);
    P.line(5, 12, 11, 6, Cl[1]);
    P.line(12, 13, 15, 15, Cl[2]);
  },
  ahBikeBell: (P) => {
    P.disc(8, 8, 5, Ro[4]);
    P.disc(8, 8, 3, Sn[4]);
    P.rect(7, 13, 2, 2, Ro[2]);
    P.line(12, 6, 15, 4, Ro[2]);
  },
  ahRecord: (P) => {
    P.disc(8, 8, 6, A[1]);
    P.disc(8, 8, 2, Cl[1]);
    P.set(8, 8, A[0]);
    P.line(4, 4, 6, 6, A[3]);
  },
  ahOrange: (P) => {
    P.disc(8, 9, 5, E[3]);
    P.disc(7, 8, 2, E[4]);
    P.rect(8, 3, 1, 2, So[2]);
    P.rect(9, 3, 3, 1, L[4]);
  },
  ahPaper: (P) => {
    P.rect(2, 3, 12, 10, Sn[3]);
    P.rect(3, 4, 10, 2, A[2]);
    for (let y = 7; y < 12; y += 2) P.hline(3, 12, y, Ro[2]);
  },
  ahChalk: (P) => {
    P.rect(2, 6, 12, 6, So[3]);
    for (let x = 3; x < 13; x += 2) P.rect(x, 4, 1, 6, Sn[4]);
    P.rect(2, 9, 12, 3, So[2]);
  },
};
for (const [id, f] of Object.entries(KEEP_DRAW)) {
  DECOR_DRAW[id] ??= f;
  ICON_DRAW[decorItem(id)] ??= f;
}
for (const [id, f] of Object.entries(ITEM_DRAW)) ICON_DRAW[id] ??= f;
