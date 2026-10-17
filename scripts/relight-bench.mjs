// v0.31.0「重光」台：在正式代码上跑方案里重光这一版的线。
//
// 1) 勤快的一年：node scripts/relight-bench.mjs year [种子,种子] [天数]
//    新开局（种地的），机器人从第 1 天起每天：
//      08:00、16:00 把 18 块田过一遍（收、拔草、捉虫、开垦、播种、浇水、照看，照四时台）；种什么看重建清单还缺哪样菜、当季的优先；
//      上午出一趟门：居民区、医院、仓库轮着去（医院、仓库第 4 天起），亮着的柜子都打开（锁着的当作撬开了），把感染者打完
//        （机器人不会死，这里只看拿到什么；死不死看隧道台、装备台），头目出来的那天去打头目；路过的野物捡起来，残页说的藏货点挖开；
//      主线打完以后（第 30 天）隔一天下一趟地铁隧道：从修好的最深一部电梯往下 5 层，柜子都开，到电梯层就修（材料带在身上）；
//        每 5 层按隧道台“带对装备”的倒下率掷一次（TFAIL，默认 8%），倒下了这趟就停在那儿；一层按隧道台的平均 75 分钟算；
//      傍晚：池塘钓两回（一回在天黑以后）、溪谷的河每 4 天、沉湾的海每 7 天钓两回；捡农场的野物、许医生认蘑菇；腌缸、土酒坛、
//        鸡舍；送两个人礼、隔两天营火夜谈（照人情浸泡）；做清单要的菜和药（照配方扣材料，不算灶台上的时间）；
//        手上有的都交到重建站；档案馆分馆建好以后把旧物都捐了；陈工在营地就撬铁盒；节庆照常办；尸潮、长夜机器人守（不会倒下）；
//      22:00 睡觉、存档、读回（读不回、有 NaN 记一笔）。
//    主线、居民、地图照设计的节奏推进（下面 MS 表，第 30 天主线打完，和长夜台、浸泡一样），不靠机器人自己做主线任务。
//    几样东西不在机器人这条路上，按 GIVE 表给（什么时候起、怎么来的写在表里；堆肥桶一天一袋提质肥，施在清单要上品、正当季的菜上）。
//    记：每份清单、每面墙哪天交满，28 份哪天；旧物捐到第几件（哪天 48 件）；残页几天一张；七颗余烬核哪天；
//    第 28、56、84 天的年终评定几盏灯；收成值（按卖价）攒到签约加六面墙的钱是第几天。
// 2) 鼎丰：node scripts/relight-bench.mjs company
//    签约和六面墙一共多少钱、折合忙的玩家几天的收成（种田台 MODE=busy 的每天收成值）、勤快的玩家几天。
//
// TFAIL=0.08 改隧道每 5 层倒下的机会；MS='{"story":26}' 改里程碑哪天到；SHOW=1 每天打一行；
// EARLY=1 对照：检修平台不等主线打完，升降井修好就能下（看主线那一条把到第 30 层推后了多少）。
// FUN=1（v0.32 起，《爽点与耐玩体检方案》用的计数）：每条进提示栏的提示（日常小事只在头顶飘字，不算）、每件大事卡片、
//   每件好事（稀有、珍贵、头目、守住一轮或交满清单、升级、主线、救人、大事卡片）几点几分、每天手上多少钱、第一次见到的东西；
//   每个种子多一块 fun，最后打一行六个种子合起来的 FUN 汇总：按第 1–3、4–30、31–60、61+ 天分段的每天提示数、金色、
//   大事卡片、好事之间隔多久（现实秒，游戏里 1.6 分钟 = 现实 1 秒）、一件好事都没有的日子、每周第一次见到的东西、钱。
const D = new URL("../dist/", import.meta.url).href;
const { Engine, freshState } = await import(D + "campaign.js");
const { ITEMS, CROPS, BUILDINGS, RECIPES, REGIONS } = await import(D + "data.js");
const RD = await import(D + "relight-data.js");
const KD = await import(D + "kin-data.js");
const { TASKS } = await import(D + "rebuild-data.js");
const { SSPOTS } = await import(D + "seasons-data.js");
const { WSPOTS } = await import(D + "winter-data.js");
const { SHAFT } = await import(D + "relight.js");
const HD = await import(D + "hope-data.js");
// v0.34：第二年的清单、打法挑战、技能 6–10 级
const GD = await import(D + "grow-data.js").catch(() => null);
const L2 = GD ? GD.LIST2_IDS : [];
const FS = await import("node:fs");
const { POINT_BY_ID } = await import(D + "district-data.js");
const FUN = process.env.FUN === "1";

const MODE = process.argv[2] || "year";
const SEEDS = (process.argv[3] || "1,2,3").split(",").map(Number);
const DAYS = Number(process.argv[4] || 120);
const TFAIL = Number(process.env.TFAIL ?? 0.08);
const DT = 0.05;

// ---------------- 里程碑（第几天到）----------------
// 照设计的节奏：主线每章 7 天上下，第 30 天第 8 段领完（长夜台、浸泡都从第 30 天算主线打完）。
const MS = {
  valley: 3, // 溪谷试验田：第一次收获以后就能修通（木 6、石 3、干粮 2）
  farmer: 4, // 阿禾（第一章“接回阿禾”）
  ruins: 4, // 医院、仓库（第 4–7 天那一段起）
  courtyard: 5, // 雨巷住区：救出阿禾以后
  jars: 5, // 腌缸、土酒坛
  coop: 6, // 鸡舍和鸡
  stationMarket: 6, // 旧站商街：第一次出售以后
  medic: 8, // 许医生（第二章）
  goat: 10, // 山羊
  pinewood: 10, // 雾松林场（松脂）
  quarantine: 12, // 检疫科研园：医院前哨二级
  ladder: 12, // 生活水准二级
  mechanic: 14, // 陈工（第三章）
  shelter: 14, // 地底避难城（雨巷住区、许医生、医院前哨二级）+ 修好医院升降井
  exhibit: 15, // 起每周往收获展送一样菜
  gun: 6, // 做出第一把手枪、领了目标：尸潮开始按日子来
  he: 16, // 何大勺入伙：萝卜糕、行军炖菜、豆渣饼这几道菜他教了才会做
  railDepot: 16, // 北线货运站：陈工、动力研究
  shipyard: 18, // 沉湾船坞：旧站商街、修复旧桥
  murals: 20, // 阿砾画好两面墙画
  alan: 25, // 寒潮里给阿兰的羊分了饲料，阿兰留下两只羊（第七段）
  museum: 28, // 档案馆分馆（第八段、固定航线）
  story: 30, // 第 8 段领完：主线打完（长夜、灰隼团反扑、地铁隧道）
  frost: 32, // 白霜气象站：领出封存的黑麦种子
};
if (process.env.MS) Object.assign(MS, JSON.parse(process.env.MS));
// 不在机器人这条路上的东西：从第几天起、什么时候给、给多少（只在清单还要的时候拿）
const GIVE = {
  // 阿默每晚卖一株月影草（25 金币）：第七段起
  moonHerb: { from: 22, every: 1, n: 1, cost: 25, why: "阿默晚上卖的月影草" },
  // 地底避难城的滤材工坊：布 2 → 滤材 1（45 分钟）
  filterFabric: { from: MS.shelter, every: 2, n: 1, pay: { cloth: 2 }, why: "滤材工坊做的" },
  // 雾松林场每天采一回：干粮 1 → 松脂 2
  resin: { from: MS.pinewood, every: 1, n: 2, pay: { bread: 1 }, why: "雾松林场采的" },
  // 沉湾船坞的盐仓两天一批：干粮 1 → 食盐 3
  salt: { from: MS.shipyard, every: 2, n: 3, pay: { bread: 1 }, why: "船坞盐仓取的" },
  // 白霜气象站领出封存的黑麦种子（一次 3 颗），以后自己留种（育种台：黑麦 1 → 种子 2）
  seedRye: { from: MS.frost, every: 99999, n: 3, why: "气象站领的黑麦种子" },
  // 堆肥桶一天出一袋提质肥（照四时台“按时节 + 提质肥”）：施在清单要上品的那种菜、刚在当季种下的田上
  fertCare: { from: 6, every: 1, n: 1, always: true, why: "堆肥桶一天一袋提质肥" },
};
const SEED_BUY = ["seedRadish", "seedPotato", "seedBean", "seedTomato", "seedCorn", "seedPumpkin", "seedHerb", "seedCotton"];
const RUINS = ["residential", "hospital", "warehouse"];
const BOSS_DAY = { residential: (d) => d >= 4 && d % 7 === 4, hospital: (d) => d >= 8 && d % 7 === 1 };

