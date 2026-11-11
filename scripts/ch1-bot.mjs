// v0.50「落脚」：照手记走第一章的机器人。新开一个档，只做左下角“眼下的目标”写的那一步，
// 另外每天种地、做饭、出一趟门、选今天的事、夜里睡觉；到第 9 天夜里守第一场尸潮。
// 走路按走路的速度算时间，打架真打（会掉血、会倒下）：挥一下退一步，被抓住、被围住就推开；
// 考验那一夜陷阱摆在来路上，人站在路口里面等它们过来。发了烧去集市买药包。
// 用法：node scripts/ch1-bot.mjs [种子,种子] [最多几天]   SHOW=1 每一步打一行
// 量：第一章做完是第几天几点、折成真实时间多少分钟（醒着的一天 10 分钟，不算开着页面的时间）、
//     每一段几点开始、连着多久没有新东西也没有要决定的事、每天的钱粮料、倒下几回、尸潮守了几回。
// 另外：SAVES=目录 每进一段存一份档（给界面检查用；存档会多用几个随机数，同一个种子走出来的不一样）；
//       NOPREP=1 备战那一段什么都不备，量不备战时第一场尸潮守不守得住；NAIVE=1 打法换成站着硬打（不退、不推开）；
//       DEBUG=1、NEWS=1 多打几行。
// 退出码：有一个种子没在给的天数里做完第一章，或者做完时不在 1.5–3 小时里，就是 1。
const D = new URL("../dist/", import.meta.url).href;
const C = await import(D + "campaign.js");
const PJ = await import(D + "player-journey.js");
const { BUILDINGS, ITEMS, CROPS } = await import(D + "data.js");
const { ROAD } = await import(D + "handy-data.js");
const { EVENTS } = await import(D + "daily-data.js");
const { GATE1 } = await import(D + "chapter-data.js");

const SEEDS = (process.argv[2] || "1,2,3").split(",").map(Number);
const DAYS = Number(process.argv[3] || 14);
const DT = 0.05;
const TRAP_X = 1252; // 头一个陷阱摆在路上的哪儿（东边路口往里 180 步）
const SHOW = !!process.env.SHOW;
const NAIVE = !!process.env.NAIVE; // 不会打的：站着硬打，不退、不推开

function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

