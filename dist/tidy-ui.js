// v0.26.0「整顿」的界面：每样设施按 E 打开的那一页、居民的心情三档、出货箱的挂牌和明天的行情、
// 机床加急、长夜的倒计时和警钟、警报栏里的五样事、旧档整顿清单、队员卡上的带徒和改学职能。
import { ITEMS, BUILDINGS } from "./data.js";
import { ALERT_HOOKS } from "./winter-ui.js";
import { RESIDENT_HOOKS } from "./people-hooks.js";
import { HELPER_ROLES, SPOTS } from "./outpost-data.js";
import { CRAFTS, SKILL_NAMES, SSPOTS, FEST_HOURS, CANTEEN_HOURS } from "./seasons-data.js";
import { HEAT, WINTER, DECREES } from "./winter-data.js";
import { CROWS } from "./garden-data.js";
import { FSPOTS } from "./farlands-data.js";
import { lnHud } from "./longnight-ui.js";
import { LISTING, MOOD_FACTORS, TIER_NAMES, INSPIRE, INSPIRE_TRUST, LN_PACE, LURE, KIT_TYPES, DECREE_MOOD, RETRAIN, TRAP_ALL } from "./tidy-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") =>
  `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const act = (a, id, label, reason, primary = false) => button(a, id, label, reason ? `disabled title="${esc(reason)}"` : primary ? 'class="primary"' : "") + (reason ? `<small class="story-lack">${esc(reason)}</small>` : "");
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " " + n)
    .join("、");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const span = (m) => {
  const h = Math.floor(m / 60),
    r = Math.max(0, Math.round(m % 60));
  return (h ? h + " 小时 " : "") + r + " 分";
};
const stock = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);

// ================= 设施卡：按 E 打开的那一页 =================
const ROOM_KIND = ["floor", "chair", "lamp", "bookshelf", "table", "harvestTrophy"];
function roomOf(e, b) {
  if (!e.roomInfo) return null;
  if (b.type === "floor") return e.roomInfo(b);
  const floor = e.s.buildings.filter((x) => x.type === "floor" && x.hp > 0 && dist(x, b) < 75).sort((a, c) => dist(a, b) - dist(c, b))[0];
  return floor ? e.roomInfo(floor) : null;
}
function cardLines(e, b) {
  const t = b.type,
    farm = e.s.region === "farm",
    out = [],
    p = (text, cls = "") => out.push(`<p${cls ? ` class="${cls}"` : ""}>${esc(text)}</p>`),
    raw = (html) => out.push(html);
  if (t === "solar") {
    p("营地的电：" + Math.floor(e.c.energy || 0) + " / 100。现在：" + (e.automationStatus?.(b) || "白天发电中") + "。");
    p("白天 06:00–18:30 每小时发 3 电（高温 5、暴雨 1），夜里停。电用在：无人机（每收一块田 2 电）、噪声信标（拉一次 " + LURE.power + " 电）。", "muted");
  } else if (t === "drone") {
    p("现在：" + (e.automationStatus?.(b) || "") + "。");
    p("每小时收 300 步内一块熟了的田、照原样补种，用 2 电；收 " + (e.droneServiceLimit?.() || 10) + " 次要用 1 个零件保养。", "muted");
    raw(`<div class="button-row">${act("serviceAutomation", b.id, "保养（零件 1）", !farm ? "回到农场再保养" : !b.wear ? "刚保养过" : stock(e, "parts") < 1 ? "没有零件" : "")}</div>`);
  } else if (t === "irrigation") {
    const near = e.s.plots.filter((q) => (q.region || "farm") === "farm" && q.crop && dist(q, b) < 300);
    p("现在：" + (e.automationStatus?.(b) || "") + "。");
    p("每小时给 300 步内没浇水的田浇水。范围里种着 " + near.length + " 块，还没浇的 " + near.filter((q) => !e.plotWatered(q)).length + " 块。", "muted");
  } else if (t === "greenhouse") {
    const near = e.s.plots.filter((q) => (q.region || "farm") === "farm" && dist(q, b) < 220);
    p("220 步内的田不怕天气：护着 " + near.length + " 块（种着 " + near.filter((q) => q.crop).length + " 块）。寒潮里 " + HEAT.greenhouse + " 步内也算暖区。");
  } else if (t === "bed") {
    const cap = e.residentsCapacity(),
      n = e.c.residents.length;
    p("床位 " + cap + "，住了 " + n + " 人。" + (n > cap ? "有 " + (n - cap) + " 人没有床：他们不干活，心情 −10。" : "每个人都有床。"));
  } else if (t === "tower") {
    const on = e.mannedTowers?.().has(b.id);
    p(on ? "有人守：塔顶的灯亮着，看见感染者就开火。" : "没人守：这座塔不开火。到居民页给谁排上守卫岗（要吃上工作餐、有床、不太累）。", on ? "gold" : "story-lack");
    p("每 1.8 秒打一发（伤害 26），射程 320，每发用 1 份弹药（仓库和身上一共 " + stock(e, "ammo") + " 份）。能上岗的守卫 " + (e.readyGuards?.() ?? 0) + " 人；守卫比塔少时，多出来的塔没人守。", "muted");
    if (e.c.residents.some((r) => e.inspired?.(r, "guard"))) p("今晚有人眼尖：瞭望塔伤害 +50%。", "gold");
  } else if (t === "lure") {
    const left = e.pulledLure?.()?.id === b.id ? e.lureLeft() : 0;
    if (left > 0) p("正在响：还有 " + left + " 秒。附近的感染者都往这边走。", "gold");
    p("拉响以后一分钟里，" + LURE.r + " 步内的感染者往信标走（离你 " + LURE.near + " 步以内的还是冲你来；头目和灰隼团不理）。要 " + LURE.power + " 电，没电就拿 " + LURE.part + " 个零件当电池。信标边上摆陷阱最划算。", "muted");
    raw(`<div class="button-row">${act("tdLure", b.id, "拉响信标", e.pullLureReason?.(b.id) || "", true)}</div>`);
  } else if (t === "repairpost") {
    const r = e.td?.repair;
    p("只在尸潮、灰隼团袭击、长夜里修：每 8 秒给 200 步内一处受损的设施修 12 耐久，用 1 份木材。平时不耗木头。居民修设施时每次多修 15。");
    if (r?.on) p("这一场到现在：修了 " + r.hp + " 耐久，用了 " + r.wood + " 份木材。", "gold");
    else if (r?.day) p("上一场（第 " + r.day + " 天）：修了 " + r.hp + " 耐久，用了 " + r.wood + " 份木材。", "muted");
    else p("还没在打仗时用过。", "muted");
  } else if (t === "coop") {
    const a = e.c.animals || {},
      ready = itemsText(a.ready);
    p((a.chicken ? "有鸡" : "还没有鸡（去居民区把走失的鸡救回来）") + (a.goat ? " · 有山羊" : "") + " · " + (a.feedDay === e.s.day ? "今天喂过了" : "今天还没喂（玉米 " + (a.goat ? 3 : 1) + " 份，或 3 份草料顶 1 份玉米）") + "。");
    p("待领：" + (ready || "没有") + "。鸡蛋做早餐，羊奶加玉米做奶粥，也会进每日订单。", "muted");
    raw(`<div class="button-row">${act("feedAnimals", "", "喂食", !farm ? "回到农场再喂" : !a.chicken ? "还没有鸡" : a.feedDay === e.s.day ? "今天喂过了" : "")}${act("collectAnimals", "", "领取产出", !farm ? "回到农场再领" : !ready ? "还没有产出" : "")}</div>`);
  } else if (ROOM_KIND.includes(t)) {
    const room = roomOf(e, b);
    if (!room) p("附近没有地板：铺一块地板，75 步内放木椅和暖光灯，才算一间房。");
    else if (!room.active) p("这间房还没成形：地板 75 步内要有木椅和暖光灯。");
    else p("这间是" + room.type + "。有一间布置好的房间，居民该有的心情 +" + MOOD_FACTORS.room.v + "，歇着时疲劳降得快一倍。", "gold");
    p("阿禾喜欢休息室，许医生喜欢食堂（加餐桌），陈工喜欢阅览室（加书架）。", "muted");
    raw(`<div class="button-row">${button("rOpen", "frontier:rooms", "房间与家具")}</div>`);
  } else if (t === "stove") {
    const wi = e.w?.winter,
      cold = wi && ["prep", "cold"].includes(wi.phase);
    p("寒潮里每天 06:00 烧 " + (WINTER?.stoveFuel || 2) + " 份木材，" + HEAT.stove + " 步内是暖区；农舍和援建营地在暖区里，生活水准才算“住得暖”。");
    p(cold ? (wi.lit ? "今天点着了。" : "熄着：缺木材，明早 06:00 再烧。") : "现在不是寒潮，不烧柴。", cold && !wi.lit ? "story-lack" : "muted");
  } else if (t === "scarecrow") {
    const near = e.s.plots.filter((q) => q.crop && dist(q, b) <= CROWS.radius);
    p(CROWS.radius + " 步内熟了的菜乌鸦不来啄：护着 " + near.length + " 块种着菜的田。");
  } else if (t === "trap") {
    p("所有感染者踩上去都挨 " + Math.round((e.level("manufacturing") >= 5 ? TRAP_ALL.hitLv5 : TRAP_ALL.hit) * TRAP_ALL.mult) + " 下（头目只吃一半），灰隼团一半机会认出来绕开。踩一次掉 " + TRAP_ALL.wear + " 耐久。");
  }
  if (KIT_TYPES.includes(t) && b.hp < (BUILDINGS[t]?.hp || 0)) {
    const n = stock(e, "repairKit");
    raw(`<div class="button-row">${act("tdKit", b.id, "用修理包修满（有 " + n + " 个）", e.kitReason?.(b) || "")}</div>`);
  }
  return out;
}
export function buildingExtras(e, b) {
  if (!e?.td || !b || !BUILDINGS[b.type]) return "";
  const lines = cardLines(e, b);
  return lines.length ? `<section class="td-card">${lines.join("")}</section>` : "";
}

// ================= 居民卡：心情三档 =================
const TIER_DO = {
  low: "每个钟点四成机会歇着，每天一成机会闹情绪不干",
  normal: "照常干活",
  high: "每个钟点两成五机会多干一件，早上可能来劲",
};
RESIDENT_HOOKS.push((e, r) => {
  if (!e?.td || !r || !e.moodTier) return "";
  const tier = e.moodTier(r),
    m = Math.round(r.morale ?? 60),
    target = e.moodTarget(r),
    name = e.residentName(r.id);
  const facs = e.moodFactors(r).sort((a, b) => Math.abs(b.v) - Math.abs(a.v));
  const why = facs.length ? facs.map((f) => `<li class="${f.v > 0 ? "up" : "down"}">${f.v > 0 ? "+" : "−"}${Math.abs(f.v)} ${esc(f.text)}</li>`).join("") : "<li>没什么特别高兴或不高兴的</li>";
  const kind = e.inspireKind(r),
    I = INSPIRE[kind],
    trust = e.ss?.trust?.[r.id] || 0;
  const insp = e.inspired(r)
    ? `<p class="td-insp gold">今天来劲了：${esc(I.name)}——${esc(I.text)}。</p>`
    : trust >= INSPIRE_TRUST
      ? `<p class="td-insp">来劲的时候：${esc(I.name)}——${esc(I.text)}（心情高昂才会来）。</p>`
      : `<p class="td-insp muted">信任到 ${INSPIRE_TRUST}，${esc(name)}会告诉你他来劲时是什么样。</p>`;
  const strike = e.striking(r) ? `<p class="story-lack">今天闹情绪，不干活（打仗时守卫还会上岗）。</p>` : "";
  return `<div class="td-mood ${tier}"><p><b>心情 ${TIER_NAMES[tier]}</b> · 士气 ${m}，明天往 ${target} 走 · ${TIER_DO[tier]}</p><ul class="td-why">${why}</ul>${strike}${insp}</div>`;
});

// ================= 警报栏：节庆、食堂、借宿、营火、商队，还有贺满仓的期限和长夜的警钟 =================
ALERT_HOOKS.push((e, add) => {
  if (!e?.td) return;
  const day = e.s.day,
    m = e.s.minute,
    farm = (spot, label) => (spot ? { region: "farm", x: spot.x, y: spot.y + 30, label } : null);
  if (e.ln?.night && e.s.region === "farm" && !e.lnBellReason()) add(1, "可以敲警钟提前叫下一波", "gold", farm(LN_PACE.bell, "警钟"));
  const due = e.hemcDue?.();
  if (due) {
    if (due.late > 0) add(1, "贺满仓的账逾期 " + due.late + " 天", "danger", farm(FSPOTS.hemc, "贺满仓的账桌"));
    else if (due.due - day <= 1) add(3, (due.due === day ? "今天" : "明天") + "要还贺满仓一期", "warn", farm(FSPOTS.hemc, "贺满仓的账桌"));
  }
  if (!e.ss) return;
  if (e.festivalsOpen?.() && e.isFestivalDay?.() && !e.festivalHosted?.() && m < FEST_HOURS[1]) add(3, m < FEST_HOURS[0] ? "今天节庆 · 16:00 开始" : "节庆开着 · 前哨广场", "gold", farm(SSPOTS.plaza, "前哨广场 · 节庆"));
  if (e.canteenOpen?.() && e.isCanteenDay?.() && e.ss.canteen?.lastDay !== day && m < CANTEEN_HOURS[1]) add(4, m < CANTEEN_HOURS[0] ? "今晚食堂营业 · 19:00" : "食堂营业中", "normal", farm(SSPOTS.plaza, "前哨广场 · 食堂"));
  if (e.ss.lodger?.phase === "asking") add(3, e.ss.lodger.name + "想借宿（23:00 前答复）", "gold", farm(SSPOTS.gate, "营门 · 借宿的人"));
  if (e.talkReason && !e.talkReason()) add(4, "营火边有 " + e.talkPeople().length + " 个人", "normal", farm(e.fireSpot?.(), "营火夜谈"));
  if (e.caravanHere?.()) add(4, "唐九的商队在营地", "gold", farm(SPOTS.caravan, "唐九的商队"));
});

// ================= 顶上的横幅：长夜里下一波还有几秒 =================
export function tidyLnHud(e) {
  const base = lnHud(e),
    N = e?.lnInfo?.()?.night;
  if (!base || !N || !e.td) return base;
  const nx = N.next,
    next = nx ? " · " + (nx.what === "wave" ? "第 " + nx.k + " 波" : N.bossName) + (nx.secs > 0 ? " " + nx.secs + " 秒后" : "就到") : "";
  return { ...base, banner: "⚠ 长夜 · 第 " + N.wave + "/3 波 · 还剩 " + N.left + " 只" + next + (N.bell ? " · 可以敲警钟" : "") + " · 天亮还有 " + span(N.dawn) };
}

// ================= 出货箱：挂牌三格 =================
function listingBlock(e) {
  const t = e.td;
  if (!t) return "";
  const farm = e.s.region === "farm";
  const goods = Object.keys(ITEMS)
    .filter((id) => ITEMS[id].sell > 0 && !ITEMS[id].protected && LISTING.types.includes(ITEMS[id].type) && !e.isWorn?.(id) && stock(e, id) > 0)
    .sort((a, b) => e.listPrice(b) - e.listPrice(a));
  const rows = t.listing
    .map((l) => `<div class="ship-row td-listed"><div><b>${esc(ITEMS[l.item]?.name || l.item)} ×${l.qty}</b><small>每件 ${e.listPrice(l.item)} 金币</small></div><div class="ship-actions">${button("tdUnlist", l.id, "取下")}</div></div>`)
    .join("");
  const free = LISTING.slots - t.listing.length;
  const form =
    free > 0 && goods.length
      ? `<div class="td-list-form"><label>挂什么 <select id="td-list-item">${goods.map((id) => `<option value="${id}">${esc(ITEMS[id].name)}（有 ${stock(e, id)} · 每件 ${e.listPrice(id)}）</option>`).join("")}</select></label><label>几件 <input id="td-list-qty" type="number" min="1" max="${LISTING.max}" value="5"></label>${button("tdList", "", "挂上", farm ? 'class="primary"' : 'disabled title="回到农场再挂牌"')}</div>`
      : free > 0
        ? '<p class="muted">没有能挂的东西。</p>'
        : "";
  const log = t.listLog.length ? `<ul class="ledger">${t.listLog.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : "";
  return `<section class="td-listing"><h3>挂牌 · ${t.listing.length}/${LISTING.slots} 格</h3><p class="muted">白天 06:00–22:00 有人路过：每 90 分钟卖出一件，按卖价的 1.25 倍，钱直接入账，三格轮着卖。比出货箱慢，但卖得贵。每格最多 ${LISTING.max} 件。</p>${rows}${form}${log}</section>`;
}

