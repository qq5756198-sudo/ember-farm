// v0.27.0「丰年」的界面：水网那一页、堆肥桶、订单板；这块田的卡片上的肥、抢收、多次收获、巨型、杂交、被偷被踩；
// 选种页的神秘种子包；菜地告示牌上的“今天的水”、要留意的事和菜地图鉴；照看机、喷灌头、温室、鸡舍、太阳能板的设施卡；
// 居民卡上“替你看着田”；警报栏里的夜袭、天灾、寒潮、订单、堆肥、鸡。
import { ITEMS, BUILDINGS, CROPS } from "./data.js";
import { ALERT_HOOKS } from "./winter-ui.js";
import { RESIDENT_HOOKS } from "./people-hooks.js";
import { buildingExtras as tidyExtras } from "./tidy-ui.js";
import { cropName } from "./garden-data.js";
import { WATER, FERTS, FERT_IDS, COMPOST, REGROW, GIANT, DEX_CROPS, DEX, RAID, THEFT, STORM, ORDERS, CHICKENS, DRONE, RIPE_WAIT, GREENHOUSE_R, ECO_HELP } from "./bounty-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const act = (a, id, label, reason, primary = false) => button(a, id, label, reason ? `disabled title="${esc(reason)}"` : primary ? 'class="primary"' : "") + (reason ? `<small class="story-lack">${esc(reason)}</small>` : "");
const itemsText = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => (ITEMS[id]?.name || id) + " ×" + n)
    .join("、");
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const stock = (e, id) => (e.s.inventory[id] || 0) + (e.s.storage[id] || 0);
const clock = (m) => {
  const t = Math.round(m);
  return String(Math.floor(t / 60) % 24).padStart(2, "0") + ":" + String(t % 60).padStart(2, "0");
};
const ripeOf = (p) => !!p?.crop && !!CROPS[p.crop] && p.growth >= CROPS[p.crop].grow;
const FIELD = { region: "farm", x: 495, y: 528, label: "菜地" };
const third = (c) => (GIANT.crops.includes(c) ? "giant" : REGROW.crops.includes(c) ? "thrice" : "combo");
const THIRD_NAME = { giant: "长出一棵巨型", thrice: "一茬收满 3 次", combo: "一口气连收 " + DEX.combo + " 块" };
const STORM_NAME = { acid: "酸雨", storm: "暴雨", frost: "打霜" };
const HOW_TO = {
  trough: "修好旧水井（联盟的活）就有水槽",
  canal: "在水渠页把水渠挖通到农田",
  sprinkler: "建喷灌头（研究“自动灌溉”）",
  barrel: "建雨水桶",
  tower: "公共重建里修好水塔",
};

