// v0.22.0「披挂」的界面：行囊里的装备栏（小人、八个栏位、陷阱、合计、换装对比）、
// 武器台的“修理与改装”、旧档第一次读进来的说明卡、场景里的状态小条、每日抉择新动作的说明。
import { ITEMS } from "./data.js";
import {
  ARMOR,
  MELEE,
  RANGED,
  THROWN,
  TRAPS,
  TRAP_IDS,
  ARMOR_SLOTS,
  GEAR_SLOTS,
  SLOT_NAMES,
  KIND_NAMES,
  MODS,
  MOD_IDS,
  modFits,
  gearDef,
  slotOf,
  BLUEPRINTS,
  BP_IDS,
  REPAIR,
  INFECTION,
  PHASE_NAMES,
  OLD_SAVE_GIFT,
  GRACE_DAYS,
} from "./gear-data.js";
import { PREVIEW_HOOKS } from "./daily-ui.js";
import { itemsText } from "./daily.js";
import { keyLabel } from "./farlands-ui.js";

const esc = (v) =>
  String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
const dis = (reason) => (reason ? `disabled title="${esc(reason)}"` : "");
// 按钮按不了的原因直接写在旁边，不只放在悬停提示里
const why = (reason) => (reason ? `<small class="gear-why">${esc(reason)}</small>` : "");
const name = (id) => ITEMS[id]?.name || id;
const bundle = (b) =>
  Object.entries(b || {})
    .filter(([, n]) => n > 0)
    .map(([id, n]) => name(id) + " " + n)
    .join("、");
const pct = (v) => Math.round(v * 100) + "%";
const iconOf = (id, helpers) => (helpers?.itemIcon ? helpers.itemIcon(id) : `<i class="item-icon" data-icon="${esc(ITEMS[id]?.icon ?? 40)}"></i>`);

// 行囊里选中的栏位（只在这一页用）
export const gearUI = { slot: null };

// ================= 每日抉择：新动作的说明 =================
PREVIEW_HOOKS.push((e, op) => {
  if (op[0] === "bp") return e.knows?.(op[1]) ? "这张图纸已经会了，换成废金属 4" : "学会" + (BLUEPRINTS[op[1]]?.name || "图纸");
  if (op[0] === "fixGear") return "修满身上最旧的一件装备";
  if (op[0] === "gear") return itemsText(op[1]);
  return "";
});

