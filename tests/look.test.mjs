// v0.40.0「一套」：界面规范（一套颜色、字、按钮；常驻 7 块；按分辨率放大；2560 镜头 2 倍）。只改样子，不改玩法和存档。
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { legacyCss, LEGACY } from "../scripts/build-legacy-css.mjs";
import { floorCss, inkOf, parseColor, surfOf, splitSelectors, INK } from "../scripts/build-ui-floor.mjs";
import { isDesk, uiZoom, applyLook, pageOf, statusRows, lookHud, resetLookHud, spreadBoxes, legendKind } from "../dist/look-ui.js";
import { Renderer as LookRenderer, CAMERA_MAX } from "../dist/look-renderer.js";
import { Renderer as CampaignRenderer } from "../dist/campaign-renderer.js";
import { Engine, freshState } from "../dist/campaign.js";
import { styleOrder } from "./style-order.mjs";

const read = (f) => readFileSync(new URL("../dist/" + f, import.meta.url), "utf8");

// ---------- 样式文件 ----------
test("styles: the 36 old sheets are one legacy layer in their old order, the floor and the new rules come after and are up to date", () => {
  assert.equal(read("legacy.css"), legacyCss(), "legacy.css matches its sources (run node scripts/build-legacy-css.mjs)");
  assert.equal(read("ui-floor.css"), floorCss(), "ui-floor.css matches the old sheets (run node scripts/build-ui-floor.mjs)");
  const html = read("index.html");
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(links, ["legacy.css", "ui-floor.css", "ui.css"]);
  assert.equal(LEGACY.length, 36);
  assert.equal(new Set(LEGACY).size, 36);
  const order = styleOrder();
  assert.equal(order.at(-1), "ui.css");
  assert.ok(order.indexOf("simple.css") < order.indexOf("ui-floor.css"));
  // 层：ui-important 在 legacy 前面（压得过旧的 !important），新规范不进层
  assert.match(read("legacy.css"), /^\/\*[\s\S]*?\*\/\n@layer ui-important, legacy;\n@layer legacy \{/);
  assert.doesNotMatch(read("ui.css"), /@layer/);
});

test("styles: the floor sheet turns every old size under 14 px into 14 px and every hard-coded text colour into one of the eight", () => {
  const css = read("ui-floor.css");
  assert.ok(css.includes("font-size: var(--fs-s, 14px)"));
  // 旧样式里比 14 小的字，都在里面（取几条）
  for (const sel of [".hot-slot .key", ".inventory-cell small", "#toasts .toast", ".sx-card .sx-good"]) assert.ok(css.includes(sel), sel);
  // 字色只用这 8 种
  const used = new Set([...css.matchAll(/color: var\(--c-([a-z0-9-]+)\)/g)].map((m) => m[1]));
  for (const k of used) assert.ok(Object.hasOwn(INK, k) || k.endsWith("-bg") || ["panel", "panel-2", "card", "card-hi"].includes(k), k);
  assert.equal(Object.keys(INK).length, 8);
  // 按意思分颜色
  assert.equal(inkOf(parseColor("#ddc98c")), "ink-2", "beige body text stays plain");
  assert.equal(inkOf(parseColor("#efe2b4")), "ink");
  assert.equal(inkOf(parseColor("#e06a7a")), "danger");
  assert.equal(inkOf(parseColor("#ffc0ae")), "danger", "pale red is still a warning colour");
  assert.equal(inkOf(parseColor("#9fd16a")), "good");
  assert.equal(inkOf(parseColor("#c4ab68")), "warn");
  assert.equal(inkOf(parseColor("#3a1c0a")), "on-ember", "dark text on orange stays dark");
  assert.equal(inkOf(parseColor("#7d6a3a")), "ink-3");
  // 底色：深的面统一，亮的色块（进度条）不动；旧版绿色的面变回木头色，真正“好事”的绿留着
  assert.equal(surfOf(parseColor("#8fd07a")), null);
  assert.equal(surfOf(parseColor("#202a26")), "card-hi");
  assert.equal(surfOf(parseColor("#293b2a")), "card-hi");
  assert.equal(surfOf(parseColor("#2c4a24")), "good-bg");
  // 拆选择器不拆括号里的逗号
  assert.deepEqual(splitSelectors(".a:not(.b, .c) d, .e[x='1,2']"), [".a:not(.b, .c) d", ".e[x='1,2']"]);
});

test("styles: the rules — tokens, 14 px floor, contrast of every token on every panel ≥ 4.5:1", () => {
  const css = read("ui.css");
  const token = (name) => css.match(new RegExp("--c-" + name + ":\\s*(#[0-9a-f]{6})", "i"))?.[1];
  const L = (hex) => {
    const [r, g, b] = parseColor(hex).map((v) => v / 255).slice(0, 3).map((v) => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const ratio = (a, b) => (Math.max(L(a), L(b)) + 0.05) / (Math.min(L(a), L(b)) + 0.05);
  for (const t of ["ink", "ink-2", "ink-3", "ember-hi", "warn", "good", "danger"])
    for (const bg of ["panel", "panel-2", "card", "card-hi"]) assert.ok(ratio(token(t), token(bg)) >= 4.5, t + " on " + bg + " " + ratio(token(t), token(bg)).toFixed(2));
  assert.ok(ratio(token("on-ember"), token("ember")) >= 4.5, "dark text on the orange button");
  assert.match(css, /--fs-s: 14px;/);
  assert.match(css, /--fs-b: 15px;/);
  // 像素体只用 24 的倍数
  for (const m of css.matchAll(/font: [^;]*var\(--f-px\)/g)) assert.match(m[0], /var\(--fs-px\)|96px|48px|36px/, m[0]);
  // 只对电脑：全部规则挂在 html.desk 下面（手机照旧）
  const sels = css.replace(/\/\*[\s\S]*?\*\//g, "").match(/[^{}]+(?=\{)/g).map((s) => s.trim()).filter((s) => s && !s.startsWith("@") && !/^(from|to|\d+%)/.test(s));
  for (const s of sels) for (const part of splitSelectors(s)) assert.match(part.trim(), /^html(\.desk|:not\(\.desk\))/, part.trim());
});

test("styles: eight surfaces — button states never add a background colour, one primary per page (actions inside a row of cards are secondary)", () => {
  const css = read("ui.css");
  // 八种面
  for (const t of ["panel-2", "panel", "card", "card-hi", "ember", "danger-bg"]) assert.match(css, new RegExp("--c-" + t + ":\\s*#[0-9a-f]{6};"), t);
  // 主按钮悬停、按下还是主色（亮一点、暗一点），不能按的和次按钮不能按的一个样子；去掉的几种颜色不再出现
  assert.doesNotMatch(css, /#3b2c20|#c96a2a|#ffd2c8|#c06a2a/i);
  const primaryHover = css.match(/button:is\(\.primary, \.sx-primary\):hover:not\(:disabled\) \{([^}]*)\}/)[1];
  assert.match(primaryHover, /background: var\(--c-ember\);/);
  const primaryOff = css.match(/button:is\(\.primary, \.sx-primary\):disabled \{([^}]*)\}/)[1];
  assert.match(primaryOff, /background: var\(--c-panel-2\);/);
  // 一排卡片里各自的主按钮降成次按钮
  assert.match(css, /:is\(\.recipe-grid \.recipe, \.story-choice article, \.settings-section, details\.sx-msg\) button:is\(\.primary, \.sx-primary\):not\(:disabled\) \{\s*background: var\(--c-card\);/);
  // 描边也有名字
  for (const t of ["line-lo", "ember-line", "danger-line", "warn-line"]) assert.match(css, new RegExp("--c-" + t + ":\\s*#[0-9a-f]{6};"), t);
});

// ---------- 放大、页名 ----------
test("zoom: the interface grows with the window — 1366 ×1, 1920 ×1.25, 2560 ×1.7, never under 1 or over 2; phones and small windows keep the old look", () => {
  assert.equal(uiZoom(1366, 768), 1);
  assert.equal(uiZoom(1920, 1080), 1.25);
  assert.equal(uiZoom(2560, 1440), 1.7);
  assert.equal(uiZoom(1280, 720), 1);
  assert.equal(uiZoom(3840, 2160), 2);
  assert.equal(uiZoom(2560, 1080), 1.25, "a wide screen goes by its height");
  const win = (w, h, coarse = false) => ({ innerWidth: w, innerHeight: h, matchMedia: (q) => ({ matches: q.includes("coarse") ? coarse : false }) });
  assert.equal(isDesk(win(1366, 768)), true);
  assert.equal(isDesk(win(1920, 1080)), true);
  assert.equal(isDesk(win(1024, 768)), false);
  assert.equal(isDesk(win(1366, 768, true)), false, "touch screens keep the phone look");
  assert.equal(isDesk(win(390, 844, true)), false);
  // 写到 <html> 上
  const props = {},
    cls = new Set();
  const doc = { documentElement: { classList: { toggle: (c, on) => (on ? cls.add(c) : cls.delete(c)) }, style: { setProperty: (k, v) => (props[k] = v) } } };
  assert.equal(applyLook(doc, win(1920, 1080)), 1.25);
  assert.ok(cls.has("desk"));
  assert.equal(props["--uiz"], "1.25");
  assert.equal(props["--vw-z"], "1536px");
  assert.equal(props["--vh-z"], "864px");
  applyLook(doc, win(390, 844, true));
  assert.ok(!cls.has("desk"));
  assert.equal(props["--uiz"], "1");
  // 页名
  assert.deepEqual(pageOf("outpost", {}, "people"), { page: "outpost", view: "people" });
  assert.deepEqual(pageOf("sx", { view: "menus" }), { page: "sx", view: "menus" });
  assert.deepEqual(pageOf("build"), { page: "build", view: "" });
  // 早开的那一段和脚本里的算法一样
  const html = read("index.html");
  assert.match(html, /Math\.round\(0\.9\*Math\.min\(w\/1366,h\/768\)\*20\)\/20/);
  assert.match(html, /w>=1280&&h>=680/);
});

// ---------- 镜头 ----------
test("camera: at most 2× now — 2560 wide sees the same 1280 as 1920; up to 2050 wide nothing changes", () => {
  assert.equal(CampaignRenderer, LookRenderer, "the scene is drawn by the new top layer");
  assert.equal(CAMERA_MAX, 2);
  const scale = (w, h, zoom = 1) => LookRenderer.prototype.cameraScale.call({ w, h, v: true, dpr: 1 }, { settings: { zoom } });
  assert.equal(scale(1366, 600), 1);
  assert.equal(scale(1920, 880), 1.5);
  assert.equal(scale(2560, 1165), 2);
  assert.equal(2560 / scale(2560, 1165), 1280);
  assert.equal(1920 / scale(1920, 880), 1280);
  assert.equal(scale(2048, 1000), 1.5, "just over 1.5 snaps back to 1.5 like before");
  // 设置里的“场景缩放”照样乘上去
  assert.ok(scale(2560, 1165, 0.8) < 2);
});

// ---------- 顶栏 ----------
test("top bar: the three bars, the time, where you are and the menu; gold, food, noise and settings are in the menu's status row instead", () => {
  const html = read("index.html");
  assert.match(html, /<div class="hud-left"><section id="stat-bars"/);
  assert.match(html, /<div class="hud-right"><button class="hud-location"/);
  const css = read("ui.css");
  assert.match(css, /\.hud-top :is\(\.hud-brand, \.hud-settings, \.hud-coins, #food-days, #noise-chip:not\(\.warn\):not\(\.danger\)\) \{\s*display: none;/);
  assert.match(css, /\.hud-dock :is\(\.dock-menu, #context, \.dock-hints, #event-entry, \.touch-controls, #buff-summary:empty\) \{\s*display: none;/);
  // 提醒最多 2 条、消息最多 2 条
  assert.match(css, /#alert-bar \.alert-item:nth-child\(n \+ 3\) \{\s*display: none;/);
  assert.match(css, /#toasts \.toast:nth-last-child\(-n \+ 2\) \{\s*display: block;/);
  // 手机上这两个包装不影响原来的排法
  assert.match(css, /html:not\(\.desk\) :is\(\.hud-left, \.hud-right\) \{\s*display: contents;/);
  // 状态行：金、口粮、动静、寒冷
  const e = new Engine(freshState(), () => {});
  e.s.money = 13416;
  const rows = statusRows(e, { food: { text: "口粮 0.1 天", tone: "danger" }, noise: { text: "动静 1.4", tone: "" }, season: { text: "寒潮 2 天", tone: "cold" } });
  assert.deepEqual(rows.map((r) => [r.key, r.name, r.value]), [["money", "金", "13,416"], ["food", "口粮", "0.1 天"], ["noise", "动静", "1.4"], ["cold", "寒冷", "寒潮 2 天"]]);
  assert.equal(rows[1].tone, "danger");
});

test("top bar: a bar under a quarter blinks, gold changes float a chip next to the bars, the menu button gets a dot for news", () => {
  resetLookHud();
  const made = [];
  const el = (cls = "") => {
    const o = {
      className: cls,
      classList: {
        set: new Set(cls.split(" ").filter(Boolean)),
        toggle(c, on) {
          on ? this.set.add(c) : this.set.delete(c);
        },
        contains(c) {
          return this.set.has(c);
        },
      },
      style: {},
      children: [],
      appendChild(c) {
        this.children.push(c);
        made.push(c);
      },
      querySelector() {
        return null;
      },
      setAttribute() {},
      remove() {},
    };
    return o;
  };
  const bar = (w) => {
    const s = el("stat");
    s.querySelector = (q) => (q === ".bar i" ? { style: { width: w } } : null);
    return s;
  };
  const stats = [bar("100%"), bar("20%")],
    phone = el("hud-phone"),
    top = el("hud-top");
  const doc = {
    documentElement: { classList: { contains: (c) => c === "desk" } },
    querySelectorAll: (q) => (q === "#stat-bars .stat" ? stats : []),
    querySelector: (q) => (q === ".hud-phone" ? phone : q === ".hud-top" ? top : null),
    createElement: () => el(),
  };
  const e = new Engine(freshState(), () => {});
  e.s.money = 100;
  lookHud(e, doc);
  assert.equal(stats[0].classList.contains("low"), false);
  assert.equal(stats[1].classList.contains("low"), true);
  assert.equal(made.length, 0, "no chip on the first look");
  e.s.money = 140;
  lookHud(e, doc);
  assert.equal(made.length, 1);
  assert.equal(made[0].textContent, "+40 金");
  assert.equal(made[0].className, "look-coin");
  e.s.money = 130;
  lookHud(e, doc);
  assert.equal(made.at(-1).textContent, "−10 金");
  assert.equal(made.at(-1).className, "look-coin minus");
});

// ---------- 地图 ----------
test("map: the two legends move to the side panel, labels on the map step aside from the places they would cover (nearest free spot, danger first, never off the map)", () => {
  assert.deepEqual(["实线：通路开放", "虚线：尚待开通", "亮灯的路：两端都已安全", "淡圈：安全范围"].map(legendKind), ["solid", "dash", "lit", "ring"]);
  const place = { x: 100, y: 100, w: 128, h: 90 };
  const over = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  // 不压着就不动
  assert.deepEqual(spreadBoxes([place], [{ x: 400, y: 120, w: 100, h: 26 }], 1000, 700), [[0, 0]]);
  // 压着：挪到最近的空处，挪完不压任何地点
  const [m] = spreadBoxes([place], [{ x: 200, y: 120, w: 100, h: 26 }], 1000, 700);
  assert.ok(m && (m[0] || m[1]));
  assert.ok(!over({ x: 200 + m[0], y: 120 + m[1], w: 100, h: 26 }, place));
  assert.ok(Math.hypot(m[0], m[1]) <= 100, "stays close to where it was");
  // 两块牌子叠在一起：危险的那块先占最近的位置，另一块再让开，两块也不互相压
  const two = spreadBoxes([place], [{ x: 200, y: 120, w: 100, h: 26 }, { x: 200, y: 120, w: 100, h: 26, danger: true }], 1000, 700);
  const a = { x: 200 + two[0][0], y: 120 + two[0][1], w: 100, h: 26 },
    b = { x: 200 + two[1][0], y: 120 + two[1][1], w: 100, h: 26 };
  assert.deepEqual(two[1], m);
  assert.ok(!over(a, b) && !over(a, place) && !over(b, place));
  // 没地方挪：原地不动（null），也不挪到图外面
  assert.deepEqual(spreadBoxes([{ x: 0, y: 0, w: 1000, h: 700 }], [{ x: 400, y: 120, w: 100, h: 26 }], 1000, 700), [null]);
  for (const [dx, dy] of spreadBoxes([{ x: 0, y: 0, w: 120, h: 700 }], [{ x: 2, y: 2, w: 100, h: 26 }], 1000, 700)) {
    assert.ok(2 + dx >= 2 && 2 + dy >= 2);
  }
  // 接上了：地图页排一遍；样式里有图例和拖动的样子
  assert.match(read("look-ui.js"), /if \(page === "map"\) atlasTidy\(modal\);/);
  const css = read("ui.css");
  for (const sel of [".look-atlas-legend", ".lg-dash", ".lg-lit", ".lg-ring", ".atlas-scroll.look-dragging", ".far-pin.look-route-pin"]) assert.ok(css.includes(sel), sel);
});

// ---------- 接线 ----------
test("wiring: game.js imports the look, marks each page, refits icons after the build page is laid out, updates the hotbar at once, Esc opens the ten menus", () => {
  const g = read("game.js");
  assert.match(g, /import \{applyLook,lookAfterRender,lookHud\} from '\.\/look-ui\.js';/);
  assert.match(g, /function resize\(\)\{applyLook\(\);/);
  assert.match(g, /if\(lookAfterRender\(\$\('#modal'\),\{menu,args:menuArgs,view:outpostUI\.view,engine,hud\}\)\)styleIcons\(\$\('#modal'\)\);/);
  assert.match(g, /paintNotices\(\);lookHud\(engine\);\}/);
  assert.match(g, /engine\.s\.slot=slot;engine\.reload=null;hudCache='';[^}]*if\(started\)updateHUD\(\);\}/);
  assert.match(g, /if\(menu\)closeMenu\(\);else showMenu\('sx',\{view:'menus'\}\);return;\}/);
  // 背包里“从哪来”和说明一样时不再写第二遍
  assert.match(g, /from===it\.desc\|\|from===engine\.itemPurpose\(id\)/);
});

test("words: no developer words in the new layer, and the version is 0.40.0 一套 in the title and settings", () => {
  for (const f of ["look-ui.js", "look-renderer.js", "ui.css"]) {
    const t = read(f).replace(/\/\/[^\n]*|\/\*[\s\S]*?\*\//g, "");
    assert.doesNotMatch(t, /机制参考|机制借鉴|已体验|试玩|待验证|待完善|可玩点|feature-number|district-number|progress\.html|undefined|NaN/, f);
  }
  const v = read("version.js");
  assert.match(v, /GAME_VERSION='v0\.40\.0'/);
  assert.match(v, /GAME_EDITION='一套'/);
  assert.match(read("index.html"), /<title>余烬农场 v0\.40\.0 · 一套<\/title>/);
});

test("saves: nothing new is written — the look never touches the save", () => {
  const e = new Engine(freshState(), () => {});
  const text = e.serialize();
  const back = new Engine(Engine.parse(text), () => {});
  assert.deepEqual(Object.keys(JSON.parse(back.serialize())).sort(), Object.keys(JSON.parse(text)).sort());
  for (const f of ["look-ui.js", "look-renderer.js"]) assert.doesNotMatch(read(f), /localStorage|serialize|\.s\.[a-z]+\s*=/, f);
});
