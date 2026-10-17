// v0.33.0「盼头」的数据：钱的去处（墙升二级、营地扩建、每周的稀罕货）、每周一件“这周的事”、每天下午的限时事。
// 依据：《爽点与耐玩体检方案》第 2、3、9 条（体检时第 120 天手上 31 万金币、商店最贵 62；第 11 周起每周不到 4 样新东西；
// 8–13% 的日子一件大好事也没有，最长 15–25 分钟一件也没有）。买到的东西只给方便和花样，不给战力，夜里不会因为它们变容易。
import { ITEMS } from "./data.js";
import { PAL } from "./pixel-kit.js";
import { DRAW as ICON_DRAW } from "./item-sprites.js";
import { DECOR_BY_ID, DECOR_DRAW, decorItem } from "./almanac-data.js";
import { NPCS } from "./outpost-data.js";
import { MOMENT_KINDS } from "./zest-data.js";
import { MOMENT_SOUND, STINGERS } from "./audio-data.js";

export const HOPE_SCHEMA = 1;

// 什么时候开始：这周的事从第二年（第 29 天）起；下午的事第 8 天起；旧站商街的稀罕货第 32 天（第二年第一周的第 4 天）起
export const START = { weekly: 29, noon: 8, good: 32 };

// ================= 墙升二级（重建站那一页，交满的墙下面） =================
export const WALL2 = {
  water: { name: "二级水网", text: "旧水厂的主管也接通了：水网每天再多 10 份水（一共多 20 份）。", cost: { gold: 8000, scrap: 10, parts: 4 } },
  clinic: { name: "二级诊所", text: "诊所添了两张床和一个药柜：受伤的人再少躺一天（最少躺半天）。", cost: { gold: 8000, cloth: 6, herb: 10 } },
  school: { name: "二级学堂", text: "学堂开了夜课：带徒、改学职能再快一天（最快第二天早上就学会）。", cost: { gold: 8000, wood: 20, cloth: 4 } },
  radio: { name: "二级电台", text: "天线架高了：早间广播多说一句——今天哪片废墟的哪种柜子里有好东西。", cost: { gold: 10000, rlCopper: 6, circuit: 2 } },
  power: { name: "二级电网", text: "田边拉了补光灯：夜里（20:00–06:00）田里的菜长得快两成五，农场的路灯也多了几盏。", cost: { gold: 12000, rlBulb: 6, rlCopper: 6 } },
  rail: { name: "二级铁路", text: "轨道车修到了各个地区：去哪儿的路都再省四分之一。", cost: { gold: 12000, rlSpike: 10, parts: 6 } },
};
export const WALL2_FX = { water: 10, injury: 1440, injuryMin: 720, school: 1, power: 1.25, powerFrom: 20 * 60, powerTo: 6 * 60, rail: 0.75 };

// ================= 营地扩建（农舍「房间与家具」那一页） =================
export const EXPAND = {
  home: [
    { name: "东厢房", text: "农舍东头加盖一间厢房：多一张床位，你睡的那间舒适度 +1。", cost: { gold: 6000, wood: 30, stone: 10 } },
    { name: "二楼", text: "农舍加了二楼：睡醒的「休息好」多 1 个钟点，你睡的那间舒适度再 +1。", cost: { gold: 14000, wood: 40, stone: 20, parts: 6 } },
  ],
  store: [
    { name: "分拣棚", text: "谷仓边搭了分拣棚，菜分好等级再卖：出货箱里的菜、鱼、蛋奶、做好的吃的卖价多一成。", cost: { gold: 5000, wood: 20, scrap: 6 } },
    { name: "冷库", text: "谷仓另一头砌了冷库，菜放得住、卖得上价：卖价再多一成（一共多两成）。", cost: { gold: 12000, stone: 20, parts: 6, circuit: 2 } },
  ],
  coop: [
    { name: "大鸡舍", text: "鸡舍扩成两间：每次多收 2 个鸡蛋。", cost: { gold: 5000, wood: 20, stone: 6 } },
    { name: "羊圈", text: "加一圈羊栏，又牵来一只山羊：每次多 1 份羊奶。", cost: { gold: 10000, wood: 24, stone: 8 } },
  ],
};
export const EXPAND_IDS = Object.keys(EXPAND);
export const EXPAND_NAMES = { home: "农舍", store: "仓库", coop: "鸡舍" };
export const EXPAND_FX = { bed: 1, comfort: 1, rest: 60, sell: 0.1, egg: 2, milk: 1 };