// ================= 一件装备的几行数 =================
function armorStats(a) {
  return [
    ["护甲", Math.round((a.armor || 0) * 100), "%", 1],
    ["防抓", a.scratch || 0, "%", 1],
    ["防咬", a.bite || 0, "%", 1],
    ["重量", a.weight || 0, "", -1],
    ["保暖", a.warmth || 0, "", 1],
    ["噪音", a.noise || 0, "", -1],
    ["耐久", a.dur || 0, "", 1],
  ];
}
function weaponStats(e, id) {
  const m = MELEE[id];
  if (m) {
    const w = e.meleeStats(id);
    return [
      ["伤害", Math.round(w.dmg), "", 1],
      ["间隔", Math.round(w.cd * 100) / 100, "秒", -1],
      ["范围", Math.round(w.range), "", 1],
      ["击退", Math.round(w.knock), "", 1],
      ["破甲", Math.round(w.pierce * 100), "%", 1],
      ["声音", w.noise, "", -1],
      ["耐久", m.dur || 0, "", 1],
    ];
  }
  const r = RANGED[id];
  if (r?.gun) {
    const w = e.weaponStats(id) || {};
    return [
      ["伤害", Math.round(w.damage || 0), "", 1],
      ["间隔", Math.round((w.cooldown || 0) * 100) / 100, "秒", -1],
      ["射程", Math.round(w.range || 0), "", 1],
      ["击退", r.knock, "", 1],
      ["破甲", Math.round(r.pierce * 100), "%", 1],
      ["声音", Math.round(w.noise || 0), "", -1],
    ];
  }
  if (r)
    return [
      ["伤害", r.dmg, "", 1],
      ["间隔", r.cd, "秒", -1],
      ["射程", r.range, "", 1],
      ["击退", r.knock, "", 1],
      ["破甲", Math.round(r.pierce * 100), "%", 1],
      ["声音", r.noise, "", -1],
    ];
  const t = THROWN[id];
  if (t)
    return [
      ["伤害", t.dmg, "", 1],
      ["距离", t.range, "", 1],
      ["声音", t.noise, "", 1],
    ];
  return [];
}
const statsOf = (e, id) => (ARMOR[id] ? armorStats(ARMOR[id]) : weaponStats(e, id));
// 和身上那件比：▲ 更好、▼ 更差
function compare(e, id, cur) {
  const a = statsOf(e, id),
    b = cur ? statsOf(e, cur) : null;
  return a
    .filter(([, v], i) => v || (b && b[i][1]))
    .map(([label, v, unit, better]) => {
      const was = b?.find((x) => x[0] === label)?.[1] ?? 0,
        diff = b ? (v - was) * better : 0,
        mark = !b || !diff ? "" : diff > 0 ? `<i class="up">▲</i>` : `<i class="down">▼</i>`;
      return `<span>${label} ${v}${unit}${mark}</span>`;
    })
    .join("");
}
function durBar(e, id) {
  const def = gearDef(id);
  if (!def?.dur) return `<small class="gear-dur-text">不会坏</small>`;
  const c = e.cond(id),
    v = c.m > 0 ? c.d / c.m : 0,
    tone = c.d <= 0 ? "broken" : v <= 0.25 ? "low" : "";
  return `<span class="gear-dur ${tone}" title="耐久 ${Math.ceil(c.d)} / ${c.m}"><i style="width:${Math.round(v * 100)}%"></i></span><small class="gear-dur-text">${c.d <= 0 ? "坏了" : "耐久 " + Math.ceil(c.d) + "/" + c.m}${c.r ? " · 修过 " + c.r + " 次" : ""}</small>`;
}
const modText = (e, id) => {
  const mods = Object.entries(e.gr.cond[id]?.mods || {});
  return mods.length ? mods.map(([m, n]) => MODS[m].name + (MODS[m].n ? " " + n + " 次" : "")).join("、") : "";
};

