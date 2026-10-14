// v0.30.0「人情」的界面：人物关系页（这会儿在哪、喜好、送礼、心里话、搭伙、收留的孩子、最近的纸条）；
// 心里话、说开、托付孩子三段对话；广场上节庆的事（路灯、换种子、念名字、请全营吃一顿）；成就册里的鱼类图鉴；
// 许医生的居民卡上验水样、研究变异鱼；警报栏：谁有话想说、要去哪找东西、门口等你答复的、点路灯。
import { ITEMS, BUILDINGS } from "./data.js";
import { ALERT_HOOKS } from "./winter-ui.js";
import { RESIDENT_HOOKS } from "./people-hooks.js";
import { portrait } from "./outpost-ui.js";
import { consequence } from "./alliance-ui.js";
import { NPCS } from "./outpost-data.js";
import { BIRTHDAYS, TOPICS, FEATURES } from "./seasons-data.js";
import {
  HEART_IDS,
  HEART_AT,
  PARTNER_IDS,
  GIFT,
  TALK_RULES,
  giftBase,
  prefsOf,
  REQUESTS,
  SKILLS,
  SKILL_OF,
  NOTE,
  LAMPS,
  PARTNER,
  KIDS,
  KID_CRAFTS,
  WATERS,
  FISH,
  FISH_IDS,
  SAMPLES,
  ta,
} from "./kin-data.js";
import { HEARTS, PARTNER_LINES } from "./kin-story.js";
import { seasonOf, seasonDay } from "./almanac-data.js";

// 营火夜谈的“说说以前”改了：在座的人各透露一样喜好，10 天里没因为聊天长过信任的人 +1
TOPICS.past.gain = "在座的人各透露一样喜好；" + TALK_RULES.cd + " 天里没因为聊天长过信任的人 +1";
FEATURES.people.intro = "每个人的信任、这会儿在哪、喜好和心里话。每人 7 天最多送 2 次，要走到人跟前送；喜好一开始都不知道，要一样样猜。";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const act = (a, id, label, reason, primary = false) => button(a, id, label, reason ? `disabled title="${esc(reason)}"` : primary ? 'class="primary"' : "") + (reason ? `<small class="story-lack">${esc(reason)}</small>` : "");
const LOOK_OF = { farmer: 2, medic: 1, mechanic: 0, tieqiao: 3 };
const lookFor = (e, id) => (NPCS[id]?.look ? id : (e.o?.crew.find((c) => c.id === id)?.look ?? LOOK_OF[id] ?? 4));
const name = (id) => ITEMS[id]?.name || id;
const CAT = { fav: "最爱", like: "喜欢", hate: "讨厌", meh: "一般" };
const hearts = (n, part) => {
  const full = Math.floor(n / 2),
    h = n % 2;
  return `<span class="hearts" aria-label="信任 ${n}/10">${"♥".repeat(full)}${h ? "<i>♥</i>" : ""}<b>${"♡".repeat(5 - full - h)}</b></span>${part ? `<small class="kin-half" title="信任 5 以上每格要两份心意，8 以上要三份">这一格 ${part.have}/${part.need}</small>` : ""}`;
};

