// v0.36.0「巨影」：《余烬农场：十凶方案》的数据——十凶共用的规矩、前五凶（河伯、收破烂的、〇号、黑瞎子、白毛风）、
// 战利品和凶器、打赢以后地方的变化、传闻卡、声音提示、倒下以后的那一句、新的声音。
// 后五凶（雕爷和看门的、黑潮、风口、末班车、扑火）在 v0.37.0「扑火」里接着加，十凶录先给它们留格子。
// 数都是第一次打的数；凶台（scripts/titan-sim.mjs）调过以后以这里为准。
import { ITEMS, ZOMBIES, WEAPONS } from "./data.js";
import { ZSTATS, ARMOR, MELEE, GEAR_ICON_IDS, KIND_NAMES, SLOT_NAMES } from "./gear-data.js";
import { SFX, STINGERS } from "./audio-data.js";
import { CUES } from "./feel-data.js";
import { FALL_HINTS } from "./nightfall-data.js";
import { EVENTS, EVENT_IDS } from "./daily-data.js";

export const TITAN_SCHEMA = 1;

// ================= 十凶共用 =================
export const TRULES = {
  // 走到窝多近它醒（各凶可以自己定）；追出多远回窝
  wake: 220,
  leash: 780,
  // 回窝：走得快一点；路上和到了窝里一共回四分之一血（10 秒回完），当天不再多回；第二天回满
  homeSpeed: 1.35,
  regen: 0.25,
  regenTime: 10,
  // 打赢以后几天回来、每回来一次血多几成、最多多几次
  back: 28,
  backHp: 0.2,
  backMax: 3,
  // 越打越疯：打满几秒，快多少、出招间隔乘多少
  enrage: [
    { at: 240, speed: 1.25, cd: 0.8 },
    { at: 420, speed: 1.5, cd: 0.6 },
  ],
  // 打晃：攒满晃几秒、晃的时候挨打乘多少、晃一次下回要多攒多少；几秒没挨打开始消、每秒消多少；推开一下攒多少
  stagger: { time: 2.5, mul: 1.4, grow: 1.25, wait: 2.5, decay: 12, shove: 30 },
  // 每种家伙攒晃的倍数（按击退算）：钝器、长柄攒得多，利器少，远程更少
  poiseKind: { blunt: 1.25, pole: 1.1, blade: 0.75, ranged: 0.5, throw: 0.6, trap: 0.8, dot: 0 },
  // 换段：吼一声，几秒不挨打，把身边的人震开多远
  phaseInv: 1.6,
  phasePush: 150,
  phaseRing: 170,
  // 预兆最短几秒；听过打法以后大招的预兆多几秒
  minWarn: 0.6,
  intelWarn: 0.2,
  // 卷土重来以后再打赢：金币和一包稀有货
  repeatGold: 600,
  // 它醒的时候，窝附近这么远以内的普通感染者躲开（它的地盘里没有别的感染者）
  clear: 460,
  // 每天几点它回满血（当天打掉的血一直留到这个钟点）
  healHour: 6 * 60,
};

// 十凶录的十个格子（没见过的时候是一团黑影）。前五凶在这一版，后五凶下一版
export const TITAN_ORDER = ["hebo", "scrap", "zero", "bear", "frost", "diao", "tide", "vent", "train", "moth"];
export const TITAN_SLOTS = {
  hebo: { name: "河伯", where: "溪谷试验田" },
  scrap: { name: "收破烂的", where: "雨巷住区" },
  zero: { name: "〇号", where: "检疫科研园" },
  bear: { name: "黑瞎子", where: "雾松林场" },
  frost: { name: "白毛风", where: "白霜气象站" },
  diao: { name: "雕爷和看门的", where: "北线货运站" },
  tide: { name: "黑潮", where: "沉湾船坞" },
  vent: { name: "风口", where: "地底避难城" },
  train: { name: "末班车", where: "地铁隧道" },
  moth: { name: "扑火", where: "余烬农场" },
};

const story = (e, act) => (e.sc?.claimed || []).includes(act);

