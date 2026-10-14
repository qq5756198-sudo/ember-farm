// v0.29.0「四时」：星露谷 30 个好玩点移植方案第一版（节奏、季节与土地）的数据。
// 判定写在 almanac.js；这里只放文案、数值、新物品和它们的小图。
// 1. 四个时节：28 天一年，每 7 天一个时节，正好各以一种节庆收尾；当季作物长势 +15%、每收一次多 1 份，反季长势 −15%，不枯死。
//    天气按时节排（回暖雨多、酷暑高温多），寒潮固定落在寒潮时节。
// 2. 早间广播：07:00 电台加明天的天气和老琴的「手气签」（大吉 / 吉 / 平 / 凶，真的影响搜柜子、钓鱼、撬锁和商队）；
//    每个时节第一天何大勺讲一道当季菜，听过就学会。
// 3. 雨天：废墟里感染者听觉降两成、撬锁的声音只传一半远；下了一天雨，当晚营地的动静到了线也有三成半机会被雨声盖住；
//    雨后冒蘑菇；池塘有雨鳅；居民雨天做手工快一成。
// 4. 上品：当季、照料分 70 以上收成是优质时，那一份有 1/4 的机会是上品（这一茬施过提质肥是 45%），卖价是普通的 2.2 倍。
// 5. 腌缸和土酒坛：放得越久越值钱，寒潮时节缸里的就是口粮；土酒能换消毒绷带。
// 6. 牲口亲近：鸡群和山羊各 0–5 级，摸一摸、按时喂、放出去吃虫都加；亲近高多下蛋，动静大的晚上会受惊。
// 7. 老果园嫁接：废弃居民区里没人管的老果树剪枝条，回农场嫁接，14 天长成，在它的时节天天结果，熬过一个寒潮好一档。
// 8. 旧物摆件：柜子里多一类好看的旧东西，摆在营地：屋里算一类家具，屋外大家心情好一点。
// 9. 野物：按时节刷在农场边和三张废墟的空地上；雨后的蘑菇有两种有毒，要许医生认过。
// 10. 夜里的好事：平安的晚上约 4% 的机会出一件（卫星残骸、候鸟、陌生人的包裹、远方电台报坐标）。
// 11. 油灯下念账：睡一觉醒来，账本在屏幕上停 3 秒（不算弹窗，点一下就收起，全文进消息记录）。
import { ITEMS, BUILDINGS, CROPS, RECIPES } from "./data.js";
import { WEATHER } from "./expansion-data.js";
import { PAL } from "./pixel-kit.js";
import { CROP as CROP_ICON, BADGE, DRAW as ICON_DRAW, assignItemIcons } from "./item-sprites.js";
import { CARD_TYPES } from "./tidy-data.js";
import { COMFORT, COMFORT_CATS, FEST_PICK } from "./bustle-data.js";

export const ALMANAC_SCHEMA = 1;

// ================= 四个时节 =================
export const YEAR = 28;
export const SEASON_DAYS = 7;
// fest：这个时节最后一天的节庆（第 7、14、21、28 天依次是换种集、灯火夜、丰收评比、守夜纪念日）
// tint：天色乘上的一层（很淡）；hint：日历和告示牌上的一句话
export const SEASONS = [
  { id: "thaw", name: "回暖", fest: "seeds", tint: [0.95, 1.04, 0.97], hint: "雨水多，土软了，适合种土豆和药草；路边冒荠菜和马齿苋。" },
  { id: "heat", name: "酷暑", fest: "lanterns", tint: [1.06, 1.02, 0.9], hint: "热浪和虫多，水最紧；番茄、豆子、棉花长得最好，野莓熟了。" },
  { id: "harvest", name: "秋收", fest: "harvest", tint: [1.08, 0.98, 0.86], hint: "收成的时节：萝卜、玉米、南瓜长得最好；尸群开始迁徙，栗子和野枣落了一地。" },
  { id: "cold", name: "寒潮", fest: "vigil", tint: [0.9, 0.96, 1.1], hint: "寒潮固定落在这一周，温室外的田几乎不长；黑麦和冬土豆耐冻，缸里存的就是口粮。" },
];
export const SEASON_IDS = SEASONS.map((s) => s.id);
export const SEASON_BY_ID = Object.fromEntries(SEASONS.map((s) => [s.id, s]));
export const yearOf = (day) => Math.floor((Math.max(1, day) - 1) / YEAR) + 1;
export const seasonIndex = (day) => Math.floor(((Math.max(1, day) - 1) % YEAR) / SEASON_DAYS);
export const seasonOf = (day) => SEASONS[seasonIndex(day)];
export const seasonDay = (day) => ((Math.max(1, day) - 1) % SEASON_DAYS) + 1;
// 下一个时节从哪天开始
export const nextSeasonDay = (day) => day - seasonDay(day) + SEASON_DAYS + 1;
// 寒潮从寒潮时节第 1 天开始（一年的第 22 天）
export const COLD_START = 22;
export const coldStartFrom = (day) => {
  const off = (((day - 1) % YEAR) + YEAR) % YEAR;
  return day + ((COLD_START - 1 - off + YEAR) % YEAR);
};

