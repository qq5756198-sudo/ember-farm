// v0.42.0「删繁」的数和字：一物一用方案第二版——把一样东西身上挂着的、没人知道有什么用的那些去掉或者并到一起。
// 判定写在 trim.js（引擎最上面一层），页面写在 trim-ui.js，场景写在 trim-renderer.js。
// 不动的：长夜、十凶、尸潮、灰隼团、最后一夜的数；装备防具；主线和心里话；地铁隧道、旧物、余烬核、年终评定；季节和天气。
import { ITEMS, BUILDINGS, CROPS } from "./data.js";
import { BUILD_GROUPS, BCARD, BVERB, HUD_CARD, PAGE_CARD, MENUS, DISTRICT_CARD } from "./simple-data.js";
import { FERTS, MYSTERY, HYBRID } from "./bounty-data.js";
import { SPECS } from "./expansion-data.js";
import { PERKS as GROW_PERKS } from "./grow-data.js";
import { SKILLS as KIN_SKILLS } from "./kin-data.js";
import { TITAN_CASE } from "./titan-data.js";
import { JARS } from "./almanac-data.js";
import { LISTS, DIGS, WALLS } from "./relight-data.js";
import { LISTS2 } from "./grow-data.js";
import { TRAVELERS, PEDDLERS, BUYERS, LETTERS, WEEK_LISTS, EXPAND, WALL2, GOODS } from "./hope-data.js";
import { RARE_SEEDS, PERKS as DAILY_PERKS } from "./daily-data.js";
import { TREASURES } from "./thief-data.js";
import { TRAITS } from "./expansion-data.js";
import { FESTIVALS } from "./seasons-data.js";
import { LADDER } from "./winter-data.js";

export const TRIM_SCHEMA = 1;

// ================= 设施：36 样变 26 样 =================
// 拆掉、材料全退的四样：雨水桶（水网去掉了）、太阳能板（不再有电）、照看机（喷灌头和种地的居民替它做）、药柜（伤员去掉了）
export const REFUND_TYPES = ["rain", "solar", "drone", "medCabinet"];
// 土酒坛原地换成腌缸：坛里正在酿的照样出，酒照样卖
export const WINE_JAR = "alWineJar";
export const PICKLE_JAR = "alPickleJar";
// 房间去掉以后，地板、椅子、灯、书架、餐桌、奖杯不再单列，建造页上并成“摆件”一格（卡上挑样子；奖杯要先在收获展得过）
export const DECOR_LOOKS = ["chair", "lamp", "bookshelf", "table", "floor", "harvestTrophy"];
// 本来就只有一件、拿到了才能摆的：旧物摆件、往事陈列柜、老怀表（它们那一层决定什么时候能摆，摆件那一格里才出现）
export const DECOR_SPECIAL = ["alDecor", "hnKeepsake", "rlWatch"];
// 也算“摆件”的：（全营士气按摆出来的种数算；老怀表自己就一直 +3，不另算一种）
export const DECOR_TYPES = [...DECOR_LOOKS, "alDecor", "hnKeepsake", "grHat", "grBoard", "grCompass", "grFlask", "grGlove"];
// 建造页上的那一格（不是真的设施，只是一张卡）
export const DECOR_TILE = "trDecor";
export function buildCount() {
  return BUILD_GROUPS.reduce((n, g) => n + g[2].length, 0);
}

// ================= 种地：只留种、浇、收和一种肥 =================
// 优质：从种下那天起，天天都浇上了水，收的时候有这么大的机会出一份优质（农业专精“品质”再高一点）。
// 原来靠照料分（照看、换茬、肥地、邻居提质），勤快的玩家七成上下；台子上量了再定（见 docs/releases/v0.42.0.md）。
export const FINE = { chance: 0.62, spec: 0.85, dryScore: 40, wetScore: 90 };
// 肥力不再算：每块田一直是这个数（不快不慢）
export const SOIL_FLAT = 65;
// 三种肥并成一种：这一茬长快一半
export const FERT = { id: "fertGrow", name: "肥料", grow: 1.5, text: "这一茬长快一半", old: ["fertCare", "fertWater"] };
// 特性种子（早熟、丰产、耐旱）不再有：手上的一颗换两颗普通种子；种下去的照普通的长
export const TRAIT_SEED = /^seed_([A-Za-z]+)_(early|abundant|hardy)$/;
export const TRAIT_SWAP = 2;
// 喷灌头：每天早上浇它旁边的田（白天新种下的，一个钟点内也给浇上）；水渠挖通了，渠边的田每天自己有水
export const SPRINKLE = { r: 300, from: 6, to: 20 };
export const CANAL_R = 190;
// 原来往水网里加水的几样（每天替你浇几块田）
export const AUTO_WATER = { cistern: 6, wall: 10, wall2: 10, windmill: 12 };

