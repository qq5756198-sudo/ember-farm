// v0.25.0「长夜」的界面：顶栏日期变红、尸潮横幅、顶上的提醒、任务手记里的“长夜”和“灰隼团反扑”、
// 长夜打完的战报、第十个长夜的结局卡、档案馆第七个展柜「长夜纪念」、成就册里的长夜、节庆日历上的长夜。
// 不加新面板：战报和结局卡放在原来的“前哨”页里（和灰隼团的战报一样）。
import { ITEMS, REGIONS, BUILDINGS } from "./data.js";
import { ALERT_HOOKS, collectionRows } from "./winter-ui.js";
import { legacyGear } from "./longnight.js";
// v0.28：开局用最上面那一层的新档（v0.27 起新开的档会多说一句“丰年”的旧档提示）
import { newGameState, newGamePlusState } from "./campaign.js";
import { consequence } from "./alliance-ui.js";
import { BOSSES, EVENT_SPOTS } from "./undertow-data.js";
import { LN, ENDING, COUNTER, LEADER, COUNTER_STEPS, ORIGINS, ORIGIN_IDS } from "./longnight-data.js";

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " ×" + n)
    .join("、");
// 游戏里的分钟 → “3 小时 20 分”
const span = (m) => {
  const h = Math.floor(m / 60),
    r = Math.max(0, Math.round(m % 60));
  return (h ? h + " 小时 " : "") + r + " 分";
};

// ---------- 顶栏 ----------
export function lnHud(e) {
  const info = e?.lnInfo?.();
  if (!info?.on) return null;
  const N = info.night;
  let banner = null;
  if (N) banner = "⚠ 长夜 · 第 " + N.wave + "/3 波 · 还剩 " + N.left + " 只" + (N.gap != null ? " · 下一波 " + N.gap + " 秒后" : "") + " · 天亮还有 " + span(N.dawn);
  return { red: !!e.lnRed?.(), banner };
}
// 顶上的提醒里“尸潮来袭”在长夜里换成长夜的说法
export function patchAlerts(e, html) {
  const N = e?.ln?.night;
  if (!N || !html) return html;
  return html.replace(">尸潮来袭<", ">长夜 · 第 " + N.wave + "/3 波<");
}

// ---------- 顶上的提醒 ----------
ALERT_HOOKS.push((e, add) => {
  const c = e?.ct;
  if (!c || !e.ln?.storyDay) return;
  const day = e.s.day;
  if (c.step === 1 && c.day === day && c.scouts + c.fled < COUNTER.scouts.n) {
    const s = EVENT_SPOTS[c.region]?.[c.spot] || EVENT_SPOTS[c.region]?.[0];
    if (s) add(3, "灰隼团的探子 · " + (REGIONS[c.region]?.name || ""), "warn", { region: c.region, x: s.x, y: s.y + 30, label: "灰隼团的探子" });
  }
  if (c.step === 2 && c.sabOn) {
    const z = (e.s.enemies.farm || []).find((q) => q.saboteur && !q.dead);
    add(0, "有人摸进农场了", "danger", z ? { region: "farm", x: z.x, y: z.y, label: "摸进来的人" } : null);
  } else if (c.step === 2 && c.intel && c.day === day && e.s.minute >= COUNTER.sabotage.warn) {
    const b = e.sabTarget?.();
    add(1, "今晚 23:00 有人来破坏", "warn", b ? { region: "farm", x: b.x, y: b.y + 30, label: (BUILDINGS[b.type]?.name || "设施") + " · 守在边上" } : null);
  }
});
ALERT_HOOKS.push((e, add) => {
  if (!e?.lnPending?.() || !e.ln?.storyDay) return;
  const m = e.s.minute;
  if (m < LN.red) return;
  if (m >= LN.warn && e.s.region !== "farm") add(0, "长夜快开始了 · 回农场", "danger", { region: "farm", x: 830, y: 480, label: "农场" });
  else add(1, "今晚 22:00 长夜", "warn", { region: "farm", x: 1300, y: 420, label: "东侧围栏 · 备战" });
});

