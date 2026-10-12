// v0.25.0：把 game.js 用到的全部模块写进 index.html 的 <link rel="modulepreload">。
// 不写的话浏览器要一层层发现 import（现在有 25 层），网慢时光是等文件就要一两秒；写上以后一开始就一起下载。
// 用法：node scripts/modulepreload.mjs        更新 index.html
//       node scripts/modulepreload.mjs --check 只检查，不一致时退出码 1（测试里会跑）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
const START = "<!-- modulepreload:start -->",
  END = "<!-- modulepreload:end -->";
// 静态 import / export … from（压缩过的写法也算）
const IMPORT = /(?:^|[;\s}])(?:import|export)\s*(?:[\w*{}\s,$]*?from\s*)?["'](\.\/[^"']+\.js)["']/g;

export function moduleGraph(entry = "game.js", dir = root) {
  const deps = new Map();
  const visit = (file) => {
    if (deps.has(file)) return;
    const src = fs.readFileSync(path.join(dir, file), "utf8"),
      out = [...new Set([...src.matchAll(IMPORT)].map((m) => m[1].slice(2)))];
    deps.set(file, out);
    out.forEach(visit);
  };
  visit(entry);
  return deps;
}

// 按依赖从深到浅排：先要的先发
export function preloadList(dir = root) {
  const deps = moduleGraph("game.js", dir),
    depth = new Map();
  const d = (f, stack = new Set()) => {
    if (depth.has(f)) return depth.get(f);
    if (stack.has(f)) return 0;
    stack.add(f);
    let v = 0;
    for (const x of deps.get(f) || []) v = Math.max(v, 1 + d(x, stack));
    stack.delete(f);
    depth.set(f, v);
    return v;
  };
  return [...deps.keys()].sort((a, b) => d(a) - d(b) || a.localeCompare(b));
}

export function preloadBlock(dir = root) {
  return START + preloadList(dir).map((f) => `<link rel="modulepreload" href="${f}">`).join("") + END;
}

export function updateIndex(html, dir = root) {
  const block = preloadBlock(dir);
  if (html.includes(START)) return html.replace(new RegExp(START + "[\\s\\S]*?" + END), block);
  return html.replace("</head>", block + "</head>");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const file = path.join(root, "index.html"),
    html = fs.readFileSync(file, "utf8"),
    next = updateIndex(html);
  if (process.argv.includes("--check")) {
    if (next !== html) {
      console.error("index.html 里的 modulepreload 列表和实际用到的模块不一致：请运行 node scripts/modulepreload.mjs");
      process.exit(1);
    }
    console.log("modulepreload ok:", preloadList().length, "modules");
  } else {
    fs.writeFileSync(file, next);
    console.log("index.html updated:", preloadList().length, "modules");
  }
}
