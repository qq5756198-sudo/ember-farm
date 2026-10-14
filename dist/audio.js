// v0.23.0「回响」：声音的总调度。
// 采样在载入后分批算好（每帧最多几毫秒，一个长声音也分成几段算，标题页照样能点）；第一次点击或按键后才打开浏览器的声音（浏览器要求）。
// 声音打开以后，算好的采样搬进浏览器的缓冲区，原来那份就不留了（省一半内存）；浏览器根本放不了声音时一个都不算。
// 四条线：音乐、环境、音效（含感染者的嗓音）、界面；最后过一个压缩器，一起响时不破音。
// 音乐按“紧张程度”走：追你的有几只、刚挨了多少打、血还剩多少；脱离战斗 6 秒后退回探索音乐。
import { renderSoundSteps, renderLoopSteps, rng } from "./audio-synth.js";
import { SFX, INSTRUMENTS, PIECES, STINGERS, BEDS, AMBIENCE, REGION_AMBIENCE, INDOOR, SURFACE, soundFor, voiceFor, MIX, SPACE, MUSIC } from "./audio-data.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SAFE = ["farm", "market"];
// 先算常用的：界面、打击、脚步；再算乐器和环境声底；最后是零碎声
const FIRST = ["uiOpen", "uiClose", "uiDeny", "uiGold", "swing_blunt", "hitFlesh", "hurt", "step_dirt", "step_stone", "loot", "hoe", "plant", "water", "harvest", "craft"];

const clockNow = () => (globalThis.performance?.now ? performance.now() : Date.now());

export class AudioDirector {
  // o.render：没有浏览器声音也照样算（测试用）
  constructor(o = {}) {
    this.ctx = null;
    this.canPlay = !!(globalThis.AudioContext || globalThis.webkitAudioContext);
    this.pcm = new Map();
    this.buffers = new Map();
    this.jobs = [];
    this.cur = null;
    this.vol = { master: 0.35, music: 0.7, ambience: 0.7, sfx: 0.9 };
    this.hidden = false;
    this.menu = false;
    this.total = 0;
    this.voices = 0;
    this.voiceAt = new Map();
    this.duckUntil = 0;
    this.lastHurt = -99;
    this.lastCombat = -99;
    this.tension = 0;
    this.tracks = [];
    this.piece = null;
    this.amb = { set: null, bed: null, night: null, weather: null, next: {} };
    this.clock = { step: 0, heart: 0, fever: 0, idle: 1.5, chase: 2, heavy: 0, thunder: 8 };
    this.rand = rng(20231012);
    this.renderMs = 0;
    this.frameMs = 0;
    this.longestPump = 0;
    this._pruneAt = 0;
    if (this.canPlay || o.render) this.queueJobs();
  }
  // ---------- 采样：排队，分批算 ----------
  queueJobs() {
    const sfx = Object.keys(SFX),
      first = FIRST.filter((id) => SFX[id]),
      rest = sfx.filter((id) => !first.includes(id));
    for (const id of first) this.jobs.push({ id, kind: "sfx" });
    for (const id of Object.keys(INSTRUMENTS)) this.jobs.push({ id, kind: "inst" });
    for (const id of Object.keys(BEDS)) this.jobs.push({ id, kind: "bed" });
    for (const id of rest) this.jobs.push({ id, kind: "sfx" });
  }
  get ready() {
    return this.jobs.length === 0 && !this.cur;
  }
  // 开始算一个声音：拿到一个能分段往下算的“算法”，每次 next() 算一小段
  startJob(job) {
    const key = job.kind + ":" + job.id;
    if (job.kind === "sfx") {
      const def = SFX[job.id],
        sr = def.sr || 44100;
      return { key, sr, it: renderSoundSteps(def, sr, job.id.length * 31 + 7) };
    }
    if (job.kind === "inst") {
      const def = INSTRUMENTS[job.id],
        sr = def.sr || 44100;
      return { key, sr, it: renderSoundSteps(def, sr, job.id.length * 17 + 3) };
    }
    return { key, sr: 22050, it: renderLoopSteps(BEDS[job.id], 22050, job.id.length * 13 + 5) };
  }
  // 每帧最多算 budgetMs 毫秒；一个声音没算完，下一帧接着算
  pump(budgetMs = 4) {
    if (!this.jobs.length && !this.cur && !(this.ctx && this.pcm.size)) return 0;
    const start = clockNow();
    let n = 0;
    while (clockNow() - start < budgetMs) {
      if (!this.cur) {
        const job = this.jobs.shift();
        if (!job) break;
        this.cur = this.startJob(job);
      }
      const r = this.cur.it.next();
      if (r.done) {
        this.store(this.cur.key, r.value, this.cur.sr);
        this.cur = null;
        n++;
      }
    }
    // 声音已经打开：把还留着的采样搬进缓冲区
    if (this.ctx && this.pcm.size) {
      for (const key of this.pcm.keys()) {
        if (clockNow() - start >= budgetMs) break;
        this.buffer(key);
      }
    }
    const spent = clockNow() - start;
    this.renderMs += spent;
    this.longestPump = Math.max(this.longestPump, spent);
    return n;
  }
  // 全部算完（测试、或者想马上用时）
  renderAll() {
    while (this.jobs.length || this.cur) this.pump(1000);
  }
  // 算好的一段：声音开着就直接进缓冲区，不留原数组
  store(key, data, sr) {
    this.pcm.set(key, { data, sr });
    if (this.ctx) this.buffer(key);
  }
  buffer(key) {
    if (!this.ctx) return null;
    let b = this.buffers.get(key);
    if (b) return b;
    const p = this.pcm.get(key);
    if (!p) return null;
    try {
      b = this.ctx.createBuffer(1, p.data.length, p.sr);
      if (b.copyToChannel) b.copyToChannel(p.data, 0);
      else b.getChannelData(0).set(p.data);
    } catch {
      return null;
    }
    this.buffers.set(key, b);
    this.pcm.delete(key);
    return b;
  }

