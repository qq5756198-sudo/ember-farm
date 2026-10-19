// v0.36.0「巨影」凶台：用正式代码（不改规则，只给按键）打十凶，看第一次打能不能赢、要多久、挨的最重一下多重。
// 两种打法：
//   right  知道打法的人：每一凶用它的那一招（河伯：站干地、等它冒出来滚开、搁浅时上去打；
//          收破烂的：蹲着走、往墙边扔石头让它撞墙、晕了上去打、背后下手、锅响时蹲着不动；
//          〇号：长了壳就换家伙（钝器、利器、长柄、燃烧瓶）、孢囊冒头就打破、两半一起收；
//          黑瞎子：雾里亮箭头往旁边让、燃烧瓶、捕兽夹；白毛风：守着烧着的铁桶、燃烧瓶、钝器敲冰、桶灭了添木材）
//   naive  不知道打法的人：地上亮了就躲、够得着就打，一把长矛打到底
// 两种都一样会看预兆（看到要 0.12–0.5 秒，SKILL 的机会看到，默认 0.85）、血少了缠绷带、没绷带又血少就跑（算逃回）。
// 用法：node scripts/titan-sim.mjs 次数 凶[,凶] 打法[,打法] 装备[,装备]
//   凶：hebo scrap zero bear frost；打法：right naive；装备：mid（这凶开出来时手上有的）late（后期）
// 环境变量：SKILL=0.85 看到预兆的机会；LIMIT=600 一场最长几秒；TRACE=1 打出每一场；TPATCH 换掉某一凶的数（见下）
const D = new URL("../dist/", import.meta.url).href;
const { Engine, freshState } = await import(D + "campaign.js");
const { RULES } = await import(D + "gear-data.js");
const { TITANS, TRULES, POD_TYPE } = await import(D + "titan-data.js");
const N = Number(process.argv[2] || 20);
const WHO = (process.argv[3] || "hebo,scrap,zero,bear,frost").split(",");
const STYLES = (process.argv[4] || "right,naive").split(",");
const KITS = (process.argv[5] || "mid").split(",");
const SKILL = Number(process.env.SKILL || 0.85);
const LIMIT = Number(process.env.LIMIT || 600);
const TRACE = !!process.env.TRACE;
// 调数用：TPATCH='{"bear":{"wake":200,"swipe":{"dmg":20}}}' 换掉某一凶的数（嵌套的只换写到的那几个）
if (process.env.TPATCH) {
  const merge = (o, p) => {
    for (const [k, v] of Object.entries(p)) {
      if (v && typeof v === "object" && !Array.isArray(v) && o[k] && typeof o[k] === "object" && !Array.isArray(o[k])) merge(o[k], v);
      else o[k] = v;
    }
  };
  for (const [id, p] of Object.entries(JSON.parse(process.env.TPATCH))) merge(TITANS[id], p);
}
const DT = 0.05;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const SETS = {
  mid: { head: "motoHelmet", body: "tireArmor", hands: "leatherBracers", legs: "kneePads", feet: "workBoots" },
  late: { head: "riotHelmet", body: "riotSuit", hands: "steelBracers", legs: "motoGreaves", feet: "workBoots" },
};
// 每一凶开出来的日子；right 带的东西
const DAY = { hebo: 14, scrap: 17, zero: 20, bear: 22, frost: 34 };
const PACK = {
  hebo: { melee: ["ironspear"] },
  scrap: { melee: ["ironspear"], stone: 12 },
  zero: { melee: ["ironspear", "bat", "machete"], molotov: 2 },
  bear: { melee: ["ironspear"], molotov: 3, bearTrap: 1 },
  frost: { melee: { mid: ["bat"], late: ["sledge"] }, molotov: 3, wood: 4 },
};
function seeded(seed) {
  let s = seed % 2147483647 || 1;
  return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
}
// 人在不在这一块里、往哪走出去最近、要走多远
function exitOf(sh, p, pad = 16) {
  switch (sh.k) {
    case "circle": {
      const d = Math.hypot(p.x - sh.x, p.y - sh.y);
      if (d > sh.r + pad) return null;
      const a = d < 1 ? Math.random() * Math.PI * 2 : Math.atan2(p.y - sh.y, p.x - sh.x);
      return { a, d: sh.r + pad - d + 6 };
    }
    case "cone": {
      const d = Math.hypot(p.x - sh.x, p.y - sh.y),
        pa = Math.atan2(p.y - sh.y, p.x - sh.x),
        off = angDiff(pa, sh.a);
      if (d > sh.r + pad || (d >= 24 && off > sh.arc + Math.atan2(pad, Math.max(1, d)))) return null;
      // 往后退出圆弧，或者从最近的那条边横着出去（沿那条边的外法线走）
      const back = { a: pa, d: sh.r + pad - d + 6 },
        side = Math.sin(pa - sh.a) >= 0 ? 1 : -1,
        sideD = d * Math.sin(Math.max(0, sh.arc - off)) + pad + 6;
      return sideD < back.d ? { a: sh.a + side * (sh.arc + Math.PI / 2), d: sideD } : back;
    }
    case "line": {
      const ux = Math.cos(sh.a),
        uy = Math.sin(sh.a),
        dx = p.x - sh.x,
        dy = p.y - sh.y,
        t = dx * ux + dy * uy,
        n = -dx * uy + dy * ux;
      if (t < -pad || t > sh.len + pad || Math.abs(n) > sh.w / 2 + pad) return null;
      const side = n >= 0 ? 1 : -1;
      return { a: sh.a + side * (Math.PI / 2), d: sh.w / 2 + pad - Math.abs(n) + 6 };
    }
    case "rect": {
      if (p.x < sh.x - pad || p.x > sh.x + sh.w + pad || p.y < sh.y - pad || p.y > sh.y + sh.h + pad) return null;
      const opts = [
        { a: Math.PI, d: p.x - sh.x + pad },
        { a: 0, d: sh.x + sh.w - p.x + pad },
        { a: -Math.PI / 2, d: p.y - sh.y + pad },
        { a: Math.PI / 2, d: sh.y + sh.h - p.y + pad },
      ];
      return opts.sort((a, b) => a.d - b.d)[0];
    }
    default:
      return null;
  }
}

