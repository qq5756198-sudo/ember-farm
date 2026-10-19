// v0.36.0「巨影」：前五凶怎么打人。每一凶一组函数，E 是引擎（titan.js），e 是那一凶。
// tick 每帧（醒着、没晃、不在换段时）；idle 睡着时；wakeBy 除了走近还有什么能把它弄醒；
// PHASE_HOOK 换段时；HURT_HOOK 挨打时乘多少（搁浅、背后下手、硬壳、冰甲）；SPAWN_HOOK 生出来时；WAKE_HOOK 醒的那一下。
// 每一下伤人的都用 E.tStrike 先画出来（最短 0.6 秒），到点了还在里面才挨。
import { TITANS, TRULES, POD_TYPE } from "./titan-data.js";
import { WORLD } from "./data.js";

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const aim = (e, p) => Math.atan2(p.y - e.y, p.x - e.x);
const at = (list, i) => (Array.isArray(list) ? list[Math.min(i, list.length - 1)] : list);
const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
const inBounds = (q, m = 70) => ({ x: clamp(q.x, m, WORLD.w - m), y: clamp(q.y, m + 10, WORLD.h - m - 10) });
// 在一个点附近找一块不挡路的空地（找不到就原地）
const open = (E, q) => (E.blocked(q.x, q.y, true, 16) ? E.freePoint(q.x, q.y) : q);
const rnd = () => Math.random();

export const AI = {};
export const PHASE_HOOK = {};
export const HURT_HOOK = {};
export const SPAWN_HOOK = {};
export const WAKE_HOOK = {};

// ================= 第一凶：河伯 =================
// 平时在河里（看不见），醒了浮上来；钻进泥里（看不见、打不着）从你脚下冒出来；冒在干地上搁浅。
const H = TITANS.hebo;
const inWater = (E, q) => E.tx.zones.some((Z) => Z.kind === "water" && (Z.w != null ? inside(q, Z) : dist(q, Z) <= Z.r));
SPAWN_HOOK.hebo = (E, e) => {
  e.hidden = true;
  e.mode = "lair";
  if (!E.tx.zones.some((Z) => Z.data?.of === "hebo" && Z.data?.river)) E.tZone("water", { ...H.river }, Infinity, { slow: H.water.slow, of: "hebo", keep: true, river: true });
};
WAKE_HOOK.hebo = (E, e) => {
  e.hidden = false;
  e.mode = "up";
  e.cd.dive = 2.5;
  e.cd.mud = 1.2;
  E.tx.fx.push({ kind: "splash", x: e.x, y: e.y, t: 0.8, max: 0.8 });
  E.tEmit(e, "tSplash", { range: 1300 });
};
AI.hebo = {
  idle(E, e, dt) {
    e.bubbleT = (e.bubbleT ?? 1) - dt;
    if (e.bubbleT <= 0) {
      e.bubbleT = 1.6 + rnd() * 1.4;
      E.tx.fx.push({ kind: "bubbles", x: e.x + (rnd() - 0.5) * 60, y: e.y + (rnd() - 0.5) * 30, t: 1, max: 1 });
    }
  },
  sleep(E, e) {
    e.hidden = true;
    e.mode = "lair";
  },
  walkHome(E, e, dt, home) {
    // 回窝：钻进泥里游回河里
    e.hidden = true;
    e.mode = "under";
    const a = aim(e, home),
      d = dist(e, home),
      step = Math.min(d, H.dive.waterSpeed * 1.2 * dt);
    e.x += Math.cos(a) * step;
    e.y += Math.sin(a) * step;
  },
  tick(E, e, dt) {
    const p = E.s.player,
      d = dist(e, p),
      tp = e.tp,
      A = e.act;
    // 搁浅时被打晃：晃完就站起来了
    if (e.mode === "beached" && A?.k !== "beached") {
      e.mode = "up";
      e.poiseK = 1;
    }
    // 冒出来以后：在干地上搁浅，水里马上又能钻
    if (A) {
      A.t -= dt;
      if (A.k === "dive") {
        if (A.t <= 0) {
          e.hidden = true;
          e.mode = "under";
          e.act = { k: "under", t: H.dive.travel[0] + rnd() * (H.dive.travel[1] - H.dive.travel[0]), trail: 0 };
          E.tEmit(e, "tSplash", { range: 900 });
        }
        return;
      }
      if (A.k === "under") {
        // 在泥里往你那儿走，后面一串气泡
        const sp = inWater(E, e) ? H.dive.waterSpeed : H.dive.speed,
          a = aim(e, p),
          step = Math.min(Math.max(0, d - 4), sp * E.tRage(e).speed * dt);
        const q = inBounds({ x: e.x + Math.cos(a) * step, y: e.y + Math.sin(a) * step });
        e.x = q.x;
        e.y = q.y;
        A.trail -= dt;
        if (A.trail <= 0) {
          A.trail = 0.22;
          E.tx.fx.push({ kind: "bubbles", x: e.x, y: e.y, t: 0.9, max: 0.9 });
        }
        if (A.t <= 0 || d < 30) {
          // 冒出来之前：你脚下一圈红
          const spot = open(E, inBounds({ x: p.x, y: p.y }));
          e.x = spot.x;
          e.y = spot.y;
          const warn = E.tWarn(e, H.dive.warn, true);
          e.act = { k: "rise", t: warn + 0.05 };
          E.tStrike(e, { k: "circle", x: spot.x, y: spot.y, r: H.dive.r }, warn, { dmg: H.dive.dmg, down: H.dive.down, push: 40 }, { cue: "tBubble", then: (E2, src) => src && AI.hebo.surface(E2, src) });
        }
        return;
      }
      if (A.k === "rise") return;
      if (A.k === "beached") {
        if (A.t <= 0) {
          e.act = null;
          e.mode = "up";
          e.poiseK = 1;
        }
        return;
      }
      if (A.k === "wait" && A.t <= 0) e.act = null;
      if (e.act) return;
    }
    E.tFace(e, dt, 2.4);
    // 第二段起：长手臂抓人拖下水
    if (tp >= 1 && !e.cd.drag && d > H.drag.min && d < H.drag.len - 20 && E.lineClear(e, p)) {
      const a = aim(e, p),
        warn = E.tWarn(e, H.drag.warn, true);
      E.tStrike(e, { k: "line", x: e.x, y: e.y - 10, a, len: H.drag.len, w: H.drag.w }, warn, { dmg: 10, hold: H.drag.hold, dps: H.drag.dps, pull: H.drag.pull }, { cue: "tWhip" });
      e.act = { k: "wait", t: warn + 0.25 };
      E.tCool(e, "drag", H.drag.cd);
      return;
    }
    if (d < H.sweep.near && !e.cd.sweep) {
      const S = H.sweep,
        warn = E.tWarn(e, S.warn),
        a = aim(e, p);
      E.tStrike(e, { k: "cone", x: e.x, y: e.y, a, arc: S.arc, r: S.r }, warn, { dmg: S.dmg, push: S.push }, { cue: "tWhip" });
      // 第三段：横扫连两下
      if (tp >= 2) E.tStrike(e, { k: "cone", x: e.x, y: e.y, a: a + 0.35, arc: S.arc, r: S.r }, warn + S.twice, { dmg: S.dmg, push: S.push });
      e.act = { k: "wait", t: warn + (tp >= 2 ? S.twice : 0) + 0.3 };
      E.tCool(e, "sweep", S.cd);
      return;
    }
    if (!e.cd.mud && d > H.mud.min && d < H.mud.max) {
      const M = H.mud,
        n = at(M.n, tp),
        warn = E.tWarn(e, M.warn);
      for (let i = 0; i < n; i++) {
        const q = i === 0 ? { x: p.x, y: p.y } : { x: p.x + (rnd() - 0.5) * 2 * M.spread, y: p.y + (rnd() - 0.5) * 2 * M.spread };
        E.tStrike(e, { k: "circle", ...inBounds(q), r: M.r }, warn + i * 0.08, { dmg: M.dmg }, { zone: { kind: "mud", r: M.zone.r, t: M.zone.t, slow: M.zone.slow, of: "hebo" } });
      }
      E.tEmit(e, "tSplash", { range: 900 });
      e.act = { k: "wait", t: 0.55 };
      E.tCool(e, "mud", M.cd);
      return;
    }
    if (!e.cd.dive && (d > 170 || tp >= 1)) {
      e.act = { k: "dive", t: H.dive.sink };
      e.mode = "dive";
      E.tCool(e, "dive", at(H.dive.cd, tp));
      return;
    }
    if (d > 70) E.tMove(e, p, E.tSpeed(e), dt);
  },
  // 冒出来：在干地上搁浅，在水里接着能钻
  surface(E, e) {
    if (e.dead) return;
    e.hidden = false;
    E.tx.fx.push({ kind: "splash", x: e.x, y: e.y, t: 0.8, max: 0.8 });
    E.tEmit(e, "tSplash", { range: 1300 });
    if (!E.s.settings?.access?.calm) E.shake = Math.max(E.shake || 0, 4);
    if (inWater(E, e)) {
      e.mode = "up";
      e.act = { k: "wait", t: 0.5 };
      e.cd.dive = Math.min(e.cd.dive || 0, 1.6);
    } else {
      e.mode = "beached";
      e.poiseK = 2;
      e.act = { k: "beached", t: H.dive.beach };
      E.tSay(e, "搁浅了！", "#ffdb8c");
    }
  },
  tag(E, e) {
    return e.mode === "beached" ? "搁浅了 · 快打" : e.hidden ? "钻进泥里了" : "裹着泥 · 打不太动";
  },
  note(E, e, intel) {
    return intel ? "站在干地上等它冒出来，滚开，它搁浅时上去打" : "";
  },
};
PHASE_HOOK.hebo = (E, e, tp) => {
  if (tp === 1) {
    // 涨水：两条水道漫进来
    for (const L of H.lanes) E.tZone("water", { ...L }, Infinity, { slow: H.water.slow, of: "hebo", keep: true, lane: true });
    E.tx.fx.push({ kind: "flood", t: 1.2, max: 1.2, x: e.x, y: e.y });
    E.toast("河水漫上来了：水里走得慢，河伯在水里冒出来不会搁浅。", "warn");
  }
  if (e.hidden) AI.hebo.surface(E, e);
};
// 搁浅：挨打多八成；站着：裹着泥，只打得进一半（打晃时照常）
HURT_HOOK.hebo = (E, e, n, h) => (e.mode === "beached" ? H.dive.beachMul : e.stag > 0 ? 1 : H.upMul);