  // ---------- 打开声音：第一次点击或按键时 ----------
  // 返回 "new"：这次才打开；true：早就开着；false：这个浏览器放不了声音
  unlock() {
    const AC = globalThis.AudioContext || globalThis.webkitAudioContext;
    if (!AC) return false;
    if (this.ctx) {
      if (this.ctx.state === "suspended" && !this.hidden) this.ctx.resume?.().catch?.(() => {});
      return true;
    }
    // 构造时还没有（比如测试里后来才装上）：现在补上要算的
    if (!this.canPlay) {
      this.canPlay = true;
      if (!this.jobs.length && !this.cur && !this.pcm.size && !this.buffers.size) this.queueJobs();
    }
    try {
      this.ctx = new AC();
    } catch {
      this.ctx = null;
      return false;
    }
    const ctx = this.ctx,
      gain = (v = 1) => {
        const g = ctx.createGain();
        g.gain.value = v;
        return g;
      };
    const comp = ctx.createDynamicsCompressor ? ctx.createDynamicsCompressor() : null;
    if (comp) {
      comp.threshold.value = -16;
      comp.knee.value = 12;
      comp.ratio.value = 4;
      comp.attack.value = 0.004;
      comp.release.value = 0.2;
    }
    const master = gain(this.vol.master);
    if (comp) {
      master.connect(comp);
      comp.connect(ctx.destination);
    } else master.connect(ctx.destination);
    const musicDuck = gain(1),
      ambDuck = gain(1),
      sfxGate = gain(1);
    musicDuck.connect(master);
    ambDuck.connect(master);
    sfxGate.connect(master);
    this.buses = {
      master,
      comp,
      musicDuck,
      ambDuck,
      sfxGate,
      music: gain(),
      amb: gain(),
      sfx: gain(),
      voice: gain(),
      ui: gain(),
    };
    this.buses.music.connect(musicDuck);
    this.buses.amb.connect(ambDuck);
    this.buses.sfx.connect(sfxGate);
    this.buses.voice.connect(sfxGate);
    this.buses.ui.connect(master);
    this.applyVolumes(true);
    if (ctx.state === "suspended") ctx.resume?.().catch?.(() => {});
    return "new";
  }
  ramp(param, v, t = 0.15) {
    if (!param || !this.ctx) return;
    const now = this.ctx.currentTime;
    try {
      param.cancelScheduledValues?.(now);
      param.setValueAtTime?.(param.value, now);
      param.linearRampToValueAtTime?.(v, now + t);
    } catch {
      param.value = v;
    }
  }
  // 只有数变了才去调（每次按键都会来对一下，不能每次都重新渐变）
  setVolumes(v = {}) {
    let changed = false;
    for (const k of ["master", "music", "ambience", "sfx"]) {
      if (!Number.isFinite(v[k])) continue;
      const x = clamp(v[k], 0, 1);
      if (x !== this.vol[k]) {
        this.vol[k] = x;
        changed = true;
      }
    }
    if (changed) this.applyVolumes();
    return changed;
  }
  applyVolumes(now = false) {
    const b = this.buses;
    if (!b) return;
    const t = now ? 0.01 : 0.12;
    this.ramp(b.master.gain, this.vol.master * 1.5, t);
    this.ramp(b.music.gain, this.vol.music * MIX.music, t);
    this.ramp(b.amb.gain, this.vol.ambience * MIX.ambience, t);
    this.ramp(b.sfx.gain, this.vol.sfx * MIX.sfx, t);
    this.ramp(b.voice.gain, this.vol.sfx * MIX.voice, t);
    // 界面声跟着音效的音量
    this.ramp(b.ui.gain, this.vol.sfx * MIX.ui, t);
  }
  // 网页切到后台：静音（暂停整个声音）
  setHidden(hidden) {
    this.hidden = !!hidden;
    if (!this.ctx) return;
    try {
      if (hidden) this.ctx.suspend?.().catch?.(() => {});
      else this.ctx.resume?.().catch?.(() => {});
    } catch {}
  }
  // 菜单打开：只留音乐，并压低
  setMenu(open) {
    if (this.menu === !!open) return;
    this.menu = !!open;
    this.applyDuck(true);
  }
  applyDuck(force = false) {
    const b = this.buses;
    if (!b) return;
    const now = this.ctx.currentTime,
      ducking = now < this.duckUntil,
      key = (this.menu ? "m" : "w") + (ducking ? "d" : "");
    if (!force && key === this._duckKey) return;
    this._duckKey = key;
    const music = (this.menu ? MUSIC.menu : 1) * (ducking ? MUSIC.duck : 1);
    this.ramp(b.musicDuck.gain, music, 0.18);
    this.ramp(b.ambDuck.gain, this.menu ? 0 : ducking ? MUSIC.duck : 1, 0.18);
    this.ramp(b.sfxGate.gain, this.menu ? 0 : 1, 0.12);
  }