// ================= 稀罕货（旧站商街每周一样；唐九的商队那一周多两样） =================
// kind：tool 工具（买了立刻换上）、device 家当（摆在农场上）、book 账本（看得到更多）、pack 一包东西（能再买）
export const GOODS = {
  can: { name: "大号浇水壶", price: 3000, kind: "tool", text: "壶边挂一只 24 格的备用水箱（24 → 48）：壶里的水用完自动续上，补水时一起补满，一遍田少跑一趟水井。" },
  hoe: { name: "铜皮锄头", price: 3500, kind: "tool", text: "开垦、清理不费体力；清理碎石木头时多拿一份。" },
  rod: { name: "碳素钓竿", price: 4500, kind: "tool", text: "鱼咬钩快四成，收线时线绷得慢四分之一。" },
  bait: { name: "鱼饵罐", price: 3500, kind: "tool", text: "罐子里养着鱼饵：每次抛竿都算挂了饵（不用再拿菜青虫）。" },
  seedbox: { name: "种子柜", price: 4000, kind: "device", text: "自己收菜时，四分之一的机会多留一颗这种菜的种子。" },
  ledger: { name: "货郎的账本", price: 4000, kind: "book", repeat: true, text: "账本里记着三件还没找到的旧物叫什么、在哪片废墟的哪种柜子里（档案馆那一页写着）。" },
  goldSeeds: { name: "金穗种子包", price: 3000, kind: "pack", repeat: true, text: "一包 6 颗杂交品种的种子：回暖、秋收是金萝卜，酷暑是夜光豆，寒潮是冬土豆。" },
  composter: { name: "堆肥机", price: 6000, kind: "device", text: "堆肥桶一次沤出两袋肥。" },
  cellar: { name: "腌菜地窖", price: 7000, kind: "device", text: "腌缸、土酒坛都早一天好（陈的也早一天）。" },
  hive: { name: "养蜂箱", price: 8000, kind: "device", text: "田边三只蜂箱：每天早上一罐蜂蜜，回暖、酷暑两罐。" },
  boiler: { name: "太阳能热水器", price: 8000, kind: "device", text: "睡醒洗个热水澡：「休息好」多 2 个钟点。" },
  gramophone: { name: "留声机", price: 7000, kind: "device", text: "节庆那天在广场放唱片：供品的评语高一档。" },
  hotbed: { name: "温床", price: 9000, kind: "device", text: "田边铺了温床：反季的菜不再长得慢。" },
  dove: { name: "鸽舍", price: 9000, kind: "device", text: "屋顶养了一群鸽子：每三天捎回一封远处的信，信里夹着点东西。" },
  mill: { name: "风车", price: 14000, kind: "device", text: "农场西边立起风车抽地下水：水网每天多 12 份水。" },
  kennel: { name: "麦穗的新窝", price: 4000, kind: "device", need: "dog", text: "麦穗睡得好：早上叼东西回来的机会多一成五。" },
  incubator: { name: "孵蛋箱", price: 6000, kind: "device", need: "coop", text: "鸡舍里孵出几只小鸡：每次多收 1 个鸡蛋。" },
  tractor: { name: "修好的拖拉机", price: 18000, kind: "device", text: "每天早上 06:00 拖拉机把田里的杂草、碎石清掉，空田翻好。" },
};
export const GOOD_IDS = Object.keys(GOODS);
export const goodItem = (id) => "hpGood_" + id;
// 旧站商街每周换一样（第 32 天起，每个时节的第 4 天换）；买过的独一份不再出，没买的排到后面再来
export const MARKET_ORDER = ["can", "hive", "dove", "seedbox", "rod", "composter", "mill", "ledger", "boiler", "hotbed", "goldSeeds", "cellar", "tractor", "bait", "ledger", "goldSeeds"];
// 唐九的商队那一周带的两样
export const CARAVAN_ORDER = [
  ["hoe", "kennel"],
  ["incubator", "gramophone"],
  ["bait", "goldSeeds"],
  ["ledger", "cellar"],
  ["goldSeeds", "ledger"],
];
// clue：账本记下的旧物，在它那片废墟、那种柜子里多一成二的机会翻到
export const GOOD_FX = { can: 24, rodBite: 0.6, rodRamp: 0.75, seedbox: 0.25, compost: 2, cellar: 1, hive: 1, hiveWarm: 2, boiler: 120, mill: 12, kennel: 0.15, incubator: 1, ledger: 3, goldSeeds: 6, clue: 0.12 };
export const GOLD_SEED = { thaw: "seedGoldRadish", heat: "seedGlowBean", harvest: "seedGoldRadish", cold: "seedWinterPotato" };

// ================= 这周的事（每周一件，四样轮着来；周一早间广播预告） =================
export const WEEK_KINDS = ["traveler", "list", "caravan", "boss"];
export const WEEK_NAMES = { traveler: "过路人", list: "这周的清单", caravan: "唐九的商队", boss: "季节头目" };
// 每年换个顺序：同一样事不会年年落在同一个时节
export const weekKind = (day) => {
  const w = Math.floor((Math.max(1, day) - 1) / 7),
    year = Math.floor(w / 4);
  return WEEK_KINDS[(w + year) % 4];
};
export const weekIndex = (day) => Math.floor((Math.max(1, day) - 1) / 7);

// 过路人：第 1 天 09:00 到营门口，待到第 4 天 20:00；带来他要的东西，他留下一件摆件
// 营门口东头、河边（离广场、电台、出口都隔开，按 E 不会选错）
export const TRAVEL = { spot: { x: 1395, y: 255 }, arrive: 9 * 60, stay: 4, leave: 20 * 60 };
export const TRAVELERS = {
  hpWu: {
    name: "修钟的吴师傅",
    look: { skin: "#d9ad86", hair: "#9a9a90", coat: "#5a5446", accent: "#c8b06a", extra: "glasses" },
    story: ["“我从北边一路修过来。哪个营地墙上挂着一只走着的钟，大家就觉得日子还在往前走。”", "“我女儿的修表铺原来就在旧站商街，门面早没了。我想在她的铺子边上，修好一只钟。”"],
    ask: [["scrap", 4], ["parts", 1]],
    gift: "hpWuClock",
    done: "“走起来了。你听，嘀嗒嘀嗒——跟当年一个声儿。”他把那只小座钟塞给你，又背起工具箱往南走了。",
    bye: "吴师傅等不到零件，往南去了。走之前把营门口的那块破表修好了。",
  },
  hpMan: {
    name: "背着琴的小满",
    look: { skin: "#f0caa6", hair: "#4a2a1e", coat: "#7d5a6c", accent: "#e8c0c8", extra: "scarf" },
    story: ["“我在每个营地弹一首歌，换一口热的。弹完就走，不欠谁的。”", "“我妈说，人饿着的时候最想听的不是饭，是有人叫他的名字。所以我的歌里全是名字。”"],
    ask: [["stew", 1]],
    gift: "hpManHarmonica",
    done: "她捧着热汤喝完，在营火边弹了一首，把营地里每个人的名字都唱了一遍。临走把一只旧口琴留给你：“下回换你吹。”",
    bye: "小满在营门口弹完一首就走了，歌里有你们营地的名字。",
  },
  hpYa: {
    name: "卖种子的哑叔",
    look: { skin: "#b98762", hair: "#2e2e2e", coat: "#5a6a3a", accent: "#d7b66a", extra: "hat" },
    story: ["他不说话，只把一张纸递过来：“我用种子换吃的。土豆最好。”", "纸背面画着一片田，田边一个小人，旁边写着“我家的”。"],
    ask: [["potato", 6]],
    gift: "hpYaSeedJar",
    done: "哑叔收下土豆，咧嘴笑了，从背篓里掏出一只装满种子的陶罐，又在你手心里画了个圈——意思是：明年还来。",
    bye: "哑叔在营门口等了三天，背着背篓走了，地上留下一小撮种子。",
  },
  hpTuan: {
    name: "找狗的阿团",
    look: { skin: "#e3b48c", hair: "#3b2a20", coat: "#c9894a", accent: "#e0d090" },
    story: ["“你们见过一只黄狗吗？左耳朵是黑的，叫豆豆。”", "“我一路问过来了。它要是还活着，肯定在找有饭吃的地方。”"],
    ask: [["bread", 2], ["bandage", 1]],
    gift: "hpTuanDog",
    done: "阿团把干粮和绷带塞进包里，又摸了摸麦穗的头：“它跟豆豆一样，耳朵会动。”他留下一只木雕小狗，说找到豆豆就回来要。",
    bye: "阿团没等到，往东边去了。他说要是看见一只左耳朵黑的黄狗，喊它“豆豆”。",
  },
  hpYou: {
    name: "送信的老邮",
    look: { skin: "#c99572", hair: "#1f1d1c", coat: "#3e5a4c", accent: "#a8c47a", extra: "hat" },
    story: ["“我还在送信。地址都没了，我就记人：谁住哪个营地，谁在等谁的信。”", "“路上饿了就钓鱼。这一带的河我都钓过，就是钓不着大的。”"],
    ask: [["@fish", 3]],
    gift: "hpYouBag",
    done: "老邮把鱼挂在邮包外面，笑得像个孩子。他把一只旧邮包送给你：“你这儿也算一个邮局了，有信我往这儿送。”",
    bye: "老邮在营门口留了一张字条：信送到了下一个营地，回头再来。",
  },
  hpLan: {
    name: "拍照的林岚",
    look: { skin: "#f0caa6", hair: "#1f1d1c", coat: "#4f6650", accent: "#e8e4dc", extra: "goggles" },
    story: ["“我在给还活着的营地拍照，一处一张。以后有人想知道我们怎么过来的，就看照片。”", "“相纸不多了。给我一罐番茄，我给你们拍一张大合影。”"],
    ask: [["jam", 1]],
    gift: "hpLanPhoto",
    done: "林岚让大家挤在农舍门口，数到三按下快门。第二天早上，一张合影钉在了你的门上。",
    bye: "林岚走的时候拍了一张营门口的空景，说下回来补一张有人的。",
  },
};
export const TRAVELER_IDS = Object.keys(TRAVELERS);