async function run(seed) {
  Math.random = seeded(seed * 7919 + 13);
  const toasts = [];
  const e = new C.Engine(C.newGameState("farmer"), (t, tone) => toasts.push({ t, tone }));
  e.paused = false;
  e.chSceneDone();
  const hhmm = () => "d" + e.s.day + " " + String(Math.floor(e.s.minute / 60)).padStart(2, "0") + ":" + String(Math.floor(e.s.minute % 60)).padStart(2, "0");
  const realMin = () => (e.s.day - 1) * 10 + Math.max(0, Math.min(960, e.s.minute - 360)) / 96;
  const out = { seed, done: null, doneReal: 0, stages: [], steps: [], deaths: 0, gateTries: 0, gateWon: false, gaps: [], days: [], news: [], problems: [], menus: {} };
  let lastNews = 0;
  const news = (what) => {
    const now = realMin();
    if (now - lastNews > 0) out.gaps.push({ at: hhmm(), min: +(now - lastNews).toFixed(1), then: what });
    lastNews = now;
    out.news.push(hhmm() + " " + what);
  };
  const seen = new Set();
  const first = (key, what) => {
    if (seen.has(key)) return;
    seen.add(key);
    news(what);
  };
  const drain = () => {
    for (const ev of e.events.splice(0)) {
      if (ev.type === "menu") {
        const k = ev.menu + (ev.view ? ":" + ev.view : "");
        out.menus[k] = (out.menus[k] || 0) + 1;
        if (ev.menu === "death") {
          out.deaths++;
          out.deathWhy = (out.deathWhy || "") + (e.lastDeath === "hunger" ? "饿" : "打") + e.s.day + (out.lastRegion === "farm" ? "家" : "外") + " ";
        }
        if (ev.menu === "ch" && ev.view === "boon") {
          const o = e.chTripOffer();
          if (o.length) {
            e.chPickBoon(o[0].id);
            news("这一趟挑了：" + o[0].name);
          }
        }
      } else if (ev.type === "bark") first("bark:" + ev.text, "队友说话");
    }
  };
  const tick = (input = { x: 0, y: 0 }) => {
    if (e.paused) e.paused = false;
    out.lastRegion = e.s.region;
    // 在外面血少了：撤
    if (e.s.region !== "farm" && e.s.region !== "market" && e.s.player.hp < 40 && e.s.player.hp > 0 && !out.fleeing) {
      out.fleeing = true;
      e.travel("farm");
      out.fleeing = false;
      out.retreats = (out.retreats || 0) + 1;
    }
    e.update(DT, input);
    drain();
    // 今天的事：挑头一个选得了的（不花东西的优先）
    const p = e.dailyCard?.();
    if (p && e.s.minute >= 360 && e.dailySafe()) {
      const opts = EVENTS[p.id].opts.map((o, i) => ({ i, why: e.optionReason(i, p), free: !o.cost && !o.pay && !o.p }));
      const pick = opts.find((o) => !o.why && o.free) || opts.find((o) => !o.why);
      if (pick && e.chooseDaily(pick.i)) news("今天的事：" + EVENTS[p.id].name);
      else if (e.dy) e.dy.pending = null;
    }
  };
  const P = () => e.s.player;
  const eat = () => {
    // 在农场：身上带三份干粮、两条绷带
    if (e.s.region === "farm") for (const [id, n] of [["bread", 3], ["bandage", 2]]) if (e.qty(id) < n && (e.s.storage[id] || 0) > 0) e.transfer(id, false, false);
    if (P().hunger < 40) for (const id of ["bread", "stew", "radish", "potato"]) if (e.qty(id) > 0 && e.consume(id)) return true;
    return false;
  };
  const heal = () => {
    if (P().hp < 45 && e.qty("bandage") > 0) e.consume("bandage");
  };
  // 打法照一个会玩的人：挥一下退一步（慢的追不上），被抓住或者被围住就推开，体力见底先拉开喘口气
  const fightIfNear = (range = 260) => {
    const p = P();
    const alive = () => (e.enemies || []).filter((q) => !q.dead && !q.lying && !q.gone),
      far = (q) => Math.hypot(q.x - p.x, q.y - p.y),
      nearest = () => alive().sort((a, b) => far(a) - far(b))[0];
    let z = nearest();
    if (!z || far(z) > range) return false;
    const slots = e.hotbarSlots();
    if (slots[3]) e.s.slot = 3;
    const reach = Math.max(40, (e.meleeStats?.(slots[3])?.range || 64) - 12);
    let nav = null,
      navT = 0;
    for (let t = 0; t < 60 && p.hp > 0; t += DT) {
      z = nearest();
      if (!z || far(z) > range + 140) break;
      const dx = z.x - p.x,
        dy = z.y - p.y,
        d = Math.hypot(dx, dy) || 1,
        crowd = alive().filter((q) => far(q) < 64).length;
      if (!NAIVE && (e.gx?.grab || crowd >= 2) && !(e.gx?.shoveCd > 0) && p.stamina >= 20) {
        p.facing = Math.atan2(dy, dx);
        e.shove?.();
      }
      if (NAIVE) {
        // 站着硬打：走到跟前就挥，不退、不推
        if (d > reach) tick({ x: dx / d, y: dy / d });
        else {
          p.facing = Math.atan2(dy, dx);
          e.use({ x: z.x, y: z.y - 20 });
          tick();
        }
        heal();
        continue;
      }
      if (e.cooldown > 0 || p.stamina < 14) {
        if (d < 130) {
          // 往后退，但别退到地图边上去：离农场中间远了就往回偏
          let rx = -dx / d,
            ry = -dy / d;
          const hx = 830 - p.x,
            hy = 470 - p.y,
            hd = Math.hypot(hx, hy) || 1;
          if (e.s.region === "farm" && hd > 220) {
            rx += (hx / hd) * 0.9;
            ry += (hy / hd) * 0.9;
            const rd = Math.hypot(rx, ry) || 1;
            rx /= rd;
            ry /= rd;
          }
          tick({ x: rx, y: ry });
        } else tick();
      } else if (d > reach) {
        // 离得远：照游戏自己的寻路点绕过去（直着走会顶在房子、树上）
        let tx = z.x,
          ty = z.y;
        if (d > 150) {
          if (!nav || navT <= 0) {
            try {
              nav = e.pathTo(p, z);
            } catch {
              nav = null;
            }
            navT = 0.5;
          }
          navT -= DT;
          while (nav && nav.length && Math.hypot(nav[0].x - p.x, nav[0].y - p.y) < 24) nav.shift();
          if (nav && nav.length) {
            tx = nav[0].x;
            ty = nav[0].y;
          }
        }
        const ax = tx - p.x,
          ay = ty - p.y,
          ad = Math.hypot(ax, ay) || 1;
        tick({ x: ax / ad, y: ay / ad });
      } else {
        p.facing = Math.atan2(dy, dx);
        e.use({ x: z.x, y: z.y - 20 });
        tick();
      }
      heal();
    }
    return true;
  };
  const idle = (secs) => {
    for (let s = 0; s < secs; s += DT) {
      tick();
      if (e.enemies?.some((q) => !q.dead)) fightIfNear();
    }
  };
  const walkTo = (t, r = 40) => {
    if (!t) return false;
    if (t.region && t.region !== e.s.region) {
      if (!e.travel(t.region)) return false;
      first("region:" + t.region, "头一回去 " + t.region);
    }
    for (let guard = 0; guard < 40; guard++) {
      const p = P(),
        d = Math.hypot(t.x - p.x, t.y - p.y);
      if (d <= r) return true;
      if (fightIfNear(170)) continue;
      const step = Math.min(d - r * 0.5, 120),
        secs = step / 165,
        ux = (t.x - p.x) / d,
        uy = (t.y - p.y) / d;
      for (let s = 0; s < secs; s += DT) tick();
      p.x += ux * step;
      p.y += uy * step;
    }
    return true;
  };
  const spotFor = (type, cx, cy) => {
    for (let r = 0; r < 520; r += 16)
      for (let a = 0; a < 6.28; a += 0.35) {
        const x = Math.round((cx + Math.cos(a) * r) / 8) * 8,
          y = Math.round((cy + Math.sin(a) * r) / 8) * 8;
        if (!e.buildReason(type, x, y)) return { x, y };
        if (!r) break;
      }
    return null;
  };
  const build = (type, cx, cy) => {
    if (e.s.region !== "farm" || !e.afford(BUILDINGS[type].cost)) return false;
    walkTo({ region: "farm", x: cx, y: cy }, 90);
    if (!e.startBuild(type)) return false;
    e.buildMode = type;
    const spot = spotFor(type, cx, cy);
    const ok = !!spot && e.placeBuilding(spot.x, spot.y);
    e.buildMode = null;
    if (ok) first("build:" + type, "头一回建：" + BUILDINGS[type].name);
    return ok;
  };
  // 种地：收、种、浇；口粮不够就多开几块
  const farm = () => {
    if (e.s.region !== "farm") return;
    const want = 6 + ((e.eaters?.() || []).length ? 6 : 0);
    let tilled = e.s.plots.filter((p) => p.tilled).length;
    for (const p of e.s.plots) {
      if (e.s.minute >= 21 * 60) break;
      const ripe = p.crop && e.chRipe(p);
      if (!p.tilled && tilled < want && P().stamina > 20) {
        walkTo({ region: "farm", x: p.x, y: p.y }, 30);
        if (e.toolPlot(p, "hoe")) tilled++;
        if (!p.tilled && e.toolPlot(p, "hoe")) tilled++;
        idle(0.5);
      }
      if (ripe) {
        walkTo({ region: "farm", x: p.x, y: p.y }, 30);
        e.handHarvest(p);
        idle(0.4);
      }
      if (p.tilled && !p.crop) {
        const seed = ["seedRadish", "seedPotato", "seedBean", "seedCorn", "seedTomato"].find((id) => e.qty(id) > 0);
        if (seed) {
          walkTo({ region: "farm", x: p.x, y: p.y }, 30);
          e.toolPlot(p, seed);
          idle(0.4);
        }
      }
      if (p.crop && !e.chRipe(p) && !e.plotWatered(p)) {
        if ((e.c.water || 0) < 1) {
          walkTo({ region: "farm", x: 880, y: 300 }, 40);
          e.interact();
        }
        walkTo({ region: "farm", x: p.x, y: p.y }, 30);
        e.toolPlot(p, "water");
        idle(0.4);
      }
    }
  };
  const cook = () => {
    if (e.s.region !== "farm") return;
    // 坏了的设施先修
    for (const b of e.s.buildings)
      if (BUILDINGS[b.type] && b.hp < BUILDINGS[b.type].hp * 0.5 && !["fence", "gate", "trap"].includes(b.type)) {
        walkTo({ region: "farm", x: b.x, y: b.y + 20 }, 40);
        if (e.repair(b.id)) first("repair", "头一回修设施");
      }
    for (const j of [...(e.c.production || [])].filter((x) => x.ready)) e.storeProduction ? e.storeProduction(j.id) : e.collectProduction(j.id);
    let n = 0;
    const keep = e.resident("farmer") && e.projectStage("market") < 1 ? 9 : 0;
    if (process.env.DEBUG) console.error("  cook:", JSON.stringify(e.recipeReason({ id: "trailBread", out: { bread: 2 }, cost: { radish: 3 }, station: "cook", minutes: 20 })), e.s.buildings.filter((b) => b.type === "cook").map((b) => Math.round(b.hp)).join(","));
    // 干粮、炖汤只做够带在身上吃的（生菜卖得比干粮贵，多的留着卖）
    // 口粮只算做熟的：留够四天的，多的生菜留着卖（生菜卖得比干粮贵）
    const enough = Math.max(20, Math.ceil(e.foodNeed() * 4)),
      making = (e.c.production || []).length * 2;
    while (e.foodPortions() + making + n * 2 < enough && e.qty("radish", true) >= 3 + keep && n++ < 4 && e.craft("trailBread")) first("craft:bread", "头一回做干粮");
    let k = 0;
    while (e.foodPortions() + making + n * 2 + k < enough && e.qty("potato", true) >= 2 && k++ < 3 && e.craft("stew")) first("craft:stew", "头一回做炖汤");
  };
  // 地里收的都算能卖的菜（豆子、番茄、玉米……连优质的）；萝卜留 12、土豆留 6 自己做饭
  const KEEP = { radish: 12, potato: 6 };
  const sellable = () => Object.keys({ ...e.s.inventory, ...e.s.storage }).filter((id) => ITEMS[id] && (CROPS[id] || ITEMS[id].cropBase) && !ITEMS[id].protected);
  const spare = () => sellable().reduce((n, id) => n + Math.max(0, e.qty(id, true) - (KEEP[id] || 0)), 0);
  // 家伙用旧了：有武器工作台就修；没有、又建得起，就建一座；都不行先削一根木矛顶着
  const upkeep = () => {
    if (e.s.region !== "farm" || !e.gr) return;
    const worn = Object.values(e.gr.slots || {}).filter((id) => id && e.condRatio(id) < 0.35);
    const melee = e.gr.slots?.melee;
    if (!worn.length) return;
    if (!e.benchReady() && e.sc.act >= 3 && e.afford(BUILDINGS.weaponbench.cost)) build("weaponbench", 980, 620);
    if (e.benchReady()) {
      walkTo({ region: "farm", ...(e.s.buildings.find((b) => b.type === "weaponbench") || { x: 980, y: 620 }) }, 60);
      for (const id of worn) if (!e.repairReason(id) && e.repairGear(id)) first("repair:gear", "头一回在武器工作台修家伙");
    }
    if (melee && e.condRatio(melee) < 0.2 && melee !== "spear" && !e.qty("spear", true) && e.qty("wood", true) >= 3 && e.craft("spear")) {
      e.equip("spear");
      first("craft:spear", "头一回削木矛");
    }
  };
  // 集市：留 12 个萝卜、6 个土豆自己做饭，多的生菜卖掉；眼下这一步要的料先买，再买种子，剩下的钱囤备战的料
  const market = () => {
    for (const id of sellable()) if ((e.s.storage[id] || 0) > 0) e.transfer(id, false, true);
    if (!e.travel("market")) return;
    first("region:market", "头一回去集市");
    for (const id of sellable()) {
      const n = e.qty(id) - (KEEP[id] || 0);
      if (n > 0 && e.trade("food", id, n, "sell")) first("sell", "头一回卖菜");
    }
    const buy = (trader, id, want) => {
      const lack = want - e.qty(id, true),
        can = Math.min(lack, Math.floor(e.s.money / Math.max(1, e.price(trader, id, "buy"))), e.traderStock(trader)[id] || 0);
      if (can > 0 && e.trade(trader, id, can, "buy")) first("buy:" + id, "头一回买" + ITEMS[id].name);
    };
    const req = e.sc.act === 2 ? e.taskRequirements("table").find((x) => !x.pass) : null;
    if (req && /集市/.test(req.label)) buy("mechanic", "wood", 12);
    if (req && /制作台/.test(req.label)) {
      buy("mechanic", "wood", 8);
      buy("mechanic", "stone", 4);
    }
    if (req && /床位/.test(req.label)) {
      buy("mechanic", "cloth", 2);
      buy("mechanic", "wood", 8);
    }
    // 发烧了：买一份药包吃掉，睡一晚就退
    if (e.gr?.fever && !e.gr.cure) {
      buy("food", "medkit", e.qty("medkit", true) + 1);
      if (e.qty("medkit") > 0 && e.consume("medkit")) first("medkit", "头一回吃药包退烧");
    }
    const plots = e.s.plots.filter((p) => p.tilled).length;
    buy("food", "seedRadish", Math.min(12, plots));
    buy("food", "seedPotato", 3);
    // 手上宽裕了，木头多备一点（后面每一步都要）
    if (e.sc.act === 2 && e.s.money >= 150) buy("mechanic", "wood", 20);
    if (e.sc.act >= 3) {
      // 没有武器工作台时多备它要的料（废铁 6、零件 3）
      const bench = e.s.buildings.some((b) => b.type === "weaponbench" && b.hp > 0);
      for (const [id, want] of [["wood", 30], ["scrap", bench ? 5 : 11], ["parts", bench ? 1 : 4], ["cloth", 2]]) buy("mechanic", id, want);
      if (e.chHeal() < 4) buy("food", "bandage", e.qty("bandage", true) + 4 - e.chHeal());
    }
    e.travel("farm");
    e.depositAll?.();
  };
  const loot = () => {
    // 居民区：能开的柜子都开，路上的打掉
    if (!e.travel("residential")) return;
    first("region:residential", "头一回去废弃居民区");
    const want = (o) => ["crate", "gearCrate", "salvage", "poi", "survivor", "rebuildFind", "animalRescue"].includes(o.type);
    // 手记标的那个人先找（阿禾还没接回来的时候），别的柜子顺路再开
    const dest = e.resident("farmer") ? null : e.taskDestination?.("farmer"),
      pri = (o) => (dest && dest.region === "residential" && Math.hypot(o.x - dest.x, o.y - dest.y) < 90 ? 0 : 1);
    const list = e.objects.filter(want).sort((a, b) => pri(a) - pri(b) || a.x - b.x);
    for (const o of list) {
      if (e.s.region !== "residential" || P().hp < 35 || e.s.minute > 17 * 60) break;
      walkTo({ x: o.x, y: o.y + 14 }, 34);
      if (e.s.region !== "residential") break;
      for (let k = 0; k < 3; k++) {
        const near = e.nearestObject();
        if (!near || !want(near)) break;
        e.interact();
        idle(1.2);
      }
      heal();
    }
    if (e.s.region === "residential") e.travel("farm");
    if (e.resident("farmer")) first("farmer", "阿禾接回来了");
    // 回来把背上的普通东西存进仓库
    e.depositAll?.();
  };
  let lastStage = "",
    lastStep = "",
    lastChore = -1,
    lastTrip = 0,
    lastMarket = 0,
    guard = 0,
    lastDay = 0;
  while (e.s.day <= DAYS && guard++ < 200000) {
    const s = e.s;
    if (s.day !== lastDay) {
      lastDay = s.day;
      out.days.push({ day: s.day, money: Math.floor(s.money), food: e.foodPortions(), foodDays: e.foodDays(), mat: e.chMatCount(), people: e.chPeople().n, fences: e.chFences(), stage: e.chStage() });
    }
    eat();
    heal();
    const g = e.chGoal(),
      stage = g.stage;
    if (stage !== lastStage) {
      // SAVES=目录：每进一段存一份档（给界面检查用）
      if (process.env.SAVES) (await import("node:fs")).writeFileSync(process.env.SAVES + "/seed" + seed + "-" + stage + ".json", e.serialize());
      out.stages.push(hhmm() + " " + stage + "：" + g.title);
      news("新的一段：" + g.title);
      lastStage = stage;
    }
    const st = g.step,
      key = st ? st.id + ":" + st.title : "";
    if (key !== lastStep) {
      out.steps.push(hhmm() + " " + key);
      if (SHOW) console.error(hhmm() + " " + key);
      lastStep = key;
    }
    if (e.chDone(1)) {
      out.done = hhmm();
      out.doneReal = realMin();
      if (process.env.SAVES) (await import("node:fs")).writeFileSync(process.env.SAVES + "/seed" + seed + "-end.json", e.serialize());
      e.chSceneDone();
      break;
    }
    const m = s.minute,
      horde = s.horde.phase;
    if (horde !== "active") out.hordeFrom = null;
    // 尸潮：站在路口里面（陷阱在你和它们之间），等它们踩着陷阱过来，到了跟前再打；都进场了还有没过来的，过去找
    if (horde === "warning" || horde === "active") {
      if (s.region !== "farm") e.travel("farm");
      if (P().hp < e.maxHp() - 30 && e.qty("bandage") > 0) e.consume("bandage");
      const post = { region: "farm", x: TRAP_X - 110, y: GATE1.lane.y },
        left = e.enemies.filter((z) => !z.dead && !z.lying && !z.gone);
      if (fightIfNear(140)) continue;
      // 一场尸潮打了 8 个钟头还没完：记下来还剩谁、在哪儿（多半是卡在哪儿过不来）
      if (horde === "active") {
        const now = (s.day - 1) * 1440 + m;
        out.hordeFrom ??= now;
        if (now - out.hordeFrom > 480 && !out.hordeLong) {
          out.hordeLong = true;
          out.problems.push("一场尸潮打了 8 个钟头还没完（" + hhmm() + "）：没进场的 " + s.horde.remaining + "，场上 " + e.enemies.filter((z) => z.horde && !z.dead).map((z) => z.type + "@" + Math.round(z.x) + "," + Math.round(z.y) + " hp" + Math.round(z.hp) + (z.lying ? " 躺着" : "") + (z.gone ? " 走了" : "") + " " + z.state).join(" | ") + "；人在 " + Math.round(P().x) + "," + Math.round(P().y));
        }
      }
      if (horde === "active" && s.horde.remaining === 0 && left.length) {
        if (!fightIfNear(1600)) idle(1);
        continue;
      }
      walkTo(post, 30);
      idle(0.5);
      continue;
    }
    if (e.ch.gate.tries !== out.gateTries) out.gateTries = e.ch.gate.tries;
    // 夜里：睡觉（今晚有尸潮就等着）
    if ((m >= 22 * 60 || m < 5 * 60) && s.region === "farm") {
      if (e.chGateTonight()) {
        idle(10);
        continue;
      }
      walkTo({ region: "farm", x: 830, y: 470 }, 60);
      if (!e.sleep()) idle(20);
      continue;
    }
    if (s.region !== "farm" && m >= 19 * 60) {
      e.travel("farm");
      continue;
    }
    // 种子快没了：上午去一趟集市
    if (s.region === "farm" && e.sc.act >= 2 && m >= 7 * 60 && m < 15 * 60 && s.day !== lastMarket && (spare() >= 18 || (e.qty("seedRadish", true) + e.qty("seedPotato", true) < 6 && e.s.money >= 48) || (e.gr?.fever && !e.gr.cure && e.s.money >= 75))) {
      lastMarket = s.day;
      market();
      continue;
    }
    // 每天早上、下午各过一遍田，顺手做饭
    const slot = s.day * 2 + (m >= 14 * 60 ? 1 : 0);
    if (s.region === "farm" && slot !== lastChore && m >= 6 * 60 + 30 && e.sc.act >= 2) {
      lastChore = slot;
      farm();
      cook();
      upkeep();
      if (process.env.DEBUG) console.error(hhmm(), "田", e.s.plots.filter((p) => p.tilled).length, "种着", e.s.plots.filter((p) => p.crop).length, "萝卜", e.qty("radish", true), "土豆", e.qty("potato", true), "干粮", e.qty("bread", true), "种子", e.qty("seedRadish", true), e.qty("seedPotato", true), "在做", (e.c.production || []).length, "体力", Math.round(P().stamina), "血", Math.round(P().hp), "饿", Math.round(P().hunger));
      continue;
    }
    if (!st) {
      idle(10);
      continue;
    }
    // ---- 照眼下这一步做 ----
    if (st.id === "harvest") {
      const f = PJ.firstHarvestStep(e);
      if (!f) {
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
      } else if (/收下/.test(f.title)) {
        e.handHarvest(pl);
        first("harvest", "头一回收菜");
      } else idle(10);
      idle(1);
      continue;
    }
    if (st.id === "meal") {
      walkTo(st.target, 40);
      if (/做出第一份干粮/.test(st.title)) {
        if (!e.craft("trailBread")) idle(10);
        else first("craft:bread", "头一回做干粮");
      } else if (/收起来/.test(st.title)) {
        const j = e.c.production.find((x) => x.ready);
        if (j) e.collectProduction(j.id);
        idle(2);
      } else idle(10);
      idle(1);
      continue;
    }
    if (st.id === "well") {
      walkTo(st.target, 40);
      if (!e.repairWell()) idle(10);
      else first("well", "修好了水井");
      continue;
    }
    if (st.id === "camp") {
      walkTo(st.target, 40);
      if (!e.buildCamp()) idle(10);
      else first("camp", "搭起了援建营地");
      continue;
    }
    if (st.id === "reply") {
      walkTo(st.target, 40);
      if (!e.replyAlliance()) idle(10);
      else first("reply", "回了信，铁锹来了");
      continue;
    }
    if (st.id === "choice") {
      e.chooseSupply("ration");
      news("挑了第一批援建物资");
      idle(2);
      continue;
    }
    if (st.id === "opening") {
      const ph = e.feel?.open?.phase;
      if (ph === "fence") {
        if (!build("fence", ROAD.x, ROAD.y)) {
          // 木头不够：清田里的杂物
          const d = e.s.debris[0];
          if (d) {
            const pl = e.s.plots.find((p) => Math.hypot(p.x - d.x, p.y - d.y) < 15);
            if (pl) {
              walkTo({ region: "farm", x: pl.x, y: pl.y }, 30);
              e.toolPlot(pl, "hoe");
            }
          } else idle(20);
        }
        continue;
      }
      walkTo({ region: "farm", x: ROAD.x - 80, y: ROAD.y + 20 }, 60);
      if (!fightIfNear(420)) idle(4);
      else first("fight", "头一回打感染者");
      continue;
    }
    if (st.id === "farmer") {
      if (s.region === "farm" && m > 15 * 60) {
        idle(20);
        continue;
      }
      if (P().hp < 60 || e.qty("bread") < 1) {
        // 带上干粮和绷带再出门
        for (const id of ["bread", "bandage"]) if (e.qty(id) < 2 && (s.storage[id] || 0) > 0) e.transfer(id, false, true);
        if (P().hp < 60) {
          idle(30);
          continue;
        }
      }
      lastTrip = s.day;
      loot();
      continue;
    }
    if (st.id === "farmerMeal") {
      if (s.region !== "farm") e.travel("farm");
      if (!e.feedFarmer()) {
        cook();
        idle(30);
      } else first("fed", "阿禾吃上了工作餐");
      continue;
    }
    if (st.id === "table") {
      if (s.region !== "farm") e.travel("farm");
      const req = e.taskRequirements("table").find((x) => !x.pass);
      let did = false;
      if (!req) {
        idle(5);
        continue;
      }
      if (/集市/.test(req.label)) {
        did = e.contributeProject("market");
        if (did) first("market", "公共餐桌备好了料");
      } else if (/制作台/.test(req.label)) did = build("workbench", 1010, 560);
      else if (/床位/.test(req.label)) did = build("bed", 420, 330);
      if (!did) {
        if (process.env.DEBUG) console.error(hhmm(), "table 卡在", req.label, "木", e.qty("wood", true), "布", e.qty("cloth", true), "石", e.qty("stone", true), "萝卜", e.qty("radish", true));
        // 缺东西：有钱先去集市买，不然出门翻，或者等菜熟
        if (s.day !== lastMarket && m < 16 * 60 && e.s.money >= 60) {
          lastMarket = s.day;
          market();
        } else if (s.day !== lastTrip && m < 14 * 60 && P().hp >= 60) {
          lastTrip = s.day;
          loot();
        } else {
          farm();
          cook();
          idle(40);
        }
      }
      continue;
    }
    // 没守住过：白天把啃坏的围栏、踩过的陷阱修好（修得起的）
    if (e.ch.gate.tries > 0 && s.region === "farm" && m < 18 * 60 && s.day !== out.fixDay) {
      out.fixDay = s.day;
      for (const b of e.s.buildings)
        if (["fence", "gate", "trap"].includes(b.type) && BUILDINGS[b.type] && b.hp < BUILDINGS[b.type].hp * 0.9) {
          walkTo({ region: "farm", x: b.x, y: b.y + 20 }, 40);
          if (e.repair(b.id)) first("repair:def", "头一回修围栏、陷阱");
        }
    }
    if (st.id.startsWith("prep:")) {
      if (s.region !== "farm") e.travel("farm");
      // NOPREP=1：什么都不备（不建围栏、陷阱、育种箱，不囤绷带），量“不备战守不守得住”
      if (process.env.NOPREP) {
        if (s.day !== lastTrip && m < 14 * 60 && P().hp >= 60) {
          lastTrip = s.day;
          loot();
        } else {
          farm();
          cook();
          idle(40);
        }
        continue;
      }
      const miss = st.id.slice(5);
      let did = false;
      if (miss === "fence") did = build(e.chCount("gate") ? "fence" : e.chFences() >= 4 ? "gate" : "fence", ROAD.x - 20, ROAD.y - 60 + 36 * (e.chFences() % 8));
      // 陷阱摆在它们进来的路上，一个接一个
      // 路口那一截是出口、放不了东西：陷阱摆在围栏里面的路上，一个接一个（它们啃穿围栏、顺着路进来就踩上）
      else if (miss === "trap") did = build("trap", TRAP_X - 36 * e.chCount("trap"), GATE1.lane.y);
      else if (miss === "breeder") did = build("breeder", 940, 560);
      else if (miss === "heal" && e.s.buildings.some((b) => b.type === "workbench" && b.hp > 0) && e.qty("cloth", true) > 0) did = e.craft("bandage");
      if (did) news("备战：" + st.title);
      // 缺木头、缺布、缺绷带：钱够就去集市
      if (!did && s.day !== lastMarket && m < 16 * 60 && e.s.money >= 60) {
        lastMarket = s.day;
        market();
        did = true;
      }
      if (!did) {
        if (s.day !== lastTrip && m < 14 * 60 && P().hp >= 60) {
          lastTrip = s.day;
          loot();
        } else {
          farm();
          cook();
          idle(40);
        }
      }
      continue;
    }
    if (st.id === "gate") {
      // 天黑前：缠好绷带、吃饱，在路口等
      if (P().hp < e.maxHp() - 30 && e.qty("bandage") > 0) e.consume("bandage");
      if (P().hunger < 70) for (const id of ["bread", "stew"]) if (e.qty(id) > 0 && e.consume(id)) break;
      idle(10);
      continue;
    }
    idle(10);
  }
  out.gateWon = e.ch.gate.state === "won";
  out.gateTries = e.ch.gate.tries;
  out.final = { day: e.s.day, stage: e.chStage(), act: e.sc.act, money: Math.floor(e.s.money), harvested: e.s.stats.harvested, kills: e.s.stats.kills, food: e.foodPortions(), fences: e.chFences(), people: e.chPeople().n };
  out.toastsWarn = toasts.filter((x) => x.tone === "warn").length;
  out.toasts = toasts.length;
  if (!out.done) out.problems.push("第 " + DAYS + " 天过完还没做完第一章（停在：" + (out.steps.at(-1) || "开头") + "）");
  else if (out.doneReal < 90 || out.doneReal > 180) out.problems.push("第一章用了 " + out.doneReal.toFixed(0) + " 分钟，不在 90–180 分钟里");
  const worst = out.gaps.slice().sort((a, b) => b.min - a.min)[0];
  if (worst && worst.min > 20) out.problems.push("有 " + worst.min + " 分钟没有新东西也没有要决定的事（到 " + worst.at + " " + worst.then + "）");
  return out;
}