  // ---------- 播放 ----------
  // 音乐的音符和环境声的底不算在“同时最多几个音效”里（它们自己有数），免得把打击声挤掉
  play(id, o = {}) {
    if (!this.ctx || this.hidden) return null;
    const counted = !["inst", "bed"].includes(o.kind);
    if (counted && this.total >= SPACE.total) return null;
    const buf = this.buffer((o.kind || "sfx") + ":" + id);
    if (!buf) return null;
    const ctx = this.ctx;
    try {
      const src = ctx.createBufferSource();
      src.buffer = buf;
      if (o.rate && o.rate !== 1) src.playbackRate.value = o.rate;
      let node = src;
      const extra = [];
      if (o.muffle && ctx.createBiquadFilter) {
        const f = ctx.createBiquadFilter();
        f.type = "lowpass";
        f.frequency.value = SPACE.muffle;
        node.connect(f);
        node = f;
        extra.push(f);
      }
      if (o.pan && ctx.createStereoPanner) {
        const p = ctx.createStereoPanner();
        p.pan.value = clamp(o.pan, -1, 1);
        node.connect(p);
        node = p;
        extra.push(p);
      }
      const g = ctx.createGain();
      g.gain.value = clamp(o.vol ?? 1, 0, 2);
      node.connect(g);
      g.connect(o.bus || this.buses.sfx);
      if (o.loop) src.loop = true;
      src.start(o.when || 0);
      if (counted) this.total++;
      if (o.voice) this.voices++;
      src.onended = () => {
        if (counted) this.total = Math.max(0, this.total - 1);
        if (o.voice) this.voices = Math.max(0, this.voices - 1);
        try {
          g.disconnect();
          for (const x of extra) x.disconnect();
        } catch {}
      };
      return { src, gain: g };
    } catch {
      return null;
    }
  }
  // 远近、左右：按离镜头中心的位置；700 以外听不到；墙后面的闷一点
  spatial(ev, eng, view, range = SPACE.range) {
    if (!Number.isFinite(ev?.x) || !eng) return { vol: 1, pan: 0, muffle: false };
    const p = eng.s.player,
      d = Math.hypot(ev.x - p.x, ev.y - p.y);
    if (d > range) return null;
    const vol = d < 40 ? 1 : Math.pow(1 - d / range, 1.5),
      cx = view?.cx ?? p.x,
      hw = Math.max(240, view?.hw ?? 480),
      pan = clamp((ev.x - cx) / hw, -1, 1) * 0.85;
    let muffle = false;
    if (d > 70 && eng.lineClear) {
      try {
        muffle = !eng.lineClear(p, ev);
      } catch {
        muffle = false;
      }
    }
    return { vol, pan, muffle };
  }
  // 引擎事件
  event(ev, eng, view) {
    if (!ev) return;
    if (ev.type === "hit") this.lastHurt = this.ctx?.currentTime ?? 0;
    if (!this.ctx || this.hidden) return;
    const m = soundFor(ev);
    if (!m) return;
    if (m.stinger) this.stinger(m.stinger);
    if (!m.sfx) return;
    if (m.ui) {
      this.play(m.sfx, { bus: this.buses.ui });
      return;
    }
    const sp = this.spatial(ev, eng, view, m.range || SPACE.range);
    if (!sp) return;
    if (m.voice) {
      if (this.voices >= SPACE.voices) return;
      const key = ev.id ?? ev.z + ":" + Math.round(ev.x / 50) + ":" + Math.round(ev.y / 50),
        now = this.ctx.currentTime;
      if (!m.duck && now - (this.voiceAt.get(key) ?? -99) < SPACE.voiceGap) return;
      this.voiceAt.set(key, now);
    }
    const steady = ["shot_pistol", "shot_shotgun", "shot_rifle", "stomp", "inhale", "hiss", "fuse", "slamCue", "doorCue", "spitCue", "pulseCue", "breath", "click", "stalkerCue"].includes(m.sfx);
    this.play(m.sfx, { vol: sp.vol, pan: sp.pan, muffle: sp.muffle, voice: m.voice, bus: m.voice ? this.buses.voice : this.buses.sfx, rate: steady ? 1 : 0.94 + this.rand() * 0.12 });
    if (m.duck) this.duckUntil = this.ctx.currentTime + MUSIC.duckTime;
  }
  ui(kind) {
    if (!this.ctx || this.hidden) return;
    const id = { open: "uiOpen", close: "uiClose", deny: "uiDeny", gold: "uiGold" }[kind];
    if (id) this.play(id, { bus: this.buses.ui });
  }

