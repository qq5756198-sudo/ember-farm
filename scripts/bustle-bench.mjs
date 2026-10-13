// 热闹台（v0.28 起）：用正式代码看「动静」和「红薯跑商」两件事有没有过方案的线。
//
// 1) 动静：node scripts/bustle-bench.mjs noise [种子,种子] [天数]
//    主线打到第七段、电台修好、何大勺入伙、机床修好，从第 8 天起过 14 天，四种过法：
//      安静：不播节目、不加急、不开食堂（节庆照办）
//      平常：每天播一档节目（新闻、点歌、生存课、寻人启事轮着播），节庆照办
//      热闹：每天播节目、机床能加急就加急、食堂日开食堂、节庆照办
//      最吵：每天点歌、加急、食堂、节庆，每周拉一次信标
//    每种再分「睡着」（22:00 睡觉，0 点自动结算）和「醒着」（守到 02:00；你站在农舍门口不出手，只看塔和守卫）；
//    「有守卫和围栏」：三个居民排守卫、两座塔、一圈围栏（12 段）。记：每周几场、来了几只、谁受伤、围栏掉了多少耐久。
//    方案的线：安静的 0 场；热闹的每周 2–4 场，有守卫和围栏时不掉人。
//
// 3) 改良（不打仗的四类）：node scripts/bustle-bench.mjs up
//    喷灌头（一座管几块田、同样的水浇几块）、篝火灶（排 4 批炖菜做 3 个钟点出几份、一份土豆出几份）、雨水桶（存多少、雨天出多少）。
//    瞭望塔、陷阱、围栏在守夜台里比：HNUP=… node scripts/gear-sim.mjs 400 38 longnight mid（见 gear-sim 开头）。
//    方案的线：保留和改造的在它管的那件事上变化 5% 以上。
//
// 2) 跑商：node scripts/bustle-bench.mjs mule [趟数]
//    每个去处一车典型的货（集市 20 个土豆、地区 6 个药包 + 14 条绷带、边境 8 块布 + 12 个零件），带回金币；
//    跟车 / 不跟车（营地安静）/ 不跟车（营地动静 8 以上或灰隼团要来）各跑若干趟，和同一车货直接出货比。
//    方案的线：跟车不被截；不跟车被截 15%–30%；一趟净赚比直接出货多 10%–30%。
const D = new URL("../dist/", import.meta.url).href;
const { Engine, newGameState } = await import(D + "campaign.js");
const { BUILDINGS, ITEMS } = await import(D + "data.js");
const { TASKS } = await import(D + "rebuild-data.js");
const { SSPOTS } = await import(D + "seasons-data.js");
const { NOISE, MULE, INJURY } = await import(D + "bustle-data.js");

const MODE = process.argv[2] || "noise";

function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const put = (e, type, x, y, rot = 0) => {
  const b = { id: "hb-" + type + "-" + e.s.idCounter++, type, x, y, rotation: rot, hp: BUILDINGS[type].hp };
  e.s.buildings.push(b);
  e.navRevision = (e.navRevision || 0) + 1;
  return b;
};
// 主线打到第 n 段（和测试里一样的设法）
function toAct(e, n) {
  const sc = e.sc;
  sc.act = n;
  sc.claimed = ["act1", "supply", "act2", ...[3, 4, 5, 6, 7, 8].filter((k) => k < n).map((k) => "act" + k)];
  sc.choice = "ration";
  sc.letters = ["act1", "act2", ...[3, 4, 5, 6, 7, 8].filter((k) => k <= n).map((k) => "act" + k)];
  sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true;
  sc.camp = { x: 560, y: 735 };
  e.r.claimed = TASKS.slice(0, TASKS.findIndex((t) => t.id === "broadcast") + 1).map((t) => t.id);
  e.o.hospital = "water";
  Object.assign(e.o, { youke: true, lathe: { mode: "parts", day: 0 } });
  e.r.radio = true;
  e.o.toll = "refuse";
  e.o.raid.phase = "won";
  e.assignRegion();
}
function camp(seed) {
  Math.random = seeded(seed * 104729 + 7);
  const e = new Engine(newGameState("farmer"), () => {});
  if (e.feel?.open) e.feel.open.phase = "done";
  e.markGearIntro?.();
  if (e.ut) e.ut.seed = 9000 + seed;
  if (e.dy) e.dy.pending = null;
  toAct(e, 7);
  e.ss.he.stage = 4;
  e.s.day = 8;
  e.s.minute = 8 * 60;
  // 别的夜里的事这里不看：尸潮、灰隼团、长夜推开
  e.s.stats.hordes = 0;
  e.c.nextHordeDay = 999;
  if (e.ln) e.ln.storyDay = 999;
  if (e.o?.raid) e.o.raid.phase = "won";
  Object.assign(e.s.storage, { bread: 400, wood: 200, scrap: 80, cloth: 40, parts: 60, ammo: 200, stew: 200, jam: 60, beanMeal: 60, herbTea: 60, potato: 80, radish: 80, bean: 40, herb: 40 });
  return e;
}
const atFarm = (e, x = 830, y = 460) => {
  if (e.s.region !== "farm") {
    e.s.region = "farm";
    e.enemies = e.s.enemies.farm ||= [];
    e.assignRegion();
  }
  Object.assign(e.s.player, { x, y, hp: 100, stamina: 100, hunger: 90 });
};
const until = (e, minute) => {
  if (e.s.minute < minute) e.advanceMinutes(minute - e.s.minute);
};

