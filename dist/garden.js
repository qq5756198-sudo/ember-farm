// v0.20.0「一亩田」：种菜好玩起来。
// 田边选种、看得懂的田、搭配加成、轮作、看天下种、照看、杂草、菜青虫与乌鸦、稻草人、照料分与优质、收获连击。
// 每块田的照料记录放在 s.garden.plots[田的编号]，不改原来的农田字段。
import { Engine as ThiefEngine, freshState as thiefFresh, migrateState as thiefMigrate } from "./thief.js";
import { CROPS, ITEMS } from "./data.js";
import { TRAITS } from "./expansion-data.js";
import {
  GARDEN_SCHEMA,
  BUFFS,
  BUFF_IDS,
  SOIL,
  FEED_BACK,
  cropInfo,
  CARE,
  WEEDS,
  BUGS,
  CROWS,
  COVER,
  FODDER_SOIL,
  FODDER_FEED,
  COMBO,
  EARLY,
  LIKED,
  HELPER,
  BAD,
  cropName,
} from "./garden-data.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const mix = (n, salt) => {
  let h = (Math.imul(n | 0, 0x9e3779b1) ^ Math.imul(salt | 0, 0x85ebca6b)) >>> 0;
  h = Math.imul(h ^ (h >>> 16), 0x7feb352d) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 0x846ca68b) >>> 0;
  return (h ^ (h >>> 16)) >>> 0;
};
const rng = (seed) => {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};
const hashStr = (s) => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
};
const REC_KEYS = ["c", "pd", "t", "wd", "w", "b", "cv", "rot", "pk"];
const STAT_KEYS = ["tended", "helped", "weeds", "bugs", "pecked", "covered", "fine", "combos", "planted", "fed"];

const gardenDefaults = () => ({
  schema: GARDEN_SCHEMA,
  seed: 0,
  plots: {},
  bugDay: 0,
  wx: { day: 0, weather: "" },
  stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 0])),
});
const newRec = (day, crop) => ({ c: CARE.base, pd: crop ? day : 0, t: 0, wd: 0, w: 0, b: 0, cv: 0, rot: 0, pk: 0 });

export function migrateState(s) {
  thiefMigrate(s);
  const d = gardenDefaults();
  if (!s.garden) {
    s.garden = d;
    s.garden.seed = ((s.theft?.seed || 7) ^ 0x5bd1e995) >>> 0 || 11;
  } else {
    const x = s.garden;
    s.garden = { ...d, ...x, wx: { ...d.wx, ...x.wx }, stats: { ...d.stats, ...x.stats }, plots: { ...x.plots } };
  }
  const ids = new Set((s.plots || []).map((p) => String(p.id)));
  for (const k of Object.keys(s.garden.plots)) {
    if (!ids.has(k)) delete s.garden.plots[k];
    else s.garden.plots[k] = { ...newRec(0, null), ...s.garden.plots[k] };
  }
  return s;
}
export const freshState = () => migrateState(thiefFresh());

export class Engine extends ThiefEngine {
  constructor(s = freshState(), notify = () => {}) {
    super(migrateState(s), notify);
    this.gClock = 0;
    this.gLast = -99;
    this.gCombo = 0;
    this.assignRegion();
  }
  get g() {
    return this.s.garden;
  }

