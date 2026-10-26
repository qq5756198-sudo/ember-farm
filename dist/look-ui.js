// v0.40.0「一套」：界面规范的脚本部分（样式在 ui.css）。只对电脑生效，手机照旧。
// 1. 电脑（鼠标、窗口宽 ≥ 1280、高 ≥ 680）在 <html> 上加 desk；界面按窗口大小整体放大（--uiz）。
// 2. 对话框标上是哪一页（data-page / data-view），样式按页排。
// 3. 建造页：左边图标格，右边一张详情卡（指到哪样、选了哪样就写哪样），“建一个”在卡上。
// 4. 菜单十项：每一格角上写按键；最上面一行“金、口粮、动静”，点开就地看说明。
// 5. 顶栏：快没了的那一条闪；金币变了在状态块旁边飘一下；有新消息时菜单按钮上一个点。
// 这一层不改玩法、不碰存档，只排版。
import { keyLabel } from "./farlands-data.js";
import { hudCardHtml } from "./simple-ui.js";

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const escH = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

// ---------- 电脑还是手机、放大多少 ----------
export function isDesk(win = globalThis) {
  try {
    const coarse = !!win.matchMedia?.("(pointer: coarse)")?.matches,
      w = win.innerWidth || 0,
      h = win.innerHeight || 0;
    return !coarse && w >= 1280 && h >= 680;
  } catch {
    return false;
  }
}
// 1366×768 → 1；1920×1080 → 1.25；2560×1440 → 1.7；最多 2 倍。按 0.05 取整，免得一像素一像素地抖。
export function uiZoom(w, h) {
  const z = 0.9 * Math.min((w || 1366) / 1366, (h || 768) / 768);
  return clamp(Math.round(z * 20) / 20, 1, 2);
}
export function applyLook(doc = globalThis.document, win = globalThis) {
  const root = doc?.documentElement;
  if (!root) return 1;
  const desk = isDesk(win),
    z = desk ? uiZoom(win.innerWidth, win.innerHeight) : 1;
  root.classList?.toggle?.("desk", desk);
  root.style?.setProperty?.("--uiz", String(z));
  root.style?.setProperty?.("--vw-z", Math.floor((win.innerWidth || 1366) / z) + "px");
  root.style?.setProperty?.("--vh-z", Math.floor((win.innerHeight || 768) / z) + "px");
  return z;
}

// ---------- 对话框是哪一页 ----------
export function pageOf(menu, args = {}, outpostView = "") {
  if (menu === "outpost") return { page: "outpost", view: outpostView || "" };
  if (menu === "sx") return { page: "sx", view: args?.view || "" };
  return { page: menu || "", view: "" };
}
// 返回 true：这一页重新排过（小图要按新的大小再画一遍）
export function lookAfterRender(modal, ctx = {}) {
  if (!modal) return false;
  const { page, view } = pageOf(ctx.menu, ctx.args, ctx.view);
  if (modal.dataset) {
    modal.dataset.page = page;
    modal.dataset.view = view;
  }
  if (!isDesk(ctx.win || globalThis)) return false;
  if (page === "sx" && view === "menus") menuKeys(modal, ctx);
  if (page === "map") atlasTidy(modal);
  return page === "build" ? buildTiles(modal, ctx) : false;
}