// ================= 动静 =================
const PROFILES = {
  quiet: { name: "安静", radio: null, rush: false, canteen: false },
  normal: { name: "平常", radio: "rotate", rush: false, canteen: false },
  lively: { name: "热闹", radio: "rotate", rush: true, canteen: true },
  loudest: { name: "最吵", radio: "songs", rush: true, canteen: true, lure: true },
};
const ROTATE = ["news", "songs", "lesson", "missing"];

function noiseRun(seed, profile, days, opts) {
  const e = camp(seed);
  const P = PROFILES[profile];
  if (opts.defended) {
    for (const id of ["farmer", "medic", "mechanic"]) e.recruit(id);
    e.residentsCapacity = () => 5;
    for (const r of e.c.residents) {
      r.fed = true;
      r.priorities.guard = 1;
    }
    for (const [x, y] of [[1040, 600], [1040, 360]]) put(e, "tower", x, y);
    // 东边、北边、南边一圈围栏（12 段）
    for (let i = 0; i < 6; i++) put(e, "fence", 1150, 300 + i * 72, 1);
    for (let i = 0; i < 3; i++) put(e, "fence", 900 + i * 72, 200);
    for (let i = 0; i < 3; i++) put(e, "fence", 900 + i * 72, 860);
  }
  if (P.lure) {
    put(e, "lure", 1180, 495);
    e.c.energy = 100;
  }
  const hp0 = () => e.s.buildings.filter((b) => ["fence", "gate", "tower"].includes(b.type)).reduce((a, b) => a + b.hp, 0);
  const R = { attacks: 0, zombies: 0, hurt: 0, hurtNames: [], bldLost: 0, peak: 0, byDay: [], hit: 0, towerKills: 0, reached: 0 };
  const start = e.s.day;
  for (let d = 0; d < days; d++) {
    const day = e.s.day;
    atFarm(e);
    // 白天：排节目、加急、喂守卫
    for (const r of e.c.residents) r.fed = true;
    if (P.radio) e.chooseProgram(P.radio === "rotate" ? ROTATE[(day + seed) % ROTATE.length] : P.radio);
    until(e, 10 * 60);
    if (P.rush && !e.latheRushReason()) e.latheRush();
    if (P.lure && (day - start) % 7 === 3) {
      const lure = e.s.buildings.find((b) => b.type === "lure");
      e.c.energy = Math.max(e.c.energy || 0, 20);
      if (lure && !e.pullLureReason?.(lure.id)) e.pullLure(lure.id);
    }
    // 节庆（16:00–22:00，广场）
    if (e.isFestivalDay() && e.festivalsOpen()) {
      until(e, 16 * 60 + 10);
      atFarm(e, SSPOTS.plaza.x, SSPOTS.plaza.y + 20);
      e.hostFestival();
    }
    // 食堂（19:00–21:30，广场）
    if (P.canteen && e.isCanteenDay()) {
      until(e, 19 * 60 + 5);
      atFarm(e, SSPOTS.plaza.x, SSPOTS.plaza.y + 20);
      if (e.startCanteen()) {
        for (let k = 0; k < 12 && e.ss.canteen.night; k++) {
          e.advanceMinutes(10);
          if (e.stoveDish()) e.serveCarry(e.hn.carry?.guest);
        }
      }
    }
    until(e, 22 * 60);
    atFarm(e, 330, 340);
    R.peak = Math.max(R.peak, e.hn.noise.v);
    const before = e.hn.stats.attacks || 0,
      hurt0 = Object.keys(e.hn.hurt).length,
      b0 = hp0();
    if (opts.awake) {
      // 醒着：守到 02:00；你站在农舍门口不出手（血不掉），只看塔和守卫
      until(e, 23 * 60 + 59);
      e.advanceMinutes(1.5);
      const live = e.hn.attack.state === "live";
      if (live) {
        const realHurt = e.hurtEnemy.bind(e);
        e.hurtEnemy = (z, n, a, meta) => {
          const was = !z.dead,
            src = e._damageSource,
            out = realHurt(z, n, a, meta);
          if (was && z.dead && z.hnNoise && src === "tower") R.towerKills++;
          return out;
        };
        let reached = false;
        for (let t = 0; t < 2 * 60 / 1.6 && e.noiseAlive().length; t += 0.05) {
          e.paused = false;
          e.update(0.05, {});
          e.s.player.hp = 100;
          if (!reached && e.noiseAlive().some((z) => Math.hypot(z.x - e.s.player.x, z.y - e.s.player.y) < 60)) reached = true;
        }
        if (reached) R.reached++;
        delete e.hurtEnemy;
      }
      until(e, 2 * 60);
      e.sleep();
    } else e.sleep();
    const n = (e.hn.stats.attacks || 0) - before;
    if (n) {
      R.attacks += n;
      R.zombies += e.hn.attack.n;
      R.byDay.push(day);
    }
    const newHurt = Object.keys(e.hn.hurt).length - hurt0;
    if (newHurt > 0) {
      R.hurt += newHurt;
      R.hurtNames.push(day);
    }
    R.bldLost += Math.max(0, b0 - hp0());
    // 修好围栏（玩家白天会修）
    for (const b of e.s.buildings) if (["fence", "gate", "tower"].includes(b.type)) b.hp = BUILDINGS[b.type].hp;
    for (const k of Object.keys(e.hn.hurt)) delete e.hn.hurt[k];
    for (const r of e.c.residents) if (r.status === "受伤了") r.status = "";
    if (e.s.region !== "farm") atFarm(e);
  }
  return R;
}

