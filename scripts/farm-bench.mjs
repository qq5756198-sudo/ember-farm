// 种田台（v0.26 起放进仓库；营地设施体检时写的）：种田与小设施的对照实验，用正式代码，不改规则。
// 每个场景同一个种子跑 DAYS 天：机器人每天 08:00、16:00 各把 18 块田过一遍（收、拔草、捉虫、开垦、播种、浇水、照看），
// 22:00 睡觉；只推进游戏时间（不跑画面帧，所以没有感染者来打扰）。
// 记：收成值多少钱（按卖价）、每样动作做了几次、乌鸦啄了几块、居民干了几个钟头。
// 用法：node scripts/farm-bench.mjs [场景,场景] [种子,种子] [天数]；MODE=busy 是“忙的玩家”
// v0.26：罐装机、鱼篓、摊位不再建造，对应的三个场景去掉；加班改成签法令「加班周」（农舍的政策跟着法令走）
// v0.27：水网。net = 水井 + 两个雨水桶（平时一天 18 份水）；droughtRes / droughtNo = 水井 + 挖通的水渠（蓄水 / 排水）+ 一个喷灌头，
// 第 20–22 天连着三天高温（水渠只出 4 份），这两个场景机器人只给刚种下的浇水，别的全靠水网；
// dry = 同样的水井、水渠蓄水和喷灌头，但不来旱季（当参照）。灌溉站改成喷灌头：开着、水网有水时它一个钟点内会浇到的田，机器人不自己浇。
// 机器人碰到巨型作物就锄三下。
// DIST=别的 dist 目录：拿同一个脚本去跑旧版本对照
const D = process.env.DIST ? new URL("file://" + process.env.DIST.replace(/\/?$/, "/")).href : new URL("../dist/", import.meta.url).href;
const { Engine, freshState } = await import(D + "campaign.js");
const { ITEMS, CROPS, BUILDINGS } = await import(D + "data.js");
const { PROJECTS } = await import(D + "expansion-data.js");

const ALL = ["base", "noWell", "rain", "tower", "irrig", "green", "drone", "scare", "auto", "coop", "coopFodder", "farmer", "farmer3", "ot3", "ot3room", "net", "dry", "droughtRes", "droughtNo", "droneNet", "droneFarmer"];
const DROUGHT = [20, 21, 22];
const NET_ONLY = ["dry", "droughtRes", "droughtNo"];
const SC = (process.argv[2] || ALL.join(",")).split(",");
const SEEDS = (process.argv[3] || "1,2,3").split(",").map(Number);
const DAYS = Number(process.argv[4] || 30);
// MODE=diligent：一天两趟（08:00、16:00），每块都照看；MODE=busy：只在 08:00 过一趟、不照看（白天出门）
const MODE = process.env.MODE || "diligent";
const ACTIVE = Array.from({ length: 18 }, (_, i) => i); // 两排：y=448、488，x=335…655
const CROP_IDS = Object.keys(CROPS);
const ROT = { potato: "seedBean", bean: "seedTomato", tomato: "seedPotato" };

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
const cropValue = (e) => {
  let v = 0;
  for (const c of CROP_IDS)
    for (const id of [c, "fine_" + c, "hardy_" + c]) {
      const n = (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);
      if (n && ITEMS[id]) v += n * (ITEMS[id].sell || 0);
    }
  return v;
};
const itemCount = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);

