// 菜地台（v0.27 起）：一个勤快的玩家从新开局种 30 天菜，看「丰年」这一轮的东西多久碰得到、每天有几件要拿主意的事。
// 27 块田（前三排）：两块 2×2 留着长巨型（萝卜、土豆），每块都挨着能“提质”的棉花或南瓜（照料分 65 + 15 = 80）；
// 这两块熟了先不收，等清晨长成巨型（熟了三天还没长成就收了重种），其余混着种；第四排开垦了空着，挨着的不同作物会在那里杂交；
// 一个堆肥桶、一个鸡舍（有鸡）、旧水井 + 两个雨水桶 + 一个喷灌头。机器人每天 08:00、16:00 各过一遍田，20:00 看一眼夜袭，22:00 睡觉；
// 订单板能交就交，交不了又快到期的撕掉；天灾前一天抢收长过七成的；鸡白天放出去。
// 记：第一次收获在开局后几个游戏小时、第一棵巨型在第几天、杂交苗、神秘种子拆出来的、图鉴集齐几行、订单交了几张，
// 夜袭、偷菜、天灾打坏的，以及每天要拿主意的事（订单、天灾抢收、巨型、杂交苗、夜袭、堆肥换肥、放鸡）。
// 用法：node scripts/garden-bench.mjs [种子,种子] [天数]
const D = new URL("../dist/", import.meta.url).href;
const { Engine, newGameState } = await import(D + "campaign.js");
const { ITEMS, CROPS, BUILDINGS } = await import(D + "data.js");
const { STORM, ORDERS } = await import(D + "bounty-data.js");

const SEEDS = (process.argv[2] || "1,2,3").split(",").map(Number);
const DAYS = Number(process.argv[3] || 30);
// 每块田种什么（下标 = 田的编号）
const LAYOUT = [
  "radish", "cotton", "cotton", "tomato", "bean", "cotton", "cotton", "corn", "herb",
  "bean", "radish", "radish", "tomato", "corn", "potato", "potato", "bean", "tomato",
  "pumpkin", "radish", "radish", "pumpkin", "pumpkin", "potato", "potato", "pumpkin", "herb",
];
const GIANT_PLOTS = new Set([10, 11, 19, 20, 14, 15, 23, 24]);

function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const put = (e, type, x, y) => {
  const b = { id: "gb-" + type + "-" + e.s.idCounter++, type, x, y, rotation: 0, hp: BUILDINGS[type].hp };
  e.s.buildings.push(b);
  e.navRevision = (e.navRevision || 0) + 1;
  return b;
};
const stock = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);