// ================= 水网 =================
function viewWater(e) {
  const L = e.netLine(),
    n = e.bt.net,
    src = e.netSources(),
    routes = e.netRoutes(),
    today = n.day === e.s.day;
  const head = `<header class="bt-head"><div><small>第 ${e.s.day} 天 · ${esc(e.s.weather)}</small><h3>今天的水够浇 ${L.can} 块，你种了 ${L.planted} 块</h3><p>种着的田里，水网管得到 ${L.covered} 块。${today ? "已经浇掉 " + L.used + " 份，还剩 " + L.pool + " 份。" : "今天还没出水：00:00 各水源出水，按下面的顺序浇。"}</p></div></header>`;
  const notes = [];
  if (L.rain) notes.push(`<p class="g-good">今天下雨：田都算浇过，水网的水留着（存得下的带到明天）。</p>`);
  if (today && L.missed) notes.push(`<p class="story-lack">有 ${L.missed} 块排在后面没浇上：水不够。把要紧的那一路往上挪，或者多建雨水桶、修水塔；也能自己提壶去浇。</p>`);
  if (!src.length) notes.push(`<p class="story-lack">还没有水源：修好旧水井、建雨水桶、修好水塔、挖通水渠都行。没有水源的田要你自己浇。</p>`);
  const srcRows = src.map((x) => `<tr><th>${esc(x.name)}</th><td>${x.made} 份</td><td>${x.store ? x.store + " 份" : "—"}</td></tr>`).join("");
  const srcTable = src.length
    ? `<div class="g-table"><table><thead><tr><th>水源</th><th>今天出水</th><th>能存</th></tr></thead><tbody>${srcRows}</tbody></table></div><p class="muted">每天 00:00 出水。昨天没用完的最多存 ${L.cap} 份，多的流走。雨水桶下雨天出 ${WATER.barrel.rain} 份、高温天不出水；水塔高温天少出；水渠在“蓄水”时是一个 ${WATER.canal.store} 份的蓄水池。${e.f?.species?.includes("egret") ? "白鹭回来了：水渠每天多出 " + ECO_HELP.egret + " 份。" : ""}</p>`
    : "";
  const order = n.order
    .map((kind, i) => {
      const mine = routes.filter((r) => r.kind === kind),
        plots = new Set(mine.flatMap((r) => r.plots.map((p) => p.id))),
        planted = mine.flatMap((r) => r.plots).filter((p) => p.crop);
      const have = mine.length > 0 || (kind === "sprinkler" && e.s.buildings.some((b) => b.type === "irrigation" && b.hp > 0));
      const what = have ? (kind === "sprinkler" && !mine.length ? "喷灌头都关着" : "管 " + plots.size + " 块（种着 " + new Set(planted.map((p) => p.id)).size + " 块）") : HOW_TO[kind];
      return `<li class="${have ? "" : "off"}"><span class="bt-no">${i + 1}</span><span class="bt-route"><b>${esc(WATER.names[kind])}</b><small>${esc(what)}</small></span><span class="bt-move">${button("btNet", kind + ":-1", "↑", i === 0 ? 'disabled aria-label="往前挪"' : 'aria-label="往前挪"')}${button("btNet", kind + ":1", "↓", i === n.order.length - 1 ? 'disabled aria-label="往后挪"' : 'aria-label="往后挪"')}</span></li>`;
    })
    .join("");
  const sprinklers = e.s.buildings.filter((b) => b.type === "irrigation" && b.hp > 0);
  const sprRows = sprinklers.length
    ? `<section><h3>喷灌头</h3><ul class="bt-list">${sprinklers
        .map((b, i) => {
          const on = !n.off.includes(b.id),
            near = e.s.plots.filter((q) => e.isFarmPlot(q) && dist(q, b) < WATER.sprinkler.r);
          return `<li><span><b>喷灌头 ${i + 1}</b><small>${on ? "开着" : "关着"} · 管 ${near.length} 块（种着 ${near.filter((q) => q.crop).length} 块）</small></span>${button("btSprinkler", b.id, on ? "关上" : "打开")}</li>`;
        })
        .join("")}</ul><p class="muted">喷灌头 06:00–20:00 每个钟点都看一眼：管着的田没浇就从水网取水浇上，所以白天新种下的也能当天喝到水。别的几路只在 00:00 浇一次。</p></section>`
    : "";
  const log = (n.log || []).length ? `<section><h3>前几天</h3><ul class="ledger">${n.log.map((r) => `<li>第 ${r.d} 天：出水 ${r.made} 份，用掉 ${r.used} 份${r.missed ? "，" + r.missed + " 块没浇上" : ""}</li>`).join("")}</ul></section>` : "";
  return `${head}${notes.join("")}<section><h3>水源</h3>${srcTable || '<p class="muted">—</p>'}</section><section><h3>先浇哪一路</h3><p class="muted">水不够时，排在前面的先浇。一块田一份水，丰产作物两份；已经喝到水的不再浇。</p><ol class="bt-routes">${order}</ol></section>${sprRows}${log}<p class="muted">水壶在旧水井、雨水桶边补满不花水网的水；居民浇水也不花。照看机浇水从水网取。</p>`;
}

