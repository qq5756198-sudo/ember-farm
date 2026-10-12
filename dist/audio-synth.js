// v0.23.0「回响」：用代码合成声音。每个声音是几层“振荡器 + 包络 + 滤波”，一次算成一段采样，玩的时候只播放。
// 不依赖浏览器，测试里也能直接算。

const TAU = Math.PI * 2;

// 可重复的随机数（同一个声音每次算出来一样）
export function rng(seed = 1) {
  let a = seed >>> 0 || 1;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 二阶滤波（RBJ）：低通、高通、带通
function biquad(type, freq, q, sr) {
  const w = (TAU * Math.min(freq, sr * 0.45)) / sr,
    cs = Math.cos(w),
    sn = Math.sin(w),
    alpha = sn / (2 * Math.max(0.1, q));
  let b0, b1, b2;
  if (type === "lp") {
    b0 = (1 - cs) / 2;
    b1 = 1 - cs;
    b2 = (1 - cs) / 2;
  } else if (type === "hp") {
    b0 = (1 + cs) / 2;
    b1 = -(1 + cs);
    b2 = (1 + cs) / 2;
  } else {
    b0 = alpha;
    b1 = 0;
    b2 = -alpha;
  }
  const a0 = 1 + alpha,
    a1 = -2 * cs,
    a2 = 1 - alpha;
  return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
}
function filterState() {
  return { x1: 0, x2: 0, y1: 0, y2: 0 };
}
function runFilter(c, st, x) {
  const y = c.b0 * x + c.b1 * st.x1 + c.b2 * st.x2 - c.a1 * st.y1 - c.a2 * st.y2;
  st.x2 = st.x1;
  st.x1 = x;
  st.y2 = st.y1;
  st.y1 = Number.isFinite(y) ? y : 0;
  return st.y1;
}
const lerpExp = (a, b, u) => (a > 0 && b > 0 ? a * Math.pow(b / a, u) : a + (b - a) * u);
const pair = (v) => (Array.isArray(v) ? v : [v, v]);

// 一层：
// w 波形 sine|tri|saw|square|noise|pink|brown；f 频率（[起, 止] 指数滑音）；t 长度；d 延后开始；
// a 起音；h 保持；c 衰减曲线（越大掉得越快）；v 音量；
// lp / hp 截止频率（可 [起, 止]）、bp [中心, Q]、q 共振；vib [速度, 深度]；am [速度, 深度]；duty 方波占空比；
// j 音高抖动（粗糙的嗓音）；rel 结尾淡出（秒）
// 一层分成两步：先算好这一层的常数和状态，再一段一段往下算（可以中途停下，下一帧接着算，结果完全一样）
function layerInit(L, out, sr) {
  const start = Math.round((L.d || 0) * sr),
    len = Math.min(out.length - start, Math.round((L.t || 0.1) * sr));
  if (len <= 0) return null;
  const [f0, f1] = pair(L.f ?? 440),
    T = len / sr,
    [lp0, lp1] = L.lp ? pair(L.lp) : [0, 0],
    [hp0, hp1] = L.hp ? pair(L.hp) : [0, 0],
    q = L.q ?? 0.707,
    // 截止频率不变时只算一次系数；扫频时每 32 个采样重算
    lpSweep = !!L.lp && lp0 !== lp1,
    hpSweep = !!L.hp && hp0 !== hp1;
  return {
    L,
    out,
    sr,
    start,
    len,
    f0,
    f1,
    a: Math.max(0.0015, L.a ?? 0.004),
    hold: L.h || 0,
    curve: L.c ?? 1.5,
    vol: L.v ?? 1,
    T,
    rel: Math.min(T * 0.5, L.rel ?? 0.01),
    w: L.w || "sine",
    duty: L.duty ?? 0.5,
    lp0,
    lp1,
    hp0,
    hp1,
    q,
    lpSweep,
    hpSweep,
    slide: f0 !== f1,
    lpC: L.lp && !lpSweep ? biquad("lp", lp0, q, sr) : null,
    hpC: L.hp && !hpSweep ? biquad("hp", hp0, 0.707, sr) : null,
    bpC: L.bp ? biquad("bp", L.bp[0], L.bp[1] ?? 4, sr) : null,
    lpSt: filterState(),
    lpSt2: filterState(),
    hpSt: filterState(),
    bpSt: filterState(),
    phase: 0,
    pink: [0, 0, 0, 0, 0, 0, 0],
    brown: 0,
    jit: 0,
  };
}
function layerRun(st, from, to, rand) {
  const { L, out, sr, start, len, f0, f1, a, hold, curve, vol, T, rel, w, duty, lp0, lp1, hp0, hp1, q, lpSweep, hpSweep, slide, bpC, lpSt, lpSt2, hpSt, bpSt, pink } = st;
  let { lpC, hpC, phase, brown, jit } = st;
  for (let i = from; i < to; i++) {
    const t = i / sr,
      u = i / len;
    if ((lpSweep || hpSweep) && i % 32 === 0) {
      if (lpSweep) lpC = biquad("lp", lerpExp(lp0, lp1, u), q, sr);
      if (hpSweep) hpC = biquad("hp", lerpExp(hp0, hp1, u), 0.707, sr);
    }
    let f = slide ? lerpExp(f0, f1, u) : f0;
    if (L.vib) f *= 1 + L.vib[1] * Math.sin(TAU * L.vib[0] * t);
    if (L.j) {
      if (i % 64 === 0) jit = (rand() - 0.5) * L.j;
      f *= 1 + jit;
    }
    phase += f / sr;
    phase -= Math.floor(phase);
    let s;
    switch (w) {
      case "tri":
        s = 1 - 4 * Math.abs(phase - 0.5);
        break;
      case "saw":
        s = 2 * phase - 1;
        break;
      case "square":
        s = phase < duty ? 0.8 : -0.8;
        break;
      case "noise":
        s = rand() * 2 - 1;
        break;
      case "pink": {
        const white = rand() * 2 - 1;
        pink[0] = 0.99886 * pink[0] + white * 0.0555179;
        pink[1] = 0.99332 * pink[1] + white * 0.0750759;
        pink[2] = 0.969 * pink[2] + white * 0.153852;
        pink[3] = 0.8665 * pink[3] + white * 0.3104856;
        pink[4] = 0.55 * pink[4] + white * 0.5329522;
        pink[5] = -0.7616 * pink[5] - white * 0.016898;
        s = (pink[0] + pink[1] + pink[2] + pink[3] + pink[4] + pink[5] + pink[6] + white * 0.5362) * 0.11;
        pink[6] = white * 0.115926;
        break;
      }
      case "brown": {
        brown = (brown + 0.02 * (rand() * 2 - 1)) / 1.02;
        s = brown * 3.5;
        break;
      }
      default:
        s = Math.sin(TAU * phase);
    }
    if (bpC) s = runFilter(bpC, bpSt, s) * 2;
    if (lpC) {
      s = runFilter(lpC, lpSt, s);
      if (L.lp2) s = runFilter(lpC, lpSt2, s);
    }
    if (hpC) s = runFilter(hpC, hpSt, s);
    // 包络
    let env;
    if (t < a) env = t / a;
    else if (t < a + hold || curve === 0) env = 1;
    else {
      const k = Math.max(0, 1 - (t - a - hold) / Math.max(1e-4, T - a - hold));
      env = curve === 1 ? k : curve === 2 ? k * k : Math.pow(k, curve);
    }
    if (T - t < rel) env *= Math.max(0, (T - t) / rel);
    if (L.am) env *= 1 - L.am[1] * (0.5 + 0.5 * Math.sin(TAU * L.am[0] * t));
    out[start + i] += s * env * vol;
  }
  Object.assign(st, { lpC, hpC, phase, brown, jit });
}

// 算一个声音：几层叠起来，最后按 peak 归一（每个声音的响度差不多，再按定义里的 gain 调）
// 分段算：每算 chunk 个采样停一下（yield），调用的人决定这一帧还算不算；最后 return 整段采样
export function* renderSoundSteps(def, sr = 44100, seed = 7, chunk = 1024) {
  const layers = def.layers || def;
  const total = Math.max(0.02, ...layers.map((L) => (L.d || 0) + (L.t || 0.1))) + (def.tail || 0);
  const out = new Float32Array(Math.ceil(total * sr));
  const rand = rng(seed + Math.round(total * 1000));
  for (const L of layers) {
    const st = layerInit(L, out, sr);
    if (!st) continue;
    for (let i = 0; i < st.len; i += chunk) {
      layerRun(st, i, Math.min(st.len, i + chunk), rand);
      yield;
    }
  }
  // 找最大值、按 peak 缩放：也分段（长的环境声底有十万个采样）
  const N = out.length,
    span = chunk * 8;
  let peak = 0;
  for (let i0 = 0; i0 < N; i0 += span) {
    const i1 = Math.min(N, i0 + span);
    for (let i = i0; i < i1; i++) {
      const v = Math.abs(out[i]);
      if (v > peak) peak = v;
    }
    yield;
  }
  const target = def.peak ?? 0.8;
  if (peak > 1e-6) {
    const k = target / peak;
    for (let i0 = 0; i0 < N; i0 += span) {
      const i1 = Math.min(N, i0 + span);
      for (let i = i0; i < i1; i++) out[i] *= k;
      yield;
    }
  }
  // 头尾各淡 2 毫秒，免得爆音
  const edge = Math.min(out.length >> 1, Math.round(sr * 0.002));
  for (let i = 0; i < edge; i++) {
    out[i] *= i / edge;
    out[out.length - 1 - i] *= i / edge;
  }
  return out;
}
const drain = (it) => {
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
};
export function renderSound(def, sr = 44100, seed = 7) {
  return drain(renderSoundSteps(def, sr, seed, 1 << 30));
}

// 环境声底：一段能无缝循环的噪声（结尾和开头交叉淡化）
export function* renderLoopSteps(def, sr = 22050, seed = 3, chunk = 1024) {
  const secs = def.secs || 4,
    fade = def.fade || 0.5,
    n = Math.round(secs * sr),
    m = Math.round(fade * sr);
  const long = yield* renderSoundSteps({ layers: def.layers.map((L) => ({ ...L, t: secs + fade, a: L.a ?? 0.002, c: 0, rel: 0.001 })), peak: def.peak ?? 0.5 }, sr, seed, chunk);
  const out = new Float32Array(n);
  out.set(long.subarray(0, n));
  yield;
  // 把多出来的那一段淡入叠回开头
  for (let i = 0; i < m && n + i < long.length; i++) {
    const k = i / m;
    out[i] = out[i] * k + long[n + i] * (1 - k);
  }
  return out;
}
export function renderLoop(def, sr = 22050, seed = 3) {
  return drain(renderLoopSteps(def, sr, seed, 1 << 30));
}

// 采样里的音量大致是多少（测试和调响度用）
export function rms(buf) {
  let s = 0;
  for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i];
  return Math.sqrt(s / Math.max(1, buf.length));
}
export const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