// 每种作物喜欢的时节和怕的时节：当季长势 +15%，反季 −15%（温室里的田不吃反季的亏）
export const CROP_SEASON = {
  radish: ["harvest", "heat"],
  potato: ["thaw", "heat"],
  tomato: ["heat", "cold"],
  bean: ["heat", "cold"],
  corn: ["harvest", "cold"],
  pumpkin: ["harvest", "thaw"],
  herb: ["thaw", "cold"],
  cotton: ["heat", "thaw"],
  rye: ["cold", "heat"],
  goldRadish: ["harvest", "heat"],
  winterPotato: ["cold", "heat"],
  glowBean: ["heat", "cold"],
};
export const SEASON_RATE = { good: 1.15, bad: 0.85 };
// 当季的菜每收一次多 1 份（一天去田里两趟，光长得快常常赶不上下一趟，多收的这一份才是按时节种的甜头）
export const SEASON_EXTRA = 1;

// 天气按时节排：每个时节 7 天里各种天气的天数（一年 28 天：晴 11、小雨 8、暴雨 2、酸雨 4、高温 3）。
// 一年的平均长势和原来的 8 天一轮差不到 2%。前三天照旧是 晴、晴、小雨（新档开局不变）。
export const SEASON_WEATHER = {
  thaw: { 晴朗: 2, 小雨: 3, 暴雨: 1, 酸雨: 1 },
  heat: { 晴朗: 1, 小雨: 1, 暴雨: 1, 酸雨: 1, 高温: 3 },
  harvest: { 晴朗: 4, 小雨: 2, 酸雨: 1 },
  cold: { 晴朗: 4, 小雨: 2, 酸雨: 1 },
};
const lcg = (seed) => {
  let x = seed >>> 0 || 1;
  return () => {
    x = (Math.imul(x, 1664525) + 1013904223) >>> 0;
    return x / 4294967296;
  };
};
// 排四年（112 天），之后循环。同一个时节里打乱，连着的坏天气不超过两天。
export function buildWeather(years = 4) {
  const out = [];
  for (let y = 0; y < years; y++)
    for (const s of SEASONS) {
      const r = lcg(9173 + y * 131 + SEASON_IDS.indexOf(s.id) * 17);
      let best = null;
      for (let tries = 0; tries < 40; tries++) {
        const bag = Object.entries(SEASON_WEATHER[s.id]).flatMap(([w, n]) => Array(n).fill(w));
        for (let i = bag.length - 1; i > 0; i--) {
          const j = Math.floor(r() * (i + 1));
          [bag[i], bag[j]] = [bag[j], bag[i]];
        }
        const bad = (w) => w === "暴雨" || w === "酸雨";
        const ok = bag.every((w, i) => !(bad(w) && bad(bag[i + 1] || "") && bad(bag[i + 2] || "")));
        best = bag;
        if (ok) break;
      }
      out.push(...best);
    }
  // 新档前三天和原来一样
  const head = ["晴朗", "晴朗", "小雨"];
  for (let i = 0; i < 3; i++) {
    const at = out.indexOf(head[i], i);
    if (at > i && at < SEASON_DAYS) [out[i], out[at]] = [out[at], out[i]];
    else out[i] = head[i];
  }
  return out;
}
export const WEATHER_PLAN = buildWeather();
// 原来的 8 天一轮换成按时节排的一张表（weatherFor、预报、气象站都读这张表）
WEATHER.splice(0, WEATHER.length, ...WEATHER_PLAN);
export const RAINY = ["小雨", "暴雨"];

// ================= 早间广播：手气签 =================
// extra：废墟柜子“再抽一样”的机会；fish：池塘稀有鱼的倍数；pry：撬锁要的时间；fake：商队混进假货多几成
export const LUCK = [
  { id: "great", name: "大吉", p: 0.15, extra: 0.45, fish: 2, pry: 1, fake: 0, line: "老琴抽了支上上签：今天手气旺，柜子里多翻一样的机会大，池塘的稀有鱼也爱咬钩。", tone: "gold" },
  { id: "good", name: "吉", p: 0.35, extra: 0.35, fish: 1, pry: 1, fake: 0, line: "老琴抽了支吉签：今天柜子里多翻一样的机会大一点。", tone: "gold" },
  { id: "plain", name: "平", p: 0.35, extra: 0.3, fish: 1, pry: 1, fake: 0, line: "老琴抽了支平签：照常过。", tone: "normal" },
  { id: "bad", name: "凶", p: 0.15, extra: 0.25, fish: 1, pry: 1.2, fake: 0.1, line: "老琴抽了支下签：今天撬锁手生、慢两成，唐九的货也多看两眼。", tone: "warn" },
];
export const LUCK_BY_ID = Object.fromEntries(LUCK.map((l) => [l.id, l]));
export const BASE_EXTRA = 0.3; // 原来“再抽一样”的机会

// ================= 雨天 =================
export const RAIN = {
  hear: 0.8, // 废墟里感染者听到的距离
  pry: 0.5, // 撬锁、拆东西的声音传多远
  // 下了一天雨：当晚动静到了 4 也有这么多的机会被雨声盖住，感染者不来（方案写“动静少 1”：动静是一档一档涨的，
  // 少 1 正好把 4 点多的那些晚上全挡掉，雨夜的场数少了一半多；按机会算，台上雨夜少 24–31%，落在方案的 20–40%）
  mask: 0.35,
  craft: 1.1, // 居民雨天做手工快一成
  loach: 0.35, // 雨天池塘咬钩的有这么多是雨鳅
};
export const PRY_NOISE = 420; // undertow 撬锁的声音半径（用来认出是撬锁的声音）

// ================= 上品 =================
// 当季、照料分 care 以上、收成是优质：那一份优质有 chance 的机会换成上品，这一茬施过提质肥是 fert。
// （方案原来写“照料分 95 以上、当季、施过肥”；一天就熟的菜照料分只攒到 60–89，勤快玩家也碰不到 95，台上测出来是 0%。）
export const PRIME = { care: 70, chance: 0.25, fert: 0.45, sell: 2.2 };
export const PRIME_CROPS = Object.keys(CROPS).filter((id) => id !== "hybrid" && ITEMS[id]);

