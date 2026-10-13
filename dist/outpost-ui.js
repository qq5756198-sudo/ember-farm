// v0.14.0「商路与火光」的界面：人物对话（像素立绘）、出货箱、商队、入营审查、机床、战报、日终总结、消息记录。
// 所有按钮都调用 outpost.js 里的真实动作；每个新动作都带“花费 / 得到 / 影响”预览。
import { ITEMS, BUILDINGS } from "./data.js";
import { TECH } from "./expansion-data.js";
import { renderStoryJournal, consequence } from "./alliance-ui.js";
import { bundleText, costLine, missingCost } from "./alliance-data.js";
import {
  NPCS,
  VISITOR_LOOKS,
  PEOPLE_TRAITS,
  HELPER_ROLES,
  LATHE_MODES,
  BUNDLES,
  RAID_PREP,
  CARGO,
  UPKEEP,
} from "./outpost-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") =>
  `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const hhmm = (m) => String(Math.floor(m / 60) % 24).padStart(2, "0") + ":" + String(Math.floor(m % 60)).padStart(2, "0");

// ---------- 程序绘制的像素立绘 ----------
export function portrait(look, label = "") {
  const L = typeof look === "string" ? NPCS[look]?.look : VISITOR_LOOKS[look] || VISITOR_LOOKS[0];
  const k = L || VISITOR_LOOKS[0];
  const r = (x, y, w, h, c) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${c}"/>`;
  let body =
    r(0, 0, 16, 16, "#1d2a22") +
    r(0, 13, 16, 3, "#16201a") +
    r(2, 12, 12, 4, k.coat) +
    r(6, 12, 4, 1, k.accent) +
    r(6, 11, 4, 1, "#00000033") +
    r(4, 4, 8, 7, k.skin) +
    r(3, 2, 10, 3, k.hair) +
    r(3, 5, 1, 3, k.hair) +
    r(12, 5, 1, 3, k.hair) +
    r(6, 7, 1, 1, "#1f1b18") +
    r(9, 7, 1, 1, "#1f1b18") +
    r(7, 9, 2, 1, "#8a4a3a");
  const extra = k.extra;
  if (extra === "hat") body += r(2, 1, 12, 2, k.accent) + r(4, 0, 8, 1, "#6d5a2c");
  if (extra === "scarf") body += r(3, 11, 10, 2, k.accent);
  if (extra === "bell") body += r(7, 13, 2, 2, k.accent) + r(3, 2, 2, 2, k.hair) + r(11, 2, 2, 2, k.hair);
  if (extra === "glasses") body += r(5, 6, 2, 2, k.accent) + r(9, 6, 2, 2, k.accent) + r(7, 7, 2, 1, k.accent) + r(6, 7, 1, 1, "#1f1b18") + r(9, 7, 1, 1, "#1f1b18");
  if (extra === "scar") body += r(10, 5, 1, 4, k.accent);
  if (extra === "goggles") body += r(4, 3, 8, 2, "#5a4a3a") + r(5, 3, 2, 2, k.accent) + r(9, 3, 2, 2, k.accent);
  if (extra === "dog") body = r(0, 0, 16, 16, "#1d2a22") + r(2, 3, 3, 6, k.hair) + r(11, 3, 3, 6, k.hair) + r(4, 4, 8, 9, k.skin) + r(5, 10, 6, 4, k.coat) + r(6, 7, 1, 1, "#1f1b18") + r(9, 7, 1, 1, "#1f1b18") + r(7, 10, 2, 1, "#1f1b18") + r(7, 12, 2, 2, "#c96a6a") + r(4, 13, 8, 2, k.accent);
  if (extra === "screen") body = r(0, 0, 16, 16, k.coat) + r(2, 2, 12, 9, k.hair) + r(3, 3, 10, 7, k.skin) + r(5, 5, 2, 2, "#22352b") + r(9, 5, 2, 2, "#22352b") + r(6, 8, 4, 1, "#22352b") + r(4, 12, 8, 2, k.accent);
  return `<svg class="portrait" viewBox="0 0 16 16" shape-rendering="crispEdges" role="img" aria-label="${esc(label || "人物立绘")}">${body}</svg>`;
}
const npcHead = (key, line, look = key, name = NPCS[key]?.name, title = NPCS[key]?.title) =>
  `<header class="npc-head">${portrait(look, name)}<div><b>${esc(name)}</b><small>${esc(title || "")}</small><p class="npc-line">${esc(line)}</p></div></header>`;

