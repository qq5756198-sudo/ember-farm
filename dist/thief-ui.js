// v0.19.0「妙手」的界面：技能页（K）的技能树、下手前的预览、下手小游戏、被抓后的三选一、
// 任务手记里的“妙手”条与妙手手记页、每日抉择里新动作的说明。
import { ITEMS, SKILLS } from "./data.js";
import { SPECS } from "./expansion-data.js";
import { ALERT_HOOKS, alertItems } from "./winter-ui.js";
import { renderDailyJournal, dailyTitle, renderDailyView, handleDailyAction, dailyLocked, PREVIEW_HOOKS } from "./daily-ui.js";
import { SKILL_NAMES, SKILL_ORDER, TALENTS, TALENT_IDS, TIERS, TARGETS, TREASURES, TREASURE_IDS, JOBS, MANUALS, MANUAL_IDS, JUNK_TRADE, RESPEC_COST, THIEF_XP_PER_LEVEL } from "./thief-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const dis = (reason) => (reason ? `disabled title="${esc(reason)}"` : "");
const pct = (v) => Math.round(v * 100) + "%";
const XP_PER = { agriculture: 40, manufacturing: 40, exploration: 40, combat: 40, thief: THIEF_XP_PER_LEVEL };

// ================= 技能页 =================
function xpOf(e, skill) {
  return skill === "thief" ? e.sk.thiefXp : e.s.xp[skill] || 0;
}
function skillCard(e, skill) {
  const L = e.level(skill),
    xp = xpOf(e, skill),
    per = XP_PER[skill],
    into = L >= 5 ? per : xp - (L - 1) * per;
  const desc = skill === "thief" ? "只能靠偷来涨：偷成按东西的档给经验，失手也有 1 点；稻草人只能练到 2 级。" : SKILLS[skill]?.desc || "";
  const spec =
    skill !== "thief" && SPECS[skill]
      ? `<div class="skill-spec"><b>专精 · 3 级起二选一，不花点</b>${SPECS[skill]
          .map((o) => `<div class="skill-spec-row"><span>${esc(o.name)}<small>${esc(o.desc)}</small></span><button data-action="chooseSpec" data-id="${skill}" data-spec="${o.id}" ${L < 3 || e.c.specializations[skill] ? "disabled" : ""}>${e.c.specializations[skill] === o.id ? "当前专精" : "选择"}</button></div>`)
          .join("")}${e.c.specializations[skill] ? `<button data-action="resetSpec" data-id="${skill}" ${e.s.money < 60 ? "disabled" : ""}>重选专精 · 60 金币</button>` : ""}</div>`
      : "";
  const talents = TALENT_IDS.filter((id) => TALENTS[id].skill === skill)
    .map((id) => {
      const t = TALENTS[id],
        owned = e.hasTalent(id),
        why = owned ? "" : e.talentReason(id);
      return `<li class="talent${owned ? " owned" : ""}${!owned && why ? " locked" : ""}"><div class="talent-top"><b>${esc(t.name)}</b><span class="talent-meta">Lv.${t.gate} · ${t.cost} 点</span>${owned ? `<span class="talent-done">已学会</span>` : button("kLearn", id, "学会", dis(why))}</div><p>${esc(t.text)}</p>${!owned && why ? `<small>${esc(why)}</small>` : ""}</li>`;
    })
    .join("");
  return `<article class="skill-col skill-${skill}"><header><h3>${esc(SKILL_NAMES[skill])}<span>Lv.${L}</span></h3><div class="skill-xp" role="img" aria-label="经验 ${xp}"><i style="width:${Math.round((Math.min(per, into) / per) * 100)}%"></i></div><small>${L >= 5 ? "已满级 · 经验 " + xp : "经验 " + xp + " · 下一级还差 " + (L * per - xp)}</small><p class="skill-desc">${esc(desc)}</p></header><div class="skill-body">${spec}<ul class="talents">${talents}</ul></div></article>`;
}
export function renderSkillPage(e) {
  if (!e.sk) return "";
  const p = e.skillPoints(),
    why = e.respecReason();
  return `<div class="skill-page"><div class="skill-head"><p><b class="skill-points">可用技能点 ${Math.max(0, p.free)}</b>任何一项技能升一级 +1，每完成一段主线 +1（现在一共拿到 ${p.earned} 点，用掉 ${p.spent} 点）。全部天赋要 48 点，一局最多 28 点，得有取舍。</p><span class="respec">${button("kRespec", "", "重新分配 · " + RESPEC_COST + " 金币", dis(why))}${why ? `<small>${esc(why)}</small>` : ""}</span></div><div class="tree-grid">${SKILL_ORDER.map((k) => skillCard(e, k)).join("")}</div><p class="note">种地、清理、收获涨农业；建造、加工涨制造；搜集、救援涨探索；打感染者涨战斗；偷东西涨妙手。</p></div>`;
}

