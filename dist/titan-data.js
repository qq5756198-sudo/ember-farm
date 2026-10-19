// v0.36.0「巨影」：《余烬农场：十凶方案》的数据——十凶共用的规矩、前五凶（河伯、收破烂的、〇号、黑瞎子、白毛风）、
// 战利品和凶器、打赢以后地方的变化、传闻卡、声音提示、倒下以后的那一句、新的声音。
// v0.37.0「扑火」：后五凶（雕爷和看门的、黑潮、风口、末班车）和最后一凶（扑火，在农场打一整夜），结局卡和十凶碑。
// 数都是第一次打的数；凶台（scripts/titan-sim.mjs）调过以后以这里为准。
import { ITEMS, ZOMBIES, WEAPONS } from "./data.js";
import { ZSTATS, ARMOR, MELEE, GEAR_ICON_IDS, KIND_NAMES, SLOT_NAMES } from "./gear-data.js";
import { SFX, STINGERS } from "./audio-data.js";
import { CUES } from "./feel-data.js";
import { FALL_HINTS } from "./nightfall-data.js";
import { EVENTS, EVENT_IDS } from "./daily-data.js";

// 2：v0.37 加了最后一夜的记录（final）和后五凶
export const TITAN_SCHEMA = 2;

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

// 十凶录的十个格子（没见过的时候是一团黑影）
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
    // 窝在水渠南头（南边那条路的桥再往南、林子边上）：离北头的钓鱼点、两排工作点都远，夜里在河边钓鱼、干活不会把它吵醒
    lair: { x: 875, y: 900 },
    wake: 150,
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
      { x: 770, y: 805, w: 88, h: 140 },
      { x: 892, y: 805, w: 96, h: 140 },
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
    rush: { min: 150, max: 560, warn: 0.8, speed: 380, over: 90, w: 70, dmg: 34, down: 1.2, stun: 3.5, stunMul: 2, cd: 3.4, chain: [1, 1, 3], chainWarn: 0.6 },
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
    // 醒的那一圈比最近的工作点（228）少四十：站在工作点上干活不会把它吵醒
    wake: 185,
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
    // 最近的工作点 197：醒的那一圈小一点（雾里看得清的一圈是 240，走近了先看得见它趴着）
    wake: 155,
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
    hide: 0.35,
    bare: 1.5,
    // 怕火：火边愣几秒；燃烧瓶砸中吓得缩成一团几秒；踩上捕兽夹夹住几秒
    fear: { edge: 2, panic: 4, trap: 3.5 },
    trophy: "tTrophyBear",
    gear: "bearCoat",
    perk: "林场安生了：每天早上护林小屋门口多一捆木材和一块松脂",
    lore: ["林场的护林员养过一头黑熊，日记里写：“它不伤人，只是怕火。”", "后来它喝了上游的水，站起来有三个人高，左后腿上还夹着二十年前的一只捕兽夹。"],
    rumor: "电台：雾松林场起雾的时候，林子里有东西撞树，咚、咚的，护林小屋的门板都被拍裂了。",
    tip: "黑瞎子躲在雾里：林子里响一声、雾里亮起一道箭头，就是它要冲过来，往旁边滚。它皮厚，平时只打得进三成多；它怕火——地上烧着的地方它不往里冲，燃烧瓶砸中它会吓得缩成一团；它也踩捕兽夹、会撞树，那几秒才打得动它。",
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
    // 最近的工作点 220：醒的那一圈少四十
    wake: 180,
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

  // ================= v0.37.0「扑火」：后五凶 =================
  // ---------- 第六凶：雕爷和看门的（北线货运站东边的货场；一人一兽，铁链拴着） ----------
  // 两只：雕爷（人，霰弹枪、点射、烟雾弹、叫手下）和看门的（戴嘴套的大个子，链子拴在雕爷身上）。先打倒谁，后面的仗就不一样。
  diao: {
    id: "diao",
    type: "t_dog",
    name: "雕爷和看门的",
    title: "北线货运站",
    region: "railDepot",
    // 货场正中（四个工作点围着的那块空地，离每个都两百三以上）
    lair: { x: 1110, y: 545 },
    wake: 180,
    leash: 800,
    open: (e) => !!e.storyDone?.() && !!e.ct?.done,
    openText: "主线打完、隼头倒下以后；北线货运站东边的货场",
    // 两只加起来的血；各自多少在 parts 里
    hp: 4600,
    speed: 60,
    r: 52,
    w: 84,
    h: 82,
    // 血条上没有按血线的换段：先倒下哪只就换哪一段（见 titan-ai2.js）
    phases: [0.5, 0.2],
    poise: 300,
    parts: {
      boss: { type: "t_diao", name: "雕爷", hp: 1350, r: 26, w: 40, h: 64, speed: 64, poise: 160 },
      dog: { type: "t_dog", name: "看门的", hp: 3250, r: 52, w: 84, h: 82, speed: 60, poise: 300 },
    },
    // 铁链：看门的离雕爷多远就被拽住
    chain: 280,
    // 剩下的那一个血剩几成就拼命（第三段）、快多少
    last: 0.35,
    lastSpeed: 1.25,
    // 雕爷守着货场东头他的库存（离这儿多远以内走动）；手下从哪两头进货场
    post: { x: 1240, y: 470, r: 260 },
    doors: [{ x: 1440, y: 690 }, { x: 1050, y: 300 }],
    // 雕爷：离看门的身后多远站着；霰弹枪（扇面、近处多少、远了少到几成）；点射（瞄准线）；烟雾弹；叫手下
    stand: { back: 150, keep: [210, 430] },
    shotgun: { r: 260, arc: 0.42, warn: 0.6, dmg: 30, far: 0.45, near: 240, cd: 3.2 },
    snipe: { len: 640, w: 26, warn: 1.0, dmg: 22, min: 260, cd: 4.2 },
    smoke: { r: 120, t: 9, every: 16 },
    adds: { every: 35, n: 2, cap: 3, rage: 3 },
    // 大氅：正面挡七成；他举枪瞄你的那一下是敞开的（脱了就没了）
    coat: { front: 0.3, arc: 1.15 },
    // 看门的：砸地、冲撞（链子拽住会停下）、抓起人往地上摔；段二甲（雕爷先倒下）挣断链子：快一半、会咬
    slam: { r: 120, warn: 1.0, dmg: 32, down: 0.9, cd: 4.2, near: 150 },
    charge: { from: [200, 520], warn: 0.9, speed: 360, w: 84, dmg: 30, down: 1.0, over: 120, cd: 6, stun: 1.6 },
    grab: { r: 150, arc: 0.6, warn: 0.7, dmg: 14, hold: 1.4, slam: 18, down: 0.8, cd: 7, near: 140 },
    free: { speed: 1.5, bite: { r: 120, arc: 0.7, warn: 0.6, hold: 1.2, dps: 14, dmg: 10, cd: 4.5, near: 130 } },
    // 段二乙（看门的先倒下）：雕爷脱了大氅、扔燃烧瓶（落点一圈、地上烧几秒）、一次叫三个
    molotov: { r: 80, warn: 0.9, dmg: 18, burn: 3, cd: 5.5, min: 140, max: 420 },
    trophy: "tTrophyDiao",
    gear: "diaoCoat",
    perk: "灰隼团散了：货运站里雕爷的库存归你",
    lore: ["隼头只是带人出来抢的头领。灰隼团真正的大当家叫雕爷，是北线货运站以前的调度主任——残页里那张交接条上“别交给公司”，就是写给他的。", "隼头倒下以后，他把剩下的人收拢到货运站，用一根铁链牵着一只戴嘴套的大个子，叫它“看门的”。"],
    rumor: "电台：北线货运站那边有人喊话，说灰隼团的大当家还在，货场里拴着一条“看门的”。",
    tip: "雕爷和看门的：铁链拴着，看门的够不着离雕爷太远的地方。先打谁都行——先打雕爷，就绕开链子够得着的地方、用弩和枪；他的大氅正面挡七成，举枪瞄你的时候大氅是敞开的，趁那一下打，或者绕到侧面打。先打看门的，雕爷会拼命，先收拾他叫来的手下。",
    intel: "看门的够不着离雕爷太远的地方；雕爷举枪瞄你时大氅敞着，趁那一下用弩和枪打",
    down: ["铁链断在地上，看门的嘴套滚到一边。", "雕爷靠着货柜坐下，把那把霰弹枪放在膝盖上，再没站起来。货场里剩下的人都散了。"],
  },
  // ---------- 第七凶：黑潮（沉湾船坞三号泊位，满地的油） ----------
  tide: {
    id: "tide",
    type: "t_tide",
    name: "黑潮",
    title: "沉湾船坞 · 三号泊位",
    region: "shipyard",
    // 东南那口泊位的水边（雾中泊位南边）：离最近的工作点两百一
    lair: { x: 1000, y: 880 },
    wake: 170,
    leash: 800,
    open: (e) => e.s.day >= 25 && !!e.b?.unlocked?.shipyard,
    openText: "第 25 天起、船坞开了以后；沉湾船坞东南的三号泊位",
    hp: 4700,
    speed: 54,
    r: 48,
    w: 70,
    h: 92,
    phases: [0.6, 0.2],
    poise: 300,
    // 地上的油：多大、留几秒、沾上走得慢多少、身上沾着油几秒；点着了烧几秒、每秒烫多少（身上沾着油的多少）
    oil: { r: 70, t: 14, slow: 0.8, coat: 5, burn: 6, dps: 8, oiledDps: 14 },
    spray: { r: 230, arc: 0.42, warn: 0.8, dmg: 5, cd: 8, n: 3, min: 90 },
    ignite: { warn: 1.4, r: 300, cd: 11, need: 1 },
    anchor: { r: 160, arc: 0.85, warn: 1.0, dmg: 22, push: 90, cd: 5.5, near: 150 },
    hook: { len: 420, w: 34, warn: 0.9, dmg: 12, hold: 0.9, pull: 260, cd: 8, min: 170 },
    // 第二段：潜水服破了——刀枪打上去打滑（只打得进几成）；站在烧着的油里每秒掉多少，身上着了几秒、着的时候快多少、每秒掉多少；扔油桶
    slick: 0.3,
    burnHp: 200,
    aflame: { t: 6, speed: 1.35, dps: 80 },
    barrel: { r: 90, warn: 1.0, dmg: 14, cd: 7, min: 160, max: 480, oil: 105 },
    // 第三段：整个身子烧着，身边一圈烫
    aura: { r: 110, dps: 5 },
    trophy: "tTrophyTide",
    gear: "tideHelm",
    perk: "漏油堵上了：沉湾的鱼不用再验水",
    lore: ["残页《船坞的检修单》写着：三号泊位那条油轮漏油，围油栏没人管。", "船坞的老潜水员穿着铜头盔的潜水服下水去堵，再没上来。现在泊位的油水里站起来一个穿着破潜水服的东西，肚子里灌满了油，手里拖着一只船锚。"],
    rumor: "电台：沉湾船坞的人说，三号泊位的油水里站起来一个戴铜头盔的东西，手里拖着船锚。",
    tip: "黑潮会往地上喷油、拿焊枪一擦就点着：别站在油里，它一擦焊枪就往干净地方跑。它潜水服破了以后自己也怕火——把它引到油上、扔燃烧瓶点着，它掉血最快。",
    intel: "别站在油里；第二段起把它引到油上、扔燃烧瓶点着",
    down: ["铜头盔滚进水里，咕嘟冒了一串泡。", "三号泊位的油慢慢散开了。海水又能看见底。"],
  },
  // ---------- 第八凶：风口（地底避难城主风道，长在墙上不动） ----------
  vent: {
    id: "vent",
    type: "t_vent",
    name: "风口",
    title: "地底避难城 · 主风道",
    region: "shelter",
    // 主风道的风口在西边那排房子的南墙上（主风道那个工作点就是它，修好风机以后不用再去）
    lair: { x: 386, y: 238 },
    wake: 230,
    leash: 760,
    // 长在墙上，不会动
    still: true,
    open: (e) => !!e.b?.unlocked?.shelter && !!e.bflag?.("shelter_air", "service"),
    openText: "主风道修通以后；地底避难城西边那排房子的南墙上",
    hp: 4550,
    speed: 0,
    r: 70,
    w: 120,
    h: 96,
    phases: [0.5, 0.18],
    poise: 9999,
    parts: {
      fan: { type: "t_vent", name: "风机", hp: 2950 },
      lung: { type: "t_lung", name: "肺", hp: 400, r: 30, n: 4 },
    },
    // 四个肺在墙上的位置（离风口中间多远）
    lungs: [
      { dx: -150, dy: -8 },
      { dx: -82, dy: 26 },
      { dx: 82, dy: 26 },
      { dx: 150, dy: -8 },
    ],
    // 肺在的时候风机只打得进几成；风机罩着铁丝网，远程打风机只打得进几成（肺没有网）
    shield: 0.25,
    net: 0.4,
    // 吸：风道里呼呼响，地上的灰往里卷（预兆），吸几秒、越近吸得越狠（每秒拽多远）、多近扇叶刮人、几秒刮一下多少
    suck: { warn: 1.0, t: 3.2, pull: 95, near: 200, edge: 520, blade: 120, tick: 0.6, dmg: 12, cd: 12, sta: 2 },
    blow: { r: 330, arc: 0.6, warn: 1.0, dmg: 8, push: 150, gas: { r: 90, t: 6, dps: 3 }, cd: 11 },
    reach: { len: 380, w: 34, warn: 0.8, dmg: 18, hold: 1.1, chance: 0.3, cd: 7, min: 100 },
    crawl: { every: 35, n: 2, cap: 2, cracks: [{ x: 250, y: 250 }, { x: 520, y: 252 }, { x: 386, y: 262 }] },
    // 第二段：风刃（几道、从风口外多远起、多长、转多快、多宽、挨一下多少、倒地）——贴着风口的那一小块扫不到
    blades: { n: [0, 2, 2], len: 400, r0: 70, speed: [0, 0.5, 0.6], w: 26, dmg: 22, down: 0.6 },
    // 第三段：风机剩几成（最后一口气：又吸起来、吸得更狠、爬得更快）
    last: 0.18,
    lastPull: 1.15,
    lastCrawl: 20,
    trophy: "tTrophyVent",
    gear: "ventMask",
    perk: "避难城的风真正通了：居住舱多两张床",
    lore: ["避难城停风那天，几百个人都挤到了主风道的风口前面——那里是最后还有一口气的地方。", "风机停了，人也没散。主风道修通、风机重新转起来，挤在风口上的那一大片人跟着动了：它们长在一起、长在墙上，风机每转一圈，它们就一起喘一口气。"],
    rumor: "电台：地底避难城的人说，主风道修通以后，风口那面墙在喘气。",
    tip: "风口长在墙上不动：先在远处用弩、枪、弹弓把墙上四个肺打破，肺在的时候风机打不太动；它吸的时候往外跑，别贴着墙打。风刃转起来以后跟着它绕，找两道之间的空当贴上去打风机。",
    intel: "先在远处把四个肺打破；它吸的时候往外跑；风刃转起来跟着绕",
    down: ["风机停下来，又转起来——这一回只是风。", "墙上那一大片慢慢松开了。避难城里头一回吹进来干净的风。"],
  },
  // ---------- 第九凶：末班车（地铁隧道第 25 层的轨道） ----------
  train: {
    id: "train",
    type: "t_train",
    name: "末班车",
    title: "地铁隧道 · 第 25 层",
    region: "tunnel",
    floor: 25,
    // 轨道右头（检修电梯那边）；你从左头的检修梯下来
    lair: { x: 1290, y: 512 },
    wake: 820,
    leash: 99999,
    open: (e) => (e.rl?.tunnel?.deepest || 0) >= 20,
    openText: "下到地铁隧道第 25 层就碰上",
    hp: 5700,
    speed: 60,
    r: 50,
    w: 96,
    h: 64,
    // 换段：车厢打完（见 titan-ai2.js）；血条上的刻度按车厢那一截画
    phases: [0.42, 0.15],
    poise: 320,
    parts: {
      head: { type: "t_train", name: "车头", hp: 1900 },
      car: { type: "t_car", name: "车厢", hp: 950, n: 4, r: 44, len: 120 },
    },
    // 轨道（两格高，第 7、8 行）：从哪到哪；车头多长
    track: { x0: 120, x1: 1430, y: 512, h: 128 },
    headLen: 130,
    // 进站：远处一盏灯亮起来、铁轨嗡嗡响（预兆），冲过来多快；挨上多少、倒地几秒；每打掉一节快多少
    run: { warn: 1.6, speed: 520, dmg: 34, down: 1.6, cd: [6, 5.2, 4.4], faster: 0.08 },
    // 停下来：车门打开，一次下来几只（同时最多几只、隔几站开一回）；甩尾；电弧（铁轨通电几秒、每秒多少）
    stop: { t: 5.5 },
    doors: { n: 2, cap: 2, every: 1 },
    tail: { r: 160, arc: 0.9, warn: 0.9, dmg: 22, cd: 6.5 },
    // 车头正前面：汽笛一响，震开一片
    horn: { r: 150, arc: 0.8, warn: 0.9, dmg: 18, push: 110, cd: 4 },
    arc: { warn: 1.0, t: 3, dps: 14, cd: 9 },
    // 车厢还连着的时候车头只打得进几成（停着时打车厢最划算）
    linked: 0.1,
    // 车头剩几成拼命（第三段）、快多少；开走以后几秒再进站
    last: 0.35,
    lastSpeed: 1.3,
    away: [3.5, 3, 2.5],
    // 第二段：车头翻下轨道追你——咬、车钩横扫
    bite: { r: 120, arc: 0.7, warn: 0.6, dmg: 22, cd: 3, near: 120 },
    hookSweep: { r: 170, arc: 1.1, warn: 0.9, dmg: 24, push: 90, cd: 6, near: 160 },
    trophy: "tTrophyTrain",
    gear: "spikeMaul",
    perk: "隧道里的灯亮了：每一层的灯不再坏",
    lore: ["出事那天夜里，最后一班地铁载满了往外逃的人，开到半路停了电，停在隧道里再没开出去。档案馆旧物里“最后一班车”那一组，就是从这趟车上来的。", "现在第 25 层的轨道上，那列车自己在动：车头的大灯还亮着，车厢里挤满的人长成了一体，一节连一节，像一条长虫。"],
    rumor: "电台：下过隧道的人说，二十几层的轨道上有一盏灯在动，铁轨嗡嗡响。",
    tip: "末班车沿着轨道冲过来：远处一盏灯亮起来、铁轨嗡嗡响，就往轨道两边的过道里钻。车停下来先清掉下来的人，再趁停着打车厢，从最后一节打起；电弧的时候离开铁轨。车厢打完它会爬下轨道追你，在房间和过道之间绕着打。",
    intel: "灯一亮就钻进旁边的过道；车停下来打车厢，从最后一节打起；电弧时离开铁轨",
    down: ["车头的大灯闪了两下，灭了。", "隧道里安静下来。远处有一盏日光灯重新亮了。"],
  },
  // ---------- 最后一凶：扑火（农场，从东边林子里来） ----------
  moth: {
    id: "moth",
    type: "t_moth",
    name: "扑火",
    title: "余烬农场 · 最后一夜",
    region: "farm",
    // 从东边的林子里出来（离开农场那条路）；一直往农场中间的篝火挪
    lair: { x: 1470, y: 470 },
    wake: 99999,
    leash: 99999,
    final: true,
    // 打一整夜：七分钟以后才开始疯，疯得轻
    enrage: [{ at: 420, speed: 1.15, cd: 0.85 }],
    open: (e) => !!e.storyDone?.() && TITAN_IDS.filter((id) => id !== "moth" && e.tg?.first?.[id]).length >= FINAL.wins && (e.coreCount?.() || 0) >= FINAL.cores,
    openText: "主线打完、打赢七凶、身上有三颗余烬核以后；那天夜里从农场东边的林子里来",
    // 四盏光加一颗心
    hp: 22800,
    speed: 8,
    r: 120,
    w: 200,
    h: 150,
    phases: [0.5, 0.15],
    poise: 99999,
    parts: {
      body: { type: "t_moth", name: "心", hp: 18000 },
      light: { type: "t_light", name: "光", hp: 1200, r: 34, n: 4 },
    },
    // 四盏光嵌在身上的位置（离身子中间多远）
    lights: [
      { dx: -96, dy: -150 },
      { dx: -34, dy: -232 },
      { dx: 46, dy: -206 },
      { dx: 104, dy: -132 },
    ],
    // 光在的时候它的身子只打得进几成；光挨远程打多几成（远程好使）
    shield: 0.1,
    lightRanged: 1.5,
    // 光一明一暗：亮几秒、暗几秒，暗下去的时候只打得进几成
    pulse: { on: 3, off: 2, dim: 0.2 },
    hand: { r: 120, warn: 1.4, dmg: 60, down: 1.5, cd: 9 },
    fling: { r: 70, warn: 1.0, dmg: 20, n: 2, cd: 10, min: 160, max: 520, cap: 3 },
    // 往前挪：挪到离篝火多远停下（第一、二段；第三段那颗心才往篝火爬）
    standoff: 520,
    // 踩坏设施：身边多近的设施每秒掉多少（只踩外面的：围栏、大门、陷阱、塔、信标、稻草人、水桶、喷灌头、太阳能板、照看机、堆肥桶）
    trample: { r: 150, dps: 40, kinds: ["fence", "gate", "trap", "tower", "lure", "scarecrow", "rain", "irrigation", "solar", "drone", "compost"] },
    // 第二段：塌下来——一道浪从一边卷到另一边（几次、多宽、口子多宽、预兆、挨上多少、卷走多远）；然后露出心
    // 浪从东往西卷过整张图（多快）；口子是横着的一条（离你上下多远以内）
    wave: { n: 3, w: 170, gap: 170, warn: 1.6, dmg: 50, push: 220, every: 2.6, speed: 760, near: 180 },
    // 心：多大、身边一圈烫（多大、每秒多少）；心跳一下荡开一圈火（几秒一下、从多大到多大、挨一下多少）
    // 塌下来的那一堆还在动：心露出来以后隔几秒又卷一道浪、扔几只过来
    heart: { r: 90, aura: 120, dps: 6, beat: { every: 5, warn: 1.0, r0: 110, r1: 260, dmg: 20 }, wave: 18, fling: 13 },
    // 第三段：心剩几成就直奔篝火爬；爬多快、多近算扑到；推开、捕兽夹、钉板拖慢几秒
    crawl: { at: 0.08, speed: 20, reach: 60, slow: 1.6 },
    trophy: "tTrophyMoth",
    gear: null,
    perk: "纪念石旁立起十凶碑，刻下十凶的名号",
    lore: ["余烬核的光也招感染者。七颗余烬核亮在一个农场里，几十里外都看得见。", "林子里那些年被火光吸过去、又被火烧过的东西，一层压一层，压成了一座会走的尸山，循着光一路往这边挪——营地里的人管它叫“扑火的”。"],
    rumor: "电台：东边林子里的鸟都飞光了。有人看见一座会动的山，身上亮着几团火，正往余烬农场这边挪。",
    tip: "扑火的会一直往农场中间的篝火挪：塔、陷阱、守卫都摆在东边；先打它身上的四盏光（远程好使），巨手砸下来之前离开红圈；浪来的时候往口子里跑；最后拦住那颗心，别让它扑到篝火。",
    intel: "先打四盏光；浪来往口子里跑；拦住那颗心，别让它扑到篝火",
    down: ["那颗心在篝火前面一尺的地方停住，慢慢暗了。", "天快亮了。东边的林子里，头一回听见鸟叫。"],
  },
};
export const TITAN_IDS = Object.keys(TITANS);
// 有几只的那几凶：每一只的名字（存档里当天打掉的血按只记：boss、dog、lung0…lung3）、哪一种是“本体”（感染者表里那一凶的名字）
export const partKeys = (id) => {
  const T = TITANS[id];
  if (!T?.parts) return [];
  const out = [];
  for (const [k, P] of Object.entries(T.parts)) {
    const n = P.n || 1;
    if (n === 1) out.push(k);
    else for (let i = 0; i < n; i++) out.push(k + i);
  }
  return out;
};
export const mainPart = (id) => {
  const T = TITANS[id];
  return T?.parts ? Object.keys(T.parts).find((k) => T.parts[k].type === T.type) || null : null;
};
// 每一凶在感染者表里的名字（后五凶有几只：雕爷和看门的、车头和车厢、风机和肺、心和光）
export const TITAN_TYPES = Object.fromEntries(TITAN_IDS.flatMap((id) => [[TITANS[id].type, id], ...Object.values(TITANS[id].parts || {}).map((P) => [P.type, id])]));
// 孢囊（〇号种在地上的）：打得破的“感染者”，不动不咬
export const POD_TYPE = "t_pod";

