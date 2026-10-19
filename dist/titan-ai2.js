// v0.37.0「扑火」：后五凶怎么打人，接在 titan-ai.js 的同一套 AI / 钩子上（E 是引擎，e 是那一凶的某一只）。
// 有几只的那几凶（雕爷和看门的、风机和四个肺、车头和四节车厢、心和四盏光）：每一只都是一个“感染者”，
// phaseOf 按打没了哪几只换段，onKill 说打倒的这一只是不是最后一只。每一下伤人的照样先在地上画出来（最短 0.6 秒）。
import { TITANS, FINAL_TEXT } from "./titan-data.js";
import { AI, PHASE_HOOK, HURT_HOOK, SPAWN_HOOK, WAKE_HOOK } from "./titan-ai.js";
import { WORLD } from "./data.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const aim = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);
const at = (list, i) => (Array.isArray(list) ? list[Math.min(i, list.length - 1)] : list);
const inBounds = (q, m = 70) => ({ x: clamp(q.x, m, WORLD.w - m), y: clamp(q.y, m + 10, WORLD.h - m - 10) });
const open = (E, q) => (E.blocked(q.x, q.y, true, 16) ? E.freePoint(q.x, q.y) : q);
const rnd = () => Math.random();
const TAU = Math.PI * 2;
// 转向：每秒最多转多少
const turnTo = (e, want, dt, rate) => {
  const cur = e.facing ?? want,
    diff = Math.atan2(Math.sin(want - cur), Math.cos(want - cur)),
    step = rate * dt;
  e.facing = Math.abs(diff) <= step ? want : cur + Math.sign(diff) * step;
};
// 这一只自己的速度（有几只的那几凶各走各的）
const spd = (E, e, base) => base * (e.speedK || 1) * E.tRage(e).speed * (e.slowT > 0 ? 0.8 : 1);
// 叫来的、爬出来的、扔过来的：普通感染者，追着你；这一凶倒下以后散了
function addFoe(E, type, q, of) {
  const p = E.s.player,
    z = E.enemy(type, q.x, q.y);
  Object.assign(z, { state: "chase", alert: 8, targetX: p.x, targetY: p.y, tAdd: true, tOf: of });
  E.enemies.push(z);
  return z;
}
const addsOf = (E, of) => (E.enemies || []).filter((z) => z.tOf === of && !z.titan && !z.dead).length;