  // ================= 田与邻居 =================
  isFarmPlot(p) {
    return !!p && p.region !== "valley" && this.s.plots.includes(p);
  }
  plotById(id) {
    return this.s.plots.find((p) => String(p.id) === String(id)) || null;
  }
  gRec(p) {
    const rec = (this.g.plots[p.id] ??= newRec(this.s.day, p.crop));
    // 无人机、阿禾按计划补种时直接改了作物：当成今天新种下的
    if (p.crop && !rec.pd) Object.assign(rec, { c: CARE.base, pd: this.s.day, t: 0, wd: 0, b: 0, rot: 0, pk: 0 });
    return rec;
  }
  adj(p) {
    const plots = this.s.plots;
    let sig = plots.length;
    for (const a of plots) sig = (sig * 31 + a.id * 7 + a.x * 3 + a.y) % 2147483647;
    if (!this._gAdj || this._gAdj.sig !== sig) {
      const map = new Map(),
        side = (a, b) => {
          const dx = Math.abs(a.x - b.x),
            dy = Math.abs(a.y - b.y);
          return (dy < 8 && dx >= 8 && dx <= 44) || (dx < 8 && dy >= 8 && dy <= 44);
        };
      for (const a of plots) map.set(a, plots.filter((b) => b !== a && side(a, b)));
      this._gAdj = { sig, map };
    }
    return this._gAdj.map.get(p) || [];
  }
  // 这块田从邻居那里拿到的加成：只有不同种的邻居给，斜对角不算
  buffsFor(p, crop = p.crop) {
    const out = { water: false, yield: false, quality: false, weed: false, from: {} };
    if (!crop || !this.isFarmPlot(p)) return out;
    for (const q of this.adj(p)) {
      if (!q.crop || q.crop === crop) continue;
      const b = cropInfo(q.crop).buff;
      if (!b) continue;
      out[b] = true;
      (out.from[b] ??= []).includes(cropName(q.crop)) || out.from[b].push(cropName(q.crop));
    }
    return out;
  }
  careParts(p) {
    const parts = [];
    if (!p.crop) return parts;
    const f = p.fertility ?? 65;
    const rec = this.g.plots[p.id];
    if (rec?.rot === 1) parts.push(["换了茬", CARE.rotation]);
    if (f >= 85) parts.push(["肥力 85 以上", CARE.rich]);
    else if (f < 30) parts.push(["肥力不到 30", CARE.poor]);
    if (this.buffsFor(p).quality) parts.push(["邻居给“提质”", CARE.quality]);
    if (this.spec?.("agriculture", "quality")) parts.push(["农业专精：品质", CARE.spec]);
    return parts;
  }
  careScore(p) {
    if (!p?.crop) return 0;
    const rec = this.g.plots[p.id];
    const base = rec ? Math.min(rec.c, CARE.cap) : CARE.base;
    return clamp(Math.round(base + this.careParts(p).reduce((a, [, v]) => a + v, 0)), 0, 100);
  }
  fineChance(score) {
    return score >= CARE.fine ? 1 : score >= CARE.maybe ? (score - CARE.maybe) / (CARE.fine - CARE.maybe) : 0;
  }
  gRoll(key) {
    return rng(mix(this.g.seed ^ hashStr(key), this.s.day * 131 + 17))();
  }

  // ================= 原有规则的接入点 =================
  // 吃地 / 养地：玉米、棉花、南瓜吃地，豆类、药草养地
  soilForecast(p, crop) {
    if (!this.g) return super.soilForecast(p, crop);
    const soil = cropInfo(crop).soil,
      feed = soil === "feed",
      repeat = p.lastCrop === crop && !feed,
      cost = SOIL[soil]?.cost ?? 7;
    return { repeat, cost: cost + (repeat ? 8 : 0), after: clamp((p.fertility ?? 65) - cost - (repeat ? 8 : 0), 0, 100), rotation: !!p.lastCrop && p.lastCrop !== crop };
  }
  // 原来的“玉米挨豆类 +1、番茄挨药草提质”换成搭配加成；连作少收 1 份；被乌鸦啄掉的也在这里扣
  adjacent(p, crop = p.crop) {
    if (!this.g || this._gPlanting || !this.isFarmPlot(p)) return this.g ? { yield: 0, quality: 0 } : super.adjacent(p, crop);
    const rec = this.g.plots[p.id],
      b = this.buffsFor(p, crop);
    return { yield: (b.yield ? 1 : 0) - (rec?.rot === -1 ? 1 : 0) - (rec?.pk || 0), quality: 0 };
  }
  // 保水：昨天浇过，今天也算浇过
  plotWatered(p) {
    if (super.plotWatered(p)) return true;
    return !!(this.g && p?.crop && p.wateredDay > 0 && p.wateredDay >= this.s.day - 1 && this.buffsFor(p).water);
  }
  waterPlot(p) {
    super.waterPlot(p);
    if (!this.g || !this.isFarmPlot(p) || !p.crop) return;
    const rec = this.gRec(p);
    if (rec.wd !== this.s.day) {
      rec.wd = this.s.day;
      rec.c = clamp(rec.c + CARE.water, 0, CARE.cap);
    }
  }
  weatherRate(p) {
    const w = this.s.weather,
      greenhouse = this.s.buildings.some((b) => b.type === "greenhouse" && b.hp > 0 && dist(p, b) < 220);
    if (greenhouse) return 1;
    if (w === "暴雨") return p.trait === "hardy" ? 0.8 : 0.65;
    if (p.trait === "hardy") return 1;
    return BAD[w] || 1;
  }
  cropGrowthRate(p) {
    let r = super.cropGrowthRate(p);
    if (!this.g || !p?.crop || !this.isFarmPlot(p)) return r;
    if (this.s.day <= EARLY.days) r *= EARLY.boost;
    const info = cropInfo(p.crop),
      rec = this.g.plots[p.id],
      w = this.s.weather;
    if (info.likes && info.likes === w) r *= LIKED;
    if (rec && rec.cv >= this.s.day && BAD[w]) {
      const rate = this.weatherRate(p),
        job = this.jobHolder?.("weatherJob") ? Math.max(1, 0.7 / BAD[w]) : 1;
      if (rate < 1) r *= Math.max(1, 1 / rate / job);
    }
    if (rec?.b) r *= BUGS.slow;
    return r;
  }