// ================= 下手前 =================
function dots(n) {
  return n ? `<span class="sus-dots" aria-label="怀疑 ${n}">${"<i></i>".repeat(n)}</span>` : "";
}
function slotTag(slot) {
  return `<span class="tier-tag tier-${slot.tier}">${esc(TIERS[slot.tier].name)}</span>`;
}
function slotLine(e, slot, i, shown) {
  if (!shown) return `<li class="pocket unknown"><span class="pocket-no">${i + 1}</span><span>？ 看不清</span></li>`;
  const why = e.slotReason(slot);
  return `<li class="pocket tier-${slot.tier}${why ? " locked" : ""}"><span class="pocket-no">${i + 1}</span>${slotTag(slot)}<span>${esc(e.slotLabel(slot))}</span>${why ? `<small>${esc(why)}</small>` : ""}</li>`;
}
function viewPrep(e, ui) {
  const tid = ui.id,
    ob = e.findTarget(tid);
  const t = ob ? e.targetOf(ob) : null;
  if (!t) return `<p>他已经走开了。</p>`;
  const def = t.def,
    see = e.hasTalent("seeThrough"),
    odds = e.stealOdds(tid, ob, { distract: !!ui.distract, def }),
    slots = e.pockets(tid, def),
    why = e.stealReason(tid),
    sus = e.th.sus[tid] || 0;
  const tierOdds = ["normal", "important", "treasure"].map((k) => `<span class="odds-chip tier-${k}"><b>${esc(TIERS[k].name)}</b>${see ? odds.byTier[k] + "%" : e.oddsWord(odds.byTier[k])}</span>`).join("");
  const sign = (v) => (see ? (v > 0 ? "+" + v : v < 0 ? "−" + Math.abs(v) : "±0") : v >= 20 ? "↑↑" : v > 0 ? "↑" : v <= -20 ? "↓↓" : v < 0 ? "↓" : "—");
  const parts = odds.parts.map(([label, v]) => `<li><span>${esc(label)}</span><b class="${v > 0 ? "plus" : v < 0 ? "minus" : ""}">${sign(v)}</b></li>`).join("");
  const dWhy = e.distractReason();
  const distract = e.hasTalent("distract") ? `<div class="prep-extra">${button("kDistract", tid, ui.distract ? "✓ 声东击西（再点取消）" : "声东击西：" + (e.fr?.dog?.rescued && (e.fr.dog.bond || 0) >= 6 ? "叫麦穗去捣乱" : "扔一块石头"), dis(ui.distract ? "" : dWhy))}</div>` : "";
  const plants = e.hasTalent("plant")
    ? `<div class="prep-extra"><b>反手塞物</b>${e
        .plantOptions(tid)
        .map((o) => button("kPlant", tid + "|" + o.id, o.label, dis(why) + ` title="${esc(o.text)}"`))
        .join("") || "<small>身上没有能塞的东西</small>"}</div>`
    : "";
  const facing = { behind: "你在他背后", side: "你在他侧面", front: "你在他正面" }[e.facing(ob)];
  return `<div class="steal-prep"><header class="steal-head"><div><small>${esc(def.title || "")}</small><h3>${esc(def.name)}${dots(sus)}</h3><p>${esc(facing)} · ${odds.sleeping ? "他睡着了" : e.busy(def) ? "他在忙" : "他闲着"} · ${["迟钝", "一般", "机警"][def.alert || 0]}</p></div></header><section class="steal-odds"><p><b>没被察觉的机会</b>${tierOdds}</p><ul class="odds-parts">${parts}</ul>${see ? "" : `<small>学会「看穿」后显示确切的数。</small>`}</section><section><p><b>口袋</b>${see ? "" : "（学会「看穿」才看得到全部）"}</p><ul class="pockets">${slots.map((s, i) => slotLine(e, s, i, see || i === 0 || s.tier === "treasure")).join("")}</ul></section>${distract}${plants}${why ? `<p class="story-lack">${esc(why)}</p>` : ""}<div class="button-row">${button("kGo", tid, "下手", (why ? dis(why) + " " : "") + 'class="primary" data-hotkey="1"')}${button("close", "", "算了")}</div></div>`;
}

