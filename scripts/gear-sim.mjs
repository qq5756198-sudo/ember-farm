// v0.22.0「披挂」验收模拟：用正式代码（不改任何规则）跑一趟出门搜刮，看死亡率、战斗时长、被抓被咬。
// 机器人：搜三处、回出口；看到预兆（蹲身、跺脚、张嘴、抬手）有 0.12–0.5 秒反应时间，周围越挤越容易漏看；
// 被抓先推开、推不动就连按；流血或血少用绷带；没绷带又血少就往出口撤。
// 用法：node scripts/gear-sim.mjs 次数 天数 地图[,地图] 打法[,打法]
//   打法：none 空手布鞋；club 木棍+破布护手；right 木矛（医院、仓库再加一套旧装备）；old 木矛+旧装备；mid 铁头矛+中期装备；late 铁头矛+后期装备；lateBlade 砍刀+后期装备
//   例：node scripts/gear-sim.mjs 100 1 residential,hospital none,club,right
// 对照实验：RULESPATCH='{"noise":{"step":0}}'、DURPATCH='{"spear":999}'、SKILL=0.7（看到预兆的几率）
const D = new URL("../dist/", import.meta.url).href;
const { Engine, freshState } = await import(D + "campaign.js");
const { REGIONS } = await import(D + "data.js");
const { RULES, MELEE, ARMOR } = await import(D + "gear-data.js");
if (process.env.DURPATCH) for (const [k, v] of Object.entries(JSON.parse(process.env.DURPATCH))) (MELEE[k] || ARMOR[k]).dur = v;
// 对照实验：RULESPATCH='{"noise":{"step":0}}' 之类
if (process.env.RULESPATCH) for (const [k, v] of Object.entries(JSON.parse(process.env.RULESPATCH))) Object.assign(RULES[k], v);
const N = Number(process.argv[2] || 20);
const DAY = Number(process.argv[3] || 1);
const REGION_LIST = (process.argv[4] || "residential,hospital").split(",");
const KITS = (process.argv[5] || "none,club,right").split(",");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const DT = 0.05;
const SKILL = Number(process.env.SKILL || 0.85);
const LOOT = { residential: [[408, 454], [680, 760], [1180, 480]], hospital: [[825, 332], [1260, 460], [500, 750]], warehouse: [[435, 454], [725, 770], [1390, 560]] };
const SETS = {
  none: { feet: "clothShoes" },
  rags: { hands: "ragGloves", feet: "clothShoes" },
  hosp: { head: "motoHelmet", body: "tireArmor", hands: "leatherBracers", legs: "jeans", feet: "clothShoes" },
  mid: { head: "motoHelmet", body: "tireArmor", hands: "leatherBracers", legs: "kneePads", feet: "workBoots" },
  // 第 8 天以后：图纸、宝贝和袭击掉落的东西，重量刚好压在“中”档
  late: { head: "riotHelmet", body: "riotSuit", hands: "steelBracers", legs: "jeans", feet: "workBoots" },
};
const KIT = {
  none: { weapon: null, set: "none", bandage: 2, stones: 5 },
  club: { weapon: "club", set: "rags", bandage: 2, stones: 5 },
  right: { weapon: "spear", set: "rags", setHosp: "hosp", bandage: 2, bandageHosp: 3, stones: 5, stonesHosp: 6 },
  old: { weapon: "spear", set: "hosp", bandage: 3, stones: 6 },
  mid: { weapon: "ironspear", set: "mid", bandage: 3, stones: 6 },
  // 第 8 天以后：铁头矛 + 后期防具；lateBlade 换成砍刀（利器打重甲正面只剩三成五）
  late: { weapon: "ironspear", set: "late", bandage: 4, stones: 6 },
  lateBlade: { weapon: "machete", set: "late", bandage: 4, stones: 6 },
};
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function trial(region, kitId, seed) {
  Math.random = seeded(seed * 7919 + 13);
  const R = seeded(seed * 104729 + 7);
  const kit = KIT[kitId],
    set = SETS[region !== "residential" && kit.setHosp ? kit.setHosp : kit.set];
  const e = new Engine(freshState(), () => {});
  let died = false;
  const emit = e.emit.bind(e);
  e.emit = (name, data) => {
    if (name === "menu" && data?.menu === "death") died = true;
    return emit(name, data);
  };
  const s = e.s,
    g = e.gr;
  s.day = DAY;
  s.minute = 600;
  // 装备
  for (const k of ["head", "body", "hands", "legs", "feet", "melee", "ranged"]) g.slots[k] = null;
  delete s.inventory.club;
  delete s.inventory.ragGloves;
  for (const [slot, id] of Object.entries(set)) {
    s.inventory[id] = 1;
    g.slots[slot] = id;
  }
  if (kit.weapon) {
    s.inventory[kit.weapon] = 1;
    g.slots.melee = kit.weapon;
  }
  s.inventory.bandage = region !== "residential" && kit.bandageHosp ? kit.bandageHosp : kit.bandage;
  s.inventory.stone = region !== "residential" && kit.stonesHosp ? kit.stonesHosp : kit.stones;
  g.slots.throw = "stone";
  s.slot = 3;
  s.region = region;
  const sp = REGIONS[region].spawn;
  Object.assign(s.player, { x: sp.x, y: sp.y, hp: 100, stamina: 100, hunger: 90 });
  s.enemies[region] = null;
  e.assignRegion();
  e.paused = false;
  const p = s.player,
    gx = e.gx;
  const stats = { broken0: g.stats.broken, bites0: g.stats.bites, grabs0: g.stats.grabs, lunges0: g.stats.lunges, counters0: g.stats.counters, interrupts0: g.stats.interrupts, summons0: g.stats.summons, bandages: 0, cause: null };
  // 记下最后一下是谁打的（死因）
  const realDamage = e.damagePlayer.bind(e);
  e.damagePlayer = (n, opts = {}) => {
    const z = opts.from || e._zAtk;
    stats.cause = opts.eff === RULES.grab.bite || opts.eff === RULES.crawl.bite ? "bite" : opts.down ? (z?.type === "armor" ? "charge" : "lunge") : z ? "hit:" + z.type : "other";
    return realDamage(n, opts);
  };
  const goals = [...LOOT[region].map(([x, y]) => ({ x, y })), { ...REGIONS[region].exit, exit: true }];
  let gi = 0,
    waitAt = 0,
    t = 0,
    path = [],
    pathFor = null,
    pathTimer = 0,
    fleeing = false,
    segStart = -1,
    lastCombat = -10,
    dmg = 0,
    lastHp = 100,
    kills0 = s.stats.kills,
    stuckT = 0,
    lastPos = { x: p.x, y: p.y },
    grabSeen = null,
    grabOk = true,
    mashClock = 0,
    act = 0,
    bracing = null;
  const segs = [];
  const notice = (z, key, crowd) => {
    if (z["_" + key] == null) {
      z["_" + key] = t;
      z["_r" + key] = 0.12 + R() * 0.38;
      z["_n" + key] = R() < Math.max(0.35, SKILL - 0.12 * (crowd - 1));
    }
    return z["_n" + key] && t - z["_" + key] >= z["_r" + key];
  };
  const forget = (z, key) => {
    z["_" + key] = null;
  };
  const W = kit.weapon ? e.meleeStats(kit.weapon) : null;
  while (t < 420 && !died) {
    if (s.region !== region) break;
    act = Math.max(0, act - DT);
    const foes = e.enemies.filter((z) => !z.dead && !z.nest);
    const close = foes.filter((z) => (z.state === "chase" || z.lunge || z.charge) && dist(z, p) < 420).sort((a, b) => dist(a, p) - dist(b, p));
    const crowd = close.filter((z) => dist(z, p) < 130).length;
    const inCombat = close.some((z) => dist(z, p) < 300);
    if (inCombat) {
      if (segStart < 0 || t - lastCombat > 2) {
        if (segStart >= 0) segs.push(lastCombat - segStart);
        segStart = t;
      }
      lastCombat = t;
    }
    // 绷带：流血或血少（被抓住时腾不出手）
    if ((gx.bleed > 0 || p.hp < 50) && !gx.heal && (s.inventory.bandage || 0) > 0 && !gx.grab && !(gx.down > 0)) {
      if (e.consume("bandage")) stats.bandages++;
    }
    let goal = goals[gi];
    if (!fleeing && p.hp < 30 && !(s.inventory.bandage > 0) && !gx.heal) fleeing = true;
    if (fleeing) goal = goals[goals.length - 1];
    let mx = 0,
      my = 0,
      run = false,
      acted = false;
    if (gx.grab) {
      if (grabSeen == null) {
        grabSeen = t + 0.15 + R() * 0.2;
        grabOk = R() < 0.97;
      }
      if (grabOk && t >= grabSeen) {
        if (gx.shoveCd <= 0 && p.stamina >= RULES.shove.cost) e.shove();
        else {
          mashClock -= DT;
          if (mashClock <= 0) {
            e.interact();
            mashClock = 0.2;
          }
        }
      }
      acted = true;
    } else {
      grabSeen = null;
      if (!(gx.down > 0)) {
        for (const z of close) {
          if (!(z.windup > 0)) forget(z, "wind");
          if (!(z.lunge?.phase === "crouch")) forget(z, "lunge");
          if (!(z.charge?.phase === "stomp")) forget(z, "charge");
        }
        const threat = close.find((z) => z.windup > 0 && z.type !== "screamer" && dist(z, p) < 72 && notice(z, "wind", crowd));
        const lunger = close.find((z) => z.lunge?.phase === "crouch" && notice(z, "lunge", crowd));
        const charger = close.find((z) => z.charge?.phase === "stomp" && notice(z, "charge", crowd));
        const screamer = close.find((z) => z.type === "screamer" && z.windup > 0 && dist(z, p) < 250 && notice(z, "scream", crowd));
        if (bracing && !(bracing.lunge && bracing.lunge.phase !== "stumble")) bracing = null;
        if (screamer && e.qty("stone") > 0 && act <= 0 && e.cooldown <= 0 && e.lineClear(p, screamer)) {
          s.slot = 5;
          if (R() < 0.85) e.use({ x: screamer.x, y: screamer.y });
          else e.use({ x: screamer.x + 40, y: screamer.y + 30 });
          s.slot = 3;
          act = 0.4;
          acted = true;
        } else if (lunger) {
          if (W?.brace) bracing = lunger;
          else {
            const a = Math.atan2(lunger.y - p.y, lunger.x - p.x) + (Math.PI / 2) * (R() < 0.5 ? 1 : -1);
            mx = Math.cos(a);
            my = Math.sin(a);
            run = p.stamina > 10;
          }
        } else if (bracing) {
          p.facing = Math.atan2(bracing.y - p.y, bracing.x - p.x);
          acted = true;
        } else if (charger) {
          const a = Math.atan2(charger.y - p.y, charger.x - p.x) + Math.PI / 2;
          mx = Math.cos(a);
          my = Math.sin(a);
          run = p.stamina > 10;
        } else if (W && !fleeing && close.length) {
          const z = close[0],
            d = dist(z, p);
          const adj = close.filter((o) => dist(o, p) < 75).length;
          if (adj >= 2 && gx.shoveCd <= 0 && p.stamina >= RULES.shove.cost + 5) {
            p.facing = Math.atan2(z.y - p.y, z.x - p.x);
            e.shove();
            acted = true;
          } else if (threat) {
            const a = Math.atan2(p.y - threat.y, p.x - threat.x);
            mx = Math.cos(a);
            my = Math.sin(a);
          } else if (d < W.range - 6) {
            if (e.cooldown <= 0) e.use({ x: z.x, y: z.y - 20 });
            acted = true;
          } else if (adj >= 3 || (close.filter((o) => dist(o, p) < 160).length >= 3 && p.hp < 60)) {
            let ax = 0,
              ay = 0;
            for (const o of close)
              if (dist(o, p) < 200) {
                ax += p.x - o.x;
                ay += p.y - o.y;
              }
            const a = Math.atan2(ay, ax);
            mx = Math.cos(a);
            my = Math.sin(a);
            run = p.stamina > 25;
          } else if (d < 300) {
            if (W.brace && d < W.range + 50) p.facing = Math.atan2(z.y - p.y, z.x - p.x);
            else {
              const a = Math.atan2(z.y - p.y, z.x - p.x);
              mx = Math.cos(a);
              my = Math.sin(a);
            }
          }
        } else if (!W && close.some((z) => dist(z, p) < 230)) {
          if (threat && gx.shoveCd <= 0 && p.stamina >= RULES.shove.cost + 10) {
            p.facing = Math.atan2(threat.y - p.y, threat.x - p.x);
            e.shove();
            acted = true;
          } else {
            let ax = 0,
              ay = 0;
            for (const z of close)
              if (dist(z, p) < 260) {
                const w = 1 / Math.max(30, dist(z, p));
                ax += (p.x - z.x) * w;
                ay += (p.y - z.y) * w;
              }
            const ga = Math.atan2(goal.y - p.y, goal.x - p.x),
              fa = Math.atan2(ay, ax);
            const a = Math.atan2(Math.sin(fa) * 1.4 + Math.sin(ga) * 0.6, Math.cos(fa) * 1.4 + Math.cos(ga) * 0.6);
            mx = Math.cos(a);
            my = Math.sin(a);
            run = p.stamina > 15;
          }
        }
        if (!acted && mx === 0 && my === 0 && !bracing && !(W && close.some((z) => dist(z, p) < 300) && !fleeing)) {
          if (dist(p, goal) < (goal.exit ? 40 : 60)) {
            if (goal.exit) break;
            waitAt += DT;
            if (waitAt >= 2) {
              gi++;
              waitAt = 0;
              path = [];
            }
          } else {
            pathTimer -= DT;
            if (!path.length || pathTimer <= 0 || pathFor !== goal) {
              path = e.pathTo(p, goal);
              pathFor = goal;
              pathTimer = 0.8;
            }
            while (path[0] && dist(p, path[0]) < 22) path.shift();
            const fat = (a, b) => [-13, 0, 13].every((o) => e.lineClear({ x: a.x, y: a.y + o }, { x: b.x, y: b.y + o }) && e.lineClear({ x: a.x + o, y: a.y }, { x: b.x + o, y: b.y }));
            const nxt = fat(p, goal) ? goal : path[0] || goal;
            const a = Math.atan2(nxt.y - p.y, nxt.x - p.x);
            mx = Math.cos(a);
            my = Math.sin(a);
            run = fleeing && p.stamina > 10;
          }
        }
      }
    }
    e.update(DT, { x: mx, y: my, run });
    if (p.hp < lastHp) dmg += lastHp - p.hp;
    lastHp = p.hp;
    t += DT;
    if (dist(p, lastPos) < 0.5 && !acted && !inCombat && !gx.grab && !(gx.down > 0) && !(dist(p, goal) < 60)) stuckT += DT;
    else stuckT = 0;
    lastPos = { x: p.x, y: p.y };
    if (stuckT > 6) {
      path = [];
      pathTimer = 0;
      const a = R() * 6.28;
      for (let k = 0; k < 10; k++) e.update(DT, { x: Math.cos(a), y: Math.sin(a), run: false });
      stuckT = 0;
    }
  }
  if (segStart >= 0) segs.push(lastCombat - segStart);
  const atExit = s.region === region && dist(s.player, goals[goals.length - 1]) < 60;
  const ok = !died && atExit && gi >= goals.length - 1;
  const fled = !died && atExit && !ok;
  return {
    died,
    cause: died ? stats.cause : null,
    ok,
    fled,
    timeout: !died && !ok && !fled,
    t,
    segs,
    dmg,
    kills: s.stats.kills - kills0,
    bandages: stats.bandages,
    grabs: g.stats.grabs - stats.grabs0,
    bites: g.stats.bites - stats.bites0,
    lunges: g.stats.lunges - stats.lunges0,
    counters: g.stats.counters - stats.counters0,
    interrupts: g.stats.interrupts - stats.interrupts0,
    summons: g.stats.summons - stats.summons0,
    broken: g.stats.broken - stats.broken0,
    weaponLeft: kit.weapon ? Math.round((e.cond(kit.weapon).d / e.cond(kit.weapon).m) * 100) : 100,
  };
}

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0) + "%";
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
for (const region of REGION_LIST)
  for (const kitId of KITS) {
    const rs = [];
    const t0 = Date.now();
    for (let i = 0; i < N; i++) rs.push(trial(region, kitId, i + 1));
    const segs = rs.flatMap((r) => r.segs).filter((x) => x > 1).sort((a, b) => a - b);
    const row = {
      day: DAY,
      n: N,
      died: pct(rs.filter((r) => r.died).length, N),
      ok: pct(rs.filter((r) => r.ok).length, N),
      fled: pct(rs.filter((r) => r.fled).length, N),
      timeout: rs.filter((r) => r.timeout).length,
      avgTime: Math.round(mean(rs.map((r) => r.t))),
      fights: +mean(rs.map((r) => r.segs.filter((x) => x > 1).length)).toFixed(1),
      fightMed: segs.length ? +segs[Math.floor(segs.length / 2)].toFixed(1) : 0,
      fightP75: segs.length ? +segs[Math.floor(segs.length * 0.75)].toFixed(1) : 0,
      dmg: Math.round(mean(rs.map((r) => r.dmg))),
      kills: +mean(rs.map((r) => r.kills)).toFixed(1),
      bandages: +mean(rs.map((r) => r.bandages)).toFixed(1),
      grabs: +mean(rs.map((r) => r.grabs)).toFixed(1),
      bites: +mean(rs.map((r) => r.bites)).toFixed(2),
      lunges: +mean(rs.map((r) => r.lunges)).toFixed(1),
      counters: +mean(rs.map((r) => r.counters)).toFixed(1),
      interrupts: +mean(rs.map((r) => r.interrupts)).toFixed(1),
      summons: +mean(rs.map((r) => r.summons)).toFixed(1),
      broken: +mean(rs.map((r) => r.broken)).toFixed(2),
      weaponLeft: Math.round(mean(rs.map((r) => r.weaponLeft))),
      ms: Date.now() - t0,
      causes: Object.fromEntries(Object.entries(rs.filter((r) => r.died).reduce((m, r) => ((m[r.cause] = (m[r.cause] || 0) + 1), m), {})).sort((a, b) => b[1] - a[1])),
    };
    console.log(region, kitId, JSON.stringify(row));
  }