// ================= 第二凶：收破烂的 =================
// 瞎的：只认声音。听见哪儿响往哪儿扑（撞墙会晕）、扔破烂；身边有东西就抡三轮。
// 第二段敲锅：一圈声波荡开，扫到你时你在动，它就“看见”你 4 秒。
const S = TITANS.scrap;
const heardNoise = (E, e) => {
  const K = S.hear;
  let best = null;
  for (const n of E.noise || []) {
    const d = dist(n, e);
    if (d < n.r * K.k + K.plus && (!best || n.r > best.r)) best = n;
  }
  return best;
};
AI.scrap = {
  wakeBy(E, e) {
    const n = heardNoise(E, e);
    if (n) {
      e.heard = { x: n.x, y: n.y, age: 0 };
      return true;
    }
    return false;
  },
  idle(E, e, dt) {
    e.bellT = (e.bellT ?? 3) - dt;
    if (e.bellT <= 0) {
      e.bellT = 6 + rnd() * 4;
      e.ring = 0.6;
      E.tEmit(e, "tBell", { range: 900 });
    }
    e.ring = Math.max(0, (e.ring || 0) - dt);
  },
  tick(E, e, dt) {
    const p = E.s.player,
      tp = e.tp,
      A = e.act;
    e.ring = Math.max(0, (e.ring || 0) - dt);
    e.lock = Math.max(0, (e.lock || 0) - dt);
    // 撞晕时被打晃：晃完就醒了
    if (e.poiseK !== 1 && A?.k !== "stun") e.poiseK = 1;
    // 听：新的声音
    const n = heardNoise(E, e);
    if (n) e.heard = { x: n.x, y: n.y, age: 0 };
    // 第三段：300 以内连蹲着走都听得见
    if (tp >= 2 && E.walking && dist(e, p) < S.hear.crouchNear) e.heard = { x: p.x, y: p.y, age: 0 };
    if (e.heard) e.heard.age += dt;
    const target = e.lock > 0 ? { x: p.x, y: p.y } : e.heard && e.heard.age < S.hear.memory ? e.heard : null;
    if (A) {
      A.t -= dt;
      if (A.k === "rushWind") {
        if (A.t <= 0) e.act = { k: "rush", t: 9, a: A.a, left: A.len, chain: A.chain, hit: false };
        return;
      }
      if (A.k === "rush") return AI.scrap.rush(E, e, dt, A);
      if (A.k === "stun") {
        if (A.t <= 0) {
          e.act = null;
          e.poiseK = 1;
        }
        return;
      }
      if (A.k === "gong") {
        if (A.t <= 0) {
          e.act = { k: "wait", t: 0.4 };
          AI.scrap.gong(E, e);
        }
        return;
      }
      if (A.t <= 0) e.act = null;
      if (e.act) return;
    }
    // 第二段：敲锅
    if (tp >= 1 && !e.cd.gong) {
      e.act = { k: "gong", t: E.tWarn(e, S.gong.warn, true) };
      E.tCool(e, "gong", S.gong.every);
      E.tStrike(e, { k: "circle", x: e.x, y: e.y, r: 60 }, e.act.t, {}, { col: "yellow", cue: "tGong" });
      return;
    }
    if (!target) {
      // 没听见：在窝附近慢慢转，歪着头听
      e.wanderT = (e.wanderT ?? 0) - dt;
      if (e.wanderT <= 0) {
        e.wanderT = 2.5 + rnd() * 2;
        const a = rnd() * Math.PI * 2;
        e.goal = open(E, inBounds({ x: e.homeX + Math.cos(a) * 120, y: e.homeY + Math.sin(a) * 80 }));
      }
      if (e.goal && dist(e, e.goal) > 20) E.tMove(e, e.goal, E.tSpeed(e) * 0.6, dt);
      AI.scrap.idle(E, e, dt);
      return;
    }
    const d = dist(e, target);
    e.facing = aim(e, target);
    if (d < S.swing.near && !e.cd.swing) {
      const W = S.swing,
        warn = E.tWarn(e, W.warn);
      E.tStrike(e, { k: "circle", x: e.x, y: e.y, r: W.r }, warn, { dmg: W.dmg, push: W.push }, { cue: "tBell" });
      e.ring = warn;
      e.act = { k: "wait", t: warn + 0.35 };
      E.tCool(e, "swing", W.cd);
      return;
    }
    if (d > S.rush.min && d < S.rush.max && !e.cd.rush && E.lineClear(e, target)) return AI.scrap.rushAt(E, e, target, at(S.rush.chain, tp), E.tWarn(e, S.rush.warn, true));
    if (d > S.junk.min && d < S.junk.max && !e.cd.junk) {
      const J = S.junk,
        warn = E.tWarn(e, J.warn);
      E.tStrike(e, { k: "circle", x: target.x, y: target.y, r: J.r }, warn, { dmg: J.dmg }, {});
      E.tx.fx.push({ kind: "junk", x0: e.x, y0: e.y - 120, x: target.x, y: target.y, t: warn, max: warn });
      e.act = { k: "wait", t: 0.6 };
      E.tCool(e, "junk", J.cd);
      return;
    }
    if (d > 40) E.tMove(e, target, E.tSpeed(e), dt);
  },
  rushAt(E, e, target, chain, warn) {
    const R = S.rush,
      a = aim(e, target),
      len = dist(e, target) + R.over;
    E.tStrike(e, { k: "line", x: e.x, y: e.y, a, len, w: R.w }, warn, {}, { col: "orange", cue: "tRush" });
    e.act = { k: "rushWind", t: warn, a, len, chain: chain - 1 };
    e.facing = a;
    E.tCool(e, "rush", R.cd);
  },
  rush(E, e, dt, A) {
    const R = S.rush,
      p = E.s.player,
      step = Math.min(A.left, R.speed * E.tRage(e).speed * dt),
      n = Math.max(1, Math.ceil(step / 8));
    e.facing = A.a;
    for (let i = 0; i < n; i++) {
      const nx = e.x + (Math.cos(A.a) * step) / n,
        ny = e.y + (Math.sin(A.a) * step) / n;
      if (E.blocked(nx, ny, true, 18)) {
        // 撞墙：晕 2.5 秒，挨打 ×1.5
        e.act = { k: "stun", t: R.stun };
        e.poiseK = 1.5;
        E.tSay(e, "撞晕了！", "#ffdb8c");
        E.tEmit(e, "tThud", { range: 1300 });
        E.particlesAt(e.x, e.y - 40, "#a7a198", 14);
        if (!E.s.settings?.access?.calm) E.shake = Math.max(E.shake || 0, 5);
        return;
      }
      e.x = nx;
      e.y = ny;
      A.left -= step / n;
      // 撞上：和地上画的那条一样宽
      if (!A.hit && dist(e, p) < R.w / 2 + 18 && E.invulnerable <= 0) {
        A.hit = true;
        E.tLand({ dmg: R.dmg, down: R.down, push: 60 }, e, { k: "circle", x: e.x, y: e.y, r: e.r });
      }
    }
    if (A.left <= 0) {
      e.act = null;
      // 第三段：扑完马上再扑
      if (A.chain > 0) {
        const t = e.lock > 0 ? { x: p.x, y: p.y } : e.heard || { x: p.x, y: p.y };
        if (dist(e, t) > 60) AI.scrap.rushAt(E, e, t, A.chain, E.tWarn(e, R.chainWarn, true));
      }
    }
  },
  gong(E, e) {
    const G = S.gong;
    E.tx.rings.push({ x: e.x, y: e.y, r: 0, speed: G.speed, max: G.max, src: e.id, titan: "scrap", kind: "gong", passed: false });
    E.tEmit(e, "tGong", { range: 1600, duck: true });
    // 叫人：门洞里出来几只
    const doors = [...S.doors].sort((a, b) => dist(a, E.s.player) - dist(b, E.s.player)),
      alive = E.enemies.filter((z) => z.tAdd && !z.dead).length;
    let made = 0;
    for (let i = 0; i < Math.min(G.adds, G.cap - alive) && i < doors.length; i++) {
      const q = open(E, doors[(i + 1) % doors.length]),
        z = E.enemy("slow", q.x, q.y);
      Object.assign(z, { state: "chase", alert: 8, targetX: E.s.player.x, targetY: E.s.player.y, tAdd: true });
      E.enemies.push(z);
      made++;
    }
    if (made) E.toast("锅一响，巷子里又出来了 " + made + " 只。", "warn");
  },
  ringPass(E, ring) {
    const e = E.enemies.find((z) => z.id === ring.src);
    if (!e || e.dead) return;
    // 扫到你时你在走、在跑：它“看见”你了；蹲着不动它不知道
    if (E.walking || !E.f?.crouch) {
      e.lock = S.gong.lock;
      E.tSay(e, "听见你了！", "#ff8a6a");
    }
  },
  tag(E, e) {
    return e.act?.k === "stun" ? "撞晕了 · 快打" : e.lock > 0 ? "听见你了" : e.act?.k === "gong" ? "要敲锅了" : "";
  },
  note(E, e, intel) {
    return intel ? "蹲着走它听不见；往墙边扔石头，它撞墙晕了上去打" : "";
  },
};
PHASE_HOOK.scrap = (E, e, tp) => {
  e.cd.gong = tp === 1 ? 2 : e.cd.gong || 0;
};
HURT_HOOK.scrap = (E, e, n, h) => {
  const p = E.s.player;
  let k = 1;
  // 背后下手：没被它“看见”、你蹲着、从背后打
  if (e.act?.k === "stun") k *= S.rush.stunMul;
  else if (!(e.lock > 0) && E.f?.crouch && angDiff(h.angle, e.facing ?? 0) < S.back.arc / 2 && (h.kind === "blade" || h.kind === "blunt" || h.kind === "pole")) {
    k *= E._hit?.id === "knife" ? S.back.knife : S.back.mul;
    E.tSay(e, "背后下手！", "#ffdb8c");
  } else if (!(e.stag > 0)) {
    // 别的时候：三轮护在身前，只打得进几成（撞晕了、背后下手、打晃了才打得进）
    k *= S.front;
    if ((e.tNoteT || 0) <= 0) {
      e.tNoteT = 1.2;
      E.tSay(e, "三轮挡着", "#cfc6a8");
    }
  }
  // 挨了一下，它就知道你在哪
  e.heard = { x: p.x, y: p.y, age: 0 };
  return k;
};

