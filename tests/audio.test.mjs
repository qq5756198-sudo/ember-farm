// v0.23.0「回响」：声音。合成的数都能算出来、事件都有声音、15 张图都有环境声；声音调度在假的浏览器声音环境里跑一遍。
import test from "node:test";
import assert from "node:assert/strict";
import { renderSound, renderLoop, rms } from "../dist/audio-synth.js";
import { SFX, INSTRUMENTS, PIECES, STINGERS, BEDS, AMBIENCE, REGION_AMBIENCE, SURFACE, INDOOR, soundFor, voiceFor, SOUND_EVENTS, SPACE, MUSIC } from "../dist/audio-data.js";
import { AudioDirector } from "../dist/audio.js";
import { Engine, freshState } from "../dist/campaign.js";
import { REGIONS } from "../dist/data.js";

// ---------- 假的浏览器声音环境：记下建了哪些节点、播了什么 ----------
class Param {
  constructor(v = 1) {
    this.value = v;
  }
  setValueAtTime(v) {
    this.value = v;
  }
  linearRampToValueAtTime(v) {
    this.value = v;
  }
  cancelScheduledValues() {}
}
class Node {
  constructor(ctx, kind) {
    this.ctx = ctx;
    this.kind = kind;
    this.out = [];
  }
  connect(n) {
    this.out.push(n);
    return n;
  }
  disconnect() {
    this.out = [];
  }
}
class FakeContext {
  constructor() {
    this.currentTime = 0;
    this.state = "running";
    this.destination = new Node(this, "dest");
    this.played = [];
    this.made = 0;
  }
  createGain() {
    this.made++;
    const n = new Node(this, "gain");
    n.gain = new Param(1);
    return n;
  }
  createStereoPanner() {
    this.made++;
    const n = new Node(this, "pan");
    n.pan = new Param(0);
    return n;
  }
  createBiquadFilter() {
    this.made++;
    const n = new Node(this, "filter");
    n.frequency = new Param(1000);
    return n;
  }
  createDynamicsCompressor() {
    const n = new Node(this, "comp");
    for (const k of ["threshold", "knee", "ratio", "attack", "release"]) n[k] = new Param(0);
    return n;
  }
  createBuffer(ch, len, sr) {
    const data = new Float32Array(len);
    return { length: len, sampleRate: sr, duration: len / sr, copyToChannel: (d) => data.set(d), getChannelData: () => data };
  }
  createBufferSource() {
    this.made++;
    const n = new Node(this, "src"),
      ctx = this;
    n.playbackRate = new Param(1);
    n.start = (when = 0) => {
      ctx.played.push({ buffer: n.buffer, when, rate: n.playbackRate.value, node: n });
    };
    n.stop = () => n.onended?.();
    return n;
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
}
const director = () => {
  globalThis.AudioContext = FakeContext;
  const a = new AudioDirector();
  a.renderAll();
  a.unlock();
  return a;
};
const make = (state = freshState()) => {
  const e = new Engine(state, () => {});
  e.paused = false;
  return e;
};

test("every sound, instrument and ambience bed renders to finite samples without clipping", () => {
  for (const [id, def] of Object.entries(SFX)) {
    const b = renderSound(def, def.sr || 44100, 3);
    assert.ok(b.length > 100, id + " is too short");
    let peak = 0;
    for (const v of b) {
      assert.ok(Number.isFinite(v), id + " has a bad sample");
      peak = Math.max(peak, Math.abs(v));
    }
    assert.ok(peak <= 1.0001 && peak > 0.05, id + " peak " + peak);
    assert.ok(b.length / (def.sr || 44100) < 3.6, id + " is too long");
  }
  for (const [id, def] of Object.entries(INSTRUMENTS)) {
    const b = renderSound(def, def.sr || 44100, 3);
    assert.ok(b.every(Number.isFinite), id);
    assert.ok(rms(b) > 0.005, id + " is silent");
  }
  for (const [id, def] of Object.entries(BEDS)) {
    const b = renderLoop(def, 22050, 3);
    assert.ok(b.every(Number.isFinite), id);
    assert.ok(rms(b) > 0.01, id + " bed is silent");
    // 循环接头不跳：结尾和开头差得不多
    assert.ok(Math.abs(b[0] - b[b.length - 1]) < 0.35, id + " loop seam");
  }
});

test("about eighty sounds: every engine event has a sound and enemy voices exist for every infected", () => {
  const sounds = Object.keys(SFX).length;
  assert.ok(sounds >= 80, "sounds: " + sounds);
  for (const type of SOUND_EVENTS) {
    const m = soundFor({ type, kind: "blunt", weapon: "rifle", z: "runner" });
    assert.ok(m, type + " has no sound");
    if (m.sfx) assert.ok(SFX[m.sfx], type + " → " + m.sfx);
    if (m.stinger) assert.ok(STINGERS[m.stinger], type + " → " + m.stinger);
  }
  for (const kind of ["blunt", "blade", "pole", "heavy", "throw", "slingshot", "crossbow", "trap", "tool", "gun"]) assert.ok(SFX[soundFor({ type: "swing", kind }).sfx], kind);
  for (const w of ["pistol", "shotgun", "rifle"]) assert.equal(soundFor({ type: "shot", weapon: w }).sfx, "shot_" + w);
  for (const t of ["slow", "runner", "screamer", "armor", "elite"]) for (const k of ["idle", "spot", "attack"]) assert.ok(SFX[voiceFor(t, k)], t + " " + k);
  // 预兆音都会压低音乐
  for (const t of ["hiss", "stomp", "inhale", "grabCue", "reach", "scream"]) assert.equal(soundFor({ type: t }).duck, true, t);
  assert.equal(soundFor({ type: "menu" }), null);
});

test("ten ambience sets cover all fifteen maps; music has six pieces and six short phrases", () => {
  assert.equal(Object.keys(AMBIENCE).length, 10);
  for (const id of Object.keys(REGIONS)) {
    assert.ok(AMBIENCE[REGION_AMBIENCE[id]], id + " has no ambience");
    assert.ok(["dirt", "stone", "wood", "metal", "snow"].includes(SURFACE[id]), id + " has no floor");
  }
  for (const [id, a] of Object.entries(AMBIENCE)) {
    assert.ok(BEDS[a.bed], id);
    if (a.night) assert.ok(BEDS[a.night], id);
    for (const [s, lo, hi] of [...(a.day || []), ...(a.nightEvents || [])]) {
      assert.ok(SFX[s], id + " → " + s);
      assert.ok(lo > 0 && hi >= lo);
    }
  }
  // v0.31：地铁隧道也在地下（没有天气声）
  assert.deepEqual(INDOOR, ["shelter", "tunnel"]);
  // 6 段，加上 v0.29 农场白天按时节换的三段
  assert.equal(Object.keys(PIECES).length, 9);
  for (const k of ["heat", "harvest", "cold"]) assert.ok(PIECES["farmDay_" + k], k);
  for (const [id, p] of Object.entries(PIECES)) {
    const secs = (p.chords.length * 4 * 60) / p.bpm;
    assert.ok(secs >= 30 && secs <= 90, id + " loops every " + secs.toFixed(1) + "s");
    for (const pat of [p.base?.bass, p.base?.arp?.pat, p.drums?.kick, p.drums?.snare, p.drums?.hat, p.drums?.tom].filter(Boolean)) assert.equal(pat.length, 16, id);
    for (const inst of [p.base?.arp?.inst, p.lead?.inst].filter(Boolean)) assert.ok(INSTRUMENTS[inst], id + " " + inst);
  }
  // v0.32「手感」多三句：交满一面墙、第一次钓到的鱼、第一份收成
  assert.deepEqual(Object.keys(STINGERS).sort(), ["actDone", "boss", "discover", "downed", "firstHarvest", "hordeWarn", "newFish", "victory", "wallOpen"]);
  for (const list of Object.values(STINGERS)) for (const [, inst] of list) assert.ok(INSTRUMENTS[inst]);
});

test("rendering everything stays cheap and runs in small slices, even the long ambience beds; nothing is rendered when the browser can't play sound", () => {
  globalThis.AudioContext = undefined;
  // 浏览器放不了声音：一个都不算
  const none = new AudioDirector();
  assert.equal(none.ready, true);
  assert.equal(none.pump(4), 0);
  assert.equal(none.stats().sounds, 0);
  // 测试里照样算一遍（o.render）
  const a = new AudioDirector({ render: true });
  let frames = 0;
  while (!a.ready && frames < 4000) {
    a.pump(4);
    frames++;
  }
  assert.ok(a.ready, "all sounds rendered");
  assert.ok(frames > 20, "the work is spread over many frames, not one long stall");
  // 一个长的环境声底以前一口气要算 30–40 毫秒；现在分段算，一帧里最多超出预算一点点
  assert.ok(a.longestPump < 20, "one slice took " + a.longestPump.toFixed(1) + " ms");
  // 浏览器里目标是 1 秒以内；这里留出测试机的余量
  assert.ok(a.renderMs < 2500, "render took " + Math.round(a.renderMs) + " ms");
  assert.equal(a.stats().sounds, Object.keys(SFX).length + Object.keys(INSTRUMENTS).length + Object.keys(BEDS).length);
  // 没有浏览器声音时，打开声音只是不响，不出错
  assert.equal(a.unlock(), false);
  a.event({ type: "hit" }, make(), null);
  a.frame(make(), 0.016, {});
});

test("after the first click the rendered samples move into the browser's buffers and the copies are dropped", () => {
  globalThis.AudioContext = FakeContext;
  const a = new AudioDirector();
  for (let i = 0; i < 25; i++) a.pump(4);
  assert.ok(a.pcm.size > 0, "some sounds are ready before the first click");
  assert.equal(a.buffers.size, 0, "no buffers before the sound is switched on");
  assert.equal(a.unlock(), "new");
  assert.equal(a.unlock(), true, "the second time it is already on");
  let guard = 0;
  while ((!a.ready || a.pcm.size) && guard++ < 4000) a.pump(4);
  assert.equal(a.pcm.size, 0, "no second copy kept");
  assert.equal(a.buffers.size, Object.keys(SFX).length + Object.keys(INSTRUMENTS).length + Object.keys(BEDS).length);
  // 音量：数没变就不重新渐变
  assert.equal(a.setVolumes({ master: a.vol.master, music: a.vol.music }), false);
  assert.equal(a.setVolumes({ music: 0.33 }), true);
});

test("sounds are placed left/right by position, fade with distance and are muffled behind walls", () => {
  const a = director(),
    e = make();
  e.travel("residential");
  e.paused = false;
  const p = e.s.player,
    view = { cx: p.x, cy: p.y, hw: 500 };
  const near = a.spatial({ x: p.x + 300, y: p.y }, e, view),
    left = a.spatial({ x: p.x - 300, y: p.y }, e, view),
    far = a.spatial({ x: p.x + 800, y: p.y }, e, view),
    self = a.spatial({ x: p.x, y: p.y }, e, view);
  assert.ok(near.pan > 0 && left.pan < 0, "right is right, left is left");
  assert.ok(near.vol < self.vol && near.vol > 0, "farther is quieter");
  assert.equal(far, null, "beyond 700 you hear nothing");
  assert.equal(self.vol, 1);
  // 墙：找一个被挡住的点
  const blocked = [
    [200, 0],
    [0, 200],
    [-200, 0],
    [0, -200],
    [300, 300],
    [-300, -300],
  ]
    .map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy }))
    .find((q) => !e.lineClear(p, q));
  if (blocked) assert.equal(a.spatial(blocked, e, view).muffle, true);
});