if (MODE === "noise") {
  const SEEDS = (process.argv[3] || "1,2,3,4,5,6").split(",").map(Number);
  const DAYS = Number(process.argv[4] || 14);
  const rows = [];
  for (const profile of Object.keys(PROFILES))
    for (const [label, opts] of [
      ["睡着", { awake: false, defended: false }],
      ["睡着·有守卫和围栏", { awake: false, defended: true }],
      ["醒着·有守卫和围栏", { awake: true, defended: true }],
    ]) {
      const rs = SEEDS.map((s) => noiseRun(s, profile, DAYS, opts));
      const weeks = DAYS / 7;
      const per = rs.map((r) => r.attacks / weeks);
      rows.push({
        camp: PROFILES[profile].name,
        how: label,
        perWeek: +(per.reduce((a, b) => a + b, 0) / rs.length).toFixed(2),
        minWeek: +Math.min(...per).toFixed(1),
        maxWeek: +Math.max(...per).toFixed(1),
        zombies: +(rs.reduce((a, r) => a + r.zombies, 0) / rs.length).toFixed(1),
        peak: Math.max(...rs.map((r) => r.peak)),
        hurt: +(rs.reduce((a, r) => a + r.hurt, 0) / rs.length).toFixed(2),
        bldLost: Math.round(rs.reduce((a, r) => a + r.bldLost, 0) / rs.length),
        towerKills: opts.awake ? +(rs.reduce((a, r) => a + r.towerKills, 0) / rs.length).toFixed(1) : undefined,
        reachedDoor: opts.awake ? +(rs.reduce((a, r) => a + r.reached, 0) / rs.length).toFixed(1) : undefined,
        days: rs[0].byDay.join(","),
      });
    }
  console.table(rows);
  const lively = rows.filter((r) => r.camp === "热闹");
  const quiet = rows.filter((r) => r.camp === "安静");
  const ok1 = quiet.every((r) => r.perWeek === 0);
  const ok2 = lively.every((r) => r.perWeek >= 2 && r.perWeek <= 4);
  const ok3 = rows.filter((r) => r.how.includes("守卫")).filter((r) => r.camp === "热闹").every((r) => r.hurt === 0);
  console.log("安静 0 场：" + (ok1 ? "过" : "没过") + "；热闹每周 2–4 场：" + (ok2 ? "过" : "没过") + "；有守卫和围栏不掉人（热闹）：" + (ok3 ? "过" : "没过"));
}

