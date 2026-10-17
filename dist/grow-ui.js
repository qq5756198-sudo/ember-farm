// v0.34.0「成长」的界面：技能页的 6–10 级（老手的小本事）、重建站上每面墙的第二年清单、成就册里的打法挑战和老手、
// 武器台那一页每样近战擅长的场合、大事卡片的小图。
import { ITEMS, SKILLS } from "./data.js";
import { SPECS } from "./expansion-data.js";
import { MELEE } from "./gear-data.js";
import { WALLS, WALL_IDS, GROUPS } from "./relight-data.js";
import { SKILL_NAMES, SKILL_ORDER, TALENTS, TALENT_IDS, RESPEC_COST } from "./thief-data.js";
import { addMomentIcons } from "./zest-ui.js";
import { MASTER_XP, MASTER_TOP, PERKS, CHALLENGES, CHALLENGE_IDS, LISTS2, LIST2_IDS, LISTS2_START, WALL_KEEPSAKE, WEAPON_USE } from "./grow-data.js";
import { WALL2 } from "./hope-data.js";
import { DECOR_BY_ID } from "./almanac-data.js";

const esc = (v) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
const button = (a, id, label, extra = "") => `<button data-action="${a}" data-id="${esc(id)}"${extra ? " " + extra : ""}>${esc(label)}</button>`;
const dis = (reason) => (reason ? `disabled title="${esc(reason)}"` : "");
const act = (a, id, label, reason, primary = false) => button(a, id, label, reason ? dis(reason) : primary ? 'class="primary"' : "") + (reason ? `<small class="story-lack">${esc(reason)}</small>` : "");
const name = (id) => ITEMS[id]?.name || id;
const keyName = (k) => (k.startsWith("@") ? GROUPS[k.slice(1)]?.name || k : name(k));
const rewardText = (r) =>
  Object.entries(r || {})
    .map(([k, n]) => (k === "gold" ? n + " 金币" : name(k) + (n > 1 ? " ×" + n : "")))
    .join("、");

// ================= 技能页：1–10 级 =================
function xpOf(e, skill) {
  return Math.floor(e.masterXp ? e.masterXp(skill) : skill === "thief" ? e.sk.thiefXp : e.s.xp[skill] || 0);
}
function masterList(e, skill) {
  const L = e.masterLv(skill);
  const rows = PERKS[skill]
    .map((p) => {
      const on = L >= p.lv;
      return `<li class="gr-perk${on ? " on" : ""}"><span class="talent-meta">Lv.${p.lv}</span><b>${esc(p.name)}</b><small>${esc(p.text)}</small>${on ? `<i>✓</i>` : ""}</li>`;
    })
    .join("");
  return `<div class="gr-master"><b>老手 · 6–10 级</b><ul>${rows}</ul></div>`;
}
function skillCard(e, skill) {
  const L = e.masterLv(skill),
    xp = xpOf(e, skill),
    nx = e.masterNext(skill),
    into = nx.to > nx.from ? (xp - nx.from) / (nx.to - nx.from) : 1;
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
  const line = L >= MASTER_TOP ? "满级 · 经验 " + xp : "经验 " + xp + " · 下一级还差 " + nx.left;
  return `<article class="skill-col skill-${skill}${L > 5 ? " gr-past5" : ""}"><header><h3>${esc(SKILL_NAMES[skill])}<span>Lv.${L}</span></h3><div class="skill-xp" role="img" aria-label="经验 ${xp}"><i style="width:${Math.round(Math.max(0, Math.min(1, into)) * 100)}%"></i></div><small>${line}</small><p class="skill-desc">${esc(desc)}</p>${masterList(e, skill)}</header><div class="skill-body">${spec}<ul class="talents">${talents}</ul></div></article>`;
}
export function renderGrowSkillPage(e, fallback) {
  if (!e?.sk || !e.masterLv) return fallback(e);
  const p = e.skillPoints(),
    why = e.respecReason();
  return `<div class="skill-page"><div class="skill-head"><p><b class="skill-points">可用技能点 ${Math.max(0, p.free)}</b>任何一项技能升到 2–5 级各 +1，每完成一段主线 +1（现在一共拿到 ${p.earned} 点，用掉 ${p.spent} 点）。全部天赋要 48 点，一局最多 28 点，得有取舍。6–10 级不给技能点，每级给一样老手的小本事。</p><span class="respec">${button("kRespec", "", "重新分配 · " + RESPEC_COST + " 金币", dis(why))}${why ? `<small>${esc(why)}</small>` : ""}</span></div><div class="tree-grid">${SKILL_ORDER.map((k) => skillCard(e, k)).join("")}</div><p class="note">种地、清理、收获涨农业；建造、加工涨制造；搜集、救援、钓鱼涨探索；打感染者涨战斗；偷东西涨妙手。6–10 级一级比一级慢，小本事只给方便和花样，不加伤害、不加血。</p></div>`;
}

