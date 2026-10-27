// v0.31.0「重光」的界面：重建站（6 面墙、28 份清单、信号烟花、陈工撬铁盒、鼎丰物资）；升降井的检修平台（下到第几层）；
// 档案馆的「旧世界陈列」；任务手记里的残页和年终评定信；成就册的收复度；法令簿里的公司规矩；结局卡换样子；收尾的广播；警报栏。
import { ITEMS, BUILDINGS } from "./data.js";
import { ALERT_HOOKS } from "./winter-ui.js";
import { RESIDENT_HOOKS } from "./people-hooks.js";
import { consequence } from "./alliance-ui.js";
import { WALLS, WALL_IDS, WALL_LISTS, LISTS, LIST_IDS, GROUPS, OLD, OLD_IDS, OLD_GROUPS, OLD_GROUP_IDS, PAGES, PAGE_KINDS, DIGS, TUNNEL, CORES, CORE_IDS, CORE_BONUS, REVIEW, COMPANY, BOX } from "./relight-data.js";
import { OLD_STORY, REVIEW_LETTER, FINALE, COMPANY_ENDING, CO_TEXT, TUNNEL_TEXT } from "./relight-story.js";
import { LAST_FLOOR } from "./tunnel-gen.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const act = (a, id, label, reason, primary = false) => button(a, id, label, reason ? `disabled title="${esc(reason)}"` : primary ? 'class="primary"' : "") + (reason ? `<small class="story-lack">${esc(reason)}</small>` : "");
const name = (id) => ITEMS[id]?.name || id;
const keyName = (k) => (k.startsWith("@") ? GROUPS[k.slice(1)]?.name || k : name(k));
const rewardText = (r) =>
  Object.entries(r || {})
    .map(([k, n]) => (k === "gold" ? n + " 金币" : name(k) + (n > 1 ? " ×" + n : "")))
    .join("、");

