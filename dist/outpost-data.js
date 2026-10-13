// v0.14.0「商路与火光」：联盟前哨第三至第六段、生存消耗、六位新人物与六项经营玩法的数据。
// 判定写在 outpost.js；这里只放文案、数值与位置。
import { ITEMS, ZOMBIES, REGIONS } from "./data.js";

// 灰隼团枪手：会瞄准、会找掩体、会撤退的掠夺者。
ZOMBIES.raider ??= { name: "灰隼团枪手", icon: 58, hp: 85, speed: 66, damage: 8, xp: 8 };

export const OUTPOST_SCHEMA = 1;

// ---------- 生存消耗 ----------
export const UPKEEP = {
  playerHunger: 1.85, // 在原有统一难度之上，玩家自身饥饿再快 85%（合计约为原始速度的 2.8 倍）
  sleepHunger: 18, // 睡一觉额外消耗的饥饿（原本 12，合计 30）
  starveDamage: 0.6, // 饿到 0 时每秒掉血，会饿晕
  weakSpeed: 0.8, // 饥饿低于 20 时移动变慢
  mealsPerPerson: 2, // 居民与援建队员每天两餐：早上的工作餐 + 晚饭
  dinnerHour: 18,
  playerDaily: 3, // 估算玩家自己每天吃的口粮份数（两顿 + 睡觉的消耗），用于“口粮还能撑几天”
};
export const MEAL_ITEMS = [
  "bread",
  "jam",
  "chefMeal",
  "fineMeal",
  "beanMeal",
  "stew",
  "eggMeal",
  "milkMeal",
  "riverMeal",
  "fishStew",
  "nightMeal",
].filter((id) => ITEMS[id]);

// ---------- 特质 ----------
export const PEOPLE_TRAITS = {
  glutton: { name: "大胃王", desc: "每天吃 3 份口粮" },
  nightowl: { name: "夜猫子", desc: "上午 10 点到晚上 10 点干活" },
  handy: { name: "手巧", desc: "维修和排除故障的效果翻倍" },
  chatty: { name: "话痨", desc: "吃饱后讲笑话：居民士气每天 +3" },
  scared: { name: "怕黑", desc: "天黑后和袭击时不干活" },
  diligent: { name: "勤快", desc: "早上 6 点就开工，多干一个钟点" },
};
export const HELPER_ROLES = {
  carry: "搬运",
  build: "工程",
  scout: "侦察",
  guard: "守卫",
};

// ---------- 农场上的新位置 ----------
export const SPOTS = {
  shipping: { x: 468, y: 342 },
  caravan: { x: 1080, y: 205 },
  gate: { x: 1340, y: 348 },
  lathe: { x: 1095, y: 432 },
  mule: { x: 800, y: 728 },
  prisoner: { x: 990, y: 640 },
  patients: { x: 200, y: 480 },
  quarantine: { x: 205, y: 640 },
  youke: { region: "warehouse", x: 1180, y: 420 },
  cache: { region: "warehouse", x: 900, y: 600 },
  cai: { region: "market", x: 1180, y: 420 },
  escort: { region: "market", x: 600, y: 330 },
};