// ===================== FUN=1：提示和好事的计数 =====================
let CUR = null;
const BIG_EVENTS = ["rareLoot", "preciousLoot", "bossDown", "victory", "level", "quest", "rescue", "moment"];
const worthOf = (e) => {
  let w = e.s.money;
  for (const box of [e.s.inventory, e.s.storage]) for (const [id, n] of Object.entries(box)) if (n > 0) w += n * (ITEMS[id]?.sell || 0);
  return w;
};
function hook(e) {
  if (!FUN) return;
  // 进提示栏的：v0.32 起是 zSink（日常小事在 zest 里就拦下了）；更早的版本是 notify
  const into = (text, tone) => {
    if (!CUR) return;
    CUR.toasts.push([e.s.day, Math.round(e.s.minute), tone || "normal", String(text).slice(0, 90)]);
  };
  if (e.zSink) e.zSink = into;
  else e.notify = into;
  trackMoney(e);
  const arr = [];
  const push0 = Array.prototype.push;
  arr.push = function (...items) {
    if (CUR)
      for (const ev of items) {
        if (BIG_EVENTS.includes(ev.type)) CUR.big.push([e.s.day, Math.round(e.s.minute), ev.type + (ev.kind ? ":" + ev.kind : "")]);
        if (ev.type === "moment") CUR.moments.push([e.s.day, ev.kind]);
      }
    return push0.apply(this, items);
  };
  e.events = arr;
}
// 钱：每一笔进出都记下（v0.33 起看第 31–120 天挣到的花掉几成、3,000 以上的东西每周有没有买）
function trackMoney(e) {
  const s = e.s;
  let v = s.money;
  Object.defineProperty(s, "money", {
    configurable: true,
    enumerable: true,
    get: () => v,
    set: (n) => {
      const d = Number(n) - v;
      if (CUR && Number.isFinite(d) && d) {
        const day = s.day || 0;
        if (d > 0) CUR.earn[day] = (CUR.earn[day] || 0) + d;
        else {
          CUR.spend[day] = (CUR.spend[day] || 0) - d;
          if (-d >= 3000) CUR.big3k.push([day, Math.round(-d)]);
        }
      }
      v = n;
    },
  });
}
function funDay(e, X, today) {
  if (!FUN) return;
  const seen = (k) => {
    if (X.fun.seen[k] == null) X.fun.seen[k] = today;
  };
  for (const box of [e.s.inventory, e.s.storage]) for (const [id, n] of Object.entries(box)) if (n > 0) seen("item:" + id);
  for (const r of Object.keys(e.s.visited || {})) if (e.s.visited[r]) seen("region:" + r);
  for (const r of e.c?.residents || []) seen("resident:" + (r.id || r.type || r.name));
  for (const b of e.s.buildings) seen("building:" + b.type);
  for (const k of Object.keys(e.c?.technologies || {})) if (e.c.technologies[k]) seen("tech:" + k);
  // v0.33：二级墙、扩建、稀罕货、见过的人、来信、这周的清单和头目、第一次碰到的那种下午的事
  const h = e.hp;
  if (h) {
    for (const w of Object.keys(h.wall2)) seen("wall2:" + w);
    for (const [k, n] of Object.entries(h.expand)) for (let i = 1; i <= n; i++) seen("expand:" + k + i);
    for (const g of Object.keys(h.goods)) seen("good:" + g);
    for (const id of h.met) seen("met:" + id);
    for (const id of h.letters) seen("letter:" + id);
    for (const id of h.log.list) seen("list:" + id);
    for (const id of h.log.boss) seen("boss:" + id);
    for (const k of X.noonKinds || []) seen("noon:" + k);
  }
  X.fun.worth[today] = Math.round(worthOf(e));
  X.fun.floats[today] = e.zx?.stats?.floats || 0;
  // v0.34：每天各技能的经验（妙手另算），看 6–10 级多少天一级
  (X.fun.xp ||= {})[today] = { ...e.s.xp, thief: e.sk?.thiefXp || 0 };
}
const PHASES = [["d1-3", 1, 3], ["d4-30", 4, 30], ["d31-60", 31, 60], ["d61+", 61, 1e9]];
function funSummary(rows, days) {
  const out = {};
  for (const [name, a, b0] of PHASES) {
    const b = Math.min(b0, days);
    if (b < a) continue;
    let toasts = 0, gold = 0, warn = 0, moments = 0, zero = 0, awakeAll = 0;
    const gaps = [];
    for (const X of rows) {
      const F = X.fun;
      const end = {};
      for (const [d, m] of [...F.toasts, ...F.big]) if (d >= a && d <= b) end[d] = Math.max(end[d] || 480, Math.min(m, 1440));
      let acc = 0;
      const offs = {};
      for (let d = a; d <= b; d++) {
        offs[d] = acc;
        acc += Math.max(0, (end[d] || 480) - 480);
      }
      awakeAll += acc;
      const T = (d, m) => offs[d] + Math.max(0, Math.min(m, end[d] || 480) - 480);
      const big = F.big.filter(([d]) => d >= a && d <= b).map(([d, m]) => T(d, m)).sort((x, y) => x - y);
      const seg = [0, ...big, acc];
      for (let i = 0; i + 1 < seg.length; i++) gaps.push(seg[i + 1] - seg[i]);
      const per = {};
      for (const [d] of F.big) if (d >= a && d <= b) per[d] = 1;
      for (let d = a; d <= b; d++) if (!per[d]) zero++;
      for (const [d, , tone] of F.toasts)
        if (d >= a && d <= b) {
          toasts++;
          if (tone === "gold") gold++;
          if (tone === "warn") warn++;
        }
      moments += F.moments.filter(([d]) => d >= a && d <= b).length;
    }
    const n = rows.length * (b - a + 1);
    gaps.sort((x, y) => x - y);
    const q = (p) => gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))] || 0;
    const real = (min) => Math.round(min / 1.6);
    out[name] = {
      toastsPerDay: +(toasts / n).toFixed(1),
      goldPerDay: +(gold / n).toFixed(1),
      warnPerDay: +(warn / n).toFixed(1),
      momentsPerDay: +(moments / n).toFixed(2),
      bigGapSec: { mean: real(gaps.reduce((x, y) => x + y, 0) / Math.max(1, gaps.length)), median: real(q(0.5)), p90: real(q(0.9)), max: real(gaps.at(-1) || 0) },
      zeroBigDaysPct: +((zero / n) * 100).toFixed(1),
      // 有一件值得出门的下午的事的日子
      noonDaysPct: +((rows.reduce((acc, X) => acc + Object.keys(X.noonDay || {}).filter((d) => d >= a && d <= b).length, 0) / n) * 100).toFixed(1),
    };
  }
  // 每周第一次见到的东西（6 个种子平均）、第 31 天以后最长几天没见到新东西
  const weeks = [];
  const dry = [];
  for (const X of rows) {
    const byDay = {};
    for (const d of Object.values(X.fun.seen)) byDay[d] = (byDay[d] || 0) + 1;
    for (let w = 0; w * 7 < days; w++) {
      let k = 0;
      for (let d = w * 7 + 1; d <= Math.min(days, w * 7 + 7); d++) k += byDay[d] || 0;
      weeks[w] = (weeks[w] || 0) + k;
    }
    let best = 0, cur = 0;
    for (let d = 31; d <= days; d++) {
      cur = byDay[d] ? 0 : cur + 1;
      best = Math.max(best, cur);
    }
    dry.push(best);
  }
  const momentKinds = {};
  for (const X of rows) for (const [, k] of X.fun.moments) momentKinds[k] = (momentKinds[k] || 0) + 1;
  const moneyAt = (d) => Math.round(rows.reduce((a, X) => a + (X.money[d] || 0), 0) / rows.length);
  // 第 31 天到最后：挣到的花掉几成；第 31 天起每 7 天里有没有一笔 3,000 以上的花销
  const spend = rows.map((X) => {
    let earn = 0,
      out = 0;
    for (let d = 31; d <= days; d++) {
      earn += X.fun.earn[d] || 0;
      out += X.fun.spend[d] || 0;
    }
    let weeks3k = 0,
      wk = 0;
    for (let a = 31; a + 6 <= days; a += 7) {
      wk++;
      if (X.fun.big3k.some(([d]) => d >= a && d <= a + 6)) weeks3k++;
    }
    return { earn: Math.round(earn), spend: Math.round(out), share: earn ? +(out / earn).toFixed(3) : 0, weeks3k: wk ? weeks3k + "/" + wk : "0/0" };
  });
  // 第 61–120 天每周新东西（6 个种子平均）
  const late = weeks.slice(8, Math.ceil(days / 7)).map((x) => +(x / rows.length).toFixed(1));
  return { phases: out, momentKinds, novelty: weeks.map((x) => +(x / rows.length).toFixed(1)), noveltyD61: { min: Math.min(...late), mean: +(late.reduce((a, b) => a + b, 0) / Math.max(1, late.length)).toFixed(1) }, dryAfter30: dry, money: { d30: moneyAt(30), d60: moneyAt(60), d90: moneyAt(90), d120: moneyAt(120) }, spend };
}