  // ================= 种 =================
  toolPlot(p, id) {
    if (!this.g || !this.isFarmPlot(p)) return super.toolPlot(p, id);
    const rec = this.g.plots[p.id];
    const seed = ITEMS[id]?.type === "seed";
    if (seed && !p.crop && rec?.w && p.tilled) {
      this.toast("这块地长了草：先按 E 拔草，再播种。", "warn");
      return false;
    }
    if (id === "water" && p.crop && !this.plotDebris(p) && !this.paused && !this.plotWatered(p)) {
      const need = TRAITS[p.trait]?.water || 1;
      if ((this.c?.water ?? need) < need) {
        this.toast("浇水壶没水了：到旧水井或雨水桶旁按 E 补满。", "warn");
        return false;
      }
    }
    const planting = seed && !p.crop && p.tilled && !this.plotDebris(p) && !this.paused;
    if (!planting) return super.toolPlot(p, id);
    const lastCrop = p.lastCrop,
      crop = ITEMS[id].crop,
      captured = [];
    this.toast = (t, tone) => captured.push([t, tone]);
    this._gPlanting = true;
    let ok;
    try {
      ok = super.toolPlot(p, id);
    } finally {
      delete this.toast;
      this._gPlanting = false;
    }
    if (!ok || !p.crop) {
      for (const [t, tone] of captured) this.toast(t, tone);
      return ok;
    }
    const feed = cropInfo(p.crop).soil === "feed",
      rot = lastCrop && lastCrop !== p.crop ? 1 : lastCrop === p.crop && !feed ? -1 : 0;
    this.g.plots[p.id] = {
      ...newRec(this.s.day, p.crop),
      c: CARE.base,
      cv: rec?.cv || 0,
      rot,
    };
    this.g.stats.planted++;
    for (const [t, tone] of captured) if (!/^已播种|^肥力 /.test(t)) this.toast(t, tone);
    this.toast(this.plantLine(p, crop), "normal");
    return ok;
  }
  plantLine(p, crop) {
    const b = this.buffsFor(p),
      got = BUFF_IDS.filter((k) => b[k]).map((k) => BUFFS[k].name),
      rec = this.g.plots[p.id];
    return (
      "种下" +
      cropName(crop) +
      " · 照料分 " +
      this.careScore(p) +
      " · 肥力 " +
      Math.round(p.fertility ?? 65) +
      (rec?.rot === 1 ? " · 换茬 +10" : rec?.rot === -1 ? " · 连作少收 1 份" : "") +
      (got.length ? " · 邻居给：" + got.join("、") : "")
    );
  }
  // 田边选种：背包里的种子，也能直接从仓库里拿
  seedOptions(p) {
    const ids = new Set([...Object.keys(this.s.inventory || {}), ...Object.keys(this.s.storage || {})]);
    const out = [];
    for (const id of ids) {
      const it = ITEMS[id];
      if (it?.type !== "seed" || !CROPS[it.crop]) continue;
      const bag = this.s.inventory?.[id] || 0,
        box = this.s.region === "farm" ? this.s.storage?.[id] || 0 : 0;
      if (bag + box < 1) continue;
      out.push({ id, crop: it.crop, bag, box, trait: it.trait || null });
    }
    const cur = this.s.seed;
    return out.sort((a, b) => (b.id === cur) - (a.id === cur) || CROPS[a.crop].grow - CROPS[b.crop].grow || a.id.localeCompare(b.id)).slice(0, 9);
  }
  pickReason(p) {
    if (!p) return "这块田不在这里";
    if (!p.tilled) return "先开垦";
    if (this.plotDebris(p)) return "先清理杂物";
    if (p.crop) return "已经种了" + cropName(p.crop);
    if (this.g.plots[p.id]?.w) return "地里有草，先拔草";
    return "";
  }
  plantSeed(plotId, seedId) {
    const p = this.plotById(plotId),
      why = this.pickReason(p);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    if (ITEMS[seedId]?.type !== "seed") return false;
    if (!(this.s.inventory?.[seedId] > 0)) {
      if (!(this.s.region === "farm" && this.s.storage?.[seedId] > 0)) {
        this.toast("没有这种种子了。", "warn");
        return false;
      }
      if (this.canAdd && !this.canAdd({ [seedId]: 1 })) {
        this.toast("背包满了，腾一格再从仓库拿种子。", "warn");
        return false;
      }
      this.s.storage[seedId]--;
      if (!this.s.storage[seedId]) delete this.s.storage[seedId];
      this.s.inventory[seedId] = (this.s.inventory[seedId] || 0) + 1;
    }
    const ok = this.fromMenu(() => this.toolPlot(p, seedId));
    if (ok) this.s.seed = seedId;
    return ok;
  }
  // 菜单开着时世界是暂停的；从这块田的页面里点按钮，相当于人就站在田边做
  fromMenu(fn) {
    const was = this.paused;
    this.paused = false;
    try {
      return fn();
    } finally {
      this.paused = was;
    }
  }
  waterFromCard(p) {
    if (!p?.crop) return false;
    return this.fromMenu(() => this.toolPlot(p, "water"));
  }