// ---------- 联盟前哨第三至第六段 ----------
export const ACTS = {
  3: { label: "第三段", name: "药柜空了", reward: { money: 50, reputation: 5 } },
  4: { label: "第四段", name: "机器重新转动", reward: { money: 60, reputation: 5 } },
  5: { label: "第五段", name: "第一支满载的车队", reward: { money: 70, reputation: 8 } },
  6: { label: "第六段", name: "这条路不再交买路钱", reward: { money: 100, reputation: 10 } },
};
export const HOSPITAL_CHOICE = {
  patients: {
    pick: "先运走病人",
    name: "把两名伤员接回农场",
    cost: {},
    desc: "伤员在营地养两天，每人每天吃 1 份口粮；两天都吃上饭，邹家会有一人留下当援建队员。",
  },
  water: {
    pick: "先修医院供水",
    name: "用零件修好医院的水泵",
    cost: { parts: 2, wood: 4 },
    desc: "医院有了干净的水，此后每天给农场仓库送 1 份药草。",
  },
};
export const LATHE_MODES = {
  parts: { pick: "优先零件", name: "零件", input: { scrap: 3 }, output: { parts: 1 }, desc: "每批 废金属×3 → 机械零件×1" },
  cloth: { pick: "优先布料", name: "布料", input: { cotton: 2 }, output: { cloth: 2 }, desc: "每批 棉花×2 → 布料×2" },
  ammo: { pick: "优先弹药", name: "弹药", input: { scrap: 2 }, output: { ammo: 12 }, desc: "每批 废金属×2 → 弹药×12" },
};
export const LATHE_COST = { parts: 4, scrap: 10, wood: 6 };
export const CARGO = {
  food: {
    pick: "运口粮",
    name: "口粮车",
    cost: { bread: 6 },
    desc: "送到住宅前哨：唐九的商队第二天就来，邻里互助的回礼翻倍。",
  },
  medicine: {
    pick: "运药品",
    name: "药品车",
    cost: { bandage: 3, herb: 3 },
    desc: "送到医院前哨：每次在外面受重伤，医院巡回队会给你包扎一次（每天一次）。",
  },
  repair: {
    pick: "运维修件",
    name: "维修车",
    cost: { parts: 3, scrap: 6 },
    desc: "送到仓库前哨：此后维修设施只用 1 份木材。",
  },
};
export const CONVOY_MINUTES = 240;
export const TOLL_COST = { bread: 8, ammo: 12 };
export const RAID_PREP = {
  towers: {
    pick: "修复射点",
    name: "加固东侧射击位",
    cost: { wood: 6, scrap: 6 },
    desc: "袭击时瞭望塔与守卫伤害 +40%，来袭枪手少 2 名。",
  },
  supply: {
    pick: "切断补给",
    name: "去仓库端掉灰隼团的补给点",
    cost: {},
    desc: "到工业仓库的补给点按 E 破坏（不花材料，要跑一趟），来袭枪手少 4 名，并缴获弹药×12。",
  },
  lure: {
    pick: "诱导绕行",
    name: "用干粮和铁皮做诱饵",
    cost: { bread: 4, scrap: 4 },
    desc: "一半枪手被引去别处，晚一分钟才到；尸群不会跟着来。",
  },
};

// ---------- 联盟援建清单 ----------
export const BUNDLES = {
  clinic: {
    name: "医院急救包",
    items: { bandage: 3, herb: 3, cloth: 2, stew: 1 },
    effect: "医院巡回队：每天第一次在外面受重伤时，自动包扎回 30 生命。",
  },
  caravan: {
    name: "商队补给包",
    items: { bread: 4, wood: 6, parts: 2, bean: 4 },
    effect: "唐九的商队每 3 天来一次，所有货便宜一成。",
  },
  workshop: {
    name: "机修工具包",
    items: { scrap: 8, parts: 3, wood: 6, cloth: 1 },
    effect: "维修任何设施只用 1 份木材；工程队员维修效果翻倍。",
  },
  defense: {
    name: "守路弹药包",
    items: { ammo: 24, scrap: 6, bread: 3, bandage: 2 },
    effect: "瞭望塔不再消耗弹药；袭击时守卫多打一发。",
  },
};

// ---------- 流动商队 ----------
const seedOffer = (crop, trait, price) => ({ item: "seed_" + crop + "_" + trait, qty: 2, price, fake: "seed" + crop[0].toUpperCase() + crop.slice(1) });
export const CARAVAN_POOL = [
  seedOffer("radish", "abundant", 36),
  seedOffer("potato", "early", 40),
  seedOffer("bean", "hardy", 40),
  seedOffer("tomato", "abundant", 44),
  seedOffer("corn", "early", 48),
  { item: "parts", qty: 3, price: 54, fake: "scrap" },
  { item: "medkit", qty: 2, price: 58, fake: "bandage" },
  { item: "ammo", qty: 24, price: 42 },
  { item: "circuit", qty: 1, price: 70, fake: "scrap" },
  { tech: "tower", price: 120 },
  { tech: "canner", price: 110 },
  { tech: "irrigation", price: 110 },
  { tech: "greenhouse", price: 130 },
  { tech: "lure", price: 100 },
].filter((o) => o.tech || ITEMS[o.item]);