// ================= 第六凶：雕爷和看门的 =================
// 看门的拴在雕爷身上（离他 320 以外够不着）；雕爷躲在它身后放枪、扔烟、叫人。先倒下谁，后面就不一样：
// 雕爷先倒下——看门的挣断链子、嘴套掉了会咬；看门的先倒下——雕爷脱了大氅拼命、扔燃烧瓶、一次叫三个。
const D = TITANS.diao;
const bossOf = (E) => E.titansHere("diao").find((z) => z.part === "boss") || null;
const dogOf = (E) => E.titansHere("diao").find((z) => z.part === "dog") || null;
SPAWN_HOOK.diao = (E, e) => {
  e.hy = 70;
  const q = open(E, { x: D.post.x, y: D.post.y });
  E.tPart(e, "boss", 0, q.x, q.y, { hy: 50, coat: true, facing: Math.PI });
};
WAKE_HOOK.diao = (E, e) => {
  for (const z of E.titansHere("diao")) {
    if (z.part === "boss") {
      Object.assign(z.cd, { shotgun: 1.5, snipe: 2.5, molotov: 3 });
      z.smokeT = D.smoke.every * 0.5;
      z.menT = D.adds.every * 0.4;
    } else Object.assign(z.cd, { slam: 1, charge: 2.5, grab: 3, bite: 2 });
  }
  E.tEmit(e, "tChain", { range: 1300 });
};
AI.diao = {
  phaseOf(E, e) {
    const dog = dogOf(E),
      boss = bossOf(E);
    if (dog && boss) return 0;
    const z = dog || boss;
    if (!z) return e.tp || 0;
    return z.hp / Math.max(1, z.maxHp) <= D.last ? 2 : 1;
  },
  tick(E, e, dt) {
    return e.part === "boss" ? AI.diao.boss(E, e, dt) : AI.diao.dog(E, e, dt);
  },
  // ---------- 看门的 ----------
  dog(E, e, dt) {
    const p = E.s.player,
      d = dist(e, p),
      boss = bossOf(E),
      free = !boss,
      A = e.act;
    e.speedK = (free ? D.free.speed : 1) * (e.tp >= 2 ? D.lastSpeed : 1);
    e.strain = 0;
    if (A) {
      A.t -= dt;
      if (A.k === "chargeWind") {
        if (A.t <= 0) e.act = { k: "charge", t: 9, a: A.a, left: A.len, hit: false };
        return;
      }
      if (A.k === "charge") return AI.diao.charge(E, e, dt, A, boss);
      if (A.t <= 0) {
        e.act = null;
        e.poiseK = 1;
      }
      if (e.act) return;
    }
    // 抓着你：站着不动
    if (E.tx.hold?.src === e.id) return;
    E.tFace(e, dt, 2.6);
    if (d < D.slam.near && !e.cd.slam) {
      const S = D.slam,
        warn = E.tWarn(e, S.warn, true),
        a = aim(e, p),
        c = { x: e.x + Math.cos(a) * 50, y: e.y + Math.sin(a) * 36 };
      E.tStrike(e, { k: "circle", x: c.x, y: c.y, r: S.r }, warn, { dmg: S.dmg, down: S.down }, { cue: "tBearRoar" });
      e.act = { k: "wait", t: warn + 0.5 };
      e.stand = warn;
      E.tCool(e, "slam", S.cd);
      return;
    }
    if (!free && d < D.grab.near && !e.cd.grab) {
      const G = D.grab,
        warn = E.tWarn(e, G.warn),
        a = aim(e, p);
      // 抓住了（推开能挣脱）；没挣开就被往地上摔
      const slam = (E2, src) => {
        const q = E2.s.player;
        E2.tLand({ dmg: G.slam, down: G.down }, src, { k: "circle", x: q.x, y: q.y, r: 30 });
        E2.tSay(src, "摔！", "#ff8a6a");
        E2.tEmit(src, "tThud", { range: 1200 });
      };
      E.tStrike(e, { k: "cone", x: e.x, y: e.y, a, arc: G.arc, r: G.r }, warn, { dmg: G.dmg, hold: G.hold, then: slam }, { cue: "tWhip" });
      e.act = { k: "wait", t: warn + 0.3 };
      E.tCool(e, "grab", G.cd);
      return;
    }
    if (free && d < D.free.bite.near && !e.cd.bite) {
      const B = D.free.bite,
        warn = E.tWarn(e, B.warn),
        a = aim(e, p);
      E.tStrike(e, { k: "cone", x: e.x, y: e.y, a, arc: B.arc, r: B.r }, warn, { dmg: B.dmg, hold: B.hold, dps: B.dps }, { cue: "tWhip" });
      e.act = { k: "wait", t: warn + 0.3 };
      E.tCool(e, "bite", B.cd);
      return;
    }
    const C = D.charge;
    if (!e.cd.charge && d > C.from[0] && d < C.from[1] && E.lineClear(e, p) && (free || dist(boss, p) < D.chain + 80)) return AI.diao.chargeAt(E, e);
    // 往你那儿走：链子拴着，离雕爷 320 以外够不着（绷在链子头上）
    let goal = { x: p.x, y: p.y };
    if (!free && dist(boss, goal) > D.chain) {
      const a = aim(boss, goal);
      goal = { x: boss.x + Math.cos(a) * D.chain, y: boss.y + Math.sin(a) * D.chain };
      e.strain = 1;
    }
    if (dist(e, goal) > 50) E.tMove(e, goal, spd(E, e, D.parts.dog.speed), dt);
  },
  chargeAt(E, e) {
    const C = D.charge,
      p = E.s.player,
      a = aim(e, p),
      len = Math.min(C.from[1] + C.over, dist(e, p) + C.over),
      warn = E.tWarn(e, C.warn, true);
    E.tStrike(e, { k: "line", x: e.x, y: e.y, a, len, w: C.w }, warn, {}, { col: "orange", cue: "tCharge" });
    e.act = { k: "chargeWind", t: warn, a, len };
    e.facing = a;
    E.tCool(e, "charge", C.cd);
  },
  charge(E, e, dt, A, boss) {
    const C = D.charge,
      p = E.s.player,
      step = Math.min(A.left, C.speed * E.tRage(e).speed * dt),
      n = Math.max(1, Math.ceil(step / 8));
    e.facing = A.a;
    for (let i = 0; i < n; i++) {
      const nx = e.x + (Math.cos(A.a) * step) / n,
        ny = e.y + (Math.sin(A.a) * step) / n;
      // 链子拽住：停下来
      if (boss && Math.hypot(nx - boss.x, ny - boss.y) > D.chain) {
        e.act = { k: "yank", t: 0.7 };
        E.tSay(e, "链子拽住了", "#cfc6a8");
        E.tEmit(e, "tChain", { range: 1100 });
        return;
      }
      if (E.blocked(nx, ny, true, 22) || nx < 70 || nx > WORLD.w - 70 || ny < 80 || ny > WORLD.h - 80) {
        e.act = { k: "stun", t: C.stun };
        e.poiseK = 1.3;
        E.tSay(e, "撞晕了！", "#ffdb8c");
        E.tEmit(e, "tThud", { range: 1300 });
        if (!E.s.settings?.access?.calm) E.shake = Math.max(E.shake || 0, 5);
        return;
      }
      e.x = nx;
      e.y = ny;
      A.left -= step / n;
      if (!A.hit && dist(e, p) < C.w / 2 + 18 && E.invulnerable <= 0) {
        A.hit = true;
        E.tLand({ dmg: C.dmg, down: C.down, push: 70 }, e, { k: "circle", x: e.x, y: e.y, r: e.r });
      }
    }
    if (A.left <= 0) e.act = { k: "wait", t: 0.6 };
  },
  // ---------- 雕爷 ----------
  boss(E, e, dt) {
    const p = E.s.player,
      d = dist(e, p),
      dog = dogOf(E),
      alone = !dog,
      A = e.act;
    e.coat = !alone;
    e.speedK = (alone ? 1.15 : 1) * (e.tp >= 2 ? D.lastSpeed : 1);
    // 烟、叫人：到点就来
    e.smokeT = (e.smokeT ?? D.smoke.every * 0.5) - dt;
    if (e.smokeT <= 0) {
      e.smokeT = D.smoke.every * E.tRage(e).cd;
      AI.diao.smoke(E, e, dog);
    }
    e.menT = (e.menT ?? D.adds.every * 0.4) - dt;
    if (e.menT <= 0) {
      e.menT = D.adds.every * E.tRage(e).cd;
      AI.diao.callMen(E, e, alone ? D.adds.rage : D.adds.n);
    }
    if (A) {
      A.t -= dt;
      if (A.lock != null) e.facing = A.lock;
      if (A.t <= 0) e.act = null;
      else return;
    }
    // 盯着你（大氅护着正面）；转得不快，绕着他跑能绕到侧面
    turnTo(e, aim(e, p), dt, 1.6);
    if (d < D.shotgun.near && !e.cd.shotgun) {
      const G = D.shotgun,
        warn = E.tWarn(e, G.warn),
        a = aim(e, p);
      E.tStrike(e, { k: "cone", x: e.x, y: e.y, a, arc: G.arc, r: G.r }, warn, { dmg: G.dmg, far: G.far }, { cue: "tShotgun" });
      e.act = { k: "aim", t: warn + 0.35, lock: a };
      e.facing = a;
      E.tCool(e, "shotgun", G.cd);
      return;
    }
    if (alone && !e.cd.molotov && d > D.molotov.min && d < D.molotov.max) {
      const M = D.molotov,
        warn = E.tWarn(e, M.warn),
        q = open(E, inBounds({ x: p.x, y: p.y }));
      E.tStrike(e, { k: "circle", x: q.x, y: q.y, r: M.r }, warn, { dmg: M.dmg }, { then: (E2) => E2.tZone("fire", { x: q.x, y: q.y, r: M.r }, M.burn, { dps: 12, oiled: 18, by: "t_diao", of: "diao" }) });
      E.tx.fx.push({ kind: "bottle", x0: e.x, y0: e.y - 70, x: q.x, y: q.y, t: warn, max: warn });
      e.act = { k: "aim", t: 0.5, lock: aim(e, q) };
      E.tCool(e, "molotov", M.cd);
      return;
    }
    if (d > D.snipe.min && d < D.snipe.len - 20 && !e.cd.snipe && E.lineClear(e, p)) {
      const S = D.snipe,
        warn = E.tWarn(e, S.warn, true),
        a = aim(e, p);
      E.tStrike(e, { k: "line", x: e.x, y: e.y - 10, a, len: S.len, w: S.w }, warn, { dmg: S.dmg, los: true }, { cue: "tAim" });
      e.act = { k: "aim", t: warn + 0.25, lock: a };
      e.facing = a;
      E.tCool(e, "snipe", S.cd);
      return;
    }
    const goal = AI.diao.spot(E, e, dog);
    if (dist(e, goal) > 24) E.tMove(e, goal, spd(E, e, D.parts.boss.speed), dt);
  },
  // 站哪儿：有看门的就躲在它身后（你、看门的、他一条线）；一个人就离你两百到四百三；都不离开库存那一片太远
  spot(E, e, dog) {
    const p = E.s.player,
      post = D.post;
    let q;
    if (dog) {
      const a = aim(p, dog);
      q = { x: dog.x + Math.cos(a) * D.stand.back, y: dog.y + Math.sin(a) * D.stand.back };
    } else {
      const a = aim(p, e),
        want = clamp(dist(e, p), D.stand.keep[0], D.stand.keep[1]);
      q = { x: p.x + Math.cos(a) * want, y: p.y + Math.sin(a) * want };
    }
    const dp = Math.hypot(q.x - post.x, q.y - post.y);
    if (dp > post.r) {
      const a = Math.atan2(q.y - post.y, q.x - post.x);
      q = { x: post.x + Math.cos(a) * post.r, y: post.y + Math.sin(a) * post.r };
    }
    return open(E, inBounds(q));
  },
  smoke(E, e, dog) {
    const S = D.smoke,
      p = E.s.player,
      q = dog ? { x: e.x, y: e.y } : { x: (e.x * 2 + p.x) / 3, y: (e.y * 2 + p.y) / 3 };
    E.tZone("smoke", { x: q.x, y: q.y, r: S.r }, S.t, { of: "diao" });
    E.tEmit(e, "tSmoke", { range: 1200 });
    E.tSay(e, "烟雾弹！", "#cfc6a8");
  },
  callMen(E, e, n) {
    const room = Math.max(0, D.adds.cap - E.enemies.filter((z) => z.tMan && !z.dead).length);
    let made = 0;
    for (let i = 0; i < Math.min(n, room); i++) {
      const door = D.doors[(i + (e.menN || 0)) % D.doors.length],
        q = E.freePoint(door.x + (rnd() - 0.5) * 60, door.y + (rnd() - 0.5) * 60),
        z = E.enemy("raider", q.x, q.y);
      Object.assign(z, { tMan: true, tOf: "diao", tAdd: true, state: "chase", alert: 8, aim: 0, aimX: 0, aimY: 0, cooldown: 1 + rnd(), blind: 0 });
      E.enemies.push(z);
      made++;
    }
    e.menN = (e.menN || 0) + 1;
    if (made) {
      E.tSay(e, "来人！", "#ff8a6a");
      E.toast("雕爷一声喊，货场里又出来 " + made + " 个灰隼团的人。", "warn");
    }
  },
  // 灰隼团的手下：离你一百五到三百四之间，瞄一秒开一枪（跟农场那几回一样的枪，打完不往农场撤）
  man(E, z, dt) {
    z.cooldown = Math.max(0, (z.cooldown || 0) - dt);
    z.flash = Math.max(0, (z.flash || 0) - dt);
    z.pathTimer = (z.pathTimer || 0) - dt;
    const p = E.s.player,
      d = dist(z, p);
    if (z.aim > 0) {
      z.aim -= dt;
      z.facing = Math.atan2(z.aimY - (z.y - 30), z.aimX - z.x);
      if (z.aim <= 0) E.fireRaidShot(z);
      return;
    }
    const sees = d < 380 && E.lineClear(z, p);
    let goal = null;
    if (d < 150) goal = { x: z.x + ((z.x - p.x) / Math.max(1, d)) * 90, y: z.y + ((z.y - p.y) / Math.max(1, d)) * 90 };
    else if (!sees || d > 340) goal = p;
    if (goal) E.moveRaider(z, { x: clamp(goal.x, 60, WORLD.w - 40), y: clamp(goal.y, 70, WORLD.h - 70) }, dt, 1);
    if (sees && z.cooldown <= 0) {
      z.aim = 1;
      z.aimX = p.x;
      z.aimY = p.y - 24;
    }
  },
  onKill(E, e) {
    const other = E.titansHere("diao").find((z) => z !== e && !z.dead);
    if (!other) return false;
    if (e.part === "boss") {
      E.toast("雕爷倒下了：看门的挣断了铁链，嘴套也掉了——它会咬人了！", "warn");
      E.tx.fx.push({ kind: "snap", x: other.x, y: other.y, t: 0.8, max: 0.8 });
      E.tEmit(other, "tChain", { range: 1400 });
    } else {
      E.toast("看门的倒下了：雕爷脱了大氅要拼命——先收拾他叫来的人。", "warn");
      E.tx.fx.push({ kind: "coat", x: other.x, y: other.y, t: 1.2, max: 1.2 });
    }
    return true;
  },
  tag(E, e) {
    const dog = dogOf(E),
      boss = bossOf(E);
    if (boss && E.tInSmoke(boss)) return "雕爷躲在烟里";
    if (dog && boss) return dog.strain ? "链子绷紧了" : "铁链拴着";
    if (dog) return "挣断了链子 · 会咬";
    return "雕爷拼命了";
  },
  note(E, e, intel) {
    const boss = bossOf(E);
    if (boss && E.tInSmoke(boss)) return "烟里打不准：等烟散，或者上去打";
    return intel ? "看门的够不着离雕爷太远的地方；雕爷举枪瞄你时大氅敞着，趁那时候打，或者绕到他侧面" : "";
  },
};
PHASE_HOOK.diao = (E, e, tp) => {
  if (tp >= 2) for (const z of E.titansHere("diao")) z.speedK = (z.speedK || 1) * D.lastSpeed;
};
// 雕爷的大氅：正面只打得进三成；他举枪瞄你、扔东西的那一下大氅是敞开的（拼命时脱了）
HURT_HOOK.diao = (E, e, n, h) => {
  if (e.part !== "boss" || !e.coat || e.act?.k === "aim") return 1;
  if (angDiff(h.angle + Math.PI, e.facing ?? 0) < D.coat.arc) {
    if ((e.tNoteT || 0) <= 0) {
      e.tNoteT = 1.2;
      E.tSay(e, "大氅挡着 · 等他举枪", "#cfc6a8");
    }
    return D.coat.front;
  }
  return 1;
};

