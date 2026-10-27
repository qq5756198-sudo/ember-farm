// v0.31.0「重光」：星露谷 30 个好玩点移植方案第三版（看得见的重光）的数据。
// 判定写在 relight.js；故事、残页、独白写在 relight-story.js；每层隧道怎么拼写在 tunnel-gen.js。这里只放数值、清单、旧物、新物品和它们的小图。
// 1. 重建清单：农场上自己选地方建一座重建站，里面 6 面墙、28 份清单；交满一面墙，余烬地区恢复一样（通电、通水、开课、开诊、通车、通话）；六面都交满放一次信号烟花。
// 2. 旧世界陈列：档案馆的「往事」柜扩成 48 件旧物（8 组，每组 6 件），每件附一句主人的故事；锁着的铁盒拿回营地让陈工撬开。
// 3. 地铁隧道：地底避难城的医院升降井往下 30 层，每层按存档种子拼出来；每 5 层一部检修电梯，每 10 层一间物资库，第 30 层有一颗余烬核。
// 4. 残页：柜子、感染者身上、鱼钩上翻出来的 24 张：日记（透露最爱）、藏货谜题（在原来的图上挖）、水为什么一直被污染。
// 5. 年终评定：每年守夜纪念日那晚联盟来一封评定信，八项打分，纪念石上点 1–4 盏灯；成就册里的收复度。
// 6. 鼎丰物资：签约后每面墙都能花钱直接买下；代价是公司规矩、心情、有人想走、邻居不来、结局换样子；能撕合同。
// 7. 余烬核：7 颗，每颗体力上限 +15、生命上限 +5。
import { ITEMS, BUILDINGS, REGIONS } from "./data.js";
import { PAL } from "./pixel-kit.js";
import { DRAW as ICON_DRAW } from "./item-sprites.js";
import { TUNNEL_FOES } from "./tunnel-gen.js";

export const RL_SCHEMA = 1;

// ================= 重建站 =================
export const STATION = { type: "rlStation", name: "重建站", cost: { wood: 20, stone: 12, scrap: 8 }, w: 52, h: 40, hp: 160 };
if (!BUILDINGS.rlStation)
  BUILDINGS.rlStation = { name: STATION.name, icon: 40, cost: { ...STATION.cost }, w: STATION.w, h: STATION.h, hp: STATION.hp, desc: "6 面墙、28 份重建清单：按清单凑齐一组东西交上去，交满一面墙，余烬地区就恢复一样（通电、通水、开课、开诊、通车、通话）。整个营地只建一座。" };
// 第一次点满 4 盏灯给的老怀表：摆出来全营士气 +3（只有一件）
if (!BUILDINGS.rlWatch) BUILDINGS.rlWatch = { name: "老怀表", icon: 40, cost: {}, w: 22, h: 22, hp: 60, retired: true, desc: "年终评定第一次点满 4 盏灯，联盟捎来的一只老怀表，还在走。摆在营地里，全营士气 +3。只有一件。" };

// ================= 六面墙 =================
export const WALLS = {
  water: { name: "通水", short: "水网每天多 10 份水", text: "旧水厂的支管接上了：水网每天多 10 份水，旱季也够浇。" },
  clinic: { name: "开诊", short: "伤员少躺一天", text: "许医生在营地开了门诊：受伤的人少躺一天。" },
  school: { name: "开课", short: "带徒、改学快一倍", text: "营地办起了小课堂：带徒、改学职能都快一倍（3 天变 2 天；有阅览室时 1 天）。" },
  radio: { name: "通话", short: "求援多来一个邻居", text: "电台的天线杆立起来了，联系上更远的邻居：发「求援」时多来一个人。" },
  power: { name: "通电", short: "农场到集市一路的路灯亮了", text: "农场到集市一路的路灯重新亮起：夜行者不走亮着的路，摸到农场边上的晚上少一半。" },
  rail: { name: "通车", short: "进出农场路上省一半时间", text: "北线货运站的轨道车直通农场：进出农场路上的时间省一半。" },
};
export const WALL_IDS = Object.keys(WALLS);
// 墙的效果用的数
export const WALL_FX = { prowlCut: 0.5, water: 10, rail: 0.5, injury: 1440, ally: { name: "老魏", look: 7 } };

