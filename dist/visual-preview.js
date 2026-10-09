// 画面样张专用的预览条：切换新旧画面、看不同时间和天气、摆一座成型的农场。
// 时间和天气只改画面，不改存档；正式版本不会带这条。
import { VIS, setVisual } from "./visual-renderer.js";
import { BUILDINGS, CROPS as CROP_DATA } from "./data.js";

const TIMES = [
  ["", "实时"],
  ["380", "清晨"],
  ["780", "中午"],
  ["1070", "傍晚"],
  ["1290", "夜里"],
];
const WEATHERS = [
  ["", "实况"],
  ["晴朗", "晴"],
  ["小雨", "小雨"],
  ["暴雨", "暴雨"],
  ["酸雨", "酸雨"],
  ["高温", "高温"],
];

// 一座成型的农场：几种作物各个阶段、常用的建筑。只在样张里有。
const SHOW = [
  ["greenhouse", 1180, 300],
  ["workbench", 1080, 300],
  ["weaponbench", 1170, 372],
  ["breeder", 1030, 384],
  ["canner", 1110, 444],
  ["solar", 1290, 440],
  ["drone", 1300, 530],
  ["tower", 1420, 262],
  ["rain", 820, 384],
  ["irrigation", 700, 420],
  ["lamp", 862, 470],
  ["lamp", 330, 650],
  ["coop", 1200, 622],
  ["stall", 1250, 772],
  ["bed", 1372, 772],
  ["fence", 260, 762],
  ["fence", 334, 762],
  ["scarecrow", 520, 562],
];
const CROPS = ["radish", "potato", "tomato", "corn", "bean", "herb", "pumpkin", "cotton", "rye"];

export function mountPreview(ctx) {
  const doc = globalThis.document;
  if (!doc?.body || doc.getElementById("vis-preview")) return;
  const bar = doc.createElement("div");
  bar.id = "vis-preview";
  bar.className = "vis-preview";
  const group = (key, list) => list.map(([v, label]) => `<button type="button" data-vp="${key}" data-v="${v}">${label}</button>`).join("");
  bar.innerHTML = `<b>画面样张</b><span class="vp-group">${group("t", TIMES)}</span><span class="vp-group">${group("w", WEATHERS)}</span><span class="vp-group"><button type="button" data-vp="style">切到原画面</button><button type="button" data-vp="demo">摆一座成型的农场</button><button type="button" data-vp="hide">收起</button></span>`;
  doc.body.append(bar);
  const sync = () => {
    for (const b of bar.querySelectorAll("button[data-vp]")) {
      const k = b.dataset.vp,
        v = b.dataset.v;
      if (k === "t") b.classList.toggle("on", String(VIS.preview.minute ?? "") === v);
      if (k === "w") b.classList.toggle("on", String(VIS.preview.weather ?? "") === v);
      if (k === "style") b.textContent = VIS.on ? "切到原画面" : "切到新画面";
    }
    bar.classList.toggle("old", !VIS.on);
  };
  bar.addEventListener("click", (ev) => {
    const b = ev.target.closest?.("button[data-vp]");
    if (!b) return;
    ev.stopPropagation();
    const k = b.dataset.vp,
      v = b.dataset.v;
    if (k === "t") VIS.preview.minute = v ? Number(v) : null;
    else if (k === "w") VIS.preview.weather = v || null;
    else if (k === "style") setVisual(!VIS.on);
    else if (k === "hide") bar.classList.toggle("mini");
    else if (k === "demo") ctx.toast(buildShowcase(ctx.engine()));
    sync();
    b.blur();
    doc.getElementById("world")?.focus?.();
  });
  sync();
}

function buildShowcase(e) {
  if (!e || e.s.region !== "farm") return "先回到农场，再摆成型的农场。";
  const s = e.s;
  s.debris = [];
  for (let i = 0; i < Math.min(36, s.plots.length); i++) {
    const p = s.plots[i];
    p.tilled = true;
    if (i % 9 === 8 && i > 20) continue;
    const crop = CROPS[i % 9];
    p.crop = crop;
    // 成熟、刚长、长到一半、快熟
    p.growth = [1, 0.1, 0.4, 0.7][(i * 7) % 4] * (CROP_DATA[crop]?.grow ?? 10);
    if (i % 4 === 0) p.wateredDay = s.day;
  }
  let added = 0;
  for (const [type, x, y] of SHOW) {
    const id = "vp-" + type + "-" + x;
    if (s.buildings.some((b) => b.id === id)) continue;
    s.buildings.push({ id, type, x, y, rotation: 0, hp: BUILDINGS[type]?.hp ?? 100 });
    added++;
  }
  if (e.c && (e.c.energy || 0) < 20) e.c.energy = 20;
  return added ? "摆好了：作物的各个阶段和常用建筑（只在样张里有）。" : "成型的农场已经摆好了。";
}
