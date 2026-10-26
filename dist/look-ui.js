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
  return page === "build" ? buildTiles(modal, ctx) : false;
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
