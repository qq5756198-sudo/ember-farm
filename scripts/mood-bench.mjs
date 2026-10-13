// v0.26.0 心情台：三个居民在农场跑 N 天，看心情三档有没有实效、营地平均士气落在哪、来劲多不多。
// 用正式代码，只推进游戏时间（不跑画面帧，所以没有感染者来打扰）；机器人做的事都走正式的接口。
//
// 两部分：
// 1. 干活台：把三个人的士气固定在低落（20）、平常（50）、高昂（85），田一直有活干（每个钟点前把田都弄干），
//    数每人每个钟点干了几件活（照常的一件 + 心情好多干的一件）。过线：高昂比平常多 20% 以上，低落少 30% 以上。
// 2. 营地台：士气照常往“该有的心情”走，两种玩家各跑 N 天：
//    勤快的：三张床、一间布置好的房间、几种饭轮着吃、隔天点歌、每周办节庆、广场两样装饰、营火边陪低落的人聊；
//    忙的：三张床、只吃干粮、不点歌、不办节庆、不聊天；忙+加班：再签上加班周；
//    顾不上的（只看低落那一档会不会出现）：一张床、干粮只够几天、签着配给卡和加班周。
//    过线：勤快的营地平均士气 55–75，忙的 40–60，不会一直满；高昂的人每人每周来劲 0.5–1.5 次。
// 用法：node scripts/mood-bench.mjs [天数] [种子,种子]
const D = new URL("../dist/", import.meta.url).href;
const { Engine, freshState } = await import(D + "campaign.js");
const { BUILDINGS, CROPS } = await import(D + "data.js");
const { TASKS } = await import(D + "rebuild-data.js");
const { MOOD } = await import(D + "tidy-data.js");

const DAYS = Number(process.argv[2] || 30);
const SEEDS = (process.argv[3] || "1,2,3").split(",").map(Number);

function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const put = (e, type, x, y) => {
  const b = { id: "bench-" + type + "-" + e.s.idCounter++, type, x, y, rotation: 0, hp: BUILDINGS[type].hp };
  e.s.buildings.push(b);
  e.navRevision = (e.navRevision || 0) + 1;
  return b;
};
// 主线走到第七段（法令位 4、节庆、电台都开着）
function toAct7(e) {
  const sc = e.sc;
  sc.act = 7;
  sc.claimed = ["act1", "supply", "act2", "act3", "act4", "act5", "act6"];
  sc.choice = "ration";
  sc.letters = ["act1", "act2", "act3", "act4", "act5", "act6", "act7"];
  sc.flags.well = sc.flags.camp = sc.flags.farmerFed = true;
  sc.camp = { x: 560, y: 735 };
  e.r.claimed = TASKS.slice(0, TASKS.findIndex((t) => t.id === "network") + 1).map((t) => t.id);
  e.r.radio = true;
  e.o.hospital = "water";
  e.assignRegion();
}
function setup(seed, kind) {
  Math.random = seeded(seed * 7919 + 13);
  const e = new Engine(freshState(), () => {});
  if (e.feel?.open) e.feel.open.phase = "done";
  if (e.ut) e.ut.seed = 5000 + seed;
  toAct7(e);
  e.s.day = 8;
  e.s.minute = 480;
  e.s.stats.hordes = 0;
  e.c.nextHordeDay = 0;
  e.paused = false;
  for (const id of ["farmer", "medic", "mechanic"]) e.recruit(id);
  for (const r of e.c.residents) r.priorities = { farmer: 1, mechanic: 0, medic: 0, guard: 0 };
  e.c.autoMeals = true;
  put(e, "bed", 700, 330);
  if (kind !== "neglect") put(e, "bed", 760, 330);
  const meals = kind === "diligent" ? { bread: 200, stew: 60, jam: 60, beanMeal: 60 } : kind === "neglect" ? { bread: 40 } : { bread: 400 };
  Object.assign(e.s.storage, meals, { seedPotato: 200, wood: 300, scrap: 60, parts: 40 });
  if (kind === "diligent") {
    put(e, "floor", 640, 330);
    put(e, "chair", 620, 320);
    put(e, "lamp", 660, 320);
    e.ss.decor = ["banner", "lanterns"];
  }
  if (kind === "busyOt") e.w.decrees = ["overtime"];
  if (kind === "neglect") e.w.decrees = ["ration", "overtime"];
  // 18 块田种上土豆
  for (const p of e.s.plots.slice(0, 18)) {
    p.tilled = true;
    p.crop = "potato";
    p.growth = 0;
  }
  return e;
}
// 田一直有活：熟了的照样能收，每个钟点前都弄干
function keepWork(e) {
  for (const p of e.s.plots.slice(0, 18)) {
    if (!p.crop) {
      p.tilled = true;
      p.crop = "potato";
      p.growth = 0;
    }
    p.wateredDay = -1;
    if (e.g?.plots[p.id]) e.g.plots[p.id].w = 0;
  }
}
function daily(e, kind) {
  const day = e.s.day;
  if (kind !== "diligent") return;
  // 隔天点歌
  if (day % 2 === 0) e.chooseProgram("songs");
  // 每周的节庆（只记下办过，和正式的节庆一样给全营一次士气）
  if (e.isFestivalDay?.() && !e.festivalHosted?.()) {
    e.ss.fest.lastDay = day;
    e.ss.fest.held = [...e.ss.fest.held, day].slice(-8);
    e.residentsMood?.(6);
  }
}
function evening(e, kind) {
  if (kind !== "diligent" || e.talkReason()) return;
  // 只陪心情低落的人聊（没人低落就不聊）
  const low = e.c.residents.find((r) => e.moodTier(r) === "low");
  if (!low) return;
  Object.assign(e.s.player, { ...e.fireSpot(), y: e.fireSpot().y + 20 });
  e.talk("comfort:" + low.id);
  Object.assign(e.s.player, { x: 830, y: 480 });
}