// 清单里“哪样都行”的一格
export const GROUPS = {
  decor: { name: "旧物摆件（哪样都行）", match: (id) => id.startsWith("alDecor_") },
};
// 每份清单：need = [[物品或 @组, 数量], …]，全部交满算一份；交满给 reward（gold 是金币）
export const LISTS = {
  // ---- 通水：农场、池塘、野地就凑得齐 ----
  w_pond: { wall: "water", name: "池塘里的鱼", need: [["fish", 3], ["riverFish", 1], ["kinCrucian", 2], ["alLoach", 1]], reward: { fertWater: 4 }, hint: "林边池塘：蓝背鱼下雨天或用鱼饵，雨鳅只在下雨天，鲫鱼在回暖、秋收的白天。" },
  w_thaw: { wall: "water", name: "回暖的田", need: [["potato", 8], ["herb", 4], ["cotton", 3], ["prime_potato", 1]], reward: { seed_potato_abundant: 4 }, hint: "土豆回暖当季（酷暑反季），照顾得好偶尔收到上品。" },
  w_wild: { wall: "water", name: "野地里的东西", need: [["alShepherd", 3], ["alPurslane", 3], ["alBerry", 3], ["alMushroom", 1]], reward: { alDumpling: 2 }, hint: "荠菜、马齿苋在回暖，野莓在酷暑；雨后的蘑菇让许医生认过。" },
  w_pump: { wall: "water", name: "修水泵", need: [["parts", 4], ["scrap", 15], ["wood", 12], ["cloth", 2]], reward: { repairKit: 2 }, hint: "常用的材料，废墟里都翻得到。" },
  w_heat: { wall: "water", name: "酷暑的田", need: [["tomato", 6], ["bean", 6], ["corn", 4], ["prime_tomato", 1]], reward: { fertCare: 4 }, hint: "番茄酷暑当季（寒潮反季），上品要照顾得好。" },
  // ---- 开诊：医院、鸡舍、灶台 ----
  c_meds: { wall: "clinic", name: "药柜", need: [["bandage", 6], ["medkit", 2], ["herbTea", 2]], reward: { gold: 150 }, hint: "医院的药柜、制作台和灶台。" },
  c_herbs: { wall: "clinic", name: "药草", need: [["herb", 6], ["fine_herb", 1], ["alMushroom", 2]], reward: { seed_herb_abundant: 3 }, hint: "药草田；优质的要好种子或提质肥。" },
  c_meals: { wall: "clinic", name: "病号饭", need: [["egg", 4], ["milk", 2], ["stew", 2], ["fishStew", 1]], reward: { gold: 120 }, hint: "鸡舍的鸡蛋、山羊奶，灶台上的炖汤。" },
  c_nurse: { wall: "clinic", name: "护士长", need: [["trophyNurse", 1], ["remedy", 1]], reward: { bandage: 6 }, hint: "旧医院的护士长每 7 天出来一回；第二次起打赢也掉胸牌。" },
  c_ward: { wall: "clinic", name: "病房", need: [["cloth", 6], ["wool", 2], ["filterFabric", 1]], reward: { gold: 200 }, hint: "羊毛找阿兰（寒潮里给她的羊分过饲料，她留下的两只羊两天剪一回），滤材在地底避难城的滤材工坊。" },
  // ---- 开课：摆件、点心、种子、秋天 ----
  s_desk: { wall: "school", name: "讲台", need: [["@decor", 3]], reward: { gold: 150 }, hint: "柜子里翻到的旧物摆件，哪样都行。" },
  s_lunch: { wall: "school", name: "孩子们的午饭", need: [["radishCake", 2], ["beanCake", 2], ["jam", 2], ["alDumpling", 1]], reward: { kinCandy: 3 }, hint: "何大勺教的点心，番茄罐头，荠菜团子。" },
  s_seeds: { wall: "school", name: "学农", need: [["seedRadish", 5], ["seedBean", 5], ["seedCorn", 5], ["seedPumpkin", 3], ["seedHerb", 3], ["seedCotton", 3]], reward: { seedMystery: 2 }, hint: "集市林姨那儿都买得到。" },
  s_room: { wall: "school", name: "教室", need: [["wood", 20], ["cloth", 4], ["rlBulb", 1], ["parts", 2]], reward: { gold: 150 }, hint: "信号灯泡在地铁隧道第 6 层往下的柜子里。" },
  s_autumn: { wall: "school", name: "秋天的课", need: [["alChestnut", 4], ["alJujube", 4], ["prime_corn", 1], ["prime_pumpkin", 1]], reward: { alChestnutStew: 2 }, hint: "秋收时节：地上的栗子和野枣，当季的上品玉米、南瓜。" },
  // ---- 通话：电路、远处的水、给邻居的礼 ----
  r_wire: { wall: "radio", name: "线材", need: [["circuit", 2], ["kinBattery", 1], ["rlCopper", 4]], reward: { parts: 4 }, hint: "铜线在地铁隧道里，电池在仓库的柜子里。" },
  r_far: { wall: "radio", name: "远处的鱼", need: [["kinMinnow", 2], ["kinYellowCat", 1], ["kinSeabass", 1], ["kinCroaker", 1], ["kinMandarin", 1]], reward: { gold: 250 }, hint: "溪谷的河、沉湾的海；鳜鱼只在秋收时节的河里，最难钓。" },
  r_gifts: { wall: "radio", name: "给邻居的礼", need: [["alPickle", 3], ["alWine", 2], ["jam", 2], ["bread", 10]], reward: { gold: 150 }, hint: "腌缸、土酒坛、灶台。" },
  r_mast: { wall: "radio", name: "天线杆", need: [["scrap", 30], ["resin", 2], ["rlSpike", 4]], reward: { circuit: 1 }, hint: "松脂在雾松林场，道钉在地铁隧道第 11 层往下。" },
  // ---- 通电：隧道里的铜线和灯泡、仓库守卫、会发光的东西 ----
  p_copper: { wall: "power", name: "铜线", need: [["rlCopper", 12], ["circuit", 2]], reward: { gold: 200 }, hint: "地铁隧道的柜子里。" },
  p_bulbs: { wall: "power", name: "路灯", need: [["rlBulb", 5], ["scrap", 20], ["parts", 4]], reward: { gold: 150 }, hint: "信号灯泡在地铁隧道第 6 层往下。" },
  p_guard: { wall: "power", name: "仓库守卫", need: [["trophyGuard", 1], ["ammo", 40]], reward: { parts: 6 }, hint: "工业仓库的精英守卫；第二次起打赢也掉护甲片。" },
  p_glow: { wall: "power", name: "会发光的", need: [["glowBean", 6], ["nightFish", 2], ["moonHerb", 1]], reward: { gold: 180 }, hint: "田里豆子杂交出来的夜光豆（溪谷残页说的藏货点里也有种子）、池塘夜里的金尾夜鱼、阿默晚上卖的月影草。" },
  p_engine: { wall: "power", name: "发电机", need: [["parts", 8], ["circuit", 2], ["alWineAged", 1], ["rlRelay", 3]], reward: { gold: 300 }, hint: "陈酿当燃料；继电器在地铁隧道第 21 层往下。" },
  // ---- 通车：深处的道钉和继电器、头目、干粮、一年四季 ----
  t_rails: { wall: "rail", name: "轨道", need: [["rlSpike", 16], ["scrap", 30], ["wood", 20]], reward: { gold: 200 }, hint: "道钉在地铁隧道第 11 层往下。" },
  t_cart: { wall: "rail", name: "轨道车", need: [["parts", 10], ["trophyBrute", 1], ["rlRelay", 3], ["rlCopper", 6]], reward: { gold: 250 }, hint: "大块头的铁指虎当配重；第二次起打赢也掉。" },
  t_food: { wall: "rail", name: "路上的干粮", need: [["trailRye", 3], ["armyStew", 2], ["alPickleOld", 2], ["alWineAged", 1]], reward: { gold: 200 }, hint: "老坛腌菜放 7 天、陈酿放 10 天。" },
  t_seasons: { wall: "rail", name: "四季的上品", need: [["prime_potato", 1], ["prime_tomato", 1], ["prime_pumpkin", 1], ["prime_rye", 1], ["alFrostPersimmon", 2]], reward: { gold: 300 }, hint: "四个时节各有当季的上品；冻柿子只在寒潮时节。" },
};
export const LIST_IDS = Object.keys(LISTS);
export const WALL_LISTS = Object.fromEntries(WALL_IDS.map((w) => [w, LIST_IDS.filter((id) => LISTS[id].wall === w)]));

