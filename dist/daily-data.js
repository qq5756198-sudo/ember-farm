// v0.18.0「每日抉择」：每天清晨一张三选一的事件卡。100 个事件 = 9 条连贯事件（36 个）+ 64 个独立事件。
// 效果都用一小套固定动作拼成（见 daily.js 的 applyOp），卡上的文字由同一组数字生成。
// 数值是第 1–2 段的基准；第 3–5 段 ×1.5，第 6 段以后 ×2（物资、金币与花费一起放大）。

export const DAILY_SCHEMA = 1;
export const NEWBIE_DAYS = 5; // 第 2–5 天只出新手事件
export const COOLDOWN = 30; // 独立事件 30 天内不重复
export const MAX_CHAINS = 3;

export const CATS = {
  farm: { name: "农事与天气", tone: "#9fd38a" },
  scav: { name: "拾荒与远征", tone: "#d6c79a" },
  camp: { name: "营地生活", tone: "#e6b09a" },
  trade: { name: "交易与访客", tone: "#e9c05a" },
  crisis: { name: "危机与威胁", tone: "#e9806e" },
  luck: { name: "奇遇", tone: "#9fd3e0" },
  chain: { name: "连贯事件", tone: "#c9a5e6" },
};

export const CHAINS = {
  C1: { name: "迷路的信鸽", steps: 4 },
  C2: { name: "地窖里的敲击声", steps: 4 },
  C3: { name: "破伞剧团", steps: 4 },
  C4: { name: "井水变色", steps: 3 },
  C5: { name: "野狗群", steps: 4 },
  C6: { name: "电台里的女孩", steps: 5 },
  C7: { name: "黑市的借据", steps: 4 },
  C8: { name: "种子库的钥匙", steps: 4 },
  C9: { name: "抛锚的卡车", steps: 3 },
};

// 长期加成（连贯事件的结局与少数事件）
export const PERKS = {
  seedNet: { name: "种子网", text: "每 7 天仓库收到 2 份随机种子" },
  shelter: { name: "地下避难所", text: "灰隼团来时居民躲进去，不会被流弹擦伤" },
  festStar: { name: "破伞剧团驻演", text: "每个节庆多一颗星" },
  caravanGift: { name: "巡演宣传", text: "唐九的商队每次来都多送一份小礼" },
  cistern: { name: "蓄水池", text: "每天清晨自动浇 6 块田" },
  watchDogs: { name: "守夜犬", text: "尸潮和灰隼团的预警多 30 秒" },
  fieldDogs: { name: "看田犬", text: "虫灾、田鼠、偷粮不再发生" },
  huntDogs: { name: "猎犬", text: "每两天叼回一份野味（干粮 1）" },
  radioOp: { name: "无线电员小满", text: "每档电台节目效果 +50%" },
  blackMarket: { name: "黑市渠道", text: "每 7 天按低价自动进一批货：付 40 金币，得弹药 10、零件 2（钱不够就跳过）" },
  smuggle: { name: "走私线", text: "出货价永久 +10%" },
  seedVault: { name: "种子分库", text: "每 5 天领一次种子 3 份" },
  truck: { name: "前哨运输车", text: "出远门路上的时间减半" },
  armored: { name: "移动掩体", text: "灰隼团来时防守力 +2" },
  sentry: { name: "夜里多一个哨兵", text: "夜里不会再被偷东西" },
  road: { name: "石子路", text: "去旧医院的路上少花 10 分钟" },
  noBlack: { name: "举报了黑市", text: "黑市的人不会再来" },
};

// 限时增益与减益：value 为倍率增量或固定值
export const BUFFS = {
  growth: (v) => "作物生长 " + (v >= 0 ? "+" : "−") + Math.round(Math.abs(v) * 100) + "%",
  work: (v) => (v <= -1 ? "加工停下" : "加工速度 " + (v >= 0 ? "+" : "−") + Math.round(Math.abs(v) * 100) + "%"),
  guard: (v) => "受到的伤害 −" + Math.round(v * 100) + "%",
  loot: (v) => "补给箱多拿 " + Math.round(v * 100) + "%",
  ship: (v) => "出货价 +" + Math.round(v * 100) + "%",
  partsShip: (v) => "零件出货价 +" + Math.round(v * 100) + "%",
  travel: () => "出远门不花时间",
  detour: (v) => "去旧医院多花 " + v + " 分钟",
  morale: (v) => "居民士气每天 +" + v,
  rain: () => "每天清晨田地自动浇透",
  cats: () => "老鼠不啃粮，夜里不丢东西",
  radio: () => "今晚电台节目效果翻倍",
  defense: (v) => "防守力 +" + v,
  nightSafe: () => "今晚有人守夜，不会丢东西",
};

export const BASIC_SEEDS = ["seedRadish", "seedPotato", "seedTomato", "seedBean", "seedCorn", "seedPumpkin", "seedHerb", "seedCotton"];
export const RARE_SEEDS = ["seed_radish_abundant", "seed_potato_abundant", "seed_tomato_abundant", "seed_corn_abundant", "seed_pumpkin_abundant", "seed_bean_abundant"];
export const MODS = ["extendedMag", "suppressor", "longBarrel", "shortBarrel"];

// ---------- 条件小工具 ----------
const act = (n) => (e) => e.actNo() >= n;
const all =
  (...fs) =>
  (e) =>
    fs.every((f) => f(e));
const coop = (e) => e.hasBuilding("coop");
const dog = (e) => !!e.f?.dog?.rescued;
const radio = (e) => !!e.r?.radio;
const helper = (e) => e.helperCount() > 0;
const residents = (n) => (e) => e.c.residents.length >= n;
const has = (id) => (e) => !!e.resident(id);
const noPerk = (id) => (e) => !e.hasPerk(id);
const needCoop = (e) => (coop(e) ? "" : "要有鸡舍");
const needDog = (e) => (dog(e) ? "" : "要有麦穗");
const needHelper = (e) => (helper(e) ? "" : "营地里还没有援建队员");

