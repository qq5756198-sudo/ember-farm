// v0.16.0「前哨四季」：节庆、相邻加成、食堂营业夜、营火夜谈、学徒、过路人借宿，以及六位新人物的数据。
// 判定写在 seasons.js；这里只放文案、数值与位置。
import { ITEMS, RECIPES } from "./data.js";
import { MEAL_ITEMS, NPCS } from "./outpost-data.js";
import { LADDER, PROGRAMS } from "./winter-data.js";

export const SEASONS_SCHEMA = 1;

// ---------- 何大勺的五道菜 ----------
const dish = (id, name, food, sell, desc, extra = {}) => {
  ITEMS[id] ??= { name, icon: 53, type: "food", food, sell, desc, ...extra };
};
dish("armyStew", "行军炖菜", 55, 40, "何大勺老部队的炖菜：土豆、豆子、萝卜一锅出。恢复 55 饥饿。");
dish("radishCake", "萝卜糕", 40, 45, "萝卜擦丝和黑麦粉蒸成的糕，甜口。恢复 40 饥饿。");
dish("fishCongee", "鱼片粥", 50, 60, "银鳞鱼片配黑麦熬的粥，热乎又鲜。恢复 50 饥饿、5 生命。", { heal: 5 });
dish("beanCake", "豆渣饼", 38, 36, "豆子和玉米压成的小饼，讲究的人爱吃。恢复 38 饥饿。");
dish("campBread", "炊事班大饼", 45, 22, "一锅能管一个班的大饼。恢复 45 饥饿。");
ITEMS.mutantFish ??= {
  name: "变异鱼",
  icon: 40,
  type: "resource",
  sell: 0,
  protected: true,
  desc: "鳞片发灰、多了一对鳍的鱼。江伯说该送去给许医生看看。",
};
ITEMS.oldPhoto ??= {
  name: "老照片",
  icon: 40,
  type: "quest",
  protected: true,
  desc: "秦奶奶留下的照片：年轻时的她站在渡船上。放在家里，居民每天都会多看两眼。",
};
ITEMS.songSheet ??= {
  name: "老歌谱",
  icon: 40,
  type: "quest",
  protected: true,
  desc: "老琴散落的歌谱。交给他就能进电台节目单。",
};
const recipe = (r) => {
  if (!RECIPES.some((x) => x.id === r.id)) RECIPES.push(r);
};
recipe({ id: "armyStew", out: { armyStew: 2 }, cost: { potato: 2, bean: 1, radish: 1 }, station: "cook", minutes: 35, desc: "何大勺口述的第一道菜。" });
recipe({ id: "radishCake", out: { radishCake: 2 }, cost: { radish: 3, rye: 1 }, station: "cook", minutes: 30, desc: "何大勺口述的第二道菜。" });
recipe({ id: "fishCongee", out: { fishCongee: 2 }, cost: { fish: 1, rye: 2 }, station: "cook", minutes: 35, desc: "何大勺口述的第三道菜。" });
recipe({ id: "beanCake", out: { beanCake: 2 }, cost: { bean: 2, corn: 1 }, station: "cook", minutes: 25, desc: "何大勺入伙后教的点心。" });
recipe({ id: "campBread", out: { campBread: 3 }, cost: { corn: 2, rye: 1 }, station: "cook", minutes: 30, desc: "何大勺入伙后教的大饼。" });
export const HE_DISHES = ["armyStew", "radishCake", "fishCongee"];
export const HE_BONUS = ["beanCake", "campBread"];
for (const id of [...HE_DISHES, ...HE_BONUS]) if (!MEAL_ITEMS.includes(id)) MEAL_ITEMS.push(id);

// 生活水准第四级：节庆也算“有盼头”。
LADDER[3].need = "两天内电台播过节目，或一周内办过节庆";
// 老琴的歌谱进电台
PROGRAMS.oldsongs ??= { name: "老歌", desc: "播老琴的歌谱：每份歌谱让居民士气 +2。", noise: 1 };

// ---------- 位置 ----------
export const SSPOTS = {
  plaza: { x: 1240, y: 470 }, // 前哨广场：节庆与食堂
  jiang: { x: 960, y: 748 }, // 江伯，池塘边
  ali: { x: 300, y: 742 }, // 阿砾，南边围栏
  murals: { x: 120, y: 770 }, // 壁画起点
  lodger: { x: 236, y: 380 }, // 借宿的人，农舍西边
  gate: { x: 1340, y: 368 }, // 营门
  adou: { x: 896, y: 440 }, // 仓库箱旁（隔开一点，免得和仓库箱抢 E）
  he: { region: "market", x: 780, y: 480 }, // 集市里的何大勺
};
export const SHEET_SPOTS = {
  market: { region: "market", x: 560, y: 520 },
  residential: { region: "residential", x: 680, y: 690 },
  hospital: { region: "hospital", x: 1100, y: 440 },
  warehouse: { region: "warehouse", x: 860, y: 640 },
};