// ================= 重建站：每面墙的第二年清单 =================
function list2Card(e, id) {
  const L = LISTS2[id],
    done = e.list2Done(id),
    p = e.list2Progress(id);
  const rows = L.need
    .map(([k, n]) => {
      const got = Math.min(n, e.list2Got(id, k)),
        have = e.listHave(k),
        full = got >= n,
        st = e._zStamp,
        stamped = st && st.list === id && st.key === k && Date.now() - st.at < 900;
      return `<li class="${full ? "full" : ""}${stamped ? " z-stamped" : ""}"><span>${esc(keyName(k))}</span><small>${got}/${n}${full ? " ✓" : " · 有 " + have}</small>${done || full ? "" : act("grL2", id + "|" + k, "交", e.list2Reason(id, k), true)}</li>`;
    })
    .join("");
  return `<article class="rl-list gr-list2${done ? " done" : ""}"><h4>${esc(L.name)} <small>${p.have}/${p.need}${done ? " ✓" : ""}</small></h4><ul>${rows}</ul>${done ? "" : `<p class="muted">${esc(L.hint)}</p>`}<p class="rl-reward">交满：${esc(rewardText(L.reward))}</p></article>`;
}
function year2Block(e, w) {
  const ids = LIST2_IDS.filter((id) => LISTS2[id].wall === w),
    n = ids.filter((id) => e.list2Done(id)).length,
    open = ids.some((id) => e.list2Open(id)),
    got = e.gw?.w2[w];
  const reward = e.wall2On?.(w) && !got ? "这一处已经升过二级：两份都交满换一件纪念物「" + (DECOR_BY_ID[WALL_KEEPSAKE[w]]?.name || "") + "」" : "两份都交满：这一处升到二级（" + (WALL2[w]?.name || "") + "）";
  if (!open && !n)
    return `<div class="gr-year2 locked"><p class="muted"><b>第二年的清单</b>：${e.s.day < LISTS2_START ? "第二年（第 " + LISTS2_START + " 天）起" : "这面墙的第一批清单交满以后"}开，两份，要的东西更难凑。${esc(reward)}。</p></div>`;
  return `<div class="gr-year2"><h4>第二年的清单 <small>${n}/${ids.length}${got ? " ✓" : ""}</small></h4><p class="muted">${got ? "两份都交满了（第 " + got + " 天）。" : esc(reward) + "。"}</p><div class="rl-lists">${ids.map((id) => list2Card(e, id)).join("")}</div></div>`;
}
export function patchGrowStation(e, html) {
  if (!e?.gw || !e.rl || typeof html !== "string") return html;
  let out = html;
  for (const w of WALL_IDS) {
    const head = `<summary><b>${esc(WALLS[w].name)}</b>`,
      at = out.indexOf(head);
    if (at < 0) continue;
    const end = out.indexOf("</details>", at);
    if (end < 0) continue;
    out = out.slice(0, end) + year2Block(e, w) + out.slice(end);
  }
  return out;
}