function trial(id, style, kitId, seed) {
  Math.random = seeded(seed * 7919 + 13);
  const R = seeded(seed * 104729 + 7);
  const T = TITANS[id],
    right = style === "right",
    pack = right ? PACK[id] : { melee: ["ironspear"] },
    meleeList = Array.isArray(pack.melee) ? pack.melee : pack.melee[kitId] || pack.melee.mid;
  const st = freshState();
  st.undertow.seed = 1000 + seed;
  st.day = DAY[id];
  st.minute = id === "hebo" ? 21 * 60 : 600;
  st.weather = "晴朗";
  const e = new Engine(st, () => {});
  let died = false;
  const emit = e.emit.bind(e);
  e.emit = (name, data) => {
    if (name === "menu" && data?.menu === "death") died = true;
    return emit(name, data);
  };
  const s = e.s,
    g = e.gr,
    p = s.player;
  e._tForce = id;
  // 城区的图记在 districts 里，城外的（松林、冻土）记在 beyond 里
  if (["pinewood", "frost"].includes(T.region)) e.b.unlocked[T.region] = true;
  else e.d.unlocked[T.region] = true;
  for (const k of ["head", "body", "hands", "legs", "feet", "melee", "ranged", "throw", "trap"]) if (k in g.slots) g.slots[k] = null;
  delete s.inventory.club;
  delete s.inventory.ragGloves;
  for (const [slot, gid] of Object.entries(SETS[kitId])) {
    s.inventory[gid] = 1;
    g.slots[slot] = gid;
  }
  for (const w of meleeList) s.inventory[w] = 1;
  g.slots.melee = meleeList[0];
  s.inventory.bandage = kitId === "late" ? 5 : 4;
  if (pack.stone) s.inventory.stone = pack.stone;
  if (pack.molotov) s.inventory.molotov = pack.molotov + (kitId === "late" ? 1 : 0);
  if (pack.bearTrap) s.inventory.bearTrap = pack.bearTrap;
  if (pack.wood) s.inventory.wood = pack.wood;
  g.slots.throw = pack.molotov ? "molotov" : pack.stone ? "stone" : null;
  if (pack.bearTrap) g.slots.trap = "bearTrap";
  s.slot = 3;
  s.region = T.region;
  s.enemies[T.region] = null;
  e.assignRegion();
  e.paused = false;
  // 它进图时才生出来：先走一帧
  Object.assign(p, e.freePoint(80, 500), { hp: 100 });
  e.update(DT, { x: 0, y: 0 });
  // 场上只留这一凶
  const isT = (z) => z.titan === id || z.type === POD_TYPE;
  e.enemies = s.enemies[T.region] = e.enemies.filter(isT);
  const lair = { x: T.lair.x, y: T.lair.y };
  const wet = (q) => e.tx.zones.some((Z) => Z.kind === "water" && e.tZoneHas(Z, q));
  // 站在离窝 330 的空地上（河伯：干地）
  let start = null;
  for (let k = 0; k < 36 && !start; k++) {
    const a = (k / 36) * Math.PI * 2 + 0.3,
      q = { x: Math.round(lair.x + Math.cos(a) * 330), y: Math.round(lair.y + Math.sin(a) * 330) };
    if (q.x < 80 || q.x > 1456 || q.y < 90 || q.y > 930) continue;
    if (!e.blocked(q.x, q.y, false, 14) && e.lineClear(lair, q) && !wet(q)) start = q;
  }
  Object.assign(p, start || e.freePoint(lair.x + 330, lair.y), { hp: 100, stamina: 100, hunger: 90 });
  const exit = e.freePoint(p.x + (p.x - lair.x) * 1.8, p.y + (p.y - lair.y) * 1.8);
  let t = 0,
    path = [],
    pathTimer = 0,
    fleeing = false,
    holdSeen = null,
    mash = 0,
    act = 0,
    fightStart = -1,
    lureT = 0,
    trapT = 0,
    throwT = 0,
    swapT = 0,
    relightT = 0;
  const stat = { low: 1, swings: 0, landed: 0, rolls: 0, bandages: 0, maxHit: 0, hits: 0, strikes: 0, lures: 0, crashes: 0, backstabs: 0, molotovs: 0, traps: 0, swaps: 0, relights: 0, staggers: 0, beached: 0 };
  const seen = new Map();
  // 同一下一起出来的（一把泥、一排冰锥）算一回看见没看见
  const volley = new Map();
  const notice = (S, crowd = 1) => {
    let n = seen.get(S.id);
    if (!n) {
      // 一套连拍算一回（看见第一下就知道后面还有）
      const owner = e.enemies.find((z) => z.id === S.src),
        combo = owner?.act?.k === "swipes" ? (owner.act._cid ??= t) : null,
        key = S.src + ":" + (combo != null ? "c" + combo : Math.round((t - (S.max - S.t)) * 10));
      n = volley.get(key);
      if (!n) {
        n = { at: t, react: 0.12 + R() * 0.38, ok: R() < Math.max(0.35, SKILL - 0.1 * (crowd - 1)) };
        volley.set(key, n);
        stat.strikes++;
      }
      seen.set(S.id, n);
    }
    return n.ok && t - n.at >= n.react;
  };
  const roll = (a) => {
    if (e.dodgeReason()) return false;
    if (p.stamina < e.dodgeCost()) return false;
    const ok = e.dodge({ x: Math.cos(a), y: Math.sin(a) });
    if (ok) stat.rolls++;
    return ok;
  };
  const step = (a, run = false) => ({ x: Math.cos(a), y: Math.sin(a), run: run && p.stamina > 12 });
  const moveTo = (goal, run = false) => {
    pathTimer -= DT;
    if (!path.length || pathTimer <= 0) {
      path = e.pathTo(p, goal);
      pathTimer = 0.6;
    }
    while (path[0] && dist(p, path[0]) < 20) path.shift();
    const nxt = e.lineClear(p, goal) ? goal : path[0] || goal;
    return step(Math.atan2(nxt.y - p.y, nxt.x - p.x), run);
  };
  // 往一个方向走/滚之前看看前面是不是墙、是不是水（河伯）：挡着就转一点
  // 往一个方向走/滚之前看看前面：挡着就转一点；离墙、离图边太近的方向不要（会被逼到角落）
  const openness = (b, max = 200) => {
    for (let r = 20; r <= max; r += 20) {
      const q = { x: p.x + Math.cos(b) * r, y: p.y + Math.sin(b) * r };
      if (e.blocked(q.x, q.y, false, 12) || q.x < 70 || q.x > 1466 || q.y < 80 || q.y > 944) return r - 20;
      if (right && id === "hebo" && wet(q) && !wet(p)) return r - 20;
    }
    return max;
  };
  const freeDir = (a, len = 60) => {
    let best = a,
      bestOpen = -1;
    for (const k of [0, 0.35, -0.35, 0.7, -0.7, 1.05, -1.05, 1.4, -1.4, 1.9, -1.9, 2.4, -2.4]) {
      const b = a + k,
        o = openness(b);
      if (o >= Math.max(len, 120)) return b;
      if (o > bestOpen) {
        bestOpen = o;
        best = b;
      }
    }
    return best;
  };
  const melee = () => e.meleeStats(g.slots.melee);
  const swing = (z) => {
    // 留一口体力滚（倒地、搁浅、晕了这种好机会不算）
    const chance = z.mode === "beached" || ["stun", "panic", "trapped"].includes(z.act?.k) || z.stag > 0;
    // 知道打法的人留一口体力好跑（好机会、它刚出完招的空当不留）；不知道的人一直打（累了打得慢）
    const opening = (z.act?.k === "wait" || z.act?.k === "rest") && !e.tx.strikes.some((S) => S.src === z.id);
    const keep = process.env.RESERVE && right && !chance && !opening && z.titan ? 12 + (melee()?.stamina || 8) : 0;
    if (e.cooldown > 0 || act > 0 || (p.stamina < keep && z.type !== POD_TYPE)) return false;
    s.slot = 3;
    const hp0 = z.hp;
    const ok = e.use({ x: z.x, y: z.y - 20 });
    if (ok) {
      stat.swings++;
      if (z.hp < hp0) stat.landed++;
      if (process.env.HITLOG === "3") console.log("   swing", t.toFixed(2), "d", Math.round(dist(z, p)), "dmg", Math.round(hp0 - z.hp), "mode", z.mode, z.act?.k, "stag", (z.stag || 0).toFixed(1), "inv", (z.inv || 0).toFixed(1));
    }
    return ok;
  };
  const throwAt = (item, q) => {
    if (!(s.inventory[item] > 0) || e.cooldown > 0) return false;
    g.slots.throw = item;
    s.slot = 5;
    const ok = e.use({ x: q.x, y: q.y });
    s.slot = 3;
    return ok;
  };
  const cur = { all: [], W: null, live: [] };
  function attackPlan(z, dz, rch) {
    if (z.hidden || !z.awake) {
      // 睡着：走近把它弄醒；藏起来了：原地等
      if (!z.awake) return moveTo(z);
      return { x: 0, y: 0, run: false };
    }
    if (dz < rch) {
      if (z.inv <= 0) swing(z);
      // 站在够得着的最远处：它贴上来就往后退一点
      if (dz < rch - 25) return step(freeDir(Math.atan2(p.y - z.y, p.x - z.x), 100), false);
      return { x: 0, y: 0, run: false };
    }
    return moveTo(z, dz > 260);
  }
  // ---------- 每一凶的打法 ----------
  const RIGHT = {
    hebo(z, dz, rch) {
      // 还睡在河里：走近把它叫出来（不下水）
      if (!z.awake) return wet(p) ? step(freeDir(Math.atan2(p.y - lair.y, p.x - lair.x)), true) : moveTo(z);
      // 搁浅了：冲上去打
      if (z.mode === "beached" && z.act?.k === "beached") {
        stat.beached += DT;
        // 快站起来了：先退开
        if (z.act.t < 0.45 && dz < 200) return step(freeDir(Math.atan2(p.y - z.y, p.x - z.x)), true);
        if (dz < rch) {
          swing(z);
          return { x: 0, y: 0, run: false };
        }
        return moveTo(z, true);
      }
      // 在泥里：站到干的空地上等它冒出来
      if (z.hidden) {
        if (wet(p)) return step(freeDir(Math.atan2(p.y - lair.y, p.x - lair.x)), true);
        return { x: 0, y: 0, run: false };
      }
      // 晃了：上去打；快晃完了先退开
      if (z.stag > 0.45) return attackPlan(z, dz, rch);
      if (z.stag > 0 && dz < 200) return step(freeDir(Math.atan2(p.y - z.y, p.x - z.x)), true);
      // 站着的时候不去它跟前（它会横扫）：离它两百上下，等它钻泥
      if (dz < 190) return step(freeDir(Math.atan2(p.y - z.y, p.x - z.x)), false);
      if (dz > 300) return moveTo(z, false);
      return { x: 0, y: 0, run: false };
    },
    scrap(z, dz, rch) {
      if (!z.awake) return moveTo(z);
      // 晕了：站起来冲上去打
      if (z.act?.k === "stun") {
        if (dz < rch) {
          if (swing(z)) stat.crashes += 0;
          return { x: 0, y: 0, run: false };
        }
        return moveTo(z, true);
      }
      // 锅要响了：蹲着别动
      if (z.act?.k === "gong" || e.tx.rings.length) return { x: 0, y: 0, run: false };
      // 扔石头到墙边：让它扑过去撞墙
      lureT -= DT;
      if (lureT <= 0 && (s.inventory.stone || 0) > 0 && !z.act && dz > 120) {
        const spot = wallSpot(z);
        if (spot && throwAt("stone", spot)) {
          stat.lures++;
          lureT = 3.5;
          return { x: 0, y: 0, run: false };
        }
        lureT = 0.5;
      }
      // 刚挨了一下、知道你在哪：先退开（它会抡三轮、扑过来）
      if (z.heard && z.heard.age < 1.5 && dist(z.heard, p) < 80 && dz < 190) return step(freeDir(Math.atan2(p.y - z.y, p.x - z.x)), false);
      // 背对着你、没“看见”你：蹲着摸上去从背后打
      const behind = angDiff(Math.atan2(z.y - p.y, z.x - p.x), z.facing ?? 0) < 0.8;
      if (!(z.lock > 0) && behind && dz < rch) {
        if (swing(z)) stat.backstabs++;
        return { x: 0, y: 0, run: false };
      }
      if (!(z.lock > 0)) {
        const back = (z.facing ?? 0) + Math.PI,
          goal = { x: z.x + Math.cos(back) * (rch - 20), y: z.y + Math.sin(back) * (rch - 20) };
        if (dz > rch + 40 || !behind) return moveTo(goal, false);
      }
      // 被它盯上了：离远一点等它扑空
      if (dz < 200) return step(freeDir(Math.atan2(p.y - z.y, p.x - z.x)), false);
      return { x: 0, y: 0, run: false };
    },
    zero(z, dz, rch) {
      // 长了壳就换一把它没壳的
      swapT -= DT;
      const ad = new Set(cur.all.flatMap((q) => q.adapt || []));
      const kind = (w) => e.meleeStats(w)?.kind;
      if (swapT <= 0 && ad.has(kind(g.slots.melee))) {
        const next = meleeList.find((w) => !ad.has(kind(w)));
        if (next) {
          g.slots.melee = next;
          stat.swaps++;
        }
        swapT = 1;
      }
      // 孢囊冒头就打破
      const pod = e.enemies.filter((q) => q.type === POD_TYPE && !q.dead && dist(q, p) < 260).sort((a1, b1) => dist(a1, p) - dist(b1, p))[0];
      if (pod) {
        if (dist(pod, p) < (cur.W?.range || 90) - 8) {
          swing(pod);
          return { x: 0, y: 0, run: false };
        }
        return moveTo(pod, true);
      }
      // 燃烧瓶：它没对火长壳时扔
      throwT -= DT;
      if (throwT <= 0 && (s.inventory.molotov || 0) > 0 && !ad.has("fire") && dz < 240 && dz > 80 && !z.hidden && e.lineClear(p, z)) {
        if (throwAt("molotov", z)) {
          stat.molotovs++;
          throwT = 6;
          return { x: 0, y: 0, run: false };
        }
      }
      // 两半：先打血多的那一半，一起往下收
      if (cur.all.length > 1) {
        const tgt = cur.all.slice().sort((x, y) => y.hp - x.hp)[0],
          dt2 = dist(tgt, p),
          rch2 = (cur.W?.range || 90) + (tgt.r || 30) * 0.85 - 12;
        return attackPlan(tgt, dt2, rch2);
      }
      return attackPlan(z, dz, rch);
    },
    bear(z, dz, rch) {
      if (!z.awake) return moveTo(z);
      // 退进雾里：脚前摆捕兽夹（往它那边）
      trapT -= DT;
      if (z.mode === "fade" && trapT <= 0 && (s.inventory.bearTrap || 0) > 0 && e.cooldown <= 0) {
        s.slot = 6;
        const ok = e.use({ x: p.x + (z.x - p.x) * 0.1, y: p.y + (z.y - p.y) * 0.1 });
        s.slot = 3;
        if (ok) stat.traps++;
        trapT = 8;
      }
      // 近了：燃烧瓶砸它脚下
      throwT -= DT;
      if (throwT <= 0 && (s.inventory.molotov || 0) > 0 && z.mode !== "fade" && !["panic", "stun", "trapped"].includes(z.act?.k) && dz < 220 && e.lineClear(p, z)) {
        if (throwAt("molotov", z)) {
          stat.molotovs++;
          throwT = 7;
          return { x: 0, y: 0, run: false };
        }
      }
      // 吓坏了、被夹住、撞晕了：冲上去打
      if (["panic", "stun", "trapped", "afraid", "rest"].includes(z.act?.k)) return attackPlan(z, dz, rch);
      // 在雾里：原地等它冲（等箭头亮）
      if (z.mode === "fade") return { x: 0, y: 0, run: false };
      return attackPlan(z, dz, rch);
    },
    frost(z, dz, rch) {
      if (!z.awake) return moveTo(z);
      const F = TITANS.frost,
        lit = (e.tx.barrels || []).filter((q) => q.lit),
        dark = (e.tx.barrels || []).filter((q) => !q.lit);
      // 灭了的桶：离得近就添木材点着
      relightT -= DT;
      const near = dark.find((q) => dist(q, p) < 160);
      if (near && (s.inventory.wood || 0) > 0 && relightT <= 0 && (dz > 160 || e.tx.white > 0)) {
        if (dist(near, p) < 60) {
          const o = e.objects.find((q) => q.type === "tBarrel" && q.i === near.i);
          if (o && e.useObject(o)) stat.relights++;
          relightT = 1;
          return { x: 0, y: 0, run: false };
        }
        return moveTo(near, true);
      }
      // 白毛风：守在烧着的桶边
      const home = lit.slice().sort((a1, b1) => dist(a1, p) - dist(b1, p))[0];
      if (e.tx.white > 0 && home && dist(home, p) > F.warm - 30) return moveTo(home, true);
      // 冰甲还在：燃烧瓶
      throwT -= DT;
      if (throwT <= 0 && z.armor > 0 && (s.inventory.molotov || 0) > 0 && dz < 230 && dz > 60 && !z.hidden && e.lineClear(p, z)) {
        if (throwAt("molotov", z)) {
          stat.molotovs++;
          throwT = 5;
          return { x: 0, y: 0, run: false };
        }
      }
      // 冰甲还在：把它引到烧着的桶边（站到桶的另一边）
      if (z.armor > 0 && home && !z.hidden) {
        const bd = dist(z, home);
        if (bd > F.melt - 10) {
          const a = Math.atan2(home.y - z.y, home.x - z.x),
            spot = { x: home.x + Math.cos(a) * 70, y: home.y + Math.sin(a) * 70 };
          if (dist(p, spot) > 30 && !e.blocked(spot.x, spot.y, false, 12)) return moveTo(spot, dist(p, spot) > 120);
        }
      }
      return attackPlan(z, dz, rch);
    },
  };
  // 收破烂的：找一处墙边，扔过去它会扑过去撞上
  function wallSpot(z) {
    let best = null;
    for (let k = 0; k < 16; k++) {
      const a = (k / 16) * Math.PI * 2;
      for (const r of [240, 320, 400]) {
        const q = { x: z.x + Math.cos(a) * r, y: z.y + Math.sin(a) * r },
          beyond = { x: z.x + Math.cos(a) * (r + 70), y: z.y + Math.sin(a) * (r + 70) };
        if (q.x < 80 || q.x > 1456 || q.y < 90 || q.y > 930) continue;
        if (e.blocked(q.x, q.y, false, 14) || !e.blocked(beyond.x, beyond.y, false, 10)) continue;
        if (!e.lineClear(z, q) || dist(p, q) > 250 || !e.lineClear(p, q)) continue;
        // 自己别站在它扑过去的路上
        const ux = Math.cos(a),
          uy = Math.sin(a),
          along = (p.x - z.x) * ux + (p.y - z.y) * uy,
          side = Math.abs(-(p.x - z.x) * uy + (p.y - z.y) * ux);
        if (along > 0 && along < r + 80 && side < 80) continue;
        if (!best || dist(p, q) < dist(p, best)) best = q;
      }
    }
    return best;
  }
  let lastHp = p.hp,
    prevStrikes = [];
  const DEBUG = !!process.env.HITLOG;
  while (t < LIMIT && !died) {
    if (s.region !== T.region) break;
    act = Math.max(0, act - DT);
    const all = e.titansHere(id);
    if (!all.length) break;
    const b = all.slice().sort((x, y) => dist(x, p) - dist(y, p))[0];
    if (fightStart < 0 && b.awake) fightStart = t;
    const gx = e.gx;
    const d = dist(b, p),
      W = melee(),
      reach = (W?.range || 90) + (b.r || 40) * 0.85 - 12;
    cur.all = all;
    cur.W = W;
    stat.low = Math.min(stat.low, all.reduce((a, z) => a + Math.max(0, z.hp), 0) / Math.max(1, e.titanMaxHp(id)));
    // ---------- 缠绷带、跑 ----------
    const strikesIn = e.tx.strikes.filter((S) => (S.hit?.dmg || S.hit?.hold || S.col === "orange") && exitOf(S.shape, p, 16));
    if ((gx.bleed > 0 || p.hp < 50) && !gx.heal && (s.inventory.bandage || 0) > 0 && !e.tx.hold && !(gx.down > 0) && act <= 0 && !strikesIn.length) {
      if (e.consume("bandage")) {
        stat.bandages++;
        act = 0.3;
      }
    }
    if (!fleeing && p.hp < 28 && !(s.inventory.bandage > 0) && !gx.heal) fleeing = true;
    let input = { x: 0, y: 0, run: false };
    let dodging = false;
    if (e.tx.hold) {
      if (holdSeen == null) holdSeen = t + 0.15 + R() * 0.2;
      if (t >= holdSeen) {
        if ((gx.shoveCd || 0) <= 0 && p.stamina >= 10) e.shove();
        else if ((mash -= DT) <= 0) {
          e.interact();
          mash = 0.18;
        }
      }
    } else if (gx.down > 0) {
      holdSeen = null;
    } else if (fleeing) {
      holdSeen = null;
      input = moveTo(exit, true);
      if (dist(p, exit) < 40 || dist(p, lair) > (T.leash || TRULES.leash) + 40) break;
    } else {
      holdSeen = null;
      // ---------- 预兆：在哪一块里、多急 ----------
      // 看到了的、要伤人的预兆（冲撞、扔木头的那条线也算：它随后就到）
      const live = e.tx.strikes.filter((S) => (S.hit?.dmg || S.hit?.hold || S.hit?.sta || S.col === "orange") && notice(S));
      cur.live = live;
      const danger = (q) => {
        let v = 0,
          urg = 9;
        for (const S of live) {
          if (!exitOf(S.shape, q, 20)) continue;
          v += S.hit?.dmg || (S.hit?.hold ? 30 : S.col === "orange" ? 40 : 10);
          urg = Math.min(urg, S.col === "orange" ? S.t + 0.15 : S.t);
        }
        return { v, urg };
      };
      const here = live.length ? danger(p) : { v: 0, urg: 9 };
      let threat = null;
      if (here.v > 0) {
        // 往四周找一块最安全、最近的地方（不进泥、毒雾；河伯：不下水）
        let best = null;
        for (let k = 0; k < 16; k++) {
          const a0 = (k / 16) * Math.PI * 2;
          for (const r of [30, 55, 80, 105, 135, 170]) {
            const q = { x: p.x + Math.cos(a0) * r, y: p.y + Math.sin(a0) * r };
            if (q.x < 70 || q.x > 1466 || q.y < 80 || q.y > 944 || e.blocked(q.x, q.y, false, 12) || !e.lineClear(p, q)) continue;
            const dq = danger(q),
              tw = r / 157,
              mud = e.tx.zones.some((Z) => (Z.kind === "mud" || Z.kind === "gas" || Z.kind === "ice") && Z.w == null && e.tZoneHas(Z, q)) || (e.gx.fires || []).some((f) => f.region === s.region && dist(f, q) < f.r + 14),
              score = dq.v * 100 + r * 0.25 + (mud ? 25 : 0) + (right && id === "hebo" && wet(q) ? 40 : 0) + (tw > here.urg - 0.06 ? 20 + (tw - here.urg) * 60 : 0);
            if (!best || score < best.score) best = { a: a0, r, score, dq, tw };
          }
        }
        threat = best && { a: best.a, d: best.r, tw: best.tw, safe: best.dq.v === 0, urg: here.urg };
      }
      // 正在冲过来的（黑瞎子、收破烂的）、飞过来的木头
      const runner = all.find((z) => (z.act?.k === "charge" || z.act?.k === "rush") && !z.dead);
      let lane = null;
      // 冲过来、飞过来的：和预兆一样，要看到（SKILL 的机会）、要反应一下
      const sees = (o) => {
        if (!o) return false;
        if (o._seen == null) {
          o._seen = t;
          o._react = 0.12 + R() * 0.38;
          o._ok = R() < SKILL;
        }
        return o._ok && t - o._seen >= o._react;
      };
      if (runner && sees(runner.act)) {
        const A = runner.act,
          ux = Math.cos(A.a),
          uy = Math.sin(A.a),
          dx = p.x - runner.x,
          dy = p.y - runner.y,
          along = dx * ux + dy * uy,
          side = -dx * uy + dy * ux,
          wd = (id === "bear" ? TITANS.bear.charge.w : TITANS.scrap.rush.w) / 2 + 24;
        if (along > -20 && along < (A.left || 0) + 30 && Math.abs(side) < wd) lane = { a: A.a + (side >= 0 ? 1 : -1) * (Math.PI / 2), d: wd - Math.abs(side), close: along };
      }
      for (const sh of e.tx.shots) {
        if (!sees(sh)) continue;
        const ux = Math.cos(sh.a),
          uy = Math.sin(sh.a),
          dx = p.x - sh.x,
          dy = p.y - 16 - sh.y,
          along = dx * ux + dy * uy,
          side = -dx * uy + dy * ux,
          wd = sh.w / 2 + 24;
        if (along > -10 && along < sh.left + 20 && Math.abs(side) < wd) lane = { a: sh.a + (side >= 0 ? 1 : -1) * (Math.PI / 2), d: wd - Math.abs(side), close: along };
      }
      const gas = e.tx.zones.find((Z) => Z.kind === "gas" && e.tZoneHas(Z, p));
      const adds = e.enemies.filter((q) => !q.dead && !q.titan && q.type !== POD_TYPE && dist(q, p) < 200).sort((a1, b1) => dist(a1, p) - dist(b1, p));
      // 脚下的泥、冰（不是河）：站在里面躲不快，走出来
      const mire = e.tx.zones.find((Z) => (Z.kind === "mud" || Z.kind === "ice" || (Z.kind === "water" && right && id === "hebo")) && e.tZoneHas(Z, p) && Z.w == null) || (e.gx.fires || []).find((f) => f.region === s.region && dist(f, p) < f.r + 14);
      dodging = !!(lane || threat);
      if (lane) {
        const a = freeDir(lane.a);
        if (lane.close < 140 && lane.d > 30) roll(a) || (input = step(a, true));
        else input = step(a, true);
      } else if (threat) {
        if (process.env.HITLOG === "2") console.log("   threat", t.toFixed(2), "urg", threat.urg.toFixed(2), "go", threat.d, "a", threat.a.toFixed(2), "safe", threat.safe, "p", Math.round(p.x), Math.round(p.y), "sta", Math.round(p.stamina));
        // 走得过去就走（来不及就跑）；都来不及，快到点时滚（滚的头 0.25 秒不挨打）
        const canRoll = p.stamina >= e.dodgeCost() && !e.dodgeReason(),
          runT = threat.d / 228;
        if (threat.safe && threat.tw < threat.urg - 0.06) input = step(threat.a, false);
        else if (threat.safe && runT < threat.urg - 0.06 && p.stamina > 12) input = step(threat.a, true);
        else if (threat.urg <= 0.24 && canRoll) roll(threat.a) || (input = step(threat.a, true));
        else input = step(threat.a, !canRoll);
      } else if (gas) {
        input = step(freeDir(Math.atan2(p.y - gas.y, p.x - gas.x)), true);
      } else if (mire && !(right && id === "hebo" && cur.all[0]?.mode === "beached")) {
        input = step(freeDir(Math.atan2(p.y - mire.y, p.x - mire.x)), false);
      } else if (adds.length && dist(adds[0], p) < 95) {
        // 身边的小感染者（锅响叫来的）：两只以上推开，一只就打
        const z1 = adds[0];
        if (adds.filter((q) => dist(q, p) < 75).length >= 2 && (gx.shoveCd || 0) <= 0 && p.stamina >= RULES.shove.cost + 5) {
          p.facing = Math.atan2(z1.y - p.y, z1.x - p.x);
          e.shove();
        } else if (dist(z1, p) < (W?.range || 90) - 8) swing(z1);
        else input = moveTo(z1);
      } else if (right) {
        input = RIGHT[id]?.(b, d, reach) ?? attackPlan(b, d, reach);
      } else input = attackPlan(b, d, reach);
    }
    // 别自己走进亮着的预兆里（在边上来回进出会挨）
    if (!dodging && (input.x || input.y) && cur.live?.length) {
      const q = { x: p.x + input.x * 14, y: p.y + input.y * 14 };
      if (cur.live.some((S) => exitOf(S.shape, q, 22))) input = { x: 0, y: 0, run: false };
    }
    if (process.env.FLOW && (process.env.FLOW === "all" || Math.round(t * 20) % 10 === 0)) console.log("  flow", t.toFixed(1), "d", Math.round(d), "boss", b.act?.k || "-", b.mode, "heard", b.heard ? Math.round(b.heard.age * 10) / 10 + "@" + Math.round(dist(b.heard, p)) : "-", "lock", (b.lock || 0).toFixed(1), "face", angDiff(Math.atan2(b.y - p.y, b.x - p.x), b.facing ?? 0).toFixed(2), "in", input.x.toFixed(1) + "," + input.y.toFixed(1) + (input.run ? "R" : ""), "crouch", !!e.f?.crouch, "hp", Math.round(p.hp), "sta", Math.round(p.stamina), "bhp", Math.round(b.hp), "armor", Math.round(b.armor || 0), "white", (e.tx.white || 0).toFixed(1), "lit", (e.tx.barrels || []).filter((q) => q.lit).length, "nb", Math.round(Math.min(...(e.tx.barrels || [{ x: 1e4, y: 1e4 }]).map((q) => dist(q, b)))));
    if (right && id === "scrap" && e.f) {
      // 蹲着走：躲招、它晕了要冲上去、跑的时候才站起来
      e.f.crouch = !dodging && !fleeing && !(b.act?.k === "stun") && !input.run && !e.fx?.roll;
    }
    e.update(DT, input);
    t += DT;
    if (p.hp < lastHp - 0.5) {
      stat.maxHit = Math.max(stat.maxHit, lastHp - p.hp);
      stat.hits++;
      if (DEBUG) {
        const gone = prevStrikes.filter((S) => !e.tx.strikes.includes(S));
        const z0 = e.titansHere(id)[0];
        console.log("  hit", t.toFixed(2), "-" + (lastHp - p.hp).toFixed(1), "by", gone.map((S) => S.shape.k + (S.hit?.dmg || "") + "@" + S.max.toFixed(2) + (seen.get(S.id)?.ok ? "" : "(missed)")).join(",") || "?" + (e.fx?.lastHitBy || "") + (z0?.act?.k === "rush" || z0?.act?.k === "charge" ? "-run" : ""), "boss", z0 && z0.act?.k, z0 && Math.round(dist(z0, p)), "hold", !!e.tx.hold, "roll", !!e.fx?.roll, "down", (e.gx.down || 0).toFixed(1));
      }
    }
    prevStrikes = e.tx.strikes.slice();
    lastHp = p.hp;
    for (const v of e.events) if (v.type === "tSfx" && v.sfx === "tThud") stat.staggers += 0;
    e.events.length = 0;
  }
  const left = e.titansHere(id);
  const won = !died && !left.length && !!e.tg.wins[id];
  const out = { won, died, fled: !died && !won && fleeing, timeout: !died && !won && !fleeing, t: fightStart >= 0 ? t - fightStart : t, hp: Math.round(p.hp), bossHp: left.reduce((a, z) => a + Math.max(0, z.hp), 0) / Math.max(1, e.titanMaxHp(id)), tp: left[0]?.tp ?? 3, ...stat, crashes: e.tg.stats.staggers };
  if (TRACE) console.log(id, style, kitId, seed, JSON.stringify(out));
  return out;
}

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0) + "%";
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
for (const id of WHO)
  for (const kitId of KITS)
    for (const style of STYLES) {
      const rs = [];
      const t0 = Date.now();
      for (let i = 0; i < N; i++) rs.push(trial(id, style, kitId, i + 1));
      const wins = rs.filter((r) => r.won),
        times = wins.map((r) => r.t).sort((a, b) => a - b),
        q = (k) => (times.length ? Math.round(times[Math.min(times.length - 1, Math.floor(times.length * k))]) : null);
      console.log(
        id,
        style,
        kitId,
        JSON.stringify({
          n: N,
          won: pct(wins.length, N),
          died: pct(rs.filter((r) => r.died).length, N),
          fled: pct(rs.filter((r) => r.fled).length, N),
          timeout: rs.filter((r) => r.timeout).length,
          winMed: q(0.5),
          winP25: q(0.25),
          winP75: q(0.75),
          bossLow: +mean(rs.filter((r) => !r.won).map((r) => r.low)).toFixed(2),
          landed: +mean(rs.map((r) => r.landed)).toFixed(1),
          phaseReached: +mean(rs.map((r) => r.tp)).toFixed(1),
          maxHit: Math.round(Math.max(0, ...rs.map((r) => r.maxHit))),
          hits: +mean(rs.map((r) => r.hits)).toFixed(1),
          rolls: +mean(rs.map((r) => r.rolls)).toFixed(1),
          bandages: +mean(rs.map((r) => r.bandages)).toFixed(1),
          staggers: +mean(rs.map((r) => r.crashes)).toFixed(1),
          extra: { lures: +mean(rs.map((r) => r.lures)).toFixed(1), backstabs: +mean(rs.map((r) => r.backstabs)).toFixed(1), molotovs: +mean(rs.map((r) => r.molotovs)).toFixed(1), traps: +mean(rs.map((r) => r.traps)).toFixed(1), swaps: +mean(rs.map((r) => r.swaps)).toFixed(1), relights: +mean(rs.map((r) => r.relights)).toFixed(1), beached: +mean(rs.map((r) => r.beached)).toFixed(1) },
          ms: Date.now() - t0,
        }),
      );
    }