// ================= 人物关系 =================
function prefLine(e, id) {
  const P = prefsOf(id),
    k = e.prefKnown(id);
  const show = (list) => list.map((x) => (k[x] ? esc(name(x)) : '<i class="kin-q">？</i>')).join("、");
  return `<p class="kin-prefs"><b>最爱</b> ${show(P.fav)}　<b>喜欢</b> ${show(P.like)}　<b>讨厌</b> ${show(P.hate)}</p>`;
}
function whereLine(e, id) {
  const w = e.whereNow(id);
  const here = !w.away && w.region === e.s.region;
  const where = w.away ? w.label : (w.region !== "farm" ? e.regionName(w.region) + " · " : "") + w.label;
  return `<p class="kin-where">这会儿：${esc(where)}${w.away ? "" : " " + button("kinMark", id, here && e.personNear(id) ? "就在你跟前" : "标出位置", here && e.personNear(id) ? "disabled" : "")}</p>`;
}
function heartLine(e, id) {
  if (!HEART_IDS.includes(id)) return "";
  const h = e.heart(id);
  if (h.seg >= 3) {
    const sk = SKILL_OF[id];
    return `<p class="kin-heart done">心里话 3/3 都说完了${sk ? "：教了你「" + esc(SKILLS[sk].name) + "」（" + esc(SKILLS[sk].desc) + "）" : ""}</p>`;
  }
  const seg = HEARTS[id][h.seg],
    reason = e.heartReason(id);
  if (!reason) return `<p class="kin-heart ready">心里话 ${h.seg}/3：${esc(e.kinName(id))}像是有话想说——「${esc(seg.title)}」。${button("kinTalkTo", id, "过去听", 'class="primary"')}</p>`;
  let extra = "";
  if (h.seg === 2) {
    const q = REQUESTS[id];
    extra = h.got || e.qty(q.item, true) > 0 ? "（" + name(q.item) + "已经找到了，傍晚交给" + ta(id) + "）" : "（托你去" + e.regionName(q.region) + "找「" + q.name + "」：" + q.hint + "）";
  }
  return `<p class="kin-heart">心里话 ${h.seg}/3：${esc(reason)}${esc(extra)}</p>`;
}
function giftRow(e, id) {
  const n = e.giftsIn(id).length;
  const b = BIRTHDAYS[id];
  const count = `<small class="muted">这 7 天送了 ${n}/${GIFT.per} 次${b ? " · 生日：" + seasonOf(b).name + "第 " + seasonDay(b) + " 天（每年第 " + b + " 天）" + (e.birthday(id) ? "，就是今天，送对了翻倍" : "") : ""}</small>`;
  if (n >= GIFT.per) return `<div class="kin-gift">${count}<small class="story-lack">第 ${e.giftNextDay(id)} 天能再送</small></div>`;
  if (!e.personNear(id)) return `<div class="kin-gift">${count}<small class="muted">走到${ta(id)}跟前才能送。</small></div>`;
  const { known, tries } = e.giftOptions(id);
  const k = e.prefKnown(id);
  const b1 = known.map((x) => button("kinGift", id + "|" + x, "送" + name(x) + "（" + CAT[k[giftBase(x)]] + " · 有 " + e.qty(x, true) + "）", e.giftReason(id, x) ? "disabled" : k[giftBase(x)] === "fav" ? 'class="primary"' : "")).join("");
  const b2 = tries.map((x) => button("kinGift", id + "|" + x, "试试" + name(x) + "（有 " + e.qty(x, true) + "）", e.giftReason(id, x) ? "disabled" : "")).join("");
  return `<div class="kin-gift">${count}<div class="button-row">${b1}${b2 || (b1 ? "" : "<small class='muted'>手上没有能送的东西。</small>")}</div></div>`;
}
function partnerLine(e, id) {
  if (!PARTNER_IDS.includes(id)) return "";
  const p = e.kin.partner;
  if (p && p.id !== id) return "";
  if (p?.stage === "home") return `<p class="kin-partner gold">和你搭伙过日子${e.partnerHurt() ? "（挂了彩，在农舍里歇着）" : "：每天早上有热早饭，帮你浇田或修设施，长夜里守在你身边"}。</p>`;
  if (p?.stage === "set") return `<p class="kin-partner gold">你们说开了：到前哨广场请全营吃一顿（${esc(Object.entries(PARTNER.feast).map(([k, n]) => name(k) + " " + n).join("、"))}）。</p>`;
  if (p?.stage === "near") return `<p class="kin-partner">你们走近了：信任到 ${PARTNER.confess}、三段心里话说完，傍晚在营火边说开。${e.confessReason(id) ? "<small class='muted'>" + esc(e.confessReason(id)) + "</small>" : ""}</p>`;
  const t = e.ss.trust[id] || 0;
  if (t < PARTNER.near - 2) return "";
  const btns = PARTNER.gifts.map((it) => act("kinPartnerGive", id + "|" + it, "送亲手做的" + name(it), e.partnerGiftReason(id, it))).join("");
  return `<div class="kin-partner"><p>想和${esc(e.kinName(id))}搭伙过日子：信任 ${PARTNER.near}、听完两段心里话，送一样亲手做的东西（制作台：铁丝戒指 / 修好的旧收音机）。</p><div class="button-row">${btns}</div></div>`;
}
function personCard(e, p, focus) {
  const id = p.id,
    t = e.ss.trust[id] || 0;
  return `<li class="kin-person${focus ? " focus" : ""}${e.heartReady(id) ? " talk" : ""}" id="kin-${esc(id)}">${portrait(lookFor(e, id), p.name)}<div class="kin-body"><b>${esc(id === "cartographer" ? "柏岚" : p.name)}</b><small>${esc(p.title)}</small>${hearts(t, e.trustPart(id))}${whereLine(e, id)}${prefLine(e, id)}${heartLine(e, id)}${partnerLine(e, id)}${giftRow(e, id)}</div></li>`;
}
function kidsBlock(e) {
  const kids = e.kin.kids;
  if (!kids.length) return "";
  const masters = e.kidMasters();
  const rows = kids
    .map((k) => {
      const m = k.master ? e.kinName(k.master) : "";
      const status = k.learned ? "跟着" + m + "学会了" + KID_CRAFTS[k.master].name + "：" + KID_CRAFTS[k.master].desc : k.master ? "跟着" + m + "学" + KID_CRAFTS[k.master].name + "：第 " + Math.min(KIDS.learn, e.s.day - k.start + 1) + "/" + KIDS.learn + " 天" : "还没有师父";
      const btns = k.learned ? "" : masters.filter((x) => x !== k.master).map((x) => button("kinKidLearn", k.id + ":" + x, "跟" + e.kinName(x) + "学" + KID_CRAFTS[x].name)).join("");
      return `<li>${portrait(k.look, k.name)}<div><b>${esc(k.name)}</b><small>${esc(k.from)}托付的孩子 · 第 ${k.day} 天来的${k.hungry ? " · 饿过 " + k.hungry + " 顿" : ""}</small><p>${esc(status)}</p><div class="button-row">${btns}</div></div></li>`;
    })
    .join("");
  return `<section class="kin-kids" id="kin-kids"><h3>收留的孩子</h3><p class="muted">每天晚上各吃 1 份口粮；跟着师父学 ${KIDS.learn} 天出师，以后每天帮点小忙。长夜里他们待在屋里。</p><ul class="people">${rows}</ul></section>`;
}
function notesBlock(e) {
  const log = e.kin.noteLog;
  if (!log.length) return "";
  return `<section class="kin-notes"><h3>最近门缝里的纸条</h3><ul>${log
    .slice(0, 6)
    .map((n) => `<li><small>第 ${n.day} 天 · ${esc(e.kinName(n.from))}</small> ${esc(n.text)}</li>`)
    .join("")}</ul></section>`;
}
function viewPeople(e, ui, base) {
  const focus = ui.id && ui.id !== "kids" ? ui.id : "";
  const list = e.people().sort((a, b) => (b.id === focus) - (a.id === focus) || e.heartReady(b.id) - e.heartReady(a.id) || (e.ss.trust[b.id] || 0) - (e.ss.trust[a.id] || 0));
  const rows = list.map((p) => personCard(e, p, p.id === focus)).join("");
  const at = base.indexOf('<section class="apprentice">');
  const apprentice = at >= 0 ? base.slice(at).replace(/<\/div>\s*$/, "") : "";
  const intro = `<p>每个人最爱 2 样、喜欢 4 样、讨厌 2 样，一开始都不知道：营火边说说以前、节庆里聊两句、送错了看他的脸色、门缝里的纸条、顺手牵羊时瞄一眼口袋，都会透露一点。最爱 +2、喜欢 +1、一般不变、讨厌 −1；每人 7 天最多送 ${GIFT.per} 次，生日送对了翻倍；要走到他跟前才送得出手。信任 ${GIFT.slowFrom} 以上每格要两份心意，${GIFT.slow3} 以上要三份——送礼、营火夜谈、心里话、订单板上他的单子（7 天一回）都算一份。</p>`;
  return `<div class="outpost-page view-people kin-people">${e.kin.ask ? `<p class="outpost-alert">${esc(e.kin.ask.from)}和孩子在农舍门口等你答复（今天 20:00 前）。</p>` : ""}${intro}<ul class="people">${rows}</ul>${kidsBlock(e)}${notesBlock(e)}${apprentice}</div>`;
}