// ================= 腌缸和土酒坛 =================
// 一缸一批：装 4 份同一种东西；ready 天后能取（普通），aged 天后变成陈的（更值钱）。
export const JARS = {
  alPickleJar: {
    name: "腌缸",
    take: 4,
    inputs: ["radish", "potato", "bean", "alShepherd", "alPurslane"],
    out: "alPickle",
    aged: "alPickleOld",
    n: 4,
    ready: 3,
    agedDays: 7,
    verb: "腌",
  },
  alWineJar: {
    name: "土酒坛",
    take: 4,
    inputs: ["rye", "corn", "alMulberry", "alPeach", "alApple", "alPersimmon", "alJujube"],
    out: "alWine",
    aged: "alWineAged",
    n: 2,
    ready: 4,
    agedDays: 10,
    verb: "酿",
  },
};
export const JAR_TYPES = Object.keys(JARS);

// ================= 牲口亲近 =================
// 0–100 分，每 20 分一级（0–5 级）。鸡群：摸一摸 +6、当天喂过 +4、当天放出去吃虫 +2；山羊：梳毛 +6、喂过 +4。
// 一天没人摸 −5。鸡群每一级让那一回多下一枚蛋的机会 +12%（5 级 60%）；山羊 4 级起有机会多出一份奶（4 级 15%、5 级 30%）。
// 一天产一回（鸡蛋 2、羊奶 1），照顾好的鸡舍一个月下来多出两到三成。循声来的感染者、夜袭摸进农场那一晚受惊：第二天那一回不产、−10。
export const HERD = { pet: 6, fed: 4, out: 2, decay: 5, per: 20, max: 100, eggPer: 0.12, milkFrom: 4, milkPer: 0.15, spook: 10 };
export const HERD_NAMES = { flock: "鸡群", goat: "山羊" };

// ================= 老果园嫁接 =================
// 废弃居民区里四棵没人管的老果树（院墙外、路边的草地上）：剪一根枝条（每棵 7 天一次），回农场和 2 份木材、1 份鸡粪一起嫁接。
// 14 天长成；在它的时节每天早上结 1 个，树上最多挂 3 个；每熬过一场寒潮果子好一档（优质、上品）。
// 夜里被感染者摸进农场（循声来的、夜袭）时，每棵树两成五机会被折断枝条，停 3 天。
export const TREES = {
  mulberry: { name: "桑树", fruit: "alMulberry", season: "thaw", spot: { x: 567, y: 357 } },
  peach: { name: "桃树", fruit: "alPeach", season: "heat", spot: { x: 1410, y: 574 } },
  apple: { name: "苹果树", fruit: "alApple", season: "harvest", spot: { x: 520, y: 760 } },
  persimmon: { name: "柿子树", fruit: "alPersimmon", season: "cold", spot: { x: 1180, y: 900 } },
};
export const TREE_IDS = Object.keys(TREES);
export const TREE_RULES = { region: "residential", grow: 14, hold: 3, cut: 7, hurt: 0.25, stop: 3, cost: { wood: 2, manure: 1 } };
export const treeType = (id) => "alTree_" + id;
export const cuttingId = (id) => "alCut_" + id;

// ================= 旧物摆件 =================
// where：哪几类柜子里能翻到；art：画法的形状和颜色（见 almanac-renderer.js）
export const DECOR = [
  { id: "neon", name: "霓虹招牌", where: ["garage", "cargo", "locked"], desc: "灯管断了两截，通上电还能亮出“饭”字。" },
  { id: "chime", name: "风铃", where: ["wardrobe", "kitchen"], desc: "几片铁皮串成的，风一吹叮当响。" },
  { id: "potted", name: "盆栽", where: ["kitchen", "wardrobe"], desc: "一盆没死透的绿萝，浇点水又精神了。" },
  { id: "phono", name: "老唱机", where: ["locked", "wardrobe"], desc: "摇把还能转，唱片只剩半张。" },
  { id: "calendar", name: "旧挂历", where: ["kitchen", "wardrobe"], desc: "停在出事那年的一月，画上是一片油菜花。" },
  { id: "lantern", name: "铁皮灯笼", where: ["cargo", "garage"], desc: "罐头盒剪出来的花纹，点上蜡烛满地星星。" },
  { id: "bike", name: "旧自行车", where: ["garage"], desc: "链条锈死了，车筐里还插着一把花。" },
  { id: "tank", name: "空鱼缸", where: ["kitchen", "locked"], desc: "玻璃没碎，放两块石头也像那么回事。" },
  { id: "teddy", name: "布熊", where: ["wardrobe"], desc: "一只耳朵是后来缝上去的，针脚很认真。" },
  { id: "clock", name: "座钟", where: ["locked", "kitchen"], desc: "上了弦还能走，每到整点叮一声。" },
  { id: "globe", name: "地球仪", where: ["toolbox", "locked"], desc: "转起来吱吱响，上面的国名都还在。" },
  { id: "guitar", name: "断弦吉他", where: ["wardrobe"], desc: "只剩三根弦，老琴说能凑合弹。" },
  { id: "mailbox", name: "邮筒", where: ["cargo"], desc: "绿漆掉了一半，投信口里塞着一张没寄出的明信片。" },
  { id: "busSign", name: "公交站牌", where: ["cargo", "garage"], desc: "写着“余烬路口”，末班车 22:30。" },
  { id: "tv", name: "旧电视", where: ["garage", "locked"], desc: "屏幕是凸的，拍两下还能亮雪花。" },
  { id: "vase", name: "青花瓶", where: ["locked", "kitchen"], desc: "瓶口有个缺，插几枝干草刚好。" },
  { id: "fan", name: "台扇", where: ["garage", "toolbox"], desc: "扇叶是铁的，转起来呼呼的，夏天离不开。" },
  { id: "kite", name: "风筝", where: ["wardrobe", "cargo"], desc: "一只褪了色的燕子，尾巴还挺长。" },
  { id: "lamp", name: "绿罩台灯", where: ["toolbox", "locked"], desc: "图书馆里那种绿灯罩，灯泡居然是好的。" },
  { id: "frame", name: "相框", where: ["wardrobe", "kitchen"], desc: "照片被雨泡了，只看得出几个人在笑。" },
  { id: "cage", name: "鸟笼", where: ["cargo", "kitchen"], desc: "空的，门开着——鸟大概自己飞走了。" },
  { id: "umbrella", name: "花伞", where: ["wardrobe"], desc: "撑开是一朵大花，伞骨断了一根。" },
  { id: "cup", name: "旧奖杯", where: ["locked"], desc: "“第三届邻里拔河赛 一等奖”。" },
  { id: "lion", name: "小石狮", where: ["cargo", "locked"], desc: "原来守在谁家门口，嘴里的石球还能滚。" },
];
export const DECOR_BY_ID = Object.fromEntries(DECOR.map((d) => [d.id, d]));
export const decorItem = (id) => "alDecor_" + id;
// 柜子里翻到摆件的机会（每个柜子先照旧抽，再单独掷一次）
export const DECOR_RULES = { chance: 0.08, locked: 0.16, mood: 1, moodMax: 3, outsideR: 200 };