// ================= 小游戏 =================
function pocketButton(e, st, slot, i) {
  const see = e.hasTalent("seeThrough") || st.practice || i === 0 || slot.tier === "treasure" || slot.done || slot.lost || st.cur === i;
  const state = slot.done ? "✓ " : slot.lost ? "✗ " : "";
  const label = see ? state + (st.practice ? ITEMS[slot.item]?.name || "零碎" : e.slotLabel(slot)) : "？ 口袋";
  const why = slot.done ? "已经拿到" : slot.lost ? "再也没机会了" : st.phase !== "pick" ? "先把手上这件摸出来" : "";
  return `<button class="pocket-btn tier-${see ? slot.tier : "unknown"}${st.cur === i ? " current" : ""}" data-action="kPick" data-id="${i}" data-hotkey="${i + 1}" ${slot.done || slot.lost || st.phase !== "pick" ? "disabled" : ""} title="${esc(why)}"><span class="pocket-no">${i + 1}</span>${see ? slotTag(slot) : ""}<span>${esc(label)}</span></button>`;
}
function viewSteal(e, ui) {
  const st = e.steal;
  if (!st) return `<p>手已经收回来了。</p><div class="button-row">${button("kOk", "", "好")}</div>`;
  if (st.phase === "done" || st.phase === "caught") {
    const caught = st.phase === "caught";
    return `<div class="steal-result ${caught ? "lost" : st.result?.win ? "won" : ""}"><h3>${caught ? "被发现了" : st.practice ? (st.result?.win ? "练了一回" : "铃铛响了") : !st.result?.win ? "脱身了" : st.taken.length ? "得手了" : "收手"}</h3><ul class="daily-lines">${(st.result?.lines || []).map((l) => `<li>${esc(l)}</li>`).join("")}</ul><div class="button-row">${caught && e.th.pending ? button("kFace", "", "面对他", 'class="primary" data-hotkey="1"') : button("kOk", "", "好", 'class="primary" data-hotkey="1"')}</div></div>`;
  }
  const swing = st.phase === "swing";
  const bar = `<div class="swing ${swing ? "" : "idle"}"><div class="swing-bar"><i id="st-zone" class="zone${swing && st.slots[st.cur]?.tier === "treasure" ? " slide" : ""}" style="left:${pct(st.zone.a)};width:${pct(st.zone.w)}"></i><i id="st-marker" class="marker" style="left:${pct(st.marker)}"></i></div><small>${swing ? "标记进到绿色安全区时按“抽”（空格 / E）" : "选一格口袋（点它，或按数字键）"}</small></div>`;
  return `<div class="steal-game"><div class="attention"><span>${esc(st.name)}的注意力</span><div class="attn-bar"><i id="st-attn" style="width:${pct(st.attention)}"></i></div><b id="st-attn-text">${pct(st.attention)}</b></div><div class="pocket-grid">${st.slots.map((s, i) => pocketButton(e, st, s, i)).join("")}</div>${bar}<div class="button-row steal-buttons">${button("kStop", "", "收手 · Esc")}${button("kTake", "", "抽 · 空格", 'class="primary"' + (swing ? "" : " disabled"))}</div><ul class="steal-log">${st.lines
    .slice(-3)
    .map((l) => `<li>${esc(l)}</li>`)
    .join("")}</ul></div>`;
}
// 每一帧：涨注意力、摆标记，只改这几处的样式
export function thiefFrame(e, ui, dt, root) {
  if (ui.view !== "steal" || !e.steal || !["pick", "swing"].includes(e.steal.phase)) return "";
  if (e.stealTick(dt)) return "render";
  const st = e.steal,
    q = (s) => root?.querySelector?.(s);
  const attn = q("#st-attn"),
    text = q("#st-attn-text"),
    marker = q("#st-marker"),
    zone = q("#st-zone");
  if (attn) attn.style.width = pct(st.attention);
  if (text) text.textContent = pct(st.attention);
  if (marker) marker.style.left = pct(st.marker);
  if (zone) zone.style.left = pct(st.zone.a);
  return "";
}

