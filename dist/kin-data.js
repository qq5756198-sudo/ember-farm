// v0.30.0「人情」：星露谷 30 个好玩点移植方案第二版（人和人之间）的数据。
// 判定写在 kin.js；故事和台词在 kin-story.js；这里只放数值、喜好、新物品、钓鱼的水和鱼、它们的小图。
// 1. 门缝里的纸条：信任到 4 的人偶尔在清晨往门缝里塞张纸条（提醒、菜的做法、一件用得上的东西），每人 7 天最多一张、全营一天最多两张，只进消息记录。
// 2. 送礼要猜：每人最爱 2 样、喜欢 4 样、讨厌 2 样，一开始都不知道；营火夜谈、节庆聊天、看口袋、纸条、送错时的反应一格格解开。
//    最爱 +2、喜欢 +1、一般 0、讨厌 −1；每人 7 天最多 2 次；生日照旧翻倍；信任 5 以上每格要两份心意，8 以上要三份。
// 3. 心里话：阿禾、许医生、陈工、江伯、秦奶奶、老琴、何大勺、尤可，信任到 3、6、9 各一段，只在平安的晚上、在他常待的地方；
//    第二段带一个小请求（去某张废墟找一样旧东西），第三段教你一样只有他会的本事。
// 4. 节庆聚在火边：节庆 16:00 起认识的人都到广场；挨个说句话（心情 +3、透露一样喜好）；换种集换种子、灯火夜点路灯、丰收评比摆上品、守夜纪念日念名字。
// 5. 搭伙过日子：六个人可以搭伙（亲手做的东西 → 营火边说开 → 请全营吃一顿）；每天早饭、浇田或修设施，长夜守在你身边。不生孩子，改成收留过路人的孩子。
// 6. 各有各的一天：人物关系页写这会儿大概在哪，点一下标出来；傍晚坐到营火边，下雨躲进屋，尸潮前一天去营门垒沙袋。
// 7. 麦穗叼物：默契 10 以上，隔几天早上叼回一样小东西。
// 8. 收线钓鱼：咬钩后按住收线、鱼挣就松手，线绷红了会断；溪谷的河、沉湾的海、农场水渠，连池塘一共 24 种进图鉴；河和海的水要许医生验过才敢吃。
// 9. 商队稀罕货：唐九每趟多一格稀罕货（某人的最爱、旧物摆件、一包当季种子）。
import { ITEMS, RECIPES } from "./data.js";
import { PAL } from "./pixel-kit.js";
import { DRAW as ICON_DRAW } from "./item-sprites.js";
import { SNPCS, LIKES, LODGER_NAMES } from "./seasons-data.js";

export const KIN_SCHEMA = 1;

// ================= 心里话的八个人、搭伙的六个人 =================
export const HEART_IDS = ["farmer", "medic", "mechanic", "jiang", "qin", "laoqin", "he", "youke"];
export const HEART_AT = [3, 6, 9];
// 说到“她 / 他”：阿禾、许医生、秦奶奶、尤可是她
export const SHE = ["farmer", "medic", "qin", "youke"];
export const ta = (id) => (SHE.includes(id) ? "她" : "他");
export const PARTNER_IDS = ["farmer", "medic", "mechanic", "youke", "he", "laoqin"];
// 心里话在哪儿说：他常待的地方（傍晚他会走过去；fire 是营火边）
export const HEART_SPOTS = {
  farmer: { x: 726, y: 470, label: "田边" },
  medic: { x: 695, y: 355, label: "诊所门口" },
  mechanic: { x: 900, y: 335, label: "水井边" },
  youke: { x: 1060, y: 470, label: "机床边" },
  jiang: { x: 960, y: 748, label: "池塘边" },
  he: { x: 1120, y: 490, label: "灶台旁" },
  qin: { x: 236, y: 380, label: "农舍西边" },
  laoqin: { fire: true, label: "营火边" },
};
// 傍晚、下雨天、节庆、垒沙袋的时辰
export const HOURS = { evening: [19 * 60, 23 * 60], talk: [19 * 60, 23 * 60], sandbag: [14 * 60, 18 * 60] };

// ================= 送礼 =================
// 最爱 +2、喜欢 +1、一般 0、讨厌 −1；每人 7 天最多 2 次；生日正的翻倍；信任 5 以上每份心意只长半格（两份长一格）
// 信任 5 以上每格要两份心意、8 以上每格要三份（送礼、营火夜谈、心里话、订单板的单子每人 7 天一回；故事里的奖励、每日抉择照旧一份一格）
export const GIFT = { per: 2, window: 7, fav: 2, like: 1, meh: 0, hate: -1, bday: 2, slowFrom: 5, slow3: 8, near: 170, mood: 3 };
// 营火夜谈：说说以前，在座的每人透露一样喜好；10 天里没因为聊天长过信任的人 +1；安慰 +2（同样 10 天一次）
export const TALK_RULES = { past: 1, comfort: 2, cd: 10 };
// 能送的东西：吃的、药、材料、种子、作物（任务物品、装备、受保护的东西不行）
export const GIFT_TYPES = ["food", "medicine", "resource", "seed", "crop"];
export const giftBase = (id) => String(id || "").replace(/^(fine|hardy|prime|giant)_/, "");

