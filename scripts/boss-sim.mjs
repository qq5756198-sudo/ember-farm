// v0.24.0「暗涌」头目验收模拟：用正式代码（不改规则）打一场头目战，看胜率、死亡率、一场打多久。
// 机器人：和 gear-sim 一样的反应时间（看到预兆 0.12–0.5 秒后才动，越挤越容易漏看）；
//   大块头：红圈亮了往圈外跑（ROLL 设了就滚），车门的线亮了往旁边让，平时绕到它背后打；
//   护士长：她吸气时冲过去打一下（够不着就扔石头），身边的被围住就推开，先打离自己近的；
//   仓库守卫：第一段绕到背后打，第二段看到跺脚就往旁边让，撞晕了上去打。
//   血少了用绷带，没绷带又血少就撤（算逃回）。场上只有头目（护士长带着她身边的三只）。
// 用法：node scripts/boss-sim.mjs 次数 头目[,头目] 打法[,打法]
//   头目：brute（第 4 天）、nurse（第 8 天）、guard（第 5 天）、guard9（第 9 天）
//   打法：right 木矛+医院那套；mid 铁头矛+中期装备；late 铁头矛+后期装备
const D = new URL("../dist/", import.meta.url).href;
const { Engine, freshState } = await import(D + "campaign.js");
const { RULES } = await import(D + "gear-data.js");
const U = await import(D + "undertow-data.js");
const N = Number(process.argv[2] || 30);
const WHO = (process.argv[3] || "brute,nurse,guard").split(",");
const KITS = (process.argv[4] || "mid").split(",");
const ROLL = process.env.ROLL || "telegraph";
const SKILL = Number(process.env.SKILL || 0.85);
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const DT = 0.05;
const SETS = {
  hosp: { head: "motoHelmet", body: "tireArmor", hands: "leatherBracers", legs: "jeans", feet: "clothShoes" },
  mid: { head: "motoHelmet", body: "tireArmor", hands: "leatherBracers", legs: "kneePads", feet: "workBoots" },
  late: { head: "riotHelmet", body: "riotSuit", hands: "steelBracers", legs: "jeans", feet: "workBoots" },
};
const KIT = {
  right: { weapon: "spear", set: "hosp", bandage: 3, stones: 6 },
  mid: { weapon: "ironspear", set: "mid", bandage: 3, stones: 6 },
  late: { weapon: "ironspear", set: "late", bandage: 4, stones: 6 },
};
const FIGHT = {
  brute: { region: "residential", day: 4 },
  nurse: { region: "hospital", day: 8 },
  guard: { region: "warehouse", day: 5 },
  guard9: { region: "warehouse", day: 9 },
};
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}