// ================= 重建站 =================
function listCard(e, id) {
  const L = LISTS[id],
    done = e.listDone(id),
    p = e.listProgress(id);
  const rows = L.need
    .map(([k, n]) => {
      const got = Math.min(n, e.listGot(id, k)),
        have = e.listHave(k),
        full = got >= n;
      const btn = done || full ? "" : act("rlGive", id + "|" + k, "交", e.rlDeliverReason(id, k), true);
      // v0.32：刚交的那一格闪一下（盖章）
      const st = e._zStamp,
        stamped = st && st.list === id && st.key === k && Date.now() - st.at < 900;
      return `<li class="${full ? "full" : ""}${stamped ? " z-stamped" : ""}"><span>${esc(keyName(k))}</span><small>${got}/${n}${full ? " ✓" : " · 有 " + have}</small>${btn}</li>`;
    })
    .join("");
  return `<article class="rl-list${done ? " done" : ""}"><h4>${esc(L.name)} <small>${p.have}/${p.need}${done ? " ✓" : ""}</small></h4><ul>${rows}</ul>${done ? "" : `<p class="muted">${esc(L.hint)}</p>`}<p class="rl-reward">交满：${esc(rewardText(L.reward))}</p></article>`;
}
function wallBlock(e, w, open) {
  const W = WALLS[w],
    lists = WALL_LISTS[w],
    n = lists.filter((id) => e.listDone(id)).length,
    on = e.rl.walls[w],
    pend = e.rl.co.pending[w];
  const tag = on ? `<span class="rl-tag">${on.by === "co" ? "鼎丰修好了" : "通了"}</span>` : pend ? `<span class="rl-tag warn">车队明早来</span>` : "";
  let buy = "";
  if (e.coSigned() && !on && !pend) buy = `<div class="rl-buy">${act("rlCoBuy", w, "让鼎丰直接修好（" + COMPANY.price[w] + " 金币）", e.coBuyReason(w))}</div>`;
  return `<details class="rl-wall${on ? " done" : ""}"${open ? " open" : ""}><summary><b>${esc(W.name)}</b><small>${n}/${lists.length} 份 · ${esc(W.short)}</small>${tag}</summary><p class="rl-effect">${esc(W.text)}</p>${buy}<div class="rl-lists">${lists.map((id) => listCard(e, id)).join("")}</div></details>`;
}
function fireBlock(e) {
  if (e.rl.fire) return `<p class="rl-fire gold">第 ${e.rl.fire} 天，你在这里放过一次信号烟花。</p>`;
  if (e.rl.done.length < LIST_IDS.length) return "";
  return `<article class="rl-fire current"><h3>信号烟花</h3><p>28 份清单都交满了。傍晚在重建站前放一次：动静一下拉满，但当晚邻居都来帮你守。</p>${act("rlFire", "", "点着信号烟花", e.rlFireReason(), true)}</article>`;
}
function boxLine(e) {
  const n = e.qty("rlIronBox", true);
  if (!n) return "";
  return `<p class="rl-box">锁着的铁盒 ×${n} · 让陈工撬开（零件 ${BOX.cost.parts}）：可能是一件旧物、一块电路或一包种子。${act("rlBox", "", "让陈工撬一个", e.rlBoxReason())}</p>`;
}
function companyBlock(e) {
  const c = e.rl.co;
  if (!e.rlStationB()) return "";
  if (c.state === "torn") return `<p class="rl-co muted">鼎丰物资的合同撕了：交过的 ${c.paid} 金币没退，邻居又肯来了。</p>`;
  if (c.state === "signed") {
    const leave = c.leave ? `<p class="story-lack">${esc(c.leave.name)}说两天后要走（第 ${c.leave.day + COMPANY.leaveDays} 天早上）：走到他跟前按 E 劝劝。</p>` : "";
    return `<article class="rl-co signed"><h3>${esc(COMPANY.name)} · 签着合同</h3><p>每面墙都能付钱让车队第二天修好。已经付了 ${c.paid} 金币；抽走的收成 ${c.cut} 份。</p>${consequence({ cost: CO_TEXT.ruleCost, gain: "不用一样样凑清单", effect: "法令簿里多一条公司规矩；有人会想走；结局换成「公司的余烬地区」" })}${leave}${button("rlCoTear", "", "撕了合同（交过的钱不退）")}</article>`;
  }
  return `<article class="rl-co"><h3>${esc(COMPANY.name)}</h3><p>${esc(CO_TEXT.pitch)}</p>${consequence({ cost: "签约 " + COMPANY.sign + " 金币；每面墙 6000–12000 金币", gain: "付了钱第二天车队就修好那面墙（花钱买的不算交满清单）", effect: "公司规矩（宵禁、收成抽一成）、全营士气 −5、有人会想走、邻居不再来帮守；能中途撕合同" })}${act("rlCoSign", "", "签约（" + COMPANY.sign + " 金币）", e.coReason())}</article>`;
}
function viewStation(e) {
  const done = e.rl.done.length,
    walls = e.wallsOn().length,
    pct = e.rlCompletion().pct;
  const here = e.rlStationHere();
  const firstOpen = WALL_IDS.find((w) => !e.wallOn(w));
  const head = `<header class="rl-head"><p>交满 <b>${done}/${LIST_IDS.length}</b> 份清单 · 通了 <b>${walls}/${WALL_IDS.length}</b> 面墙 · 收复度 ${pct}%</p><p class="muted">每份清单要一组不同来源的东西；作物交普通、优质、上品都行。交满一面墙，余烬地区就恢复一样。${here ? "" : "要站在重建站跟前才交得了。"}</p></header>`;
  return `<div class="outpost-page view-rlStation">${head}${fireBlock(e)}${boxLine(e)}<section class="rl-walls">${WALL_IDS.map((w) => wallBlock(e, w, w === firstOpen)).join("")}</section>${companyBlock(e)}</div>`;
}

// ================= 升降井旁边的检修平台 =================
function viewShaft(e) {
  const t = e.rl.tunnel;
  const floors = e.tunnelFloors();
  const btns = floors.map((f) => act("rlDown", String(f), f === 1 ? "下到第 1 层" : "坐检修电梯到第 " + f + " 层", e.tunnelReason(f), f === Math.max(...floors))).join("");
  const lifts = TUNNEL.lifts.map((f) => (t.lifts.includes(f) ? "第 " + f + " 层 ✓" : "第 " + f + " 层")).join("、");
  return `<div class="outpost-page view-rlShaft"><p>${esc(TUNNEL_TEXT.shaft)}</p><p class="muted">${esc(TUNNEL.gear)}每层找到往下的检修梯才能下；每 5 层有一部检修电梯，修好以后从这里直达；第 10、20 层是没人的物资库；最深第 ${LAST_FLOOR} 层。</p><dl class="summary-grid"><div><dt>下到过</dt><dd>第 ${t.deepest} 层</dd></div><div><dt>检修电梯</dt><dd>${esc(lifts)}</dd></div><div><dt>第 30 层的光</dt><dd>${t.core ? "捧上来了" : "还在下面"}</dd></div></dl><div class="button-row">${btns}</div></div>`;
}