// 稀罕物：多是某个人的最爱，要去特定废墟的特定柜子里找；也会出现在唐九的稀罕货里
export const KEEPSAKES = {
  kinSeedTin: { name: "老种子罐", owner: "farmer", home: { region: "residential", kinds: ["kitchen", "wardrobe"] }, sell: 20, desc: "铁皮罐里是没开封的老品种种子，罐底刻着一个“禾”字。" },
  kinSteth: { name: "听诊器", owner: "medic", home: { region: "hospital", kinds: ["medicine"] }, sell: 30, desc: "胶管有点硬了，听头擦得锃亮。" },
  kinCaliper: { name: "游标卡尺", owner: "mechanic", home: { region: "warehouse", kinds: ["toolbox", "garage"] }, sell: 28, desc: "刻度磨得发白，卡口还是准的。" },
  kinHooks: { name: "老鱼钩", owner: "jiang", home: { region: "warehouse", kinds: ["toolbox", "garage"] }, sell: 18, desc: "一小盒钢鱼钩，盒盖上刻着个“江”字。" },
  kinGlasses: { name: "老花镜", owner: "qin", home: { region: "residential", kinds: ["wardrobe"] }, sell: 16, desc: "镜腿缠着胶布，镜片没碎。" },
  kinStrings: { name: "琴弦", owner: "laoqin", home: { region: "residential", kinds: ["wardrobe", "garage"] }, sell: 24, desc: "一卷没开封的吉他弦，包装纸都黄了。" },
  kinCleaver: { name: "老菜刀", owner: "he", home: { region: "residential", kinds: ["kitchen"] }, sell: 22, desc: "刀背上刻着“三班”，刃口还很快。" },
  kinBoard: { name: "整块电路板", owner: "youke", home: { region: "warehouse", kinds: ["cargo"] }, sell: 40, desc: "带蓝色封条的整块板子，没拆过。" },
  kinTea: { name: "茶砖", owner: "", home: { region: "hospital", kinds: ["kitchen", "cargo"] }, sell: 26, desc: "压得硬邦邦的一块老茶，掰一角能泡一壶。" },
  kinBattery: { name: "一节电池", owner: "", home: { region: "warehouse", kinds: ["garage", "cargo"] }, sell: 20, desc: "没漏液的一节大电池，手电、收音机都用得上。" },
  kinCandy: { name: "水果糖", owner: "", home: { region: "residential", kinds: ["kitchen"] }, sell: 8, desc: "一小把玻璃纸包的水果糖，孩子们见了眼睛发亮。" },
};
export const KEEP_IDS = Object.keys(KEEPSAKES);
// 柜子里翻到稀罕物：对的废墟、对的柜子，认识的人里有谁最爱它、你手上还没有，才有这个机会
export const KEEP_RULES = { chance: 0.05, locked: 0.08 };