test("at most eight infected voices at once, the same one not twice within 1.5 seconds", () => {
  const a = director(),
    e = make();
  e.travel("hospital");
  e.paused = false;
  const p = e.s.player;
  a.voices = 0;
  let played = a.ctx.played.length;
  for (let i = 0; i < 20; i++) a.event({ type: "spot", z: "slow", id: 1000 + i, x: p.x + 50, y: p.y }, e, null);
  assert.equal(a.ctx.played.length - played, SPACE.voices, "eight voices, the rest are skipped");
  // 一个结束，再来一个就能响
  a.ctx.played.at(-1).node.onended();
  played = a.ctx.played.length;
  a.event({ type: "spot", z: "slow", id: 2000, x: p.x + 50, y: p.y }, e, null);
  assert.equal(a.ctx.played.length - played, 1);
  // 同一只 1.5 秒内不重复
  for (const s of a.ctx.played.slice()) s.node.onended?.();
  played = a.ctx.played.length;
  a.event({ type: "windup", z: "runner", id: 7, x: p.x + 50, y: p.y }, e, null);
  a.event({ type: "windup", z: "runner", id: 7, x: p.x + 50, y: p.y }, e, null);
  assert.equal(a.ctx.played.length - played, 1);
  a.ctx.currentTime += 2;
  a.event({ type: "windup", z: "runner", id: 7, x: p.x + 50, y: p.y }, e, null);
  assert.equal(a.ctx.played.length - played, 2);
  // 记“谁刚叫过”的表不会越积越多
  assert.ok(a.voiceAt.size >= 9, "remembered: " + a.voiceAt.size);
  a.ctx.currentTime += 30;
  a.frame(e, 0.016, {});
  assert.ok(a.voiceAt.size <= 2, "old entries cleared: " + a.voiceAt.size);
});