// ================= 前五凶 =================
// 每一凶：type 是它在感染者表里的名字；lair 窝；wake 走多近醒；open 什么时候开始有它（openText 写给人看）；
// hp、speed、r（挨打的半径）、w/h（画出来多大，美术像素，一格是地图上 2×2）；phases 换段的血线；poise 打晃要攒多少。
export const TITANS = {
  // ---------- 第一凶：河伯（溪谷的河，天黑以后） ----------
  hebo: {
    id: "hebo",
    type: "t_hebo",
    name: "河伯",
    title: "溪谷的河",
    region: "valley",
    lair: { x: 875, y: 330 },
    wake: 230,
    leash: 760,
    // 天黑以后才从河里出来（18:00 到第二天 06:00）；白天河边照样钓鱼种地
    hours: { from: 18 * 60, to: 6 * 60 },
    open: (e) => e.s.day >= 12 && !!e.d?.unlocked?.valley,
    openText: "第 12 天起、溪谷开了以后；天黑以后在溪谷的河里",
    hp: 3800,
    speed: 55,
    r: 50,
    w: 76,
    h: 86,
    phases: [0.6, 0.25],
    poise: 260,
    // 河（溪谷中间那条从上到下的水渠，一直是水）；第二段水渠两边的地漫上水
    river: { x: 858, y: 40, w: 34, h: 930 },
    lanes: [
      { x: 770, y: 180, w: 88, h: 230 },
      { x: 892, y: 180, w: 96, h: 230 },
    ],
    water: { slow: 0.65 },
    // 钻泥：沉下去几秒、在泥里走几秒、泥里多快（水里更快），冒出来前的预兆、红圈多大、伤害、倒地；
    // 冒在干地上搁浅几秒、搁浅时挨打乘多少；每段的间隔
    dive: { sink: 0.9, travel: [1.3, 2.4], speed: 150, waterSpeed: 215, warn: 1.05, r: 80, dmg: 30, down: 0.7, beach: 3, beachMul: 1.8, cd: [5, 4.2, 7] },
    // 站着的时候身上裹着一层泥：只打得进一半（搁浅、打晃的时候不算）
    upMul: 0.5,
    mud: { n: [3, 4, 5], r: 55, warn: 0.9, dmg: 10, spread: 85, zone: { r: 62, t: 8, slow: 0.55 }, cd: 7, min: 120, max: 470 },
    sweep: { r: 165, arc: 0.95, warn: 0.75, dmg: 30, push: 70, cd: 2.6, near: 150, twice: 0.55 },
    drag: { len: 330, w: 38, warn: 0.9, hold: 2, dps: 12, pull: 120, cd: 9, min: 140 },
    trophy: "tTrophyHebo",
    gear: "heboFork",
    perk: "溪谷的河清了：那条河的鱼不用再验水；每天早上河边冲上来一样东西",
    lore: ["检疫科研园的废液，顺着旧排水支管排进了溪谷上游的河。", "浅滩的烂泥里长出来一个东西：上半身还是个人，下半身拖着一大坨泥和水草。溪谷的人管它叫河伯。"],
    rumor: "电台：溪谷的人说，天一黑河里就有东西拖人下水，他们管它叫河伯。",
    tip: "河伯：脚下咕嘟咕嘟冒泡，就是它要从下面冒出来——站在干地上等着，冒出来那一下滚开，它就搁浅在干地上，那几秒才打得动它。",
    intel: "站在干地上等它冒出来，滚开，它搁浅时上去打",
    down: ["河伯沉进了自己的泥里，再没浮上来。", "河面上漂着一层油花，过了一会儿，水慢慢清了。"],
  },
  // ---------- 第二凶：收破烂的（雨巷，瞎的，只认声音） ----------
  scrap: {
    id: "scrap",
    type: "t_scrap",
    name: "收破烂的",
    title: "雨巷 · 老马",
    region: "courtyard",
    lair: { x: 1100, y: 720 },
    // 瞎的：只有撞到它跟前（多近）或者被它听见才醒
    wake: 100,
    leash: 780,
    open: (e) => e.s.day >= 15 && !!e.d?.unlocked?.courtyard,
    openText: "第 15 天起、雨巷开了以后；雨巷住区东头",
    hp: 3200,
    speed: 56,
    r: 44,
    w: 56,
    h: 94,
    phases: [0.55, 0.25],
    poise: 240,
    // 听：一个声音传到它这里（声音的范围 × k + plus）就听见了，记几秒；第三段 300 以内连蹲着走都听得见
    hear: { k: 1.6, plus: 40, memory: 3.5, roll: 70, crouchNear: 300 },
    rush: { min: 150, max: 560, warn: 0.8, speed: 380, over: 90, w: 70, dmg: 34, down: 1.2, stun: 3, stunMul: 1.8, cd: 3.4, chain: [1, 1, 3], chainWarn: 0.6 },
    junk: { min: 180, max: 620, r: 60, warn: 0.9, dmg: 24, cd: 3.2 },
    swing: { r: 150, near: 140, warn: 1.2, dmg: 26, push: 80, cd: 2.8 },
    // 第二段：敲锅（声波往外走多快、走多远，扫到你时你在动它就“看见”你几秒），同时叫出来几只
    gong: { every: 20, warn: 1.0, speed: 330, max: 820, lock: 4, adds: 2, cap: 2 },
    // 背后下手：没被它“看见”、你蹲着、从背后打——乘多少（菜刀更多）
    back: { mul: 3, knife: 4, arc: 1.9 },
    // 三轮护在身前：只打得进几成（撞晕了、蹲着背后下手、打晃了的时候不算）
    front: 0.35,
    // 雨巷的门洞（叫出来的感染者从这儿出来）
    doors: [
      { x: 520, y: 600 },
      { x: 860, y: 610 },
      { x: 1180, y: 610 },
      { x: 1350, y: 430 },
    ],
    trophy: "tTrophyScrap",
    gear: "scrapShoes",
    perk: "雨巷的人敢出门了：每 7 天三户邻居送一次谢礼",
    lore: ["雨巷的人都认得收破烂的老马：蹬着三轮、摇着铃铛，走街串巷喊“收——破烂——”。", "现在他瞎了，个头长到两人半高，拖着那辆三轮，车把上的铃铛还在响。"],
    rumor: "电台：雨巷住区的人说，夜里听见收破烂的铃铛在巷子里响，谁出声谁倒霉。",
    tip: "收破烂的是瞎的，只认声音：跑、挥家伙、开枪都会让它扑过来。蹲着走它听不见，从背后下手一下顶三下；往墙边扔块石头，它会扑过去撞墙。",
    intel: "蹲着走它听不见；往墙边扔石头，它撞墙晕了上去打",
    down: ["三轮车翻在雨里，铃铛滚到墙角，响了最后一声。", "雨巷安静了一会儿。楼上有人推开了窗。"],
  },
  // ---------- 第三凶：〇号（检疫科研园东边） ----------
  zero: {
    id: "zero",
    type: "t_zero",
    name: "〇号",
    title: "检疫科研园",
    region: "quarantine",
    lair: { x: 1120, y: 540 },
    wake: 210,
    leash: 780,
    open: (e) => e.s.day >= 18 && !!e.d?.unlocked?.quarantine,
    openText: "第 18 天起、科研园开了以后；检疫科研园东边",
    hp: 4600,
    speed: 62,
    r: 40,
    w: 60,
    h: 88,
    // 第二段（一半血）分成两半；第三段两半都快一点
    phases: [0.5, 0.2],
    poise: 240,
    // 长硬壳：掉到这几条线时，对这一段挨得最多的那一类长壳，以后那一类只打得进几成
    adapt: { at: [0.85, 0.65, 0.4], k: 0.35 },
    lash: { len: 290, w: 30, warn: 0.9, dmg: 18, spread: 0.42, cd: 4.5 },
    pounce: { min: 150, max: 430, r: 80, warn: 1.0, dmg: 34, down: 0.8, cd: 5 },
    claw: { r: 100, arc: 0.85, warn: 0.85, dmg: 18, cd: 2.4, near: 92 },
    pods: { every: 12, n: 2, hp: 60, fuse: 6, gas: { r: 110, t: 8, dps: 5 }, dist: [140, 320] },
    // 分两半：剩下那个多少秒内不打死，死掉的就爬回来（带剩下那个的几成血）；两半多小、多快
    split: { merge: 12, revive: 0.5, scale: 0.74, speed: 1.15, fast: 1.2 },
    trophy: "tTrophyZero",
    gear: "zeroSuit",
    perk: "科研园拿到了〇号的样本：被咬涨的感染少一成五",
    lore: ["检疫科研园留下的第一个样本，编号〇。河水和血样的化验，就是从它身上开始的。", "停电那天隔离舱的门开了。它身上还插着输液管，手腕上挂着塑料标签。"],
    rumor: "电台：检疫科研园东边，隔离舱的门开着。有人看见里面出来的东西手腕上挂着标签。",
    tip: "〇号挨什么打多了，就对什么长硬壳：多带两样家伙换着打（快捷栏的近战再按一下换下一把），燃烧瓶、弩也算。地上鼓起来的孢囊一冒头就打破。",
    intel: "换着家伙打；孢囊冒头就打破；分成两半以后两边一起收",
    down: ["两半〇号一起倒下，再没爬起来。", "塑料标签掉在地上：“对照组 〇”。许医生会想要这个。"],
  },
  // ---------- 第四凶：黑瞎子（雾松林场，雾里） ----------
  bear: {
    id: "bear",
    type: "t_bear",
    name: "黑瞎子",
    title: "雾松林场",
    region: "pinewood",
    lair: { x: 1000, y: 480 },
    wake: 200,
    leash: 800,
    open: (e) => e.s.day >= 20 && !!e.b?.unlocked?.pinewood,
    openText: "第 20 天起、林场开了以后；雾松林场中间",
    hp: 3600,
    speed: 78,
    r: 56,
    w: 108,
    h: 104,
    phases: [0.55, 0.2],
    poise: 320,
    // 雾：打它的时候它的地盘里一直有雾：身边看得清多远，头灯、手电照着的方向看得多远
    fog: { clear: 240, lamp: 420 },
    charge: { from: [380, 520], warn: 0.8, speed: 390, len: 780, over: 220, w: 80, dmg: 42, down: 1.2, stun: 2.5, cd: [5, 4.2, 3.4], chain: [1, 2, 3] },
    fade: { t: [2, 3.5], ring: 470 },
    // 拍完、冲空以后喘几秒
    rest: { swipe: 1.4, charge: 1.1 },
    swipe: { n: [3, 4, 4], r: 135, arc: 1.0, first: 0.8, warn: 0.6, gap: 0.15, dmg: 24, down: 0.8, cd: 3.4, near: 150 },
    roar: { warn: 0.8, r: 320, sta: 30, noRun: 3, cd: 14 },
    slam: { r: 125, warn: 1.1, dmg: 40, down: 1.0, cd: 6.5 },
    log: { len: 560, w: 46, warn: 0.8, speed: 560, dmg: 30, cd: 8, min: 220 },
    // 皮糙肉厚：平时只打得进几成；撞晕、吓得缩成一团、被夹住、站起来露出肚子时挨打乘多少
    hide: 0.5,
    bare: 1.3,
    // 怕火：火边愣几秒；燃烧瓶砸中吓得缩成一团几秒；踩上捕兽夹夹住几秒
    fear: { edge: 2, panic: 4, trap: 3.5 },
    trophy: "tTrophyBear",
    gear: "bearCoat",
    perk: "林场安生了：每天早上护林小屋门口多一捆木材和一块松脂",
    lore: ["林场的护林员养过一头黑熊，日记里写：“它不伤人，只是怕火。”", "后来它喝了上游的水，站起来有三个人高，左后腿上还夹着二十年前的一只捕兽夹。"],
    rumor: "电台：雾松林场起雾的时候，林子里有东西撞树，咚、咚的，护林小屋的门板都被拍裂了。",
    tip: "黑瞎子躲在雾里：林子里响一声、雾里亮起一道箭头，就是它要冲过来，往旁边滚。它皮厚，平时只打得进一半；它怕火——地上烧着的地方它不往里冲，燃烧瓶砸中它会吓得缩成一团；它也踩捕兽夹、会撞树，那几秒才打得动它。",
    intel: "听见响动往旁边滚；燃烧瓶、捕兽夹、让它撞树，那几秒才打得动",
    down: ["黑瞎子侧着倒在松针上，腿上的旧夹子终于松开了。", "雾散了一点。林子里头一回这么安静。"],
  },
  // ---------- 第五凶：白毛风（白霜气象站外） ----------
  frost: {
    id: "frost",
    type: "t_frost",
    name: "白毛风",
    title: "白霜气象站",
    region: "frost",
    lair: { x: 940, y: 470 },
    wake: 220,
    leash: 800,
    open: (e) => story(e, "act7") && !!e.b?.unlocked?.frost,
    openText: "主线第七段（寒潮）走完以后；白霜气象站外的空地",
    hp: 3600,
    speed: 58,
    r: 48,
    w: 80,
    h: 98,
    phases: [0.6, 0.25],
    poise: 300,
    // 冰甲：多厚、碎了几秒后重新结多厚；冰没化之前打它只打得进几成；钝器、火敲冰快多少，利器长柄慢多少；燃烧瓶、铁桶烤冰多快
    armor: { hp: 1200, regrow: 600, back: 12, mul: 0.3, blunt: 1.6, fire: 3, other: 0.5, molotov: 320, barrel: 200 },
    // 四只铁桶：烧着的时候身边暖和（多大一圈），它站在桶边冰化得快；灭了按交互添一块木材重新点着
    barrels: [
      { x: 700, y: 430 },
      { x: 1190, y: 430 },
      { x: 760, y: 790 },
      { x: 1130, y: 790 },
    ],
    warm: 135,
    melt: 80,
    cold: { regen: 0.6 },
    icicle: { n: 6, r: 50, warn: 1.1, dmg: 20, spread: 230, cd: 12, waves: [1, 1, 2] },
    breath: { r: 260, arc: 0.5, warn: 1.1, dmg: 18, slow: 0.7, slowT: 2, cd: 11 },
    sweep: { r: 140, arc: 1.1, warn: 1.0, dmg: 26, push: 90, cd: 7, near: 135 },
    ice: { n: 2, r: 95, t: 14, cd: 15, grip: 0.12 },
    // 白毛风：多久刮一次、刮多久；看得清多远；离火远了每秒掉多少（保暖 4 以上掉一半）、体力回得慢；
    // 在风雪里不见了，从你身边一团雪里出来抡一杆
    whiteout: { every: 40, last: 20, clear: 200, cold: 2.5, regen: 0.5, blink: { warn: 1.1, cd: 6, r: 140, arc: 1.1, dmg: 32, push: 90 } },
    p3: { speed: 1.35 },
    trophy: "tTrophyFrost",
    gear: "frostPick",
    perk: "气象站的仪器修好了：寒潮里在暖区外多饿的四成减到两成",
    lore: ["白霜气象站最后一个值班员姓白。寒潮那年站里的人都撤了，他留下来每天往外报天气。", "电台里最后一条是他的声音：“北风九级，白毛风。我出去看看风杆。”"],
    rumor: "电台：白霜气象站那边又起白毛风了。有人说，风里有个扛着风杆的人影。",
    tip: "白毛风一身冰甲，冰没化之前打不动：把它引到烧着的铁桶边上、扔燃烧瓶，冰化得快，钝器敲冰也快。起白毛风的时候守在火边，铁桶灭了添一块木材。",
    intel: "引它到烧着的铁桶边、扔燃烧瓶化冰；白毛风来了守着火",
    down: ["风杆插在雪里，上面的风杯还在慢慢转。", "风停了。气象站的仪器咔哒一声，重新开始记数。"],
  },
};
export const TITAN_IDS = Object.keys(TITANS);
export const TITAN_TYPES = Object.fromEntries(TITAN_IDS.map((id) => [TITANS[id].type, id]));
// 孢囊（〇号种在地上的）：打得破的“感染者”，不动不咬
export const POD_TYPE = "t_pod";