// 每人：最爱 2、喜欢 4、讨厌 2（原来的两样喜欢都留在“喜欢”或“最爱”里）
export const PREFS = {
  farmer: { fav: ["kinSeedTin", "seedMystery"], like: ["seedHerb", "jam", "egg", "alMulberry"], hate: ["ammo", "scrap"] },
  medic: { fav: ["kinSteth", "medkit"], like: ["herb", "herbTea", "cloth", "alMushroom"], hate: ["alWine", "scrap"] },
  mechanic: { fav: ["kinCaliper", "circuit"], like: ["parts", "bread", "armyStew", "kinBattery"], hate: ["herbTea", "alMushroom"] },
  youke: { fav: ["kinBoard", "jam"], like: ["circuit", "parts", "kinBattery", "alColdSoup"], hate: ["alPickle", "salt"] },
  he: { fav: ["kinCleaver", "salt"], like: ["potato", "radish", "egg", "alPickleOld"], hate: ["bread", "trailRye"] },
  qin: { fav: ["kinGlasses", "radishCake"], like: ["herbTea", "cloth", "alPersimmon", "egg"], hate: ["ammo", "alWine"] },
  jiang: { fav: ["kinHooks", "alWineAged"], like: ["bread", "resin", "fishStew", "alWine"], hate: ["jam", "alColdSoup"] },
  laoqin: { fav: ["kinStrings", "alWine"], like: ["herbTea", "fishStew", "kinTea", "alPeach"], hate: ["salt", "alPickle"] },
  tieqiao: { fav: ["armyStew", "kinTea"], like: ["bread", "stew", "campBread", "egg"], hate: ["herb", "alMushroom"] },
  tangjiu: { fav: ["kinBattery", "alWineAged"], like: ["salt", "parts", "circuit", "jam"], hate: ["bread", "radish"] },
  huer: { fav: ["kinTea", "armyStew"], like: ["bread", "fishStew", "ammo", "warmSoup"], hate: ["herbTea", "alMushroom"] },
  yaozi: { fav: ["ammo", "kinBattery"], like: ["stew", "bread", "alJujube", "parts"], hate: ["jam", "alShepherd"] },
  zou: { fav: ["alPickleOld", "kinTea"], like: ["bread", "potato", "warmSoup", "egg"], hate: ["ammo", "jam"] },
  ge: { fav: ["kinTea", "armyStew"], like: ["bread", "warmSoup", "ammo", "salt"], hate: ["jam", "alColdSoup"] },
  alan: { fav: ["milk", "alApple"], like: ["bean", "radish", "egg", "alShepherd"], hate: ["ammo", "scrap"] },
  amo: { fav: ["moonHerb", "kinCandy"], like: ["herbTea", "alMushroom", "bread", "resin"], hate: ["salt", "alWine"] },
  yeying: { fav: ["kinBattery", "jam"], like: ["herbTea", "kinTea", "alPeach", "cloth"], hate: ["ammo", "scrap"] },
  suyan: { fav: ["junkPhoto", "kinTea"], like: ["cloth", "resin", "circuit", "herbTea"], hate: ["fish", "alPickle"] },
  adou: { fav: ["kinCandy", "jam"], like: ["radishCake", "bread", "alBerry", "egg"], hate: ["herb", "herbTea"] },
  ali: { fav: ["resin", "kinCandy"], like: ["cloth", "alBerry", "bread", "jam"], hate: ["herbTea", "salt"] },
  cartographer: { fav: ["kinTea", "junkPencil"], like: ["cloth", "bread", "herbTea", "alChestnut"], hate: ["ammo", "alWine"] },
};
// 别的援建队员、过路留下的人：按名字挑一套
export const CREW_TEMPLATES = [
  { fav: ["stew", "kinTea"], like: ["bread", "fishStew", "egg", "potato"], hate: ["herb", "alMushroom"] },
  { fav: ["jam", "alWine"], like: ["bread", "stew", "salt", "radish"], hate: ["ammo", "alPickle"] },
  { fav: ["ammo", "kinBattery"], like: ["bread", "parts", "armyStew", "egg"], hate: ["jam", "herbTea"] },
  { fav: ["herbTea", "alPeach"], like: ["bread", "cloth", "egg", "alBerry"], hate: ["salt", "scrap"] },
];
const hashStr = (s) => {
  let h = 2166136261;
  for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return h >>> 0;
};
export function prefsOf(id) {
  const p = PREFS[id] || CREW_TEMPLATES[hashStr(id) % CREW_TEMPLATES.length];
  return { fav: p.fav.filter((x) => ITEMS[x]), like: p.like.filter((x) => ITEMS[x]), hate: p.hate.filter((x) => ITEMS[x]) };
}
// 原来人物页上写着的两样“喜欢”：旧档读进来时算已经知道了
export function legacyLikes(id) {
  return (SNPCS[id]?.likes || LIKES[id] || []).filter((x) => ITEMS[x]);
}

// ================= 第二段心里话的小请求：去哪找 =================
// at：那张废墟上的一处空地（找不到落脚的地方时，就近挪开）
export const REQUESTS = {
  farmer: { item: "kinSeedTin", region: "residential", x: 975, y: 342, name: "阿禾家的橱柜", hint: "废弃居民区东头那家，门上贴着褪色的福字" },
  medic: { item: "kinSteth", region: "hospital", x: 858, y: 300, name: "护士站的药柜", hint: "旧医院大楼西边，贴着红十字的药柜" },
  mechanic: { item: "kinCaliper", region: "warehouse", x: 420, y: 758, name: "陈工的工具柜", hint: "工业仓库西南那排厂房外，绿漆工具柜" },
  jiang: { item: "kinHooks", region: "warehouse", x: 1395, y: 870, name: "江伯的钓箱", hint: "工业仓库东南角塌了一半的棚子里" },
  qin: { item: "kinGlasses", region: "residential", x: 230, y: 290, name: "借住那户的床头柜", hint: "废弃居民区西北那排房子外" },
  laoqin: { item: "kinStrings", region: "residential", x: 400, y: 775, name: "琴行的柜台", hint: "废弃居民区西南那排房子外，招牌只剩个“琴”字" },
  he: { item: "kinCleaver", region: "residential", x: 955, y: 650, name: "饭馆的后厨", hint: "废弃居民区东南那排房子西边，门口挂着歪了的灯笼" },
  youke: { item: "kinBoard", region: "warehouse", x: 1410, y: 690, name: "蓝封条的货箱", hint: "工业仓库东边那只蓝色货柜旁" },
};

// ================= 第三段教的本事 =================
export const SKILLS = {
  seedSave: { who: "farmer", name: "留种", desc: "收当季的菜时，两成机会多留下 1 份这种菜的种子（进仓库）。" },
  bandage: { who: "medic", name: "包扎", desc: "用绷带多回 18 生命。" },
  kitSave: { who: "mechanic", name: "量准了再修", desc: "用修理包修设施时，一半的机会不耗修理包。" },
  readWater: { who: "jiang", name: "看水", desc: "收线时，鱼要挣之前水面先打个旋，提前一点看得出来。" },
  patch: { who: "qin", name: "补衣服", desc: "修护具时，要的布减半。" },
  song: { who: "laoqin", name: "起个头", desc: "营火夜谈不管聊什么，居民心情另 +3。" },
  fire: { who: "he", name: "火候", desc: "篝火灶做东西快四分之一。" },
  parts: { who: "youke", name: "省一个零件", desc: "做东西要 2 个以上零件时，少用 1 个。" },
};
export const SKILL_OF = Object.fromEntries(Object.entries(SKILLS).map(([k, v]) => [v.who, k]));
export const SKILL_RULES = { seedSave: 0.2, bandage: 18, kitSave: 0.5, song: 3, fire: 1.25 };