function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const qty = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);
const put = (e, items) => {
  for (const [id, n] of Object.entries(items)) if (n) e.s.storage[id] = (e.s.storage[id] || 0) + n;
};
const take = (e, id, n) => {
  let left = n;
  for (const b of [e.s.storage, e.s.inventory]) {
    const k = Math.min(left, b[id] || 0);
    if (!k) continue;
    b[id] -= k;
    if (!b[id]) delete b[id];
    left -= k;
  }
  return n - left;
};
const has = (e, cost) => Object.entries(cost).every(([id, n]) => qty(e, id) >= n);
const pay = (e, cost) => {
  if (!has(e, cost)) return false;
  for (const [id, n] of Object.entries(cost)) take(e, id, n);
  return true;
};
// 背包里的东西放进仓库（工具、武器、装备、图纸、战利品留在身上）
const STASH = new Set(["food", "medicine", "resource", "seed", "crop", undefined]);
const stash = (e) => {
  for (const [id, n] of Object.entries(e.s.inventory)) {
    if (!STASH.has(ITEMS[id]?.type) || ["hoe", "water"].includes(id)) continue;
    put(e, { [id]: n });
    delete e.s.inventory[id];
  }
};
const at = (e, x, y) => Object.assign(e.s.player, { x, y });
const toMinute = (e, m) => {
  let guard = 0;
  while (e.s.minute < m - 0.5 && guard++ < 48) e.advanceMinutes(Math.min(30, m - e.s.minute));
};
const nearest = (e) => {
  const p = e.s.player;
  let best = null,
    bd = 1e9;
  for (const z of e.enemies) {
    if (z.dead || z.fled) continue;
    const d = Math.hypot(z.x - p.x, z.y - (p.y - 20));
    if (d < bd) (bd = d), (best = z);
  }
  return best;
};
// 打一段：机器人不会倒下（只看拿到什么），朝最近的感染者走、够得着就打；卡住了往前挪一步
let stuckT = 0;
function run(e, seconds, stop = () => false) {
  for (let t = 0; t < seconds; t += DT) {
    e.invulnerable = 1e9;
    const p = e.s.player;
    p.hp = Math.max(p.hp, e.maxHp() * 0.9);
    p.stamina = Math.max(p.stamina, 60);
    p.hunger = Math.max(p.hunger, 60);
    if (e.paused) e.paused = false;
    const z = nearest(e);
    let input = { x: 0, y: 0, run: false };
    if (z) {
      const dx = z.x - p.x,
        dy = z.y - p.y,
        d = Math.hypot(dx, dy);
      if (d > 60) input = { x: dx / d, y: dy / d, run: true };
      else e.use({ x: z.x, y: z.y - 20 });
    }
    const bx = p.x,
      by = p.y;
    e.update(DT, input);
    e.events.length = 0;
    if (z && (input.x || input.y) && Math.hypot(p.x - bx, p.y - by) < 0.5) {
      stuckT += DT;
      if (stuckT > 2) {
        p.x += input.x * 50;
        p.y += input.y * 50;
        stuckT = 0;
      }
    } else stuckT = 0;
    if (stop()) return t;
  }
  return seconds;
}

// ---------------- 主线、居民、地图、设施：照 MS 表 ----------------
function setAct(e, n) {
  const sc = e.sc;
  // 存档的规矩：第 k 段领完（claimed 里有 actk）当且仅当进度到了第 k+1 段；选了援建物资才有 supply
  sc.act = n;
  sc.claimed = [...(n >= 2 ? ["supply"] : []), ...[1, 2, 3, 4, 5, 6, 7, 8].filter((k) => k < n).map((k) => "act" + k)];
  sc.choice = n >= 2 ? sc.choice || "ration" : null;
  sc.letters = [1, 2, 3, 4, 5, 6, 7, 8, 9].filter((k) => k <= n).map((k) => "act" + k);
  sc.flags.well = sc.flags.camp = true;
  if (n >= 2) sc.flags.farmerFed = true;
  sc.camp ||= { x: 560, y: 735 };
  // 联盟前哨那条线的任务：章跟着幕走
  const upto = n >= 9 ? TASKS.length : Math.min(TASKS.length, Math.floor(((n - 1) / 8) * TASKS.length));
  e.r.claimed = [...new Set([...e.r.claimed, ...TASKS.slice(0, upto).map((t) => t.id)])];
  if (n >= 4) e.r.outposts.hospital = Math.max(e.r.outposts.hospital || 0, 2);
  if (n >= 5) {
    e.o.hospital ||= "water";
    Object.assign(e.o, { youke: true });
    e.o.lathe ||= { mode: "parts", day: 0 };
  }
  if (n >= 7) e.r.radio = true;
  if (n >= 8) {
    e.o.toll ||= "refuse";
    e.o.raid.phase = "won";
  }
}
const ACT_DAY = [1, 3, 6, 10, 14, 18, 22, 26, 30]; // 第 n 幕从第几天起（第 9 = 主线打完）
const B = (e, type, x, y, extra = {}) => {
  const b = { id: "bench-" + type + "-" + e.s.idCounter++, type, x, y, rotation: 0, hp: BUILDINGS[type]?.hp || 60, ...extra };
  e.s.buildings.push(b);
  e.navRevision = (e.navRevision || 0) + 1;
  return b;
};
function milestones(e, day, X) {
  const act = ACT_DAY.filter((d) => day >= d).length;
  if (act !== X.act) {
    setAct(e, Math.min(9, act));
    X.act = act;
  }
  const once = (k, fn) => {
    if (day >= MS[k] && !X.ms[k]) {
      X.ms[k] = day;
      fn();
    }
  };
  once("valley", () => {
    e.d.unlocked.valley = true;
    e.s.visited.valley = true;
  });
  // 来了人就给他一张床（勤快的玩家都会搭）
  const bed = (i) => B(e, "bed", 640 + i * 60, 330);
  once("farmer", () => {
    e.recruit("farmer");
    bed(0);
  });
  // 修通了的地区机器人都会去走一趟（残页里的藏货谜题要你去过那张图）
  const district = (id) => {
    e.d.unlocked[id] = true;
    e.s.visited[id] = true;
  };
  once("courtyard", () => district("courtyard"));
  once("stationMarket", () => district("stationMarket"));
  once("jars", () => {
    B(e, "alPickleJar", 560, 860);
    B(e, "alWineJar", 610, 860);
  });
  once("coop", () => {
    B(e, "coop", 760, 600);
    e.c.animals.chicken = true;
  });
  once("medic", () => {
    e.recruit("medic");
    bed(1);
  });
  once("goat", () => (e.c.animals.goat = true));
  once("pinewood", () => {
    e.b.unlocked.pinewood = true;
    e.s.visited.pinewood = true;
  });
  once("quarantine", () => district("quarantine"));
  once("ladder", () => (e.w.ladder = Math.max(e.w.ladder || 0, 2)));
  once("mechanic", () => {
    e.recruit("mechanic");
    bed(2);
  });
  once("shelter", () => {
    e.b.unlocked.shelter = true;
    e.s.visited.shelter = true;
    e.b.points.shelter_lift = e.bpoint("shelter_lift");
    e.b.points.shelter_lift.flags.repair = true;
  });
  once("railDepot", () => district("railDepot"));
  once("shipyard", () => {
    e.b.unlocked.shipyard = true;
    e.s.visited.shipyard = true;
  });
  once("murals", () => (e.ss.ali.murals = Math.max(e.ss.ali.murals || 0, 2)));
  once("alan", () => Object.assign(e.w.alan, { phase: "left", sheep: 2, woolDay: day }));
  once("museum", () => (e.w.museum.built = true));
  once("he", () => (e.ss.he.stage = Math.max(e.ss.he.stage || 0, 4)));
  once("gun", () => {
    if (e.s.horde.phase === "locked") e.s.horde = { phase: "warning", timer: 90, remaining: 8, spawnTimer: 0 };
  });
  once("frost", () => {
    e.b.unlocked.frost = true;
    e.s.visited.frost = true;
  });
}