// 感染者表：名字、三段的数（十凶自己的血、速度、伤害都在上面，这里只是让别的地方认得它）
for (const id of TITAN_IDS) {
  const T = TITANS[id];
  ZOMBIES[T.type] ??= { name: T.name, icon: 58, hp: T.hp, speed: T.speed, damage: 30, xp: 200 };
  for (const ph of [0, 1, 2]) ZSTATS[ph][T.type] ??= { hp: T.hp, speed: T.speed, damage: 30 };
}
ZOMBIES[POD_TYPE] ??= { name: "孢囊", icon: 16, hp: 60, speed: 0, damage: 0, xp: 1 };
for (const ph of [0, 1, 2]) ZSTATS[ph][POD_TYPE] ??= { hp: 60, speed: 0, damage: 0 };

// ================= 战利品（捐进档案馆“十凶”柜） =================
export const TITAN_TROPHIES = {
  tTrophyHebo: { name: "河伯的鳃骨", desc: "从河伯脖子上掰下来的一片骨头，湿了还会发亮。可以捐给档案馆的十凶柜。" },
  tTrophyScrap: { name: "老马的铃铛", desc: "收破烂的三轮车上的车铃，一摇还响。可以捐给档案馆的十凶柜。" },
  tTrophyZero: { name: "〇号的标签", desc: "塑料标签，上面印着“对照组 〇”。可以捐给档案馆的十凶柜。" },
  tTrophyBear: { name: "生锈的夹子", desc: "夹在黑瞎子腿上二十年的捕兽夹，弹簧早就锈死了。可以捐给档案馆的十凶柜。" },
  tTrophyFrost: { name: "测风杆的铭牌", desc: "风杆上的铜牌：“白霜站 · 二号风杆”。可以捐给档案馆的十凶柜。" },
};
for (const [id, t] of Object.entries(TITAN_TROPHIES)) ITEMS[id] ??= { name: t.name, icon: 55, type: "quest", protected: true, desc: t.desc };
export const TITAN_TROPHY_IDS = Object.keys(TITAN_TROPHIES);
// 档案馆第八个展柜：捐满几件给什么
export const TITAN_CASE = {
  name: "十凶柜",
  steps: [
    { n: 3, text: "营地声望 +10" },
    { n: 6, text: "全营士气 +5" },
    { n: 10, text: "纪念石旁立一块十凶碑：全营心情一直 +3" },
  ],
};

