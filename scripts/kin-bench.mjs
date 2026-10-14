// v0.30.0「人情」台：在正式代码上跑方案里的几条线。
// node scripts/kin-bench.mjs reel [次数]          收线：常见、少见、稀有的鱼各钓多少次上得来（像人一样反应慢 0.22–0.38 秒；学会「看水」以后）
// node scripts/kin-bench.mjs trust [种子] [天数]   送礼和营火夜谈：认真送礼、聊天的玩家，一个人从信任 0 到 10 要几天
// node scripts/kin-bench.mjs heart [种子]          心里话：八个人各三段，机器人能不能全走通，信任到了以后等了几个平安的晚上
// node scripts/kin-bench.mjs lamps [晚数]          灯火夜：点满路灯的晚上夜行者来不来（对照：不点灯）
// node scripts/kin-bench.mjs partner [种子]        搭伙：每天多出来的帮忙折合多少金币
// KINPATCH='{"TIERS":{"rare":{"pulled":1.8}}}' 改数试跑（只改这一次）
const D = new URL("../dist/", import.meta.url).href;
const K = await import(D + "kin-data.js");
if (process.env.KINPATCH) for (const [k, v] of Object.entries(JSON.parse(process.env.KINPATCH))) for (const [kk, vv] of Object.entries(v)) vv && typeof vv === "object" && !Array.isArray(vv) ? Object.assign((K[k][kk] ??= {}), vv) : (K[k][kk] = vv);
const { Engine, newGameState } = await import(D + "campaign.js");
const { TASKS } = await import(D + "rebuild-data.js");
const { ITEMS, CROPS } = await import(D + "data.js");
const mode = process.argv[2] || "reel";

