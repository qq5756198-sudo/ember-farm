// v0.40.0「一套」：把 v0.39 以前的 36 个样式文件按原来的顺序合成一个 dist/legacy.css，整个包进 @layer legacy。
// 新的界面规范 dist/ui.css 不进任何一层，所以不管旧规则写得多具体，都以新规范为准（旧规则里带 !important 的除外）。
// 旧文件原样留着，改旧样式还是改原来的文件，然后跑这个脚本。
// 用法：node scripts/build-legacy-css.mjs          重新生成 legacy.css
//       node scripts/build-legacy-css.mjs --check  只检查，不一致时退出码 1（测试里会跑）
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "dist");
// 顺序就是 v0.39.0 的 index.html 里 <link> 的顺序，不能乱：后面的覆盖前面的
export const LEGACY = [
  "style.css", "rebuild.css", "supply.css", "echoes.css", "clarity.css", "districts.css", "player.css", "beyond.css", "wayfinding.css",
  "alliance.css", "outpost.css", "winter.css", "seasons.css", "farlands.css", "daily.css", "thief.css", "garden.css", "visual-auto.css",
  "visual.css", "gear.css", "feel.css", "undertow.css", "longnight.css", "tidy.css", "bounty.css", "bustle.css", "almanac.css", "kin.css",
  "relight.css", "zest.css", "hope.css", "grow.css", "nightfall.css", "titan.css", "mend.css", "simple.css",
];

export function legacyCss(dir = root) {
  const parts = LEGACY.map((f) => {
    const text = fs.readFileSync(path.join(dir, f), "utf8").replace(/^﻿/, "");
    if (/@import|@charset/.test(text)) throw new Error(f + " 里有 @import / @charset，不能放进层里");
    return `/* ---- ${f} ---- */\n${text.trim()}\n`;
  });
  return (
    "/* 这个文件是 scripts/build-legacy-css.mjs 生成的，别直接改：改原来的样式文件再重新生成。\n" +
    "   v0.39 以前的全部样式，按原来的顺序，放在最底下的 legacy 层；新规范在 ui.css。 */\n" +
    // 层的先后：ui-important 在前，所以 ui-floor.css 里几条带 !important 的能压过旧样式里带 !important 的
    "@layer ui-important, legacy;\n" +
    "@layer legacy {\n" +
    parts.join("\n") +
    "}\n"
  );
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const want = legacyCss(),
    file = path.join(root, "legacy.css");
  if (process.argv.includes("--check")) {
    const have = fs.existsSync(file) ? fs.readFileSync(file, "utf8") : "";
    if (have !== want) {
      console.error("legacy.css 和原来的样式文件对不上：跑一下 node scripts/build-legacy-css.mjs");
      process.exit(1);
    }
    console.log("legacy.css 是最新的（" + LEGACY.length + " 个文件）");
  } else {
    fs.writeFileSync(file, want);
    console.log("写好了 legacy.css：" + LEGACY.length + " 个文件，" + want.length + " 字节");
  }
}