// ---------------- 种田（照四时台；种什么看清单还缺哪样）----------------
const CROP_POOL = ["radish", "potato", "bean", "tomato", "corn", "pumpkin", "herb", "cotton", "rye", "glowBean"];
// 每样菜手上留多少（做菜、交清单、喂鸡羊），多出来的按卖价卖掉
const KEEP = { potato: 24, tomato: 16, bean: 16, corn: 12, pumpkin: 6, herb: 14, cotton: 12, radish: 16, rye: 10, glowBean: 6 };
function listNeedOf(e, id) {
  let n = 0;
  for (const L of RD.LIST_IDS) {
    if (e.listDone(L)) continue;
    for (const [k, m] of RD.LISTS[L].need) if (k === id) n += Math.max(0, m - e.listGot(L, k));
  }
  // v0.34：开了的第二年清单也算
  for (const L of L2) {
    if (!e.list2Open?.(L) || e.list2Done(L)) continue;
    for (const [k, m] of GD.LISTS2[L].need) if (k === id) n += Math.max(0, m - e.list2Got(L, k));
  }
  return n;
}
// 清单还要的东西拆成原料（做菜做药的配方拆一层，布再拆成棉花）
function rawNeeds(e) {
  const out = {};
  const add = (id, n) => (out[id] = (out[id] || 0) + n);
  const lists = [...RD.LIST_IDS.filter((L) => !e.listDone(L)).map((L) => [RD.LISTS[L].need, (k) => e.listGot(L, k)]), ...L2.filter((L) => e.list2Open?.(L) && !e.list2Done(L)).map((L) => [GD.LISTS2[L].need, (k) => e.list2Got(L, k)])];
  for (const [need, got] of lists) {
    for (const [k, m] of need) {
      const left = Math.max(0, m - got(k) - qty(e, k));
      if (!left) continue;
      add(k, left);
      const r = COOK.includes(k) ? recipeFor(k) : null;
      if (r) for (const [c, n] of Object.entries(r.cost)) add(c, Math.ceil(left / r.out[k]) * n);
    }
  }
  if (out.cloth) add("cotton", Math.ceil(out.cloth / 2) * 3);
  if (out.filterFabric) add("cotton", out.filterFabric * 3);
  return out;
}
const seedsOf = (c) => Object.keys(ITEMS).filter((id) => ITEMS[id].type === "seed" && ITEMS[id].crop === c && !ITEMS[id].mystery);
function cropWant(e, c, need) {
  const prime = "prime_" + c;
  let w = Math.max(0, (KEEP[c] || 6) - qty(e, c)) + (need[c] || 0) * 2 + listNeedOf(e, "fine_" + c) * 6 + (listNeedOf(e, prime) > qty(e, prime) ? 30 : 0);
  if (e.seasonKind?.(c) === "good") w *= 1.6;
  if (e.seasonKind?.(c) === "bad") w *= 0.5;
  return w;
}
function pickSeed(e, p, need) {
  const ok = CROP_POOL.filter((c) => CROPS[c] && seedsOf(c).some((id) => qty(e, id) > 0));
  const scored = ok.map((c) => [c, cropWant(e, c, need) + ((CROPS[c].yield * (ITEMS[c]?.sell || 0)) / CROPS[c].grow) * 20 * (e.seasonKind?.(c) === "good" ? 1.2 : 1) + (c === p.lastCrop ? -8 : 0)]);
  scored.sort((a, b) => b[1] - a[1]);
  if (!scored.length) return null;
  // 有带特性的种子先用
  return seedsOf(scored[0][0]).sort((a, b) => (b === CROPS[scored[0][0]].seed ? -1 : 0) - (a === CROPS[scored[0][0]].seed ? -1 : 0)).find((id) => qty(e, id) > 0);
}
function farmPass(e, X) {
  return e.zMine ? e.zMine(() => farmPass0(e, X)) : farmPass0(e, X);
}
function farmPass0(e, X) {
  if (e.s.region !== "farm") return;
  const need = rawNeeds(e);
  for (let i = 0; i < 18; i++) {
    const p = e.s.plots[i];
    at(e, p.x + 18, p.y + 6);
    e.s.player.stamina = Math.max(e.s.player.stamina, 60);
    e.s.player.hunger = Math.max(e.s.player.hunger, 60);
    while (e.giantOf?.(p) && e.giantHit(p)) X.harvests++;
    if (p.crop && CROPS[p.crop] && p.growth >= CROPS[p.crop].grow && e.handHarvest(p)) X.harvests++;
    if (e.g?.plots[p.id]?.w) e.pullWeed(p);
    if (e.g?.plots[p.id]?.b) e.catchBugs(p);
    if (e.plotDebris(p) || !p.tilled) e.toolPlot(p, "hoe");
    if (!p.crop && p.tilled) {
      const seed = pickSeed(e, p, need);
      if (seed) {
        if (!e.s.inventory[seed]) {
          const n = Math.min(10, e.s.storage[seed] || 0);
          e.s.inventory[seed] = n;
          e.s.storage[seed] -= n;
          if (!e.s.storage[seed]) delete e.s.storage[seed];
        }
        if (e.toolPlot(p, seed)) {
          // 清单要这种菜的上品、正当季：施一袋提质肥
          const c = p.crop;
          if (c && listNeedOf(e, "prime_" + c) > qty(e, "prime_" + c) && e.seasonKind?.(c) === "good" && (e.s.storage.fertCare || 0) > 0 && !e.fertReason(p, "care")) {
            if (e.applyFert(p, "care")) X.fert = (X.fert || 0) + 1;
          }
        }
      }
    }
    if (p.crop && !e.plotWatered(p)) {
      if ((e.c.water || 0) < 1) {
        at(e, 880, 330);
        e.refillWater();
        at(e, p.x + 18, p.y + 6);
      }
      e.toolPlot(p, "water");
    }
    if (p.crop && e.g?.plots[p.id]?.t !== e.s.day) e.tend(p);
  }
  stash(e);
}
// 种子：缺了在集市林姨那儿买（按买价扣钱）；黑麦自己留种
function buySeeds(e, X) {
  for (const id of SEED_BUY) {
    const n = qty(e, id);
    if (n >= 8) continue;
    const price = ITEMS[id]?.buy || 10;
    const k = Math.min(12 - n, Math.floor(e.s.money / price));
    if (k > 0) {
      e.s.money -= k * price;
      X.spent += k * price;
      put(e, { [id]: k });
    }
  }
  while (qty(e, "rye") > 2 && qty(e, "seedRye") < 8 && (e.s.buildings.some((b) => b.type === "breeder") || X.ms.frost)) {
    take(e, "rye", 1);
    put(e, { seedRye: 2 });
  }
}
// 多出来的菜按卖价卖掉（记下收成值）
function sellSurplus(e, X) {
  for (const c of Object.keys(CROPS)) {
    for (const id of [c, "fine_" + c, "hardy_" + c]) {
      if (!ITEMS[id]) continue;
      const keep = id === c ? (KEEP[c] || 6) + listNeedOf(e, c) + 4 : listNeedOf(e, id) + 2;
      const extra = qty(e, id) - keep;
      if (extra > 0) {
        take(e, id, extra);
        e.s.money += extra * (ITEMS[id].sell || 0);
        X.sold += extra * (ITEMS[id].sell || 0);
      }
    }
  }
}

// ---------------- 钓鱼（照人情浸泡）----------------
function fishOnce(e, water, X) {
  if (!e.kinCast(water)) return false;
  for (let t = 0; t < 8 && e.c.fishing && e.c.fishing.phase !== "bite"; t += DT) e.update(DT, { x: 0, y: 0 });
  if (e.c.fishing?.phase !== "bite") return false;
  e.interact();
  if (!e.reeling()) return false;
  const before = Object.values(e.kin.fish).reduce((a, b) => a + b, 0);
  let hold = true;
  for (let t = 0; t < 40 && e.reeling(); t += DT) {
    const R = e._reel;
    hold = !(R.pull > 0 || R.warn || R.tense > 0.8) && (hold || R.tense < 0.45);
    e.update(DT, { x: 0, y: 0, reel: hold });
    e.events.length = 0;
  }
  const got = Object.values(e.kin.fish).reduce((a, b) => a + b, 0) > before;
  if (got) X.fish++;
  return got;
}
function fishTrip(e, X, region, water, casts) {
  e.travel(region);
  if (e.s.region !== region) return;
  const W = KD.WATERS[water];
  at(e, W.x, W.y + 10);
  e.enemies.forEach((z) => (z.dead = true));
  for (let k = 0; k < casts; k++) fishOnce(e, water, X);
  stash(e);
  e.travel("farm");
}

// ---------------- 出门搜废墟 ----------------
function lootRegion(e, X, region) {
  e.travel(region);
  if (e.s.region !== region) return;
  const day = e.s.day;
  e.s.minute = Math.max(e.s.minute, 9 * 60 + 20);
  // 先把这张图上的感染者打完（头目出来的那天多打一会儿）
  const boss = () => e.enemies.some((z) => !z.dead && (z.boss || z.type === "elite"));
  run(e, boss() ? 240 : 90, () => !e.enemies.some((z) => !z.dead && !z.fled));
  // 柜子
  for (const o of e.objects.filter((o) => o.type === "crate" && o.ukind)) {
    if (o.locked) e.ut.pried[o.id] = day;
    at(e, o.x, o.y + 4);
    stash(e);
    e._picked = o;
    try {
      e.openContainer(o);
    } finally {
      e._picked = null;
    }
    if (e.s.opened[o.id]?.day === day) X.boxes++;
  }
  // 野物、残页说的藏货点
  for (const p of e.al?.forage.spots.filter((x) => x.region === region && !x.taken) || []) e.forageTake(p.id);
  for (const [id, d] of Object.entries(RD.DIGS)) {
    if (d.region !== region || !e.rlDigOpen(id)) continue;
    at(e, d.x, d.y);
    if (e.rlDig(id)) X.digs++;
  }
  // 掉在地上的
  for (const dr of (e.s.drops || []).filter((x) => x.region === region)) {
    e.receive(dr.items);
    e.s.drops = e.s.drops.filter((x) => x !== dr);
  }
  stash(e);
  e.travel("farm");
}
// 藏货点在别的地图：顺路走一趟
function digTrip(e, X) {
  for (const [id, d] of Object.entries(RD.DIGS)) {
    if (!e.rlDigOpen(id) || RUINS.includes(d.region)) continue;
    const open = d.region === "market" || e.d?.unlocked?.[d.region] || e.b?.unlocked?.[d.region];
    if (!open) continue;
    e.travel(d.region);
    if (e.s.region !== d.region) continue;
    e.enemies.forEach((z) => (z.dead = true));
    at(e, d.x, d.y);
    if (e.rlDig(id)) X.digs++;
    stash(e);
    e.travel("farm");
    return true;
  }
  return false;
}