// ---------- 入营审查 ----------
export const VISITOR_NAMES = ["周小满", "冯岩", "白桦", "祁冬", "陆远", "韩霜", "苗青", "邵禾", "洪石", "童安", "温岚", "骆川"];
export const VISITOR_FROM = ["南边的加油站", "河对岸的村子", "旧城北区", "一辆抛锚的大巴", "倒塌的粮站", "山里的护林站"];
export const VISITOR_SKILL = {
  carry: "以前在粮站扛麻袋，力气大",
  build: "做过电工，会修东西",
  scout: "跑过长途，认得近路",
};
export const VISITOR_CLUES = {
  honest: {
    body: ["手上有几道旧伤疤，早就长好了", "鞋底磨穿了，脚踝有水泡", "脸色发黄，看得出很久没吃饱"],
    papers: ["联盟登记卡，盖着河对岸前哨的章，日期是上个月", "没有证件，说是逃出来时丢了", "一张手写介绍信，签名的人你听阿禾提过"],
    bag: ["半袋干粮渣和一把小刀", "一卷电线和一把螺丝刀", "一张画满路线的旧地图"],
  },
  infected: {
    body: ["左臂缠着渗血的布条，说是被铁丝划的", "脖子上有一道发紫的印子，用衣领挡着", "额头烫得厉害，一直在发抖"],
    papers: ["联盟登记卡，盖着章，日期是上个月", "没有证件，说是逃出来时丢了"],
    bag: ["半袋干粮渣和一把小刀", "一个空水壶"],
  },
  thief: {
    body: ["身上没有伤，手指很灵活", "衣服干净得不像一路逃难来的"],
    papers: ["登记卡上的日期写着下个月", "登记卡上的章是用红笔画的"],
    bag: ["一卷印着前哨编号的绳子", "几颗和你仓库里一样的萝卜种子，还带着标签"],
  },
};
export const HUER_VISITS = [
  {
    papers: "手写的“联盟通行证”，字是用炭条描的，“联”字少了一横",
    story: "“我是联盟派来的特派员，专门检查你们的伙食！”",
  },
  {
    papers: "一张写着“陈工”的工作证，照片上的人留着大胡子——他没胡子",
    story: "“我就是陈工啊，你不认得我了？我……刮胡子了。”",
  },
  {
    papers: "联盟登记卡，章是真的，日期是今天，签发人：楚光",
    story: "“这次是真的！我在联络站排了两天队。能给我一份守门的活吗？”",
    genuine: true,
  },
];