// ================= 第三凶：〇号 =================
// 挨什么打多了就对什么长硬壳；种孢囊；三条输液管抽人；扑过来；一半血分成两半，两半要一起收。
const Z0 = TITANS.zero;
const KINDS = ["blunt", "blade", "pole", "ranged", "fire", "other"];
const kindOf = (k) => (k === "throw" || k === "trap" || k === "dot" ? "other" : KINDS.includes(k) ? k : "other");
export const ADAPT_NAMES = { blunt: "钝器", blade: "利器", pole: "长柄", ranged: "远程", fire: "火", other: "石头、陷阱" };
SPAWN_HOOK.zero = (E, e) => {
  e.adapt = [];
  e.adaptN = 0;
  e.dealtA = {};
};
AI.zero = {
  tick(E, e, dt) {
    const p = E.s.player,
      d = dist(e, p),
      tp = e.tp,
      A = e.act,
      half = !!e.half;
    AI.zero.adaptCheck(E, e);
    // 另一半刚倒下：数秒，到点它就爬回来
    if (e.merge > 0) {
      e.merge -= dt;
      if (e.merge <= 0) AI.zero.revive(E, e);
    }
    // 孢囊（两半时只让一半来种，间隔长一倍）
    if (!half || e.half === "a") {
      e.podT = (e.podT ?? 4) - dt;
      if (e.podT <= 0) {
        e.podT = Z0.pods.every * (half ? 2 : 1) * E.tRage(e).cd;
        AI.zero.pods(E, e);
      }
    }
    if (A) {
      A.t -= dt;
      if (A.k === "pounce") {
        // 蹲一下再跳过去：跳在半空打不着
        if (A.t < A.fly && !A.up) {
          A.up = true;
          e.hidden = true;
        }
        if (A.up) {
          const k = clamp(1 - A.t / A.fly, 0, 1);
          e.x = A.x0 + (A.x - A.x0) * k;
          e.y = A.y0 + (A.y - A.y0) * k;
        }
        if (A.t <= 0) {
          e.hidden = false;
          e.x = A.x;
          e.y = A.y;
          e.act = { k: "wait", t: 0.45 };
          E.tEmit(e, "tThud", { range: 1100 });
        }
        return;
      }
      if (A.t <= 0) e.act = null;
      if (e.act) return;
    }
    E.tFace(e, dt, 3.2);
    if (d < Z0.claw.near && !e.cd.claw) {
      const C = Z0.claw,
        warn = E.tWarn(e, C.warn);
      E.tStrike(e, { k: "cone", x: e.x, y: e.y, a: aim(e, p), arc: C.arc, r: C.r * (half ? 0.85 : 1) }, warn, { dmg: C.dmg }, {});
      e.act = { k: "wait", t: warn + 0.2 };
      E.tCool(e, "claw", C.cd);
      return;
    }
    if (!e.cd.lash && d < Z0.lash.len + 20 && d > 70) {
      const L = Z0.lash,
        warn = E.tWarn(e, L.warn, true),
        a = aim(e, p),
        n = half ? 1 : 3;
      for (let i = 0; i < n; i++) E.tStrike(e, { k: "line", x: e.x, y: e.y - 30, a: a + (i - (n - 1) / 2) * L.spread, len: L.len, w: L.w }, warn, { dmg: L.dmg }, { cue: i === 0 ? "tWhip" : null });
      e.act = { k: "wait", t: warn + 0.25 };
      E.tCool(e, "lash", L.cd * (half ? 1.2 : 1));
      return;
    }
    if (!e.cd.pounce && d > Z0.pounce.min && d < Z0.pounce.max) {
      const P = Z0.pounce,
        warn = E.tWarn(e, P.warn, true),
        q = open(E, inBounds({ x: p.x, y: p.y }));
      E.tStrike(e, { k: "circle", x: q.x, y: q.y, r: P.r * (half ? 0.85 : 1) }, warn, { dmg: P.dmg, down: P.down }, {});
      e.act = { k: "pounce", t: warn, fly: Math.min(0.5, warn * 0.5), x0: e.x, y0: e.y, x: q.x, y: q.y };
      E.tCool(e, "pounce", P.cd);
      return;
    }
    if (d > 60) E.tMove(e, p, E.tSpeed(e), dt);
  },
  pods(E, e) {
    const P = Z0.pods,
      p = E.s.player;
    for (let i = 0; i < P.n; i++) {
      const a = rnd() * Math.PI * 2,
        r = P.dist[0] + rnd() * (P.dist[1] - P.dist[0]),
        q = open(E, inBounds({ x: p.x + Math.cos(a) * r, y: p.y + Math.sin(a) * r }));
      const z = E.enemy(POD_TYPE, q.x, q.y);
      Object.assign(z, { hp: P.hp, maxHp: P.hp, fuse: P.fuse, fuseMax: P.fuse, of: "zero", state: "patrol", facing: 0 });
      E.enemies.push(z);
    }
    E.tEmit(e, "tPop", { range: 900 });
  },
  // 长硬壳：掉到线以下，对这一段挨得最多的那一类长壳（两半一起）
  adaptCheck(E, e) {
    const all = E.titansHere("zero"),
      hp = all.reduce((a, z) => a + Math.max(0, z.hp), 0),
      f = hp / Math.max(1, E.titanMaxHp("zero")),
      done = Math.max(...all.map((z) => z.adaptN || 0)),
      due = Z0.adapt.at.filter((x) => f <= x).length;
    if (due <= done) return;
    const tally = {};
    for (const z of all) for (const [k, v] of Object.entries(z.dealt || {})) tally[kindOf(k)] = (tally[kindOf(k)] || 0) + v;
    const pick = Object.entries(tally).sort((a, b) => b[1] - a[1])[0]?.[0];
    // 一次只长一层壳：长了新的，旧的那层就掉了（换着家伙打，总有一样打得进）
    const before = all[0]?.adapt?.[0] || null;
    for (const z of all) {
      z.adaptN = due;
      z.dealt = {};
      if (pick) z.adapt = [pick];
    }
    if (pick) {
      E.tSay(e, "对" + ADAPT_NAMES[pick] + "长了硬壳！", "#ff8a6a");
      E.toast("〇号对" + ADAPT_NAMES[pick] + "长了硬壳" + (before && before !== pick ? "，对" + ADAPT_NAMES[before] + "的那层掉了" : "") + "：换一样家伙打。", "warn");
      E.tEmit(e, "tCrack", { range: 1100 });
    }
  },
  // 一半倒下：剩下那一半数 12 秒；还有另一半就不算打赢
  onKill(E, e) {
    const other = E.titansHere("zero").find((z) => z !== e && !z.dead);
    if (!other) return false;
    other.merge = Z0.split.merge;
    other.mergeAt = { x: e.x, y: e.y, half: e.half };
    E.tSay(other, "另一半在往回爬……", "#ff8a6a");
    E.toast("〇号的一半倒下了：另一半 " + Z0.split.merge + " 秒内不打倒，倒下的那一半会爬回来。", "warn");
    return true;
  },
  revive(E, e) {
    const at0 = e.mergeAt || { x: e.x + 60, y: e.y, half: e.half === "a" ? "b" : "a" },
      hp = Math.max(200, Math.round(e.hp * Z0.split.revive));
    const z = AI.zero.makeHalf(E, e, at0.half, open(E, at0), hp);
    z.inv = 1;
    e.merge = 0;
    E.tSay(z, "爬回来了！", "#ff8a6a");
  },
  makeHalf(E, from, half, q, hp) {
    const z = E.enemy(TITANS.zero.type, q.x, q.y);
    Object.assign(z, {
      titan: "zero",
      half,
      hp,
      maxHp: Math.round(E.titanMaxHp("zero") / 2),
      r: Math.round(Z0.r * Z0.split.scale),
      tp: from.tp,
      act: null,
      cd: { lash: 1.5, pounce: 2.5, claw: 0.8 },
      poise: 0,
      poiseMax: from.poiseMax * 0.7,
      poiseT: 0,
      stag: 0,
      inv: 0,
      awake: true,
      homing: false,
      fightT: from.fightT,
      homeX: from.homeX,
      homeY: from.homeY,
      state: "chase",
      facing: from.facing,
      mode: "up",
      dealt: {},
      adapt: [...(from.adapt || [])],
      adaptN: from.adaptN || 0,
      speedK: from.speedK || Z0.split.speed,
      regenUsed: from.regenUsed,
    });
    E.enemies.push(z);
    return z;
  },
  tag(E, e) {
    const all = E.titansHere("zero"),
      ad = [...new Set(all.flatMap((z) => z.adapt || []))];
    return (all.length > 1 ? "分成两半 · " : "") + (ad.length ? "硬壳：" + ad.map((k) => ADAPT_NAMES[k]).join("、") : "");
  },
  note(E, e, intel) {
    const m = E.titansHere("zero").find((z) => z.merge > 0);
    if (m) return "另一半 " + Math.ceil(m.merge) + " 秒后爬回来";
    return intel ? "换着家伙打；孢囊冒头就打破；分成两半以后两边一起收" : "";
  },
};
PHASE_HOOK.zero = (E, e, tp) => {
  if (tp === 1 && !e.half) {
    // 分成两半
    const hp = Math.max(2, e.hp),
      a = Math.round(hp / 2),
      b = Math.max(1, Math.round(hp - a)),
      left = open(E, inBounds({ x: e.x - 70, y: e.y })),
      right = open(E, inBounds({ x: e.x + 70, y: e.y }));
    Object.assign(e, { half: "a", hp: a, maxHp: Math.round(E.titanMaxHp("zero") / 2), r: Math.round(Z0.r * Z0.split.scale), speedK: Z0.split.speed, x: left.x, y: left.y, poiseMax: e.poiseMax * 0.7 });
    AI.zero.makeHalf(E, e, "b", right, b).inv = TRULES.phaseInv;
    E.tx.fx.push({ kind: "split", x: e.x + 70, y: e.y, t: 1, max: 1 });
    E.toast("〇号从中间裂开，分成了两半：两半要一起收拾。", "warn");
  }
  if (tp >= 2) for (const z of E.titansHere("zero")) z.speedK = (z.speedK || 1) * Z0.split.fast;
};
HURT_HOOK.zero = (E, e, n, h) => ((e.adapt || []).includes(kindOf(h.kind)) ? Z0.adapt.k : 1);