// ---------------- 地铁隧道 ----------------
const LIFT_FLOORS = [5, 10, 15, 20, 25];
const EARLY = !!process.env.EARLY;
const storyGate = (e) => EARLY || e.storyDone();
function tunnelTrip(e, X, R) {
  if (!e.shaftOpen() || !storyGate(e)) return false;
  if (EARLY && !e._earlyPatched) {
    const real = e.tunnelReason.bind(e);
    e.tunnelReason = (f) => {
      const r = real(f);
      return /主线打完/.test(r) ? "" : r;
    };
    e._earlyPatched = true;
  }
  e.travel("shelter");
  if (e.s.region !== "shelter") return ((X.tunnelFail ||= []).push([e.s.day, "travel:" + e.s.region]), false);
  at(e, SHAFT.x, SHAFT.y);
  const from = Math.max(1, ...e.rl.tunnel.lifts);
  if (!e.tunnelEnter(from)) return ((X.tunnelFail ||= []).push([e.s.day, "enter:" + e.tunnelReason(from)]), false);
  X.trips++;
  // 这一趟（往下 5 层）会不会倒下：照隧道台带对装备的倒下率；倒下的话在这 5 层里的某一层
  const fall = R() < TFAIL ? from + Math.floor(R() * 5) : null;
  let floors = 0;
  for (let k = 0; k < 7 && e.inTunnel(); k++) {
    const L = e.tunnelLayoutNow(),
      f = L.floor;
    // 这一层：打倒碰到的（六成），柜子都开，修电梯，找梯子
    e.enemies.forEach((z) => {
      if (!z.dead && Math.random() < 0.6) {
        z.dead = true;
        e.afterKill?.(z);
      }
    });
    // 一层里的柜子不见得都找得到：七成（物资库都找得到）
    for (const o of e.objects.filter((o) => o.type === "crate" && (o.rlStore || R() < 0.7))) {
      at(e, o.x, o.y + 20);
      stash(e);
      e._picked = o;
      try {
        e.openContainer(o);
      } finally {
        e._picked = null;
      }
    }
    if (LIFT_FLOORS.includes(f) && !e.rl.tunnel.lifts.includes(f)) {
      const lift = e.objects.find((o) => o.type === "rlLift");
      if (lift) at(e, lift.x, lift.y + 20);
      // 材料是从上面带下来的（台子上为了好数，柜子里的东西都先放进了仓库）
      for (const [id, n] of Object.entries(e.liftCost(f))) {
        const k = Math.min(Math.max(0, n - (e.s.inventory[id] || 0)), e.s.storage[id] || 0);
        if (k) {
          e.s.storage[id] -= k;
          if (!e.s.storage[id]) delete e.s.storage[id];
          e.s.inventory[id] = (e.s.inventory[id] || 0) + k;
        }
      }
      if (!e.liftReason()) e.repairLift();
      else X.liftLack = (X.liftLack || 0) + 1;
    }
    if (f === 30) {
      const c = e.objects.find((o) => o.type === "rlCore");
      if (c) at(e, c.x, c.y + 20);
      e.takeCore();
      break;
    }
    // 一层按隧道台的平均 75 分钟
    e.s.player.stamina = Math.max(e.s.player.stamina, 40);
    e.advanceMinutes(75);
    if (!e.inTunnel()) break;
    if (fall !== null && f >= fall) {
      X.falls++;
      break;
    }
    // 到了下一部电梯：今天就到这儿
    if (f !== from && LIFT_FLOORS.includes(f)) break;
    const lad = L.ladders[0];
    if (!lad) break;
    at(e, lad.x, lad.y);
    if (!e.tunnelDown()) break;
    floors++;
  }
  X.floors += floors;
  stash(e);
  if (e.inTunnel()) e.tunnelLeave("farm");
  if (e.s.region !== "farm") e.travel("farm");
  return true;
}

// ---------------- 傍晚：做菜做药、交清单、捐旧物、撬铁盒 ----------------
// 清单要的菜和药：照配方扣材料（不算灶台上的时间）
const COOK = ["bandage", "medkit", "herbTea", "remedy", "stew", "fishStew", "radishCake", "beanCake", "jam", "alDumpling", "bread", "trailRye", "armyStew", "cloth", "ammo"];
const recipeFor = (id) => RECIPES.find((r) => r.out?.[id] && !Object.keys(r.cost).some((k) => ITEMS[k]?.type === "seed"));
// 何大勺教的菜：他入伙以前不会做
const HE_ONLY = ["radishCake", "armyStew", "beanCake"];
// 做菜做药不吃掉清单自己还要的那几样（比如清单要棉花 3，就留 3 份棉花不织布）
const spare = (e, id) => qty(e, id) - listNeedOf(e, id);
function cookForLists(e, X) {
  for (let round = 0; round < 3; round++)
    for (const id of COOK) {
      let want = listNeedOf(e, id) - qty(e, id);
      // 布、干粮：做清单的同时也做一点备着
      if (id === "cloth") want = Math.max(want, listNeedOf(e, "filterFabric") * 2 + 8 - qty(e, "cloth"));
      // 晚饭要三样以上的饭菜（生活水准第二级“吃得好”）：干粮、炖汤、番茄罐头都备一点
      if (id === "bread") want = Math.max(want, 14 - qty(e, "bread"));
      if (id === "stew") want = Math.max(want, 6 - qty(e, "stew"));
      if (id === "jam") want = Math.max(want, 4 - qty(e, "jam"));
      const r = HE_ONLY.includes(id) && !X.ms.he ? null : recipeFor(id);
      while (want > 0 && r && Object.entries(r.cost).every(([k, n]) => spare(e, k) >= n)) {
        pay(e, r.cost);
        put(e, r.out);
        want -= r.out[id];
        X.cooked++;
      }
    }
}
function giveMissing(e, X, day) {
  for (const [id, g] of Object.entries(GIVE)) {
    if (day < g.from) continue;
    if (id === "seedRye") {
      if (!X.gave.seedRye) {
        put(e, { seedRye: g.n });
        X.gave.seedRye = day;
      }
      continue;
    }
    const need = g.always ? qty(e, id) + 1 : listNeedOf(e, id) + (id === "salt" ? Math.ceil(listNeedOf(e, "trailRye") / 2) : 0);
    if (need <= qty(e, id)) continue;
    if (g.always && qty(e, id) >= 6) continue;
    if ((day - g.from) % g.every) continue;
    if (g.cost) {
      if (e.s.money < g.cost) continue;
      e.s.money -= g.cost;
      X.spent += g.cost;
    }
    if (g.pay && !pay(e, g.pay)) continue;
    put(e, { [id]: g.n });
    X.given[id] = (X.given[id] || 0) + g.n;
  }
}
function deliverAll(e, X) {
  // 重建站被尸潮、灰隼团打坏了：走到跟前按 E 修（木材 2、废金属 1）
  const broken = e.s.buildings.find((b) => b.type === RD.STATION.type && b.hp < BUILDINGS[RD.STATION.type].hp * 0.7);
  if (broken && e.s.region === "farm") {
    at(e, broken.x, broken.y + 50);
    e.interact();
    if (broken.hp >= BUILDINGS[RD.STATION.type].hp * 0.7) X.stationFixes = (X.stationFixes || 0) + 1;
  }
  const st = e.rlStationB();
  if (!st) return;
  at(e, st.x, st.y + 50);
  // 勤快的玩家留着修下一部检修电梯的材料（零件、电路、灯泡、道钉），不全交到清单上：先收起来，交完再放回仓库
  const next = storyGate(e) && e.shaftOpen() ? LIFT_FLOORS.find((f) => !e.rl.tunnel.lifts.includes(f)) : null;
  const held = {};
  for (const [id, n] of Object.entries((next && e.liftCost(next)) || {})) {
    let k = n;
    for (const box of [e.s.inventory, e.s.storage]) {
      const t = Math.min(k, box[id] || 0);
      if (!t) continue;
      box[id] -= t;
      if (!box[id]) delete box[id];
      held[id] = (held[id] || 0) + t;
      k -= t;
    }
  }
  try {
    for (const L of RD.LIST_IDS) {
      if (e.listDone(L)) continue;
      for (const [k] of RD.LISTS[L].need) if (!e.rlDeliverReason(L, k) && e.rlDeliver(L, k) && e.listDone(L)) X.lastKey[L] = k;
    }
    // v0.34：第二年的清单（开了的）
    for (const L of L2) {
      if (!e.list2Open?.(L) || e.list2Done(L)) continue;
      for (const [k] of GD.LISTS2[L].need) if (!e.list2Reason(L, k)) e.list2Deliver(L, k);
      if (e.list2Done(L)) (X.lists2 ||= {})[L] = e.s.day;
    }
  } finally {
    for (const [id, n] of Object.entries(held)) e.s.storage[id] = (e.s.storage[id] || 0) + n;
  }
}
function donateAll(e, X) {
  if (!e.w?.museum?.built) return;
  at(e, WSPOTS.museum.x, WSPOTS.museum.y + 20);
  for (const id of RD.OLD_IDS) if (!e.donateOldReason(id)) e.donateOld(id);
}
function boxes(e, X) {
  for (let k = 0; k < 4 && qty(e, "rlIronBox") > 0; k++) {
    if (qty(e, "parts") < 3) break;
    if (e.rlBoxReason()) break;
    e.rlOpenBox();
    X.ironBoxes++;
  }
}
// 送礼、营火夜谈（照人情浸泡）
const near = (e, id) => {
  const w = e.whereNow(id);
  if (w.away || w.region !== e.s.region) return false;
  at(e, w.x, w.y + 20);
  return true;
};
function gifts(e, day) {
  if (!e.kin) return;
  e.s.minute = Math.max(e.s.minute, 9 * 60);
  const ids = e
    .people()
    .map((p) => p.id)
    .filter((id) => !e.whereNow(id).away && e.whereNow(id).region === "farm");
  for (let k = 0; k < 2 && ids.length; k++) {
    const id = ids[(day * 2 + k) % ids.length];
    if (!near(e, id)) continue;
    const o = e.giftOptions(id);
    const item = o.known[0] || o.tries[0];
    if (item && !e.giftReason(id, item)) e.giveGift(id, item);
  }
}