// ================= 营地一个士气 =================
// 每个人原来各有一个心情；现在全营一个数，每个人都照它。每天半夜往“该有的士气”走四成。
// 高了（70 以上）每个钟点两成五的机会多干一件，低了（35 以下）每个钟点四成的机会歇着。
export const MORALE = { start: 60, low: 35, high: 70, home: 50, drift: 0.4, idle: 0.4, extra: 0.25, min: 5, max: 100 };
export const MORALE_FACTORS = {
  fine: { v: 5, text: "晚饭有三样以上的菜" },
  missed: { v: -15, text: "有人没吃上晚饭" },
  noBed: { v: -10, text: "床不够睡" },
  festival: { v: 5, text: "刚过了节" },
  decor: { v: 1, max: 6, text: "摆着的摆件" },
  lost: { v: -10, days: 2, text: "长夜没守住" },
  hurt: { v: -3, max: 9, days: 2, text: "守夜有人受了伤" },
  // 以前挣下来的、一直算的那几样（原来加在每个人的心情上，现在加在全营士气上，数不变）
  chatty: { v: 3, text: "话痨队员晚饭后讲笑话" },
  plaza: { v: 2, big: 4, text: "广场装饰" },
  murals: { v: 2, text: "阿砾的壁画" },
  photo: { v: 2, text: "秦奶奶的老照片" },
  photos: { v: 2, text: "档案馆照片墙" },
  trust: { v: 2, text: "一半以上的人和你交情深（信任 6）" },
  watch: { v: 3, text: "营地里摆着那只老怀表" },
  titans: { v: 3, text: "纪念石旁的十凶碑" },
};
// 原来几处“让大家高兴一下”（广播、送礼、营火）不再单给某一个人加：照营地的人数折进全营士气里
export const MORALE_TEXT = {
  name: "士气",
  what: "营地里大家干劲足不足，全营一个数。",
  how: "吃得好、刚过了节、营地里摆着摆件会涨；有人没吃上饭、床不够、长夜没守住、守夜有人受伤会跌。",
  low: "低了（35 以下）：大家时不时歇着，活干得慢。",
  high: "高了（70 以上）：大家时不时多干一件。",
};

// ================= 睡一觉「休息好」 =================
// 房间和舒适度去掉以后：在农舍睡一觉就「休息好」这么多个钟点（体力恢复快五成、经验多一成）；东厢房再多 1 个钟点，二楼、热水器照旧加
export const REST = { base: 4, wing: 1 };

// ================= 生态修复区：照收复度自己长 =================
// 修好的顺序和样子：先草地、林地（蝴蝶），再湿地（青蛙），修满 12 格以上林地湿地够了来白鹭
export const ECO_ORDER = [
  [0, "grass"],
  [1, "grass"],
  [2, "forest"],
  [4, "grass"],
  [5, "wetland"],
  [6, "wetland"],
  [3, "forest"],
  [7, "forest"],
  [8, "wetland"],
  [9, "wetland"],
  [10, "grass"],
  [11, "forest"],
  [12, "grass"],
  [13, "grass"],
  [14, "wetland"],
  [15, "grass"],
];

// ================= 伤员去掉以后 =================
// 门诊、二级诊所各让守夜受伤掉的士气少 1 点（各处改的说法在 applyTrimData 里）
export const CLINIC = { wall: 1, wall2: 1 };

// ================= 天赋：按固定顺序自动学，还是 28 点 =================
// 每项技能一排，先学门槛低的、便宜的；够不着门槛的先跳过，下一回再看。妙手那一排不学（偷东西去掉了）。
export const TALENT_ORDER = ["oldHand", "pathfinder", "steadyHand", "steadyAim", "irrigate", "packer", "quickHand", "toughBone", "keepSeed", "nose", "scrapper", "finisher", "bumper", "survivor", "upkeep", "suppress"];
// 学的时候：早上 06:00 或者睡醒；打着仗不学（十凶醒着、长夜、尸潮、灰隼团来了、身边有感染者）
export const TALENT_SAFE_R = 420;

// ================= 宝贝：偷不了了，信任到了他自己交给你 =================
// 原来要偷的 20 件“宝贝”：主人信任到这个数，第二天早上自己交给你（坏的那几样不给：秦奶奶的全家福、阿豆的藏货图）
export const GIFT_TREASURE = { trust: 8, skip: ["familyPhoto", "stashMap"] };