// ---------- HUD ----------
export function outpostHud(e) {
  if (!e.o) return null;
  const days = e.foodDays(),
    tone = days < 1 ? "danger" : days < 2.5 ? "warn" : "ok",
    r = e.raidState();
  let raid = null;
  const who = r === e.o.raid ? "灰隼团" : "灰隼团残部";
  if (r.phase === "warning") raid = "⚠ " + who + " · 东侧林子 · " + Math.ceil(r.timer) + " 秒后进攻 · Z 看防线";
  if (r.phase === "active")
    raid =
      "⚠ " + who + "进攻中 · 剩余 " +
      (Math.max(0, r.total - r.spawned) + e.enemies.filter((x) => x.type === "raider" && !x.dead).length) +
      " 名枪手 · 看到红线就挪位置";
  return {
    food: {
      text: "口粮 " + days + " 天",
      tone,
      title: "仓库与背包共 " + e.foodPortions() + " 份口粮；每天约吃 " + e.foodNeed() + " 份（" + (e.eaters().length + 1) + " 人，每人两餐）",
    },
    raid,
  };
}

// ---------- 任务手记：前哨状况 ----------
function outpostStrip(e) {
  const o = e.o,
    hud = outpostHud(e),
    act = e.sc?.act || 1;
  const crew = o.crew
    .map(
      (c) =>
        `<li>${portrait(c.look, c.name)}<span><b>${esc(c.name)}</b> · ${esc(HELPER_ROLES[c.role])} · ${esc(PEOPLE_TRAITS[c.trait].name)}<small>${esc(c.status)}${c.fedDay === e.s.day ? " · 今天吃过早饭" : ""}</small></span>${button("oView", "crew:" + c.id, "说话")}</li>`,
    )
    .join("");
  const sick =
    o.sick >= e.s.day
      ? `<p class="outpost-alert">营地有人生病：援建队干活慢一半。${button("oCure", "", "治疗（药包×1 或 绷带×2）")}</p>`
      : "";
  return `<section class="outpost-strip" aria-label="前哨状况"><div class="outpost-food ${hud.food.tone}"><b>${esc(hud.food.text)}</b><span>${esc(hud.food.title)}</span></div>${sick}<div class="outpost-links">${act >= 3 ? button("oView", "bundles", "联盟援建清单 " + o.bundles.length + "/4") : ""}${button("oView", "ledger", "出货账本")}${e.lastRaidReport() ? button("oView", "raid", "上次战报") : ""}${button("oView", "log", "消息记录（L）")}${button("oDefense", "", "查看防线（Z）")}</div>${crew ? `<details class="journal-extra"><summary>援建队员 · ${o.crew.length + (e.sc?.helpers.length || 0)}人</summary><ul class="crew-list">${crew}</ul></details>` : ""}</section>`;
}
export function renderOutpostJournal(e, ui = {}) {
  const html = renderStoryJournal(e, ui);
  if (ui.catalog || !e.o) return html;
  const at = html.indexOf('<div class="journal-options">');
  return at < 0 ? html + outpostStrip(e) : html.slice(0, at) + outpostStrip(e) + html.slice(at);
}