// ================= 心里话、说开、托付孩子 =================
const npcHead = (e, id, line, title) => `<header class="npc-head">${portrait(lookFor(e, id), e.kinName(id))}<div><b>${esc(e.kinName(id))}</b><small>${esc(title)}</small>${line ? `<p class="npc-line">${esc(line)}</p>` : ""}</div></header>`;
function viewHeart(e, ui) {
  const id = ui.id;
  const out = ui.kinOut && ui.kinOut.id === id ? ui.kinOut.out : null;
  if (out) return `${npcHead(e, id, "", "心里话 " + out.seg + "/3 · 「" + out.title + "」")}<div class="kin-scene">${out.lines.map((l) => `<p>${esc(l)}</p>`).join("")}</div><div class="button-row">${button("close", "", "嗯", 'class="primary"')}</div>`;
  if (!HEART_IDS.includes(id)) return "<p>没有要说的。</p>";
  const h = e.heart(id),
    seg = HEARTS[id][h.seg],
    reason = e.heartReason(id);
  if (!seg) return npcHead(e, id, "该说的都说完了。", "心里话 3/3");
  if (reason) return `${npcHead(e, id, "", "心里话 " + h.seg + "/3")}<p class="story-lack">${esc(reason)}。</p>`;
  const lines = e.heartLines(id).map((l) => `<p>${esc(l)}</p>`).join("");
  let pick;
  if (seg.choices) pick = `<div class="story-choice">${seg.choices.map((c, i) => `<article><h3>${esc(c.label)}</h3>${button("kinHeartPick", id + ":" + i, "这么说", 'class="primary"')}</article>`).join("")}</div>`;
  else {
    const q = REQUESTS[id];
    pick = `<div class="button-row">${button("kinHeartPick", id + ":0", "把" + name(q.item) + "交给" + ta(id), 'class="primary"')}</div>`;
  }
  return `${npcHead(e, id, "", "心里话 " + (h.seg + 1) + "/3 · 「" + seg.title + "」")}<div class="kin-scene">${lines}</div>${pick}`;
}
function viewConfess(e, ui) {
  const id = ui.id,
    reason = e.confessReason(id);
  if (reason) return `${npcHead(e, id, "", "营火边")}<p class="story-lack">${esc(reason)}。</p>`;
  return `${npcHead(e, id, PARTNER_LINES[id]?.confess || "", "营火边")}<div class="story-choice"><article><h3>就这么过下去吧</h3>${consequence({ cost: "明天起在广场请全营吃一顿（" + Object.entries(PARTNER.feast).map(([k, n]) => name(k) + " " + n).join("、") + "）", gain: "每天早上的热早饭，浇田或修设施", effect: "长夜里守在你身边，也可能挂彩，要护着他" })}${button("kinConfess", id + ":yes", "就这么过下去吧", 'class="primary"')}</article><article><h3>再等等</h3>${consequence({ cost: "不花", gain: "以后还能再说", effect: "什么都不变" })}${button("kinConfess", id + ":no", "再等等")}</article></div>`;
}
function viewKid(e) {
  const a = e.kin.ask;
  if (!a) return "<p>门口没有人在等。</p>";
  const reason = e.kidReason();
  return `<header class="npc-head">${portrait(a.look, a.from)}<div><b>${esc(a.from)}</b><small>带着${esc(a.name)}的过路人</small><p class="npc-line">${esc("这孩子跟着我走不了远路……能不能留在你们这儿？他吃得少，什么活都肯学。")}</p></div></header><div class="story-choice"><article><h3>收留${esc(a.name)}</h3>${consequence({ cost: "每天晚上 1 份口粮；要有空床或布置好的房间", gain: "跟着阿禾、许医生、陈工或何大勺学 " + KIDS.learn + " 天手艺，以后每天帮点小忙", effect: "孩子不打仗，长夜里待在屋里" })}${act("kinKid", "yes", "留下他", reason, true)}</article><article><h3>让${esc(a.from)}带着走</h3>${consequence({ cost: "不花", gain: "省一份口粮", effect: "她背着孩子上路" })}${button("kinKid", "no", "送他们上路")}</article></div>`;
}