// ================= 行囊：装备栏 =================
export function renderGearPanel(e, helpers = {}) {
  if (!e.gr) return "";
  const g = e.gr.slots,
    T = e.armorTotals(),
    sel = gearUI.slot,
    broken = Object.fromEntries(ARMOR_SLOTS.map((k) => [k, !!g[k] && e.broken(g[k])]));
  const slotBtn = (k) => {
    const id = g[k],
      bad = id && gearDef(id)?.dur && e.broken(id),
      count = id && (THROWN[id] ? e.qty(id) : 0);
    return `<button class="gear-slot${sel === k ? " active" : ""}${bad ? " broken" : ""}${id ? "" : " empty"}" data-action="gSlot" data-id="${k}" aria-pressed="${sel === k}" title="${esc(SLOT_NAMES[k] + "栏" + (id ? "：" + name(id) : "：空"))}"><span class="gear-slot-key">${SLOT_NAMES[k]}</span>${id ? iconOf(id, helpers) : `<i class="gear-empty-icon"></i>`}<span class="gear-slot-body"><b>${id ? esc(name(id)) + (THROWN[id] ? " ×" + count : "") : "空着"}</b>${id ? durBar(e, id) : `<small class="gear-dur-text">点开换装</small>`}</span></button>`;
  };
  const trapId = e.gr.trap,
    trapBtn = `<button class="gear-slot trap${sel === "trap" ? " active" : ""}" data-action="gSlot" data-id="trap" aria-pressed="${sel === "trap"}" title="快捷栏 7 的陷阱"><span class="gear-slot-key">陷阱</span>${iconOf(trapId, helpers)}<span class="gear-slot-body"><b>${esc(name(trapId))} ×${e.qty(trapId)}</b><small class="gear-dur-text">快捷栏 7 · 点地面摆下</small></span></button>`;
  const bite = ARMOR_SLOTS.map((k) => SLOT_NAMES[k] + " " + (T.bite[k] || 0) + "%").join(" · "),
    scratch = ["body", "hands"].map((k) => SLOT_NAMES[k] + " " + (T.scratch[k] || 0) + "%").join(" · "),
    warm = e.warmthTier?.(T.warmth);
  const summary = `<div class="gear-sum"><span><b>护甲 ${pct(T.armor)}</b>${T.armor >= 0.5 ? "（到顶了）" : ""}</span><span>重量 ${T.weight} · ${T.tier.name}${T.tier.speed < 1 ? "（走得慢 " + Math.round((1 - T.tier.speed) * 100) + "%）" : ""}</span><span>保暖 ${T.warmth}${e.coldActive?.() && warm ? "（现在" + warm.text + "）" : ""}</span><span>噪音 ${T.noise > 0 ? "+" + T.noise : T.noise}</span></div><p class="gear-guard">防咬：${bite}<br>防抓：${scratch}</p>`;
  return `<section class="gear-panel" aria-label="装备"><div class="gear-doll-wrap"><canvas class="gear-doll" data-doll="1" width="88" height="136" aria-label="身上穿的装备"${Object.entries(broken)
    .filter(([, v]) => v)
    .map(([k]) => ` data-broken-${k}="1"`)
    .join("")}></canvas>${summary}</div><div class="gear-slots">${GEAR_SLOTS.map(slotBtn).join("")}${trapBtn}</div>${sel ? renderPick(e, sel, helpers) : `<p class="gear-tip muted">点一个栏位换装。穿着的不占背包格子；坏了的回农场武器台修。</p>`}</section>`;
}
// 选中的栏位：能换上的东西（背包里的；在农场时仓库里的也行）
function renderPick(e, slot, helpers) {
  const farm = e.s.region === "farm";
  if (slot === "trap") {
    const rows = TRAP_IDS.map((id) => {
      const have = e.qty(id),
        reason = e.equipReason(id);
      return `<div class="gear-pick-row">${iconOf(id, helpers)}<div><b>${esc(name(id))} ×${have}</b><small>${esc(ITEMS[id].desc || "")}</small>${reason && e.gr.trap !== id ? why(reason) : ""}</div><button data-action="gEquip" data-id="${id}" ${dis(reason)}>${e.gr.trap === id ? "已选中" : "选这个"}</button></div>`;
    }).join("");
    return `<div class="gear-pick"><h4>陷阱</h4>${rows}</div>`;
  }
  const cur = e.gr.slots[slot],
    ids = new Set();
  for (const [id, n] of Object.entries(e.s.inventory)) if (n > 0 && slotOf(id) === slot) ids.add(id);
  if (farm) for (const [id, n] of Object.entries(e.s.storage)) if (n > 0 && slotOf(id) === slot) ids.add(id);
  const list = [...ids].filter((id) => id !== cur);
  const rows = list
    .map((id) => {
      const inBag = e.qty(id) > 0,
        reason = inBag ? e.equipReason(id) : farm ? "" : "在仓库里",
        where = inBag ? "" : "（仓库）";
      return `<div class="gear-pick-row">${iconOf(id, helpers)}<div><b>${esc(name(id))}${where}</b><small class="gear-cmp">${compare(e, id, cur)}</small>${gearDef(id)?.dur ? durBar(e, id) : ""}${why(reason)}</div><button class="primary" data-action="gEquip" data-id="${id}" ${dis(reason)}>${ARMOR[id] ? "穿上" : "拿上"}</button></div>`;
    })
    .join("");
  const off = cur ? e.unequipReason(slot) : "";
  const curRow = cur
    ? `<div class="gear-pick-row current">${iconOf(cur, helpers)}<div><b>${esc(name(cur))} · 身上的</b><small class="gear-cmp">${compare(e, cur, null)}</small>${modText(e, cur) ? `<small>改装：${esc(modText(e, cur))}</small>` : ""}${why(off)}</div><button data-action="gUnequip" data-id="${slot}" ${dis(off)}>卸下</button></div>`
    : "";
  const empty = !list.length ? `<p class="muted">${farm ? "背包和仓库里没有别的" : "背包里没有别的"}${SLOT_NAMES[slot]}栏装备。${hint(slot)}</p>` : "";
  return `<div class="gear-pick"><h4>${SLOT_NAMES[slot]}栏</h4>${curRow}${rows}${empty}</div>`;
}
function hint(slot) {
  return (
    {
      head: "破布头巾随身就能做；车库里有摩托头盔。",
      body: "居民区的旧衣柜里有皮夹克；武器台能做废胎护甲。",
      hands: "工作手套在旧衣柜和工具架上；工作台能做皮护臂。",
      legs: "旧衣柜里有牛仔裤；车库里有摩托护腿。",
      feet: "工业仓库的工装柜里有工装靴。",
      melee: "随身就能做削尖木矛；武器台能做钉子球棒、铁管。",
      ranged: "随身就能做弹弓；枪在武器台做。",
      throw: "石材就是诱敌石；工作台能做鞭炮。",
    }[slot] || ""
  );
}