// ---------- 节庆 ----------
export const FEST_EVERY = 7;
export const FEST_KINDS = ["seeds", "lanterns", "harvest", "vigil"];
export const FESTIVALS = {
  seeds: {
    name: "换种集",
    desc: "各家把多余的种子拿来换，换回没种过的品种。",
    pay: "任意 3 种种子各 2 份",
    gain: "换回 3 种少见种子各 3 份、黑麦种子 2 份；声望 +3",
    decor: "banner",
    star: "农场有摊位",
  },
  lanterns: {
    name: "灯火夜",
    desc: "挂灯笼、点篝火，大家吃一顿热乎的。",
    pay: "木材 4、布料 2（做灯笼）",
    gain: "居民士气 +6（每颗星再 +2）；声望 +3",
    decor: "lanterns",
    star: "至少两盏暖光灯",
  },
  harvest: {
    name: "丰收评比",
    desc: "把收成摆上长桌，大家评一评。",
    pay: "任意 3 种作物各 2 份",
    gain: "60 金币（每颗星再 +20）；声望 +3",
    decor: "arch",
    star: "本周收获展交过展品",
  },
  vigil: {
    name: "守夜纪念日",
    desc: "给没能走到今天的人点一盏灯，守一夜。",
    pay: "干粮 6",
    gain: "所有认识的人信任 +1；声望 +5",
    decor: "stone",
    star: "至少一座瞭望塔",
  },
};
export const FEST_COST = { lanterns: { wood: 4, cloth: 2 }, vigil: { bread: 6 } };
export const DECOR = {
  banner: { name: "换种集彩旗" },
  lanterns: { name: "灯笼串" },
  arch: { name: "丰收拱门" },
  stone: { name: "纪念石" },
};
export const FEST_HOURS = [16 * 60, 22 * 60];

// ---------- 布局相邻加成（只加不减） ----------
export const ADJ = [
  { id: "cookChest", a: "cook", b: ["chest"], r: 160, text: "靠近仓库箱：篝火灶加工 +20%", hint: "放在仓库箱旁：加工 +20%", station: "cook", speed: 0.2 },
  { id: "benchChest", a: "workbench", b: ["chest"], r: 160, text: "靠近仓库箱：制作台加工 +15%", hint: "放在仓库箱旁：加工 +15%", station: "workbench", speed: 0.15 },
  { id: "cannerCook", a: "canner", b: ["cook"], r: 160, text: "靠近篝火灶：罐装机加工 +20%", hint: "放在篝火灶旁：加工 +20%", station: "canner", speed: 0.2 },
  { id: "weaponBench", a: "weaponbench", b: ["workbench"], r: 160, text: "靠近制作台：武器工作台加工 +15%", hint: "放在制作台旁：加工 +15%", station: "weaponbench", speed: 0.15 },
  { id: "coopField", a: "coop", plots: 3, r: 180, text: "周围有农田：鸡粪肥田，附近作物 +10%", hint: "放在 3 块以上农田旁：附近作物 +10%", crop: 0.1 },
  { id: "rainField", a: "rain", plots: 4, r: 150, text: "被农田围住：附近作物 +8%", hint: "放在 4 块以上农田中间：附近作物 +8%", crop: 0.08 },
  { id: "towerFence", a: "tower", b: ["fence", "gate"], r: 120, text: "紧挨围栏：瞭望塔射速 +25%", hint: "紧挨围栏或大门：射速 +25%", tower: 0.25 },
  { id: "bedLamp", a: "bed", b: ["lamp"], r: 120, text: "床边有暖光灯：休息的居民每小时多恢复 2 疲劳", hint: "床边放暖光灯：休息恢复更快", rest: 2 },
  { id: "tableCook", a: "table", b: ["cook"], r: 180, text: "餐桌靠近篝火灶：食堂评分 +10%，晚饭士气 +1", hint: "放在篝火灶旁：食堂评分 +10%、晚饭士气 +1", canteen: 0.1 },
  { id: "stallGate", a: "stall", b: ["gate", "table"], r: 200, text: "摊位靠近营门或餐桌：摊位售价 +10%", hint: "放在营门或餐桌旁：售价 +10%", stall: 0.1 },
];