// ================= 堆肥桶 =================
function viewCompost(e, ui) {
  const id = ui.id,
    b = e.s.buildings.find((x) => x.id === id && x.type === "compost");
  if (!b) return `<p>堆肥桶不在了。</p>`;
  const r = e.bt.compost[id] || { kind: "grow", n: 0, ready: 0, out: 0 },
    F = FERTS[r.kind],
    farm = e.s.region === "farm";
  const state = r.ready ? `正在沤：明早 06:00 出 1 袋${F.name}。` : r.out ? `沤好了 ${r.out} 袋${F.name}，可以取出来。` : `桶里 ${r.n}/${COMPOST.batch} 份，满了过一夜出 1 袋${F.name}。`;
  const kinds = FERT_IDS.map((k) => button("btCompKind", id + "|" + k, FERTS[k].name, r.kind === k ? 'class="primary" aria-pressed="true"' : r.ready ? 'disabled title="已经在沤了，明天再换"' : 'aria-pressed="false"')).join("");
  const stuff = e.compostStuff();
  const left = COMPOST.batch - r.n;
  const rows = stuff.length
    ? `<ul class="bt-list">${stuff
        .map((item) => {
          const why = e.compostReason(id, item),
            k = Math.min(left, stock(e, item));
          return `<li><span><b>${esc(ITEMS[item]?.name || item)}</b><small>有 ${stock(e, item)}</small></span><span class="bt-btns">${button("btCompAdd", id + "|" + item + "|1", "丢 1 份", why ? `disabled title="${esc(why)}"` : "")}${k > 1 ? button("btCompAdd", id + "|" + item + "|" + k, "丢 " + k + " 份", why ? `disabled title="${esc(why)}"` : "") : ""}</span></li>`;
        })
        .join("")}</ul>`
    : `<p class="muted">身上和仓库里没有能沤的：草料（拔草得）、菜青虫（捉虫得）、鸡粪（鸡舍领蛋、放鸡下地时得），多的菜也行。</p>`;
  const take = r.out ? `<div class="button-row">${act("btCompTake", id, "取出 " + r.out + " 袋" + F.name + "（入仓）", farm ? "" : "回到农场再取", true)}</div>` : "";
  const why = r.ready ? "正在沤" : r.out >= COMPOST.max ? "先把沤好的肥取出来" : !farm ? "回到农场再弄" : "";
  return `<header class="bt-head"><div><small>堆肥桶</small><h3>${esc(state)}</h3><p>草料、菜青虫、鸡粪、多的菜丢进去，${COMPOST.batch} 份过一夜出 1 袋肥；最多攒 ${COMPOST.max} 袋没取。</p></div></header>${take}<section><h3>沤成哪种</h3><div class="button-row">${kinds}</div><ul class="bt-ferts">${FERT_IDS.map((k) => `<li><b>${esc(FERTS[k].name)}</b>：${esc(FERTS[k].text)}（有 ${stock(e, FERTS[k].id)} 袋）</li>`).join("")}</ul></section><section><h3>丢进去</h3>${why ? `<p class="story-lack">${esc(why)}。</p>` : rows}</section><p class="muted">施肥：在田边按 E 打开那块田，每一茬能施一袋。</p>`;
}

// ================= 订单板 =================
function viewOrders(e) {
  const o = e.bt.orders,
    day = e.s.day,
    farm = e.s.region === "farm";
  if (day < ORDERS.fromDay) return `<p>订单板第 ${ORDERS.fromDay} 天开始有人来贴单子。</p>`;
  const cards = o.list
    .map((x) => {
      const have = e.orderHave(x.item),
        left = x.due - day;
      const due = left <= 0 ? "今天截止" : left === 1 ? "明天截止" : "还有 " + left + " 天（第 " + x.due + " 天截止）";
      return `<article class="bt-order${left <= 0 ? " due" : ""}"><header><b>${esc(x.name)}</b><small>${esc(due)}</small></header><p>要 <b>${esc(ITEMS[x.item]?.name || x.item)} ×${x.n}</b>（你有 ${have}）</p><p class="bt-pay">报酬：${esc(itemsText(x.pay))}${["farmer", "medic", "mechanic"].includes(x.who) && e.ss?.trust ? " · 信任 +1" : ""}</p><div class="button-row">${act("btOrderGive", x.id, "交单", e.orderReason(x), true)}${button("btOrderTear", x.id, "撕掉", e.tearReason(x.id) ? `disabled title="${esc(e.tearReason(x.id))}"` : "")}</div></article>`;
    })
    .join("");
  const old = (e.c.orders || []).filter((x) => x.accepted && !x.done);
  const oldBlock = old.length
    ? `<section><h3>以前接的订单</h3><div class="bt-orders">${old.map((x) => `<article class="bt-order"><header><b>${esc(x.title)}</b></header><p>${esc(itemsText(x.cost))}</p><p class="bt-pay">${x.money} 金币 · 声望 +${x.rep}</p><div class="button-row">${button("deliverOrder", x.id, "交付", e.afford?.(x.cost) && farm ? 'class="primary"' : "disabled")}</div></article>`).join("")}</div></section>`
    : "";
  return `<header class="bt-head"><div><small>出货箱旁边 · 交过 ${e.bt.stats.orders || 0} 张</small><h3>订单板</h3><p>每天早上补满 ${ORDERS.slots} 张单子，${ORDERS.days[0]}–${ORDERS.days[1]} 天内交。报酬比直接卖多一半，给材料或神秘种子包；阿禾、许医生、陈工的单子还加 1 点信任。每天能撕一张不想要的，明早补新的。</p></div></header>${cards ? `<div class="bt-orders">${cards}</div>` : '<p class="muted">今天的单子都交完或撕掉了，明早补新的。</p>'}${oldBlock}<p class="muted">优质、耐旱的收成也能交。单子要的是你种过的、手上有种子的作物；有鸡的话也会要鸡蛋。</p>`;
}

