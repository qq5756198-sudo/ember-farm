// v0.50「落脚」：新界面的主程序。载入、存档、每一帧、键盘鼠标、常驻的七块、开哪一页。
// 旧界面（game.js 和各层自己拼页面的代码、三十几个样式文件）不再用。
import { Engine, freshState, newGameState } from "./campaign.js";
import { Renderer } from "./campaign-renderer.js";
import { bakeAway } from "./visual-renderer.js";
import { AudioDirector } from "./audio.js";
import { DISTRICT_ART_IDS, districtAsset } from "./district-art.js";
import { BEYOND_ART_IDS, beyondAsset } from "./beyond-art.js";
import { ITEMS, WEAPONS, REGIONS } from "./data.js";
import { SAVE_KEY, PREFS_KEY, GATE1 } from "./chapter-data.js";
import { GAME_VERSION, GAME_EDITION, GAME_RELEASE } from "./version.js";
import { $, $$, esc, paint, setSheets, uiZoom, hhmm } from "./app-kit.js";
import { hudReset, drawRes, resPopHtml, drawClock, drawAlerts, drawGoal, drawHands, drawDock, drawHint, drawBanner, barkHtml } from "./app-hud.js";
import { pageHtml, pageAct, buildHtml } from "./app-pages.js";
import { titleHtml, originHtml, cutHtml, cutCount, drawCutArt, cardHtml, cardAct, cardLocked } from "./app-cards.js";

const BACKUP_KEY = SAVE_KEY + "-backup";
const AUDIO_DEFAULTS = { music: 0.6, ambience: 0.7, sfx: 0.9, cues: false };

let engine = null,
  renderer = null,
  assets = null,
  started = false;
// 现在开着什么：整页、抽屉、小卡、标题页和过场
let view = null; // { kind: "page"|"drawer"|"card"|"scene", name, ui }
let userPaused = false,
  fast = false,
  resOpen = "",
  dismantling = false;
let saveState = "还没存过。",
  saveFailed = false,
  saveIssue = "",
  hasSave = false,
  saveInfo = null;
let audioPrefs = { ...AUDIO_DEFAULTS };
const audio = new AudioDirector();
const keys = new Set(),
  mouse = { x: innerWidth / 2, y: innerHeight / 2, held: false };
const toastLog = [];
let toasts = [],
  barkUntil = 0,
  tip = null,
  tipUntil = 0,
  easeLook = 0,
  easeTick = 0;
let supplyShown = false;
let lastTime = 0,
  hudTimer = 0,
  saveTimer = 0,
  toolTimer = 0,
  alertsNow = [],
  resNow = [];

// ================= 存档：只用一个新的键，旧存档不读也不删 =================
function readSave() {
  saveIssue = "";
  let found = false;
  for (const key of [SAVE_KEY, BACKUP_KEY]) {
    let text = null;
    try {
      text = localStorage.getItem(key);
    } catch {
      saveIssue = "浏览器不让读存档。检查一下浏览器的权限，或者导入一份导出过的存档。";
      return null;
    }
    if (!text) continue;
    found = true;
    try {
      const state = Engine.parse(text);
      if (key === BACKUP_KEY) saveIssue = "主存档读不出来，读的是上一份。";
      return state;
    } catch {}
  }
  if (found) saveIssue = "存档读不出来。可以在设置里导入一份导出过的存档。";
  return null;
}
function save(manual = false) {
  if (!started || !engine) return false;
  try {
    const text = engine.serialize(),
      prev = localStorage.getItem(SAVE_KEY);
    if (prev && prev !== text) localStorage.setItem(BACKUP_KEY, prev);
    localStorage.setItem(SAVE_KEY, text);
    hasSave = true;
    saveFailed = false;
    saveState = "存好了 · " + new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" }) + "。";
    if (manual) toast("存好了。");
    return true;
  } catch {
    if (manual || !saveFailed) {
      toast("浏览器这一次没存上。在设置里导出一份存档。", "warn");
      if (!view) open("card", "confirm", { kind: "savefail" });
    }
    saveFailed = true;
    saveState = "没存上，先导出一份。";
    return false;
  }
}
let saveQueued = false;
function saveSoon() {
  if (saveQueued) return;
  saveQueued = true;
  setTimeout(() => {
    saveQueued = false;
    save();
  }, 300);
}
function readPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREFS_KEY) || "{}"),
      v = (x, d) => (Number.isFinite(x) && x >= 0 && x <= 1 ? x : d);
    audioPrefs = { music: v(p.music, AUDIO_DEFAULTS.music), ambience: v(p.ambience, AUDIO_DEFAULTS.ambience), sfx: v(p.sfx, AUDIO_DEFAULTS.sfx), cues: false };
    const out = {};
    if (Number.isFinite(p.sound) && p.sound >= 0 && p.sound <= 1) out.sound = p.sound;
    if ([0.85, 1, 1.2].includes(p.zoom)) out.zoom = p.zoom;
    return out;
  } catch {
    return {};
  }
}
function writePrefs() {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify({ sound: engine.s.settings.sound, zoom: engine.s.settings.zoom, ...audioPrefs }));
  } catch {}
  syncVolumes();
}
function download(text, name) {
  const blob = new Blob([text], { type: "application/json" }),
    url = URL.createObjectURL(blob),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function exportSave() {
  let text = null;
  if (started) text = engine.serialize();
  else
    try {
      text = localStorage.getItem(SAVE_KEY);
    } catch {}
  if (!text) {
    toast("还没有存档可以导出。", "warn");
    return;
  }
  let day = 1;
  try {
    day = JSON.parse(text).day || 1;
  } catch {}
  download(text, "余烬农场_第" + day + "天_存档.json");
  if (started) save();
  toast("存档导出来了。");
}
function importSave() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.onchange = async () => {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 16 * 1024 * 1024) {
      toast("这个文件太大了，不像是存档。", "warn");
      return;
    }
    try {
      const state = Engine.parse(await file.text());
      open("card", "confirm", { kind: "import", state });
    } catch (err) {
      toast(/旧版/.test(err?.message || "") ? err.message : "这个文件读不出来，不是这一版的存档。", "warn");
    }
  };
  input.click();
}