// 这周的清单：在重建站那一页最上面，第 1 天 06:00 贴上，第 6 天 22:00 收走
export const WEEK_LISTS = {
  hpL_quilt: { name: "冬衣募捐", need: [["cotton", 6], ["cloth", 2]], reward: { gold: 300 }, decor: "hpQuilt", hint: "雨巷那边的人冬天缺被子：棉花在田里种，布在制作台做或者商队买。" },
  hpL_window: { name: "学堂的窗", need: [["wood", 10], ["scrap", 4], ["stone", 6]], reward: { gold: 300 }, decor: "hpDrawing", hint: "学堂的窗框烂了，孩子们冻得写不了字。" },
  hpL_feast: { name: "河边的宴席", need: [["@fish", 3], ["tomato", 4], ["bread", 2]], reward: { gold: 350 }, decor: "hpTablecloth", hint: "溪谷那边要办一场宴席，谢谢修水闸的人。鱼什么样的都行。" },
  hpL_seeds: { name: "邻居的种子会", need: [["seedRadish", 3], ["seedBean", 3], ["seedCorn", 3]], reward: { gold: 250 }, decor: "hpSeedWall", hint: "几个营地凑种子换着种，谁家缺什么拿什么。" },
  hpL_swing: { name: "广场的秋千", need: [["wood", 8], ["cloth", 3], ["scrap", 2]], reward: { gold: 300 }, decor: "hpSwing", hint: "孩子们想要一架秋千。绳子用布搓，架子用木头。" },
  hpL_lamps: { name: "灯会的纸灯", need: [["cloth", 2], ["scrap", 3], ["herb", 2]], reward: { gold: 300 }, decor: "hpPaperLamp", hint: "灯火夜要扎一串纸灯，药草熬的浆糊最粘。" },
};
export const WEEK_LIST_IDS = Object.keys(WEEK_LISTS);
export const WEEK_LIST_TIME = { open: 6 * 60, closeDay: 6, close: 22 * 60 };

// 唐九的商队那一周：第 2 天 08:00 到，待到第 3 天 20:00；带两样稀罕货，再收一样菜（两倍价，最多 20 份）
export const CARAVAN_WEEK = { arriveSd: 2, leaveSd: 3, buy: ["pumpkin", "cotton", "tomato", "corn", "potato"], mult: 2, max: 20 };

// 季节头目：第 2–6 天在一张野外的图上；打赢给战利品（第一次）、金币和一包好东西
export const SEASON_BOSSES = {
  thaw: { name: "泥塘里的胖大块头", type: "brute", region: "valley", lair: { x: 980, y: 560 }, trophy: "hpTrophyMud", hp: 1.12, gold: 400, line: "开春化冻，溪谷的泥塘里爬出一只裹着泥壳的大块头，见了人就扔泥块。" },
  heat: { name: "热浪里的护士长", type: "nurse", region: "railDepot", lair: { x: 940, y: 520 }, trophy: "hpTrophyHeat", hp: 1.12, gold: 400, line: "北线货运站的站台上，一个护士长在热浪里来回走，尖叫声能传半里地。" },
  harvest: { name: "麦垛后面的大块头", type: "brute", region: "courtyard", lair: { x: 900, y: 600 }, trophy: "hpTrophyStraw", hp: 1.12, gold: 400, line: "秋收时节，雨巷住区的麦垛后面蹲着一只大块头，身上插满了麦秆。" },
  cold: { name: "冻壳护士长", type: "nurse", region: "frost", lair: { x: 900, y: 540 }, trophy: "hpTrophyIce", hp: 1.12, gold: 400, line: "寒潮里，白霜气象站外面游荡着一个结了冰壳的护士长，走过的地方都是霜。" },
};
// 那张图还没去过：换成废弃居民区（头目不在的那几天）
export const BOSS_FALLBACK = { region: "residential", lair: { x: 1180, y: 300 } };
export const BOSS_DAYS = [2, 6];