// ================= 成就册：打法挑战、第二年的清单、老手 =================
function row(nameText, have, need, small, done) {
  return `<li class="${done ? "done" : ""}"><b>${esc(nameText)}</b><span class="bar"><i style="width:${Math.min(100, Math.round((have / Math.max(1, need)) * 100))}%"></i></span><span>${Math.min(have, need)}/${need}</span><small>${small}</small></li>`;
}
export function patchGrowCollection(e, html) {
  if (!e?.gw || typeof html !== "string") return html;
  const g = e.gw,
    done = CHALLENGE_IDS.filter((id) => g.chDone[id]).length;
  const chSmall = CHALLENGE_IDS.map((id) => {
    const C = CHALLENGES[id],
      ok = !!g.chDone[id],
      n = e.chHave(id),
      keep = DECOR_BY_ID[C.decor]?.name || "";
    return ok ? `<span class="gr-ch on">✓ ${esc(C.name)}（${esc(keep)}）</span>` : `<span class="gr-ch">${esc(C.name)}${C.need > 1 ? " " + n + "/" + C.need : ""} · ${esc(C.text)}</span>`;
  }).join("<br>");
  const l2 = LIST2_IDS.filter((id) => e.list2Done(id)).length;
  const ups = e.masterUps(),
    upsMax = Object.keys(MASTER_XP).length * (MASTER_TOP - 5);
  const lvSmall = Object.keys(MASTER_XP)
    .map((k) => esc(SKILL_NAMES[k] || k) + " Lv." + e.masterLv(k))
    .join(" · ");
  const chText = chSmall + `<br>${esc("每样做成给一件纪念物，算进收复度。")}`,
    l2Text = esc(l2 >= LIST2_IDS.length ? "✓ 六面墙都升到了二级" : "第二年起，每面墙的第一批交满以后多两份；两份都交满，那一处升二级");
  let out = html;
  // 收复度下面已经有这两行（空着说明）：把说明填上；没有的话就加在成就册的最后
  const fill = (label, small) => {
    const i = out.indexOf("<b>" + label + "</b>");
    if (i < 0) return false;
    const j = out.indexOf("<small></small>", i),
      k = out.indexOf("</li>", i);
    if (j < 0 || j > k) return false;
    out = out.slice(0, j) + "<small>" + small + "</small>" + out.slice(j + 15);
    return true;
  };
  let rows = "";
  if (!fill("打法挑战", chText)) rows += row("打法挑战", done, CHALLENGE_IDS.length, chText, done >= CHALLENGE_IDS.length);
  if (!fill("第二年的清单", l2Text)) rows += row("第二年的清单", l2, LIST2_IDS.length, l2Text, l2 >= LIST2_IDS.length);
  rows += row("老手（技能 6–10 级）", ups, upsMax, esc(lvSmall), ups >= upsMax);
  // 收复度那一行：原来的八项都满了（余烬地区重光了），新加的还能往上加
  const C = e.rlCompletion?.();
  if (C && C.core >= 100 && C.pct < 100) out = out.replace("下面这些清单合在一起", "✓ 余烬地区重光了；打法挑战、第二年的清单还能往上加");
  const start = out.indexOf('<ul class="collection">'),
    at = start >= 0 ? out.indexOf("</ul>", start) : -1;
  return at > 0 ? out.slice(0, at) + rows + out.slice(at) : out + `<ul class="collection">${rows}</ul>`;
}

// ================= 武器台那一页：每样近战擅长什么 =================
export function patchGrowBench(e, html) {
  if (!e?.gw || typeof html !== "string") return html;
  let out = html;
  for (const [id, text] of Object.entries(WEAPON_USE)) {
    if (!MELEE[id]) continue;
    const head = `<h4>${esc(name(id))}`,
      at = out.indexOf(head);
    if (at < 0) continue;
    const small = out.indexOf("</small>", out.indexOf("<small", at));
    if (small < 0) continue;
    const cramped = e.meleeStats?.(id)?.cramped ? " · 现在这里伸不开" : "";
    out = out.slice(0, small + 8) + `<p class="gr-use">${esc(text.replace(/^擅长：/, "擅长 · "))}${esc(cramped)}</p>` + out.slice(small + 8);
  }
  return out;
}

// ================= 动作 =================
const ACTIONS = ["grL2"];
export function handleGrowAction(action, el, ctx) {
  if (!ACTIONS.includes(action)) return false;
  const { engine: e, renderMenu, save } = ctx,
    id = el?.dataset?.id || "";
  if (!e?.gw) return true;
  let ok = false;
  if (action === "grL2") {
    const [list, key] = id.split("|");
    ok = e.list2Deliver(list, key);
  }
  if (ok) save();
  renderMenu();
  return true;
}

// ================= 大事卡片的小图 =================
addMomentIcons(
  {
    // 老手：一颗往上的星；打法挑战：交叉的刀和锤
    master: [".....a......", ".....a......", "....aba.....", "aaaabbbaaaa.", ".abbbcbbba..", "..abbcbba...", "...abbba....", "..abbabba...", "..aba.aba...", ".aba...aba..", ".aa.....aa..", "............"],
    challenge: ["a.........a.", "ab.......ba.", ".ab.....ba..", "..ab...ba...", "...ab.ba....", "....aba.....", "...ab.ba....", "..acc..cca..", ".acc....cca.", "acca....acca", ".aa......aa.", "............"],
  },
  {
    master: ["#5b3a12", "#ffd76a", "#fff3c4"],
    challenge: ["#3d1d18", "#f1a28a", "#cdc8b6"],
    list2: ["#3a2a1a", "#ffcf6a", "#fff3c4"],
  },
);