// ================= 门缝里的纸条 =================
export const NOTE = { trust: 4, every: 7, perDay: 2, chance: 0.16, log: 12 };
// 纸条里夹的东西（按人）；没写的人随手塞点干粮
export const NOTE_ITEMS = {
  farmer: { seed: 2 },
  medic: { bandage: 1 },
  mechanic: { parts: 1 },
  youke: { parts: 1 },
  he: { bread: 2 },
  qin: { cloth: 1 },
  jiang: { grub: 2 },
  laoqin: { herbTea: 1 },
  tieqiao: { wood: 3 },
  tangjiu: { salt: 1 },
};

// ================= 节庆 =================
// 灯火夜：16:00 到 20:00 把通往营门的六盏路灯点亮，点满了当晚夜行者不来
export const LAMPS = [
  { x: 430, y: 378 },
  { x: 610, y: 378 },
  { x: 790, y: 378 },
  { x: 980, y: 378 },
  { x: 1160, y: 378 },
  { x: 1330, y: 392 },
];
export const FEST2 = { lampsBy: 20 * 60, chatMood: 3, chatNear: 260, vigilMood: 4, swap: 2, swapMin: 4 };
// 节庆在广场上站一圈；营火边坐一圈；营门前垒沙袋
export const PLAZA = { x: 1240, y: 470, r: 108 };
export const GATE = { x: 1300, y: 410, r: 54 };

// ================= 搭伙过日子 =================
// 信任 8、说过两段心里话：送一样亲手做的东西（铁丝戒指、修好的旧收音机）开始走近；
// 信任 10、三段心里话都说完：傍晚在营火边说开；第二天起在广场请全营吃一顿，就搬进农舍。
export const PARTNER = {
  near: 8,
  confess: 10,
  gifts: ["kinRing", "kinRadio"],
  feast: { stew: 3, bread: 6 },
  feastMood: 8,
  water: 6,
  fix: 20,
  hurtDays: 2,
  hurtMood: -8,
  // 长夜里守在你身边：站在你身后（怪多的那边的反方向），只打冲着他来的（贴到他身边、离他比离你还近的那只），
  // 6 点、1.5 秒一下，只掉血不推开、不打断（推开、打断是你手上家伙的事）；也只挨那些的打（一半）。
  // 守夜台上一个人守的倒下率只比没搭伙的低 2.5 个百分点（800 晚）；防线的活还是塔和陷阱的。
  // 血掉到三成就往农舍撤（撤回屋里不算挂彩）；撤的路上被追上、或一下子被围住打到 0，才是挂彩
  ally: { hp: 110, dmg: 6, rate: 1.5, reach: 40, r: 170, speed: 96, follow: 58, hurtCd: 1.2, hitR: 30, take: 0.5, retreat: 0.3, home: { x: 300, y: 352 } },
};
// 每天早上留的早饭
export const BREAKFAST = "kinBreakfast";

// ================= 收留孩子 =================
export const KIDS = { max: 2, learn: 7, chance: 0.6, askUntil: 20 * 60 };
export const KID_LODGERS = ["带孩子的梅姐", "带外孙的刘婶"];
export const KID_NAMES = { 带孩子的梅姐: "小苗", 带外孙的刘婶: "石榴" };
// 刘婶是这一版新来的过路人：加进借宿的名单（老名单不动，只往后加）
for (const n of KID_LODGERS) if (!LODGER_NAMES.includes(n)) LODGER_NAMES.push(n);
// 跟谁学什么：学会以后每天帮一点小忙
export const KID_CRAFTS = {
  farmer: { name: "浇水", desc: "每天 07:00 帮着浇 2 块没浇的田" },
  medic: { name: "卷绷带", desc: "每 3 天卷 1 条绷带" },
  mechanic: { name: "捡零件", desc: "每 3 天从废料里挑出 1 个零件" },
  he: { name: "打下手", desc: "每 2 天帮何大勺多做 2 份干粮" },
};

// ================= 麦穗叼物 =================
export const DOG_FETCH = {
  bond: 10,
  chance: 0.34,
  items: [
    [{ scrap: 2 }, 30],
    [{ parts: 1 }, 18],
    ["seed", 24],
    [{ wood: 2 }, 12],
    ["decor", 10],
    [{ cloth: 1 }, 6],
  ],
};