// ================= 武器台：修理与改装 =================
function ownedGear(e) {
  const ids = new Set();
  for (const bag of [e.s.inventory, e.s.storage]) for (const [id, n] of Object.entries(bag)) if (n > 0 && gearDef(id)) ids.add(id);
  const order = (id) => GEAR_SLOTS.indexOf(slotOf(id));
  return [...ids].sort((a, b) => order(a) - order(b) || (e.isWorn(b) ? 1 : 0) - (e.isWorn(a) ? 1 : 0));
}
export function renderGearBench(e, helpers = {}) {
  if (!e.gr) return "";
  return `<section class="gear-bench-section" aria-label="修理与改装"><h3 class="gear-h">修理与改装</h3>${viewBench(e, helpers)}</section>`;
}
function viewBench(e, helpers) {
  const farm = e.benchReady(),
    list = ownedGear(e);
  const rows = list
    .map((id) => {
      const def = gearDef(id),
        c = def.dur ? e.cond(id) : null,
        have = (e.s.inventory[id] || 0) + (e.s.storage[id] || 0),
        worn = e.isWorn(id),
        tags = [worn ? "身上" : "", have > 1 ? "共 " + have + " 件" : "", c && c.d <= 0 ? "坏了" : ""].filter(Boolean),
        repair = def.dur ? e.repairReason(id) : "这件不会坏",
        cost = e.repairCost(id),
        // 自制消音器不占改装位：手枪、步枪没有改装位也能装
        fitting = MOD_IDS.filter((m) => modFits(m, id) && (def.mods || m === "diySuppressor")),
        used = Object.keys(e.gr.cond[id]?.mods || {}).filter((m) => m !== "diySuppressor").length,
        mods = fitting
          .map((m) => {
            const on = !!e.gr.cond[id]?.mods?.[m],
              self = Object.keys(MODS[m].cost).join() === m;
            let r = on ? (farm ? "" : "回农场的武器台拆") : e.modReason(id, m);
            // 消音器本身就是材料：缺的时候告诉玩家去哪儿弄
            if (self && /^还缺/.test(r)) r += e.knows?.("bp_suppressor") ? "（在武器台做一个）" : "（先要拿到自制消音器的图纸）";
            const button = on
              ? `<button data-action="gUnmod" data-id="${id}|${m}" ${dis(r)}>拆下${esc(MODS[m].name)}</button>`
              : `<button data-action="gMod" data-id="${id}|${m}" ${dis(r)}>装上${esc(MODS[m].name)}${self ? "" : "（" + esc(bundle(MODS[m].cost)) + "）"}</button>`;
            return `<div class="gear-mod-row">${button}<small>${esc(MODS[m].text)}${m === "diySuppressor" ? "；不占改装位" : ""}</small>${farm && !on ? why(r) : ""}</div>`;
          })
          .join(""),
        dism = e.dismantleReason(id),
        fresh = def.dur ? e.freshReason(id) : "这件不会坏";
      // 修理那一行：能修就写修好以后的上限，修不了就写为什么（耐久满了的不啰嗦）
      const repairLine = !def.dur
        ? ""
        : !repair
          ? `<small class="gear-next">修好后耐久回满，上限 ${c.m} → ${e.repairNextMax(id)}（第 ${c.r + 1}/${REPAIR.maxRepairs} 次）</small>`
          : farm && repair !== "耐久是满的"
            ? why("修理：" + repair)
            : "";
      const otherWhy = farm ? [have > 1 && def.dur && fresh && fresh !== "现在这件是新的" ? "换上备用的：" + fresh : "", dism ? "拆解：" + dism : ""].filter(Boolean).map(why).join("") : "";
      return `<article class="gear-bench-row${c && c.d <= 0 ? " broken" : ""}">${iconOf(id, helpers)}<div class="gear-bench-body"><h4>${esc(name(id))}${tags.map((t) => `<span class="gear-tag">${esc(t)}</span>`).join("")}</h4>${durBar(e, id)}<small>${esc((ARMOR[id] ? SLOT_NAMES[ARMOR[id].slot] + "栏" : KIND_NAMES[MELEE[id]?.kind || "ranged"]) + (def.mods ? " · 改装位 " + used + "/" + def.mods : ""))}${modText(e, id) ? " · " + esc(modText(e, id)) : ""}</small><div class="button-row">${def.dur ? `<button class="primary" data-action="gRepair" data-id="${id}" ${dis(repair)}>修理${cost ? "（" + esc(bundle(cost)) + "）" : ""}</button>` : ""}${have > 1 && def.dur ? `<button data-action="gFresh" data-id="${id}" ${dis(fresh)} title="把用旧的那件拆了，换上备用的新的">换上备用的</button>` : ""}<button data-action="gDismantle" data-id="${id}" ${dis(dism)} title="${esc("拆了得到：" + (bundle(def.scrap) || "没有"))}">拆解（${esc(bundle(def.scrap) || "—")}）</button></div>${repairLine}${otherWhy}${mods ? `<details class="gear-mods"${fitting.some((m) => e.gr.cond[id]?.mods?.[m]) ? " open" : ""}><summary>改装（${fitting.length} 种能装）</summary>${mods}</details>` : ""}</div></article>`;
    })
    .join("");
  const bp = BP_IDS.filter((b) => e.knows(b)),
    bpLine = `<p class="gear-bp">会做的图纸：${bp.length ? bp.map((b) => esc(BLUEPRINTS[b].name.replace("图纸", ""))).join("、") : "还没有"}（${bp.length}/${BP_IDS.length}）</p>`;
  return `<p class="muted">${farm ? "修好后耐久上限少一成，最多修 " + REPAIR.maxRepairs + " 次，之后只能拆。坏了的装备不会消失。" : "要在农场、站在武器台旁边才能修理和改装。"}${e.level?.("manufacturing") >= 3 ? " 制造 3 级：修理材料减半。" : ""}</p>${bpLine}<div class="gear-bench">${rows || '<p class="muted">还没有能修的装备。</p>'}</div>${guardSection(e, helpers)}`;
}
// 给守卫居民一件身体防具：灰隼团的流弹伤他少一半
function guardSection(e, helpers) {
  const people = e.c?.residents || [];
  if (!people.length) return "";
  const bodies = Object.keys(ARMOR).filter((id) => ARMOR[id].slot === "body" && e.qty(id, e.s.region === "farm") > 0);
  const rows = people
    .map((r) => {
      const has = e.gr.guards[r.id],
        nameText = e.residentName?.(r.id) || "居民",
        buttons = bodies.map((id) => `<button data-action="gGuard" data-id="${esc(r.id)}|${id}" ${dis(e.guardReason(r.id, id))}>给${esc(name(id))}</button>`).join("");
      return `<div class="gear-guard-row"><b>${esc(nameText)}</b><span>${has ? "穿着" + esc(name(has)) : "没有防具"}</span><div class="button-row">${buttons || '<small class="muted">手上没有多的身体防具</small>'}</div></div>`;
    })
    .join("");
  return `<h3 class="gear-h">居民的防具</h3><p class="muted">穿上身体防具的居民，被灰隼团的流弹擦伤时少受一半。</p>${rows}`;
}