// ---------- 任务手记：长夜 ----------
export function lnStrip(e) {
  const info = e?.lnInfo?.();
  if (!info?.on) return "";
  const rows = [],
    N = info.night;
  if (N)
    rows.push(
      `<div class="far-row danger"><p><b>长夜</b>第 ${N.n} 个 · 第 ${N.wave}/3 波 · 还剩 ${N.left} 只 · 已打倒 ${N.kills} 只</p><small>天亮还有 ${esc(span(N.dawn))}。守到 04:00 就算守住；倒下就没守住。${N.wave === 3 ? esc(N.bossName) + (N.boss === 2 ? "已经打倒了。" : "在第三波里。") : "第三波有" + esc(N.bossName) + "。"}</small></div>`,
    );
  else if (info.today)
    rows.push(
      `<div class="far-row danger"><p><b>今晚</b>22:00 长夜（第 ${info.tried + 1} 个）· 约 ${info.total} 只 · 第三波有${esc(info.boss)}</p><small>三波从地图边上来。把围栏修好、陷阱摆上、弹药备足，让居民守瞭望塔；今天不能一觉睡过去。</small></div>`,
    );
  else if (info.next) {
    const d = info.next - e.s.day;
    rows.push(`<div class="far-row"><p><b>长夜</b>下一个在第 ${info.next} 天（${d <= 0 ? "今天" : d === 1 ? "明天" : "还有 " + d + " 天"}）· 约 ${info.total} 只 · 第三波有${esc(info.boss)}</p></div>`);
  }
  const last = info.last;
  rows.push(
    `<div class="far-row muted"><p><b>守住</b>${info.held}/${info.goal} 个${info.failed ? " · 没守住 " + info.failed + " 个" : ""}${last ? " · 上一个：第 " + last.n + " 个" + (last.held ? "守住了" : "没守住") : ""}</p>${info.ended ? `<small>余烬地区收复了（第 ${info.endDay} 天）。长夜还会来，不再变大。</small>` : `<small>每守住一个，下一个多两成（最多一倍）；守满 ${info.goal} 个有结局。</small>`}${last ? button("oView", "lnight", "上一个长夜的战报") : ""}</div>`,
  );
  const cr = counterRow(e);
  if (cr) rows.push(cr);
  return `<section class="far-strip ln-strip" aria-label="长夜">${rows.join("")}</section>`;
}
// 灰隼团反扑：三步走到哪了
function counterRow(e) {
  const c = e?.counterInfo?.();
  if (!c) return "";
  const day = e.s.day,
    when = (d) => (d === day ? "今天" : d === day + 1 ? "明天" : "第 " + d + " 天");
  let p = "",
    small = "";
  if (c.step === 1) {
    p = when(c.day) + "：灰隼团的探子在" + (REGIONS[c.region]?.name || "废墟");
    small = c.day === day ? "两个，只待今天。都打倒能搜出他们的地图（已打倒 " + c.scouts + "）。" : "到那天早上会有人看见他们。";
  } else if (c.step === 2) {
    p = c.sabOn ? "有人摸进农场了" : c.intel ? when(c.day) + " 23:00：有人摸进农场，冲着" + (c.target || "设施") + "去" : "灰隼团要摸进农场搞破坏（哪天不知道）";
    small = c.sabOn ? "他们埋东西时打一下就能打断；炸坏的设施可以修。" : "不在农场或睡着了，就看守夜的人（防守力要 " + COUNTER.sabotage.power + "）。";
  } else if (c.step === 3) {
    p = when(c.day) + " 19:00：头领“" + LEADER.name + "”带人来" + (c.tries ? "（又一次）" : "");
    small = "他扔烟雾弹：烟里的人只打得掉一半血，瞭望塔和守卫看不见。他倒下，剩下的人就跑。";
  } else {
    p = "灰隼团散了";
    small = "头领“" + LEADER.name + "”倒下了，这一带再没有人敢收买路钱。";
  }
  return `<div class="far-row ${c.step === 2 && c.sabOn ? "danger" : c.step === 4 ? "muted" : ""}"><p><b>灰隼团</b>${esc(p)}</p><small>${esc(small)}</small></div>`;
}
export function patchLnJournal(e, html) {
  const strip = lnStrip(e);
  if (!strip) return html;
  for (const mark of ['<section class="far-strip u-strip"', '<section class="far-strip"', '<section class="journal-today"']) {
    const at = html.indexOf(mark);
    if (at >= 0) {
      const end = html.indexOf("</section>", at) + "</section>".length;
      return html.slice(0, end) + strip + html.slice(end);
    }
  }
  const at = html.indexOf("</header>");
  return at > 0 ? html.slice(0, at + 9) + strip + html.slice(at + 9) : html;
}