// ================= 机床：加急 =================
function latheBlock(e) {
  const o = e.o;
  if (!o?.lathe?.mode || !e.td) return "";
  const t = e.td.lathe,
    jam = t.jam >= e.s.day,
    on = t.rush === e.s.day;
  const state = jam ? `<p class="story-lack">机床卡着料：今天歇一天。</p>` : on ? `<p class="gold">说好了：今晚 18:00 加急，多做一批。</p>` : "";
  const btn = on || jam ? button("tdRush", "", "今晚加急", "disabled") : act("tdRush", "", "今晚加急", e.latheRushReason(), true);
  return `<section class="td-rush"><h3>今晚加急</h3><p>18:00 照现在选的多做一批（多用一批料）。两成会卡料，卡了第二天歇一天。</p>${state}<div class="button-row">${btn}</div></section>`;
}

// ================= 法令簿：这条让谁不高兴 =================
function patchDecrees(e, html) {
  const names = e.c.residents.map((r) => e.residentName(r.id));
  for (const [id, key] of Object.entries(DECREE_MOOD)) {
    const d = DECREES[id],
      f = MOOD_FACTORS[key];
    if (!d || !f) continue;
    const mark = "<h3>" + esc(d.name) + "</h3>";
    const at = html.indexOf(mark);
    if (at < 0) continue;
    const who = id === "injured" ? e.c.residents.filter((r) => r.id !== "medic").map((r) => e.residentName(r.id)) : names;
    const text = who.length ? "让谁不高兴：" + who.join("、") + "，心情 −" + Math.abs(f.v) + (id === "injured" && names.length > who.length ? "（许医生不受影响）" : "") + (id === "winterStore" ? "（只在寒潮里）" : "") : "营地里还没有居民，没人不高兴";
    html = html.slice(0, at + mark.length) + `<p class="td-who">${esc(text)}</p>` + html.slice(at + mark.length);
  }
  return html;
}