function run(seed) {
  Math.random = seeded(seed * 104729 + 7);
  const e = new Engine(newGameState("farmer"), () => {});
  if (e.feel?.open) e.feel.open.phase = "done";
  e.markGearIntro?.();
  e.g.seed = 5000 + seed;
  e.ut.seed = 9000 + seed;
  e.s.stats.hordes = 0;
  e.c.nextHordeDay = 0;
  e.sc.flags.well = true;
  Object.assign(e.s.storage, { bread: 300, wood: 200, scrap: 60, cloth: 30, parts: 20, fodder: 120 });
  // 第四排开垦好空着（给杂交苗留地方）
  for (let i = 27; i < 36; i++) {
    const q = e.s.plots[i];
    e.s.debris = e.s.debris.filter((d) => Math.hypot(d.x - q.x, d.y - q.y) >= 15);
    q.tilled = true;
  }
  for (const c of new Set(LAYOUT)) e.s.storage[CROPS[c].seed] = 300;
  put(e, "rain", 400, 650);
  put(e, "rain", 620, 650);
  put(e, "irrigation", 495, 560);
  const bin = put(e, "compost", 720, 640);
  put(e, "coop", 760, 600);
  e.c.animals.chicken = true;
  const start = e.absNow();
  const R = { firstHarvest: null, firstGiantDay: null, firstHybridDay: null, mystery: {}, choices: 0, perDay: [], errors: [], harvests: 0, giantHits: 0, rushed: 0, ordersDone: 0, tore: 0 };
  const choice = (n = 1) => (R.choices += n);
  const plots = LAYOUT.map((_, i) => e.s.plots[i]);
  const clear = (p) => {
    e.s.debris = e.s.debris.filter((d) => Math.hypot(d.x - p.x, d.y - p.y) >= 15);
    if (!p.tilled) e.toolPlot(p, "hoe");
  };
  const at = (p) => Object.assign(e.s.player, { x: p.x + 18, y: p.y + 6, stamina: 100, hunger: Math.max(e.s.player.hunger, 70) });
  // 过一遍田之前把背包里的收成放进仓库（玩家会顺手这么做）
  const deposit = () => {
    for (const [id, n] of Object.entries(e.s.inventory)) {
      const it = ITEMS[id];
      if (!it || it.protected || ["tool", "weapon", "seed"].includes(it.type) || !n) continue;
      e.s.storage[id] = (e.s.storage[id] || 0) + n;
      delete e.s.inventory[id];
    }
  };
  const visit = () => {
    e.paused = false;
    deposit();
    // 第四排冒出来的杂交苗：浇水，熟了收
    for (let i = 27; i < 36; i++) {
      const q = e.s.plots[i];
      if (q.crop !== "hybrid") continue;
      at(q);
      if (q.growth >= CROPS.hybrid.grow) e.handHarvest(q);
      else if (!e.plotWatered(q)) {
        if ((e.c.water || 0) < 2) {
          Object.assign(e.s.player, { x: 430, y: 670 });
          e.refillWater();
          at(q);
        }
        e.toolPlot(q, "water");
      }
    }
    for (const [i, p] of plots.entries()) {
      at(p);
      e.gClock = (e.gClock || 0) + 1.2;
      clear(p);
      while (e.giantOf(p) && e.giantHit(p)) R.giantHits++;
      const waiting = GIANT_PLOTS.has(i) && p.crop && p.growth >= CROPS[p.crop].grow && e.absNow() - (e.bt.plots[p.id]?.ra || e.absNow()) < 3 * 1440;
      if (!waiting && p.crop && p.growth >= CROPS[p.crop].grow && e.handHarvest(p)) {
        R.harvests++;
        if (R.firstHarvest === null) R.firstHarvest = Math.round((e.absNow() - start) / 60);
      }
      if (e.g.plots[p.id]?.w) e.pullWeed(p);
      if (e.g.plots[p.id]?.b) e.catchBugs(p);
      if (!p.crop && p.tilled && !e.plotDebris(p)) {
        // 有神秘种子包时先种一包，看拆出来什么
        if (stock(e, "seedMystery") > 0 && !GIANT_PLOTS.has(i)) {
          const before = p.crop;
          if (e.plantMystery(p.id) && p.crop !== before) {
            const k = CROPS[p.crop].variety ? "新品种" : p.trait ? "带特性" : "普通";
            R.mystery[k] = (R.mystery[k] || 0) + 1;
            choice();
          }
        } else {
          // 巨型那两块：地太瘦先埋草
          const crop = LAYOUT[i];
          for (let k = 0; k < 3 && GIANT_PLOTS.has(i) && (p.fertility ?? 65) < 70 && !e.fodderReason(p); k++) e.fodderSoil(p);
          const seed = CROPS[crop].seed;
          if (!e.s.inventory[seed]) {
            e.s.inventory[seed] = 10;
            e.s.storage[seed] -= 10;
          }
          e.toolPlot(p, seed);
        }
      }
      if (p.crop && !e.plotWatered(p)) {
        if ((e.c.water || 0) < 2) {
          Object.assign(e.s.player, { x: 430, y: 670 });
          e.refillWater();
          at(p);
        }
        e.toolPlot(p, "water");
      }
      if (p.crop && e.g.plots[p.id]?.t !== e.s.day) e.tend(p);
      // 肥：巨型那两块施提质肥，其余有快长肥就施
      if (i % 9 === 0) deposit();
      if (p.crop && p.crop !== "hybrid" && !e.bt.plots[p.id]?.fz && p.growth < CROPS[p.crop].grow) {
        if (GIANT_PLOTS.has(i) && stock(e, "fertCare")) e.applyFert(p, "care");
        else if (!GIANT_PLOTS.has(i) && stock(e, "fertGrow")) e.applyFert(p, "grow");
      }
      // 天灾前一天：长过七成的抢收
      if (e.bt.storm.day === e.s.day + 1 && e.bt.storm.kind && !e.fieldRushReason(p) && !GIANT_PLOTS.has(i)) {
        if (e.fieldRush(p)) R.rushed++;
      }
    }
  };
  const chores = () => {
    // 堆肥：能丢就丢，满了换着沤
    Object.assign(e.s.player, { x: bin.x, y: bin.y + 30 });
    for (const id of ["fodder", "grub", "manure"]) if (!e.compostReason(bin.id, id) && stock(e, id)) e.compostAdd(bin.id, id, 5);
    if (e.bt.compost[bin.id]?.out) {
      e.compostTake(bin.id);
      const kind = stock(e, "fertCare") < 4 ? "care" : "grow";
      if (e.bt.compost[bin.id].kind !== kind) e.compostKind(bin.id, kind);
      choice();
    }
    // 订单
    e.ordersMorning();
    for (const o of [...e.bt.orders.list]) {
      choice();
      if (!e.orderReason(o)) {
        if (e.deliverBoardOrder(o.id)) R.ordersDone++;
      } else if (o.due <= e.s.day && !e.tearReason(o.id)) {
        e.tearOrder(o.id);
        R.tore++;
      }
    }
    // 放鸡
    if (!e.chickenReason()) {
      e.releaseChickens();
      choice();
    }
  };
  const hour = () => {
    e.advanceMinutes(60);
    if (e.dy) e.dy.pending = null;
  };
  try {
    for (let d = 0; d < DAYS; d++) {
      if (e.dy) e.dy.pending = null;
      const c0 = R.choices;
      while (e.s.minute < 480) hour();
      visit();
      chores();
      while (e.s.minute < 960) hour();
      visit();
      if (e.bt.storm.day === e.s.day + 1 && e.bt.storm.kind) choice();
      while (e.s.minute < 1200) hour();
      if (e.bt.raid.state === "warned" && e.bt.raid.day === e.s.day) {
        choice();
        visit();
      }
      while (e.s.minute < 1320) hour();
      if ((Object.keys(e.bt.giants).length || e.bt.stats.giants) && R.firstGiantDay === null) R.firstGiantDay = e.s.day;
      if (e.bt.stats.hybrids && R.firstHybridDay === null) R.firstHybridDay = e.s.day;
      const today = e.s.day;
      if (!e.sleep()) e.advanceMinutes(1440 - e.s.minute + 480);
      if (e.s.day === today) R.errors.push("no sleep " + today);
      // 早上冒出来的：巨型、杂交苗
      R.choices += Object.keys(e.bt.giants).length ? 1 : 0;
      R.perDay.push(R.choices - c0);
    }
  } catch (err) {
    R.errors.push(String(err.stack || err).split("\n").slice(0, 3).join(" | "));
  }
  const st = e.bt.stats;
  const dexRows = Object.keys(e.bt.dex).filter((c) => e.dexDone(c)).length;
  return {
    seed,
    firstHarvestHours: R.firstHarvest,
    firstGiantDay: R.firstGiantDay,
    firstHybridDay: R.firstHybridDay,
    choicesPerDay: +(R.perDay.reduce((a, b) => a + b, 0) / R.perDay.length).toFixed(1),
    harvests: R.harvests,
    giants: st.giants,
    hybrids: st.hybrids,
    regrow: st.regrow,
    mystery: R.mystery,
    dexRows,
    orders: R.ordersDone,
    tore: R.tore,
    compost: st.compost,
    fert: st.fert,
    eaten: st.eaten,
    pecked: st.pecked,
    raids: st.raids,
    trampled: st.trampled,
    stolen: st.stolen,
    rushed: R.rushed,
    netMade: e.bt.net.log.map((x) => x.made),
    netMissed: e.bt.net.log.reduce((a, x) => a + x.missed, 0),
    money: e.s.money,
    errors: R.errors,
  };
}

const rows = SEEDS.map(run);
const avg = (k) => +(rows.reduce((a, r) => a + (r[k] ?? 0), 0) / rows.length).toFixed(1);
console.log(JSON.stringify({ DAYS, seeds: SEEDS, avg: Object.fromEntries(["firstHarvestHours", "firstGiantDay", "firstHybridDay", "choicesPerDay", "harvests", "giants", "hybrids", "dexRows", "orders", "raids", "trampled", "stolen", "rushed"].map((k) => [k, avg(k)])), rows }, null, 1));
void STORM;
void ORDERS;