// ================= 第七凶：黑潮 =================
// 喷油（地上一滩，沾上走得慢、身上沾着油）、拿焊枪一擦（它身边的油全着）、抡锚、甩锚拖人；
// 第二段潜水服破了：站在烧着的油里每秒掉一大截、身上会着（着了追得更急），往你那儿扔油桶；第三段整个烧着，身边一圈烫。
const TD = TITANS.tide;
const zoneAt = (E, q, kind) => E.tx.zones.find((Z) => Z.kind === kind && E.tZoneHas(Z, q));
function burnTide(E, e, n) {
  if (!(n > 0) || e.dead) return;
  E._tFire = true;
  try {
    E.dotHurt(e, n);
  } finally {
    E._tFire = false;
  }
}
SPAWN_HOOK.tide = (E, e) => {
  e.hy = 80;
};
WAKE_HOOK.tide = (E, e) => {
  Object.assign(e.cd, { spray: 1.2, ignite: 7, hook: 3, anchor: 0.5, barrel: 4 });
  E.tEmit(e, "tSplash", { range: 1300 });
};
AI.tide = {
  tick(E, e, dt) {
    const p = E.s.player,
      d = dist(e, p),
      tp = e.tp,
      A = e.act;
    // 第二段起：站在烧着的油里每秒掉一大截，身上着了；着了自己也烧
    if (tp >= 1 && zoneAt(E, e, "fire")) {
      burnTide(E, e, TD.burnHp * dt);
      e.aflame = Math.max(e.aflame || 0, TD.aflame.t);
    }
    if (tp >= 2) e.aflame = Math.max(e.aflame || 0, 0.5);
    if (e.aflame > 0) {
      e.aflame -= dt;
      if (tp === 1) burnTide(E, e, TD.aflame.dps * dt);
    }
    if (e.dead) return;
    e.speedK = e.aflame > 0 && tp >= 1 ? TD.aflame.speed : 1;
    // 第三段：身边一圈烫
    if (tp >= 2 && d < TD.aura.r + 16 && E.invulnerable <= 0 && !E.paused) {
      E.envHurt(TD.aura.dps * dt, e.type);
      e.auraNote = (e.auraNote || 0) - dt;
      if (e.auraNote <= 0) {
        e.auraNote = 1;
        E.effects.push({ x: p.x, y: p.y - 70, text: "烫！", t: 0.6, color: "#ff9a5a" });
      }
    }
    if (A) {
      A.t -= dt;
      if (A.t <= 0) e.act = null;
      if (e.act) return;
    }
    E.tFace(e, dt, 2.4);
    // 拿焊枪一擦：身边的油全着（第二段起它怕火了：自己身边有油就不擦）
    if (!e.cd.ignite && AI.tide.oilNear(E, e) && (tp === 0 || !E.tx.zones.some((Z) => Z.kind === "oil" && dist(Z, e) < Z.r + 120))) {
      const I = TD.ignite,
        warn = E.tWarn(e, I.warn, true);
      E.tStrike(e, { k: "circle", x: e.x, y: e.y, r: I.r }, warn, {}, { col: "yellow", cue: "tSpark", then: (E2, src) => src && AI.tide.ignite(E2, src) });
      e.act = { k: "spark", t: warn + 0.3 };
      E.tCool(e, "ignite", I.cd);
      return;
    }
    if (d < TD.anchor.near && !e.cd.anchor) {
      const S = TD.anchor,
        warn = E.tWarn(e, S.warn),
        a = aim(e, p);
      E.tStrike(e, { k: "cone", x: e.x, y: e.y, a, arc: S.arc, r: S.r }, warn, { dmg: S.dmg, push: S.push }, { cue: "tAnchor" });
      e.act = { k: "wait", t: warn + 0.5 };
      e.swing = warn + 0.3;
      E.tCool(e, "anchor", S.cd);
      return;
    }
    if (d > TD.hook.min && d < TD.hook.len - 20 && !e.cd.hook && E.lineClear(e, p)) {
      const H = TD.hook,
        warn = E.tWarn(e, H.warn, true),
        a = aim(e, p);
      E.tStrike(e, { k: "line", x: e.x, y: e.y - 20, a, len: H.len, w: H.w }, warn, { dmg: H.dmg, hold: H.hold, pull: H.pull }, { cue: "tWhip" });
      e.act = { k: "wait", t: warn + 0.4 };
      e.swing = warn + 0.2;
      E.tCool(e, "hook", H.cd);
      return;
    }
    if (!e.cd.spray && d > TD.spray.min && d < TD.spray.r + 60) {
      const S = TD.spray,
        warn = E.tWarn(e, S.warn),
        a = aim(e, p),
        reach = clamp(d, 90, S.r - 20);
      E.tStrike(
        e,
        { k: "cone", x: e.x, y: e.y - 10, a, arc: S.arc, r: S.r },
        warn,
        { dmg: S.dmg },
        {
          cue: "tOil",
          then: (E2) => {
            for (let i = 0; i < S.n; i++) {
              const r = i === 0 ? reach : S.r * (0.4 + 0.5 * rnd()),
                aa = a + (i === 0 ? 0 : (rnd() - 0.5) * S.arc * 1.6),
                q = inBounds({ x: e.x + Math.cos(aa) * r, y: e.y + Math.sin(aa) * r });
              E2.tZone("oil", { x: q.x, y: q.y, r: TD.oil.r }, TD.oil.t, { slow: TD.oil.slow, coat: TD.oil.coat, of: "tide" });
            }
          },
        },
      );
      e.act = { k: "wait", t: warn + 0.4 };
      E.tCool(e, "spray", S.cd);
      return;
    }
    if (tp >= 1 && !e.cd.barrel && d > TD.barrel.min && d < TD.barrel.max) {
      const B = TD.barrel,
        warn = E.tWarn(e, B.warn),
        q = open(E, inBounds({ x: p.x, y: p.y }));
      E.tStrike(e, { k: "circle", x: q.x, y: q.y, r: B.r }, warn, { dmg: B.dmg }, { then: (E2) => E2.tZone("oil", { x: q.x, y: q.y, r: B.oil }, TD.oil.t, { slow: TD.oil.slow, coat: TD.oil.coat, of: "tide" }) });
      E.tx.fx.push({ kind: "drum", x0: e.x, y0: e.y - 110, x: q.x, y: q.y, t: warn, max: warn });
      e.act = { k: "wait", t: 0.6 };
      E.tCool(e, "barrel", B.cd);
      return;
    }
    if (d > 80) E.tMove(e, p, E.tSpeed(e), dt);
  },
  // 它身边（焊枪那一圈里）有没有油、你在不在那一圈附近
  oilNear(E, e) {
    const I = TD.ignite,
      p = E.s.player;
    if (dist(e, p) > I.r + 80) return false;
    return E.tx.zones.some((Z) => Z.kind === "oil" && dist(Z, e) < I.r + Z.r * 0.5);
  },
  ignite(E, e) {
    const I = TD.ignite;
    let n = 0;
    for (const Z of E.tx.zones)
      if (Z.kind === "oil" && dist(Z, e) < I.r + Z.r * 0.5) {
        E.tLight(Z);
        n++;
      }
    if (n) E.tEmit(e, "tSpark", { range: 1200 });
  },
  tag(E, e) {
    if (e.tp === 0) return "潜水服湿着 · 不怕火";
    if (e.tp >= 2) return "整个烧起来了";
    return e.aflame > 0 ? "身上着了 · 追得更急" : "潜水服破了 · 怕火";
  },
  note(E, e, intel) {
    if (e.tp === 1 && !(e.aflame > 0)) return "把它引到油上，扔燃烧瓶点着";
    return intel ? "别站在油里；第二段起把它引到油上、扔燃烧瓶点着" : "";
  },
};
PHASE_HOOK.tide = (E, e, tp) => {
  if (tp === 1) E.toast("黑潮的潜水服破了：它现在怕火——把它引到油上点着！", "warn");
  if (tp >= 2) E.toast("黑潮整个身子烧起来了：离它远一点。", "warn");
};
// 潜水服湿着（第一段）：火烧不动它；潜水服破了以后肚子里的油往外淌：刀枪打上去打滑，火一点就着；整个烧起来以后油烧干了
HURT_HOOK.tide = (E, e, n, h) => {
  if (h.kind === "fire") return e.tp === 0 ? 0 : 1;
  // 第三段油烧干了：打得进
  if (e.tp !== 1) return 1;
  if ((e.tNoteT || 0) <= 0) {
    e.tNoteT = 1.5;
    E.tSay(e, "一身油 · 打上去打滑", "#cfc6a8");
  }
  return TD.slick;
};