// ================= 广场：节庆里的事、请全营吃一顿 =================
function plazaBlock(e) {
  if (!e.kin) return "";
  const parts = [];
  const p = e.kin.partner;
  if (p?.stage === "set") parts.push(`<article class="current"><h3>请全营吃一顿</h3><p>你和${esc(e.kinName(p.id))}说开了。在纪念石前请大家吃一顿，就搬进农舍一起过日子。</p>${act("kinFeast", "", "请客（" + Object.entries(PARTNER.feast).map(([k, n]) => name(k) + " " + n).join("、") + "）", e.feastReason(), true)}</article>`);
  if (e.festDay()) {
    const kind = e.festivalKind(e.s.day),
      f = e.kin.fest.day === e.s.day ? e.kin.fest : { chat: [], lamps: [], swap: false, read: false };
    const here = e.people().filter((x) => !e.whereNow(x.id).away);
    const chat = `<p>16:00 起认识的人都会来广场。走到跟前按 E 说句话：心情 +3，还会透露一样喜好。今天聊过：${f.chat.length ? esc(f.chat.map((id) => e.kinName(id)).join("、")) : "还没有"}（来了 ${here.length} 人）。</p>`;
    let act2 = "";
    if (kind === "lanterns") act2 = `<p>灯火夜：16:00–20:00 把通往营门的 ${LAMPS.length} 盏路灯一盏盏点亮（走到灯下按 E），点满了当晚夜行者不会摸过来。已点：${f.lamps.length}/${LAMPS.length}。</p>`;
    if (kind === "seeds") {
      const plan = e.swapPlan();
      act2 = `<p>换种集：拿你最多的那种种子 2 颗，和大家换你最少的那种 2 颗。</p>${act("kinSwap", "", plan ? "拿 2 颗" + name(plan.give) + "换 2 颗" + name(plan.get) : "换种子", e.swapReason())}`;
    }
    if (kind === "harvest") act2 = `<p>丰收评比：挑上品摆上长桌，评语更好看。</p>`;
    if (kind === "vigil") act2 = `<p>守夜纪念日：在纪念石前，大家轮流念一个没走到今天的人的名字（居民心情 +4）。这一晚想说心里话的人，在广场上就说得出口。</p>${act("kinVigil", "", "念名字", e.vigilReason())}`;
    parts.push(`<article class="kin-fest">${chat}${act2}</article>`);
  }
  return parts.length ? `<section class="kin-plaza">${parts.join("")}</section>` : "";
}