function setup(seed, sc) {
  Math.random = seeded(seed * 7919 + 13);
  const e = new Engine(freshState(), () => {});
  if (e.feel?.open) e.feel.open.phase = "done";
  e.sc.flags.well = sc !== "noWell";
  e.s.day = 8;
  e.s.minute = 480;
  e.s.stats.hordes = 0;
  e.c.nextHordeDay = 0;
  if (e.g) e.g.seed = 1000 + seed;
  Object.assign(e.s.storage, { seedPotato: 400, seedBean: 400, seedTomato: 400, bread: 300, wood: 200, scrap: 100, parts: 60, cloth: 60 });
  e.s.player.x = 495;
  e.s.player.y = 520;
  const X = { e, sc, A: { harvest: 0, weed: 0, bugs: 0, hoe: 0, plant: 0, water: 0, refill: 0, tend: 0, other: 0 }, workHours: 0, stallMoney: 0, stallSold: 0, extraValue: 0, shipRef: 0, netMissed: 0, netMade: 0, netDays: 0, droughtMissed: 0 };
  // droneNet = 照看机 + 两个雨水桶（水网有水给它浇）；droneFarmer = 照看机 + 一个种地的居民
  const has = (k) => sc === k || (sc === "auto" && ["tower", "irrig", "drone", "scare"].includes(k)) || (["droneNet", "droneFarmer"].includes(sc) && k === "drone");
  if (sc === "droneNet") {
    put(e, "rain", 400, 640);
    put(e, "rain", 600, 640);
  }
  if (has("rain")) put(e, "rain", 495, 405);
  if (has("tower")) e.c.projects.water = PROJECTS.water.stages.length;
  if (has("irrig")) {
    put(e, "rain", 720, 405);
    put(e, "irrigation", 495, 405);
  }
  if (has("green")) put(e, "greenhouse", 495, 395);
  if (has("drone")) {
    put(e, "solar", 760, 560);
    put(e, "drone", 520, 405);
  }
  if (has("scare")) put(e, "scarecrow", 495, 405);
  if (sc === "net") {
    put(e, "rain", 400, 640);
    put(e, "rain", 600, 640);
  }
  if (NET_ONLY.includes(sc)) {
    e.f.canals.dug = [0, 1, 5, 9, 13, 14, 15];
    e.f.canals.open = true;
    e.f.canals.mode = sc === "droughtNo" ? "drain" : "hold";
    put(e, "irrigation", 495, 468);
    // 旱季：这三天按高温出水
    if (sc !== "dry" && e.heat) {
      const heat = e.heat.bind(e);
      e.heat = () => DROUGHT.includes(e.s.day) || heat();
    }
  }
  if (sc === "coop" || sc === "coopFodder") {
    put(e, "coop", 760, 600);
    e.c.animals.chicken = true;
    if (sc === "coop") e.s.storage.corn = 100;
  }
  if (["farmer", "farmer3", "ot3", "ot3room", "droneFarmer"].includes(sc)) {
    const ids = sc === "farmer" || sc === "droneFarmer" ? ["farmer"] : ["farmer", "medic", "mechanic"];
    for (const id of ids) e.recruit(id);
    e.c.autoMeals = true;
    if (ids.length > 1) {
      put(e, "bed", 700, 330);
      put(e, "bed", 760, 330);
    }
    for (const r of e.c.residents) r.priorities = { farmer: 1, mechanic: 0, medic: 0, guard: 0 };
    if (sc.startsWith("ot")) {
      e.w.decrees = ["overtime"];
      e.syncPolicy?.();
    }
    if (sc === "ot3room") {
      put(e, "floor", 640, 330);
      put(e, "chair", 620, 320);
      put(e, "lamp", 660, 320);
    }
  }
  X.v0 = cropValue(e);
  X.m0 = e.s.money;
  return X;
}