// ================= 跑商 =================
const LOADS = {
  market: { potato: 20 },
  region: { medkit: 6, bandage: 14 },
  frontier: { cloth: 8, parts: 12 },
};
function muleTrip(e, dest, how, k) {
  atFarm(e);
  Object.assign(e.s.storage, { potato: 40, medkit: 12, bandage: 30, cloth: 20, parts: 30, radish: 10 });
  e.hn.mule.next = 0;
  e.hn.noise.v = how === "risky" ? NOISE.tiers[0].at : 0;
  e.muleSet("dest", dest);
  e.muleSet("back", "money");
  for (const [id, n] of Object.entries(LOADS[dest])) e.muleAdjust(id, n);
  const ship = e.muleShipValue(e.hn.mule.plan.load);
  const wage = Math.floor(e.shipPrice ? e.shipPrice("radish") : ITEMS.radish.sell);
  if (!e.muleGo()) throw new Error("mule did not go: " + e.muleReason());
  const t = e.hn.mule.trip;
  // 不同的出发日（被截不被截按出发日和去处定）
  t.day = 1000 + k;
  if (how === "escort") t.escort = true;
  const money = e.s.money;
  e.s.day = Math.floor(t.returns / 1440);
  e.s.minute = 8 * 60;
  e.muleReturn();
  const got = e.s.money - money;
  const log = e.hn.mule.log[0];
  return { ship, value: log.value, got, wage, robbed: log.robbed };
}
if (MODE === "mule") {
  const N = Number(process.argv[3] || 400);
  const e = camp(1);
  e.o.cargo = "food";
  e.o.convoy = { departs: 0, arrives: 0, escorted: true, spawned: false, foes: [], done: true, lost: false };
  e.s.districts.unlocked = { ...e.s.districts.unlocked, stationMarket: true };
  e.s.beyond.unlocked = { ...e.s.beyond.unlocked, shipyard: true };
  const rows = [];
  for (const dest of Object.keys(LOADS))
    for (const how of ["escort", "quiet", "risky"]) {
      const rs = [];
      for (let k = 0; k < N; k++) rs.push(muleTrip(e, dest, how, k));
      const robbed = rs.filter((r) => r.robbed).length;
      const net = rs.reduce((a, r) => a + r.got - r.wage, 0) / N,
        ship = rs.reduce((a, r) => a + r.ship, 0) / N,
        safe = rs.filter((r) => !r.robbed),
        safeNet = safe.reduce((a, r) => a + r.got - r.wage, 0) / Math.max(1, safe.length);
      // 20 趟一组：被截几趟
      const groups = [];
      for (let g = 0; g + 20 <= N; g += 20) groups.push(rs.slice(g, g + 20).filter((r) => r.robbed).length);
      rows.push({
        dest: MULE.dest[dest].name,
        how: { escort: "跟车", quiet: "不跟车·营地安静", risky: "不跟车·营地吵" }[how],
        trips: N,
        robbed: Math.round((100 * robbed) / N) + "%",
        per20: Math.min(...groups) + "–" + Math.max(...groups),
        ship: Math.round(ship),
        value: Math.round(rs.reduce((a, r) => a + r.value, 0) / N),
        net: Math.round(net),
        vsShip: Math.round((100 * (net - ship)) / ship) + "%",
        notRobbedVsShip: Math.round((100 * (safeNet - ship)) / ship) + "%",
      });
    }
  console.table(rows);
  const esc = rows.filter((r) => r.how === "跟车");
  const ok1 = esc.every((r) => r.robbed === "0%");
  const q = rows.filter((r) => r.how !== "跟车").map((r) => parseInt(r.robbed));
  const ok2 = q.every((v) => v >= 13 && v <= 32);
  const ok3 = esc.every((r) => parseInt(r.vsShip) >= 10 && parseInt(r.vsShip) <= 30);
  console.log("跟车不被截：" + (ok1 ? "过" : "没过") + "；不跟车被截 15%–30%：" + (ok2 ? "过" : "没过") + "（" + q.join("%、") + "%）；跟车一趟比直接出货多 10%–30%：" + (ok3 ? "过" : "没过"));
  void INJURY;
}