// ================= 这块田：选种页加神秘种子包 =================
function patchPick(e, ui, html) {
  const p = e.plotById(ui.id),
    n = e.mysteryCount?.() || 0;
  if (!p || p.crop || !n || e.pickReason(p)) return html;
  const line = `<div class="bt-mystery"><div class="button-row">${button("btMystery", p.id, "种一包神秘种子（有 " + n + " 包）", 'class="primary"')}</div><small>拆开才知道：七成是普通作物，两成五带早熟、丰产或耐旱，半成是新品种（金萝卜、冬土豆、夜光豆）。</small></div>`;
  if (html.includes('<ul class="seed-list">')) {
    const at = html.indexOf("</ul>", html.indexOf('<ul class="seed-list">'));
    return html.slice(0, at + 5) + line + html.slice(at + 5);
  }
  const mark = '<p class="story-lack">背包和仓库里都没有种子';
  if (html.includes(mark)) {
    html = html.replace("背包和仓库里都没有种子：", "背包和仓库里没有普通种子：");
    const at = html.indexOf("</p>", html.indexOf('<p class="story-lack">'));
    return html.slice(0, at + 4) + line + html.slice(at + 4);
  }
  return html;
}

// ================= 这块田：卡片上的新东西 =================
function plotBlock(e, p) {
  const r = e.bt.plots[p.id] || {},
    day = e.s.day,
    c = CROPS[p.crop],
    ripe = ripeOf(p),
    lines = [],
    btns = [];
  const li = (text, ok = null) => lines.push(`<li class="${ok === true ? "ok" : ok === false ? "bad" : ""}">${esc(text)}</li>`);
  const g = e.giantOf(p);
  if (g) li("这是巨型" + cropName(g.crop) + "的一角：要锄 " + GIANT.hits + " 下才收得动（已经锄了 " + g.hits + " 下）。收下来一大堆，外加一个能拿去收获展的巨型" + cropName(g.crop) + "。熟着放在地里，夜里会招来感染者。" + (g.lost ? "被踩过：少收 " + g.lost + " 份。" : ""), true);
  if (p.crop === "hybrid") li("杂交苗：" + (r.hy || []).map(cropName).join(" × ") + "。照常浇水，长大收下来是一包种子（七成五是带特性的种子，两成五是新品种）。", true);
  if (REGROW.crops.includes(p.crop)) {
    const k = r.n || 0;
    li("第 " + (k + 1) + " 茬：收完不用重种，从四成长起，还能再收 " + (REGROW.max - k - 1) + " 茬" + (k ? "（这一茬收原来的六成）" : "") + "。", null);
  }
  if (r.fz) li("施了" + FERTS[r.fz].name + "：" + FERTS[r.fz].text + "。", true);
  if (r.st) li("被偷走、打坏了 " + r.st + " 份：收的时候少 " + r.st + " 份。", false);
  if (r.pr && r.pr >= day - 1) li("地上有脚印：夜里有人来偷过。", false);
  if (r.tr === day) li("夜里被感染者踩过：长势退回一半。", false);
  if (r.mh) li("田边有田鼠洞：收的时候少 1 份。", false);
  if (e.dexDone?.(p.crop)) li("图鉴这一行集齐了：收" + cropName(p.crop) + "多 " + DEX.bonus + " 份。", true);
  if (ripe && r.ra && !g) {
    const hrs = Math.floor((e.absNow() - r.ra) / 60);
    if (hrs >= 1) li("熟了 " + hrs + " 个钟点了" + (hrs * 60 >= THEFT.ripe ? "：夜里可能被偷" : hrs * 60 >= RIPE_WAIT ? "：居民会替你收" : "") + "。", hrs * 60 >= THEFT.ripe ? false : null);
  }
  // 水网管不管这块
  const route = e.netRoutes().find((x) => x.plots.some((q) => q.id === p.id));
  li(route ? "水网：" + WATER.names[route.kind] + "管这块" + (route.kind === "sprinkler" ? "（每个钟点看一眼）" : "（每天 00:00 浇）") + "。" : "水网管不到这块：要你自己浇，或者在旁边建喷灌头、雨水桶。", route ? true : null);
  if (e.coldActive?.() && p.crop !== "winterPotato" && !e.inGreenhouse(p)) li("寒潮里：温室 " + GREENHOUSE_R + " 步外的田不长" + (e.w?.winter?.priority === "food" ? "（签了粮食保障，长三成五）" : "") + "。", false);
  const st = e.bt.storm;
  if (st.day === day + 1 && st.kind) li("明天" + STORM_NAME[st.kind] + "：" + (st.kind === "frost" ? "温室外没盖布的长势退回一半" : st.kind === "acid" ? "长过七成又没盖布的少收 1 份" : "熟了没盖布的少收 1 份") + "。今天抢收或者盖布。", false);
  // 按钮：肥、抢收、锄巨型
  if (!g && p.crop !== "hybrid" && !ripe && !r.fz)
    for (const k of FERT_IDS) {
      const why = e.fertReason(p, k);
      btns.push(button("btFert", p.id + "|" + k, "施" + FERTS[k].name + "（有 " + stock(e, FERTS[k].id) + "）", why ? `disabled title="${esc(why)}"` : ""));
    }
  if (!g && p.crop !== "hybrid" && !ripe && c && p.growth / c.grow >= STORM.rush) btns.push(button("btRush", p.id, "现在抢收（" + e.fieldRushPortions(p) + " 份，不出优质）", e.fieldRushReason(p) ? `disabled title="${esc(e.fieldRushReason(p))}"` : ""));
  return `<section class="bt-plot"><ul class="g-today">${lines.join("")}</ul>${btns.length ? `<div class="button-row g-actions">${btns.join("")}</div>` : ""}${!g && p.crop !== "hybrid" && !ripe && !r.fz ? `<p class="muted">肥在堆肥桶里沤：快长肥这一茬长得快三成，提质肥照料分 +${FERTS.care.care}，保水肥浇一次管两天。一茬只能施一袋。</p>` : ""}</section>`;
}
function patchPlot(e, ui, html) {
  const p = e.plotById(ui.id);
  if (!p || !p.crop) return patchPick(e, ui, html);
  const g = e.giantOf(p);
  if (g) html = html.replace(/<button data-action="gHarvest" data-id="([^"]*)"([^>]*)>收获<\/button>/, (m, id, rest) => `<button data-action="btGiant" data-id="${id}"${rest}>锄一下（还要 ${GIANT.hits - g.hits} 下）</button>`);
  const block = plotBlock(e, p),
    at = html.indexOf('<dl class="g-facts">');
  return at > 0 ? html.slice(0, at) + block + html.slice(at) : html + block;
}