function refill(X) {
  const e = X.e;
  const rain = e.s.buildings.find((b) => b.type === "rain" && b.hp > 0);
  const spot = rain ? { x: rain.x + 30, y: rain.y + 20 } : { x: 880, y: 330 };
  e.s.player.x = spot.x;
  e.s.player.y = spot.y;
  if (e.refillWater()) X.A.refill++;
}
function routine(X) {
  const e = X.e,
    A = X.A;
  e.paused = false;
  const planted = new Set();
  for (const i of ACTIVE) {
    const p = e.s.plots[i];
    e.s.player.x = p.x + 18;
    e.s.player.y = p.y + 6;
    e.s.player.stamina = 100;
    e.s.player.hunger = Math.max(e.s.player.hunger, 70);
    e.gClock = (e.gClock || 0) + 1.2; // 走到下一块田、按 E 大约 1.2 秒（连收要 3 秒内）
    // v0.27：巨型作物锄三下
    while (e.giantOf?.(p) && e.giantHit(p)) A.harvest++;
    if (p.crop && p.growth >= CROPS[p.crop].grow && e.handHarvest(p)) A.harvest++;
    if (e.g?.plots[p.id]?.w && e.pullWeed(p)) A.weed++;
    if (e.g?.plots[p.id]?.b && e.catchBugs(p)) A.bugs++;
    if ((e.plotDebris(p) || !p.tilled) && e.toolPlot(p, "hoe")) A.hoe++;
    if (e.g?.plots[p.id]?.w && e.pullWeed(p)) A.weed++;
    if (!p.crop && p.tilled) {
      const seed = ROT[p.lastCrop] || "seedPotato";
      if (!e.s.inventory[seed]) {
        e.s.inventory[seed] = 20;
        e.s.storage[seed] -= 20;
      }
      if (e.toolPlot(p, seed)) {
        A.plant++;
        planted.add(p.id);
      }
    }
    // 一小时内灌溉站（v0.27 起是喷灌头，要水网里有水）会浇到的，不自己浇（聪明的玩家）；
    // v0.27：种地的居民在干活、照看机有电又有水网的水时也不自己浇（它们一个钟点内会浇）
    const helpers = !!e.bt && e.c.residents.some((r) => (r.priorities?.farmer || 0) > 0 && e.residentActive(r));
    const thirsty = e.s.plots.filter((q) => q.crop && !e.plotWatered(q)).length;
    const drone = !!e.bt && (e.c.energy || 0) >= thirsty && e.bt.net.pool >= thirsty && e.s.buildings.some((b) => b.type === "drone" && b.hp > 0 && Math.hypot(b.x - p.x, b.y - p.y) < 300);
    const irrigated = helpers || drone || e.s.buildings.some((b) => b.type === "irrigation" && b.hp > 0 && Math.hypot(b.x - p.x, b.y - p.y) < 300 && e.irrigationConnected(b) && (!e.bt || e.bt.net.pool > 0));
    if (p.crop && !e.plotWatered(p) && !irrigated && (!NET_ONLY.includes(X.sc) || planted.has(p.id))) {
      if ((e.c.water || 0) < 1) {
        refill(X);
        e.s.player.x = p.x + 18;
        e.s.player.y = p.y + 6;
      }
      if (e.toolPlot(p, "water")) A.water++;
    }
    if (MODE !== "busy" && p.crop && e.g?.plots[p.id]?.t !== e.s.day && e.tend(p)) A.tend++;
  }
}
function chores(X, sc) {
  const e = X.e,
    A = X.A;
  if (sc === "coop" || sc === "coopFodder") {
    e.s.player.x = 760;
    e.s.player.y = 650;
    const before = itemCount(e, "egg");
    if (e.collectAnimals()) A.other++;
    X.extraValue += (itemCount(e, "egg") - before) * ITEMS.egg.sell;
    const corn = itemCount(e, "corn"),
      fodder = itemCount(e, "fodder");
    if (e.feedAnimals()) {
      A.other++;
      X.feedCost = (X.feedCost || 0) + (corn - itemCount(e, "corn")) * ITEMS.corn.sell + (fodder - itemCount(e, "fodder")) * ITEMS.fodder.sell;
    }
  }
}
function hour(X) {
  const e = X.e;
  e.advanceMinutes(60);
  if (e.dy) e.dy.pending = null;
  X.workHours += e.c.residents.filter((r) => r.workRole && r.workRole !== "rest").length;
}

