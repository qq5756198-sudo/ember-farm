// v0.26.0「整顿」的数：营地体检以后，去掉没用的、合并重复的，让心情真的影响干活，长夜按时来波。
// 方案：《余烬农场 · 营地设施体检与改造方案》第一版（整顿）。
import { ITEMS, BUILDINGS, RECIPES } from "./data.js";
import { TECH } from "./expansion-data.js";
import { LATHE_MODES, PEOPLE_TRAITS, CARGO } from "./outpost-data.js";
import { DECREES, LADDER } from "./winter-data.js";
import { FESTIVALS, ADJ } from "./seasons-data.js";
import { PAL } from "./pixel-kit.js";
import { GEAR_ICON_IDS } from "./gear-data.js";
import { LN } from "./longnight-data.js";
import { registerIcons } from "./gear-sprites.js";
import { ECHO_EVENTS } from "./echoes-data.js";
import { HOME_LESSONS } from "./guidance-data.js";
import { FEATURES } from "./expansion-data.js";
import { PILLARS } from "./rebuild-data.js";

export const TIDY_SCHEMA = 1;

// ---------- 去掉的三样：旧档第一次读进来时拆掉，退全部材料 ----------
// 罐装机只有配送箱一条配方（卖价比原料只多 14），配方挪到篝火灶；鱼篓一天只值 22 金币还要天天去按；
// 摊位和出货箱做同一件事，并成出货箱的「挂牌」三格。
export const RETIRED = ["canner", "fishTrap", "stall"];
for (const id of RETIRED) if (BUILDINGS[id]) BUILDINGS[id].retired = true;
// 布局相邻加成里只管这三样的几条（罐装机靠灶台、摊位靠营门）一起去掉
for (let i = ADJ.length - 1; i >= 0; i--) if (RETIRED.includes(ADJ[i].a)) ADJ.splice(i, 1);
const parcel = RECIPES.find((r) => r.id === "parcel");
if (parcel) parcel.station = "cook";
if (BUILDINGS.cook) BUILDINGS.cook.desc = "加工炖汤、罐头、干粮和料理；学了罐装工艺还能把罐头打包成配送箱。";
if (TECH.canner) TECH.canner.desc = "篝火灶能把罐头和布打包成配送箱（订单、合同、运输路线要用）。";
// 几处旧说明跟着改：鱼篓、摊位不在了
{
  const sample = ECHO_EVENTS.find((x) => x.id === "migration")?.options?.find((o) => o.id === "sample");
  // 「检验水样」原来的好处挂在鱼篓上（雨天每 3 天多一条蓝背鱼）；鱼篓拆了，改成雨天在池塘钓上鱼时多给（见 tidy.js 的 hookFish）
  if (sample) sample.result = "新增净水证据；以后雨天在池塘钓上鱼，每 3 天多一条蓝背鱼。";
  const fishing = HOME_LESSONS.find((x) => x.id === "fishing");
  if (fishing) Object.assign(fishing, { result: "鱼可用于料理和订单；雨天、夜里钓到的鱼不一样。", label: "查看池塘" });
  for (const f of FEATURES) {
    if (f[1] === "stall") Object.assign(f, { 0: "出货箱挂牌", 2: "出货箱三格挂牌，白天按卖价的 1.25 倍卖给路过的人；明天的行情今天就看得到。" });
    if (f[0] === "钓鱼与鱼篓") f[0] = "池塘钓鱼";
  }
  for (const p of PILLARS) for (const t of p.tools || []) if (t[0] === "camp" && t[1] === "stall") t[2] = "出货箱挂牌";
}

// ---------- 出货箱的「挂牌」：白天卖给路过的人 ----------
// 三格，每 90 游戏分钟卖出一件，按卖价的 1.25 倍；06:00–22:00 有人路过。
export const LISTING = { slots: 3, every: 90, mult: 1.25, from: 360, to: 1320, max: 20, log: 6, types: ["crop", "food", "resource", "medicine", "seed"] };