// ================= 引擎、声音 =================
function syncVolumes() {
  audio.setVolumes({ master: engine?.s.settings.sound ?? 0.35, ...audioPrefs });
}
function unlockAudio() {
  syncVolumes();
  audio.unlock();
}
function inCombat() {
  return !!engine && (engine.s.horde.phase === "active" || engine.enemies.some((z) => !z.dead && !z.lying && Math.hypot(z.x - engine.s.player.x, z.y - engine.s.player.y) < 190));
}
function toast(text, tone = "normal") {
  text = String(text ?? "");
  if (!text) return;
  if (started) {
    if (tone === "warn" && view) audio.ui("deny");
    else if (tone === "gold" && !inCombat()) audio.ui("gold");
  }
  if (engine && started) {
    toastLog.unshift({ text, tone, time: "第" + engine.s.day + "天 " + hhmm(engine.s.minute) });
    toastLog.length = Math.min(toastLog.length, 80);
  }
  const same = toasts.find((t) => t.text === text);
  if (same) {
    same.until = Date.now() + 5200;
    same.n++;
  } else toasts.push({ text, tone, until: Date.now() + (tone === "warn" ? 6500 : 5200), n: 1 });
  toasts = toasts.slice(-4);
  paintToasts();
}
let toastMark = "";
function paintToasts() {
  const now = Date.now();
  toasts = toasts.filter((t) => t.until > now);
  const html = toasts.map((t) => `<div class="toast ${t.tone}">${esc(t.text)}${t.n > 1 ? " ×" + t.n : ""}</div>`).join("");
  if (html === toastMark) return;
  toastMark = html;
  $("#toasts").innerHTML = html;
}
function resetEngine(state) {
  engine = new Engine(state, toast);
  Object.assign(engine.s.settings, readPrefs());
  toastLog.length = 0;
  toasts = [];
  keys.clear();
  mouse.held = false;
  userPaused = false;
  fast = false;
  resOpen = "";
  tip = null;
  supplyShown = false;
  hudReset();
  syncVolumes();
}
function refreshSaveInfo() {
  const s = readSave();
  hasSave = !!s;
  saveInfo = s ? { day: s.day, label: "第一章 落脚" + ((s.ch?.done || []).includes(1) ? "（做完了）" : "") } : null;
  return s;
}

// ================= 开哪一页 =================
const G = {
  get e() {
    return engine;
  },
  get ui() {
    return view?.ui || {};
  },
  get renderer() {
    return renderer;
  },
  get started() {
    return started;
  },
  get hasSave() {
    return hasSave;
  },
  get saveInfo() {
    return saveInfo;
  },
  get saveIssue() {
    return saveIssue;
  },
  get saveState() {
    return saveState;
  },
  get audioPrefs() {
    return audioPrefs;
  },
  toastLog,
  open: (kind, name, ui) => open(kind, name, ui),
  close: () => close(),
  refresh: () => render(),
  save: () => save(),
  toast,
  startDismantle() {
    dismantling = true;
    toast("拆东西：点一下要拆的设施。右键或 Esc 不拆了。");
  },
};
function open(kind, name, ui = {}) {
  if (!started && kind !== "scene" && !(kind === "page" && name === "settings") && !(kind === "card" && name === "confirm")) return;
  if (started && !view) audio.ui("open");
  // 没开始玩的时候开设置、制作人员：关了回标题页
  const back = !started && view?.kind === "scene" && kind !== "scene" ? view : view?.back || null;
  view = { kind, name, ui: { ...ui }, back };
  engine.paused = true;
  keys.clear();
  mouse.held = false;
  resOpen = "";
  engine.buildMode = null;
  dismantling = false;
  render();
}
function close(force = false) {
  if (!view) return;
  if (!force && view.kind === "card" && cardLocked(G, view.name)) {
    toast("这一件得先选一样。", "warn");
    return;
  }
  if (view.kind === "scene" && !force) return;
  const back = view.back;
  if (started) audio.ui("close");
  view = null;
  if (back) {
    view = back;
    render();
    return;
  }
  engine.paused = userPaused;
  keys.clear();
  mouse.held = false;
  render();
  $("#world").focus({ preventScroll: true });
}
function render() {
  const over = $("#over"),
    scene = $("#scene"),
    page = $("#page"),
    card = $("#card"),
    drawer = $("#drawer"),
    scrim = $("#scrim");
  const k = view?.kind;
  $("#hud").hidden = !started || k === "scene";
  document.body.classList.toggle("title", !started);
  over.hidden = !view || k === "scene";
  scene.hidden = k !== "scene";
  page.hidden = k !== "page";
  card.hidden = k !== "card";
  drawer.hidden = k !== "drawer";
  scrim.hidden = !(k === "page" || k === "card");
  $("#respop").hidden = true;
  if (!view) return;
  if (k === "page") {
    page.innerHTML = pageHtml(G, view.name);
    paint(page);
  } else if (k === "drawer") {
    drawer.innerHTML = buildHtml(G);
    paint(drawer);
  } else if (k === "card") {
    card.className = ["event", "supply", "boon"].includes(view.name) ? "wide" : "";
    card.innerHTML = cardHtml(G, view.name);
    paint(card);
  } else if (k === "scene") {
    scene.className = "ui" + (view.name === "title" ? "" : " dark");
    scene.innerHTML = view.name === "title" ? titleHtml(G) : view.name === "origin" ? originHtml(G) : cutHtml(G);
    if (view.name === "cut") drawCutArt($("#cut-art"), G);
  }
  if (k === "card" || k === "scene") {
    const box = k === "scene" ? scene : card,
      first = box.querySelector("button.primary:not([disabled])") || box.querySelector("button.opt:not([disabled])") || box.querySelector("button:not([disabled])");
    first?.focus?.({ preventScroll: true });
  }
}

