// v0.27.0「丰年」的数：种菜第二轮（堆肥、多次收获、巨型作物、田里杂交、神秘种子、图鉴、菜地夜袭、偷菜、天灾抢收、订单板），
// 加上营地方案里种田那一块：水井、雨水桶、水塔、喷灌头、水渠并成一张水网，无人机改成照看机，居民种地不抢收，放鸡下地，
// 生态的三种动物帮菜地，寒潮按时来，温室在寒潮里护田。
// 方案：《余烬农场 · 种菜玩法与界面方案》第二轮、《余烬农场 · 营地设施体检与改造方案》第二版。
import { ITEMS, BUILDINGS, CROPS, RECIPES } from "./data.js";
import { TRAITS, TECH } from "./expansion-data.js";
import { CROP_INFO } from "./garden-data.js";
import { KINDS } from "./undertow-data.js";
import { POCKETS } from "./thief-data.js";
import { PERKS } from "./daily-data.js";
import { PAL } from "./pixel-kit.js";
import { CROP_DRAW, leafBlob } from "./pixel-sprites.js";
import { CROP as CROP_ICON, MINI, BADGE, SEED_BAND, DRAW as ICON_DRAW, packet, assignItemIcons } from "./item-sprites.js";

export const BOUNTY_SCHEMA = 1;

// ================= 水网 =================
// 每天 00:00 各水源出水，存不下的流走；水槽、水渠、喷灌头、雨水桶、水塔按你排的顺序，从水网里取水浇它管的田（每块 1 份，丰产的 2 份）。
// 水壶到井边、雨水桶边补水不花水网的水。下雨天田都算浇过。
export const WATER = {
  well: 10, // 修好的旧水井：水槽浇第一排田
  barrel: { base: 4, rain: 12, heat: 0, store: 12, r: 220 },
  tower: { base: 30, heat: 20 }, // 修好的水塔：管全农场
  canal: { base: 12, heat: 4, egret: 4, store: 30, r: 190 }, // 挖通的水渠：池塘水进水网；蓄水时是一个 30 份的蓄水池
  cistern: { base: 6, store: 30 }, // 每日抉择的长期加成「蓄水池」
  sprinkler: { r: 300 },
  // 排在前面的先浇
  order: ["trough", "canal", "sprinkler", "barrel", "tower"],
  names: { trough: "水槽（第一排田）", canal: "水渠边的田", sprinkler: "喷灌头", barrel: "雨水桶边的田", tower: "水塔（全农场）" },
  log: 6,
};
// 旧档里水渠的水位：一格折 5 份存水
export const CANAL_LEVEL_WATER = 5;

// ================= 照看机（原来的无人机） =================
// 每小时照看、浇水、捉虫或拔草 4 块（每块 1 电，浇水还要从水网取水）；不收菜。你离开农场一整天以上才替你收菜补种。
export const DRONE = { per: 4, power: 1, r: 300, away: 1440 };
// 居民种地：你在农场时只浇水、照看；熟了 4 小时没人收，或者你不在农场，才替你收
export const RIPE_WAIT = 240;

// ================= 放鸡下地 =================
// 白天把鸡放进田里：鸡舍 180 内每个钟点清掉一只虫或一处草；每天一成机会啄掉一棵苗；一天最多放 8 个钟点。
export const CHICKENS = { r: 180, hours: 8, from: 360, to: 1080, peck: 0.1, seedling: 0.25 };

// ================= 生态：回来的动物帮菜地 =================
// 生态修复区在农场东南角，离菜地远：蝴蝶、青蛙管整片菜地
export const ECO_HELP = { butterfly: 0.1, frog: 2, egret: 4 };

// ================= 寒潮按时来 =================
// 主线那场寒潮过去以后，每 28 天来一次：第一次 2 天，每次多 1 天，最多 5 天；提前 2 天说
export const COLD = { every: 28, first: 2, step: 1, max: 5, warn: 2, frost: 0.5 };
// 寒潮里只有温室 220 内的田能长；签了“粮食保障”的，温室外长三成五；冬土豆照常长
export const GREENHOUSE_R = 220;
export const COLD_FOOD = 0.35;