  // ---------- 音乐 ----------
  stinger(id) {
    const list = STINGERS[id];
    if (!list || !this.ctx) return;
    const t0 = this.ctx.currentTime + 0.03;
    for (const [at, inst, note, vel] of list) this.note(inst, note, vel, t0 + at, this.buses.music);
  }
  note(inst, midi, vel, when, bus) {
    const def = INSTRUMENTS[inst];
    if (!def) return;
    const rate = def.base ? Math.pow(2, (midi - def.base) / 12) : 1;
    this.play(inst, { kind: "inst", rate, vol: vel, when, bus });
  }
  setPiece(id) {
    if (this.piece === id) return;
    this.piece = id;
    const ctx = this.ctx,
      now = ctx.currentTime;
    for (const t of this.tracks) {
      if (t.dying) continue;
      t.dying = now + MUSIC.fade;
      this.ramp(t.out.gain, 0, MUSIC.fade);
    }
    if (!id || !PIECES[id]) return;
    const def = PIECES[id],
      out = ctx.createGain(),
      layer = () => ctx.createGain();
    out.gain.value = 0;
    out.connect(this.buses.music);
    const g = { base: layer(), drums: layer(), lead: layer() };
    for (const k of Object.keys(g)) g[k].connect(out);
    g.drums.gain.value = def.layers.drums;
    g.lead.gain.value = def.layers.lead;
    const track = { id, def, out, g, next: now + 0.08, bar: 0, step: 0, loop: 0, rand: rng(id.length * 101 + 7), last: null, dying: 0 };
    this.tracks.push(track);
    this.ramp(out.gain, 1, MUSIC.fade);
  }
  scheduleTracks(until) {
    const now = this.ctx.currentTime;
    for (const t of this.tracks) {
      if (t.next < now - 0.5) t.next = now + 0.02;
      const stepDur = 60 / t.def.bpm / 4;
      while (t.next < until) {
        this.playStep(t, t.next, stepDur);
        t.next += stepDur;
        t.step++;
        if (t.step >= 16) {
          t.step = 0;
          t.bar++;
          if (t.bar >= t.def.chords.length) {
            t.bar = 0;
            t.loop++;
          }
        }
      }
    }
    this.tracks = this.tracks.filter((t) => {
      if (t.dying && now > t.dying + 0.3) {
        try {
          t.out.disconnect();
        } catch {}
        return false;
      }
      return true;
    });
  }
  playStep(t, when, stepDur) {
    const d = t.def,
      bar = t.bar,
      st = t.step,
      deg = d.chords[bar],
      scale = d.scale,
      note = (degree, oct = 0) => {
        const n = scale.length,
          k = ((degree % n) + n) % n,
          o = Math.floor(degree / n);
        return d.root + scale[k] + 12 * (o + oct);
      },
      // 一个音在音阶里是第几级（含八度），不在音阶上的取上面最近的一级
      toDegree = (m) => {
        const rel = m - d.root,
          o = Math.floor(rel / 12),
          pc = ((rel % 12) + 12) % 12;
        let k = scale.indexOf(pc);
        if (k < 0) k = Math.max(0, scale.findIndex((x) => x > pc));
        return k + o * scale.length;
      },
      triad = [note(deg), note(deg + 2), note(deg + 4)],
      hit = (pat, i = st) => !!pat && (pat[i] === "x" || pat[i] === "X"),
      B = d.base || {};
    // 底：和弦铺底 / 低音持续、贝斯、分解和弦
    if (st === 0 && B.pad) for (const n of triad) this.note("pad", n, B.pad, when, t.g.base);
    if (st === 0 && B.drone && bar % 2 === 0) this.note("drone", note(deg, -1), B.drone, when, t.g.base);
    if (hit(B.bass)) this.note("bass", note(deg, -1), B.bassVel ?? 0.5, when, t.g.base);
    if (B.arp && hit(B.arp.pat)) {
      const k = (t.arpI = (t.arpI || 0) + 1);
      const tones = [...triad, note(deg + 7)];
      this.note(B.arp.inst, tones[k % tones.length] + 12 * (B.arp.oct || 0), B.arp.vel, when, t.g.base);
    }
    // 鼓
    const D = d.drums;
    if (D && (!D.every || bar % D.every === D.every - 1)) {
      for (const inst of ["kick", "snare", "hat", "tom"]) if (hit(D[inst])) this.note(inst, inst === "tom" ? note(deg, -1) : 60, D.vel * (D[inst][st] === "X" ? 1.2 : 1) * (inst === "hat" ? 0.7 : 1), when, t.g.drums);
    }
    // 旋律：强拍落在和弦音上，中间按音阶走；每一圈随机不同
    const L = d.lead;
    if (L && st % 2 === 0) {
      const strong = st % 4 === 0,
        p = L.density * (strong ? 1.2 : 0.8);
      if (t.rand() < p) {
        let n;
        if (L.stab) n = triad[(st / 2) % 3] + 12 * (L.oct || 0);
        else {
          const base = t.last ?? note(deg + 2, L.oct || 0);
          if (strong) {
            const options = [...triad, triad[0] + 12].map((x) => x + 12 * (L.oct || 0));
            n = options.reduce((a, b) => (Math.abs(b - base) < Math.abs(a - base) ? b : a));
            if (t.rand() < 0.3) n = options[Math.floor(t.rand() * options.length)];
          } else {
            const step = [-2, -1, 1, 2][Math.floor(t.rand() * 4)];
            n = note(toDegree(base) + step);
          }
          const lo = d.root + 12 * (L.oct || 0) - 5,
            hi = d.root + 12 * (L.oct || 0) + 14;
          while (n < lo) n += 12;
          while (n > hi) n -= 12;
        }
        t.last = n;
        this.note(L.inst, n, L.vel * (strong ? 1 : 0.85), when, t.g.lead);
      }
    }
  }
  // 打仗的音乐：鼓和旋律跟着紧张程度叠上去
  applyTension() {
    for (const t of this.tracks) {
      if (t.dying || !["fight", "siege"].includes(t.id)) continue;
      const drums = clamp((this.tension - 0.15) / 0.25, 0, 1) * t.def.layers.drums,
        lead = clamp((this.tension - 0.45) / 0.25, 0, 1) * t.def.layers.lead;
      if (Math.abs((t._d ?? -1) - drums) > 0.05) {
        t._d = drums;
        this.ramp(t.g.drums.gain, drums, 0.6);
      }
      if (Math.abs((t._l ?? -1) - lead) > 0.05) {
        t._l = lead;
        this.ramp(t.g.lead.gain, lead, 0.6);
      }
    }
  }
  pickPiece(eng, info) {
    const s = eng.s;
    if (["warning", "active"].includes(s.horde?.phase) || (eng.raidState && ["warning", "active"].includes(eng.raidState().phase))) return "siege";
    if (this.combat) return "fight";
    if (info.scene || (s.region === "farm" && eng.festivalWindow?.())) return "scene";
    // v0.29：白天的那段按时节换（酷暑、秋收、寒潮各一段）
    if (SAFE.includes(s.region)) return eng.isNight?.() ? "farmNight" : PIECES[eng.seasonPiece?.("farmDay")] ? eng.seasonPiece("farmDay") : "farmDay";
    return "explore";
  }