// ================= 下午的事（第 8 天起；长夜那天只有农场里的货郎、营门口收购、水渠鱼汛；14:00 开始，18:00 结束，货郎待到 19:00） =================
export const NOON = { start: 14 * 60, end: 18 * 60, peddlerEnd: 19 * 60, lateGuards: 16 * 60 };
export const NOON_KINDS = [
  ["drop", 25],
  ["peddler", 20],
  ["buyer", 15],
  ["shoal", 15],
  ["survivor", 15],
  ["truck", 10],
];
export const NOON_NAMES = { drop: "空投", peddler: "货郎", buyer: "限时收购", shoal: "鱼汛", survivor: "被困的人", truck: "翻倒的物资车" };
// 空投、被困的人：去过的、有感染者的图；物资车：地区和远方的图
export const NOON_REGIONS = {
  drop: ["residential", "hospital", "warehouse", "courtyard", "quarantine", "railDepot", "shipyard", "shelter", "archive"],
  survivor: ["residential", "hospital", "warehouse", "courtyard", "quarantine", "railDepot", "shipyard"],
  truck: ["courtyard", "quarantine", "railDepot", "shipyard", "pinewood", "frost", "valley", "archive"],
};
// 空投箱里另外一样（第一次见是新东西）
export const DROP_GOODS = ["hpRation", "hpPills", "hpMatches", "hpBiscuit"];
export const DROP = { guards: 4, precious: 0.25 };
// 货郎：在营门口那条路南边、河边的空地上（离通信站、广场、营门口等人的地方都隔开），一样卖钱的、一样换东西的
export const PEDDLER_SPOT = { x: 1390, y: 520 };
export const PEDDLERS = {
  mei: { name: "种子贩子阿梅", look: 2, sell: { item: "seedMystery", n: 3, price: 600 }, swap: { give: [["radish", 5]], get: { seedGoldRadish: 4 } }, line: "“种子要趁新鲜种，我这儿的都是今年的。”" },
  qian: { name: "收旧货的老钱", look: 0, sell: { decor: true, price: 900 }, swap: { give: [["potato", 4]], get: { fertCare: 3 } }, line: "“旧东西我都收，也都卖。你看这个，摆屋里多好看。”" },
  liu: { name: "修车的大刘", look: 3, sell: { item: "repairKit", n: 2, price: 500 }, swap: { give: [["scrap", 3], ["corn", 2]], get: { parts: 2 } }, line: "“我的车坏在半路，修好了就走。零件嘛，换着用。”" },
  po: { name: "草药婆婆", look: 1, sell: { item: "herbTea", n: 2, price: 400 }, swap: { give: [["herb", 4]], get: { kinTea: 1 } }, line: "“草药晒干了才有劲。你们田里的药草，晒得不对。”" },
  yan: { name: "旧书摊的眼镜叔", look: 0, sell: { clue: 1, price: 1500 }, swap: { give: [["jam", 2]], get: { keepsake: 1 } }, line: "“书里夹着的东西，比书还值钱。你要找什么，我帮你翻翻。”" },
  tang: { name: "卖糖的小贩", look: 2, sell: { item: "kinCandy", n: 5, price: 300 }, swap: { give: [["egg", 3]], get: { kinCandy: 6, alBerry: 4 } }, line: "“糖不当饭吃，可是孩子们一看见就笑。”" },
  zhou: { name: "磨刀的老周", look: 3, sell: { item: "fertGrow", n: 3, price: 450 }, swap: { give: [["scrap", 4]], get: { repairKit: 1 } }, line: "“刀不磨要锈，人不走要僵。”" },
  lu: { name: "放羊的鲁大姐", look: 1, sell: { item: "wool", n: 4, price: 300 }, swap: { give: [["corn", 4]], get: { milk: 2 } }, line: "“羊吃饱了才长毛。玉米换羊奶，公道。”" },
  bai: { name: "走街的白大夫", look: 0, sell: { item: "fertWater", n: 3, price: 450 }, swap: { give: [["herb", 3], ["cloth", 1]], get: { herbTea: 2 } }, line: "“病去如抽丝，草药茶天天喝。”" },
  jin: { name: "收鱼的金老板", look: 2, sell: { item: "kinHooks", n: 1, price: 700 }, swap: { give: [["@fish", 4]], get: { salt: 4, kinCandy: 2 } }, line: "“鱼要趁鲜。我这儿的钩子，都是老手用过的。”" },
  tong: { name: "补锅的童师傅", look: 3, sell: { decor: true, price: 1100 }, swap: { give: [["stone", 10]], get: { repairKit: 2 } }, line: "“锅漏了补锅，日子漏了补日子。”" },
  xu: { name: "说书的徐先生", look: 0, sell: { clue: 1, price: 1800 }, swap: { give: [["herbTea", 1]], get: { keepsake: 1 } }, line: "“我肚子里的故事，比你们的旧物还多。”" },
};
export const PEDDLER_IDS = Object.keys(PEDDLERS);
// 限时收购：旧站商街开了以后在那里（四间铺位中间），没开（或长夜那天）就在营门口路南、货郎摆摊的那片空地；要一样东西几份，按卖价的两倍半收；收满了多给一包东西
export const BUYER = { mult: 2.5, spot: { x: 1110, y: 545 }, farmSpot: { x: 1390, y: 520 } };
export const BUYERS = {
  inn: { name: "饭馆老板娘", look: 2, want: ["tomato", "bean", "corn"], n: 8, bonus: { seedMystery: 2 }, line: "“晚上有一桌客人，菜不够了！”" },
  med: { name: "药铺掌柜", look: 0, want: ["herb", "fine_herb"], n: 6, bonus: { bandage: 3 }, line: "“药草有多少收多少，伤员等着熬药。”" },
  dock: { name: "船坞的厨子", look: 3, want: ["@fish"], n: 5, bonus: { salt: 4 }, line: "“鱼！什么鱼都行，船队明天出海。”" },
  bake: { name: "烤饼的老孙", look: 1, want: ["corn", "rye", "potato"], n: 10, bonus: { campBread: 3 }, line: "“磨面的石磨修好了，就缺粮。”" },
  sweet: { name: "做果脯的阿秀", look: 2, want: ["pumpkin", "alBerry", "alPeach", "alApple"], n: 6, bonus: { jam: 1 }, line: "“果子熟透了才甜，我全要了。”" },
  tex: { name: "织布的老彭", look: 0, want: ["cotton", "fine_cotton"], n: 6, bonus: { cloth: 2 }, line: "“织机转起来了，棉花跟不上。”" },
  morning: { name: "开早点铺的吴婶", look: 1, want: ["egg", "milk"], n: 6, bonus: { eggMeal: 1 }, line: "“早点铺开张，鸡蛋羊奶有多少要多少。”" },
  can: { name: "做罐头的老马", look: 3, want: ["tomato", "fine_tomato"], n: 10, bonus: { jam: 2 }, line: "“番茄罐头能放三年，番茄可等不了三天。”" },
  teahouse: { name: "茶馆的杜掌柜", look: 0, want: ["herbTea", "kinTea"], n: 3, bonus: { kinCandy: 4 }, line: "“茶馆里没茶，客人就都走了。”" },
  winery: { name: "酒坊的二丫", look: 2, want: ["alWine", "alPickle"], n: 3, bonus: { salt: 6 }, line: "“几家喜事等着用，酒坊缺货。”" },
  wedding: { name: "办喜事的钟家", look: 1, want: ["pumpkin", "corn", "goldRadish"], n: 8, bonus: { kinCandy: 6 }, line: "“娶媳妇，摆十桌，菜要大的、好看的。”" },
  pickle: { name: "腌菜坊的胡师傅", look: 3, want: ["radish", "alShepherd", "alPurslane"], n: 12, bonus: { alPickle: 2 }, line: "“腌菜要趁鲜，萝卜野菜都行。”" },
};
export const BUYER_IDS = Object.keys(BUYERS);
// 鱼汛：溪谷的河或农场的水渠（只放在这个时节有好鱼的那处）；14:00–17:00 咬钩快一倍，第一条一定是这处水里最好的那一档，之后三成机会
export const SHOAL = { until: 17 * 60, bite: 0.5, rare: 0.3 };
// 被困的人：带到这张图的出口；他走得慢，被抓住会掉血
export const SURVIVORS = [
  { id: "s1", name: "护林员老秦", line: "“腿扭了，走不快。你走前面，我跟着。”" },
  { id: "s2", name: "高中生小鹿", line: "“我躲在这儿两天了……外面全是那种东西。”" },
  { id: "s3", name: "厨师大勇", line: "“我出来找盐，结果把自己困住了。”" },
  { id: "s4", name: "电工阿光", line: "“我在修线，梯子被它们推倒了。”" },
  { id: "s5", name: "怀孕的苗姐", line: "“慢一点，求你了，慢一点。”" },
  { id: "s6", name: "老教师周先生", line: "“我的学生们在南边等我。我得回去。”" },
  { id: "s7", name: "拾荒的兄弟俩", line: "“哥，你看，有人来了！”" },
  { id: "s8", name: "退伍的老兵", line: "“我还能走。别回头看我，看路。”" },
  { id: "s9", name: "迷路的小女孩丫丫", line: "“我找不到妈妈了……你能带我回去吗？”" },
  { id: "s10", name: "邮差小马", line: "“信还没送完，我不能死在这儿。”" },
  { id: "s11", name: "养蜂的老汪", line: "“我的蜂箱还在山那边，我得活着回去看看。”" },
  { id: "s12", name: "修车的阿芳", line: "“扳手掉了，它们就围上来了。你走前面。”" },
];
export const SURVIVOR = { hp: 60, speed: 120, follow: 46, hit: 20, hitCd: 1.2, held: 0.8, rep: 5, gold: 200 };
// 翻倒的物资车：两只柜子，一只稀有、一只珍贵
export const TRUCK = { kinds: ["cargo", "garage"], tiers: ["rare", "precious"] };