// ================= 成就册：鱼类图鉴 =================
function fishBook(e) {
  const k = e.kin.fish;
  const got = FISH_IDS.filter((id) => k[id] || (e.w?.caught || []).includes(id)).length;
  const cells = FISH_IDS.map((id) => {
    const f = FISH[id],
      has = k[id] || (e.w?.caught || []).includes(id);
    return `<li class="${has ? "on" : ""}"><b>${has ? esc(name(id)) : "？？"}</b><small>${esc(f.hint)}${has && k[id] ? " · 钓上 " + k[id] + " 条" : ""}</small></li>`;
  }).join("");
  const waters = Object.entries(SAMPLES)
    .map(([w]) => WATERS[w].name + (e.kin.waters[w] ? "（验过了，能吃）" : "（没验过，钓的鱼先别吃）"))
    .join("、");
  return `<section class="kin-fishbook"><h3>鱼类图鉴 ${got}/${FISH_IDS.length}</h3><p class="muted">林边池塘、农场水渠、溪谷的河、沉湾的海。咬钩后按住收线，鱼一挣就松手，线绷红了会断。${esc(waters)}。</p><ul>${cells}</ul></section>`;
}

// ================= 页面补丁（套在四时那一层外面） =================
export function renderKinView(e, ui, base) {
  if (!e?.kin || !ui) return base(e, ui);
  if (ui.view === "people") return viewPeople(e, ui, base(e, ui));
  if (ui.view === "kinHeart") return `<div class="outpost-page view-kinHeart">${viewHeart(e, ui)}</div>`;
  if (ui.view === "kinConfess") return `<div class="outpost-page view-kinConfess">${viewConfess(e, ui)}</div>`;
  if (ui.view === "kinKid") return `<div class="outpost-page view-kinKid">${viewKid(e)}</div>`;
  const html = base(e, ui);
  if (ui.view === "plaza") {
    const add = plazaBlock(e);
    return add ? html.replace(/(<div class="outpost-page[^"]*">)/, "$1" + add) : html;
  }
  if (ui.view === "collection") {
    const at = html.lastIndexOf("</div>");
    return at >= 0 ? html.slice(0, at) + fishBook(e) + html.slice(at) : html + fishBook(e);
  }
  if (ui.view === "bOrders") return patchOrders(e, html);
  return html;
}
// 订单板：阿禾、许医生、陈工的单子算一份心意，每人 7 天一回（这周算过了就写一声）
function patchOrders(e, html) {
  const who = Object.fromEntries((e.bt?.orders.list || []).map((x) => [x.id, x.who]));
  html = html.replace("阿禾、许医生、陈工的单子还加 1 点信任。", "阿禾、许医生、陈工的单子还算一份心意（每人 7 天算一回）。");
  return html
    .split('<article class="bt-order')
    .map((chunk, i) => {
      if (!i) return chunk;
      const id = chunk.match(/data-action="btOrderGive" data-id="([^"]*)"/)?.[1],
        p = id && who[id];
      if (!p || !chunk.includes(" · 信任 +1")) return chunk;
      const wait = e.orderTrustWait(p);
      return chunk.replace(" · 信任 +1", wait ? " · " + esc(e.kinName(p)) + "这几天已经记着你的好了（" + wait + " 天后再算）" : " · 算一份心意");
    })
    .join('<article class="bt-order');
}
const TITLES = { kinHeart: "心里话", kinConfess: "营火边", kinKid: "托付" };
export function kinTitle(ui, fallback) {
  return TITLES[ui?.view] || fallback(ui);
}