// ================= 说明卡 =================
function viewIntro(e) {
  const g = e.gr,
    s = e.s.settings,
    shove = keyLabel(s, "shove") || "X",
    act = keyLabel(s, "interact") || "E";
  // 只写真的穿上了的：背包里没有的不会写成“放进了栏位”
  const worn = GEAR_SLOTS.filter((k) => g.slots[k]).map((k) => SLOT_NAMES[k] + "：" + name(g.slots[k]));
  const old = g.old
    ? `<div class="gear-intro-old"><h4>你的家园已经升级</h4><ul>${worn.length ? `<li>背包里能用的已经替你穿戴好——${esc(worn.join("，"))}。</li>` : ""}${g.grace >= e.s.day ? `<li>接下来到第 ${g.grace} 天，感染者按「${esc(PHASE_NAMES[Math.max(0, e.phase())])}」的强度来，给你时间换装。</li>` : ""}${g.gift ? `<li>仓库里多了：${esc(bundle(OLD_SAVE_GIFT))}。回农场在行囊里穿上。</li>` : ""}</ul></div>`
    : "";
  return `<div class="gear-intro">${old}<h4>感染者变凶了</h4><ul><li>头 3 天、第 4–7 天、第 8 天以后各强一段；能搜的地方都有一群守着。</li><li>被抓住时按 <kbd>${esc(shove)}</kbd> 推开，或连按 <kbd>${esc(act)}</kbd> 挣开；没挣开会被咬一口，感染涨 ${INFECTION.bite}%，每睡一晚降 ${INFECTION.sleep}%。</li><li>奔跑者蹲下就要扑：往旁边躲，或拿矛对准它顶住。重甲跺脚就要冲撞：躲开让它撞墙，撞晕了打它多 50%。</li><li>尖叫者张嘴时打它一下就叫不出来；血不多的感染者会摔成爬行者，走过去按 <kbd>${esc(act)}</kbd> 踩它。</li></ul><h4>装备</h4><ul><li>按 Tab 打开行囊，点栏位换装：头、身、手、腿、脚五件防具，近战、远程、投掷三件武器。穿着的不占格子。</li><li>快捷栏：4 近战、5 远程、6 投掷、7 陷阱。</li><li>装备会磨损，坏了没有保护、武器伤害减半，但不会消失；回农场武器台修。</li></ul><div class="button-row"><button class="primary" data-action="gIntroOk" data-hotkey="1">知道了</button><button data-action="gOpenBag">打开行囊</button></div></div>`;
}