function trial(who, kitId, seed) {
  Math.random = seeded(seed * 7919 + 13);
  const R = seeded(seed * 104729 + 7);
  const F = FIGHT[who],
    kit = KIT[kitId],
    set = SETS[kit.set];
  const st = freshState();
  st.undertow.seed = 1000 + seed;
  const e = new Engine(st, () => {});
  let died = false;
  const emit = e.emit.bind(e);
  e.emit = (name, data) => {
    if (name === "menu" && data?.menu === "death") died = true;
    return emit(name, data);
  };
  const s = e.s,
    g = e.gr;
  s.day = F.day;
  s.minute = 600;
  for (const k of ["head", "body", "hands", "legs", "feet", "melee", "ranged"]) g.slots[k] = null;
  delete s.inventory.club;
  delete s.inventory.ragGloves;
  for (const [slot, id] of Object.entries(set)) {
    s.inventory[id] = 1;
    g.slots[slot] = id;
  }
  s.inventory[kit.weapon] = 1;
  g.slots.melee = kit.weapon;
  s.inventory.bandage = kit.bandage;
  s.inventory.stone = kit.stones;
  g.slots.throw = "stone";
  s.slot = 3;
  s.region = F.region;
  e.ut.evDay = F.day;
  e.ut.ev = null;
  s.enemies[F.region] = null;
  e.assignRegion();
  e.paused = false;
  const isBoss = (z) => (who.startsWith("guard") ? e.isGuard(z) : z.boss === who);
  const boss = e.enemies.find(isBoss);
  // 场上只留头目（护士长留着她身边的三只）
  e.enemies = s.enemies[F.region] = e.enemies.filter((z) => isBoss(z) || (who === "nurse" && z.escort));
  const p = s.player;
  // 站在离头目 330 的空地上
  let start = null;
  for (let k = 0; k < 24 && !start; k++) {
    const a = (k / 24) * Math.PI * 2,
      q = { x: Math.round(boss.x + Math.cos(a) * 330), y: Math.round(boss.y + Math.sin(a) * 330) };
    if (!e.blocked(q.x, q.y, false, 14) && e.lineClear(boss, q)) start = q;
  }
  Object.assign(p, start || e.freePoint(boss.x + 330, boss.y), { hp: 100, stamina: 100, hunger: 90 });
  const exit = e.freePoint(p.x + (p.x - boss.x) * 0.8, p.y + (p.y - boss.y) * 0.8);
  const W = e.meleeStats(kit.weapon);
  let t = 0,
    path = [],
    pathTimer = 0,
    fleeing = false,
    grabSeen = null,
    mashClock = 0,
    act = 0,
    circleT = 0,
    fightStart = -1;
  const notice = (o, key, crowd) => {
    if (o["_" + key] == null) {
      o["_" + key] = t;
      o["_r" + key] = 0.12 + R() * 0.38;
      o["_n" + key] = R() < Math.max(0.35, SKILL - 0.12 * (crowd - 1));
    }
    return o["_n" + key] && t - o["_" + key] >= o["_r" + key];
  };
  const roll = (a) => (ROLL && !e.dodgeReason() ? e.dodge({ x: Math.cos(a), y: Math.sin(a) }) : false);
  const moveTo = (goal, run = false) => {
    pathTimer -= DT;
    if (!path.length || pathTimer <= 0) {
      path = e.pathTo(p, goal);
      pathTimer = 0.6;
    }
    while (path[0] && dist(p, path[0]) < 20) path.shift();
    const nxt = e.lineClear(p, goal) ? goal : path[0] || goal,
      a = Math.atan2(nxt.y - p.y, nxt.x - p.x);
    return { x: Math.cos(a), y: Math.sin(a), run };
  };
  const stats = { bandages: 0, interrupts0: g.stats.interrupts, rolls0: e.feel.stats.rolls, slams: 0, doors: 0, screams: 0 };
  const evCount = (type) => e.events.filter((v) => v.type === type).length;
  while (t < 240 && !died) {
    if (s.region !== F.region) break;
    act = Math.max(0, act - DT);
    const b = e.enemies.find((z) => isBoss(z) && !z.dead);
    if (!b) break;
    const foes = e.enemies.filter((z) => !z.dead && !z.nest && dist(z, p) < 500);
    const crowd = foes.filter((z) => dist(z, p) < 130).length;
    if (fightStart < 0 && (b.state === "chase" || dist(b, p) < 300)) fightStart = t;
    stats.slams += evCount("slamCue");
    stats.doors += evCount("doorCue");
    stats.screams += evCount("nurseCue");
    e.events.length = 0;
    const gx = e.gx;
    if ((gx.bleed > 0 || p.hp < 55) && !gx.heal && (s.inventory.bandage || 0) > 0 && !gx.grab && !(gx.down > 0) && act <= 0) {
      if (e.consume("bandage")) stats.bandages++;
    }
    if (!fleeing && p.hp < 30 && !(s.inventory.bandage > 0) && !gx.heal) fleeing = true;
    let input = { x: 0, y: 0, run: false };
    const front = () => Math.abs(Math.atan2(Math.sin(Math.atan2(p.y - b.y, p.x - b.x) - (b.facing ?? 0)), Math.cos(Math.atan2(p.y - b.y, p.x - b.x) - (b.facing ?? 0)))) < 1.1;
    if (gx.grab) {
      if (grabSeen == null) grabSeen = t + 0.15 + R() * 0.2;
      if (t >= grabSeen) {
        if (gx.shoveCd <= 0 && p.stamina >= RULES.shove.cost) e.shove();
        else if ((mashClock -= DT) <= 0) {
          e.interact();
          mashClock = 0.2;
        }
      }
    } else if (gx.down > 0) {
      grabSeen = null;
    } else if (fleeing) {
      grabSeen = null;
      input = moveTo(exit, p.stamina > 8);
      if (dist(p, exit) < 40) break;
    } else {
      grabSeen = null;
      const d = dist(b, p);
      // 预兆：砸地、车门、冲撞、尖叫
      const slam = b.act?.kind === "slam" && d < U.BOSSES.brute.slam.r + 30 && notice(b.act, "seen", crowd);
      const door = b.act?.kind === "door" && notice(b.act, "seen", crowd);
      const charge = b.charge?.phase === "stomp" && notice(b.charge, "seen", crowd);
      const scream = b.act?.kind === "scream" && notice(b.act, "seen", crowd);
      const hazard = (e.ux?.clouds || []).find((c) => dist(c, p) < c.r);
      // 近身出手的预兆（守卫抬手、大块头挥拳、护士长和身边的抓人）：往后退一步或滚开
      const swinger = foes.find((z) => (z.windup > 0 || z.act?.kind === "melee") && dist(z, p) < 105 && notice(z.act || z, "sw" + Math.round((z.windup || 0) * 10 + 9), crowd));
      if (slam) {
        const a = Math.atan2(p.y - b.y, p.x - b.x);
        if (!roll(a)) input = { x: Math.cos(a), y: Math.sin(a), run: true };
      } else if (door || charge) {
        const L = door ? b.act.a : b.charge.a,
          side = Math.sin(Math.atan2(p.y - b.y, p.x - b.x) - L) >= 0 ? 1 : -1,
          a = L + side * (Math.PI / 2);
        // 离那条线够远就不用动
        const off = Math.abs(Math.sin(Math.atan2(p.y - b.y, p.x - b.x) - L)) * d;
        if (off < 60) {
          if (!roll(a)) input = { x: Math.cos(a), y: Math.sin(a), run: true };
        }
      } else if (swinger) {
        const a = Math.atan2(p.y - swinger.y, p.x - swinger.x);
        if (!roll(a)) input = { x: Math.cos(a), y: Math.sin(a), run: true };
      } else if (hazard) {
        const a = Math.atan2(p.y - hazard.y, p.x - hazard.x);
        input = { x: Math.cos(a), y: Math.sin(a), run: true };
      } else if (scream && act <= 0) {
        if (d < W.range - 6 && e.cooldown <= 0) {
          e.use({ x: b.x, y: b.y - 20 });
          act = 0.3;
        } else if (e.qty("stone") > 0 && e.cooldown <= 0 && e.lineClear(p, b) && d < 300) {
          s.slot = 5;
          e.use({ x: b.x, y: b.y });
          s.slot = 3;
          act = 0.4;
        } else input = moveTo(b, true);
      } else {
        const adj = foes.filter((z) => dist(z, p) < 75).length;
        const target = who === "nurse" ? foes.filter((z) => dist(z, p) < W.range - 6).sort((x, y) => dist(x, p) - dist(y, p))[0] || b : b;
        if (adj >= 2 && gx.shoveCd <= 0 && p.stamina >= RULES.shove.cost + 5) {
          p.facing = Math.atan2(target.y - p.y, target.x - p.x);
          e.shove();
        } else if (who.startsWith("guard") && !b.g2 && front() && !b.charge && d < 160 && (circleT += DT) < 3) {
          // 第一段：绕到背后
          const back = (b.facing ?? 0) + Math.PI,
            goal = { x: b.x + Math.cos(back) * 60, y: b.y + Math.sin(back) * 60 };
          input = moveTo(goal, p.stamina > 20);
        } else if (who === "brute" && front() && d < 140 && !b.act && (circleT += DT) < 3) {
          const back = (b.facing ?? 0) + Math.PI,
            goal = { x: b.x + Math.cos(back) * 70, y: b.y + Math.sin(back) * 70 };
          input = moveTo(goal, p.stamina > 20);
          if (d < W.range - 6 && e.cooldown <= 0) e.use({ x: b.x, y: b.y - 20 });
        } else if (dist(target, p) < W.range - 6) {
          if (e.cooldown <= 0) e.use({ x: target.x, y: target.y - 20 });
          // 绕不到背后：正面也打两秒，再试着绕
          if (circleT >= 3 && (circleT += DT) > 5) circleT = 0;
        } else input = moveTo(target);
      }
    }
    e.update(DT, input);
    t += DT;
  }
  const b = e.enemies.find((z) => isBoss(z));
  const won = !died && !!b?.dead;
  return { won, died, fled: !died && !won && fleeing, timeout: !died && !won && !fleeing, t: fightStart >= 0 ? t - fightStart : t, bandages: stats.bandages, rolls: e.feel.stats.rolls - stats.rolls0, interrupts: g.stats.interrupts - stats.interrupts0, slams: stats.slams, doors: stats.doors, screams: stats.screams, hp: Math.round(p.hp) };
}

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0) + "%";
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
for (const who of WHO)
  for (const kitId of KITS) {
    const rs = [];
    const t0 = Date.now();
    for (let i = 0; i < N; i++) rs.push(trial(who, kitId, i + 1));
    const wins = rs.filter((r) => r.won),
      times = wins.map((r) => r.t).sort((a, b) => a - b);
    console.log(
      who,
      kitId,
      JSON.stringify({
        n: N,
        won: pct(wins.length, N),
        died: pct(rs.filter((r) => r.died).length, N),
        fled: pct(rs.filter((r) => r.fled).length, N),
        timeout: rs.filter((r) => r.timeout).length,
        winTimeMed: times.length ? Math.round(times[Math.floor(times.length / 2)]) : null,
        winTimeP25: times.length ? Math.round(times[Math.floor(times.length / 4)]) : null,
        winTimeP75: times.length ? Math.round(times[Math.floor(times.length * 0.75)]) : null,
        bandages: +mean(rs.map((r) => r.bandages)).toFixed(1),
        rolls: +mean(rs.map((r) => r.rolls)).toFixed(1),
        interrupts: +mean(rs.map((r) => r.interrupts)).toFixed(1),
        slams: +mean(rs.map((r) => r.slams)).toFixed(1),
        doors: +mean(rs.map((r) => r.doors)).toFixed(1),
        screams: +mean(rs.map((r) => r.screams)).toFixed(1),
        hpLeft: Math.round(mean(wins.map((r) => r.hp))),
        ms: Date.now() - t0,
      }),
    );
  }