// ---------------- v0.33「盼头」：下午的事、这周的事、把钱花出去 ----------------
const HOPE = typeof Engine.prototype.noonEnsure === "function";
const RESERVE = 2500;
const toBag = (e, ids, n) => {
  let left = n;
  for (const id of ids) {
    const k = Math.min(left, e.s.storage[id] || 0);
    if (!k) continue;
    e.s.storage[id] -= k;
    if (!e.s.storage[id]) delete e.s.storage[id];
    e.s.inventory[id] = (e.s.inventory[id] || 0) + k;
    left -= k;
  }
};
function openNoonBoxes(e, X) {
  for (const o of e.objects.filter((o) => o.type === "crate" && o.noon)) {
    at(e, o.x, o.y + 4);
    stash(e);
    e._picked = o;
    try {
      e.openContainer(o);
    } finally {
      e._picked = null;
    }
  }
}
function hopeNoon(e, X) {
  if (!HOPE || !e.hp) return;
  const N = e.noonEnsure();
  if (!N?.kind || N.day !== e.s.day) return;
  X.noonDay ||= {};
  X.noonDay[e.s.day] = N.kind;
  if (e.s.minute < 14 * 60 + 5) toMinute(e, 14 * 60 + 5);
  if (N.st !== "on") return;
  X.noonKinds ||= [];
  if (!X.noonKinds.includes(N.kind)) X.noonKinds.push(N.kind);
  X.noon ||= {};
  if (N.kind === "drop" || N.kind === "truck") {
    e.travel(N.region);
    if (e.s.region !== N.region) return;
    run(e, 60, () => !e.enemies.some((z) => !z.dead && !z.fled));
    openNoonBoxes(e, X);
    if (N.kind === "drop" && N.st === "on") {
      // 16:00 以后围上来的那几只：打完再开
      run(e, 60, () => !e.enemies.some((z) => !z.dead && !z.fled));
      openNoonBoxes(e, X);
    }
  } else if (N.kind === "survivor") {
    e.travel(N.region);
    if (e.s.region !== N.region) return;
    run(e, 60, () => !e.enemies.some((z) => !z.dead && !z.fled));
    const o = e.objects.find((x) => x.type === "hpSurvivor");
    if (o) {
      Object.assign(e.s.player, e.freePoint(o.x + 30, o.y));
      e.hpSurvivorGo();
      const exit = REGIONS[N.region]?.exit || { x: 95, y: 523 };
      for (let i = 0; i < 2400 && N.st === "on" && N.follow; i++) {
        const p = e.s.player;
        e.invulnerable = 1e9;
        p.stamina = Math.max(p.stamina, 60);
        const path = e.pathTo(p, exit),
          nx = path[0] || exit,
          a = Math.atan2(nx.y - p.y, nx.x - p.x);
        if (Math.hypot(o.x - p.x, o.y - p.y) > 110) e.update(DT, {});
        else e.update(DT, { x: Math.cos(a), y: Math.sin(a) });
        e.events.length = 0;
      }
    }
  } else if (N.kind === "peddler") {
    at(e, HD.PEDDLER_SPOT.x, HD.PEDDLER_SPOT.y + 30);
    const o = e.peddlerOffer(N);
    if (!e.peddlerReason("sell") && e.s.money >= RESERVE + o.price) e.peddlerTrade("sell");
    if (!e.peddlerReason("swap")) e.peddlerTrade("swap");
  } else if (N.kind === "buyer") {
    if (N.region !== "farm") {
      toBag(e, e.hpAccepts(N.item), N.n);
      e.travel(N.region);
    }
    if (e.s.region === N.region) {
      const q = e.buyerSpot(N);
      at(e, q.x, q.y + 20);
      e.buyerSell();
    }
  } else if (N.kind === "shoal") {
    const region = N.water === "river" ? "valley" : "farm";
    fishTrip(e, X, region, N.water, 4);
  }
  if (["done"].includes(N.st) || (N.kind === "shoal" && N.caught)) X.noon[N.kind] = (X.noon[N.kind] || 0) + 1;
  stash(e);
  if (e.s.region !== "farm") e.travel("farm");
}
// 这周的事：头目那几天去打一回；过路人要的东西给他；唐九的稀罕货和收菜；清单在交重建站时一起交
function hopeBoss(e, X) {
  if (!HOPE || !e.hp) return false;
  const W = e.weekEnsure();
  if (!W || W.kind !== "boss" || W.st !== "on") return false;
  e.travel(W.region);
  if (e.s.region !== W.region) return false;
  at(e, W.lair.x - 200, W.lair.y);
  run(e, 300, () => !e.enemies.some((z) => z.hpBoss && !z.dead));
  run(e, 60, () => !e.enemies.some((z) => !z.dead && !z.fled));
  stash(e);
  e.travel("farm");
  return true;
}
function hopeEvening(e, X) {
  if (!HOPE || !e.hp || e.s.region !== "farm") return;
  const W = e.weekEnsure();
  if (W?.kind === "traveler" && W.st === "here") {
    at(e, HD.TRAVEL.spot.x, HD.TRAVEL.spot.y + 30);
    if (!e.travelerReason()) e.travelerGive();
  }
  if (W?.kind === "caravan" && W.st === "here" && e.caravanHere()) {
    for (const o of e.o.caravan.offers.filter((o) => o.hpGood && !o.sold)) if (!e.goodReason(o.hpGood) && e.s.money >= RESERVE + HD.GOODS[o.hpGood].price) e.buyOffer(o.key);
    if (!e.caravanSellReason()) e.caravanSell();
  }
  if (W?.kind === "list" && W.st === "open") {
    const st = e.rlStationB();
    if (st) {
      at(e, st.x, st.y + 50);
      for (const [k] of HD.WEEK_LISTS[W.id].need) if (!e.weekListReason(k)) e.weekListGive(k);
    }
  }
  // 旧站商街这周的稀罕货：买得起就去买
  const m = e.marketGood();
  if (m && !m.sold && !e.goodReason(m.good) && e.s.money >= RESERVE + HD.GOODS[m.good].price && e.d?.unlocked?.stationMarket) {
    e.travel("stationMarket");
    if (e.s.region === "stationMarket") {
      const P = POINT_BY_ID.shops;
      at(e, P.x, P.y + 20);
      if (!e.districtQuote("shops", "hpGood").reason) e.districtAct("shops", "hpGood");
      e.travel("farm");
    }
  }
  // 墙升二级、扩建：便宜的先来；缺的木材、石材、废金属、零件、布、药草按买价补（铜线、灯泡、道钉、电路只用自己有的）
  const BUY = ["wood", "stone", "scrap", "parts", "cloth", "herb"];
  const opts = [];
  for (const w of Object.keys(HD.WALL2)) if (e.wallOn(w) && !e.wall2On(w)) opts.push(["w", w, HD.WALL2[w].cost]);
  for (const k of Object.keys(HD.EXPAND)) {
    const lv = e.hpLv(k);
    if (lv < HD.EXPAND[k].length) opts.push(["x", k, HD.EXPAND[k][lv].cost]);
  }
  opts.sort((a, b) => a[2].gold - b[2].gold);
  for (const [kind, id, cost] of opts) {
    let gold = cost.gold;
    const lack = {};
    for (const [k, n] of Object.entries(cost)) if (k !== "gold" && qty(e, k) < n) lack[k] = n - qty(e, k);
    if (Object.keys(lack).some((k) => !BUY.includes(k))) continue;
    for (const [k, n] of Object.entries(lack)) gold += n * (ITEMS[k]?.buy || ITEMS[k]?.sell * 2 || 10);
    if (e.s.money < RESERVE + gold) continue;
    for (const [k, n] of Object.entries(lack)) {
      e.s.money -= n * (ITEMS[k]?.buy || ITEMS[k]?.sell * 2 || 10);
      put(e, { [k]: n });
    }
    if (kind === "w") {
      const st = e.rlStationB();
      if (!st) continue;
      at(e, st.x, st.y + 50);
      e.wall2Up(id);
    } else e.expand(id);
  }
}

// ---------------- 一天 ----------------
function station(e, X) {
  if (e.rlStationB()) return true;
  // 缺的木材、石材、废金属在集市买（按买价）
  for (const [id, n] of Object.entries(RD.STATION.cost)) {
    const lack = n - qty(e, id),
      price = ITEMS[id]?.buy || 8;
    if (lack > 0 && e.s.money >= lack * price) {
      e.s.money -= lack * price;
      X.spent += lack * price;
      put(e, { [id]: lack });
    }
  }
  if (qty(e, "wood") < 20 || qty(e, "stone") < 12 || qty(e, "scrap") < 8) return false;
  for (const [id, n] of Object.entries(RD.STATION.cost)) {
    take(e, id, n);
    e.s.inventory[id] = (e.s.inventory[id] || 0) + n;
  }
  if (!e.startBuild("rlStation")) return false;
  for (const y of [640, 700, 760, 580, 260])
    for (let x = 220; x <= 1340; x += 40) {
      at(e, x, y - 60);
      if (!e.buildReason("rlStation", x, y) && e.placeBuilding(x, y)) {
        e.buildMode = null;
        return true;
      }
    }
  e.buildMode = null;
  return false;
}