// ---------- 事件 ----------
// opt: { label, cost?, pay?(金币), req?(e)=>理由, fx?, p?, win?, lose?, note? }
export const EVENTS = {
  // ===== 连贯事件 =====
  // 链一 · 迷路的信鸽
  "C1-1": {
    cat: "chain", chain: "C1", step: 1, name: "迷路的信鸽", when: act(3),
    text: "一只脚上绑着纸条的信鸽落在屋檐上，翅膀受了伤，眼睛滴溜溜地看着你。",
    opts: [
      { label: "喂它养伤", cost: { bread: 1 }, fx: [["next", "C1-2", 3]], note: "三天后它会飞回去" },
      { label: "读完纸条就放飞", fx: [["cache", { parts: 3 }, "ruin"]], note: "纸条上标着一个补给点" },
      { label: "烤了吃", fx: [["hp", 10], ["mood", -3]] },
    ],
  },
  "C1-2": {
    cat: "chain", chain: "C1", step: 2, name: "信鸽回来了",
    text: "信鸽带回一封回信：北边“灯塔营地”的老卢想和前哨通信。",
    opts: [
      { label: "写一封友好的回信", cost: { cloth: 1 }, fx: [["next", "C1-3", 3]] },
      { label: "要他们先证明诚意", p: 0.7, win: [["give", { ammo: 8 }], ["next", "C1-3", 3]], lose: [], loseNote: "对方不再回信" },
      { label: "不回", fx: [] },
    ],
  },
  "C1-3": {
    cat: "chain", chain: "C1", step: 3, name: "灯塔营地缺药",
    text: "老卢来信说，灯塔营地有人发烧不退，愿意用种子换药。",
    opts: [
      { label: "送药包和绷带", cost: { medkit: 1, bandage: 2 }, fx: [["give", { seedPumpkin: 3, seedCotton: 3 }], ["next", "C1-E", 4]] },
      { label: "送药草", cost: { herb: 4 }, fx: [["seeds", 6], ["next", "C1-E", 4]] },
      { label: "只寄去问候", fx: [["rep", 1]] },
    ],
  },
  "C1-E": {
    cat: "chain", chain: "C1", step: 4, name: "种子网",
    text: "老卢要把附近几个营地串成一张种子网，问前哨想怎么参与。",
    opts: [
      { label: "加入种子网", fx: [["perk", "seedNet"]] },
      { label: "换一次大的", fx: [["seedsAll", 2]] },
      { label: "请他们派个会种地的人来", fx: [["crew", { id: "achun", name: "灯塔的阿春", role: "carry", trait: "diligent", look: 2 }, { seedPumpkin: 2, seedCotton: 2 }]] },
    ],
  },
  // 链二 · 地窖里的敲击声
  "C2-1": {
    cat: "chain", chain: "C2", step: 1, name: "地窖里的敲击声", when: (e) => e.s.day >= 6,
    text: "半夜，农舍的地板下传来“咚、咚”的声音，停一会儿又响。",
    opts: [
      { label: "撬开地板看看", fx: [["stamina", -20], ["next", "C2-2", 1]] },
      { label: "用木板钉死", cost: { wood: 2 }, fx: [["mood", 2]] },
      { label: "叫一名援建队员去看", req: needHelper, fx: [["next", "C2-2", 1]] },
    ],
  },
  "C2-2": {
    cat: "chain", chain: "C2", step: 2, name: "防空洞入口",
    text: "地板下是旧防空洞的入口，台阶往下，吹着冷风。",
    opts: [
      { label: "带火把下去", cost: { resin: 1 }, fx: [["next", "C2-3", 1]] },
      { label: "拿了入口的东西就走", fx: [["give", { scrap: 4, cloth: 2 }]] },
      { label: "拉绳做记号，三天后再来", fx: [["next", "C2-3", 3]] },
    ],
  },
  "C2-3": {
    cat: "chain", chain: "C2", step: 3, name: "锈死的铁门",
    text: "储藏室的铁门锈死了。贴着门听，里面好像有呼吸声。",
    opts: [
      { label: "修好门锁", cost: { parts: 2 }, fx: [["next", "C2-E", 1]] },
      { label: "硬撬", p: 0.6, win: [["next", "C2-E", 1]], lose: [["hp", -15], ["give", { scrap: 6 }]], loseNote: "门塌了" },
      { label: "敲门喊话", fx: [["crew", { id: "warden", name: "老防空员", role: "guard", trait: "nightowl", look: 3 }, { ammo: 6 }], ["next", "C2-E", 1]], note: "一位躲了很久的老人开了门" },
    ],
  },
  "C2-E": {
    cat: "chain", chain: "C2", step: 4, name: "地下储藏室",
    text: "储藏室里整整齐齐码着旧物资，墙上还挂着一张手绘的防空图。",
    opts: [
      { label: "改成避难所", fx: [["perk", "shelter"]] },
      { label: "搬空", fx: [["give", { bread: 6, ammo: 10, medkit: 2 }]] },
      { label: "交给联盟登记", fx: [["rep", 6], ["research", 2]] },
    ],
  },
  // 链三 · 破伞剧团
  "C3-1": {
    cat: "chain", chain: "C3", step: 1, name: "破伞剧团", when: act(3),
    text: "三个背着箱子的人站在营门口：“我们是‘破伞剧团’，借块空地演一场？”",
    opts: [
      { label: "让他们演", cost: { bread: 3 }, fx: [["mood", 6], ["next", "C3-2", 2]] },
      { label: "给碗水送走", fx: [] },
      { label: "收门票对半分", fx: [["money", 20], ["mood", 2], ["flag", "C3", "greedy"], ["next", "C3-2", 2]], note: "剧团有点不高兴" },
    ],
  },
  "C3-2": {
    cat: "chain", chain: "C3", step: 2, name: "道具车坏了",
    text: "团长说，他们的道具车坏在旧医院路口，戏服和布景都在车上。",
    opts: [
      { label: "派人帮忙修", cost: { parts: 2, wood: 3 }, fx: [["next", "C3-3", 2]] },
      { label: "借布料打包道具", cost: { cloth: 2 }, fx: [["next", "C3-3", 2]] },
      { label: "拒绝", fx: [], note: "剧团离开了" },
    ],
  },
  "C3-3": {
    cat: "chain", chain: "C3", step: 3, name: "过冬的打算",
    text: "剧团想留在附近过冬，排一出讲前哨故事的新戏。",
    opts: [
      { label: "给他们收拾一间空屋", cost: { wood: 6 }, fx: [["next", "C3-E", 3]] },
      { label: "送一批物资上路", cost: { bread: 4 }, fx: [["rep", 4]] },
      { label: "请他们教大家武打", fx: [["xp", "combat", 20], ["next", "C3-E", 3]] },
    ],
  },
  "C3-E": {
    cat: "chain", chain: "C3", step: 4, name: "新戏首演",
    text: "《前哨的灯》首演，台下坐满了人，连路过的人都停下来看。",
    opts: [
      { label: "首演之夜", fx: [["mood", 15], ["perk", "festStar"]] },
      { label: "让他们去巡演宣传", fx: [["rep", 6], ["perk", "caravanGift"]] },
      { label: "请团长留下", req: (e) => (e.chainFlag("C3", "greedy") ? "当初分门票的事，团长还记着" : ""), fx: [["crew", { id: "troupe", name: "破伞团长老韦", role: "carry", trait: "chatty", look: 1 }, { cloth: 4 }]] },
    ],
  },
  // 链四 · 井水变色
  "C4-1": {
    cat: "chain", chain: "C4", step: 1, name: "井水变色", when: (e) => e.s.day >= 8,
    text: "清早打上来的井水发绿，有股铁锈味。",
    opts: [
      { label: "停用，先靠雨水", fx: [["mood", -1], ["next", "C4-2", 2]] },
      { label: "煮开了照喝", cost: { herb: 2 }, p: 0.8, win: [["next", "C4-2", 2]], lose: [["fatigue", 20], ["next", "C4-2", 2]], loseNote: "有人拉肚子" },
      { label: "下井查看", fx: [["stamina", -25], ["flag", "C4", "clue"], ["next", "C4-2", 1]] },
    ],
  },
  "C4-2": {
    cat: "chain", chain: "C4", step: 2, name: "锈穿的旧管子",
    text: "井底有一根锈穿的旧管子，一直通向北边的工业仓库。",
    opts: [
      { label: "换掉管子", cost: { parts: 3 }, fx: [["next", "C4-E", 1]] },
      { label: "顺着管子找源头", fx: [["mark", "C4-E", "warehouse", 480, 800, "漏毒的旧桶"]], note: "去工业仓库的标记点看一眼（那边的路通了才能去）" },
      { label: "往井里撒石灰", cost: { stone: 3 }, fx: [["mood", 2]], note: "水变清了" },
    ],
  },
  "C4-E": {
    cat: "chain", chain: "C4", step: 3, name: "井水清了",
    text: "井水重新清了。阿禾说，这口井以后得好好护着。",
    opts: [
      { label: "净水浇田", fx: [["buff", "growth", 20, 0.1]] },
      { label: "上报源头", fx: [["research", 3], ["rep", 5]] },
      { label: "改成蓄水池", fx: [["perk", "cistern"]] },
    ],
  },
  // 链五 · 野狗群
  "C5-1": {
    cat: "chain", chain: "C5", step: 1, name: "野狗群", when: dog,
    text: "一群野狗半夜在围栏外转，叼走了 2 份干粮。麦穗对着外面低声呜呜。",
    opts: [
      { label: "设陷阱", cost: { scrap: 3 }, fx: [["next", "C5-2", 2]], note: "抓到头狗" },
      { label: "扔些剩饭安抚", cost: { bread: 2 }, fx: [["next", "C5-2", 2]] },
      { label: "不管", fx: [["debt", 3, { bread: 4 }, "野狗又来偷了一回"], ["next", "C5-2", 3]] },
    ],
  },
  "C5-2": {
    cat: "chain", chain: "C5", step: 2, name: "瘸腿的头狗",
    text: "狗群里有只瘸腿的头狗，麦穗冲它摇尾巴。",
    opts: [
      { label: "给头狗包扎", cost: { bandage: 1 }, fx: [["next", "C5-3", 2]] },
      { label: "扔石头吓走", fx: [["stamina", -10]], note: "狗群散了" },
      { label: "让麦穗去交涉", req: (e) => ((e.fr?.dog?.bond || 0) >= 6 ? "" : "麦穗默契 6 以上"), fx: [["dog", 2], ["next", "C5-3", 2]] },
    ],
  },
  "C5-3": {
    cat: "chain", chain: "C5", step: 3, name: "在农场边过夜",
    text: "狗群开始在农场边过夜，早上蹲在田埂上看人干活。",
    opts: [
      { label: "备好一周的口粮", cost: { bread: 7 }, fx: [["next", "C5-E", 3]] },
      { label: "搭狗窝", cost: { wood: 4 }, fx: [["next", "C5-E", 3]] },
      { label: "让它们自生自灭", fx: [] },
    ],
  },
  "C5-E": {
    cat: "chain", chain: "C5", step: 4, name: "狗群认了前哨",
    text: "狗群认了前哨。头狗每天傍晚在营门口趴着，等麦穗出来。",
    opts: [
      { label: "训成守夜犬", fx: [["perk", "watchDogs"]] },
      { label: "训成看田犬", fx: [["perk", "fieldDogs"]] },
      { label: "训成猎犬", fx: [["perk", "huntDogs"]] },
    ],
  },
  // 链六 · 电台里的女孩
  "C6-1": {
    cat: "chain", chain: "C6", step: 1, name: "电台里的女孩", when: radio,
    text: "深夜的电台杂音里，一个小女孩在一遍遍念一串数字。",
    opts: [
      { label: "记下数字", fx: [["research", 1], ["flag", "C6", "numbers"], ["next", "C6-2", 2]] },
      { label: "回话", fx: [["spawn", 2], ["next", "C6-2", 1]] },
      { label: "关掉电台", fx: [] },
    ],
  },
  "C6-2": {
    cat: "chain", chain: "C6", step: 2, name: "数字是坐标",
    text: "那串数字是坐标：废弃居民区的地下停车场。",
    opts: [
      { label: "带足弹药去", cost: { ammo: 6 }, fx: [["next", "C6-3", 1]] },
      { label: "先派人侦察", req: needHelper, fx: [["xp", "exploration", 10], ["next", "C6-3", 2]] },
      { label: "只记在地图上", fx: [["next", "C6-2", 7]], note: "七天后电台还会再响" },
    ],
  },
  "C6-3": {
    cat: "chain", chain: "C6", step: 3, name: "锁上的门",
    text: "停车场深处有一扇从里面锁上的门，门后传出收音机的沙沙声。",
    opts: [
      { label: "说出那串数字", req: (e) => (e.chainFlag("C6", "numbers") ? "" : "要在第一步记下数字"), fx: [["next", "C6-4", 1]] },
      { label: "在门口留下食物", cost: { bread: 3, medkit: 1 }, fx: [["next", "C6-4", 1]] },
      { label: "撬门", p: 0.6, win: [["next", "C6-4", 1]], lose: [["mood", -2]], loseNote: "她吓得逃走了" },
    ],
  },
  "C6-4": {
    cat: "chain", chain: "C6", step: 4, name: "小满",
    text: "女孩叫小满，爸爸是无线电员，三个月前出门没回来。",
    opts: [
      { label: "先带她回前哨", fx: [["next", "C6-E", 2]] },
      { label: "陪她去旧医院找爸爸", cost: { ammo: 6, bandage: 2 }, fx: [["flag", "C6", "searched"], ["next", "C6-E", 2]] },
      { label: "给她留一台对讲机", cost: { parts: 3 }, fx: [["next", "C6-E", 2]] },
    ],
  },
  "C6-E": {
    cat: "chain", chain: "C6", step: 5, name: "小满的故事",
    text: "小满把爸爸教她的东西一样样说给你听：频率、暗号、怎么在夜里找信号。",
    opts: [
      { label: "让小满当无线电员", fx: [["perk", "radioOp"]] },
      { label: "父女团聚，一起留下", req: (e) => (e.chainFlag("C6", "searched") ? "" : "要陪她找过爸爸"), fx: [["crew", { id: "xiaoman", name: "小满", role: "scout", trait: "diligent", look: 0 }, { medkit: 1 }], ["crew", { id: "laoman", name: "无线电员老满", role: "guard", trait: "handy", look: 1 }, { parts: 4 }]] },
      { label: "读爸爸的日记", fx: [["research", 5], ["cache", { ammo: 12, medkit: 2, parts: 4 }, "residential"]] },
    ],
  },
  // 链七 · 黑市的借据
  "C7-1": {
    cat: "chain", chain: "C7", step: 1, name: "黑市的借据", when: all(act(2), noPerk("noBlack")),
    text: "戴墨镜的商人“老鼠”凑过来：“借你一笔钱，十天后连本带利还我，多三成。”",
    opts: [
      { label: "借", fx: [["money", 150], ["next", "C7-2", 10]] },
      { label: "买他一件“内部货”", pay: 60, p: 0.5, win: [["give", { ammo: 20 }]], lose: [["give", { scrap: 6 }]], loseNote: "一箱废铁" },
      { label: "叫他走", fx: [] },
    ],
  },
  "C7-2": {
    cat: "chain", chain: "C7", step: 2, name: "老鼠来收账",
    text: "十天到了，老鼠靠在营门边数手指：“连本带利，一分不能少。”",
    opts: [
      { label: "按时还钱", pay: 200, fx: [["next", "C7-3", 2]] },
      { label: "用物资抵", req: (e) => (e.goodsValue() >= e.scaleN(200) ? "" : "背包里能出货的东西不够 " + e.scaleN(200) + " 金币"), fx: [["payGoods", 200], ["next", "C7-3", 2]] },
      { label: "赖账", fx: [["next", "C7-3b", 3]] },
    ],
  },
  "C7-3": {
    cat: "chain", chain: "C7", step: 3, name: "真正的大老板",
    text: "老鼠收了钱：“讲信用。带你见见真正的大老板。”",
    opts: [
      { label: "去见大老板", pay: 50, fx: [["next", "C7-E", 2]] },
      { label: "把黑市举报给联盟", fx: [["rep", 6], ["perk", "noBlack"]] },
      { label: "和他合伙走私", cost: { parts: 3 }, fx: [["next", "C7-E", 2]] },
    ],
  },
  "C7-3b": {
    cat: "chain", chain: "C7", step: 3, name: "打手上门",
    text: "两个打手堵在营门口，手里拎着铁棍。",
    opts: [
      { label: "打", fx: [["hp", -20], ["give", { ammo: 10 }]] },
      { label: "赔钱", pay: 250, fx: [] },
      { label: "躲进仓库", fx: [["lose", "topItem", 0.3]] },
    ],
  },
  "C7-E": {
    cat: "chain", chain: "C7", step: 4, name: "黑市的门",
    text: "大老板摘下墨镜：“想要什么样的生意？”",
    opts: [
      { label: "长期渠道", fx: [["perk", "blackMarket"]] },
      { label: "走私线", fx: [["perk", "smuggle"], ["rep", -3]] },
      { label: "一次性的大生意", fx: [["money", 200]] },
    ],
  },
  // 链八 · 种子库的钥匙
  "C8-1": {
    cat: "chain", chain: "C8", step: 1, name: "种子库的钥匙", when: act(5),
    text: "拾荒时，你在一具骸骨手里发现一把钥匙，上面刻着“北方种子库”。",
    opts: [
      { label: "收好钥匙", fx: [["next", "C8-2", 2]] },
      { label: "卖给唐九", fx: [["money", 80]] },
      { label: "先把人埋了", fx: [["stamina", -10], ["mood", 3], ["next", "C8-2", 2]], note: "还找到一张地图碎片" },
    ],
  },
  "C8-2": {
    cat: "chain", chain: "C8", step: 2, name: "钥匙的来历",
    text: "联盟终端的资料里查到：北方种子库在白霜气象站附近。",
    opts: [
      { label: "备好御寒装备出发", cost: { cloth: 4 }, fx: [["next", "C8-3", 2]] },
      { label: "等寒潮过了再去", fx: [["next", "C8-3", 10]] },
      { label: "在终端里多查一些资料", fx: [["research", 2], ["next", "C8-3", 3]] },
    ],
  },
  "C8-3": {
    cat: "chain", chain: "C8", step: 3, name: "两把钥匙",
    text: "种子库的门要两把钥匙才能开。",
    opts: [
      { label: "撬开机械锁", cost: { parts: 4 }, p: 0.8, win: [["next", "C8-E", 1]], lose: [["flag", "C8", "damaged"], ["next", "C8-E", 1]], loseNote: "弄坏了一半种子" },
      { label: "去北线货运站找第二把", req: (e) => e.regionReady("railDepot"), fx: [["mark", "C8-E", "railDepot", 700, 520, "第二把钥匙"]], note: "去北线货运站的标记点" },
      { label: "把位置告诉联盟", fx: [["rep", 6]] },
    ],
  },
  "C8-E": {
    cat: "chain", chain: "C8", step: 4, name: "种子库打开了",
    text: "冷气扑面而来，一排排铁柜里装满了封好的种子。",
    opts: [
      { label: "全部带回", fx: [["seedsAll", 5]] },
      { label: "只拿一部分", fx: [["seedsAll", 2], ["rep", 8], ["mood", 5]] },
      { label: "改成前哨的分库", fx: [["perk", "seedVault"]] },
    ],
  },
  // 链九 · 抛锚的卡车
  "C9-1": {
    cat: "chain", chain: "C9", step: 1, name: "抛锚的卡车", when: act(4),
    text: "公路边有一辆半埋在泥里的旧卡车，驾驶室的门还关着。",
    opts: [
      { label: "挖出来", cost: { wood: 2 }, fx: [["stamina", -30], ["next", "C9-2", 2]] },
      { label: "就地拆", fx: [["give", { parts: 4, scrap: 6 }]] },
      { label: "记下位置", fx: [["next", "C9-1", 5]], note: "五天后再问一次" },
    ],
  },
  "C9-2": {
    cat: "chain", chain: "C9", step: 2, name: "缺油和电瓶",
    text: "发动机还能转，就是缺油和电瓶。",
    opts: [
      { label: "修电瓶", cost: { parts: 3 }, fx: [["next", "C9-E", 1]] },
      { label: "找唐九买油", pay: 60, fx: [["next", "C9-E", 1]] },
      { label: "自己去工业仓库找", fx: [["mark", "C9-E", "warehouse", 280, 400, "油桶和电瓶"]], note: "去工业仓库的标记点（那边的路通了才能去）" },
    ],
  },
  "C9-E": {
    cat: "chain", chain: "C9", step: 3, name: "卡车能开了",
    text: "卡车突突地发动了，排气管冒出一股黑烟，营地里的人都在欢呼。",
    opts: [
      { label: "当前哨运输车", fx: [["perk", "truck"]] },
      { label: "改装成移动掩体", fx: [["perk", "armored"]] },
      { label: "卖给联盟", fx: [["money", 300]] },
    ],
  },

  // ===== 农事与天气 =====
  N01: { cat: "farm", name: "透雨", newbie: true, text: "夜里下了一场透雨，地里的土都喝饱了。", opts: [
    { label: "挖排水沟", cost: { wood: 2 }, fx: [["water"], ["fertility", 10]] },
    { label: "把桶都摆出去接雨", fx: [["buff", "rain", 3, 1]] },
    { label: "放大家半天假", fx: [["fatigue", -100], ["mood", 3]] },
  ] },
  N02: { cat: "farm", name: "虫害苗头", when: noPerk("fieldDogs"), text: "叶子背面爬满了小黑虫，再不管就要连成片了。", opts: [
    { label: "用药草熬水喷", cost: { herb: 3 }, fx: [], note: "虫全没了" },
    { label: "手工捉虫", p: 0.7, win: [["stamina", -30]], lose: [["stamina", -30], ["growthBack", 0.3]], loseNote: "有一片田没救回来" },
    { label: "赶鸡来吃", req: needCoop, fx: [["give", { egg: 2 }]], note: "虫没了，鸡还多下了蛋" },
  ] },
  N03: { cat: "farm", name: "早霜", when: act(3), text: "傍晚天边发白，老人说今晚要结霜。", opts: [
    { label: "给田盖布", cost: { cloth: 3 }, fx: [], note: "作物全保住" },
    { label: "连夜抢收", fx: [["stamina", -25], ["harvestRipe"]] },
    { label: "赌今晚不冷", p: 0.5, win: [], lose: [["growthBack", 0.5]], loseNote: "霜打了" },
  ] },
  N04: { cat: "farm", name: "怪南瓜", text: "田角长出一个大得出奇的南瓜，两个人才抬得动。", opts: [
    { label: "留种", fx: [["give", { seedPumpkin: 4 }]] },
    { label: "拿去卖", fx: [["money", 40]] },
    { label: "剖开做炖菜", fx: [["give", { stew: 3 }], ["mood", 2]] },
  ] },
  N05: { cat: "farm", name: "土壤板结", text: "连着几天大太阳，田里的土硬得锄不动。", opts: [
    { label: "翻地", fx: [["stamina", -20], ["fertility", 15]] },
    { label: "撒草木灰", cost: { wood: 3 }, fx: [["fertility", 25]] },
    { label: "换种豆子养地", fx: [["give", { seedBean: 4 }], ["fertility", 10]] },
  ] },
  N06: { cat: "farm", name: "野蜂筑巢", newbie: true, text: "一群野蜂在篱笆上筑了巢，田里嗡嗡的。", opts: [
    { label: "留着它们", fx: [["buff", "growth", 10, 0.1]] },
    { label: "取蜂蜜", fx: [["hp", 20], ["mood", 5]] },
    { label: "整窝卖给集市", fx: [["money", 35]] },
  ] },
  N07: { cat: "farm", name: "种子受潮", when: (e) => !!e.topSeed(), text: "仓库漏雨，最多的那袋种子发了霉。", opts: [
    { label: "晒干挑拣", fx: [["lose", "topSeed", 0.5]] },
    { label: "挑出好的赶紧种", fx: [["stamina", -20], ["lose", "topSeed", 0.3], ["buff", "growth", 5, 0.2]] },
    { label: "拿去喂鸡", req: needCoop, fx: [["lose", "topSeed", 1], ["give", { egg: 5 }]] },
  ] },
  N08: { cat: "farm", name: "稻草人", newbie: true, text: "阿禾想在田中间扎个稻草人，吓吓偷吃的鸟。", opts: [
    { label: "给布料扎一个", cost: { cloth: 2 }, fx: [["buff", "growth", 20, 0.05]] },
    { label: "让孩子们画张脸", fx: [["mood", 4]] },
    { label: "把布做成绷带", cost: { cloth: 2 }, fx: [["give", { bandage: 3 }]] },
  ] },
  N09: { cat: "farm", name: "酸雨预报", when: act(3), text: "天边的云发黄，空气里有股刺鼻的味道。", opts: [
    { label: "搭临时棚", cost: { wood: 5 }, fx: [], note: "酸雨不伤作物" },
    { label: "抢收熟了的作物", fx: [["harvestRipe"]] },
    { label: "不理", p: 0.6, win: [], lose: [["buff", "growth", 3, -0.3]], loseNote: "酸雨下了" },
  ] },
  N10: { cat: "farm", name: "嫁接试验", when: all(act(4), has("farmer")), text: "阿禾想把番茄嫁接到土豆上：“说不定一棵能结两样。”", opts: [
    { label: "试试", cost: { tomato: 2, potato: 2 }, p: 0.6, win: [["give", { seedTomato: 6 }]], lose: [], loseNote: "没成" },
    { label: "交给许医生研究", fx: [["research", 2]] },
    { label: "算了", fx: [["trust", "farmer", -1]] },
  ] },
  N11: { cat: "farm", name: "田鼠打洞", when: noPerk("fieldDogs"), text: "田边多了好几个小洞，昨晚少了两棵萝卜。", opts: [
    { label: "灌水淹洞", p: 0.7, win: [["stamina", -15]], lose: [["stamina", -15], ["drain", 3]], loseNote: "没淹干净" },
    { label: "下夹子", cost: { scrap: 2 }, fx: [["give", { bread: 2 }]], note: "还抓到了野味" },
    { label: "不管", fx: [["drain", 3]] },
  ] },
  N12: { cat: "farm", name: "丰收月", when: act(5), text: "这一季的作物长得出奇地好，仓库都快装不下了。", opts: [
    { label: "办一场收获祭", cost: { bread: 4 }, fx: [["mood", 8], ["rep", 3]] },
    { label: "多收的全出货", fx: [["buff", "ship", 0, 0.25]] },
    { label: "留作种子", fx: [["seedsOwned", 2]] },
  ] },

  // ===== 拾荒与远征 =====
  S01: { cat: "scav", name: "路边补给箱", newbie: true, text: "集市路边有个没人动过的补给箱。", opts: [
    { label: "现在就去", fx: [["stamina", -10], ["give", { parts: 2, scrap: 4 }]] },
    { label: "派援建队员去", req: needHelper, fx: [["later", 0, { parts: 2, scrap: 4 }, 0, "援建队员搬回了路边的补给箱"]] },
    { label: "留给更需要的人", fx: [["rep", 2]] },
  ] },
  S02: { cat: "scav", name: "旧地图", text: "一张画着红圈的旧地图夹在废纸堆里。", opts: [
    { label: "相信它", fx: [["cache", { parts: 2, ammo: 6, bread: 2 }, "ruin"]] },
    { label: "卖给唐九", fx: [["money", 30]] },
    { label: "交给档案员", fx: [["research", 1]] },
  ] },
  S03: { cat: "scav", name: "塌了一半的药店", when: act(3), text: "一家药店塌了一半，货架还立着。", opts: [
    { label: "钻进去", p: 0.6, win: [["give", { medkit: 2, bandage: 3 }]], lose: [["hp", -20], ["give", { bandage: 1 }]], loseNote: "被压伤了" },
    { label: "先加固再进", cost: { wood: 4 }, fx: [["give", { medkit: 1, bandage: 3, herb: 2 }]] },
    { label: "绕开", fx: [] },
  ] },
  S04: { cat: "scav", name: "迷路的拾荒者", when: act(3), text: "一个人在路口转圈子，背包破了个口子。", opts: [
    { label: "给他指路", fx: [["buff", "travel", 0, 1]], note: "他告诉你一条捷径" },
    { label: "带他回营地", fx: [["visitor", "迷路的拾荒者"]] },
    { label: "翻他的包", fx: [["give", { ammo: 6 }], ["rep", -3]] },
  ] },
  S05: { cat: "scav", name: "废车堆", text: "路边一排烧黑的车，后备箱都还关着。", opts: [
    { label: "拆电瓶", fx: [["stamina", -15], ["give", { parts: 3 }]] },
    { label: "切车壳", fx: [["give", { scrap: 8 }]] },
    { label: "翻后备箱", p: 0.5, win: [["give", { bread: 3 }]], lose: [["hp", -10]], loseNote: "扑出一只感染者" },
  ] },
  S06: { cat: "scav", name: "超市冷库", when: act(4), text: "超市冷库的门缝里透着冷气，里面好像还有货。", opts: [
    { label: "裹着布进去", cost: { cloth: 2 }, fx: [["give", { salt: 4, bread: 4 }]] },
    { label: "硬撬门", p: 0.6, win: [["stamina", -20], ["give", { salt: 4, bread: 4 }]], lose: [["stamina", -20]], loseNote: "门轴断了，什么也没拿到" },
    { label: "标给援建队员", req: needHelper, fx: [["later", 3, { salt: 2, bread: 2 }, 0, "援建队员从冷库带回了一半"]] },
  ] },
  S07: { cat: "scav", name: "守夜人的哨塔", text: "一座哨塔上有个弹药箱，箱子上用红漆写着“别碰”。", opts: [
    { label: "全拿走", fx: [["give", { ammo: 15 }], ["spawn", 2]] },
    { label: "拿一半，留字条", fx: [["give", { ammo: 7 }], ["rep", 1]] },
    { label: "修好哨塔留给过路人", cost: { wood: 3 }, fx: [["rep", 4]] },
  ] },
  S08: { cat: "scav", name: "地下水管", when: act(5), text: "一条能钻人的大水管，据说能通到好几个地方。", opts: [
    { label: "钻进去走捷径", p: 0.5, win: [["buff", "travel", 0, 1]], lose: [["buff", "travel", 0, 1], ["ambush", 2]], loseNote: "撞见 2 只感染者" },
    { label: "拆管子", fx: [["give", { scrap: 10 }]] },
    { label: "封口", fx: [["mood", 1]] },
  ] },
  S09: { cat: "scav", name: "鸟群盘旋", text: "远处一群鸟绕着一个点一直飞。", opts: [
    { label: "去看看", p: 0.7, win: [["stamina", -15], ["random", [{ bread: 3, cloth: 2, parts: 2 }, { ammo: 8, bandage: 2, herb: 2 }, { scrap: 6, medkit: 1, salt: 2 }]]], lose: [["stamina", -15], ["ambush", 3]], loseNote: "是一窝感染者" },
    { label: "让麦穗去", req: needDog, fx: [["random", [{ parts: 2 }, { medkit: 1 }, { ammo: 6 }]]] },
    { label: "不去", fx: [] },
  ] },
  S10: { cat: "scav", name: "万里晴空", newbie: true, text: "今天视野特别好，远处的废墟看得一清二楚。", opts: [
    { label: "登高侦察", fx: [["xp", "exploration", 15], ["cache", { parts: 2 }, "market"]] },
    { label: "出门拾荒", fx: [["buff", "loot", 0, 0.3]] },
    { label: "晒被子", fx: [["mood", 3], ["heal"]] },
  ] },

  // ===== 营地生活与居民 =====
  L01: { cat: "camp", name: "生日惊喜", newbie: true, when: helper, text: "今天是一名援建队员的生日，他自己都忘了。", opts: [
    { label: "做一桌好菜", cost: { stew: 2 }, fx: [["trust", "crew", 2], ["mood", 4]] },
    { label: "送件小礼物", cost: { cloth: 1 }, fx: [["trust", "crew", 1]] },
    { label: "大家一起唱首歌", fx: [["mood", 2]] },
  ] },
  L02: { cat: "camp", name: "吵架", when: all(has("farmer"), has("mechanic")), text: "阿禾和陈工为了谁先用工作台吵了起来。", opts: [
    { label: "帮阿禾", fx: [["trust", "farmer", 1], ["trust", "mechanic", -1], ["buff", "growth", 0, 0.2]] },
    { label: "帮陈工", fx: [["trust", "mechanic", 1], ["trust", "farmer", -1], ["buff", "work", 0, 0.3]] },
    { label: "让他们轮流", fx: [["mood", -1], ["research", 1]], note: "两人都学到一点对方的手艺" },
  ] },
  L03: { cat: "camp", name: "偷懒的人", when: all(act(3), (e) => e.o.crew.length > 0), text: "一名援建队员大白天在帐篷里睡觉。", opts: [
    { label: "罚他多干", fx: [["mood", -2], ["buff", "work", 0, 0.3]] },
    { label: "问清楚", fx: [["perk", "sentry"]], note: "原来他夜里在守夜" },
    { label: "装作没看见", fx: [["trust", "crew", 1]] },
  ] },
  L04: { cat: "camp", name: "学认字", text: "孩子们捧着捡来的旧课本，想上课。", opts: [
    { label: "你来教", fx: [["stamina", -20], ["research", 1], ["mood", 3]] },
    { label: "请许医生教", req: (e) => (e.resident("medic") ? "" : "许医生还没到营地"), fx: [["research", 2]] },
    { label: "让他们去拾柴", fx: [["give", { wood: 3 }]] },
  ] },
  L05: { cat: "camp", name: "失眠的夜", when: residents(1), text: "好几个人翻来覆去睡不着。", opts: [
    { label: "熬药草茶", cost: { herb: 2 }, fx: [["fatigue", -30]] },
    { label: "讲故事到半夜", fx: [["stamina", -15], ["mood", 5]] },
    { label: "叫他们起来干活", fx: [["rush"], ["fatigue", 20]] },
  ] },
  L06: { cat: "camp", name: "发烧", when: all(act(3), residents(1)), text: "一名居民烧得起不了床。", opts: [
    { label: "用药包", cost: { medkit: 1 }, fx: [["heal"]] },
    { label: "用药草慢慢调", cost: { herb: 3 }, fx: [["sick", 2]] },
    { label: "隔离休息", p: 0.8, win: [["sick", 3]], lose: [["sick", 5]], loseNote: "传给了别人" },
  ] },
  L07: { cat: "camp", name: "意外的手艺", when: helper, text: "铁锹居然会做木工，削的木钉又直又匀。", opts: [
    { label: "让他修一遍营地", cost: { wood: 4 }, fx: [["repair", "all"]] },
    { label: "让他带个徒弟", fx: [["trust", "helper", 2], ["research", 1]] },
    { label: "照常干活", fx: [["buff", "work", 0, 0.2]] },
  ] },
  L08: { cat: "camp", name: "洗澡日", newbie: true, text: "大家都想洗个热水澡。", opts: [
    { label: "烧热水", cost: { wood: 3 }, fx: [["fatigue", -100], ["mood", 4]] },
    { label: "冲凉水", fx: [["mood", 1]] },
    { label: "先不洗，今天多干点", fx: [["rush"]] },
  ] },
  L09: { cat: "camp", name: "家乡菜", when: all(act(4), has("medic")), text: "许医生想起一道家乡菜，说得大家直咽口水。", opts: [
    { label: "试做", cost: { bread: 2, herb: 1 }, fx: [["mood", 6]] },
    { label: "写进档案", fx: [["research", 1]] },
    { label: "下次再说", fx: [] },
  ] },
  L10: { cat: "camp", name: "心事", when: residents(1), text: "一名居民半夜躲在柴堆后面偷偷哭。", opts: [
    { label: "陪他聊", fx: [["stamina", -10], ["cheer"]] },
    { label: "今晚营火只陪他", req: (e) => (e.festivalsOpen?.() && e.ss?.talk?.day !== e.s.day ? "" : "今晚的营火夜谈用不了"), fx: [["cheer"], ["talkUsed"]] },
    { label: "给他放一天假", fx: [["fatigue", -30]] },
  ] },
  L11: { cat: "camp", name: "守夜轮班", when: act(5), text: "最近夜里不太平，围栏外总有脚步声。", opts: [
    { label: "排三班", fx: [["buff", "work", 0, -0.2], ["buff", "nightSafe", 0, 1]] },
    { label: "排两班", p: 0.5, win: [["buff", "nightSafe", 0, 1]], lose: [["night", { bread: 2 }]], loseNote: "还是被摸了一回" },
    { label: "不排", p: 0.7, win: [], lose: [["night", { bread: 2, wood: 1 }]], loseNote: "夜里丢了东西" },
  ] },
  L12: { cat: "camp", name: "婚礼", when: all(act(6), residents(2)), text: "两位居民要结婚了，脸红得像熟透的番茄。", opts: [
    { label: "办一场", cost: { bread: 6, cloth: 2 }, fx: [["mood", 15], ["rep", 5]] },
    { label: "简单办", fx: [["mood", 6]] },
    { label: "推迟", fx: [["trust", "two", -1]] },
  ] },

  // ===== 交易与访客 =====
  V01: { cat: "trade", name: "换物的老太太", newbie: true, text: "一位老太太推着小车来换东西。", opts: [
    { label: "干粮换药包", cost: { bread: 3 }, fx: [["give", { medkit: 1 }]] },
    { label: "布料换种子", cost: { cloth: 2 }, fx: [["seeds", 4]] },
    { label: "请她喝碗水", fx: [["mood", 1], ["tell", "weather"]], note: "她告诉你明天的天气" },
  ] },
  V02: { cat: "trade", name: "唐九的预订", when: (e) => e.o?.caravan?.next > e.s.day, text: "唐九托人带话：下次来，可以先预订。", opts: [
    { label: "预付订金", pay: 50, fx: [["caravanDisc", 0.7]] },
    { label: "订一件稀缺货", pay: 100, fx: [["caravanOrder"]] },
    { label: "不订", fx: [] },
  ] },
  V03: { cat: "trade", name: "卖艺的孩子", text: "一个孩子在营门口翻跟头，翻完伸出小手。", opts: [
    { label: "给几个金币", pay: 10, fx: [["mood", 2]] },
    { label: "留他吃饭", cost: { bread: 1 }, p: 0.3, win: [["crew", { id: "shitou", name: "小石头", role: "carry", trait: "diligent", look: 0 }, { wood: 3 }]], lose: [["mood", 1]], loseNote: "吃完就走了" },
    { label: "让他帮工换饭", fx: [["give", { wood: 3 }]] },
  ] },
  V04: { cat: "trade", name: "可疑的药贩", when: act(3), text: "一个药贩神神秘秘地掏出一瓶“特效药”。", opts: [
    { label: "买下", pay: 40, p: 0.5, win: [["give", { medkit: 3 }]], lose: [], loseNote: "是假药" },
    { label: "请许医生验货", req: (e) => (e.resident("medic") ? "" : "许医生还没到营地"), pay: 20, fx: [["give", { medkit: 1 }]] },
    { label: "赶走", fx: [] },
  ] },
  V05: { cat: "trade", name: "收旧货的", newbie: true, text: "收旧货的拉着板车经过，喊着“废铁、零件换钱”。", opts: [
    { label: "卖废金属", cost: { scrap: 10 }, fx: [["money", 40]] },
    { label: "卖零件", cost: { parts: 2 }, fx: [["money", 50]] },
    { label: "只看不卖", fx: [["buff", "partsShip", 7, 0.2]], note: "他留下一张收货单" },
  ] },
  V06: { cat: "trade", name: "联盟的采购单", when: act(3), text: "联盟发来采购单，急需熟食。", opts: [
    { label: "接大单", cost: { stew: 6 }, fx: [["money", 120], ["rep", 3]] },
    { label: "接小单", cost: { bread: 4 }, fx: [["money", 50]] },
    { label: "不接", fx: [] },
  ] },
  V07: { cat: "trade", name: "路过的小队", when: act(4), text: "五个持枪的人在营门外，想讨些补给。", opts: [
    { label: "给补给", cost: { bread: 4 }, fx: [["clearRuin"]], note: "他们顺路清掉一片废墟" },
    { label: "换弹药", cost: { parts: 3 }, fx: [["give", { ammo: 15 }]] },
    { label: "关门", fx: [["rep", -1]] },
  ] },
  V08: { cat: "trade", name: "押运的邀请", text: "一个商人想雇人护送货车去集市。", opts: [
    { label: "派人押车", req: needHelper, fx: [["later", 3, null, 90, "押车的援建队员回来了"]] },
    { label: "你亲自跑一趟", fx: [["time", 180], ["money", 60], ["xp", "combat", 10]] },
    { label: "不接", fx: [] },
  ] },
  V09: { cat: "trade", name: "集市拍卖会", when: act(5), text: "集市办拍卖会，台上摆着枪械配件和稀有种子。", opts: [
    { label: "拍枪械配件", pay: 120, fx: [["mod"]] },
    { label: "拍稀有种子", pay: 60, fx: [["rareSeeds", 4]] },
    { label: "拿最多的东西去卖", fx: [["sellTop", 5, 80]] },
  ] },
  V10: { cat: "trade", name: "游方医生", text: "一位背着药箱的女人在营门歇脚。", opts: [
    { label: "请她看病", pay: 30, fx: [["heal"]] },
    { label: "请她指点一二", fx: [["research", 1], ["trust", "medic", 1]] },
    { label: "用药草换绷带", cost: { herb: 3 }, fx: [["give", { bandage: 4 }]] },
  ] },

  // ===== 危机与威胁 =====
  D01: { cat: "crisis", name: "围栏被挖了洞", when: all(act(3), noPerk("fieldDogs")), text: "东边围栏下被人挖了个洞，洞口有新鲜的脚印。", opts: [
    { label: "马上补", cost: { wood: 4 }, fx: [], note: "洞补上了，今晚不会丢东西" },
    { label: "设陷阱", cost: { scrap: 3 }, fx: [["later", 1, { bread: 4, parts: 1 }, 0, "抓到的小偷来求饶，交出了偷走的东西"]] },
    { label: "不管", fx: [["night", { bread: 2, wood: 2 }]] },
  ] },
  D02: { cat: "crisis", name: "感染者靠近", when: act(2), text: "林子边有一小群感染者在游荡，正往农场这边挪。", opts: [
    { label: "主动出击", fx: [["spawn", 4, { ammo: 6 }]], note: "打完有弹药" },
    { label: "加固围栏", cost: { wood: 3 }, fx: [], note: "今晚安全" },
    { label: "躲着", p: 0.8, win: [], lose: [["fatigue", 30], ["mood", -2]], loseNote: "有人受了伤" },
  ] },
  D03: { cat: "crisis", name: "枪管生锈", when: all(act(3), (e) => ["pistol", "shotgun", "rifle"].some((g) => e.qty(g, true))), text: "你最常用的那把枪，枪管里起了一层锈。", opts: [
    { label: "自己保养", cost: { parts: 3 }, fx: [], note: "枪擦好了，不会走火" },
    { label: "找唐九换零件", pay: 40, fx: [["give", { ammo: 5 }]] },
    { label: "先凑合用", p: 0.5, win: [], lose: [["hp", -15]], loseNote: "走火擦伤了手" },
  ] },
  D04: { cat: "crisis", name: "加工站冒烟", when: (e) => !!e.runningJob(), text: "加工站的炉子冒出黑烟，里面还有一批没做完的东西。", opts: [
    { label: "冲进去救", fx: [["hp", -15]], note: "设施和成品都保住" },
    { label: "拆出隔离带", cost: { wood: 3 }, fx: [["stationHit"]] },
    { label: "放弃这批成品", fx: [["killJob"]] },
  ] },
  D05: { cat: "crisis", name: "疫病传言", when: act(4), text: "听说邻营有人得了怪病，咳得停不下来。", opts: [
    { label: "封门三天", fx: [["visitBlock", 3]] },
    { label: "备药", cost: { herb: 4 }, fx: [], note: "就算传进来也马上治好" },
    { label: "照常", p: 0.8, win: [], lose: [["sick", 3]], loseNote: "营地有人病倒" },
  ] },
  D06: { cat: "crisis", name: "灰隼团的探子", when: all(act(6), (e) => e.raidState?.().phase === "scheduled"), text: "林子里抓到一个人，衣领里缝着灰隼团的标记。", opts: [
    { label: "审问", fx: [["raidWarn", 60]] },
    { label: "放他回去传话", fx: [["rep", 4], ["raidLess", 2]] },
    { label: "收买他", pay: 60, fx: [["raidDelay", 5]] },
  ] },
  D07: { cat: "crisis", name: "断粮", rescue: true, when: (e) => e.s.day >= 6 && e.foodDays?.() < 2, text: "仓库快见底了，算下来口粮撑不过两天。", opts: [
    { label: "宰一只鸡", req: needCoop, fx: [["give", { bread: 6 }], ["mood", -1]] },
    { label: "向联盟借", fx: [["give", { bread: 8 }], ["debt", 10, { bread: 10 }, "还联盟的口粮"]] },
    { label: "全营节食", fx: [["mood", -6], ["fatigue", 20]] },
  ] },
  D08: { cat: "crisis", name: "塌方", when: all(act(3), noPerk("road")), text: "去旧医院的路塌了一段。", opts: [
    { label: "清理", fx: [["stamina", -30]], note: "路通了" },
    { label: "绕路", fx: [["buff", "detour", 5, 30]] },
    { label: "用石材铺路", cost: { stone: 5 }, fx: [["perk", "road"]] },
  ] },
  D09: { cat: "crisis", name: "弹药受潮", when: (e) => e.qty("ammo", true) >= 10, text: "仓库漏雨，弹药箱泡了水。", opts: [
    { label: "摊开晒", fx: [["lose", "ammo", 0.3]] },
    { label: "换包装", cost: { cloth: 2 }, fx: [], note: "全保住" },
    { label: "赶紧打掉练枪", fx: [["lose", "ammo", 0.5], ["xp", "combat", 30]] },
  ] },
  D10: { cat: "crisis", name: "尸潮早到", when: (e) => e.hordeSoon(), text: "林子里的鸟一早就飞光了，尸潮怕是要提前来。", opts: [
    { label: "全员备战", fx: [["buff", "defense", 0, 2], ["buff", "work", 0, -1]] },
    { label: "加高围栏", cost: { wood: 6 }, fx: [["repair", "fences"]] },
    { label: "赌它不来", p: 0.5, win: [["hordeShift", 2]], lose: [["hordeTomorrow"]], loseNote: "尸潮提前到明天" },
  ] },

  // ===== 奇遇与小确幸 =====
  J01: { cat: "luck", name: "流星", newbie: true, text: "凌晨划过一颗很亮的流星，拖着长长的尾巴。", opts: [
    { label: "许愿丰收", fx: [["buff", "growth", 0, 0.5]] },
    { label: "许愿平安", fx: [["buff", "guard", 3, 0.3]] },
    { label: "许愿发财", p: 0.5, win: [["money", 60]], lose: [], loseNote: "什么都没有" },
  ] },
  J02: { cat: "luck", name: "迷路的鹿", newbie: true, text: "一只鹿闯进了田里，瞪着眼睛不敢动。", opts: [
    { label: "放它走", fx: [["mood", 3]] },
    { label: "牵去集市卖", fx: [["money", 50]] },
    { label: "打猎", fx: [["give", { bread: 5 }], ["mood", -1]] },
  ] },
  J03: { cat: "luck", name: "旧相机", when: act(3), text: "一台旧相机里还有一卷没冲的胶卷。", opts: [
    { label: "冲洗出来挂墙上", fx: [["mood", 5], ["research", 1]] },
    { label: "卖给收藏家", fx: [["money", 50]] },
    { label: "找到照片里的人", fx: [["rep", 4], ["later", 3, { bread: 2, cloth: 2 }, 0, "照片里的人来道谢了"]] },
  ] },
  J04: { cat: "luck", name: "一桶好酒", when: act(4), text: "地窖角落里翻出一桶封得好好的酒。", opts: [
    { label: "留给节庆", fx: [["festNext"]] },
    { label: "送给唐九", fx: [["caravanDisc", 0.9]] },
    { label: "自己喝", fx: [["stamina", 100], ["fatigue", 10]] },
  ] },
  J05: { cat: "luck", name: "会说话的鹦鹉", text: "一只鹦鹉停在工作台上，学着人喊“开饭啦”。", opts: [
    { label: "留着", fx: [["buff", "morale", 10, 1]] },
    { label: "卖掉", fx: [["money", 70]] },
    { label: "放飞", fx: [["mood", 1]] },
  ] },
  J06: { cat: "luck", name: "田里的铁盒", newbie: true, text: "锄地时挖出一个生锈的小铁盒。", opts: [
    { label: "打开", fx: [["money", 40]] },
    { label: "交公", fx: [["rep", 3]] },
    { label: "原样埋回去", fx: [["later", 5, null, 80, "铁盒里多了 80 金币和一张字条：“谢谢你的耐心。”"]] },
  ] },
  J07: { cat: "luck", name: "老唱片", when: radio, text: "一张保存完好的老唱片，封套上的歌手笑得很甜。", opts: [
    { label: "在电台放", fx: [["buff", "radio", 0, 1]] },
    { label: "送给老琴", fx: [["trust", "laoqin", 2]] },
    { label: "卖掉", fx: [["money", 30]] },
  ] },
  J08: { cat: "luck", name: "双胞胎小猫", text: "仓库角落里缩着两只小猫，一黑一白。", opts: [
    { label: "收养", fx: [["mood", 4], ["buff", "cats", 20, 1]] },
    { label: "送给彭姐的营地", fx: [["peng", 1]] },
    { label: "放回原处", fx: [] },
  ] },
  J09: { cat: "luck", name: "彩虹", newbie: true, text: "雨后天边挂着一道彩虹，从林子一直跨到河边。", opts: [
    { label: "拍下来", fx: [["mood", 2], ["research", 1]] },
    { label: "让大家停下来看", fx: [["mood", 4]] },
    { label: "赶工", fx: [["rush"]] },
  ] },
  J10: { cat: "luck", name: "陌生人的箱子", text: "营门口放着一只上锁的箱子，没写名字。", opts: [
    { label: "打开", fx: [["random", [{ parts: 5 }, { medkit: 2 }, { seedPumpkin: 3, seedCotton: 3 }]]] },
    { label: "等主人来取", fx: [["later", 3, { parts: 4, medkit: 1 }, 40, "箱子的主人回来了，送来双倍的谢礼"]] },
    { label: "交给联盟", fx: [["rep", 3]] },
  ] },
};

for (const [id, ev] of Object.entries(EVENTS)) ev.id = id;
export const EVENT_IDS = Object.keys(EVENTS);
export const STARTERS = EVENT_IDS.filter((id) => EVENTS[id].step === 1);