  // ================= 照看、拔草、捉虫、盖布、草料肥田 =================
  tend(p) {
    if (!this.g || !p?.crop || !this.isFarmPlot(p)) return false;
    const rec = this.gRec(p);
    if (rec.t === this.s.day) {
      this.toast("今天已经照看过这块田了。");
      return false;
    }
    rec.t = this.s.day;
    rec.c = clamp(rec.c + CARE.tend, 0, CARE.cap);
    this.s.player.stamina = Math.max(0, this.s.player.stamina - 1);
    this.g.stats.tended++;
    this.actionAnim = 0.25;
    this.particlesAt(p.x, p.y - 8, "#f2a7b5", 6);
    this.effects.push({ x: p.x, y: p.y - 30, text: "照料 +" + CARE.tend, t: 0.9, color: "#f6c1cb" });
    this.toast("照看了" + cropName(p.crop) + " · 照料分 " + this.careScore(p));
    this.emit("hoe");
    return true;
  }
  pullWeed(p) {
    const rec = this.g?.plots[p?.id];
    if (!rec?.w) return false;
    rec.w = 0;
    this.receive({ fodder: 1 });
    this.g.stats.weeds++;
    this.actionAnim = 0.25;
    this.particlesAt(p.x, p.y, "#8fbf5a", 8);
    this.effects.push({ x: p.x, y: p.y - 30, text: "草料 +1", t: 0.9, color: "#cfe7a6" });
    this.toast("拔掉了杂草 · 草料 +1");
    this.emit("hoe");
    return true;
  }
  catchBugs(p) {
    const rec = this.g?.plots[p?.id];
    if (!rec?.b) return false;
    const n = rec.b;
    rec.b = 0;
    this.receive({ grub: n });
    this.g.stats.bugs += n;
    this.actionAnim = 0.25;
    this.particlesAt(p.x, p.y - 8, "#c9e07a", 6);
    this.effects.push({ x: p.x, y: p.y - 30, text: "菜青虫 +" + n, t: 0.9, color: "#e4f0a8" });
    this.toast("捉掉了 " + n + " 只菜青虫：它们能当鱼饵。");
    this.emit("hoe");
    return true;
  }
  coverReason(p) {
    if (!p?.crop) return "空地不用盖";
    const rec = this.g.plots[p.id];
    if (rec && rec.cv >= this.s.day) return "已经盖上了";
    if (!this.afford({ cloth: COVER.cloth })) return "要 " + COVER.cloth + " 块布料";
    return "";
  }
  cover(p) {
    const why = this.coverReason(p);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    if (!this.spend({ cloth: COVER.cloth })) return false;
    this.gRec(p).cv = this.s.day + COVER.days - 1;
    this.g.stats.covered++;
    this.toast("给" + cropName(p.crop) + "盖上了布：今明两天不怕坏天气，乌鸦也啄不着。");
    return true;
  }
  fodderReason(p) {
    if (!p?.tilled) return "先开垦";
    if ((p.fertility ?? 65) >= 100) return "肥力已经满了";
    if (!this.afford({ fodder: FODDER_SOIL.fodder })) return "要 " + FODDER_SOIL.fodder + " 份草料";
    return "";
  }
  fodderSoil(p) {
    const why = this.fodderReason(p);
    if (why) {
      this.toast(why + "。", "warn");
      return false;
    }
    if (!this.spend({ fodder: FODDER_SOIL.fodder })) return false;
    p.fertility = clamp((p.fertility ?? 65) + FODDER_SOIL.fertility, 0, 100);
    this.toast("把 " + FODDER_SOIL.fodder + " 份草料埋进土里 · 肥力 " + Math.round(p.fertility));
    return true;
  }