// ================= 被抓之后 =================
function viewCaught(e, ui) {
  const p = e.th.pending;
  if (!p) {
    const r = ui.caughtResult;
    return `<div class="steal-result"><ul class="daily-lines">${(r?.lines || ["事情过去了。"]).map((l) => `<li>${esc(l)}</li>`).join("")}</ul><div class="button-row">${button("kOk", "", "好", 'class="primary" data-hotkey="1"')}</div></div>`;
  }
  const L = e.level("thief");
  const opts = [
    ["赔笑道歉", "东西还回去，再赔 20 金币。声望扣的 1 点补回来，信任也回来一点。"],
    ["装糊涂", "成功机会 " + L * 10 + "%（妙手等级 × 10%）。成了什么事也没有；不成怀疑 +1、声望 −2。"],
    ["拔腿就跑", "直接跑回农场。怀疑 +1、声望 −2，他会告诉别人。"],
  ];
  return `<div class="daily-card caught-card locked"><header class="daily-head"><div><small>第 ${e.s.day} 天 · 被发现了</small><h3>${esc(p.name)}抓住了你的手</h3></div></header><p class="daily-text">${esc(p.reason)}。现在怎么办？</p><div class="daily-opts">${opts
    .map(([label, text], i) => {
      const why = e.pendingChoiceReason(i);
      return `<article class="daily-opt${why ? " locked" : ""}"><h4><kbd>${i + 1}</kbd>${esc(label)}</h4><dl><div><dt>结果</dt><dd>${esc(text)}</dd></div></dl>${button("kCaught", i, "就这么办", (why ? dis(why) + " " : "") + `data-hotkey="${i + 1}"`)}${why ? `<small class="story-lack">${esc(why)}</small>` : ""}</article>`;
    })
    .join("")}</div><p class="daily-stock">已经扣掉：声望 −1，${esc(p.name)}对你的怀疑 +1，两天内不能再对他下手。</p></div>`;
}