// ================= 第八凶：风口 =================
// 长在墙上不动：风机（本体）和墙上四个肺。肺在的时候风机只打得进两成五。
// 吸（往风口拽，越近越狠，风口跟前扇叶刮人）、吐（一团毒气把人推开）、伸手（三成被抓住）、墙缝里每 20 秒爬出 3 只；
// 肺全破了：风机正转，风刃绕着风口一圈圈扫（不吸不吐）；最后一口气：又吸起来、吸得更狠、风刃转得更快、爬得更快。
const V = TITANS.vent;
const ventFan = (E) => E.titansHere("vent").find((z) => z.part === "fan") || null;
const ventLungs = (E) => E.titansHere("vent").filter((z) => z.part === "lung");
SPAWN_HOOK.vent = (E, e) => {
  e.hy = 46;
  e.still = true;
  e.bladeA = Math.PI / 2;
  V.lungs.forEach((L, i) => E.tPart(e, "lung", i, e.x + L.dx, e.y + L.dy, { hy: 26, still: true, front: true }));
};
WAKE_HOOK.vent = (E, e) => {
  const f = ventFan(E);
  if (f) {
    Object.assign(f.cd, { suck: 4, blow: 2, reach: 1.2 });
    f.crawlT = V.crawl.every * 0.5;
  }
  E.tEmit(e, "tSuck", { range: 1400 });
};
AI.vent = {
  phaseOf(E, e) {
    const f = ventFan(E);
    if (!f) return e.tp || 0;
    if (ventLungs(E).length) return 0;
    return f.hp / Math.max(1, f.maxHp) <= V.last ? 2 : 1;
  },
  walkHome() {},
  idle(E, e, dt) {
    e.breath = (e.breath || 0) + dt;
  },
  tick(E, e, dt) {
    e.breath = (e.breath || 0) + dt;
    e.puff = Math.max(0, (e.puff || 0) - dt);
    if (e.part === "lung") return;
    const p = E.s.player,
      d = dist(e, p),
      tp = e.tp,
      A = e.act;
    e.spin = (e.spin || 0) + dt * (A?.k === "suck" ? -10 : tp >= 1 ? 6 : 3);
    if (tp >= 1) AI.vent.blades(E, e, dt);
    e.crawlT = (e.crawlT ?? V.crawl.every) - dt;
    if (e.crawlT <= 0) {
      e.crawlT = (tp >= 2 ? V.lastCrawl : V.crawl.every) * E.tRage(e).cd;
      AI.vent.crawl(E, e);
    }
    if (A) {
      A.t -= dt;
      if (A.k === "suckWind") {
        if (A.t <= 0) e.act = { k: "suck", t: V.suck.t, tick: 0 };
        return;
      }
      if (A.k === "suck") {
        AI.vent.suck(E, e, dt, A);
        if (A.t <= 0) e.act = { k: "wait", t: 0.8 };
        return;
      }
      if (A.t <= 0) e.act = null;
      if (e.act) return;
    }
    // 吸：第一段、最后一口气（风刃那一段风机正转，不吸）
    if (tp !== 1 && !e.cd.suck && d < V.suck.edge - 40) {
      const warn = E.tWarn(e, V.suck.warn, true);
      e.act = { k: "suckWind", t: warn };
      E.tx.fx.push({ kind: "suck", x: e.x, y: e.y, r: V.suck.edge, near: V.suck.near, t: warn + V.suck.t, max: warn + V.suck.t, warn });
      E.tEmit(e, "tSuck", { range: 1500, voice: true, duck: true });
      E.tCool(e, "suck", V.suck.cd);
      return;
    }
    // 吐：只在第一段（肺还在）
    if (tp === 0 && !e.cd.blow && d < V.blow.r + 40) {
      const B = V.blow,
        warn = E.tWarn(e, B.warn),
        a = aim(e, p);
      E.tStrike(
        e,
        { k: "cone", x: e.x, y: e.y, a, arc: B.arc, r: B.r },
        warn,
        { dmg: B.dmg, push: B.push },
        {
          cue: "tBlow",
          then: (E2) => {
            for (const [k, da] of [
              [0.62, 0],
              [0.86, rnd() < 0.5 ? 0.32 : -0.32],
            ]) {
              const q = inBounds({ x: e.x + Math.cos(a + da) * B.r * k, y: e.y + Math.sin(a + da) * B.r * k });
              E2.tZone("gas", { x: q.x, y: q.y, r: B.gas.r }, B.gas.t, { dps: B.gas.dps, of: "vent" });
            }
          },
        },
      );
      for (const L of ventLungs(E)) L.puff = warn;
      e.act = { k: "wait", t: warn + 0.4 };
      E.tCool(e, "blow", B.cd);
      return;
    }
    // 伸手：风刃那一段不伸（只有风刃）
    if (tp !== 1 && !e.cd.reach && d > V.reach.min && d < V.reach.len) {
      const R = V.reach,
        warn = E.tWarn(e, R.warn),
        from = [e, ...ventLungs(E)].sort((a, b) => dist(a, p) - dist(b, p))[0],
        a = aim(from, p);
      E.tStrike(e, { k: "line", x: from.x, y: from.y + 6, a, len: R.len, w: R.w }, warn, { dmg: R.dmg, hold: rnd() < R.chance ? R.hold : 0 }, { cue: "tWhip" });
      e.act = { k: "wait", t: warn + 0.3 };
      E.tCool(e, "reach", R.cd);
    }
  },
  // 吸：越近拽得越狠；风口跟前扇叶每半秒刮一下；顶着风跑费体力
  suck(E, e, dt, A) {
    const S = V.suck,
      p = E.s.player,
      d = dist(e, p),
      k = e.tp >= 2 ? V.lastPull : 1;
    if (d < S.edge && !E.paused) {
      const f = d <= S.near ? 1 : clamp(1 - (d - S.near) / (S.edge - S.near), 0.25, 1),
        a = aim(p, e),
        m = Math.min(Math.max(0, d - S.blade * 0.5), S.pull * k * f * dt);
      E.moveEntity(p, Math.cos(a) * m, Math.sin(a) * m);
      p.stamina = Math.max(0, p.stamina - S.sta * f * dt);
    }
    A.tick -= dt;
    if (A.tick <= 0) {
      A.tick = S.tick;
      if (dist(e, p) < S.blade + 24) E.tLand({ dmg: S.dmg }, e, { k: "circle", x: e.x, y: e.y, r: S.blade });
    }
  },
  // 风刃：绕着风口转（只扫墙外那一半）
  blades(E, e, dt) {
    const Bl = V.blades,
      n = at(Bl.n, e.tp),
      sp = at(Bl.speed, e.tp) * E.tRage(e).speed,
      p = E.s.player;
    e.bladeA = (e.bladeA ?? Math.PI / 2) + sp * dt;
    e.bladeHit ||= {};
    for (let i = 0; i < n; i++) {
      e.bladeHit[i] = Math.max(0, (e.bladeHit[i] || 0) - dt);
      const a = e.bladeA + (i * TAU) / n;
      if (Math.sin(a) < 0.05 || e.bladeHit[i] > 0) continue;
      const shape = { k: "line", x: e.x + Math.cos(a) * Bl.r0, y: e.y + Math.sin(a) * Bl.r0, a, len: Bl.len - Bl.r0, w: Bl.w };
      if (E.tInShape(shape, p, 4) && E.tLand({ dmg: Bl.dmg, down: Bl.down }, e, shape)) e.bladeHit[i] = 1.2;
    }
  },
  crawl(E, e) {
    const C = V.crawl,
      room = Math.max(0, (C.cap || 9) - addsOf(E, "vent"));
    for (let i = 0; i < Math.min(C.n, room); i++) {
      const c = C.cracks[i % C.cracks.length],
        q = E.freePoint(c.x + (rnd() - 0.5) * 30, c.y + 24 + rnd() * 20);
      addFoe(E, e.tp >= 2 && i === 0 ? "runner" : "slow", q, "vent");
    }
    if (room) E.tSay(e, "墙缝里爬出来了！", "#ff8a6a");
  },
  onKill(E, e) {
    if (e.part !== "lung") return false;
    const f = ventFan(E);
    if (!f || f.dead) return false;
    const left = ventLungs(E).filter((z) => z !== e).length;
    E.toast(left ? "墙上的肺破了一个（还剩 " + left + " 个）。" : "四个肺全破了：风机转起来了，地上的风刃要扫过来——跟着它绕！", "warn");
    E.tx.fx.push({ kind: "burst", x: e.x, y: e.y - 20, t: 0.7, max: 0.7 });
    return true;
  },
  tag(E, e) {
    const f = ventFan(E),
      n = ventLungs(E).length;
    if (f?.act?.k === "suck" || f?.act?.k === "suckWind") return "在吸！往外跑";
    if (n) return "肺还鼓着 " + n + " 个 · 风机打不太动";
    return f?.tp >= 2 ? "最后一口气" : "风刃转起来了";
  },
  note(E, e, intel) {
    const f = ventFan(E);
    if (f?.act?.k === "suck" || f?.act?.k === "suckWind") return "往外跑，别贴着墙";
    return intel ? "先在远处把四个肺打破；它吸的时候往外跑；风刃转起来跟着绕" : "";
  },
};
PHASE_HOOK.vent = (E, e, tp) => {
  const f = ventFan(E);
  if (f && tp >= 1) f.bladeA = Math.PI * 0.15;
  if (tp >= 2) E.toast("风口最后一口气：又吸起来了，吸得更狠，风刃转得更快。", "warn");
};
// 肺在：风机只打得进两成五；风机罩着铁丝网，箭和子弹打上去只进几成（肺没有网）
HURT_HOOK.vent = (E, e, n, h) => {
  if (e.part !== "fan") return 1;
  const net = h.kind === "ranged" ? V.net : 1;
  if (!ventLungs(E).length) return net;
  if ((e.tNoteT || 0) <= 0) {
    e.tNoteT = 1.2;
    E.tSay(e, "肺鼓着 · 打不动", "#cfc6a8");
  }
  return V.shield * net;
};

