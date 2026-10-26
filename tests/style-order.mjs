// v0.40：样式文件的先后。index.html 里只链 legacy.css（36 个旧样式按原来的顺序合成、整个放在 legacy 层）、ui-floor.css、ui.css，
// 所以“谁在谁后面”按展开以后的顺序算。
import { readFileSync } from "node:fs";
import { LEGACY } from "../scripts/build-legacy-css.mjs";

export function styleOrder() {
  const html = readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");
  const out = [];
  for (const m of html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)) {
    if (m[1] === "legacy.css") out.push(...LEGACY);
    else out.push(m[1]);
  }
  return out;
}
