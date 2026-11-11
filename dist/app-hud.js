// v0.50 常驻的七块：顶上资源、钟、右边警报、左下目标、底下身体和手上的东西、右下五个按钮、画面上的一句提示。
// 每块自己记着上一次画的字，变了才重画（正在点的按钮不会被换掉）。
import { ITEMS, WEAPONS, BUILDINGS, REGIONS } from "./data.js";
import { $, esc, svg, itemIcon, portrait, paint, hhmm, itemName } from "./app-kit.js";

const last = {};
function put(id, html) {
  if (last[id] === html) return false;
  last[id] = html;
  const el = $("#" + id);
  if (!el) return false;
  el.innerHTML = html;
  return true;
}
export function hudReset() {
  for (const k of Object.keys(last)) delete last[k];
}

const RES_ICON = { food: "food", mat: "mat", power: "power", gold: "gold", people: "people", morale: "morale" };

export function drawRes(e, open) {
  const list = e.chResources();
  put(
    "res",
    list
      .map(
        (r) =>
          `<button class="res${open === r.id ? " on" : ""}${r.tone === "bad" ? " pulse" : ""}" data-act="res" data-id="${r.id}" aria-label="${esc(r.name + " " + r.text + "，" + r.delta + "。点开看从哪来、到哪去")}">${svg(RES_ICON[r.id], 22, "#f2a93b")}<span><span class="l">${esc(r.name)}<span class="d ${r.tone}">${esc(r.delta)}</span></span><span class="v" style="display:block">${esc(r.text)}</span></span></button>`,
      )
      .join(""),
  );
  return list;
}
export function resPopHtml(r) {
  return `<div class="between"><b class="h2">${esc(r.name)} ${esc(r.text)}</b><span class="tag ${r.tone === "good" ? "good" : r.tone === "bad" ? "bad" : "amber"}">${esc(r.delta)}</span></div><div style="margin-top:8px">${r.rows.map((x) => `<div class="kv"><span>${esc(x.k)}</span><span>${esc(x.v)}</span></div>`).join("")}</div>`;
}

export function drawClock(e, st) {
  const s = e.s,
    wet = ["小雨", "暴雨", "酸雨"].includes(s.weather),
    night = e.isNight?.(),
    season = e.seasonName?.() || "";
  put(
    "clock",
    `<div class="when"><span class="mut">第 ${s.day} 天${season ? " · " + esc(season) : ""}</span><span class="row" style="gap:6px">${svg(night ? "moon" : wet ? "rain" : "sun", 16, "#f2a93b")}${esc(s.weather || "")}</span></div><div class="time">${hhmm(s.minute)}</div><div class="row" style="gap:6px"><button class="iconbtn${st.userPaused ? " on" : ""}" data-act="pause" aria-label="${st.userPaused ? "接着走" : "暂停"}" title="${st.userPaused ? "接着走（空格以外：P）" : "暂停 P"}">${svg(st.userPaused ? "play" : "pause", 20, "#ece6d9")}</button><button class="iconbtn${st.fast ? " on" : ""}" data-act="fast" ${st.canFast ? "" : "disabled"} aria-label="两倍快进" title="${st.canFast ? "两倍快进（在农场、周围没有感染者时）" : "在农场、周围没有感染者时才能快进"}">${svg("fast", 20, "#ece6d9")}</button><button class="iconbtn" data-act="page" data-id="settings" aria-label="设置" title="设置 Esc">${svg("gear", 20, "#ece6d9")}</button></div>`,
  );
}

export function drawAlerts(e) {
  const list = e.chAlerts();
  put(
    "alerts",
    list
      .map(
        (a, i) =>
          `<button class="alert ${a.tone}" data-act="alert" data-id="${i}"><span class="ico">${svg(a.tone === "info" ? "info" : "alert", 22)}</span><span class="grow"><b>${esc(a.title)}</b>${a.sub ? `<small>${esc(a.sub)}</small>` : ""}</span>${svg("go", 18, "#aaa391")}</button>`,
      )
      .join(""),
  );
  return list;
}