// ================= 野物 =================
export const FORAGE = {
  thaw: ["alShepherd", "alPurslane"],
  heat: ["alBerry"],
  harvest: ["alChestnut", "alJujube"],
  cold: ["alFrostPersimmon"],
};
// 雨后第二天：蘑菇（没认过）。有毒的两种（灰盖、白伞）认出来就扔，能吃的两种（平菇、鸡枞）变成“野蘑菇”。
export const MUSHROOM = { raw: "alMushroomRaw", good: "alMushroom", spots: 2, poison: 0.4, sickMin: 24 * 60 };
// 每天刷几处；候选点：农场四边和三张废墟（放进去时再找一块能走的空地）
export const FORAGE_RULES = { min: 4, max: 8, xp: 3, keep: 1 };
export const FORAGE_SPOTS = {
  farm: [
    { x: 551, y: 135 },
    { x: 140, y: 640 },
    { x: 210, y: 900 },
    { x: 760, y: 950 },
    { x: 1380, y: 920 },
    { x: 1420, y: 520 },
    { x: 1380, y: 150 },
    { x: 1129, y: 119 },
  ],
  residential: [
    { x: 300, y: 330 },
    { x: 1143, y: 355 },
    { x: 260, y: 880 },
    { x: 1300, y: 900 },
  ],
  hospital: [
    { x: 330, y: 870 },
    { x: 150, y: 310 },
    { x: 980, y: 900 },
  ],
  warehouse: [
    { x: 300, y: 820 },
    { x: 1223, y: 815 },
    { x: 1350, y: 300 },
  ],
};

// ================= 夜里的好事 =================
export const NIGHT_GOOD = {
  chance: 0.04,
  kinds: ["debris", "birds", "parcel", "signal"],
  debris: { circuit: [1, 2], parts: [2, 3], scrap: [3, 5] },
  birds: { fert: 6, manure: 2 },
  parcels: [
    { bandage: 2, cloth: 2 },
    { salt: 1, rye: 3 },
    { parts: 2, ammo: 8 },
    { herb: 2, bread: 2 },
    { seed_radish_abundant: 2, seed_potato_early: 2 },
  ],
  door: { x: 348, y: 313 },
};

// ================= 油灯下念账 =================
export const LEDGER = { ms: 3600 };

// ================= 当季菜：何大勺在早间广播里讲 =================
export const DISHES = {
  thaw: "alDumpling",
  heat: "alColdSoup",
  harvest: "alChestnutStew",
  cold: "alPickleStew",
};