// ================= 凶器（只给第一次） =================
// 都不会坏；数比现在最好的同类最多高一成，多的是一样本事
export const TITAN_ARMOR = {
  scrapShoes: { name: "千层底", slot: "feet", armor: 0, bite: 10, weight: 0.3, noise: -2, warmth: 1, dur: 0, mods: 1, crouchSpeed: 1.25, scrap: { cloth: 2 }, look: { boots: "soft" }, where: "打赢收破烂的" },
  zeroSuit: { name: "隔离服", slot: "body", armor: 0.2, scratch: 70, bite: 75, weight: 6, noise: 1, warmth: 1, dur: 0, mods: 2, gas: 0.5, acid: 0, scrap: { cloth: 3, scrap: 2 }, look: { armor: "riot" }, where: "打赢〇号" },
  bearCoat: { name: "熊皮袄", slot: "body", armor: 0.22, scratch: 70, bite: 55, weight: 6, noise: 0, warmth: 4, dur: 0, mods: 2, scrap: { cloth: 4 }, look: { armor: "coat" }, where: "打赢黑瞎子" },
};
export const TITAN_MELEE = {
  heboFork: { name: "分水叉", kind: "pole", dmg: 38, cd: 0.6, range: 115, arc: 0.5, knock: 38, pierce: 0.75, stamina: 8, noise: 60, dur: 0, mods: 2, brace: 2, slowHit: { k: 0.5, t: 2 }, scrap: { scrap: 3 }, where: "打赢河伯" },
  frostPick: { name: "冰镐", kind: "blade", dmg: 42, cd: 0.6, range: 66, arc: 0.8, knock: 22, pierce: 0.9, stamina: 9, noise: 80, dur: 0, mods: 2, scrap: { scrap: 3 }, where: "打赢白毛风" },
};
export const TITAN_GEAR_IDS = [...Object.keys(TITAN_MELEE), ...Object.keys(TITAN_ARMOR)];
const GEAR_NOTE = {
  heboFork: "打中的感染者 2 秒走得慢一半",
  frostPick: "正面打重甲也打得进",
  scrapShoes: "蹲着走快两成五",
  zeroSuit: "酸液不掉血，毒雾掉一半",
  bearCoat: "寒潮里穿着不冷",
};
for (const [id, a] of Object.entries(TITAN_ARMOR)) {
  ARMOR[id] ??= a;
  const desc = [SLOT_NAMES[a.slot] + "栏", a.armor ? "护甲 " + Math.round(a.armor * 100) + "%" : "", a.scratch ? "防抓 " + a.scratch + "%" : "", a.bite ? "防咬 " + a.bite + "%" : "", "重量 " + a.weight, a.noise ? "噪音 " + (a.noise > 0 ? "+" : "") + a.noise : "", a.warmth ? "保暖 " + a.warmth : "", "不会坏"].filter(Boolean).join(" · ");
  ITEMS[id] ??= { name: a.name, gear: id, type: "gear", protected: true, sell: 0, desc: desc + "。" + GEAR_NOTE[id] + "。" + a.where + "得来的，世上只有这一件。" };
}
for (const [id, w] of Object.entries(TITAN_MELEE)) {
  MELEE[id] ??= w;
  WEAPONS[id] ??= { damage: w.dmg, range: w.range, cooldown: w.cd, noise: w.noise, melee: true };
  const desc = KIND_NAMES[w.kind] + " · 伤害 " + w.dmg + " · 间隔 " + w.cd + " 秒 · 击退 " + w.knock + " · 破甲 " + Math.round(w.pierce * 100) + "% · 声音 " + w.noise + " · 不会坏";
  ITEMS[id] ??= { name: w.name, gear: id, type: "weapon", protected: true, sell: 0, desc: desc + "。" + GEAR_NOTE[id] + "。" + w.where + "得来的，世上只有这一件。" };
}