// ================= 信号烟花 =================
export const FIREWORKS = { noise: 30 };

// ================= 鼎丰物资 =================
export const COMPANY = {
  name: "鼎丰物资",
  sign: 2000,
  price: { water: 6000, clinic: 8000, school: 8000, radio: 8000, power: 12000, rail: 12000 },
  cut: 0.1,
  mood: -5,
  leaveEvery: 14,
  leaveDays: 2,
};

// ================= 旧世界陈列：48 件旧物 =================
// home：在哪片废墟、哪种柜子里翻得到（tunnel 是地铁隧道的柜子）；故事在 relight-story.js
export const OLD_GROUPS = {
  family: { name: "一家人", reward: { mood: 5, rep: 5 }, text: "居民士气 +5、营地声望 +5" },
  classroom: { name: "一间教室", reward: { research: 1 }, text: "蓝图凭证 +1" },
  lastbus: { name: "最后一班车", reward: { gold: 300 }, text: "300 金币" },
  hospital: { name: "医院", reward: { items: { medkit: 3, remedy: 1 } }, text: "药包 3、特效药 1" },
  workers: { name: "上班的人", reward: { items: { parts: 8, circuit: 2 } }, text: "机械零件 8、电子电路 2" },
  neighbours: { name: "街坊", reward: { rep: 10 }, text: "营地声望 +10" },
  festival: { name: "节日", reward: { mood: 5, items: { kinCandy: 3 } }, text: "居民士气 +5、水果糖 3" },
  far: { name: "远方", reward: { items: { seedMystery: 3 } }, text: "神秘种子包 3" },
};
export const OLD_GROUP_IDS = Object.keys(OLD_GROUPS);
const R = (kinds) => ({ region: "residential", kinds }),
  H = (kinds) => ({ region: "hospital", kinds }),
  WH = (kinds) => ({ region: "warehouse", kinds }),
  TN = { region: "tunnel", kinds: [] };