// ================= 菜地告示牌：今天的水、要留意的事、图鉴 =================
function warnings(e) {
  const day = e.s.day,
    out = [],
    bt = e.bt;
  const r = bt.raid;
  if (r.state === "warned" && r.day === day) out.push(["bad", "今晚 01:00 菜地夜袭：" + r.n + " 只感染者冲着熟菜来。收菜、修围栏、点灯、留守卫都管用；你在农场醒着就得自己打。"]);
  else if (r.report && r.day >= day - 1) out.push(["", r.report]);
  const st = bt.storm;
  if (st.day === day + 1 && st.kind) out.push(["bad", "明天" + STORM_NAME[st.kind] + "：今天抢收长过七成的菜，或者盖布。"]);
  const cold = e.coldNext?.();
  if (cold?.now) out.push(["bad", "寒潮里：只有温室里的田能长（冬土豆照长），第 " + (cold.day + cold.days) + " 天结束。"]);
  else if (cold && cold.day - day <= 3 && cold.day >= day) out.push(["warn", "第 " + cold.day + " 天寒潮到，持续 " + cold.days + " 天：温室外的田那几天不长，前一晚还会打霜。"]);
  const now = e.absNow();
  const thief = e.farmPlots().filter((p) => ripeOf(p) && bt.plots[p.id]?.ra && now - bt.plots[p.id].ra >= THEFT.ripe - 360 && !bt.plots[p.id]?.gi).length;
  if (day >= THEFT.fromDay && thief) out.push(["warn", thief + " 块菜熟了快一天还没收：夜里可能被人摸走（稻草人、亮着的暖光灯 " + THEFT.guard + " 步内不会）。"]);
  const ripe = e.ripeLong?.() || 0;
  if (day >= RAID.fromDay && ripe > RAID.ripe - 3 && !(r.state === "warned" && r.day === day)) out.push(["warn", "熟了 " + RAID.age / 60 + " 个钟点以上还没收的有 " + ripe + " 块：超过 " + RAID.ripe + " 块，晚上 20:00 会招来夜袭。"]);
  for (const g of Object.values(bt.giants)) out.push(["good", "巨型" + cropName(g.crop) + "长在地里：锄 " + GIANT.hits + " 下就能收；放着夜里会招来感染者。"]);
  const due = bt.orders.list.filter((x) => x.due === day);
  if (due.length) out.push(["warn", "今天截止：" + due.map((x) => x.name + "要的" + (ITEMS[x.item]?.name || x.item) + " ×" + x.n).join("、") + "。"]);
  const comp = Object.values(bt.compost).reduce((a, x) => a + (x.out || 0), 0);
  if (comp) out.push(["good", "堆肥桶里有 " + comp + " 袋肥可以取。"]);
  if (bt.chickens.out) out.push(["", "鸡在田里吃虫拔草，到 " + clock(bt.chickens.until - e.absNow() + e.s.minute) + " 回窝。"]);
  if (bt.daily.day === day && bt.daily.id === "N02") out.push(["warn", "叶子背面爬上了虫：今天的抉择里选一个办法，或者自己去捉。"]);
  if (bt.daily.day === day && bt.daily.id === "N11") out.push(["warn", "田边有田鼠洞：收的时候每块少 1 份。"]);
  if (bt.pumpkin === day) out.push(["good", "田角长出一个大得出奇的南瓜：今天的抉择里决定怎么处理。"]);
  return out;
}
function dexBlock(e) {
  const bt = e.bt;
  let done = 0;
  const rows = DEX_CROPS.filter((c) => CROPS[c])
    .map((c) => {
      const d = bt.dex[c] || {},
        seen = !!(d.h || d.f || d.g),
        variety = !!CROPS[c].variety,
        full = e.dexDone(c);
      if (full) done++;
      const cell = (k, label) => `<td class="${d[k] ? "on" : ""}" title="${esc(label)}">${d[k] ? "第 " + d[k] + " 天" : "—"}</td>`;
      return `<tr class="${full ? "full" : ""}"><th>${esc(variety && !seen ? "新品种 · 还没见过" : cropName(c))}${full ? " ★" : ""}</th>${cell("h", "第一次收获")}${cell("f", "第一次优质")}${cell("g", THIRD_NAME[third(c)])}<td class="muted">${esc(variety && !seen ? "杂交或神秘种子里出" : THIRD_NAME[third(c)])}</td></tr>`;
    })
    .join("");
  return `<section class="bt-dex"><h3>菜地图鉴 · 集齐 ${done}/${DEX_CROPS.length} 行</h3><p class="muted">每种作物三格：第一次收获、第一次优质、第三格（能长巨型的萝卜、土豆、南瓜、玉米是第一次巨型；番茄、豆子是一茬收满 3 次；其余是一口气连收 ${DEX.combo} 块）。一行集齐，这种作物以后每次多收 ${DEX.bonus} 份。</p><div class="g-table"><table><thead><tr><th>作物</th><th>收获</th><th>优质</th><th>第三格</th><th>第三格是</th></tr></thead><tbody>${rows}</tbody></table></div></section>`;
}
export function patchBoard(e, html) {
  if (!e?.bt || !html.includes('<div class="g-board">')) return html;
  const L = e.netLine();
  const warn = warnings(e);
  const water = `<section class="bt-water"><h3>今天的水够浇 ${L.can} 块，你种了 ${L.planted} 块</h3><p>${L.rain ? "今天下雨：田都算浇过。" : L.covered ? "种着的田里，水网管得到 " + L.covered + " 块" + (L.missed && L.made ? "；有 " + L.missed + " 块排在后面没浇上。" : "。") : L.planted ? "种着的田水网都管不到：要你自己浇。" : "还没种菜。"}${L.pool > 0 && !L.rain ? "水网里还剩 " + L.pool + " 份。" : ""}</p>${warn.length ? `<ul class="bt-warn">${warn.map(([cls, t]) => `<li class="${cls}">${esc(t)}</li>`).join("")}</ul>` : ""}<div class="button-row">${button("bView", "bWater", "水网：水源和先浇哪一路")}${e.s.day >= ORDERS.fromDay ? button("bView", "bOrders", "订单板 · " + e.bt.orders.list.length + " 张") : ""}</div></section>`;
  html = html.replace('<div class="g-board">', '<div class="g-board">' + water);
  const tail = html.lastIndexOf('<div class="button-row">');
  const dex = dexBlock(e);
  return tail > 0 ? html.slice(0, tail) + dex + html.slice(tail) : html + dex;
}