// ================= 物品 =================
const food = (name, food, sell, desc, extra = {}) => ({ name, type: "food", food, sell, desc, ...extra });
const put = (id, def) => {
  if (!ITEMS[id]) ITEMS[id] = def;
};
// 上品作物
for (const id of PRIME_CROPS) {
  const base = ITEMS[id];
  put("prime_" + id, { ...base, name: "上品" + base.name, sell: Math.round(base.sell * PRIME.sell), buy: Math.round(base.sell * 3.6), cropBase: id, desc: "当季、照顾得好的菜收成里偶尔出的上品（施过提质肥更容易），卖价是普通的 2.2 倍；丰收评比和送礼都拿得出手。" });
}
// 野物
put("alShepherd", food("荠菜", 8, 6, "回暖时节路边的野菜，包团子最香。"));
put("alPurslane", food("马齿苋", 8, 6, "回暖时节长在墙根，焯水凉拌，也能腌。"));
put("alBerry", food("野莓", 10, 9, "酷暑时节灌木丛里的小红果，酸甜。"));
put("alChestnut", food("栗子", 12, 11, "秋收时节落在树下，剥开要小心扎手。"));
put("alJujube", food("野枣", 10, 10, "秋收时节的小枣，晒干能放很久。"));
put("alFrostPersimmon", food("冻柿子", 14, 12, "寒潮时节挂在枝头冻硬的柿子，化开了像冰沙。"));
put("alMushroomRaw", food("野蘑菇（没认过）", 10, 0, "雨后冒出来的蘑菇，混着两种有毒的。没认过就吃，四成会吃坏肚子；拿给许医生认一认。", { protected: true }));
put("alMushroom", food("野蘑菇", 12, 14, "许医生认过的平菇和鸡枞，放心吃。"));
// 果子（三档）
const FRUIT = {
  alMulberry: ["桑葚", 14, 18, "回暖时节的桑葚，吃得满嘴紫。"],
  alPeach: ["桃子", 20, 26, "酷暑时节的桃子，汁多。"],
  alApple: ["苹果", 22, 28, "秋收时节的苹果，又脆又甜。"],
  alPersimmon: ["柿子", 24, 30, "寒潮时节的柿子，软了才好吃。"],
};
for (const [id, [name, f, sell, desc]] of Object.entries(FRUIT)) {
  put(id, food(name, f, sell, desc));
  put("fine_" + id, food("优质" + name, f, Math.round(sell * 1.6), "熬过一场寒潮的老树结的，个大味足。", { fruitBase: id }));
  put("prime_" + id, food("上品" + name, f + 4, Math.round(sell * PRIME.sell), "熬过两场寒潮的老树结的上品果子。", { fruitBase: id }));
}
// 枝条
for (const id of TREE_IDS)
  put(cuttingId(id), { name: TREES[id].name + "枝条", type: "resource", sell: 0, protected: true, desc: "从废弃居民区那棵老" + TREES[id].name + "上剪的，回农场和 2 份木材、1 份鸡粪一起嫁接成一棵果树。" });
// 腌菜和酒
put("alPickle", food("腌菜", 22, 16, "腌缸里放了 3 天的咸菜，寒潮里下饭全靠它。"));
put("alPickleOld", food("老坛腌菜", 26, 30, "腌缸里放了 7 天以上，酸香入味，值钱多了。"));
put("alWine", { name: "土酒", type: "resource", sell: 45, desc: "土酒坛里酿了 4 天的酒。能卖钱，守夜纪念日能和腌菜一起当供品，也能在制作台和布一起做成消毒绷带。" });
put("alWineAged", { name: "陈酿", type: "resource", sell: 90, desc: "土酒坛里放了 10 天以上的陈酿，价钱翻倍，也能当消毒的酒精用。" });
// 雨鳅
put("alLoach", food("雨鳅", 22, 30, "只在下雨天从池塘泥里钻出来的泥鳅，炖汤鲜。"));
// 当季菜
put("alDumpling", food("荠菜团子", 36, 40, "回暖时节的菜：荠菜和黑麦面捏的团子。吃了 4 个钟点走得快。", { buff: "speed" }));
put("alColdSoup", food("番茄冷汤", 34, 44, "酷暑时节的菜：番茄和野莓冰镇的冷汤。吃了 4 个钟点体力回得快。", { buff: "stamina" }));
put("alChestnutStew", food("栗子焖南瓜", 48, 60, "秋收时节的菜：栗子和南瓜焖一锅。吃了 4 个钟点挨打少两成。", { buff: "defense" }));
put("alPickleStew", food("腌菜炖土豆", 56, 58, "寒潮时节的菜：老坛腌菜炖土豆，热乎顶饱。吃了 4 个钟点慢慢回血。", { heal: 10, buff: "regen" }));
// 摆件
// 旧物不值什么钱（卖 6 金），摆着好看：一年里搜废墟拿到的总价值和 v0.28 差不到 5%
for (const d of DECOR) put(decorItem(d.id), { name: d.name, type: "resource", sell: 6, decor: d.id, desc: d.desc + "（旧物摆件：在建设里选「旧物摆件」摆出来）" });

// ================= 配方 =================
const recipe = (r) => {
  if (!RECIPES.some((x) => x.id === r.id)) RECIPES.push(r);
};
recipe({ id: "alDumpling", out: { alDumpling: 2 }, cost: { alShepherd: 2, rye: 1 }, station: "cook", minutes: 25, desc: ITEMS.alDumpling.desc });
recipe({ id: "alColdSoup", out: { alColdSoup: 2 }, cost: { tomato: 2, alBerry: 1 }, station: "cook", minutes: 20, desc: ITEMS.alColdSoup.desc });
recipe({ id: "alChestnutStew", out: { alChestnutStew: 2 }, cost: { alChestnut: 2, pumpkin: 1 }, station: "cook", minutes: 35, desc: ITEMS.alChestnutStew.desc });
recipe({ id: "alPickleStew", out: { alPickleStew: 2 }, cost: { alPickle: 1, potato: 2 }, station: "cook", minutes: 35, desc: ITEMS.alPickleStew.desc });
recipe({ id: "alSpiritBandage", out: { bandage: 3 }, cost: { alWine: 1, cloth: 1 }, station: "workbench", minutes: 15, desc: "土酒当酒精，消过毒的布条：一份土酒、一份布做 3 条绷带。" });
export const DISH_IDS = Object.values(DISHES);
// 守夜纪念日（寒潮时节收尾的节庆）多一样供品：缸里的腌菜和土酒（最好的一档）
if (FEST_PICK.vigil && !FEST_PICK.vigil.some((o) => o.id === "alJar")) FEST_PICK.vigil.push({ id: "alJar", name: "腌菜 2、土酒 1", cost: { alPickle: 2, alWine: 1 }, tier: 3 });