// ---------- 心情三档 ----------
// 士气 35 以下低落：每个钟点四成机会歇着，每天一成机会闹情绪不干；70 以上高昂：每个钟点两成五机会多干一件，
// 每天 08:00 有两成机会「来劲」一整天（每人 7 天最多一次）。士气每天往“该有的心情”走四成。
export const MOOD = {
  low: 35,
  high: 70,
  home: 50,
  drift: 0.4,
  idle: 0.4,
  strike: 0.1,
  extra: 0.25,
  inspire: 0.2,
  gap: 7,
  min: 5,
};
// 心情的来由：每一条是“该有的心情”比 50 高或低多少
export const MOOD_FACTORS = {
  missed: { text: "昨晚没吃上饭", v: -15 },
  fine: { text: "伙食有变化（吃得好）", v: 5 },
  noBed: { text: "没有床位", v: -10 },
  room: { text: "有布置好的房间歇脚", v: 3 },
  ladder: { text: "生活水准", v: 2 },
  curfew: { text: "法令「夜间宵禁」", v: -3 },
  ration: { text: "法令「配给卡」", v: -10 },
  overtime: { text: "法令「加班周」", v: -8 },
  winterStore: { text: "法令「冬储令」（寒潮里）", v: -5 },
  injured: { text: "法令「伤员优先」", v: -3 },
  festival: { text: "三天内办过节庆", v: 5 },
  chatty: { text: "话痨队员晚饭后讲笑话", v: 3 },
  decor: { text: "广场装饰", v: 2 },
  murals: { text: "阿砾的壁画", v: 2 },
  photo: { text: "秦奶奶的老照片", v: 2 },
  photos: { text: "档案馆照片墙", v: 2 },
  trust: { text: "和你交情深（信任 6）", v: 2 },
  tired: { text: "累了", v: -4 },
  worn: { text: "累垮了", v: -8 },
};
export const TIER_NAMES = { low: "低落", normal: "平常", high: "高昂" };
// 来劲：按这个人最在意的活（优先级最高的岗位）
export const INSPIRE = {
  farmer: { name: "好手气", text: "今天她照看过的田，你收的时候每块多 2 份", bonus: 2 },
  medic: { name: "通宵配药", text: "白送 2 个药包", give: { medkit: 2 } },
  mechanic: { name: "巧手", text: "把营地的设施都修好" },
  guard: { name: "眼尖", text: "今晚瞭望塔伤害 +50%", mult: 1.5 },
};
// 信任到 3，这个人会告诉你他来劲时是什么样
export const INSPIRE_TRUST = 3;

// ---------- 长夜：三波按时来，头目 03:00 来；打完的空档用来修补，敲警钟可以提前叫下一波 ----------
// 离 22:00 多少游戏分钟；每晚最多提前 2 次，每提前一次多一次稀有掉落
export const LN_PACE = { bossAt: 300, maxEarly: 2, bell: { x: 560, y: 380 } };
// 按时来波以后，两波之间有修补、包扎的工夫：同样的只数一个人守的倒下率从两成五掉到一成四。
// 统一高难度：每波多两成五（10/12/14 → 12/15/18），一个人守回到三成多，备过战的一成上下。
LN.base = [12, 15, 18];

// ---------- 陷阱：所有感染者都踩得响，头目只吃一半；灰隼团一半机会认出来绕开 ----------
// 原来一下 45（制造 5 级 65），乘 1.34 是 60（87）：守夜台上两塔四陷阱的防线只打倒全晚的 27%，到不了三成
export const TRAP_ALL = { r: 36, hit: 45, hitLv5: 65, cd: 1.5, wear: 10, boss: 0.5, spot: 0.5, mult: 1.34 };

// ---------- 瞭望塔：一发 26 乘 1.2 是 31（守夜台上两塔四陷阱的防线比一个人守只少倒下 7 个百分点，到不了 8 个） ----------
export const TOWER = { mult: 1.2 };

// ---------- 噪声信标：要你拉响，60 秒（96 游戏分钟），电 5，没电时拿 1 个零件当电池 ----------
export const LURE = { minutes: 96, power: 5, part: 1, r: 350, near: 130 };

// ---------- 贺满仓：每期 3 天到期，逾期每天多一成，最多多三成；逾期过的，还清后 7 天不再垫付 ----------
export const HEMC = { every: 3, late: 0.1, cap: 0.3, refuse: 7 };

// ---------- 机床：弹药交给制作台，换成修理包；每晚可以加急多做一批，两成会卡料、第二天歇一天 ----------
// 旧档的机床可能还停在“弹药”上：键留着让读档认得，转换时改成零件；选单里不再出现
if (LATHE_MODES.ammo) LATHE_MODES.ammo.retired = true;
LATHE_MODES.repair = { pick: "优先修理包", name: "修理包", input: { scrap: 3, wood: 2 }, output: { repairKit: 1 }, desc: "每批 废金属×3、木材×2 → 修理包×1" };
export const LATHE_RUSH = { jam: 0.2, until: 1080 };

// ---------- 修理包 ----------
ITEMS.repairKit ??= {
  name: "修理包",
  icon: 43,
  type: "resource",
  sell: 18,
  buy: 40,
  use: "用一个",
  desc: "在农场：身边最破的一座防御设施（围栏、大门、陷阱、塔、信标、维修点）当场修满。在外面：手上的近战武器修回四成耐久，不扣上限。机床做。",
};
const R = PAL.rust,
  Ro = PAL.stone,
  St = PAL.straw,
  A = PAL.ash;
