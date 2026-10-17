// v0.22.0「披挂」验收模拟：用正式代码（不改任何规则）跑一趟出门搜刮，看死亡率、战斗时长、被抓被咬。
// 机器人：搜三处、回出口；看到预兆（蹲身、跺脚、张嘴、抬手）有 0.12–0.5 秒反应时间，周围越挤越容易漏看；
// 被抓先推开、推不动就连按；流血或血少用绷带；没绷带又血少就往出口撤。
// 用法：node scripts/gear-sim.mjs 次数 天数 地图[,地图] 打法[,打法]
//   打法：none 空手布鞋；club 木棍+破布护手；right 木矛（医院、仓库再加一套旧装备）；old 木矛+旧装备；mid 铁头矛+中期装备；late 铁头矛+后期装备；lateBlade 砍刀+后期装备
//   例：node scripts/gear-sim.mjs 100 1 residential,hospital none,club,right
// 对照实验：RULESPATCH='{"noise":{"step":0}}'、DURPATCH='{"spear":999}'、SKILL=0.7（看到预兆的几率）
// v0.23 翻滚：ROLL=telegraph（看到扑人、冲撞、出手的预兆就滚）、ROLL=crowd（另外被三只以上围住也往人少的方向滚）；不设就不滚
// v0.23 开始，引擎里有命中停顿：停顿时世界不动，机器人的时间照走（和真人看到的一样）
// v0.24：看到要炸的膨胀者、毒雾、酸液落点和酸液一滩，也有同样的反应时间，然后往外走（ROLL 设了就滚出去）；
//   地上装死的认不出来（和真人第一次一样），被抓住照常推开、挣开
// v0.24 机器人照着游戏里的提示打（都可以关掉，看不照做时差多少）：
//   FLANK=0 关掉“仓库守卫甲还在时先绕到背后、它出手时退开”；SMART=0 关掉“吐酸者仰头时扔石头打断、身边没别的就先打它”；
//   FEEL=0 关掉“站在毒雾、酸液里会察觉（九成，0.3–0.8 秒），往走得通的方向走开（不往墙上撞）”
// 调数用：NOSWAP=bloater,faker,spitter（不放这几种）、UPATCH='{"spitter":{"cd":8}}'、UPLACE='{"spitter":{"warehouse":1}}'
// 查个别的：SEEDS=1 列出死掉的那几趟、OFF=种子偏移、TRACE=1 每秒打一行
// v0.25 长夜：地图写 longnight（例：node scripts/gear-sim.mjs 100 38 longnight late,mid）——主线打完、第 38 天 21:59 站在农场中间，
//   一个人守（不算居民、瞭望塔、陷阱），守到 04:00 天亮或三波打完算守住；LNHELD=4 表示之前守住过几个（下一个按这个变大）
// v0.26 守夜台：LNSET=bench,guards,towers,towers4,traps,traps8,fences,lure,lureIdle,repair,fix 自由组合（长夜和 horde 尸潮都认）：
//   guards 三个居民吃饱了排守卫岗；towers 两座塔，towers4 四座；traps 四个陷阱，traps8 八个；fences 四面各一道半截墙；
//   lure 东边一个信标、旁边四个陷阱，打着的时候机器人去拉响（v0.26 起信标要拉响才引怪），lureIdle 同样摆着但不拉；
//   repair 维修点；fix 两波之间机器人把破了的陷阱、塔、围栏、信标修好（照正常维修花木材和废金属，一个空档最多修 4 处；不算走过去的路）；
//   BELL=1 两波之间能敲警钟就敲；BELL=boss 只在第三波打完时敲，把头目叫来；BELL=late 第二波打完叫第三波、第三波打完叫头目（留出时间打头目）。
//   结果多几列：陷阱、瞭望塔、你各打倒几只（killTrap、killTower、killPlayer），设施掉了多少耐久、用了几发弹药几块木头。
// v0.25 出身：ORIGIN=medic 打法写 start（例：ORIGIN=hunter node scripts/gear-sim.mjs 100 1 residential,hospital,warehouse start）——
//   开局那一套：大家都用开局的木材做一根矛（退伍兵也是，WEAPON=pipe 让他拿自己的铁管）；身上穿出身给的，出身的规则照算；绷带用完会用药包
// v0.30 搭伙：PARTNER=medic（长夜里守在你身边的那个人），RECRUIT=medic（对照：营地里有这个人，但没搭伙）
// v0.31 地铁隧道：地图写 tunnel（例：TFLOOR=11 TSPAN=5 node scripts/gear-sim.mjs 200 40 tunnel mid,late）——从第 TFLOOR 层下去，
//   每层先去开一个柜子，再找往下的检修梯，一趟下 TSPAN 层（默认 5）；倒下算这一趟没过；结果多两列：每层几秒（floorSec）、下到第几层（floors）。
//   TLIGHT=flashlight 身上带手电（默认带），TLIGHT=none 不带；第 30 层走到泵房里的光跟前算到底；TUNE 调一层几只、多厚、多疼（见下）
//   CORES=3：身上已经有几颗余烬核（长夜、尸潮、出门都认，看余烬核让夜里容易了多少）
// v0.34 成长：六样近战各有打法（TACTIC=0 关掉，回到照着矛写的老打法）——
//   打法多七套：lateBat 钉子球棒、lateCrowbar 回收撬棍、lateSledge 大锤、lateAxe 消防斧（都配后期装备），midBlade 砍刀、midSledge 大锤、midAxe 消防斧（配中期装备）；
//   能打断出手的（矛、大锤、消防斧、撬棍）看见它抬手、够得着就先砍下去；砍刀对着蹲下要扑的奔跑者，等它扑过来迎面砍腿；
//   破甲不到六成的（砍刀、木矛）打没劈开的重甲先绕到背后；大锤正面砸仓库守卫的甲片（不绕背）；
//   钉子球棒打出血以后边退边打（流血的走不动）。调数：WPATCH='{"axe":{"knock":30}}'（武器的数）、WFX='{"machete":{"trip":0.7}}'（擅长的场合）；
//   MASTERY=10：五项技能的经验都给到 10 级（看老手的小本事有没有让夜里变容易）
// v0.35 夜相：LNPHASE=all（默认：按种子轮流八个夜相，平均下来就是“一年两年里的长夜”）、LNPHASE=none（没有夜相，和 v0.34 一样）、
//   LNPHASE=fog|thunder|moon|swelter|migrate|gale|frost|snow（只打这一种）；雾夜里离你一百七十以外的预兆，机器人看见的几率减半（和画面上的雾一样）
// v0.28 改良：HNUP=tower:light,trap:spike,fence:iron（每类选一条路线，LNSET 摆出来的这类设施全部改好；双人哨要守卫比塔多）
//   对照：HNPATCH='{"INJURY":{"chance":0}}'（守塔的人被摸到不受伤）
const D = new URL("../dist/", import.meta.url).href;
const { Engine, freshState } = await import(D + "campaign.js");
const { REGIONS, BUILDINGS: BUILD } = await import(D + "data.js");
const { RULES, MELEE, ARMOR } = await import(D + "gear-data.js");
// v0.34：武器的数、擅长的场合（调数用）
const GD = await import(D + "grow-data.js").catch(() => ({}));
const WEAPON_FX = GD.WEAPON_FX || {};
if (process.env.WPATCH) for (const [k, v] of Object.entries(JSON.parse(process.env.WPATCH))) Object.assign(MELEE[k], v);
if (process.env.WFX) for (const [k, v] of Object.entries(JSON.parse(process.env.WFX))) Object.assign((WEAPON_FX[k] ??= {}), v);
const TACTIC = process.env.TACTIC !== "0";
// v0.24：NOSWAP=bloater,faker,spitter 不放这几种（看各自让一趟难了多少）
const U = await import(D + "undertow-data.js");
const HNU = await import(D + "bustle-data.js");
if (process.env.HNPATCH) for (const [k, v] of Object.entries(JSON.parse(process.env.HNPATCH))) Object.assign(HNU[k], v);
if (process.env.NOSWAP) for (const t of process.env.NOSWAP.split(",")) U.PLACE[t].phase = 99;
// 调数用：UPATCH='{"spitter":{"cd":8}}'、UPLACE='{"spitter":{"warehouse":1}}'
if (process.env.UPATCH) for (const [k, v] of Object.entries(JSON.parse(process.env.UPATCH))) Object.assign(U.NEW_RULES[k], v);
if (process.env.UPLACE) for (const [k, v] of Object.entries(JSON.parse(process.env.UPLACE))) Object.assign(U.PLACE[k], v);
// UBOSS='{"guard":{"charge":{"damage":24}}}'：头目的数（第二层合并）
if (process.env.UBOSS)
  for (const [k, v] of Object.entries(JSON.parse(process.env.UBOSS)))
    for (const [kk, vv] of Object.entries(v)) U.BOSSES[k][kk] = vv && typeof vv === "object" ? { ...U.BOSSES[k][kk], ...vv } : vv;
