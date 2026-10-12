// v0.24.0「暗涌」验收模拟：搜东西随机以后，每趟平均拿到的和以前差多少。
// 用正式代码（不改规则）跑 N 天：每天去一张废墟（三张轮着去），把亮着的柜子全打开（锁着的当作撬开了），
// 当天这张图上有小事件就照常拿（空投当作落地、储藏室当作撬开、背包客的货值得就换、被困的人当作送到、搜索队当作打倒）；
// 再按这张图的感染者算身上掉的东西（期望值）。
// 以前（v0.22/v0.23）：每张图 3 个补给箱，第一次给原来那一包、以后每天 {废金属 4、木材 4、干粮 1}，都打三分之二折；每杀 3 只给废金属 2（也打折）。
// 东西按卖价算钱（图纸、枪的附件按 60，手电按 30）。
// 用法：node scripts/loot-sim.mjs 天数 [种子]
const D = new URL("../dist/", import.meta.url).href;
const { Engine, freshState } = await import(D + "campaign.js");
const { ITEMS, ZOMBIES } = await import(D + "data.js");
const U = await import(D + "undertow-data.js");
// DESIGN=1：换成方案表里原来的数（看为什么要改）
if (process.env.DESIGN) {
  const K = U.KINDS;
  Object.assign(K.toolbox, { common: [["scrap", 2, 4]], uncommon: [["parts", 1, 2]] });
  Object.assign(K.wardrobe, { common: [["cloth", 2, 3]] });
  Object.assign(K.kitchen, { common: [["bread", 1, 2], ["seedRadish", 2, 3]], uncommon: [["jam", 1, 1], ["salt", 1, 2]], rare: [["knife", 1, 1], { seed: ["early", "abundant"] }] });
  Object.assign(K.medicine, { common: [["herb", 2, 2]], uncommon: [["bandage", 1, 2]] });
  Object.assign(K.garage, { common: [["parts", 1, 1]] });
}
const DAYS = Number(process.argv[2] || 1000);
const SEED = Number(process.argv[3] || 7);
const value = (id) => {
  const it = ITEMS[id];
  if (!it) return 0;
  if (id.startsWith("bp_") || U.ATTACHMENTS.includes(id)) return 60;
  if (id === "flashlight") return 30;
  if (it.type === "quest") return 0;
  return it.sell ?? Math.round((it.buy || 0) / 2);
};
const worth = (b) => Object.entries(b).reduce((a, [id, n]) => a + value(id) * n, 0);
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
Math.random = seeded(SEED * 7919 + 13);
const st = freshState();
st.undertow.seed = 12345 + SEED;
const e = new Engine(st, () => {});
e.paused = false;
// PHASE=0/1/2：固定按某一段的几率抽（看三段各自差多少）
if (process.env.PHASE) {
  const P = Number(process.env.PHASE);
  e.phase = () => P;
}
const s = e.s;
const stock = () => {
  const out = {};
  for (const b of [s.inventory, s.storage]) for (const [id, n] of Object.entries(b)) out[id] = (out[id] || 0) + n;
  return out;
};
const diff = (a, b) => {
  const out = {};
  for (const id of new Set([...Object.keys(a), ...Object.keys(b)])) {
    const n = (b[id] || 0) - (a[id] || 0);
    if (n > 0) out[id] = n;
  }
  return out;
};
const tiers = { common: 0, uncommon: 0, rare: 0, precious: 0 };
let boxes = 0;
const rows = [];
const kinds = {};
// 打开时记下抽到哪一档
const roll0 = e.rollContainer.bind(e);
e.rollContainer = (o, day) => {
  const r = roll0(o, day);
  if (!["pile", "airdrop", "cache"].includes(o.ukind) && !o.odds) {
    tiers[r.tier]++;
    boxes++;
    kinds[o.ukind] = kinds[o.ukind] || { n: 0, v: 0 };
    kinds[o.ukind].n++;
    kinds[o.ukind].v += worth(r.bundle);
  }
  return r;
};
// 每一抽落在哪一档（普通柜子、锁着的柜子分开数，和表里的几率对照）
const draws = { normal: [0, 0, 0, 0], locked: [0, 0, 0, 0] };
const draw0 = e.drawFrom.bind(e);
e.drawFrom = (kind, odds, r) => {
  const out = draw0(kind, odds, r);
  if (U.TIER_ODDS.includes(odds)) draws.normal[out.tier]++;
  else if (odds === U.LOCKED_ODDS) draws.locked[out.tier]++;
  return out;
};
const killValue = (list, old) => {
  // 期望值：每只按种类
  let v = 0;
  for (const z of list) {
    if (z.boss || z.type === "elite") continue;
    if (old) v += (2 / 3) * 2 * value("scrap") * (1 / 3);
    else for (const [p, id, a, b] of U.KILL_DROPS[z.type] || []) v += p * ((a + b) / 2) * value(id);
  }
  return v;
};
const firstSeen = {};
let missed = 0;
for (let d = 1; d <= DAYS; d++) {
  const region = U.RUINS[(d - 1) % 3];
  s.day = d;
  s.minute = 600;
  // 不出灰隼团、不出今日险地之外的干扰
  e.ut.evDay = 0;
  s.region = region;
  s.enemies[region] = null;
  e.assignRegion();
  for (const z of e.enemies) if (z.type === "elite") z.dead = true;
  const before = stock();
  const ev = e.eventToday(region);
  if (ev) {
    if (ev.id === "airdrop") ev.st = "landed";
    if (ev.id === "storeroom") {
      ev.st = "open";
      for (let i = 1; i <= 2; i++) e.ut.pried[region + "-uroom" + i] = d;
    }
    if (ev.id === "trapped") e.survivorSafe(true);
    if (ev.id === "raiders" && e.raidAhead()) e.receive({ ammo: 12 });
    e.assignRegion();
    for (const z of e.enemies) if (z.type === "elite") z.dead = true;
    if (ev.id === "merchant") {
      for (const o of e.objects.filter((o) => o.type === "uGood")) if (worth(o.bundle) > worth(o.price)) {
        s.inventory.bread = (s.inventory.bread || 0) + 3;
        s.inventory.bandage = (s.inventory.bandage || 0) + 1;
        const b0 = stock();
        e.buyGood(o);
        // 只记换来的，扣掉付出的
        const got = diff(b0, stock());
        before.bread = (before.bread || 0) + 3;
        before.bandage = (before.bandage || 0) + 1;
      }
    }
    if (ev.id === "radio") {
      const t = e.objects.find((o) => o.type === "uTalkie");
      if (t) e.pickTalkie(t);
    }
  }
  const crates = e.objects.filter((o) => o.type === "crate" && o.ukind);
  for (const o of crates) {
    if (o.locked) e.ut.pried[o.id] = d;
    Object.assign(s.player, { x: o.x, y: o.y + 4 });
    // 背包腾空（东西都放进仓库，好算总数）
    for (const [id, n] of Object.entries(s.inventory)) {
      s.storage[id] = (s.storage[id] || 0) + n;
      delete s.inventory[id];
    }
    // 和真人从“选择”里点中它一样
    e._picked = o;
    try {
      e.openContainer(o);
    } finally {
      e._picked = null;
    }
    if (s.opened[o.id]?.day !== d) missed++;
  }
  const got = diff(before, stock());
  const visit = (firstSeen[region] = (firstSeen[region] || 0) + 1);
  rows.push({ d, region, visit, n: crates.length, v: worth(got), kill: killValue(e.enemies, false), killOld: killValue(e.enemies, true), ev: ev?.id || null, got });
}
// 以前：3 个箱子
const OLD_REPEAT = { scrap: 4, wood: 4, bread: 1 };
const scarce = (b) => Object.fromEntries(Object.entries(b).map(([id, n]) => [id, ITEMS[id].protected || ["tool", "weapon", "quest", "seed"].includes(ITEMS[id].type) ? n : (n * 2) / 3]));
const origPack = {};
{
  const e2 = new Engine(freshState(), () => {});
  for (const id of U.RUINS) {
    e2.s.region = id;
    e2.assignRegion();
    origPack[id] = e2.objects.filter((o) => o.type === "crate" && o.orig).map((o) => o.origLoot || o.loot);
  }
}
const oldTrip = (r) => (r.visit === 1 ? origPack[r.region].reduce((a, b) => a + worth(scarce(b)), 0) : 3 * worth(scarce(OLD_REPEAT)));
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const later = rows.filter((r) => r.visit > 1);
const report = (label, rs) => {
  const nv = mean(rs.map((r) => r.v + r.kill)),
    ov = mean(rs.map((r) => oldTrip(r) + r.killOld));
  console.log(label, "趟数", rs.length, "现在", nv.toFixed(1), "（柜子", mean(rs.map((r) => r.v)).toFixed(1), "+ 身上", mean(rs.map((r) => r.kill)).toFixed(1) + "）", "以前", ov.toFixed(1), "（箱子", mean(rs.map(oldTrip)).toFixed(1), "+ 身上", mean(rs.map((r) => r.killOld)).toFixed(1) + "）", "差", (((nv - ov) / ov) * 100).toFixed(1) + "%");
};
report("全部", rows);
report("第一次以后", later);
for (const id of U.RUINS) report(" " + id, later.filter((r) => r.region === id));
for (const ph of [0, 1, 2]) report(" 段" + (ph + 1), later.filter((r) => (ph === 0 ? r.d <= 3 : ph === 1 ? r.d >= 4 && r.d <= 7 : r.d >= 8)));
console.log("每趟亮着的柜子", mean(rows.map((r) => r.n)).toFixed(2), "没打开的", missed, "小事件", rows.filter((r) => r.ev).length, "趟");
const tot = Object.values(tiers).reduce((a, b) => a + b, 0);
console.log("抽到的档（按柜子里最高的一档）", Object.entries(tiers).map(([k, n]) => k + " " + ((n / tot) * 100).toFixed(1) + "%").join(" · "), "共", boxes, "个柜子");
const pcts = (a) => {
  const n = a.reduce((x, y) => x + y, 0);
  return a.map((k, i) => U.TIERS[i] + " " + ((k / Math.max(1, n)) * 100).toFixed(1) + "%").join(" · ") + "（" + n + " 抽）";
};
console.log("普通柜子每一抽", pcts(draws.normal), "表里", (process.env.PHASE ? U.TIER_ODDS[Number(process.env.PHASE)] : U.TIER_ODDS[2]).map((x) => Math.round(x * 100) + "%").join("/"));
console.log("锁着的柜子每一抽", pcts(draws.locked), "表里", U.LOCKED_ODDS.map((x) => Math.round(x * 100) + "%").join("/"));
console.log("各种柜子平均", Object.entries(kinds).map(([k, x]) => k + " " + (x.v / x.n).toFixed(1) + "（" + x.n + "）").join(" · "));
// 读档不会重抽：同一天、同一个柜子再抽一次一样
{
  const o = { id: "residential-u1", ukind: "wardrobe" };
  s.region = "residential";
  const a = JSON.stringify(e.rollContainer(o, 50)),
    b = JSON.stringify(Engine.parse(e.serialize ? e.serialize() : JSON.stringify(s)) && e.rollContainer(o, 50));
  console.log("同一天再抽", a === b ? "一样" : "不一样");
}
