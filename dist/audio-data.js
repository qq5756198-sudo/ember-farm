// v0.23.0「回响」的声音：音效、乐器、6 段音乐、6 句短乐句、10 套环境声。全部是数，用 audio-synth.js 算成采样。
// v0.24.0「暗涌」加了新感染者、头目、柜子、撬锁、空投、对讲机、麦穗低吼的声音。
// 一层的写法见 audio-synth.js：w 波形、f 频率（[起, 止] 是滑音）、t 长度、d 延后、a 起音、h 保持、c 衰减、v 音量、
// lp/hp 低通高通（[起, 止] 是扫频）、bp [中心, Q] 带通、vib/am [速度, 深度]、j 音高抖动。

const C4 = 261.63;

// ================= 音效 =================
// peak：归一后的峰值（大致的响度）；sr：22050 的是长而低的声音，省内存
export const SFX = {
  // ---------- 手里的家伙 ----------
  swing_blunt: { layers: [{ w: "noise", t: 0.17, a: 0.03, c: 2, lp: [600, 1800], hp: 250, v: 1 }, { w: "sine", f: [170, 90], t: 0.13, a: 0.01, c: 2, v: 0.3 }], peak: 0.55 },
  swing_blade: { layers: [{ w: "noise", t: 0.13, a: 0.02, c: 2.5, bp: [3200, 1.2], v: 1 }, { w: "noise", t: 0.1, a: 0.01, c: 2, lp: [2000, 5000], v: 0.5 }], peak: 0.5 },
  swing_pole: { layers: [{ w: "noise", t: 0.14, a: 0.01, c: 2, lp: [900, 2400], v: 1 }, { w: "tri", f: [300, 180], t: 0.08, c: 2, v: 0.2 }], peak: 0.5 },
  swing_heavy: { layers: [{ w: "noise", t: 0.3, a: 0.07, c: 1.8, lp: [350, 1200], v: 1 }, { w: "sine", f: [120, 60], t: 0.26, a: 0.05, c: 1.6, v: 0.5 }], peak: 0.65 },
  swing_throw: { layers: [{ w: "noise", t: 0.12, a: 0.02, c: 2, bp: [1500, 1.5], v: 1 }], peak: 0.45 },
  swing_slingshot: { layers: [{ w: "tri", f: [700, 300], t: 0.08, c: 3, v: 0.6 }, { w: "noise", t: 0.05, hp: 2000, c: 3, v: 0.4 }], peak: 0.5 },
  swing_crossbow: { layers: [{ w: "square", f: [220, 90], t: 0.08, c: 3, lp: 1500, v: 0.6 }, { w: "noise", t: 0.06, bp: [2500, 2], c: 2, v: 0.5 }], peak: 0.6 },
  swing_tool: { layers: [{ w: "noise", t: 0.1, a: 0.01, c: 2, lp: 1200, v: 0.8 }], peak: 0.4 },
  swing_trap: { layers: [{ w: "noise", t: 0.08, a: 0.005, c: 2, lp: 900, v: 0.6 }, { w: "square", d: 0.06, f: [500, 480], t: 0.05, lp: 2500, c: 3, v: 0.3 }], peak: 0.45 },
  hitFlesh: { layers: [{ w: "noise", t: 0.12, a: 0.002, c: 2, lp: [2400, 500], v: 0.8 }, { w: "sine", f: [150, 55], t: 0.14, c: 1.6, v: 1 }], peak: 0.75 },
  hitFleshHeavy: { layers: [{ w: "noise", t: 0.2, a: 0.002, c: 1.8, lp: [2000, 300], v: 0.9 }, { w: "sine", f: [110, 38], t: 0.24, c: 1.4, v: 1 }, { w: "brown", t: 0.25, c: 1.6, v: 0.4 }], peak: 0.9 },
  hitMetal: { layers: [{ w: "square", f: [1800, 1700], t: 0.25, c: 3, bp: [2600, 6], v: 0.5 }, { w: "sine", f: 2750, t: 0.3, c: 3, v: 0.3 }, { w: "noise", t: 0.04, hp: 3000, c: 3, v: 0.6 }], peak: 0.6 },
  kill: { layers: [{ w: "noise", t: 0.22, a: 0.005, c: 1.5, lp: [1500, 300], v: 0.8 }, { w: "sine", d: 0.05, f: [110, 40], t: 0.26, c: 1.2, v: 1 }], peak: 0.75 },
  shot_pistol: { layers: [{ w: "noise", t: 0.18, a: 0.001, c: 3, lp: [5000, 800], v: 1 }, { w: "sine", f: [300, 60], t: 0.12, c: 2, v: 0.8 }], peak: 0.9 },
  shot_shotgun: { layers: [{ w: "noise", t: 0.42, a: 0.001, c: 2.2, lp: [3500, 400], v: 1 }, { w: "sine", f: [180, 40], t: 0.32, c: 1.8, v: 1 }, { w: "brown", t: 0.5, c: 1.5, v: 0.5 }], peak: 1, sr: 22050 },
  shot_rifle: { layers: [{ w: "noise", t: 0.3, a: 0.001, c: 2.5, lp: [7000, 900], v: 1 }, { w: "square", f: [900, 120], t: 0.06, c: 3, v: 0.3 }, { w: "noise", d: 0.12, t: 0.35, c: 2, lp: 600, v: 0.25 }], peak: 0.95 },
  reload: { layers: [{ w: "noise", t: 0.05, hp: 2500, c: 3, v: 0.7 }, { w: "square", d: 0.12, f: [400, 380], t: 0.04, lp: 3000, c: 3, v: 0.4 }, { w: "noise", d: 0.25, t: 0.04, hp: 3000, c: 3, v: 0.6 }], peak: 0.45 },
  loaded: { layers: [{ w: "square", f: [1200, 1150], t: 0.03, lp: 4000, c: 3, v: 0.6 }, { w: "noise", d: 0.05, t: 0.04, hp: 3000, c: 3, v: 0.5 }], peak: 0.4 },
  shove: { layers: [{ w: "noise", t: 0.15, a: 0.01, c: 2, lp: [500, 1500], v: 0.8 }, { w: "sine", f: [200, 120], t: 0.1, c: 2, v: 0.5 }, { w: "saw", f: [180, 140], t: 0.12, bp: [700, 3], c: 2, v: 0.3 }], peak: 0.6 },
  roll: { layers: [{ w: "noise", t: 0.3, a: 0.04, c: 1.2, lp: [700, 2200], v: 0.6 }, { w: "sine", d: 0.25, f: [110, 60], t: 0.12, c: 2, v: 0.7 }], peak: 0.55 },
  hurt: { layers: [{ w: "saw", f: [220, 160], t: 0.18, bp: [800, 3], a: 0.01, c: 1.5, v: 0.6, j: 0.05 }, { w: "sine", f: [120, 60], t: 0.12, c: 2, v: 0.6 }], peak: 0.7 },
  bite: { layers: [{ w: "noise", t: 0.16, a: 0.002, c: 1.8, bp: [1800, 2], v: 0.7 }, { w: "square", f: [90, 70], t: 0.1, lp: 900, c: 2, v: 0.5, j: 0.3 }], peak: 0.75 },
  trap: { layers: [{ w: "square", f: [900, 600], t: 0.06, lp: 3000, c: 3, v: 0.6 }, { w: "noise", t: 0.08, hp: 1500, c: 3, v: 0.7 }], peak: 0.7 },
  eat: { layers: [{ w: "noise", t: 0.22, bp: [1200, 2], c: 1, v: 0.6, am: [14, 0.8] }], peak: 0.4 },
  heartbeat: { layers: [{ w: "sine", f: [72, 45], t: 0.12, c: 2, v: 1 }, { w: "sine", d: 0.22, f: [66, 42], t: 0.11, c: 2, v: 0.7 }], peak: 0.7 },
  feverBreath: { layers: [{ w: "noise", t: 0.9, a: 0.35, c: 1, bp: [900, 1], v: 0.5 }], peak: 0.3 },
  fire: { layers: [{ w: "noise", t: 0.7, a: 0.02, c: 1.2, lp: [3000, 800], v: 0.8 }, { w: "noise", t: 0.7, hp: 3000, c: 1, v: 0.2, am: [23, 0.9] }], peak: 0.6, sr: 22050 },
  firecracker: { layers: [0, 0.09, 0.2, 0.27, 0.4, 0.46].map((d) => ({ w: "noise", d, t: 0.04, c: 3, hp: 800, v: 1 })), peak: 0.75 },
  stoneLand: { layers: [{ w: "noise", t: 0.05, bp: [1500, 2], c: 3, v: 0.6 }, { w: "sine", f: [300, 200], t: 0.04, c: 3, v: 0.4 }], peak: 0.4 },
  // ---------- 脚步（按地面） ----------
  step_dirt: { layers: [{ w: "noise", t: 0.07, a: 0.003, c: 2.5, lp: 900, v: 0.8 }, { w: "sine", f: [90, 60], t: 0.05, c: 3, v: 0.3 }], peak: 0.3 },
  step_stone: { layers: [{ w: "noise", t: 0.05, c: 3, bp: [2000, 1.5], v: 0.8 }, { w: "sine", f: [180, 120], t: 0.03, c: 3, v: 0.2 }], peak: 0.28 },
  step_wood: { layers: [{ w: "noise", t: 0.06, c: 2.5, bp: [600, 2], v: 0.8 }, { w: "tri", f: [180, 140], t: 0.05, c: 3, v: 0.3 }], peak: 0.3 },
  step_metal: { layers: [{ w: "noise", t: 0.06, c: 3, bp: [2800, 3], v: 0.6 }, { w: "sine", f: [1200, 1150], t: 0.12, c: 4, v: 0.15 }], peak: 0.28 },
  step_snow: { layers: [{ w: "noise", t: 0.09, a: 0.01, c: 1.8, bp: [1500, 0.8], v: 0.7, am: [60, 0.5] }], peak: 0.28 },
  step_heavy: { layers: [{ w: "sine", f: [55, 40], t: 0.18, c: 2, v: 1 }, { w: "noise", t: 0.1, lp: 300, c: 2, v: 0.6 }], peak: 0.6 },
  // ---------- 家里 ----------
  hoe: { layers: [{ w: "noise", t: 0.1, a: 0.003, c: 2, lp: [1500, 500], v: 0.8 }, { w: "sine", f: [110, 70], t: 0.08, c: 2, v: 0.5 }], peak: 0.45 },
  plant: { layers: [{ w: "noise", t: 0.08, a: 0.01, c: 2, lp: 900, v: 0.5 }, { w: "sine", f: [380, 420], t: 0.06, c: 2, v: 0.25 }], peak: 0.35 },
  water: { layers: [{ w: "noise", t: 0.35, a: 0.03, c: 1.2, bp: [2500, 1], v: 0.6, am: [25, 0.5] }], peak: 0.35 },
  harvest: { layers: [{ w: "noise", t: 0.08, lp: 1200, c: 2, v: 0.5 }, { w: "tri", f: [523, 659], t: 0.18, c: 1.5, v: 0.4 }, { w: "tri", d: 0.08, f: [659, 784], t: 0.18, c: 1.5, v: 0.35 }], peak: 0.45 },
  craft: { layers: [0, 0.13].flatMap((d) => [{ w: "noise", d, t: 0.04, bp: [2200, 3], c: 3, v: 0.7 }, { w: "sine", d, f: [700, 600], t: 0.06, c: 3, v: 0.4 }]), peak: 0.45 },
  trade: { layers: [0, 0.05, 0.11].map((d, i) => ({ w: "square", d, f: 2500 + i * 180, t: 0.06, bp: [3200, 8], c: 3, v: 0.4 })), peak: 0.35 },
  loot: { layers: [{ w: "tri", f: [660, 990], t: 0.12, c: 2, v: 0.5 }, { w: "tri", d: 0.06, f: [880, 1320], t: 0.12, c: 2, v: 0.4 }], peak: 0.4 },
  quest: { layers: [784, 988, 1175].map((f, i) => ({ w: "sine", d: i * 0.1, f, t: 0.45, c: 2, v: 0.5 })), peak: 0.45 },
  level: { layers: [{ w: "sine", f: [523, 1046], t: 0.35, c: 1.5, v: 0.5 }, { w: "sine", d: 0.1, f: 1568, t: 0.4, c: 2.5, v: 0.3 }], peak: 0.45 },
  rescue: { layers: [{ w: "tri", f: [523, 784], t: 0.3, c: 1.5, v: 0.5 }], peak: 0.4 },
  travel: { layers: [{ w: "noise", t: 0.45, a: 0.12, c: 1, lp: 800, v: 0.5 }], peak: 0.3 },
  sleep: { layers: [262, 330, 392].map((f, i) => ({ w: "sine", d: i * 0.22, f, t: 0.9, a: 0.05, c: 1.5, v: 0.4 })), peak: 0.35 },
  alarm: { layers: [0, 0.45, 0.9].flatMap((d) => [{ w: "sine", d, f: 880, t: 0.4, c: 2.5, v: 0.6 }, { w: "sine", d, f: 2428, t: 0.3, c: 3.5, v: 0.2 }]), peak: 0.65 },
  // ---------- 界面 ----------
  uiOpen: { layers: [{ w: "tri", f: [600, 900], t: 0.06, c: 2, v: 0.4 }, { w: "noise", t: 0.04, hp: 3000, c: 3, v: 0.2 }], peak: 0.25 },
  uiClose: { layers: [{ w: "tri", f: [800, 500], t: 0.06, c: 2, v: 0.35 }], peak: 0.22 },
  uiDeny: { layers: [{ w: "square", f: [220, 200], t: 0.12, lp: 1200, c: 1.5, v: 0.4 }], peak: 0.28 },
  uiGold: { layers: [{ w: "sine", f: 988, t: 0.18, c: 2, v: 0.4 }, { w: "sine", d: 0.07, f: 1319, t: 0.2, c: 2, v: 0.3 }], peak: 0.25 },
  // ---------- 感染者：每种三声（闲晃、发现你、出手） ----------
  slow_idle: { layers: [{ w: "saw", f: [110, 95], t: 1.1, a: 0.15, c: 1, bp: [450, 4], v: 1, j: 0.08, vib: [4, 0.03] }, { w: "noise", t: 1, a: 0.2, bp: [700, 3], c: 1, v: 0.25, am: [6, 0.4] }], peak: 0.45, sr: 22050 },
  slow_spot: { layers: [{ w: "saw", f: [150, 118], t: 0.65, a: 0.03, c: 1.2, bp: [600, 3], v: 1, j: 0.12 }, { w: "noise", t: 0.5, a: 0.03, bp: [900, 2], c: 1.5, v: 0.3 }], peak: 0.6, sr: 22050 },
  slow_attack: { layers: [{ w: "saw", f: [200, 130], t: 0.3, a: 0.01, c: 1.5, bp: [900, 2], v: 1, j: 0.2 }], peak: 0.55 },
  runner_idle: { layers: [{ w: "noise", t: 0.8, a: 0.1, c: 0.8, bp: [1400, 2], v: 1, am: [3, 0.7] }], peak: 0.35, sr: 22050 },
  runner_spot: { layers: [{ w: "saw", f: [500, 720], t: 0.5, a: 0.02, c: 1.2, bp: [1500, 3], v: 1, j: 0.15, vib: [9, 0.04] }], peak: 0.6, sr: 22050 },
  runner_attack: { layers: [{ w: "saw", f: [420, 260], t: 0.25, a: 0.01, c: 1.5, bp: [1800, 2], v: 1, j: 0.25 }], peak: 0.55 },
  screamer_idle: { layers: [{ w: "sine", f: [620, 500], t: 0.6, a: 0.05, c: 1.3, vib: [6, 0.05], v: 0.8 }, { w: "noise", t: 0.5, bp: [1800, 3], c: 1.5, v: 0.2 }], peak: 0.35 },
  screamer_spot: { layers: [{ w: "saw", f: [520, 760], t: 0.6, a: 0.04, c: 1, bp: [1700, 3], v: 1, vib: [7, 0.05] }], peak: 0.55, sr: 22050 },
  scream: { layers: [{ w: "saw", f: [700, 1400], t: 1.0, a: 0.04, c: 0.9, bp: [2200, 2], v: 1, j: 0.2, vib: [11, 0.05] }, { w: "noise", t: 0.9, hp: 2000, c: 1, v: 0.35 }], peak: 0.85, sr: 22050 },
  armor_idle: { layers: [{ w: "saw", f: [70, 60], t: 1.2, a: 0.2, c: 1, bp: [300, 3], v: 1, j: 0.06 }, { w: "saw", d: 0.5, f: [400, 380], t: 0.4, bp: [1200, 10], c: 2, v: 0.15, j: 0.3 }], peak: 0.5, sr: 22050 },
  armor_spot: { layers: [{ w: "saw", f: [90, 74], t: 0.9, a: 0.05, c: 1.1, bp: [400, 2], v: 1, j: 0.1 }, { w: "noise", t: 0.7, lp: 800, c: 1.3, v: 0.4 }], peak: 0.7, sr: 22050 },
  armor_attack: { layers: [{ w: "saw", f: [110, 70], t: 0.4, a: 0.02, c: 1.4, bp: [450, 2], v: 1, j: 0.15 }, { w: "square", d: 0.2, f: [600, 560], t: 0.25, bp: [1800, 8], c: 3, v: 0.2 }], peak: 0.65 },
  elite_idle: { layers: [{ w: "saw", f: [55, 48], t: 1.5, a: 0.25, c: 1, bp: [250, 3], v: 1, j: 0.05 }], peak: 0.55, sr: 22050 },
  elite_spot: { layers: [{ w: "saw", f: [75, 58], t: 1.2, a: 0.06, c: 1, bp: [320, 2], v: 1, j: 0.1 }, { w: "brown", t: 1, c: 1.2, v: 0.6 }], peak: 0.85, sr: 22050 },
  elite_attack: { layers: [{ w: "saw", f: [90, 55], t: 0.6, a: 0.02, c: 1.3, bp: [380, 2], v: 1, j: 0.15 }, { w: "sine", f: [60, 35], t: 0.4, c: 1.5, v: 0.6 }], peak: 0.8, sr: 22050 },
  // ---------- 预兆音：和画面上的预兆一起响 ----------
  hiss: { layers: [{ w: "noise", t: 0.5, a: 0.05, c: 0.8, hp: [2500, 4000], v: 1, am: [20, 0.3] }, { w: "saw", f: [900, 1200], t: 0.45, bp: [2500, 4], c: 1, v: 0.3 }], peak: 0.7 },
  stomp: { layers: [0, 0.45].flatMap((d) => [{ w: "sine", d, f: [62, 34], t: 0.35, c: 1.5, v: 1 }, { w: "brown", d, t: 0.3, c: 2, v: 0.6 }, { w: "noise", d, t: 0.08, lp: 400, c: 2, v: 0.6 }]), peak: 0.95, sr: 22050 },
  inhale: { layers: [{ w: "noise", t: 1.05, a: 0.95, c: 0.3, lp: [600, 3500], hp: 300, v: 1 }, { w: "saw", f: [300, 900], t: 1.05, a: 0.85, c: 0.4, bp: [1800, 3], v: 0.25 }], peak: 0.6, sr: 22050 },
  grabCue: { layers: [{ w: "saw", f: [130, 110], t: 0.45, a: 0.05, c: 0.8, bp: [500, 3], v: 1, j: 0.15 }, { w: "noise", t: 0.4, a: 0.05, bp: [700, 2], c: 1, v: 0.3 }], peak: 0.6 },
  reach: { layers: [{ w: "noise", t: 0.45, a: 0.03, c: 1, bp: [1100, 3], v: 1, am: [14, 0.6] }, { w: "saw", f: [160, 120], t: 0.4, bp: [700, 3], c: 1, v: 0.4, j: 0.2 }], peak: 0.55 },
  // ---------- v0.24「暗涌」：新感染者和头目 ----------
  bloater_idle: { layers: [{ w: "brown", t: 1.1, a: 0.2, c: 1, lp: 500, v: 1, am: [4, 0.7] }, { w: "saw", f: [80, 70], t: 1, a: 0.2, bp: [300, 4], c: 1, v: 0.4, j: 0.1 }], peak: 0.4, sr: 22050 },
  bloater_spot: { layers: [{ w: "saw", f: [120, 95], t: 0.7, a: 0.04, c: 1.1, bp: [420, 3], v: 1, j: 0.15 }, { w: "brown", t: 0.6, lp: 600, c: 1.2, v: 0.6, am: [9, 0.6] }], peak: 0.6, sr: 22050 },
  bloater_attack: { layers: [{ w: "saw", f: [160, 100], t: 0.35, a: 0.01, c: 1.5, bp: [600, 2], v: 1, j: 0.2 }, { w: "brown", t: 0.3, lp: 500, c: 1.6, v: 0.5 }], peak: 0.55 },
  spitter_idle: { layers: [{ w: "noise", t: 0.9, a: 0.15, c: 1, bp: [1600, 3], v: 0.8, am: [7, 0.8] }, { w: "saw", f: [240, 210], t: 0.8, bp: [900, 6], c: 1, v: 0.25, j: 0.2 }], peak: 0.35, sr: 22050 },
  spitter_spot: { layers: [{ w: "saw", f: [260, 380], t: 0.55, a: 0.03, c: 1.2, bp: [1200, 3], v: 1, j: 0.2, vib: [12, 0.04] }, { w: "noise", t: 0.5, bp: [2000, 2], c: 1.3, v: 0.3, am: [18, 0.6] }], peak: 0.55, sr: 22050 },
  spitter_attack: { layers: [{ w: "saw", f: [300, 180], t: 0.28, a: 0.01, c: 1.5, bp: [1300, 2], v: 1, j: 0.25 }], peak: 0.5 },
  stalker_idle: { layers: [0, 0.11, 0.19, 0.42].map((d) => ({ w: "square", d, f: [2400, 2100], t: 0.025, bp: [2600, 6], c: 3, v: 0.7 })), peak: 0.3 },
  stalker_spot: { layers: [0, 0.07, 0.13, 0.2, 0.26].map((d) => ({ w: "square", d, f: [2800, 2300], t: 0.025, bp: [2900, 6], c: 3, v: 0.8 })), peak: 0.4 },
  stalker_attack: { layers: [{ w: "saw", f: [700, 360], t: 0.25, a: 0.01, c: 1.6, bp: [1700, 2], v: 1, j: 0.3 }, { w: "noise", t: 0.2, hp: 2500, c: 2, v: 0.4 }], peak: 0.55 },
  brute_idle: { layers: [{ w: "saw", f: [48, 42], t: 1.6, a: 0.3, c: 1, bp: [220, 3], v: 1, j: 0.05 }, { w: "brown", t: 1.4, a: 0.3, lp: 250, c: 1, v: 0.5 }], peak: 0.6, sr: 22050 },
  brute_spot: { layers: [{ w: "saw", f: [70, 50], t: 1.4, a: 0.06, c: 1, bp: [300, 2], v: 1, j: 0.1 }, { w: "brown", t: 1.2, c: 1.1, v: 0.7 }, { w: "noise", t: 0.8, lp: 700, c: 1.3, v: 0.3 }], peak: 0.9, sr: 22050 },
  brute_attack: { layers: [{ w: "saw", f: [85, 50], t: 0.6, a: 0.02, c: 1.3, bp: [360, 2], v: 1, j: 0.15 }, { w: "sine", f: [55, 30], t: 0.5, c: 1.4, v: 0.7 }], peak: 0.85, sr: 22050 },
  nurse_idle: { layers: [{ w: "sine", f: [520, 470], t: 1.1, a: 0.2, c: 1, vib: [5, 0.05], v: 0.7 }, { w: "noise", t: 1, a: 0.2, bp: [1500, 4], c: 1, v: 0.2, am: [3, 0.8] }], peak: 0.35, sr: 22050 },
  nurse_spot: { layers: [{ w: "saw", f: [600, 900], t: 0.7, a: 0.04, c: 1, bp: [1900, 3], v: 1, vib: [8, 0.05] }], peak: 0.6, sr: 22050 },
  nurse_attack: { layers: [{ w: "saw", f: [700, 420], t: 0.3, a: 0.01, c: 1.5, bp: [1800, 2], v: 1, j: 0.2 }], peak: 0.55 },
  fuse: { layers: [{ w: "brown", t: 1, a: 0.1, c: 0.6, lp: [300, 1200], v: 1, am: [9, 0.7] }, { w: "sine", f: [500, 1400], t: 1, a: 0.6, c: 0.5, v: 0.35 }], peak: 0.6, sr: 22050 },
  gas: { layers: [{ w: "noise", t: 0.12, a: 0.002, c: 2, lp: [1800, 400], v: 1 }, { w: "brown", t: 0.5, c: 1.4, v: 0.8 }, { w: "noise", d: 0.08, t: 1.4, a: 0.1, c: 1, bp: [2600, 1], v: 0.4 }], peak: 0.8, sr: 22050 },
  breath: { layers: [0, 1.1].map((d) => ({ w: "noise", d, t: 0.8, a: 0.35, c: 1, bp: [800, 2], v: 0.6 })), peak: 0.16, sr: 22050 },
  fakerGrab: { layers: [{ w: "saw", f: [140, 100], t: 0.45, a: 0.01, c: 1.2, bp: [500, 3], v: 1, j: 0.25 }, { w: "noise", t: 0.12, a: 0.002, bp: [2400, 2], c: 2, v: 0.6 }], peak: 0.7 },
  spitCue: { layers: [{ w: "brown", t: 0.7, a: 0.4, c: 0.6, lp: [300, 1500], v: 0.9, am: [16, 0.7] }, { w: "saw", f: [200, 500], t: 0.7, a: 0.5, bp: [1200, 3], c: 0.6, v: 0.3 }], peak: 0.6, sr: 22050 },
  spit: { layers: [{ w: "noise", t: 0.18, a: 0.005, c: 2, bp: [1800, 1.5], v: 1 }, { w: "sine", f: [400, 180], t: 0.12, c: 2, v: 0.4 }], peak: 0.55 },
  acid: { layers: [{ w: "noise", t: 1.2, a: 0.02, c: 1.4, hp: 2500, v: 0.7, am: [30, 0.6] }, { w: "noise", t: 0.08, lp: 900, c: 2, v: 0.6 }], peak: 0.45, sr: 22050 },
  click: { layers: [0, 0.09, 0.16].map((d) => ({ w: "square", d, f: [2600, 2200], t: 0.025, bp: [2800, 6], c: 3, v: 0.8 })), peak: 0.35 },
  stalkerCue: { layers: [{ w: "square", f: [3000, 2400], t: 0.03, bp: [3000, 6], c: 3, v: 0.9 }, { w: "noise", d: 0.04, t: 0.28, a: 0.02, hp: 3000, c: 1.2, v: 0.8 }], peak: 0.6 },
  slamCue: { layers: [{ w: "saw", f: [60, 90], t: 1.2, a: 0.6, c: 0.6, bp: [260, 3], v: 1, j: 0.08 }, { w: "brown", t: 1.2, a: 0.8, c: 0.5, lp: 300, v: 0.5 }], peak: 0.75, sr: 22050 },
  slam: { layers: [{ w: "sine", f: [70, 28], t: 0.7, a: 0.002, c: 1.2, v: 1 }, { w: "brown", t: 0.9, c: 1.3, v: 0.9 }, { w: "noise", t: 0.25, lp: [1200, 200], c: 2, v: 0.8 }], peak: 1, sr: 22050 },
  doorCue: { layers: [{ w: "noise", t: 0.9, a: 0.2, c: 0.8, bp: [900, 2], v: 0.8, am: [3, 0.9] }, { w: "square", f: [380, 300], t: 0.8, bp: [1400, 8], c: 1, v: 0.25, j: 0.2 }], peak: 0.55, sr: 22050 },
  doorThrow: { layers: [{ w: "noise", t: 0.45, a: 0.02, c: 1.2, bp: [700, 1.2], v: 1 }], peak: 0.55 },
  doorHit: { layers: [{ w: "square", f: [520, 470], t: 0.5, bp: [1500, 6], c: 2.5, v: 0.6 }, { w: "noise", t: 0.2, lp: 2500, c: 2, v: 0.9 }, { w: "sine", f: [90, 50], t: 0.3, c: 2, v: 0.6 }], peak: 0.85 },
  bruteStep: { layers: [{ w: "sine", f: [48, 32], t: 0.32, a: 0.002, c: 1.6, v: 1 }, { w: "brown", t: 0.25, lp: 220, c: 2, v: 0.8 }], peak: 0.75, sr: 22050 },
  pulseCue: { layers: [{ w: "sine", f: [220, 660], t: 0.6, a: 0.4, c: 0.6, v: 0.7, vib: [9, 0.03] }, { w: "noise", t: 0.6, a: 0.4, bp: [1400, 3], c: 0.6, v: 0.3 }], peak: 0.45 },
  pulse: { layers: [{ w: "sine", f: [660, 330], t: 0.8, a: 0.01, c: 1.4, v: 0.6 }, { w: "noise", t: 0.5, bp: [900, 2], c: 1.5, v: 0.4 }], peak: 0.45 },
  armorOff: { layers: [0, 0.12, 0.3].flatMap((d) => [{ w: "square", d, f: [900 - d * 500, 820 - d * 500], t: 0.25, bp: [2200, 7], c: 3, v: 0.5 }, { w: "noise", d, t: 0.05, hp: 2500, c: 3, v: 0.6 }]), peak: 0.6 },
  rareLoot: { layers: [988, 1319, 1568].map((f, i) => ({ w: "sine", d: i * 0.06, f, t: 0.5, c: 2.5, v: 0.45 })), peak: 0.4 },
  preciousLoot: { layers: [784, 988, 1175, 1568, 1976].map((f, i) => ({ w: "sine", d: i * 0.07, f, t: 0.7, c: 2.2, v: 0.45 })), peak: 0.45 },
  pryStart: { layers: [{ w: "square", f: [600, 560], t: 0.15, bp: [1800, 8], c: 2.5, v: 0.5 }, { w: "noise", t: 0.05, hp: 2000, c: 3, v: 0.5 }], peak: 0.4 },
  pryTick: { layers: [{ w: "saw", f: [260, 200], t: 0.5, bp: [1100, 7], c: 1, v: 0.5, j: 0.3 }, { w: "noise", t: 0.3, bp: [2500, 3], c: 1.5, v: 0.3 }], peak: 0.4 },
  pickTick: { layers: [0, 0.08].map((d) => ({ w: "square", d, f: [3200, 3000], t: 0.015, bp: [3400, 8], c: 3, v: 0.5 })), peak: 0.15 },
  pryDone: { layers: [{ w: "square", f: [700, 640], t: 0.4, bp: [1600, 6], c: 2.5, v: 0.6 }, { w: "noise", t: 0.06, hp: 1500, c: 3, v: 0.7 }, { w: "sine", d: 0.08, f: [160, 90], t: 0.2, c: 2, v: 0.5 }], peak: 0.6 },
  plane: { layers: [{ w: "saw", f: [92, 88], t: 3.5, a: 1.2, h: 0.8, c: 1, lp: 400, v: 0.8, vib: [0.6, 0.02] }, { w: "brown", t: 3.5, a: 1.2, h: 0.8, c: 1, lp: 300, v: 0.6 }], peak: 0.35, sr: 22050 },
  airdropLand: { layers: [{ w: "sine", f: [80, 35], t: 0.5, a: 0.002, c: 1.4, v: 1 }, { w: "noise", t: 0.3, lp: [2000, 300], c: 1.8, v: 0.8 }, { w: "square", d: 0.05, f: [420, 400], t: 0.4, bp: [1300, 6], c: 2.5, v: 0.3 }], peak: 0.85, sr: 22050 },
  talkie: { layers: [{ w: "sine", f: 1760, t: 0.12, c: 3, v: 0.6 }, { w: "noise", d: 0.14, t: 0.9, a: 0.02, c: 1.2, bp: [1800, 1.5], v: 0.5, am: [13, 0.5] }], peak: 0.4 },
  survivorHurt: { layers: [{ w: "saw", f: [330, 240], t: 0.2, bp: [1100, 3], a: 0.01, c: 1.5, v: 0.7, j: 0.05 }], peak: 0.55 },
  dogGrowl: { layers: [{ w: "saw", f: [140, 120], t: 0.7, a: 0.08, c: 1, bp: [500, 3], v: 0.8, am: [22, 0.5] }, { w: "saw", d: 0.75, f: [520, 380], t: 0.14, bp: [1400, 2], c: 2, v: 0.9 }, { w: "saw", d: 0.95, f: [500, 360], t: 0.14, bp: [1400, 2], c: 2, v: 0.8 }], peak: 0.55 },
  radioStatic: { layers: [{ w: "noise", t: 0.7, a: 0.02, c: 1.2, bp: [2200, 1.5], v: 0.6, am: [9, 0.5] }, { w: "sine", d: 0.1, f: 1046, t: 0.15, c: 3, v: 0.4 }], peak: 0.3 },
  // ---------- 环境里的零碎声 ----------
  bird: { layers: [{ w: "sine", f: [2800, 3600], t: 0.08, c: 2, v: 0.6, vib: [30, 0.08] }, { w: "sine", d: 0.12, f: [3200, 4000], t: 0.07, c: 2, v: 0.5 }], peak: 0.3 },
  bird2: { layers: [{ w: "sine", f: [1800, 2600], t: 0.25, a: 0.02, c: 1.5, v: 0.6, vib: [8, 0.05] }, { w: "sine", d: 0.3, f: [2600, 2000], t: 0.2, c: 1.5, v: 0.5 }], peak: 0.28 },
  cricket: { layers: [{ w: "sine", f: 4300, t: 0.25, c: 0.5, v: 0.5, am: [45, 1] }], peak: 0.18 },
  owl: { layers: [0, 0.45].map((d) => ({ w: "sine", d, f: [420, 380], t: 0.35, a: 0.05, c: 1, v: 0.5 })), peak: 0.3 },
  drip: { layers: [{ w: "sine", f: [1600, 800], t: 0.06, c: 3, v: 0.6 }], peak: 0.25 },
  buzz: { layers: [{ w: "saw", f: 120, t: 0.6, bp: [2400, 4], c: 0.5, v: 0.4, am: [50, 0.6] }], peak: 0.18 },
  clank: { layers: [{ w: "square", f: [700, 650], t: 0.4, bp: [1800, 8], c: 3, v: 0.5 }, { w: "noise", t: 0.03, hp: 2000, c: 3, v: 0.5 }], peak: 0.3 },
  creak: { layers: [{ w: "saw", f: [220, 180], t: 0.6, bp: [900, 8], c: 1, v: 0.4, j: 0.3 }], peak: 0.22 },
  bang: { layers: [0, 0.18].flatMap((d) => [{ w: "noise", d, t: 0.3, bp: [900, 2], c: 2, v: 0.8 }, { w: "square", d, f: [180, 170], t: 0.4, lp: 1200, c: 2, v: 0.4 }]), peak: 0.35, sr: 22050 },
  growlFar: { layers: [{ w: "saw", f: [100, 90], t: 1.2, a: 0.2, c: 1, bp: [400, 3], lp: 900, v: 0.6, j: 0.1 }], peak: 0.25, sr: 22050 },
  chatter: { layers: [{ w: "noise", t: 0.5, bp: [600, 3], c: 1, v: 0.6, am: [5, 0.8] }, { w: "saw", f: [200, 230], t: 0.4, bp: [900, 5], c: 1.2, v: 0.2, j: 0.1 }], peak: 0.22 },
  call: { layers: [{ w: "saw", f: [260, 320], t: 0.5, a: 0.05, bp: [1000, 4], c: 1.2, vib: [5, 0.05], v: 0.4 }], peak: 0.2 },
  gull: { layers: [{ w: "saw", f: [1400, 900], t: 0.35, bp: [2000, 3], c: 1.2, vib: [18, 0.06], v: 0.4 }], peak: 0.2 },
  buoy: { layers: [{ w: "sine", f: 880, t: 1.5, c: 2, v: 0.4 }, { w: "sine", f: 2412, t: 1, c: 3, v: 0.15 }], peak: 0.2, sr: 22050 },
  splash: { layers: [{ w: "noise", t: 0.4, a: 0.02, c: 1.5, lp: [2500, 600], v: 0.6 }], peak: 0.25 },
  fan: { layers: [{ w: "square", f: 60, t: 0.6, lp: 500, c: 0.5, am: [12, 0.7], v: 0.4 }], peak: 0.2 },
  gust: { layers: [{ w: "noise", t: 2, a: 0.6, c: 1, lp: [400, 900], v: 0.7 }], peak: 0.3, sr: 22050 },
  iceCreak: { layers: [{ w: "saw", f: [300, 500], t: 0.5, bp: [1500, 10], c: 1, j: 0.4, v: 0.3 }], peak: 0.2 },
  branch: { layers: [{ w: "noise", t: 0.08, bp: [2000, 2], c: 3, v: 0.7 }, { w: "noise", d: 0.05, t: 0.06, bp: [1500, 2], c: 3, v: 0.6 }], peak: 0.25 },
  thunder: { layers: [{ w: "brown", t: 3, a: 0.05, c: 1.2, lp: [800, 200], v: 1 }, { w: "noise", t: 0.3, a: 0.01, c: 2, lp: [3000, 500], v: 0.6 }], peak: 0.6, sr: 22050 },
};