// ---------- 战报、结局卡、导出提醒 ----------
const TITLES = { lnight: "长夜战报", lnEnd: "余烬地区收复", lnExport: "导出一份存档" };
export function longNightTitle(ui, fallback) {
  return TITLES[ui?.view] || fallback(ui);
}
function viewReport(e) {
  const L = e.ln,
    r = L?.last;
  if (!r) return `<p>还没有打过长夜。</p><div class="button-row">${button("oClose", "", "知道了", 'class="primary"')}</div>`;
  const B = BOSSES[r.bossId],
    next = e.nextLongNight(),
    total = e.nightTotal(),
    grow = r.held && (e.lnHeldMult?.() ?? e.lnMult()) < LN.cap ? "多两成" : r.held ? "已经是最大" : "和这一个一样大";
  const why = r.how === "dawn" ? "天亮了，剩下的感染者退回了林子。" : r.how === "cleared" ? "三波都打完了。" : "你倒下以后，感染者在农场里转了一圈，天亮前散了。家园的东西都在。";
  const loot = itemsText(Object.fromEntries(Object.entries(r.items).filter(([id]) => id !== r.memento)));
  const nap = e.lnNapOk?.() ? button("lnNap", "", "睡到早上 8 点", 'class="primary"') : "";
  return `<div class="raid-report ln-report ${r.held ? "won" : "lost"}"><h3>第 ${r.n} 个长夜 · ${r.held ? "守住了" : "没守住"}</h3><p class="muted">${esc(why)}</p><dl class="summary-grid"><div><dt>打到</dt><dd>第 ${r.waves}/3 波</dd></div><div><dt>打倒</dt><dd>${r.kills} 只</dd></div><div><dt>${esc(B.name)}</dt><dd>${r.boss ? "打倒了" : r.waves >= 3 ? "没打倒" : "没来得及来"}</dd></div><div><dt>守住</dt><dd>${L.held}/${LN.goal} 个</dd></div></dl>${
    r.held ? `<p>缴获：金币 ${r.money}${loot ? "、" + esc(loot) : ""}。</p>` : ""
  }${r.memento ? `<p class="gold">${esc(ITEMS[r.memento].name)}：可以捐给档案馆第七个展柜「长夜纪念」。</p>` : ""}<p class="muted">下一个长夜：第 ${next} 天，约 ${total} 只（${grow}）。</p><div class="button-row">${nap}${button("oClose", "", "知道了", nap ? "" : 'class="primary"')}${button("oJournal", "", "打开任务手记")}</div></div>`;
}
function viewEnding(e) {
  const L = e.ln,
    days = Math.max(0, (L.endDay || e.s.day) - (L.storyDay || e.s.day));
  return `<div class="ln-ending"><h3>${esc(ENDING.title)}</h3>${ENDING.lines.map((l) => `<p>${esc(l)}</p>`).join("")}<dl class="summary-grid"><div><dt>守住的长夜</dt><dd>${L.held} 个</dd></div><div><dt>一共打过</dt><dd>${L.tried} 个</dd></div><div><dt>长夜里打倒</dt><dd>${L.kills} 只</dd></div><div><dt>主线打完以后</dt><dd>${days} 天</dd></div></dl><div class="button-row">${button("oClose", "", "接着过日子", 'class="primary"')}${button("wView", "collection", "看看成就册")}</div></div>`;
}
function viewExport(e) {
  const x = e.exportInfo?.() || {},
    since = x.day ? "上次导出是第 " + x.day + " 天，已经 " + x.since + " 天了。" : "这个存档还没导出过，已经玩了 " + e.s.day + " 天。";
  return `<div class="ln-export"><p>${esc(since)}存档只放在这个浏览器里：清理浏览器数据、换电脑都会让它不见。导出一份放在电脑里更稳妥。</p><div class="button-row">${button("export", "", "导出存档", 'class="primary"')}${button("oClose", "", "以后再说")}</div><p class="muted">一周最多提醒一次；设置 → 存档与备份里随时能导出。</p></div>`;
}
// 日终总结页：今天要提醒导出时加一段
export function patchSummaryExport(e, html) {
  if (!e?.ln || e.ln.remindDay !== e.s.day || !e.exportDue) return html;
  const x = e.exportInfo(),
    text = x.day ? "存档已经 " + x.since + " 天没导出了。" : "这个存档还没导出过。";
  const block = `<p class="ln-export-note">${esc(text)}存档只放在这个浏览器里，导出一份放在电脑里更稳妥。${button("export", "", "导出存档")}</p>`;
  const at = html.lastIndexOf('<div class="button-row">');
  return at > 0 ? html.slice(0, at) + block + html.slice(at) : html + block;
}
// 设置里：上次导出是几天前
export function exportLine(e) {
  const x = e?.exportInfo?.();
  if (!x) return "";
  const text = x.day ? "上次导出：第 " + x.day + " 天（" + (x.since ? x.since + " 天前" : "今天") + "）" : "这个存档还没导出过";
  return `<p class="export-line${x.due ? " warn" : ""}">${esc(text)}${x.due ? " · 该导出一份了" : ""}</p>`;
}
export function renderLongNightView(e, ui, fallback) {
  if (!e?.ln || !TITLES[ui?.view]) return fallback(e, ui);
  const body = ui.view === "lnEnd" ? viewEnding(e) : ui.view === "lnExport" ? viewExport(e) : viewReport(e);
  return `<div class="outpost-page view-${esc(ui.view)}">${body}</div>`;
}