// ================= 堆肥桶 =================
// 草料、菜青虫、鸡粪、烂了或多的菜丢进去，5 份过一夜出 1 袋肥
export const COMPOST = { batch: 5, ready: 360, max: 2 };
export const FERTS = {
  grow: { id: "fertGrow", name: "快长肥", text: "这一茬长得快三成", grow: 1.3 },
  care: { id: "fertCare", name: "提质肥", text: "这一茬照料分 +20", care: 20 },
  water: { id: "fertWater", name: "保水肥", text: "这一茬浇一次管两天" },
};
export const FERT_IDS = Object.keys(FERTS);
export const COMPOST_STUFF = ["fodder", "grub", "manure"];

// ================= 多次收获 =================
// 番茄、豆子收完不用重种：从四成长起，再收两次（第 2、3 次各收原来的六成），一直占着地、每一茬照样吃肥
export const REGROW = { crops: ["tomato", "bean"], max: 3, back: 0.4, yield: 0.6 };

// ================= 巨型作物 =================
// 同一种摆成 2×2，四块都熟了、照料分都在 80 以上，清晨两成五的机会长成一棵巨型；要锄 3 下才收得动
export const GIANT = { crops: ["radish", "potato", "pumpkin", "corn"], chance: 0.25, care: 80, yield: [12, 16], hits: 3, show: 40 };

// ================= 田里杂交 =================
// 上下左右挨着的两种不同作物、前一天都喝到水，夜里每对有百分之五的机会在旁边空着的熟地上冒出一棵杂交苗（一夜最多 2 棵）
export const HYBRID = { chance: 0.05, max: 2, grow: 480, trait: 0.75, seeds: 2 };
export const VARIETY_FROM = { radish: "goldRadish", potato: "winterPotato", bean: "glowBean" };

// ================= 神秘种子包 =================
export const MYSTERY = { normal: 0.7, trait: 0.25, variety: 0.05, crops: ["radish", "potato", "tomato", "bean", "corn", "pumpkin", "herb", "cotton"] };

// ================= 菜地图鉴 =================
// 每种作物三格：第一次收获、第一次优质、第三格（能长巨型的：第一次巨型；番茄豆子：一茬收满 3 次；其余：一次连收 5 块）。一行集齐，这种作物以后每次多收 1 份
export const DEX_CROPS = ["radish", "potato", "tomato", "bean", "corn", "pumpkin", "herb", "cotton", "rye", "goldRadish", "winterPotato", "glowBean"];
export const DEX = { combo: 5, bonus: 1 };

// ================= 菜地夜袭、偷菜、天灾 =================
// 地里有熟了的巨型作物，或者熟了 6 个钟点以上还没收的超过 10 块，这一晚 01:00 招来 2–4 只感染者踩田；第 3 天以前不会
export const RAID = { fromDay: 3, ripe: 10, age: 360, count: [2, 4], at: 60, warn: 1200, trample: 0.5, drops: 2, stand: 2 };
// 熟了超过一天不收的，夜里 03:00 每块两成机会被人摸走 1–2 份，地上留脚印；麦穗在农场时只有半成；稻草人、暖光灯 160 内的不会
export const THEFT = { fromDay: 4, ripe: 1440, chance: 0.2, dog: 0.05, take: [1, 2], guard: 160, at: 180 };
// 天灾：前一天 18:00 说。酸雨：没盖布、长过七成的每块少收 1 份；暴雨：没盖布、熟了的每块少收 1 份；早霜（寒潮第一天）：温室外没盖布的长势退回一半
export const STORM = { warn: 1080, rush: 0.7 };