// 最后一凶：打赢几凶、身上几颗余烬核以后来；早几天说；几点来；没打赢几天后再来、身上的伤留几成；那一夜钟走得慢多少
// 天亮前几点它退回去（这一夜没打完）
export const FINAL = { wins: 7, cores: 3, notice: 3, hour: 22 * 60, warn: 21 * 60, dawn: 5 * 60 + 30, retry: 7, keep: 0.5, clock: 0.5 };
// 烟里打不准：远程打进烟里只打得掉几成
export const SMOKE_CUT = 0.5;

// 感染者表：名字、三段的数（十凶自己的血、速度、伤害都在上面，这里只是让别的地方认得它）
// 有几只的那几凶，各只各有名字（“被看门的打倒”）
const PART_NAMES = { t_dog: "看门的", t_diao: "雕爷", t_lung: "风口的肺", t_car: "末班车的车厢", t_light: "扑火身上的光" };
for (const [type, id] of Object.entries(TITAN_TYPES)) {
  const T = TITANS[id];
  ZOMBIES[type] ??= { name: PART_NAMES[type] || T.name, icon: 58, hp: T.hp, speed: T.speed, damage: 30, xp: type === T.type ? 200 : 40 };
  for (const ph of [0, 1, 2]) ZSTATS[ph][type] ??= { hp: T.hp, speed: T.speed, damage: 30 };
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
  tTrophyDiao: { name: "灰隼团的旗", desc: "烧了一角的旗，上面一只灰隼。灰隼团散了。可以捐给档案馆的十凶柜。" },
  tTrophyTide: { name: "三号泊位的铭牌", desc: "铜铭牌：“沉湾船坞 · 三号泊位”，糊着一层油。可以捐给档案馆的十凶柜。" },
  tTrophyVent: { name: "风机的扇叶", desc: "主风机上掰下来的一片扇叶，边上全是刮痕。可以捐给档案馆的十凶柜。" },
  tTrophyTrain: { name: "末班车的车票", desc: "最后一班车的车票，背面用圆珠笔写着一个名字。可以捐给档案馆的十凶柜。" },
  tTrophyMoth: { name: "最后一盏灯", desc: "扑火的身上最后亮着的那一团火，装在一盏旧马灯里，一直不灭。十凶柜的最后一格。" },
};
for (const [id, t] of Object.entries(TITAN_TROPHIES)) ITEMS[id] ??= { name: t.name, icon: 55, type: "quest", protected: true, desc: t.desc };
export const TITAN_TROPHY_IDS = Object.keys(TITAN_TROPHIES);
// 档案馆第八个展柜：捐满几件给什么
export const TITAN_CASE = {
  name: "十凶柜",
  steps: [
    { n: 3, text: "营地声望 +10" },
    { n: 6, text: "全营士气 +5" },
    { n: 10, text: "十件都捐齐：纪念石旁的十凶碑让全营心情一直 +3" },
  ],
};