// ---------- 加工站：抢工与故障 ----------
export function stationExtras(e, b) {
  if (!b || !e.o) return "";
  const jobs = e.c.production.filter((j) => j.station === b.type);
  if (!jobs.length) return "";
  const rows = jobs
    .map((j) => {
      const out = Object.keys(j.out)[0],
        inc = e.o.incidents.find((i) => i.job === j.id),
        reason = e.rushReason(j);
      if (inc) {
        const cost = e.incidentCost(inc),
          left = Math.max(0, Math.ceil(inc.deadline - e.abs()));
        return `<div class="rush-row incident"><b>${inc.type === "fire" ? "🔥 起火" : "⚙ 卡料"} · ${esc(ITEMS[out].name)}</b><span>${left} 分钟内不处理：这批料报废，设施掉两成耐久（不会烧毁）</span>${consequence({ cost: cost.water ? "水壶 " + cost.water + " 格水（现有 " + e.c.water + "）" : cost.parts ? "机械零件×1" : "不花材料（手巧的队员在场）", gain: "保住这批加工", effect: "处理后继续计时" })}${button("oFix", j.id, inc.type === "fire" ? "扑灭" : "排除卡料")}</div>`;
      }
      return `<div class="rush-row"><b>${esc(ITEMS[out].name)}×${j.out[out]}</b><span>${j.ready ? "已做好，等待领取" : "还要约 " + Math.ceil(j.remaining) + " 分钟"}${e.o.rushed.includes(j.id) ? " · 已抢工" : ""}</span>${j.ready ? "" : consequence({ cost: "有 30% 机会起火或卡料（手巧的人在场 15%）", gain: "剩余时间减半", effect: "出事后 60 分钟内必须处理" }) + button("oRush", j.id, "抢工", reason ? `disabled title="${esc(reason)}"` : "")}</div>`;
    })
    .join("");
  return `<section class="station-rush" aria-label="抢工"><h3>${esc(BUILDINGS[b.type]?.name || "设施")} · 正在加工</h3>${rows}</section>`;
}