// ================= 日终总结：营地整顿的清单 =================
function patchSummary(e, html) {
  const cv = e.td?.converted,
    r = e.o?.report;
  if (!cv || !r || r.day !== cv.day) return html;
  const block = `<section class="td-converted"><h4>营地整顿</h4><ul>${cv.notes.map((x) => `<li>${esc(x)}</li>`).join("")}</ul><p class="muted">退的材料都在仓库里。</p></section>`;
  const at = html.indexOf("<h4>今天要留意</h4>");
  return at > 0 ? html.slice(0, at) + block + html.slice(at) : html + block;
}

// ================= 长夜战报：陷阱、瞭望塔各打倒几只 =================
function patchNightReport(e, html) {
  const r = e.ln?.last,
    t = e.td?.night,
    bell = e.td?.bell;
  if (!r || !t || t.day !== r.day) return html;
  const def = t.trap + t.tower,
    pct = r.kills ? Math.round((def / r.kills) * 100) : 0;
  const line = `<p class="td-defense">陷阱打倒 ${t.trap} 只，瞭望塔打倒 ${t.tower} 只${r.kills ? "（防线占全晚的 " + pct + "%）" : ""}。${bell?.day === r.day && bell.early ? "敲了 " + bell.early + " 次警钟，多 " + bell.early + " 次稀有掉落。" : ""}</p>`;
  const at = html.indexOf("</dl>");
  return at > 0 ? html.slice(0, at + 5) + line + html.slice(at + 5) : html + line;
}