// ---------- 人物 ----------
// 立绘为程序绘制的像素头像：肤色、发色、衣服、配饰。
export const NPCS = {
  tangjiu: {
    name: "唐九",
    title: "流动商队的倒爷",
    look: { skin: "#d9a77c", hair: "#2b2320", coat: "#8a5a3a", accent: "#e3c467", extra: "hat" },
    lines: {
      hello: "全城最低价，不信你去比！比完了记得回来，我的货可不等人。",
      exposed: "哎……被你看出来了。行，钱退你，以后九爷的货，你随便验。",
      debt: "实话说，我欠灰隼团一笔过路钱。不还，他们就扣我的车。你要是肯帮我，我给你带条近路去他们的补给点。",
      trusted: "老朋友来了！今天的货都是真的，我拿招牌担保。",
    },
  },
  huer: {
    name: "胡二",
    title: "营门的老面孔",
    look: { skin: "#e0b48a", hair: "#4a3424", coat: "#5f7a8a", accent: "#c94b3d", extra: "scarf" },
    lines: {
      guard: "站岗我在行！以前我天天在各个营门口站着——当然，是站在外面。",
    },
  },
  hongshu: {
    name: "红薯",
    title: "要工钱的运输骡",
    look: { skin: "#9b7653", hair: "#5a3e28", coat: "#9b7653", accent: "#d9b35a", extra: "bell" },
    lines: {
      hello: "（红薯打了个响鼻，盯着你口袋里的萝卜。）",
      strike: "（红薯站着一动不动。没有萝卜，就没有运输。）",
      paid: "（红薯叼走萝卜，脖子上的铃铛叮当作响，慢悠悠出发了。）",
    },
  },
  cai: {
    name: "蔡眼镜",
    title: "兵器宅",
    look: { skin: "#e6bd95", hair: "#1e1e22", coat: "#3f4a3d", accent: "#9fd3e0", extra: "glasses" },
    lines: {
      hello: "你这枪……没有灵魂。别急，我出几道题，过了，我把压箱底的配件给你。",
      done: "这才像样。记住，好枪是用出来的，不是擦出来的。",
    },
    challenges: [
      { id: "gunKills", text: "用枪击败 10 名感染者", need: 10, reward: { extendedMag: 1, ammo: 12 } },
      { id: "crouchKills", text: "蹲行时击败 3 名敌人", need: 3, reward: { suppressor: 1 } },
      { id: "raiders", text: "击退一次灰隼团袭击", need: 1, reward: { longBarrel: 1, parts: 2 } },
    ],
  },
  yaozi: {
    name: "鹞子",
    title: "灰隼团的叛逃者",
    look: { skin: "#c99a76", hair: "#3a3a3a", coat: "#4b4f55", accent: "#b8433a", extra: "scar" },
    lines: {
      captured: "……要杀要放，给个痛快。",
      talk: "灰隼团的补给线在仓库后面。下次他们来，人不会太多——如果你信我的话。",
      stay: "让我干活？……行，我认得路，出去探路这种事我熟。",
    },
  },
  youke: {
    name: "尤可",
    title: "情绪化的发明家",
    look: { skin: "#efc9a0", hair: "#b0532e", coat: "#6a7f9c", accent: "#f0d27a", extra: "goggles" },
    lines: {
      rescued: "你们是来修机床的吗？太好了，我画了三十张图纸，就差一双手！",
      gadget: "我想到一个好东西！给我点材料，保准有用——这次不会炸。",
      upset: "我饿得脑子转不动了……别怪我，刚才那台机器是它先惹我的。",
    },
    gadgets: {
      alarm: { name: "警报铃", cost: { scrap: 4, parts: 2 }, effect: "尸潮与袭击的预警多 45 秒" },
      collector: { name: "自动收集架", cost: { scrap: 6, parts: 2, wood: 4 }, effect: "做好的成品每个钟点自动进仓库" },
    },
  },
  xiaoqi: {
    name: "小柒",
    title: "联盟终端",
    look: { skin: "#9fd3b0", hair: "#5f7f6e", coat: "#22352b", accent: "#e9c05a", extra: "screen" },
  },
};
export const VISITOR_LOOKS = [
  { skin: "#e3b48c", hair: "#3b2a20", coat: "#6f6a52", accent: "#c9a55a" },
  { skin: "#c99572", hair: "#1f1d1c", coat: "#5a6e7a", accent: "#a8c47a" },
  { skin: "#f0caa6", hair: "#7a4a2a", coat: "#7d5a4c", accent: "#e0d090" },
  { skin: "#b98762", hair: "#2e2e2e", coat: "#4f6650", accent: "#d7b66a" },
];

export const regionName = (id) => REGIONS[id]?.name || id;
// 本轮新增的场景对象类型（旧版已有的 "outpost" 施工点不在其中）。
export const OUTPOST_OBJECTS = [
  "outpostShipping",
  "outpostCaravan",
  "outpostVisitor",
  "outpostQuarantine",
  "outpostLathe",
  "outpostMule",
  "outpostPrisoner",
  "outpostPatients",
  "outpostYouke",
  "outpostCache",
  "outpostCai",
  "outpostEscort",
];