test("music follows the situation: farm by day and night, outside, a fight, a siege; stingers and ducking", () => {
  const a = director(),
    e = make();
  const tick = (n = 5, info = {}) => {
    for (let i = 0; i < n; i++) {
      a.ctx.currentTime += 0.1;
      a.frame(e, 0.1, info);
    }
  };
  e.s.minute = 600;
  tick();
  assert.equal(a.piece, "farmDay");
  e.s.minute = 1300;
  tick();
  assert.equal(a.piece, "farmNight");
  e.s.minute = 600;
  e.travel("residential");
  e.paused = false;
  tick();
  assert.equal(a.piece, "explore");
  const z = e.enemies.find((x) => !x.dead);
  Object.assign(z, { x: e.s.player.x + 120, y: e.s.player.y, state: "chase" });
  tick(3);
  assert.equal(a.piece, "fight");
  // 追你的走了，6 秒后退回探索
  z.dead = true;
  tick(30);
  assert.equal(a.piece, "fight", "still fighting a moment after");
  tick(40);
  assert.equal(a.piece, "explore");
  e.travel("farm");
  e.s.horde.phase = "active";
  tick();
  assert.equal(a.piece, "siege");
  e.s.horde.phase = "won";
  // 音符真的排出去了
  const before = a.ctx.played.length;
  tick(10);
  assert.ok(a.ctx.played.length > before, "notes are scheduled");
  // 短乐句
  const n = a.ctx.played.length;
  a.event({ type: "victory" }, e, null);
  assert.equal(a.ctx.played.length - n, STINGERS.victory.length);
  // 预兆：音乐和环境声压低一半
  a.event({ type: "hiss", z: "runner", id: 9, x: e.s.player.x + 60, y: e.s.player.y }, e, null);
  a.applyDuck();
  assert.equal(a.buses.musicDuck.gain.value, MUSIC.duck);
  a.ctx.currentTime += 2;
  a.applyDuck();
  assert.equal(a.buses.musicDuck.gain.value, 1);
  // 菜单打开：只留音乐，压低；环境声和音效关掉
  a.setMenu(true);
  assert.equal(a.buses.musicDuck.gain.value, MUSIC.menu);
  assert.equal(a.buses.ambDuck.gain.value, 0);
  assert.equal(a.buses.sfxGate.gain.value, 0);
  a.setMenu(false);
  assert.equal(a.buses.sfxGate.gain.value, 1);
  // 切到后台：整个声音暂停
  a.setHidden(true);
  assert.equal(a.ctx.state, "suspended");
  const m = a.ctx.played.length;
  a.event({ type: "hit" }, e, null);
  assert.equal(a.ctx.played.length, m, "nothing plays while hidden");
  a.setHidden(false);
  assert.equal(a.ctx.state, "running");
});