const DRAW = {
  repairKit(P) {
    // 一只铁皮工具箱，上面一把扳手
    P.rect(2, 7, 12, 7, R[2]);
    P.hline(2, 13, 7, R[3]);
    P.rect(2, 10, 12, 1, R[1]);
    P.rect(6, 4, 4, 3, Ro[3]);
    P.rect(7, 5, 2, 2, A[2]);
    P.rect(7, 11, 2, 2, St[3]);
    P.line(3, 3, 9, 9, Ro[4]);
    P.set(2, 2, Ro[4]);
    P.set(3, 2, Ro[4]);
    P.set(2, 3, Ro[4]);
  },
};
{
  const add = Object.keys(DRAW).filter((id) => ITEMS[id] && !GEAR_ICON_IDS.includes(id));
  registerIcons(Object.fromEntries(add.map((id) => [id, DRAW[id]])));
  for (const id of add) {
    GEAR_ICON_IDS.push(id);
    ITEMS[id].icon = "g" + (GEAR_ICON_IDS.length - 1);
  }
}
// 修理包修得了的
export const KIT_TYPES = ["fence", "gate", "trap", "tower", "lure", "repairpost"];
export const KIT = { farmR: 240, weapon: 0.4 };

// ---------- 设施卡：按 E 打开它自己的一页（状态 + 能做的事） ----------
export const CARD_TYPES = ["solar", "drone", "irrigation", "greenhouse", "bed", "tower", "lure", "repairpost", "coop", "floor", "chair", "lamp", "bookshelf", "table", "harvestTrophy", "stove", "scarecrow"];

// ---------- 法令：心情有用以后，代价写清楚落在谁身上 ----------
// 农舍「房间与政策」里的加班生产、伤员优先并进同名法令（两套规则合成一套）
Object.assign(DECREES.overtime, { good: "加工速度 +25%；居民每个钟点多干一件活", cost: "干活时疲劳涨得快（每小时 +7），居民心情 −8" });
Object.assign(DECREES.injured, { good: "晚饭时你若生命低于 80，回 8 生命；许医生先吃工作餐，你伤重时多治 6", cost: "其他居民心情 −3" });
Object.assign(DECREES.curfew, { cost: "19 点后队员不干活，居民心情 −3" });
Object.assign(DECREES.ration, { cost: "居民心情 −10；做不到“吃得饱”" });
Object.assign(DECREES.winterStore, { cost: "寒潮期间居民心情 −5" });
Object.assign(DECREES.salvage, { cost: "搬运队员和铁锹上午十点前不搬东西" });
Object.assign(DECREES.kitchen, { cost: "每天晚饭多烧 1 份木材（没柴就不算“吃得好”）" });
if (LADDER[1]) LADDER[1].need = "最近三顿晚饭吃过三种以上餐食（签了公共厨房：两种；厨房没柴的那晚不算）";
export const DECREE_MOOD = { curfew: "curfew", ration: "ration", overtime: "overtime", winterStore: "winterStore", injured: "injured" };

// ---------- 其他小修 ----------
if (PEOPLE_TRAITS.diligent) PEOPLE_TRAITS.diligent.desc = "早上 5 点就开工，多干一个钟点";
if (PEOPLE_TRAITS.chatty) PEOPLE_TRAITS.chatty.desc = "吃饱后讲笑话：居民该有的心情 +3";
if (FESTIVALS.seeds) FESTIVALS.seeds.star = "出货箱挂着牌（或这周挂过）";
// 运输骡装车：和援建清单、法令重复的长期好处去掉，改成回程捎回来的一车货（旧档已经拿到的好处不收回）
export const CARGO_RETURN = { food: { bread: 4 }, medicine: { medkit: 2 }, repair: { parts: 4 } };
if (CARGO.food) CARGO.food.desc = "送到住宅前哨：唐九的商队第二天就来；回程捎回干粮 4。";
if (CARGO.medicine) CARGO.medicine.desc = "送到医院前哨：回程捎回药包 2。";
if (CARGO.repair) CARGO.repair.desc = "送到工业前哨：回程捎回零件 4。";

// ---------- 学徒并进队员卡：除了教手艺，还能把队员的职能换掉 ----------
// 师父：搬运←阿禾（或搬运队员），工程←陈工（或工程队员），侦察←侦察队员，守卫←守卫队员（或排了守卫岗的居民）
export const RETRAIN = { days: 3, slow: 0.9, tired: 6 };
export const ROLE_MASTER = { carry: "farmer", build: "mechanic" };