// ================= 标题页、开始、继续 =================
function titleScreen() {
  started = false;
  const state = refreshSaveInfo();
  resetEngine(state || freshState());
  view = { kind: "scene", name: "title", ui: {} };
  engine.paused = true;
  render();
  resize();
}
function beginPlay() {
  started = true;
  view = null;
  userPaused = false;
  engine.paused = false;
  hudReset();
  render();
  resize();
  updateHUD();
  save();
  playScene();
}
function playScene() {
  const id = engine.chScene?.();
  if (!id || view) return false;
  view = { kind: "scene", name: "cut", ui: { scene: id, slide: 0 } };
  engine.paused = true;
  render();
  return true;
}
function endScene() {
  const id = view?.ui?.scene;
  engine.chSceneDone();
  view = null;
  engine.paused = userPaused;
  render();
  save();
  if (id === "intro") toast("先让这片地长出口粮。左下角写着眼下要做的事，按 J 看手记。", "gold");
  $("#world").focus({ preventScroll: true });
}

// ================= 常驻的七块 =================
function canFast() {
  return started && !view && engine.s.region === "farm" && !["warning", "active"].includes(engine.s.horde.phase) && !engine.enemies.some((z) => !z.dead) && !engine.buildMode;
}
function updateHUD() {
  if (!engine || !started) return;
  if (fast && !canFast()) fast = false;
  resNow = drawRes(engine, resOpen);
  drawClock(engine, { userPaused, fast, canFast: canFast() });
  alertsNow = drawAlerts(engine);
  drawGoal(engine);
  drawHands(engine);
  drawDock(engine);
  drawHint(engine);
  drawBanner(engine, renderer ? renderer.worldPoint(mouse.x, mouse.y) : null);
  if (dismantling && !engine.buildMode) {
    const b = $("#banner");
    b.hidden = false;
    b.className = "";
    b.textContent = "拆东西：点一下要拆的设施 · 右键或 Esc 不拆了";
  }
  if (userPaused && !view) {
    const b = $("#banner");
    b.hidden = false;
    b.className = "";
    b.textContent = "暂停着 · 按 P 接着走";
  }
  // 打架的时候教一句
  const coach = !engine.paused ? engine.coach?.() : null,
    ce = $("#coach");
  if (coach?.text) {
    if (ce.textContent !== coach.text) ce.textContent = coach.text;
    ce.hidden = false;
  } else if (!ce.hidden) ce.hidden = true;
  const now = Date.now();
  if (barkUntil && now > barkUntil) {
    $("#bark").hidden = true;
    barkUntil = 0;
  } else if (!$("#bark").hidden) placeBark();
  if (tip && now > tipUntil) {
    tip = null;
    $("#tip").hidden = true;
  }
  if (resOpen) {
    const r = resNow.find((x) => x.id === resOpen);
    if (r) $("#respop").innerHTML = resPopHtml(r);
  }
  document.body.classList.toggle("fight", inCombat());
  paintToasts();
}
function showRes(id, el) {
  const pop = $("#respop");
  if (resOpen === id) {
    resOpen = "";
    pop.hidden = true;
    hudReset();
    return;
  }
  const r = resNow.find((x) => x.id === id);
  if (!r) return;
  resOpen = id;
  pop.innerHTML = resPopHtml(r);
  pop.hidden = false;
  const z = Number(getComputedStyle(document.documentElement).getPropertyValue("--z")) || 1,
    rect = el?.getBoundingClientRect?.();
  pop.style.left = Math.max(12, Math.min(innerWidth / z - 352, (rect ? rect.left : 12) / z)) + "px";
  hudReset();
}
// 队友说话的那一条停在左下角目标框的上面：目标框有高有矮（备战那一段列着五样），跟着它走，不压着它
function placeBark() {
  const g = $("#goal");
  if (!g || g.hidden) return ($("#bark").style.bottom = "12px");
  const z = Number(getComputedStyle(document.documentElement).getPropertyValue("--z")) || 1;
  $("#bark").style.bottom = Math.round(g.getBoundingClientRect().height / z) + 20 + "px";
}
function showBark(who, text) {
  const r = who === "tieqiao" ? null : engine.resident?.(who);
  const el = $("#bark");
  el.innerHTML = barkHtml(who, who === "tieqiao" ? "helper" : r?.workRole || r?.role || "", text);
  el.hidden = false;
  placeBark();
  paint(el);
  barkUntil = Date.now() + 7000;
  audio.ui("gold");
}
function showTip(title, lines, ms = 6500) {
  tip = { title, lines };
  tipUntil = Date.now() + ms;
  const el = $("#tip");
  el.innerHTML = `<b>${esc(title)}</b>${lines
    .filter(Boolean)
    .map((l) => `<div>${esc(l)}</div>`)
    .join("")}`;
  el.hidden = false;
}
// 第一次见到的东西：右下角一张小卡，一张一张来
function easeFrame(dt) {
  if (!engine.easeLook || engine.paused || view) return;
  easeLook += dt;
  easeTick += dt;
  if (easeLook >= 0.25) {
    easeLook = 0;
    engine.easeLook();
  }
  if (easeTick >= 1) {
    easeTick = 0;
    engine.easeTick();
  }
  if (tip) return;
  for (let i = 0; i < 6; i++) {
    const c = engine.easeNextCard?.();
    if (!c) return;
    // 菜单格那一类旧界面才有；后面几章才能建的先不说
    if (/菜单里多了一格|前三天/.test(c.tag || "")) continue;
    // 第一章还用不上的（过节、食堂、订单、商队、瞭望塔、电台这些）先不说
    if (engine.chNow?.() === 1 && /节庆|过节|食堂|订单|商队|摆摊|瞭望塔|电台|广播|夜谈|学徒|过路人|时节|当季/.test([c.name, c.does, c.good, c.now].join(" "))) continue;
    const say = (t) => engine.chSay(String(t || "")) ?? "";
    if (/能建了/.test(c.tag || "") && !/围栏|仓库箱|篝火灶|制作台|居民床位|稻草人|雨水桶|堆肥桶|扩建农田|营地大门|路障陷阱/.test(c.name || "")) continue;
    showTip((c.tag ? c.tag + "：" : "") + c.name, [say(c.does), say(c.good), /菜单|右上角/.test(c.now || "") ? "" : say(c.now)]);
    return;
  }
}