// ================= 设施卡 =================
function card(lines) {
  return `<section class="td-card bt-card">${lines.join("")}</section>`;
}
const P = (text, cls = "") => `<p${cls ? ` class="${cls}"` : ""}>${esc(text)}</p>`;
export function buildingExtras(e, b) {
  if (!e?.bt || !b || !BUILDINGS[b.type]) return tidyExtras(e, b);
  const farm = e.s.region === "farm",
    t = b.type;
  if (t === "drone") {
    const near = e.s.plots.filter((q) => e.isFarmPlot(q) && q.crop && dist(q, b) < DRONE.r);
    return card([
      P("现在：" + (e.automationStatus?.(b) || "") + "。"),
      P("范围里种着 " + near.length + " 块。营地的电 " + Math.floor(e.c.energy || 0) + "/100，水网里还有 " + e.bt.net.pool + " 份水。你在农场时它只照看、浇水、捉虫、拔草，熟了的菜留给你收。", "muted"),
      `<div class="button-row">${act("serviceAutomation", b.id, "保养（零件 1）", !farm ? "回到农场再保养" : !b.wear ? "刚保养过" : stock(e, "parts") < 1 ? "没有零件" : "")}</div>`,
    ]);
  }
  if (t === "irrigation") {
    const on = !e.bt.net.off.includes(b.id),
      near = e.s.plots.filter((q) => e.isFarmPlot(q) && q.crop && dist(q, b) < WATER.sprinkler.r);
    return card([
      P("现在：" + (e.automationStatus?.(b) || "") + "。", on ? "" : "story-lack"),
      P("06:00–20:00 每个钟点看一眼。范围里种着 " + near.length + " 块，还没喝到水的 " + near.filter((q) => !e.plotWatered(q)).length + " 块。", "muted"),
      `<div class="button-row">${button("btSprinkler", b.id, on ? "关上" : "打开", on ? "" : 'class="primary"')}${button("bView", "bWater", "水网")}</div>`,
    ]);
  }
  if (t === "greenhouse") {
    const near = e.s.plots.filter((q) => e.isFarmPlot(q) && dist(q, b) < GREENHOUSE_R),
      cold = e.coldNext?.();
    return card([
      P(GREENHOUSE_R + " 步内的田不怕天气，长得快一成：护着 " + near.length + " 块（种着 " + near.filter((q) => q.crop).length + " 块）。"),
      P(cold?.now ? "寒潮里：只有这里面的田在长。" : cold ? "第 " + cold.day + " 天寒潮到：那几天只有温室里的田能长（冬土豆照长），寒潮前一晚温室外的还会打霜。" : "寒潮来的时候，只有温室里的田能长。", cold?.now ? "gold" : "muted"),
    ]);
  }
  if (t === "solar") {
    return card([
      P("营地的电：" + Math.floor(e.c.energy || 0) + " / 100。现在：" + (e.automationStatus?.(b) || "白天发电中") + "。"),
      P("白天 06:00–18:30 每小时发 3 电（高温 5、暴雨 1），夜里停。电用在：照看机（每照看一块 " + DRONE.power + " 电）、噪声信标、夜里的暖光灯。", "muted"),
    ]);
  }
  if (t === "coop") {
    const base = tidyExtras(e, b).replace("也会进每日订单", "订单板上也会有人要"),
      ch = e.bt.chickens,
      why = e.chickenReason();
    const used = ch.day === e.s.day ? ch.used : 0;
    const line = ch.out
      ? P("鸡在田里：鸡舍 " + CHICKENS.r + " 步内每个钟点吃掉一只虫或啄干净一处草，到 " + clock(ch.until - e.absNow() + e.s.minute) + " 回窝。", "gold")
      : P("白天可以把鸡放进田里：鸡舍 " + CHICKENS.r + " 步内每个钟点吃掉一只虫或一处草，每两个钟点留一份鸡粪（堆肥用）；每天一成机会啄掉一棵刚出的苗。一天最多放 " + CHICKENS.hours + " 个钟点（今天放了 " + Math.round(used / 60) + " 个钟点）。", "muted");
    const btn = ch.out ? button("btChickens", "in", "赶回窝里") : act("btChickens", "out", "放鸡下地", why, true);
    return base + card([line, `<div class="button-row">${btn}</div>`]);
  }
  return tidyExtras(e, b);
}