// ---------- 各个视图 ----------
function viewSummary(e) {
  const r = e.o.report;
  if (!r) return "<p>还没有日终总结。睡一觉后会出现。</p>";
  const sign = (n) => (n > 0 ? "+" + n : String(n));
  return `<div class="day-summary"><h3>第 ${r.day} 天结束</h3><dl class="summary-grid"><div><dt>金币</dt><dd>${sign(r.money)}</dd></div><div><dt>击败</dt><dd>${r.kills}</dd></div><div><dt>收获</dt><dd>${r.harvested} 株</dd></div><div><dt>口粮</dt><dd>${r.foodStart} → ${r.foodEnd} 份</dd></div></dl>${r.night.length ? `<h4>夜里发生的事</h4><ul>${r.night.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}<h4>今天要留意</h4><ul class="summary-threats">${r.threats.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><div class="button-row">${button("oClose", "", "开始新的一天", 'class="primary"')}${button("oJournal", "", "打开任务手记")}</div></div>`;
}
// 出货行情：今天比平常高或低多少。
function trendText(e, id) {
  const t = e.shipTrend?.(id);
  if (!Number.isFinite(t)) return "";
  const n = e.shipTrendTomorrow?.(id),
    word = (v) => (Math.abs(v) < 3 ? "平稳" : (v > 0 ? "↑" : "↓") + Math.abs(v) + "%");
  return (Math.abs(t) < 3 ? " · 行情平稳" : ` · 今日行情 ${t > 0 ? "↑" : "↓"}${Math.abs(t)}%`) + (Number.isFinite(n) ? " · 明天" + word(n) : "");
}
function viewShipping(e) {
  const o = e.o,
    farm = e.s.region === "farm";
  const goods = Object.entries(e.s.inventory)
    .filter(([id, n]) => n > 0 && ITEMS[id] && !ITEMS[id].protected && e.shipPrice(id) > 0)
    .sort((a, b) => e.shipPrice(b[0]) * b[1] - e.shipPrice(a[0]) * a[1]);
  const rows = goods
    .map(
      ([id, n]) =>
        `<div class="ship-row"><div><b>${esc(ITEMS[id].name)} ×${n}</b><small>每份 ${e.shipPrice(id)} 金币${trendText(e, id)}</small></div><div class="ship-actions">${button("oShip", id + ":1", "放 1 份", farm ? "" : "disabled")}${button("oShip", id + ":all", "全部放入", farm ? "" : "disabled")}</div></div>`,
    )
    .join("");
  const box = Object.entries(o.shipBox)
    .map(([id, n]) => `<div class="ship-row in-box"><div><b>${esc(ITEMS[id].name)} ×${n}</b><small>${e.shipPrice(id) * n} 金币${trendText(e, id)}</small></div><div class="ship-actions">${button("oUnship", id, "取回")}</div></div>`)
    .join("");
  const ledger = o.ledger
    .slice(0, 5)
    .map((l) => `<li>第${l.day}天 · ${esc(bundleText(l.items))} · +${l.income} 金币</li>`)
    .join("");
  return `<p class="muted">放进箱子的东西会在明早 0 点按收购价自动卖掉，钱直接入账；早上之前随时可以取回。口粮也能卖——卖之前想想今晚的晚饭。${e.shipTrend ? "收购价每天浮动，按放进箱子那天的行情结算。" : ""}</p>${consequence({ cost: "放入的物品", gain: "明早 +" + e.shipValue() + " 金币", effect: "口粮还能撑 " + e.foodDays() + " 天" })}<div class="ship-grid"><section><h3>背包里能卖的</h3>${rows || "<p class='muted'>背包里没有能出货的东西。</p>"}</section><section><h3>出货箱 · 明早结算 ${e.shipValue()} 金币</h3>${box || "<p class='muted'>箱子是空的。</p>"}${ledger ? `<h4>最近的出货</h4><ul class="ledger">${ledger}</ul>` : ""}</section></div>`;
}
function viewCaravan(e) {
  const c = e.o.caravan;
  if (!e.caravanHere()) return `<p>唐九的商队不在。${c.next ? "下次第" + c.next + "天上午来。" : "第一支车队到站后，他才会沿商路过来。"}</p>`;
  const line = e.caravanTrusted()
    ? NPCS.tangjiu.lines.trusted
    : c.debt
      ? NPCS.tangjiu.lines.debt
      : c.exposed
        ? NPCS.tangjiu.lines.exposed
        : NPCS.tangjiu.lines.hello;
  const offers = c.offers
    .map((f) => {
      const price = e.offerPrice(f),
        tag =
          f.inspected === "fake"
            ? '<em class="tag bad">看出是假货</em>'
            : f.inspected === "real"
              ? '<em class="tag good">验过是真货</em>'
              : f.inspected === "unclear"
                ? '<em class="tag">没看出名堂</em>'
                : "";
      return `<article class="offer${f.sold ? " sold" : ""}"><h3>${esc(e.offerName(f))} ${tag}</h3><p>${f.tech ? esc(TECH_DESC(f.tech)) : esc(ITEMS[f.item].desc || "")}</p>${consequence({ cost: price + " 金币（现有 " + e.s.money + "）", gain: e.offerName(f), effect: f.tech ? "解锁对应设施" : "唐九的货可能掺假：先细看，买到假货可以当面拆穿退钱" })}<div class="button-row">${f.sold ? "<b>已买下</b>" : button("oInspect", f.key, "细看", f.inspected ? "disabled" : "") + button("oBuy", f.key, "买下", e.s.money < price ? "disabled" : 'class="primary"')}</div></article>`;
    })
    .join("");
  const cheated = c.cheated.length
    ? `<div class="outpost-alert">你买到过假货：${esc(c.cheated.map((x) => ITEMS[x.fake].name + "冒充" + ITEMS[x.item].name).join("、"))}。${button("oExpose", "", "当面拆穿，退钱")}</div>`
    : "";
  return npcHead("tangjiu", line) + cheated + `<div class="offer-grid">${offers}</div><p class="muted">细看成功率随探索等级提高（现在约 ${Math.round((0.55 + 0.08 * e.level("exploration")) * 100)}%）。今天 20:00 收摊。</p>`;
}
const TECH_DESC = (id) => TECH[id]?.desc || "";
function viewReview(e) {
  const v = e.o.visitors.current;
  if (!v) return "<p>营门口现在没人。</p>";
  const clue = (k, label, act) =>
    v.checked.includes(k)
      ? `<div class="clue"><dt>${label}</dt><dd>${esc(v.clues[k])}</dd></div>`
      : `<div class="clue hidden"><dt>${label}</dt><dd>${button("oCheck", k, act)}</dd></div>`;
  const full = e.crewFull(),
    isHuer = v.huer !== null && v.huer !== undefined;
  return `${npcHead(null, v.story, v.look, v.name, "来自" + v.from + " · 想当" + HELPER_ROLES[v.role] + " · " + PEOPLE_TRAITS[v.trait].name)}<dl class="clues">${clue("papers", "证件", "看证件")}${clue("body", "身上", "检查身体")}${clue("bag", "行李", "翻看行李")}</dl><p class="muted">提示：伤口、发烧可能是感染；证件日期、章和行李里的“前哨货”可能说明是小偷。援建营地 ${e.crewCount()}/3。</p><div class="review-choices"><article>${consequence({ cost: "每天 2 份口粮", gain: "多一名" + HELPER_ROLES[v.role] + "队员", effect: "如果看错了：病人会传染营地，小偷夜里偷仓库" })}${button("oVisitor", "accept", full && !isHuer ? "营地满员" : "接纳", full && !(isHuer && v.kind !== "honest") ? "disabled" : 'class="primary"')}</article><article>${consequence({ cost: "1 份口粮", gain: "明早见分晓：没问题就入营", effect: "小偷会趁夜带走一点东西" })}${button("oVisitor", "quarantine", "隔离观察一晚", isHuer ? "disabled" : "")}</article><article>${consequence({ cost: "不花", gain: "不冒险", effect: "错过一个帮手" })}${button("oVisitor", "reject", "拒绝")}</article></div>`;
}
function viewLathe(e) {
  const o = e.o;
  if (!o.lathe) return "<p>机床还没修好。</p>";
  const modes = Object.entries(LATHE_MODES)
    .filter(([id, m]) => !m.retired || o.lathe.mode === id)
    .map(
      ([id, m]) =>
        `<article class="${o.lathe.mode === id ? "current" : ""}"><h3>${esc(m.pick)}</h3><p>${esc(m.desc)}</p>${consequence({ cost: bundleText(m.input) + " × " + e.latheSlots() + " 批 / 天", gain: bundleText(m.output) + " × " + e.latheSlots() + " 批 / 天", effect: "每天 18:00 自动开工，缺料停工" })}${o.lathe.mode === id ? "<b>正在做这个</b>" : button("oLathe", id, "改成这个")}</article>`,
    )
    .join("");
  return npcHead("youke", o.youkeUpset === e.s.day ? NPCS.youke.lines.upset : NPCS.youke.lines.gadget) + `<div class="story-choice">${modes}</div>${gadgets(e)}`;
}
function gadgets(e) {
  const o = e.o;
  if (!o.youke) return "";
  return `<h3>尤可的小发明</h3><div class="story-choice">${Object.entries(NPCS.youke.gadgets)
    .map(([id, g]) => {
      const done = o.gadgets.includes(id),
        lack = missingCost(e, g.cost);
      return `<article><h3>${esc(g.name)}</h3><p>${esc(g.effect)}</p>${consequence({ cost: costLine(e, g.cost), gain: g.name, effect: g.effect })}${done ? "<b>已经装好</b>" : button("oGadget", id, "请尤可做", lack.length || e.s.region !== "farm" ? "disabled" : "")}</article>`;
    })
    .join("")}</div>`;
}
function viewCrew(e, id) {
  const c = e.o.crew.find((x) => x.id === id);
  if (!c) return "<p>这位队员已经离开了。</p>";
  const line =
    c.id === "huer"
      ? NPCS.huer.lines.guard
      : c.id === "yaozi"
        ? NPCS.yaozi.lines.stay
        : c.id === "youke"
          ? e.o.youkeUpset === e.s.day
            ? NPCS.youke.lines.upset
            : NPCS.youke.lines.gadget
          : "“" + c.status + "。”";
  const title = HELPER_ROLES[c.role] + " · " + PEOPLE_TRAITS[c.trait].name + "（" + PEOPLE_TRAITS[c.trait].desc + "）";
  return `${npcHead(null, line, c.look, c.name, title)}<dl class="summary-grid"><div><dt>现在</dt><dd>${esc(c.status)}</dd></div><div><dt>干活</dt><dd>${c.moved} 次</dd></div><div><dt>早饭</dt><dd>${c.fedDay === e.s.day ? "吃过了" : "还没吃"}</dd></div><div><dt>饭量</dt><dd>${c.trait === "glutton" ? "每天 3 份" : "每天 2 份"}</dd></div></dl>${c.id === "youke" ? gadgets(e) : ""}${c.id !== "youke" ? `<div class="button-row">${consequence({ cost: "—", gain: "空出一个援建名额", effect: "每天少吃 " + (c.trait === "glutton" ? 3 : 2) + " 份口粮，也少一个帮手" })}${button("oDismiss", c.id, "请他离开")}</div>` : ""}`;
}
function viewDialog(e, id) {
  const o = e.o;
  if (id === "hongshu") {
    const line = o.convoy && !o.convoy.done ? NPCS.hongshu.lines.paid : e.quantityForCost("radish", true) < 1 ? NPCS.hongshu.lines.strike : NPCS.hongshu.lines.hello;
    return `${npcHead("hongshu", line)}<p>红薯每拉一趟车要 1 个萝卜当工钱，仓库或背包里没有萝卜它就罢工。${o.cargo ? "第一趟车：" + esc(CARGO[o.cargo].name) + (o.convoy?.done ? "（已到站）" : "（在路上）") + "。" : "第五段的“装车”会用到它。"}</p>`;
  }
  if (id === "yaozi") {
    if (o.prisoner !== "held") return "<p>鹞子的事已经处理过了。</p>";
    const opts = [
      ["interrogate", "审问", { cost: "不花", gain: "弹药×12、废金属×6", effect: "鹞子离开" }],
      ["release", "放走", { cost: "不花", gain: "营地声望 +3", effect: "鹞子离开" }],
      ["stay", "留下当侦察队员", { cost: "每天 2 份口粮", gain: "侦察：每天带回材料，袭击预警更早", effect: "占一个援建名额" }],
    ];
    return `${npcHead("yaozi", NPCS.yaozi.lines.captured)}<div class="story-choice">${opts.map(([k, label, p]) => `<article><h3>${label}</h3>${consequence(p)}${button("oPrisoner", k, label, k === "stay" && e.crewFull() ? "disabled" : "")}</article>`).join("")}</div>`;
  }
  if (id === "cai") {
    const rows = NPCS.cai.challenges
      .map((ch) => {
        const n = Math.min(ch.need, o.cai[ch.id] || 0),
          done = o.claimed.includes("cai:" + ch.id);
        return `<article><h3>${esc(ch.text)}</h3><p>进度 ${n}/${ch.need}</p>${consequence({ cost: "—", gain: bundleText(ch.reward), effect: "配件装在武器上：武器工作台 · 改装" })}${done ? "<b>已领取</b>" : button("oCai", ch.id, "领取配件", n < ch.need ? "disabled" : 'class="primary"')}</article>`;
      })
      .join("");
    return `${npcHead("cai", NPCS.cai.lines.hello)}<div class="story-choice">${rows}</div>`;
  }
  return "<p>没有可说的。</p>";
}
function viewRaid(e) {
  const r = e.lastRaidRecord(),
    rep = e.lastRaidReport();
  if (!rep) return "<p>还没有战报。</p>";
  const prep = rep.prep ? RAID_PREP[rep.prep].name : "没有特别准备";
  return `<div class="raid-report ${rep.won ? "won" : "lost"}"><h3>${rep.won ? (rep.kind === "later" ? "击退灰隼团残部" : "击退灰隼团") : "没守住"} · 第${rep.day}天</h3>${rep.note ? `<p class="muted">${esc(rep.note)}（防守力 ${rep.power}）</p>` : ""}${rep.wounded ? `<p class="warn">交火中营地的人被流弹擦伤 ${rep.wounded} 次。</p>` : ""}<dl class="summary-grid"><div><dt>来袭</dt><dd>${rep.total} 名枪手</dd></div><div><dt>击倒</dt><dd>${rep.killed}</dd></div><div><dt>打跑</dt><dd>${rep.retreated}</dd></div><div><dt>备战</dt><dd>${esc(prep)}</dd></div></dl>${rep.won ? (rep.kind === "later" ? `<p>缴获：${esc(bundleText(rep.gain))}、${rep.money || 0} 金币。${esc(rep.wonText || "袭击者溃散了。")}</p>` : `<p>缴获：${esc(bundleText(rep.gain))}、80 金币。围栏边抓到了鹞子——去农舍西南边决定怎么处置他。</p>`) : `<p>被抢走：${esc(bundleText(rep.lost) || "一些零碎")}。他们第${r.day}天 19:00 还会再来。</p><p class="muted">下次：让居民守瞭望塔（对瞭望塔按 E）、补足弹药、修好东侧围栏；人留在农场更容易赢。</p>`}<div class="button-row">${button("oClose", "", "知道了", 'class="primary"')}${button("oJournal", "", "打开任务手记")}</div></div>`;
}
function viewLog(e, ui) {
  const o = e.o;
  const recent = (ui.toastLog || [])
    .slice(0, 40)
    .map((t) => `<li class="${esc(t.tone)}"><small>${esc(t.time)}</small> ${esc(t.text)}</li>`)
    .join("");
  const kept = o.log.map((l) => `<li class="${esc(l.tone)}"><small>第${l.day}天 ${hhmm(l.minute)}</small> ${esc(l.text)}</li>`).join("");
  return `<div class="log-columns"><section><h3>前哨记录（随存档保存）</h3><ul class="msg-log">${kept || "<li>还没有记录。</li>"}</ul></section><section><h3>这次游玩的提示</h3><ul class="msg-log">${recent || "<li>还没有提示。</li>"}</ul></section></div>`;
}
function viewLedger(e) {
  const o = e.o,
    l = o.ledger.map((x) => `<li>第${x.day}天 · ${esc(bundleText(x.items))} · +${x.income} 金币</li>`).join("");
  const lathe = o.lathe?.mode ? `<p>机床：优先${esc(LATHE_MODES[o.lathe.mode].name)}，每天 18:00 做 ${e.latheSlots()} 批。</p>` : "";
  return `<p>出货箱明早结算：${e.shipValue()} 金币。</p>${lathe}<ul class="ledger">${l || "<li>还没有出过货。</li>"}</ul>${consequence({ cost: "每天约 " + e.foodNeed() + " 份口粮", gain: "现有 " + e.foodPortions() + " 份", effect: "还能撑 " + e.foodDays() + " 天" })}`;
}
function viewBundles(e) {
  return `<p class="muted">联盟按清单收物资，送到后给前哨开长期服务。每份只送一次。</p><div class="story-choice">${Object.entries(BUNDLES)
    .map(([id, b]) => {
      const done = e.hasBundle(id),
        reason = e.bundleReason(id);
      return `<article class="${done ? "done" : ""}"><h3>${esc(b.name)}</h3><p class="story-pack">${esc(costLine(e, b.items))}</p>${consequence({ cost: bundleText(b.items), gain: "营地声望 +2", effect: b.effect })}${done ? "<b>已送达 · 服务生效中</b>" : button("oBundle", id, "交付", reason ? `disabled title="${esc(reason)}"` : 'class="primary"')}${!done && reason ? `<small>${esc(reason)}</small>` : ""}</article>`;
    })
    .join("")}</div>`;
}

const TITLES = {
  summary: "日终总结",
  shipping: "出货箱",
  caravan: "唐九的流动商队",
  review: "入营审查",
  lathe: "机床与小发明",
  crew: "援建队员",
  dialog: "对话",
  raid: "灰隼团战报",
  log: "消息记录",
  ledger: "出货账本",
  bundles: "联盟援建清单",
};
export function outpostTitle(ui) {
  return TITLES[ui.view] || "前哨";
}
export function renderOutpost(e, ui = {}) {
  if (!e.o) return "";
  const id = ui.id || "";
  const body =
    ui.view === "summary"
      ? viewSummary(e)
      : ui.view === "shipping"
        ? viewShipping(e)
        : ui.view === "caravan"
          ? viewCaravan(e)
          : ui.view === "review"
            ? viewReview(e)
            : ui.view === "lathe"
              ? viewLathe(e)
              : ui.view === "crew"
                ? viewCrew(e, id)
                : ui.view === "dialog"
                  ? viewDialog(e, id)
                  : ui.view === "raid"
                    ? viewRaid(e)
                    : ui.view === "log"
                      ? viewLog(e, ui)
                      : ui.view === "ledger"
                        ? viewLedger(e)
                        : ui.view === "bundles"
                          ? viewBundles(e)
                          : "<p>没有内容。</p>";
  return `<div class="outpost-page view-${esc(ui.view || "none")}">${body}</div>`;
}

const ACTIONS = [
  "oView",
  "oClose",
  "oJournal",
  "oShip",
  "oUnship",
  "oInspect",
  "oBuy",
  "oExpose",
  "oCheck",
  "oVisitor",
  "oPrisoner",
  "oCai",
  "oGadget",
  "oLathe",
  "oDismiss",
  "oBundle",
  "oRush",
  "oFix",
  "oCure",
  "oDefense",
];
export function handleOutpostAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, ui, showMenu, closeMenu, renderMenu, save } = ctx,
    id = el.dataset.id || "";
  if (!e.o) return true;
  const stay = () => {
    renderMenu();
    save();
  };
  if (action === "oView") {
    const [view, sub] = id.split(":");
    showMenu("outpost", { view, id: sub || "" });
  } else if (action === "oClose") closeMenu();
  else if (action === "oJournal") showMenu("journey");
  else if (action === "oDefense") {
    ctx.toggleDefense?.();
    closeMenu();
  } else if (action === "oShip") {
    const [item, n] = id.split(":");
    e.shipItem(item, n === "all" ? e.qty(item) : Number(n) || 1);
    stay();
  } else if (action === "oUnship") {
    e.unshipItem(id);
    stay();
  } else if (action === "oInspect") {
    e.inspectOffer(Number(id));
    stay();
  } else if (action === "oBuy") {
    e.buyOffer(Number(id));
    stay();
  } else if (action === "oExpose") {
    e.exposeCheat();
    stay();
  } else if (action === "oCheck") {
    e.checkVisitor(id);
    stay();
  } else if (action === "oVisitor") {
    if (e.decideVisitor(id)) {
      closeMenu();
      save();
    } else stay();
  } else if (action === "oPrisoner") {
    if (e.chooseStory("yaozi", id)) {
      closeMenu();
      save();
    } else stay();
  } else if (action === "oCai") {
    e.claimCai(id);
    stay();
  } else if (action === "oGadget") {
    e.buildGadget(id);
    stay();
  } else if (action === "oLathe") {
    if (e.o.lathe && !e.o.lathe.mode) e.chooseStory("latheMode", id);
    else e.setLatheMode(id);
    stay();
  } else if (action === "oDismiss") {
    if (e.dismissCrew(id)) closeMenu();
    save();
  } else if (action === "oBundle") {
    e.deliverBundle(id);
    stay();
  } else if (action === "oRush") {
    e.rushJob(id);
    stay();
  } else if (action === "oFix") {
    e.fixIncident(id);
    stay();
  } else if (action === "oCure") {
    e.curePlague();
    stay();
  }
  return true;
}

export function hungerDeathNote(e) {
  return e.lastDeath === "hunger"
    ? `<p>你饿晕了，被人抬回了农舍。</p><p class="muted">饥饿归零后会持续掉血。每天至少吃两顿：干粮 35、炖汤 65；口粮不够时，先做干粮、少卖粮。</p><div class="note">恢复至 70 生命、65 饥饿。金币损失 5%。如果是在外面饿晕的，部分普通材料留在了原地，地图上会标记遗落的背包。</div>`
    : "";
}
export { UPKEEP };