export const OLD = {
  // 一家人
  rlOld_photo: { name: "全家福", group: "family", home: R(["wardrobe", "kitchen"]), icon: ["frame", "ember"] },
  rlOld_cert: { name: "结婚证", group: "family", home: R(["wardrobe"]), icon: ["book", "cloth"] },
  rlOld_feeder: { name: "奶瓶", group: "family", home: R(["kitchen"]), icon: ["bottle", "snow"] },
  rlOld_teeth: { name: "乳牙盒", group: "family", home: R(["wardrobe", "kitchen"]), icon: ["box", "soil"] },
  rlOld_hukou: { name: "户口本", group: "family", home: R(["wardrobe"]), icon: ["book", "night"] },
  rlOld_letter: { name: "一封家书", group: "family", home: R(["wardrobe", "kitchen"]), icon: ["letter", "straw"] },
  // 一间教室
  rlOld_card: { name: "学生证", group: "classroom", home: R(["wardrobe"]), icon: ["card", "water"] },
  rlOld_homework: { name: "作业本", group: "classroom", home: R(["wardrobe", "toolbox"]), icon: ["book", "leaf"] },
  rlOld_chalk: { name: "粉笔盒", group: "classroom", home: R(["toolbox", "garage"]), icon: ["box", "snow"] },
  rlOld_scarf: { name: "红领巾", group: "classroom", home: R(["wardrobe"]), icon: ["cloth", "cloth"] },
  rlOld_grad: { name: "毕业照", group: "classroom", home: R(["wardrobe", "kitchen"]), icon: ["frame", "stone"] },
  rlOld_eraser: { name: "黑板擦", group: "classroom", home: R(["toolbox"]), icon: ["block", "soil"] },
  // 最后一班车（地铁隧道）
  rlOld_metro: { name: "地铁卡", group: "lastbus", home: TN, icon: ["card", "ember"] },
  rlOld_ticket: { name: "末班车票", group: "lastbus", home: TN, icon: ["ticket", "straw"] },
  rlOld_gloves: { name: "司机的白手套", group: "lastbus", home: TN, icon: ["glove", "snow"] },
  rlOld_script: { name: "车站广播稿", group: "lastbus", home: TN, icon: ["letter", "snow"] },
  rlOld_pass: { name: "公交月票", group: "lastbus", home: TN, icon: ["ticket", "water"] },
  rlOld_sign: { name: "站名牌", group: "lastbus", home: TN, icon: ["plate", "night"] },
  // 医院
  rlOld_chart: { name: "病历本", group: "hospital", home: H(["medicine", "wardrobe"]), icon: ["book", "water"] },
  rlOld_reg: { name: "挂号单", group: "hospital", home: H(["medicine", "kitchen"]), icon: ["ticket", "snow"] },
  rlOld_band: { name: "婴儿手环", group: "hospital", home: H(["medicine", "wardrobe"]), icon: ["ring", "cloth"] },
  rlOld_thermo: { name: "体温计", group: "hospital", home: H(["medicine"]), icon: ["stick", "cloth"] },
  rlOld_cap: { name: "护士帽", group: "hospital", home: H(["wardrobe"]), icon: ["cap", "snow"] },
  rlOld_discharge: { name: "出院小结", group: "hospital", home: H(["medicine", "kitchen"]), icon: ["letter", "water"] },
  // 上班的人
  rlOld_badge: { name: "工牌", group: "workers", home: WH(["toolbox", "garage"]), icon: ["card", "leaf"] },
  rlOld_keys: { name: "车钥匙", group: "workers", home: WH(["garage", "cargo"]), icon: ["key", "ember"] },
  rlOld_case: { name: "公文包", group: "workers", home: WH(["cargo", "toolbox"]), icon: ["bag", "soil"] },
  rlOld_punch: { name: "打卡卡片", group: "workers", home: WH(["toolbox"]), icon: ["ticket", "stone"] },
  rlOld_helmet: { name: "安全帽", group: "workers", home: WH(["garage", "toolbox"]), icon: ["cap", "straw"] },
  rlOld_namecard: { name: "一盒名片", group: "workers", home: WH(["cargo", "garage"]), icon: ["box", "snow"] },
  // 街坊
  rlOld_phone: { name: "旧手机", group: "neighbours", home: R(["kitchen", "garage"]), icon: ["phone", "night"] },
  rlOld_doorkey: { name: "门钥匙", group: "neighbours", home: R(["kitchen", "wardrobe"]), icon: ["key", "cloth"] },
  rlOld_mahjong: { name: "一副麻将", group: "neighbours", home: R(["kitchen", "garage"]), icon: ["box", "leaf"] },
  rlOld_scale: { name: "菜市场的秤", group: "neighbours", home: R(["garage", "toolbox"]), icon: ["stick", "stone"] },
  rlOld_basket: { name: "菜篮子", group: "neighbours", home: R(["kitchen"]), icon: ["bag", "straw"] },
  rlOld_clips: { name: "一串晾衣夹", group: "neighbours", home: R(["wardrobe", "kitchen"]), icon: ["clips", "cloth"] },
  // 节日
  rlOld_candle: { name: "生日蜡烛", group: "festival", home: R(["kitchen"]), icon: ["candle", "ember"] },
  rlOld_couplet: { name: "春联", group: "festival", home: R(["wardrobe", "kitchen"]), icon: ["scroll", "cloth"] },
  rlOld_envelope: { name: "红包", group: "festival", home: R(["wardrobe"]), icon: ["letter", "cloth"] },
  rlOld_mooncake: { name: "月饼铁盒", group: "festival", home: WH(["cargo"]), icon: ["box", "ember"] },
  rlOld_candybox: { name: "喜糖盒", group: "festival", home: WH(["cargo"]), icon: ["box", "cloth"] },
  rlOld_firework: { name: "一筒小烟花", group: "festival", home: WH(["cargo", "garage"]), icon: ["candle", "cloth"] },
  // 远方
  rlOld_postcard: { name: "明信片", group: "far", home: TN, icon: ["letter", "water"] },
  rlOld_passport: { name: "护照", group: "far", home: TN, icon: ["book", "cloth"] },
  rlOld_atlas: { name: "地图册", group: "far", home: WH(["cargo"]), icon: ["book", "straw"] },
  rlOld_plane: { name: "飞机模型", group: "far", home: TN, icon: ["plane", "snow"] },
  rlOld_stamps: { name: "邮票册", group: "far", home: WH(["cargo", "toolbox"]), icon: ["book", "ember"] },
  rlOld_drift: { name: "漂流瓶", group: "far", home: TN, icon: ["bottle", "water"] },
};
export const OLD_IDS = Object.keys(OLD);
// 翻到旧物的几率：柜子（锁着的翻倍）、隧道里的柜子、感染者身上、铁盒；只出还没拿到、没捐的
export const OLD_RULES = { chance: 0.062, locked: 0.124, tunnel: 0.095, kill: 0.0065 };
// 锁着的铁盒：拿回营地让陈工撬开（零件 1）
export const BOX = { chance: 0.02, locked: 0.07, tunnel: 0.04, cost: { parts: 1 }, odds: [["old", 38], ["circuit", 33], ["seeds", 29]] };