  // ---------- 环境声 ----------
  setAmbience(eng) {
    const s = eng.s,
      set = REGION_AMBIENCE[s.region] || "farm",
      def = AMBIENCE[set],
      night = !!eng.isNight?.(),
      indoor = INDOOR.includes(s.region),
      w = s.weather,
      weather = indoor ? null : s.region === "frost" ? "snow" : w === "暴雨" ? "rainHeavy" : w === "小雨" || w === "酸雨" ? "rainLight" : null,
      nightBed = night && def.night ? def.night : null;
    const A = this.amb;
    const swap = (slot, id, vol) => {
      if (A[slot]?.id === id) return;
      if (A[slot]) {
        const old = A[slot];
        this.ramp(old.gain.gain, 0, MUSIC.fade);
        setTimeout(() => {
          try {
            old.src.stop();
          } catch {}
        }, MUSIC.fade * 1000 + 200);
        A[slot] = null;
      }
      if (!id) return;
      const h = this.play(id, { kind: "bed", loop: true, vol: 0, bus: this.buses.amb });
      if (!h) return;
      this.ramp(h.gain.gain, vol, MUSIC.fade);
      A[slot] = { id, ...h };
    };
    if (A.set !== set) {
      A.set = set;
      A.next = {};
    }
    swap("bed", def.bed, 1);
    swap("night", nightBed, 0.8);
    swap("weather", weather, weather === "rainHeavy" ? 1 : 0.8);
    // 零碎声
    const now = this.ctx.currentTime,
      list = (night && def.nightEvents) || def.day || [];
    for (const [id, lo, hi] of list) {
      const k = set + ":" + id;
      if (A.next[k] == null) A.next[k] = now + lo + this.rand() * (hi - lo);
      else if (now >= A.next[k]) {
        A.next[k] = now + lo + this.rand() * (hi - lo);
        this.play(id, { bus: this.buses.amb, pan: (this.rand() - 0.5) * 1.6, vol: 0.5 + this.rand() * 0.5, rate: 0.9 + this.rand() * 0.2 });
      }
    }
    if (weather === "rainHeavy") {
      this.clock.thunder -= this._dt || 0;
      if (this.clock.thunder <= 0) {
        this.clock.thunder = 10 + this.rand() * 18;
        this.play("thunder", { bus: this.buses.amb, pan: (this.rand() - 0.5) * 1.2, vol: 0.6 + this.rand() * 0.4 });
      }
    }
  }