// ================= 新建筑 =================
const build = (id, def) => {
  if (!BUILDINGS[id]) BUILDINGS[id] = def;
};
build("alPickleJar", { name: "腌缸", icon: 40, cost: { stone: 4, wood: 2 }, w: 26, h: 26, hp: 100, desc: "装 4 份萝卜、土豆、豆子或野菜，3 天后取出腌菜，放到 7 天就成老坛腌菜（贵将近一倍）。寒潮时节田里不长，缸里存的就是口粮。" });
build("alWineJar", { name: "土酒坛", icon: 40, cost: { stone: 3, wood: 3 }, w: 26, h: 28, hp: 100, desc: "装 4 份黑麦、玉米、果子或野枣，4 天后取出 2 份土酒，放到 10 天就成陈酿（价钱翻倍）。土酒能做消毒绷带。" });
for (const id of TREE_IDS)
  build(treeType(id), {
    name: "嫁接" + TREES[id].name,
    icon: 40,
    cost: { [cuttingId(id)]: 1, ...TREE_RULES.cost },
    w: 34,
    h: 30,
    hp: 120,
    desc: "老" + TREES[id].name + "的枝条嫁接的，14 天长成，" + SEASON_BY_ID[TREES[id].season].name + "时节每天结一个" + ITEMS[TREES[id].fruit].name + "（树上最多挂 3 个，按 E 摘）。每熬过一场寒潮果子好一档。",
  });
build("alDecor", { name: "旧物摆件", icon: 40, cost: {}, w: 24, h: 24, hp: 60, retired: true, desc: "从废墟柜子里翻出来的旧东西，摆在营地里：放在房间地板边算一类家具（舒适度 +1），摆在屋外大家心情好一点（同种不叠）。在下面挑一件摆出来。" });
export const AL_BUILD_TYPES = ["alPickleJar", "alWineJar", ...TREE_IDS.map(treeType), "alDecor"];
// 按 E 打开自己的一页
for (const t of AL_BUILD_TYPES) if (!CARD_TYPES.includes(t)) CARD_TYPES.push(t);
// 摆件进屋算一类家具（舒适度最多 9）
if (!COMFORT.cats.alDecor) {
  COMFORT.cats.alDecor = "摆件";
  COMFORT_CATS.push("alDecor");
  COMFORT.max = Math.max(COMFORT.max, COMFORT_CATS.length);
}

// ================= 小图 =================
const So = PAL.soil,
  E = PAL.ember,
  St = PAL.straw,
  L = PAL.leaf,
  W = PAL.water,
  Sn = PAL.snow,
  Ro = PAL.stone,
  R = PAL.rust,
  Cl = PAL.cloth,
  N = PAL.night;
// 上品：金星外面再加一圈红
BADGE.prime ??= (P) => {
  P.rect(10, 9, 6, 7, E[1]);
  P.hline(11, 15, 12, E[5]);
  P.vline(13, 10, 14, E[5]);
  P.set(13, 12, "#fff6d0");
  P.set(11, 10, E[4]);
  P.set(15, 10, E[4]);
};
for (const id of PRIME_CROPS) {
  const base = ICON_DRAW[id];
  if (!ICON_DRAW["prime_" + id])
    ICON_DRAW["prime_" + id] = (P) => {
      if (base) base(P);
      else CROP_ICON[id]?.(P);
      BADGE.prime(P);
    };
}
const leaf = (P, x, y) => {
  P.set(x, y, L[4]);
  P.set(x + 1, y - 1, L[5]);
  P.set(x + 1, y, L[3]);
};
const fruitIcon = {
  alMulberry: (P) => {
    for (const [x, y] of [[6, 7], [8, 7], [7, 9], [9, 9], [7, 11], [9, 11], [8, 13]]) {
      P.disc(x, y, 1.3, N[1]);
      P.set(x, y - 1, Cl[1]);
    }
    leaf(P, 8, 4);
  },
  alPeach: (P) => {
    P.disc(8, 9, 4.5, E[4]);
    P.disc(7, 8, 2.5, E[5]);
    P.vline(8, 5, 13, E[3]);
    leaf(P, 9, 4);
  },
  alApple: (P) => {
    P.disc(8, 9, 4.6, Cl[1]);
    P.disc(6, 8, 1.6, Cl[2]);
    P.vline(8, 3, 5, So[2]);
    leaf(P, 9, 4);
  },
  alPersimmon: (P) => {
    P.ellipse(8, 10, 5, 4, E[3]);
    P.disc(6, 9, 1.6, E[4]);
    P.rect(6, 5, 5, 2, L[3]);
    P.set(8, 4, So[1]);
  },
};
for (const [id, fn] of Object.entries(fruitIcon)) {
  ICON_DRAW[id] ??= fn;
  ICON_DRAW["fine_" + id] ??= (P) => {
    fn(P);
    BADGE.fine(P);
  };
  ICON_DRAW["prime_" + id] ??= (P) => {
    fn(P);
    BADGE.prime(P);
  };
}
// 枝条：一截带芽的树枝，缠着布条，右下角一颗这种果子的颜色
const CUT_DOT = { mulberry: N[1], peach: E[4], apple: Cl[1], persimmon: E[3] };
for (const id of TREE_IDS)
  ICON_DRAW[cuttingId(id)] ??= (P) => {
    P.line(3, 13, 12, 4, So[2]);
    P.line(4, 13, 13, 4, So[3]);
    P.set(8, 8, L[4]);
    P.set(10, 6, L[5]);
    P.rect(5, 10, 3, 2, Sn[3]);
    P.disc(12, 12, 1.6, CUT_DOT[id]);
  };