// ================= 乐器：按一个基准音算一次，弹别的音时改播放速度 =================
export const INSTRUMENTS = {
  pluck: { base: 60, layers: [{ w: "tri", f: C4, t: 0.9, a: 0.003, c: 3, lp: [3000, 600], v: 1 }, { w: "sine", f: C4 * 2, t: 0.5, c: 4, v: 0.3 }], peak: 0.6 },
  bell: { base: 72, layers: [{ w: "sine", f: C4 * 2, t: 2.2, a: 0.002, c: 2.5, v: 1 }, { w: "sine", f: C4 * 2 * 2.76, t: 1.2, c: 3.5, v: 0.35 }, { w: "sine", f: C4 * 2 * 5.4, t: 0.5, c: 4, v: 0.12 }], peak: 0.5, sr: 22050 },
  pad: { base: 60, layers: [{ w: "saw", f: C4, t: 3.2, a: 0.6, h: 1.5, c: 1.5, lp: 1400, v: 0.5, vib: [5, 0.004] }, { w: "saw", f: C4 * 1.006, t: 3.2, a: 0.7, h: 1.5, c: 1.5, lp: 1200, v: 0.5 }, { w: "tri", f: C4 / 2, t: 3.2, a: 0.6, h: 1.5, c: 1.5, v: 0.4 }], peak: 0.45, sr: 22050 },
  bass: { base: 36, layers: [{ w: "tri", f: C4 / 4, t: 1.0, a: 0.005, c: 2, v: 1 }, { w: "square", f: C4 / 4, t: 0.6, c: 3, lp: 400, v: 0.3 }], peak: 0.7, sr: 22050 },
  kick: { base: 0, layers: [{ w: "sine", f: [130, 42], t: 0.35, a: 0.001, c: 2, v: 1 }, { w: "noise", t: 0.02, lp: 2000, c: 2, v: 0.3 }], peak: 0.8, sr: 22050 },
  snare: { base: 0, layers: [{ w: "noise", t: 0.22, a: 0.001, c: 2.5, hp: 900, lp: 6000, v: 0.9 }, { w: "tri", f: [220, 160], t: 0.12, c: 3, v: 0.5 }], peak: 0.55 },
  hat: { base: 0, layers: [{ w: "noise", t: 0.06, a: 0.001, c: 3, hp: 6000, v: 0.6 }], peak: 0.3 },
  tom: { base: 50, layers: [{ w: "sine", f: [180, 90], t: 0.5, a: 0.002, c: 2, v: 1 }, { w: "noise", t: 0.05, lp: 1200, c: 2, v: 0.3 }], peak: 0.75, sr: 22050 },
  drone: { base: 36, layers: [{ w: "saw", f: C4 / 4, t: 4, a: 1, h: 2, c: 1, lp: 300, v: 0.6, vib: [0.3, 0.004] }, { w: "saw", f: (C4 / 4) * 1.5, t: 4, a: 1, h: 2, c: 1, lp: 300, v: 0.3 }], peak: 0.45, sr: 22050 },
  string: { base: 60, layers: [{ w: "saw", f: C4, t: 1.6, a: 0.12, h: 0.6, c: 1.5, lp: 2200, v: 0.6, vib: [5.5, 0.006] }, { w: "saw", f: C4 * 1.004, t: 1.6, a: 0.14, h: 0.6, c: 1.5, lp: 2000, v: 0.5 }], peak: 0.45, sr: 22050 },
  flute: { base: 72, layers: [{ w: "sine", f: C4 * 2, t: 1.2, a: 0.06, h: 0.5, c: 1.2, v: 1, vib: [5, 0.005] }, { w: "noise", t: 1.2, a: 0.06, h: 0.5, c: 1.2, bp: [C4 * 4, 6], v: 0.15 }], peak: 0.4, sr: 22050 },
};