// ================= 年终评定信、收尾广播 =================
function reviewHtml(r) {
  const lamps = `<ol class="rl-lamps" aria-label="亮了 ${r.lamps} 盏灯">${[1, 2, 3, 4].map((i) => `<li class="${i <= r.lamps ? "on" : ""}"></li>`).join("")}</ol>`;
  const rows = REVIEW.items.map((it, i) => `<tr><th>${esc(it.name)}</th><td>${r.v[i]} ${esc(it.unit)}</td><td>${"★".repeat(r.s[i])}${"☆".repeat(3 - r.s[i])}</td></tr>`).join("");
  return `<h3>${esc(REVIEW_LETTER.open.replace("{y}", r.y))}</h3>${lamps}<p>${esc(REVIEW_LETTER.lamps[r.lamps - 1])}</p><div class="g-table"><table><tbody>${rows}</tbody></table></div><p class="muted">八项一共 ${r.s.reduce((a, b) => a + b, 0)} 分（9 分起 2 盏灯，14 分起 3 盏，19 分起 4 盏）。第 ${r.day} 天来的信。</p><p>${esc(REVIEW_LETTER.close)}</p>`;
}
function viewReview(e, ui) {
  const list = e.rl.reviews;
  const r = list.find((x) => String(x.y) === String(ui.id)) || list[list.length - 1];
  if (!r) return `<div class="outpost-page view-rlReview"><p>还没有评定信：每年守夜纪念日（第 28、56、84…天）21:00 联盟终端会来一封。</p></div>`;
  return `<div class="outpost-page view-rlReview">${reviewHtml(r)}</div>`;
}
function viewFinale(e) {
  const F = e.rl.co.state === "signed" ? FINALE.company : FINALE;
  return `<div class="outpost-page view-rlFinale ln-ending"><h3>${esc(F.title)}</h3>${F.lines.map((l) => `<p>${esc(l)}</p>`).join("")}<div class="button-row">${button("oClose", "", "接着过日子", 'class="primary"')}${button("wView", "collection", "看看成就册")}</div></div>`;
}

// ================= 档案馆：旧世界陈列 =================
function oldWorld(e) {
  const here = e.museumHere?.();
  const groups = OLD_GROUP_IDS.map((g) => {
    const G = OLD_GROUPS[g],
      ids = OLD_IDS.filter((id) => OLD[id].group === g),
      n = ids.filter((id) => e.oldDonated(id)).length,
      done = e.rl.groups.includes(g);
    const cells = ids
      .map((id) => {
        if (e.oldDonated(id)) return `<li class="on"><b>${esc(OLD[id].name)}</b><small>${esc(OLD_STORY[id])}</small></li>`;
        if (e.qty(id, true) > 0) return `<li class="have"><b>${esc(OLD[id].name)}</b>${act("rlDonate", id, "捐出", e.donateOldReason(id), true)}</li>`;
        const where = OLD[id].home.region === "tunnel" ? "地铁隧道" : e.regionName?.(OLD[id].home.region) || "";
        return `<li><b>？？</b><small>${esc(where)}</small></li>`;
      })
      .join("");
    return `<article class="rl-group${done ? " done" : ""}"><h4>${esc(G.name)} <small>${n}/${ids.length}${done ? " ✓" : ""}</small></h4><ul class="rl-old">${cells}</ul><p class="rl-reward">凑齐：${esc(G.text)}</p></article>`;
  }).join("");
  const n = e.rl.old.length;
  return `<section class="rl-oldworld"><h3>旧世界陈列 ${n}/${OLD_IDS.length}</h3><p class="muted">「往事」柜扩成了 48 件旧物：柜子里、感染者身上、锁着的铁盒里、残页说的藏货点、地铁隧道里都可能有。每件捐出来，苏砚写一张它主人的故事。凑齐一组给回礼，48 件都捐满得一颗余烬核。${here ? "" : "要在档案馆（农场的分馆或余晖档案岛）才捐得了。"}</p><div class="rl-groups">${groups}</div></section>`;
}
function patchMuseum(e, html) {
  const add = oldWorld(e);
  const at = html.lastIndexOf('<div class="button-row">');
  return at >= 0 ? html.slice(0, at) + add + html.slice(at) : html + add;
}

