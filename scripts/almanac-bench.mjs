// 四时台（v0.29 起）：用正式代码看「四时」这一版有没有过方案的线。DIST=别的 dist 目录：拿同一个脚本去跑旧版本对照。
//
// 1) 种田一年：node scripts/almanac-bench.mjs farm [种子,种子] [天数]
//    从第 1 天起过一年（28 天，四个时节各 7 天）。机器人和种田台（farm-bench）一样勤快：每天 08:00、16:00 把 18 块田过一遍
//    （收、拔草、捉虫、开垦、播种、浇水、照看），22:00 睡觉。三种种法：
//      照老办法：土豆 → 豆子 → 番茄轮着种，不看时节
//      按时节：土豆、豆子、番茄、玉米、药草里挑「一小时值多少钱 × 这一季的长势」最高的，和上一茬一样就换第二好的（换茬照料分 +10）
//      按时节 + 提质肥：同上，每天早上有 1 袋提质肥（一个堆肥桶一天出一袋），施在刚种下的当季那块田上
//    另跑一种「挑值钱的」：和按时节一样挑，只是不看时节（拆开看两件事各占多少）。
//    记：收成值多少钱（按卖价，上品照上品算），收了几次，几次收成里出了上品（primeShare，按收的次数算），优质占多少份。
//    方案的线：照老办法的一年收入和 v0.28.0 差 5% 以内；按时节种的多 8–15%；勤快玩家 8–15% 的收成是上品。
//
// 2) 鸡舍：node scripts/almanac-bench.mjs herd [种子,种子] [天数]
//    鸡舍里有鸡和山羊，每天 08:00 喂、12:00 领。只喂 / 喂 + 每天摸一摸、梳梳毛 + 放鸡下地吃虫（10:00–16:00）。
//    方案的线：照顾好的鸡舍产出（鸡蛋、羊奶按卖价）多 20–30%。
//
// 3) 夜里的好事：node scripts/almanac-bench.mjs night [天数]
//    平安的晚上（没循声来的、没夜袭、不是长夜）出好事的比例，四种各多少。方案的线：平均 25 晚出一件。
const D = process.env.DIST ? new URL("file://" + process.env.DIST.replace(/\/?$/, "/")).href : new URL("../dist/", import.meta.url).href;
const { Engine, freshState } = await import(D + "campaign.js");
const { ITEMS, CROPS, BUILDINGS } = await import(D + "data.js");
let AL = null;
try {
  AL = await import(D + "almanac-data.js");
} catch {
  AL = null; // v0.28 以前没有
}

const MODE = process.argv[2] || "farm";
const SEEDS = (process.argv[3] || "1,2,3,4,5,6").split(",").map(Number);
const DAYS = Number(process.argv[4] || 28);
const ACTIVE = Array.from({ length: 18 }, (_, i) => i);
const ROT = { potato: "seedBean", bean: "seedTomato", tomato: "seedPotato" };
const POOL = ["potato", "bean", "tomato", "corn", "herb"];

function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const put = (e, type, x, y, extra = {}) => {
  const b = { id: "bench-" + type + "-" + e.s.idCounter++, type, x, y, rotation: 0, hp: BUILDINGS[type].hp, ...extra };
  e.s.buildings.push(b);
  e.navRevision = (e.navRevision || 0) + 1;
  return b;
};
const itemCount = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);
const CROP_IDS = Object.keys(CROPS);
const cropValue = (e) => {
  let v = 0;
  for (const c of CROP_IDS)
    for (const id of [c, "fine_" + c, "hardy_" + c, "prime_" + c]) {
      const n = itemCount(e, id);
      if (n && ITEMS[id]) v += n * (ITEMS[id].sell || 0);
    }
  return v;
};
const units = (e, prefix) => CROP_IDS.reduce((a, c) => a + itemCount(e, prefix + c), 0);