// ================= 残页 =================
// 24 张：日记 8（透露这个人最爱的两样）、藏货谜题 8（在原来的图上挖）、水为什么一直被污染 8（按顺序拼起来）
export const PAGE_RULES = { chance: 0.023, locked: 0.046, tunnel: 0.022, kill: 0.004, fish: 0.013 };
export const DIARY_PEOPLE = ["farmer", "medic", "mechanic", "jiang", "qin", "laoqin", "he", "youke"];
// 藏货点：在哪张图、按 E 挖；挖出来的东西（old: 顺带一件还没找到的旧物）
export const DIGS = {
  d1: { region: "residential", x: 1020, y: 900, reward: { gold: 90, items: { parts: 3, seedMystery: 1 } }, old: true },
  d2: { region: "hospital", x: 665, y: 332, reward: { gold: 80, items: { medkit: 2, bandage: 3 } }, old: true },
  d3: { region: "warehouse", x: 525, y: 770, reward: { gold: 100, items: { circuit: 1, parts: 4 } }, old: true },
  d4: { region: "market", x: 520, y: 860, reward: { gold: 120, items: { seedMystery: 2 } }, old: true },
  d5: { region: "courtyard", x: 1064, y: 412, reward: { gold: 110, items: { cloth: 4, kinBattery: 1 } }, old: true },
  d6: { region: "stationMarket", x: 840, y: 810, reward: { gold: 120, items: { circuit: 1, alWine: 2 } }, old: true },
  d7: { region: "valley", x: 650, y: 570, reward: { gold: 100, items: { seed_glowBean_abundant: 2, fertCare: 4 } }, old: true },
  d8: { region: "railDepot", x: 210, y: 360, reward: { gold: 140, items: { rlSpike: 4, rlCopper: 4 } }, old: true },
};
export const DIG_IDS = Object.keys(DIGS);
export const PAGES = {
  // 日记
  p01: { kind: "diary", who: "farmer" },
  p02: { kind: "diary", who: "medic" },
  p03: { kind: "diary", who: "mechanic" },
  p04: { kind: "diary", who: "jiang" },
  p05: { kind: "diary", who: "qin" },
  p06: { kind: "diary", who: "laoqin" },
  p07: { kind: "diary", who: "he" },
  p08: { kind: "diary", who: "youke" },
  // 藏货谜题
  p09: { kind: "riddle", dig: "d1" },
  p10: { kind: "riddle", dig: "d2" },
  p11: { kind: "riddle", dig: "d3" },
  p12: { kind: "riddle", dig: "d4" },
  p13: { kind: "riddle", dig: "d5" },
  p14: { kind: "riddle", dig: "d6" },
  p15: { kind: "riddle", dig: "d7" },
  p16: { kind: "riddle", dig: "d8" },
  // 水为什么一直被污染（按顺序）
  p17: { kind: "lore", n: 1 },
  p18: { kind: "lore", n: 2 },
  p19: { kind: "lore", n: 3 },
  p20: { kind: "lore", n: 4 },
  p21: { kind: "lore", n: 5 },
  p22: { kind: "lore", n: 6 },
  p23: { kind: "lore", n: 7 },
  p24: { kind: "lore", n: 8 },
};
export const PAGE_IDS = Object.keys(PAGES);
export const PAGE_KINDS = { diary: "日记", riddle: "藏货谜题", lore: "水的来历" };