Object.assign(ICON_DRAW, {
  alShepherd: (P) => {
    P.vline(8, 5, 14, L[2]);
    for (const [x, y] of [[5, 9], [11, 9], [6, 12], [10, 12], [7, 7], [9, 7]]) P.ellipse(x, y, 2, 1, L[4]);
    P.set(8, 4, Sn[4]);
  },
  alPurslane: (P) => {
    P.line(4, 13, 12, 6, R[2]);
    for (const [x, y] of [[5, 11], [7, 10], [9, 8], [11, 7], [6, 13], [10, 10]]) P.disc(x, y, 1.2, L[4]);
  },
  alBerry: (P) => {
    for (const [x, y] of [[6, 9], [9, 8], [8, 11], [11, 11], [5, 12]]) {
      P.disc(x, y, 1.6, Cl[1]);
      P.set(x - 1, y - 1, Cl[2]);
    }
    leaf(P, 9, 5);
  },
  alChestnut: (P) => {
    P.ellipse(8, 10, 4.5, 4, So[2]);
    P.ellipse(7, 9, 2.5, 2, So[3]);
    P.hline(4, 12, 12, St[2]);
    P.set(8, 5, So[1]);
  },
  alJujube: (P) => {
    P.ellipse(6, 9, 2.5, 3, Cl[0]);
    P.ellipse(10, 10, 2.5, 3, R[2]);
    P.set(5, 8, Cl[2]);
    P.set(9, 9, E[3]);
    leaf(P, 8, 5);
  },
  alFrostPersimmon: (P) => {
    P.ellipse(8, 10, 5, 4, E[3]);
    P.rect(6, 5, 5, 2, L[2]);
    for (const [x, y] of [[5, 9], [10, 8], [8, 12], [11, 11]]) P.set(x, y, Sn[4]);
  },
  alMushroomRaw: (P) => {
    P.ellipse(6, 8, 4, 2.5, Ro[3]);
    P.rect(5, 9, 2, 4, Sn[2]);
    P.ellipse(11, 10, 3, 2, Sn[3]);
    P.rect(10, 11, 2, 3, Sn[2]);
    P.set(13, 4, E[4]);
    P.set(13, 6, E[4]);
  },
  alMushroom: (P) => {
    P.ellipse(6, 8, 4, 2.5, So[3]);
    P.rect(5, 9, 2, 4, Sn[3]);
    P.ellipse(11, 10, 3, 2, St[2]);
    P.rect(10, 11, 2, 3, Sn[3]);
  },
  alPickle: (P) => {
    P.rect(4, 6, 8, 8, W[2]);
    P.rect(5, 5, 6, 1, Ro[3]);
    P.rect(5, 8, 6, 5, L[3]);
    P.hline(5, 10, 8, L[5]);
  },
  alPickleOld: (P) => {
    P.rect(4, 5, 8, 9, So[2]);
    P.rect(5, 4, 6, 1, Sn[3]);
    P.rect(5, 7, 6, 6, L[2]);
    P.hline(4, 11, 10, Cl[1]);
  },
  alWine: (P) => {
    P.ellipse(8, 10, 4.5, 4.5, So[3]);
    P.rect(6, 3, 4, 3, So[2]);
    P.rect(6, 2, 4, 1, Cl[1]);
    P.set(6, 9, So[4]);
  },
  alWineAged: (P) => {
    P.ellipse(8, 10, 4.5, 4.5, R[1]);
    P.rect(6, 3, 4, 3, R[1]);
    P.rect(5, 8, 6, 3, St[3]);
    P.rect(6, 2, 4, 1, E[4]);
  },
  alLoach: (P) => {
    P.line(2, 11, 13, 7, So[3]);
    P.line(3, 12, 13, 8, So[2]);
    P.set(12, 7, N[0]);
    P.set(2, 12, So[1]);
    P.set(7, 10, St[2]);
  },
  alDumpling: (P) => {
    P.ellipse(8, 11, 6, 3, Sn[3]);
    for (const x of [5, 8, 11]) {
      P.disc(x, 9, 2, Sn[4]);
      P.set(x, 9, L[4]);
    }
  },
  alColdSoup: (P) => {
    P.ellipse(8, 11, 6, 3, Sn[3]);
    P.ellipse(8, 10, 5, 2, Cl[2]);
    P.set(6, 10, Cl[1]);
    P.set(10, 9, Sn[4]);
  },
  alChestnutStew: (P) => {
    P.ellipse(8, 11, 6, 3, So[2]);
    P.ellipse(8, 10, 5, 2, E[3]);
    P.set(6, 9, So[3]);
    P.set(10, 10, So[3]);
  },
  alPickleStew: (P) => {
    P.ellipse(8, 11, 6, 3, Ro[3]);
    P.ellipse(8, 10, 5, 2, St[3]);
    P.set(6, 9, L[3]);
    P.set(10, 10, St[2]);
    P.set(7, 6, Sn[3]);
    P.set(9, 5, Sn[3]);
  },
});
// 摆件小图：一个形状，按摆件换颜色和细节
export const DECOR_DRAW = {
  neon: (P) => {
    P.rect(2, 4, 12, 8, N[1]);
    P.hline(4, 11, 6, Cl[2]);
    P.hline(4, 11, 9, E[5]);
    P.vline(7, 5, 10, W[5]);
  },
  chime: (P) => {
    P.hline(4, 12, 3, So[2]);
    for (const x of [5, 8, 11]) P.vline(x, 4, 8 + (x % 3), Ro[4]);
    P.disc(8, 12, 1.5, E[4]);
  },
  potted: (P) => {
    P.rect(5, 10, 6, 4, R[2]);
    for (const [x, y] of [[6, 8], [9, 7], [7, 5], [10, 9], [5, 6]]) P.ellipse(x, y, 2, 1, L[4]);
  },
  phono: (P) => {
    P.rect(3, 10, 10, 4, So[2]);
    P.poly([[8, 9], [13, 3], [14, 6]], E[4]);
    P.ellipse(7, 10, 4, 1, N[0]);
  },
  calendar: (P) => {
    P.rect(4, 3, 8, 10, Sn[4]);
    P.rect(4, 3, 8, 3, Cl[1]);
    P.rect(5, 7, 6, 4, E[5]);
    P.set(6, 8, L[4]);
  },
  lantern: (P) => {
    P.rect(5, 5, 6, 8, Ro[3]);
    P.rect(6, 7, 4, 4, E[5]);
    P.hline(6, 9, 4, Ro[4]);
    P.set(8, 3, Ro[2]);
  },
  bike: (P) => {
    P.disc(4, 11, 2.6, N[0]);
    P.disc(12, 11, 2.6, N[0]);
    P.line(4, 11, 8, 7, Cl[1]);
    P.line(8, 7, 12, 11, Cl[1]);
    P.set(9, 6, L[4]);
  },
  tank: (P) => {
    P.rect(3, 6, 10, 7, W[4]);
    P.hline(3, 12, 6, Sn[4]);
    P.rect(4, 11, 3, 2, Ro[3]);
    P.set(9, 9, E[4]);
  },
  teddy: (P) => {
    P.disc(8, 10, 3.5, So[3]);
    P.disc(8, 6, 2.5, So[3]);
    P.set(6, 4, So[2]);
    P.set(10, 4, So[2]);
    P.set(8, 6, N[0]);
  },
  clock: (P) => {
    P.rect(5, 3, 6, 11, So[2]);
    P.disc(8, 7, 2.2, Sn[4]);
    P.set(8, 6, N[0]);
    P.vline(8, 10, 12, St[3]);
  },
  globe: (P) => {
    P.disc(8, 7, 4, W[3]);
    P.set(6, 6, L[4]);
    P.set(9, 8, L[4]);
    P.vline(8, 11, 13, Ro[3]);
    P.hline(5, 11, 14, Ro[2]);
  },
  guitar: (P) => {
    P.ellipse(6, 11, 3, 3, So[3]);
    P.line(7, 9, 13, 2, So[2]);
    P.disc(6, 11, 1, N[0]);
  },
  mailbox: (P) => {
    P.rect(5, 4, 6, 10, L[2]);
    P.hline(6, 9, 6, N[0]);
    P.rect(5, 3, 6, 1, L[3]);
  },
  busSign: (P) => {
    P.vline(8, 7, 14, Ro[3]);
    P.rect(4, 2, 9, 6, W[3]);
    P.hline(5, 11, 4, Sn[4]);
  },
  tv: (P) => {
    P.rect(3, 4, 10, 8, So[1]);
    P.rect(4, 5, 7, 6, Ro[4]);
    P.set(12, 6, E[4]);
    P.line(6, 4, 4, 1, Ro[3]);
    P.line(9, 4, 11, 1, Ro[3]);
  },
  vase: (P) => {
    P.ellipse(8, 10, 3.5, 4, Sn[4]);
    P.rect(7, 3, 2, 3, Sn[4]);
    P.set(7, 9, W[2]);
    P.set(9, 11, W[2]);
  },
  fan: (P) => {
    P.disc(8, 6, 4, Ro[3]);
    P.disc(8, 6, 1.2, Ro[1]);
    P.vline(8, 10, 13, Ro[2]);
    P.hline(5, 11, 14, Ro[2]);
  },
  kite: (P) => {
    P.poly([[8, 2], [13, 7], [8, 12], [3, 7]], Cl[2]);
    P.line(8, 12, 11, 15, Sn[3]);
  },
  lamp: (P) => {
    P.poly([[4, 6], [12, 6], [10, 3], [6, 3]], L[3]);
    P.vline(8, 7, 12, St[2]);
    P.hline(5, 11, 13, St[2]);
  },
  frame: (P) => {
    P.rect(3, 4, 10, 9, So[2]);
    P.rect(4, 5, 8, 7, Sn[3]);
    P.set(6, 8, Cl[2]);
    P.set(9, 8, W[2]);
  },
  cage: (P) => {
    P.ellipse(8, 7, 4, 5, St[2]);
    P.ellipse(8, 7, 3, 4, N[0]);
    for (const x of [6, 8, 10]) P.vline(x, 3, 12, St[3]);
    P.hline(4, 12, 12, St[2]);
  },
  umbrella: (P) => {
    P.poly([[2, 8], [8, 2], [14, 8]], Cl[2]);
    P.vline(8, 8, 14, So[1]);
    P.set(9, 14, So[1]);
  },
  cup: (P) => {
    P.rect(5, 4, 6, 5, St[4]);
    P.rect(7, 9, 2, 3, St[3]);
    P.hline(5, 10, 13, So[2]);
  },
  lion: (P) => {
    P.rect(4, 7, 8, 6, Ro[3]);
    P.disc(8, 6, 3, Ro[4]);
    P.set(7, 6, N[0]);
    P.disc(11, 11, 1.2, Ro[2]);
  },
};
for (const d of DECOR) ICON_DRAW[decorItem(d.id)] ??= DECOR_DRAW[d.id];
assignItemIcons();