// ---------- 1. 干活台 ----------
function workRun(seed, tier) {
  const e = setup(seed, "diligent"),
    m = { low: 20, normal: 50, high: 85 }[tier];
  let units = 0,
    hours = 0,
    extra = 0;
  const base = e.extraWork.bind(e);
  e.extraWork = (r) => {
    const did = base(r);
    if (did) extra++;
    return did;
  };
  for (let d = 0; d < DAYS; d++) {
    while (e.s.minute < 1320) {
      for (const r of e.c.residents) {
        r.morale = m;
        r.fatigue = 0;
      }
      keepWork(e);
      e.advanceMinutes(60);
      if (e.dy) e.dy.pending = null;
      const h = Math.floor(e.s.minute / 60);
      if (h >= 7 && h <= 22)
        for (const r of e.c.residents) {
          hours++;
          if (r.workRole && r.workRole !== "rest") units++;
        }
    }
    e.advanceMinutes(1440 - e.s.minute + 480);
    if (e.dy) e.dy.pending = null;
  }
  return { tier, perHour: (units + extra) / hours, base: units / hours, extra: extra / hours };
}

// ---------- 2. 营地台 ----------
function campRun(seed, kind) {
  const e = setup(seed, kind);
  let sum = 0,
    n = 0,
    full = 0,
    highDays = 0,
    insp = 0,
    lowDays = 0,
    strikes = 0;
  const tiers = { low: 0, normal: 0, high: 0 };
  for (let d = 0; d < DAYS; d++) {
    if (e.dy) e.dy.pending = null;
    daily(e, kind);
    while (e.s.minute < 1320) {
      keepWork(e);
      if (e.s.minute >= 1140 && e.s.minute < 1200) evening(e, kind);
      e.advanceMinutes(60);
      if (e.dy) e.dy.pending = null;
      if (Math.floor(e.s.minute / 60) === 12)
        for (const r of e.c.residents) {
          sum += r.morale;
          n++;
          if (r.morale >= 100) full++;
          tiers[e.moodTier(r)]++;
        }
    }
    // 08:00 那一刻高昂的人才可能来劲：在早上数
    for (const r of e.c.residents) {
      if (e.moodTier(r) === "high") highDays++;
      if (e.moodTier(r) === "low") lowDays++;
    }
    const before = Object.values(e.td.mood).reduce((a, x) => a + (x.last || 0), 0);
    e.advanceMinutes(1440 - e.s.minute + 480);
    if (e.dy) e.dy.pending = null;
    for (const r of e.c.residents) {
      const rec = e.td.mood[r.id];
      if (rec?.insp?.day === e.s.day) insp++;
      if (rec?.strike === e.s.day) strikes++;
    }
    void before;
  }
  return { kind, avg: sum / n, full: full / n, tiers, highDays, lowDays, insp, strikes, perHighWeek: highDays ? insp / (highDays / 7) : 0, morale: e.c.residents.map((r) => Math.round(r.morale)), factors: e.c.residents.map((r) => e.moodFactors(r).map((f) => f.key + (f.v > 0 ? "+" : "") + f.v).join(" ")) };
}

const out = { DAYS, SEEDS, MOOD, work: {}, camp: {} };
for (const tier of ["low", "normal", "high"]) {
  const rows = SEEDS.map((s) => workRun(s, tier));
  out.work[tier] = { perHour: +(rows.reduce((a, r) => a + r.perHour, 0) / rows.length).toFixed(3), base: +(rows.reduce((a, r) => a + r.base, 0) / rows.length).toFixed(3), extra: +(rows.reduce((a, r) => a + r.extra, 0) / rows.length).toFixed(3) };
}
out.work.highVsNormal = +(out.work.high.perHour / out.work.normal.perHour - 1).toFixed(3);
out.work.lowVsNormal = +(out.work.low.perHour / out.work.normal.perHour - 1).toFixed(3);
for (const kind of ["diligent", "busy", "busyOt", "neglect"]) {
  const rows = SEEDS.map((s) => campRun(s, kind));
  const avg = (k) => +(rows.reduce((a, r) => a + r[k], 0) / rows.length).toFixed(2);
  out.camp[kind] = { avg: avg("avg"), full: avg("full"), perHighWeek: avg("perHighWeek"), insp: avg("insp"), highDays: avg("highDays"), lowDays: avg("lowDays"), strikes: avg("strikes"), rows: rows.map((r) => ({ avg: +r.avg.toFixed(1), tiers: r.tiers, morale: r.morale, factors: r.factors })) };
}
const totalInsp = ["diligent", "busy", "busyOt"].reduce((a, k) => a + out.camp[k].insp, 0),
  totalHigh = ["diligent", "busy", "busyOt"].reduce((a, k) => a + out.camp[k].highDays, 0);
out.inspirePerHighWeek = totalHigh ? +(totalInsp / (totalHigh / 7)).toFixed(2) : 0;
out.pass = {
  highWorksMore: out.work.highVsNormal >= 0.2,
  lowWorksLess: out.work.lowVsNormal <= -0.3,
  diligentAvg: out.camp.diligent.avg >= 55 && out.camp.diligent.avg <= 75,
  busyAvg: out.camp.busy.avg >= 40 && out.camp.busy.avg <= 60,
  notFull: out.camp.diligent.full < 0.2,
  inspire: out.inspirePerHighWeek >= 0.5 && out.inspirePerHighWeek <= 1.5,
};
console.log(JSON.stringify(out, null, 1));