// ---------- 地图 ----------
// 1. 两行图例原来画在地图左上角和左下角，会压在地点格子下面：挪到右栏最下面，前面画一小段样子。
// 2. 路上的字（商队在路上、灰隼团……）原来是画在图里的，会被地点格子盖住：换成和“险地”一样的小牌子。
// 3. 小牌子和地点格子、别的小牌子错开（就近往上下左右挪）。
// 4. 刚打开时把选中的地点（一般就是“你在这里”）滚到中间；在地图上点别的地点，图不跳回左上角。
let atlasKeep = null;
const LEGEND = [
  [/^实线/, "solid"],
  [/^虚线/, "dash"],
  [/^亮灯/, "lit"],
  [/^淡圈/, "ring"],
];
export function legendKind(text) {
  for (const [re, k] of LEGEND) if (re.test(text)) return k;
  return "solid";
}
export function atlasTidy(modal) {
  const land = modal.querySelector?.(".atlas-land"),
    svg = land?.querySelector?.("svg"),
    pane = modal.querySelector?.(".atlas-scroll");
  if (!land || !svg || !pane) return false;
  const doc = modal.ownerDocument || globalThis.document;
  // 1. 图例
  const parts = [];
  for (const t of [...svg.querySelectorAll("text")]) {
    const s = (t.textContent || "").trim();
    if (!/^(实线|亮灯的路)/.test(s)) continue;
    parts.push(...s.split(/\s*[·　]\s*/).filter(Boolean));
    t.remove();
  }
  const info = modal.querySelector(".atlas-info");
  if (parts.length && info && !info.querySelector(".look-atlas-legend")) {
    const box = doc.createElement("div");
    box.className = "look-atlas-legend";
    box.innerHTML = parts.map((p) => `<p><i class="lg-${legendKind(p)}" aria-hidden="true"></i>${escH(p)}</p>`).join("");
    info.appendChild(box);
  }
  // 2. 路上的字 → 小牌子（地区名“余烬地区”和指北的“北”留在图里）
  const L = land.getBoundingClientRect();
  if (!L.width || !L.height) return true;
  for (const t of [...svg.querySelectorAll("text")]) {
    const s = (t.textContent || "").trim();
    if (!s || s === "北" || /^余\s*烬\s*地\s*区$/.test(s)) continue;
    const r = t.getBoundingClientRect(),
      pin = doc.createElement("span"),
      fill = String(t.getAttribute("fill") || ""),
      m = fill.match(/^#([0-9a-f]{2})([0-9a-f]{2})/i);
    pin.className = "far-pin look-route-pin" + (m && parseInt(m[1], 16) - parseInt(m[2], 16) > 50 ? " danger" : "");
    pin.textContent = s;
    pin.style.left = (((r.left - L.left) / L.width) * 100).toFixed(2) + "%";
    pin.style.top = (((r.top + r.height / 2 - L.top) / L.height) * 100).toFixed(2) + "%";
    land.appendChild(pin);
    t.remove();
  }
  // 3. 错开
  atlasSpread(land);
  // 4. 滚到哪
  const keep = atlasKeep && Date.now() - atlasKeep[2] < 1500 ? atlasKeep : null;
  atlasKeep = null;
  if (keep) {
    pane.scrollLeft = keep[0];
    pane.scrollTop = keep[1];
  } else if (!pane.scrollLeft && !pane.scrollTop) {
    const at = land.querySelector(".atlas-node.selected") || land.querySelector(".atlas-node.here");
    if (at) {
      const a = at.getBoundingClientRect(),
        P = pane.getBoundingClientRect(),
        k = P.width / (pane.clientWidth || P.width) || 1;
      pane.scrollLeft += (a.left + a.width / 2 - (P.left + P.width / 2)) / k;
      pane.scrollTop += (a.top + a.height / 2 - (P.top + P.height / 2)) / k;
    }
  }
  // 在图上点地点会整页重画：先记下现在滚到哪，重画完放回去
  pane.addEventListener?.(
    "click",
    (ev) => {
      if (ev.target?.closest?.(".atlas-node")) atlasKeep = [pane.scrollLeft, pane.scrollTop, Date.now()];
    },
    true,
  );
  atlasDrag(pane);
  return true;
}
// 鼠标按住空地拖着看（地点格子照样点）；挪不到 4 像素算没拖
export function atlasDrag(pane) {
  if (!pane?.addEventListener) return;
  let d = null;
  pane.addEventListener("pointerdown", (ev) => {
    if (ev.button !== 0 || ev.pointerType !== "mouse" || ev.target?.closest?.("button, a, select, input, summary")) return;
    const P = pane.getBoundingClientRect();
    d = { x: ev.clientX, y: ev.clientY, l: pane.scrollLeft, t: pane.scrollTop, k: P.width / (pane.clientWidth || P.width) || 1, id: ev.pointerId, moved: false };
  });
  pane.addEventListener("pointermove", (ev) => {
    if (!d || ev.pointerId !== d.id) return;
    const dx = ev.clientX - d.x,
      dy = ev.clientY - d.y;
    if (!d.moved) {
      if (Math.hypot(dx, dy) < 4) return;
      d.moved = true;
      pane.classList.add("look-dragging");
      try {
        pane.setPointerCapture(ev.pointerId);
      } catch {}
    }
    pane.scrollLeft = d.l - dx / d.k;
    pane.scrollTop = d.t - dy / d.k;
  });
  const end = () => {
    if (d?.moved) pane.classList.remove("look-dragging");
    d = null;
  };
  pane.addEventListener("pointerup", end);
  pane.addEventListener("pointercancel", end);
}
// 小牌子挪开：只在压到地点格子或别的牌子时挪，挪的距离越近越好，挪不开就不动
export function atlasSpread(land) {
  const L = land.getBoundingClientRect(),
    k = L.width / (land.offsetWidth || L.width) || 1;
  const pins = [...land.querySelectorAll(".far-pin")];
  for (const p of pins) p.style.translate = "";
  const box = (el) => {
    const r = el.getBoundingClientRect();
    return { x: (r.left - L.left) / k, y: (r.top - L.top) / k, w: r.width / k, h: r.height / k, danger: !!el.classList?.contains?.("danger") };
  };
  const moves = spreadBoxes([...land.querySelectorAll(".atlas-node")].map(box), pins.map(box), L.width / k, L.height / k);
  let moved = 0;
  pins.forEach((p, i) => {
    const m = moves[i];
    if (m && (m[0] || m[1])) {
      p.style.translate = `${Math.round(m[0])}px ${Math.round(m[1])}px`;
      moved++;
    }
  });
  return moved;
}
// 只算不动手：地点格子 taken、牌子 pins（都是 {x,y,w,h}），在 W×H 的图里给每个牌子找最近的空位，返回每个牌子要挪多少 [dx, dy]（不用挪是 [0, 0]，挪不开是 null）
// 危险的牌子先放；挪的时候左右优先（上下挪一格算 1.4 倍远）
export function spreadBoxes(taken, pins, W, H, gap = 3) {
  const placed = taken.map((b) => ({ ...b }));
  const hits = (b) => placed.some((o) => b.x < o.x + o.w + gap && b.x + b.w + gap > o.x && b.y < o.y + o.h + gap && b.y + b.h + gap > o.y);
  const order = pins.map((b, i) => i).sort((a, b) => (pins[b].danger ? 1 : 0) - (pins[a].danger ? 1 : 0) || a - b);
  const out = pins.map(() => [0, 0]);
  for (const i of order) {
    const b = pins[i];
    if (!b.w || !b.h) continue;
    let best = [0, 0];
    if (hits(b)) {
      best = null;
      const sy = b.h + gap * 2,
        sx = b.w / 2,
        tries = [];
      for (let iy = -3; iy <= 3; iy++) for (let ix = -3; ix <= 3; ix++) if (ix || iy) tries.push([ix * sx, iy * sy]);
      tries.sort((u, v) => Math.hypot(u[0], u[1] * 1.4) - Math.hypot(v[0], v[1] * 1.4));
      for (const [dx, dy] of tries) {
        const c = { x: b.x + dx, y: b.y + dy, w: b.w, h: b.h };
        if (c.x < 2 || c.y < 2 || c.x + c.w > W - 2 || c.y + c.h > H - 2) continue;
        if (!hits(c)) {
          best = [dx, dy];
          break;
        }
      }
    }
    out[i] = best;
    const m = best || [0, 0];
    placed.push({ x: b.x + m[0], y: b.y + m[1], w: b.w, h: b.h });
  }
  return out;
}

// ---------- 菜单十项：角上的按键、最上面一行状态 ----------
const MENU_KEY = { rebuild: "journal", craft: "craft", build: "build", map: "map" };
export function menuKeys(modal, ctx = {}) {
  const settings = ctx.engine?.s?.settings;
  for (const b of modal.querySelectorAll?.(".sx-menus > button") || []) {
    const m = b.dataset?.menu,
      a = b.dataset?.action,
      id = b.dataset?.id;
    let k = "";
    if (MENU_KEY[m]) k = keyLabel(settings, MENU_KEY[m]);
    else if (m === "inventory") k = "Tab";
    else if (m === "skills") k = "K";
    else if (a === "sxOpen" && id === "messages") k = keyLabel(settings, "log");
    if (k && b.dataset) b.dataset.key = k;
  }
  const e = ctx.engine;
  // 最下面一行常用按键（底栏上原来那一行收进来了）
  const pageEl = modal.querySelector?.(".sx-page");
  if (pageEl && !modal.querySelector?.(".look-keys")) {
    const doc0 = modal.ownerDocument || globalThis.document,
      keys = doc0.createElement("div"),
      k = (a, d) => keyLabel(settings, a) || d;
    keys.className = "look-keys";
    keys.innerHTML = [
      ["W A S D", "走"],
      [k("interact", "E"), "交互"],
      ["左键", "用手里的东西"],
      ["空格", "翻滚"],
      ["1–0", "换手里的"],
      ["Tab", "背包（按住是轮盘）"],
      ["Esc", "菜单"],
    ]
      .map(([key, what]) => `<span><kbd>${escH(key)}</kbd>${escH(what)}</span>`)
      .join("");
    pageEl.appendChild(keys);
  }
  if (!e || modal.querySelector?.(".look-status")) return;
  const page = modal.querySelector?.(".sx-page");
  if (!page) return;
  const rows = statusRows(e, ctx.hud || {});
  if (!rows.length) return;
  const box = (modal.ownerDocument || globalThis.document).createElement("div");
  box.className = "look-status";
  box.innerHTML = rows.map((r) => `<button class="${r.tone === "danger" ? "danger" : ""}" data-look-card="${r.key}" aria-expanded="false">${escH(r.name)}<b>${escH(r.value)}</b></button>`).join("") + `<div class="look-status-card" hidden></div>`;
  page.prepend(box);
  box.addEventListener?.("click", (ev) => {
    const b = ev.target?.closest?.("[data-look-card]");
    if (!b) return;
    const row = rows.find((r) => r.key === b.dataset.lookCard);
    toggleStatusCard(modal, b, e, row ? row.name + " " + row.value : "");
  });
}
// 金、口粮、动静（有寒冷时加上寒冷）：顶栏上收起来的那几样
export function statusRows(e, hud = {}) {
  const rows = [];
  const money = Math.floor(e.s?.money || 0).toLocaleString("zh-CN");
  rows.push({ key: "money", name: "金", value: money });
  if (hud.food?.text) rows.push({ key: "food", name: "口粮", value: String(hud.food.text).replace(/^口粮\s*/, ""), tone: hud.food.tone });
  if (hud.noise?.text) rows.push({ key: "noise", name: "动静", value: String(hud.noise.text).replace(/^动静\s*/, ""), tone: hud.noise.tone });
  if (hud.season?.text) rows.push({ key: "cold", name: "寒冷", value: String(hud.season.text), tone: hud.season.tone });
  return rows;
}
// 点状态格：在下面就地展开那张说明卡（再点一下收起）
export function toggleStatusCard(modal, button, e, now = "") {
  const card = modal?.querySelector?.(".look-status-card");
  if (!card || !button) return false;
  const key = button.dataset.lookCard,
    open = card.dataset?.key === key && !card.hidden;
  for (const b of modal.querySelectorAll(".look-status [data-look-card]")) b.setAttribute?.("aria-expanded", "false");
  if (open) {
    card.hidden = true;
    card.dataset.key = "";
    return true;
  }
  const html = hudCardHtml(e, key, now);
  if (!html) return false;
  card.innerHTML = html.replace(/<button class="sx-close"[^>]*>×<\/button>/, "");
  card.dataset.key = key;
  card.hidden = false;
  button.setAttribute?.("aria-expanded", "true");
  return true;
}

// ---------- 建造页：图标格 + 详情卡 ----------
export function buildTiles(modal, ctx = {}) {
  const content = modal.querySelector?.(".modal-content");
  if (!content || content.classList.contains("look-build")) return false;
  const tiles = [...content.querySelectorAll(".recipe-grid > article.recipe")];
  if (!tiles.length) return false;
  const doc = modal.ownerDocument || globalThis.document;
  const list = doc.createElement("div");
  list.className = "look-build-list";
  while (content.firstChild) list.appendChild(content.firstChild);
  const aside = doc.createElement("aside");
  aside.className = "look-build-detail";
  aside.setAttribute("aria-live", "polite");
  content.append(list, aside);
  content.classList.add("look-build");
  let chosen = null;
  const show = (tile, pick = false) => {
    if (!tile) return;
    if (pick) {
      chosen = tile;
      for (const t of tiles) t.classList.toggle("look-on", t === tile);
    }
    aside.innerHTML = "";
    const head = doc.createElement("div");
    head.className = "look-bd-head";
    const ic = tile.querySelector(":scope > .item-icon, :scope > canvas");
    if (ic) {
      const copy = ic.cloneNode(true);
      // 画布复制不带画好的内容：照着原来那张再画一遍
      if (copy.getContext && ic.width) {
        copy.width = ic.width;
        copy.height = ic.height;
        copy.getContext("2d")?.drawImage?.(ic, 0, 0);
      }
      // 雪碧图小图：按新的大小重新算位置（详情卡里是 64 像素）
      const n = Number(copy.dataset?.icon);
      if (copy.tagName === "I" && Number.isFinite(n) && copy.style) {
        copy.style.backgroundPosition = `${-(n % 8) * 64}px ${-Math.floor(n / 8) * 64}px`;
      }
      head.appendChild(copy);
    }
    const body = tile.querySelector(".recipe-body");
    const h3 = body?.querySelector("h3");
    if (h3) head.appendChild(h3.cloneNode(true));
    aside.appendChild(head);
    for (const el of body?.children || []) {
      if (el === h3) continue;
      aside.appendChild(el.cloneNode(true));
    }
    const btn = aside.querySelector('button[data-action="build"]');
    if (btn?.disabled) {
      const why = doc.createElement("p");
      why.className = "look-bd-why";
      why.textContent = ctx.engine?.s?.region && ctx.engine.s.region !== "farm" ? "只能在农场上建。" : "材料还不够（红字是缺的）。";
      btn.after(why);
    }
  };
  tiles.forEach((tile) => {
    tile.tabIndex = 0;
    tile.setAttribute("role", "button");
    const btn = tile.querySelector('button[data-action="build"]');
    if (btn?.disabled) tile.classList.add("look-poor");
    tile.addEventListener?.("mouseenter", () => show(tile));
    tile.addEventListener?.("focus", () => show(tile));
    tile.addEventListener?.("mouseleave", () => chosen && show(chosen));
    tile.addEventListener?.("click", (ev) => {
      if (ev.target?.closest?.("button")) return;
      show(tile, true);
      // 手柄按 A（不是鼠标点的）：选中以后焦点跳到卡上的“建一个”，再按一下 A 就建
      if (ev.detail === 0) aside.querySelector('button[data-action="build"]:not([disabled])')?.focus?.();
    });
    tile.addEventListener?.("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        show(tile, true);
        aside.querySelector('button[data-action="build"]:not([disabled])')?.focus?.();
      }
    });
  });
  // 先选第一样建得起的（都建不起就第一样）
  const first = tiles.find((t) => !t.classList.contains("look-poor")) || tiles[0];
  show(first, true);
  return true;
}