// ================= 音乐：6 段，每段几十秒一循环，按紧张程度叠三层（底、鼓、旋律） =================
const MAJOR = [0, 2, 4, 5, 7, 9, 11],
  MINOR = [0, 2, 3, 5, 7, 8, 10],
  DORIAN = [0, 2, 3, 5, 7, 9, 10],
  PHRYGIAN = [0, 1, 3, 5, 7, 8, 10];
// 每小节 16 步。x 是一下，X 是重一点
export const PIECES = {
  farmDay: {
    name: "农场白天",
    bpm: 84,
    root: 60,
    scale: MAJOR,
    chords: [0, 5, 3, 4, 0, 2, 3, 4, 5, 3, 0, 4, 3, 4, 0, 0],
    base: { pad: 0.42, bass: "x.......x.......", arp: { inst: "pluck", pat: "..x...x...x...x.", vel: 0.45, oct: 0 } },
    drums: { kick: "x.......x.......", hat: "....x.......x...", vel: 0.35 },
    lead: { inst: "flute", density: 0.5, oct: 1, vel: 0.4 },
    layers: { drums: 0.6, lead: 0.7 },
  },
  farmNight: {
    name: "农场夜里",
    bpm: 64,
    root: 57,
    scale: MINOR,
    chords: [0, 5, 2, 6, 0, 5, 3, 4, 0, 5, 2, 6],
    base: { pad: 0.35, bass: "x...............", arp: { inst: "bell", pat: "x.......x...x...", vel: 0.3, oct: 0 } },
    drums: null,
    lead: { inst: "bell", density: 0.18, oct: 1, vel: 0.25 },
    layers: { drums: 0, lead: 0.6 },
  },
  explore: {
    name: "在外面",
    bpm: 72,
    root: 50,
    scale: DORIAN,
    chords: [0, 0, 6, 3, 0, 0, 5, 4, 0, 2, 6, 3, 0, 5, 6, 0],
    base: { drone: 0.38, bass: "x...........x...", arp: { inst: "pluck", pat: "x..x....x.......", vel: 0.32, oct: 1 } },
    drums: { tom: "........x.......", every: 2, vel: 0.35 },
    lead: { inst: "string", density: 0.22, oct: 1, vel: 0.3 },
    layers: { drums: 0.5, lead: 0.5 },
  },
  fight: {
    name: "打仗",
    bpm: 112,
    root: 52,
    scale: MINOR,
    chords: [0, 5, 6, 0, 0, 3, 5, 6, 0, 5, 6, 0, 3, 3, 4, 4],
    base: { drone: 0.4, bass: "x.x.x.xxx.x.x.xx", bassVel: 0.55 },
    drums: { kick: "x...x...x...x...", snare: "....x.......x...", hat: "x.x.x.x.x.x.x.x.", vel: 0.55 },
    lead: { inst: "string", density: 0.7, oct: 1, vel: 0.42, stab: true },
    layers: { drums: 1, lead: 1 },
  },
  siege: {
    name: "尸潮和袭击",
    bpm: 120,
    root: 48,
    scale: PHRYGIAN,
    chords: [0, 1, 0, 6, 0, 1, 5, 6, 0, 1, 0, 6, 3, 1, 6, 0],
    base: { drone: 0.45, bass: "x..x..x.x..x..x.", bassVel: 0.6 },
    drums: { kick: "x.......x.x.....", tom: "x.x...x.x.x...x.", snare: "....x.......x..x", vel: 0.6 },
    lead: { inst: "string", density: 0.75, oct: 1, vel: 0.45, stab: true },
    layers: { drums: 1, lead: 1 },
  },
  scene: {
    name: "主线和节庆",
    bpm: 76,
    root: 65,
    scale: MAJOR,
    chords: [0, 4, 5, 3, 0, 4, 3, 4, 0, 4, 5, 3],
    base: { pad: 0.4, bass: "x.......x.......", arp: { inst: "bell", pat: "x.x.x.x.x.x.x.x.", vel: 0.22, oct: 0 } },
    drums: { hat: "..x...x...x...x.", vel: 0.2 },
    lead: { inst: "flute", density: 0.55, oct: 0, vel: 0.38 },
    layers: { drums: 0.5, lead: 0.8 },
  },
};