// ================= 打赢以后地方的变化 =================
// 河伯：河边每天早上冲上来一样东西（在溪谷的河边按交互捡）；黑瞎子：护林小屋门口每天一捆木材和一块松脂
export const PERK_DROPS = {
  hebo: { region: "valley", x: 912, y: 250, name: "河边冲上来的东西", pool: [[{ fieldSample: 1 }, 4], [{ herb: 2 }, 3], [{ seedHerb: 2 }, 2], [{ cloth: 2 }, 2], [{ parts: 1 }, 1]] },
  bear: { region: "pinewood", x: 790, y: 560, name: "护林小屋门口的木材", pool: [[{ wood: 4, resin: 1 }, 1]] },
};
// 收破烂的：每 7 天雨巷三户邻居送一次谢礼
export const SCRAP_GIFT = { every: 7, bundle: { cloth: 3, seedBean: 3, parts: 1 } };
// 〇号：被咬涨的感染乘多少
export const ZERO_BITE = 0.85;
// 白毛风：寒潮里在暖区外多饿的那一截乘多少（四成 → 两成）
export const FROST_COLD = 0.5;

// ================= 传闻卡（每日抉择） =================
const known = (id) => (e) => !!e.titanKnown?.(id);
const NEW_CARDS = {
  T01: {
    pack: "titan",
    cat: "crisis",
    name: "河边的拖痕",
    when: known("hebo"),
    text: "溪谷的人说，天一黑河里就有东西拖人下水。泥地上一道拖痕，从河边一直拉到水里。",
    opts: [
      { label: "打听它怎么打", cost: { bread: 1 }, fx: [["tIntel", "hebo"]], note: "它冒出来之前脚下先冒泡" },
      { label: "备两个燃烧瓶的料", cost: { cloth: 1 }, fx: [["give", { resin: 2 }]] },
      { label: "知道了", fx: [["xp", "exploration", 6]] },
    ],
  },
  T02: {
    pack: "titan",
    cat: "crisis",
    name: "巷子里的铃铛",
    when: known("scrap"),
    text: "雨巷的人说，收破烂的老马又出来了，铃铛一响谁也不敢出声。有个孩子说，他听见老马在墙角喘气。",
    opts: [
      { label: "打听它怎么打", cost: { bread: 1 }, fx: [["tIntel", "scrap"]], note: "它是瞎的，只认声音" },
      { label: "攒几块石头", fx: [["give", { stone: 6 }]] },
      { label: "知道了", fx: [["xp", "exploration", 6]] },
    ],
  },
  T03: {
    pack: "titan",
    cat: "crisis",
    name: "隔离舱的门",
    when: known("zero"),
    text: "科研园东边，一扇隔离舱的门开着，门框上全是抓痕。许医生说，里面关过的东西，挨过什么打就会对什么长壳。",
    opts: [
      { label: "听许医生讲讲", cost: { bread: 1 }, fx: [["tIntel", "zero"]], note: "它会对挨得多的那一类长硬壳" },
      { label: "缝一副口罩", cost: { cloth: 1 }, fx: [["uMask"]], note: "今天在绿雾里少掉一半血" },
      { label: "知道了", fx: [["xp", "exploration", 6]] },
    ],
  },
  T04: {
    pack: "titan",
    cat: "crisis",
    name: "林子里的撞树声",
    when: known("bear"),
    text: "雾松林场起雾的时候，林子里有东西撞树，咚、咚的。护林员的旧日记里夹着一句：“它不伤人，只是怕火。”",
    opts: [
      { label: "翻翻护林员的日记", cost: { bread: 1 }, fx: [["tIntel", "bear"]], note: "它怕火，也踩捕兽夹" },
      { label: "要一副捕兽夹", cost: { scrap: 3 }, fx: [["give", { bearTrap: 1 }]] },
      { label: "知道了", fx: [["xp", "exploration", 6]] },
    ],
  },
  T05: {
    pack: "titan",
    cat: "crisis",
    name: "风里的人影",
    when: known("frost"),
    text: "夜莺在电台里放了一段老录音：“北风九级，白毛风。我出去看看风杆。”她说，那是白霜站最后一个值班员。",
    opts: [
      { label: "问夜莺还知道什么", cost: { bread: 1 }, fx: [["tIntel", "frost"]], note: "它一身冰，火一烤就化" },
      { label: "多劈一捆柴", fx: [["give", { wood: 4 }]] },
      { label: "知道了", fx: [["xp", "exploration", 6]] },
    ],
  },
};
for (const [id, ev] of Object.entries(NEW_CARDS)) {
  if (EVENTS[id]) continue;
  EVENTS[id] = ev;
  EVENT_IDS.push(id);
}
export const T_CARD_IDS = Object.keys(NEW_CARDS);