// ================= 鸽舍：每三天捎回一封信 =================
// need：写信的人得是你见过的（救过的、到过营门口的）；没有 need 的谁都能收到。按顺序先挑能收的、没收过的。
export const DOVE = { every: 3 };
export const LETTERS = [
  { id: "l01", from: "雨巷住区的周家", text: "“被子收到了，孩子们夜里不哭了。捎去一把棉花种子。”", gift: { seedCotton: 3 } },
  { id: "l02", from: "唐九", text: "“下回去你那儿，给你留一样好货。先捎点糖，给孩子们。”", gift: { kinCandy: 3 } },
  { id: "l03", from: "沉湾船坞的船老大", text: "“船修好了，第一网捞上来一条大黄鱼。分你两包盐，腌鱼用。”", gift: { salt: 3 } },
  { id: "l04", from: "雾松林场的守林人", text: "“松树又冒新芽了。寄一块松脂，点灯用。”", gift: { resin: 2 } },
  { id: "l05", from: "地底避难城的孩子们", text: "“我们在墙上画了你的农场，萝卜比房子还大。”", gift: { kinCandy: 2 } },
  { id: "l06", from: "检疫科研园的研究员", text: "“净水片的配方改好了，寄你一板试试。”", gift: { hpPills: 1 } },
  { id: "l07", from: "白霜气象站的老站长", text: "“今年的寒潮要早几天到。黑麦种子分你几颗，耐冻。”", gift: { seedRye: 2 } },
  { id: "l08", from: "旧站商街的茶馆", text: "“茶馆又开张了，给你留了一块茶砖。”", gift: { kinTea: 1 } },
  { id: "l09", from: "余晖档案岛的管理员", text: "“你捐来的旧物都登记了。每一件后面，都有一个名字。”", gift: { cloth: 1 } },
  { id: "l10", from: "溪谷修水闸的工人们", text: "“闸门开了，下游三个村子的田都有水了。”", gift: { fertWater: 2 } },
  { id: "l11", from: "远方的一个营地", text: "“我们听说了余烬农场。能告诉我们，土豆怎么种吗？”信里夹着几颗他们留的种。", gift: { seedPotato: 3 } },
  { id: "l12", from: "南边的学堂", text: "“孩子们学会写‘家’字了。每个人都写了一遍，寄给你看。”", gift: { herbTea: 1 } },
  { id: "l13", from: "修钟的吴师傅", need: "hpWu", text: "“又修好一只钟，挂在一个没名字的营地。那边的人说，听见嘀嗒声才睡得着。”", gift: { parts: 1 } },
  { id: "l14", from: "背着琴的小满", need: "hpMan", text: "“我在南边的营地唱了你们的名字，他们说也想有一个余烬农场。”", gift: { alBerry: 4 } },
  { id: "l15", from: "卖种子的哑叔", need: "hpYa", text: "信里只画了一片麦田，田边写着两个字：谢谢。", gift: { seedMystery: 1 } },
  { id: "l16", from: "找狗的阿团", need: "hpTuan", text: "“找到豆豆了！它瘦了一圈，耳朵还是会动。”", gift: { bread: 2 } },
  { id: "l17", from: "送信的老邮", need: "hpYou", text: "“这封是我替一个孩子写的：‘谢谢你们的鱼汤，我长高了。’”", gift: { fish: 1 } },
  { id: "l18", from: "拍照的林岚", need: "hpLan", text: "“照片洗出来了，一路上那么多营地，你们那张最亮。”", gift: { jam: 1 } },
  { id: "l19", from: "护林员老秦", need: "s1", text: "“腿好了，又能进山了。采了些野枣给你。”", gift: { alJujube: 4 } },
  { id: "l20", from: "高中生小鹿", need: "s2", text: "“我在避难城的学堂当助教了，教小孩子认字。”", gift: { herbTea: 1 } },
  { id: "l21", from: "厨师大勇", need: "s3", text: "“找到盐了，还开了个小饭馆。给你寄一罐腌菜。”", gift: { alPickle: 2 } },
  { id: "l22", from: "电工阿光", need: "s4", text: "“我们营地也通电了！灯亮的那一刻，大家都哭了。”", gift: { circuit: 1 } },
  { id: "l23", from: "苗姐", need: "s5", text: "“孩子生了，是个女孩，我们叫她‘禾’。”", gift: { egg: 3 } },
  { id: "l24", from: "周先生", need: "s6", text: "“学生们都还在。我们在南边搭了一所学校。”", gift: { cloth: 1 } },
  { id: "l25", from: "拾荒的兄弟俩", need: "s7", text: "“我们找到一辆还能开的车，往东边去了。”", gift: { scrap: 4 } },
  { id: "l26", from: "退伍的老兵", need: "s8", text: "“我在这边站岗。夜里看见北边天上有光，我猜是你们的灯。”", gift: { parts: 1 } },
  { id: "l27", from: "丫丫", need: "s9", text: "“妈妈找到了！她说要谢谢你，我也是。”", gift: { kinCandy: 3 } },
  { id: "l28", from: "养蜂的老汪", need: "s11", text: "“蜂箱找回来了。今年的头一罐蜜，分你。”", gift: { hpHoney: 1 } },
  { id: "l29", from: "种子贩子阿梅", need: "mei", text: "“今年的种子发芽好，挑了几颗丰产的给你试试。”", gift: { seed_corn_abundant: 2 } },
  { id: "l30", from: "收旧货的老钱", need: "qian", text: "“收到一只老座钟，想起你们营地，就捎过来了。”", gift: { alDecor_clock: 1 } },
];
export const LETTER_IDS = LETTERS.map((l) => l.id);

