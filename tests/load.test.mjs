// v0.25.0「长夜」打磨：载入快、进图不卡。
// - index.html 写着全部模块的 modulepreload（和 game.js 实际 import 的一致），页面一开就让后台先画当前那张地图；
// - 后台画图（bake-worker.js）连农场也能画：农场的“是不是水面”“地面种类”传回来后按地面种类表重新接上，结果一样；
// - 旧画法的地区底图用到时才画，换图时不会把它们都叫出来；
// - 存档时上一份是自己刚写进去、验过的就不再整份验一遍；外面改过的照样验。
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let canvasLib = null;
try {
  canvasLib = require("@napi-rs/canvas");
} catch {
  canvasLib = null;
}
const kit = await import("../dist/pixel-kit.js");
// 后台画图要 transferToImageBitmap：测试里用同一张画布代替
if (canvasLib)
  kit.setCanvasFactory((w, h) => {
    const c = canvasLib.createCanvas(w, h);
    c.transferToImageBitmap = () => ({ width: c.width, height: c.height, canvas: c, close() {} });
    return c;
  });
const { moduleGraph, updateIndex, preloadList } = await import("../scripts/modulepreload.mjs");
const session = await import("../dist/player-session.js");
const farm = await import("../dist/pixel-farm.js");
const visual = await import("../dist/visual-renderer.js");

const html = fs.readFileSync(new URL("../dist/index.html", import.meta.url), "utf8");

test("index.html preloads exactly the modules game.js imports, so the browser fetches them all at once", () => {
  assert.equal(updateIndex(html), html, "run node scripts/modulepreload.mjs after adding or removing a module");
  const graph = moduleGraph("game.js"),
    list = preloadList();
  assert.equal(list.length, graph.size);
  assert.ok(list.includes("game.js") && list.includes("longnight.js") && list.includes("visual-renderer.js"));
  // 每个都是真文件；Worker 自己的入口不在里面
  for (const f of list) assert.ok(fs.existsSync(new URL("../dist/" + f, import.meta.url)), f);
  assert.ok(!list.includes("bake-worker.js"));
  // 只有一段列表
  assert.equal(html.split("<!-- modulepreload:start -->").length, 2);
});

// v0.27.0：载入页上的版本号在脚本载完以前就看得到，v0.26.0 那一版忘了改，一直写着 v0.25.0。
test("the page title and the loading screen show the current version before any script runs", async () => {
  const v = await import("../dist/version.js");
  assert.ok(html.includes(`<title>余烬农场 ${v.GAME_VERSION} · ${v.GAME_EDITION}</title>`), "the title in index.html matches version.js");
  const m = html.match(/<p class="release-label" data-release>([^<]*)<\/p>/);
  assert.ok(m, "the loading screen has a release label");
  assert.equal(m[1], v.GAME_RELEASE, "the loading screen label matches version.js");
});