// ================= 妙手手记 =================
function viewBook(e, ui) {
  const th = e.th,
    L = e.level("thief");
  const known = TREASURE_IDS.filter((id) => th.treasures[id] === "known");
  const rows = (list, fn) => list.map(fn).join("") || "<li>还没有。</li>";
  const tr = rows(known, (id) => {
    const who = TARGETS[TREASURES[id].owner],
      w = th.where[TREASURES[id].owner];
    return `<li><b>${esc(TREASURES[id].name)}</b><small>${esc(who.name)}${who.boxOnly ? "的钱箱" : "身上"} · ${esc(TREASURES[id].text)}</small>${w ? button("kMark", id, "标出位置") : ""}</li>`;
  });
  const done = TREASURE_IDS.filter((id) => ["taken", "given", "lost", "returned"].includes(th.treasures[id]));
  const doneRows = rows(done, (id) => `<li class="${["taken", "given"].includes(th.treasures[id]) ? "on" : ""}"><b>${esc(TREASURES[id].name)}</b><small>${{ taken: "偷到了", given: "送给你了", lost: "失手，再也没机会了", returned: "已经还回去了" }[th.treasures[id]]}</small></li>`);
  const sus = Object.entries(th.sus).filter(([, n]) => n > 0);
  const susRows = rows(sus, ([id, n]) => `<li><b>${esc(e.targetName(id))}</b>${dots(n)}<small>${n >= 3 ? "看见你就护住口袋" : "7 天不被抓就消一点"}</small></li>`);
  const hot = e.hotItems(),
    fences = e.fences().filter((f) => f.open);
  const hotRows = rows(hot, (h) => `<li><b>${esc(ITEMS[h.id]?.name || h.id)} ×${h.n}</b><small>第 ${h.until} 天后标记消失 · 销赃能拿 ${e.fencePrice(h.id, h.n)} 金币</small>${fences.map((f) => button("kFence", h.id + "|" + f.id, "卖给" + f.name.split("（")[0])).join("")}</li>`);
  const manuals = MANUAL_IDS.filter((id) => e.stockOf(id) > 0);
  const people = e.jobCandidates();
  const manualRows = manuals
    .map((id) => `<li><b>${esc(ITEMS[id].name)}</b><small>${esc(JOBS[MANUALS[id].job].name)}：${esc(JOBS[MANUALS[id].job].text)}</small><div class="button-row">${people.map((p) => button("kJob", id + "|" + p.id, "交给" + p.name)).join("") || "<small>营地里没有空着的人</small>"}</div></li>`)
    .join("");
  const jobs = Object.entries(e.sk.jobs)
    .filter(([job]) => e.jobHolder(job))
    .map(([job, id]) => `<li class="on"><b>${esc(JOBS[job].name)}</b><small>${esc(e.personName(id))} · ${esc(JOBS[job].text)}</small></li>`)
    .join("");
  const amends = e.amends();
  const amendRows = amends.map((a) => `<li><b>${esc(a.text)}</b>${button("kAmends", a.id, a.label)}</li>`).join("");
  const jWhy = e.junkTradeReason(),
    dWhy = e.donateReason();
  return `<div class="thief-book"><p>妙手 Lv.${L} · 经验 ${e.sk.thiefXp}${L < 5 ? "（下一级还差 " + (L * THIEF_XP_PER_LEVEL - e.sk.thiefXp) + "）" : ""} · 下手 ${th.stats.tries} 次，得手 ${th.stats.wins} 次，被抓 ${th.stats.caught} 次。</p><div class="log-columns"><section><h3>传闻里的宝贝</h3><ul class="dog-skills">${tr}</ul><h3>宝贝的下落</h3><ul class="dog-skills">${doneRows}</ul><h3>谁在怀疑你</h3><ul class="dog-skills">${susRows}</ul></section><section><h3>赃物</h3><p class="muted">赃物自己用没问题；有标记的不能放进出货箱，林姨、老周也不收。${fences.length ? "" : "现在没有收赃的人：唐九的商队在农场时，或者学会「销赃门路」后的晚上 18:00–23:00。"}</p><ul class="dog-skills">${hotRows}</ul><h3>垃圾 · ${e.junkCount()} 件</h3><div class="button-row">${button("kJunk", "", JUNK_TRADE + " 件换 1 个零件（陈工）", dis(jWhy))}${button("kDonate", "", "凑一套捐给档案馆", dis(dWhy))}</div>${jWhy || dWhy ? `<small class="muted">${esc([jWhy, dWhy].filter(Boolean).join("；"))}</small>` : ""}${manualRows || jobs ? `<h3>职业</h3><ul class="dog-skills">${manualRows}${jobs}</ul>` : ""}${amendRows ? `<h3>补救</h3><ul class="dog-skills">${amendRows}</ul>` : ""}</section></div></div>`;
}

