// v0.17.0「远方来客」的界面：夜里的抉择、今日险地与补救（任务手记）、麦穗、彭姐与贺满仓的对话、
// 建造卡上的“贺满仓垫付”、手机式快捷菜单、地图上的险地标记、无障碍选项、键位重设和手柄。
import { BUILDINGS } from "./data.js";
import { costLine, bundleText } from "./alliance-data.js";
import { consequence } from "./alliance-ui.js";
import { portrait } from "./outpost-ui.js";
import { ALERT_HOOKS, renderAtlasPlus } from "./winter-ui.js";
import { renderSeasonsJournal, seasonsTitle, renderSeasonsView, handleSeasonsAction } from "./seasons-ui.js";
import { ATLAS_POINTS } from "./wayfinding.js";
import { NPCS } from "./outpost-data.js";
import {
  NIGHT,
  NIGHT_SPOTS,
  HAZARDS,
  HAZARD_SPOTS,
  FSPOTS,
  DOG_MAX,
  DOG_SKILLS,
  PENG_LEND,
  PENG_BARGAIN,
  PENG_AID,
  PENG_SUPPLY,
  PENG_TRADES,
  FNPCS,
  KEY_ACTIONS,
  RESERVED_KEYS,
  keymapOf,
  keyLabel,
  DEFAULT_KEY,
  FIXED_KEYS,
  validKey,
} from "./farlands-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") =>
  `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const act = (a, id, label, reason, primary = false) =>
  button(a, id, label, reason ? `disabled title="${esc(reason)}"` : primary ? 'class="primary"' : "") + (reason ? `<small class="story-lack">${esc(reason)}</small>` : "");
const head = (key, line, name, title) => {
  const n = FNPCS[key] || NPCS[key];
  return `<header class="npc-head">${portrait(n?.look ? key : 4, name || n?.name)}<div><b>${esc(name || n?.name)}</b><small>${esc(title || n?.title || "")}</small><p class="npc-line">${esc(line)}</p></div></header>`;
};
const nextTradeDay = (e) => {
  let d = e.s.day + (e.s.minute >= 18 * 60 ? 1 : 0);
  while (!e.tradeDay(d)) d++;
  return d;
};

// ---------- 任务手记里的“远方”条 ----------
function farStrip(e) {
  const f = e.fr;
  if (!f || !e.farOpen()) return "";
  const rows = [];
  const h = e.hazardToday();
  if (h) {
    const z = HAZARDS[h.kind],
      state = h.opened ? "已经拿过了" : h.kind === "ashore" && e.s.minute >= z.until ? "已经被冲走了" : h.kind === "migration" && h.spawned && e.hazardFoes() ? "还剩 " + e.hazardFoes() + " 只感染者" : "";
    rows.push(
      `<div class="far-row hazard"><p><b>今日险地</b>${esc(e.regionName(h.region))} · ${esc(z.name)}${state ? " · " + esc(state) : ""}</p><small>风险：${esc(z.risk)}　能拿到：${esc(z.drop)}</small>${!h.opened && !state ? button("xMark", "hazard", "标出位置") : ""}</div>`,
    );
  }
  const nx = f.nextHazard;
  if (nx && nx.day === e.s.day + 1) {
    const z = HAZARDS[nx.kind];
    rows.push(`<div class="far-row"><p><b>明天的险地</b>${esc(e.regionName(nx.region))} · ${esc(z.name)}</p><small>风险：${esc(z.risk)}　能拿到：${esc(z.drop)}</small></div>`);
  } else rows.push(`<div class="far-row muted"><p>明天的险地 20:00 公布。</p></div>`);
  const n = f.night;
  if (n && !n.done && e.nightWindow(n))
    rows.push(`<div class="far-row night"><p><b>今晚</b>${esc(e.regionName(n.region))}有一件事等你决定：${esc(NIGHT[n.kind].name)}（凌晨 5 点前）</p>${button("xMark", "night", "标出位置")}</div>`);
  else if (e.s.minute < 19 * 60 && e.openRuins().length) rows.push(`<div class="far-row muted"><p>19:00 后，三处废墟里会有一件事等你决定。</p></div>`);
  for (const a of f.amends)
    rows.push(
      `<div class="far-row amends"><p><b>补救</b>${esc(a.text)}${a.revisit ? "" : "（" + esc(costLine(e, a.cost)) + "）"}</p>${a.revisit ? "<small>今晚 19:00 后他还会在原地。</small>" : act("xAmends", a.id, "去补救", e.amendsReason(a.id))}</div>`,
    );
  const p = f.peng;
  const peng = {
    asking: "彭姐在农场东边等你答复借粮。",
    waiting: "彭姐回雨巷了。",
    attacked: "雨巷营地被尸群围了！第 " + (p.day + 2) + " 天 08:00 前去解围，或托孩子带回弹药和绷带。",
    offer: "彭姐想和前哨签互助合同。",
    allied: "雨巷同盟 · 第 " + (p.week + 7) + " 天" + (p.turn % 2 === 0 ? "雨巷送粮来" : "轮到前哨供 6 份干粮") + (p.misses ? " · 欠了 " + p.misses + " 次" : ""),
    trader: "彭姐每周来农场做一次买卖，下次第 " + nextTradeDay(e) + " 天。",
    fallen: "雨巷营地散了，彭姐过几天会在别处落脚。",
  }[p.phase];
  if (peng) rows.push(`<div class="far-row peng ${p.phase === "attacked" ? "danger" : ""}"><p><b>雨巷</b>${esc(peng)}</p>${["asking", "attacked", "offer"].includes(p.phase) ? button("xMark", "peng", "标出位置") : ""}</div>`);
  const hm = f.hemc;
  if (hm.debt) {
    const pay = e.installment(),
      due = hemcDueText(e);
    rows.push(`<div class="far-row hemc ${e.hemcDue?.()?.late ? "danger" : ""}"><p><b>垫付</b>欠贺满仓的${esc(BUILDINGS[hm.debt.type]?.name || "设施")}：下一期 ${esc(costLine(e, pay))}${due ? "（" + esc(due) + "）" : ""}</p>${act("xRepay", "", "还这一期", e.repayReason())}</div>`);
  } else if (e.hemcHere() && hm.phase !== "open") {
    const a = e.hemcAudit();
    rows.push(`<div class="far-row hemc"><p><b>账房</b>贺满仓在看前哨的账：出货记录 ${Math.min(a.ledger, 3)}/3、援建清单 ${Math.min(a.bundles, 2)}/2。</p>${button("xMark", "hemc", "标出位置")}</div>`);
  }
  const links = [e.dogReady() ? button("xView", "dog", "麦穗 · 默契 " + f.dog.bond + "/" + DOG_MAX) : "", f.nightLog.length ? button("xView", "nightlog", "夜里的事") : ""].join("");
  return `<section class="far-strip" aria-label="远方与夜里">${rows.join("")}${links ? `<div class="outpost-links">${links}</div>` : ""}</section>`;
}
export function renderFarlandsJournal(e, ui = {}) {
  const html = renderSeasonsJournal(e, ui);
  if (ui.catalog || !e.fr) return html;
  const strip = farStrip(e);
  if (!strip) return html;
  for (const mark of ['<section class="seasons-strip"', '<section class="winter-strip"', '<section class="outpost-strip"']) {
    const at = html.indexOf(mark);
    if (at >= 0) {
      const end = html.indexOf("</section>", at) + "</section>".length;
      return html.slice(0, end) + strip + html.slice(end);
    }
  }
  return html;
}

// ---------- 顶上的“需要处理的事” ----------
ALERT_HOOKS.push((e, add) => {
  const f = e.fr;
  if (!f) return;
  const n = f.night;
  if (n && !n.done && e.nightWindow(n)) add(3, "今晚 · " + NIGHT[n.kind].name, "gold", { ...NIGHT_SPOTS[n.region], label: NIGHT[n.kind].name });
  if (f.peng.phase === "attacked") add(1, "雨巷求援", "danger", { region: "farm", ...FSPOTS.peng, label: "雨巷来的孩子" });
  else if (f.peng.phase === "asking") add(3, "彭姐来借粮", "normal", { region: "farm", ...FSPOTS.peng, label: "彭姐" });
  const h = e.hazardToday();
  if (h && h.kind === "ashore" && !h.opened && e.s.minute < HAZARDS.ashore.until) add(3, "物资漂到" + e.regionName(h.region), "gold", { ...HAZARD_SPOTS[h.region], label: "漂来的物资" });
});

// ---------- 世界地图：险地、今晚的事、雨巷求援 ----------
export function renderFarMap(e, ui = {}) {
  const html = renderAtlasPlus(e, ui);
  if (ui.tab === "local" || !e.fr) return html;
  const pins = [];
  const pin = (id, tone, text) => {
    const [x, y] = ATLAS_POINTS[id],
      k = pins.filter((p) => p.id === id).length;
    pins.push({ id, html: `<span class="far-pin ${tone}" style="left:${((x + 70) / 10).toFixed(1)}%;top:${((y - 14 + k * 26) / 7).toFixed(1)}%">${esc(text)}</span>` });
  };
  const h = e.hazardToday();
  if (h && !h.opened) pin(h.region, "hazard", "今日险地 · " + HAZARDS[h.kind].name);
  const n = e.fr.night;
  if (n && !n.done && e.nightWindow(n)) pin(n.region, "night", "今晚 · " + NIGHT[n.kind].name);
  if (e.fr.peng.phase === "attacked") pin("courtyard", "danger", "雨巷求援");
  if (!pins.length) return html;
  const at = html.indexOf("</svg>");
  return at < 0 ? html : html.slice(0, at + 6) + pins.map((p) => p.html).join("") + html.slice(at + 6);
}

// ---------- 建造卡：贺满仓垫付 ----------
export function buildCardExtras(e, type) {
  if (!e.fr || e.fr.hemc.phase !== "open" || e.fr.hemc.debt) return "";
  const reason = e.advanceReason(type);
  if (reason) return "";
  return `<button class="advance" data-action="xAdvance" data-id="${esc(type)}" title="先建后还，分三期，不收利息">贺满仓垫付</button>`;
}

// ---------- 视图 ----------
function viewNight(e) {
  const n = e.fr.night;
  if (!n || !e.nightWindow(n)) return "<p>今晚没有这样的事。19:00 后再看任务手记。</p>";
  const def = NIGHT[n.kind];
  if (n.done) return `<p>今晚的事已经定了：${esc(def.choices[n.choice].name)}。</p>`;
  const cards = Object.entries(def.choices)
    .map(([id, c]) => {
      const reason = e.nightReason(id);
      const effect = c.guest && !e.strangerCanJoin() ? "明天他托人送来谢礼" : c.effect;
      return `<article><h3>${esc(c.name)}</h3>${consequence({ cost: c.pay ? costLine(e, c.pay) : c.cost, gain: c.gain, effect })}${act("xNight", id, "就这么办", reason)}</article>`;
    })
    .join("");
  return `<header class="night-scene"><b>${esc(def.name)} · ${esc(e.regionName(n.region))}</b><p>${esc(def.scene)}</p></header><div class="story-choice">${cards}</div><p class="muted">拿走的东西，之后可以在任务手记里补救。</p>`;
}
function viewNightLog(e) {
  const rows = e.fr.nightLog.map((l) => `<li>第${l.day}天 · ${esc(NIGHT[l.kind].name)}：${esc(NIGHT[l.kind].choices[l.choice].name)}</li>`).join("");
  const later = e.fr.later.map((l) => `<li>第${l.day}天早上 · 会有回礼（${esc(bundleText(l.items))}）</li>`).join("");
  return `<ul class="ledger">${rows || "<li>还没有。</li>"}</ul>${later ? `<h4>等着的回礼</h4><ul class="ledger">${later}</ul>` : ""}`;
}
function viewDog(e) {
  if (!e.dogReady()) return "<p>还没有狗。废弃居民区有一只饿着的小狗。</p>";
  const d = e.fr.dog,
    pct = Math.round((d.bond / DOG_MAX) * 100);
  const skills = DOG_SKILLS.map((s) => `<li class="${d.bond >= s.bond ? "on" : ""}"><b>${d.bond >= s.bond ? "✓" : "○"} ${esc(s.name)}</b><small>${esc(s.desc)}${d.bond >= s.bond ? "" : " · 默契 " + s.bond + " 解锁"}</small></li>`).join("");
  const today = [d.fedDay === e.s.day ? "✓ 喂过了" : "○ 还没喂", d.petDay === e.s.day ? "✓ 摸过了" : "○ 还没摸", d.outDay === e.s.day ? "✓ 一起出过门" : "○ 还没一起出门"];
  const orders =
    e.b?.benefits?.dogOrders
      ? `<h4>指令</h4><div class="button-row">${[
          ["follow", "跟着我"],
          ["guard", "警戒（1 份干粮/天）"],
          ["wait", "原地等"],
          ["home", "回家"],
        ]
          .map(([m, label]) => button("xDog", "mode:" + m, label, e.b.dog.mode === m ? 'class="primary" aria-pressed="true"' : ""))
          .join("")}</div>`
      : "";
  return `<header class="npc-head">${portrait("maisui", "麦穗")}<div><b>麦穗</b><small>前哨的狗</small><p class="npc-line">默契 ${d.bond}/${DOG_MAX}</p><div class="bond-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${DOG_MAX}" aria-valuenow="${d.bond}"><span style="width:${pct}%"></span></div></div></header><p class="dog-today">${today.map(esc).join("　")}</p><div class="button-row">${act("xDog", "feed", "喂一份干粮（默契 +1）", e.feedReason(), true)}${act("xDog", "pet", "摸摸它（默契 +1）", e.petReason())}</div><p class="muted">带它出一趟远门（农场和集市以外的地方），每天也能默契 +1。</p><h4>本事</h4><ul class="dog-skills">${skills}</ul>${orders}`;
}
function viewPhone(e) {
  const tile = (attrs, glyph, label) => `<button class="phone-tile" ${attrs}><span aria-hidden="true">${glyph}</span>${esc(label)}</button>`;
  const tiles = [
    tile('data-menu="rebuild"', "✦", "任务手记"),
    tile('data-menu="inventory"', "▣", "背包"),
    tile('data-menu="craft"', "⚒", "制作"),
    tile('data-menu="build"', "⌂", "建造"),
    tile('data-menu="map"', "◇", "地图"),
    e.festivalsOpen?.() ? tile('data-action="sView" data-id="calendar"', "☷", "日历") : "",
    e.festivalsOpen?.() ? tile('data-action="sView" data-id="people"', "♥", "人物") : "",
    e.w ? tile('data-action="wView" data-id="decrees"', "§", "法令") : "",
    e.dogReady?.() ? tile('data-action="xView" data-id="dog"', "✿", "麦穗") : "",
    tile('data-action="oView" data-id="shipping"', "⇪", "出货"),
    tile('data-action="oView" data-id="log"', "✉", "消息"),
    tile('data-menu="pause"', "⚙", "设置"),
  ];
  return `<div class="phone-grid">${tiles.join("")}</div>`;
}
function viewPeng(e) {
  const p = e.fr.peng,
    L = FNPCS.peng.lines,
    here = e.pengNear();
  if (p.phase === "asking")
    return `${head("peng", L.hello)}<div class="story-choice"><article><h3>借她六份</h3>${consequence({ cost: costLine(e, PENG_LEND), gain: "彭姐的人情（关系 +2）", effect: "她开春还粮；雨巷有难时第一个想到你" })}${act("xPeng", "lend", "借给她", here ? "" : "回农场再说", true)}</article><article><h3>只借三份</h3>${consequence({ cost: costLine(e, PENG_BARGAIN), gain: "关系 +1", effect: "她嫌少，但也领情" })}${act("xPeng", "bargain", "借三份", here ? "" : "回农场再说")}</article><article><h3>不借</h3>${consequence({ cost: "不花", gain: "口粮留着自己吃", effect: "关系 −1" })}${act("xPeng", "refuse", "婉拒", here ? "" : "回农场再说")}</article></div>`;
  if (p.phase === "attacked") {
    const go = e.pengRescueReason();
    return `${head("kid", L.attacked, "雨巷来的孩子", "彭姐派来求援")}<p class="far-deadline">第 ${p.day + 2} 天 08:00 前还没人去，雨巷就撑不住了。</p><div class="story-choice"><article><h3>带人去雨巷解围</h3>${consequence({ cost: "跑一趟雨巷住区，打退围营的 5 只感染者", gain: "关系 +4，营地声望 +5", effect: "彭姐会提出结盟" })}${act("xPeng", "go", "标出雨巷营地", go, true)}</article><article><h3>托孩子带回弹药和绷带</h3>${consequence({ cost: costLine(e, PENG_AID), gain: "关系 +2，营地声望 +5", effect: "不用跑一趟；彭姐也会提出结盟" })}${act("xPeng", "aid", "交给孩子", here ? "" : "回农场东边找孩子")}</article></div>`;
  }
  if (p.phase === "offer")
    return `${head("peng", L.helped)}<div class="story-choice"><article><h3>签互助合同</h3>${consequence({ cost: "每 14 天里有一周轮到前哨供 " + bundleText(PENG_SUPPLY), gain: "另一周雨巷送粮来；灰隼团来时防守力 +2；尸潮时她的人帮忙打掉 2 只", effect: "轮到前哨时仓库里不够，关系会变差" })}${act("xPeng", "ally", "签合同", here ? "" : "回农场再说", true)}</article><article><h3>只做买卖</h3>${consequence({ cost: "不花", gain: "每周有一天她来卖弹药和零件", effect: "不用供粮，也没人帮你守线" })}${act("xPeng", "decline", "只做买卖", here ? "" : "回农场再说")}</article></div>`;
  if (p.phase === "allied")
    return `${head("peng", L.allied)}<p>下次交接：第 ${p.week + 7} 天，${p.turn % 2 === 0 ? "雨巷送 6 份干粮来" : "轮到前哨供 6 份干粮"}。${p.misses ? "前哨欠了 " + p.misses + " 次。" : ""}</p><p class="muted">灰隼团来时防守力 +2；尸潮时彭姐的人会从侧面杀进来。</p>`;
  if (p.phase === "trader") {
    if (!e.pengHere()) return `${head("peng", L.trader)}<p>彭姐每周来一次，下次第 ${nextTradeDay(e)} 天 08:00–18:00 在农场东边。</p>`;
    const rows = PENG_TRADES.map((t) => `<article><h3>${esc(t.name)}</h3>${consequence({ cost: t.price + " 金币", gain: bundleText(t.give), effect: "每周每样买一次" })}${act("xPeng", "trade:" + t.id, "买", e.pengTradeReason(t.id), true)}</article>`).join("");
    return `${head("peng", L.trader)}<div class="story-choice">${rows}</div>`;
  }
  if (p.phase === "fallen") return `${head("peng", "（雨巷营地散了。过几天彭姐会在别处落脚。）")}`;
  if (p.phase === "waiting") return `${head("peng", L.lent)}<p>彭姐回雨巷了。</p>`;
  return "<p>还没有雨巷的消息。</p>";
}
function viewHemc(e) {
  const h = e.fr.hemc,
    L = FNPCS.hemc.lines;
  if (h.phase !== "open") {
    const a = e.hemcAudit();
    return `${head("hemc", L.hello)}<ul class="fest-stars"><li class="${a.ledger >= 3 ? "on" : ""}">${a.ledger >= 3 ? "✓" : "○"} 出货结算过 3 次（${Math.min(3, a.ledger)}/3）</li><li class="${a.bundles >= 2 ? "on" : ""}">${a.bundles >= 2 ? "✓" : "○"} 交过 2 份联盟援建清单（${Math.min(2, a.bundles)}/2）</li></ul>${act("xHemc", "talk", "请他核账", a.ok ? "" : "账还不够", true)}<p class="muted">账对得上，他就愿意垫付建设材料。</p>`;
  }
  if (h.debt) {
    const d = h.debt,
      left = Object.fromEntries(Object.entries(d.total).map(([id, n]) => [id, n - (d.paid[id] || 0)]).filter(([, n]) => n > 0));
    return `${head("hemc", "账要一笔一笔还。")}<div class="story-choice"><article><h3>垫付：${esc(BUILDINGS[d.type]?.name || d.type)}</h3>${consequence({ cost: "这一期 " + costLine(e, e.installment()), gain: "还剩 " + bundleText(left), effect: hemcDueText(e) || "分三期还，不收利息" })}${act("xRepay", "", "还这一期", e.repayReason(), true)}</article></div>`;
  }
  return `${head("hemc", L.open)}<p>建造菜单里，材料不够的设施会多一个“贺满仓垫付”按钮。先建，再分三期还：每期 3 天到期，按时还不收利息；逾期每天多一成（最多三成），逾期过的还清后 7 天不再垫付。${h.advances ? "已经还清 " + h.advances + " 笔。" : ""}</p><div class="button-row"><button data-menu="build" class="primary">打开建造</button></div>`;
}

// 贺满仓的期限：第几天前还、逾期几天
function hemcDueText(e) {
  const d = e.hemcDue?.();
  if (!d) return "";
  if (d.late > 0) return "第 " + d.k + " 期逾期 " + d.late + " 天，多还 " + Math.round(d.extra * 100) + "%";
  const left = d.due - e.s.day;
  return "第 " + d.k + " 期" + (left <= 0 ? "今天到期" : "第 " + d.due + " 天前还（还有 " + left + " 天）") + "；逾期每天多一成";
}
const TITLES = { night: "夜里的抉择", nightlog: "夜里的事", dog: "麦穗", phone: "快捷菜单" };
export function farlandsTitle(ui, fallback) {
  if (ui.view === "dialog" && (ui.id === "peng" || ui.id === "hemc")) return FNPCS[ui.id].name;
  return TITLES[ui.view] || seasonsTitle(ui, fallback);
}
function intro(e, ui, key) {
  if (ui.intro !== key || !e.featureNew) return "";
  const card = { night: "每晚 19:00 起，三处废墟里会有一件事等你决定，凌晨 5 点前有效。拿走的东西，之后可以在任务手记里补救。", dog: "每天喂它一份干粮、摸摸它、带它出远门，默契够了它会学会新本事。" }[key];
  return card ? `<aside class="intro-card" role="note"><b>新功能 · ${esc(TITLES[key])}</b><p>${esc(card)}</p></aside>` : "";
}
export function renderFarlandsView(e, ui = {}, fallback) {
  if (!e.fr) return renderSeasonsView(e, ui, fallback);
  let body = null;
  if (ui.view === "night") body = viewNight(e);
  else if (ui.view === "nightlog") body = viewNightLog(e);
  else if (ui.view === "dog") body = viewDog(e);
  else if (ui.view === "phone") body = viewPhone(e);
  else if (ui.view === "dialog" && ui.id === "peng") body = viewPeng(e);
  else if (ui.view === "dialog" && ui.id === "hemc") body = viewHemc(e);
  if (body === null) return renderSeasonsView(e, ui, fallback);
  return `<div class="outpost-page view-${esc(ui.view)}">${intro(e, ui, ui.view)}${body}</div>`;
}

// ---------- 设置：无障碍 ----------
export function accessOf(settings) {
  const a = settings?.access || {};
  return { text: a.text === true, color: a.color === true, calm: a.calm === true };
}
export function applyAccess(settings, doc = globalThis.document) {
  const a = accessOf(settings),
    body = doc?.body;
  if (!body) return a;
  body.classList.toggle("a11y-text", a.text);
  body.classList.toggle("a11y-color", a.color);
  body.classList.toggle("a11y-calm", a.calm);
  // 大号文字靠 farlands.css 里的整体放大，这里只保留正文大小设置本身。
  doc.documentElement?.style?.setProperty?.("--ui-font", 16 * (settings?.uiScale || 1) + "px");
  return a;
}

// ---------- 设置：键位 ----------
const KEY_NAME = Object.fromEntries(KEY_ACTIONS.map(([a, , n]) => [a, n]));
// 键位的默认值、校验和“读出当前键位”放在 farlands-data.js（引擎里的提示也要用）
export { keymapOf, keyLabel };
// 把玩家按下的键翻译成游戏原本认的键；被改掉的默认键不再生效。
export function mapKey(settings, key) {
  const raw = settings?.keymap;
  if (!raw || typeof raw !== "object" || !Object.keys(raw).length) return key;
  const map = keymapOf(settings);
  for (const [a, k] of Object.entries(map)) if (k === key) return DEFAULT_KEY[a];
  if (Object.values(DEFAULT_KEY).includes(key)) return "";
  return key;
}
let capturing = null;
export const keyCaptureActive = () => !!capturing;
export function cancelKeyCapture() {
  capturing = null;
}
export function startKeyCapture(action) {
  capturing = DEFAULT_KEY[action] ? action : null;
  return !!capturing;
}
export function captureKey(settings, key) {
  const action = capturing;
  capturing = null;
  if (!action) return "";
  if (key === "escape") return "已取消改键。";
  if (!validKey(key)) return FIXED_KEYS[key] ? `${key.toUpperCase()} 已经用于${FIXED_KEYS[key]}，换一个键。` : "只能改成字母键，换一个。";
  const map = keymapOf(settings),
    other = Object.keys(map).find((a) => a !== action && map[a] === key);
  if (other) map[other] = map[action];
  map[action] = key;
  settings.keymap = Object.fromEntries(Object.entries(map).filter(([a, k]) => DEFAULT_KEY[a] !== k));
  return `${KEY_NAME[action]}改为 ${key.toUpperCase()}` + (other ? `；${KEY_NAME[other]}换成 ${map[other].toUpperCase()}` : "") + "。";
}
export function helpRows(settings) {
  const K = (a) => keyLabel(settings, a);
  return [
    [K("up") + K("left") + K("down") + K("right") + " / 方向键", "移动"],
    ["Shift", "跑步（消耗体力）"],
    [K("interact"), "附近交互 / 上下文种植"],
    ["左键 / 空格", "使用当前工具或攻击"],
    ["1–0 / 滚轮", "切换快捷栏（远程栏选中时再按 5 换下一把）"],
    [K("shove"), "推开身边的感染者；被抓住时立刻挣开"],
    [K("reload"), "装填武器"],
    ["Tab", "背包"],
    [K("craft") + " / " + K("build") + " / " + K("map"), "制作 / 建造 / 地图"],
    [K("journal") + " / K", "任务手记 / 技能"],
    ["F", "远征途中：选下一站"],
    [K("crouch") + " / " + K("stone"), "切换蹲行 / 投石"],
    [K("photo") + " / " + K("aim"), "摄影 / 精英部位"],
    [K("defense") + " / " + K("log"), "防线视图 / 消息记录"],
    [K("rotate"), "旋转建造预览"],
    ["Esc / 右键", "关闭菜单 / 取消建造"],
  ];
}

// ---------- 设置：手柄 ----------
let padPrev = [],
  padSeen = false,
  padName = "";
export function readPad(nav = globalThis.navigator) {
  let pads = [];
  try {
    pads = [...(nav?.getGamepads?.() || [])];
  } catch {
    pads = [];
  }
  const p = pads.find((x) => x && x.connected !== false);
  if (!p) {
    padPrev = [];
    return null;
  }
  padSeen = true;
  padName = String(p.id || "手柄").slice(0, 48);
  const pressed = [...(p.buttons || [])].map((b) => !!(b?.pressed || b?.value > 0.5)),
    edges = pressed.map((v, i) => v && !padPrev[i]);
  padPrev = pressed;
  const dz = (v) => (Math.abs(v || 0) < 0.22 ? 0 : v);
  const ax = p.axes || [];
  return { x: dz(ax[0]), y: dz(ax[1]), ax: dz(ax[2]), ay: dz(ax[3]), held: (i) => !!pressed[i], edge: (i) => !!edges[i] };
}
export function padStatus(nav = globalThis.navigator) {
  if (!nav?.getGamepads) return "这个浏览器不支持手柄。";
  let p = null;
  try {
    p = [...(nav.getGamepads() || [])].find(Boolean);
  } catch {
    p = null;
  }
  if (p) return "已连接：" + String(p.id || "手柄").slice(0, 48);
  return padSeen ? "手柄已断开（" + padName + "）。" : "没有检测到手柄。插上后按一下任意键。";
}

export function settingsExtras(settings) {
  const a = accessOf(settings),
    map = keymapOf(settings);
  const toggle = (id, title, desc) => `<div class="settings-row"><div>${esc(title)}<small>${esc(desc)}</small></div><button data-action="xAccess" data-id="${id}" aria-pressed="${a[id]}">${a[id] ? "已开启" : "已关闭"}</button></div>`;
  const keys = KEY_ACTIONS.map(
    ([id, , name]) =>
      `<div class="key-row"><span>${esc(name)}</span><kbd>${esc(map[id].toUpperCase())}</kbd>${capturing === id ? '<button data-action="xKey" data-id="" class="primary">按下新键…（Esc 取消）</button>' : button("xKey", id, "改键")}</div>`,
  ).join("");
  const pad = [
    ["左摇杆 / 十字键", "移动；菜单里移动焦点"],
    ["A", "交互 / 确认"],
    ["B", "返回 / 取消建造"],
    ["X", "使用工具或攻击（自动瞄准最近的感染者）"],
    ["Y", "背包"],
    ["LB / RB", "切换快捷栏"],
    ["LT", "推开；被抓住时立刻挣开"],
    ["RT", "跑步"],
    ["右摇杆", "朝向"],
    ["Start / Back", "设置 / 任务手记"],
  ]
    .map(([k, v]) => `<div><kbd>${esc(k)}</kbd>${esc(v)}</div>`)
    .join("");
  return `<details class="settings-section" open><summary>无障碍</summary>${toggle("text", "大号文字", "界面文字放大到 130%")}${toggle("color", "色弱友好配色", "危险、提醒、完成改成蓝、橙、白，并加上 ▲ ● ✓ 符号")}${toggle("calm", "减少闪烁与震屏", "开枪和受击不晃镜头，警报不闪烁")}</details><details class="settings-section"><summary>键位</summary><div class="keymap">${keys}</div><div class="button-row">${button("xKeyReset", "", "恢复默认键位")}</div><p class="muted">只能改成字母键；N、F、K 和方向键、Tab、数字键、空格、Shift、Esc 不能改。两个动作选了同一个键时会互换。</p></details><details class="settings-section"><summary>手柄</summary><p>${esc(padStatus())}</p><div class="help-grid">${pad}</div></details>`;
}

// ---------- 行动 ----------
const ACTIONS = ["xView", "xMark", "xNight", "xAmends", "xDog", "xPeng", "xHemc", "xAdvance", "xRepay", "xAccess", "xKey", "xKeyReset"];
export function handleFarlandsAction(action, el, ctx) {
  const { engine: e, ui = {}, showMenu, closeMenu, renderMenu, save, toast, rebuildUI, persist, applyScale } = ctx,
    id = el.dataset.id || "";
  if (e.fr && action === "xView") {
    ui.intro = e.featureNew?.(id) ? id : null;
    e.markSeen?.(id);
  }
  if (!ACTIONS.includes(action)) return handleSeasonsAction(action, el, ctx);
  const stay = () => {
    renderMenu();
    save();
  };
  const settingsDone = (msg) => {
    if (msg) toast(msg);
    persist?.();
    applyScale?.();
    renderMenu();
  };
  if (action === "xAccess") {
    const s = e.s.settings;
    if (["text", "color", "calm"].includes(id)) s.access = { ...accessOf(s), [id]: !accessOf(s)[id] };
    applyAccess(s);
    settingsDone();
    return true;
  }
  if (action === "xKey") {
    if (!id) capturing = null;
    else startKeyCapture(id);
    renderMenu();
    return true;
  }
  if (action === "xKeyReset") {
    capturing = null;
    e.s.settings.keymap = {};
    settingsDone("键位已恢复默认。");
    return true;
  }
  if (!e.fr) return true;
  const mark = (target) => {
    e.guidance.focus = null;
    e.guidance.target = { ...target };
    if (e.d) e.d.track = null;
    if (e.b) e.b.track = null;
    if (rebuildUI) rebuildUI.target = e.guidance.target;
    if (e.s.region === target.region) {
      closeMenu();
      toast("金色路标：" + target.label + "。");
    } else showMenu("map", { selected: target.region });
  };
  if (action === "xView") showMenu("outpost", { view: id, id: "" });
  else if (action === "xMark") {
    const f = e.fr,
      h = e.hazardToday(),
      n = f.night;
    if (id === "hazard" && h) mark({ ...HAZARD_SPOTS[h.region], label: "险地补给 · " + HAZARDS[h.kind].name });
    else if (id === "night" && n) mark({ ...NIGHT_SPOTS[n.region], label: NIGHT[n.kind].name });
    else if (id === "peng") mark({ region: "farm", ...FSPOTS.peng, label: f.peng.phase === "attacked" ? "雨巷来的孩子" : "彭姐" });
    else if (id === "hemc") mark({ region: "farm", ...FSPOTS.hemc, label: "贺满仓的账桌" });
    else toast("现在没有要标的地方。");
  } else if (action === "xNight") {
    if (e.chooseNight(id)) closeMenu();
    else renderMenu();
    save();
  } else if (action === "xAmends") {
    e.makeAmends(id);
    stay();
  } else if (action === "xDog") {
    if (id === "feed") e.feedDog();
    else if (id === "pet") {
      const reason = e.petReason();
      if (reason) toast(reason + "。");
      else e.petDog();
    } else if (id.startsWith("mode:")) {
      if (!e.bdog?.(id.slice(5))) toast("麦穗没听懂——警戒要 1 份干粮。");
      else toast("麦穗：" + { follow: "跟着你", guard: "警戒", wait: "原地等", home: "回家" }[id.slice(5)] + "。");
    }
    stay();
  } else if (action === "xPeng") {
    if (id === "go") {
      const reason = e.pengRescueReason();
      if (reason) toast(reason + "。");
      else mark({ ...FSPOTS.pengCamp, label: "雨巷营地 · 打退围营的尸群" });
      return true;
    }
    if (id.startsWith("trade:")) e.pengTrade(id.slice(6));
    else if (e.pengDecide(id) && !["asking", "attacked", "offer", "trader"].includes(e.fr.peng.phase)) {
      closeMenu();
      save();
      return true;
    }
    stay();
  } else if (action === "xHemc") {
    e.hemcTalk();
    stay();
  } else if (action === "xAdvance") {
    if (e.startAdvance(id)) closeMenu();
    else renderMenu();
  } else if (action === "xRepay") {
    e.repay();
    stay();
  }
  return true;
}