// ================= 订单板 =================
// 出货箱旁边：每天早上补满 3 张单子，2–3 天内交；报酬是直接卖的一倍半，给材料或种子，再加一点信任。每天能撕一张
export const ORDERS = { slots: 3, fromDay: 2, days: [2, 3], qty: [3, 8], mult: 1.5, spot: { x: 540, y: 352 } };
// 谁来下单、要什么
export const ORDER_PEOPLE = [
  { id: "medic", name: "许医生", wants: ["herb", "bean", "tomato"] },
  { id: "farmer", name: "阿禾", wants: ["radish", "bean", "potato"] },
  { id: "mechanic", name: "陈工", wants: ["cotton", "corn", "potato"] },
  { id: "he", name: "何大勺", wants: ["potato", "tomato", "pumpkin", "corn"] },
  { id: "linyi", name: "林姨", wants: ["radish", "potato", "bean", "egg"] },
  { id: "tang", name: "唐九", wants: ["pumpkin", "herb", "cotton", "corn"] },
];
// 报酬：材料按价折（两成的单子给神秘种子包）；零件一张单子最多 1 个
export const ORDER_PAY = {
  seed: 0.2,
  wood: { value: 6, max: 20 },
  scrap: { value: 8, max: 12 },
  cloth: { value: 14, max: 6 },
  parts: { value: 30, max: 1 },
  seedMystery: { value: 80, max: 2 },
};

// ================= 集市菜园（妙手） =================
// 集市南边、铺子后面的空地上。学了「顺手牵羊」，蹲着到林姨菜园边按 E：几块熟菜，一天一次；被抓按偷林姨算
export const MARKET_GARDEN = { region: "market", x: 360, y: 860, name: "林姨的菜园" };

// ================= 新品种 =================
const NEW_CROPS = {
  goldRadish: { name: "金萝卜", seed: "seedGoldRadish", grow: 150, yield: 2, food: 20, sell: 39, desc: "杂交出来的萝卜，表皮金黄，卖价是萝卜的三倍。" },
  winterPotato: { name: "冬土豆", seed: "seedWinterPotato", grow: 480, yield: 4, food: 28, sell: 18, desc: "杂交出来的土豆，寒潮里温室外也照常长。" },
  glowBean: { name: "夜光豆", seed: "seedGlowBean", grow: 600, yield: 4, food: 18, sell: 22, desc: "杂交出来的豆子，熟了夜里豆荚发光：旁边一圈的熟菜没人敢来偷。" },
};
export const NEW_CROP_IDS = Object.keys(NEW_CROPS);
const NEW_INFO = {
  goldRadish: { buff: "weed", soil: "light", likes: "晴朗", hates: "高温" },
  winterPotato: { buff: "water", soil: "light", likes: "小雨", hates: "暴雨" },
  glowBean: { buff: "yield", soil: "feed", likes: "小雨", hates: "高温" },
};
for (const [id, c] of Object.entries(NEW_CROPS)) {
  if (CROPS[id]) continue;
  CROPS[id] = { name: c.name, icon: 24, seed: c.seed, grow: c.grow, yield: c.yield, food: c.food, sell: c.sell, desc: c.desc, variety: true };
  ITEMS[id] = { name: c.name, icon: 24, type: "food", food: c.food, sell: c.sell, buy: Math.round(c.sell * 2.2), desc: c.desc };
  ITEMS["fine_" + id] = { ...ITEMS[id], name: "优质" + c.name, sell: Math.round(c.sell * 1.6), buy: Math.round(c.sell * 3), cropBase: id, desc: "细心照料获得的优质收成，售价提高60%。" };
  ITEMS["hardy_" + id] = { ...ITEMS[id], name: "耐旱" + c.name, sell: Math.round(c.sell * 0.75), cropBase: id, desc: "耐旱品种的收成，售价降低25%；可代替普通作物交订单、加工与留种。" };
  ITEMS[c.seed] = { name: c.name + "种子", icon: 34, type: "seed", crop: id, protected: true, buy: 40, sell: 10, desc: "成熟需 " + Math.round(c.grow / 60) + " 游戏小时 · 每株 " + c.yield + " 份收成。" + c.desc };
  for (const [trait, t] of Object.entries(TRAITS)) ITEMS["seed_" + id + "_" + trait] = { ...ITEMS[c.seed], name: t.name + c.name + "种子", trait, desc: t.desc + " 可在育种箱稳定培育。" };
  CROP_INFO[id] = NEW_INFO[id];
}
// 新品种也能在育种箱留种：一份收成换两颗种子
for (const id of NEW_CROP_IDS) if (!RECIPES.some((r) => r.id === "breed_" + id)) RECIPES.push({ id: "breed_" + id, out: { [NEW_CROPS[id].seed]: 2 }, cost: { [id]: 1 }, station: "breeder", minutes: 10, desc: "留一份" + NEW_CROPS[id].name + "当种，培育两颗种子。" });
// 杂交苗：长大了收下来是一包种子
if (!CROPS.hybrid) CROPS.hybrid = { name: "杂交苗", icon: 24, seed: null, grow: HYBRID.grow, yield: 0, sell: 0, desc: "两种作物挨着长出来的苗，长大收下来是一包种子。", hybrid: true };