// ================= 队员卡：带徒、改学职能 =================
function crewBlock(e, id) {
  const c = (e.o?.crew || []).find((x) => x.id === id);
  if (!c || !e.td || !e.ss) return "";
  const a = e.ss.apprentice,
    t = e.td.retrain;
  const bar = (start, days) => {
    const d = Math.min(days, Math.max(0, e.s.day - start));
    return `<div class="td-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${days}" aria-valuenow="${d}"><span style="width:${Math.round((d / days) * 100)}%"></span></div><small>第 ${d}/${days} 天</small>`;
  };
  if (t && t.pupil === c.id) {
    const m = e.retrainMasters?.(t.role).find((x) => x.id === t.master)?.name || e.residentName(t.master);
    return `<section class="td-crew"><h3>改学职能</h3><p>${esc(m)}在带${esc(c.name)}学${esc(HELPER_ROLES[t.role])}：出师后改做${esc(HELPER_ROLES[t.role])}。这几天加工慢一成，师父每天更累一点。</p>${bar(t.start, RETRAIN.days)}<div class="button-row">${button("tdRetrainStop", "", "停下")}</div></section>`;
  }
  if (a && a.pupil === c.id)
    return `<section class="td-crew"><h3>学手艺</h3><p>${esc(e.residentName(a.master))}在带${esc(c.name)}学${esc(SKILL_NAMES[a.skill])}。</p>${bar(a.start, 3)}<div class="button-row">${button("sApprentice", "stop", "中断带徒")}</div></section>`;
  const busy = a || t ? "已经有人在带徒弟了（一次只带一个）" : "";
  const learned = e.ss.skills?.[c.id];
  const crafts = Object.entries(CRAFTS)
    .filter(([m]) => e.resident(m))
    .map(([m, cr]) => `<article><h4>跟${esc(e.residentName(m))}学${esc(cr.name)}</h4><p class="muted">${esc(cr.desc)}</p>${act("sApprentice", m + ":" + c.id, "开始带徒", busy || (learned ? "已经学会" + SKILL_NAMES[learned] : e.apprenticeReason(m, c.id)))}</article>`)
    .join("");
  const roles = Object.entries(HELPER_ROLES)
    .filter(([role]) => role !== c.role)
    .map(([role, name]) => {
      const masters = (e.retrainMasters?.(role) || []).filter((x) => x.id !== c.id);
      return `<article><h4>改做${esc(name)}</h4><p class="muted">${masters.length ? "师父：" + esc(masters[0].name) : "营地里没有会" + esc(name) + "的人"}</p>${act("tdRetrain", c.id + ":" + role, "开始改学", busy || e.retrainReason(c.id, role))}</article>`;
    })
    .join("");
  return `<section class="td-crew"><h3>带徒</h3><p class="muted">${RETRAIN.days} 天：学一门手艺，或者把职能换掉（搬运跟阿禾学、工程跟陈工学、侦察和守卫跟同行学）。带徒期间加工慢一成，师父更累。</p>${learned ? `<p>已经学会：${esc(SKILL_NAMES[learned])}。</p>` : ""}<div class="story-choice td-crew-grid">${crafts}${roles}</div></section>`;
}