// ---------- 食堂营业夜 ----------
export const CANTEEN_DAYS = [2, 5]; // 每周第几天（day % 7）
export const CANTEEN_HOURS = [19 * 60, 21 * 60 + 30];
export const CANTEEN_GUESTS = 4;
// v0.28：口碑高了一晚最多 6 位（存档检查用这个上限）
export const CANTEEN_MAX = 6;
export const CANTEEN_GAP = 20; // 游戏分钟
export const CANTEEN_PATIENCE = 50;
const has = (ids) => ids.filter((id) => ITEMS[id]);
export const TASTES = {
  hearty: { name: "顶饱的", dishes: has(["bread", "beanMeal", "campBread", "armyStew", "stew", "trailRye"]) },
  hot: { name: "热乎的", dishes: has(["stew", "fishStew", "warmSoup", "armyStew", "fishCongee", "herbTea"]) },
  fresh: { name: "鲜味的", dishes: has(["riverMeal", "fishStew", "nightMeal", "fishCongee"]) },
  sweet: { name: "甜口的", dishes: has(["jam", "radishCake", "milkMeal"]) },
  fancy: { name: "讲究的", dishes: has(["chefMeal", "fineMeal", "eggMeal", "beanCake"]) },
};
export const CANTEEN_MENU = [...new Set(Object.values(TASTES).flatMap((t) => t.dishes))];
export const GUEST_NAMES = ["跑船的老马", "放牛的小雯", "修车的阿灿", "背药箱的周姐", "邻营的二胖", "送信的燕子", "看林子的老顾", "挑担的刘婶"];

// ---------- 营火夜谈 ----------
export const TALK_HOURS = [19 * 60, 23 * 60];
export const TOPICS = {
  past: { name: "说说以前", gain: "在座的人信任 +1" },
  future: { name: "聊聊明天", gain: "所有居民士气 +4" },
  today: { name: "今天的事", gain: "你的农业与战斗经验各 +4，可能听到消息" },
};

// ---------- 学徒 ----------
export const APPRENTICE_DAYS = 3;
export const CRAFTS = {
  farmer: { skill: "water", name: "浇水", desc: "每天 07:00 给最多 6 块没浇的田浇水" },
  mechanic: { skill: "repair", name: "维修", desc: "每天 10:00 和 15:00 给最破的设施修 15 耐久" },
  medic: { skill: "bandage", name: "包扎", desc: "每天 18:00 用 1 条绷带治好营地病号；你在农场受了伤顺手包扎 15 生命" },
};
export const SKILL_NAMES = { water: "浇水", repair: "维修", bandage: "包扎" };

// ---------- 过路人借宿 ----------
export const LODGER_HOURS = [20 * 60, 23 * 60];
export const LODGER_NAMES = ["赶路的木匠老韩", "背琴的学生小柯", "寻亲的冯嫂", "跑单帮的阿九", "退休的邮差孙伯", "牵狗的猎户", "带孩子的梅姐"];
export const LODGER_GIFTS = ["seeds", "tip", "item", "recipe"];

