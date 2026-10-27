// 跟着手记走的机器人（v0.43 起放进仓库）：新开一个档，只照任务手记最上面那张主线卡做——
// 主线卡写的那一步、“标记地点”标出的地方（种地那一步是田里那一小步），走过去照着做；手记“今天”里写着的打退感染者也做；
// 饿了吃干粮，夜里回农舍睡。走路按走路的速度算时间（钟点照常走），走到了再站到那里。
// 同时按画面的节奏看上手那一层：每 0.25 秒看一眼走近了什么、每秒看一眼新出现的，小卡一张停 6.5 秒、菜单开着不算时间。
// 记：几点做完主线第一段、每一步几点开始、出现了哪些小卡、菜单里的格子几点出现；要用的菜单格还没出现就记一笔（不该有）。
// 用法：node scripts/guide-bot.mjs [种子,种子] [天数]   DIST=别的 dist 目录：拿同一个脚本去跑旧版本对照（旧版本没有上手那一层，只看主线）；FULL=1 小卡上的字全打出来
// 退出码：有一个种子在给的天数里没做完主线第一段、开局菜单不对、或者要用的菜单格还没出现，就是 1
const D = process.env.DIST ? new URL("file://" + process.env.DIST.replace(/\/?$/, "/")).href : new URL("../dist/", import.meta.url).href;
const C = await import(D + "campaign.js");
const PJ = await import(D + "player-journey.js");
const EZ = await import(D + "ease-data.js").catch(() => null);

const SEEDS = (process.argv[2] || "1,2,3,4,5").split(",").map(Number);
const DAYS = Number(process.argv[3] || 3);
const DT = 0.05;
const CARD_S = (EZ?.CARD_MS || 6500) / 1000;
const START_MENUS = ["rebuild", "inventory", "craft", "build", "pause"];
// FULL=1：小卡上的字全打出来
const FULL = !!process.env.FULL;

function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
const hhmm = (e) => "d" + e.s.day + " " + String(Math.floor(e.s.minute / 60)).padStart(2, "0") + ":" + String(Math.floor(e.s.minute % 60)).padStart(2, "0");