// ================= 新物品 =================
const NEW_ITEMS = {
  fertGrow: { name: "快长肥", type: "resource", sell: 6, buy: 18, desc: "堆肥桶出的肥。在田边按 E 打开这块田施上：这一茬长得快三成。" },
  fertCare: { name: "提质肥", type: "resource", sell: 6, buy: 18, desc: "堆肥桶出的肥。在田边按 E 打开这块田施上：这一茬照料分 +20（能顶过日常的上限）。" },
  fertWater: { name: "保水肥", type: "resource", sell: 6, buy: 18, desc: "堆肥桶出的肥。在田边按 E 打开这块田施上：这一茬浇一次水管两天。" },
  manure: { name: "鸡粪", type: "resource", sell: 1, desc: "鸡舍和放到田里的鸡留下的。丢进堆肥桶能沤肥。" },
  seedMystery: { name: "神秘种子包", type: "seed", crop: null, mystery: true, protected: true, sell: 12, buy: 30, desc: "一包不知道是什么的种子。种下去才知道：多半是普通作物，有时是早熟、丰产、耐旱的种子，偶尔是新品种。" },
  giant_radish: { name: "巨型萝卜", type: "crop", sell: 160, desc: "四块萝卜长成的一棵。收获展上一棵顶一组（+40 分），也能卖个好价钱。" },
  giant_potato: { name: "巨型土豆", type: "crop", sell: 190, desc: "四块土豆长成的一棵。收获展上一棵顶一组（+40 分），也能卖个好价钱。" },
  giant_pumpkin: { name: "巨型南瓜", type: "crop", sell: 420, desc: "四块南瓜长成的一棵。收获展上一棵顶一组（+40 分），也能卖个好价钱。" },
  giant_corn: { name: "巨型玉米", type: "crop", sell: 260, desc: "四块玉米长成的一棵。收获展上一棵顶一组（+40 分），也能卖个好价钱。" },
};
for (const [id, it] of Object.entries(NEW_ITEMS)) if (!ITEMS[id]) ITEMS[id] = { icon: 34, ...it };
export const GIANT_ITEMS = GIANT.crops.map((c) => "giant_" + c);

// ================= 新建筑 =================
if (!BUILDINGS.compost)
  BUILDINGS.compost = { name: "堆肥桶", icon: 42, cost: { wood: 6 }, w: 34, h: 30, hp: 80, desc: "草料、菜青虫、鸡粪、多的菜丢进去，5 份过一夜出 1 袋肥：快长肥、提质肥、保水肥。按 E 打开。" };