let bad = 0;
const all = [];
for (const seed of SEEDS) {
  let r;
  try {
    r = await run(seed);
  } catch (err) {
    console.log("种子 " + seed + "：出错 " + (err?.stack || err));
    bad++;
    continue;
  }
  all.push(r);
  if (r.problems.length) bad++;
  const worst = r.gaps.slice().sort((a, b) => b.min - a.min)[0];
  console.log("种子 " + seed + "：第一章 " + (r.done ? r.done + "（" + r.doneReal.toFixed(0) + " 分钟）" : "没做完") + " · 倒下 " + r.deaths + " 回（撤回来 " + (r.retreats || 0) + " 回） · 尸潮守了 " + (r.gateTries + (r.gateWon ? 1 : 0)) + " 回" + (r.gateWon ? "，守住了" : "") + " · 最长 " + (worst ? worst.min : 0) + " 分钟没新东西");
  for (const s of r.stages) console.log("  段 " + s);
  if (SHOW) for (const s of r.steps) console.log("  步 " + s);
  console.log("  每天 " + r.days.map((d) => "d" + d.day + " 金" + d.money + " 粮" + d.food + "(" + d.foodDays + "天) 料" + d.mat + " 人" + d.people + " 栏" + d.fences).join(" | "));
  console.log("  收尾 " + JSON.stringify(r.final) + " 提示 " + r.toasts + " 条（警告 " + r.toastsWarn + "）");
  console.log("  页面 " + JSON.stringify(r.menus) + (r.deathWhy ? " 倒下：" + r.deathWhy : ""));
  if (process.env.NEWS) for (const n of r.news) console.log("  新 " + n);
  for (const p of r.problems) console.log("  ✗ " + p);
}
console.log("合计：" + SEEDS.length + " 个种子，" + (SEEDS.length - bad) + " 个照手记走完第一章、时长在 1.5–3 小时里。");
process.exit(bad ? 1 : 0);