const out = [];
for (const sc of SC) {
  const rows = [];
  for (const seed of SEEDS) {
    const X = setup(seed, sc),
      e = X.e,
      errors = [];
    const start = e.s.day;
    try {
      for (let d = 0; d < DAYS; d++) {
        if (e.dy) e.dy.pending = null;
        if (NET_ONLY.includes(sc) && DROUGHT.includes(e.s.day) && sc !== "dry") e.s.weather = "高温";
        // 水网的账：今天出了多少、到早上几块没浇上
        if (e.bt && e.bt.net.day === e.s.day) {
          X.netMade += e.bt.net.made;
          X.netMissed += e.bt.net.missed;
          X.netDays++;
          if (DROUGHT.includes(e.s.day)) X.droughtMissed += e.bt.net.missed;
        }
        const m0 = e.s.money;
        routine(X);
        chores(X, sc);
        while (e.s.minute < 960) hour(X);
        if (MODE !== "busy") routine(X);
        while (e.s.minute < 1320) hour(X);
        if (sc === "stall") X.stallMoney += 0;
        const today = e.s.day;
        if (!e.sleep()) e.advanceMinutes(1440 - e.s.minute + 480);
        if (e.s.day === today) errors.push("no sleep day " + today);
        if (sc === "stall") X.stallMoney += e.s.money - m0;
      }
    } catch (err) {
      errors.push(String(err.stack || err).split("\n").slice(0, 3).join(" | "));
    }
    const days = e.s.day - start;
    const acts = Object.values(X.A).reduce((a, b) => a + b, 0);
    rows.push({
      seed,
      days,
      cropPerDay: Math.round((cropValue(e) - X.v0) / days),
      extraPerDay: Math.round((X.extraValue - (X.feedCost || 0)) / days),
      stallPerDay: Math.round(X.stallMoney / days),
      shipRefPerDay: Math.round(X.shipRef / days),
      actsPerDay: +(acts / days).toFixed(1),
      A: Object.fromEntries(Object.entries(X.A).map(([k, v]) => [k, +(v / days).toFixed(1)])),
      pecked: e.g?.stats.pecked || 0,
      fine: e.g?.stats.fine || 0,
      workHoursPerDay: +(X.workHours / days).toFixed(1),
      fatigue: e.c.residents.map((r) => Math.round(r.fatigue || 0)),
      energy: e.c.energy,
      netMadePerDay: X.netDays ? +(X.netMade / X.netDays).toFixed(1) : 0,
      netMissedPerDay: X.netDays ? +(X.netMissed / X.netDays).toFixed(2) : 0,
      droughtMissed: X.droughtMissed,
      field: e.bt ? { raids: e.bt.stats.raids, trampled: e.bt.stats.trampled, stolen: e.bt.stats.stolen, regrow: e.bt.stats.regrow, giants: e.bt.stats.giants, hybrids: e.bt.stats.hybrids, giantValue: Math.round(Object.keys(ITEMS).filter((id) => id.startsWith("giant_")).reduce((v, id) => v + itemCount(e, id) * ITEMS[id].sell, 0) / days) } : null,
      errors,
    });
  }
  const avg = (k) => Math.round(rows.reduce((a, r) => a + r[k], 0) / rows.length);
  out.push({ sc, cropPerDay: avg("cropPerDay"), extraPerDay: avg("extraPerDay"), stallPerDay: avg("stallPerDay"), shipRefPerDay: avg("shipRefPerDay"), actsPerDay: +(rows.reduce((a, r) => a + r.actsPerDay, 0) / rows.length).toFixed(1), netMadePerDay: +(rows.reduce((a, r) => a + r.netMadePerDay, 0) / rows.length).toFixed(1), droughtMissed: +(rows.reduce((a, r) => a + r.droughtMissed, 0) / rows.length).toFixed(1), rows });
}
console.log(JSON.stringify({ MODE, DAYS, seeds: SEEDS, out }, null, 1));