// ================= 引擎说要开的页面 =================
function routeMenu(ev) {
  const m = ev.menu;
  if (m === "build") return open("drawer", "build", { tab: "guard" });
  if (m === "building") return open("card", "building", { id: ev.buildingId, confirm: !!ev.confirm });
  if (m === "station") {
    const b = engine.s.buildings.find((x) => x.id === ev.buildingId);
    return open("page", "store", { tab: "make", station: b?.type || "" });
  }
  if (m === "craft") return open("page", "store", { tab: "make", station: "" });
  if (m === "storage" || m === "inventory") return open("page", "store", { tab: "items" });
  if (m === "home") return open("card", "home");
  if (["quests", "journey", "rebuild"].includes(m)) return open("page", "journal", { tab: "main" });
  if (m === "trade") return open("page", "store", { tab: "trade", trader: ev.trader || "food", dir: "buy" });
  if (m === "map") return open("page", "map", { sel: ev.selected || engine.s.region });
  if (m === "death") return open("card", "death");
  if (m === "camp") return engine.chOpen("team") ? open("page", "team") : null;
  if (m === "ch" && ev.view === "boon") return open("card", "boon");
  if (m === "outpost") {
    if (ev.view === "daily") return open("card", "event");
    if (ev.view === "gPick" || ev.view === "gPlot") return open("card", "plot", { id: ev.id });
    if (ev.view === "summary") return open("card", "report");
    if (ev.view === "pick") return open("card", "pick");
    if (ev.view === "shipping") return open("page", "store", { tab: "trade" });
    if (ev.view === "people" || ev.view === "crew") return engine.chOpen("team") ? open("page", "team") : null;
  }
  return null;
}
function goAlert(a) {
  const go = a?.go;
  if (!go) return;
  if (go.kind === "point") {
    if (go.region && go.region !== engine.s.region) return open("page", "map", { sel: go.region });
    engine.guidance.target = { region: go.region || engine.s.region, x: go.x, y: go.y, label: a.title };
    toast("画面上的金色标记：往那儿走。");
  } else if (go.kind === "res") showRes(go.id, $(`.res[data-id="${go.id}"]`));
  else if (go.kind === "page") {
    if (go.page === "event") open("card", "event");
    else if (go.page === "build") open("drawer", "build", { tab: "guard", ...(go.ui || {}) });
    else open("page", go.page, go.ui || (go.page === "journal" ? { tab: "main" } : {}));
  }
}
const PAGE_KEYS = { b: ["drawer", "build"], t: ["page", "team"], i: ["page", "store"], tab: ["page", "store"], m: ["page", "map"], j: ["page", "journal"], c: ["page", "store", { tab: "make" }], l: ["page", "journal", { tab: "log" }] };
function openByName(name, ui = {}) {
  if (name === "build") return open("drawer", "build", { tab: "guard", ...ui });
  if (name === "team" && !engine.chOpen("team")) return toast("还没有人来。把田种起来，回了信，联盟会派人。");
  if (name === "event") return open("card", "event");
  open("page", name, ui);
}