// ================= 各处要“上品”“特性种子”“提质肥”“保水肥”的地方改一改 =================
// 清单要上品 → 要优质；奖励给特性种子 → 给两颗普通种子；给提质肥、保水肥 → 给肥料
export function remapItem(id) {
  if (typeof id !== "string") return [id, 1];
  let m = id.match(/^prime_(.+)$/);
  if (m && ITEMS["fine_" + m[1]]) return ["fine_" + m[1], 1];
  if (FERT.old.includes(id)) return [FERT.id, 1];
  m = id.match(TRAIT_SEED);
  if (m && CROPS[m[1]]?.seed && ITEMS[CROPS[m[1]].seed]) return [CROPS[m[1]].seed, TRAIT_SWAP];
  return [id, 1];
}
const isItemKey = (k) => /^prime_|^seed_[A-Za-z]+_(early|abundant|hardy)$/.test(k) || FERT.old.includes(k);
// 只改这几处数据（物品表本身不动，旧档里的东西照样认得）
function remapDeep(x, seen = new WeakSet()) {
  if (!x || typeof x !== "object" || seen.has(x)) return x;
  seen.add(x);
  if (Array.isArray(x)) {
    // [["prime_potato", 1], ...] 这样的“要什么、几份”
    if (x.length === 2 && typeof x[0] === "string" && typeof x[1] === "number" && isItemKey(x[0])) {
      const [id, k] = remapItem(x[0]);
      x[0] = id;
      x[1] = x[1] * k;
      return x;
    }
    for (let i = 0; i < x.length; i++) {
      if (typeof x[i] === "string" && isItemKey(x[i])) x[i] = remapItem(x[i])[0];
      else remapDeep(x[i], seen);
    }
    return x;
  }
  for (const k of Object.keys(x)) {
    const v = x[k];
    if (isItemKey(k) && typeof v === "number") {
      const [id, mult] = remapItem(k);
      delete x[k];
      x[id] = (x[id] || 0) + v * mult;
    } else if (typeof v === "string" && (k === "item" || k === "want" || k === "give") && isItemKey(v)) x[k] = remapItem(v)[0];
    else if (v && typeof v === "object") remapDeep(v, seen);
  }
  return x;
}
// 存档里清单交到哪了：“上品X”那一格改叫“优质X”（读档前、每次读进来都改一遍，改过的不会再改）
export function renameListKeys(raw) {
  let n = 0;
  const fix = (rec) => {
    if (!rec || typeof rec !== "object") return;
    for (const k of Object.keys(rec)) {
      const m = k.match(/^prime_(.+)$/);
      if (!m || !ITEMS["fine_" + m[1]]) continue;
      const v = rec[k];
      delete rec[k];
      rec["fine_" + m[1]] = Math.max(rec["fine_" + m[1]] || 0, Number(v) || 0);
      n++;
    }
  };
  for (const rec of Object.values(raw?.relight?.lists || {})) fix(rec);
  for (const rec of Object.values(raw?.grow?.l2 || {})) fix(rec);
  return n;
}