// ================= 任务手记：一行概况、残页、评定信 =================
function strip(e) {
  const pct = e.rlCompletion().pct;
  const t = e.rl.tunnel;
  // v0.32：还没碰到的（0 件旧物、0 张残页、0 颗余烬核、0%）先不列，免得第一天就是一串 0
  const bits = [
    e.rlStationB() ? "重建清单 " + e.rl.done.length + "/" + LIST_IDS.length : "重建站还没建（农场空地上自己选地方）",
    e.rl.old.length ? "旧物 " + e.rl.old.length + "/" + OLD_IDS.length : "",
    e.rl.pages.length ? "残页 " + e.rl.pages.length + "/24" : "",
    t.deepest ? "地铁隧道第 " + t.deepest + " 层" : "",
    e.rl.cores.length ? "余烬核 " + e.rl.cores.length + "/" + CORE_IDS.length : "",
    pct ? "收复度 " + pct + "%" : "",
  ].filter(Boolean);
  return `<section class="far-strip rl-strip" aria-label="重光"><p>${esc(bits.join(" · "))}</p><div class="outpost-links">${button("sView", "rlStation", "重建清单")}${button("wView", "collection", "收复度")}</div></section>`;
}
function pagesBlock(e) {
  const list = e.rl.pages;
  if (!list.length) return "";
  const items = [...list]
    .reverse()
    .map((id) => {
      const p = PAGES[id];
      let tail = "";
      if (p.kind === "riddle") tail = `<small class="${e.rl.dug.includes(p.dig) ? "muted" : "gold"}">${e.rl.dug.includes(p.dig) ? "挖过了" : "还没挖：到" + esc(e.regionName?.(DIGS[p.dig].region) || "") + "照着找，按 E 挖"}</small>`;
      return `<article class="rl-page ${p.kind}"><small>${esc(PAGE_KINDS[p.kind])}</small><b>${esc(e.pageTitle(id))}</b>${e
        .pageLines(id)
        .map((l) => `<p>${esc(l)}</p>`)
        .join("")}${tail}</article>`;
    })
    .join("");
  return `<details class="journal-extra rl-pages"><summary>残页 ${list.length}/24</summary>${items}</details>`;
}
function reviewsBlock(e) {
  const list = e.rl.reviews;
  if (!list.length) return "";
  const items = [...list]
    .reverse()
    .map((r) => `<article class="story-letter rl-letter"><b>${esc(REVIEW_LETTER.open.replace("{y}", r.y))}</b><p>${esc(REVIEW_LETTER.lamps[r.lamps - 1])}</p>${button("rlReview", String(r.y), "看评定信")}</article>`)
    .join("");
  return `<details class="journal-extra rl-reviews"><summary>年终评定信 · ${list.length} 封</summary>${items}</details>`;
}
export function patchRelightJournal(e, html) {
  if (!e?.rl) return html;
  const s = strip(e);
  let out = html;
  let placed = false;
  for (const mark of ['<section class="far-strip ln-strip"', '<section class="far-strip u-strip"', '<section class="far-strip"', '<section class="journal-today"']) {
    const at = out.indexOf(mark);
    if (at >= 0) {
      const end = out.indexOf("</section>", at) + "</section>".length;
      out = out.slice(0, end) + s + out.slice(end);
      placed = true;
      break;
    }
  }
  if (!placed) {
    const at = out.indexOf("</header>");
    out = at > 0 ? out.slice(0, at + 9) + s + out.slice(at + 9) : out + s;
  }
  const extra = reviewsBlock(e) + pagesBlock(e);
  if (!extra) return out;
  const at = out.indexOf('<details class="journal-extra story-letters">');
  if (at >= 0) return out.slice(0, at) + extra + out.slice(at);
  const end = out.lastIndexOf("</div>");
  return end >= 0 ? out.slice(0, end) + extra + out.slice(end) : out + extra;
}