// ---------- 人物 ----------
export const SNPCS = {
  he: {
    name: "何大勺",
    title: "退伍炊事员",
    look: { skin: "#d9a77c", hair: "#2a2420", coat: "#5f6a52", accent: "#f0ead8", extra: "hat" },
    likes: ["potato", "salt"],
    lines: {
      hello: "我那本菜谱本丢在撤退路上了。菜我还记得几道，就是手生了——你帮我做出来尝尝？",
      dish: "对，就是这个味！下一道……",
      joined: "三道都对上了。行，我搬到你们前哨去，一周开两晚食堂。",
    },
  },
  qin: {
    name: "秦奶奶",
    title: "等最后一班渡船的旅客",
    look: { skin: "#f0d2b8", hair: "#e8e4dc", coat: "#7a5a6a", accent: "#d6b4c4", extra: "scarf" },
    likes: ["radishCake", "herbTea"],
    lines: {
      hello: "能借个地方睡一晚吗？我要去南边坐最后一班渡船，找我女儿。",
      wish: "走之前还有三个心愿：再看一次海，再吃一口萝卜糕，再听一首老歌。",
      done: "都齐了。孩子，这张照片留给你们——等我找到女儿，再来看你们。",
    },
  },
  adou: {
    name: "阿豆",
    title: "偷粮的孩子",
    look: { skin: "#e3b48c", hair: "#3b2a20", coat: "#8a6a4a", accent: "#c9a55a", extra: "scar" },
    likes: ["jam", "radishCake"],
    lines: {
      caught: "别、别告诉别人……我妹妹发烧好几天了，我只是想给她弄点吃的。",
      note: "（仓库门口压着一张字条：谢谢没抓我。我妹妹病了。——阿豆）",
      thanks: "她退烧了！我能帮你们跑腿，送信、看仓库，什么都行。",
    },
  },
  ali: {
    name: "阿砾",
    title: "画墙的少年",
    look: { skin: "#d9a77c", hair: "#1f1d1c", coat: "#4f6a7a", accent: "#e9c05a", extra: "goggles" },
    likes: ["cloth", "resin"],
    lines: {
      hello: "（围栏上画满了歪歪扭扭的图案。一个少年拎着炭条，看见你就僵住了。）",
      scolded: "知道了……我走就是。",
      paint: "真的？那我把前哨的大事都画上去！从种下第一株萝卜开始。",
    },
  },
  laoqin: {
    name: "老琴",
    title: "流浪歌手",
    look: { skin: "#c99572", hair: "#7a7a7a", coat: "#6b4f3a", accent: "#e0d090", extra: "hat" },
    likes: ["herbTea", "fishStew"],
    lines: {
      hello: "我只唱老歌，新歌唱不来。可惜歌谱散了一路——集市、住宅区、医院、仓库，各丢了一张。",
      sheet: "就是这张！我拿去给电台，让大家都听得见。",
      song: "（老琴拨了拨弦，唱起一首谁都会跟着哼的老歌。）",
    },
  },
  jiang: {
    name: "江伯",
    title: "老渔夫",
    look: { skin: "#c99a76", hair: "#d8d8d0", coat: "#3f5a6a", accent: "#9fd3e0", extra: "hat" },
    likes: ["bread", "resin"],
    lines: {
      hello: "这池子的鱼一年比一年少。年轻人，帮我钓几条看看成色？",
      mutant: "这鳞片不对……灰的，还多一对鳍。水里有东西。你钓到这样的，拿来给我。",
      release: "许医生说是上游的污水。我养了一池干净的鱼苗，咱们一起放了吧。",
      done: "鱼会回来的。以后这池子归你钓。",
    },
  },
};
for (const [id, n] of Object.entries(SNPCS)) NPCS[id] ??= n;
export const JIANG_TASKS = {
  c1: { need: { fish: 2 }, name: "钓两条银鳞鱼", reward: "鱼竿升级：咬钩快 0.4 秒" },
  c2: { need: { riverFish: 1 }, name: "钓一条蓝背鱼", reward: "鱼竿再升级：咬钩再快 0.4 秒；弹药 6" },
  mutant: { need: { mutantFish: 1 }, name: "钓到一条变异鱼", reward: "江伯转交许医生：研究点 +1" },
  release: { need: { herb: 2, fish: 1 }, name: "放流净化鱼苗（药草 2、银鳞鱼 1）", reward: "池塘更容易钓到蓝背鱼和夜鱼" },
};

// 生日：每 28 天一轮的第几天。生日那天送喜欢的东西，信任翻倍。
export const BIRTHDAYS = { farmer: 5, medic: 12, mechanic: 19, tieqiao: 9, tangjiu: 23, youke: 15, he: 3, adou: 26, ali: 17, laoqin: 21, jiang: 8 };
export const LIKES = {
  farmer: ["seedHerb", "jam"],
  medic: ["herb", "herbTea"],
  mechanic: ["parts", "circuit"],
  tieqiao: ["bread", "stew"],
  tangjiu: ["salt", "parts"],
  youke: ["circuit", "jam"],
  huer: ["bread", "fishStew"],
  yaozi: ["ammo", "stew"],
  zou: ["bread", "potato"],
  ge: ["bread", "warmSoup"],
  alan: ["bean", "radish"],
  amo: ["moonHerb", "herbTea"],
  yeying: ["jam", "herbTea"],
  suyan: ["cloth", "resin"],
};

// ---------- 渐进解锁 ----------
export const FEATURES = {
  calendar: { name: "节庆日历", intro: "点顶栏的日期就能打开。节庆、食堂、商队、尸潮和生日都在这一页。" },
  people: { name: "人物关系", intro: "每个人的信任、喜好和下一段故事。每天可以给每人送一样喜欢的东西。" },
  plaza: { name: "前哨广场", intro: "每 7 天一次节庆在这里办；何大勺入伙后，每周两晚在这里开食堂。" },
  decrees: { name: "法令簿", intro: "每条法令都有好处也有代价；改签后两天内不能再改。" },
  radio: { name: "电台节目单", intro: "每晚 21:00 播一档节目。动静满了会引来感染者。" },
  museum: { name: "档案馆", intro: "捐赠鱼、药草标本、日志、照片和遗物，填满展柜得到永久加成。" },
  collection: { name: "成就册", intro: "一页看全部收藏进度和奖励。" },
  winter: { name: "寒潮与暖区", intro: "寒潮里只有暖区里的人和作物不受冻。" },
};