// ---------- 顶栏 ----------
let lastMoney = null,
  coinTimer = 0;
export function lookHud(e, doc = globalThis.document, win = globalThis) {
  if (!e || !doc?.querySelector) return;
  const desk = !!doc.documentElement?.classList?.contains?.("desk");
  // 快没了的那一条（低于四分之一）闪
  for (const st of doc.querySelectorAll("#stat-bars .stat")) {
    const w = parseFloat(st.querySelector(".bar i")?.style?.width || "100");
    st.classList.toggle("low", w < 25);
  }
  // 菜单按钮上的点：有正在进行的事件、没读的来信
  const phone = doc.querySelector(".hud-phone");
  if (phone) {
    let dot = false;
    try {
      dot = (e.activeEvents?.().length || 0) > 0 || !!e.s?.storyCampaign?.unread;
    } catch {}
    phone.classList.toggle("has-dot", dot);
  }
  // 金币变了：在状态块旁边飘“+40 金”
  const money = Math.floor(e.s?.money || 0);
  if (lastMoney === null) lastMoney = money;
  if (money !== lastMoney && desk) {
    const d = money - lastMoney;
    const top = doc.querySelector(".hud-top");
    if (top) {
      top.querySelector(".look-coin")?.remove?.();
      const chip = doc.createElement("span");
      chip.className = "look-coin" + (d < 0 ? " minus" : "");
      chip.textContent = (d > 0 ? "+" : "−") + Math.abs(d).toLocaleString("zh-CN") + " 金";
      chip.setAttribute("aria-hidden", "true");
      top.appendChild(chip);
      clearTimeout(coinTimer);
      coinTimer = setTimeout(() => chip.remove?.(), 2500);
    }
  }
  lastMoney = money;
}
export function resetLookHud() {
  lastMoney = null;
}