  // ================= 收 =================
  update(dt, input) {
    super.update(dt, input);
    if (!this.paused && Number.isFinite(dt) && dt > 0) this.gClock += Math.min(0.25, dt);
  }
  harvest(p, worker = false) {
    if (!this.g || !p?.crop || !CROPS[p.crop] || p.growth < CROPS[p.crop].grow || !this.isFarmPlot(p)) return super.harvest(p, worker);
    const crop = p.crop,
      rec = this.gRec(p),
      score = this.careScore(p),
      fine = p.trait !== "hardy" && this.gRoll("fine:" + p.id + ":" + (rec.pd || 0) + ":" + crop) < this.fineChance(score),
      keep = { care: p.care, roll: p.qualityRoll },
      before = this.qty(crop) + this.qty("fine_" + crop) + this.qty("hardy_" + crop);
    p.care = 1;
    p.qualityRoll = fine ? -10 : 99;
    const ok = super.harvest(p, worker);
    if (!ok) {
      p.care = keep.care;
      p.qualityRoll = keep.roll;
      return false;
    }
    if (FEED_BACK[crop] && crop !== "bean") p.fertility = clamp((p.fertility ?? 65) + FEED_BACK[crop], 0, 100);
    if (rec.w || rec.cv >= this.s.day) this.g.plots[p.id] = { ...newRec(this.s.day, null), w: rec.w, cv: rec.cv };
    else delete this.g.plots[p.id];
    if (fine) this.g.stats.fine++;
    if (worker || !this._gHand) return true;
    // 连收：3 秒内收下一块，多给 1 份，最多 +3
    const now = this.gClock;
    this.gCombo = now - this.gLast <= COMBO.window ? Math.min(COMBO.max, this.gCombo + 1) : 0;
    this.gLast = now;
    if (this.gCombo) {
      this.receive({ [crop]: this.gCombo });
      this.g.stats.combos++;
    }
    const got = this.qty(crop) + this.qty("fine_" + crop) + this.qty("hardy_" + crop) - before;
    this.effects.push({ x: p.x, y: p.y - 34, text: cropName(crop) + " +" + Math.max(got, 1) + (fine ? " · 优质" : "") + (this.gCombo ? " · 连收 +" + this.gCombo : ""), t: 1.1, color: fine ? "#ffd76a" : "#eef3c4" });
    if (fine) this.particlesAt(p.x, p.y - 10, "#ffd76a", 16);
    return true;
  }

