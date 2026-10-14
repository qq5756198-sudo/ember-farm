// v0.31.0「重光」：地铁隧道一层怎么拼。只按“存档种子、第几层、哪天、手气签大吉没有”算，同样的数拼出同样的一层，
// 所以读档以后还是那一层；引擎（墙、柜子、感染者、检修梯）和画面（底图，在后台画）用的是同一份布局，这里不依赖引擎。
// 一层是 24×16 格（每格 64），中间第 7、8 行是两格高的轨道（左端是从升降井下来的地方），上下两排是房间，竖通道连到轨道上。
export const TILE = 64,
  COLS = 24,
  ROWS = 16;
export const G = { wall: 0, room: 1, track: 2, hall: 3, platform: 4 };
export const SPAWN = { x: 150, y: 512 };
export const UP = { x: 104, y: 470 };
export const STORE_FLOORS = [10, 20, 30];
export const LIFT_FLOORS = [5, 10, 15, 20, 25];
export const LAST_FLOOR = 30;

// 和引擎里的不是同一个哈希（引擎层的在 undertow.js，画图的后台线程用不了），只在这里用
export function tunnelHash(...parts) {
  let h = 2166136261;
  for (const p of parts) {
    const s = String(p);
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    h ^= 31;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function tunnelRng(seed) {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 画底图用的名字：tunnel:种子:层:日子:大吉（1/0）
export const tunnelArtKey = (seed, floor, day, luck) => "tunnel:" + seed + ":" + floor + ":" + day + ":" + (luck ? 1 : 0);
export function parseTunnelKey(key) {
  const m = /^tunnel:(-?\d+):(\d+):(\d+):([01])$/.exec(String(key || ""));
  return m ? { seed: Number(m[1]), floor: Number(m[2]), day: Number(m[3]), luck: m[4] === "1" } : null;
}

const center = (c, r) => ({ x: c * TILE + TILE / 2, y: r * TILE + TILE / 2 });
const pickW = (list, x) => {
  const total = list.reduce((a, [, w]) => a + w, 0);
  let acc = 0;
  for (const [v, w] of list) {
    acc += w / total;
    if (x < acc) return v;
  }
  return list[list.length - 1][0];
};
// 隧道有多难都在这儿调：一层几只（第 1 层 base 只，每往下 step 层多一只，最多 cap 只）、血厚几成（每层 hpk）、
// 挨一下疼几成（每层 hitk）；mix 是一段段（到第 upto 层为止）各种感染者的份数
export const FOE_TUNE = {
  base: 8,
  step: 20,
  cap: 9,
  hpk: 0.012,
  hitk: 0.007,
  mix: [
    { upto: 4, slow: 3, runner: 4, stalker: 2, armor: 1.3 },
    { upto: 9, slow: 2.5, runner: 3, stalker: 2, armor: 1.8, bloater: 0.6 },
    { upto: 15, slow: 2, runner: 2.5, stalker: 1.5, armor: 1.6, bloater: 1, faker: 1, spitter: 0.3 },
    { upto: 19, slow: 2, runner: 2.5, stalker: 1.5, armor: 2.1, bloater: 1, faker: 1, spitter: 0.5 },
    { upto: 25, slow: 2.5, runner: 2.5, stalker: 1.5, armor: 1, bloater: 1, faker: 1, spitter: 0.35 },
    { upto: 30, slow: 2.5, runner: 2.5, stalker: 1.5, armor: 1.35, bloater: 1, faker: 1, spitter: 0.5 },
  ],
};
// 越往下种类越杂
function foeMix(f) {
  const band = FOE_TUNE.mix.find((b) => f <= b.upto) || FOE_TUNE.mix[FOE_TUNE.mix.length - 1];
  return Object.entries(band).filter(([k, w]) => k !== "upto" && w > 0);
}
export const TUNNEL_FOES = {
  count: (f) => Math.min(FOE_TUNE.cap, FOE_TUNE.base + Math.floor((f - 1) / FOE_TUNE.step)),
  hp: (f) => 1 + FOE_TUNE.hpk * (f - 1),
  hit: (f) => 1 + FOE_TUNE.hitk * (f - 1),
  mix: (f) => foeMix(f),
};
const KIND_BY_THEME = {
  track: ["toolbox", "cargo", "garage"],
  platform: ["cargo", "wardrobe", "kitchen"],
  shelter: ["kitchen", "medicine", "wardrobe"],
  store: ["cargo", "toolbox", "medicine"],
  pump: ["toolbox", "garage", "cargo"],
};

// 把墙格并成尽量少的长方形（碰撞用）
function wallRects(g) {
  const runs = [];
  for (let r = 0; r < ROWS; r++) {
    let c = 0;
    while (c < COLS) {
      if (g[r * COLS + c] !== G.wall) {
        c++;
        continue;
      }
      const c0 = c;
      while (c < COLS && g[r * COLS + c] === G.wall) c++;
      runs.push({ c0, c1: c, r0: r, r1: r + 1 });
    }
  }
  // 上下相邻、左右一样的合并
  const out = [];
  const open = new Map();
  for (const run of runs) {
    const key = run.c0 + ":" + run.c1,
      prev = open.get(key);
    if (prev && prev.r1 === run.r0) prev.r1 = run.r1;
    else {
      const rect = { ...run };
      out.push(rect);
      open.set(key, rect);
    }
  }
  return out.map((q) => ({ x: q.c0 * TILE, y: q.r0 * TILE, w: (q.c1 - q.c0) * TILE, h: (q.r1 - q.r0) * TILE }));
}

export function tunnelLayout(seed, floor, day = 1, luck = false) {
  floor = Math.max(1, Math.min(LAST_FLOOR, Math.floor(floor) || 1));
  const r = tunnelRng(tunnelHash(seed, "tunnel", floor, day, luck ? 1 : 0));
  const g = new Uint8Array(COLS * ROWS);
  const at = (c, rr) => (c < 0 || rr < 0 || c >= COLS || rr >= ROWS ? G.wall : g[rr * COLS + c]);
  const set = (c, rr, v) => {
    if (c >= 1 && rr >= 1 && c < COLS - 1 && rr < ROWS - 1) g[rr * COLS + c] = v;
  };
  const store = STORE_FLOORS.includes(floor),
    pump = floor === LAST_FLOOR;
  const theme = pump ? "pump" : store ? "store" : floor % 3 === 0 ? "platform" : floor % 3 === 1 ? "track" : "shelter";
  // 轨道
  for (let c = 1; c <= 22; c++) {
    set(c, 7, G.track);
    set(c, 8, G.track);
  }
  // 站台层：轨道一边一条宽站台
  let platformUp = null;
  if (theme === "platform") {
    platformUp = r() < 0.5;
    for (let c = 3; c <= 20; c++) {
      set(c, platformUp ? 6 : 9, G.platform);
      set(c, platformUp ? 5 : 10, G.platform);
    }
  }
  // 房间：上一排在第 1–4 行，下一排在第 11–14 行（站台占着的那一边往外挪一行）
  const rooms = [];
  const want = store || pump ? 4 + Math.floor(r() * 2) : 5 + Math.floor(r() * 4);
  const free = (c0, r0, w, h) => {
    for (let rr = r0 - 1; rr <= r0 + h; rr++) for (let c = c0 - 1; c <= c0 + w; c++) if (at(c, rr) === G.room) return false;
    return true;
  };
  for (let tries = 0; tries < 120 && rooms.length < want; tries++) {
    const top = rooms.length < 2 ? rooms.length === 0 : r() < 0.5;
    const w = 3 + Math.floor(r() * 4),
      h = 2 + Math.floor(r() * 2);
    const c0 = 3 + Math.floor(r() * (20 - w - 2));
    let r0 = top ? 1 + Math.floor(r() * (4 - h + 1)) : 11 + Math.floor(r() * (4 - h + 1));
    if (theme === "platform" && top && platformUp) r0 = Math.min(r0, 4 - h);
    if (theme === "platform" && !top && !platformUp) r0 = Math.max(r0, 12);
    if (r0 < 1 || r0 + h > (top ? 5 : 15)) continue;
    if (!free(c0, r0, w, h)) continue;
    for (let rr = r0; rr < r0 + h; rr++) for (let c = c0; c < c0 + w; c++) set(c, rr, G.room);
    // 竖通道连到轨道（两格宽）
    const cc = c0 + Math.floor(r() * Math.max(1, w - 1));
    if (top) for (let rr = r0 + h; rr <= 6; rr++) for (const c of [cc, cc + 1]) if (at(c, rr) === G.wall) set(c, rr, G.hall);
    if (!top) for (let rr = 9; rr < r0; rr++) for (const c of [cc, cc + 1]) if (at(c, rr) === G.wall) set(c, rr, G.hall);
    rooms.push({ c0, r0, w, h, top, door: cc });
  }
  // 一条横的检修通道把同一排相邻的两间连起来（多一条绕路）
  for (const top of [true, false]) {
    const row = rooms.filter((q) => q.top === top).sort((a, b) => a.c0 - b.c0);
    for (let i = 0; i + 1 < row.length; i++) {
      if (r() > 0.45) continue;
      const a = row[i],
        b = row[i + 1],
        rr = top ? Math.max(a.r0, b.r0) : Math.min(a.r0 + a.h, b.r0 + b.h) - 1;
      if (rr < a.r0 || rr >= a.r0 + a.h || rr < b.r0 || rr >= b.r0 + b.h) continue;
      for (let c = a.c0 + a.w; c < b.c0; c++) if (at(c, rr) === G.wall) set(c, rr, G.hall);
    }
  }
  // 从出生点走到每一格要几步（找最远的房间放检修梯）
  const startC = Math.floor(SPAWN.x / TILE),
    startR = Math.floor(SPAWN.y / TILE);
  const steps = new Int16Array(COLS * ROWS).fill(-1);
  const q = [startR * COLS + startC];
  steps[q[0]] = 0;
  for (let i = 0; i < q.length; i++) {
    const cur = q[i],
      c = cur % COLS,
      rr = Math.floor(cur / COLS);
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nc = c + dc,
        nr = rr + dr,
        n = nr * COLS + nc;
      if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || steps[n] >= 0 || at(nc, nr) === G.wall) continue;
      steps[n] = steps[cur] + 1;
      q.push(n);
    }
  }
  const roomTiles = (room) => {
    const out = [];
    for (let rr = room.r0; rr < room.r0 + room.h; rr++) for (let c = room.c0; c < room.c0 + room.w; c++) if (steps[rr * COLS + c] >= 0) out.push([c, rr]);
    return out;
  };
  const roomFar = (room) => Math.max(0, ...roomTiles(room).map(([c, rr]) => steps[rr * COLS + c]));
  const byFar = rooms.filter((x) => roomTiles(x).length).sort((a, b) => roomFar(b) - roomFar(a));
  const pickTile = (room, avoid = []) => {
    const tiles = roomTiles(room).filter(([c, rr]) => !avoid.some((p) => p[0] === c && p[1] === rr));
    // 离门口远一点
    tiles.sort((a, b) => steps[b[1] * COLS + b[0]] - steps[a[1] * COLS + a[0]]);
    const top = tiles.slice(0, Math.max(1, Math.ceil(tiles.length / 2)));
    return top[Math.floor(r() * top.length) % top.length] || null;
  };
  const used = [];
  // 往下的检修梯（最后一层没有）；大吉那天多一道
  const ladders = [];
  if (!pump && byFar.length) {
    const t = pickTile(byFar[0]);
    if (t) {
      used.push(t);
      ladders.push(center(...t));
    }
    if (luck && byFar[1]) {
      const t2 = pickTile(byFar[1]);
      if (t2) {
        used.push(t2);
        ladders.push(center(...t2));
      }
    }
  }
  // 检修电梯：轨道右头
  const lift = LIFT_FLOORS.includes(floor) ? { x: 21 * TILE + 32, y: 8 * TILE - 8 } : null;
  // 泵房里的光（余烬核）
  let core = null;
  if (pump && byFar.length) {
    const t = pickTile(byFar[0]);
    if (t) {
      used.push(t);
      core = center(...t);
    }
  }
  // 柜子：在房间里（物资库多一些）
  const kinds = KIND_BY_THEME[theme];
  const nCrates = store || pump ? 3 + Math.floor(r() * 2) : 2 + Math.floor(r() * 3);
  const crates = [];
  const crateRooms = byFar.length ? byFar : rooms;
  for (let i = 0; i < nCrates && crateRooms.length; i++) {
    const room = crateRooms[(i + (store ? 0 : 1)) % crateRooms.length];
    const t = pickTile(room, used);
    if (!t) continue;
    used.push(t);
    const p = center(...t);
    crates.push({ id: "c" + i, x: p.x + Math.round((r() - 0.5) * 16), y: p.y + Math.round((r() - 0.5) * 12), kind: kinds[Math.floor(r() * kinds.length) % kinds.length] });
  }
  // 感染者：物资库和泵房那几层没有
  const foes = [];
  if (!store && !pump) {
    const n = TUNNEL_FOES.count(floor),
      mix = TUNNEL_FOES.mix(floor);
    const spots = [];
    for (let rr = 1; rr < ROWS - 1; rr++)
      for (let c = 1; c < COLS - 1; c++) {
        const s = steps[rr * COLS + c];
        if (s >= 6 && at(c, rr) !== G.wall && !used.some((p) => p[0] === c && p[1] === rr)) spots.push([c, rr]);
      }
    for (let i = 0; i < n && spots.length; i++) {
      const k = Math.floor(r() * spots.length) % spots.length,
        [c, rr] = spots.splice(k, 1)[0],
        p = center(c, rr);
      foes.push({ type: pickW(mix, r()), x: p.x + Math.round((r() - 0.5) * 24), y: p.y + Math.round((r() - 0.5) * 24) });
    }
  }
  // 灯（美术像素）：轨道顶上的日光灯越往下坏得越多；房间里一盏应急灯；物资库亮堂
  const lights = [];
  const keepTrack = Math.max(0.12, 0.85 - 0.026 * floor),
    keepRoom = Math.max(0.15, 0.75 - 0.02 * floor);
  for (let c = 2; c <= 22; c += 3) if (r() < keepTrack) lights.push({ x: c * 32 + 16, y: 7 * 32 + 4, kind: "fluoro", color: [200, 225, 255] });
  for (const room of rooms) {
    const lit = store || pump ? true : r() < keepRoom;
    if (!lit) continue;
    lights.push({ x: (room.c0 + room.w / 2) * 32, y: room.r0 * 32 + 6, kind: store ? "fluoro" : "lamp", color: store ? [215, 235, 255] : [255, 196, 120] });
  }
  if (floor >= 8) for (const room of rooms) if (r() < 0.35) lights.push({ x: room.door * 32 + 32, y: (room.top ? room.r0 + room.h : room.r0) * 32 - (room.top ? 0 : 4), kind: "bulb", color: [255, 70, 50] });
  return {
    key: tunnelArtKey(seed, floor, day, luck),
    seed,
    floor,
    day,
    luck: !!luck,
    theme,
    store,
    pump,
    platformUp,
    grid: g,
    rects: wallRects(g),
    rooms,
    spawn: { ...SPAWN },
    up: { ...UP },
    ladders,
    lift,
    core,
    crates,
    foes,
    lights,
  };
}
