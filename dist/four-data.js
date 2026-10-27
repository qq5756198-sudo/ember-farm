// v0.44.0「四季」的数：每张图的主色调、走路和站着的小动作、标题页。
// 只管画面，不碰玩法、存档和随机数。

// ---------- 每张图一个主色调 ----------
// 方案：“十五张图各有一个主色调（农场暖绿、集市土黄、雨巷冷蓝、船坞锈绿、气象站冷白……），只在环境色上偏一点，不重画底图。”
// 乘到环境色上（白天、夜里都乘），按亮度归一：夜里亮度一点不变；白天最亮的那一路已经到顶（255）时只能压别的两路，亮度低不到 1%。
export const MAP_HUE = {
  farm: { name: "暖绿", rgb: [1.0, 1.02, 0.94] },
  market: { name: "土黄", rgb: [1.03, 1.0, 0.91] },
  residential: { name: "褪色的砖红", rgb: [1.03, 0.99, 0.97] },
  hospital: { name: "消毒水的青", rgb: [0.96, 1.01, 1.03] },
  warehouse: { name: "铁锈橙", rgb: [1.04, 0.99, 0.93] },
  valley: { name: "水绿", rgb: [0.97, 1.03, 0.99] },
  stationMarket: { name: "灯笼的暖橙", rgb: [1.04, 0.99, 0.92] },
  courtyard: { name: "雨巷的冷蓝", rgb: [0.95, 0.99, 1.06] },
  quarantine: { name: "检疫的黄绿", rgb: [0.99, 1.03, 0.93] },
  railDepot: { name: "铁灰蓝", rgb: [0.97, 0.99, 1.04] },
  pinewood: { name: "雾里的青", rgb: [0.95, 1.02, 1.0] },
  shipyard: { name: "锈绿", rgb: [0.96, 1.02, 0.98] },
  shelter: { name: "钠灯的黄", rgb: [1.05, 1.0, 0.9] },
  frost: { name: "冷白", rgb: [0.98, 1.0, 1.04] },
  archive: { name: "余晖的金", rgb: [1.04, 1.0, 0.92] },
  tunnel: { name: "隧道的灰绿", rgb: [0.96, 1.02, 0.98] },
};
export const lumOf = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
const HUE_NORM = {};
for (const [id, h] of Object.entries(MAP_HUE)) {
  const L = lumOf(h.rgb);
  HUE_NORM[id] = h.rgb.map((v) => v / L);
}
// 地图的主色调（隧道每一层的名字是 tunnel:…，都算隧道）；没有的图不偏
export function hueOf(region) {
  const id = typeof region === "string" && region.startsWith("tunnel:") ? "tunnel" : region;
  return HUE_NORM[id] || null;
}

// ---------- 走路 8 帧、站着的小动作 ----------
// 原来走路 4 帧（脚步 0、迈左、0、迈右），每秒 9 帧；现在每两帧之间补一帧（每秒 18 帧，一步的快慢不变）。
// 站着不动超过 STILL 秒：呼吸（一呼一吸 BREATH 秒，吸气那一半肩膀和头抬一个像素）、每 BLINK 秒眨一次眼（眨 0.15 秒）、
// 每 GLANCE 秒往旁边看一眼（看 0.9 秒）。别人家的人、帮工按自己的名字错开节奏。
export const WALK_FPS = 18;
export const IDLE = { still: 0.6, breath: 2.4, blink: 3.7, blinkFor: 0.15, glance: 9.5, glanceFor: 0.9 };
export const ZOMBIE_FPS = { runner: 20, elite: 8, other: 12 };

// ---------- 标题页 ----------
// 标题页后面的农场：镜头慢慢来回挪（一圈 TITLE.pan 秒，左右 TITLE.dx、上下 TITLE.dy 个单位），
// 这个时节的东西在飘（回暖：花瓣；酷暑：萤火虫和浮尘；秋收：落叶；寒潮：雪），底下往上飘几颗余烬。
// 设置里“减少晃动”开着（或者系统要求少动画）时都不动。
export const TITLE = { pan: 46, dx: 150, dy: 46, motes: 46, embers: 18 };
export const TITLE_MOTES = {
  thaw: { colors: ["#f6f8f2", "#e9dcc0", "#ffdb8c"], fall: 18, sway: 26, size: 2 },
  heat: { colors: ["#ffdb8c", "#f6b05a", "#efe2b4"], fall: -6, sway: 14, size: 2, glow: true },
  harvest: { colors: ["#e5823a", "#bf5a28", "#c4ab68", "#a8433a"], fall: 34, sway: 34, size: 3 },
  cold: { colors: ["#f6f8f2", "#e6ede9", "#cdd9d8"], fall: 26, sway: 12, size: 2 },
};