// 短乐句：[开始秒, 乐器, 音, 力度]
export const STINGERS = {
  discover: [[0, "string", 64, 0.7], [0, "string", 70, 0.6], [0.04, "tom", 45, 0.9], [0.45, "string", 65, 0.55], [0.45, "string", 71, 0.5]],
  boss: [[0, "drone", 33, 1], [0, "string", 45, 0.85], [0.3, "tom", 40, 1], [0.6, "tom", 40, 1], [0.9, "string", 46, 0.85]],
  hordeWarn: [[0, "string", 48, 0.85], [0, "string", 55, 0.75], [0.5, "string", 46, 0.85], [0.5, "string", 53, 0.75], [1.0, "tom", 45, 1]],
  victory: [[0, "pad", 60, 0.45], [0, "bell", 72, 0.7], [0.15, "bell", 76, 0.7], [0.3, "bell", 79, 0.7], [0.45, "bell", 84, 0.8]],
  downed: [[0, "drone", 38, 0.7], [0, "string", 57, 0.75], [0.5, "string", 53, 0.75], [1.0, "string", 50, 0.85]],
  actDone: [[0, "pad", 65, 0.5], [0, "bell", 77, 0.6], [0.2, "bell", 81, 0.6], [0.4, "bell", 84, 0.7], [0.6, "flute", 89, 0.5]],
};