// ================= 声音提示、倒下以后那一句 =================
Object.assign(CUES, {
  tRoar: "巨大的吼声",
  tBubble: "脚下在冒泡",
  tBell: "铃铛在响",
  tRush: "有东西冲过来",
  tGong: "锅响了",
  tLash: "输液管甩过来",
  tPod: "孢囊在鼓",
  tCharge: "雾里有东西冲过来",
  tBearRoar: "熊在吼",
  tIcicle: "头顶在掉冰锥",
  tBreath: "寒气喷过来",
  tWhite: "白毛风来了",
  tSweep: "风杆抡过来",
});
Object.assign(FALL_HINTS, {
  t_hebo: "河伯脚下先冒泡才冒出来：站在干地上等它，冒出来时滚开，它搁浅了再打。",
  t_scrap: "收破烂的是瞎的：蹲着走它听不见；扔块石头让它撞墙，晕了再上去。",
  t_zero: "〇号挨什么打多了就对什么长壳：多带两样家伙换着打，孢囊冒头就打破。",
  t_bear: "黑瞎子皮厚：带燃烧瓶和捕兽夹，让它撞树，它晕了、缩成一团、被夹住时再打。",
  t_frost: "白毛风的冰甲要火烤：引它到烧着的铁桶边，白毛风来了守着火。",
  t_pod: "孢囊炸开是一团毒雾：一冒头就打破。",
});