// ================= 成就册：收复度 =================
function collectionRows(e) {
  const c = e.rlCompletion();
  const row = (label, have, need, small) => `<li class="${have >= need ? "done" : ""}"><b>${esc(label)}</b><span class="bar"><i style="width:${Math.min(100, (have / Math.max(1, need)) * 100)}%"></i></span><span>${Math.min(have, need)}/${need}</span><small>${esc(small)}</small></li>`;
  const parts = c.parts.map((p) => row(p.name, p.have, p.max, p.id === "cores" ? "每颗体力上限 +" + CORE_BONUS.sta + "、生命上限 +" + CORE_BONUS.hp : p.id === "tunnel" ? "最深下到过的那一层" : "")).join("");
  return `<li class="rl-pct${c.pct >= 100 ? " done" : ""}"><b>收复度</b><span class="bar"><i style="width:${Math.min(100, c.pct)}%"></i></span><span>${c.pct}%</span><small>${c.pct >= 100 ? "✓ 余烬地区重光了" : "下面这些清单合在一起"}</small></li>${parts}`;
}
function coresBlock(e) {
  const rows = CORE_IDS.map((id) => {
    const has = e.rl.cores.includes(id);
    return `<li class="${has ? "on" : ""}"><b>${has ? esc(CORES[id].name) : "？？"}</b><small>${has ? "第 " + e.rl.coreDay[id] + " 天" : esc(CORES[id].how)}</small></li>`;
  }).join("");
  return `<section class="rl-cores"><h3>余烬核 ${e.rl.cores.length}/${CORE_IDS.length}</h3><p class="muted">游戏名字里那点没灭的火。每颗体力上限 +${CORE_BONUS.sta}、生命上限 +${CORE_BONUS.hp}；它的光夜里也招感染者，身上每有一颗，长夜每波多来 ${Math.round(CORE_BONUS.night * 100)}%。纪念石上多一道刻痕。现在：体力上限 ${e.maxSta()}、生命上限 ${e.maxHp()}。</p><ul>${rows}</ul></section>`;
}
function patchCollection(e, html) {
  const at = html.indexOf('<ul class="collection">');
  let out = at >= 0 ? html.slice(0, at + '<ul class="collection">'.length) + collectionRows(e) + html.slice(at + '<ul class="collection">'.length) : html;
  const end = out.lastIndexOf("</div>");
  return end >= 0 ? out.slice(0, end) + coresBlock(e) + out.slice(end) : out + coresBlock(e);
}

// ================= 法令簿：公司规矩 =================
function patchDecrees(e, html) {
  if (!e.coSigned()) return html;
  const card = `<article class="current rl-rule"><small>鼎丰物资 · 签着合同时一直有效</small><h3>${esc(CO_TEXT.rule)}</h3>${consequence({ cost: CO_TEXT.ruleCost, gain: CO_TEXT.ruleGood, effect: "撕了合同才取消" })}<small class="story-lack">不能自己关掉</small></article>`;
  const mark = '<div class="story-choice decree-grid">';
  const at = html.indexOf(mark);
  return at >= 0 ? html.slice(0, at + mark.length) + card + html.slice(at + mark.length) : html + card;
}

// ================= 结局卡：签着鼎丰的合同时换一张 =================
function patchEnding(e, html) {
  if (!e.coSigned()) return html;
  const E = COMPANY_ENDING;
  return html.replace(/<h3>[^<]*<\/h3>((?:<p>[^<]*<\/p>)+)/, `<h3>${esc(E.title)}</h3>${E.lines.map((l) => `<p>${esc(l)}</p>`).join("")}`);
}