function setup(seed) {
  Math.random = seeded(seed * 7919 + 13);
  const st = freshState();
  if (st.undertow) st.undertow.seed = 4000 + seed;
  const e = new Engine(st, () => {});
  if (e.feel?.open) e.feel.open.phase = "done";
  e.sc.flags.well = true;
  e.s.minute = 480;
  e.s.stats.hordes = 0;
  e.c.nextHordeDay = 0;
  if (e.g) e.g.seed = 1000 + seed;
  const seeds = Object.fromEntries(POOL.map((c) => [CROPS[c].seed, 400]));
  Object.assign(e.s.storage, seeds, { bread: 300, wood: 200, scrap: 100, parts: 60, cloth: 60, corn: 0 });
  e.s.player.x = 495;
  e.s.player.y = 520;
  return e;
}
// 按时节挑种子
function seasonPick(e, p, blind = false) {
  const rate = (c) => (e.seasonKind && !blind ? ({ good: AL.SEASON_RATE.good, bad: AL.SEASON_RATE.bad }[e.seasonKind(c)] || 1) : 1);
  const score = (c) => ((CROPS[c].yield * ITEMS[c].sell) / CROPS[c].grow) * rate(c);
  const ranked = [...POOL].sort((a, b) => score(b) - score(a));
  const best = ranked.find((c) => c !== p.lastCrop) || ranked[0];
  return CROPS[best].seed;
}
function routine(e, X, how) {
  const A = X.A;
  e.paused = false;
  for (const i of ACTIVE) {
    const p = e.s.plots[i];
    e.s.player.x = p.x + 18;
    e.s.player.y = p.y + 6;
    e.s.player.stamina = 100;
    e.s.player.hunger = Math.max(e.s.player.hunger, 70);
    e.gClock = (e.gClock || 0) + 1.2;
    while (e.giantOf?.(p) && e.giantHit(p)) A.harvest++;
    if (p.crop && p.growth >= CROPS[p.crop].grow) {
      // HIST=1：记下收获那一刻的照料分和时节（看上品的门槛放在哪）
      if (process.env.HIST && e.careScore) X.hist.push([Math.floor(e.careScore(p) / 10) * 10, e.seasonKind?.(p.crop) || "-", e.bt?.plots?.[p.id]?.fz || ""]);
      const before = { prime: units(e, "prime_"), fine: units(e, "fine_"), all: CROP_IDS.reduce((a, c) => a + itemCount(e, c) + itemCount(e, "fine_" + c) + itemCount(e, "hardy_" + c) + itemCount(e, "prime_" + c), 0) };
      if (e.handHarvest(p)) {
        A.harvest++;
        const all = CROP_IDS.reduce((a, c) => a + itemCount(e, c) + itemCount(e, "fine_" + c) + itemCount(e, "hardy_" + c) + itemCount(e, "prime_" + c), 0);
        X.units += all - before.all;
        X.prime += units(e, "prime_") - before.prime;
        X.fine += units(e, "fine_") - before.fine;
        X.events++;
        if (units(e, "prime_") > before.prime) X.primeEvents++;
      }
    }
    if (e.g?.plots[p.id]?.w && e.pullWeed(p)) A.weed++;
    if (e.g?.plots[p.id]?.b && e.catchBugs(p)) A.bugs++;
    if ((e.plotDebris(p) || !p.tilled) && e.toolPlot(p, "hoe")) A.hoe++;
    if (e.g?.plots[p.id]?.w && e.pullWeed(p)) A.weed++;
    if (!p.crop && p.tilled) {
      const seed = how === "classic" ? ROT[p.lastCrop] || "seedPotato" : seasonPick(e, p, how === "value" || !e.seasonKind);
      if (!e.s.inventory[seed]) {
        e.s.inventory[seed] = 20;
        e.s.storage[seed] -= 20;
      }
      if (e.toolPlot(p, seed)) {
        A.plant++;
        // 一天一袋提质肥：施在刚种下的、当季的那块田
        if (how === "prime" && X.fert > 0 && e.seasonKind?.(p.crop) === "good") {
          e.s.storage.fertCare = (e.s.storage.fertCare || 0) + 1;
          if (!e.fertReason(p, "care") && e.applyFert(p, "care")) X.fert--;
          else e.s.storage.fertCare--;
        }
      }
    }
    if (p.crop && !e.plotWatered(p)) {
      if ((e.c.water || 0) < 1) {
        e.s.player.x = 880;
        e.s.player.y = 330;
        e.refillWater();
        e.s.player.x = p.x + 18;
        e.s.player.y = p.y + 6;
      }
      if (e.toolPlot(p, "water")) A.water++;
    }
    if (p.crop && e.g?.plots[p.id]?.t !== e.s.day && e.tend(p)) A.tend++;
  }
}
function farmRun(seed, how) {
  const e = setup(seed),
    X = { A: { harvest: 0, weed: 0, bugs: 0, hoe: 0, plant: 0, water: 0, tend: 0 }, units: 0, prime: 0, fine: 0, fert: 0, events: 0, primeEvents: 0, errors: [], hist: [] };
  const v0 = cropValue(e),
    start = e.s.day;
  try {
    for (let d = 0; d < DAYS; d++) {
      if (e.dy) e.dy.pending = null;
      X.fert = how === "prime" ? 1 : 0;
      routine(e, X, how);
      while (e.s.minute < 960) e.advanceMinutes(60);
      if (e.dy) e.dy.pending = null;
      routine(e, X, how);
      while (e.s.minute < 1320) e.advanceMinutes(60);
      const today = e.s.day;
      if (!e.sleep()) e.advanceMinutes(1440 - e.s.minute + 480);
      if (e.s.day === today) X.errors.push("no sleep " + today);
    }
  } catch (err) {
    X.errors.push(String(err.stack || err).split("\n").slice(0, 3).join(" | "));
  }
  const days = e.s.day - start;
  if (process.env.HIST) {
    const h = {};
    for (const [c, k, f] of X.hist) h[c + "/" + k + (f ? "/" + f : "")] = (h[c + "/" + k + (f ? "/" + f : "")] || 0) + 1;
    console.error(how + " seed " + seed + " " + JSON.stringify(Object.fromEntries(Object.entries(h).sort())));
  }
  return { seed, days, perDay: Math.round((cropValue(e) - v0) / days), harvests: +(X.A.harvest / days).toFixed(1), units: X.units, prime: X.events ? +((100 * X.primeEvents) / X.events).toFixed(1) : 0, fine: X.units ? +((100 * X.fine) / X.units).toFixed(1) : 0, errors: X.errors };
}