  // ================= 每天 =================
  wateredOn(p, d) {
    return p.wateredDay === d || ((p.trait === "hardy" || this.buffsFor(p).water) && p.wateredDay > 0 && p.wateredDay >= d - 1);
  }
  onNewDay() {
    if (this.g) this.gNight();
    super.onNewDay();
  }
  gNight() {
    const g = this.g,
      day = this.s.day,
      y = day - 1,
      weather = g.wx.day === y && g.wx.weather ? g.wx.weather : this.s.weather;
    for (const p of this.s.plots) {
      const rec = g.plots[p.id];
      if (!rec) continue;
      if (p.crop && rec.pd && rec.pd <= y) {
        const watered = this.wateredOn(p, y);
        if (watered && rec.wd !== y) rec.c += CARE.water;
        if (!watered) rec.c += CARE.dry;
        if (rec.t !== y) rec.c += CARE.idle;
        if (rec.w) rec.c += CARE.weed;
        rec.c += CARE.bug * rec.b;
        if (cropInfo(p.crop).hates === weather && !(rec.cv >= y)) rec.c += CARE.hated;
        rec.c = clamp(Math.round(rec.c), 0, CARE.cap);
      }
      if (rec.w) p.fertility = clamp((p.fertility ?? 65) - WEEDS.fertility, 0, 100);
    }
    if (day >= WEEDS.startDay) this.gWeeds(day);
    for (const [k, rec] of Object.entries(g.plots)) {
      const p = this.plotById(k);
      if (!p) delete g.plots[k];
      else if (!p.crop && !rec.w && !(rec.cv >= day)) delete g.plots[k];
    }
  }
  gWeeds(day) {
    const r = rng(mix(this.g.seed, day * 131 + 7)),
      plots = this.s.plots.filter((p) => p.tilled && !this.plotDebris(p));
    let grown = 0;
    const blocked = (q) => !!q.crop && this.buffsFor(q).weed;
    for (const p of plots) {
      const rec = this.g.plots[p.id];
      if (!rec?.w || day - rec.w < WEEDS.spreadAfter) continue;
      const near = this.adj(p).filter((q) => q.tilled && !this.plotDebris(q) && !this.g.plots[q.id]?.w && !blocked(q));
      if (!near.length) continue;
      this.gRec(near[Math.floor(r() * near.length)]).w = day;
      grown++;
    }
    for (const p of plots) {
      if (this.g.plots[p.id]?.w || blocked(p)) continue;
      if (r() < (p.crop ? WEEDS.crop : WEEDS.empty)) {
        this.gRec(p).w = day;
        grown++;
      }
    }
    if (grown) this.toast("夜里地里冒出 " + grown + " 处杂草：走过去按 E 拔掉，能得草料。");
  }
  workHour() {
    super.workHour();
    if (!this.g) return;
    const h = this.hour(),
      day = this.s.day;
    this.g.wx = { day, weather: String(this.s.weather || "").slice(0, 8) };
    // 下雨、雨水桶、灌溉、阿禾浇的水也算“今天喝到水”
    for (const p of this.s.plots) {
      if (!p.crop) continue;
      const rec = this.gRec(p);
      if (p.wateredDay === day && rec.wd !== day) {
        rec.wd = day;
        rec.c = clamp(rec.c + CARE.water, 0, CARE.cap);
      } else if (rec.wd === day && p.wateredDay !== day && !this.plotWatered(p)) {
        // 浇上的水又被别的规则收回了（比如水塔不管新开的田），照料分也收回
        rec.wd = 0;
        rec.c = clamp(rec.c - CARE.water, 0, CARE.cap);
      }
    }
    if (h >= 6 && this.g.bugDay !== day) this.gMorning();
    if (day >= HELPER.startDay && h >= HELPER.from && h <= HELPER.to) this.gHelper();
  }
  gMorning() {
    const g = this.g,
      day = this.s.day;
    g.bugDay = day;
    const crops = this.s.plots.filter((p) => p.crop && CROPS[p.crop]),
      r = rng(mix(g.seed, day * 977 + 3));
    if (day >= BUGS.startDay && crops.length) {
      const growing = crops.filter((p) => p.growth < CROPS[p.crop].grow);
      const n = growing.length ? 1 + Math.floor(r() * Math.min(BUGS.max, BUGS.perTen + Math.floor(crops.length / 10))) : 0;
      let put = 0;
      for (let i = 0; i < n; i++) {
        const p = growing[Math.floor(r() * growing.length)],
          rec = this.gRec(p);
        if (rec.b < BUGS.max) {
          rec.b++;
          put++;
        }
      }
      if (put) this.toast("清晨菜叶上爬来了 " + put + " 只菜青虫：它们会让作物长得慢，走过去按 E 捉掉。", "warn");
    }
    if (crops.length >= CROWS.crops) {
      const scare = this.s.buildings.filter((b) => b.type === "scarecrow" && b.hp > 0);
      let pecked = 0;
      for (const p of crops) {
        if (p.growth < CROPS[p.crop].grow) continue;
        const rec = this.gRec(p);
        if (rec.cv >= day || rec.pk >= CROWS.maxPeck || scare.some((b) => dist(b, p) <= CROWS.radius)) continue;
        if (r() < CROWS.chance) {
          rec.pk++;
          pecked++;
        }
      }
      if (pecked) {
        g.stats.pecked += pecked;
        this.toast("乌鸦啄了 " + pecked + " 块熟了的菜（每块少收 1 份）。熟了早点收，或者立个稻草人。", "warn");
      }
    }
  }
  gHelper() {
    const farmer = this.resident?.("farmer");
    if (!farmer || (this.residentActive && !this.residentActive(farmer))) return;
    const day = this.s.day,
      list = this.s.plots.filter((p) => p.crop && this.gRec(p).t !== day).sort((a, b) => this.careScore(a) - this.careScore(b));
    for (const p of list.slice(0, HELPER.perHour)) {
      const rec = this.gRec(p);
      rec.t = day;
      rec.c = clamp(rec.c + CARE.tend, 0, CARE.cap);
      this.g.stats.helped++;
    }
  }