// ================= 说明跟着改 =================
if (BUILDINGS.irrigation) Object.assign(BUILDINGS.irrigation, { name: "喷灌头", desc: "接在水网上：每个钟点从水网取水，浇 300 范围内没浇的田（每块 1 份）。可以开关；水不够时按你在水网里排的顺序先浇。" });
if (TECH.irrigation) Object.assign(TECH.irrigation, { name: "喷灌头", desc: "解锁喷灌头：接在水网上，每个钟点浇 300 范围内的田。" });
if (BUILDINGS.drone) Object.assign(BUILDINGS.drone, { name: "照看机", desc: "每个钟点照看、浇水、捉虫或拔草 300 范围内的 4 块田（每块 1 电，浇水从水网取水）；不收菜，你离开农场一整天以上才替你收菜补种。每 10 次作业用 1 个零件保养。" });
if (TECH.drone) Object.assign(TECH.drone, { name: "照看机", desc: "解锁照看机：消耗电力每个钟点照看、浇水、捉虫、拔草 4 块田；需太阳能供电，每 10 次作业用 1 个零件维护。" });
if (BUILDINGS.greenhouse) BUILDINGS.greenhouse.desc = "保护 220 范围内作物免受高温、暴雨与酸雨减速，成长提高 10%；寒潮里只有温室里的田能长。";
if (BUILDINGS.coop) BUILDINGS.coop.desc = "安置获救的鸡，每天用玉米换鸡蛋；白天能把鸡放进田里吃虫拔草。扩展养殖后可养山羊。";
if (PERKS.cistern) PERKS.cistern.text = "水网多一个水源：每天出 6 份水，能存 30 份";
if (BUILDINGS.rain) BUILDINGS.rain.desc = "水网的水源：每天出 4 份水（雨天 12、高温 0），自己能存 12 份；浇 220 范围内的田。按 E 补满水壶（不花水网的水）。";
// 神秘种子包：废墟里的厨房柜、货箱，一些人的口袋
for (const k of ["kitchen", "cargo"]) if (KINDS[k] && !KINDS[k].uncommon.some((x) => Array.isArray(x) && x[0] === "seedMystery")) KINDS[k].uncommon.push(["seedMystery", 1, 1]);
for (const k of ["farmer", "grocer", "granny"]) if (POCKETS[k]?.normal && !POCKETS[k].normal.some((x) => x[0] === "seedMystery")) POCKETS[k].normal.push(["seedMystery", 1, 1]);

// ================= 画：新品种、杂交苗、巨型作物、物品小图 =================
const L = PAL.leaf,
  E = PAL.ember,
  St = PAL.straw,
  So = PAL.soil,
  Cl = PAL.cloth,
  Sn = PAL.snow,
  N = PAL.night,
  W = PAL.water;