// ================= 串起来 =================
export function patchTidyView(e, ui, html) {
  if (!e?.td || !ui) return html;
  if (ui.view === "shipping") return html + listingBlock(e);
  if (ui.view === "lathe") {
    const at = html.indexOf('<div class="story-choice">');
    const block = latheBlock(e);
    return at > 0 ? html.slice(0, at) + block + html.slice(at) : html + block;
  }
  if (ui.view === "decrees") return patchDecrees(e, html);
  if (ui.view === "summary") return patchSummary(e, html);
  if (ui.view === "lnight") return patchNightReport(e, html);
  if (ui.view === "crew") return html + crewBlock(e, ui.id);
  return html;
}

const ACTIONS = ["tdList", "tdUnlist", "tdLure", "tdKit", "tdRush", "tdRetrain", "tdRetrainStop"];
export function handleTidyAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, renderMenu, save } = ctx,
    id = el.dataset.id || "";
  if (!e?.td) return true;
  let ok = false;
  if (action === "tdList") {
    const root = el.closest?.(".modal") || (typeof document !== "undefined" ? document : null),
      item = root?.querySelector("#td-list-item")?.value,
      n = Number(root?.querySelector("#td-list-qty")?.value);
    ok = e.listItem(item, n);
  } else if (action === "tdUnlist") ok = e.unlistItem(id);
  else if (action === "tdLure") ok = e.pullLure(id);
  else if (action === "tdKit") ok = e.useKitOn(id);
  else if (action === "tdRush") ok = e.latheRush();
  else if (action === "tdRetrain") {
    const [pupil, role] = id.split(":");
    ok = e.startRetrain(pupil, role);
  } else if (action === "tdRetrainStop") ok = e.stopRetrain();
  renderMenu();
  if (ok) save();
  return true;
}