// ================= 凶器（只给第一次） =================
// 都不会坏；数比现在最好的同类最多高一成，多的是一样本事
export const TITAN_ARMOR = {
  scrapShoes: { name: "千层底", slot: "feet", armor: 0, bite: 10, weight: 0.3, noise: -2, warmth: 1, dur: 0, mods: 1, crouchSpeed: 1.25, scrap: { cloth: 2 }, look: { boots: "soft" }, where: "打赢收破烂的" },
  zeroSuit: { name: "隔离服", slot: "body", armor: 0.2, scratch: 70, bite: 75, weight: 6, noise: 1, warmth: 1, dur: 0, mods: 2, gas: 0.5, acid: 0, scrap: { cloth: 3, scrap: 2 }, look: { armor: "riot" }, where: "打赢〇号" },
  bearCoat: { name: "熊皮袄", slot: "body", armor: 0.22, scratch: 70, bite: 55, weight: 6, noise: 0, warmth: 4, dur: 0, mods: 2, scrap: { cloth: 4 }, look: { armor: "coat" }, where: "打赢黑瞎子" },
  // v0.37：雕爷的大氅（被抓住的时间短一半）、潜水头盔（毒雾掉一半）、防毒面具（毒雾不掉血、不耽误回体力）
  diaoCoat: { name: "雕爷的大氅", slot: "body", armor: 0.3, scratch: 60, bite: 55, weight: 7, noise: 0, warmth: 2, dur: 0, mods: 2, grabK: 0.5, scrap: { cloth: 4, scrap: 1 }, look: { armor: "coat" }, where: "打赢雕爷和看门的" },
  tideHelm: { name: "潜水头盔", slot: "head", armor: 0.06, bite: 70, weight: 3, noise: 1, warmth: 1, dur: 0, mods: 1, gas: 0.5, scrap: { scrap: 3 }, look: { hat: "riot" }, where: "打赢黑潮" },
  ventMask: { name: "防毒面具", slot: "head", armor: 0, bite: 30, weight: 1, noise: 0, warmth: 0, dur: 0, mods: 1, gas: 0, gasRegen: true, scrap: { cloth: 1, scrap: 1 }, look: { hat: "moto" }, where: "打赢风口" },
};
export const TITAN_MELEE = {
  heboFork: { name: "分水叉", kind: "pole", dmg: 38, cd: 0.6, range: 115, arc: 0.5, knock: 38, pierce: 0.75, stamina: 8, noise: 60, dur: 0, mods: 2, brace: 2, slowHit: { k: 0.5, t: 2 }, scrap: { scrap: 3 }, where: "打赢河伯" },
  frostPick: { name: "冰镐", kind: "blade", dmg: 42, cd: 0.6, range: 66, arc: 0.8, knock: 22, pierce: 0.9, stamina: 9, noise: 80, dur: 0, mods: 2, scrap: { scrap: 3 }, where: "打赢白毛风" },
  // v0.37：道钉锤（打晃头目快一半）
  spikeMaul: { name: "道钉锤", kind: "blunt", dmg: 52, cd: 0.8, range: 72, arc: 0.8, knock: 45, pierce: 0.95, stamina: 11, noise: 130, dur: 0, mods: 2, poiseK: 1.5, scrap: { scrap: 4 }, where: "打赢末班车" },
};
export const TITAN_GEAR_IDS = [...Object.keys(TITAN_MELEE), ...Object.keys(TITAN_ARMOR)];
const GEAR_NOTE = {
  heboFork: "打中的感染者 2 秒走得慢一半",
  frostPick: "正面打重甲也打得进",
  scrapShoes: "蹲着走快两成五",
  zeroSuit: "酸液不掉血，毒雾掉一半",
  bearCoat: "寒潮里穿着不冷",
  diaoCoat: "被抓住的时间短一半",
  tideHelm: "毒雾掉一半",
  ventMask: "毒雾里不掉血、照样回体力",
  spikeMaul: "打大个头攒“晃”快一半",
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
  // v0.37：雕爷的库存（货运站东边的货柜里，只有一回）
  diao: { region: "railDepot", x: 1250, y: 470, name: "雕爷的库存", once: true, pool: [[{ ammo: 30, bolt: 10, parts: 6, bandage: 4, scrap: 12, cloth: 6 }, 1]] },
};
// 风口：避难城的居住舱多几张床
export const VENT_BEDS = 2;
// 收破烂的：每 7 天雨巷三户邻居送一次谢礼
export const SCRAP_GIFT = { every: 7, bundle: { cloth: 3, seedBean: 3, parts: 1 } };
// 〇号：被咬涨的感染乘多少
export const ZERO_BITE = 0.85;
// 白毛风：寒潮里在暖区外多饿的那一截乘多少（四成 → 两成）
export const FROST_COLD = 0.5;