Object.assign(CROP_DRAW, {
  // 金萝卜：萝卜的叶子，熟了地面露出一截金色的根
  goldRadish(P, cx, b, s) {
    const n = s === 1 ? 3 : 5,
      h = s === 1 ? 5 : 8;
    for (let i = 0; i < n; i++) {
      const a = -Math.PI / 2 + (i - (n - 1) / 2) * 0.55;
      P.line(cx, b - 1, cx + Math.cos(a) * h, b - 1 + Math.sin(a) * h, L[3]);
      leafBlob(P, cx + Math.cos(a) * h, b - 1 + Math.sin(a) * h, 1.8, 1.4, i % 2);
    }
    if (s >= 2) {
      P.ellipse(cx, b, s === 3 ? 3 : 2, s === 3 ? 2 : 1.4, s === 3 ? E[4] : St[3]);
      if (s === 3) {
        P.set(cx - 1, b - 1, E[5]);
        P.set(cx + 1, b, "#fff3c0");
      }
    }
  },
  // 冬土豆：叶子带一点霜白
  winterPotato(P, cx, b, s) {
    for (const [dx, dy, r] of [[-4, -3, 2.6], [3, -4, 2.6], [0, -7, 2.2], [-1, -1, 2]].slice(0, s === 1 ? 2 : 4)) leafBlob(P, cx + dx, b + dy, r, r * 0.8, dy < -4 ? 1 : 0);
    if (s >= 2) for (const [dx, dy] of [[-4, -4], [3, -5], [0, -8]]) P.set(cx + dx, b + dy, Sn[4]);
    if (s === 3) {
      P.ellipse(cx - 3, b, 2.2, 1.4, So[3]);
      P.ellipse(cx + 3, b + 1, 2, 1.3, So[3]);
      P.set(cx - 3, b - 1, Sn[3]);
    }
  },
  // 夜光豆：豆架上的豆荚带一点蓝绿的光
  glowBean(P, cx, b, s) {
    const h = s === 1 ? 8 : 16;
    if (s >= 2) {
      P.line(cx - 4, b, cx, b - h - 2, So[2]);
      P.line(cx + 4, b, cx, b - h - 2, So[2]);
    }
    for (let k = 0; k < (s === 1 ? 2 : 5); k++) {
      const y = b - 2 - k * 3,
        side = k % 2 ? 1 : -1;
      leafBlob(P, cx + side * 3, y, 2, 1.5, k % 2);
    }
    if (s >= 2)
      for (const [dx, dy] of [[-3, -6], [3, -9], [-2, -12]]) {
        P.vline(cx + dx, b + dy, b + dy + (s === 3 ? 4 : 2), s === 3 ? W[5] : L[3]);
        P.set(cx + dx, b + dy, s === 3 ? "#e8fff4" : L[5]);
      }
  },
  // 杂交苗：一株两种颜色的叶子
  hybrid(P, cx, b, s) {
    const h = s === 1 ? 6 : s === 2 ? 10 : 13;
    P.vline(cx, b - h, b, L[2]);
    for (let k = 1; k <= (s === 1 ? 2 : 4); k++) {
      const y = b - k * 3;
      leafBlob(P, cx - 3, y, 2, 1.4, 0);
      P.ellipse(cx + 3, y - 1, 2, 1.4, k % 2 ? Cl[2] : St[3]);
    }
    if (s === 3) {
      P.disc(cx, b - h - 1, 1.6, E[4]);
      P.set(cx, b - h - 1, "#fff3c0");
    }
  },
});
// 物品小图：新品种的作物、优质、耐旱、种子包；肥、鸡粪、神秘种子包、巨型作物
Object.assign(CROP_ICON, {
  goldRadish(P, x = 0, y = 0) {
    P.poly([[x + 5, y + 6], [x + 3, y + 1], [x + 7, y + 4]], L[3]);
    P.poly([[x + 8, y + 6], [x + 8, y + 0], [x + 10, y + 5]], L[4]);
    P.poly([[x + 10, y + 7], [x + 13, y + 2], [x + 12, y + 7]], L[3]);
    P.ellipse(x + 8, y + 10, 4, 4, E[4]);
    P.ellipse(x + 7, y + 9, 2, 2, E[5]);
    P.set(x + 6, y + 8, "#fff3c0");
    P.line(x + 8, y + 14, x + 9, y + 15, St[4]);
  },
  winterPotato(P, x = 0, y = 0) {
    P.ellipse(x + 8, y + 9, 6, 4.5, So[3]);
    P.ellipse(x + 7, y + 8, 4, 2.5, So[4]);
    for (const [a, c] of [[5, 7], [10, 7], [8, 11]]) P.set(x + a, y + c, Sn[4]);
    P.hline(x + 4, x + 12, y + 13, So[2]);
  },
  glowBean(P, x = 0, y = 0) {
    P.poly([[x + 2, y + 12], [x + 5, y + 6], [x + 10, y + 3], [x + 14, y + 2], [x + 12, y + 6], [x + 7, y + 10], [x + 3, y + 14]], W[4]);
    P.line(x + 3, y + 12, x + 12, y + 3, W[3]);
    for (const [a, c] of [[5, 9], [8, 6], [11, 4]]) {
      P.disc(x + a, y + c, 1.3, W[5]);
      P.set(x + a - 1, y + c - 1, "#e8fff4");
    }
  },
});
Object.assign(MINI, {
  goldRadish: (P, x, y) => {
    P.ellipse(x + 3, y + 4, 2, 2, E[4]);
    P.vline(x + 3, y + 0, y + 2, L[4]);
    P.set(x + 2, y + 3, E[5]);
  },
  winterPotato: (P, x, y) => {
    P.ellipse(x + 3, y + 3, 3, 2, So[3]);
    P.set(x + 2, y + 2, Sn[4]);
  },
  glowBean: (P, x, y) => {
    P.line(x + 0, y + 5, x + 6, y + 0, W[4]);
    P.set(x + 2, y + 3, W[5]);
    P.set(x + 4, y + 2, "#e8fff4");
  },
});
Object.assign(SEED_BAND, { goldRadish: E[4], winterPotato: Sn[3], glowBean: W[4] });
for (const c of NEW_CROP_IDS) {
  ICON_DRAW[c] = (P) => CROP_ICON[c](P);
  ICON_DRAW["fine_" + c] = (P) => {
    CROP_ICON[c](P);
    BADGE.fine(P);
  };
  ICON_DRAW["hardy_" + c] = (P) => {
    CROP_ICON[c](P);
    BADGE.hardy(P);
  };
  ICON_DRAW[NEW_CROPS[c].seed] = (P) => packet(P, c);
  for (const tr of ["early", "abundant", "hardy"])
    ICON_DRAW["seed_" + c + "_" + tr] = (P) => {
      packet(P, c);
      BADGE[tr](P);
    };
}
// 一只麻袋，袋口一道颜色
const bag = (P, band, mark) => {
  P.poly([[4, 5], [12, 5], [13, 14], [3, 14]], So[3]);
  P.hline(4, 12, 5, So[4]);
  P.rect(5, 3, 6, 2, So[2]);
  P.hline(4, 12, 7, band);
  P.hline(3, 13, 14, So[1]);
  mark(P);
};
Object.assign(ICON_DRAW, {
  fertGrow: (P) =>
    bag(P, L[4], (P) => {
      P.vline(8, 9, 12, L[5]);
      P.set(7, 10, L[5]);
      P.set(9, 10, L[5]);
    }),
  fertCare: (P) =>
    bag(P, E[4], (P) => {
      P.hline(6, 10, 10, E[5]);
      P.vline(8, 8, 12, E[5]);
      P.set(8, 10, "#fff6d0");
    }),
  fertWater: (P) =>
    bag(P, W[4], (P) => {
      for (const [y, x0, x1] of [[8, 8, 8], [9, 7, 9], [10, 7, 9], [11, 7, 9], [12, 8, 8]]) P.hline(x0, x1, y, W[4]);
      P.set(7, 10, W[5]);
    }),
  manure(P) {
    P.ellipse(8, 11, 5, 2.5, So[1]);
    P.ellipse(8, 9, 3.5, 2, So[2]);
    P.ellipse(8, 7, 2, 1.4, So[2]);
    P.set(7, 6, So[3]);
    P.set(4, 4, St[2]);
    P.set(12, 5, St[2]);
  },
  seedMystery(P) {
    packet(P, null);
    P.rect(6, 8, 4, 1, N[3]);
    P.set(9, 9, N[3]);
    P.set(8, 10, N[3]);
    P.set(8, 12, N[3]);
  },
});
for (const c of GIANT.crops) {
  ICON_DRAW["giant_" + c] = (P) => {
    CROP_ICON[c](P);
    // 外面一圈金边：一棵顶四棵
    for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) if (P.opaque(x, y) && (!P.opaque(x - 1, y) || !P.opaque(x + 1, y))) P.set(x, y, E[5]);
    BADGE.fine(P);
  };
}
assignItemIcons();