// ================= 第九凶：末班车 =================
// 车头和四节车厢一节连一节，在轨道上来回跑：远处一盏灯亮起来、铁轨嗡嗡响（整条轨道一道橙色），冲过去，停在你身边；
// 停着的时候车门打开下来人、最后一节横着甩、受电弓打火让两条铁轨通电；停够了开走，过一会儿掉个头再进站。
// 车厢打完：车头翻下轨道，拖着断掉的车钩在房间之间追你。
const TR = TITANS.train;
const TY = TR.track.y,
  CAR = TR.parts.car.len;
const trainHead = (E) => E.titansHere("train").find((z) => z.part === "head") || null;
const trainCars = (E) => E.titansHere("train").filter((z) => z.part === "car").sort((a, b) => a.idx - b.idx);
SPAWN_HOOK.train = (E, e) => {
  e.hy = 36;
  e.dir = 1;
  e.y = e.homeY = TY;
  e.facing = 0;
  for (let i = 0; i < TR.parts.car.n; i++) E.tPart(e, "car", i, e.x - (TR.headLen / 2 + CAR / 2 + i * CAR), TY, { hy: 34, facing: 0 });
};
WAKE_HOOK.train = (E, e) => {
  const h = trainHead(E);
  if (!h) return;
  // 醒了先开走（汽笛一响），过一会儿从另一头进站
  h.act = { k: "pull", t: E.tWarn(h, 0.9), dir: h.dir || 1 };
  AI.train.aheadWarn(E, h, h.act.t);
  Object.assign(h.cd, { arc: 4, tail: 2 });
  E.tEmit(h, "tHorn", { range: 2200, duck: true });
};
AI.train = {
  phaseOf(E, e) {
    const h = trainHead(E);
    if (!h) return e.tp || 0;
    if (trainCars(E).length) return 0;
    return h.hp / Math.max(1, h.maxHp) <= TR.last ? 2 : 1;
  },
  idle() {},
  sleep(E, e) {
    if (e.part === "head") AI.train.layout(E, e);
  },
  walkHome(E, e, dt, home) {
    if (e.part !== "head") return;
    e.x = home.x;
    e.y = TY;
    e.hidden = false;
    AI.train.layout(E, e);
  },
  // 车厢一节连一节排在车头后面（打掉的那一节空出来，后面的往前补）
  layout(E, h) {
    trainCars(E).forEach((c, k) => {
      c.x = h.x - (h.dir || 1) * (TR.headLen / 2 + CAR / 2 + k * CAR);
      c.y = TY;
      c.facing = h.facing;
      c.hidden = !!h.hidden;
    });
  },
  span(E, h) {
    const xs = [h.x, ...trainCars(E).map((c) => c.x)];
    return { lo: Math.min(...xs) - CAR / 2, hi: Math.max(...xs) + TR.headLen / 2 };
  },
  speed(E, h) {
    const gone = TR.parts.car.n - trainCars(E).length;
    return TR.run.speed * (1 + TR.run.faster * gone) * E.tRage(h).speed;
  },
  // 开走之前：车头前面那一截轨道一道橙色
  aheadWarn(E, h, warn) {
    const dir = h.dir || 1,
      x0 = h.x + dir * (TR.headLen / 2),
      x1 = dir > 0 ? WORLD.w : 0;
    E.tStrike(h, { k: "rect", x: Math.min(x0, x1), y: TY - TR.track.h / 2, w: Math.abs(x1 - x0), h: TR.track.h }, warn, {}, { col: "orange" });
  },
  tick(E, e, dt) {
    if (e.part !== "head") return;
    if (e.tp >= 1) return AI.train.derailed(E, e, dt);
    const p = E.s.player,
      A = e.act || (e.act = { k: "gone", t: 1, dir: e.dir || 1 }),
      tp = e.tp;
    A.t -= dt;
    switch (A.k) {
      case "pull":
        // 汽笛响完开走
        if (A.t <= 0) e.act = { k: "leave", t: 30, dir: A.dir, v: 0, hit: false };
        break;
      case "leave": {
        A.v = Math.min(AI.train.speed(E, e), A.v + 900 * dt);
        e.x += A.dir * A.v * dt;
        e.facing = A.dir > 0 ? 0 : Math.PI;
        AI.train.layout(E, e);
        AI.train.contact(E, e, A);
        const s = AI.train.span(E, e);
        if ((A.dir > 0 && s.lo > WORLD.w + 40) || (A.dir < 0 && s.hi < -40)) {
          e.hidden = true;
          AI.train.layout(E, e);
          e.act = { k: "gone", t: at(TR.away, tp), dir: -A.dir };
        }
        break;
      }
      case "gone":
        e.hidden = true;
        if (A.t <= 0) AI.train.enter(E, e, A.dir);
        break;
      case "warn":
        if (A.t <= 0) {
          e.hidden = false;
          e.act = { k: "run", t: 30, dir: A.dir, to: A.to, hit: false };
        }
        break;
      case "run": {
        const v = AI.train.speed(E, e),
          left = (A.to - e.x) * A.dir;
        e.x += A.dir * Math.min(Math.max(0, left), v * dt);
        e.facing = A.dir > 0 ? 0 : Math.PI;
        AI.train.layout(E, e);
        AI.train.contact(E, e, A);
        if (left <= v * dt) {
          e.x = A.to;
          AI.train.layout(E, e);
          e.act = { k: "stop", t: TR.stop.t, dir: A.dir, doors: 0.5 };
          e.cd.arc = Math.max(e.cd.arc || 0, 1.2);
          E.tEmit(e, "tThud", { range: 1600 });
          if (!E.s.settings?.access?.calm) E.shake = Math.max(E.shake || 0, 4);
        }
        break;
      }
      case "stop":
        AI.train.stopped(E, e, dt, A);
        break;
      default:
        if (A.t <= 0) e.act = { k: "gone", t: 1, dir: e.dir || 1 };
    }
  },
  // 进站：从这一头的远处一盏灯亮起来，整条轨道一道橙色；车头停在你跟前（车头连着车厢时打不太动，车厢在后面）
  enter(E, e, dir) {
    const p = E.s.player,
      cars = trainCars(E).length,
      tail = TR.headLen / 2 + cars * CAR,
      lo = TR.track.x0 + (dir > 0 ? tail : TR.headLen / 2),
      hi = TR.track.x1 - (dir > 0 ? TR.headLen / 2 : tail),
      to = clamp(p.x + dir * 40, lo, hi),
      warn = E.tWarn(e, TR.run.warn, true);
    e.dir = dir;
    e.facing = dir > 0 ? 0 : Math.PI;
    e.x = dir > 0 ? -TR.headLen / 2 - 10 : WORLD.w + TR.headLen / 2 + 10;
    e.hidden = true;
    AI.train.layout(E, e);
    E.tStrike(e, { k: "rect", x: 0, y: TY - TR.track.h / 2, w: WORLD.w, h: TR.track.h }, warn, {}, { col: "orange", cue: "tHorn" });
    E.tx.fx.push({ kind: "headlight", x: dir > 0 ? 24 : WORLD.w - 24, y: TY - 10, dir, t: warn, max: warn });
    e.act = { k: "warn", t: warn, dir, to };
  },
  // 冲过去时撞上：倒地、甩到轨道外面
  contact(E, e, A) {
    if (A.hit || E.invulnerable > 0) return;
    const p = E.s.player;
    if (Math.abs(p.y - TY) > TR.track.h / 2 + 6) return;
    const s = AI.train.span(E, e);
    if (p.x < s.lo - 10 || p.x > s.hi + 10) return;
    A.hit = true;
    E.tLand({ dmg: TR.run.dmg, down: TR.run.down, push: 90, pushA: p.y < TY ? -Math.PI / 2 : Math.PI / 2 }, e, { k: "circle", x: p.x, y: TY, r: 40 });
  },
  stopped(E, e, dt, A) {
    const p = E.s.player,
      cars = trainCars(E);
    // 车门打开：隔一站下来几只（从哪几节下来轮着来）
    if (A.doors > 0) {
      A.doors -= dt;
      if (A.doors <= 0 && cars.length && (e.stops = (e.stops || 0) + 1) % (TR.doors.every || 1) === 1 % (TR.doors.every || 1)) {
        const room = Math.max(0, TR.doors.cap - addsOf(E, "train")),
          n = Math.min(room, TR.doors.n);
        for (let i = 0; i < n; i++) {
          const c = cars[((e.doorN || 0) + i) % cars.length],
            q = E.freePoint(c.x + (i % 2 ? 24 : -24), TY + (rnd() < 0.5 ? -40 : 40));
          addFoe(E, rnd() < 0.3 ? "runner" : "slow", q, "train");
          e.doorN = (e.doorN || 0) + 1;
        }
        if (n) E.tSay(e, "车门开了！", "#ff8a6a");
      }
    }
    // 受电弓打火：两条铁轨通电
    if (!e.cd.arc) {
      const R = TR.arc,
        warn = E.tWarn(e, R.warn),
        rect = { x: TR.track.x0 - 40, y: TY - TR.track.h / 2, w: TR.track.x1 - TR.track.x0 + 80, h: TR.track.h };
      E.tStrike(e, { k: "rect", ...rect }, warn, {}, { col: "blue", cue: "tArc", then: (E2) => E2.tZone("volt", { ...rect }, R.t, { dps: R.dps, by: "t_train", of: "train" }) });
      E.tCool(e, "arc", R.cd);
    }
    // 车头正前面：汽笛一响把人震开
    const front = { x: e.x + (e.dir || 1) * (TR.headLen / 2 - 10), y: TY };
    if (!e.cd.horn && dist(front, p) < TR.horn.r + 20 && (p.x - front.x) * (e.dir || 1) > -20) {
      const H = TR.horn,
        warn = E.tWarn(e, H.warn);
      E.tStrike(e, { k: "cone", x: front.x, y: front.y, a: (e.dir || 1) > 0 ? 0 : Math.PI, arc: H.arc, r: H.r }, warn, { dmg: H.dmg, push: H.push }, { cue: "tHorn" });
      E.tCool(e, "horn", H.cd);
    }
    // 最后一节往后甩（站在车尾后面的挨；站在车厢旁边的不挨）
    const last = cars[cars.length - 1];
    if (last && !e.cd.tail && dist(last, p) < TR.tail.r + CAR / 2 + 30) {
      const T2 = TR.tail,
        warn = E.tWarn(e, T2.warn),
        back = (e.dir || 1) > 0 ? Math.PI : 0,
        o = { x: last.x - (e.dir || 1) * (CAR / 2), y: TY };
      E.tStrike(last, { k: "cone", x: o.x, y: o.y, a: back, arc: T2.arc, r: T2.r }, warn, { dmg: T2.dmg, push: 60 }, { cue: "tWhip" });
      last.swing = warn + 0.2;
      E.tCool(e, "tail", T2.cd);
    }
    if (A.t <= 0) {
      e.act = { k: "pull", t: E.tWarn(e, 0.9), dir: A.dir };
      AI.train.aheadWarn(E, e, e.act.t);
      E.tEmit(e, "tHorn", { range: 1800 });
    }
  },
  // 车厢打完：翻下轨道，在房间和过道之间追你
  derailed(E, e, dt) {
    e.hidden = false;
    const p = E.s.player,
      d = dist(e, p),
      A = e.act;
    e.speedK = e.tp >= 2 ? TR.lastSpeed : 1;
    if (A) {
      A.t -= dt;
      if (A.t <= 0) e.act = null;
      else return;
    }
    E.tFace(e, dt, 2.8);
    if (d < TR.bite.near && !e.cd.bite) {
      const B = TR.bite,
        warn = E.tWarn(e, B.warn);
      E.tStrike(e, { k: "cone", x: e.x, y: e.y, a: aim(e, p), arc: B.arc, r: B.r }, warn, { dmg: B.dmg }, { cue: "tWhip" });
      e.act = { k: "wait", t: warn + 0.25 };
      E.tCool(e, "bite", B.cd);
      return;
    }
    if (d < TR.hookSweep.near && !e.cd.sweep) {
      const H = TR.hookSweep,
        warn = E.tWarn(e, H.warn),
        a = aim(e, p) + Math.PI;
      // 车钩拖在身后，抡一圈扫过来
      E.tStrike(e, { k: "cone", x: e.x, y: e.y, a: aim(e, p), arc: H.arc, r: H.r }, warn, { dmg: H.dmg, push: H.push }, { cue: "tAnchor" });
      e.act = { k: "wait", t: warn + 0.4 };
      e.swing = warn + 0.2;
      e.swingA = a;
      E.tCool(e, "sweep", H.cd);
      return;
    }
    if (d > 70) E.tMove(e, p, E.tSpeed(e), dt);
  },
  onKill(E, e) {
    if (e.part !== "car") return false;
    const h = trainHead(E);
    if (!h || h.dead) return false;
    const left = trainCars(E).filter((z) => z !== e).length;
    if (left) E.toast("打掉一节车厢（还剩 " + left + " 节）：车短了，冲得更快。", "warn");
    E.tx.fx.push({ kind: "burst", x: e.x, y: e.y - 30, t: 0.7, max: 0.7 });
    // 后面的车厢往前补
    e.dead = true;
    AI.train.layout(E, h);
    return true;
  },
  tag(E, e) {
    const h = trainHead(E),
      n = trainCars(E).length,
      k = h?.act?.k;
    if (!h) return "";
    if (h.tp >= 1) return "翻下轨道了";
    if (k === "warn") return "车要来了！钻过道";
    if (k === "stop") return "停下了 · 打车厢（还剩 " + n + " 节）";
    if (k === "run" || k === "leave") return "冲过来了";
    return "开走了 · 还会再来";
  },
  note(E, e, intel) {
    const h = trainHead(E);
    if (h?.act?.k === "warn") return "灯一亮就钻进轨道两边的过道";
    if (E.tx.zones.some((Z) => Z.kind === "volt")) return "铁轨通电了：离开铁轨";
    return intel ? "灯一亮就钻进旁边的过道；车停下来打车厢，从最后一节打起；电弧时离开铁轨" : "";
  },
};
PHASE_HOOK.train = (E, e, tp) => {
  const h = trainHead(E);
  if (!h) return;
  if (tp >= 1 && !h.derailed) {
    h.derailed = true;
    h.hidden = false;
    h.x = clamp(h.x, TR.track.x0 + 60, TR.track.x1 - 60);
    h.y = TY;
    h.act = { k: "wait", t: 1.2 };
    E.tx.zones = E.tx.zones.filter((Z) => Z.kind !== "volt");
    E.tx.strikes = E.tx.strikes.filter((S) => S.titan !== "train");
    E.tx.fx.push({ kind: "derail", x: h.x, y: h.y, t: 1, max: 1 });
    E.toast("车厢打完了：车头翻下轨道，拖着车钩追过来了！", "warn");
  }
};
// 车厢还连着：车头只打得进三成
HURT_HOOK.train = (E, e, n, h) => (e.part === "head" && trainCars(E).length ? TR.linked : 1);