export function drawGoal(e) {
  const g = e.chGoal(),
    lines = g.lines.slice(0, 5),
    done = lines.filter((l) => l.done).length;
  const body = g.step ? `<span class="s">${esc(g.step.title)}</span>` : "";
  const list =
    g.stage === "prep" || g.stage === "gate"
      ? lines.map((l) => `<span class="ln${l.done ? " done" : ""}"><span>${esc(l.text)}</span><span class="${l.done ? "" : "bad"}">${esc(l.note || "")}</span></span>`).join("")
      : lines.length
        ? `<span class="dots" aria-label="这一段 ${done}/${lines.length}">${lines.map((l) => `<i class="${l.done ? "on" : ""}"></i>`).join("")}</span>`
        : "";
  put("goal", `<span class="between"><span class="small amber">${esc(g.label)}</span><span class="small mut">手记 J</span></span><span class="t">${esc(g.title)}</span>${body}${list}`);
  return g;
}

const EMPTY = ["", "", "", "近战", "远程", "投掷", "陷阱"];
export function drawHands(e) {
  const s = e.s,
    p = s.player,
    maxHp = e.maxHp?.() || 100,
    maxSta = e.maxSta?.() || 100;
  const v = (cls, icon, color, val, max) => `<div class="vital ${cls}${val / max < 0.25 ? " low" : ""}">${svg(icon, 16, color, 2.4)}<span class="bar"><i style="width:${Math.max(0, Math.min(100, (val / max) * 100))}%"></i></span><b>${Math.ceil(val)}</b></div>`;
  put("vitals", v("hp", "heart", "#ff7b66", p.hp, maxHp) + v("sta", "bolt", "#7fd1a0", p.stamina, maxSta) + v("food", "bowl", "#f2a93b", p.hunger, 100));
  const slots = e.hotbarSlots ? e.hotbarSlots() : [],
    ratio = (id) => {
      const c = e.gr?.cond?.[id];
      return c && c.m ? Math.max(0, c.d / c.m) : -1;
    },
    qty = (id) => (!id || ["hoe", "water", "build"].includes(id) || WEAPONS[id]?.melee ? "" : WEAPONS[id]?.mag ? (s.magazines[id] ?? 0) : id === "crossbow" ? e.qty("bolt") : id === "slingshot" ? e.qty("stone") : e.qty(id) || "");
  const html = slots
    .map((id, i) => {
      const r = ratio(id),
        label = !id ? (EMPTY[i] || "") + "栏空着" : id === "build" ? "建造" : itemName(id);
      return `<button class="slot${s.slot === i ? " on" : ""}${!id ? " empty" : ""}" data-act="slot" data-id="${i}" aria-label="${esc(label)}，按 ${i === 9 ? 0 : i + 1}" title="${esc(label)}">${id ? itemIcon(id, 40) : ""}<span class="k">${i === 9 ? 0 : i + 1}</span>${qty(id) !== "" ? `<span class="q">${qty(id)}</span>` : ""}${r >= 0 ? `<span class="dur${r <= 0.25 ? " low" : ""}"><i style="width:${Math.round(r * 100)}%"></i></span>` : ""}</button>`;
    })
    .join("");
  if (put("hotbar", html)) paint($("#hotbar"));
  // 手上拿着什么、怎么用
  const item = e.currentItem(),
    it = ITEMS[item],
    w = e.weaponStats?.(item);
  let text = "";
  if (!item) text = (EMPTY[s.slot] || "") + "栏空着<span>在仓库里换装</span>";
  else if (item === "build") text = "建造<span>B 打开</span>";
  else if (w?.melee) text = esc(it.name) + "<span>左键挥 · X 推开 · 空格翻滚</span>";
  else if (w?.mag) text = esc(it.name) + `<span>${s.magazines[item] ?? 0}/${w.mag} · 备用 ${e.qty("ammo")} · R 装填</span>`;
  else if (item === "hoe") text = "锄头<span>左键开垦、清杂物</span>";
  else if (item === "water") text = "浇水壶<span>水 " + Math.floor(e.waterTotal ? e.waterTotal() : e.c.water) + "/" + (e.waterMax ? e.waterMax() : e.c.waterCapacity) + " · 到水井灌满</span>";
  else if (it?.type === "seed") text = esc(it.name) + "<span>剩 " + e.qty(item) + " · 左键种下</span>";
  else if (it?.type === "food" || it?.type === "medicine") text = esc(it.name) + "<span>剩 " + e.qty(item) + " · 左键吃掉</span>";
  else text = esc(it?.name || "") + "<span>左键使用</span>";
  put("handlabel", text);
}