// ================= 居民卡：替你看着田 =================
RESIDENT_HOOKS.push((e, r) => {
  if (!e?.bt || !r?.priorities?.farmer) return "";
  return `<p class="bt-res">种地：你在农场时只浇水、照看；熟了 ${RIPE_WAIT / 60} 个钟点没人收才替你收（巨型作物不碰，杂交苗照收）。你不在农场就照常收。</p>`;
});

// ================= 警报栏 =================
ALERT_HOOKS.push((e, add) => {
  if (!e?.bt) return;
  const bt = e.bt,
    day = e.s.day;
  if (bt.raid.state === "warned" && bt.raid.day === day) add(1, "今晚 01:00 菜地夜袭（" + bt.raid.n + " 只）", "danger", FIELD);
  if (bt.raid.state === "live" && e.s.region === "farm") add(0, "菜地夜袭：" + (e.raidAlive?.().length || 0) + " 只在田里", "danger", FIELD);
  const st = bt.storm;
  if (st.day === day + 1 && st.kind) add(2, "明天" + STORM_NAME[st.kind] + " · 今天抢收或盖布", "warn", FIELD);
  const g = Object.values(bt.giants)[0];
  if (g) {
    const p = e.plotById(g.ids[0]);
    if (p) add(3, "巨型" + cropName(g.crop) + "：锄 " + GIANT.hits + " 下就能收", "gold", { region: "farm", x: p.x + 20, y: p.y + 20, label: "巨型" + cropName(g.crop) });
  }
  const due = bt.orders.list.find((x) => x.due === day);
  if (due) add(3, "今天要交" + due.name + "的单子", "warn", { region: "farm", x: ORDERS.spot.x, y: ORDERS.spot.y + 30, label: "订单板" });
  const cold = e.coldNext?.();
  if (cold && !cold.now && cold.day - day <= 1 && cold.day >= day) {
    const gh = e.s.buildings.find((b) => b.type === "greenhouse" && b.hp > 0);
    add(3, (cold.day === day ? "今天" : "明天") + "寒潮：温室外的田不长", "warn", gh ? { region: "farm", x: gh.x, y: gh.y + 30, label: "温室" } : FIELD);
  }
  for (const [id, r] of Object.entries(bt.compost))
    if (r.out) {
      const b = e.s.buildings.find((x) => x.id === id);
      if (b) add(4, "堆肥桶有 " + r.out + " 袋肥", "normal", { region: "farm", x: b.x, y: b.y + 26, label: "堆肥桶" });
      break;
    }
});