  // ================= 草料喂鸡、菜青虫当鱼饵 =================
  feedAnimals() {
    const a = this.c?.animals;
    if (!this.g || !a || this.s.region !== "farm" || !this.hasBuilding?.("coop") || !a.chicken || a.feedDay === this.s.day) return super.feedAnimals();
    const corn = a.goat ? 3 : 1;
    if (this.afford({ corn }) || !this.afford({ fodder: FODDER_FEED * corn })) return super.feedAnimals();
    if (!this.spend({ fodder: FODDER_FEED * corn })) return false;
    a.feedDay = this.s.day;
    a.remaining = 240;
    this.g.stats.fed++;
    this.toast("用 " + FODDER_FEED * corn + " 份草料喂了动物 · 4 游戏小时后产出。");
    return true;
  }
  startFishing(bait = false) {
    if (!bait || !this.g || this.afford({ bean: 1 }) || !this.afford({ grub: 1 })) return super.startFishing(bait);
    if (!this.spend({ grub: 1 })) return super.startFishing(bait);
    this.s.inventory.bean = (this.s.inventory.bean || 0) + 1;
    const ok = super.startFishing(true);
    if (!ok) {
      this.s.inventory.bean--;
      if (!this.s.inventory.bean) delete this.s.inventory.bean;
      this.receive({ grub: 1 });
    } else this.toast("用 1 只菜青虫当鱼饵。");
    return ok;
  }

  // ================= 场景：E、提示、告示牌 =================
  assignRegion() {
    super.assignRegion();
    const board = this.objects?.find((o) => o.type === "frontierBoard");
    if (board) board.name = "菜地告示牌";
  }
  // 自己动手收：只有这样才算连收
  handHarvest(p) {
    this._gHand = true;
    try {
      return this.harvest(p);
    } finally {
      this._gHand = false;
    }
  }
  plotAction(p) {
    const rec = this.g.plots[p.id];
    if (p.crop && p.growth >= CROPS[p.crop].grow) return this.handHarvest(p);
    if (rec?.w) return this.pullWeed(p);
    if (rec?.b) return this.catchBugs(p);
    if (this.plotDebris(p) || !p.tilled) return this.toolPlot(p, "hoe");
    if (p.crop) {
      const need = TRAITS[p.trait]?.water || 1;
      if (!this.plotWatered(p) && (this.c?.water ?? need) >= need) return this.toolPlot(p, "water");
      if (rec?.t !== this.s.day) return this.tend(p);
      this.emit("menu", { menu: "outpost", view: "gPlot", id: String(p.id) });
      return true;
    }
    this.emit("menu", { menu: "outpost", view: "gPick", id: String(p.id) });
    return true;
  }
  interact() {
    if (this.paused) return;
    if (!this.g || this.s.region !== "farm" || this.c?.fishing) return super.interact();
    if (this.f?.crouch && this.hasTalent?.("pickpocket") && this.targetNear?.()) return super.interact();
    const o = this.nearestObject();
    if (o?.type === "plot" && this.isFarmPlot(o.plot)) return this.plotAction(o.plot);
    if (o?.type === "frontierBoard") {
      this.emit("menu", { menu: "outpost", view: "gBoard", id: "" });
      return true;
    }
    return super.interact();
  }
  context(o) {
    if (this.g && this.s.region === "farm" && !this.paused && !this.c?.fishing && !(this.f?.crouch && this.hasTalent?.("pickpocket") && this.targetNear?.())) {
      if (o?.type === "frontierBoard") return "菜地告示牌 · 看看今天的菜地";
      if (o?.type === "plot" && this.isFarmPlot(o.plot)) return this.plotContext(o.plot);
    }
    return super.context(o);
  }
  plotContext(p) {
    const rec = this.g.plots[p.id],
      name = p.crop ? cropName(p.crop) : "";
    if (p.crop && p.growth >= CROPS[p.crop].grow) return "收获 " + name + " · 照料分 " + this.careScore(p);
    if (rec?.w) return "拔草" + (name ? " · " + name : "");
    if (rec?.b) return "捉虫 ×" + rec.b + " · " + name;
    if (this.plotDebris(p)) return "清理杂物";
    if (!p.tilled) return "开垦土地";
    if (p.crop) {
      const need = TRAITS[p.trait]?.water || 1;
      const dry = !this.plotWatered(p),
        empty = (this.c?.water ?? need) < need;
      if (dry && !empty) return "给" + name + "浇水";
      if (rec?.t !== this.s.day) return "照看" + name + " · 照料分 " + this.careScore(p) + (dry ? " · 浇水壶没水了" : "");
      if (dry) return "浇水壶没水了 · 去水井补满";
      return "查看" + name + " · 照料分 " + this.careScore(p) + " · 还要约 " + this.hoursLeft(p) + " 游戏小时";
    }
    return "选种 · 这块空地";
  }
  hoursLeft(p) {
    if (!p?.crop) return 0;
    const left = Math.max(0, CROPS[p.crop].grow - p.growth),
      rate = Math.max(0.05, (TRAITS[p.trait]?.growth || 1) * this.weatherRate(p) * this.cropGrowthRate(p));
    return Math.max(1, Math.ceil(left / rate / 60));
  }
  // 在这块地种下某种种子，大约要多少游戏小时（按今天的天气、浇了水算）
  growHours(p, crop, trait = null) {
    const fake = { ...p, id: -1, crop, trait, growth: 0, region: "garden-preview" };
    let rate = (TRAITS[trait]?.growth || 1) * this.weatherRate(fake) * super.cropGrowthRate(fake);
    if (this.s.day <= EARLY.days) rate *= EARLY.boost;
    if (cropInfo(crop).likes === this.s.weather) rate *= LIKED;
    return Math.max(1, Math.ceil(CROPS[crop].grow / Math.max(0.05, rate) / 60));
  }
  // 旧的任务标记“重建计划板”现在是菜地告示牌：改个名，告示牌上也能直接打开任务手记
  taskDestination(id) {
    const d = super.taskDestination(id);
    return d && d.label === "重建计划板" ? { ...d, label: "菜地告示牌（在这里打开任务手记）" } : d;
  }
  // 告示牌上的“今天的菜地”
  gSummary() {
    const day = this.s.day,
      crops = this.s.plots.filter((p) => p.crop && CROPS[p.crop]),
      ripe = crops.filter((p) => p.growth >= CROPS[p.crop].grow),
      scare = this.s.buildings.filter((b) => b.type === "scarecrow" && b.hp > 0);
    const rec = (p) => this.g.plots[p.id];
    return {
      crops: crops.length,
      ripe: ripe.length,
      thirsty: crops.filter((p) => !this.plotWatered(p)).length,
      untended: crops.filter((p) => rec(p)?.t !== day).length,
      weeds: this.s.plots.filter((p) => rec(p)?.w).length,
      bugs: crops.reduce((n, p) => n + (rec(p)?.b || 0), 0),
      covered: crops.filter((p) => rec(p)?.cv >= day).length,
      empty: this.s.plots.filter((p) => p.tilled && !p.crop && !this.plotDebris(p)).length,
      scarecrows: scare.length,
      crowRisk: crops.length >= CROWS.crops ? ripe.filter((p) => !(rec(p)?.cv >= day) && !scare.some((b) => dist(b, p) <= CROWS.radius)).length : 0,
      fineReady: ripe.filter((p) => this.careScore(p) >= CARE.fine).length,
    };
  }