// ================= 点了什么 =================
document.addEventListener("click", (ev) => {
  if (!engine) return;
  unlockAudio();
  const el = ev.target.closest?.("[data-act]");
  if (!el) {
    if (resOpen && !ev.target.closest?.("#respop")) showRes(resOpen);
    return;
  }
  if (el.disabled) return;
  const act = el.dataset.act,
    id = el.dataset.id || "";
  if (started && view) audio.ui("tick");
  switch (act) {
    case "close":
      return close();
    case "page":
      return id === "settings" ? open("page", "settings") : openByName(id);
    case "res":
      return showRes(id, el);
    case "alert":
      return goAlert(alertsNow[Number(id)]);
    case "slot":
      return selectSlot(Number(id));
    case "pause":
      userPaused = !userPaused;
      if (!view) engine.paused = userPaused;
      if (userPaused) fast = false;
      hudReset();
      return updateHUD();
    case "fast":
      if (canFast()) fast = !fast;
      hudReset();
      return updateHUD();
    // 标题页
    case "continue":
      if (hasSave) beginPlay();
      return;
    case "newgame":
      view = { kind: "scene", name: "origin", ui: { origin: "farmer" } };
      return render();
    case "origin":
      view.ui.origin = id;
      return render();
    case "totitle":
      view = { kind: "scene", name: "title", ui: {} };
      return render();
    case "begin": {
      const origin = view.ui.origin || "farmer";
      resetEngine(newGameState(origin));
      started = true;
      view = null;
      hudReset();
      save();
      render();
      resize();
      updateHUD();
      playScene();
      return;
    }
    case "credits":
      return open("card", "confirm", { kind: "credits" });
    // 过场
    case "cutnext": {
      const n = cutCount(G);
      if ((view.ui.slide || 0) >= n - 1) return endScene();
      view.ui.slide = (view.ui.slide || 0) + 1;
      return render();
    }
    case "cutskip":
      return endScene();
    // 设置
    case "save":
      save(true);
      return render();
    case "export":
      return exportSave();
    case "import":
      return importSave();
    case "doimport": {
      const state = view.ui.state;
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(state));
      } catch {}
      resetEngine(Engine.parse(JSON.stringify(state)));
      view = null;
      beginPlay();
      toast("读进来了，接着过日子。", "gold");
      return;
    }
    case "unstuck":
      if (engine.unstuck?.()) close(true);
      else render();
      return;
    case "fullscreen":
      if (document.fullscreenElement) document.exitFullscreen?.();
      else $("#app").requestFullscreen?.().catch(() => toast("这个浏览器进不了全屏。", "warn"));
      return;
    case "asktitle":
      return open("card", "confirm", { kind: "totitle" });
    case "dototitle":
      save(true);
      view = null;
      return titleScreen();
  }
  if (view?.kind === "card" && cardAct(G, act, id, el, ev)) return;
  if (view && pageAct(G, act, id, el, ev)) return;
});
document.addEventListener("input", (ev) => {
  const k = ev.target?.dataset?.set;
  if (!k || !engine) return;
  const v = Number(ev.target.value);
  if (k === "sound") engine.s.settings.sound = v;
  else if (k === "zoom") engine.s.settings.zoom = v;
  else if (k in audioPrefs) audioPrefs[k] = v;
  writePrefs();
  const lab = ev.target.parentElement?.querySelector("span");
  if (lab && ev.target.type === "range") lab.textContent = Math.round(v * 100) + "%";
  if (k === "zoom") resize();
});