if (MODE === "farm") {
  const out = {};
  // value：和按时节一样挑一小时最值钱的，但不看时节（拆开看“挑值钱的菜”和“看时节”各占多少）
  for (const how of AL ? ["classic", "value", "season", "prime"] : ["classic", "value"]) {
    const rows = SEEDS.map((s) => farmRun(s, how));
    out[how] = {
      perDay: Math.round(rows.reduce((a, r) => a + r.perDay, 0) / rows.length),
      harvestsPerDay: +(rows.reduce((a, r) => a + r.harvests, 0) / rows.length).toFixed(1),
      primeShare: +(rows.reduce((a, r) => a + r.prime, 0) / rows.length).toFixed(1),
      fineShare: +(rows.reduce((a, r) => a + r.fine, 0) / rows.length).toFixed(1),
      rows,
    };
  }
  console.log(JSON.stringify({ dist: D, DAYS, seeds: SEEDS, out }, null, 1));
  if (AL) {
    const c = out.classic.perDay,
      s = out.season.perDay;
    const v = out.value.perDay;
    console.log("按时节比照老办法：" + (((s - c) / c) * 100).toFixed(1) + "%（其中挑值钱的菜 " + (((v - c) / c) * 100).toFixed(1) + "%，看时节 " + (((s - v) / v) * 100).toFixed(1) + "%）；上品占收成的 " + out.season.primeShare + "%（按时节）、" + out.prime.primeShare + "%（按时节 + 每天一袋提质肥）、" + out.classic.primeShare + "%（照老办法）");
  }
}

// ================= 鸡舍 =================
function herdRun(seed, cared) {
  const e = setup(seed);
  const coop = put(e, "coop", 760, 600);
  e.c.animals.chicken = true;
  e.c.animals.goat = true;
  e.s.storage.corn = 400;
  void coop;
  let value = 0;
  const start = e.s.day;
  for (let d = 0; d < DAYS; d++) {
    if (e.dy) e.dy.pending = null;
    e.paused = false;
    Object.assign(e.s.player, { x: 760, y: 650 });
    e.feedAnimals();
    if (cared) {
      e.herdPet?.("flock");
      e.herdPet?.("goat");
    }
    while (e.s.minute < 600) e.advanceMinutes(60);
    if (cared && e.releaseChickens) e.releaseChickens();
    while (e.s.minute < 720) e.advanceMinutes(60);
    Object.assign(e.s.player, { x: 760, y: 650 });
    const eggs = itemCount(e, "egg"),
      milk = itemCount(e, "milk");
    e.collectAnimals();
    value += (itemCount(e, "egg") - eggs) * (ITEMS.egg?.sell || 0) + (itemCount(e, "milk") - milk) * (ITEMS.milk?.sell || 0);
    while (e.s.minute < 960) e.advanceMinutes(60);
    if (cared && e.recallChickens) e.recallChickens();
    while (e.s.minute < 1320) e.advanceMinutes(60);
    if (!e.sleep()) e.advanceMinutes(1440 - e.s.minute + 480);
  }
  return { seed, perDay: +(value / (e.s.day - start)).toFixed(1), flock: e.al?.herd.flock.pts ?? null, goat: e.al?.herd.goat.pts ?? null };
}
if (MODE === "herd") {
  const fed = SEEDS.map((s) => herdRun(s, false)),
    cared = SEEDS.map((s) => herdRun(s, true));
  const avg = (rs) => +(rs.reduce((a, r) => a + r.perDay, 0) / rs.length).toFixed(1);
  console.log(JSON.stringify({ dist: D, DAYS, fed: avg(fed), cared: avg(cared), rows: { fed, cared } }, null, 1));
  console.log("照顾好的鸡舍产出多 " + (((avg(cared) - avg(fed)) / avg(fed)) * 100).toFixed(1) + "%");
}

// ================= 夜里的好事 =================
if (MODE === "night") {
  const N = Number(process.argv[3] || 3000);
  const e = setup(1);
  e.s.visited = { residential: true, hospital: true, warehouse: true };
  const kinds = {};
  let n = 0;
  for (let d = 2; d < N + 2; d++) {
    if (e.alRoll("good", d) >= AL.NIGHT_GOOD.chance) continue;
    n++;
    const k = AL.NIGHT_GOOD.kinds[Math.floor(e.alRoll("goodk", d) * AL.NIGHT_GOOD.kinds.length) % AL.NIGHT_GOOD.kinds.length];
    kinds[k] = (kinds[k] || 0) + 1;
  }
  console.log(JSON.stringify({ nights: N, good: n, every: +(N / n).toFixed(1), kinds }));
}
