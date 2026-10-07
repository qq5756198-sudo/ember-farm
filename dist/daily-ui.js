// v0.18.0「每日抉择」的界面：清晨的三选一事件卡、结果页、任务手记里的“今日抉择”条、抉择记录页、
// 顶栏增益小标签和“需要处理的事”提醒。
import { ITEMS } from "./data.js";
import { costLine } from "./alliance-data.js";
import { ALERT_HOOKS, alertItems } from "./winter-ui.js";
import { renderFarlandsJournal, farlandsTitle, renderFarlandsView, handleFarlandsAction } from "./farlands-ui.js";
import { EVENTS, CHAINS, PERKS, BUFFS, CATS, BASIC_SEEDS } from "./daily-data.js";
import { itemsText, cheng } from "./daily.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") =>
  `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const signed = (n) => (n >= 0 ? "+" : "−") + Math.abs(n);
const DAY_WORDS = ["今天", "明天", "两天后", "三天后", "四天后", "五天后", "六天后", "七天后"];
const after = (n) => DAY_WORDS[n] || n + " 天后";
const REGION = { residential: "废弃居民区", hospital: "旧医院", warehouse: "工业仓库", market: "幸存者集市", railDepot: "北线货运站", courtyard: "雨巷住区", ruin: "某片废墟" };

// 每类事件一张像素小图
const ART = {
  farm: "<rect x='2' y='11' width='12' height='3' fill='#6b4f2a'/><rect x='7' y='5' width='2' height='6' fill='#5c8a3a'/><rect x='4' y='4' width='3' height='3' fill='#9fd38a'/><rect x='9' y='3' width='3' height='3' fill='#9fd38a'/>",
  scav: "<rect x='2' y='6' width='12' height='8' fill='#8d754e'/><rect x='2' y='6' width='12' height='2' fill='#c3a574'/><rect x='7' y='8' width='2' height='3' fill='#3a3024'/>",
  camp: "<rect x='3' y='13' width='10' height='1' fill='#5a4a3a'/><rect x='5' y='9' width='6' height='4' fill='#c96a3a'/><rect x='6' y='6' width='4' height='3' fill='#e9a24a'/><rect x='7' y='3' width='2' height='3' fill='#f3d27a'/>",
  trade: "<rect x='4' y='4' width='8' height='8' fill='#e9c05a'/><rect x='5' y='5' width='6' height='6' fill='#c99a2a'/><rect x='7' y='6' width='2' height='4' fill='#f3e2a8'/>",
  crisis: "<rect x='7' y='2' width='2' height='2' fill='#e9806e'/><rect x='5' y='5' width='6' height='3' fill='#e9806e'/><rect x='3' y='9' width='10' height='4' fill='#e9806e'/><rect x='7' y='6' width='2' height='4' fill='#2a1a14'/><rect x='7' y='11' width='2' height='1' fill='#2a1a14'/>",
  luck: "<rect x='7' y='2' width='2' height='12' fill='#9fd3e0'/><rect x='2' y='7' width='12' height='2' fill='#9fd3e0'/><rect x='5' y='5' width='6' height='6' fill='#e8f6fa'/>",
  chain: "<rect x='2' y='6' width='5' height='4' fill='none' stroke='#c9a5e6' stroke-width='1.5'/><rect x='9' y='6' width='5' height='4' fill='none' stroke='#c9a5e6' stroke-width='1.5'/><rect x='6' y='7' width='4' height='2' fill='#c9a5e6'/>",
};
const art = (cat) => `<svg class="daily-art" viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect width="16" height="16" fill="#1d2a22"/>${ART[cat] || ART.luck}</svg>`;

// ---------- 选项文字（与 daily.js 的 applyOp 用同一组数字） ----------
function preview(e, op, tier) {
  const [kind, a, b, c] = op,
    sc = (n) => e.scaleN(n, tier),
    sb = (x) => e.scaleB(x, tier);
  switch (kind) {
    case "give":
      return itemsText(sb(a));
    case "money":
      return "金币 " + signed(sc(a));
    case "rep":
      return "营地声望 " + signed(a);
    case "mood":
      return "居民士气 " + signed(a);
    case "fatigue":
      return a <= -100 ? "居民疲劳清零" : "居民疲劳 " + signed(a);
    case "hp":
      return "生命 " + signed(a);
    case "stamina":
      return a >= 100 ? "体力恢复满" : "体力 " + signed(a);
    case "research":
      return "研究点 +" + a;
    case "xp":
      return ({ combat: "战斗", exploration: "探索", agriculture: "农业" }[a] || "") + "经验 +" + b;
    case "trust": {
      const ids = e.trustTargets(a);
      return ids.length ? ids.map((id) => e.personName(id)).join("、") + "的信任 " + signed(b) : "";
    }
    case "cheer":
      return "心情最差的那位居民：士气 +10，信任 +2";
    case "buff":
      return (b <= 1 ? "今天" : b + " 天内") + BUFFS[a](c);
    case "later": {
      const items = b ? sb(b) : null,
        money = c ? sc(c) : 0;
      return after(a) + "：" + [items ? itemsText(items) : "", money ? "金币 +" + money : ""].filter(Boolean).join("、");
    }
    case "debt":
      return after(a) + "要交出 " + itemsText(sb(b), "");
    case "night":
      return "今晚可能丢 " + itemsText(sb(a), "");
    case "drain":
      return a + " 天里每天少一份收成";
    case "spawn":
      return "农场边来 " + a + " 只感染者" + (b ? "，打完得 " + itemsText(sb(b), "") : "");
    case "ambush":
      return "下次进废墟撞见 " + a + " 只感染者";
    case "cache":
      return "今天" + REGION[b] + "多一个补给点（" + itemsText(sb(a), "") + "）";
    case "crew":
      return a.name + "加入援建队（住满了就留下 " + itemsText(sb(b || {}), "") + "）";
    case "perk":
      return "长期：" + PERKS[a].text;
    case "peng":
      return "彭姐的关系 " + signed(a);
    case "dog":
      return "麦穗默契 " + signed(a);
    case "lose":
      return a === "topItem" ? "最多的一样物资少" + cheng(b) : a === "topSeed" ? (b >= 1 ? "那袋种子全没了" : "那袋种子少" + cheng(b)) : (ITEMS[a]?.name || a) + "少" + cheng(b);
    case "water":
      return "今天的田都算浇过";
    case "fertility":
      return "农田肥力 +" + a;
    case "growthBack":
      return "作物生长退回 " + Math.round(a * 100) + "%";
    case "harvestRipe":
      return "收下所有熟了的作物";
    case "sick":
      return "营地有病号 " + a + " 天";
    case "heal":
      return "病号都好了";
    case "visitor":
      return "明天上午营门来一位访客";
    case "clearRuin":
      return "一片废墟的感染者被清掉";
    case "repair":
      return a === "fences" ? "围栏、大门、瞭望塔修满" : "受损设施全部修满";
    case "rush":
      return "一批加工马上就好";
    case "killJob":
      return "那批成品没了";
    case "stationHit":
      return "那座加工站耐久掉一半";
    case "visitBlock":
      return a + " 天内营门不放人进来";
    case "hordeShift":
      return "尸潮推迟 " + a + " 天";
    case "hordeTomorrow":
      return "尸潮提前到明天";
    case "raidDelay":
      return "灰隼团推迟 " + a + " 天";
    case "raidLess":
      return "下次袭击少 " + a + " 人（最少还会来 3 人）";
    case "raidWarn":
      return "下次袭击预警多 " + a + " 秒";
    case "seeds":
      return "随机种子 " + sc(a) + " 颗";
    case "seedsAll": {
      const n = e.seedsAllN(a, tier, EVENTS[e.dy.pending?.id]?.chain || null);
      return "八种种子各 +" + n + (n < sc(a) ? "（坏了一半）" : "");
    }
    case "seedsOwned":
      return "已有的种子各 +" + sc(a);
    case "rareSeeds":
      return "丰产种子 +" + sc(a);
    case "mod":
      return "一件枪械配件";
    case "random":
      return "随机一样：" + a.map((x) => itemsText(sb(x), "")).join(" / ");
    case "time":
      return "花掉 " + Math.round(a / 60) + " 小时";
    case "caravanDisc":
      return "下次唐九的商队打" + Math.round(a * 10) + "折";
    case "caravanOrder":
      return "下次唐九带来一件枪械配件";
    case "festNext":
      return "下一次节庆多一颗星";
    case "talkUsed":
      return "用掉今晚的营火夜谈";
    case "sellTop": {
      const t = e.topItem(1);
      return t ? "卖掉 " + ITEMS[t.id].name + " " + Math.min(a, t.n) + " 份：金币 +" + Math.max(1, Math.round((sc(b) * Math.min(a, t.n)) / a)) : "没什么可卖的";
    }
    case "payGoods":
      return "";
    case "tell":
      return "知道明天的天气";
    case "next":
      return "";
    case "mark":
      return "";
  }
  return "";
}
const joinFx = (e, fx, tier) =>
  (fx || [])
    .map((op) => preview(e, op, tier))
    .filter(Boolean)
    .join("；");
function followUp(e, ev, o) {
  if (!ev.chain) return "";
  const all = [...(o.fx || []), ...(o.win || [])];
  const next = all.find((op) => op[0] === "next"),
    mark = all.find((op) => op[0] === "mark");
  const onlyWin = o.p && !(o.lose || []).some((op) => op[0] === "next" || op[0] === "mark");
  if (mark) return e.chainFlag(ev.chain, "clue") ? "已经摸清了方向，明天有下文" : "去" + (REGION[mark[2]] || e.regionLabel(mark[2])) + "的标记点，第二天有下文";
  if (next) return after(next[2]) + "有下文" + (onlyWin ? "（成了才有）" : "");
  return ev.step === CHAINS[ev.chain].steps ? "结局" : "这条线到此为止";
}
export function optionModel(e, p, i) {
  const ev = EVENTS[p.id],
    o = ev.opts[i],
    cost = e.optionCost(o, p.tier),
    pay = e.optionPay(o, p.tier),
    reason = e.optionReason(i, p),
    chance = o.p ? e.optionChance(i, p) : null;
  const goods = (o.fx || []).find((op) => op[0] === "payGoods");
  const costText = [cost ? costLine(e, cost) : "", pay ? "金币 " + pay + "（有 " + e.s.money + "）" : "", goods ? "背包里的货，按出货价抵 " + e.scaleN(goods[1], p.tier) + " 金币（现有约 " + Math.floor(e.goodsValue()) + "）" : ""].filter(Boolean).join("、") || "不花";
  let gain, risk;
  const follow = followUp(e, ev, o),
    goesOn = !!follow && !/到此为止/.test(follow);
  if (o.p) {
    gain = [joinFx(e, o.win, p.tier), o.note].filter(Boolean).join("；") || (goesOn ? "这条线往下走" : "平安无事");
    risk = { chance, lose: [o.loseNote, joinFx(e, o.lose, p.tier)].filter(Boolean).join("：") || "什么也没有" };
  } else gain = [joinFx(e, o.fx, p.tier), o.note].filter(Boolean).join("；") || (goesOn ? "这条线往下走" : "什么也不发生");
  return { label: o.label, costText, gain, risk, reason, follow, free: !cost && !pay && !o.req && !goods };
}

// ---------- 事件卡与结果页 ----------
function viewCard(e) {
  const p = e.dailyCard();
  if (!p) return "<p>今天的事已经定了。明天清晨还会有新的一张。</p>";
  const ev = EVENTS[p.id],
    cat = CATS[ev.cat];
  const chain = ev.chain ? CHAINS[ev.chain] : null;
  const prev = ev.chain ? e.dy.history.find((h) => EVENTS[h.id]?.chain === ev.chain && h.choice >= 0) : null;
  const items = new Set();
  const opts = ev.opts
    .map((o, i) => {
      const m = optionModel(e, p, i);
      for (const id of Object.keys(o.cost || {})) items.add(id);
      const won = m.risk ? Math.round(m.risk.chance * 10) : 0;
      const bar = m.risk ? `<span class="chance" role="img" aria-label="成功${esc(cheng(m.risk.chance))}，落空${esc(cheng(1 - m.risk.chance))}">${"<i class='w'></i>".repeat(won)}${"<i class='on'></i>".repeat(10 - won)}</span>` : "";
      return `<article class="daily-opt${m.reason ? " locked" : ""}"><h4><kbd>${i + 1}</kbd>${esc(m.label)}</h4><dl><div><dt>花费</dt><dd>${esc(m.costText)}</dd></div><div><dt>${m.risk ? cheng(m.risk.chance) + "机会" : "得到"}</dt><dd>${esc(m.gain)}</dd></div>${m.risk ? `<div class="risk"><dt>${esc(cheng(1 - m.risk.chance))}</dt><dd>${bar}${esc(m.risk.lose)}</dd></div>` : ""}${m.follow ? `<div class="follow"><dt>后续</dt><dd>${esc(m.follow)}</dd></div>` : ""}</dl>${button("dPick", i, "选这个", (m.reason ? `disabled title="${esc(m.reason)}" ` : "") + `data-hotkey="${i + 1}"`)}${m.reason ? `<small class="story-lack">${esc(m.reason)}</small>` : ""}</article>`;
    })
    .join("");
  const stock = [...items].map((id) => (ITEMS[id]?.name || id) + " " + e.stockOf(id)).join(" · ");
  const weather = e.s.weather ? " · " + e.s.weather : "";
  return `<div class="daily-card cat-${esc(ev.cat)}${e.s.minute >= 360 ? " locked" : ""}"><header class="daily-head">${art(ev.cat)}<div><small>第 ${e.s.day} 天 · 清晨${esc(weather)}</small><h3>${esc(ev.name)}</h3><span class="daily-tag" style="--tone:${cat.tone}">${esc(cat.name)}</span>${chain ? `<span class="daily-tag chain">${esc(chain.name)} · 第 ${ev.step}/${chain.steps} 步</span>` : ""}${p.tier > 1 ? `<span class="daily-tag">奖励 ×${p.tier}</span>` : ""}</div></header><p class="daily-text">${esc(ev.text)}</p>${prev ? `<p class="daily-prev">上一步你选了「${esc(EVENTS[prev.id].opts[prev.choice].label)}」。</p>` : ""}${p.luck ? `<p class="daily-luck">运气在你这边：这张卡上冒险的成功率多两成。</p>` : ""}<div class="daily-opts">${opts}</div><p class="daily-stock">${stock ? "相关库存：" + esc(stock) + " · " : ""}金币 ${e.s.money}<span class="daily-keys">　按 1 / 2 / 3 选择</span></p></div>`;
}
function viewResult(e, ui) {
  const r = ui.dailyResult,
    p = e.dy.pending;
  const ev = EVENTS[r.event],
    o = ev.opts[r.choice];
  const tone = r.win === null ? "" : r.win ? "won" : "lost";
  return `<div class="daily-result ${tone}"><header class="daily-head">${art(ev.cat)}<div><small>第 ${p?.day || e.s.day} 天 · ${esc(ev.name)}</small><h3>${esc(o.label)}</h3></div></header><ul class="daily-lines">${r.lines.map((l) => `<li>${esc(l)}</li>`).join("")}</ul><div class="button-row">${button("dStart", "", "开始第 " + e.s.day + " 天", 'class="primary" data-hotkey="1"')}</div></div>`;
}

// ---------- 任务手记里的“今日抉择”条 ----------
function buffLines(e) {
  const day = e.s.day;
  return e.dy.buffs
    .filter((b) => b.from <= day && b.until >= day)
    .map((b) => BUFFS[b.kind](b.value) + (b.until > day ? "（还剩 " + (b.until - day + 1) + " 天）" : "（今天）"));
}
function dailyStrip(e) {
  const d = e.dy;
  if (!d || e.s.day < 2) return "";
  const p = d.pending,
    rows = [];
  if (p && p.day === e.s.day) {
    const ev = EVENTS[p.id];
    rows.push(p.choice === null ? `<p><b>今日抉择</b>「${esc(ev.name)}」还没选。</p>${button("dView", "daily", "现在决定")}` : `<p><b>今日抉择</b>${esc(ev.name)} → ${esc(ev.opts[p.choice].label)}${p.win === null ? "" : p.win ? "（成了）" : "（没成）"}</p>`);
  } else rows.push(`<p><b>今日抉择</b>明天清晨会有一张新卡。</p>`);
  for (const [c, v] of Object.entries(d.chains)) {
    const step = EVENTS[v.step];
    rows.push(`<p><b>${esc(CHAINS[c].name)}</b>第 ${step.step}/${CHAINS[c].steps} 步 · ${v.mark ? "去" + esc(REGION[v.mark.region] || v.mark.region) + "的标记点（" + esc(v.mark.label) + "）" : "第 " + v.due + " 天早上有下文"}</p>${v.mark ? button("dMark", c, "标出位置") : ""}`);
  }
  const buffs = buffLines(e);
  if (buffs.length) rows.push(`<p><b>生效中</b>${esc(buffs.join("；"))}</p>`);
  return `<section class="daily-strip" aria-label="今日抉择">${rows.map((r) => `<div class="far-row">${r}</div>`).join("")}<div class="outpost-links">${button("dView", "dlog", "抉择记录 · " + d.stats.cards + " 张")}</div></section>`;
}
export function renderDailyJournal(e, ui = {}) {
  const html = renderFarlandsJournal(e, ui);
  if (ui.catalog || !e.dy) return html;
  const strip = dailyStrip(e);
  if (!strip) return html;
  for (const mark of ['<section class="far-strip"', '<section class="seasons-strip"', '<section class="winter-strip"', '<section class="outpost-strip"']) {
    const at = html.indexOf(mark);
    if (at >= 0) return html.slice(0, at) + strip + html.slice(at);
  }
  return html;
}

// ---------- 抉择记录 ----------
function viewLog(e) {
  const d = e.dy;
  const rows = d.history
    .slice(0, 30)
    .map((h) => {
      const ev = EVENTS[h.id];
      return `<li><small>第${h.day}天</small> ${esc(ev.name)} → ${h.choice < 0 ? "错过了" : esc(ev.opts[h.choice].label)}${h.win === null ? "" : h.win ? " · 成了" : " · 没成"}</li>`;
    })
    .join("");
  const chains = Object.entries(CHAINS)
    .map(([c, def]) => {
      const live = d.chains[c],
        done = d.done[c];
      const state = live ? "进行中 · 第 " + EVENTS[live.step].step + "/" + def.steps + " 步" : done ? (done.ending ? "结局：" + done.ending : "到此为止") : "还没遇到";
      return `<li class="${done?.ending ? "on" : ""}"><b>${esc(def.name)}</b><small>${esc(state)}</small></li>`;
    })
    .join("");
  const perks = d.perks.map((k) => `<li class="on"><b>${esc(PERKS[k].name)}</b><small>${esc(PERKS[k].text)}</small></li>`).join("");
  const buffs = buffLines(e)
    .map((t) => `<li>${esc(t)}</li>`)
    .join("");
  const endings = Object.values(d.done).filter((x) => x.ending).length;
  return `<p>已经做过 ${d.stats.cards} 次抉择；冒险 ${d.stats.gambles} 次，成了 ${d.stats.wins} 次。九条连贯事件走到结局 ${endings} 条。</p><div class="log-columns"><section><h3>最近 30 天</h3><ul class="msg-log">${rows || "<li>还没有记录。</li>"}</ul></section><section><h3>连贯事件</h3><ul class="dog-skills">${chains}</ul>${perks ? `<h3>长期加成</h3><ul class="dog-skills">${perks}</ul>` : ""}${buffs ? `<h3>生效中</h3><ul class="msg-log">${buffs}</ul>` : ""}</section></div>`;
}

const TITLES = { daily: "今日抉择", dlog: "抉择记录" };
export function dailyTitle(ui, fallback) {
  return TITLES[ui.view] || farlandsTitle(ui, fallback);
}
export function renderDailyView(e, ui = {}, fallback) {
  if (!e.dy) return renderFarlandsView(e, ui, fallback);
  let body = null;
  if (ui.view === "daily") body = freshResult(e, ui) ? viewResult(e, ui) : viewCard(e);
  else if (ui.view === "dlog") body = viewLog(e);
  if (body === null) return renderFarlandsView(e, ui, fallback);
  return `<div class="outpost-page view-${esc(ui.view)}">${body}</div>`;
}
// 顶栏：生效中的增益
export function dailyHud(e) {
  if (!e.dy) return null;
  const list = buffLines(e);
  if (!list.length) return null;
  return { text: "✦ " + list.length, title: "生效中：" + list.join("；") };
}
// 结果页只给今天这张卡用；换了一天的旧结果不再显示
function freshResult(e, ui) {
  const r = ui.dailyResult,
    p = e.dy?.pending;
  return !!(r && p && p.choice !== null && r.event === p.id && r.choice === p.choice);
}
// 卡还开着（没选）时，菜单不能关；06:00 前自己提前打开的可以先关上
export function dailyLocked(e, ui) {
  return ui.view === "daily" && !!e.dailyCard?.() && e.s.minute >= 360;
}

// “需要处理的事”：卡在等你，但现在不方便弹（打仗、钓鱼、摆建筑）
ALERT_HOOKS.push((e, add) => {
  if (e.dailyCard?.() && e.s.minute >= 360 && !e.dailySafe()) add(0, "今日抉择等你决定", "gold", null);
});

const ACTIONS = ["dView", "dPick", "dStart", "dMark"];
export function handleDailyAction(action, el, ctx) {
  const { engine: e, ui = {}, showMenu, closeMenu, renderMenu, save, toast, rebuildUI } = ctx,
    id = el.dataset.id || "";
  if (e.dy && action === "wAlert") {
    const a = alertItems(e)[Number(id)];
    if (a?.text === "今日抉择等你决定") {
      if (e.dailySafe()) showMenu("outpost", { view: "daily", id: "" });
      else toast("先处理眼前的危险，安全了卡片会自己弹出来。");
      return true;
    }
  }
  if (!ACTIONS.includes(action)) return handleFarlandsAction(action, el, ctx);
  if (!e.dy) return true;
  if (action === "dView") {
    ui.dailyResult = null;
    showMenu("outpost", { view: id, id: "" });
  } else if (action === "dPick") {
    const r = e.chooseDaily(Number(id));
    if (r) ui.dailyResult = r;
    renderMenu();
    save();
  } else if (action === "dStart") {
    ui.dailyResult = null;
    closeMenu();
    save();
  } else if (action === "dMark") {
    const c = e.dy.chains[id];
    if (!c?.mark) return true;
    const target = { region: c.mark.region, x: c.mark.x, y: c.mark.y, label: CHAINS[id].name + " · " + c.mark.label };
    e.guidance.focus = null;
    e.guidance.target = target;
    if (rebuildUI) rebuildUI.target = target;
    if (e.s.region === target.region) {
      closeMenu();
      toast("金色路标：" + target.label + "。");
    } else showMenu("map", { selected: target.region });
  }
  return true;
}

