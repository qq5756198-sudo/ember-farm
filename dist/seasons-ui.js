// v0.16.0「前哨四季」的界面：前哨广场（节庆与食堂）、营火夜谈、节庆日历、人物关系与带徒、
// 新人物对话、同处多对象选择、物品来源与用途链接、“新”标记与第一次打开时的说明卡。
import { ITEMS, RECIPES, BUILDINGS, TRADERS } from "./data.js";
import { costLine, missingCost, bundleText } from "./alliance-data.js";
import { consequence } from "./alliance-ui.js";
import { portrait, stationExtras as outpostStationExtras } from "./outpost-ui.js";
import { renderRebuildPlus, renderWinterJournal } from "./winter-ui.js";
import { NPCS } from "./outpost-data.js";
import {
  FESTIVALS,
  FEST_COST,
  DECOR,
  ADJ,
  TASTES,
  TOPICS,
  CRAFTS,
  SKILL_NAMES,
  SNPCS,
  HE_DISHES,
  JIANG_TASKS,
  BIRTHDAYS,
  FEATURES,
  SSPOTS,
  SHEET_SPOTS,
  CANTEEN_GUESTS,
} from "./seasons-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") =>
  `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const badge = (e, key) => (e.featureNew?.(key) ? '<i class="new-badge" aria-label="新">新</i>' : "");
const nbutton = (e, a, id, label, key = id) => `<button data-action="${a}" data-id="${esc(id)}">${esc(label)}${badge(e, key)}</button>`;
const LOOK_OF = { farmer: 2, medic: 1, mechanic: 0, tieqiao: 3 };
const lookFor = (e, id) => (NPCS[id]?.look ? id : (e.o?.crew.find((c) => c.id === id)?.look ?? LOOK_OF[id] ?? 4));
const hhmm = (m) => String(Math.floor(m / 60)).padStart(2, "0") + ":" + String(Math.floor(m % 60)).padStart(2, "0");
const head = (key, line, name, title) => {
  const n = SNPCS[key] || NPCS[key];
  return `<header class="npc-head">${portrait(n?.look ? key : 4, name || n?.name)}<div><b>${esc(name || n?.name)}</b><small>${esc(title || n?.title || "")}</small><p class="npc-line">${esc(line)}</p></div></header>`;
};
const hearts = (n) => {
  const full = Math.floor(n / 2),
    half = n % 2;
  return `<span class="hearts" aria-label="信任 ${n}/10">${"♥".repeat(full)}${half ? "<i>♥</i>" : ""}<b>${"♡".repeat(5 - full - half)}</b></span>`;
};

// ---------- 任务手记里的四季条 ----------
function seasonsStrip(e) {
  if (!e.ss || !e.festivalsOpen()) return "";
  const day = e.s.day,
    next = e.isFestivalDay() && !e.festivalHosted() ? day : e.nextFestivalDay(e.isFestivalDay() ? day + 1 : day),
    f = FESTIVALS[e.festivalKind(next)];
  const fest =
    next === day
      ? `<p class="fest-today">今天是「${esc(f.name)}」：16:00–22:00 到前哨广场主持。要交：${esc(f.pay)}。</p>`
      : `<p>下一次节庆：第${next}天「${esc(f.name)}」（还有 ${next - day} 天）。要交：${esc(f.pay)}。</p>`;
  const c = e.ss.canteen;
  const canteen = e.canteenOpen()
    ? `<p>前哨食堂：${c.night ? "正在营业" : e.isCanteenDay() && c.lastDay !== day ? "今晚 19:00 营业" : "每 7 天里的第 2、5 天营业"} · 口碑 ${Math.round(c.rep)}</p>`
    : "";
  const links = [nbutton(e, "sView", "calendar", "节庆日历"), nbutton(e, "sView", "people", "人物关系"), nbutton(e, "sView", "plaza", "前哨广场")].join("");
  return `<section class="seasons-strip" aria-label="节庆与人物">${fest}${canteen}<div class="outpost-links">${links}</div></section>`;
}
export function renderSeasonsJournal(e, ui = {}) {
  const html = renderWinterJournal(e, ui);
  if (ui.catalog || !e.ss) return html;
  const strip = seasonsStrip(e);
  if (!strip) return html;
  for (const mark of ['<section class="winter-strip"', '<section class="outpost-strip"']) {
    const at = html.indexOf(mark);
    if (at >= 0) {
      const end = html.indexOf("</section>", at) + "</section>".length;
      return html.slice(0, end) + strip + html.slice(end);
    }
  }
  return html;
}

// ---------- 营地手册居民页 ----------
export function renderManualSeasons(e, tab, h, ui, fui) {
  const html = renderRebuildPlus(e, tab, h, ui, fui);
  if (tab !== "residents" || !e.ss || !e.festivalsOpen()) return html;
  const a = e.ss.apprentice;
  const card = `<section class="rebuild-card seasons-card"><h3>人物关系与带徒</h3><p>认识 ${e.people().length} 人。${a ? e.residentName(a.master) + "正在带徒（第" + (e.s.day - a.start + 1) + "天）。" : "阿禾、陈工、许医生可以各带一名援建队员学手艺。"}</p><div class="button-row">${nbutton(e, "sView", "people", "打开人物关系")}</div></section>`;
  const at = html.indexOf('<div class="detail-scroll">');
  return at < 0 ? html + card : html.slice(0, at + 27) + card + html.slice(at + 27);
}

// ---------- 加工站：相邻加成 ----------
export function stationExtras(e, b) {
  const base = outpostStationExtras(e, b);
  if (!e.adjActive || !b) return base;
  const active = e.adjActive(b),
    hints = ADJ.filter((r) => r.a === b.type && !active.includes(r));
  if (!active.length && !hints.length) return base;
  return (
    base +
    `<p class="adj-line">${active.map((r) => `<b>＋ ${esc(r.text)}</b>`).join(" ")}${hints.map((r) => `<span>可以：${esc(r.hint)}</span>`).join(" ")}</p>`
  );
}

// ---------- 物品来源与用途 ----------
const TRADER_SPOTS = { food: { region: "market", x: 680, y: 445, label: "林姨 · 粮食商" }, mechanic: { region: "market", x: 970, y: 570, label: "老周 · 机械商" } };
export function itemLinks(e, id) {
  if (!ITEMS[id]) return "";
  const uses = RECIPES.filter((r) => r.cost?.[id]).slice(0, 4),
    makes = RECIPES.filter((r) => r.out?.[id]).slice(0, 2),
    traders = Object.entries(TRADERS).filter(([, t]) => t.stock?.[id]);
  const station = (r, verb) => {
    const out = Object.keys(r.out || {})[0],
      reason = e.recipeReason?.(r) || "",
      locked = reason && !/材料/.test(reason) ? reason : "";
    const st = r.station === "weaponbench2" ? "weaponbench" : r.station || "",
      where = st ? BUILDINGS[st]?.name || "" : "随手制作";
    return `<button class="link-chip" data-action="sLink" data-id="${st ? "station:" + esc(st) : "craft"}" title="${esc(reason || where)}">${verb}${esc(ITEMS[out]?.name || r.id)}<small>${esc(where)}${locked ? " · " + esc(locked) : ""}</small></button>`;
  };
  const src = [
    ...makes.map((r) => station(r, "做出：")),
    ...traders.map(([t]) => `<button class="link-chip" data-action="sLink" data-id="trader:${t}">在${esc(TRADER_SPOTS[t]?.label || t)}买</button>`),
    ...(["fish", "riverFish", "nightFish"].includes(id) ? ['<button class="link-chip" data-action="sLink" data-id="pond">林边池塘钓</button>'] : []),
    ...(ITEMS["seed" + id[0].toUpperCase() + id.slice(1)] ? [`<button class="link-chip" data-action="sLink" data-id="plant">种${esc(ITEMS["seed" + id[0].toUpperCase() + id.slice(1)].name)}</button>`] : []),
  ];
  const use = uses.map((r) => station(r, "能做："));
  if (!src.length && !use.length) return "";
  return `<div class="item-links">${src.length ? `<p><b>从哪来</b>${src.join("")}</p>` : ""}${use.length ? `<p><b>能做什么</b>${use.join("")}</p>` : ""}</div>`;
}

// ---------- 顶栏 ----------
export function seasonsHud(e) {
  if (!e.ss) return null;
  return { fresh: e.newFeatures().length > 0 };
}

// ---------- 视图 ----------
function intro(e, ui, key) {
  if (ui.intro !== key || !FEATURES[key]) return "";
  return `<aside class="intro-card" role="note"><b>新功能 · ${esc(FEATURES[key].name)}</b><p>${esc(FEATURES[key].intro)}</p></aside>`;
}
function viewPlaza(e) {
  const day = e.s.day,
    kind = e.festivalKind(e.isFestivalDay() ? day : e.nextFestivalDay()),
    f = FESTIVALS[kind],
    today = e.isFestivalDay(),
    stars = e.festivalStars(kind),
    reason = e.festivalReason(),
    pay = e.festivalPay(kind),
    here = e.atSpot(SSPOTS.plaza, 160);
  const starList = [f.star, "生活水准到“吃得好”", "阿砾画了两幅以上壁画，或老琴今晚唱过"];
  const fest = `<article class="${today ? "current" : ""}"><small>${today ? (e.festivalHosted() ? "今天 · 已办过" : "今天 16:00–22:00") : "第" + e.nextFestivalDay() + "天"}</small><h3>${esc(f.name)}</h3><p>${esc(f.desc)}</p>${consequence({ cost: pay ? bundleText(pay) : f.pay, gain: f.gain + "；广场多一件" + DECOR[f.decor].name, effect: "加分项每满一项多一颗星，奖励更多" })}<ul class="fest-stars">${stars.map((ok, i) => `<li class="${ok ? "on" : ""}">${ok ? "★" : "☆"} ${esc(starList[i])}</li>`).join("")}</ul>${button("sHost", "", "主持节庆", reason || !here ? `disabled title="${esc(reason || "到前哨广场主持")}"` : 'class="primary"')}${reason ? `<small class="story-lack">${esc(reason)}</small>` : !here ? '<small class="story-lack">到前哨广场（农场东边）主持</small>' : ""}</article>`;
  const lq = e.ss.laoqin;
  const song = e.laoqinHere()
    ? `<article><small>节庆之夜</small><h3>老琴</h3><p>${esc(lq.quest ? "老琴在长桌边调弦。歌谱找回 " + lq.sheets.length + "/4。" : SNPCS.laoqin.lines.hello)}</p>${consequence({ cost: "不花", gain: "居民士气 +3；算节庆的一颗星", effect: "第一次点歌后，他会托你找散落的歌谱" })}${button("sSong", "", "请老琴唱一首", lq.requestDay === day || !here ? "disabled" : 'class="primary"')}</article>`
    : "";
  return `${e.canteenOpen() ? head("he", "广场归我管。逢节庆摆长桌，一周两晚开食堂。") : '<p class="muted">节庆的长桌在这儿。每 7 天一次节庆，16:00–22:00 在这里主持。</p>'}<div class="story-choice">${e.ss.canteen.night ? viewCanteenCard(e, here) + fest + song : fest + song + viewCanteenCard(e, here)}</div><p class="muted">广场上的装饰：${e.ss.decor.length ? e.ss.decor.map((d) => DECOR[d].name).join("、") : "还没有"}（两件以上，居民士气每天 +1；四件 +2）。错过的节庆：${e.ss.fest.missed} 次。</p>`;
}
function viewCanteenCard(e, here) {
  const c = e.ss.canteen,
    n = c.night;
  if (!e.canteenOpen()) {
    const st = e.ss.he.stage;
    return `<article><small>前哨食堂</small><h3>还没开张</h3><p>${st ? "何大勺在集市等你复原第 " + st + " 道菜。" : "听说集市里来了个退伍炊事员。"}</p></article>`;
  }
  if (!n) {
    const reason = e.canteenReason();
    return `<article><small>前哨食堂 · 口碑 ${Math.round(c.rep)}</small><h3>食堂营业夜</h3>${consequence({ cost: "用掉做好的菜", gain: "每位客人付菜价的 1.2–1.8 倍；口碑高了集市收购食物贵一成（≥50）、唐九早一天来（≥70）", effect: "客人等不及会走，口碑下降" })}${button("sCanteen", "", "开张", reason || !here ? `disabled title="${esc(reason || "到前哨广场开张")}"` : 'class="primary"')}${reason ? `<small class="story-lack">${esc(reason)}</small>` : ""}</article>`;
  }
  const stock = e.dishesInStock();
  const guests = n.customers
    .map((g) => {
      const want = TASTES[g.taste],
        good = want.dishes.filter((d) => stock.includes(d)),
        other = stock.filter((d) => !want.dishes.includes(d)).slice(0, 2),
        left = Math.max(0, 1 - g.waited / g.patience);
      if (g.state !== "waiting") return `<li class="guest ${g.state}">${portrait(g.look, g.name)}<b>${esc(g.name)}</b><span>${g.state === "served" ? "吃完了" : "走了"}</span></li>`;
      return `<li class="guest">${portrait(g.look, g.name)}<div><b>${esc(g.name)}</b><small>想吃${esc(want.name)}</small><span class="patience"><i style="width:${Math.round(left * 100)}%"></i></span><div class="button-row">${good.map((d) => button("sServe", g.id + ":" + d, ITEMS[d].name + " ×" + e.quantityForCost(d, true), here ? 'class="primary"' : "disabled")).join("")}${other.map((d) => button("sServe", g.id + ":" + d, "凑合：" + ITEMS[d].name, here ? "" : "disabled")).join("")}${good.length || other.length ? "" : "<small class='story-lack'>没有菜了：去篝火灶做</small>"}</div></div></li>`;
    })
    .join("");
  return `<article class="current canteen-live"><small>营业中 · 第 ${n.spawned}/${CANTEEN_GUESTS} 位客人 · 21:30 打烊</small><h3>前哨食堂</h3><ul class="guests">${guests}</ul><p>收入 ${n.income} 金币 · 招待 ${n.served} 位 · 走了 ${n.missed} 位</p></article>`;
}
function viewTalk(e) {
  const reason = e.talkReason(),
    people = e.talkPeople(),
    at = e.fireSpot() && e.s.region === "farm" && Math.hypot(e.s.player.x - e.fireSpot().x, e.s.player.y - e.fireSpot().y) <= 140,
    dis = reason || !at ? "disabled" : 'class="primary"';
  const who = people.map((p) => `<li>${portrait(lookFor(e, p.id), p.name)}<b>${esc(p.name)}</b>${hearts(e.ss.trust[p.id] || 0)}${p.sad ? '<small class="story-lack">心里有事</small>' : ""}</li>`).join("");
  const topics = Object.entries(TOPICS)
    .map(([id, t]) => `<article><h3>${esc(t.name)}</h3>${consequence({ cost: "一晚只聊一次", gain: t.gain, effect: "每第三次夜谈会听到点消息" })}${button("sTalk", id, "就聊这个", dis)}</article>`)
    .join("");
  const comfort = people
    .filter((p) => p.sad)
    .map((p) => `<article><h3>安慰${esc(p.name)}</h3>${consequence({ cost: "一晚只聊一次", gain: (e.resident(p.id) ? "士气 +12（低落的当晚回到平常）、" : "") + "信任 +2", effect: "其他人这晚就没聊上" })}${button("sTalk", "comfort:" + p.id, "坐过去", dis)}</article>`)
    .join("");
  return `<p>晚饭后 19:00–23:00，援建营地的营火边。${reason ? `<span class="story-lack">${esc(reason)}。</span>` : at ? "" : '<span class="story-lack">走到营火边再开口。</span>'}</p><ul class="talk-people">${who}</ul><div class="story-choice">${comfort}${topics}</div>`;
}
function viewCalendar(e) {
  const day = e.s.day,
    cells = [];
  for (let d = day; d < day + 14; d++) {
    const tags = [];
    if (e.isFestivalDay(d)) tags.push(["fest", FESTIVALS[e.festivalKind(d)].name + (e.festivalHosted(d) ? " ✓" : "")]);
    if (e.canteenOpen() && e.isCanteenDay(d)) tags.push(["canteen", "食堂营业"]);
    if (e.o?.caravan.next === d || (d === day && e.caravanHere?.())) tags.push(["caravan", "唐九的商队"]);
    if (e.c.nextHordeDay === d) tags.push(["danger", "尸潮"]);
    const r = e.raidState?.();
    if (r?.phase === "scheduled" && r.day === d) tags.push(["danger", r === e.o.raid ? "灰隼团" : "灰隼团残部"]);
    const wi = e.w?.winter;
    if (wi && ["prep", "cold"].includes(wi.phase) && d >= wi.coldDay && d < wi.endDay) tags.push(["cold", "寒潮"]);
    if (e.o?.visitors.next === d && e.sc?.act >= 3) tags.push(["", "营门来人"]);
    for (const p of e.people()) if (BIRTHDAYS[p.id] && e.birthday(p.id, d)) tags.push(["bday", p.name + "生日"]);
    cells.push(`<li class="${d === day ? "today" : ""}"><b>第${d}天</b>${tags.map(([c, t]) => `<span class="tag ${c}">${esc(t)}</span>`).join("") || '<span class="tag quiet">—</span>'}</li>`);
  }
  return `<p>未来两周。节庆每 7 天一次，当天不排尸潮。生日那天送喜欢的东西，信任翻倍。</p><ol class="calendar">${cells.join("")}</ol>`;
}
function nextStep(e, id) {
  const s = e.ss;
  if (id === "he") return s.he.stage >= 4 ? "在前哨广场掌勺" : "复原第 " + Math.max(1, s.he.stage) + " 道菜（集市）";
  if (id === "qin") return s.qin.phase === "left" ? "坐渡船去找女儿了" : "心愿 " + s.qin.wishes.length + "/3";
  if (id === "adou") return s.adou.phase === "runner" ? "前哨跑腿" : s.adou.phase === "sister" ? "给他妹妹送药" : "等他的字条";
  if (id === "ali") return s.ali.phase === "painting" ? "壁画 " + s.ali.murals + " 幅（每段故事一幅）" : "南边围栏上乱画";
  if (id === "laoqin") return "歌谱 " + s.laoqin.sheets.length + "/4";
  if (id === "jiang") return JIANG_TASKS[s.jiang.phase]?.name || "池塘归你钓";
  if (s.skills[id]) return "学会了" + SKILL_NAMES[s.skills[id]];
  if (s.apprentice?.pupil === id) return "正在学" + SKILL_NAMES[s.apprentice.skill];
  return (e.ss.trust[id] || 0) >= 6 ? "信任已满三颗心" : "信任到三颗心：" + (e.resident(id) ? "该有的心情 +2" : "缺餐也不赌气");
}
function viewPeople(e) {
  const rows = e
    .people()
    .map((p) => {
      const likes = e.likes(p.id),
        given = e.ss.gifts[p.id] === e.s.day,
        bday = e.birthday(p.id);
      const gifts = likes
        .map((it) => {
          const reason = e.giftReason(p.id, it);
          return button("sGift", p.id + ":" + it, "送" + ITEMS[it].name + "（" + e.quantityForCost(it, true) + "）", reason ? `disabled title="${esc(reason)}"` : "");
        })
        .join("");
      return `<li>${portrait(lookFor(e, p.id), p.name)}<div><b>${esc(p.name)}</b><small>${esc(p.title)}${bday ? " · 今天生日" : BIRTHDAYS[p.id] ? " · 生日：每月第" + BIRTHDAYS[p.id] + "天" : ""}</small>${hearts(e.ss.trust[p.id] || 0)}<p>喜欢：${likes.map((x) => esc(ITEMS[x].name)).join("、") || "—"}　下一步：${esc(nextStep(e, p.id))}</p></div><div class="button-row">${given ? "<small>今天送过了</small>" : gifts}</div></li>`;
    })
    .join("");
  return `<p>信任来自送礼（每人每天一次）、营火夜谈、节庆和故事。居民信任满三颗心，该有的心情 +2；援建队员满三颗心，缺一顿饭也不会赌气变慢。</p><ul class="people">${rows}</ul>${viewApprentice(e)}`;
}
function viewApprentice(e) {
  const a = e.ss.apprentice;
  if (a)
    return `<section class="apprentice"><h3>带徒</h3><p>${esc(e.residentName(a.master))}正在带${esc(e.pupils().find((x) => x.id === a.pupil)?.name || "徒弟")}学${esc(SKILL_NAMES[a.skill])}：第${e.s.day - a.start + 1}/3 天，出师后 ${esc(Object.values(CRAFTS).find((c) => c.skill === a.skill).desc)}。带徒期间加工慢一成。</p>${button("sApprentice", "stop", "中断带徒")}</section>`;
  const masters = Object.entries(CRAFTS).filter(([m]) => e.resident(m)),
    pupils = e.pupils().filter((p) => !e.ss.skills[p.id]);
  const learned = Object.entries(e.ss.skills).map(([id, s]) => (e.pupils().find((p) => p.id === id)?.name || id) + "：" + SKILL_NAMES[s]).join("、");
  if (!masters.length || !pupils.length)
    return `<section class="apprentice"><h3>带徒</h3><p>${!masters.length ? "要有阿禾、陈工或许医生在营地当师父。" : "没有还没学手艺的援建队员。"}${learned ? "已出师：" + esc(learned) + "。" : ""}</p></section>`;
  const cards = masters
    .flatMap(([m, c]) =>
      pupils.slice(0, 3).map(
        (p) =>
          `<article><h3>${esc(e.residentName(m))} → ${esc(p.name)}</h3>${consequence({ cost: "3 天里加工慢一成，师父更累", gain: "学会" + c.name + "：" + c.desc, effect: "一次只能带一个" })}${button("sApprentice", m + ":" + p.id, "开始带徒", e.apprenticeReason(m, p.id) ? "disabled" : 'class="primary"')}</article>`,
      ),
    )
    .join("");
  return `<section class="apprentice"><h3>带徒</h3>${learned ? `<p>已出师：${esc(learned)}。</p>` : ""}<div class="story-choice">${cards}</div></section>`;
}
function viewPick(e) {
  const list = e._pickList || [];
  if (!list.length) return "<p>附近没有要选的东西了。</p>";
  return `<p>这里挨着好几样东西。按数字键或点一下：</p><div class="pick-list">${list.map((o, i) => `<button data-action="sPick" data-id="${i}" data-hotkey="${i + 1}"><kbd>${i + 1}</kbd>${esc(o.name)}</button>`).join("")}</div>`;
}
function viewDialog(e, id) {
  const s = e.ss;
  if (id === "he") {
    const want = e.heWant(),
      here = e.heHere() && Math.hypot(e.s.player.x - SSPOTS.he.x, e.s.player.y - SSPOTS.he.y) <= 130;
    if (s.he.stage >= 4) return head("he", SNPCS.he.lines.joined);
    if (!want) return `${head("he", SNPCS.he.lines.hello)}${button("sHe", "talk", "听他说说那几道菜", here ? 'class="primary"' : "disabled")}`;
    const r = RECIPES.find((x) => x.id === want);
    return `${head("he", "第 " + s.he.stage + " 道：" + ITEMS[want].name + "。" + (r ? "材料：" + bundleText(r.cost) + "，篝火灶。" : ""))}<div class="story-choice"><article><h3>端一份${esc(ITEMS[want].name)}给他尝</h3>${consequence({ cost: ITEMS[want].name + " 1 份（有 " + e.quantityForCost(want, true) + "）", gain: s.he.stage < 3 ? "他说出下一道菜" : "他入伙，前哨开食堂；再教两道菜", effect: "三道菜都对上味，他就搬到前哨" })}${button("sHe", "deliver", "请他尝", here && e.quantityForCost(want, true) ? 'class="primary"' : "disabled")}</article></div>`;
  }
  if (id === "qin") {
    const q = s.qin;
    const wish = (k, label) => `<li class="${q.wishes.includes(k) ? "on" : ""}">${q.wishes.includes(k) ? "✓" : "○"} ${esc(label)}</li>`;
    return `${head("qin", q.phase === "left" ? SNPCS.qin.lines.done : SNPCS.qin.lines.wish)}<ul class="fest-stars">${wish("sea", "再看一次海：去沉湾船坞替她看看，或给她看一张拍到池塘水面的照片")}${wish("cake", "再吃一口萝卜糕（何大勺的第二道菜）")}${wish("song", "再听一首老歌：电台播《点歌》或《老歌》，或节庆请老琴唱")}</ul><div class="button-row">${button("sQin", "cake", "送萝卜糕", q.phase === "staying" && !q.wishes.includes("cake") && e.quantityForCost("radishCake", true) ? 'class="primary"' : "disabled")}${button("sQin", "photo", "给她看照片", q.phase === "staying" && !q.wishes.includes("sea") ? "" : "disabled")}</div><p class="muted">三个心愿都了了，第二天一早她就去坐渡船。</p>`;
  }
  if (id === "lodger") {
    const l = s.lodger;
    if (!l) return "<p>没有人在等。</p>";
    const reason = e.lodgerReason();
    return `${l.qin ? head("qin", SNPCS.qin.lines.hello) : `<header class="npc-head">${portrait(l.look, l.name)}<div><b>${esc(l.name)}</b><small>过路人</small><p class="npc-line">${esc("天黑了，能借个地方睡一晚吗？明早就走。")}</p></div></header>`}<div class="story-choice"><article><h3>留他住一晚</h3>${consequence({ cost: "1 张空床或一间布置好的房间、1 份口粮", gain: l.qin ? "秦奶奶住下，有三个心愿" : "第二天一早留下谢礼：种子、消息、物资或一份家乡菜", effect: l.qin ? "她住着时不会有别的过路人" : "少数人会想留下，走入营审查" })}${button("sLodger", "host", "留宿", reason ? `disabled title="${esc(reason)}"` : 'class="primary"')}${reason ? `<small class="story-lack">${esc(reason)}</small>` : ""}</article><article><h3>婉拒</h3>${consequence({ cost: "不花", gain: "省一顿饭", effect: l.qin ? "她过几天还会再来" : "他去别处借宿" })}${button("sLodger", "decline", "婉拒")}</article></div>`;
  }
  if (id === "adou") {
    const a = s.adou;
    if (a.phase === "stealing")
      return `<header class="npc-head">${portrait("adou", "阿豆")}<div><b>仓库箱边的孩子</b><small>手里攥着一份干粮</small><p class="npc-line">（一个瘦小的孩子僵在原地，看着你。）</p></div></header><div class="story-choice"><article><h3>抓住他问清楚</h3>${consequence({ cost: "不花", gain: "知道他为什么偷", effect: "他会求你别声张" })}${button("sAdou", "catch", "抓住他", 'class="primary"')}</article><article><h3>假装没看见</h3>${consequence({ cost: "再丢 1 份干粮", gain: "明早会有一张字条", effect: "他不会被吓跑" })}${button("sAdou", "ignore", "转过身")}</article></div>`;
    if (a.phase === "sister")
      return `${head("adou", SNPCS.adou.lines.caught)}<div class="story-choice"><article><h3>给他妹妹送药</h3>${consequence({ cost: "绷带、草药茶或药包 1 份", gain: "阿豆当前哨跑腿：送货快四分之一", effect: "夜里有他守仓库，小偷偷不走东西" })}${button("sAdou", "medicine", "拿药给他", ["bandage", "herbTea", "medkit"].some((x) => e.quantityForCost(x, true)) ? 'class="primary"' : "disabled")}</article></div>`;
    return head("adou", SNPCS.adou.lines.thanks);
  }
  if (id === "ali") {
    const a = s.ali;
    if (a.phase === "here")
      return `${head("ali", SNPCS.ali.lines.hello)}<div class="story-choice"><article><h3>让他把前哨的大事画下来</h3>${consequence({ cost: "不花", gain: "每完成一段故事，围栏上多一幅壁画", effect: "三幅以上居民士气每天 +1；节庆多一个看点" })}${button("sAli", "paint", "就画这面墙", 'class="primary"')}</article><article><h3>骂走他</h3>${consequence({ cost: "不花", gain: "围栏清净", effect: "下次节庆后他还会溜回来" })}${button("sAli", "scold", "骂走")}</article></div>`;
    const acts = (e.sc?.claimed || []).filter((x) => /^act\d$/.test(x)).slice(0, a.murals);
    return `${head("ali", "画好 " + a.murals + " 幅了。" + (a.murals < Math.min(8, e.actsDone()) ? "明天再画一幅。" : "等你们做出下一件大事。"))}<p class="muted">壁画：${acts.map((x) => "第" + x.slice(3) + "段").join("、") || "还没开画"}</p>`;
  }
  if (id === "jiang") {
    const j = s.jiang,
      t = JIANG_TASKS[j.phase],
      line = j.phase === "mutant" ? SNPCS.jiang.lines.mutant : j.phase === "release" ? SNPCS.jiang.lines.release : j.phase === "done" ? SNPCS.jiang.lines.done : SNPCS.jiang.lines.hello;
    const at = e.atSpot(SSPOTS.jiang);
    return `${head("jiang", line)}<p>鱼竿：${j.rod ? "升级 " + j.rod + " 次（咬钩快 " + (0.4 * j.rod).toFixed(1) + " 秒）" : "原装"}。</p>${t ? `<div class="story-choice"><article><h3>${esc(t.name)}</h3>${consequence({ cost: costLine(e, t.need), gain: t.reward, effect: j.phase === "mutant" ? "接了这件事后，在农场池塘钓鱼有机会钓到变异鱼" : "江伯的委托一件接一件" })}${button("sJiang", "deliver", "交给江伯", at && !missingCost(e, t.need).length ? 'class="primary"' : "disabled")}</article></div>` : ""}`;
  }
  return null;
}

const TITLES = { plaza: "前哨广场", talk: "营火夜谈", calendar: "节庆日历", people: "人物关系", pick: "选一个" };
export function seasonsTitle(ui, fallback) {
  if (ui.view === "dialog" && (SNPCS[ui.id] || ui.id === "lodger")) return ui.id === "lodger" ? "借宿" : SNPCS[ui.id].name;
  return TITLES[ui.view] || fallback(ui);
}
export function renderSeasonsView(e, ui = {}, fallback) {
  if (!e.ss) return fallback(e, ui);
  let body = null;
  if (ui.view === "plaza") body = viewPlaza(e);
  else if (ui.view === "talk") body = viewTalk(e);
  else if (ui.view === "calendar") body = viewCalendar(e);
  else if (ui.view === "people") body = viewPeople(e);
  else if (ui.view === "pick") body = viewPick(e);
  else if (ui.view === "dialog") body = viewDialog(e, ui.id);
  if (body === null) {
    const html = fallback(e, ui),
      card = intro(e, ui, ui.view);
    return card ? html.replace(/(<div class="outpost-page[^"]*">)/, "$1" + card) : html;
  }
  return `<div class="outpost-page view-${esc(ui.view)}">${intro(e, ui, ui.view)}${body}</div>`;
}

const ACTIONS = ["sView", "sHost", "sSong", "sCanteen", "sServe", "sTalk", "sGift", "sApprentice", "sLodger", "sQin", "sAdou", "sAli", "sJiang", "sHe", "sPick", "sLink"];
export function handleSeasonsAction(action, el, ctx) {
  const { engine: e, ui = {}, showMenu, closeMenu, renderMenu, save, toast, rebuildUI } = ctx,
    id = el.dataset.id || "";
  if (!e.ss) return false;
  // 第一次打开一个功能：记下来，并在页面顶上放一张说明卡。
  if (action === "wView" || action === "sView") {
    const view = id.split(":")[0];
    ui.intro = e.featureNew(view) ? view : null;
    if (FEATURES[view]) e.markSeen(view);
    if (action === "wView") return false;
  }
  if (!ACTIONS.includes(action)) return false;
  const stay = () => {
    renderMenu();
    save();
  };
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
  if (action === "sView") showMenu("outpost", { view: id, id: "" });
  else if (action === "sHost") {
    if (e.hostFestival()) save();
    renderMenu();
  } else if (action === "sSong") {
    e.laoqinSong();
    stay();
  } else if (action === "sCanteen") {
    e.startCanteen();
    stay();
  } else if (action === "sServe") {
    const [g, dish] = id.split(":");
    e.serveGuest(g, dish);
    stay();
  } else if (action === "sTalk") {
    if (e.talk(id)) closeMenu();
    else renderMenu();
    save();
  } else if (action === "sGift") {
    const [p, item] = id.split(":");
    e.giveGift(p, item);
    stay();
  } else if (action === "sApprentice") {
    if (id === "stop") e.stopApprentice();
    else {
      const [m, p] = id.split(":");
      e.startApprentice(m, p);
    }
    stay();
  } else if (action === "sLodger") {
    if (e.decideLodger(id)) closeMenu();
    else renderMenu();
    save();
  } else if (action === "sQin") {
    if (id === "cake") e.qinCake();
    else if (id === "photo") e.qinPhoto();
    stay();
  } else if (action === "sAdou") {
    if (id === "medicine") e.adouMedicine();
    else e.adouDecide(id);
    stay();
  } else if (action === "sAli") {
    e.aliDecide(id);
    stay();
  } else if (action === "sJiang") {
    e.jiangTalk();
    stay();
  } else if (action === "sHe") {
    if (id === "talk") e.heTalk();
    else e.heDeliver();
    stay();
  } else if (action === "sPick") {
    closeMenu();
    e.pick(Number(id));
    save();
  } else if (action === "sLink") {
    const [kind, arg] = id.split(":");
    if (kind === "craft") showMenu("craft");
    else if (kind === "station") {
      const b = e.s.buildings.find((x) => x.type === arg && x.hp > 0);
      if (b) showMenu("station", { buildingId: b.id });
      else if (BUILDINGS[arg]) showMenu("build", { focusBuild: arg });
      else toast("没有这样的设施。");
    } else if (kind === "trader" && TRADER_SPOTS[arg]) mark(TRADER_SPOTS[arg]);
    else if (kind === "pond") mark({ region: "farm", x: 1040, y: 800, label: "林边池塘" });
    else if (kind === "plant") mark({ region: "farm", x: 510, y: 430, label: "农田" });
  }
  return true;
}