test("the early bake in index.html only reads the save key, starts the worker and never writes storage", () => {
  const m = html.match(/<script>(\/\* v0\.25：载入页一开[\s\S]*?)<\/script>/);
  assert.ok(m, "inline early-bake script is in the head");
  const src = m[1];
  assert.ok(html.indexOf(m[0]) < html.indexOf("<title>"), "it runs before the stylesheets and modules");
  assert.match(src, /localStorage\.getItem\('ember-farm-save-v1'\)/);
  assert.doesNotMatch(src, /setItem|removeItem|clear\(/);
  assert.match(src, /new window\.Worker\('bake-worker\.js',\{type:'module'\}\)/);
  // 跑一遍：给一个假的浏览器环境，看它挑对地图、把消息存起来
  const posted = [],
    store = { "ember-farm-save-v1": JSON.stringify({ region: "pinewood" }) };
  class FakeWorker {
    constructor(url, opts) {
      this.url = url;
      this.opts = opts;
    }
    postMessage(m) {
      posted.push(m);
    }
  }
  const win = { Worker: FakeWorker, OffscreenCanvas: function () {} };
  new Function("window", "localStorage", src)(win, { getItem: (k) => store[k] ?? null });
  // v0.44：带上存档那天的时节（没有日子按第 1 天，回暖）
  assert.deepEqual(posted, [{ region: "pinewood", season: "thaw" }]);
  assert.equal(win.__emberEarlyBake.region, "pinewood");
  assert.equal(win.__emberEarlyBake.worker.opts.type, "module");
  win.__emberEarlyBake.worker.onmessage({ data: { region: "pinewood", ok: true } });
  assert.equal(win.__emberEarlyBake.msgs.length, 1);
  // 坏存档、没有存档、奇怪的地名：画农场；没有 Worker 就什么也不做
  for (const text of ["{bad", null, JSON.stringify({ region: "../x" })]) {
    posted.length = 0;
    const w2 = { Worker: FakeWorker, OffscreenCanvas: function () {} };
    new Function("window", "localStorage", src)(w2, { getItem: () => text });
    assert.deepEqual(posted, [{ region: "farm", season: "thaw" }]);
  }
  const bare = {};
  new Function("window", "localStorage", src)(bare, { getItem: () => null });
  assert.equal(bare.__emberEarlyBake, undefined);
});

test("the background baker hands the farm back as plain data and the farm lookups come back the same", { skip: !canvasLib && "@napi-rs/canvas not installed" }, async () => {
  const sent = [];
  const prevSelf = globalThis.self;
  globalThis.self = { postMessage: (msg, transfer) => sent.push({ msg, transfer }) };
  try {
    await import("../dist/bake-worker.js?test=1");
    const onmessage = globalThis.self.onmessage;
    assert.equal(typeof onmessage, "function");
    onmessage({ data: { region: "farm" } });
    onmessage({ data: { region: "residential" } });
    onmessage({ data: { region: "nowhere" } });
  } finally {
    globalThis.self = prevSelf;
  }
  const [farmMsg, resMsg, bad] = sent.map((x) => x.msg);
  assert.equal(farmMsg.ok, true);
  assert.equal(farmMsg.region, "farm");
  assert.equal(sent[0].transfer[0], farmMsg.bitmap);
  // 传得过去：里面一个函数也没有
  const hasFn = (v) => typeof v === "function" || (v && typeof v === "object" && Object.values(v).some(hasFn));
  assert.ok(!hasFn(farmMsg.art), "no functions in the farm data");
  assert.ok(farmMsg.art.map instanceof Uint8Array && Array.isArray(farmMsg.art.lights) && Array.isArray(farmMsg.art.puddles));
  // 主线程按地面种类表接回来的查询和原来一样
  const orig = farm.bakeFarm(),
    q = farm.farmQueries(farmMsg.art.map);
  for (let i = 0; i < 400; i++) {
    const x = (i * 37) % 768,
      y = (i * 53) % 512;
    assert.equal(q.surface(x, y), orig.surface(x, y));
    assert.equal(q.water(x, y), orig.water(x, y));
  }
  assert.equal(q.water(-50, 9999), orig.water(-50, 9999), "clamped at the edges like before");
  assert.equal(resMsg.ok, true);
  assert.equal(bad.ok, false);
});

test("old-style district maps are only drawn when something actually needs them", () => {
  let made = 0;
  const a = { sprites: "S0", expansion: "E0", frontier: "F0", farm: "farmPng", ruins: "ruinsPng" };
  // 和 game.js 里一样：第一次用到时画，画一次
  for (const id of ["valley", "pinewood"]) {
    let v = null;
    Object.defineProperty(a, id, { get: () => (v ??= (made++, "old-" + id)), enumerable: true, configurable: true });
  }
  const r = new visual.Renderer({ getContext: () => ({}), width: 10, height: 10 }, a);
  assert.equal(made, 0, "making the renderer does not draw them");
  Object.assign(r, { vWeather: "晴朗", calm: false, indoor: false });
  r.art = { canvas: "new-valley" };
  r.applyAssets(true, "valley");
  assert.equal(a.valley, "new-valley");
  r.art = { canvas: "new-farm" };
  r.applyAssets(true, "farm");
  assert.equal(a.farm, "new-farm");
  assert.equal(made, 0, "switching maps does not draw them either");
  // 离开以后换回原来的：真用到时才画，画一次
  assert.equal(a.valley, "old-valley");
  assert.equal(a.valley, "old-valley");
  assert.equal(made, 1);
  r.art = null;
  r.applyAssets(true, "ruins");
  assert.equal(a.farm, "farmPng", "the farm picture comes back when the new art is gone");
});

test("saving does not re-check the previous save it wrote itself, but still checks one changed elsewhere", () => {
  const store = new Map(),
    storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  let calls = 0;
  const parse = (t) => {
    calls++;
    const v = JSON.parse(t);
    if (!v.ok) throw new Error("bad");
    return v;
  };
  store.set("ember-farm-save-v1", JSON.stringify({ ok: true, n: 0 }));
  session.writeCampaign(storage, JSON.stringify({ ok: true, n: 1 }), parse);
  assert.equal(calls, 2, "a save it did not write is checked before it becomes the backup");
  assert.equal(store.get("ember-farm-backup-v1"), JSON.stringify({ ok: true, n: 0 }));
  calls = 0;
  session.writeCampaign(storage, JSON.stringify({ ok: true, n: 2 }), parse);
  assert.equal(calls, 1, "the one it just wrote is not checked again");
  assert.equal(store.get("ember-farm-backup-v1"), JSON.stringify({ ok: true, n: 1 }));
  // 别的页面改过（坏的）：照样验，坏的不当备份
  store.set("ember-farm-save-v1", JSON.stringify({ ok: false }));
  calls = 0;
  session.writeCampaign(storage, JSON.stringify({ ok: true, n: 3 }), parse);
  assert.equal(calls, 2);
  assert.equal(store.get("ember-farm-backup-v1"), JSON.stringify({ ok: true, n: 1 }));
  // 换了一个检查函数也照样验
  calls = 0;
  const parse2 = (t) => parse(t);
  session.writeCampaign(storage, JSON.stringify({ ok: true, n: 4 }), parse2);
  assert.equal(calls, 2);
  // 刚读进来的那份也算验过
  store.set("ember-farm-save-v1", JSON.stringify({ ok: true, n: 9 }));
  const got = session.readCampaign(storage, parse);
  assert.equal(got.state.n, 9);
  calls = 0;
  session.writeCampaign(storage, JSON.stringify({ ok: true, n: 10 }), parse);
  assert.equal(calls, 1);
  assert.equal(store.get("ember-farm-backup-v1"), JSON.stringify({ ok: true, n: 9 }));
  // 新的那份本身坏了：不写
  assert.throws(() => session.writeCampaign(storage, JSON.stringify({ ok: false }), parse));
  assert.equal(store.get("ember-farm-save-v1"), JSON.stringify({ ok: true, n: 10 }));
});

test("background baking needs a browser: in tests and old browsers maps are drawn on the main thread as before", () => {
  assert.equal(visual.canBakeAway(), false);
  assert.equal(visual.bakeAway("farm"), null);
});