// ================= 出货箱、工作台：“每日订单”换成订单板 =================
export function patchOrderLinks(html) {
  return String(html).replace(/<button data-action="rOpen" data-id="camp:orders">每日订单<\/button>/g, '<button data-action="bView" data-id="bOrders">订单板</button>');
}

// ================= 视图、标题、动作 =================
const TITLES = { bWater: "水网", bCompost: "堆肥桶", bOrders: "订单板" };
export function bountyTitle(ui, fallback) {
  return TITLES[ui?.view] || fallback(ui);
}
export function renderBountyView(e, ui, base) {
  if (!e?.bt || !ui) return base(e, ui);
  let body = null;
  if (ui.view === "bWater") body = viewWater(e);
  else if (ui.view === "bCompost") body = viewCompost(e, ui);
  else if (ui.view === "bOrders") body = viewOrders(e);
  if (body !== null) return `<div class="outpost-page view-${esc(ui.view)} bt-page">${body}</div>`;
  let html = base(e, ui);
  if (ui.view === "gPlot") html = patchPlot(e, ui, html);
  else if (ui.view === "gPick") html = patchPick(e, ui, html);
  else if (ui.view === "gBoard") html = patchBoard(e, html);
  else if (ui.view === "shipping") html = patchOrderLinks(html);
  return html;
}

const ACTIONS = ["bView", "btNet", "btSprinkler", "btCompKind", "btCompAdd", "btCompTake", "btFert", "btRush", "btGiant", "btMystery", "btOrderGive", "btOrderTear", "btChickens"];
export function handleBountyAction(action, el, ctx) {
  const { engine: e, showMenu, closeMenu, renderMenu, save } = ctx,
    id = el?.dataset?.id || "";
  // 工作台、出货箱上的“每日订单”：直接打开订单板
  if (action === "rOpen" && id === "camp:orders" && e?.bt) {
    e.ordersMorning?.();
    showMenu("outpost", { view: "bOrders", id: "" });
    return true;
  }
  if (!ACTIONS.includes(action)) return false;
  if (!e?.bt) return true;
  let ok = false,
    close = false;
  const plot = (pid) => e.plotById(pid);
  if (action === "bView") {
    if (id === "bOrders") e.ordersMorning?.();
    showMenu("outpost", { view: id, id: "" });
    return true;
  }
  if (action === "btNet") {
    const [kind, dir] = id.split(":");
    ok = e.netMove(kind, Number(dir));
  } else if (action === "btSprinkler") ok = e.toggleSprinkler(id);
  else if (action === "btCompKind") {
    const [bid, kind] = id.split("|");
    ok = e.compostKind(bid, kind);
  } else if (action === "btCompAdd") {
    const [bid, item, n] = id.split("|");
    ok = e.compostAdd(bid, item, Number(n) || 1);
  } else if (action === "btCompTake") ok = e.compostTake(id);
  else if (action === "btFert") {
    const [pid, kind] = id.split("|");
    const p = plot(pid);
    ok = !!p && e.applyFert(p, kind);
  } else if (action === "btRush") {
    const p = plot(id);
    ok = !!p && e.fromMenu(() => e.fieldRush(p));
    close = ok;
  } else if (action === "btGiant") {
    const p = plot(id);
    ok = !!p && e.fromMenu(() => e.giantHit(p));
    close = ok && !e.giantOf(p);
  } else if (action === "btMystery") {
    ok = e.plantMystery(id);
    close = ok;
  } else if (action === "btOrderGive") ok = e.deliverBoardOrder(id);
  else if (action === "btOrderTear") ok = e.tearOrder(id);
  else if (action === "btChickens") ok = id === "in" ? e.recallChickens() : e.releaseChickens();
  if (ok) save();
  if (ok && close) closeMenu();
  else renderMenu();
  return true;
}