// ---------- 档案馆：第七个展柜 ----------
export function lnCaseHtml(e) {
  const T = e?.lnCase?.();
  if (!T || !e.ln?.storyDay) return "";
  const here = !!e.museumHere?.(),
    items = T.donated.map((id) => `<span class="exhibit">${esc(ITEMS[id]?.name || id)}</span>`).join(""),
    can = T.can.map((id) => button("lnDonate", id, "捐：" + (ITEMS[id]?.name || id), here ? "" : "disabled")).join("");
  return `<article class="${T.done ? "done" : ""} ln-case"><small>${T.donated.length}/${T.need}</small><h3>${esc(T.name)}</h3><p class="exhibits">${items || "<span class='muted'>还空着：守住第 1、5、10 个长夜各给一件</span>"}</p>${consequence({ cost: "不花（捐纪念品）", gain: "填满：" + T.reward, effect: T.done ? "加成已生效" : "每样只捐一次" })}${can ? `<div class="button-row">${can}</div>` : ""}</article>`;
}
export function patchLnMuseum(e, html) {
  const card = lnCaseHtml(e);
  if (!card) return html;
  const tail = '</div><div class="button-row">';
  const at = html.lastIndexOf(tail);
  return at > 0 ? html.slice(0, at) + card + html.slice(at) : html + card;
}
// 成就册：长夜和纪念品展柜
export function patchLnCollection(e, html) {
  const info = e?.lnInfo?.(),
    T = e?.lnCase?.();
  if (!info?.on || !T) return html;
  const li = `<li class="${info.ended ? "done" : ""}"><b>长夜</b><span class="bar"><i style="width:${Math.min(100, (info.held / info.goal) * 100)}%"></i></span><span>${Math.min(info.held, info.goal)}/${info.goal}</span><small>${info.ended ? "✓ 余烬地区收复（第 " + info.endDay + " 天）" : "守满 " + info.goal + " 个有结局"}${info.kills ? " · 长夜里打倒 " + info.kills + " 只" : ""}</small></li>`,
    c = e.counterInfo?.(),
    steps = c ? (c.done ? 3 : Math.max(0, c.step - 1)) : 0,
    li3 = c ? `<li class="${c.done ? "done" : ""}"><b>灰隼团反扑</b><span class="bar"><i style="width:${Math.round((steps / 3) * 100)}%"></i></span><span>${steps}/3</span><small>${c.done ? "✓ 灰隼团散了" : COUNTER_STEPS.map((s, i) => (i < steps ? "✓ " : "") + s).join(" · ")}</small></li>` : "",
    li2 = `<li class="${T.done ? "done" : ""}"><b>${esc(T.name)}</b><span class="bar"><i style="width:${Math.min(100, (T.donated.length / T.need) * 100)}%"></i></span><span>${T.donated.length}/${T.need}</span><small>${T.done ? "✓ " : ""}${esc(T.reward)}</small></li>`;
  const at = html.indexOf("</ul>");
  return at > 0 ? html.slice(0, at) + li + li2 + li3 + html.slice(at) : html;
}
// 节庆日历：长夜、灰隼团的探子和夜里的破坏那天标出来
export function patchLnCalendar(e, html) {
  if (!e?.ln?.storyDay) return html;
  let out = html;
  const tagAt = (d, cls, text) => {
    const mark = "<b>第" + d + "天</b>",
      at = out.indexOf(mark);
    if (at < 0) return;
    const rest = out.slice(at + mark.length).replace(/^<span class="tag quiet">—<\/span>/, "");
    out = out.slice(0, at + mark.length) + '<span class="tag ' + cls + '">' + esc(text) + "</span>" + rest;
  };
  const c = e.ct;
  for (let d = e.s.day; d < e.s.day + 14; d++) {
    if (c?.step === 1 && c.day === d) tagAt(d, "danger", "灰隼团的探子");
    if (c?.step === 2 && c.intel && c.day === d && !c.sabOn) tagAt(d, "danger", "夜里有人来破坏");
    if (e.isLongNight(d) && !(d === e.s.day && !e.lnPending() && !e.ln.night)) tagAt(d, "danger", "长夜");
  }
  return out;
}