// v0.25 长夜调数：LNPATCH='{"base":[8,10,12],"bossHp":0.8}'、LNMIX='[{"slow":6,"runner":4}, …]'
const LND = await import(D + "longnight-data.js");
// v0.26 调数：TDPATCH='{"TRAP_ALL":{"mult":1.25}}'
const TDD = await import(D + "tidy-data.js");
// v0.35 夜相（没有这一层的旧版本照常跑）
const NFD = await import(D + "nightfall-data.js").catch(() => null);
const LNPHASE = process.env.LNPHASE || "all";
// 调数：NFPATCH='{"fog":{"towerRange":220}}'（夜相的数，合并进 fx）
if (NFD && process.env.NFPATCH) for (const [k, v] of Object.entries(JSON.parse(process.env.NFPATCH))) Object.assign(NFD.PHASES[k].fx, v);
if (process.env.TDPATCH) for (const [k, v] of Object.entries(JSON.parse(process.env.TDPATCH))) Object.assign(TDD[k], v);
if (process.env.LNPATCH) Object.assign(LND.LN, JSON.parse(process.env.LNPATCH));
if (process.env.LNMIX) JSON.parse(process.env.LNMIX).forEach((m, i) => (LND.WAVE_MIX[i] = m));
// 出身调数：ORULES='{"grab":0.9}' 改这个出身的规则（null 表示去掉这一条）
if (process.env.ORIGIN && process.env.ORULES) {
  const R = LND.ORIGINS[process.env.ORIGIN].rules || (LND.ORIGINS[process.env.ORIGIN].rules = {});
  for (const [k, v] of Object.entries(JSON.parse(process.env.ORULES))) {
    if (v === null) delete R[k];
    else R[k] = v;
  }
}
// v0.31 隧道调数：TUNE='{"base":5,"step":5,"cap":9,"hpk":0.02,"hitk":0.01}'，TMIX='[{"upto":4,"slow":5,"runner":5}, …]'（四段都要写）
const TG = await import(D + "tunnel-gen.js");
const { CORE_IDS } = await import(D + "relight-data.js").catch(() => ({ CORE_IDS: [] }));
if (process.env.TUNE) Object.assign(TG.FOE_TUNE, JSON.parse(process.env.TUNE));
if (process.env.TMIX) TG.FOE_TUNE.mix = JSON.parse(process.env.TMIX);
if (process.env.DURPATCH) for (const [k, v] of Object.entries(JSON.parse(process.env.DURPATCH))) (MELEE[k] || ARMOR[k]).dur = v;
// 对照实验：RULESPATCH='{"noise":{"step":0}}' 之类
if (process.env.RULESPATCH) for (const [k, v] of Object.entries(JSON.parse(process.env.RULESPATCH))) Object.assign(RULES[k], v);
const N = Number(process.argv[2] || 20);
const DAY = Number(process.argv[3] || 1);
const REGION_LIST = (process.argv[4] || "residential,hospital").split(",");
const KITS = (process.argv[5] || "none,club,right").split(",");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const DT = 0.05;
const SKILL = Number(process.env.SKILL || 0.85);
const ROLL = process.env.ROLL || "";
// v0.24：仓库守卫甲还在时，先绕到背后再打（血条上写着“正面有甲 · 绕到背后”）；FLANK=0 关掉，看正面硬打的样子
const FLANK = process.env.FLANK !== "0";
// v0.24：照着提示打吐酸者（它仰头时扔石头打断、身边没别的就先去打它）；SMART=0 关掉
const SMART = process.env.SMART !== "0";
// v0.24：站在毒雾、酸液里会察觉（九成，0.3–0.8 秒）；FEEL=0 关掉
const FEEL = process.env.FEEL !== "0";
const LOOT = { residential: [[408, 454], [680, 760], [1180, 480]], hospital: [[825, 332], [1260, 460], [500, 750]], warehouse: [[435, 454], [725, 770], [1390, 560]] };
const SETS = {
  none: { feet: "clothShoes" },
  rags: { hands: "ragGloves", feet: "clothShoes" },
  hosp: { head: "motoHelmet", body: "tireArmor", hands: "leatherBracers", legs: "jeans", feet: "clothShoes" },
  mid: { head: "motoHelmet", body: "tireArmor", hands: "leatherBracers", legs: "kneePads", feet: "workBoots" },
  // 第 8 天以后：图纸、宝贝和袭击掉落的东西，重量刚好压在“中”档
  late: { head: "riotHelmet", body: "riotSuit", hands: "steelBracers", legs: "jeans", feet: "workBoots" },
};
// v0.25 出身：开局那一套
const ORIGIN = process.env.ORIGIN || "";
// 第一天大家都会用开局的木材做一根矛（和 v0.24 验收里“带对装备”一样），退伍兵也是（WEAPON=pipe 让他拿自己的铁管）
const START = {
  farmer: { weapon: "spear", set: { hands: "ragGloves", feet: "clothShoes" } },
  medic: { weapon: "spear", set: { hands: "leatherBracers", feet: "clothShoes" }, extra: { medkit: 1 } },
  hunter: { weapon: "spear", set: { hands: "ragGloves", feet: "softShoes" }, stones: 15 },
  mechanic: { weapon: "spear", set: { head: "headlamp", hands: "ragGloves", feet: "clothShoes" } },
  veteran: { weapon: process.env.WEAPON || "spear", set: { hands: "ragGloves", feet: "clothShoes" } },
};
// 对照实验：STARTSET='{"body":"leatherJacket"}' 换开局身上穿的（null 表示不穿），EXTRA='{"medkit":2}' 换多带的
if (ORIGIN && process.env.STARTSET) START[ORIGIN].set = Object.fromEntries(Object.entries({ ...START[ORIGIN].set, ...JSON.parse(process.env.STARTSET) }).filter(([, v]) => v));
if (ORIGIN && process.env.EXTRA) START[ORIGIN].extra = JSON.parse(process.env.EXTRA);
if (ORIGIN) SETS.start = START[ORIGIN].set;
const KIT = {
  start: ORIGIN ? { weapon: START[ORIGIN].weapon, set: "start", bandage: 2, stones: START[ORIGIN].stones || 5, extra: START[ORIGIN].extra } : null,
  none: { weapon: null, set: "none", bandage: 2, stones: 5 },
  club: { weapon: "club", set: "rags", bandage: 2, stones: 5 },
  right: { weapon: "spear", set: "rags", setHosp: "hosp", bandage: 2, bandageHosp: 3, stones: 5, stonesHosp: 6 },
  old: { weapon: "spear", set: "hosp", bandage: 3, stones: 6 },
  mid: { weapon: "ironspear", set: "mid", bandage: 3, stones: 6 },
  // 第 8 天以后：铁头矛 + 后期防具；lateBlade 换成砍刀（利器打重甲正面只剩三成五）
  late: { weapon: "ironspear", set: "late", bandage: 4, stones: 6 },
  lateBlade: { weapon: "machete", set: "late", bandage: 4, stones: 6 },
  // v0.34：六样近战各一套（同一身后期防具），看每样武器在哪片废墟最好用
  lateBat: { weapon: "bat", set: "late", bandage: 4, stones: 6 },
  lateCrowbar: { weapon: "crowbar", set: "late", bandage: 4, stones: 6 },
  lateSledge: { weapon: "sledge", set: "late", bandage: 4, stones: 6 },
  lateAxe: { weapon: "axe", set: "late", bandage: 4, stones: 6 },
  // 长夜的打法挑战“砍刀守夜”：中期防具 + 砍刀（对照 mid 的铁头矛）
  midBlade: { weapon: "machete", set: "mid", bandage: 3, stones: 6 },
  // 中期防具下再比一次：仓库里大锤对消防斧（后期防具下倒下率打平）
  midSledge: { weapon: "sledge", set: "mid", bandage: 3, stones: 6 },
  midAxe: { weapon: "axe", set: "mid", bandage: 3, stones: 6 },
};
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function placeDefenses(e, s) {
  // LNPREP=1 等于 bench,guards,towers,traps（v0.25 的“备过战的农场”）
  const SET = new Set((process.env.LNSET || (process.env.LNPREP === "1" ? "bench,guards,towers,traps" : "")).split(",").filter(Boolean));
  const B = (type, x, y, rot = 0) => s.buildings.push({ id: "sim-" + type + "-" + s.buildings.length, type, x, y, rotation: rot, hp: BUILD[type].hp });
  if (SET.has("guards")) {
    for (const id of ["farmer", "medic", "mechanic"]) e.recruit(id);
    e.residentsCapacity = () => 5;
    for (const r of e.c.residents) {
      r.fed = true;
      r.priorities.guard = 1;
    }
  }
  if (SET.has("towers")) for (const [x, y] of [[640, 600], [1040, 600]]) B("tower", x, y);
  if (SET.has("towers4")) for (const [x, y] of [[640, 600], [1040, 600], [640, 360], [1040, 360]]) B("tower", x, y);
  if (SET.has("traps")) for (const [x, y] of [[700, 420], [960, 420], [700, 700], [960, 700]]) B("trap", x, y);
  if (SET.has("traps8")) for (const [x, y] of [[700, 420], [960, 420], [700, 700], [960, 700], [1180, 430], [1180, 560], [820, 820], [480, 520]]) B("trap", x, y);
  if (SET.has("fences")) {
    // 四个方向各一道 5 段的半截墙（中间不封死，留绕行的路），离农场中间 300 左右
    for (let i = 0; i < 5; i++) B("fence", 1150, 380 + i * 72, 1);
    for (let i = 0; i < 5; i++) B("fence", 650 + i * 72, 860);
    for (let i = 0; i < 5; i++) B("fence", 300, 380 + i * 72, 1);
    for (let i = 0; i < 5; i++) B("fence", 800 + i * 72, 200);
  }
  if (SET.has("lure") || SET.has("lureIdle")) {
    B("lure", 1180, 495);
    for (const [x, y] of [[1150, 470], [1150, 520], [1210, 470], [1210, 520]]) B("trap", x, y);
    e.c.energy = 100;
    s.storage.parts = (s.storage.parts || 0) + 20;
  }
  if (SET.has("repair")) B("repairpost", 830, 560);
  if (SET.size) {
    s.storage.ammo = 80;
    s.storage.wood = 40;
    if (SET.has("bench")) {
      s.buildings.push({ id: "sim-bench", type: "weaponbench", x: 760, y: 300, rotation: 0, hp: 200 });
      s.storage.scrap = 20;
    }
    if (SET.has("fix")) s.storage.scrap = (s.storage.scrap || 0) + 20;
    e.navRevision = (e.navRevision || 0) + 1;
  }
  return SET;
}