// ================= 传闻卡（每日抉择） =================
const known = (id) => (e) => !!e.titanKnown?.(id);
// 卡的名字用 TN 开头（T01–T07 是扒手那几张）
const NEW_CARDS = {
  TN01: {
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
  TN02: {
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
  TN03: {
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
  TN04: {
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
  TN05: {
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
  // v0.37：后五凶
  TN06: {
    pack: "titan",
    cat: "crisis",
    name: "货场里的铁链声",
    when: known("diao"),
    text: "北线货运站的货场里，夜里能听见铁链拖在地上响。一个从灰隼团跑出来的人说：“那条链子就那么长，雕爷躲在它够得着的地方后面。”",
    opts: [
      { label: "请他吃顿饭，问个明白", cost: { bread: 1 }, fx: [["tIntel", "diao"]], note: "看门的够不着离雕爷太远的地方" },
      { label: "要几支弩箭", cost: { scrap: 3 }, fx: [["give", { bolt: 4 }]] },
      { label: "知道了", fx: [["xp", "exploration", 6]] },
    ],
  },
  TN07: {
    pack: "titan",
    cat: "crisis",
    name: "泊位上的油",
    when: known("tide"),
    text: "沉湾船坞的老船工说，三号泊位那东西身上全是油：“它自己点火的时候不怕，可潜水服一破，它比谁都怕火。”",
    opts: [
      { label: "听老船工说完", cost: { bread: 1 }, fx: [["tIntel", "tide"]], note: "别站在油里；它的潜水服破了以后，引它到油上点火" },
      { label: "备两个燃烧瓶的料", cost: { cloth: 1 }, fx: [["give", { resin: 2 }]] },
      { label: "知道了", fx: [["xp", "exploration", 6]] },
    ],
  },
  TN08: {
    pack: "titan",
    cat: "crisis",
    name: "会喘气的墙",
    when: known("vent"),
    text: "避难城的修理工画了一张草图：主风道那面墙上鼓着四个口袋，一张一缩。“那是它的肺。肺在，风机就打不动。”",
    opts: [
      { label: "照着草图想想", cost: { bread: 1 }, fx: [["tIntel", "vent"]], note: "先在远处打破四个肺" },
      { label: "攒一把石子当弹弓子", fx: [["give", { stone: 8 }]] },
      { label: "知道了", fx: [["xp", "exploration", 6]] },
    ],
  },
  TN09: {
    pack: "titan",
    cat: "crisis",
    name: "隧道里的灯",
    when: known("train"),
    text: "陈工翻出一张旧线路图：第 25 层两边每隔一段就有一条检修过道。“车来的时候，钻过道。车停了，门就开了。”",
    opts: [
      { label: "跟陈工对一遍线路", cost: { bread: 1 }, fx: [["tIntel", "train"]], note: "灯一亮就钻过道；车停了打车厢" },
      { label: "要一卷绷带", cost: { cloth: 2 }, fx: [["give", { bandage: 1 }]] },
      { label: "知道了", fx: [["xp", "exploration", 6]] },
    ],
  },
  TN10: {
    pack: "titan",
    cat: "crisis",
    name: "林子里的火光",
    when: known("moth"),
    text: "东边林子里的鸟都飞光了。秦奶奶说，她年轻时见过山火：“火往哪儿走，那些东西就往哪儿扑。先把它身上的火打灭。”",
    opts: [
      { label: "陪秦奶奶坐一会儿", cost: { bread: 1 }, fx: [["tIntel", "moth"]], note: "先打它身上的四盏光" },
      { label: "多备一捆柴", fx: [["give", { wood: 4 }]] },
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
  // v0.37
  tChain: "铁链在地上拖",
  tShotgun: "霰弹枪上膛",
  tAim: "有人在瞄你",
  tSmoke: "烟雾弹",
  tOil: "油喷过来",
  tSpark: "焊枪在打火",
  tAnchor: "船锚抡过来",
  tSuck: "风道在往里吸",
  tBlow: "风口在吐毒气",
  tHorn: "铁轨在响，车要来了",
  tArc: "铁轨在冒电火花",
  tHand: "头顶有东西砸下来",
  tWave: "尸山塌下来了",
});
Object.assign(FALL_HINTS, {
  t_hebo: "河伯脚下先冒泡才冒出来：站在干地上等它，冒出来时滚开，它搁浅了再打。",
  t_scrap: "收破烂的是瞎的：蹲着走它听不见；扔块石头让它撞墙，晕了再上去。",
  t_zero: "〇号挨什么打多了就对什么长壳：多带两样家伙换着打，孢囊冒头就打破。",
  t_bear: "黑瞎子皮厚：带燃烧瓶和捕兽夹，让它撞树，它晕了、缩成一团、被夹住时再打。",
  t_frost: "白毛风的冰甲要火烤：引它到烧着的铁桶边，白毛风来了守着火。",
  t_pod: "孢囊炸开是一团毒雾：一冒头就打破。",
  t_dog: "看门的够不着离雕爷太远的地方：绕开链子够得着的那一圈，先用弩和枪打雕爷。",
  t_diao: "雕爷的大氅正面挡七成：他举枪瞄你时大氅敞着，趁那一下打；烟里打不准，等烟散了再打。",
  t_tide: "黑潮一擦焊枪，油就全着：别站在油里；它潜水服破了以后，把它引到油上点火。",
  t_vent: "风口吸的时候往外跑，别贴着墙；先在远处把墙上四个肺打破。",
  t_lung: "风口的肺鼓起来就是要吐毒气：先在远处把四个肺打破。",
  t_train: "末班车冲过来之前远处一盏灯先亮：钻进轨道两边的过道；电弧的时候离开铁轨。",
  t_car: "车停下来时打车厢，从最后一节打起；甩尾那一下离车尾远一点。",
  t_moth: "扑火的巨手砸下来之前地上一大圈红：离开红圈；浪来往口子里跑。",
  t_light: "扑火身上的光在的时候它打不动：先用远程把四盏光打灭。",
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
  // v0.37：铁链拖地、霰弹枪、烟雾弹、焊枪打火、风道往里吸、地铁的汽笛和铁轨嗡嗡响、电弧、尸山塌下来
  tChain: { layers: [0, 0.09, 0.2, 0.28, 0.4].map((d, i) => ({ w: "square", d, f: 900 + (i % 3) * 140, t: 0.06, c: 3, bp: [2200, 4], v: 0.35 })).concat([{ w: "noise", t: 0.5, hp: 1800, c: 1.5, v: 0.25 }]), peak: 0.35 },
  tShotgun: { layers: [{ w: "noise", t: 0.35, a: 0.001, c: 2.2, lp: [5000, 400], v: 1 }, { w: "sine", f: [140, 40], t: 0.3, c: 1.8, v: 0.8 }, { w: "brown", t: 0.4, c: 1.6, v: 0.6 }], peak: 0.9, sr: 22050 },
  tSmoke: { layers: [{ w: "noise", t: 1.1, a: 0.05, c: 0.9, hp: [1200, 3000], v: 0.6 }, { w: "noise", t: 0.12, a: 0.001, c: 2.5, lp: 900, v: 0.6 }], peak: 0.45 },
  tSpark: { layers: [{ w: "noise", t: 1.3, a: 0.02, c: 0.8, hp: 3500, v: 0.55, am: [22, 0.6] }, { w: "square", f: [2400, 3200], t: 1.2, c: 1, bp: [3000, 6], v: 0.12 }], peak: 0.45 },
  tSuck: { layers: [{ w: "pink", t: 1.4, a: 0.6, c: 0.7, lp: [400, 2200], v: 1 }, { w: "saw", f: [60, 120], t: 1.4, a: 0.6, c: 0.8, lp: 500, v: 0.4 }], peak: 0.7, sr: 22050 },
  tHorn: { layers: [{ w: "saw", f: 220, t: 1.6, a: 0.08, c: 0.8, lp: 1400, v: 0.55, vib: [5, 0.01] }, { w: "saw", f: 277, t: 1.6, a: 0.08, c: 0.8, lp: 1400, v: 0.45 }, { w: "sine", f: [50, 58], t: 2, a: 0.4, c: 0.8, v: 0.6 }], peak: 0.8, sr: 22050 },
  tArc: { layers: [{ w: "noise", t: 0.9, a: 0.01, c: 1, bp: [2600, 2], v: 0.7, am: [37, 0.9] }, { w: "square", f: 120, t: 0.9, c: 1, lp: 800, v: 0.3, am: [31, 0.8] }], peak: 0.55 },
  tWave: { layers: [{ w: "brown", t: 2.2, a: 0.3, c: 0.8, v: 1 }, { w: "noise", t: 1.8, a: 0.4, c: 0.9, lp: [300, 900], v: 0.6 }, { w: "sine", f: [44, 30], t: 2, c: 0.9, v: 0.6 }], peak: 0.95, sr: 22050 },
});
Object.assign(STINGERS, {
  // 十凶第一次露面：低音拉长、两下鼓；打赢：钟声慢慢升上去
  titan: [[0, "drone", 31, 1], [0, "string", 43, 0.9], [0.4, "tom", 38, 1], [0.8, "tom", 38, 1], [1.2, "string", 44, 0.9], [1.2, "drone", 32, 0.8]],
  titanDown: [[0, "pad", 55, 0.5], [0, "bell", 67, 0.6], [0.25, "bell", 71, 0.6], [0.5, "bell", 74, 0.65], [0.75, "bell", 79, 0.7], [1.1, "flute", 83, 0.5], [1.1, "pad", 62, 0.4]],
  // v0.37：最后一夜打赢——慢慢升上去、停在一个亮的和弦上
  titanEnd: [[0, "pad", 48, 0.55], [0, "string", 55, 0.5], [0.5, "bell", 67, 0.55], [0.9, "bell", 71, 0.55], [1.3, "bell", 74, 0.6], [1.7, "bell", 79, 0.65], [2.1, "flute", 84, 0.55], [2.1, "pad", 60, 0.5], [2.1, "string", 64, 0.45]],
});

// ================= 新开局、旧档的那一张卡片 =================
// “谁的”：名字本来就以“的”结尾（收破烂的）不再多一个“的”
export const tPoss = (name) => (String(name).endsWith("的") ? String(name) : name + "的");
export const TITAN_INTRO = ["十凶：末日以后长成的十个巨物，各守着自己的窝，比大块头大一倍、难打得多。", "每一下都先在地上画出来；打不过可以走，它回窝慢慢回血，第二天回满。", "听说了哪一凶，世界地图上会标出它的窝；成就册里有一页十凶录。"];
// v0.37：上一版的档读进来，说一声后五凶
export const TITAN_INTRO2 = ["后五凶：雕爷和看门的（北线货运站）、黑潮（沉湾船坞）、风口（地底避难城）、末班车（地铁隧道第 25 层）。", "还有最后一凶：打赢七凶、身上有三颗余烬核以后，它会在一个夜里来农场，电台提前三天说。", "打赢最后一凶，纪念石旁立起十凶碑；十凶柜捐满十件，全营心情一直 +3。"];

// ================= 最后一夜（扑火） =================
export const FINAL_TEXT = {
  notice: "电台：东边林子里的鸟都飞光了。有一座会动的山循着余烬核的光往这边挪——三天后（第 {d} 天）夜里 22:00 到余烬农场。",
  morning: "今晚 22:00，扑火的从东边林子里来：塔、陷阱、守卫都摆在东边，仓库里给塔留足子弹，弩和箭备足。今晚没有长夜、没有尸潮。",
  warn: "扑火的一小时后到：22:00 前回农场，到时候不在也会被叫回去。",
  start: "东边林子里的火光过来了——扑火的来了！它会一直往篝火挪：先打它身上的四盏光，别让它扑到篝火。",
  home: "扑火的来了：你赶回了农场。",
  lights: "四盏光全灭了：尸山要塌下来了，浪来的时候往口子里跑！",
  heart: "浪退下去，地上露出一颗烧着的心：打它！",
  crawl: "那颗心往篝火爬过去了：拦住它！推开、捕兽夹、钉板都能拖慢它。",
  lost: "篝火被扑灭了。那颗心缩回林子里——这一夜没守住。没丢东西；{n} 天后（第 {d} 天）它再来，身上的伤还留着一半。",
  fell: "你倒下了，扑火的退回了林子里。{n} 天后（第 {d} 天）它再来，身上的伤还留着一半。",
  dawn: "天快亮了，扑火的缩回了林子里——这一夜没打完。没丢东西；{n} 天后（第 {d} 天）它再来，身上的伤还留着一半。",
  away: "扑火的到了农场边上，没找到篝火边上的人，又缩回了林子里。{n} 天后（第 {d} 天）它再来。",
  busy: "今晚另有一场仗：扑火的往后挪一天（第 {d} 天）。",
  travel: "扑火的就在农场里：走不开。",
  sleep: "扑火的今晚要来：睡不过 22:00。",
};
// 结局卡：打赢扑火的那一下
export const FINAL_END = {
  title: "最后一夜",
  lines: ["篝火还亮着。东边的林子里，头一回听见鸟叫。", "十凶的名号刻在纪念石旁边的碑上：河伯、收破烂的、〇号、黑瞎子、白毛风、雕爷和看门的、黑潮、风口、末班车、扑火。", "余烬地区的夜，从今往后，只是夜。"],
};