// ================= 环境声 =================
// 底：一段能循环的噪声
export const BEDS = {
  windSoft: { layers: [{ w: "pink", lp: 500, v: 1, am: [0.13, 0.5] }], peak: 0.4 },
  windStrong: { layers: [{ w: "pink", lp: 900, v: 1, am: [0.2, 0.6] }, { w: "noise", hp: 2000, lp: 4000, v: 0.15, am: [0.31, 0.8] }], peak: 0.5 },
  murmur: { layers: [{ w: "pink", bp: [600, 1.5], v: 1, am: [3.7, 0.5] }, { w: "pink", bp: [1100, 2], v: 0.5, am: [5.3, 0.6] }], peak: 0.35 },
  hum: { layers: [{ w: "sine", f: 50, v: 0.6 }, { w: "sine", f: 100, v: 0.3 }, { w: "saw", f: 150, lp: 400, v: 0.15 }, { w: "pink", lp: 300, v: 0.4 }], peak: 0.3 },
  rumble: { layers: [{ w: "brown", lp: 200, v: 1 }, { w: "sine", f: 41, v: 0.3, am: [0.07, 0.5] }], peak: 0.4 },
  trickle: { layers: [{ w: "noise", bp: [2200, 1], v: 0.6, am: [7, 0.5] }, { w: "pink", lp: 900, v: 0.4 }], peak: 0.3 },
  waves: { layers: [{ w: "pink", lp: 700, v: 1, am: [0.11, 0.85] }, { w: "noise", bp: [3000, 1], v: 0.25, am: [0.11, 0.9] }], peak: 0.45 },
  vent: { layers: [{ w: "brown", lp: 400, v: 0.8 }, { w: "saw", f: 60, lp: 250, v: 0.2 }, { w: "pink", bp: [1500, 3], v: 0.2, am: [9, 0.4] }], peak: 0.35 },
  forest: { layers: [{ w: "pink", lp: 700, v: 0.8, am: [0.09, 0.6] }, { w: "noise", hp: 3000, lp: 6000, v: 0.08, am: [0.17, 0.9] }], peak: 0.35 },
  crickets: { layers: [{ w: "sine", f: 4400, v: 0.25, am: [48, 1] }, { w: "sine", f: 3900, v: 0.18, am: [37, 1] }, { w: "pink", lp: 400, v: 0.5 }], peak: 0.25 },
  rainLight: { layers: [{ w: "noise", bp: [3000, 0.8], v: 0.7 }, { w: "pink", lp: 1200, v: 0.4 }], peak: 0.3 },
  rainHeavy: { layers: [{ w: "noise", bp: [2500, 0.6], v: 1 }, { w: "brown", lp: 500, v: 0.6 }], peak: 0.45 },
  snow: { layers: [{ w: "pink", hp: 800, lp: 3000, v: 0.4, am: [0.25, 0.5] }], peak: 0.25 },
};
// 10 套：底 + 零碎声（[声音, 最短间隔, 最长间隔]），白天、夜里可以不一样
export const AMBIENCE = {
  farm: { name: "农场", bed: "windSoft", night: "crickets", day: [["bird", 2.5, 7], ["bird2", 6, 14]], nightEvents: [["owl", 12, 30], ["cricket", 3, 8]] },
  market: { name: "集市", bed: "murmur", day: [["chatter", 2, 5], ["call", 8, 18], ["clank", 10, 20]] },
  residential: { name: "居民区", bed: "windSoft", day: [["bang", 8, 18], ["growlFar", 10, 24], ["creak", 7, 15]] },
  hospital: { name: "医院", bed: "hum", day: [["drip", 1.5, 4], ["buzz", 6, 14], ["growlFar", 14, 30]] },
  warehouse: { name: "仓库", bed: "rumble", day: [["clank", 5, 12], ["creak", 8, 16], ["growlFar", 14, 30]] },
  alley: { name: "雨巷", bed: "trickle", day: [["drip", 1, 3], ["splash", 6, 14]] },
  water: { name: "水边", bed: "waves", day: [["gull", 8, 20], ["buoy", 12, 26], ["splash", 5, 12]] },
  under: { name: "地底", bed: "vent", day: [["fan", 6, 12], ["clank", 10, 22], ["drip", 3, 7]] },
  station: { name: "气象站", bed: "windStrong", day: [["gust", 5, 11], ["iceCreak", 9, 18]] },
  forest: { name: "林场", bed: "forest", day: [["bird2", 5, 12], ["branch", 8, 18]], nightEvents: [["owl", 14, 32], ["branch", 10, 20]] },
};
export const REGION_AMBIENCE = {
  farm: "farm",
  valley: "farm",
  market: "market",
  stationMarket: "market",
  residential: "residential",
  hospital: "hospital",
  quarantine: "hospital",
  warehouse: "warehouse",
  railDepot: "warehouse",
  courtyard: "alley",
  shipyard: "water",
  archive: "water",
  shelter: "under",
  frost: "station",
  pinewood: "forest",
};
// 室内的图不叠天气
export const INDOOR = ["shelter"];
// 脚下是什么
export const SURFACE = {
  farm: "dirt",
  valley: "dirt",
  pinewood: "dirt",
  market: "wood",
  shipyard: "wood",
  stationMarket: "stone",
  residential: "stone",
  hospital: "stone",
  quarantine: "stone",
  courtyard: "stone",
  archive: "stone",
  warehouse: "metal",
  railDepot: "metal",
  shelter: "metal",
  frost: "snow",
};