// ================= 第四凶：黑瞎子 =================
// 雾里：退进雾里绕一圈，从看不见的地方冲过来（撞上东西会晕）；近了连拍；站起来吼；第二段砸地、扔木头。
// 怕火：地上烧着的地方不往里冲，燃烧瓶砸中吓得缩成一团；踩捕兽夹会被夹住。
const B = TITANS.bear;
const fireNear = (E, q, pad = 0) => (E.gx?.fires || []).find((f) => f.region === E.s.region && dist(f, q) < f.r + pad);
SPAWN_HOOK.bear = (E, e) => {
  e.mode = "lair";
};
WAKE_HOOK.bear = (E, e) => {
  e.mode = "fade";
  e.fadeT = 1.2;
  E.tEmit(e, "tBearRoar", { range: 1600, duck: true });
};
AI.bear = {
  fog(E, e) {
    return { clear: B.fog.clear, lamp: B.fog.lamp };
  },
  tick(E, e, dt) {
    const p = E.s.player,
      d = dist(e, p),
      tp = e.tp,
      A = e.act;
    // 吓坏、夹住、撞晕时被打晃：晃完就好了
    if (e.poiseK !== 1 && !["panic", "trapped", "stun"].includes(A?.k)) e.poiseK = 1;
    // 燃烧瓶砸中：吓得缩成一团
    const f = fireNear(E, e, e.r * 0.6);
    if (f && !f.tScared) {
      f.tScared = true;
      e.act = { k: "panic", t: B.fear.panic, a: aim(p, e) };
      e.poiseK = 1.3;
      E.tSay(e, "吓坏了！", "#ffdb8c");
      E.tEmit(e, "tBearRoar", { range: 1300 });
      E.tClearFrom(e);
      return;
    }
    // 踩上捕兽夹：夹住
    if (e.trapHeld > 0 && A?.k !== "trapped") {
      e.trapHeld = 0;
      e.act = { k: "trapped", t: B.fear.trap };
      e.poiseK = 1.3;
      E.tSay(e, "被夹住了！", "#ffdb8c");
      E.tClearFrom(e);
      return;
    }
    e.trapHeld = 0;
    if (A) {
      A.t -= dt;
      // 吓得缩成一团：原地发抖（这几秒挨打多三成），完了退进雾里
      if (A.k === "panic") {
        if (A.t <= 0) {
          e.act = null;
          e.poiseK = 1;
          e.mode = "fade";
          e.fadeT = 0.5;
        }
        return;
      }
      // 拍完、冲空了：喘一口气（这时候上去打）
      if (A.k === "rest") {
        if (A.t <= 0) {
          e.act = null;
          if (A.fade) {
            e.mode = "fade";
            e.fadeT = B.fade.t[0] + rnd() * (B.fade.t[1] - B.fade.t[0]);
          }
        }
        return;
      }
      if (A.k === "trapped" || A.k === "afraid") {
        if (A.t <= 0) {
          e.act = null;
          e.poiseK = 1;
        }
        return;
      }
      if (A.k === "chargeWind") {
        if (A.t <= 0) e.act = { k: "charge", t: 9, a: A.a, left: A.len, hit: false, chain: A.chain };
        return;
      }
      if (A.k === "charge") return AI.bear.charge(E, e, dt, A);
      if (A.k === "swipes") return AI.bear.swipes(E, e, dt, A);
      if (A.k === "stun") {
        if (A.t <= 0) {
          e.act = null;
          e.poiseK = 1;
        }
        return;
      }
      if (A.t <= 0) e.act = null;
      if (e.act) return;
    }
    // 退进雾里绕一圈
    if (e.mode === "fade") {
      e.fadeT = (e.fadeT ?? 3) - dt;
      const a0 = aim(p, e),
        ring = B.fade.ring,
        side = e.id % 2 ? 1 : -1,
        goal = open(E, inBounds({ x: p.x + Math.cos(a0 + side * 0.6) * ring, y: p.y + Math.sin(a0 + side * 0.6) * ring }));
      E.tMove(e, goal, E.tSpeed(e) * 2.1, dt);
      if (e.fadeT <= 0) {
        e.mode = "close";
        if (!e.cd.charge && d > 260) return AI.bear.chargeAt(E, e, at(B.charge.chain, tp));
      }
      return;
    }
    E.tFace(e, dt, 3);
    if (tp >= 1 && !e.cd.slam && d < B.slam.r * 0.9) {
      const warn = E.tWarn(e, B.slam.warn, true),
        a = aim(e, p),
        c = { x: e.x + Math.cos(a) * 60, y: e.y + Math.sin(a) * 40 };
      E.tStrike(e, { k: "circle", x: c.x, y: c.y, r: B.slam.r }, warn, { dmg: B.slam.dmg, down: B.slam.down }, { cue: "tBearRoar" });
      e.act = { k: "wait", t: warn + 0.5 };
      e.stand = warn;
      E.tCool(e, "slam", B.slam.cd);
      return;
    }
    if (d < B.swipe.near && !e.cd.swipe) {
      e.act = { k: "swipes", t: 99, n: at(B.swipe.n, tp), i: 0, next: 0 };
      E.tCool(e, "swipe", B.swipe.cd);
      return;
    }
    if (!e.cd.roar && d < B.roar.r - 40) {
      const warn = E.tWarn(e, B.roar.warn);
      E.tStrike(e, { k: "circle", x: e.x, y: e.y, r: B.roar.r }, warn, { sta: B.roar.sta, noRun: B.roar.noRun }, { col: "yellow", cue: "tBearRoar" });
      e.act = { k: "wait", t: warn + 0.4 };
      e.stand = warn + 0.3;
      E.tCool(e, "roar", B.roar.cd);
      return;
    }
    if (tp >= 1 && !e.cd.log && d > B.log.min && E.lineClear(e, p)) {
      const L = B.log,
        warn = E.tWarn(e, L.warn),
        a = aim(e, p);
      E.tStrike(e, { k: "line", x: e.x, y: e.y - 20, a, len: L.len, w: L.w }, warn, {}, { col: "orange", then: (E2, src) => src && E2.tShot(src, src.x + Math.cos(a) * 40, src.y - 20 + Math.sin(a) * 40, a, L.speed, L.len, L.w, { dmg: L.dmg, down: 0.6, push: 50 }, "log") });
      e.act = { k: "wait", t: warn + 0.3 };
      e.stand = warn;
      E.tCool(e, "log", L.cd);
      return;
    }
    // 远了：退进雾里，再冲
    if (d > 280 && !e.cd.charge) {
      e.mode = "fade";
      e.fadeT = B.fade.t[0] + rnd() * (B.fade.t[1] - B.fade.t[0]);
      return;
    }
    if (d > 80) E.tMove(e, p, E.tSpeed(e), dt);
  },
  chargeAt(E, e, chain) {
    const C = B.charge,
      p = E.s.player,
      a = aim(e, p),
      len = Math.min(C.len, dist(e, p) + C.over),
      warn = E.tWarn(e, C.warn, true);
    E.tStrike(e, { k: "line", x: e.x, y: e.y, a, len, w: C.w }, warn, {}, { col: "orange", cue: "tCharge" });
    e.act = { k: "chargeWind", t: warn, a, len, chain: chain - 1 };
    e.facing = a;
    E.tCool(e, "charge", at(C.cd, e.tp));
  },
  charge(E, e, dt, A) {
    const C = B.charge,
      p = E.s.player,
      step = Math.min(A.left, C.speed * E.tRage(e).speed * dt),
      n = Math.max(1, Math.ceil(step / 8));
    e.facing = A.a;
    for (let i = 0; i < n; i++) {
      const nx = e.x + (Math.cos(A.a) * step) / n,
        ny = e.y + (Math.sin(A.a) * step) / n;
      // 前面烧着：停在火边愣住
      if (fireNear(E, { x: nx, y: ny }, e.r * 0.5)) {
        e.act = { k: "afraid", t: B.fear.edge };
        E.tSay(e, "怕火，停住了", "#ffdb8c");
        return;
      }
      if (E.blocked(nx, ny, true, 22) || nx < 70 || nx > WORLD.w - 70 || ny < 80 || ny > WORLD.h - 80) {
        e.act = { k: "stun", t: C.stun };
        e.poiseK = 1.4;
        E.tSay(e, "撞晕了！", "#ffdb8c");
        E.tEmit(e, "tThud", { range: 1300 });
        if (!E.s.settings?.access?.calm) E.shake = Math.max(E.shake || 0, 5);
        return;
      }
      e.x = nx;
      e.y = ny;
      A.left -= step / n;
      // 撞上：和地上画的那条一样宽
      if (!A.hit && dist(e, p) < C.w / 2 + 18 && E.invulnerable <= 0) {
        A.hit = true;
        E.tLand({ dmg: C.dmg, down: C.down, push: 70 }, e, { k: "circle", x: e.x, y: e.y, r: e.r });
      }
    }
    if (A.left <= 0) {
      e.act = null;
      if (A.chain > 0) AI.bear.chargeAt(E, e, A.chain);
      // 冲空了：刹住、喘一口气
      else e.act = { k: "rest", t: B.rest.charge, fade: false };
    }
  },
  swipes(E, e, dt, A) {
    const W = B.swipe,
      p = E.s.player;
    A.next -= dt;
    if (A.next > 0) return;
    if (A.i >= A.n) {
      // 拍完喘一口气，一半的时候接着退进雾里
      e.act = { k: "rest", t: B.rest.swipe, fade: rnd() < 0.5 };
      return;
    }
    const last = A.i === A.n - 1,
      a = aim(e, p);
    // 第一下抬爪子慢一点，后面每下也不短于 0.6 秒
    const warn = E.tWarn(e, A.i === 0 ? W.first : W.warn);
    E.tStrike(e, { k: "cone", x: e.x, y: e.y, a, arc: W.arc, r: W.r }, warn, { dmg: W.dmg, down: last ? W.down : 0, push: last ? 60 : 20 }, { cue: A.i === 0 ? "tWhip" : null });
    // 拍的时候往前蹭一点
    E.tMove(e, p, 60, 0.05);
    A.i++;
    A.next = warn + W.gap;
  },
  tag(E, e) {
    const k = e.act?.k;
    return k === "stun" ? "撞晕了 · 快打" : k === "panic" ? "吓坏了 · 快打" : k === "trapped" ? "被夹住了 · 快打" : e.stand > 0 ? "站起来了 · 打肚子" : k === "afraid" ? "怕火" : k === "rest" ? "喘气" : e.mode === "fade" ? "退进雾里了" : "皮厚 · 打不太动";
  },
  note(E, e, intel) {
    return intel ? "听见响动往旁边滚；燃烧瓶、捕兽夹、让它撞树，那几秒才打得动" : "";
  },
};
PHASE_HOOK.bear = (E, e, tp) => {
  e.mode = "fade";
  e.fadeT = 1.5;
};
// 皮糙肉厚：撞晕、吓得缩成一团、被夹住、站起来露出肚子的时候挨打多三成；别的时候只打得进一半
HURT_HOOK.bear = (E, e, n, h) => (["stun", "panic", "trapped"].includes(e.act?.k) || e.stand > 0 || e.stag > 0 ? B.bare : B.hide);