function run(seed) {
  Math.random = seeded(seed * 7919 + 13);
  const e = new C.Engine(C.newGameState("farmer"), () => {});
  e.paused = false;
  if (e.dy) e.dy.pending = null;
  const ease = typeof e.easeFresh === "function";
  const out = { seed, done: null, steps: [], cards: [], menus: [], problems: [] };
  // ---------- 画面的节奏：看一眼、排小卡、一张一张停 ----------
  let clock = 0,
    lastLook = -1,
    lastTick = -1,
    until = 0,
    showing = null,
    menusBefore = ease ? e.easeMenus() : [];
  if (ease) {
    if (menusBefore.join(",") !== START_MENUS.join(",")) out.problems.push("开局菜单是 " + menusBefore.join(",") + "，应该是 " + START_MENUS.join(","));
    if (e.easeMoraleVisible()) out.problems.push("开局菜单最上面一行就有士气");
  }
  const frame = () => {
    clock += DT;
    if (!ease) return;
    if (e.paused) {
      if (showing) until += DT;
      return;
    }
    if (clock - lastLook >= 0.25) {
      lastLook = clock;
      e.easeLook();
    }
    if (clock - lastTick >= 1) {
      lastTick = clock;
      e.easeTick();
      const now = e.easeMenus();
      for (const id of now) if (!menusBefore.includes(id)) out.menus.push(hhmm(e) + " " + id);
      for (const id of menusBefore) if (!now.includes(id)) out.problems.push(hhmm(e) + " 菜单格又没了：" + id);
      menusBefore = now;
    }
    if (showing && clock >= until) showing = null;
    if (!showing) {
      const c = e.easeNextCard();
      if (c) {
        showing = c;
        until = clock + CARD_S;
        out.cards.push(hhmm(e) + " " + c.tag + "：" + c.name + (FULL ? "｜" + [c.does, c.good, c.now].filter(Boolean).join("｜") : ""));
      }
    }
  };
  const tick = (input = { x: 0, y: 0 }) => {
    if (e.paused) e.paused = false;
    e.update(DT, input);
    frame();
  };
  const fightIfNear = () => {
    const p = e.s.player;
    const z = (e.enemies || []).filter((q) => !q.dead).sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0];
    if (!z || Math.hypot(z.x - p.x, z.y - p.y) > 260) return false;
    for (let t = 0; t < 30 && !z.dead; t += DT) {
      const dx = z.x - p.x,
        dy = z.y - p.y,
        d = Math.hypot(dx, dy);
      if (d > 55) tick({ x: dx / d, y: dy / d });
      else {
        e.use({ x: z.x, y: z.y - 20 });
        tick();
      }
    }
    return true;
  };
  const idle = (secs) => {
    for (let s = 0; s < secs; s += DT) {
      tick();
      fightIfNear();
    }
  };
  const walkTo = (t, r = 40) => {
    if (!t) return false;
    if (t.region && t.region !== e.s.region) {
      // 出门要地图：地图那一格得先出现
      if (ease && !e.easeMenuVisible("map")) out.problems.push(hhmm(e) + " 要出门去 " + t.region + "，菜单里还没有地图");
      e.travel(t.region);
      if (e.s.region !== t.region) return false;
    }
    const p = e.s.player,
      d = Math.hypot(t.x - p.x, t.y - p.y);
    if (d > r) {
      const secs = (d - r) / 165,
        ux = (t.x - p.x) / d,
        uy = (t.y - p.y) / d;
      for (let s = 0; s < secs; s += DT) tick();
      p.x = t.x - ux * r * 0.5;
      p.y = t.y - uy * r * 0.5 + 8;
    }
    return true;
  };
  let last = "",
    guard = 0;
  while (e.s.day <= DAYS && guard++ < 40000) {
    const p = e.s.player;
    if (p.hunger < 35) for (const id of ["bread", "trailBread", "radish", "potato"]) if (e.qty(id) > 0 && e.consume(id)) break;
    const m = e.s.minute;
    if ((m >= 23 * 60 || m < 5 * 60) && e.s.region === "farm") {
      walkTo({ region: "farm", x: 830, y: 470 }, 60);
      if (!e.sleep()) idle(30);
      else frame();
      continue;
    }
    if (e.todayItems().some((t) => /感染者还没打退/.test(t.text))) {
      const z = (e.enemies || []).find((q) => !q.dead);
      if (z) walkTo({ region: e.s.region, x: z.x, y: z.y }, 120);
      if (!fightIfNear()) idle(5);
      continue;
    }
    if (out.done || e.sc.claimed.includes("act1")) {
      if (!out.done) out.done = hhmm(e);
      // 主线第一段做完了：在农场里待着，接着看小卡（第 2、3 天早上那张）
      idle(20);
      continue;
    }
    const g = e.storyGoal?.();
    if (!g) {
      idle(10);
      continue;
    }
    const st = g.step,
      key = st.id + ":" + st.title;
    if (key !== last) {
      out.steps.push(hhmm(e) + " " + st.title);
      last = key;
    }
    if (st.id === "harvest") {
      const f = PJ.firstHarvestStep(e);
      if (!f) {
        walkTo({ region: "farm", x: 830, y: 480 });
        idle(5);
        continue;
      }
      const pl = f.plot;
      walkTo({ region: "farm", x: pl.x, y: pl.y }, 30);
      if (/清理|开垦/.test(f.title)) e.toolPlot(pl, "hoe");
      else if (/种下/.test(f.title)) e.toolPlot(pl, e.qty("seedRadish") ? "seedRadish" : "seedPotato");
      else if (/浇水/.test(f.title)) {
        if ((e.c.water || 0) < 1) {
          walkTo({ region: "farm", x: 880, y: 300 }, 40);
          e.interact();
          walkTo({ region: "farm", x: pl.x, y: pl.y }, 30);
        }
        e.toolPlot(pl, "water");
      } else if (/收下/.test(f.title)) e.handHarvest(pl);
      else idle(10);
      idle(1);
      continue;
    }
    if (st.id === "meal") {
      walkTo(st.target, 40);
      if (/做出第一份干粮/.test(st.title)) {
        // 做干粮要打开制作：那一格得先出现
        if (ease && !e.easeMenuVisible("craft")) out.problems.push(hhmm(e) + " 要做干粮，菜单里还没有制作");
        if (!e.craft("trailBread")) idle(10);
      } else idle(10);
      idle(1);
      continue;
    }
    if (st.id === "well") {
      walkTo(st.target, 40);
      if (!e.repairWell()) idle(10);
      continue;
    }
    if (st.id === "camp") {
      walkTo(st.target, 40);
      if (!e.buildCamp()) idle(10);
      continue;
    }
    if (st.id === "reply") {
      walkTo(st.target, 40);
      if (!e.replyAlliance()) idle(10);
      continue;
    }
    idle(10);
  }
  if (!out.done) out.problems.push("第 " + DAYS + " 天过完还没做完主线第一段（停在：" + (out.steps.at(-1) || "开头") + "）");
  return out;
}

let bad = 0;
const all = [];
for (const seed of SEEDS) {
  const r = run(seed);
  all.push(r);
  if (r.problems.length) bad++;
  console.log("种子 " + seed + "：主线第一段 " + (r.done || "没做完") + " · 小卡 " + r.cards.length + " 张 · 菜单新出现 " + r.menus.length + " 格");
  for (const s of r.steps) console.log("  步骤 " + s);
  for (const m of r.menus) console.log("  菜单 " + m);
  for (const c of r.cards) console.log("  小卡 " + c);
  for (const p of r.problems) console.log("  ✗ " + p);
}
const n = all.length,
  avg = (f) => (all.reduce((a, r) => a + f(r), 0) / n).toFixed(1);
console.log("合计：" + n + " 个种子，" + (n - bad) + " 个照手记走通；平均小卡 " + avg((r) => r.cards.length) + " 张、菜单新出现 " + avg((r) => r.menus.length) + " 格");
process.exit(bad ? 1 : 0);