// ================= 任务手记里的“妙手”条 =================
function thiefStrip(e) {
  if (!e.sk) return "";
  const th = e.th,
    p = e.skillPoints(),
    unlocked = e.hasTalent("pickpocket");
  if (!unlocked && p.free <= 0) return "";
  const rows = [];
  if (p.free > 0) rows.push(`<p><b>技能点</b>还有 ${p.free} 点没用。</p><button data-menu="skills">打开技能页（K）</button>`);
  if (unlocked) {
    const today = Object.entries(th.tried).filter(([, d]) => d === e.s.day).length;
    const known = TREASURE_IDS.filter((id) => th.treasures[id] === "known").length;
    rows.push(`<p><b>妙手 Lv.${e.level("thief")}</b>今天下手 ${today} 次 · 听说了 ${known} 件宝贝${e.hotItems().length ? " · 身上有赃物" : ""}。蹲着（V / 蹲行键）靠近一个人按 E 下手。</p>${button("kView", "thief", "妙手手记")}`);
  }
  if (th.pending) rows.push(`<p><b>被抓的事</b>${esc(th.pending.name)}还等着你给个说法。</p>${button("kFace", "", "了结")}`);
  const amends = e.amends();
  if (amends.length) rows.push(`<p><b>补救</b>${esc(amends.map((a) => a.text).join("；"))}</p>${button("kView", "thief", "去赔礼")}`);
  return `<section class="thief-strip" aria-label="妙手">${rows.map((r) => `<div class="far-row">${r}</div>`).join("")}</section>`;
}
export function renderThiefJournal(e, ui = {}) {
  const html = renderDailyJournal(e, ui);
  if (ui.catalog || !e.sk) return html;
  const strip = thiefStrip(e);
  if (!strip) return html;
  for (const mark of ['<section class="daily-strip"', '<section class="far-strip"', '<section class="seasons-strip"', '<section class="winter-strip"', '<section class="outpost-strip"']) {
    const at = html.indexOf(mark);
    if (at >= 0) return html.slice(0, at) + strip + html.slice(at);
  }
  return html;
}

const TITLES = { stealPrep: "下手之前", steal: "下手", caught: "被发现了", thief: "妙手手记" };
export function thiefTitle(ui, fallback) {
  return TITLES[ui.view] || dailyTitle(ui, fallback);
}
export function renderThiefView(e, ui = {}, fallback) {
  if (!e.sk) return renderDailyView(e, ui, fallback);
  let body = null;
  if (ui.view === "stealPrep") body = viewPrep(e, ui);
  else if (ui.view === "steal") body = viewSteal(e, ui);
  else if (ui.view === "caught") body = viewCaught(e, ui);
  else if (ui.view === "thief") body = viewBook(e, ui);
  if (body === null) return renderDailyView(e, ui, fallback);
  return `<div class="outpost-page view-${esc(ui.view)}">${body}</div>`;
}

// 关菜单时：小游戏里按 Esc = 收手；被抓的三选一没选完不能关
export function menuLock(e, ui) {
  if (e.sk && ui.view === "steal" && e.steal) {
    if (["pick", "swing"].includes(e.steal.phase)) {
      e.stealStop();
      return "render";
    }
    if (e.th.pending) {
      ui.view = "caught";
      ui.caughtResult = null;
      return "render";
    }
    e.steal = null;
  }
  if (e.sk && ui.view === "caught" && e.th.pending) return "先决定怎么面对他。";
  if (dailyLocked(e, ui)) return "先选一个，再开始新的一天。";
  return "";
}
// 小游戏里：空格或交互键 = 抽
export function menuKey(e, ui, key) {
  if (!e.sk || ui.view !== "steal" || !e.steal) return "";
  if (key === " " || key === "e") {
    if (e.steal.phase === "swing") {
      e.stealPress();
      return "render";
    }
    return "handled";
  }
  return "";
}

// 每日抉择里新动作的说明
PREVIEW_HOOKS.push((e, op) => {
  const [kind, a] = op;
  if (kind === "rumor") return "听到一件宝贝在谁身上";
  if (kind === "thiefXp") return "妙手经验 +" + a;
  if (kind === "confess") return "认下这事：他对你的怀疑 +1，营地士气 +2";
  if (kind === "clearCase") return "这事不了了之";
  if (kind === "blame") return "营地士气 −8";
  if (kind === "giveTreasure") return "阿豆把「" + (TREASURES[a]?.name || "宝贝") + "」送给你";
  return "";
});
// “需要处理的事”：被抓了还没了结
ALERT_HOOKS.push((e, add) => {
  if (e.th?.pending) add(0, "被抓的事等你了结", "gold", null);
});