// ================= 第五凶：白毛风 =================
// 一身冰甲：冰没化之前只打得进三成；火烤、钝器敲化得快。冰锥、寒气（吹灭铁桶）、抡风杆、冰面。
// 第二段白毛风：看得清的地方变小、离火远了掉血，它在风雪里不见了，从你身边一团雪里出来抡一杆。
const F = TITANS.frost;
const warmAt = (E, q) => (E.tx.barrels || []).some((b) => b.lit && dist(b, q) < F.warm);
SPAWN_HOOK.frost = (E, e) => {
  e.armor = F.armor.hp;
  e.armorMax = F.armor.hp;
  e.armorDown = 0;
  if (!E.tx.barrels) E.tx.barrels = F.barrels.map((b, i) => ({ ...b, i, lit: true }));
  AI.frost.barrelObjects(E);
};
WAKE_HOOK.frost = (E, e) => {
  e.cd.icicle = 2;
  e.cd.breath = 4;
  e.cd.ice = 6;
  e.whiteT = F.whiteout.every * 0.5;
};
AI.frost = {
  barrelObjects(E) {
    if (!Array.isArray(E.objects)) return;
    for (const b of E.tx.barrels || []) if (!E.objects.some((o) => o.type === "tBarrel" && o.i === b.i)) E.objects.push({ type: "tBarrel", i: b.i, name: "铁桶", icon: 55, x: b.x, y: b.y });
  },
  // 冷：醒着打的时候，离烧着的铁桶远了体力回得慢；白毛风里更慢
  coldRegen(E) {
    const e = E.titansHere?.("frost").find((z) => z.awake);
    if (!e || E.s.region !== F.region) return 1;
    if (warmAt(E, E.s.player)) return 1;
    return E.tx.white > 0 ? F.whiteout.regen * F.cold.regen : F.cold.regen;
  },
  fog(E, e) {
    return E.tx.white > 0 ? { clear: F.whiteout.clear, lamp: F.whiteout.clear + 80, white: true } : null;
  },
  tick(E, e, dt) {
    const p = E.s.player,
      d = dist(e, p),
      tp = e.tp,
      A = e.act;
    AI.frost.barrelObjects(E);
    // 冰甲：碎了以后数秒，再结一层（第三段不再结）
    if (e.armor <= 0 && tp < 2) {
      e.armorDown -= dt;
      if (e.armorDown <= 0) {
        e.armor = F.armor.regrow;
        e.armorMax = Math.max(e.armorMax, F.armor.regrow);
        E.tSay(e, "又结了一层冰", "#bfe3ff");
        E.tEmit(e, "tCrack", { range: 1100 });
      }
    }
    // 火烤化冰：燃烧瓶烧着的、站在烧着的铁桶边上
    if (e.armor > 0) {
      let melt = 0;
      const f = (E.gx?.fires || []).find((x) => x.region === E.s.region && dist(x, e) < x.r + e.r * 0.6);
      if (f) {
        if (!f.tMelt) {
          f.tMelt = true;
          melt += F.armor.molotov;
        }
        melt += 200 * dt;
      }
      if ((E.tx.barrels || []).some((b) => b.lit && dist(b, e) < F.melt)) melt += F.armor.barrel * dt;
      if (melt > 0) AI.frost.armorHit(E, e, melt);
    }
    // 白毛风
    if (tp >= 1) {
      e.whiteT = (e.whiteT ?? F.whiteout.every) - dt;
      if (e.whiteT <= 0 && !(E.tx.white > 0)) {
        e.whiteT = F.whiteout.every;
        E.tx.white = F.whiteout.last;
        E.toast("白毛风来了：守着火！", "warn");
        E.tEmit(e, "tWind", { range: 1800, duck: true, ui: true });
      }
    }
    if (E.tx.white > 0) {
      E.tx.white = Math.max(0, E.tx.white - dt);
      if (!warmAt(E, p)) {
        const warm = E.armorTotals?.().warmth || 0;
        E.envHurt?.(F.whiteout.cold * (warm >= 4 ? 0.5 : 1) * dt, e.type);
      }
    }
    if (A) {
      A.t -= dt;
      if (A.k === "blink") {
        if (A.t <= 0) {
          e.hidden = false;
          e.x = A.x;
          e.y = A.y;
          e.act = { k: "wait", t: 0.4 };
        }
        return;
      }
      if (A.t <= 0) e.act = null;
      if (e.act) return;
    }
    E.tFace(e, dt, 2.6);
    // 白毛风里：不见了，从你身边一团雪里出来抡一杆
    if (E.tx.white > 0 && !e.cd.blink) {
      const Bk = F.whiteout.blink,
        a = rnd() * Math.PI * 2,
        q = open(E, inBounds({ x: p.x + Math.cos(a) * 120, y: p.y + Math.sin(a) * 90 })),
        warn = E.tWarn(e, Bk.warn, true);
      e.hidden = true;
      e.act = { k: "blink", t: warn, x: q.x, y: q.y };
      E.tStrike(e, { k: "cone", x: q.x, y: q.y, a: aim(q, p), arc: Bk.arc, r: Bk.r }, warn, { dmg: Bk.dmg, push: Bk.push }, { cue: "tSweep" });
      E.tx.fx.push({ kind: "swirl", x: q.x, y: q.y, t: warn, max: warn });
      E.tCool(e, "blink", Bk.cd);
      return;
    }
    if (d < F.sweep.near && !e.cd.sweep) {
      const W = F.sweep,
        warn = E.tWarn(e, W.warn);
      E.tStrike(e, { k: "cone", x: e.x, y: e.y, a: aim(e, p), arc: W.arc, r: W.r }, warn, { dmg: W.dmg, push: W.push }, { cue: "tSweep" });
      e.act = { k: "wait", t: warn + 0.8 };
      e.lift = warn;
      E.tCool(e, "sweep", W.cd);
      return;
    }
    if (!e.cd.breath && d < F.breath.r - 20) {
      const Br = F.breath,
        warn = E.tWarn(e, Br.warn, true),
        a = aim(e, p),
        shape = { k: "cone", x: e.x, y: e.y - 10, a, arc: Br.arc, r: Br.r };
      E.tStrike(e, shape, warn, { dmg: Br.dmg, slow: Br.slow, slowT: Br.slowT }, { col: "blue", cue: "tBreath", then: (E2) => AI.frost.douse(E2, shape) });
      e.act = { k: "wait", t: warn + 0.9 };
      E.tCool(e, "breath", Br.cd);
      return;
    }
    if (!e.cd.icicle) {
      const I = F.icicle,
        waves = at(I.waves, tp),
        warn = E.tWarn(e, I.warn, true);
      for (let w = 0; w < waves; w++)
        for (let i = 0; i < I.n; i++) {
          const q = i === 0 ? { x: p.x, y: p.y } : { x: p.x + (rnd() - 0.5) * 2 * I.spread, y: p.y + (rnd() - 0.5) * 2 * I.spread * 0.8 };
          E.tStrike(e, { k: "circle", ...inBounds(q), r: I.r }, warn + w * 0.8 + i * 0.05, { dmg: I.dmg }, { cue: i === 0 && w === 0 ? "tIcicle" : null });
        }
      e.act = { k: "wait", t: 1.2 };
      e.lift = 0.6;
      E.tCool(e, "icicle", I.cd);
      return;
    }
    if (!e.cd.ice) {
      const I = F.ice;
      for (let i = 0; i < I.n; i++) {
        const a = rnd() * Math.PI * 2,
          q = inBounds({ x: p.x + Math.cos(a) * (60 + rnd() * 160), y: p.y + Math.sin(a) * (40 + rnd() * 120) });
        E.tStrike(e, { k: "circle", ...q, r: I.r }, 1.0, {}, { col: "blue", zone: { kind: "ice", r: I.r, t: I.t, of: "frost" } });
      }
      E.tCool(e, "ice", I.cd);
    }
    if (d > 90) E.tMove(e, p, E.tSpeed(e), dt);
  },
  armorHit(E, e, n) {
    if (!(e.armor > 0)) return;
    e.armor = Math.max(0, e.armor - n);
    if (e.armor <= 0) {
      e.armorDown = F.armor.back;
      E.tSay(e, "冰甲碎了！", "#bfe3ff");
      E.tEmit(e, "tShatter", { range: 1300 });
      E.particlesAt(e.x, e.y - 90, "#dff2ff", 22);
    }
  },
  // 寒气吹过的地方：铁桶灭了
  douse(E, shape) {
    let n = 0;
    for (const b of E.tx.barrels || [])
      if (b.lit && E.tInShape(shape, b, 10)) {
        b.lit = false;
        n++;
      }
    if (n) E.toast("寒气把 " + n + " 只铁桶吹灭了：添一块木材重新点着。", "warn");
  },
  armorBar(E, e) {
    return e.armor > 0 ? { hp: e.armor, max: e.armorMax || F.armor.hp } : null;
  },
  tag(E, e) {
    return e.armor > 0 ? "" : e.tp >= 2 ? "冰甲碎了" : "冰甲碎了 · " + Math.ceil(e.armorDown || 0) + " 秒后再结";
  },
  note(E, e, intel) {
    if (E.tx.white > 0) return "白毛风：守在烧着的铁桶边";
    return intel ? "引它到烧着的铁桶边、扔燃烧瓶化冰；白毛风来了守着火" : "";
  },
};
PHASE_HOOK.frost = (E, e, tp) => {
  if (tp === 1) e.whiteT = 3;
  if (tp >= 2) {
    // 第三段：冰甲碎了不再长，快三成五
    if (e.armor > 0) AI.frost.armorHit(E, e, e.armor + 1);
    e.armorDown = 0;
    e.speedK = F.p3.speed;
  }
};
HURT_HOOK.frost = (E, e, n, h) => {
  if (!(e.armor > 0)) return 1;
  // 敲冰：钝器快、火最快，利器长柄只刮得下一层皮
  const k = h.kind === "blunt" ? F.armor.blunt : h.kind === "fire" ? F.armor.fire : F.armor.other;
  AI.frost.armorHit(E, e, n * k);
  return F.armor.mul;
};