// ================= 事件 → 声音 =================
const SWING = { blunt: "swing_blunt", blade: "swing_blade", pole: "swing_pole", heavy: "swing_heavy", throw: "swing_throw", slingshot: "swing_slingshot", crossbow: "swing_crossbow", trap: "swing_trap", tool: "swing_tool", gun: "swing_tool" };
const VOICE_TYPES = ["slow", "runner", "screamer", "armor", "elite", "bloater", "spitter", "stalker", "brute", "nurse"];
export const voiceFor = (type, kind) => {
  const t = VOICE_TYPES.includes(type) ? type : "slow";
  const id = t + "_" + kind;
  return SFX[id] ? id : t === "screamer" && kind === "attack" ? "screamer_spot" : "slow_" + kind;
};
// 返回 { sfx, stinger, voice（感染者出声，受同时 8 个的限制）, duck（预兆：压低音乐和环境声）, ui（界面声，不分左右） }
export function soundFor(ev) {
  switch (ev.type) {
    case "swing":
      return { sfx: SWING[ev.kind] || "swing_tool" };
    case "shot":
      return { sfx: "shot_" + (["pistol", "shotgun", "rifle"].includes(ev.weapon) ? ev.weapon : "pistol") };
    case "hit":
      return { sfx: "hurt" };
    case "hitFlesh":
      return { sfx: ev.heavy || ev.kill ? "hitFleshHeavy" : "hitFlesh" };
    case "hitMetal":
      return { sfx: "hitMetal" };
    case "spot":
      return { sfx: voiceFor(ev.z, "spot"), voice: true };
    case "windup":
      return { sfx: voiceFor(ev.z, "attack"), voice: true };
    case "scream":
      return { sfx: "scream", voice: true, duck: true };
    case "hiss":
    case "stomp":
    case "inhale":
    case "grabCue":
    case "reach":
      return { sfx: ev.type, voice: true, duck: true };
    case "quest":
      return { sfx: "quest", stinger: "actDone", ui: true };
    case "victory":
      return { stinger: "victory", ui: true };
    case "alarm":
      return { sfx: "alarm", stinger: "hordeWarn", ui: true };
    case "wave":
      return { stinger: "discover", ui: true };
    case "level":
    case "travel":
    case "sleep":
    case "trade":
      return { sfx: ev.type, ui: true };
    case "kill":
    case "reload":
    case "loaded":
    case "loot":
    case "eat":
    case "trap":
    case "bite":
    case "shove":
    case "rescue":
    case "roll":
    case "hoe":
    case "plant":
    case "water":
    case "harvest":
    case "craft":
      return { sfx: ev.type };
    // ---------- v0.24「暗涌」 ----------
    case "fuse":
    case "spitCue":
    case "stalkerCue":
    case "slamCue":
    case "doorCue":
    case "pulseCue":
    case "fakerGrab":
      return { sfx: ev.type, voice: true, duck: true };
    case "nurseCue":
      return { sfx: "inhale", voice: true, duck: true };
    case "nurseScream":
      return { sfx: "scream", voice: true, duck: true };
    case "breath":
    case "click":
      return { sfx: ev.type, voice: true };
    case "bossRage":
      return { sfx: "brute_spot", voice: true, duck: true, range: 1200 };
    case "slam":
      return { sfx: "slam", range: 1200 };
    case "bruteStep":
      return { sfx: "bruteStep", range: 1400 };
    case "gas":
    case "spit":
    case "acid":
    case "doorThrow":
    case "doorHit":
    case "pulse":
    case "armorOff":
    case "pryStart":
    case "pryDone":
    case "airdropLand":
    case "talkie":
    case "survivorHurt":
    case "dogGrowl":
      return { sfx: ev.type };
    case "pryTick":
      return { sfx: ev.silent ? "pickTick" : "pryTick" };
    case "rareLoot":
      return { sfx: "rareLoot" };
    case "preciousLoot":
      return { sfx: "preciousLoot", stinger: "discover" };
    case "bossIntro":
      return { stinger: "boss", ui: true };
    case "bossDown":
      return { stinger: "victory", ui: true };
    case "plane":
      return { sfx: "plane", ui: true };
    case "radio":
      return { sfx: "radioStatic", ui: true };
    // ---------- v0.25「长夜」 ----------
    case "lnThunder":
      return { sfx: "thunder", ui: true };
    case "lnScream":
      return { sfx: "scream", stinger: "hordeWarn", ui: true };
    case "lnWave":
      return { sfx: "alarm", stinger: "hordeWarn", ui: true };
    case "lnBoss":
    case "lnLeader":
      return { stinger: "boss", ui: true };
    case "smokeCue":
      return { sfx: "click", voice: true, duck: true };
    case "smoke":
      return { sfx: "gas" };
    case "sabPlant":
      return { sfx: "clank", voice: true, duck: true };
    case "sabBoom":
      return { sfx: "bang", range: 1400 };
    default:
      return null;
  }
}
// 每一种会响的事件（测试用：都要有声音）
export const SOUND_EVENTS = ["swing", "shot", "hit", "hitFlesh", "hitMetal", "spot", "windup", "scream", "hiss", "stomp", "inhale", "grabCue", "reach", "quest", "victory", "alarm", "wave", "level", "travel", "sleep", "trade", "kill", "reload", "loaded", "loot", "eat", "trap", "bite", "shove", "rescue", "roll", "hoe", "plant", "water", "harvest", "craft"];
// v0.24「暗涌」新加的引擎事件
export const U_SOUND_EVENTS = ["fuse", "gas", "breath", "fakerGrab", "spitCue", "spit", "acid", "click", "stalkerCue", "slamCue", "slam", "doorCue", "doorThrow", "doorHit", "bruteStep", "bossRage", "nurseCue", "nurseScream", "pulseCue", "pulse", "armorOff", "rareLoot", "preciousLoot", "pryStart", "pryTick", "pryDone", "plane", "airdropLand", "talkie", "survivorHurt", "dogGrowl", "bossIntro", "bossDown", "radio"];
export const LN_SOUND_EVENTS = ["lnThunder", "lnScream", "lnWave", "lnBoss", "lnLeader", "smokeCue", "smoke", "sabPlant", "sabBoom"];

// 混音：各条线的基础音量（再乘设置里的四个音量）
export const MIX = { music: 0.36, ambience: 0.5, sfx: 0.9, ui: 0.55, voice: 0.85 };
// 远近：700 以外听不到；同时最多 8 个感染者出声；同一只 1.5 秒内不重复
export const SPACE = { range: 700, voices: 8, voiceGap: 1.5, total: 28, muffle: 900 };
// 音乐：脱离战斗 6 秒后回到探索；切换淡入淡出 2 秒；预兆时压低一半
export const MUSIC = { calm: 6, fade: 2, duck: 0.5, duckTime: 0.8, menu: 0.6 };