// ================= 键盘、鼠标 =================
function moveVector() {
  const x = (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0),
    y = (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0);
  return x || y ? { x, y } : null;
}
function selectSlot(slot) {
  if (!Number.isInteger(slot) || slot < 0 || slot > 9) return;
  if (slot === 4 && engine.s.slot === 4 && engine.cycleRanged?.()) return updateHUD();
  const id = engine.hotbarSlots()[slot];
  if (!id && slot >= 3 && slot <= 6 && engine.slotEmptyText) toast(engine.slotEmptyText(slot));
  engine.s.slot = slot;
  engine.reload = null;
  updateHUD();
}
function cycleSlot(dir) {
  const ids = engine.hotbarSlots();
  for (let k = 1; k < 10; k++) {
    const slot = (engine.s.slot + dir * k + 20) % 10;
    if (!ids[slot]) continue;
    return selectSlot(slot);
  }
}
document.addEventListener("keydown", (e) => {
  if (!engine) return;
  unlockAudio();
  const key = e.key.toLowerCase(),
    typing = e.target.matches?.("input,select,textarea");
  if (typing && key !== "escape") return;
  if (["tab", " ", "arrowup", "arrowdown", "arrowleft", "arrowright", "escape"].includes(key)) e.preventDefault();
  // 标题页、过场
  if (view?.kind === "scene") {
    if (view.name === "cut") {
      if (key === " " || key === "enter") $('[data-act="cutnext"]')?.click();
      else if (key === "escape") endScene();
    } else if (view.name === "origin" && key === "escape") $('[data-act="totitle"]')?.click();
    return;
  }
  if (view) {
    if (key === "escape") return close();
    if (/^[1-9]$/.test(key)) {
      const pick = $(`#over [data-key="${key}"]`);
      if (pick && !pick.disabled) pick.click();
      return;
    }
    // 开着一页再按它的键：关上
    const pk = PAGE_KEYS[key];
    if (pk && !e.repeat && view.kind === pk[0] && view.name === pk[1]) close();
    return;
  }
  if (!started) return;
  if (key === "escape") {
    if (resOpen) return showRes(resOpen);
    if (dismantling) {
      dismantling = false;
      return;
    }
    if (engine.buildMode) {
      engine.buildMode = null;
      return;
    }
    return open("page", "settings");
  }
  if (key === "p" && !e.repeat) return $('[data-act="pause"]')?.click();
  const pk = PAGE_KEYS[key];
  if (pk && !e.repeat) return openByName(pk[1], pk[2] || {});
  if (engine.paused) return;
  keys.add(key);
  if (e.repeat) return;
  if (key === " ") {
    engine.spaceTip?.();
    engine.dodge?.(moveVector());
  } else if (key === "e") engine.interact();
  else if (key === "x") engine.shove?.();
  else if (key === "r") engine.reloadWeapon?.();
  else if (key === "q" && engine.buildMode) engine.rotation = (engine.rotation + 1) % 4;
  else if (key === "v") engine.toggleCrouch?.();
  else if (key === "g") engine.throwStone?.(renderer.worldPoint(mouse.x, mouse.y));
  // F：打精英时换瞄准的部位（第三章起才遇得到精英，第一章里不提）
  else if (key === "f" && engine.chNow?.() > 1) engine.cycleAim?.();
  else if (/^[0-9]$/.test(key)) selectSlot(key === "0" ? 9 : Number(key) - 1);
});
document.addEventListener("keyup", (e) => keys.delete(e.key.toLowerCase()));
window.addEventListener("blur", () => {
  keys.clear();
  mouse.held = false;
});
const world = $("#world");
function setMouse(e) {
  const r = world.getBoundingClientRect();
  mouse.x = ((e.clientX - r.left) * renderer.w) / Math.max(1, r.width);
  mouse.y = ((e.clientY - r.top) * renderer.h) / Math.max(1, r.height);
}
world.addEventListener("pointermove", (e) => renderer && setMouse(e));
world.addEventListener("pointerdown", (e) => {
  unlockAudio();
  if (!engine || !renderer || !started) return;
  if (resOpen) showRes(resOpen);
  if (e.button === 2) {
    if (engine.buildMode) engine.buildMode = null;
    dismantling = false;
    return;
  }
  if (engine.paused || e.button !== 0) return;
  setMouse(e);
  if (dismantling) {
    const pt = renderer.worldPoint(mouse.x, mouse.y);
    dismantling = false;
    const hit = engine.s.region === "farm" ? engine.s.buildings.filter((b) => Math.hypot(b.x - pt.x, b.y - pt.y) < 56).sort((a, b) => Math.hypot(a.x - pt.x, a.y - pt.y) - Math.hypot(b.x - pt.x, b.y - pt.y))[0] : null;
    if (hit) open("card", "building", { id: hit.id, confirm: true });
    else toast("没点在设施上，不拆了。");
    return;
  }
  mouse.held = true;
  engine.hyKeepBuild = keys.has("shift");
  engine.use(renderer.worldPoint(mouse.x, mouse.y));
  toolTimer = 0.22;
  world.focus();
});
world.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("pointerup", () => (mouse.held = false));
world.addEventListener(
  "wheel",
  (e) => {
    if (engine && started && !engine.paused) {
      e.preventDefault();
      cycleSlot(e.deltaY > 0 ? 1 : -1);
    }
  },
  { passive: false },
);