function life(seed) {
  Math.random = seeded(seed * 7919 + 13);
  const R = seeded(seed * 104729 + 7);
  const st = freshState();
  st.undertow.seed = 6000 + seed;
  let e = new Engine(st, () => {});
  hook(e);
  e.paused = false;
  if (e.feel?.open) e.feel.open.phase = "done";
  // 开局：机器人手上的钱和材料照新档，另外一把铁头矛（打得快一点，只为了省跑模拟的时间）
  e.s.inventory.ironspear = 1;
  e.gr.slots.melee = "ironspear";
  e.s.slot = 3;
  e.s.inventory.flashlight = 1;
  const X = { fun: { toasts: [], big: [], moments: [], seen: {}, worth: [], floats: [], earn: {}, spend: {}, big3k: [] }, seed, act: 0, ms: {}, gave: {}, given: {}, harvests: 0, sold: 0, spent: 0, fish: 0, boxes: 0, digs: 0, trips: 0, floors: 0, falls: 0, cooked: 0, ironBoxes: 0, errors: [], lists: {}, walls: {}, cores: {}, reviews: [], old: [], pages: [], lamps: [], money: [], cropValue: [], deepest: [], nights: 0, held: 0, ladder: [], morale: [], hordes: 0, lastKey: {}, net: [] };
  const lists0 = new Set();
  CUR = FUN ? X.fun : null;
  for (let day = 1; day <= DAYS && e; day++) {
    try {
      if (e.s.day !== day) X.errors.push("day drift " + e.s.day + " vs " + day);
      e.paused = false;
      if (e.dy) e.dy.pending = null;
      if (e.feel?.open) e.feel.open.phase = "done";
      milestones(e, day, X);
      e.s.minute = Math.max(e.s.minute, 6 * 60);
      if (e.s.region !== "farm") e.travel("farm");
      // 尸潮来了：先守农场
      const defend = () => {
        if (!["warning", "active"].includes(e.s.horde.phase)) return;
        if (e.s.region !== "farm") e.travel("farm");
        at(e, 900, 470);
        run(e, 900, () => !["warning", "active"].includes(e.s.horde.phase));
      };
      defend();
      // 08:00 田
      toMinute(e, 8 * 60);
      buySeeds(e, X);
      farmPass(e, X);
      if (station(e, X) && !X.stationDay) X.stationDay = day;
      // 上午出门：主线打完以后隔天下隧道；别的日子搜废墟（头目那天去打头目）
      const today = e.s.day;
      const ruinsOpen = day >= MS.ruins ? RUINS : ["residential"];
      let where = ruinsOpen[day % ruinsOpen.length];
      for (const [r, f] of Object.entries(BOSS_DAY)) if (ruinsOpen.includes(r) && f(day)) where = r;
      // 隧道：还要往下走、还缺隧道里的东西（铜线、灯泡、道钉、继电器、隧道里的旧物）就隔天去，都齐了四天去一趟
      const tunnelNeeds = e.rl.tunnel.deepest < 30 || ["rlCopper", "rlBulb", "rlSpike", "rlRelay"].some((id) => listNeedOf(e, id) > qty(e, id)) || RD.OLD_IDS.some((id) => RD.OLD[id].home.region === "tunnel" && !e.oldDonated(id) && !qty(e, id));
      const tunnelDay = storyGate(e) && e.shaftOpen() && day % (tunnelNeeds ? 2 : 4) === 0;
      // 隧道下不去（灰隼团要来了之类）就照平常搜废墟
      let tripKind = "loot";
      if (tunnelDay && tunnelTrip(e, X, R)) tripKind = "tunnel";
      else if (!hopeBoss(e, X)) lootRegion(e, X, where);
      else tripKind = "boss";
      const tripEnd = Math.round(e.s.minute);
      // 溪谷的河每 4 天、沉湾的海每 7 天；清单还缺哪种鱼、正是它的时节，就隔一天去一回、多钓几竿
      const sid = e.season?.()?.id || "";
      const wantFish = (id) => listNeedOf(e, id) > qty(e, id);
      const riverNow = wantFish("kinMandarin") && sid === "harvest";
      const seaNow = (wantFish("kinCroaker") && ["thaw", "harvest"].includes(sid)) || wantFish("kinSeabass");
      if (e.s.day === today && e.d.unlocked.valley && (day % 4 === 1 || (riverNow && day % 2 === 1))) fishTrip(e, X, "valley", "river", riverNow ? 4 : 2);
      if (e.s.day === today && e.b.unlocked.shipyard && (day % 7 === 3 || (seaNow && day % 2 === 1))) fishTrip(e, X, "shipyard", "sea", seaNow ? 4 : 2);
      if (e.s.day === today && day % 3 === 0) digTrip(e, X);
      if (e.s.region !== "farm") e.travel("farm");
      // 中午回来在池塘钓一回（鲫鱼只在白天）
      if (e.s.day === today && e.s.region === "farm" && e.s.minute < 15 * 60) {
        toMinute(e, 12 * 60);
        at(e, KD.WATERS.pond.x, KD.WATERS.pond.y + 10);
        fishOnce(e, "pond", X);
        stash(e);
      }
      // 14:00 下午的事
      const noonAt = Math.round(e.s.minute);
      if (e.s.day === today) hopeNoon(e, X);
      if (process.env.DAYLOG && e.hp) {
        const N = e.hp.noon;
        X.dayLog ||= {};
        X.dayLog[today] = { trip: tripKind, tripEnd, noonAt, kind: N?.day === today ? N.kind : "", st: N?.day === today ? N.st : "", region: N?.region || "", after: Math.round(e.s.minute) };
      }
      // 16:00 田
      if (e.s.day === today) {
        if (e.s.region !== "farm") e.travel("farm");
        toMinute(e, 16 * 60);
        farmPass(e, X);
      }
      // 黄辣丁傍晚以后才出来
      if (e.s.day === today && e.d.unlocked.valley && listNeedOf(e, "kinYellowCat") > qty(e, "kinYellowCat") && day % 2 === 0) {
        toMinute(e, 17 * 60 + 30);
        fishTrip(e, X, "valley", "river", 3);
      }
      // 傍晚
      if (e.s.day === today && e.s.region === "farm") {
        if (e.al) {
          for (const b of e.s.buildings.filter((x) => x.type === "alPickleJar" || x.type === "alWineJar")) {
            const s = e.jarState(b.id).state;
            if (s === "aged" || (s === "ready" && listNeedOf(e, b.type === "alPickleJar" ? "alPickle" : "alWine") > qty(e, b.type === "alPickleJar" ? "alPickle" : "alWine"))) e.jarTake(b.id);
            if (e.jarState(b.id).state === "empty") {
              const item = b.type === "alPickleJar" ? (qty(e, "radish") >= 4 ? "radish" : "potato") : qty(e, "rye") >= 4 ? "rye" : "corn";
              if (qty(e, item) >= 4) {
                at(e, b.x, b.y + 30);
                e.jarFill(b.id, item);
              }
            }
          }
          for (const k of ["flock", "goat"]) if (!e.herdPetReason(k)) e.herdPet(k);
          e.collectAnimals();
          e.feedAnimals();
          for (const p of e.al.forage.spots.filter((x) => x.region === "farm" && !x.taken)) e.forageTake(p.id);
          if (!e.mushroomReason()) e.identifyMushrooms();
        }
        gifts(e, day);
        at(e, KD.WATERS.pond.x, KD.WATERS.pond.y + 10);
        fishOnce(e, "pond", X);
        giveMissing(e, X, day);
        cookForLists(e, X);
        stash(e);
        deliverAll(e, X);
        donateAll(e, X);
        boxes(e, X);
        // 收获展：每周送一样菜（丰收评比的一颗星要它）
        if (day >= MS.exhibit && e.f?.exhibition && !e.f.exhibition.entries.length && !e.f.exhibition.judged) {
          const c = ["fine_potato", "fine_tomato", "fine_bean", "potato", "tomato", "bean", "corn", "radish"].find((id) => spare(e, id) > 0);
          if (c) e.enterExhibition(c);
        }
        // 节庆（16:00 后）
        if (e.isFestivalDay?.() && e.festivalsOpen?.() && !e.festivalHosted?.() && !e.lnPending?.()) {
          e.s.minute = Math.max(e.s.minute, 16 * 60 + 5);
          at(e, SSPOTS.plaza.x, SSPOTS.plaza.y + 20);
          for (const id of e.festPickable().slice(0, 3)) e.festPick(id);
          e.hostFestival();
        }
        // 天黑以后再钓一回（金尾夜鱼）、营火夜谈
        toMinute(e, 19 * 60 + 15);
        at(e, KD.WATERS.pond.x, KD.WATERS.pond.y + 10);
        fishOnce(e, "pond", X);
        const f = e.fireSpot?.();
        if (f && day % 3 === 0 && !e.lnPending?.()) {
          at(e, f.x, f.y + 10);
          e.talk(["past", "future", "today"][(day / 3) % 3]);
        }
        sellSurplus(e, X);
        stash(e);
        deliverAll(e, X);
        hopeEvening(e, X);
        if (e.s.region !== "farm") e.travel("farm");
        stash(e);
      }
      // 尸潮
      if (e.s.day === today) defend();
      // 长夜：机器人守（不会倒下）
      if (e.lnPending?.() && e.s.day === today) {
        if (e.s.region !== "farm") e.travel("farm");
        e.s.minute = Math.max(e.s.minute, 1319.9);
        at(e, 830, 480);
        X.nights++;
        run(e, 900, () => !e.ln.night && e.ln.lastDay === today);
        if (e.ln.last?.held && e.ln.lastDay === today) X.held++;
      }
      // 21:00（守夜纪念日有年终评定）、睡觉
      if (e.s.day === today && e.s.minute < 21 * 60 + 5) toMinute(e, 21 * 60 + 5);
      if (e.s.day === today && e.s.minute < 22 * 60) toMinute(e, 22 * 60);
      if (e.s.day === today && !e.sleep()) {
        e.s.minute = Math.max(e.s.minute, 1430);
        run(e, 30);
        e.sleep();
      }
      if (e.s.day === today) {
        // 睡不了（半夜还在打）：直接过到第二天早上
        run(e, 120, () => e.s.day !== today);
        if (e.s.day === today) e.advanceMinutes(1440 - e.s.minute + 6 * 60);
      }
      // 记
      for (const L of e.rl.done) if (!lists0.has(L)) (lists0.add(L), (X.lists[L] = today));
      for (const w of RD.WALL_IDS) if (e.wallOn(w) && !X.walls[w]) X.walls[w] = today;
      for (const c of e.rl.cores) if (!X.cores[c]) X.cores[c] = today;
      X.old[today] = e.rl.old.length;
      X.pages[today] = e.rl.pages.length;
      X.deepest[today] = e.rl.tunnel.deepest;
      for (const r of e.rl.reviews) if (!X.reviews.some((q) => q.day === r.day)) X.reviews.push({ day: r.day, lamps: r.lamps, s: r.s, v: r.v });
      X.money[today] = e.s.money;
      funDay(e, X, today);
      X.net[today] = X.sold - X.spent;
      X.hordes = e.s.stats.hordes || 0;
      X.ladder[today] = e.w?.ladder || 0;
      X.morale[today] = e.c.residents.length ? Math.round(e.c.residents.reduce((a, r) => a + (r.morale ?? 60), 0) / e.c.residents.length) : 0;
      if (process.env.SHOW) console.error("day", today, "walls", Object.keys(X.walls).join(","), "lists", e.rl.done.length, "old", e.rl.old.length, "pages", e.rl.pages.length, "deep", e.rl.tunnel.deepest, "cores", e.rl.cores.join(","), "money", Math.round(e.s.money), "region", e.s.region);
      // 存档、读回
      const text = e.serialize();
      if (/NaN|undefined/.test(text)) {
        X.errors.push("day " + today + ": save text has NaN/undefined");
        // BAD_DUMP=文件名：第一份有问题的存档写出来查
        if (process.env.BAD_DUMP && !X.badDumped) FS.writeFileSync(process.env.BAD_DUMP, text), (X.badDumped = true);
      }
      const back = Engine.parse(text);
      e = new Engine(back, () => {});
      hook(e);
      e.paused = false;
    } catch (err) {
      X.errors.push("day " + day + ": " + String(err.stack || err).split("\n").slice(0, 4).join(" | "));
      break;
    }
  }
  if (e?.hp) X.hope = { ...e.hp.stats, goods: Object.keys(e.hp.goods).length, wall2: Object.keys(e.hp.wall2).length, expand: Object.values(e.hp.expand).reduce((a, b) => a + b, 0), letters: e.hp.letters.length, met: e.hp.met.length };
  // v0.34：第 120 天还有哪些长期目标没做完（第二年的清单、打法挑战、技能 6–10 级）
  if (e?.gw)
    X.grow = {
      ...e.gw.stats,
      lists2: Object.keys(e.gw.l2done).length,
      lists2Max: L2.length,
      wall2Free: Object.keys(e.gw.w2).length,
      challenges: Object.keys(e.gw.chDone),
      levels: Object.fromEntries(Object.keys(GD.MASTER_XP).map((k) => [k, e.masterLv(k)])),
      ups: e.masterUps(),
      upsMax: Object.keys(GD.MASTER_XP).length * 5,
      completion: e.rlCompletion().pct,
      core: e.rlCompletion().core,
      left: L2.filter((L) => !e.list2Done(L)).map((L) => L + (e.list2Open(L) ? "" : "(未开)")),
    };
  X.oldMissing = e ? RD.OLD_IDS.filter((id) => !e.oldDonated(id)).map((id) => id + "@" + RD.OLD[id].home.region + ":" + RD.OLD[id].home.kinds.join("/") + (qty(e, id) ? "(有)" : "")) : [];
  X.end = e ? { day: e.s.day, lists: e.rl.done.length, walls: e.wallsOn?.().length, old: e.rl.old.length, pages: e.rl.pages.length, cores: [...e.rl.cores], deepest: e.rl.tunnel.deepest, completion: e.rlCompletion().pct, money: Math.round(e.s.money), trust: Object.fromEntries(Object.entries(e.ss.trust).filter(([, v]) => v > 0)), held: e.ln.held, have: Object.fromEntries(RD.LIST_IDS.filter((L) => !e.listDone(L)).map((L) => [L, RD.LISTS[L].need.filter(([k, n]) => e.listGot(L, k) < n).map(([k, n]) => k + " " + e.listGot(L, k) + "/" + n + " (有" + e.listHave(k) + ")").join("; ")])) } : null;
  return X;
}