// ================= 收线钓鱼 =================
// bob：浮漂落在哪（画鱼线用）
export const WATERS = {
  pond: { name: "林边池塘", region: "farm", x: 1040, y: 820, clean: true, bob: { x: 1112, y: 752 } },
  canal: { name: "农场水渠", region: "farm", x: 850, y: 752, clean: true, bob: { x: 818, y: 752 } },
  river: { name: "溪谷的河", region: "valley", x: 836, y: 210, clean: false, bob: { x: 875, y: 196 } },
  sea: { name: "沉湾的海", region: "shipyard", x: 640, y: 910, clean: false, bob: { x: 652, y: 972 } },
};
export const WATER_IDS = Object.keys(WATERS);
// 收线的难度：pull 鱼挣的间隔和长短（秒），reel 按住时往回收的速度，tense 按住时线绷紧的速度（挣的时候 pulled），
// relax 松手时线松下来的速度，slip / run 松手、挣的时候鱼往外跑的速度；进度从 start 开始，到 1 钓上来，到 0 脱钩
export const TIERS = {
  common: { name: "常见", every: [1.9, 3.0], len: [0.4, 0.7], reel: 0.24, tense: 0.16, pulled: 2.6, relax: 0.9, slip: 0.02, run: 0.07, start: 0.3 },
  uncommon: { name: "少见", every: [1.6, 2.6], len: [0.5, 0.9], reel: 0.22, tense: 0.17, pulled: 3.05, relax: 0.85, slip: 0.03, run: 0.09, start: 0.3 },
  rare: { name: "稀有", every: [1.3, 2.2], len: [0.6, 1.0], reel: 0.2, tense: 0.18, pulled: 3.2, relax: 0.8, slip: 0.04, run: 0.12, start: 0.28 },
};
// warn：学会「看水」以后，鱼要挣之前提前多少秒看得出来；ramp：鱼刚一挣的那一下缓冲
export const REEL = { limit: 30, warn: 0.3, ramp: 0.35 };
// 24 种：池塘原来的 5 种（银鳞鱼、蓝背鱼、金尾夜鱼、变异鱼、雨鳅）+ 新的 19 种
// seasons：哪几个时节有（空 = 都有）；hours：钟点（分钟，跨夜也行）；rain：只在下雨天；w：同一处水里的比重
export const FISH = {
  fish: { water: "pond", tier: "common", hint: "池塘，什么时候都有" },
  riverFish: { water: "pond", tier: "uncommon", hint: "池塘，下雨天或用了鱼饵" },
  nightFish: { water: "pond", tier: "rare", hint: "池塘，夜里" },
  mutantFish: { water: "pond", tier: "rare", hint: "池塘，接了江伯“变异鱼”那件事以后" },
  alLoach: { water: "pond", tier: "uncommon", hint: "池塘，下雨天" },
  kinCrucian: { water: "pond", tier: "common", name: "鲫鱼", food: 18, sell: 18, seasons: ["thaw", "harvest"], hours: [360, 1080], hint: "池塘，回暖和秋收的白天", desc: "回暖、秋收的白天在池塘里打窝的鲫鱼，熬汤发白。" },
  kinMinnow: { water: "river", tier: "common", name: "马口鱼", food: 14, sell: 16, hours: [360, 1080], w: 6, hint: "溪谷的河，白天", desc: "溪谷河里成群的小鱼，嘴大，咬钩又急又猛。" },
  kinYellowCat: { water: "river", tier: "common", name: "黄辣丁", food: 18, sell: 24, hours: [1020, 360], w: 5, hint: "溪谷的河，傍晚到天亮", desc: "傍晚以后才出来的小鲇鱼，背上的刺扎手。" },
  kinCulter: { water: "river", tier: "uncommon", name: "翘嘴", food: 22, sell: 42, seasons: ["heat"], hours: [300, 600], w: 3, hint: "溪谷的河，酷暑时节的清早", desc: "酷暑清早追着小鱼打水花的翘嘴，力气大。" },
  kinIceCat: { water: "river", tier: "uncommon", name: "冰河鲇", food: 26, sell: 40, seasons: ["cold"], w: 3, hint: "溪谷的河，寒潮时节", desc: "寒潮时节沉在河底的大鲇鱼，肉厚。" },
  kinMandarin: { water: "river", tier: "rare", name: "鳜鱼", food: 30, sell: 85, seasons: ["harvest"], w: 2, hint: "溪谷的河，秋收时节", desc: "秋收时节的鳜鱼，花纹像落叶，最难钓的那种。" },
  kinTwinCat: { water: "river", tier: "rare", name: "双头鲇", food: 0, sell: 0, rain: true, w: 2, mutant: true, hint: "溪谷的河，下雨天（变异）", desc: "上游的污水养出来的怪鱼，两张嘴一起动。拿给许医生研究。" },
  kinSeabass: { water: "sea", tier: "common", name: "海鲈", food: 22, sell: 30, hours: [300, 1140], w: 6, hint: "沉湾的海，白天", desc: "码头边最常见的海鲈，肉细。" },
  kinPomfret: { water: "sea", tier: "common", name: "鲳鱼", food: 22, sell: 34, seasons: ["heat", "harvest"], w: 5, hint: "沉湾的海，酷暑和秋收时节", desc: "扁扁的银色鲳鱼，一网一网都是。" },
  kinCroaker: { water: "sea", tier: "uncommon", name: "黄鱼", food: 24, sell: 48, seasons: ["thaw", "harvest"], w: 3, hint: "沉湾的海，回暖和秋收时节", desc: "金黄的黄鱼，咕咕叫着上钩。" },
  kinHairtail: { water: "sea", tier: "uncommon", name: "带鱼", food: 24, sell: 46, hours: [1080, 360], w: 3, hint: "沉湾的海，夜里", desc: "夜里贴着水面游过来的带鱼，像一条银带子。" },
  kinGrouper: { water: "sea", tier: "rare", name: "石斑", food: 34, sell: 110, w: 2, hint: "沉湾的海，什么时候都可能有", desc: "藏在沉船边的石斑，一条够全营吃一顿。" },
  kinGlowEel: { water: "sea", tier: "rare", name: "荧光鳗", food: 0, sell: 0, hours: [1140, 300], w: 2, mutant: true, hint: "沉湾的海，深夜（变异）", desc: "漏油的海里长出来的鳗，在桶里一闪一闪地发光。拿给许医生研究。" },
  kinBitterling: { water: "canal", tier: "common", name: "鳑鲏", food: 10, sell: 12, w: 6, hint: "农场水渠，什么时候都有", desc: "巴掌长的小鱼，鳞片泛着彩光。" },
  kinCarp: { water: "canal", tier: "common", name: "鲤鱼", food: 22, sell: 26, w: 5, hint: "农场水渠，什么时候都有", desc: "顺着水渠游进来的鲤鱼，红尾巴。" },
  kinShrimp: { water: "canal", tier: "common", name: "河虾", food: 12, sell: 20, seasons: ["thaw", "heat"], w: 4, hint: "农场水渠，回暖和酷暑时节", desc: "水草里一抓一把的河虾，炒着吃。" },
  kinGrass: { water: "canal", tier: "uncommon", name: "草鱼", food: 28, sell: 38, seasons: ["heat", "harvest"], hours: [360, 1080], w: 3, hint: "农场水渠，酷暑和秋收的白天", desc: "啃水草的草鱼，一条能有好几斤。" },
  kinEel: { water: "canal", tier: "uncommon", name: "黄鳝", food: 26, sell: 44, rainOrNight: true, w: 3, hint: "农场水渠，下雨天或夜里", desc: "下雨天钻出泥洞的黄鳝，滑得抓不住。" },
  kinKoi: { water: "canal", tier: "rare", name: "锦鲤", food: 0, sell: 120, w: 1, hint: "农场水渠，偶尔", desc: "不知道谁家养的锦鲤，顺着水渠游进来了。养着看，不吃。" },
};
export const FISH_IDS = Object.keys(FISH);
export const NEW_FISH = FISH_IDS.filter((id) => FISH[id].name);
// 防水包：钓上来一条之后偶尔还挂着一个
export const BAG = {
  chance: 0.04,
  loot: [
    [{ ammo: 6 }, 20],
    [{ parts: 2 }, 18],
    [{ cloth: 2 }, 14],
    [{ bandage: 2 }, 14],
    [{ circuit: 1 }, 10],
    [{ seedMystery: 1 }, 10],
    ["decor", 8],
    ["keepsake", 6],
  ],
};
// 河和海的水：许医生验过水样才敢吃；第一次在那儿钓上鱼，顺手装一瓶水样
export const SAMPLES = { river: "kinSampleRiver", sea: "kinSampleSea" };