// ================= 最后一凶：扑火 =================
// 一座会走的尸山，身上嵌着四盏光（以前被它吞掉的营火），一直往农场中间的篝火挪；光在的时候身子只打得进一成。
// 巨手从天上砸、从身上扯下感染者扔过来、踩坏外面的设施；光全灭：塌成三道浪从东往西卷（只留一个口子），
// 浪退下去露出一颗烧着的心；心剩两成五就直奔篝火爬——扑到了这一夜就没守住。
const M = TITANS.moth;
const mothBody = (E) => E.titansHere("moth").find((z) => z.part === "body") || null;
const mothLights = (E) => E.titansHere("moth").filter((z) => z.part === "light");
const fireOf = (E) => E.fireSpot?.() || { x: 830, y: 520 };
SPAWN_HOOK.moth = (E, e) => {
  e.hy = 110;
  e.still = false;
  M.lights.forEach((L, i) => E.tPart(e, "light", i, e.x + L.dx, e.y + L.dy, { hy: 0, dx: L.dx, dy: L.dy, front: true }));
  // 上回打掉的伤留一半
  const rec = E.tg.hp.moth,
    keep = E.tg.final?.keep || 0;
  if (!(rec && rec.day === E.s.day) && keep > 0) for (const z of E.titansHere("moth")) z.hp = Math.max(1, Math.round(z.maxHp * (1 - keep)));
};
WAKE_HOOK.moth = (E, e) => {
  const b = mothBody(E);
  if (b) Object.assign(b.cd, { hand: 4, fling: 6 });
};
AI.moth = {
  phaseOf(E, e) {
    const b = mothBody(E);
    if (!b) return e.tp || 0;
    if (mothLights(E).length) return 0;
    return b.hp / Math.max(1, b.maxHp) <= M.crawl.at ? 2 : 1;
  },
  walkHome() {},
  tick(E, e, dt) {
    if (e.part === "light") {
      // 一明一暗：暗下去的那两秒打不太动
      e.flick = (e.flick || 0) + dt;
      const P = M.pulse,
        k = (e.flick + e.idx * 1.3) % (P.on + P.off);
      e.dim = k >= P.on;
      return;
    }
    AI.moth.waves(E, e, dt);
    for (const L of mothLights(E)) {
      L.x = e.x + L.dx;
      L.y = e.y + L.dy;
    }
    const A = e.act;
    if (A?.k === "collapse") {
      A.t -= dt;
      A.next -= dt;
      if (A.next <= 0 && A.n > 0) {
        A.n--;
        A.next = M.wave.every;
        AI.moth.wave(E, e);
      }
      if (A.n <= 0 && A.t <= 0 && !E.tx.waves.length) {
        // 浪退下去：露出那颗心
        e.act = null;
        e.hidden = false;
        e.heart = true;
        e.r = M.heart.r;
        e.hy = 30;
        e.cd.beat = 2;
        E.toast(FINAL_TEXT.heart, "warn");
      }
      return;
    }
    if (e.heart) return AI.moth.heart(E, e, dt);
    AI.moth.walk(E, e, dt);
  },
  // 第一段：往篝火挪（挪到离篝火五百多停下），踩坏外面的设施；巨手、扔感染者
  walk(E, e, dt) {
    const p = E.s.player,
      d = dist(e, p),
      fire = fireOf(E),
      df = dist(e, fire),
      A = e.act;
    if (df > M.standoff) {
      const a = aim(e, fire),
        step = Math.min(df - M.standoff, spd(E, e, M.speed) * dt);
      e.x += Math.cos(a) * step;
      e.y += Math.sin(a) * step;
      e.facing = a;
    }
    AI.moth.trample(E, e, dt);
    if (A) {
      A.t -= dt;
      if (A.t <= 0) e.act = null;
      else return;
    }
    if (!e.cd.hand && d < 760) {
      const H = M.hand,
        warn = E.tWarn(e, H.warn, true),
        q = inBounds({ x: p.x, y: p.y });
      E.tStrike(e, { k: "circle", x: q.x, y: q.y, r: H.r }, warn, { dmg: H.dmg, down: H.down, push: 40 }, { cue: "tHand" });
      E.tx.fx.push({ kind: "hand", x: q.x, y: q.y, r: H.r, t: warn + 0.35, max: warn + 0.35, warn });
      e.act = { k: "wait", t: 0.8 };
      E.tCool(e, "hand", H.cd);
      return;
    }
    if (!e.cd.fling && d > M.fling.min && d < M.fling.max + 300) {
      AI.moth.fling(E, e, 200);
      e.act = { k: "wait", t: 0.6 };
      E.tCool(e, "fling", M.fling.cd);
    }
  },
  // 扯下感染者扔过来：落点一圈红，落下来的是活的
  fling(E, e, lift) {
    const F = M.fling,
      p = E.s.player,
      room = Math.max(0, F.cap - addsOf(E, "moth")),
      warn = E.tWarn(e, F.warn);
    for (let i = 0; i < F.n; i++) {
      const a = rnd() * TAU,
        r = i === 0 ? 0 : 90 + rnd() * 70,
        q = open(E, inBounds({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r * 0.7 })),
        live = i < room;
      E.tStrike(e, { k: "circle", x: q.x, y: q.y, r: F.r }, warn + i * 0.12, { dmg: F.dmg }, { then: live ? (E2) => addFoe(E2, rnd() < 0.4 ? "runner" : "slow", q, "moth") : null });
      E.tx.fx.push({ kind: "fling", x0: e.x + (rnd() - 0.5) * 120, y0: e.y - lift, x: q.x, y: q.y, t: warn + i * 0.12, max: warn + i * 0.12 });
    }
  },
  // 踩坏外面的设施（围栏、塔、陷阱……）
  trample(E, e, dt) {
    const T2 = M.trample;
    e.trampleT = (e.trampleT || 0) - dt;
    if (e.trampleT > 0) return;
    e.trampleT = 0.5;
    let broke = 0;
    for (const b of E.s.buildings || []) {
      if (!T2.kinds.includes(b.type) || !(b.hp > 0) || Math.hypot(b.x - e.x, b.y - e.y) > T2.r + 30) continue;
      b.hp = Math.max(0, b.hp - T2.dps * 0.5);
      if (b.hp <= 0) broke++;
    }
    if (broke) {
      E.navRevision = (E.navRevision || 0) + 1;
      E.toast("扑火的踩塌了 " + broke + " 样东西。", "warn");
    }
    // 地上的陷阱：踩一下就坏
    for (const t of E.gr?.traps || []) if (t.region === E.s.region && t.uses > 0 && Math.hypot(t.x - e.x, t.y - e.y) < T2.r) t.uses = 0;
  },
  // 塌下来：三道浪
  wave(E, e) {
    const W = M.wave,
      p = E.s.player,
      gy = clamp(p.y + (rnd() - 0.5) * 2 * W.near, 120, WORLD.h - 120),
      warn = E.tWarn(e, W.warn, true);
    E.tx.waves.push({ x: WORLD.w + W.w, w: W.w, speed: W.speed * E.tRage(e).speed, gy0: gy - W.gap / 2, gy1: gy + W.gap / 2, wait: warn, max: warn, hit: false, src: e.id });
    E.tEmit(e, "tWave", { range: 2400, duck: true, voice: true });
  },
  waves(E, e, dt) {
    const L = E.tx.waves;
    if (!L.length) return;
    const W = M.wave,
      p = E.s.player;
    for (const w of L) {
      if (w.wait > 0) {
        w.wait -= dt;
        continue;
      }
      const x0 = w.x;
      w.x -= w.speed * dt;
      // 扫过你：不在口子里就被卷走
      if (!w.hit && p.x <= x0 + w.w / 2 && p.x >= w.x - w.w / 2 && !(p.y >= w.gy0 && p.y <= w.gy1)) {
        if (E.tLand({ dmg: W.dmg, push: W.push, pushA: Math.PI }, e, { k: "rect", x: w.x - w.w / 2, y: 0, w: w.w, h: WORLD.h })) w.hit = true;
      }
    }
    E.tx.waves = L.filter((w) => w.x > -w.w);
  },
  // 心：身边一圈烫，跳一下荡开一圈火；剩两成五就往篝火爬
  heart(E, e, dt) {
    const p = E.s.player,
      d = dist(e, p),
      H = M.heart;
    if (d < H.aura && E.invulnerable <= 0 && !E.paused) {
      E.envHurt(H.dps * dt, e.type);
      e.auraNote = (e.auraNote || 0) - dt;
      if (e.auraNote <= 0) {
        e.auraNote = 1;
        E.effects.push({ x: p.x, y: p.y - 70, text: "烫！", t: 0.6, color: "#ff9a5a" });
      }
    }
    if (!e.cd.beat) {
      const B = H.beat,
        warn = E.tWarn(e, B.warn);
      E.tStrike(e, { k: "ring", x: e.x, y: e.y, r0: B.r0, r1: B.r1 }, warn, { dmg: B.dmg, push: 50 }, { cue: "tThud" });
      E.tCool(e, "beat", B.every);
    }
    // 塌下来的那一堆还在动：隔一阵又卷过来一道浪、扔过来几只
    if (!e.cd.wave) {
      if (e.cd.wave === 0 && e.wavedOnce) AI.moth.wave(E, e);
      e.wavedOnce = true;
      E.tCool(e, "wave", H.wave);
    }
    if (!e.cd.fling && d > M.fling.min && d < M.fling.max + 300) {
      AI.moth.fling(E, e, 60);
      E.tCool(e, "fling", H.fling);
    }
    if (e.tp < 2) return;
    // 往篝火爬：推开、捕兽夹、钉板都能拖慢
    const fire = fireOf(E),
      C = M.crawl;
    if (e.trapHeld > 0) {
      e.trapHeld = 0;
      AI.moth.slow(E, e, "被夹住了！");
    }
    for (const t of E.gr?.traps || []) {
      if (t.region !== E.s.region || t.uses <= 0 || t.tMoth || Math.hypot(t.x - e.x, t.y - e.y) > e.r * 0.6 + 22) continue;
      t.tMoth = true;
      t.uses = Math.max(0, t.uses - 1);
      AI.moth.slow(E, e, "踩上陷阱了！");
    }
    e.crawlSlow = Math.max(0, (e.crawlSlow || 0) - dt);
    const v = C.speed * E.tRage(e).speed * (e.crawlSlow > 0 ? 0.25 : e.slowT > 0 ? 0.5 : 1),
      df = dist(e, fire),
      a = aim(e, fire);
    e.facing = a;
    const step = Math.min(df, v * dt);
    e.x += Math.cos(a) * step;
    e.y += Math.sin(a) * step;
    if (df - step <= C.reach) {
      if (E.finalLive?.()) E.finalEnd("lost");
      else {
        // 凶台里：扑到了就算没守住（这一场结束）
        E.tx.fallen = "moth";
        e.hp = Math.max(1, e.hp);
      }
    }
  },
  slow(E, e, text) {
    e.crawlSlow = Math.max(e.crawlSlow || 0, M.crawl.slow);
    E.tSay(e, text, "#ffdb8c");
  },
  shoved(E, z) {
    if (z.part === "body" && z.heart && z.tp >= 2) {
      AI.moth.slow(E, z, "推开了！");
      const a = aim(E.s.player, z);
      z.x += Math.cos(a) * 24;
      z.y += Math.sin(a) * 24;
    }
  },
  onKill(E, e) {
    if (e.part !== "light") return false;
    const b = mothBody(E);
    if (!b || b.dead) return false;
    const left = mothLights(E).filter((z) => z !== e).length;
    if (left) E.toast("扑火身上的光灭了一盏（还剩 " + left + " 盏）。", "warn");
    E.tx.fx.push({ kind: "burst", x: e.x, y: e.y, t: 0.8, max: 0.8, fire: true });
    return true;
  },
  tag(E, e) {
    const b = mothBody(E),
      n = mothLights(E).length;
    if (!b) return "";
    if (b.act?.k === "collapse") return "塌下来了 · 往口子里跑";
    if (n) return "身上还亮着 " + n + " 盏光 · 身子打不动";
    return b.tp >= 2 ? "往篝火爬 · 拦住它" : "心露出来了";
  },
  note(E, e, intel) {
    const b = mothBody(E);
    if (b?.act?.k === "collapse") return "浪从东边卷过来：站进那条亮着的口子里";
    if (b?.tp >= 2) return "推开、捕兽夹、钉板都能拖慢它";
    return intel ? "先打四盏光；浪来往口子里跑；拦住那颗心，别让它扑到篝火" : "";
  },
};
PHASE_HOOK.moth = (E, e, tp) => {
  const b = mothBody(E);
  if (!b) return;
  if (tp >= 1 && !b.heart && b.act?.k !== "collapse") {
    b.act = { k: "collapse", t: 0.8 + M.wave.every * M.wave.n, n: M.wave.n, next: 0.8 };
    b.hidden = true;
    E.tx.fx.push({ kind: "collapse", x: b.x, y: b.y, t: 1.6, max: 1.6 });
    E.toast(FINAL_TEXT.lights, "warn");
  }
  if (tp >= 2) E.toast(FINAL_TEXT.crawl, "warn");
};
// 光在的时候：身子只打得进一成；光是一团亮着的东西，箭和子弹打上去碎得快
HURT_HOOK.moth = (E, e, n, h) => {
  if (e.part === "light") return (h.kind === "ranged" ? M.lightRanged : 1) * (e.dim ? M.pulse.dim : 1);
  if (e.part !== "body" || !mothLights(E).length) return 1;
  if ((e.tNoteT || 0) <= 0) {
    e.tNoteT = 1.2;
    E.tSay(e, "先打它身上的光", "#cfc6a8");
  }
  return M.shield;
};