// ================= 居民卡：许医生验水样、研究变异鱼；每个人的信任 =================
RESIDENT_HOOKS.push((e, r) => {
  if (!e?.kin || !r) return "";
  let out = `<p class="kin-res">信任 ${e.ss?.trust[r.id] || 0}/10 · 送东西、听心里话在「人物关系」${button("sView", "people", "人物关系")}</p>`;
  if (r.id !== "medic") return out;
  const rows = [];
  for (const w of Object.keys(SAMPLES)) if (!e.kin.waters[w] && e.qty(SAMPLES[w], true) > 0) rows.push(act("kinVerify", w, "验" + WATERS[w].name + "的水样", e.verifyReason(w)));
  for (const id of FISH_IDS) if (FISH[id].mutant && FISH[id].name && e.qty(id, true) > 0) rows.push(act("kinResearch", id, "研究" + name(id), e.fishResearchReason(id)));
  if (rows.length) out += `<div class="kin-lab"><p>许医生：“水里钓上来的东西，先拿给我看看。”</p><div class="button-row">${rows.join("")}</div></div>`;
  return out;
});

// ================= 警报栏 =================
ALERT_HOOKS.push((e, add) => {
  if (!e?.kin) return;
  const wait = e.heartWaiting();
  for (const id of wait.slice(0, 2)) {
    const w = e.whereNow(id);
    add(7, e.kinName(id) + "在" + (w.label || "营地") + "，像是有话想说", "gold", w.away ? null : { region: w.region, x: w.x, y: w.y, label: e.kinName(id) });
  }
  const a = e.kin.ask;
  if (a) add(6, a.from + "和孩子在农舍门口等你答复", "gold", { region: "farm", x: 300, y: 336, label: a.from });
  if (e.lampsOn() && !e.lampsFull() && e.s.minute < 20 * 60) {
    const i = LAMPS.findIndex((_, k) => !e.kin.fest.lamps.includes(k));
    add(6, "灯火夜：还有 " + (LAMPS.length - e.kin.fest.lamps.length) + " 盏路灯没点（20:00 前）", "gold", { region: "farm", x: LAMPS[i].x, y: LAMPS[i].y, label: "路灯" });
  }
  if (e.kin.partner?.stage === "set" && !e.feastReason().startsWith("第二天")) add(8, "请全营吃一顿（前哨广场）", "gold", { region: "farm", x: 1240, y: 470, label: "前哨广场" });
  for (const id of HEART_IDS) {
    const h = e.kin.heart[id];
    if (!h || h.seg !== 2 || h.got || e.qty(REQUESTS[id].item, true) > 0) continue;
    const q = REQUESTS[id];
    add(10, "替" + e.kinName(id) + "去" + e.regionName(q.region) + "找「" + q.name + "」", "normal", { region: q.region, x: q.x, y: q.y, label: q.name });
    break;
  }
});