  // ---------- 每帧 ----------
  // info: { menu, scene, run, view: { cx, cy, hw } }
  frame(eng, dt, info = {}) {
    const t0 = globalThis.performance?.now ? performance.now() : 0;
    this.pump(this.ctx ? 3 : 4);
    if (!this.ctx || !eng || this.hidden) return;
    this._dt = dt;
    this.setMenu(!!info.menu);
    const now = this.ctx.currentTime,
      s = eng.s,
      p = s.player;
    // 打仗没有：身边有追你的、刚挨了打
    let chasers = 0;
    if (!eng.paused) for (const z of eng.enemies || []) if (!z.dead && !z.nest && (z.state === "chase" || z.windup > 0) && Math.hypot(z.x - p.x, z.y - p.y) < 420) chasers++;
    // 记“谁刚叫过”的表：隔一会儿清掉早就不相干的
    if (now - this._pruneAt > 10) {
      this._pruneAt = now;
      for (const [k, at] of this.voiceAt) if (now - at > 6) this.voiceAt.delete(k);
    }
    if (chasers > 0 || now - this.lastHurt < 3) this.lastCombat = now;
    this.combat = now - this.lastCombat < MUSIC.calm;
    const maxHp = eng.maxHp?.() || 100,
      target = clamp(chasers * 0.16 + (now - this.lastHurt < 4 ? 0.25 : 0) + (1 - p.hp / maxHp) * 0.45, 0, 1);
    this.tension += (target - this.tension) * Math.min(1, dt * 2);
    this.setPiece(this.pickPiece(eng, info));
    this.applyTension();
    this.scheduleTracks(now + 0.25);
    this.applyDuck();
    if (!info.menu) {
      this.setAmbience(eng);
      if (!eng.paused) this.bodySounds(eng, dt, info);
    }
    this.frameMs = (globalThis.performance?.now ? performance.now() : 0) - t0;
  }
  // 脚步、心跳、发烧的粗喘、感染者闲晃时的低吼和重甲的脚步
  bodySounds(eng, dt, info) {
    const s = eng.s,
      p = s.player,
      c = this.clock,
      view = info.view;
    if (eng.walking && !eng.f?.crouch && !eng.dodging?.()) {
      c.step -= dt;
      if (c.step <= 0) {
        c.step = info.run ? 0.27 : 0.4;
        const tier = eng.armorTotals?.().tier?.id || "light";
        this.play("step_" + (SURFACE[s.region] || "dirt"), { vol: { light: 0.5, medium: 0.68, heavy: 0.85 }[tier] || 0.5, rate: 0.9 + this.rand() * 0.2 });
      }
    } else c.step = 0.05;
    if (p.hp < 30 && p.hp > 0) {
      c.heart -= dt;
      if (c.heart <= 0) {
        c.heart = p.hp < 15 ? 0.7 : 1;
        this.play("heartbeat", { vol: 0.8 });
      }
    }
    if (eng.gr?.fever) {
      c.fever -= dt;
      if (c.fever <= 0) {
        c.fever = 3.5;
        this.play("feverBreath", { vol: 0.6 });
      }
    }
    // 附近的感染者：只在要出声的那一帧才去数
    c.idle -= dt;
    c.chase -= dt;
    c.heavy -= dt;
    if (c.idle > 0 && c.chase > 0 && c.heavy > 0) return;
    // 躺着装死的不出声（只有它自己抽一下时那声喘气）
    const list = (eng.enemies || []).filter((z) => !z.dead && !z.nest && !z.lying && z.type !== "raider" && Math.hypot(z.x - p.x, z.y - p.y) < 600);
    if (c.idle <= 0) {
      c.idle = 1.2 + this.rand() * 2;
      const calm = list.filter((z) => z.state !== "chase");
      const z = calm[Math.floor(this.rand() * calm.length)];
      if (z) this.enemyVoice(z, "idle", eng, view, 4);
    }
    if (c.chase <= 0) {
      c.chase = 1.8 + this.rand() * 2;
      const hot = list.filter((z) => z.state === "chase" && !(z.windup > 0));
      const z = hot[Math.floor(this.rand() * hot.length)];
      if (z) this.enemyVoice(z, "attack", eng, view, 2.5);
    }
    if (c.heavy <= 0) {
      c.heavy = 0.55;
      const big = list.filter((z) => ["armor", "elite", "nurse"].includes(z.type) && z.state === "chase" && Math.hypot(z.x - p.x, z.y - p.y) < 420).slice(0, 2);
      for (const z of big) {
        const sp = this.spatial(z, eng, view);
        if (sp) this.play("step_heavy", { vol: sp.vol * 0.9, pan: sp.pan, muffle: sp.muffle });
      }
    }
  }
  enemyVoice(z, kind, eng, view, gap) {
    if (this.voices >= SPACE.voices) return;
    const now = this.ctx.currentTime,
      key = z.id ?? z;
    if (now - (this.voiceAt.get(key) ?? -99) < Math.max(gap, SPACE.voiceGap)) return;
    const sp = this.spatial(z, eng, view);
    if (!sp) return;
    this.voiceAt.set(key, now);
    this.play(voiceFor(z.type, kind), { vol: sp.vol * (kind === "idle" ? 0.7 : 0.9), pan: sp.pan, muffle: sp.muffle, voice: true, bus: this.buses.voice, rate: 0.9 + this.rand() * 0.2 });
  }
  stats() {
    return { ready: this.ready, jobs: this.jobs.length + (this.cur ? 1 : 0), sounds: this.pcm.size + this.buffers.size, waiting: this.pcm.size, renderMs: Math.round(this.renderMs), longestPump: Math.round(this.longestPump * 10) / 10, frameMs: Math.round(this.frameMs * 100) / 100, total: this.total, voices: this.voices, piece: this.piece, tension: Math.round(this.tension * 100) / 100, ambience: this.amb.set };
  }
}