// ================= 新的声音（都是代码合成的数，写法见 audio-data.js 开头） =================
Object.assign(SFX, {
  tRoar: { layers: [{ w: "saw", f: [90, 46], t: 1.6, a: 0.08, c: 0.9, bp: [260, 1.6], v: 1, j: 0.08, vib: [6, 0.04] }, { w: "brown", t: 1.5, c: 1, v: 0.8 }, { w: "noise", t: 1.0, lp: 600, c: 1.2, v: 0.35 }], peak: 0.95, sr: 22050 },
  tThud: { layers: [{ w: "sine", f: [60, 26], t: 0.6, a: 0.002, c: 1.3, v: 1 }, { w: "brown", t: 0.7, c: 1.4, v: 0.8 }, { w: "noise", t: 0.2, lp: [900, 150], c: 2, v: 0.6 }], peak: 0.95, sr: 22050 },
  tSplash: { layers: [{ w: "noise", t: 0.7, a: 0.01, c: 1.2, lp: [3000, 500], v: 0.9 }, { w: "brown", t: 0.6, c: 1.5, v: 0.6 }, { w: "sine", f: [180, 60], t: 0.4, c: 2, v: 0.4 }], peak: 0.7, sr: 22050 },
  tBubble: { layers: [0, 0.12, 0.27, 0.36].map((d, i) => ({ w: "sine", d, f: [260 + i * 70, 520 + i * 90], t: 0.09, c: 2.5, v: 0.45 })), peak: 0.35 },
  tBell: { layers: [{ w: "square", f: 1480, t: 0.5, c: 2.2, bp: [2400, 5], v: 0.4 }, { w: "sine", f: 2960, t: 0.6, c: 2, v: 0.25 }, { w: "sine", d: 0.18, f: 1480, t: 0.4, c: 2.2, v: 0.25 }], peak: 0.4 },
  tGong: { layers: [{ w: "square", f: [220, 205], t: 1.6, a: 0.002, c: 1.1, bp: [700, 3], v: 0.6 }, { w: "sine", f: [440, 430], t: 1.8, c: 1, v: 0.4 }, { w: "noise", t: 0.08, hp: 1500, c: 3, v: 0.5 }], peak: 0.7, sr: 22050 },
  tWhip: { layers: [{ w: "noise", t: 0.28, a: 0.01, c: 2, hp: [700, 2600], bp: [1800, 2], v: 0.8 }, { w: "noise", d: 0.2, t: 0.08, hp: 2400, c: 3, v: 0.7 }], peak: 0.5 },
  tPop: { layers: [{ w: "noise", t: 0.18, a: 0.002, c: 2.5, lp: [2400, 600], v: 0.8 }, { w: "sine", f: [300, 90], t: 0.2, c: 2, v: 0.5 }], peak: 0.5 },
  tBearRoar: { layers: [{ w: "saw", f: [140, 70], t: 1.3, a: 0.05, c: 1, bp: [420, 1.4], v: 1, j: 0.12, vib: [9, 0.06] }, { w: "noise", t: 1.1, bp: [600, 1], c: 1.1, v: 0.5 }, { w: "brown", t: 1.2, c: 1.1, v: 0.6 }], peak: 0.95, sr: 22050 },
  tCrack: { layers: [{ w: "noise", t: 0.12, a: 0.001, c: 3, hp: 2500, v: 0.9 }, { w: "square", f: [1200, 400], t: 0.15, c: 3, bp: [1800, 4], v: 0.4 }, { w: "noise", d: 0.05, t: 0.4, c: 1.8, bp: [4000, 2], v: 0.4 }], peak: 0.55 },
  tWind: { layers: [{ w: "pink", t: 2.2, a: 0.5, c: 0.8, lp: [700, 1600], v: 1, am: [1.3, 0.5] }, { w: "noise", t: 2, a: 0.4, c: 0.9, bp: [2200, 3], v: 0.3 }], peak: 0.6, sr: 22050 },
  tShatter: { layers: [0, 0.05, 0.11, 0.2].flatMap((d, i) => [{ w: "noise", d, t: 0.12, hp: 3000 - i * 300, c: 2.5, v: 0.6 }, { w: "sine", d, f: 2400 + i * 300, t: 0.2, c: 2.5, v: 0.25 }]), peak: 0.5 },
});
Object.assign(STINGERS, {
  // 十凶第一次露面：低音拉长、两下鼓；打赢：钟声慢慢升上去
  titan: [[0, "drone", 31, 1], [0, "string", 43, 0.9], [0.4, "tom", 38, 1], [0.8, "tom", 38, 1], [1.2, "string", 44, 0.9], [1.2, "drone", 32, 0.8]],
  titanDown: [[0, "pad", 55, 0.5], [0, "bell", 67, 0.6], [0.25, "bell", 71, 0.6], [0.5, "bell", 74, 0.65], [0.75, "bell", 79, 0.7], [1.1, "flute", 83, 0.5], [1.1, "pad", 62, 0.4]],
});

// ================= 新开局、旧档的那一张卡片 =================
// “谁的”：名字本来就以“的”结尾（收破烂的）不再多一个“的”
export const tPoss = (name) => (String(name).endsWith("的") ? String(name) : name + "的");
export const TITAN_INTRO = ["十凶：末日以后长成的十个巨物，各守着自己的窝，比大块头大一倍、难打得多。", "每一下都先在地上画出来；打不过可以走，它回窝慢慢回血，第二天回满。", "听说了哪一凶，世界地图上会标出它的窝；成就册里有一页十凶录。"];