// ================= 前哨广场：纪念石 =================
function patchPlaza(e, html) {
  const r = e.lastReview();
  const notches = e.rl.cores.length;
  if (!r && !notches) return html;
  const line = `<p class="rl-stone">纪念石：${r ? "第 " + r.y + " 年的评定亮了 " + r.lamps + " 盏灯" : "还没评定过"}${notches ? "；石头侧面有 " + notches + " 道刻痕（余烬核）" : ""}。</p>`;
  return html.replace(/(<div class="outpost-page[^"]*">)/, "$1" + line);
}

// ================= 页面补丁（套在人情那一层外面） =================
export function renderRelightView(e, ui, base) {
  if (!e?.rl || !ui) return base(e, ui);
  if (ui.view === "rlStation") return viewStation(e);
  if (ui.view === "rlShaft") return viewShaft(e);
  if (ui.view === "rlReview") return viewReview(e, ui);
  if (ui.view === "rlFinale") return viewFinale(e);
  const html = base(e, ui);
  if (ui.view === "museum") return patchMuseum(e, html);
  if (ui.view === "collection") return patchCollection(e, html);
  if (ui.view === "decrees") return patchDecrees(e, html);
  if (ui.view === "lnEnd") return patchEnding(e, html);
  if (ui.view === "plaza") return patchPlaza(e, html);
  return html;
}
const TITLES = { rlStation: "重建站", rlShaft: "检修平台", rlReview: "年终评定", rlFinale: "重光" };
export function relightTitle(ui, fallback) {
  return TITLES[ui?.view] || fallback(ui);
}

// ================= 居民卡：陈工撬铁盒 =================
RESIDENT_HOOKS.push((e, r) => {
  if (!e?.rl || r?.id !== "mechanic") return "";
  const n = e.qty("rlIronBox", true);
  if (!n) return "";
  return `<div class="rl-box"><p>陈工：“铁盒？拿来我看看。”（锁着的铁盒 ×${n}）</p><div class="button-row">${act("rlBox", "", "让陈工撬一个（零件 " + BOX.cost.parts + "）", e.rlBoxReason())}</div></div>`;
});

// ================= 警报栏 =================
ALERT_HOOKS.push((e, add) => {
  if (!e?.rl) return;
  const sb = e.s.buildings.find((b) => b.type === "rlStation");
  if (sb && sb.hp < (BUILDINGS.rlStation?.hp || 160) * 0.7) add(4, "重建站被打坏了：走到跟前按 E 修", "warn", { region: "farm", x: sb.x, y: sb.y + 40, label: "重建站" });
  const c = e.rl.co;
  if (c.leave) {
    const w = e.whereNow?.(c.leave.id);
    add(6, c.leave.name + "说两天后要走：走到他跟前按 E 劝劝", "warn", w && !w.away ? { region: w.region, x: w.x, y: w.y, label: c.leave.name } : null);
  }
  if (e.rl.done.length >= LIST_IDS.length && !e.rl.fire && !e.coSigned()) add(9, "28 份清单都交满了：傍晚到重建站放一次信号烟花", "gold", null);
  const n = e.qty("rlIronBox", true);
  if (n && e.resident?.("mechanic")) add(12, "锁着的铁盒 ×" + n + "：回营地让陈工撬开", "normal", null);
  const r = e.lastReview();
  if (r && r.day === e.s.day) add(5, "联盟终端：第 " + r.y + " 年的评定信（纪念石亮了 " + r.lamps + " 盏灯）", "gold", null);
  for (const id of Object.keys(DIGS)) {
    if (!e.rlDigOpen(id)) continue;
    add(14, "残页说的藏货点：去" + (e.regionName?.(DIGS[id].region) || "") + "照着找", "normal", null);
    break;
  }
});

// ================= 动作 =================
const ACTIONS = ["rlGive", "rlFire", "rlBox", "rlDonate", "rlDown", "rlCoSign", "rlCoBuy", "rlCoTear", "rlReview"];
export function handleRelightAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, showMenu, closeMenu, renderMenu, save } = ctx,
    id = el?.dataset?.id || "";
  if (!e?.rl) return true;
  const stay = (ok) => {
    if (ok) save();
    renderMenu();
  };
  if (action === "rlGive") {
    const [list, key] = id.split("|");
    stay(e.rlDeliver(list, key));
  } else if (action === "rlFire") {
    const ok = e.rlFireworks();
    if (ok) {
      save();
      closeMenu();
    } else renderMenu();
  } else if (action === "rlBox") stay(e.rlOpenBox());
  else if (action === "rlDonate") stay(e.donateOld(id));
  else if (action === "rlDown") {
    const ok = e.tunnelEnter(Number(id) || 1);
    if (ok) {
      save();
      closeMenu();
    } else renderMenu();
  } else if (action === "rlCoSign") stay(e.coSign());
  else if (action === "rlCoBuy") stay(e.coBuy(id));
  else if (action === "rlCoTear") stay(e.coTear());
  else if (action === "rlReview") showMenu("outpost", { view: "rlReview", id });
  return true;
}