// ================= 地铁隧道 =================
export const TUNNEL = {
  floors: 30,
  lifts: [5, 10, 15, 20, 25],
  stores: [10, 20, 30],
  // 修检修电梯：越深越贵
  liftCost: {
    5: { parts: 3, scrap: 10 },
    10: { parts: 4, scrap: 12, rlCopper: 2 },
    15: { parts: 5, scrap: 14, circuit: 1 },
    20: { parts: 6, scrap: 16, circuit: 1, rlBulb: 1 },
    25: { parts: 7, scrap: 18, circuit: 2, rlSpike: 2 },
  },
  ride: 5, // 坐检修平台下到第 1 层或修好的电梯层（分钟）
  down: 10, // 顺着检修梯下一层（分钟）
  downSta: 4,
  up: 10, // 从隧道回升降井（分钟，另加每层 1 分钟）
  upPer: 1,
  storeEvery: 7, // 物资库的柜子 7 天搬空一回
  // 越往下越多、越凶（数在 tunnel-gen.js 的 FOE_TUNE 里调）
  foes: (f) => TUNNEL_FOES.count(f),
  hp: (f) => TUNNEL_FOES.hp(f),
  hit: (f) => TUNNEL_FOES.hit(f),
  // 掉的材料：从第几层起、几率、几个
  mats: {
    rlCopper: { from: 1, chance: 0.5, n: [2, 4] },
    rlBulb: { from: 6, chance: 0.3, n: [1, 2] },
    rlSpike: { from: 11, chance: 0.3, n: [2, 4] },
    rlRelay: { from: 21, chance: 0.05, n: [1, 1] },
  },
  // 柜子的档次：普通、稀有、精良、珍贵（越深越好）
  odds: (f) => (f <= 10 ? [0.55, 0.33, 0.1, 0.02] : f <= 20 ? [0.45, 0.37, 0.15, 0.03] : [0.36, 0.4, 0.2, 0.04]),
  storeOdds: [0, 0.3, 0.55, 0.15],
  // 带对装备（写在升降井的平台上）
  gear: "第 1–10 层带中期装备，第 11 层往下带后期装备；越往下越黑，带上手电或头灯。",
};

// ================= 余烬核 =================
export const CORES = {
  longnight: { name: "第一个守住的长夜", how: "守住第一个长夜" },
  harvest: { name: "丰收评比的三颗星", how: "丰收评比拿满三颗星" },
  trust: { name: "一个人的信任", how: "和一个人的信任到 10" },
  tunnel: { name: "第 30 层的泵房", how: "下到地铁隧道第 30 层" },
  lists: { name: "重建清单", how: "28 份清单全部交满（花钱买下的墙不算）" },
  review: { name: "年终评定的四盏灯", how: "年终评定点满 4 盏灯" },
  museum: { name: "旧世界陈列", how: "48 件旧物都捐进档案馆" },
};
export const CORE_IDS = Object.keys(CORES);
// night：余烬核的光在夜里招感染者——身上每有一颗，长夜每波多来这么多（抵掉体力、生命上限让长夜变容易的那一截）
export const CORE_BONUS = { sta: 15, hp: 5, night: 0.03 };

// ================= 年终评定 =================
// 每项 0–3 分（at 是 1、2、3 分的门槛），八项加起来 → 灯：0 起 1 盏、9 起 2 盏、14 起 3 盏、19 起 4 盏
export const REVIEW = {
  hour: 21,
  items: [
    { id: "food", name: "存粮", unit: "份口粮", at: [40, 120, 250] },
    { id: "harvest", name: "收成", unit: "回收菜", at: [40, 100, 180] },
    { id: "morale", name: "人心", unit: "平均心情", at: [50, 62, 75] },
    { id: "nights", name: "守夜", unit: "场尸潮和长夜守住了", at: [1, 3, 6] },
    { id: "lists", name: "重建清单", unit: "份交满", at: [3, 10, 20] },
    { id: "old", name: "旧物", unit: "件捐出", at: [4, 15, 30] },
    { id: "trust", name: "信任", unit: "人信任到 6", at: [1, 3, 5] },
    { id: "cores", name: "余烬核", unit: "颗", at: [1, 3, 5] },
  ],
  lamps: [0, 9, 14, 19],
  watchMood: 3,
};