// ================= 新开局、旧档 =================
export const INTRO_LINES = ["钱有处花了：重建站的墙能升二级，农舍、仓库、鸡舍能扩建，旧站商街每周一样稀罕货；", "每周一件“这周的事”：过路人、这周的清单、唐九的商队、季节头目轮着来；", "每天 14:00 一件下午的事：空投、货郎、限时收购、鱼汛、被困的人、物资车。早上的广播会说。"];

// ================= 物品 =================
const put = (id, def) => {
  if (!ITEMS[id]) ITEMS[id] = def;
};
for (const [id, g] of Object.entries(GOODS)) put(goodItem(id), { name: g.name, type: "resource", sell: 0, hpGood: id, desc: "稀罕货：" + g.text });
put("hpHoney", { name: "蜂蜜", type: "food", sell: 55, food: 16, desc: "自己养的蜂酿的蜜，甜得发齁。能卖钱，也能送人。" });
put("hpRation", { name: "军用口粮", type: "food", sell: 40, food: 45, desc: "空投箱里的军用口粮，一袋顶一天。" });
put("hpBiscuit", { name: "压缩饼干", type: "food", sell: 24, food: 30, desc: "硬得像砖头，泡水能吃一顿。" });
put("hpPills", { name: "净水片", type: "resource", sell: 30, desc: "空投箱里的一板净水片，唐九、许医生都肯高价收。" });
put("hpMatches", { name: "防水火柴", type: "resource", sell: 20, desc: "下雨天也划得着的火柴。卖给唐九挺值钱。" });
put("hpTrophyMud", { name: "泥壳大块头的獠牙", type: "resource", sell: 150, hpTrophy: "thaw", desc: "回暖时节溪谷泥塘里那只大块头的獠牙，裹着干泥。" });
put("hpTrophyHeat", { name: "热浪护士长的怀表", type: "resource", sell: 150, hpTrophy: "heat", desc: "她一直攥在手里的怀表，停在下午两点。" });
put("hpTrophyStraw", { name: "插满麦秆的铁护腕", type: "resource", sell: 150, hpTrophy: "harvest", desc: "秋收时节麦垛后面那只大块头腕上的铁护腕。" });
put("hpTrophyIce", { name: "冻壳护士长的冰碴", type: "resource", sell: 150, hpTrophy: "cold", desc: "从冻壳护士长身上敲下来的一块冰，捧回营地也不化。" });

// 过路人、这周的清单留下的摆件：和旧物摆件一样摆在屋里屋外
const NEW_DECOR = [
  { id: "hpWuClock", name: "吴师傅的小座钟", desc: "吴师傅修好的小座钟，嘀嗒嘀嗒，跟当年一个声儿。" },
  { id: "hpManHarmonica", name: "小满的口琴", desc: "小满留下的旧口琴，吹起来有点漏风。" },
  { id: "hpYaSeedJar", name: "哑叔的种子罐", desc: "装满种子的陶罐，罐口用布扎着。" },
  { id: "hpTuanDog", name: "木雕小狗", desc: "阿团刻的小狗，左耳朵涂成了黑的。" },
  { id: "hpYouBag", name: "旧邮包", desc: "老邮送的帆布邮包，上面印着“邮”。" },
  { id: "hpLanPhoto", name: "营地的合影", desc: "林岚拍的大合影，大家挤在农舍门口。" },
  { id: "hpQuilt", name: "百家被", desc: "几个营地的人一人一块布拼起来的被子。" },
  { id: "hpDrawing", name: "孩子们的画", desc: "学堂的孩子画的余烬农场，田里的萝卜比人还大。" },
  { id: "hpTablecloth", name: "长条桌布", desc: "河边宴席用过的桌布，洗了还有一点鱼汤味。" },
  { id: "hpSeedWall", name: "种子罐墙", desc: "一排小玻璃罐，每罐一种种子，贴着名字。" },
  { id: "hpSwing", name: "秋千", desc: "布搓的绳、木头的架子，孩子们抢着荡。" },
  { id: "hpPaperLamp", name: "纸灯串", desc: "药草浆糊糊的纸灯，一串七盏。" },
];
// 只进 DECOR_BY_ID（摆得出来、认得出来），不进 DECOR 那张表：柜子、商队、麦穗随手翻到的摆件里不会冒出它们
for (const d of NEW_DECOR) {
  DECOR_BY_ID[d.id] ??= { id: d.id, name: d.name, where: [], desc: d.desc, hope: true };
  put(decorItem(d.id), { name: d.name, type: "resource", sell: 6, decor: d.id, desc: d.desc + "（摆件：在建设里选「旧物摆件」摆出来）" });
}
export const HOPE_DECOR = NEW_DECOR.map((d) => d.id);

// 过路人、货郎、收购的人的样子（对话里的像素立绘也用这个）
for (const [id, t] of Object.entries(TRAVELERS)) NPCS[id] ??= { name: t.name, title: "过路人", look: t.look, lines: { hello: t.story[0] } };

// ================= 小图 =================
const A = PAL.ash,
  So = PAL.soil,
  E = PAL.ember,
  St = PAL.straw,
  L = PAL.leaf,
  W = PAL.water,
  Sn = PAL.snow,
  Ro = PAL.stone,
  Ru = PAL.rust,
  N = PAL.night,
  Cl = PAL.cloth;
