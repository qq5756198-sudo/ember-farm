// v0.40.0「一套」：字最小 14 像素，字色只用规范里的 8 种。
// 旧样式里凡是把字设得比 14 像素小的规则（12px、.75rem、.8em、font 简写……），在电脑上一律改成 14 像素；
// 旧样式里写死的字色，换成规范里意思最接近的那一种（深字、三档浅字、余烬橙、警告黄、好事绿、危险红）。
// 生成 dist/ui-floor.css，排在 legacy.css 后面、ui.css 前面：ui.css 里明确写了字号的地方以 ui.css 为准。
// 用法：node scripts/build-ui-floor.mjs          重新生成
//       node scripts/build-ui-floor.mjs --check  只检查，不一致时退出码 1（测试里会跑）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { LEGACY } from "./build-legacy-css.mjs";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");

// 去掉注释，按 { } 拆出“选择器 { 声明 }”（@media 里面的也算，条件不要：在电脑上统一不小于 14）
function rules(css) {
  css = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const out = [];
  let i = 0;
  const walk = (end) => {
    while (i < end) {
      const open = css.indexOf("{", i);
      if (open < 0 || open >= end) return;
      const head = css.slice(i, open).trim();
      // 找到配对的 }
      let depth = 1,
        j = open + 1;
      while (j < css.length && depth) {
        if (css[j] === "{") depth++;
        else if (css[j] === "}") depth--;
        j++;
      }
      const body = css.slice(open + 1, j - 1);
      if (head.startsWith("@media") || head.startsWith("@supports") || head.startsWith("@layer")) {
        const save = i;
        i = open + 1;
        walk(j - 1);
        i = j;
        void save;
      } else if (!head.startsWith("@")) {
        out.push([head, body]);
        i = j;
      } else i = j;
    }
  };
  walk(css.length);
  return out;
}
const tooSmall = (body) => {
  const m = body.match(/(?:^|;)\s*font-size\s*:\s*([\d.]+)(px|rem|em)\b/i) || body.match(/(?:^|;)\s*font\s*:[^;]*?\b([\d.]+)(px|rem|em)\s*(?:\/|\s)/i);
  if (!m) return false;
  const v = parseFloat(m[1]),
    u = m[2].toLowerCase();
  if (u === "px") return v < 14;
  if (u === "rem") return v < 0.875;
  return v < 0.94; // em：按 15 像素的正文算
};