// ================= 每一帧 =================
function worldView() {
  if (!renderer) return null;
  const sc = renderer.camera?.scale || 1,
    hw = renderer.w / sc / 2;
  return { cx: (renderer.camera?.x || 0) + hw, cy: (renderer.camera?.y || 0) + renderer.h / sc / 2, hw };
}
function flash() {
  const f = $("#flash");
  f.classList.add("on");
  setTimeout(() => f.classList.remove("on"), 220);
}
function frame(time) {
  const dt = lastTime ? Math.min(0.05, (time - lastTime) / 1000) : 0.016;
  lastTime = time;
  if (renderer && engine) {
    const input = { x: (keys.has("d") || keys.has("arrowright") ? 1 : 0) - (keys.has("a") || keys.has("arrowleft") ? 1 : 0), y: (keys.has("s") || keys.has("arrowdown") ? 1 : 0) - (keys.has("w") || keys.has("arrowup") ? 1 : 0), run: keys.has("shift") };
    input.reel = keys.has("e") || mouse.held;
    input.hold = keys.has("e");
    engine.update(dt, input);
    if (fast && canFast()) engine.update(dt, input);
    toolTimer = Math.max(0, toolTimer - dt);
    if (started && !engine.paused && !engine.reeling?.() && mouse.held && toolTimer <= 0 && !engine.dodging?.() && !dismantling) {
      engine.hyKeepBuild = keys.has("shift");
      engine.use(renderer.worldPoint(mouse.x, mouse.y));
      toolTimer = engine.weaponStats(engine.currentItem())?.cooldown || 0.23;
    }
    if (started && !engine.paused && WEAPONS[engine.currentItem()]) {
      const t = renderer.worldPoint(mouse.x, mouse.y);
      engine.s.player.facing = Math.atan2(t.y - engine.s.player.y + 28, t.x - engine.s.player.x);
    }
    const wv = worldView();
    for (const ev of engine.events.splice(0)) {
      if (!started) continue;
      if (ev.type === "menu") routeMenu(ev);
      else if (ev.type === "closeMenu") close(true);
      else if (ev.type === "bark") showBark(ev.who, ev.text);
      else if (ev.type === "ledger") showTip(ev.title || "", (ev.lines || []).slice(0, 4).map((l) => engine.chSay(l) ?? ""), 9000);
      else if (ev.type === "moment") {
        showTip(ev.title || "", (ev.lines || []).slice(0, 3).map((l) => engine.chSay(l) ?? ""), 8000);
        flash();
        audio.event(ev, engine, wv);
        saveSoon();
      } else {
        audio.event(ev, engine, wv);
        if (["quest", "victory", "travel", "sleep", "craft"].includes(ev.type)) saveSoon();
        if (ev.type === "travel") hudReset();
      }
    }
    if (started && !view) {
      if (engine.gearIntroDue?.()) engine.markGearIntro?.();
      if (!playScene()) {
        if (engine.dailyShouldShow?.()) open("card", "event");
        else if (!supplyShown && engine.sc?.act === 2 && !engine.sc.choice && !inCombat()) {
          // 回了信，联络站问要哪一包：自己弹出来一次
          supplyShown = true;
          open("card", "supply");
        }
      }
    }
    renderer.rebuildTarget = engine.chGateStragglers?.() || engine.guidance?.target || null;
    renderer.draw(engine, mouse, dt);
    drawLane();
    audio.frame(engine, dt, { menu: !!view, scene: !started, run: input.run, view: wv });
    if (started) easeFrame(dt);
    hudTimer += dt;
    saveTimer += dt;
    if (hudTimer > 0.12) {
      updateHUD();
      hudTimer = 0;
    }
    if (saveTimer > 20 && started && !engine.paused) {
      save();
      saveTimer = 0;
    }
  }
  requestAnimationFrame(frame);
}
// 第一章摆围栏、大门、陷阱的时候：地上标出尸潮从哪儿进来、往哪儿走（陷阱摆在这条路上才踩得着）
function drawLane() {
  if (!engine || !renderer || engine.s.region !== "farm" || engine.chNow?.() !== 1 || engine.chDone?.(1)) return;
  if (!["trap", "fence", "gate"].includes(engine.buildMode)) return;
  const L = GATE1.lane,
    a = renderer.screenPoint(L.x, L.y),
    b = renderer.screenPoint(L.x - 190, L.y + 4),
    c = renderer.ctx,
    k = (renderer.camera?.scale || 1) * 1;
  c.save();
  c.setTransform(renderer.dpr, 0, 0, renderer.dpr, 0, 0);
  c.strokeStyle = "#ff8a75";
  c.fillStyle = "#ff8a75";
  c.lineWidth = 2;
  c.setLineDash([8, 6]);
  c.beginPath();
  c.arc(a.x, a.y, 30 * k, 0, Math.PI * 2);
  c.stroke();
  c.beginPath();
  c.moveTo(a.x - 30 * k, a.y);
  c.lineTo(b.x, b.y);
  c.stroke();
  c.setLineDash([]);
  c.beginPath();
  c.moveTo(b.x - 12, b.y);
  c.lineTo(b.x + 4, b.y - 8);
  c.lineTo(b.x + 4, b.y + 8);
  c.closePath();
  c.fill();
  const text = "它们从这儿进来，顺着路往里走",
    size = Math.max(14, Math.round(14 * (renderer.hudTop ? renderer.hudTop / 56 : 1)));
  c.font = "700 " + size + 'px "Microsoft YaHei", "PingFang SC", sans-serif';
  c.textAlign = "center";
  const w = c.measureText(text).width + 16,
    tx = Math.min(renderer.w - w / 2 - 8, Math.max(w / 2 + 8, (a.x + b.x) / 2)),
    ty = a.y - 30 * k - 14;
  c.fillStyle = "rgba(21,25,29,0.92)";
  c.fillRect(tx - w / 2, ty - size, w, size + 10);
  c.fillStyle = "#ff8a75";
  c.fillText(text, tx, ty);
  c.restore();
}
function resize() {
  const z = uiZoom(innerWidth, innerHeight);
  document.documentElement.style.setProperty("--z", String(z));
  if (renderer) {
    renderer.resize(innerWidth, innerHeight, devicePixelRatio);
    renderer.hudTop = Math.round(56 * z);
    renderer.hudBottom = Math.round(96 * z);
    mouse.x = Math.max(0, Math.min(mouse.x, innerWidth));
    mouse.y = Math.max(0, Math.min(mouse.y, innerHeight));
  }
  hudReset();
}
window.addEventListener("resize", resize);
window.addEventListener("beforeunload", () => {
  if (started) save();
});
function lazyMaps(a) {
  for (const [ids, make] of [
    [DISTRICT_ART_IDS, districtAsset],
    [BEYOND_ART_IDS, beyondAsset],
  ])
    for (const id of ids) {
      let made = null;
      Object.defineProperty(a, id, { get: () => (made ??= make(id)), enumerable: true, configurable: true });
    }
}
async function init() {
  try {
    document.title = "余烬农场 " + GAME_VERSION + " · " + GAME_EDITION;
    $$("[data-release]").forEach((el) => (el.textContent = GAME_RELEASE));
    const saved = refreshSaveInfo(),
      firstRegion = saved?.region || "farm",
      early = bakeAway(firstRegion);
    const names = ["farm", "ruins", "sprites", "expansion", "frontier"];
    assets = Object.fromEntries(
      await Promise.all(
        names.map(
          (name) =>
            new Promise((resolve, reject) => {
              const img = new Image();
              img.onload = () => resolve([name, img]);
              img.onerror = () => reject(new Error("画面素材没载进来，再试一次。"));
              img.src = "assets/" + name + ".png";
            }),
        ),
      ),
    );
    lazyMaps(assets);
    resetEngine(saved || freshState());
    renderer = new Renderer(world, assets);
    await renderer.prepare?.(engine.s.region, engine.s.region === firstRegion ? early : null);
    setSheets(renderer.sheets || null);
    resize();
    $("#loading").hidden = true;
    view = { kind: "scene", name: "title", ui: {} };
    engine.paused = true;
    render();
    requestAnimationFrame(frame);
  } catch (err) {
    $("#loading").innerHTML = `<div class="name">余烬农场</div><p>${esc(err?.message || "载入出了岔子。")}</p><button class="btn primary" id="retry">重新载入</button>`;
    $("#retry").onclick = () => location.reload();
  }
}
// 自动测试用：只给一份抄下来的数，改不了游戏里的东西
window.__ember = {
  // 从你站的地方走到那儿，绕开挡路的东西要经过哪几个点
  path(x, y) {
    if (!engine) return [];
    try {
      return engine.pathTo(engine.s.player, { x, y }).map((p) => ({ x: p.x, y: p.y }));
    } catch {
      return [];
    }
  },
  snapshot() {
    if (!engine) return null;
    const s = engine.s;
    return JSON.parse(
      JSON.stringify({
        started,
        view: view ? { kind: view.kind, name: view.name } : null,
        paused: engine.paused,
        day: s.day,
        minute: s.minute,
        region: s.region,
        player: s.player,
        money: s.money,
        slot: s.slot,
        inventory: s.inventory,
        storage: s.storage,
        horde: s.horde,
        stats: s.stats,
        buildings: s.buildings.map((b) => ({ id: b.id, type: b.type, x: b.x, y: b.y })),
        plots: s.plots.map((p) => ({ id: p.id, x: p.x, y: p.y, tilled: p.tilled, crop: p.crop, growth: p.growth })),
        debris: s.debris,
        enemies: engine.enemies.filter((z) => !z.dead && !z.gone).map((z) => ({ x: z.x, y: z.y, type: z.type, lying: !!z.lying })),
        objects: (engine.objects || []).map((o) => ({ type: o.type, name: o.name || "", x: o.x, y: o.y })),
        hint: (() => {
          const o = engine.nearestObject?.();
          return o ? engine.context(o) : "";
        })(),
        food: { portions: engine.foodPortions?.() ?? 0, days: engine.foodDays?.() ?? 0 },
        prep: engine.chPrepLines(),
        people: engine.chPeople(),
        water: engine.c?.water ?? 0,
        production: (engine.c?.production || []).map((j) => ({ id: j.id, ready: !!j.ready })),
        trader: Object.fromEntries(["food", "mechanic"].map((t) => [t, engine.s.region === "market" ? engine.traderStock(t) : {}])),
        tableReq: engine.taskRequirements ? engine.taskRequirements("table").map((r) => ({ label: r.label, pass: !!r.pass })) : [],
        dailyCard: !!engine.dailyCard?.(),
        fast,
        userPaused,
        ch: s.ch,
        goal: engine.chGoal(),
        act: engine.sc?.act,
        buildMode: engine.buildMode,
        // 手上、身上带着的家伙各剩几成耐久（只读存档里的数）
        gear: Object.fromEntries(
          Object.entries(engine.gr?.slots || {})
            .filter(([, id]) => id)
            .map(([slot, id]) => {
              const c = engine.gr.cond?.[id];
              return [slot, { id, left: c && c.m > 0 ? Math.round((c.d / c.m) * 100) / 100 : 1 }];
            }),
        ),
        fever: !!engine.gr?.fever && !engine.gr?.cure,
        camera: renderer ? { x: renderer.camera.x, y: renderer.camera.y, scale: renderer.camera.scale } : null,
      }),
    );
  },
};
init();