const ACTIONS = ["kLearn", "kRespec", "kView", "kGo", "kDistract", "kPick", "kTake", "kStop", "kOk", "kFace", "kCaught", "kPlant", "kFence", "kJunk", "kDonate", "kJob", "kAmends", "kMark"];
export function handleThiefAction(action, el, ctx) {
  const { engine: e, ui = {}, showMenu, closeMenu, renderMenu, save, toast, rebuildUI } = ctx,
    id = el.dataset.id || "";
  if (e.sk && action === "wAlert" && alertItems(e)[Number(id)]?.text === "被抓的事等你了结") {
    showMenu("outpost", { view: "caught", id: "" });
    return true;
  }
  if (!ACTIONS.includes(action)) return handleDailyAction(action, el, ctx);
  if (!e.sk) return true;
  switch (action) {
    case "kLearn":
      e.learnTalent(id);
      renderMenu();
      save();
      break;
    case "kRespec":
      e.respec();
      renderMenu();
      save();
      break;
    case "kView":
      ui.distract = false;
      showMenu("outpost", { view: id, id: "" });
      break;
    case "kDistract":
      ui.distract = !ui.distract;
      renderMenu();
      break;
    case "kGo": {
      const st = e.startSteal(id, { distract: !!ui.distract });
      ui.distract = false;
      if (st) {
        ui.view = "steal";
        ui.id = "";
        showMenu("outpost", { view: "steal", id: "" });
        save();
      } else renderMenu();
      break;
    }
    case "kPick":
      e.stealPick(Number(id));
      renderMenu();
      if (e.steal && ["done", "caught"].includes(e.steal.phase)) save();
      break;
    case "kTake":
      e.stealPress();
      renderMenu();
      if (e.steal && ["done", "caught"].includes(e.steal.phase)) save();
      break;
    case "kStop":
      e.stealStop();
      renderMenu();
      save();
      break;
    case "kOk":
      e.steal = null;
      ui.caughtResult = null;
      if (e.th.pending) showMenu("outpost", { view: "caught", id: "" });
      else closeMenu();
      break;
    case "kFace":
      e.steal = null;
      ui.caughtResult = null;
      showMenu("outpost", { view: "caught", id: "" });
      break;
    case "kCaught": {
      const run = Number(id) === 2;
      const r = e.resolveCaught(Number(id));
      if (r) {
        ui.caughtResult = r;
        if (run) toast(r.lines[0]);
      }
      renderMenu();
      save();
      break;
    }
    case "kPlant": {
      const [tid, what] = id.split("|");
      const r = e.plant(tid, what);
      if (r) {
        toast(r.lines[0]);
        closeMenu();
      } else renderMenu();
      save();
      break;
    }
    case "kFence": {
      const [item, fence] = id.split("|");
      e.sellHot(item, fence);
      renderMenu();
      save();
      break;
    }
    case "kJunk":
      e.tradeJunk();
      renderMenu();
      save();
      break;
    case "kDonate":
      e.donateJunk();
      renderMenu();
      save();
      break;
    case "kJob": {
      const [manual, person] = id.split("|");
      e.assignJob(manual, person);
      renderMenu();
      save();
      break;
    }
    case "kAmends":
      e.payAmends(id);
      renderMenu();
      save();
      break;
    case "kMark": {
      const tr = TREASURES[id],
        w = tr && e.th.where[tr.owner];
      if (!w) return true;
      const target = { region: w.region, x: w.x, y: w.y, label: TARGETS[tr.owner].name + " · " + tr.name };
      e.guidance.focus = null;
      e.guidance.target = target;
      if (rebuildUI) rebuildUI.target = target;
      if (e.s.region === target.region) {
        closeMenu();
        toast("金色路标：" + target.label + "。");
      } else showMenu("map", { selected: target.region });
      break;
    }
  }
  return true;
}