const DOCK = [
  { id: "build", name: "建造", key: "B", icon: "build" },
  { id: "team", name: "队友", key: "T", icon: "team" },
  { id: "store", name: "仓库", key: "I", icon: "store" },
  { id: "map", name: "地图", key: "M", icon: "map" },
  { id: "journal", name: "手记", key: "J", icon: "journal" },
];
export function drawDock(e) {
  const ready = (e.c?.production || []).filter((j) => j.ready).length,
    teamOpen = e.chOpen("team");
  put(
    "dock",
    DOCK.map((d) => {
      const off = d.id === "team" && !teamOpen,
        n = d.id === "store" && ready ? ready : 0;
      return `<button class="dock" data-act="page" data-id="${d.id}" ${off ? 'disabled title="还没有人来"' : ""}>${svg(d.icon, 26, "#f2a93b")}<span>${d.name}</span><span class="k">${d.key}</span>${n ? `<span class="n">${n}</span>` : ""}</button>`;
    }).join(""),
  );
}

// 画面上的一句提示：走到东西旁边才出现
export function drawHint(e) {
  const el = $("#hint"),
    o = !e.paused && !e.buildMode ? e.nearestObject() : null,
    text = o ? e.context(o) : "";
  if (!text) {
    if (!el.hidden) el.hidden = true;
    last.hint = "";
    return;
  }
  if (put("hint", `<kbd>E</kbd><span>${esc(text)}</span>`) || el.hidden) el.hidden = false;
}

// 状态条：尸潮、摆建筑、钓鱼
export function drawBanner(e, mouseWorld) {
  const el = $("#banner"),
    h = e.s.horde;
  let text = "",
    bad = false;
  if (e.buildMode) {
    const b = BUILDINGS[e.buildMode],
      reason = mouseWorld ? e.buildReason(e.buildMode, Math.round(mouseWorld.x / 8) * 8, Math.round(mouseWorld.y / 8) * 8) : "";
    text = b.name + "：" + (reason || "这块地能放，点一下放下") + " · Q 转向 · 按住 Shift 连着放 · 右键或 Esc 不放了";
    bad = !!reason;
  } else if (h.phase === "warning") {
    text = "尸潮还有 " + Math.ceil(h.timer) + " 秒到 · " + (e.hordeIntel?.().direction?.name || "东边路口");
    bad = true;
  } else if (h.phase === "active") {
    text = "尸潮在进攻 · 还剩 " + (h.remaining + e.enemies.filter((z) => z.horde && !z.dead).length) + " 只";
    bad = true;
  } else if (e.reeling?.()) text = "收线：按住 E 收，鱼一挣就松手";
  else if (e.c?.fishing) text = e.c.fishing.phase === "bite" ? "咬钩了！按 E 提竿" : "等鱼咬钩…";
  else if (e.s.region !== "farm") {
    const boon = e.chTripBoon?.();
    text = REGIONS[e.s.region].name + (boon ? " · 这一趟：" + boon.name + "（" + boon.text + "）" : "") + (e.isNight?.() ? " · 天黑了" : "");
  }
  if (!text) {
    if (!el.hidden) el.hidden = true;
    last.banner = "";
    return;
  }
  el.className = bad ? "bad" : "";
  if (put("banner", esc(text)) || el.hidden) el.hidden = false;
}

export function barkHtml(key, role, text) {
  return `${portrait(key, role, 48)}<p>${esc(text)}</p>`;
}