const make = (seed = 1) => {
  const s = newGameState("farmer");
  s.undertow.seed = seed;
  const e = new Engine(s, () => {});
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  if (e.dy) e.dy.pending = null;
  return e;
};
function toAct(e, n = 8) {
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

// 一个主线打完、人都齐了的营地：三个居民、铁锹、尤可、胡二，何大勺入伙，秦奶奶住下，江伯的事做完，老琴认识了
function campFull(e) {
  toAct(e, 8);
  for (const r of ["farmer", "medic", "mechanic"]) e.recruit(r);
  e.addHelper("tieqiao");
  e.addCrew({ id: "youke", name: "尤可", trait: "nightowl", role: "build", look: "youke" });
  e.addCrew({ id: "huer", name: "胡二", trait: "chatty", role: "guard", look: "huer" });
  Object.assign(e.ss.he, { stage: 4 });
  Object.assign(e.ss.qin, { phase: "staying", since: e.s.day });
  Object.assign(e.ss.jiang, { phase: "done", rod: 2 });
  Object.assign(e.ss.laoqin, { met: true, quest: true });
  for (let i = 0; i < 3; i++) e.s.buildings.push({ id: "kb" + i, type: "bed", x: 420 + i * 40, y: 400, rotation: 0, hp: 90, open: false });
  e.s.storage.bread = (e.s.storage.bread || 0) + 200;
  e.s.storage.stew = (e.s.storage.stew || 0) + 50;
  e.assignRegion();
}
export { campFull };

// ---------------- 收线 ----------------
function reelOnce(e, tier, rng, skill) {
  e.kin.skills = skill ? ["readWater"] : [];
  const T = K.TIERS[tier];
  const r = () => rng();
  e._reel = { water: "river", sp: "kinMinnow", tier, bait: false, biteAt: 2, prog: T.start, tense: 0.15, t: 0, pull: 0, pullT: 0, next: T.every[0] + r() * (T.every[1] - T.every[0]) * 0.6, warn: false, held: false, r };
  const tau = 0.22 + rng() * 0.16;
  let hold = true,
    t = 0,
    pullOn = -1,
    pullOff = -99,
    warnOn = -1,
    tenseHigh = -1,
    tenseLow = -1,
    lapse = 0,
    lapseW = 0;
  const dt = 1 / 60;
  let res = null;
  e.reelLose = (why) => ((res = why), (e._reel = null), false);
  e.reelLand = () => ((res = "land"), (e._reel = null), true);
  while (e._reel && t < 40) {
    const R = e._reel;
    // 人会走神：每次鱼挣，有两成机会晚 0.3 秒才反应过来
    if (R.pull > 0 && pullOn < 0) {
      pullOn = t;
      lapse = rng() < 0.2 ? 0.3 : 0;
    }
    if (R.pull <= 0 && pullOn >= 0) {
      pullOn = -1;
      pullOff = t;
    }
    if (R.warn && warnOn < 0) {
      warnOn = t;
      lapseW = rng() < 0.2 ? 0.3 : 0;
    }
    if (!R.warn) warnOn = -1;
    if (R.tense >= 0.8 && tenseHigh < 0) tenseHigh = t;
    if (R.tense < 0.8) tenseHigh = -1;
    if (R.tense < 0.45 && tenseLow < 0) tenseLow = t;
    if (R.tense >= 0.45) tenseLow = -1;
    const seePull = pullOn >= 0 && t - pullOn >= tau + lapse,
      seeWarn = warnOn >= 0 && t - warnOn >= tau + lapseW,
      seeHigh = tenseHigh >= 0 && t - tenseHigh >= tau,
      calm = pullOn < 0 && t - pullOff >= tau && (tenseLow >= 0 && t - tenseLow >= tau * 0.5);
    if (hold && (seePull || seeWarn || seeHigh)) hold = false;
    else if (!hold && calm && !seeWarn) hold = true;
    e.reelTick(dt, hold);
    t += dt;
  }
  delete e.reelLose;
  delete e.reelLand;
  return res || "escape";
}
if (mode === "reel") {
  const n = Number(process.argv[3] || 2000);
  const e = make(7);
  let seed = 12345;
  const rng = () => ((seed = (seed * 1103515245 + 12345) % 2147483648), seed / 2147483648);
  for (const skill of [false, true]) {
    const row = [];
    for (const tier of ["common", "uncommon", "rare"]) {
      const c = { land: 0, break: 0, escape: 0 };
      for (let i = 0; i < n; i++) c[reelOnce(e, tier, rng, skill)]++;
      row.push(tier + " " + ((c.land / n) * 100).toFixed(1) + "% (断线 " + ((c.break / n) * 100).toFixed(1) + "%，脱钩 " + ((c.escape / n) * 100).toFixed(1) + "%)");
    }
    console.log((skill ? "看水  " : "不会看水") + "：" + row.join("；"));
  }
}

// ---------------- 送礼和营火夜谈 ----------------
// 认真的玩家：每人 7 天送满 2 次（中午去找人；知道喜欢什么就送喜欢的，三回里有一回拿得出他最爱的东西），
// 每晚到营火边“说说以前”。ORDERS=1 再天天交订单板上的单子，HEARTS=1 再去听心里话（两段各 +1）。记下每个人从 0 到 10 的天数（营地里的人；江伯、老琴不在营火边，另算）。
if (mode === "trust") {
  const seeds = (process.argv[3] || "1,2,3,4,5,6").split(",").map(Number);
  const span = Number(process.argv[4] || 70);
  const camp = [],
    out = [];
  for (const seed of seeds) {
    const e = make(seed);
    campFull(e);
    e._kinBench = true;
    const ids = e.people().map((p) => p.id);
    for (const id of ids) e.ss.trust[id] = 0;
    const start = e.s.day,
      hit = {},
      given = {};
    const giveTo = (id) => {
      if (hit[id] || e.giftsIn(id).length >= 2) return;
      const w = e.whereNow(id);
      if (w.away || w.region !== "farm") return;
      const k = e.prefKnown(id),
        p = K.prefsOf(id),
        n = (given[id] = (given[id] || 0) + 1);
      // 托你找的那样东西不当礼物送（第三段心里话交给他）：挑另一样最爱
      const asked = e.heart(id).seg === 2 ? K.REQUESTS[id]?.item : null,
        favs = p.fav.filter((x) => x !== asked),
        fav = favs.find((x) => k[x] === "fav") || favs[0];
      const like = p.like.find((x) => k[x] === "like") || p.like[(e.s.day + id.length) % p.like.length];
      const item = n % 3 === 0 ? fav : like;
      e.s.storage[item] = (e.s.storage[item] || 0) + 1;
      e.s.region = "farm";
      Object.assign(e.s.player, { x: w.x, y: w.y });
      e.giveGift(id, item);
    };
    for (let d = 0; d < span; d++) {
      // 认真的玩家还天天交订单板上的单子（种的菜够交），有话想说的晚上去听（托的东西第二天就取回来）
      if (process.env.ORDERS === "1" && e.bt) {
        e.s.minute = 9 * 60;
        for (const o of [...e.bt.orders.list]) {
          e.s.storage[o.item] = (e.s.storage[o.item] || 0) + o.n;
          e.deliverBoardOrder(o.id);
        }
      }
      e.s.minute = 12 * 60;
      if ((e.s.day - start) % 7 < 4) for (const id of ids) giveTo(id);
      e.s.minute = 19 * 60 + 30;
      if ((e.s.day - start) % 7 < 4) for (const id of ids) giveTo(id);
      if (process.env.HEARTS === "1")
        for (const id of K.HEART_IDS) {
          const h = e.kin.heart[id];
          if (h?.seg === 2 && !e.qty(K.REQUESTS[id].item, true)) e.s.storage[K.REQUESTS[id].item] = 1;
          if (!e.heartReason(id)) e.heartPick(id, d % 2);
        }
      const f = e.fireSpot();
      Object.assign(e.s.player, { x: f.x, y: f.y + 10 });
      e.talk("past");
      for (const id of ids) if (!hit[id] && (e.ss.trust[id] || 0) >= 10) hit[id] = e.s.day - start + 1;
      e.sleep();
      if (e.dy) e.dy.pending = null;
    }
    const days = ids.map((id) => hit[id] || ">" + span);
    for (const id of ids) if (hit[id]) (["jiang", "laoqin"].includes(id) ? out : camp).push(hit[id]);
    console.log("种子 " + seed + "：" + ids.map((id, i) => e.kinName(id) + " " + days[i]).join("、"));
  }
  const sum = (a) => (a.sort((x, y) => x - y), a.length ? "平均 " + (a.reduce((x, y) => x + y, 0) / a.length).toFixed(1) + "，中位 " + a[Math.floor(a.length / 2)] + "，最快 " + a[0] + "，最慢 " + a.at(-1) + "（" + a.length + " 人）" : "—");
  console.log("营地里的人到 10 的天数：" + sum(camp));
  console.log("江伯、老琴（只靠送礼）：" + sum(out));
}

// ---------------- 心里话 ----------------
// 机器人：每两天给八个人各长 1 点信任（像认真送礼那样），每晚 19:30 看谁有话想说，走过去听；
// 第二段托的东西第二天去那张废墟拿回来。记下信任到了以后等了几个平安的晚上、24 段走没走通、学会了几样本事。
if (mode === "heart") {
  const seeds = (process.argv[3] || "1,2,3").split(",").map(Number);
  const waits = [];
  for (const seed of seeds) {
    const e = make(seed);
    campFull(e);
    e._kinBench = true;
    const ids = K.HEART_IDS;
    for (const id of ids) e.ss.trust[id] = 0;
    const since = {},
      done = {},
      fetch = [];
    let calmNights = 0,
      badNights = 0;
    for (let d = 0; d < 120 && Object.keys(done).length < ids.length; d++) {
      if (d % 2 === 0) for (const id of ids) e.ss.trust[id] = Math.min(10, (e.ss.trust[id] || 0) + 1);
      // 托的东西：去那张废墟找到那处记号
      for (const id of fetch.splice(0)) {
        const q = K.REQUESTS[id];
        e.s.visited[q.region] = true;
        e.s.region = q.region;
        e.enemies = e.s.enemies[q.region] ||= [];
        e.assignRegion();
        const o = e.objects.find((x) => x.type === "kinCache" && x.who === id);
        if (o) {
          Object.assign(e.s.player, { x: o.x, y: o.y });
          e.cacheTake(id);
        }
        e.s.region = "farm";
        e.enemies = e.s.enemies.farm ||= [];
        e.assignRegion();
      }
      e.s.minute = 19 * 60 + 30;
      const calm = e.kinCalm();
      calm ? calmNights++ : badNights++;
      for (const id of ids) {
        const h = e.heart(id);
        if (h.seg >= 3) continue;
        const need = e.heartNeed(id);
        const ready = (e.ss.trust[id] || 0) >= need && (h.seg !== 2 || e.qty(K.REQUESTS[id].item, true) > 0);
        if (ready && since[id] === undefined) since[id] = 0;
        if (!e.heartReady(id)) {
          // 只数人在营地的平安晚上（秦奶奶坐渡船走了的那几天不算）
          if (ready && calm && !e.whereNow(id).away) since[id]++;
          continue;
        }
        const w = e.whereNow(id);
        Object.assign(e.s.player, { x: w.x, y: w.y });
        const out = e.heartPick(id, (h.seg + id.length) % 2);
        if (!out) continue;
        waits.push((since[id] || 0) + 1);
        since[id] = undefined;
        if (e.heart(id).seg === 2) fetch.push(id);
        if (e.heart(id).seg >= 3) done[id] = e.s.day;
      }
      e.sleep();
      if (e.dy) e.dy.pending = null;
    }
    console.log("种子 " + seed + "：说完的 " + Object.keys(done).length + "/8（" + ids.map((id) => e.kinName(id) + " " + e.heart(id).seg + "/3").join("、") + "）；学会的本事 " + e.kin.skills.length + "（" + e.kin.skills.map((k) => K.SKILLS[k].name).join("、") + "）；平安的晚上 " + calmNights + "、不平安 " + badNights);
  }
  waits.sort((a, b) => a - b);
  console.log("信任到了以后第几个平安的晚上说出来：" + [1, 2, 3, 4].map((n) => n + " 晚 " + waits.filter((w) => w === n).length).join("、") + "，更久 " + waits.filter((w) => w > 4).length + "（共 " + waits.length + " 段）");
}

// ---------------- 灯火夜 ----------------
// 同一个种子、同一个灯火夜各跑两遍：点满六盏路灯 / 不点。数夜行者来了几晚、来了几只。
if (mode === "lamps") {
  const n = Number(process.argv[3] || 400);
  const res = { lit: { nights: 0, foes: 0 }, dark: { nights: 0, foes: 0 } };
  for (let seed = 1; seed <= n; seed++) {
    for (const lit of [true, false]) {
      const e = make(seed);
      campFull(e);
      const day = 14 + 28 * (1 + (seed % 3));
      e.s.day = day;
      e.s.minute = 16 * 60 + 30;
      e.s.region = "farm";
      e.enemies = e.s.enemies.farm ||= [];
      e.assignRegion();
      if (e.festivalKind(day) !== "lanterns") throw new Error("not a lantern night " + day);
      if (lit)
        for (const [i, p] of K.LAMPS.entries()) {
          Object.assign(e.s.player, { x: p.x, y: p.y + 10 });
          e.lightLamp(i);
        }
      if (lit && !e.lampsFull()) throw new Error("lamps not lit");
      Object.assign(e.s.player, { x: 330, y: 340 });
      let came = false,
        foes = 0;
      for (const m of [22 * 60 + 5, 23 * 60 + 30]) {
        e.s.minute = m;
        e.tickProwl();
        const live = e.enemies.filter((z) => z.prowl && !z.dead).length;
        if (live) came = true;
        foes = Math.max(foes, live);
      }
      e.s.day = day + 1;
      for (const m of [60, 200]) {
        e.s.minute = m;
        e.tickProwl();
        const live = e.enemies.filter((z) => z.prowl && !z.dead).length;
        if (live) came = true;
        foes = Math.max(foes, live);
      }
      const r = res[lit ? "lit" : "dark"];
      if (came) r.nights++;
      r.foes += foes;
    }
  }
  console.log("灯火夜（" + n + " 个种子）：点满路灯 夜行者来了 " + res.lit.nights + " 晚（" + res.lit.foes + " 只）；不点灯 " + res.dark.nights + " 晚（" + res.dark.foes + " 只，" + ((res.dark.nights / n) * 100).toFixed(1) + "%）");
}

// ---------------- 搭伙：每天多出来的帮忙 ----------------
// 同一个营地跑两遍（搭伙 / 没搭伙），差出来的就是那个人帮的：早饭按顶饱的价折（炖汤 65 顶饱卖 42 金），
// 浇的田按一块 1 金、修的耐久按修理包（废金属 3、木材 2，约 25 金修满 150）折。和四时台上勤快玩家每天的收成值比。
if (mode === "partner") {
  const seeds = (process.argv[3] || "1,2,3").split(",").map(Number);
  const run = (seed, partner) => {
    const e = make(seed);
    campFull(e);
    if (partner) e.kin.partner = { id: "medic", stage: "home", day: e.s.day, hurt: 0 };
    for (let i = 0; i < 18; i++) if (e.s.plots[i]) Object.assign(e.s.plots[i], { crop: "potato", growth: 0, wateredDay: 0 });
    const fence = { id: "kf", type: "fence", x: 1200, y: 420, rotation: 0, hp: 150 };
    e.s.buildings.push(fence);
    let breakfast = 0,
      watered = 0,
      fixed = 0;
    for (let d = 0; d < 28; d++) {
      for (const p of e.s.plots) if (p.crop) p.wateredDay = 0;
      fence.hp = 100;
      const b0 = e.qty(K.BREAKFAST, true),
        w0 = e.s.plots.filter((p) => p.crop && e.plotWatered(p)).length;
      e.s.minute = 7 * 60 - 0.5;
      e.c.workClock = 59.5;
      e.advanceMinutes(1);
      breakfast += e.qty(K.BREAKFAST, true) - b0;
      watered += e.s.plots.filter((p) => p.crop && e.plotWatered(p)).length - w0;
      fixed += fence.hp - 100;
      e.s.minute = 1439.5;
      e.c.workClock = 0;
      e.advanceMinutes(1);
    }
    return { breakfast, watered, fixed };
  };
  let days = 0,
    breakfast = 0,
    watered = 0,
    fixed = 0;
  for (const seed of seeds) {
    const a = run(seed, true),
      b = run(seed, false);
    breakfast += a.breakfast - b.breakfast;
    watered += a.watered - b.watered;
    fixed += a.fixed - b.fixed;
    days += 28;
  }
  const per = (x) => x / days;
  const value = per(breakfast) * (45 / 65) * 42 + per(watered) * 1 + per(fixed) * (25 / 150);
  console.log("搭伙 " + days + " 天（和没搭伙的同一个营地比）：每天早饭 " + per(breakfast).toFixed(2) + " 份、多浇 " + per(watered).toFixed(1) + " 块田、多修 " + per(fixed).toFixed(1) + " 耐久；折合每天 " + value.toFixed(1) + " 金，是勤快玩家每天收成值的 " + ((value / 3415) * 100).toFixed(1) + "%（照老办法 3415）/ " + ((value / 4180) * 100).toFixed(1) + "%（按时节 4180）");
}