  // ================= 存档 =================
  static parse(text) {
    const raw = JSON.parse(text),
      s = ThiefEngine.parse(text);
    if (raw.garden !== undefined) validateGarden(raw.garden);
    return migrateState(s);
  }
}

function validateGarden(x) {
  const object = (v) => v && typeof v === "object" && !Array.isArray(v),
    int = (v, min = 0, max = 1e7) => Number.isInteger(v) && v >= min && v <= max,
    bad = () => {
      throw Error("菜地存档异常，请从设置恢复有效备份；原存档会保留。");
    },
    d = gardenDefaults();
  if (!object(x) || x.schema !== GARDEN_SCHEMA || Object.keys(x).some((k) => !Object.hasOwn(d, k))) bad();
  if (x.seed !== undefined && !int(x.seed, 0, 0xffffffff)) bad();
  if (x.bugDay !== undefined && !int(x.bugDay)) bad();
  if (x.wx !== undefined && (!object(x.wx) || Object.keys(x.wx).some((k) => !["day", "weather"].includes(k)) || !int(x.wx.day ?? 0) || typeof (x.wx.weather ?? "") !== "string" || (x.wx.weather || "").length > 8)) bad();
  if (x.stats !== undefined && (!object(x.stats) || Object.entries(x.stats).some(([k, v]) => !STAT_KEYS.includes(k) || !int(v, 0, 1e9)))) bad();
  if (x.plots !== undefined) {
    if (!object(x.plots) || Object.keys(x.plots).length > 2000) bad();
    for (const [k, r] of Object.entries(x.plots)) {
      if (!/^\d{1,9}$/.test(k) || !object(r) || Object.keys(r).some((f) => !REC_KEYS.includes(f))) bad();
      if (!(Number.isFinite(r.c) && r.c >= 0 && r.c <= 100)) bad();
      for (const f of ["pd", "t", "wd", "w", "cv"]) if (r[f] !== undefined && !int(r[f])) bad();
      if (r.b !== undefined && !int(r.b, 0, BUGS.max)) bad();
      if (r.pk !== undefined && !int(r.pk, 0, CROWS.maxPeck)) bad();
      if (r.rot !== undefined && ![-1, 0, 1].includes(r.rot)) bad();
    }
  }
}