const GOOD_DRAW = {
  can: (P) => {
    P.rect(3, 7, 9, 6, W[3]);
    P.rect(3, 7, 9, 2, W[4]);
    P.line(12, 8, 15, 5, Ro[4]);
    P.rect(5, 4, 5, 2, Ro[3]);
    P.hline(3, 11, 13, W[1]);
  },
  hoe: (P) => {
    P.line(3, 14, 11, 4, So[3]);
    P.rect(9, 2, 6, 3, Ru[3]);
    P.rect(12, 5, 3, 2, Ru[2]);
    P.set(10, 2, E[4]);
  },
  rod: (P) => {
    P.line(2, 14, 13, 2, A[3]);
    P.line(13, 2, 13, 10, Sn[4]);
    P.disc(4, 12, 1.5, Ro[4]);
    P.rect(12, 10, 3, 2, Cl[2]);
  },
  bait: (P) => {
    P.rect(4, 5, 8, 9, W[2]);
    P.rect(4, 4, 8, 2, Ro[3]);
    P.set(6, 9, L[4]);
    P.set(8, 11, L[4]);
    P.set(9, 8, L[5]);
  },
  seedbox: (P) => {
    P.rect(2, 4, 12, 10, So[3]);
    for (let y = 5; y < 13; y += 4) for (let x = 3; x < 13; x += 4) P.rect(x, y, 3, 3, So[1]);
    P.set(4, 6, St[3]);
    P.set(8, 10, L[4]);
    P.set(12, 6, E[3]);
  },
  ledger: (P) => {
    P.rect(3, 2, 10, 12, So[2]);
    P.rect(4, 3, 8, 10, St[4]);
    P.hline(5, 10, 5, A[2]);
    P.hline(5, 10, 7, A[2]);
    P.hline(5, 8, 9, A[2]);
    P.rect(11, 2, 2, 5, Cl[1]);
  },
  goldSeeds: (P) => {
    P.rect(4, 4, 8, 10, St[3]);
    P.rect(5, 2, 6, 3, St[2]);
    P.disc(8, 9, 2.5, E[4]);
    P.set(8, 9, E[5]);
  },
  composter: (P) => {
    P.rect(3, 5, 10, 9, L[1]);
    P.rect(3, 5, 10, 2, L[3]);
    P.rect(6, 9, 4, 3, So[1]);
    P.set(12, 3, Ro[4]);
    P.set(13, 2, Ro[3]);
  },
  cellar: (P) => {
    P.rect(2, 6, 12, 8, Ro[2]);
    P.rect(4, 8, 3, 6, So[2]);
    P.rect(9, 8, 3, 6, So[2]);
    P.poly([[2, 6], [8, 2], [14, 6]], Ro[3]);
  },
  hive: (P) => {
    P.rect(4, 6, 8, 8, St[3]);
    P.hline(4, 11, 9, St[1]);
    P.hline(4, 11, 12, St[1]);
    P.rect(3, 4, 10, 2, So[2]);
    P.set(7, 13, A[1]);
    P.set(13, 5, E[5]);
  },
  boiler: (P) => {
    P.rect(2, 4, 12, 4, N[3]);
    P.hline(2, 13, 6, Sn[3]);
    P.rect(10, 8, 3, 6, Ro[4]);
    P.rect(3, 9, 6, 2, Ro[3]);
  },
  gramophone: (P) => {
    P.rect(3, 10, 9, 4, So[2]);
    P.poly([[7, 9], [13, 2], [15, 6]], St[3]);
    P.disc(6, 9, 2.5, A[1]);
    P.set(6, 9, Cl[2]);
  },
  hotbed: (P) => {
    P.rect(2, 8, 12, 6, So[2]);
    P.poly([[2, 8], [8, 3], [14, 8]], W[5]);
    P.set(5, 11, L[4]);
    P.set(9, 12, L[4]);
    P.set(11, 10, L[5]);
  },
  dove: (P) => {
    P.rect(4, 4, 8, 7, Sn[3]);
    P.poly([[3, 4], [8, 1], [13, 4]], Ru[2]);
    P.rect(7, 7, 2, 3, A[1]);
    P.vline(8, 11, 14, So[2]);
    P.set(12, 2, Sn[4]);
  },
  mill: (P) => {
    P.rect(6, 6, 4, 8, Ro[3]);
    P.line(8, 6, 2, 1, Sn[3]);
    P.line(8, 6, 14, 1, Sn[3]);
    P.line(8, 6, 3, 12, Sn[3]);
    P.line(8, 6, 13, 12, Sn[3]);
    P.disc(8, 6, 1.2, A[2]);
  },
  kennel: (P) => {
    P.rect(3, 7, 10, 7, So[3]);
    P.poly([[2, 7], [8, 2], [14, 7]], Cl[1]);
    P.rect(6, 10, 4, 4, A[1]);
  },
  incubator: (P) => {
    P.rect(2, 6, 12, 8, Ro[3]);
    P.rect(3, 7, 10, 4, E[4]);
    P.disc(6, 9, 1.5, Sn[4]);
    P.disc(10, 9, 1.5, Sn[4]);
    P.set(8, 4, E[5]);
  },
  tractor: (P) => {
    P.rect(5, 5, 7, 5, Cl[1]);
    P.rect(9, 3, 3, 3, Ro[4]);
    P.disc(5, 12, 2.5, A[1]);
    P.disc(12, 12, 1.8, A[1]);
    P.set(5, 12, Ro[3]);
  },
};
for (const id of GOOD_IDS) ICON_DRAW[goodItem(id)] ??= GOOD_DRAW[id];
Object.assign(ICON_DRAW, {
  hpHoney: (P) => {
    P.rect(4, 5, 8, 9, E[4]);
    P.rect(4, 4, 8, 2, So[2]);
    P.rect(5, 7, 2, 5, E[5]);
    P.hline(4, 11, 13, E[2]);
  },
  hpRation: (P) => {
    P.rect(3, 4, 10, 9, L[2]);
    P.rect(3, 4, 10, 2, L[3]);
    P.rect(6, 7, 4, 3, St[3]);
  },
  hpBiscuit: (P) => {
    P.rect(3, 5, 10, 7, St[2]);
    for (let x = 5; x < 12; x += 3) for (let y = 7; y < 11; y += 3) P.set(x, y, St[0]);
  },
  hpPills: (P) => {
    P.rect(4, 4, 8, 9, Sn[3]);
    P.disc(6, 8, 1.4, W[4]);
    P.disc(10, 8, 1.4, W[4]);
    P.disc(8, 11, 1.4, W[4]);
  },
  hpMatches: (P) => {
    P.rect(3, 6, 10, 7, Cl[1]);
    P.rect(4, 7, 8, 2, St[3]);
    P.vline(6, 2, 7, So[3]);
    P.set(6, 2, E[3]);
  },
  hpTrophyMud: (P) => {
    P.poly([[4, 13], [8, 2], [11, 13]], Sn[3]);
    P.rect(4, 11, 7, 3, So[2]);
  },
  hpTrophyHeat: (P) => {
    P.disc(8, 9, 5, St[2]);
    P.disc(8, 9, 3.5, Sn[4]);
    P.line(8, 9, 8, 6, A[1]);
    P.line(8, 9, 10, 10, A[1]);
    P.rect(7, 2, 2, 2, St[2]);
  },
  hpTrophyStraw: (P) => {
    P.rect(3, 6, 10, 6, Ru[2]);
    P.line(4, 4, 6, 12, St[3]);
    P.line(9, 3, 10, 13, St[4]);
    P.line(12, 5, 11, 12, St[3]);
  },
  hpTrophyIce: (P) => {
    P.poly([[8, 2], [13, 8], [8, 14], [3, 8]], W[5]);
    P.poly([[8, 4], [11, 8], [8, 11]], Sn[4]);
  },
});
const D2 = {
  hpWuClock: (P) => {
    P.rect(4, 3, 8, 11, So[3]);
    P.disc(8, 7, 3, Sn[4]);
    P.line(8, 7, 8, 5, A[1]);
    P.line(8, 7, 10, 8, A[1]);
    P.rect(5, 11, 6, 2, St[3]);
  },
  hpManHarmonica: (P) => {
    P.rect(2, 6, 12, 5, Ro[4]);
    P.rect(2, 8, 12, 1, A[2]);
    for (let x = 3; x < 13; x += 2) P.set(x, 9, A[1]);
  },
  hpYaSeedJar: (P) => {
    P.rect(4, 5, 8, 9, So[3]);
    P.rect(5, 3, 6, 3, Cl[5]);
    P.set(7, 9, St[4]);
    P.set(9, 11, L[4]);
    P.set(6, 12, E[4]);
  },
  hpTuanDog: (P) => {
    P.rect(4, 8, 8, 4, So[3]);
    P.rect(10, 5, 4, 4, So[3]);
    P.set(13, 4, A[1]);
    P.rect(4, 12, 2, 2, So[2]);
    P.rect(10, 12, 2, 2, So[2]);
    P.set(3, 7, So[3]);
  },
  hpYouBag: (P) => {
    P.rect(3, 5, 10, 9, L[2]);
    P.rect(3, 5, 10, 3, L[3]);
    P.line(4, 5, 12, 1, So[2]);
    P.rect(6, 9, 4, 3, St[4]);
  },
  hpLanPhoto: (P) => {
    P.rect(2, 3, 12, 10, Sn[4]);
    P.rect(3, 4, 10, 7, W[2]);
    for (let x = 4; x < 12; x += 2) P.rect(x, 7, 1, 3, So[2]);
    P.rect(3, 10, 10, 1, L[3]);
  },
  hpQuilt: (P) => {
    for (let y = 4; y < 13; y += 3) for (let x = 2; x < 14; x += 3) P.rect(x, y, 3, 3, [Cl[1], St[3], W[3], L[3]][(x + y) % 4]);
  },
  hpDrawing: (P) => {
    P.rect(2, 3, 12, 10, Sn[4]);
    P.disc(11, 5, 1.5, E[4]);
    P.rect(4, 9, 3, 3, E[3]);
    P.rect(4, 7, 3, 2, L[4]);
    P.rect(9, 10, 3, 2, L[3]);
  },
  hpTablecloth: (P) => {
    P.rect(1, 6, 14, 6, Cl[5]);
    for (let x = 1; x < 15; x += 3) P.rect(x, 6, 1, 6, Cl[2]);
    P.hline(1, 14, 12, Cl[1]);
  },
  hpSeedWall: (P) => {
    for (let k = 0; k < 4; k++) {
      P.rect(2 + k * 3, 6, 2, 7, Sn[3]);
      P.set(2 + k * 3, 10, [St[3], L[4], E[4], So[3]][k]);
    }
    P.hline(1, 14, 13, So[2]);
  },
  hpSwing: (P) => {
    P.hline(2, 13, 2, So[3]);
    P.vline(2, 2, 14, So[3]);
    P.vline(13, 2, 14, So[3]);
    P.vline(6, 3, 10, Cl[5]);
    P.vline(9, 3, 10, Cl[5]);
    P.rect(5, 10, 6, 2, So[2]);
  },
  hpPaperLamp: (P) => {
    P.hline(1, 14, 3, A[2]);
    for (let k = 0; k < 3; k++) {
      P.rect(2 + k * 5, 5, 3, 5, [E[4], Cl[2], St[4]][k]);
      P.set(3 + k * 5, 4, A[2]);
    }
  },
};
for (const d of NEW_DECOR) {
  DECOR_DRAW[d.id] ??= D2[d.id];
  ICON_DRAW[decorItem(d.id)] ??= D2[d.id];
}