if (MODE === "year") {
  const rows = SEEDS.map(life);
  const firstAt = (arr, n) => {
    for (let d = 1; d < arr.length; d++) if ((arr[d] || 0) >= n) return d;
    return null;
  };
  for (const X of rows) {
    const wallDays = Object.values(X.walls).sort((a, b) => a - b);
    const listDays = Object.values(X.lists).sort((a, b) => a - b);
    const pages = X.pages.filter((x) => x !== undefined);
    const lastDay = X.pages.length - 1;
    console.log(
      JSON.stringify(
        {
          seed: X.seed,
          walls: X.walls,
          firstWall: wallDays[0] ?? null,
          allWalls: wallDays.length === 6 ? wallDays[5] : null,
          lists28: listDays.length === 28 ? listDays[27] : listDays.length + " 份",
          old48: firstAt(X.old, 48) ?? (X.old[lastDay] || 0) + " 件",
          old: { d28: X.old[28], d56: X.old[56], d84: X.old[84], d100: X.old[100], d120: X.old[120], missing: X.oldMissing },
          pages: { d28: X.pages[28], d56: X.pages[56], d84: X.pages[84], d120: X.pages[120], perPage: pages.length && X.pages[lastDay] ? +(lastDay / X.pages[lastDay]).toFixed(1) : null, all24: firstAt(X.pages, 24) },
          tunnel30: firstAt(X.deepest, 30),
          deepest: { d35: X.deepest[35], d40: X.deepest[40], d50: X.deepest[50] },
          cores: X.cores,
          reviews: X.reviews,
          trips: X.trips,
          liftLack: X.liftLack || 0,
          hordes: X.hordes,
          ladder: { d10: X.ladder[10], d20: X.ladder[20], d28: X.ladder[28], d40: X.ladder[40] },
          morale: { d10: X.morale[10], d20: X.morale[20], d28: X.morale[28], d40: X.morale[40] },
          stationDay: X.stationDay,
          stationFixes: X.stationFixes || 0,
          company: (() => {
            const total = RD.COMPANY.sign + Object.values(RD.COMPANY.price).reduce((a, b) => a + b, 0);
            const d = firstAt(X.net, total);
            return { total, payDay: d, doneDay: d ? d + 1 : null, net30: X.net[30] };
          })(),
          falls: X.falls,
          given: X.given,
          fish: X.fish,
          boxes: X.boxes,
          ironBoxes: X.ironBoxes,
          digs: X.digs,
          nights: X.nights + "/" + X.held,
          sold: X.sold,
          lists: Object.fromEntries(Object.entries(X.lists).map(([k, d]) => [k, d + " " + (X.lastKey[k] || "")])),
          end: X.end,
          hope: X.hope,
          grow: X.grow,
          lists2: X.lists2 || {},
          noon: X.noon,
          errors: X.errors.slice(0, 6),
          ...(FUN ? { fun: { toasts: X.fun.toasts.length, big: X.fun.big.length, moments: X.fun.moments.length, floats: X.fun.floats.at(-1) || 0 } } : {}),
        },
        null,
        1,
      ),
    );
  }
  if (FUN) console.log(JSON.stringify({ FUN: funSummary(rows, DAYS) }));
  // FUN_DUMP=文件名：把每条提示、每件好事都写进去（找哪些提示还太多用）
  if (FUN && process.env.FUN_DUMP) (await import("node:fs")).writeFileSync(process.env.FUN_DUMP, JSON.stringify(rows.map((X) => ({ seed: X.seed, ...X.fun, money: X.money, noonDay: X.noonDay || {}, hope: X.hope || null, grow: X.grow || null, lists2: X.lists2 || {}, noon: X.noon || {}, dayLog: X.dayLog || null, tunnelFail: X.tunnelFail || null, errors: X.errors }))));
}

if (MODE === "company") {
  const { execFileSync } = await import("node:child_process");
  const bench = new URL("./farm-bench.mjs", import.meta.url).pathname;
  const per = {};
  for (const m of ["busy", "diligent"]) {
    const out = JSON.parse(execFileSync("node", [bench, "base", "1,2,3", "30"], { env: { ...process.env, MODE: m }, maxBuffer: 1 << 26 }).toString());
    per[m] = out.out[0].cropPerDay;
  }
  const total = RD.COMPANY.sign + Object.values(RD.COMPANY.price).reduce((a, b) => a + b, 0);
  console.log("签约 " + RD.COMPANY.sign + " + 六面墙 " + Object.values(RD.COMPANY.price).join("/") + " = " + total + " 金币");
  console.log("忙的玩家每天收成值 " + per.busy + "（" + (total / per.busy).toFixed(1) + " 天）；勤快的 " + per.diligent + "（" + (total / per.diligent).toFixed(1) + " 天）");
}