// ================= 场景里的状态小条 =================
export function gearStatusHtml(e) {
  const chips = e.gearHud?.() || [];
  return chips.map((c) => `<button class="gear-chip ${esc(c.tone)}" data-action="gStatus" data-id="${esc(c.id)}" title="${esc(c.title)}">${esc(c.text)}</button>`).join("");
}

// ================= 武器台卡片：修理与改装就在“武器与潜行”那一页里 =================
export function gearStationExtras(e, b) {
  return "";
}
// 背包里点一件装备：和身上那一栏的比
export function gearDetailHtml(e, id, helpers = {}) {
  const slot = e.gr ? slotOf(id) : null;
  if (!slot) return "";
  const cur = e.gr.slots[slot],
    same = cur === id;
  return `<div class="gear-detail"><p><b>${SLOT_NAMES[slot]}栏</b>${same ? " · 正穿着" : cur ? " · 和身上的" + esc(name(cur)) + "比" : " · 这一栏空着"}</p><p class="gear-cmp">${compare(e, id, same ? null : cur)}</p>${gearDef(id)?.dur ? durBar(e, id) : ""}${modText(e, id) ? `<small>改装：${esc(modText(e, id))}</small>` : ""}</div>`;
}

// ================= 视图、标题、动作 =================
const TITLES = { gIntro: "披挂上阵" };
export function gearTitle(ui, fallback) {
  return TITLES[ui.view] || fallback(ui);
}
export function renderGearView(e, ui = {}, fallback) {
  if (!e.gr || !TITLES[ui.view]) return fallback(e, ui);
  return `<div class="outpost-page view-${esc(ui.view)}">${viewIntro(e)}</div>`;
}
// 顶栏小图标点一下：说明怎么治
const STATUS_HELP = {
  grab: "被抓住了：推开立刻挣开，或连按交互键三下。",
  bleed: "流血：每秒掉 1.2 生命，用一条绷带止住（9 号快捷栏）。",
  fever: "发烧：生命上限 −30、体力恢复减半。吃一份药包，再睡一晚就退烧。",
  inf: "感染：被咬会涨，每睡一晚降 20%，满了会发烧。穿防咬的头盔、护臂、护腿能少挨咬。",
  heal: "正在慢慢回血：绷带 5 秒、药包 8 秒。",
};
const ACTIONS = ["gSlot", "gEquip", "gUnequip", "gRepair", "gMod", "gUnmod", "gDismantle", "gFresh", "gGuard", "gBench", "gIntroOk", "gOpenBag", "gStatus", "touchShove"];
export function handleGearAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, showMenu, closeMenu, renderMenu, save } = ctx,
    id = el.dataset.id || "";
  if (!e.gr) return true;
  const after = (ok) => {
    if (ok) save();
    renderMenu();
  };
  switch (action) {
    case "gSlot":
      gearUI.slot = gearUI.slot === id ? null : id;
      renderMenu();
      break;
    case "gEquip": {
      // 在农场：仓库里的先拿出来再穿
      if (!e.qty(id) && e.s.region === "farm" && e.s.storage[id] > 0) e.transfer(id, false, false);
      after(e.equip(id));
      break;
    }
    case "gUnequip":
      after(e.unequip(id));
      break;
    case "gRepair":
      after(e.repairGear(id));
      break;
    case "gMod": {
      const [gid, m] = id.split("|");
      after(e.applyMod(gid, m));
      break;
    }
    case "gUnmod": {
      const [gid, m] = id.split("|");
      after(e.removeMod(gid, m));
      break;
    }
    case "gDismantle":
      after(e.dismantleGear(id));
      break;
    case "gFresh":
      after(e.freshCopy(id));
      break;
    case "gGuard": {
      const [rid, gid] = id.split("|");
      after(e.armGuard(rid, gid));
      break;
    }
    case "gBench":
      showMenu("frontier", { tab: "combat" });
      break;
    case "gStatus":
      ctx.toast?.(STATUS_HELP[id] || "");
      break;
    case "gIntroOk":
      e.markGearIntro();
      save();
      closeMenu();
      break;
    case "gOpenBag":
      e.markGearIntro();
      save();
      showMenu("inventory");
      break;
    case "touchShove":
      e.shove();
      break;
  }
  return true;
}