// ================= 这一版要改的那些数和字（第一次用到删繁的引擎时改一次） =================
// 下面几层自己的测试还用原来的引擎，不碰这些数；游戏里一开局（或读档）就改好。
let applied = false;
export function applyTrimData() {
  if (applied) return false;
  applied = true;
  for (const id of [...REFUND_TYPES, WINE_JAR, ...DECOR_LOOKS]) if (BUILDINGS[id]) BUILDINGS[id].retired = true;
  // 房间去掉以后，名字里不再带“房间”“阅览”
  if (BUILDINGS.floor) BUILDINGS.floor.name = "木地板";
  if (BUILDINGS.bookshelf) BUILDINGS.bookshelf.name = "书架";
  {
    const drop = new Set([...REFUND_TYPES, WINE_JAR]);
    for (const g of BUILD_GROUPS) {
      if (g[0] === "decor") g[2] = [DECOR_TILE];
      else g[2] = g[2].filter((id) => !drop.has(id));
    }
  }
  Object.assign(FERTS.grow, { name: FERT.name, text: FERT.text, grow: FERT.grow });
  FERTS.care.name = "提质肥（旧）";
  FERTS.water.name = "保水肥（旧）";
  if (ITEMS.fertGrow) Object.assign(ITEMS.fertGrow, { name: FERT.name, desc: "堆肥桶沤出来的肥。在田边打开那块田施上：这一茬长快一半。" });
  for (const id of FERT.old) if (ITEMS[id]) ITEMS[id].desc = "以前的肥，现在和别的肥一样：读档时并成了「肥料」。";
  MYSTERY.normal = 0.95;
  MYSTERY.trait = 0;
  MYSTERY.variety = 0.05;
  HYBRID.trait = 0;
  if (EXPAND?.home?.[0]) EXPAND.home[0].text = "农舍东头加盖一间厢房：多一张床位，睡醒的「休息好」多 1 个钟点。";
  if (EXPAND?.home?.[1]) EXPAND.home[1].text = "农舍加了二楼：睡醒的「休息好」再多 1 个钟点。";
  // 换种集的第一颗星原来是“出货箱挂着牌”：挂牌并进出货箱了，改成这周用出货箱卖过东西
  if (FESTIVALS.seeds) FESTIVALS.seeds.star = "这周用出货箱卖过东西";
  if (WALLS?.water) Object.assign(WALLS.water, { short: "每天替你浇 10 块田", text: "旧水厂的支管接上了：每天替你浇 10 块田，旱季也够浇。" });
  if (WALL2?.water) Object.assign(WALL2.water, { name: "二级供水", text: "旧水厂的主管也接通了：每天再多替你浇 10 块田（一共 20 块）。" });
  if (GOODS?.mill) GOODS.mill.text = "农场西边立起风车抽地下水：每天替你浇 12 块田。";
  if (GOODS?.tractor) GOODS.tractor.text = "每天早上 06:00 拖拉机把田里的碎石、木头清掉，空田翻好。";
  if (DAILY_PERKS?.cistern) DAILY_PERKS.cistern.text = "挖一口蓄水池：每天替你浇 6 块田";
  if (LADDER?.[2]) LADDER[2].need = "床位够；寒潮期间农舍和营地在暖区里";
  if (LADDER?.[3]) LADDER[3].need = "两天内办过节庆，或者全营士气 70 以上";
  if (WALLS?.clinic) Object.assign(WALLS.clinic, { short: "守夜受伤士气少掉一点", text: "许医生在营地开了门诊：守夜有人受伤，全营士气每回少掉 1 点（−3 → −2）。" });
  if (WALL2?.clinic) WALL2.clinic.text = "诊所添了两张床和一个药柜：守夜受伤再少掉 1 点（每回只掉 1 点）。";
  // 房间去掉以后：学堂不再看阅览室
  if (WALLS?.school) WALLS.school.text = "营地办起了小课堂：带徒、改学职能都快一倍（3 天变 2 天）。";
  // 上品、特性、照看去掉以后的几句
  for (const list of Object.values(SPECS || {})) for (const o of list || []) if (o?.id === "quality") o.desc = "天天浇上水的菜，出优质的机会更大。";
  for (const list of Object.values(GROW_PERKS || {}))
    for (const m of Array.isArray(list) ? list : []) if (m?.id === "agNeighbor") m.text = "浇一块田，旁边一块也顺手浇了（照样用壶里的水）";
  if (KIN_SKILLS?.song) KIN_SKILLS.song.desc = "营火夜谈不管聊什么，全营士气另 +3。";
  for (const st of TITAN_CASE?.steps || []) if (typeof st.text === "string") st.text = st.text.replace("全营心情一直 +3", "全营士气一直 +3");
  for (const L of [LISTS, LISTS2])
    for (const x of Object.values(L || {})) if (x?.hint && /照顾|提质肥|保水肥|照料/.test(x.hint)) x.hint = "天天浇上水的才有机会出优质。";
  Object.assign(BCARD, {
    irrigation: ["每天早上浇旁边的田", "300 以内的田不用你浇；白天新种下的一个钟点内也浇上"],
    compost: ["把多的菜、草料、鸡粪沤成肥料", "5 份过一夜出 1 袋肥料：施在田里这一茬长快一半"],
    alPickleJar: ["腌菜、酿酒", "装 4 份菜：3 天出腌菜；装 4 份粮或果子：4 天出土酒。放久了更值钱"],
    coop: ["每天下蛋", "蛋自己进仓库；有山羊还出奶"],
    lure: ["拉响，把远处的感染者引过去", "拉一次用 1 个零件，引一个半钟点"],
    [DECOR_TILE]: ["摆着好看", "营地里每多一种摆件，全营士气 +1（最多 +6）"],
    stove: ["寒潮时取暖", "220 以内是暖区；寒潮那几天每天早上烧 2 份木材"],
    bed: ["多住一个人", "一张床多一个人；床不够睡全营士气 −10"],
  });
  {
    const first = { floor: "铺一块木地板", chair: "一把木椅", lamp: "一盏暖光灯", bookshelf: "一个书架", table: "一张餐桌", harvestTrophy: "收获展得的奖杯", hnKeepsake: "摆旧物的柜子", alDecor: "从废墟里带回来的旧物件", rlWatch: "摆着看的老怀表" };
    for (const id of [...DECOR_LOOKS, ...DECOR_SPECIAL]) BCARD[id] = [first[id] || BCARD[id]?.[0] || "摆着好看", id === "rlWatch" ? "摆着就一直让全营士气 +3" : "摆着好看：每多一种摆件，全营士气 +1（最多 +6）"];
  }
  Object.assign(BVERB, { compost: "沤肥料", alPickleJar: "腌菜、酿酒", coop: "看鸡下蛋", lure: "拉响", [DECOR_TILE]: "摆着好看" });
  for (const id of DECOR_LOOKS) BVERB[id] = "摆着好看";
  // 顶栏：动静不再出现（那一格一直藏着），多一张全营士气的卡
  HUD_CARD.morale = [MORALE_TEXT.name, MORALE_TEXT.what, MORALE_TEXT.how + MORALE_TEXT.low + MORALE_TEXT.high];
  HUD_CARD.money = ["金币", "买种子、工具都要花钱。", "出货箱卖东西、交订单、跑商能挣。"];
  if (PAGE_CARD.radio) PAGE_CARD.radio = ["通信站", "听今天的广播：天气、今天的事、十凶的传闻", "每天早上 7 点播一回，按交互再听一遍"];
  if (PAGE_CARD.lathe) PAGE_CARD.lathe = ["机床", "每天自己做一样东西放进仓库（零件、布料、修理包），在这里选做哪样", "零件修东西、做武器都要用；尤可还能做小发明"];
  if (PAGE_CARD.dog) PAGE_CARD.dog = ["麦穗", "摸摸它", "它一直跟着你，饭自己会吃"];
  if (PAGE_CARD.people) PAGE_CARD.people = ["人", "认识的人：是谁、干什么、喜欢什么", "照他喜欢的送，信任涨得快"];
  if (PAGE_CARD.plaza) PAGE_CARD.plaza = ["前哨广场", "节庆那天在这里办节庆", "办过节，全营士气 +5，还有回礼；供品自己会挑"];
  if (PAGE_CARD.talk) PAGE_CARD.talk = ["营火", "晚上和营地的人坐一会儿", "聊开心了，全营士气高一点"];
  for (const m of MENUS) if (m[0] === "消息") m[1] = "发生过的事：战报、抉择、账本，还有这一版退回的东西";
  // 地区仓库那一格只剩休整（仓库并进了农场仓库）
  if (DISTRICT_CARD.storage) DISTRICT_CARD.storage = ["休整点", "在这里歇一个钟点：补满水壶、恢复体力", "地区仓库并进了农场仓库：这里出的东西直接进农场仓库"];
  for (const data of [LISTS, LISTS2, TRAVELERS, PEDDLERS, BUYERS, LETTERS, WEEK_LISTS, TREASURES, DIGS]) remapDeep(data);
  // 每日抉择里“稀有种子”那一条：给普通种子（两颗顶一颗）
  for (let i = 0; i < RARE_SEEDS.length; i++) RARE_SEEDS[i] = remapItem(RARE_SEEDS[i])[0];
  // 清单名字里的“上品”
  for (const L of [LISTS, LISTS2])
    for (const x of Object.values(L || {})) {
      if (x?.name) x.name = String(x.name).replace(/上品/g, "优质");
      if (x?.hint) x.hint = String(x.hint).replace(/上品/g, "优质");
    }
  return true;
}

// ================= 腌缸也能酿酒 =================
// 装进去的是哪一样，就照那一样的规矩出（腌菜 3 天、土酒 4 天……）
export const JAR_ANY = { ...JARS[PICKLE_JAR], name: "腌缸", inputs: [...JARS[PICKLE_JAR].inputs, ...JARS[WINE_JAR].inputs] };
export function jarRecipe(item) {
  if (item && JARS[WINE_JAR].inputs.includes(item)) return { ...JARS[WINE_JAR], name: "腌缸" };
  if (item && JARS[PICKLE_JAR].inputs.includes(item)) return JARS[PICKLE_JAR];
  return JAR_ANY;
}

// ================= 旧档转换：消息里那一条 =================
export const CONVERT_TITLE = "这次简化退回了什么";
export const CONVERT_INTRO = "删繁：营地里一样东西只做一件事。拆掉的设施材料全退进了仓库，去掉的玩法退回的东西都在仓库里。";

// 特性的名字（转换清单里写）
export const TRAIT_NAMES = Object.fromEntries(Object.entries(TRAITS).map(([k, t]) => [k, t.name]));