// ================= 大事卡片：营地升级、过路人、这周的事 =================
Object.assign(MOMENT_KINDS, {
  upgrade: { label: "营地升级", color: "#ffcf6a" },
  traveler: { label: "过路人", color: "#cfe7a6" },
  week: { label: "这周的事", color: "#8fd0ff" },
  // 收集的三样里程碑：捐给档案馆的旧物、残页、检修电梯
  old: { label: "档案馆", color: "#e6c48a" },
  page: { label: "残页", color: "#e9dcc0" },
  lift: { label: "检修电梯", color: "#9fd16a" },
});
// 三句新的短乐句：八音盒似的（旧物）、翻纸的两声笛（残页）、铁门一响往上走（电梯）
Object.assign(STINGERS, {
  archive: [[0, "bell", 76, 0.45], [0.16, "bell", 79, 0.45], [0.32, "bell", 83, 0.5], [0.32, "pad", 64, 0.35], [0.56, "flute", 88, 0.4]],
  page: [[0, "pluck", 72, 0.45], [0.1, "flute", 79, 0.45], [0.28, "flute", 84, 0.45]],
  lift: [[0, "tom", 45, 0.7], [0.1, "pluck", 60, 0.55], [0.28, "bell", 72, 0.55], [0.46, "bell", 79, 0.6], [0.46, "pad", 67, 0.35]],
});
Object.assign(MOMENT_SOUND, {
  upgrade: { stinger: "actDone", ui: true },
  traveler: { stinger: "firstHarvest", ui: true },
  week: { stinger: "victory", ui: true },
  old: { stinger: "archive", ui: true },
  page: { stinger: "page", ui: true },
  lift: { stinger: "lift", ui: true },
});