// ================= 改良（不打仗的四类） =================
if (MODE === "up") {
  const { UPGRADES } = await import(D + "bustle-data.js");
  const e = camp(1);
  atFarm(e);
  const pct = (a, b) => (b ? (a >= b ? "+" : "") + Math.round((100 * (a - b)) / b) + "%" : "—");
  const rows = [];
  // 喷灌头：田边一圈（离田 40 步）每隔 20 步放一座，平均管几块田
  const spr = put(e, "irrigation", 495, 520);
  const farm = e.farmPlots ? e.farmPlots() : e.s.plots;
  const xs = farm.map((p) => p.x),
    ys = farm.map((p) => p.y);
  const x0 = Math.min(...xs) - 40,
    x1 = Math.max(...xs) + 40,
    y0 = Math.min(...ys) - 40,
    y1 = Math.max(...ys) + 40;
  const spots = [];
  for (let x = x0; x <= x1; x += 20) spots.push([x, y0], [x, y1]);
  for (let y = y0; y <= y1; y += 20) spots.push([x0, y], [x1, y]);
  const cover = () => spots.reduce((a, [x, y]) => (Object.assign(spr, { x, y }), a + farm.filter((p) => Math.hypot(p.x - spr.x, p.y - spr.y) < e.sprinklerR(spr)).length), 0) / spots.length;
  const c0 = cover();
  spr.hnUp = "far";
  const c1 = cover();
  spr.hnUp = undefined;
  Object.assign(spr, { x: 495, y: 520 });
  rows.push({ 改良: "喷灌头 · 远喷", 看什么: "放在田边（离田 40 步）平均管几块田", 原来: +c0.toFixed(1), 改了: +c1.toFixed(1), 变化: pct(c1, c0) });
  const route = { kind: "sprinkler", id: spr.id };
  const w0 = e.routeCostMult(route);
  spr.hnUp = "saver";
  const w1 = e.routeCostMult(route);
  spr.hnUp = undefined;
  rows.push({ 改良: "喷灌头 · 省水", 看什么: "10 份水浇几块田", 原来: Math.floor(10 / w0), 改了: Math.floor(10 / w1 + 1e-9), 变化: pct(Math.floor(10 / w1 + 1e-9), Math.floor(10 / w0)) });
  // 篝火灶：排 4 批炖菜，看做完要几分钟、出几份
  e.s.buildings = e.s.buildings.filter((b) => b.type !== "cook");
  const cook = put(e, "cook", 1010, 480);
  const batches = (up) => {
    cook.hnUp = up;
    e.c.production = [];
    e.s.storage.potato = 40;
    for (let i = 0; i < 4; i++) e.craftBatch("stew", 1);
    let m = 0;
    while (e.c.production.some((j) => !j.ready) && m < 1000) {
      e.processProduction(1);
      m++;
    }
    return { minutes: m, made: e.c.production.reduce((a, j) => a + (j.out.stew || 0), 0) };
  };
  const k0 = batches(undefined),
    k1 = batches("twin"),
    k2 = batches("slow");
  rows.push({ 改良: "篝火灶 · 双灶", 看什么: "4 批炖菜做完要几分钟", 原来: k0.minutes, 改了: k1.minutes, 变化: pct(k1.minutes, k0.minutes) });
  rows.push({ 改良: "篝火灶 · 慢火", 看什么: "4 批炖菜出几份（8 个土豆）", 原来: k0.made, 改了: k2.made, 变化: pct(k2.made, k0.made) });
  rows.push({ 改良: "篝火灶 · 慢火", 看什么: "做完要几分钟（代价）", 原来: k0.minutes, 改了: k2.minutes, 变化: pct(k2.minutes, k0.minutes) });
  // 雨水桶
  const rb = put(e, "rain", 560, 640);
  const s0 = e.barrelStore(rb),
    m0 = e.barrelMade(rb, true, false),
    d0 = e.barrelMade(rb, false, false);
  rb.hnUp = "big";
  const s1 = e.barrelStore(rb);
  rb.hnUp = "filter";
  const m1 = e.barrelMade(rb, true, false),
    d1 = e.barrelMade(rb, false, false);
  rows.push({ 改良: "雨水桶 · 大桶", 看什么: "一个桶能存几份水", 原来: s0, 改了: s1, 变化: pct(s1, s0) });
  rows.push({ 改良: "雨水桶 · 滤网", 看什么: "下雨天一个桶出几份水", 原来: m0, 改了: m1, 变化: pct(m1, m0) });
  rows.push({ 改良: "雨水桶 · 滤网", 看什么: "不下雨的日子", 原来: d0, 改了: d1, 变化: pct(d1, d0) });
  console.table(rows);
  const ok = rows.filter((r) => !["不下雨的日子", "做完要几分钟（代价）"].includes(r.看什么)).every((r) => Math.abs(parseInt(r.变化)) >= 5);
  console.log("在它管的那件事上变化 5% 以上：" + (ok ? "过" : "没过"));
}
