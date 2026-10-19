// v0.36.0「巨影」凶台：用正式代码（不改规则，只给按键）打十凶，看第一次打能不能赢、要多久、挨的最重一下多重。
// v0.37.0「扑火」：加上后五凶（雕爷和看门的、黑潮、风口、末班车、扑火）。有几只的那几凶照样按只打；
//   right：雕爷——弩从链子够不着的地方、绕到侧面先打雕爷，手下近了先收拾；黑潮——它擦焊枪就走出油，第二段等它站进油里扔燃烧瓶；
//          风口——弩在远处先打破四个肺，吸的时候往外跑，风刃转起来跟着绕；末班车——车来就钻过道，停下来打最后一节，通电离开铁轨；
//          扑火——步枪站在看得见光的地方打四盏光（塔、房子挡着子弹就换个地方），子弹打光了上去敲；浪来站进口子，
//          心往篝火爬时摆夹子、推开；农场里有两座塔、三个守卫，仓库里给塔留 240 发。
//   naive：一把长矛打离得最近的那一只，地上亮了就躲。
// 两种打法：
//   right  知道打法的人：每一凶用它的那一招（河伯：站干地、等它冒出来滚开、搁浅时上去打；
//          收破烂的：蹲着走、往墙边扔石头让它撞墙、晕了上去打、背后下手、锅响时蹲着不动；
//          〇号：长了壳就换家伙（钝器、利器、长柄、燃烧瓶）、孢囊冒头就打破、两半一起收；
//          黑瞎子：雾里亮箭头往旁边让、燃烧瓶、捕兽夹；白毛风：守着烧着的铁桶、燃烧瓶、钝器敲冰、桶灭了添木材）
//   naive  不知道打法的人：地上亮了就躲、够得着就打，一把长矛打到底
// 两种都一样会看预兆（看到要 0.12–0.5 秒，SKILL 的机会看到，默认 0.85）、血少了缠绷带、没绷带又血少就跑（算逃回）。
// 用法：node scripts/titan-sim.mjs 次数 凶[,凶] 打法[,打法] 装备[,装备]
//   凶：hebo scrap zero bear frost diao tide vent train moth；打法：right naive；装备：mid（这凶开出来时手上有的）late（后期）
// 环境变量：SKILL=0.85 看到预兆的机会；LIMIT=600 一场最长几秒；TRACE=1 打出每一场；TPATCH 换掉某一凶的数（见下）；SEED0=19 从第 20 号种子打起
const D = new URL("../dist/", import.meta.url).href;
const { Engine, freshState } = await import(D + "campaign.js");
const { RULES } = await import(D + "gear-data.js");
const { TITANS, TRULES, POD_TYPE } = await import(D + "titan-data.js");
const { BUILDINGS } = await import(D + "data.js");
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
const WORLD_W = 1536;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const angDiff = (a, b) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
const SETS = {
  mid: { head: "motoHelmet", body: "tireArmor", hands: "leatherBracers", legs: "kneePads", feet: "workBoots" },
  late: { head: "riotHelmet", body: "riotSuit", hands: "steelBracers", legs: "motoGreaves", feet: "workBoots" },
};
// 每一凶开出来的日子；right 带的东西
const DAY = { hebo: 14, scrap: 17, zero: 20, bear: 22, frost: 34, diao: 48, tide: 30, vent: 40, train: 44, moth: 70 };
const PACK = {
  hebo: { melee: ["ironspear"] },
  scrap: { melee: ["ironspear"], stone: 12 },
  zero: { melee: ["ironspear", "bat", "machete"], molotov: 2 },
  bear: { melee: ["ironspear"], molotov: 3, bearTrap: 1 },
  frost: { melee: { mid: ["bat"], late: ["sledge"] }, molotov: 3, wood: 4 },
  diao: { melee: ["ironspear", "machete"], ranged: "crossbow", bolt: 40, molotov: 2 },
  tide: { melee: { mid: ["ironspear", "machete"], late: ["ironspear", "sledge"] }, molotov: 6 },
  vent: { melee: { mid: ["ironspear", "machete"], late: ["sledge", "ironspear"] }, ranged: "crossbow", bolt: 60 },
  train: { melee: { mid: ["ironspear", "machete"], late: ["ironspear", "sledge"] }, ranged: "crossbow", bolt: 30 },
  moth: { melee: { mid: ["ironspear", "machete"], late: ["ironspear", "sledge"] }, ranged: "rifle", ammo: 160, bearTrap: 2 },
};
// 后五凶的 naive 也带一把远程（不带打法），只是不知道该打哪一只、站哪儿
const NAIVE_PACK = { moth: { melee: ["ironspear"], ranged: "rifle", ammo: 90 } };
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
    case "ring": {
      // 一圈（扑火的心跳）：往里进到内圈里，或者往外出到外圈外
      const d = Math.hypot(p.x - sh.x, p.y - sh.y);
      if (d < sh.r0 - pad || d > sh.r1 + pad) return null;
      const a = Math.atan2(p.y - sh.y, p.x - sh.x),
        outD = sh.r1 + pad - d + 6,
        inD = d - (sh.r0 - pad) + 6;
      return outD < inD ? { a, d: outD } : { a: a + Math.PI, d: inD };
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
    pack = right ? PACK[id] : NAIVE_PACK[id] || { melee: ["ironspear"] },
    meleeList = Array.isArray(pack.melee) ? pack.melee : pack.melee[kitId] || pack.melee.mid;
  const st = freshState();
  st.undertow.seed = 1000 + seed;
  st.day = DAY[id];
  st.minute = id === "hebo" ? 21 * 60 : id === "moth" ? 22 * 60 : 600;
  st.weather = "晴朗";
  const e = new Engine(st, () => {});
  // HITS=1：子弹、箭打在了哪一块上（自己的、塔上的分开记），打完一场打出来
  const hits = process.env.HITS ? {} : null;
  if (hits) {
    const hurt = e.hurtEnemy.bind(e);
    e.hurtEnemy = (z, n, a, meta) => {
      const hp0 = z.hp,
        r = hurt(z, n, a, meta),
        who = meta?.vx != null ? "me" : "other",
        k = who + ":" + (z.part || (z.titan ? "titan" : z.type)) + (z.dim ? "(dim)" : "");
      const h = (hits[k] ||= { n: 0, dmg: 0 });
      h.n++;
      h.dmg += Math.max(0, hp0 - z.hp);
      return r;
    };
  }
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
  // 城区的图记在 districts 里，城外的（松林、冻土、船坞、避难城）记在 beyond 里；隧道第 25 层、农场另说
  if (["pinewood", "frost", "shipyard", "shelter"].includes(T.region)) e.b.unlocked[T.region] = true;
  else if (T.region === "tunnel") {
    Object.assign(e.rl.tunnel, { key: { floor: T.floor, day: st.day, luck: false }, floor: T.floor, deepest: T.floor });
  } else if (T.region !== "farm") e.d.unlocked[T.region] = true;
  // 最后一夜：营火、两座塔、三个守卫（摆在东边）、仓库里给塔留的弹药（提前三天知道，弹药 2 份废金属 12 发）
  if (id === "moth") {
    s.storyCampaign.camp = e.campSite();
    for (const rid of ["farmer", "medic", "mechanic"]) e.recruit(rid);
    e.residentsCapacity = () => 5;
    for (const r of e.c.residents) {
      r.fed = true;
      r.priorities.guard = 1;
    }
    const fire = e.fireSpot();
    for (const [dx, dy] of [[300, -150], [300, 110]]) s.buildings.push({ id: "sim-tower-" + dx + dy, type: "tower", x: fire.x + dx, y: fire.y + dy, rotation: 0, hp: BUILDINGS.tower.hp });
    s.storage.ammo = 240;
    e.navRevision = (e.navRevision || 0) + 1;
    // 这一夜已经打起来了（守卫上塔、钟慢一半、天快亮它就退）
    Object.assign(e.tg.final, { day: st.day, on: st.day });
  }
  for (const k of ["head", "body", "hands", "legs", "feet", "melee", "ranged", "throw", "trap"]) if (k in g.slots) g.slots[k] = null;
  delete s.inventory.club;
  delete s.inventory.ragGloves;
  for (const [slot, gid] of Object.entries(SETS[kitId])) {
    s.inventory[gid] = 1;
    g.slots[slot] = gid;
  }
  for (const w of meleeList) s.inventory[w] = 1;
  g.slots.melee = meleeList[0];
  // 最后一夜在自己家门口打：备得足一点（多两卷绷带）
  s.inventory.bandage = (kitId === "late" ? 5 : 4) + (id === "moth" && right ? 2 : 0);
  if (pack.stone) s.inventory.stone = pack.stone;
  if (pack.molotov) s.inventory.molotov = pack.molotov + (kitId === "late" ? 1 : 0);
  if (pack.bearTrap) s.inventory.bearTrap = pack.bearTrap;
  if (pack.wood) s.inventory.wood = pack.wood;
  if (pack.ranged) {
    s.inventory[pack.ranged] = 1;
    g.slots.ranged = pack.ranged;
    if (pack.bolt) s.inventory.bolt = pack.bolt;
    if (pack.ammo) s.inventory.ammo = pack.ammo;
    if (s.magazines && pack.ranged === "rifle") s.magazines.rifle = 5;
  }
  g.slots.throw = pack.molotov ? "molotov" : pack.stone ? "stone" : null;
  if (pack.bearTrap) g.slots.trap = "bearTrap";
  s.slot = 3;
  s.region = T.region;
  s.enemies[T.region] = null;
  e.assignRegion();
  e.paused = false;
  // 它进图时才生出来：先走一帧（离窝远一点，别一进来就弄醒它）
  Object.assign(p, T.region === "tunnel" ? { x: 150, y: 512 } : e.freePoint(80, 500), { hp: 100 });
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
  // 隧道：从检修梯下来；最后一夜：守在篝火东边
  if (T.region === "tunnel") Object.assign(p, { x: 150, y: 512 });
  if (id === "moth") Object.assign(p, e.freePoint(e.fireSpot().x + 240, e.fireSpot().y - 40));
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
    relightT = 0,
    mothSpot = null,
    mothSpotT = 0;
  const flank = { dir: seed % 2 ? 1 : -1, dirT: 0 };
  const stat = { low: 1, swings: 0, landed: 0, rolls: 0, bandages: 0, maxHit: 0, hits: 0, strikes: 0, lures: 0, crashes: 0, backstabs: 0, molotovs: 0, traps: 0, swaps: 0, relights: 0, staggers: 0, beached: 0, shots: 0 };
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
  const melee = () => {
    // 家伙坏了（伤害减半）：换带着的另一把
    const c = e.cond?.(g.slots.melee);
    if (c && c.d <= 0) {
      const next = meleeList.find((w) => w !== g.slots.melee && (e.cond?.(w)?.d ?? 1) > 0);
      if (next) {
        g.slots.melee = next;
        stat.swaps++;
      }
    }
    return e.meleeStats(g.slots.melee);
  };
  const swing = (z) => {
    // 留一口体力滚（倒地、搁浅、晕了这种好机会不算）
    const chance = z.mode === "beached" || ["stun", "panic", "trapped"].includes(z.act?.k) || z.stag > 0;
    // 知道打法的人留一口体力好跑（好机会、它刚出完招的空当不留）；不知道的人一直打（累了打得慢）
    const opening = (z.act?.k === "wait" || z.act?.k === "rest") && !e.tx.strikes.some((S) => S.src === z.id);
    const keep = (process.env.RESERVE && right && !chance && !opening && z.titan) || (cur.reserve && z.titan) ? 12 + (melee()?.stamina || 8) + (cur.reserve || 0) : 0;
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
  // 远程：弩、步枪（打它身上挨打的那一块）
  const shoot = (z) => {
    if (!g.slots.ranged || e.cooldown > 0 || e.reload || act > 0) return false;
    s.slot = 4;
    const ok = e.use({ x: z.x, y: z.y - (z.hy ?? 40) });
    s.slot = 3;
    if (ok) stat.shots++;
    return ok;
  };
  // 有没有东西挡在你和它中间（墙、别的那一只）
  const clearShot = (z, others = []) => {
    if (!e.lineClear(p, z)) return false;
    const tx0 = z.x,
      ty0 = z.y - (z.hy ?? 40),
      ox = p.x,
      oy = p.y - 26,
      vx = tx0 - ox,
      vy = ty0 - oy,
      L = vx * vx + vy * vy || 1;
    for (const o of others) {
      if (o === z || o.dead || o.hidden) continue;
      const cy = o.y - (o.hy ?? 40),
        k = clamp(((o.x - ox) * vx + (cy - oy) * vy) / L, 0, 1);
      if (k < 0.98 && Math.hypot(ox + vx * k - o.x, oy + vy * k - cy) < (o.r || 30) * 1.05 + 4) return false;
    }
    return true;
  };
  const inZone = (q, kind) => e.tx.zones.some((Z) => Z.kind === kind && e.tZoneHas(Z, q));
  // 隧道：轨道两边过道的口子（车来了往这儿钻）
  let mouths = null;
  const trackMouths = () => {
    if (mouths) return mouths;
    mouths = [];
    const TY0 = TITANS.train.track.y;
    for (let x = 96; x <= 1440; x += 16)
      for (const y of [TY0 - 100, TY0 + 100])
        if (!e.blocked(x, y, false, 14) && !e.blocked(x, (y + TY0) / 2, false, 14)) mouths.push({ x, y });
    return mouths;
  };
  const throwAt = (item, q) => {
    if (!(s.inventory[item] > 0) || e.cooldown > 0) return false;
    g.slots.throw = item;
    s.slot = 5;
    const ok = e.use({ x: q.x, y: q.y });
    s.slot = 3;
    return ok;
  };
  const cur = { all: [], W: null, live: [], reserve: 0 };
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
  Object.assign(RIGHT, {
    // 雕爷和看门的：手下先收拾；雕爷在：绕着他转（离他四百三上下，看门的拴着够不着），看得见就放箭（他瞄你时大氅敞着）；
    // 挡着就打看门的；雕爷倒了打看门的
    diao(z, dz, rch) {
      const boss = cur.all.find((q) => q.part === "boss"),
        dog = cur.all.find((q) => q.part === "dog"),
        men = e.enemies.filter((q) => q.tMan && !q.dead && dist(q, p) < 430).sort((a1, b1) => dist(a1, p) - dist(b1, p)),
        man = men[0];
      if (man && dist(man, p) < (cur.W?.range || 90) - 6) {
        swing(man);
        return { x: 0, y: 0, run: false };
      }
      if (man && clearShot(man, cur.all)) shoot(man);
      if (boss) {
        const D = TITANS.diao,
          R0 = D.chain + 150,
          db = dist(boss, p),
          th = Math.atan2(p.y - boss.y, p.x - boss.x);
        const spotAt = (sgn) => {
          const a2 = th + sgn * 0.35;
          return { x: boss.x + Math.cos(a2) * R0, y: boss.y + Math.sin(a2) * R0 };
        };
        const okSpot = (q) => q.x > 90 && q.x < 1446 && q.y > 100 && q.y < 924 && !e.blocked(q.x, q.y, false, 14);
        flank.dirT -= DT;
        if (flank.dirT <= 0 || !okSpot(spotAt(flank.dir))) {
          if (!okSpot(spotAt(flank.dir)) && okSpot(spotAt(-flank.dir))) flank.dir = -flank.dir;
          flank.dirT = 2;
        }
        let goal = spotAt(flank.dir);
        if (!okSpot(goal)) goal = e.freePoint(clamp(goal.x, 100, 1436), clamp(goal.y, 110, 914));
        if (!man || !clearShot(man, cur.all)) {
          if (db < 445 && clearShot(boss, cur.all)) shoot(boss);
          else if (dog && dist(dog, p) < 445 && clearShot(dog, cur.all)) shoot(dog);
        }
        if (dog && dist(dog, p) < 170) return step(freeDir(Math.atan2(p.y - dog.y, p.x - dog.x)), true);
        return moveTo(goal, Math.abs(db - R0) > 120);
      }
      // 看门的挣断了链子：远了放箭，近了打
      if (dz > rch + 60 && clearShot(z, cur.all)) shoot(z);
      return attackPlan(z, dz, rch);
    },
    // 黑潮：擦焊枪时走出油；第二段起它站进油里、没着火就扔燃烧瓶；平时别站在油里
    tide(z, dz, rch) {
      if (process.env.TIDE && Math.round(t * 20) % 20 === 0) console.log("  tide", t.toFixed(1), "tp", z.tp, "hp", Math.round(z.hp), "act", z.act?.k || "-", "aflame", (z.aflame || 0).toFixed(1), "d", Math.round(dz), "oil", e.tx.zones.filter((Z) => Z.kind === "oil").map((Z) => Math.round(dist(Z, z))).join("/"), "fire", e.tx.zones.filter((Z) => Z.kind === "fire").length, "mol", s.inventory.molotov || 0, "php", Math.round(p.hp), "pOil", inZone(p, "oil"));
      throwT -= DT;
      // 它站进油里、或者就在一滩油边上：往那滩油扔燃烧瓶（油一着就是一大片）
      const oilBy = z.tp === 1 && !(z.aflame > 0) ? e.tx.zones.filter((Z) => Z.kind === "oil" && dist(Z, z) < Z.r + 50 && dist(Z, p) < 300 && dist(Z, p) > Z.r + 40).sort((a1, b1) => dist(a1, z) - dist(b1, z))[0] : null;
      if (oilBy && throwT <= 0 && (s.inventory.molotov || 0) > 0 && e.lineClear(p, oilBy)) {
        if (throwAt("molotov", dist(oilBy, z) < oilBy.r ? z : oilBy)) {
          stat.molotovs++;
          throwT = 2.5;
          return { x: 0, y: 0, run: false };
        }
      }
      // 着火了：离它远一点，等火灭（它追得急）
      if (z.aflame > 0 && z.tp === 1 && inZone(z, "fire") && dz < 200) return step(freeDir(Math.atan2(p.y - z.y, p.x - z.x)), true);
      // 第二段：站到一滩油后面，等它走进来
      if (z.tp === 1 && (s.inventory.molotov || 0) > 0 && !(z.aflame > 0)) {
        const oil = e.tx.zones.filter((Z) => Z.kind === "oil" && Z.t > 4 && dist(Z, p) < 320).sort((a1, b1) => dist(a1, p) - dist(b1, p))[0];
        if (oil && dz > 120) {
          const a = Math.atan2(oil.y - z.y, oil.x - z.x),
            spot = { x: oil.x + Math.cos(a) * (oil.r + 90), y: oil.y + Math.sin(a) * (oil.r + 90) };
          if (!e.blocked(spot.x, spot.y, false, 12) && !inZone(spot, "oil") && !inZone(spot, "fire")) return dist(p, spot) > 24 ? moveTo(spot, dist(p, spot) > 120) : { x: 0, y: 0, run: false };
        }
      }
      // 第三段身边烫：血少了就退开喘口气
      if (z.tp >= 2 && dz < TITANS.tide.aura.r + 10 && p.hp < 45) return step(freeDir(Math.atan2(p.y - z.y, p.x - z.x)), false);
      return attackPlan(z, dz, rch);
    },
    // 风口：肺还在就站远了放箭打肺；肺破完了贴上去打风机（风刃交给躲）
    vent(z, dz, rch) {
      const fan = cur.all.find((q) => q.part === "fan"),
        lungs = cur.all.filter((q) => q.part === "lung");
      if (!fan) return attackPlan(z, dz, rch);
      if (lungs.length) {
        const L = lungs.slice().sort((a1, b1) => dist(a1, p) - dist(b1, p))[0],
          df = dist(fan, p);
        // 站在离风机 360 上下、正对着那个肺的地方
        const a = Math.atan2(L.y + 300 - fan.y, L.x - fan.x),
          spot = { x: clamp(fan.x + Math.cos(a) * 360, 90, 1440), y: clamp(fan.y + Math.sin(a) * 360, 120, 920) };
        if (dist(L, p) < 440 && clearShot(L, cur.all)) shoot(L);
        if (dist(p, spot) > 50) return moveTo(e.blocked(spot.x, spot.y, false, 12) ? e.freePoint(spot.x, spot.y) : spot, df < 300);
        return { x: 0, y: 0, run: false };
      }
      // 风刃那一段：贴到风口跟前（风刃从风口外面一圈起，贴着风口的那一小块扫不到）
      cur.reserve = 0;
      if (fan.tp >= 1) {
        const inner = { x: fan.x, y: fan.y + 44 },
          q = e.blocked(inner.x, inner.y, false, 12) ? e.freePoint(inner.x, inner.y) : inner,
          tpi = Math.min(fan.tp, 2);
        if (dist(p, q) > 18) {
          const V = TITANS.vent.blades,
            ph = Math.atan2(p.y - fan.y, p.x - fan.x),
            d0 = dist(fan, p),
            w = V.speed[tpi] * e.tRage(fan).speed;
          // 等风刃刚扫过去再进（在它后面跟着走进去）；它在吸就别进
          let ok = true;
          for (let i = 0; i < V.n[tpi]; i++) {
            const a = (fan.bladeA || 0) + (i * Math.PI * 2) / V.n[tpi],
              gap = (((ph - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
            if (Math.sin(a) > -0.2 && gap / w < 1.6 && d0 > V.r0 - 10) ok = false;
          }
          if (ok || d0 < V.r0) return moveTo(q, d0 < 260);
          return { x: 0, y: 0, run: false };
        }
        swing(fan);
        return { x: 0, y: 0, run: false };
      }
      // 风刃快扫到身上：逆着它转的方向滚过去（滚的那一下不挨打）
      if (fan.tp >= 1) {
        const V = TITANS.vent.blades,
          n = V.n[Math.min(fan.tp, V.n.length - 1)],
          w = V.speed[Math.min(fan.tp, V.speed.length - 1)] * e.tRage(fan).speed,
          d0 = dist(fan, p),
          ph = Math.atan2(p.y - fan.y, p.x - fan.x);
        if (d0 > V.r0 - 20 && d0 < V.len + 30)
          for (let i = 0; i < n; i++) {
            const a = (fan.bladeA || 0) + (i * Math.PI * 2) / n,
              gap = (((ph - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
              arrive = gap / Math.max(0.05, w) - (30 / Math.max(40, d0)) / Math.max(0.05, w);
            if (arrive < 0.32 && arrive > -0.1 && p.stamina >= e.dodgeCost() && !e.dodgeReason()) {
              if (roll(ph - Math.PI / 2)) return { x: 0, y: 0, run: false };
            }
          }
      }
      // 肺破完了：贴上去打风机（铁丝网挡箭），风刃交给躲
      if (process.env.VENTRANGE && (s.inventory.bolt || 0) > 0) {
        const V = TITANS.vent,
          a = clamp(Math.atan2(p.y - fan.y, p.x - fan.x), 0.35, Math.PI - 0.35),
          spot = { x: clamp(fan.x + Math.cos(a) * (V.blades.len + 40), 90, 1440), y: clamp(fan.y + Math.sin(a) * (V.blades.len + 40), 120, 920) },
          df = dist(fan, p);
        if (df < 450 && clearShot(fan, [])) shoot(fan);
        if (dist(p, spot) > 40) return moveTo(e.blocked(spot.x, spot.y, false, 12) ? e.freePoint(spot.x, spot.y) : spot, df < V.blades.len + 20);
        return { x: 0, y: 0, run: false };
      }
      return attackPlan(fan, dist(fan, p), (cur.W?.range || 90) + (fan.r || 40) * 0.85 - 12);
    },
    // 末班车：车不停就待在过道口；停下来打离得最近的车厢（车头连着车厢打不动），够不着就放箭；翻下轨道了就近打
    train(z, dz, rch) {
      const head = cur.all.find((q) => q.part === "head"),
        cars = cur.all.filter((q) => q.part === "car"),
        A = head?.act,
        TY0 = TITANS.train.track.y;
      if (!head) return attackPlan(z, dz, rch);
      // 还没醒：往车那边走（走到离它八百多它就醒）
      if (!head.awake) return moveTo({ x: Math.min(head.x - 300, p.x + 200), y: TY0 }, false);
      if (head.tp >= 1) return attackPlan(head, dist(head, p), (cur.W?.range || 90) + (head.r || 40) * 0.85 - 12);
      if (A?.k === "stop" && A.t > 0.9 && cars.length) {
        const tgt = cars.slice().sort((a1, b1) => dist(a1, p) - dist(b1, p))[0],
          dt2 = dist(tgt, p),
          r2 = (cur.W?.range || 90) + (tgt.r || 40) * 0.85 - 12;
        if (dt2 > r2 && dt2 < 440 && clearShot(tgt, [])) shoot(tgt);
        return attackPlan(tgt, dt2, r2);
      }
      // 车不停：待在离你最近的过道口
      const M0 = trackMouths(),
        best = M0.slice().sort((a1, b1) => dist(a1, p) - dist(b1, p))[0];
      if (best && (Math.abs(p.y - TY0) < 90 || dist(p, best) > 60)) return moveTo(best, Math.abs(p.y - TY0) < 90);
      return { x: 0, y: 0, run: false };
    },
    // 扑火：光还在就站在四五百外用步枪打光；心露出来了在热圈外打；它往篝火爬就在它前面摆夹子、贴上去推
    moth(z, dz, rch) {
      const body = cur.all.find((q) => q.part === "body"),
        lights = cur.all.filter((q) => q.part === "light"),
        fire = e.fireSpot();
      if (!body) return attackPlan(z, dz, rch);
      if (lights.length) {
        // 子弹打光了：走上去拿家伙敲最近的那盏（暗下去的那两秒不打）
        const left = (s.inventory.ammo || 0) + (s.magazines?.[g.slots.ranged] || 0);
        if (!left) {
          const L2 = lights.slice().sort((a1, b1) => dist(a1, p) - dist(b1, p))[0],
            dl = dist(L2, p),
            rl = (cur.W?.range || 90) + (L2.r || 34) * 0.85 - 12;
          if (dl < rl) {
            if (!L2.dim) swing(L2);
            return { x: 0, y: 0, run: false };
          }
          return moveTo(e.blocked(L2.x, L2.y, false, 12) ? e.freePoint(L2.x, L2.y) : L2, dl > 260);
        }
        // 站的地方：离它四百三、在篝火那一边，看得见那几盏光（塔、房子挡着子弹就换个地方；一秒换一回）
        const gun = (q) => ({ x: q.x, y: q.y - 28 });
        mothSpotT -= DT;
        if (!mothSpot || mothSpotT <= 0) {
          mothSpotT = 1;
          const base = Math.atan2(fire.y - body.y, fire.x - body.x);
          let best = null;
          for (const k of [0.5, -0.5, 0, 0.9, -0.9, 1.3, -1.3]) {
            const a = base + k * flank.dir,
              q = { x: clamp(body.x + Math.cos(a) * 430, 90, 1440), y: clamp(body.y + Math.sin(a) * 430, 120, 920) };
            if (e.blocked(q.x, q.y, false, 12)) continue;
            const n = lights.filter((L0) => e.lineClear(gun(q), L0)).length;
            if (!best || n > best.n) best = { q, n };
            if (n === lights.length) break;
          }
          mothSpot = best?.q || { x: body.x - 430, y: body.y };
        }
        const spot = mothSpot;
        // 打亮着的那盏（暗下去的那两秒打不动）；挡着的不打
        const L = lights.slice().sort((a1, b1) => (a1.dim ? 1 : 0) - (b1.dim ? 1 : 0) || (e.lineClear(gun(p), a1) ? 0 : 1) - (e.lineClear(gun(p), b1) ? 0 : 1) || dist(a1, p) - dist(b1, p))[0];
        const shotOk = dist(L, p) < 820 && !L.dim && e.lineClear(gun(p), L) && shoot(L);
        if (process.env.MOTH && Math.round(t * 20) % 20 === 0) console.log("  moth", t.toFixed(1), "L", L.pkey, Math.round(L.hp), "dL", Math.round(dist(L, p)), "p", Math.round(p.x), Math.round(p.y), "body", Math.round(body.x), Math.round(body.y), "spot", Math.round(spot.x), Math.round(spot.y), "ammo", s.inventory.ammo || 0, "mag", s.magazines?.rifle, "reload", !!e.reload, "cd", e.cooldown.toFixed(2), "shot", shotOk);
        if (dist(p, spot) > 60) return moveTo(e.blocked(spot.x, spot.y, false, 12) ? e.freePoint(spot.x, spot.y) : spot);
        return { x: 0, y: 0, run: false };
      }
      if (body.hidden) return { x: 0, y: 0, run: false };
      const dh = dist(body, p);
      if (body.tp >= 2) {
        // 拦住它：在它和篝火中间摆夹子；贴上去推开、打
        trapT -= DT;
        const a = Math.atan2(fire.y - body.y, fire.x - body.x),
          front = { x: body.x + Math.cos(a) * 70, y: body.y + Math.sin(a) * 70 };
        if (trapT <= 0 && (s.inventory.bearTrap || 0) > 0 && dist(p, front) < 60 && e.cooldown <= 0) {
          s.slot = 6;
          g.slots.trap = "bearTrap";
          const ok = e.use(front);
          s.slot = 3;
          if (ok) stat.traps++;
          trapT = 3;
        }
        if (dh < 60 + (body.r || 0) && (e.gx.shoveCd || 0) <= 0 && p.stamina >= 15 && !(body.crawlSlow > 0)) {
          p.facing = Math.atan2(body.y - p.y, body.x - p.x);
          e.shove();
        }
        if ((s.inventory.bearTrap || 0) > 0 && trapT <= 0) return moveTo(front, true);
        return attackPlan(body, dh, (cur.W?.range || 90) + (body.r || 40) * 0.85 - 12);
      }
      // 心：有子弹就在热圈外放枪；没子弹了贴上去打（心跳那一圈火要躲）
      const ammo = (s.inventory.ammo || 0) + (s.magazines?.[g.slots.ranged] || 0);
      if (ammo > 0) {
        if (dh < TITANS.moth.heart.beat.r1 + 30) return step(freeDir(Math.atan2(p.y - body.y, p.x - body.x)), false);
        // 塔、房子挡着就往它那边挪一点
        const clear = e.lineClear({ x: p.x, y: p.y - 28 }, { x: body.x, y: body.y - (body.hy ?? 30) });
        if (dh < 600 && clear) shoot(body);
        return dh > 340 || !clear ? moveTo(body) : { x: 0, y: 0, run: false };
      }
      return attackPlan(body, dh, (cur.W?.range || 90) + (body.r || 40) * 0.85 - 12);
    },
  });
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
  // 风口的风刃（快扫到你那一格）、扑火的浪（口子以外）、开着的末班车（车头前面那一截）
  function hazards() {
    const out = [];
    for (const z of cur.all) {
      // 风刃：不懂打法的看见了就跑开；知道打法的逆着滚过去（在 RIGHT.vent 里）
      if (z.titan === "vent" && z.part === "fan" && z.tp >= 1 && !right) {
        const V = TITANS.vent.blades,
          n = V.n[Math.min(z.tp, V.n.length - 1)],
          w = V.speed[Math.min(z.tp, V.speed.length - 1)] * e.tRage(z).speed,
          d = dist(z, p),
          ph = Math.atan2(p.y - z.y, p.x - z.x);
        if (d < V.r0 - 20 || d > V.len + 30) continue;
        for (let i = 0; i < n; i++) {
          const a = (z.bladeA || 0) + (i * Math.PI * 2) / n,
            gap = (((ph - a) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2),
            tt = gap / Math.max(0.05, w);
          if (tt > 1.1 || Math.sin(a + gap) < -0.1) continue;
          out.push({ id: "blade" + i, t: tt, max: 1.1, col: "red", hit: { dmg: V.dmg }, shape: { k: "cone", x: z.x, y: z.y, a: a + gap / 2 + 0.06, arc: gap / 2 + 0.14, r: V.len } });
        }
      }
      if (z.titan === "train" && z.part === "head" && ["run", "leave"].includes(z.act?.k) && !z.hidden) {
        const TR = TITANS.train,
          dir = z.act.dir || 1,
          v = Math.max(200, z.act.v || TR.run.speed),
          x0 = dir > 0 ? z.x - TR.headLen : 0,
          x1 = dir > 0 ? WORLD_W : z.x + TR.headLen;
        out.push({ id: "train", t: Math.max(0, (p.x - z.x) * dir) / v, max: 2, col: "orange", hit: { dmg: TR.run.dmg }, shape: { k: "rect", x: x0, y: TR.track.y - TR.track.h / 2, w: x1 - x0, h: TR.track.h } });
      }
    }
    // 通了电的铁轨、要通电的铁轨（蓝色那一道）：跟预兆一样躲开
    for (const S of e.tx.strikes) if (S.cue === "tArc") out.push({ id: "arc", t: S.t, max: S.max, col: "red", hit: { dmg: 14 }, shape: S.shape });
    for (const Z of e.tx.zones) if (Z.kind === "volt") out.push({ id: "volt", t: 0.1, max: 1, col: "red", hit: { dmg: 14 }, shape: { k: "rect", x: Z.x, y: Z.y, w: Z.w, h: Z.h } });
    for (const w of e.tx.waves || []) {
      const tt = w.wait + Math.max(0, w.x - w.w / 2 - p.x) / w.speed;
      if (w.x + w.w / 2 < p.x - 30 || tt > 2.2) continue;
      out.push({ id: "waveA", t: tt, max: 2.2, col: "red", hit: { dmg: 34 }, shape: { k: "rect", x: 0, y: 0, w: WORLD_W, h: w.gy0 } });
      out.push({ id: "waveB", t: tt, max: 2.2, col: "red", hit: { dmg: 34 }, shape: { k: "rect", x: 0, y: w.gy1, w: WORLD_W, h: 1024 - w.gy1 } });
    }
    return out;
  }
  let lastHp = p.hp,
    prevStrikes = [];
  const DEBUG = !!process.env.HITLOG;
  while (t < LIMIT && !died) {
    if (s.region !== T.region) break;
    act = Math.max(0, act - DT);
    const all = e.titansHere(id);
    if (!all.length) break;
    // 最后一夜：心扑到了篝火、天快亮了退回去——这一夜就结束了（凶台里它会被重新叫出来，不算）
    if (id === "moth" && e.tg.final.lost > 0) break;
    const b = all.slice().sort((x, y) => dist(x, p) - dist(y, p))[0];
    if (fightStart < 0 && b.awake) fightStart = t;
    const gx = e.gx;
    const d = dist(b, p),
      W = melee(),
      reach = (W?.range || 90) + (b.r || 40) * 0.85 - 12;
    cur.all = all;
    cur.W = W;
    // 火烧掉了多少（黑潮）、打进去多少（别的）
    stat.fire = Math.max(stat.fire || 0, all.reduce((a1, z) => a1 + (z.dealt?.fire || 0), 0));
    if (process.env.DMG) for (const z of all) if (z.pkey) (stat.part ||= {})[z.pkey] = Math.round(z.maxHp - z.hp) + (z.tp ? "@" + z.tp : "");
    // DMG=1：最后一夜每一段从第几秒开始（光全灭、心露出来、往篝火爬）
    if (process.env.DMG && id === "moth") {
      const bd = all.find((z) => z.part === "body"),
        ph = (stat.ph ||= {});
      if (bd && !all.some((z) => z.part === "light")) ph.out ??= Math.round(t);
      if (bd?.heart) ph.heart ??= Math.round(t);
      if (bd?.tp >= 2) ph.crawl ??= Math.round(t);
      // 往篝火爬的那一段：心还剩多少、离篝火多远、挥了几下打中几下、开了几枪
      if (bd?.tp >= 2) {
        const c = (stat.cr ||= { hp0: Math.round(bd.hp), d0: Math.round(dist(bd, e.fireSpot())), sw: stat.swings, ld: stat.landed, sh: stat.shots, slow: 0 });
        c.hp = Math.round(bd.hp);
        c.d = Math.round(dist(bd, e.fireSpot()));
        c.swings = stat.swings - c.sw;
        c.landed = stat.landed - c.ld;
        c.shots = stat.shots - c.sh;
        if (bd.crawlSlow > 0) c.slow += DT;
        c.pd = Math.round(dist(bd, p));
      }
    }
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
      // 后五凶一直在动的那几样（风刃、浪、开着的车）：看得见，当成快到点的预兆躲
      for (const S of hazards()) live.push(S);
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
          for (const r of id === "moth" ? [30, 55, 80, 105, 135, 170, 210] : [30, 55, 80, 105, 135, 170]) {
            const q = { x: p.x + Math.cos(a0) * r, y: p.y + Math.sin(a0) * r };
            if (q.x < 70 || q.x > 1466 || q.y < 80 || q.y > 944 || e.blocked(q.x, q.y, false, 12) || !e.lineClear(p, q)) continue;
            const dq = danger(q),
              tw = r / 157,
              mud = e.tx.zones.some((Z) => (Z.kind === "mud" || Z.kind === "gas" || Z.kind === "ice" || Z.kind === "fire" || Z.kind === "volt" || (Z.kind === "oil" && right)) && e.tZoneHas(Z, q)) || (e.gx.fires || []).some((f) => f.region === s.region && dist(f, q) < f.r + 14),
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
      const mire = e.tx.zones.find((Z) => (Z.kind === "mud" || Z.kind === "ice" || Z.kind === "fire" || (Z.kind === "oil" && right) || (Z.kind === "water" && right && id === "hebo")) && e.tZoneHas(Z, p) && Z.w == null) || (e.gx.fires || []).find((f) => f.region === s.region && dist(f, p) < f.r + 14);
      // 通了电的铁轨：往最近的过道口走
      const volt = e.tx.zones.find((Z) => Z.kind === "volt" && e.tZoneHas(Z, p));
      // 风口在吸：往外跑（知道打法的人）
      const fan = cur.all.find((z) => z.part === "fan" && ["suck", "suckWind"].includes(z.act?.k));
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
      } else if (right && fan && dist(fan, p) < TITANS.vent.suck.edge + 20) {
        input = step(freeDir(Math.atan2(p.y - fan.y, p.x - fan.x)), true);
      } else if (volt) {
        const m = trackMouths().slice().sort((a1, b1) => dist(a1, p) - dist(b1, p))[0];
        input = m ? moveTo(m, true) : step(freeDir(-Math.PI / 2), true);
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
    // DMG=1：每一点血掉在哪儿（按来源加起来，打完一场打出来）
    if (process.env.DMG && p.hp < lastHp - 0.001) {
      const gone = prevStrikes.filter((S) => !e.tx.strikes.includes(S) && S.t <= 0.05);
      const fanNow = cur.all.find((z) => z.part === "fan");
      const k = gone.length ? gone.map((S) => (S.titan || "") + ":" + S.shape.k + (S.hit?.dmg || "")).join("+") : e.tx.zones.some((Z) => Z.kind === "gas" && e.tZoneHas(Z, p)) ? "gas" : e.gx.bleed > 0 ? "bleed" : "?" + (e.fx?.lastHitBy || "") + (fanNow && e.fx?.lastHitBy === "t_vent" ? (fanNow.act?.k === "suck" ? "-suck" : "-blade" + (e.invulnerable > 0.6 ? "" : "?")) : "");
      (stat.dmg ||= {})[k] = ((stat.dmg ||= {})[k] || 0) + (lastHp - p.hp);
      // 最后一夜：每一段挨了多少
      if (id === "moth") {
        const seg = stat.ph?.crawl != null ? "crawl" : stat.ph?.out != null ? "heart" : "lights";
        (stat.seg ||= {})[seg] = Math.round(((stat.seg ||= {})[seg] || 0) + (lastHp - p.hp));
      }
    }
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
  // 最后一夜：心扑到了篝火、天快亮了（算没守住）
  const lost = id === "moth" && !won && !died && (e.tg.final.lost > 0 || !left.length);
  const out = { won, died: died || lost, fled: !died && !lost && !won && fleeing, timeout: !died && !lost && !won && !fleeing, t: fightStart >= 0 ? t - fightStart : t, hp: Math.round(p.hp), bossHp: left.reduce((a, z) => a + Math.max(0, z.hp), 0) / Math.max(1, e.titanMaxHp(id)), tp: left[0]?.tp ?? 3, ...stat, crashes: e.tg.stats.staggers };
  if (TRACE) console.log(id, style, kitId, seed, JSON.stringify(out));
  if (process.env.DMG && stat.part) console.log("  part", seed, JSON.stringify(stat.part), stat.ph ? JSON.stringify(stat.ph) : "", stat.seg ? JSON.stringify(stat.seg) : "", stat.cr ? JSON.stringify({ ...stat.cr, sw: undefined, ld: undefined, sh: undefined, slow: Math.round(stat.cr.slow * 10) / 10 }) : "");
  if (hits) console.log("  hits", seed, Object.entries(hits).sort((a1, b1) => b1[1].dmg - a1[1].dmg).map(([k, v]) => k + " " + v.n + "/" + Math.round(v.dmg)).join("  "));
  if (process.env.DMG) console.log("  dmg", seed, out.won ? "WON" : out.died ? "DIED" : "FLED", Object.entries(stat.dmg || {}).sort((a1, b1) => b1[1] - a1[1]).map(([k, v]) => k + ":" + Math.round(v)).join("  "));
  return out;
}

const pct = (a, b) => (b ? Math.round((100 * a) / b) : 0) + "%";
const mean = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
for (const id of WHO)
  for (const kitId of KITS)
    for (const style of STYLES) {
      const rs = [];
      const t0 = Date.now();
      for (let i = 0; i < N; i++) rs.push(trial(id, style, kitId, i + 1 + Number(process.env.SEED0 || 0)));
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
          extra: { fire: Math.round(mean(rs.map((r) => r.fire || 0))), shots: +mean(rs.map((r) => r.shots || 0)).toFixed(1), lures: +mean(rs.map((r) => r.lures)).toFixed(1), backstabs: +mean(rs.map((r) => r.backstabs)).toFixed(1), molotovs: +mean(rs.map((r) => r.molotovs)).toFixed(1), traps: +mean(rs.map((r) => r.traps)).toFixed(1), swaps: +mean(rs.map((r) => r.swaps)).toFixed(1), relights: +mean(rs.map((r) => r.relights)).toFixed(1), beached: +mean(rs.map((r) => r.beached)).toFixed(1) },
          ms: Date.now() - t0,
        }),
      );
    }