// ================= 商队的稀罕货 =================
export const RARE_SLOT = { keepsake: 120, decor: 40, seeds: 45, seedN: 4, w: { keepsake: 45, decor: 25, seeds: 30 } };

// ================= 物品 =================
const put = (id, def) => {
  if (!ITEMS[id]) ITEMS[id] = def;
};
for (const [id, k] of Object.entries(KEEPSAKES)) put(id, { name: k.name, type: "resource", sell: k.sell, keepsake: true, desc: k.desc + "（稀罕物：好些人最爱这种东西）" });
for (const id of NEW_FISH) {
  const f = FISH[id];
  if (f.mutant) put(id, { name: f.name, type: "resource", sell: 0, protected: true, fish: true, desc: f.desc });
  else if (!f.food) put(id, { name: f.name, type: "resource", sell: f.sell, fish: true, desc: f.desc });
  else put(id, { name: f.name, type: "food", food: f.food, heal: Math.round(f.food / 4), sell: f.sell, buy: Math.round(f.sell * 2.2), fish: true, desc: f.desc });
}
put("kinSampleRiver", { name: "溪谷的水样", type: "resource", sell: 0, protected: true, desc: "从溪谷的河里灌的一瓶水。拿给许医生验，验过了那里钓的鱼才敢吃。" });
put("kinSampleSea", { name: "沉湾的水样", type: "resource", sell: 0, protected: true, desc: "从沉湾的海里灌的一瓶水，水面有一层油花。拿给许医生验。" });
put("kinRing", { name: "铁丝戒指", type: "resource", sell: 0, handmade: true, desc: "铁丝一圈圈编的戒指，亲手做的。送给想一起过日子的人。" });
put("kinRadio", { name: "修好的旧收音机", type: "resource", sell: 0, handmade: true, desc: "拆了三台旧收音机拼起来的一台，能收到雨巷的电台。亲手做的。" });
put(BREAKFAST, { name: "热早饭", type: "food", food: 45, heal: 8, sell: 0, desc: "搭伙的人一早给你留的饭，还冒着热气。" });

// ================= 配方 =================
const recipe = (r) => {
  if (!RECIPES.some((x) => x.id === r.id)) RECIPES.push(r);
};
recipe({ id: "kinRing", out: { kinRing: 1 }, cost: { scrap: 2, parts: 1 }, station: "workbench", desc: ITEMS.kinRing.desc });
recipe({ id: "kinRadio", out: { kinRadio: 1 }, cost: { parts: 2, circuit: 1, scrap: 2 }, station: "workbench", desc: ITEMS.kinRadio.desc });