// ================= 动作 =================
const ACTIONS = ["kinGift", "kinPartnerGive", "kinMark", "kinTalkTo", "kinHeartPick", "kinConfess", "kinFeast", "kinKid", "kinKidLearn", "kinSwap", "kinVigil", "kinVerify", "kinResearch"];
export function handleKinAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, ui = {}, showMenu, closeMenu, renderMenu, save, toast, rebuildUI } = ctx,
    id = el?.dataset?.id || "";
  if (!e?.kin) return true;
  const stay = (ok) => {
    if (ok) save();
    renderMenu();
  };
  if (action === "kinGift") {
    const [p, item] = id.split("|");
    stay(e.giveGift(p, item));
  } else if (action === "kinPartnerGive") {
    const [p, item] = id.split("|");
    stay(e.partnerGive(p, item));
  } else if (action === "kinMark") {
    const w = e.whereNow(id);
    if (w.away) return true;
    const target = { region: w.region, x: Math.round(w.x), y: Math.round(w.y), label: e.kinName(id) };
    e.guidance.focus = null;
    e.guidance.target = { ...target };
    if (e.d) e.d.track = null;
    if (e.b) e.b.track = null;
    if (rebuildUI) rebuildUI.target = e.guidance.target;
    if (e.s.region === target.region) {
      closeMenu();
      toast?.("金色路标：" + target.label + "。");
    } else showMenu("map", { selected: target.region });
  } else if (action === "kinTalkTo") {
    ui.kinOut = null;
    showMenu("outpost", { view: "kinHeart", id });
  } else if (action === "kinHeartPick") {
    const [p, i] = id.split(":");
    const out = e.heartPick(p, Number(i) || 0);
    if (out) ui.kinOut = { id: p, out };
    stay(!!out);
  } else if (action === "kinConfess") {
    const [p, yes] = id.split(":");
    if (e.confess(p, yes === "yes")) {
      save();
      closeMenu();
    } else renderMenu();
  } else if (action === "kinFeast") stay(e.feast());
  else if (action === "kinKid") {
    if (e.kidDecide(id === "yes")) {
      save();
      closeMenu();
    } else renderMenu();
  } else if (action === "kinKidLearn") {
    const [k, m] = id.split(":");
    stay(e.kidLearn(k, m));
  } else if (action === "kinSwap") stay(e.seedSwap());
  else if (action === "kinVigil") stay(e.vigilRead());
  else if (action === "kinVerify") stay(e.verifyWater(id));
  else if (action === "kinResearch") stay(e.researchFish(id));
  return true;
}