function applyUpgrades(e, s) {
  if (!process.env.HNUP || !e.hn) return;
  for (const pair of process.env.HNUP.split(",")) {
    const [cls, path] = pair.split(":");
    if (!HNU.UPGRADES[cls]?.paths[path]) throw new Error("HNUP: no such upgrade " + pair);
    e.hn.up[cls] = path;
    for (const b of s.buildings) if (HNU.upClassOf(b.type) === cls) b.hnUp = path;
  }
  // 双人哨：18:00 的晚饭已经给多出来的守卫留了干粮（模拟从 21:59 开始，晚饭在前面）
  for (const b of s.buildings) if (b.hnUp === "twin") b.hnFed = e.absNow() + 1440;
}

function trial(region, kitId, seed) {
  Math.random = seeded(seed * 7919 + 13);
  const R = seeded(seed * 104729 + 7);
  const kit = KIT[kitId],
    set = SETS[region !== "residential" && kit.setHosp ? kit.setHosp : kit.set];
  const e = new Engine(freshState(), () => {});
  if (ORIGIN && e.s.longnight) e.s.longnight.origin = ORIGIN;
  if (NFD && e.nf) e._nfForce = LNPHASE === "all" ? NFD.PHASE_IDS[(seed - 1) % NFD.PHASE_IDS.length] : LNPHASE;
  const TUNNELMODE = region === "tunnel",
    TFLOOR = Number(process.env.TFLOOR || 1),
    TSPAN = Number(process.env.TSPAN || 5);
  const LNMODE = region === "longnight",
    HORDEMODE = region === "horde";
  // v0.31 余烬核：CORES=3 身上已经有几颗（每颗生命上限 +5、体力上限 +15），一开始是满的
  if (process.env.CORES && e.rl) e.rl.cores = CORE_IDS.slice(0, Number(process.env.CORES));
  // v0.34：MASTERY=10 五项技能都到 10 级（老手的小本事全开）；MASTERY=5 都到 5 级
  if (process.env.MASTERY && GD.MASTER_XP) {
    const L = Number(process.env.MASTERY);
    for (const [k, t] of Object.entries(GD.MASTER_XP)) {
      const x = L >= 6 ? t[Math.min(4, L - 6)] : (L - 1) * (k === "thief" ? 60 : 40);
      if (k === "thief") e.sk && (e.sk.thiefXp = x);
      else e.s.xp[k] = x;
    }
    if (e.gw) e.gw.lv = Object.fromEntries(Object.keys(GD.MASTER_XP).map((k) => [k, e.masterLv(k)]));
  }
  const HP0 = e.maxHp?.() || 100,
    STA0 = e.maxSta?.() || 100;
  if (LNMODE || HORDEMODE) region = "farm";
  let died = false,
    SET = new Set();
  const emit = e.emit.bind(e);
  e.emit = (name, data) => {
    if (name === "menu" && data?.menu === "death") died = true;
    return emit(name, data);
  };
  const s = e.s,
    g = e.gr;
  s.day = DAY;
  s.minute = 600;
  if (LNMODE) {
    // 主线打完（第 30 天）；这一天是长夜，21:59
    e.sc.act = 9;
    e.sc.claimed = ["act1", "supply", "act2", "act3", "act4", "act5", "act6", "act7", "act8"];
    e.ln.storyDay = 30;
    e.ln.held = e.ln.tried = Number(process.env.LNHELD || 0);
    s.stats.hordes = 6;
    s.horde = { phase: "won", timer: 0, remaining: 0, spawnTimer: 0, direction: 0 };
    e.c.nextHordeDay = DAY + 30;
    if (e.dy) e.dy.pending = null;
    s.minute = 1319.9;
    SET = placeDefenses(e, s);
    applyUpgrades(e, s);
    // v0.30 搭伙：PARTNER=medic 长夜里那个人守在你身边；RECRUIT=medic 只是营地里有这个人（对照）
    for (const id of [process.env.PARTNER, process.env.RECRUIT].filter(Boolean)) if (!e.resident(id) && ["farmer", "medic", "mechanic"].includes(id)) e.recruit(id);
    if (process.env.PARTNER && e.kin) e.kin.partner = { id: process.env.PARTNER, stage: "home", day: DAY - 5, hurt: 0 };
  }
  if (HORDEMODE) {
    SET = placeDefenses(e, s);
    applyUpgrades(e, s);
    // 对照：普通尸潮（第 8 轮以后 24 只），同样一个人守在农场中间
    s.stats.hordes = Number(process.env.HORDES || 8);
    s.horde = { phase: "warning", timer: 0.1, remaining: 24, spawnTimer: 0, direction: 0 };
    s.minute = 1200;
  }
  // 装备
  for (const k of ["head", "body", "hands", "legs", "feet", "melee", "ranged"]) g.slots[k] = null;
  delete s.inventory.club;
  delete s.inventory.ragGloves;
  for (const [slot, id] of Object.entries(set)) {
    s.inventory[id] = 1;
    g.slots[slot] = id;
  }
  if (kit.weapon) {
    s.inventory[kit.weapon] = 1;
    g.slots.melee = kit.weapon;
  }
  // 对照实验：STARTCOND='{"leatherJacket":0.3}' 开局那件只剩几成耐久
  if (process.env.STARTCOND)
    for (const [id, f] of Object.entries(JSON.parse(process.env.STARTCOND))) {
      const c = e.cond(id);
      if (c) c.d = Math.round(c.m * f);
    }
  s.inventory.bandage = region !== "residential" && kit.bandageHosp ? kit.bandageHosp : kit.bandage;
  for (const [id, n] of Object.entries(kit.extra || {})) s.inventory[id] = (s.inventory[id] || 0) + n;
  if ((LNMODE || HORDEMODE) && SET.size) s.inventory.bandage = 8;
  s.inventory.stone = region !== "residential" && kit.stonesHosp ? kit.stonesHosp : kit.stones;
  g.slots.throw = "stone";
  s.slot = 3;
  let tunnelFloors = 0,
    tunnelT0 = 0;
  const floorTimes = [];
  if (TUNNELMODE) {
    // 主线打完、地底避难城开了、升降井修好了，从检修平台下到第 1 层，再直接换成第 TFLOOR 层
    e.sc.act = 9;
    e.sc.claimed = ["act1", "supply", "act2", "act3", "act4", "act5", "act6", "act7", "act8"];
    e.sc.letters = ["act1", "act2", "act3", "act4", "act5", "act6", "act7", "act8", "act9"];
    e.b.unlocked.shelter = true;
    e.b.points.shelter_lift = e.bpoint("shelter_lift");
    e.b.points.shelter_lift.flags.repair = true;
    s.region = "shelter";
    e.assignRegion();
    Object.assign(s.player, { x: 1240, y: 880, hp: HP0, stamina: STA0, hunger: 90 });
    if (process.env.TLIGHT !== "none") s.inventory.flashlight = 1;
    if (!e.tunnelEnter(1)) throw new Error("tunnel: cannot enter");
    e.rl.tunnel.key = { floor: TFLOOR, day: s.day, luck: false };
    e.rl.tunnel.floor = TFLOOR;
    s.enemies.tunnel = null;
    e.assignRegion();
    e.tunnelArrive();
    Object.assign(s.player, { hp: HP0, stamina: STA0, hunger: 90 });
  } else {
    s.region = region;
    const sp = REGIONS[region].spawn;
    Object.assign(s.player, { x: sp.x, y: sp.y, hp: HP0, stamina: STA0, hunger: 90 });
    s.enemies[region] = null;
    e.assignRegion();
  }
  e.paused = false;
  const p = s.player,
    gx = e.gx;
  // 守夜台：谁打倒的（陷阱、瞭望塔、你），设施掉了多少耐久
  const killBy = { trap: 0, tower: 0, weapon: 0 };
  let barbDmg = 0;
  {
    const realHurt = e.hurtEnemy.bind(e);
    e.hurtEnemy = (z, n, a, meta) => {
      const live = !z.dead,
        src = e._damageSource || "weapon";
      if (meta?.barb && live) barbDmg += n;
      const out = realHurt(z, n, a, meta);
      if (live && z.dead && z.horde) killBy[src in killBy ? src : "weapon"]++;
      return out;
    };
  }
  const bhp = () => s.buildings.filter((b) => b.type !== "weaponbench").reduce((a, b) => a + b.hp, 0),
    fhp = () => s.buildings.filter((b) => ["fence", "gate"].includes(b.type)).reduce((a, b) => a + b.hp, 0),
    hpStart = bhp(),
    fenceStart = fhp(),
    ammo0 = s.storage.ammo || 0,
    wood0 = s.storage.wood || 0;
  let pulls = 0,
    bells = 0,
    kitsUsed = 0,
    gapSeen = 0;
  const stats = { rolls0: e.feel?.stats.rolls || 0, broken0: g.stats.broken, bites0: g.stats.bites, grabs0: g.stats.grabs, lunges0: g.stats.lunges, counters0: g.stats.counters, interrupts0: g.stats.interrupts, summons0: g.stats.summons, bandages: 0, cause: null };
  // 记下最后一下是谁打的（死因）
  const envBy = { acid: 0, gas: 0 };
  if (e.envHurt) {
    const realEnv = e.envHurt.bind(e);
    e.envHurt = (n, by) => {
      if (n > 0 && !e.paused) envBy[by] = (envBy[by] || 0) + Math.min(n, s.player.hp);
      return realEnv(n, by);
    };
  }
  const realDamage = e.damagePlayer.bind(e);
  e.damagePlayer = (n, opts = {}) => {
    const z = opts.from || e._zAtk;
    stats.cause = opts.eff === RULES.grab.bite || opts.eff === RULES.crawl.bite ? "bite" : opts.down ? (z?.type === "armor" ? "charge" : "lunge") : z ? "hit:" + z.type : e.fx?.lastHitBy || "other";
    return realDamage(n, opts);
  };
  // 长夜：一直守在农场中间（不出门、不去出口）
  // 隧道：不知道检修梯在哪，一间间房找（先去最近的），看见了（灯照得到、中间没挡着）就过去；路过的柜子顺手开
  const seeR = () => (s.inventory.flashlight || e.armorTotals?.().light ? 230 : 110);
  let ladderSeen = false;
  // 这一层要去的地方：检修梯；最后一层是泵房里的光
  const tunnelTarget = () => {
    const L = e.tunnelLayoutNow();
    if (!L) return null;
    if (L.ladders[0]) return { x: L.ladders[0].x, y: L.ladders[0].y, exit: true, ladder: true };
    return L.core ? { x: L.core.x, y: L.core.y, exit: true, ladder: true, core: true } : null;
  };
  const tunnelGoals = () => {
    const L = e.tunnelLayoutNow(),
      lad = tunnelTarget();
    ladderSeen = false;
    const rooms = L.rooms.map((q) => ({ x: (q.c0 + q.w / 2) * 64, y: (q.r0 + q.h / 2) * 64 })).filter((q) => !e.blocked(q.x, q.y, false, 12));
    const order = [];
    let at = { x: s.player.x, y: s.player.y };
    while (rooms.length) {
      rooms.sort((a, b) => dist(a, at) - dist(b, at));
      at = rooms.shift();
      order.push(at);
    }
    return [...order, lad];
  };
  let goals = TUNNELMODE ? tunnelGoals() : LNMODE || HORDEMODE ? [{ x: 830, y: 480, hold: true }] : [...LOOT[region].map(([x, y]) => ({ x, y })), { ...REGIONS[region].exit, exit: true }];
  let lnStarted = false,
    lnWaveSeen = 0,
    lnBossSeen = false;
  let gi = 0,
    waitAt = 0,
    t = 0,
    path = [],
    pathFor = null,
    pathTimer = 0,
    fleeing = false,
    segStart = -1,
    lastCombat = -10,
    dmg = 0,
    lastHp = HP0,
    kills0 = s.stats.kills,
    stuckT = 0,
    lastPos = { x: p.x, y: p.y },
    grabSeen = null,
    grabOk = true,
    mashClock = 0,
    act = 0,
    bracing = null,
    circleT = 0;
  const segs = [];
  const notice = (z, key, crowd) => {
    if (z["_" + key] == null) {
      z["_" + key] = t;
      z["_r" + key] = 0.12 + R() * 0.38;
      // v0.35 雾夜：雾里（离你 clear 以外）的预兆看见的几率减半
      const fogC = e.nfFx?.()?.clear || 0,
        far = fogC && Number.isFinite(z.x) && Math.hypot(z.x - p.x, z.y - p.y) > fogC;
      z["_n" + key] = R() < Math.max(0.35, SKILL - 0.12 * (crowd - 1)) * (far ? 0.5 : 1);
    }
    return z["_n" + key] && t - z["_" + key] >= z["_r" + key];
  };
  const forget = (z, key) => {
    z["_" + key] = null;
  };
  const W = kit.weapon ? e.meleeStats(kit.weapon) : null;
  // v0.34：这把武器擅长什么、能不能打断出手（抬手时先砍下去）
  const WF = (kit.weapon && WEAPON_FX[kit.weapon]) || {},
    cutsWind = !!W && (W.knock >= RULES.knockInterrupt || !!WF.interrupt);
  const inFront = (z) => {
    const a = Math.atan2(p.y - z.y, p.x - z.x) - (z.facing ?? 0);
    return Math.abs(Math.atan2(Math.sin(a), Math.cos(a))) < 1.1;
  };
  // 翻滚：往某个方向滚一下（滚不了就返回 false，照原来的办法躲）
  const roll = (a) => (ROLL && e.dodge && !e.dodgeReason() ? e.dodge({ x: Math.cos(a), y: Math.sin(a) }) : false);
  while (t < (LNMODE || HORDEMODE ? 900 : TUNNELMODE ? 300 * TSPAN : 420) && !died) {
    if (s.region !== region) break;
    if (LNMODE) {
      if (e.ln.night) lnStarted = true;
      else if (lnStarted) break;
      if (process.env.LNTRACE && e.ln.night && (e.ln.night.wave !== lnWaveSeen || (e.ln.night.boss === 1 && !lnBossSeen))) {
        if (e.ln.night.boss === 1) lnBossSeen = true;
        console.error("seed", seed, "t", Math.round(t), "wave", e.ln.night.wave, e.ln.night.boss === 1 ? "BOSS" : "", "hp", Math.round(p.hp), "band", s.inventory.bandage || 0, "alive", e.hordeAlive().length, "kills", e.ln.night.kills, "weapon", kit.weapon ? e.cond(kit.weapon).d : 0);
      }
      if (SET.has("bench") && e.ln.night && e.ln.night.wave !== lnWaveSeen) {
        lnWaveSeen = e.ln.night.wave;
        if (lnWaveSeen > 1) for (const id of [kit.weapon, ...Object.values(set)]) if (id && e.repairReason?.(id) === "") e.repairGear(id);
      }
    }
    if (HORDEMODE) {
      if (s.horde.phase === "active") lnStarted = true;
      else if (lnStarted) break;
    }
    // v0.26：信标要拉响才引怪——摆了信标（LNSET 里写 lure）就在打着的时候去拉
    if (SET.has("lure") && e.pullLure && !e.pulledLure() && e.hordeAlive().length > 0) {
      const b = s.buildings.find((x) => x.type === "lure" && x.hp > 0);
      if (b && !e.pullLureReason(b.id) && e.pullLure(b.id)) pulls++;
    }
    // 两波之间：把破了的防御设施修好（LNSET 里写 fix；一个空档最多 4 处，机器人不走过去，直接修），能敲钟就敲（BELL=1）
    if (LNMODE && e.ln.night && e.lnBetween?.()) {
      if (SET.has("fix") && gapSeen !== e.ln.night.wave) {
        gapSeen = e.ln.night.wave;
        const broken = s.buildings.filter((x) => ["fence", "gate", "trap", "tower", "lure", "repairpost"].includes(x.type) && x.hp < BUILD[x.type].hp).sort((a, c) => a.hp / BUILD[a.type].hp - c.hp / BUILD[c.type].hp);
        for (const b of broken.slice(0, 4)) if (e.repair(b.id)) kitsUsed++;
      }
      const nx = e.lnNext?.(),
        want = process.env.BELL === "1" || (process.env.BELL === "boss" && nx?.what === "boss") || (process.env.BELL === "late" && (nx?.what === "boss" || nx?.k === 3));
      if (want && !e.lnBellReason() && e.lnBell()) bells++;
    }
    act = Math.max(0, act - DT);
    if (TUNNELMODE && !ladderSeen) {
      const lad = tunnelTarget();
      if (lad && dist(s.player, lad) < seeR() && e.lineClear(s.player, lad)) {
        ladderSeen = true;
        goals = [lad];
        gi = 0;
        path = [];
      }
    }
    if (TUNNELMODE) {
      const box = e.objects.find((o) => o.type === "crate" && e.s.opened[o.id]?.day !== e.s.day && dist(o, s.player) < 70);
      if (box) {
        const at0 = { x: s.player.x, y: s.player.y };
        Object.assign(s.player, { x: box.x, y: box.y + 20 });
        e.interact();
        Object.assign(s.player, at0);
      }
    }
    const foes = e.enemies.filter((z) => !z.dead && !z.nest);
    const close = foes.filter((z) => (z.state === "chase" || z.lunge || z.charge) && dist(z, p) < 420 && (!TUNNELMODE || ((dist(z, p) < 80 || e.lineClear(z, p)) && !(z.type === "stalker" && (z.flee > 0 || dist(z, p) > 90))))).sort((a, b) => dist(a, p) - dist(b, p));
    const crowd = close.filter((z) => dist(z, p) < 130).length;
    const inCombat = close.some((z) => dist(z, p) < 300);
    if (inCombat) {
      if (segStart < 0 || t - lastCombat > 2) {
        if (segStart >= 0) segs.push(lastCombat - segStart);
        segStart = t;
      }
      lastCombat = t;
    }
    // 绷带：流血或血少（被抓住时腾不出手）
    if ((gx.bleed > 0 || p.hp < 50) && !gx.heal && (s.inventory.bandage || 0) > 0 && !gx.grab && !(gx.down > 0)) {
      if (e.consume("bandage")) stats.bandages++;
    } else if (p.hp < 45 && !gx.heal && !(s.inventory.bandage > 0) && (s.inventory.medkit || 0) > 0 && !gx.grab && !(gx.down > 0)) {
      // v0.25：绷带用完了用药包（卫生员开局带 2 个）
      if (e.consume("medkit")) stats.bandages++;
    }
    let goal = goals[gi];
    if (!fleeing && p.hp < 30 && !(s.inventory.bandage > 0) && !gx.heal) fleeing = true;
    // v0.24：躲开毒雾、酸液（先看见，再走开）
    const ux = e.ux;
    const hazards = ux
      ? [
          ...ux.fuses.map((f) => ({ key: f, x: f.x, y: f.y, r: 112 })),
          ...ux.clouds.map((c) => ({ key: c, x: c.x, y: c.y, r: c.r * Math.min(1, 0.6 + c.t / c.max) + 8, ground: true })),
          ...ux.puddles.map((q) => ({ key: q, x: q.x, y: q.y, r: q.r + 10, ground: true })),
          ...ux.acid.map((a) => ({ key: a, x: a.x, y: a.y, r: 62 })),
          ...e.enemies.filter((z) => z.spit && !z.dead).map((z) => ({ key: z.spit, x: z.spit.x, y: z.spit.y, r: 62 })),
        ]
      : [];
    // 已经站在毒雾、酸液里（掉血、冒字）：人很少察觉不到，晚一点也会走开；还在空中的落点圈照“被围时容易漏看”算
    const feel = (h) => {
      if (h.key["_hzIn"] == null) {
        h.key["_hzIn"] = t;
        h.key["_rhzIn"] = 0.3 + R() * 0.5;
        h.key["_nhzIn"] = R() < 0.9;
      }
      return h.key["_nhzIn"] && t - h.key["_hzIn"] >= h.key["_rhzIn"];
    };
    const hz = hazards.find((h) => dist(p, h) < h.r && (notice(h.key, "hz", crowd) || (FEEL && h.ground && feel(h))));
    if (fleeing) goal = goals[goals.length - 1];
    let mx = 0,
      my = 0,
      run = false,
      acted = false;
    // 长夜里的头目：和 boss-sim 一样看预兆（砸地的圈、车门的线、挥拳）躲开
    let bossA = null;
    if (LNMODE && !gx.grab && !(gx.down > 0)) {
      const b = foes.find((z) => z.lnBoss && dist(z, p) < 600);
      if (b) {
        const d = dist(b, p);
        if (b.act?.kind === "slam" && d < U.BOSSES.brute.slam.r + 30 && notice(b.act, "seen", crowd)) bossA = Math.atan2(p.y - b.y, p.x - b.x);
        else if (b.act?.kind === "door" && notice(b.act, "seen", crowd)) {
          const L = b.act.a,
            side = Math.sin(Math.atan2(p.y - b.y, p.x - b.x) - L) >= 0 ? 1 : -1;
          if (Math.abs(Math.sin(Math.atan2(p.y - b.y, p.x - b.x) - L)) * d < 60) bossA = L + side * (Math.PI / 2);
        } else if (b.act?.kind === "melee" && d < 105 && notice(b.act, "sw", crowd)) bossA = Math.atan2(p.y - b.y, p.x - b.x);
      }
    }
    if (bossA != null && !hz) {
      if (!roll(bossA)) {
        mx = Math.cos(bossA);
        my = Math.sin(bossA);
        run = p.stamina > 5;
      }
      acted = true;
    } else if (hz && !gx.grab && !(gx.down > 0)) {
      // 往离中心远的方向走；那边是墙就沿着墙换个方向（8 个方向里挑走得通的）
      const a0 = Math.atan2(p.y - hz.y, p.x - hz.x);
      let a = a0;
      if (FEEL)
        for (const k of [0, 1, -1, 2, -2, 3, -3, 4]) {
          const b = a0 + (k * Math.PI) / 4,
            q = { x: p.x + Math.cos(b) * 70, y: p.y + Math.sin(b) * 70 };
          if (!e.blocked(q.x, q.y, false, 12) && e.lineClear(p, q)) {
            a = b;
            break;
          }
        }
      if (!roll(a)) {
        mx = Math.cos(a);
        my = Math.sin(a);
        run = p.stamina > 8;
      }
      acted = true;
    } else if (gx.grab) {
      if (grabSeen == null) {
        grabSeen = t + 0.15 + R() * 0.2;
        grabOk = R() < 0.97;
      }
      if (grabOk && t >= grabSeen) {
        if (gx.shoveCd <= 0 && p.stamina >= RULES.shove.cost) e.shove();
        else {
          mashClock -= DT;
          if (mashClock <= 0) {
            e.interact();
            mashClock = 0.2;
          }
        }
      }
      acted = true;
    } else {
      grabSeen = null;
      if (!(gx.down > 0)) {
        for (const z of close) {
          if (!(z.windup > 0)) forget(z, "wind");
          if (!(z.lunge?.phase === "crouch")) forget(z, "lunge");
          if (!(z.charge?.phase === "stomp")) forget(z, "charge");
        }
        // 头目（仓库守卫）出手打不断、够得远：离 105 以内就退（和 boss-sim 一样）
        const threat = close.find((z) => z.windup > 0 && z.type !== "screamer" && dist(z, p) < (FLANK && e.bossKind?.(z) ? 105 : 72) && notice(z, "wind", crowd));
        const lunger = close.find((z) => z.lunge?.phase === "crouch" && notice(z, "lunge", crowd));
        const charger = close.find((z) => z.charge?.phase === "stomp" && notice(z, "charge", crowd));
        const screamer = close.find((z) => ((z.type === "screamer" && z.windup > 0) || (SMART && z.type === "spitter" && z.spit)) && dist(z, p) < 250 && notice(z.spit || z, "scream", crowd));
        if (bracing && !(bracing.lunge && bracing.lunge.phase !== "stumble")) bracing = null;
        if (screamer && e.qty("stone") > 0 && act <= 0 && e.cooldown <= 0 && e.lineClear(p, screamer)) {
          s.slot = 5;
          if (R() < 0.85) e.use({ x: screamer.x, y: screamer.y });
          else e.use({ x: screamer.x + 40, y: screamer.y + 30 });
          s.slot = 3;
          act = 0.4;
          acted = true;
        } else if (lunger) {
          if (W?.brace || (TACTIC && WF.leap)) bracing = lunger;
          else {
            const a = Math.atan2(lunger.y - p.y, lunger.x - p.x) + (Math.PI / 2) * (R() < 0.5 ? 1 : -1);
            if (roll(a)) acted = true;
            else {
              mx = Math.cos(a);
              my = Math.sin(a);
              run = p.stamina > 10;
            }
          }
        } else if (bracing) {
          p.facing = Math.atan2(bracing.y - p.y, bracing.x - p.x);
          // 砍刀：等它扑过来，够得着就迎面一刀砍腿
          if (TACTIC && WF.leap && bracing.lunge?.phase === "leap" && dist(bracing, p) < W.range - 4 && e.cooldown <= 0) e.use({ x: bracing.x, y: bracing.y - 20 });
          acted = true;
        } else if (charger) {
          const a = Math.atan2(charger.y - p.y, charger.x - p.x) + Math.PI / 2;
          if (roll(a)) acted = true;
          else {
            mx = Math.cos(a);
            my = Math.sin(a);
            run = p.stamina > 10;
          }
        } else if (W && !fleeing && close.length) {
          // 吐酸者血少、站得远：身边没别的贴着时先去打它（提示里就是这么说的）
          const spitter = SMART && close.find((o) => o.type === "spitter" && dist(o, p) < 300);
          const z = spitter && !close.some((o) => o !== spitter && dist(o, p) < 100) ? spitter : close[0],
            d = dist(z, p);
          const adj = close.filter((o) => dist(o, p) < 75).length;
          if (adj >= 2 && gx.shoveCd <= 0 && p.stamina >= RULES.shove.cost + 5) {
            p.facing = Math.atan2(z.y - p.y, z.x - p.x);
            e.shove();
            acted = true;
          } else if (threat && TACTIC && cutsWind && !e.bossKind?.(threat) && dist(threat, p) < W.range - 6 && e.cooldown <= 0) {
            // 能打断出手的：它抬手、够得着，就先砍下去
            e.use({ x: threat.x, y: threat.y - 20 });
            acted = true;
          } else if (threat) {
            const a = Math.atan2(p.y - threat.y, p.x - threat.x);
            if (roll(a)) acted = true;
            else {
              mx = Math.cos(a);
              my = Math.sin(a);
              run = FLANK && !!e.bossKind?.(threat) && p.stamina > 8;
            }
          } else if (ROLL === "crowd" && adj >= 3 && !e.dodgeReason()) {
            let ax = 0,
              ay = 0;
            for (const o of close)
              if (dist(o, p) < 120) {
                ax += p.x - o.x;
                ay += p.y - o.y;
              }
            roll(Math.atan2(ay, ax));
            acted = true;
          } else if (((FLANK && e.bossKind?.(z) === "guard" && !z.g2 && !(TACTIC && WF.guardPlate)) || (TACTIC && z.type === "armor" && !z.split && W.pierce < 0.6 && !close.some((o) => o !== z && dist(o, p) < 110))) && !z.charge && d < 160 && inFront(z) && (circleT += DT) < 3) {
            // 绕到背后：仓库守卫甲还在时（拿大锤的不绕，正面砸它的甲片）；破甲差的武器（砍刀）打重甲、身边没别的时也绕
            // 绕到背后（绕 3 秒还绕不过去，就正面打 2 秒再试）
            const back = (z.facing ?? 0) + Math.PI,
              a = Math.atan2(z.y + Math.sin(back) * 60 - p.y, z.x + Math.cos(back) * 60 - p.x);
            mx = Math.cos(a);
            my = Math.sin(a);
            run = p.stamina > 20;
          } else if (TACTIC && WF.slowBleed && z.slowT > 0 && e.cooldown > 0.05 && adj <= 1 && d < W.range - 14) {
            // 钉子球棒：它流着血走不动，等下一下的工夫退半步
            const a = Math.atan2(p.y - z.y, p.x - z.x);
            mx = Math.cos(a);
            my = Math.sin(a);
            acted = true;
          } else if (d < W.range - 6) {
            if (e.cooldown <= 0) e.use({ x: z.x, y: z.y - 20 });
            if (circleT >= 3 && (circleT += DT) > 5) circleT = 0;
            acted = true;
          } else if (adj >= 3 || (close.filter((o) => dist(o, p) < 160).length >= 3 && p.hp < 60)) {
            let ax = 0,
              ay = 0;
            for (const o of close)
              if (dist(o, p) < 200) {
                ax += p.x - o.x;
                ay += p.y - o.y;
              }
            const a = Math.atan2(ay, ax);
            mx = Math.cos(a);
            my = Math.sin(a);
            run = p.stamina > 25;
          } else if (d < (z.type === "spitter" ? 320 : 300)) {
            if (W.brace && d < W.range + 50) p.facing = Math.atan2(z.y - p.y, z.x - p.x);
            else {
              const a = Math.atan2(z.y - p.y, z.x - p.x);
              mx = Math.cos(a);
              my = Math.sin(a);
            }
          }
        } else if (!W && close.some((z) => dist(z, p) < 230)) {
          if (threat && gx.shoveCd <= 0 && p.stamina >= RULES.shove.cost + 10) {
            p.facing = Math.atan2(threat.y - p.y, threat.x - p.x);
            e.shove();
            acted = true;
          } else {
            let ax = 0,
              ay = 0;
            for (const z of close)
              if (dist(z, p) < 260) {
                const w = 1 / Math.max(30, dist(z, p));
                ax += (p.x - z.x) * w;
                ay += (p.y - z.y) * w;
              }
            const ga = Math.atan2(goal.y - p.y, goal.x - p.x),
              fa = Math.atan2(ay, ax);
            const a = Math.atan2(Math.sin(fa) * 1.4 + Math.sin(ga) * 0.6, Math.cos(fa) * 1.4 + Math.cos(ga) * 0.6);
            mx = Math.cos(a);
            my = Math.sin(a);
            run = p.stamina > 15;
          }
        }
        if (!acted && mx === 0 && my === 0 && !bracing && !(W && close.some((z) => dist(z, p) < 300) && !fleeing)) {
          if (dist(p, goal) < (goal.exit ? 40 : 60)) {
            if (goal.ladder) {
              // 到了检修梯：往下一层；下够了这一趟就算过了
              Object.assign(p, { x: goal.x, y: goal.y });
              // 体力不够爬梯子：站着喘口气
              for (let k = 0; k < 200 && p.stamina < 6 && !died; k++) {
                e.update(DT, { x: 0, y: 0 });
                t += DT;
              }
              floorTimes.push(t - tunnelT0);
              tunnelT0 = t;
              // 泵房：走到光跟前就算到底了
              if (goal.core) {
                tunnelFloors++;
                break;
              }
              if (e.tunnelDown()) tunnelFloors++;
              else {
                if (process.env.TRACE) console.error("tunnelDown failed", JSON.stringify({ pos: [p.x, p.y], lad: e.tunnelLayoutNow()?.ladders, st: p.stamina, region: s.region, floor: e.tunnelFloor() }));
                break;
              }
              if (tunnelFloors >= TSPAN) break;
              goals = tunnelGoals();
              gi = 0;
              path = [];
              e.update(DT, { x: 0, y: 0 });
              continue;
            }
            if (goal.crate && e.s.opened[goal.crate.id]?.day !== e.s.day) {
              Object.assign(p, { x: goal.crate.x, y: goal.crate.y + 20 });
              e.interact();
            }
            if (goal.exit) break;
            // 长夜：站在中间守着，不往下一处走
            if (goal.hold) waitAt = -1e9;
            waitAt += TUNNELMODE ? 1 : DT;
            if (waitAt >= 2) {
              gi++;
              waitAt = 0;
              path = [];
            }
          } else {
            pathTimer -= DT;
            if (!path.length || pathTimer <= 0 || pathFor !== goal) {
              path = e.pathTo(p, goal);
              pathFor = goal;
              pathTimer = 0.8;
            }
            while (path[0] && dist(p, path[0]) < 22) path.shift();
            const fat = (a, b) => [-13, 0, 13].every((o) => e.lineClear({ x: a.x, y: a.y + o }, { x: b.x, y: b.y + o }) && e.lineClear({ x: a.x + o, y: a.y }, { x: b.x + o, y: b.y }));
            const nxt = fat(p, goal) ? goal : path[0] || goal;
            const a = Math.atan2(nxt.y - p.y, nxt.x - p.x);
            mx = Math.cos(a);
            my = Math.sin(a);
            run = fleeing && p.stamina > 10;
          }
        }
      }
    }
    e.update(DT, { x: mx, y: my, run });
    if (process.env.TRACE && Math.floor(t + DT) !== Math.floor(t)) {
      const gd = e.enemies.find((z) => e.bossKind?.(z) === "guard");
      console.error(Math.floor(t + DT), "pos", Math.round(p.x), Math.round(p.y), "fl", e.tunnelFloor?.() || 0, "g", goal ? Math.round(goal.x) + "," + Math.round(goal.y) : "-", "hp", Math.round(p.hp), "band", s.inventory.bandage || 0, "goal", gi, fleeing ? "FLEE" : "", "guard", gd ? [Math.round(gd.hp), gd.dead ? "dead" : gd.state, Math.round(dist(gd, p)), inFront(gd) ? "front" : "back", gd.g2 ? "g2" : "", gd.charge?.phase || ""].join(" ") : "-", "close", close.map((z) => z.type + Math.round(dist(z, p))).join(","), "hz", hz ? "Y" : "", "pud", ux?.puddles.length || 0, "acidIn", e.inAcid?.() ? "IN" : "", "gas", e.inGas?.() ? "IN" : "");
    }
    if (p.hp < lastHp) dmg += lastHp - p.hp;
    lastHp = p.hp;
    t += DT;
    if (dist(p, lastPos) < 0.5 && !acted && !inCombat && !gx.grab && !(gx.down > 0) && !(dist(p, goal) < 60)) stuckT += DT;
    else stuckT = 0;
    lastPos = { x: p.x, y: p.y };
    if (stuckT > 6) {
      path = [];
      pathTimer = 0;
      const a = R() * 6.28;
      for (let k = 0; k < 10; k++) e.update(DT, { x: Math.cos(a), y: Math.sin(a), run: false });
      stuckT = 0;
    }
  }
  if (segStart >= 0) segs.push(lastCombat - segStart);
  const atExit = TUNNELMODE ? !died && tunnelFloors >= TSPAN : s.region === region && dist(s.player, goals[goals.length - 1]) < 60;
  // 长夜：守住了算 ok（没有“半路逃回”）
  const ok = TUNNELMODE ? !died && tunnelFloors >= TSPAN : LNMODE ? !died && lnStarted && !e.ln.night && e.ln.last?.held === true : HORDEMODE ? !died && lnStarted && s.horde.phase === "won" : !died && atExit && gi >= goals.length - 1;
  const fled = !LNMODE && !HORDEMODE && !died && atExit && !ok;
  return {
    died,
    lay: e.ut?.gen?.[region]?.k ?? -1,
    acid: envBy.acid,
    gas: envBy.gas,
    ev: e.ut?.ev?.region === region ? e.ut.ev.id : "",
    cause: died ? stats.cause : null,
    ok,
    fled,
    timeout: !died && !ok && !fled,
    t,
    segs,
    dmg,
    kills: s.stats.kills - kills0,
    bandages: stats.bandages,
    grabs: g.stats.grabs - stats.grabs0,
    bites: g.stats.bites - stats.bites0,
    lunges: g.stats.lunges - stats.lunges0,
    counters: g.stats.counters - stats.counters0,
    interrupts: g.stats.interrupts - stats.interrupts0,
    summons: g.stats.summons - stats.summons0,
    broken: g.stats.broken - stats.broken0,
    weaponLeft: kit.weapon ? Math.round((e.cond(kit.weapon).d / e.cond(kit.weapon).m) * 100) : 100,
    rolls: (e.feel?.stats.rolls || 0) - stats.rolls0,
    // 长夜：打到第几波、头目打倒没有
    lnWave: LNMODE ? e.ln?.last?.waves ?? 0 : 0,
    phase: LNMODE ? e._nfForce || "" : "",
    lnBoss: LNMODE ? !!e.ln?.last?.boss : false,
    killBy,
    bldLost: hpStart - bhp(),
    hnHurt: e.hn ? Object.keys(e.hn.hurt).length : 0,
    fenceLost: fenceStart - fhp(),
    barbDmg,
    ammoUsed: ammo0 - (s.storage.ammo || 0),
    woodUsed: wood0 - (s.storage.wood || 0),
    pulls,
    bells,
    kitsUsed,
    floors: tunnelFloors,
    floorTimes,
  };
}

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0) + "%";
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
for (const region of REGION_LIST)
  for (const kitId of KITS) {
    const rs = [];
    const t0 = Date.now();
    const OFF = Number(process.env.OFF || 0);
    for (let i = 0; i < N; i++) {
      rs.push({ ...trial(region, kitId, i + 1 + OFF), seed: i + 1 + OFF });
      if (process.env.TPRINT) console.error("seed", i + 1 + OFF, "died", rs[i].died, "floors", rs[i].floors, "times", rs[i].floorTimes.map((x) => Math.round(x)).join(","), "t", Math.round(rs[i].t));
    }
    const segs = rs.flatMap((r) => r.segs).filter((x) => x > 1).sort((a, b) => a - b);
    const row = {
      day: DAY,
      n: N,
      died: pct(rs.filter((r) => r.died).length, N),
      ok: pct(rs.filter((r) => r.ok).length, N),
      fled: pct(rs.filter((r) => r.fled).length, N),
      timeout: rs.filter((r) => r.timeout).length,
      avgTime: Math.round(mean(rs.map((r) => r.t))),
      fights: +mean(rs.map((r) => r.segs.filter((x) => x > 1).length)).toFixed(1),
      fightMed: segs.length ? +segs[Math.floor(segs.length / 2)].toFixed(1) : 0,
      fightP75: segs.length ? +segs[Math.floor(segs.length * 0.75)].toFixed(1) : 0,
      dmg: Math.round(mean(rs.map((r) => r.dmg))),
      acidDmg: Math.round(mean(rs.map((r) => r.acid || 0))),
      gasDmg: Math.round(mean(rs.map((r) => r.gas || 0))),
      kills: +mean(rs.map((r) => r.kills)).toFixed(1),
      bandages: +mean(rs.map((r) => r.bandages)).toFixed(1),
      grabs: +mean(rs.map((r) => r.grabs)).toFixed(1),
      bites: +mean(rs.map((r) => r.bites)).toFixed(2),
      lunges: +mean(rs.map((r) => r.lunges)).toFixed(1),
      counters: +mean(rs.map((r) => r.counters)).toFixed(1),
      interrupts: +mean(rs.map((r) => r.interrupts)).toFixed(1),
      summons: +mean(rs.map((r) => r.summons)).toFixed(1),
      broken: +mean(rs.map((r) => r.broken)).toFixed(2),
      weaponLeft: Math.round(mean(rs.map((r) => r.weaponLeft))),
      rolls: +mean(rs.map((r) => r.rolls)).toFixed(1),
      ms: Date.now() - t0,
      deadSeeds: process.env.SEEDS ? rs.filter((r) => r.died).map((r) => r.seed) : undefined,
      stuckSeeds: process.env.SEEDS ? rs.filter((r) => r.timeout).map((r) => r.seed) : undefined,
      byLayout: Object.fromEntries([0, 1, 2].map((k) => [k, rs.filter((r) => r.lay === k && r.died).length + "/" + rs.filter((r) => r.lay === k).length])),
      byEvent: Object.fromEntries([...new Set(rs.map((r) => r.ev || "none"))].map((k) => [k, rs.filter((r) => (r.ev || "none") === k && r.died).length + "/" + rs.filter((r) => (r.ev || "none") === k).length])),
      causes: Object.fromEntries(Object.entries(rs.filter((r) => r.died).reduce((m, r) => ((m[r.cause] = (m[r.cause] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1])),
      // 长夜：倒在第几波（1/2/3）、头目打倒的趟数
      lnDiedAt: region === "longnight" ? [1, 2, 3].map((w) => rs.filter((r) => r.died && r.lnWave === w).length).join("/") : undefined,
      lnBossDown: region === "longnight" ? rs.filter((r) => r.lnBoss).length : undefined,
      // v0.35：每个夜相倒下几趟/几趟
      byPhase: region === "longnight" && NFD ? Object.fromEntries([...new Set(rs.map((r) => r.phase))].sort().map((k) => [k || "none", rs.filter((r) => r.phase === k && r.died).length + "/" + rs.filter((r) => r.phase === k).length])) : undefined,
      // 守夜台
      killTrap: +mean(rs.map((r) => r.killBy.trap)).toFixed(1),
      killTower: +mean(rs.map((r) => r.killBy.tower)).toFixed(1),
      killPlayer: +mean(rs.map((r) => r.killBy.weapon)).toFixed(1),
      defenseShare: pct(rs.reduce((a, r) => a + r.killBy.trap + r.killBy.tower, 0), rs.reduce((a, r) => a + r.killBy.trap + r.killBy.tower + r.killBy.weapon, 0)),
      bldLost: Math.round(mean(rs.map((r) => r.bldLost))),
      hurt: +mean(rs.map((r) => r.hnHurt)).toFixed(2),
      fenceLost: Math.round(mean(rs.map((r) => r.fenceLost))),
      barbDmg: Math.round(mean(rs.map((r) => r.barbDmg))),
      ammoUsed: Math.round(mean(rs.map((r) => r.ammoUsed))),
      woodUsed: Math.round(mean(rs.map((r) => r.woodUsed))),
      pulls: +mean(rs.map((r) => r.pulls)).toFixed(1),
      bells: +mean(rs.map((r) => r.bells)).toFixed(1),
      fixed: +mean(rs.map((r) => r.kitsUsed)).toFixed(1),
      set: process.env.LNSET || (process.env.LNPREP === "1" ? "LNPREP" : ""),
      // 隧道：每层几秒（游戏里 1 秒 = 1.6 分钟）、平均下了几层
      floorSec: region === "tunnel" ? Math.round(mean(rs.flatMap((r) => r.floorTimes))) : undefined,
      floors: region === "tunnel" ? +mean(rs.map((r) => r.floors)).toFixed(2) : undefined,
      from: region === "tunnel" ? Number(process.env.TFLOOR || 1) : undefined,
    };
    console.log(region, kitId, JSON.stringify(row));
  }