// ---------- 开始新游戏：选出身；二周目再挑一件带过去的装备 ----------
export function restartTitle(args = {}) {
  return args.plus ? "带着记忆重新开始" : "开始新游戏";
}
export function restartText(args = {}, plain = "") {
  if (!args.plus) return plain;
  return "新开一局，带上学会的图纸、成就册、生涯记录，再挑一件装备（耐久是满的）。钱、物资、建筑、居民和主线进度都不带。开始前会先把现在的家园存一份，可以在设置里恢复。";
}
export function restartPicker(e, args = {}) {
  const pick = ORIGINS[args.origin] ? args.origin : "farmer";
  const cards = ORIGIN_IDS.map((id) => {
    const O = ORIGINS[id],
      on = id === pick;
    return `<button class="origin-card${on ? " active" : ""}" data-action="pickOrigin" data-id="${id}" aria-pressed="${on}"><b>${esc(O.name)}</b><small>${esc(O.line)}</small><span>带：${esc(O.kit)}</span><span class="good">好处：${esc(O.good)}</span><span class="cost">代价：${esc(O.cost)}</span></button>`;
  }).join("");
  let plus = "";
  if (args.plus && e) {
    const gear = legacyGear(e.s),
      keep = gear.includes(args.keep) ? args.keep : "";
    const bp = Object.keys(e.gr?.bp || {}).length,
      trips = e.feel?.career?.trips?.length || 0,
      book = bookSnapshot(e).length;
    plus = `<h4>带过去的</h4><p class="muted">学会的图纸 ${bp} 张 · 成就册 ${book} 项 · 生涯记录 ${trips} 趟</p><h4>再挑一件装备</h4><div class="keep-list">${[
      `<button class="keep-item${keep ? "" : " active"}" data-action="pickKeep" data-id="" aria-pressed="${!keep}">不带</button>`,
      ...gear.map((id) => `<button class="keep-item${keep === id ? " active" : ""}" data-action="pickKeep" data-id="${esc(id)}" aria-pressed="${keep === id}">${esc(ITEMS[id]?.name || id)}</button>`),
    ].join("")}</div>`;
  }
  return `<div class="origin-pick" role="group" aria-label="出身"><h4>出身</h4><div class="origin-list">${cards}</div></div>${plus}`;
}
// 成就册的快照：填满的那些栏，再加上头目、长夜、灰隼团
export function bookSnapshot(e) {
  const out = [];
  try {
    for (const r of collectionRows(e)) if (r.done) out.push(r.name);
  } catch {}
  for (const r of e.bossRecord?.() || []) if (r.wins > 0) out.push("头目 · " + r.name);
  if (e.ln?.ended) out.push("余烬地区收复");
  if (e.ct?.done) out.push("灰隼团散了");
  return out;
}
export function restartState(args = {}, e = null) {
  if (args.plus && e?.storyDone?.()) return newGamePlusState(e.s, args.origin, args.keep || "", bookSnapshot(e));
  return newGameState(args.origin);
}
// 设置里：主线打完以后出现“带着记忆重新开始”
export function ngPlusRow(e) {
  if (!e?.storyDone?.()) return "";
  return `<div class="settings-row"><div>带着记忆重新开始<small>主线打完了：新开一局，带上学会的图纸、成就册、生涯记录和一件装备。原来的家园会先存一份，可以恢复。</small></div><button data-action="restartPlus">重新开始…</button></div>`;
}
// 行囊上方：出身（二周目再写一句）
export function originLine(e) {
  const O = e?.originInfo?.();
  if (!O || !e.ln) return "";
  const L = e.ln.legacy;
  return `<p class="origin-line"><b>出身：${esc(O.name)}</b>${O.id === "farmer" ? "" : "<small>好处：" + esc(O.good) + " · 代价：" + esc(O.cost) + "</small>"}${L ? `<small>第 ${L.ng + 1} 周目 · 带着上一局第 ${L.fromDay} 天的记忆</small>` : ""}</p>`;
}
// 成就册：上一周目带过来的
export function patchLegacyBook(e, html) {
  const L = e?.ln?.legacy;
  if (!L?.book?.length) return html;
  const li = `<li class="done legacy"><b>上一周目</b><span>${L.book.length} 项</span><small>${L.book.map((x) => "✓ " + esc(x)).join(" · ")}</small></li>`;
  const at = html.indexOf("</ul>");
  return at > 0 ? html.slice(0, at) + li + html.slice(at) : html;
}

// ---------- 动作 ----------
const ACTIONS = ["lnDonate", "lnNap"];
export function handleLongNightAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, renderMenu, closeMenu, save } = ctx,
    id = el.dataset.id || "";
  if (!e?.ln) return true;
  if (action === "lnDonate") {
    e.donateMemento(id);
    renderMenu();
    save();
    return true;
  }
  if (action === "lnNap") {
    if (e.sleep()) closeMenu();
    else renderMenu();
    save();
    return true;
  }
  return true;
}