// ================= 小图 =================
const A = PAL.ash,
  So = PAL.soil,
  E = PAL.ember,
  St = PAL.straw,
  L = PAL.leaf,
  W = PAL.water,
  Sn = PAL.snow,
  Ro = PAL.stone,
  R = PAL.rust,
  N = PAL.night,
  Cl = PAL.cloth;
function fishIcon(P, body, belly, tail, fin = null, eye = A[0], long = false) {
  if (long) {
    P.ellipse(8, 9, 6.5, 2, body);
    P.ellipse(8, 10, 5, 0.9, belly);
    P.poly([[14, 9], [16, 7], [16, 11]], tail);
    P.set(3, 8, eye);
    return;
  }
  P.ellipse(7, 9, 5.5, 3, body);
  P.ellipse(7, 10, 4, 1.4, belly);
  P.poly([[12, 9], [15, 6], [15, 12]], tail);
  P.poly([[6, 6], [9, 4], [10, 7]], fin || tail);
  P.set(4, 8, eye);
  P.set(3, 8, Sn[4]);
}
const FISH_DRAW = {
  kinCrucian: (P) => fishIcon(P, Ro[3], Sn[2], Ro[2]),
  kinMinnow: (P) => {
    fishIcon(P, W[4], Sn[3], W[3], E[3]);
    P.hline(4, 10, 9, E[3]);
  },
  kinYellowCat: (P) => {
    fishIcon(P, St[1], St[3], So[2], So[3]);
    P.line(2, 8, 0, 6, St[2]);
    P.line(2, 9, 0, 11, St[2]);
  },
  kinCulter: (P) => {
    fishIcon(P, Sn[2], Sn[4], Ro[3], Ro[3], A[0], true);
    P.line(2, 8, 4, 7, Ro[2]);
  },
  kinIceCat: (P) => {
    fishIcon(P, N[3], Sn[2], N[2], N[2]);
    P.set(2, 9, Sn[4]);
    P.line(2, 9, 0, 11, Sn[3]);
  },
  kinMandarin: (P) => {
    fishIcon(P, L[3], St[3], L[2], L[2]);
    for (const [x, y] of [[5, 8], [8, 9], [10, 8], [6, 10]]) P.set(x, y, So[1]);
  },
  kinTwinCat: (P) => {
    fishIcon(P, L[2], L[4], L[1], L[1]);
    P.ellipse(3, 7, 2, 1.5, L[2]);
    P.set(2, 6, E[5]);
    P.set(4, 8, E[5]);
  },
  kinSeabass: (P) => fishIcon(P, Ro[4], Sn[4], Ro[3], Ro[2]),
  kinPomfret: (P) => {
    P.disc(8, 9, 4.5, Sn[2]);
    P.disc(8, 9, 3, Sn[3]);
    P.poly([[12, 9], [15, 6], [15, 12]], Ro[4]);
    P.set(5, 8, A[0]);
  },
  kinCroaker: (P) => fishIcon(P, E[4], E[5], E[3], E[3]),
  kinHairtail: (P) => {
    P.line(1, 11, 15, 6, Sn[3]);
    P.line(1, 12, 15, 7, Sn[4]);
    P.line(2, 12, 14, 8, Sn[2]);
    P.set(2, 11, A[0]);
  },
  kinGrouper: (P) => {
    fishIcon(P, R[2], R[3], R[1], R[1]);
    for (const [x, y] of [[5, 8], [7, 10], [9, 8], [10, 10]]) P.set(x, y, St[3]);
  },
  kinGlowEel: (P) => {
    P.line(1, 12, 14, 6, N[2]);
    P.line(2, 12, 15, 7, N[3]);
    for (const [x, y] of [[4, 11], [8, 9], [12, 7]]) P.set(x, y, "#b6ffd8");
    P.set(14, 6, E[5]);
  },
  kinBitterling: (P) => {
    P.ellipse(7, 9, 4, 2.5, W[4]);
    P.ellipse(7, 10, 3, 1, Cl[2]);
    P.poly([[11, 9], [13, 7], [13, 11]], W[3]);
    P.set(5, 8, A[0]);
  },
  kinCarp: (P) => {
    fishIcon(P, St[2], St[3], Cl[1], St[1]);
    P.line(3, 9, 1, 10, St[1]);
  },
  kinShrimp: (P) => {
    for (let i = 0; i < 5; i++) P.disc(5 + i * 2, 9 - Math.abs(i - 2), 1.6, i % 2 ? E[3] : E[4]);
    P.line(4, 9, 1, 6, E[4]);
    P.line(4, 9, 1, 8, E[4]);
  },
  kinGrass: (P) => fishIcon(P, L[3], St[3], L[2], L[2]),
  kinEel: (P) => {
    P.line(1, 10, 6, 7, So[2]);
    P.line(6, 7, 11, 11, So[2]);
    P.line(11, 11, 15, 8, So[2]);
    P.line(1, 11, 6, 8, St[1]);
    P.set(1, 10, A[0]);
  },
  kinKoi: (P) => {
    fishIcon(P, Sn[4], Sn[3], Cl[1], Cl[1]);
    P.disc(6, 8, 1.6, Cl[1]);
    P.disc(9, 9, 1.4, E[4]);
  },
};
for (const [id, fn] of Object.entries(FISH_DRAW)) ICON_DRAW[id] ??= fn;
Object.assign(ICON_DRAW, {
  kinSeedTin: (P) => {
    P.rect(4, 4, 8, 10, Ro[3]);
    P.rect(4, 4, 8, 2, Ro[4]);
    P.rect(5, 7, 6, 4, St[3]);
    P.set(7, 9, So[2]);
    P.set(9, 8, L[3]);
  },
  kinSteth: (P) => {
    P.line(4, 3, 4, 8, A[1]);
    P.line(11, 3, 11, 8, A[1]);
    P.line(4, 8, 8, 11, A[1]);
    P.line(11, 8, 8, 11, A[1]);
    P.disc(8, 13, 2, Ro[4]);
    P.set(8, 13, Sn[4]);
  },
  kinCaliper: (P) => {
    P.rect(2, 7, 12, 2, Ro[4]);
    P.rect(3, 4, 2, 8, Ro[3]);
    P.rect(9, 4, 2, 5, Ro[3]);
    for (let x = 4; x < 14; x += 2) P.set(x, 8, A[1]);
  },
  kinHooks: (P) => {
    P.rect(3, 6, 10, 7, L[2]);
    P.rect(3, 6, 10, 2, L[3]);
    P.set(7, 9, St[3]);
    P.line(6, 10, 6, 12, Ro[4]);
    P.line(9, 10, 9, 12, Ro[4]);
  },
  kinGlasses: (P) => {
    P.disc(5, 9, 2.6, A[1]);
    P.disc(11, 9, 2.6, A[1]);
    P.disc(5, 9, 1.6, W[5]);
    P.disc(11, 9, 1.6, W[5]);
    P.hline(7, 9, 8, A[1]);
    P.rect(2, 8, 1, 2, Sn[4]);
  },
  kinStrings: (P) => {
    P.disc(8, 9, 5, St[2]);
    P.disc(8, 9, 3.5, St[3]);
    P.disc(8, 9, 2, Ro[4]);
    P.set(8, 9, Ro[3]);
  },
  kinCleaver: (P) => {
    P.rect(3, 4, 9, 7, Ro[4]);
    P.hline(3, 11, 10, Sn[4]);
    P.rect(11, 6, 4, 3, So[2]);
    P.set(5, 6, Ro[2]);
  },
  kinBoard: (P) => {
    P.rect(2, 4, 12, 9, L[1]);
    P.hline(3, 12, 6, St[2]);
    P.hline(3, 12, 10, St[2]);
    P.rect(5, 7, 3, 2, A[1]);
    P.rect(9, 7, 3, 2, A[1]);
    P.rect(2, 4, 2, 9, W[4]);
  },
  kinTea: (P) => {
    P.rect(3, 5, 10, 8, So[2]);
    P.rect(4, 6, 8, 6, So[1]);
    P.set(6, 8, St[2]);
    P.set(9, 10, St[2]);
  },
  kinBattery: (P) => {
    P.rect(5, 4, 6, 10, A[2]);
    P.rect(5, 6, 6, 6, E[3]);
    P.rect(7, 3, 2, 1, Ro[4]);
  },
  kinCandy: (P) => {
    for (const [x, y, c] of [[5, 7, Cl[2]], [10, 8, E[4]], [7, 11, L[4]]]) {
      P.ellipse(x, y, 2, 1.4, c);
      P.set(x - 3, y, Sn[4]);
      P.set(x + 3, y, Sn[4]);
    }
  },
  kinSampleRiver: (P) => {
    P.rect(5, 4, 6, 10, Sn[3]);
    P.rect(6, 7, 4, 6, L[3]);
    P.rect(6, 3, 4, 1, So[2]);
  },
  kinSampleSea: (P) => {
    P.rect(5, 4, 6, 10, Sn[3]);
    P.rect(6, 7, 4, 6, W[2]);
    P.hline(6, 9, 7, A[1]);
    P.rect(6, 3, 4, 1, So[2]);
  },
  kinRing: (P) => {
    P.disc(8, 9, 4.5, Ro[3]);
    P.disc(8, 9, 2.6, A[1]);
    P.set(8, 4, Ro[5]);
    P.set(5, 7, Ro[5]);
  },
  kinRadio: (P) => {
    P.rect(2, 6, 12, 8, So[2]);
    P.disc(6, 10, 2, A[1]);
    P.rect(9, 8, 4, 1, St[3]);
    P.rect(9, 11, 4, 1, St[3]);
    P.line(11, 6, 14, 2, Ro[4]);
  },
  kinBreakfast: (P) => {
    P.ellipse(8, 11, 6, 3, Sn[3]);
    P.ellipse(8, 10, 4.5, 1.6, St[3]);
    P.set(6, 9, E[4]);
    P.set(10, 9, L[4]);
    P.vline(6, 4, 6, Sn[4]);
    P.vline(10, 3, 5, Sn[4]);
  },
});