test("four volumes reach their own lines; the interface follows the effects volume", () => {
  const a = director();
  a.setVolumes({ master: 0.5, music: 0.2, ambience: 0.4, sfx: 0.8 });
  assert.equal(a.buses.master.gain.value, 0.75);
  assert.ok(Math.abs(a.buses.music.gain.value - 0.2 * 0.36) < 1e-9);
  assert.ok(Math.abs(a.buses.amb.gain.value - 0.4 * 0.5) < 1e-9);
  assert.ok(Math.abs(a.buses.sfx.gain.value - 0.8 * 0.9) < 1e-9);
  assert.ok(Math.abs(a.buses.ui.gain.value - 0.8 * 0.55) < 1e-9);
  a.setVolumes({ music: 7, sfx: -1 });
  assert.equal(a.vol.music, 1);
  assert.equal(a.vol.sfx, 0);
});

test("ambience: each map gets its bed, night adds crickets on the farm, rain and snow layers, shelter has no weather", () => {
  const a = director(),
    e = make();
  const tick = () => {
    a.ctx.currentTime += 0.1;
    a.frame(e, 0.1, {});
  };
  e.s.minute = 600;
  tick();
  assert.equal(a.amb.set, "farm");
  assert.equal(a.amb.bed.id, "windSoft");
  assert.equal(a.amb.night, null);
  e.s.minute = 1300;
  tick();
  assert.equal(a.amb.night.id, "crickets");
  e.s.minute = 600;
  e.s.weather = "暴雨";
  tick();
  assert.equal(a.amb.weather.id, "rainHeavy");
  e.s.weather = "晴朗";
  for (const [region, set] of Object.entries(REGION_AMBIENCE)) {
    e.s.region = region;
    tick();
    assert.equal(a.amb.set, set, region);
  }
  e.s.region = "frost";
  tick();
  assert.equal(a.amb.weather.id, "snow");
  e.s.region = "shelter";
  e.s.weather = "暴雨";
  tick();
  assert.equal(a.amb.weather, null, "indoors, no rain");
  e.s.region = "farm";
  e.s.weather = "晴朗";
  // 零碎声会响
  const n = a.ctx.played.length;
  for (let i = 0; i < 300; i++) tick();
  assert.ok(a.ctx.played.length > n);
});

test("footsteps follow the floor and get louder in heavy gear; heartbeat under 30 health", () => {
  const a = director(),
    e = make();
  e.travel("warehouse");
  e.paused = false;
  e.walking = true;
  const ids = () => a.ctx.played.map((x) => [...a.buffers.entries()].find(([, b]) => b === x.buffer)?.[0]);
  for (let i = 0; i < 20; i++) {
    a.ctx.currentTime += 0.05;
    a.bodySounds(e, 0.05, {});
  }
  assert.ok(ids().includes("sfx:step_metal"), "metal floor in the warehouse");
  e.walking = false;
  e.s.player.hp = 20;
  for (let i = 0; i < 30; i++) a.bodySounds(e, 0.05, {});
  assert.ok(ids().includes("sfx:heartbeat"));
});