// ---------- 字色：旧样式里的字色一律换成规范里最接近的那一种（8 种） ----------
export const INK = {
  ink: [241, 227, 194],
  "ink-2": [201, 180, 138],
  "ink-3": [168, 148, 108],
  "ember-hi": [255, 180, 94],
  warn: [233, 192, 90],
  good: [143, 208, 122],
  danger: [242, 106, 85],
  "on-ember": [26, 15, 8],
};
const hex = (h) => {
  h = h.replace("#", "");
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16), h.length >= 8 ? parseInt(h.slice(6, 8), 16) / 255 : 1];
};
export function parseColor(v) {
  v = String(v).trim().toLowerCase();
  let m;
  if ((m = v.match(/^#([0-9a-f]{3,8})$/))) return hex(m[1]);
  if ((m = v.match(/^rgba?\(([^)]+)\)$/))) {
    const p = m[1].split(/[\s,\/]+/).filter(Boolean).map(parseFloat);
    return [p[0], p[1], p[2], p.length > 3 ? p[3] : 1];
  }
  if (v === "white") return [255, 255, 255, 1];
  if (v === "black") return [0, 0, 0, 1];
  return null;
}
// sRGB → CIELAB
export function lab([r, g, b]) {
  const f = (c) => {
    c /= 255;
    return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  const R = f(r),
    G = f(g),
    B = f(b);
  const X = (R * 0.4124 + G * 0.3576 + B * 0.1805) / 0.95047,
    Y = R * 0.2126 + G * 0.7152 + B * 0.0722,
    Z = (R * 0.0193 + G * 0.1192 + B * 0.9505) / 1.08883;
  const t = (v) => (v > 0.008856 ? Math.cbrt(v) : 7.787 * v + 16 / 116);
  return [116 * t(Y) - 16, 500 * (t(X) - t(Y)), 200 * (t(Y) - t(Z))];
}
// 按意思分：很暗的是“橙底上的深字”；有颜色的按色相分危险 / 橙 / 警告 / 好事；其余按明暗分三档字
export function inkOf(rgb) {
  const [L, a, b] = lab(rgb),
    C = Math.hypot(a, b),
    h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  if (L < 32) return "on-ember";
  // 偏红的（哪怕很淡）都是“不好”；偏绿的是“好事”；橙和黄要更艳才算，免得米黄的正文被当成警告
  if (C > 22 && (h < 45 || h >= 330)) return "danger";
  if (C > 28 && h >= 105 && h < 170) return "good";
  if (C > 36) {
    if (h < 72) return "ember-hi";
    if (h < 105) return "warn";
  }
  if (L >= 86) return "ink";
  if (L >= 70) return "ink-2";
  return "ink-3";
}
const same = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
// ---------- 底色：深色的面（字压在上面的那种）换成规范里的几种 ----------
export const SURF = {
  "panel-2": [22, 16, 12],
  panel: [27, 20, 16],
  card: [37, 29, 23],
  "card-hi": [46, 36, 28],
  sel: [58, 36, 20],
  "danger-bg": [90, 30, 22],
  "good-bg": [31, 51, 32],
};
// 画面性质的东西（地图、进度条、头像、图标、心……）不动
const PICTURE = /atlas|map|bar\b|-bar|bar-|fill|meter|progress|dur\b|track|swatch|pip|dot|heart|chart|spark|preview|canvas|doll|icon|sprite|photo|frame|ring|range|slider|toggle|switch|scroll/i;
export function surfOf(rgb) {
  const [L, a, b] = lab(rgb),
    C = Math.hypot(a, b),
    h = ((Math.atan2(b, a) * 180) / Math.PI + 360) % 360;
  if (L > 34) return null; // 亮的是色块、进度条，不是“面”
  if (C > 18 && h >= 100 && h < 200) return "good-bg";
  if (C > 14 && (h < 40 || h >= 330)) return "danger-bg";
  if (C > 16 && h < 75) return "sel";
  if (L < 6) return "panel-2";
  if (L < 9) return "panel";
  if (L < 13.5) return "card";
  return "card-hi";
}
// 按最外层的逗号拆选择器（:not(a, b)、:is(…)、[x="a,b"] 里的逗号不拆）
export function splitSelectors(head) {
  const out = [];
  let depth = 0,
    quote = "",
    cur = "";
  for (const ch of head) {
    if (quote) {
      if (ch === quote) quote = "";
    } else if (ch === '"' || ch === "'") quote = ch;
    else if (ch === "(" || ch === "[") depth++;
    else if (ch === ")" || ch === "]") depth--;
    else if (ch === "," && depth === 0) {
      if (cur.trim()) out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function floorCss(dir = root) {
  const picked = new Set(),
    inks = {},
    surfs = {},
    strong = [];
  for (const f of LEGACY) {
    const css = fs.readFileSync(path.join(dir, f), "utf8");
    for (const [head, body] of rules(css)) {
      const sels = splitSelectors(head);
      if (tooSmall(body)) for (const sel of sels) picked.add(sel);
      // 旧样式里带 !important 的字色、字号：普通规则压不过，单独放进 ui-important 层
      const mi = body.match(/(?:^|;|\s)color\s*:\s*([^;!}]+)!\s*important/i),
        ci = mi && parseColor(mi[1]);
      if (ci && !Object.values(INK).some((t) => same(t, ci))) strong.push([sels, "color", "var(--c-" + inkOf(ci) + ")"]);
      if (/font-size\s*:[^;]*!\s*important/i.test(body) && tooSmall(body.replace(/!\s*important/gi, ""))) strong.push([sels, "font-size", "var(--fs-s, 14px)"]);
      const mb = body.match(/(?:^|;|\s)background(?:-color)?\s*:\s*(#[0-9a-f]{3,8}|rgba?\([^)]*\))\s*(?:;|$)/i),
        cb = mb && parseColor(mb[1]);
      if (cb && (cb[3] ?? 1) > 0.55) {
        const k = surfOf(cb);
        if (k && !Object.values(SURF).some((t) => same(t, cb))) for (const sel of sels) if (!PICTURE.test(sel)) (surfs[k] ||= new Set()).add(sel);
      }
      const m = body.match(/(?:^|;|\s)color\s*:\s*([^;!}]+)/i);
      const c = m && parseColor(m[1]);
      if (!c || Object.values(INK).some((t) => same(t, c))) continue;
      const k = inkOf(c);
      for (const sel of sels) (inks[k] ||= new Set()).add(sel);
    }
  }
  const plain = [],
    pseudo = [];
  for (const sel of [...picked].sort()) (/::|:(before|after|placeholder|marker)\b/.test(sel) ? pseudo : plain).push(sel);
  const lines = [
    "/* 这个文件是 scripts/build-ui-floor.mjs 生成的，别直接改。",
    "   v0.40.0「一套」：旧样式里比 14 像素小的字，在电脑上一律 14 像素；写死的字色换成规范里最接近的那一种（ui.css 里写了的以 ui.css 为准）。 */",
  ];
  const chunk = (arr, n) => Array.from({ length: Math.ceil(arr.length / n) }, (_, k) => arr.slice(k * n, k * n + n));
  for (const part of chunk(plain, 40)) lines.push(`html.desk :where(${part.join(", ")}) {\n  font-size: var(--fs-s, 14px);\n}`);
  for (const sel of pseudo) lines.push(`html.desk ${sel} {\n  font-size: var(--fs-s, 14px);\n}`);
  lines.push("/* 字色：换成规范里最接近的那一种 */");
  for (const k of Object.keys(INK)) {
    const all = [...(inks[k] || [])].sort(),
      pl = all.filter((x) => !/::|:(before|after|placeholder|marker)\b/.test(x)),
      ps = all.filter((x) => /::|:(before|after|placeholder|marker)\b/.test(x));
    for (const part of chunk(pl, 40)) lines.push(`html.desk :where(${part.join(", ")}) {\n  color: var(--c-${k});\n}`);
    if (ps.length) lines.push(`${ps.map((x) => "html.desk " + x).join(",\n")} {\n  color: var(--c-${k});\n}`);
  }
  lines.push("/* 底色：深色的面换成规范里的几种 */");
  for (const k of Object.keys(SURF)) {
    const all = [...(surfs[k] || [])].sort(),
      pl = all.filter((x) => !/::|:(before|after|placeholder|marker)\b/.test(x));
    const v = k === "sel" ? "#3a2414" : k === "good-bg" ? "#1f3320" : "var(--c-" + k + ")";
    for (const part of chunk(pl, 40)) lines.push(`html.desk :where(${part.join(", ")}) {\n  background-color: ${v};\n}`);
  }
  if (strong.length) {
    lines.push("/* 旧样式里带 !important 的字色、字号（层在 legacy 前面，所以压得过） */\n@layer ui-important {");
    for (const [sels, prop, val] of strong) lines.push(`  ${sels.map((x) => "html.desk " + x).join(", ")} {\n    ${prop}: ${val} !important;\n  }`);
    lines.push("}");
  }
  return lines.join("\n") + "\n";
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const want = floorCss(),
    file = path.join(root, "ui-floor.css");
  if (process.argv.includes("--check")) {
    const have = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (have !== want) {
      console.error("ui-floor.css 和旧样式对不上：跑一下 node scripts/build-ui-floor.mjs");
      process.exit(1);
    }
    console.log("ui-floor.css 是最新的");
  } else {
    fs.writeFileSync(file, want);
    console.log("写好了 ui-floor.css：" + want.length + " 字节");
  }
}