// ================= 收复度 =================
export const COMPLETION = [
  { id: "lists", name: "重建清单", max: LIST_IDS.length },
  { id: "old", name: "旧世界陈列", max: OLD_IDS.length },
  { id: "pages", name: "残页", max: PAGE_IDS.length },
  { id: "cores", name: "余烬核", max: CORE_IDS.length },
  { id: "fish", name: "鱼类图鉴", max: 24 },
  { id: "hearts", name: "心里话", max: 24 },
  { id: "tunnel", name: "地铁隧道", max: TUNNEL.floors },
  { id: "nights", name: "长夜", max: 10 },
];

// ================= 地铁隧道这张图（不进世界地图） =================
if (!REGIONS.tunnel)
  REGIONS.tunnel = {
    name: "地铁隧道",
    sub: "医院升降井下面的旧地铁和防空洞",
    risk: "越往下越黑，感染者越多越凶",
    res: "铜线、信号灯泡、道钉、继电器、旧物",
    asset: "tunnel",
    spawn: { x: 150, y: 512 },
    exit: { x: 150, y: 512 },
    colliders: [],
  };

// ================= 物品 =================
const put = (id, def) => {
  if (!ITEMS[id]) ITEMS[id] = def;
};
for (const [id, o] of Object.entries(OLD)) put(id, { name: o.name, type: "resource", sell: 2, oldThing: true, desc: "「" + OLD_GROUPS[o.group].name + "」的旧物。拿到档案馆的「往事」柜捐出去，苏砚会给它写一张卡片。" });
put("rlIronBox", { name: "锁着的铁盒", type: "resource", sell: 0, desc: "锁着的铁盒，晃一晃有东西响。拿回营地让陈工撬开（零件 1）：可能是一件旧物、一块电路，或者一包种子。" });
put("rlCopper", { name: "铜线", type: "resource", sell: 15, desc: "从地铁隧道的线槽里拆出来的铜线。重建清单里通电、通话、通车都要。" });
put("rlBulb", { name: "信号灯泡", type: "resource", sell: 25, desc: "隧道里信号灯的灯泡，没碎。地铁隧道第 6 层往下的柜子里有。" });
put("rlSpike", { name: "道钉", type: "resource", sell: 10, desc: "钉枕木的道钉，锈了还结实。地铁隧道第 11 层往下的柜子里有。" });
put("rlRelay", { name: "继电器", type: "resource", sell: 60, desc: "信号机房里的老式继电器，咔哒一声还能吸合。地铁隧道第 21 层往下才找得到。" });

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
const TONE = { ember: [E[2], E[4]], cloth: [Cl[1], Cl[2]], snow: [Sn[2], Sn[4]], soil: [So[2], So[4]], night: [N[2], N[3]], straw: [St[2], St[4]], water: [W[3], W[5]], leaf: [L[3], L[5]], stone: [Ro[3], Ro[5]] };
// 旧物按样子分几种画法，颜色各不相同
const SHAPES = {
  frame: (P, [a, b]) => {
    P.rect(3, 3, 10, 11, So[2]);
    P.rect(4, 4, 8, 9, b);
    P.rect(5, 8, 2, 4, a);
    P.rect(8, 7, 2, 5, a);
    P.disc(6, 6, 1, a);
  },
  book: (P, [a, b]) => {
    P.rect(4, 3, 9, 11, a);
    P.rect(4, 3, 2, 11, A[2]);
    P.rect(7, 6, 5, 2, b);
    P.hline(7, 11, 10, b);
  },
  bottle: (P, [a, b]) => {
    P.rect(6, 2, 4, 3, Ro[4]);
    P.rect(5, 5, 6, 9, a);
    P.rect(6, 6, 2, 6, b);
    P.hline(5, 10, 9, Ro[2]);
  },
  box: (P, [a, b]) => {
    P.rect(3, 5, 10, 8, a);
    P.rect(3, 5, 10, 2, b);
    P.rect(7, 8, 2, 2, A[2]);
  },
  letter: (P, [a, b]) => {
    P.rect(2, 4, 12, 9, b);
    P.line(2, 4, 8, 9, a);
    P.line(13, 4, 8, 9, a);
    P.rect(10, 5, 2, 2, Cl[1]);
  },
  card: (P, [a, b]) => {
    P.rect(2, 4, 12, 8, b);
    P.rect(3, 5, 4, 5, a);
    P.hline(8, 12, 6, A[2]);
    P.hline(8, 11, 8, A[2]);
  },
  ticket: (P, [a, b]) => {
    P.rect(2, 5, 12, 6, b);
    for (let y = 5; y < 11; y += 2) P.set(9, y, a);
    P.hline(3, 7, 7, a);
    P.hline(3, 6, 9, A[2]);
  },
  glove: (P, [a, b]) => {
    P.rect(4, 7, 8, 7, a);
    for (let x = 4; x < 12; x += 2) P.rect(x, 3, 1, 5, b);
    P.rect(11, 6, 2, 3, b);
  },
  plate: (P, [a, b]) => {
    P.rect(2, 4, 12, 7, a);
    P.rect(3, 5, 10, 5, b);
    P.hline(4, 11, 7, A[1]);
    P.line(8, 11, 8, 14, Ro[2]);
  },
  ring: (P, [a, b]) => {
    P.disc(8, 9, 5, a);
    P.disc(8, 9, 3, Sn[4]);
    P.rect(6, 3, 4, 3, b);
  },
  stick: (P, [a, b]) => {
    P.line(3, 12, 13, 4, Ro[4]);
    P.line(4, 12, 13, 5, Sn[4]);
    P.disc(4, 12, 1.5, a);
    P.set(11, 6, b);
  },
  cap: (P, [a, b]) => {
    P.ellipse(8, 9, 6, 4, a);
    P.rect(2, 10, 12, 2, b);
    P.rect(7, 6, 2, 2, Cl[1]);
  },
  block: (P, [a, b]) => {
    P.rect(3, 6, 10, 4, a);
    P.rect(3, 10, 10, 3, b);
    for (let x = 4; x < 13; x += 2) P.set(x, 11, Sn[4]);
  },
  key: (P, [a, b]) => {
    P.disc(5, 6, 3, a);
    P.disc(5, 6, 1.2, A[2]);
    P.line(7, 8, 13, 13, b);
    P.set(12, 11, b);
    P.set(13, 12, b);
  },
  bag: (P, [a, b]) => {
    P.rect(3, 6, 10, 8, a);
    P.rect(6, 3, 4, 3, b);
    P.rect(7, 4, 2, 2, A[2]);
    P.hline(3, 12, 9, b);
  },
  phone: (P, [a, b]) => {
    P.rect(5, 2, 7, 12, a);
    P.rect(6, 3, 5, 8, b);
    P.line(7, 4, 10, 7, Sn[4]);
    P.set(8, 12, Sn[3]);
  },
  clips: (P, [a, b]) => {
    P.hline(2, 13, 5, A[2]);
    for (let x = 3; x < 13; x += 3) {
      P.rect(x, 5, 2, 6, x % 2 ? a : b);
    }
  },
  candle: (P, [a, b]) => {
    P.rect(5, 6, 3, 8, a);
    P.rect(9, 7, 3, 7, b);
    P.set(6, 4, E[4]);
    P.set(10, 5, E[4]);
    P.set(6, 5, E[5]);
  },
  scroll: (P, [a, b]) => {
    P.rect(4, 2, 8, 12, a);
    P.rect(5, 3, 6, 10, b);
    P.vline(8, 4, 12, E[4]);
  },
  cloth: (P, [a, b]) => {
    P.poly([[2, 4], [14, 4], [8, 13]], a);
    P.poly([[5, 4], [11, 4], [8, 9]], b);
    P.hline(2, 13, 4, Cl[0]);
  },
  plane: (P, [a, b]) => {
    P.rect(2, 7, 12, 2, a);
    P.poly([[6, 8], [10, 2], [11, 8]], b);
    P.poly([[6, 8], [10, 13], [11, 8]], b);
    P.rect(12, 5, 2, 3, b);
  },
};
for (const [id, o] of Object.entries(OLD)) {
  const [shape, tone] = o.icon;
  ICON_DRAW[id] ??= (P) => SHAPES[shape](P, TONE[tone] || TONE.stone);
}
Object.assign(ICON_DRAW, {
  rlIronBox: (P) => {
    P.rect(2, 5, 12, 9, Ro[2]);
    P.rect(2, 5, 12, 3, Ro[3]);
    P.rect(7, 8, 3, 4, St[3]);
    P.set(8, 10, A[1]);
    P.hline(2, 13, 13, Ro[1]);
  },
  rlCopper: (P) => {
    P.disc(8, 9, 5.5, Ru[2]);
    P.disc(8, 9, 3.5, Ru[3]);
    P.disc(8, 9, 1.5, A[1]);
    P.line(12, 12, 15, 15, E[3]);
  },
  rlBulb: (P) => {
    P.disc(8, 7, 4, E[4]);
    P.disc(7, 6, 1.5, E[5]);
    P.rect(6, 11, 5, 3, Ro[3]);
    P.hline(6, 10, 12, Ro[2]);
  },
  rlSpike: (P) => {
    P.rect(5, 3, 6, 2, Ru[2]);
    P.rect(7, 5, 2, 9, Ru[3]);
    P.set(7, 14, Ru[1]);
  },
  rlRelay: (P) => {
    P.rect(3, 4, 10, 9, N[2]);
    P.rect(4, 5, 8, 4, Ro[4]);
    P.rect(5, 10, 2, 3, St[3]);
    P.rect(9, 10, 2, 3, St[3]);
    P.set(10, 6, Cl[2]);
  },
});
